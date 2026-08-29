// eval5.mjs — bitmask / rank-histogram 5-card evaluator + PLO showdown with board-triple partials.
// Zero dependencies. Node ESM (also safe to inline into a browser page: no Node APIs used).
//
// Card encoding: c = rank*4 + suit, rank 0..12 ('2'=0 ... 'T'=8, 'J'=9, 'Q'=10, 'K'=11, 'A'=12),
// suit 0..3 = s,h,d,c.  A 5-card score packs as (cat << 26) | tiebreak and fits in int32, so a
// plain `>` is a full hand comparison.
//
// Categories: 0 high · 1 pair · 2 two pair · 3 trips · 4 straight · 5 flush · 6 full house
//             7 quads · 8 straight flush

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'shdc';

export const rankOf = (c) => c >> 2;
export const suitOf = (c) => c & 3;

/** Parse "As" -> card index. Case-insensitive on the rank, suit must be lower-case s/h/d/c. */
export function parseCard(str) {
  const r = RANK_CHARS.indexOf(str[0].toUpperCase());
  const s = SUIT_CHARS.indexOf(str[1].toLowerCase());
  if (r < 0 || s < 0) throw new Error(`bad card "${str}"`);
  return r * 4 + s;
}
/** Parse "AsAhKsKh" -> [c,c,c,c] */
export function parseHand(str) {
  const clean = str.replace(/[\s,]/g, '');
  if (clean.length % 2) throw new Error(`bad hand "${str}"`);
  const out = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseCard(clean.slice(i, i + 2)));
  return out;
}
export function cardStr(c) { return RANK_CHARS[rankOf(c)] + SUIT_CHARS[suitOf(c)]; }
export function handStr(cards) { return cards.map(cardStr).join(''); }

// ---------------------------------------------------------------------------
// Lookup tables (the only tables in the engine)
// ---------------------------------------------------------------------------

/** STRAIGHT_HI[q13] = high rank of the straight, or -1. Only exact 5-bit straight masks are set,
 *  so a 5-card hand containing any pair (fewer than 5 distinct ranks) can never index a hit. */
export const STRAIGHT_HI = (() => {
  const t = new Int8Array(8192).fill(-1);
  // A5432 (wheel): ranks A,5,4,3,2 -> bits 12,3,2,1,0 ; high card is the 5 (rank 3)
  t[(1 << 12) | (1 << 3) | (1 << 2) | (1 << 1) | 1] = 3;
  for (let hi = 4; hi <= 12; hi++) {
    let m = 0;
    for (let k = 0; k < 5; k++) m |= 1 << (hi - k);
    t[m] = hi;
  }
  return t;
})();

/** popcount for 13-bit masks */
export const PC = (() => {
  const t = new Uint8Array(8192);
  for (let i = 1; i < 8192; i++) t[i] = t[i >> 1] + (i & 1);
  return t;
})();

const CAT = 1 << 26;

// ---------------------------------------------------------------------------
// Core: score a 5-card hand from its rank histogram masks + flush flag
// ---------------------------------------------------------------------------
/**
 * @param {number} Q ranks present (13-bit)
 * @param {number} P ranks appearing >= 2
 * @param {number} T ranks appearing >= 3
 * @param {number} F ranks appearing == 4
 * @param {boolean} flush all five cards share a suit
 */
export function scoreMasks(Q, P, T, F, flush) {
  const st = STRAIGHT_HI[Q];
  if (st >= 0) {
    if (flush) return 8 * CAT + st;
    if (F === 0 && P === 0) {
      // 5 distinct ranks, no flush -> straight (cat 4). A flush with 5 distinct ranks was
      // handled above; the P===0 test is redundant but keeps the branch honest.
      return 4 * CAT + st;
    }
  }
  if (F !== 0) return 7 * CAT + ((F << 13) | (Q ^ F));
  if (T !== 0) {
    if (P !== T) return 6 * CAT + ((T << 13) | (P ^ T));      // full house
    if (flush) return 5 * CAT + Q;                             // impossible, kept for totality
    return 3 * CAT + ((T << 13) | (Q ^ T));                    // trips
  }
  if (flush) return 5 * CAT + Q;
  if (P !== 0) {
    const np = PC[P];
    if (np === 2) return 2 * CAT + ((P << 13) | (Q ^ P));      // two pair
    return 1 * CAT + ((P << 13) | (Q ^ P));                    // one pair
  }
  return 0 * CAT + Q;                                          // high card
}

