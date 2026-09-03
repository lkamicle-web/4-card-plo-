// tier-fixture-v3.test.mjs — the third tier baseline, and the B1 default flip that produced it.
//
// V3-PLAN §5.1 asks for `data/tiers-v3-default.fixture.txt` to be frozen at the new default state
// when item 8 flips the villain profile on at barrier B1, "alongside, not replacing, the v2
// fixture", with the printed tier diff committed into METHODOLOGY.
//
// WHY THIS IS A TEST AND NOT A GATE. §7.2 reserves gate ids at Phase 0 and names none for this
// fixture — it names I43 for the flip's MACHINERY, which is live in `scripts/gates/couplings.mjs`,
// and it names no id for the baseline. Inventing one here would defeat the point of reserving
// them, and promoting a reserved id that belongs to something else would be worse. `node --test`
// is one of the three GREEN checks, so this pin has the same teeth as a gate; what it does not
// have is a row in the gate report, which is correct, because §7.2 did not give it one. The same
// call `test/manifest.test.mjs` makes, for the same reason.
//
// WHAT WOULD MAKE THIS FILE RED. The pipeline painting a different tier at the DEFAULT state
// (which is the regression this baseline exists to catch); the ON and OFF fixtures drifting onto
// different surfaces, which would make the committed move diff a comparison of two different
// things; a flip that turns out to move nothing; and the page quietly un-flipping itself.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as P from '../scripts/lib/policy.mjs';
import * as TF2 from '../scripts/lib/tier-fixture-v2.mjs';
import * as TF3 from '../scripts/lib/tier-fixture-v3.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
P.hydrate(model);

const ON = TF3.parseFixture(readFileSync(resolve(ROOT, TF3.FIXTURE_PATH), 'utf8'));
const OFF = TF2.parseFixture(readFileSync(resolve(ROOT, TF2.FIXTURE_PATH), 'utf8'));

// ---------------------------------------------------------------------------
// the baseline itself
// ---------------------------------------------------------------------------
test('the v3 DEFAULT surface reproduces, bit for bit, over all 12 lanes', () => {
  const d = TF3.compareToFixture(model, ON, 5);
  assert.deepEqual(d.structural, []);
  assert.equal(d.settings, 0,
    `${d.settings}/${d.total} settings differ, ${d.cells} cell tiers:\n  ${d.examples.join('\n  ')}`);
  assert.equal(d.total, 16632);
  assert.equal(d.lanes, 12);
});

test('IT FAILS ON DRIFT — one flipped tier char is caught and named', () => {
  // A baseline nobody has watched fail is a baseline nobody should trust. Mutate ONE character of
  // ONE vector and the comparison must report exactly one moved setting, at that cell, with both
  // tiers spelled out.
  const i = 5000, j = 40;
  const hurt = { ...ON, sweep: ON.sweep.map((r, k) => (k !== i ? r : { ...r, vec: r.vec.slice(0, j) + (r.vec[j] === '1' ? '5' : '1') + r.vec.slice(j + 1) })) };
  const d = TF3.compareToFixture(model, hurt, 5);
  assert.equal(d.ok, false);
  assert.equal(d.settings, 1);
  assert.equal(d.cells, 1);
  assert.match(d.examples[0], new RegExp(ON.cells[j].replace(/[|]/g, '\\|')));
});

