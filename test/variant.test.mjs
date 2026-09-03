// variant.test.mjs — the dual-build seam's rules, held to by a test.
//
// scripts/lib/variant.mjs decides which markup, CSS and JavaScript reaches which shipped artifact.
// Every rule in it can silently drop or silently keep a block, and both failure modes ship a page
// nobody diffed. So each rule gets a test that fails when it changes — the same reason
// shell-compile.mjs was lifted out of build.mjs and given test/shell-compile.test.mjs.
//
// The load-bearing one is INERTNESS (first test below): a source with no markers must compile
// identically under every variant. That is the v3 identity constraint (V3-PLAN §0.4a) applied to
// the build, and it is what lets `--variant=lite` over today's shell reproduce today's index.html.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VARIANTS, VARIANT_NAMES, stripOnlyBlocks, regionManifest, regionOwners, danglingSymbols,
  VariantError,
} from '../scripts/lib/variant.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (src, v) => stripOnlyBlocks(src, v).text;
const throwsWith = (fn, re) => assert.throws(fn, (e) => e instanceof VariantError && re.test(e.message),
  `expected a VariantError matching ${re}`);

// ---------------------------------------------------------------------------
test('INERTNESS — a source with no markers is identical under every variant', () => {
  const src = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  assert.ok(!/@only:/.test(src), 'precondition: the shipped shell carries no @only markers yet');
  const outs = VARIANT_NAMES.map((v) => strip(src, v));
  for (const o of outs) assert.equal(o, src, 'an unmarked source must survive stripping untouched');
  const census = stripOnlyBlocks(src, 'lite');
  assert.deepEqual([census.kept, census.dropped, census.blocks.length], [0, 0, 0]);
});

test('INERTNESS holds for the degenerate inputs too', () => {
  for (const v of VARIANT_NAMES) {
    assert.equal(strip('', v), '');
    assert.equal(strip('no markers here\n', v), 'no markers here\n');
  }
});

// ---------------------------------------------------------------------------
test('a block survives in its own variant and nowhere else, in both comment syntaxes', () => {
  const html = 'a\n<!-- @only:full -->\nFULL\n<!-- @end:only -->\nb\n';
  assert.equal(strip(html, 'full'), 'a\nFULL\nb\n');
  assert.equal(strip(html, 'lite'), 'a\nb\n');

  const js = 'a\n/* @only:lite */\nLITE\n/* @end:only */\nb\n';
  assert.equal(strip(js, 'lite'), 'a\nLITE\nb\n');
  assert.equal(strip(js, 'full'), 'a\nb\n');
});

test('the markers themselves never reach the artifact, in either direction', () => {
  const html = 'x<!-- @only:full -->y<!-- @end:only -->z';
  for (const v of VARIANT_NAMES) assert.ok(!/@only:|@end:only/.test(strip(html, v)));
});

test('sibling blocks let two variants disagree about the same sentence', () => {
  // The D11 case: not one variant omitting a line, but each carrying its own.
  const html = '<p>\n<!-- @only:lite -->\nLITE CLAIM\n<!-- @end:only -->\n'
    + '<!-- @only:full -->\nFULL CLAIM\n<!-- @end:only -->\n</p>\n';
  assert.equal(strip(html, 'lite'), '<p>\nLITE CLAIM\n</p>\n');
  assert.equal(strip(html, 'full'), '<p>\nFULL CLAIM\n</p>\n');
});

test('a marker alone on its line takes the whole line, including its indentation', () => {
  const html = 'a\n    <!-- @only:full -->\n    keep\n    <!-- @end:only -->\nb\n';
  assert.equal(strip(html, 'full'), 'a\n    keep\nb\n', 'no ghost blank lines where a marker was');
  assert.equal(strip(html, 'lite'), 'a\nb\n');
});

test('a marker used inline does not eat the line it sits on', () => {
  const html = '<div><!-- @only:full -->F<!-- @end:only --></div>\n';
  assert.equal(strip(html, 'full'), '<div>F</div>\n');
  assert.equal(strip(html, 'lite'), '<div></div>\n');
});

