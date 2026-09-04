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
  VARIANTS, VARIANT_NAMES, stripOnlyBlocks, stripMarkedBlocks, regionManifest, regionOwners,
  danglingSymbols, VariantError,
} from '../scripts/lib/variant.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (src, v) => stripOnlyBlocks(src, v).text;
const throwsWith = (fn, re) => assert.throws(fn, (e) => e instanceof VariantError && re.test(e.message),
  `expected a VariantError matching ${re}`);

// ---------------------------------------------------------------------------
test('INERTNESS — a source with no markers is identical under every variant', () => {
  /* THE SHELL NOW CARRIES MARKERS, so the inertness claim is made where it can still be made: over
     the shell with its two `@only:full` blocks REMOVED. Until P3 this test read the shipped shell
     directly and asserted it had none — a fine precondition while the seam was unused, and a
     precondition that had to expire the moment the seam was used for the thing it was built for
     (V3-PLAN §5.3's `@inject:eq` region). What inertness actually claims is a property of the
     STRIPPER — a source with no markers survives it untouched under every variant — and that is
     what is asserted here, over the largest real source available. The shell's own two blocks are
     covered by the census test below, which pins how many there are and what they are for. */
  const shipped = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  const src = stripOnlyBlocks(shipped, 'lite').text;
  assert.ok(!/@only:/.test(src), 'the stripper left a marker behind in its own output');
  const outs = VARIANT_NAMES.map((v) => strip(src, v));
  for (const o of outs) assert.equal(o, src, 'an unmarked source must survive stripping untouched');
  const census = stripOnlyBlocks(src, 'lite');
  assert.deepEqual([census.kept, census.dropped, census.blocks.length], [0, 0, 0]);
});

