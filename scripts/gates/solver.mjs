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
// COST. Eight solves at the 2,000-iteration cap — three init seeds x two depths on each of the two
// payoff routes, plus the payoff axis's second matrix at each depth — measured at ~1.2 s on the
// reference machine against the registry's ~27.5 s wall and its 41.9 s soft ceiling. The matrices
// themselves cost nothing here: they are a SHIPPED ARTIFACT read once per process by the payoff
// family earlier in the run (V3-PLAN §3.3's `Adjudicated (P3 relaunch)` block).

import {
  EPSILON_BB, ITER_CAP, TWO_SEED_TOL_POT, PREFLOP_POT_BB, BLINDS, CAPS, CONSTANTS, SIXMAX,
  solveHU, buildTree, potLimitLadder, liveCells, multiwayProbe, simplexBound, mirrorBound,
  capListProblems, labelProblems, constantsBlockProblems, sixmaxDeferralProblems, labelFor,
  clearMatrixCache,
} from '../lib/cfr.mjs';
import * as CFR from '../lib/cfr.mjs';
import { makePayoff, makeMatrixPayoff } from '../lib/payoff.mjs';
import { shippedMatrices, SEEDS, BOARDS } from '../lib/checkdown-matrix.mjs';
import { shippedSurfaces } from '../lib/equilibrium.mjs';
import { aceFloor } from './payoff.mjs';

export const family = 'solver';
export const title = 'the CFR+ engine on the capped heads-up tree (I35)';
export const ids = ['I35'];
export const setupLabel = 'solve T100 and T40 at the iteration cap, three seeds each, on BOTH payoff routes';

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

/**
 * S-A's own solve of the same construction, at the same 400,000 boards — THE REPRODUCTION CHECK'S
 * REFERENCE, and nothing else.
 *
 * It is quoted, never applied: no clause reads it, no tolerance is derived from it, and moving a
 * digit here cannot make a failing run pass. It exists so the detail line's deltas are COMPUTED
 * from the run rather than typed into prose — the first B2 run typed "1.3e-3 bb / 0.45 pt /
 * 0.002 pt", which was true of a 25,000-board matrix and became a lie the moment the board count
 * moved. A number a gate prints about itself has to be derived, or it is a claim about a past run
 * wearing this run's timestamp.
 */
