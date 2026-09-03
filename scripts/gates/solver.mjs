// gate I35 — solver quality, clauses (a)-(f), plus the two disclosure clauses with teeth.
//
// V3-PLAN §7.2's row reads: "solver quality: exploitability <= epsilon; strategies sum to 1; two
// independent seeds reach the same HU value within tolerance. Fails if convergence is
// abstraction-sensitive. 6-max scoped to fixed-point-only claims. Two disclosure clauses with
// teeth: the on-screen cap/sizing list must match the solver's actual tree, derived from shipped
// data; and whenever the equilibrium surface's payoff source is 'checkdown', the 'a game where
// postflop does not exist' label must render, derived from that shipped source datum, never prose."
//
// WHAT P2 CAN ASSERT AND WHAT IT CANNOT, decided rather than blurred. The catalog entry files I35
// under P3, because half of it is about a SHIPPED SURFACE — `data/equilibrium.json` and the page
// that renders it — and neither exists in P2. What exists in P2 is the engine. So:
//
//   (a) (b) (c) (d)  the solver-quality and 6-max clauses run against the engine, live, every run.
//   (e) (f)          the two disclosure clauses are written and ARMED now, and run over the zero
//                    surfaces that exist today, reporting "0 units" rather than passing quietly.
//
// That is not a weakened gate, it is I33 clause (g)'s idiom applied one phase earlier: payoff.mjs
// deliberately has no memo, so (g) shipped as a contract clause with a detector armed against
// fabricated violators, and it was a real gate on the day it was written. The detectors here live
// in `scripts/lib/cfr.mjs` and are exported, so `test/gates-solver.test.mjs` arms THE SAME CODE
// this gate runs rather than a re-implementation of it — the arming is worthless otherwise.
//
// WHY THE NUMBERS BELOW ARE NOT IN THIS FILE. Every threshold is imported from cfr.mjs, where it
// sits beside the S-A measurement that anchors it. A gate that types its own copy of a constant is
// a gate that can drift from the thing it gates; the same reason freeze-tiers.mjs, not verify.mjs,
// writes the tier fixtures. The two EXPECTATIONS this file does write out — the structural counts
// and the ladder — are written out deliberately, for the opposite reason: they are the independent
// copy, and re-deriving them from the module under test would assert nothing.
//
// COST. Six solves at the 2,000-iteration cap plus four payoff-matrix builds, measured at ~1.2 s on
// the reference machine against the registry's ~27.5 s wall and its 41.9 s soft ceiling.

import {
  EPSILON_BB, ITER_CAP, TWO_SEED_TOL_POT, PREFLOP_POT_BB, BLINDS, CAPS, CONSTANTS, SIXMAX,
  solveHU, buildTree, potLimitLadder, liveCells, multiwayProbe, simplexBound, mirrorBound,
  capListProblems, labelProblems, constantsBlockProblems, sixmaxDeferralProblems, labelFor,
  clearMatrixCache,
} from '../lib/cfr.mjs';
import * as CFR from '../lib/cfr.mjs';
import { makePayoff } from '../lib/payoff.mjs';

export const family = 'solver';
export const title = 'the CFR+ engine on the capped heads-up tree (I35)';
export const ids = ['I35'];
export const setupLabel = 'solve T100 and T40 at the iteration cap, three seeds each';

/**
 * The structural expectations, WRITTEN OUT rather than derived from the module.
 *
 * S-A's tree spec, independently: five decision nodes, nine terminals, 615 infosets over 123 cells,
 * 1,599 action slots split SB 861 / BB 738, and the pot-limit ladder 3 / 9 / 27 / 81 at 100bb. If
 * this gate computed these from `buildTree` it would be asking the tree whether it agrees with
 * itself. The 40bb row differs in exactly one rung — the cap becomes a genuine all-in at 40 — which
 * is the whole point of solving the pair.
 */
const EXPECT = Object.freeze({
  nodes: 5, terminals: 9, cells: 123, slotsPerCell: 13, sbSlotsPerCell: 7, bbSlotsPerCell: 6,
  ladder100: Object.freeze([3, 9, 27, 81]),
  ladder40: Object.freeze([3, 9, 27, 40]),
});

