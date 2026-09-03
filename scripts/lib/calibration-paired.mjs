// calibration-paired.mjs — PC-4's paired estimator, the two orderings it compares, and the
// self-play consistency run that is the only input v3 has for it (V3-PLAN §3.1/§3.5, S-C §6/§7.1).
//
// PC-4, VERBATIM, IS THE SPEC OF THIS FILE:
//
//     D = mean over the corpus of (bb won under the EV ordering) minus (bb won under the score
//     ordering), both cut at the same VPIP, evaluated hand-by-hand on the same stream so that
//     hands where the orderings agree contribute exactly zero. D is reported in bb/100 with its
//     standard error, paired, no bootstrap re-weighting.
//
// The variance consequence is the whole reason the estimator has this shape. Both arms run on the
// SAME stream, so on every hand they agree the difference is exactly zero and contributes nothing
// to the variance: SE = sigma * sqrt(m/N) where m is the disagreement mass. S-C §5 turned that
// into the corpus requirement — 6M to 77M hero hands for the plausible cell — and the pairing is
// what makes those numbers as small as they are. `pairedD` therefore differences FIRST and
// summarises the differences, never the two arms separately; a naive two-sample estimator on the
// same data would need orders of magnitude more hands and would be the wrong statistic besides.
//
// WHAT V3 CAN ACTUALLY RUN. S-C FAILED: there is no lawful, hero-visible, assigned corpus, so the
// money input does not exist and `D` in bb/100 is uncomputable. S-C §7.1's disposition is that the
// harness ships anyway, because "PC-4's paired statistic is exactly the shape a self-play
// consistency check takes, so the code is not wasted — only its input is missing". So
// `selfPlayConsistency()` runs the identical estimator over a deterministic stream scored by the
// FROZEN PAYOFF INTERFACE instead of by money.
//
// ITS UNIT IS NOT MONEY AND THE CODE SAYS SO. The per-hand value of entering is
// `payoff.ev - 0.5`: hero's share of the pot above an even split, in POT FRACTIONS, which is the
// unit `payoff()` already returns. Folding is 0. This buys the one thing that matters — no pot
// model, no sizing, no rake, NO NEW CONSTANT — and it costs the thing that does not matter here,
// namely a bb figure nobody is entitled to quote. Every result from this file is stamped
// `unit: 'potFrac'` and `moneyValidated: false`, and `calibration.mjs` refuses to evaluate PC-4
// on anything not stamped `unit: 'bb/100'` from an admissible corpus. That refusal is the guard
// against the one bad outcome available to this lane: a self-play number laundered into a verdict.
//
// NO NEW CONSTANTS. `Z95` is SOLVED at import from the normal CDF rather than typed, so the 1.96
// everyone knows is arithmetic in this file rather than a number somebody remembered.

import { rankTable, widthFor, envOf, hydrate } from './policy.mjs';
import { makePayoff } from './payoff.mjs';

// ---------------------------------------------------------------------------
// the normal quantile, derived
// ---------------------------------------------------------------------------

/**
 * erf by its Maclaurin series. Converges to double precision across the range any z-score this
 * harness uses, and it is here so that `Z95` below can be COMPUTED. A pre-registered criterion
 * whose confidence level is a typed 1.96 is a criterion with a magic number in it.
 */
export function erf(x) {
  const ax = Math.abs(x);
  if (ax > 6) return Math.sign(x);
  let term = ax;             // x^(2n+1) / n!  , n = 0
  let sum = ax;              // divided by (2n+1) as it is added
  const x2 = ax * ax;
  for (let n = 1; n < 200; n++) {
    term *= x2 / n;
    const add = (n % 2 ? -term : term) / (2 * n + 1);
    sum += add;
    if (Math.abs(add) < 1e-18 * Math.abs(sum)) break;
  }
  return Math.sign(x) * (2 / Math.sqrt(Math.PI)) * sum;
}

/** the standard normal CDF */
export function normalCdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }

