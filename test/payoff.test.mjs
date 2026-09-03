// node --test test/*.test.mjs
//
// The I33 harness — the payoff interface freeze (V3-PLAN §2).
//
// I33 asserts that the payoff accessor keeps its contract. This file asks the harder question a
// freeze harness has to ask: CAN THE CONTRACT BE BROKEN, and would anyone notice? So the
// load-bearing tests here are the ones that fabricate a wrong payoff and show a clause firing —
// the percent/fraction slip, the off-by-one on the equity ladder, and a non-conserving function.
// Every one of those is a silent wrong answer, not a crash, which is exactly the class of bug the
// four whole phases fanning out against this signature cannot afford.
//
// AMENDED AT THE P2 PRE-STAGE, in step with the freeze it harnesses: the return is six keys, the
// stub's `potMult === 1` / `invShare === 0` are pinned as IDENTITIES (so P2's first real source is
// measured against a baseline rather than against nobody's expectation), and the three clauses the
// ceremony added or rewrote — (g) the ip-in-every-memo-key rule, (h) card-removal degeneracy, and
// the monotonicity clause now that S-B has falsified it — each get a fabricated violator here too.
//
// It also pins two properties that are easy to lose and expensive to rediscover: that `payoff.mjs`
// still survives `build.mjs`'s `moduleToIife` (§2 says the file is present in BOTH builds, and the
// dual build does not exist yet to find out the hard way), and that `se` is the same shipped basis
// `policy.seOfTrials` already quotes rather than a second, private one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../scripts/lib/policy.mjs';
import { payoff, makePayoff, setDefaultModel, SOURCES, RESULT_KEYS } from '../scripts/lib/payoff.mjs';
/* The amended clauses are armed against THE GATE'S OWN DETECTORS, not against a second copy of
   them written here. A harness that re-implements a detector proves only that the harness's copy
   fires; importing them is what makes these tests say something about the gate that runs. */
import { memoProblems, ipMemoAliases, stripComments, MEMO_SCOPE, isDegeneratePair, removalProblems,
  monoProblems, monoRows } from '../scripts/gates/payoff.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const HAVE = existsSync(MODEL_PATH);
const M = HAVE ? JSON.parse(readFileSync(MODEL_PATH, 'utf8')) : null;
const LIVE = HAVE ? Object.keys(M.cells).filter((k) => M.cells[k].eq) : [];
const N = HAVE ? M.meta.trials.cell : 0;

/** a model sharing everything but its equity ladders, which `f` rewrites — the fabrication route */
function withEq(f) {
  const cells = {};
  for (const k of Object.keys(M.cells)) {
    const c = M.cells[k];
    cells[k] = c.eq ? { ...c, eq: c.eq.map(f) } : c;
  }
  return { ...M, cells };
}

const se1 = (p) => Math.sqrt((p * (1 - p)) / N);

// ---------------------------------------------------------------------------
// (a) the freeze itself
// ---------------------------------------------------------------------------

test('the signature is frozen at four arguments — no default may soften it', () => {
  assert.equal(payoff.length, 4, 'a default on `opts` would make this 3 and quietly break I33(a)');
  assert.equal(makePayoff.length, 1);
  if (HAVE) assert.equal(makePayoff(M).length, 4, 'the bound accessor keeps the arity too');
});

test('a return carries exactly the six frozen keys, with the frozen types', { skip: !HAVE }, () => {
  const r = payoff([LIVE[0], LIVE[1]], 10, 4, { ip: true });
  assert.deepEqual(Object.keys(r), [...RESULT_KEYS], 'and in ORDER — the page mirror pins that too');
  assert.deepEqual([...RESULT_KEYS], ['ev', 'se', 'source', 'supported', 'potMult', 'invShare'],
    'the P2 pre-stage amendment APPENDS; interleaving the two new keys is a red mirror test');
  assert.equal(typeof r.ev, 'number');
  assert.equal(typeof r.se, 'number');
  assert.equal(typeof r.source, 'string');
  assert.equal(typeof r.supported, 'boolean');
  assert.equal(typeof r.potMult, 'number');
  assert.equal(typeof r.invShare, 'number');
  assert.ok(SOURCES.includes(r.source), `source ${r.source} is outside the frozen enum`);
  assert.ok(r.ev >= 0 && r.ev <= 1, 'ev is a pot FRACTION, not a percentage');
});

// ---------------------------------------------------------------------------
// amendment (i): the two keys that make the bb conversion possible at all
// ---------------------------------------------------------------------------

