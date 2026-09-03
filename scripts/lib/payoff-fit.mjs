// payoff-fit.mjs — THE FITTER. Pure, deterministic, and the reason `payoff-model.mjs`'s numbers
// are an ANCHOR rather than a typing. V3-PLAN §6: "payoff estimator params — fitted to S-B's
// street-sim ground truth; residuals shipped like `benchmarks.disputed`."
//
// This module reads `payoff-reference.mjs` (S-B's 300 measured points) plus the shipped model's own
// cell features, and returns every number `payoff-model.mjs` freezes. `test/payoff-model.test.mjs`
// runs it and asserts the frozen copy is EXACTLY what comes back, so a coefficient cannot be edited
// without editing the measurement it came from — the two-copies idiom `I46_CRITERIA` uses.
//
// It has no `node:fs` import, no clock, no randomness that is not seeded here, and it never writes.
//
// =================================================================================================
// THE FORM, AND EVERY TERM S-B HAD THAT THIS ONE DOES NOT
// =================================================================================================
//
// S-B's form 1 is "pairwise checkdown + a fitted realization curve": `ev = base + design . coef`,
// linear in the coefficients given one shape knob `S0`, where `g = spr/(spr + S0)` is how much of
// the realization effect has arrived by that stack depth. Its design had TWELVE terms and its base
// was the MEASURED pairwise checkdown equity. This lane ships FIVE terms and a different base, and
// both reductions are forced rather than chosen:
//
//   -5 terms, THE `sd` FAMILY. S-B's terms 8, 9, 10, 11, 12 all carry `sdA`/`sdB` — the standard
//      deviation of a cell's FLOP-EQUITY BUCKET ladder, which is a 123-entry Monte Carlo precompute
//      (S-B: 16.5 us per cell-sample, 40.7 cpu-s at 20k samples). `data/model.json` ships no such
//      per-cell dispersion, and V3-PLAN §3.2's Grade-C descope says P2 builds no payoff precompute,
//      so the terms have no input.
//
//   -2 terms, THE POSITION-SYMMETRIC PAIR. S-B's `x*g*s` and `g*s*dNu` do not change sign under
//      (A, B, ip) -> (B, A, not ip), so a design containing them CANNOT conserve: it makes
//      `ev(A,B,ip) + ev(B,A,!ip)` differ from 1 by up to 6.7 pt. I33(b) would still pass, but only
//      because this estimator's own error bar is 7.6 pt — a source that satisfies a conservation
//      clause by having a big enough error bar is gaming it. The five survivors are exactly the
//      antisymmetric subset, so conservation holds as an IDENTITY, bit-for-bit, the way the
//      checkdown stub holds it.
//
//   THE BASE. S-B fitted on top of `eqAB`, the measured pairwise checkdown equity — a 7,626-entry
//      table costing 105 cpu-s, which §3.2's descope does not build. The base available today is
//      the one the frozen accessor already returns: `payoff.mjs`'s zero-sum projection
//      `0.5 + (eq_A[0] - eq_B[0])/200`, built from shipped numbers with zero new constants. Those
//      two disagree by mean 6.28 pt, max 20.90 pt over the 300 reference points.
//
// THE DECOMPOSITION, held-out p95, one cut at a time. EVERY ROW IS SELECTED AND SCORED BY THE SAME
// DECLARED RULE (the CV below), which is the only way the steps mean anything: comparing a variant
// chosen on train-p95 against one chosen by cross-validation measures the rule and not the model.
// `evOnly()` at the foot of this file is what produces rows 2 and 3, and the test re-runs it.
//
//      8.44   S-B's form 1, as graded — 12 terms, measured pairwise base   (published)
//      9.69   - the five `sd` terms                                        +1.25
//     16.76   - the measured pairwise base, swapped for the projection     +7.07
//     16.71   - the two position-symmetric terms, for the identity         -0.05
//
// SO THE CONSERVATION IDENTITY IS FREE, and that is the finding, arrived at the wrong way round: an
// earlier reading of this table put it at 2.2 pt, because the two variants had been selected under
// different rules. Under one rule the five-term antisymmetric design is a HAIR BETTER out of sample
// than the seven-term one that cannot conserve. The identity costs nothing and buys an exact clause.
//
// And the lane's real gap is one number: **7.07 of 8.28 pt is the missing pairwise checkdown table**
// — 85% of the distance from S-B's graded form, and nothing to do with the shape of the correction.
// If anyone ever revisits this, that is the thing to buy first, and S-B priced it at 105 cpu-s
// against a 688 cpu-second budget.
//
// =================================================================================================
// THE THREE OUTPUTS, AND THE STRUCTURE EACH IS BUILT TO RESPECT
// =================================================================================================
//
// The amended interface returns SIX keys and three of them are numbers a source must produce:
// `ev`, `potMult`, `invShare`. Each is parameterised so that its identities are exact rather than
// fitted, because an identity that survives only to within the fit's residual is not an identity.
//
//   ev        `ev = base + g * (antisymmetric design . coef)`. Antisymmetric => conservation exact.
//             `g = 0` at spr 0 => the spr-0 identity to checkdown is exact, not "within MC error".
//
//   potMult   `potMult = 1 + 2*spr*w`, `w = sigmoid(seat-invariant design . coef)` in (0,1).
//             The bracket is the game's own arithmetic in pot-fraction units: with the pot at the
//             node normalised to 1 and each player holding `spr` behind, the final pot is at least
//             1 (nobody takes chips out) and at most 1 + 2*spr (both stacks in). So `potMult >= 1`
//             and the spr-0 identity `potMult === 1` are STRUCTURAL, and w is seat-invariant
//             because the final pot is one object and does not know which seat you call hero.
//             ZERO NEW CONSTANTS: 1 and 2*spr are the ladder, not opinions.
//
//   invShare  `invShare = q * (potMult - 1) / potMult`, `q = 0.5 + 0.5*tanh(antisym design . coef)`
//             in (0,1). `(potMult - 1)/potMult` is all the money that went in after the node as a
//             share of the final pot; `q` is hero's half of it. tanh is odd, so
//             `q(A,B,ip) + q(B,A,!ip) = 1` EXACTLY and the two seats' investments add up to the
//             pot they built. At spr 0, `potMult === 1` forces `invShare === 0` exactly. The
//             measurement supports the parameterisation: over the reference's 9 self-pair points
//             the `q`-sum defect is 0.003 while the `ev`-sum defect is 0.85 pt.
//
// =================================================================================================
// HOW `S0` IS CHOSEN, AND WHY IT IS STILL FLAGGED UNANCHORABLE
// =================================================================================================
//
// The rule is DECLARED HERE AND FOLLOWED ONCE: `S0` is the grid point minimising the MEAN of eight
// grouped 5-fold cross-validated p95s, computed on the 34 TRAINING pairs only, folds grouped by
// pair so no pair is ever split across the boundary. The 16 held-out pairs are not consulted by the
// selection at any point, which is what makes the held-out p95 a held-out number.
//
// It selects S0 = 12, and it is still not an anchor, for three measured reasons:
//   (1) the CV objective moves by 2.6 pt across the WHOLE grid (15.00 at S0 12 to 17.56 at 0.125) —
//       less than one standard error of the estimator itself;
//   (2) the per-shuffle argmin ranges over {2, 6, 8, 12, 16, 16, 16, 12} — the selected value
//       depends on how the training pairs happen to fall into folds;
//   (3) the CV winner is not the held-out winner, and that winner is exactly the number the rule
//       must not be allowed to reach back and take. CORRECTED BY THE P2 RED TEAM
//       (docs/refutations/P2.md), which re-ran the fit at all fifteen grid points: this line used to
//       say "S0 = 8 would have scored better out of sample" and that is FALSE — S0 = 8 scores
//       held-out p95 16.8416, WORSE than the shipped 12's 16.7143. The held-out winner is
//       S0 = 1.5 at 14.6976, so the real gap is 12 -> 1.5 and the claim this line supports survives
//       more strongly than it was written. `test/payoff-model.test.mjs` now asserts it rather than
//       narrating it: the held-out argmin over the grid must not be the selected S0.
// S-B found the same thing from the other side: its frozen-coefficient sweep moved p95 26.31 -> 6.62
// across its own grid. So the knob is FLAGGED per V3-PLAN §6 — see `UNANCHORED` in
// `payoff-model.mjs`. Under Grade C it enters no `constants`, renders in no Method view, and moves
// no shipped number, because nothing it feeds is wired in.
//
// `RIDGE` is S-B's own `lam = 1e-7`, carried over verbatim for conditioning; `CV_FOLDS` and
// `CV_SHUFFLES` are procedure, not model — they enter nothing but `selectS0`, so the only thing
// they can move is `S0`, which is already flagged. WHAT THAT SENTENCE USED TO IMPLY AND DOES NOT
// (P2 red team, docs/refutations/P2.md): moving them is not therefore FREE. Measured — CV_FOLDS
// 5 -> 6 makes the declared rule select S0 = 8, 5 -> 3 selects 6, and CV_SHUFFLES 8 -> 3 selects 16;
// each of those turns the shipped suite RED, because the frozen block is deep-equalled against the
// fitter's live re-derivation and several clauses are pinned to the fit at the selected knob. The
// procedure is as pinned as the model is. What stays true is the scope: no coefficient, residual or
// returned number depends on them except through `S0`.

