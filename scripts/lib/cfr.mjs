// cfr.mjs — THE SOLVER ENGINE (V3-PLAN §3.2, per S-A's memo). Gate I35 pins it.
//
// WHAT THIS IS. CFR+ on the 123-cell abstraction over the capped heads-up preflop tree, with
// exact best-response exploitability. It is P2's half of "payoff estimator ∥ solver engine": the
// engine, built against the frozen payoff interface, NOT yet married to a real payoff model.
//
// THE B2 RULE, WHICH IS THE WHOLE POINT OF THIS FILE'S SHAPE. Every payoff this module consumes
// arrives through `scripts/lib/payoff.mjs`'s frozen accessor and through nothing else. There is no
// direct read of any payoff table here — not of the shipped equity ladder, not of a fitted model,
// not of a cached matrix somebody else built. I33 clause (e) is the grep gate that enforces it,
// and this file is inside its `CONSUMER` scope by filename. In P2 the accessor serves a CHECKDOWN
// stub, so what this module solves today is the equilibrium of a game where postflop does not
// exist; wiring it to a real payoff is P3's job and is gated on I33 passing on that model. That
// barrier is why `solveHU` takes an injected `payoff` function: the marriage is a caller change,
// not an edit here.
//
// WHY LIVENESS IS ASKED OF THE ACCESSOR RATHER THAN OF THE MODEL. The set of cells the solver may
// use is the set the payoff can answer about, and the accessor is the only thing that knows that.
// So `liveCells` asks it — a cell is live iff the self-pair comes back `supported:true` — instead
// of reaching into the model's own tables to guess. That keeps clause (e) honest by construction
// rather than by care, and it means a payoff source with a narrower domain automatically narrows
// the abstraction instead of being silently extrapolated over. The chance measure is a different
// quantity and is read from the model directly: `combos` is combinatorics, not a payoff.
//
// THE TREE, AND WHY IT CONTAINS NO TYPED SIZINGS. Heads-up, SB on the button, blinds 0.5/1.0,
// preflop pot 1.5bb. Every raise is the POT-LIMIT MAXIMUM, and from the blinds that is exactly the
// ladder 3, 9, 27, 81 — an arithmetic identity of the game, not a sizing anybody chose. S-A found
// this the hard way: the brief's "open / 3-bet / 4-bet / jam at 100bb" tree is ILLEGAL in pot
// limit, because facing a 27bb 4-bet the maximum legal raise is 81 and a 100bb jam is not an
// available action. A NLHE-shaped preflop tree does not port to PLO. `potLimitLadder` therefore
// DERIVES the ladder from the blinds and the pot-limit rule and asserts nothing; V3-PLAN §6 records
// the consequence as "the sizing set introduces ZERO new constants", and I35 proves it by
// recomputing the ladder rather than by believing this paragraph.
//
// Five decision nodes, nine terminals, 123 x 5 = 615 infosets, 1,599 action slots (SB 861, BB 738).
// Two depths are solved and they differ in exactly one terminal pot: T100 (cap = the pot 5-bet to
// 81, the 19bb behind irrelevant under a checkdown payoff) and T40 (40bb = the shipped `depth.min`,
// where the 4-bet to 27 leaves 13 behind so the cap action IS a legal all-in). That pair is the
// controlled comparison the depth axis wants.
//
// WHAT IS NOT IN THE TREE, SAID OUT LOUD. No SB limp, no sixth raise, no postflop, and chance is
// the PRODUCT OF MARGINALS — no cell-level card removal between the two players. Those are
// abstraction choices, not identities, and they are the reason `CAPS` exists as machine-readable
// data rather than as this comment: I35's cap-list clause asserts that any on-screen list matches
// the tree the solver actually walked, derived from `CAPS` and from the tree, never from prose.
// The product-of-marginals choice is what keeps the game exactly zero-sum; S-A measured its cost
// at 43 structurally undealable pairs carrying 3.6e-5 of the combo mass.
//
// THE PAYOFF ARITHMETIC USES ALL SIX KEYS, DELIBERATELY. A showdown terminal's value to SB is
//
//     finalPot = potMult * potSize;  invested = heroPre + invShare * finalPot
//     netBB    = ev * finalPot - invested
//
// which is the P2 pre-stage amendment's caller arithmetic, verbatim. Under the checkdown stub
// `potMult === 1` and `invShare === 0`, so it collapses to `pot * (ev - 0.5)` — but the collapsed
// form is NOT what is written below, because writing it would make the marriage in P3 a rewrite of
// every terminal instead of a change of one argument. `heroPre` is the caller's to supply and this
// module supplies it honestly: every showdown in this tree is symmetric, both players having put
// in exactly half of the pot they are contesting, so `heroPre = potSize / 2` is arithmetic here
// rather than an assumption.
//
// ZERO-SUM IS MIRRORED, AND THE RESIDUAL IS MEASURED RATHER THAN ASSUMED. S-A stores each
// off-diagonal once and mirrors it, which makes the solved game exactly zero-sum. This module does
// the same — BB's value is the negation of SB's — but it also asks the accessor the OTHER ordering
// and reports the worst |netSB + netBB| it saw. Under a position-inert stub that residual is
// exactly 0. Under a position-aware source it will not be, and the number is then a finding about
// the payoff rather than a silent asymmetry the solver launders into a fixed point.
//
// SIX-MAX IS DEFERRED, AND THE DEFERRAL IS GATED BY ITS OWN EVIDENCE. S-A greenlit 6-max MCCFR on
// the budget criterion by a factor of 5,400, so budget is NOT the reason it is absent here. The
// reason is the payoff domain, and it is measured, not argued: see `SIXMAX` and `multiwayProbe`.
//
// NODE-SIDE ONLY. Unlike payoff.mjs this module is not inlined into the page: P3 ships the solved
// surface as `data/equilibrium.json` (full build only, gate D9), not the solver. So there is no
// `@browser-cut` here and no restriction on export forms.

import { makePayoff, RESULT_KEYS } from './payoff.mjs';

// ---------------------------------------------------------------------------
// the game's own numbers, and the constants that are opinions about solving it
// ---------------------------------------------------------------------------

/** The blinds. These DEFINE the game rather than describing a choice about it; everything else
 *  about the betting tree is derived from them by the pot-limit rule. */
export const BLINDS = Object.freeze({ sb: 0.5, bb: 1 });

/** The preflop pot, in bb. S-A grades exploitability against this — the TIGHTEST reading, since
 *  any larger normaliser makes a "% of pot" bar easier to clear. */
export const PREFLOP_POT_BB = BLINDS.sb + BLINDS.bb;

/**
 * Exploitability target, in bb.
 *
 * ANCHOR (S-A, measured not chosen). §6's rule is "epsilon <= the payoff's own se", and S-A found
 * the decision-relevant reading of that is OUT-OF-SAMPLE exploitability — a strategy solved on one
 * payoff sample, scored against an independent one — measured at 5.16e-5 bb = 0.0034% of pot. Hence
 * 5e-5. It is 74x tighter than §1's pre-registered 0.25%-of-pot spike threshold, which is what puts
 * that threshold above the noise floor instead of inside it.
 *
 * The "<= the payoff's own se" half is not left as prose: I35 recomputes the accessor's own `se` at
 * the tightest pot and asserts this constant sits under it. A future payoff quiet enough to make
 * that false forces this number DOWN rather than letting the solver claim precision the payoff
 * cannot support.
 */
export const EPSILON_BB = 5e-5;

