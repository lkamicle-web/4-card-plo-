// node --test test/*.test.mjs
//
// The v2 build-time measurements (V2-PLAN §2.1-§2.4): the cooler rate, the N = 6,7 extension, the
// frozen villain ordering and its VPIP-filtered pools, and the sub layer's own M_play.
//
// The load-bearing test in this file is the first one. Gate I22 asserts that v2 paints v1's tiers
// exactly, which is only possible if every v1 equity reproduces bit for bit; that in turn is only
// possible if the v1 random streams consume exactly the draws they consumed in v1. So the v1
// kernel is frozen here, verbatim, and the v2 kernel is required to agree with it to the last bit.
// If a future change to mc.mjs perturbs a v1 stream, this fails with a far more useful message
// than "170,478 tiers moved".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Rng, fnv1a, makeTriplePartials, fillTriplePartials, bestOmaha, eval5, categoryOf, parseHand,
} from '../scripts/lib/eval5.mjs';
import {
  runMulti, runMultiFiltered, runEq1, isCooler, NMAX, COOLER_MIN_CAT, COOLER_REF_N,
  VILLAIN_DISCIPLINE,
} from '../scripts/lib/mc.mjs';
import { enumerateAll } from '../scripts/lib/taxonomy.mjs';
import { canonicalOf, buildSuitClasses, buildRanges, SUIT_PERMS } from '../scripts/lib/villain-range.mjs';
import * as P from '../scripts/lib/policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const HAVE_MODEL = existsSync(MODEL_PATH);
const M = HAVE_MODEL ? JSON.parse(readFileSync(MODEL_PATH, 'utf8')) : null;
const HAVE_V2 = !!(M && M.meta.nMax > 5);

// one enumeration, shared by every test in the file (it costs ~0.7 s)
let ENUM = null;
const E = () => (ENUM || (ENUM = enumerateAll()));