test('the stub reports the checkdown pot geometry as an IDENTITY, at every spr and on every exit', { skip: !HAVE }, () => {
  // Checkdown means no betting after the decision node, so the final pot IS the pot at the node:
  // E[F] = potSize (multiplier exactly 1) and hero invests nothing after it (post-node share
  // exactly 0). Object.is, not a tolerance — these are what P2's first real source gets measured
  // against, and "approximately 1" would be a baseline nobody could hold anyone to.
  for (const spr of [0, 0.5, 1, 4, 13, 400]) {
    for (const opts of [undefined, null, {}, { ip: false }, { ip: true }, { seed: 'rundown-v3' }]) {
      const r = payoff([LIVE[0], LIVE[1]], 10, spr, opts);
      assert.ok(Object.is(r.potMult, 1), `potMult at spr ${spr}`);
      assert.ok(Object.is(r.invShare, 0), `invShare at spr ${spr}`);
    }
  }
  // multiway, and the malformed exits — a return site that forgot the new keys shows up here
  for (const cells of [[LIVE[0], LIVE[1], LIVE[2]], [LIVE[0]], [], null, 'x', ['NOPE|XX', 'ALSO|XX']]) {
    const r = payoff(cells, 10, 4, {});
    assert.deepEqual(Object.keys(r), [...RESULT_KEYS], 'every exit packs all six');
    assert.ok(Object.is(r.potMult, 1) && Object.is(r.invShare, 0));
  }
});

test('the caller arithmetic the two keys complete is exact, and heroPre is the caller\'s half', { skip: !HAVE }, () => {
  // The contract: finalPot = potMult*potSize; invested = heroPre + invShare*finalPot;
  // EVbb = ev*finalPot - invested. `heroPre` — hero's own contribution to potSize — is NOT returned
  // from here, because the four frozen arguments do not carry it: S-B's own invShare bundles a
  // 0.5/0.5 REF3 NORMALISATION for it, which is an assumption about the node and not a measurement.
  // Under the stub the conversion collapses to something a human can check by hand.
  const potSize = 10, heroPre = 2.5;
  const r = payoff([LIVE[0], LIVE[1]], potSize, 4, { ip: false });
  const finalPot = r.potMult * potSize;
  const invested = heroPre + r.invShare * finalPot;
  assert.equal(finalPot, potSize, 'checkdown: the pot at the end is the pot at the node');
  assert.equal(invested, heroPre, 'checkdown: hero invests nothing after the node');
  assert.ok(Math.abs((r.ev * finalPot - invested) - (r.ev * potSize - heroPre)) < 1e-15);
  // and the conversion back to S-B's total-share reading is one line, exactly as the header says
  assert.equal(heroPre / finalPot + r.invShare, heroPre / potSize, 'total = heroPre/finalPot + invShare');
});

/** the module's own `finish`, sliced out of the shipped text — the moduleToIife trick, reused so
 *  the guard under test is the guard that ships rather than a paraphrase of it */
function shippedFinish() {
  let src = readFileSync(resolve(ROOT, 'scripts/lib/payoff.mjs'), 'utf8');
  src = src.slice(0, src.indexOf('/* @browser-cut'))
    .replace(/^export\s+(const|let|function|class)\s+/gm, '$1 ');
  return new Function(`${src}\nreturn finish;`)();
}

test('a value outside the two new structural ranges can never leave wearing supported:true', { skip: !HAVE }, () => {
  // The same idiom `ev` already had, extended by the amendment to the two new keys. The bounds are
  // STRUCTURAL — the final pot contains the pot at the node, and hero cannot invest more after the
  // node than the whole final pot — so they are not tolerances anybody chose. Unreachable through
  // the stub's public surface (it always answers 1 and 0), which is exactly why the guard is
  // exercised directly: an unreachable guard nobody calls is a guard that quietly stops working.
  const finish = shippedFinish();
  const good = finish(0.6, 0.001, 'checkdown', true, 1, 0);
  assert.equal(good.supported, true);
  assert.deepEqual(Object.keys(good), [...RESULT_KEYS], 'six keys, in order, out of `finish` itself');
  for (const [potMult, invShare, why] of [
    [0.5, 0, 'a final pot smaller than the pot at the node'],
    [NaN, 0, 'a non-finite multiplier'],
    [Infinity, 0, 'an infinite multiplier'],
    [1, -0.1, 'a negative post-node share'],
    [1, 1.5, 'hero investing more than the whole final pot'],
    [1, NaN, 'a non-finite share'],
    [undefined, 0, 'a source that forgot the key entirely'],
  ]) {
    const r = finish(0.6, 0.001, 'model', true, potMult, invShare);
    assert.equal(r.supported, false, `${why} must be flagged`);
    assert.deepEqual(Object.keys(r), [...RESULT_KEYS], `${why}: still six keys`);
    assert.ok(Object.is(r.potMult, potMult) && Object.is(r.invShare, invShare),
      `${why}: the bad number is RETURNED, not clamped away — a clamp would hide it from I33`);
  }
});

