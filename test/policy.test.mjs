// node --test test/
//
// The policy tests run against the committed data/model.json, because the policy is only meaningful
// over measured equities. If the model has not been generated yet the suite skips rather than lies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../scripts/lib/policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const HAVE_MODEL = existsSync(MODEL_PATH);
const M = HAVE_MODEL ? P.hydrate(JSON.parse(readFileSync(MODEL_PATH, 'utf8'))) : null;
const near = (a, b, tol) => Math.abs(a - b) <= tol;

test('the call-frequency curves reproduce the published values', () => {
  assert.ok(near(P.cCall(0.55), 0.261, 0.001));
  assert.ok(near(P.cBlind(0.55), 0.491, 0.001));
  assert.ok(near(P.cCall(0.90), 0.482, 0.001));
  assert.ok(near(P.cBlind(0.90), 0.823, 0.001));
  assert.equal(P.cLimper(0.90), 0.90);
  assert.ok(P.cBlind(1) <= 0.95 && P.cLimper(1) <= 0.90, 'both curves stay clamped');
});

test('N_eff reproduces the published table', () => {
  const n = (pos, node, v, limpers) => P.nEff({ pos, node, v, limpers }).raw;
  assert.ok(near(n('UTG', 'rfi', 0.55), 2.76, 0.01));
  assert.ok(near(n('CO', 'rfi', 0.55), 2.24, 0.01));
  assert.ok(near(n('BTN', 'rfi', 0.55), 1.98, 0.01));
  assert.ok(near(n('UTG', 'rfi', 0.25), 1.78, 0.01));
  assert.ok(near(n('UTG', 'rfi', 0.90), 4.09, 0.01));
  assert.ok(near(n('CO', 'limps', 0.90, 3), 5.92, 0.01));
  // v2 measures the equity curve out to seven opponents (V2-PLAN §2.2), so the published 5.92 iso
  // case is now read where it actually sits instead of being clamped down to 5.00
  const iso = P.nEff({ pos: 'CO', node: 'limps', v: 0.90, limpers: 3 });
  assert.ok(near(iso.N, 5.92, 0.01), 'the 5.92 iso spot is no longer clamped');
  assert.ok(!iso.extrapolated, 'and no longer flagged as extrapolated');
  // the clamp and the badge are not gone, they moved: the loosest iso spot still exceeds the data
  const wide = P.nEff({ pos: 'HJ', node: 'limps', v: 0.90, limpers: 4 });
  assert.ok(wide.raw > 7 && wide.N === 7 && wide.extrapolated, 'above N=7 the badge still fires');
});

test('target widths reproduce the published table', () => {
  assert.ok(near(P.widthFor('UTG', 'rfi', 0.25) * 100, 14.6, 0.05));
  assert.ok(near(P.widthFor('UTG', 'rfi', 0.55) * 100, 16.3, 0.05));
  assert.ok(near(P.widthFor('UTG', 'rfi', 0.90) * 100, 18.2, 0.05));
  assert.ok(near(P.widthFor('BTN', 'rfi', 0.25) * 100, 41.1, 0.05));
  assert.ok(near(P.widthFor('CO', 'rfi', 0.90) * 100, 30.8, 0.05));
  // the iso value factor only bites above VPIP 50
  assert.equal(P.widthFor('CO', 'limps', 0.40), P.widthFor('CO', 'rfi', 0.40));
  assert.ok(P.widthFor('CO', 'limps', 0.90) > P.widthFor('CO', 'rfi', 0.90));
});

test('realization and the nut multiplier behave as documented', () => {
  assert.ok(near(P.realization('BTN', 1, 0), 1.06, 1e-9));
  assert.ok(near(P.realization('UTG', 5, 0) / 0.97, 0.60, 1e-9), 'nu=0 realizes at 0.60x five-way');
  assert.ok(near(P.realization('UTG', 5, 1) / 0.97, 1.00, 1e-9), 'nu=1 loses nothing');
  assert.ok(near(P.kappa(1), 0.15, 1e-9));
  assert.ok(near(P.kappa(5), 0.67, 1e-9));
  assert.ok(P.mNut(0.94, 5) > 1 && P.mNut(0.07, 5) < 1);
  // the nut floor rises with N but is capped, so it can never outrun the widening it shapes
  assert.ok(near(P.nuMin(3), 0.20, 1e-9) && near(P.nuMin(4), 0.30, 1e-9));
  assert.ok(near(P.nuMin(5), P.CONSTANTS.nutGateCap, 1e-9), 'nuMin is capped at nutGateCap');
  assert.ok(P.nuMin(5) >= P.nuMin(3), 'still monotone up to the cap');
});

