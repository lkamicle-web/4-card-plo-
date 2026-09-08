// The nine-seat skill-exception records, and the nine-seat coverage reasons — v4 S2, lane K.
//
// WHY THIS FILE EXISTS. `scripts/gates/skill.mjs` runs `widthProblems(model)` at SIX seats and
// nothing in `verify.mjs` runs it at nine, so the records R5 asks for would ship measured and
// UNCHECKED until somebody extends I38(d)/(e)'s domain (filed for S3 in docs/spikes/V4-skill.md).
// A frozen record nothing re-derives is exactly the failure `skill.mjs`'s own header is written
// against — "an allowance is what you write when you have not enumerated" — so the re-derivation
// runs here, in the same both-directions form the gate uses, until the gate's domain moves.
//
// It also pins the two things R5 makes a rule about rather than a measurement: that METHODOLOGY
// §3.5's procedure REPRODUCES (if it did not, the new pairs would have to ship without exceptions),
// and that the nine-seat sweep never reads past the shipped `cells[*].eq` columns — so this
// measurement owes nothing to `data/ring.json` and could be taken at S2 rather than after S3.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as P from '../scripts/lib/policy.mjs';
import * as SK from '../scripts/lib/skill.mjs';
import { coverageMap, NOT_HU_REASON, domainLabelFor } from '../scripts/lib/equilibrium.mjs';
import { MULTIWAY_DEFERRAL } from '../scripts/lib/cfr.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
P.hydrate(MODEL);

/** the sweep's own re-derivation, in the two forms `widthProblems` compares against */
function measured(seats) {
  const EPS = 1e-12;
  const t = SK.widthTable(MODEL, SK.SKILL_GRID, seats);
  const endpoint = t.pairs.filter((r) => r.w[r.w.length - 1] > r.w[0] + EPS).map((r) => r.key);
  const interior = [];
  for (const r of t.pairs) {
    for (let i = 1; i < r.w.length; i++) if (r.w[i] > r.w[i - 1] + EPS) interior.push(`${r.key}@${i}`);
  }
  return { t, endpoint, interior };
}

test('METHODOLOGY §3.5\'s procedure reproduces the SIX-seat records — R5\'s precondition', () => {
  // R5: "if the procedure is not reproducible from the docs, that is a finding, the new pairs ship
  // WITHOUT exceptions". It is reproducible, so they do not: this is that check, run on the same
  // five-point grid, the same SWEEP_RAISER attribution and the same limpers the docs name.
  const m = measured(6);
  assert.deepEqual(m.endpoint, [...SK.WIDTH_ENDPOINT_EXCEPTIONS]);
  assert.deepEqual([...m.interior].sort(), [...SK.WIDTH_INTERIOR_EXCEPTIONS].sort());
  assert.deepEqual(SK.widthProblems(MODEL), []);
});

test('the NINE-seat records re-derive, in both directions, over all 33 legal pairs', () => {
  const m = measured(9);
  assert.equal(SK.legalPairs(9).length, 33);
  assert.deepEqual(m.endpoint, [...SK.WIDTH_ENDPOINT_EXCEPTIONS_9]);
  assert.deepEqual([...m.interior].sort(), [...SK.WIDTH_INTERIOR_EXCEPTIONS_9].sort());
  assert.equal(m.endpoint.length, 9);
  assert.equal(m.interior.length, 20);
  assert.deepEqual(SK.widthProblems(MODEL, SK.SKILL_GRID, 9), []);
});

test('ARMED: the nine-seat record is connected — a perturbed model must move it', () => {
  // A record nothing can break is a record nobody knows is checked, so the arming runs the REAL
  // `widthProblems` against a model whose nut fractions have moved — `test/skill.test.mjs`'s own
  // perturbation idiom, whole-hash replaced so the shadow memo cannot hand back a cached answer.
  const m = JSON.parse(JSON.stringify(MODEL));
  m.meta.hash = 'deadbeef'.repeat(8);
  for (const k of Object.keys(m.cells)) {
    if (k.startsWith('BROADWAY_RUN|') || k.startsWith('RUN0_HIGH|')) m.cells[k].nu = Math.min(0.99, m.cells[k].nu + 0.08);
  }
  P.hydrate(m);
  const problems = SK.widthProblems(m, SK.SKILL_GRID, 9);
  assert.ok(problems.length > 0, 'a perturbed model reproduced the nine-seat record exactly — it is not connected');
  assert.match(problems.join(' '), /exception set moved/);
  // and the six-seat record is connected on the same perturbation, which is what makes the pair of
  // records comparable rather than one measurement and one decoration
  assert.ok(SK.widthProblems(m).length > 0);
  // the shipped model still clears, on the same code path, after the perturbed one has run
  P.hydrate(MODEL);
  assert.deepEqual(SK.widthProblems(MODEL, SK.SKILL_GRID, 9), []);
});

