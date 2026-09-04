// The gate registry.
//
// Every gate the build must pass lives in one of the families below. `scripts/verify.mjs` is now
// only the runner: it hydrates the policy layer, walks this list in order, times each section,
// and formats the report. Adding a gate means adding a file here (or a section to an existing
// one) — which is the point of the split, per V3-PLAN §0.1: four parallel lanes adding gates to
// 129 KB of single-file gate code is a write-contention point, and this is the fix.
//
// ORDER IS PART OF THE CONTRACT. The report prints gates in the order the registry emits them,
// and the refactor that created this file was gated on byte-identical output, so reordering a
// family or a section reorders the report. `EXPECTED_IDS` below is the frozen sequence, and the
// runner throws if a run does not reproduce it exactly. That check is deliberately NOT a gate:
// a gate that has gone missing cannot report its own absence, so this fails the process instead.
//
// A family module exports:
//   family      short slug, used in the timing table
//   title       one line, what the family is about
//   ids         the gate ids it emits, in order
//   setupLabel  optional; what build() does that is worth timing on its own
//   build(ctx)  runs the family's shared setup and returns { sections, done? }
//               sections: [{ ids, label, run() }]  — run() calls ctx.G(id, pass, detail)
//               done():   optional, returns values the runner carries out (data's `sizes`)
//
// build() is called lazily, immediately before the family's sections run, so the execution order
// of the whole suite is exactly what it was when this was one linear function body. That is not
// cosmetic: it is what makes the byte-identity claim hold for anything order-sensitive.

import * as data from './data.mjs';
import * as engine from './engine.mjs';
import * as structure from './structure.mjs';
import * as policySweep from './policy-sweep.mjs';
import * as fixtures from './fixtures.mjs';
import * as payoff from './payoff.mjs';
import * as measurement from './measurement.mjs';
import * as depth from './depth.mjs';
import * as env from './env.mjs';
import * as couplings from './couplings.mjs';
import * as solver from './solver.mjs';
import * as variants from './variants.mjs';
import * as baseline from './baseline.mjs';
import { CATALOG } from './reserved.mjs';

export const REGISTRY = [
  data,          // D1 D2 D4 D5 I18 D6 D7 D8   the artifact as shipped
  engine,        // V1 I5 V2 V3 I4 V4 V5 V6 B I20   the objective layer
  structure,     // I1 I2 I3                   structural equity invariants
  policySweep,   // I6..I16 I19                the opinion layer over one shared sweep
  fixtures,      // I22 I32                    the frozen-tier regressions
  payoff,        // I33                        the §2 interface freeze
  measurement,   // I24 I25                    the v2 measurement shapes
  depth,         // I23 I27 I28                the depth axis
  env,           // I26 I29 I30 I31            straddle + rake
  couplings,     // I41 I42 I43 I44            the v3 axes (P1 lane M)
  solver,        // I35                        the CFR+ engine (P2 lane cfr)
  variants,      // D10 D11                    the dual build, read off the artifacts on disk
  baseline,      // I36 D9                     the P3 equilibrium baseline, off its own artifacts
];

/**
 * The frozen report order — 52 gates, D3 and I17 retired with the sub-bucket layer.
 *
 * P1 lane I appends D10 and D11 at the END of the sequence rather than beside D6/D7 where their
 * family would otherwise sort. Deliberate: the note below says the report order is a thing
 * reviewers diff, and appending keeps the 46-gate report a strict PREFIX of the 48-gate one, so
 * the dual build's arrival shows up as two new rows rather than as a re-ordering of every gate
 * after D8. Same reason the timing block went at the bottom when the registry was split.
 *
 * P1 INTEGRATION (B1): both appending lanes landed, so the tail is lane M's I41–I44 followed by
 * lane I's D10–D11. Each lane's prefix argument survives the other's: 46 is a prefix of 50 and 50
 * is a prefix of 52. D10/D11 stay LAST because their family reads artifacts off disk and is the
 * only family whose inputs are produced by a step outside the runner.
 *
 * WRITTEN OUT, NOT DERIVED FROM `REGISTRY`. A list built by flat-mapping the registry cannot
 * detect the failure it exists to detect: delete a family from `REGISTRY` and the derived list
 * shrinks with it, the run emits 38 gates, and everything agrees with itself. This literal is the
 * independent copy, so deleting a family produces a mismatch instead of a quiet 38/38 pass.
 *
 * Adding a gate means editing this list too. That is deliberate friction: the report order is a
 * thing reviewers diff, and it should not be able to change as a side effect.
 */
export const EXPECTED_IDS = [
  'D1', 'D2', 'D4', 'D5', 'I18', 'D6', 'D7', 'D8',
  'V1', 'I5', 'V2', 'V3', 'I4', 'V4', 'V5', 'V6', 'B', 'I20',
  'I1', 'I2', 'I3',
  'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I16', 'I12', 'I21', 'I13', 'I14', 'I15', 'I19',
  'I22', 'I32',
  'I33',
  'I24', 'I25',
  'I23', 'I27', 'I28',
  'I26', 'I29', 'I30', 'I31',
  // P1 lane M (V3-PLAN §3.1 items 6, 6b, 9, 8). APPENDED, never interleaved: the report order is a
  // thing reviewers diff, and appending keeps the pre-existing 46 lines a strict prefix of the new
  // report exactly as the registry split itself was gated on.
  'I41', 'I42', 'I43', 'I44',
  // P2 lane cfr (V3-PLAN §3.2, the solver engine). Appended after lane M for the same prefix
  // argument the list has used twice already: 52 stays a strict prefix of 53, so the P1 report
  // diffs against this one as one added row rather than as a re-ordering. It sits BEFORE D10/D11
  // because those two stay last by the rule stated above — their family is the only one whose
  // inputs are produced by a step outside the runner.
  'I35',
  // P1 lane I (V3-PLAN §5.3, item 16). Last, for the reason given above the list.
  'D10', 'D11',
  // P3's equilibrium baseline (V3-PLAN §3.3, §5.3). APPENDED, for the fourth time and the same
  // reason: 53 stays a strict prefix of 55, so the P2 report diffs against this one as two added
  // rows rather than as a re-ordering. It sits AFTER D10/D11 rather than beside I35 and D6 where
  // subject would put it, because the rule keeping those two last now describes this family too —
  // it reads artifacts (data/equilibrium.json, index-full.html) produced by a step outside the
  // runner. Both gates are P3's: I36's anchors are asserted on the SHIPPED tiers, and D9 sets
  // full's byte budgets from the first payload that ever existed to measure.
  'I36', 'D9',
];

