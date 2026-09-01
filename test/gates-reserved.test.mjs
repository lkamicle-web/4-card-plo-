// node --test test/*.test.mjs
//
// The §7 gate catalog's boundary, and I46's pre-registered bar.
//
// V3-PLAN §0.1 designs the gate catalog before the features, so B0 step 4 drafts all of §7 with ids
// RESERVED — claimed and written up at Phase 0, enforced later. That creates exactly one new way to
// lie: a reserved id drifting into the enforced set, so the suite reports a gate it never ran. The
// first half of this file pins that boundary from the outside (the registry guards it from the
// inside, at import time, on every verify run).
//
// The second half is the one that matters longer. S-C FAILED — no lawful, hero-visible, assigned
// 4-card PLO corpus exists — so I46 is unpassable by construction. The house response to that is
// NOT to lower the bar but to park it: the criteria are written down now, before any EV number
// exists, in two places, and this file asserts the two copies are byte-identical. A bar that lives
// in one file is a bar one commit can move, and §5.4's whole claim is "no post-hoc bar-lowering".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXPECTED_IDS } from '../scripts/gates/index.mjs';
import { CATALOG, RESERVED_IDS, LIVE_IDS, PARKED, I46_CRITERIA } from '../scripts/gates/reserved.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_SRC = readFileSync(resolve(ROOT, 'scripts/gates/index.mjs'), 'utf8');

/** every gate id V3-PLAN §7.2's table names, in its order */
const PLAN_S7 = [
  'I32', 'I33', 'I34', 'I35', 'I36', 'I37', 'I38', 'I39', 'I40', 'I41', 'I42',
  'I43', 'I44', 'I45', 'I46', 'I47', 'D9', 'D10', 'D11', 'SF', 'SS',
];

// ---------------------------------------------------------------------------
test('the catalog covers all of V3-PLAN §7.2, in the plan\'s order', () => {
  assert.deepEqual(CATALOG.map((e) => e.id), PLAN_S7);
});

test('reserved ids are disjoint from the enforced set', () => {
  const enforced = new Set(EXPECTED_IDS);
  const leaked = RESERVED_IDS.filter((id) => enforced.has(id));
  assert.deepEqual(leaked, [], `reserved ids in EXPECTED_IDS: ${leaked.join(' ')}`);
});

test('everything the catalog calls live IS enforced, and only I32/I33 are', () => {
  assert.deepEqual(LIVE_IDS, ['I32', 'I33']);
  for (const id of LIVE_IDS) assert.ok(EXPECTED_IDS.includes(id), `${id} claims live but is not run`);
});

