// ring-gate.test.mjs — D12, clause by clause, shown to FAIL on a fabricated violator.
//
// A gate nobody has watched fail is a gate nobody knows the shape of. Every clause below is handed
// a ring that is correct in every respect except one, and asserted to refuse it by name. The
// fixture is built by the same `serialize` the generator uses, so a violator is a real artifact with
// a real content hash — not a hand-typed object that would fail clause (a) first and hide the rest.
//
// The two clauses that report rather than assert — the pre-registered `2 · se.cell` readings — are
// covered the other way round: the reading must APPEAR on the report whether it holds or not, and
// must carry the word FALSIFIED when it exceeds 2.0. A falsification that stopped being printed
// would be a falsification quietly deleted, which is the failure this pair of assertions guards.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ringProblems, injectedForm, RING_CEILING_FACTOR } from '../scripts/gates/ring-artifact.mjs';
import { serialize, bandsFor, summarise, SEEDS, RING_NMAX, WALL_BUDGET, OUTLIER_SIGMA } from '../scripts/lib/ring.mjs';
import { ceilingBound } from '../scripts/gates/data.mjs';

const SE = { cell: 0.16, latt: 0.16 };
const V = [25, 40, 55, 70, 90];
const KEYS = ['AA_BIGPAIR|DS', 'RUN0_LOW|DS', 'TRASH|RB'];

/** a ring that passes every clause, then mutated per test */
function goodRing(edit = (b) => b) {
  const bands = bandsFor(SE);
  const cells = {};
  const agree = { twoSeed: [], prefix: [] };
  KEYS.forEach((key, i) => {
    const vDelta = {};
    for (const v of V) vDelta[v] = [-1.2, -1.4];
    cells[key] = { eq: [30 - i, 28 - i], vDelta };
    agree.twoSeed.push(0.4 + i * 0.1);
    agree.prefix.push(0.5 + i * 0.1);
  });
  const rows = [{ d: 0.05, at: 'x N=8' }, { d: -0.04, at: 'y N=9' }];
  const meta = {
    kind: 'test', plan: 'V4-PLAN §2.4', generator: 'scripts/generate-ring.mjs',
    generatorHash: 'GEN', kernelHash: 'KERN', contentHash: '',
    nMax: RING_NMAX, columns: [8, 9], seeds: [...SEEDS],
    trials: { cell: 100000, latt: 100000 }, se: SE, v: [...V], discipline: 0.85,
    cells: KEYS.length, wallBudget: WALL_BUDGET, wallSec: 250,
    model: { hash: 'h', orderHash: 'o', nMax: 7 },
    band: bands,
    twoSeed: summarise(rows, bands.seDiff, SE.cell),
    prefix: summarise(rows, bands.seDiff, SE.cell),
    agreeOrder: 'index-aligned',
  };
  const body = edit({ meta, cells, agree });
  const raw = serialize(body);
  return { body: JSON.parse(raw), raw };
}

const LIVE = { generator: 'GEN', kernel: 'KERN' };
/** budgets pinned exactly at the bound, so only the clause under test can fire */
function budgetsFor(raw) {
  const cap = ceilingBound(Buffer.byteLength(injectedForm(raw)), RING_CEILING_FACTOR);
  return { lite: { ring: cap }, full: { ring: cap } };
}

const run = (r, budgets) => ringProblems(r.body, r.raw, LIVE, budgets || budgetsFor(r.raw));
const fires = (r, re, budgets) => {
  const { problems } = run(r, budgets);
  assert.ok(problems.some((p) => re.test(p)),
    `expected a problem matching ${re}, got:\n  ${problems.join('\n  ') || '(none)'}`);
  return problems;
};

test('the good ring passes every clause', () => {
  const { problems, readings } = run(goodRing());
  assert.deepEqual(problems, [], problems.join('; '));
  assert.ok(readings.length >= 5, 'every clause reports a reading, pass or fail');
});

// -- (a) provenance ------------------------------------------------------------------------------

test('(a) a STALE generatorHash is refused', () => {
  const r = goodRing();
  const { problems } = ringProblems(r.body, r.raw, { generator: 'MOVED', kernel: 'KERN' }, budgetsFor(r.raw));
  assert.ok(problems.some((p) => /STALE: the ring was written by generatorHash/.test(p)));
});

