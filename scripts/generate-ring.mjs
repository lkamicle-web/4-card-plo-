// generate-ring.mjs — WRITE THE SHIPPED NINE-SEAT RING (data/ring.json).
//
// The construction lives in `scripts/lib/ring.mjs`; this file is the ceremony around it: build both
// named samples, validate before writing, own the determinism claim, and report the two readings
// the plan asked for as numbers.
//
// WHY THE RING IS A GENERATED ARTIFACT AND NOT A MODEL BLOCK. V4-PLAN §0.4 and §2.4: at nine seats
// `N_eff` runs past seven and `data/model.json`'s measured curve stops there. Splicing two more
// columns into `cells[*].eq` would add ~7.0 KB to a `core` block with 4 KB of headroom AND move the
// frozen v1/v2 measurement layer, which §0.4 forbids outright. So the columns enter beside the
// model as their own artifact, in the P3 idiom the checkdown matrix and the equilibrium baseline
// established: named seeds, a meta that records what built it, a content hash, and a `--check` that
// rebuilds from the inputs the FILE records and refuses to write on any byte difference.
//
// THE DETERMINISM CLAIM IS THIS SCRIPT'S, NOT VERIFY'S — the checkdown matrix's rule, and for the
// same arithmetic. One ring costs about five minutes; running that inside `verify.mjs`, whose whole
// wall has a soft ceiling of 41.9 s, would put seven times the budget on the gate the artifact
// exists to make cheap. `--check` joins the milestone's GREEN definition at the close-out, beside
// the matrix and equilibrium checks. What verify runs every time is D12's cheap half in
// `scripts/gates/ring-artifact.mjs`: the meta matches the code, the content hash recomputes, the
// recorded per-cell agreement holds on all 123 cells, and the wall fits its budget.
//
// WHAT THE TWO SEEDS COST AND WHY NEITHER IS DROPPED. Rule R2 pre-registers 300 s and says that if
// the measured run exceeds it the executor HALVES THE LATTICE TRIALS FOR THE RING ONLY — se.latt
// doubles for the N = 8, 9 columns and is recorded in `meta.se` — and never drops a seed. A single
// seed would make D12(b) a comparison of a measurement with itself, which is the one economy that
// buys nothing.
//
// USAGE
//   node scripts/generate-ring.mjs                write data/ring.json
//   node scripts/generate-ring.mjs --check        rebuild and byte-compare; exit 1 on drift
//   node scripts/generate-ring.mjs --fast         experiments only; refuses to write the artifact
//   node scripts/generate-ring.mjs --workers=8 --out=/tmp/x.json

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { enumerateAll } from './lib/taxonomy.mjs';
import { startPool, stopPool, runJobs } from './lib/mc.mjs';
import { classTableCanonical, cutAt } from './lib/villain-range.mjs';
import { unpackOrder } from './lib/order-pack.mjs';
import {
  ARTIFACT, GENERATOR, SEEDS, RING_NMAX, WALL_BUDGET, OUTLIER_SIGMA,
  sourceHash, kernelHash, bandsFor, summarise, serialize, latticeOf, normalise,
} from './lib/ring.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const arg = (n, d) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};

const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's';
const say = (...a) => console.log(stamp(), ...a);
const r1 = (x) => +x.toFixed(1);

/**
 * Rebuild the VPIP-filtered villain pools from the SHIPPED ordering.
 *
 * NOT from a fresh `eq1` measurement, and the distinction is load-bearing. The ordering is a Monte
 * Carlo measurement over 16,432 suit-isomorphism classes that `generate-data.mjs` took 60,000 deals
 * per class to make and then FROZE into `model.order.packed` precisely because a second run would
 * order the classes near the cut slightly differently. Re-measuring it here would give the ring's
 * `vDelta` a different villain pool from the one `model.json`'s `vDelta` was measured against, and
 * the two would stop being the same quantity at different N. This is the browser's own path —
 * `sim-kernel.js`'s `buildRange`, which `test/sim-bundle.test.mjs` pins against the shipped lattice.
 */
function filteredPools(E, model, vPoints) {
  const ct = classTableCanonical(E.byCell);
  const order = unpackOrder(model.order.packed, model.order.n);
  const out = {};
  for (const v of vPoints) {
    const cut = cutAt(order, ct.size, E.byCell.length, v);
    const pool = new Uint32Array(cut.cum);
    let w = 0;
    for (let j = 0; j < E.byCell.length; j++) if (cut.keep[ct.cidOf[j]]) pool[w++] = E.byCell[j];
    out[v] = pool;
  }
  return out;
}

