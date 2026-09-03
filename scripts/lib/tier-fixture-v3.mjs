// tier-fixture-v3.mjs — the THIRD tier baseline: the page's state AFTER the B1 default flip.
//
// V3-PLAN §5.1, "The third fixture": *when item 8 flips the default at B1, freeze
// `data/tiers-v3-default.fixture.txt` at the new default state and commit the printed tier diff
// into METHODOLOGY — alongside, not replacing, the v2 fixture.*
//
// WHAT THIS IS, AND WHAT IT IS NOT.
//
//   `tiers-v2.fixture.txt` (gate I32) freezes the LEGACY LANE: every v3 axis at the setting where
//   it is the identity, villain profile OFF. It is the proof that v3 has not moved v2's product,
//   and the B1 flip must leave it green — which it does, because a default flip changes which
//   state the page OPENS in and changes no state's semantics. I22 and I32 keep running.
//
//   THIS file freezes the OTHER lane: the same 12 environment lanes with the villain profile ON,
//   which is what a fresh visitor now sees. Without it the flip would be the one change in this
//   program with no frozen record of what it did — every other mechanism enters as an axis that is
//   inert at legacy settings (§0.4(a)) and is therefore covered by I32 saying nothing moved. A
//   default flip is the case §0.4(c) exists for, and this file plus the diff printed at the freeze
//   is its evidence.
//
// NO NEW GATE ID. V3-PLAN §7.2 reserves ids at Phase 0 and names none for this fixture; §5.1 asks
// for a fixture and a committed diff, not for a gate. Inventing an id here would defeat the point
// of reserving them, so this baseline is pinned under `node --test`
// (`test/tier-fixture-v3.test.mjs`) — the precedent P1 set twice already, in
// `test/manifest.test.mjs` and in lane C's harness. `node --test` is one of the three GREEN
// checks, so the pin has the same teeth; what it does not have is a row in the gate report,
// which is correct, because §7.2 did not give it one.
//
// THE PROFILE THIS SWEEPS. On the page the villain profile's `v` is not a dial of its own — it is
// the TABLE VPIP slider, read through `profileNow()`. So the honest ON surface is not "one profile
// at v = 55 across every VPIP" but "the profile the page is actually running at each VPIP", which
// is what `profileFor` below builds. At v = 55 that lands on a measured lattice row (which is what
// gate I43(b) asserts, and what makes the LOAD default honest); away from 55 it is interpolated
// between lattice rows, and the fixture freezes those tiers too, because the user reaches them
// with one drag of the slider.

import { readFileSync } from 'node:fs';

import * as P from './policy.mjs';
import * as TF2 from './tier-fixture-v2.mjs';

export const FIXTURE_VERSION = TF2.FIXTURE_VERSION;
export const FIXTURE_PATH = 'data/tiers-v3-default.fixture.txt';

export const { codeOf, describeCode, fixtureCells, baseSettings, settingKey, envArgs,
  laneId, laneSpec, digestOf, parseFixture } = TF2;

/**
 * The v3 axes at the setting this fixture was frozen at — the SAME legacy settings the v2 fixture
 * carries, written out here for the same reason `TF2.LEGACY_LANE` is written out rather than spread
 * from `P.OPERATING_POINT`: what a fixture froze must not be able to follow a later default flip.
 *
 * B1 flipped exactly ONE default — item 8's villain profile. `rakeDepth`, `depthWidth` and `sizing`
 * are NOT flipped: `rake.potScale` is flagged unanchored opinion (METHODOLOGY limitation 16), no UI
 * control exists for either coupling yet (§8 is a later phase's work), and §3.1 names only "villain
 * default-on last (I43) with the default flip landing at barrier B1". An axis whose default nobody
 * has argued for stays at its identity setting.
 */
export const DEFAULT_LANE = Object.freeze({ rakeDepth: false, depthWidth: false, sizing: 1 });

/** the villain half of the frozen state, spelled out the way `LEGACY_STATE` spells out the rest */
export const villainsField = (model) => {
  const V = (model.constants && model.constants.villainLattice) || {};
  return `on(v=vpip,q=${V.discipline})`;
};

export const DEFAULT_STATE = (model) =>
  `limpers=2 raiserPos=CO mix=default villains=${villainsField(model)}`;

/**
 * The profile the page is running at a given table VPIP, in the shape `profiledModel` reads.
 *
 * `q` is the shipped discipline and never anything else: it is the ONE discipline the lattice was
 * measured at, `villainEq` refuses to interpolate an axis with one measurement on it, and a fixture
 * frozen at some other `q` would be a fixture of the random-villain numbers wearing a profile
 * label. `measured` is null — a Simulate result is a per-browser measurement and has no business in
 * a frozen baseline.
 */
export function profileFor(model, vp) {
  const V = (model.constants && model.constants.villainLattice) || {};
  return { on: true, v: vp, q: V.discipline, measured: null };
}

