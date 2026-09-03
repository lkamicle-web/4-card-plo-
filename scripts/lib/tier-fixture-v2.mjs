// tier-fixture-v2.mjs — the I32 baseline: v2's tier output over the whole environment surface,
// frozen before a single line of v3 code was written (V3-PLAN §0.4, §5.1).
//
// WHAT THIS IS FOR. v1's fixture (tier-fixture.mjs, gate I22) pins ONE point: depth 100bb, rake 0,
// straddle off, random villains. That was the right shape for v2, whose every mechanism was a
// multiplier that is the identity at that point. v3 is not that shape. v3 adds an EV mode, a
// vs-GTO colour mode, a skill dial, a 3-bet sizing axis and a default-on villain profile, and each
// of them will be read by code that already carries a depth, a rake and a straddle. A gate that
// only watches the single point 100/0/off cannot see a v3 axis leaking into the *raked, shallow,
// straddled* path — and that path is where the product actually lives (the page opens at the 5%
// preset).
//
// So I32 freezes the SURFACE, not the point:
//
//     21 legal (pos, node) pairs  x  every integer v in 25..90
//        x depth {40, 100, 250}  x  rake {0, preset}  x  straddle {off, on}
//        x villain profile OFF
//
//     = 12 environment lanes x 1,386 settings = 16,632 settings x 123 cells = 2,045,736 tiers.
//
// TRANSITIVE v1 IDENTITY. Lane `d100/r0/s0` IS the v1 operating point, so the v1 tier vector is
// inside this file, character for character. That containment is asserted, not assumed:
// `compareV1Containment` diffs the v1 fixture against the v1-point lane of this one, and I22 keeps
// running beside I32 for the whole v3 program (§5.1 — "retire both together, only at a
// calibration-forced re-freeze").
//
// THE LEGACY LANE. I32's claim is *"all new axes at legacy settings reproduce this file"*. The
// axes v3 adds do not exist yet, so `LEGACY_LANE` is empty today — see the comment on it, which is
// the hook a v3 axis must be added to. The failure this gate is written to catch is the `envKey`
// docstring's exact trap: a memo key that forgot a new axis, handing back another environment's
// answer. That is a silent wrong answer, not a crash, and only a frozen expectation finds it.
//
// `scripts/freeze-tiers.mjs --v2` is the sole writer, as for v1. Nothing here writes the file: a
// gate that regenerates its own expectation asserts nothing.
//
// Node-only (fs + crypto). Not injected into index.html.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import * as P from './policy.mjs';
import { codeOf, describeCode, fixtureCells } from './tier-fixture.mjs';

export { codeOf, describeCode, fixtureCells };

export const FIXTURE_VERSION = 1;
export const FIXTURE_PATH = 'data/tiers-v2.fixture.txt';

/**
 * The non-environment half of the frozen state, spelled out. These are the arguments `sweepTiers`
 * passes to `solve` on every row; they are v1's and v2's, unchanged.
 *
 * `villains=off` is not a value the solver takes — the villain profile reaches tiers through
 * `villainEq`, which the page calls and `solve` does not. It is recorded because V3-PLAN §0.4
 * names it as part of the frozen state, and item 8 HAS since flipped its default at B1: the page
 * now opens with the profile ON, and this fixture keeps asserting the OFF surface. That is not an
 * oversight, it is the design — a default flip changes which state the page opens in and changes
 * no state's meaning, so the legacy lane is still there to be asserted. The ON surface is frozen
 * separately in `tier-fixture-v3.mjs` / `data/tiers-v3-default.fixture.txt`. The day the profile
 * ever becomes a solve INPUT, OFF is what this fixture was frozen at and `LEGACY_LANE` is where it
 * gets pinned.
 */
export const LEGACY_STATE = 'limpers=2 raiserPos=CO mix=default villains=off';

