// payoff.mjs — THE PAYOFF INTERFACE, FROZEN (V3-PLAN §2), AMENDED at the P2 pre-stage. I33 pins it.
//
// WHAT THIS IS. One accessor, four arguments, six return keys:
//
//     payoff(cells, potSize, spr, opts) -> { ev, se, source, supported, potMult, invShare }
//
// The four arguments are the ORIGINAL freeze and have not moved. The last two return keys are the
// P2 pre-stage amendment (V3-PLAN §2's `Amended` block, §3.2's Measured block): spike S-B measured
// that `EVbb = ev*finalPot - invested` cannot be computed from `ev` alone, and the pot term is
// wrong by up to an order of magnitude without them. See THE BB CONVERSION below.
//
// It is the unlock for the whole v3 chain. The CFR engine, the EV presentation, the absolute-EV
// cut and the inspector all fan out against THIS SIGNATURE while the thing behind it is still a
// stub, which is why the interface is frozen at Phase 0 and the estimator is not written until P2.
// Nothing in the chain may start before I33 is green (§2, §12's B0 barrier); once it is, all four
// start at once. The freeze is therefore a promise about the SHAPE, deliberately made before
// anybody knows the CONTENT.
//
// THE CONTRACT, clause by clause.
//
//   cells     cell keys, HERO FIRST. Length 2 is heads-up and is the supported domain. Longer is
//             "the multiway door" (§2): a multiway request returns a number, but with
//             `supported:false` on it — never a guess dressed as an answer.
//   potSize   the pot at the decision node, in CURRENT-UNIT bb (straddle-aware; the caller gets
//             the unit from `unitBB(env)`). Validated here; unused by the stub, because `ev` is a
//             pot FRACTION and a fraction does not know how big the pot is.
//   spr       effective stack / potSize at the decision node. Validated; the stub is spr-inert,
//             which is exactly what "checkdown" means — see THE STUB below.
//   opts      { ip, seed }. POSITION ENTERS THROUGH THE ARGUMENT, NEVER THROUGH GLOBAL STATE.
//             That rule is the whole reason `opts` exists at B0, when the stub cannot use it:
//             freezing the argument now means the first source that DOES depend on position
//             changes this function's body and none of its call sites.
//
//   ev        hero's expected share of the final pot, a pot fraction in [0,1]. Unit-pure: the bb
//             conversion (`EVbb = ev*finalPot - invested`) is CALLER arithmetic, so rake and depth
//             reach the number through the existing exact machinery (`rakeFraction`, `unitBB`)
//             instead of being re-modeled in here. THE BB CONVERSION below states which two of the
//             three quantities in that expression come back from here and which one does not.
//   se        one standard error, same unit, NEVER ABSENT and never typed — see THE ERROR BAR.
//   source    'checkdown' | 'model' | 'simulated'. This is where the honesty lives. `supported`
//             says whether the REQUEST was in the measured domain; `source` says what kind of
//             number came back. A heads-up answer today is `supported:true` and
//             `source:'checkdown'` — a real answer to a real request, in a game where postflop
//             does not exist. Downstream badges (I35's Grade-C label) key off `source`, NOT off
//             `supported`, or they will silently upgrade the checkdown game to a solved one.
//   supported false => `ev` is a fallback and the caller must badge it (§2 clause (f), and the
//             page's existing `badge: 'unsupported'` idiom is the precedent). Amended at the P2
//             pre-stage with the CARD-REMOVAL clause: see WHAT `supported:false` IS FOR.
//   potMult   E[final pot] / potSize — the pot MULTIPLIER from the decision node to the end of the
//             hand, uncalled bets included (S-B's `sumF/deals`, its REF3 pot normalised to 1).
//             Structurally >= 1: the final pot contains the pot at the node and nobody takes chips
//             back out. S-B measured 1.603 .. 11.865 across its 300 reference points.
//   invShare  E[hero's investment AFTER the decision node] / E[final pot], in [0,1]. S-B measured
//             the same ratio at 0.199 .. 0.730 with the pre-node contribution included; the
//             difference between the two readings is a normalisation, not a measurement, and THE BB
//             CONVERSION below is where that is spelled out and converted back.
//
// Out-of-domain NEVER throws and NEVER returns an unflagged number. Every exit below returns all
// six keys.
//
// THE BB CONVERSION, AND WHY FOUR KEYS WERE NOT ENOUGH (amendment (i), P2 pre-stage).
//
// §2 froze this file at four keys and left `EVbb = ev*finalPot - invested` to the caller. S-B then
// measured what a caller cannot do with `ev` alone: over 300 reference points `E[F]/potSize` ranged
// **1.603 to 11.865** and hero's share of `E[F]` ranged **0.199 to 0.730**. A caller assuming
// `finalPot == potSize` is wrong in the pot term by up to an order of magnitude — not a rounding
// error, a different game. So the freeze is amended and the accessor returns S-B's two measured
// quantities beside `ev`. The caller's arithmetic, in full:
//
//     finalPot = potMult * potSize
//     invested = heroPre + invShare * finalPot
//     EVbb     = ev * finalPot - invested
//
// where `heroPre` is HERO'S OWN CONTRIBUTION TO `potSize` — what he had already put in when this
// node was reached. It is caller-known, because the caller BUILT the node (it is the blind, the
// limp, the open, whatever hero paid to get here), and it is deliberately not an argument here.
//
// WHICH IS THE FINDING, RECORDED RATHER THAN PATCHED AWAY. S-B's `invShare` is
// `E[hero invested TOTAL] / E[F]`, and its total includes the PRE-node part, which REF3 supplies by
// NORMALISATION (`pot = 1`, `c0 = c1 = 0.5` in `playRef`) rather than by measurement — a symmetric
// split is an assumption about the node, not a property of it. The four frozen arguments carry
// `potSize` but not hero's share of it, so the pre-node half is not a function of (arguments,
// model) and cannot honestly come back from here. The POST-node half is, so that is what `invShare`
// means in this interface:
//
//     invShare(this file)  =  S-B's invShare  -  heroPre / finalPot
//
// — S-B's own quantity minus its reference normalisation, never a typed split. The conversion back
// is exact and one line: `total = heroPre/finalPot + invShare` (at REF3's normalisation heroPre is
// 0.5 and potSize is 1). ARITY STAYS FOUR. If a future source needs `heroPre` for itself — to size
// a bet against hero's remaining stack, say — it arrives through `opts`, which is the door §2 froze
// for exactly this; it does not become a fifth argument.
//
// THE STUB, AND THE ONE PLACE THIS FILE REFINES §2.
//
// §2 specifies the stub as "returns shipped `eq[N]` at every spr". Taken literally that cannot
// pass §2's own clause (b): `eq` is measured VS RANDOM OPPONENTS, so it ignores who the villain
// actually is, and `eq_A + eq_B` is not 1 for almost any pair — conservation fails ~everywhere.
// The two clauses are only jointly satisfiable if the stub conserves. So the heads-up stub returns
// the ZERO-SUM PROJECTION of the shipped measurement:
//
//     ev(A vs B) = ( eq_A[0]/100  +  (1 - eq_B[0]/100) ) / 2   ==   0.5 + (eq_A[0] - eq_B[0])/200
//
// — the average of two readings of the same quantity: what A measured for itself against a random
// field, and what B's own measurement implies A must have got. It is built from shipped numbers
// only, introduces ZERO new constants, conserves EXACTLY (the second form above is the one the
// code evaluates, and it makes the two orderings sum to 1 to the last bit — see the comment at the
// heads-up branch), and is strictly increasing in hero's checkdown equity, which is what the
// monotonicity clause needs to have something to falsify later. It is still checkdown — it knows
// nothing about position, stacks or the flop — and it says so in `source`.
//
// Multiway takes no projection: there is no pair to project onto, so it returns hero's shipped
// `eq[N-1]` for N opponents, flagged `supported:false`. A number, flagged; never a guess presented
// as supported.
//
// THE STUB'S TWO POT IDENTITIES, which are identities rather than choices. Checkdown means NO
// BETTING AFTER THE DECISION NODE. So the final pot IS the pot at the node, `F = potSize`, and:
//
//     potMult  === 1   exactly, at every spr, on every return this file makes
//     invShare === 0   exactly — hero invests nothing after a node nobody bets at
//
// ZERO NEW CONSTANTS: both fall out of what checkdown IS, and neither is a number anybody picked.
// `potMult === 1` survives the malformed paths too, because a multiplier is unit-free and no bet is
// made on a request that was never in the game. I33 asserts both as identities over the whole
// heads-up sweep, so the first source that MOVES them is measured against a pinned baseline rather
// than against nobody's expectation.
//
// WHAT `supported:false` IS FOR (amendment (iii), P2 pre-stage). §2 wrote it as the multiway door.
// S-B measured its real domain: CARD-REMOVAL degeneracy. Cells pinning the same ranks make some
// (cell, cell, board) triples impossible from the observer's seat — `AA_DANGLER|RB` x
// `AA_BIGPAIR|DS` is degenerate on **12.56%** of street evaluations (four aces, two hands), mean
// 0.73% over 50 pairs, 4 of 50 over 1%; S-A independently found **43 structurally undealable
// pairs**, all `AA_*` x `A_BLOCKED`, combo mass 3.6e-5. The failure mode is SILENT — S-B's first
// implementation dead-carded the range against the opponent's actual hand and collapsed every
// AA-vs-AA pair to a checkdown with no error raised. The amended clause: any source that evaluates
// against DEALT BOARDS must surface degeneracy honestly — an undealable or degenerate request comes
// back `supported:false` (which is what "flagged" means in a six-key return that carries no mass
// field), never a silent collapse to checkdown. THIS STUB DEALS NOTHING and is exempt by
// construction: it reads shipped equity ladders, so it answers those pairs `source:'checkdown'`,
// which is exactly what the exemption is keyed on. I33 clause (h) is the detector.
//
// THE ERROR BAR. `se` is the binomial standard error of the share at the trial count that ACTUALLY
// RAN — `model.meta.trials.cell`, 100,000 for the shipped dataset:
//
//     se(p, n) = sqrt( p(1-p) / n ),   p clamped to [1/(n+1), n/(n+1)] so it is provably > 0
//
// At p = 0.5 this is `policy.seOfTrials(n) / 100` exactly — the same shipped basis the villain
// accessor and the Simulate badge already quote (`meta.se.cell` = 0.16 percentage points). It is
// derived, never typed, and this file does not import policy.mjs to get it: the arithmetic is two
// lines and the dependency would couple the objective layer to the opinion layer for nothing.
// The heads-up projection reads TWO cells, so its error is the error of their mean:
// `se = hypot(se_A, se_B) / 2`.
//
// Where no cell backs the number at all — an unresolvable hero on a malformed request — the trial
// count is ZERO and `se` is `Infinity`. That is not a deviation from the formula, it IS the
// formula at the honest n, and it matches the shipped `seOfTrials(0) -> Infinity` convention. The
// alternative would be to quote 100,000 trials' precision on a number no trial produced, which is
// the exact "typed se" clause (d) forbids.
//
// PURITY AND MEMOIZATION. Pure function of (arguments, model). No memo lives here, deliberately:
// B0 does not need one and a cache is how the `envKey` docstring's trap gets sprung — a key that
// forgot an argument hands back another environment's answer, silently.
//
// THE MEMO RULE, AMENDED AND NAMED (amendment (ii), P2 pre-stage). When a memo is finally
// warranted — here, or in ANY consumer, `cfr.mjs` and `payoff-model.mjs` first and P4's EV cut
// after them — the key carries EVERY ONE of:
//
//     cells,  potSize,  spr,  opts.ip,  opts.seed,  and  makePayoff(model).modelHash
//
// `opts.ip` is named separately, beside the model hash, because it is the one an implementer will
// drop. Today's stub is position-inert, so a keyless memo returns the RIGHT number and no test of
// VALUES can see the bug. S-B measured what happens the day a source is not inert:
// `ev(A,B,ip) != ev(A,B,not ip)` BY UP TO **43 POINTS**, while `ev(A,B,ip) + ev(B,A,not ip) = 1`
// still holds exactly. A memo missing `ip` is therefore wrong by more than the entire error budget
// — the pre-registered Grade A edge is 2.5 pt — and it is wrong silently. That is the `envKey`
// docstring's trap in a new place, and I33 clause (g) is the detector that covers this file, the
// page's mirrored copy, and the consumers before they exist.
//
// TWO WAYS IN, and the difference matters. `makePayoff(model)` is the pure route and takes the
// model as an argument — that is what gates and tests use to fabricate models and prove clauses
// can fail. `payoff(...)` is the convenience route bound to one process-wide model, resolved once.
//
// BROWSER SAFETY. §2 says this file is "present in both builds", so it must survive
// `build.mjs`'s `moduleToIife`: no top-level `import` and no export form beyond
// `export const|let|function|class`. Everything Node-only — the `data/model.json` loader and its
// `node:` imports — lives below the `@browser-cut` marker at the foot of the file, the same idiom
// taxonomy.mjs uses. The page's boot hook is `setDefaultModel(MODEL)`.

