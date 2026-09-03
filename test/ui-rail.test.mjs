/**
 * test/ui-rail.test.mjs — V3-PLAN §8 item 12's rail, tested as the text that ships.
 *
 * The rules that decide what a collapsed rail REMEMBERS and what a shut section still SAYS live in
 * a marked block inside `src/shell.html`. This file slices that block out of the shell and
 * evaluates it — the trick `test/sim-ui.test.mjs` plays on SIMUI, for the same reason: a copy of
 * the rules in a test file is a second implementation that can drift away from the one users get.
 *
 * §8 names three harness checks for this item. All three are here, and two of them are asserted as
 * PROPERTIES OF THE CODE rather than as observations of one browser session, which is stronger:
 *
 *   collapse survives reload            the state round-trips through JSON and `normState`, and
 *                                       the boot path reads the same key `toggleSec` writes.
 *   feature-hidden x collapsed compose   the two flags live on different elements and neither
 *                                       reads the other — asserted against the shipped CSS and
 *                                       against the collapse code's own text.
 *   value slots update while collapsed   `summaries` takes no collapse input at all, so there is
 *                                       no branch in which a shut section is filled in differently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = readFileSync(join(ROOT, 'src', 'shell.html'), 'utf8');

const START = '/* @rail-logic';
const END = '/* @end:rail-logic */';
const a = SHELL.indexOf(START);
const b = SHELL.indexOf(END);
assert.ok(a > 0 && b > a, 'src/shell.html must carry the @rail-logic markers');
const SRC = SHELL.slice(a, b);

/** The shipped block, evaluated standalone. */
const RAIL = new Function(`${SRC}\nreturn RAIL;`)();

// ---------------------------------------------------------------- self-containment