/**
 * THE HOOK. Every v3 axis, at the setting where it must be the identity, merged into the solve
 * state of every row of this sweep.
 *
 * WHEN YOU ADD A v3 AXIS, ADD IT HERE, and add it to `P.envKey` (or to whatever cache key covers
 * it) in the same commit. If you add the axis and not this object, I32 stops asserting the legacy
 * lane and starts asserting the DEFAULT lane — which is a gate that goes green while the thing it
 * was written to protect quietly stops being protected. V3-PLAN §7.2 predicts I32 fires during
 * I43's OFF-path refactor; that firing is the gate working, not a tolerance to widen.
 *
 * The settings §0.4 names: EV mode off, vs-GTO off, skill dial neutral, 3-bet sizing at pot,
 * villain profile OFF with object identity.
 *
 * FILLED IN AT P1 (lane M) with the three axes that now exist, WRITTEN OUT rather than read from
 * `P.OPERATING_POINT`. That is the whole point of the hook: these are what the fixture was FROZEN
 * at, not what the model currently defaults to, and the day a B1-style ceremony flips one of these
 * three the two stop being the same object. (B1 itself flipped only item 8's villain profile, which
 * is not one of these — see `LEGACY_STATE` above.) A version of this that spread `OPERATING_POINT` would follow the flip and go
 * green against the new default — the exact silent failure the paragraph above describes.
 *
 *   rakeDepth: false   item 6's coupling off; `potBB` is the flat 60.
 *   depthWidth: false  item 6b's factor off; `widthFor` does not read depth.
 *   sizing: 1          item 9 at the pot-limit maximum, where every threshold is by reference.
 *
 * The villain profile is not listed because it is not a solve argument even now — not before B1 and
 * not after it: item 8 routes it through `P.profiledModel`, which returns the model itself when the
 * profile is off, so OFF is carried by object identity rather than by a state key. `LEGACY_STATE`
 * above records it, and I43(a)/(e) assert the identity that makes the omission safe.
 */
export const LEGACY_LANE = Object.freeze({ rakeDepth: false, depthWidth: false, sizing: 1 });

// ---------------------------------------------------------------------------
// the environment lanes
// ---------------------------------------------------------------------------
/** `d40/r5/s1` — greppable, self-describing, and stable across a re-freeze */
export const laneId = (L) => `d${L.d}/r${L.rakePct}/s${L.straddle ? 1 : 0}`;

/**
 * The human form the header stores, so a lane means something without reading this file.
 *
 * `villains` reads the lane's own field and falls back to `off`, which is what every lane of THIS
 * fixture is and always will be — so v2's bytes are unchanged. The fallback exists because
 * `tier-fixture-v3.mjs` freezes the same 12 environment lanes with the villain profile ON (V3-PLAN
 * §5.1's third fixture, at the B1 default flip) and shares this format, this encoder and this
 * parser with them. One format means one parser: a second copy of the delta encoding is a second
 * place for a fixture to be silently misread.
 */
export const laneSpec = (L) =>
  `d=${L.d} rakePct=${L.rakePct} rakeCapBB=${L.rakeCapBB} straddle=${L.straddle ? 'on' : 'off'} villains=${L.villains || 'off'}`;

/**
 * The 12 lanes of V3-PLAN §0.4, in the order the plan lists them: depth outermost, then rake,
 * then straddle. Read from `P.CONSTANTS` rather than written out, so that moving `rake.preset`
 * or a depth endpoint shows up as LANE DRIFT (a structural failure of I32) instead of silently
 * re-pointing the gate at a different surface.
 *
 * `rakeCapBB` is the shipped cap on both rake lanes, including the rake-0 lane: `envOf` only
 * returns the shared frozen `DEFAULT_ENV` when the cap is at its default too, and the rake-0
 * lane has to BE that object for the v1 containment below to mean anything.
 */
export function laneSpecs() {
  const D = P.CONSTANTS.depth, R = P.CONSTANTS.rake;
  const out = [];
  for (const d of [D.min, D.ref, D.max]) {
    for (const rakePct of [R.min, R.preset]) {
      for (const straddle of [false, true]) {
        out.push({ id: laneId({ d, rakePct, straddle }), d, rakePct, rakeCapBB: R.capBB, straddle });
      }
    }
  }
  const ids = new Set(out.map((L) => L.id));
  if (ids.size !== out.length) throw new Error('tier fixture v2: lane ids collide — laneId is not distinguishing the lanes');
  return out;
}

/** the lane that IS the v1 operating point — the one I22's fixture must be found inside */
export const V1_POINT_LANE = () => laneId({ d: P.CONSTANTS.depth.ref, rakePct: P.CONSTANTS.rake.min, straddle: false });

/** the env argument bag for a lane, in the shape `solve` reads */
export const envArgs = (L) => ({ d: L.d, rakePct: L.rakePct, rakeCapBB: L.rakeCapBB, straddle: L.straddle });

