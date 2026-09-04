// ev-band.mjs — the EV MIX band's multiplier `k`, solved from the shipped distribution.
//
// V3-PLAN §6's `EV MIX band` row: *"width = k · payoff-`se` at default trials, **k fixed by
// arithmetic, not felt**: k is solved so the EV-mode MIX band's combo-weighted mass at default
// settings equals `t4Band`'s measured frequency mass"* — METHODOLOGY §10.11's frequency lesson
// transposed to EV units as an equation. The `se` sets the unit; `t4Band`'s mass sets the
// multiplier; nothing here is chosen.
//
// WHY IT IS NOT IN `policy.mjs`, where the cut itself lives. This is a DERIVATION, run twice and
// never in a browser: once by `stampConstants` to write `constants.evCut`, and once more by gate
// I40, from scratch, to `Object.is`-compare against what shipped. The page reads only the STAMPED
// number, through `policy.evMixKOf`. policy.mjs is inlined verbatim into the artifact and is capped
// by a byte gate, so shipping a derivation the page never runs would be paying for it 270,000 times
// over. This is the same shape `constants.solver` takes — `solverBlock` lives in
// `scripts/lib/equilibrium.mjs`, not in the inlined model — and it is the P3 precedent this row
// was told to follow.
//
// WHY THE FILE IS NOT CALLED `ev-cut.mjs`. That name matches gate I33(e)'s `CONSUMER` regex, which
// demands that any file it matches IMPORT `payoff.mjs`. This module must not: V3-PLAN §2 requires
// the accessor to arrive as an argument so that two models' payoffs cannot alias in one process,
// and a module-level import here would be the second binding that the EV memo key exists to keep
// apart. So the accessor is a parameter, the name stays out of a scope whose rule would be wrong
// here, and gate I39 asserts the memo discipline DYNAMICALLY instead of by grep.

import * as P from './policy.mjs';

/**
 * SOLVE `k`, THE EV MIX BAND'S MULTIPLIER, FROM THE SHIPPED DISTRIBUTION. §6's `EV MIX band` row:
 * "width = k * payoff-`se` at default trials, **k fixed by arithmetic, not felt**: k is solved so
 * the EV-mode MIX band's combo-weighted mass at default settings equals `t4Band`'s measured
 * frequency mass". The `se` sets the unit; `t4Band`'s mass sets the multiplier; no felt number
 * enters anywhere.
 *
 * THE DEFAULT STATE is the one the B1 fixture froze — the villain profile at its load default, the
 * lobby VPIP, the v3 axes at their identity settings, over every (position, node) the page can stand
 * on, the three 3-bet seats included. The k that ships must be the k of the surface a visitor opens.
 *
 * THE EQUATION IS SOLVED THE WAY EVERY OTHER CUT IN THE MODEL IS SOLVED — by `policy.scoreAtCut`,
 * the very function the percentile cut is read with, on the same `cumMid` midpoint convention. Rank
 * the cells by `z = |evBB| / seBB` ascending, walk cumulative combo mass, read the crossing at
 * `t4Mass`. "Equals" is unsatisfiable exactly on a step function, so the crossing IS the definition,
 * and the rounding to four decimals is stated in the shipped block rather than left to the reader.
 *
 * `evMassAtK` is the mass the ROUNDED k actually delivers, recorded so the rounding's cost is on the
 * page rather than in this comment. I40 re-derives the whole block from scratch every run and
 * `Object.is`-compares it against the stamped one.
 */
