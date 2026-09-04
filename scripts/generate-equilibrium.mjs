// generate-equilibrium.mjs — WRITE THE P3 EQUILIBRIUM BASELINE.
//
// Two outputs, one solve (V3-PLAN §3.3, §5.3):
//
//   data/equilibrium.json    the FULL-only payload — full strategies at both depths, the payoff
//                            source and the label derived from it, the cap list, the solver
//                            constants, per-node frequencies, exploitability, wall time, the
//                            matrix's provenance and validation residuals, the HU coverage map.
//                            Gate D9 owns its byte budget; the `@inject:eq` region carries it into
//                            index-full.html.
//
//   model.baselineTiers      the SHARED-CORE block — per (pos, node, cell) baseline tiers,
//                            quantized at `baselineQuant`, ≤ 12 KB, D6's named sub-budget. Written
//                            SURGICALLY into data/model.json: this script reads the file, sets that
//                            one key, and writes it back. It does not regenerate anything, and
//                            adjudication 11 is the reason — `cells`, `rows`, `cols`, `bands`,
//                            `order` and `benchmarks` must stay byte-identical, `payoff-model`'s
//                            17-coefficient re-derivation reads the shipped model, and I22/I32 pin
//                            the tiers. `--check` re-proves that on every run.
//
// WHY THIS IS A GENERATOR AND NOT A GATE. The solve is deterministic but it is not free (~0.5 s for
// the four solves), and more importantly the artifact is what SHIPS: it is the thing the full page
// injects and the thing D9 measures, so it has to exist on disk before either can be checked.
// `verify.mjs` reads it; it does not make it. Same division as the checkdown matrix.
//
// THE DETERMINISM CLAIM, and its one stated exclusion. `--check` re-solves from the inputs the FILE
// records and byte-compares — `build.mjs --check`'s idiom — with `meta.buildMs` blanked on BOTH
// sides. Wall time is a property of the machine and not of the repository (the same sentence the
// registry's soft wall-time ceiling is written under), and §3.3's task list asks the payload to
// carry it, so it carries it and the determinism claim is made about everything else EXPLICITLY
// rather than by quietly dropping the field. `meta.contentHash` is computed with the same two
// fields blanked, so a reader can recompute it from the file.
//
// USAGE
//   node scripts/generate-equilibrium.mjs                 solve, validate, write both outputs
//   node scripts/generate-equilibrium.mjs --check         re-solve and byte-compare; exit 1 on drift
//   node scripts/generate-equilibrium.mjs --quant-table   print baselineQuant's anchor table
//   node scripts/generate-equilibrium.mjs --dry           solve and report, write nothing

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ARTIFACT, GENERATOR, BASELINE_QUANT, STACKS, PAYOFF_SEED, SPREAD_SEED,
  buildEquilibrium, buildBaselineTiers, quantizationTable, matrixShipping, serialize, contentHash,
  frequenciesFrom, coverageMap, NOT_HU_REASON,
  postPassFindings, postPassRecordProblems, anchorProblems, nestingReadiness, readingAt, quantProblems,
} from './lib/equilibrium.mjs';
import { EPSILON_BB, TWO_SEED_TOL_POT, PREFLOP_POT_BB, labelFor, CAPS, capListProblems, labelProblems } from './lib/cfr.mjs';
import { makeMatrixPayoff } from './lib/payoff.mjs';
import { solve, TIER_RANK } from './lib/policy.mjs';
import { shippedMatrices, ARTIFACT as MATRIX_ARTIFACT } from './lib/checkdown-matrix.mjs';
/* The residual band is computed by I33 clause (c)'s OWN code, imported rather than re-implemented.
   A payload that shipped its own copy of "the residual vs the shipped column" would be shipping a
   second opinion about what that residual is, and the two would drift. */
import { marginalResidual, eq0Column } from './gates/payoff.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const say = (s) => console.log(s);

/** D6's named sub-budget for the shared-core block (§5.3) — the number this script must land under */
const BASELINE_SUB_BUDGET = 12 * 1024;

/**
 * VALIDATE BEFORE WRITING — S-A's rule, applied to the equilibrium exactly as the matrix generator
 * applies it to the sampler.
 *
 * Everything here is a property the SHIPPED payload must have, checked against the payload rather
 * than against the solve that produced it: a payload whose frequencies disagree with its own
 * strategies, or whose label does not follow from its own `source`, is not a record of the solve
 * even if the solve was fine. That is the failure this catches, and it is the one that matters,
 * because the artifact is what every consumer downstream actually reads.
 */