// Import-time consistency: what the families DECLARE must equal the frozen list. This is the
// half that catches a registry edit (a family dropped, a file's `ids` gone stale); the runner's
// own check on what the families EMIT is the half that catches a gate that stopped firing.
{
  const declared = REGISTRY.flatMap((f) => f.ids).join(' ');
  if (declared !== EXPECTED_IDS.join(' ')) {
    throw new Error('gate registry: the families declare a different gate set than EXPECTED_IDS.\n'
      + `  registry: ${declared}\n  expected: ${EXPECTED_IDS.join(' ')}`);
  }
}

// The §7 catalog's boundary, guarded in both directions. `./reserved.mjs` drafts every gate V3-PLAN
// §7 names, with ids reserved at Phase 0 so a later lane cannot pick its own — but a RESERVED id is
// a promise about a future run, not a gate, and the failure this guards against is a promise
// drifting into the enforced set (a 46-gate report that silently becomes 47, or worse, a reserved
// id printed as `pass` having executed nothing). It also catches the opposite drift: the manifest
// claiming a gate is live when the registry stopped emitting it.
//
// EXPECTED_IDS IS NOT TOUCHED. It stays the written-out literal above, for the reason stated there;
// this block only reads it. Promoting a reserved gate is a deliberate three-line edit — flip
// `status`, add the id to a family's `ids`, add it to EXPECTED_IDS — and any two of the three
// without the third fails here or in the block above. Harness gates (§7.2's S-gates) run outside
// this runner and are exempt from the live-must-be-enforced half by their `runner` field.
{
  const enforced = new Set(EXPECTED_IDS);
  const bad = [];
  for (const e of CATALOG) {
    if (e.status !== 'live' && enforced.has(e.id)) {
      bad.push(`${e.id} is ${e.status} in the catalog but already appears in EXPECTED_IDS`);
    }
    if (e.status === 'live' && e.runner === 'verify' && !enforced.has(e.id)) {
      bad.push(`${e.id} is 'live' in the catalog but is absent from EXPECTED_IDS`);
    }
  }
  if (bad.length) {
    throw new Error('gate catalog: reserved and enforced ids disagree (scripts/gates/reserved.mjs).'
      + `\n  ${bad.join('\n  ')}`);
  }
}

// ---------------------------------------------------------------------------
// The wall-time ceiling.
//
// SOFT, ON PURPOSE, AND THAT IS THE ONLY HONEST SHAPE FOR IT. Every other budget in this
// repository bounds a deterministic quantity — D6 counts bytes, D7 counts bytes, and "measured +
// 5%" is a fair margin because a re-run produces the same number. Wall time is not that. It is a
// property of the machine, its load, and its thermal state, not of the repository, so a hard
// ceiling would make the whole 48-gate suite fail for reasons that have nothing to do with the
// model. A gate that fires on someone else's laptop teaches the next person to widen it, which is
// how tolerance-widening starts — and this repository's rule is that gates are written to FAIL,
// never widened to pass. So verification cost is MEASURED and STATED on every run, and going over
// the ceiling prints a loud line, but it does not change the exit code.
//
// THE ANCHOR, measured not guessed. Four full runs of this registry on the reference machine
// (Apple Silicon, Node 22, full non-`--fast` dataset) came in at 25.5 / 25.7 / 26.1 / 26.2 s;
// `WALL_MEASURED_MS` is the slowest of the four. Recorded beside it, because it is the kind of
// number this repository ships rather than hides: the single-file runner this registry replaced
// measured 27.3 and 27.8 s on the same box, so the split did not cost verification time — it
// bought back about 1.5 s, presumably by no longer handing V8 one 161 KB function body.
//
// The margin is 60%, not the 5% D9's byte budgets use, and the size of that gap IS the statement:
// it is how much more spread a wall-clock number carries than a byte count. A run over the
// ceiling is not necessarily a regression — but it is worth a look, and the per-section table
// says immediately which family moved.
//
// Override for a slower box or CI: RUNDOWN_WALL_CEILING_MS=90000 node scripts/verify.mjs
export const WALL_MEASURED_MS = 26200;
export const WALL_MARGIN = 0.6;
export const WALL_CEILING_MS = Math.round(WALL_MEASURED_MS * (1 + WALL_MARGIN));
export const WALL_CEILING_NOTE = '25.5-26.2s over 4 runs, Apple Silicon / Node 22 / non-fast data'
  + ' — the single-file runner it replaced measured 27.3-27.8s on the same box';

/** the ceiling actually in force, after the env override */
export function wallCeilingMs() {
  const raw = process.env.RUNDOWN_WALL_CEILING_MS;
  if (!raw) return WALL_CEILING_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : WALL_CEILING_MS;
}