/**
 * Iteration cap.
 *
 * ANCHOR (S-A's measured convergence curve): exploitability first crosses 5e-5 bb at iteration 456
 * / 40 ms, so 2,000 is a 4x margin at 143 ms — 0.24% of the 60 s half-budget. On the checkdown stub
 * this module actually serves, the crossing is EARLIER still (measured: iteration 332 at T100, 316
 * at T40), so the same cap carries a larger margin here; I35 asserts the achieved exploitability at
 * the cap rather than trusting either curve.
 */
export const ITER_CAP = 2000;

/**
 * The two-seed clause's tolerance, as a fraction of the preflop pot.
 *
 * ANCHOR (S-A): the value spread across independent payoff samples measured 5.19e-4 bb = 0.035% of
 * pot; the gate is set at 0.15%, roughly 4x the measurement, and is written to fail. It is applied
 * to BOTH seed axes — see `TWO_SEED_AXES`.
 */
export const TWO_SEED_TOL_POT = 0.0015;

/**
 * The two axes a "seed" moves, named because they are not the same claim and only one of them is
 * live today.
 *
 * `payoff`  — the seed threaded into `opts.seed` on every accessor call. This is S-A's own reading
 *             of the clause ("value spread across independent payoff samples"). Under a checkdown
 *             source the accessor is seed-inert, so the two samples are bit-identical and the
 *             spread is exactly 0 — a pass for a reason worth stating rather than a measurement.
 *             I35 CHECKS the inertness (it does not assume it) and arms the clause against a
 *             fabricated seed-sensitive source, so it is a real assertion the day a source is
 *             'simulated'.
 * `init`    — the seed selecting the initial strategy, i.e. the simplex point used wherever
 *             cumulative regret is still all-zero. Non-vacuous today: it genuinely moves the
 *             trajectory, and asserting the runs converge to the same value is what I35's "fails if
 *             convergence is abstraction-sensitive" means while the payoff axis is inert.
 *
 * A NOTE ON WHAT DID NOT WORK, kept because it is the kind of thing that gets re-invented: seeding
 * the initial cumulative REGRETS instead of the initial strategy looks equivalent and is not. CFR+
 * regrets here live on the scale of the chance measure (q ~ 1/123) times small counterfactual
 * differences, so simplex-sized initial regrets are not a perturbation but a huge wrong prior, and
 * linear averaging carries it for far longer than the cap: measured exploitability 2.1e-2 at the
 * cap against 1.5e-6 unperturbed, four orders of magnitude worse. Perturbing the STRATEGY is
 * scale-free — a distribution has no magnitude to get wrong — and washes out as soon as regrets
 * accumulate.
 */
export const TWO_SEED_AXES = Object.freeze(['payoff', 'init']);

/**
 * The constants this module introduces, machine-readable, each with the anchor it was measured
 * from. V3-PLAN §6 requires every new constant to be named, anchored, rendered and gated; this is
 * the "named + anchored" half in a form the Method view can render and a gate can walk.
 *
 * `kind` is the distinction §6 turns on. 'anchored' means a measurement fixed it. 'identity' means
 * it is arithmetic and introduces no opinion at all — the sizing ladder is here because §6's
 * measured block upgraded it from "flagged" to "anchored, and stronger than this row assumed". No
 * entry is 'interpolated' or 'estimate': this module ships no unanchored number, which is why it
 * needs no badge.
 *
 * WHAT IS NOT HERE, on purpose: these are SOLVER constants, and `model.constants` is written by
 * scripts/generate-data.mjs into the shipped artifact. P2 does not regenerate the model — doing so
 * would move `meta.hash` and the frozen tier fixtures for a phase that ships no new model number.
 * So the Method-view row is P3's to stamp, at the same regeneration that emits
 * `data/equilibrium.json` under D9, and it must stamp THESE values: I35 asserts the pair agrees the
 * moment such a block exists (`constantsBlockProblems`), and reports "0 blocks on disk" until then.
 */
export const CONSTANTS = Object.freeze([
  Object.freeze({
    name: 'solver.epsilonBB', value: EPSILON_BB, unit: 'bb', kind: 'anchored',
    anchor: 'S-A: out-of-sample exploitability floor 5.16e-5 bb = 0.0034% of the 1.5bb preflop pot '
      + '(sigma solved on one payoff sample, scored against an independent one). Bounded above by '
      + "the accessor's own se at the tightest pot, asserted by I35 rather than claimed here.",
  }),
  Object.freeze({
    name: 'solver.iterCap', value: ITER_CAP, unit: 'iterations', kind: 'anchored',
    anchor: "S-A's measured convergence curve: exploitability first crosses 5e-5 bb at iteration "
      + '456 / 40 ms, so 2,000 is a 4x margin at 143 ms. On the checkdown stub the crossing is '
      + 'iteration 332 (T100) / 316 (T40), so the margin here is larger still.',
  }),
  Object.freeze({
    name: 'solver.twoSeedTolPot', value: TWO_SEED_TOL_POT, unit: 'fraction of the preflop pot',
    kind: 'anchored',
    anchor: 'S-A: value spread across independent payoff samples 5.19e-4 bb = 0.035% of pot; gated '
      + 'at 0.15%, ~4x the measurement, written to fail.',
  }),
  Object.freeze({
    name: 'solver.sizingLadder', value: '3 / 9 / 27 / 81', unit: 'bb (raise-to)', kind: 'identity',
    anchor: 'The pot-limit maximum from blinds 0.5/1.0 is exactly 3, 9, 27, 81 — an arithmetic '
      + 'identity of the game, recomputed by `potLimitLadder` and re-derived by I35, so the sizing '
      + 'set introduces ZERO new constants (V3-PLAN §6, measured block). Capped by the effective '
      + 'stack, which is where T40 and T100 part company.',
  }),
]);

// ---------------------------------------------------------------------------
// the tree
// ---------------------------------------------------------------------------

/**
 * The pot-limit maximum raise ladder, DERIVED.
 *
 * The pot-limit rule: facing a bet you must call `toCall` to match, with `potBefore` already in the
 * middle, your maximum raise-TO is `currentBet + (potBefore + toCall)`. Applied from the blinds it
 * yields 3, 9, 27, 81 and nothing was typed. Each rung is additionally capped by the effective
 * stack, and a rung that the cap bites is flagged `allIn` — that is the ONE structural difference
 * between T40 and T100.
 *
 * Returns the four raise rungs in order. The caller assembles them into `L` (below), which is the
 * full commitment ladder including the two blinds.
 */
export function potLimitLadder(stack) {
  if (!(typeof stack === 'number' && Number.isFinite(stack) && stack > BLINDS.bb)) {
    throw new TypeError(`cfr: effective stack must be a finite number above the big blind, got ${stack}`);
  }
  const rungs = [];
  let potBefore = BLINDS.sb + BLINDS.bb;
  let currentBet = BLINDS.bb;
  let myCommitted = BLINDS.sb;
  for (let n = 0; n < 4; n++) {
    const toCall = currentBet - myCommitted;
    const raw = currentBet + (potBefore + toCall);
    const to = Math.min(raw, stack);
    rungs.push({ raw, to, allIn: to < raw });
    if (to >= stack) { for (let m = n + 1; m < 4; m++) rungs.push({ raw, to, allIn: true }); break; }
    potBefore = to + currentBet;
    myCommitted = currentBet;
    currentBet = to;
  }
  return rungs;
}

