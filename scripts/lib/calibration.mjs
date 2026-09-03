// calibration.mjs — the calibration harness (V3-PLAN §3.1 lane C; the plumbing I46 will run).
//
// ============================================================================
//  THIS FILE COMPUTES A VERDICT AND WRITES NOTHING.
//  No constant moves here. No fixture is re-frozen here. `data/model.json` is
//  read-only to every function below, and there is not one fs write in the
//  module — `assertNotAModelPath` exists so the CLI cannot acquire one either.
//  The verdict is Phase 5's to stamp; this lane builds the machine that
//  computes it and proves the machine cannot be talked into the wrong answer.
// ============================================================================
//
// WHAT I46 WILL ASK IT FOR (§7.2):
//
//   (1) harness reproducibility                     -> `harnessSelfCheck`
//   (2) fitted-vs-shipped disagreements ship as
//       `calibration.disputed`, rendered in Method  -> `disputedReport`, `buildCalibrationBlock`
//   (3) the primacy verdict computed ONLY from the
//       Phase-0 pre-registered criteria             -> `evaluatePrimacy`
//
// I46 IS PARKED, AND THIS FILE DOES NOT UNPARK IT. S-C failed: no lawful, hero-visible, assigned
// 4-card PLO corpus exists at any volume, so PC-1, PC-2 and PC-3 cannot be evaluated, and PC-0 is
// failure-closed — a criterion that cannot be evaluated counts as FAIL. `evaluatePrimacy` with no
// corpus therefore returns `fail`, naming which criteria could not be reached and why. That is not
// the harness giving up; it is the harness returning the correct answer to the question as asked.
// `scripts/gates/reserved.mjs` keeps I46's status at `parked` and nothing here changes it,
// because promoting a gate to a form that passes is how a bar gets lowered.
//
// THE ONE FAILURE MODE THIS LANE COULD CREATE, AND THE GUARD AGAINST IT. A calibration harness's
// characteristic bug is a plausible-looking number reaching the verdict: a synthetic fixture
// treated as a corpus, a self-play consistency figure read as bb/100, a showdown-derived mean read
// as an unbiased one. All three are refused STRUCTURALLY rather than by convention:
//
//   * PC-1 reads `knownVia` and fails on any showdown row, at any volume (S-C §2)
//   * PC-2 fails a corpus whose provenance record says `synthetic`, and fails a corpus with NO
//     provenance record at all — the shipped fixture is stamped synthetic on purpose
//   * PC-4 refuses any statistic not stamped `unit: 'bb/100'`, which the self-play run never is
//
// NO GATE IS ADDED BY THIS LANE, ON PURPOSE. §7.2 names exactly one id for calibration and it is
// I46, which B0 step 4 recorded as `parked` — unpassable by construction, for written-down reasons.
// Promoting it now would take one of two forms and both are forbidden: evaluated honestly it
// FAILS, so `verify.mjs` would exit non-zero and the build would not be green; narrowed to the
// clauses that can pass today it would be a gate written to pass, which is the post-hoc
// bar-lowering §5.4 exists to prevent. Inventing a fresh id instead would defeat the point of
// reserving ids at Phase 0. So the harness is bounded by `test/calibration.test.mjs` and
// `test/calibration-hh.test.mjs` — `node --test` is one of the three GREEN checks, and P0 set the
// precedent itself: `test/gates-reserved.test.mjs` pins the catalog boundary with no gate at all.
//
// WHAT P5's PROMOTION LOOKS LIKE, so the parking is a pause and not a dead end:
//
//   1. `scripts/gates/reserved.mjs`  flip I46 `status: 'parked'` -> 'live', drop `unpassable`
//   2. `scripts/gates/index.mjs`     add a `calibration` family to REGISTRY and 'I46' to EXPECTED_IDS
//   3. `scripts/gates/calibration.mjs` (new) asserting, in this order:
//        (a) `harnessSelfCheck(model).ok` — clause (1), reproducibility
//        (b) `evaluatePrimacy(...).verdict === model.calibration.verdict` — the verdict in the
//            shipped data was computed HERE and nowhere else
//        (c) `model.calibration.criteriaDigest === CRITERIA_DIGEST` — the bar that was evaluated
//            is the bar that was pre-registered
//        (d) every `calibration.disputed` entry renders in the Method view (the grep-gate idiom)
//      and the import-time guard in `assertThresholdsArePreRegistered` stops step 3 from landing
//      without step 1.
//
// NO NEW CONSTANTS. PC-5's 0.20 bb/100 and PC-7's 2-SE agreement rule are READ OUT OF the
// pre-registered criteria text and re-checked against it at import (`assertThresholdsArePreRegistered`),
// so they cannot drift from the bar they came from. The 95% multiplier is solved from the normal
// CDF in `calibration-paired.mjs` rather than typed. PC-8's threshold is `2 * model.meta.se.cell`,
// a shipped datum.

