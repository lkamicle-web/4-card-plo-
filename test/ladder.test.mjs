// test/ladder.test.mjs — THE IDENTITY WITNESS for the v4 seat ladder (V4-PLAN §2.1–2.3).
//
// The refactor replaced four name-keyed tables and two seat-name literals with structural functions
// of ladder index. The claim that makes v4 a feature rather than a re-freeze is that every one of
// them reproduces its table EXACTLY at six seats — so the deleted literals live on HERE, verbatim,
// and are compared against the functions that replaced them. Delete this file and the identity
// becomes an assertion in a commit message.
//
// The nine-seat half is asserted too, because a function that reproduces six seats by accident (a
// clamp, a max, an off-by-one that happens to vanish at length 6) would pass the first half alone.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../scripts/lib/policy.mjs';
import * as SK from '../scripts/lib/skill.mjs';

/* ---- the deleted literals, exactly as scripts/lib/policy.mjs:477–485 carried them ------------ */
const N_NB = { UTG: 3, HJ: 2, CO: 1, BTN: 0, SB: 0, BB: 0 };
const N_BL = { UTG: 2, HJ: 2, CO: 2, BTN: 2, SB: 1, BB: 0 };
const NEST_CHAIN = {
  rfi: ['UTG', 'HJ', 'CO', 'BTN'], limps: ['HJ', 'CO', 'BTN'], raise: ['HJ', 'CO', 'BTN'], '3bet': [],
};
const DISABLED = (pos, node) => {
  if (node === 'rfi' && pos === 'BB') return 'BB closes the unopened pot by checking';
  if ((node === 'limps' || node === 'raise') && pos === 'UTG') return 'no one acts before UTG';
  return null;
};
/* src/shell.html:2188–2192's three legalPos objects, likewise */
const LEGAL_POS = {
  rfi: { UTG: 1, HJ: 1, CO: 1, BTN: 1, SB: 1, BB: 0 },
  limps: { UTG: 0, HJ: 1, CO: 1, BTN: 1, SB: 1, BB: 1 },
  raise: { UTG: 0, HJ: 1, CO: 1, BTN: 1, SB: 1, BB: 1 },
  '3bet': { UTG: 1, HJ: 1, CO: 1, BTN: 1, SB: 1, BB: 1 },
};

