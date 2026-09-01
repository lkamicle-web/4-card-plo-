// gates V1 I5 V2 V3 I4 V4 V5 V6 B I20 — the engine gates.
//
// The OBJECTIVE half of the objective/opinion split: zero-sum, conservation over N=1..5, seed
// independence, the nine C(52,5) category counts, the Omaha two-from-hand rule, the published
// calibration table, and cross-engine agreement between the bitwise evaluator and the independent
// reference implementation over shared deals.
//
// SCOPE, LOAD-BEARING (METHODOLOGY §"Conservation does not apply here"): V1/I5 and V2/V3/I4 are
// RANDOM-VILLAIN gates. A filtered field is not uniform and its equities do not sum to fair share
// — I25 asserts that same fact positively. This scope is written into the code here so it cannot
// be lost to a refactor that "generalises" the conservation check over whatever equity arrays it
// can find. Moving these blocks into this file does not widen them, and must not.

import { eval5, categoryOf, parseHand, makeTriplePartials, fillTriplePartials, bestOmaha } from '../lib/eval5.mjs';
import { omahaBest as refOmahaBest, equity as refEquity } from '../lib/equity-ref.mjs';
import { equityFixed, equityVsFixed, sharedDealEquities, crossEngineEquity, crossEngineEquityVs, uniformMeanEquity } from '../lib/mc.mjs';
import { CAT_COUNTS } from './_shared.mjs';

export const family = 'engine';
export const title = 'the Monte Carlo engine and the calibration table — the objective layer';
export const ids = ['V1', 'I5', 'V2', 'V3', 'I4', 'V4', 'V5', 'V6', 'B', 'I20'];