const SA_REPRO = Object.freeze({ value: -0.1418, sbOpen: 0.893, bbFold: 0.0016, boards: 400000 });

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

  // ---- setup: the solves. Two depths, three INIT seeds each, on BOTH payoff routes.
  //
  // Seed 0 is the canonical (unperturbed) start and the two non-zero seeds are the `init` axis of
  // TWO_SEED_AXES. BOTH ROUTES ARE SOLVED, not one instead of the other, and the reason is
  // specific: the projection stub remains the PAGE's accessor source (D10, V3-PLAN §3.3's
  // Adjudicated block), and `test/gates-solver.test.mjs` arms clause (a) through a fabricated model
  // claiming 1e14 trials per cell — an arming that only bites through the stub's `meta.trials`-
  // derived `se`, because the matrix's `se` comes from its own sample counts and is blind to it.
  // Solving only the matrix would silently disarm that test.
  const payoff = makePayoff(model);
  const live = liveCells(payoff, model);
  const INIT_SEEDS = [0, 1, 99991];
  const runs = {};
  for (const stack of [100, 40]) {
    runs[stack] = INIT_SEEDS.map((seed) => solveHU({
      model, stack, iters: ITER_CAP, seed, payoff, trackFlips: seed === 0,
    }));
  }

  /* THE MATRIX ROUTE — P3's baseline source, and what barrier B2 was about (V3-PLAN §3.3's
     Adjudicated block, decision 9). The pair is built once per process by `shippedMatrices`, and
     the payoff family has already paid for it earlier in this run, so this costs the solves only.
     `payoffSeed` is pinned to matrix A here so the INIT axis below is measured against one fixed
     payoff; the PAYOFF axis then moves it to B with the init seed held at 0. Threading one seed
     into both would confound the two axes — and a string seed would additionally collapse
     `initTables` to x = 1. */
  const MATRICES = shippedMatrices();
  const payoffM = makeMatrixPayoff(model, MATRICES);
  const liveM = liveCells(payoffM, model);
  const runsM = {};
  for (const stack of [100, 40]) {
    runsM[stack] = INIT_SEEDS.map((seed) => solveHU({
      model, stack, iters: ITER_CAP, seed, payoffSeed: SEEDS[0], payoff: payoffM, trackFlips: seed === 0,
    }));
  }
  const payoffAxis = {};
  for (const stack of [100, 40]) {
    payoffAxis[stack] = solveHU({
      model, stack, iters: ITER_CAP, seed: 0, payoffSeed: SEEDS[1], payoff: payoffM,
    });
  }
  const probe = multiwayProbe(payoff, live);
  const probeM = multiwayProbe(payoffM, liveM);

  /* THE SHIPPED SURFACES the two disclosure clauses read, gathered ONCE — the on-disk artifacts and
     the built pages. `opts.surfaces` is the override seam test/gates-solver.test.mjs drives the
     failure branches through, the same seam I22/I32 use for `opts.tierFixture` and D10/D11 for
     `opts.artifacts`, and for the same reason: a clause whose only input is a file the build just
     wrote cannot be shown to FAIL. */
  const SURFACES = (ctx.opts && ctx.opts.surfaces) || shippedSurfaces();

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
        // THE FLOOR IS THE MIN OVER BOTH ROUTES (P3 B2). Two sources now feed this solver and the
        // binding one is whichever is QUIETER: epsilon must sit under the error bar of every payoff
        // the solver actually consumes, not under the loudest one. The matrix's `se` derives from
        // its own per-pair sample counts (~7,100, so ~6e-3 of the pot) and the stub's from
        // `meta.trials.cell`, so the two are genuinely different numbers rather than two readings
        // of one.
        const seFloorOf = (fn, keys) => {
          let lo = Infinity, hi = 0;
          for (let i = 0; i < keys.length; i++) {
            for (let j = 0; j < keys.length; j++) {
              const r = fn([keys[i], keys[j]], PREFLOP_POT_BB, 1, { ip: true, seed: 0 });
              if (Number.isFinite(r.se)) { if (r.se < lo) lo = r.se; if (r.se > hi) hi = r.se; }
            }
          }
          return { lo, hi };
        };
        const seStub = seFloorOf(payoff, live);
        const seMatrix = seFloorOf(payoffM, liveM);
        const minSe = Math.min(seStub.lo, seMatrix.lo);
        const maxSe = Math.max(seStub.hi, seMatrix.hi);
        const seFloorBB = minSe * PREFLOP_POT_BB;
        if (!(EPSILON_BB <= seFloorBB)) {
          bad.push(`(a) epsilon ${EPSILON_BB.toExponential(2)} bb exceeds the payoff's own se floor `
            + `${seFloorBB.toExponential(2)} bb (${minSe.toExponential(2)} of a ${PREFLOP_POT_BB}bb pot, `
            + `the min over the projection ${seStub.lo.toExponential(2)} and the matrix `
            + `${seMatrix.lo.toExponential(2)}) — `
            + 'solving tighter than the payoff\'s error is fake precision (V3-PLAN §6)');
        }
        let worstEps = 0, worstEpsM = 0;
        for (const stack of [100, 40]) {
          for (const [tag, r] of [...runs[stack].map((x) => ['projection', x]),
            ...runsM[stack].map((x) => ['matrix', x])]) {
            if (tag === 'matrix') { if (r.eps > worstEpsM) worstEpsM = r.eps; } else if (r.eps > worstEps) worstEps = r.eps;
            if (!(r.eps <= EPSILON_BB)) {
              bad.push(`(a) T${stack} ${tag} seed ${r.seed}: exploitability ${r.eps.toExponential(3)} bb exceeds `
                + `epsilon ${EPSILON_BB.toExponential(2)} bb at the ${ITER_CAP}-iteration cap`);
            }
            if (!r.bracketOk) {
              bad.push(`(a) T${stack} ${tag} seed ${r.seed}: the best-response bracket BR_SB >= v >= -BR_BB fails `
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
          for (const r of [...runs[stack], ...runsM[stack]]) {
            if (r.simplexError > worstSimplex) worstSimplex = r.simplexError;
            if (!(r.simplexError <= simplexCap)) {
              bad.push(`(b) T${stack} ${r.route} seed ${r.seed}: worst |sum of an infoset's probabilities - 1| is `
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
        const spreadsM = {};
        for (const stack of [100, 40]) {
          for (const [tag, set, into] of [['projection', runs[stack], spreads], ['matrix', runsM[stack], spreadsM]]) {
            const vs = set.map((r) => r.value);
            const spread = Math.max(...vs) - Math.min(...vs);
            into[stack] = spread;
            if (!(spread <= tolBB)) {
              bad.push(`(c/init) T${stack} ${tag}: the value spread over seeds ${set.map((r) => r.seed).join('/')} `
                + `is ${spread.toExponential(3)} bb = ${(100 * spread / PREFLOP_POT_BB).toFixed(4)}% of pot, over the `
                + `${(100 * TWO_SEED_TOL_POT).toFixed(2)}% gate — convergence is initialisation-sensitive`);
            }
          }
        }
        // -------------------------------------------------------------------------------
        // THE PAYOFF AXIS — S-A's own reading of the clause, and LIVE since P3's B2 pre-stage.
        // -------------------------------------------------------------------------------
        // Under the PROJECTION the accessor is seed-inert, so that half stays CHECKED rather than
        // assumed: if the two matrices are bit-identical the spread is exactly 0 for a stated
        // reason. Under the MEASURED PAIRWISE MATRIX `opts.seed` selects which of two independently
        // sampled matrices answers, so the two solves really are two payoff samples — which is what
        // docs/refutations/P2.md finding 3 asked for ("the 0.035% figure is S-A's payoff-axis
        // spread, and the payoff axis is inert under a checkdown source").
        const mA = runs[100][0].matrices.byNode.n5.net;
        clearMatrixCache();
        const payoffSeeded = solveHU({ model, stack: 100, iters: ITER_CAP, seed: 0, payoffSeed: 4242, payoff });
        let stubAxisInert = mA.length === payoffSeeded.matrices.byNode.n5.net.length;
        if (stubAxisInert) {
          const mB = payoffSeeded.matrices.byNode.n5.net;
          for (let z = 0; z < mA.length; z++) if (mA[z] !== mB[z]) { stubAxisInert = false; break; }
        }
        const stubPayoffSpread = Math.abs(runs[100][0].value - payoffSeeded.value);
        if (!stubAxisInert && !(stubPayoffSpread <= tolBB)) {
          bad.push(`(c/payoff) T100 projection: two payoff samples give values `
            + `${stubPayoffSpread.toExponential(3)} bb apart = `
            + `${(100 * stubPayoffSpread / PREFLOP_POT_BB).toFixed(4)}% of pot, over the `
            + `${(100 * TWO_SEED_TOL_POT).toFixed(2)}% gate`);
        }
        // ...and the live half. Two independently sampled matrices, named before either was solved
        // on, init seed held at 0 so nothing but the payoff moves.
        const mxSpread = {};
        let mxAxisInert = true;
        for (const stack of [100, 40]) {
          const a = runsM[stack][0], b = payoffAxis[stack];
          const spread = Math.abs(a.value - b.value);
          mxSpread[stack] = spread;
          if (spread !== 0) mxAxisInert = false;
          if (!(spread <= tolBB)) {
            /* THE MESSAGE IS A MARGIN REPORT, not a narrative. The narrative — that 0.15% and a
               25,000-board matrix came from two different S-A tables and were jointly unsatisfiable
               — is the record of the first B2 run and its home is V3-PLAN §3.3's `Adjudicated (P3
               relaunch)` block, where a decision was made about it. What belongs HERE is what this
               run measured against what the anchor promised. */
            bad.push(`(c/payoff) T${stack} matrix: the two independently sampled payoff matrices `
              + `${SEEDS.join(' and ')} give values ${spread.toExponential(3)} bb apart = `
              + `${(100 * spread / PREFLOP_POT_BB).toFixed(4)}% of pot, over the `
              + `${(100 * TWO_SEED_TOL_POT).toFixed(2)}% gate — a margin of `
              + `${(tolBB / spread).toFixed(2)}x where solver.twoSeedTolPot's anchor claims ~4x, at `
              + `the ${BOARDS.toLocaleString()} boards the anchor itself was measured at (S-A: `
              + `0.035% of pot). The spread falls as boards^-1/2 and the seeds `
              + `${SEEDS.join('/')} were fixed before either was solved on, so the honest moves are `
              + `more boards or a re-anchoring ceremony — NEVER a widened tolerance and never a `
              + `second look at the seed names`);
          }
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
        // ...and on the route P3 actually solves, because the deferral is about the payoff's DOMAIN
        // and a new payoff source is exactly the thing that could re-open it. It does not: the
        // matrix is PAIRWISE, so a multiway request still falls to the accessor's flagged exit.
        for (const why of sixmaxDeferralProblems(probeM, hasSolver)) bad.push(`(d/matrix) ${why}`);
        if (SIXMAX.status !== 'deferred') {
          bad.push(`(d) SIXMAX.status is '${SIXMAX.status}' — this clause only knows how to check a deferral`);
        }
        if (!/fixed-point-only/.test(SIXMAX.claimScope)) {
          bad.push('(d) SIXMAX no longer scopes its claims to fixed-point-only, which is the one thing '
            + '§7.2 requires of anything multiway');
        }
        /* THE RE-OPENING RULE (V3-PLAN §3.3's Adjudicated block, decision 8), evaluated once by
           measurement at B2 and frozen in `SIXMAX.reopenRule`. What this clause checks is that the
           frozen record still says what the live measurement says — a rule recorded once and never
           re-read is a rule that outlives its evidence, which is the failure `SIXMAX` itself exists
           to prevent. Leg (ii) is the one that fails, and it must keep failing for the deferral to
           stand: `sixmaxDeferralProblems` clearing on the matrix route IS leg (ii) failing. */
        const legs = Array.isArray(SIXMAX.reopenRule) ? SIXMAX.reopenRule : [];
        const legOf = (id) => legs.find((l) => l.leg === id);
        if (legs.length !== 4 || !['i', 'ii', 'iii', 'iv'].every((id) => legOf(id))) {
          bad.push(`(d) SIXMAX.reopenRule records ${legs.length} legs, not the four V3-PLAN §3.3 names`);
        } else if (!/^FAILS/.test(legOf('ii').verdict)) {
          bad.push(`(d) SIXMAX.reopenRule leg (ii) is recorded as '${legOf('ii').verdict}' while the `
            + 'deferral still stands — if a measured k-way sampler now passes I33(b) and I33(h), the '
            + '6-max decision is re-made rather than inherited');
        }
        if (!/NOT MEASURABLE in the HU domain/.test(SIXMAX.reopenVerdict || '')) {
          bad.push('(d) SIXMAX.reopenVerdict no longer records that I36\'s positional-nesting clause is '
            + 'not measurable in the HU domain — the sentence P3\'s baseline phase quotes');
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
        /* THE ON-SCREEN HALF, LIVE SINCE P3. It read "zero units today, counted rather than
           skipped" while nothing shipped a cap list; `shippedSurfaces()` now enumerates every place
           one does — data/model.json's `baselineTiers.caps`, data/equilibrium.json's `caps`, and
           the same two read back out of each BUILT PAGE. The page copies are not redundant with the
           file copies: build.mjs injects `model.json` and `equilibrium.json` into the artifact, and
           a list that is right on disk and stale in the page is exactly the failure a disclosure
           clause exists for. */
        const screenLists = SURFACES.capLists;
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
        // THE LABEL MUST RENDER ON BOTH ROUTES, and that is the point of keying it off `source`:
        // the matrix is a genuinely pairwise measurement and it is STILL a game where postflop does
        // not exist, so the caveat is exactly as load-bearing over it as over the stub.
        /* DERIVED FROM THE MEASUREMENT, never typed, and scoped to the abstraction actually solved:
           the undealable pairs BOTH of whose cells are live here, counted once per ordering. On the
           shipped 123-cell abstraction that is 43 x 2 = 86; on a narrowed one it is whatever the
           narrowing leaves, which is what makes this an assertion about the payoff rather than
           about the model's size. */
        const undealableOrdered = (() => {
          const inLive = Object.create(null);
          for (const k of liveM) inLive[k] = true;
          let n = 0;
          for (const pair of MATRICES[0].meta.impossiblePairs) {
            if (inLive[pair[0]] && inLive[pair[1]]) n += 2;
          }
          return n;
        })();
        for (const stack of [100, 40]) {
          for (const r of [runs[stack][0], runsM[stack][0]]) {
            for (const why of labelProblems(r)) bad.push(`(f) T${stack} ${r.route}: ${why}`);
            if (r.route === 'projection') {
              if (r.source === 'checkdown' && r.unsupported !== 0) {
                bad.push(`(f) T${stack}: ${r.unsupported} heads-up returns came back unsupported — the label `
                  + 'clause assumes the HU domain is supported, and that assumption just failed');
              }
            } else {
              /* REWRITTEN TO THE MEASUREMENT (P3 B2). "Zero unsupported heads-up returns" was true
                 of a source that deals no cards. The matrix deals 400,000 boards and 43 unordered
                 pairs ask the deck for more aces than it has, so the honest count is not zero — it
                 is EXACTLY the measurement's own undealable set, twice (once per ordering), at every
                 showdown terminal. Derived from `meta.impossiblePairs`, never typed. */
              const terminals = Object.keys(r.matrices.byNode);
              for (const id of terminals) {
                const got = r.matrices.byNode[id].unsupported;
                if (got !== undealableOrdered) {
                  bad.push(`(f) T${stack} matrix terminal ${id}: ${got} unsupported returns, not the `
                    + `${undealableOrdered} ordered pairs the matrix measured as undealable — either a `
                    + `pair the boards DID deal is being flagged, or one they never dealt is being `
                    + `answered as if they had`);
                }
              }
              if (r.unsupported !== terminals.length * undealableOrdered) {
                bad.push(`(f) T${stack} matrix: ${r.unsupported} unsupported returns over `
                  + `${terminals.length} terminals, expected ${terminals.length * undealableOrdered}`);
              }
            }
          }
        }
        /* ...and the family, asserted structurally rather than by count: every pair the matrix route
           flags is one asking for five or six aces. `aceFloor` is I33 clause (h)'s own predicate,
           imported rather than re-implemented, so the two gates cannot drift apart on what an
           undealable pair IS. */
        let famBad = 0, flaggedSeen = 0;
        for (let i = 0; i < liveM.length; i++) {
          for (let j = 0; j < liveM.length; j++) {
            if (i === j) continue;
            if (payoffM([liveM[i], liveM[j]], 6, 1, { ip: true, seed: SEEDS[0] }).supported) continue;
            flaggedSeen++;
            if (aceFloor(liveM[i]) + aceFloor(liveM[j]) < 5) {
              famBad++;
              if (famBad < 3) {
                bad.push(`(f) matrix: ${liveM[i]} x ${liveM[j]} is flagged unsupported but pins only `
                  + `${aceFloor(liveM[i]) + aceFloor(liveM[j])} aces — the fallback must be flagged for `
                  + 'the deck\'s reason, not for an unnamed one');
              }
            }
          }
        }
        if (flaggedSeen !== undealableOrdered) {
          bad.push(`(f) matrix: ${flaggedSeen} ordered pairs are flagged unsupported at the terminal `
            + `arguments, not the ${undealableOrdered} the measurement found`);
        }
        /* ...AND THE SHIPPED SURFACES, LIVE SINCE P3. Everything above is about the solve; this is
           about what a reader is handed. §7.2's clause is "whenever the equilibrium surface's payoff
           source is 'checkdown', the label must render, DERIVED FROM THAT SHIPPED source datum,
           never prose" — so the units are the surfaces that carry a `source`: data/equilibrium.json's
           `payoff` block, data/model.json's `baselineTiers`, and both read back out of every built
           page. `labelProblems` is the same detector, so a surface that shipped the label as a
           string constant instead of deriving it fails here the moment its `source` moves. */
        const labelSurfaces = SURFACES.labels;
        for (const [where, surface] of labelSurfaces) {
          for (const why of labelProblems(surface)) bad.push(`(f) ${where}: ${why}`);
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
        let worstMirror = 0, worstMirrorM = 0;
        for (const stack of [100, 40]) {
          for (const r of [runs[stack][0], runsM[stack][0]]) {
            const potMax = r.tree.L[5] * 2;
            const cap = mirrorBound(potMax);
            if (r.route === 'matrix') { if (r.mirrorMax > worstMirrorM) worstMirrorM = r.mirrorMax; } else if (r.mirrorMax > worstMirror) worstMirror = r.mirrorMax;
            if (!(r.mirrorMax <= cap)) {
              bad.push(`(zero-sum) T${stack} ${r.route}: the worst |netSB + netBB| over both orderings is `
                + `${r.mirrorMax.toExponential(3)} bb, over the ${cap.toExponential(3)} accumulation bound — the `
                + 'solver mirrors the matrix, so an asymmetry this large is being laundered into the fixed point');
            }
            /* (domain) REWRITTEN TO THE MEASUREMENT on the matrix route, for the same reason (f) was:
               the honest count is the measurement's own undealable set, not zero. The projection
               keeps the zero. */
            const wantUnsupported = r.route === 'matrix'
              ? Object.keys(r.matrices.byNode).length * undealableOrdered : 0;
            if (r.unsupported !== wantUnsupported) {
              bad.push(`(domain) T${stack} ${r.route}: ${r.unsupported} of the heads-up payoff requests `
                + `were unsupported, expected ${wantUnsupported}`);
            }
            if (r.matrices.shapeBad !== 0) {
              bad.push(`(domain) T${stack} ${r.route}: ${r.matrices.shapeBad} payoff returns were missing a contracted key`);
            }
          }
        }
        /* THE CONSTANTS BLOCK, LIVE SINCE P3 — §6's third leg, and the one docs/refutations/P2.md
           finding 6 recorded as unmet. It read "zero on disk today" while P2 shipped no model
           write; `verify.mjs`'s `stampConstants` now writes `model.constants.solver` from THIS
           module's CONSTANTS on every run, and `shippedSurfaces()` reads it back from the file,
           from data/equilibrium.json's own `constants` array, and from EVERY BUILT PAGE. The page
           copies matter for the same reason (e)'s do: the Method view renders `model.constants`,
           so a block that is right on disk and stale in the artifact is a page showing the reader
           a number the solver does not use. */
        const constantsUnits = SURFACES.constants;
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
        const m100 = runsM[100][0], m40 = runsM[40][0];
        const pct = (x) => (100 * x / PREFLOP_POT_BB).toFixed(4);
        /* THE MEASUREMENTS ARE PRINTED WHETHER OR NOT THE GATE PASSES, and the failures are appended
           (I33's idiom). B2's whole deliverable is a set of numbers — the reproduction check against
           S-A, the residual band, the payoff-axis spread — and a gate that swallows them the moment
           one clause fails hides the evidence for the decision the failure is asking for. */
        const detail = `(a) exploitability at the ${ITER_CAP}-iteration cap: worst ${worstEps.toExponential(2)} bb over `
            + `${INIT_SEEDS.length} seeds x 2 depths on the projection and ${worstEpsM.toExponential(2)} bb on the `
            + `MEASURED PAIRWISE MATRIX, against epsilon ${EPSILON_BB.toExponential(0)} bb `
            + `(S-A: out-of-sample floor 5.16e-5) — itself under the payoff's own se floor `
            + `${seFloorBB.toExponential(2)} bb, which is §6's "never tighter than the payoff's error" as an `
            + `assertion rather than a sentence; a 13-iteration solve breaches it at `
            + `${stunted.eps.toExponential(2)} bb, so the bar can fail. `
            + `(b) worst simplex error ${worstSimplex.toExponential(2)} against the `
            + `${simplexCap.toExponential(2)} accumulation bound (N*EPSILON, arithmetic, not a tolerance). `
            + `(c) TWO AXES, AND THE PAYOFF ONE IS LIVE SINCE B2. Init-seed spread on the projection `
            + `T100 ${pct(spreads[100])}% / T40 ${pct(spreads[40])}% of pot and on the matrix `
            + `T100 ${pct(spreadsM[100])}% / T40 ${pct(spreadsM[40])}%, against the `
            + `${(100 * TWO_SEED_TOL_POT).toFixed(2)}% gate. The PAYOFF axis on the projection is `
            + `${stubAxisInert ? 'INERT — the stub ignores opts.seed, so the two samples are bit-identical and the '
              + 'spread is exactly 0 for a stated reason, CHECKED not assumed'
              : `live, spread ${pct(stubPayoffSpread)}% of pot`}; on the MATRIX it is `
            + `${mxAxisInert ? 'INERT, which would mean the two named samples are the same matrix'
              : `LIVE — ${SEEDS.join(' vs ')}, two independently sampled ${BOARDS.toLocaleString()}-board `
                + `matrices with the init seed held at 0, spread T100 ${pct(mxSpread[100])}% / T40 `
                + `${pct(mxSpread[40])}% of pot — a margin of `
                + `${(tolBB / mxSpread[100]).toFixed(2)}x / ${(tolBB / mxSpread[40]).toFixed(2)}x `
                + `under the gate`} (S-A measured 0.035% across payoff samples AT `
            + `${BOARDS.toLocaleString()} BOARDS, which is why the shipped matrices are built at that `
            + `count and not at the 25,000 the first B2 run used — the anchor's stated ~4x is a `
            + `MEASUREMENT in its own regime rather than a claim about a noisier one; spread falls as `
            + `boards^-1/2). A fabricated seed-sensitive source moves the `
            + `value ${Math.abs(sA.value - sB.value).toExponential(2)} bb, so the clause had teeth even `
            + `while the axis was inert. `
            + `(d) 6-MAX DEFERRED, and the deferral is gated by its own evidence, not by prose: the budget `
            + `criterion was MET (S-A, 5,400x inside the half-budget), so the reason is the payoff domain — `
            + `over ${probe.tuples} six-handed tuples, ${probe.supportedCount} of ${probe.tuples * probe.seats} `
            + `returns were supported, the shares miss 1 by up to ${probe.worstShareDev.toFixed(3)}, and hero's `
            + `share is ${probe.opponentInvariant ? 'BIT-IDENTICAL across disjoint opponent sets' : 'opponent-dependent'} `
            + `— a fixed point of that is not a fixed point of six-max PLO. If any of the three flips, this `
            + `clause fails and the decision is re-made. THE SAME THREE, RE-MEASURED ON THE MATRIX ROUTE `
            + `(a new payoff source is exactly what could re-open this): ${probeM.supportedCount} of `
            + `${probeM.tuples * probeM.seats} supported, shares miss 1 by ${probeM.worstShareDev.toFixed(3)}, `
            + `hero's share ${probeM.opponentInvariant ? 'still opponent-INVARIANT' : 'now opponent-dependent'} `
            + `— the matrix is PAIRWISE, so multiway still falls to the accessor's flagged exit. THE `
            + `RE-OPENING RULE (V3-PLAN §3.3's Adjudicated block) is evaluated ONCE and frozen in `
            + `SIXMAX.reopenRule: ${SIXMAX.reopenRule.map((l) => `(${l.leg}) ${l.verdict.split(';')[0]}`).join(', ')} `
            + `— leg (ii) fails, so the deferral stands and I36's positional-nesting clause is NOT `
            + `MEASURABLE in the HU domain (the I15 precedent). `
            + `(e) the ladder is RE-DERIVED from the pot-limit rule, not read back: T100 ${EXPECT.ladder100.join('/')} `
            + `and T40 ${EXPECT.ladder40.join('/')} (one rung apart — at 40bb the cap is a genuine all-in), `
            + `${EXPECT.nodes} nodes, ${EXPECT.terminals} terminals, ${live.length} cells, `
            + `${live.length * EXPECT.nodes} infosets, ${live.length * EXPECT.slotsPerCell} slots `
            + `(SB ${live.length * EXPECT.sbSlotsPerCell} / BB ${live.length * EXPECT.bbSlotsPerCell}) — so a sizing `
            + `that is NOT the pot-limit maximum fails here, in any of three independent derivations `
            + `(a typed table equal to the identity is not caught, and is not a violation — P2 red team, `
            + `docs/refutations/P2.md); ${CAPS.omitted.length} declared omissions match the tree; `
            + `${screenLists.length} SHIPPED cap lists checked against that tree — ${screenLists.map(([w]) => w).join(', ') || 'none'} `
            + `— each derived from CAPS in the artifact that carries it, never typed beside it (the `
            + `detector is armed four ways against fabricated ones). `
            + `(f) source '${r100.source}' -> label ${JSON.stringify(r100.label)} on the projection and `
            + `'${m100.source}' -> ${JSON.stringify(m100.label)} on the matrix, derived from the source datum `
            + `on BOTH — a measured pairwise checkdown is still a game where postflop does not exist, so the `
            + `caveat is as load-bearing over it as over the stub. A label keyed off \`supported\` is the armed `
            + `violator and it is the real trap here, because all ${live.length * live.length} heads-up returns `
            + `on the projection ARE supported. THE MATRIX'S OWN COUNT IS NOT ZERO AND THE CLAUSE IS REWRITTEN `
            + `TO IT: ${undealableOrdered} unsupported returns per showdown terminal — exactly the pairs the `
            + `measurement found undealable, twice over for the two orderings, every one of them asking the deck `
            + `for five or six aces (${flaggedSeen} flagged, ${famBad} outside that family), with the fallback `
            + `flagged rather than collapsed (I33 clause (h)'s first live case). `
            + `VALUE ON THE PROJECTION (the page's accessor, D10): T100 ${r100.value.toFixed(6)} bb to SB, T40 `
            + `${r40.value.toFixed(6)} — BB-POSITIVE at both depths, which is what "postflop does not exist" `
            + `looks like (SB opens ${(100 * r100.frequencies.sbOpen).toFixed(2)}%, BB folds `
            + `${(100 * r100.frequencies.bbFoldVsOpen).toFixed(4)}% against a 3bb open). `
            + `THE REPRODUCTION CHECK — P3's baseline against S-A's own solve of the same construction. `
            + `MATRIX T100 ${m100.value.toFixed(5)} bb to SB, SB opens `
            + `${(100 * m100.frequencies.sbOpen).toFixed(2)}%, BB folds `
            + `${(100 * m100.frequencies.bbFoldVsOpen).toFixed(3)}% vs a 3bb open; T40 `
            + `${m40.value.toFixed(5)}, ${(100 * m40.frequencies.sbOpen).toFixed(2)}%, `
            + `${(100 * m40.frequencies.bbFoldVsOpen).toFixed(3)}%. S-A measured ${SA_REPRO.value} bb / `
            + `${(100 * SA_REPRO.sbOpen).toFixed(1)}% / ${(100 * SA_REPRO.bbFold).toFixed(2)}% at `
            + `${SA_REPRO.boards.toLocaleString()} boards; P2's projection stub gave -0.0816 / 99.4% / 0.0001%. `
            + `THE DELTAS ARE DERIVED FROM THIS RUN, not typed: at T100 the matrix reproduces S-A to `
            + `${Math.abs(m100.value - SA_REPRO.value).toExponential(1)} bb in value, `
            + `${Math.abs(100 * (m100.frequencies.sbOpen - SA_REPRO.sbOpen)).toFixed(2)} pt in SB open and `
            + `${Math.abs(100 * (m100.frequencies.bbFoldVsOpen - SA_REPRO.bbFold)).toFixed(3)} pt in BB fold, `
            + `at ${BOARDS === SA_REPRO.boards
              ? 'THE SAME BOARD BUDGET S-A USED, so what is left is the payoff-axis spread itself rather '
                + 'than the budget'
              : `${(SA_REPRO.boards / BOARDS).toFixed(0)}x fewer boards than S-A, so what is left is the `
                + 'board budget'}. Either way the difference is REPORTED, never tuned. `
            + `Argmaxes last flipped at iteration ${r100.lastFlip} of ${ITER_CAP} on the projection and `
            + `${m100.lastFlip} (T100) / ${m40.lastFlip} (T40) on the matrix — CFR+, not CFR, which S-A measured `
            + `still flipping at 99,467`
            + (Math.max(m100.lastFlip, m40.lastFlip) > 0.9 * ITER_CAP
              ? `; the ${m100.lastFlip > m40.lastFlip ? 'T100' : 'T40'} matrix figure sits above 0.9x the cap `
                + 'and is REPORTED rather than asserted, which is why no flapping bound is placed on this route'
              : `; both matrix figures sit under 0.9x the cap this run, and the reading is still REPORTED `
                + 'rather than asserted — a flapping bound derived from one run\'s luck is not a bound')
            + `. Mirror residual `
            + `${worstMirror.toExponential(2)} bb on the projection and ${worstMirrorM.toExponential(2)} on the `
            + `matrix. THE DISCLOSURE CLAUSES NOW HAVE SHIPPED SURFACES, which is P3's own deliverable `
            + `and §6's third leg: ${constantsUnits.length} shipped solver-constants blocks agree with `
            + `this module's CONSTANTS — ${constantsUnits.map(([w]) => w).join(', ') || 'none'} — and `
            + `${labelSurfaces.length} shipped label surfaces derive their caveat from their own `
            + `\`source\` datum — ${labelSurfaces.map(([w]) => w).join(', ') || 'none'}. Both counts `
            + `were 0 at P2 and the clauses said so rather than passing quietly; they are non-zero `
            + `because data/equilibrium.json, model.baselineTiers and model.constants.solver now `
            + `exist, in the file AND in every built page.`
          + (bad.length ? ` — FAILS: ${bad.join(' · ')}` : '');
        G('I35', bad.length === 0, detail);
      } },
    ],
  };
}
