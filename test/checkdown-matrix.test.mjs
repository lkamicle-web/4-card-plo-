// test/checkdown-matrix.test.mjs — VALIDATE BEFORE USE (spike S-A's hard rule).
//
// S-A's memo states the rule and the reason in the same breath: "*Any* P2 payoff sampler must be
// validated against the shipped `eq` column first." It says that because its own first cut was
// WRONG — it redrew a cell's combo when the combo collided with the board, which is a different
// probability measure, and against the shipped column it read **+1.16 pt high on average and
// +5.33 pt high on RUN0_HIGH|RB**. Nothing crashed. Nothing looked odd. A bias larger than every
// effect v3 intends to model shipped past every structural check there was, because the structural
// checks (antisymmetry, conservation) are all satisfied by a wrong sampler too.
//
// So this file is not a unit test of a data structure. It is the validation gate that stands
// between `scripts/lib/checkdown-matrix.mjs` and the solver, and it runs on THE SEEDS THAT SHIP.
//
// WHAT IS ASSERTED AND WHAT IS REPORTED, kept apart on purpose:
//
//   ASSERTED, structurally — antisymmetry to the bit, the diagonal exactly 0.5, conservation at
//   50.0000, the undealable set and its ace arithmetic, and the SIGN of the card-removal residual
//   as a family-mean comparison.
//   REPORTED, beside S-A's own readings — the residual band (mean / p95 / max) and the per-entry
//   `se` from the two independent samples. Both are at S-A's own 400,000 boards now, so the two
//   columns are directly comparable; they are still REPORTED, because asserting a band would be
//   inventing a tolerance out of two samples no matter how close they land.
//
// WHAT THIS FILE VALIDATES, SINCE THE RELAUNCH: THE ARTIFACT. The shipped pair is generated once by
// `scripts/generate-checkdown-matrix.mjs` and committed as `data/checkdown-matrix.json` (V3-PLAN
// §3.3's `Adjudicated (P3 relaunch)` block), so `shippedMatrices()` READS it — the validation runs
// against the bytes that ship rather than against a rebuild that might differ from them. The
// builder's own mechanics are exercised separately, on a TINY board count: determinism from a seed
// name, a different name giving a different sample, and the sit-out measure. A 400,000-board build
// inside a test process would cost 40 s to re-prove what the generator's `--check` proves properly.
//
// COST: milliseconds — one JSON read and its content hash.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  shippedMatrices, buildMatrix, marginals, conservation, undealablePairs, indexOf,
  serialize, deserialize, sourceHash,
  SEEDS, BOARDS, ARTIFACT, GENERATOR,
} from '../scripts/lib/checkdown-matrix.mjs';
import { aceFloor } from '../scripts/gates/payoff.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));

/** the pair that ships, READ from the artifact once for this process */
const [A, B] = shippedMatrices();

/** S-A's own readings, at the same 400,000 boards — the yardstick, never the bar */
const SA = { mean: -0.112, p95: 0.577, max: 0.827, perEntrySe: 0.143, undealable: 43, mass: 3.6e-5 };

/** the four ace-holding families S-A named as reading low */
const ACE_FAMILIES = ['BIGPAIR_ACE', 'ACE_JUNK', 'SMPAIR_ACE', 'ACE_RUN3'];

function residualStats(m) {
  const mg = marginals(m);
  const d = m.keys.map((k, i) => mg[i] - MODEL.cells[k].eq[0]);
  const abs = d.map(Math.abs).sort((x, y) => x - y);
  const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const isAce = (k) => ACE_FAMILIES.includes(k.split('|')[0]);
  return {
    d,
    mean: avg(d),
    p95: abs[Math.floor(0.95 * (abs.length - 1))],
    max: abs[abs.length - 1],
    aceMean: avg(d.filter((_, i) => isAce(m.keys[i]))),
    aceN: m.keys.filter(isAce).length,
    restMean: avg(d.filter((_, i) => !isAce(m.keys[i]))),
    byFamily: ACE_FAMILIES.map((f) => [f, avg(d.filter((_, i) => m.keys[i].split('|')[0] === f))]),
  };
}

// ---------------------------------------------------------------------------
// the construction is the shipped one
// ---------------------------------------------------------------------------