test('several blocks in one file are each resolved independently', () => {
  const html = '1\n/* @only:full */A/* @end:only */\n2\n/* @only:lite */B/* @end:only */\n3\n'
    + '/* @only:full */C/* @end:only */\n4\n';
  assert.equal(strip(html, 'full'), '1\nA\n2\n\n3\nC\n4\n');
  assert.equal(strip(html, 'lite'), '1\n\n2\nB\n3\n\n4\n');
  const c = stripOnlyBlocks(html, 'full');
  assert.deepEqual([c.kept, c.dropped], [2, 1]);
  assert.deepEqual(c.blocks.map((b) => b.variant), ['full', 'lite', 'full']);
});

test('the census reports the bytes each side of the split costs', () => {
  const c = stripOnlyBlocks('x<!-- @only:full -->12345<!-- @end:only --><!-- @only:lite -->12<!-- @end:only -->', 'lite');
  assert.equal(c.keptBytes, 2);
  assert.equal(c.droppedBytes, 5);
});

// --- the loud failures ------------------------------------------------------
test('a mistyped variant name is fatal, with a line number', () => {
  throwsWith(() => strip('a\nb\n<!-- @only:light -->x<!-- @end:only -->', 'lite'),
    /@only:light at line 3 names no variant/);
});

test('an unclosed block is fatal, and names the line it was opened on', () => {
  throwsWith(() => strip('a\n<!-- @only:full -->\nx\n', 'lite'),
    /@only:full opened at line 2 is never closed/);
});

test('a stray close is fatal', () => {
  throwsWith(() => strip('a\n<!-- @end:only -->\n', 'lite'), /@end:only at line 2 closes nothing/);
});

test('nesting is refused, and the message says to write siblings', () => {
  throwsWith(() => strip('<!-- @only:full -->\n<!-- @only:lite -->x<!-- @end:only -->\n<!-- @end:only -->', 'lite'),
    /do not nest \(write two siblings\)/);
});

test('a marker-SHAPED token that is not a marker is fatal — the silent-no-op case', () => {
  // The dangerous typo: it looks right, it does nothing, and the block ships to both artifacts.
  throwsWith(() => strip('a\n// @only:full\nx\n// @end:only\n', 'lite'), /@only-shaped tokens but only 0 well-formed/);
  throwsWith(() => strip('a\n<!-- @only: full -->x<!-- @end:only -->', 'lite'), /@only-shaped tokens but only 1/);
});

test('an unknown variant is refused rather than defaulted', () => {
  throwsWith(() => strip('x', 'medium'), /unknown variant "medium"/);
});

// --- the region manifest, gate D10's build-time half ------------------------
test('the manifest requires every region the variant owns', () => {
  const src = '/* @inject:data */\n/* @inject:policy */\n/* @inject:taxonomy */\n';
  throwsWith(() => regionManifest(src, 'lite'), /needs @inject:engine/);
});

test('the manifest refuses a region the variant does not own, and names its owner', () => {
  const lite = VARIANTS.lite.regions.map((r) => `/* @inject:${r} */`).join('\n');
  assert.deepEqual(regionManifest(lite, 'lite'), VARIANTS.lite.regions);
  throwsWith(() => regionManifest(`${lite}\n/* @inject:eq */`, 'lite'),
    /must not contain @inject:eq — eq \(full\)/);
});

test('the full manifest accepts the eq region and lite does not own it', () => {
  const full = VARIANTS.full.regions.map((r) => `/* @inject:${r} */`).join('\n');
  assert.deepEqual(regionManifest(full, 'full'), VARIANTS.full.regions);
  assert.deepEqual(regionOwners('eq'), ['full']);
  assert.deepEqual(regionOwners('data'), ['lite', 'full']);
  assert.deepEqual(regionOwners('nonsense'), []);
});

// --- the variant table itself ----------------------------------------------
test('lite is the default artifact and keeps index.html', () => {
  assert.equal(VARIANTS.lite.out, 'index.html');
  assert.notEqual(VARIANTS.full.out, VARIANTS.lite.out);
});