/** the three legal `source` values, in increasing order of how much postflop they know about */
export const SOURCES = Object.freeze(['checkdown', 'model', 'simulated']);

/**
 * The six keys of a payoff result, frozen. I33(a) asserts a return carries exactly these.
 *
 * ORDER IS PART OF THE PIN. `potMult` and `invShare` are APPENDED by the P2 pre-stage amendment,
 * never interleaved with the original four: `test/ui-payoff-mirror.test.mjs` compares this array
 * and `Object.keys()` of a return against the page's mirrored copy in ORDER, so a reorder is a red
 * test rather than a cosmetic diff.
 */
export const RESULT_KEYS = Object.freeze(['ev', 'se', 'source', 'supported', 'potMult', 'invShare']);

// ---------------------------------------------------------------------------
// the arithmetic
// ---------------------------------------------------------------------------

/**
 * The binomial standard error of a share at the trial count that produced it, in pot fractions.
 *
 * `p` is clamped to [1/(n+1), n/(n+1)] — the Laplace endpoints — so a cell measured at 0% or 100%
 * still reports a positive, finite error rather than claiming certainty from a finite sample.
 * `n <= 0` means no trials ran, and the honest error on a number no trial produced is Infinity.
 */
function seOfShare(p, n) {
  if (!(typeof n === 'number' && Number.isFinite(n) && n > 0)) return Infinity;
  if (!(typeof p === 'number' && Number.isFinite(p))) return Infinity;
  const lo = 1 / (n + 1), hi = n / (n + 1);
  const q = Math.min(hi, Math.max(lo, p));
  return Math.sqrt((q * (1 - q)) / n);
}