/**
 * The betting tree at one effective stack.
 *
 * `L` is the commitment ladder [sb, bb, open, 3bet, 4bet, cap] — six entries, so node k (1..5) has
 * an actor committed to `L[k-1]` facing `L[k]`, and everything else about the node falls out:
 *
 *   fold      the actor gives up `L[k-1]`; to SB that is -L[k-1] when SB is the actor, +L[k-1] when
 *             BB is (SB collects what BB had committed).
 *   call      a showdown for a pot of exactly 2*L[k], both players in for L[k].
 *   raise     to `L[k+1]`, which exists for k <= 4. Its absence at k = 5 IS the "no sixth raise" cap.
 *
 * n1 has no `call` action, and that absence IS the "no SB limp" cap. Both are declared in `CAPS`
 * and cross-checked against this structure by I35 rather than asserted twice.
 *
 * `spr` at a showdown is the effective stack left over the pot being contested, which is the honest
 * argument to hand the payoff accessor even while the stub is inert in it. At T40's cap it is
 * exactly 0 — both players are all in — and the accessor accepts 0.
 */
export function buildTree(stack) {
  const rungs = potLimitLadder(stack);
  const L = [BLINDS.sb, BLINDS.bb, rungs[0].to, rungs[1].to, rungs[2].to, rungs[3].to];
  const nodes = [];
  for (let k = 1; k <= 5; k++) {
    const sbActs = (k % 2) === 1;
    const node = {
      id: `n${k}`, k, actor: sbActs ? 'SB' : 'BB', committed: L[k - 1], facing: L[k],
      foldNetSB: sbActs ? -L[k - 1] : L[k - 1],
      actions: ['fold'],
    };
    if (k >= 2) {
      node.actions.push('call');
      node.callPot = 2 * L[k];
      node.callSpr = (stack - L[k]) / (2 * L[k]);
      node.heroPre = L[k];                        // each player's own half of `callPot`
    }
    if (k <= 4) { node.actions.push('raise'); node.raiseTo = L[k + 1]; }
    nodes.push(node);
  }
  const allIn = rungs[3].allIn;
  return Object.freeze({
    stack, L: Object.freeze(L), nodes: Object.freeze(nodes),
    capAllIn: allIn,
    label: `T${stack}`,
    sizings: Object.freeze([L[2], L[3], L[4], L[5]]),
    terminals: nodes.length + nodes.filter((n) => n.actions.includes('call')).length,
    infosetsPerCell: nodes.length,
    slotsPerCell: nodes.reduce((s, n) => s + n.actions.length, 0),
  });
}

/**
 * The abstraction's caps, as data.
 *
 * I35's cap-list clause (V3-PLAN §7.2) says the on-screen list must match the solver's ACTUAL tree,
 * derived from shipped data rather than from prose. This is the shipped datum. `omitted` names what
 * the tree does not contain and `modelled` names what it does; `capListProblems` checks a candidate
 * on-screen list against BOTH, so a list that quietly drops an omission fails, and so does one that
 * claims an omission the tree in fact contains.
 *
 * Every entry here is an ABSTRACTION CHOICE — flagged, per §6, not anchored. The sizings are the
 * opposite and are deliberately absent from `omitted`: they are an arithmetic identity, so they
 * appear in `modelled` with their derivation instead of in a flag list.
 */
export const CAPS = Object.freeze({
  modelled: Object.freeze([
    'heads-up, SB on the button, blinds 0.5/1.0',
    'raise sizings are the pot-limit maximum: 3 / 9 / 27 / 81 bb, an arithmetic identity',
    'five decision nodes, nine terminals, five raises deep including the blinds',
    'two effective stacks solved: 100bb and 40bb',
  ]),
  omitted: Object.freeze([
    'no SB limp — the button either raises to the pot-limit maximum or folds',
    'no sixth raise — the cap closes the betting',
    'no postflop — every showdown is a checkdown of the preflop pot',
    'no card removal between the two players — chance is the product of marginals',
    'no seats beyond the blinds — six-max is deferred, see SIXMAX',
  ]),
});

// ---------------------------------------------------------------------------
// the payoff bridge — the ONLY place this module touches a payoff
// ---------------------------------------------------------------------------

/**
 * The cells the payoff can answer about, in sorted order.
 *
 * Liveness is asked of the ACCESSOR, not of the model: a cell is live iff the self-pair comes back
 * `supported:true`. On the shipped model that is 123 cells and agrees exactly with the model's own
 * equity-ladder test; the 22 it excludes carry zero combos, so the chance measure over the live set
 * is complete (270,725 = C(52,4)).
 */
export function liveCells(payoffFn, model) {
  const keys = Object.keys(model.cells).sort();
  const live = [];
  for (const k of keys) {
    let r;
    try { r = payoffFn([k, k], PREFLOP_POT_BB, 1, { ip: true }); } catch { continue; }
    if (r && r.supported === true) live.push(k);
  }
  return live;
}

/**
 * The chance measure over the live cells: each cell's share of the C(52,4) deal space.
 *
 * `combos` is combinatorics, not a payoff, so reading it here is not a clause (e) violation — the
 * clause is about payoff TABLES. Chance is the product of marginals (see the header), so the joint
 * over a (hero, villain) pair is q[i]*q[j] and no cell-level removal is applied.
 */
export function chanceMeasure(model, live) {
  const raw = live.map((k) => {
    const c = model.cells[k];
    const n = c && typeof c.combos === 'number' ? c.combos : 0;
    if (!(Number.isFinite(n) && n > 0)) throw new TypeError(`cfr: cell ${k} has no positive combo count`);
    return n;
  });
  const total = raw.reduce((a, b) => a + b, 0);
  return { q: Float64Array.from(raw, (n) => n / total), combos: raw, total };
}

/** the six-key caller arithmetic, verbatim from the P2 pre-stage amendment */
function netFromResult(r, potSize, heroPre) {
  const finalPot = r.potMult * potSize;
  const invested = heroPre + r.invShare * finalPot;
  return r.ev * finalPot - invested;
}

/* The payoff-matrix cache. THE MEMO RULE (payoff.mjs's header, gated by I33 clause (g)): every
   argument goes in the key, and the two that get dropped are named — `ip` and the model hash. Both
   are here, alongside the seed, the pot and the spr that identify the terminal, and the cell list
   so a narrowed abstraction cannot collide with a wider one.

   AND ONE MORE, WHICH THE MEMO RULE AS WRITTEN DOES NOT COVER. `modelHash` identifies the SHIPPED
   model, and that is enough in production, where there is one. It is not enough here, because this
   repository's gates fabricate models to prove clauses can fail — and a fabricated variant built by
   spreading the real model (`{...MODEL, cells: fewer}`) carries the REAL `meta.hash`, so two
   genuinely different payoffs would key identically. That is the `envKey` trap arriving through the
   door the rule left open. `SOURCE_ID` closes it: every payoff FUNCTION OBJECT gets its own token,
   so two distinct sources can never alias no matter what hash they claim. Distinct-function-same-
   model is a cache miss, which is the safe direction to be wrong in. */
const SOURCE_ID = new WeakMap();
let SOURCE_N = 0;
const sourceToken = (fn) => {
  if (typeof fn !== 'function') return 'x';
  if (!SOURCE_ID.has(fn)) SOURCE_ID.set(fn, `s${++SOURCE_N}`);
  return SOURCE_ID.get(fn);
};
const MATRIX_CACHE = new Map();
const MATRIX_CACHE_CAP = 32;

/**
 * The net-to-SB matrix at one showdown terminal, built through the accessor and nothing else.
 *
 * Returns `net` (K*K, row = hero/SB cell, column = villain/BB cell) in bb, plus the diagnostics
 * I35 reads: how many returns were `supported`, what sources they claimed, and the worst
 * |netSB + netBB| the OTHER ordering produced. That last is the mirror residual — exactly 0 under a
 * position-inert stub, and a finding rather than a silent asymmetry under anything else.
 */
