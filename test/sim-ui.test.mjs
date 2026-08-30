/**
 * test/sim-ui.test.mjs — V2-PLAN §4's UI rules, tested as the text that ships.
 *
 * The three rules with teeth (when does the Simulate button exist, what may a badge claim, and what
 * cancels a run) live in a marked block inside `src/shell.html`. This file SLICES THAT BLOCK OUT OF
 * THE SHELL and evaluates it — the same trick `test/sim-engine.test.mjs` plays on the engine, and
 * for the same reason: a copy of the rules in a test file is a second implementation that can drift
 * away from the one users get.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { seOfTrials } from '../scripts/lib/policy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = readFileSync(join(ROOT, 'src', 'shell.html'), 'utf8');

const START = '/* @sim-ui-logic';
const END = '/* @end:sim-ui-logic */';
const a = SHELL.indexOf(START);
const b = SHELL.indexOf(END);
assert.ok(a > 0 && b > a, 'src/shell.html must carry the @sim-ui-logic markers');
const SRC = SHELL.slice(a, b);

/** The shipped block, evaluated standalone. */
const SIMUI = new Function(`${SRC}\nreturn SIMUI;`)();

const PTS = [25, 40, 55, 70, 90];
const QDEF = 0.85;

function T(over) {
  return SIMUI.triggerState({ on: true, v: 55, q: QDEF, qDef: QDEF, pts: PTS, measured: null, available: true, ...over });
}

// ---------------------------------------------------------------- self-containment

test('the block is self-contained — it can only be sliced out if it reaches for nothing', () => {
  // Comments are prose and may name anything; the CODE may not. If any of these appear outside a
  // comment the block has stopped being testable as shipped text: it would need the app's closure
  // to evaluate, and this file would silently be testing a stub instead.
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (const forbidden of ['MODEL', 'document', 'window', '$(', 'S.v', 'S.q', 'POL.', 'CELLS', 'SIMRUN']) {
    assert.ok(!code.includes(forbidden), `@sim-ui-logic must not reference ${forbidden} in code`);
  }
  assert.equal(SIMUI.version, 1);
});

// ---------------------------------------------------------------- the trigger decision table

test('profile OFF: no badge and no button at any VPIP, on the lattice or off it', () => {
  for (let v = 25; v <= 90; v++) {
    for (const q of [0, 0.5, QDEF, 1]) {
      const t = SIMUI.triggerState({ on: false, v, q, qDef: QDEF, pts: PTS, measured: null, available: true });
      assert.equal(t.needsSim, false, `v=${v} q=${q}`);
      assert.equal(t.showButton, false, `v=${v} q=${q}`);
      assert.equal(t.badge, 'none', `v=${v} q=${q}`);
      assert.equal(t.source, 'shipped');
    }
  }
});

test('profile ON at a lattice point: the numbers ARE the measurement — no badge, no button', () => {
  for (const v of PTS) {
    const t = T({ v });
    assert.equal(t.badge, 'none', `v=${v}`);
    assert.equal(t.showButton, false, `v=${v}`);
    assert.equal(t.needsSim, false, `v=${v}`);
    assert.equal(t.source, 'lattice');
  }
});

test('profile ON off the lattice: interpolated badge and a Simulate button', () => {
  for (const v of [26, 33, 47, 54, 56, 62, 71, 89]) {
    const t = T({ v });
    assert.equal(t.badge, 'interpolated', `v=${v}`);
    assert.equal(t.needsSim, true, `v=${v}`);
    assert.equal(t.showButton, true, `v=${v}`);
    assert.equal(t.source, 'interpolated');
  }
});

test('a custom q takes the settings off-lattice even AT a lattice VPIP, and there is no answer to interpolate', () => {
  for (const v of PTS) {
    const t = T({ v, q: 0.9 });
    assert.equal(t.badge, 'unsupported', `v=${v}`);
    assert.equal(t.needsSim, true, `v=${v}`);
    assert.equal(t.showButton, true, `v=${v}`);
    // the important half: it does NOT claim an interpolated number for an axis with one measurement
    assert.equal(t.source, 'none');
    assert.match(t.why, /random-villain baseline/);
  }
  assert.equal(T({ v: 55, q: QDEF }).badge, 'none');
});

