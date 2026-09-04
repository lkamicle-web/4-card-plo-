/**
 * test/ui-mode.test.mjs — V3-PLAN §8 item 13's colour modes, and item 15's disablement idiom.
 *
 * The rules live in a marked block inside `src/shell.html`; this file slices them out and evaluates
 * them, the SIMUI idiom. What is asserted here, in §8's own words:
 *
 *   "the colour-mode switch lives on the legend row"      structurally, against the shipped shell:
 *                                                         built by `buildLegend`, absent from the
 *                                                         top bar and from the rail's Display panel.
 *   "every mode must re-provide the colorblind redundancy  every ramp mode's bucket is total,
 *    channel, aria labels, and tooltip content"            single-valued and clamped, and every
 *                                                         bucket has a hatch and a readout.
 *   "plus I13 (combos partition) asserted in every mode"   the mode cannot change what is counted:
 *                                                         the combo accounting and the ghosting
 *                                                         rule are mode-independent by inspection,
 *                                                         and every live cell lands in exactly one
 *                                                         bucket of the active ramp.
 *   "full-only modes render disabled-with-named-REASON"    every unavailable mode carries a reason
 *                                                         that names the missing thing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = readFileSync(join(ROOT, 'src', 'shell.html'), 'utf8');
const MODEL = JSON.parse(readFileSync(join(ROOT, 'data', 'model.json'), 'utf8'));

const START = '/* @mode-logic';
const END = '/* @end:mode-logic */';
const a = SHELL.indexOf(START);
const b = SHELL.indexOf(END);
assert.ok(a > 0 && b > a, 'src/shell.html must carry the @mode-logic markers');
const SRC = SHELL.slice(a, b);
const MODES = new Function(`${SRC}\nreturn MODES;`)();

/* P3: vs-GTO asks two questions — does this BUILD have a baseline (`equilibrium`, the shared-core
   block) and does it cover this SEAT (`baseCovered`, three of twenty-four (pos, node) pairs, because
   the baseline is heads-up). A snapshot that says yes to both is the "everything available" one. */
const ALL_CAPS = { pinned: true, payoff: true, equilibrium: true, baseCovered: true, baseWhy: '' };

// ---------------------------------------------------------------- self-containment and shape

test('the block is self-contained', () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const re of [/\bdocument\b/, /\bwindow\b/, /(?<![A-Za-z0-9_])S\./, /(?<![A-Za-z0-9_.])\$\(/,
    /(?<![A-Za-z0-9_.])render\(/, /\bMODEL\b/]) {
    assert.ok(!re.test(code), `@mode-logic must not reference ${re}`);
  }
});

test('the mode list is the six §8 names, and the tier mode is the one with no capability', () => {
  assert.deepEqual(MODES.keys(), ['action', 'nu', 'rho', 'pin', 'ev', 'gto']);
  assert.equal(MODES.DEFAULT, 'action');
  assert.equal(MODES.byKey('action').kind, 'class', 'TIER keeps the tier classes');
  assert.equal(MODES.byKey('ev').kind, 'ramp', 'EV gets a sequential ramp');
  assert.equal(MODES.byKey('gto').kind, 'diverging', 'vs-GTO is the page’s first signed ramp — P3’s');
  // the default must be servable by any build at all, or the fallback has nowhere to fall
  assert.equal(MODES.availability('action', {}).available, true);
  for (const m of MODES.LIST) {
    assert.ok(m.label && m.label.length <= 7, `${m.key}'s legend label must fit the row`);
    assert.ok(m.name && m.name.length > 10, `${m.key} needs a real accessible name, not a glyph`);
  }
});

// ---------------------------------------------------------------- the disablement idiom

test('every unavailable mode names the thing that is missing', () => {
  const cases = [
    ['pin', { ...ALL_CAPS, pinned: false }, /pin/i],
    ['ev', { ...ALL_CAPS, payoff: false }, /payoff/i],
    ['gto', { ...ALL_CAPS, equilibrium: false }, /equilibrium/i]
  ];
  for (const [key, caps, re] of cases) {
    const av = MODES.availability(key, caps);
    assert.equal(av.available, false, `${key} must be unavailable without its source`);
    assert.match(av.reason, re, `${key}'s reason must name what is missing`);
    assert.ok(av.reason.length > 20, `${key}'s reason must be a sentence, not a word`);
    // and available again the moment the capability is there
    assert.equal(MODES.availability(key, ALL_CAPS).available, true);
    assert.equal(MODES.availability(key, ALL_CAPS).reason, '');
  }
});

