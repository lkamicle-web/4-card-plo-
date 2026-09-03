// node --test test/*.test.mjs
//
// Gate I35 itself — the registry wiring, and the FAILURES.
//
// test/cfr.test.mjs arms the detectors (they are exported from scripts/lib/cfr.mjs, so the gate and
// that file run the same code rather than two copies of it). This file arms the GATE: it drives
// scripts/gates/solver.mjs's own `build`/`run` with fabricated models and asserts I35 reports FAIL.
// That is gates-variants.test.mjs's idiom, and the first test is its first test for the same reason
// — a gate that passes on a broken input proves nothing about the ones where it passes on a good
// one, so the baseline has to be established before the failures mean anything.
//
// COST NOTE. A full-model gate run is six solves at the 2,000-iteration cap. The failure cases use a
// deliberately narrowed 20-cell model, which is ~38x cheaper per iteration and still trips the
// clauses under test, so only the baseline pays full price.

import test from 'node:test';
import assert from 'node:assert/strict';

import * as solverGate from '../scripts/gates/solver.mjs';
import { EXPECTED_IDS } from '../scripts/gates/index.mjs';
import { CATALOG } from '../scripts/gates/reserved.mjs';
import { clearMatrixCache } from '../scripts/lib/cfr.mjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));

/** run the real gate against a model and return its single verdict */
function runGate(model) {
  clearMatrixCache();
  const gates = [];
  const G = (id, pass, detail) => gates.push({ id, pass: !!pass, detail });
  const built = solverGate.build({ model, G });
  for (const s of built.sections) s.run();
  clearMatrixCache();
  assert.equal(gates.length, 1, 'the family emits exactly one gate');
  assert.equal(gates[0].id, 'I35');
  return gates[0];
}

/** the shipped model narrowed to `n` cells — cheap, and enough to trip the structural clauses */
function narrowed(n, patch = {}) {
  const keys = Object.keys(MODEL.cells)
    .filter((k) => Array.isArray(MODEL.cells[k].eq) && MODEL.cells[k].eq.length > 0)
    .sort().slice(0, n);
  const cells = {};
  for (const k of keys) cells[k] = MODEL.cells[k];
  return { ...MODEL, cells, meta: { ...MODEL.meta, ...patch } };
}

// ---------------------------------------------------------------------------
// the registry wiring — the three-line promotion, checked from outside
// ---------------------------------------------------------------------------

test('I35 is wired into the registry: family, EXPECTED_IDS, and catalog status agree', () => {
  assert.deepEqual(solverGate.ids, ['I35']);
  assert.ok(EXPECTED_IDS.includes('I35'), 'I35 must be in the frozen report order');
  const entry = CATALOG.find((e) => e.id === 'I35');
  assert.equal(entry.status, 'live');
  assert.equal(entry.runner, 'verify');
  // the catalog's claim must still describe what the gate does
  assert.match(entry.claim, /exploitability <= epsilon/);
  assert.match(entry.claim, /strategies sum to 1/);
  assert.match(entry.claim, /two independent seeds/);
  assert.match(entry.claim, /fixed-point-only/);
  assert.match(entry.note, /P2/, 'the entry must record that it went live a phase early, and why');
});

test('I35 sits before D10/D11, so the P1 report stays a strict prefix', () => {
  const i = EXPECTED_IDS.indexOf('I35');
  assert.ok(i > EXPECTED_IDS.indexOf('I44'), 'appended after lane M, not interleaved');
  assert.ok(i < EXPECTED_IDS.indexOf('D10'), 'the artifact-reading family stays last');
  assert.equal(i, EXPECTED_IDS.length - 3);
});

// ---------------------------------------------------------------------------
// the baseline — without this, every failure below proves nothing
// ---------------------------------------------------------------------------

test('I35 PASSES on the shipped model — the baseline the failures are measured against', () => {
  const g = runGate(MODEL);
  assert.equal(g.pass, true, g.detail);
  // the detail line must carry the numbers a reader needs, not just a verdict
  assert.match(g.detail, /exploitability at the 2000-iteration cap/);
  assert.match(g.detail, /6-MAX DEFERRED/);
  assert.match(g.detail, /a game where postflop does not exist/);
  assert.match(g.detail, /BB-POSITIVE/);
  assert.match(g.detail, /3\/9\/27\/81/);
  assert.match(g.detail, /the ladder is RE-DERIVED from the pot-limit rule, not read back/);
  // the two disclosure clauses report their zero unit counts rather than passing quietly
  assert.match(g.detail, /0 on-screen lists exist to check/);
  assert.match(g.detail, /0 shipped constants blocks to check/);
});

// ---------------------------------------------------------------------------
// the failures
// ---------------------------------------------------------------------------

test('I35 FAILS when the abstraction is not the 123-cell one it claims', () => {
  const g = runGate(narrowed(20));
  assert.equal(g.pass, false);
  assert.match(g.detail, /20 live cells, expected 123/);
});

test("I35 FAILS when epsilon is tighter than the payoff's own se — §6's rule, with teeth", () => {
  // a model claiming 1e14 trials per cell reports an se of ~5e-8, far under epsilon: the solver
  // would then be claiming precision the payoff cannot support, which is exactly what §6 forbids.
  const g = runGate(narrowed(20, { trials: { ...MODEL.meta.trials, cell: 1e14 } }));
  assert.equal(g.pass, false);
  assert.match(g.detail, /exceeds the payoff's own se floor/);
  assert.match(g.detail, /fake precision/);
});

test('the ladder and the structural counts are the gate\'s OWN copy, not read back from the module', () => {
  // This is the half of clause (e) that cannot be driven to failure from outside: `BLINDS` is
  // frozen and the two stacks are the gate's, so there is no input that makes `buildTree` disagree
  // with itself. What CAN be pinned is the thing that makes the comparison worth running — that
  // the expectation is an independent literal. A gate that derived 3/9/27/81 from the module would
  // be asking the tree whether it agrees with itself, and a moved blind would sail through.
  // (test/cfr.test.mjs derives the ladder a third time, from the pot-limit rule written out again.)
  const src = readFileSync(resolve(ROOT, 'scripts/gates/solver.mjs'), 'utf8');
  const expectBlock = src.slice(src.indexOf('const EXPECT'), src.indexOf('/** a payoff source'));
  assert.match(expectBlock, /ladder100: Object\.freeze\(\[3, 9, 27, 81\]\)/);
  assert.match(expectBlock, /ladder40: Object\.freeze\(\[3, 9, 27, 40\]\)/);
  assert.match(expectBlock, /nodes: 5, terminals: 9, cells: 123/);
  assert.ok(!/\bCFR\b|cfr\.mjs|buildTree|potLimitLadder/.test(expectBlock),
    'the structural expectations must not be computed from the module under test');
});

test('the gate imports its thresholds from cfr.mjs and types none of its own', () => {
  // A gate that types its own copy of a constant can drift from the thing it gates. The thresholds
  // come from the module (where the S-A anchor sits beside them); only the STRUCTURAL expectations
  // are written out, and those are the independent copy on purpose.
  const src = readFileSync(resolve(ROOT, 'scripts/gates/solver.mjs'), 'utf8');
  assert.match(src, /EPSILON_BB, ITER_CAP, TWO_SEED_TOL_POT/);
  const body = src.slice(src.indexOf('export function build'));
  assert.ok(!/5e-5|0\.0015|\b2000\b/.test(body),
    'the gate body must not carry a typed copy of epsilon, the two-seed tolerance or the cap');
});