import { CELLS, ROWS, REF_META } from './payoff-reference.mjs';

/** the shape-knob grid the selection rule searches. S-B swept {1..12}; this extends both ends so a
 *  grid EDGE cannot be mistaken for an optimum — S-B's own S0 = 12 was the top of its grid. */
export const S0_GRID = Object.freeze([0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32]);
/** grouped folds, and how many independent groupings the selection averages over */
export const CV_FOLDS = 5;
export const CV_SHUFFLES = 8;
/**
 * S-B's own ridge, for conditioning the `ev` normal equations. Not a model constant — it cannot
 * move a decision — but the sentence that used to stand here was wrong about why, and the P2 red
 * team measured it (docs/refutations/P2.md). It said "at 1e-7 x n it moves the fifth decimal of a
 * coefficient". IT MOVES THE FOURTH SIGNIFICANT FIGURE: between lam 1e-9 and the shipped 1e-7 the
 * leading `ev` coefficient goes 0.26226887 -> 0.26208201, and at lam = 0 exactly it goes to 5.2492
 * while the selection jumps to S0 = 24. That is not conditioning a well-posed solve; it is CHOOSING
 * A SPLIT, because the `ev` design is exactly rank-deficient — see the identified-parameter note
 * below. The half that survives is the load-bearing half, and it is the reason this is still called
 * procedure: held-out p95 moves 16.7122 (lam 0, at frozen S0) -> 16.7143 (shipped), so the
 * PREDICTIONS are stable across three decades even where individual coefficients are not.
 */