test('the enforced report is still the 46 gates, and EXPECTED_IDS is still a literal', () => {
  assert.equal(EXPECTED_IDS.length, 46);
  // Written out, not derived — the reason is in index.mjs: a list flat-mapped from REGISTRY cannot
  // detect a deleted family, because it shrinks with it. Adding a reserved-id manifest must not
  // become the excuse to generate this list.
  const decl = INDEX_SRC.slice(INDEX_SRC.indexOf('export const EXPECTED_IDS'));
  const literal = decl.slice(0, decl.indexOf('];') + 2);
  assert.equal((literal.match(/'[A-Z]+\d*'/g) || []).length, 46);
  assert.match(literal, /^export const EXPECTED_IDS = \[/, 'EXPECTED_IDS is no longer a literal');
  assert.ok(!literal.includes('flatMap') && !literal.includes('CATALOG'),
    'EXPECTED_IDS is being derived — the independent copy is the point');
});

test('the registry guards the boundary at import time, in both directions', () => {
  // The grep-gate idiom: the guard runs on every import of the registry (including this test's own
  // import above, which is why a violation would fail this file before any assertion ran), so what
  // is worth pinning here is that both directions of it still exist to run.
  assert.ok(INDEX_SRC.includes("from './reserved.mjs'"), 'the registry no longer reads the catalog');
  assert.ok(INDEX_SRC.includes("e.status !== 'live' && enforced.has(e.id)"),
    'the reserved-id-leaked-into-EXPECTED_IDS guard is gone');
  assert.ok(INDEX_SRC.includes("e.status === 'live' && e.runner === 'verify' && !enforced.has(e.id)"),
    'the live-gate-stopped-being-enforced guard is gone');
});

test('no reserved id is stamped into the shipped model.gates', () => {
  const model = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
  const stamped = Object.keys(model.gates);
  // SET equality, not order: the stamping loop writes `model.gates[id] = ...` into the object the
  // last regeneration produced, so the shipped key order is insertion order from that run — I32 and
  // I33 sit at the end because they were added after it, not where the report prints them. That is
  // a property of when keys were first written, not a claim about the suite, so the assertion is on
  // membership. The report's ORDER is EXPECTED_IDS' own job, checked in verifyModel.
  assert.deepEqual([...stamped].sort(), [...EXPECTED_IDS].sort(),
    'model.gates is no longer exactly the enforced set');
  for (const id of RESERVED_IDS) {
    assert.ok(!(id in model.gates), `${id} is reserved but carries a stamped verdict`);
  }
});

test('every entry says how it fails, and harness gates are marked as such', () => {
  for (const e of CATALOG) {
    assert.ok(e.claim && e.fails, `${e.id} must state both its claim and its failure mode`);
    assert.ok(e.plan.includes('§'), `${e.id} must cite the plan section it comes from`);
  }
  assert.deepEqual(CATALOG.filter((e) => e.runner === 'harness').map((e) => e.id), ['SF', 'SS']);
});

// ---------------------------------------------------------------------------
// I46 — parked, not lowered.
test('I46 is parked: the bar is fixed, and the reason it cannot be met is written down', () => {
  assert.deepEqual(PARKED.map((e) => e.id), ['I46']);
  const i46 = CATALOG.find((e) => e.id === 'I46');
  assert.equal(i46.status, 'parked');
  assert.equal(i46.unpassable, true);
  // S-C's finding: PC-1/2/3 are unsatisfiable, so PC-0 makes the verdict FAIL by construction.
  assert.deepEqual(i46.blockedBy, ['PC-1', 'PC-2', 'PC-3']);
  assert.match(i46.blockedReason, /NOT LOWERED, IT IS PARKED/);
  assert.match(i46.consequence, /score-primary is permanent for v3/);
  // Parked is not "absent": the id stays reserved so it cannot be re-issued to something else.
  assert.ok(RESERVED_IDS.includes('I46'));
});

test('I46_CRITERIA is byte-identical to the pre-registration record in docs/spikes/S-C.md', () => {
  // THE PRE-REGISTRATION CLAUSE. §5.4: the criteria are fixed at Phase 0 "before any EV number
  // exists — no post-hoc bar-lowering". Two independent copies, byte-compared: the memo is the
  // dated record, the manifest is what P5 will read. Editing either alone fails here.
  const memo = readFileSync(resolve(ROOT, 'docs/spikes/S-C.md'), 'utf8');
  const block = memo.match(/```\n(PC-0[\s\S]*?)\n```/);
  assert.ok(block, 'docs/spikes/S-C.md no longer carries the pre-registered criteria block');
  assert.equal(I46_CRITERIA, block[1]);
});

test('the criteria are all nine, conjunctive, and failure-closed', () => {
  for (let i = 0; i <= 8; i++) {
    assert.ok(I46_CRITERIA.includes(`PC-${i}`), `PC-${i} is missing from the bar`);
  }
  assert.match(I46_CRITERIA, /CONJUNCTIVE, FAILURE-CLOSED/);
  assert.match(I46_CRITERIA, /A criterion\n {6}that cannot be evaluated counts as FAIL/);
  assert.match(I46_CRITERIA, /REPORTING DUTY/);
  // The three that S-C found unsatisfiable must still be the strict ones they were written as.
  assert.match(I46_CRITERIA, /fails PC-1 at any volume/);
  assert.match(I46_CRITERIA, /Datamined or observed third-party hands are\n {6}inadmissible/);
  assert.match(I46_CRITERIA, /Observational data under an\n {6}unknown behaviour policy fails PC-3/);
});
