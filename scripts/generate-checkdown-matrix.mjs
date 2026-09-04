// generate-checkdown-matrix.mjs — WRITE THE SHIPPED PAIRWISE CHECKDOWN PAYOFF MATRIX.
//
// The construction is spike S-A's (`scripts/spikes/sa-matrix.mjs` on branch
// `worktree-wf_5a8a2571-726-2`) and lives in `scripts/lib/checkdown-matrix.mjs`, credited there.
// This file is only the ceremony around it: build both named samples, validate before writing, and
// own the determinism claim.
//
// WHY THE MATRIX IS A GENERATED ARTIFACT AND NOT A BUILD STEP (V3-PLAN §3.3's `Adjudicated (P3
// relaunch)` block, decision 13; §0.4 identity leg (b)). The shipped board count is 400,000 —
// the regime `solver.twoSeedTolPot` was ANCHORED at, not a band endpoint anybody preferred — and
// one matrix at that count costs ~20 s. Building the pair inside `verify.mjs` would put ~40 s on a
// wall whose soft ceiling is 41.9 s, so the pair enters the repository the way v3 lets a new
// mechanism enter: as an artifact, in the open, with its inputs written down beside it.
// `data/checkdown-matrix.json` carries the seed names, the board count, a hash of the source that
// built it and a hash of its own contents; verify READS it and pays milliseconds.
//
// THE DETERMINISM CLAIM IS THIS SCRIPT'S, NOT VERIFY'S. `node scripts/generate-checkdown-matrix.mjs
// --check` rebuilds both matrices in memory from the inputs the FILE records and byte-compares the
// re-serialisation against the bytes on disk — `build.mjs --check`'s idiom exactly. It is not run
// inside verify, because that would cost the 40 s the artifact exists to avoid; it joins the
// milestone's GREEN definition at the close-out, beside the three checks, smoke and browsers. What
// verify does run every time is I33's cheap `(artifact)` clause: the meta matches the code, the
// content hash recomputes, and the structural invariants hold.
//
// PARALLELISM, AND WHY IT CANNOT CHANGE THE ANSWER. The two seeds are built in two workers
// (mc.mjs's `new Worker(SELF, { workerData })` idiom), which halves the wall. Each worker builds
// ONE matrix from ONE seed name and posts back the integer counters; nothing is split within a
// matrix, so the arithmetic a worker does is bit-for-bit the arithmetic the serial path does, and
// `--check` goes through this same function rather than a second implementation. A `--check` that
// disagreed with `--write` because of scheduling would be exactly the hidden nondeterminism this
// script is here to rule out.
//
// USAGE
//   node scripts/generate-checkdown-matrix.mjs            write data/checkdown-matrix.json
//   node scripts/generate-checkdown-matrix.mjs --check    rebuild and byte-compare; exit 1 on drift
//   node scripts/generate-checkdown-matrix.mjs --boards=5000 --out=/tmp/x.json    experiments only

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

import {
  buildMatrix, materialise, serialize, marginals, conservation, undealablePairs,
  ARTIFACT, BOARDS, SEEDS, sourceHash,
} from './lib/checkdown-matrix.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), '..');

// -------------------------------------------------------------------------------------------
// the worker half: one seed, one matrix, integer counters back
// -------------------------------------------------------------------------------------------
if (!isMainThread && workerData && workerData.__cdmWorker) {
  const m = buildMatrix({ boards: workerData.boards, seed: workerData.seed });
  const msg = {
    seed: m.meta.seed,
    boards: m.meta.boards,
    buildMs: m.meta.buildMs,
    keys: m.keys,
    combos: Array.from(m.combos, Number),
    wins2: m.raw.wins2,
    cnt: m.raw.cnt,
    den: m.raw.den,
    cellLive: m.cellLive,
  };
  parentPort.postMessage(msg, [msg.wins2.buffer, msg.cnt.buffer, msg.den.buffer, msg.cellLive.buffer]);
}

/**
 * Build both named samples in parallel and materialise them on this thread.
 *
 * ONE function for both modes. `--check` calling a different builder than the writer would make the
 * byte-compare a test of two code paths agreeing rather than of the construction being
 * deterministic, which is the opposite of the claim.
 */
