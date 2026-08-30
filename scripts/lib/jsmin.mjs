// jsmin.mjs — strip comments and dead whitespace from a JavaScript source.
//
// scripts/build.mjs runs every piece of JavaScript in the shipped page through this: the two
// module sources it inlines (scripts/lib/policy.mjs and scripts/lib/taxonomy.mjs) and the app
// shell's own inline <script> blocks. What it produces is an artifact — index.html — and every
// input to it stays on disk, commented: the modules in scripts/lib/, the shell in src/shell.html.
// The reader who wants the readable version reads the source, which is the point of the split.
//
// A character-level lexer, not a regex sweep: `//` inside a string, a `/*` inside a template, and
// a regex literal containing a quote all break the naive version. It tracks code, string, template
// (with a brace stack, so a template interpolating another template nests correctly), comment and
// regex-literal states, and it never rewrites anything inside a literal.
//
//   REMOVES  comments, indentation, blank lines, and inter-token spaces that cannot be load-bearing.
//   KEEPS    every newline that separated two tokens — so automatic semicolon insertion behaves
//            exactly as it did in the source — and every byte of every literal. Identifiers are NOT
//            renamed and no expression is rewritten: the output is the same program, and the only
//            thing that changed is what a human would have read.
//
// Regex-vs-division is decided from the last significant token: after an identifier, a number, a
// literal, or ) ] } a slash divides; after anything else, or after one of the keywords in
// REGEX_OK_AFTER, it opens a regex. A candidate regex that reaches a newline before its closing
// slash is re-read as division.
//
// Zero dependencies, by policy: this runs in the build of a single-file open-source page.

/* Malformed input — an unterminated comment, string or template — throws rather than guessing. */
export class JsminError extends Error {}
const fail = (msg) => { throw new JsminError(msg); };

const WORD = /[A-Za-z0-9_$\\]/;
const IDENT = /[A-Za-z0-9_$]/;
// After these, a `/` opens a regex rather than dividing.
const REGEX_OK_AFTER = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete',
  'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

/* Would deleting the whitespace between these two characters change the token stream? */
function needsSpace(p, c) {
  if (!p || !c) return false;
  if (WORD.test(p) && WORD.test(c)) return true;   // ident/keyword/number boundary
  if (p === '+' && c === '+') return true;         // a + +b  ->  a++b
  if (p === '-' && c === '-') return true;
  if (p === '/' && (c === '/' || c === '*')) return true;   // would open a comment
  if (p === '*' && c === '/') return true;                  // would close one
  if (p === '<' && c === '!') return true;                  // <!-- is a line comment on the web
  if (p === '.' && /[0-9]/.test(c)) return true;
  if (/[0-9]/.test(p) && c === '.') return true;
  return false;
}