test('(a) a STALE kernelHash is refused — an edit inside mc.mjs\'s worker slice invalidates the ring', () => {
  const r = goodRing();
  const { problems } = ringProblems(r.body, r.raw, { generator: 'GEN', kernel: 'MOVED' }, budgetsFor(r.raw));
  assert.ok(problems.some((p) => /STALE: the ring was measured by kernelHash/.test(p)));
});

test('(a) a hand-edited file fails its own content hash', () => {
  const r = goodRing();
  const raw = r.raw.replace('"eq":[30,28]', '"eq":[99,28]');
  assert.notEqual(raw, r.raw);
  const { problems } = ringProblems(JSON.parse(raw), raw, LIVE, budgetsFor(raw));
  assert.ok(problems.some((p) => /fails its own content hash/.test(p)));
});

// -- (b) meta, shape, structure, two-seed --------------------------------------------------------

test('(b) a renamed seed is refused — a re-rolled measurement, not a rename', () => {
  fires(goodRing((b) => { b.meta.seeds = ['rundown-v4/ring-A', 'rundown-v4/ring-C']; return b; }),
    /meta\.seeds is .* fixed before anything was measured/);
});

test('(b) a wrong meta.nMax is refused', () => {
  fires(goodRing((b) => { b.meta.nMax = 7; return b; }), /meta\.nMax is 7, not 9/);
});

test('(b) an absent se leaves the band unbounded and is refused', () => {
  fires(goodRing((b) => { delete b.meta.se; return b; }), /meta\.se is incomplete/);
});

test('(b) a band that is not a function of the recorded se is refused', () => {
  fires(goodRing((b) => { b.meta.band = { ...b.meta.band, seDiff: 9 }; return b; }),
    /must be a function of the recorded se, never a typed number/);
});

test('(b) EQUITY RISING WITH THE FIELD SIZE is refused with zero tolerance', () => {
  /* The clause that needs no band at all, and the one that catches a column read off by one — the
     mistake a tolerance of any width sails straight past. */
  fires(goodRing((b) => { b.cells[KEYS[0]].eq = [30, 31]; return b; }),
    /eq\[N=9\] 31 exceeds eq\[N=8\] 30/);
});

test('(b) a cell past the outlier line is refused, by cell name', () => {
  fires(goodRing((b) => { b.agree.twoSeed[1] = OUTLIER_SIGMA + 0.1; return b; }),
    new RegExp(`1 cell\\(s\\) past the ${OUTLIER_SIGMA}σ outlier line: ${KEYS[1].replace('|', '\\|')}`));
});

test('(b) a per-cell record that is not one number per cell is refused', () => {
  /* Without this, a ring could ship an EMPTY agree array and the outlier loop would pass vacuously
     — the per-cell record is the whole of what gives the clause teeth at gate time. */
  fires(goodRing((b) => { b.agree.twoSeed = []; return b; }), /agree\.twoSeed is not one number per cell/);
});

test('(b) a SYSTEMATIC bias is refused even though every single cell is inside the outlier line', () => {
  const bands = bandsFor(SE);
  const shifted = summarise([{ d: 0.6, at: 'x' }, { d: 0.62, at: 'y' }], bands.seDiff, SE.cell);
  fires(goodRing((b) => { b.meta.twoSeed = shifted; return b; }), /a SYSTEMATIC difference/);
});

test('(b) a measurement noisier than its own trial count is refused', () => {
  const bands = bandsFor(SE);
  const noisy = summarise([{ d: 1.2, at: 'x' }, { d: -1.2, at: 'y' }], bands.seDiff, SE.cell);
  fires(goodRing((b) => { b.meta.prefix = noisy; return b; }), /RMS delta is .* the .* trials predict/);
});

// -- (c) the ring is beside the model ------------------------------------------------------------

test('(c) a ring that records the model at a re-measured width is refused', () => {
  fires(goodRing((b) => { b.meta.model.nMax = 9; return b; }),
    /the ring records the model as measured at a width that is not 7/);
});

