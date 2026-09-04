// The pool-skill axis (V3-PLAN §3.4), and the detectors gates I38 and I37 run on it.
//
// THE POINT OF THIS FILE IS THE ARMING. `scripts/gates/skill.mjs` asserts that three frozen records
// reproduce and that a dozen identities hold; a gate that has never been shown to fail is a gate
// nobody knows is connected. So every clause with teeth is exercised HERE against a deliberately
// broken input — a perturbed model, a half-applied dial, a page whose node table disagrees, a
// baseline whose entry frequency is inside the dial's reach — using THE SAME functions the gate
// calls, never a re-implementation of them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as P from '../scripts/lib/policy.mjs';
import * as SK from '../scripts/lib/skill.mjs';
import { stripLiterals, pageT2Table, REACH_SCOPE } from '../scripts/gates/skill.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
P.hydrate(MODEL);
const Q = MODEL.constants.villainLattice.discipline;
const PTS = MODEL.constants.villainLattice.v;

/**
 * A model that is the shipped one with one row's `nu` moved — a different world, its own memo key.
 *
 * THE WHOLE HASH IS REPLACED, not its first eight characters, and that is not cosmetic: the memos
 * read `meta.hash.slice(0, 8)` and the SHADOW's prefix is derived from the base hash, so a twin
 * differing only in its tail would be handed the shipped model's cached answers. The first version
 * of this helper did exactly that and is what found the shadow-hash aliasing I38(a) now asserts on.
 */
function perturbed(nudge = 0.08) {
  const m = JSON.parse(JSON.stringify(MODEL));
  m.meta.hash = 'deadbeef'.repeat(8);
  for (const k of Object.keys(m.cells)) {
    if (k.startsWith('BROADWAY_RUN|') || k.startsWith('RUN0_HIGH|')) {
      m.cells[k].nu = Math.min(0.99, m.cells[k].nu + nudge);
    }
  }
  return P.hydrate(m);
}

// ---------------------------------------------------------------------------
// the dial itself
// ---------------------------------------------------------------------------
test('the lobby endpoint is v ITSELF, not the dial computing zero', () => {
  for (let v = 25; v <= 90; v += 0.25) {
    assert.ok(Object.is(P.poolVpip(v, 0), v), `poolVpip(${v}, 0)`);
    assert.ok(Object.is(P.poolVpip(v), v), `poolVpip(${v})`);
    assert.ok(Object.is(P.poolVpip(v, undefined), v));
    assert.ok(Object.is(P.poolVpip(v, NaN), v));
  }
});

test('the far endpoint is the floor CONSTANT, not v + 1*(f - v)', () => {
  // `interpolateDelta`'s lesson: the closed form is exact for many inputs and not for all of them,
  // and a far endpoint that misses the lattice by one ulp gets labelled `interpolated`.
  for (const v of [90, 88.3, 70, 55.7, 40, 26.000000001]) {
    assert.ok(Object.is(P.poolVpip(v, 1), P.CONSTANTS.skill.vFloor), `poolVpip(${v}, 1)`);
  }
});

test('the dial only ever folds: it never loosens a pool and never leaves the lattice', () => {
  for (const v of [25, 30, 55, 70, 90]) {
    for (let i = 0; i <= 20; i++) {
      const r = P.poolVpip(v, i / 20);
      assert.ok(r <= v + 1e-12 && r >= P.CONSTANTS.skill.vFloor, `v=${v} s=${i / 20} -> ${r}`);
    }
  }
  for (const v of [10, 24.9, 25]) assert.ok(Object.is(P.poolVpip(v, 1), v), 'at or under the floor, untouched');
  assert.equal(P.skillOf({ skill: 5 }), P.CONSTANTS.skill.max, 'clamped, not extrapolated');
  assert.equal(P.skillOf({ skill: -5 }), P.CONSTANTS.skill.min);
  assert.equal(P.skillOf(null), P.CONSTANTS.skill.ref);
});

test('the detents land on MEASURED lattice rows at the load default, the midpoints do not', () => {
  const v0 = SK.lobbyV(MODEL);
  for (const s of P.CONSTANTS.skill.detents) {
    assert.ok(PTS.includes(P.poolVpip(v0, s)), `detent s=${s} is off the measured lattice`);
  }
  for (const s of [0.25, 0.75]) assert.ok(!PTS.includes(P.poolVpip(v0, s)));
});

