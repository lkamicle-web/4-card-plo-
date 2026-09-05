#!/usr/bin/env node
// generate-data.mjs — the RUNDOWN data pipeline.
//
//   node scripts/generate-data.mjs [--fast] [--workers=4] [--out=data/model.json]
//
// Stages
//   S0 enumerate    classify all 270,725 hands; cells, features, examples, geometry
//   S0b classes     collapse the deck into suit-isomorphism classes (the villain ordering's domain)
//   S1 villain prep enumerate the four face-up 3-bet component ranges
//   S1b villain ord eq1 per class over shared deals -> the frozen top-v% pools (V2-PLAN §2.3),
//                   and the class ORDER itself, packed for the browser's Simulate button (§4)
//   S2 cell equity  per non-empty cell: multi-N trials (one deal -> equity vs N = 1..7) + cooler
//   S2L lattice     the same, against VPIP-filtered villains at five lattice points
//   S3 vs-3-bet     per cell x component: heads-up trials vs a rejection-sampled villain
//   S5 derive+emit  rho, nu, mplay, cooler, lattice deltas, adjMean, waveD, benchmarks, assembly
//   S6 verify       62 gates: D1-D8 (no D3), V1-V6, benchmarks, I1-I22 (no I17) + I24/I25 (the v2 measurement
//                   shapes) + I23/I27/I28 (the depth axis, §3.1) + I26/I29/I30/I31 (the straddle
//                   and the rake, §3.2/§3.3) + I32 (the v2 tier surface, frozen before v3 —
//                   V3-PLAN §0.4) + I33 (the payoff contract) + I41-I44 (the v3 P1 axes:
//                   rake-depth, depth->width, villain profile-ON, 3-bet sizing) + D10/D11 (the dual
//                   build, read off the artifacts on disk — V3-PLAN §5.3) + I35 (the solver) +
//                   I36/D9 (P3's equilibrium baseline and full's byte budget) + I38/I37 (P4's
//                   pool-skill dial) + I34/I39/I40 (P4's absolute-EV cut and its quarantine) +
//                   I47 (P5's sub-cell top-N) + I46 (P5's primacy verdict; I45 stays RESERVED —
//                   the squeeze stage was cut, METHODOLOGY limitation 19), size budgets and
//                   the §2.5 payload ceiling; stamps MODEL.gates. The count is derived from
//                   EXPECTED_IDS in scripts/gates/index.mjs, which is the frozen report order.
//
// Zero npm dependencies — a property of THIS generator and of both shipped artifacts, which is the
// scope the promise now carries (METHODOLOGY §9.11; Playwright is dev-time only, for the two
// browser harnesses, and nothing in this pipeline reaches it). All randomness is seeded and runs are reproducible, but there is no
// global seed knob: every Monte Carlo stream is keyed by its own stage and cell name (see
// mc.mjs, fnv1a(`hero|${stage}|${key}`)), which is what makes a single cell re-measurable in
// isolation. meta.seed below is a fixed build label recording that scheme, not an input — a
// --seed flag used to be accepted here and changed nothing but the label and the hash.
//
// v2 stream discipline: every v1 stream consumes exactly the draws it consumed in v1, so every v1
// number reproduces bit for bit and gate I22 stays green. The new measurements draw from their own
// seeded streams (`stream6|…` for villains 6-7, `eq1|…`, `villain|latt|…`), never by interleaving
// into an existing one. The cooler rate adds no randomness at all.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  enumerateAll, spanExamples, unpackHand, ROW_ORDER, COL_ORDER, ROW_META, COL_META,
  BAND_ORDER, BAND_META,
} from './lib/taxonomy.mjs';
import { handStr, parseHand } from './lib/eval5.mjs';
import { buildComponentRanges, COMPONENTS } from './lib/villains.mjs';
import {
  startPool, stopPool, runJobs, equityFixed, equityVsFixed,
  NMAX, COOLER_MIN_CAT, COOLER_REF_N, VILLAIN_DISCIPLINE,
} from './lib/mc.mjs';
import { buildSuitClasses, buildRanges, canonicalRanks } from './lib/villain-range.mjs';
import { packOrder, orderHash, ORDER_BITS, permutationProblem } from './lib/order-pack.mjs';
import { CONSTANTS } from './lib/policy.mjs';
import { verifyModel, formatReport } from './verify.mjs';