/**
 * Measure the whole ring: both seeds, both stages, nine villains per trial.
 *
 * ONE function for `--write` and `--check`. A `--check` that called a different builder would be
 * testing two code paths against each other rather than testing that the construction is
 * deterministic, which is the opposite of the claim — the checkdown matrix's note, verbatim in its
 * reasoning.
 *
 * @returns {{cell: object, latt: object, keys: string[], wall: number}} per seed name, the raw
 *   unrounded equity arrays: `cell[seed][key]` is eq[0..8]; `latt[seed][key][v]` is eq[0..8].
 */
async function measure(E, model, trials, vPoints, q, workers) {
  const nonEmpty = [];
  for (let i = 0; i < E.cellKeys.length; i++) if (E.combos[i] > 0) nonEmpty.push(i);
  const keys = nonEmpty.map((u) => E.cellKeys[u]);
  const filtered = filteredPools(E, model, vPoints);

  const pool = await startPool({
    workers,
    pools: { cell: E.byCell },
    starts: { cell: E.cellStart },
    ranges: {},
    filtered,
  });

  const cell = {}, latt = {};
  const wall0 = Date.now();
  try {
    for (const seed of SEEDS) {
      /* R-CELL: the random-villain baseline at nine villains. `stage: 'cell'` and `tag: seed` are
         what the worker turns into the stream names, so the ring's hero stream is
         `hero|<seed>|cell|<key>` — its own, and shared between this stage and the lattice below
         exactly as `generate-data.mjs` shares the shipped one. That sharing is what makes vDelta a
         PAIRED difference rather than two independent draws. */
      const cellJobs = nonEmpty.map((unit, id) => ({
        id, pool: 'cell', unit, kind: 'multi', stage: 'cell', key: E.cellKeys[unit],
        trials: trials.cell, nMax: RING_NMAX, tag: seed,
      }));
      const ct = Date.now();
      const cr = await runJobs(pool, cellJobs);
      say(`  ${seed} R-CELL — ${keys.length} cells x ${trials.cell.toLocaleString()} trials at `
        + `N = 1..${RING_NMAX} in ${((Date.now() - ct) / 1000).toFixed(1)}s`);
      cell[seed] = {};
      keys.forEach((k, i) => { cell[seed][k] = cr[i].eq; });

      // R-LATT: the same kernel with the field drawn from each VPIP-filtered pool.
      const lattJobs = [];
      for (let i = 0; i < nonEmpty.length; i++) {
        for (const v of vPoints) {
          lattJobs.push({
            id: lattJobs.length, pool: 'cell', unit: nonEmpty[i], kind: 'latt', stage: 'latt',
            key: E.cellKeys[nonEmpty[i]], v, q, trials: trials.latt, nMax: RING_NMAX, tag: seed,
          });
        }
      }
      const lt = Date.now();
      const lr = await runJobs(pool, lattJobs);
      let fb = 0;
      for (const r of lr) fb += r.fallbacks;
      say(`  ${seed} R-LATT — ${keys.length} cells x ${vPoints.length} VPIP x `
        + `${trials.latt.toLocaleString()} trials in ${((Date.now() - lt) / 1000).toFixed(1)}s `
        + `(${fb.toLocaleString()} blocked-pool fallbacks)`);
      latt[seed] = {};
      keys.forEach((k, i) => {
        latt[seed][k] = {};
        vPoints.forEach((v, vi) => { latt[seed][k][v] = lr[i * vPoints.length + vi].eq; });
      });
    }
  } finally {
    await stopPool(pool);
  }
  return { cell, latt, keys, wall: (Date.now() - wall0) / 1000 };
}

/**
 * Assemble the artifact from a measurement: the shipped columns, the agreement statistics, meta.
 *
 * `--check` must reproduce this byte for byte from the same measurement, so everything here is a
 * pure function of `m`, `model` and the recorded inputs. Wall time is measured but NOT stored (it
 * is a property of the machine); it is returned separately for the D12(e) report.
 */
