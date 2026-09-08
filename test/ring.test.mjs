// ring.test.mjs — the per-call `nMax` option, the ring library, and the shipped artifact.
//
// THE LOAD-BEARING TEST IS THE FIRST ONE, and it is here because V4-PLAN §2.4 asserts something
// about the RNG stream that turns out to be half true. The plan says: "Because `NEED` changes with
// `nMax`, dealing nine villains changes the RNG stream, so the ring's `N = 1..7` prefix is a
// differently-seeded reproduction of the v1 layer rather than a byte-identical one."
//
// Measured, that is right about the CONCLUSION and wrong about the MECHANISM, and the difference is
// worth a test rather than a footnote. `runMulti` deals its first 25 cards from the v1 stream in an
// unconditional loop that does not know how many villains follow, and every villain past the fifth
// is appended by `extraRng` at a strictly higher deck index. So raising the width EXTENDS the deal.
// What actually diverges is the per-trial STRIDE of the second stream: `extraRng` consumes
// `NEED - 25` draws per trial, that count moves with `nMax`, and so from the second trial onward the
// two runs' sixth and seventh villains come from different stream positions. The consequence is
// sharp and asserted below: `eq[0..4]` — N = 1..5, exactly the v1 columns, dealt entirely from the
// first 25 cards — is BIT-IDENTICAL at nMax 7 and 9, while `eq[5..6]` is not. The I22 lockstep that
// protected v1 when the field went 5 -> 7 still holds when it goes 7 -> 9.
//
// That matters beyond pedantry: it is the reason `data/model.json` cannot be perturbed by anything
// the ring does, and it is proof the per-call option did not disturb the frozen layer.
//
// The lattice kernel is the opposite case, and is asserted too: `runMultiFiltered` deals villains
// BEFORE the board and each one consumes a hero-dependent number of draws, so a wider field shifts
// the board every trial and no column survives. That asymmetry is why the ring's `vDelta` baseline
// is its own `runMulti` column and never `model.json`'s.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { enumerateAll } from '../scripts/lib/taxonomy.mjs';
import { fnv1a } from '../scripts/lib/eval5.mjs';
import {
  NMAX, runMulti, runMultiFiltered, startPool, stopPool, runJobs,
} from '../scripts/lib/mc.mjs';
import { classTableCanonical, cutAt } from '../scripts/lib/villain-range.mjs';
import { unpackOrder } from '../scripts/lib/order-pack.mjs';
import {
  ARTIFACT, SEEDS, RING_NMAX, WALL_BUDGET, OUTLIER_SIGMA,
  bandsFor, summarise, contentHashOf, normalise, deserialize, serialize,
} from '../scripts/lib/ring.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));

let E;
const enumeration = () => (E = E || enumerateAll());
function span(key) {
  const P = enumeration();
  const u = P.cellKeys.indexOf(key);
  assert.ok(u >= 0, key);
  return { pool: P.byCell, lo: P.cellStart[u], hi: P.cellStart[u + 1], unit: u };
}

// ---------------------------------------------------------------------------
// the per-call nMax option
// ---------------------------------------------------------------------------

test('runMulti at nine villains EXTENDS the v1 deal: N=1..5 bit-identical, N=6..7 not', () => {
  const { pool, lo, hi } = span('AA_BIGPAIR|DS');
  const args = [pool, lo, hi, 4000, fnv1a('hero|cell|k'), fnv1a('stream|cell'), fnv1a('stream6|cell')];
  const a = runMulti(...args, 7);
  const b = runMulti(...args, 9);
  assert.equal(a.eq.length, 7);
  assert.equal(b.eq.length, 9);

  /* N = 1..5 come out of deck[5..24], dealt by the unconditional 25-card v1 loop. Bit-identical,
     not merely close: the whole I22 argument is that raising the field cannot move a v1 board. */
  for (let k = 0; k < 5; k++) {
    assert.equal(b.eq[k], a.eq[k], `N=${k + 1} must be bit-identical across the field width`);
  }
  /* N = 6, 7 come from `extraRng`, whose per-trial stride is NEED - 25 and therefore moves with
     nMax. Different, and the plan's "changes the RNG stream" is true of exactly these two. */
  assert.notEqual(b.eq[5], a.eq[5], 'N=6 is dealt from the second stream and must move');
  assert.notEqual(b.eq[6], a.eq[6], 'N=7 is dealt from the second stream and must move');
  // the cooler counters read villains 1..3 only, so they cannot move at all
  assert.equal(b.coolNum, a.coolNum);
  assert.equal(b.coolDen, a.coolDen);
});