/** the VPIP lattice the filtered-villain equities are measured at (V2-PLAN §2.3) */
const LATTICE_V = [25, 40, 55, 70, 90];
/** how many of those five actually ship, if the size budget bites (V2-PLAN §2.5) */
const LATTICE_SHIP = [25, 40, 55, 70, 90];
/** the eq1 measurement is split into a fixed number of blocks so --workers never moves a number */
const EQ1_BLOCKS = 30;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const FAST = argv.includes('--fast');
const WORKERS = +arg('workers', 4);
const OUT = resolve(ROOT, arg('out', 'data/model.json'));
const SEED = 'rundown-v1';   // build label, not an input — see the header note on stream seeding

const TRIALS = FAST
  ? { cell: 10000, vs3bet: 4000, latt: 10000, eq1Deals: 6000 }
  : { cell: 100000, vs3bet: 40000, latt: 100000, eq1Deals: 60000 };

const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's';
const log = (...a) => console.log(stamp(), ...a);

// ---------------------------------------------------------------------------
// S0 — enumerate
// ---------------------------------------------------------------------------
log('S0 enumerate ...');
const E = enumerateAll();
if (E.total !== 270725) throw new Error(`enumeration produced ${E.total}, expected 270725`);
const NC = E.cellKeys.length;
const nonEmpty = [];
for (let i = 0; i < NC; i++) if (E.combos[i] > 0) nonEmpty.push(i);
log(`S0 done — ${NC} cells (${nonEmpty.length} non-empty, ${NC - nonEmpty.length} structurally empty)`);

// ---------------------------------------------------------------------------
// S0b — suit-isomorphism classes (the domain the villain ordering is measured on)
// ---------------------------------------------------------------------------
log('S0b suit-isomorphism classes ...');
const cls = buildSuitClasses(E.byCell);
log(`S0b done — ${cls.n} classes (${(E.total / cls.n).toFixed(2)}x collapse), largest ${Math.max(...cls.size)} combos`);

// ---------------------------------------------------------------------------
// S1 — villain component ranges
// ---------------------------------------------------------------------------
log('S1 villain prep ...');
const ranges = buildComponentRanges();
log('S1 done — ' + COMPONENTS.map((c) => `${c} ${ranges[c].length}`).join(' · '));

function progress(tag) {
  let last = 0;
  return (done, total) => {
    const now = Date.now();
    if (done !== total && now - last < 1500) return;
    last = now;
    process.stdout.write(`\r${stamp()} ${tag} ${done}/${total} units`.padEnd(46) + `\r`);
    if (done === total) process.stdout.write('\n');
  };
}