test('the published blend is the arithmetic the code runs', () => {
  assert.equal(P.CONSTANTS.skill.blend, SK.blendSpelling());
  for (const v of [90, 70, 55, 40]) {
    for (const s of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      assert.ok(Object.is(P.poolVpip(v, s), SK.blendValue(v, s)));
    }
  }
});

// ---------------------------------------------------------------------------
// the profile layer
// ---------------------------------------------------------------------------
test('villainProfileOf is idempotent — the dial cannot be applied twice', () => {
  const p = P.villainProfileOf({ on: true, v: 55, q: Q, skill: 1 }, MODEL);
  assert.equal(p.v, 25);
  assert.equal(p.v0, 55);
  assert.equal(P.villainProfileOf(p, MODEL), p, 'a normalised profile must come back BY REFERENCE');
  // and the brand does not leak into anything the page serialises
  assert.equal(JSON.stringify(p).indexOf('__pool'), -1);
});

test('the pool at (55, skill 1) and the pool at (25, skill 0) are the SAME POOL', () => {
  const a = P.poolAt(MODEL, { on: true, v: 55, q: Q, skill: 1 });
  const b = P.poolAt(MODEL, { on: true, v: 25, q: Q });
  assert.equal(a.model, b.model, 'same shadow OBJECT, not an equal one');
  assert.ok(Object.is(a.v, b.v));
  assert.equal(P.villainKey({ on: true, v: 55, q: Q, skill: 1 }, MODEL),
    P.villainKey({ on: true, v: 25, q: Q }, MODEL));
  for (const { pos, node } of SK.legalPairs()) {
    assert.equal(P.solve(a.model, { pos, node, v: a.v, limpers: 2, raiserPos: 'CO' }),
      P.solve(b.model, { pos, node, v: b.v, limpers: 2, raiserPos: 'CO' }), `${pos}|${node}`);
  }
});

test('ARMED: a half-applied dial is visible — width resolved, equities not', () => {
  const half = P.solve(P.poolAt(MODEL, { on: true, v: 55, q: Q }).model,
    { pos: 'BTN', node: 'rfi', v: P.poolVpip(55, 1) / 100, limpers: 2, raiserPos: 'CO' });
  const whole = P.solve(P.poolAt(MODEL, { on: true, v: 55, q: Q, skill: 1 }).model,
    { pos: 'BTN', node: 'rfi', v: P.poolVpip(55, 1) / 100, limpers: 2, raiserPos: 'CO' });
  assert.notEqual(half, whole,
    'if these are the same object the coordinate-change clause proves nothing');
});

test('the shadow memo prefix separates two MODELS, not just two profiles', () => {
  // The P4 finding: before this, a shadow's hash prefix came from `villainKey` alone, so every model
  // profiled at the same (v, q) shared a `SOLVE_MEMO` prefix and the second one was handed the
  // first's answer. Nothing in GREEN reached it; this is the assertion that keeps it that way.
  const twin = perturbed();
  const a = P.profiledModel(MODEL, { on: true, v: 55, q: Q });
  const b = P.profiledModel(twin, { on: true, v: 55, q: Q });
  assert.notEqual(a.meta.hash.slice(0, 8), b.meta.hash.slice(0, 8));
  assert.notEqual(a.meta.hash.slice(0, 8), MODEL.meta.hash.slice(0, 8), 'and not the shipped prefix either');
});

test('with the profile OFF the axis does not exist — the legacy lane cannot be reached', () => {
  for (const p of [null, undefined, { on: false, skill: 1 }, { skill: 1 }, { on: false, v: 55, skill: 1 }]) {
    const pool = P.poolAt(MODEL, p);
    assert.equal(pool.model, MODEL, 'the model ITSELF, by identity');
    assert.equal(pool.v, null);
    assert.equal(P.villainKey(p, MODEL), 'OFF');
  }
});

// ---------------------------------------------------------------------------
// the three frozen records — and that they are connected to anything
// ---------------------------------------------------------------------------
test('the width records reproduce on the shipped model', () => {
  assert.deepEqual(SK.widthProblems(MODEL), []);
  const t = SK.widthTable(MODEL);
  assert.equal(t.pools.map((p) => p.vPct).join(' '), '55 47.5 40 32.5 25');
  for (let i = 1; i < t.agg.length; i++) assert.ok(t.agg[i] < t.agg[i - 1], `aggregate step ${i}`);
});

