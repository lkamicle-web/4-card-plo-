// order-pack.mjs — the frozen villain ordering, as bytes the page can carry.
//
// WHY THIS FILE EXISTS
//
// The villain pool at VPIP v is "the top v% of the deck by eq1" (V2-PLAN §2.3), and eq1 is a
// MEASUREMENT: 16,432 suit-isomorphism classes x 60,000 shared deals, about 10^9 showdown
// evaluations. The browser cannot recompute it — not because it is slow (it is), but because a
// re-measurement would land on a DIFFERENT ordering. Two runs of a Monte Carlo differ by their own
// sampling error, and near the cut two classes separated by 0.02 pt of eq1 can swap. The shipped
// lattice (`cells[k].vDelta`) was measured against one specific pool; a browser that re-derived a
// slightly different pool would be simulating a different question and calling the answer a
// correction. So the ordering is frozen at generate time and SHIPPED, and this module is the
// format.
//
// WHAT IS SHIPPED
//
// A permutation of 0..n-1: `order[k]` is the class ranked k-th by eq1, best first. Not the equities
// — only their order, which is all `buildRanges` reads. 16,432 classes need 15 bits each (2^14 =
// 16,384 is 48 short, so 14 does not fit), giving 30,810 bytes, 41,080 base64 characters, about
// 40 KB of the model's ~183 KB. The information-theoretic floor for an arbitrary permutation of
// this length is log2(16432!) / 8 = 25.5 KB, so a Lehmer/arithmetic coder would save about 14 KB;
// it is not worth an unauditable decoder in the hot path of a page that has 36 KB of headroom.
//
// THE INDEX SPACE IS THE LOAD-BEARING DETAIL. `buildSuitClasses` numbers classes by first
// appearance in whatever hand list it was given, which ties those numbers to the generator's
// enumeration order — i.e. to taxonomy.mjs, which is deliberately NOT in the browser worker bundle
// (the worker is pure compute; the taxonomy is main-thread work). So the shipped permutation is
// expressed in a DIFFERENT, enumeration-independent index space: classes sorted by their canonical
// packed representative, ascending. Any consumer that can enumerate the 270,725 hands in any order
// at all and call `canonicalOf` arrives at the same numbering. See `canonicalRanks` and
// `classTableCanonical` in villain-range.mjs for the two ends of that translation.
//
// Zero dependencies, no Node APIs: this file is inlined into the page and into the worker bundle.

/** bits per entry. 15, not 14: 2^14 = 16,384 and there are 16,432 classes. `packOrder` throws on
 *  any value that does not fit, so a future universe that outgrows 32,768 classes fails loudly. */
export const ORDER_BITS = 15;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64INV = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

/** base64-encode a byte array. Own implementation: `btoa` is browser-only, `Buffer` is Node-only. */
export function b64encode(bytes) {
  let out = '';
  const n = bytes.length;
  let i = 0;
  for (; i + 2 < n; i += 3) {
    const w = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(w >>> 18) & 63] + B64[(w >>> 12) & 63] + B64[(w >>> 6) & 63] + B64[w & 63];
  }
  const rem = n - i;
  if (rem === 1) {
    const w = bytes[i] << 16;
    out += B64[(w >>> 18) & 63] + B64[(w >>> 12) & 63] + '==';
  } else if (rem === 2) {
    const w = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(w >>> 18) & 63] + B64[(w >>> 12) & 63] + B64[(w >>> 6) & 63] + '=';
  }
  return out;
}

/** base64-decode to a Uint8Array. Rejects any character outside the alphabet rather than skipping
 *  it: a cache or a hand-edited model that corrupted one character must fail loudly, not decode to
 *  a shifted permutation that still passes a length check. */
export function b64decode(str) {
  let end = str.length;
  while (end > 0 && str.charCodeAt(end - 1) === 61) end--;      // '='
  const out = new Uint8Array(Math.floor((end * 3) / 4));
  let acc = 0, bits = 0, w = 0;
  for (let i = 0; i < end; i++) {
    const code = str.charCodeAt(i);
    const d = code < 128 ? B64INV[code] : -1;
    if (d < 0) throw new Error(`order-pack: bad base64 character at index ${i}`);
    acc = (acc << 6) | d; bits += 6;
    if (bits >= 8) { bits -= 8; out[w++] = (acc >>> bits) & 0xff; }
  }
  return out;
}

/**
 * Pack a permutation into `ORDER_BITS`-bit little-endian fields and base64 it.
 * @param {Int32Array|number[]} order values in [0, 2^ORDER_BITS)
 * @returns {string} base64
 */
export function packOrder(order) {
  const n = order.length;
  const lim = 1 << ORDER_BITS;
  const bytes = new Uint8Array(Math.ceil((n * ORDER_BITS) / 8));
  let bit = 0;
  for (let i = 0; i < n; i++) {
    const v = order[i];
    if (!(v >= 0 && v < lim && v === (v | 0))) {
      throw new RangeError(`order-pack: value ${v} at ${i} does not fit in ${ORDER_BITS} bits`);
    }
    for (let b = 0; b < ORDER_BITS; b++) {
      if ((v >>> b) & 1) bytes[(bit + b) >> 3] |= 1 << ((bit + b) & 7);
    }
    bit += ORDER_BITS;
  }
  return b64encode(bytes);
}

/**
 * Inverse of `packOrder`.
 * @param {string} str base64 from packOrder
 * @param {number} n how many entries to read
 * @returns {Int32Array}
 */
export function unpackOrder(str, n) {
  const bytes = b64decode(str);
  const need = Math.ceil((n * ORDER_BITS) / 8);
  if (bytes.length < need) {
    throw new Error(`order-pack: packed payload is ${bytes.length} B, need ${need} B for ${n} entries`);
  }
  const out = new Int32Array(n);
  let bit = 0;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let b = 0; b < ORDER_BITS; b++) {
      if ((bytes[(bit + b) >> 3] >>> ((bit + b) & 7)) & 1) v |= 1 << b;
    }
    out[i] = v;
    bit += ORDER_BITS;
  }
  return out;
}

/**
 * A 64-bit FNV-ish hash of the permutation ITSELF, not of its encoding, so the gate that compares
 * it against `meta.orderHash` keeps meaning if the packing format is ever changed.
 * @param {Int32Array|number[]} order
 * @returns {string} 16 lower-case hex characters
 */
export function orderHash(order) {
  let h1 = 0x811c9dc5 >>> 0, h2 = 0x9e3779b9 >>> 0;
  for (let i = 0; i < order.length; i++) {
    const v = order[i] >>> 0;
    for (let k = 0; k < 4; k++) {
      const byte = (v >>> (k * 8)) & 0xff;
      h1 = Math.imul(h1 ^ byte, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ byte, 0x85ebca6b) >>> 0;
    }
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Is this array an exact permutation of 0..n-1? Returns a reason string, or '' when it is.
 * Structural, not statistical: a duplicated or missing class id would silently change which hands
 * are in the pool at every v, so this is checked on every load, not only in verify.
 */
export function permutationProblem(order, n) {
  if (order.length !== n) return `length ${order.length}, expected ${n}`;
  const seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = order[i];
    if (!(v >= 0 && v < n)) return `entry ${i} is ${v}, outside 0..${n - 1}`;
    if (seen[v]) return `class ${v} appears more than once (at index ${i})`;
    seen[v] = 1;
  }
  return '';
}