// ---------------------------------------------------------------------------
// S1b — the frozen villain ordering (V2-PLAN §2.3)
//
// "A villain plays the top v%" needs an ordering. Using the model's own score S would make the
// model an input to its own measurement, so the ordering is eq1 — equity against ONE random
// opponent — measured here over every suit-isomorphism class of the deck and never touched again.
// Its own worker pool, because the ranges it produces have to reach the workers as workerData.
// ---------------------------------------------------------------------------
log(`S1b villain ordering — eq1 over ${cls.n} classes x ${TRIALS.eq1Deals} shared deals ...`);
const eqPool = await startPool({ workers: WORKERS, pools: {}, starts: {}, reps: cls.reps });
const eq1Jobs = [];
for (let b = 0; b < EQ1_BLOCKS; b++) {
  const per = Math.floor(TRIALS.eq1Deals / EQ1_BLOCKS) + (b < TRIALS.eq1Deals % EQ1_BLOCKS ? 1 : 0);
  eq1Jobs.push({ id: b, kind: 'eq1', block: b, deals: per });
}
const s1bt = Date.now();
const eq1Parts = await runJobs(eqPool, eq1Jobs, progress('S1b'), 1);
await stopPool(eqPool);
const eq1 = new Float64Array(cls.n);
{
  const win = new Float64Array(cls.n), cnt = new Float64Array(cls.n);
  for (const p of eq1Parts) for (let i = 0; i < cls.n; i++) { win[i] += p.win[i]; cnt[i] += p.cnt[i]; }
  let dealsPer = 0;
  for (let i = 0; i < cls.n; i++) { eq1[i] = (100 * win[i]) / cnt[i]; dealsPer += cnt[i]; }
  dealsPer /= cls.n;
  let num = 0, den = 0;
  for (let i = 0; i < cls.n; i++) { num += cls.size[i] * eq1[i]; den += cls.size[i]; }
  log(`S1b done in ${((Date.now() - s1bt) / 1000).toFixed(1)}s — ${Math.round(dealsPer)} deals/class ` +
      `(SE ${(50 / Math.sqrt(dealsPer)).toFixed(2)} pt), combo-weighted mean eq1 ${(num / den).toFixed(3)} (must be 50)`);
}
const LAT = buildRanges(eq1, cls, E.byCell, LATTICE_V);
log('S1b pools — ' + LATTICE_V.map((v) => `v${v} ${LAT.ranges[v].length} (${(LAT.realized[v] * 100).toFixed(2)}%, cut eq1 ${LAT.cutEq[v].toFixed(2)})`).join(' · '));

// --- the ordering, packed for the browser (V2-PLAN §4).
//
// The Simulate button re-measures at an OFF-LATTICE v, which means cutting a pool this generator
// never cut. It cannot re-derive the ordering: eq1 is a Monte Carlo measurement and a second run
// would order the classes near the cut slightly differently, so the browser would be simulating a
// different pool from the one the shipped lattice was measured against. The permutation therefore
// ships. See scripts/lib/order-pack.mjs for the format and for why the shipped index space is the
// canonical-ascending one rather than this file's enumeration order.
const cidOf = canonicalRanks(cls.reps);
const ORDER_CANON = Int32Array.from(LAT.order, (ci) => cidOf[ci]);
{
  const bad = permutationProblem(ORDER_CANON, cls.n);
  if (bad) throw new Error(`the villain order is not a permutation of 0..${cls.n - 1}: ${bad}`);
}
const ORDER_PACKED = packOrder(ORDER_CANON);
const ORDER_HASH = orderHash(ORDER_CANON);
log(`S1b order — ${cls.n} classes packed at ${ORDER_BITS} bits into ${ORDER_PACKED.length} base64 ` +
    `chars (${(ORDER_PACKED.length / 1024).toFixed(1)} KB), hash ${ORDER_HASH}`);

// ---------------------------------------------------------------------------
// worker pool (shared by S2/S2L/S3)
// ---------------------------------------------------------------------------
const pool = await startPool({
  workers: WORKERS,
  pools: { cell: E.byCell },
  starts: { cell: E.cellStart },
  ranges,
  filtered: LAT.ranges,
});

// ---------------------------------------------------------------------------
// S2 — cell equity
// ---------------------------------------------------------------------------
log(`S2 cell equity — ${nonEmpty.length} cells x ${TRIALS.cell} multi-trials (N=1..${NMAX}) ...`);
const s2Jobs = nonEmpty.map((unit, id) => ({
  id, pool: 'cell', unit, kind: 'multi', stage: 'cell', key: E.cellKeys[unit], trials: TRIALS.cell,
}));
const s2t = Date.now();
const s2 = await runJobs(pool, s2Jobs, progress('S2'));
log(`S2 done in ${((Date.now() - s2t) / 1000).toFixed(1)}s ` +
    `(${Math.round((nonEmpty.length * TRIALS.cell) / ((Date.now() - s2t) / 1000)).toLocaleString()} multi-trials/s)`);

