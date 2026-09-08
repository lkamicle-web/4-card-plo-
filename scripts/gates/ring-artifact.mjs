// gate D12 — the ring artifact. Five clauses, and two of them are the plan's own predictions failing.
//
// V4-PLAN §2.4 (the artifact), §3 rule R2 (the wall budget), §4 (the constants), §5.2 D12. The
// artifact is `data/ring.json`: the N = 8 and N = 9 equity columns the nine-seat ladder reads,
// measured beside `data/model.json` rather than inside it so that `cells[*].eq` stays
// byte-identical (§0.4). This gate is what stands between that file and the page.
//
// WHAT THIS GATE COSTS AND WHAT IT DELIBERATELY DOES NOT DO. Re-measuring the ring is about five
// minutes on two seeds. `verify.mjs`'s whole wall has a soft ceiling of 41.9 s, so the expensive
// half — `node scripts/generate-ring.mjs --check`, which re-measures from the inputs the file
// records and byte-compares — belongs to the milestone's GREEN definition at its close-out, beside
// the matrix and equilibrium checks. That split is not this gate ducking its claim; it is the
// checkdown matrix's own division of labour (I33's cheap `(artifact)` clause), and clause (a) below
// carries the half that CANNOT wait: a STALE artifact, whose recorded source hashes no longer match
// the working tree, is caught on the same run rather than at the next `--check`.
//
// ------------------------------------------------------------------------------------------------
// (b) AND (c): THE PRE-REGISTERED BAND IS FALSIFIED, AND THIS GATE RECORDS THAT RATHER THAN HIDING IT
// ------------------------------------------------------------------------------------------------
// §5.2 writes D12(b) and D12(c) as `agree within 2 · se.cell = 0.32 equity points on every cell`.
// That band is unsatisfiable, and — this is the part that matters — unsatisfiable BY ARITHMETIC,
// not by anything this run measured:
//
//   `se.cell` is the standard error of ONE column. Both clauses compare TWO independently sampled
//   columns, whose difference has standard error `sqrt(2) · se.cell` = 0.224. So 0.32 is 1.41 sigma
//   on the quantity it is applied to, and "on every cell" asks a 1.41-sigma event never to occur in
//   861 draws, whose expected count is about 136. D12(c) compares against the SHIPPED layer, whose
//   own `se.cell` = 0.158 is frozen, so no trial budget rescues it: even an infinitely precise ring
//   leaves 0.32 at 2.02 sigma. D12(b) would need ~597,000 trials per cell — six times a budget that
//   is already blown.
//
// The plan's instruction where a prediction fails is to RECORD it, never to patch it away, and the
// repository's rule is that a tolerance is never widened to make a gate pass. Both are honoured
// here by separating the two things a band does. The pre-registered reading is REPORTED on every
// run, in the plan's own units, with the word FALSIFIED next to it when it exceeds 2.0 — it is
// evidence, permanently on the report, not a silent deletion. What is ASSERTED is the same constant
// `se.cell` with the error propagation a difference requires, plus the two clauses that actually
// discriminate a good measurement from a merely quiet one:
//
//   BIAS    the mean signed delta, against `seDiff` — NOT `seDiff/sqrt(n)`, because common random
//           numbers (mc.mjs's header) correlate the per-cell errors and their mean does not average
//           down. Measured: the independence assumption is off by ~40x. A systematic error — a
//           column read off by one, a stale pool, a mis-threaded `nMax` — moves this and noise does
//           not.
//   SPREAD  the RMS delta against `seDiff`: 1.0 when the measurement is exactly as noisy as `meta`
//           claims. Catches a trial count that is not what the file says it is.
//   OUTLIER no single cell past `OUTLIER_SIGMA` = 5 sigma, checked on all 123 cells from the
//           artifact's own per-cell record. `test/sim-bundle.test.mjs`'s fidelity tests draw the
//           same line at 4 sigma for 20 comparisons and say why in the same words: the point is to
//           catch a wrong pool or a wrong kernel, "which are worth whole points, not a tenth".
//
// A gate written the other way — asserting 0.32 — would be red on a correct measurement, and the
// only ways to make it green would be to widen it (forbidden), to shop for seeds (forbidden), or to
// delete the clause (worse than either). Reporting the falsification is the one move that keeps the
// evidence.
//
// ------------------------------------------------------------------------------------------------
// (e) IS EXPECTED TO FAIL, AND THAT IS THE FINDING
// ------------------------------------------------------------------------------------------------
// R2 pre-registers 300 s, derived as `2 × 113 × 9/7 ≈ 291` from the shipped pipeline's two
// NMAX-scaling stages on the assumption that cost scales about linearly in villain count. Measured
// at stage S2, that assumption is TRUE for the random-villain kernel (7 -> 9 costs 1.16x) and FALSE
// for the filtered one (5.6x-6.2x), because `runMultiFiltered` rejection-samples the VPIP pool
// against an increasingly blocked deck: at v = 25 the blocked-pool fallback rate rises from 0.029%
// at seven villains to 5.744% at nine — a 198-fold increase — and every fallback burns the full
// `RANGE_TRIES` = 4,000 rejection budget before giving up. The clause asserts the budget anyway, at
// the pre-registered number, because R2 says a run over budget is a blocker and not a widening. The
// gate is where that shows up as a number instead of a paragraph.
//
// WHAT IS NOT THIS GATE'S. `scripts/gates/ring.mjs` (I48-I52) is lane F's file and holds the seat
// axis's own clauses; the two lanes never share one. The id REGISTRATION — `reserved.mjs`, the
// family `ids`, the `EXPECTED_IDS` append at `index.mjs:91` — is lane F's for all seven v4 ids,
// D12 included, because a mismatch between the declared sequence and that frozen literal makes the
// runner THROW rather than fail a gate, and two writers appending is a failure mode with no gate to
// catch it (V4-PLAN §7.2).

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ROOT } from './_shared.mjs';
import { ceilingBound } from './data.mjs';
import { VARIANTS, VARIANT_NAMES } from '../lib/variant.mjs';
import {
  ARTIFACT, GENERATOR, SEEDS, RING_NMAX, WALL_BUDGET, OUTLIER_SIGMA,
  sourceHash, kernelHash, contentHashOf, bandsFor,
} from '../lib/ring.mjs';

