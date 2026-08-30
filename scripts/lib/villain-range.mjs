// villain-range.mjs — the VPIP-filtered villain pool (V2-PLAN §2.3).
//
// "A villain plays the top v% of hands" needs an ordering, and using the model's own score S would
// make the model an input to its own measurement. The ordering is therefore frozen to something
// objective and model-independent: eq1, equity against ONE random opponent, measured over all
// 270,725 starting hands.
//
// Measuring 270,725 hands directly is wasteful, because eq1 is invariant under a relabelling of
// suits: AsAhKsKh and AdAcKdKc are the same hand. This module collapses the deck into
// suit-isomorphism classes and measures one representative per class, which
//   (a) cuts the work by the class-collapse factor (~16x), and
//   (b) removes within-class sampling scatter entirely — two hands that differ only by suit names
//       can never be ordered apart by noise, so the range boundary is suit-symmetric by
//       construction.
//
// The range at VPIP v is then "every hand whose class ranks in the top v% of the deck by eq1",
// taken in WHOLE CLASSES: the cut lands on a class boundary, so the realised fraction misses the
// target by at most one class (<= 24 combos of 270,725 = 0.009%) and never splits a class on an
// arbitrary suit ordering.
//
// Zero dependencies (no Node APIs) so this file is unit-testable and, if a later phase needs it,
// inlinable.

/** the 24 permutations of the four suits, as Int8Array(4) maps oldSuit -> newSuit */
export const SUIT_PERMS = (() => {
  const out = [];
  const perm = (arr, rest) => {
    if (!rest.length) { out.push(Int8Array.from(arr)); return; }
    for (let i = 0; i < rest.length; i++) {
      perm(arr.concat(rest[i]), rest.slice(0, i).concat(rest.slice(i + 1)));
    }
  };
  perm([], [0, 1, 2, 3]);
  return out;
})();

/**
 * Canonical packed form of a 4-card hand under suit relabelling: the smallest packed value any of
 * the 24 suit permutations produces. Two hands share a canonical form exactly when one can be
 * obtained from the other by renaming suits — which is exactly when they have identical equity
 * against a random opponent drawn from a full deck.
 * @returns {number} packed canonical hand (uint32)
 */
export function canonicalOf(c0, c1, c2, c3) {
  let best = 0xffffffff;
  const r0 = c0 & ~3, r1 = c1 & ~3, r2 = c2 & ~3, r3 = c3 & ~3;   // rank*4
  const s0 = c0 & 3, s1 = c1 & 3, s2 = c2 & 3, s3 = c3 & 3;
  for (let p = 0; p < 24; p++) {
    const m = SUIT_PERMS[p];
    let a = r0 + m[s0], b = r1 + m[s1], c = r2 + m[s2], d = r3 + m[s3], t;
    // sort four values ascending (sorting network: 5 compare-exchanges)
    if (a > b) { t = a; a = b; b = t; }
    if (c > d) { t = c; c = d; d = t; }
    if (a > c) { t = a; a = c; c = t; }
    if (b > d) { t = b; b = d; d = t; }
    if (b > c) { t = b; b = c; c = t; }
    const pk = (a | (b << 6) | (c << 12) | (d << 18)) >>> 0;
    if (pk < best) best = pk;
  }
  return best;
}

/**
 * Collapse a hand universe into suit-isomorphism classes.
 * @param {Uint32Array} hands every packed hand, in any order (the universe)
 * @returns {{reps: Uint32Array, clsOf: Int32Array, size: Int32Array, n: number}}
 *   reps[i]  one representative packed hand per class (the canonical form itself)
 *   clsOf[j] the class index of hands[j]
 *   size[i]  how many hands of the universe fall in class i
 */
export function buildSuitClasses(hands) {
  const index = new Map();
  const clsOf = new Int32Array(hands.length);
  const repList = [];
  const sizeList = [];
  for (let j = 0; j < hands.length; j++) {
    const pk = hands[j];
    const can = canonicalOf(pk & 63, (pk >>> 6) & 63, (pk >>> 12) & 63, (pk >>> 18) & 63);
    let ci = index.get(can);
    if (ci === undefined) { ci = repList.length; index.set(can, ci); repList.push(can); sizeList.push(0); }
    clsOf[j] = ci;
    sizeList[ci]++;
  }
  return {
    reps: Uint32Array.from(repList),
    clsOf,
    size: Int32Array.from(sizeList),
    n: repList.length,
  };
}

