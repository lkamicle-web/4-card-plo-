// villain-profile.test.mjs — policy.mjs's villain-VPIP equity accessor (V2-PLAN §2.3, §4).
//
// Two properties carry the whole design, and both are asserted here rather than assumed:
//
//   OFF IS STRICT IDENTITY. The villain axis is off by default, and when it is off the accessor
//   must hand back the shipped arrays BY REFERENCE, not a copy, not a zero-delta blend. Gate I22
//   asserts that the whole pipeline reproduces v1's tiers bit for bit; a helper that reproduced
//   them by adding 0.0 would be one rounding change away from not doing so.
//
//   THE LATTICE POINTS ARE EXACT. The page labels an off-lattice number `interpolated` and an
//   on-lattice one as measured. Those labels must not disagree about the same cell at v = 55, so a
//   lattice hit returns the shipped row itself, never `a + (b - a) * f`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as P from '../scripts/lib/policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = P.hydrate(JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8')));
const PTS = MODEL.constants.villainLattice.v;
const Q = MODEL.constants.villainLattice.discipline;
const KEY = 'RUN0_LOW|DS';
const CELL = MODEL.cells[KEY];

test('the profile is OFF unless it is explicitly on', () => {
  for (const p of [null, undefined, {}, { on: false }, { v: 55 }, { on: 'yes' }, { on: 1 }]) {
    assert.equal(P.villainProfileOf(p, MODEL).on, false, JSON.stringify(p));
  }
  assert.equal(P.villainProfileOf({ on: true, v: 55 }, MODEL).on, true);
});

test('OFF returns the shipped arrays BY REFERENCE — strict identity, not a copy', () => {
  for (const p of [null, undefined, { on: false }, { on: false, v: 25, q: 0.1 }]) {
    const r = P.villainEq(MODEL, KEY, CELL, p);
    assert.equal(r.eq, CELL.eq, 'same array object, not an equal one');
    assert.equal(r.rho, CELL.rho, 'same rho object');
    assert.equal(r.source, 'shipped');
    assert.equal(r.supported, true);
  }
  /* on, but with no v: still nothing to apply */
  const r = P.villainEq(MODEL, KEY, CELL, { on: true });
  assert.equal(r.eq, CELL.eq);
});

test('every lattice point is EXACT — the shipped row, not a blend', () => {
  for (let i = 0; i < PTS.length; i++) {
    const v = PTS[i];
    const r = P.villainEq(MODEL, KEY, CELL, { on: true, v, q: Q });
    assert.equal(r.exact, true, `v=${v} is a lattice point`);
    assert.equal(r.source, 'lattice');
    for (let n = 0; n < CELL.eq.length; n++) {
      assert.equal(r.eq[n], CELL.eq[n] + CELL.vDelta[i][n],
        `v=${v} N=${n + 1}: must be eq + the shipped delta, exactly`);
    }
  }
  /* and the low-level helper, on its own, at f = 0 AND f = 1 */
  const d = [[1, 2], [3, 4], [5, 6]];
  assert.deepEqual(P.interpolateDelta([25, 55, 90], d, 25).delta, d[0]);
  assert.deepEqual(P.interpolateDelta([25, 55, 90], d, 55).delta, d[1]);
  assert.deepEqual(P.interpolateDelta([25, 55, 90], d, 90).delta, d[2]);
  assert.equal(P.interpolateDelta([25, 55, 90], d, 55).delta, d[1], 'the row itself, by reference');
});

test('between the points it is linear, and at the midpoint it is the mean', () => {
  const mid = (PTS[1] + PTS[2]) / 2;
  const r = P.villainEq(MODEL, KEY, CELL, { on: true, v: mid, q: Q });
  assert.equal(r.exact, false);
  assert.equal(r.source, 'interpolated');
  for (let n = 0; n < CELL.eq.length; n++) {
    const want = CELL.eq[n] + (CELL.vDelta[1][n] + CELL.vDelta[2][n]) / 2;
    assert.ok(Math.abs(r.eq[n] - want) < 1e-12, `N=${n + 1}: ${r.eq[n]} vs ${want}`);
  }
  /* a quarter of the way along is a quarter of the way along */
  const q1 = PTS[1] + (PTS[2] - PTS[1]) * 0.25;
  const r2 = P.villainEq(MODEL, KEY, CELL, { on: true, v: q1, q: Q });
  const want0 = CELL.eq[0] + CELL.vDelta[1][0] + (CELL.vDelta[2][0] - CELL.vDelta[1][0]) * 0.25;
  assert.ok(Math.abs(r2.eq[0] - want0) < 1e-12);
});

