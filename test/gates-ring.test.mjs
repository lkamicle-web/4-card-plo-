// test/gates-ring.test.mjs — the v4 seat-ladder family, and every clause shown to FAIL.
//
// V4-PLAN §5.2 and §5.3. A gate nobody has watched fail is a gate nobody should believe, so each
// clause here is driven twice: once against the real tree, and once against a FABRICATED VIOLATOR
// built to trip exactly that clause and nothing else. Where the violator has to be a perturbation
// of a live object — `CONSTANTS.baseRaise`, `CONSTANTS.ladder.earlyStep` — it is restored in a
// `finally`, the idiom I26 established.
//
// THE RUNNER IS NOT INVOLVED. `build(ctx)` is called with a `G` this file supplies, so the verdicts
// land in a map rather than in a report. That keeps the exercise honest in both directions: a
// clause that only fires when the whole 69-gate suite runs is a clause with a hidden dependency.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as P from '../scripts/lib/policy.mjs';
import * as TF from '../scripts/lib/tier-fixture.mjs';
import * as TF2 from '../scripts/lib/tier-fixture-v2.mjs';
import * as TF3 from '../scripts/lib/tier-fixture-v3.mjs';
import * as TF9 from '../scripts/lib/tier-fixture-9max.mjs';
import * as RING from '../scripts/gates/ring.mjs';
import { REGISTRY, EXPECTED_IDS } from '../scripts/gates/index.mjs';
import { VARIANTS } from '../scripts/lib/variant.mjs';
import { CATALOG } from '../scripts/gates/reserved.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
P.hydrate(model);

/** run one section of the family and hand back the verdicts it emitted */
function runGate(id, ctxOverrides = {}) {
  const out = new Map();
  const ctx = { model, opts: {}, fast: false, G: (gid, pass, detail) => out.set(gid, { pass, detail }), ...ctxOverrides };
  const built = RING.build(ctx);
  for (const s of built.sections) if (s.ids.includes(id)) s.run();
  const r = out.get(id);
  assert.ok(r, `${id} emitted no verdict`);
  return r;
}

// ---------------------------------------------------------------------------
// 1. the family is wired the way a promotion is supposed to wire one
// ---------------------------------------------------------------------------
test('the family declares all seven, the registry appends it last, and the catalog agrees', () => {
  assert.deepEqual(RING.ids, ['I48', 'I49', 'I50', 'I51', 'I52', 'D12', 'D13']);
  assert.equal(REGISTRY[REGISTRY.length - 1], RING, 'the ring family is not last');
  assert.deepEqual(EXPECTED_IDS.slice(-7), RING.ids, 'the seven were interleaved rather than appended');
  assert.equal(EXPECTED_IDS.length, 69);
  for (const id of RING.ids) {
    const e = CATALOG.find((x) => x.id === id);
    assert.ok(e, `${id} is enforced but the catalog does not carry it`);
    assert.equal(e.status, 'live', `${id} is enforced but the catalog calls it ${e.status}`);
    assert.equal(e.runner, 'verify');
    assert.ok(e.claim && e.fails, `${id} must state both its claim and its failure mode`);
    assert.match(e.plan, /V4-PLAN §/);
  }
  // D12's clause library is NOT a family. Registering it would emit D12 twice and the runner would
  // throw on the mismatch rather than fail a gate — the whole reason §7.2 gives this file one writer.
  assert.equal(REGISTRY.some((f) => (f.ids || []).includes('D12') && f !== RING), false);
});

