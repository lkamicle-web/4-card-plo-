/**
 * test/ui-payoff-mirror.test.mjs — the page's copy of the frozen payoff accessor, pinned to the
 * module it copies.
 *
 * WHY THERE IS A COPY AT ALL. `scripts/lib/payoff.mjs` is written to be inlined into the page:
 * V3-PLAN §2 says it is "present in both builds", it carries a `@browser-cut` marker exactly like
 * `taxonomy.mjs`, and its boot hook is `setDefaultModel(MODEL)`. What it does not have yet is an
 * `@inject:payoff` region, and that region lives in `scripts/build.mjs` — another lane's file in
 * this phase. So P1-U mirrors the arithmetic inside `src/shell.html`, between `@payoff-page`
 * markers, and this file is the price of that: the copy is compared to the module argument for
 * argument over the whole shipped cell space, so it cannot drift without a red test.
 *
 * THE SEAM IS NAMED, NOT IMPLIED. When the injection region lands, the shell block is deleted and
 * `PAYOFF` is bound to the injected module — and this file goes with it. Until then, "the page
 * computes the same EV as the gate does" is a checked claim rather than a hopeful one, which is
 * what makes gate I33's contract mean anything on the surface a user actually reads.
 *
 * The `new Function` slicing trick is `test/sim-ui.test.mjs`'s and `test/ui-rail.test.mjs`'s, for
 * the same reason: the thing under test has to be the text that ships.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makePayoff, SOURCES, RESULT_KEYS } from '../scripts/lib/payoff.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = readFileSync(join(ROOT, 'src', 'shell.html'), 'utf8');
const MODEL = JSON.parse(readFileSync(join(ROOT, 'data', 'model.json'), 'utf8'));

const START = '/* @payoff-page';
const END = '/* @end:payoff-page */';
const a = SHELL.indexOf(START);
const b = SHELL.indexOf(END);
assert.ok(a > 0 && b > a, 'src/shell.html must carry the @payoff-page markers');
const SRC = SHELL.slice(a, b);

/** the shipped block, evaluated standalone — no page, no MODEL, no globals */
const PAYOFF = new Function(`${SRC}\nreturn PAYOFF;`)();

const mirror = PAYOFF.makePayoff(MODEL);
const module_ = makePayoff(MODEL);
const KEYS = Object.keys(MODEL.cells);

/** Bit-for-bit, not tolerance: the page and the gate must agree to the last ulp or they disagree. */
function same(x, y, what) {
  assert.deepEqual(Object.keys(x), Object.keys(y), `${what}: key order differs`);
  assert.ok(Object.is(x.ev, y.ev), `${what}: ev ${x.ev} vs ${y.ev}`);
  assert.ok(Object.is(x.se, y.se), `${what}: se ${x.se} vs ${y.se}`);
  assert.equal(x.source, y.source, `${what}: source`);
  assert.equal(x.supported, y.supported, `${what}: supported`);
}
const both = (cells, pot, spr, opts, what) =>
  same(mirror(cells, pot, spr, opts), module_(cells, pot, spr, opts), what);

// ---------------------------------------------------------------- self-containment

test('the block is self-contained — it can only be sliced out if it reaches for nothing', () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const re of [/\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /(?<![A-Za-z0-9_])MODEL\b/,
    /(?<![A-Za-z0-9_])S\./, /(?<![A-Za-z0-9_.])\$\(/, /(?<![A-Za-z0-9_.])el\(/]) {
    assert.ok(!re.test(code), `@payoff-page must not reference ${re}: it is evaluated with no page`);
  }
  // ES5 only: the block ships through jsmin into a script the page parses as-is.
  for (const re of [/\bconst\b/, /\blet\b/, /=>/, /\.\.\./]) {
    assert.ok(!re.test(code), `@payoff-page must stay ES5-shaped (found ${re})`);
  }
});

test('the surface it exports is the module’s surface', () => {
  assert.deepEqual(PAYOFF.SOURCES, [...SOURCES]);
  assert.deepEqual(PAYOFF.RESULT_KEYS, [...RESULT_KEYS]);
  assert.equal(typeof PAYOFF.makePayoff, 'function');
  assert.equal(mirror.length, module_.length, 'arity is part of the freeze (I33(a))');
  assert.equal(mirror.modelHash, module_.modelHash);
  assert.equal(mirror.modelHash, MODEL.meta.hash);
});

// ---------------------------------------------------------------- the supported domain

test('every heads-up pair in the shipped model agrees, bit for bit', () => {
  let n = 0;
  for (let i = 0; i < KEYS.length; i++) {
    for (let j = 0; j < KEYS.length; j++) {
      const cells = [KEYS[i], KEYS[j]];
      both(cells, 3, 4, { ip: i % 2 === 0 }, `HU ${cells.join(' vs ')}`);
      n++;
    }
  }
  assert.equal(n, KEYS.length * KEYS.length);
  assert.ok(n >= 145 * 145, 'the whole cell space, not a sample');
});

test('the multiway door agrees at every request length the ladder can carry, and past it', () => {
  const nMax = MODEL.cells[KEYS[0]].eq.length;
  for (const hero of KEYS) {
    for (let len = 0; len <= nMax + 3; len++) {
      const cells = new Array(len).fill(hero);
      both(cells, 3, 4, { ip: false }, `len ${len} · ${hero}`);
    }
  }
});

