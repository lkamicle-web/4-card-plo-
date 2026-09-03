// node --test test/*.test.mjs
//
// The calibration harness — I46's plumbing (V3-PLAN §3.1 lane C, §3.5, §7.2).
//
// I46 IS PARKED. S-C failed, so `evaluatePrimacy` on the shipped state returns FAIL and there is no
// corpus that could make it do otherwise. That makes the obvious test — "the verdict is fail" —
// nearly worthless on its own: a function that returns 'fail' unconditionally passes it, and such a
// function would ALSO fail the day a real corpus arrived, which is the one moment the harness has
// to work. So this file asks both halves of the question:
//
//   CAN IT SAY PASS?   A fabricated, fully conforming corpus + statistic must reach 'pass'. If it
//                      cannot, the harness is a rubber stamp pointing the other way and every
//                      "parked, not lowered" claim in the plan is empty.
//   CAN IT BE FOOLED?  Each criterion is then knocked out one at a time and must flip the verdict.
//                      This is `payoff.test.mjs`'s idiom — fabricate the wrong answer and show the
//                      clause firing — applied to a verdict instead of a number.
//
// The third theme is the one this lane could actually get wrong: LAUNDERING. The self-play run
// produces a real, tempting number in pot fractions, and the failure mode is that number reaching
// `model.calibration` dressed as bb/100. The guard is structural (PC-4 checks the unit stamp) and
// it is tested by feeding the self-play result straight into the verdict machine.
//
// And the fourth: this lane MOVES NO CONSTANT AND WRITES NOTHING. Both are asserted from the
// outside — the thresholds are grepped back out of the pre-registered criteria, and the modules are
// scanned for an fs write that is not there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as C from '../scripts/lib/calibration.mjs';
import { aggregate, coverage, sufficiency, summarize } from '../scripts/lib/calibration-cells.mjs';
import {
  pairedD, Z95, normalCdf, mulberry32, scoreOrdering, evOrdering, cutAt, disagreement,
  selfPlayConsistency,
} from '../scripts/lib/calibration-paired.mjs';
import { I46_CRITERIA, CATALOG } from '../scripts/gates/reserved.mjs';
import * as POLICY from '../scripts/lib/policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const MODEL_BYTES = readFileSync(MODEL_PATH, 'utf8');
const MODEL = JSON.parse(MODEL_BYTES);
const MODEL_JSON_BEFORE = JSON.stringify(MODEL);
const CONSTANTS_BEFORE = JSON.stringify(POLICY.CONSTANTS);

// A corpus that satisfies every criterion. Fabricated ON PURPOSE and never mistaken for one: its
// provenance says so in words, and nothing outside this file constructs it.
const conformingRows = Array.from({ length: 12 }, (_, i) => ({
  handId: `fabricated-${i}`, seat: 1, pos: 'CO', cell: 'TRASH|RB', knownVia: 'hero', netBB: 0,
}));
const conformingProvenance = {
  name: 'fabricated in test/calibration.test.mjs — proves the machine can say pass',
  synthetic: false, observed: false, lawfullyHeld: true, reobtainable: true,
};
const conformingStat = { unit: 'bb/100', paired: true, D: 1.0, se: 0.1, ci95: [0.8, 1.2], mass: 0.1 };
const conformingHalves = {
  first: { D: 1.0, se: 0.15, ci95: [0.7, 1.3] },
  second: { D: 1.1, se: 0.15, ci95: [0.8, 1.4] },
};
const conformingCorpus = (over = {}) => C.makeCorpus(
  over.rows || conformingRows,
  'provenance' in over ? over.provenance : conformingProvenance,
  { assignment: 'assignment' in over ? over.assignment : { randomisedAtCellLevel: true },
    declaredBeforeEv: true,
    timeSplit: { declaredBeforeEv: true } },
);
const verdictOf = (over = {}) => C.evaluatePrimacy({
  model: MODEL,
  corpus: 'corpus' in over ? over.corpus : conformingCorpus(over),
  statistic: 'statistic' in over ? over.statistic : conformingStat,
  halves: 'halves' in over ? over.halves : conformingHalves,
});
const statusOf = (ev, id) => ev.criteria.find((c) => c.id === id).status;