test('the same arguments give the same object, twice, at either position', { skip: !HAVE }, () => {
  for (const ip of [false, true]) {
    const a = payoff([LIVE[3], LIVE[9]], 7.5, 2.5, { ip });
    const b = payoff([LIVE[3], LIVE[9]], 7.5, 2.5, { ip });
    assert.deepStrictEqual(a, b, 'the accessor is pure — no clock, no counter, no unseeded sampling');
  }
});

test('position enters through the argument, and today it is inert by construction', { skip: !HAVE }, () => {
  // The claim is NOT "position does not matter" — it is that there is no global to set. When a
  // source finally depends on position, this assertion becomes the one that has to be rewritten,
  // and rewriting it will be a one-line diff in one file.
  const inP = payoff([LIVE[2], LIVE[8]], 10, 4, { ip: true });
  const oop = payoff([LIVE[2], LIVE[8]], 10, 4, { ip: false });
  assert.deepStrictEqual(inP, oop, 'the checkdown game has no position: realization is exactly what it does not measure');
});

// ---------------------------------------------------------------------------
// the stub is the projection of the shipped measurement, and nothing else
// ---------------------------------------------------------------------------

test('a heads-up ev is the zero-sum projection, recomputed from model.cells with no payoff code in the middle', { skip: !HAVE }, () => {
  for (const [a, b] of [['AA_BIGPAIR|DS', 'TRASH|RB'], ['TRIPS_SMALL|RB', 'AA_BIGPAIR|DS'], [LIVE[40], LIVE[41]]]) {
    const want = (M.cells[a].eq[0] + (100 - M.cells[b].eq[0])) / 200;   // §2's form, stated independently
    assert.ok(Math.abs(payoff([a, b], 10, 4).ev - want) < 1e-15, `${a} vs ${b}`);
  }
  // and it reads eq[0] — vs ONE opponent — not eq[1]. The off-by-one is the other silent unit bug.
  const off = withEq((v) => v);
  off.cells['AA_BIGPAIR|DS'] = { ...M.cells['AA_BIGPAIR|DS'], eq: [70.9, 99.9, 0, 0, 0, 0, 0] };
  const moved = makePayoff(off)(['AA_BIGPAIR|DS', 'TRASH|RB'], 10, 4).ev;
  assert.ok(Math.abs(moved - (70.9 + (100 - M.cells['TRASH|RB'].eq[0])) / 200) < 1e-15,
    'moving eq[1] must not move a heads-up answer');
});

test('conservation is EXACT under the projection, not merely within 2 se', { skip: !HAVE }, () => {
  let worst = 0;
  for (let i = 0; i < LIVE.length; i++) {
    for (let j = 0; j < LIVE.length; j++) {
      if (i === j) continue;
      const s = payoff([LIVE[i], LIVE[j]], 10, 4).ev + payoff([LIVE[j], LIVE[i]], 10, 4).ev;
      worst = Math.max(worst, Math.abs(s - 1));
    }
  }
  assert.equal(worst, 0, `§2 clause (b) asks for 1 +/- 2 se; the projection delivers 1 exactly, `
    + `over all ${LIVE.length * (LIVE.length - 1)} ordered pairs`);
});

test('a fabricated non-conserving payoff FAILS the conservation clause — the clause is armable', { skip: !HAVE }, () => {
  const real = makePayoff(M);
  const tilted = (cells, pot, spr, opts) => {
    const r = real(cells, pot, spr, opts);
    return { ...r, ev: Math.min(1, r.ev + 0.05) };   // a payoff that likes hero, whoever hero is
  };
  const violations = (fn) => {
    let n = 0;
    for (let i = 0; i < 20; i++) {
      const a = LIVE[i], b = LIVE[(i + 7) % LIVE.length];
      const ra = fn([a, b], 10, 4), rb = fn([b, a], 10, 4);
      if (Math.abs(ra.ev + rb.ev - 1) > 2 * Math.hypot(ra.se, rb.se)) n++;
    }
    return n;
  };
  assert.equal(violations(real), 0, 'the shipped stub conserves');
  assert.ok(violations(tilted) >= 18, `a 5-point thumb on the scale must fire the clause (fired ${violations(tilted)}/20)`);
});

