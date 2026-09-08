// ring.mjs — THE NINE-SEAT RING: the N = 8 and N = 9 equity columns, as a SEPARATE ARTIFACT.
//
// V4-PLAN §0.4 admits a new mechanism as (a) a new axis inert at legacy settings or (b) a new
// artifact. The seat ladder is (a); this is (b). At nine seats `N_eff` runs past seven routinely —
// the limps node reaches 9.96 at UTG+1 over four limpers, straddled (§2.4) — and the model's
// measured equity curve stops at seven. The two ways to fix that inside `data/model.json` were both
// rejected before this file existed: clamping at 7 badges a large share of the new surface
// `extrapolated`, and regenerating `model.json` at NMAX = 9 adds ~7.0 KB to a `core` block with
// 4 KB of headroom AND re-measures the frozen layer. So the extra columns enter beside the model
// instead of inside it, and `cells[*].eq` stays byte-identical — which is the whole of §0.4.
//
// WHAT IS MEASURED. The same two kernels `generate-data.mjs` measures the shipped layer with
// (`mc.mjs` `runMulti` and `runMultiFiltered`), at the same trial counts (100,000) and therefore the
// same standard error (`se.cell` = 0.16 equity points), with the field width raised from seven to
// nine through the per-call `nMax` option v4 added to both. Nine villains per trial, two named
// seeds, and per cell exactly what the nine-seat surface reads: `eq[7..8]` and `vDelta[v][7..8]`
// 0-based — the N = 8 and N = 9 columns.
//
// WHAT IS NOT SHIPPED, AND WHY IT IS THE INTERESTING HALF. The same deals yield N = 1..7 for free.
// Those columns are deliberately absent from the artifact — the page reads them from `model.json`,
// and shipping a second copy would be two books of the same number. They are the artifact's
// FALSIFIER instead: an independent, differently-seeded reproduction of the v1/v2 measurement layer,
// obtained at no extra cost, and their agreement with `cells[*].eq[0..6]` is recorded per cell so
// D12(c) can be judged without paying the five minutes again.
//
// ------------------------------------------------------------------------------------------------
// THE BAND, WHICH THE PLAN GOT WRONG AND THIS FILE RECORDS RATHER THAN PATCHES
// ------------------------------------------------------------------------------------------------
// V4-PLAN §5.2 pre-registers D12(b) and D12(c) at `2 · se.cell = 0.32 equity points on every cell`.
// That band is UNSATISFIABLE, for a reason that is arithmetic and has nothing to do with what this
// run happened to measure:
//
//   `se.cell` is the standard error of ONE measured column. Both clauses compare TWO independently
//   sampled columns, and the standard error of a difference of two independent samples is
//   `sqrt(seA^2 + seB^2)` = `sqrt(2) · se.cell` = 0.224, not `se.cell`. So 0.32 is 1.41 sigma on the
//   quantity it is applied to, and 1.41 sigma is breached by Monte Carlo noise alone about 16% of
//   the time. Asserted "on every cell" over the artifact's 861 prefix comparisons, it demands that
//   a 1.41-sigma event never occur in 861 draws. Its expected count is ~136.
//
//   No trial budget rescues it. D12(c) compares against the SHIPPED layer, whose own `se.cell` =
//   0.158 is fixed and frozen; even an infinitely precise ring leaves `se_diff >= 0.158`, so 0.32
//   is at most 2.02 sigma however long this generator runs. D12(b) would need ~597,000 trials per
//   cell to make 0.32 a 3.5-sigma bound — six times the measured wall, against a 1,280 s ceiling.
//
// So the pre-registered reading is REPORTED, every run, in `meta.prefix.worstSE` and
// `meta.twoSeed.worstSE` (the worst |delta| in units of `se.cell`, the plan's own units, against
// the plan's own 2.0) and recorded as a falsified prediction — never edited away, and never
// silently widened. What is ASSERTED is the same constant with the error propagation the comparison
// requires, and it is built from `se.cell` and the artifact's own shape alone:
//
//   seDiff        = sqrt(2) · se.cell          two independent equity columns
//   seDiffDelta   = 2 · se.cell                two independent vDeltas (each itself a difference;
//                                              an upper bound, since the hero stream is shared and
//                                              the pairing can only reduce it)
//   outlier       = OUTLIER_SIGMA · seDiff     the "something is broken" line, not a noise band
//
// `OUTLIER_SIGMA = 5` is the canonical outlier line and is anchored by the artifact's own shape
// rather than tuned to it: over the 1,476 + 861 comparisons this file makes, the Gaussian
// false-alarm probability of a single 5-sigma excursion is 5.7e-4. A measurement that is merely
// noisy passes it; a measurement that is WRONG — a mis-threaded `nMax`, a stale kernel, a seed
// collision, a column read off by one — fails it by orders of magnitude, which is the failure mode
// a gate on this artifact exists to catch. The clauses that actually discriminate are the two
// beside it: BIAS (the mean signed delta, which no amount of noise moves and any systematic error
// does) and SPREAD (the RMS delta against what Monte Carlo predicts, which catches a trial count or
// a variance that is not what `meta` claims).
//
// NODE-ONLY BELOW THE ARTIFACT. This module is the generator's library; the PAGE reads the written
// JSON and nothing else. There is no `@browser-cut` because nothing here reaches the browser.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