test('an under-specified capability snapshot disables rather than enables', () => {
  for (const caps of [undefined, null, {}, { pinned: false }]) {
    for (const key of ['pin', 'ev', 'gto']) {
      assert.equal(MODES.availability(key, caps).available, false, `${key} with ${JSON.stringify(caps)}`);
    }
  }
});

test('an unknown mode is not a mode', () => {
  const av = MODES.availability('rainbow', ALL_CAPS);
  assert.equal(av.available, false);
  assert.match(av.reason, /no such colour mode/);
  assert.equal(MODES.resolve('rainbow', ALL_CAPS), 'action');
});

test('a mode whose source goes away falls back rather than painting from nothing', () => {
  assert.equal(MODES.resolve('pin', ALL_CAPS), 'pin');
  assert.equal(MODES.resolve('pin', { ...ALL_CAPS, pinned: false }), 'action');
  assert.equal(MODES.resolve('ev', { ...ALL_CAPS, payoff: false }), 'action');
  assert.equal(MODES.resolve('gto', ALL_CAPS), 'gto');
  assert.equal(MODES.resolve('gto', {}), 'action');
});

// ---------------------------------------------------------------- the ramp bucket

test('the bucket is total, single-valued and clamped on every ramp', () => {
  for (const m of MODES.LIST.filter((x) => x.kind === 'ramp')) {
    const n = m.steps;
    const seen = new Set();
    for (let i = 0; i <= 2000; i++) {
      const v = -1 + (i / 2000) * 3;               // well outside [0,1] at both ends
      const k = MODES.bucket(v, 0, 1, n);
      assert.ok(Number.isInteger(k) && k >= 0 && k < n, `${m.key}: bucket(${v}) = ${k}`);
      seen.add(k);
    }
    assert.equal(seen.size, n, `${m.key}: every one of its ${n} steps must be reachable`);
    assert.equal(MODES.bucket(0, 0, 1, n), 0, 'the low endpoint is the first step');
    assert.equal(MODES.bucket(1, 0, 1, n), n - 1, 'the high endpoint is the last step, not an overflow');
  }
});

test('a value the ramp cannot place lands in a real bucket rather than off the end', () => {
  for (const junk of [NaN, Infinity, -Infinity, undefined, null, 'x', {}]) {
    assert.equal(MODES.bucket(junk, 0, 1, 7), 0, `${String(junk)} must not produce a NaN class`);
  }
  assert.equal(MODES.bucket(0.5, 1, 1, 7), 0, 'a degenerate domain is one bucket, not a divide by zero');
  assert.equal(MODES.bucket(0.5, 1, 0, 7), 0, 'an inverted domain is refused, not honoured');
});

// ---------------------------------------------------------------- I13 in every mode

test('I13: the mode cannot change what is counted', () => {
  // The partition claim is about the combos on screen, and the two places that decide them are the
  // ghosting rule and the by-tier accounting. Neither may consult the colour mode: if they did,
  // switching modes could change the totals, which is exactly what I13 forbids.
  const ghost = SHELL.slice(SHELL.indexOf('function isGhosted('), SHELL.indexOf('var RAMP_NU'));
  for (const name of ['colorBy', 'mode', 'MODES', 'paintOf']) {
    assert.ok(!ghost.includes(name), `isGhosted must not read ${name}`);
  }
  const chrome = SHELL.slice(SHELL.indexOf('function paintChrome('), SHELL.indexOf('/* composition ribbon */'));
  assert.ok(!/colorBy|activeMode|paintOf/.test(chrome.replace(/syncModeSw\(\); syncRampLegend\(ev\);/, '')),
    'the legend counts must be computed from the evaluation, never from the paint');
});