test('the shipped pair is two INDEPENDENTLY NAMED samples at the declared board budget', () => {
  assert.equal(SEEDS.length, 2);
  assert.deepEqual([A.meta.seed, B.meta.seed], [...SEEDS],
    'the seeds are NAMES, fixed in the source before anything was solved on them');
  assert.equal(A.meta.boards, BOARDS);
  assert.equal(B.meta.boards, BOARDS);
  // 400,000 is the regime `solver.twoSeedTolPot` was ANCHORED at — S-A measured the 0.035% payoff-
  // axis spread the 0.15% gate quotes at exactly this count. It is not a band endpoint anybody
  // preferred: the first B2 run shipped 25,000 (the top of S-A's out-of-sample exploitability
  // table, a DIFFERENT table) and the live payoff axis read 0.1508% against the 0.15% gate.
  // V3-PLAN §3.3's `Adjudicated (P3 relaunch)` block moved the count into the anchor's regime
  // rather than moving the tolerance.
  assert.equal(BOARDS, 400000, "the board count solver.twoSeedTolPot's own anchor was measured at");
  assert.equal(A.NC, 123, 'the abstraction is the 123 non-empty cells');
  assert.deepEqual([...A.keys], [...B.keys], 'and the two samples index it identically');
  assert.notEqual(A.E[1], B.E[1], 'two seeds must actually give two matrices, or the axis is vacuous');
});

test('the ARTIFACT is what the code says it is — meta, hashes, and the shape of its counters', (t) => {
  const body = JSON.parse(readFileSync(resolve(ROOT, ARTIFACT), 'utf8'));
  assert.deepEqual(body.meta.seeds, [...SEEDS]);
  assert.equal(body.meta.boards, BOARDS);
  assert.equal(body.meta.generator, GENERATOR);
  assert.equal(body.meta.generatorHash, sourceHash(),
    'the artifact records WHICH CODE built it; a mismatch means the construction moved and the '
    + 'matrix on disk is no longer the one this checkout describes');
  const recomputed = createHash('sha256')
    .update(JSON.stringify({ ...body, meta: { ...body.meta, contentHash: '' } })).digest('hex');
  assert.equal(body.meta.contentHash, recomputed, 'and its own bytes have not been edited since');
  assert.equal(body.keys.length, A.NC);
  const np = (A.NC * (A.NC - 1)) / 2;
  for (const sm of body.samples) {
    assert.equal(sm.wins2.length, np);
    assert.equal(sm.cnt.length, np);
    assert.equal(sm.den.length, np);
    assert.equal(sm.cellLive.length, A.NC);
    assert.ok(sm.wins2.every((w, k) => Number.isInteger(w) && w >= 0 && w <= 2 * sm.cnt[k]),
      'every triangle entry satisfies 0 <= wins2 <= 2*cnt, which is what lets it mirror');
  }
  t.diagnostic(`${ARTIFACT}: ${body.samples.length} samples x ${np} pairs at `
    + `${body.meta.boards.toLocaleString()} boards, generatorHash ${body.meta.generatorHash.slice(0, 16)}, `
    + `contentHash ${body.meta.contentHash.slice(0, 16)}`);
});

test('the artifact round-trips BIT-IDENTICALLY — E is reconstructed, not re-rounded', () => {
  // `E = (wins2/2)/cnt` divides by a power of two before the only inexact operation, which is why
  // the file can store INTEGER trial counts and still hand back the exact matrix that was measured.
  // Proved here on a small build rather than by rebuilding 400,000 boards: the claim is about the
  // arithmetic, not about the board count.
  const built = buildMatrix({ boards: 400, seed: 'unit/roundtrip' });
  const [back] = deserialize(serialize([built]));
  assert.ok(built.E.every((v, i) => Object.is(v, back.E[i])), 'E survives the round trip to the bit');
  assert.ok(built.N.every((v, i) => v === back.N[i]));
  assert.ok(built.D.every((v, i) => v === back.D[i]));
  assert.ok(built.q.every((v, i) => Object.is(v, back.q[i])));
  assert.equal(back.meta.seed, built.meta.seed);
  assert.equal(back.meta.boards, built.meta.boards);
  assert.equal(back.meta.impossiblePairs.length, built.meta.impossiblePairs.length);
});