/** a payoff source that is deliberately sensitive to `opts.seed` — clause (c)'s fabricated violator */
function seedSensitive(base) {
  const f = (cells, pot, spr, opts) => {
    const r = base(cells, pot, spr, opts);
    const s = opts && opts.seed ? Number(opts.seed) : 0;
    if (!s || !r.supported) return r;
    // a seed-dependent tilt, bounded so `ev` stays a legal share
    const tilt = ((s % 7) + 1) * 0.01;
    return { ...r, ev: Math.min(1, Math.max(0, r.ev + tilt)) };
  };
  f.modelHash = base.modelHash;
  return f;
}

/** a payoff source that answers multiway requests as supported and constant-sum — clause (d)'s violator */
function multiwaySupported(base) {
  const f = (cells, pot, spr, opts) => {
    const r = base(cells, pot, spr, opts);
    if (!Array.isArray(cells) || cells.length <= 2) return r;
    return { ...r, ev: 1 / cells.length, supported: true, source: 'model' };
  };
  f.modelHash = base.modelHash;
  return f;
}

export function build(ctx) {
  const { model, G } = ctx;

  // ---- setup: the solves. Two depths, three seeds each; seed 0 is the canonical (unperturbed)
  // start, and the two non-zero seeds are the `init` axis of TWO_SEED_AXES.
  const payoff = makePayoff(model);
  const live = liveCells(payoff, model);
  const SEEDS = [0, 1, 99991];
  const runs = {};
  for (const stack of [100, 40]) {
    runs[stack] = SEEDS.map((seed) => solveHU({
      model, stack, iters: ITER_CAP, seed, payoff, trackFlips: seed === 0,
    }));
  }
  const probe = multiwayProbe(payoff, live);

  return {
    sections: [
      { ids: ['I35'], label: 'CFR+ quality, the 6-max deferral, and the two disclosure clauses', run: () => {
        const bad = [];

        // ================================================================================
        // (a) EXPLOITABILITY <= EPSILON, and epsilon <= the payoff's own se
        // ================================================================================
        // The first half is the shipped claim. The second is §6's rule — "epsilon <= the payoff's
        // own se; solving tighter than the payoff's error is fake precision" — asserted rather than
        // recited: the accessor's own `se` is read back, converted at the TIGHTEST pot (the 1.5bb
        // preflop pot, S-A's own grading normaliser, because any larger one makes the bar easier),
        // and epsilon must sit under it. A future payoff quiet enough to break this forces epsilon
        // DOWN; it can never be satisfied by widening.
        let minSe = Infinity, maxSe = 0;
        for (let i = 0; i < live.length; i++) {
          for (let j = 0; j < live.length; j++) {
            const r = payoff([live[i], live[j]], PREFLOP_POT_BB, 1, { ip: true, seed: 0 });
            if (Number.isFinite(r.se)) { if (r.se < minSe) minSe = r.se; if (r.se > maxSe) maxSe = r.se; }
          }
        }
        const seFloorBB = minSe * PREFLOP_POT_BB;
        if (!(EPSILON_BB <= seFloorBB)) {
          bad.push(`(a) epsilon ${EPSILON_BB.toExponential(2)} bb exceeds the payoff's own se floor `
            + `${seFloorBB.toExponential(2)} bb (${minSe.toExponential(2)} of a ${PREFLOP_POT_BB}bb pot) — `
            + 'solving tighter than the payoff\'s error is fake precision (V3-PLAN §6)');
        }
        let worstEps = 0;
        for (const stack of [100, 40]) {
          for (const r of runs[stack]) {
            if (r.eps > worstEps) worstEps = r.eps;
            if (!(r.eps <= EPSILON_BB)) {
              bad.push(`(a) T${stack} seed ${r.seed}: exploitability ${r.eps.toExponential(3)} bb exceeds `
                + `epsilon ${EPSILON_BB.toExponential(2)} bb at the ${ITER_CAP}-iteration cap`);
            }
            if (!r.bracketOk) {
              bad.push(`(a) T${stack} seed ${r.seed}: the best-response bracket BR_SB >= v >= -BR_BB fails `
                + `(${r.brSB} / ${r.value} / ${-r.brBB}) — the exploitability arithmetic has a sign error, `
                + 'and a small epsilon means nothing if the value it brackets is wrong');
            }
          }
        }
        // ARMED: a deliberately under-solved run must breach the same clause.
        const stunted = solveHU({ model, stack: 100, iters: 13, seed: 0, payoff });
        const aFires = stunted.eps > EPSILON_BB;
        if (!aFires) {
          bad.push('(a) the clause is not armed: a 13-iteration solve reported exploitability '
            + `${stunted.eps.toExponential(3)} bb, which is already inside epsilon — the bar cannot fail`);
        }

        // ================================================================================
        // (b) STRATEGIES SUM TO 1
        // ================================================================================
        // Against the ACCUMULATION BOUND, not a round number: N normalised terms accumulate at most
        // N roundings of half an ulp, so `N * EPSILON` is an arithmetic fact about IEEE addition.
        // The clause also rejects any probability outside [0,1], which is the failure a bare sum
        // check misses — two errors that cancel still sum to 1.
        const simplexCap = simplexBound(3);
        let worstSimplex = 0;
        for (const stack of [100, 40]) {
          for (const r of runs[stack]) {
            if (r.simplexError > worstSimplex) worstSimplex = r.simplexError;
            if (!(r.simplexError <= simplexCap)) {
              bad.push(`(b) T${stack} seed ${r.seed}: worst |sum of an infoset's probabilities - 1| is `
                + `${r.simplexError.toExponential(3)}, over the ${simplexCap.toExponential(3)} accumulation bound `
                + '(Infinity means a probability left [0,1] entirely)');
            }
          }
        }

        // ================================================================================
        // (c) TWO INDEPENDENT SEEDS REACH THE SAME HU VALUE
        // ================================================================================
        // Two axes, only one of which is live today, and the gate says which — see TWO_SEED_AXES.
        const tolBB = TWO_SEED_TOL_POT * PREFLOP_POT_BB;
        const spreads = {};
        for (const stack of [100, 40]) {
          const vs = runs[stack].map((r) => r.value);
          const spread = Math.max(...vs) - Math.min(...vs);
          spreads[stack] = spread;
          if (!(spread <= tolBB)) {
            bad.push(`(c/init) T${stack}: the value spread over seeds ${runs[stack].map((r) => r.seed).join('/')} `
              + `is ${spread.toExponential(3)} bb = ${(100 * spread / PREFLOP_POT_BB).toFixed(4)}% of pot, over the `
              + `${(100 * TWO_SEED_TOL_POT).toFixed(2)}% gate — convergence is initialisation-sensitive`);
          }
        }
        // the payoff axis: S-A's own reading of the clause. Under a checkdown source the accessor is
        // seed-inert, so this is CHECKED rather than assumed — if the matrices are bit-identical the
        // spread is exactly 0 for a stated reason; if they are not, the two runs are compared.
        const mA = runs[100][0].matrices.byNode.n5.net;
        clearMatrixCache();
        const payoffSeeded = solveHU({ model, stack: 100, iters: ITER_CAP, seed: 4242, payoff });
        let payoffAxisInert = mA.length === payoffSeeded.matrices.byNode.n5.net.length;
        if (payoffAxisInert) {
          const mB = payoffSeeded.matrices.byNode.n5.net;
          for (let z = 0; z < mA.length; z++) if (mA[z] !== mB[z]) { payoffAxisInert = false; break; }
        }
        const payoffSpread = Math.abs(runs[100][0].value - payoffSeeded.value);
        if (!payoffAxisInert && !(payoffSpread <= tolBB)) {
          bad.push(`(c/payoff) T100: two payoff samples give values ${payoffSpread.toExponential(3)} bb apart = `
            + `${(100 * payoffSpread / PREFLOP_POT_BB).toFixed(4)}% of pot, over the `
            + `${(100 * TWO_SEED_TOL_POT).toFixed(2)}% gate`);
        }
        // ARMED: a fabricated seed-SENSITIVE source must breach the payoff axis. This is the clause
        // becoming real the day a source is 'simulated', proved today rather than promised.
        clearMatrixCache();
        const sens = seedSensitive(payoff);
        const sA = solveHU({ model, stack: 100, iters: 256, seed: 1, payoff: sens });
        const sB = solveHU({ model, stack: 100, iters: 256, seed: 2, payoff: sens });
        clearMatrixCache();
        const cFires = Math.abs(sA.value - sB.value) > tolBB;
        if (!cFires) {
          bad.push('(c) the payoff axis is not armed: a deliberately seed-sensitive source moved the value '
            + `by only ${Math.abs(sA.value - sB.value).toExponential(3)} bb, inside the gate`);
        }

        // ================================================================================
        // (d) 6-MAX: THE DEFERRAL, GATED BY ITS OWN EVIDENCE
        // ================================================================================
        // §3.3 greenlights 6-max MCCFR on the budget criterion and S-A cleared it by 5,400x, so this
        // clause is NOT "6-max was too slow". The deferral rests on the payoff's domain, measured
        // live, and the gate FAILS if any of the three facts stops holding — so the day a source
        // makes multiway supported and constant-sum, the decision is forced back open instead of
        // being inherited. The module exporting no 6-max solver is the other half of the same claim.
        const hasSolver = typeof CFR.solveSixMax === 'function' || typeof CFR.mccfr === 'function';
        for (const why of sixmaxDeferralProblems(probe, hasSolver)) bad.push(`(d) ${why}`);
        if (SIXMAX.status !== 'deferred') {
          bad.push(`(d) SIXMAX.status is '${SIXMAX.status}' — this clause only knows how to check a deferral`);
        }
        if (!/fixed-point-only/.test(SIXMAX.claimScope)) {
          bad.push('(d) SIXMAX no longer scopes its claims to fixed-point-only, which is the one thing '
            + '§7.2 requires of anything multiway');
        }
        // ARMED: a source that answers multiway as supported and constant-sum must break the deferral.
        const dFires = sixmaxDeferralProblems(
          multiwayProbe(multiwaySupported(payoff), live), false).length > 0;
        const dClears = sixmaxDeferralProblems(probe, false).length === 0;
        const dSolver = sixmaxDeferralProblems(probe, true).length > 0;
        if (!(dFires && dClears && dSolver)) {
          bad.push(`(d) the deferral clause is not armed: supported-multiway source flagged ${dFires}, `
            + `today's payoff cleared ${dClears}, a present solver flagged ${dSolver}`);
        }

        // ================================================================================
        // (e) THE CAP/SIZING LIST MUST MATCH THE SOLVER'S ACTUAL TREE
        // ================================================================================
        // The structural half runs today against the tree the solver walked. The on-screen half has
        // no units yet — P2 ships no equilibrium surface — and says so below rather than passing
        // quietly. The SIZINGS are checked separately and differently, because §6's measured block
        // upgraded them from "flagged" to an arithmetic identity: they are RE-DERIVED here from the
        // pot-limit rule, and the derivation is made three independent times — `potLimitLadder`,
        // this clause's `EXPECT` literal, and a second loop written out in `test/cfr.test.mjs`.
        //
        // WHAT THAT DOES AND DOES NOT CATCH, corrected by the P2 red team (docs/refutations/P2.md).
        // This comment used to end "so a typed sizing anywhere in the tree fails this clause", and
        // three refuters refuted it the same way: replace `potLimitLadder`'s derivation with a
        // literal `[3, 9, 27, 81]` behind the same stack cap and everything stays green, because a
        // re-derivation and a typed table that agree are indistinguishable by any check of VALUES.
        // What is actually enforced — and it is the stronger half — is the VALUES themselves, three
        // ways over: misstate the pot-limit rule (drop `toCall` from the raise-to) and four
        // assertions fail at once; move the big blind to 2 and six do; grow the tree a limp and the
        // cap-list clause fires. So the honest sentence is "a sizing that is not the pot-limit
        // maximum fails here", which is what the identity claim needs and all this clause ever
        // checked. A typed table that equals the identity is not a violation; it is the identity,
        // spelled badly.
        for (const [stack, want] of [[100, EXPECT.ladder100], [40, EXPECT.ladder40]]) {
          const tree = buildTree(stack);
          if (tree.sizings.join('/') !== want.join('/')) {
            bad.push(`(e) T${stack}: the tree's sizings are ${tree.sizings.join('/')}, not the pot-limit `
              + `maximum ladder ${want.join('/')} — the sizing set is supposed to be an arithmetic identity`);
          }
          const rungs = potLimitLadder(stack).map((r) => r.to);
          if (rungs.join('/') !== want.join('/')) {
            bad.push(`(e) T${stack}: the pot-limit rule re-derives ${rungs.join('/')}, not ${want.join('/')}`);
          }
          if (tree.nodes.length !== EXPECT.nodes || tree.terminals !== EXPECT.terminals) {
            bad.push(`(e) T${stack}: ${tree.nodes.length} decision nodes and ${tree.terminals} terminals, `
              + `expected ${EXPECT.nodes} and ${EXPECT.terminals}`);
          }
          if (tree.slotsPerCell !== EXPECT.slotsPerCell) {
            bad.push(`(e) T${stack}: ${tree.slotsPerCell} action slots per cell, expected ${EXPECT.slotsPerCell}`);
          }
          const sbSlots = tree.nodes.filter((n) => n.actor === 'SB').reduce((s, n) => s + n.actions.length, 0);
          const bbSlots = tree.nodes.filter((n) => n.actor === 'BB').reduce((s, n) => s + n.actions.length, 0);
          if (sbSlots !== EXPECT.sbSlotsPerCell || bbSlots !== EXPECT.bbSlotsPerCell) {
            bad.push(`(e) T${stack}: slots split SB ${sbSlots} / BB ${bbSlots}, expected `
              + `${EXPECT.sbSlotsPerCell} / ${EXPECT.bbSlotsPerCell}`);
          }
          for (const why of capListProblems([...CAPS.omitted], tree)) bad.push(`(e) T${stack}: ${why}`);
        }
        if (live.length !== EXPECT.cells) {
          bad.push(`(e) the abstraction has ${live.length} live cells, expected ${EXPECT.cells}`);
        }
        // the blinds are the game's definition; a moved blind silently moves the whole ladder
        if (!(BLINDS.sb === 0.5 && BLINDS.bb === 1)) {
          bad.push(`(e) the blinds are ${BLINDS.sb}/${BLINDS.bb}, not 0.5/1.0 — every rung of the ladder moves with them`);
        }
        // the on-screen half: zero units today, counted rather than skipped
        const screenLists = [];              // P3 appends the shipped surface's list here
        for (const [where, list] of screenLists) {
          for (const why of capListProblems(list, buildTree(100))) bad.push(`(e) ${where}: ${why}`);
        }
        // ARMED, four ways now: a list that drops an omission, one that invents a cap, a tree that
        // grew an action the list still denies, and — the P2 red team's finding
        // (docs/refutations/P2.md) — a DECLARATION with an omission deleted out of it. That fourth
        // one used to be invisible: the tree-derived half was guarded by the very entry being
        // deleted, so removing "no SB limp" from CAPS.omitted also removed the check written to
        // catch the tree growing an SB limp, and the audit passed on a tree that had one.
        const eDrops = capListProblems(CAPS.omitted.filter((c) => !/postflop/.test(c)), null).length === 1;
        const eInvents = capListProblems([...CAPS.omitted, 'no straddle'], null).length === 1;
        const limpTree = { nodes: [{ actions: ['fold', 'call', 'raise'] }, {}, {}, {}, { actions: ['fold', 'call'] }] };
        const eStale = capListProblems([...CAPS.omitted], limpTree).length === 1;
        const eClears = capListProblems([...CAPS.omitted], buildTree(100)).length === 0;
        const thinned = CAPS.omitted.filter((c) => !/limp/i.test(c));
        const eUndeclared = capListProblems([...thinned], buildTree(100), thinned)
          .some((w) => /nothing declares that omission/.test(w));
        // and the deletion must no longer be able to DISARM the stale-vs-tree half: a list still
        // denying the limp, over a tree that has one, while the DECLARATION has been thinned — the
        // exact combination that used to return nothing at all
        const eStillStale = capListProblems([...CAPS.omitted], limpTree, thinned)
          .some((w) => /still claims there is none/.test(w));
        if (!(eDrops && eInvents && eStale && eClears && eUndeclared && eStillStale)) {
          bad.push(`(e) the cap-list detector is not armed: dropped omission flagged ${eDrops}, `
            + `invented cap flagged ${eInvents}, stale-vs-tree flagged ${eStale}, true list cleared `
            + `${eClears}, an omission deleted from the DECLARATION flagged ${eUndeclared}, and that `
            + `deletion no longer silences the tree-derived half ${eStillStale}`);
        }

        // ================================================================================
        // (f) THE CHECKDOWN LABEL, DERIVED FROM `source` AND NEVER FROM `supported`
        // ================================================================================
        // The Grade-C guard, and the reason it is load-bearing rather than defensive: this
        // equilibrium is BB-POSITIVE — the button LOSES — and a reader shown that without the label
        // is shown a lie. §2's phase-0 annotation names the trap, and this tree is exactly where it
        // springs: every heads-up showdown here is `supported:true`, so a label keyed off
        // `supported` renders no caveat at all.
        for (const stack of [100, 40]) {
          const r = runs[stack][0];
          for (const why of labelProblems(r)) bad.push(`(f) T${stack}: ${why}`);
          if (r.source === 'checkdown' && r.unsupported !== 0) {
            bad.push(`(f) T${stack}: ${r.unsupported} heads-up returns came back unsupported — the label `
              + 'clause assumes the HU domain is supported, and that assumption just failed');
          }
        }
        // ARMED: the `supported`-keyed label is the fabricated violator, and it is the REAL one —
        // `supported` is true here, so keying off it produces a null label over a checkdown game.
        const fSupportedKeyed = labelProblems({ source: 'checkdown', supported: true, label: null }).length === 1;
        const fSourceKeyed = labelProblems({ source: 'checkdown', label: labelFor('checkdown') }).length === 0;
        const fStale = labelProblems({ source: 'model', label: labelFor('checkdown') }).length === 1;
        if (!(fSupportedKeyed && fSourceKeyed && fStale)) {
          bad.push(`(f) the label detector is not armed: supported-keyed flagged ${fSupportedKeyed}, `
            + `source-keyed cleared ${fSourceKeyed}, stale label on a model source flagged ${fStale}`);
        }

        // ================================================================================
        // correctness invariants that make the clauses above mean something
        // ================================================================================
        let worstMirror = 0;
        for (const stack of [100, 40]) {
          const r = runs[stack][0];
          const potMax = r.tree.L[5] * 2;
          const cap = mirrorBound(potMax);
          if (r.mirrorMax > worstMirror) worstMirror = r.mirrorMax;
          if (!(r.mirrorMax <= cap)) {
            bad.push(`(zero-sum) T${stack}: the worst |netSB + netBB| over both orderings is `
              + `${r.mirrorMax.toExponential(3)} bb, over the ${cap.toExponential(3)} accumulation bound — the `
              + 'solver mirrors the matrix, so an asymmetry this large is being laundered into the fixed point');
          }
          if (r.unsupported !== 0) {
            bad.push(`(domain) T${stack}: ${r.unsupported} of the heads-up payoff requests were unsupported`);
          }
          if (r.matrices.shapeBad !== 0) {
            bad.push(`(domain) T${stack}: ${r.matrices.shapeBad} payoff returns were missing a contracted key`);
          }
        }
        // the constants block: zero on disk today (P2 does not regenerate the model), armed anyway
        const constantsUnits = [];           // P3 appends model.constants.solver here
        for (const [where, block] of constantsUnits) {
          for (const why of constantsBlockProblems(block)) bad.push(`(constants) ${where}: ${why}`);
        }
        const good = Object.create(null);
        for (const c of CONSTANTS) good[c.name.slice(c.name.indexOf('.') + 1)] = c.value;
        const kClears = constantsBlockProblems(good).length === 0;
        /* the drift is DERIVED FROM THE CONSTANT rather than typed beside it — a P2 red-team
           finding (docs/refutations/P2.md): the fabrication used to be a literal 1e-3, so a
           refuter loosening EPSILON_BB to exactly 1e-3 made the "drift" equal the real value and
           silently collapsed this arming, and I35 then failed for a reason that had nothing to do
           with the perturbation. A fabricated violator that can coincide with the truth is not a
           violator. Doubling cannot coincide with anything. */
        const kDrift = constantsBlockProblems({ ...good, epsilonBB: good.epsilonBB * 2 }).length === 1;
        const kMissing = constantsBlockProblems({}).length === CONSTANTS.length;
        if (!(kClears && kDrift && kMissing)) {
          bad.push(`(constants) the block detector is not armed: agreeing block cleared ${kClears}, `
            + `drifted value flagged ${kDrift}, empty block flagged ${kMissing}`);
        }

        // ================================================================================
        // the verdict
        // ================================================================================
        const r100 = runs[100][0], r40 = runs[40][0];
        const detail = bad.length ? bad.join(' · ')
          : `(a) exploitability at the ${ITER_CAP}-iteration cap: worst ${worstEps.toExponential(2)} bb over `
            + `${SEEDS.length} seeds x 2 depths, against epsilon ${EPSILON_BB.toExponential(0)} bb `
            + `(S-A: out-of-sample floor 5.16e-5) — itself under the payoff's own se floor `
            + `${seFloorBB.toExponential(2)} bb, which is §6's "never tighter than the payoff's error" as an `
            + `assertion rather than a sentence; a 13-iteration solve breaches it at `
            + `${stunted.eps.toExponential(2)} bb, so the bar can fail. `
            + `(b) worst simplex error ${worstSimplex.toExponential(2)} against the `
            + `${simplexCap.toExponential(2)} accumulation bound (N*EPSILON, arithmetic, not a tolerance). `
            + `(c) TWO AXES: init-seed spread T100 ${(100 * spreads[100] / PREFLOP_POT_BB).toFixed(4)}% / T40 `
            + `${(100 * spreads[40] / PREFLOP_POT_BB).toFixed(4)}% of pot against the `
            + `${(100 * TWO_SEED_TOL_POT).toFixed(2)}% gate (S-A measured 0.035% across payoff samples); the `
            + `PAYOFF axis is ${payoffAxisInert ? 'INERT today — the checkdown source ignores opts.seed, so the '
              + 'two samples are bit-identical and the spread is exactly 0 for a stated reason, CHECKED not '
              + 'assumed' : `live, spread ${(100 * payoffSpread / PREFLOP_POT_BB).toFixed(4)}% of pot`} — a `
            + `fabricated seed-sensitive source moves the value ${Math.abs(sA.value - sB.value).toExponential(2)} bb, `
            + `so the clause has teeth the day a source is 'simulated'. `
            + `(d) 6-MAX DEFERRED, and the deferral is gated by its own evidence, not by prose: the budget `
            + `criterion was MET (S-A, 5,400x inside the half-budget), so the reason is the payoff domain — `
            + `over ${probe.tuples} six-handed tuples, ${probe.supportedCount} of ${probe.tuples * probe.seats} `
            + `returns were supported, the shares miss 1 by up to ${probe.worstShareDev.toFixed(3)}, and hero's `
            + `share is ${probe.opponentInvariant ? 'BIT-IDENTICAL across disjoint opponent sets' : 'opponent-dependent'} `
            + `— a fixed point of that is not a fixed point of six-max PLO. If any of the three flips, this `
            + `clause fails and the decision is re-made. `
            + `(e) the ladder is RE-DERIVED from the pot-limit rule, not read back: T100 ${EXPECT.ladder100.join('/')} `
            + `and T40 ${EXPECT.ladder40.join('/')} (one rung apart — at 40bb the cap is a genuine all-in), `
            + `${EXPECT.nodes} nodes, ${EXPECT.terminals} terminals, ${live.length} cells, `
            + `${live.length * EXPECT.nodes} infosets, ${live.length * EXPECT.slotsPerCell} slots `
            + `(SB ${live.length * EXPECT.sbSlotsPerCell} / BB ${live.length * EXPECT.bbSlotsPerCell}) — so a sizing `
            + `that is NOT the pot-limit maximum fails here, in any of three independent derivations `
            + `(a typed table equal to the identity is not caught, and is not a violation — P2 red team, `
            + `docs/refutations/P2.md); ${CAPS.omitted.length} declared omissions match the tree; `
            + `${screenLists.length} on-screen lists exist to check (P2 ships no equilibrium surface — the `
            + `detector is armed four ways against fabricated ones). `
            + `(f) source '${r100.source}' -> label ${JSON.stringify(r100.label)}, derived from the source datum; `
            + `a label keyed off \`supported\` is the armed violator and it is the real trap here, because all `
            + `${live.length * live.length} heads-up returns ARE supported. `
            + `VALUE: T100 ${r100.value.toFixed(6)} bb to SB, T40 ${r40.value.toFixed(6)} — BB-POSITIVE at both `
            + `depths, which is what "postflop does not exist" looks like (SB opens `
            + `${(100 * r100.frequencies.sbOpen).toFixed(2)}%, BB folds `
            + `${(100 * r100.frequencies.bbFoldVsOpen).toFixed(4)}% against a 3bb open). Argmaxes last flipped at `
            + `iteration ${r100.lastFlip} of ${ITER_CAP} — CFR+, not CFR, which S-A measured still flipping at `
            + `99,467. Mirror residual ${worstMirror.toExponential(2)} bb; ${constantsUnits.length} shipped `
            + `constants blocks to check (P3 stamps the first).`;
        G('I35', bad.length === 0, detail);
      } },
    ],
  };
}