test('the armed condition is exactly (profile on) AND (v off lattice OR q custom) — swept', () => {
  for (let v = 25; v <= 90; v++) {
    for (const q of [0, 0.25, 0.84, QDEF, 0.86, 1]) {
      for (const on of [false, true]) {
        const t = SIMUI.triggerState({ on, v, q, qDef: QDEF, pts: PTS, measured: null, available: true });
        const expected = on && (!PTS.includes(v) || q !== QDEF);
        assert.equal(t.needsSim, expected, `on=${on} v=${v} q=${q}`);
        assert.equal(t.showButton, expected, `on=${on} v=${v} q=${q}`);
      }
    }
  }
});

test('depth, rake, straddle, position, node, limpers and the 3-bet mix cannot arm the button', () => {
  const base = { on: true, v: 55, q: QDEF, qDef: QDEF, pts: PTS, measured: null, available: true };
  const quiet = SIMUI.triggerState(base);
  const noisy = SIMUI.triggerState({
    ...base,
    d: 250, rakePct: 6, rakeCapBB: 9, straddle: true,
    pos: 'BTN', node: '3bet', limpers: 4, raiserPos: 'CO', mix: [10, 40, 30, 20], colorBy: 'nu',
  });
  assert.deepEqual(noisy, quiet);
  assert.equal(noisy.showButton, false);
  // and off-lattice they are equally inert: the button was already armed by v alone
  const off = SIMUI.triggerState({ ...base, v: 62 });
  const offNoisy = SIMUI.triggerState({ ...base, v: 62, d: 40, rakePct: 5, straddle: true, node: 'limps' });
  assert.deepEqual(offNoisy, off);
});

test('with the engine unavailable the badge still tells the truth, the button just does not appear', () => {
  const t = T({ v: 62, available: false });
  assert.equal(t.needsSim, true);
  assert.equal(t.showButton, false);
  assert.equal(t.badge, 'interpolated');
});

test('a measured result flips the badge but leaves the button (for the 4x re-run)', () => {
  const t = T({ v: 62, measured: { trials: 25000 } });
  assert.equal(t.badge, 'measured');
  assert.equal(t.source, 'measured');
  assert.equal(t.needsSim, false);
  assert.equal(t.showButton, true);
});

test('a measurement can never resurrect a badge at a lattice point', () => {
  // Belt and braces: the page never offers a run there, but "no badge on the lattice" is stated as
  // unconditional in V2-PLAN §4 and is asserted here as unconditional.
  const t = T({ v: 55, measured: { trials: 100000 } });
  assert.equal(t.badge, 'none');
  assert.equal(t.showButton, false);
});

test('onLattice reports its two halves separately, because they have different remedies', () => {
  assert.deepEqual(SIMUI.onLattice(PTS, 55, 0.85, 0.85), { v: true, q: true, both: true });
  assert.deepEqual(SIMUI.onLattice(PTS, 62, 0.85, 0.85), { v: false, q: true, both: false });
  assert.deepEqual(SIMUI.onLattice(PTS, 55, 0.9, 0.85), { v: true, q: false, both: false });
  // a dataset with no shipped discipline cannot make q wrong
  assert.deepEqual(SIMUI.onLattice(PTS, 55, 0.42, null), { v: true, q: true, both: true });
  // a pre-v2 dataset ships no lattice at all
  assert.deepEqual(SIMUI.onLattice([], 55, 0.85, 0.85), { v: false, q: true, both: false });
});

// ---------------------------------------------------------------- badge copy from trials

