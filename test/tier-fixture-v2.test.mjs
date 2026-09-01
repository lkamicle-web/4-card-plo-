// node --test test/*.test.mjs
//
// The I32 harness. I22's harness (tier-fixture.test.mjs) asks whether the gate can fail; this one
// has to ask something harder, because I32's whole reason to exist is that I22 CANNOT fail on the
// mechanisms v3 is about to add. So the load-bearing tests here are the last two:
//
//   * a perturbation of the depth dial and a perturbation of the straddle transform both leave
//     the v1 operating point EXACTLY where it was — I22 stays green through each of them — and
//     both move the v2 surface. That is the coverage I32 buys, demonstrated rather than claimed.
//   * the v1 fixture is inside the v2 fixture verbatim, diffed artefact against artefact with no
//     pipeline in the middle. V3-PLAN §5.1 carries v1 identity "transitively"; this is the test
//     that makes transitively a fact instead of a hope.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../scripts/lib/policy.mjs';
import * as TF from '../scripts/lib/tier-fixture.mjs';
import * as TF2 from '../scripts/lib/tier-fixture-v2.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const V2_PATH = resolve(ROOT, TF2.FIXTURE_PATH);
const V1_PATH = resolve(ROOT, TF.FIXTURE_PATH);
const HAVE_MODEL = existsSync(MODEL_PATH);
const HAVE = HAVE_MODEL && existsSync(V2_PATH);
const HAVE_BOTH = HAVE && existsSync(V1_PATH);
const M = HAVE_MODEL ? P.hydrate(JSON.parse(readFileSync(MODEL_PATH, 'utf8'))) : null;
const load2 = () => TF2.parseFixture(readFileSync(V2_PATH, 'utf8'));

test('the v2 fixture codec round-trips exactly', { skip: !HAVE }, () => {
  const text = readFileSync(V2_PATH, 'utf8');
  const fx = load2();
  const reEncoded = TF2.encodeFixture({
    model: { meta: { hash: fx.modelHash, vpip: { min: fx.vpip[0], max: fx.vpip[1] } } },
    cells: fx.cells, lanes: fx.lanes, sweep: fx.sweep, generated: fx.frozen,
  });
  assert.equal(reEncoded, text, 'encode(parse(f)) === f — the delta encoding loses nothing');
  assert.deepEqual(TF2.parseFixture(reEncoded).sweep, fx.sweep);
});

test('the fixture is the V3-PLAN §0.4 surface, whole', { skip: !HAVE }, () => {
  const fx = load2();
  const lanes = TF2.laneSpecs();
  assert.equal(lanes.length, 12, 'depth {40,100,250} x rake {0,preset} x straddle {off,on}');
  assert.deepEqual(fx.lanes.map((L) => L.id), lanes.map((L) => L.id));
  assert.deepEqual(fx.lanes.map(TF2.laneSpec), lanes.map(TF2.laneSpec), 'the frozen lanes are the ones CONSTANTS still describes');
  assert.deepEqual(fx.cells, TF2.fixtureCells(M), 'the model\'s 123 non-empty cells');

  const want = TF2.fixtureSettings(M, lanes).map(TF2.settingKey);
  assert.deepEqual(fx.sweep.map(TF2.settingKey), want, '12 lanes x 21 legal (node, position) pairs x 66 integer VPIPs');
  assert.equal(fx.sweep.length, 16632);
  assert.equal(fx.sweep.length * fx.cells.length, 2045736);
  for (const r of fx.sweep) assert.match(r.vec, /^[1235abce]{123}$/, `${TF2.settingKey(r)} encodes to legal tier chars`);
});

test('the frozen v1-point lane IS the pipeline\'s own operating point', { skip: !HAVE }, () => {
  const fx = load2();
  assert.equal(fx.v1Point, 'd100/r0/s0');
  assert.equal(fx.v1Point, TF2.V1_POINT_LANE());
  const lane = fx.lanes.find((L) => L.id === fx.v1Point);
  assert.ok(lane, 'the v1 point is a declared lane');
  // `envOf` hands back the shared frozen DEFAULT_ENV only when every axis is at its default, so
  // this equality is what makes the containment test below a statement about v1 and not about a
  // lane that merely looks like it.
  assert.equal(P.envKey(TF2.envArgs(lane)), P.envKey({}));
  assert.equal(P.envOf(TF2.envArgs(lane)), P.envOf({}), 'object identity, not just an equal key');
});

test('I32: the committed model reproduces the frozen v2 tiers, on all twelve lanes', { skip: !HAVE }, () => {
  const d = TF2.compareToFixture(M, load2());
  assert.deepEqual(d.structural, []);
  assert.equal(d.settings, 0, d.examples.join(' | '));
  assert.equal(d.cells, 0);
  assert.equal(d.totalCells, 16632 * 123);
});

