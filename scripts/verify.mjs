#!/usr/bin/env node
// verify.mjs — the gate runner.
//
//   node scripts/verify.mjs [data/model.json] [--no-write]
//
// THE GATES THEMSELVES LIVE IN scripts/gates/. This file used to be 129 KB of gate bodies in one
// linear function, which made it a write-contention point the moment more than one lane wanted to
// add a gate; V3-PLAN §0.1 called for the split and this is it. What is left here is the runner:
// hydrate the policy layer, walk scripts/gates/index.mjs in order, time every section, format the
// report, restamp the model. See scripts/gates/index.mjs for the registry and the family contract.
//
//   D1-D8  data gates      gates/data.mjs          partition, empty cells, schema, geometry, size
//   (no D3)                                        budgets, the §2.5 payload ceiling, villain order
//   V1-V6  engine gates    gates/engine.mjs        zero-sum, conservation, seed independence,
//   B      benchmarks                              category counts, the Omaha rule, the calibration
//   I5 I4 I20                                      table, cross-engine agreement
//   I1-I3  structure       gates/structure.mjs     suits, danglers, rho in N
//   I6-I16 model gates     gates/policy-sweep.mjs  the sanity invariants over v in {25,40,55,70,90}
//   I19 I21                                        x 6 pos x 4 nodes, one shared sweep
//   (no I17)
//   I22    regression      gates/fixtures.mjs      v1 tier reproduction
//   I32    regression                              v2 reproduction over the §0.4 environment surface
//   I33    payoff freeze   gates/payoff.mjs        the V3-PLAN §2 interface contract
//   I24-25 v2 measurement  gates/measurement.mjs   the cooler ladder and the villain-VPIP lattice
//   I23    depth           gates/depth.mjs         the §3.1 anchor set, pinned to the measurement
//   I27-28 depth endpoints                         I16 and I21 re-run at 40 and 250 bb
//   I26    straddle        gates/env.mjs           the §3.3 direction and its composition case
//   I29-30 straddle sweep                          I16 and I21 re-run with it ON
//   I31    rake                                    the §3.2 haircut
//   I41-44 v3 axes        gates/couplings.mjs      rake-depth, depth-width, profile-ON, 3-bet sizing
//
// 50 gates in total — D3 and I17 went with the sub-bucket layer they asserted (the dual-key
// partition, and the geometric-mean reconstruction of a cell's M_play from its buckets'). D1
// already pins sum(cells) === 270,725, which is what is left of the partition claim.
// V1/I5 and V2/V3/I4 are RANDOM-VILLAIN gates: the filtered-villain lattice is exempt from
// conservation by construction (the scope comment now lives at the top of gates/engine.mjs, with
// the blocks it describes — see METHODOLOGY, which names that file).
//
// Any failure exits non-zero. Gate results are stamped into MODEL.gates for the Method view, and
// the CLI also refreshes MODEL.constants from the live policy constants — see `stampConstants`.
//
// The run also reports WHERE THE TIME WENT, per section, against a soft wall-time ceiling. The
// ceiling and the reasoning for its being soft are in scripts/gates/index.mjs.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import * as P from './lib/policy.mjs';
import { ROOT } from './gates/_shared.mjs';
import {
  REGISTRY, EXPECTED_IDS,
  WALL_MEASURED_MS, WALL_MARGIN, WALL_CEILING_MS, WALL_CEILING_NOTE, wallCeilingMs,
} from './gates/index.mjs';

// ---------------------------------------------------------------------------
/**
 * Run every gate in the registry over `model`.
 *
 * Returns `{ ok, gates, sizes, timings }`. The first three are exactly what this function has
 * always returned — `generate-data.mjs` destructures them — and `timings` is new.
 *
 * ORDER IS PRESERVED DELIBERATELY. Each family's `build()` runs immediately before that family's
 * sections, never earlier, so the sequence of work is identical to the single linear function this
 * replaced. Anything order-sensitive — and Monte Carlo streams are keyed by name, so in principle
 * nothing here is, but "in principle" is not a thing to refactor on — sees the same world it did.
 */