// ---------------------------------------------------------------------------
// S2L — the villain-VPIP equity lattice
// ---------------------------------------------------------------------------
log(`S2L villain lattice — ${nonEmpty.length} cells x ${LATTICE_V.length} VPIP points x ${TRIALS.latt} trials ...`);
const s2lJobs = [];
for (let i = 0; i < nonEmpty.length; i++) {
  for (let vi = 0; vi < LATTICE_V.length; vi++) {
    s2lJobs.push({
      id: s2lJobs.length, pool: 'cell', unit: nonEmpty[i], kind: 'latt', stage: 'latt',
      key: E.cellKeys[nonEmpty[i]], v: LATTICE_V[vi], q: VILLAIN_DISCIPLINE, trials: TRIALS.latt,
    });
  }
}
const s2lt = Date.now();
const s2l = await runJobs(pool, s2lJobs, progress('S2L'));
{
  let fb = 0;
  for (const r of s2l) fb += r.fallbacks;
  const draws = s2lJobs.length * TRIALS.latt * NMAX;
  log(`S2L done in ${((Date.now() - s2lt) / 1000).toFixed(1)}s — ` +
      `${fb} of ${draws.toLocaleString()} villain draws (${(100 * fb / draws).toFixed(4)}%) fell back to a ` +
      `random hand because the filtered pool was fully blocked`);
}

// ---------------------------------------------------------------------------
// S3 — vs the face-up 3-bet components
// ---------------------------------------------------------------------------
log(`S3 vs-3-bet — ${nonEmpty.length} cells x 4 components x ${TRIALS.vs3bet} HU trials ...`);
const s3Jobs = [];
for (const unit of nonEmpty) {
  for (const comp of COMPONENTS) {
    s3Jobs.push({
      id: s3Jobs.length, pool: 'cell', unit, kind: 'vs3bet', stage: 'vs3bet',
      key: E.cellKeys[unit], comp, trials: TRIALS.vs3bet,
    });
  }
}
const s3t = Date.now();
const s3 = await runJobs(pool, s3Jobs, progress('S3'));
log(`S3 done in ${((Date.now() - s3t) / 1000).toFixed(1)}s ` +
    `(${Math.round((s3Jobs.length * TRIALS.vs3bet) / ((Date.now() - s3t) / 1000)).toLocaleString()} HU trials/s)`);

await stopPool(pool);

// ---------------------------------------------------------------------------
// S5 — derive and emit
// ---------------------------------------------------------------------------
log('S5 derive + emit ...');

const r1 = (x) => +x.toFixed(1);
const r2 = (x) => +x.toFixed(2);
const r3 = (x) => +x.toFixed(3);
const r4 = (x) => +x.toFixed(4);
const TOTAL = 270725;

// --- geometry: mosaic widths, largest-remainder to an exact 530px sum (I18)
const MOSAIC_TOTAL = 530;
const colCombos = {};
for (const col of COL_ORDER) {
  let n = 0;
  for (const row of ROW_ORDER) n += E.combos[E.cellIdx.get(row + '|' + col)];
  colCombos[col] = n;
}
const exactW = COL_ORDER.map((c) => (colCombos[c] / TOTAL) * MOSAIC_TOTAL);
const mosaicW = exactW.map((x) => Math.floor(x));
let slack = MOSAIC_TOTAL - mosaicW.reduce((a, b) => a + b, 0);
const rema = exactW.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
for (let i = 0; i < slack; i++) mosaicW[rema[i % rema.length][1]]++;

// --- empty-cell causes, derived from the structural rule that makes them impossible
// RUN0_HIGH is aceless and RUN0_LOW is not: the wheel hand A432 files as LOW (taxonomy.mjs
// topInGapOrientation), which leaves HIGH as JT98/QJT9 only and gives LOW its first SS-NUT cell.
const ACELESS_ROWS = new Set(['DBLPAIR_BIG', 'DBLPAIR_MIXED', 'DBLPAIR_SMALL', 'BIGPAIR_JUNK',
  'SMPAIR_JUNK', 'RUN0_HIGH', 'RUN3_DANGLER', 'TRASH']);
