// tier-fixture-9max.mjs — the FOURTH tier baseline: the v3-default surface at NINE SEATS.
//
// V4-PLAN §2.5: *`data/tiers-9max.fixture.txt`: the v3-default environment surface (12 lanes of
// depth {40, 100, 250} x rake {0, preset} x straddle {off, on}, villain profile ON, every other
// axis at its default) at `seats = 9` — predicted 33 legal pairs x 66 VPIP x 12 lanes = 26,136
// settings.* Gate **I49** compares every run against it.
//
// WHAT THIS IS, AND WHY IT IS NOT A RE-FREEZE. §0.4 forbids option (c), a deliberate re-freeze, for
// the whole of v4. The seat axis enters as option (a), a new axis inert at legacy settings, and the
// three legacy fixtures keep asserting the six-seat surface UNCHANGED — that is gate I48(a), which
// reads the shape of the run's own diff (`data/tiers-*.fixture.txt` unmodified, this file ADDED).
// This file is the other half of the same statement: the nine-seat surface has its own frozen
// record from the first day it exists, so nobody ever has to argue later about what the ladder
// painted before some change.
//
// THE SURFACE IT FREEZES. Everything about it is the v3-default fixture's, with ONE axis moved:
//
//     33 legal (pos, node) pairs at nine seats  x  every integer v in 25..90
//        x depth {40, 100, 250}  x  rake {0, preset}  x  straddle {off, on}
//        x villain profile ON at the row's own VPIP  x  seats = 9
//
//     = 12 environment lanes x 2,178 settings = 26,136 settings x 123 cells = 3,214,728 tiers.
//
// The 33 is MEASURED, not assumed: `{rfi 8, limps 8, raise 8, 3bet 9}` (docs/spikes/V4-ladder.md
// §3), and §2.5's prediction of 33 is confirmed exactly. `baseSettings` below re-derives it from
// `positionDisabled(pos, node, 9)` on every run, so a structural exclusion that appeared or
// disappeared would show up as a widened domain rather than as a silently smaller fixture.
//
// NO NEW FORMAT. `encodeFixture` / `parseFixture` / `digestOf` are v2's, shared with v3-default for
// the reason `tier-fixture-v2.mjs` gives: one format means one parser, and a second copy of the
// delta encoding is a second place for a fixture to be silently misread. The only header field that
// moves is `legacy-state`, which carries `seats=9`; `compareToFixture` asserts that string against
// what the code would write today, so the seat axis cannot slide underneath a frozen file.
//
// -----------------------------------------------------------------------------------------------
// THE MEASURED BLOCKER, RECORDED HERE BECAUSE IT IS THIS FILE'S PRECONDITION (stage S2, lane F).
//
// At nine seats the profile-ON surface is NOT solvable with the policy layer as S1 left it, and it
// is not merely a matter of `data/ring.json` being absent. MEASURED over the full 26,136 settings:
// 25,416 solve and **720 (2.755 %) refuse**, all of them at `limps`, exactly the six seats of
// `nestChain('limps', 9)` (UTG+1, UTG+2, LJ, HJ, CO, BTN) at 120 settings each — the straddled
// lanes at VPIP 76..90 and the unstraddled at 86..90, in every one of the 12 lanes. Worst raw
// `N_eff` 8.162 at `UTG1|limps`. Two independent causes, both of them fail-closed by design:
//
//   1. `solve` NEVER HANDS THE RING DOWN. `solveUncached` builds `opts = {limpers, raiserPos, env}`
//      (policy.mjs:2258) and `rankTable` reads `opts.ring` (:1675), so `scoreCell` is called with
//      `ring === undefined` and `ringCols` throws for every `N_eff > 7` cell even when the artifact
//      exists on disk. The refusal is correct — it is exactly the silent `cells` read at N > 7 that
//      §0.2 forbids — but nothing above it can supply what it wants.
//   2. THE PROFILED CELLS REFUSE THE RING COLUMNS. With a ring payload supplied directly to
//      `rankTable`, the same settings throw `... is villain-profiled and the ring columns are not
//      — refusing to mix`. At profile ON **all 123 live cells carry `vpSource`** (measured at
//      VPIP 90), so the refusal fires on the first cell of every affected row. This is S1's own
//      undelivered `vDeltaAtSeats` policyDelta seen from the fixture side.
//
// Both are filed as policyDeltas for stage S3 (docs/spikes/V4-fixtures.md). Until they land this
// writer REFUSES TO FREEZE and prints the whole accounting — it does not clamp, it does not proxy,
// and it does not quietly emit a 25,416-row file wearing a 26,136-row claim. A fixture with a hole
// in it is worse than no fixture: I49 would then pass over a domain nobody chose.
//
// `scripts/freeze-tiers.mjs --seats9` is the sole writer, as for the other three. Nothing here
// writes the file. Node-only. Not injected into index.html.