test("the shell's own @only blocks are exactly the full-only equilibrium seam (§5.3)", () => {
  /* THE CENSUS, pinned. P3 is the first phase to use the `@only:` seam in the shipped shell, and
     §3.3's own instruction is that the equilibrium seam and one Method-view row are the ONLY edits
     that step makes to src/shell.html — p3-ui owns the rest. A count is how that stays true: a
     third block appearing here is either the UI step landing early or a block nobody diffed. */
  const shipped = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  const lite = stripOnlyBlocks(shipped, 'lite');
  const full = stripOnlyBlocks(shipped, 'full');
  assert.equal(lite.blocks.length, 2, 'the shell carries exactly two @only blocks');
  assert.deepEqual(lite.blocks.map((b) => b.variant), ['full', 'full']);
  assert.deepEqual([lite.kept, lite.dropped], [0, 2], 'lite keeps neither');
  assert.deepEqual([full.kept, full.dropped], [2, 0], 'full keeps both');
  /* ...and what they contain: the injected region, and the window bridge that makes it reachable
     from the page. Both are refused in lite by D10's negative manifest, from the other side. */
  assert.match(full.blocks[0].body, /@inject:eq/);
  assert.match(full.blocks[1].body, /window\.EQUILIBRIUM = EQUILIBRIUM/);
  assert.ok(!/@inject:eq/.test(lite.text), 'the lite source must not even see the region marker');
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

test('lite carries the METHODOLOGY §9.11 budgets, and full\'s are D9\'s — set from a measurement', () => {
  /* THE APP CEILING WAS RAISED AT P3, AND THE RAISE IS PINNED HERE BECAUSE IT MUST BE A DECISION.
     `app` 360 -> 388 KB pays for the vs-GTO colour mode: measured 377,993 B = 369.1 KB with the
     mode in, + 5%, rounded up to the whole KB, in the D6 idiom V3-PLAN §3.3's adjudication 12
     requires (stated, paid, visible to the gate). `appCore` is the other half of that requirement:
     the app payload MINUS the `@block:gto` region, still facing the 360 KB the app block faced
     before the raise, so the raise buys exactly one feature and no existing block gains a byte.
     Both numbers, and the relation between them, are pinned — a later phase that wants more app
     headroom has to come back to this line. */
  assert.deepEqual(VARIANTS.lite.budgets,
    { total: 600 * 1024, app: 388 * 1024, appCore: 360 * 1024, modelCode: 50 * 1024 });
  assert.ok(VARIANTS.lite.budgets.app > VARIANTS.lite.budgets.appCore,
    'the raise is a raise: app must exceed the pre-raise ceiling core is still held to');
  assert.match(VARIANTS.lite.budgetSource, /vs-GTO/, 'the raise names what it bought');
  assert.match(VARIANTS.lite.budgetSource, /5%/, 'and the rule it was set by');
  /* THE NULL PIN, FLIPPED — DELIBERATELY, WHICH IS WHY IT EXISTED.
     Until P3 this read `assert.equal(VARIANTS.full.budgets, null)` with the note "when D9 lands,
     this flips — and this test is where the flip has to be made deliberately rather than noticed
     later". D9 has landed (scripts/gates/baseline.mjs), on the first `data/equilibrium.json` that
     ever existed to measure, and this is that flip.
     What is pinned now is the shape of the decision rather than a number nobody can check here:
     `total` and `eq` are measured+5% and must EXCEED the artifacts they bound (a budget below its
     own measurement is not a budget), while `app` and `modelCode` must be LITE'S NUMBERS EXACTLY —
     V3-PLAN §3.3's adjudication 12 forbids the shared app block acquiring headroom as a side
     effect of a second variant existing, and equality is how that is said in a test. */
  const B = VARIANTS.full.budgets;
  assert.ok(B && typeof B === 'object', 'full\'s budgets are no longer null: D9 set them at P3');
  assert.equal(B.app, VARIANTS.lite.budgets.app, 'full must not get more app headroom than lite');
  assert.equal(B.appCore, VARIANTS.lite.budgets.appCore, 'nor a softer core ceiling');
  assert.equal(B.modelCode, VARIANTS.lite.budgets.modelCode);
  assert.ok(B.total > VARIANTS.lite.budgets.total, 'full carries a payload lite does not');
  assert.ok(B.eq > 0, 'the equilibrium payload has its own tripwire (§5.3)');
  assert.ok(!/UNANCHORED/.test(VARIANTS.full.budgetSource), 'the unanchored note must go with the null');
  assert.match(VARIANTS.full.budgetSource, /measured/i);
  assert.match(VARIANTS.full.budgetSource, /5%/);
  // the measurements the numbers were taken from must still be under them
  const bytes = (f) => readFileSync(resolve(ROOT, f)).length;
  assert.ok(bytes('index-full.html') <= B.total, 'the artifact is over the budget set from it');
  assert.ok(bytes('data/equilibrium.json') <= B.eq, 'the payload is over the budget set from it');
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

// --- @block: the measuring tape (P3, V3-PLAN §3.3 adjudication 12) ----------
//
// This seam ships nothing and strips nothing from an artifact. It exists so the build can compile
// the shell twice and REPORT what one named feature costs, which is what turns "the app budget was
// raised to pay for the vs-GTO mode" from a claim into two printed numbers.

test('a marked block is removed whole, in either comment syntax, and the rest is untouched', () => {
  const js = 'a\n/* @block:gto — prose after the name is allowed */\nB();\n/* @end:block */\nc\n';
  const r = stripMarkedBlocks(js, 'gto');
  assert.equal(r.blocks, 1);
  assert.equal(r.text, 'a\nc\n', 'a block alone on its lines takes its whole lines');
  assert.ok(r.bytes > 40 && r.bytes < Buffer.byteLength(js));
  const html = 'x<!-- @block:gto -->y<!-- @end:block -->z';
  assert.equal(stripMarkedBlocks(html, 'gto').text, 'xz');
});

test('a source with no marked block is returned unchanged, byte for byte', () => {
  const src = 'nothing marked here /* @only:full */ or here /* @end:only */\n';
  const r = stripMarkedBlocks(src, 'gto');
  assert.equal(r.text, src);
  assert.equal(r.blocks, 0);
  assert.equal(r.bytes, 0);
});

test('an unclosed or nested marked block is a build failure with a line number', () => {
  throwsWith(() => stripMarkedBlocks('a\nb\n/* @block:gto */\nc\n', 'gto'), /never closed by @end:block/);
  throwsWith(() => stripMarkedBlocks('a\n/* @block:gto */\n/* @block:gto */\nx\n/* @end:block */\n', 'gto'),
    /do not nest/);
});

test('the names are independent: cutting one block leaves another alone', () => {
  const src = '/* @block:gto */g/* @end:block */\n/* @block:other */o/* @end:block */\n';
  assert.equal(stripMarkedBlocks(src, 'gto').text, '/* @block:other */o/* @end:block */\n');
  assert.equal(stripMarkedBlocks(src, 'other').text, '/* @block:gto */g/* @end:block */\n');
});

test('the shell carries the vs-GTO block, and cutting it is cheaper than the app it pays for', () => {
  const shell = readFileSync(resolve(ROOT, 'src', 'shell.html'), 'utf8');
  const r = stripMarkedBlocks(shell, 'gto');
  assert.ok(r.blocks >= 10, `the mode is marked in ${r.blocks} places; a drop to one means it was inlined somewhere`);
  assert.ok(r.bytes > 5000, 'the marked source is the mode, not a marker census');
  assert.ok(!/@block:gto/.test(r.text) && !/@end:block/.test(r.text), 'the cut consumes its own markers');
  // both variants must cut identically: the mode is shared code, not a full-only surface
  for (const v of VARIANT_NAMES) {
    const only = stripOnlyBlocks(shell, v).text;
    assert.ok(stripMarkedBlocks(only, 'gto').blocks >= 10, `${v} carries the whole mode`);
  }
});