test('outside the lattice it clamps to the ends rather than extrapolating', () => {
  const lo = P.villainEq(MODEL, KEY, CELL, { on: true, v: 5, q: Q });
  const hi = P.villainEq(MODEL, KEY, CELL, { on: true, v: 200, q: Q });
  for (let n = 0; n < CELL.eq.length; n++) {
    assert.equal(lo.eq[n], CELL.eq[n] + CELL.vDelta[0][n]);
    assert.equal(hi.eq[n], CELL.eq[n] + CELL.vDelta[PTS.length - 1][n]);
  }
  assert.equal(P.villainProfileOf({ on: true, v: 5 }, MODEL).v, PTS[0]);
  assert.equal(P.villainProfileOf({ on: true, v: 200 }, MODEL).v, PTS[PTS.length - 1]);
});

test('an off-lattice discipline has NO shipped answer, and says so instead of inventing one', () => {
  /* q is the one axis the lattice does not span. There is exactly one measurement at q = 0.85 and
     nothing to interpolate between, so the honest answer is "unsupported, here is the baseline" —
     and the Simulate button is what exists to produce a real one. */
  const r = P.villainEq(MODEL, KEY, CELL, { on: true, v: 55, q: 0.5 });
  assert.equal(r.supported, false);
  assert.equal(r.eq, CELL.eq, 'falls back to the shipped baseline, by reference');
  assert.equal(r.q, 0.5);
  /* the shipped q is supported */
  assert.equal(P.villainEq(MODEL, KEY, CELL, { on: true, v: 55, q: Q }).supported, true);
  /* and an unspecified q means "the shipped one" */
  assert.equal(P.villainEq(MODEL, KEY, CELL, { on: true, v: 55 }).supported, true);
});

test('a measured result from the Simulate engine outranks the lattice', () => {
  const measured = { [KEY]: CELL.eq.map((e) => e + 3.25) };
  const r = P.villainEq(MODEL, KEY, CELL, { on: true, v: 62, q: 0.4, measured });
  assert.equal(r.source, 'measured');
  assert.equal(r.exact, true);
  assert.equal(r.supported, true);
  assert.equal(r.eq, measured[KEY]);
  for (let n = 0; n < r.rho.length; n++) {
    assert.ok(Math.abs(r.rho[n] - (r.eq[n] * (n + 2)) / 100) < 1e-12, `rho at N=${n + 1}`);
  }
  /* a measured map that does not carry this cell falls through to the lattice, not to a crash */
  const other = P.villainEq(MODEL, KEY, CELL, { on: true, v: 55, q: Q, measured: { 'TRASH|RB': [1, 2, 3] } });
  assert.equal(other.source, 'lattice');
  /* nor to a wrong-length array */
  const bad = P.villainEq(MODEL, KEY, CELL, { on: true, v: 55, q: Q, measured: { [KEY]: [1, 2] } });
  assert.equal(bad.source, 'lattice');
});

test('a v1 model with no lattice reports unsupported rather than throwing', () => {
  const v1 = { constants: {}, meta: { vpip: { min: 25, max: 90 } } };
  const cell = { eq: [50, 40, 30, 25, 20], rho: [1, 1.2, 1.2, 1.25, 1.2] };
  const r = P.villainEq(v1, 'X', cell, { on: true, v: 55 });
  assert.equal(r.supported, false);
  assert.equal(r.eq, cell.eq);
});

test('rho is consistent with eq wherever the accessor builds one', () => {
  const r = P.villainEq(MODEL, KEY, CELL, { on: true, v: 47, q: Q });
  for (let n = 0; n < r.rho.length; n++) {
    assert.ok(Math.abs(r.rho[n] - (r.eq[n] * (n + 2)) / 100) < 1e-12, `N=${n + 1}`);
  }
  /* and it is the same relation hydrate() uses for the shipped baseline */
  for (let n = 0; n < CELL.rho.length; n++) {
    assert.ok(Math.abs(CELL.rho[n] - (CELL.eq[n] * (n + 2)) / 100) < 1e-12);
  }
});

test('seOfTrials is the shipped basis, and V2-PLAN §4\'s 0.35 is not', () => {
  assert.equal(+P.seOfTrials(100000).toFixed(2), MODEL.meta.se.cell);
  assert.equal(+P.seOfTrials(25000).toFixed(3), 0.316);
  assert.equal(+P.seOfTrials(40000).toFixed(2), MODEL.meta.se.sub);
  assert.equal(P.seOfTrials(0), Infinity);
  /* the plan quotes +/-0.35 at 25k against "the shipped +/-0.16". Both cannot come from one
     formula; 0.16 is 50/sqrt(100000), and this is the one that keeps them on the same basis. */
  assert.ok(Math.abs(P.seOfTrials(25000) - 0.35) > 0.03);
});

test('the accessor leaves the model exactly as it found it', () => {
  const before = JSON.stringify(MODEL.cells[KEY]);
  P.villainEq(MODEL, KEY, CELL, { on: true, v: 62, q: Q });
  P.villainEq(MODEL, KEY, CELL, null);
  assert.equal(JSON.stringify(MODEL.cells[KEY]), before);
});