import { readFileSync } from 'node:fs';

import * as P from './policy.mjs';
import * as TF2 from './tier-fixture-v2.mjs';
import * as TF3 from './tier-fixture-v3.mjs';

export const FIXTURE_VERSION = TF2.FIXTURE_VERSION;
export const FIXTURE_PATH = 'data/tiers-9max.fixture.txt';

/** the table size this fixture freezes. `{6, 9}` is a SET (§0.2); this is the other member. */
export const SEATS = 9;

export const { codeOf, describeCode, fixtureCells, settingKey, envArgs,
  laneId, laneSpec, digestOf, parseFixture } = TF2;

/** the v3 axes at the setting this fixture was frozen at — v3-default's, written out, not spread */
export const DEFAULT_LANE = TF3.DEFAULT_LANE;

export const villainsField = TF3.villainsField;
export const profileFor = TF3.profileFor;

/**
 * The non-environment half of the frozen state. v3-default's string plus the one axis that moved.
 *
 * `seats=9` is IN THE HEADER and asserted by `compareToFixture`, which is the whole reason it is a
 * string rather than an inference: a fixture that recorded no seat count would reproduce green
 * against a six-seat pipeline the day someone changed the default, and the gate would be asserting
 * the wrong surface while printing the right name.
 */
export const NINE_STATE = (model) =>
  `limpers=2 raiserPos=${RAISER} mix=default seats=${SEATS} villains=${villainsField(model)}`;

/**
 * The default raiser every row of this sweep is solved against — the v2 / v3-default fixtures'
 * own, READ OFF THE LADDER rather than typed.
 *
 * `seatsFor(6)[2]` is the third seat of the six-seat ladder, which is the seat those fixtures name
 * in their frozen `raiserPos=` field. It is derived here for the reason gate I51(c) exists: this
 * file is new code, and new code does not get to add a seat-name literal to a repository whose
 * whole v4 claim is that every consumer takes its list from `seatsFor`. `test/tier-fixture-9max.test.mjs`
 * pins it against the string the two older fixtures froze, so the derivation cannot drift off them.
 */
export const RAISER = P.seatsFor(6)[2];

/** the same 12 lanes as v2 / v3-default, carrying the villain field. Reused, never rebuilt. */
export function laneSpecs(model) { return TF3.laneSpecs(model); }

/**
 * The (node, position, VPIP) half of the sweep at NINE seats — the 33 legal pairs x 66 VPIPs.
 *
 * Derived from `positionDisabled(pos, node, 9)` on every call rather than from a list, so the
 * domain is a function of the ladder and not a copy of it. §2.5 predicted 33 pairs; the measurement
 * is 33 — `{rfi 8, limps 8, raise 8, 3bet 9}`.
 */
export function baseSettings(model) {
  const lo = model.meta.vpip.min, hi = model.meta.vpip.max;
  const out = [];
  for (const node of P.NODES) {
    for (const pos of P.seatsFor(SEATS)) {
      if (P.positionDisabled(pos, node, SEATS)) continue;
      for (let vp = lo; vp <= hi; vp++) out.push({ node, pos, vp });
    }
  }
  return out;
}