// ---------------------------------------------------------------------------
// the domain
// ---------------------------------------------------------------------------
/** the (node, position, VPIP) half of the sweep — v1's 21 legal seats x 66 integer VPIPs */
export function baseSettings(model) {
  const lo = model.meta.vpip.min, hi = model.meta.vpip.max;
  const out = [];
  for (const node of P.NODES) {
    for (const pos of P.POSITIONS) {
      if (P.positionDisabled(pos, node)) continue;
      for (let vp = lo; vp <= hi; vp++) out.push({ node, pos, vp });
    }
  }
  return out;
}

/** the full 16,632-row domain: lane outermost, then node, position, VPIP */
export function fixtureSettings(model, lanes = laneSpecs()) {
  const base = baseSettings(model);
  const out = [];
  for (const L of lanes) for (const s of base) out.push({ lane: L.id, node: s.node, pos: s.pos, vp: s.vp });
  return out;
}

export const settingKey = (s) => `${s.lane} ${s.node} ${s.pos} ${s.vp}`;

/**
 * Run the policy pipeline over the sweep and encode each row's tier vector.
 * Pure policy math — no Monte Carlo. ~3.5 s for the full 16,632-row sweep.
 * @param {object} model    a hydrated (or hydratable) model
 * @param {string[]} cells  the frozen cell order
 * @param {Array} settings  rows carrying {lane, node, pos, vp}
 * @param {Map<string,object>} laneBy  lane id -> lane spec
 */
export function sweepTiers(model, cells, settings, laneBy) {
  P.hydrate(model);
  const out = [];
  for (const s of settings) {
    const L = laneBy.get(s.lane);
    if (!L) throw new Error(`tier fixture v2: no such lane ${s.lane}`);
    const solved = P.solve(model, {
      pos: s.pos, node: s.node, v: s.vp / 100, limpers: 2, raiserPos: 'CO',
      ...envArgs(L),
      ...LEGACY_LANE,
    });
    let vec = '';
    for (const k of cells) vec += codeOf(solved.cells[k]);
    out.push({ lane: s.lane, node: s.node, pos: s.pos, vp: s.vp, vec });
  }
  return out;
}

/** sha256 over the reconstructed content — cells, lanes and every row */
export function digestOf(cells, lanes, sweep) {
  const h = createHash('sha256');
  h.update(cells.join(' ') + '\n');
  for (const L of lanes) h.update(`${L.id} ${laneSpec(L)}\n`);
  for (const r of sweep) h.update(`${r.lane} ${r.node} ${r.pos} ${r.vp} ${r.vec}\n`);
  return h.digest('hex');
}

// ---------------------------------------------------------------------------
// the file format — v1's, with a lane column
// ---------------------------------------------------------------------------
/**
 * Line-oriented text, delta-encoded down the VPIP axis inside each (lane, node, position) block,
 * exactly as v1 does: adjacent VPIP steps differ by well under one cell on average (invariant
 * I16 is the reason), so the deltas cost ~80 KB where 16,632 full vectors would cost 2 MB. Every
 * line still carries its whole setting key, because a fixture you cannot grep is a fixture nobody
 * can debug against.
 */
/** the banner `encodeFixture` writes when the caller supplies none — this fixture's own claim */
export const V2_BANNER = [
  '# RUNDOWN — I32 tier fixture. The v2 tier output over the whole environment surface, frozen.',
  '#',
  '# GENERATED FILE — never hand-edit. Rewritten only by `node scripts/freeze-tiers.mjs --v2 --force`,',
  '# which is a deliberate manual act: verify.mjs reads this file and never writes it, because a',
  '# gate that regenerates its own expectation asserts nothing.',
  '#',
  '# THE CLAIM (V3-PLAN §0.4): with every v3 axis at its legacy setting — EV mode off, vs-GTO off,',
  '# skill dial neutral, 3-bet sizing at pot, villain profile OFF — the pipeline paints these tiers',
  '# on all 12 environment lanes, not merely at the v1 point. Lane `d100/r0/s0` IS the v1 operating',
  '# point, so gate I22 lives inside this file transitively; the containment is asserted, not assumed.',
];

/**
 * @param {object}   o.banner   the `#` header block; defaults to this fixture's own (V2_BANNER)
 * @param {string}   o.state    the `legacy-state` value; defaults to LEGACY_STATE
 * @param {string}   o.v1Point  the `v1-point` value; '' omits the line entirely, which is what the
 *                              v3-default fixture does — every one of its lanes runs the villain
 *                              profile ON, so no lane of it is the v1 operating point and claiming
 *                              one was would be a lie in a header a gate reads.
 */
