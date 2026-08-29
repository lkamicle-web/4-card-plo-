// tier-fixture.mjs — the I22 baseline: v1's tier output, frozen so v2 cannot move it by accident.
//
// v2 adds a stack-depth axis, a rake slider, a straddle toggle and VPIP-filtered villains
// (docs/V2-PLAN.md). Every one of those enters as a multiplier or a delta that is *identity* at
// the v1 operating point — depth 100bb, rake 0, straddle off, random villains. I22 is the gate
// that holds them to it: at that operating point the pipeline must paint the same tier on every
// cell, at every (node, position, integer VPIP), that v1 painted.
//
// The fixture is a frozen artefact, not something verify recomputes. `scripts/freeze-tiers.mjs`
// is the only writer, and it is a deliberate manual act — a gate that regenerates its own
// expectation asserts nothing.
//
// Node-only (fs + crypto). Not injected into index.html.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import * as P from './policy.mjs';

export const FIXTURE_VERSION = 1;
export const FIXTURE_PATH = 'data/tiers-v1.fixture.txt';

// The v1 operating point, spelled out. None of these knobs exist in v1's code — that is the point:
// they are the settings a v2 pipeline must be put into before I22 has anything to say.
export const OPERATING_POINT = 'limpers=2 raiserPos=CO mix=default depth=100bb rake=0 straddle=off villains=random';

// One character per cell, carrying both halves of the tier decision:
//   solve() computes an action tier (`wouldBe`, one of T1/T2/T3/T5) and then overlays MIX (T4) on
//   the cells sitting inside the t4Band of a live boundary. Digits encode the action with no
//   overlay; letters encode the same action carrying the overlay, i.e. a displayed tier of T4.
// Freezing both means a v2 change that swaps a CALL for a MIX-over-CALL is caught, not shrugged at.
const CODE = { T1: '1', T2: '2', T3: '3', T5: '5' };
const CODE4 = { T1: 'a', T2: 'b', T3: 'c', T5: 'e' };
const DESCRIBE = {
  1: 'T1', 2: 'T2', 3: 'T3', 5: 'T5',
  a: 'T4/T1', b: 'T4/T2', c: 'T4/T3', e: 'T4/T5',
};

/** human name for one encoded tier character: `T3`, or `T4/T3` for MIX shown over a call */
export function describeCode(ch) { return DESCRIBE[ch] || `?${ch}`; }

/** encode one solved cell entry the way the fixture stores it */
export function codeOf(entry) {
  if (!entry) return '?';
  return entry.t4 ? (CODE4[entry.wouldBe] || '?') : (CODE[entry.wouldBe] || '?');
}

/** the cells the fixture covers: every structurally non-empty cell, in a stable sorted order */
export function fixtureCells(model) {
  return Object.keys(model.cells).filter((k) => model.cells[k].combos > 0).sort();
}

