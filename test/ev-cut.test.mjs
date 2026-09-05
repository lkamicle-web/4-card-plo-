// The absolute-EV cut, under `node --test`: the badge, the primacy flag, the memo, the display
// scale, and the band's `k`.
//
// WHAT THIS IS FOR, AND WHAT IT IS NOT. Gate I34 owns the quarantine, I39 the arithmetic and I40 the
// behaviour, over the whole settings surface. These tests are the FINE-GRAINED half the gates cannot
// carry without doubling the verifier's wall: perturbations, near-misses, and the one thing §5.4
// asks for by name — "a unit test asserts the badge text derives from `source`/`se`, never
// hard-coded". They ARM the same code the gates run rather than re-implementing it, which is the
// discipline `test/payoff.test.mjs` set: a harness with its own copy of a detector proves only that
// the copy fires.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as P from '../scripts/lib/policy.mjs';
import { makePayoff } from '../scripts/lib/payoff.mjs';
import { evMixK, evDefaultKey, PREDICTION_EXCEPTIONS, PREDICTION_EXCEPTION_KEYS } from '../scripts/lib/ev-band.mjs';
import { stripLiterals } from '../scripts/gates/skill.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
P.hydrate(MODEL);
const PAY = makePayoff(MODEL);
const ST = { pos: 'BTN', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO' };

/**
 * A fabricated model, on I38(a)'s distinct-hash idiom — and `tag` is not decoration.
 *
 * Both memos read `meta.hash.slice(0, 8)`, so two twins built with the SAME fabricated hash share a
 * memo entry and the second is handed the first's answer. This helper originally used one constant
 * hash for every twin and the "no stamped k" test below caught it immediately: a twin with the
 * `evCut` block removed was handed the base twin's cached layer and reported a `mixK` of 2.453 for a
 * model that carries none. The tag is what makes each fabrication its own model.
 */
const twin = (tag, over) => {
  const t = { ...MODEL, meta: { ...MODEL.meta, hash: P.fnv1a(`unit-twin-${tag}`).repeat(8) }, ...over };
  Object.defineProperty(t, '__hydrated', { value: true });
  return t;
};

// ---------------------------------------------------------------------------
// the badge — §5.4's named unit test
// ---------------------------------------------------------------------------

test('the EV badge is derived from source, se and supported — every one of the three', () => {
  const base = { source: 'checkdown', se: 0.00158, supported: false };
  const b = P.evBadge(base);
  assert.equal(typeof b, 'string');
  assert.notEqual(b, '');
  // perturb each input in turn; the string must move for all three
  assert.notEqual(P.evBadge({ ...base, source: 'simulated' }), b, 'source is not read');
  assert.notEqual(P.evBadge({ ...base, se: 0.5 }), b, 'se is not read');
  assert.notEqual(P.evBadge({ ...base, supported: true }), b, 'supported is not read');
  // an unmeasured number must not look like a measured one
  assert.notEqual(P.evBadge({ ...base, se: Infinity }), P.evBadge({ ...base, se: 0.5 }));
  // and it leads with the page's own word, not a second quieter one for the same thing
  assert.ok(P.evBadge(base).startsWith('unsupported'));
  assert.ok(P.evBadge({ ...base, supported: true }).startsWith('checkdown'));
  // a return with nothing in it still gets a badge rather than throwing or claiming support
  assert.ok(P.evBadge(undefined).startsWith('unsupported'));
  assert.ok(P.evBadge({}).startsWith('unsupported'));
});

test('no badge string is spelled anywhere but in evBadge', () => {
  // The `skill.mjs` scan idiom: comments AND string literals out, then look for the words. What is
  // left after `stripLiterals` is CODE, so a second place assembling badge text from pieces would
  // show up as an identifier and a lone declaration would not.
  const src = readFileSync(resolve(ROOT, 'scripts/lib/policy.mjs'), 'utf8');
  const fn = src.slice(src.indexOf('export function evBadge'), src.indexOf('export function evStake'));
  assert.ok(/unsupported/.test(fn), 'evBadge does not spell the word it is supposed to own');
  // outside that function, the only mention of the vocabulary may be in comments or in the layer's
  // one call to `evBadge` — never a second literal.
  const rest = stripLiterals(src.replace(fn, ''));
  assert.equal(/unsupported/.test(rest), false, 'a badge string is spelled outside evBadge');
});

test('the layer badges every cell with evBadge’s own answer', () => {
  const cut = P.evCut(MODEL, ST, PAY);
  const keys = Object.keys(cut.cells);
  assert.ok(keys.length > 100);
  for (const k of keys) assert.equal(cut.cells[k].badge, P.evBadge(cut.cells[k]));
});

// ---------------------------------------------------------------------------
// evPrimary — the flag P5 alone may flip
// ---------------------------------------------------------------------------

test('evPrimary is false on the shipped model and on every near-miss verdict', () => {
  assert.equal(P.evPrimary(MODEL), false);
  /* SINCE P5 THE SHIPPED MODEL DOES CARRY A CALIBRATION BLOCK, and the assertion is stronger for it.
     This line used to read `assert.equal(MODEL.calibration, undefined)` — a true statement about a
     model that had no verdict, and a statement V3-PLAN §3.5 then required to stop being true: the
     verdict ships as data and renders in the Method view whatever it is. So the flag now fails on
     VALUE rather than on absence, which is the case that was never exercised before. */
  assert.ok(MODEL.calibration, 'the shipped model carries no calibration block (verify stampCalibration)');
  assert.equal(MODEL.calibration.verdict, 'fail',
    'the shipped verdict is not FAIL — EV primacy is a §5.1 re-freeze ceremony, not a stamp');
  assert.equal(MODEL.calibration.criteriaDigest, '58a70f0cb95a44ed', 'the pre-registered bar moved');
  for (const v of ['fail', 'FAIL', 'Pass', 'passed', 'pass ', ' pass', '', 0, 1, true, null, undefined, {}]) {
    assert.equal(P.evPrimary({ calibration: { verdict: v } }), false, `accepted ${JSON.stringify(v)}`);
  }
  for (const m of [null, undefined, {}, { calibration: null }, { calibration: 'pass' }]) {
    assert.equal(P.evPrimary(m), false);
  }
  assert.equal(P.evPrimary({ calibration: { verdict: 'pass' } }), true, 'the flag reads nothing at all');
});

test('the EV-primary path exists, requires a payoff, and cuts different tiers', () => {
  const t = twin('primary', { calibration: { verdict: 'pass' } });
  assert.notEqual(t.meta.hash.slice(0, 8), MODEL.meta.hash.slice(0, 8), 'the twin shares a memo prefix');
  assert.equal(P.evPrimary(t), true);
  // never silently score: a tier cut on EV with no EV to cut on must throw
  assert.throws(() => P.solve(t, ST), /state\.payoff is missing/);
  const cut = P.solve(t, { ...ST, payoff: makePayoff(t) });
  const base = P.solve(MODEL, ST);
  const differs = Object.keys(base.cells).some((k) => base.cells[k].tier !== cut.cells[k].tier);
  assert.ok(differs, 'the EV-primary path reproduces the score path — the branch is not real');
  // and the shipped model is untouched by having been interleaved with it
  assert.equal(P.solve(MODEL, ST), base);
});

// ---------------------------------------------------------------------------
// the layer
// ---------------------------------------------------------------------------

test('evCut consumes the memoised solve and never writes into it', () => {
  const solved = P.solve(MODEL, ST);
  const before = JSON.stringify(solved.cells);
  const cut = P.evCut(MODEL, ST, PAY);
  assert.equal(cut.solved, solved, 'evCut did not consume the memoised solve object');
  for (const k of Object.keys(solved.cells)) assert.equal(cut.solved.cells[k], solved.cells[k]);
  assert.equal(JSON.stringify(solved.cells), before, 'the EV layer mutated the memoised solve');
  // the layer is its own map, not an annotation on the tier objects
  const k0 = Object.keys(cut.cells)[0];
  assert.notEqual(cut.cells[k0], solved.cells[k0]);
  assert.equal(solved.cells[k0].evBB, undefined, 'the EV number was written onto a tier object');
});

test('the EV memo separates ip, the model and the payoff binding', () => {
  const a = P.evCut(MODEL, { ...ST, ip: false }, PAY);
  const b = P.evCut(MODEL, { ...ST, ip: true }, PAY);
  assert.notEqual(a, b, 'ip is not in the EV memo key');
  const t = twin('memo', {});
  assert.notEqual(P.evCut(MODEL, ST, PAY), P.evCut(t, ST, makePayoff(t)), 'the model is not in the key');
  assert.notEqual(P.evCut(MODEL, ST, PAY), P.evCut(MODEL, ST, makePayoff(t)), 'the payoff binding is not in the key');
  // the memo IS a memo: the same request twice is the same object
  assert.equal(P.evCut(MODEL, ST, PAY), P.evCut(MODEL, ST, PAY));
  P.clearSolveMemo();
  assert.notEqual(P.evCut(MODEL, ST, PAY), a, 'clearSolveMemo does not clear the EV memo');
});

test('EV(fold) is zero: a hand that never wins loses exactly its stake', () => {
  const probe = (ev) => {
    const f = () => ({ ev, se: 1e-3, source: 'checkdown', supported: false, potMult: 1, invShare: 0 });
    f.modelHash = `unit-fold-${ev}`; f.route = 'projection'; return f;
  };
  for (const rakePct of [0, 5]) {
    const st = { ...ST, rakePct };
    const lose = P.evCut(MODEL, st, probe(0));
    const win = P.evCut(MODEL, st, probe(1));
    for (const k of Object.keys(lose.cells)) {
      assert.ok(Object.is(lose.cells[k].evBB, -lose.stake), 'a zero-equity hand loses more than its stake');
      assert.equal(lose.cells[k].keep, false);
      assert.ok(Object.is(win.cells[k].evBB, lose.rho * lose.potSize - lose.stake));
      assert.equal(win.cells[k].keep, true);
    }
  }
});

test('the vs-3-bet sign IS the breakeven comparison, across rake and sizing', () => {
  const se = (() => {
    let w = 0; for (const m of P.CONSTANTS.vs3bet.mix) w += m * m;
    return P.seOfTrials(MODEL.meta.trials.vs3bet) * Math.sqrt(w) / 100;
  })();
  for (const rakePct of [0, 5]) {
    for (const sizing of [P.CONSTANTS.sizing.min, 1, P.CONSTANTS.sizing.max]) {
      const st = { pos: 'BTN', node: '3bet', v: 0.55, limpers: 2, raiserPos: 'CO', rakePct, sizing };
      const cut = P.evCut(MODEL, st, PAY);
      const be = P.breakevenPrice(cut.solved.env);
      for (const k of Object.keys(cut.cells)) {
        const e = cut.cells[k];
        assert.ok(Object.is(e.se, se), 'the blend does not carry its own error');
        if (Math.abs(e.ev - be) > e.se) assert.equal(e.evBB >= 0, e.ev >= be, `${k} at rake ${rakePct} sizing ${sizing}`);
      }
    }
  }
});

test('stake is a display scale: doubling it moves no decision and no k', () => {
  const t = twin('scale', { constants: { ...MODEL.constants, solver: { ...MODEL.constants.solver, sizingLadder: '6 / 18 / 54 / 162' } } });
  assert.equal(P.evStake(t, undefined), 2 * P.evStake(MODEL, undefined));
  const a = P.evCut(MODEL, ST, PAY), b = P.evCut(t, ST, PAY);
  assert.ok(Object.is(a.width, b.width));
  assert.ok(Object.is(a.keepWidth, b.keepWidth));
  assert.ok(Object.is(a.mixWidth, b.mixWidth));
  for (const k of Object.keys(a.cells)) {
    assert.equal(a.cells[k].keep, b.cells[k].keep, k);
    assert.equal(a.cells[k].mix, b.cells[k].mix, k);
    // ...and evBB itself scales exactly, which is what "display scale" MEANS
    assert.ok(Object.is(b.cells[k].evBB, 2 * a.cells[k].evBB), k);
  }
  assert.ok(Object.is(evMixK(MODEL, PAY).mixK, evMixK(t, PAY).mixK));
});

test('the stake is derived from the ladder and refuses to be invented', () => {
  assert.equal(P.evStake(MODEL, undefined), parseFloat(MODEL.constants.solver.sizingLadder));
  assert.equal(P.evStake(MODEL, { straddle: true }), 2 * P.evStake(MODEL, undefined));
  for (const bad of [undefined, null, '', 'pot', {}, 0, '0 / 0']) {
    const t = twin(`ladder-${JSON.stringify(bad)}`, { constants: { ...MODEL.constants, solver: { ...MODEL.constants.solver, sizingLadder: bad } } });
    assert.throws(() => P.evStake(t, undefined), /sizingLadder/, `accepted ${JSON.stringify(bad)}`);
  }
});

// ---------------------------------------------------------------------------
// the band
// ---------------------------------------------------------------------------

test('k is stamped, re-derivable bit for bit, and read by the runtime layer', () => {
  const shipped = MODEL.constants.evCut;
  assert.ok(shipped, 'constants.evCut is not stamped');
  const fresh = evMixK(MODEL, PAY);
  for (const f of ['mixK', 't4Mass', 'evMassAtK', 'evMassNextStep']) assert.ok(Object.is(shipped[f], fresh[f]), f);
  assert.equal(shipped.kind, 'derived');
  assert.equal(shipped.derivedAt.state, evDefaultKey(MODEL));
  assert.ok(Object.is(P.evMixKOf(MODEL), shipped.mixK));
  assert.ok(Object.is(P.evCut(MODEL, ST, PAY).mixK, shipped.mixK));
  // the rounding is stated, and the number IS that rounding
  assert.ok(Object.is(shipped.mixK, Math.round(shipped.mixK * 1e4) / 1e4));
  // the target mass is bracketed by the two achievable bands — a step function admits nothing else
  assert.ok(shipped.evMassAtK <= shipped.t4Mass);
  assert.ok(shipped.t4Mass <= shipped.evMassNextStep);
  assert.ok(shipped.t4Mass > 0, 't4 carries no mass, so k is solved against nothing');
});

/* THE UNIT, ADDED AT P4's RED-TEAM STAGE (docs/refutations/P4.md). `seUnit` was the one row of the
   EV block no refuter could falsify: `sePt: 0.9` and `seBBMean: 0.5`, typed in place of their
   derivations, shipped 60/60 gates, 632 tests and 2/2 variants current. This test is one of the two
   halves of the answer (I40(d) is the other), and it is the half that reads the model OFF DISK
   without stamping — which is what catches a hand-edited block, since `verify.mjs`'s CLI restamps
   `constants.evCut` before the gates ever see it. The assertions are identities with shipped data,
   not a second copy of the derivation: no anchor is invented, the block's own claim ("derived from
   the shipped trial count; never typed") is simply made falsifiable. */
test('the band\'s unit is the payload\'s own, and it is asserted against the payload', () => {
  const shipped = MODEL.constants.evCut.seUnit;
  assert.equal(shipped.trials, MODEL.meta.trials.cell, 'the published trial count is not the one that ran');
  assert.ok(Object.is(shipped.sePt, P.seOfTrials(MODEL.meta.trials.cell)), 'sePt was typed rather than derived');
  assert.ok(Object.is(shipped.sePt, 50 / Math.sqrt(MODEL.meta.trials.cell)),
    'the point-scale se is the binomial se at p = 0.5, in percentage points — spike S-B\'s 0.1581');
  // seBBMean is a measurement of the shipped distribution: walked here independently of ev-band.mjs
  const pool = P.poolAt(MODEL, P.villainLoadDefault(MODEL));
  let seSum = 0, seN = 0;
  for (const node of P.NODES) {
    for (const pos of P.POSITIONS) {
      if (P.positionDisabled(pos, node)) continue;
      const layer = P.evCut(pool.model, { pos, node, v: pool.v, limpers: 2, raiserPos: 'CO' }, PAY);
      for (const it of P.cellList(pool.model)) {
        const se = layer.cells[it.key].seBB;
        if (isFinite(se)) { seSum += se * it.combos; seN += it.combos; }
      }
    }
  }
  assert.ok(Object.is(shipped.seBBMean, seSum / seN), 'seBBMean is not the distribution\'s own mean');
  // ARMED: a typed unit must be distinguishable from the derived one
  assert.notEqual(P.seOfTrials(MODEL.meta.trials.cell), P.seOfTrials(MODEL.meta.trials.vs3bet),
    'the two shipped trial counts give the same se, so sourcing sePt from the wrong one is undetectable');
});

test('a model with no stamped k draws no band rather than inventing one', () => {
  const t = twin('no-k', { constants: { ...MODEL.constants, evCut: undefined } });
  assert.equal(P.evMixKOf(t), null);
  const cut = P.evCut(t, ST, PAY);
  assert.equal(cut.mixK, null);
  for (const k of Object.keys(cut.cells)) assert.equal(cut.cells[k].mix, false);
  assert.equal(cut.mixWidth, 0);
});

test('the prediction record is a set, not a list, and every entry names a real seat', () => {
  assert.equal(PREDICTION_EXCEPTIONS.length, PREDICTION_EXCEPTION_KEYS.size, 'the record has duplicates');
  const seats = new Set();
  for (const node of P.NODES) for (const pos of P.POSITIONS) if (!P.positionDisabled(pos, node)) seats.add(`${pos}|${node}`);
  for (const [seat, vp, shallow, deep] of PREDICTION_EXCEPTIONS) {
    assert.ok(seats.has(seat), `${seat} is not a legal seat`);
    assert.notEqual(seat.split('|')[1], '3bet', 'the prediction is about the percentile nodes');
    assert.ok([25, 40, 55, 70, 90].includes(vp), `${vp} is not on the gate's VPIP grid`);
    assert.ok(shallow > deep, `${seat}@${vp} is recorded as an inversion but the widths do not invert`);
  }
});