test('the option DEFAULTS to NMAX, so every v1/v2 call site means what it always meant', () => {
  const { pool, lo, hi } = span('RUN0_LOW|DS');
  const args = [pool, lo, hi, 2000, fnv1a('hero|cell|k'), fnv1a('stream|cell'), fnv1a('stream6|cell')];
  assert.deepEqual(runMulti(...args), runMulti(...args, NMAX));
  assert.equal(runMulti(...args).eq.length, NMAX);
  assert.equal(NMAX, MODEL.meta.nMax, 'the default is still the width model.json is measured at');
});

test('runMultiFiltered has NO surviving prefix: villains come before the board', () => {
  const P = enumeration();
  const ct = classTableCanonical(P.byCell);
  const order = unpackOrder(MODEL.order.packed, MODEL.order.n);
  const cut = cutAt(order, ct.size, P.byCell.length, 55);
  const range = new Uint32Array(cut.cum);
  let w = 0;
  for (let j = 0; j < P.byCell.length; j++) if (cut.keep[ct.cidOf[j]]) range[w++] = P.byCell[j];

  const { pool, lo, hi } = span('AA_BIGPAIR|DS');
  const args = [pool, lo, hi, range, 0.85, 2000, fnv1a('hero|cell|k'), fnv1a('villain|latt|55')];
  const a = runMultiFiltered(...args, 7);
  const b = runMultiFiltered(...args, 9);
  assert.equal(a.eq.length, 7);
  assert.equal(b.eq.length, 9);
  /* Not one column survives — each extra villain consumes draws before the board is dealt. This is
     the asymmetry with runMulti, and it is why the ring's vDelta baseline must be its own. */
  let same = 0;
  for (let k = 0; k < 7; k++) if (a.eq[k] === b.eq[k]) same++;
  assert.equal(same, 0, 'a wider filtered field shifts every column, including N=1');
});

test('a pooled job with no nMax and no tag reproduces the v1 stream exactly', async () => {
  /* The worker body gained two OPTIONAL fields. This is the proof that omitting them is not merely
     "probably fine": a job built the way generate-data.mjs builds it must land on the number a
     direct v1-seeded call lands on, bit for bit, or data/model.json is no longer reproducible. */
  const P = enumeration();
  const { unit } = span('BROADWAY_RUN|RB');
  const key = P.cellKeys[unit];
  const pool = await startPool({
    workers: 1, pools: { cell: P.byCell }, starts: { cell: P.cellStart }, ranges: {}, filtered: {},
  });
  try {
    const [got] = await runJobs(pool, [{
      id: 0, pool: 'cell', unit, kind: 'multi', stage: 'cell', key, trials: 3000,
    }]);
    const want = runMulti(P.byCell, P.cellStart[unit], P.cellStart[unit + 1], 3000,
      fnv1a(`hero|cell|${key}`), fnv1a('stream|cell'), fnv1a('stream6|cell'));
    assert.deepEqual(got.eq, want.eq, 'the untagged, unwidened job is the v1 measurement');
    assert.equal(got.eq.length, NMAX);
  } finally {
    await stopPool(pool);
  }
});

// ---------------------------------------------------------------------------
// the library: bands, summaries, hashing
// ---------------------------------------------------------------------------