export function verifyModel(model, opts = {}) {
  P.hydrate(model);
  const fast = !!(opts.fast ?? model.meta.fast);
  const tolB = fast ? 1.5 : 0.6;   // benchmark tolerance, pts
  const tolE = fast ? 1.2 : 0.5;   // structural equity tolerance, pts
  const gates = [];
  const G = (id, pass, detail) => gates.push({ id, pass: !!pass, detail });
  // `opts` rides along because I22/I32 read `opts.tierFixture` / `opts.tierFixtureV2` to point at
  // an alternate fixture; it was a closure over the parameter before the split.
  const ctx = { model, opts, fast, tolB, tolE, G };

  const timings = [];
  let sizes;

  for (const fam of REGISTRY) {
    const t0 = performance.now();
    const built = fam.build(ctx);
    const setupMs = performance.now() - t0;
    if (fam.setupLabel) {
      timings.push({ family: fam.family, label: fam.setupLabel, ids: [], ms: setupMs, setup: true });
    }

    for (const s of built.sections) {
      const before = gates.length;
      const s0 = performance.now();
      s.run();
      const ms = performance.now() - s0;
      const emitted = gates.slice(before).map((g) => g.id);
      // A section that stops emitting a gate it declares is the failure mode this split
      // introduced, and it is the one failure a gate report cannot show you: a missing gate
      // prints nothing at all. So it throws, rather than passing quietly with 45 rows.
      if (emitted.join(' ') !== s.ids.join(' ')) {
        throw new Error(`gate registry: ${fam.family}/"${s.label}" declares [${s.ids.join(' ')}] `
          + `but emitted [${emitted.join(' ') || 'nothing'}]`);
      }
      timings.push({ family: fam.family, label: s.label, ids: emitted, ms });
    }

    if (built.done) {
      const out = built.done() || {};
      if (out.sizes !== undefined) sizes = out.sizes;
    }
  }

  const got = gates.map((g) => g.id).join(' ');
  if (got !== EXPECTED_IDS.join(' ')) {
    throw new Error('gate registry: the report order changed.\n'
      + `  expected: ${EXPECTED_IDS.join(' ')}\n  got:      ${got}`);
  }

  const ok = gates.every((g) => g.pass);
  return { ok, gates, sizes, timings };
}

// ---------------------------------------------------------------------------
/**
 * Refresh `model.constants` from the live `policy.mjs` CONSTANTS, and report what moved.
 *
 * WHY THIS EXISTS. `generate-data.mjs` emits `constants: { ...CONSTANTS, <measured> }`, so a new
 * scoring constant reaches the shipped file only on a regeneration — and a regeneration is three
 * hours of Monte Carlo for a change that contains no randomness at all. The Method view renders
 * `model.constants` and nothing else, so between the two the page cannot show a constant the model
 * is actually using, which breaks METHODOLOGY's rule 1 harder than the restamp does. This is the
 * cheap deterministic path: the SAME object literal the generator builds, assembled from the same
 * two sources, with zero simulation.
 *
 * The split is the generator's own, not a new one. Everything in `CONSTANTS` is OPINION and its
 * source of truth is the code; everything else in the block is MEASUREMENT (`nuBarMeasured`,
 * `coolerBarMeasured`, `nMax`, `mosaicTotal`, `cooler`, `villainLattice`) and its source of truth
 * is the run that produced the file, so those keys are carried across untouched and in order. A key
 * the code no longer defines is preserved rather than dropped: this function refreshes, it does not
 * prune, because pruning a measurement nobody remembers is how data gets lost.
 *
 * Called from the CLI before `verifyModel`, so D6/D7 measure the payload as it will be written.
 */
export function stampConstants(model) {
  const live = P.CONSTANTS;
  const before = model.constants || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(live, k);
  const measured = {};
  for (const k of Object.keys(before)) if (!has(k)) measured[k] = before[k];
  const added = Object.keys(live).filter((k) => !Object.prototype.hasOwnProperty.call(before, k));
  const changed = Object.keys(live).filter((k) => Object.prototype.hasOwnProperty.call(before, k)
    && JSON.stringify(before[k]) !== JSON.stringify(live[k]));
  model.constants = { ...live, ...measured };
  return { added, changed, kept: Object.keys(measured) };
}

/** the calibration table, printed under the gate list */
export function formatBenchmarks(model) {
  const L = [];
  const row = (a, b, c, d) => `  ${a.padEnd(26)}${b.padStart(9)}${c.padStart(11)}${d.padStart(9)}`;
  L.push('', '  CALIBRATION BENCHMARKS  (' + model.benchmarks.trials.toLocaleString() + ' trials per row)');
  L.push('  ' + '-'.repeat(56));
  L.push(row('heads-up vs one random', 'published', 'measured', 'delta'));
  for (const r of model.benchmarks.hu) {
    L.push(row(r.label, r.expected.toFixed(2), r.measured.toFixed(2), (r.measured - r.expected).toFixed(2)));
  }
  L.push('', row('multiway decay', 'N=1', 'N=3', 'N=5'));
  for (const r of model.benchmarks.multiway) {
    L.push(row(r.label, r.measured[0].toFixed(2), r.measured[2].toFixed(2), r.measured[4].toFixed(2)));
  }
  L.push('', row('vs the face-up range', 'published', 'measured', 'delta'));
  for (const r of model.benchmarks.vs3bet) {
    L.push(row(r.label, r.expected.toFixed(2), r.measured.toFixed(2), (r.measured - r.expected).toFixed(2)));
  }
  if (model.benchmarks.disputed && model.benchmarks.disputed.length) {
    L.push('', '  DISPUTED — both engines agree with each other and disagree with the published table:');
    for (const d of model.benchmarks.disputed) {
      L.push(`    ${d.label.padEnd(24)} measured ${d.measured.toFixed(2)}  published ${d.published.toFixed(2)}  (${d.trials.toLocaleString()} trials, ${d.engines})`);
    }
  }
  return L.join('\n');
}