test('the endpoint exceptions are the six vs-3-Bet pairs, and the move is a LABEL not a hand', () => {
  assert.deepEqual([...SK.WIDTH_ENDPOINT_EXCEPTIONS].sort(),
    ['BB|3bet', 'BTN|3bet', 'CO|3bet', 'HJ|3bet', 'SB|3bet', 'UTG|3bet']);
  // T3 -> T2 at the vs-3-Bet node is CALL -> AMBUSH CALL: `actionLevel` must read them the same,
  // which is why I37's divergence at SB|3bet is flat while I38's width moves.
  assert.equal(SK.actionLevel('T3', '3bet'), SK.actionLevel('T2', '3bet'));
  assert.notEqual(SK.actionLevel('T3', 'rfi'), SK.actionLevel('T2', 'rfi'));
});

test('ARMED: a model whose tiers move breaks BOTH width records', () => {
  const problems = SK.widthProblems(perturbed());
  assert.ok(problems.length > 0, 'the width records are not connected to the model');
  assert.ok(problems.some((x) => /exception set moved/.test(x)), problems.join(' | '));
});

test('the convergence record reproduces, and §7.2\'s prediction is the measured ordering', () => {
  const c = SK.convergenceProblems(MODEL);
  assert.deepEqual(c.problems, []);
  assert.equal(c.found.length, SK.CONVERGENCE_VIOLATIONS.length);
  assert.deepEqual(c.ranked.slice(0, 2).sort(), [...SK.PREDICTED_ROWS].sort());
  assert.ok(c.rate.TRASH.bad / c.rate.TRASH.n < c.rate.BROADWAY_RUN.bad / c.rate.BROADWAY_RUN.n,
    'the junk row must not lead — that half of the prediction is the interesting half');
});

test('ARMED: a model whose tiers move breaks the convergence record', () => {
  const c = SK.convergenceProblems(perturbed(0.2));
  assert.ok(c.problems.length > 0, 'the convergence record is not connected to the model');
});

test('the divergence is negative everywhere and GROWS at two of the three covered nodes', () => {
  // The finding P4 ships: the model is tighter than the HU equilibrium at every covered node and
  // every dial setting, and tightening the pool moves it further away rather than closer. Pinned so
  // a later phase cannot quietly turn it into a convergence claim.
  const t = SK.divergenceTable(MODEL);
  assert.equal(t.nodes.length, 3);
  for (const nd of t.nodes) for (const x of nd.signed) assert.ok(x < 0, `${nd.key} ${x}`);
  const growing = t.nodes.filter((nd) => Math.abs(nd.signed[nd.signed.length - 1]) > Math.abs(nd.signed[0]));
  assert.deepEqual(growing.map((n) => n.key).sort(), ['BB|raise', 'SB|rfi']);
  const flat = t.nodes.find((n) => n.key === 'SB|3bet');
  assert.equal(new Set(flat.signed).size, 1, 'the vs-3-Bet node does not move on the action scale');
});

// ---------------------------------------------------------------------------
// the plays-better coefficient's reach
// ---------------------------------------------------------------------------
test('no number was invented for the plays-better half', () => {
  assert.equal(P.CONSTANTS.skill.playsBetter, null);
  assert.match(P.CONSTANTS.skill.flag, /playsBetter/);
  assert.match(P.CONSTANTS.skill.flag, /blend/);
});

test('the reach scan strips the admission but not a read', () => {
  // The flag NAMES the coefficient — that is §6's requirement, not a violation — and so does the
  // Method view's badge map. Both are string literals; a read is not.
  assert.equal((stripLiterals("const x = 'playsBetter is null';").match(/playsBetter/g) || []).length, 0);
  assert.equal((stripLiterals("var UNANCHORED = { 'skill.playsBetter': 1 };").match(/playsBetter/g) || []).length, 0);
  assert.equal((stripLiterals('// playsBetter in a comment\nconst y = 1;').match(/playsBetter/g) || []).length, 0);
  assert.equal((stripLiterals('const r = K.playsBetter * 0.5;').match(/playsBetter/g) || []).length, 1);
});

test('the shipped scope reads it exactly where the gate allows and nowhere else', () => {
  for (const [rel, allowed] of REACH_SCOPE) {
    const n = (stripLiterals(readFileSync(resolve(ROOT, rel), 'utf8')).match(/playsBetter/g) || []).length;
    assert.equal(n, allowed, `${rel} reads playsBetter ${n} times, ${allowed} allowed`);
  }
});