/** the full 26,136-row domain: lane outermost, then node, position, VPIP — v2's order */
export function fixtureSettings(model, lanes = laneSpecs(model)) {
  const base = baseSettings(model);
  const out = [];
  for (const L of lanes) for (const s of base) out.push({ lane: L.id, node: s.node, pos: s.pos, vp: s.vp });
  return out;
}

/** the solve state for one row — the one place `seats` and the ring payload enter */
export function solveState(s, L, ring) {
  return {
    pos: s.pos, node: s.node, v: s.vp / 100, limpers: 2, raiserPos: RAISER,
    seats: SEATS, ring,
    ...envArgs(L),
    ...DEFAULT_LANE,
  };
}

/**
 * Thrown when the pipeline cannot answer every row of the domain. Carries the census rather than
 * the first failure, because "which settings, and why" is the actionable thing and a stack trace
 * from row 4,113 is not.
 */
export class NineSeatIncomplete extends Error {
  constructor(census) {
    super(`the nine-seat surface is not solvable today: ${census.refused} of ${census.total} `
      + `settings (${(100 * census.refused / census.total).toFixed(3)} %) refuse. `
      + census.lines.join(' | '));
    this.name = 'NineSeatIncomplete';
    this.census = census;
  }
}

/**
 * Run the pipeline over the sweep with the villain profile ON at each row's own VPIP and
 * `seats = 9`. Shadow models are built once per VPIP and reused across the 12 lanes, for the
 * reason `tier-fixture-v3.mjs` gives.
 *
 * WALKS THE WHOLE SWEEP EVEN WHEN IT IS FAILING. A writer that aborted on the first refusal would
 * report one setting and hide 719; the census is what tells stage S3 which policyDeltas it needs.
 */
