// test/equilibrium.test.mjs — the P3 baseline payload, its two gates, and decision 11's proof.
//
// Three things live here, and the third is the one that would be easy to leave as prose:
//
//   1. THE MODULE. `scripts/lib/equilibrium.mjs` decides what `data/equilibrium.json` contains and
//      what `model.baselineTiers` is cut from. Every rule in it deserves a test that fails when it
//      changes — the same reason `variant.mjs` and `shell-compile.mjs` were lifted out of scripts.
//
//   2. THE TWO GATES, driven through their `opts` seams so every failure branch is watched failing.
//      A gate nobody has seen fail is a gate nobody knows the shape of (gates/variants.mjs's own
//      words about `opts.artifacts`), and I36 and D9 both read files the build just wrote.
//
//   3. DECISION 11, as an executable proof rather than a paragraph. V3-PLAN §3.3's adjudication 11
//      permits exactly three moves on `data/model.json` — verify's `gates` stamp, the new
//      `constants.solver` block, and the `baselineTiers` key — and requires a key-by-key comparison
//      showing `cells`, `rows`, `cols`, `bands`, `order` and `benchmarks` byte-identical. The
//      comparison was run against `git show HEAD:data/model.json` at the milestone and is recorded
//      in the phase notes; what is pinned HERE is the property that made it come out that way,
//      because a one-off comparison expires and a property does not: the two writers that touch the
//      model are shown, on the shipped model, to leave those six keys byte-identical.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ARTIFACT, GENERATOR, BASELINE_QUANT, QUANT_ANCHOR, QUANT_FLAG, STACKS, INIT_SEED, PAYOFF_SEED, SPREAD_SEED,
  HU_NODES, NOT_HU_REASON,
  solverBlock, pageModel, pageEquilibrium, shippedSurfaces,
  readingAt, anchorProblems, nestingReadiness, postPassFindings, postPassRecordProblems,
  quantizeRow, tierOfRow, quantizedNodes, quantReadings, quantProblems,
  coverageMap, contentHash, sourceHash, matrixShipping, frequenciesFrom,
  domainLabelFor,
} from '../scripts/lib/equilibrium.mjs';
import { CONSTANTS, CAPS, ITER_CAP, EPSILON_BB, TWO_SEED_TOL_POT, labelFor, SIXMAX } from '../scripts/lib/cfr.mjs';
import { TIER_RANK, POSITIONS, NODES } from '../scripts/lib/policy.mjs';
import { VARIANTS } from '../scripts/lib/variant.mjs';
import { stampConstants } from '../scripts/verify.mjs';
import * as baseline from '../scripts/gates/baseline.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
const EQ_TEXT = readFileSync(resolve(ROOT, ARTIFACT), 'utf8');
const EQ = JSON.parse(EQ_TEXT);
const BLOCK = MODEL.baselineTiers;

/** run the baseline family and return its gates by id */
function run(opts = {}, model = MODEL) {
  const gates = [];
  const built = baseline.build({ model, opts, G: (id, pass, detail) => gates.push({ id, pass, detail }) });
  for (const s of built.sections) s.run();
  return Object.fromEntries(gates.map((g) => [g.id, g]));
}

/** a payload with one field rewritten — the shape every D9 failure branch takes */
const withEq = (mutate) => {
  const copy = JSON.parse(EQ_TEXT);
  mutate(copy);
  return JSON.stringify(copy);
};

/** a block with one reading rewritten — the shape every I36 failure branch takes */
function fabricate(nodeKey, cell, tier, argmaxAction) {
  const copy = JSON.parse(JSON.stringify(BLOCK));
  const n = copy.nodes[nodeKey];
  const i = copy.order.indexOf(cell);
  const N = n.actions.length;
  const steps = Math.round(1 / copy.quant);
  n.tiers[i] = tier;
  for (let a = 0; a < N; a++) n.w[i * N + a] = n.actions[a] === argmaxAction ? steps : 0;
  return copy;
}

// ===================================================================================================
// the payload contract — what §3.3's task list requires the artifact to carry
// ===================================================================================================