function assemble(m, model, trials, se, vPoints, q, wallSec) {
  const [A, B] = SEEDS;
  const bands = bandsFor(se);
  const cells = {};
  const twoSeedRows = [], prefixRows = [];
  const agreeTwoSeed = [], agreePrefix = [];

  for (const key of m.keys) {
    const eqA = m.cell[A][key], eqB = m.cell[B][key];
    const vDelta = {};
    for (const v of vPoints) vDelta[v] = [r1(m.latt[A][key][v][7] - eqA[7]), r1(m.latt[A][key][v][8] - eqA[8])];
    cells[key] = { eq: [r1(eqA[7]), r1(eqA[8])], vDelta };

    /* D12(b) — the two seeds, on every number this artifact ships. The eq columns compare
       measurement to measurement (seDiff); the vDelta columns compare one difference to another
       (seDiffDelta), so each is scored against the standard error its own arithmetic implies. */
    let worstTS = 0;
    const push = (d, at, sd) => {
      twoSeedRows.push({ d, at });
      const s = Math.abs(d) / sd;
      if (s > worstTS) worstTS = s;
    };
    push(eqB[7] - eqA[7], `${key} N=8`, bands.seDiff);
    push(eqB[8] - eqA[8], `${key} N=9`, bands.seDiff);
    for (const v of vPoints) {
      for (const k of [7, 8]) {
        const dA = m.latt[A][key][v][k] - eqA[k];
        const dB = m.latt[B][key][v][k] - eqB[k];
        push(dB - dA, `${key} v${v} N=${k + 1}`, bands.seDiffDelta);
      }
    }
    agreeTwoSeed.push(+worstTS.toFixed(2));

    /* D12(c) — THE FALSIFIER. The N = 1..7 prefix falls out of the same deals for free and is not
       shipped; it is compared against the layer `data/model.json` already carries. Different seeds,
       different streams, the same quantity — so a disagreement here is a disagreement about the
       measurement itself, not about the ring. */
    const ship = model.cells[key].eq;
    let worstPre = 0;
    for (let k = 0; k < ship.length; k++) {
      const d = eqA[k] - ship[k];
      prefixRows.push({ d, at: `${key} N=${k + 1}` });
      const s = Math.abs(d) / bands.seDiff;
      if (s > worstPre) worstPre = s;
    }
    agreePrefix.push(+worstPre.toFixed(2));
  }

  const meta = {
    kind: 'rundown-v4 nine-seat ring — the N = 8 and N = 9 equity columns',
    plan: 'V4-PLAN §0.4, §2.4; gates D12, I52',
    generator: GENERATOR,
    generatorHash: sourceHash(),
    kernelHash: kernelHash(),
    contentHash: '',
    nMax: RING_NMAX,
    columns: [8, 9],
    seeds: [...SEEDS],
    trials: { cell: trials.cell, latt: trials.latt },
    se,
    v: [...vPoints],
    discipline: q,
    cells: m.keys.length,
    wallBudget: WALL_BUDGET,
    /* THE ONE DOCUMENTED EXCLUSION from `--check`'s byte-compare (scripts/lib/ring.mjs's
       `serialize`, on the equilibrium baseline's `meta.buildMs` precedent): a property of the
       machine, stored anyway because D12(e) is a gate on it and a gate cannot judge a log line. */
    wallSec: +wallSec.toFixed(1),
    model: {
      hash: (model.meta && model.meta.hash) || '',
      orderHash: (model.meta && model.meta.orderHash) || '',
      nMax: model.meta.nMax,
    },
    band: bands,
    twoSeed: summarise(twoSeedRows, bands.seDiff, se.cell),
    prefix: summarise(prefixRows, bands.seDiff, se.cell),
    agreeOrder: 'index-aligned with Object.keys(cells); values are worst |delta| per cell in units '
      + 'of meta.band.seDiff (eq columns) or meta.band.seDiffDelta (vDelta columns)',
  };
  return { meta, cells, agree: { twoSeed: agreeTwoSeed, prefix: agreePrefix } };
}

/**
 * VALIDATE BEFORE USE — the checkdown matrix's hard rule, run here as well as in the gate so a bad
 * ring is never written in the first place.
 *
 * ASSERTED: structure, the bias clause, the spread clause, the outlier line. REPORTED, never
 * asserted: the plan's pre-registered `2 · se.cell` reading, which `scripts/lib/ring.mjs` proves
 * unsatisfiable by arithmetic. A generator that refused to write on a band its own inputs make
 * impossible would simply never produce an artifact.
 */
