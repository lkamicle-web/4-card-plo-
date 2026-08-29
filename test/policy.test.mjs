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