test('the multiway branch reads hero only — the villain slots are provably inert', () => {
  // The EV colour mode fills the villain slots with hero's own key and the shell's comment says
  // that encodes no choice because the branch never looks at them. Checked, not asserted in prose.
  const others = KEYS.slice(0, 24);
  for (const hero of KEYS.slice(0, 24)) {
    const base = mirror([hero, hero, hero], 3, 4, { ip: false });
    for (const v1 of others) {
      for (const v2 of others) {
        same(mirror([hero, v1, v2], 3, 4, { ip: false }), base, `${hero} with ${v1}/${v2} in the slots`);
      }
    }
  }
});

test('the EV colour mode’s own request shapes agree with the module', () => {
  // MODES.requestFor: hero alone at one opponent, hero + nOpp slots above it.
  const mode = new Function(`${SHELL.slice(SHELL.indexOf('/* @mode-logic'),
    SHELL.indexOf('/* @end:mode-logic */'))}\nreturn MODES;`)();
  for (const hero of KEYS) {
    for (const nOpp of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const cells = mode.requestFor(hero, nOpp);
      both(cells, 3.25, 12.5, { ip: false }, `requestFor(${hero}, ${nOpp})`);
    }
  }
});

// ---------------------------------------------------------------- out of domain

test('every malformed request agrees too — that is where a mirror actually drifts', () => {
  const hero = KEYS[0];
  const badCells = [
    undefined, null, 0, '', 'AA_BIGPAIR|DS', {}, { 0: hero, length: 2 },
    [], [hero], [null], [undefined], [0], [{}],
    [hero, 'NOT_A_CELL'], ['NOT_A_CELL', hero], ['NOT_A_CELL', 'ALSO_NOT'],
    [hero, '__proto__'], ['__proto__', hero], [hero, 'constructor'], ['constructor', 'toString'],
    [hero, hero, 'NOT_A_CELL'], [hero, null], [hero, 7], [hero, ['nested']],
  ];
  const badPots = [3, 0, -1, NaN, Infinity, -Infinity, '3', null, undefined, {}];
  const badSprs = [4, 0, -1, NaN, Infinity, '4', null, undefined];
  const badOpts = [undefined, null, {}, { ip: true }, { ip: 1 }, { seed: 7 }, { seed: 'abc' },
    { seed: '' }, { seed: NaN }, { seed: {} }, { seed: null }, [], 'nope', 7, true];

  for (const c of badCells) for (const p of badPots) {
    both(c, p, 4, { ip: false }, `cells=${JSON.stringify(c)} pot=${String(p)}`);
  }
  for (const s of badSprs) for (const o of badOpts) {
    both([hero, hero], 3, s, o, `spr=${String(s)} opts=${JSON.stringify(o)}`);
    both([hero, hero, hero], 3, s, o, `mw spr=${String(s)} opts=${JSON.stringify(o)}`);
  }
});

test('a fabricated model moves both copies the same way, or neither', () => {
  // The mirror must not have quietly hard-coded the shipped trial count or ladder length.
  const fab = {
    meta: { trials: { cell: 400 }, hash: 'deadbeef' },
    cells: { A: { eq: [55, 40, 33] }, B: { eq: [45, 30, 25] }, BAD: { eq: [] }, WORSE: { eq: [1, NaN] } },
  };
  const m1 = PAYOFF.makePayoff(fab), m2 = makePayoff(fab);
  assert.equal(m1.modelHash, m2.modelHash);
  for (const cells of [['A', 'B'], ['B', 'A'], ['A', 'A', 'B'], ['A', 'A', 'A', 'B'],
    ['A', 'A', 'A', 'A', 'B'], ['A', 'BAD'], ['BAD', 'A'], ['A', 'WORSE'], ['WORSE'], ['A']]) {
    same(m1(cells, 3, 4, { ip: false }), m2(cells, 3, 4, { ip: false }), `fabricated ${cells.join(',')}`);
  }
  // and the one deliberate throw is mirrored: no measurement behind it, no accessor.
  for (const bad of [null, {}, { cells: {} }, { cells: { A: { eq: [1] } } },
    { cells: { A: { eq: [1] } }, meta: { trials: { cell: 0 } } }]) {
    let a1 = null, a2 = null;
    try { PAYOFF.makePayoff(bad); } catch (e) { a1 = e.constructor.name; }
    try { makePayoff(bad); } catch (e) { a2 = e.constructor.name; }
    assert.equal(a1, a2, `makePayoff(${JSON.stringify(bad)}) must throw in both or neither`);
  }
});

// ---------------------------------------------------------------- the seam

test('the copy declares its own seam, and the page has exactly one bound accessor', () => {
  assert.match(SRC, /@inject|injection region/i,
    'the block must name the seam that deletes it, or it becomes permanent by silence');
  // One `makePayoff(MODEL)` in the whole shell: two accessors is two models, and the second one
  // is the memo-key trap the module's docstring warns about arriving by another door.
  const binds = SHELL.match(/PAYOFF\.makePayoff\(/g) || [];
  assert.equal(binds.length, 1, 'exactly one bound accessor in the page');
  assert.match(SHELL, /var PAY = null, PAYWHY = ''/,
    'a page that cannot build an accessor must disable the EV mode BY NAME, not paint zeros');
});