import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';

import { I46_CRITERIA, CATALOG } from '../gates/reserved.mjs';
import { scoreOrdering, evOrdering, cutAt, disagreement, selfPlayConsistency, pairedD, Z95,
  normalCdf } from './calibration-paired.mjs';
import { parseCorpus, KNOWN_VIA } from './calibration-hh.mjs';
import { aggregate, coverage, sufficiency } from './calibration-cells.mjs';
import { FIXTURE, PROVENANCE as FIXTURE_PROVENANCE } from './calibration-fixture.mjs';

export const PC_IDS = Object.freeze(['PC-1', 'PC-2', 'PC-3', 'PC-4', 'PC-5', 'PC-6', 'PC-7', 'PC-8']);

/** the three statuses a criterion can hold. `unevaluable` is a FAIL under PC-0, never a pass. */
export const PC_STATUS = Object.freeze(['pass', 'fail', 'unevaluable']);

/** the unit PC-4 is written in. Anything else is not the statistic PC-4 describes. */
export const PC4_UNIT = 'bb/100';

// ---------------------------------------------------------------------------
// the thresholds, read back out of the pre-registered text
// ---------------------------------------------------------------------------

/** PC-5's precision floor, in bb/100 */
export const PC5_SE_MAX = 0.20;
/** PC-7's half-agreement rule, in standard errors of the difference */
export const PC7_HALF_AGREEMENT_SE = 2;
/** PC-8's substance rule, in multiples of the shipped `meta.se.cell` */
export const PC8_SE_MULTIPLE = 2;

/**
 * The three numbers above are quotations, not decisions, and this proves it at import time.
 *
 * V3-PLAN §6 lists "calibration tolerances" as "pre-registered at Phase 0 from S-C's power
 * analysis" — so a tolerance that appears in this file and NOT in the pre-registered text would be
 * a new constant smuggled in under an old name. Grepping the criteria for each literal is the
 * cheapest way to make that impossible; it is the same grep-gate idiom §6 uses for the on-screen
 * cap list. Edit either copy alone and the module refuses to load.
 */
function assertThresholdsArePreRegistered() {
  const want = [
    ['PC-5', `SE(D) <= ${PC5_SE_MAX.toFixed(2)} bb/100`],
    ['PC-7', `within ${PC7_HALF_AGREEMENT_SE} SE of their difference`],
    ['PC-8', `exceeding ${PC8_SE_MULTIPLE} * meta.se.cell`],
  ];
  for (const [id, phrase] of want) {
    if (!I46_CRITERIA.includes(phrase)) {
      throw new Error(`calibration: ${id}'s threshold is not in the pre-registered criteria — `
        + `expected the phrase ${JSON.stringify(phrase)} in I46_CRITERIA. A tolerance this file `
        + 'carries that the bar does not is a new constant, not a quotation.');
    }
  }
  const parked = CATALOG.find((e) => e.id === 'I46');
  if (!parked || parked.status !== 'parked') {
    throw new Error('calibration: I46 is no longer parked in scripts/gates/reserved.mjs. The '
      + 'harness is written for a parked bar; promoting it is a P5 ceremony, not an import.');
  }
}
assertThresholdsArePreRegistered();

/** the criteria's own digest — carried into `model.calibration` so the shipped bar is identifiable */
export const CRITERIA_DIGEST = digest(I46_CRITERIA);

// ---------------------------------------------------------------------------
// digests, for the reproducibility clause
// ---------------------------------------------------------------------------