function validate(payload, block, runs, derived) {
  const problems = [];

  // (1) the label follows from the shipped source datum — I35 clause (f)'s own detector
  for (const why of labelProblems(payload.payoff)) problems.push(`payload.payoff: ${why}`);
  for (const why of labelProblems(block)) problems.push(`baselineTiers: ${why}`);

  // (2) the cap list matches the tree the solver actually built — I35 clause (e)'s own detector
  for (const why of capListProblems(payload.caps.omitted, runs[100].tree)) problems.push(`payload.caps: ${why}`);
  for (const why of capListProblems(block.caps.omitted, runs[100].tree)) problems.push(`baselineTiers.caps: ${why}`);

  // (3) the strategies are strategies, and the frequencies are theirs
  for (const stack of STACKS) {
    const d = payload.depths[`T${stack}`];
    const K = payload.meta.cells;
    for (const [id, N] of [['n1', 2], ['n2', 3], ['n3', 3], ['n4', 3], ['n5', 2]]) {
      const arr = d.strategy[id];
      if (arr.length !== K * N) { problems.push(`T${stack} ${id}: ${arr.length} weights, expected ${K * N}`); continue; }
      for (let i = 0; i < K; i++) {
        let s = 0;
        for (let a = 0; a < N; a++) s += arr[i * N + a];
        if (Math.abs(s - 1) > 1e-12) problems.push(`T${stack} ${id} row ${i}: sums to ${s}, not 1`);
      }
    }
    const re = frequenciesFrom(d.strategy, runs[stack].q, K);
    for (const k of Object.keys(re)) {
      if (Math.abs(re[k] - d.frequencies[k]) > 1e-15) {
        problems.push(`T${stack} frequencies.${k} does not re-derive from the shipped strategy `
          + `(${d.frequencies[k]} vs ${re[k]})`);
      }
    }
    if (!(d.exploitabilityBB <= EPSILON_BB)) {
      problems.push(`T${stack}: exploitability ${d.exploitabilityBB.toExponential(3)} bb exceeds `
        + `epsilon ${EPSILON_BB.toExponential(2)} bb`);
    }
    if (!d.bracketOk) problems.push(`T${stack}: the best-response bracket fails`);
    if (!(d.twoSeedSpreadPot <= TWO_SEED_TOL_POT)) {
      problems.push(`T${stack}: the payoff-axis spread ${(100 * d.twoSeedSpreadPot).toFixed(4)}% of pot `
        + `exceeds the ${(100 * TWO_SEED_TOL_POT).toFixed(2)}% gate — I35 would fail on this payload`);
    }
  }

  // (4) synthetic payloads never ship (§5.3, D9's own clause)
  if (payload.meta.synthetic) problems.push('meta.synthetic is true — a stand-in payload must never be written');

  // (5) the coverage map is the page's whole vocabulary, and the uncovered rows carry the reason
  const cov = payload.coverage;
  if (cov.length !== 24) problems.push(`the coverage map has ${cov.length} rows, expected 24 (6 positions x 4 nodes)`);
  const covered = cov.filter((r) => r.covered);
  if (covered.length !== 3) problems.push(`${covered.length} (pos, node) pairs are covered, expected 3`);
  for (const r of cov) {
    if (!r.covered && r.reason !== NOT_HU_REASON) {
      problems.push(`coverage ${r.pos}|${r.node} is uncovered but names no reason`);
    }
  }

  // (6) the shared-core block fits its named sub-budget
  const bytes = Buffer.byteLength(JSON.stringify(block));
  if (bytes > BASELINE_SUB_BUDGET) {
    problems.push(`the baseline-tier block is ${bytes} B, over D6's ${BASELINE_SUB_BUDGET} B sub-budget`);
  }

  // (7) the quantized rows are strategies too
  for (const key of Object.keys(block.nodes)) {
    const n = block.nodes[key];
    const N = n.actions.length, steps = Math.round(1 / block.quant);
    for (let i = 0; i < block.order.length; i++) {
      let s = 0;
      for (let a = 0; a < N; a++) s += n.w[i * N + a];
      if (s !== steps) { problems.push(`baselineTiers ${key} row ${i}: quantized weights sum to ${s}, not ${steps}`); break; }
    }
  }

  /* (7b) baselineQuant's own table, checked against the strategies about to ship beside it. Same
     code as I36 clause (e) — the constant is FLAGGED rather than anchored (docs/refutations/P3.md),
     and the table that prices the alternatives is the bound that flag rests on, so a payload whose
     anchor misquotes it, whose step the table does not price, or whose block is a different solve's
     quantization is never written in the first place. */
  const bDepth = payload.depths[`T${block.stack}`];
  for (const why of quantProblems(block, bDepth && bDepth.strategy)) problems.push(`baselineQuant: ${why}`);

  /* (8) I36's anchors, checked BEFORE the artifact is written rather than only after. The gate is
     the authority; running its own detector here means a baseline that fails it is never shipped in
     the first place, which is the matrix generator's rule ("validate before use") applied to the
     solve. Same code both places — a second implementation would only prove the copies agree. */
  for (const why of anchorProblems(block)) problems.push(`I36 anchor: ${why}`);

  /* (9) the post-pass record describes the tiers it ships beside */
  for (const why of postPassRecordProblems(payload.postPasses, derived)) problems.push(`postPasses: ${why}`);
  return problems;
}