test('badge copy is derived from the ACTUAL trial count, on the generator’s own SE basis', () => {
  const cases = [
    [25000, '25k', '0.32'],
    [100000, '100k', '0.16'],
    [400000, '400k', '0.08'],
    [500, '500', '2.24'],
  ];
  for (const [trials, k, se] of cases) {
    const b = SIMUI.badgeCopy({ badge: 'measured', trials });
    assert.equal(b.cls, 'meas');
    assert.equal(b.text, `measured (${k}) · simulated ±${se}`, `trials=${trials}`);
    // the same expression the generator writes into meta.se, so a simulated badge and a shipped one
    // are on one basis. V2-PLAN §4's "±0.35 pt at 25k" cannot come from it and is an arithmetic slip.
    assert.equal(SIMUI.seOf(trials), seOfTrials(trials));
  }
  assert.notEqual(SIMUI.seOf(25000).toFixed(2), '0.35');
});

test('a test hook that makes a run cheap cannot make the badge claim it was not', () => {
  const cheap = SIMUI.badgeCopy({ badge: 'measured', trials: 500 });
  assert.match(cheap.text, /\(500\)/);
  assert.match(cheap.text, /±2\.24/);
  assert.ok(!cheap.text.includes('25k'));
});

test('the 4x re-run link in the badge tooltip quotes the trial count it would actually run', () => {
  const b = SIMUI.badgeCopy({ badge: 'measured', trials: 25000 });
  assert.match(b.title, /re-run at 4× trials \(100,000\/cell, ±0\.16\)/i);
  /* AMENDED with the trials ceiling: at 100,000 the honest quote is that there is nothing above it.
     This test used to assert a 400,000 offer, which the engine now clamps to 100,000 anyway — the
     tooltip would have been quoting a run that could not happen. The ladder's own bound is asserted
     in "no compounding: there is no path to 400k" below. */
  const b4 = SIMUI.badgeCopy({ badge: 'measured', trials: 100000 });
  assert.ok(!/400,000/.test(b4.title), 'a run the engine would refuse must not be offered');
  assert.match(b4.title, /100,000 trials\/cell ceiling/);
});

test('the badge discloses a cache hit and the degraded path, and stays silent about them otherwise', () => {
  const plain = SIMUI.badgeCopy({ badge: 'measured', trials: 25000 });
  assert.ok(!/cache/i.test(plain.title));
  assert.ok(!/own thread/i.test(plain.title));
  const cached = SIMUI.badgeCopy({ badge: 'measured', trials: 25000, source: 'cache' });
  assert.match(cached.title, /cache/i);
  const slow = SIMUI.badgeCopy({ badge: 'measured', trials: 25000, degraded: true });
  assert.match(slow.title, /own thread/i);
});

test('badgeCopy prefers the engine’s own se when it is handed one, and agrees with it anyway', () => {
  const b = SIMUI.badgeCopy({ badge: 'measured', trials: 25000, se: seOfTrials(25000) });
  assert.equal(b.text, 'measured (25k) · simulated ±0.32');
});

test('no badge where the page shows shipped numbers; a labelled one everywhere else', () => {
  assert.equal(SIMUI.badgeCopy({ badge: 'none' }), null);
  assert.equal(SIMUI.badgeCopy({}), null);
  assert.equal(SIMUI.badgeCopy({ badge: 'interpolated' }).text, 'interpolated');
  assert.equal(SIMUI.badgeCopy({ badge: 'unsupported', q: 0.9, qDef: 0.85 }).text, 'no shipped answer');
  assert.match(SIMUI.badgeCopy({ badge: 'unsupported', q: 0.9, qDef: 0.85 }).title, /0\.85/);
});

// ---------------------------------------------------------------- the bar

const RUN = {
  phase: 'run', stage: 1, stages: 2, stageKey: 'cell', stageLabel: 'cell equity vs filtered villains',
  unit: 47, units: 123, trialsDone: 1175000, trialsTotal: 3075000, rate: 901195, etaSec: 2.9,
  se: 0.31622776601683794, trialsPerCell: 25000, degraded: false, paused: false,
};

test('the bar quotes the trials, the cell counter, the ± and the ETA off the progress event', () => {
  const c = SIMUI.progressCopy(RUN);
  assert.equal(c.head, 'Stage 1/2 — cell equity vs filtered villains');
  assert.match(c.line, /^Simulating 3,075,000 trials · cell 47\/123 · ±0\.32 pt · ~3s left/);
});