/** deterministic JSON: object keys sorted, so a digest is a digest of VALUES, not of key order */
export function canonicalJson(value) {
  const walk = (v) => {
    if (v === null || typeof v !== 'object') {
      return typeof v === 'number' && !Number.isFinite(v) ? String(v) : v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v instanceof Map) return { '@map': [...v.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, x]) => [k, walk(x)]) };
    if (v instanceof Set) return { '@set': [...v].sort() };
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = walk(v[k]);
    return out;
  };
  return JSON.stringify(walk(value));
}

export function digest(value) {
  const s = typeof value === 'string' ? value : canonicalJson(value);
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// the write guard
// ---------------------------------------------------------------------------

/**
 * Refuse any path this lane must never write.
 *
 * `scripts/freeze-tiers.mjs` is the SOLE fixture writer (HOUSE RULES) and `data/model.json` is
 * generated by `scripts/generate-data.mjs`. A calibration harness that can write either is one
 * refactor away from being a calibration harness that DOES, and the plan's identity constraint
 * (§0.4) would then be violated by a file nobody thought to look at. So the refusal is a function,
 * it is exported, and `scripts/parse-hh.mjs` calls it on every `--out`.
 */
export function assertNotAModelPath(p, root) {
  const abs = resolve(p);
  const dataDir = resolve(root || process.cwd(), 'data') + sep;
  if (abs.startsWith(dataDir)) {
    throw new Error(`calibration: refusing to write inside data/ (${abs}). The harness reports; `
      + 'generate-data.mjs writes the model and freeze-tiers.mjs is the sole fixture writer.');
  }
  if (/\.fixture\.txt$/.test(abs)) {
    throw new Error(`calibration: refusing to write a tier fixture (${abs}). freeze-tiers.mjs is `
      + 'the sole fixture writer (HOUSE RULES).');
  }
  return abs;
}

// ---------------------------------------------------------------------------
// corpora
// ---------------------------------------------------------------------------

/**
 * Wrap parsed rows into the thing `evaluatePrimacy` will accept as a corpus.
 *
 * `provenance` is REQUIRED and is not inferred. A corpus that arrives without one is a corpus
 * nobody wrote down the provenance of, which is exactly what PC-2 forbids, and guessing it here
 * would be the harness making the claim on the operator's behalf.
 */
export function makeCorpus(rows, provenance, opts = {}) {
  const list = Array.isArray(rows) ? rows : [];
  let hero = 0, showdown = 0;
  for (const r of list) { if (r.knownVia === 'hero') hero++; else showdown++; }
  return Object.freeze({
    rows: Object.freeze(list.slice()),
    provenance: provenance ? Object.freeze({ ...provenance }) : null,
    assignment: opts.assignment ? Object.freeze({ ...opts.assignment }) : null,
    declaredBeforeEv: opts.declaredBeforeEv === true,
    timeSplit: opts.timeSplit ? Object.freeze({ ...opts.timeSplit }) : null,
    heroRows: hero,
    showdownRows: showdown,
    digest: digest(list.map((r) => [r.handId, r.pos, r.cell, r.knownVia, r.netBB])),
  });
}

/**
 * The shipped fixture, parsed. Available to every caller so the harness is exercisable with no
 * corpus — and inadmissible, loudly, so it can never become one.
 */
export function fixtureCorpus() {
  const parsed = parseCorpus(FIXTURE);
  return { parsed, corpus: makeCorpus(parsed.rows, FIXTURE_PROVENANCE) };
}

// ---------------------------------------------------------------------------
// PC-8 — the one criterion that is evaluable today
// ---------------------------------------------------------------------------

/**
 * PC-8, SUBSTANCE. "Of the cell pairs the EV ordering transposes relative to the score ordering,
 * more than half must have a shipped HU equity gap exceeding 2 * meta.se.cell."
 *
 * This is the only pre-registered criterion that needs no corpus: it is a statement about the two
 * orderings and the shipped measurement's own error bar, both of which exist. So it is EVALUATED,
 * not parked, and its answer ships whatever it is. S-C §5 predicted the shape of the result —
 * 87 of 122 adjacent pairs (71%) are separated by less than 2*se, "already inseparable by the
 * measurement RUNDOWN ships, before money and its ~100x larger noise enter" — and this function is
 * where that prediction meets the actual transposed set rather than the adjacent one.
 *
 * IT READS `eq[0]` DIRECTLY, AND THAT IS NOT AN I33(e) VIOLATION. Clause (e) forbids a payoff
 * CONSUMER reading a payoff table instead of calling `payoff()`. PC-8 is not a payoff question: it
 * asks whether a transposed pair's SHIPPED HU EQUITY GAP exceeds twice the error bar on that same
 * shipped measurement (`meta.se.cell`). Routing it through `payoff()` would return the zero-sum
 * projection rather than the measurement, and the criterion would then be comparing one quantity
 * against another quantity's error bar. The ORDERING goes through the interface (`evOrdering`);
 * the measurement comparison reads the measurement, because that is what was pre-registered.
 */
export function pc8Substance(model, opts = {}) {
  const score = opts.score || scoreOrdering(model, opts);
  const ev = opts.ev || evOrdering(model, { ...opts, base: score });
  const seCell = model.meta?.se?.cell;
  if (!(typeof seCell === 'number' && seCell > 0)) {
    return Object.freeze({ status: 'unevaluable', reason: 'model.meta.se.cell is absent' });
  }
  const threshold = PC8_SE_MULTIPLE * seCell;

  const scoreRank = new Map(score.keys.map((k, i) => [k, i]));
  const evRank = new Map(ev.keys.map((k, i) => [k, i]));
  const keys = score.keys.filter((k) => evRank.has(k));

  let transposed = 0, substantive = 0;
  const examples = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i], b = keys[j];
      const sA = scoreRank.get(a), sB = scoreRank.get(b);
      const eA = evRank.get(a), eB = evRank.get(b);
      if ((sA < sB) === (eA < eB)) continue;          // same relative order: not transposed
      transposed++;
      const gap = Math.abs(model.cells[a].eq[0] - model.cells[b].eq[0]);
      if (gap > threshold) substantive++;
      else if (examples.length < 8) examples.push({ a, b, gap: Number(gap.toFixed(3)) });
    }
  }
  const frac = transposed === 0 ? null : substantive / transposed;
  return Object.freeze({
    status: transposed === 0 ? 'fail' : (frac > 0.5 ? 'pass' : 'fail'),
    transposed,
    substantive,
    fraction: frac,
    threshold,
    seCell,
    insideTheErrorBars: Object.freeze(examples),
    reason: transposed === 0
      ? 'the two orderings transpose no pair at all — a re-ordering that re-orders nothing'
      : `${substantive}/${transposed} transposed pairs exceed 2*se.cell = ${threshold.toFixed(3)} equity points`,
  });
}

