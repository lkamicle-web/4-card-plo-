// policy.mjs — THE MODEL. N_eff, realization, score, percentile tiers, the exploit split,
// the nut gate, margins, the tier ribbon, and the vs-3-bet lab.
//
// This module is the single source of the model: the generator imports it, and the build inlines
// it verbatim into the page, so the browser and the data pipeline cannot disagree. It therefore
// uses NO Node APIs, no imports, and no syntax beyond plain ES2020.
//
// Everything here implements the documented formulas; nothing is fitted or hidden. The Monte Carlo
// layer (eq/rho/nu, produced by the generator) is objective. This layer is opinion, and every
// number it uses appears in CONSTANTS below and is rendered by the page's Method view.

export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const NODES = ['rfi', 'limps', 'raise', '3bet'];

/** tier ids, best action first */
export const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5'];
/** strength ordering used by the suit-monotonicity post-pass (higher = more aggressive) */
export const TIER_RANK = { T1: 4, T2: 3, T3: 2, T4: 1, T5: 0 };

export const TIER_LABELS = {
  rfi:   { T1: 'RAISE', T2: 'RAISE (exploit)', T3: '—', T4: 'MIX', T5: 'FOLD' },
  limps: { T1: 'ISO-RAISE', T2: 'ISO (exploit)', T3: 'OVER-LIMP', T4: 'MIX', T5: 'FOLD' },
  raise: { T1: '3-BET', T2: '3-BET (vs loose opener)', T3: 'CALL', T4: 'MIX', T5: 'FOLD' },
  // T2 leads with AMBUSH, not CALL: two adjacent legend chips both starting with CALL are
  // indistinguishable at a glance, and the ambush IS a flat call, never a re-raise.
  '3bet': { T1: '4-BET', T2: 'AMBUSH CALL', T3: 'CALL', T4: 'MIX', T5: 'FOLD' },
};

export const NODE_LABELS = { rfi: 'RFI', limps: 'vs Limps', raise: 'vs Raise', '3bet': 'vs 3-Bet' };

export const CONSTANTS = {
  c: '0.55*v^1.25',
  cBlind: 'min(0.95,1.5*c+0.10)',
  cLimper: 'min(0.90,0.45+0.50*v)',
  isoBehind: 1.20,
  vsRaiseBehind: 0.90,
  vsRaiseBlind: 0.80,
  baseR: { UTG: 0.97, HJ: 0.99, CO: 1.02, BTN: 1.06, SB: 0.90, BB: 0.93 },
  multiwayRealizationSlope: 0.10,
  kappa: [0.15, 0.13],
  nuBar: 0.42,
  nuNorm: [0.08, 0.27],
  mplay: {
    dangler: 0.94, trips: 0.85, quads: 0.70, aBlocked: 0.78,
    noCardAbove9: 0.93, monotone: 0.95, threeFlush: 0.97, nutSuited: 1.03,
  },
  baseRaise: { UTG: 0.16, HJ: 0.20, CO: 0.27, BTN: 0.45, SB: 0.33, BB: 0.33 },
  widthSlope: 0.35,
  isoValueFactor: 0.60,
  nutGate: [0.20, 0.10, 3.0],
  // Cap on the nut floor the gate demands. Uncapped, nuMin(N) reaches 0.40 at N_eff 5 and demotes
  // cells out of the aggressive range faster than widthFor adds them, so the PAINTED iso range fell
  // by up to half across the slider (BTN over 2 limpers: 45.7% at VPIP 55 down to 23.8% at 90) while
  // the tool's whole thesis is that a looser table earns a WIDER, nuttier range. Capped at 0.30 the
  // gate still bites hard at 3+ opponents without eating the widening it is meant to shape. Gate I21
  // holds the painted width to that claim.
  nutGateCap: 0.30,
  limpWidth: 0.5,
  limpNuMin: 0.45,
  w3bet: [0.06, 0.10],
  wCall: [0.10, 0.30],
  tighten: 0.12,
  // Re-anchored constants (documented in docs/METHODOLOGY.md). The model brief pinned these two
  // nut floors against HAND-level nu anchors (JT98ds 0.59, KQJTds 0.70). This grid scores CELLS,
  // whose nu is a combo-weighted mean: only 1.0% of all hands sit in a cell with nu >= 0.55, which
  // capped the vs-Raise 3-bet range at 2.8% of hands — below the model's own 6% minimum target
  // width, and completely static in VPIP. Both are re-anchored to nut floors the model already
  // uses elsewhere.
  nu3betMin: 0.40,          // brief value 0.55
  nu3betMinSpec: 0.55,
  raiseCallNuMin: 0.40,
  vs3bet: {
    mix: [0.60, 0.25, 0.10, 0.05], breakeven: 0.29, fourBet: 0.50,
    call: 0.36, ambushEq1: 0.45, domGate: 2,
    // The domination gate can now only ever CONFIRM a fold the equity test already made: 0.34 sits
    // below the 0.36 call floor, so no cell that clears the price is folded for domination alone.
    // eqVs3bet is measured against the actual AA/KK/QQ/BWR ranges (mc.mjs runVs samples the villain
    // from the component range with hero's cards removed), so shared ranks are already priced into
    // the equity twice over — blockers and equity both. At the old 0.44 escape the gate charged for
    // them a third time and folded BROADWAY_RUN x DS (eqMix 40.3%, nu 0.70, getting 2.45:1) while
    // calling RUN0_LOW x SS at 39.5%, which is backwards. The escape was also dead code: of the 19
    // non-AA cells with dom >= 2, none ever cleared 44%.
    domGateEqEscape: 0.34,
    // nuOOP is the nut floor for continuing out of position. Held just under the measured nu of the
    // I15 anchor cell RUN0_LOW x DS, so "RUN0_LOW x DS always continues" is true at all six seats
    // rather than at the two in-position ones. (Re-measure that cell after any regeneration: it is
    // the constant's only anchor. The floor is deliberately set below it, not at it.)
    nuCall: 0.40, nuOOP: 0.42, nuOOPSpec: 0.55,
  },
  // The declared-uncertainty band, in CUMULATIVE COMBO FREQUENCY — the same unit at all four nodes.
  // A cell is MIX when its combo-frequency midpoint sits within this band of a live decision
  // boundary. It was previously read in equity points at the vs-3-bet node, which is a unit error
  // and not a small one: hero equities against the face-up mix pile up on the 34-36% mode (42.2% of
  // all combos sit in that two-point bin), so an absolute +/-1.5 equity-point window there swept
  // 38.9% of the grid into MIX — about 9x the blend's own measurement SE of 0.165 pt.
  t4Band: 0.015,
  closeMargin: 2.0,
  adj: [2, -3, 4],
};

