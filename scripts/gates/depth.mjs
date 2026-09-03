// gates I23 I27 I28 — the depth axis (V2-PLAN §3.1).
//
// The plan's anchor set, pinned to the measurement rather than to the plan: two of its four
// anchors survived as written, one had to be restated in score RANK instead of tier (a tier is a
// percentile cut, not a property of a cell), and one is FALSE and is asserted in its falsified
// form. I27 and I28 re-run I16's continuity and I21's painted widening at both ends of the
// slider, which is how a depth effect is told apart from a field effect.
//
// One block, three gates: the six-depth grid is solved once and all three read it.

import { ROW_ORDER, COL_ORDER } from '../lib/taxonomy.mjs';
import * as P from '../lib/policy.mjs';
import { TOTAL, VPIP_GRID, NODES } from './_shared.mjs';

export const family = 'depth';
export const title = 'the depth axis (V2-PLAN §3.1) and its two endpoint re-runs';
export const ids = ['I23', 'I27', 'I28'];

export function build(ctx) {
  const { model, fast, G } = ctx;

  return {
    sections: [
    // =========================================================================
    // I23 / I27 / I28 — the depth axis (V2-PLAN §3.1)
    // =========================================================================
    { ids: ['I23', 'I27', 'I28'], label: 'the depth anchors + endpoint re-runs', run: () => {
    // The grid the depth gates sweep. Six points, geometric-ish, containing the slider's own
    // detents (40 / 100 / 200) and both endpoints. The per-cell monotonicity claims below were
    // ALSO checked on a 5 bb grid (43 points) during calibration and hold there identically; the
    // coarse grid is what ships because it costs 630 solves instead of 4,515 and asserts the same
    // thing. Where the fine grid disagreed with the coarse one, it is said so at the clause.
    //   Pinned, not derived from `depth.min` / `depth.max`: every threshold below was measured on
    // this grid, so a changed slider domain has to re-measure them rather than silently re-aim.
    const DGRID = [40, 60, 100, 150, 200, 250];
    const D100 = DGRID.indexOf(100);
    const solveD = (node, pos, vp, d) => P.solve(model, { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO', d });
    const dSweep = [];
    for (const node of NODES) {
      for (const pos of P.POSITIONS) {
        if (P.positionDisabled(pos, node)) continue;
        for (const vp of VPIP_GRID) dSweep.push({ node, pos, vp, out: DGRID.map((d) => solveD(node, pos, vp, d)) });
      }
    }
    const flat = dSweep.filter((s) => s.node !== '3bet');   // the 3-bet node cuts on eqMix, which
    // is depth-independent, so score RANK there cannot move with depth and a rank claim over it
    // would be vacuous. Its depth behaviour is asserted through the thresholds instead (I15 and
    // the unit tests); the rank clauses below are scoped to the three percentile nodes.

    {
      // -------------------------------------------------------------------
      // I23 — the depth dial moves the grid in the direction it claims to.
      //
      // V2-PLAN §3.1 wrote four anchors before the curves existed, to be pinned after calibration.
      // TWO SURVIVED AS WRITTEN, ONE HAD TO BE RESTATED IN A DIFFERENT UNIT, AND ONE IS FALSE.
      // This gate is written to the measurement, the way I24 and I25 are.
      //
      //  (a) SURVIVED. "AA72r-type cells: tier non-increasing as d rises; at 40 bb they gain a
      //      tier somewhere." `AA_DANGLER x RB` is that class (I14 names it). Measured: 0
      //      monotonicity violations over the grid AND over a 5 bb grid, at all 105 settings; it
      //      gains a tier at 40 bb against 100 bb at 8 of them (raise/BTN and raise/SB, where bare
      //      aces are a shove rather than a hand) and moves at all at 44. Bare aces are the
      //      textbook short-stack hand and the model now says so.
      //
      //  (b) RESTATED — the unit was wrong, not the direction. "JT98ds / rundown-DS cells:
      //      tier non-decreasing with depth" is not assertable as written, for a structural reason
      //      worth stating once: A TIER HERE IS A PERCENTILE CUT, NOT A PROPERTY OF THE CELL. A
      //      mid-pack cell whose own M_deep rises can still be demoted, because the cells above it
      //      rose faster and the cut moved past it. Measured, the two ends of the claim fail in
      //      opposite ways: `RUN0_HIGH x DS` and `BROADWAY_RUN x DS` never change tier at any depth
      //      at any of the 105 settings (the claim is true and vacuous), while `RUN2 x DS` and
      //      `RUN1_TOPMID x DS` change tier in BOTH directions (the claim is false and not
      //      because the model is wrong about them).
      //        In SCORE RANK, which is a property of the cell, the claim holds and is worth having:
      //      `BROADWAY_RUN x DS` never loses a single rank as depth rises, at any setting, on
      //      either grid, and gains up to 26 places from 40 bb to 250; `RUN0_HIGH x DS` and
      //      `x SS` finish better at 250 than at 40 at 75/75 and 70/75 settings.
      //
      //  (c) FALSE where it names the low rundowns, and asserted here in its falsified form, so it
      //      cannot be quietly restored. `RUN0_LOW x DS` — 5432ds and the wheel — gets WORSE with
      //      depth: its rank at 250 is worse than at 40 at 49 of 75 settings and better at 9. The
      //      reason is measured, not modelled: the RUN0_LOW ROW carries a combo-weighted `cooler`
      //      of 0.4268 — the highest of the seven rundown rows (RUN1_TOPMID 0.3997, RUN1_BOTTOM
      //      0.3924, RUN3 0.3896, RUN2 0.3846, RUN0_HIGH 0.3335, BROADWAY_RUN 0.2750) and the
      //      figure `rowMean('RUN0_LOW')` prints in the detail line below. Read at the CELL, x DS
      //      is 0.422 and x RB is 0.437; it is the row that is the band's worst, not one column of
      //      it. Both readings are well above the 0.40 bar, while the cell's nu of 0.43 is a
      //      whisker over
      //      nuBar — so the mu term overrules the lambda term and the low rundown is the one
      //      rundown the depth axis punishes. That is the correct poker answer (the low end of a
      //      straight is what gets stacked deep) and it is the single most useful thing the depth
      //      dial says that the VPIP dial cannot.
      //
      //  (d) SURVIVED. Painted-width drift across the whole depth range, in the I21 dip-allowance
      //      pattern: worst measured 3.16 points (rfi/BTN at VPIP 70, 46.5% at 40-60 bb against
      //      49.6% from 100 up — one cell crossing the cut), against I21's own 4.0-point allowance.
      //      The painted range also never collapses: narrowest 12.6% at any depth (rfi/UTG, VPIP
      //      25, 40 bb) against I12's 10% floor.
      //
      //  (e) And the model still holds together at the ends of the slider: I7, I8, I9, I13 and I19
      //      are re-run at 40 and 250 bb and all hold. Depth re-sorts the grid; it must not break
      //      the things that make the grid a grid.
      //
      //  (g) ADDED AT P1 (V3-PLAN item 7, brief §5.2). WHAT KIND of re-sort the dial is, asserted
      //      rather than described, so "the docs and the numbers currently disagree" cannot recur.
      //      §3.1's re-weight-or-re-describe rule is RUN against the measurement at the clause
      //      below, with the candidate re-weightings and what each one breaks written out there.
      //
      // WHAT THIS GATE DELIBERATELY DOES NOT ASSERT. V2-PLAN §3.1's third anchor — "big-pair rows
      // with pair rank J/T demoted at 200 bb relative to 100 bb, VIA THE mu*cooler TERM
      // SPECIFICALLY" — is half false and the half that is false is the half the taxonomy cannot
      // express, exactly as happened to §2.1's five-step cooler ladder (I24). `rowOf` splits pairs
      // at J, so JJ/QQ/KK share the big-pair band and TT sits with the small pairs. Combo-weighted,
      // the BIG-pair band's cooler is 0.3563 — BELOW the 0.40 bar — so the mu term PROMOTES 21 of
      // its 23 cells with depth; the small-pair band is 0.4386, above the bar, and is the band the
      // mu term actually demotes. Measured at 200 bb against 100 bb: 46 big-pair demotions, every
      // one of them attributable to lambda (low nu) and NOT ONE to mu; and 92 mu-attributable
      // demotions spread over 7 cells, every one of them a small pair or `RUN0_LOW`. What this
      // gate asserts, therefore, is the measured version: mu-attributable demotions exist, and none
      // of them is a big pair. Separating JJ from TT is new rows, not a new constant.
      //
      // Attribution is computed, not asserted: for each demoted cell the two halves of M_deep are
      // evaluated separately at d = 200, and the demotion is called mu-attributable only when the
      // cooler half is negative AND larger in magnitude than the nu half.
      const bandOfRow = {};
      for (const r of model.rows) bandOfRow[r.key] = r.band;
      const KD = P.CONSTANTS.depth;
      const tolViol = fast ? 4 : 0;       // fast: 10k-trial equities move cells across cuts
      const tolGain = fast ? 2 : 4;       // measured 8
      const tolNet = fast ? 45 : 60;      // measured 75 / 75 and 70 / 75
      const tolDrift = fast ? 0.06 : 0.04;
      const tolFloor = fast ? 0.08 : 0.10;

      // (a) the AA72r class
      let aViol = 0, aGain = 0, aMoves = 0, aFirst = '';
      for (const s of dSweep) {
        const seq = s.out.map((o) => o.cells['AA_DANGLER|RB'].wouldBe);
        for (let i = 1; i < seq.length; i++) {
          if (P.TIER_RANK[seq[i]] > P.TIER_RANK[seq[i - 1]]) {
            aViol++;
            if (!aFirst) aFirst = `${s.node}/${s.pos}@${s.vp} d${DGRID[i - 1]}->${DGRID[i]} ${seq[i - 1]}->${seq[i]}`;
          }
        }
        if (P.TIER_RANK[seq[0]] > P.TIER_RANK[seq[D100]]) aGain++;
        if (new Set(seq).size > 1) aMoves++;
      }

      // (b) / (c) score rank, on the three percentile nodes
      const rankOf = (s, i, k) => s.out[i].cells[k].rank;
      let bwViol = 0, bwFirst = '';
      const netBetter = (k) => flat.filter((s) => rankOf(s, DGRID.length - 1, k) < rankOf(s, 0, k)).length;
      const netWorse = (k) => flat.filter((s) => rankOf(s, DGRID.length - 1, k) > rankOf(s, 0, k)).length;
      for (const s of flat) {
        for (let i = 1; i < DGRID.length; i++) {
          if (rankOf(s, i, 'BROADWAY_RUN|DS') > rankOf(s, i - 1, 'BROADWAY_RUN|DS')) {
            bwViol++;
            if (!bwFirst) bwFirst = `${s.node}/${s.pos}@${s.vp} d${DGRID[i - 1]}->${DGRID[i]}`;
          }
        }
      }
      const hiDS = netBetter('RUN0_HIGH|DS'), hiSS = netBetter('RUN0_HIGH|SS');
      const loW = netWorse('RUN0_LOW|DS'), loB = netBetter('RUN0_LOW|DS');

      // (c) mu attribution at 200 bb against 100 bb
      const u200 = P.depthU(200);
      const nuHalf = (c) => KD.lambda * u200 * (c.nu - P.CONSTANTS.nuBar);
      const coHalf = (c) => -KD.mu * u200 * (c.cooler - KD.coolerBar);
      const i200 = DGRID.indexOf(200);
      const muCells = new Map(), lamBig = new Map();
      let muHits = 0, bigDemotions = 0;
      for (const s of dSweep) {
        const A = s.out[D100].cells, B = s.out[i200].cells;
        for (const k of Object.keys(A)) {
          if (P.TIER_RANK[B[k].wouldBe] >= P.TIER_RANK[A[k].wouldBe]) continue;
          const c = model.cells[k], band = bandOfRow[k.split('|')[0]];
          if (band === 'BIGPAIR') bigDemotions++;
          if (c.cooler != null && coHalf(c) < 0 && Math.abs(coHalf(c)) > Math.abs(nuHalf(c))) {
            muCells.set(k, (muCells.get(k) || 0) + 1); muHits++;
          } else if (band === 'BIGPAIR') lamBig.set(k, (lamBig.get(k) || 0) + 1);
        }
      }
      const muBigPair = [...muCells.keys()].filter((k) => bandOfRow[k.split('|')[0]] === 'BIGPAIR');
      const rowMean = (row) => {
        let n = 0, d = 0;
        for (const col of COL_ORDER) {
          const c = model.cells[row + '|' + col];
          if (!c || !c.combos) continue;
          n += c.combos * c.cooler; d += c.combos;
        }
        return d ? n / d : NaN;
      };
      const bandMean = (b) => {
        let n = 0, d = 0;
        for (const k of Object.keys(model.cells)) {
          const c = model.cells[k];
          if (!c.combos || bandOfRow[k.split('|')[0]] !== b) continue;
          n += c.combos * c.cooler; d += c.combos;
        }
        return d ? n / d : NaN;
      };

      // (d) painted width across depth
      let drift = 0, driftAt = '', minPainted = 1, minAt = '';
      for (const s of flat) {
        const ws = s.out.map((o) => o.width);
        const at100 = ws[D100];
        for (let i = 0; i < ws.length; i++) {
          if (Math.abs(ws[i] - at100) > drift) { drift = Math.abs(ws[i] - at100); driftAt = `${s.node}/${s.pos}@${s.vp} d${DGRID[i]}`; }
        }
        if (s.node !== 'raise') {
          const lo = Math.min(...ws);
          if (lo < minPainted) { minPainted = lo; minAt = `${s.node}/${s.pos}@${s.vp}`; }
        }
      }

      // (f) the positional spread — the third depth term, and the one with a failure mode the
      // other clauses cannot see. `base(p)^(1 + beta*u)` is order-preserving only while the
      // exponent is POSITIVE, i.e. while |beta| < 1; at beta = 1.2 the exponent is -0.2 at 40 bb
      // and the seats INVERT — the small blind realizes better than the button. Nothing else in
      // this gate notices, because an inverted seat table still paints plausible widths and still
      // satisfies every structural invariant (positional nesting is a cascade, so it enforces the
      // order it is given). So the order is asserted directly, at both ends, along with the claim
      // the term exists to make: the spread is strictly wider deep than shallow.
      const seatOrder = [...P.POSITIONS].sort((a, b) => P.CONSTANTS.baseR[a] - P.CONSTANTS.baseR[b]);
      const spreadAt = (d) => P.baseRealization(seatOrder[seatOrder.length - 1], d) - P.baseRealization(seatOrder[0], d);
      const orderKept = [P.CONSTANTS.depth.min, P.CONSTANTS.depth.ref, P.CONSTANTS.depth.max].every((d) => {
        for (let i = 1; i < seatOrder.length; i++) {
          if (!(P.baseRealization(seatOrder[i], d) > P.baseRealization(seatOrder[i - 1], d))) return false;
        }
        return true;
      });
      const spreadWidens = spreadAt(P.CONSTANTS.depth.max) > spreadAt(P.CONSTANTS.depth.ref)
        && spreadAt(P.CONSTANTS.depth.ref) > spreadAt(P.CONSTANTS.depth.min);

      // (g) WHAT KIND OF RE-SORT THE DIAL IS — V3-PLAN item 7, brief §5.2, decided here rather than
      // described here.
      //
      // brief §5.2's finding: the dial is DOCUMENTED as a nut-potential re-sort and MEASURED as a
      // cooler re-sort. CO RFI, 40 -> 250bb: corr(rank move, nu) = +0.191 against
      // corr(rank move, cooler) = -0.414. "Either re-weight lambda/mu, or re-describe the dial. The
      // docs and the numbers currently disagree."
      //
      // §3.1 SETS THE DECISION RULE, and it is a rule and not a preference: re-weight ONLY if a
      // re-weighting keeps I23(a-c) green while making corr(rank move, nu) dominant; otherwise
      // re-describe. THE RULE WAS RUN, ON THE MEASUREMENT, BEFORE ANY PROSE WAS WRITTEN — and
      // re-run on THIS CLAUSE'S OWN BASIS before it was written down, which is why the shipped row
      // reproduces the number the detail line prints rather than sitting a few points off it:
      // 9,225 cell-settings, the three percentile nodes over the six-depth grid, rank(40) - rank(250).
      // ONE TRAP, RECORDED because it silently produced a first version of this table in which all
      // five rows were identical: `solve` memoises on model hash x envKey, and lambda/mu are
      // CONSTANTS rather than axes, so they are not in that key. A sweep per candidate must call
      // `P.clearSolveMemo()` first or every candidate reads the shipped weights' cached answer.
      //
      //     lambda  mu    corr(nu)  corr(cooler)  nu dominant?  I23(a)  I23(b)  I23(c)  RUN0_LOW w/b
      //     0.25    0.60   +0.1770    -0.4162         no         pass    pass    pass    49 / 9  <- shipped
      //     0.25    0.30   +0.2663    -0.2099         YES        pass    pass    FAIL     0 / 73
      //     0.25    0.15   +0.3017    -0.0564         YES        pass    pass    FAIL     0 / 75
      //     0.50    0.60   +0.3124    -0.2563         YES        pass    pass    FAIL     0 / 70
      //     0.60    0.20   +0.3706    -0.0143         YES        pass    pass    FAIL     0 / 75
      //
      // EVERY re-weighting that makes nu dominant fails I23(c), and it fails it in the same place
      // every time: `RUN0_LOW x DS` stops getting worse with depth (49 settings worse / 9 better at
      // the shipped weights; 0 worse / 70-75 better at every candidate). That is not a coincidence
      // to be tuned around — mu's dominance IS the RUN0_LOW finding. Turning the dial into a
      // nut-potential re-sort deletes the single most useful thing it says.
      //
      // And the arithmetic is against it independently: lambda is anchored to kappa's own swing
      // (2*lambda = 0.50 against 0.520, so depth carries 96% of the authority field size has over
      // the same quantity) and mu to the two measurements' combo-weighted standard deviations
      // (lambda * sd(nu)/sd(cooler) = 0.25 * 0.0831/0.0353 = 0.589, rounded to 0.60). Every
      // candidate above breaks one anchor or the other, so a re-weighting does not merely fail
      // I23(c) — it ships an unanchored constant, which brief §2.1 puts out of scope.
      //
      // SO THE DIAL IS RE-DESCRIBED, AND THE MEASUREMENT IS ASSERTED HERE so the docs and the
      // numbers cannot re-diverge. METHODOLOGY §5.1 now says what this clause measures.
      const corrOf = (xs, ys) => {
        const n = xs.length;
        let mx = 0, my = 0;
        for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
        mx /= n; my /= n;
        let sxy = 0, sxx = 0, syy = 0;
        for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
        return sxy / Math.sqrt(sxx * syy);
      };
      const mv = [], mNu = [], mCo = [];
      for (const s of flat) {
        for (const k of Object.keys(s.out[0].cells)) {
          const c = model.cells[k];
          if (!c || !c.combos || c.cooler == null) continue;
          mv.push(s.out[0].cells[k].rank - s.out[DGRID.length - 1].cells[k].rank);
          mNu.push(c.nu); mCo.push(c.cooler);
        }
      }
      const corrNu = corrOf(mv, mNu), corrCo = corrOf(mv, mCo);
      // the shape brief §5.2 measured: nu positive, cooler negative and LARGER
      const coolerDominates = Math.abs(corrCo) > Math.abs(corrNu) && corrCo < 0 && corrNu > 0;

      // (e) the structural invariants, at both ends of the slider
      const struct = [];
      for (const i of [0, DGRID.length - 1]) {
        for (const s of dSweep) {
          const c = s.out[i].cells;
          const at = `d${DGRID[i]} ${s.node}/${s.pos}@${s.vp}`;
          if (c['AA_BIGPAIR|DS'].tier !== 'T1') struct.push(`I7 ${at}`);
          for (const k of ['TRASH|RB', 'TRIPS_SMALL|RB']) if (['T1', 'T2'].includes(c[k].tier)) struct.push(`I8 ${k} ${at}`);
          if (s.node !== '3bet' && Object.values(s.out[i].composition).reduce((a, b) => a + b, 0) !== TOTAL) struct.push(`I13 ${at}`);
          for (const row of ROW_ORDER) {
            let prev = null;
            for (const col of COL_ORDER) {
              const e = c[row + '|' + col];
              if (!e) continue;
              if (prev && P.TIER_RANK[e.wouldBe] < P.TIER_RANK[prev]) struct.push(`I9 ${at} ${row} ${col}`);
              prev = e.wouldBe;
            }
          }
          if (s.vp === model.meta.vpip.ref && s.node !== '3bet'
            && Object.keys(c).some((k) => c[k].tier === 'T2')) struct.push(`I19 ${at}`);
        }
      }

      const pass = aViol <= tolViol && aGain >= tolGain && aMoves > 0
        && bwViol <= tolViol && hiDS >= tolNet && hiSS >= tolNet && loW > loB
        && muHits > 0 && muBigPair.length === 0 && bigDemotions > 0
        && drift <= tolDrift && minPainted >= tolFloor && struct.length === 0
        && orderKept && spreadWidens && coolerDominates;
      G('I23', pass,
        `depth direction over d = ${DGRID.join('/')} bb at ${dSweep.length} (node, pos, VPIP) settings. ` +
        `(a) AA_DANGLER|RB (the AA72r class) never gains a tier as stacks deepen — ${aViol} violations ` +
        `of ${tolViol} allowed — and gains one at 40bb in ${aGain} settings (floor ${tolGain}), moving at ` +
        `${aMoves}. (b) tier monotonicity is NOT the right unit here (a tier is a percentile cut, not a ` +
        `property of a cell): asserted on score RANK, BROADWAY_RUN|DS loses no rank as depth rises ` +
        `(${bwViol} violations), and RUN0_HIGH|DS / |SS rank better at 250 than at 40 in ${hiDS} / ${hiSS} ` +
        `of ${flat.length} settings (floor ${tolNet}). (c) the plan's rundown claim is FALSE for the LOW ` +
        `rundowns and that is asserted, not dropped: RUN0_LOW|DS ranks worse at 250 than at 40 in ${loW} ` +
        `settings against ${loB} better — its ROW's combo-weighted cooler ${rowMean('RUN0_LOW').toFixed(4)} is ` +
        `the highest of the seven rundown rows (the cell itself reads ${model.cells['RUN0_LOW|DS'].cooler}), so the mu ` +
        `term overrules the lambda term. mu-attributable demotions at 200bb: ${muHits} over ` +
        `${muCells.size} cells (${[...muCells.keys()].slice(0, 4).join(', ')}), NONE of them a big pair — ` +
        `the big-pair band's cooler is ${bandMean('BIGPAIR').toFixed(4)}, BELOW the ${KD.coolerBar} bar, so ` +
        `mu promotes it; its ${bigDemotions} demotions are all lambda's (low nu), which is why §3.1's ` +
        `"J/T big pairs demoted via the mu term" is not asserted. The small-pair band, ` +
        `${bandMean('SMALLPAIR').toFixed(4)}, is the one mu punishes. (d) painted width drifts at most ` +
        `${(drift * 100).toFixed(2)} pts from its 100bb value (${driftAt}, allowance ${(tolDrift * 100).toFixed(1)}` +
        `${fast ? ', widened from I21\'s 4.0 for 10k-trial data' : ' — I21\'s'}) and never falls below ` +
        `${(minPainted * 100).toFixed(1)}% (${minAt}, floor ${(tolFloor * 100).toFixed(0)}%` +
        `${fast ? ', widened from I12\'s 10%' : ' — I12\'s'}). (e) I7/I8/I9/I13/I19 all hold at 40 and 250 bb. ` +
        `(f) the seats keep their order at 40/100/250 and the best-to-worst realization spread ` +
        `widens with depth: ${[P.CONSTANTS.depth.min, P.CONSTANTS.depth.ref, P.CONSTANTS.depth.max].map((d) => spreadAt(d).toFixed(4)).join(' -> ')}. ` +
        `(g) WHAT KIND OF RE-SORT THIS IS, asserted rather than described (V3-PLAN item 7, brief §5.2). Over ` +
        `${mv.length.toLocaleString()} cell-settings, rank movement 40 -> 250bb correlates ` +
        `${corrNu >= 0 ? '+' : ''}${corrNu.toFixed(4)} with nu and ${corrCo.toFixed(4)} with cooler: **the depth ` +
        `dial is a COOLER re-sort, not a nut-potential one**, and the docs now say so. §3.1's decision rule was ` +
        `RUN, not assumed — every lambda/mu re-weighting that makes nu dominant (0.25/0.30, 0.25/0.15, 0.50/0.60, ` +
        `0.60/0.20) FAILS clause (c) in the same place: RUN0_LOW|DS stops falling with depth (49 worse / 9 better ` +
        `shipped, against 0 / 70-75 at every candidate), because mu's dominance IS the RUN0_LOW finding. Both ` +
        `constants are also anchored elsewhere — 2*lambda = ${2 * KD.lambda} against kappa's 0.520 swing, and ` +
        `mu = lambda * sd(nu)/sd(cooler) = 0.25 * 0.0831/0.0353 = 0.589 — so a re-weighting would ship an ` +
        `UNANCHORED constant on top of a failed gate. The rule therefore says re-describe, and this clause is ` +
        `what stops the description drifting back` +
        (aFirst ? ` — (a) FAILS at ${aFirst}` : '') +
        (aGain >= tolGain ? '' : ` — (a) FAILS: ${aGain} gains at 40bb, floor ${tolGain}`) +
        (aMoves ? '' : ' — (a) FAILS: AA_DANGLER|RB never moves; the depth dial is inert') +
        (bwFirst ? ` — (b) FAILS at ${bwFirst}` : '') +
        (hiDS >= tolNet && hiSS >= tolNet ? '' : ` — (b) FAILS: RUN0_HIGH net-better ${hiDS}/${hiSS}, floor ${tolNet}`) +
        (loW > loB ? '' : ` — (c) FAILS: RUN0_LOW|DS no longer falls with depth (${loW} worse vs ${loB} better) — re-read the measurement before relaxing this`) +
        (muHits ? '' : ' — (c) FAILS: no mu-attributable demotion exists at 200bb; the cooler term is inert') +
        (bigDemotions ? '' : ' — (c) FAILS: the big-pair band is not demoted at all at 200bb') +
        (muBigPair.length ? ` — (c) FAILS: big pair ${muBigPair[0]} is mu-attributable` : '') +
        (drift <= tolDrift ? '' : ' — (d) FAILS: painted width drifts past the allowance') +
        (minPainted >= tolFloor ? '' : ' — (d) FAILS: the painted range collapses below the floor') +
        (struct.length ? ` — (e) FAILS: ${struct.slice(0, 3).join('; ')}` : '') +
        (orderKept ? '' : ' — (f) FAILS: the depth exponent inverts the seat order (|beta| must stay under 1)') +
        (spreadWidens ? '' : ' — (f) FAILS: the positional spread does not widen with depth') +
        (coolerDominates ? '' : ` — (g) FAILS: the dial is no longer the cooler re-sort METHODOLOGY §5.1 describes ` +
          `(nu ${corrNu.toFixed(4)}, cooler ${corrCo.toFixed(4)}). If lambda/mu were deliberately re-weighted, ` +
          `re-run §3.1's rule — a re-weighting is legal ONLY if (a)-(c) stay green — and rewrite §5.1 in the same ` +
          `commit. Do not widen this: the whole point is that the doc and the number move together`));
    }

    {
      // -------------------------------------------------------------------
      // I27 / I28 — I16 and I21, re-run at both ends of the depth slider.
      //
      // The two gates that hold the VPIP axis honest say nothing about it at 40 bb or 250 bb,
      // because both sweep at the v1 operating depth. Depth re-sorts the score ordering, which is
      // precisely the operation that could make the VPIP axis jump or collapse somewhere the
      // existing gates never look. So they are re-run at the endpoints, with the same assertions
      // and, where the measurement forced it, a stated widening.
      //
      // I27 (I16's continuity) passes at both ends with NO widening at all: the worst non-cliff
      // VPIP step changes 0 cells beyond the allowance at 40 and at 250, and the three deliberate
      // discontinuities are the same three I16 names at 100 bb (raise/HJ@45, raise/CO@54,
      // raise/BTN@70, where N_eff crosses 3.0). Depth does not move them because they are field
      // effects, which is the kappa/lambda separation showing up as a testable fact.
      //
      // I28 (I21's painted widening) passes at both ends, and its dip allowance is WIDENED from
      // I21's 4.0 to 6.5 points, with the reason measured rather than assumed. I21 sized 4.0 as
      // "half the largest single cell", against a worst measured drawdown of 3.2 points at 100 bb.
      // At 250 bb the worst event is bigger and is not a single cell: at rfi/BTN, VPIP 81 -> 82,
      // three cells exchange at once — `RUN3_DANGLER|SS` (4.79% of combos) enters the range while
      // `ACE_JUNK|SS` (3.16%) and `ACE_JUNK|FLAW` (2.29%) leave it — for a net drawdown of 5.45
      // points. Three cells is well inside I16's own 5-cell continuity allowance and the whole
      // event is smaller than the single largest cell in the taxonomy (`TRASH|SS`, 11.4%), so it is
      // the granularity both I16 and I21 already document, not a trend. 6.5 leaves ~19% headroom on
      // the measurement, the same margin I21 runs at. At 40 bb the worst dip is 2.1 points, i.e.
      // BETTER than at the operating depth.
      const dipAllow = fast ? 0.09 : 0.065;
      const rows = [];
      let ok27 = true, ok28 = true;
      const detail27 = [], detail28 = [], bad28 = [], cliffs = [];
      for (const d of [P.CONSTANTS.depth.min, P.CONSTANTS.depth.max]) {
        let worstCells = 0, worstAt = '', worstCombos = 0, worstDip = 0, worstDipAt = '';
        for (const node of ['rfi', 'limps', 'raise']) {
          for (const pos of P.POSITIONS) {
            if (P.positionDisabled(pos, node)) continue;
            let prev = null, runMax = -1, dip = 0, dipAt = 0, first = null, last = null;
            for (let vp = 25; vp <= 90; vp++) {
              const s = solveD(node, pos, vp, d);
              if (vp === 25) first = s.width;
              last = s.width;
              if (s.width > runMax) runMax = s.width;
              if (runMax - s.width > dip) { dip = runMax - s.width; dipAt = vp; }
              if (prev) {
                let nc = 0, nb = 0;
                for (const k of Object.keys(s.cells)) {
                  if (s.cells[k].wouldBe !== prev.cells[k].wouldBe) { nc++; nb += model.cells[k].combos; }
                }
                const atCliff = prev.N < 3 && s.N >= 3;
                const over = nb / TOTAL > 0.03 && nc > 5;
                if (over && !atCliff) {
                  if (nc > worstCells) { worstCells = nc; worstAt = `d${d} ${node}/${pos}@${vp}`; worstCombos = nb; }
                } else if (over) cliffs.push(`d${d} ${node}/${pos}@${vp}`);
              }
              prev = s;
            }
            if (last <= first) { ok28 = false; bad28.push(`d${d} ${node}/${pos} paints ${(last * 100).toFixed(1)}% at 90 vs ${(first * 100).toFixed(1)}% at 25`); }
            if (dip > dipAllow) { ok28 = false; bad28.push(`d${d} ${node}/${pos} dips ${(dip * 100).toFixed(1)} pts by VPIP ${dipAt}`); }
            if (dip > worstDip) { worstDip = dip; worstDipAt = `d${d} ${node}/${pos}@${dipAt}`; }
          }
        }
        if (worstCells) ok27 = false;
        detail27.push(`d${d}: worst non-cliff step ${worstCells} cells${worstCells ? ` (${(worstCombos / TOTAL * 100).toFixed(1)}% of combos) at ${worstAt}` : ''}`);
        detail28.push(`d${d}: largest dip ${(worstDip * 100).toFixed(1)} pts at ${worstDipAt}`);
        rows.push(d);
      }
      G('I27', ok27,
        `I16's continuity holds at both ends of the depth slider (${rows.join(' and ')} bb): every VPIP ` +
        `step changes at most 3% of combos or at most 5 of 145 cells — ${detail27.join('; ')}; the ` +
        `documented N_eff=3.0 discontinuities are unchanged by depth (${cliffs.join(', ') || 'none'}), ` +
        `which is the kappa(N) / lambda(d) separation as a testable fact: a field effect stays put when ` +
        `the stacks move`);
      G('I28', ok28,
        `I21's painted widening holds at both ends of the depth slider (${rows.join(' and ')} bb): the ` +
        `range is wider at VPIP 90 than at 25 at all 15 (node, position) pairs — ${detail28.join('; ')}. ` +
        `Dip allowance widened from I21's 4.0 to ${(dipAllow * 100).toFixed(1)} pts, because the worst ` +
        `event at 250 bb is a three-cell exchange (RUN3_DANGLER|SS in, ACE_JUNK|SS + ACE_JUNK|FLAW out, ` +
        `net 5.45 pts at rfi/BTN VPIP 82), not the single-cell flicker I21 sized 4.0 against — inside ` +
        `I16's own 5-cell allowance and smaller than the largest single cell (TRASH|SS, 11.4%)` +
        (bad28.length ? ` — FAILS: ${bad28.slice(0, 3).join('; ')}` : ''));
    }
    } },
    ],
  };
}