export const family = 'ring-artifact';
export const title = 'the ring artifact — data/ring.json (D12)';
export const ids = ['D12'];
export const setupLabel = 'read data/ring.json and recompute its source and content hashes';

/** the injected form, byte for byte as `build.mjs` will write it — the `eq` payload's own idiom */
export const injectedForm = (raw) => `const RING = ${JSON.stringify(JSON.parse(raw))};`;

/** measured × 1.05, whole KB — §2.7's rule for the ring row, and `data.mjs`'s own helper */
export const RING_CEILING_FACTOR = 1.05;

const K = (b) => `${(b / 1024).toFixed(1)}K`;

/**
 * The whole of D12, as a pure function of what it is handed, so a test can fabricate a violator for
 * every clause and watch the gate refuse it. Nothing here reads the disk.
 *
 * @param {object} body the parsed artifact
 * @param {string} raw its bytes, for the injected-size measurement
 * @param {{generator:string, kernel:string}} live the working tree's hashes
 * @param {object} budgets `{ lite: VARIANTS.lite.budgets, full: ... }`
 * @returns {{problems:string[], readings:string[]}}
 */
export function ringProblems(body, raw, live, budgets) {
  const problems = [];
  const readings = [];
  const p = (s) => problems.push(s);

  // -- (a) PROVENANCE: the artifact is not stale ---------------------------------------------------
  const meta = body && body.meta;
  if (!meta) {
    p(`(a) ${ARTIFACT} has no meta at all — an artifact that does not say what built it is not a `
      + 'measurement; regenerate it');
    return { problems, readings };
  }
  if (meta.generatorHash !== live.generator) {
    p(`(a) STALE: the ring was written by generatorHash ${String(meta.generatorHash).slice(0, 16)} and `
      + `this checkout hashes ${live.generator.slice(0, 16)} — scripts/lib/ring.mjs or ${GENERATOR} `
      + `changed since it was generated. Regenerate: node ${GENERATOR}`);
  }
  if (meta.kernelHash !== live.kernel) {
    p(`(a) STALE: the ring was measured by kernelHash ${String(meta.kernelHash).slice(0, 16)} and this `
      + `checkout hashes ${live.kernel.slice(0, 16)} — mc.mjs's @worker-slice region, the code that `
      + `decides what an equity number MEANS, changed since it was generated. Regenerate: node ${GENERATOR}`);
  }
  const recomputed = contentHashOf(body);
  if (meta.contentHash !== recomputed) {
    p(`(a) ${ARTIFACT} fails its own content hash: states ${String(meta.contentHash).slice(0, 16)}, `
      + `computes ${recomputed.slice(0, 16)} — the file has been edited since it was written`);
  }
  readings.push(`gen ${String(meta.generatorHash).slice(0, 8)} · kern ${String(meta.kernelHash).slice(0, 8)}`);

  // -- meta completeness, which (b) names ---------------------------------------------------------
  const wantSeeds = SEEDS.join(',');
  if (!Array.isArray(meta.seeds) || meta.seeds.join(',') !== wantSeeds) {
    p(`(b) meta.seeds is ${JSON.stringify(meta.seeds)}, and the two names fixed before anything was `
      + `measured on them are [${wantSeeds}] — a renamed seed is a re-rolled measurement`);
  }
  if (meta.nMax !== RING_NMAX) p(`(b) meta.nMax is ${meta.nMax}, not ${RING_NMAX}`);
  if (!meta.trials || !(meta.trials.cell > 0) || !(meta.trials.latt > 0)) {
    p(`(b) meta.trials is incomplete: ${JSON.stringify(meta.trials)}`);
  }
  if (!meta.se || !(meta.se.cell > 0) || !(meta.se.latt > 0)) {
    p(`(b) meta.se is incomplete: ${JSON.stringify(meta.se)} — the band is derived from it, so an `
      + 'absent se is an unbounded band');
  }
  if (!(meta.cells > 0)) p(`(b) meta.cells is ${meta.cells}`);

  const cells = (body && body.cells) || null;
  const keys = cells ? Object.keys(cells) : [];
  if (keys.length !== meta.cells) {
    p(`(b) meta.cells says ${meta.cells} and cells carries ${keys.length}`);
  }

  /* THE SHAPE, AND THE ONE STRUCTURAL FACT THAT NEEDS NO BAND AT ALL. More opponents is never worth
     more equity, so eq[N=9] <= eq[N=8] cell by cell with zero tolerance. It is the clause that
     catches a column read off by one — the mistake a band of any width sails straight past. */
  let shapeBad = 0, monoBad = 0;
  for (const key of keys) {
    const c = cells[key];
    if (!Array.isArray(c.eq) || c.eq.length !== 2 || !c.eq.every((x) => typeof x === 'number' && isFinite(x) && x > 0 && x < 100)) {
      shapeBad++;
      continue;
    }
    if (!(c.eq[1] <= c.eq[0])) {
      monoBad++;
      if (monoBad <= 2) p(`(b) ${key}: eq[N=9] ${c.eq[1]} exceeds eq[N=8] ${c.eq[0]} — the equity `
        + 'curve cannot rise with the field size; this is a column read off by one, not noise');
    }
    for (const v of meta.v || []) {
      const d = c.vDelta && c.vDelta[v];
      if (!Array.isArray(d) || d.length !== 2 || !d.every((x) => typeof x === 'number' && isFinite(x))) shapeBad++;
    }
  }
  if (shapeBad) p(`(b) ${shapeBad} cell field(s) are not the [N=8, N=9] pair the page reads`);

  // -- (b) and (c): the agreement clauses ---------------------------------------------------------
  const bands = meta.se && meta.se.cell > 0 ? bandsFor(meta.se) : null;
  if (bands && meta.band && Math.abs(meta.band.seDiff - bands.seDiff) > 1e-9) {
    p(`(b) meta.band.seDiff is ${meta.band.seDiff} and se.cell ${meta.se.cell} derives `
      + `${bands.seDiff} — the band must be a function of the recorded se, never a typed number`);
  }
  for (const [clause, name, agree] of [
    ['b', 'twoSeed', body && body.agree && body.agree.twoSeed],
    ['c', 'prefix', body && body.agree && body.agree.prefix],
  ]) {
    const s = meta[name];
    if (!s || !bands) {
      p(`(${clause}) meta.${name} is absent — the ${name} agreement is unrecorded, and an unrecorded `
        + 'agreement is not a checked one');
      continue;
    }
    if (!Array.isArray(agree) || agree.length !== keys.length) {
      p(`(${clause}) agree.${name} is not one number per cell (${agree ? agree.length : 'absent'} `
        + `against ${keys.length}) — the per-cell record is what gives this clause teeth`);
    } else {
      const bad = [];
      for (let i = 0; i < agree.length; i++) if (!(agree[i] <= OUTLIER_SIGMA)) bad.push(`${keys[i]} ${agree[i]}σ`);
      if (bad.length) {
        p(`(${clause}) ${bad.length} cell(s) past the ${OUTLIER_SIGMA}σ outlier line: `
          + `${bad.slice(0, 4).join(', ')} — at ${OUTLIER_SIGMA}σ the Gaussian false-alarm rate over `
          + 'this artifact is 6e-4, so this is a broken measurement, not an unlucky one');
      }
    }
    if (!(Math.abs(s.biasSigma) <= 2)) {
      p(`(${clause}) ${name}: the mean signed delta is ${s.mean} pt = ${s.biasSigma}σ — a SYSTEMATIC `
        + 'difference. Common random numbers make the per-cell errors correlated, so noise moves this '
        + 'by well under 1σ and only a real error moves it past 2');
    }
    if (!(s.spread <= 2)) {
      p(`(${clause}) ${name}: the RMS delta is ${s.spread}x the ${bands.seDiff} that ${meta.trials.cell} `
        + 'trials predict — the measurement is noisier than the file says it is');
    }
    /* THE PRE-REGISTERED READING, REPORTED. §5.2's own units, §5.2's own band, on the report every
       run whether it holds or not. This is the falsification staying visible. */
    readings.push(`${name} worst ${s.worstSE}·se.cell (§5.2 band 2.0 — `
      + `${s.worstSE > 2 ? 'FALSIFIED' : 'held'}), ${s.worstSigma}σ of seDiff, bias ${s.biasSigma}σ`);
  }

  // -- (c) THE RING IS BESIDE THE MODEL, NOT INSIDE IT ---------------------------------------------
  if (meta.model && meta.model.nMax !== 7) {
    p(`(c) meta.model.nMax is ${meta.model.nMax}: the ring records the model as measured at a width `
      + 'that is not 7, which would mean cells[*].eq had been re-measured — §0.4 forbids exactly that');
  }

  // -- (d) THE ARTIFACT BUDGET, PINNED FROM ABOVE IN BOTH VARIANTS --------------------------------
  const injected = Buffer.byteLength(injectedForm(raw));
  const bound = ceilingBound(injected, RING_CEILING_FACTOR);
  readings.push(`ring ${K(injected)} injected (${K(Buffer.byteLength(raw))} on disk) ≤ ${K(bound)}`);
  for (const v of VARIANT_NAMES) {
    const b = budgets[v];
    const cap = b && b.ring;
    if (cap == null) {
      p(`(d) ${v}: there is no top-level \`ring\` budget row in VARIANTS.${v}.budgets. The artifact `
        + `ships in BOTH variants (§2.4) and D6's from-above clause explicitly excludes it, so this `
        + `pin is D12's: add \`ring: ${bound / 1024} * 1024\` (measured ${K(injected)} × `
        + `${RING_CEILING_FACTOR}, whole KB). Stage S3 owns variant.mjs`);
      continue;
    }
    if (cap > bound) {
      p(`(d) ${v}: the ring ceiling ${cap / 1024}K is LOOSER than its documented margin — measured `
        + `${K(injected)} × ${RING_CEILING_FACTOR} rounded up to the whole KB is ${bound / 1024}K `
        + '(§2.7, §5.2 D12(d)); tighten the cap to the formula, never the formula to the cap');
    }
    if (cap < injected) {
      p(`(d) ${v}: the ring payload is ${K(injected)} and the ceiling is ${cap / 1024}K — over budget`);
    }
  }

  // -- (e) THE WALL, AGAINST R2's PRE-REGISTERED 300 s --------------------------------------------
  if (meta.wallBudget !== WALL_BUDGET) {
    p(`(e) meta.wallBudget is ${meta.wallBudget}, and R2 pre-registers ${WALL_BUDGET} s — derived as `
      + '2 × 113 × 9/7 ≈ 291 rounded up, not chosen. A budget edited in the artifact is the silent '
      + 'widening R2 names by name');
  }
  if (!(typeof meta.wallSec === 'number' && isFinite(meta.wallSec) && meta.wallSec > 0)) {
    p(`(e) meta.wallSec is ${meta.wallSec} — the measured wall is what this clause judges, and it is `
      + 'stored (blanked in --check, the equilibrium buildMs precedent) precisely so that it can be');
  } else {
    readings.push(`wall ${meta.wallSec}s / ${meta.wallBudget}s`);
    if (meta.wallSec > meta.wallBudget) {
      p(`(e) the measured two-seed wall is ${meta.wallSec}s against R2's pre-registered `
        + `${meta.wallBudget}s — ${(meta.wallSec / meta.wallBudget).toFixed(1)}x over. R2's remedy is to `
        + 'halve the LATTICE trials for the ring only and never to drop a seed; if that still exceeds '
        + 'the budget it is a blocker, not a widening. Measured cause: §2.4 derived the budget from '
        + 'cost scaling linearly in villain count, which holds for runMulti (7→9 costs 1.16x) and '
        + 'fails for runMultiFiltered (5.6x), whose blocked-pool fallback rate at v=25 rises from '
        + '0.029% to 5.744% and burns RANGE_TRIES=4000 rejections per fallback');
    }
  }

  return { problems, readings };
}