test('the percent/fraction slip is caught, not absorbed', { skip: !HAVE }, () => {
  // Divide by 100 twice and the projection quietly still conserves (it is a DIFFERENCE), so the
  // clause that has to catch it is ev-in-[0,1] on the multiway path, where nothing cancels.
  const tenfold = makePayoff(withEq((v) => v * 10));
  let outOfRange = 0;
  for (let i = 0; i < LIVE.length; i++) {
    if (!(tenfold([LIVE[i], LIVE[(i + 1) % LIVE.length]], 10, 4).ev <= 1)) outOfRange++;
  }
  assert.ok(outOfRange > 0, 'a 10x equity ladder must push ev out of [0,1] somewhere');
  const mw = tenfold([LIVE[0], LIVE[1], LIVE[2]], 10, 4);
  assert.ok(mw.ev > 1, 'and immediately on the multiway path, where there is no cancellation');
  assert.equal(mw.supported, false, 'an out-of-contract ev can never leave wearing supported:true');
});

// ---------------------------------------------------------------------------
// the multiway door
// ---------------------------------------------------------------------------

test('multiway returns a flagged number — never a guess presented as supported', { skip: !HAVE }, () => {
  for (let L = 3; L <= M.meta.nMax + 1; L++) {
    const cells = [LIVE[0], ...Array.from({ length: L - 1 }, (_, i) => LIVE[i + 1])];
    const r = payoff(cells, 10, 4);
    assert.equal(r.supported, false, `length ${L} is outside the measured domain`);
    assert.equal(r.ev, M.cells[LIVE[0]].eq[L - 2] / 100, `length ${L} reads eq[N-1] for N = ${L - 1} opponents`);
    assert.ok(r.se > 0);
  }
});

test('the door closes where the measurement stops', { skip: !HAVE }, () => {
  const tooMany = payoff(Array.from({ length: M.meta.nMax + 2 }, () => LIVE[0]), 10, 4);
  assert.equal(tooMany.supported, false, `${M.meta.nMax + 2} cells is past the end of a ${M.meta.nMax}-entry ladder`);
  assert.ok(tooMany.se > 0);
});

// ---------------------------------------------------------------------------
// out of domain: never throws, never unflagged
// ---------------------------------------------------------------------------

test('every malformed request returns all six keys instead of throwing', { skip: !HAVE }, () => {
  const bad = [
    [['NOPE|XX', LIVE[0]], 10, 4, undefined, 'unknown hero key'],
    [[LIVE[0], 'NOPE|XX'], 10, 4, undefined, 'unknown villain key'],
    [['__proto__', LIVE[0]], 10, 4, undefined, 'a prototype key is an unknown key, not an inherited answer'],
    [['constructor', LIVE[0]], 10, 4, undefined, 'ditto'],
    ['not-an-array', 10, 4, undefined, 'cells is not an array'],
    [null, 10, 4, undefined, 'cells is null'],
    [[], 10, 4, undefined, 'no cells at all'],
    [[LIVE[0]], 10, 4, undefined, 'one cell is not a hand'],
    [[LIVE[0], 7], 10, 4, undefined, 'a non-string cell key'],
    [[LIVE[0], LIVE[1]], 0, 4, undefined, 'potSize 0'],
    [[LIVE[0], LIVE[1]], -3, 4, undefined, 'potSize negative'],
    [[LIVE[0], LIVE[1]], NaN, 4, undefined, 'potSize NaN'],
    [[LIVE[0], LIVE[1]], Infinity, 4, undefined, 'potSize infinite'],
    [[LIVE[0], LIVE[1]], '10', 4, undefined, 'potSize is a string'],
    [[LIVE[0], LIVE[1]], 10, -1, undefined, 'spr negative'],
    [[LIVE[0], LIVE[1]], 10, NaN, undefined, 'spr NaN'],
    [[LIVE[0], LIVE[1]], 10, Infinity, undefined, 'spr infinite'],
    [[LIVE[0], LIVE[1]], 10, 4, 7, 'opts is not an object'],
    [[LIVE[0], LIVE[1]], 10, 4, [], 'opts is an array'],
    [[LIVE[0], LIVE[1]], 10, 4, { seed: {} }, 'a seed you cannot reproduce is not a seed'],
    [[LIVE[0], LIVE[1]], 10, 4, { seed: NaN }, 'nor is NaN'],
  ];
  for (const [cells, pot, spr, opts, why] of bad) {
    const r = payoff(cells, pot, spr, opts);
    assert.deepEqual(Object.keys(r), [...RESULT_KEYS], why);
    assert.equal(r.supported, false, `${why} must be flagged`);
    assert.ok(Object.is(r.potMult, 1) && Object.is(r.invShare, 0),
      `${why}: nothing was bet on a request that was never in the game`);
    assert.ok(SOURCES.includes(r.source), why);
    assert.ok(typeof r.ev === 'number' && r.ev >= 0 && r.ev <= 1, `${why}: ev stays a pot fraction`);
    assert.ok(r.se > 0, `${why}: se stays positive`);
  }
});

