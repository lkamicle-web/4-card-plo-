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
// (e) JUDGES A BUDGET THAT WAS RE-DERIVED AFTER ITS FIRST DERIVATION WAS FALSIFIED
// ------------------------------------------------------------------------------------------------
// R2 originally pre-registered 300 s, derived as `2 × 113 × 9/7 ≈ 291` from the shipped pipeline's
// two NMAX-scaling stages on the assumption that cost scales about linearly in villain count.
// Measured at stage S2 (run 1), that assumption is TRUE for the random-villain kernel (7 -> 9 costs
// 1.16x) and FALSE for the filtered one (6.2x per cell, 5.9x end to end), because
// `runMultiFiltered` rejection-samples the VPIP pool against an increasingly blocked deck: at
// v = 25 the blocked-pool fallback rate rises from 0.029% at seven villains to 5.744% at nine — a
// 198-fold increase — and every fallback burns the full `RANGE_TRIES` = 4,000 rejection budget
// before giving up. Run 1 measured 1,213.6 s at four workers, showed R2's halving remedy reaches
// only ~622 s and eight workers only 660.8 s, and filed the blocker R2 asks for; nothing was
// widened by any stage. The OWNER then re-derived the pre-registration from the measured cost
// model, in the same shape as the derivation it replaces (V4-PLAN §2.4 and rule R2, both amended in
// place with the falsified derivation kept as written):
//
//     2 × (12 × 1.16 + 101 × 6.2) ≈ 1,280 s      four workers — the derivation's own regime
//
// So this clause asserts `meta.wallBudget` against `ring.mjs`'s `WALL_BUDGET` — a budget edited in
// the artifact rather than in the code is exactly the silent widening R2 names — and the measured
// wall against that budget, failing closed on either. Worker count cannot move a number
// (METHODOLOGY :2798), so re-measuring at eight workers is a wall-clock trade and never a way to
// pass this clause.
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
import { ceilingBound, CEILING_MARGINS } from './data.mjs';
import { seOfTrials } from '../lib/policy.mjs';
import { VARIANTS, VARIANT_NAMES } from '../lib/variant.mjs';
import {
  ARTIFACT, GENERATOR, SEEDS, RING_NMAX, WALL_BUDGET, OUTLIER_SIGMA,
  sourceHash, kernelHash, contentHashOf, bandsFor,
} from '../lib/ring.mjs';

export const family = 'ring-artifact';
export const title = 'the ring artifact — data/ring.json (D12)';
export const ids = ['D12'];
export const setupLabel = 'read data/ring.json and recompute its source and content hashes';

/* THE INJECTED FORM IS ONE DEFINITION AND IT LIVES IN `scripts/lib/variant.mjs` (S3). Lane R wrote
   it here as `const RING = …`, the `eq` payload's own idiom; at integration that identifier was
   measured to collide with `src/shell.html`'s own `var RING = null` — a global `const` against a
   `var` is a SyntaxError, and a `window.RING` is nulled before the page reads it — so the shipped
   form assigns `MODEL.ring`, the seam docs/spikes/V4-ladder.md specified. What matters to this
   clause is that the string it MEASURES is the string the build EMITS, which is why it is imported
   rather than restated: the size ceiling would otherwise bound a payload the artifact never
   carried. Re-exported so lane R's tests keep reading it by this name. */
export { ringInjectedForm as injectedForm } from '../lib/variant.mjs';
import { ringInjectedForm as injectedForm } from '../lib/variant.mjs';

/* measured × 1.05, whole KB — §2.7's rule for the ring row, and `data.mjs`'s own helper.
   TAKEN FROM D6's OWN TABLE SINCE STAGE S4's RED TEAM (docs/refutations/V4.md), where it was the
   one pin nothing pinned: three refuters of three moved it 1.05 -> 1.60 and every gate and all 25
   `test/ring-gate.test.mjs` tests stayed green (the test computes the bound FROM the constant), so
   the ring cap could then have been raised to 29K with D12(d) calling it "inside its documented
   margin" — the exact move (d)'s own message forbids ("tighten the cap to the formula, never the
   formula to the cap"). It also sits OUTSIDE `meta.generatorHash`, so unlike SEEDS, WALL_BUDGET,
   RING_NMAX and OUTLIER_SIGMA it could be edited without (a) reporting STALE. Every D6 margin is
   held to a quoted phrase at a cited line by `citationProblems`; the ring row now inherits the
   block margin's factor and its citations rather than carrying a second, uncited copy of 1.05. */
export const RING_CEILING_FACTOR = CEILING_MARGINS.blocks.factor;

const K = (b) => `${(b / 1024).toFixed(1)}K`;