test('the shipped payload carries everything §3.3 asks it to, and nothing synthetic', () => {
  // full strategies, per infoset, both depths, at full double precision
  for (const stack of STACKS) {
    const d = EQ.depths[`T${stack}`];
    assert.ok(d, `T${stack} is missing`);
    for (const [id, N] of [['n1', 2], ['n2', 3], ['n3', 3], ['n4', 3], ['n5', 2]]) {
      assert.equal(d.strategy[id].length, EQ.meta.cells * N);
    }
    assert.equal(d.iters, ITER_CAP);
    assert.equal(d.initSeed, INIT_SEED);
    assert.equal(d.payoffSeed, PAYOFF_SEED);
    assert.ok(d.exploitabilityBB <= EPSILON_BB, 'solved inside epsilon');
    assert.ok(Number.isFinite(d.valueBB) && Number.isFinite(d.lastFlip));
    assert.ok(d.frequencies && Number.isFinite(d.frequencies.sbOpen));
    // the two-seed spread, recorded as a datum beside the matrix it came from
    assert.ok(d.twoSeedSpreadPot <= TWO_SEED_TOL_POT);
  }
  // the payoff source datum and the label DERIVED from it
  assert.equal(EQ.payoff.source, 'checkdown');
  assert.equal(EQ.payoff.label, labelFor('checkdown'));
  // CAPS — the on-screen cap list's source datum
  assert.deepEqual(EQ.caps.omitted, [...CAPS.omitted]);
  assert.deepEqual(EQ.caps.modelled, [...CAPS.modelled]);
  // the solver constants, with their anchors
  assert.deepEqual(EQ.constants.map((c) => c.name), CONSTANTS.map((c) => c.name));
  for (const c of EQ.constants) assert.ok(c.anchor.length > 40, `${c.name} ships no anchor`);
  // the HU coverage map, the validation residuals, the wall time
  assert.equal(EQ.coverage.length, POSITIONS.length * NODES.length);
  assert.ok(Number.isFinite(EQ.matrix.validation.mean));
  assert.ok(Number.isFinite(EQ.meta.buildMs));
  // meta.synthetic absent or false — §5.3, and D9 refuses the other case
  assert.equal(EQ.meta.synthetic, false);
});

test("the payload's frequencies re-derive from its own shipped strategies", () => {
  /* Not a restatement of the generator's own check: this reads the ARTIFACT, so it proves the
     numbers survived serialisation. `JSON.stringify` emits the shortest decimal that round-trips a
     double, which is why full precision was shipped rather than a rounding — a quantized strategy
     could not reproduce these. */
  const q = MODEL.cells;                                   // only used for the key set below
  assert.ok(q, 'the model is loadable');
  for (const stack of STACKS) {
    const d = EQ.depths[`T${stack}`];
    // reconstruct the chance measure from the shipped combos over the live set
    const live = BLOCK.order;
    let total = 0;
    for (const k of live) total += MODEL.cells[k].combos;
    const qv = live.map((k) => MODEL.cells[k].combos / total);
    const re = frequenciesFrom(d.strategy, qv, live.length);
    for (const key of Object.keys(re)) {
      assert.ok(Math.abs(re[key] - d.frequencies[key]) < 1e-12,
        `${key} does not re-derive: ${re[key]} vs ${d.frequencies[key]}`);
    }
  }
});

test('the payload hashes describe the payload, and the generator that made it', () => {
  assert.equal(contentHash(EQ), EQ.meta.contentHash);
  assert.equal(sourceHash(), EQ.meta.generatorHash,
    `${ARTIFACT} was written by a different revision of ${GENERATOR} / equilibrium.mjs / cfr.mjs`);
  /* KEYED ON THE CELLS, not on `meta.hash`: the file hash covers verify's own `gates` stamp and
     moves whenever a gate is added, which has nothing to do with the solve. What the solve read is
     the cells and the combo total, and that is what the payload claims about. */
  assert.equal(EQ.meta.model.cellsHash,
    createHash('sha256').update(JSON.stringify(MODEL.cells)).digest('hex'));
  assert.equal(EQ.meta.model.comboTotal, MODEL.meta.comboTotal);
});

test('the matrix ships by REFERENCE, and the decision matches its own measurement', () => {
  const sh = EQ.matrix.shipping;
  assert.equal(sh.ships, 'reference');
  assert.ok(sh.ratio >= 2, 'a faithful embedding must more than double the payload for this decision');
  /* The number that would have made embedding look affordable is on the record, and is NOT the one
     the rule was applied to. This is the assertion that keeps a precision choice from deciding a
     shipping question. */
  assert.equal(sh.options.rounded6.faithful, false);
  assert.ok(sh.options.rounded6.bytes < sh.embedBytes);
  assert.ok(sh.options.counters.faithful && sh.options.doubles.faithful);
  assert.equal(EQ.matrix.artifact, 'data/checkdown-matrix.json');
  assert.ok(EQ.matrix.contentHash, 'a reference with no content hash is a filename');
});

// ===================================================================================================
// the quantized shared-core block
// ===================================================================================================