/** where the generated ring lives, relative to the repository root */
export const ARTIFACT = 'data/ring.json';

/** the script that writes it — named here so a missing artifact can say how to make one */
export const GENERATOR = 'scripts/generate-ring.mjs';

/**
 * The two independent samples, NAMED, and named before anything was measured on them.
 *
 * `[0]` is the primary — the sample whose columns ship and whose prefix is compared against the
 * model. `[1]` exists so D12(b) is a comparison of two measurements rather than of a measurement
 * with itself. The checkdown matrix's `SEEDS` doctrine, one artifact later: the names are fixed
 * before the numbers, and a disagreement is answered with more trials or with a finding, NEVER with
 * a second look at the seed names.
 */
export const SEEDS = Object.freeze(['rundown-v4/ring-A', 'rundown-v4/ring-B']);

/** the field width the ring is measured at — `nMax(9)` (policy.mjs), and `ring.meta.nMax` */
export const RING_NMAX = 9;

/**
 * The wall-time budget, in seconds. PRE-REGISTERED at 1,280 in V4-PLAN §3 (rule R2 as amended by
 * the owner, 2026-09-08) and DERIVED, not chosen — twice, and the first derivation is kept.
 *
 * ORIGINALLY 300, from the shipped pipeline's two NMAX-scaling stages S2 (12 s) + S2L (101 s) =
 * 113 s at seven villains (METHODOLOGY :1955) on the assumption that per-trial cost scales about
 * linearly in villains because the draw width is `NEED = 5 + nMax * 4`, over two seeds:
 * `2 × 113 × 9/7 ≈ 291`, rounded up. THAT DERIVATION IS FALSIFIED and is recorded here rather than
 * edited away. Measured at stage S2 (run 1, `docs/spikes/V4-ring.md` §3.2): linearity holds for
 * `runMulti` (per cell 19 → 22 ms, 1.16×) and fails for `runMultiFiltered` (per-cell lattice
 * Σ 189 → 1,170 ms, 6.2×) — not because of the draw width but because by the ninth villain 40 of
 * 52 cards are dead, the VPIP-filtered pools exhaust rejection sampling, and each exhaustion burns
 * the full `RANGE_TRIES = 4,000` before falling back to a random hand (v = 25 fallback rate
 * 0.029 % → 5.744 %).
 *
 * The owner re-derived the budget FROM THE MEASURED COST MODEL, in the same shape as the derivation
 * it replaces, with the two measured per-kernel coefficients in place of the assumed 9/7:
 *
 *     2 × (12 × 1.16 + 101 × 6.2) ≈ 1,280 s        four workers — the derivation's own regime
 *
 * Worker count cannot move a number (METHODOLOGY :2798: `workers=1` and `workers=8` agree), so a
 * larger count is a wall-clock trade and never a way to meet this budget. R2 is otherwise unchanged:
 * the lattice ships at the full `generate-data` regime (no halving — halving was measured at ≈ 622 s
 * and would coarsen `se.latt` for nothing), no seed is ever dropped, the halving clause bites
 * strictly ABOVE this value and never at it, and a measured wall still above it after halving is a
 * blocker rather than a silent widening.
 */
export const WALL_BUDGET = 1280;

/**
 * The outlier line, in standard errors of the difference. See THE BAND above: 5 sigma is the
 * canonical "this is not noise" threshold and its false-alarm probability over this artifact's own
 * 2,337 comparisons is 5.7e-4. It is a bound on breakage, not the noise band, and the bias and
 * spread clauses beside it are what discriminate a good measurement from a merely quiet one.
 */
export const OUTLIER_SIGMA = 5;