// seats still to act, 6-max
const N_NB = { UTG: 3, HJ: 2, CO: 1, BTN: 0, SB: 0, BB: 0 };
const N_BL = { UTG: 2, HJ: 2, CO: 2, BTN: 2, SB: 1, BB: 0 };
/** the nesting chain the positional-containment post-pass walks, per node */
const NEST_CHAIN = { rfi: ['UTG', 'HJ', 'CO', 'BTN'], limps: ['HJ', 'CO', 'BTN'], raise: ['HJ', 'CO', 'BTN'], '3bet': [] };

/** structurally unavailable (position, node) pairs */
export function positionDisabled(pos, node) {
  if (node === 'rfi' && pos === 'BB') return 'BB closes the unopened pot by checking';
  if ((node === 'limps' || node === 'raise') && pos === 'UTG') return 'no one acts before UTG';
  return null;
}

// ---------------------------------------------------------------------------
// 1. VPIP -> expected opponents
// ---------------------------------------------------------------------------
export function cCall(v) { return 0.55 * Math.pow(v, 1.25); }
export function cBlind(v) { return Math.min(0.95, 1.5 * cCall(v) + 0.10); }
export function cLimper(v) { return Math.min(0.90, 0.45 + 0.50 * v); }

/** seats behind hero that are non-blind, when hero faces an open from an earlier seat */
function behindNonBlind(pos) { return N_NB[pos]; }

/**
 * @returns {{raw:number, N:number, extrapolated:boolean}}
 */
export function nEff(state) {
  const { node, pos, v } = state;
  const L = state.limpers == null ? 2 : state.limpers;
  const c = cCall(v), cb = cBlind(v), cl = cLimper(v);
  let raw;
  if (node === 'rfi') {
    raw = 1 + N_NB[pos] * c + N_BL[pos] * cb;
  } else if (node === 'limps') {
    raw = 1 + L * cl + N_NB[pos] * CONSTANTS.isoBehind * c + N_BL[pos] * cb;
  } else if (node === 'raise') {
    raw = 1 + behindNonBlind(pos) * CONSTANTS.vsRaiseBehind * c
            + N_BL[pos] * CONSTANTS.vsRaiseBlind * cb + 1;
  } else {
    raw = 2; // vs 3-bet is treated heads-up; N_eff is not used for tiering
  }
  const N = Math.min(5, Math.max(1, raw));
  return { raw, N, extrapolated: raw > 5.0001 };
}

// ---------------------------------------------------------------------------
// 2. realization, nut multiplier, score
// ---------------------------------------------------------------------------
export function realization(pos, N, nu) {
  return CONSTANTS.baseR[pos] * (1 - CONSTANTS.multiwayRealizationSlope * (N - 1) * (1 - nu));
}
export function kappa(N) { return CONSTANTS.kappa[0] + CONSTANTS.kappa[1] * (N - 1); }
export function mNut(nu, N) { return 1 + kappa(N) * (nu - CONSTANTS.nuBar); }
export function nuMin(N) {
  return Math.min(CONSTANTS.nutGateCap, CONSTANTS.nutGate[0] + CONSTANTS.nutGate[1] * (N - 3));
}

/** linear interpolation of a cell's rho over fractional N in [1,5] */
export function rhoAt(rho, N) {
  const x = Math.min(5, Math.max(1, N));
  const i = Math.min(3, Math.floor(x) - 1);
  const f = x - (i + 1);
  return rho[i] + (rho[i + 1] - rho[i]) * f;
}
export function eqAt(eq, N) { return rhoAt(eq, N); }

/** aggressive target width for (pos, node, v) */
export function widthFor(pos, node, v) {
  const K = CONSTANTS;
  if (node === 'raise') return K.w3bet[0] + K.w3bet[1] * v;
  const base = K.baseRaise[pos] * (1 + K.widthSlope * (v - 0.5));
  if (node === 'limps') return base * (1 + K.isoValueFactor * Math.max(0, v - 0.5));
  return base;
}

/** the passive-continue width (T3), 0 when the node has no T3 */
export function width3For(pos, node, v, limpers) {
  const K = CONSTANTS;
  if (node === 'raise') return K.wCall[0] + K.wCall[1] * v;
  if (node === 'limps') {
    const L = limpers == null ? 2 : limpers;
    if (L >= 2 && (pos === 'BTN' || pos === 'SB' || pos === 'BB')) return K.limpWidth * widthFor(pos, node, v);
  }
  return 0;
}