const TRIPS_ROWS = new Set(['A_BLOCKED', 'TRIPS_BIG', 'TRIPS_SMALL']);
function why0(row, col) {
  if (col === 'SSA') {
    if (ACELESS_ROWS.has(row)) return 'impossible — this class never holds an ace, and SS-NUT requires an ace-topped suited pair';
    return 'impossible — an ace-topped suited pair routes this hand out of this class';
  }
  if (col === 'SS') return 'impossible — any suited pair here is ace-topped, which routes the hand to SS-NUT';
  if (col === 'DS') return 'impossible — three cards of one rank sit in three different suits, so the fourth card can only make a 2-1-1 pattern';
  if (col === 'FLAW') {
    if (TRIPS_ROWS.has(row)) return 'impossible — three cards of one rank occupy three suits, so no suit can hold three of these cards';
    return 'impossible — with two paired ranks no suit can hold three of these cards';
  }
  return 'impossible — no hand has this rank structure with this suit topology';
}

const NOTABLE = {
  'AA_BIGPAIR|DS': 'the best hand in the game',
  'A_BLOCKED|RB': 'quad aces — barely better than a coinflip',
  'DBLPAIR_SMALL|RB': '2233 is worse than K952',
  'RUN0_LOW|DS': 'the AA killer',
  'SMPAIR_JUNK|SS': 'the biggest leak in the pool',
};

/**
 * M_play from combo-weighted feature means; each boolean factor is raised to its share of the cell.
 * The row-level factors (trips, ace-blocked) are properties of the 29-row cascade, so they are read
 * off the cell's row rather than from any per-hand feature.
 */
function mplayOf(row, share) {
  const M = CONSTANTS.mplay;
  let m = Math.pow(M.dangler, share.dangMean);
  if (row === 'TRIPS_BIG' || row === 'TRIPS_SMALL') m *= M.trips;
  m *= Math.pow(M.quads, share.quad);
  if (row === 'A_BLOCKED') m *= M.aBlocked;
  m *= Math.pow(M.noCardAbove9, share.hi9);
  m *= Math.pow(M.monotone, share.mono);
  m *= Math.pow(M.threeFlush, share.tri);
  m *= Math.pow(M.nutSuited, share.nut);
  return m;
}

/** P(hero loses the pot outright | hero reached a set or better) — V2-PLAN §2.1 */
const coolerOf = (r) => (r.coolDen ? r.coolNum / r.coolDen : 0);

const cells = {};
let nuBarNum = 0, nuBarDen = 0, coolBarNum = 0;
const cellNu = {};
const cellRho = {};

nonEmpty.forEach((unit, i) => {
  const key = E.cellKeys[unit];
  const combos = E.combos[unit];
  const eq = s2[i].eq;
  const rho = eq.map((e, k) => (e * (k + 2)) / 100);
  // nu stays a [1,5] slope by calibration history — every nu-anchored constant in the model was
  // fitted against it, and redefining it onto the new [1,7] span would move all of them silently.
  // N = 6, 7 exist for interpolation (V2-PLAN §2.2).
  const nuSlope = (rho[4] - rho[0]) / 4;
  const nu = Math.min(1, Math.max(0, (nuSlope + CONSTANTS.nuNorm[0]) / CONSTANTS.nuNorm[1]));
  const cooler = coolerOf(s2[i]);
  cellNu[key] = nu;
  cellRho[key] = rho;
  nuBarNum += combos * nu;
  nuBarDen += combos;
  coolBarNum += combos * cooler;

  const f = E.feat;
  const dangMean = f.danglers[unit] / combos;
  const row = key.split('|')[0];
  const mplay = mplayOf(row, {
    dangMean,
    nut: f.nut[unit] / combos,
    mono: f.mono[unit] / combos,
    tri: f.tri[unit] / combos,
    hi9: f.hi9[unit] / combos,
    quad: f.quads[unit] / combos,
  });

  const ex = spanExamples(E.exByAdj[unit], 6).map((pk) => handStr(unpackHand(pk).sort((a, b) => b - a)));
  const v3 = {};
  COMPONENTS.forEach((c, k) => { v3[c] = r1(s3[i * 4 + k]); });

  // the villain lattice, shipped as 1-dp DELTAS from this cell's random-villain baseline. Deltas
  // are taken against the unrounded baseline, so they never carry the baseline's rounding error.
  const vDelta = LATTICE_SHIP.map((v) => {
    const j = i * LATTICE_V.length + LATTICE_V.indexOf(v);
    return s2l[j].eq.map((x, k) => r1(x - eq[k]));
  });

  cells[key] = {
    combos,
    oneIn: Math.round(TOTAL / combos),
    eq: eq.map(r1),
    nu: r2(nu),
    cooler: r3(cooler),
    danglers: r2(dangMean),
    nutSuited: r3(f.nut[unit] / combos),
    dom: r2(f.dom[unit] / combos),
    mplay: r3(mplay),
    adjMean: r2(f.adj[unit] / combos),
    waveD: Math.round((1 - nu) * 90),
    eqVs3bet: v3,
    vDelta,
    ex,
  };
  if (NOTABLE[key]) cells[key].notable = NOTABLE[key];
});

