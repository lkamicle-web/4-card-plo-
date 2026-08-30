// mc.mjs — seeded Monte Carlo runner. Doubles as the worker-thread entry point.
//
// Stages:
//   'cells' : hero drawn fresh from the cell every trial; one deal (board + 7 villains) yields
//             equity vs N = 1..7 by comparing against villain prefixes.
//   'vs3bet': heads-up, villain rejection-sampled from one face-up component range.
//   'eq1'   : the frozen villain ordering — equity vs one random opponent for every
//             suit-isomorphism class of the deck (see villain-range.mjs).
//   'latt'  : the same multi-N kernel as 'cells', but with the villains drawn from a
//             VPIP-filtered pool instead of at random (V2-PLAN §2.3).
//
// Common random numbers: every unit inside a stage restarts the same board/villain stream (seeded
// from the stage name alone), so cross-cell RANKING noise is far below absolute noise. Hero draws
// use a separate stream seeded per unit key, so a unit's hero sample is reproducible on its own.
//
// v2 stream discipline (this is load-bearing — invariant I22 asserts that every v1 measurement is
// reproduced bit for bit): the v1 streams consume exactly the draws they consumed in v1, in the
// same order. Villains 6 and 7 are dealt from a SEPARATE stream that is advanced in lockstep, so
// extending the field from five opponents to seven cannot shift a single v1 board. The cooler rate
// (§2.1) adds no randomness at all — it is two counters over showdowns the kernel already
// evaluated.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { Rng, fnv1a, makeTriplePartials, fillTriplePartials, bestOmaha, categoryOf } from './eval5.mjs';
import { sampleFromRange } from './villains.mjs';

const SELF = fileURLToPath(import.meta.url);

/* @worker-slice-start — everything from here to @worker-slice-end is the portable kernel:
   no Node APIs, no imports of its own beyond the eval5 / villains names bound above. The browser
   Simulate bundle (scripts/lib/sim-bundle.mjs) slices exactly this region out and rebinds those
   names from its own IIFEs, so the page and the generator run the SAME measurement code and cannot
   drift. Do not move a Node dependency inside these markers. */

/** opponents measured in one deal: eq[N] for N = 1..NMAX (V2-PLAN §2.2) */
export const NMAX = 7;

/** the v1 field size, kept as its own name because ν is still defined on rho[5] − rho[1] */
export const NMAX_V1 = 5;

/**
 * The cooler measurement (V2-PLAN §2.1).
 *   COOLER_MIN_CAT  hero's five-card category must reach this to count: 3 = trips, i.e. "a set or
 *                   better" (set, straight, flush, full house, quads, straight flush), which is
 *                   eval5's category ladder from 3 up.
 *   COOLER_REF_N    the field size the loss is judged at: 3 opponents, a four-handed pot, the
 *                   modal loose-lobby showdown and close to the model's own typical N_eff.
 * A chop is not a loss.
 */
export const COOLER_MIN_CAT = 3;
export const COOLER_REF_N = 3;

/**
 * The cooler classifier, as a pure function of one showdown.
 * @param {number} hero packed best-five score for hero
 * @param {Int32Array|number[]} villains packed best-five scores, villain 1 first
 * @returns {boolean|null} null when hero did not reach a set or better (the trial does not count
 *   towards the rate at all); otherwise whether he lost the pot outright. A chop is not a loss.
 */
export function isCooler(hero, villains) {
  if (categoryOf(hero) < COOLER_MIN_CAT) return null;
  let vmax = -1;
  for (let k = 0; k < COOLER_REF_N; k++) if (villains[k] > vmax) vmax = villains[k];
  return hero < vmax;
}

/** one villain in a filtered pool is drawn from the range with this probability, else at random */
export const VILLAIN_DISCIPLINE = 0.85;

/** rejection budget for one filtered-villain draw before the trial falls back to a random hand */
const RANGE_TRIES = 4000;

/** per-trial reseed mix, so every unit of a filtered stage sees the same stream position per trial */
const trialSeed = (base, t) => ((base ^ Math.imul(t + 1, 0x9e3779b1)) >>> 0);

// ---------------------------------------------------------------------------
// trial kernels
// ---------------------------------------------------------------------------

