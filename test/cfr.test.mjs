// test/cfr.test.mjs — the solver engine (scripts/lib/cfr.mjs, V3-PLAN §3.2, gate I35).
//
// The division of labour with the gate, so neither is a copy of the other:
//
//   scripts/gates/solver.mjs   asserts the SHIPPED claims on the SHIPPED model, every verify run.
//   here                       asserts the ENGINE's properties, including several that the shipped
//                              model cannot exercise because it is one particular model — the
//                              analytic ground truth, a fabricated position-aware source, a
//                              narrowed abstraction — plus the arithmetic identities the tree rests
//                              on, checked independently of the code that builds it.
//
// I33 clause (e) explicitly puts test/ out of its scan ("a future test/cfr.test.mjs has every right
// to fabricate a payoff table"), which is what lets this file build sources the product may not.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as CFR from '../scripts/lib/cfr.mjs';
import { makePayoff } from '../scripts/lib/payoff.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
const PAYOFF = makePayoff(MODEL);
const LIVE = CFR.liveCells(PAYOFF, MODEL);

// ---------------------------------------------------------------------------
// the tree — arithmetic, checked against an independent derivation
// ---------------------------------------------------------------------------

test('the pot-limit ladder is 3/9/27/81 and it is DERIVED, not typed', () => {
  assert.deepEqual(CFR.potLimitLadder(100).map((r) => r.to), [3, 9, 27, 81]);
  // the independent derivation: each rung is the previous bet plus (pot + call). Written as a
  // separate loop so this is a second opinion rather than the same code twice.
  let pot = 1.5, bet = 1, mine = 0.5;
  const want = [];
  for (let n = 0; n < 4; n++) {
    const to = bet + (pot + (bet - mine));
    want.push(to);
    pot = to + bet; mine = bet; bet = to;
  }
  assert.deepEqual(want, [3, 9, 27, 81]);
  // and it is a geometric identity: each rung is exactly 3x the last
  for (let i = 1; i < want.length; i++) assert.equal(want[i], want[i - 1] * 3);
});

test('the ladder is capped by the effective stack, and that is the ONLY difference between T40 and T100', () => {
  const a = CFR.buildTree(100), b = CFR.buildTree(40);
  assert.deepEqual([...a.sizings], [3, 9, 27, 81]);
  assert.deepEqual([...b.sizings], [3, 9, 27, 40]);
  assert.equal(a.capAllIn, false);
  assert.equal(b.capAllIn, true, 'at 40bb the 4-bet to 27 leaves 13 behind, so the cap IS an all-in');
  // exactly one rung differs
  const diff = a.sizings.filter((v, i) => v !== b.sizings[i]);
  assert.equal(diff.length, 1);
  // ...and therefore exactly one terminal pot differs
  const pots = (t) => t.nodes.filter((n) => n.callPot).map((n) => n.callPot);
  assert.deepEqual(pots(a), [6, 18, 54, 162]);
  assert.deepEqual(pots(b), [6, 18, 54, 80]);
});

test("S-A's structural counts fall out of the tree rather than being asserted into it", () => {
  const t = CFR.buildTree(100);
  assert.equal(t.nodes.length, 5);
  assert.equal(t.terminals, 9);
  assert.equal(t.slotsPerCell, 13);
  const sb = t.nodes.filter((n) => n.actor === 'SB');
  const bb = t.nodes.filter((n) => n.actor === 'BB');
  assert.equal(sb.reduce((s, n) => s + n.actions.length, 0), 7);
  assert.equal(bb.reduce((s, n) => s + n.actions.length, 0), 6);
  assert.equal(LIVE.length * t.nodes.length, 615);
  assert.equal(LIVE.length * t.slotsPerCell, 1599);
  assert.equal(LIVE.length * 7, 861);
  assert.equal(LIVE.length * 6, 738);
});