export function buildBoth(boards, seeds = SEEDS) {
  return Promise.all(seeds.map((seed) => new Promise((ok, no) => {
    const wk = new Worker(SELF, { workerData: { __cdmWorker: true, boards, seed } });
    wk.once('message', (msg) => { wk.terminate(); ok(msg); });
    wk.once('error', no);
    wk.once('exit', (code) => { if (code !== 0) no(new Error(`worker for ${seed} exited ${code}`)); });
  }))).then((raws) => raws.map((r) => {
    const m = materialise(r);
    m.meta.buildMs = r.buildMs;
    return m;
  }));
}

/**
 * VALIDATE BEFORE USE — S-A's hard rule for every payoff sampler, run here as well as in
 * `test/checkdown-matrix.test.mjs` so that a bad matrix is never written in the first place.
 *
 * The structural half is ASSERTED (antisymmetry to the bit, the diagonal at 0.5, conservation
 * within the accumulation bound, a non-empty undealable set whose members all ask the deck for
 * five or more aces); the residual band against the shipped column is REPORTED beside S-A's own
 * readings, never asserted — one spike's table cannot license a tolerance.
 */
function validate(m, model) {
  const problems = [];
  let worstAsym = 0, worstDiag = 0;
  for (let i = 0; i < m.NC; i++) {
    worstDiag = Math.max(worstDiag, Math.abs(m.E[i * m.NC + i] - 0.5));
    for (let j = 0; j < m.NC; j++) {
      worstAsym = Math.max(worstAsym, Math.abs(m.E[i * m.NC + j] + m.E[j * m.NC + i] - 1));
    }
  }
  if (worstAsym !== 0) problems.push(`antisymmetry breaks by ${worstAsym}`);
  if (worstDiag !== 0) problems.push(`the diagonal is off 0.5 by ${worstDiag}`);
  const cons = conservation(m);
  const bound = 100 * m.NC * m.NC * Number.EPSILON;
  if (!(Math.abs(cons - 50) <= bound)) problems.push(`conservation ${cons} against 50 +/- ${bound}`);
  const und = undealablePairs(m);
  if (und.length === 0) problems.push('no undealable pairs at all — the five-ace pairs must be there');

  const mg = marginals(m);
  const d = m.keys.map((k, i) => mg[i] - model.cells[k].eq[0]);
  const abs = d.map(Math.abs).sort((a, b) => a - b);
  const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ACE = ['BIGPAIR_ACE', 'ACE_JUNK', 'SMPAIR_ACE', 'ACE_RUN3'];
  const isAce = (k) => ACE.includes(k.split('|')[0]);
  const aceMean = avg(d.filter((_, i) => isAce(m.keys[i])));
  const restMean = avg(d.filter((_, i) => !isAce(m.keys[i])));
  if (!(aceMean < restMean)) {
    problems.push(`the ace families read ${aceMean.toFixed(3)} against ${restMean.toFixed(3)} for `
      + 'the rest — card removal predicts them LOW and this sampler does not show it');
  }
  return {
    problems,
    cons,
    undealable: und.length,
    mass: m.meta.impossibleMass,
    mean: avg(d),
    p95: abs[Math.floor(0.95 * (abs.length - 1))],
    max: abs[abs.length - 1],
    aceMean,
    restMean,
    minPairSamples: m.meta.minPairSamples,
    meanPairSamples: m.meta.meanPairSamples,
    minCellLive: m.meta.minCellLive,
  };
}