test('absence of opts is not out-of-domain — the argument is optional, its shape is not', { skip: !HAVE }, () => {
  for (const opts of [undefined, null, {}, { ip: false }, { ip: true }, { seed: 1 }, { seed: 'rundown-v3' }]) {
    const r = payoff([LIVE[0], LIVE[1]], 10, 4, opts);
    assert.equal(r.supported, true, `opts = ${JSON.stringify(opts) ?? 'undefined'} is a legal request`);
  }
});

// ---------------------------------------------------------------------------
// (d) the error bar
// ---------------------------------------------------------------------------

test('se is the shipped basis policy.seOfTrials already quotes, not a second private one', { skip: !HAVE }, () => {
  // seOfTrials is percentage points at p = 0.5; this file works in pot fractions. Same number.
  assert.ok(Math.abs(se1(0.5) - P.seOfTrials(N) / 100) < 1e-15,
    `sqrt(0.25/${N}) = ${se1(0.5)} vs seOfTrials/100 = ${P.seOfTrials(N) / 100}`);
  assert.ok(Math.abs(P.seOfTrials(N) - M.meta.se.cell) < 0.005, 'and it is what meta.se.cell records');
});

test('a heads-up se is the error of the mean of TWO cells', { skip: !HAVE }, () => {
  const a = 'AA_BIGPAIR|DS', b = 'TRASH|RB';
  const want = Math.hypot(se1(M.cells[a].eq[0] / 100), se1(M.cells[b].eq[0] / 100)) / 2;
  assert.ok(Math.abs(payoff([a, b], 10, 4).se - want) < 1e-18);
});

test('se is positive on every path, and Infinity exactly where no trial backs the number', { skip: !HAVE }, () => {
  const withHero = payoff([LIVE[0], 'NOPE|XX'], 10, 4);
  assert.ok(withHero.se > 0 && Number.isFinite(withHero.se), 'hero resolves: hero cell trials back it');
  for (const cells of [['NOPE|XX', LIVE[0]], 'x', null, []]) {
    assert.equal(payoff(cells, 10, 4).se, Infinity,
      'no cell, no trials: quoting 100k trials of precision on a number no trial produced is the typed se clause (d) forbids');
  }
});

test('a cell measured at the extremes still reports a positive, finite se', { skip: !HAVE }, () => {
  const flat = makePayoff(withEq(() => 0));
  const full = makePayoff(withEq(() => 100));
  for (const f of [flat, full]) {
    const r = f([LIVE[0], LIVE[1], LIVE[2]], 10, 4);
    assert.ok(r.se > 0 && Number.isFinite(r.se), 'the Laplace clamp is why 0% and 100% do not claim certainty');
  }
});

// ---------------------------------------------------------------------------
// amendment (ii): clause (g), `opts.ip` in every memo key
// ---------------------------------------------------------------------------

test('a payoff memo key that forgot `ip` is caught, and one that carries it is not', () => {
  // S-B: ev(A,B,ip) != ev(A,B,!ip) by up to 43 pt, while ev(A,B,ip) + ev(B,A,!ip) = 1 holds
  // exactly. So a memo without `ip` in the key is wrong by more than the whole error budget — the
  // pre-registered Grade A edge is 2.5 pt — and wrong silently. The detector is the gate's own.
  const keyless = "const k = cells.join(',') + '|' + pot + '|' + spr;\n"
    + 'if (memo.has(k)) return memo.get(k);\nconst r = payoff(cells, pot, spr, opts); memo.set(k, r); return r;';
  const keyed = "const k = cells.join(',') + '|' + pot + '|' + spr + '|' + (opts && opts.ip ? 1 : 0)\n"
    + "  + '|' + (opts && opts.seed) + '|' + PAY.modelHash;\n"
    + 'if (memo.has(k)) return memo.get(k);\nconst r = payoff(cells, pot, spr, opts); memo.set(k, r); return r;';
  assert.equal(memoProblems('cfr.mjs', keyless).length, 1, 'a keyless memo must fire the clause');
  assert.match(memoProblems('cfr.mjs', keyless)[0], /without ip/);
  assert.equal(memoProblems('cfr.mjs', keyed).length, 0, 'a key carrying ip + seed + hash must clear');
  // a key that remembers ip but forgets WHICH MODEL answered is the other half of the rule
  assert.equal(memoProblems('cfr.mjs', keyed.replace('PAY.modelHash', 'spr')).length, 1);
});