// ---------------------------------------------------------------------------
// 1. the bar itself
// ---------------------------------------------------------------------------
test('I46 is still parked, and the harness refuses to load if it is not', () => {
  const e = CATALOG.find((x) => x.id === 'I46');
  assert.equal(e.status, 'parked');
  assert.equal(e.unpassable, true);
  assert.deepEqual([...e.blockedBy], ['PC-1', 'PC-2', 'PC-3']);
});

test('every threshold in the harness is a QUOTATION from the pre-registered criteria', () => {
  // V3-PLAN §6: "calibration tolerances — pre-registered at Phase 0 from S-C's power analysis".
  // A number here that is not in the bar would be a new opinion-layer constant under an old name.
  assert.ok(I46_CRITERIA.includes(`SE(D) <= ${C.PC5_SE_MAX.toFixed(2)} bb/100`));
  assert.ok(I46_CRITERIA.includes(`within ${C.PC7_HALF_AGREEMENT_SE} SE of their difference`));
  assert.ok(I46_CRITERIA.includes(`exceeding ${C.PC8_SE_MULTIPLE} * meta.se.cell`));
});

test('the 95% multiplier is SOLVED, not typed', () => {
  assert.ok(Math.abs(normalCdf(Z95) - 0.975) < 1e-12);
  assert.ok(Math.abs(Z95 - 1.959963984540054) < 1e-9);
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-15);
  assert.ok(Math.abs(normalCdf(1) - 0.8413447460685429) < 1e-12);
});

test('the harness carries all eight criteria and only those eight', () => {
  assert.deepEqual([...C.PC_IDS], ['PC-1', 'PC-2', 'PC-3', 'PC-4', 'PC-5', 'PC-6', 'PC-7', 'PC-8']);
  const ev = C.evaluatePrimacy({ model: MODEL });
  assert.deepEqual(ev.criteria.map((c) => c.id), [...C.PC_IDS]);
});

// ---------------------------------------------------------------------------
// 2. CAN IT SAY PASS?
// ---------------------------------------------------------------------------
test('a fully conforming corpus reaches PASS — the harness is not a rubber stamp', () => {
  const ev = verdictOf();
  assert.equal(ev.verdict, 'pass', `criteria: ${JSON.stringify(ev.criteria, null, 1)}`);
  assert.equal(ev.unevaluable.length, 0);
  assert.equal(ev.failed.length, 0);
});

// ---------------------------------------------------------------------------
// 3. CAN IT BE FOOLED? — one knock-out per criterion
// ---------------------------------------------------------------------------
test('PC-1: ONE showdown row in an otherwise clean corpus fails the whole thing', () => {
  const rows = [...conformingRows, { ...conformingRows[0], handId: 'x', knownVia: 'showdown' }];
  const ev = verdictOf({ rows });
  assert.equal(statusOf(ev, 'PC-1'), 'fail');
  assert.equal(ev.verdict, 'fail');
});

test('PC-2: a synthetic corpus fails, and a corpus with NO provenance is unevaluable', () => {
  const synth = verdictOf({ provenance: { ...conformingProvenance, synthetic: true } });
  assert.equal(statusOf(synth, 'PC-2'), 'fail');
  const none = verdictOf({ provenance: null });
  assert.equal(statusOf(none, 'PC-2'), 'unevaluable');
  assert.equal(none.verdict, 'fail');       // PC-0: unevaluable is a FAIL, never a pass
  const mined = verdictOf({ provenance: { ...conformingProvenance, observed: true } });
  assert.equal(statusOf(mined, 'PC-2'), 'fail');
  const unnameable = verdictOf({ provenance: { ...conformingProvenance, reobtainable: false } });
  assert.equal(statusOf(unnameable, 'PC-2'), 'fail');
});

test('PC-3: observational data under an unknown behaviour policy is unevaluable', () => {
  const ev = verdictOf({ assignment: null });
  assert.equal(statusOf(ev, 'PC-3'), 'unevaluable');
  assert.equal(ev.verdict, 'fail');
  // a known policy WITH an effective sample size is the other admissible route
  const weighted = verdictOf({ assignment: { behaviourPolicyKnown: true, effectiveSampleSize: 12000 } });
  assert.equal(statusOf(weighted, 'PC-3'), 'pass');
  // ...but "we know the policy" without an ESS is not
  const noEss = verdictOf({ assignment: { behaviourPolicyKnown: true } });
  assert.equal(statusOf(noEss, 'PC-3'), 'fail');
});

