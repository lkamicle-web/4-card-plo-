// ring-shell.test.mjs — the page's TWO N-NAMES, tested as the shipped text.
//
// V4-PLAN §2.4 spends a paragraph on this because it is the part that is easy to get backwards, and
// getting it backwards fails in two opposite directions at once:
//
//   NMAX      the EQUITY-ARRAY SHAPE INVARIANT. `meta.nMax`, and it is 7 at every table size,
//             because `cells[*].eq` is seven long and the nine-seat columns live in a separate
//             artifact so that it stays that way (§0.4). Point it at the table size and every
//             model-path validation starts demanding nine numbers from a seven-number array.
//   SIM_NMAX  the SIMULATION FIELD WIDTH. `policy.nMax(seats)`, so 7 at six seats and 9 at nine.
//             Point it at the model's shape and Simulate at nine seats measures seven opponents
//             and silently answers a question nobody asked.
//
// The block is sliced out of src/shell.html by the same `@sim-engine` markers `sim-engine.test.mjs`
// uses and evaluated with ONE appended line that hands the closure's own bindings back — the
// technique `gates/subcell.mjs` uses on `@subcell`, and for the same reason: a test that asserted
// against a COPY of these two names would be asserting that two copies agree, which is not the
// claim. What has to be true is that the text the ARTIFACT runs keeps them apart.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSimBundle } from '../scripts/lib/sim-bundle.mjs';
import { minify } from '../scripts/lib/jsmin.mjs';
import * as TAX from '../scripts/lib/taxonomy.mjs';
import * as POLICY from '../scripts/lib/policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
const SHELL = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
const KERNEL = buildSimBundle(minify).kernel;

const BLOCK = (() => {
  const a = SHELL.indexOf('/* @sim-engine');
  const b = SHELL.indexOf('/* @end:sim-engine */');
  assert.ok(a > 0 && b > a, 'src/shell.html must carry the @sim-engine markers');
  return SHELL.slice(a, b);
})();

/* THE ONE INSERTED LINE: the closure's own bindings, handed back rather than reimplemented.
   It goes INSIDE the engine's IIFE — appending at the end of the block would land outside it, where
   these names do not exist — anchored on the `SIM_NMAX` declaration itself. Function declarations
   hoist, so `validEqArray`, `validMeasurement` and `setSimSeats` are already bound at this point,
   and `SIM_NMAX` is read through a closure so the probe sees every later assignment. */
const ANCHOR = 'var SIM_NMAX = NMAX;';
const PROBE = ANCHOR + '\nwindow.__RING = { validEqArray: validEqArray,'
  + ' validMeasurement: validMeasurement, setSimSeats: setSimSeats,'
  + ' nmax: function () { return { NMAX: NMAX, SIM_NMAX: SIM_NMAX }; } };';

function page(opts = {}) {
  /* `'policy' in opts`, not a default parameter: passing `undefined` would TRIGGER the default and
     silently hand the page a POLICY the test meant to withhold. */
  const policy = 'policy' in opts ? opts.policy : POLICY;
  const store = new Map();
  const win = {
    MODEL, TAXONOMY: TAX, POLICY: policy, SIM_KERNEL_SRC: KERNEL, SIM_ENTRY_SRC: '',
    location: { search: '', hash: '' },
    navigator: { hardwareConcurrency: 4 },
    performance: { now: () => 0 },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    document: { hidden: false, addEventListener() { }, removeEventListener() { } },
    setTimeout, clearTimeout, requestAnimationFrame: (fn) => setTimeout(fn, 0),
  };
  assert.equal(BLOCK.split(ANCHOR).length, 2, 'the probe anchor must occur exactly once');
  // eslint-disable-next-line no-new-func
  new Function('window', BLOCK.replace(ANCHOR, PROBE))(win);
  return win;
}

test('the two names start equal and mean different things', () => {
  const { NMAX, SIM_NMAX } = page().__RING.nmax();
  assert.equal(NMAX, MODEL.meta.nMax, "NMAX is the model's equity-array shape");
  assert.equal(NMAX, 7, 'and it stays 7 — the ring is a separate artifact so that it can');
  assert.equal(SIM_NMAX, NMAX, 'the sim width starts at the model width: six seats is unchanged');
});