export function terminalMatrix(payoffFn, live, { potSize, spr, heroPre, seed, modelHash }) {
  const K = live.length;
  const ip = true;                                  // SB is the button, so SB is in position
  const key = `${sourceToken(payoffFn)}|${modelHash}|ip=${ip ? 1 : 0}|seed=${seed}`
    + `|pot=${potSize}|spr=${spr}|K=${K}|${live.join(',')}`;
  if (MATRIX_CACHE.has(key)) { const hit = MATRIX_CACHE.get(key); MATRIX_CACHE.delete(key); MATRIX_CACHE.set(key, hit); return hit; }

  const net = new Float64Array(K * K);
  const sources = Object.create(null);
  let unsupported = 0, shapeBad = 0, mirrorMax = 0;
  const opts = { ip, seed };
  const optsBB = { ip: !ip, seed };
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < K; j++) {
      const r = payoffFn([live[i], live[j]], potSize, spr, opts);
      for (const kk of RESULT_KEYS) if (!(kk in r)) { shapeBad++; break; }
      sources[r.source] = (sources[r.source] || 0) + 1;
      if (!r.supported) unsupported++;
      const sb = netFromResult(r, potSize, heroPre);
      net[i * K + j] = sb;
      /* the OTHER ordering, asked of the accessor rather than inferred: hero is now the player
         holding cell j, out of position. Zero-sum says the two nets cancel; the solver USES the
         mirrored value (S-A's own choice, which is what keeps the solved game exactly zero-sum),
         so this residual is the measurement of what that choice costs. Exactly 0 under a
         position-inert stub; a finding, not a silent asymmetry, under anything else. */
      const rb = payoffFn([live[j], live[i]], potSize, spr, optsBB);
      const d = Math.abs(sb + netFromResult(rb, potSize, heroPre));
      if (d > mirrorMax) mirrorMax = d;
    }
  }
  const out = Object.freeze({ net, K, potSize, spr, mirrorMax, unsupported, shapeBad, sources: Object.freeze(sources) });
  MATRIX_CACHE.set(key, out);
  if (MATRIX_CACHE.size > MATRIX_CACHE_CAP) MATRIX_CACHE.delete(MATRIX_CACHE.keys().next().value);
  return out;
}

/** clear the payoff-matrix cache — for tests that swap payoff sources under a fixed model hash */
export function clearMatrixCache() { MATRIX_CACHE.clear(); }

/**
 * One matrix per showdown terminal. There are four (n2..n5) and they carry DIFFERENT (potSize, spr)
 * arguments, which is why they are four matrices and not one scaled copy: the stub is inert in both
 * arguments, so today they agree up to the pot factor, and the day a source is not inert they will
 * not — and this shape is what makes that a change of data rather than a change of code.
 */
export function payoffMatrices(payoffFn, live, tree, seed, modelHash) {
  const out = {};
  let mirrorMax = 0, unsupported = 0, shapeBad = 0;
  const sources = Object.create(null);
  for (const node of tree.nodes) {
    if (!node.actions.includes('call')) continue;
    const m = terminalMatrix(payoffFn, live, {
      potSize: node.callPot, spr: node.callSpr, heroPre: node.heroPre, seed, modelHash,
    });
    out[node.id] = m;
    mirrorMax = Math.max(mirrorMax, m.mirrorMax);
    unsupported += m.unsupported;
    shapeBad += m.shapeBad;
    for (const s of Object.keys(m.sources)) sources[s] = (sources[s] || 0) + m.sources[s];
  }
  return { byNode: out, mirrorMax, unsupported, shapeBad, sources };
}

// ---------------------------------------------------------------------------
// CFR+
// ---------------------------------------------------------------------------

/* Regret matching+: the strategy is the positive part of cumulative regret, normalised; where the
   positive part is empty the strategy is `init` — uniform unless a seed chose otherwise. */
function regretMatch(R, K, A, out, init) {
  for (let i = 0; i < K; i++) {
    const b = i * A;
    let s = 0;
    for (let a = 0; a < A; a++) { const v = R[b + a]; if (v > 0) s += v; }
    if (s > 0) { for (let a = 0; a < A; a++) { const v = R[b + a]; out[b + a] = v > 0 ? v / s : 0; } }
    else if (init) { for (let a = 0; a < A; a++) out[b + a] = init[b + a]; }
    else { for (let a = 0; a < A; a++) out[b + a] = 1 / A; }
  }
}

/* xorshift32 — the same shape eval5.mjs's Rng uses, kept local so this module has no reason to
   import the hand evaluator. It seeds INITIAL STRATEGIES only; see TWO_SEED_AXES. */
function initTables(seed, K) {
  if (!seed) return null;
  let x = (seed >>> 0) || 1;
  const nx = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  const mk = (A) => {
    const o = new Float64Array(K * A);
    for (let i = 0; i < K; i++) {
      let s = 0; const t = [];
      for (let a = 0; a < A; a++) { const v = nx() + 1e-9; t.push(v); s += v; }
      for (let a = 0; a < A; a++) o[i * A + a] = t[a] / s;
    }
    return o;
  };
  return { n1: mk(2), n2: mk(3), n3: mk(3), n4: mk(3), n5: mk(2) };
}

/* Subtree values to SB, per (hero cell, villain cell), under the CURRENT profile, built bottom-up.
   U[k] is the value to SB of arriving at node k. The chain shape is what makes this four matrix
   passes instead of a tree walk. */
function subtreeValues(M, S, T, U) {
  const K = M.K2, { g2, g3, g4, g5 } = M;
  const { n2: s2, n3: s3, n4: s4, n5: s5 } = S;
  const f2 = T.nodes[1].foldNetSB, f3 = T.nodes[2].foldNetSB,
        f4 = T.nodes[3].foldNetSB, f5 = T.nodes[4].foldNetSB;
  const { U5, U4, U3, U2 } = U;
  for (let i = 0; i < K; i++) {
    const b = i * K;
    const p5f = s5[i * 2], p5c = s5[i * 2 + 1];
    const p3f = s3[i * 3], p3c = s3[i * 3 + 1], p3r = s3[i * 3 + 2];
    for (let j = 0; j < K; j++) {
      const u5 = p5f * f5 + p5c * g5[b + j];
      U5[b + j] = u5;
      const u4 = s4[j * 3] * f4 + s4[j * 3 + 1] * g4[b + j] + s4[j * 3 + 2] * u5;
      U4[b + j] = u4;
      const u3 = p3f * f3 + p3c * g3[b + j] + p3r * u4;
      U3[b + j] = u3;
      U2[b + j] = s2[j * 3] * f2 + s2[j * 3 + 1] * g2[b + j] + s2[j * 3 + 2] * u3;
    }
  }
}

/* Opponent-side reach vectors, chance included. `or*` is BB's contribution to SB's counterfactual
   reach and `sr*` is SB's to BB's. */
function reachVectors(S, q, K, R) {
  const { n1: s1, n2: s2, n3: s3, n4: s4 } = S;
  for (let j = 0; j < K; j++) { R.or3[j] = q[j] * s2[j * 3 + 2]; R.or5[j] = R.or3[j] * s4[j * 3 + 2]; }
  for (let i = 0; i < K; i++) { R.sr2[i] = q[i] * s1[i * 2 + 1]; R.sr4[i] = R.sr2[i] * s3[i * 3 + 2]; }
}

/**
 * Solve one tree with CFR+ — alternating updates, regret matching+, linear averaging.
 *
 * Those three are S-A's, and the first is not cosmetic: the vanilla-CFR control was still flipping
 * whole-cell argmaxes at iteration 99,467 while CFR+ stopped at 1,577. That is a difference in kind,
 * and it is the one algorithmic choice the spike forces.
 *
 * Returns the AVERAGE profile (what ships), the value under it, and the diagnostics I35 reads.
 */