/**
 * Assemble the return. The six keys, always, in a fixed order.
 *
 * The one thing this does beyond packing: a value outside its contracted range can never leave here
 * wearing `supported:true`. That is the "never returns an unflagged number" half of the contract
 * holding even when the MODEL is wrong — a percent/fraction slip, say. The P2 pre-stage amendment
 * extends the same idiom to the two new keys, so they cannot be an unflagged number either:
 * `potMult` must be finite and >= 1 (the final pot CONTAINS the pot at the node — chips do not come
 * back out) and `invShare` must be finite and in [0,1] (hero cannot invest more after the node than
 * the whole final pot). Both are structural bounds of the definitions, not constants anybody chose.
 *
 * The bad number is still RETURNED rather than clamped away, because I33(a) asserts the ranges on
 * every return and a clamp would hide from the gate exactly the bug the gate exists to find.
 */
function finish(ev, se, source, supported, potMult, invShare) {
  const evOk = typeof ev === 'number' && Number.isFinite(ev) && ev >= 0 && ev <= 1;
  const seOk = typeof se === 'number' && se > 0 && !Number.isNaN(se);
  const pmOk = typeof potMult === 'number' && Number.isFinite(potMult) && potMult >= 1;
  const isOk = typeof invShare === 'number' && Number.isFinite(invShare) && invShare >= 0 && invShare <= 1;
  return {
    ev,
    se: seOk ? se : Infinity,
    source,
    supported: !!supported && evOk && seOk && pmOk && isOk,
    potMult,
    invShare,
  };
}