test('PC-4: a statistic in the wrong unit is refused, not converted', () => {
  const ev = verdictOf({ statistic: { ...conformingStat, unit: 'potFrac' } });
  assert.equal(statusOf(ev, 'PC-4'), 'fail');
  assert.match(ev.criteria[3].detail, /not bb\/100/);
  const unpaired = verdictOf({ statistic: { ...conformingStat, paired: false } });
  assert.equal(statusOf(unpaired, 'PC-4'), 'fail');
});

test('PC-5: SE(D) above the pre-registered floor fails', () => {
  const ev = verdictOf({ statistic: { ...conformingStat, se: C.PC5_SE_MAX + 1e-9, ci95: [0.5, 1.5] } });
  assert.equal(statusOf(ev, 'PC-5'), 'fail');
  const just = verdictOf({ statistic: { ...conformingStat, se: C.PC5_SE_MAX, ci95: [0.5, 1.5] } });
  assert.equal(statusOf(just, 'PC-5'), 'pass');
});

test('PC-6: a point estimate favouring EV that does not clear zero is a FAIL, not "encouraging"', () => {
  const ev = verdictOf({ statistic: { ...conformingStat, D: 0.15, ci95: [-0.05, 0.35] } });
  assert.equal(statusOf(ev, 'PC-6'), 'fail');
  assert.equal(ev.verdict, 'fail');
});

test('PC-7: a result that appears in one half only is a FAIL', () => {
  const oneSided = verdictOf({ halves: { first: { D: 2.0, se: 0.15, ci95: [1.7, 2.3] },
    second: { D: 0.0, se: 0.15, ci95: [-0.3, 0.3] } } });
  assert.equal(statusOf(oneSided, 'PC-7'), 'fail');
  const missing = verdictOf({ halves: null });
  assert.equal(statusOf(missing, 'PC-7'), 'unevaluable');
  // halves that both clear zero but disagree by more than 2 SE of their difference also fail
  const disagree = verdictOf({ halves: { first: { D: 0.5, se: 0.05, ci95: [0.4, 0.6] },
    second: { D: 2.0, se: 0.05, ci95: [1.9, 2.1] } } });
  assert.equal(statusOf(disagree, 'PC-7'), 'fail');
});

test('PC-8 is EVALUATED today — no corpus needed, and it reports a real number', () => {
  const pc8 = C.pc8Substance(MODEL);
  assert.ok(['pass', 'fail'].includes(pc8.status));
  assert.ok(pc8.transposed > 0, 'the two orderings must transpose SOMETHING or there is no claim');
  assert.equal(pc8.threshold, C.PC8_SE_MULTIPLE * MODEL.meta.se.cell);
  assert.equal(pc8.fraction, pc8.substantive / pc8.transposed);
  assert.equal(pc8.status, pc8.fraction > 0.5 ? 'pass' : 'fail');
});

test('PC-8 fails when the re-ordering is entirely inside the error bars', () => {
  // A model whose cells all carry the SAME equity has no pair separated by 2*se.cell, so any
  // transposition at all is a re-labelling. This is the clause's own failure mode, fabricated.
  const flat = JSON.parse(MODEL_BYTES);
  for (const k of Object.keys(flat.cells)) {
    const c = flat.cells[k];
    if (c.eq) c.eq = c.eq.map(() => 50);
  }
  const pc8 = C.pc8Substance(flat);
  if (pc8.transposed > 0) {
    assert.equal(pc8.substantive, 0);
    assert.equal(pc8.status, 'fail');
  }
});

// ---------------------------------------------------------------------------
// 4. THE LAUNDERING GUARD — the one thing this lane could get badly wrong
// ---------------------------------------------------------------------------
test('the self-play result is stamped as NOT money, on every field a caller might read', () => {
  const sp = selfPlayConsistency(MODEL, { hands: 2000, seed: 7 });
  assert.equal(sp.unit, 'potFrac');
  assert.equal(sp.moneyValidated, false);
  assert.equal(sp.kind, 'self-play-consistency');
  assert.equal(sp.payoffSource, 'checkdown');   // I35's Grade-C label keys off exactly this
});