/**
 * Multi-N kernel. Equity (%) vs N = 1..NMAX, plus the cooler counters.
 *
 * Stream discipline (I22): `rng` deals exactly the same 25 cards in exactly the same order it dealt
 * in v1 — 5 board + 5 villains — and is left at exactly the stream position v1 left it at. Villains
 * 6 and 7 continue the same partial Fisher-Yates from a SECOND stream (`extraRng`), touching only
 * deck positions 25..32, which the first 25 steps can never revisit. So eq[1..5] is bit-identical to
 * v1 and eq[6..7] is new information dealt from new randomness.
 *
 * @param {Uint32Array} pool packed hands to draw the hero from
 * @param {number} lo start index in pool
 * @param {number} hi end index (exclusive)
 * @returns {{eq: number[], coolNum: number, coolDen: number}} coolDen counts the trials where hero
 *   reached a set or better; coolNum how many of those he lost outright at COOLER_REF_N opponents.
 */
export function runMulti(pool, lo, hi, trials, heroSeed, streamSeed, extraSeed) {
  const heroRng = new Rng(heroSeed);
  const rng = new Rng(streamSeed);
  const extraRng = new Rng(extraSeed);
  const tp = makeTriplePartials();
  const acc = new Float64Array(NMAX);
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  const vs = new Int32Array(NMAX);
  const span = hi - lo;
  const NEED = 5 + NMAX * 4;
  let coolNum = 0, coolDen = 0;

  for (let t = 0; t < trials; t++) {
    const pk = pool[lo + ((heroRng.next() % span) >>> 0)];
    const h0 = pk & 63, h1 = (pk >>> 6) & 63, h2 = (pk >>> 12) & 63, h3 = (pk >>> 18) & 63;
    // build the 48-card stock
    let n = 0;
    for (let c = 0; c < 52; c++) if (c !== h0 && c !== h1 && c !== h2 && c !== h3) deck[n++] = c;
    // partial Fisher-Yates for 25 cards (5 board + 5 villains x 4) — the v1 stream, unchanged
    for (let i = 0; i < 25; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    // villains 6 and 7, from their own stream, advanced in lockstep one trial at a time
    for (let i = 25; i < NEED; i++) {
      const j = i + ((extraRng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[i];
    fillTriplePartials(board, tp);
    const hero = bestOmaha(h0, h1, h2, h3, tp);
    for (let k = 0; k < NMAX; k++) {
      const b = 5 + k * 4;
      vs[k] = bestOmaha(deck[b], deck[b + 1], deck[b + 2], deck[b + 3], tp);
    }
    let vmax = -1, vties = 0;
    for (let k = 0; k < NMAX; k++) {
      const s = vs[k];
      if (s > vmax) { vmax = s; vties = 1; } else if (s === vmax) vties++;
      if (hero > vmax) acc[k] += 1;
      else if (hero === vmax) acc[k] += 1 / (vties + 1);
    }
    // the cooler: hero holds a set or better and still loses the pot outright (§2.1)
    const cool = isCooler(hero, vs);
    if (cool !== null) { coolDen++; if (cool) coolNum++; }
  }
  const eq = new Array(NMAX);
  for (let k = 0; k < NMAX; k++) eq[k] = (100 * acc[k]) / trials;
  return { eq, coolNum, coolDen };
}

/**
 * The same multi-N kernel with the field drawn from a VPIP-filtered pool (V2-PLAN §2.3).
 *
 * Each villain is a range hand with probability q and a fully random hand with probability 1 − q
 * (`villainDiscipline`: even a 25-VPIP lobby reg shows up with junk sometimes, and a hard
 * percentile cliff at the range boundary is a fiction). Villains are dealt BEFORE the board — the
 * physical order, and the one that keeps the joint law uniform over valid (villains, board) tuples;
 * dealing the board first would silently up-weight boards that block the range.
 *
 * The hero stream is seeded exactly as the random-villain run seeds it, so the two measurements see
 * the same hero hands in the same order and the shipped delta is a PAIRED comparison. The villain
 * stream is reseeded per trial, so every cell sees the same stream position at the same trial index
 * even though rejection sampling consumes a hero-dependent number of draws.
 *
 * @returns {{eq: number[], fallbacks: number}} fallbacks counts villain draws where the range was
 *   so blocked that RANGE_TRIES rejections in a row failed and a random hand was dealt instead.
 */
export function runMultiFiltered(pool, lo, hi, range, q, trials, heroSeed, villSeed) {
  const heroRng = new Rng(heroSeed);
  const tp = makeTriplePartials();
  const acc = new Float64Array(NMAX);
  const avail = new Int32Array(52);
  const board = new Int32Array(5);
  const vh = new Int32Array(NMAX * 4);
  const vs = new Int32Array(NMAX);
  const span = hi - lo;
  let fallbacks = 0;

  for (let t = 0; t < trials; t++) {
    const pk = pool[lo + ((heroRng.next() % span) >>> 0)];
    const h0 = pk & 63, h1 = (pk >>> 6) & 63, h2 = (pk >>> 12) & 63, h3 = (pk >>> 18) & 63;
    const rng = new Rng(trialSeed(villSeed, t));
    let loM = 0, hiM = 0;
    for (const c of [h0, h1, h2, h3]) { if (c < 32) loM |= 1 << c; else hiM |= 1 << (c - 32); }

    for (let k = 0; k < NMAX; k++) {
      let vpk = -1;
      const disciplined = rng.float() < q;
      if (disciplined) vpk = sampleFromRange(range, rng, loM, hiM, RANGE_TRIES);
      if (vpk < 0) {
        // a random villain — either the discipline coin came up junk, or the range is so blocked
        // by the cards already dealt that no member of it survives
        if (disciplined) fallbacks++;
        for (let i = 0; i < 4; i++) {
          let c;
          do { c = (rng.next() % 52) >>> 0; } while (c < 32 ? (loM & (1 << c)) : (hiM & (1 << (c - 32))));
          vh[k * 4 + i] = c;
          if (c < 32) loM |= 1 << c; else hiM |= 1 << (c - 32);
        }
      } else {
        const c0 = vpk & 63, c1 = (vpk >>> 6) & 63, c2 = (vpk >>> 12) & 63, c3 = (vpk >>> 18) & 63;
        vh[k * 4] = c0; vh[k * 4 + 1] = c1; vh[k * 4 + 2] = c2; vh[k * 4 + 3] = c3;
        for (const c of [c0, c1, c2, c3]) { if (c < 32) loM |= 1 << c; else hiM |= 1 << (c - 32); }
      }
    }

    // the board comes out of whatever is left
    let n = 0;
    for (let c = 0; c < 52; c++) {
      const bit = c < 32 ? (loM & (1 << c)) : (hiM & (1 << (c - 32)));
      if (!bit) avail[n++] = c;
    }
    for (let i = 0; i < 5; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = avail[i]; avail[i] = avail[j]; avail[j] = tmp;
      board[i] = avail[i];
    }
    fillTriplePartials(board, tp);
    const hero = bestOmaha(h0, h1, h2, h3, tp);
    for (let k = 0; k < NMAX; k++) {
      vs[k] = bestOmaha(vh[k * 4], vh[k * 4 + 1], vh[k * 4 + 2], vh[k * 4 + 3], tp);
    }
    let vmax = -1, vties = 0;
    for (let k = 0; k < NMAX; k++) {
      const s = vs[k];
      if (s > vmax) { vmax = s; vties = 1; } else if (s === vmax) vties++;
      if (hero > vmax) acc[k] += 1;
      else if (hero === vmax) acc[k] += 1 / (vties + 1);
    }
  }
  const eq = new Array(NMAX);
  for (let k = 0; k < NMAX; k++) eq[k] = (100 * acc[k]) / trials;
  return { eq, fallbacks };
}

/* @worker-slice-end */

/**
 * eq1 for a list of hands over SHARED deals (the frozen villain ordering, V2-PLAN §2.3).
 *
 * Deal-major rather than hand-major: one board + one random villain is dealt, and every hand in
 * `reps` that does not collide with those nine cards is scored against it. Each hand therefore sees
 * a uniformly random (board, villain) drawn from the 48 cards it does not hold — the correct
 * conditional — and the board partials and the villain's score are amortised across ~10,800 hands
 * instead of being recomputed per hand.
 *
 * @param {Uint32Array} reps packed hands (one representative per suit-isomorphism class)
 * @returns {{win: Float64Array, cnt: Uint32Array}} pot share won, and deals participated in
 */
export function runEq1(reps, deals, seed) {
  const rng = new Rng(seed);
  const tp = makeTriplePartials();
  const n = reps.length;
  const win = new Float64Array(n);
  const cnt = new Uint32Array(n);
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  for (let d = 0; d < deals; d++) {
    for (let i = 0; i < 52; i++) deck[i] = i;
    for (let i = 0; i < 9; i++) {
      const j = i + ((rng.next() % (52 - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[i];
    fillTriplePartials(board, tp);
    const vsc = bestOmaha(deck[5], deck[6], deck[7], deck[8], tp);
    let loM = 0, hiM = 0;
    for (let i = 0; i < 9; i++) { const c = deck[i]; if (c < 32) loM |= 1 << c; else hiM |= 1 << (c - 32); }
    for (let k = 0; k < n; k++) {
      const pk = reps[k];
      const a = pk & 63, b = (pk >>> 6) & 63, c = (pk >>> 12) & 63, e = (pk >>> 18) & 63;
      if (a < 32 ? (loM & (1 << a)) : (hiM & (1 << (a - 32)))) continue;
      if (b < 32 ? (loM & (1 << b)) : (hiM & (1 << (b - 32)))) continue;
      if (c < 32 ? (loM & (1 << c)) : (hiM & (1 << (c - 32)))) continue;
      if (e < 32 ? (loM & (1 << e)) : (hiM & (1 << (e - 32)))) continue;
      const s = bestOmaha(a, b, c, e, tp);
      cnt[k]++;
      if (s > vsc) win[k] += 1; else if (s === vsc) win[k] += 0.5;
    }
  }
  return { win, cnt };
}

/** Heads-up kernel vs a hand drawn from a face-up component range. Returns equity (%). */
function runVs(pool, lo, hi, range, trials, heroSeed, streamSeed) {
  const heroRng = new Rng(heroSeed);
  const rng = new Rng(streamSeed);
  const tp = makeTriplePartials();
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  const span = hi - lo;
  let acc = 0, used = 0;

  for (let t = 0; t < trials; t++) {
    const pk = pool[lo + ((heroRng.next() % span) >>> 0)];
    const h = [pk & 63, (pk >>> 6) & 63, (pk >>> 12) & 63, (pk >>> 18) & 63];
    let lo32 = 0, hi32 = 0;
    for (const c of h) { if (c < 32) lo32 |= 1 << c; else hi32 |= 1 << (c - 32); }
    const vpk = sampleFromRange(range, rng, lo32, hi32);
    if (vpk < 0) continue;                       // range fully blocked (never seen in practice)
    const v = [vpk & 63, (vpk >>> 6) & 63, (vpk >>> 12) & 63, (vpk >>> 18) & 63];
    for (const c of v) { if (c < 32) lo32 |= 1 << c; else hi32 |= 1 << (c - 32); }
    let n = 0;
    for (let c = 0; c < 52; c++) {
      const bit = c < 32 ? (lo32 & (1 << c)) : (hi32 & (1 << (c - 32)));
      if (!bit) deck[n++] = c;
    }
    for (let i = 0; i < 5; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      board[i] = deck[i];
    }
    fillTriplePartials(board, tp);
    const hs = bestOmaha(h[0], h[1], h[2], h[3], tp);
    const vsc = bestOmaha(v[0], v[1], v[2], v[3], tp);
    if (hs > vsc) acc += 1; else if (hs === vsc) acc += 0.5;
    used++;
  }
  return used ? (100 * acc) / used : 0;
}

/** Equity of one FIXED hero hand vs N random opponents (benchmark path, single-threaded). */
export function equityFixed(hole, trials, seedStr, nOpp) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  const need = 5 + nOpp * 4;
  let acc = 0;
  let n = 0;
  const base = new Int32Array(52);
  for (let c = 0; c < 52; c++) if (!hole.includes(c)) base[n++] = c;
  for (let t = 0; t < trials; t++) {
    deck.set(base);
    for (let i = 0; i < need; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[i];
    fillTriplePartials(board, tp);
    const hero = bestOmaha(hole[0], hole[1], hole[2], hole[3], tp);
    let vmax = -1, ties = 0;
    for (let k = 0; k < nOpp; k++) {
      const b = 5 + k * 4;
      const s = bestOmaha(deck[b], deck[b + 1], deck[b + 2], deck[b + 3], tp);
      if (s > vmax) { vmax = s; ties = 1; } else if (s === vmax) ties++;
    }
    if (hero > vmax) acc += 1; else if (hero === vmax) acc += 1 / (ties + 1);
  }
  return (100 * acc) / trials;
}

/** Equity of one FIXED hero hand vs one FIXED villain hand (benchmark path). */
export function equityVsFixed(hole, villain, trials, seedStr) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  let n = 0;
  const dead = new Set([...hole, ...villain]);
  const base = new Int32Array(52);
  for (let c = 0; c < 52; c++) if (!dead.has(c)) base[n++] = c;
  let acc = 0;
  for (let t = 0; t < trials; t++) {
    deck.set(base);
    for (let i = 0; i < 5; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      board[i] = deck[i];
    }
    fillTriplePartials(board, tp);
    const a = bestOmaha(hole[0], hole[1], hole[2], hole[3], tp);
    const b = bestOmaha(villain[0], villain[1], villain[2], villain[3], tp);
    if (a > b) acc += 1; else if (a === b) acc += 0.5;
  }
  return (100 * acc) / trials;
}

/**
 * Conservation estimator: hero drawn uniformly from all 270,725 hands EVERY trial, so the mean is
 * an unbiased estimate of 100/(N+1) with an SE of about 0.1 pt at 200k trials. (Averaging a handful
 * of fixed random heroes instead has an SE near 0.9 pt — the spread of hand strengths dominates —
 * which is far too noisy for a +/-0.5 pt gate.)
 * @returns {number[]} mean equity (%) vs N = 1..5
 */
export function uniformMeanEquity(trials, seedStr) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const acc = new Float64Array(5);
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  const vs = new Int32Array(5);
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < 52; i++) deck[i] = i;
    for (let i = 0; i < 29; i++) {
      const j = i + ((rng.next() % (52 - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[4 + i];
    fillTriplePartials(board, tp);
    const hero = bestOmaha(deck[0], deck[1], deck[2], deck[3], tp);
    for (let k = 0; k < 5; k++) {
      const b = 9 + k * 4;
      vs[k] = bestOmaha(deck[b], deck[b + 1], deck[b + 2], deck[b + 3], tp);
    }
    let vmax = -1, vties = 0;
    for (let k = 0; k < 5; k++) {
      const s = vs[k];
      if (s > vmax) { vmax = s; vties = 1; } else if (s === vmax) vties++;
      if (hero > vmax) acc[k] += 1; else if (hero === vmax) acc[k] += 1 / (vties + 1);
    }
  }
  return Array.from(acc, (x) => (100 * x) / trials);
}

/**
 * Paired comparison: two hero hands measured over the SAME boards and villains, so the DIFFERENCE
 * between them carries almost no Monte Carlo noise. Both hands' cards are dead in every deal, which
 * biases both equities identically and leaves the comparison valid.
 * @returns {[number, number]}
 */
export function equityPaired(holeA, holeB, trials, seedStr, nOpp) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const dead = new Set([...holeA, ...holeB]);
  const base = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) base.push(c);
  const deck = Int32Array.from(base);
  const n = deck.length;
  const need = 5 + nOpp * 4;
  const board = new Int32Array(5);
  let accA = 0, accB = 0;
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < need; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[i];
    fillTriplePartials(board, tp);
    const a = bestOmaha(holeA[0], holeA[1], holeA[2], holeA[3], tp);
    const b = bestOmaha(holeB[0], holeB[1], holeB[2], holeB[3], tp);
    let vmax = -1, ties = 0;
    for (let k = 0; k < nOpp; k++) {
      const p = 5 + k * 4;
      const s = bestOmaha(deck[p], deck[p + 1], deck[p + 2], deck[p + 3], tp);
      if (s > vmax) { vmax = s; ties = 1; } else if (s === vmax) ties++;
    }
    if (a > vmax) accA += 1; else if (a === vmax) accA += 1 / (ties + 1);
    if (b > vmax) accB += 1; else if (b === vmax) accB += 1 / (ties + 1);
  }
  return [(100 * accA) / trials, (100 * accB) / trials];
}

/** Equities of a fixed set of hands in one pot over shared deals. They sum to exactly 100. */
export function sharedDealEquities(holes, trials, seedStr) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const dead = new Set(holes.flat());
  const base = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) base.push(c);
  const deck = Int32Array.from(base);
  const n = deck.length;
  const board = new Int32Array(5);
  const acc = new Float64Array(holes.length);
  const sc = new Int32Array(holes.length);
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < 5; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      board[i] = deck[i];
    }
    fillTriplePartials(board, tp);
    let mx = -1, ties = 0;
    for (let k = 0; k < holes.length; k++) {
      const h = holes[k];
      const v = bestOmaha(h[0], h[1], h[2], h[3], tp);
      sc[k] = v;
      if (v > mx) { mx = v; ties = 1; } else if (v === mx) ties++;
    }
    for (let k = 0; k < holes.length; k++) if (sc[k] === mx) acc[k] += 1 / ties;
  }
  return Array.from(acc, (x) => (100 * x) / trials);
}

/**
 * Run the production evaluator and the independent reference evaluator over the SAME deals.
 * @param {(hole:number[], board:number[])=>number} refBest the reference Omaha search
 * @returns {{a:number, b:number, disagree:number}} equity under each engine, and the number of
 *          trials where the two engines ranked the showdown differently (must be 0)
 */
export function crossEngineEquity(hole, refBest, trials, seedStr, nOpp) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const base = [];
  for (let c = 0; c < 52; c++) if (!hole.includes(c)) base.push(c);
  const deck = Int32Array.from(base);
  const n = deck.length;
  const need = 5 + nOpp * 4;
  const board = new Array(5);
  let accA = 0, accB = 0, disagree = 0;
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < need; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[i];
    fillTriplePartials(board, tp);
    const ha = bestOmaha(hole[0], hole[1], hole[2], hole[3], tp);
    const hb = refBest(hole, board);
    let amax = -1, aties = 0, bmax = -1, bties = 0;
    for (let k = 0; k < nOpp; k++) {
      const p = 5 + k * 4;
      const v = [deck[p], deck[p + 1], deck[p + 2], deck[p + 3]];
      const sa = bestOmaha(v[0], v[1], v[2], v[3], tp);
      const sb = refBest(v, board);
      if (sa > amax) { amax = sa; aties = 1; } else if (sa === amax) aties++;
      if (sb > bmax) { bmax = sb; bties = 1; } else if (sb === bmax) bties++;
    }
    const ea = ha > amax ? 1 : ha === amax ? 1 / (aties + 1) : 0;
    const eb = hb > bmax ? 1 : hb === bmax ? 1 / (bties + 1) : 0;
    if (ea !== eb) disagree++;
    accA += ea; accB += eb;
  }
  return { a: (100 * accA) / trials, b: (100 * accB) / trials, disagree };
}