/**
 * The 12 environment lanes, identical to v2's, carrying the villain field so the header says which
 * surface this is and `digestOf` covers the difference. Reusing `TF2.laneSpecs` rather than
 * rebuilding the loop is deliberate: a lane set that could drift from I32's would make the move
 * diff below compare two different surfaces and call the difference a tier move.
 */
export function laneSpecs(model) {
  const villains = villainsField(model);
  return TF2.laneSpecs().map((L) => ({ ...L, villains }));
}

export function fixtureSettings(model, lanes = laneSpecs(model)) {
  return TF2.fixtureSettings(model, lanes);
}

/**
 * Run the pipeline over the sweep with the villain profile ON at each row's own VPIP.
 *
 * The shadow models are built ONCE PER VPIP and reused across the 12 lanes: `profiledModel` is a
 * pure function of (model, profile) and the profile does not read the environment, so the same
 * shadow is correct on every lane — and building 66 of them instead of 792 is the difference
 * between a sweep that takes seconds and one that takes minutes.
 */
export function sweepTiers(model, cells, settings, laneBy) {
  P.hydrate(model);
  const shadows = new Map();
  const shadowAt = (vp) => {
    let m = shadows.get(vp);
    if (!m) { m = P.profiledModel(model, profileFor(model, vp)); shadows.set(vp, m); }
    return m;
  };
  const out = [];
  for (const s of settings) {
    const L = laneBy.get(s.lane);
    if (!L) throw new Error(`tier fixture v3: no such lane ${s.lane}`);
    const solved = P.solve(shadowAt(s.vp), {
      pos: s.pos, node: s.node, v: s.vp / 100, limpers: 2, raiserPos: 'CO',
      ...envArgs(L),
      ...DEFAULT_LANE,
    });
    let vec = '';
    for (const k of cells) vec += codeOf(solved.cells[k]);
    out.push({ lane: s.lane, node: s.node, pos: s.pos, vp: s.vp, vec });
  }
  return out;
}

/** this fixture's own banner — its claim, in the file, where somebody grepping it will find it */
export function banner(model) {
  return [
    '# RUNDOWN — the v3 DEFAULT tier fixture. What the page paints after the B1 default flip.',
    '#',
    '# GENERATED FILE — never hand-edit. Written only by `node scripts/freeze-tiers.mjs --v3`, which',
    '# is a deliberate manual act (V3-PLAN §0.4(c)); no build step writes it.',
    '#',
    '# THE CLAIM (V3-PLAN §5.1, "The third fixture"): with item 8\'s villain profile ON — the state a',
    '# fresh visitor now loads into — the pipeline paints these tiers on all 12 environment lanes.',
    `# The profile is ${villainsField(model)}: on this page the villain VPIP IS the table VPIP slider,`,
    '# so each row is frozen at the profile the page is actually running at that row\'s VPIP. At the',
    '# LOAD VPIP the profile sits on a measured lattice row (gate I43(b)); away from it the equities',
    '# are interpolated between measured rows, and those tiers are frozen too, because the user',
    '# reaches them with one drag.',
    '#',
    '# THIS FILE DOES NOT REPLACE `tiers-v2.fixture.txt`, and no lane of it is the v1 operating point.',
    '# I22 and I32 keep asserting the LEGACY lane (villain profile OFF) beside it, which is the whole',
    '# reason a default flip is safe: it changes which state the page opens in, never what any state',
    '# means. There is no `v1-point` line below for exactly that reason.',
  ];
}

export function encodeFixture({ model, cells, lanes, sweep, generated }) {
  return TF2.encodeFixture({
    model, cells, lanes, sweep, generated,
    banner: banner(model), state: DEFAULT_STATE(model), v1Point: '',
  });
}

export function loadFixture(path) {
  return parseFixture(readFileSync(path, 'utf8'));
}

/**
 * Re-run the pipeline over the fixture's own settings and diff it — v2's `compareToFixture` with
 * the profile on, and with the structural checks that still apply.
 *
 * The v1-point clauses are deliberately NOT carried over: this fixture declares no v1 point,
 * because every lane of it runs the profile. What IS carried over is lane drift, since the whole
 * point of freezing the same 12 lanes is that the two fixtures describe the same surface.
 */