test('the six-seat ladder is POSITIONS itself, by reference, and nothing renames it', () => {
  assert.equal(P.seatsFor(6), P.POSITIONS);
  assert.equal(P.seatsFor(), P.POSITIONS);          // the default is six, everywhere
  assert.equal(P.seatsFor(7), P.POSITIONS);         // {6, 9} is a SET: 7 is not a ladder
  assert.deepEqual(P.POSITIONS, ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  assert.equal(P.seatsFor(9), P.LADDER9);
  assert.equal(P.LADDER9.length, 9);
  // the six-seat table IS the nine-seat table with its first three seats empty — the structural
  // identity §2.1 names, and the reason `LJ` is the name on the rail
  assert.deepEqual(P.LADDER9.slice(3).slice(1), P.POSITIONS.slice(1));
});

test('the structural functions reproduce the deleted tables at six seats, exactly', () => {
  for (const pos of P.POSITIONS) {
    assert.equal(P.behindNonBlind(pos, 6), N_NB[pos], `behindNonBlind ${pos}`);
    assert.equal(P.blindBehind(pos, 6), N_BL[pos], `blindBehind ${pos}`);
    assert.equal(P.isBlind(pos, 6), N_NB[pos] === 0 && N_BL[pos] < 2, `isBlind ${pos}`);
  }
  for (const node of P.NODES) {
    assert.deepEqual(P.nestChain(node, 6), NEST_CHAIN[node], `nestChain ${node}`);
    for (const pos of P.POSITIONS) {
      assert.equal(P.positionDisabled(pos, node, 6), DISABLED(pos, node), `disabled ${pos}|${node}`);
      // and the default argument is six, so every legacy caller that passes two arguments is safe
      assert.equal(P.positionDisabled(pos, node), DISABLED(pos, node));
      assert.equal(P.positionDisabled(pos, node, 6) ? 0 : 1, LEGAL_POS[node][pos], `legalPos ${pos}|${node}`);
    }
  }
});

test('the ladder at nine seats is the one §2.2 predicts, and not an accident of length 6', () => {
  assert.deepEqual(P.LADDER9.map((p) => P.behindNonBlind(p, 9)), [6, 5, 4, 3, 2, 1, 0, 0, 0]);
  assert.deepEqual(P.LADDER9.map((p) => P.blindBehind(p, 9)), [2, 2, 2, 2, 2, 2, 2, 1, 0]);
  assert.deepEqual(P.nestChain('rfi', 9), ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN']);
  // the first-seat exclusion moves FORWARD at limps/raise, which is why LJ|limps and LJ|raise are
  // new legal pairs at nine seats and UTG1 heads the chain
  assert.deepEqual(P.nestChain('limps', 9), ['UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN']);
  assert.deepEqual(P.nestChain('raise', 9), P.nestChain('limps', 9));
  assert.deepEqual(P.nestChain('3bet', 9), []);
  // 9-max LJ is structurally 6-max UTG: same seats behind, of both kinds
  assert.equal(P.behindNonBlind('LJ', 9), P.behindNonBlind('UTG', 6));
  assert.equal(P.blindBehind('LJ', 9), P.blindBehind('UTG', 6));
});

test('positionDisabled yields 21 legal pairs at six seats and 33 at nine — §10 question 1', () => {
  const count = (seats) => P.NODES.reduce((n, node) => n
    + P.seatsFor(seats).filter((pos) => !P.positionDisabled(pos, node, seats)).length, 0);
  assert.equal(count(6), 21);
  assert.equal(count(9), 33);
  // and the three exclusions are the SAME three structural facts at both sizes — no node carries a
  // second exclusion the six-seat table never exposed
  assert.deepEqual(
    P.NODES.map((node) => P.seatsFor(9).filter((pos) => P.positionDisabled(pos, node, 9))),
    [['BB'], ['UTG'], ['UTG'], []],
  );
  assert.equal(P.positionDisabled('BB', 'rfi', 9), 'BB closes the unopened pot by checking');
  assert.equal(P.positionDisabled('UTG', 'limps', 9), 'no one acts before UTG');
});

test('nMax(6) is frozen at 7, and the extrapolated threshold cannot move by an ulp', () => {
  assert.equal(P.nMax(6), 7);
  assert.equal(P.nMax(), 7);
  assert.equal(P.nMax(9), 9);
  // `raw > nMax(seats) + 0.0001` replaced the literal `raw > 7.0001`. If these two doubles were not
  // the same double, 1.19% of the legacy surface could change its badge on a rounding.
  assert.equal(P.nMax(6) + 0.0001, 7.0001);
  // the clamp itself, read through the model: the legacy peak still clamps at 7
  const hot = { pos: 'HJ', node: 'limps', v: 0.9, limpers: 4, straddle: true };
  assert.equal(P.nEff(hot).N, 7);
  assert.equal(P.nEff(hot).extrapolated, true);
  // the same seat reads the SAME raw at nine (HJ has 2 non-blind and 2 blinds behind at both
  // sizes) — what changes is that nMax MOVES, so the clamp releases and the badge goes quiet
  const hot9 = P.nEff({ ...hot, seats: 9 });
  assert.equal(hot9.raw, P.nEff(hot).raw);
  assert.equal(hot9.N, hot9.raw);
  assert.equal(hot9.extrapolated, false);
  // and it still clamps where the nine-seat surface genuinely runs past 9
  const front = P.nEff({ pos: 'UTG1', node: 'limps', v: 0.9, limpers: 4, straddle: true, seats: 9 });
  assert.ok(front.raw > 9);
  assert.equal(front.N, 9);
  assert.equal(front.extrapolated, true);
});

test('ladderConstants returns the legacy objects BY REFERENCE at six seats', () => {
  const six = P.ladderConstants(6);
  assert.equal(six.baseRaise, P.CONSTANTS.baseRaise);
  assert.equal(six.baseR, P.CONSTANTS.baseR);
  assert.equal(P.ladderConstants(), six);
  // and the six legacy values survive bit-for-bit inside the nine-seat objects, at the seat whose
  // structure they describe — 6-max UTG's 0.16 is 9-max LJ's 0.16
  const nine = P.ladderConstants(9);
  P.POSITIONS.forEach((p, i) => {
    const at = P.LADDER9[i + 3];
    assert.equal(nine.baseRaise[at], P.CONSTANTS.baseRaise[p], `baseRaise ${p} -> ${at}`);
    assert.equal(nine.baseR[at], P.CONSTANTS.baseR[p], `baseR ${p} -> ${at}`);
  });
});

test('the two-constants-one-anchor pin: straddle.seat === ladder.earlyStep', () => {
  // §2.3. They are NOT a live reference — I26's whole job is to perturb `straddle.seat`, and a
  // perturbation above 1 flowing into the opening ladder would invert the monotonicity I51(a)
  // requires. The equality is pinned on the SHIPPED constants instead, so they cannot drift.
  assert.equal(P.CONSTANTS.straddle.seat, P.CONSTANTS.ladder.earlyStep);
  assert.equal(P.CONSTANTS.straddle.seatDerivedFrom, 'ladder.earlyStep');
  assert.equal(typeof P.CONSTANTS.straddle.seat, 'number');
  assert.equal(P.CONSTANTS.ladder.baseRaiseRule, 'geometric');
  assert.ok(['flat', 'step'].includes(P.CONSTANTS.ladder.baseRRule));
  assert.equal(P.CONSTANTS.ladder.derived.kind, 'estimate');
  assert.ok(P.CONSTANTS.ladder.anchor.length > 40 && P.CONSTANTS.ladder.flag.length >= 60);
});

test('the nine-seat opening ladder is strictly increasing and derived, never typed', () => {
  const nine = P.ladderConstants(9), es = P.CONSTANTS.ladder.earlyStep;
  const chain = P.nestChain('rfi', 9);
  for (let i = 1; i < chain.length; i++) {
    assert.ok(nine.baseRaise[chain[i]] > nine.baseRaise[chain[i - 1]],
      `baseRaise must increase along the ladder: ${chain[i - 1]} -> ${chain[i]}`);
  }
  // the geometric rule, read off its own anchor rather than off a recorded number
  const lj = P.CONSTANTS.baseRaise[P.POSITIONS[0]];
  assert.equal(nine.baseRaise.UTG2, lj * es);
  assert.equal(nine.baseRaise.UTG1, lj * es * es);
  assert.equal(nine.baseRaise.UTG, lj * es * es * es);
  // baseR under the shipped rule: non-increasing toward the front (flat is the R1 winner)
  for (let i = 1; i < chain.length; i++) {
    if (i <= 3) assert.ok(nine.baseR[chain[i - 1]] <= nine.baseR[chain[i]] + 1e-12,
      `baseR must not rise toward the front: ${chain[i - 1]} vs ${chain[i]}`);
  }
  if (P.CONSTANTS.ladder.baseRRule === 'flat') {
    assert.equal(nine.baseR.UTG, nine.baseR.LJ);
    assert.equal(nine.baseR.UTG1, nine.baseR.LJ);
    assert.equal(nine.baseR.UTG2, nine.baseR.LJ);
  }
});

test('the two retired offenders name their literal seat sets at six seats AND at nine', () => {
  // policy.mjs:1406, the limp-width branch: the literal was BTN || SB || BB
  const limpT3 = (seats) => P.seatsFor(seats)
    .filter((pos) => P.width3For(pos, 'limps', 0.5, 2, { seats }) > 0);
  assert.deepEqual(limpT3(6), ['BTN', 'SB', 'BB']);
  assert.deepEqual(limpT3(9), ['BTN', 'SB', 'BB']);
  // policy.mjs:1914, heroIP: the literal was CO || BTN
  const heroIP = (seats) => P.seatsFor(seats)
    .filter((pos) => P.behindNonBlind(pos, seats) <= 1 && !P.isBlind(pos, seats));
  assert.deepEqual(heroIP(6), ['CO', 'BTN']);
  assert.deepEqual(heroIP(9), ['CO', 'BTN']);
  // the !isBlind half is NOT redundant: the blinds also have nobody non-blind behind them
  assert.equal(P.behindNonBlind('SB', 9), 0);
  assert.equal(P.behindNonBlind('BB', 9), 0);
});

test('seats is in the memo key, inert or not — the envKey trap, one axis later', () => {
  assert.notEqual(P.envKey({ seats: 9 }), P.envKey({ seats: 6 }));
  assert.equal(P.envKey({ seats: 6 }), P.envKey({}));
  assert.equal(P.envKey({ seats: 7 }), P.envKey({}));      // not a ladder, so not a key
  assert.equal(P.envOf({ seats: 6 }), P.envOf({}));         // and the frozen default, by identity
  assert.equal(P.envOf({}).seats, 6);
  assert.equal(P.envOf({ seats: 9 }).seats, 9);
  assert.equal(P.OPERATING_POINT.seats, 6);
  assert.equal(P.envKey(P.OPERATING_POINT), P.envKey({}));
});

test('the ring accessors delegate at six seats and fail CLOSED above the shipped span', () => {
  const cell = { eq: [50, 48, 46, 44, 42, 40, 38] };
  cell.rho = cell.eq.map((e, i) => (e * (i + 2)) / 100);
  // N <= 7 is today's code path, at both sizes, with no payload in sight
  for (const seats of [6, 9]) {
    for (const N of [1, 2.5, 6.75, 7]) {
      assert.equal(P.eqAtSeats(cell, N, seats, undefined, 'K'), P.eqAt(cell.eq, N));
      assert.equal(P.rhoAtSeats(cell, N, seats, undefined, 'K'), P.rhoAt(cell.rho, N));
    }
  }
  // at six seats the accessor is never reached above 7 — it clamps exactly as `eqAt` does today
  assert.equal(P.eqAtSeats(cell, 9, 6, undefined, 'K'), P.eqAt(cell.eq, 9));
  // at nine seats, above the shipped span, a missing payload THROWS rather than reading cells[]
  assert.throws(() => P.eqAtSeats(cell, 8.2, 9, undefined, 'K'), /data\/ring\.json/);
  assert.throws(() => P.rhoAtSeats(cell, 8.2, 9, { cells: {} }, 'K'), /data\/ring\.json/);
  // with the payload, columns 8 and 9 come from the ring and interpolate against column 7
  const ring = { meta: { nMax: 9 }, cells: { K: { eq: [36, 34] } } };
  assert.equal(P.eqAtSeats(cell, 8, 9, ring, 'K'), 36);
  assert.equal(P.eqAtSeats(cell, 9, 9, ring, 'K'), 34);
  assert.equal(P.eqAtSeats(cell, 8.5, 9, ring, 'K'), 35);
  assert.equal(P.rhoAtSeats(cell, 8, 9, ring, 'K'), (36 * 9) / 100);
  assert.equal(P.rhoAtSeats(cell, 9, 9, ring, 'K'), (34 * 10) / 100);
  // a villain-profiled cell is REFUSED rather than silently mixed with unprofiled ring columns
  assert.throws(() => P.eqAtSeats({ ...cell, vpSource: 'lattice' }, 8.2, 9, ring, 'K'), /refusing to mix/);
});

test('skill.mjs is re-keyed by (seats, pos, node) with the six-seat records untouched', () => {
  assert.equal(SK.legalPairs().length, 21);
  assert.equal(SK.legalPairs(6).length, 21);
  assert.equal(SK.legalPairs(9).length, 33);
  const six = SK.widthExceptionsFor(6);
  assert.equal(six.endpoint, SK.WIDTH_ENDPOINT_EXCEPTIONS);
  assert.equal(six.interior, SK.WIDTH_INTERIOR_EXCEPTIONS);
  assert.equal(six.endpoint.length, 6);
  assert.equal(six.interior.length, 11);
  // NINE WAS `null` AT S1 AND IS MEASURED AT S2 (lane K, R5). S1's clause here asserted the `null`
  // — an empty array would have asserted "measured, and there are none" — and what replaces it is
  // the same claim in the other direction: the records exist, they are frozen arrays, and they are
  // NOT `[]`. The refusal itself is kept and re-pointed at a size nobody has measured, which is the
  // property S1 was actually pinning: `{6, 9}` is a SET, and 7 is not in it (V4-PLAN §0.2).
  const nine = SK.widthExceptionsFor(9);
  assert.equal(nine.endpoint, SK.WIDTH_ENDPOINT_EXCEPTIONS_9);
  assert.equal(nine.interior, SK.WIDTH_INTERIOR_EXCEPTIONS_9);
  assert.ok(Object.isFrozen(nine.endpoint) && Object.isFrozen(nine.interior));
  assert.ok(nine.endpoint.length > 0 && nine.interior.length > 0);
  assert.equal(SK.widthExceptionsFor(7), null);
  // and `widthProblems` refuses at an unmeasured size rather than passing vacuously
  assert.equal(SK.widthProblems({}, SK.SKILL_GRID, 7).length, 1);
  // TWELVE NEW PAIRS, TWO DIFFERENT TWELVE (measured at S2, V4-PLAN §10 Q1). Both derivations are
  // pinned here because they DISAGREE, and a run that pinned only one would hide it.
  const at = (seats) => new Set(SK.legalPairs(seats).map(({ pos, node }) => `${pos}|${node}`));
  const six9 = at(6), byKey = [...at(9)].filter((k) => !six9.has(k));
  assert.equal(byKey.length, 12);
  assert.ok(byKey.includes('LJ|limps') && byKey.includes('LJ|raise'));
  // by KEY it is the three new seat names at all four nodes — and NOT R5's enumeration, because
  // `UTG|rfi` and `UTG|3bet` are legal at six seats already and so are not "newly made legal"
  assert.deepEqual([...byKey].sort(), [
    'LJ|3bet', 'LJ|limps', 'LJ|raise', 'LJ|rfi',
    'UTG1|3bet', 'UTG1|limps', 'UTG1|raise', 'UTG1|rfi',
    'UTG2|3bet', 'UTG2|limps', 'UTG2|raise', 'UTG2|rfi',
  ]);
  // by LADDER POSITION — the six-seat table sits at nine-max LJ..BB under the `i+3` embedding — it
  // is R5's own enumeration, and it is the one that describes which measurements are new
  const L6 = P.seatsFor(6), L9 = P.seatsFor(9);
  const embedded = new Set([...at(6)].map((k) => {
    const [pos, node] = k.split('|');
    return `${L9[L6.indexOf(pos) + 3]}|${node}`;
  }));
  const byPosition = [...at(9)].filter((k) => !embedded.has(k));
  assert.equal(byPosition.length, 12);
  assert.deepEqual([...byPosition].sort(), [
    'LJ|limps', 'LJ|raise',
    'UTG1|3bet', 'UTG1|limps', 'UTG1|raise', 'UTG1|rfi',
    'UTG2|3bet', 'UTG2|limps', 'UTG2|raise', 'UTG2|rfi',
    'UTG|3bet', 'UTG|rfi',
  ]);
  // they agree on the count and on the two LJ pairs, and differ on exactly two pairs each way
  assert.equal(byKey.filter((k) => !byPosition.includes(k)).length, 2);
  assert.equal(byPosition.filter((k) => !byKey.includes(k)).length, 2);
});