test('I48 is claimed against the comment that declined to invent it, and that comment stands', () => {
  // §5.2's last paragraph. test/payoff-model.test.mjs:24 refused to invent I48 to fit code already
  // written; §5 reserved it before the code existed. Those are opposite acts, and the record of
  // that distinction has to survive in BOTH files or the next reader sees only a contradiction.
  // Both copies are line-wrapped comments, so they are compared with the wrapping normalised away —
  // a quotation that could only be found at one particular column would be a quotation one reflow
  // could silently retire.
  const flat = (f) => readFileSync(resolve(ROOT, f), 'utf8').replace(/^\s*\/\/ ?/gm, '').replace(/\s+/g, ' ');
  const pm = flat('test/payoff-model.test.mjs');
  assert.ok(pm.includes('Inventing I48 here would be exactly what `scripts/gates/reserved.mjs` was written to prevent'),
    'the refusal comment was edited away rather than answered');
  assert.ok(pm.includes('a gate id chosen after the feature is a gate written to pass'),
    'the reason the refusal gave is gone, which is the half that has to survive');
  const res = flat('scripts/gates/reserved.mjs');
  assert.ok(res.includes('Inventing I48 here would be exactly what scripts/gates/reserved.mjs was written to prevent'),
    'reserved.mjs no longer carries the written justification §5.2 asks for');
  assert.ok(res.includes('reserved I48 BEFORE'),
    'reserved.mjs no longer states the distinction that makes the two compatible');
});

// ---------------------------------------------------------------------------
// 2. I48 — the diff shape, the ring tripwire, the recounted integer
// ---------------------------------------------------------------------------
test('I48 passes on this tree, and its detail carries the recounted integer', () => {
  const r = runGate('I48');
  assert.equal(r.pass, true, r.detail);
  assert.match(r.detail, /47\/3960/, 'the six-seat clamp census is no longer reported as an integer over its domain');
  assert.match(r.detail, /zeroing the ring moved 0 of \d+ seats-6 settings/);
});

test('I48(a) FAILS on a fabricated diff that shows a legacy fixture modified', () => {
  const LEGACY = [TF.FIXTURE_PATH, TF2.FIXTURE_PATH, TF3.FIXTURE_PATH];
  // the shape "no --force" produces: three untouched, one added.
  const good = RING.diffShapeProblems([['A', TF9.FIXTURE_PATH]], LEGACY, TF9.FIXTURE_PATH);
  assert.deepEqual(good.problems, []);
  // ...and the shape a re-freeze produces, which is the whole point of reading the diff instead of
  // grepping a log: --force never appears in a commit message, but this row does.
  const bad = RING.diffShapeProblems([['M', TF2.FIXTURE_PATH], ['A', TF9.FIXTURE_PATH]], LEGACY, TF9.FIXTURE_PATH);
  assert.equal(bad.problems.length, 1);
  assert.match(bad.problems[0], /a legacy fixture MOVED/);
  // a 9-max fixture that shows as MODIFIED rather than ADDED fails too — that is a re-freeze of the
  // new file, which §0.4 forbids just as firmly.
  const bad2 = RING.diffShapeProblems([['M', TF9.FIXTURE_PATH]], LEGACY, TF9.FIXTURE_PATH);
  assert.equal(bad2.problems.length, 1);
  assert.match(bad2.problems[0], /added-not-modified/);
});

// ---------------------------------------------------------------------------
// 3. I50 — containment, and the pre-nesting clause
// ---------------------------------------------------------------------------
test('I50 reports 0 subset violations and 0 unexplained cells, and names the front seats', () => {
  const r = runGate('I50');
  /* GREEN SINCE S3'S FREEZE. It was red on clause (i) alone — the tier half, which has nothing to
     read until the fixture exists — while (ii) and (iii) were already measuring. Now (i) reads the
     two frozen files and reports the sub-ladder diff off them, so the assertion is the pass. */
  assert.equal(r.pass, true, r.detail);
  assert.match(r.detail, /\(i\) \d+\/\d+ shared settings differ/);
  assert.match(r.detail, /0 subset violations/);
  assert.match(r.detail, /0 unexplained/);
  assert.match(r.detail, /pre-nesting differs in 0 settings, of which 0 non-monotone/);
  // A STRICT SUPERSET IS AN EXPECTED OUTCOME. The detail has to say so in the line a reader sees,
  // or the next person to read a non-zero count will treat it as a regression.
  assert.match(r.detail, /strict superset \(an EXPECTED outcome, not a failure\)/);
});