test('I13: every live cell lands in exactly one bucket of every ramp, and the combos still sum', () => {
  const cells = MODEL.cells;
  const live = Object.keys(cells).filter((k) => cells[k] && cells[k].combos > 0);
  assert.ok(live.length > 100, 'sanity: the model must have a live cell space to partition');
  const total = live.reduce((n, k) => n + cells[k].combos, 0);
  assert.equal(total, MODEL.meta.comboTotal, 'the shipped cells partition the deal space');

  // ν is the one ramp whose input is a plain shipped field, so it can be checked end to end here.
  // The claim generalises because `bucket` is the only thing that assigns a class in any ramp mode.
  const nu = MODES.byKey('nu');
  const byBucket = new Map();
  for (const k of live) {
    const b = MODES.bucket(cells[k].nu, 0, 1, nu.steps);
    assert.ok(Number.isInteger(b) && b >= 0 && b < nu.steps, `${k}: ν ${cells[k].nu} -> ${b}`);
    byBucket.set(b, (byBucket.get(b) || 0) + cells[k].combos);
  }
  const summed = [...byBucket.values()].reduce((x, y) => x + y, 0);
  assert.equal(summed, total, 'the ν ramp partitions the same combos the tier partition does');
});

// ---------------------------------------------------------------- the EV request shape

test('the EV request is the multiway door above one opponent, and the hero-only fallback at one', () => {
  assert.deepEqual(MODES.requestFor('X', 1), ['X'], 'one opponent: hero alone, the documented fallback');
  assert.deepEqual(MODES.requestFor('X', 2), ['X', 'X', 'X'], 'two opponents: hero plus two slots');
  assert.deepEqual(MODES.requestFor('X', 4).length, 5);
  for (const junk of [0, -3, NaN, undefined, null, 'x']) {
    assert.deepEqual(MODES.requestFor('X', junk), ['X'], `${String(junk)} must not build a bad request`);
  }
  assert.equal(MODES.requestFor('X', 3.7).length, 4, 'a fractional count is floored, never fractional');
});

// ---------------------------------------------------------------- where the switch lives

test('the switch is on the legend row — not the top bar, not the rail', () => {
  const legend = SHELL.slice(SHELL.indexOf('function buildLegend()'), SHELL.indexOf('function syncModeSw()'));
  // both live in `.encline`, and `.encline` is a child of `#legend` — the measured two-line band
  // (see the .legend rule): the FILTER keeps the row it had, the ENCODING gets its own.
  assert.match(legend, /var enc = el\('div', 'encline'\);/, 'the encoding line is built here');
  assert.match(legend, /buildModeSw\(enc\)/, 'the mode switch is built into the legend’s encoding line');
  assert.match(legend, /buildRampLegend\(enc\)/, 'and so is the ramp legend §8 asks for');
  assert.match(legend, /lg\.appendChild\(enc\)/, 'and the encoding line hangs off the legend row');
  assert.match(SHELL, /\.encline\{order:9;flex:1 0 100%/,
    'the break must be structural, not a function of the viewport');

  const topbar = SHELL.slice(SHELL.indexOf('function buildTopbar()'), SHELL.indexOf('function syncTopbar()'));
  for (const name of ['modesw', 'colorBy', 'MODES']) {
    assert.ok(!topbar.includes(name), `the top bar must not carry ${name} (§8 item 15)`);
  }
  assert.match(topbar, /\[\['matrix', 'Matrix'\], \['field', 'Field'\], \['table', 'Table'\], \['method', 'Method'\]\]/,
    'the view switch is unchanged');

  // comments may say where the control went; the CODE may not still build it
  const display = SHELL.slice(SHELL.indexOf('function renderDisplayCtl()'), SHELL.indexOf('function syncDisplayCtl()'))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/Color by/.test(display), '"Color by" must be gone from the rail: the matrix owns its encoding');
  assert.ok(!display.includes('colorBy'), 'and the Display panel must not set the colour mode');
});

test('the disablement renders, dimmed and reasoned, rather than disappearing', () => {
  const sync = SHELL.slice(SHELL.indexOf('function syncModeSw()'), SHELL.indexOf('function syncLegend()'));
  assert.match(sync, /aria-disabled/, 'aria-disabled, so the button stays focusable and readable');
  assert.ok(!/\.hidden = /.test(sync) && !/\.disabled = /.test(sync),
    'an unavailable mode must never be hidden or made unfocusable — the reason is the deliverable');
  assert.match(sync, /av\.reason/, 'the reason must reach the title and the accessible name');
  assert.match(SHELL, /\.modesw button\[aria-disabled=true\]\{color:var\(--text-disabled\);cursor:default\}/);
});