// ---------------------------------------------------------------------------
// the v1 multi-N kernel, frozen. Do not "improve" this copy: its only job is to be what mc.mjs
// used to be, so that the v2 kernel can be held against it.
function v1RunMulti(pool, lo, hi, trials, heroSeed, streamSeed) {
  const heroRng = new Rng(heroSeed);
  const rng = new Rng(streamSeed);
  const tp = makeTriplePartials();
  const acc = new Float64Array(5);
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  const vs = new Int32Array(5);
  const span = hi - lo;
  for (let t = 0; t < trials; t++) {
    const pk = pool[lo + ((heroRng.next() % span) >>> 0)];
    const h0 = pk & 63, h1 = (pk >>> 6) & 63, h2 = (pk >>> 12) & 63, h3 = (pk >>> 18) & 63;
    let n = 0;
    for (let c = 0; c < 52; c++) if (c !== h0 && c !== h1 && c !== h2 && c !== h3) deck[n++] = c;
    for (let i = 0; i < 25; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[i];
    fillTriplePartials(board, tp);
    const hero = bestOmaha(h0, h1, h2, h3, tp);
    for (let k = 0; k < 5; k++) {
      const b = 5 + k * 4;
      vs[k] = bestOmaha(deck[b], deck[b + 1], deck[b + 2], deck[b + 3], tp);
    }
    let vmax = -1, vties = 0;
    for (let k = 0; k < 5; k++) {
      const s = vs[k];
      if (s > vmax) { vmax = s; vties = 1; } else if (s === vmax) vties++;
      if (hero > vmax) acc[k] += 1; else if (hero === vmax) acc[k] += 1 / (vties + 1);
    }
  }
  for (let k = 0; k < 5; k++) acc[k] = (100 * acc[k]) / trials;
  return acc;
}

const CELLS = ['AA_BIGPAIR|DS', 'RUN2|SS', 'TRASH|RB', 'SMPAIR_JUNK|SS', 'RUN0_LOW|DS', 'A_BLOCKED|RB'];
const unitOf = (key) => {
  const e = E();
  const u = e.cellIdx.get(key);
  return { pool: e.byCell, lo: e.cellStart[u], hi: e.cellStart[u + 1] };
};

test('N=6,7 is dealt from a separate stream: eq[1..5] is bit-identical to the v1 kernel', () => {
  for (const key of CELLS) {
    const { pool, lo, hi } = unitOf(key);
    const a = v1RunMulti(pool, lo, hi, 4000, fnv1a(`hero|cell|${key}`), fnv1a('stream|cell'));
    const b = runMulti(pool, lo, hi, 4000, fnv1a(`hero|cell|${key}`), fnv1a('stream|cell'), fnv1a('stream6|cell'));
    assert.equal(b.eq.length, NMAX);
    for (let k = 0; k < 5; k++) {
      assert.equal(b.eq[k], a[k], `${key} eq[N=${k + 1}] moved: ${a[k]} -> ${b.eq[k]}`);
    }
  }
});

test('the villains-6-7 stream cannot reach back into the v1 numbers', () => {
  const { pool, lo, hi } = unitOf('RUN2|SS');
  const a = runMulti(pool, lo, hi, 3000, fnv1a('hero|cell|RUN2|SS'), fnv1a('stream|cell'), fnv1a('stream6|cell'));
  const b = runMulti(pool, lo, hi, 3000, fnv1a('hero|cell|RUN2|SS'), fnv1a('stream|cell'), fnv1a('a different stream'));
  for (let k = 0; k < 5; k++) assert.equal(a.eq[k], b.eq[k], `eq[N=${k + 1}] must not depend on the 6-7 stream`);
  assert.notEqual(a.eq[5], b.eq[5], 'eq[N=6] must depend on it');
  // and the cooler is judged at N=3, so it cannot move either
  assert.equal(a.coolNum, b.coolNum);
  assert.equal(a.coolDen, b.coolDen);
});

test('equity decays monotonically as the field grows, out to N=7', () => {
  for (const key of CELLS) {
    const { pool, lo, hi } = unitOf(key);
    const r = runMulti(pool, lo, hi, 20000, fnv1a(`hero|cell|${key}`), fnv1a('stream|cell'), fnv1a('stream6|cell'));
    for (let k = 1; k < NMAX; k++) {
      assert.ok(r.eq[k] < r.eq[k - 1], `${key}: eq[${k + 1}] ${r.eq[k]} is not below eq[${k}] ${r.eq[k - 1]}`);
    }
  }
});

// ---------------------------------------------------------------------------
// §2.1 the cooler
// ---------------------------------------------------------------------------
test('the cooler threshold is "a set or better", and a chop is not a loss', () => {
  assert.equal(COOLER_MIN_CAT, 3);
  assert.equal(COOLER_REF_N, 3);
  const cat = (h) => categoryOf(eval5(...parseHand(h)));
  // the ladder, either side of the cut
  assert.equal(cat('9s9h7d7c2s'), 2);          // two pair — not strong enough
  assert.equal(cat('9s9h9d2s3h'), 3);          // a set
  assert.equal(cat('9s8h7d6c5s'), 4);          // straight
  assert.equal(cat('As9s7s4s2s'), 5);          // flush
  assert.equal(cat('9s9h9d2s2h'), 6);          // full house
  assert.equal(cat('9s9h9d9c2s'), 7);          // quads
  assert.equal(cat('9s8s7s6s5s'), 8);          // straight flush
  const twoPair = eval5(...parseHand('9s9h7d7c2s'));
  const set = eval5(...parseHand('9s9h9d2s3h'));
  const boat = eval5(...parseHand('9s9h9d2s2h'));
  const weak = eval5(...parseHand('As9h7d5c2s'));
  assert.equal(isCooler(twoPair, [boat, weak, weak, weak]), null, 'two pair is not a cooler, it is a fold');
  assert.equal(isCooler(set, [boat, weak, weak, weak]), true);
  assert.equal(isCooler(set, [weak, weak, weak, boat]), false, 'villain 4 is past the reference field');
  assert.equal(isCooler(set, [set, weak, weak, weak]), false, 'a chop is not a loss');
  assert.equal(isCooler(set, [weak, weak, weak, weak]), false);
});

test('the cooler counters recompute exactly from a replay of the same deals', () => {
  // an independent replay: deal the same trials, and count with a differently-written rule
  // (sort the reference field and compare against its head) rather than the kernel's running max.
  for (const key of ['AA_BIGPAIR|DS', 'DBLPAIR_SMALL|RB']) {
    const { pool, lo, hi } = unitOf(key);
    const TRIALS = 4000;
    const r = runMulti(pool, lo, hi, TRIALS, fnv1a(`hero|cell|${key}`), fnv1a('stream|cell'), fnv1a('stream6|cell'));

    const heroRng = new Rng(fnv1a(`hero|cell|${key}`));
    const rng = new Rng(fnv1a('stream|cell'));
    const tp = makeTriplePartials();
    const deck = new Int32Array(52);
    const board = new Int32Array(5);
    const span = hi - lo;
    let num = 0, den = 0;
    for (let t = 0; t < TRIALS; t++) {
      const pk = pool[lo + ((heroRng.next() % span) >>> 0)];
      const h = [pk & 63, (pk >>> 6) & 63, (pk >>> 12) & 63, (pk >>> 18) & 63];
      let n = 0;
      for (let c = 0; c < 52; c++) if (!h.includes(c)) deck[n++] = c;
      for (let i = 0; i < 25; i++) {
        const j = i + ((rng.next() % (n - i)) >>> 0);
        const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      }
      for (let i = 0; i < 5; i++) board[i] = deck[i];
      fillTriplePartials(board, tp);
      const hero = bestOmaha(h[0], h[1], h[2], h[3], tp);
      if (categoryOf(hero) < 3) continue;
      den++;
      const field = [];
      for (let k = 0; k < 3; k++) {
        const b = 5 + k * 4;
        field.push(bestOmaha(deck[b], deck[b + 1], deck[b + 2], deck[b + 3], tp));
      }
      field.sort((a, b) => b - a);
      if (field[0] > hero) num++;
    }
    assert.equal(r.coolDen, den, `${key} conditioning count`);
    assert.equal(r.coolNum, num, `${key} loss count`);
    assert.ok(den > 0.15 * TRIALS, `${key} reaches a set or better often enough to measure`);
    const rate = num / den;
    assert.ok(rate >= 0 && rate <= 1);
  }
});

// ---------------------------------------------------------------------------
// §2.3 the frozen villain ordering
// ---------------------------------------------------------------------------
test('the canonical form is exactly invariance under renaming suits', () => {
  const can = (s) => { const c = parseHand(s); return canonicalOf(c[0], c[1], c[2], c[3]); };
  assert.equal(SUIT_PERMS.length, 24);
  assert.equal(can('AsAhKsKh'), can('AdAcKdKc'));
  assert.equal(can('JsTh9s8h'), can('JhTs9h8s'));
  assert.notEqual(can('AsAhKsKh'), can('AsAhKsKd'), 'double-suited is not single-suited');
  assert.notEqual(can('AsAhKsKh'), can('AsAhQsQh'), 'different ranks are different hands');
  // every one of the 24 relabellings of one hand lands on the same class
  const base = parseHand('Ks9h5d2c');
  const c0 = canonicalOf(...base);
  for (const m of SUIT_PERMS) {
    const moved = base.map((c) => (c & ~3) + m[c & 3]);
    assert.equal(canonicalOf(...moved), c0);
  }
});

test('the suit classes partition the deck', () => {
  const cls = buildSuitClasses(E().byCell);
  let sum = 0;
  for (const s of cls.size) sum += s;
  assert.equal(sum, 270725);
  assert.equal(cls.reps.length, cls.n);
  assert.ok(cls.n > 1000 && cls.n < 270725);
  assert.ok(Math.max(...cls.size) <= 24, 'no class can be larger than the 24 suit permutations');
  // a representative is itself a member of its class
  for (let i = 0; i < 200; i++) {
    const pk = cls.reps[i];
    assert.equal(canonicalOf(pk & 63, (pk >>> 6) & 63, (pk >>> 12) & 63, (pk >>> 18) & 63), pk);
  }
});

test('the filtered pools take whole classes, land on their target, and nest', () => {
  const e = E();
  const cls = buildSuitClasses(e.byCell);
  // a synthetic ordering is enough to test the cutting rule; the real one is measured, not derived
  const eq1 = new Float64Array(cls.n);
  for (let i = 0; i < cls.n; i++) eq1[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  const V = [25, 40, 55, 70, 90];
  const R = buildRanges(eq1, cls, e.byCell, V);
  let prev = null;
  for (const v of V) {
    const got = R.ranges[v].length;
    assert.ok(Math.abs(got - (v / 100) * 270725) <= 24,
      `v=${v}: ${got} hands is more than one class from the ${(v / 100) * 270725} target`);
    assert.equal(got, Math.round(R.realized[v] * 270725));
    const set = new Set(R.ranges[v]);
    assert.equal(set.size, got, 'no duplicates');
    // whole classes: a hand is in iff its whole class is in
    const inCls = new Map();
    for (const pk of R.ranges[v]) {
      const c = canonicalOf(pk & 63, (pk >>> 6) & 63, (pk >>> 12) & 63, (pk >>> 18) & 63);
      inCls.set(c, (inCls.get(c) || 0) + 1);
    }
    for (let i = 0; i < cls.n; i++) {
      const got2 = inCls.get(cls.reps[i]) || 0;
      assert.ok(got2 === 0 || got2 === cls.size[i], `class ${i} is split across the cut`);
    }
    if (prev) for (const pk of prev) assert.ok(set.has(pk), `v=${v} does not contain the tighter pool`);
    prev = set;
  }
});

test('eq1 is a conservation-respecting measurement of the whole deck', () => {
  const e = E();
  const cls = buildSuitClasses(e.byCell);
  const { win, cnt } = runEq1(cls.reps, 300, fnv1a('eq1|test'));
  let num = 0, den = 0, minEq = 100, maxEq = 0;
  for (let i = 0; i < cls.n; i++) {
    assert.ok(cnt[i] > 0, 'every class is dealt into');
    const eq = (100 * win[i]) / cnt[i];
    minEq = Math.min(minEq, eq); maxEq = Math.max(maxEq, eq);
    num += cls.size[i] * eq; den += cls.size[i];
  }
  // hero and villain are symmetric, so the combo-weighted mean is 50 by construction
  assert.ok(Math.abs(num / den - 50) < 1.5, `combo-weighted mean eq1 ${(num / den).toFixed(2)}`);
  assert.ok(minEq > 0 && maxEq < 100);
  assert.ok(maxEq - minEq > 20, 'the ordering actually separates hands');
});

test('the filtered kernel keeps the villains inside the range and the pot legal', () => {
  const e = E();
  const cls = buildSuitClasses(e.byCell);
  const eq1 = new Float64Array(cls.n);
  for (let i = 0; i < cls.n; i++) eq1[i] = i % 997;
  const R = buildRanges(eq1, cls, e.byCell, [25]);
  const { pool, lo, hi } = unitOf('RUN2|SS');
  // q = 1 makes every villain a range hand, so a fallback is the only way one can escape it
  const strict = runMultiFiltered(pool, lo, hi, R.ranges[25], 1, 2000, fnv1a('hero|cell|RUN2|SS'), fnv1a('villain|latt|25'));
  assert.equal(strict.eq.length, NMAX);
  assert.ok(strict.fallbacks / (2000 * NMAX) < 0.01, `fallback rate ${strict.fallbacks / (2000 * NMAX)}`);
  for (let k = 1; k < NMAX; k++) assert.ok(strict.eq[k] < strict.eq[k - 1]);
  // q = 0 makes every villain random, which must reproduce the random-villain measurement
  const loose = runMultiFiltered(pool, lo, hi, R.ranges[25], 0, 40000, fnv1a('hero|cell|RUN2|SS'), fnv1a('villain|latt|25'));
  const base = runMulti(pool, lo, hi, 40000, fnv1a('hero|cell|RUN2|SS'), fnv1a('stream|cell'), fnv1a('stream6|cell'));
  assert.equal(loose.fallbacks, 0);
  for (let k = 0; k < NMAX; k++) {
    assert.ok(Math.abs(loose.eq[k] - base.eq[k]) < 1.2,
      `q=0 must agree with random villains at N=${k + 1}: ${loose.eq[k]} vs ${base.eq[k]}`);
  }
  assert.ok(VILLAIN_DISCIPLINE > 0 && VILLAIN_DISCIPLINE < 1, 'q is a mix, not a switch');
});

// ---------------------------------------------------------------------------
// §2.4 the sub layer's own features
// ---------------------------------------------------------------------------
test('sub-bucket feature counts sum to their cell', () => {
  const e = E();
  const acc = { danglers: new Float64Array(e.cellKeys.length), nut: new Float64Array(e.cellKeys.length),
    mono: new Float64Array(e.cellKeys.length), tri: new Float64Array(e.cellKeys.length),
    hi9: new Float64Array(e.cellKeys.length), quads: new Float64Array(e.cellKeys.length) };
  e.subList.forEach((s, i) => {
    for (const f of Object.keys(acc)) acc[f][s.cell] += e.subFeat[f][i];
  });
  for (let u = 0; u < e.cellKeys.length; u++) {
    for (const f of Object.keys(acc)) {
      assert.ok(Math.abs(acc[f][u] - e.feat[f][u]) < 1e-9,
        `${e.cellKeys[u]} ${f}: sub sum ${acc[f][u]} vs cell ${e.feat[f][u]}`);
    }
  }
});

test('rho interpolates over whatever span the data covers', () => {
  const five = [1, 2, 3, 4, 5];
  assert.equal(P.rhoAt(five, 1), 1);
  assert.equal(P.rhoAt(five, 5), 5);
  assert.equal(P.rhoAt(five, 9), 5, 'a v1 model still clamps at N=5');
  const seven = [1, 2, 3, 4, 5, 6, 7];
  assert.equal(P.rhoAt(seven, 5), 5, 'the extension does not move any N<=5 reading');
  assert.equal(P.rhoAt(seven, 5.5), 5.5);
  assert.equal(P.rhoAt(seven, 7), 7);
  assert.equal(P.rhoAt(seven, 9), 7);
  assert.equal(P.rhoAt(seven, 0), 1);
  for (let n = 1; n <= 5; n += 0.25) assert.equal(P.rhoAt(seven.slice(0, 5), n), P.rhoAt(seven, n));
});

// ---------------------------------------------------------------------------
// the shipped file
// ---------------------------------------------------------------------------
test('the shipped cells carry eq to N=7, a cooler, and the lattice', { skip: !HAVE_V2 }, () => {
  const nV = M.constants.villainLattice.v.length;
  for (const k of Object.keys(M.cells)) {
    const c = M.cells[k];
    if (!c.combos) continue;
    assert.equal(c.eq.length, NMAX, k);
    assert.ok(c.cooler >= 0 && c.cooler <= 1, `${k} cooler ${c.cooler}`);
    assert.equal(+c.cooler.toFixed(3), c.cooler, `${k} cooler is not 3 dp`);
    assert.equal(c.vDelta.length, nV, k);
    for (const row of c.vDelta) {
      assert.equal(row.length, NMAX, k);
      for (const d of row) assert.equal(+d.toFixed(1), d, `${k} delta ${d} is not 1 dp`);
    }
  }
});

test('sub-bucket mplay is a real measurement, and rebuilds its cell', { skip: !HAVE_V2 }, () => {
  let worst = 0, worstAt = '', differs = 0, buckets = 0;
  for (const k of Object.keys(M.sub)) {
    const c = M.cells[k];
    const list = M.sub[k];
    let lg = 0;
    for (const s of list) {
      assert.equal(s.eq.length, NMAX, k);
      assert.equal(+s.mplay.toFixed(3), s.mplay);
      assert.ok(s.cooler >= 0 && s.cooler <= 1);
      lg += (s.combos / c.combos) * Math.log(s.mplay);
      buckets++;
      if (s.mplay !== c.mplay) differs++;
    }
    // M_play is a product of factors raised to combo shares, so the cell value is EXACTLY the
    // combo-weighted geometric mean of its sub-buckets'. Only 3-dp rounding separates them.
    const d = Math.abs(Math.exp(lg) - c.mplay);
    if (d > worst) { worst = d; worstAt = k; }
  }
  assert.ok(worst < 0.002, `worst reconstruction error ${worst.toFixed(5)} at ${worstAt}`);
  assert.ok(differs > buckets * 0.3,
    `${differs}/${buckets} sub-buckets differ from their cell — the layer would be pointless otherwise`);
});
