#!/usr/bin/env node
// generate-data.mjs — the RUNDOWN data pipeline.
//
//   node scripts/generate-data.mjs [--fast] [--workers=4] [--out=data/model.json]
//
// Stages
//   S0 enumerate    classify all 270,725 hands; cells, sub-buckets, features, examples, geometry
//   S1 villain prep enumerate the four face-up 3-bet component ranges
//   S2 cell equity  per non-empty cell: multi-N trials (one deal -> equity vs N = 1..5)
//   S3 vs-3-bet     per cell x component: heads-up trials vs a rejection-sampled villain
//   S4 sub-buckets  the depth layer, same kernel as S2
//   S5 derive+emit  rho, nu, mplay, adjMean, waveD, benchmarks, MODEL assembly
//   S6 verify       gates D1-D6, V1-V6, benchmarks, I1-I20, size budgets; stamps MODEL.gates
//
// Zero npm dependencies. All randomness is seeded and runs are reproducible, but there is no
// global seed knob: every Monte Carlo stream is keyed by its own stage and cell name (see
// mc.mjs, fnv1a(`hero|${stage}|${key}`)), which is what makes a single cell re-measurable in
// isolation. meta.seed below is a fixed build label recording that scheme, not an input — a
// --seed flag used to be accepted here and changed nothing but the label and the hash.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  enumerateAll, spanExamples, unpackHand, ROW_ORDER, COL_ORDER, ROW_META, COL_META,
  BAND_ORDER, BAND_META, subLabel,
} from './lib/taxonomy.mjs';
import { handStr, parseHand } from './lib/eval5.mjs';
import { buildComponentRanges, COMPONENTS } from './lib/villains.mjs';
import { startPool, stopPool, runJobs, equityFixed, equityVsFixed } from './lib/mc.mjs';
import { CONSTANTS } from './lib/policy.mjs';
import { verifyModel, formatReport } from './verify.mjs';

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
  ? { cell: 10000, vs3bet: 4000, sub: 4000 }
  : { cell: 100000, vs3bet: 40000, sub: 40000 };

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
log(`S0 done — ${NC} cells (${nonEmpty.length} non-empty, ${NC - nonEmpty.length} structurally empty), ` +
    `${E.subList.length} sub-buckets`);

// ---------------------------------------------------------------------------
// S1 — villain component ranges
// ---------------------------------------------------------------------------
log('S1 villain prep ...');
const ranges = buildComponentRanges();
log('S1 done — ' + COMPONENTS.map((c) => `${c} ${ranges[c].length}`).join(' · '));

// ---------------------------------------------------------------------------
// worker pool (shared by S2/S3/S4)
// ---------------------------------------------------------------------------
const pool = await startPool({
  workers: WORKERS,
  pools: { cell: E.byCell, sub: E.bySub },
  starts: { cell: E.cellStart, sub: E.subStart },
  ranges,
});

function progress(tag, trialsPer) {
  let last = 0;
  return (done, total) => {
    const now = Date.now();
    if (done !== total && now - last < 1500) return;
    last = now;
    const rate = Math.round((done * trialsPer) / ((now - t0) / 1000 || 1));
    process.stdout.write(`\r${stamp()} ${tag} ${done}/${total} units`.padEnd(46) + `\r`);
    if (done === total) process.stdout.write('\n');
  };
}

// ---------------------------------------------------------------------------
// S2 — cell equity
// ---------------------------------------------------------------------------
log(`S2 cell equity — ${nonEmpty.length} cells x ${TRIALS.cell} multi-trials ...`);
const s2Jobs = nonEmpty.map((unit, id) => ({
  id, pool: 'cell', unit, kind: 'multi', stage: 'cell', key: E.cellKeys[unit], trials: TRIALS.cell,
}));
const s2t = Date.now();
const s2 = await runJobs(pool, s2Jobs, progress('S2', TRIALS.cell));
log(`S2 done in ${((Date.now() - s2t) / 1000).toFixed(1)}s ` +
    `(${Math.round((nonEmpty.length * TRIALS.cell) / ((Date.now() - s2t) / 1000)).toLocaleString()} multi-trials/s)`);

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
const s3 = await runJobs(pool, s3Jobs, progress('S3', TRIALS.vs3bet));
log(`S3 done in ${((Date.now() - s3t) / 1000).toFixed(1)}s ` +
    `(${Math.round((s3Jobs.length * TRIALS.vs3bet) / ((Date.now() - s3t) / 1000)).toLocaleString()} HU trials/s)`);

// ---------------------------------------------------------------------------
// S4 — sub-buckets
// ---------------------------------------------------------------------------
log(`S4 sub-buckets — ${E.subList.length} buckets x ${TRIALS.sub} multi-trials ...`);
const s4Jobs = E.subList.map((s, id) => ({
  id, pool: 'sub', unit: id, kind: 'multi', stage: 'sub', key: `${E.cellKeys[s.cell]}#${s.key}`, trials: TRIALS.sub,
}));
const s4t = Date.now();
const s4 = await runJobs(pool, s4Jobs, progress('S4', TRIALS.sub));
log(`S4 done in ${((Date.now() - s4t) / 1000).toFixed(1)}s`);

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