export const RIDGE = 1e-7;

/**
 * THE SECOND RIDGE, WHICH USED TO HAVE NO NAME. `fitAt` passes this to `ols` for BOTH latent fits —
 * `potMult`'s `w` and `invShare`'s `q` — so twelve of the seventeen shipped coefficients are
 * conditioned by it. It was a bare `1e-6` written twice inside `fitAt`, named in no list, no header
 * sentence, no plan row and no brief, and the P2 red team found it exactly where the house rule
 * says an anonymous number should not be: materially determining a frozen coefficient (moving it to
 * RIDGE takes `potMult`'s `g*x*x` coefficient from 5.77 to 9.76) while being invisible to every
 * inventory of what this lane ships. Naming it introduces no number — it is the same 1e-6 that was
 * always there — it only makes it countable. It is pinned the same way everything else here is:
 * the frozen `FIT` is deep-equalled against a live re-derivation, so changing it goes red.
 *
 * WHY IT IS LARGER THAN `RIDGE`: the latent scales are `logit(w)` and `atanh(2q - 1)`, which the
 * clips at 1e-3 and 0.999 push to |8| and |3.8| at the edges, so the normal matrix there is worse
 * conditioned than the `ev` one and S-B's own lam does not settle it.
 */
export const LATENT_RIDGE = 1e-6;