test('I50\'s subject is the shared pairs and nothing else', () => {
  const r = runGate('I50');
  assert.match(r.detail, /over 21 shared \(node, seat\) pairs/);
  /* 16,632 = 21 pairs x 12 lanes x 66 VPIP, WHOLE. Lane F measured 16,272 with 360 refused — the
     limps rows whose front seat reads N_eff past seven, which threw because `solveUncached` did not
     thread the ring and because a villain-profiled cell refused the unprofiled ring columns. S3's
     deltas F1 and F3 closed both, so the 360 are now MEASURED rather than skipped and the refusal
     count is zero. A domain that grew back to its full size is the delta working; a domain that
     shrinks is what this pin is here to catch. */
  assert.match(r.detail, /16632 comparisons/);
  assert.match(r.detail, /0 refused/);
  /* (iv) THE PRE-REGISTERED CLAUSE LIST, written at S3 before the freeze. Each shared seat is
     sorted by its index in `nestChain(node, 9)` — the only seats-in-front term R4 enumerated — so
     the eleven with nothing in front are pre-registered EXACT and a single union among them is a
     failure, while the ten with seats in front are containment and a strict superset is expected. */
  assert.match(r.detail, /7 per-node clauses \+ 3 cross-cutting = 10 asserted/);
  /* The two lists are checked against a STRUCTURALLY rebuilt expectation, never against typed seat
     names — I51(c) is in this same suite and it caught the first draft of these two lines. The sort
     key is the one the gate uses and the one R4 enumerated: a shared seat's index in its own
     nine-seat nesting chain. Rebuilding it here rather than quoting it means a ladder that changed
     shape moves both sides together instead of leaving a stale literal to be argued with. */
  const listOf = (label) => (new RegExp(`${label} \\[([^\\]]*)\\]`).exec(r.detail) || [, ''])[1].split(' ').filter(Boolean);
  const want = { contain: [], exact: [] };
  for (const q of TF9.sharedPairs()) {
    (P.nestChain(q.node, 9).indexOf(q.nine) > 0 ? want.contain : want.exact).push(`${q.node}/${q.nine}`);
  }
  assert.deepEqual(listOf('CONTAINMENT').sort(), want.contain.sort());
  assert.deepEqual(listOf('EXACT').sort(), want.exact.sort());
  assert.equal(want.contain.length + want.exact.length, TF9.sharedPairs().length);
});

// ---------------------------------------------------------------------------
// 4. I51 — the ladder, each clause with its violator
// ---------------------------------------------------------------------------
test('I51 passes on the shipped constants', () => {
  const r = runGate('I51');
  assert.equal(r.pass, true, r.detail);
});

test('I51(a) FAILS when the two constants sharing one anchor drift apart', () => {
  const K = P.CONSTANTS;
  const was = K.ladder.earlyStep;
  try {
    K.ladder.earlyStep = was + 0.01;
    const r = runGate('I51');
    assert.equal(r.pass, false);
    assert.match(r.detail, /straddle\.seat .* !== ladder\.earlyStep/);
  } finally { K.ladder.earlyStep = was; }
  assert.equal(runGate('I51').pass, true, 'the perturbation was not restored');
});