for (let i = 0; i < NC; i++) {
  if (E.combos[i] > 0) continue;
  const [row, col] = E.cellKeys[i].split('|');
  cells[E.cellKeys[i]] = { combos: 0, why0: why0(row, col) };
}

const nuBarMeasured = nuBarNum / nuBarDen;
const coolerBarMeasured = coolBarNum / nuBarDen;
log(`S5 pool mean nu (combo-weighted, measured) = ${nuBarMeasured.toFixed(4)} · model constant nuBar = ${CONSTANTS.nuBar}`);
log(`S5 pool mean cooler (combo-weighted, measured) = ${coolerBarMeasured.toFixed(4)}`);

// --- benchmarks (measured here, asserted by verify)
log('S5 benchmarks ...');
const BT = FAST ? 12000 : 60000;
const HU_BENCH = [
  ['AsAhJsTh', 'AAJTds', 71.08], ['AsAhKsKh', 'AAKKds', 70.82], ['KsKhQsQh', 'KKQQds', 68.52],
  ['AsAhKsKd', 'AAKKss', 67.90], ['AsAhKdKc', 'AAKKr', 65.00], ['AsAh7d2c', 'AA72r', 61.64],
  ['AsKhQsJh', 'AKQJds', 61.57], ['KsQhJsTh', 'KQJTds', 59.43], ['KsKh7d2c', 'KK72r', 56.62],
  ['JsTh9s8h', 'JT98ds', 55.26], ['Ts9h8s7h', 'T987ds', 52.70], ['AsAhAdAc', 'AAAA', 51.57],
  ['JsTh9d8c', 'JT98r', 48.72], ['Ks9h5d2c', 'K952r', 43.41], ['5s4h3s2h', '5432ds', 40.95],
  ['2s2h3d3c', '2233r', 38.48], ['2s2h2d2c', 'quad deuces', 9.28],
];
const MW_BENCH = [
  ['AsAhKsKh', 'AAKKds', [70.58, 54.21, 45.17, 39.50, 35.06]],
  ['AsAhKsQh', 'AAKQds', [69.09, 51.41, 41.64, 35.02, 30.80]],
  ['KsQhJsTh', 'KQJTds', [59.18, 45.34, 36.19, 30.65, 27.05]],
  ['AsKsQhJh', 'AKQJ-ds', [60.90, 45.74, 36.60, 31.26, 26.84]],
  ['JsTh9s8h', 'JT98ds', [55.61, 42.02, 32.87, 28.10, 23.89]],
  ['Ts9h8s7h', 'T987ds', [52.59, 39.08, 30.29, 25.46, 21.66]],
  ['AsAh7d2c', 'AA72r', [61.30, 40.73, 29.03, 22.00, 17.88]],
  ['5s4h3s2h', '5432ds', [40.49, 28.72, 22.04, 18.55, 14.96]],
  ['KsKh7d2c', 'KK72r', [56.59, 36.04, 24.98, 18.90, 15.03]],
  ['Ks9h5d2c', 'K952r', [42.59, 25.56, 17.62, 13.02, 10.18]],
];
const V3_BENCH = [
  ['5s4h3s2h', 'AsAhKdQc', '5432ds vs AAKQ', 47.58],
  ['2s3h4s5h', 'AsAhKdQc', '2345ds vs AAKQ', 47.50],
  ['Ts9h8s7h', 'AsAhKdQc', 'T987ds vs AAKQ', 46.94],
  ['9s8h7s6h', 'AsAhKdQc', '9876ds vs AAKQ', 46.87],
  ['JsTh9s8h', 'AsAhKdQc', 'JT98ds vs AAKQ', 46.44],
  ['KcKdQcQd', 'AsAhKdQc', 'KKQQds vs AAKQ', 42.62],
  ['KcQdJcTd', 'AsAhKdQc', 'KQJTds vs AAKQ', 37.51],
  ['KcKs9c8s', 'AsAhKdQc', 'KK98ds vs AAKQ', 34.16],
  ['AdKcQsJh', 'AsAhKdQc', 'AKQJ vs AAKQ', 17.97],
  ['JsTh9s8h', 'AsAh2d3c', 'JT98ds vs weak AA', 51.59],
];