test('I32 catches a single moved tier, names it, and says which lane', { skip: !HAVE }, () => {
  // Corrupt one cell of the *expectation* on a lane I22 cannot see — cheaper than perturbing the
  // policy, and it exercises the diff path the gate reports from. Sliced to one lane so the
  // recompute is a fifth of a second; the slice's own consequence (a domain narrower than the
  // model's) is asserted below rather than shrugged at.
  const fx = load2();
  const lane = 'd40/r5/s1';
  const rows = fx.sweep.filter((r) => r.lane === lane);
  assert.equal(rows.length, 1386);
  const idx = fx.cells.indexOf('AA_BIGPAIR|DS');
  assert.ok(idx >= 0);
  const victim = rows[700];
  const was = victim.vec[idx];
  const now = was === '5' ? '1' : '5';
  const sweep = rows.map((r, i) => (i === 700 ? { ...r, vec: r.vec.slice(0, idx) + now + r.vec.slice(idx + 1) } : r));

  const d = TF2.compareToFixture(M, { ...fx, sweep }, 4);
  assert.equal(d.settings, 1, 'exactly one setting differs');
  assert.equal(d.cells, 1, 'exactly one cell tier differs');
  assert.equal(d.ok, false);
  assert.deepEqual([...d.byLane], [[lane, 1]], 'the failure is attributed to the lane it happened on');
  assert.equal(d.examples.length, 1);
  assert.match(d.examples[0], /^d40\/r5\/s1 /);
  assert.match(d.examples[0], /AA_BIGPAIR\|DS/);
  assert.match(d.examples[0], new RegExp(`${victim.node}/${victim.pos}@v${victim.vp}`));
  assert.ok(d.examples[0].endsWith(`-> ${TF2.describeCode(was)}`), `names the tier actually painted: ${d.examples[0]}`);
  // the slice is one lane of twelve, and the gate says so instead of passing quietly
  assert.equal(d.structural.length, 1);
  assert.match(d.structural[0], /settings exist now that the fixture never froze/);
});

test('I32 reports LANE DRIFT as its own failure, not as tier drift', { skip: !HAVE }, () => {
  // The recompute deliberately uses the FIXTURE's lanes, not the code's, so that a moved rake
  // constant cannot silently re-point the gate at a surface nobody froze. The cost of that choice
  // is that lane drift produces ZERO tier diffs — so it has to be its own red, or it would be no
  // red at all. Both drift shapes are exercised: a lane whose spec changed under a fixed id, and
  // a lane whose id itself moved.
  const fx = load2();
  const slice = fx.sweep.filter((r) => r.lane === 'd100/r5/s0' && r.node === 'rfi');
  assert.equal(slice.length, 330, 'rfi is legal at five seats — the BB never open-raises');

  const wasCap = P.CONSTANTS.rake.capBB;
  let d;
  try {
    P.CONSTANTS.rake.capBB = 4;
    P.clearSolveMemo();
    d = TF2.compareToFixture(M, { ...fx, sweep: slice }, 4);
  } finally { P.CONSTANTS.rake.capBB = wasCap; P.clearSolveMemo(); }
  assert.equal(d.ok, false);
  assert.equal(d.cells, 0, 'no tier moved — the recompute ran on the FROZEN lanes, which is the point');
  assert.equal(d.structural.filter((s) => /drifted: frozen .*rakeCapBB=3.* -> now .*rakeCapBB=4/.test(s)).length, 12,
    'every lane carries the cap, so every lane drifted');

  const wasPreset = P.CONSTANTS.rake.preset;
  try {
    P.CONSTANTS.rake.preset = wasPreset - 1;
    P.clearSolveMemo();
    d = TF2.compareToFixture(M, { ...fx, sweep: slice }, 4);
  } finally { P.CONSTANTS.rake.preset = wasPreset; P.clearSolveMemo(); }
  assert.equal(d.cells, 0);
  assert.ok(d.structural.some((s) => /^lane d100\/r4\/s0 .* is in the §0\.4 surface now and was never frozen$/.test(s)));
  assert.ok(d.structural.some((s) => /^frozen lane d100\/r5\/s0 .* is no longer in the §0\.4 surface$/.test(s)));
});

test('I32 reports a changed cell set as its own failure, not as tier drift', { skip: !HAVE }, () => {
  const fx = load2();
  const cells = [...fx.cells];
  cells[4] = 'A_ROW_THAT_LEFT|DS';
  const d = TF2.compareToFixture(M, { ...fx, cells, sweep: fx.sweep.slice(0, 66) }, 4);
  assert.equal(d.ok, false);
  assert.ok(d.structural.some((s) => /frozen cells are gone/.test(s)));
  assert.ok(d.structural.some((s) => /cells are new since the freeze/.test(s)));
});

test('a hand-edited v2 fixture is rejected by its digest', { skip: !HAVE }, () => {
  const text = readFileSync(V2_PATH, 'utf8');
  const marker = '\nd40/r0/s0 rfi UTG 25 =';
  const at = text.indexOf(marker) + marker.length;
  assert.ok(at > marker.length, 'found the first full vector');
  const tampered = text.slice(0, at) + (text[at] === '1' ? '5' : '1') + text.slice(at + 1);
  assert.throws(() => TF2.parseFixture(tampered), /digest mismatch/);
});