test('the vs-3-bet uncertainty band is read in frequency, not equity', { skip: !HAVE_MODEL }, () => {
  const cuts = P.vs3betCuts(M, undefined);
  assert.ok(cuts.callCut > 0 && cuts.callCut < 1, 'the 36% call floor is a live boundary');
  assert.ok(cuts.fourBetCut > 0 && cuts.fourBetCut < cuts.callCut, 'the 4-bet cut sits above it');
  // hero equities against the face-up mix pile up on the call floor, so an absolute equity window
  // would sweep a large fraction of the grid into MIX. The frequency band must not.
  const s = P.solve(M, { pos: 'UTG', node: '3bet', v: 0.55, limpers: 2, raiserPos: 'CO' });
  let mix = 0;
  for (const k of Object.keys(s.cells)) if (s.cells[k].tier === 'T4') mix += M.cells[k].combos;
  assert.ok(mix / M.meta.comboTotal < 0.10, `MIX is ${(100 * mix / M.meta.comboTotal).toFixed(1)}% of combos`);
});

test('I15 — RUN0_LOW x DS continues at every seat, BROADWAY_RUN x RB at none', { skip: !HAVE_MODEL }, () => {
  for (const pos of P.POSITIONS) {
    const s = P.solve(M, { pos, node: '3bet', v: 0.55, limpers: 2, raiserPos: 'CO' });
    assert.ok(['T2', 'T3'].includes(s.cells['RUN0_LOW|DS'].tier), `RUN0_LOW|DS at ${pos}`);
    assert.equal(s.cells['BROADWAY_RUN|RB'].tier, 'T5', `BROADWAY_RUN|RB at ${pos}`);
  }
});

test('rho interpolates linearly and clamps outside 1..5', () => {
  const rho = [1, 2, 3, 4, 5];
  assert.equal(P.rhoAt(rho, 1), 1);
  assert.equal(P.rhoAt(rho, 5), 5);
  assert.equal(P.rhoAt(rho, 2.5), 2.5);
  assert.equal(P.rhoAt(rho, 9), 5);
  assert.equal(P.rhoAt(rho, 0), 1);
});

test('positions are disabled exactly where the game tree makes them impossible', () => {
  assert.ok(P.positionDisabled('BB', 'rfi'));
  assert.ok(P.positionDisabled('UTG', 'limps'));
  assert.ok(P.positionDisabled('UTG', 'raise'));
  assert.equal(P.positionDisabled('UTG', 'rfi'), null);
  assert.equal(P.positionDisabled('BB', 'limps'), null);
});

test('the vs-3-bet blend is exactly the weighted mean of its components', { skip: !HAVE_MODEL }, () => {
  const c = M.cells['AA_BIGPAIR|DS'];
  const m = [0.6, 0.25, 0.1, 0.05];
  const byHand = (m[0] * c.eqVs3bet.AA + m[1] * c.eqVs3bet.KK + m[2] * c.eqVs3bet.QQ + m[3] * c.eqVs3bet.BWR) / 100;
  assert.ok(near(P.eqMixOf(c, m), byHand, 1e-12));
  const flat = P.eqMixOf(c, [1, 0, 0, 0]);
  assert.ok(near(flat * 100, c.eqVs3bet.AA, 1e-9));
});

test('I19 — the exploit tier is empty at the reference table', { skip: !HAVE_MODEL }, () => {
  for (const node of ['rfi', 'limps', 'raise']) {
    for (const pos of P.POSITIONS) {
      if (P.positionDisabled(pos, node)) continue;
      const s = P.solve(M, { pos, node, v: M.meta.vpip.ref / 100, limpers: 2, raiserPos: 'CO' });
      const t2 = Object.keys(s.cells).filter((k) => s.cells[k].tier === 'T2');
      assert.equal(t2.length, 0, `${node}/${pos}`);
    }
  }
});