test('the header says what it is: profile ON, and NO v1 point', () => {
  // Every lane runs the villain profile, so no lane of this file is the v1 operating point. The
  // absence is asserted rather than left to a reader: a `v1-point` line here would be a claim of
  // v1 identity on a surface that does not have it, in a header the tooling reads.
  assert.equal(ON.v1Point, '');
  assert.match(ON.legacyState, /villains=on\(v=vpip,q=/);
  for (const L of ON.lanes) assert.match(L.villains, /^on\(v=vpip,q=/);
  // and the OFF fixture still says what IT is — the flip must not have touched it
  assert.equal(OFF.v1Point, TF2.V1_POINT_LANE());
  for (const L of OFF.lanes) assert.equal(L.villains || 'off', 'off');
});

// ---------------------------------------------------------------------------
// the two fixtures describe the same surface — what makes the move diff a diff
// ---------------------------------------------------------------------------
test('ON and OFF freeze the same cells, lanes and settings', () => {
  assert.deepEqual(ON.cells, OFF.cells);
  assert.deepEqual(ON.lanes.map((L) => L.id), OFF.lanes.map((L) => L.id));
  assert.deepEqual(ON.sweep.map(TF3.settingKey), OFF.sweep.map(TF2.settingKey));
  assert.deepEqual(ON.vpip, OFF.vpip);
});

test('the flip MOVED something, and the committed diff is what it moved', () => {
  const d = TF3.moveDiff(ON, OFF, 3);
  assert.deepEqual(d.problems, []);
  // A default flip whose surface is identical to the legacy one is a flip that did nothing — and
  // would mean the profile is not reaching the tiers, the exact gap tier-fixture-v2 records.
  assert.ok(d.movedCells > 0, 'the default flip moved no tier at all — the profile is not reaching solve');
  // The numbers METHODOLOGY §5.1's ceremony section quotes. Pinned here so the doc and the files
  // cannot drift apart silently: re-freezing the baseline without updating the write-up reddens.
  assert.equal(d.rows, 16632);
  assert.equal(d.movedRows, 15048);
  assert.equal(d.movedCells, 285708);
  assert.equal(d.totalCells, 2045736);
  assert.equal((100 * d.movedCells / d.totalCells).toFixed(3), '13.966');
  // The straddled shallow lanes move most and the deep unstraddled lanes least — depth is what
  // decides how much a re-sort of realization can matter, so this ordering is the mechanism
  // showing up in the diff rather than a coincidence worth ignoring.
  const byLane = [...d.byLane.entries()].sort((a, b) => b[1] - a[1]);
  assert.equal(byLane[0][0], 'd40/r0/s1');
  assert.equal(byLane[byLane.length - 1][0], 'd250/r5/s0');
});

// ---------------------------------------------------------------------------
// the flip, at both ends
// ---------------------------------------------------------------------------
test('the LIBRARY default is still OFF — the flip is the page\'s initial state only', () => {
  // This is I43(e)'s claim, restated where the fixture lives: `solve` never receives a profile, and
  // anything without `on: true` is OFF with object identity. If this ever fails, the "legacy state
  // semantics are untouched" argument that makes I22/I32 survive the flip has failed with it.
  assert.equal(P.villainProfileOf(undefined, model).on, false);
  assert.equal(P.VILLAIN_OFF.on, false);
  assert.equal(P.profiledModel(model, undefined), model);
  assert.equal(P.villainKey(undefined, model), 'OFF');
});

test('the PAGE default is ON, derived from the shipped lattice rather than typed', () => {
  const src = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  // the grep-gate idiom: the page must reach the default through policy, not by writing `vp: true`
  assert.match(src, /POL\.villainLoadDefault\(MODEL\)/);
  assert.match(src, /var VP_DEFAULT = [^\n]*VPLOAD\.on/);
  assert.match(src, /\n\s*S\.vp = VP_DEFAULT;/);
  assert.ok(!/\bvp:\s*true\b/.test(src), 'the page hard-codes the profile on — the load default must come from the lattice');
  // and the permalink writes it in BOTH directions, or "I turned the villains off" is lost from
  // every shared link the moment the default is on
  assert.match(src, /S\.vp !== VP_DEFAULT[\s\S]{0,80}'&vp='/);
  assert.match(src, /q\.vp === '0'/);
});

test('the load default lands on a MEASURED lattice row, at the page\'s own VPIP default', () => {
  // I43(b) asserts the policy load default is a lattice point. What it cannot see is that the page
  // reaches that point: this page has no separate villain-VPIP dial, so the profile's v IS the
  // table VPIP, and the guarantee only transfers if the two defaults coincide. They do — and if a
  // future dataset moves either one, the page declines the flip rather than opening on
  // interpolated numbers, which is the branch this pins.
  const def = P.villainLoadDefault(model);
  assert.equal(def.on, true);
  assert.equal(def.v, model.meta.vpip.default);
  assert.equal(def.q, model.constants.villainLattice.discipline);
  const shadow = P.profiledModel(model, def);
  assert.notEqual(shadow, model);
  let interpolated = 0, lattice = 0;
  for (const k of Object.keys(shadow.cells)) {
    const c = shadow.cells[k];
    if (!c.combos) continue;
    if (c.vpSource === 'interpolated') interpolated++;
    else if (c.vpSource === 'lattice') lattice++;
  }
  assert.equal(interpolated, 0);
  assert.equal(lattice, 123);
});