// =================================================================================================
// THE POT GEOMETRY, WRITTEN ONCE — the P2 red team's finding, repaired
// =================================================================================================
//
// `1 + 2*spr*w` used to be written TWICE: here, in `fitAt`'s `pmOf`, and again in
// `payoff-model.mjs`'s accessor, with nothing asserting the two agreed. Two refuters measured what
// that costs — the accessor was made to return `1 + 100*spr*w`, a final pot fifty times larger than
// both stacks combined, and the frozen residual table `FIT.error.potMult` stayed BYTE-IDENTICAL,
// because it describes the fitter's copy of the formula and not the accessor's. The residuals
// certified the wrong arithmetic.
//
// So the geometry is now one expression, imported by both, and the residual table certifies the
// formula the accessor actually runs. These are NOT fitted and NOT constants: they are the game's
// arithmetic in pot-fraction units, and the `2` is the two stacks, not a coefficient.
//
//   forward   with the node's pot normalised to 1 and `spr` behind EACH player, the final pot is
//             `1 + 2*spr*w` for a fraction `w` in (0,1) of the double stack that actually goes in.
//             It cannot be under 1 (nobody takes chips back out) nor over `1 + 2*spr` (there is no
//             more money). Only `w` is fitted; the bracket is the game.
//   inverse   `wOf` recovers that fraction from a measured final pot. `rowsFor` needs it to put
//             S-B's reference on the latent scale the fit runs on. Measured over the whole live
//             sweep, `potMultOf(spr, wOf(spr, pm))` round-trips to `pm` EXACTLY, all 151,290 of
//             them — so the pair is a bijection in doubles, not merely in algebra.
//   split     hero's post-node investment is his share `q` of the post-node money
//             `(potMult - 1)/potMult`. `qOf` is its algebraic inverse, on the same terms.
export const potMultOf = (spr, w) => 1 + 2 * spr * w;
export const wOf = (spr, potMult) => (potMult - 1) / (2 * spr);
export const investOf = (q, potMult) => q * (potMult - 1) / potMult;
export const qOf = (invShare, potMult) => invShare * potMult / (potMult - 1);

/**
 * The features every design term is built from, for one ordered pair at one base.
 *
 * `x` is hero's edge in the base, so it is what the realization curve bends. `dNu`/`dCool`/`dEq`
 * are the three shipped per-cell numbers S-B's design used and this repository actually ships:
 * `nu` (the cell's nut-potential), `cooler` (its cooler exposure) and the vs-one-opponent equity
 * ladder's first entry. `mNu`/`mCool` are their MEANS, which the pot-geometry design needs because
 * how big the pot gets is a property of the pair, not of which seat is hero.
 */
export function featuresOf(cellA, cellB, base) {
  return {
    x: base - 0.5,
    dNu: cellA.nu - cellB.nu,
    dCool: cellB.cooler - cellA.cooler,
    dEq: (cellA.eq[0] - cellB.eq[0]) / 100,
    mNu: (cellA.nu + cellB.nu) / 2,
    mCool: (cellA.cooler + cellB.cooler) / 2,
  };
}

/**
 * The five ANTISYMMETRIC terms — every one flips sign under (A,B,ip) -> (B,A,not ip).
 *
 * TWO OF THEM ARE ONE TERM, and the P2 red team found it (docs/refutations/P2.md). `x` is
 * `base - 0.5` and `base` is `payoff.mjs`'s projection `0.5 + (eqA[0] - eqB[0])/200`, so `x` is
 * IDENTICALLY `dEq/2` — measured at max deviation 6.9e-17 over all 300 reference rows — and `x*g`
 * is therefore `0.5 * (g*dEq)`, the same column scaled. The design is exactly rank-deficient, the
 * ridge splits one identified quantity in its minimum-norm ratio, and the frozen numbers show it in
 * the open: `ev.coef[4]/ev.coef[0]` and `invShare.coef[4]/invShare.coef[0]` are both 2.0000000000
 * to ten places. Only `0.5*b0 + b4` is fitted — 0.6552 for `ev`, 3.2731 for `q` — and it is stable
 * where `b0` alone is not.
 *
 * SO THE HONEST COUNT IS 15, NOT 17: four of the seventeen shipped coefficients are two identified
 * quantities wearing four names. Nothing here is WRONG — the estimator predicts what it predicts,
 * every number is re-derived from the reference on every run, and a rank-deficient design under a
 * ridge is well defined — but "seventeen fitted coefficients, none of them chosen" over-counts by
 * two, and a reader counting parameters should be told. It is left standing rather than repaired
 * because dropping `x*g` from both designs would change the frozen block, and re-freezing a
 * measured artifact to improve its description is exactly the ceremony V3-PLAN §0.4 reserves for a
 * deliberate, diffed move. `test/payoff-model.test.mjs` asserts the collinearity so the count
 * cannot quietly become true or quietly get worse.
 */
export const EV_TERM_NAMES = Object.freeze(['x*g', 'g*s', 'g*dNu', 'g*dCool', 'g*dEq']);
export function evDesign(f, g, s) {
  return [f.x * g, g * s, g * f.dNu, g * f.dCool, g * f.dEq];
}

