// node --test test/*.test.mjs
//
// V2-PLAN §5 — the sub-bucket expand-in-place layer. Two things are tested here and they are
// different in kind:
//
//   1. `asIfStandalone` must reproduce the real pipeline. The check is not "looks plausible": a
//      CELL's own record fed back through the standalone scorer has to come out with that cell's
//      own score, cumulative frequency, MIX flag, margin and pre-display action, exactly. That is
//      what makes a bucket verdict trustworthy — the same code path, with one record swapped.
//   2. `expandReducer` is the panel's rules ("one at a time", "survives a settings change", "Esc
//      collapses", "arrows descend then fall through"), and rules are what regress.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../scripts/lib/policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const HAVE_MODEL = existsSync(MODEL_PATH);
const M = HAVE_MODEL ? P.hydrate(JSON.parse(readFileSync(MODEL_PATH, 'utf8'))) : null;
const LIVE = M ? Object.keys(M.cells).filter((k) => M.cells[k].combos > 0) : [];

// A spread of settings that exercises every branch the verdict has: the nut gate (high VPIP),
// positional nesting (BTN behind UTG), the T3 continue widths (limps/BTN and raise), the exploit
// split on both sides of the reference VPIP, and all four env axes.
const STATES = [
  { pos: 'UTG', node: 'rfi', v: 0.25, limpers: 2, raiserPos: 'CO' },
  { pos: 'BTN', node: 'rfi', v: 0.90, limpers: 2, raiserPos: 'CO' },
  { pos: 'BTN', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO', d: 40 },
  { pos: 'HJ', node: 'rfi', v: 0.70, limpers: 2, raiserPos: 'CO', d: 250 },
  { pos: 'BTN', node: 'limps', v: 0.55, limpers: 3, raiserPos: 'CO' },
  { pos: 'BB', node: 'limps', v: 0.90, limpers: 4, raiserPos: 'CO', straddle: true },
  { pos: 'CO', node: 'raise', v: 0.40, limpers: 2, raiserPos: 'HJ' },
  { pos: 'BTN', node: 'raise', v: 0.90, limpers: 2, raiserPos: 'UTG', rakePct: 5, rakeCapBB: 3 },
  { pos: 'SB', node: 'rfi', v: 0.62, limpers: 2, raiserPos: 'CO', d: 200, rakePct: 6, straddle: true },
];

test('freqAtScore is the exact inverse of the cut axis', { skip: !HAVE_MODEL }, () => {
  const t = P.rankTable(M, 'CO', 'rfi', 0.55, { limpers: 2 });
  for (const r of t.rows) {
    assert.equal(P.freqAtScore(t.rows, r.S), r.cumMid, `${r.key} must land on its own cumMid`);
  }
  // between two rows it interpolates, and it is monotone the right way round
  const a = t.rows[10], b = t.rows[11];
  const mid = P.freqAtScore(t.rows, (a.S + b.S) / 2);
  assert.ok(mid > a.cumMid && mid < b.cumMid, 'a score between two cells lands between them');
  assert.equal(P.freqAtScore(t.rows, t.rows[0].S + 1), t.rows[0].cumMid, 'stronger than everything');
  assert.equal(P.freqAtScore(t.rows, -1), t.rows[t.rows.length - 1].cumMid, 'weaker than everything');
});

test('a cell scored as-if standalone reproduces its own pipeline verdict', { skip: !HAVE_MODEL }, () => {
  let checked = 0;
  for (const state of STATES) {
    const solved = P.solve(M, { ...state, mix: P.CONSTANTS.vs3bet.mix });
    const ctx = P.standaloneContext(M, state);
    for (const key of LIVE) {
      const e = solved.cells[key];
      const v = P.asIfStandalone(M, state, key, M.cells[key], ctx);
      assert.equal(v.score, e.score, `${key} score @ ${state.pos}/${state.node}/${state.v}`);
      assert.equal(v.cumMid, e.cumMid, `${key} cumMid`);
      assert.equal(v.t4, e.t4, `${key} MIX overlay`);
      assert.equal(v.margin, e.margin, `${key} margin`);
      assert.equal(v.gated, e.gated, `${key} nut-gate flag`);
      assert.equal(v.rank, e.rank, `${key} rank`);
      // `action` after the two cross-cell display post-passes is NOT reproducible from one record —
      // it depends on the cell's neighbours. `preDisplay` is the action before them, and that is
      // the thing the standalone scorer is claiming to compute.
      assert.equal(v.action, e.preDisplay, `${key} action @ ${state.pos}/${state.node}/${state.v}`);
      checked++;
    }
  }
  assert.ok(checked > 1000, `expected a wide sweep, checked ${checked}`);
});

test('the post-pass gap is real but small, and always a promotion', { skip: !HAVE_MODEL }, () => {
  // If preDisplay ever equalled action everywhere, the test above would be vacuous. It is not: the
  // AA-band and suit-monotonicity passes bite, and they can only ever promote.
  let moved = 0, demoted = 0;
  for (const state of STATES) {
    const solved = P.solve(M, { ...state, mix: P.CONSTANTS.vs3bet.mix });
    for (const key of LIVE) {
      const e = solved.cells[key];
      if (e.preDisplay === e.action) continue;
      moved++;
      if (P.TIER_RANK[e.action] < P.TIER_RANK[e.preDisplay]) demoted++;
    }
  }
  assert.ok(moved > 0, 'the post-passes must actually bite somewhere, or the identity is vacuous');
  assert.equal(demoted, 0, 'a display post-pass may only ever promote');
});

test('subVerdicts scores every shipped bucket, self-contained', { skip: !HAVE_MODEL }, () => {
  const state = { pos: 'CO', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'HJ' };
  let buckets = 0;
  for (const key of LIVE) {
    const out = P.subVerdicts(M, state, key);
    assert.ok(out.supported);
    assert.equal(out.rows.length, (M.sub[key] || []).length);
    let combos = 0;
    for (const r of out.rows) {
      assert.ok(P.TIERS.indexOf(r.tier) >= 0, `${key} / ${r.subKey} must earn a real tier`);
      assert.ok(isFinite(r.score) && r.score > 0, `${key} / ${r.subKey} score`);
      assert.ok(isFinite(r.eq) && r.eq > 0, 'eq at the current N_eff');
      assert.ok(r.cooler != null, 'per-sub cooler ships in v2 (V2-PLAN §2.4)');
      assert.ok(r.oneIn > 0 && r.label && r.label.length, 'label + oneIn for the row');
      combos += r.combos;
      buckets++;
    }
    // I17's partition, re-read through the UI's own accessor
    assert.equal(combos, M.cells[key].combos, `${key}: buckets must partition the cell`);
  }
  assert.equal(buckets, 341, 'V2-PLAN §5: 341 non-empty sub-buckets');
});

test('the vs-3-bet node refuses to invent a bucket verdict', { skip: !HAVE_MODEL }, () => {
  const state = { pos: 'BTN', node: '3bet', v: 0.55, limpers: 2, mix: P.CONSTANTS.vs3bet.mix };
  const out = P.subVerdicts(M, state, 'AA_BIGPAIR|DS');
  assert.equal(out.supported, false);
  assert.equal(out.rows.length, 0);
  assert.ok(/face-up/.test(out.note), 'and says why');
  assert.equal(P.asIfStandalone(M, state, 'AA_BIGPAIR|DS', M.cells['AA_BIGPAIR|DS']), null);
});

test('depth re-scores the buckets and the verdicts move', { skip: !HAVE_MODEL }, () => {
  // The claim V2-PLAN §5 makes about this UI: the depth slider separates buckets inside a row. It
  // is asserted here in score terms (a tier is a percentile cut and can be vacuously still — the
  // lesson METHODOLOGY §5.1 records against the rundown anchor).
  const base = { pos: 'CO', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'HJ' };
  const key = 'BIGPAIR_JUNK|SS';
  const lo = P.subVerdicts(M, { ...base, d: 40 }, key);
  const hi = P.subVerdicts(M, { ...base, d: 250 }, key);
  assert.equal(lo.rows.length, hi.rows.length);
  const spread = (o) => Math.max(...o.rows.map((r) => r.score)) - Math.min(...o.rows.map((r) => r.score));
  assert.ok(spread(hi) > spread(lo),
    `the big-pair buckets must spread apart with depth (40bb ${spread(lo).toFixed(3)}, 250bb ${spread(hi).toFixed(3)})`);
  // and the equity numbers must NOT move: all-in equity is depth-independent (V2-PLAN §1)
  for (let i = 0; i < lo.rows.length; i++) assert.equal(lo.rows[i].eq, hi.rows[i].eq);
});

test('rake moves every bucket score and no bucket tier at a percentile node', { skip: !HAVE_MODEL }, () => {
  // I31(a), read through the expand UI: the flat haircut is tier-inert here too, for the same
  // reason. If this ever fails, the rake model changed and METHODOLOGY §10.14's copy is now a lie.
  const base = { pos: 'HJ', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO' };
  let scored = 0;
  for (const key of LIVE) {
    const dry = P.subVerdicts(M, base, key);
    const wet = P.subVerdicts(M, { ...base, rakePct: 5, rakeCapBB: 3 }, key);
    for (let i = 0; i < dry.rows.length; i++) {
      assert.equal(wet.rows[i].tier, dry.rows[i].tier, `${key} / ${dry.rows[i].subKey} must not move tier`);
      assert.ok(wet.rows[i].score < dry.rows[i].score, 'but every score must fall');
      assert.ok(Math.abs(wet.rows[i].score / dry.rows[i].score - 0.95) < 1e-12, 'by exactly 1 - rakeFrac');
      scored++;
    }
  }
  assert.equal(scored, 341);
});

// ---------------------------------------------------------------- the reducer
test('expandReducer: one cell at a time, and toggling collapses', () => {
  let s = P.EXPAND_INIT;
  assert.equal(s.cell, null);
  s = P.expandReducer(s, { type: 'toggle', cell: 'A|RB', count: 3 });
  assert.deepEqual(s, { cell: 'A|RB', cursor: -1, count: 3 });
  s = P.expandReducer(s, { type: 'toggle', cell: 'B|DS', count: 2 });
  assert.equal(s.cell, 'B|DS', 'a different cell replaces the open one');
  assert.equal(s.count, 2);
  s = P.expandReducer(s, { type: 'toggle', cell: 'B|DS', count: 2 });
  assert.equal(s.cell, null, 'toggling the open cell collapses it');
  assert.equal(s.cursor, -1);
});

test('expandReducer: a cell with no buckets never opens', () => {
  const s = P.expandReducer(P.EXPAND_INIT, { type: 'open', cell: 'VOID|RB', count: 0 });
  assert.equal(s.cell, null);
  assert.equal(s, P.EXPAND_INIT, 'and declining is a no-op, not a new object');
});

test('expandReducer: Esc collapses from anywhere, and is a no-op when closed', () => {
  let s = P.expandReducer(P.EXPAND_INIT, { type: 'open', cell: 'A|RB', count: 3 });
  s = P.expandReducer(s, { type: 'down' });
  s = P.expandReducer(s, { type: 'down' });
  assert.equal(s.cursor, 1);
  s = P.expandReducer(s, { type: 'close' });
  assert.deepEqual(s, { cell: null, cursor: -1, count: 0 });
  assert.equal(P.expandReducer(s, { type: 'close' }), s, 'closing a closed panel changes nothing');
});

test('expandReducer: arrows descend into the rows, then fall through', () => {
  let s = P.expandReducer(P.EXPAND_INIT, { type: 'open', cell: 'A|RB', count: 2 });
  const atCell = s;
  assert.equal(P.expandReducer(s, { type: 'up' }), s, 'up from the cell is the grid\'s to handle');
  s = P.expandReducer(s, { type: 'down' }); assert.equal(s.cursor, 0);
  s = P.expandReducer(s, { type: 'down' }); assert.equal(s.cursor, 1);
  assert.equal(P.expandReducer(s, { type: 'down' }), s, 'past the last row the grid takes over');
  s = P.expandReducer(s, { type: 'up' }); assert.equal(s.cursor, 0);
  s = P.expandReducer(s, { type: 'up' }); assert.equal(s.cursor, -1, 'back onto the cell itself');
  assert.deepEqual(s, atCell);
  assert.equal(P.expandReducer(P.EXPAND_INIT, { type: 'down' }), P.EXPAND_INIT, 'closed: nothing to descend into');
});

test('expandReducer: a settings change re-scores but never collapses', () => {
  let s = P.expandReducer(P.EXPAND_INIT, { type: 'open', cell: 'A|RB', count: 4 });
  s = P.expandReducer(s, { type: 'down' });
  s = P.expandReducer(s, { type: 'down' });
  const before = s;
  const same = P.expandReducer(s, { type: 'resync', count: 4 });
  assert.equal(same, before, 'the common case allocates nothing');
  const shrunk = P.expandReducer(s, { type: 'resync', count: 2 });
  assert.equal(shrunk.cell, 'A|RB');
  assert.equal(shrunk.cursor, 1, 'the cursor is clamped, not thrown away');
  assert.equal(P.expandReducer(s, { type: 'resync', count: 0 }).cell, null);
  assert.equal(P.expandReducer(P.EXPAND_INIT, { type: 'resync', count: 3 }), P.EXPAND_INIT);
});

test('expandReducer: an unknown action is inert', () => {
  const s = P.expandReducer(P.EXPAND_INIT, { type: 'open', cell: 'A|RB', count: 3 });
  assert.equal(P.expandReducer(s, { type: 'wat' }), s);
  assert.equal(P.expandReducer(s, null), s);
  assert.equal(P.expandReducer(null, { type: 'close' }), P.EXPAND_INIT);
});
