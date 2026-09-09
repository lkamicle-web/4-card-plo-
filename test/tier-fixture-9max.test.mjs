// test/tier-fixture-9max.test.mjs — the FOURTH fixture kind, before the fixture exists.
//
// V4-PLAN §2.5. The file `data/tiers-9max.fixture.txt` is stage S3's ceremony to create, and §2.5
// requires it NOT to exist before the run — so everything about the kind that can be pinned without
// it is pinned here: the domain it will sweep, the state string it will freeze, the shared-seat
// enumeration gate I50 is defined on, and the REFUSAL that stands in for the file today.
//
// The refusal is the part worth having a test for. A fixture writer whose failure mode is "emit the
// rows that worked" produces a file whose gate then passes over a domain nobody chose, and that is
// a strictly worse outcome than no file at all. This asserts that it refuses instead, and that the
// census it refuses with is the actionable one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as P from '../scripts/lib/policy.mjs';
import * as TF2 from '../scripts/lib/tier-fixture-v2.mjs';
import * as TF3 from '../scripts/lib/tier-fixture-v3.mjs';
import * as TF9 from '../scripts/lib/tier-fixture-9max.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
P.hydrate(model);

// ---------------------------------------------------------------------------
// 1. the domain — the plan's prediction, measured
// ---------------------------------------------------------------------------
test('the nine-seat domain is 33 legal pairs x 66 VPIP x 12 lanes = 26,136 settings', () => {
  const lanes = TF9.laneSpecs(model);
  const base = TF9.baseSettings(model);
  const vpips = model.meta.vpip.max - model.meta.vpip.min + 1;
  assert.equal(lanes.length, 12);
  assert.equal(vpips, 66);
  // §2.5 PREDICTED 33 legal (pos, node) pairs. MEASURED: 33 — confirmed exactly, and the split is
  // {rfi 8, limps 8, raise 8, 3bet 9}, which is docs/spikes/V4-ladder.md §3's own reading.
  assert.equal(base.length / vpips, 33);
  const byNode = P.NODES.map((n) => P.seatsFor(9).filter((p) => !P.positionDisabled(p, n, 9)).length);
  assert.deepEqual(byNode, [8, 8, 8, 9]);
  assert.equal(TF9.fixtureSettings(model, lanes).length, 26136);
  // ...and the six-seat domain is untouched beside it, which is what makes this an ADDED axis
  assert.equal(TF2.baseSettings(model).length / vpips, 21);
});

test('the frozen state records seats=9, and the raiser is READ off the ladder, never typed', () => {
  const state = TF9.NINE_STATE(model);
  assert.match(state, /\bseats=9\b/, 'a fixture that did not record its seat count could be reproduced by a six-seat pipeline');
  // RAISER is `seatsFor(6)[2]`, and it must still BE the seat the two older fixtures froze — the
  // derivation exists so that gate I51(c) sees no new seat-name literal in this file, and it is
  // worth nothing if it names a different chair than the surface it claims to extend.
  assert.ok(TF2.LEGACY_STATE.includes(`raiserPos=${TF9.RAISER}`), 'the derived raiser is not the one v2 froze');
  assert.ok(TF3.DEFAULT_STATE(model).includes(`raiserPos=${TF9.RAISER}`), 'the derived raiser is not the one v3-default froze');
  // the rest of the state IS v3-default's, one axis apart
  assert.equal(state, TF3.DEFAULT_STATE(model).replace('mix=default', `mix=default seats=${TF9.SEATS}`));
  assert.equal(TF9.DEFAULT_LANE, TF3.DEFAULT_LANE, 'the v3 axes are v3-default\'s object, not a copy that can drift');
});

test('the fixture was CREATED by the ceremony, and its header records what it froze', () => {
  /* §2.5: "created at stage S3 (the file must not exist before the run)". Before the ceremony this
     test asserted the file's ABSENCE and told the next reader to replace it with the commit that
     created it — which is this. Replaced rather than deleted, because the claim that matters did
     not go away when the file arrived, it moved: the fixture exists, it is the one the ceremony
     wrote, and the writer's own refusal-without---force is what stands between those two facts.
     `--force` appears nowhere in this run's history; I48(a) asserts the same thing from the
     outside, by the SHAPE of the git diff (the three legacy fixtures unmodified, this one added). */
  const path = resolve(ROOT, TF9.FIXTURE_PATH);
  const fx = TF9.loadFixture(path);
  assert.equal(fx.sweep.length, 26136, 'the freeze did not write §2.5\'s predicted domain');
  assert.equal(fx.lanes.length, 12);
  assert.equal(fx.cells.length, 123);
  // the seat axis is IN the header, so a nine-seat fixture cannot be reproduced by a six-seat run
  assert.equal(fx.legacyState, TF9.NINE_STATE(model));
  assert.match(fx.legacyState, /seats=9/);
});