/** the seven SEAT-INVARIANT terms — every one is unchanged under the same swap */
export const POT_TERM_NAMES = Object.freeze(['1', 'g', 'x*s', 'x*g*s', 'g*mNu', 'g*mCool', 'g*x*x']);
export function potDesign(f, g, s) {
  return [1, g, f.x * s, f.x * g * s, g * f.mNu, g * f.mCool, g * f.x * f.x];
}

/** ordinary least squares by normal equations + Gauss-Jordan, S-B's own routine and ridge */
export function ols(X, y, lam = RIDGE) {
  const p = X[0].length;
  const A = Array.from({ length: p }, () => new Float64Array(p + 1));
  for (let r = 0; r < X.length; r++) {
    const xr = X[r];
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) A[i][j] += xr[i] * xr[j];
      A[i][p] += xr[i] * y[r];
    }
  }
  for (let i = 0; i < p; i++) A[i][i] += lam * X.length;
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    const t = A[c]; A[c] = A[piv]; A[piv] = t;
    const d = A[c][c] || 1e-12;
    for (let j = c; j <= p; j++) A[c][j] /= d;
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const m = A[r][c];
      if (!m) continue;
      for (let j = c; j <= p; j++) A[r][j] -= m * A[c][j];
    }
  }
  return Array.from({ length: p }, (_, i) => A[i][p]);
}

/** the same statistics S-B reported, so the two tables can be read against each other */
export function errStats(errs) {
  if (!errs.length) return { mean: 0, p50: 0, p95: 0, max: 0, bias: 0, rms: 0, n: 0 };
  const abs = errs.map(Math.abs).sort((a, b) => a - b);
  const q = (p) => abs[Math.min(abs.length - 1, Math.floor(p * (abs.length - 1) + 0.5))];
  return {
    mean: +(abs.reduce((a, b) => a + b, 0) / abs.length).toFixed(4),
    p50: +q(0.5).toFixed(4),
    p95: +q(0.95).toFixed(4),
    max: +abs[abs.length - 1].toFixed(4),
    bias: +(errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(4),
    rms: +Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / errs.length).toFixed(4),
    n: errs.length,
  };
}

/** a seeded Fisher-Yates over an index list. Deterministic: the same seed gives the same order on
 *  every machine, which is what lets a fit be re-derived and byte-compared. */