test('the detector reads code, not the prose about the code', () => {
  // payoff.mjs's own header is a thousand words about memo keys and contains "memo", "key", "ip"
  // and "hash". Scanned raw it would clear the clause for entirely the wrong reason — because it
  // DISCUSSES compliance. Stripping comments first is what makes (g) mean anything.
  const src = readFileSync(resolve(ROOT, 'scripts/lib/payoff.mjs'), 'utf8');
  assert.ok(/\bmemo\b/i.test(src), 'the raw file does talk about memos');
  assert.ok(!/\bmemo\w*\b/i.test(stripComments(src)),
    'and after the strip there is no memo left, because payoff.mjs deliberately has none');
  assert.equal(memoProblems('payoff.mjs', src).length, 0);
  // scope: payoff.mjs cannot satisfy clause (e)'s "imports payoff.mjs", so (g) has its own regex,
  // and policy.mjs's envKey solve memos are a different key rule and stay out of it.
  assert.ok(MEMO_SCOPE.test('payoff.mjs') && MEMO_SCOPE.test('cfr.mjs')
    && MEMO_SCOPE.test('payoff-model.mjs') && MEMO_SCOPE.test('ev-cut.mjs'));
  assert.ok(!MEMO_SCOPE.test('policy.mjs') && !MEMO_SCOPE.test('taxonomy.mjs'));
});

test('a keyless memo aliases the two positions onto one object, and the real accessor does not', { skip: !HAVE }, () => {
  // The dynamic half. Under a position-inert stub the two VALUES are equal, so object identity is
  // the only signal there is — which is why the text clause above is the load-bearing one and this
  // is the companion. A memo that cloned its cached value would slip past this, and that limit is
  // stated in the gate's own detail line rather than left for someone to discover.
  const m = new Map();
  const keylessMemo = (cells, pot, spr, opts) => {
    const k = `${cells}|${pot}|${spr}`;
    if (!m.has(k)) m.set(k, payoff(cells, pot, spr, opts));
    return m.get(k);
  };
  assert.equal(ipMemoAliases(keylessMemo, [LIVE[0], LIVE[1]], 10, 4), true, 'the fabrication must fire');
  assert.equal(ipMemoAliases(payoff, [LIVE[0], LIVE[1]], 10, 4), false, 'the real accessor must not');
  // and the reason values cannot discriminate today, stated as an assertion rather than a hope
  assert.deepStrictEqual(payoff([LIVE[0], LIVE[1]], 10, 4, { ip: true }),
    payoff([LIVE[0], LIVE[1]], 10, 4, { ip: false }));
});

// ---------------------------------------------------------------------------
// amendment (iii): clause (h), card-removal degeneracy
// ---------------------------------------------------------------------------

test('the degeneracy families are the measured ones, and nothing else', { skip: !HAVE }, () => {
  // S-B: AA_DANGLER|RB x AA_BIGPAIR|DS is degenerate on 12.56% of street evaluations (the four
  // aces are shared), mean 0.73% over 50 pairs, 4/50 over 1%. S-A: 43 structurally undealable
  // pairs, AA_* x A_BLOCKED, combo mass 3.6e-5. Two families, no invented third.
  assert.ok(isDegeneratePair('AA_DANGLER|RB', 'AA_BIGPAIR|DS'), "S-B's own named pair");
  assert.ok(isDegeneratePair('AA_BIGPAIR|DS', 'A_BLOCKED|RB') && isDegeneratePair('A_BLOCKED|SSA', 'AA_DANGLER|DS'));
  assert.ok(!isDegeneratePair('TRASH|RB', 'RUN2|DS'), 'two ace-free cells share no ranks structurally');
  assert.ok(!isDegeneratePair('A_BLOCKED|RB', 'A_BLOCKED|SSA'), 'one ace each is two aces, which is dealable');
  const degen = [];
  for (const a of LIVE) for (const b of LIVE) if (a !== b && isDegeneratePair(a, b)) degen.push([a, b]);
  assert.ok(degen.length > 0 && degen.length < LIVE.length * (LIVE.length - 1) / 10,
    `${degen.length} of ${LIVE.length * (LIVE.length - 1)} ordered pairs — a real subset, not everything`);
});