const cells = {};
let nuBarNum = 0, nuBarDen = 0;
const cellNu = {};
const cellRho = {};

nonEmpty.forEach((unit, i) => {
  const key = E.cellKeys[unit];
  const combos = E.combos[unit];
  const eq = s2[i];
  const rho = eq.map((e, k) => (e * (k + 2)) / 100);
  const nuSlope = (rho[4] - rho[0]) / 4;
  const nu = Math.min(1, Math.max(0, (nuSlope + CONSTANTS.nuNorm[0]) / CONSTANTS.nuNorm[1]));
  cellNu[key] = nu;
  cellRho[key] = rho;
  nuBarNum += combos * nu;
  nuBarDen += combos;

  const f = E.feat;
  const dangMean = f.danglers[unit] / combos;
  const nutShare = f.nut[unit] / combos;
  const monoShare = f.mono[unit] / combos;
  const triShare = f.tri[unit] / combos;
  const hi9Share = f.hi9[unit] / combos;
  const quadShare = f.quads[unit] / combos;
  const row = key.split('|')[0];

  // M_play from combo-weighted cell means; each boolean factor is raised to its cell share
  const M = CONSTANTS.mplay;
  let mplay = Math.pow(M.dangler, dangMean);
  if (row === 'TRIPS_BIG' || row === 'TRIPS_SMALL') mplay *= M.trips;
  mplay *= Math.pow(M.quads, quadShare);
  if (row === 'A_BLOCKED') mplay *= M.aBlocked;
  mplay *= Math.pow(M.noCardAbove9, hi9Share);
  mplay *= Math.pow(M.monotone, monoShare);
  mplay *= Math.pow(M.threeFlush, triShare);
  mplay *= Math.pow(M.nutSuited, nutShare);

  const ex = spanExamples(E.exByAdj[unit], 6).map((pk) => handStr(unpackHand(pk).sort((a, b) => b - a)));
  const v3 = {};
  COMPONENTS.forEach((c, k) => { v3[c] = r1(s3[i * 4 + k]); });

  cells[key] = {
    combos,
    oneIn: Math.round(TOTAL / combos),
    eq: eq.map(r1),
    nu: r2(nu),
    danglers: r2(dangMean),
    nutSuited: r3(nutShare),
    dom: r2(f.dom[unit] / combos),
    mplay: r3(mplay),
    adjMean: r2(f.adj[unit] / combos),
    waveD: Math.round((1 - nu) * 90),
    eqVs3bet: v3,
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
log(`S5 pool mean nu (combo-weighted, measured) = ${nuBarMeasured.toFixed(4)} · model constant nuBar = ${CONSTANTS.nuBar}`);

// --- sub-buckets
const sub = {};
E.subList.forEach((s, i) => {
  const ck = E.cellKeys[s.cell];
  const eq = s4[i];
  const rho = eq.map((e, k) => (e * (k + 2)) / 100);
  const nuSlope = (rho[4] - rho[0]) / 4;
  const nu = Math.min(1, Math.max(0, (nuSlope + CONSTANTS.nuNorm[0]) / CONSTANTS.nuNorm[1]));
  const rec = E.subs[s.cell].get(s.key);
  (sub[ck] ||= []).push({
    key: s.key,
    label: subLabel(s.key),
    combos: s.combos,
    eq: eq.map(r1),
    nu: r2(nu),
    ex: rec.ex.map((pk) => handStr(unpackHand(pk).sort((a, b) => b - a))),
  });
});
for (const k of Object.keys(sub)) sub[k].sort((a, b) => b.combos - a.combos);

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
    trials: { cell: TRIALS.cell, vs3bet: TRIALS.vs3bet, sub: TRIALS.sub },
    se: {
      cell: r2(50 / Math.sqrt(TRIALS.cell)),
      vs3bet: r2(50 / Math.sqrt(TRIALS.vs3bet)),
      sub: r2(50 / Math.sqrt(TRIALS.sub)),
    },
    comboTotal: TOTAL,
    vpip: { min: 25, max: 90, default: 55, ref: 25 },
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
  sub,
  constants: { ...CONSTANTS, nuBarMeasured: r4(nuBarMeasured), mosaicTotal: MOSAIC_TOTAL },
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
log(`wrote ${OUT} — ${(bytes / 1024).toFixed(1)} KB minified (budget 120 KB)`);
log(`sha256 ${MODEL.meta.hash}`);
log(`total wall clock ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (!report.ok) {
  console.error('\nGATE FAILURES — data written for inspection, exit 1');
  process.exit(1);
}