/** Shared-deal cross-engine check for a heads-up match against a FIXED villain hand. */
export function crossEngineEquityVs(hole, villain, refBest, trials, seedStr) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const dead = new Set([...hole, ...villain]);
  const base = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) base.push(c);
  const deck = Int32Array.from(base);
  const n = deck.length;
  const board = new Array(5);
  let accA = 0, accB = 0, disagree = 0;
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < 5; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      board[i] = deck[i];
    }
    fillTriplePartials(board, tp);
    const a1 = bestOmaha(hole[0], hole[1], hole[2], hole[3], tp);
    const b1 = bestOmaha(villain[0], villain[1], villain[2], villain[3], tp);
    const a2 = refBest(hole, board);
    const b2 = refBest(villain, board);
    const e1 = a1 > b1 ? 1 : a1 === b1 ? 0.5 : 0;
    const e2 = a2 > b2 ? 1 : a2 === b2 ? 0.5 : 0;
    if (e1 !== e2) disagree++;
    accA += e1; accB += e2;
  }
  return { a: (100 * accA) / trials, b: (100 * accB) / trials, disagree };
}

// ---------------------------------------------------------------------------
// worker body
// ---------------------------------------------------------------------------
if (!isMainThread && workerData && workerData.__mcWorker) {
  const { pools, starts, ranges, filtered, reps } = workerData;
  parentPort.on('message', (msg) => {
    const out = [];
    for (const job of msg.jobs) {
      if (job.kind === 'eq1') {
        out.push({ id: job.id, out: runEq1(reps, job.deals, fnv1a(`eq1|${job.block}`)) });
        continue;
      }
      const pool = pools[job.pool];
      const st = starts[job.pool];
      const lo = st[job.unit], hi = st[job.unit + 1];
      if (job.kind === 'vs3bet') {
        out.push({
          id: job.id,
          out: runVs(pool, lo, hi, ranges[job.comp], job.trials,
            fnv1a(`hero|${job.stage}|${job.key}|${job.comp}`), fnv1a(`stream|${job.stage}|${job.comp}`)),
        });
      } else if (job.kind === 'latt') {
        // the hero stream is the CELL stage's, so the delta this job feeds is paired hand for hand
        out.push({
          id: job.id,
          out: runMultiFiltered(pool, lo, hi, filtered[job.v], job.q, job.trials,
            fnv1a(`hero|cell|${job.key}`), fnv1a(`villain|latt|${job.v}`)),
        });
      } else {
        out.push({
          id: job.id,
          out: runMulti(pool, lo, hi, job.trials,
            fnv1a(`hero|${job.stage}|${job.key}`), fnv1a(`stream|${job.stage}`),
            fnv1a(`stream6|${job.stage}`)),
        });
      }
    }
    parentPort.postMessage({ results: out });
  });
  parentPort.postMessage({ ready: true });
}