/** the matrix artifact's own meta, read off the file rather than reconstructed */
function matrixMeta() {
  const body = JSON.parse(readFileSync(resolve(ROOT, MATRIX_ARTIFACT), 'utf8'));
  return body.meta;
}

/**
 * Solve, assemble, validate. ONE function for `--write` and `--check`, for the reason the matrix
 * generator states about its own: a `--check` that called a different builder would be testing two
 * code paths against each other rather than testing that the construction is deterministic.
 */
function build(quant = BASELINE_QUANT) {
  const model = JSON.parse(readFileSync(MODEL_PATH, 'utf8'));
  const matrices = shippedMatrices();
  const payoff = makeMatrixPayoff(model, matrices);
  const { payload, runs, spreadRuns } = buildEquilibrium({ model, payoff, matrixMeta: matrixMeta(), quant });

  /* THE MATRIX'S VALIDATION, from I33 clause (c)'s own code. `marginalResidual` reads the payoff
     THROUGH THE ACCESSOR, so what is recorded is the residual of the source the solver actually
     consumed, not of a table beside it. */
  const primary = runs[100];
  const res = marginalResidual(
    (cells, pot, spr, opts) => payoff(cells, pot, spr, { ...opts, seed: PAYOFF_SEED }),
    matrices[0].keys, matrices[0].q, eq0Column(model),
  );
  payload.matrix.validation = {
    basis: 'the q-weighted marginal of the matrix, read through the accessor, against the shipped '
      + 'eq[0] equity column of the shipped model — I33 clause (c)\'s own computation (marginalResidual), in equity points. '
      + 'The residual is the SIGNED CARD-REMOVAL residual: the shipped number conditions villain on '
      + 'hero\'s cards being dead and the q-weighted sum does not.',
    mean: res.mean, p95: res.p95, max: res.max,
    aceFamilyMean: res.aceMean, aceFamilyCells: res.aceN,
    restMean: res.restMean, restCells: res.restN,
    conservation: res.conservation,
    undealablePairs: matrices[0].meta.impossiblePairs.length,
    undealableMass: matrices[0].meta.impossibleMass,
    saReference: { mean: -0.112, p95: 0.577, max: 0.827, boards: 400000 },
  };

  /* THE SHIPPING DECISION, taken on the measurement rather than on preference. The payload's size
     WITHOUT the matrix is measured first, then the embedded triangle is priced against it. */
  const withoutBytes = Buffer.byteLength(JSON.stringify(payload));
  payload.matrix.shipping = matrixShipping(matrices[0], withoutBytes);
  if (payload.matrix.shipping.ships === 'embedded') {
    const NC = matrices[0].NC, tri = [];
    for (let i = 0; i < NC; i++) for (let j = i; j < NC; j++) tri.push(Number(matrices[0].E[i * NC + j].toFixed(6)));
    payload.matrix.triangle = tri;
  }

  const block = buildBaselineTiers(primary, model, quant);

  /* THE POST-PASS FINDING (V3-PLAN §3.3, §14 item 4, gate I36). Recorded HERE, in the full-only
     payload, and derived from the tiers that ship in the SHARED CORE — two artifacts, one derived
     from the other, and I36 re-derives to check the record still describes them. It is not in
     `baselineTiers` itself because lite's 12 KB sub-budget is bought for the tiers, and the page
     could recompute this from them anyway; what a gate cannot recompute is whether the RECORD was
     regenerated with the solve. */
  const derived = postPassFindings(block, model.rows, model.cols, TIER_RANK);
  const vRef = model.meta.vpip.ref / 100;
  const modelSide = [];
  for (const h of payload.coverage.filter((r) => r.covered)) {
    const s = solve(model, { pos: h.pos, node: h.node, v: vRef, raiserPos: h.raiser });
    let moved = 0;
    for (const k of Object.keys(s.cells)) if (s.cells[k].preDisplay !== s.cells[k].action) moved++;
    modelSide.push({ pos: h.pos, node: h.node, cells: Object.keys(s.cells).length, postPassMoved: moved });
  }
  payload.postPasses = {
    ...derived,
    comparand: 'RAW model tiers (policy.mjs\'s `preDisplay`, the action BEFORE the two display '
      + 'post-passes), per V3-PLAN §3.3. The grid keeps showing the POST-PASSED tiers, which is '
      + 'what it has always shown and what the UI already names as enforcement; the vs-GTO '
      + 'comparison is computed against the raw ones, and the baseline\'s own violations below are '
      + 'shipped as a finding so a monotone-looking grid cannot imply a monotone equilibrium.',
    modelSide,
    modelSideNote: `measured at the model's reference VPIP ${model.meta.vpip.ref}, over the three `
      + '(pos, node) settings the baseline covers: how many cells the model\'s own post-passes move.',
  };
  payload.anchors = {
    plan: '§7.2 I36: AA_BIGPAIR x DS opens everywhere; TRASH x RB never opens UTG; emergent '
      + 'positional nesting UTG within HJ within CO within BTN.',
    readings: [
      readingAt(block, 'SB|rfi', 'AA_BIGPAIR|DS'),
      readingAt(block, 'BB|raise', 'AA_BIGPAIR|DS'),
      readingAt(block, 'SB|3bet', 'AA_BIGPAIR|DS'),
      readingAt(block, 'SB|rfi', 'TRASH|RB'),
      readingAt(block, 'BB|raise', 'TRASH|RB'),
    ],
    nesting: nestingReadiness(block),
  };
  return { model, payload, block, runs, spreadRuns, res, derived };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  }));
  const out = resolve(ROOT, args.out ?? ARTIFACT);
  const rel = relative(ROOT, out);

  if (!existsSync(resolve(ROOT, MATRIX_ARTIFACT))) {
    console.error(`FAIL  ${MATRIX_ARTIFACT} is not there — the baseline is solved on the SHIPPED `
      + 'pairwise matrix (V3-PLAN §3.3, decision 9). Make it with '
      + '`node scripts/generate-checkdown-matrix.mjs`.');
    process.exit(1);
  }

  // ---- --quant-table: baselineQuant's anchor, re-derived --------------------------------------
  if (args['quant-table']) {
    const { model, runs, block } = build();
    say(`baselineQuant anchor table — the payload bytes each step buys, D6 sub-budget `
      + `${BASELINE_SUB_BUDGET.toLocaleString()} B`);
    say(`  ${'quant'.padEnd(10)}${'data B'.padStart(10)}${'block B'.padStart(10)}`
      + `${'of budget'.padStart(12)}${'MIX cells'.padStart(12)}${'tiers moved'.padStart(13)}`);
    for (const r of quantizationTable(runs[100], model)) {
      say(`  ${String(r.quant).padEnd(10)}${r.dataBytes.toLocaleString().padStart(10)}`
        + `${r.blockBytes.toLocaleString().padStart(10)}`
        + `${`${(100 * r.blockBytes / BASELINE_SUB_BUDGET).toFixed(1)}%`.padStart(12)}`
        + `${String(r.mixedCells).padStart(12)}${String(r.movedVsPrev).padStart(13)}`);
    }
    say(`  shipped: baselineQuant = ${block.quant} (${Buffer.byteLength(JSON.stringify(block)).toLocaleString()} B)`);
    process.exit(0);
  }

  // ---- --check: re-solve, byte-compare -------------------------------------------------------
  if (args.check) {
    let disk;
    try { disk = readFileSync(out, 'utf8'); }
    catch (e) {
      console.error(`FAIL  ${rel} is not there (${e.code}) — run \`node ${relative(ROOT, SELF)}\` first`);
      process.exit(1);
    }
    const body = JSON.parse(disk);
    say(`checking ${rel} — re-solving ${STACKS.length} depths from the inputs it records`);
    const { payload, block } = build(body.baselineQuant ? body.baselineQuant.value : BASELINE_QUANT);
    if (payload.meta.generatorHash !== body.meta.generatorHash) {
      console.error(`FAIL  the SOURCE drifted: the artifact was written by generatorHash `
        + `${body.meta.generatorHash.slice(0, 16)} and this checkout hashes `
        + `${payload.meta.generatorHash.slice(0, 16)} — scripts/lib/equilibrium.mjs, `
        + `scripts/lib/cfr.mjs or ${relative(ROOT, SELF)} changed since it was generated. `
        + `Regenerate: node ${relative(ROOT, SELF)}`);
      process.exit(1);
    }
    /* buildMs blanked on BOTH sides — the one documented exclusion, stated in this file's header. */
    const fresh = JSON.parse(serialize(payload));
    const norm = (o) => JSON.stringify({ ...o, meta: { ...o.meta, buildMs: 0 } });
    const a = norm(body), b = norm(fresh);
    const modelOnDisk = JSON.parse(readFileSync(MODEL_PATH, 'utf8'));
    const blockDrift = JSON.stringify(modelOnDisk.baselineTiers) !== JSON.stringify(block);
    if (a === b && !blockDrift) {
      say(`OK    ${rel} re-solves byte-identically (${disk.length.toLocaleString()} B, contentHash `
        + `${body.meta.contentHash.slice(0, 16)}), and data/model.json's baselineTiers block `
        + `(${Buffer.byteLength(JSON.stringify(block)).toLocaleString()} B) is the block this solve produces`);
      process.exit(0);
    }
    if (blockDrift) console.error(`FAIL  data/model.json's baselineTiers block is not what this solve produces`);
    if (a !== b) {
      console.error(`FAIL  ${rel} is NOT what its own inputs re-solve to — ${b.length} B against `
        + `${a.length} B on disk (contentHash ${body.meta.contentHash.slice(0, 16)} -> `
        + `${fresh.meta.contentHash.slice(0, 16)})`);
    }
    process.exit(1);
  }

  // ---- write ----------------------------------------------------------------------------------
  say(`solving the HU baseline on the SHIPPED pairwise checkdown matrix`);
  say(`  depths ${STACKS.map((s) => `T${s}`).join(' + ')} · init seed 0 (canonical) · payoff seed `
    + `${PAYOFF_SEED} (spread against ${SPREAD_SEED})`);
  const t0 = Date.now();
  const { model, payload, block, runs, derived } = build();
  const wall = Date.now() - t0;

  const problems = validate(payload, block, runs, derived);
  for (const stack of STACKS) {
    const d = payload.depths[`T${stack}`];
    say(`  T${stack}: value ${d.valueBB.toFixed(5)} bb to SB · SB opens `
      + `${(100 * d.frequencies.sbOpen).toFixed(2)}% · BB folds `
      + `${(100 * d.frequencies.bbFoldVsOpen).toFixed(3)}% vs the 3bb open · exploitability `
      + `${d.exploitabilityBB.toExponential(2)} bb / eps ${EPSILON_BB.toExponential(0)} · payoff-axis `
      + `spread ${(100 * d.twoSeedSpreadPot).toFixed(4)}% of pot / gate ${(100 * TWO_SEED_TOL_POT).toFixed(2)}% · `
      + `argmaxes last flipped at ${d.lastFlip}/${d.iters}`);
  }
  const v = payload.matrix.validation;
  say(`  matrix: residual vs shipped eq[0] mean ${v.mean.toFixed(3)} / p95 ${v.p95.toFixed(3)} / max `
    + `${v.max.toFixed(3)} pt [S-A at 400k: ${v.saReference.mean} / ${v.saReference.p95} / ${v.saReference.max}] · `
    + `ace families ${v.aceFamilyMean.toFixed(3)} vs ${v.restMean.toFixed(3)} · conservation `
    + `${v.conservation.toFixed(4)} · ${v.undealablePairs} undealable (mass ${v.undealableMass.toExponential(2)})`);
  const sh = payload.matrix.shipping;
  say(`  the ${sh.pairs.toLocaleString()}-pair matrix SHIPS BY ${sh.ships.toUpperCase()}: a FAITHFUL `
    + `embedding (the artifact's integer counters, bit-identical on reconstruction) costs `
    + `${sh.embedBytes.toLocaleString()} B against a ${sh.withoutBytes.toLocaleString()} B payload — `
    + `ratio ${sh.ratio.toFixed(2)}x. Also measured: E at full double precision `
    + `${sh.options.doubles.bytes.toLocaleString()} B; E rounded to 6 dp `
    + `${sh.options.rounded6.bytes.toLocaleString()} B, which is cheaper AND NOT THE SAME MATRIX, so `
    + `it does not get to decide. ${sh.rule}`);
  say(`  coverage: ${payload.coverage.filter((r) => r.covered).length} of ${payload.coverage.length} `
    + `(pos, node) pairs solved; the rest carry the named reason "${NOT_HU_REASON}"`);
  const pp = payload.postPasses;
  say(`  I36 anchors: ${payload.anchors.readings.map((r) => `${r.cell} @${r.node} ${r.argmax} ${r.tier}`).join(' · ')}`);
  say(`  post-passes measured on the solved tiers (${pp.readings} readings): suit monotonicity `
    + `${pp.suitMonotonicity.count} violations${pp.suitMonotonicity.count ? ` [${pp.suitMonotonicity.violations.join('; ')}]` : ''} · `
    + `AA band ${pp.aaBand.count}. Model side, same settings: `
    + `${pp.modelSide.map((m) => `${m.pos}|${m.node} ${m.postPassMoved}/${m.cells}`).join(' · ')}`);
  say(`  nesting: ${payload.anchors.nesting.measurable ? 'MEASURABLE' : 'NOT MEASURABLE'} — ${payload.anchors.nesting.reason}`);

  if (problems.length) {
    for (const p of problems) say(`    VALIDATION FAILURE: ${p}`);
    console.error(`FAIL  ${problems.length} validation failure(s) — NOTHING WRITTEN. S-A's rule is `
      + 'validate before use, and an equilibrium that fails its own clauses is not a baseline.');
    process.exit(1);
  }
  if (args.dry) { say('--dry: nothing written'); process.exit(0); }

  const text = serialize(payload);
  writeFileSync(out, text);
  /* SURGICAL, and adjudication 11 is why: read the model, set ONE key, write it back. No
     regeneration, no re-rounding, no re-serialisation of anything else — `JSON.parse` /
     `JSON.stringify` round-trips every other value unchanged, and `--check` re-proves it. */
  const onDisk = JSON.parse(readFileSync(MODEL_PATH, 'utf8'));
  onDisk.baselineTiers = block;
  writeFileSync(MODEL_PATH, JSON.stringify(onDisk));

  const stamped = JSON.parse(text);
  say(`wrote ${rel} — ${text.length.toLocaleString()} B, ${(wall / 1000).toFixed(1)} s of solving on `
    + `this box (recorded as meta.buildMs ${stamped.meta.buildMs} ms; wall time is a property of the `
    + `machine, which is why --check blanks it on both sides)`);
  say(`  meta: contentHash ${stamped.meta.contentHash.slice(0, 16)} · generatorHash `
    + `${stamped.meta.generatorHash.slice(0, 16)} · model cells ${stamped.meta.model.cellsHash.slice(0, 16)} · `
    + `synthetic ${stamped.meta.synthetic}`);
  say(`wrote data/model.json's baselineTiers block — `
    + `${Buffer.byteLength(JSON.stringify(block)).toLocaleString()} B of D6's `
    + `${BASELINE_SUB_BUDGET.toLocaleString()} B sub-budget, baselineQuant ${block.quant}`);
  say(`  verify \`node ${relative(ROOT, SELF)} --check\` to prove both re-solve from their own inputs.`);
  say(`  NOTE: data/model.json's meta.hash is stale until \`node scripts/verify.mjs\` restamps it, `
    + `and both pages must then be rebuilt.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
