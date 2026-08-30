// shell-compile.mjs — walk the shell's inline <script> blocks and compile each one.
//
// Lifted out of scripts/build.mjs so it can be unit-tested (test/shell-compile.test.mjs). It was
// flagged in the source/artifact split's own risk list as new block-discovery logic with no gate
// but `--check`: the skip rules below decide whether 200 KB of application JavaScript reaches the
// artifact minified, unminified, or not at all, and every one of them deserves a test that fails
// when it changes.
//
// Behaviour is unchanged from the inline version; the only difference is that failures raise
// `ShellCompileError` instead of calling `process.exit`, so the build can phrase the message and a
// test can assert it.

import { Script } from 'node:vm';
import { minify as jsmin, JsminError } from './jsmin.mjs';

export class ShellCompileError extends Error {
  constructor(message) { super(message); this.name = 'ShellCompileError'; }
}

const INJECT_MARK = '/* @inject:';

/**
 * @param {string} html the shell source
 * @param {object} [opts]
 * @param {string} [opts.label] what to call the file in error messages
 * @param {boolean} [opts.noMinify] copy bodies verbatim (still parse-gated)
 * @param {(src:string)=>string} [opts.minify] override the minifier (tests use this)
 * @returns {{html:string, blocks:number, before:number, after:number, skipped:string[]}}
 */
export function compileShellScripts(html, opts = {}) {
  const label = opts.label || 'shell';
  const minify = opts.minify || jsmin;
  const die = (m) => { throw new ShellCompileError(m); };

  const re = /<script\b([^>]*)>/gi;
  let out = '', at = 0, blocks = 0, before = 0, after = 0, m;
  const skipped = [];
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const bodyStart = m.index + m[0].length;
    const relEnd = html.slice(bodyStart).search(/<\/script\s*>/i);
    if (relEnd < 0) die(`${label}: a <script> tag is never closed`);
    const bodyEnd = bodyStart + relEnd;
    const body = html.slice(bodyStart, bodyEnd);
    re.lastIndex = bodyEnd;

    /* The three generated regions: spliced in already minified, and passing them through here
       would eat the /* @inject: markers the splice needs. */
    if (body.includes(INJECT_MARK)) { skipped.push('inject'); continue; }
    if (/\bsrc\s*=/i.test(attrs)) {
      die(`${label}: <script src=…> would break the single-file, offline promise`);
    }
    /* Anything that is not a classic or module script is data, not code: leave it alone. */
    const type = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const kind = type ? (type[1] ?? type[2] ?? type[3]).trim().toLowerCase() : '';
    if (kind && !/^(module|text\/javascript|application\/javascript)$/.test(kind)) {
      skipped.push(kind); continue;
    }

    const where = `${label}: inline <script> #${blocks + 1}`;
    const parse = (code, when) => {
      try { new Script(code); }
      catch (e) { die(`${where} does not parse ${when} — ${e.message}`); }
    };
    parse(body, 'as authored');
    let code = body;
    if (!opts.noMinify) {
      try { code = minify(body); }
      catch (e) {
        if (e instanceof JsminError) die(`${where}: ${e.message} — refusing to ship it`);
        throw e;
      }
      parse(code, 'after minification');
    }
    out += html.slice(at, bodyStart) + code;
    at = bodyEnd;
    blocks++; before += body.length; after += code.length;
  }
  out += html.slice(at);
  /* If a refactor ever moves the app out of an inline <script>, this build must not go on quietly
     shipping an unminified page and reporting a size that means something else. */
  if (!blocks) die(`${label}: found no app-shell <script> to compile`);
  return { html: out, blocks, before, after, skipped };
}
