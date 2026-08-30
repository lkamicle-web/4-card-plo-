// shell-compile.test.mjs — the <script> block discovery the build depends on.
//
// Flagged as an open risk when the source/artifact split landed: "no unit test covers
// compileShellScripts … its regression signals today are the die on zero blocks found, the size
// line in the build output, and --check". Each of the rules below decides whether the app's
// JavaScript reaches index.html minified, unminified, or not at all, and two of them are the only
// thing standing between a refactor and a silently broken single-file page.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileShellScripts, ShellCompileError } from '../scripts/lib/shell-compile.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const page = (body) => `<!doctype html>\n<html><head></head><body>\n${body}\n</body></html>\n`;

test('an ordinary inline script is minified in place', () => {
  const html = page(`<script>\n/* a comment that costs bytes */\nvar x = 1;   // and this\nconsole.log(x);\n</script>`);
  const r = compileShellScripts(html, { label: 'shell' });
  assert.equal(r.blocks, 1);
  assert.ok(r.after < r.before, `${r.before} -> ${r.after}`);
  assert.ok(!r.html.includes('a comment that costs bytes'));
  assert.ok(r.html.includes('console.log(x)'));
  assert.ok(r.html.startsWith('<!doctype html>'), 'everything outside <script> is untouched');
});

test('--no-minify copies the body verbatim, and still parse-gates it', () => {
  const body = `/* kept */\nvar x = 1;\n`;
  const r = compileShellScripts(page(`<script>${body}</script>`), { noMinify: true });
  assert.equal(r.blocks, 1);
  assert.equal(r.before, r.after);
  assert.ok(r.html.includes('/* kept */'));
  assert.throws(
    () => compileShellScripts(page('<script>var = ;</script>'), { noMinify: true }),
    /does not parse as authored/,
  );
});

test('a block carrying an @inject marker is skipped, PER BLOCK', () => {
  /* The generated regions are spliced in already minified, and running them through here would eat
     the markers the splice needs. The important half of this test is that skipping one block does
     not skip the next: the shell has three injected blocks sitting between real ones. */
  const html = page([
    '<script>\n/* @inject:data */\n/* @end:data */\n</script>',
    '<script>\nvar realOne = 1; /* strip me */\n</script>',
    '<script>\n/* @inject:policy */\n/* @end:policy */\n</script>',
    '<script>\nvar realTwo = 2; /* strip me too */\n</script>',
  ].join('\n'));
  const r = compileShellScripts(html);
  assert.equal(r.blocks, 2, 'both real blocks compiled');
  assert.deepEqual(r.skipped, ['inject', 'inject']);
  assert.ok(r.html.includes('/* @inject:data */'), 'the data marker survives for the splice');
  assert.ok(r.html.includes('/* @inject:policy */'), 'the policy marker survives too');
  assert.ok(!r.html.includes('strip me'), 'the real blocks really were minified');
  assert.ok(r.html.includes('realTwo'));
});

test('<script src=…> is fatal — it would break the offline single-file promise', () => {
  for (const tag of ['<script src="app.js">', "<script src='app.js'>", '<script  SRC=app.js >',
    '<script type="module" src="app.js">']) {
    assert.throws(
      () => compileShellScripts(page(`<script>var a=1;</script>\n${tag}</script>`)),
      (e) => e instanceof ShellCompileError && /single-file, offline promise/.test(e.message),
      tag,
    );
  }
});

test('zero app-shell scripts is fatal, not a quiet 0 KB build', () => {
  /* The failure this guards against: a refactor moves the app out of an inline <script>, the build
     goes on reporting a size that means something else, and ships an uncompiled page. */
  assert.throws(() => compileShellScripts(page('<p>no scripts here</p>')),
    /found no app-shell <script> to compile/);
  assert.throws(() => compileShellScripts(page('<script>\n/* @inject:data */\n</script>')),
    /found no app-shell <script> to compile/, 'injected regions do not count as app shell');
});

test('a non-JavaScript type= is data and is left exactly alone', () => {
  const html = page([
    '<script type="application/json">\n{ "a": 1, /* not js */ }\n</script>',
    '<script type="text/x-template">\n<div>{{ x }}</div>\n</script>',
    '<script>var real = 1;</script>',
  ].join('\n'));
  const r = compileShellScripts(html);
  assert.equal(r.blocks, 1);
  assert.deepEqual(r.skipped, ['application/json', 'text/x-template']);
  assert.ok(r.html.includes('/* not js */'), 'the JSON block is copied byte for byte');
  assert.ok(r.html.includes('<div>{{ x }}</div>'));
});

test('the recognised code types are all compiled', () => {
  for (const t of ['module', 'text/javascript', 'application/javascript', 'TEXT/JavaScript']) {
    const r = compileShellScripts(page(`<script type="${t}">var a = 1; /* c */</script>`));
    assert.equal(r.blocks, 1, t);
    assert.ok(!r.html.includes('/* c */'), t);
  }
});

test('an unclosed <script> is fatal', () => {
  assert.throws(() => compileShellScripts(page('<script>var a = 1;')),
    /a <script> tag is never closed/);
});

test('a syntax error is blamed on the shell, and a minifier slip on the minifier', () => {
  assert.throws(() => compileShellScripts(page('<script>function (){}</script>')),
    /inline <script> #1 does not parse as authored/);
  /* a "minifier" that corrupts its output must be caught by the post-parse, not shipped */
  assert.throws(
    () => compileShellScripts(page('<script>var a = 1;</script>'), { minify: () => 'var = ;' }),
    /does not parse after minification/,
  );
});

test('the real shell compiles, and its numbers are the ones the build reports', () => {
  const shell = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  const r = compileShellScripts(shell, { label: 'src/shell.html' });
  assert.equal(r.blocks, 3, 'bridge + simulate engine + application');
  assert.deepEqual(r.skipped, ['inject', 'inject', 'inject', 'inject'],
    'data, taxonomy, policy and engine are all spliced, not compiled');
  assert.ok(r.after < r.before * 0.85, `${r.before} -> ${r.after} is a real saving`);
  for (const m of ['@inject:data', '@end:data', '@inject:taxonomy', '@end:taxonomy',
    '@inject:policy', '@end:policy', '@inject:engine', '@end:engine']) {
    assert.ok(r.html.includes(m), `${m} survives compilation for the splice`);
  }
});