export function sweepTiers(model, cells, settings, laneBy, ring = null) {
  P.hydrate(model);
  const shadows = new Map();
  const shadowAt = (vp) => {
    let m = shadows.get(vp);
    if (!m) { m = P.profiledModel(model, profileFor(model, vp)); shadows.set(vp, m); }
    return m;
  };
  const out = [];
  const byPair = new Map(), byReason = new Map();
  let refused = 0;
  let worst = null;
  for (const s of settings) {
    const L = laneBy.get(s.lane);
    if (!L) throw new Error(`tier fixture 9max: no such lane ${s.lane}`);
    let solved = null;
    try { solved = P.solve(shadowAt(s.vp), solveState(s, L, ring)); } catch (e) {
      refused++;
      const k = `${s.pos}|${s.node}`;
      byPair.set(k, (byPair.get(k) || 0) + 1);
      const r = e.message.replace(/for [A-Z0-9_]+\|[A-Z]+$/, 'for <cell>').replace(/^policy: [A-Z0-9_]+\|[A-Z]+ /, 'policy: <cell> ');
      byReason.set(r, (byReason.get(r) || 0) + 1);
      if (!worst) worst = `${s.lane} ${s.node}/${s.pos}@v${s.vp}: ${e.message}`;
      out.push(null);
      continue;
    }
    let vec = '';
    for (const k of cells) vec += codeOf(solved.cells[k]);
    out.push({ lane: s.lane, node: s.node, pos: s.pos, vp: s.vp, vec });
  }
  if (refused) {
    const lines = [
      `by pair ${[...byPair.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' ')}`,
      ...[...byReason.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${n}x ${r}`),
      `first ${worst}`,
    ];
    throw new NineSeatIncomplete({ total: settings.length, refused, solved: settings.length - refused, byPair, byReason, lines });
  }
  return out;
}

/** this fixture's own banner — its claim, in the file, where somebody grepping it will find it */
export function banner(model) {
  return [
    '# RUNDOWN — the 9-MAX tier fixture. What the ladder paints at nine seats (V4-PLAN §2.5).',
    '#',
    '# GENERATED FILE — never hand-edit. Written only by `node scripts/freeze-tiers.mjs --seats9`,',
    '# which is a deliberate manual act; no build step writes it. Gate I49 reads it and never',
    '# writes it, because a gate that regenerates its own expectation asserts nothing.',
    '#',
    '# THE CLAIM (V4-PLAN §2.5, gate I49): at `seats = 9`, on the v3-DEFAULT surface — the villain',
    `# profile ON at each row's own VPIP, ${villainsField(model)} — the pipeline paints these tiers`,
    '# on all 12 environment lanes, at all 33 legal (position, node) pairs the nine-seat ladder',
    '# makes legal. The 33 is re-derived from `positionDisabled(pos, node, 9)` on every run.',
    '#',
    '# THIS FILE REPLACES NOTHING. V4-PLAN §0.4 admits the seat axis as a NEW AXIS THAT IS INERT AT',
    '# SIX SEATS and FORBIDS a re-freeze: `tiers-v1`, `tiers-v2` and `tiers-v3-default` are',
    '# byte-unchanged across the whole v4 run and I22 / I32 / the v3 pin keep asserting them. Gate',
    '# I48(a) reads the shape of that diff — the three legacy fixtures UNMODIFIED, this one ADDED —',
    '# because `--force` is a CLI flag that never appears in a commit message, so the checkable',
    '# artifact is the diff and not the log.',
    '#',
    '# THE SUB-LADDER DIFF the freeze prints (§2.5) is the evidence gate I50 is scored on: for every',
    '# shared seat where the pair is legal at BOTH sizes, which readings differ between the 9-max row',
    "# and its 6-max counterpart, and how many cells the nesting post-pass unioned into that seat.",
  ];
}

export function encodeFixture({ model, cells, lanes, sweep, generated }) {
  return TF2.encodeFixture({
    model, cells, lanes, sweep, generated,
    banner: banner(model), state: NINE_STATE(model), v1Point: '',
  });
}

export function loadFixture(path) {
  return parseFixture(readFileSync(path, 'utf8'));
}

/**
 * Re-run the pipeline over the fixture's own settings and diff it — v3-default's comparison at nine
 * seats, plus the two structural clauses this fixture adds.
 *
 * THE SEAT CLAUSE is the one that is new and the one that matters: the frozen `legacy-state` must
 * still be the string the code would write, so a fixture frozen at nine seats cannot be reproduced
 * green by a six-seat pipeline. Without it, `seats` defaulting back to 6 somewhere in the stack
 * would show up as thousands of moved tiers if you were lucky and as nothing at all if the six- and
 * nine-seat answers happened to coincide on the rows the gate looked at.
 */
export function compareToFixture(model, fx, maxExamples = 5, ring = null) {
  const structural = [];

  const nowCells = fixtureCells(model);
  const fxSet = new Set(fx.cells), nowSet = new Set(nowCells);
  const missing = fx.cells.filter((k) => !nowSet.has(k));
  const added = nowCells.filter((k) => !fxSet.has(k));
  if (missing.length) structural.push(`${missing.length} frozen cells are gone from the model (e.g. ${missing[0]})`);
  if (added.length) structural.push(`${added.length} cells are new since the freeze (e.g. ${added[0]})`);

  // the seat axis itself, read off the header rather than inferred
  const nowState = NINE_STATE(model);
  if (fx.legacyState !== nowState) {
    structural.push(`the frozen state is '${fx.legacyState}' and the pipeline's is '${nowState}' — `
      + 'this fixture is not describing the surface the code would paint');
  }

  const nowLanes = laneSpecs(model);
  const fxLaneBy = new Map(fx.lanes.map((L) => [L.id, L]));
  for (const L of nowLanes) {
    const was = fxLaneBy.get(L.id);
    if (!was) { structural.push(`lane ${L.id} (${laneSpec(L)}) is in the surface now and was never frozen`); continue; }
    if (laneSpec(was) !== laneSpec(L)) structural.push(`lane ${L.id} drifted: frozen ${laneSpec(was)} -> now ${laneSpec(L)}`);
  }
  const nowIds = new Set(nowLanes.map((L) => L.id));
  for (const L of fx.lanes) if (!nowIds.has(L.id)) structural.push(`frozen lane ${L.id} (${laneSpec(L)}) is no longer in the surface`);

  // a widened domain: settings that exist now and were never frozen — the clause that catches a
  // structural exclusion disappearing, which at nine seats is a whole new (pos, node) pair
  const nowSettings = fixtureSettings(model, nowLanes);
  const fxKeys = new Set(fx.sweep.map(settingKey));
  const extra = nowSettings.filter((s) => !fxKeys.has(settingKey(s)));
  if (extra.length) structural.push(`${extra.length} settings exist now that the fixture never froze (e.g. ${settingKey(extra[0])})`);

  const cells = fx.cells;
  let actual = null, refusal = null;
  try { actual = sweepTiers(model, cells, fx.sweep, fxLaneBy, ring); } catch (e) {
    if (!(e instanceof NineSeatIncomplete)) throw e;
    refusal = e;
    structural.push(e.message);
  }
  let badSettings = 0, badCells = 0;
  const byLane = new Map();
  const examples = [];
  if (actual) {
    for (let i = 0; i < fx.sweep.length; i++) {
      const want = fx.sweep[i], got = actual[i];
      if (want.vec === got.vec) continue;
      badSettings++;
      for (let j = 0; j < cells.length; j++) {
        if (want.vec[j] === got.vec[j]) continue;
        badCells++;
        byLane.set(want.lane, (byLane.get(want.lane) || 0) + 1);
        if (examples.length < maxExamples) {
          examples.push(`${want.lane} ${want.node}/${want.pos}@v${want.vp} ${cells[j]} `
            + `${describeCode(want.vec[j])} -> ${describeCode(got.vec[j])}`);
        }
      }
    }
  }
  return {
    ok: !refusal && badSettings === 0 && structural.length === 0,
    settings: badSettings, cells: badCells,
    total: fx.sweep.length, totalCells: fx.sweep.length * cells.length,
    lanes: fx.lanes.length, examples, structural, byLane, refusal,
  };
}

// ---------------------------------------------------------------------------
// the sub-ladder: the shared seats, and the machinery gate I50 is scored on
// ---------------------------------------------------------------------------
/**
 * The ladder offset. `LADDER9[i + OFFSET]` is the structural counterpart of `POSITIONS[i]`:
 * LJ<->UTG, HJ<->HJ, CO<->CO, BTN<->BTN, SB<->SB, BB<->BB. Computed, never typed — a nine-seat
 * ladder that grew a tenth seat would move this rather than silently mis-pair every comparison.
 */
export const OFFSET = P.seatsFor(9).length - P.seatsFor(6).length;

/**
 * The (node, seat9, seat6) triples I50 compares — **every shared seat where the pair is legal at
 * BOTH sizes**, which is not "all six" at any node.
 *
 * At `rfi`, `BB` is disabled at both, leaving five (LJ..SB). At `limps` and `raise` the first-seat
 * exclusion MOVES FORWARD with the ladder — `UTG` is excluded at six and at nine — so `LJ`, whose
 * six-seat counterpart IS `UTG`, has no counterpart to be compared against and five remain
 * (HJ..BB). `LJ|limps` and `LJ|raise` are gate I49's business, not I50's. At `3bet` all six.
 * Twenty-one shared pairs in total, which is a coincidence of arithmetic with the six-seat legal
 * count and not the same number.
 */
export function sharedPairs() {
  const N = P.seatsFor(9), S = P.seatsFor(6);
  const out = [];
  for (const node of P.NODES) {
    for (let i = 0; i < S.length; i++) {
      const six = S[i], nine = N[i + OFFSET];
      if (P.positionDisabled(six, node, 6)) continue;
      if (P.positionDisabled(nine, node, 9)) continue;
      out.push({ node, nine, six });
    }
  }
  return out;
}

/**
 * The aggressive set BEFORE the nesting post-pass, reconstructed exactly as
 * `policy.mjs`'s own `aggressiveSetUncached` builds it (percentile cut, then the nut gate).
 *
 * WHY A RECONSTRUCTION RATHER THAN AN EXPORT. `aggressiveSet` is memoised on a key that does not
 * carry the ring payload, so a gate that perturbed `data/ring.json` and called it again would be
 * handed the previous answer — `envKey`'s own documented trap, one level down. `rankTable` is NOT
 * memoised, so going through it is what makes I52's perturbation tripwire mean anything. The
 * reconstruction is four lines and every one of them is a line of `aggressiveSetUncached`; if that
 * function changes and this does not, I50's own equality clause at six seats fires.
 */
export function preNesting(model, pos, node, v, opts) {
  const t = P.rankTable(model, pos, node, v, opts);
  const w = P.widthFor(pos, node, v, t.env);
  const gate = t.N >= P.CONSTANTS.nutGate[2];
  const need = P.nuMin(t.N);
  const set = new Set();
  for (const r of t.rows) {
    if (r.cumMid >= w) break;
    if (gate && r.cell.nu < need) continue;
    set.add(r.key);
  }
  return { set, w, N: t.N, rawN: t.rawN, extrapolated: t.extrapolated, rows: t.rows, env: t.env };
}

/**
 * Pre-nesting set + the union cascade, i.e. the set `solve` paints as aggressive before the T1/T2
 * split. Returns the unioned keys separately, because "which cells did the post-pass add, and which
 * front seat carried each one" is exactly the enumeration I50 requires for every excess cell.
 *
 * The EV cut sits between the two halves in `solve` and is skipped here: `evPrimary(model)` is
 * false on every shipped model (`model.calibration.verdict` is FAIL by construction, gate I46), so
 * the branch is the identity. If it ever were not, this function would be wrong and I34's
 * quarantine would be the thing that had failed first.
 */
export function painted(model, pos, node, v, seats, opts) {
  const own = preNesting(model, pos, node, v, opts);
  const chain = P.nestChain(node, seats);
  const ci = chain.indexOf(pos);
  const set = new Set(own.set);
  const from = new Map();
  for (let i = 0; i < ci; i++) {
    const front = chain[i];
    for (const k of preNesting(model, front, node, v, opts).set) {
      if (!set.has(k)) { set.add(k); if (!from.has(k)) from.set(k, front); }
    }
  }
  return { set, own: own.set, from, w: own.w, N: own.N, rawN: own.rawN, extrapolated: own.extrapolated, chain, ci };
}

/**
 * THE SUB-LADDER DIFF (§2.5), taken between the two FROZEN FILES with no pipeline in the middle.
 *
 * The `compareV1Containment` / `moveDiff` idiom, for the third time and the same reason: diffing
 * artefacts rather than re-solving both surfaces stays true on a day the pipeline is broken, and it
 * cannot accidentally compare a fixture against itself. For every shared seat where the pair is
 * legal at both sizes, it reports which (lane, VPIP, cell) readings differ between the 9-max row
 * and its 6-max counterpart.
 *
 * @param {object} nine a parsed 9-max fixture
 * @param {object} six  a parsed v3-default fixture (the same 12 lanes, profile ON, six seats)
 */
export function subLadderDiff(nine, six, maxExamples = 12) {
  const problems = [];
  if (six.cells.length !== nine.cells.length || six.cells.some((k, i) => k !== nine.cells[i])) {
    problems.push(`the two fixtures froze different cell sets (${six.cells.length} vs ${nine.cells.length}) `
      + '— nothing below is comparable');
    return { ok: false, problems, byNode: new Map(), rows: 0, movedRows: 0, movedCells: 0, examples: [] };
  }
  const sixBy = new Map(six.sweep.map((r) => [`${r.lane}|${r.node}|${r.pos}|${r.vp}`, r]));
  const nineBy = new Map(nine.sweep.map((r) => [`${r.lane}|${r.node}|${r.pos}|${r.vp}`, r]));
  const cells = nine.cells;
  const byNode = new Map();
  const examples = [];
  let rows = 0, movedRows = 0, movedCells = 0, absent = 0;
  for (const pair of sharedPairs()) {
    const st = byNode.get(pair.node) || { comparisons: 0, exact: 0, moved: 0, cells: 0, bySeat: new Map() };
    byNode.set(pair.node, st);
    for (const L of nine.lanes) {
      for (let vp = nine.vpip[0]; vp <= nine.vpip[1]; vp++) {
        const a = nineBy.get(`${L.id}|${pair.node}|${pair.nine}|${vp}`);
        const b = sixBy.get(`${L.id}|${pair.node}|${pair.six}|${vp}`);
        if (!a || !b) { absent++; continue; }
        rows++; st.comparisons++;
        if (a.vec === b.vec) { st.exact++; continue; }
        movedRows++; st.moved++;
        st.bySeat.set(pair.nine, (st.bySeat.get(pair.nine) || 0) + 1);
        for (let j = 0; j < cells.length; j++) {
          if (a.vec[j] === b.vec[j]) continue;
          movedCells++; st.cells++;
          if (examples.length < maxExamples) {
            examples.push(`${L.id} ${pair.node} ${pair.nine}(9) vs ${pair.six}(6) @v${vp} ${cells[j]} `
              + `${describeCode(b.vec[j])} -> ${describeCode(a.vec[j])}`);
          }
        }
      }
    }
  }
  if (absent) problems.push(`${absent} shared (lane, node, seat, VPIP) readings are missing from one of the two fixtures`);
  return { ok: problems.length === 0, problems, byNode, rows, movedRows, movedCells, absent, examples };
}

/**
 * THE CONTAINMENT ARITHMETIC, as a pure function of three sets, so that gate I50's clause (ii) can
 * be SHOWN TO FAIL on a fabricated violator without fabricating a nine-seat pipeline to produce one.
 *
 * `a` is the nine-seat painted set, `b` its six-seat counterpart, `from` the map of which front
 * seat carried each cell the post-pass unioned into `a`. The direction is pre-registered: `a` must
 * CONTAIN `b`. A strict superset is an expected outcome; an excess cell no front seat carried is
 * not, and neither is a cell of `b` that `a` drops.
 *
 * @returns {{missing:number, excess:number, unexplained:number, byFront:Map<string,number>}}
 */
export function containment(a, b, from = new Map()) {
  let missing = 0, excess = 0, unexplained = 0;
  const byFront = new Map();
  for (const k of b) if (!a.has(k)) missing++;
  for (const k of a) {
    if (b.has(k)) continue;
    excess++;
    const front = from.get(k);
    if (front) byFront.set(front, (byFront.get(front) || 0) + 1);
    else unexplained++;
  }
  return { missing, excess, unexplained, byFront };
}

/**
 * THE NESTING CENSUS — the pipeline half of I50's evidence, and the only half a frozen file cannot
 * carry: how many cells the positional post-pass unioned into each shared seat, and which FRONT
 * SEAT carried each one.
 *
 * Runs over the shared pairs at both sizes with a local memo on `preNesting`, because the front
 * seats of one row are the `pos` of another and re-scoring them is most of the cost. `settings`
 * lets a caller scope the walk — the gate hands it the settings its cheap half already found
 * interesting, and the freeze hands it the whole surface.
 *
 * @returns per-(node, seat9) {comparisons, subsetViolations, exact, strictSuper, unioned,
 *          byFront, widthNonMonotone, preDiff, refused} plus a flat `problems` list
 */
export function nestingCensus(model, lanes, settings, opts = {}) {
  P.hydrate(model);
  const ring = opts.ring || null;
  const shadows = new Map();
  const shadowAt = (vp) => {
    let m = shadows.get(vp);
    if (!m) { m = P.profiledModel(model, profileFor(model, vp)); shadows.set(vp, m); }
    return m;
  };
  const laneBy = new Map(lanes.map((L) => [L.id, L]));
  const memo = new Map();
  const pre = (m, pos, node, v, seats, L) => {
    const key = `${seats}|${pos}|${node}|${v}|${L.id}`;
    let hit = memo.get(key);
    if (hit === undefined) {
      const env = P.envOf({ limpers: 2, raiserPos: RAISER, seats, ...envArgs(L), ...DEFAULT_LANE });
      try { hit = preNesting(m, pos, node, v, { limpers: 2, raiserPos: RAISER, env, ring }); } catch (e) { hit = { err: e.message }; }
      memo.set(key, hit);
    }
    return hit;
  };
  const paintedAt = (m, pos, node, v, seats, L) => {
    const own = pre(m, pos, node, v, seats, L);
    if (own.err) return own;
    const chain = P.nestChain(node, seats);
    const ci = chain.indexOf(pos);
    const set = new Set(own.set);
    const from = new Map();
    for (let i = 0; i < ci; i++) {
      const f = pre(m, chain[i], node, v, seats, L);
      if (f.err) return f;
      for (const k of f.set) if (!set.has(k)) { set.add(k); from.set(k, chain[i]); }
    }
    return { set, own: own.set, from, w: own.w, N: own.N, rawN: own.rawN };
  };

  const out = new Map();
  const problems = [];
  const shared = new Map(sharedPairs().map((p) => [`${p.node}|${p.nine}`, p]));
  let refused = 0;
  for (const s of settings) {
    const pair = shared.get(`${s.node}|${s.pos}`);
    if (!pair) continue;
    const L = laneBy.get(s.lane);
    if (!L) throw new Error(`tier fixture 9max: no such lane ${s.lane}`);
    const key = `${s.node}|${pair.nine}`;
    let st = out.get(key);
    if (!st) {
      st = { node: s.node, nine: pair.nine, six: pair.six, comparisons: 0, exact: 0,
        strictSuper: 0, subsetViolations: 0, unioned: 0, worstUnioned: 0, unexplained: 0,
        byFront: new Map(), widthNonMonotone: 0, preDiff: 0, refused: 0 };
      out.set(key, st);
    }
    const m = shadowAt(s.vp), v = s.vp / 100;
    const a = paintedAt(m, pair.nine, s.node, v, 9, L);
    const b = paintedAt(m, pair.six, s.node, v, 6, L);
    if (a.err || b.err) { st.refused++; refused++; continue; }
    st.comparisons++;

    // (iii) THE PRE-NESTING CLAUSE, stated separately from the painted set. A seats-in-front term
    // may only make the pre-nesting target NARROWER — more seats in front never widens it — and
    // R4's enumeration found exactly one seats-in-front term in the whole pipeline, the post-pass
    // itself. So the measured expectation here is EQUALITY, which is strictly stronger than the
    // monotone wording, and a difference in either direction is recorded; only a WIDER nine-seat
    // pre-nesting target is a violation.
    if (a.w !== b.w || a.own.size !== b.own.size) {
      st.preDiff++;
      if (a.w > b.w) {
        st.widthNonMonotone++;
        if (problems.length < 12) {
          problems.push(`(width) ${s.lane} ${s.node} ${pair.nine}(9) w=${a.w} > ${pair.six}(6) w=${b.w} @v${s.vp}`
            + ' — more seats in front WIDENED the pre-nesting target');
        }
      }
    }

    // (ii) CONTAINMENT, with the direction stated: the painted aggressive set at nine seats must
    // CONTAIN its six-seat counterpart. A strict superset is an EXPECTED OUTCOME, not a failure.
    const c = containment(a.set, b.set, a.from);
    const missing = c.missing, excess = c.excess;
    st.unexplained += c.unexplained;
    for (const [f, n] of c.byFront) st.byFront.set(f, (st.byFront.get(f) || 0) + n);
    if (missing) {
      st.subsetViolations++;
      if (problems.length < 12) {
        problems.push(`(subset) ${s.lane} ${s.node} ${pair.nine}(9) @v${s.vp} drops ${missing} cell(s) `
          + `its six-seat counterpart ${pair.six} paints — containment BROKEN`);
      }
    } else if (excess) { st.strictSuper++; st.unioned += excess; if (excess > st.worstUnioned) st.worstUnioned = excess; } else st.exact++;
  }
  return { byPair: out, problems, refused };
}