export function stripJs(src) {
  const n = src.length;
  const literals = [];
  let out = '';
  let pend = '';        // pending whitespace: '' | ' ' | '\n'
  let last = '';        // last significant character emitted
  let tok = '';         // last significant token: an identifier, one punctuator, or a @kind marker
  let inTpl = false;    // reading the literal part of a template
  const tplBraces = []; // per open `${`, the depth of plain braces inside it

  const space = (ws) => { if (ws.includes('\n')) pend = '\n'; else if (pend !== '\n') pend = ' '; };
  const emit = (text, kind) => {
    if (pend === '\n') { if (out) out += '\n'; }
    else if (pend === ' ' && out && needsSpace(last, text[0])) out += ' ';
    pend = '';
    out += text;
    last = text[text.length - 1];
    if (kind !== undefined) tok = kind;
  };
  const regexAllowed = () => {
    if (tok === '') return true;
    if (REGEX_OK_AFTER.has(tok)) return true;
    if (tok[0] === '@') return false;                 // after a literal, `/` divides
    if (/^[A-Za-z_$]/.test(tok)) return false;        // identifier or a non-listed keyword
    if (/^[0-9]/.test(tok)) return false;             // number
    return !(tok === ')' || tok === ']' || tok === '}');
  };

  let i = 0;
  if (src.startsWith('#!')) { while (i < n && src[i] !== '\n') i++; }

  while (i < n) {
    /* ---- inside a template literal: copy verbatim to the ` or the ${ ---- */
    if (inTpl) {
      let j = i, buf = '';
      while (j < n) {
        const ch = src[j];
        if (ch === '\\') { buf += src.slice(j, j + 2); j += 2; continue; }
        if (ch === '`') { buf += ch; j++; inTpl = false; break; }
        if (ch === '$' && src[j + 1] === '{') { buf += '${'; j += 2; tplBraces.push(0); inTpl = false; break; }
        buf += ch; j++;
      }
      if (buf) { literals.push(buf); out += buf; last = buf[buf.length - 1]; tok = '@tpl'; pend = ''; }
      i = j;
      continue;
    }

    const c = src[i];

    /* ---- whitespace ---- */
    if (/[\s﻿]/.test(c)) {
      let j = i; while (j < n && /[\s﻿]/.test(src[j])) j++;
      space(src.slice(i, j)); i = j; continue;
    }

    /* ---- comments: gone, but they still separate the tokens they sat between ---- */
    if (c === '/' && src[i + 1] === '/') {
      let j = i + 2; while (j < n && src[j] !== '\n') j++;
      space(' '); i = j; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      if (close < 0) fail('unterminated block comment');
      space(src.slice(i, close + 2)); i = close + 2; continue;
    }

    /* ---- strings ---- */
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        const ch = src[j];
        if (ch === '\\') { j += 2; continue; }
        if (ch === c) { j++; break; }
        if (ch === '\n') fail('unterminated string literal');
        j++;
      }
      const lit = src.slice(i, j); literals.push(lit); emit(lit, '@str'); i = j; continue;
    }

    /* ---- templates ---- */
    if (c === '`') { emit('`', '@tpl'); inTpl = true; i++; continue; }

    /* ---- regex literal (vs. division) ---- */
    if (c === '/' && regexAllowed()) {
      let j = i + 1, cls = false, closed = false;
      while (j < n) {
        const ch = src[j];
        if (ch === '\\') { j += 2; continue; }
        if (ch === '\n') break;                       // regexes do not span lines: this was division
        if (cls) { if (ch === ']') cls = false; j++; continue; }
        if (ch === '[') { cls = true; j++; continue; }
        if (ch === '/') { j++; closed = true; break; }
        j++;
      }
      if (closed) {
        while (j < n && /[a-z]/i.test(src[j])) j++;   // flags
        const lit = src.slice(i, j); literals.push(lit); emit(lit, '@re'); i = j; continue;
      }
      /* not a regex after all — fall through and treat `/` as a punctuator */
    }

    /* ---- identifier / keyword / number head ---- */
    if (IDENT.test(c)) {
      let j = i; while (j < n && IDENT.test(src[j])) j++;
      const t = src.slice(i, j); emit(t, t); i = j; continue;
    }

    /* ---- braces, which the template stack cares about ---- */
    if (c === '{' && tplBraces.length) tplBraces[tplBraces.length - 1]++;
    if (c === '}' && tplBraces.length && tplBraces[tplBraces.length - 1] === 0) {
      tplBraces.pop(); emit('}', '}'); inTpl = true; i++; continue;
    }
    if (c === '}' && tplBraces.length) tplBraces[tplBraces.length - 1]--;

    emit(c, c); i++;
  }

  if (inTpl || tplBraces.length) fail('unterminated template literal');
  return { code: out, literals };
}

/* Strip, then re-lex the output and compare the two literal lists. Any state-machine slip — a
   mistaken comment boundary, a swallowed quote — changes which literals the second pass finds, so
   this is a cheap standing proof that no literal was harmed. Callers wanting the raw lexer, or the
   literal list itself, use stripJs directly. */
export function minify(src) {
  const first = stripJs(src);
  const second = stripJs(first.code);
  if (second.literals.join(' ') !== first.literals.join(' ')) {
    fail('comment stripping changed a string or regex literal');
  }
  return first.code;
}