export function encodeFixture({ model, cells, lanes, sweep, generated,
  banner = V2_BANNER, state = LEGACY_STATE, v1Point = V1_POINT_LANE() }) {
  const L = [];
  for (const line of banner) L.push(line);
  L.push('#');
  L.push('# Encoding: one line per (lane, node, position, VPIP), as `<lane> <node> <pos> <vpip> <payload>`.');
  L.push('#   payload `=<vector>`  the full tier vector, one char per cell in the CELLS order below');
  L.push('#   payload `-`          identical to the previous VPIP in this (lane, node, position) block');
  L.push('#   payload `12c,88e`    only these cells changed, as <cellIndex><tierChar>');
  L.push('# Tier chars: 1/2/3/5 = action tier T1/T2/T3/T5; a/b/c/e = the same action carrying the');
  L.push('# MIX overlay, i.e. a displayed tier of T4 over T1/T2/T3/T5.');
  L.push('#');
  L.push('# `model-hash` is provenance, not an assertion: v3 regenerates model.json (new measured fields,');
  L.push('# new gate stamps) and the hash moves. What must not move is the tiers below.');
  L.push(`version ${FIXTURE_VERSION}`);
  L.push(`model-hash ${model.meta.hash || ''}`);
  L.push(`frozen ${generated}`);
  L.push(`legacy-state ${state}`);
  if (v1Point) L.push(`v1-point ${v1Point}`);
  L.push(`vpip ${model.meta.vpip.min} ${model.meta.vpip.max}`);
  L.push(`digest ${digestOf(cells, lanes, sweep)}`);
  L.push(`cells ${cells.length}`);
  L.push(`CELLS ${cells.join(' ')}`);
  L.push(`lanes ${lanes.length}`);
  for (const lane of lanes) L.push(`LANE ${lane.id} ${laneSpec(lane)}`);
  L.push(`settings ${sweep.length}`);
  L.push('TIERS');

  let blockKey = null, prev = null;
  for (const r of sweep) {
    const bk = `${r.lane}|${r.node}|${r.pos}`;
    let payload;
    if (bk !== blockKey) { payload = '=' + r.vec; blockKey = bk; } else if (r.vec === prev) { payload = '-'; } else {
      const d = [];
      for (let i = 0; i < r.vec.length; i++) if (r.vec[i] !== prev[i]) d.push(String(i) + r.vec[i]);
      payload = d.join(',');
    }
    prev = r.vec;
    L.push(`${r.lane} ${r.node} ${r.pos} ${r.vp} ${payload}`);
  }
  return L.join('\n') + '\n';
}

const LANE_FIELDS = { d: Number, rakePct: Number, rakeCapBB: Number };

/**
 * @returns {{version:number, modelHash:string, frozen:string, legacyState:string, v1Point:string,
 *            vpip:[number,number], cells:string[], lanes:Array, sweep:Array, digest:string}}
 * @throws on a malformed, truncated or hand-edited file (the digest is checked here)
 */