test('a source that silently collapses a degenerate pair is caught; one that flags it is not', { skip: !HAVE }, () => {
  // THE FAILURE MODE IS SILENT. S-B's first implementation dead-carded the range against the
  // opponent's actual hand and collapsed every AA-vs-AA pair to a checkdown with no error raised.
  // `collapser` is that bug, reproduced: the checkdown answer wearing a dealt-board label.
  const degen = [], control = [];
  for (const a of LIVE) for (const b of LIVE) {
    if (a === b) continue;
    if (isDegeneratePair(a, b)) degen.push([a, b]); else if (control.length < 40) control.push([a, b]);
  }
  const collapser = (c, p, s, o) => ({ ...payoff(c, p, s, o), source: 'simulated', supported: true });
  const honest = (c, p, s, o) => ({
    ...payoff(c, p, s, o), source: 'simulated',
    supported: !(Array.isArray(c) && c.length === 2 && isDegeneratePair(c[0], c[1])),
  });
  assert.equal(removalProblems(collapser, degen).length, degen.length, 'every degenerate pair, not some');
  assert.equal(removalProblems(honest, degen).length, 0, 'flagged is what honest looks like');
  assert.equal(removalProblems(collapser, control).length, 0,
    'the detector carries the degeneracy scope itself, so it must stay quiet on a non-degenerate pair');
  // the stub deals nothing and is exempt BY CONSTRUCTION — asserted, not assumed
  assert.equal(removalProblems(payoff, degen).length, 0);
  for (const [a, b] of degen) assert.equal(payoff([a, b], 10, 4, { ip: false }).source, 'checkdown');
});

// ---------------------------------------------------------------------------
// the monotonicity clause — §2 wrote it to be falsified, and S-B falsified it
// ---------------------------------------------------------------------------

test('checkdown is strictly increasing in hero eq[0], which is now the half that stays asserted', { skip: !HAVE }, () => {
  // §2 predicted high-cooler hands break monotonicity at spr >= 4 once a real payoff model lands,
  // and that the break is the model WORKING. S-B broke it: inversions on 1.7% of pairs at spr 1,
  // 8.1% at spr 4, 15.9% IP / 20.5% OOP at spr 10, worst case 9.1 pt LESS checkdown equity for
  // 20.0 pt MORE ev. The clause was rewritten to the measurement, not widened and not deleted —
  // and this half of it survives unchanged, because it is what catches the stub quietly ceasing to
  // be the stub.
  const sorted = [...LIVE].sort((x, y) => M.cells[x].eq[0] - M.cells[y].eq[0]);
  const rows = monoRows(payoff, sorted, 'AA_BIGPAIR|RB', [0, 1, 4, 13]);
  for (const r of rows) {
    assert.equal(r.source, 'checkdown');
    assert.equal(r.inversions, 0, `spr ${r.spr} ip=${r.ip}: the stub is affine in eq[0]`);
  }
  assert.equal(monoProblems(payoff, sorted, 'AA_BIGPAIR|RB', [0, 1, 4, 13]).length, 0);
});

test('a NON-checkdown source that is perfectly monotone at spr >= 4 is the new failure', { skip: !HAVE }, () => {
  // The rewritten half, and the one with teeth: realization is exactly what checkdown equity does
  // not measure, so a source claiming to model it while reproducing the checkdown ORDER is not
  // modelling it. No upper bound is asserted anywhere — S-B's band is reported, never used as a
  // tolerance, because 50 pairs cannot license one.
  const sorted = [...LIVE].sort((x, y) => M.cells[x].eq[0] - M.cells[y].eq[0]);
  const asModel = (c, p, s, o) => ({ ...payoff(c, p, s, o), source: 'model' });
  const jolt = (k) => { let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return ((h % 1000) / 1000 - 0.5) * 0.2; };
  const realizing = (c, p, s, o) => {
    const r = asModel(c, p, s, o);
    return (s >= 4 && Array.isArray(c)) ? { ...r, ev: Math.min(1, Math.max(0, r.ev + jolt(String(c[0])))) } : r;
  };
  const flagged = monoProblems(asModel, sorted, 'AA_BIGPAIR|RB', [0, 1, 4, 13]);
  assert.ok(flagged.length > 0, 'the stub relabelled `model` is monotone, and that is now a failure');
  assert.match(flagged[0], /perfectly monotone at spr (4|13)/);
  assert.equal(monoProblems(realizing, sorted, 'AA_BIGPAIR|RB', [0, 1, 4, 13]).length, 0,
    'a `model` that actually perturbs the order at spr >= 4 is what passing looks like');
  // spr 1 is REPORTED, not asserted: 1.7% is too near zero to serve as a floor
  const quietLow = monoProblems(asModel, sorted, 'AA_BIGPAIR|RB', [0, 1]);
  assert.equal(quietLow.length, 0, 'below spr 4 a monotone non-checkdown source is not asserted against');
});

