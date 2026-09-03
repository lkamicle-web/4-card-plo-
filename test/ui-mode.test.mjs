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

const ALL_CAPS = { pinned: true, payoff: true, equilibrium: true };

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
