// villains.mjs — the face-up 3-bet component ranges, enumerated into packed Uint32Arrays
// and sampled with the range-index + 52-bit conflict-mask technique (never whole-trial rejection).
//
// Component membership is first-match-wins, so AAKK samples as AAxx:
//   AAxx  exactly 2 aces
//   KKxx  exactly 2 kings, fewer than 2 aces
//   QQxx  exactly 2 queens, fewer than 2 kings and fewer than 2 aces
//   BWR   the BROADWAY_RUN row (4 distinct ranks, all >= T)
//
// Packing: 4 card indices x 6 bits into one u32.

import { rowOf } from './taxonomy.mjs';

export const COMPONENTS = ['AA', 'KK', 'QQ', 'BWR'];
export const COMPONENT_LABELS = { AA: 'AAxx', KK: 'KKxx', QQ: 'QQxx', BWR: 'Broadway run' };

function componentOf(cards) {
  let a = 0, k = 0, q = 0;
  for (let i = 0; i < 4; i++) {
    const r = cards[i] >> 2;
    if (r === 12) a++; else if (r === 11) k++; else if (r === 10) q++;
  }
  if (a === 2) return 'AA';
  if (k === 2 && a < 2) return 'KK';
  if (q === 2 && k < 2 && a < 2) return 'QQ';
  if (rowOf(cards) === 'BROADWAY_RUN') return 'BWR';
  return null;
}

/** Enumerate the four component ranges. Returns { AA: Uint32Array, KK, QQ, BWR }. */
export function buildComponentRanges() {
  const lists = { AA: [], KK: [], QQ: [], BWR: [] };
  const h = [0, 0, 0, 0];
  for (let a = 0; a < 52; a++) {
    h[0] = a;
    for (let b = a + 1; b < 52; b++) {
      h[1] = b;
      for (let c = b + 1; c < 52; c++) {
        h[2] = c;
        for (let d = c + 1; d < 52; d++) {
          h[3] = d;
          const comp = componentOf(h);
          if (comp) lists[comp].push((a | (b << 6) | (c << 12) | (d << 18)) >>> 0);
        }
      }
    }
  }
  const out = {};
  for (const k of COMPONENTS) out[k] = Uint32Array.from(lists[k]);
  return out;
}

/**
 * Sample one hand from `range` that is disjoint from the used-card mask (lo/hi int32 pair).
 * Returns the packed hand, or -1 if `tries` rejections in a row (never observed in practice
 * with these ranges and 4 dead cards).
 */
export function sampleFromRange(range, rng, loMask, hiMask, tries = 400) {
  const n = range.length;
  for (let t = 0; t < tries; t++) {
    const pk = range[(rng.next() % n) >>> 0];
    const c0 = pk & 63, c1 = (pk >>> 6) & 63, c2 = (pk >>> 12) & 63, c3 = (pk >>> 18) & 63;
    let ok = true;
    for (const c of [c0, c1, c2, c3]) {
      const bit = c < 32 ? (loMask & (1 << c)) : (hiMask & (1 << (c - 32)));
      if (bit) { ok = false; break; }
    }
    if (ok) return pk;
  }
  return -1;
}

/** Default pool mix, per the model brief. */
export const DEFAULT_MIX = { AA: 0.60, KK: 0.25, QQ: 0.10, BWR: 0.05 };