// ---------------------------------------------------------------------------
// PC-0 .. PC-8
// ---------------------------------------------------------------------------

function crit(id, status, detail) {
  if (!PC_STATUS.includes(status)) throw new Error(`calibration: bad status ${status} for ${id}`);
  return Object.freeze({ id, status, detail });
}

/**
 * THE VERDICT MACHINE. Every route to 'pass' runs through here, and there is no other.
 *
 * PC-0, verbatim: "model.calibration.verdict may be stamped 'pass' only if PC-1..8 all hold
 * simultaneously on one corpus declared before any EV number is computed. A criterion that cannot
 * be evaluated counts as FAIL. No 'not applicable', no partial credit."
 *
 * Which is implemented literally: `verdict = criteria.every(c => c.status === 'pass') ? 'pass'
 * : 'fail'`, with `unevaluable` deliberately not special-cased anywhere. The function takes no
 * override argument, no `force`, and no options that can raise a criterion's status. If a caller
 * wants a different verdict it has to bring a different corpus.
 *
 * @param {object} input
 * @param {object} input.model      the shipped model (read-only)
 * @param {object} [input.corpus]   from `makeCorpus`; absent means PC-1..PC-3 are unevaluable
 * @param {object} [input.statistic] PC-4's result: { unit, D, se, ci95, mass, paired }
 * @param {object} [input.halves]   PC-7's two half-estimates: { first, second }
 */