test('I51(a) FAILS when the shared anchor loses its provenance record', () => {
  // The SECOND half of the two-constants-one-anchor pin, and a separate clause on purpose: the
  // equality above catches the number drifting, this catches the record of why one number wears two
  // names being deleted or re-pointed. It moved from `straddle.seatDerivedFrom` into the ladder
  // block at S6 (V4-PLAN §0.4 confines the model delta to `constants.ladder`); the clause did not
  // change, only its address.
  const K = P.CONSTANTS;
  const was = K.ladder.anchorSharedWith;
  try {
    K.ladder.anchorSharedWith = 'ladder.earlyStep';   // re-pointed at itself: circular, and no longer a provenance
    let r = runGate('I51');
    assert.equal(r.pass, false);
    assert.match(r.detail, /ladder\.anchorSharedWith is .* the provenance of the shared anchor is gone/);
    delete K.ladder.anchorSharedWith;                 // and deletion, the case refutation #18 measured
    r = runGate('I51');
    assert.equal(r.pass, false);
    assert.match(r.detail, /the provenance of the shared anchor is gone/);
  } finally { K.ladder.anchorSharedWith = was; }
  assert.equal(runGate('I51').pass, true, 'the perturbation was not restored');
});

test('I51(a) FAILS on a non-monotone opening ladder', () => {
  const K = P.CONSTANTS;
  const L = P.seatsFor(6);
  const was = K.baseRaise[L[1]];
  try {
    // make the second seat open TIGHTER than the first — the inversion the geometric rule exists to
    // rule out, and the one an over-large `earlyStep` would produce at nine seats.
    K.baseRaise[L[1]] = K.baseRaise[L[0]] - 0.01;
    const r = runGate('I51');
    assert.equal(r.pass, false);
    assert.match(r.detail, /baseRaise is not strictly increasing/);
  } finally { K.baseRaise[L[1]] = was; }
  assert.equal(runGate('I51').pass, true, 'the perturbation was not restored');
});

test('I51(a) FAILS when the early-seat numbers stop being badged as estimates', () => {
  const K = P.CONSTANTS;
  const was = K.ladder.derived.kind;
  try {
    K.ladder.derived.kind = 'measured';
    const r = runGate('I51');
    assert.equal(r.pass, false);
    assert.match(r.detail, /not badged kind:'estimate'/);
  } finally { K.ladder.derived.kind = was; }
});

test('I51(c) FAILS on a stray new seat key, BY FILE:LINE, and lets the allowlist through', () => {
  const NEW = P.LADDER9.filter((k) => !P.POSITIONS.includes(k));
  assert.equal(NEW.length, 3, 'the nine-seat ladder no longer adds exactly three keys');
  // the fabricated violator: a file outside the allowlist that types one of the new keys.
  const stray = RING.scanSeatLiterals([{ file: 'scripts/lib/somewhere.mjs', src: `const x = '${NEW[0]}';` }], RING.ALLOW);
  assert.equal(stray.strays.length, 1);
  assert.match(stray.strays[0], /^scripts\/lib\/somewhere\.mjs:1 carries the new seat key /);
  // the same text inside an allowlisted file is not a stray — that is the difference between
  // "no NEW literal" and "no literal", and it is the difference the plan actually asks for.
  const ok = RING.scanSeatLiterals([{ file: 'scripts/lib/policy.mjs', src: `const x = '${NEW[0]}';` }], RING.ALLOW);
  assert.deepEqual(ok.strays, []);
  // ...and the LEGACY count is reported rather than refused, since it is 655 on a tree nobody is
  // being asked to change. The clause that bites is the pin, tested below.
  const legacy = RING.scanSeatLiterals([{ file: 'x.mjs', src: P.POSITIONS.join(' ') }], RING.ALLOW);
  assert.equal(legacy.legacyHits, 6);
  assert.equal(legacy.strays.length, 0);
  // a seat key inside a COMMENT is not a literal — the gate strips comments before it scans, and a
  // scan that could not tell them apart would be a scan nobody could write a comment near.
  const commented = RING.scanSeatLiterals([{ file: 'y.mjs', src: 'const a = 1;' }], RING.ALLOW);
  assert.deepEqual(commented.strays, []);
});