/** the cell if it exists AND carries a usable equity ladder, else null. Own properties only —
 *  `'constructor'` and `'__proto__'` are unknown keys, not inherited answers. */
function cellOf(M, key) {
  if (typeof key !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(M.cells, key)) return null;
  const c = M.cells[key];
  if (!c || typeof c !== 'object' || !Array.isArray(c.eq) || c.eq.length === 0) return null;
  for (const v of c.eq) if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return c;
}

/**
 * A seed must be reproducible or it is not a seed. The stub ignores the value, but the SHAPE is
 * frozen now for the same reason `ip` is: so the first `source:'simulated'` implementation changes
 * this file and nothing else. Absence is not out-of-domain — `opts` itself is optional.
 */
function seedOk(seed) {
  if (seed === undefined || seed === null) return true;
  if (typeof seed === 'number') return Number.isFinite(seed);
  return typeof seed === 'string' && seed.length > 0;
}

// ---------------------------------------------------------------------------
// the evaluator
// ---------------------------------------------------------------------------

/**
 * @param {object} M        a prepared model (see `prepare`)
 * @param {string[]} cells  cell keys, hero first
 * @param {number} potSize  pot at the node, current-unit bb
 * @param {number} spr      effective stack / potSize
 * @param {{ip?: boolean, seed?: number|string}} [opts]
 * @returns {{ev: number, se: number, source: string, supported: boolean,
 *            potMult: number, invShare: number}}
 *          `potMult` is E[final pot]/potSize and `invShare` is E[hero's POST-node investment]/E[F];
 *          under checkdown they are exactly 1 and exactly 0. See THE BB CONVERSION in the header
 *          for the caller arithmetic they complete, and for the `heroPre` term the caller owns.
 */
