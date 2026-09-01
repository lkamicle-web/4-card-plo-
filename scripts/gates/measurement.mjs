// gates I24 I25 — the v2 measurement layer's shape.
//
// Both are pinned to the SHIPPED measurement rather than to a predicted one, and both carry an
// explicit record of what they deliberately do not assert: I24 declines V2-PLAN §2.1's five-step
// pair ladder the taxonomy cannot express, and I25 declines the plan's "junk loses most"
// prediction because the measurement falsified it. Those refusals are load-bearing — they are the
// two places a later reader is most likely to "fix" a gate back into asserting something untrue.

export const family = 'measurement';
export const title = 'the v2 measurement shapes — the cooler ladder (§2.1) and the villain lattice (§2.3)';
export const ids = ['I24', 'I25'];

export function build(ctx) {
  const { model, fast, G } = ctx;

  return {
    sections: [
    { ids: ['I24'], label: 'the cooler band ladder', run: () => {
    // =======================================================================
    // I24 — the cooler rate has a shape, and this gate asserts the shape it MEASURED.
    //
    // `cooler` is P(the hand still loses the pot outright | it reached showdown with a set or
    // better), judged at three opponents with chops not counted as losses — the definition ships
    // in `constants.cooler`. It is the depth anchor: at 100 bb a cooler costs a bet, at 250 bb it
    // costs a stack, so it enters scoring with a weight that grows with depth (V2-PLAN §3.1).
    //
    // WHAT THIS GATE DELIBERATELY DOES NOT ASSERT. V2-PLAN §2.1 asks for a five-step pair ladder,
    // TT > JJ > QQ > KK > AA. That ordering is not expressible in this taxonomy: `rowOf` splits
    // pairs at J (big = rank >= 11), so JJ, QQ and KK share the big-pair rows while TT sits with
    // the small pairs. Separating the pair ranks is new rows, not a new
    // measurement. Nor is the ladder assertable per ROW: measured, the row means are not ordered
    // inside a band (`AA_SMALLPAIR` 0.3453 sits above `BIGPAIR_CONN` 0.3216, and `DBLPAIR_MIXED`
    // 0.3942 above every AA row). What is measured, and is asserted here, is the three-step BAND
    // ladder, combo-weighted: AA 0.3184 < big pairs 0.3563 < small pairs 0.4386.
    //
    // Every threshold below is pinned to that shipped measurement:
    //   band step  >= 0.03    measured 0.0379 (AA -> big) and 0.0823 (big -> small).
    //   SSA vs SS  <= +0.01   `cooler(SSA) < cooler(SS)` — your flushes are the nut ones — holds
    //                         in 18 of 18 rows carrying both columns. It is asserted with a
    //                         tolerance rather than strictly BECAUSE the three thinnest margins
    //                         are 0.003 / 0.006 / 0.009 (RUN1_BOTTOM, AA_BROADWAY, RUN1_TOPMID)
    //                         and the per-cell cooler SE is ~0.003, so the difference SE is ~0.004
    //                         and the thinnest margin is under 1 sigma. A strict gate would be a
    //                         coin flip on RUN1_BOTTOM at the next regeneration, which is a gate
    //                         that fails for a reason it was not built to catch. The detail line
    //                         reports how many rows still hold strictly, so a real reversal is
    //                         visible even though it is not fatal.
    //   ranks      top/bottom 8 of 123 — `DBLPAIR_SMALL|RB` (the 2233r cell) measures 0.454, 5th
    //                         from the top; `AA_BIGPAIR|DS` measures 0.276, 4th from the bottom.
    //                         Pinned as rank bounds rather than as magic numbers so the gate keeps
    //                         meaning if the whole table shifts; 3 ranks of slack, i.e. three cells
    //                         would have to overtake the anchor before it fires.
    //   envelope   cells [0.15, 0.65] — measured 0.257-0.501. This is a definition guard, not a
    //                         noise guard: flipping chops into losses, or dropping the "set or
    //                         better" condition, moves every number out of this band at once.
    //                         [0, 1] is asserted flat.
    //   bar        <= 0.002   `constants.coolerBarMeasured` (0.3953) against the combo-weighted
    //                         mean rebuilt from the shipped 3-dp cells (0.39536, error 0.00006) —
    //                         a rounding tolerance, catching a constant that goes stale.
    // On --fast data (10k trials, per-cell cooler SE ~0.010) the noise-sensitive thresholds widen;
    // the structural ones do not.
    const live = Object.keys(model.cells).filter((k) => model.cells[k].combos > 0);
    const bandOf = {};
    for (const r of model.rows) bandOf[r.key] = r.band;
    const missing = live.filter((k) => model.cells[k].cooler === undefined);
    if (missing.length) {
      G('I24', false, `no cooler rate on ${missing.length} of ${live.length} cells — this dataset ` +
        `predates V2-PLAN §2.1; regenerate with scripts/generate-data.mjs`);
    } else {
      const tolSSA = fast ? 0.04 : 0.01;
      const stepMin = fast ? 0.015 : 0.03;
      const rankMax = fast ? 16 : 8;
      const ENV = { cell: [0.15, 0.65] };

      // band ladder, combo-weighted
      const acc = {};
      let barNum = 0, barDen = 0;
      let cMin = Infinity, cMax = -Infinity, out01 = 0, envBad = 0;
      for (const k of live) {
        const c = model.cells[k], b = bandOf[k.split('|')[0]];
        if (!acc[b]) acc[b] = [0, 0];
        acc[b][0] += c.combos * c.cooler; acc[b][1] += c.combos;
        barNum += c.combos * c.cooler; barDen += c.combos;
        if (c.cooler < cMin) cMin = c.cooler;
        if (c.cooler > cMax) cMax = c.cooler;
        if (!(c.cooler >= 0 && c.cooler <= 1)) out01++;
        if (c.cooler < ENV.cell[0] || c.cooler > ENV.cell[1]) envBad++;
      }
      const mean = (b) => (acc[b] ? acc[b][0] / acc[b][1] : NaN);
      const aa = mean('AA'), bp = mean('BIGPAIR'), sp = mean('SMALLPAIR');
      const ladder = bp - aa >= stepMin && sp - bp >= stepMin;

      // SSA vs SS, same row
      const badSSA = [];
      let rowsBoth = 0, strictRows = 0, thinnest = Infinity;
      for (const r of model.rows) {
        const a = model.cells[r.key + '|SSA'], b = model.cells[r.key + '|SS'];
        if (!a || !b || !a.combos || !b.combos) continue;
        rowsBoth++;
        const d = a.cooler - b.cooler;
        if (d < 0) { strictRows++; thinnest = Math.min(thinnest, -d); }
        if (!(d <= tolSSA)) badSSA.push(`${r.key} SSA-SS +${d.toFixed(3)}`);
      }

      // rank anchors
      const byCooler = live.slice().sort((x, y) => model.cells[y].cooler - model.cells[x].cooler);
      const rankTop = byCooler.indexOf('DBLPAIR_SMALL|RB') + 1;
      const rankBot = byCooler.length - byCooler.indexOf('AA_BIGPAIR|DS');
      const barErr = Math.abs(barNum / barDen - (model.constants.coolerBarMeasured ?? NaN));

      const pass = out01 === 0 && envBad === 0 && ladder && badSSA.length === 0
        && rowsBoth >= 15 && rankTop >= 1 && rankTop <= rankMax && rankBot >= 1 && rankBot <= rankMax
        && barErr <= 0.002;
      G('I24', pass,
        `cooler band ladder AA ${aa.toFixed(4)} < big pairs ${bp.toFixed(4)} < small pairs ` +
        `${sp.toFixed(4)} (steps +${(bp - aa).toFixed(4)} / +${(sp - bp).toFixed(4)}, floor ${stepMin}); ` +
        `cooler(SSA) <= cooler(SS) + ${tolSSA} in ${rowsBoth - badSSA.length}/${rowsBoth} rows carrying ` +
        `both columns, ${strictRows}/${rowsBoth} strictly (thinnest margin ${thinnest.toFixed(3)}, ` +
        `about 1 SE — the tolerance is why this is not a coin flip); DBLPAIR_SMALL|RB rank ${rankTop} ` +
        `and AA_BIGPAIR|DS rank ${rankBot} from the bottom, of ${live.length} cells, both within ` +
        `${rankMax}; range ${cMin.toFixed(3)}-${cMax.toFixed(3)} over ${live.length} cells, ` +
        `${out01} outside [0,1], ${envBad} outside the ` +
        `measured envelope; coolerBarMeasured rebuilds to ${barErr.toFixed(5)} of 0.002` +
        (badSSA.length ? ` — SSA/SS reversals: ${badSSA.slice(0, 3).join('; ')}` : '') +
        (ladder ? '' : ' — BAND LADDER BROKEN'));
    }
    } },

    { ids: ['I25'], label: 'the villain-VPIP lattice', run: () => {
    // =======================================================================
    // I25 — the villain-VPIP lattice, asserted as MEASURED rather than as predicted.
    //
    // V2-PLAN §2.3 wrote three expected shapes before the measurement existed, to be turned into
    // gate directions afterwards. Two survived contact with the data and one did not, and this
    // gate is written to the data:
    //
    //   (a) v=90 IS close to random, but it is not equal to it. Measured: mean |delta| 0.81 pt
    //       over 123 cells x 7 N, worst cell 3.6 pt (`BROADWAY_RUN|RB`), because the v=90 pool is
    //       the deck minus its worst tenth and removing that tenth is not nothing to a broadway
    //       hand. A "v=90 == random" gate with a tolerance under ~4 pt would FAIL. Pinned here at
    //       max |delta| <= 5.0 and mean |delta| <= 1.2, i.e. ~39% and ~48% headroom on the
    //       measurement, with the mean carrying the weight because it is the stable statistic.
    //       Reinforced by the convergence shape: mean |delta| falls monotonically along the
    //       lattice, measured 4.19 / 3.10 / 2.40 / 1.76 / 0.81 pt at v = 25 / 40 / 55 / 70 / 90.
    //
    //   (b) The plan expected junk to lose most at v=25. It does not, and that claim is NOT
    //       written into this gate. Measured, what a tight pool punishes is RANK OVERLAP, not
    //       weakness: the six worst cells at v=25 are broadway hands playing into domination
    //       against a broadway-heavy pool, and `TRASH|RB` actually GAINS multiway (-1.0 at N=1,
    //       +2.7 at N=3), as does `SMPAIR_JUNK|SS`. Asserted as measured anchors: the six most
    //       negative cells at N = 1, 3 and 5 all lie in rows {BROADWAY_RUN, RUN0_HIGH} (the first
    //       cell outside those rows sits 1.4 pt further in at the tightest N), with
    //       `BROADWAY_RUN|RB` <= -15 at N=1 (measured -25.8) and `RUN0_HIGH|DS` <= -8 at N=3
    //       (measured -14.4).
    //
    //   (c) The low rundowns gain, and gain most — this is the headline number of v2 and it
    //       survived. Asserted with the SIGN, not just the magnitude: the six most positive cells
    //       at N = 1, 3, 5 all lie in rows {RUN0_LOW, RUN1_TOPMID, RUN1_BOTTOM}; every RUN0_LOW
    //       cell is positive at every N (measured `RUN0_LOW|DS` +8.7 / +9.6 / +8.2 at N = 1/3/5);
    //       and `RUN0_LOW|SSA` >= +5 at N=1 and N=3 (measured +11.2 and +12.5).
    //
    //   (d) The scope statement for I4/I5, as a positive assertion: the combo-weighted mean delta
    //       is negative at EVERY lattice point (measured -1.36 at v=25 through -0.67 at v=90).
    //       That is precisely why conservation does not apply to filtered-villain data — a hero
    //       drawn from the whole deck faces opponents drawn from better than the whole deck. See
    //       the scope comment on V1/I5 and V2/V3/I4 above, and METHODOLOGY §3.3.
    const live = Object.keys(model.cells).filter((k) => model.cells[k].combos > 0);
    const V = (model.constants.villainLattice && model.constants.villainLattice.v) || [];
    const NM = model.meta.nMax || 5;
    const shaped = V.length > 0 && live.every((k) => Array.isArray(model.cells[k].vDelta)
      && model.cells[k].vDelta.length === V.length
      && model.cells[k].vDelta.every((r) => r.length === NM));
    if (!shaped) {
      G('I25', false, `no villain-VPIP lattice of the expected shape (${V.length} rows x ${NM} N) on ` +
        `this dataset — it predates V2-PLAN §2.3; regenerate with scripts/generate-data.mjs`);
    } else {
      const tolMax = fast ? 8.0 : 5.0;
      const tolMean = fast ? 2.0 : 1.2;
      const dropMin = fast ? 0.05 : 0.2;
      const anchLose = fast ? [-10, -5] : [-15, -8];
      const anchGain = fast ? 3 : 5;

      const stat = V.map((v, vi) => {
        let sum = 0, sumAbs = 0, n = 0, max = 0, maxAt = '';
        for (const k of live) {
          const row = model.cells[k].vDelta[vi];
          for (let j = 0; j < NM; j++) {
            sum += row[j]; sumAbs += Math.abs(row[j]); n++;
            if (Math.abs(row[j]) > max) { max = Math.abs(row[j]); maxAt = `${k} N=${j + 1}`; }
          }
        }
        return { v, mean: sum / n, meanAbs: sumAbs / n, max, maxAt };
      });
      const hi = stat[stat.length - 1];
      const converged = hi.v >= 85 && hi.max <= tolMax && hi.meanAbs <= tolMean;
      let monotone = true;
      for (let i = 1; i < stat.length; i++) if (!(stat[i - 1].meanAbs - stat[i].meanAbs >= dropMin)) monotone = false;
      const allNeg = stat.every((s) => s.mean < 0);

      const lo = Math.max(0, V.indexOf(25));
      const at = (k, n) => model.cells[k].vDelta[lo][n - 1];
      const LOSE = new Set(['BROADWAY_RUN', 'RUN0_HIGH']);
      const GAIN = new Set(['RUN0_LOW', 'RUN1_TOPMID', 'RUN1_BOTTOM']);
      const badLose = [], badGain = [];
      for (const n of [1, 3, 5].filter((x) => x <= NM)) {
        const arr = live.map((k) => [k, at(k, n)]).sort((a, b) => a[1] - b[1]);
        for (const [k, d] of arr.slice(0, 6)) if (!LOSE.has(k.split('|')[0])) badLose.push(`N=${n} ${k} ${d}`);
        for (const [k, d] of arr.slice(-6)) if (!GAIN.has(k.split('|')[0])) badGain.push(`N=${n} ${k} ${d}`);
      }
      const rlNegative = live.filter((k) => k.startsWith('RUN0_LOW|')
        && model.cells[k].vDelta[lo].some((d) => d <= 0));
      const anchors = [
        ['BROADWAY_RUN|RB N=1', at('BROADWAY_RUN|RB', 1), at('BROADWAY_RUN|RB', 1) <= anchLose[0]],
        ['RUN0_HIGH|DS N=3', at('RUN0_HIGH|DS', 3), at('RUN0_HIGH|DS', 3) <= anchLose[1]],
        ['RUN0_LOW|SSA N=1', at('RUN0_LOW|SSA', 1), at('RUN0_LOW|SSA', 1) >= anchGain],
        ['RUN0_LOW|SSA N=3', at('RUN0_LOW|SSA', 3), at('RUN0_LOW|SSA', 3) >= anchGain],
      ];
      const badAnchor = anchors.filter((a) => !a[2]);

      const pass = converged && monotone && allNeg && badLose.length === 0 && badGain.length === 0
        && rlNegative.length === 0 && badAnchor.length === 0;
      G('I25', pass,
        `v=${hi.v} converges on the random-villain baseline: mean |delta| ${hi.meanAbs.toFixed(2)} pt ` +
        `of ${tolMean}, worst cell ${hi.max.toFixed(1)} of ${tolMax} (${hi.maxAt}) — close to random, ` +
        `not equal to it; mean |delta| falls monotonically along the lattice ` +
        `${stat.map((s) => s.meanAbs.toFixed(2)).join(' / ')} at v=${V.join('/')}; ` +
        `at v=${V[lo]} the six worst cells at N=1/3/5 are all BROADWAY_RUN or RUN0_HIGH (rank overlap, ` +
        `not weakness — TRASH|RB measures ${at('TRASH|RB', 1)} at N=1 and ` +
        `${NM >= 3 ? at('TRASH|RB', 3) : 'n/a'} at N=3, a GAIN, which is why the plan's ` +
        `"junk loses most" prediction is not asserted here) and the six best are all RUN0_LOW, ` +
        `RUN1_TOPMID or RUN1_BOTTOM, every RUN0_LOW cell gaining at every N; anchors ` +
        `${anchors.map((a) => `${a[0]} ${a[1] > 0 ? '+' : ''}${a[1]}`).join(', ')}; ` +
        `combo-weighted mean delta negative at every lattice point ` +
        `(${stat.map((s) => s.mean.toFixed(2)).join(' / ')}) — the filtered field is not uniform, ` +
        `which is the reason I4/I5 stay scoped to random villains` +
        (badLose.length ? ` — unexpected loser ${badLose[0]}` : '') +
        (badGain.length ? ` — unexpected gainer ${badGain[0]}` : '') +
        (rlNegative.length ? ` — RUN0_LOW not gaining: ${rlNegative[0]}` : '') +
        (badAnchor.length ? ` — anchor missed: ${badAnchor.map((a) => `${a[0]} ${a[1]}`).join('; ')}` : ''));
    }
    } },
    ],
  };
}
