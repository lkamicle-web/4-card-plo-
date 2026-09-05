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
//   I35    the solver      gates/solver.mjs        CFR+ quality, and the two disclosure clauses
//
//   D10-11 the dual build  gates/variants.mjs      the lite negative manifest, and per-variant
//                                                  provenance, read off the artifacts on disk
//   I36 D9 the baseline    gates/baseline.mjs      the equilibrium anchors and the full-only budget
//   I38 I37 the skill axis gates/skill.mjs         the dial, and the divergence measured along it
//   I34    the EV cut      gates/ev.mjs            the quarantine, the arithmetic, and what it moves
//   I39-40
//   I47    sub-cell top-N  gates/subcell.mjs       the rung table, and §2.4's autopsy re-measured
//   I46    calibration     gates/calibration.mjs   the primacy verdict, against the phase-0 bar
//
// 62 gates in total — 46 through Phase 0, plus lane M's I41-I44 and lane I's D10/D11 at P1, I35 at
// P2, I36/D9 at P3, I38/I37 and I34/I39/I40 at P4, and I47/I46 at P5. I45 was RESERVED for the
// squeeze stage and never went live — the stage was cut on two measurements (METHODOLOGY
// limitation 19), so the id stays reserved rather than recycled. The six families below the
// blank line are the ones whose inputs come from a step OUTSIDE this runner — built artifacts,
// the solved payload, (I47) src/shell.html evaluated as a program, or (I46) a block this very run
// stamped — which is why they are appended last and stay last. D3 and I17 went with the
// sub-bucket layer they asserted (the dual-key partition, and
// the geometric-mean reconstruction of a cell's M_play from its buckets'). D1 already pins
// sum(cells) === 270,725, which is what is left of the partition claim — and I47(a) adds the one
// sub-cell identity that CAN be honestly reconstructed, which is structural rather than measured.
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
import { buildCalibrationBlock } from './lib/calibration.mjs';
import { solverBlock } from './lib/equilibrium.mjs';
import { makePayoff } from './lib/payoff.mjs';
import { evMixK } from './lib/ev-band.mjs';
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
 * THE THIRD SOURCE, added at P3 (V3-PLAN §3.3's adjudication 10, §6's third leg, and
 * docs/refutations/P2.md finding 6): `constants.solver`, from `scripts/lib/cfr.mjs`'s own
 * `CONSTANTS` export, assembled by `solverBlock()`. It is stamped AUTHORITATIVELY rather than
 * carried across like a measured key, and the difference matters — a block that had drifted would
 * otherwise be preserved by the very function whose job is to keep the shipped constants equal to
 * the code's. P2 could not stamp it (the solver constants existed but no model write was due), and
 * the gap was real: the Method view renders `model.constants` and nothing else, so until this line
 * the page could not show four numbers the repository was actually solving with. I35's constants
 * clause reads the block back off the file AND out of every built page, so this stamp and that gate
 * are the two halves of one statement.
 *
 * This is the SURGICAL path, and P3 uses no other: no Monte Carlo runs, `cells` / `rows` / `cols` /
 * `bands` / `order` / `benchmarks` are not touched, and adjudication 11 requires a key-by-key
 * comparison proving exactly that.
 *
 * Called from the CLI before `verifyModel`, so D6/D7 measure the payload as it will be written.
 */
export function stampConstants(model) {
  const live = P.CONSTANTS;
  const before = model.constants || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(live, k);
  const measured = {};
  for (const k of Object.keys(before)) if (!has(k) && k !== 'solver' && k !== 'evCut') measured[k] = before[k];
  const added = Object.keys(live).filter((k) => !Object.prototype.hasOwnProperty.call(before, k));
  const changed = Object.keys(live).filter((k) => Object.prototype.hasOwnProperty.call(before, k)
    && JSON.stringify(before[k]) !== JSON.stringify(live[k]));
  const solver = solverBlock();
  if (!Object.prototype.hasOwnProperty.call(before, 'solver')) added.push('solver');
  else if (JSON.stringify(before.solver) !== JSON.stringify(solver)) changed.push('solver');
  /* `evCut` — the EV MIX band's k, DERIVED FROM THE SHIPPED DISTRIBUTION rather than declared, on
     the `solver` precedent one line above (V3-PLAN §6's `EV MIX band` row; P4). It is excluded from
     `measured` for the same reason `solver` is: a derived block that survives across a stamp is a
     block that can go stale, and going stale is the failure that actually happens here — the tiers
     are regenerated and the constant is not. So it is re-derived on every stamp, and gate I40
     re-derives it a third time from scratch and `Object.is`-compares against what shipped.

     THE ORDER IS LOAD-BEARING: the derivation solves the pipeline at the default state and reads
     `t4Band` off the LIVE constants, so `model.constants` has to carry the live block before it
     runs. `evStake` also reads `constants.solver.sizingLadder`, which the line above just wrote. */
  model.constants = { ...live, ...measured, solver };
  const evCut = evMixK(model, makePayoff(model));
  if (!Object.prototype.hasOwnProperty.call(before, 'evCut')) added.push('evCut');
  else if (JSON.stringify(before.evCut) !== JSON.stringify(evCut)) changed.push('evCut');
  model.constants.evCut = evCut;
  return { added, changed, kept: Object.keys(measured) };
}