const benchmarks = {
  trials: BT,
  hu: HU_BENCH.map(([h, label, expected]) => ({
    hand: h, label, expected, measured: r2(equityFixed(parseHand(h), BT, `bench|hu|${h}`, 1)),
  })),
  multiway: MW_BENCH.map(([h, label, expected]) => ({
    hand: h, label, expected,
    measured: [1, 2, 3, 4, 5].map((n) => r2(equityFixed(parseHand(h), BT, `bench|mw|${h}|${n}`, n))),
  })),
  vs3bet: V3_BENCH.map(([h, v, label, expected]) => ({
    hand: h, villain: v, label, expected, measured: r2(equityVsFixed(parseHand(h), parseHand(v), BT, `bench|v3|${h}|${v}`)),
  })),
  folklore: [
    { claim: 'AAKKds is the best PLO hand, about 67% vs random', verdict: 'disputed — measured 70.8%' },
    { claim: 'double-suited is worth +3 to +4 points over rainbow', verdict: 'understated — measured +5.7 on JT98 and +5.8 on AAKK' },
    { claim: 'AAKKds is only about 52% vs AAJTds', verdict: 'consistent — the two are statistically tied vs random (70.8 / 71.1)' },
    { claim: 'the nut-flush premium is large preflop', verdict: 'false in raw equity — AJT9 ace-suited 56.3 vs J-suited 55.8, +0.5 pt; the premium is in realization' },
  ],
};