test('feeding the self-play statistic straight into the verdict machine FAILS PC-4', () => {
  const sp = selfPlayConsistency(MODEL, { hands: 2000, seed: 7 });
  const smuggled = { ...sp.statistic, unit: sp.unit, paired: true, mass: sp.statistic.mass };
  const ev = verdictOf({ statistic: smuggled });
  assert.equal(statusOf(ev, 'PC-4'), 'fail');
  assert.equal(ev.verdict, 'fail');
});

test('the shipped fixture cannot become a corpus: it fails PC-1 and PC-2 by construction', () => {
  const { corpus } = C.fixtureCorpus();
  const ev = C.evaluatePrimacy({ model: MODEL, corpus });
  assert.equal(statusOf(ev, 'PC-1'), 'fail');    // it carries showdown rows
  assert.equal(statusOf(ev, 'PC-2'), 'fail');    // and it says it is synthetic
  assert.equal(ev.verdict, 'fail');
});

test('the shipped state — no corpus at all — is FAIL with PC-1..PC-7 unevaluable', () => {
  const ev = C.evaluatePrimacy({ model: MODEL });
  assert.equal(ev.verdict, 'fail');
  assert.deepEqual([...ev.unevaluable], ['PC-1', 'PC-2', 'PC-3', 'PC-4', 'PC-5', 'PC-6', 'PC-7']);
  assert.equal(ev.failureClosed, true);
});

// ---------------------------------------------------------------------------
// 5. I46 clause (1) — reproducibility
// ---------------------------------------------------------------------------
test('the harness self-check is green, and every one of its checks ran', () => {
  const sc = C.harnessSelfCheck(MODEL, { hands: 3000 });
  assert.equal(sc.ok, true, JSON.stringify(sc.checks, null, 1));
  assert.deepEqual(sc.checks.map((k) => k.name), [
    'parse-twice', 'parse-chunked', 'aggregate-twice',
    'selfplay-twice', 'selfplay-seeded', 'paired-exact', 'z95-inverts',
  ]);
});

test('two full runs of the harness produce identical digests', () => {
  const a = C.buildCalibrationBlock(MODEL, { selfPlayOpts: { hands: 3000, seed: 4 } });
  const b = C.buildCalibrationBlock(MODEL, { selfPlayOpts: { hands: 3000, seed: 4 } });
  assert.equal(C.digest(a), C.digest(b));
});

test('the stream is seeded — a different seed is a different run', () => {
  const a = selfPlayConsistency(MODEL, { hands: 3000, seed: 1 });
  const b = selfPlayConsistency(MODEL, { hands: 3000, seed: 2 });
  assert.notEqual(C.digest(a.statistic), C.digest(b.statistic));
  // and the generator itself is pinned, so swapping the algorithm is a visible change rather than
  // a silent one. These three are MEASURED from mulberry32(1), not chosen; the point of writing
  // them down is that every future "two independent runs agree" claim rests on this stream.
  const r = mulberry32(1);
  assert.deepEqual([r(), r(), r()].map((x) => x.toFixed(15)),
    ['0.627073940588161', '0.002735721180215', '0.527447039959952']);
  const s = mulberry32(1);
  for (let i = 0; i < 1000; i++) { const x = s(); assert.ok(x >= 0 && x < 1); }
});

test('canonicalJson digests VALUES, not key order', () => {
  assert.equal(C.digest({ a: 1, b: 2 }), C.digest({ b: 2, a: 1 }));
  assert.notEqual(C.digest({ a: 1 }), C.digest({ a: 2 }));
});

// ---------------------------------------------------------------------------
// 6. PC-4's estimator, and the pairing property it depends on
// ---------------------------------------------------------------------------
test('pairedD is the textbook estimator, checked against hand arithmetic', () => {
  const p = pairedD([0, 0, 2, 2]);
  assert.equal(p.D, 1);
  assert.ok(Math.abs(p.sd - 2 / Math.sqrt(3)) < 1e-12);
  assert.ok(Math.abs(p.se - (2 / Math.sqrt(3)) / 2) < 1e-12);
  assert.equal(p.zeros, 2);
  assert.equal(p.mass, 0.5);
  assert.ok(Math.abs(p.ci95[0] - (1 - Z95 * p.se)) < 1e-15);
  assert.equal(pairedD([]).n, 0);
});