// ---------------------------------------------------------------------------
// 2. the shared seats — the enumeration gate I50 is defined on
// ---------------------------------------------------------------------------
test('the shared seats are five/five/five/six, not "all six" at any node', () => {
  const pairs = TF9.sharedPairs();
  assert.equal(TF9.OFFSET, 3, 'the ladder offset is computed, not typed — a tenth seat must move it');
  const by = (n) => pairs.filter((p) => p.node === n);
  // rfi: the LAST ladder seat is disabled at both sizes, leaving five.
  assert.equal(by('rfi').length, 5);
  // limps / raise: the FIRST-seat exclusion moves forward with the ladder, so the nine-seat chair
  // whose six-seat counterpart is the excluded first seat has nothing to be compared against.
  assert.equal(by('limps').length, 5);
  assert.equal(by('raise').length, 5);
  // 3bet: all six.
  assert.equal(by('3bet').length, 6);
  assert.equal(pairs.length, 21);

  const N = P.seatsFor(9), S = P.seatsFor(6);
  // every pair maps a nine-seat chair to its structural counterpart three rungs earlier
  for (const p of pairs) assert.equal(p.nine, N[S.indexOf(p.six) + TF9.OFFSET]);
  // and the two pairs §5.2 hands to I49 rather than I50 are absent from BOTH limps and raise
  const orphan = N[TF9.OFFSET];
  assert.equal(by('limps').some((p) => p.nine === orphan), false);
  assert.equal(by('raise').some((p) => p.nine === orphan), false);
  assert.equal(by('rfi').some((p) => p.nine === orphan), true, 'the same chair IS shared at rfi');
});

// ---------------------------------------------------------------------------
// 3. the reconstruction — preNesting must stay a copy of aggressiveSetUncached
// ---------------------------------------------------------------------------
test('preNesting is the policy layer\'s own three lines, and the grep says so', () => {
  // `aggressiveSet` is memoised on a key that does not carry the ring payload, so I52's tripwire
  // cannot go through it and `preNesting` re-derives the set from the un-memoised `rankTable`. The
  // risk that creates is a copy drifting from its original, and this is the guard: the three lines
  // it reproduces must still be the three lines policy.mjs runs.
  const src = readFileSync(resolve(ROOT, 'scripts/lib/policy.mjs'), 'utf8');
  const body = src.slice(src.indexOf('function aggressiveSetUncached'));
  assert.ok(body.includes('const w = widthFor(pos, node, v, t.env);'), 'the percentile cut moved');
  assert.ok(body.includes('const gate = t.N >= CONSTANTS.nutGate[2];'), 'the nut gate moved');
  assert.ok(body.includes('const need = nuMin(t.N);'), 'the nut floor moved');
  assert.ok(body.includes('if (r.cumMid >= w) break;'), 'the cut condition moved');
  assert.ok(body.includes('if (gate && r.cell.nu < need) continue;'), 'the demotion moved');
});

test('painted() adds exactly the union cascade, and nothing when the chain is empty', () => {
  const lanes = TF9.laneSpecs(model);
  const L = lanes[0];
  const env = P.envOf({ limpers: 2, raiserPos: TF9.RAISER, seats: 9, ...TF2.envArgs(L), ...TF9.DEFAULT_LANE });
  const o = { limpers: 2, raiserPos: TF9.RAISER, env };
  const chain = P.nestChain('rfi', 9);

  // the FIRST seat of the chain unions nothing — ci === 0
  const first = TF9.painted(model, chain[0], 'rfi', 0.55, 9, o);
  assert.equal(first.from.size, 0);
  assert.deepEqual([...first.set].sort(), [...first.own].sort());

  // a later seat's painted set contains its own, and every extra is attributed to a front seat
  const later = TF9.painted(model, chain[chain.length - 1], 'rfi', 0.55, 9, o);
  for (const k of later.own) assert.ok(later.set.has(k), 'the cascade dropped a cell the seat paints itself');
  for (const k of later.set) {
    if (later.own.has(k)) continue;
    assert.ok(later.from.has(k), `${k} entered the painted set with no front seat carrying it`);
    assert.ok(chain.includes(later.from.get(k)), 'a cell was attributed to a seat outside the chain');
  }
  // the vs-3-bet node nests nothing, at either size
  assert.deepEqual(P.nestChain('3bet', 9), []);
  assert.equal(TF9.painted(model, P.seatsFor(9)[4], '3bet', 0.55, 9, o).from.size, 0);
});