// --- assemble
const MODEL = {
  meta: {
    version: '1.0.0',
    generated: new Date().toISOString().slice(0, 10),
    seed: SEED,
    trials: {
      cell: TRIALS.cell, vs3bet: TRIALS.vs3bet,
      latt: TRIALS.latt, eq1Deals: TRIALS.eq1Deals,
    },
    se: {
      cell: r2(50 / Math.sqrt(TRIALS.cell)),
      vs3bet: r2(50 / Math.sqrt(TRIALS.vs3bet)),
      latt: r2(50 / Math.sqrt(TRIALS.latt)),
    },
    comboTotal: TOTAL,
    nMax: NMAX,
    vpip: { min: 25, max: 90, default: 55, ref: 25 },
    // integrity check on the shipped villain ordering below — gate D8 recomputes it
    orderHash: ORDER_HASH,
    hash: '',
    fast: FAST,
  },
  rows: ROW_ORDER.map((key, i) => ({
    key, label: ROW_META[key].label, short: ROW_META[key].short, band: ROW_META[key].band, order: i + 1,
    combos: COL_ORDER.reduce((n, c) => n + E.combos[E.cellIdx.get(key + '|' + c)], 0),
  })),
  cols: COL_ORDER.map((key, i) => ({
    key, label: COL_META[key].label, header: COL_META[key].header,
    combos: colCombos[key], share: r4(colCombos[key] / TOTAL), mosaicW: mosaicW[i],
  })),
  bands: BAND_ORDER.map((key) => {
    const rows = BAND_META[key].rows;
    let n = 0;
    for (let i = rows[0] - 1; i < rows[1]; i++) {
      for (const c of COL_ORDER) n += E.combos[E.cellIdx.get(ROW_ORDER[i] + '|' + c)];
    }
    return { key, label: BAND_META[key].label, rows, combos: n, share: r4(n / TOTAL) };
  }),
  cells,
  // The frozen villain ordering, so the page can cut a pool at a v this generator never measured
  // (V2-PLAN §4). Format and index space: scripts/lib/order-pack.mjs.
  order: {
    n: cls.n,
    bits: ORDER_BITS,
    by: 'eq1 descending, ties by ascending class index',
    domain: 'suit-isomorphism classes, indexed by ascending canonical packed representative',
    packed: ORDER_PACKED,
  },
  constants: {
    ...CONSTANTS,
    nuBarMeasured: r4(nuBarMeasured),
    mosaicTotal: MOSAIC_TOTAL,
    // --- v2 measurement constants. These are properties of the MEASUREMENT, not of the scoring
    // opinion above them, but they live in the same object because the Method view renders this
    // object and nothing else: a constant the page cannot show is a constant nobody can audit.
    nMax: NMAX,
    coolerBarMeasured: r4(coolerBarMeasured),
    cooler: {
      // "a strong made hand at showdown" = eval5 category >= 3, i.e. a set or better
      minCategory: COOLER_MIN_CAT,
      minCategoryLabel: 'set or better (set, straight, flush, full house, quads, straight flush)',
      // the field size the loss is judged at: three opponents, a four-handed pot
      refN: COOLER_REF_N,
      chopIsNotALoss: true,
    },
    villainLattice: {
      v: LATTICE_SHIP,
      measuredAt: LATTICE_V,
      // the ordering is frozen to eq1 — equity vs one random opponent — never the model's score S
      orderBy: 'eq1',
      orderDomain: 'suit-isomorphism classes',
      classes: cls.n,
      eq1Deals: TRIALS.eq1Deals,
      // each villain plays a range hand with probability q, a random hand with probability 1 - q
      discipline: VILLAIN_DISCIPLINE,
      shipsAs: 'eq deltas from the random-villain baseline, 1 dp, one row per v, one column per N',
      realized: Object.fromEntries(LATTICE_SHIP.map((v) => [v, r4(LAT.realized[v])])),
      cutEq1: Object.fromEntries(LATTICE_SHIP.map((v) => [v, r2(LAT.cutEq[v])])),
    },
  },
  benchmarks,
  gates: {},
};

// ---------------------------------------------------------------------------
// S6 — verify, stamp, write
// ---------------------------------------------------------------------------
log('S6 verify ...');
const report = verifyModel(MODEL, { fast: FAST });
for (const g of report.gates) MODEL.gates[g.id] = g.pass ? 'pass' : 'FAIL';
MODEL.meta.hash = createHash('sha256').update(JSON.stringify({ ...MODEL, meta: { ...MODEL.meta, hash: '' } })).digest('hex');

mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(MODEL);
writeFileSync(OUT, json);

console.log(formatReport(report));
const bytes = Buffer.byteLength(json);
log(`wrote ${OUT} — ${(bytes / 1024).toFixed(1)} KB minified, ` +
    `${(Buffer.byteLength(JSON.stringify(MODEL, null, 1)) / 1024).toFixed(1)} KB pretty-printed ` +
    `(gate D6 holds the minified budget; V2-PLAN §2.5 quotes the pretty-printed one)`);
log(`sha256 ${MODEL.meta.hash}`);
log(`total wall clock ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (!report.ok) {
  console.error('\nGATE FAILURES — data written for inspection, exit 1');
  process.exit(1);
}