export function evaluatePrimacy(input = {}) {
  const { model, corpus = null, statistic = null, halves = null } = input;
  const out = [];

  // ---- PC-1  ADMISSIBLE VISIBILITY --------------------------------------
  if (!corpus) {
    out.push(crit('PC-1', 'unevaluable', 'no corpus: there is nothing whose visibility to check'));
  } else if (corpus.rows.length === 0) {
    out.push(crit('PC-1', 'unevaluable', 'the corpus has no rows'));
  } else if (corpus.showdownRows > 0) {
    out.push(crit('PC-1', 'fail', `${corpus.showdownRows} of ${corpus.rows.length} rows are `
      + 'showdown-revealed; showdown visibility is outcome-selected and inadmissible at any volume'));
  } else {
    out.push(crit('PC-1', 'pass', `all ${corpus.heroRows} rows carry knownVia='hero'`));
  }

  // ---- PC-2  ADMISSIBLE PROVENANCE --------------------------------------
  const prov = corpus?.provenance;
  if (!corpus) {
    out.push(crit('PC-2', 'unevaluable', 'no corpus'));
  } else if (!prov) {
    out.push(crit('PC-2', 'unevaluable', 'the corpus carries no provenance record; PC-2 cannot be '
      + 'evaluated and is therefore a FAIL under PC-0'));
  } else if (prov.synthetic) {
    out.push(crit('PC-2', 'fail', `${prov.name || 'the corpus'} is synthetic: nobody played these `
      + 'hands, so there is no lawful holding and no result to calibrate against'));
  } else if (prov.observed) {
    out.push(crit('PC-2', 'fail', 'observed/datamined hands are inadmissible regardless of volume'));
  } else if (prov.lawfullyHeld !== true || !prov.name || prov.reobtainable !== true) {
    out.push(crit('PC-2', 'fail', 'a corpus must be lawfully held, nameable in METHODOLOGY, and '
      + 're-obtainable by a reader'));
  } else {
    out.push(crit('PC-2', 'pass', `${prov.name}: lawfully held, named, re-obtainable`));
  }

  // ---- PC-3  ASSIGNMENT --------------------------------------------------
  const asg = corpus?.assignment;
  if (!corpus) {
    out.push(crit('PC-3', 'unevaluable', 'no corpus'));
  } else if (!asg) {
    out.push(crit('PC-3', 'unevaluable', 'no assignment record: under an unknown behaviour policy '
      + 'the EV of an action nobody took is not in the data (S-C §7.5)'));
  } else if (asg.randomisedAtCellLevel === true) {
    out.push(crit('PC-3', 'pass', 'arms randomised at cell level'));
  } else if (asg.behaviourPolicyKnown === true && Number.isFinite(asg.effectiveSampleSize)) {
    out.push(crit('PC-3', 'pass', `known behaviour policy, importance-weighted, ESS ${asg.effectiveSampleSize}`));
  } else {
    out.push(crit('PC-3', 'fail', 'assignment is neither randomised nor a known, weighted policy'));
  }

  // ---- PC-4  THE STATISTIC ----------------------------------------------
  const s = statistic;
  if (!s) {
    out.push(crit('PC-4', 'unevaluable', 'no statistic: D was never computed'));
  } else if (s.unit !== PC4_UNIT) {
    out.push(crit('PC-4', 'fail', `the statistic is in ${JSON.stringify(s.unit)}, not ${PC4_UNIT}. `
      + 'PC-4 is about bb won; a self-play or pot-fraction figure is not that quantity'));
  } else if (s.paired !== true) {
    out.push(crit('PC-4', 'fail', 'the statistic is not the paired, same-stream estimator PC-4 specifies'));
  } else if (!Number.isFinite(s.D) || !Number.isFinite(s.se)) {
    out.push(crit('PC-4', 'fail', 'D or SE(D) is not a finite number'));
  } else {
    out.push(crit('PC-4', 'pass', `D = ${s.D} bb/100, SE = ${s.se}, disagreement mass ${s.mass}`));
  }

  const haveD = out[3].status === 'pass';

  // ---- PC-5  PRECISION ---------------------------------------------------
  if (!haveD) out.push(crit('PC-5', 'unevaluable', 'no admissible D to bound'));
  else if (s.se <= PC5_SE_MAX) out.push(crit('PC-5', 'pass', `SE(D) = ${s.se} <= ${PC5_SE_MAX}`));
  else out.push(crit('PC-5', 'fail', `SE(D) = ${s.se} > ${PC5_SE_MAX} bb/100`));

  // ---- PC-6  SIGN AND SIGNIFICANCE --------------------------------------
  if (!haveD) {
    out.push(crit('PC-6', 'unevaluable', 'no admissible D to test'));
  } else {
    const lo = Array.isArray(s.ci95) ? s.ci95[0] : (s.D - Z95 * s.se);
    out.push(lo > 0
      ? crit('PC-6', 'pass', `95% lower bound ${lo} > 0`)
      : crit('PC-6', 'fail', `95% lower bound ${lo} does not clear zero`));
  }

  // ---- PC-7  REPLICATION -------------------------------------------------
  if (!haveD || !halves || !halves.first || !halves.second) {
    out.push(crit('PC-7', 'unevaluable', 'no declared time split with two half-estimates'));
  } else if (corpus && corpus.timeSplit && corpus.timeSplit.declaredBeforeEv !== true) {
    out.push(crit('PC-7', 'fail', 'the time split was not declared before an EV number existed'));
  } else {
    const a = halves.first, b = halves.second;
    const loA = Array.isArray(a.ci95) ? a.ci95[0] : a.D - Z95 * a.se;
    const loB = Array.isArray(b.ci95) ? b.ci95[0] : b.D - Z95 * b.se;
    const seDiff = Math.sqrt(a.se * a.se + b.se * b.se);
    const agree = Math.abs(a.D - b.D) <= PC7_HALF_AGREEMENT_SE * seDiff;
    out.push(loA > 0 && loB > 0 && agree
      ? crit('PC-7', 'pass', `both halves clear zero and agree within ${PC7_HALF_AGREEMENT_SE} SE`)
      : crit('PC-7', 'fail', `halves: lower bounds ${loA} / ${loB}; |diff| ${Math.abs(a.D - b.D)} `
        + `vs ${PC7_HALF_AGREEMENT_SE} SE = ${PC7_HALF_AGREEMENT_SE * seDiff}`));
  }

  // ---- PC-8  SUBSTANCE ---------------------------------------------------
  const pc8 = model ? pc8Substance(model, input.orderings || {}) : { status: 'unevaluable', reason: 'no model' };
  out.push(crit('PC-8', pc8.status, pc8.reason));

  // ---- PC-0  CONJUNCTIVE, FAILURE-CLOSED --------------------------------
  const verdict = out.every((c) => c.status === 'pass') ? 'pass' : 'fail';
  return Object.freeze({
    verdict,
    failureClosed: true,
    criteria: Object.freeze(out),
    passed: Object.freeze(out.filter((c) => c.status === 'pass').map((c) => c.id)),
    failed: Object.freeze(out.filter((c) => c.status === 'fail').map((c) => c.id)),
    unevaluable: Object.freeze(out.filter((c) => c.status === 'unevaluable').map((c) => c.id)),
    criteriaDigest: CRITERIA_DIGEST,
    pc8: Object.freeze(pc8),
    rule: 'PC-0: pass only if PC-1..8 all hold; a criterion that cannot be evaluated counts as FAIL',
  });
}

