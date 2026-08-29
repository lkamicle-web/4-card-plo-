// node --test test/*.test.mjs
//
// The I22 harness. A regression gate is only worth its runtime if it can actually fail, so these
// tests check both halves: that the frozen fixture reproduces against the committed model, and
// that a single flipped tier anywhere in the 170,478-tier sweep is caught, counted and named.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../scripts/lib/policy.mjs';
import * as TF from '../scripts/lib/tier-fixture.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const FIXTURE_PATH = resolve(ROOT, TF.FIXTURE_PATH);
const HAVE_MODEL = existsSync(MODEL_PATH);
const HAVE_FIXTURE = existsSync(FIXTURE_PATH);
const HAVE = HAVE_MODEL && HAVE_FIXTURE;
const M = HAVE_MODEL ? P.hydrate(JSON.parse(readFileSync(MODEL_PATH, 'utf8'))) : null;

test('the fixture codec round-trips exactly', { skip: !HAVE }, () => {
  const text = readFileSync(FIXTURE_PATH, 'utf8');
  const fx = TF.parseFixture(text);
  const reEncoded = TF.encodeFixture({
    model: { meta: { hash: fx.modelHash, vpip: { min: fx.vpip[0], max: fx.vpip[1] } } },
    cells: fx.cells, sweep: fx.sweep, generated: fx.frozen,
  });
  assert.equal(reEncoded, text, 'encode(parse(f)) === f — the delta encoding loses nothing');
  assert.deepEqual(TF.parseFixture(reEncoded).sweep, fx.sweep);
});

test('the fixture covers every non-empty cell at every legal setting', { skip: !HAVE }, () => {
  const fx = TF.parseFixture(readFileSync(FIXTURE_PATH, 'utf8'));
  assert.deepEqual(fx.cells, TF.fixtureCells(M), 'frozen cell list is the model\'s 123 non-empty cells');
  assert.equal(fx.cells.length, 123);
  const want = TF.fixtureSettings(M).map(TF.settingKey);
  assert.deepEqual(fx.sweep.map(TF.settingKey), want, '21 legal (node, position) pairs x 66 integer VPIPs');
  assert.equal(fx.sweep.length, 1386);
  for (const r of fx.sweep) assert.match(r.vec, /^[1235abce]{123}$/, `${TF.settingKey(r)} encodes to legal tier chars`);
});

test('I22: the committed model reproduces the frozen v1 tiers', { skip: !HAVE }, () => {
  const fx = TF.parseFixture(readFileSync(FIXTURE_PATH, 'utf8'));
  const d = TF.compareToFixture(M, fx);
  assert.deepEqual(d.structural, []);
  assert.equal(d.settings, 0, d.examples.join(' | '));
  assert.equal(d.cells, 0);
  assert.equal(d.totalCells, 1386 * 123);
});

test('I22 catches a single moved tier, and names it', { skip: !HAVE }, () => {
  // Corrupt one cell in one setting of the *expectation* — cheaper than perturbing the policy, and
  // it exercises the same diff path the gate reports from.
  const fx = TF.parseFixture(readFileSync(FIXTURE_PATH, 'utf8'));
  const idx = fx.cells.indexOf('AA_BIGPAIR|DS');
  assert.ok(idx >= 0);
  const victim = fx.sweep[700];
  const was = victim.vec[idx];
  const now = was === '5' ? '1' : '5';
  const sweep = fx.sweep.map((r, i) => (i === 700
    ? { ...r, vec: r.vec.slice(0, idx) + now + r.vec.slice(idx + 1) }
    : r));

  const d = TF.compareToFixture(M, { ...fx, sweep });
  assert.equal(d.settings, 1, 'exactly one setting differs');
  assert.equal(d.cells, 1, 'exactly one cell tier differs');
  assert.equal(d.ok, false);
  assert.equal(d.examples.length, 1);
  assert.match(d.examples[0], /AA_BIGPAIR\|DS/);
  assert.match(d.examples[0], new RegExp(`${victim.node}/${victim.pos}@v${victim.vp}`));
  assert.ok(d.examples[0].endsWith(`-> ${TF.describeCode(was)}`), `names the tier actually painted: ${d.examples[0]}`);
});

test('I22 reports a changed cell set as its own failure, not as tier drift', { skip: !HAVE }, () => {
  const fx = TF.parseFixture(readFileSync(FIXTURE_PATH, 'utf8'));
  const cells = [...fx.cells];
  cells[4] = 'A_ROW_THAT_LEFT|DS';
  const d = TF.compareToFixture(M, { ...fx, cells });
  assert.equal(d.ok, false);
  assert.equal(d.structural.length, 2, 'one cell went missing and one appeared');
  assert.match(d.structural[0], /frozen cells are gone/);
  assert.match(d.structural[1], /cells are new since the freeze/);
});

test('a hand-edited fixture is rejected by its digest', { skip: !HAVE }, () => {
  const text = readFileSync(FIXTURE_PATH, 'utf8');
  // flip one tier char in the first full vector — the kind of "harmless" edit that would otherwise
  // quietly relax the gate
  const at = text.indexOf('\nrfi UTG 25 =') + '\nrfi UTG 25 ='.length;
  const tampered = text.slice(0, at) + (text[at] === '1' ? '5' : '1') + text.slice(at + 1);
  assert.throws(() => TF.parseFixture(tampered), /digest mismatch/);
});

test('the tier encoding keeps the MIX overlay distinct from the action under it', { skip: !HAVE_MODEL }, () => {
  const seen = new Set();
  for (const vp of [25, 55, 90]) {
    const s = P.solve(M, { pos: 'BTN', node: 'rfi', v: vp / 100, limpers: 2, raiserPos: 'CO' });
    for (const k of Object.keys(s.cells)) {
      const e = s.cells[k];
      const ch = TF.codeOf(e);
      seen.add(ch);
      // the fixture's contract: the char determines both the displayed tier and the action tier
      assert.equal(TF.describeCode(ch), e.t4 ? `T4/${e.wouldBe}` : e.wouldBe);
      assert.equal(e.tier, e.t4 ? 'T4' : e.wouldBe);
    }
  }
  assert.ok(seen.size > 1, 'the sample actually exercised more than one tier');
});