test('the build is deterministic from its seed — the name IS the reproduction instruction', () => {
  // 300 boards, not 400,000: determinism is a property of the generator, not of the board count,
  // and a 400k build inside a test process is 40 s spent re-proving what
  // `node scripts/generate-checkdown-matrix.mjs --check` proves against the shipped bytes.
  const a = buildMatrix({ boards: 300, seed: 'unit/determinism' });
  const b = buildMatrix({ boards: 300, seed: 'unit/determinism' });
  assert.deepEqual([...a.E], [...b.E]);
  assert.deepEqual([...a.N], [...b.N]);
  const c = buildMatrix({ boards: 300, seed: 'unit/determinism-2' });
  assert.notDeepEqual([...a.E], [...c.E], 'a different name is a different sample');
  // THE SIT-OUT MEASURE, as a property rather than a description: a cell that collides with the
  // board is NOT redrawn, so it sits the board out — `cellLive` must therefore fall short of the
  // board count, and a pair's disjoint count can never exceed the count of boards both were live on.
  assert.ok([...a.cellLive].every((n) => n > 0 && n < 300),
    'every cell is live sometimes and none is live always — that is what one draw with a sit-out looks like');
  let nGtD = 0;
  for (let i = 0; i < a.NC * a.NC; i++) if (a.N[i] > a.D[i]) nGtD++;
  assert.equal(nGtD, 0, 'disjoint draws are a subset of the boards both cells were live on');
});

// ---------------------------------------------------------------------------
// (1) the exactness clauses — structural, so they must be EXACT
// ---------------------------------------------------------------------------

test('antisymmetry holds to the BIT, and the diagonal is exactly 0.5', () => {
  for (const m of [A, B]) {
    let worstAsym = 0, worstDiag = 0;
    for (let i = 0; i < m.NC; i++) {
      worstDiag = Math.max(worstDiag, Math.abs(m.E[i * m.NC + i] - 0.5));
      for (let j = 0; j < m.NC; j++) {
        worstAsym = Math.max(worstAsym, Math.abs(m.E[i * m.NC + j] + m.E[j * m.NC + i] - 1));
      }
    }
    assert.equal(worstAsym, 0, `${m.meta.seed}: off-diagonals are stored once and MIRRORED, so this `
      + 'is 0 or the solved game is not exactly zero-sum and a non-zero v1 + v2 stops being a solver bug');
    assert.equal(worstDiag, 0, `${m.meta.seed}: two hands from one cell are exchangeable`);
  }
});

test('conservation: the combo-weighted mean equity is 50.0000', (t) => {
  for (const m of [A, B]) {
    const c = conservation(m);
    t.diagnostic(`${m.meta.seed}: combo-weighted mean equity ${c.toFixed(6)} %`);
    // the accumulation bound for NC^2 additions of terms of size ~100 — arithmetic, not a tolerance
    const bound = 100 * m.NC * m.NC * Number.EPSILON;
    assert.ok(Math.abs(c - 50) <= bound, `${m.meta.seed}: ${c} against 50 +/- ${bound}`);
  }
});

// ---------------------------------------------------------------------------
// (2) the marginal reconstruction against the SHIPPED column — S-A's own rule
// ---------------------------------------------------------------------------

test('the q-weighted marginal reproduces the shipped eq[0] column up to the card-removal residual', (t) => {
  for (const m of [A, B]) {
    const s = residualStats(m);
    t.diagnostic(`${m.meta.seed}: residual vs shipped eq[0], pts — mean ${s.mean.toFixed(3)}, `
      + `p95 ${s.p95.toFixed(3)}, max ${s.max.toFixed(3)}   [S-A at 400k boards: mean ${SA.mean}, `
      + `p95 ${SA.p95}, max ${SA.max}]`);
    // A REGRESSION TRIPWIRE, not a tolerance the gates lean on: the per-entry se here is ~4x S-A's,
    // so the band is expected to be noisier — but the redraw bug S-A found read +1.16 pt in the MEAN
    // and +5.33 pt on one cell, so a band an order of magnitude off is a broken sampler, not noise.
    assert.ok(Math.abs(s.mean) < 0.5, `${m.meta.seed}: mean residual ${s.mean}`);
    assert.ok(s.max < 2, `${m.meta.seed}: worst residual ${s.max}`);
  }
});