export function solve({ matrices, tree, q, iters = ITER_CAP, seed = 0, trackFlips = false }) {
  const K = q.length;
  const M = {
    K2: K,
    g2: matrices.byNode.n2.net, g3: matrices.byNode.n3.net,
    g4: matrices.byNode.n4.net, g5: matrices.byNode.n5.net,
  };
  const mk = (A) => new Float64Array(K * A);
  const R = { n1: mk(2), n2: mk(3), n3: mk(3), n4: mk(3), n5: mk(2) };
  const S = { n1: mk(2), n2: mk(3), n3: mk(3), n4: mk(3), n5: mk(2) };
  const A = { n1: mk(2), n2: mk(3), n3: mk(3), n4: mk(3), n5: mk(2) };
  const U = { U5: new Float64Array(K * K), U4: new Float64Array(K * K), U3: new Float64Array(K * K), U2: new Float64Array(K * K) };
  const RV = { or3: new Float64Array(K), or5: new Float64Array(K), sr2: new Float64Array(K), sr4: new Float64Array(K) };
  const init = initTables(seed, K);

  const T = tree;
  const f1 = T.nodes[0].foldNetSB, f3 = T.nodes[2].foldNetSB, f5 = T.nodes[4].foldNetSB;
  const f2 = T.nodes[1].foldNetSB, f4 = T.nodes[3].foldNetSB;
  let lastFlip = 0;
  let prevArg = trackFlips ? new Int8Array(K * 5) : null;

  for (let t = 1; t <= iters; t++) {
    regretMatch(R.n1, K, 2, S.n1, init && init.n1); regretMatch(R.n2, K, 3, S.n2, init && init.n2);
    regretMatch(R.n3, K, 3, S.n3, init && init.n3); regretMatch(R.n4, K, 3, S.n4, init && init.n4);
    regretMatch(R.n5, K, 2, S.n5, init && init.n5);
    subtreeValues(M, S, T, U);
    reachVectors(S, q, K, RV);

    if (trackFlips) {
      const cur = argmaxes(S, K);
      if (t > 1) { for (let z = 0; z < cur.length; z++) if (cur[z] !== prevArg[z]) { lastFlip = t; break; } }
      prevArg = cur;
    }

    if ((t & 1) === 1) {
      // --- SB's turn. Counterfactual values integrate over BB's reach; q[i] is hero's own chance.
      let A1 = 0, A3 = 0, A5 = 0;
      for (let j = 0; j < K; j++) { A1 += q[j]; A3 += RV.or3[j]; A5 += RV.or5[j]; }
      for (let i = 0; i < K; i++) {
        const b = i * K, qi = q[i];
        let vOpen = 0, v3c = 0, v3r = 0, v5c = 0;
        for (let j = 0; j < K; j++) {
          vOpen += q[j] * U.U2[b + j];
          v3c += RV.or3[j] * M.g3[b + j];
          v3r += RV.or3[j] * U.U4[b + j];
          v5c += RV.or5[j] * M.g5[b + j];
        }
        accum2(R.n1, A.n1, S.n1, i, qi, t, f1 * A1, vOpen, 1);
        accum3(R.n3, A.n3, S.n3, i, qi, t, f3 * A3, v3c, v3r, S.n1[i * 2 + 1]);
        accum2(R.n5, A.n5, S.n5, i, qi, t, f5 * A5, v5c, S.n1[i * 2 + 1] * S.n3[i * 3 + 2]);
      }
    } else {
      // --- BB's turn. BB's utility is the negation of SB's, per terminal.
      let B2 = 0, B4 = 0;
      for (let i = 0; i < K; i++) { B2 += RV.sr2[i]; B4 += RV.sr4[i]; }
      for (let j = 0; j < K; j++) {
        const qj = q[j];
        let v2c = 0, v2r = 0, v4c = 0, v4r = 0;
        for (let i = 0; i < K; i++) {
          const b = i * K;
          v2c -= RV.sr2[i] * M.g2[b + j];
          v2r -= RV.sr2[i] * U.U3[b + j];
          v4c -= RV.sr4[i] * M.g4[b + j];
          v4r -= RV.sr4[i] * U.U5[b + j];
        }
        accum3(R.n2, A.n2, S.n2, j, qj, t, -f2 * B2, v2c, v2r, 1);
        accum3(R.n4, A.n4, S.n4, j, qj, t, -f4 * B4, v4c, v4r, S.n2[j * 3 + 2]);
      }
    }
  }
  const avg = {
    n1: normalise(A.n1, K, 2), n2: normalise(A.n2, K, 3), n3: normalise(A.n3, K, 3),
    n4: normalise(A.n4, K, 3), n5: normalise(A.n5, K, 2),
  };
  return { avg, iters, seed, lastFlip, K };
}

function argmaxes(S, K) {
  const out = new Int8Array(K * 5);
  const pick = (arr, A, i) => { let bi = 0; for (let a = 1; a < A; a++) if (arr[i * A + a] > arr[i * A + bi]) bi = a; return bi; };
  for (let i = 0; i < K; i++) {
    out[i * 5] = pick(S.n1, 2, i); out[i * 5 + 1] = pick(S.n2, 3, i); out[i * 5 + 2] = pick(S.n3, 3, i);
    out[i * 5 + 3] = pick(S.n4, 3, i); out[i * 5 + 4] = pick(S.n5, 2, i);
  }
  return out;
}

/* One infoset's regret update plus its linear-averaging contribution. `own` is the acting player's
   own reach to the infoset, which is what the average strategy must be weighted by. */
function accum2(R, A, S, i, qi, t, cf0, cf1, own) {
  const b = i * 2;
  const v = S[b] * cf0 + S[b + 1] * cf1;
  R[b] = Math.max(0, R[b] + qi * (cf0 - v));
  R[b + 1] = Math.max(0, R[b + 1] + qi * (cf1 - v));
  const w = t * own;
  if (w) { A[b] += w * S[b]; A[b + 1] += w * S[b + 1]; }
}
function accum3(R, A, S, i, qi, t, cf0, cf1, cf2, own) {
  const b = i * 3;
  const v = S[b] * cf0 + S[b + 1] * cf1 + S[b + 2] * cf2;
  R[b] = Math.max(0, R[b] + qi * (cf0 - v));
  R[b + 1] = Math.max(0, R[b + 1] + qi * (cf1 - v));
  R[b + 2] = Math.max(0, R[b + 2] + qi * (cf2 - v));
  const w = t * own;
  if (w) { A[b] += w * S[b]; A[b + 1] += w * S[b + 1]; A[b + 2] += w * S[b + 2]; }
}
function normalise(A, K, N) {
  const o = new Float64Array(K * N);
  for (let i = 0; i < K; i++) {
    const b = i * N;
    let s = 0; for (let a = 0; a < N; a++) s += A[b + a];
    if (s > 0) for (let a = 0; a < N; a++) o[b + a] = A[b + a] / s;
    else for (let a = 0; a < N; a++) o[b + a] = 1 / N;
  }
  return o;
}

// ---------------------------------------------------------------------------
// exact best response
// ---------------------------------------------------------------------------

/**
 * The value of a profile and both players' exact best responses against it.
 *
 * Exploitability is `(BR_SB + BR_BB) / 2` — NashConv halved, in bb per hand — and the bracket
 * `BR_SB >= v >= -BR_BB` is a correctness invariant of that arithmetic, reported so a sign error
 * cannot hide behind a small epsilon. Best response is EXACT, not another CFR run: at each of the
 * responder's infosets the counterfactual value of every action is computed against the fixed
 * opponent average and the maximum is taken, bottom-up so the responder's own later decisions are
 * themselves best responses.
 */