/** Straightforward 5-card evaluator (cards 0..51). Used by tests and the reference path. */
export function eval5(a, b, c, d, e) {
  let Q = 0, P = 0, T = 0, F = 0;
  const s0 = a & 3;
  const flush = ((b & 3) === s0) && ((c & 3) === s0) && ((d & 3) === s0) && ((e & 3) === s0);
  const cards = [a, b, c, d, e];
  for (let i = 0; i < 5; i++) {
    const bit = 1 << (cards[i] >> 2);
    if (Q & bit) { if (P & bit) { if (T & bit) F |= bit; else T |= bit; } else P |= bit; } else Q |= bit;
  }
  return scoreMasks(Q, P, T, F, flush);
}

// ---------------------------------------------------------------------------
// PLO showdown: best of C(4,2) x C(5,3) = 60, with board-triple partials
// ---------------------------------------------------------------------------

export const H2A = new Int8Array([0, 0, 0, 1, 1, 2]);
export const H2B = new Int8Array([1, 2, 3, 2, 3, 3]);
const B3 = [[0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4], [0, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]];

/** Reusable scratch for board partials (one per evaluation context). */
export function makeTriplePartials() {
  return { Q: new Int32Array(10), P: new Int32Array(10), T: new Int32Array(10), M: new Int8Array(10) };
}

/** Fill `tp` from a 5-card board. Called once per trial; amortised over every player. */
export function fillTriplePartials(board, tp) {
  const { Q, P, T, M } = tp;
  for (let j = 0; j < 10; j++) {
    const b = B3[j];
    let q = 0, p = 0, t = 0;
    for (let k = 0; k < 3; k++) {
      const bit = 1 << (board[b[k]] >> 2);
      if (q & bit) { if (p & bit) t |= bit; else p |= bit; } else q |= bit;
    }
    Q[j] = q; P[j] = p; T[j] = t;
    const s = board[b[0]] & 3;
    M[j] = ((board[b[1]] & 3) === s && (board[b[2]] & 3) === s) ? s : -1;
  }
}

/** Best Omaha 5-card score for a 4-card hole hand against prefilled board partials. */
export function bestOmaha(h0, h1, h2, h3, tp) {
  const hole = [h0, h1, h2, h3];
  const { Q: TQ, P: TP, T: TT, M: TM } = tp;
  let best = -1;
  for (let i = 0; i < 6; i++) {
    const x = hole[H2A[i]], y = hole[H2B[i]];
    const bx = 1 << (x >> 2), by = 1 << (y >> 2);
    const sx = x & 3;
    const same = sx === (y & 3);
    for (let j = 0; j < 10; j++) {
      let Q = TQ[j], P = TP[j], T = TT[j], F = 0;
      if (Q & bx) { if (P & bx) { if (T & bx) F |= bx; else T |= bx; } else P |= bx; } else Q |= bx;
      if (Q & by) { if (P & by) { if (T & by) F |= by; else T |= by; } else P |= by; } else Q |= by;
      const v = scoreMasks(Q, P, T, F, same && TM[j] === sx);
      if (v > best) best = v;
    }
  }
  return best;
}

/** Naive best-of-60 without partials — kept as an internal consistency reference for tests. */
export function bestOmahaNaive(hole, board) {
  let best = -1;
  for (let i = 0; i < 6; i++) {
    const h0 = hole[H2A[i]], h1 = hole[H2B[i]];
    for (let j = 0; j < 10; j++) {
      const b = B3[j];
      const v = eval5(h0, h1, board[b[0]], board[b[1]], board[b[2]]);
      if (v > best) best = v;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Category of a packed score (for the C(52,5) frequency gate)
// ---------------------------------------------------------------------------
export function categoryOf(score) { return (score / CAT) | 0; }
export const CATEGORY_NAMES = ['high card', 'pair', 'two pair', 'trips', 'straight', 'flush', 'full house', 'quads', 'straight flush'];

// ---------------------------------------------------------------------------
// Seeded RNG — xorshift128, deterministic across platforms (all int32 ops)
// ---------------------------------------------------------------------------
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export class Rng {
  constructor(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    // splitmix-ish expansion so nearby seeds decorrelate
    this.a = (s = (s ^ 0x9e3779b9) >>> 0) || 1;
    this.b = (s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0) || 2;
    this.c = (s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0) || 3;
    this.d = (s = (s ^ (s >>> 16)) >>> 0) || 4;
    for (let i = 0; i < 24; i++) this.next();
  }
  /** uint32 */
  next() {
    let t = this.a ^ (this.a << 11);
    this.a = this.b; this.b = this.c; this.c = this.d;
    this.d = (this.d ^ (this.d >>> 19)) ^ (t ^ (t >>> 8));
    return this.d >>> 0;
  }
  /** integer in [0, n) */
  int(n) { return Math.floor((this.next() / 4294967296) * n); }
  float() { return this.next() / 4294967296; }
}