/** its inverse, by bisection — slow and obviously correct, which is the right trade for a constant */
export function normalQuantile(p) {
  let lo = -10, hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** the two-sided 95% multiplier PC-6 and PC-7 are written in terms of — derived, never typed */
export const Z95 = normalQuantile(0.975);

// ---------------------------------------------------------------------------
// the paired estimator
// ---------------------------------------------------------------------------

/**
 * PC-4's statistic over a list of per-hand differences.
 *
 * `zeros` and `disagreements` are returned beside the estimate because the pairing claim is only
 * true if most differences ARE zero, and a run where they are not is a run whose SE cannot be read
 * the way PC-5 reads it. Reporting the mass is what makes PC-5 a precision floor rather than a
 * hand count.
 */
export function pairedD(diffs) {
  const n = diffs.length;
  if (n === 0) {
    return Object.freeze({ n: 0, D: null, se: null, ci95: null, zeros: 0, disagreements: 0, mass: 0 });
  }
  let sum = 0, zeros = 0;
  for (const d of diffs) { sum += d; if (d === 0) zeros++; }
  const D = sum / n;
  let ss = 0;
  for (const d of diffs) { const e = d - D; ss += e * e; }
  const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : null;
  const se = sd == null ? null : sd / Math.sqrt(n);
  return Object.freeze({
    n,
    D,
    sd,
    se,
    ci95: se == null ? null : Object.freeze([D - Z95 * se, D + Z95 * se]),
    zeros,
    disagreements: n - zeros,
    mass: (n - zeros) / n,
  });
}

// ---------------------------------------------------------------------------
// the two orderings
// ---------------------------------------------------------------------------

/**
 * The SCORE ordering — the one that ships and cuts tiers. Straight off `rankTable`, which is the
 * shipped ranking, so this is not a reimplementation of the model: it is the model.
 */
export function scoreOrdering(model, opts = {}) {
  hydrate(model);   // `rankTable` reads the derived `rho`/`nuSlope`; `solve` hydrates, this path must too
  const pos = opts.pos || 'CO';
  const node = opts.node || 'rfi';
  const v = opts.v == null ? model.meta.vpip.ref / 100 : opts.v;
  const env = envOf(opts);
  const t = rankTable(model, pos, node, v, { ...opts, env });
  return {
    name: 'score',
    pos, node, v, env,
    width: widthFor(pos, node, v, env),
    keys: t.rows.map((r) => r.key),
    combos: new Map(t.rows.map((r) => [r.key, r.combos])),
    total: model.meta.comboTotal,
  };
}

/**
 * The EV ordering — cells sorted by hero's checkdown share against the FIELD, read through the
 * frozen `payoff()` accessor (V3-PLAN §2) rather than off `eq` directly.
 *
 * Going through the interface is deliberate and is the point of the freeze: when P2 replaces the
 * checkdown stub with an estimator, this ordering changes and this file does not. The field weight
 * is the shipped combo distribution, so the sort key is
 *
 *     mean over opponent cells B, weighted by combos(B), of payoff([A, B], ...).ev
 *
 * which introduces no constant of its own — every input is shipped. `source` is carried out so a
 * caller can never forget which game produced the ordering (I35's Grade-C label keys off exactly
 * this datum).
 */
export function evOrdering(model, opts = {}) {
  const pay = opts.payoff || makePayoff(model);
  const base = opts.base || scoreOrdering(model, opts);
  const keys = [...base.keys];
  const combos = base.combos;

  let fieldTotal = 0;
  for (const k of keys) fieldTotal += combos.get(k);

  const potSize = 1;     // the stub is pot-size-inert; `ev` is a FRACTION and the unit is the pot
  const spr = 1;         // and spr-inert, which is what "checkdown" means (payoff.mjs, THE STUB)
  let source = null;
  let allSupported = true;
  const key = new Map();
  for (const a of keys) {
    let acc = 0;
    for (const b of keys) {
      const w = combos.get(b);
      if (w <= 0) continue;
      const r = pay([a, b], potSize, spr, undefined);
      if (source == null) source = r.source;
      if (!r.supported) allSupported = false;
      acc += w * r.ev;
    }
    key.set(a, acc / fieldTotal);
  }

  keys.sort((a, b) => (key.get(b) - key.get(a)) || (a < b ? -1 : a > b ? 1 : 0));
  return {
    name: 'ev',
    pos: base.pos, node: base.node, v: base.v, env: base.env,
    width: base.width,
    keys,
    combos,
    total: base.total,
    source,
    supported: allSupported,
    sortKey: key,
  };
}

/**
 * Cut an ordering at a cumulative combo frequency — PC-4's "both cut at the same VPIP".
 *
 * The cut uses `cumMid` (the cell's midpoint mass), which is the convention `policy.rankTable`
 * and the shipped aggressive set already use. Using a different convention here would make the
 * two arms differ for a reason that has nothing to do with either ordering.
 */
export function cutAt(ordering, width) {
  const w = width == null ? ordering.width : width;
  const set = new Set();
  let cum = 0;
  for (const k of ordering.keys) {
    const share = ordering.combos.get(k) / ordering.total;
    const mid = cum + share / 2;
    cum += share;
    if (mid >= w) break;
    set.add(k);
  }
  return set;
}

/** the symmetric difference of two cut sets, with the combo mass it carries */
export function disagreement(a, b, ordering) {
  const only = { ev: [], score: [] };
  for (const k of a) if (!b.has(k)) only.ev.push(k);
  for (const k of b) if (!a.has(k)) only.score.push(k);
  only.ev.sort(); only.score.sort();
  let mass = 0;
  for (const k of only.ev) mass += ordering.combos.get(k);
  for (const k of only.score) mass += ordering.combos.get(k);
  return Object.freeze({
    onlyEv: Object.freeze(only.ev),
    onlyScore: Object.freeze(only.score),
    cells: only.ev.length + only.score.length,
    mass: mass / ordering.total,
  });
}

// ---------------------------------------------------------------------------
// the deterministic stream
// ---------------------------------------------------------------------------

/** mulberry32 — 32 bits of state, identical output on every engine, which is what determinism means */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** draw a cell from the shipped combo distribution — the exact frequency, not a uniform over cells */
function drawer(keys, combos, total) {
  const cum = new Float64Array(keys.length);
  let acc = 0;
  for (let i = 0; i < keys.length; i++) { acc += combos.get(keys[i]); cum[i] = acc; }
  const scale = acc;
  return (u) => {
    const t = u * scale;
    let lo = 0, hi = keys.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] <= t) lo = mid + 1; else hi = mid; }
    return keys[lo];
  };
}