test('agreement contributes EXACTLY zero — the property the corpus arithmetic rests on', () => {
  // PC-4: "evaluated hand-by-hand on the same stream so that hands where the orderings agree
  // contribute exactly zero". If that is not exact, SE = sigma*sqrt(m/N) is wrong and every corpus
  // size S-C computed is wrong with it.
  const sp = selfPlayConsistency(MODEL, { hands: 4000, seed: 11 });
  assert.ok(sp.statistic.zeros > 0);
  assert.equal(sp.statistic.zeros + sp.statistic.disagreements, sp.statistic.n);
  assert.ok(Math.abs(sp.statistic.mass - sp.statistic.disagreements / sp.statistic.n) < 1e-15);
});

test('the stream draws from the SHIPPED combo distribution, not uniformly over cells', () => {
  // The empirical disagreement rate must converge to the disagreement set's combo MASS. If the
  // drawer sampled cells uniformly it would converge to 15/123 = 12.2% instead of ~5.7%, and every
  // number the harness produces would be an answer about a game nobody plays. This is the cheapest
  // test that distinguishes the two, and it is the reason the drawer is a cumulative search rather
  // than an index pick.
  const sp = selfPlayConsistency(MODEL, { hands: 120000, seed: 5 });
  const expected = sp.disagreement.mass;
  const seen = sp.statistic.mass;
  const se = Math.sqrt((expected * (1 - expected)) / sp.hands);
  assert.ok(Math.abs(seen - expected) < 4 * se,
    `empirical ${seen} vs combo mass ${expected} (4 SE = ${4 * se})`);
  const uniform = sp.disagreement.cells / sp.cutSizes.score;
  assert.ok(Math.abs(seen - uniform) > 10 * se, 'and it is distinguishable from uniform-over-cells');
});

test('both orderings are cut at the SAME width, and the cut is the shipped convention', () => {
  const score = scoreOrdering(MODEL, { pos: 'CO', node: 'rfi' });
  const ev = evOrdering(MODEL, { pos: 'CO', node: 'rfi', base: score });
  assert.equal(ev.width, score.width);
  const a = cutAt(score, score.width), b = cutAt(ev, score.width);
  const d = disagreement(b, a, score);
  assert.equal(d.cells, d.onlyEv.length + d.onlyScore.length);
  assert.ok(d.mass >= 0 && d.mass <= 1);
  // the two orderings rank the same cell SET; only the order differs
  assert.deepEqual([...score.keys].sort(), [...ev.keys].sort());
});

test('the EV ordering comes through the FROZEN payoff interface, and carries its source', () => {
  const ev = evOrdering(MODEL, { pos: 'CO', node: 'rfi' });
  assert.equal(ev.source, 'checkdown');
  assert.equal(ev.supported, true);
});

// ---------------------------------------------------------------------------
// 7. the two doors, and S-C's finding as an executable assertion
// ---------------------------------------------------------------------------
test('aggregation never mixes the two doors into one mean', () => {
  const rows = [
    { handId: 'a', pos: 'CO', cell: 'TRASH|RB', knownVia: 'hero', netBB: -1 },
    { handId: 'b', pos: 'CO', cell: 'TRASH|RB', knownVia: 'showdown', netBB: 20 },
  ];
  const agg = aggregate(rows, { byPosition: true });
  const b = agg.byCell.get('TRASH|RB');
  assert.equal(b.hero.n, 1);
  assert.equal(b.showdown.n, 1);
  assert.equal(b.hero.mean, -100);         // bb/100
  assert.equal(b.showdown.mean, 2000);
  assert.equal(agg.byCellPos.get('TRASH|RB@CO').hero.n, 1);
  assert.throws(() => aggregate([{ ...rows[0], knownVia: 'guess' }]), /unknown knownVia/);
});