function shuffleIdx(n, seed) {
  const a = Array.from({ length: n }, (_, i) => i);
  let s = seed >>> 0;
  for (let i = n - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/**
 * Turn the shipped reference into fittable rows against a shipped model.
 *
 * `base` is the frozen accessor's own heads-up answer for the pair — the zero-sum projection — so
 * the estimator is genuinely "the interface's checkdown plus a correction" and not a second,
 * quieter equity reader. `pairOf` is an integer pair id so folds can be grouped by pair.
 *
 * `post` is amendment (i)'s conversion, done here and not in the reference file: S-B's `invShare`
 * is `E[hero invested TOTAL]/E[F]` and REF3 supplies the pre-node half by NORMALISATION
 * (`pot = 1`, `c0 = c1 = 0.5`), so `heroPre/finalPot` is `0.5/potMult` and the interface's
 * post-node reading is what is left. Exact, one line, and reversible.
 */
export function rowsFor(model, baseOf) {
  const out = [];
  for (const r of ROWS) {
    const a = CELLS[r[0]], b = CELLS[r[1]];
    const ca = model.cells[a], cb = model.cells[b];
    if (!ca || !cb) continue;
    const spr = r[2], ip = r[3] === 1;
    const base = baseOf(a, b);
    const potMult = r[6];
    const post = r[7] - 0.5 / potMult;
    out.push({
      a, b, spr, ip, s: ip ? 1 : -1,
      ref: r[4], se: r[5], potMult, post, eqAB: r[8], held: r[9] === 1,
      pair: r[0] * CELLS.length + r[1],
      base,
      f: featuresOf(ca, cb, base),
      w: wOf(spr, potMult),
      q: qOf(post, potMult),
    });
  }
  return out;
}

const gOf = (spr, S0) => spr / (spr + S0);
const dot = (d, c) => { let v = 0; for (let i = 0; i < d.length; i++) v += d[i] * c[i]; return v; };
const sig = (l) => 1 / (1 + Math.exp(-l));
const clip = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * THE SELECTION RULE, run once. Grouped 5-fold CV on the training rows only, averaged over eight
 * independent groupings; the winner is the grid point with the lowest mean p95.
 *
 * Returns the whole curve as well as the winner, because the curve is the evidence that the winner
 * is not an anchor: `payoff-model.mjs`'s `UNANCHORED` block quotes it.
 */
export function selectS0(train, design = evDesign) {
  const pairs = [...new Set(train.map((r) => r.pair))].sort((a, b) => a - b);
  const curve = S0_GRID.map((S0) => ({ S0, p95: [] }));
  const argmins = [];
  for (let seed = 1; seed <= CV_SHUFFLES; seed++) {
    const order = shuffleIdx(pairs.length, seed);
    const foldOfPair = Object.create(null);
    for (let i = 0; i < pairs.length; i++) foldOfPair[pairs[order[i]]] = i % CV_FOLDS;
    const scores = [];
    for (let gi = 0; gi < S0_GRID.length; gi++) {
      const S0 = S0_GRID[gi];
      const errs = [];
      for (let k = 0; k < CV_FOLDS; k++) {
        const inFold = train.filter((r) => foldOfPair[r.pair] === k);
        const outFold = train.filter((r) => foldOfPair[r.pair] !== k);
        const coef = ols(outFold.map((r) => design(r.f, gOf(r.spr, S0), r.s)), outFold.map((r) => r.ref - r.base));
        for (const r of inFold) {
          const v = clip(r.base + dot(design(r.f, gOf(r.spr, S0), r.s), coef), 0, 1);
          errs.push(100 * (v - r.ref));
        }
      }
      const p95 = errStats(errs).p95;
      curve[gi].p95.push(p95);
      scores.push(p95);
    }
    argmins.push(S0_GRID[scores.indexOf(Math.min(...scores))]);
  }
  const mean = curve.map((c) => c.p95.reduce((a, b) => a + b, 0) / c.p95.length);
  const S0 = S0_GRID[mean.indexOf(Math.min(...mean))];
  return {
    S0,
    argminPerShuffle: argmins,
    curve: curve.map((c, i) => ({ S0: c.S0, meanP95: +mean[i].toFixed(4), minP95: +Math.min(...c.p95).toFixed(4), maxP95: +Math.max(...c.p95).toFixed(4) })),
  };
}

/**
 * Fit all three outputs at one shape knob and report every statistic the module freezes.
 *
 * The `ev` fit is an ordinary residual regression. The two pot quantities are fitted on their
 * LATENT scale — `logit(w)` and `atanh(2q - 1)` — because that is the scale on which the structural
 * bounds are automatic; the statistics below are reported back in the NATURAL unit, which is the
 * only unit anyone can read.
 */
export function fitAt(rows, S0) {
  const train = rows.filter((r) => !r.held), held = rows.filter((r) => r.held);
  const evCoef = ols(train.map((r) => evDesign(r.f, gOf(r.spr, S0), r.s)), train.map((r) => r.ref - r.base));
  const potCoef = ols(train.map((r) => potDesign(r.f, gOf(r.spr, S0), r.s)),
    train.map((r) => Math.log(clip(r.w, 1e-3, 1 - 1e-3) / (1 - clip(r.w, 1e-3, 1 - 1e-3)))), LATENT_RIDGE);
  const qCoef = ols(train.map((r) => evDesign(r.f, gOf(r.spr, S0), r.s)),
    train.map((r) => Math.atanh(clip(2 * (r.q - 0.5), -0.999, 0.999))), LATENT_RIDGE);

  const evOf = (r) => clip(r.base + dot(evDesign(r.f, gOf(r.spr, S0), r.s), evCoef), 0, 1);
  const pmOf = (r) => potMultOf(r.spr, sig(dot(potDesign(r.f, gOf(r.spr, S0), r.s), potCoef)));
  const isOf = (r) => {
    const pm = pmOf(r);
    return investOf(0.5 + 0.5 * Math.tanh(dot(evDesign(r.f, gOf(r.spr, S0), r.s), qCoef)), pm);
  };
  const on = (rs, f) => errStats(rs.map(f));
  const evErr = (r) => 100 * (evOf(r) - r.ref);
  const pmErr = (r) => pmOf(r) - r.potMult;
  const isErr = (r) => 100 * (isOf(r) - r.post);

  return {
    S0,
    ev: { terms: EV_TERM_NAMES, coef: evCoef },
    potMult: { terms: POT_TERM_NAMES, coef: potCoef },
    invShare: { terms: EV_TERM_NAMES, coef: qCoef },
    error: {
      ev: { train: on(train, evErr), held: on(held, evErr), all: on(rows, evErr) },
      evBase: { held: on(held, (r) => 100 * (r.base - r.ref)), all: on(rows, (r) => 100 * (r.base - r.ref)) },
      potMult: { train: on(train, pmErr), held: on(held, pmErr), all: on(rows, pmErr) },
      potMultStub: { all: on(rows, (r) => 1 - r.potMult) },
      invShare: { train: on(train, isErr), held: on(held, isErr), all: on(rows, isErr) },
      invShareStub: { all: on(rows, (r) => 100 * (0 - r.post)) },
      bySpr: REF_META.sprs.map((spr) => ({ spr, p95: on(rows.filter((r) => r.spr === spr), evErr).p95 })),
    },
    /** the held-out rows the estimator disagrees with beyond the REFERENCE's own two-sigma, the
     *  `benchmarks.disputed` idiom: shipped rather than suppressed, worst first, with the count. */
    disputed: (() => {
      const bad = held.map((r) => ({ r, d: evOf(r) - r.ref })).filter((z) => Math.abs(z.d) > 2 * z.r.se);
      bad.sort((p, q2) => Math.abs(q2.d) - Math.abs(p.d));
      return {
        n: bad.length,
        of: held.length,
        worst: bad.slice(0, 12).map((z) => ({
          a: z.r.a, b: z.r.b, spr: z.r.spr, ip: z.r.ip,
          estimated: +(100 * evOf(z.r)).toFixed(2),
          reference: +(100 * z.r.ref).toFixed(2),
          refSe: +(100 * z.r.se).toFixed(2),
        })),
      };
    })(),
    /** one standard error for the estimator, in pot fractions: the held-out RMS deviation from the
     *  reference. Derived from the 96 held-out points that actually ran at 20,000 deals a pair —
     *  never typed, which is I33(d)'s whole point. It is 67.6x-74.2x the checkdown stub's own `se`
     *  (measured over all 15,006 ordered live pairs at spr 4), and saying so out loud is the honest
     *  part. THE FIGURE USED TO SAY ~46x, which the P2 red team measured as wrong by about 50%
     *  (docs/refutations/P2.md): 46 is this se against the 0.1581 pt tier-EV se from V3-PLAN §6's
     *  measured block, not against the `se` that `Math.hypot` actually combines it with. */
    modelSe: +(on(held, evErr).rms / 100).toFixed(6),
  };
}

/** the whole ceremony: select the knob on train, fit at it, report. */
export function fit(rows) {
  const sel = selectS0(rows.filter((r) => !r.held));
  return { ...fitAt(rows, sel.S0), selection: sel };
}

/**
 * `ev` alone, at one design and one knob — the tool the header's DECOMPOSITION is measured with,
 * exported so `test/payoff-model.test.mjs` can re-measure it rather than take the header's word.
 *
 * The reason it exists as a separate entry point: a decomposition is only meaningful if every step
 * is selected and scored by THE SAME rule. Comparing a variant chosen on train-p95 against one
 * chosen by cross-validation produces differences that are about the rule and not about the model —
 * which is exactly the mistake this function was written after making.
 */
export function evOnly(rows, design) {
  const train = rows.filter((r) => !r.held), held = rows.filter((r) => r.held);
  const S0 = selectS0(train, design).S0;
  const coef = ols(train.map((r) => design(r.f, gOf(r.spr, S0), r.s)), train.map((r) => r.ref - r.base));
  const err = (rs) => errStats(rs.map((r) => 100 * (clip(r.base + dot(design(r.f, gOf(r.spr, S0), r.s), coef), 0, 1) - r.ref)));
  return { S0, coef, train: err(train), held: err(held), all: err(rows) };
}

/**
 * S-B's own seven sd-free terms — the five this lane ships PLUS the two position-symmetric ones it
 * drops. Exported for the decomposition only; the model never uses it, because a design containing
 * `x*g*s` or `g*s*dNu` cannot conserve.
 */
export function evDesign7(f, g, s) {
  return [f.x * g, g * s, g * f.dNu, g * f.dCool, g * f.dEq, f.x * g * s, g * s * f.dNu];
}