test('the bands are DERIVED from se.cell, never typed', () => {
  const b = bandsFor({ cell: 0.16, latt: 0.16 });
  assert.equal(b.preRegistered, 0.32, "§5.2's own band is 2 · se.cell");
  /* stored to 4 dp — they are written into the artifact, so they are compared at the precision the
     artifact carries rather than at float precision */
  assert.ok(Math.abs(b.seDiff - Math.SQRT2 * 0.16) < 1e-4, 'a difference of two samples carries sqrt(2)');
  assert.equal(b.sigma, OUTLIER_SIGMA);
  assert.ok(Math.abs(b.outlier - OUTLIER_SIGMA * b.seDiff) < 1e-3);
  // and they MOVE with se: a band that ignored its input would be a typed number wearing a function
  const half = bandsFor({ cell: 0.08, latt: 0.08 });
  assert.ok(Math.abs(half.seDiff - b.seDiff / 2) < 1e-4);
});

test('the pre-registered 2·se.cell band is unsatisfiable, and the arithmetic says so', () => {
  /* Not a matter of what this run measured. `se.cell` is the error of ONE column; both D12 clauses
     compare TWO, whose difference carries sqrt(2). So the plan's band is 1.41 sigma on the quantity
     it is applied to — and D12(c) compares against the FROZEN shipped layer, so no trial budget on
     the ring's side can push it past 2.02 sigma even in the limit. */
  const se = MODEL.meta.se.cell;
  const b = bandsFor(MODEL.meta.se);
  assert.ok(b.preRegistered / b.seDiff < 1.5,
    `2·se.cell is only ${(b.preRegistered / b.seDiff).toFixed(2)}σ of a two-sample difference`);
  const limit = b.preRegistered / se;                       // the ring's own error driven to zero
  assert.ok(limit < 2.1, `even a perfect ring leaves the band at ${limit.toFixed(2)}σ against the shipped layer`);
});

test('summarise separates bias from spread from the worst reading', () => {
  const rows = [];
  for (let i = 0; i < 100; i++) rows.push({ d: (i % 2 ? 1 : -1) * 0.1, at: `c${i}` });
  const s = summarise(rows, 0.2, 0.16);
  assert.equal(s.n, 100);
  assert.ok(Math.abs(s.mean) < 1e-12, 'a symmetric set has no bias');
  assert.ok(Math.abs(s.rms - 0.1) < 1e-9);
  assert.equal(s.worst, 0.1);
  assert.ok(Math.abs(s.spread - 0.5) < 1e-9, 'spread is RMS in units of seDiff');
  // a shifted set is caught by bias and NOT by spread's ratio alone
  const shifted = rows.map((r) => ({ ...r, d: r.d + 0.5 }));
  const t = summarise(shifted, 0.2, 0.16);
  assert.ok(t.biasSigma > 2, `a 0.5 pt shift must read as bias, got ${t.biasSigma}σ`);
  assert.equal(t.worstAt, shifted.find((r) => Math.abs(r.d) === Math.max(...shifted.map((x) => Math.abs(x.d)))).at);
});

test('the content hash blanks wallSec, so the same measurement hashes the same on any machine', () => {
  const body = {
    note: 'n', meta: { contentHash: '', wallSec: 12.3, a: 1 }, cells: {}, agree: { twoSeed: [], prefix: [] },
  };
  const slow = { ...body, meta: { ...body.meta, wallSec: 999.9 } };
  assert.equal(contentHashOf(body), contentHashOf(slow), 'wall time is a property of the machine');
  assert.notEqual(contentHashOf(body), contentHashOf({ ...body, cells: { x: 1 } }));
  assert.equal(normalise(body), normalise(slow), "--check's compare excludes exactly that field");
  assert.notEqual(normalise(body), normalise({ ...body, meta: { ...body.meta, a: 2 } }));
});

test('deserialize refuses a file that has been edited since it was written', () => {
  const text = serialize({
    meta: { nMax: 9, wallSec: 1 }, cells: { 'X|Y': { eq: [1, 2], vDelta: {} } },
    agree: { twoSeed: [0], prefix: [0] },
  });
  assert.doesNotThrow(() => deserialize(text));
  const tampered = text.replace('"eq":[1,2]', '"eq":[9,2]');
  assert.notEqual(tampered, text);
  assert.throws(() => deserialize(tampered), /fails its own content hash/);
});