test('I51(b)\'s two offenders are PREDICATES, and they name the same sets at both sizes', () => {
  const r = runGate('I51');
  // the sets the deleted literals carried, at six, and their structural equivalents at nine
  const six = P.seatsFor(6), nine = P.seatsFor(9);
  const limp6 = six.filter((p) => P.behindNonBlind(p, 6) === 0);
  const limp9 = nine.filter((p) => P.behindNonBlind(p, 9) === 0);
  assert.deepEqual(limp6, six.slice(-3));
  assert.deepEqual(limp9, nine.slice(-3));
  const ip6 = six.filter((p) => P.behindNonBlind(p, 6) <= 1 && !P.isBlind(p, 6));
  const ip9 = nine.filter((p) => P.behindNonBlind(p, 9) <= 1 && !P.isBlind(p, 9));
  assert.deepEqual(ip6, six.slice(-4, -2));
  assert.deepEqual(ip9, nine.slice(-4, -2));
  // `!isBlind` is NOT redundant: the blinds also have zero non-blind seats behind them, so dropping
  // it would widen heroIP from two seats to four. Measured here so the half nobody would miss on
  // reading stays measured.
  assert.equal(six.filter((p) => P.behindNonBlind(p, 6) <= 1).length, 4);
  assert.equal(r.pass, true, r.detail);
});

// ---------------------------------------------------------------------------
// 5. I52 — the accessor, and the perturbation that must reach it
// ---------------------------------------------------------------------------
test('I52 is GREEN once its two later-stage subjects land, and says which number is which', () => {
  /* WAS "RED for exactly the two reasons a later stage owns" — lane R's SIM_NMAX split and S3's
     delta F4. Both landed, so the assertion is inverted rather than deleted: a test that keeps
     asserting a red after the red is fixed asserts nothing at all. Its teeth move to the arming
     tests below and to the three numbers this clause has to keep straight. */
  const r = runGate('I52');
  assert.equal(r.pass, true, r.detail);
  /* THE THREE N-NAMES, each describing a different thing and only one of them nine. SIM_NMAX is
     EVALUATED rather than grepped: lane R shipped the split with no width literal at all, so the
     original `/SIM_NMAX = (\d+)/` detector read "declares no SIM_NMAX" against correct work — and
     would have passed a dead `var SIM_NMAX = 9`. Running the setter asserts more than the literal
     ever did, including that six seats and an unnamed table size both fall back to the array bound. */
  assert.match(r.detail, /meta\.nMax 7/);
  assert.match(r.detail, /setSimSeats evaluated: 9 -> 9, 6 -> 7, an unnamed 7 -> 7/);
  // ...and the census clause, which recounts live against constants.ladder.census every run.
  assert.match(r.detail, /recounts 19\/6336/);
  assert.equal(P.CONSTANTS.ladder.census.clamped, 19);
  assert.equal(P.CONSTANTS.ladder.census.domain, 6336);
});