test('realization is dial-blind at every setting — the reach is zero, measured', () => {
  let n = 0;
  for (const p of SK.poolsAlong(MODEL)) {
    for (const { pos, node } of SK.legalPairs()) {
      if (node === '3bet') continue;
      const out = P.solve(p.model, { pos, node, v: p.v, limpers: 2, raiserPos: 'CO' });
      for (const k of Object.keys(out.cells)) {
        const e = out.cells[k];
        if (e.R == null) continue;
        n++;
        assert.ok(Object.is(e.R, P.realization(pos, out.N, p.model.cells[k].nu, P.CONSTANTS.depth.ref)));
      }
    }
  }
  assert.ok(n > 9000, `only ${n} realization readings — the probe has stopped covering the dial`);
});

// ---------------------------------------------------------------------------
// the two grep-gated cross-checks
// ---------------------------------------------------------------------------
test('the T2 reading is the page\'s own, and a disagreement is detectable', () => {
  const shell = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  const page = pageT2Table(shell);
  assert.deepEqual(Object.keys(page).sort(), [...P.NODES].sort());
  for (const node of P.NODES) assert.equal(page[node], SK.T2_AT[node], node);
  // ARMED: flip the page's own spelling and the reading must change
  const flipped = pageT2Table(shell.replace(
    "{ key: 'rfi', label: 'RFI', tabs: 'RFI', t1: 'RAISE', t2: 'RAISE'",
    "{ key: 'rfi', label: 'RFI', tabs: 'RFI', t1: 'RAISE', t2: 'RAISE-ISH'"));
  assert.equal(flipped.rfi, 3, 'the T2 cross-check reads a constant, not the page');
});

test('the Method view badges all three flagged skill records', () => {
  const shell = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  const map = /var UNANCHORED = \{([^}]*)\}/.exec(shell);
  assert.ok(map, 'the badge map is gone');
  assert.match(map[1], /'skill\.blend'/);
  assert.match(map[1], /'skill\.playsBetter'/);
  for (const p of ['skill.min', 'skill.ref', 'skill.max']) {
    assert.ok(map[1].indexOf(`'${p}'`) >= 0, `${p} is flagged but not badged`);
  }
  // ...and the map is READ where the constants render. A P4 refuter deleted the branch in
  // `constHTML` that consumes it, left the map in place, and shipped with the skill family and 47
  // tests green — the P1 failure (a flag deleted with everything green) one level out.
  assert.match(shell, /UNANCHORED\[q\][^;]*tag-e[^;]*estimate/,
    'nothing reads the badge map where constants render');
});

// ---------------------------------------------------------------------------
// the domain — P4's red-team stage (docs/refutations/P4.md)
//
// `min`/`ref`/`max` shipped claiming to be "anchored by construction", by `poolVpip`'s two early
// returns. Three refuters of three refuted it with the whole triple green: `min = -1` resolves the
// load default to VPIP 85 — LOOSENING the pool onto the plays-better side Grade C does not build,
// and `wireVP` copies that number onto the page's slider — while `max = 2` and `ref = 0.05` shipped
// green too, and both early returns turn out to be removable with everything green. No replacement
// anchor was invented: the domain is FORCED by the published blend and the measured floor, and that
// is what these assert, beside I38(g).
// ---------------------------------------------------------------------------
test('the domain is forced by the published blend and the measured floor, not chosen', () => {
  const K = P.CONSTANTS.skill;
  for (const v of [25, 32.5, 40, 47.5, 55, 63, 70, 88, 90]) {
    // the blend returns the pool itself ONLY at ref, and the floor ONLY at max
    assert.ok(Object.is(SK.blendValue(v, K.ref), v), `ref does not return the pool itself at v=${v}`);
    assert.ok(Object.is(SK.blendValue(v, K.max), K.vFloor), `max does not reach the floor at v=${v}`);
    assert.ok(Object.is(P.poolVpip(v, K.min), v), `the dial's lower bound is not the lobby at v=${v}`);
    if (v <= K.vFloor) continue;
    // ARMED: any other setting does neither, which is what makes the two above a forcing
    assert.notEqual(SK.blendValue(v, 0.05), v);
    assert.notEqual(SK.blendValue(v, 0.9), K.vFloor);
    assert.notEqual(SK.blendValue(v, 2), K.vFloor);
  }
});

