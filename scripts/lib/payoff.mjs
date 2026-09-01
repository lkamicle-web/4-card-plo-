// payoff.mjs — THE PAYOFF INTERFACE, FROZEN (V3-PLAN §2). Gate I33 pins it.
//
// WHAT THIS IS. One accessor, four arguments, four return keys:
//
//     payoff(cells, potSize, spr, opts) -> { ev, se, source, supported }
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
//             instead of being re-modeled in here.
//   se        one standard error, same unit, NEVER ABSENT and never typed — see THE ERROR BAR.
//   source    'checkdown' | 'model' | 'simulated'. This is where the honesty lives. `supported`
//             says whether the REQUEST was in the measured domain; `source` says what kind of
//             number came back. A heads-up answer today is `supported:true` and
//             `source:'checkdown'` — a real answer to a real request, in a game where postflop
//             does not exist. Downstream badges (I35's Grade-C label) key off `source`, NOT off
//             `supported`, or they will silently upgrade the checkdown game to a solved one.
//   supported false => `ev` is a fallback and the caller must badge it (§2 clause (f), and the
//             page's existing `badge: 'unsupported'` idiom is the precedent).
//
// Out-of-domain NEVER throws and NEVER returns an unflagged number. Every exit below returns all
// four keys.
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
// forgot an argument hands back another environment's answer, silently. When a memo is finally
// warranted, EVERY argument goes in the key, plus `makePayoff(model).modelHash`.
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

/** the four keys of a payoff result, frozen. I33(a) asserts a return carries exactly these. */
export const RESULT_KEYS = Object.freeze(['ev', 'se', 'source', 'supported']);

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
 * Assemble the return. The four keys, always, in a fixed order.
 *
 * The one thing this does beyond packing: an `ev` outside [0,1] (or non-finite) can never leave
 * here wearing `supported:true`. That is the "never returns an unflagged number" half of the
 * contract holding even when the MODEL is wrong — a percent/fraction slip, say. The bad number is
 * still returned rather than clamped away, because I33(a) asserts `ev in [0,1]` on every return
 * and a clamp would hide from the gate exactly the bug the gate exists to find.
 */
function finish(ev, se, source, supported) {
  const evOk = typeof ev === 'number' && Number.isFinite(ev) && ev >= 0 && ev <= 1;
  const seOk = typeof se === 'number' && se > 0 && !Number.isNaN(se);
  return { ev, se: seOk ? se : Infinity, source, supported: !!supported && evOk && seOk };
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
 * @returns {{ev: number, se: number, source: string, supported: boolean}}
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
    return finish(ev, se, 'checkdown', true);
  }

  // --- multiway: the checkdown fallback, flagged. eq[N-1] for N = len-1 opponents.
  if (inDomain) {
    const p = hero.eq[len - 2] / 100;
    return finish(p, seOfShare(p, M.trials), 'checkdown', false);
  }

  // --- out of domain. A number, always flagged, never an exception.
  if (hero) {
    // the request was malformed but the HERO resolves, so the honest fallback is hero's own
    // checkdown ladder, read at the nearest measured opponent count.
    const i = Math.min(Math.max(len - 2, 0), hero.eq.length - 1);
    const p = hero.eq[i] / 100;
    return finish(p, seOfShare(p, M.trials), 'checkdown', false);
  }
  // nothing resolves: the only defensible number is an equal share of the pot, and no trial
  // produced it, so its error bar is Infinity (n = 0, the shipped seOfTrials(0) convention).
  const ev = 1 / Math.max(2, len);
  return finish(ev, seOfShare(ev, 0), 'checkdown', false);
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
 * the other half of any future memo key (§2: "pure function of (args, model hash)").
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
 * @returns {{ev: number, se: number, source: string, supported: boolean}}
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