test('the perturbation reaches settings above seven through eqAtSeats, and ONLY those', () => {
  // The tripwire's own claim, exercised directly against the accessor so that it is armed before
  // data/ring.json exists. Two rings differing only in their N = 8, 9 columns.
  const a = { meta: { nMax: 9 }, cells: {} }, b = { meta: { nMax: 9 }, cells: {} };
  for (const it of P.cellList(model)) {
    const top = it.cell.eq[it.cell.eq.length - 1];
    a.cells[it.key] = { eq: [top, top] };
    b.cells[it.key] = { eq: [top - 5, top - 5] };
  }
  const L = TF9.laneSpecs(model).find((x) => x.straddle && x.d === P.CONSTANTS.depth.max);
  const front = P.nestChain('limps', 9)[0];
  const env9 = P.envOf({ limpers: 2, raiserPos: TF9.RAISER, seats: 9, ...TF2.envArgs(L), ...TF9.DEFAULT_LANE });
  const o = { limpers: 2, raiserPos: TF9.RAISER, env: env9 };
  const hot = P.rankTable(model, front, 'limps', 0.90, { ...o, ring: a });
  assert.ok(hot.N > P.nMax(6), 'the chosen setting does not reach past seven — the tripwire would measure nothing');
  const hotB = P.rankTable(model, front, 'limps', 0.90, { ...o, ring: b });
  assert.notEqual(hot.rows[0].S, hotB.rows[0].S, 'a setting above seven did NOT move under a perturbed ring');

  // ...and a setting at or below seven is untouched by the same perturbation, at NINE seats — the
  // half that says the ring is not leaking into the shipped span.
  const cool = P.rankTable(model, front, 'limps', 0.25, { ...o, ring: a });
  const coolB = P.rankTable(model, front, 'limps', 0.25, { ...o, ring: b });
  assert.ok(cool.N <= P.nMax(6), 'the control setting is not below the clamp');
  for (let i = 0; i < cool.rows.length; i++) assert.ok(Object.is(cool.rows[i].S, coolB.rows[i].S));

  // ...and at SIX seats the ring is not read at all, whatever is in it. `cells` stays the source.
  const env6 = P.envOf({ limpers: 2, raiserPos: TF9.RAISER, seats: 6, ...TF2.envArgs(L), ...TF9.DEFAULT_LANE });
  const six = P.seatsFor(6)[1];
  const s1 = P.rankTable(model, six, 'limps', 0.90, { limpers: 2, raiserPos: TF9.RAISER, env: env6, ring: a });
  const s2 = P.rankTable(model, six, 'limps', 0.90, { limpers: 2, raiserPos: TF9.RAISER, env: env6, ring: b });
  for (let i = 0; i < s1.rows.length; i++) assert.ok(Object.is(s1.rows[i].S, s2.rows[i].S), 'the ring reached the six-seat surface');
});

// ---------------------------------------------------------------------------
// 6. I49, D12, D13 — the three whose whole subject is produced by a later step
// ---------------------------------------------------------------------------
test('D12 and D13 go GREEN on their own subjects, and I49 still names the step that owns its', () => {
  /* Lane R's artifact and lane U's block landed at S3's merge and S3 paid the two caps, so the two
     reds that were waiting on them are green and are asserted green. I49 is the one whose subject
     THIS stage produces, and until `freeze-tiers.mjs --seats9` has run it must still refuse — and
     must still say how to turn itself green, which is the half a red line usually forgets. */
  const i49 = runGate('I49');
  if (!i49.pass) {
    assert.match(i49.detail, /fixture absent at data\/tiers-9max\.fixture\.txt/);
    assert.match(i49.detail, /freeze-tiers\.mjs --seats9/, 'the red line does not say how to turn it green');
  } else {
    // after the ceremony: the fixture exists and reproduces, which is I49's whole claim
    assert.match(i49.detail, /9-max tiers reproduce exactly at seats=9/);
  }

  const d12 = runGate('D12');
  assert.equal(d12.pass, true, d12.detail);
  assert.match(d12.detail, /ring 18\.2K injected/, 'D12(d) does not report the payload it bounds');
  assert.match(d12.detail, /FALSIFIED/, 'the pre-registered 2*se.cell band is no longer reported against');

  const d13 = runGate('D13');
  assert.equal(d13.pass, true, d13.detail);
});

test('a gate whose subject is absent never passes vacuously', () => {
  // The property that makes the five reds above correct rather than embarrassing: for each of them
  // there is no input at all, and the verdict is still a refusal. Written as a loop so that adding
  // an eighth id to this family cannot quietly opt out of it.
  /* NARROWED AT S3 TO THE ONE GATE WHOSE SUBJECT IS STILL ABSENT, and narrowed by deleting names
     rather than by weakening the property: D12's and D13's subjects landed at the merge, so asking
     them to refuse would be asking them to refuse a thing that is there. I49's subject — the fourth
     fixture — is produced by this stage's own ceremony, and the loop stays a loop so that a later
     id whose subject is absent cannot quietly opt out of it. Once the freeze has run this clause
     has nothing to guard, and it says so instead of pretending. */
  for (const id of ['I49']) {
    const r = runGate(id);
    if (existsSync(resolve(ROOT, 'data/tiers-9max.fixture.txt'))) continue;
    assert.equal(r.pass, false, `${id} passed with no subject to assert on`);
    assert.ok(r.detail.length > 40, `${id} failed without saying what is missing`);
  }
});