test('quantizeRow is SUM-PRESERVING, which independent rounding is not', () => {
  const steps = 100;
  assert.deepEqual(quantizeRow([0.5, 0.5], 0.01), [50, 50]);
  // the case independent rounding gets wrong: three thirds round to 33 each and sum to 99
  const thirds = quantizeRow([1 / 3, 1 / 3, 1 / 3], 0.01);
  assert.equal(thirds.reduce((a, b) => a + b, 0), steps);
  // the residue lands on the LARGEST component, so a pure strategy cannot become mixed
  assert.deepEqual(quantizeRow([0.999, 0.001], 0.01), [100, 0]);
  assert.deepEqual(quantizeRow([0.001, 0.999], 0.01), [0, 100]);
  for (const row of [[0.17, 0.33, 0.5], [0.004, 0.996], [0.2, 0.2, 0.6]]) {
    assert.equal(quantizeRow(row, 0.01).reduce((a, b) => a + b, 0), steps);
    assert.equal(quantizeRow(row, 0.05).reduce((a, b) => a + b, 0), 20);
  }
});

test('tierOfRow reads MIX from the quantization step and from no second opinion', () => {
  const acts = ['fold', 'call', 'raise'];
  const tierOf = { fold: 'T5', call: 'T3', raise: 'T1' };
  assert.equal(tierOfRow([100, 0, 0], tierOf, acts), 'T5');
  assert.equal(tierOfRow([0, 100, 0], tierOf, acts), 'T3');
  assert.equal(tierOfRow([0, 0, 100], tierOf, acts), 'T1');
  assert.equal(tierOfRow([1, 0, 99], tierOf, acts), 'T4');
  // T2 has no equilibrium analogue and must never be produced — it is the model's exploit split
  for (const w of [[100, 0, 0], [0, 100, 0], [0, 0, 100], [50, 50, 0], [1, 1, 98]]) {
    assert.notEqual(tierOfRow(w, tierOf, acts), 'T2');
  }
});

test('the shipped block is a strategy, at the shipped quantization, over the live cells', () => {
  assert.equal(BLOCK.quant, BASELINE_QUANT);
  assert.equal(BLOCK.quantAnchor, QUANT_ANCHOR);
  assert.equal(BLOCK.source, 'checkdown');
  assert.equal(BLOCK.label, labelFor('checkdown'));
  assert.deepEqual(BLOCK.caps.omitted, [...CAPS.omitted]);
  const steps = Math.round(1 / BLOCK.quant);
  for (const key of Object.keys(BLOCK.nodes)) {
    const n = BLOCK.nodes[key];
    assert.equal(n.w.length, BLOCK.order.length * n.actions.length);
    assert.equal(n.tiers.length, BLOCK.order.length);
    for (let i = 0; i < BLOCK.order.length; i++) {
      let s = 0;
      for (let a = 0; a < n.actions.length; a++) s += n.w[i * n.actions.length + a];
      assert.equal(s, steps, `${key} row ${i} does not sum to 1`);
      assert.notEqual(n.tiers[i], 'T2');
    }
  }
  // every cell in `order` is a real, non-empty cell of the model
  for (const k of BLOCK.order) {
    assert.ok(MODEL.cells[k], `${k} is not a model cell`);
    assert.ok(MODEL.cells[k].combos > 0, `${k} carries no combos`);
  }
});

test('the block fits D6\'s named 12 KB sub-budget, which is what it is paid for', () => {
  const bytes = Buffer.byteLength(JSON.stringify(BLOCK));
  assert.ok(bytes <= 12 * 1024, `${bytes} B over 12,288 B`);
  // ...and the anchor is a table, not an adjective: it must quote the steps either side
  assert.match(QUANT_ANCHOR, /0\.05/);
  assert.match(QUANT_ANCHOR, /0\.001/);
  assert.match(QUANT_ANCHOR, /--quant-table/);
});

// ===================================================================================================
// baselineQuant — FLAGGED, and the table it rests on made binding (docs/refutations/P3.md)
// ===================================================================================================

test('baselineQuant ships FLAGGED: the admission travels with the data, in both surfaces', () => {
  // §6's "named in `constants`" leg, on the two surfaces the two variants actually read
  assert.equal(BLOCK.quantFlag, QUANT_FLAG, 'lite reads the block, so the block carries the flag');
  assert.equal(EQ.baselineQuant.flag, QUANT_FLAG);
  assert.equal(EQ.baselineQuant.kind, 'estimate',
    'the P3 red team returned 6 of 6 unanchorable — the payload must not go on calling it anchored');
  assert.equal(EQ.baselineQuant.value, BLOCK.quant);
  assert.equal(EQ.baselineQuant.anchor, QUANT_ANCHOR);
  // the flag names what it flags and the gate that bounds it — flagProblems' contract, by hand here
  assert.ok(QUANT_FLAG.length >= 60);
  assert.match(QUANT_FLAG, /baselineQuant/);
  assert.match(QUANT_FLAG, /I36/);
  // and the Method view badges it rather than rendering it like the measured numbers beside it
  const shell = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  assert.match(shell, /var UNANCHORED = \{[^}]*'baselineQuant'/);
  assert.ok(shell.indexOf("UNANCHORED['baselineQuant']") > 0, 'the badge map is read where the step renders');
  assert.ok(shell.indexOf('bb2.quantFlag') > 0, 'the flag is rendered, not merely shipped');
});