test('every ramp mode has a hatch for every one of its buckets', () => {
  for (const m of MODES.LIST.filter((x) => x.kind === 'ramp')) {
    for (let k = 1; k < m.steps; k++) {
      assert.ok(SHELL.includes(`.k${k}::after{background:`),
        `${m.key} uses bucket k${k} and every bucket needs a non-colour channel`);
      assert.ok(SHELL.includes(`.hatch .cell.k${k}::after`),
        `k${k} must be wired into the colorblind toggle`);
      assert.ok(SHELL.includes(`.tiny .cell.k${k}::after`),
        `k${k} must be wired into the automatic small-row channel`);
    }
  }
});

// ================================================================ vs-GTO (P3, V3-PLAN §8 item 13)
//
// The mode's page-side half is not in @mode-logic — it cannot be: it reads the shipped baseline
// block, the model's raw tiers and the injected payload, and @mode-logic is pinned self-contained.
// So these read the SHELL SOURCE and the SHIPPED BLOCK, which is where the claims actually live.

const BT = MODEL.baselineTiers;
/* the mode's source, and the source with every one of its marked regions removed: the second is
   what `scripts/build.mjs` compiles to produce the `core` reading the raised app ceiling is paid
   against, so "the mode is entirely inside its markers" is a checkable claim rather than a habit */
const CUT = (() => {
  let out = '', at = 0, n = 0;
  for (;;) {
    const i = SHELL.indexOf('/* @block:gto', at) < 0 ? -1 : SHELL.indexOf('/* @block:gto', at);
    if (i < 0) break;
    const j = SHELL.indexOf('/* @end:block */', i);
    assert.ok(j > i, 'every @block:gto must be closed by @end:block');
    out += SHELL.slice(at, i);
    at = j + '/* @end:block */'.length;
    n++;
  }
  return { text: out + SHELL.slice(at), blocks: n };
})();

test('the shipped baseline is heads-up: 3 of 24 (pos, node) pairs, the rest carrying one reason', () => {
  assert.ok(BT && BT.nodes && BT.order, 'P3 ships the shared-core baseline block');
  const cov = BT.coverage;
  assert.equal(cov.length, 24, 'six positions x four nodes, none omitted from the map');
  const on = cov.filter((c) => c.covered);
  assert.equal(on.length, 3, 'SB rfi, BB vs-raise, SB vs-3-bet — and nothing else (adjudication 8)');
  assert.deepEqual(on.map((c) => `${c.pos}|${c.node}`).sort(), ['BB|raise', 'SB|3bet', 'SB|rfi']);
  for (const c of cov.filter((x) => !x.covered)) {
    assert.equal(c.reason, BT.notCovered, `${c.pos}|${c.node} must carry the block's own reason`);
  }
  assert.deepEqual(Object.keys(BT.nodes).sort(), ['BB|raise', 'SB|3bet', 'SB|rfi']);
  assert.equal(BT.nodes['BB|raise'].raiser, 'SB', 'the only opener in a heads-up tree is the button');
});

test('the disablement reason and the label are READ off the block, never typed in the page', () => {
  // I35 clause (f) and adjudication 8: the words on screen are the payload's.
  // Checked against the CODE, comments removed — the same slice the self-containment test takes at
  // the top of this file. A comment may quote the payload's phrasing (this one does, to explain why
  // the order of the legend line matters); it is stripped by the build and can never reach a
  // surface. What must not exist is a STRING LITERAL, because that is a copy that can drift.
  const CODE = SHELL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!CODE.includes(BT.notCovered), 'the "baseline is HU" reason must not be a page literal');
  assert.ok(!CODE.includes(BT.label), 'the checkdown label must not be a page literal either');
  const blk = SHELL.slice(SHELL.indexOf('var BASE = (function ()'), SHELL.indexOf('var RAMP_GTO'));
  assert.match(blk, /bt\.notCovered/, 'the reason comes off the block');
  assert.match(blk, /label: bt\.label/, 'and so does the label');
  // and both reach a surface
  assert.match(SHELL, /BASE\.label/, 'the label renders where the baseline paints');
  assert.match(SHELL, /c\.baseWhy = a\.why/, 'the reason reaches the capability snapshot');
  // the cap list is rendered from the shipped arrays (I35 clause (e)), not from prose
  assert.match(SHELL, /bb2\.caps && bb2\.caps\.modelled/, 'the Method view renders the shipped cap list');
  assert.match(SHELL, /bb2\.caps && bb2\.caps\.omitted/);
  for (const cap of BT.caps.omitted) assert.ok(!CODE.includes(cap), `"${cap.slice(0, 24)}…" must not be typed in the page`);
});