// ---------------------------------------------------------------------------
// calibration.disputed
// ---------------------------------------------------------------------------

/**
 * The `calibration.disputed` idiom (§3.5, §7.2): every fitted-vs-shipped disagreement is REPORTED,
 * and none is written into the model.
 *
 * The precedent is `benchmarks.disputed` — the repository already ships the places where an outside
 * number disagrees with its own, rather than quietly adopting one of them. This function is the
 * whole mechanism: give it what ships and what a fit produced, get back the disagreements, sorted,
 * with a z-score where an error bar exists. It has no third mode in which it applies anything.
 *
 * The prediction §7.2 records for I46 is "fitted q != 0.85 — both shipped", so the expected steady
 * state of this list is NON-EMPTY. An empty `disputed` because no fit was run is a different fact
 * from an empty `disputed` because everything agreed, and `buildCalibrationBlock` says which.
 */
export function disputedReport(shipped, fitted, opts = {}) {
  const se = opts.se || {};
  const tol = Number.isFinite(opts.tolerance) ? opts.tolerance : 0;
  const out = [];
  for (const name of Object.keys(fitted || {}).sort()) {
    const f = fitted[name];
    const shipVal = shipped ? shipped[name] : undefined;
    if (shipVal === undefined) {
      out.push({ name, shipped: null, fitted: f, delta: null, z: null,
        note: 'fitted a quantity the model does not ship' });
      continue;
    }
    if (typeof f !== 'number' || typeof shipVal !== 'number') {
      if (canonicalJson(f) !== canonicalJson(shipVal)) {
        out.push({ name, shipped: shipVal, fitted: f, delta: null, z: null, note: 'non-numeric disagreement' });
      }
      continue;
    }
    const delta = f - shipVal;
    if (Math.abs(delta) <= tol) continue;
    const s = se[name];
    out.push({
      name,
      shipped: shipVal,
      fitted: f,
      delta,
      z: (typeof s === 'number' && s > 0) ? delta / s : null,
      note: null,
    });
  }
  out.sort((a, b) => (Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0)) || (a.name < b.name ? -1 : 1));
  return Object.freeze(out.map((e) => Object.freeze(e)));
}