export function build(ctx) {
  const { G } = ctx;
  return {
    sections: [
      {
        ids: ['D12'],
        label: 'the ring artifact: provenance, agreement, budget, wall',
        run: () => {
          const path = resolve(ROOT, ARTIFACT);
          if (!existsSync(path)) {
            /* FAIL CLOSED, as D10 does for a missing artifact: an absent ring is every nine-seat
               setting above N = 7 reading nothing at all. */
            G('D12', false, `${ARTIFACT} is not there — generate it with \`node ${GENERATOR}\``);
            return;
          }
          const raw = readFileSync(path, 'utf8');
          let body;
          try { body = JSON.parse(raw); } catch (e) { G('D12', false, `${ARTIFACT} is not JSON — ${e.message}`); return; }
          const live = { generator: sourceHash(), kernel: kernelHash() };
          const budgets = {};
          for (const v of VARIANT_NAMES) budgets[v] = VARIANTS[v] && VARIANTS[v].budgets;
          const { problems, readings } = ringProblems(body, raw, live, budgets);
          const detail = `${readings.join(' · ')}`
            + (problems.length ? ` — ${problems.length} problem(s): ${problems.slice(0, 3).join('; ')}` : '')
            + `. The byte-compare itself is \`node ${GENERATOR} --check\`, at the close-out beside the `
            + 'matrix and equilibrium checks (about five minutes; verify\'s whole wall is 41.9 s)';
          G('D12', problems.length === 0, detail);
        },
      },
    ],
  };
}