/** the VPIP lattice, and the discipline — read from `data/model.json` so they cannot drift from it */
export function latticeOf(model) {
  const L = model.constants.villainLattice;
  return { v: L.v.slice(), q: L.discipline };
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/**
 * The hash of the source that DEFINES the artifact: this module plus the generator.
 *
 * Deliberately NOT a hash of `mc.mjs` in full — most of that file (the pool driver, the reference
 * evaluators, `equityPaired`) cannot touch a ring number, and hashing it here would make every
 * unrelated edit look like a stale ring and cost five minutes to disprove. What DOES decide the
 * numbers is the portable kernel region, and that is hashed separately as `kernelHash`, so an edit
 * inside the `@worker-slice` markers invalidates the ring on the same run and an edit outside them
 * does not. The checkdown matrix draws the same line for the same reason.
 */
export function sourceHash() {
  const self = readFileSync(resolve(HERE, 'ring.mjs'), 'utf8');
  const gen = readFileSync(resolve(ROOT, GENERATOR), 'utf8');
  return sha256(`${self}\n${gen}`);
}

/**
 * The hash of the measurement kernel: `mc.mjs`'s `@worker-slice` region, the exact bytes the
 * browser bundle slices out and the exact bytes that decide what an equity number MEANS.
 *
 * This is the coupling that makes D12 bite on lane R's own change. The per-call `nMax` option lives
 * inside these markers; move it out, or change a kernel, and the ring says so.
 */
export function kernelHash() {
  const src = readFileSync(resolve(ROOT, 'scripts/lib/mc.mjs'), 'utf8');
  const a = src.indexOf('/* @worker-slice-start');
  const b = src.indexOf('/* @worker-slice-end */');
  if (a < 0 || b < 0 || b < a) throw new Error('mc.mjs: missing or inverted @worker-slice markers');
  return sha256(src.slice(a, b));
}

/**
 * The bands, derived from `se.cell` and nothing else. See THE BAND in the header.
 * @param {{cell:number}} se the artifact's own `meta.se`
 */
export function bandsFor(se) {
  const seDiff = Math.SQRT2 * se.cell;
  return {
    preRegistered: +(2 * se.cell).toFixed(4),
    seDiff: +seDiff.toFixed(4),
    seDiffDelta: +(2 * se.cell).toFixed(4),
    sigma: OUTLIER_SIGMA,
    outlier: +(OUTLIER_SIGMA * seDiff).toFixed(4),
    outlierDelta: +(OUTLIER_SIGMA * 2 * se.cell).toFixed(4),
  };
}

/**
 * Summarise a list of signed deltas against a standard error.
 *
 * BIAS, SPREAD, WORST — in that order of evidentiary value.
 *
 * `biasSigma` is the mean signed delta in units of `seDiff` — of ONE difference, NOT of the mean of
 * n of them. That looks too weak by a factor of sqrt(n) and it is the correct denominator, for a
 * reason this repository designed in on purpose: COMMON RANDOM NUMBERS. Every cell in a stage
 * restarts the same board/villain stream (`mc.mjs`'s header note), so the per-cell errors are
 * strongly CORRELATED and their mean does not average down like sqrt(n). This was measured, not
 * assumed: at 5,000 trials the two-seed mean delta read 0.112 pt, which is 4.3 sigma of an
 * independent-sample mean and 0.11 sigma of a shared-stream one — the independence assumption is
 * off by more than an order of magnitude, in the direction the design predicts. `biasSigmaIndep` is
 * kept beside it so the size of that correlation stays on the record rather than in a comment.
 *
 * `spread` is the RMS delta in units of `seDiff`, which is 1.0 exactly when the measurement is as
 * noisy as `meta` claims and nothing more; it reads below 1 in practice because `se = 50/sqrt(n)`
 * is the p = 0.5 worst case and equity against a large field is far from p = 0.5.
 *
 * `worst` is the max |delta| — reported in BOTH the plan's units (`se.cell`, band 2.0, falsified)
 * and the propagated units (`seDiff`, bounded by OUTLIER_SIGMA).
 *
 * @param {{d:number, at:string}[]} rows signed deltas with the cell/column they came from
 * @param {number} seDiff the standard error of one difference
 * @param {number} seCell the plan's own unit, for the pre-registered reading
 */
export function summarise(rows, seDiff, seCell) {
  const n = rows.length;
  if (!n) throw new Error('summarise: nothing to summarise');
  let sum = 0, sq = 0, worst = 0, at = '';
  for (const r of rows) {
    sum += r.d;
    sq += r.d * r.d;
    const a = Math.abs(r.d);
    if (a > worst) { worst = a; at = r.at; }
  }
  const mean = sum / n;
  const rms = Math.sqrt(sq / n);
  const pre = 2 * seCell;
  return {
    n,
    mean: +mean.toFixed(5),
    biasSigma: +(Math.abs(mean) / seDiff).toFixed(3),
    biasSigmaIndep: +(Math.abs(mean) / (seDiff / Math.sqrt(n))).toFixed(2),
    rms: +rms.toFixed(4),
    spread: +(rms / seDiff).toFixed(3),
    worst: +worst.toFixed(4),
    worstAt: at,
    worstSigma: +(worst / seDiff).toFixed(2),
    worstSE: +(worst / seCell).toFixed(2),
    over: rows.reduce((c, r) => c + (Math.abs(r.d) > pre ? 1 : 0), 0),
    overBand: +pre.toFixed(4),
  };
}

/**
 * The artifact's canonical text: one JSON object, newline-terminated.
 *
 * WHAT IS DELIBERATELY ABSENT: Node version, timestamp, machine. All three would make `--check`'s
 * byte-compare fail for reasons that are not the code's.
 *
 * `meta.wallSec` IS PRESENT, and it is the ONE documented exclusion from the byte-compare — the
 * equilibrium baseline's `meta.buildMs` precedent, taken deliberately rather than by drifting into
 * it. Wall time is a property of the machine, so the checkdown matrix keeps it out of its artifact
 * entirely and prints it instead. That option is not open here: D12(e) is a gate on the measured
 * wall against `meta.wallBudget`, and a gate cannot judge a number that lives only in a log. So the
 * reading is stored, `contentHash` is computed with it blanked (as it is with `contentHash` itself),
 * and `--check` blanks it on BOTH sides — the exclusion is stated, in the header, in the hash, and
 * in `--check`'s own output, rather than papered over by quietly dropping the field.
 *
 * `agree.twoSeed` and `agree.prefix` are per-cell worst |delta| IN UNITS OF THE PROPAGATED
 * STANDARD ERROR, aligned index-for-index with `Object.keys(cells)`. They are what gives D12(b) and
 * D12(c) per-cell teeth at gate time without shipping a second copy of the columns: the gate walks
 * all 123 and fails on any one of them, and `--check` proves the numbers are what the generator
 * actually produced rather than what somebody typed.
 */
export function serialize(payload) {
  const body = {
    note: 'The nine-seat ring: the N = 8 and N = 9 equity columns, measured beside data/model.json '
      + 'rather than inside it so that cells[*].eq stays byte-identical (V4-PLAN §0.4, §2.4). '
      + 'Generated by ' + GENERATOR + '; see scripts/lib/ring.mjs for the construction and for why '
      + 'the plan\'s pre-registered 2·se.cell agreement band is reported rather than asserted. '
      + 'eq is [N=8, N=9]; vDelta[v] is [N=8, N=9] as deltas from this artifact\'s own '
      + 'random-villain baseline, 1 dp, exactly as model.json ships its own.',
    meta: payload.meta,
    cells: payload.cells,
    agree: payload.agree,
  };
  body.meta.contentHash = '';
  body.meta.contentHash = contentHashOf(body);
  return `${JSON.stringify(body)}\n`;
}

/** The content hash, with the two machine-dependent fields blanked. See `serialize`. */
export function contentHashOf(body) {
  const meta = { ...body.meta, contentHash: '', wallSec: 0 };
  return sha256(JSON.stringify({ ...body, meta }));
}

/** The byte-compare's canonical form: `wallSec` blanked, the one documented exclusion. */
export const normalise = (body) => JSON.stringify({ ...body, meta: { ...body.meta, wallSec: 0 } });

/**
 * Parse the artifact and CHECK ITS CONTENT HASH at the point of use.
 *
 * Loud rather than lazy, for the checkdown matrix's reason: a ring half-read is an equity that is
 * quietly wrong on every nine-seat setting above N = 7, and those are exactly the settings nobody
 * has a six-seat intuition to catch it with.
 */
export function deserialize(text) {
  const body = JSON.parse(text);
  const stated = body.meta.contentHash;
  const recomputed = contentHashOf(body);
  if (stated !== recomputed) {
    throw new Error(`ring: ${ARTIFACT} fails its own content hash (states ${stated}, computes `
      + `${recomputed}) — regenerate it with \`node ${GENERATOR}\``);
  }
  return body;
}

/** Read the shipped ring, or throw a message that says how to make one. */
export function shippedRing() {
  let text;
  try {
    text = readFileSync(resolve(ROOT, ARTIFACT), 'utf8');
  } catch (e) {
    throw new Error(`ring: ${ARTIFACT} is not there (${e.code}) — run \`node ${GENERATOR}\``);
  }
  return deserialize(text);
}