// ---------------------------------------------------------------------------
// the shipped artifact
// ---------------------------------------------------------------------------

test('data/ring.json is present, self-consistent and structurally sound', (t) => {
  const path = resolve(ROOT, ARTIFACT);
  if (!existsSync(path)) {
    t.skip(`${ARTIFACT} is not generated in this checkout`);
    return;
  }
  const body = deserialize(readFileSync(path, 'utf8'));   // throws on a bad content hash
  const m = body.meta;
  assert.equal(m.nMax, RING_NMAX);
  assert.deepEqual(m.seeds, [...SEEDS]);
  assert.equal(m.wallBudget, WALL_BUDGET);
  assert.equal(m.model.nMax, MODEL.meta.nMax, 'the ring is beside the model, never spliced into it');
  assert.equal(m.trials.cell, MODEL.meta.trials.cell, 'the same trial regime as generate-data.mjs');
  assert.equal(m.trials.latt, MODEL.meta.trials.latt);
  assert.equal(m.se.cell, MODEL.meta.se.cell);

  const keys = Object.keys(body.cells);
  assert.equal(keys.length, m.cells);
  assert.equal(body.agree.twoSeed.length, keys.length);
  assert.equal(body.agree.prefix.length, keys.length);
  for (const key of keys) {
    const c = body.cells[key];
    assert.equal(c.eq.length, 2, `${key} ships the [N=8, N=9] pair`);
    assert.ok(c.eq[1] <= c.eq[0], `${key}: equity cannot rise with the field size`);
    assert.ok(MODEL.cells[key] && MODEL.cells[key].eq, `${key} is a non-empty model cell`);
    for (const v of m.v) assert.equal(c.vDelta[v].length, 2, `${key} vDelta[${v}]`);
    /* N = 8 sits below the model's own N = 7 for the same cell: the equity curve is monotone across
       the SEAM BETWEEN THE TWO ARTIFACTS, which is the join `eqAtSeats` makes at nine seats and the
       one thing no single artifact can check about itself. Asserted strictly, with no tolerance: the
       two columns are independently seeded, so this could have been marginal and is not — the
       tightest cell clears by 0.700 pt (TRIPS_BIG|RB), about 3.1 sigma of `seDiff`. */
    assert.ok(c.eq[0] < MODEL.cells[key].eq[6], `${key}: the N=7→8 seam must not rise`);
  }
});

test('the shipped ring agrees with itself and with the model, per cell', (t) => {
  const path = resolve(ROOT, ARTIFACT);
  if (!existsSync(path)) {
    t.skip(`${ARTIFACT} is not generated in this checkout`);
    return;
  }
  const body = deserialize(readFileSync(path, 'utf8'));
  for (const [name, arr] of [['twoSeed', body.agree.twoSeed], ['prefix', body.agree.prefix]]) {
    const worst = Math.max(...arr);
    assert.ok(worst <= OUTLIER_SIGMA, `${name}: worst cell reads ${worst}σ, past the ${OUTLIER_SIGMA}σ line`);
    assert.ok(Math.abs(body.meta[name].biasSigma) <= 2, `${name} bias ${body.meta[name].biasSigma}σ`);
    assert.ok(body.meta[name].spread <= 2, `${name} spread ${body.meta[name].spread}x`);
  }
  /* THE PLAN'S PRE-REGISTERED READING, ASSERTED AS FALSIFIED RATHER THAN QUIETLY DROPPED. §5.2 says
     these agree within 2.0 · se.cell on every cell. They do not, and cannot (see the arithmetic
     test above). If a future change ever makes this pass, THIS TEST FAILS — which is the point: the
     falsification stays a measured claim rather than becoming folklore. */
  const worstSE = Math.max(body.meta.twoSeed.worstSE, body.meta.prefix.worstSE);
  assert.ok(worstSE > 2,
    `§5.2's 2·se.cell band now HOLDS at ${worstSE} — re-open V4-PLAN §5.2 D12(b)/(c) and this test`);
});
