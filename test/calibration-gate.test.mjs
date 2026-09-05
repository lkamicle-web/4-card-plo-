/**
 * test/calibration-gate.test.mjs — gate I46 itself (V3-PLAN §3.5, §5.4, §7.2's I46 row).
 *
 * `test/calibration.test.mjs` bounds the HARNESS: can it say pass, can it be fooled, can the
 * self-play number be laundered into the money statistic. This file bounds THE GATE that runs it,
 * and it exists because of one asymmetry P5 created and nothing else in the suite covers.
 *
 * THE ASYMMETRY. Every other gate in the registry passes when its subject is RIGHT. I46 passes when
 * its subject is HONEST — the shipped verdict is FAIL and the gate is green over it. That is the
 * correct shape, and it is also exactly the shape a bar-lowering would take if one ever happened
 * here, so the two have to be told apart by something a reader can run:
 *
 *   * the gate's own failure-closed predicate must REFUSE a fabricated 'pass' (a gate that could
 *     not reject one is decoration), and must still be ABLE to return 'pass' for a lawful block
 *     (a predicate that always says fail is a constant, not a bar);
 *   * the criteria digest must be the Phase-0 one, so "nothing in the bar moved" is checkable
 *     without reading the bar;
 *   * the shipped block must be the block the gate rebuilds — the property that makes the verdict
 *     on the page a computation rather than a claim, and the one that would break first if
 *     stamping and gating ever drifted apart across the verify -> build -> verify cycle.
 *
 * Everything here reads either the shipped `data/model.json` or the gate module directly. Nothing
 * is written, and no fabricated block ever leaves a local variable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as GATE from '../scripts/gates/calibration.mjs';
import { REGISTRY, EXPECTED_IDS } from '../scripts/gates/index.mjs';
import { CRITERIA_DIGEST, I46_CRITERIA, buildCalibrationBlock, canonicalJson, PC_IDS }
  from '../scripts/lib/calibration.mjs';
import { CATALOG } from '../scripts/gates/reserved.mjs';
import * as P from '../scripts/lib/policy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(join(ROOT, 'data', 'model.json'), 'utf8'));
const SHELL = readFileSync(join(ROOT, 'src', 'shell.html'), 'utf8');

const passAll = PC_IDS.map((id) => ({ id, status: 'pass', detail: 'fabricated by the test' }));

// ---------------------------------------------------------------------------
// 1. the family is wired the way a promotion is supposed to wire one
// ---------------------------------------------------------------------------
test('the family declares I46, and the registry appends it last', () => {
  assert.deepEqual(GATE.ids, ['I46']);
  assert.equal(REGISTRY[REGISTRY.length - 1], GATE, 'the calibration family is not last');
  assert.equal(EXPECTED_IDS[EXPECTED_IDS.length - 1], 'I46');
  // 61 stays a strict prefix of 62 — the append rule the report has now used eight times.
  assert.equal(EXPECTED_IDS.length, 62);
  assert.equal(CATALOG.find((e) => e.id === 'I46').status, 'live');
});

// ---------------------------------------------------------------------------
// 2. the failure-closed predicate — both directions
// ---------------------------------------------------------------------------
test('lawfulVerdict refuses every fabricated pass', () => {
  const REJECT = [
    ['all pass, no corpus', { evaluated: passAll, corpus: { present: false }, verdict: 'pass' }],
    ['one unevaluable among passes', {
      evaluated: passAll.map((c, i) => (i === 0 ? { ...c, status: 'unevaluable' } : c)),
      corpus: { present: true }, verdict: 'pass' }],
    ['one fail among passes', {
      evaluated: passAll.map((c, i) => (i === 7 ? { ...c, status: 'fail' } : c)),
      corpus: { present: true }, verdict: 'pass' }],
    ['seven criteria instead of eight', {
      evaluated: passAll.slice(1), corpus: { present: true }, verdict: 'pass' }],
    ['no evaluation at all', { evaluated: null, corpus: { present: true }, verdict: 'pass' }],
    ['no corpus record at all', { evaluated: passAll, verdict: 'pass' }],
  ];
  for (const [what, block] of REJECT) {
    assert.equal(GATE.lawfulVerdict(block).ok, false, `the rule accepted: ${what}`);
    assert.equal(GATE.lawfulVerdict(block).want, 'fail', `PC-0 should demand fail for: ${what}`);
  }
});

test('lawfulVerdict can still say pass — it is a bar, not a constant', () => {
  const lawful = { evaluated: passAll, corpus: { present: true }, verdict: 'pass' };
  assert.equal(GATE.lawfulVerdict(lawful).want, 'pass');
  assert.equal(GATE.lawfulVerdict(lawful).ok, true);
  // ...and the same fully-passing block stamped 'fail' is ALSO unlawful: the clause asserts
  // agreement with the bar in both directions, which is what lets it survive a real corpus.
  assert.equal(GATE.lawfulVerdict({ ...lawful, verdict: 'fail' }).ok, false);
});

// ---------------------------------------------------------------------------
// 3. the shipped block
// ---------------------------------------------------------------------------
test('the shipped verdict is FAIL, and it is the verdict the bar gives', () => {
  const c = MODEL.calibration;
  assert.ok(c, 'data/model.json carries no calibration block');
  assert.equal(c.verdict, 'fail');
  assert.equal(GATE.lawfulVerdict(c).ok, true, 'the shipped verdict disagrees with PC-0');
  assert.equal(GATE.lawfulVerdict(c).want, 'fail');
  assert.equal(P.evPrimary(MODEL), false);
  for (const id of ['PC-1', 'PC-2', 'PC-3']) assert.ok(c.unevaluable.includes(id));
  assert.equal(c.corpus.present, false);
  assert.equal(c.selfPlay.unit, 'potFrac');
  assert.equal(c.selfPlay.moneyValidated, false);
  assert.deepEqual(c.disputed, []);
  assert.ok(c.disputedReason, 'an empty disputed list with no reason reads as agreement');
});

test('the shipped block reproduces — the verdict on the page is a computation, not a claim', () => {
  // This is the hash-churn tripwire in test form: verify stamps, build embeds, verify re-runs. If
  // the rebuild ever stopped reproducing, the artifact and the file would carry different verdicts
  // and every `--check` would flap. The block is deterministic because its self-play stream is
  // seeded and model-only, which is a property worth pinning rather than assuming.
  const again = buildCalibrationBlock(MODEL);
  assert.equal(canonicalJson(again), canonicalJson(MODEL.calibration));
  const third = buildCalibrationBlock(MODEL);
  assert.equal(canonicalJson(third), canonicalJson(again));
});

test('the bar is the Phase-0 bar, in the file and in the model', () => {
  assert.equal(CRITERIA_DIGEST, '58a70f0cb95a44ed');
  assert.equal(MODEL.calibration.criteria, I46_CRITERIA);
  assert.equal(MODEL.calibration.criteriaDigest, CRITERIA_DIGEST);
  assert.match(MODEL.calibration.criteria, /A criterion\s+that cannot be evaluated counts as FAIL/);
});

// ---------------------------------------------------------------------------
// 4. the Method view actually renders it
// ---------------------------------------------------------------------------
test('every field the gate demands on screen is read by the shell, from a capped block', () => {
  for (const token of ['MODEL.calibration', '.evaluated', '.disputed', '.disputedReason',
    '.limitation', '.successor', 'moneyValidated', 'MODEL.calibration.limitation']) {
    assert.ok(SHELL.includes(token), `the Method view never reads ${token}`);
  }
  // ...and it is inside `@block:calib`, which is what keeps `appCore` flat and the raise paid.
  assert.ok(SHELL.includes('/* @block:calib'), 'the section is not a measurable region');
  assert.ok(SHELL.includes('html += calibHTML();'), 'renderMethod no longer calls the section');
});

// ---------------------------------------------------------------------------
// 5. the gate, run for real against tampered blocks
// ---------------------------------------------------------------------------
/**
 * THE ARMING THAT MATTERS MOST, AND THE REASON IT HAS TO LIVE HERE RATHER THAN IN THE GATE.
 *
 * Inside `verify.mjs` the block is RE-DERIVED a few lines before the gates run, so a verdict
 * hand-edited into `data/model.json` is overwritten before I46 ever sees it. That is the right
 * design — a stamp that could be poisoned is worse than one that cannot — but it means the CLI can
 * never exercise the tamper path, and a clause nothing exercises is a clause nobody has checked.
 * So the family's `build()` is driven directly, with fabricated models that never touch disk, and
 * the shipped one is run beside them as the control. This is also the detector for the case the
 * runner genuinely cannot cover: a `data/model.json` edited by hand and shipped WITHOUT re-running
 * verify, which `build.mjs` would happily inject.
 */