/** the vs-Raise range-tightening shift applied to rho */
export function tightenFor(raiserPos, v) {
  return CONSTANTS.tighten * (1 - widthFor(raiserPos || 'CO', 'rfi', v));
}

// ---------------------------------------------------------------------------
// 3. scoring one cell
// ---------------------------------------------------------------------------
/**
 * @param {object} cell a MODEL cell (needs rho, nu, mplay)
 * @returns {{S:number, rho:number, mnut:number, mplay:number, R:number}}
 */
export function scoreCell(cell, pos, N, shift) {
  let rho = rhoAt(cell.rho, N);
  if (shift) rho -= shift * (1 - cell.nu);
  const mn = mNut(cell.nu, N);
  const R = realization(pos, N, cell.nu);
  return { S: 100 * rho * mn * cell.mplay * R, rho, mnut: mn, mplay: cell.mplay, R };
}

/** the within-cell single-hand adjustment (section 2.9) — an interpolation, never a measurement */
export function handAdjust(S, adjRawValue, adjMean) {
  return S * (1 + (adjRawValue - adjMean) / 100);
}

// ---------------------------------------------------------------------------
// 4. the percentile machinery
// ---------------------------------------------------------------------------
/**
 * Fill the quantities the emitter leaves out because they are exactly derivable, so the shipped
 * file carries no duplicated state that could drift. Idempotent; call once after loading MODEL.
 *   rho[N] = eq[N] * (N+1) / 100      oneIn = round(comboTotal / combos)
 */
export function hydrate(model) {
  if (model.__hydrated) return model;
  for (const key of Object.keys(model.cells)) {
    const c = model.cells[key];
    if (!c.combos) continue;
    // non-enumerable, so hydrating a model never changes what JSON.stringify emits
    if (!c.rho) Object.defineProperty(c, 'rho', { value: c.eq.map((e, i) => (e * (i + 2)) / 100), configurable: true });
    if (c.oneIn == null) Object.defineProperty(c, 'oneIn', { value: Math.round(model.meta.comboTotal / c.combos), configurable: true });
    if (c.nuSlope == null) Object.defineProperty(c, 'nuSlope', { value: (c.rho[4] - c.rho[0]) / 4, configurable: true });
  }
  for (const key of Object.keys(model.sub || {})) {
    for (const s of model.sub[key]) {
      if (!s.rho) Object.defineProperty(s, 'rho', { value: s.eq.map((e, i) => (e * (i + 2)) / 100), configurable: true });
    }
  }
  Object.defineProperty(model, '__hydrated', { value: true, enumerable: false });
  return model;
}

function cellList(model) {
  if (!model.__list) {
    const list = [];
    for (const key of Object.keys(model.cells)) {
      const c = model.cells[key];
      if (!c.combos) continue;
      list.push({ key, cell: c, combos: c.combos });
    }
    Object.defineProperty(model, '__list', { value: list, enumerable: false });
  }
  return model.__list;
}

/**
 * Score + sort + cut. Returns the ranked table plus the cut scores.
 * Pure percentile machinery — no gates, no splits.
 */
export function rankTable(model, pos, node, v, opts) {
  const o = opts || {};
  const total = model.meta.comboTotal;
  const info = nEff({ node, pos, v, limpers: o.limpers });
  const shift = node === 'raise' ? tightenFor(o.raiserPos, v) : 0;
  const list = cellList(model);
  const rows = new Array(list.length);
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const sc = scoreCell(it.cell, pos, info.N, shift);
    rows[i] = { key: it.key, cell: it.cell, combos: it.combos, ...sc };
  }
  rows.sort((a, b) => b.S - a.S);
  let cum = 0;
  for (const r of rows) {
    const share = r.combos / total;
    r.cumBefore = cum;
    r.cumMid = cum + share / 2;
    cum += share;
    r.cumAfter = cum;
  }
  return { rows, N: info.N, rawN: info.raw, extrapolated: info.extrapolated, shift };
}

/** score at a given cumulative frequency, linearly interpolated between straddling cells */
function scoreAtCut(rows, w) {
  if (w <= 0) return rows.length ? rows[0].S + 1 : 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].cumMid >= w) {
      if (i === 0) return rows[0].S;
      const a = rows[i - 1], b = rows[i];
      const f = (w - a.cumMid) / (b.cumMid - a.cumMid || 1);
      return a.S + (b.S - a.S) * f;
    }
  }
  return rows.length ? rows[rows.length - 1].S : 0;
}

/**
 * The aggressive set at (pos, node, v), AFTER the percentile cut and the nut gate but BEFORE the
 * T1/T2 split and the display post-passes. This is the set the exploit split and the positional
 * nesting cascade are defined on.
 */
const AGGR_MEMO = new Map();
function aggressiveSet(model, pos, node, v, opts) {
  const key = `${model.meta.hash ? model.meta.hash.slice(0, 8) : ''}|${pos}|${node}|${v}|`
    + `${opts.limpers == null ? 2 : opts.limpers}|${opts.raiserPos || 'CO'}`;
  const hit = AGGR_MEMO.get(key);
  if (hit) return hit;
  if (AGGR_MEMO.size >= MEMO_CAP) AGGR_MEMO.clear();
  const out = aggressiveSetUncached(model, pos, node, v, opts);
  AGGR_MEMO.set(key, out);
  return out;
}
function aggressiveSetUncached(model, pos, node, v, opts) {
  const t = rankTable(model, pos, node, v, opts);
  const w = widthFor(pos, node, v);
  const gate = t.N >= CONSTANTS.nutGate[2];
  const need = nuMin(t.N);
  const set = new Set();
  for (const r of t.rows) {
    if (r.cumMid >= w) break;
    if (gate && r.cell.nu < need) continue;      // nut gate demotes out of the aggressive set
    set.add(r.key);
  }
  return { set, table: t, w };
}