const say = (s) => console.log(s);

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  }));
  const out = resolve(ROOT, args.out ?? ARTIFACT);
  const rel = relative(ROOT, out);

  if (args.check) {
    // ---- --check: rebuild from the inputs the FILE records, byte-compare against the file -------
    let disk;
    try {
      disk = readFileSync(out, 'utf8');
    } catch (e) {
      console.error(`FAIL  ${rel} is not there (${e.code}) — run \`node ${relative(ROOT, SELF)}\` first`);
      process.exit(1);
    }
    const body = JSON.parse(disk);
    say(`checking ${rel} — rebuilding ${body.meta.seeds.length} matrices at `
      + `${body.meta.boards.toLocaleString()} boards from the inputs it records`);
    const live = sourceHash();
    if (live !== body.meta.generatorHash) {
      console.error(`FAIL  the SOURCE drifted: the artifact was written by generatorHash `
        + `${body.meta.generatorHash.slice(0, 16)} and this checkout hashes ${live.slice(0, 16)}. `
        + `scripts/lib/checkdown-matrix.mjs or ${relative(ROOT, SELF)} changed since it was `
        + `generated — regenerate it with \`node ${relative(ROOT, SELF)}\`.`);
      process.exit(1);
    }
    const t0 = Date.now();
    const ms = await buildBoth(body.meta.boards, body.meta.seeds);
    const text = serialize(ms);
    say(`  rebuilt in ${((Date.now() - t0) / 1000).toFixed(1)} s `
      + `(${ms.map((m) => `${m.meta.seed} ${(m.meta.buildMs / 1000).toFixed(1)} s`).join(', ')})`);
    if (text === disk) {
      say(`OK    ${rel} is byte-identical to a rebuild from its own recorded inputs `
        + `(${disk.length.toLocaleString()} B, contentHash ${body.meta.contentHash.slice(0, 16)})`);
      process.exit(0);
    }
    const fresh = JSON.parse(text);
    const drifted = [];
    if (fresh.meta.contentHash !== body.meta.contentHash) drifted.push('contentHash');
    for (let s = 0; s < fresh.samples.length; s++) {
      for (const f of ['wins2', 'cnt', 'den', 'cellLive']) {
        const a = body.samples[s][f], b = fresh.samples[s][f];
        const i = a.findIndex((v, k) => v !== b[k]);
        if (i >= 0) drifted.push(`samples[${s}].${f}[${i}] ${a[i]} -> ${b[i]}`);
      }
    }
    console.error(`FAIL  ${rel} is NOT what its own inputs rebuild to — ${text.length} B against `
      + `${disk.length} B on disk. Drift: ${drifted.slice(0, 6).join('; ') || 'in the framing, not the counters'}`);
    process.exit(1);
  }

  // ---- write ---------------------------------------------------------------------------------
  const boards = Number(args.boards ?? BOARDS);
  say(`building ${SEEDS.length} checkdown matrices at ${boards.toLocaleString()} boards, in parallel`);
  say(`  seeds: ${SEEDS.join(', ')}   (names, fixed before anything was solved on them)`);
  const t0 = Date.now();
  const ms = await buildBoth(boards);
  const wall = Date.now() - t0;

  const model = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
  let bad = 0;
  for (const m of ms) {
    const v = validate(m, model);
    bad += v.problems.length;
    say(`  ${m.meta.seed}: ${(m.meta.buildMs / 1000).toFixed(1)} s · conservation ${v.cons.toFixed(4)} · `
      + `${v.undealable} undealable (mass ${v.mass.toExponential(2)}) · residual vs shipped eq[0] `
      + `mean ${v.mean.toFixed(3)} / p95 ${v.p95.toFixed(3)} / max ${v.max.toFixed(3)} pt `
      + `[S-A at 400k: -0.112 / 0.577 / 0.827] · ace families ${v.aceMean.toFixed(3)} vs `
      + `${v.restMean.toFixed(3)} · samples per pair min ${v.minPairSamples.toLocaleString()} / `
      + `mean ${Math.round(v.meanPairSamples).toLocaleString()} · min cell-live `
      + `${v.minCellLive.toLocaleString()}`);
    for (const p of v.problems) say(`    VALIDATION FAILURE: ${p}`);
  }
  if (bad) {
    console.error(`FAIL  ${bad} validation failure(s) — NOTHING WRITTEN. S-A's rule is validate `
      + 'before use, and a sampler that fails its structural clauses is not a payoff.');
    process.exit(1);
  }

  const text = serialize(ms);
  writeFileSync(out, text);
  const body = JSON.parse(text);
  say(`wrote ${rel} — ${text.length.toLocaleString()} B, ${(wall / 1000).toFixed(1)} s wall on this `
    + `box (both seeds in parallel; wall time is a property of the machine, which is why it is `
    + `printed and not stored)`);
  say(`  meta: boards ${body.meta.boards.toLocaleString()} · generatorHash `
    + `${body.meta.generatorHash.slice(0, 16)} · contentHash ${body.meta.contentHash.slice(0, 16)}`);
  say(`  verify \`node ${relative(ROOT, SELF)} --check\` to prove it rebuilds byte-for-byte.`);
}

if (isMainThread) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