test('the ETA is shown only once the engine has MEASURED a rate — never as "0s left"', () => {
  const c = SIMUI.progressCopy({ ...RUN, etaSec: null, rate: 0 });
  assert.ok(!/left/.test(c.line), c.line);
  assert.match(c.line, /±0\.32 pt/);
});

test('a paused fallback stops the clock instead of counting down', () => {
  const c = SIMUI.progressCopy({ ...RUN, paused: true, degraded: true });
  assert.match(c.line, /paused — this tab is in the background/);
  assert.ok(!/s left/.test(c.line));
});

test('stage 2 says it was skipped when no cell is expanded, and says nothing when it runs', () => {
  assert.match(SIMUI.progressCopy({ ...RUN, stages: 1 }).line, /Stage 2 \(sub-bucket equity\) skipped/);
  assert.ok(!/skipped/.test(SIMUI.progressCopy(RUN).line));
  const s2 = SIMUI.progressCopy({ ...RUN, stage: 2, stages: 2, stageKey: 'sub', stageLabel: 'sub-bucket equity vs filtered villains', unit: 3, units: 4 });
  assert.equal(s2.head, 'Stage 2/2 — sub-bucket equity vs filtered villains');
  assert.match(s2.line, /bucket 3\/4/);
});

test('the degraded path is disclosed in the bar, with what it actually costs', () => {
  /* AMENDED: this asserted "2–4× slower", which the browser harness then measured through — 15.0 s
     against 1.27 s at 8,000/cell is 12×, and the ratio moves with the core count and with whatever
     else the page is doing. A bounded factor is a promise the page cannot keep, so what is pinned
     now is that the copy discloses the cost WITHOUT putting a ceiling on it. */
  const c = SIMUI.progressCopy({ ...RUN, degraded: true });
  assert.match(c.line, /much slower/);
  assert.match(c.line, /10× or more/);
  assert.match(c.line, /background/);
  assert.ok(!/\d+\s*[–—-]\s*\d+\s*×/.test(c.line), 'no bounded "N–M×" claim');
  assert.ok(!/up to\s*\d+\s*×/.test(c.line), 'no "up to N×" claim either');
  assert.ok(!/much slower/.test(SIMUI.progressCopy(RUN).line), 'and silent when not degraded');
});

test('a cache hit reports itself and asks for no bar', () => {
  const c = SIMUI.progressCopy({ ...RUN, phase: 'cache' });
  assert.equal(c.cached, true);
  assert.match(c.line, /no trials run/);
});

test('the one-off pool build is named rather than shown as stalled progress', () => {
  const c = SIMUI.progressCopy({ ...RUN, phase: 'prepare', stage: 0, unit: 0, units: 0 });
  assert.equal(c.head, 'Preparing');
  assert.match(c.line, /once per page/);
});

test('stage 0 with phase run is a legitimate event and must not throw or read as stage 0/2', () => {
  const c = SIMUI.progressCopy({ ...RUN, stage: 0, unit: 0, units: 0, etaSec: null });
  assert.equal(c.head, 'Stage 1/2 — cell equity vs filtered villains');
});

// ---------------------------------------------------------------- cancel-on-change

test('cancel-on-settings-change: a live run dies, and only a live run does', () => {
  assert.equal(SIMUI.cancelGuard({ running: false }, { changed: true, what: 'table VPIP' }).cancel, false);
  assert.equal(SIMUI.cancelGuard(null, { changed: true, what: 'rake' }).cancel, false);
  assert.equal(SIMUI.cancelGuard({ running: true }, { changed: false, what: 'rake' }).cancel, false);
  assert.equal(SIMUI.cancelGuard({ running: true }, null).cancel, false);
  const g = SIMUI.cancelGuard({ running: true }, { changed: true, what: 'table VPIP' });
  assert.equal(g.cancel, true);
  assert.equal(g.what, 'table VPIP');
  assert.match(g.reason, /table VPIP changed while a measurement was in flight/);
});