test('the block is self-contained — it can only be sliced out if it reaches for nothing', () => {
  // Comments are prose and may name anything; the CODE may not.
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const re of [/\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /(?<![A-Za-z0-9_])S\./,
    /(?<![A-Za-z0-9_.])\$\(/, /(?<![A-Za-z0-9_.])store\(/, /(?<![A-Za-z0-9_.])el\(/, /(?<![A-Za-z0-9_.])render\(/]) {
    assert.ok(!re.test(code), `@rail-logic must not reference ${re}: it is evaluated with no page`);
  }
});

test('the nine sections are the rail’s nine sections, and each names its value slot', () => {
  assert.deepEqual(RAIL.ids(), ['vpipsec', 'ribbonsec', 'labsec', 'tablesec', 'vpsec',
    'thesissec', 'pinsec', 'nodesec', 'displaysec']);
  for (const s of RAIL.SECTIONS) {
    assert.equal(typeof s.value, 'string');
    assert.ok(s.value.length, `${s.id} needs a value slot id`);
  }
  // §8 seeds four of them from named tags and asks for four invented summaries. Both halves pinned.
  const seeded = RAIL.SECTIONS.filter((s) => !s.invented).map((s) => s.value);
  for (const id of ['vpiptag', 'tabletag', 'vptag', 'ribbonwho']) {
    assert.ok(seeded.includes(id), `${id} is one of §8's four seeds and must still be a value slot`);
  }
  assert.deepEqual(RAIL.SECTIONS.filter((s) => s.invented).map((s) => s.id),
    ['thesissec', 'pinsec', 'nodesec', 'displaysec'], '§8 invents exactly four summaries');
});

// ---------------------------------------------------------------- the hostile store

test('normState accepts nothing it did not write', () => {
  assert.deepEqual(RAIL.normState({ vpipsec: true }), { vpipsec: true });
  // an id no build of this page ever had
  assert.deepEqual(RAIL.normState({ vpipsec: true, sneaky: true }), { vpipsec: true });
  // truthy is not true: a shared file:// localStorage is hostile input, not a hint
  assert.deepEqual(RAIL.normState({ vpipsec: 'true' }), {});
  assert.deepEqual(RAIL.normState({ vpipsec: 1 }), {});
  assert.deepEqual(RAIL.normState({ vpipsec: {} }), {});
  // shapes that are not a state at all read as "nothing collapsed" rather than throwing
  for (const junk of [null, undefined, 0, '', 'x', [], [1, 2], true]) {
    assert.deepEqual(RAIL.normState(junk), {}, `${JSON.stringify(junk)} must normalise to {}`);
  }
});

test('normState never hands back a reference into its input', () => {
  const raw = { vpipsec: true };
  const out = RAIL.normState(raw);
  out.tablesec = true;
  assert.deepEqual(raw, { vpipsec: true }, 'the caller must not be able to mutate parsed JSON');
});

test('prototype keys are unknown keys, not inherited answers', () => {
  const hostile = JSON.parse('{"__proto__": {"vpipsec": true}}');
  assert.deepEqual(RAIL.normState(hostile), {});
  assert.equal(RAIL.isCollapsed({}, 'constructor'), false);
  assert.equal(RAIL.isCollapsed({}, '__proto__'), false);
});

// ---------------------------------------------------------------- collapse semantics

test('collapsed is opt-in, and toggling does not mutate', () => {
  const s0 = {};
  assert.equal(RAIL.isCollapsed(s0, 'vpipsec'), false, 'absent means open');
  const s1 = RAIL.toggled(s0, 'vpipsec');
  assert.deepEqual(s0, {}, 'toggled must not mutate its argument');
  assert.equal(RAIL.isCollapsed(s1, 'vpipsec'), true);
  const s2 = RAIL.toggled(s1, 'vpipsec');
  assert.equal(RAIL.isCollapsed(s2, 'vpipsec'), false);
  assert.deepEqual(s2, {}, 'open is the absence of the key, not a false');
});

test('an unknown id cannot be collapsed', () => {
  assert.deepEqual(RAIL.toggled({}, 'nosuchsec'), {});
  assert.equal(RAIL.isCollapsed({ nosuchsec: true }, 'nosuchsec'), false);
});

test('collapse survives a reload — the state round-trips through JSON unchanged', () => {
  let state = {};
  for (const id of ['vpipsec', 'displaysec', 'nodesec']) state = RAIL.toggled(state, id);
  // exactly what store() does on the way out and on the way back in
  const reloaded = RAIL.normState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(reloaded, state);
  assert.equal(RAIL.collapsedCount(reloaded), 3);
  for (const id of RAIL.ids()) {
    assert.equal(RAIL.isCollapsed(reloaded, id), RAIL.isCollapsed(state, id), id);
  }
});

// ---------------------------------------------------------------- the value slots

test('summaries takes no collapse input, so a shut section cannot be summarised differently', () => {
  const from = SRC.indexOf('function summaries');
  const code = SRC.slice(from, SRC.indexOf('\nreturn {', from));
  for (const name of ['collapsed', 'isCollapsed', 'KEY', 'toggled']) {
    assert.ok(!code.includes(name),
      `summaries must not consult ${name} — "value slots update while collapsed" is the point`);
  }
});

test('the four invented summaries say what the open section shows', () => {
  const snap = {
    thesis: { lo: 0.166, hi: 0.412 },
    pin: { v: 55, moved: 12 },
    node: { key: 'limps', L: 3, raiser: '', mix: [60, 25, 10, 5] },
    display: { density: 'comfort', cols: 'equal', cbPatterns: false, monoSuits: false, reduce: false, rain: 8 }
  };
  const out = RAIL.summaries(snap);
  assert.equal(out.thesistag, '16.6 → 41.2%');
  assert.equal(out.pintag, '55% · 12 MOVED');
  assert.equal(out.nodetag, '3 LIMPERS');
  assert.equal(out.displaytag, 'COMFORT · EQUAL');
  // the other two node shapes
  assert.equal(RAIL.summaries({ node: { key: 'raise', raiser: 'CO' } }).nodetag, 'vs CO');
  assert.equal(RAIL.summaries({ node: { key: '3bet', mix: [60, 25, 10, 5] } }).nodetag, '60/25/10/5');
  assert.equal(RAIL.summaries({ node: { key: 'rfi' } }).nodetag, '—');
});

test('a summary with nothing behind it still says something true', () => {
  const out = RAIL.summaries({});
  assert.equal(out.pintag, 'NO PIN');
  assert.equal(out.displaytag, 'COMFORT · EQUAL');
  assert.ok(out.thesistag.length, 'the thesis slot falls back to its static caption');
  // and it never throws on a half-built snapshot
  for (const junk of [null, undefined, 0, 'x', [], { pin: {} }, { node: null }, { display: 7 }]) {
    assert.equal(typeof RAIL.summaries(junk).displaytag, 'string');
  }
});

test('non-default display toggles are counted, so "I left something on" is visible shut', () => {
  const base = { density: 'compact', cols: 'freq' };
  assert.equal(RAIL.summaries({ display: base }).displaytag, 'COMPACT · TRUE FREQ');
  assert.equal(RAIL.summaries({ display: { ...base, cbPatterns: true } }).displaytag, 'COMPACT · TRUE FREQ +1');
  assert.equal(RAIL.summaries({ display: { ...base, cbPatterns: true, monoSuits: true, reduce: true, rain: 0 } })
    .displaytag, 'COMPACT · TRUE FREQ +4');
});

// ---------------------------------------------------------------- the page around the block

test('persistence goes through store(), and NEVER through the hash', () => {
  assert.match(SHELL, /RAILST = RAIL\.normState\(store\(RAIL\.KEY\)\)/,
    'boot must seed the collapse state from the same probe-guarded helper everything else uses');
  assert.match(SHELL, /store\(RAIL\.KEY, RAILST\)/, 'every flip must write through store()');
  const hash = SHELL.slice(SHELL.indexOf('function buildHash()'), SHELL.indexOf('function readHash()'));
  for (const name of ['RAIL', 'rail', 'collapse']) {
    assert.ok(!hash.includes(name), `the hash is the share channel and must not carry ${name}`);
  }
});

test('feature-hidden and collapsed compose — different elements, neither reading the other', () => {
  // the CSS hides the BODY WRAPPER, never the section: `hidden` on the section is untouched by it
  assert.match(SHELL, /\.rsec\[data-collapsed=true\] > \.rsec-b\{display:none\}/);
  assert.ok(!/\.rsec\[data-collapsed=true\]\{display:none\}/.test(SHELL),
    'collapse must not hide the section itself, or a feature-hidden section could not also be collapsed');
  // and the collapse code never touches .hidden
  const applier = SHELL.slice(SHELL.indexOf('function applySec('), SHELL.indexOf('function buildRail('));
  assert.ok(!/\.hidden\b/.test(applier), 'applySec/toggleSec must never write `hidden`');
  // the three sections the page hides by feature are still in the collapsible set
  for (const id of ['labsec', 'vpsec', 'nodesec']) {
    assert.ok(RAIL.ids().includes(id), `${id} is hidden by feature and must still be collapsible`);
  }
});

test('every section ships a toggle button and a body wrapper, and no button nests in a button', () => {
  for (const id of RAIL.ids()) {
    if (id === 'nodesec') {
      // rebuilt from scratch on every node change, so its header is emitted by renderNodeCtl
      assert.match(SHELL, /b\.id = 'nodesec-b'/);
      assert.match(SHELL, /wireSecToggle\(s, 'nodesec'\); applySec\('nodesec'\)/);
      continue;
    }
    assert.ok(SHELL.includes(`id="${id}-b"`), `${id} needs its .rsec-b body wrapper`);
    assert.ok(SHELL.includes(`aria-controls="${id}-b"`), `${id}'s toggle must point at its body`);
  }
  // the "?" is a sibling of the toggle, never a descendant of it
  assert.match(SHELL, /var sp = \$\(sectionSel \+ ' \.rsec-h'\);/);
  assert.ok(!/<button class="rsec-t"[^>]*>[^<]*<button/.test(SHELL));
  // and it keeps its stopPropagation
  const lq = SHELL.slice(SHELL.indexOf('function labelQ('), SHELL.indexOf('function wireHelpButtons('));
  assert.match(lq, /e\.stopPropagation\(\)/);
});

// --------------------------------------------------------------- the P1-U re-measurements
//
// §8 item 12 ends with "the pinned/scroll split re-measured", and §1's S-E annotation hands this
// lane two more measurements it could not take itself: the 1280–1442 topbar band and the morph
// budget. All three are measurements OF A LAYOUT, so they cannot be asserted from Node — what CAN
// be asserted from Node is that the consequence each one forced is still in the file, and that the
// number it was drawn from is written next to it. A measurement whose result is deleted in the
// next refactor was not a measurement, it was an afternoon.

test('the split has a floor: below 700 px of viewport the rail stops being two boxes', () => {
  // MEASURED (headless Chromium, 1440 wide, everything open): the pinned block is 278 px and
  // `flex:0 0 auto`, so at 620 px tall the scroll region is 156 px against 1461 px of content and
  // at 560 px tall it is 96. The rule drops the split rather than shipping a slit.
  assert.match(SHELL, /@media \(max-height:699px\) and \(min-width:1024px\)\{/,
    '§8 asks for the split to be RE-MEASURED, and the measurement has a consequence in the sheet');
  const rule = SHELL.slice(SHELL.indexOf('@media (max-height:699px)'),
    SHELL.indexOf('@media (max-width:1023px)'));
  assert.match(rule, /\.rail\{overflow-y:auto/, 'the rail itself becomes the scroller');
  assert.match(rule, /\.rail-scroll\{flex:0 0 auto;overflow:visible/, 'the inner box stops scrolling');
  assert.match(rule, /\.rail-foot\{position:sticky;bottom:0/,
    'the provenance line keeps the promise its own markup makes about never being sliced');
  // and the collapse state is not part of the rule: a layout branch may not decide what is shut
  assert.ok(!/data-collapsed/.test(rule), 'a viewport must never change what the user collapsed');
});

test('the split measurement is written down where the next reader will need it', () => {
  const split = SHELL.slice(SHELL.indexOf('THE PINNED/SCROLL SPLIT, RE-MEASURED'),
    SHELL.indexOf('@media (max-height:699px)'));
  for (const n of ['278', '1461', '636', '780']) {
    assert.ok(split.includes(n), `the split note must carry the measured ${n}`);
  }
  assert.match(split, /headless Chromium/, 'and say what measured it');
});

test('the topbar can no longer clip its own controls at any width', () => {
  // S-E measured the intrinsic row at 1443 px against a 1279 px breakpoint: 1280–1442 lost the
  // Drill/Guide/Settings/Info buttons off the right edge. Re-measured after the fix, headless
  // Chromium: two rows and nothing clipped at <=1393, one 56 px row 1394–1559, one 57 px row above.
  assert.match(SHELL, /\.topbar\{display:flex;flex-wrap:wrap;[^}]*min-height:56px/,
    'the row must be able to wrap, and must not be pinned to a fixed height');
  assert.ok(!/\.topbar\{[^}]*[^-]height:56px/.test(SHELL),
    'a fixed height is what turned an overflow into an invisible control');
  assert.match(SHELL, /@media \(max-width:1559px\)\{\n  \.topbar\{padding/,
    'the trims must start above the measured 1546 px untrimmed minimum, so 1440 stays one row');
  const band = SHELL.slice(SHELL.indexOf('THE TOPBAR BAND, RE-MEASURED'), SHELL.indexOf('@media (max-width:1559px)'));
  for (const n of ['1443', '1546', '1394']) {
    assert.ok(band.includes(n), `the band note must carry the measured ${n}`);
  }
});

test('the morph budget is measurable, and the budget ships as data rather than as folklore', () => {
  // S-E: the JS-only figure was 0.100 ms p95 — one tick of the clock — so the 8 ms budget could
  // not distinguish this page from one 80x slower. The flush goes inside the timed region and the
  // budget comes down to 4.0. Re-measured here over 240 passes: JS-only p95 2.2 ms, inclusive 2.4.
  const fn = SHELL.slice(SHELL.indexOf('window.__measureMorph = function'),
    SHELL.indexOf('window.__rundown = {'));
  assert.match(fn, /render\(\);/, 'the repaint is still what is being timed');
  assert.match(fn, /void document\.body\.offsetHeight;/,
    'and the style + layout it forces must be inside the timed region, or the number is a lie');
  assert.ok(fn.indexOf('void document.body.offsetHeight;') < fn.indexOf('return performance.now()'),
    'the flush has to happen BEFORE the clock is read');
  assert.match(SHELL, /window\.__morphBudgetMs = 4\.0;/,
    'the budget ships on the page so the harness cannot hold it to a number it made up');
});

test('THE CROSS-LANE PIN: the page and the harness carry the same morph budget', () => {
  // P1 INTEGRATION (B1). Lane U shipped `window.__morphBudgetMs` on the page so the harness would
  // read the promise; lane I, in a different worktree, arrived at the same 4.0 ms independently and
  // typed it into smoke.mjs as MORPH_LAYOUT_BUDGET_MS. Two lanes, two measurements, one number —
  // and nothing yet stopping them drifting apart, because smoke.mjs is not one of the three GREEN
  // checks and needs Playwright to say anything at all.
  //
  // This is the pin, and it is deliberately a SOURCE comparison rather than a wiring change. Making
  // the harness read the budget off the artifact under test would let the artifact raise its own
  // ceiling — the thing being measured choosing its own yardstick, which is the failure `smoke.mjs`
  // already guards against in the cache validator. Two independent copies that must agree is the
  // stronger arrangement, and this test is what makes "must agree" true.
  const smoke = readFileSync(join(ROOT, 'smoke.mjs'), 'utf8');
  const page = /window\.__morphBudgetMs = ([\d.]+);/.exec(SHELL);
  const harness = /const MORPH_LAYOUT_BUDGET_MS = ([\d.]+);/.exec(smoke);
  assert.ok(page, 'the page no longer publishes its morph budget');
  assert.ok(harness, 'smoke.mjs no longer declares a layout-inclusive morph budget');
  assert.equal(Number(harness[1]), Number(page[1]),
    `smoke.mjs budgets ${harness[1]} ms and the page promises ${page[1]} ms — one of the two moved alone`);
});

test('the retained 8 ms floor check is pinned, and no longer claims to time JS only', () => {
  // P1 RED TEAM (docs/refutations/P1.md). Two refuters moved MORPH_BUDGET_MS from 8 to 800 and
  // watched all 52 gates and the whole suite stay green: unlike the layout budget it has no
  // page-side twin, so the cross-lane pin above does not reach it and nothing greps the literal.
  // Keeping a floor check that reports its own slack is the right call — a check that says "I
  // cannot distinguish this page from one N times slower" is information — but it has to be a
  // check somebody notices moving. This is that pin.
  const smoke = readFileSync(join(ROOT, 'smoke.mjs'), 'utf8');
  assert.match(smoke, /const MORPH_BUDGET_MS = 8;/,
    'the floor check moved without a reviewer seeing it; it is anchored to nothing, so the digits are all there is');
  // AND ITS LABEL. The same refuters found the stated rationale falsified: `__measureMorph` now
  // forces style + layout inside the timed region (asserted three tests up), so both smoke budgets
  // sample layout-inclusive work and the old "JS-only ... at Chromium's performance.now() floor"
  // account described a function that no longer exists. A floor check whose stated reason for
  // being a floor has been falsified is worse than no second budget, so the words are gated too.
  const detail = smoke.slice(smoke.indexOf('check(morph.p95 < MORPH_BUDGET_MS'),
    smoke.indexOf('const morphL ='));
  assert.ok(!/JS pass|JS only|JS-only/.test(detail),
    'the retained check still calls itself a JS-only measurement, which __measureMorph falsified');
  assert.ok(!/performance\.now\(\) floor/.test(detail),
    'the readings are not at the clock floor any more — that figure was measured against the retired function');
  assert.match(detail, /FLOOR CHECK/,
    'and it must keep saying what it is, or it reads as a live tripwire');
});