function evaluate(M, cells, potSize, spr, opts) {
  // --- the arguments, validated. Nothing below this block throws.
  let optsOk = true;
  let ip = false;
  if (opts !== undefined && opts !== null) {
    if (typeof opts === 'object' && !Array.isArray(opts)) {
      ip = !!opts.ip;
      optsOk = seedOk(opts.seed);
    } else {
      optsOk = false;
    }
  }
  /* `ip` is read and then deliberately unused. The checkdown game has no position — realization is
     exactly what checkdown equity does not measure — so the stub cannot honestly consume it. It is
     coerced anyway so the argument's shape is frozen at B0 (§2: position enters through the
     argument, never through global state). Deleting this line would be the start of position
     re-entering through a global. */
  void ip;

  const potOk = typeof potSize === 'number' && Number.isFinite(potSize) && potSize > 0;
  const sprOk = typeof spr === 'number' && Number.isFinite(spr) && spr >= 0;

  const isArr = Array.isArray(cells);
  const len = isArr ? cells.length : 0;
  const maxCells = M.nMax + 1;                 // eq has nMax entries: eq[i] = vs i+1 opponents
  const shapeOk = isArr && len >= 2 && len <= maxCells;

  const hero = isArr && len > 0 ? cellOf(M, cells[0]) : null;
  let allKnown = shapeOk && hero !== null;
  if (allKnown) for (let i = 1; i < len; i++) if (cellOf(M, cells[i]) === null) { allKnown = false; break; }

  const inDomain = optsOk && potOk && sprOk && shapeOk && allKnown;

  // --- heads-up: the supported domain. The zero-sum projection of the shipped measurement.
  if (inDomain && len === 2) {
    const villain = cellOf(M, cells[1]);
    const pA = hero.eq[0] / 100;
    const pB = villain.eq[0] / 100;
    /* `0.5 + (pA - pB)/2` is `(pA + (1 - pB))/2` rearranged, and the rearrangement is the point:
       IEEE negation is exact, so `(pB - pA)` is bit-for-bit `-(pA - pB)` and the two orderings sum
       to EXACTLY 1 rather than to 1 within a few ulps. That lets I33(b) assert conservation as an
       identity instead of as a tolerance, which is a much harder thing to break by accident. */
    const ev = 0.5 + (pA - pB) / 2;
    const se = Math.hypot(seOfShare(pA, M.trials), seOfShare(pB, M.trials)) / 2;
    /* `1, 0` is the checkdown pot geometry, not a pair of chosen numbers: no betting after the
       decision node means the final pot IS the pot at the node (E[F] = potSize, so the multiplier
       is 1) and hero invests nothing after it (post-node share 0). Every return below repeats the
       same two identities for the same reason. */
    return finish(ev, se, 'checkdown', true, 1, 0);
  }

  // --- multiway: the checkdown fallback, flagged. eq[N-1] for N = len-1 opponents.
  if (inDomain) {
    const p = hero.eq[len - 2] / 100;
    return finish(p, seOfShare(p, M.trials), 'checkdown', false, 1, 0);
  }

  // --- out of domain. A number, always flagged, never an exception.
  if (hero) {
    // the request was malformed but the HERO resolves, so the honest fallback is hero's own
    // checkdown ladder, read at the nearest measured opponent count.
    const i = Math.min(Math.max(len - 2, 0), hero.eq.length - 1);
    const p = hero.eq[i] / 100;
    return finish(p, seOfShare(p, M.trials), 'checkdown', false, 1, 0);
  }
  // nothing resolves: the only defensible number is an equal share of the pot, and no trial
  // produced it, so its error bar is Infinity (n = 0, the shipped seOfTrials(0) convention).
  const ev = 1 / Math.max(2, len);
  /* even here: nothing was bet on a request that was never in the game, so the pot geometry is
     still the checkdown geometry. `se` is Infinity, which is what flags the number; the two pot
     keys are exact and say so. */
  return finish(ev, seOfShare(ev, 0), 'checkdown', false, 1, 0);
}