/**
 * THE CUT RULE, in one place. Walk `order` (classes, best first) taking whole classes until the
 * next one would carry the cut further from the target than stopping does.
 *
 * Factored out of `buildRanges` so the browser can reproduce a pool at an ARBITRARY v from the
 * shipped order (V2-PLAN §4) through the same code the generator cut the shipped lattice with. Two
 * implementations of a rounding rule are two rules.
 *
 * @param {Int32Array|number[]} order class indices, eq1-descending
 * @param {Int32Array|number[]} size combos per class, indexed by class index
 * @param {number} total combos in the universe
 * @param {number} v VPIP percentage
 * @returns {{keep: Uint8Array, cum: number, lastIdx: number}} `lastIdx` is the last class taken —
 *   the one whose eq1 is the cut equity. When nothing is taken it is `order[0]`, which is what the
 *   pre-refactor code reported.
 */
export function cutAt(order, size, total, v) {
  const target = (v / 100) * total;
  const keep = new Uint8Array(size.length);
  let cum = 0, lastIdx = order[0];
  for (let i = 0; i < order.length; i++) {
    const ci = order[i];
    const next = cum + size[ci];
    // stop before this class if including it lands further from the target than excluding it
    if (next > target && (next - target) > (target - cum)) break;
    keep[ci] = 1; cum = next; lastIdx = ci;
    if (cum >= target) break;
  }
  return { keep, cum, lastIdx };
}

/**
 * Turn per-class eq1 into one packed hand list per VPIP lattice point.
 *
 * Classes are ranked by eq1 descending (ties broken by class index, so the result is a pure
 * function of the measurement) and cut by `cutAt` above.
 *
 * @param {Float64Array|number[]} eq1 per-class equity vs one random opponent, in %
 * @param {{reps, clsOf, size, n}} cls the class table from buildSuitClasses
 * @param {Uint32Array} hands the same universe passed to buildSuitClasses
 * @param {number[]} vPoints VPIP percentages, e.g. [25, 40, 55, 70, 90]
 * @returns {{ranges: Object<string, Uint32Array>, realized: Object<string, number>,
 *            cutEq: Object<string, number>, order: Int32Array}}
 */
export function buildRanges(eq1, cls, hands, vPoints) {
  const total = hands.length;
  const order = Int32Array.from({ length: cls.n }, (_, i) => i)
    .sort((a, b) => (eq1[b] - eq1[a]) || (a - b));

  const ranges = {}, realized = {}, cutEq = {};
  for (const v of vPoints) {
    const { keep, cum, lastIdx } = cutAt(order, cls.size, total, v);
    const out = new Uint32Array(cum);
    let w = 0;
    for (let j = 0; j < total; j++) if (keep[cls.clsOf[j]]) out[w++] = hands[j];
    ranges[v] = out;
    realized[v] = cum / total;
    cutEq[v] = eq1[lastIdx];
  }
  return { ranges, realized, cutEq, order };
}

/**
 * Rank every class by its canonical representative, ascending.
 *
 * `buildSuitClasses` numbers classes by first appearance, which ties the numbering to the caller's
 * enumeration order. This gives the ENUMERATION-INDEPENDENT numbering the shipped order is
 * expressed in (see order-pack.mjs): sort the canonical values and use the position.
 *
 * @param {Uint32Array} reps `cls.reps`
 * @returns {Int32Array} `cid[classIndex]` = its rank among the canonical values, ascending
 */
export function canonicalRanks(reps) {
  const idx = Int32Array.from({ length: reps.length }, (_, i) => i)
    .sort((a, b) => (reps[a] < reps[b] ? -1 : reps[a] > reps[b] ? 1 : 0));
  const cid = new Int32Array(reps.length);
  for (let r = 0; r < idx.length; r++) cid[idx[r]] = r;
  return cid;
}

/**
 * Build the class table directly in the canonical-ascending index space — the consumer side of
 * `canonicalRanks`, for a caller that has no taxonomy and therefore no canonical enumeration order
 * of its own (the browser worker). Any hand list containing the whole universe, in any order, gives
 * the same class ids.
 *
 * @param {Uint32Array} hands the packed universe
 * @returns {{reps: Uint32Array, cidOf: Int32Array, size: Int32Array, n: number}}
 *   reps sorted ascending; `cidOf[j]` the canonical-ascending class id of hands[j]
 */
export function classTableCanonical(hands) {
  const canon = new Uint32Array(hands.length);
  const seen = new Map();
  for (let j = 0; j < hands.length; j++) {
    const pk = hands[j];
    const c = canonicalOf(pk & 63, (pk >>> 6) & 63, (pk >>> 12) & 63, (pk >>> 18) & 63);
    canon[j] = c;
    if (!seen.has(c)) seen.set(c, 0);
  }
  const reps = Uint32Array.from(seen.keys()).sort();
  const rank = new Map();
  for (let i = 0; i < reps.length; i++) rank.set(reps[i], i);
  const cidOf = new Int32Array(hands.length);
  const size = new Int32Array(reps.length);
  for (let j = 0; j < hands.length; j++) {
    const c = rank.get(canon[j]);
    cidOf[j] = c; size[c]++;
  }
  return { reps, cidOf, size, n: reps.length };
}