test('vs-GTO fails in two different ways, and each names the thing that is missing', () => {
  const noBuild = MODES.availability('gto', { ...ALL_CAPS, equilibrium: false });
  assert.equal(noBuild.available, false);
  assert.match(noBuild.reason, /baselineTiers/, 'the build failure names the block that is absent');
  const noSeat = MODES.availability('gto', { ...ALL_CAPS, baseCovered: false, baseWhy: 'baseline is HU — x' });
  assert.equal(noSeat.available, false);
  assert.equal(noSeat.reason, 'baseline is HU — x', 'the seat failure is the shipped reason verbatim');
  // and a snapshot that forgot to say still disables
  assert.equal(MODES.availability('gto', { ...ALL_CAPS, baseCovered: false }).available, false);
  assert.equal(MODES.resolve('gto', { ...ALL_CAPS, baseCovered: false }), 'action');
});

test('the diverging ramp: five signed buckets, mirror-paired hatches, agreement bare', () => {
  const m = MODES.byKey('gto');
  assert.equal(m.kind, 'diverging');
  assert.equal(m.steps, 5, 'one bucket per whole action step on a three-level scale, plus agreement');
  const map = /var GTO_K = \[([\d, ]+)\]/.exec(SHELL);
  assert.ok(map, 'the bucket -> class map must be readable from the source');
  const K = map[1].split(',').map((x) => +x.trim());
  assert.equal(K.length, m.steps);
  assert.equal(K[2], 0, 'agreement is the BARE class — "no pattern" is this page\'s way of saying nothing to see');
  assert.equal(new Set(K).size, K.length, 'no two buckets may share a hatch');
  // the mirror pairs: one step either side, then two steps either side
  assert.deepEqual([K[1], K[3]].sort(), [1, 2], '45° vs -45° at one step');
  assert.deepEqual([K[0], K[4]].sort(), [3, 4], '90° vs 0° at two steps');
  for (const k of K) {
    if (k === 0) continue;
    assert.ok(SHELL.includes(`.k${k}::after{background:`), `bucket class k${k} needs its hatch`);
    assert.ok(SHELL.includes(`.hatch .cell.k${k}::after`), `k${k} must be in the colorblind toggle`);
    assert.ok(SHELL.includes(`.tiny .cell.k${k}::after`), `k${k} must be in the small-row channel`);
  }
  const ramp = /var RAMP_GTO = \[([^\]]+)\]/.exec(SHELL);
  assert.ok(ramp && ramp[1].split(',').length === m.steps, 'one colour per bucket');
  assert.match(SHELL, /sc\.classes \? sc\.classes\[i\] : i/, 'the legend swatch carries the CELL\'s class, not the index');
});

test('I13 in vs-GTO: every live cell lands in exactly one bucket, and the combos still sum', () => {
  // The mode's arithmetic, run here over the SHIPPED baseline: the aggression scale is fold 0,
  // call 1, raise 2, the baseline's value is its own weights against its own tierOf, and the paint
  // is bucket(model - baseline, -2.5, 2.5, 5). If any of that could produce a value outside the
  // five buckets, a cell would paint with no class and drop out of the partition.
  const agg = (t) => (5 - (t === 'T4' ? 3 : +t.slice(1))) / 2;
  const live = Object.keys(MODEL.cells).filter((k) => MODEL.cells[k].combos > 0);
  assert.deepEqual([...BT.order].sort(), [...live].sort(),
    'the block covers exactly the live cell space — no cell can be painted without a reading');
  const total = live.reduce((n, k) => n + MODEL.cells[k].combos, 0);
  assert.equal(total, MODEL.meta.comboTotal);
  for (const nodeKey of Object.keys(BT.nodes)) {
    const nd = BT.nodes[nodeKey], N = nd.actions.length;
    const byBucket = new Map();
    for (let i = 0; i < BT.order.length; i++) {
      let b = 0, sum = 0;
      for (let a = 0; a < N; a++) {
        const w = nd.w[i * N + a] * BT.quant;
        sum += w;
        b += w * agg(nd.tierOf[nd.actions[a]]);
      }
      assert.ok(Math.abs(sum - 1) < 1e-9, `${nodeKey} ${BT.order[i]}: the row must be a distribution`);
      assert.ok(b >= 0 && b <= 2, `${nodeKey} ${BT.order[i]}: aggression ${b} is off the three-level scale`);
      // every raw model tier the page can hold, against this row
      for (const t of ['T1', 'T2', 'T3', 'T5']) {
        const k = MODES.bucket(agg(t) - b, -2.5, 2.5, 5);
        assert.ok(Number.isInteger(k) && k >= 0 && k < 5, `${nodeKey} ${BT.order[i]} ${t}: bucket ${k}`);
      }
      const k0 = MODES.bucket(agg('T1') - b, -2.5, 2.5, 5);
      byBucket.set(k0, (byBucket.get(k0) || 0) + MODEL.cells[BT.order[i]].combos);
    }
    const summed = [...byBucket.values()].reduce((x, y) => x + y, 0);
    assert.equal(summed, total, `${nodeKey}: the vs-GTO ramp partitions the same combos the tiers do`);
  }
});