// ---------------------------------------------------------------------------
// 5. vs-3-bet: absolute thresholds against the pot-odds price
// ---------------------------------------------------------------------------
export function eqMixOf(cell, mix) {
  const m = mix || CONSTANTS.vs3bet.mix;
  const e = cell.eqVs3bet;
  return (m[0] * e.AA + m[1] * e.KK + m[2] * e.QQ + m[3] * e.BWR) / 100;
}

const AA_ROWS = new Set(['AA_BIGPAIR', 'AA_BROADWAY', 'AA_CONNECTED', 'AA_SMALLPAIR', 'AA_DANGLER']);

/**
 * The vs-3-bet node's decision boundaries expressed in cumulative combo frequency — the same axis
 * the other three nodes cut on. Rank every live cell by eqMix, walk the cumulative frequency, and
 * report where the ordering crosses the call floor and the four-bet threshold. Returns null for a
 * boundary the grid never crosses (not a live boundary at that mix).
 * @returns {{rows:Array, callCut:number|null, fourBetCut:number|null}}
 */
export function vs3betCuts(model, mix) {
  const total = model.meta.comboTotal;
  const rows = [];
  for (const it of cellList(model)) rows.push({ key: it.key, combos: it.combos, em: eqMixOf(it.cell, mix) });
  rows.sort((a, b) => b.em - a.em);
  let cum = 0;
  for (const r of rows) { const share = r.combos / total; r.cumMid = cum + share / 2; cum += share; }
  const cross = (thr) => {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].em > thr) continue;
      if (i === 0) return null;                       // the whole grid is below it — not a boundary
      const a = rows[i - 1], b = rows[i];
      const f = (a.em - thr) / ((a.em - b.em) || 1);
      return a.cumMid + (b.cumMid - a.cumMid) * f;
    }
    return null;                                      // the whole grid is above it — not a boundary
  };
  const K = CONSTANTS.vs3bet;
  return { rows, callCut: cross(K.call), fourBetCut: cross(K.fourBet) };
}