test("S-C's finding, executable: the plan's §1 bar is MET by a corpus that fails PC-1", () => {
  // 90 cells, 120 showdown rows each, ZERO hero rows — the datamined shape at volume. The bar as
  // written ("100 showdowns in 80 cells") is met; the repaired bar is not; and PC-1 refuses the
  // corpus outright. All three facts hold at once, which is exactly S-C §2's point.
  const cellKeys = Object.keys(MODEL.cells).filter((k) => MODEL.cells[k].combos > 0);
  const rows = [];
  for (const key of cellKeys.slice(0, 90)) {
    for (let i = 0; i < 120; i++) {
      rows.push({ handId: `s${i}`, pos: 'CO', cell: key, knownVia: 'showdown', netBB: 5 });
    }
  }
  const suf = sufficiency(coverage(aggregate(rows), cellKeys, { min: 100 }), { cells: 80 });
  assert.equal(suf.metAsWritten, true, 'the plan\'s own bar is cleared');
  assert.equal(suf.met, false, 'the repaired bar (hero rows) is not');
  const ev = C.evaluatePrimacy({ model: MODEL, corpus: C.makeCorpus(rows, conformingProvenance) });
  assert.equal(statusOf(ev, 'PC-1'), 'fail');
});

test('coverage counts against the SHIPPED cell list, so an untouched cell is a zero not an absence', () => {
  const cellKeys = Object.keys(MODEL.cells).filter((k) => MODEL.cells[k].combos > 0);
  const cov = coverage(aggregate([]), cellKeys, { min: 1 });
  assert.equal(cov.cells, cellKeys.length);
  assert.equal(cov.rows.length, cellKeys.length);
  assert.equal(cov.touched, 0);
  assert.equal(summarize([]).n, 0);
});

// ---------------------------------------------------------------------------
// 8. calibration.disputed
// ---------------------------------------------------------------------------
test('disputedReport REPORTS disagreements and applies none of them', () => {
  const shipped = { q: 0.85, nuBar: 0.42, kappa0: 0.15 };
  const fitted = { q: 0.71, nuBar: 0.42, kappa0: 0.19 };
  const before = JSON.stringify(shipped);
  const d = C.disputedReport(shipped, fitted, { se: { q: 0.02 } });
  assert.equal(JSON.stringify(shipped), before, 'the shipped object must be untouched');
  assert.deepEqual(d.map((e) => e.name), ['q', 'kappa0']);   // sorted by |z|, q has one
  assert.ok(Math.abs(d[0].delta - (-0.14)) < 1e-12);
  assert.ok(Math.abs(d[0].z - (-7)) < 1e-9);
  assert.equal(d[1].z, null);
  assert.ok(Object.isFrozen(d) && Object.isFrozen(d[0]));
});

test('disputedReport is empty when everything agrees, and says when nothing was compared', () => {
  assert.equal(C.disputedReport({ q: 0.85 }, { q: 0.85 }).length, 0);
  const block = C.buildCalibrationBlock(MODEL, { selfPlayOpts: { hands: 1000 } });
  assert.equal(block.disputed.length, 0);
  assert.match(block.disputedReason, /nothing was compared, not because everything agreed/);
});

test('a fitted quantity the model does not ship is reported, not dropped', () => {
  const d = C.disputedReport({}, { somethingNew: 3 });
  assert.equal(d.length, 1);
  assert.equal(d[0].shipped, null);
  assert.match(d[0].note, /does not ship/);
});

// ---------------------------------------------------------------------------
// 9. the shipped block
// ---------------------------------------------------------------------------
test('buildCalibrationBlock ships the FAIL as loudly as a pass — the REPORTING DUTY', () => {
  const block = C.buildCalibrationBlock(MODEL, { selfPlayOpts: { hands: 2000, seed: 3 } });
  assert.equal(block.verdict, 'fail');
  assert.equal(block.criteria, I46_CRITERIA);              // verbatim, not a summary
  assert.equal(block.criteriaDigest, C.CRITERIA_DIGEST);
  assert.equal(block.corpus.present, false);
  assert.equal(block.corpus.heroRows, 0);
  assert.match(block.corpus.reason, /no lawful, hero-visible, assigned/);
  assert.match(block.limitation, /unfalsified against money/);
  assert.match(block.successor, /prospective randomised A\/B test/);
  assert.match(block.gate, /I46 \(parked\)/);
  assert.equal(block.selfPlay.moneyValidated, false);
  assert.equal(block.selfPlay.unit, 'potFrac');
  assert.ok(Object.isFrozen(block));
});