test('the comparand is the RAW model tier, and the page says so where it differs', () => {
  const blk = SHELL.slice(SHELL.indexOf('function gtoOf('), SHELL.indexOf('/** The paint: five buckets'));
  assert.match(blk, /e\.preDisplay/, 'the model side reads preDisplay — the action before the post-passes');
  assert.ok(!/ev\.tier\[/.test(blk), 'and never the painted tier, which is what §14 item 4 forbids');
  assert.match(blk, /e\.promoted/, 'the pass that moved this cell is carried, so the inspector can say so');
  assert.match(SHELL, /the grid shows this cell after the/, 'and it does say so');
  assert.match(SHELL, /RAW tier/, 'the verdict line names the comparand');
});

test('T2 is read as the band it splits, which is the node\'s own label question', () => {
  const blk = SHELL.slice(SHELL.indexOf('  function agg(t, node)'), SHELL.indexOf('  return { block: bt'));
  assert.match(blk, /NODEBY\[node\]\.t2 === NODEBY\[node\]\.t1/,
    'T2 folds into T1 exactly where the node labels them the same action, which is RFI and vs-Raise');
  // the shipped block agrees that T2 has no counterpart
  assert.ok(/T2 never appears/.test(BT.encoding), 'the baseline itself records that it has no T2');
  for (const n of Object.keys(BT.nodes)) {
    assert.deepEqual(Object.values(BT.nodes[n].tierOf).sort(), [...new Set(Object.values(BT.nodes[n].tierOf))].sort());
    assert.ok(!Object.values(BT.nodes[n].tierOf).includes('T2'));
  }
});

test('the full-only depth renders disabled with a named reason in lite', () => {
  const blk = SHELL.slice(SHELL.indexOf('function buildGtoDepth('), SHELL.indexOf('function syncGtoDepth('));
  assert.match(blk, /aria-disabled/, 'the missing solve renders dimmed, not hidden');
  assert.ok(!/b\.hidden/.test(blk), 'the chip itself is never hidden — the reason is the deliverable');
  assert.match(blk, /data\/equilibrium\.json/, 'the reason names the artifact that carries it');
  assert.match(blk, /aria-label/, 'and it reaches the accessible name');
  const dep = SHELL.slice(SHELL.indexOf('  function depths()'), SHELL.indexOf('  /** One cell\'s action weights'));
  assert.match(dep, /window\.EQUILIBRIUM/, 'full reads its depths off the injected payload');
  assert.match(dep, /exact: true/, 'and marks them as the exact strategies they are');
  assert.match(dep, /bt\.stack/, 'lite reads its one depth off the shared-core block');
});

test('the mode is entirely inside its markers — the raise pays for exactly this', () => {
  assert.ok(CUT.blocks >= 10, `expected the mode to be marked in several places, found ${CUT.blocks}`);
  for (const sym of ['BASE', 'RAMP_GTO', 'GTO_K', 'gtoOf', 'gtoPaint', 'gtoReadout', 'gtoScale',
    'gtoWhy', 'gtoBaseText', 'gtoGap', 'gtoDepth', 'buildGtoDepth', 'syncGtoDepth', 'gtoD']) {
    assert.ok(!new RegExp(`(^|[^\\w$.])${sym}\\b`).test(CUT.text),
      `${sym} survives the @block:gto cut — a byte of the mode outside its markers is a raise the gate cannot see`);
  }
  // and what is left still parses as the page it was before the mode
  assert.ok(CUT.text.includes('function paintOf('), 'the cut removes the mode, not the mode\'s host');
});