// ---------------------------------------------------------------------------
// I46 clause (1) — harness reproducibility
// ---------------------------------------------------------------------------

/**
 * Run the harness twice, in more than one way, and check it said the same thing.
 *
 * The checks are chosen to fail on the specific ways a pipeline like this stops being
 * reproducible, rather than to be many:
 *
 *   parse-twice      a parser carrying mutable state between runs
 *   parse-chunked    a parser whose answer depends on how the corpus was split into files — the
 *                    realistic shape of a corpus, which arrives as hundreds of session files
 *   aggregate-twice  an aggregator whose bucket order leaks into its output
 *   selfplay-twice   a stream that is not actually seeded
 *   selfplay-seeded  a stream that ignores its seed — the failure the check above cannot see, and
 *                    the one that would make every future "two independent runs agree" claim empty
 *   paired-exact     the estimator against a hand-computed vector, so a change of formula is
 *                    caught by arithmetic rather than by a digest of itself
 *   z95-inverts      the derived 95% multiplier round-trips through the CDF it was solved from
 */
export function harnessSelfCheck(model, opts = {}) {
  const checks = [];
  const add = (name, ok, detail) => checks.push(Object.freeze({ name, ok: !!ok, detail }));

  const a = parseCorpus(FIXTURE);
  const b = parseCorpus(FIXTURE);
  add('parse-twice', digest(a.rows) === digest(b.rows), `${a.rows.length} rows, ${digest(a.rows)}`);

  const blocks = FIXTURE.split(/\n(?=PokerStars )/);
  const half = Math.ceil(blocks.length / 2);
  const c1 = parseCorpus(blocks.slice(0, half).join('\n'));
  const c2 = parseCorpus(blocks.slice(half).join('\n'));
  const chunked = [...c1.rows, ...c2.rows];
  add('parse-chunked', digest(chunked) === digest(a.rows),
    `${blocks.length} blocks split ${half}/${blocks.length - half}`);

  const g1 = aggregate(a.rows, { byPosition: true });
  const g2 = aggregate(b.rows, { byPosition: true });
  add('aggregate-twice', digest(g1.byCell) === digest(g2.byCell), `${g1.byCell.size} cells`);

  const hands = Number.isFinite(opts.hands) ? opts.hands : 5000;
  const s1 = selfPlayConsistency(model, { ...opts, hands, seed: 1 });
  const s2 = selfPlayConsistency(model, { ...opts, hands, seed: 1 });
  const s3 = selfPlayConsistency(model, { ...opts, hands, seed: 2 });
  add('selfplay-twice', digest(s1.statistic) === digest(s2.statistic), `D = ${s1.statistic.D}`);
  add('selfplay-seeded', digest(s1.statistic) !== digest(s3.statistic),
    'seed 2 must not reproduce seed 1, or the stream is not seeded at all');

  // hand-computed: mean 1, sd of [0,0,2,2] is 2/sqrt(3) = 1.1547005383792515
  const p = pairedD([0, 0, 2, 2]);
  const sdOk = Math.abs(p.sd - 2 / Math.sqrt(3)) < 1e-12;
  add('paired-exact', p.D === 1 && sdOk && p.zeros === 2 && p.mass === 0.5,
    `D ${p.D}, sd ${p.sd}, zeros ${p.zeros}`);

  add('z95-inverts', Math.abs(normalCdf(Z95) - 0.975) < 1e-12, `Z95 = ${Z95}`);

  const ok = checks.every((k) => k.ok);
  return Object.freeze({ ok, checks: Object.freeze(checks), criteriaDigest: CRITERIA_DIGEST });
}