test('(c) an absent prefix summary is refused — an unrecorded agreement is not a checked one', () => {
  fires(goodRing((b) => { delete b.meta.prefix; return b; }), /meta\.prefix is absent/);
});

// -- (d) the artifact budget ---------------------------------------------------------------------

test('(d) an ABSENT ring budget row fails in BOTH variants, and says what to add', () => {
  const r = goodRing();
  const { problems } = ringProblems(r.body, r.raw, LIVE, { lite: {}, full: {} });
  for (const v of ['lite', 'full']) {
    assert.ok(problems.some((p) => p.includes(`(d) ${v}: there is no top-level \`ring\` budget row`)),
      `${v} must be named`);
  }
  assert.ok(problems.some((p) => /add `ring: \d+ \* 1024`/.test(p)), 'the message carries the number to write');
});

test('(d) a ceiling LOOSER than measured x 1.05 is refused', () => {
  const r = goodRing();
  const injected = Buffer.byteLength(injectedForm(r.raw));
  const bound = ceilingBound(injected, RING_CEILING_FACTOR);
  const ok = ringProblems(r.body, r.raw, LIVE, { lite: { ring: bound }, full: { ring: bound } });
  assert.deepEqual(ok.problems, [], 'exactly the bound is allowed');
  const loose = ringProblems(r.body, r.raw, LIVE, { lite: { ring: bound + 1024 }, full: { ring: bound + 1024 } });
  assert.ok(loose.problems.some((p) => /is LOOSER than its documented margin/.test(p)));
});

test('(d) a payload over its own ceiling is refused', () => {
  const r = goodRing();
  fires(r, /over budget/, { lite: { ring: 64 }, full: { ring: 64 } });
});

// -- (e) the wall --------------------------------------------------------------------------------

test('(e) a wallBudget edited in the artifact is the silent widening R2 names', () => {
  fires(goodRing((b) => { b.meta.wallBudget = 1200; return b; }),
    /meta\.wallBudget is 1200, and R2 pre-registers 300/);
});

test('(e) a measured wall over the budget is refused, with R2\'s remedy and the measured cause', () => {
  const problems = fires(goodRing((b) => { b.meta.wallSec = 1200; return b; }),
    /the measured two-seed wall is 1200s against R2's pre-registered 300s/);
  const p = problems.find((x) => x.includes('measured two-seed wall'));
  assert.match(p, /halve the LATTICE trials/, 'the remedy R2 states');
  assert.match(p, /never to drop a seed/);
  assert.match(p, /blocker, not a widening/);
  assert.match(p, /runMultiFiltered \(5\.6x\)/, 'the measured cause, not a guess');
});

test('(e) an absent wallSec is refused — a gate cannot judge a number that lives only in a log', () => {
  fires(goodRing((b) => { delete b.meta.wallSec; return b; }), /meta\.wallSec is undefined/);
});

// -- the readings: the falsification stays on the report ------------------------------------------

test('the pre-registered 2·se.cell reading is REPORTED, and marked FALSIFIED when it breaches', () => {
  const bands = bandsFor(SE);
  /* a worst |delta| of 0.5 pt is 3.13 · se.cell — past §5.2's 2.0, inside the 5σ outlier line */
  const breach = summarise([{ d: 0.5, at: 'x N=8' }, { d: -0.02, at: 'y N=9' }], bands.seDiff, SE.cell);
  assert.ok(breach.worstSE > 2 && breach.worstSigma < OUTLIER_SIGMA, 'the fixture is in the gap the finding lives in');
  const { problems, readings } = run(goodRing((b) => { b.meta.prefix = breach; return b; }));
  assert.deepEqual(problems, [], 'a breach of the FALSIFIED band is not a gate failure');
  assert.ok(readings.some((r) => /prefix worst .* FALSIFIED/.test(r)),
    `the falsification must stay on the report, got: ${readings.join(' | ')}`);
  // and when it holds, it says so rather than going quiet
  const held = summarise([{ d: 0.1, at: 'x' }], bands.seDiff, SE.cell);
  const r2 = run(goodRing((b) => { b.meta.prefix = held; return b; }));
  assert.ok(r2.readings.some((r) => /prefix worst .* held/.test(r)));
});