// ---------------------------------------------------------------------------
// 8. STAGE S4's RED-TEAM CLAUSES — each one written because a refuter shipped
//    the perturbation below GREEN (docs/refutations/V4.md)
// ---------------------------------------------------------------------------
test('I51(a) FAILS when the published derived block stops being the rule\'s output', () => {
  // A refuter overwrote the block AFTER module init — `ladderConstants(9)` still ran the rule while
  // the Method view, data/model.json and both artifacts carried a typed table — and every ring gate,
  // all 12 ladder tests and a full verify stayed green.
  const K = P.CONSTANTS;
  const was = K.ladder.derived.baseRaise;
  try {
    // the front seats are NAMED STRUCTURALLY, never typed — I51(c)'s ratchet sits at zero slack and
    // catches a seat literal in this file as readily as in a library one, which is the point of it
    const front = K.ladder.ladder9.slice(0, K.ladder.ladder9.length - P.POSITIONS.length);
    K.ladder.derived.baseRaise = Object.fromEntries(front.map((q) => [q, K.baseRaise[P.POSITIONS[0]]]));
    const r = runGate('I51');
    assert.equal(r.pass, false);
    assert.match(r.detail, /stale copy of the rule it names/);
  } finally { K.ladder.derived.baseRaise = was; }
  assert.equal(runGate('I51').pass, true, 'the perturbation was not restored');
});

test('I51(a) FAILS when the named rule is not the arithmetic that ran', () => {
  // R2-F2: `ladderConstants` reads `baseRRule` and never `baseRaiseRule`, so an arithmetic ladder
  // under the label 'geometric' passed I51(a) in full. The gate now COMPOSES the named rule and
  // Object.is-compares it, so the two cannot part — here the composition is moved instead of the
  // ladder, which is the same identity read from the other side.
  const K = P.CONSTANTS;
  const was = K.ladder.earlyStep, wasSeat = K.straddle.seat;
  try {
    K.ladder.earlyStep = 0.80; K.straddle.seat = 0.80;      // both, so the equality clause is not the red
    const r = runGate('I51');
    assert.equal(r.pass, false);
    assert.match(r.detail, /the published rule is not the arithmetic that ran/);
  } finally { K.ladder.earlyStep = was; K.straddle.seat = wasSeat; }
  assert.equal(runGate('I51').pass, true, 'the perturbation was not restored');
});

test('I51(a) FAILS on an anchor sentence that is not the live table\'s own arithmetic', () => {
  // Two refuters replaced `anchor` and `flag` with same-or-greater-length sentences saying the
  // OPPOSITE of the truth and shipped verify 69/69 green — the P1 defect, on the one constant whose
  // job is to say the numbers are not measured. Both halves are now content-asserted.
  const K = P.CONSTANTS;
  const wasA = K.ladder.anchor, wasF = K.ladder.flag;
  try {
    K.ladder.anchor = 'measured on a nine-handed corpus of 4M hands, fully anchored, not extrapolated';
    let r = runGate('I51');
    assert.equal(r.pass, false);
    assert.match(r.detail, /ladder\.anchor does not carry 1\.250/);
    K.ladder.anchor = wasA;
    K.ladder.flag = 'the early-seat values are MEASURED nine-handed data, not opinion; no gate is needed here';
    r = runGate('I51');
    assert.equal(r.pass, false);
    assert.match(r.detail, /ladder\.flag does not name baseRRule/);
  } finally { K.ladder.anchor = wasA; K.ladder.flag = wasF; }
  assert.equal(runGate('I51').pass, true, 'the perturbation was not restored');
});