export function build(ctx) {
  const { model, fast, tolB, G } = ctx;

  return {
    sections: [
    // =========================================================================
    // V1-V6 — engine gates
    // =========================================================================
    { ids: ['V1', 'I5'], label: 'zero-sum over shared deals', run: () => {
    // V1 two fixed hands, equities sum to 100 (shared deals: this tests the split-pot accounting)
    //
    // SCOPE (V2-PLAN §2.3, and see I25): V1/I5 and V2/V3/I4 below are RANDOM-VILLAIN gates and
    // must stay that way. They assert conservation over a UNIFORM field — every opponent drawn
    // from the whole deck — which is a property of the engine, not of the game. The v2 villain-
    // VPIP lattice (`cells[k].vDelta`) measures equity against a FILTERED field, and a filtered
    // field is not zero-sum-uniform by construction: a hero drawn from the whole deck faces
    // opponents drawn from better than the whole deck, so the combo-weighted mean delta is
    // negative at every lattice point (measured -1.36 pt at v=25 through -0.67 at v=90; I25
    // asserts that sign). Feeding lattice data into these gates would assert a falsehood.
    const s = sharedDealEquities([parseHand('AsAhKsKh'), parseHand('JsTh9s8h')], 60000, 'V1');
    const sum = s[0] + s[1];
    G('V1', Math.abs(sum - 100) < 0.3, `AAKKds ${s[0].toFixed(2)} + JT98ds ${s[1].toFixed(2)} = ${sum.toFixed(2)}`);
    G('I5', Math.abs(sum - 100) < 0.3, `zero-sum over shared deals: ${sum.toFixed(3)}`);
    } },

    { ids: ['V2', 'V3', 'I4'], label: 'conservation, N=1..5', run: () => {
    // V2 / V3 / I4 conservation. The hero is redrawn uniformly every trial (see mc.uniformMeanEquity)
    // rather than averaging a few dozen fixed random heroes: same expectation, SE 0.1 instead of 0.9.
    // Random villains only — see the scope note at V1 above: the filtered-villain lattice is
    // exempt from conservation by construction, not by tolerance.
    const u = uniformMeanEquity(fast ? 60000 : 200000, 'conservation');
    const exp = [50, 100 / 3, 25, 20, 100 / 6];
    const worst = Math.max(...u.map((x, i) => Math.abs(x - exp[i])));
    G('V2', Math.abs(u[0] - 50) < 0.5, `mean equity of a uniformly random hero vs 1 random = ${u[0].toFixed(3)} (50.000 +/- 0.5)`);
    G('V3', Math.abs(u[2] - 25) < 0.5, `mean equity of a uniformly random hero vs 3 random = ${u[2].toFixed(3)} (25.000 +/- 0.5)`);
    G('I4', worst < 0.5, `conservation for N=1..5: ${u.map((x) => x.toFixed(3)).join(' / ')} vs ` +
      `${exp.map((x) => x.toFixed(3)).join(' / ')} — worst deviation ${worst.toFixed(3)} pt`);
    } },

    { ids: ['V4'], label: 'seed independence', run: () => {
    // V4 same hand written two ways, different seeds
    const a = equityVsFixed(parseHand('5s4h3s2h'), parseHand('AsAhKdQc'), 60000, 'V4a');
    const b = equityVsFixed(parseHand('2s3h4s5h'), parseHand('AsAhKdQc'), 60000, 'V4b-different-seed');
    G('V4', Math.abs(a - b) < 0.3, `5432ds ${a.toFixed(2)} vs 2345ds ${b.toFixed(2)} (same hand, different seeds)`);
    } },

    { ids: ['V5'], label: 'C(52,5) category counts', run: () => {
    // V5 category frequencies over all C(52,5) + strict ranking order
    const cnt = new Array(9).fill(0);
    for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let c = b + 1; c < 52; c++)
      for (let d = c + 1; d < 52; d++) for (let e = d + 1; e < 52; e++) cnt[categoryOf(eval5(a, b, c, d, e))]++;
    const exact = cnt.every((n, i) => n === CAT_COUNTS[i]);
    const order = [
      ['9s8s7s6s5s', 8], ['9s9h9d9c2s', 7], ['9s9h9d2s2h', 6], ['As9s7s4s2s', 5],
      ['9s8h7d6c5s', 4], ['9s9h9d2s3h', 3], ['9s9h7d7c2s', 2], ['9s9h7d5c2s', 1], ['As9h7d5c2s', 0],
    ];
    let strict = true, prev = Infinity;
    for (const [h, cat] of order) {
      const cards = parseHand(h);
      const v = eval5(...cards);
      if (categoryOf(v) !== cat || v >= prev) strict = false;
      prev = v;
    }
    G('V5', exact && strict, `all nine C(52,5) category counts exact; ranking order strict`);
    } },

    { ids: ['V6'], label: 'the Omaha two-from-hand rule', run: () => {
    // V6 the Omaha 2-of-4 rule
    const tp = makeTriplePartials();
    fillTriplePartials(parseHand('7s7h7d7cKs'), tp);
    const kk = parseHand('KdKh2s3h'), aa = parseHand('AsAh2d3c');
    G('V6', bestOmaha(...kk, tp) > bestOmaha(...aa, tp), 'KdKh makes KKK77 and beats AsAh on 7s7h7d7cKs');
    } },

    // =========================================================================
    // B — calibration benchmarks (assert the values the model shipped)
    // =========================================================================
    { ids: ['B'], label: 'calibration benchmarks', run: () => {
    // Rows are checked against the model brief's published table. A row that misses by more than
    // the tolerance is NOT waved through: it is re-measured by the independent reference engine at
    // high trial count, and only passes if the two engines agree with each other to +/-0.3 pt — in
    // which case the brief's figure (a 30k-trial single-engine measurement) is the outlier and the
    // conflict is recorded in benchmarks.disputed for docs/METHODOLOGY.md.
    const rows = [];
    for (const r of model.benchmarks.hu) rows.push([`HU ${r.label}`, r.expected, r.measured, r.hand, 1]);
    for (const r of model.benchmarks.multiway) {
      for (let n = 0; n < 5; n++) rows.push([`${r.label} N=${n + 1}`, r.expected[n], r.measured[n], r.hand, n + 1]);
    }
    for (const r of model.benchmarks.vs3bet) rows.push([r.label, r.expected, r.measured, r.hand, 0, r.villain]);
    const off = rows.filter(([, e, m]) => Math.abs(e - m) > tolB);
    const disputed = [];
    const unresolved = [];
    let noisy = 0;
    for (const [label, e, m, hand, nOpp, villain] of off) {
      const deep = fast ? 60000 : 240000;
      const mine = villain
        ? equityVsFixed(parseHand(hand), parseHand(villain), deep, `dispute|${label}`)
        : equityFixed(parseHand(hand), deep, `dispute|${label}`, nOpp);
      if (Math.abs(mine - e) <= tolB) { noisy++; continue; }
      // the row really does disagree with the published table: settle it with the independent
      // evaluator over SHARED deals, which removes sampling from the comparison entirely
      const x = villain
        ? crossEngineEquityVs(parseHand(hand), parseHand(villain), refOmahaBest, fast ? 8000 : 30000, `settle|${label}`)
        : crossEngineEquity(parseHand(hand), refOmahaBest, fast ? 8000 : 30000, `settle|${label}`, nOpp);
      if (x.disagree === 0 && Math.abs(x.a - x.b) < 1e-9) {
        disputed.push({ label, published: e, measured: +mine.toFixed(2), trials: deep, engines: 'identical over shared deals' });
      } else unresolved.push(`${label} (${x.disagree} engine disagreements)`);
    }
    model.benchmarks.disputed = disputed;
    G('B', unresolved.length === 0,
      `${rows.length} rows vs the published table at +/-${tolB} pt: ${rows.length - off.length} agree, ` +
      `${noisy} agree once re-measured at depth, ${disputed.length} disputed with both engines identical over shared deals` +
      (disputed.length ? ` (${disputed.map((d) => `${d.label} ${d.measured} vs published ${d.published}`).join('; ')})` : '') +
      (unresolved.length ? `, UNRESOLVED: ${unresolved.join('; ')}` : ''));
    } },

    // =========================================================================
    // I20 — cross-engine agreement
    // =========================================================================
    { ids: ['I20'], label: 'cross-engine agreement', run: () => {
    // Both engines are run over the SAME deals, so the comparison carries no Monte Carlo noise at
    // all: any difference is a genuine evaluator disagreement, not sampling. (An independent-run
    // comparison at a feasible trial count has a difference-SE near 0.3 pt, which makes a +/-0.6 pt
    // gate a coin flip; this construction tests the same claim without that.)
    const hands = ['AsAhKsKh', 'AsAhJsTh', 'KsKhQsQh', 'JsTh9s8h', 'Ts9h8s7h', '5s4h3s2h',
      'Ks9h5d2c', 'AsAh7d2c', 'AsAhAdAc', '2s2h3d3c'];
    const rows = [];
    let disagreements = 0;
    for (const h of hands) {
      const r = crossEngineEquity(parseHand(h), refOmahaBest, 30000, `I20|${h}`, 1);
      rows.push([h, r.a, r.b]);
      disagreements += r.disagree;
    }
    const worst = Math.max(...rows.map(([, a, b]) => Math.abs(a - b)));
    // and one end-to-end run of the reference engine's own dealing loop
    const refEnd = refEquity('AsAhKsKh', { nRandom: 1, trials: 40000, seedN: 20 });
    const endOk = Math.abs(refEnd - 70.82) <= (fast ? 1.5 : 0.9);
    G('I20', worst <= 0.6 && disagreements === 0 && endOk,
      `10 hands, max |eval5 - equity-ref| = ${worst.toFixed(3)} pt over shared deals, ` +
      `${disagreements} per-trial ranking disagreements; reference end-to-end AAKKds ${refEnd.toFixed(2)}`);
    } },
    ],
  };
}