/** the (node, position, VPIP) domain v1 sweeps: every legal seat at every integer VPIP */
export function fixtureSettings(model) {
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

export const settingKey = (s) => `${s.node} ${s.pos} ${s.vp}`;

/**
 * Run the policy pipeline over a list of settings and encode the tier vector of each.
 * Pure policy math — no Monte Carlo, ~0.3s for the full 1,386-setting sweep.
 * @returns {Array<{node:string, pos:string, vp:number, vec:string}>}
 */
export function sweepTiers(model, cells, settings) {
  P.hydrate(model);
  const out = [];
  for (const s of settings) {
    const solved = P.solve(model, { pos: s.pos, node: s.node, v: s.vp / 100, limpers: 2, raiserPos: 'CO' });
    let vec = '';
    for (const k of cells) vec += codeOf(solved.cells[k]);
    out.push({ node: s.node, pos: s.pos, vp: s.vp, vec });
  }
  return out;
}

/** sha256 over the reconstructed content, so a hand-edited or truncated fixture is caught on load */
export function digestOf(cells, sweep) {
  const h = createHash('sha256');
  h.update(cells.join(' ') + '\n');
  for (const r of sweep) h.update(`${r.node} ${r.pos} ${r.vp} ${r.vec}\n`);
  return h.digest('hex');
}

// ---------------------------------------------------------------------------
// the file format
// ---------------------------------------------------------------------------
/**
 * Line-oriented text, delta-encoded down the VPIP axis. Adjacent VPIP steps differ by 0.78 cells
 * on average (invariant I16 is the reason), so storing the differences instead of 1,386 full
 * vectors is 24 KB instead of 188 KB with no information lost. The first line of each
 * (node, position) block carries the whole vector after `=`; the rest carry either `-` (identical
 * to the previous VPIP) or a comma-separated list of `<cellIndex><tierChar>`.
 */
export function encodeFixture({ model, cells, sweep, generated }) {
  const L = [];
  L.push('# RUNDOWN — I22 tier fixture. The v1 tier output, frozen.');
  L.push('#');
  L.push('# GENERATED FILE — never hand-edit. Rewritten only by `node scripts/freeze-tiers.mjs --force`,');
  L.push('# which is a deliberate manual act: verify.mjs reads this file and never writes it, because a');
  L.push('# gate that regenerates its own expectation asserts nothing.');
  L.push('#');
  L.push('# Encoding: one line per (node, position, VPIP), as `<node> <pos> <vpip> <payload>`.');
  L.push('#   payload `=<vector>`  the full tier vector, one char per cell in the CELLS order below');
  L.push('#   payload `-`          identical to the previous VPIP in this block');
  L.push('#   payload `12c,88e`    only these cells changed, as <cellIndex><tierChar>');
  L.push('# Tier chars: 1/2/3/5 = action tier T1/T2/T3/T5; a/b/c/e = the same action carrying the');
  L.push('# MIX overlay, i.e. a displayed tier of T4 over T1/T2/T3/T5.');
  L.push('#');
  L.push('# `model-hash` is provenance, not an assertion: v2 regenerates model.json (new measured');
  L.push('# fields) and the hash moves. What must not move is the tiers below.');
  L.push(`version ${FIXTURE_VERSION}`);
  L.push(`model-hash ${model.meta.hash || ''}`);
  L.push(`frozen ${generated}`);
  L.push(`operating-point ${OPERATING_POINT}`);
  L.push(`vpip ${model.meta.vpip.min} ${model.meta.vpip.max}`);
  L.push(`digest ${digestOf(cells, sweep)}`);
  L.push(`cells ${cells.length}`);
  L.push(`CELLS ${cells.join(' ')}`);
  L.push(`settings ${sweep.length}`);
  L.push('TIERS');

  let blockKey = null, prev = null;
  for (const r of sweep) {
    const bk = `${r.node}|${r.pos}`;
    let payload;
    if (bk !== blockKey) { payload = '=' + r.vec; blockKey = bk; } else if (r.vec === prev) { payload = '-'; } else {
      const d = [];
      for (let i = 0; i < r.vec.length; i++) if (r.vec[i] !== prev[i]) d.push(String(i) + r.vec[i]);
      payload = d.join(',');
    }
    prev = r.vec;
    L.push(`${r.node} ${r.pos} ${r.vp} ${payload}`);
  }
  return L.join('\n') + '\n';
}

/**
 * @returns {{version:number, modelHash:string, frozen:string, operatingPoint:string,
 *            vpip:[number,number], cells:string[], sweep:Array, digest:string}}
 * @throws on a malformed, truncated or hand-edited file (the digest is checked here)
 */
export function parseFixture(text) {
  const lines = text.split('\n');
  const head = {};
  let cells = null, i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('#')) continue;
    if (line === 'TIERS') { i++; break; }
    const sp = line.indexOf(' ');
    const k = sp < 0 ? line : line.slice(0, sp);
    const v = sp < 0 ? '' : line.slice(sp + 1);
    if (k === 'CELLS') cells = v.split(' ').filter(Boolean);
    else head[k] = v;
  }
  if (!cells) throw new Error('tier fixture: no CELLS line');
  if (+head.version !== FIXTURE_VERSION) throw new Error(`tier fixture: version ${head.version}, expected ${FIXTURE_VERSION}`);
  if (+head.cells !== cells.length) throw new Error(`tier fixture: header says ${head.cells} cells, CELLS lists ${cells.length}`);

  const sweep = [];
  let blockKey = null, prev = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('#')) continue;
    const p = line.split(' ');
    if (p.length !== 4) throw new Error(`tier fixture: malformed line ${i + 1}: ${line}`);
    const [node, pos, vpRaw, payload] = p;
    const bk = `${node}|${pos}`;
    let vec;
    if (payload[0] === '=') { vec = payload.slice(1); } else if (payload === '-') {
      if (prev == null || bk !== blockKey) throw new Error(`tier fixture: '-' with no previous vector at line ${i + 1}`);
      vec = prev;
    } else {
      if (prev == null || bk !== blockKey) throw new Error(`tier fixture: delta with no previous vector at line ${i + 1}`);
      const a = prev.split('');
      for (const tok of payload.split(',')) {
        const idx = +tok.slice(0, -1);
        if (!Number.isInteger(idx) || idx < 0 || idx >= a.length) throw new Error(`tier fixture: bad delta '${tok}' at line ${i + 1}`);
        a[idx] = tok.slice(-1);
      }
      vec = a.join('');
    }
    if (vec.length !== cells.length) throw new Error(`tier fixture: vector length ${vec.length} != ${cells.length} at line ${i + 1}`);
    blockKey = bk; prev = vec;
    sweep.push({ node, pos, vp: +vpRaw, vec });
  }
  if (+head.settings !== sweep.length) throw new Error(`tier fixture: header says ${head.settings} settings, found ${sweep.length}`);
  const digest = digestOf(cells, sweep);
  if (head.digest !== digest) throw new Error('tier fixture: digest mismatch — the file has been hand-edited or truncated');

  const vp = (head.vpip || '').split(' ').map(Number);
  return {
    version: +head.version,
    modelHash: head['model-hash'] || '',
    frozen: head.frozen || '',
    operatingPoint: head['operating-point'] || '',
    vpip: [vp[0], vp[1]],
    digest, cells, sweep,
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
 * @param {object} model         a hydrated (or hydratable) model
 * @param {object} fx            a parsed fixture
 * @param {number} maxExamples   how many concrete differences to name
 * @returns {{ok:boolean, settings:number, cells:number, total:number, totalCells:number,
 *             examples:string[], structural:string[]}}
 */
export function compareToFixture(model, fx, maxExamples = 5) {
  const structural = [];

  // A changed cell SET is its own failure mode, and a much more useful message than 145 tier
  // diffs: the taxonomy moved, so nothing below is comparable.
  const nowCells = fixtureCells(model);
  const fxSet = new Set(fx.cells), nowSet = new Set(nowCells);
  const missing = fx.cells.filter((k) => !nowSet.has(k));
  const added = nowCells.filter((k) => !fxSet.has(k));
  if (missing.length) structural.push(`${missing.length} frozen cells are gone from the model (e.g. ${missing[0]})`);
  if (added.length) structural.push(`${added.length} cells are new since the freeze (e.g. ${added[0]})`);

  // Likewise a changed (node, pos, VPIP) domain: v1's 21 legal seats x 66 integer VPIPs.
  const nowSettings = fixtureSettings(model);
  const fxKeys = new Set(fx.sweep.map(settingKey));
  const extra = nowSettings.filter((s) => !fxKeys.has(settingKey(s)));
  if (extra.length) structural.push(`${extra.length} settings exist now that the fixture never froze (e.g. ${settingKey(extra[0])})`);

  const cells = fx.cells;
  const actual = sweepTiers(model, cells, fx.sweep);
  let badSettings = 0, badCells = 0;
  const examples = [];
  for (let i = 0; i < fx.sweep.length; i++) {
    const want = fx.sweep[i], got = actual[i];
    if (want.vec === got.vec) continue;
    badSettings++;
    for (let j = 0; j < cells.length; j++) {
      if (want.vec[j] === got.vec[j]) continue;
      badCells++;
      if (examples.length < maxExamples) {
        examples.push(`${want.node}/${want.pos}@v${want.vp} ${cells[j]} ${describeCode(want.vec[j])} -> ${describeCode(got.vec[j])}`);
      }
    }
  }
  return {
    ok: badSettings === 0 && structural.length === 0,
    settings: badSettings, cells: badCells,
    total: fx.sweep.length, totalCells: fx.sweep.length * cells.length,
    examples, structural,
  };
}