test('the nine-seat width sweep reads NO ring columns — it owes nothing to data/ring.json', () => {
  // If any setting of the sweep reached N > nMax(6), `eqAtSeats` would need the ring payload and
  // this whole record would have been unmeasurable until lane R and S3 landed. It does not: the
  // largest N_eff anywhere in the sweep is under 5. Asserted rather than asserted-about, because it
  // is the reason this lane could measure at S2 at all.
  let maxN = 0;
  for (const p of SK.poolsAlong(MODEL)) {
    for (const { pos, node } of SK.legalPairs(9)) {
      const s = P.solve(p.model, { pos, node, v: p.v, limpers: 2, raiserPos: SK.SWEEP_RAISER, seats: 9 });
      if (s.N > maxN) maxN = s.N;
    }
  }
  assert.ok(maxN < P.nMax(6), `the sweep reached N_eff ${maxN}, at or past nMax(6) = ${P.nMax(6)}`);
  assert.ok(maxN > 4.9 && maxN < 5.0, `N_eff max measured 4.995 at S2, now ${maxN}`);
});

test('the endpoint exceptions are the same two cells and the same tier move at nine seats', () => {
  const t = SK.widthTable(MODEL, SK.SKILL_GRID, 9);
  for (const key of SK.WIDTH_ENDPOINT_EXCEPTIONS_9) {
    const [pos, node] = key.split('|');
    const a = P.solve(t.pools[0].model,
      { pos, node, v: t.pools[0].v, limpers: 2, raiserPos: SK.SWEEP_RAISER, seats: 9 });
    const b = P.solve(t.pools[t.pools.length - 1].model,
      { pos, node, v: t.pools[t.pools.length - 1].v, limpers: 2, raiserPos: SK.SWEEP_RAISER, seats: 9 });
    const moved = Object.keys(a.cells).filter((k) => a.cells[k].action !== b.cells[k].action).sort();
    assert.deepEqual(moved, [...SK.WIDTH_ENDPOINT_CELLS], `${key} loosens through other cells`);
    for (const k of moved) {
      assert.equal(a.cells[k].action, SK.WIDTH_ENDPOINT_MOVE.from);
      assert.equal(b.cells[k].action, SK.WIDTH_ENDPOINT_MOVE.to);
    }
  }
});

test('clause (iii) THREADS the table size — a seats-blind solve would realize at NaN', () => {
  // The bug this pins: `realization` reads `baseR[pos]` out of `ladderConstants(seats).baseR`, so a
  // seats-blind solve at a nine-seat-only key gets `undefined` and NaN — silently, without
  // throwing. `widthProblems` (iii) names the CELLS behind an endpoint exception with those solves.
  const p = SK.poolsAlong(MODEL)[0];
  const blind = P.realization('UTG1', 3, 0.5, P.CONSTANTS.depth.ref);
  const sized = P.realization('UTG1', 3, 0.5, P.CONSTANTS.depth.ref, 9);
  assert.ok(Number.isNaN(blind), 'a seats-blind realization at UTG1 no longer NaNs — re-read the clause');
  assert.ok(Number.isFinite(sized) && sized > 0);
  const s = P.solve(p.model, { pos: 'UTG1', node: 'rfi', v: p.v, limpers: 2, raiserPos: SK.SWEEP_RAISER, seats: 9 });
  for (const k of Object.keys(s.cells)) {
    if (s.cells[k].R != null) assert.ok(Number.isFinite(s.cells[k].R), `${k} realizes at ${s.cells[k].R}`);
  }
});