test('n1 has no call and n5 has no raise — the two caps are structural, not merely declared', () => {
  const t = CFR.buildTree(100);
  assert.ok(!t.nodes[0].actions.includes('call'), 'an SB call at n1 would be a limp');
  assert.ok(!t.nodes[4].actions.includes('raise'), 'a raise at n5 would be a sixth raise');
  assert.ok(CFR.CAPS.omitted.some((c) => /limp/i.test(c)));
  assert.ok(CFR.CAPS.omitted.some((c) => /sixth raise/i.test(c)));
});

test('the fold terminals are the actor\'s own commitment, read off the ladder', () => {
  const t = CFR.buildTree(100);
  assert.deepEqual(t.nodes.map((n) => n.foldNetSB), [-0.5, 1, -3, 9, -27]);
});

test('spr at each showdown is the stack left over the pot being contested', () => {
  const t = CFR.buildTree(100);
  const shown = t.nodes.filter((n) => n.callPot);
  assert.deepEqual(shown.map((n) => n.callSpr), [(100 - 3) / 6, (100 - 9) / 18, (100 - 27) / 54, (100 - 81) / 162]);
  // at T40's cap both players are all in, so spr is exactly 0 — and the accessor accepts 0
  const t40 = CFR.buildTree(40);
  assert.equal(t40.nodes[4].callSpr, 0);
  assert.equal(PAYOFF([LIVE[0], LIVE[1]], 80, 0, { ip: true }).supported, true);
});

test('a stack at or below the big blind is not a game and throws rather than solving one', () => {
  assert.throws(() => CFR.potLimitLadder(1), TypeError);
  assert.throws(() => CFR.potLimitLadder(NaN), TypeError);
});

// ---------------------------------------------------------------------------
// the payoff bridge
// ---------------------------------------------------------------------------

test('liveness is asked of the accessor and agrees with the model, 123 cells', () => {
  assert.equal(LIVE.length, 123);
  const byLadder = Object.keys(MODEL.cells)
    .filter((k) => Array.isArray(MODEL.cells[k].eq) && MODEL.cells[k].eq.length > 0).sort();
  assert.deepEqual(LIVE, byLadder);
  // the cells the accessor excludes carry no combos, so the chance measure stays complete
  const dead = Object.keys(MODEL.cells).filter((k) => !LIVE.includes(k));
  assert.equal(dead.reduce((s, k) => s + (MODEL.cells[k].combos || 0), 0), 0);
});