// ---------------------------------------------------------------------------
// the shipped block
// ---------------------------------------------------------------------------

/**
 * Build the object P5 will stamp into `model.calibration` and the Method view will render.
 *
 * BUILT, RETURNED, NOT WRITTEN. This lane produces the value; wiring it into `generate-data.mjs`
 * and onto the page is P5's step and lane U's, and doing it here would be a constant moving in a
 * phase whose brief says none may. `verdict` comes from `evaluatePrimacy` and from nowhere else.
 *
 * The REPORTING DUTY at the foot of the criteria is why so much of this survives a FAIL: "Whatever
 * the verdict, D, SE(D), both half-estimates, the disagreement mass, the corpus size and its
 * provenance ship in model.calibration and render in the Method view. A FAIL is shipped as loudly
 * as a pass would have been."
 */
export function buildCalibrationBlock(model, opts = {}) {
  const corpus = opts.corpus || null;
  const statistic = opts.statistic || null;
  const evaluation = evaluatePrimacy({ model, corpus, statistic, halves: opts.halves, orderings: opts.orderings });
  const selfPlay = opts.selfPlay || selfPlayConsistency(model, opts.selfPlayOpts || {});
  const fitted = opts.fitted || null;

  return Object.freeze({
    verdict: evaluation.verdict,
    criteria: I46_CRITERIA,
    criteriaDigest: CRITERIA_DIGEST,
    preRegisteredAt: 'phase 0, docs/spikes/S-C.md §6 — before any EV number existed',
    evaluated: evaluation.criteria,
    unevaluable: evaluation.unevaluable,
    pc8: evaluation.pc8,

    corpus: Object.freeze(corpus ? {
      present: true,
      rows: corpus.rows.length,
      heroRows: corpus.heroRows,
      showdownRows: corpus.showdownRows,
      provenance: corpus.provenance,
      digest: corpus.digest,
    } : {
      present: false,
      rows: 0, heroRows: 0, showdownRows: 0,
      provenance: null,
      reason: 'S-C: no lawful, hero-visible, assigned 4-card PLO corpus exists at any volume',
    }),

    statistic: statistic || null,
    halves: opts.halves || null,

    disputed: fitted ? disputedReport(opts.shipped || {}, fitted, opts) : Object.freeze([]),
    disputedReason: fitted ? null : 'no fit was run: PC-2 admits no corpus to fit against, so this '
      + 'list is empty because nothing was compared, not because everything agreed',

    selfPlay: Object.freeze({
      kind: selfPlay.kind,
      unit: selfPlay.unit,
      moneyValidated: selfPlay.moneyValidated,
      payoffSource: selfPlay.payoffSource,
      hands: selfPlay.hands,
      seed: selfPlay.seed,
      at: selfPlay.at,
      disagreementCells: selfPlay.disagreement.cells,
      disagreementMass: selfPlay.disagreement.mass,
      D: selfPlay.statistic.D,
      se: selfPlay.statistic.se,
    }),

    limitation: 'the decision layer remains unfalsified against money',
    successor: 'a prospective randomised A/B test on the marginal cells, run by a player against '
      + 'their own play — no corpus size fixes PC-3, because the EV of an action nobody took is '
      + 'not in the data. Out of scope for v3 (S-C §7.5).',
    gate: 'I46 (parked): the bar is recorded at full strength and comes alive unchanged the day a '
      + 'lawful, hero-visible, assigned corpus exists.',
  });
}

// re-exported so a caller needs one import to run the whole harness
export { parseCorpus, KNOWN_VIA, aggregate, coverage, sufficiency, selfPlayConsistency, pairedD,
  scoreOrdering, evOrdering, cutAt, disagreement, FIXTURE, FIXTURE_PROVENANCE, I46_CRITERIA };