test('I38(e)\'s reach scan at nine seats: 14,760 readings, dial-blind to the last bit', () => {
  // The count the gate's domain change would take on (S3), measured here so the number in
  // docs/spikes/V4-skill.md is a measurement and not a projection: 24 non-3bet pairs x 5 dial
  // settings x 123 cells. Every one of the 12 pairs R5 names is inside it, `LJ|limps` and
  // `LJ|raise` included — which is §5.1's I38(e) requirement, checked rather than asserted.
  const pairs = SK.legalPairs(9);
  const keys = new Set(pairs.map(({ pos, node }) => `${pos}|${node}`));
  for (const k of ['UTG|rfi', 'UTG|3bet', 'UTG1|rfi', 'UTG1|limps', 'UTG1|raise', 'UTG1|3bet',
    'UTG2|rfi', 'UTG2|limps', 'UTG2|raise', 'UTG2|3bet', 'LJ|limps', 'LJ|raise']) {
    assert.ok(keys.has(k), `${k} is not in the nine-seat reach scan`);
  }
  let readings = 0;
  for (const p of SK.poolsAlong(MODEL)) {
    for (const { pos, node } of pairs) {
      if (node === '3bet') continue;
      const out = P.solve(p.model, { pos, node, v: p.v, limpers: 2, raiserPos: SK.SWEEP_RAISER, seats: 9 });
      for (const k of Object.keys(out.cells)) {
        const e = out.cells[k];
        if (e.R == null) continue;
        readings++;
        assert.ok(Object.is(e.R, P.realization(pos, out.N, p.model.cells[k].nu, P.CONSTANTS.depth.ref, 9)),
          `${pos}|${node} ${k} realizes off the dial-blind formula`);
      }
    }
  }
  assert.equal(readings, 14760);
});

test('the vs-GTO disabled reasons: 33 of 36 uncovered at nine seats, six inert', () => {
  const six = coverageMap(), nine = coverageMap(9);
  assert.equal(six.length, 24);
  assert.equal(nine.length, 36);
  assert.equal(nine.filter((r) => r.covered).length, 3);
  assert.equal(nine.filter((r) => !r.covered).length, 33);
  assert.ok(nine.filter((r) => !r.covered).every((r) => r.reason === NOT_HU_REASON));
  // the covered three are the HU tree's own, and not one of them is a seat the ladder adds
  assert.deepEqual(nine.filter((r) => r.covered).map((r) => `${r.pos}|${r.node}`).sort(),
    ['BB|raise', 'SB|3bet', 'SB|rfi']);
  // INERTNESS: the six-seat map is what ships, byte for byte
  const eq = JSON.parse(readFileSync(resolve(ROOT, 'data/equilibrium.json'), 'utf8'));
  assert.equal(JSON.stringify(six), JSON.stringify(eq.coverage));
  assert.equal(JSON.stringify(six), JSON.stringify(MODEL.baselineTiers.coverage));
});

test('the domain label follows the ladder, and the nesting chain deliberately does not', () => {
  assert.equal(domainLabelFor(['SB', 'BB']), 'GTO');
  assert.equal(domainLabelFor(P.seatsFor(6)), 'self-play fixed point');
  assert.equal(domainLabelFor(P.seatsFor(9)), 'self-play fixed point');
  // I36(b) stays SIX-seat-scoped on purpose (V4-PLAN §5.1): the armed clause is worded about the
  // UTG/HJ/CO/BTN chain, and generalising it would change what the sentence means.
  assert.deepEqual(P.nestChain('rfi', 6), ['UTG', 'HJ', 'CO', 'BTN']);
  assert.equal(P.nestChain('rfi', 9).length, 7);
});

test('the multiway deferral is renamed, not re-opened — I35(d)\'s legs are untouched', () => {
  assert.equal(MULTIWAY_DEFERRAL.status, 'deferred');
  assert.match(MULTIWAY_DEFERRAL.claimScope, /fixed-point-only/);
  assert.match(MULTIWAY_DEFERRAL.budgetCriterion, /met/i);
  assert.equal(MULTIWAY_DEFERRAL.reopenRule.length, 4);
  assert.equal(MULTIWAY_DEFERRAL.reopenRule.find((l) => l.leg === 'ii').verdict, 'FAILS');
  assert.match(MULTIWAY_DEFERRAL.reopenVerdict, /NOT MEASURABLE in the HU domain/);
  // the record's own name no longer says a table size, and the reason it gives does not either
  const src = readFileSync(resolve(ROOT, 'scripts/lib/cfr.mjs'), 'utf8');
  assert.ok(!/export const SIXMAX\b/.test(src), 'the record still exports the table-size name');
  assert.ok(!/6-max|six-max/.test(MULTIWAY_DEFERRAL.reason + MULTIWAY_DEFERRAL.claimScope
    + MULTIWAY_DEFERRAL.revisitWhen + MULTIWAY_DEFERRAL.reopenVerdict),
  'the deferral record still describes itself by a table size');
});