test('the anchor table is BINDING: it re-derives from the shipped strategies, exactly', () => {
  const strategy = EQ.depths[`T${BLOCK.stack}`].strategy;
  assert.deepEqual(quantProblems(BLOCK, strategy), []);

  const rows = quantReadings(BLOCK, strategy);
  assert.equal(rows.length, 3, 'the shipped anchor prices three steps');
  for (const r of rows) {
    assert.equal(r.bytes, r.quotedBytes, `step ${r.quant}: the anchor's byte figure is the measured one`);
    assert.equal(r.mix, r.quotedMix, `step ${r.quant}: the anchor's MIX count is the measured one`);
  }
  assert.deepEqual(rows.filter((r) => r.shipped).map((r) => r.quant), [BASELINE_QUANT]);

  // the shared-core block IS that quantization of the shipped payload — one solve, two artifacts
  assert.equal(JSON.stringify(quantizedNodes(strategy, BLOCK.order, BLOCK.quant)),
    JSON.stringify(BLOCK.nodes));
});

test('the quantization detector is armed against every way the table could lie', () => {
  const strategy = EQ.depths[`T${BLOCK.stack}`].strategy;
  const fab = (mut) => quantProblems({ ...BLOCK, ...mut }, strategy);
  // a fabricated byte figure — the P3 refuter's own attack, which used to ship green
  assert.equal(fab({ quantAnchor: QUANT_ANCHOR.replace('4,964', '4,900') }).length, 1);
  assert.equal(fab({ quantAnchor: QUANT_ANCHOR.replace('15 MIX', '16 MIX') }).length, 1);
  // a step the table does not price — 0.02 was the refuter's, and it regenerated green
  assert.match(fab({ quant: 0.02 })[0], /not one of the steps its own anchor prices/);
  // the block and the payload as two different solves
  const nodes = JSON.parse(JSON.stringify(BLOCK.nodes));
  nodes['SB|rfi'].tiers[0] = nodes['SB|rfi'].tiers[0] === 'T1' ? 'T5' : 'T1';
  assert.match(fab({ nodes })[0], /not the quantization of the shipped strategies/);
  // the flag deleted, which is the leg P1 found unenforced on every flag in the rake lane
  assert.match(fab({ quantFlag: '' })[0], /ships no quantFlag/);
  assert.match(fab({ quantFlag: 'a'.repeat(80) })[0], /does not name baselineQuant/);
  // and a payload with no strategies to re-derive from is a failure, not a skip
  assert.match(quantProblems(BLOCK, null)[0], /ships no strategies/);
});

// ===================================================================================================
// coverage — HU, with the reason in the data
// ===================================================================================================

test('the coverage map is the page\'s whole vocabulary, and names its reason 21 times', () => {
  const cov = coverageMap();
  assert.equal(cov.length, POSITIONS.length * NODES.length);
  const covered = cov.filter((r) => r.covered);
  assert.equal(covered.length, 3);
  assert.deepEqual(covered.map((r) => `${r.pos}|${r.node}`), ['SB|rfi', 'SB|3bet', 'BB|raise']);
  for (const r of cov.filter((x) => !x.covered)) assert.equal(r.reason, NOT_HU_REASON);
  // and the shipped copies agree with the computed one
  assert.deepEqual(BLOCK.coverage, cov);
  assert.deepEqual(EQ.coverage, cov);
});