test('lite is a subset of full, region for region — full = lite + its own payload (§5.2)', () => {
  for (const r of VARIANTS.lite.regions) assert.ok(VARIANTS.full.regions.includes(r), r);
  assert.deepEqual(VARIANTS.full.regions.filter((r) => !VARIANTS.lite.regions.includes(r)), ['eq']);
});

test('lite carries the METHODOLOGY §9.11 budgets and full asserts nothing yet', () => {
  assert.deepEqual(VARIANTS.lite.budgets, { total: 600 * 1024, app: 360 * 1024, modelCode: 50 * 1024 });
  // The house rule: an unanchored constant is not invented. When D9 lands, this flips — and this
  // test is where the flip has to be made deliberately rather than noticed later.
  assert.equal(VARIANTS.full.budgets, null);
  assert.match(VARIANTS.full.budgetSource, /UNANCHORED/);
});

test('each variant has its own claim sentence — no two artifacts make the same claim', () => {
  const claims = VARIANT_NAMES.map((v) => VARIANTS[v].claim);
  assert.equal(new Set(claims).size, claims.length);
  for (const c of claims) assert.ok(c.length > 20);
});

// ---------------------------------------------------------------------------
// danglingSymbols — S-D §F's measured gap, and the tests that say it is closed.
//
// The spike recorded this as the boundary of what a text seam can prove: lite-visible code calling
// a function declared inside an `@only:full` block parses, minifies, passes every build gate, and
// throws in the browser. These tests are the record that the boundary moved — and, just as
// importantly, that it did not move so far that ordinary code trips over it.
// ---------------------------------------------------------------------------

const dang = (src, v) => danglingSymbols(stripOnlyBlocks(src, v), src);

test('a lite call to a full-only function is a finding, with both line numbers', () => {
  const src = [
    '<script>',
    '/* @only:full */',
    'function evEstimate(c) { return c * 2; }',
    '/* @end:only */',
    'function render() { return evEstimate(3); }',
    '</script>',
  ].join('\n');
  assert.deepEqual(dang(src, 'full'), []);
  const found = dang(src, 'lite');
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'evEstimate');
  assert.equal(found[0].fromVariant, 'full');
  assert.equal(found[0].fromLine, 2);
  // 5, not 3: BOTH numbers are source lines. The call sits on line 3 of the *stripped* text, and
  // reporting that beside a source-line declaration would put two coordinate systems in one error.
  assert.equal(found[0].line, 5);
});

test('const- and class-declared full-only symbols count too', () => {
  for (const decl of ['const solve = (x) => x;', 'class Solver { }']) {
    const name = decl.startsWith('const') ? 'solve' : 'Solver';
    const src = `/* @only:full */\n${decl}\n/* @end:only */\nconst go = () => ${name}(1);`;
    assert.equal(dang(src, 'lite').length, 1, decl);
  }
});

test('THE FALSE-POSITIVE GUARD: a name the kept text also declares is not a finding', () => {
  // The realistic case — a full-only block with its own `render`, and lite having one too.
  const src = [
    '/* @only:full */',
    'function render() { return 1; }',
    '/* @end:only */',
    'function render() { return 2; }',
    'render();',
  ].join('\n');
  assert.deepEqual(dang(src, 'lite'), []);
});

test('a bare reference is NOT a finding — the check is scoped to call sites', () => {
  // Deliberate: markup prose containing the word would otherwise fire. Dangling DATA is covered
  // from the artifact side by gate D10's negative manifest instead.
  const src = '/* @only:full */\nconst EQUILIBRIUM = {};\n/* @end:only */\n<p>EQUILIBRIUM</p>';
  assert.deepEqual(dang(src, 'lite'), []);
});

test('a source with no @only blocks produces no findings and does no work', () => {
  assert.deepEqual(dang('function a(){} a(); b();', 'lite'), []);
});

test('every dangling name is reported once, however many times it is called', () => {
  const src = '/* @only:full */\nfunction f(){}\n/* @end:only */\nf(); f(); f();';
  assert.equal(dang(src, 'lite').length, 1);
});