test('the residual is SIGNED the way card removal predicts — ace-holding families read low', (t) => {
  // S-A: "ace-holding cells (BIGPAIR_ACE, ACE_JUNK, SMPAIR_ACE, ACE_RUN3) read ~0.6 pt LOW, because
  // the shipped number conditions the villain on hero's aces being dead and the q-weighted sum does
  // not". This is robust as a FAMILY MEAN and NOT per cell — individual ace cells go positive even
  // at 400,000 boards, because the residual's spread ACROSS cells is larger than the effect on any
  // one of them — so the assertion is the comparison S-A's own explanation licenses, not a stronger
  // one that would be a coin flip at any budget this repository can pay.
  for (const m of [A, B]) {
    const s = residualStats(m);
    t.diagnostic(`${m.meta.seed}: ace families (${s.aceN} cells) mean ${s.aceMean.toFixed(3)} pt vs `
      + `${s.restMean.toFixed(3)} pt for the other ${m.NC - s.aceN} — `
      + s.byFamily.map(([f, v]) => `${f} ${v.toFixed(3)}`).join(', '));
    assert.ok(s.aceMean < s.restMean,
      `${m.meta.seed}: ace families ${s.aceMean} must read below the rest ${s.restMean}`);
    assert.ok(s.aceMean < 0, `${m.meta.seed}: and below zero — the shipped column reads HIGH there`);
  }
});

// ---------------------------------------------------------------------------
// (3) the structurally undealable pairs — clause (h)'s first live case
// ---------------------------------------------------------------------------

test('43 pairs are structurally undealable, and every one of them asks for aces the deck has not got', (t) => {
  for (const m of [A, B]) {
    const und = undealablePairs(m);
    assert.equal(und.length, SA.undealable, `${m.meta.seed}: S-A found ${SA.undealable} at 400k boards`);
    for (const [a, b] of und) {
      assert.ok(aceFloor(a) + aceFloor(b) >= 5,
        `${a} x ${b} pins only ${aceFloor(a) + aceFloor(b)} aces — that is dealable`);
    }
    assert.ok(Math.abs(m.meta.impossibleMass - SA.mass) < 1e-6,
      `${m.meta.seed}: combo mass ${m.meta.impossibleMass} against S-A's ${SA.mass}`);
    // THE FAMILY, CORRECTED. S-A's memo says "AA_* x A_BLOCKED"; the measurement says 42 of the 43
    // are, and the 43rd is A_BLOCKED|RB x A_BLOCKED|SSA — `A_BLOCKED` is the taxonomy's "Trip/quad
    // aces", so two of those cells pin SIX aces between them.
    const fam = (k) => k.split('|')[0];
    const aaBlocked = und.filter(([a, b]) => (/^AA_/.test(fam(a)) && fam(b) === 'A_BLOCKED')
      || (/^AA_/.test(fam(b)) && fam(a) === 'A_BLOCKED'));
    const blockedBlocked = und.filter(([a, b]) => fam(a) === 'A_BLOCKED' && fam(b) === 'A_BLOCKED');
    assert.equal(aaBlocked.length, 42);
    assert.equal(blockedBlocked.length, 1);
    assert.deepEqual(blockedBlocked[0].slice().sort(), ['A_BLOCKED|RB', 'A_BLOCKED|SSA']);
    t.diagnostic(`${m.meta.seed}: ${und.length} undealable pairs (${aaBlocked.length} AA_* x A_BLOCKED, `
      + `${blockedBlocked.length} A_BLOCKED x A_BLOCKED), combo mass ${m.meta.impossibleMass.toExponential(3)}`);
  }
  // and the set is a property of the DECK, not of the seed
  const key = (m) => undealablePairs(m).map((p) => p.slice().sort().join('#')).sort().join(',');
  assert.equal(key(A), key(B), 'two independent samples must agree on what cannot be dealt at all');
});

test('a four-ace pair is DEALABLE and pays for it in samples, not in a flag', (t) => {
  // The other half of clause (h): degeneracy that is surfaced in the ERROR BAR. AA_* x AA_* pins all
  // four aces, so the boards deal it rarely rather than never, and the honest answer keeps the pair
  // supported with fewer trials behind it.
  const at = indexOf(A);
  const isAA = (k) => /^AA_/.test(k.split('|')[0]);
  let degN = 0, degSum = 0, restN = 0, restSum = 0, degR = [Infinity, 0], restR = 0;
  for (let i = 0; i < A.NC; i++) {
    for (let j = i + 1; j < A.NC; j++) {
      const n = A.N[i * A.NC + j], r = A.R[i * A.NC + j];
      if (isAA(A.keys[i]) && isAA(A.keys[j])) {
        degN++; degSum += n;
        degR = [Math.min(degR[0], r), Math.max(degR[1], r)];
      } else if (n > 0) { restN++; restSum += n; restR += r; }
    }
  }
  const degMean = degSum / degN, restMean = restSum / restN;
  t.diagnostic(`AA_* x AA_*: ${degN} pairs, disjoint rate ${degR[0].toFixed(3)}..${degR[1].toFixed(3)}, `
    + `mean ${degMean.toFixed(0)} samples; the rest: rate ${(restR / restN).toFixed(3)}, `
    + `mean ${restMean.toFixed(0)} samples — se ratio ${Math.sqrt(restMean / degMean).toFixed(2)}x`);
  assert.equal(degN, 210, 'the five AA_* rows over their live columns');
  assert.ok(degR[0] > 0, 'four aces is rare, not impossible');
  assert.ok(degMean < restMean / 2, 'and it costs real samples, which is what the bigger se is made of');
  assert.ok(at['AA_BIGPAIR|DS'] >= 0 && at.__proto__ === undefined,
    'the index is prototype-less, so `__proto__` is an unknown key rather than an inherited answer');
});