export function evMixK(model, payoff) {
  const pool = P.poolAt(model, P.villainLoadDefault(model));
  const rows = [];
  let t4Combos = 0, allCombos = 0, seSum = 0, seN = 0, pairs = 0;
  for (const node of P.NODES) {
    for (const pos of P.POSITIONS) {
      if (P.positionDisabled(pos, node)) continue;
      pairs++;
      const state = { pos, node, v: pool.v, limpers: 2, raiserPos: 'CO' };
      const solved = P.solve(pool.model, state);
      const layer = P.evCut(pool.model, state, payoff);
      for (const it of P.cellList(pool.model)) {
        const L = layer.cells[it.key];
        allCombos += it.combos;
        if (solved.cells[it.key].t4) t4Combos += it.combos;
        rows.push({ z: L.seBB > 0 ? Math.abs(L.evBB) / L.seBB : Infinity, combos: it.combos });
        if (isFinite(L.seBB)) { seSum += L.seBB * it.combos; seN += it.combos; }
      }
    }
  }
  const t4Mass = allCombos ? t4Combos / allCombos : 0;
  /* THE CROSSING IS SOLVED BY policy.mjs's OWN `scoreAtCut` — the same function the percentile cut
     is solved by, on the same `cumMid` midpoint convention every cut in that file uses. That is what makes §6's "k
     is solved so the band's mass equals t4Band's mass" an equation solved in the same sense as
     every other cut here, rather than a second, private notion of "equals". The midpoint convention
     also centres the granularity: mass only actually jumps at a row's own z, and rows are fat (the
     TRASH row alone is 11% of the combo total), so a one-sided walk would undershoot by up to a
     whole row. `evMassAtK` below records what the rounded k actually delivers, either way. */
  rows.sort((a, b) => a.z - b.z);
  let cum = 0;
  for (const r of rows) { const share = r.combos / allCombos; r.cumMid = cum + share / 2; cum += share; r.S = r.z; }
  const mixK = Math.round(P.scoreAtCut(rows, t4Mass) * 1e4) / 1e4;
  /* THE STEP THE CROSSING LANDS IN, MEASURED AND PUBLISHED. The shipped z distribution is a step
     function with fat tie plateaus — a checkdown payoff hands many cells identical equity, and one
     cell is read at several seats — so "the band's mass EQUALS t4Band's mass" is satisfiable at the
     crossing and not at any achievable band. `evMassAtK` is what the rounded k actually delivers
     (strictly below, matching the `mix` predicate); `evMassNextStep` is what the next distinct z
     would deliver. The target lies between them, which is the whole content of "solved exactly in
     the interpolated sense", and it is on the page rather than in this comment. */
  let atK = 0, next = Infinity;
  for (const r of rows) { if (r.z < mixK) atK += r.combos; else if (r.z < next) next = r.z; }
  let atNext = 0;
  for (const r of rows) if (r.z <= next) atNext += r.combos;
  return {
    mixK,
    t4Mass,
    evMassAtK: allCombos ? atK / allCombos : 0,
    evMassNextStep: allCombos ? atNext / allCombos : 0,
    seUnit: {
      trials: model.meta.trials ? model.meta.trials.cell : null,
      sePt: P.seOfTrials(model.meta.trials ? model.meta.trials.cell : 0),
      seBBMean: seN ? seSum / seN : null,
    },
    derivedAt: { state: evDefaultKey(model), pairs, cells: rows.length, t4Band: P.CONSTANTS.t4Band },
    kind: 'derived',
    derivation: 'k solves "the EV-mode MIX band carries t4Band\'s own frequency mass" on the shipped '
      + 'distribution at the default state: every cell of every seat the page can stand on, ranked by '
      + '|evBB|/seBB ascending, and the crossing read by `scoreAtCut` — the same function and the same '
      + 'cumMid convention the percentile cut itself is solved with — at the pooled t4 mass, then '
      + 'rounded half-away-from-zero to 4 decimals. The payoff se sets the unit and t4Band\'s measured '
      + 'mass sets the multiplier, so no number here is felt (V3-PLAN §6; METHODOLOGY §10.11\'s '
      + 'frequency lesson transposed to EV units). The distribution is a STEP function with tie '
      + 'plateaus, so no achievable band hits the target exactly: evMassAtK and evMassNextStep bracket '
      + 'it, and that bracket is the measurement rather than a tolerance.',
  };
}

/**
 * A fingerprint of the state `evMixK` derived at — the lobby pool, the identity settings, the seat
 * count. Stamped into `constants.evCut.derivedAt` so gate I40 can fail the day the block stops
 * describing the default state, which is the failure that actually happens: the default moves and
 * the constant does not.
 */