/**
 * The whole of D12, as a pure function of what it is handed, so a test can fabricate a violator for
 * every clause and watch the gate refuse it. Nothing here reads the disk.
 *
 * @param {object} body the parsed artifact
 * @param {string} raw its bytes, for the injected-size measurement
 * @param {{generator:string, kernel:string}} live the working tree's hashes
 * @param {object} budgets `{ lite: VARIANTS.lite.budgets, full: ... }`
 * @param {object} [modelCells] `data/model.json`'s `cells`, for the cross-artifact seam clause;
 *   omitted, the seam is not judged, which is why `build()` always passes it.
 * @param {object} [modelMeta] `data/model.json`'s `meta`, for the `orderHash` clause — same shape of
 *   seam and the same reason it is optional: omitted, that clause is not judged, and `build()`
 *   always passes it.
 * @returns {{problems:string[], readings:string[]}}
 */
export function ringProblems(body, raw, live, budgets, modelCells, modelMeta) {
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
  } else if (meta.trials && meta.trials.cell > 0 && meta.trials.latt > 0) {
    /* THE SE IS THE TRIAL COUNT'S, NOT THE FILE'S OPINION OF ITSELF — ADDED AT STAGE S4's RED TEAM
       (docs/refutations/V4.md). Every band in D12 is derived from `meta.se`, and `meta.se` was
       checked only for `> 0`: three refuters moved `se.cell` 0.16 -> 0.40 with `meta.band`
       recomputed consistently and shipped a 2.5x-wider outlier line green, and halved
       `meta.trials.latt` with `se.latt` doubled with nothing anywhere noticing — so the clause whose
       stated purpose is "catches a trial count that is not what the file says it is" did not.
       `se = 50/sqrt(trials)` at the published 2-dp rounding is the identity `policy.seOfTrials`
       exports, `generate-data.mjs` writes the model's own `se` by and `generate-ring.mjs` writes
       this artifact's by, so it is re-derived here rather than trusted. R2's halve-the-lattice
       fallback stays legal: halved trials must simply carry the se they imply. */
    for (const k of ['cell', 'latt']) {
      const want = +seOfTrials(meta.trials[k]).toFixed(2);
      if (!Object.is(meta.se[k], want)) {
        p(`(b) meta.se.${k} is ${meta.se[k]} and ${meta.trials[k]} trials give 50/sqrt(n) = ${want} — `
          + 'the standard error and the trial count in this file describe different measurements, and '
          + 'every band D12 judges by is derived from the first');
      }
    }
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
          + `${bad.slice(0, 4).join(', ')} — at ${OUTLIER_SIGMA}σ the Gaussian family-wise false-alarm `
          + 'rate over this artifact\'s 2,337 comparisons is 6.7e-4 one-sided / 1.34e-3 two-sided, so '
          + 'this is a broken measurement, not an unlucky one');
      }
      /* THE SUMMARY AND THE PER-CELL RECORD MUST BE THE SAME MEASUREMENT — ADDED AT STAGE S4's RED
         TEAM (docs/refutations/V4.md). `meta.<name>.worst*` and `agree.<name>` are both written by
         the generator and were read back independently: a refuter replaced the whole `agree` array
         with 0.01s, flatly contradicting the `worst 3.72σ / 3.75σ` the same file reports two lines
         above, and D12 passed. They are two views of one number and are now made to agree — the
         per-cell array is scored in `seDiff` for an eq column and in `seDiffDelta` for a vDelta one
         (`meta.agreeOrder` says so), so the recorded worst, divided by whichever unit its own column
         carries, must be the maximum of the array. This is a three-line consistency check inside the
         41-second gate, not a re-measurement: only `generate-ring.mjs --check` re-measures. */
      if (Array.isArray(agree) && agree.length && typeof s.worst === 'number' && bands) {
        const top = Math.max(...agree);
        const asEq = s.worst / bands.seDiff, asDelta = s.worst / bands.seDiffDelta;
        if (Math.abs(top - asEq) > 0.011 && Math.abs(top - asDelta) > 0.011) {
          p(`(${clause}) meta.${name} records worst ${s.worst} pt and the per-cell agree.${name} tops out `
            + `at ${top} — in this file's own units that worst is ${asEq.toFixed(2)} (eq column) or `
            + `${asDelta.toFixed(2)} (vDelta column), so the summary and the record it summarises are `
            + 'not the same measurement');
        }
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

  /* (c) THE INPUT THE VILLAIN POOLS WERE BUILT FROM, MADE CHECKABLE — ADDED AT STAGE S4's RED TEAM
     (docs/refutations/V4.md). `meta.model.hash` and `meta.model.orderHash` were BOTH inert: three
     refuters of three fabricated them (64 zeros, '0000000000000000') and every D12 clause passed,
     because only `meta.model.nMax` was ever read — so the artifact could claim to have been measured
     against a model whose ordering it never saw, and only `generate-ring.mjs --check`'s 21-minute
     byte-compare would say otherwise. `orderHash` is the NARROW stamp — the shipped villain order,
     which is what the pools are actually built from — and unlike the whole-file `hash` it does not
     move when `verify` restamps `model.gates`, so it can be asserted on every run at no cost. The
     whole-file `hash` is deliberately NOT asserted here: it moves on any §0.4-authorised stamp into
     data/model.json and forces a ~21-minute re-generation that changes not one measured column,
     which is the finding S5 documents rather than a check to arm. */
  if (modelMeta && meta.model && meta.model.orderHash !== modelMeta.orderHash) {
    p(`(c) meta.model.orderHash is ${JSON.stringify(meta.model.orderHash)} and data/model.json's own `
      + `meta.orderHash is ${JSON.stringify(modelMeta.orderHash)} — the ring's villain pools were built `
      + 'from a different shipped order than the one this model carries, which is exactly the join '
      + '`eqAtSeats` makes and neither file can check alone');
  }

  // -- (c) THE RING IS BESIDE THE MODEL, NOT INSIDE IT ---------------------------------------------
  if (meta.model && meta.model.nMax !== 7) {
    p(`(c) meta.model.nMax is ${meta.model.nMax}: the ring records the model as measured at a width `
      + 'that is not 7, which would mean cells[*].eq had been re-measured — §0.4 forbids exactly that');
  }

  /* (c) THE SEAM, WHICH IS THE CHECK NEITHER ARTIFACT CAN MAKE ALONE. `eqAtSeats` joins
     `model.json`'s N <= 7 to the ring's N = 8, 9, and nothing INSIDE either file can tell whether
     the two halves line up: a ring measured against a different pool, a stale kernel, or a column
     read off by one all leave both files internally consistent and the JOIN wrong. Equity cannot
     rise with the field size, so the model's N = 7 must sit at or above the ring's N = 8 on every
     cell, at ZERO tolerance — the same discipline as the eq[9] <= eq[8] clause above, applied
     across the artifact boundary. Measured worst margin is ~3 sigma of seDiff, so this is not a
     marginal call. `test/ring.test.mjs` asserts it on the shipped pair as well; the gate is what
     makes it fail closed on every verify. */
  if (modelCells && keys.length) {
    /* -Infinity, NOT 0: every margin is negative on a correct ring, so a zero seed would report
       "0.000" — a number that reads like the tightest cell sits exactly on the line — instead of
       the real worst margin. The reading is the evidence that the seam is not marginal, so it has
       to be the measurement and not the initialiser. */
    let seamBad = 0, worstSeam = -Infinity, worstAt = '';
    for (const key of keys) {
      const c = cells[key];
      const mc = modelCells[key];
      if (!mc || !Array.isArray(mc.eq) || mc.eq.length < 7 || !Array.isArray(c.eq) || c.eq.length !== 2) continue;
      const step = c.eq[0] - mc.eq[6];             // ring N = 8 minus model N = 7
      if (step > worstSeam) { worstSeam = step; worstAt = key; }
      if (step > 0) {
        seamBad++;
        if (seamBad <= 2) {
          p(`(c) SEAM ${key}: the ring's N=8 ${c.eq[0]} sits ABOVE the model's N=7 ${mc.eq[6]} — `
            + 'equity cannot rise with the field size across the join eqAtSeats makes, and neither '
            + 'file can catch this on its own');
        }
      }
    }
    if (seamBad) p(`(c) ${seamBad} cell(s) break the N=7 → N=8 seam between the two artifacts`);
    if (isFinite(worstSeam)) {
      readings.push(`seam worst ${worstSeam <= 0 ? '' : '+'}${worstSeam.toFixed(3)} pt at ${worstAt} `
        + '(must be ≤ 0)');
    } else {
      /* no cell was comparable at all — the ring and the model share no key, which is a different
         failure from a seam that rises and is worth saying rather than reporting a blank margin. */
      p('(c) not one ring cell has a comparable model cell — the seam cannot be judged at all');
    }
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

  // -- (e) THE WALL, AGAINST R2's PRE-REGISTERED 1,280 s ------------------------------------------
  if (meta.wallBudget !== WALL_BUDGET) {
    p(`(e) meta.wallBudget is ${meta.wallBudget}, and R2 as amended pre-registers ${WALL_BUDGET} s — `
      + 'derived as 2 × (12 × 1.16 + 101 × 6.2) from the MEASURED per-kernel cost model, not chosen; '
      + 'the original 2 × 113 × 9/7 ≈ 291 is falsified and kept as written. A budget edited in the '
      + 'artifact is the silent widening R2 names by name');
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
        + 'the budget it is a blocker, not a widening. The budget already carries the measured cost '
        + 'model (runMulti 1.16x, runMultiFiltered 6.2x, whose blocked-pool fallback rate at v=25 '
        + 'rises from 0.029% to 5.744% and burns RANGE_TRIES=4000 rejections per fallback), so a run '
        + 'over it is a NEW cost this run has not explained — measure the cause, never the flag');
    }
  }

  return { problems, readings };
}

export function build(ctx) {
  const { G } = ctx;   // `ctx.model` is read below for the cross-artifact seam clause
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
          const { problems, readings } = ringProblems(body, raw, live, budgets, ctx.model && ctx.model.cells,
            ctx.model && ctx.model.meta);
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
