// order-pack.test.mjs — the frozen villain ordering, as bytes and as a permutation.
//
// The last test in this file is the one that matters most in the whole Phase-4 data change: it
// proves that the 40 KB shipped in `model.order` reproduces the generator's own filtered villain
// pools HAND FOR HAND at every lattice point. If that ever stops being true, the Simulate button
// is measuring against a different field from the one the shipped lattice was measured against,
// and every "measured" badge it flips is a lie about which question was answered.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ORDER_BITS, b64encode, b64decode, packOrder, unpackOrder, orderHash, permutationProblem,
} from '../scripts/lib/order-pack.mjs';
import {
  buildSuitClasses, canonicalRanks, classTableCanonical, cutAt,
} from '../scripts/lib/villain-range.mjs';
import { enumerateAll } from '../scripts/lib/taxonomy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));

/** a deterministic pseudo-random permutation of 0..n-1 */
function permutation(n, seed) {
  const a = Int32Array.from({ length: n }, (_, i) => i);
  let s = seed >>> 0;
  const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0);
  for (let i = n - 1; i > 0; i--) {
    const j = next() % (i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

test('base64 round-trips at every remainder, and rejects a corrupted character', () => {
  for (const len of [0, 1, 2, 3, 4, 5, 17, 255, 1000]) {
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = (i * 37 + 11) & 0xff;
    const back = b64decode(b64encode(bytes));
    assert.equal(back.length, len, `length at ${len}`);
    assert.deepEqual(Array.from(back), Array.from(bytes), `bytes at ${len}`);
  }
  // Node's own base64 is the reference, so this is a cross-implementation check, not a self-check
  const probe = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  assert.equal(b64encode(probe), Buffer.from(probe).toString('base64'));
  assert.throws(() => b64decode('AAAA*AAA'), /bad base64 character at index 4/);
});

test('a permutation survives the 15-bit packing, and the shipped width is not 14', () => {
  assert.equal(ORDER_BITS, 15, '16,432 classes do not fit in 14 bits (2^14 = 16,384)');
  const n = 16432;
  const p = permutation(n, 12345);
  const packed = packOrder(p);
  assert.equal(packed.length, Math.ceil(Math.ceil((n * ORDER_BITS) / 8) / 3) * 4);
  const back = unpackOrder(packed, n);
  assert.deepEqual(Array.from(back), Array.from(p));
  assert.equal(permutationProblem(back, n), '');
});

test('packOrder refuses a value that does not fit, unpackOrder refuses a short payload', () => {
  assert.throws(() => packOrder([0, 1, 1 << ORDER_BITS]), /does not fit in 15 bits/);
  assert.throws(() => packOrder([0, -1]), /does not fit/);
  const packed = packOrder(permutation(100, 7));
  assert.throws(() => unpackOrder(packed, 400), /need \d+ B for 400 entries/);
});

test('orderHash is stable, and one swap changes it', () => {
  const p = permutation(2000, 99);
  const h = orderHash(p);
  assert.match(h, /^[0-9a-f]{16}$/);
  assert.equal(h, orderHash(Array.from(p)), 'typed and plain arrays hash alike');
  const q = Int32Array.from(p);
  const t = q[17]; q[17] = q[1900]; q[1900] = t;
  assert.notEqual(orderHash(q), h);
});

test('permutationProblem names every way a permutation can be wrong', () => {
  assert.equal(permutationProblem([0, 1, 2], 3), '');
  assert.match(permutationProblem([0, 1], 3), /length 2, expected 3/);
  assert.match(permutationProblem([0, 1, 1], 3), /class 1 appears more than once/);
  assert.match(permutationProblem([0, 1, 3], 3), /entry 2 is 3, outside 0\.\.2/);
  assert.match(permutationProblem([0, 1, -1], 3), /entry 2 is -1/);
});

test('the SHIPPED order decodes to an exact permutation whose hash matches meta', () => {
  assert.ok(MODEL.order && typeof MODEL.order.packed === 'string', 'model.order is present');
  assert.equal(MODEL.order.bits, ORDER_BITS);
  assert.equal(MODEL.order.n, MODEL.constants.villainLattice.classes);
  const order = unpackOrder(MODEL.order.packed, MODEL.order.n);
  assert.equal(permutationProblem(order, MODEL.order.n), '');
  assert.equal(orderHash(order), MODEL.meta.orderHash);
});

test('the shipped order rebuilds the generator\'s villain pools hand for hand', () => {
  /* Both sides of the translation, run end to end:
       generator side  buildSuitClasses numbers classes by first appearance in E.byCell, and the
                       shipped order is that order expressed in canonical-ascending ids;
       browser side    classTableCanonical numbers them by ascending canonical representative,
                       with no taxonomy involved at all.
     If those two numberings do not agree, the pools below diverge and this test fails. */
  const E = enumerateAll();
  const order = unpackOrder(MODEL.order.packed, MODEL.order.n);

  const cls = buildSuitClasses(E.byCell);
  const cid = canonicalRanks(cls.reps);
  const inv = new Int32Array(cls.n);
  for (let i = 0; i < cls.n; i++) inv[cid[i]] = i;
  const genOrder = Int32Array.from(order, (c) => inv[c]);

  const ct = classTableCanonical(E.byCell);
  assert.equal(ct.n, cls.n, 'both class tables find the same number of classes');

  for (const v of MODEL.constants.villainLattice.v) {
    const g = cutAt(genOrder, cls.size, E.total, v);
    const w = cutAt(order, ct.size, E.total, v);
    assert.equal(g.cum, w.cum, `combo count at v=${v}`);

    const genPool = new Uint32Array(g.cum); let a = 0;
    for (let j = 0; j < E.total; j++) if (g.keep[cls.clsOf[j]]) genPool[a++] = E.byCell[j];
    const webPool = new Uint32Array(w.cum); let b = 0;
    for (let j = 0; j < E.total; j++) if (w.keep[ct.cidOf[j]]) webPool[b++] = E.byCell[j];
    assert.deepEqual(genPool, webPool, `the pool at v=${v} is identical hand for hand`);

    assert.equal(+(g.cum / E.total).toFixed(4), MODEL.constants.villainLattice.realized[v],
      `realised fraction at v=${v} matches the shipped metadata`);
  }

  /* and the whole point of shipping it: a v the generator never cut */
  for (const v of [33, 47.5, 62, 88]) {
    const w = cutAt(order, ct.size, E.total, v);
    assert.ok(Math.abs(w.cum / E.total - v / 100) < 0.001,
      `off-lattice v=${v} lands within a class of its target (got ${(100 * w.cum / E.total).toFixed(3)}%)`);
  }
});

test('the cut rule is monotone in v, and takes whole classes', () => {
  const E = enumerateAll();
  const ct = classTableCanonical(E.byCell);
  const order = unpackOrder(MODEL.order.packed, MODEL.order.n);
  let prev = -1;
  for (let v = 25; v <= 90; v += 5) {
    const { keep, cum } = cutAt(order, ct.size, E.total, v);
    assert.ok(cum > prev, `v=${v} is wider than the step before it`);
    prev = cum;
    // whole classes: the kept combos must be the sum of whole class sizes
    let sum = 0;
    for (let i = 0; i < ct.n; i++) if (keep[i]) sum += ct.size[i];
    assert.equal(sum, cum, `v=${v} takes whole classes only`);
  }
});