export function compareToFixture(model, fx, maxExamples = 5) {
  const structural = [];

  const nowCells = fixtureCells(model);
  const fxSet = new Set(fx.cells), nowSet = new Set(nowCells);
  const missing = fx.cells.filter((k) => !nowSet.has(k));
  const added = nowCells.filter((k) => !fxSet.has(k));
  if (missing.length) structural.push(`${missing.length} frozen cells are gone from the model (e.g. ${missing[0]})`);
  if (added.length) structural.push(`${added.length} cells are new since the freeze (e.g. ${added[0]})`);

  const nowLanes = laneSpecs(model);
  const fxLaneBy = new Map(fx.lanes.map((L) => [L.id, L]));
  for (const L of nowLanes) {
    const was = fxLaneBy.get(L.id);
    if (!was) { structural.push(`lane ${L.id} (${laneSpec(L)}) is in the surface now and was never frozen`); continue; }
    if (laneSpec(was) !== laneSpec(L)) structural.push(`lane ${L.id} drifted: frozen ${laneSpec(was)} -> now ${laneSpec(L)}`);
  }
  const nowIds = new Set(nowLanes.map((L) => L.id));
  for (const L of fx.lanes) if (!nowIds.has(L.id)) structural.push(`frozen lane ${L.id} (${laneSpec(L)}) is no longer in the surface`);

  const nowSettings = fixtureSettings(model, nowLanes);
  const fxKeys = new Set(fx.sweep.map(settingKey));
  const extra = nowSettings.filter((s) => !fxKeys.has(settingKey(s)));
  if (extra.length) structural.push(`${extra.length} settings exist now that the fixture never froze (e.g. ${settingKey(extra[0])})`);

  const cells = fx.cells;
  const actual = sweepTiers(model, cells, fx.sweep, fxLaneBy);
  let badSettings = 0, badCells = 0;
  const byLane = new Map();
  const examples = [];
  for (let i = 0; i < fx.sweep.length; i++) {
    const want = fx.sweep[i], got = actual[i];
    if (want.vec === got.vec) continue;
    badSettings++;
    for (let j = 0; j < cells.length; j++) {
      if (want.vec[j] === got.vec[j]) continue;
      badCells++;
      byLane.set(want.lane, (byLane.get(want.lane) || 0) + 1);
      if (examples.length < maxExamples) {
        examples.push(`${want.lane} ${want.node}/${want.pos}@v${want.vp} ${cells[j]} ` +
          `${describeCode(want.vec[j])} -> ${describeCode(got.vec[j])}`);
      }
    }
  }
  return {
    ok: badSettings === 0 && structural.length === 0,
    settings: badSettings, cells: badCells,
    total: fx.sweep.length, totalCells: fx.sweep.length * cells.length,
    lanes: fx.lanes.length, examples, structural, byLane,
  };
}

/**
 * THE MOVE DIFF — what the B1 flip actually did, taken between the two FROZEN FILES with no
 * pipeline in the middle.
 *
 * This is the artefact V3-PLAN §0.4(c) demands ("a deliberate re-freeze ... with the move-diff
 * printed and committed") and §5.1 sends into METHODOLOGY. Diffing the files rather than
 * re-solving both surfaces is the `compareV1Containment` idiom: it stays true on a day the
 * pipeline is broken, and it cannot accidentally compare a fixture against itself.
 *
 * @param {object} on   a parsed v3-default fixture (villain profile ON)
 * @param {object} off  a parsed v2 fixture (villain profile OFF)
 */
export function moveDiff(on, off, maxExamples = 12) {
  const problems = [];
  if (off.cells.length !== on.cells.length || off.cells.some((k, i) => k !== on.cells[i])) {
    problems.push(`the two fixtures froze different cell sets (${off.cells.length} vs ${on.cells.length}) — nothing below is comparable`);
    return { ok: false, problems, rows: 0, movedRows: 0, movedCells: 0, byLane: new Map(), byMove: new Map(), byRow: new Map(), examples: [] };
  }
  const offBy = new Map(off.sweep.map((r) => [settingKey(r), r]));
  const cells = on.cells;
  let movedRows = 0, movedCells = 0;
  const byLane = new Map(), byMove = new Map(), byRow = new Map();
  const examples = [];
  for (const got of on.sweep) {
    const was = offBy.get(settingKey(got));
    if (!was) { problems.push(`setting ${settingKey(got)} is in the ON fixture and not in the OFF one`); continue; }
    if (was.vec === got.vec) continue;
    movedRows++;
    for (let j = 0; j < cells.length; j++) {
      if (was.vec[j] === got.vec[j]) continue;
      movedCells++;
      byLane.set(got.lane, (byLane.get(got.lane) || 0) + 1);
      const move = `${describeCode(was.vec[j])} -> ${describeCode(got.vec[j])}`;
      byMove.set(move, (byMove.get(move) || 0) + 1);
      const row = cells[j].split('|')[0];
      byRow.set(row, (byRow.get(row) || 0) + 1);
      if (examples.length < maxExamples) {
        examples.push(`${got.lane} ${got.node}/${got.pos}@v${got.vp} ${cells[j]} ${move}`);
      }
    }
  }
  return {
    ok: problems.length === 0,
    problems,
    rows: on.sweep.length,
    totalCells: on.sweep.length * cells.length,
    movedRows, movedCells, byLane, byMove, byRow, examples,
  };
}