/**
 * SELF-PLAY CONSISTENCY — PC-4's estimator with a self-play input (S-C §7.1).
 *
 * Deals `hands` heads-up spots from the shipped combo distribution, plays each one twice — once
 * under the EV ordering's cut, once under the score ordering's cut, both at the same width — and
 * differences them hand by hand. Hands where the two cuts agree contribute exactly zero, which is
 * the pairing property PC-4 is written around, and this run is where that property is TESTED
 * rather than assumed.
 *
 * WHAT IT IS NOT. It is not a calibration, not a validation, and not evidence that either ordering
 * makes money. It measures whether the two orderings the model can produce disagree, by how much
 * of the range, and how the harness's own estimator behaves on a stream where the answer is known
 * to come only from the disagreement mass. Every field of the result says so.
 */
export function selfPlayConsistency(model, opts = {}) {
  const hands = Number.isFinite(opts.hands) ? opts.hands : 20000;
  const seed = Number.isFinite(opts.seed) ? opts.seed : 1;
  const pay = opts.payoff || makePayoff(model);

  const score = opts.base || scoreOrdering(model, opts);
  const ev = evOrdering(model, { ...opts, base: score, payoff: pay });
  const width = score.width;
  const setScore = cutAt(score, width);
  const setEv = cutAt(ev, width);
  const dis = disagreement(setEv, setScore, score);

  const keys = score.keys.filter((k) => score.combos.get(k) > 0);
  const draw = drawer(keys, score.combos, score.total);
  const rng = mulberry32(seed);

  const diffs = new Array(hands);
  for (let i = 0; i < hands; i++) {
    const hero = draw(rng());
    const villain = draw(rng());
    // the value of ENTERING, in pot fractions above an even split. Folding is 0, exactly, so a
    // hand both arms fold contributes 0 - 0 and a hand both arms play contributes x - x.
    const inEv = setEv.has(hero), inScore = setScore.has(hero);
    if (inEv === inScore) { diffs[i] = 0; continue; }
    const enter = pay([hero, villain], 1, 1, undefined).ev - 0.5;
    diffs[i] = inEv ? enter : -enter;
  }

  const stat = pairedD(diffs);
  return Object.freeze({
    kind: 'self-play-consistency',
    unit: 'potFrac',                 // NOT bb/100 — calibration.mjs refuses this for PC-4
    moneyValidated: false,
    payoffSource: ev.source,
    supported: ev.supported,
    seed,
    hands,
    at: Object.freeze({ pos: score.pos, node: score.node, v: score.v, width }),
    cutSizes: Object.freeze({ ev: setEv.size, score: setScore.size }),
    disagreement: dis,
    statistic: stat,
    note: 'PC-4\'s estimator over a self-play stream scored by the frozen payoff interface. This is'
      + ' a consistency measurement, not a calibration: no money, no corpus, no verdict.',
  });
}