// ---------------------------------------------------------------------------
/**
 * Stamp `model.calibration` — the primacy verdict, the pre-registered bar it was judged against,
 * and everything the criteria's REPORTING DUTY says ships whatever the answer is.
 *
 * ON THE `evCut` PRECEDENT, AND FOR THE SAME REASON. This is RE-DERIVED on every run and never
 * carried across: a verdict that survives a stamp is a verdict that can go stale, and going stale
 * is the failure that actually happens here — the EV surface is regenerated and the calibration
 * block is not. `generate-data.mjs` does not write it either, for the same reason `constants.evCut`
 * is not written there: three hours of Monte Carlo for a value that contains no randomness at all,
 * and the Method view renders `model.calibration` and nothing else, so between regenerations the
 * page could not show the verdict the repository actually computed.
 *
 * THE VERDICT IS FAIL AND IT IS STAMPED ANYWAY. V3-PLAN §3.5's S-C annotation: "`model.calibration
 * .verdict` **ships hard-failing**, with PC-0..PC-8 stored as shipped data and rendered by the
 * Method view so the reason is *on screen* rather than in a doc"; METHODOLOGY limitation 18: "P5
 * renders this limitation from shipped data in the Method view (`model.calibration`)". Stamping
 * nothing would satisfy neither, and would leave the page unable to say why the decision layer is
 * unfalsified — which is the one thing this phase has to say.
 *
 * NO CORPUS IS PASSED, deliberately. `buildCalibrationBlock(model)` with no `corpus` option records
 * `corpus.present: false` and S-C's reason. The synthetic fixture the harness ships for its own
 * self-check is NOT fed in here: it is stamped `synthetic` precisely so that PC-2 refuses it, and
 * handing it to the shipped block would put a fabricated corpus on the page.
 *
 * ORDER INSIDE THE CLI IS LOAD-BEARING. After `stampConstants`, because the block's orderings and
 * its self-play stream read the live constants; before `verifyModel`, because D6 measures the
 * payload as it will be written; before the hash, because the block has to be inside `meta.hash`
 * or the artifact and the file would disagree about what shipped. The solve memo is cleared
 * afterwards so a gate asking for a memo-cold reference (I34(a), I47(b)) gets one.
 *
 * @returns {{verdict:string, bytes:number, unevaluable:string[], pc8:string}} for the CLI's report
 */
export function stampCalibration(model) {
  const block = buildCalibrationBlock(model);
  model.calibration = block;
  P.clearSolveMemo();
  return {
    verdict: block.verdict,
    bytes: Buffer.byteLength(JSON.stringify(block)),
    unevaluable: block.unevaluable,
    pc8: block.pc8.status,
  };
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
  // ...and then the calibration verdict, which is re-derived rather than carried for the same
  // reason `constants.evCut` is (see stampCalibration). It runs AFTER the constants because it
  // reads them, and BEFORE the gates because D6 measures the payload as it will be written and I46
  // rebuilds this very block to check the verdict was computed here.
  const cal = stampCalibration(model);
  const report = verifyModel(model);
  console.log(formatReport(report));
  console.log(formatBenchmarks(model));
  if (cst.added.length || cst.changed.length) {
    console.log(`\n  constants refreshed from policy.mjs — ` +
      `added [${cst.added.join(', ') || 'none'}], updated [${cst.changed.join(', ') || 'none'}], ` +
      `${cst.kept.length} measured keys carried across unchanged`);
  }
  console.log(`\n  calibration verdict ${cal.verdict.toUpperCase()} — stamped into model.calibration `
    + `(${cal.bytes.toLocaleString()} B), rendered in the Method view, gated by I46. `
    + `${cal.unevaluable.length} of 8 criteria unevaluable [${cal.unevaluable.join(', ')}]; `
    + `PC-8 ${cal.pc8}. THE BAR DID NOT MOVE: a criterion that cannot be evaluated is a FAIL `
    + `(PC-0), so the verdict is FAIL by construction and EV primacy stays unreachable.`);
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