test('every setting the page can move cancels a run in flight — none is exempt', () => {
  for (const what of ['table VPIP', 'stack depth', 'rake', 'the rake cap', 'the straddle', 'position',
    'the node', 'the 3-bet mix', 'the limper count', 'the raiser seat', 'the villain profile',
    'villain discipline q']) {
    assert.equal(SIMUI.cancelGuard({ running: true }, { changed: true, what }).cancel, true, what);
  }
});

// ---------------------------------------------------------------- formatting helpers

test('trial counts are grouped, and only round thousands are abbreviated', () => {
  assert.equal(SIMUI.group(3075000), '3,075,000');
  assert.equal(SIMUI.kOf(25000), '25k');
  assert.equal(SIMUI.kOf(100000), '100k');
  assert.equal(SIMUI.kOf(500), '500');
  assert.equal(SIMUI.kOf(25500), '25,500');
});

// ---------------------------------------------------------------- the re-run ceiling

const MAX = 100000;
const R = (over) => SIMUI.rerunState({ trials: 25000, base: 25000, max: MAX, ...over });

test('the re-run is ONE step, and the step lands exactly on the ceiling', () => {
  const r = R({});
  assert.equal(r.can, true);
  assert.equal(r.next, MAX, '25k x 4 is the ceiling, not a waypoint on the way past it');
  assert.equal(r.atCeiling, false);
  assert.equal(r.stepped, false);
  assert.match(r.why, /25,000 -> 100,000/);
});

test('at the ceiling there is no re-run, and the reason says so with the number in it', () => {
  const r = R({ trials: MAX });
  assert.equal(r.can, false);
  assert.equal(r.next, null);
  assert.equal(r.atCeiling, true);
  assert.match(r.why, /100,000 trials\/cell ceiling/);
});

test('no compounding: there is no path to 400k', () => {
  /* The failure this exists to prevent — 25k -> 100k -> 400k -> 1.6M, each step minting a new
     settings hash, a new cache entry and a new book entry. Walk the ladder and check it stops. */
  let trials = 25000, steps = 0;
  for (;;) {
    const r = SIMUI.rerunState({ trials, base: 25000, max: MAX });
    if (!r.can) break;
    assert.ok(r.next <= MAX, `step ${steps} offered ${r.next}, above the ceiling`);
    assert.ok(r.next > trials, 'a step must go up');
    trials = r.next;
    steps++;
    assert.ok(steps < 10, 'the ladder does not terminate');
  }
  assert.equal(steps, 1, 'exactly one re-run is ever offered from the default');
  assert.equal(trials, MAX);
});

test('a result already stepped up is not offered another step, and says which state it is in', () => {
  /* Only reachable through the test hook (a base below the default), but the two states are
     genuinely different sentences and the copy must not confuse them: 8,000 trials is not "as
     precise as the shipped data", and a tooltip claiming so would be lying about the measurement. */
  const r = SIMUI.rerunState({ trials: 8000, base: 2000, max: MAX });
  assert.equal(r.can, false);
  assert.equal(r.stepped, true);
  assert.equal(r.atCeiling, false, '8,000 is not the ceiling and must not claim to be');
  assert.match(r.why, /already re-run once/);
});

test('a ladder started from a test hook is still bounded by the ceiling', () => {
  let trials = 500, steps = 0;
  for (;;) {
    const r = SIMUI.rerunState({ trials, base: 500, max: MAX });
    if (!r.can) break;
    trials = r.next; steps++;
    assert.ok(steps < 10, 'unbounded ladder from a hooked base');
  }
  assert.ok(trials <= MAX);
});

test('nothing measured yet means no re-run to offer', () => {
  const r = SIMUI.rerunState({ trials: 0, base: 25000, max: MAX });
  assert.equal(r.can, false);
  assert.equal(r.atCeiling, false);
  assert.match(r.why, /nothing measured yet/);
});