test('the block is JSON-serialisable — it has to survive a trip through model.json', () => {
  const block = C.buildCalibrationBlock(MODEL, { selfPlayOpts: { hands: 1000 } });
  const round = JSON.parse(JSON.stringify(block));
  assert.equal(round.verdict, 'fail');
  assert.equal(round.evaluated.length, 8);
});

// ---------------------------------------------------------------------------
// 10. this lane writes nothing and moves nothing
// ---------------------------------------------------------------------------
test('no calibration module contains an fs write — the guarantee is structural', () => {
  const files = readdirSync(resolve(ROOT, 'scripts/lib'))
    .filter((f) => f.startsWith('calibration'));
  assert.ok(files.length >= 5, `expected the calibration modules, found ${files.join(', ')}`);
  for (const f of files) {
    const src = readFileSync(resolve(ROOT, 'scripts/lib', f), 'utf8');
    assert.doesNotMatch(src, /writeFileSync|appendFileSync|createWriteStream|unlinkSync|mkdirSync|rmSync/,
      `${f} must not be able to write anything`);
    assert.doesNotMatch(src, /from 'node:fs'/, `${f} must not import node:fs at all`);
  }
});

test('the write guard refuses the dataset and the tier fixtures', () => {
  assert.throws(() => C.assertNotAModelPath('data/model.json', ROOT), /refusing to write inside data/);
  assert.throws(() => C.assertNotAModelPath('data/anything.json', ROOT), /refusing to write inside data/);
  assert.throws(() => C.assertNotAModelPath('/tmp/tiers-v3.fixture.txt', ROOT), /sole fixture writer/);
  assert.equal(typeof C.assertNotAModelPath('/tmp/report.json', ROOT), 'string');
});

test('running the whole harness leaves data/model.json byte-identical', () => {
  C.harnessSelfCheck(MODEL, { hands: 1000 });
  C.buildCalibrationBlock(MODEL, { selfPlayOpts: { hands: 1000 } });
  C.evaluatePrimacy({ model: MODEL, corpus: conformingCorpus(), statistic: conformingStat });
  assert.equal(readFileSync(MODEL_PATH, 'utf8'), MODEL_BYTES);
  // and the in-memory model too: `hydrate` adds only non-enumerable properties
  assert.equal(JSON.stringify(MODEL), MODEL_JSON_BEFORE);
  assert.equal(createHash('sha256').update(JSON.stringify(MODEL)).digest('hex'),
    createHash('sha256').update(MODEL_JSON_BEFORE).digest('hex'));
});

test('the harness adds no constant to the opinion layer, and mutates none', () => {
  // Everything numeric this lane exports is either a quotation from the pre-registered bar or
  // derived arithmetic. Two separate claims, tested separately:
  //
  //   (a) no calibration module ASSIGNS into policy's CONSTANTS — a source scan, which also
  //       covers the import-time window the runtime check below cannot see;
  //   (b) running the whole harness leaves CONSTANTS byte-identical.
  //
  // `calibration-paired.mjs` does import policy.mjs, and must: `rankTable` IS the shipped score
  // ordering and reimplementing it would be the real violation. What it may not do is write.
  for (const f of readdirSync(resolve(ROOT, 'scripts/lib')).filter((x) => x.startsWith('calibration'))) {
    const src = readFileSync(resolve(ROOT, 'scripts/lib', f), 'utf8');
    assert.doesNotMatch(src, /CONSTANTS\s*(\.\w+|\[[^\]]*\])[^=]*=[^=]/, `${f} assigns into CONSTANTS`);
  }
  C.harnessSelfCheck(MODEL, { hands: 500 });
  C.buildCalibrationBlock(MODEL, { selfPlayOpts: { hands: 500 } });
  assert.equal(JSON.stringify(POLICY.CONSTANTS), CONSTANTS_BEFORE);
});