export function exploitability({ matrices, tree, q, avg }) {
  const K = q.length;
  const { n1: a1, n2: a2, n3: a3, n4: a4, n5: a5 } = avg;
  const g2 = matrices.byNode.n2.net, g3 = matrices.byNode.n3.net,
        g4 = matrices.byNode.n4.net, g5 = matrices.byNode.n5.net;
  const T = tree;
  const f1 = T.nodes[0].foldNetSB, f2 = T.nodes[1].foldNetSB, f3 = T.nodes[2].foldNetSB,
        f4 = T.nodes[3].foldNetSB, f5 = T.nodes[4].foldNetSB;

  // --- the value of the profile itself
  const U = { U5: new Float64Array(K * K), U4: new Float64Array(K * K), U3: new Float64Array(K * K), U2: new Float64Array(K * K) };
  subtreeValues({ K2: K, g2, g3, g4, g5 }, avg, T, U);
  let v = 0;
  for (let i = 0; i < K; i++) {
    let o = 0; for (let j = 0; j < K; j++) o += q[j] * U.U2[i * K + j];
    v += q[i] * (a1[i * 2] * f1 + a1[i * 2 + 1] * o);
  }

  // --- SB's best response against (a2, a4)
  const or3 = new Float64Array(K), or5 = new Float64Array(K);
  for (let j = 0; j < K; j++) { or3[j] = q[j] * a2[j * 3 + 2]; or5[j] = or3[j] * a4[j * 3 + 2]; }
  let A3 = 0, A5 = 0; for (let j = 0; j < K; j++) { A3 += or3[j]; A5 += or5[j]; }
  const B5 = new Float64Array(K * K), B4 = new Float64Array(K * K), B3 = new Float64Array(K * K), B2 = new Float64Array(K * K);
  let brSB = 0;
  for (let i = 0; i < K; i++) {
    const b = i * K;
    let c5 = 0; for (let j = 0; j < K; j++) c5 += or5[j] * g5[b + j];
    const call5 = c5 >= f5 * A5;
    for (let j = 0; j < K; j++) B5[b + j] = call5 ? g5[b + j] : f5;
    for (let j = 0; j < K; j++) B4[b + j] = a4[j * 3] * f4 + a4[j * 3 + 1] * g4[b + j] + a4[j * 3 + 2] * B5[b + j];
    let c3 = 0, r3 = 0;
    for (let j = 0; j < K; j++) { c3 += or3[j] * g3[b + j]; r3 += or3[j] * B4[b + j]; }
    const x3 = f3 * A3, best3 = Math.max(x3, c3, r3);
    for (let j = 0; j < K; j++) B3[b + j] = best3 === x3 ? f3 : (best3 === c3 ? g3[b + j] : B4[b + j]);
    for (let j = 0; j < K; j++) B2[b + j] = a2[j * 3] * f2 + a2[j * 3 + 1] * g2[b + j] + a2[j * 3 + 2] * B3[b + j];
    let o = 0; for (let j = 0; j < K; j++) o += q[j] * B2[b + j];
    brSB += q[i] * Math.max(f1, o);
  }

  // --- BB's best response against (a1, a3, a5)
  const sr2 = new Float64Array(K), sr4 = new Float64Array(K);
  for (let i = 0; i < K; i++) { sr2[i] = q[i] * a1[i * 2 + 1]; sr4[i] = sr2[i] * a3[i * 3 + 2]; }
  let S2 = 0, S4 = 0; for (let i = 0; i < K; i++) { S2 += sr2[i]; S4 += sr4[i]; }
  const W5 = new Float64Array(K * K), V4 = new Float64Array(K * K), V3 = new Float64Array(K * K);
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) W5[i * K + j] = -(a5[i * 2] * f5 + a5[i * 2 + 1] * g5[i * K + j]);
  let brBB = 0;
  for (let i = 0; i < K; i++) brBB += q[i] * a1[i * 2] * -f1;
  for (let j = 0; j < K; j++) {
    let c4 = 0, r4 = 0;
    for (let i = 0; i < K; i++) { c4 -= sr4[i] * g4[i * K + j]; r4 += sr4[i] * W5[i * K + j]; }
    const x4 = -f4 * S4, best4 = Math.max(x4, c4, r4);
    for (let i = 0; i < K; i++) V4[i * K + j] = best4 === x4 ? -f4 : (best4 === c4 ? -g4[i * K + j] : W5[i * K + j]);
    for (let i = 0; i < K; i++) V3[i * K + j] = a3[i * 3] * -f3 + a3[i * 3 + 1] * -g3[i * K + j] + a3[i * 3 + 2] * V4[i * K + j];
    let c2 = 0, r2 = 0;
    for (let i = 0; i < K; i++) { c2 -= sr2[i] * g2[i * K + j]; r2 += sr2[i] * V3[i * K + j]; }
    brBB += q[j] * Math.max(-f2 * S2, c2, r2);
  }

  return { v, brSB, brBB, eps: (brSB + brBB) / 2, bracketOk: brSB >= v - 1e-9 && v >= -brBB - 1e-9 };
}

/** worst |sum of one infoset's action probabilities - 1| over the whole profile */
export function simplexError(avg, K) {
  let worst = 0;
  for (const [name, N] of [['n1', 2], ['n2', 3], ['n3', 3], ['n4', 3], ['n5', 2]]) {
    const S = avg[name];
    for (let i = 0; i < K; i++) {
      let s = 0; let neg = false;
      for (let a = 0; a < N; a++) { const p = S[i * N + a]; s += p; if (!(p >= 0 && p <= 1)) neg = true; }
      const d = neg ? Infinity : Math.abs(s - 1);
      if (d > worst) worst = d;
    }
  }
  return worst;
}

/**
 * The accumulation bound on that sum: N normalised terms accumulate at most N roundings of half an
 * ulp each, plus the division's own. `N * Number.EPSILON` IS that bound — an arithmetic fact about
 * IEEE addition, not a tolerance somebody picked, which is why I35 asserts against it rather than
 * against a round number. Measured worst on the shipped model: 2.22e-16, one ulp.
 */
export const simplexBound = (N) => N * Number.EPSILON;

/**
 * The accumulation bound on the mirror residual at a terminal of pot `P`.
 *
 * `netFromResult` evaluates `ev * finalPot - invested`, so summing the two orderings sums two such
 * expressions. `ev_SB + ev_BB` is exactly 1 under a conserving source, but the PRODUCTS do not
 * cancel bit-for-bit: each is rounded to an ulp of a quantity of size ~P, i.e. `P * EPSILON`. Eight
 * of those is a generous bound on the handful of roundings involved and is still an arithmetic
 * fact rather than a tolerance. Measured worst on the shipped model: 1.42e-14 at P = 162, against a
 * bound of 2.88e-13 — a 20x margin, and NOT zero, which is why this exists at all.
 */
export const mirrorBound = (potMax) => 8 * potMax * Number.EPSILON;

// ---------------------------------------------------------------------------
// the one-call entry
// ---------------------------------------------------------------------------

/**
 * Solve the heads-up tree at one effective stack.
 *
 * `payoff` is injectable so P3 can hand in a real source without editing this file, and so gates
 * and tests can fabricate one to prove a clause fails. It defaults to the frozen accessor bound to
 * `model` — the pure route, `makePayoff`, never the process-wide singleton, because a solver that
 * silently used another model's payoffs is precisely the failure the memo rule is about.
 */