export function evDefaultKey(model) {
  const d = P.villainLoadDefault(model);
  const e = P.envOf(null);
  return `v${d.on ? d.v : 'off'}/q${d.on ? d.q : '-'}|${P.envKey(e)}|limpers2|raiserCO|mixdefault`;
}

/**
 * THE FROZEN EXCEPTION RECORD: every (seat, VPIP) at which §7.2's OFFERED PREDICTION is FALSE.
 *
 * The prediction, offered by the plan for falsification: *"shallow+raked folds more than deep+raked
 * at every seat"* — at 40 bb with the 5% rake and the rake-depth coupling on, the EV-mode aggressive
 * width should be NARROWER than at 250 bb with the same rake. **It is not, and the finding ships.**
 *
 * MEASURED AT P4 over the 15 percentile seats x the 5-VPIP grid, rake 5%, `rakeDepth` on and
 * `depthWidth` on: 57 of 75 readings go the predicted way and **18 invert**. With `depthWidth` off —
 * the rake-depth coupling alone — 13 of 75 invert, so the width axis is not the cause, only an
 * amplifier.
 *
 * WHY, AND IT IS THE TWO COUPLINGS PULLING AGAINST EACH OTHER. `rakeDepth` makes the reference pot
 * grow with the stack, so the 3 bb cap binds HARDER when shallow and the effective rake is LOWER at
 * 40 bb than at 250 — which raises the EV bar deep, not shallow. `depthWidth` meanwhile tightens the
 * percentile set at every seat whose `baseR` is below 1 as the stack grows. At the blinds' vs-Raise
 * node both effects push the same way and the deep reading ends up the narrower one, which is the
 * opposite of what the prediction assumed. **The inversions are not scattered**: 8 of the 18 are
 * `SB|raise` and `BB|raise` (4 of 5 VPIPs each) and 14 of the 18 are at the vs-Raise node.
 *
 * FROZEN AND COMPARED IN BOTH DIRECTIONS, on `skill.mjs`'s `WIDTH_*_EXCEPTIONS` idiom: gate I40
 * re-measures the whole sweep and fails if a listed reading stops inverting *or* if an unlisted one
 * starts. A record compared in one direction only is a record that quietly grows.
 *
 * Each entry is `[seat, vpip, widthAt40bb, widthAt250bb]`, widths rounded to 6 decimals — the
 * WIDTHS are context for the reader, and only the seat/VPIP pair is asserted, because a width is a
 * measurement and the exception is a fact about its sign.
 */
export const PREDICTION_EXCEPTIONS = Object.freeze([
  ['UTG|rfi', 70, 0.167654, 0.161936], ['UTG|rfi', 90, 0.185605, 0.169648],
  ['HJ|rfi', 25, 0.18268, 0.180419], ['HJ|rfi', 90, 0.223637, 0.220977],
  ['HJ|limps', 55, 0.21353, 0.211403],
  ['HJ|raise', 25, 0.087247, 0.085696], ['HJ|raise', 40, 0.106263, 0.098905],
  ['HJ|raise', 90, 0.155021, 0.14784],
  ['CO|raise', 40, 0.106263, 0.098905],
  ['BTN|raise', 90, 0.156484, 0.152361],
  ['SB|raise', 25, 0.089641, 0.087159], ['SB|raise', 40, 0.108302, 0.096334],
  ['SB|raise', 70, 0.138886, 0.124303], ['SB|raise', 90, 0.152893, 0.140526],
  ['BB|raise', 40, 0.113045, 0.097398], ['BB|raise', 55, 0.120225, 0.113266],
  ['BB|raise', 70, 0.124126, 0.113266], ['BB|raise', 90, 0.15378, 0.143851],
].map((r) => Object.freeze(r)));

/** the exception set as a lookup, so I40 can compare in both directions without rebuilding it */
export const PREDICTION_EXCEPTION_KEYS = Object.freeze(
  new Set(PREDICTION_EXCEPTIONS.map(([seat, vp]) => `${seat}@${vp}`)));