test('the stub is spr-inert, which is what "checkdown" means — reported, not a claim about the future', { skip: !HAVE }, () => {
  const base = payoff([LIVE[0], LIVE[1]], 10, 0);
  for (const spr of [0.5, 1, 4, 13, 400]) {
    assert.deepStrictEqual(payoff([LIVE[0], LIVE[1]], 10, spr), base,
      'a game where postflop does not exist cannot depend on the stack-to-pot ratio');
  }
});

test('potSize is validated and then unused — ev is a pot FRACTION', { skip: !HAVE }, () => {
  const base = payoff([LIVE[0], LIVE[1]], 1, 4);
  for (const pot of [2.5, 10, 60, 1000]) {
    assert.deepStrictEqual(payoff([LIVE[0], LIVE[1]], pot, 4), base,
      'bb conversion is caller arithmetic (EVbb = ev*finalPot - invested), so rake and depth stay in the exact machinery');
  }
});

// ---------------------------------------------------------------------------
// the model is an input, not a hidden global
// ---------------------------------------------------------------------------

test('makePayoff holds two models live at once and neither leaks into the other', { skip: !HAVE }, () => {
  const a = makePayoff(M);
  const b = makePayoff(withEq((v) => 100 - v));           // a mirror-image measurement
  const ra = a([LIVE[0], LIVE[1]], 10, 4);
  const rb = b([LIVE[0], LIVE[1]], 10, 4);
  assert.ok(Math.abs(ra.ev - rb.ev) > 1e-9, 'a different measurement must give a different answer');
  assert.deepStrictEqual(a([LIVE[0], LIVE[1]], 10, 4), ra, 'and the first accessor is unmoved');
  assert.equal(a.modelHash, M.meta.hash, 'the other half of any future memo key');
});

test('a model with no trial count is refused at wiring time rather than answered with a typed se', () => {
  assert.throws(() => makePayoff(null), TypeError);
  assert.throws(() => makePayoff({}), TypeError);
  assert.throws(() => makePayoff({ cells: {} }), TypeError, 'no meta.trials.cell');
  assert.throws(() => makePayoff({ cells: {}, meta: { trials: { cell: 0 } } }), TypeError, 'zero trials is not a trial count');
  assert.doesNotThrow(() => makePayoff({ cells: {}, meta: { trials: { cell: 10 } } }));
});

test('setDefaultModel is the page boot hook, and it replaces rather than accumulates', { skip: !HAVE }, () => {
  const before = payoff([LIVE[0], LIVE[1]], 10, 4);
  const mirrored = withEq((v) => 100 - v);
  setDefaultModel(mirrored);
  const after = payoff([LIVE[0], LIVE[1]], 10, 4);
  assert.ok(Math.abs(before.ev - after.ev) > 1e-9);
  setDefaultModel(M);
  assert.deepStrictEqual(payoff([LIVE[0], LIVE[1]], 10, 4), before, 'and it restores exactly');
});

// ---------------------------------------------------------------------------
// §2's "present in both builds"
// ---------------------------------------------------------------------------

test('payoff.mjs still survives build.mjs\'s moduleToIife — the page can carry it', () => {
  // The dual build (item 16, P1-I) does not exist yet, so nothing else would notice this breaking.
  // The rules are moduleToIife's, verbatim: cut at the marker, no top-level import above it, and
  // only export forms of the shape `export const|let|function|class NAME`.
  let src = readFileSync(resolve(ROOT, 'scripts/lib/payoff.mjs'), 'utf8');
  const i = src.indexOf('/* @browser-cut');
  assert.ok(i > 0, 'the Node-only tail must be cuttable');
  src = src.slice(0, i);
  assert.ok(!/^\s*import\s/m.test(src), 'the page cannot resolve an import statement');
  const names = [];
  src = src.replace(/^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, id) => {
    names.push(id); return `${kind} ${id}`;
  });
  assert.ok(!/^export\s/m.test(src), 'an export form build.mjs does not understand');
  assert.ok(names.includes('payoff') && names.includes('makePayoff') && names.includes('setDefaultModel'));
  assert.doesNotThrow(() => new Function(`const PAYOFF = (() => {\n${src}\nreturn { ${names.join(', ')} };\n})();`));
});

test('and it does not drag the opinion layer along with it', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/lib/payoff.mjs'), 'utf8');
  assert.ok(!/from\s+'\.\/policy\.mjs'/.test(src),
    'the payoff is the objective side of the split; coupling it to the scoring layer for two lines of arithmetic would be backwards');
});