test('the badge tooltip states the ceiling explicitly, in all three states', () => {
  const base = { badge: 'measured', base: 25000, max: MAX, q: 0.85, qDef: 0.85, shippedTrials: 100000 };
  const offered = SIMUI.badgeCopy({ ...base, trials: 25000 });
  assert.match(offered.title, /re-run at 4× trials \(100,000\/cell/);
  assert.match(offered.title, /100,000 trials\/cell is the ceiling/);
  assert.equal(offered.rerun.can, true);

  const ceiling = SIMUI.badgeCopy({ ...base, trials: MAX });
  assert.match(ceiling.title, /100,000 trials\/cell ceiling/);
  assert.ok(!/Click to re-run/.test(ceiling.title), 'no re-run is offered at the ceiling');
  assert.equal(ceiling.rerun.atCeiling, true);

  const stepped = SIMUI.badgeCopy({ ...base, trials: 8000, base: 2000 });
  assert.match(stepped.title, /Already re-run once at 4×/);
  assert.match(stepped.title, /100,000 trials\/cell is the ceiling/);
  assert.ok(!/Click to re-run/.test(stepped.title));

  /* and the badge's own text still comes off the ACTUAL trial count, ceiling or not */
  assert.equal(ceiling.text, 'measured (100k) · simulated ±' + seOfTrials(MAX).toFixed(2));
});

// ---------------------------------------------------------------- the bounded book

const entry = (n, pad) => ({
  modelHash: 'm', nMax: 7, trialsPerCell: n,
  cells: { 'A|B': [1, 2, 3, 4, 5, 6, 7] },
  pad: pad ? 'x'.repeat(pad) : undefined,
});
const okShape = (r) => !!(r && r.modelHash === 'm' && r.nMax === 7 && r.cells);

test('the book stores, reads back, and counts', () => {
  const b = SIMUI.makeBook({ validate: okShape });
  assert.equal(b.put('55|0.85', entry(25000)), 'stored');
  assert.equal(b.size(), 1);
  assert.equal(b.has('55|0.85'), true);
  assert.equal(b.get('55|0.85').trialsPerCell, 25000);
  assert.equal(b.get('nope'), null);
  const s = b.stats();
  assert.ok(s.bytes > 0 && s.bytes < s.maxBytes);
  assert.equal(s.evicted, 0);
});

test('the book evicts LEAST RECENTLY USED when the entry bound is hit', () => {
  const b = SIMUI.makeBook({ validate: okShape, maxEntries: 3 });
  b.put('a', entry(1)); b.put('b', entry(2)); b.put('c', entry(3));
  assert.deepEqual(b.keys(), ['a', 'b', 'c']);
  /* touching 'a' by READING it must save it from the next eviction — a user who keeps coming back
     to one VPIP should not lose it to a walk along the slider */
  assert.ok(b.get('a'));
  b.put('d', entry(4));
  assert.equal(b.size(), 3);
  assert.deepEqual(b.keys(), ['b', 'c', 'a', 'd'].filter((k) => b.has(k)));
  assert.equal(b.has('b'), false, 'b was the least recently used');
  assert.equal(b.has('a'), true, 'a survived because it was read');
  assert.equal(b.stats().evicted, 1);
});

test('the book evicts on the BYTE bound too, not only the entry count', () => {
  const b = SIMUI.makeBook({ validate: okShape, maxBytes: 4000, maxEntries: 1000 });
  for (let i = 0; i < 20; i++) b.put('k' + i, entry(i, 900));
  const s = b.stats();
  assert.ok(s.bytes <= s.maxBytes, `${s.bytes} > ${s.maxBytes}`);
  assert.ok(s.entries < 20 && s.entries >= 1, `kept ${s.entries}`);
  assert.ok(s.evicted > 0);
  assert.equal(b.has('k19'), true, 'the newest entry survives');
  assert.equal(b.has('k0'), false, 'the oldest does not');
});

test('walking the whole reachable key space leaves the book bounded', () => {
  /* 66 VPIPs x 101 disciplines is 6,666 reachable keys; unbounded, that is tens of megabytes of
     results nobody is looking at. This is the leak the bound exists for. */
  const b = SIMUI.makeBook({ validate: okShape, maxBytes: 50000, maxEntries: 24 });
  for (let v = 25; v <= 90; v++) for (const q of [0.85, 0.5]) b.put(v + '|' + q, entry(25000, 500));
  const s = b.stats();
  assert.ok(s.entries <= 24, `${s.entries} entries`);
  assert.ok(s.bytes <= s.maxBytes);
  assert.ok(s.evicted >= 100);
});

test('the book validates on WRITE and on READ, and drops what fails', () => {
  const b = SIMUI.makeBook({ validate: okShape });
  assert.equal(b.put('bad', { modelHash: 'other', nMax: 7, cells: {} }), 'rejected');
  assert.equal(b.size(), 0);
  assert.equal(b.stats().rejected, 1);

  /* the read path matters because an entry can arrive from the shared localStorage cache and be
     mutated, or the model can change under a long-lived page */
  let good = true;
  const b2 = SIMUI.makeBook({ validate: () => good });
  b2.put('k', entry(25000));
  assert.ok(b2.get('k'));
  good = false;
  assert.equal(b2.get('k'), null, 'a now-invalid entry is not returned');
  assert.equal(b2.has('k'), false, 'and it is dropped, not left to be re-read');
});

test('an entry larger than the whole budget is refused, not allowed to empty the book', () => {
  const b = SIMUI.makeBook({ validate: okShape, maxBytes: 2000 });
  b.put('keep', entry(1));
  assert.equal(b.put('huge', entry(2, 5000)), 'too-big');
  assert.equal(b.has('keep'), true, 'the existing entry survived the refusal');
  assert.equal(b.has('huge'), false);
});

test('a re-put of the same key replaces rather than double-counting its bytes', () => {
  const b = SIMUI.makeBook({ validate: okShape, maxEntries: 4 });
  b.put('k', entry(1, 200));
  const first = b.stats().bytes;
  b.put('k', entry(2, 200));
  assert.equal(b.size(), 1);
  assert.equal(b.stats().bytes, first, 'bytes are replaced, not accumulated');
  assert.equal(b.get('k').trialsPerCell, 2);
});

// -------------------------------------------- F2: the cache branch owes the same disclosure

test('the cache branch states the stage-2 skip exactly as the running branch does', () => {
  /* The defect: a user pressing Simulate with no cell expanded got "no trials run" from the cache
     branch and never learned that stage 2 had not happened, while the identical situation on the
     running branch said so plainly. One sentence, one definition, both branches. */
  const one = { phase: 'cache', stages: 1 };
  const two = { phase: 'cache', stages: 2 };
  const cachedOne = SIMUI.progressCopy(one);
  const cachedTwo = SIMUI.progressCopy(two);
  assert.equal(cachedOne.cached, true);
  assert.match(cachedOne.line, /no trials run/);
  assert.match(cachedOne.line, /Stage 2 \(sub-bucket equity\) skipped/);
  assert.ok(!/Stage 2 \(sub-bucket equity\) skipped/.test(cachedTwo.line),
    'and not claimed when stage 2 was in scope');
  /* the two branches must use the SAME sentence, not two that drift apart */
  assert.equal(SIMUI.stage2Skip(one), SIMUI.stage2Skip({ ...RUN, stages: 1 }));
  assert.ok(SIMUI.progressCopy({ ...RUN, stages: 1 }).line.includes(SIMUI.stage2Skip(one)));
  assert.equal(SIMUI.stage2Skip(two), '');
});

test('a partial run says stage 1 came from the cache', () => {
  const c = SIMUI.progressCopy({ ...RUN, stage: 2, stages: 2, stageKey: 'sub', unit: 2, units: 4, cachedStage1: true });
  assert.match(c.line, /Stage 1 \(cell equity\) came straight from this browser’s cache/);
  assert.ok(!/Stage 1/.test(SIMUI.progressCopy({ ...RUN, stages: 2 }).line), 'silent on a full run');
});