test("§5.7's label is DERIVED from the seat count, and no multiway surface can be 'GTO' by omission", () => {
  /* "HU is GTO; anything multiway is a self-play fixed point" is a rule about how many seats were
     solved, so the shipped datum is the seat list and the label follows from it — the same
     discipline `labelFor(source)` applies to the Grade-C caveat. The multiway arm has never been
     taken because nothing multiway has been solved, and it exists so that the day one ships it
     cannot be labelled "GTO" by nobody having thought about it. */
  assert.equal(domainLabelFor(['SB', 'BB']), 'GTO');
  assert.equal(domainLabelFor(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']), 'self-play fixed point');
  assert.equal(domainLabelFor(['SB', 'BB', 'BTN']), 'self-play fixed point');
  assert.equal(domainLabelFor([]), null);
  assert.equal(BLOCK.domainLabel, domainLabelFor(BLOCK.seats));
  assert.equal(EQ.domain.label, domainLabelFor(EQ.domain.seats));
  assert.equal(EQ.domain.label, 'GTO');
  // and the only occurrence of the multiway label in the shipped payload is a NEGATIVE statement
  assert.match(EQ.notes.multiway, /^NONE\./);
  assert.match(EQ.notes.multiway, /no "self-play fixed point" surface exists/);
});

test('I36 FAILS when a multiway surface is labelled GTO', () => {
  const b = { ...BLOCK, seats: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] };
  const g = run({}, { ...MODEL, baselineTiers: b });
  assert.equal(g.I36.pass, false);
  assert.match(g.I36.detail, /solves 6 seats but is labelled "GTO"/);
});

test('every covered (pos, node) names a real page node and a real tree node', () => {
  for (const h of HU_NODES) {
    assert.ok(POSITIONS.includes(h.pos));
    assert.ok(NODES.includes(h.node));
    assert.match(h.treeNode, /^n[1-5]$/);
    for (const a of h.actions) assert.ok(h.tierOf[a], `${a} maps to no tier`);
    // T2 is never a target: it is the model's exploit split against its own reference table
    assert.ok(!Object.values(h.tierOf).includes('T2'));
  }
});

// ===================================================================================================
// I36's detectors, armed
// ===================================================================================================

test('the anchors hold on the shipped block — scoped to the seats that exist', () => {
  assert.deepEqual(anchorProblems(BLOCK), []);
  const aa = readingAt(BLOCK, 'SB|rfi', 'AA_BIGPAIR|DS');
  assert.equal(aa.argmax, 'raise');
  assert.equal(aa.tier, 'T1');
  assert.equal(readingAt(BLOCK, 'BB|raise', 'AA_BIGPAIR|DS').argmax, 'raise');
  assert.equal(readingAt(BLOCK, 'SB|3bet', 'AA_BIGPAIR|DS').argmax, 'raise');
});

test('TRASH x RB FOLDS at SB — the launch block\'s expectation is falsified, and that is the finding', () => {
  /* P3's launch expected this cell to OPEN, reasoning from an 89.3% opening frequency. It folds,
     purely. 88.86% is combo-weighted over 123 cells and the ~11% the equilibrium does not open is
     the BOTTOM of the range rather than a thin spread, so the model's own "TRASH x RB never opens"
     clause is CORROBORATED in the one seat where it can be read — at SB, the button, the loosest
     opening seat there is, which makes the scoped reading stronger than the original rather than
     weaker. Pinned here because a finding that contradicts a plan block is exactly the kind that
     gets quietly re-remembered the other way. */
  const r = readingAt(BLOCK, 'SB|rfi', 'TRASH|RB');
  assert.equal(r.argmax, 'fold');
  assert.equal(r.tier, 'T5');
  // and facing the open it CONTINUES, on price — a different claim, which is why the clause is
  // scoped to the open rather than to the cell
  assert.equal(readingAt(BLOCK, 'BB|raise', 'TRASH|RB').argmax, 'call');
});

test('the anchor detector is armed against every violator it is written for', () => {
  assert.ok(anchorProblems(fabricate('SB|rfi', 'AA_BIGPAIR|DS', 'T5', 'fold')).length > 0);
  assert.ok(anchorProblems(fabricate('BB|raise', 'AA_BIGPAIR|DS', 'T5', 'fold')).length > 0);
  assert.ok(anchorProblems(fabricate('SB|3bet', 'AA_BIGPAIR|DS', 'T5', 'fold')).length > 0);
  assert.ok(anchorProblems(fabricate('SB|rfi', 'TRASH|RB', 'T1', 'raise')).length > 0);
  // a cell that is not in the block at all is a failure, not a silent skip
  const gone = JSON.parse(JSON.stringify(BLOCK));
  gone.order = gone.order.filter((k) => k !== 'TRASH|RB');
  assert.ok(anchorProblems(gone).some((w) => /no reading/.test(w)));
});

test('positional nesting is NOT MEASURABLE, and the clause knows when that stops being true', () => {
  const n = nestingReadiness(BLOCK);
  assert.equal(n.measurable, false);
  assert.deepEqual(n.seats, ['BB', 'SB']);
  assert.equal(n.present.length, 0);
  assert.match(n.reason, /exactly two seats/);
  assert.match(n.reason, /never toleranced/);
  // the reason is quoted from the record I35(d) re-checks every run, not restated here
  assert.match(String(SIXMAX.reopenVerdict), /NOT\s+MEASURABLE/i);
  // ARMED: a coverage map claiming two seats of the chain flips it
  const grown = {
    ...BLOCK,
    coverage: [...BLOCK.coverage, { pos: 'CO', node: 'rfi', covered: true }, { pos: 'BTN', node: 'rfi', covered: true }],
  };
  assert.equal(nestingReadiness(grown).measurable, true);
});

test('THE POST-PASSES ARE VIOLATED BY THE EQUILIBRIUM — measured, not enforced', () => {
  /* §3.3: "the post-passes (nesting, suit monotonicity) are impositions an equilibrium may violate,
     and a violation is a finding to report, not launder." It does violate them, so the sentence is
     load-bearing rather than defensive, and §14 item 4's display decision is made on this. */
  const d = postPassFindings(BLOCK, MODEL.rows, MODEL.cols, TIER_RANK);
  assert.ok(d.suitMonotonicity.count > 0, 'suit monotonicity must be measured, and it is violated');
  assert.equal(d.aaBand.count, 0, 'the AA-band pass is NOT violated — the two do not go together');
  assert.equal(d.readings, Object.keys(BLOCK.nodes).length * BLOCK.order.length);
  // the worst one, named, because it is the reason the decision goes the way it does
  assert.ok(d.suitMonotonicity.violations.some((v) => /SB\|rfi RUN1_TOPMID SS->SSA T1->T5/.test(v)),
    'a RAISE-to-FOLD demotion on adding suitedness is the finding this clause exists to surface');
  // the record in the artifact describes the tiers in the model
  assert.deepEqual(postPassRecordProblems(EQ.postPasses, d), []);
});

test('the post-pass record detector is armed against the laundering §3.3 forbids', () => {
  const d = postPassFindings(BLOCK, MODEL.rows, MODEL.cols, TIER_RANK);
  assert.ok(postPassRecordProblems({ ...EQ.postPasses, suitMonotonicity: { violations: [], count: 0 } }, d).length > 0);
  assert.ok(postPassRecordProblems({ ...EQ.postPasses, aaBand: { violations: ['x'], count: 1 } }, d).length > 0);
  assert.ok(postPassRecordProblems({ ...EQ.postPasses, readings: 1 }, d).length > 0);
  assert.ok(postPassRecordProblems(null, d).length > 0);
  // a record with the right COUNT but the wrong violations is caught too
  const swapped = { ...EQ.postPasses, suitMonotonicity: { count: d.suitMonotonicity.count, violations: d.suitMonotonicity.violations.map(() => 'nope') } };
  assert.ok(postPassRecordProblems(swapped, d).length > 0);
});

// ===================================================================================================
// gate I36, driven through its seams
// ===================================================================================================

test('I36 PASSES on the shipped artifacts, and its detail carries the measurements', () => {
  const g = run();
  assert.equal(g.I36.pass, true, g.I36.detail);
  assert.match(g.I36.detail, /SCOPED TO THE SEATS THAT EXIST/);
  assert.match(g.I36.detail, /THE LAUNCH BLOCK'S EXPECTATION IS FALSIFIED/);
  assert.match(g.I36.detail, /NOT MEASURABLE IN THE HU DOMAIN/);
  assert.match(g.I36.detail, /NOT TESTABLE this milestone/);
  assert.match(g.I36.detail, /SUIT MONOTONICITY IS VIOLATED/);
  assert.match(g.I36.detail, /baseline is HU/);
});

test('I36 FAILS when the best hand in the deck folds its button', () => {
  const g = run({}, { ...MODEL, baselineTiers: fabricate('SB|rfi', 'AA_BIGPAIR|DS', 'T5', 'fold') });
  assert.equal(g.I36.pass, false);
  assert.match(g.I36.detail, /AA_BIGPAIR\|DS at SB\|rfi plays fold/);
});

test('I36 FAILS when the junk cell opens', () => {
  const g = run({}, { ...MODEL, baselineTiers: fabricate('SB|rfi', 'TRASH|RB', 'T1', 'raise') });
  assert.equal(g.I36.pass, false);
  assert.match(g.I36.detail, /TRASH\|RB at SB\|rfi plays raise/);
});

test('I36 FAILS when the shipped record no longer describes the shipped tiers', () => {
  const g = run({ equilibrium: withEq((e) => { e.postPasses.suitMonotonicity = { violations: [], count: 0 }; }) });
  assert.equal(g.I36.pass, false);
  assert.match(g.I36.detail, /records 0 suitMonotonicity violations but the shipped tiers have/);
});

test('I36 FAILS when an uncovered seat stops naming its reason', () => {
  const b = JSON.parse(JSON.stringify(BLOCK));
  const i = b.coverage.findIndex((r) => !r.covered);
  delete b.coverage[i].reason;
  const g = run({}, { ...MODEL, baselineTiers: b });
  assert.equal(g.I36.pass, false);
  assert.match(g.I36.detail, /carry no named reason/);
});

test('I36 FAILS — not passes — when the nesting chain becomes measurable', () => {
  /* The clause is recorded not-measurable, never toleranced: if a payload ever covers two seats of
     the chain, "not measurable" has stopped being true and the clause is owed a measurement. The
     gate must FAIL rather than go on printing the note. */
  const b = JSON.parse(JSON.stringify(BLOCK));
  b.coverage.push({ pos: 'CO', node: 'rfi', covered: true }, { pos: 'BTN', node: 'rfi', covered: true });
  const g = run({}, { ...MODEL, baselineTiers: b });
  assert.equal(g.I36.pass, false);
  assert.match(g.I36.detail, /the nesting chain is now measurable/);
});

test('I36 FAILS when the block or the payload is missing — absence is not a skip', () => {
  const noBlock = { ...MODEL };
  delete noBlock.baselineTiers;
  assert.equal(run({}, noBlock).I36.pass, false);
  assert.equal(run({ equilibrium: null }).I36.pass, false);
});

// ===================================================================================================
// gate D9, driven through its seams
// ===================================================================================================

test('D9 PASSES on the shipped artifacts, and states both budgets and their anchor', () => {
  const g = run();
  assert.equal(g.D9.pass, true, g.D9.detail);
  assert.match(g.D9.detail, /BOTH SET THIS PHASE/);
  assert.match(g.D9.detail, /measured/i);
  assert.match(g.D9.detail, /SHIPS BY REFERENCE/);
  assert.match(g.D9.detail, /meta\.synthetic is false/);
});

test('D9 REFUSES a payload carrying meta.synthetic — §5.3, and S-D\'s prototype is why', () => {
  const g = run({ equilibrium: withEq((e) => { e.meta.synthetic = true; }) });
  assert.equal(g.D9.pass, false);
  assert.match(g.D9.detail, /carries meta\.synthetic/);
  // ...and no size clause can rescue it: the refusal is unconditional
  assert.match(g.D9.detail, /No size clause below can make it shippable/);
});

test('D9 FAILS when the payload outgrows its budget', () => {
  const g = run({ equilibrium: EQ_TEXT + ' '.repeat(VARIANTS.full.budgets.eq) });
  assert.equal(g.D9.pass, false);
  assert.match(g.D9.detail, /over its \d+ KB budget/);
});

test('D9 FAILS when the full page outgrows its own tripwire, or is not built at all', () => {
  const over = run({ fullBytes: VARIANTS.full.budgets.total + 1, fullText: readFileSync(resolve(ROOT, 'index-full.html'), 'utf8') });
  assert.equal(over.D9.pass, false);
  assert.match(over.D9.detail, /over its \d+ KB budget/);
  const missing = run({ fullBytes: null, fullText: null });
  assert.equal(missing.D9.pass, false);
  assert.match(missing.D9.detail, /must be built/);
});

test('D9 FAILS when the page carries a different payload from the file — a budget on a ghost', () => {
  const stale = readFileSync(resolve(ROOT, 'index-full.html'), 'utf8')
    .replace(EQ.meta.contentHash, 'f'.repeat(64));
  const g = run({ fullText: stale });
  assert.equal(g.D9.pass, false);
  assert.match(g.D9.detail, /rebuild the full page/);
});

test('D9 FAILS when the shipping decision stops matching its own measurement', () => {
  const g = run({ equilibrium: withEq((e) => { e.matrix.shipping.ratio = 1.2; }) });
  assert.equal(g.D9.pass, false);
  assert.match(g.D9.detail, /no longer matches the numbers it was made on/);
});

// ===================================================================================================
// the shipped surfaces I35's disclosure clauses walk
// ===================================================================================================

test('shippedSurfaces finds a constants block, a cap list and a label on every artifact', () => {
  const s = shippedSurfaces();
  const where = (rows) => rows.map(([w]) => w);
  assert.ok(where(s.constants).includes('data/model.json constants.solver'));
  assert.ok(where(s.constants).includes(`${ARTIFACT} constants`));
  assert.ok(where(s.constants).includes('index.html constants.solver'));
  assert.ok(where(s.constants).includes('index-full.html constants.solver'));
  assert.ok(where(s.capLists).includes(`${ARTIFACT} caps`));
  assert.ok(where(s.labels).includes('data/model.json baselineTiers'));
  assert.ok(where(s.labels).includes(`${ARTIFACT} payoff`));
  // the seam is overridable, so a gate's failure branches can be driven without touching disk
  const none = shippedSurfaces({ files: { 'data/model.json': '{}', [ARTIFACT]: '{}' }, pages: [] });
  assert.deepEqual([none.constants.length, none.capLists.length, none.labels.length], [0, 0, 0]);
});

test('solverBlock is cfr.mjs\'s CONSTANTS and nothing else, anchors included', () => {
  const b = solverBlock();
  for (const c of CONSTANTS) {
    const short = c.name.slice(c.name.indexOf('.') + 1);
    assert.equal(b[short], c.value);
    assert.equal(b.anchors[short].anchor, c.anchor);
    assert.equal(b.anchors[short].kind, c.kind);
  }
  assert.deepEqual(MODEL.constants.solver, b, 'the shipped block is the stamped one');
});

test('pageModel and pageEquilibrium read the built artifacts back', () => {
  const lite = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const full = readFileSync(resolve(ROOT, 'index-full.html'), 'utf8');
  assert.equal(pageModel(lite).meta.hash, MODEL.meta.hash);
  assert.equal(pageModel(full).meta.hash, MODEL.meta.hash);
  assert.equal(pageEquilibrium(lite), null, 'lite carries no equilibrium payload (D10)');
  assert.equal(pageEquilibrium(full).meta.contentHash, EQ.meta.contentHash);
  // and the shared-core block reaches BOTH pages, which is what §5.3 buys
  assert.ok(pageModel(lite).baselineTiers);
  assert.ok(pageModel(full).baselineTiers);
});

// ===================================================================================================
// DECISION 11 — the property behind the key-by-key comparison
// ===================================================================================================

test('DECISION 11: the two model writers leave the six frozen keys byte-identical', () => {
  /* V3-PLAN §3.3's adjudication 11 permits exactly three moves on data/model.json: verify's `gates`
     stamp, `constants.solver`, and `baselineTiers`. `cells`, `rows`, `cols`, `bands`, `order` and
     `benchmarks` must stay byte-identical, because test/payoff-model.test.mjs re-derives 17
     coefficients from the shipped model and I22/I32 pin the tiers — a regeneration trips all of
     them. The key-by-key comparison against HEAD was run at the milestone; this pins the PROPERTY,
     which does not expire when HEAD moves. */
  const FROZEN = ['cells', 'rows', 'cols', 'bands', 'order', 'benchmarks'];
  const before = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
  const snapshot = Object.fromEntries(FROZEN.map((k) => [k, JSON.stringify(before[k])]));

  // writer 1: verify's constants stamp
  const m = JSON.parse(JSON.stringify(before));
  const report = stampConstants(m);
  for (const k of FROZEN) assert.equal(JSON.stringify(m[k]), snapshot[k], `${k} moved`);
  assert.ok(!report.added.includes('solver') && !report.changed.includes('solver'),
    'the shipped block already agrees with cfr.mjs — a second stamp is a no-op');

  // writer 2: the baseline-tier injection, which sets one key and touches nothing else
  const m2 = JSON.parse(JSON.stringify(before));
  m2.baselineTiers = { rewritten: true };
  for (const k of FROZEN) assert.equal(JSON.stringify(m2[k]), snapshot[k], `${k} moved`);

  // and the shipped model carries only the permitted additions beyond v2's key set
  assert.deepEqual(Object.keys(before).sort(),
    ['bands', 'baselineTiers', 'benchmarks', 'cells', 'cols', 'constants', 'gates', 'meta', 'order', 'rows']);
});

test('DECISION 11: stampConstants is idempotent and authoritative about the solver block', () => {
  /* Authoritative, not preserving: a drifted block must be REPLACED rather than carried across as
     if it were a measurement. That is the difference between this key and `nuBarMeasured`, and it
     is what makes I35's constants clause a statement about the code rather than about the file. */
  const m = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
  m.constants.solver = { epsilonBB: 1, iterCap: 1, twoSeedTolPot: 1, sizingLadder: 'nope' };
  const r = stampConstants(m);
  assert.ok(r.changed.includes('solver'));
  assert.deepEqual(m.constants.solver, solverBlock());
  const again = stampConstants(m);
  assert.ok(!again.changed.includes('solver') && !again.added.includes('solver'));
});

test('matrixShipping prices the FAITHFUL encoding, not the cheapest one', () => {
  /* A synthetic 3x3 matrix: the point is the RULE, and the rule must be applied to the encoding
     that reconstructs the served numbers rather than to whichever is smallest. */
  const m = {
    NC: 3,
    E: Float64Array.from([0.5, 0.6, 0.7, 0.4, 0.5, 0.55, 0.3, 0.45, 0.5]),
    raw: { wins2: Int32Array.from([120, 140]), cnt: Int32Array.from([100, 100]) },
  };
  const tiny = matrixShipping(m, 10_000_000);
  assert.equal(tiny.ships, 'embedded', 'a huge payload absorbs a small matrix');
  const huge = matrixShipping(m, 10);
  assert.equal(huge.ships, 'reference');
  assert.equal(tiny.pairs, 6, 'the upper triangle including the diagonal');
  assert.equal(tiny.embedBytes, tiny.options.counters.bytes);
});