export function solveHU({ model, stack = 100, iters = ITER_CAP, seed = 0, payoff = null, trackFlips = false }) {
  const payoffFn = payoff || makePayoff(model);
  const modelHash = (payoff ? (payoff.modelHash || 'injected') : payoffFn.modelHash) || '';
  const tree = buildTree(stack);
  const live = liveCells(payoffFn, model);
  const { q, total } = chanceMeasure(model, live);
  const matrices = payoffMatrices(payoffFn, live, tree, seed, modelHash);
  const solved = solve({ matrices, tree, q, iters, seed, trackFlips });
  const ex = exploitability({ matrices, tree, q, avg: solved.avg });
  const source = dominantSource(matrices.sources);
  return {
    tree, live, q, comboTotal: total, matrices, avg: solved.avg, iters, seed,
    lastFlip: solved.lastFlip,
    value: ex.v, brSB: ex.brSB, brBB: ex.brBB, eps: ex.eps, bracketOk: ex.bracketOk,
    simplexError: simplexError(solved.avg, live.length),
    mirrorMax: matrices.mirrorMax, unsupported: matrices.unsupported,
    source, sources: matrices.sources,
    label: labelFor(source),
    frequencies: frequencies(solved.avg, q, live.length),
  };
}

/**
 * The surface's payoff source, resolved CONSERVATIVELY.
 *
 * If every terminal agreed, that is the source. If they did not, any checkdown contamination still
 * resolves to `'checkdown'`: a surface that is PARTLY a game where postflop does not exist is not a
 * solved one, and the label must survive a mixed source rather than being averaged away. Only a mix
 * with no checkdown in it reports `'mixed'`.
 */
function dominantSource(sources) {
  const keys = Object.keys(sources);
  if (keys.length === 1) return keys[0];
  if (keys.includes('checkdown')) return 'checkdown';
  return 'mixed';
}

/**
 * The Grade-C label, DERIVED FROM THE `source` DATUM AND FROM NOTHING ELSE.
 *
 * V3-PLAN §2's phase-0 annotation names the trap explicitly: the label must key off `source`, never
 * off `supported`. On this tree every heads-up showdown is `supported:true`, so a label keyed off
 * `supported` renders "solved" over a checkdown game — which is exactly the lie S-A's finding is
 * about (the checkdown equilibrium is BB-positive; a reader shown that without the label is shown a
 * lie). `labelProblems` is the detector I35 arms against that.
 */
export function labelFor(source) {
  return source === 'checkdown' ? 'a game where postflop does not exist' : null;
}

/** combo-weighted action frequencies — the numbers a reader actually looks at */
function frequencies(avg, q, K) {
  const w = (S, N, a) => { let s = 0; for (let i = 0; i < K; i++) s += q[i] * S[i * N + a]; return s; };
  return Object.freeze({
    sbOpen: w(avg.n1, 2, 1), sbFoldN1: w(avg.n1, 2, 0),
    bbFoldVsOpen: w(avg.n2, 3, 0), bbCallVsOpen: w(avg.n2, 3, 1), bb3bet: w(avg.n2, 3, 2),
    sb4bet: w(avg.n3, 3, 2), bbCap: w(avg.n4, 3, 2),
  });
}

// ---------------------------------------------------------------------------
// six-max: deferred, with the measurement that defers it
// ---------------------------------------------------------------------------

/**
 * The 6-max deferral record.
 *
 * V3-PLAN §3.3 greenlights 6-max MCCFR on ONE criterion — S-A landing inside half its wall-time
 * budget — and S-A cleared it by 5,400x. So budget is not why this module has no 6-max solver, and
 * saying "deferred" without saying why would inherit a decision instead of making one.
 *
 * The reason is the payoff's DOMAIN, and it is measured rather than argued (`multiwayProbe`):
 *
 *   1. every multiway request comes back `supported:false` — the accessor's multiway door is a
 *      flagged fallback, not an answer;
 *   2. the shares of a six-handed pot do NOT sum to 1 (measured 1.233 on the shipped model), so the
 *      "game" is not constant-sum and a fixed point of it is a fixed point of something that is not
 *      the game;
 *   3. hero's share is BIT-IDENTICAL across disjoint opponent sets — the multiway door reads hero's
 *      equity against RANDOM opponents, so no opponent's private cell enters any payoff. Every
 *      player's showdown value is independent of everybody else's hand.
 *
 * (3) is the one that settles it: MCCFR on payoffs that ignore the opponents' cards would converge,
 * quickly and correctly, to the equilibrium of a game in which the other five players' hands do not
 * exist. That is not a weaker baseline, it is a different question.
 *
 * GATED, NOT PROSE. I35 re-measures all three every run and FAILS if any of them stops being true —
 * so the day a payoff source makes multiway supported and constant-sum, this deferral is forced
 * back open instead of quietly outliving its reason. The §5.7 labeling is unchanged and the
 * "the baseline is HU" caveat is P3's to ship on-screen.
 */
export const SIXMAX = Object.freeze({
  status: 'deferred',
  budgetCriterion: 'met — S-A landed at 11 ms against the 60,000 ms half-budget, inside by 5,400x',
  reason: 'the payoff accessor has no supported multiway domain: every multiway request is '
    + 'supported:false, the six shares do not sum to 1, and hero\'s share does not depend on any '
    + "opponent's cell. A fixed point of that is not a fixed point of six-max PLO.",
  claimScope: 'fixed-point-only — if a 6-max solver is ever added here, nothing it produces may be '
    + 'labelled GTO or equilibrium; §5.7 says HU is "GTO" and anything multiway is "self-play fixed '
    + 'point", and I35 keeps that scope.',
  revisitWhen: 'a payoff source answers multiway requests with supported:true and constant-sum '
    + 'shares that depend on the opponents\' cells. I35 measures all three every run.',
});

/**
 * The evidence behind `SIXMAX`, measured live against whatever the accessor currently serves.
 *
 * Deterministic by construction — the tuples are strided across the live list rather than drawn at
 * random — so the gate's detail line is reproducible and a change in the number is a change in the
 * payoff, never in the sampling.
 */
export function multiwayProbe(payoffFn, live, { seats = 6, tuples = 24 } = {}) {
  const K = live.length;
  if (K < seats + 1) return { seats, tuples: 0, supportedCount: 0, worstShareDev: null, opponentInvariant: null };
  let supportedCount = 0, worstShareDev = null, opponentInvariant = true, checked = 0;
  for (let t = 0; t < tuples; t++) {
    const seat = [];
    for (let s = 0; s < seats; s++) seat.push(live[(t * 7 + s * 17 + s * s) % K]);
    let sum = 0;
    for (let s = 0; s < seats; s++) {
      const rot = seat.slice(s).concat(seat.slice(0, s));
      const r = payoffFn(rot, 10, 4, { ip: false, seed: 0 });
      if (r.supported) supportedCount++;
      sum += r.ev;
    }
    checked++;
    const d = Math.abs(sum - 1);
    if (worstShareDev === null || d > worstShareDev) worstShareDev = d;
    // does hero's share move when every opponent is replaced?
    const hero = seat[0];
    const other = [hero];
    for (let s = 1; s < seats; s++) other.push(live[(K - 1 - ((t * 5 + s * 11) % (K - 1)))]);
    if (other.slice(1).includes(hero)) continue;
    const a = payoffFn(seat, 10, 4, { ip: false, seed: 0 }).ev;
    const b = payoffFn(other, 10, 4, { ip: false, seed: 0 }).ev;
    if (a !== b) opponentInvariant = false;
  }
  return { seats, tuples: checked, supportedCount, worstShareDev, opponentInvariant };
}