// ---------------------------------------------------------------------------
// 4. containment — the arithmetic gate I50(ii) is scored on, shown to fail
// ---------------------------------------------------------------------------
test('containment names a subset violation, and an excess cell nobody carried', () => {
  const S = (...k) => new Set(k);
  // equality: no missing, no excess
  assert.deepEqual({ ...TF9.containment(S('a', 'b'), S('a', 'b')), byFront: null },
    { missing: 0, excess: 0, unexplained: 0, byFront: null });
  // a STRICT SUPERSET is an expected outcome, not a failure — provided the extra is attributed
  const ok = TF9.containment(S('a', 'b', 'c'), S('a', 'b'), new Map([['c', 'front']]));
  assert.equal(ok.missing, 0);
  assert.equal(ok.excess, 1);
  assert.equal(ok.unexplained, 0);
  assert.equal(ok.byFront.get('front'), 1);
  // THE FABRICATED VIOLATORS. A cell the six-seat set paints and the nine-seat one drops:
  assert.equal(TF9.containment(S('a'), S('a', 'b')).missing, 1);
  // ...and an excess cell no front seat carried, which is the clause that stops "it grew" from
  // being an explanation for anything at all.
  assert.equal(TF9.containment(S('a', 'b'), S('a'), new Map()).unexplained, 1);
});

// ---------------------------------------------------------------------------
// 5. the refusal — a writer that would rather emit nothing than emit a hole
// ---------------------------------------------------------------------------
test('sweepTiers REFUSES the nine-seat surface without a ring, and says exactly what refused', () => {
  // Scoped to one lane so the test costs a second rather than six. 720 settings refuse over the 12
  // lanes and the split is NOT uniform: the straddler is one more defender behind every seat, so a
  // straddled lane refuses 90 (15 VPIP points x 6 pairs) and an unstraddled one 30 (5 x 6). This
  // lane is the unstraddled reference lane, and 6 x 30 + 6 x 90 = 720 is the whole census.
  const lanes = TF9.laneSpecs(model).slice(0, 1);
  const cells = TF9.fixtureCells(model);
  const settings = TF9.fixtureSettings(model, lanes);
  assert.equal(settings.length, 2178);
  let e = null;
  try { TF9.sweepTiers(model, cells, settings, new Map(lanes.map((L) => [L.id, L])), null); }
  catch (err) { e = err; }
  assert.ok(e, 'the writer produced a fixture for a domain it cannot answer');
  assert.equal(e.name, 'NineSeatIncomplete');
  assert.equal(e.census.total, 2178);
  assert.equal(e.census.refused, 30);
  assert.equal(e.census.solved, 2148);
  // the census walks the WHOLE sweep rather than aborting on the first failure: six pairs — exactly
  // the six seats of this node's nesting chain — five settings each on this lane, all at limps.
  assert.equal(e.census.byPair.size, 6);
  for (const [k, n] of e.census.byPair) {
    assert.match(k, /\|limps$/, `${k} refused at a node other than limps`);
    assert.equal(n, 5);
  }
  assert.match(e.message, /data\/ring\.json/, 'the refusal does not name the payload it wants');
});