test('the chance measure is the C(52,4) deal space, normalised', () => {
  const { q, total } = CFR.chanceMeasure(MODEL, LIVE);
  assert.equal(total, 270725);
  assert.ok(Math.abs(q.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok([...q].every((x) => x > 0));
});

test('a cell with no combos is refused rather than silently weighted zero', () => {
  const broken = { ...MODEL, cells: { ...MODEL.cells, [LIVE[0]]: { ...MODEL.cells[LIVE[0]], combos: 0 } } };
  assert.throws(() => CFR.chanceMeasure(broken, LIVE), TypeError);
});

test('the payoff arithmetic uses all six keys — a moved potMult or invShare moves the terminal', () => {
  // the collapsed checkdown form and the general form agree ONLY because potMult/invShare are 1/0;
  // this proves the general form is what runs, by moving them.
  const base = { ev: 0.6, se: 0.001, source: 'model', supported: true, potMult: 1, invShare: 0 };
  const moved = { ...base, potMult: 2, invShare: 0.25 };
  const src = (r) => { const f = () => r; f.modelHash = 'x'; return f; };
  CFR.clearMatrixCache();
  const a = CFR.terminalMatrix(src(base), [LIVE[0], LIVE[1]], { potSize: 100, spr: 1, heroPre: 50, seed: 0, modelHash: 'a' });
  CFR.clearMatrixCache();
  const b = CFR.terminalMatrix(src(moved), [LIVE[0], LIVE[1]], { potSize: 100, spr: 1, heroPre: 50, seed: 0, modelHash: 'b' });
  // checkdown: 0.6*100 - 50 = 10
  assert.equal(a.net[0], 10);
  // moved: finalPot 200, invested 50 + 0.25*200 = 100, so 0.6*200 - 100 = 20
  assert.equal(b.net[0], 20);
  CFR.clearMatrixCache();
});

test('the memo key carries ip and the model hash — two models cannot alias', () => {
  CFR.clearMatrixCache();
  let ev = 0.6;
  // ONE function object, so the source token is constant and the model hash is what varies.
  const src = () => ({ ev, se: 0.001, source: 'model', supported: true, potMult: 1, invShare: 0 });
  const args = { potSize: 10, spr: 1, heroPre: 5, seed: 0 };
  const a = CFR.terminalMatrix(src, [LIVE[0], LIVE[1]], { ...args, modelHash: 'HASH-A' });
  ev = 0.9;
  const b = CFR.terminalMatrix(src, [LIVE[0], LIVE[1]], { ...args, modelHash: 'HASH-B' });
  assert.notEqual(a.net[0], b.net[0], 'a differing model hash must not hit the same cache entry');
  ev = 0.1;
  const again = CFR.terminalMatrix(src, [LIVE[0], LIVE[1]], { ...args, modelHash: 'HASH-A' });
  assert.equal(again.net[0], a.net[0], 'the same key must hit rather than recompute');
  // ...and `ip` is in the key by construction: the matrix is built at ip:true and the mirror
  // reading at ip:false, so a key without it would hand one position the other's matrix.
  CFR.clearMatrixCache();
});

test('two different sources carrying the SAME model hash cannot alias in the cache', () => {
  // The trap the memo rule as written does not cover: a gate fabricating a model by spreading the
  // real one keeps the real `meta.hash`, so `modelHash` alone would key two different payoffs
  // identically. This is the `envKey` docstring's trap arriving through the door the rule left open.
  CFR.clearMatrixCache();
  const mk = (ev) => {
    const f = () => ({ ev, se: 0.001, source: 'model', supported: true, potMult: 1, invShare: 0 });
    f.modelHash = 'IDENTICAL-HASH';
    return f;
  };
  const args = { potSize: 10, spr: 1, heroPre: 5, seed: 0, modelHash: 'IDENTICAL-HASH' };
  const a = CFR.terminalMatrix(mk(0.6), [LIVE[0], LIVE[1]], args);
  const b = CFR.terminalMatrix(mk(0.9), [LIVE[0], LIVE[1]], args);
  assert.equal(a.net[0], 1);   // 0.6*10 - 5
  assert.equal(b.net[0], 4);   // 0.9*10 - 5
  assert.notEqual(a.net[0], b.net[0], 'distinct payoff functions must never share a cache entry');
  CFR.clearMatrixCache();
});

test('a narrowed cell list does not collide with a wider one', () => {
  CFR.clearMatrixCache();
  const f = (cells, pot, spr, opts) => PAYOFF(cells, pot, spr, opts);
  f.modelHash = 'H';
  const args = { potSize: 10, spr: 1, heroPre: 5, seed: 0, modelHash: 'H' };
  const wide = CFR.terminalMatrix(f, LIVE.slice(0, 6), args);
  const narrow = CFR.terminalMatrix(f, LIVE.slice(0, 3), args);
  assert.equal(wide.K, 6);
  assert.equal(narrow.K, 3);
  // a different subset of the SAME size must also not collide
  const other = CFR.terminalMatrix(f, LIVE.slice(3, 6), args);
  assert.notEqual(other.net[1], narrow.net[1]);
  CFR.clearMatrixCache();
});

test('the mirror residual measures NON-CONSERVATION, not position-dependence', () => {
  // The distinction matters and is easy to get backwards. The residual is
  // |ev(A,B,ip) + ev(B,A,!ip) - 1| in bb — I33(b)'s conservation identity read through the pot. A
  // source can be strongly position-aware and still conserve; such a source is legitimate and the
  // solver's mirroring costs nothing on it. What the residual is for is a source whose two
  // orderings do NOT add up, because the solver takes the SB-hero reading and mirrors it, so any
  // shortfall is being silently absorbed into the fixed point.
  CFR.clearMatrixCache();
  const r = CFR.solveHU({ model: MODEL, stack: 100, iters: 8, seed: 0, payoff: PAYOFF });
  assert.ok(r.mirrorMax <= CFR.mirrorBound(162),
    `checkdown mirror residual ${r.mirrorMax} is an ulp story, not an asymmetry`);

  // ANTISYMMETRIC: the in-position player gains exactly what the out-of-position one loses. Position
  // matters enormously here and conservation still holds exactly, so the residual must stay quiet.
  const conserving = (cells, pot, spr, opts) => {
    const base = PAYOFF(cells, pot, spr, opts);
    return { ...base, ev: base.ev + (opts && opts.ip ? 0.05 : -0.05) };
  };
  conserving.modelHash = 'conserving';
  CFR.clearMatrixCache();
  const c = CFR.solveHU({ model: MODEL, stack: 100, iters: 8, seed: 0, payoff: conserving });
  assert.ok(c.mirrorMax <= CFR.mirrorBound(162),
    `a conserving position-aware source must not trip the residual, got ${c.mirrorMax}`);

  // NON-CONSERVING: both orderings gain. The pot no longer adds up and the residual says so.
  const leaky = (cells, pot, spr, opts) => {
    const base = PAYOFF(cells, pot, spr, opts);
    return { ...base, ev: Math.min(1, base.ev + 0.05) };
  };
  leaky.modelHash = 'leaky';
  CFR.clearMatrixCache();
  const t = CFR.solveHU({ model: MODEL, stack: 100, iters: 8, seed: 0, payoff: leaky });
  assert.ok(t.mirrorMax > CFR.mirrorBound(162) * 1000,
    `a non-conserving source must show a real mirror residual, got ${t.mirrorMax}`);
  CFR.clearMatrixCache();
});

// ---------------------------------------------------------------------------
// CFR+ correctness
// ---------------------------------------------------------------------------

test('the analytic ground truth: with every showdown a coin flip, the value is 0 and SB always opens', () => {
  // S-A's own control. With E identically 0.5 the game is blind economics: SB opening 3 to win 1.5
  // is free money against a BB that can never be behind, so the Nash profile is "SB opens 100%,
  // BB never folds" and the value is exactly 0.
  // `supported` is delegated to the real accessor so the abstraction stays the shipped 123 cells;
  // only the SHOWDOWN is replaced. A fixture that claimed every cell was supported would widen the
  // abstraction to cells carrying no combos, and `chanceMeasure` refuses that — correctly.
  const flat = (cells, pot, spr, opts) => ({
    ...PAYOFF(cells, pot, spr, opts), ev: 0.5, source: 'model', potMult: 1, invShare: 0,
  });
  flat.modelHash = 'flat';
  CFR.clearMatrixCache();
  const r = CFR.solveHU({ model: MODEL, stack: 100, iters: CFR.ITER_CAP, seed: 0, payoff: flat });
  assert.ok(Math.abs(r.value) < 1e-5, `value ${r.value} should be ~0`);
  assert.ok(r.eps < 1e-4, `exploitability ${r.eps}`);
  assert.ok(r.frequencies.sbOpen > 0.9999, `SB should open ~100%, got ${r.frequencies.sbOpen}`);
  assert.ok(r.frequencies.bbFoldVsOpen < 1e-5, `BB should never fold, got ${r.frequencies.bbFoldVsOpen}`);
  CFR.clearMatrixCache();
});

test('exploitability falls monotonically and reaches epsilon inside the cap, both depths', () => {
  for (const stack of [100, 40]) {
    const seen = [];
    for (const it of [13, 40, 200, 1000, CFR.ITER_CAP]) {
      seen.push(CFR.solveHU({ model: MODEL, stack, iters: it, seed: 0, payoff: PAYOFF }).eps);
    }
    for (let i = 1; i < seen.length; i++) {
      assert.ok(seen[i] < seen[i - 1], `T${stack}: exploitability rose from ${seen[i - 1]} to ${seen[i]}`);
    }
    assert.ok(seen[seen.length - 1] <= CFR.EPSILON_BB,
      `T${stack}: ${seen[seen.length - 1]} did not reach epsilon ${CFR.EPSILON_BB}`);
    // and the clause can fail: 13 iterations is nowhere near
    assert.ok(seen[0] > CFR.EPSILON_BB);
  }
});

test('the best-response bracket BR_SB >= v >= -BR_BB holds', () => {
  for (const stack of [100, 40]) {
    const r = CFR.solveHU({ model: MODEL, stack, iters: 512, seed: 0, payoff: PAYOFF });
    assert.ok(r.bracketOk, `T${stack}: ${r.brSB} / ${r.value} / ${-r.brBB}`);
    assert.ok(r.eps >= 0, 'exploitability cannot be negative');
  }
});

test('every infoset is a probability distribution, to the accumulation bound', () => {
  const r = CFR.solveHU({ model: MODEL, stack: 100, iters: 256, seed: 7, payoff: PAYOFF });
  assert.ok(r.simplexError <= CFR.simplexBound(3), `simplex error ${r.simplexError}`);
  for (const [name, N] of [['n1', 2], ['n2', 3], ['n3', 3], ['n4', 3], ['n5', 2]]) {
    const S = r.avg[name];
    assert.equal(S.length, LIVE.length * N);
    for (let i = 0; i < S.length; i++) assert.ok(S[i] >= 0 && S[i] <= 1, `${name}[${i}] = ${S[i]}`);
  }
});

test('simplexError reports Infinity when a probability leaves [0,1] — a bare sum check would not', () => {
  const K = 2;
  const avg = { n1: Float64Array.from([2, -1, 0.5, 0.5]), n2: new Float64Array(K * 3).fill(1 / 3),
                n3: new Float64Array(K * 3).fill(1 / 3), n4: new Float64Array(K * 3).fill(1 / 3),
                n5: new Float64Array(K * 2).fill(0.5) };
  assert.equal(CFR.simplexError(avg, K), Infinity, 'the pair sums to 1 but is not a distribution');
});

test('two init seeds reach the same value, well inside the two-seed tolerance', () => {
  const tol = CFR.TWO_SEED_TOL_POT * CFR.PREFLOP_POT_BB;
  for (const stack of [100, 40]) {
    const vs = [0, 1, 99991].map((seed) => CFR.solveHU({ model: MODEL, stack, iters: CFR.ITER_CAP, seed, payoff: PAYOFF }).value);
    const spread = Math.max(...vs) - Math.min(...vs);
    assert.ok(spread <= tol, `T${stack}: spread ${spread} over tolerance ${tol}`);
    assert.ok(spread > 0, 'the init seed must actually perturb the trajectory, or the clause is vacuous');
  }
});

test('the payoff seed is threaded into opts.seed on every accessor call', () => {
  const seen = [];
  const spy = (cells, pot, spr, opts) => { seen.push(opts); return PAYOFF(cells, pot, spr, opts); };
  spy.modelHash = 'spy';
  CFR.clearMatrixCache();
  CFR.solveHU({ model: MODEL, stack: 100, iters: 1, seed: 31337, payoff: spy });
  const matrixCalls = seen.filter((o) => o && o.seed !== undefined);
  assert.ok(matrixCalls.length > 0);
  assert.ok(matrixCalls.every((o) => o.seed === 31337), 'every matrix call must carry the run seed');
  assert.ok(seen.some((o) => o && o.ip === true), 'SB is the button, so the SB-hero reading is ip:true');
  assert.ok(seen.some((o) => o && o.ip === false), 'the mirror reading asks the other position');
  CFR.clearMatrixCache();
});

test('CFR+ stops flapping: argmaxes are settled long before the cap', () => {
  const r = CFR.solveHU({ model: MODEL, stack: 100, iters: CFR.ITER_CAP, seed: 0, payoff: PAYOFF, trackFlips: true });
  assert.ok(r.lastFlip > 0 && r.lastFlip < CFR.ITER_CAP * 0.9,
    `argmaxes last flipped at ${r.lastFlip} of ${CFR.ITER_CAP}; S-A measured vanilla CFR still flipping at 99,467`);
});

test('the equilibrium is BB-positive — the finding S-A says P3 must render, not bury', () => {
  for (const stack of [100, 40]) {
    const r = CFR.solveHU({ model: MODEL, stack, iters: CFR.ITER_CAP, seed: 0, payoff: PAYOFF });
    assert.ok(r.value < 0, `T${stack}: the button should LOSE under a checkdown payoff, got ${r.value}`);
    assert.ok(r.frequencies.bbFoldVsOpen < 0.01, 'BB essentially never folds against a 3bb open');
    assert.ok(r.frequencies.sbOpen > 0.9, 'SB opens almost everything');
  }
});

test('a narrower payoff domain narrows the abstraction instead of being extrapolated over', () => {
  const allowed = new Set(LIVE.slice(0, 20));
  const narrow = (cells, pot, spr, opts) => {
    const base = PAYOFF(cells, pot, spr, opts);
    if (!cells.every((c) => allowed.has(c))) return { ...base, supported: false };
    return base;
  };
  narrow.modelHash = 'narrow';
  assert.equal(CFR.liveCells(narrow, MODEL).length, 20);
});

// ---------------------------------------------------------------------------
// six-max: the deferral and the measurement behind it
// ---------------------------------------------------------------------------

test('the module exports no 6-max solver, and SIXMAX records why', () => {
  assert.equal(typeof CFR.solveSixMax, 'undefined');
  assert.equal(typeof CFR.mccfr, 'undefined');
  assert.equal(CFR.SIXMAX.status, 'deferred');
  assert.match(CFR.SIXMAX.budgetCriterion, /met/i, 'budget is NOT the reason — S-A cleared it by 5,400x');
  assert.match(CFR.SIXMAX.claimScope, /fixed-point-only/);
});

test("the deferral's three measured facts hold on the shipped payoff", () => {
  const p = CFR.multiwayProbe(PAYOFF, LIVE);
  assert.ok(p.tuples > 0);
  assert.equal(p.supportedCount, 0, 'every multiway request is supported:false');
  assert.ok(p.worstShareDev > 0.1, `the six shares miss 1 by ${p.worstShareDev} — not constant-sum`);
  assert.equal(p.opponentInvariant, true, "hero's share does not depend on the opponents' cells");
  assert.deepEqual(CFR.sixmaxDeferralProblems(p, false), []);
});

test('the deferral fails the moment its reason stops holding', () => {
  // a source that answers multiway as supported and constant-sum
  const shared = (cells, pot, spr, opts) => {
    const base = PAYOFF(cells, pot, spr, opts);
    if (cells.length <= 2) return base;
    // an opponent-dependent, constant-sum multiway answer
    const h = cells.reduce((s, c, i) => s + (i === 0 ? c.length * 2 : c.length), 0);
    return { ...base, ev: (h % 5 + 1) / (15 * cells.length / 6), supported: true, source: 'model' };
  };
  shared.modelHash = 'shared';
  const p = CFR.multiwayProbe(shared, LIVE);
  const problems = CFR.sixmaxDeferralProblems(p, false);
  assert.ok(problems.length > 0, 'a supported multiway domain must reopen the 6-max decision');
  assert.ok(problems.some((s) => /supported:true/.test(s)));
  // and a solver appearing while the record still says deferred is its own failure
  assert.ok(CFR.sixmaxDeferralProblems(p, true).length > 0);
});

// ---------------------------------------------------------------------------
// the disclosure detectors — the SAME functions the gate runs
// ---------------------------------------------------------------------------

test('the checkdown label is derived from `source`, and the `supported` trap is the armed one', () => {
  assert.equal(CFR.labelFor('checkdown'), 'a game where postflop does not exist');
  assert.equal(CFR.labelFor('model'), null);
  assert.equal(CFR.labelFor('simulated'), null);
  // the real trap: every HU showdown here IS supported, so a supported-keyed label shows nothing
  assert.equal(PAYOFF([LIVE[0], LIVE[1]], 162, 0.1, { ip: true }).supported, true);
  assert.equal(CFR.labelProblems({ source: 'checkdown', supported: true, label: null }).length, 1);
  assert.deepEqual(CFR.labelProblems({ source: 'checkdown', label: CFR.labelFor('checkdown') }), []);
  assert.equal(CFR.labelProblems({ source: 'model', label: 'a game where postflop does not exist' }).length, 1);
  assert.equal(CFR.labelProblems(null).length, 1);
});

test('a solved surface carries the label, and a mixed source keeps it', () => {
  const r = CFR.solveHU({ model: MODEL, stack: 100, iters: 4, seed: 0, payoff: PAYOFF });
  assert.equal(r.source, 'checkdown');
  assert.equal(r.label, 'a game where postflop does not exist');
  assert.deepEqual(CFR.labelProblems(r), []);
});

test('the cap list must match the tree in both directions', () => {
  const tree = CFR.buildTree(100);
  assert.deepEqual(CFR.capListProblems([...CFR.CAPS.omitted], tree), []);
  // dropping an omission understates the abstraction
  assert.equal(CFR.capListProblems(CFR.CAPS.omitted.filter((c) => !/postflop/.test(c)), tree).length, 1);
  // inventing one overstates it
  assert.equal(CFR.capListProblems([...CFR.CAPS.omitted, 'no straddle'], tree).length, 1);
  // a tree that grew a limp while the list still denies it
  const limpTree = { nodes: [{ actions: ['fold', 'call', 'raise'] }, {}, {}, {}, { actions: ['fold', 'call'] }] };
  assert.equal(CFR.capListProblems([...CFR.CAPS.omitted], limpTree).length, 1);
  assert.equal(CFR.capListProblems('not an array', tree).length, 1);
});

test('the constants block detector catches drift and absence', () => {
  const good = Object.create(null);
  for (const c of CFR.CONSTANTS) good[c.name.slice(c.name.indexOf('.') + 1)] = c.value;
  assert.deepEqual(CFR.constantsBlockProblems(good), []);
  assert.equal(CFR.constantsBlockProblems({ ...good, epsilonBB: 1e-3 }).length, 1);
  assert.equal(CFR.constantsBlockProblems({}).length, CFR.CONSTANTS.length);
});

test('every constant is anchored — none ships unanchored, so none needs a badge', () => {
  assert.ok(CFR.CONSTANTS.length >= 4);
  for (const c of CFR.CONSTANTS) {
    assert.ok(['anchored', 'identity'].includes(c.kind), `${c.name} is ${c.kind}`);
    assert.ok(c.anchor && c.anchor.length > 40, `${c.name} has no anchor text`);
  }
  assert.equal(CFR.EPSILON_BB, 5e-5);
  assert.equal(CFR.ITER_CAP, 2000);
  assert.equal(CFR.TWO_SEED_TOL_POT, 0.0015);
});

test("epsilon sits under the payoff's own se — §6's rule, as arithmetic", () => {
  let minSe = Infinity;
  for (let i = 0; i < LIVE.length; i += 7) {
    for (let j = 0; j < LIVE.length; j += 7) {
      const r = PAYOFF([LIVE[i], LIVE[j]], CFR.PREFLOP_POT_BB, 1, { ip: true });
      if (Number.isFinite(r.se) && r.se < minSe) minSe = r.se;
    }
  }
  assert.ok(CFR.EPSILON_BB <= minSe * CFR.PREFLOP_POT_BB,
    `epsilon ${CFR.EPSILON_BB} must not be tighter than the payoff's own se ${minSe * CFR.PREFLOP_POT_BB} bb`);
});