export function parseFixture(text) {
  const lines = text.split('\n');
  const head = {};
  const lanes = [];
  let cells = null, i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('#')) continue;
    if (line === 'TIERS') { i++; break; }
    const sp = line.indexOf(' ');
    const k = sp < 0 ? line : line.slice(0, sp);
    const v = sp < 0 ? '' : line.slice(sp + 1);
    if (k === 'CELLS') { cells = v.split(' ').filter(Boolean); continue; }
    if (k === 'LANE') {
      const tok = v.split(' ').filter(Boolean);
      const lane = { id: tok[0], straddle: false };
      for (const t of tok.slice(1)) {
        const eq = t.indexOf('=');
        if (eq < 0) throw new Error(`tier fixture v2: malformed LANE field '${t}' at line ${i + 1}`);
        const kk = t.slice(0, eq), vv = t.slice(eq + 1);
        if (kk === 'straddle') lane.straddle = vv === 'on';
        else if (kk === 'villains') lane.villains = vv;
        else if (LANE_FIELDS[kk]) lane[kk] = LANE_FIELDS[kk](vv);
        else throw new Error(`tier fixture v2: unknown LANE field '${kk}' at line ${i + 1}`);
      }
      for (const need of ['d', 'rakePct', 'rakeCapBB']) {
        if (!isFinite(lane[need])) throw new Error(`tier fixture v2: LANE ${lane.id} has no ${need}`);
      }
      lanes.push(lane);
      continue;
    }
    head[k] = v;
  }
  if (!cells) throw new Error('tier fixture v2: no CELLS line');
  if (+head.version !== FIXTURE_VERSION) throw new Error(`tier fixture v2: version ${head.version}, expected ${FIXTURE_VERSION}`);
  if (+head.cells !== cells.length) throw new Error(`tier fixture v2: header says ${head.cells} cells, CELLS lists ${cells.length}`);
  if (+head.lanes !== lanes.length) throw new Error(`tier fixture v2: header says ${head.lanes} lanes, found ${lanes.length}`);
  const laneIds = new Set(lanes.map((L) => L.id));
  if (laneIds.size !== lanes.length) throw new Error('tier fixture v2: duplicate LANE id');

  const sweep = [];
  let blockKey = null, prev = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('#')) continue;
    const p = line.split(' ');
    if (p.length !== 5) throw new Error(`tier fixture v2: malformed line ${i + 1}: ${line}`);
    const [lane, node, pos, vpRaw, payload] = p;
    if (!laneIds.has(lane)) throw new Error(`tier fixture v2: line ${i + 1} names lane '${lane}', which no LANE declares`);
    const bk = `${lane}|${node}|${pos}`;
    let vec;
    if (payload[0] === '=') { vec = payload.slice(1); } else if (payload === '-') {
      if (prev == null || bk !== blockKey) throw new Error(`tier fixture v2: '-' with no previous vector at line ${i + 1}`);
      vec = prev;
    } else {
      if (prev == null || bk !== blockKey) throw new Error(`tier fixture v2: delta with no previous vector at line ${i + 1}`);
      const a = prev.split('');
      for (const tok of payload.split(',')) {
        const idx = +tok.slice(0, -1);
        if (!Number.isInteger(idx) || idx < 0 || idx >= a.length) throw new Error(`tier fixture v2: bad delta '${tok}' at line ${i + 1}`);
        a[idx] = tok.slice(-1);
      }
      vec = a.join('');
    }
    if (vec.length !== cells.length) throw new Error(`tier fixture v2: vector length ${vec.length} != ${cells.length} at line ${i + 1}`);
    blockKey = bk; prev = vec;
    sweep.push({ lane, node, pos, vp: +vpRaw, vec });
  }
  if (+head.settings !== sweep.length) throw new Error(`tier fixture v2: header says ${head.settings} settings, found ${sweep.length}`);
  const digest = digestOf(cells, lanes, sweep);
  if (head.digest !== digest) throw new Error('tier fixture v2: digest mismatch — the file has been hand-edited or truncated');

  const vp = (head.vpip || '').split(' ').map(Number);
  return {
    version: +head.version,
    modelHash: head['model-hash'] || '',
    frozen: head.frozen || '',
    legacyState: head['legacy-state'] || '',
    v1Point: head['v1-point'] || '',
    vpip: [vp[0], vp[1]],
    digest, cells, lanes, sweep,
  };
}

export function loadFixture(path) {
  return parseFixture(readFileSync(path, 'utf8'));
}

// ---------------------------------------------------------------------------
// the comparison, and the diagnosis it owes you when it fails
// ---------------------------------------------------------------------------
/**
 * Re-run the pipeline over the fixture's own settings and diff it, cell by cell.
 *
 * Structural failures are reported separately from tier drift and are their own kind of red: a
 * changed cell set, a changed (lane, node, pos, VPIP) domain, or LANE DRIFT — the current
 * `CONSTANTS` no longer describing the lanes that were frozen. Lane drift matters because the
 * recompute below deliberately uses the FIXTURE's lanes, not the code's: that is what keeps the
 * tier comparison honest when a constant moves, and it is also what would let a moved
 * `rake.preset` quietly re-point the gate at a surface nobody froze.
 *
 * @returns {{ok:boolean, settings:number, cells:number, total:number, totalCells:number,
 *            lanes:number, examples:string[], structural:string[], byLane:Map<string,number>}}
 */