// ---------------------------------------------------------------------------
// the per-entry se, from the two independent samples
// ---------------------------------------------------------------------------

test('the per-entry se from the two samples matches what the trial counts predict', (t) => {
  let ss = 0, n = 0, worst = 0;
  let predicted = 0;
  for (let i = 0; i < A.NC; i++) {
    for (let j = i + 1; j < A.NC; j++) {
      const nA = A.N[i * A.NC + j], nB = B.N[i * A.NC + j];
      if (!(nA > 0 && nB > 0)) continue;
      const d = 100 * (A.E[i * A.NC + j] - B.E[i * A.NC + j]);
      ss += d * d; n++;
      if (Math.abs(d) > worst) worst = Math.abs(d);
      const p = A.E[i * A.NC + j];
      predicted += 100 * 100 * (p * (1 - p)) * (1 / nA + 1 / nB);
    }
  }
  const rms = Math.sqrt(ss / n);
  const se = rms / Math.SQRT2;                 // two independent samples of the same entry
  const rmsPredicted = Math.sqrt(predicted / n);
  t.diagnostic(`rms|A-B| ${rms.toFixed(4)} pts over ${n} measured pairs (worst ${worst.toFixed(3)}) `
    + `-> per-entry se ${se.toFixed(4)} pts; binomial arithmetic at the observed counts predicts rms `
    + `${rmsPredicted.toFixed(4)}   [S-A at 400k boards: per-entry se ${SA.perEntrySe}]`);
  // the measured spread must be what the SAMPLE SIZES say it should be — a derived cross-check, not
  // a tolerance: if these disagree, the counts and the values came from different populations.
  assert.ok(Math.abs(rms - rmsPredicted) / rmsPredicted < 0.1,
    `rms|A-B| ${rms} against the binomial prediction ${rmsPredicted}`);
  /* REPORTED, NOT ASSERTED, and the change is the point. At 25,000 boards this file asserted
     `se > SA.perEntrySe` — true then, and true only because the shipped matrices were noisier than
     S-A's by construction. At S-A's own 400,000 boards that inequality is a coin flip between two
     samples of the same size, so asserting it would be asserting which of two equally good
     measurements got unluckier. The derived cross-check above (rms against the binomial arithmetic
     at the observed counts) is the assertion that survives, because it is a statement about the
     construction rather than about a comparison of budgets. */
  t.diagnostic(`per-entry se ${se.toFixed(4)} pts against S-A's ${SA.perEntrySe} at the same `
    + `${BOARDS.toLocaleString()} boards — a ratio of ${(se / SA.perEntrySe).toFixed(2)}x, reported`);
});

test('every cell is live on enough boards to give the diagonal an honest n', () => {
  // The diagonal's VALUE is exact by exchangeability, but I33 clause (d) still wants an `se` derived
  // from trials that ran. `cellLive` is that count and it is the one datum S-A's builder did not keep.
  for (const m of [A, B]) {
    for (let i = 0; i < m.NC; i++) {
      assert.ok(m.cellLive[i] > 0, `${m.keys[i]} was never live — its diagonal se would be Infinity`);
      assert.equal(m.N[i * m.NC + i], m.cellLive[i], 'and it is what the trial-count matrix reports');
    }
    assert.ok(m.meta.minCellLive > m.meta.boards / 2,
      `a cell is live on ~66% of boards; the worst here is ${m.meta.minCellLive} of ${m.meta.boards}`);
  }
});