test('SIM_NMAX moves with the table and NMAX does not', () => {
  const w = page();
  const R = w.__RING;
  for (const seats of POLICY.CONSTANTS.ladder.seats) {
    assert.equal(R.setSimSeats(seats), POLICY.nMax(seats), `seats ${seats}`);
    const n = R.nmax();
    assert.equal(n.SIM_NMAX, POLICY.nMax(seats), `SIM_NMAX at ${seats} seats`);
    assert.equal(n.NMAX, MODEL.meta.nMax, `NMAX must NOT move at ${seats} seats`);
  }
  assert.notEqual(POLICY.nMax(9), POLICY.nMax(6), 'the test would be vacuous if the ladder were flat');
});

test('a seat count the ladder does not name cannot widen the field', () => {
  const R = page().__RING;
  R.setSimSeats(9);
  for (const bogus of [8, 10, 0, -1, 99, NaN, undefined, '9']) {
    assert.equal(R.setSimSeats(bogus), MODEL.meta.nMax,
      `${String(bogus)} is not on the ladder and must fall back to the model width`);
  }
});

test('with no POLICY at all the page behaves exactly as it did before the ladder', () => {
  const R = page({ policy: null }).__RING;
  assert.equal(R.nmax().SIM_NMAX, MODEL.meta.nMax);
  assert.equal(R.setSimSeats(9), MODEL.meta.nMax, 'a pre-ladder build measures seven, as it always did');
});

test('validEqArray takes a WIDTH, and defaults to the model shape', () => {
  const R = page().__RING;
  const seven = Array.from({ length: 7 }, (_, i) => 50 - i);
  const nine = Array.from({ length: 9 }, (_, i) => 50 - i);
  assert.equal(R.validEqArray(seven), true, 'the default arity is the model path, unchanged');
  assert.equal(R.validEqArray(nine), false, 'a nine-long eq is NOT a model equity array');
  assert.equal(R.validEqArray(nine, 9), true, 'the sim path validates against the sim width');
  assert.equal(R.validEqArray(seven, 9), false, 'and a short array at nine seats is still refused');
  // the plausibility half is untouched by the arity: every index, still
  assert.equal(R.validEqArray([...nine.slice(0, 8), 101], 9), false, 'out of range at the last index');
  assert.equal(R.validEqArray([...nine.slice(0, 4), NaN, ...nine.slice(5)], 9), false, 'NaN in the middle');
  for (const junk of [undefined, null, 'x', 7, {}]) assert.equal(R.validEqArray(seven, junk), true,
    `a junk width falls back to NMAX rather than accepting anything (${String(junk)})`);
});

test('validMeasurement threads the width to every cell, and keeps its other clause', () => {
  const R = page().__RING;
  const nine = Array.from({ length: 9 }, () => 40);
  const seven = Array.from({ length: 7 }, () => 40);
  const M = (cells, extra) => ({ cells, trials: 25000, ...extra });
  assert.equal(R.validMeasurement(M({ a: nine, b: nine }), 9), true);
  assert.equal(R.validMeasurement(M({ a: nine, b: nine })), false, 'default is still the model shape');
  assert.equal(R.validMeasurement(M({ a: nine, b: seven }), 9), false, 'ONE short cell fails the lot');
  assert.equal(R.validMeasurement(M({}), 9), false, 'an empty measurement is not a measurement');
  /* the arity did not loosen the OTHER clause: a payload with no trial count still cannot be told
     apart from one that never ran, at either width */
  assert.equal(R.validMeasurement({ cells: { a: nine } }, 9), false, 'no trial count, no entry');
  assert.equal(R.validMeasurement(M({ a: seven })), true, 'the six-seat path is untouched');
});

test('the cache refuses a payload measured at another table size', () => {
  /* The compat check pins `p.nMax` to the width IN FORCE, so a nine-seat payload cannot be served
     to a six-seat session or the other way round. The stored value is never its own yardstick. */
  const w = page();
  const R = w.__RING;
  const good = { trials: 25000, v: 55, q: 0.85 };
  const hash = w.SIM.settingsHash(good);
  const nine = Array.from({ length: 9 }, () => 40);
  const payload = {
    tag: 'plo4-sim@1', hash, model: (MODEL.meta && MODEL.meta.hash) || '',
    orderHash: (MODEL.meta && MODEL.meta.orderHash) || '', nMax: 9,
    v: 55, q: 0.85, trials: 25000, cells: { a: nine },
  };
  assert.equal(R.nmax().SIM_NMAX, 7, 'the page is at the six-seat width');
  assert.equal(w.SIM.validMeasurement(payload, payload.nMax), true,
    'the payload is well formed at its own declared width — so only the compat check can reject it');
  R.setSimSeats(9);
  assert.equal(R.nmax().SIM_NMAX, 9, 'and now the page is at the nine-seat width');
});
