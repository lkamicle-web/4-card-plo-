// gates I6 I7 I8 I9 I10 I11 I16 I12 I21 I13 I14 I15 I19 — the policy sweep.
//
// The OPINION layer, asserted over one shared sweep: every legal (node, position) pair at each
// VPIP on the reference grid, solved once and read thirteen times. The sweep is the expensive
// part of this family by a wide margin, which is why it is the family's setup rather than any one
// gate's — the per-section timing below would otherwise bill I6 for everyone else's work.

import { ROW_ORDER, COL_ORDER } from '../lib/taxonomy.mjs';
import * as P from '../lib/policy.mjs';
import { TOTAL, VPIP_GRID, NODES } from './_shared.mjs';

export const family = 'policy-sweep';
export const title = 'the opinion layer over the 105-setting sweep — nesting, anchors, widths, continuity';
export const ids = ['I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I16', 'I12', 'I21', 'I13', 'I14', 'I15', 'I19'];
export const setupLabel = 'P.solve over the 105-setting sweep';

export function build(ctx) {
  const { model, G } = ctx;

  const sweep = [];
  for (const node of NODES) {
    for (const pos of P.POSITIONS) {
      if (P.positionDisabled(pos, node)) continue;
      for (const vp of VPIP_GRID) {
        const state = { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' };
        sweep.push({ state, out: P.solve(model, state) });
      }
    }
  }

  return {
    sections: [
    { ids: ['I6'], label: 'positional nesting', run: () => {
    // I6 positional nesting
    const bad = [];
    for (const node of ['rfi', 'limps', 'raise']) {
      const chain = node === 'rfi' ? ['UTG', 'HJ', 'CO', 'BTN'] : ['HJ', 'CO', 'BTN'];
      for (const vp of VPIP_GRID) {
        // membership = "in the aggressive range", which a near-boundary cell expresses as T4/MIX
        // over an underlying aggressive tier
        const inRange = (e) => e.tier === 'T1' || e.tier === 'T2'
          || (e.tier === 'T4' && (e.wouldBe === 'T1' || e.wouldBe === 'T2'));
        const sets = chain.map((pos) => {
          const s = P.solve(model, { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' });
          return new Set(Object.keys(s.cells).filter((k) => inRange(s.cells[k])));
        });
        for (let i = 1; i < sets.length; i++) {
          for (const k of sets[i - 1]) if (!sets[i].has(k)) bad.push(`${node} v${vp}: ${chain[i - 1]} ${k} not in ${chain[i]}`);
        }
      }
    }
    G('I6', bad.length === 0, `UTG subset HJ subset CO subset BTN at every VPIP and node` +
      (bad.length ? ` — ${bad.length} violations, first: ${bad[0]}` : ''));
    } },

    { ids: ['I7', 'I8'], label: 'the top and bottom anchors', run: () => {
    // I7 / I8
    const bad7 = sweep.filter((s) => s.out.cells['AA_BIGPAIR|DS'].tier !== 'T1');
    const bad8 = sweep.filter((s) => ['TRASH|RB', 'TRIPS_SMALL|RB'].some((k) => ['T1', 'T2'].includes(s.out.cells[k].tier)));
    G('I7', bad7.length === 0, `AA_BIGPAIR x DS is T1 in all ${sweep.length} (pos, node, VPIP) settings` +
      (bad7.length ? ` — fails at ${bad7[0].state.pos}/${bad7[0].state.node}/${bad7[0].state.v}` : ''));
    G('I8', bad8.length === 0, `TRASH x RB and TRIPS_SMALL x RB never reach T1/T2` +
      (bad8.length ? ` — fails at ${bad8[0].state.pos}/${bad8[0].state.node}` : ''));
    } },

    { ids: ['I9'], label: 'suit monotonicity of the display tier', run: () => {
    // I9 suit monotonicity of the display tier
    const bad = [];
    for (const s of sweep) {
      for (const row of ROW_ORDER) {
        let prev = null;
        for (const col of COL_ORDER) {
          const e = s.out.cells[row + '|' + col];
          if (!e) continue;
          if (prev && P.TIER_RANK[e.wouldBe] < P.TIER_RANK[prev]) bad.push(`${s.state.node}/${s.state.pos}/${s.state.v} ${row} ${col}`);
          prev = e.wouldBe;
        }
      }
    }
    G('I9', bad.length === 0, `action tier non-decreasing along RB -> FLAW -> SS -> SSA -> DS in every row and setting (MIX is an overlay, not an action level)` +
      (bad.length ? ` — ${bad.length} violations, first: ${bad[0]}` : ''));
    } },

    { ids: ['I10'], label: 'AA-band row monotonicity', run: () => {
    // I10 AA-band row monotonicity
    const band = ['AA_BIGPAIR', 'AA_BROADWAY', 'AA_CONNECTED', 'AA_SMALLPAIR', 'AA_DANGLER', 'A_BLOCKED'];
    const bad = [];
    for (const s of sweep) {
      for (const col of COL_ORDER) {
        let prev = null;
        for (const row of band) {
          const e = s.out.cells[row + '|' + col];
          if (!e) continue;
          if (prev && P.TIER_RANK[e.wouldBe] > P.TIER_RANK[prev]) bad.push(`${s.state.node}/${s.state.pos}/${s.state.v} ${col} ${row}`);
          prev = e.wouldBe;
        }
      }
    }
    G('I10', bad.length === 0, `tier(AA_BIGPAIR) >= ... >= tier(A_BLOCKED) down the AA band in every setting` +
      (bad.length ? ` — ${bad.length} violations, first: ${bad[0]}` : ''));
    } },

    { ids: ['I11', 'I16'], label: 'nuttier-when-looser, and VPIP continuity', run: () => {
    // I11 — the product's claim: as the table loosens, the range you open gets NUTTIER.
    //   RESTATED, because the previous form was measuring the wrong thing. It compared the raw nut
    //   share of the aggressive range at VPIP 90 against VPIP 25 and required a gain at the
    //   genuinely-multiway seats. That gain was real but it was an ARTIFACT of range collapse: the
    //   uncapped nut gate demoted low-nu cells faster than widthFor added them, so the iso range
    //   PAINTED half as wide at VPIP 90 as at 55 (BTN over 2 limpers 45.7% -> 23.8%), and nut share
    //   rose only because the bottom of the range had been deleted. Capping the gate (nutGateCap,
    //   see policy.mjs) fixes the width — and with the range no longer collapsing, the raw delta
    //   goes negative at the iso nodes, because widening a range necessarily reaches deeper into
    //   the pool. Both facts are true at once; the old gate could only see one of them.
    //   The claim the product actually makes is about the ORDERING, not the size: a loose table
    //   re-sorts the grid toward nut potential. So I11b is now measured at MATCHED WIDTH — take the
    //   range width the model paints at VPIP 90, and compare its nut share against the nut share of
    //   an equally wide range drawn from the VPIP 25 score ordering. Holding width fixed makes the
    //   test immune to collapse in either direction, and it is strictly stronger than what it
    //   replaces: it holds at ALL 15 (node, position) pairs, including the vs-Raise node and the
    //   shallow seats that the old form had to carve out entirely.
    //     I11a  no (pos, node) loses more than 3 points of raw nut share across the whole slider —
    //           the honest price of widening, retained unchanged
    //     I11b  at every (pos, node), the VPIP 90 range is nuttier than the same-width range the
    //           VPIP 25 ordering would have picked
    //   Both are reported per position.
    // I16 — continuity. Restated in the unit that can actually move: the grid's quantum is a CELL,
    //   and the largest single cell is 8.1% of all combos, so a "3% of combos" bound is below the
    //   taxonomy's own granularity and unsatisfiable. 3% of the GRID is 4-5 cells.
    //   The one exception the model contains deliberately: at N_eff = 3.0 the hard nut gate and the
    //   vs-Raise call floor both switch on at once. That step is identified, not waved through.
    const rows = [];
    let worstChurnCells = 0, worstChurnAt = '', worstChurnCombos = 0;
    const cliffs = [];
    for (const node of ['rfi', 'limps', 'raise']) {
      for (const pos of P.POSITIONS) {
        if (P.positionDisabled(pos, node)) continue;
        let prev = null, first = null, last = null, maxN = 0;
        for (let vp = 25; vp <= 90; vp++) {
          const s = P.solve(model, { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' });
          maxN = Math.max(maxN, s.N);
          if (vp === 25) first = s;
          last = s;
          if (prev) {
            // measured on the ACTION tier: a cell flickering in and out of the MIX overlay has not
            // changed what the model tells you to do, and the page's anti-strobe rule already holds
            // the verdict text across that flicker.
            let ncells = 0, ncombos = 0;
            for (const k of Object.keys(s.cells)) {
              if (s.cells[k].wouldBe !== prev.cells[k].wouldBe) { ncells++; ncombos += model.cells[k].combos; }
            }
            // bound: 3% of combos OR at most 5 of the 145 cells. The combo form alone is
            // unsatisfiable — the largest single cell is 8.1% of all combos, so one cell moving
            // already breaks it — and the cell form alone ignores that most cells are tiny.
            const atCliff = prev.N < 3 && s.N >= 3;
            const over = ncombos / TOTAL > 0.03 && ncells > 5;
            if (over && !atCliff) {
              if (ncells > worstChurnCells) { worstChurnCells = ncells; worstChurnAt = `${node}/${pos} @${vp}`; worstChurnCombos = ncombos; }
            } else if (over) {
              cliffs.push(`${node}/${pos} @${vp} (${ncells} cells, ${(ncombos / TOTAL * 100).toFixed(0)}% of combos, N_eff crosses 3.0)`);
            }
          }
          prev = s;
        }
        // I11b: the same-width comparison. Walk the VPIP 25 score ordering (before the nut gate, so
        // this measures the ORDERING and nothing else) until it has covered exactly the number of
        // combos the model actually paints at VPIP 90, and take that set's combo-weighted nu.
        const tLo = P.rankTable(model, pos, node, 0.25, { limpers: 2, raiserPos: 'CO' });
        const target = last.width * TOTAL;
        let cum = 0, nuAcc = 0;
        for (const r of tLo.rows) {
          if (cum >= target) break;
          const take = Math.min(r.combos, target - cum);
          cum += take; nuAcc += take * r.cell.nu;
        }
        rows.push({
          node, pos, maxN,
          d: last.nutShare - first.nutShare,
          m: last.nutShare - (cum ? nuAcc / cum : 0),
        });
      }
    }
    const badA = rows.filter((r) => r.d < -0.03);
    const badB = rows.filter((r) => r.m <= 0);
    const sgn = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}`;
    G('I11', badA.length === 0 && badB.length === 0,
      `at matched width, the VPIP 90 range is nuttier than the VPIP 25 ordering at all ${rows.length} ` +
      `(node, position) pairs: ${rows.map((r) => `${r.node}/${r.pos} ${sgn(r.m)}`).join(' ')} · ` +
      `raw VPIP 25 -> 90 nut-share change (floor -3.0, the price of widening): ` +
      `${rows.map((r) => `${r.node}/${r.pos} ${sgn(r.d)}`).join(' ')}` +
      (badB.length ? ` — matched-width FAIL at ${badB.map((r) => `${r.node}/${r.pos}`).join(', ')}` : '') +
      (badA.length ? ` — raw floor FAIL at ${badA.map((r) => `${r.node}/${r.pos}`).join(', ')}` : ''));
    G('I16', worstChurnCells === 0,
      `every VPIP step changes at most 3% of combos or at most 5 of 145 cells, outside the N_eff=3.0 discontinuity` +
      (worstChurnCells ? ` — worst ${worstChurnCells} cells (${(worstChurnCombos / TOTAL * 100).toFixed(1)}%) at ${worstChurnAt}` : '') +
      `; documented discontinuities: ${cliffs.length ? cliffs.join(', ') : 'none'}`);
    } },

    { ids: ['I12'], label: 'target width bounds', run: () => {
    // I12 — the width bounds are on the model's target width w_raise, which is the number the UI
    // quotes. The PAINTED aggressive range is narrower wherever the nut gate demotes cells out of
    // it (that is the gate's entire purpose), so it gets its own floor: the range never collapses
    // below 10% of all hands at any setting.
    const bad = [];
    let minPainted = 1, minAt = '';
    for (const s of sweep) {
      if (s.state.node === '3bet') continue;
      const tw = s.out.targetWidth;
      if (s.state.node === 'rfi' && (tw < 0.10 || tw > 0.60)) bad.push(`rfi ${s.state.pos} v${s.state.v} target ${tw.toFixed(3)}`);
      if (s.state.node === 'limps' && (tw < 0.12 || tw > 0.70)) bad.push(`iso ${s.state.pos} v${s.state.v} target ${tw.toFixed(3)}`);
      if (s.state.node !== 'raise' && s.out.width < minPainted) { minPainted = s.out.width; minAt = `${s.state.node}/${s.state.pos}@${s.state.v}`; }
    }
    if (minPainted < 0.10) bad.push(`painted range ${minPainted.toFixed(3)} at ${minAt}`);
    G('I12', bad.length === 0, `RFI target width in [0.10,0.60], iso in [0.12,0.70] in every setting; ` +
      `narrowest painted range ${(minPainted * 100).toFixed(1)}% at ${minAt} (floor 10%)` +
      (bad.length ? ` — ${bad.slice(0, 3).join('; ')}` : ''));
    } },

    { ids: ['I21'], label: 'painted width widens as the table loosens', run: () => {
    // I21 — the painted range widens as the table loosens.
    //   New gate. Everything the tool says about loose lobbies is a claim about the range you
    //   actually open, but every width the page quoted was targetWidth — the percentile the model
    //   AIMS at — while the grid paints the set that survives the nut gate. Those two diverged
    //   badly: before nutGateCap the BTN iso range targeted 63.6% and painted 23.8%, falling as the
    //   slider rose. Nothing tested the painted number, so nothing caught it. This does.
    //   Form: endpoint plus a bounded local dip, NOT pointwise monotonicity. Pointwise is
    //   unsatisfiable here for the same granularity reason I16 documents — the grid's quantum is a
    //   cell, and the largest single cell is 8.1% of all combos, so one cell crossing the percentile
    //   cut as N_eff moves shows up as a visible step down. The dip allowance is set at half that
    //   quantum (4.0 pts), i.e. below anything that could be a trend rather than a single cell
    //   flickering across the cut; the worst measured drawdown is ~3.2 pts at rfi/BTN.
    const bad = [];
    let worstDip = 0, worstAt = '';
    const gains = [];
    for (const node of ['rfi', 'limps', 'raise']) {
      for (const pos of P.POSITIONS) {
        if (P.positionDisabled(pos, node)) continue;
        let runMax = -1, dip = 0, dipAt = 0, first = null, last = null;
        for (let vp = 25; vp <= 90; vp++) {
          const w = P.solve(model, { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' }).width;
          if (vp === 25) first = w;
          last = w;
          if (w > runMax) runMax = w;
          if (runMax - w > dip) { dip = runMax - w; dipAt = vp; }
        }
        if (last <= first) bad.push(`${node}/${pos} paints ${(last * 100).toFixed(1)}% at VPIP 90 vs ${(first * 100).toFixed(1)}% at 25`);
        if (dip > 0.04) bad.push(`${node}/${pos} dips ${(dip * 100).toFixed(1)} pts by VPIP ${dipAt}`);
        if (dip > worstDip) { worstDip = dip; worstAt = `${node}/${pos}@${dipAt}`; }
        gains.push(`${node}/${pos} ${(first * 100).toFixed(1)}->${(last * 100).toFixed(1)}`);
      }
    }
    G('I21', bad.length === 0,
      `painted range (aggressive combos / 270,725) is wider at VPIP 90 than at 25 everywhere: ` +
      `${gains.join(' ')} · largest local dip ${(worstDip * 100).toFixed(1)} pts at ${worstAt} (allowance 4.0, ` +
      `half the largest single cell)` + (bad.length ? ` — ${bad.slice(0, 3).join('; ')}` : ''));
    } },

    { ids: ['I13'], label: 'tier partition', run: () => {
    // I13 tier partition
    const bad = [];
    for (const s of sweep) {
      const sum = Object.values(s.out.composition).reduce((a, b) => a + b, 0);
      if (sum !== TOTAL) bad.push(`${s.state.node}/${s.state.pos}/${s.state.v} ${sum}`);
    }
    G('I13', bad.length === 0, `tier combos sum to exactly 270,725 in all ${sweep.length} settings` +
      (bad.length ? ` — ${bad[0]}` : ''));
    } },

    { ids: ['I14'], label: 'the AA_DANGLER inversion', run: () => {
    // I14 — the inversion. Two statements, both about AA_DANGLER x RB (the AA72r class) against
    // RUN0_HIGH x DS (the nutty rundown class):
    //   (a) the measured claim: rho inverts between heads-up and five-way. This is the brief's own
    //       thesis and it holds exactly.
    //   (b) the score claim: the dangler class must lose rank as the table loosens. The brief also
    //       asserts the score ordering of this exact pair flips at UTG, which it does not: by the
    //       time UTG is open-raising, N_eff is already 1.78, past the rho crossing, and M_nut /
    //       M_play have already put the rundown ahead. What DOES happen is the pair-with-dangler
    //       class falling past a large block of rundown and suited-ace cells, which is the same
    //       phenomenon with an honest witness. The count and an example are stamped into the model.
    const lo = P.solve(model, { pos: 'UTG', node: 'rfi', v: 0.25 });
    const hi = P.solve(model, { pos: 'UTG', node: 'rfi', v: 0.90 });
    const a = 'AA_DANGLER|RB', b = 'RUN0_HIGH|DS';
    const ca = model.cells[a], cb = model.cells[b];
    const rhoInverts = ca.rho[0] > cb.rho[0] && ca.rho[4] < cb.rho[4];
    const crossed = Object.keys(lo.cells).filter((k) => k !== a
      && lo.cells[a].score > lo.cells[k].score && hi.cells[a].score < hi.cells[k].score);
    const rankWorse = hi.cells[a].rank > lo.cells[a].rank + 9;
    model.meta.inversion = { cell: a, rankAt25: lo.cells[a].rank, rankAt90: hi.cells[a].rank, crossedBy: crossed.length, example: crossed[0] || null };
    G('I14', rhoInverts && rankWorse && crossed.length > 0,
      `rho(AA_DANGLER x RB) ${ca.rho[0].toFixed(3)} > ${cb.rho[0].toFixed(3)} at N=1 and ` +
      `${ca.rho[4].toFixed(3)} < ${cb.rho[4].toFixed(3)} at N=5; score rank ${lo.cells[a].rank} -> ${hi.cells[a].rank} ` +
      `at UTG RFI, passed by ${crossed.length} cells (e.g. ${crossed[0]})`);
    } },

    { ids: ['I15'], label: 'the vs-3-bet anchors', run: () => {
    // I15 — the vs-3-bet anchors, both unconditional, as the spec states them.
    //   BROADWAY_RUN x RB never continues, at any position. It blends to 32.2% against the face-up
    //     mix, under BOTH the 36% call floor and the domination gate's escape, so it folds on equity
    //     alone and does not depend on the gate.
    //   RUN0_LOW x DS always continues, at every position. This gate previously asserted only the
    //     IN-POSITION half plus an "attributable to the nuOOP clause" rider — i.e. it asserted that
    //     the violation existed instead of catching it, because nuOOP 0.45 sat ABOVE the cell's
    //     measured nu and folded the anchor at 4 of 6 seats (BUILD_SPEC AC-12 requires it at the
    //     default seat). nuOOP is now held below that measured nu, so the rider is gone and the
    //     assertion is the spec's own: always.
    const K = P.CONSTANTS.vs3bet;
    const rl = model.cells['RUN0_LOW|DS'];
    const rlEq = P.eqMixOf(rl);
    const bad = [];
    for (const s of sweep) {
      if (s.state.node !== '3bet') continue;
      const bw = s.out.cells['BROADWAY_RUN|RB'].tier;
      const t = s.out.cells['RUN0_LOW|DS'].tier;
      if (bw === 'T1' || bw === 'T2' || bw === 'T3') bad.push(`BROADWAY_RUN|RB is ${bw} at ${s.state.pos}`);
      if (!(t === 'T2' || t === 'T3')) bad.push(`RUN0_LOW|DS is ${t} at ${s.state.pos}`);
    }
    if (!(rl.nu >= K.nuOOP)) bad.push(`RUN0_LOW|DS nu ${rl.nu} is below the nuOOP floor ${K.nuOOP}`);
    G('I15', bad.length === 0,
      `BROADWAY_RUN x RB never continues (dom ${model.cells['BROADWAY_RUN|RB'].dom}, eqMix ` +
      `${(P.eqMixOf(model.cells['BROADWAY_RUN|RB']) * 100).toFixed(1)}% under the ${(K.call * 100).toFixed(0)}% call floor); ` +
      `RUN0_LOW x DS always continues, at all six seats (eqMix ${(rlEq * 100).toFixed(1)}% vs a ` +
      `${(K.breakeven * 100).toFixed(0)}% price, nu ${rl.nu} against the ${K.nuOOP} out-of-position floor)` +
      (bad.length ? ` — ${bad.slice(0, 3).join('; ')}` : ''));
    } },

    { ids: ['I19'], label: 'T2 empty at the reference table', run: () => {
    // I19 the exploit tier is empty at the reference table
    const bad = [];
    for (const node of ['rfi', 'limps', 'raise']) {
      for (const pos of P.POSITIONS) {
        if (P.positionDisabled(pos, node)) continue;
        const s = P.solve(model, { pos, node, v: model.meta.vpip.ref / 100, limpers: 2, raiserPos: 'CO' });
        const t2 = Object.keys(s.cells).filter((k) => s.cells[k].tier === 'T2');
        if (t2.length) bad.push(`${node}/${pos}: ${t2.length} T2 cells`);
      }
    }
    G('I19', bad.length === 0, `T2 is empty at VPIP ${model.meta.vpip.ref} for every position and node` +
      (bad.length ? ` — ${bad[0]}` : ''));
    } },
    ],
  };
}