function validate(body) {
  const problems = [];
  const b = body.meta.band;
  const keys = Object.keys(body.cells);
  if (keys.length !== body.meta.cells) problems.push(`meta.cells says ${body.meta.cells}, cells has ${keys.length}`);
  if (body.agree.twoSeed.length !== keys.length) problems.push('agree.twoSeed is not one number per cell');
  if (body.agree.prefix.length !== keys.length) problems.push('agree.prefix is not one number per cell');
  for (const key of keys) {
    const c = body.cells[key];
    if (!Array.isArray(c.eq) || c.eq.length !== 2) problems.push(`${key}: eq is not [N8, N9]`);
    for (const x of c.eq) if (!(typeof x === 'number' && isFinite(x) && x > 0 && x < 100)) problems.push(`${key}: eq out of range`);
    for (const v of body.meta.v) {
      const d = c.vDelta[v];
      if (!Array.isArray(d) || d.length !== 2) problems.push(`${key}: vDelta[${v}] is not [N8, N9]`);
    }
  }
  /* The equity curve must be monotonically DECREASING in the field size — more opponents is never
     worth more equity. It is the one structural fact about these columns that holds cell by cell
     with no tolerance at all, and it catches a column read off by one, which is the mistake a band
     of any width would sail straight past. */
  for (const key of keys) {
    const [e8, e9] = body.cells[key].eq;
    if (!(e9 <= e8)) problems.push(`${key}: eq[N=9] ${e9} exceeds eq[N=8] ${e8}`);
  }
  for (const [name, s, sd] of [['twoSeed', body.meta.twoSeed, b.seDiff], ['prefix', body.meta.prefix, b.seDiff]]) {
    if (s.biasSigma > 2) problems.push(`${name}: mean delta is ${s.mean} pt = ${s.biasSigma} sigma — a SYSTEMATIC difference, not noise`);
    if (s.spread > 2) problems.push(`${name}: RMS delta is ${s.spread}x the ${sd} the trial count predicts`);
    if (s.worstSigma > OUTLIER_SIGMA) problems.push(`${name}: worst |delta| ${s.worst} = ${s.worstSigma} sigma at ${s.worstAt}, past the ${OUTLIER_SIGMA} sigma outlier line`);
  }
  for (let i = 0; i < body.agree.twoSeed.length; i++) {
    if (body.agree.twoSeed[i] > OUTLIER_SIGMA) problems.push(`agree.twoSeed[${i}] = ${body.agree.twoSeed[i]} sigma`);
    if (body.agree.prefix[i] > OUTLIER_SIGMA) problems.push(`agree.prefix[${i}] = ${body.agree.prefix[i]} sigma`);
  }
  return problems;
}

function report(body, wall) {
  const m = body.meta;
  for (const [name, s] of [['two-seed (D12b)', m.twoSeed], ['prefix   (D12c)', m.prefix]]) {
    say(`  ${name}: n ${s.n} · bias ${s.mean} pt = ${s.biasSigma} sigma (${s.biasSigmaIndep} if the `
      + `cells were independent — they are not, see mc.mjs on common random numbers) · `
      + `spread ${s.spread}x · worst ${s.worst} pt = ${s.worstSigma} sigma at ${s.worstAt}`);
    say(`      the plan's pre-registered reading: worst ${s.worstSE} in units of se.cell `
      + `(band 2.0 — ${s.worstSE > 2 ? 'FALSIFIED' : 'held'}), ${s.over} of ${s.n} numbers past `
      + `${s.overBand} pt where Gaussian noise at ${m.band.seDiff} predicts `
      + `${Math.round(s.n * 2 * (1 - normalCdf(s.overBand / m.band.seDiff)))}`);
  }
  say(`  wall ${wall.toFixed(1)}s against the pre-registered ${m.wallBudget}s budget (R2) — `
    + `${wall <= m.wallBudget ? 'inside' : 'OVER: R2 says halve the lattice trials, never drop a seed'}`);
}

/** Φ(z), Abramowitz & Stegun 26.2.17 — used only to print how many breaches noise predicts. */
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