function solve3bet(model, state) {
  const K = CONSTANTS.vs3bet;
  const heroIP = state.pos === 'CO' || state.pos === 'BTN';
  const cuts = vs3betCuts(model, state.mix);
  const freq = new Map(cuts.rows.map((r) => [r.key, r.cumMid]));
  const out = {};
  for (const it of cellList(model)) {
    const c = it.cell;
    const row = it.key.split('|')[0];
    const em = eqMixOf(c, state.mix);
    const isAA = AA_ROWS.has(row);
    const dom = Math.round(c.dom);
    const reasons = [];
    let tier = 'T5';
    let dominated = false;

    if (dom >= K.domGate && !isAA && em < K.domGateEqEscape) {
      dominated = true;
      tier = 'T5';
    } else if (isAA && em >= K.fourBet) {
      tier = 'T1';
    } else if (em >= K.call && c.nu >= K.nuCall && (heroIP || c.nu >= K.nuOOP)) {
      tier = c.eq[0] < K.ambushEq1 * 100 ? 'T2' : 'T3';
    }
    // Declared uncertainty, in cumulative combo frequency — the same construction and the same
    // t4Band as the other three nodes (see solveUncached). A cell is MIX when it sits within the
    // band of a LIVE boundary: the call floor for every cell, and additionally the four-bet
    // threshold for the AA rows, the only rows that can reach T1 here.
    const cm = freq.get(it.key);
    const nearCall = cuts.callCut != null && Math.abs(cm - cuts.callCut) < CONSTANTS.t4Band;
    const nearFourBet = isAA && cuts.fourBetCut != null
      && Math.abs(cm - cuts.fourBetCut) < CONSTANTS.t4Band;
    const t4 = !dominated && (nearCall || nearFourBet);

    // ---- margin: the distance to the constraint that actually BINDS ----------------------------
    // Each clause the tier decision consulted, as a signed gap in its own unit, IN THE ORDER THE
    // DECISION CONSULTS THEM. The first failing clause is reported, so a folded cell can never
    // render a positive distance from a threshold it merely happened to clear, and the reported
    // unit (marginUnit/marginOf) says whether it is an equity gap or a nut gap.
    const gaps = [];
    if (dominated) gaps.push({ v: (em - K.domGateEqEscape) * 100, unit: 'eq pts', of: `the ${(K.domGateEqEscape * 100).toFixed(0)}% domination escape` });
    gaps.push({ v: (em - K.call) * 100, unit: 'eq pts', of: `the ${(K.call * 100).toFixed(0)}% call floor` });
    gaps.push({ v: (c.nu - K.nuCall) * 100, unit: 'ν pts', of: `the ${K.nuCall.toFixed(2)} continue floor` });
    if (!heroIP) gaps.push({ v: (c.nu - K.nuOOP) * 100, unit: 'ν pts', of: `the ${K.nuOOP.toFixed(2)} out-of-position nut floor` });
    // The 4-bet bar is a boundary only for an AA row that has already cleared it; an AA row that
    // merely calls has not FAILED the 4-bet bar, it simply is not a 4-bet, so it never binds.
    if (isAA && em >= K.fourBet) gaps.push({ v: (em - K.fourBet) * 100, unit: 'eq pts', of: `the ${(K.fourBet * 100).toFixed(0)}% 4-bet bar` });
    const firstFail = gaps.find((g) => g.v < 0);
    // A cell that clears everything reports the TIGHTEST thing it cleared, so a hand that scrapes
    // past a floor reads as close rather than comfortable.
    const bind = firstFail || gaps.reduce((a, b) => (a.v <= b.v ? a : b));
    const margin = bind.v;

    // ---- reasons: signed against the threshold the decision actually used -----------------------
    if (dominated) {
      reasons.push({ sign: -1, text: `dominated — ${dom} of your ranks live in their face-up range`, value: (em - K.domGateEqEscape) * 100 });
    }
    reasons.push({
      sign: em >= K.call ? 1 : -1,
      text: `${(em * 100).toFixed(1)}% against the face-up mix vs the ${(K.call * 100).toFixed(0)}% call floor`,
      value: (em - K.call) * 100,
    });
    if (c.nu < K.nuCall) reasons.push({ sign: -1, text: `nut potential ${c.nu.toFixed(2)} is below the ${K.nuCall.toFixed(2)} continue floor`, value: (c.nu - K.nuCall) * 100 });
    else if (!heroIP && c.nu < K.nuOOP) reasons.push({ sign: -1, text: `nut potential ${c.nu.toFixed(2)} clears the continue floor but not the ${K.nuOOP.toFixed(2)} needed out of position`, value: (c.nu - K.nuOOP) * 100 });
    else if (!heroIP) reasons.push({ sign: 1, text: `nut potential ${c.nu.toFixed(2)} is nutty enough to continue out of position`, value: (c.nu - K.nuOOP) * 100 });
    if (tier === 'T2') reasons.push({ sign: 1, text: `+EXPLOIT — vs an unknown 3-bettor this is a fold (${c.eq[0].toFixed(1)}% vs random)`, value: em * 100 - c.eq[0] });
    reasons.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    // The raw price is CONTEXT, appended unsigned after the ranking rather than competing in it.
    // Signing it against 0.29 was the old bug: 72% of combos measure 30-43%, so nearly every folded
    // cell carried a positive "beats the price" line and the panel argued against its own verdict.
    const ranked = reasons.slice(0, 3);
    ranked.push({
      sign: 0,
      text: `raw pot odds are ${(K.breakeven * 100).toFixed(1)}% — the call floor sits ${((K.call - K.breakeven) * 100).toFixed(0)} points above them, because a 3-bet pot is played out of position over three streets`,
      value: 0,
    });

    out[it.key] = {
      action: tier, t4, score: em * 100, margin, marginOf: bind.of, marginUnit: bind.unit,
      eqMix: em, dom, dominated,
      cumMid: cm, callCut: cuts.callCut, fourBetCut: cuts.fourBetCut,
      reasons: ranked, rank: 0,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. solve — the whole pipeline for one (pos, node, v)
// ---------------------------------------------------------------------------
/**
 * @param {object} model the MODEL literal
 * @param {object} state { pos, node, v (fraction 0.25..0.90), limpers, raiserPos, mix }
 * @returns {{ cells:Object, order:string[], N:number, rawN:number, extrapolated:boolean,
 *             width:number, width3:number, nutShare:number, composition:Object }}
 */
// A small memo, because the ribbon and the entry-VPIP lookup each evaluate the whole pipeline at
// all 66 integer VPIP points, and the page re-solves the current state on every read. Keyed by the
// full state, so it can only ever return the answer the pipeline would have recomputed. Results are
// shared, not copied: treat a solve() result as read-only.
const SOLVE_MEMO = new Map();
const MEMO_CAP = 800;

export function clearSolveMemo() { SOLVE_MEMO.clear(); AGGR_MEMO.clear(); }

export function solve(model, state) {
  hydrate(model);
  const key = `${model.meta.hash ? model.meta.hash.slice(0, 8) : ''}|${state.pos}|${state.node}|${state.v}|`
    + `${state.limpers == null ? 2 : state.limpers}|${state.raiserPos || 'CO'}|${state.mix ? state.mix.join(',') : ''}`;
  const hit = SOLVE_MEMO.get(key);
  if (hit) return hit;
  const out = solveUncached(model, state);
  if (SOLVE_MEMO.size >= MEMO_CAP) SOLVE_MEMO.clear();
  SOLVE_MEMO.set(key, out);
  return out;
}

function solveUncached(model, state) {
  const total = model.meta.comboTotal;
  const node = state.node, pos = state.pos, v = state.v;

  let cells, table = null, N = 2, rawN = 2, extrapolated = false;

  if (node === '3bet') {
    cells = solve3bet(model, state);
    const ordered = Object.keys(cells).sort((a, b) => cells[b].score - cells[a].score);
    ordered.forEach((k, i) => { cells[k].rank = i + 1; });
  } else {
    const opts = { limpers: state.limpers, raiserPos: state.raiserPos };
    const cur = aggressiveSet(model, pos, node, v, opts);
    table = cur.table; N = table.N; rawN = table.rawN; extrapolated = table.extrapolated;

    // 8a. positional nesting — union-cascade over the earlier seats of this node's chain.
    // Copied first: the per-position sets are memoised and must never be mutated in place.
    const active = new Set(cur.set);
    const chain = NEST_CHAIN[node];
    const ci = chain.indexOf(pos);
    if (ci > 0) {
      for (let i = 0; i < ci; i++) {
        for (const k of aggressiveSet(model, chain[i], node, v, opts).set) active.add(k);
      }
    }

    // 4. the exploit split: aggressive here but not at the reference table
    const vRef = model.meta.vpip.ref / 100;
    let refSet = new Set();
    if (Math.abs(v - vRef) > 1e-9) {
      const ref = aggressiveSet(model, pos, node, vRef, opts);
      refSet = ref.set;
      if (ci > 0) for (let i = 0; i < ci; i++) for (const k of aggressiveSet(model, chain[i], node, vRef, opts).set) refSet.add(k);
    } else {
      refSet = new Set(active);
    }

    const w = cur.w;
    const w3 = width3For(pos, node, v, state.limpers);
    const gate = N >= CONSTANTS.nutGate[2];
    const need = nuMin(N);
    const sCutAgg = scoreAtCut(table.rows, w);
    const sCut3 = w3 > 0 ? scoreAtCut(table.rows, w + w3) : null;

    cells = {};
    table.rows.forEach((r, i) => {
      const c = r.cell;
      let tier;
      let gated = false;
      if (active.has(r.key)) {
        tier = refSet.has(r.key) ? 'T1' : 'T2';
      } else {
        const passiveOk = w3 > 0 && r.cumMid < w + w3
          && (node !== 'limps' || c.nu >= CONSTANTS.limpNuMin)
          && (node !== 'raise' || N < 3 || c.nu >= CONSTANTS.raiseCallNuMin);
        const wouldBeAggr = r.cumMid < w;
        if (wouldBeAggr && gate && c.nu < need) { gated = true; tier = w3 > 0 ? 'T3' : 'T5'; }
        else if (passiveOk && !(gate && c.nu < need)) tier = 'T3';
        else tier = 'T5';
      }

      // The vs-Raise 3-bet construction is value-heavy and nutted, never a bluff shape. The floor is
      // a hard demotion, so it is carried with an explicit value whitelist rather than softened into
      // a score penalty (which would re-order cells everywhere else). BROADWAY_RUN is on it for the
      // same reason DBLPAIR_BIG is: AKQJ is a value 3-bet by any PLO standard, and the row's
      // combo-weighted nu lands under the floor only because the rainbow and suit-wasted columns
      // drag the mean down.
      if (node === 'raise' && (tier === 'T1' || tier === 'T2')) {
        const row = r.key.split('|')[0];
        if (!(c.nu >= CONSTANTS.nu3betMin || AA_ROWS.has(row)
              || row === 'DBLPAIR_BIG' || row === 'BROADWAY_RUN')) {
          tier = w3 > 0 && r.cumMid < w + w3 ? 'T3' : 'T5';
        }
      }

      // 6. declared uncertainty: within +/- t4Band of frequency of any live boundary.
      // T4 is an OVERLAY on the action tier, applied after the post-passes, never an action level
      // of its own — otherwise the monotonicity passes would erase MIX cells next to a CALL.
      const nearAgg = Math.abs(r.cumMid - w);
      const near3 = w3 > 0 ? Math.abs(r.cumMid - (w + w3)) : Infinity;
      const t4 = Math.min(nearAgg, near3) < CONSTANTS.t4Band;

      const nearestCut = nearAgg <= near3 ? sCutAgg : sCut3;
      const margin = r.S - nearestCut;

      cells[r.key] = {
        action: tier, t4, score: r.S, rank: i + 1, margin, gated,
        rho: r.rho, mnut: r.mnut, mplayF: r.mplay, R: r.R,
        cumMid: r.cumMid, reasons: [],
      };
    });

    // reason lines, generated from the model's own terms
    for (const r of table.rows) {
      const e = cells[r.key];
      e.reasons = whyLines(r, e, { pos, node, v, N, w, gate, need, model });
    }
  }

  postPasses(model, cells);
  // the MIX overlay goes on last, so wouldBe always names the action the model actually chose
  for (const k of Object.keys(cells)) {
    const e = cells[k];
    e.wouldBe = e.action;
    e.tier = e.t4 ? 'T4' : e.action;
  }

  // aggregates
  let aggrCombos = 0, aggrNu = 0, contCombos = 0;
  const composition = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 };
  for (const it of cellList(model)) {
    const e = cells[it.key];
    composition[e.tier] += it.combos;
    if (e.tier === 'T1' || e.tier === 'T2') { aggrCombos += it.combos; aggrNu += it.combos * it.cell.nu; }
    if (e.tier !== 'T5') contCombos += it.combos;
  }

  return {
    cells, N, rawN, extrapolated,
    // targetWidth is w_raise / w_3bet — the percentile the model AIMS at, and the number the
    // position sub-labels quote. width is what the grid actually paints after the nut gate has
    // demoted cells out of the aggressive range, so width <= targetWidth whenever the gate bites.
    targetWidth: node === '3bet' ? null : widthFor(pos, node, v),
    width: aggrCombos / total,
    continueWidth: contCombos / total,
    nutShare: aggrCombos ? aggrNu / aggrCombos : 0,
    composition,
    cutScore: table ? scoreAtCut(table.rows, widthFor(pos, node, v)) : null,
  };
}

/** the AA band, in the order the model asserts is a strength order */
const AA_BAND = ['AA_BIGPAIR', 'AA_BROADWAY', 'AA_CONNECTED', 'AA_SMALLPAIR', 'AA_DANGLER', 'A_BLOCKED'];

/**
 * Display post-passes. Both are enforcement, not emergence, and the UI says so:
 *  (a) AA-band row monotonicity — tier(AA_BIGPAIR) >= ... >= tier(A_BLOCKED). Enforced by promoting
 *      the EARLIER (stronger) row, so the pass can never fold a hand the raw scores wanted to play.
 *      The model brief states this ordering as an invariant; at cell granularity a few settings
 *      break it on raw score (AA + small pair briefly outscores AA + connectors at high N), so it
 *      is enforced the same way positional nesting and suit monotonicity are.
 *  (b) Suit monotonicity — adding suitedness never demotes, scanning RB -> FLAW -> SS -> SSA -> DS.
 */
function postPasses(model, cells) {
  for (const col of model.cols) {
    let prevKey = null;
    for (let i = AA_BAND.length - 1; i >= 0; i--) {
      const k = AA_BAND[i] + '|' + col.key;
      const e = cells[k];
      if (!e) continue;
      if (prevKey && TIER_RANK[e.action] < TIER_RANK[cells[prevKey].action]) {
        e.action = cells[prevKey].action;
        e.promoted = 'aa-band';
      }
      prevKey = k;
    }
  }
  const cols = model.cols.map((c) => c.key);
  for (const row of model.rows) {
    let prev = null;
    for (const col of cols) {
      const e = cells[row.key + '|' + col];
      if (!e) continue;
      if (prev && TIER_RANK[e.action] < TIER_RANK[prev.action]) { e.action = prev.action; e.promoted = 'suit'; }
      prev = e;
    }
  }
}

/**
 * Name the LARGEST M_play penalty this cell actually carries, rather than reciting the same three
 * causes everywhere. All but the residual is reconstructible from the shipped cells: the dangler
 * term (the biggest factor, and the whole penalty for 52% of penalised combos), trips and blocked
 * aces from the row key, nut-suited from the cell's share. The leftover mono / three-flush /
 * no-card-above-9 group is not carried per cell, so it is named by the column and no finer.
 */
function mplayCause(r) {
  const M = CONSTANTS.mplay;
  const row = r.key.split('|')[0], col = r.key.split('|')[1];
  const dang = Math.pow(M.dangler, r.cell.danglers || 0);
  const trips = (row === 'TRIPS_BIG' || row === 'TRIPS_SMALL') ? M.trips : 1;
  const blocked = row === 'A_BLOCKED' ? M.aBlocked : 1;
  const suited = Math.pow(M.nutSuited, r.cell.nutSuited || 0);
  const residual = r.mplay / (dang * trips * blocked * suited);
  const terms = [
    [dang, (r.cell.danglers || 0) >= 1.5 ? `${(r.cell.danglers).toFixed(1)} dangling cards on average`
      : `a dangler on ${((r.cell.danglers || 0) * 100).toFixed(0)}% of these hands`],
    [trips, 'trips block their own outs'],
    [blocked, 'the extra aces are dead cards'],
    [residual, col === 'FLAW' ? 'a third card of the suit is wasted' : 'no card above a nine'],
  ].filter((t) => t[0] < 0.999);
  if (!terms.length) return 'dead cards, wasted suits or no card above a nine';
  terms.sort((a, b) => a[0] - b[0]);
  return terms[0][1];
}

/** ranked, signed reason lines built from the multiplier terms that actually fired */
function whyLines(r, e, ctx) {
  const out = [];
  const S = r.S;
  const push = (sign, text, value) => out.push({ sign, text, value });

  const rhoTerm = r.rho;
  push(rhoTerm >= 1 ? 1 : -1,
    rhoTerm >= 1
      ? `equity ${(rhoTerm * 100 / (ctx.N + 1)).toFixed(1)}% is ${rhoTerm.toFixed(2)}x its fair share at ${ctx.N.toFixed(1)}-way`
      : `equity ${(rhoTerm * 100 / (ctx.N + 1)).toFixed(1)}% is only ${rhoTerm.toFixed(2)}x its fair share at ${ctx.N.toFixed(1)}-way`,
    (rhoTerm - 1) * 100);

  if (Math.abs(r.mnut - 1) > 0.005) {
    // Signed against nuBar, the normalisation ANCHOR — not the measured pool mean of 0.2954.
    // Calling 0.42 "the pool mean" told the 40% of combos between the two the opposite of the truth.
    push(r.mnut > 1 ? 1 : -1,
      r.mnut > 1
        ? `nut potential ${r.cell.nu.toFixed(2)} is above the model's ν reference ${CONSTANTS.nuBar.toFixed(2)} — scales into multiway pots`
        : `nut potential ${r.cell.nu.toFixed(2)} is below the model's ν reference ${CONSTANTS.nuBar.toFixed(2)} — loses value multiway`,
      S * (1 - 1 / r.mnut));
  }
  if (Math.abs(r.mplay - 1) > 0.005) {
    push(r.mplay > 1 ? 1 : -1, r.mplay > 1 ? 'ace-topped suited pair — the flushes it makes are the nuts'
      : `structural penalty — ${mplayCause(r)}`, S * (1 - 1 / r.mplay));
  }
  const rBase = CONSTANTS.baseR[ctx.pos];
  if (Math.abs(r.R - rBase) > 0.005 || Math.abs(rBase - 1) > 0.005) {
    push(r.R >= 1 ? 1 : -1,
      `realization ${r.R.toFixed(2)} at ${ctx.pos} with ${ctx.N.toFixed(1)} opponents`,
      S * (1 - 1 / r.R));
  }
  if (e.gated) {
    push(-1, `folded by nut gate (nu ${r.cell.nu.toFixed(2)} < ${ctx.need.toFixed(2)} required at ${ctx.N.toFixed(1)}-way)`, -Math.abs(e.margin) - 1e-6);
  }
  out.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return out.slice(0, 4);
}

/** the one-line verdict shown above the WHY block */
export function verdictLine(model, state, key, solved) {
  const e = solved.cells[key];
  if (!e) return '';
  const lab = TIER_LABELS[state.node];
  if (state.node === '3bet') {
    const K = CONSTANTS.vs3bet;
    const em = e.eqMix != null ? (e.eqMix * 100).toFixed(1) : '?';
    if (e.tier === 'T2') return `+EXPLOIT — ${lab.T2}. Their range is face-up; vs an unknown 3-bettor this is a fold.`;
    if (e.tier === 'T1') return `${lab.T1} — ${em}% against their face-up mix, above the ${(K.fourBet * 100).toFixed(0)}% 4-bet bar.`;
    if (e.tier === 'T3') return `${lab.T3} — ${em}% against their face-up mix, above the ${(K.call * 100).toFixed(0)}% call floor.`;
    if (e.tier === 'T4') return `MIX — this cell sits inside the model's uncertainty band around a live boundary. Either action is defensible.`;
    // A fold is stated against whatever actually bound it, never against the 29% raw price the
    // hand may well have cleared.
    return `FOLD — ${em}% against their face-up mix · ${Math.abs(e.margin).toFixed(1)} ${e.marginUnit || 'eq pts'} short of ${e.marginOf || 'the call floor'}.`;
  }
  const w = widthFor(state.pos, state.node, state.v);
  if (e.gated) {
    return `FOLD — nut gate: nu below the floor required at N_eff ${solved.N.toFixed(1)}. Would otherwise rank ${e.rank}/${Object.keys(solved.cells).length}.`;
  }
  if (e.tier === 'T2') {
    const entry = entryVpip(model, state, key);
    return `+EXPLOIT — enters the range at VPIP ${entry == null ? '?' : entry}. At a ${model.meta.vpip.ref}% table this is a fold.`;
  }
  if (e.tier === 'T1') return `${lab.T1} — ranks ${e.rank}/${Object.keys(solved.cells).length} · inside the top ${(w * 100).toFixed(1)}% cut.`;
  if (e.tier === 'T3') return `${lab.T3} — beyond the aggressive cut but inside the continue range.`;
  if (e.tier === 'T4') return `MIX — the model is not confident here: ${Math.abs(e.margin).toFixed(1)} score points from the boundary.`;
  return `FOLD — ranks ${e.rank}/${Object.keys(solved.cells).length}, outside the top ${(w * 100).toFixed(1)}% cut.`;
}

// ---------------------------------------------------------------------------
// 7. the tier ribbon: the full pipeline at every integer VPIP
// ---------------------------------------------------------------------------
/**
 * @returns {{ spans:string[], vs:number[], boundaries:Array, caption:string, text:string }}
 */
export function ribbon(model, state, key) {
  const lo = model.meta.vpip.min, hi = model.meta.vpip.max;
  const spans = [], vs = [];
  for (let p = lo; p <= hi; p++) {
    const s = solve(model, { ...state, v: p / 100 });
    spans.push(s.cells[key] ? s.cells[key].tier : 'T5');
    vs.push(p);
  }
  const lab = TIER_LABELS[state.node];
  const boundaries = [];
  for (let i = 1; i < spans.length; i++) {
    if (spans[i] !== spans[i - 1]) boundaries.push({ v: vs[i], from: spans[i - 1], to: spans[i], label: `${lab[spans[i - 1]]} → ${lab[spans[i]]} @ ${vs[i]}` });
  }
  // Built from the LAST boundary alone, the caption named the wrong low-end action for every cell
  // crossing more than one (286 of 2,465): RAISE -> MIX -> FOLD read as "MIX below".
  let caption;
  if (!boundaries.length) {
    caption = `${lab[spans[0]]} at every table VPIP from ${lo} to ${hi}.`;
  } else if (boundaries.length === 1) {
    const b = boundaries[0];
    caption = `${lab[b.to]} from VPIP ${b.v} upward. ${lab[b.from]} below.`;
  } else {
    const parts = [`${lab[spans[0]]} to VPIP ${boundaries[0].v - 1}`];
    for (let i = 0; i < boundaries.length; i++) {
      const to = i + 1 < boundaries.length ? boundaries[i + 1].v - 1 : hi;
      parts.push(`${lab[boundaries[i].to]} ${boundaries[i].v}${to > boundaries[i].v ? `–${to}` : ''}`);
    }
    caption = `${parts.join(', then ')}.`;
  }
  const text = `Tier by table VPIP: ` + boundaries.map((b) => b.label).join('; ') + (boundaries.length ? '.' : `${lab[spans[0]]} throughout.`);
  return { spans, vs, boundaries, caption, text };
}

/** first VPIP at which a cell is aggressive — used by the T2 exploit reason string */
export function entryVpip(model, state, key) {
  const lo = model.meta.vpip.min, hi = model.meta.vpip.max;
  for (let p = lo; p <= hi; p++) {
    const s = solve(model, { ...state, v: p / 100 });
    const t = s.cells[key] && s.cells[key].tier;
    if (t === 'T1' || t === 'T2') return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 8. derived teaching readouts (copy-level numbers, never model inputs)
// ---------------------------------------------------------------------------
export function derived(state, info) {
  const L = state.limpers == null ? 2 : state.limpers;
  let pot;
  if (state.node === 'rfi') pot = 3.5;
  else if (state.node === 'limps') pot = 3 * L + 2;
  else if (state.node === 'raise') pot = 2 * 3.5 + 1.5;
  else pot = 20.5;
  return {
    nEff: info.raw,
    nEffClamped: info.N,
    extrapolated: info.extrapolated,
    seeFlop: info.N,
    pot,
    text: `N_eff ${info.raw.toFixed(2)} · ≈${info.N.toFixed(1)} see the flop · pot ≈${pot.toFixed(1)}bb`,
  };
}

/** breakeven equity vs N opponents */
export function breakeven(N) { return 100 / (N + 1); }