/**
 * Is the 6-max deferral still justified by the payoff it was deferred over?
 *
 * This is the teeth in `SIXMAX`. A deferral recorded as prose outlives its reason silently; this
 * one is re-derived every run from a live measurement, and it FAILS when the reason stops holding.
 * All three facts must be true for the deferral to stand:
 *
 *   - nothing multiway is `supported`;
 *   - the seats' shares do not sum to 1 (so there is no zero-sum game to solve);
 *   - hero's share does not depend on the opponents' cells (so no opponent's hand is in any payoff).
 *
 * `hasSolver` is the other half of the same claim: if a 6-max solver IS present, the deferral is
 * over and the caller must be making fixed-point-only claims instead. The two are reported
 * separately so the gate's message says which situation it is in.
 */
export function sixmaxDeferralProblems(probe, hasSolver) {
  const out = [];
  if (hasSolver) {
    out.push('a 6-max solver is present while SIXMAX still records the deferral — either the record '
      + 'is stale or the solver is unlabelled; §5.7 allows only "self-play fixed point" for anything multiway');
    return out;
  }
  if (!probe || typeof probe !== 'object') return ['the multiway probe returned nothing to justify the deferral with'];
  if (!(probe.tuples > 0)) out.push('the multiway probe measured nothing, so the deferral rests on no evidence');
  if (probe.supportedCount > 0) {
    out.push(`the payoff now answers ${probe.supportedCount} multiway request(s) with supported:true — `
      + 'the domain reason for deferring 6-max no longer holds and the decision must be re-made');
  }
  if (probe.worstShareDev !== null && !(probe.worstShareDev > 0)) {
    out.push('the multiway shares now sum to 1 — the multiway game is constant-sum, so the '
      + 'not-a-game reason for deferring 6-max no longer holds');
  }
  if (probe.opponentInvariant === false) {
    out.push("hero's multiway share now depends on the opponents' cells — the payoff carries "
      + 'multiway information and the deferral must be re-made');
  }
  return out;
}

// ---------------------------------------------------------------------------
// the disclosure detectors — exported so the gate and the tests arm the SAME code
// ---------------------------------------------------------------------------

/**
 * (cap list) Does a candidate on-screen cap list match the tree the solver actually walked?
 *
 * Two directions, because only one of them is the obvious one. A list that DROPS an omission
 * understates the abstraction — the reader is not told postflop is missing. A list that CLAIMS an
 * omission the tree in fact contains overstates it, and that is the direction a stale list drifts
 * in when the tree grows. Both fail here.
 *
 * The comparison is over the DECLARATION and the tree's own structure, never over prose: the
 * structural half re-derives "no limp" and "no sixth raise" from the node table, so a tree that
 * gains a limp while the list still says "no SB limp" fails even if the list and the declaration
 * agree.
 *
 * THE THIRD DIRECTION, AND WHY IT EXISTS (P2 red team, docs/refutations/P2.md). Two refuters
 * deleted an entry from `CAPS.omitted` itself and watched I35 pass — because the tree-derived half
 * was GUARDED by `CAPS.omitted.some(/limp/i)`, so removing the declaration also removed the check
 * written to catch the tree growing that action. `capListProblems(shipped list, limpTree)` returned
 * `[]` on a tree that plainly contained an SB limp. The declaration and the audit of the
 * declaration were the same object. The tree is now the authority in BOTH directions: an action the
 * tree does not offer must be DECLARED as an omission, and an action it does offer must not be
 * denied. P2 ships no on-screen list, so this costs nothing today; it is the clause P3 leans on.
 *
 * `omitted` is a parameter rather than a closure over `CAPS` for one reason: a check whose
 * declaration cannot be varied is a check whose declaration cannot be ARMED. Callers pass
 * `CAPS.omitted`; the arming passes a mutilated copy.
 */
export function capListProblems(list, tree, omitted = CAPS.omitted) {
  const out = [];
  if (!Array.isArray(list)) return ['the cap list is not an array'];
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const shown = list.map(norm);
  for (const cap of omitted) {
    if (!shown.some((s) => s === norm(cap))) out.push(`the cap list omits "${cap}"`);
  }
  for (const s of shown) {
    if (!omitted.some((cap) => norm(cap) === s) && !CAPS.modelled.some((m) => norm(m) === s)) {
      out.push(`the cap list carries "${s}", which is neither a declared omission nor a declared feature`);
    }
  }
  if (tree) {
    const n1 = tree.nodes[0], last = tree.nodes[tree.nodes.length - 1];
    /* a claim of absence, from EITHER the declaration or the list being audited — the tree decides
       which of the two directions applies, and it can no longer be silenced by deleting the claim */
    const denies = (re) => omitted.some((c) => re.test(c)) || shown.some((s) => re.test(s));
    const declares = (re) => omitted.some((c) => re.test(c));
    const cases = [
      [/limp/i, n1.actions.includes('call'), 'an SB limp',
        'the tree offers the SB no limp and nothing declares that omission — an omission absent from '
        + 'the declaration is invisible to every reader and to every other clause here'],
      [/sixth raise/i, last.actions.includes('raise'), 'a sixth raise',
        'the tree caps the raise ladder and nothing declares that omission — the cap is the whole '
        + 'abstraction choice and it must be said out loud'],
    ];
    for (const [re, present, what, undeclared] of cases) {
      if (present) {
        if (denies(re)) out.push(`the tree contains ${what} but the cap list still claims there is none`);
      } else if (!declares(re)) {
        out.push(undeclared);
      }
    }
  }
  return out;
}

/**
 * (checkdown label) Is a solved surface's label derived from `source`, and not from `supported`?
 *
 * The armed failure is specific and is the one the plan names: on this tree every heads-up showdown
 * is `supported:true`, so a surface whose label keys off `supported` shows no caveat at all over a
 * checkdown game. The detector therefore checks the VALUE against `labelFor(source)` rather than
 * checking that a label merely exists.
 */
export function labelProblems(surface) {
  const out = [];
  if (!surface || typeof surface !== 'object') return ['the surface is not an object'];
  if (typeof surface.source !== 'string') out.push('the surface carries no `source` datum to derive a label from');
  const want = labelFor(surface.source);
  const got = surface.label === undefined ? null : surface.label;
  if (want !== null && got !== want) {
    out.push(`the payoff source is '${surface.source}' but the label is ${JSON.stringify(got)} — `
      + `it must be ${JSON.stringify(want)}, derived from \`source\` and never from \`supported\``);
  }
  if (want === null && got !== null) {
    out.push(`the payoff source is '${surface.source}' but the surface still carries the checkdown label`);
  }
  return out;
}

/**
 * (constants block) Does a shipped constants block agree with this module's anchored values?
 *
 * P2 ships no such block — `model.constants` is written by the data generator and P2 does not
 * regenerate the model (see CONSTANTS). So this runs over zero blocks today and I35 says so in its
 * detail line rather than passing quietly. It is written now, and armed now, so that P3's
 * regeneration cannot introduce a drifted copy: the failure mode of a constant that lives in two
 * places is that one of them moves.
 */
export function constantsBlockProblems(block) {
  const out = [];
  if (!block || typeof block !== 'object') return ['the constants block is not an object'];
  for (const c of CONSTANTS) {
    const short = c.name.slice(c.name.indexOf('.') + 1);
    const have = Object.prototype.hasOwnProperty.call(block, short) ? block[short] : undefined;
    if (have === undefined) { out.push(`the constants block is missing ${c.name}`); continue; }
    if (have !== c.value) out.push(`the constants block says ${c.name} = ${JSON.stringify(have)}, the solver uses ${JSON.stringify(c.value)}`);
  }
  return out;
}