async function main() {
  const model = JSON.parse(readFileSync(MODEL_PATH, 'utf8'));
  const out = resolve(ROOT, arg('out', ARTIFACT));
  const rel = relative(ROOT, out);
  const workers = +arg('workers', 4);
  const { v: vPoints, q } = latticeOf(model);
  const FAST = flag('fast');
  const trials = FAST ? { cell: 5000, latt: 5000 } : { cell: model.meta.trials.cell, latt: model.meta.trials.latt };
  const se = FAST
    ? { cell: +(50 / Math.sqrt(trials.cell)).toFixed(2), latt: +(50 / Math.sqrt(trials.latt)).toFixed(2) }
    : { cell: model.meta.se.cell, latt: model.meta.se.latt };

  if (FAST && !arg('out', null)) {
    console.error('FAIL  --fast measures a different regime from the one meta records; it may not '
      + `write ${ARTIFACT}. Pass --out=/tmp/... for an experiment.`);
    process.exit(1);
  }

  say(`enumerating ${model.meta.comboTotal.toLocaleString()} hands ...`);
  const E = enumerateAll();

  if (flag('check')) {
    // ---- --check: rebuild from the inputs the FILE records, byte-compare against the file -------
    let disk;
    try {
      disk = readFileSync(out, 'utf8');
    } catch (e) {
      console.error(`FAIL  ${rel} is not there (${e.code}) — run \`node ${relative(ROOT, SELF)}\` first`);
      process.exit(1);
    }
    const body = JSON.parse(disk);
    say(`checking ${rel} — re-measuring ${body.meta.seeds.length} seeds x ${body.meta.cells} cells `
      + `at N = 1..${body.meta.nMax} from the inputs it records`);
    for (const [what, live, was] of [['generatorHash', sourceHash(), body.meta.generatorHash],
      ['kernelHash', kernelHash(), body.meta.kernelHash]]) {
      if (live !== was) {
        console.error(`FAIL  the SOURCE drifted: the ring was written by ${what} ${was.slice(0, 16)} `
          + `and this checkout hashes ${live.slice(0, 16)}. `
          + `${what === 'kernelHash' ? "mc.mjs's @worker-slice region" : `scripts/lib/ring.mjs or ${relative(ROOT, SELF)}`}`
          + ` changed since it was generated — regenerate with \`node ${relative(ROOT, SELF)}\`.`);
        process.exit(1);
      }
    }
    const m = await measure(E, model, body.meta.trials, body.meta.v, body.meta.discipline, workers);
    const text = serialize(assemble(m, model, body.meta.trials, body.meta.se, body.meta.v, body.meta.discipline, m.wall));
    /* `wallSec` blanked on BOTH sides — the one documented exclusion, stated in ring.mjs's header
       and printed here so a reader of the output knows the compare was not the whole file. */
    if (normalise(JSON.parse(text)) === normalise(body)) {
      say(`OK    ${rel} is byte-identical to a rebuild from its own recorded inputs, with meta.wallSec `
        + `blanked on both sides (${disk.length.toLocaleString()} B, contentHash `
        + `${body.meta.contentHash.slice(0, 16)}; recorded ${body.meta.wallSec}s, re-measured `
        + `${m.wall.toFixed(1)}s)`);
      process.exit(0);
    }
    const fresh = JSON.parse(text);
    const drifted = [];
    if (fresh.meta.contentHash !== body.meta.contentHash) drifted.push('contentHash');
    for (const key of Object.keys(body.cells)) {
      const a = body.cells[key], f = fresh.cells[key];
      if (!f) { drifted.push(`${key} is gone`); continue; }
      for (let k = 0; k < 2; k++) if (a.eq[k] !== f.eq[k]) drifted.push(`${key}.eq[${k}] ${a.eq[k]} -> ${f.eq[k]}`);
    }
    console.error(`FAIL  ${rel} is NOT what its own inputs rebuild to — ${text.length} B against `
      + `${disk.length} B on disk. Drift: ${drifted.slice(0, 6).join('; ') || 'in the framing, not the columns'}`);
    process.exit(1);
  }

  // ---- write -----------------------------------------------------------------------------------
  say(`measuring the ring — ${SEEDS.length} seeds x ${vPoints.length + 1} stages at `
    + `N = 1..${RING_NMAX}, ${trials.cell.toLocaleString()} trials, ${workers} workers`);
  say(`  seeds: ${SEEDS.join(', ')}   (names, fixed before anything was measured on them)`);
  const m = await measure(E, model, trials, vPoints, q, workers);
  const body = assemble(m, model, trials, se, vPoints, q, m.wall);
  report(body, m.wall);

  const problems = validate(body);
  if (problems.length) {
    console.error(`FAIL  ${problems.length} validation failure(s) — NOTHING WRITTEN. Validate before `
      + 'use: a ring that fails its structural or agreement clauses is not a measurement.');
    for (const p of problems.slice(0, 8)) console.error(`    ${p}`);
    process.exit(1);
  }

  const text = serialize(body);
  writeFileSync(out, text);
  const written = JSON.parse(text);
  say(`wrote ${rel} — ${text.length.toLocaleString()} B, ${m.wall.toFixed(1)}s wall on this box `
    + '(wall time is a property of the machine, which is why it is printed and not stored)');
  say(`  meta: nMax ${written.meta.nMax} · cells ${written.meta.cells} · generatorHash `
    + `${written.meta.generatorHash.slice(0, 16)} · kernelHash ${written.meta.kernelHash.slice(0, 16)} `
    + `· contentHash ${written.meta.contentHash.slice(0, 16)}`);
  say(`  verify \`node ${relative(ROOT, SELF)} --check\` to prove it re-measures byte-for-byte.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