// ---------------------------------------------------------------------------
// the two ways in
// ---------------------------------------------------------------------------

/**
 * Validate a model into the shape `evaluate` reads, once.
 *
 * This THROWS on a model it cannot use, and that is deliberate — it is the one place in this file
 * that does. "Out-of-domain never throws" is a promise about REQUESTS: a caller asking about a
 * hand nobody measured gets a flagged number. A missing model is not a request, it is a wiring
 * error, and there is no honest answer to give: with no `meta.trials.cell` there is no trial count
 * to derive `se` from, and the only alternative would be to type one — which clause (d) forbids.
 * Failing loudly at wiring time beats a silent Infinity everywhere at run time.
 */
function prepare(model) {
  if (!model || typeof model !== 'object' || !model.cells || typeof model.cells !== 'object') {
    throw new TypeError('payoff: no model.cells — a payoff with no measurement behind it has no `se` to report');
  }
  const meta = (model.meta && typeof model.meta === 'object') ? model.meta : {};
  const trials = meta.trials && meta.trials.cell;
  if (!(typeof trials === 'number' && Number.isFinite(trials) && trials > 0)) {
    throw new TypeError('payoff: model.meta.trials.cell is missing or not positive — `se` must be '
      + 'derived from the trial count that actually ran (V3-PLAN §2 clause d) and there is none to read');
  }
  // nMax from the data where possible, from meta only as a fallback: the equity ladder's own
  // length is what actually bounds the multiway door, and a stale meta must not widen it.
  let nMax = 0;
  for (const k of Object.keys(model.cells)) {
    const c = model.cells[k];
    if (c && Array.isArray(c.eq) && c.eq.length > nMax) nMax = c.eq.length;
  }
  if (!nMax && typeof meta.nMax === 'number' && Number.isFinite(meta.nMax) && meta.nMax > 0) nMax = meta.nMax;
  return { cells: model.cells, trials, nMax, hash: typeof meta.hash === 'string' ? meta.hash : '' };
}