test('I7 / I8 — the anchor cells never move', { skip: !HAVE_MODEL }, () => {
  for (const node of P.NODES) {
    for (const pos of P.POSITIONS) {
      if (P.positionDisabled(pos, node)) continue;
      for (const vp of [25, 55, 90]) {
        const s = P.solve(M, { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' });
        assert.equal(s.cells['AA_BIGPAIR|DS'].tier, 'T1', `${node}/${pos}/${vp}`);
        for (const k of ['TRASH|RB', 'TRIPS_SMALL|RB']) {
          assert.ok(!['T1', 'T2'].includes(s.cells[k].tier), `${k} at ${node}/${pos}/${vp}`);
        }
      }
    }
  }
});

test('I13 — tiers partition the whole deck of hands', { skip: !HAVE_MODEL }, () => {
  const s = P.solve(M, { pos: 'CO', node: 'rfi', v: 0.55 });
  const sum = Object.values(s.composition).reduce((a, b) => a + b, 0);
  assert.equal(sum, 270725);
});

test('the tier ribbon is 66 points with consistent boundary labels', { skip: !HAVE_MODEL }, () => {
  const state = { pos: 'CO', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO' };
  const r = P.ribbon(M, state, 'RUN2|SS');
  assert.equal(r.spans.length, 66);
  assert.equal(r.vs[0], 25);
  assert.equal(r.vs[65], 90);
  for (const b of r.boundaries) {
    assert.equal(r.spans[b.v - 25], b.to);
    assert.equal(r.spans[b.v - 26], b.from);
  }
  assert.ok(r.caption.length > 0 && r.text.length > 0);
});

test('the within-cell adjustment moves the score in the documented direction', { skip: !HAVE_MODEL }, () => {
  const c = M.cells['AA_DANGLER|RB'];
  const s = P.scoreCell(c, 'CO', 2.24, 0);
  assert.ok(P.handAdjust(s.S, c.adjMean + 6, c.adjMean) > s.S);
  assert.ok(P.handAdjust(s.S, c.adjMean - 6, c.adjMean) < s.S);
  assert.equal(P.handAdjust(s.S, c.adjMean, c.adjMean), s.S);
});

test('solve reports both the target width and the painted width', { skip: !HAVE_MODEL }, () => {
  const s = P.solve(M, { pos: 'UTG', node: 'rfi', v: 0.25 });
  assert.ok(near(s.targetWidth, P.widthFor('UTG', 'rfi', 0.25), 1e-12));
  assert.ok(s.width <= s.targetWidth + 1e-9, 'the nut gate can only narrow the painted range');
});

test('every cell carries a verdict line and at least one reason', { skip: !HAVE_MODEL }, () => {
  const state = { pos: 'CO', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO' };
  const s = P.solve(M, state);
  for (const k of Object.keys(s.cells)) {
    assert.ok(s.cells[k].reasons.length >= 1, k);
    const line = P.verdictLine(M, state, k, s);
    assert.ok(line.length > 10 && !line.includes('undefined'), `${k}: ${line}`);
  }
});

// ---------------------------------------------------------------------------
// V2-PLAN §3.1 — the stack-depth axis
// ---------------------------------------------------------------------------

test('the depth coordinate is exactly zero at the v1 operating point', () => {
  const D = P.CONSTANTS.depth;
  // Not `near`. Gate I22 asserts that the v2 pipeline paints v1's tiers, and every depth term
  // below is built on u(ref) being EXACTLY 0, so this is an equality test on purpose.
  assert.equal(P.depthU(D.ref), 0);
  assert.equal(P.depthU(undefined), 0);
  assert.equal(P.depthU(null), 0);
  assert.equal(P.depthU(NaN), 0);
  assert.equal(P.lambda(D.ref), 0);
  assert.equal(P.mu(D.ref), 0);
  // the endpoints are the constants' own values, to within the one ulp that 40/100 costs in binary
  assert.ok(near(P.depthU(D.min), -1, 1e-12) && P.depthU(D.max) === 1);
  assert.ok(near(P.lambda(D.max), D.lambda, 1e-12) && near(P.lambda(D.min), -D.lambda, 1e-12));
  assert.ok(near(P.mu(D.max), D.mu, 1e-12) && near(P.mu(D.min), -D.mu, 1e-12));
  // outside the slider's own domain the model has nothing to say, so d clamps like N_eff does
  assert.equal(P.depthU(5), P.depthU(D.min));
  assert.equal(P.depthU(5000), P.depthU(D.max));
});

test('every depth term is the exact identity at 100bb', () => {
  const D = P.CONSTANTS.depth, K = P.CONSTANTS.vs3bet;
  for (const nu of [0, 0.22, 0.42, 0.91, 1]) {
    for (const cooler of [0.25, 0.4, 0.5, null, undefined]) {
      assert.equal(P.mDeep(nu, cooler, D.ref), 1, `mDeep(${nu}, ${cooler})`);
      assert.equal(P.mDeep(nu, cooler), 1, 'and with no depth argument at all');
    }
  }
  for (const pos of P.POSITIONS) {
    assert.equal(P.baseRealization(pos, D.ref), P.CONSTANTS.baseR[pos]);
    assert.equal(P.realization(pos, 3.4, 0.5, D.ref), P.realization(pos, 3.4, 0.5));
  }
  assert.equal(P.nuCallAt(), K.nuCall);
  assert.equal(P.nuOOPAt(), K.nuOOP);
  assert.equal(P.fourBetAt(), K.fourBet);
  assert.equal(P.rakeRhoFactor(), 1);
  assert.equal(P.breakevenPrice(), K.breakeven);
  assert.equal(P.envOf(undefined), P.envOf({ d: 100, rakePct: 0, straddle: false }), 'the default env is a shared singleton');
});

test('scoreCell at the default environment is bit-identical to the v1 formula', { skip: !HAVE_MODEL }, () => {
  // The independent statement of I22's bit-identity: the v1 score expression, written out here
  // rather than imported, evaluated with Object.is against what the v2 pipeline produces. If a
  // future edit makes M_deep 0.9999999999999999 at 100bb instead of exactly 1, this fails here
  // with a name rather than 170,478 settings later as a moved tier.
  let checked = 0;
  for (const key of Object.keys(M.cells)) {
    const c = M.cells[key];
    if (!c.combos) continue;
    for (const pos of P.POSITIONS) {
      for (const N of [1, 2.24, 3, 4.7, 5.92, 7]) {
        for (const shift of [0, 0.037]) {
          let rho = P.rhoAt(c.rho, N);
          if (shift) rho -= shift * (1 - c.nu);
          const v1 = 100 * rho * (1 + P.kappa(N) * (c.nu - P.CONSTANTS.nuBar)) * c.mplay
            * (P.CONSTANTS.baseR[pos] * (1 - P.CONSTANTS.multiwayRealizationSlope * (N - 1) * (1 - c.nu)));
          assert.ok(Object.is(P.scoreCell(c, pos, N, shift).S, v1), `${key} ${pos} N=${N} shift=${shift}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 8000, `only ${checked} scores compared`);
});

test('lambda and mu are monotone in depth and signed as the plan states', () => {
  const D = P.CONSTANTS.depth;
  let prevL = -Infinity, prevM = -Infinity;
  for (let d = D.min; d <= D.max; d += 5) {
    assert.ok(P.lambda(d) >= prevL && P.mu(d) >= prevM, `not monotone at ${d}`);
    prevL = P.lambda(d); prevM = P.mu(d);
  }
  assert.ok(P.lambda(50) < 0, 'shallow: raw equity matters, nuttiness less');
  assert.ok(P.lambda(200) > 0 && P.mu(200) > 0);
  // and the two halves do what they say on a hand of each shape
  const nutty = P.mDeep(0.91, 0.276, 250), junky = P.mDeep(0.02, 0.501, 250);
  assert.ok(nutty > 1 && junky < 1, `M_deep deep: nutty ${nutty}, junk ${junky}`);
  assert.ok(P.mDeep(0.91, 0.276, 40) < 1 && P.mDeep(0.02, 0.501, 40) > 1, 'and both flip shallow');
  // a model that predates the cooler measurement keeps the lambda half and drops the mu half
  assert.equal(P.mDeep(0.7, null, 250), 1 + P.lambda(250) * (0.7 - P.CONSTANTS.nuBar));
});

test('the positional spread widens with depth without reordering the seats', () => {
  const D = P.CONSTANTS.depth;
  assert.ok(Math.abs(D.beta) < 1, 'the exponent 1+beta*u must stay positive or the seats invert');
  const order = [...P.POSITIONS].sort((a, b) => P.CONSTANTS.baseR[a] - P.CONSTANTS.baseR[b]);
  const spread = (d) => P.baseRealization(order[order.length - 1], d) - P.baseRealization(order[0], d);
  assert.ok(spread(D.max) > spread(D.ref) && spread(D.ref) > spread(D.min));
  for (const d of [D.min, 70, D.ref, 175, D.max]) {
    for (let i = 1; i < order.length; i++) {
      assert.ok(P.baseRealization(order[i], d) > P.baseRealization(order[i - 1], d), `seat order at ${d}bb`);
    }
  }
  // the power form leaves a seat with no edge alone and amplifies one that has an edge: that is
  // the property it was chosen over a lerp for
  const moved = (p) => Math.abs(P.baseRealization(p, D.max) - P.CONSTANTS.baseR[p]);
  assert.ok(moved('HJ') < moved('BTN') && moved('BTN') < moved('SB'));
});

test('the vs-3-bet depth terms move the shape, never the price', { skip: !HAVE_MODEL }, () => {
  const K = P.CONSTANTS.vs3bet;
  assert.equal(P.breakevenPrice({ d: 40 }), K.breakeven, 'the 29% price is a price, not a preference');
  assert.equal(P.breakevenPrice({ d: 250 }), K.breakeven);
  assert.ok(P.nuCallAt({ d: 250 }) > K.nuCall && P.nuCallAt({ d: 40 }) < K.nuCall);
  assert.ok(P.fourBetAt({ d: 250 }) > K.fourBet && P.fourBetAt({ d: 40 }) < K.fourBet);
  // nu ships to two decimals, so a floor that lands ON a hundredth is a coin flip for every cell
  // sitting exactly there. nuFloor = 0.015 puts all four endpoint floors on half-hundredths.
  const floors = [P.nuCallAt({ d: 40 }), P.nuCallAt({ d: 250 }), P.nuOOPAt({ d: 40 }), P.nuOOPAt({ d: 250 })];
  for (const f of floors) {
    for (const key of Object.keys(M.cells)) {
      const c = M.cells[key];
      if (!c.combos) continue;
      assert.ok(Math.abs(c.nu - f) > 0.004, `floor ${f} lands on ${key}'s nu ${c.nu}`);
    }
  }
});

test('the 4-bet bar has no shallow half, and the gap is why', { skip: !HAVE_MODEL }, () => {
  // Measured, and pinned so it is not re-discovered: every AA-row cell that can 4-bet measures at
  // least 54.3% against the default mix, 4.3 points clear of the 50% bar. Lowering the bar adds
  // nothing, so V2-PLAN §3.1's "shallower favours 4-bet" is not expressible through this threshold
  // on this grid. `depth.fourBet` is sized just past that gap for the deep half only.
  const AA = ['AA_BIGPAIR', 'AA_BROADWAY', 'AA_CONNECTED', 'AA_SMALLPAIR', 'AA_DANGLER'];
  const ems = Object.keys(M.cells)
    .filter((k) => M.cells[k].combos && AA.includes(k.split('|')[0]))
    .map((k) => P.eqMixOf(M.cells[k]));
  const lowest = Math.min(...ems);
  assert.ok(lowest > P.CONSTANTS.vs3bet.fourBet, 'every AA cell clears the bar at the operating depth');
  assert.ok(lowest > P.fourBetAt({ d: P.CONSTANTS.depth.min }), 'and still clears it at 40bb — nothing to add');
  assert.ok(P.fourBetAt({ d: P.CONSTANTS.depth.max }) > lowest, 'while the deep bar does bite');
});

test('an AA row that misses the 4-bet bar calls, it does not fold', { skip: !HAVE_MODEL }, () => {
  // The rung the depth term exposed. AA_DANGLER x RB is nu 0.22, far under every nut floor, so
  // before this it would have dropped straight through to FOLD at 250bb — aces at 54% into a 29%
  // price. The floors exist to keep speculative hands out of a 3-bet pot; AAxx is never that.
  for (const pos of P.POSITIONS) {
    const s = P.solve(M, { pos, node: '3bet', v: 0.55, limpers: 2, raiserPos: 'CO', d: 250 });
    const e = s.cells['AA_DANGLER|RB'];
    assert.ok(e.wouldBe !== 'T1', `at 250bb it is no longer a 4-bet (${pos})`);
    assert.ok(['T2', 'T3'].includes(e.wouldBe), `but it continues, not folds (${pos}: ${e.wouldBe})`);
  }
  const at100 = P.solve(M, { pos: 'CO', node: '3bet', v: 0.55, limpers: 2, raiserPos: 'CO' });
  assert.equal(at100.cells['AA_DANGLER|RB'].wouldBe, 'T1', 'and it is still a 4-bet at the v1 depth');
});

test('depth is in the solve and aggressive-set memo keys', { skip: !HAVE_MODEL }, () => {
  // A cache keyed on less than the state returns another environment's answer, which is a wrong
  // number rather than a crash. Interleave the calls so a missing key would be caught.
  const base = { pos: 'CO', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO' };
  const a1 = P.solve(M, { ...base, d: 40 });
  const b1 = P.solve(M, { ...base, d: 250 });
  const a2 = P.solve(M, { ...base, d: 40 });
  const mid = P.solve(M, base);
  assert.equal(a1.cells['AA_DANGLER|RB'].score, a2.cells['AA_DANGLER|RB'].score, 'stable under re-solve');
  assert.notEqual(a1.cells['AA_DANGLER|RB'].score, b1.cells['AA_DANGLER|RB'].score, '40bb != 250bb');
  assert.notEqual(a1.cells['AA_DANGLER|RB'].score, mid.cells['AA_DANGLER|RB'].score, '40bb != 100bb');
  assert.notEqual(P.envKey({ d: 40 }), P.envKey({ d: 250 }));
  assert.notEqual(P.envKey({ straddle: true }), P.envKey({ straddle: false }));
  assert.notEqual(P.envKey({ rakePct: 5 }), P.envKey({ rakePct: 0 }));
});

// ---------------------------------------------------------------------------
// V2-PLAN §3.2 (rake) and §3.3 (straddle). These REPLACE the inertness test that stood here while
// both were seams: the assertions changed, the coverage did not.
// ---------------------------------------------------------------------------

test('every knob is the exact identity at the v1 operating point', () => {
  const K = P.CONSTANTS.vs3bet;
  assert.equal(P.rakeFraction(), 0);
  assert.equal(P.rakeRhoFactor(), 1);
  assert.equal(P.breakevenPrice(), K.breakeven);
  assert.equal(P.callFloorAt(), K.call);
  assert.equal(P.straddleActive(), false);
  assert.equal(P.unitBB(), 1);
  assert.equal(P.effectiveDepth(), P.CONSTANTS.depth.ref);
  for (const pos of P.POSITIONS) {
    assert.equal(P.seatWidthFactor(pos), 1);
    assert.equal(P.widthFor(pos, 'rfi', 0.55, undefined), P.widthFor(pos, 'rfi', 0.55));
  }
  // and the env object still serialises to exactly the four axes the user set
  assert.deepEqual(JSON.parse(JSON.stringify(P.envOf({ d: 40, rakePct: 2, straddle: true }))),
    { d: 40, rakePct: 2, rakeCapBB: 3, straddle: true });
});

test('the rake fraction is min(pct, cap/pot), and the cap is the only absolute price', () => {
  const R = P.CONSTANTS.rake;
  const frac = (o) => P.rakeFraction(o);
  // below the knee the house takes its full percentage; above it, the cap
  assert.ok(near(frac({ rakePct: 2 }), 0.02, 1e-15));
  assert.ok(near(frac({ rakePct: R.preset }), R.capBB / R.potBB, 1e-15), 'the preset sits on the knee');
  assert.ok(near(frac({ rakePct: 6 }), R.capBB / R.potBB, 1e-15), 'past the knee the cap binds');
  assert.ok(near(frac({ rakePct: 5, rakeCapBB: 1 }), 1 / 60, 1e-15));
  assert.equal(frac({ rakePct: 5, rakeCapBB: 0 }), 0, 'a zero cap is a rake-free game');
  // the slider's domain clamps, the same discipline depthU applies
  assert.equal(frac({ rakePct: 99 }), frac({ rakePct: R.max }));
  assert.equal(frac({ rakePct: -3 }), 0);
  // §3.3: every threshold is a ratio and therefore scale-free — except the cap, which is quoted in
  // big blinds while the pot it caps is quoted in preflop units. A straddle doubles that unit.
  assert.equal(frac({ rakePct: R.preset, straddle: true }), frac({ rakePct: R.preset }) / 2);
  assert.equal(frac({ rakePct: 1, straddle: true }), frac({ rakePct: 1 }), 'below the knee the unit cannot matter');
});

test('the vs-3-bet price is exact arithmetic and the premium over it is invariant', () => {
  const K = P.CONSTANTS.vs3bet;
  const prem = K.call - K.breakeven;
  for (const rakePct of [0, 1, 2.5, 4, 5, 6]) {
    for (const straddle of [false, true]) {
      const e = P.envOf({ rakePct, straddle });
      const r = P.rakeFraction(e);
      // e = c / (P*(1-r)) = breakeven / (1-r): you call the same amount and collect a smaller pot
      assert.ok(near(P.breakevenPrice(e), K.breakeven / (1 - r), 1e-15), `price at ${rakePct}%`);
      // the 7 points are the model's opinion about playing a 3-bet pot out of position; the price
      // underneath them is arithmetic, so rake moves both by the same amount
      assert.ok(near(P.callFloorAt(e) - P.breakevenPrice(e), prem, 1e-12), `premium at ${rakePct}%`);
    }
  }
  assert.ok(P.breakevenPrice({ rakePct: 5 }) > K.breakeven && P.callFloorAt({ rakePct: 5 }) > K.call);
  // depth is not rake: V2-PLAN §3.1 is explicit that the price is a price
  assert.equal(P.breakevenPrice({ d: 40 }), K.breakeven);
  assert.equal(P.breakevenPrice({ d: 250, straddle: true }), K.breakeven);
});

test('rake is a flat haircut on rho, and therefore tier-inert at the percentile nodes',
  { skip: !HAVE_MODEL }, () => {
    // Not an accident and not a bug: V2-PLAN §3.2 specifies a multiplier common to every cell, and
    // a common multiplier scales every score, every interpolated cut and every margin by one
    // number. Gate I31 asserts this over the whole sweep; here it is stated once, in the small.
    const f = P.rakeRhoFactor({ rakePct: 5 });
    for (const node of ['rfi', 'limps', 'raise']) {
      for (const pos of P.POSITIONS) {
        if (P.positionDisabled(pos, node)) continue;
        const base = { pos, node, v: 0.55, limpers: 2, raiserPos: 'CO' };
        const a = P.solve(M, base), b = P.solve(M, { ...base, rakePct: 5 });
        for (const k of Object.keys(a.cells)) {
          assert.equal(b.cells[k].tier, a.cells[k].tier, `${node}/${pos} ${k} tier moved`);
          assert.equal(b.cells[k].rank, a.cells[k].rank, `${node}/${pos} ${k} rank moved`);
          assert.ok(near(b.cells[k].score, a.cells[k].score * f, 1e-9), `${node}/${pos} ${k} not scaled`);
        }
      }
    }
  });

test('rake folds marginal hands where the threshold is absolute', { skip: !HAVE_MODEL }, () => {
  // The vs-3-bet node is the one place the model cuts on a price rather than a percentile, so it is
  // the one place §3.2's "every marginal hand moves toward fold" can be true. Measured on the
  // ACTION tier, not the MIX overlay — a cell flickering into MIX has not changed the action.
  const live = (pct, pos) => {
    const s = P.solve(M, { pos, node: '3bet', v: 0.55, limpers: 2, raiserPos: 'CO', rakePct: pct });
    return Object.keys(s.cells).filter((k) => s.cells[k].wouldBe !== 'T5').length;
  };
  for (const pos of ['UTG', 'CO', 'BB']) {
    let prev = Infinity;
    for (let pct = 0; pct <= P.CONSTANTS.rake.max; pct++) {
      const n = live(pct, pos);
      assert.ok(n <= prev, `${pos}: ${pct}% continues with ${n} cells, more than ${prev}`);
      prev = n;
    }
    assert.ok(live(P.CONSTANTS.rake.max, pos) < live(0, pos), `${pos}: rake never bites`);
  }
});

test('the straddle is one fact — the preflop unit doubles — with three consequences', () => {
  const KS = P.CONSTANTS.straddle, D = P.CONSTANTS.depth;
  assert.equal(P.straddleActive({ straddle: true }), true);
  assert.equal(P.unitBB({ straddle: true }), KS.unit);
  // (1) depth, in preflop units, clamped to the slider's domain like every other depth
  for (const d of [40, 79, 80, 100, 150, 250]) {
    assert.equal(P.effectiveDepth({ d, straddle: true }),
      Math.min(D.max, Math.max(D.min, d / KS.unit)), `dEff at ${d}`);
    assert.equal(P.effectiveDepth({ d }), d);
  }
  assert.equal(P.effectiveDepth({ d: 60, straddle: true }), D.min, 'the depth half saturates below 80bb');
  // (2) one extra blind-like defender, behind every seat, at exactly cBlind(v)
  for (const v of [0.25, 0.55, 0.90]) {
    for (const node of ['rfi', 'limps', 'raise']) {
      for (const pos of P.POSITIONS) {
        if (P.positionDisabled(pos, node)) continue;
        const a = P.nEff({ pos, node, v, limpers: 2 }).raw;
        const b = P.nEff({ pos, node, v, limpers: 2, straddle: true }).raw;
        const want = node === 'raise' ? P.CONSTANTS.vsRaiseBlind * P.cBlind(v) : P.cBlind(v);
        assert.ok(near(b - a, want, 1e-12), `${node}/${pos}@${v}`);
      }
    }
  }
  assert.equal(P.nEff({ pos: 'CO', node: '3bet', v: 0.55, straddle: true }).raw,
    P.nEff({ pos: 'CO', node: '3bet', v: 0.55 }).raw, 'the vs-3-bet node is heads-up by construction');
  // (3) the opening bases, one seat tighter. `seat` is anchored to baseRaise's own UTG->HJ->CO
  // steps, so the constant must stay the reciprocal of their geometric mean.
  const B = P.CONSTANTS.baseRaise;
  assert.ok(near(KS.seat, 1 / Math.sqrt((B.HJ / B.UTG) * (B.CO / B.HJ)), 0.005),
    'seat is one seat of the model own ladder');
  for (const pos of P.POSITIONS) {
    const f = P.seatWidthFactor(pos, { straddle: true });
    assert.equal(f, KS.seatPinned.indexOf(pos) >= 0 ? 1 : KS.seat);
    assert.ok(near(P.widthFor(pos, 'rfi', 0.55, { straddle: true }), P.widthFor(pos, 'rfi', 0.55) * f, 1e-15));
  }
  // the vs-Raise 3-bet width has no seat base, so the transform has nothing to act on there
  assert.equal(P.widthFor('CO', 'raise', 0.55, { straddle: true }), P.widthFor('CO', 'raise', 0.55));
  // and the readouts quote big blinds, so they carry the unit
  const info = P.nEff({ pos: 'CO', node: 'rfi', v: 0.55, limpers: 2, straddle: true });
  const der = P.derived({ pos: 'CO', node: 'rfi', v: 0.55, limpers: 2, straddle: true }, info);
  assert.equal(der.unitBB, KS.unit);
  assert.equal(der.potBB, der.pot * KS.unit);
  assert.equal(P.derived({ pos: 'CO', node: 'rfi', v: 0.55, limpers: 2 }, info).potBB, 3.5);
});

test('the straddle tightens the opening range and makes it nuttier', { skip: !HAVE_MODEL }, () => {
  // Gate I26 over 5 seats x 5 VPIP x 6 depths; here at the settings the page opens on. The second
  // assertion is the one V2-PLAN §3.3 asked to be checked: lambda(d/2) < 0 fights the field effect
  // and loses. See I26(c) for the decomposition.
  for (const node of ['rfi', 'limps']) {
    for (const pos of P.POSITIONS) {
      if (P.positionDisabled(pos, node)) continue;
      for (const v of [0.25, 0.55, 0.90]) {
        const base = { pos, node, v, limpers: 2, raiserPos: 'CO' };
        const off = P.solve(M, base), on = P.solve(M, { ...base, straddle: true });
        assert.ok(on.width < off.width, `${node}/${pos}@${v} paints ${on.width} vs ${off.width}`);
        assert.ok(on.nutShare > off.nutShare, `${node}/${pos}@${v} nut share fell`);
      }
    }
  }
});

test('rake and straddle are in the memo keys and compose', { skip: !HAVE_MODEL }, () => {
  const base = { pos: 'CO', node: '3bet', v: 0.55, limpers: 2, raiserPos: 'CO' };
  assert.notEqual(P.envKey({ rakePct: 5 }), P.envKey({ rakePct: 0 }));
  assert.notEqual(P.envKey({ rakeCapBB: 2 }), P.envKey({ rakeCapBB: 3 }));
  assert.notEqual(P.envKey({ straddle: true }), P.envKey({ straddle: false }));
  // interleaved, so a cache keyed on less than the state would hand back the wrong environment
  const a1 = P.solve(M, base);
  const b1 = P.solve(M, { ...base, rakePct: 5 });
  const c1 = P.solve(M, { ...base, rakePct: 5, straddle: true });
  const a2 = P.solve(M, base);
  const b2 = P.solve(M, { ...base, rakePct: 5 });
  assert.equal(a1.continueWidth, a2.continueWidth);
  assert.equal(b1.continueWidth, b2.continueWidth);
  assert.ok(a1.continueWidth !== b1.continueWidth, 'rake reaches the vs-3-bet node');
  // and the composition is the cap: straddled, the same 5% takes half as much, so the price moves
  // less and more hands continue than at 5% unstraddled
  assert.ok(P.callFloorAt({ rakePct: 5, straddle: true }) < P.callFloorAt({ rakePct: 5 }));
  assert.ok(c1 !== b1);
});