test('the gate passes the shipped block and refuses six tampered ones', () => {
  const run = (m) => {
    let out = null;
    const ctx = { model: m, opts: {}, fast: false, tolB: 0.6, tolE: 0.5,
      G: (id, pass, detail) => { out = { id, pass, detail }; } };
    const built = GATE.build(ctx);
    built.sections[0].run();
    assert.equal(out.id, 'I46');
    return out;
  };
  P.hydrate(MODEL);
  assert.equal(run(MODEL).pass, true, 'the gate does not pass the shipped block');

  const c = MODEL.calibration;
  const allPass = c.evaluated.map((x) => ({ ...x, status: 'pass' }));
  const TAMPERED = {
    'the verdict alone flipped to pass': { ...c, verdict: 'pass' },
    'the whole block fabricated as a pass': {
      ...c, verdict: 'pass', evaluated: allPass, unevaluable: [], corpus: { ...c.corpus, present: true } },
    'the bar narrowed so unevaluable would count as pass': {
      ...c, criteria: c.criteria.replace('counts as FAIL', 'counts as PASS') },
    'the self-play figure relabelled as money': {
      ...c, selfPlay: { ...c.selfPlay, unit: 'bb/100', moneyValidated: true } },
    'the empty disputed list stripped of its reason': { ...c, disputedReason: null },
    'the criteria digest swapped for another': { ...c, criteriaDigest: '0'.repeat(16) },
  };
  for (const [what, calibration] of Object.entries(TAMPERED)) {
    assert.equal(run({ ...MODEL, calibration }).pass, false, `the gate accepted: ${what}`);
  }
  // ...and a model with no block at all, which is the failure §3.5 forbids in the other direction
  const stripped = { ...MODEL };
  delete stripped.calibration;
  const bare = run(stripped);
  assert.equal(bare.pass, false);
  assert.match(bare.detail, /model\.calibration is not stamped/);
});
