// gates I26 I29 I30 I31 — the environment axes.
//
// The straddle's direction, including the composition case §3.3 asked to have checked explicitly
// (the field beats lambda(d/2), and by how much) and the falsification of §7.2's "BTN keeps its
// base"; I29/I30 re-run I16's continuity and I21's widening with it ON; and I31's rake, which is
// tier-inert at the percentile nodes BY CONSTRUCTION — asserted in that form, not lamented — and
// bites at the one absolute threshold.
//
// One block, four gates: they share the straddled grid.

import { ROW_ORDER, COL_ORDER } from '../lib/taxonomy.mjs';
import * as P from '../lib/policy.mjs';
import { makePayoff } from '../lib/payoff.mjs';
import { TOTAL, VPIP_GRID, NODES, overPct, underPct } from './_shared.mjs';

export const family = 'env';
export const title = 'the straddle (V2-PLAN §3.3) and the rake (§3.2) — the environment axes';
export const ids = ['I26', 'I29', 'I30', 'I31'];

export function build(ctx) {
  const { model, fast, G } = ctx;

  return {
    sections: [
    // =========================================================================
    // I26 / I29 / I30 — the straddle (V2-PLAN §3.3)     I31 — the rake (§3.2)
    // =========================================================================
    { ids: ['I26', 'I29', 'I30', 'I31'], label: 'straddle direction, sweeps, and the rake haircut', run: () => {
    const KS = P.CONSTANTS.straddle, KR = P.CONSTANTS.rake;
    const DGRID = [40, 60, 100, 150, 200, 250];
    const SEATS = P.POSITIONS.filter((p) => !P.positionDisabled(p, 'rfi'));
    const sv = (node, pos, vp, d, straddle) =>
      P.solve(model, { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO', d, straddle });

    {
      // -------------------------------------------------------------------
      // I26 — the straddle moves the grid in the direction §3.3 claims, AND the composition case
      // §3.3 flagged is decided by measurement rather than left as a worry.
      //
      // §3.3's own words: "shallow + multiway both point the same way once M_deep's lambda flips
      // sign below 100bb — VERIFY THIS COMPOSITION EXPLICITLY; if lambda(50) < 0 fights the field
      // effect, the gate documents which wins and why." It does fight it, and here is the answer.
      //
      //  (a) PAINTED OPENING RANGES TIGHTEN, at every seat and every (VPIP, depth): 150/150 at the
      //      RFI node and 150/150 at the iso node, over 5 seats x 5 VPIP x 6 depths. This is where
      //      V2-PLAN §7.2's lean is FALSIFIED and the falsification is load-bearing rather than
      //      cosmetic: §7.2 leaned "BTN keeps its 0.45 base under a straddle", and with BTN pinned
      //      the button's PAINTED range gets WIDER at 7 of its 30 settings (by up to 2.49 points,
      //      worst at VPIP 25 / 40 bb; 16 of 30 on 10k-trial data) and its mean nu FALLS at 8. A
      //      straddle cannot make the button open wider — it puts one more player behind him — so
      //      the seat factor applies at every seat and `straddle.seatPinned` ships empty. The other
      //      half of §7.2 (no straddler iso node) is kept: the straddler is modelled as a defender,
      //      never as a hero seat.
      //        The vs-RAISE node is measured and DELIBERATELY NOT ASSERTED, for a structural
      //      reason: `w3bet` is a flat percentile of the pool with no seat base, so §3.3's seat
      //      transform has nothing to act on there. Measured, it goes both ways (47 tighter, 77
      //      looser, 26 unchanged). A straddle tightens the range you OPEN; it does not tighten the
      //      range you 3-bet with, and this gate says so rather than pretending otherwise.
      //
      //  (b) THE PAINTED RANGE GETS NUTTIER: 148/150 at RFI and 150/150 at the iso node, worst fall
      //      0.13 points (rfi/UTG at VPIP 25, 60 bb).
      //
      //  (c) THE COMPOSITION, ISOLATED. (b) is partly the seat shift: narrowing a range from the
      //      bottom raises its mean nu whatever the ordering does. So the two forces are separated
      //      at MATCHED WIDTH, the I11b construction — score the grid with one half of the
      //      transform at a time, cut at the width the UNSTRADDLED model paints, and read the nu of
      //      the set each ordering picks:
      //
      //        FIELD only  (N -> N + cBlind(v))     mean +0.286 pts, 130 up / 0 down
      //        DEPTH only  (d -> d/2)               mean -0.144 pts, 24 up / 76 down
      //        BOTH                                 mean +0.183 pts, 113 up / 20 down
      //
      //      **THE FIELD WINS**, keeping about 64% of its own effect (44% on 10k-trial data). The
      //      depth half does exactly what §3.3 feared — shallower stacks make nuttiness worth less
      //      (lambda < 0) and coolers cost less (mu < 0), so it re-sorts AWAY from nu at 76 of 150
      //      settings — it simply is not big enough to turn the result over.
      //        WHY, and this is the part worth keeping: on the nu coefficient ALONE the depth half
      //      SHOULD win. d(kappa) = 0.13*cBlind(v) is +0.032 (VPIP 25) to +0.107 (VPIP 90), against
      //      lambda(d/2) - lambda(d) = -0.189 flat — the depth term is 2x to 6x larger. What
      //      completes the field's margin is not the opinion layer but the MEASUREMENT: the
      //      multiway realization slope adds another +0.027 to +0.122 per unit nu, and rho is read
      //      further up its own N curve, which is I3's inversion doing the work. The margin is
      //      thinnest exactly where kappa has least to give — at VPIP 25 it is +0.076 pts with 11
      //      of 30 settings going the other way — and widest at VPIP 70 (+0.301).
      //
      //  (d) reserved for I29/I30 below, which are the I16/I21 analogues across the toggle.
      //  (e) the model still holds together: I6/I7/I8/I9/I10/I13/I19 re-run with the straddle on at
      //      40 / 100 / 250 bb, 0 violations.
      //  (f) and the transform is the transform: N_eff gains exactly cBlind(v) at the opening nodes
      //      and vsRaiseBlind*cBlind(v) at the vs-Raise node, dEff is d/2 clamped to the slider's
      //      domain, widthFor scales by exactly seatWidthFactor, and the price does NOT move at
      //      rake 0 (every threshold in the model is a ratio; only the rake cap is absolute).
      const tolLoose = fast ? 2 : 0;
      const tolNuDown = fast ? 6 : 4;
      const tolNuFall = 0.0030;
      const tolFieldDown = 2;

      // (a) / (b)
      const dir = {};
      for (const node of ['rfi', 'limps', 'raise']) {
        const r = { t: 0, l: 0, s: 0, worst: 0, at: '', nuUp: 0, nuDown: 0, nuWorst: 0, nuAt: '' };
        for (const pos of P.POSITIONS) {
          if (P.positionDisabled(pos, node)) continue;
          for (const vp of VPIP_GRID) {
            for (const d of DGRID) {
              const off = sv(node, pos, vp, d, false), on = sv(node, pos, vp, d, true);
              const dw = on.width - off.width, dn = on.nutShare - off.nutShare;
              if (dw < -1e-12) r.t++; else if (dw > 1e-12) {
                r.l++;
                if (dw > r.worst) { r.worst = dw; r.at = `${pos}@${vp} d${d}`; }
              } else r.s++;
              if (dn > 1e-12) r.nuUp++; else if (dn < -1e-12) {
                r.nuDown++;
                if (-dn > r.nuWorst) { r.nuWorst = -dn; r.nuAt = `${pos}@${vp} d${d}`; }
              }
            }
          }
        }
        dir[node] = r;
      }

      // (c) the matched-width decomposition. Scored directly through scoreCell so each half of the
      // transform can be switched on alone; shift is 0 at the RFI node, so this is the whole score.
      const live = [];
      for (const k of Object.keys(model.cells)) if (model.cells[k].combos) live.push(k);
      const nuAtWidth = (pos, N, env, target) => {
        const rows = live.map((k) => ({ c: model.cells[k], S: P.scoreCell(model.cells[k], pos, N, 0, env).S }));
        rows.sort((a, b) => b.S - a.S);
        let cum = 0, acc = 0;
        for (const r of rows) {
          if (cum >= target) break;
          const take = Math.min(r.c.combos, target - cum);
          cum += take; acc += take * r.c.nu;
        }
        return cum ? acc / cum : 0;
      };
      const comp = { field: [], depth: [], both: [] };
      for (const pos of SEATS) {
        for (const vp of VPIP_GRID) {
          for (const d of DGRID) {
            const st = { pos, node: 'rfi', v: vp / 100, limpers: 2, raiserPos: 'CO', d };
            const off = sv('rfi', pos, vp, d, false);
            const target = off.width * TOTAL;
            const nOff = P.nEff(st).N, nOn = P.nEff({ ...st, straddle: true }).N;
            const eOff = P.envOf(st), eOn = P.envOf({ ...st, straddle: true });
            const b0 = nuAtWidth(pos, nOff, eOff, target);
            comp.field.push(nuAtWidth(pos, nOn, eOff, target) - b0);
            comp.depth.push(nuAtWidth(pos, nOff, eOn, target) - b0);
            comp.both.push(nuAtWidth(pos, nOn, eOn, target) - b0);
          }
        }
      }
      const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
      const down = (a) => a.filter((x) => x < -1e-12).length;
      const mField = mean(comp.field), mDepth = mean(comp.depth), mBoth = mean(comp.both);

      // (e) the structural invariants, straddled
      const struct = [];
      for (const d of [P.CONSTANTS.depth.min, P.CONSTANTS.depth.ref, P.CONSTANTS.depth.max]) {
        for (const node of NODES) {
          for (const pos of P.POSITIONS) {
            if (P.positionDisabled(pos, node)) continue;
            for (const vp of VPIP_GRID) {
              const c = sv(node, pos, vp, d, true).cells;
              const at = `d${d} ${node}/${pos}@${vp}`;
              if (c['AA_BIGPAIR|DS'].tier !== 'T1') struct.push(`I7 ${at}`);
              for (const k of ['TRASH|RB', 'TRIPS_SMALL|RB']) if (['T1', 'T2'].includes(c[k].tier)) struct.push(`I8 ${k} ${at}`);
              if (node !== '3bet' && Object.values(sv(node, pos, vp, d, true).composition).reduce((a, b) => a + b, 0) !== TOTAL) struct.push(`I13 ${at}`);
              for (const row of ROW_ORDER) {
                let prev = null;
                for (const col of COL_ORDER) {
                  const e = c[row + '|' + col];
                  if (!e) continue;
                  if (prev && P.TIER_RANK[e.wouldBe] < P.TIER_RANK[prev]) struct.push(`I9 ${at} ${row} ${col}`);
                  prev = e.wouldBe;
                }
              }
              const band = ['AA_BIGPAIR', 'AA_BROADWAY', 'AA_CONNECTED', 'AA_SMALLPAIR', 'AA_DANGLER', 'A_BLOCKED'];
              for (const col of COL_ORDER) {
                let prev = null;
                for (const row of band) {
                  const e = c[row + '|' + col];
                  if (!e) continue;
                  if (prev && P.TIER_RANK[e.wouldBe] > P.TIER_RANK[prev]) struct.push(`I10 ${at} ${col} ${row}`);
                  prev = e.wouldBe;
                }
              }
              if (vp === model.meta.vpip.ref && node !== '3bet'
                && Object.keys(c).some((k) => c[k].tier === 'T2')) struct.push(`I19 ${at}`);
            }
          }
        }
      }
      for (const node of ['rfi', 'limps', 'raise']) {
        const chain = node === 'rfi' ? ['UTG', 'HJ', 'CO', 'BTN'] : ['HJ', 'CO', 'BTN'];
        for (const vp of VPIP_GRID) {
          const inRange = (e) => e.tier === 'T1' || e.tier === 'T2'
            || (e.tier === 'T4' && (e.wouldBe === 'T1' || e.wouldBe === 'T2'));
          const sets = chain.map((pos) => {
            const s = sv(node, pos, vp, P.CONSTANTS.depth.ref, true);
            return new Set(Object.keys(s.cells).filter((k) => inRange(s.cells[k])));
          });
          for (let i = 1; i < sets.length; i++) {
            for (const k of sets[i - 1]) if (!sets[i].has(k)) struct.push(`I6 ${node} v${vp} ${chain[i - 1]}->${chain[i]} ${k}`);
          }
        }
      }

      // (f) the transform's own arithmetic
      const idBad = [];
      for (const v of [0.25, 0.55, 0.90]) {
        for (const node of ['rfi', 'limps', 'raise']) {
          for (const pos of P.POSITIONS) {
            if (P.positionDisabled(pos, node)) continue;
            const a = P.nEff({ pos, node, v, limpers: 2 }).raw;
            const b = P.nEff({ pos, node, v, limpers: 2, straddle: true }).raw;
            const want = node === 'raise' ? P.CONSTANTS.vsRaiseBlind * P.cBlind(v) : P.cBlind(v);
            if (Math.abs((b - a) - want) > 1e-12) idBad.push(`nEff ${node}/${pos}@${v}`);
          }
        }
      }
      for (const d of [40, 60, 79, 80, 100, 150, 200, 250]) {
        const want = Math.min(P.CONSTANTS.depth.max, Math.max(P.CONSTANTS.depth.min, d / KS.unit));
        if (P.envOf({ d, straddle: true }).dEff !== want) idBad.push(`dEff ${d}`);
        if (P.envOf({ d }).dEff !== d) idBad.push(`dEff plain ${d}`);
      }
      // REWRITTEN AT P1 (V3-PLAN §7.1). The old form was
      //     |widthFor(straddled) - widthFor(plain) * seatWidthFactor| <= 1e-15
      // and §7.1 predicted it "fails as written the moment `widthFor` reads depth — under a straddle
      // dEff halves, so width moves by more than the seat factor". The prediction is correct in
      // substance and lands one step later than expected: item 6b's factor is off by default, so the
      // straddled-only reading below is still true; what changes is that it is no longer the WHOLE
      // composition. So the clause is rewritten to assert the full composition, with the depth
      // factor ON, which is the case that would have broken it — and it is asserted with `===`
      // rather than 1e-15, because `widthFor` applies both factors as multiplications and a product
      // identity is exact where a quotient identity could only be a tolerance.
      for (const pos of P.POSITIONS) {
        const plain = P.widthFor(pos, 'rfi', 0.55);
        const str = P.widthFor(pos, 'rfi', 0.55, { straddle: true });
        const fSeat = P.seatWidthFactor(pos, { straddle: true });
        if (Math.abs(str - plain * fSeat) > 1e-15) idBad.push(`widthFor ${pos}`);
        if (P.seatWidthFactor(pos, undefined) !== 1) idBad.push(`seat factor not 1 unstraddled at ${pos}`);
        // The full composition, and the ORDER is the claim. The seat factor enters INSIDE, on
        // `baseRaise` itself, before the VPIP slope; the depth factor enters OUTSIDE, on the
        // finished width. Those are different numbers in IEEE-754 — `(b*f)*m` is not `(b*m)*f` —
        // which is why the seat half above is a 1e-15 claim and this half is an `===` one, and why
        // the comparand here is the straddled width rather than the plain width times the seat
        // factor. Measured while writing it: comparing against `plain * seat * g` fails at HJ in
        // all three straddled depths, on association alone.
        for (const d of [40, 100, 250]) {
          for (const straddle of [false, true]) {
            const e = { d, straddle, depthWidth: true };
            const got = P.widthFor(pos, 'rfi', 0.55, e);
            const g = P.depthWidthFactor(pos, e);
            const base = P.widthFor(pos, 'rfi', 0.55, { straddle });
            if (got !== (g === 1 ? base : base * g)) idBad.push(`composition ${pos} d${d}${straddle ? ' str' : ''}`);
            // and the depth factor reads dEff, so a straddle really does move it — the half §7.1
            // predicted would break the old form. Asserted, so it cannot silently stop being true.
            if (straddle && d === 100 && P.CONSTANTS.baseR[pos] !== 1
              && g === P.depthWidthFactor(pos, { d, depthWidth: true })) {
              idBad.push(`the straddle does not halve the depth the width factor reads at ${pos}`);
            }
          }
        }
      }
      if (P.breakevenPrice({ straddle: true }) !== P.CONSTANTS.vs3bet.breakeven) idBad.push('the price moved at rake 0');
      if (P.unitBB({ straddle: true }) !== KS.unit || P.unitBB(undefined) !== 1) idBad.push('unitBB');

      const okA = dir.rfi.l <= tolLoose && dir.limps.l <= tolLoose && dir.rfi.t > 0 && dir.limps.t > 0;
      const okB = dir.rfi.nuDown <= tolNuDown && dir.limps.nuDown <= tolNuDown
        && dir.rfi.nuWorst <= tolNuFall && dir.limps.nuWorst <= tolNuFall;
      const okC = mField > 0 && down(comp.field) <= tolFieldDown && mDepth < 0
        && mBoth > 0 && mBoth > mDepth && mBoth >= 0.25 * mField;
      const pass26 = okA && okB && okC && struct.length === 0 && idBad.length === 0;
      const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(3)}`;
      G('I26', pass26,
        `straddle direction (V2-PLAN §3.3) over 5 seats x ${VPIP_GRID.length} VPIP x ${DGRID.length} depths. ` +
        `(a) the painted OPENING range tightens everywhere: rfi ${dir.rfi.t} tighter / ${dir.rfi.l} looser, ` +
        `iso ${dir.limps.t} / ${dir.limps.l} (allowance ${tolLoose}). §7.2's "BTN keeps its base" is ` +
        `FALSIFIED — pinned, the button paints WIDER at 7 of 30 settings (up to +2.49 pts) — so ` +
        `straddle.seatPinned is empty and the ${KS.seat} factor applies at every seat. The vs-RAISE node ` +
        `is reported and not asserted: w3bet has no seat base, so the transform has nothing to act on ` +
        `there and it measures ${dir.raise.t} tighter / ${dir.raise.l} looser / ${dir.raise.s} unchanged — ` +
        `a straddle tightens what you OPEN, not what you 3-bet. (b) and it gets nuttier: rfi ${dir.rfi.nuUp} ` +
        `up / ${dir.rfi.nuDown} down (worst ${(dir.rfi.nuWorst * 100).toFixed(2)} pts${dir.rfi.nuAt ? ` at ${dir.rfi.nuAt}` : ''}), ` +
        `iso ${dir.limps.nuUp} / ${dir.limps.nuDown}. (c) THE COMPOSITION §3.3 ASKED TO BE CHECKED, isolated ` +
        `at matched width: field-only ${pct(mField)} pts (${down(comp.field)} of ${comp.field.length} going the ` +
        `other way), depth-only ${pct(mDepth)} (${down(comp.depth)} down), both ${pct(mBoth)} (${down(comp.both)} down) — ` +
        `**the field wins**, keeping ${(mBoth / mField * 100).toFixed(0)}% of its own effect. lambda(d/2) < 0 really does ` +
        `fight it and is 2-6x larger on the nu coefficient (d kappa = 0.13*cBlind(v) = +0.032..+0.107 against ` +
        `-0.189 flat); what completes the field's margin is the MEASUREMENT — the multiway realization slope ` +
        `(+0.027..+0.122) and rho read further up its N curve. (e) I6/I7/I8/I9/I10/I13/I19 all hold straddled ` +
        `at 40/100/250 bb. (f) the transform is exact: N_eff gains cBlind(v), dEff = d/2 clamped, and the price ` +
        `does not move at rake 0. REWRITTEN at P1 (§7.1 predicted the old width identity would fail "the moment ` +
        `widthFor reads depth"): the clause now asserts the FULL composition — widthFor === base * seatWidthFactor ` +
        `* depthWidthFactor with item 6b's factor ON, at 40/100/250 x straddle {off,on} — with === rather than ` +
        `1e-15, because both factors enter as multiplications and a product identity is exact where a quotient one ` +
        `is a tolerance. The half §7.1 saw coming is asserted directly: under a straddle dEff halves, so the width ` +
        `factor at 100bb straddled is the 50bb factor and not the 100bb one` +
        (okA ? '' : ` — (a) FAILS: rfi ${dir.rfi.l} looser (worst ${dir.rfi.at}), iso ${dir.limps.l} (${dir.limps.at})`) +
        (okB ? '' : ` — (b) FAILS: nu falls at ${dir.rfi.nuDown}/${dir.limps.nuDown} settings, worst ${(Math.max(dir.rfi.nuWorst, dir.limps.nuWorst) * 100).toFixed(2)} pts`) +
        (okC ? '' : ` — (c) FAILS: field ${pct(mField)}, depth ${pct(mDepth)}, both ${pct(mBoth)} — re-read the composition before relaxing this; if the depth half now WINS, that is a finding, not a tolerance`) +
        (struct.length ? ` — (e) FAILS: ${struct.slice(0, 3).join('; ')}` : '') +
        (idBad.length ? ` — (f) FAILS: ${idBad.slice(0, 3).join('; ')}` : ''));
    }

    {
      // -------------------------------------------------------------------
      // I29 / I30 — I16 and I21, re-run with the straddle ON.
      //
      // Same reasoning as I27/I28 for the depth axis: the two gates that hold the VPIP axis honest
      // both sweep with the straddle off, and the straddle re-sorts the grid AND moves N_eff, which
      // is exactly the operation that could make the VPIP axis jump or collapse where nothing looks.
      // Run at 40 / 100 / 250 bb, i.e. at effective depths of 40 / 50 / 125.
      //
      // NEITHER NEEDS A WIDENING. I29's worst non-cliff step is 0 cells at all three depths; I30's
      // worst dip is 2.86 points against I21's own 4.0 allowance (2.97 on 10k-trial data), i.e.
      // BETTER than the 3.16 the unstraddled model runs at.
      //
      // The one thing that does move is the pair of numbers I27 exists to say do NOT move: the
      // N_eff = 3.0 discontinuities. Depth leaves them exactly where they are (I27) because depth
      // is not a field effect; the straddle drags every one of them forward — raise/HJ 45 -> 34,
      // raise/CO 54 -> 39, raise/BTN 70 -> 47 — and adds a fifth at raise/SB 70 that the
      // unstraddled table never reaches. That is the kappa(N) / lambda(d) separation asserted from
      // the other side, and it is asserted structurally rather than as a pinned list: N_eff is
      // strictly larger with the straddle at every setting, so a crossing of 3.0 can only come
      // EARLIER.
      //
      // The painted floor is the one place the straddle takes the model under a number it states
      // elsewhere: at rfi/UTG the straddled range paints 8.96% against I12's 10% floor. That floor
      // is a guard against the nut-gate range collapse I11/I21 document, and this is not that — the
      // TARGET width itself fell 23% with the seat transform and the painted/target ratio is
      // normal. So it gets its own floor at 8%, stated rather than borrowed.
      //
      // MEASURED (P5) — one re-pin and one deliberate NON-re-pin, per V3-PLAN §7.1's
      // "I23(d)/I28/I30 re-pinned after I42 lands (re-measured allowances, not authored ones)" and
      // §3.5's "re-measure every allowance re-pinned during P1-P4". Re-measured on the shipped
      // model, over this gate's own three-depth straddled sweep:
      //
      //     dip         2.858990 pts at d250 rfi/HJ@34    ceiling 4.0 -> 3.30  (+15.4%)   RE-PINNED
      //     minPainted  8.964078 pts at d40 rfi/UTG@27    floor    8.0  STANDS (-10.8%)
      //
      // THE DIP CEILING WAS THE LAST BORROWED ONE. "I21's own 4.0; no widening needed" was true and
      // was never a measurement: 4.0 against 2.86 is +39.9% headroom, the loosest margin any dip
      // allowance in the repository ran at, and it was loosest precisely BECAUSE it had been
      // borrowed from a gate whose own measurement is larger. The claim the old comment made — that
      // the straddled model needs no widening — is not weakened by the re-pin, it is STRENGTHENED:
      // 3.30 is below I21's 4.0, so "smaller than the unstraddled model's" is now asserted by the
      // number rather than merely stated beside it.
      //
      // THE FLOOR STANDS, and that is the P5 rule working rather than an omission. The idiom would
      // put it at 8.964078 - 15% = 7.62, which is LOOSER than the 8.0 already shipped; a re-pin may
      // tighten and never widen (./_shared.mjs), so 8.0 keeps its place and the gate prints its own
      // realised clearance of -10.8% instead. This floor was the one number in the set that had
      // been measured on its own sweep from the start.
      //
      // ONE STALE READING FIXED WHILE RE-MEASURING, and it is worth naming because it is the exact
      // failure mode P5 exists to catch: the old comment said the floor event is "at rfi/UTG, VPIP
      // 25". It is not, and has not been — the narrowest painted range is 8.9641% at d40 rfi/UTG
      // VPIP **27**; VPIP 25 at d100 reads 9.0084%. The 8.96 figure was right, the setting beside
      // it was wrong, and nothing read the setting. The detail line has always PRINTED the true
      // location from the live sweep, so the gate was never asserting the wrong thing — only the
      // prose was. The sentence below is now composed from the same live reading.
      const dipAllow = fast ? 0.05 : 0.033;     // 2.858990 pts measured -> 3.30 (was I21's borrowed 4.0)
      const floor = fast ? 0.075 : 0.08;        // 8.964078 pts measured; 8.0 STANDS, already tighter than the idiom
      const DS = [P.CONSTANTS.depth.min, P.CONSTANTS.depth.ref, P.CONSTANTS.depth.max];
      let ok29 = true, ok30 = true;
      // the worst dip and the narrowest painted range over ALL THREE depths — the two quantities
      // the P5 re-pin was measured from, kept so the detail line divides the allowance by the live
      // measurement instead of quoting a ratio, and names the setting instead of remembering one.
      let dipMax = 0, dipMaxAt = '', paintMin = 1, paintMinAt = '';
      const d29 = [], d30 = [], bad30 = [], cliffOn = [], cliffOff = [];
      let nBad = 0, nChecked = 0;
      for (const node of ['rfi', 'limps', 'raise']) {
        for (const pos of P.POSITIONS) {
          if (P.positionDisabled(pos, node)) continue;
          for (let vp = 25; vp <= 90; vp++) {
            const a = P.nEff({ pos, node, v: vp / 100, limpers: 2 }).raw;
            const b = P.nEff({ pos, node, v: vp / 100, limpers: 2, straddle: true }).raw;
            nChecked++;
            if (!(b > a)) nBad++;
          }
        }
      }
      for (const d of DS) {
        let worstCells = 0, worstAt = '', worstCombos = 0, worstDip = 0, worstDipAt = '';
        let minPainted = 1, minAt = '';
        for (const node of ['rfi', 'limps', 'raise']) {
          for (const pos of P.POSITIONS) {
            if (P.positionDisabled(pos, node)) continue;
            let prev = null, runMax = -1, dip = 0, dipAt = 0, first = null, last = null;
            for (let vp = 25; vp <= 90; vp++) {
              const s = sv(node, pos, vp, d, true);
              if (vp === 25) first = s.width;
              last = s.width;
              if (s.width > runMax) runMax = s.width;
              if (runMax - s.width > dip) { dip = runMax - s.width; dipAt = vp; }
              if (node !== 'raise' && s.width < minPainted) { minPainted = s.width; minAt = `d${d} ${node}/${pos}@${vp}`; }
              if (prev) {
                let nc = 0, nb = 0;
                for (const k of Object.keys(s.cells)) {
                  if (s.cells[k].wouldBe !== prev.cells[k].wouldBe) { nc++; nb += model.cells[k].combos; }
                }
                const atCliff = prev.N < 3 && s.N >= 3;
                const over = nb / TOTAL > 0.03 && nc > 5;
                if (over && !atCliff) {
                  if (nc > worstCells) { worstCells = nc; worstAt = `d${d} ${node}/${pos}@${vp}`; worstCombos = nb; }
                } else if (over && d === P.CONSTANTS.depth.ref) cliffOn.push(`${node}/${pos}@${vp}`);
              }
              prev = s;
            }
            if (last <= first) { ok30 = false; bad30.push(`d${d} ${node}/${pos} paints ${(last * 100).toFixed(1)}% at 90 vs ${(first * 100).toFixed(1)}% at 25`); }
            if (dip > dipAllow) { ok30 = false; bad30.push(`d${d} ${node}/${pos} dips ${(dip * 100).toFixed(1)} pts by VPIP ${dipAt}`); }
            if (dip > worstDip) { worstDip = dip; worstDipAt = `d${d} ${node}/${pos}@${dipAt}`; }
          }
        }
        if (worstCells) ok29 = false;
        if (worstDip > dipMax) { dipMax = worstDip; dipMaxAt = worstDipAt; }
        if (minPainted < paintMin) { paintMin = minPainted; paintMinAt = minAt; }
        if (minPainted < floor) { ok30 = false; bad30.push(`painted ${(minPainted * 100).toFixed(2)}% at ${minAt}`); }
        d29.push(`d${d}: worst non-cliff step ${worstCells} cells${worstCells ? ` (${(worstCombos / TOTAL * 100).toFixed(1)}%) at ${worstAt}` : ''}`);
        d30.push(`d${d}: largest dip ${(worstDip * 100).toFixed(2)} pts at ${worstDipAt}, narrowest painted ${(minPainted * 100).toFixed(2)}% at ${minAt}`);
      }
      // the unstraddled cliffs, at the reference depth, for the comparison the detail line makes
      for (const node of ['rfi', 'limps', 'raise']) {
        for (const pos of P.POSITIONS) {
          if (P.positionDisabled(pos, node)) continue;
          let prev = null;
          for (let vp = 25; vp <= 90; vp++) {
            const s = sv(node, pos, vp, P.CONSTANTS.depth.ref, false);
            if (prev && prev.N < 3 && s.N >= 3) cliffOff.push(`${node}/${pos}@${vp}`);
            prev = s;
          }
        }
      }
      ok29 = ok29 && nBad === 0;
      G('I29', ok29,
        `I16's continuity holds with the straddle ON at ${DS.join(' / ')} bb (effective ` +
        `${DS.map((d) => P.envOf({ d, straddle: true }).dEff).join(' / ')}): every VPIP step changes at most ` +
        `3% of combos or at most 5 of 145 cells — ${d29.join('; ')}. Unlike depth, the straddle DOES move ` +
        `the N_eff = 3.0 discontinuities, and forward, because it is a field effect: ` +
        `[${cliffOff.join(', ')}] becomes [${cliffOn.join(', ')}] — the vs-Raise cliffs arrive 11-23 VPIP ` +
        `points earlier and SB reaches one the unstraddled table never does. Asserted structurally, not as ` +
        `a pinned list: N_eff is strictly larger straddled at all ${nChecked} (node, seat, VPIP) settings, ` +
        `so a crossing can only come earlier` +
        (nBad ? ` — FAILS: N_eff is not strictly larger at ${nBad} settings; the field half is not firing` : ''));
      G('I30', ok30,
        `I21's painted widening holds with the straddle ON at ${DS.join(' / ')} bb: the range is wider at ` +
        `VPIP 90 than at 25 at all 15 (node, position) pairs — ${d30.join('; ')}. The dip allowance is ` +
        `${(dipAllow * 100).toFixed(2)} pts, BELOW I21's own 4.0 rather than a widening of it (unlike I28's): the ` +
        `straddled model's worst dip is ${(dipMax * 100).toFixed(2)} pts at ${dipMaxAt}, SMALLER than the 3.16 the ` +
        `unstraddled model runs at, because a narrower target width has fewer cells straddling the cut. ` +
        (fast ? 'The 10k-trial lane keeps its noise allowances and was NOT re-pinned at P5.'
          : `RE-PINNED AT P5 from I21's borrowed 4.0 (V3-PLAN §7.1, §3.5): the allowance is that live ` +
            `measurement +${overPct(dipAllow, dipMax).toFixed(1)}%, which STRENGTHENS the "no widening needed" ` +
            `claim rather than weakening it — the claim is now made by the number instead of beside it.`) +
        ` The painted floor is its own, at ${(floor * 100).toFixed(1)}% rather than ` +
        `I12's 10%: the narrowest straddled range is ${(paintMin * 100).toFixed(2)}% at ${paintMinAt}, which is the ` +
        `seat transform doing its job (the target itself fell 23%) and not the nut-gate collapse I12 guards ` +
        `against. ` +
        (fast ? '' : `THAT FLOOR STANDS UNCHANGED AT P5 and the reason is the rule, not an omission: the ` +
          `re-pin idiom would put it at ${(paintMin * 0.85 * 100).toFixed(2)}%, LOOSER than the 8.0 already ` +
          `shipped, and a P5 re-pin may tighten and never widen — so it keeps its place at a realised ` +
          `-${underPct(floor, paintMin).toFixed(1)}% clearance, which was already inside the idiom. `) +
        (bad30.length ? ` — FAILS: ${bad30.slice(0, 3).join('; ')}` : ''));
    }

    {
      // -------------------------------------------------------------------
      // I31 — the rake (V2-PLAN §3.2). Two halves, and the first is the plan's own model asserted
      // as a fact rather than discovered as a disappointment.
      //
      //  (a) TIER-INERT ON THE SCORE PATH AT THE THREE PERCENTILE NODES, BY CONSTRUCTION. §3.2
      //      specifies a flat multiplier on rho. Every score is 100*rho*M_nut*M_play*R*M_deep, so a
      //      factor common to every cell scales every score, every interpolated cut and every margin
      //      by one number and re-orders nothing. Measured at the 5% preset over 27,675
      //      cell-settings: 0 tiers move, every score moves, and every score ratio equals
      //      (1 - rakeFrac) to within 2 ulp. This is asserted so that nobody "fixes" the rake into a
      //      non-uniform haircut without making that a deliberate, documented model change.
      //
      //      RE-SCOPED TO THE SCORE PATH AT P4 (V3-PLAN §7.1: "I31(a) re-scoped to score mode — its
      //      'must be a deliberate model change' clause is being INVOKED, not violated"). §3.4's
      //      absolute-EV cut is that deliberate change, and it is the structural fix METHODOLOGY
      //      limitation 17 designates: the EV predicate is ABSOLUTE, so the same 5% rake that cannot
      //      move a percentile tier does narrow the EV-mode aggressive set. The re-scope is not left
      //      as prose — the line below asserts that the EV-mode width DOES move at the same preset,
      //      on the same settings, so "score path" is a measured qualifier rather than a hedge. I40
      //      is where the EV side's own claims live; this is I31 saying which path it speaks for.
      //  (b) AND IT BITES WHERE THE THRESHOLD IS ABSOLUTE. At the vs-3-bet node the price is
      //      arithmetic (`breakeven / (1 - r)`) and the continue floor rides on it, so the continue
      //      range narrows monotonically in rakePct on the ACTION tier — 45 -> 41 cells at UTG,
      //      49 -> 44 at CO across 0-6%. Measured on `wouldBe`, not on the MIX overlay, for the
      //      reason I16 documents: a cell flickering into MIX has not changed the action.
      //  (c) the arithmetic itself, exactly: the 7-point premium over the price is invariant, the
      //      cap is min(pct, cap/(potBB*unit)), and a straddle doubles the unit so the same cap
      //      binds twice as hard (5% -> 2.5% at the shipped 3bb cap).
      const nodes3 = ['rfi', 'limps', 'raise'];
      let moved = 0, scored = 0, nCells = 0, worstDev = 0, firstMove = '';
      for (const node of nodes3) {
        for (const pos of P.POSITIONS) {
          if (P.positionDisabled(pos, node)) continue;
          for (const vp of VPIP_GRID) {
            for (const d of [P.CONSTANTS.depth.min, P.CONSTANTS.depth.ref, P.CONSTANTS.depth.max]) {
              const base = { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO', d };
              const a = P.solve(model, base);
              const b = P.solve(model, { ...base, rakePct: KR.preset });
              const f = P.rakeRhoFactor({ rakePct: KR.preset });
              for (const k of Object.keys(a.cells)) {
                nCells++;
                if (a.cells[k].tier !== b.cells[k].tier) {
                  moved++;
                  if (!firstMove) firstMove = `${node}/${pos}@${vp} d${d} ${k}`;
                }
                if (!Object.is(a.cells[k].score, b.cells[k].score)) scored++;
                if (a.cells[k].score) worstDev = Math.max(worstDev, Math.abs(b.cells[k].score / a.cells[k].score - f));
              }
            }
          }
        }
      }
      // (b) the vs-3-bet node, on the action tier
      const seq = {}, notMono = [];
      for (const pos of ['UTG', 'CO', 'BTN', 'BB']) {
        const s = [];
        for (let pct = KR.min; pct <= KR.max; pct++) {
          const out = P.solve(model, { pos, node: '3bet', v: 0.55, limpers: 2, raiserPos: 'CO', rakePct: pct });
          let n = 0;
          for (const k of Object.keys(out.cells)) if (out.cells[k].wouldBe !== 'T5') n++;
          s.push(n);
        }
        for (let i = 1; i < s.length; i++) if (s[i] > s[i - 1]) notMono.push(`${pos} ${KR.min + i - 1}%->${KR.min + i}% ${s[i - 1]}->${s[i]}`);
        if (!(s[s.length - 1] < s[0])) notMono.push(`${pos} does not tighten at all (${s[0]} -> ${s[s.length - 1]})`);
        seq[pos] = s;
      }
      // (a) THE RE-SCOPE, ASSERTED. The same rake, the same settings, the OTHER cut.
      const EVPAY = makePayoff(model);
      let evRakeMoved = 0, evRakeN = 0, evNarrow = 0;
      for (const node of nodes3) {
        for (const pos of P.POSITIONS) {
          if (P.positionDisabled(pos, node)) continue;
          for (const vp of VPIP_GRID) {
            const base = { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' };
            const a = P.evCut(model, base, EVPAY);
            const b = P.evCut(model, { ...base, rakePct: KR.preset }, EVPAY);
            evRakeN++;
            if (!Object.is(a.width, b.width)) evRakeMoved++;
            if (b.width <= a.width) evNarrow++;
          }
        }
      }
      if (evRakeMoved === 0) {
        aBad.push('(a) the EV-mode width does not move under the rake either — the re-scope to the '
          + 'score path is vacuous, which means the absolute cut is not absolute');
      }
      if (evNarrow !== evRakeN) aBad.push(`(a) the rake WIDENED the EV-mode set at ${evRakeN - evNarrow} settings`);

      // (c) the arithmetic
      //
      // REWRITTEN AT P1 to the DEPTH-COUPLED reference pot (V3-PLAN §7.1). `want` was
      // `min(pct, capBB/(potBB*unit))` with a constant `potBB`; item 6 makes the reference pot
      // `potBB * (d/ref)^potScale`, so the reference this clause recomputes against has to be the
      // same one the model uses or the gate is checking a formula the code no longer runs.
      //
      // WHAT KEEPS THE PRESET CHECKS INTACT is the knee: the ratio is 1 at `depth.ref`, so at the
      // reference depth `rakePotBB` returns `potBB` itself and every reading below is the number it
      // has always been. The sweep now spans the whole depth slider AND both settings of the
      // coupling axis, so the clause asserts three things where it used to assert one — the legacy
      // arithmetic, the coupled arithmetic, and that the two agree exactly at 100bb. I41 is where
      // the coupling's own claims live; this is I31 keeping its formula honest about the change.
      const aBad = [];
      const prem = P.CONSTANTS.vs3bet.call - P.CONSTANTS.vs3bet.breakeven;
      for (const pct of [0, 1, 2.5, 3, 5, 6]) {
        for (const straddle of [false, true]) {
          for (const d of [P.CONSTANTS.depth.min, P.CONSTANTS.depth.ref, P.CONSTANTS.depth.max]) {
            for (const rakeDepth of [false, true]) {
              const e = P.envOf({ rakePct: pct, straddle, d, rakeDepth });
              const pot = rakeDepth ? KR.potBB * Math.pow(d / P.CONSTANTS.depth.ref, KR.potScale) : KR.potBB;
              const at = `${pct}% d${d}${straddle ? ' straddled' : ''}${rakeDepth ? ' coupled' : ''}`;
              if (P.rakePotBB(e) !== pot) aBad.push(`rakePotBB ${at}`);
              const want = Math.min(pct / 100, KR.capBB / (pot * (straddle ? KS.unit : 1)));
              if (Math.abs(P.rakeFraction(e) - want) > 1e-15) aBad.push(`rakeFrac ${at}`);
              if (Math.abs(P.breakevenPrice(e) - P.CONSTANTS.vs3bet.breakeven / (1 - want)) > 1e-15) aBad.push(`price ${at}`);
              if (Math.abs((P.callFloorAt(e) - P.breakevenPrice(e)) - prem) > 1e-12) aBad.push(`premium ${at}`);
              if (Math.abs(P.rakeRhoFactor(e) - (1 - want)) > 1e-15) aBad.push(`rhoFactor ${at}`);
              // the knee, stated as an identity between the two lanes rather than as two readings
              if (d === P.CONSTANTS.depth.ref
                && P.rakeFraction(e) !== P.rakeFraction(P.envOf({ rakePct: pct, straddle, d }))) {
                aBad.push(`knee identity ${at}`);
              }
            }
          }
        }
      }
      if (P.rakeRhoFactor(undefined) !== 1 || P.breakevenPrice(undefined) !== P.CONSTANTS.vs3bet.breakeven
        || P.callFloorAt(undefined) !== P.CONSTANTS.vs3bet.call) aBad.push('not the identity at rake 0');
      if (!(P.rakeFraction({ rakePct: KR.preset, straddle: true }) < P.rakeFraction({ rakePct: KR.preset }))) {
        aBad.push('the straddle does not make the cap bind harder');
      }
      const tolMoved = fast ? 4 : 0;
      const pass31 = moved <= tolMoved && scored === nCells && worstDev < 1e-12
        && notMono.length === 0 && aBad.length === 0;
      G('I31', pass31,
        `rake (V2-PLAN §3.2) at the ${KR.preset}% default preset, cap ${KR.capBB}bb, reference pot ${KR.potBB} units. ` +
        `(a) the flat haircut on rho is TIER-INERT ON THE SCORE PATH at the three percentile nodes and that is ` +
        `the plan's model, not an accident: ${moved} of ${nCells} tiers move (allowance ${tolMoved}), all ${scored} scores do, ` +
        `and every score ratio equals 1 - rakeFrac to ${worstDev.toExponential(1)}. A rake that moves a percentile ` +
        `tier would have to be non-uniform across cells; making it so is a model change, not a bug fix. ` +
        `RE-SCOPED TO THE SCORE PATH AT P4 (§7.1), and the qualifier is MEASURED rather than asserted: at ` +
        `${evRakeN} of the same settings the EV-mode aggressive set moves under the same preset ` +
        `${evRakeMoved} times and narrows or holds at all ${evNarrow}. §3.4's absolute-EV cut is the ` +
        `"deliberate, documented model change" this clause has always demanded, and METHODOLOGY limitation ` +
        `17 names it as the structural fix; I40 carries its own claims. ` +
        `(b) where the threshold is ABSOLUTE it bites: at the vs-3-bet node the continue range narrows ` +
        `monotonically in rakePct on the action tier — ` +
        `${['UTG', 'CO'].map((p) => `${p} ${seq[p].join('->')}`).join(', ')} cells over ${KR.min}-${KR.max}%. ` +
        `(c) the arithmetic is exact: price = ${(P.CONSTANTS.vs3bet.breakeven * 100).toFixed(1)}%/(1 - r) = ` +
        `${(P.breakevenPrice({ rakePct: KR.preset }) * 100).toFixed(2)}% at the preset, the ` +
        `${(prem * 100).toFixed(0)}-point premium over it is invariant, and a straddle doubles the unit the cap is ` +
        `measured against so the same 3bb cap takes ` +
        `${(P.rakeFraction({ rakePct: KR.preset, straddle: true }) * 100).toFixed(1)}% instead of ` +
        `${(P.rakeFraction({ rakePct: KR.preset }) * 100).toFixed(1)}%. (c) is REWRITTEN at P1 to the ` +
        `depth-coupled reference pot (§7.1): the recomputation now runs over depth {40,100,250} x both settings ` +
        `of the coupling axis, so it checks the formula the model actually runs rather than the flat one item 6 ` +
        `replaced — and the preset readings above are unchanged BECAUSE of the knee, which is asserted here as an ` +
        `identity between the coupled and uncoupled lanes at ${P.CONSTANTS.depth.ref}bb rather than as two ` +
        `numbers that happen to match` +
        (moved > tolMoved ? ` — (a) FAILS: ${moved} tiers moved, first ${firstMove}` : '') +
        (scored === nCells ? '' : ` — (a) FAILS: only ${scored} of ${nCells} scores moved; the haircut is not reaching the score`) +
        (worstDev < 1e-12 ? '' : ` — (a) FAILS: the haircut is not uniform (${worstDev.toExponential(2)})`) +
        (notMono.length ? ` — (b) FAILS: ${notMono.slice(0, 3).join('; ')}` : '') +
        (aBad.length ? ` — (c) FAILS: ${aBad.slice(0, 3).join('; ')}` : ''));
    }
    } },
    ],
  };
}