test('the refusal is the RING accessor failing closed, not a clamp anywhere', () => {
  // The two independent causes, both measured at S2 and both recorded in the library header:
  //   1. `solve` hands no ring down at all, so the accessor throws even when the artifact exists;
  //   2. with a ring supplied directly, a villain-profiled cell REFUSES to mix profiled 1..7
  //      columns with unprofiled 8..9 — and at profile ON every live cell is profiled.
  const ring = { meta: { nMax: 9 }, cells: {} };
  for (const it of P.cellList(model)) ring.cells[it.key] = { eq: [it.cell.eq[6], it.cell.eq[6]] };
  const shadow = P.profiledModel(model, TF9.profileFor(model, 90));
  assert.equal(P.cellList(shadow).every((it) => it.cell.vpSource), true,
    'at profile ON not every live cell is profiled — the refusal below is measuring something else');

  const L = TF9.laneSpecs(model).find((x) => x.straddle && x.d === P.CONSTANTS.depth.max);
  const env = P.envOf({ limpers: 2, raiserPos: TF9.RAISER, seats: 9, ...TF2.envArgs(L), ...TF9.DEFAULT_LANE });
  const front = P.nestChain('limps', 9)[0];
  const opts = { limpers: 2, raiserPos: TF9.RAISER, env };

  /* RE-POINTED AT S3, WHERE CAUSE 2 WAS FIXED RATHER THAN DOCUMENTED. Delta F3 gives the accessor
     the ring's OWN vDelta lattice and the shadow cell its own profile `v`, so a profiled nine-seat
     read is now profiled on BOTH sides of the join at the same `v` — which is the property the old
     blanket refusal was protecting by refusing outright. What must still fail closed is a join it
     cannot make honestly, and that is what this test now measures, in three ways instead of one. */

  // (1) a ring with NO vDelta lattice cannot profile its own columns, so it still refuses.
  assert.throws(
    () => P.rankTable(shadow, front, 'limps', 0.90, { ...opts, ring }),
    /carries no vDelta lattice — refusing to mix/,
    'a profiled cell silently accepted ring columns that cannot be profiled');

  // (2) a MEASURED profile keeps the refusal permanently: the ring has no measured columns, and a
  //     nine-wide Simulate result never reaches a cell anyway (villainEq drops it on length). This
  //     is a limitation METHODOLOGY carries, not a hole to widen the accessor for.
  const measuredish = { meta: { nMax: 9, v: [1, 2] }, cells: {} };
  for (const it of P.cellList(model)) {
    measuredish.cells[it.key] = { eq: [it.cell.eq[6], it.cell.eq[6]], vDelta: { 1: [0, 0], 2: [0, 0] } };
  }
  const asMeasured = { ...P.cellList(shadow)[0].cell, vpSource: 'measured' };
  assert.throws(
    () => P.eqAtSeats(asMeasured, 8.2, 9, measuredish, P.cellList(shadow)[0].key),
    /villain-profiled from a measured source and the ring columns are not/,
    'a MEASURED profile was joined to ring columns that cannot reproduce it');

  // (3) ...and with the REAL artifact, whose lattice IS the model's, the profiled read SUCCEEDS.
  //     This is the whole of delta F3: it is why the 720 settings lane F measured as refusals are
  //     now measured settings, and why I50's comparison count went 16,272 -> 16,632.
  const real = JSON.parse(readFileSync(resolve(ROOT, 'data/ring.json'), 'utf8'));
  assert.deepEqual(real.meta.v, model.constants.villainLattice.v,
    'the ring lattice is not the model lattice — the two halves of a profiled join are not the same axis');
  assert.doesNotThrow(() => P.rankTable(shadow, front, 'limps', 0.90, { ...opts, ring: real }));

  // ...and the UNPROFILED model at the same setting reads even the stub ring happily, which is what
  // makes every refusal above a statement about the JOIN rather than about nine seats.
  assert.doesNotThrow(() => P.rankTable(model, front, 'limps', 0.90, { ...opts, ring }));
});

// ---------------------------------------------------------------------------
// 6. compareToFixture's structural clauses, on fabricated fixtures
// ---------------------------------------------------------------------------
test('a fixture frozen at another seat count cannot reproduce green', () => {
  // The clause that stops `seats` defaulting back to six somewhere in the stack from being
  // invisible. A hand-built parsed fixture is enough: the structural half runs before the sweep.
  const lanes = TF9.laneSpecs(model);
  const cells = TF9.fixtureCells(model);
  const fake = {
    version: TF9.FIXTURE_VERSION, modelHash: model.meta.hash, frozen: '2026-01-01',
    legacyState: TF3.DEFAULT_STATE(model), v1Point: '',
    vpip: [model.meta.vpip.min, model.meta.vpip.max],
    cells, lanes, sweep: [], digest: '',
  };
  const d = TF9.compareToFixture(model, fake, 2, null);
  assert.equal(d.ok, false);
  assert.ok(d.structural.some((s) => /is not describing the surface the code would paint/.test(s)),
    `the seat-state clause did not fire: ${d.structural.join(' | ')}`);
  // ...and the empty sweep is itself a widened domain, which is the other structural clause
  assert.ok(d.structural.some((s) => /settings exist now that the fixture never froze/.test(s)));
});