test('the dial never loosens a pool, and reaches the floor only at max', () => {
  const K = P.CONSTANTS.skill;
  const shell = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  const step = +(/id="vpskill"[^>]*\sstep="([^"]+)"/.exec(shell) || [, ''])[1];
  assert.ok(step > 0, 'the page publishes no slider step');
  assert.match(shell, /\.min\s*=\s*SKILL\.min\s*;\s*[\w$]+\.max\s*=\s*SKILL\.max/,
    'the slider no longer takes its bounds from the constants, so the domain bounded here is not the one a reader gets');
  for (const v of [40, 55, 70, 90]) {
    let prev = P.poolVpip(v, K.min);
    for (let i = 0; i <= Math.round((K.max - K.min) / step); i++) {
      const s = Math.min(K.max, K.min + i * step);
      const r = P.poolVpip(v, s);
      assert.ok(r <= v + 1e-12, `the dial loosens at v=${v}, s=${s}: ${r}`);
      assert.ok(r <= prev + 1e-12, `the dial is not monotone at v=${v}, s=${s}`);
      if (s < K.max) assert.ok(r > K.vFloor, `the dial reaches the floor at s=${s}, before max`);
      prev = r;
    }
  }
});

test('the blend is LINEAR, not merely monotone through the sampled points', () => {
  // Three refuters shipped `v + (s + 0.05*sin(4*pi*s))*(vFloor - v)` — published in
  // constants.skill.blend, blendSpelling() and blendValue() together — fully green, because
  // monotonicity and two endpoints do not bound a curve. Linear in s IS a second difference of zero.
  const K = P.CONSTANTS.skill;
  const ripple = (v, s) => v + (s + 0.05 * Math.sin(4 * Math.PI * s)) * (K.vFloor - v);
  for (const v of [40, 55, 90]) {
    const val = [], rip = [];
    for (let i = 0; i <= 100; i++) {
      const s = Math.min(K.max, K.min + i / 100);
      val.push(P.poolVpip(v, s));
      rip.push(s === K.ref ? v : (s === K.max ? K.vFloor : ripple(v, s)));
    }
    let worst = 0, worstRipple = 0;
    for (let i = 1; i + 1 < val.length; i++) {
      worst = Math.max(worst, Math.abs(val[i - 1] - 2 * val[i] + val[i + 1]));
      worstRipple = Math.max(worstRipple, Math.abs(rip[i - 1] - 2 * rip[i] + rip[i + 1]));
    }
    assert.ok(worst <= 1e-9, `the shipped blend curves: worst second difference ${worst} at v=${v}`);
    // ARMED: the refuters' own curve must be separated by the same reading, with room to spare
    assert.ok(worstRipple > 1e-3, `the shape check cannot see a ripple at v=${v} (${worstRipple})`);
  }
});

// ---------------------------------------------------------------------------
// "≈ 0 at pool = baseline" — not measurable, and the detector that says when it becomes so
// ---------------------------------------------------------------------------
test('the pool = baseline clause is NOT MEASURABLE on the shipped payload', () => {
  const r = SK.reachReadiness(MODEL);
  assert.equal(r.measurable, false);
  assert.equal(r.node, 'SB|rfi');
  assert.ok(r.entry > 88 && r.entry < 89, `entry frequency ${r.entry}`);
  assert.ok(r.gap > 33, 'the gap is the reason, and it is not a rounding argument');
});

test('ARMED: a baseline that opens tightly makes the clause measurable, and the gate must fail', () => {
  // The day a shipped baseline's entry frequency lands at or below the lobby, I37's first clause is
  // owed a real measurement instead of the note. Fabricate exactly that payload.
  const m = JSON.parse(JSON.stringify(MODEL));
  const nd = m.baselineTiers.nodes['SB|rfi'];
  const steps = Math.round(1 / m.baselineTiers.quant);
  const fi = nd.actions.indexOf('fold'), ri = nd.actions.indexOf('raise'), N = nd.actions.length;
  m.baselineTiers.order.forEach((_, i) => {           // fold everything: entry frequency 0
    nd.w[i * N + fi] = steps;
    nd.w[i * N + ri] = 0;
  });
  const r = SK.reachReadiness(m);
  assert.equal(r.measurable, true, 'the readiness detector is not connected to the shipped payload');
});