// ---------------------------------------------------------------------------
// pool driver (main thread)
// ---------------------------------------------------------------------------
/** Boot a worker pool once; reuse across every stage. */
export async function startPool(cfg) {
  const workers = [];
  const boot = [];
  for (let w = 0; w < cfg.workers; w++) {
    const wk = new Worker(SELF, {
      workerData: {
        __mcWorker: true, pools: cfg.pools, starts: cfg.starts, ranges: cfg.ranges,
        filtered: cfg.filtered, reps: cfg.reps,
      },
    });
    workers.push(wk);
    boot.push(new Promise((res, rej) => { wk.once('message', res); wk.once('error', rej); }));
  }
  await Promise.all(boot);
  return workers;
}

export async function stopPool(workers) {
  for (const wk of workers) await wk.terminate();
}

/**
 * Run a job list across the pool. Jobs are handed out one chunk at a time so slow units cannot
 * starve a worker (dynamic load balancing beats static striping when unit cost varies).
 * @param {object[]} jobs each { id, kind, ... }: 'multi'/'vs3bet'/'latt' take
 *   { pool, unit, stage, key, trials } plus comp (vs3bet) or v and q (latt); 'eq1' takes
 *   { block, deals } and reads the class representatives out of workerData.
 */
export function runJobs(workers, jobs, onProgress, chunkSize = 4) {
  const results = new Array(jobs.length);
  const chunks = [];
  for (let i = 0; i < jobs.length; i += chunkSize) chunks.push(jobs.slice(i, i + chunkSize));
  let next = 0, done = 0;

  return new Promise((resolve, reject) => {
    if (!chunks.length) return resolve(results);
    let live = 0;
    const handlers = [];
    const feed = (wk) => {
      if (next >= chunks.length) return false;
      wk.postMessage({ jobs: chunks[next++] });
      live++;
      return true;
    };
    workers.forEach((wk) => {
      const h = (m) => {
        if (!m || !m.results) return;
        for (const r of m.results) { results[r.id] = r.out; done++; }
        live--;
        if (onProgress) onProgress(done, jobs.length);
        if (!feed(wk) && live === 0) {
          handlers.forEach(([w, fn]) => w.off('message', fn));
          resolve(results);
        }
      };
      handlers.push([wk, h]);
      wk.on('message', h);
      wk.on('error', reject);
    });
    workers.forEach((wk) => feed(wk));
    workers.forEach((wk) => feed(wk));   // two chunks in flight per worker hides IPC latency
  });
}