test('a fixture line naming an undeclared lane is rejected', { skip: !HAVE }, () => {
  const text = readFileSync(V2_PATH, 'utf8');
  const tampered = text.replace('\nd40/r0/s0 rfi UTG 25 =', '\nd40/r9/s0 rfi UTG 25 =');
  assert.throws(() => TF2.parseFixture(tampered), /no LANE declares/);
});

// ---------------------------------------------------------------------------
// succession — I22 lives inside I32, and it is checked, not assumed
// ---------------------------------------------------------------------------
test('succession: the v1 fixture is inside the v2 fixture, verbatim', { skip: !HAVE_BOTH }, () => {
  const v1 = TF.parseFixture(readFileSync(V1_PATH, 'utf8'));
  const c = TF2.compareV1Containment(load2(), v1);
  assert.deepEqual(c.problems, []);
  assert.equal(c.bad, 0);
  assert.equal(c.rows, 1386);
  assert.equal(c.ok, true);
  // and the containment is a claim about the artefacts, not about the pipeline: no solve() ran.
});

test('succession breaks loudly if a v1-point row moves', { skip: !HAVE_BOTH }, () => {
  const v1 = TF.parseFixture(readFileSync(V1_PATH, 'utf8'));
  const fx = load2();
  const i = fx.sweep.findIndex((r) => r.lane === fx.v1Point);
  const sweep = [...fx.sweep];
  sweep[i + 3] = { ...sweep[i + 3], vec: '5'.repeat(fx.cells.length) };
  const c = TF2.compareV1Containment({ ...fx, sweep }, v1);
  assert.equal(c.ok, false);
  assert.equal(c.bad, 1);
  assert.match(c.problems[0], /v1 .* vs v2 lane /);
});

// ---------------------------------------------------------------------------
// THE POINT OF I32 — the coverage I22 structurally cannot have
// ---------------------------------------------------------------------------
/**
 * Recompute one node's worth of the surface and count, per lane, how many cell tiers differ from
 * what was frozen. `rfi` alone is 6 positions x 66 VPIPs x 12 lanes = 4,752 settings, which is
 * enough to make the point in about a second.
 */
function driftByLane(fx) {
  const laneBy = new Map(fx.lanes.map((L) => [L.id, L]));
  const rows = fx.sweep.filter((r) => r.node === 'rfi');
  P.clearSolveMemo();
  const got = TF2.sweepTiers(M, fx.cells, rows, laneBy);
  P.clearSolveMemo();
  const by = new Map(fx.lanes.map((L) => [L.id, 0]));
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < fx.cells.length; j++) {
      if (rows[i].vec[j] !== got[i].vec[j]) by.set(rows[i].lane, by.get(rows[i].lane) + 1);
    }
  }
  return by;
}

test('the depth dial is INVISIBLE to I22 and visible to I32', { skip: !HAVE }, () => {
  const fx = load2();
  const was = P.CONSTANTS.depth.lambda;
  let by;
  try {
    // u(d) = log2(d/100)/log2(2.5), so u(100) = 0 EXACTLY and every depth term is the identity at
    // the v1 point no matter what lambda is. I22 cannot fail here however far this constant moves.
    P.CONSTANTS.depth.lambda = was * 1.10;
    by = driftByLane(fx);
  } finally {
    P.CONSTANTS.depth.lambda = was;
    P.clearSolveMemo();
  }
  assert.equal(by.get('d100/r0/s0'), 0, 'the v1 operating point does not move — this is exactly I22\'s blind spot');
  assert.equal(by.get('d100/r5/s0'), 0, 'nor does the 100bb raked lane: rake does not change dEff');
  assert.ok(by.get('d40/r0/s0') > 0, 'the shallow lane moves');
  assert.ok(by.get('d250/r0/s0') > 0, 'the deep lane moves');
  assert.equal(TF2.compareToFixture(M, { ...fx, sweep: fx.sweep.filter((r) => r.node === 'rfi') }, 1).cells, 0,
    'and with the constant restored, the same slice reproduces');
});

test('the straddle transform is INVISIBLE to I22 and visible to I32', { skip: !HAVE }, () => {
  const fx = load2();
  const was = P.CONSTANTS.straddle.seat;
  let by;
  try {
    // `straddleShift` returns exactly 1 when the straddle is off, so this constant is unreachable
    // from v1's operating point — and reachable from six of I32's twelve lanes.
    P.CONSTANTS.straddle.seat = was * 0.97;
    by = driftByLane(fx);
  } finally {
    P.CONSTANTS.straddle.seat = was;
    P.clearSolveMemo();
  }
  for (const L of fx.lanes) {
    if (L.straddle) continue;
    assert.equal(by.get(L.id), 0, `${L.id} is unstraddled and must not move`);
  }
  assert.ok([...by].some(([id, n]) => id.endsWith('/s1') && n > 0), 'at least one straddled lane moves');
});