export function formatReport(report) {
  const lines = ['', '  GATE   RESULT  DETAIL', '  ' + '-'.repeat(96)];
  for (const g of report.gates) {
    lines.push(`  ${g.id.padEnd(6)} ${(g.pass ? 'pass' : 'FAIL').padEnd(7)} ${g.detail}`);
  }
  lines.push('  ' + '-'.repeat(96));
  lines.push(`  ${report.gates.filter((g) => g.pass).length}/${report.gates.length} gates pass` +
    (report.ok ? '' : '  <-- BUILD FAILURE'));
  return lines.join('\n');
}

/**
 * Where the time went, per section, against the soft wall-time ceiling.
 *
 * Printed after everything else, so the report a reader has been diffing for two years is a
 * strict prefix of this one — which is how the registry refactor proved it changed no gate output.
 */
export function formatTimings(report, wallMs) {
  const ceiling = wallCeilingMs();
  const T = report.timings;
  const sum = T.reduce((a, x) => a + x.ms, 0);
  const ms = (x) => Math.round(x).toLocaleString();
  const L = [];
  L.push('', '  GATE TIMING — where verification time goes');
  L.push('  ' + '-'.repeat(96));
  L.push(`  ${'FAMILY'.padEnd(14)}${'SECTION'.padEnd(50)}${'GATES'.padEnd(16)}${'MS'.padStart(8)}${'SHARE'.padStart(8)}`);
  for (const t of T) {
    const label = (t.setup ? 'setup · ' + t.label : t.label);
    L.push(`  ${t.family.padEnd(14)}${label.slice(0, 49).padEnd(50)}${(t.ids.join(' ') || '—').padEnd(16)}`
      + `${ms(t.ms).padStart(8)}${(100 * t.ms / sum).toFixed(1).padStart(7)}%`);
  }
  L.push('  ' + '-'.repeat(96));

  const slow = T.reduce((a, x) => (x.ms > a.ms ? x : a), T[0]);
  const families = new Set(T.map((t) => t.family)).size;
  L.push(`  ${report.gates.length} gates · ${T.length} sections · ${families} families · `
    + `slowest ${slow.family}/${slow.setup ? 'setup' : slow.ids.join(' ')} ${ms(slow.ms)} ms `
    + `(${(100 * slow.ms / sum).toFixed(1)}%) · ${ms(sum)} ms attributed of ${ms(wallMs)} ms wall `
    + `(${(100 * sum / wallMs).toFixed(1)}%)`);

  const pct = (100 * wallMs / ceiling).toFixed(0);
  const overridden = ceiling !== WALL_CEILING_MS;
  const anchor = overridden
    ? `${ms(ceiling)} ms (RUNDOWN_WALL_CEILING_MS, overriding the anchored ${ms(WALL_CEILING_MS)} ms)`
    : `${ms(ceiling)} ms = ${ms(WALL_MEASURED_MS)} ms measured + ${Math.round(WALL_MARGIN * 100)}% margin`;
  if (wallMs > ceiling) {
    L.push(`  OVER THE SOFT WALL-TIME CEILING — wall ${ms(wallMs)} ms is ${pct}% of ${anchor}.`);
  } else {
    L.push(`  wall ${ms(wallMs)} ms — ${pct}% of the soft ceiling ${anchor}.`);
  }
  L.push(`  anchor: ${WALL_CEILING_NOTE}.`);
  L.push('  SOFT by design — wall time is a property of the machine, not the repository, so going over');
  L.push('  prints this line and nothing else; it never fails the build. The table says which family');
  L.push('  moved. If it is the machine and not the model, set RUNDOWN_WALL_CEILING_MS.');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const path = resolve(ROOT, process.argv[2] || 'data/model.json');
  const model = JSON.parse(readFileSync(path, 'utf8'));
  const t = Date.now();
  // Before the gates, so D6/D7 measure the payload as it will be written rather than the payload
  // as it was read. Under --no-write nothing lands on disk and this is a preview of the size a
  // write would produce; the file itself is untouched either way.
  const cst = stampConstants(model);
  const report = verifyModel(model);
  console.log(formatReport(report));
  console.log(formatBenchmarks(model));
  if (cst.added.length || cst.changed.length) {
    console.log(`\n  constants refreshed from policy.mjs — ` +
      `added [${cst.added.join(', ') || 'none'}], updated [${cst.changed.join(', ') || 'none'}], ` +
      `${cst.kept.length} measured keys carried across unchanged`);
  }
  const wall = Date.now() - t;
  console.log(`  verified in ${(wall / 1000).toFixed(1)}s`);
  // Everything above this line is byte-for-byte the report this repository has always printed.
  // The timing block is additive, which is what made the registry split checkable: the old output
  // is a strict prefix of the new one.
  console.log(formatTimings(report, wall));
  if (!process.argv.includes('--no-write')) {
    for (const g of report.gates) model.gates[g.id] = g.pass ? 'pass' : 'FAIL';
    model.meta.hash = createHash('sha256')
      .update(JSON.stringify({ ...model, meta: { ...model.meta, hash: '' } })).digest('hex');
    writeFileSync(path, JSON.stringify(model));
  }
  process.exit(report.ok ? 0 : 1);
}