/**
 * Bind the payoff accessor to one model. The pure route.
 *
 * The returned function has arity 4 and the frozen signature; it carries `.modelHash`, which is
 * ONE component of any future memo key (§2: "pure function of (args, model hash)"). The others are
 * `cells`, `potSize`, `spr`, `opts.seed` and — named separately because it is the one that gets
 * dropped — `opts.ip`. See THE MEMO RULE in the header; I33(g) is the detector.
 */
export function makePayoff(model) {
  const M = prepare(model);
  const fn = function payoff(cells, potSize, spr, opts) {
    return evaluate(M, cells, potSize, spr, opts);
  };
  fn.modelHash = M.hash;
  return fn;
}

/* The process-wide model, resolved once. In Node it is `data/model.json`, loaded below the
   @browser-cut; in the page it is the injected `MODEL`, handed over by `setDefaultModel` at boot. */
let DEFAULT = null;
let loadShippedModel = () => {
  throw new TypeError('payoff: no default model — the page must call setDefaultModel(MODEL) at boot '
    + '(the Node loader lives below the @browser-cut marker and was stripped from this build)');
};

/**
 * Install the process-wide model. Call it before the first `payoff()`; it replaces whatever was
 * there. Anyone who needs two models live at once wants `makePayoff` instead — that is the pure
 * route, and it is what I33 uses to fabricate models and prove its clauses can fail.
 */
export function setDefaultModel(model) {
  DEFAULT = prepare(model);
  return DEFAULT.hash;
}

function defaultModel() {
  if (!DEFAULT) DEFAULT = prepare(loadShippedModel());
  return DEFAULT;
}

/**
 * The frozen accessor (V3-PLAN §2), bound to the process-wide model.
 *
 * Arity is 4 and `opts` carries NO default value: a default would make `payoff.length === 3` and
 * break the arity half of I33(a) — the freeze is a test, not a doc. Absence is handled inside.
 *
 * @param {string[]} cells  cell keys, hero first (length 2 = heads-up = the supported domain)
 * @param {number} potSize  pot at the decision node, current-unit bb
 * @param {number} spr      effective stack / potSize
 * @param {{ip?: boolean, seed?: number|string}} [opts]
 * @returns {{ev: number, se: number, source: string, supported: boolean,
 *            potMult: number, invShare: number}}
 *          six keys since the P2 pre-stage amendment: `EVbb = ev*finalPot - invested` with
 *          `finalPot = potMult*potSize` and `invested = heroPre + invShare*finalPot`, where
 *          `heroPre` — hero's own contribution to `potSize` — is the caller's, not this file's.
 */
export function payoff(cells, potSize, spr, opts) {
  return evaluate(defaultModel(), cells, potSize, spr, opts);
}

/* @browser-cut — everything below this line is Node-side only and is not inlined into the page */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** the shipped dataset, read once and only if `setDefaultModel` never ran */
loadShippedModel = () => JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