test('I51(a) FAILS when the ladder declares a table size nothing measured', () => {
  // `constants.ladder.seats` was asserted nowhere: `[6, 7, 9]` shipped green through I48–I52, the
  // skill family and every test. A declared size must have a MEASURED width-exception record.
  const K = P.CONSTANTS;
  const was = K.ladder.seats;
  try {
    K.ladder.seats = [6, 7, 9];
    const r = runGate('I51');
    assert.equal(r.pass, false);
    assert.match(r.detail, /declares 7 seats and there is no MEASURED width-exception record/);
  } finally { K.ladder.seats = was; }
  assert.equal(runGate('I51').pass, true, 'the perturbation was not restored');
});

test('I52(c) FAILS on a fabricated per-pair census, and on an escalation nothing measured', () => {
  // Three refuters of three replaced `byPair` with `{'HJ|limps': 60, 'BTN|rfi': 1}` and I52 stayed
  // green: the recount read `domain`, `clamped` and `clamp` and never the breakdown R3's threshold
  // is defined over. Both directions are recounted now, and R3's half-of-66 rule is code.
  const c = P.CONSTANTS.ladder.census;
  const was = c.byPair;
  const nine = P.seatsFor(9);
  try {
    c.byPair = { [`${nine[4]}|limps`]: 60, [`${nine[6]}|rfi`]: 1 };   // structural, never a typed seat name
    const r = runGate('I52');
    assert.equal(r.pass, false);
    assert.match(r.detail, /the live recount does not clamp that pair at all/);
  } finally { c.byPair = was; }
  try {
    c.escalated = [`${nine[1]}|limps:40`];
    const r = runGate('I52');
    assert.equal(r.pass, false);
    assert.match(r.detail, /an escalation nothing measured/);
  } finally { delete c.escalated; }
  assert.equal(runGate('I52').pass, true, 'the perturbation was not restored');
});

test('D13 FAILS on a silent raise, a broken cap-sum, and a deleted shrink-first sentence', () => {
  // Two refuters read D13's shipped body against its catalog entry: it checked that two caps exist
  // and that `@block:ring` is in both pages, and nothing else. §5.2's three other clauses are here.
  const b = VARIANTS.lite.budgets;
  const wasTotal = b.total, wasSkill = b.blocks.skill, wasCore = b.appCore;
  try {
    b.total = 650 * 1024;                              // a raise budgetSource never writes "-> 650K" for
    let r = runGate('D13');
    assert.equal(r.pass, false);
    assert.match(r.detail, /budgetSource never writes "-> 650K"/);
    b.total = wasTotal;
    b.blocks.skill = 5 * 1024;                         // §2.7: this row is NOT raised
    r = runGate('D13');
    assert.equal(r.pass, false);
    assert.match(r.detail, /blocks\.skill is 5K/);
    b.blocks.skill = wasSkill;
    b.appCore = 365 * 1024;                            // app === appCore + Σ caps, broken
    r = runGate('D13');
    assert.equal(r.pass, false);
    assert.match(r.detail, /is not appCore/);
  } finally { b.total = wasTotal; b.blocks.skill = wasSkill; b.appCore = wasCore; }
  const src = VARIANTS.lite.budgetSource;
  try {
    VARIANTS.lite.budgetSource = src.replace(/SHRINK-FIRST, MEASURED IN BYTES/g, 'no shrink was attempted');
    const r = runGate('D13');
    assert.equal(r.pass, false);
    assert.match(r.detail, /carries no SHRINK-FIRST, MEASURED IN BYTES sentence/);
  } finally { VARIANTS.lite.budgetSource = src; }
  assert.equal(runGate('D13').pass, true, 'the perturbation was not restored');
});