export function compareToFixture(model, fx, maxExamples = 5) {
  const structural = [];

  const nowCells = fixtureCells(model);
  const fxSet = new Set(fx.cells), nowSet = new Set(nowCells);
  const missing = fx.cells.filter((k) => !nowSet.has(k));
  const added = nowCells.filter((k) => !fxSet.has(k));
  if (missing.length) structural.push(`${missing.length} frozen cells are gone from the model (e.g. ${missing[0]})`);
  if (added.length) structural.push(`${added.length} cells are new since the freeze (e.g. ${added[0]})`);

  // lane drift: what CONSTANTS says the §0.4 surface is, against what was frozen
  const nowLanes = laneSpecs();
  const fxLaneBy = new Map(fx.lanes.map((L) => [L.id, L]));
  for (const L of nowLanes) {
    const was = fxLaneBy.get(L.id);
    if (!was) { structural.push(`lane ${L.id} (${laneSpec(L)}) is in the §0.4 surface now and was never frozen`); continue; }
    if (laneSpec(was) !== laneSpec(L)) structural.push(`lane ${L.id} drifted: frozen ${laneSpec(was)} -> now ${laneSpec(L)}`);
  }
  const nowIds = new Set(nowLanes.map((L) => L.id));
  for (const L of fx.lanes) if (!nowIds.has(L.id)) structural.push(`frozen lane ${L.id} (${laneSpec(L)}) is no longer in the §0.4 surface`);

  // the v1 point must still be a lane of this fixture, and must still be the pipeline's own
  // operating point — that is what makes the I22 containment below mean anything.
  const v1 = V1_POINT_LANE();
  if (fx.v1Point !== v1) structural.push(`the fixture's v1 point is ${fx.v1Point || '(none)'}, the pipeline's is ${v1}`);
  const v1Lane = fxLaneBy.get(fx.v1Point);
  if (!v1Lane) structural.push(`the fixture names v1 point ${fx.v1Point || '(none)'} but declares no such lane`);
  else if (P.envKey(envArgs(v1Lane)) !== P.envKey({})) {
    structural.push(`the frozen v1-point lane ${v1Lane.id} is no longer the pipeline's operating point ` +
      `(${P.envKey(envArgs(v1Lane))} vs ${P.envKey({})})`);
  }

  // a widened domain: settings that exist now and were never frozen
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
 * SUCCESSION, PROVEN. Diff the v1 fixture against the v1-point lane of the v2 fixture.
 *
 * V3-PLAN §5.1 keeps I22 and I32 running side by side and says v1 identity is carried
 * *transitively* inside the v2 fixture. This function is the difference between that being a
 * sentence and it being a fact: it checks the two frozen artefacts against each other, with no
 * pipeline in the middle, so it is still true even on a day the pipeline is broken.
 *
 * @param {object} v2  a parsed v2 fixture
 * @param {object} v1  a parsed v1 fixture (tier-fixture.mjs)
 * @returns {{ok:boolean, rows:number, bad:number, problems:string[]}}
 */
export function compareV1Containment(v2, v1) {
  const problems = [];
  if (v1.cells.length !== v2.cells.length || v1.cells.some((k, i) => k !== v2.cells[i])) {
    problems.push(`the two fixtures froze different cell sets (${v1.cells.length} vs ${v2.cells.length}) — nothing below is comparable`);
    return { ok: false, rows: 0, bad: 0, problems };
  }
  const lane = v2.v1Point;
  const rows = v2.sweep.filter((r) => r.lane === lane);
  if (!rows.length) { problems.push(`the v2 fixture has no rows on its v1-point lane '${lane || '(none)'}'`); return { ok: false, rows: 0, bad: 0, problems }; }
  if (rows.length !== v1.sweep.length) problems.push(`v1 froze ${v1.sweep.length} settings, the v1-point lane carries ${rows.length}`);
  let bad = 0;
  const n = Math.min(rows.length, v1.sweep.length);
  for (let i = 0; i < n; i++) {
    const a = v1.sweep[i], b = rows[i];
    if (a.node !== b.node || a.pos !== b.pos || a.vp !== b.vp) {
      problems.push(`row ${i} is ${a.node}/${a.pos}@v${a.vp} in v1 and ${b.node}/${b.pos}@v${b.vp} on the v1-point lane — the sweeps are ordered differently`);
      break;
    }
    if (a.vec === b.vec) continue;
    bad++;
    if (problems.length < 4) {
      const j = [...a.vec].findIndex((c, k) => c !== b.vec[k]);
      problems.push(`${a.node}/${a.pos}@v${a.vp} ${v1.cells[j]} v1 ${describeCode(a.vec[j])} vs v2 lane ${describeCode(b.vec[j])}`);
    }
  }
  return { ok: bad === 0 && problems.length === 0, rows: rows.length, bad, problems };
}
