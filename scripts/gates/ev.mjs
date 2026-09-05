// gates I34 I39 I40 — the absolute-EV cut, and the quarantine that keeps it away from the tiers.
//
// V3-PLAN §3.4 (the cut runs BESIDE the percentile cut, behind the I34 quarantine), §5.4 (the
// quarantine itself, and `evPrimary` gated on a verdict only P5 may stamp), §6's `EV MIX band` and
// `evPrimary` rows, §7.2's I34/I39/I40 rows. One family for three gates because they share ONE
// expensive input — the EV layer over the shipped distribution — and the registry's family contract
// exists so shared setup is paid for once.
//
// WHAT EACH GATE IS FOR, in one line each:
//
//   I34  the QUARANTINE. That tier output is bit-identical across view modes at every setting,
//        verified in ONE process with the modes toggled interleaved along a hash-ordered walk (the
//        idiom that catches memo poisoning), with an OBJECT-IDENTITY clause rather than a tolerance
//        — so a shaky EV number is structurally unable to move a tier — that the badge derives from
//        the accessor's own data, and that the EV-primary path exists, is real, and is unreachable
//        without `model.calibration.verdict === 'pass'` — which since P5 is a block that
//        EXISTS on the shipped model and reads 'fail' (gate I46), rather than an absent one.
//
//   I39  the ARITHMETIC. That EV(fold) = 0 by construction, that rake enters through the exact
//        I31(c) machinery and nowhere else, that the sign at vs-3-bet IS the breakeven comparison
//        rather than agreeing with it to a tolerance, that `stake` is a pure display scale, and
//        that the EV memo carries `ip` and the model hash even though its file is out of I33(g)'s
//        filename scope.
//
//   I40  the BEHAVIOUR. That in EV mode rake NARROWS width at the percentile nodes — the deliberate
//        opposite of what I31(a) asserts on the score path — that depth moves EV-mode width with
//        I42's seat signs, that §7.2's offered prediction is MEASURED rather than assumed, and that
//        the EV MIX band's `k` is re-derived from scratch every run and equals the stamped one.
//
// COST. The I34 walk is a hash-ordered SAMPLE of the 21 legal seats x the 5-VPIP grid x the 12
// environment lanes, and I40's sweep is the percentile seats over depth x rake x both couplings.
// Both reuse the solve memo; the family times in the low seconds.
//
// DEBUGGING. Each of these gates carries six clauses and the report line names only the FIRST
// problem, which is the house format and the right one for a 60-row table. `RUNDOWN_EV_DEBUG=1`
// prints the whole `bad` list for I39 and I40 to stderr instead of the first entry only. It is an
// opt-in affordance and never changes what the gate asserts or reports.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as P from '../lib/policy.mjs';
import { makePayoff } from '../lib/payoff.mjs';
import { evMixK, evDefaultKey, PREDICTION_EXCEPTIONS, PREDICTION_EXCEPTION_KEYS } from '../lib/ev-band.mjs';
import { memoProblems, stripComments } from './payoff.mjs';
import { ROOT, VPIP_GRID } from './_shared.mjs';

export const family = 'ev';
export const title = 'the absolute-EV cut: its quarantine (I34), its arithmetic (I39) and what it moves (I40)';
// EMITTED IN CATALOG ORDER — quarantine, arithmetic, behaviour — because that is also the order in
// which a failure explains the next one: an EV number that has poisoned a tier makes every reading
// below it a reading of the wrong model. EXPECTED_IDS carries the same order.
export const ids = ['I34', 'I39', 'I40'];
export const setupLabel = 'bind the payoff accessor and lay out the walk';

// ---------------------------------------------------------------------------
// the shared surface
// ---------------------------------------------------------------------------

/** the 21 legal (position, node) pairs, in the sweep order the rest of the suite uses */
export function legalPairs() {
  const out = [];
  for (const node of P.NODES) {
    for (const pos of P.POSITIONS) if (!P.positionDisabled(pos, node)) out.push({ pos, node });
  }
  return out;
}

/**
 * The 12 environment lanes — I32's own surface, written out here rather than imported from the
 * fixture module for the reason the fixture module writes its own out: what a gate sweeps must not
 * be able to follow a later default flip.
 */
export function lanes() {
  const D = P.CONSTANTS.depth, R = P.CONSTANTS.rake;
  const out = [];
  for (const d of [D.min, D.ref, D.max]) {
    for (const rakePct of [R.min, R.preset]) {
      for (const straddle of [false, true]) {
        out.push({ id: `d${d}/r${rakePct}/${straddle ? 's1' : 's0'}`, d, rakePct, rakeCapBB: R.capBB, straddle });
      }
    }
  }
  return out;
}

/**
 * The serialisation the quarantine compares. EVERY per-cell field the pipeline publishes that a
 * view mode could conceivably reach, in a fixed key order, plus the aggregates.
 *
 * Deliberately not just `tier`: "bit-identical tiers" is the CLAIM, but a poisoned memo that moved
 * a score and left the tier alone is the same bug one rounding away from being visible, and this
 * catches it a phase earlier. `Object.is` on the numbers, via the `1/x` trick for signed zero, is
 * what makes "bit-identical" a true description rather than a turn of phrase.
 */
export function serialize(out) {
  const keys = Object.keys(out.cells).sort();
  const L = [];
  for (const k of keys) {
    const e = out.cells[k];
    L.push(`${k} ${e.tier} ${e.action} ${e.wouldBe} ${e.preDisplay} ${e.t4 ? 1 : 0} ${e.gated ? 1 : 0}`
      + ` ${e.promoted || '-'} ${num(e.score)} ${num(e.margin)} ${e.rank} ${num(e.cumMid)}`);
  }
  L.push(`N ${out.N} ${out.rawN} ${out.extrapolated ? 1 : 0} ${num(out.width)} ${num(out.continueWidth)}`
    + ` ${num(out.nutShare)} ${num(out.targetWidth)} ${num(out.cutScore)}`);
  for (const t of P.TIERS) L.push(`comp ${t} ${out.composition[t]}`);
  return L.join('\n');
}
const num = (x) => (x == null ? 'null'
  : (typeof x === 'number' && x === 0 ? (1 / x === -Infinity ? '-0' : '0') : String(x)));

// ---------------------------------------------------------------------------

export function build(ctx) {
  const { model, G } = ctx;

  const PAY = makePayoff(model);
  const pairs = legalPairs();
  const LANES = lanes();
  const pct = (x) => `${(100 * x).toFixed(2)}%`;

  return {
    sections: [

    // =========================================================================
    // I34 — the EV quarantine
    // =========================================================================
    { ids: ['I34'], label: 'the EV quarantine: modes interleaved, tiers identical by object', run: () => {
    const bad = [];

    // -- the walk's settings, ORDERED BY HASH -------------------------------------------------
    // §5.4's "settings-hash-walk idiom": consecutive visits must differ on every axis at once, so
    // that a memo entry keyed on a subset of the axes is asked for the wrong answer immediately
    // rather than after a lucky repeat. Sorting the full cross product by `fnv1a` of its own key is
    // what produces that ordering without anybody choosing it.
    const all = [];
    for (const { pos, node } of pairs) {
      for (const vp of VPIP_GRID) {
        for (const L of LANES) all.push({ pos, node, vp, L, key: `${pos}|${node}|${vp}|${L.id}` });
      }
    }
    // `fnv1a` returns a HEX STRING, not a number — subtracting two of them is NaN, and a NaN
    // comparator is a sort that does nothing. Ordering lexicographically on the hex is the same
    // ordering and is the one that actually happens.
    for (const s of all) s.h = P.fnv1a(s.key);
    all.sort((a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : (a.key < b.key ? -1 : 1)));
    const STRIDE = 3;
    const walk = all.filter((_, i) => i % STRIDE === 0);
    /* ARMING THE ORDERING ITSELF, because the failure above is one a green gate hides: a walk that
       visits the settings in construction order still passes every clause below while testing none
       of what the idiom is for. So the mixing is MEASURED — how often consecutive visits differ on
       every axis at once — and compared against the construction order, where by definition the
       lane changes and the seat almost never does. */
    const mixing = (list) => {
      let n = 0;
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i];
        if (a.pos !== b.pos && a.node !== b.node && a.vp !== b.vp && a.L.id !== b.L.id) n++;
      }
      return list.length > 1 ? n / (list.length - 1) : 0;
    };
    const mixHash = mixing(walk);
    const mixFlat = mixing(all.slice().sort((a, b) => (a.key < b.key ? -1 : 1)).filter((_, i) => i % STRIDE === 0));
    /* THE BAR IS THE SURFACE'S OWN, computed rather than chosen: over every ordered pair of distinct
       settings, how often do they differ on all four axes? That is what a uniformly random ordering
       would deliver, and it is the only non-arbitrary thing to hold a hash ordering to — the surface
       has 4 nodes and 5 VPIPs, so 100% is not reachable and a felt threshold would either be
       unreachable or meaningless. The 0.8 is a SAMPLING allowance on 419 consecutive pairs (the
       binomial sd there is 2.4 points, so 0.8x sits ~3.7 sd low), not a tolerance on the claim:
       construction order scores 0.02x the expectation and fails this by two orders of magnitude. */
    let mixPairs = 0;
    for (let i = 0; i < all.length; i++) {
      for (let j = 0; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (a.pos !== b.pos && a.node !== b.node && a.vp !== b.vp && a.L.id !== b.L.id) mixPairs++;
      }
    }
    const mixExpect = mixPairs / (all.length * (all.length - 1));
    if (!(mixHash >= 0.8 * mixExpect && mixHash >= 5 * mixFlat)) {
      bad.push(`(a) the walk is not hash-ordered: ${(100 * mixHash).toFixed(1)}% of consecutive visits `
        + `differ on every axis, against ${(100 * mixExpect).toFixed(1)}% expected of a random ordering `
        + `of this surface and ${(100 * mixFlat).toFixed(1)}% in construction order`);
    }
    const stateOf = (s) => ({
      pos: s.pos, node: s.node, v: s.vp / 100, limpers: 2, raiserPos: 'CO',
      d: s.L.d, rakePct: s.L.rakePct, rakeCapBB: s.L.rakeCapBB, straddle: s.L.straddle,
    });

    // -- (a) A MEMO-COLD REFERENCE PER SETTING ------------------------------------------------
    // Taken with the memo cleared, so the reference is what the pipeline COMPUTES rather than what
    // some earlier visit left behind. Everything after this is compared against it.
    const ref = new Map();
    for (const s of walk) {
      P.clearSolveMemo();
      ref.set(s.key, serialize(P.solve(model, stateOf(s))));
    }

    // -- (b) THE INTERLEAVED WALK, WITH OBJECT IDENTITY ---------------------------------------
    // Score, then EV, then score again, at every setting — and `clearSolveMemo()` at hash-chosen
    // points, so the walk covers both the memo-hot and the memo-cold path and the two must agree.
    // The identity clause is `Object.is` and not a tolerance, which is the whole of §5.4's
    // "structurally unable to move a tier": a number that cannot reach the object cannot move it.
    let visits = 0, cellChecks = 0, clears = 0, layers = 0;
    for (const s of walk) {
      const st = stateOf(s);
      const a = P.solve(model, st);
      const cut = P.evCut(model, st, PAY);
      const b = P.solve(model, st);
      visits++;
      layers += Object.keys(cut.cells).length;
      if (!Object.is(a, b)) bad.push(`(b) ${s.key}: solve returned a different object across an EV read`);
      if (!Object.is(cut.solved, a)) bad.push(`(b) ${s.key}: evCut did not consume the memoised solve object`);
      for (const k of Object.keys(a.cells)) {
        cellChecks++;
        if (!Object.is(a.cells[k], b.cells[k])) { bad.push(`(b) ${s.key}/${k}: the cell object moved across an EV read`); break; }
      }
      if (serialize(a) !== ref.get(s.key)) bad.push(`(b) ${s.key}: the tier output is not the memo-cold reference`);
      // hash-chosen clears: the same fnv1a that ordered the walk decides where the memo is dropped,
      // so the cold path is exercised at settings nobody picked.
      if (parseInt(s.h, 16) % 7 === 0) { P.clearSolveMemo(); clears++; }
    }
    // ...and once more from a completely cold process state, EV FIRST this time. A layer built
    // before any solve exists is the ordering that would let the EV path seed the solve memo.
    P.clearSolveMemo();
    for (const s of walk.slice(0, 40)) {
      const st = stateOf(s);
      const cut = P.evCut(model, st, PAY);
      if (serialize(cut.solved) !== ref.get(s.key)) bad.push(`(b) ${s.key}: EV-first, the tier output is not the reference`);
    }

    // -- (b) ARMED. A wrapper that mutates the memoised set must be SEEN --------------------------
    // Without this, (b) is a clause that checks two identical calls agree with each other. The
    // violator is the exact bug the quarantine exists to catch: a view-mode layer that writes into
    // the object the tier path is about to read.
    {
      const st = stateOf(walk[0]);
      const victim = P.solve(model, st);
      const before = serialize(victim);
      const k0 = Object.keys(victim.cells)[0];
      const saved = victim.cells[k0].tier;
      victim.cells[k0].tier = saved === 'T5' ? 'T1' : 'T5';
      const seen = serialize(P.solve(model, st)) !== before;
      victim.cells[k0].tier = saved;
      if (!seen) bad.push('(b) the detector is not armed: a mutated memoised cell is invisible to the comparison');
      if (serialize(P.solve(model, st)) !== before) bad.push('(b) the arming probe did not restore the model');
    }

    // -- (c) THE BADGE DERIVES FROM DATA ------------------------------------------------------
    // §5.4: "a unit test asserts the badge text derives from source/se, never hard-coded". The gate
    // asserts the same thing structurally: perturb each input, the string must move.
    {
      const base = { source: 'checkdown', se: 0.0123, supported: false };
      const badge = P.evBadge(base);
      if (typeof badge !== 'string' || !badge) bad.push('(c) evBadge did not return a string');
      const moves = [
        ['source', P.evBadge({ ...base, source: 'simulated' })],
        ['se', P.evBadge({ ...base, se: 0.0456 })],
        ['supported', P.evBadge({ ...base, supported: true })],
      ];
      for (const [name, s] of moves) if (s === badge) bad.push(`(c) evBadge ignores ${name} — the badge is not derived from the data`);
      if (P.evBadge({ ...base, se: Infinity }) === P.evBadge({ ...base, se: 0.5 })) {
        bad.push('(c) evBadge does not distinguish an infinite se from a finite one');
      }
      // ...and the layer's own badge must BE that function's answer, never a second spelling.
      const cut = P.evCut(model, stateOf(walk[0]), PAY);
      let badged = 0;
      for (const k of Object.keys(cut.cells)) {
        const e = cut.cells[k];
        if (e.badge !== P.evBadge(e)) { bad.push(`(c) ${k}: the layer's badge is not evBadge's answer`); break; }
        badged++;
      }
      if (!badged) bad.push('(c) the layer badged nothing');
    }

    // -- (d) THE EV-PRIMARY PATH: REAL, AND UNREACHABLE ---------------------------------------
    // §5.4: gated on `model.calibration.verdict === 'pass'`, which only the P5 ceremony may stamp,
    // and which S-C's verdict means can only ever be stamped FAIL. Two things have to be true at
    // once and they pull against each other: the flag must read FALSE on the shipped model, and the
    // path behind it must EXIST — a branch nobody can enter and nobody has written is not a gated
    // feature, it is a comment.
    //
    // REWRITTEN AT P5, AND STRICTLY STRONGER THAN WHAT IT REPLACED. This clause used to read
    // `model.calibration != null -> bad`: correct while no verdict existed, and it would now fire on
    // the very thing V3-PLAN §3.5 requires P5 to ship. The assertion it becomes is the one that was
    // always meant — the model must carry a verdict AND that verdict must not be 'pass' — which is a
    // tighter statement than "no block at all", because ABSENCE STOPPED BEING AVAILABLE AS EVIDENCE
    // the moment a block had to exist. I46 is the gate on whether the verdict agrees with the
    // pre-registered bar; what this clause keeps, in the EV family where it belongs, is that the EV
    // layer READS that verdict and stays out of the tiers.
    {
      if (P.evPrimary(model) !== false) bad.push('(d) evPrimary is true on the shipped model');
      if (model.calibration == null) {
        bad.push('(d) the shipped model carries no calibration block — V3-PLAN §3.5 requires the '
          + 'verdict to ship as data whatever it is (scripts/verify.mjs, stampCalibration)');
      } else if (model.calibration.verdict === 'pass') {
        bad.push('(d) the shipped calibration verdict is \'pass\' — EV primacy would be live, and '
          + 'flipping it is the §5.1 re-freeze ceremony rather than a stamp');
      } else if (model.calibration.verdict !== 'fail') {
        bad.push(`(d) the shipped verdict is ${JSON.stringify(model.calibration.verdict)}, which is `
          + 'neither pass nor fail — PC-0 admits no third answer');
      }
      for (const v of ['fail', 'FAIL', 'pass ', 'Pass', '', null, undefined, 1, true]) {
        if (P.evPrimary({ calibration: { verdict: v } }) !== false) bad.push(`(d) evPrimary accepted verdict ${JSON.stringify(v)}`);
      }
      if (P.evPrimary({ calibration: { verdict: 'pass' } }) !== true) bad.push('(d) evPrimary does not read a pass verdict at all — the gate is decorative');
      // THE TWIN, on I38(a)'s distinct-hash idiom. A twin sharing `meta.hash.slice(0, 8)` would be
      // handed the base model's memoised solve and this clause would pass vacuously — which is a
      // worse outcome than failing, because it would also POISON the walk above.
      const twin = {
        ...model,
        meta: { ...model.meta, hash: 'e'.repeat(64) },
        calibration: { verdict: 'pass', note: 'FABRICATED BY GATE I34 — never written to disk' },
      };
      Object.defineProperty(twin, '__hydrated', { value: true });
      if (twin.meta.hash.slice(0, 8) === model.meta.hash.slice(0, 8)) bad.push('(d) the twin shares the shipped memo prefix');
      if (P.evPrimary(twin) !== true) bad.push('(d) the twin does not reach the EV-primary path');
      const st = stateOf(walk.find((s) => s.node !== '3bet') || walk[0]);
      // the path REQUIRES a payoff: cutting tiers on EV with no EV to cut on must throw, never
      // silently fall back to the score.
      let threw = false;
      try { P.solve(twin, st); } catch { threw = true; }
      if (!threw) bad.push('(d) the EV-primary path scored silently with no payoff in the state');
      const twinOut = P.solve(twin, { ...st, payoff: makePayoff(twin) });
      const baseOut = P.solve(model, st);
      if (serialize(twinOut) === serialize(baseOut)) {
        bad.push('(d) the EV-primary path produces the score path\'s tiers — the branch is not real');
      }
      if (!Object.is(P.solve(model, st), baseOut)) bad.push('(d) interleaving the twin aliased the shipped model\'s solve');
      if (serialize(P.solve(model, st)) !== ref.get((walk.find((s) => s.node !== '3bet') || walk[0]).key)) {
        bad.push('(d) the twin poisoned the shipped model\'s memo entry');
      }
      // ...and the flag is IN the key, above the cache: flipping it must not hand back the cached answer.
      const twinOff = { ...twin, calibration: { verdict: 'fail' } };
      Object.defineProperty(twinOff, '__hydrated', { value: true });
      if (serialize(P.solve(twinOff, { ...st, payoff: makePayoff(twinOff) })) !== serialize(baseOut)) {
        bad.push('(d) the twin with the verdict flipped off does not reproduce the score path');
      }
    }

    P.clearSolveMemo();
    G('I34', bad.length === 0,
      `the EV quarantine (§5.4). (a) ${ref.size} settings — ${pairs.length} legal seats x the `
      + `${VPIP_GRID.length}-VPIP grid x ${LANES.length} environment lanes, sampled 1-in-${STRIDE} of `
      + `${all.length} and ordered by fnv1a of the setting's own key, which MEASURABLY mixes them: `
      + `${(100 * mixHash).toFixed(1)}% of consecutive visits differ on seat, node, VPIP and lane at `
      + `once, against ${(100 * mixExpect).toFixed(1)}% expected of a random ordering of this surface `
      + `(4 nodes and 5 VPIPs put a ceiling well under 100) and ${(100 * mixFlat).toFixed(1)}% in `
      + `construction order — each given a MEMO-COLD `
      + `reference serialisation of all ${cellChecks / (visits || 1) | 0} cells' tier, action, `
      + `pre-display action, MIX overlay, gate flag, promotion, score, margin, rank and frequency, plus `
      + `the eight aggregates. (b) the walk visits all ${visits} with score/EV/score interleaved and `
      + `${clears} hash-chosen memo clears, and the tiers are identical BY OBJECT: ${cellChecks} `
      + `Object.is comparisons on the cell objects themselves, the solve object unmoved across every `
      + `EV read, and evCut consuming the memoised solve rather than a copy over ${layers} cell `
      + `readings. Armed against a wrapper that mutates a memoised cell. (c) the badge is `
      + `evBadge(source, se, supported)'s answer on every cell and moves when any one of the three `
      + `moves. (d) evPrimary is FALSE on the shipped model — and since P5 that is a STRONGER reading `
      + `than it was rather than a weaker one: the model DOES carry a calibration block now and its `
      + `verdict is ${JSON.stringify(model.calibration && model.calibration.verdict)}, so the flag `
      + `fails on VALUE where it used to fail on absence (I46 is the gate on whether that verdict `
      + `agrees with the pre-registered bar; this clause is the EV layer's half — that the flag is `
      + `READ and the tiers stay out of reach). It rejects every near-miss verdict, and the path `
      + `behind it is REAL: a fabricated distinct-hash twin with verdict 'pass' throws without a `
      + `payoff, cuts different tiers with one, and never aliases the shipped model's memo`
      + (bad.length ? ` — ${bad.length} problems, first: ${bad[0]}` : ''));
    } },

    // =========================================================================
    // I39 — the arithmetic
    // =========================================================================
    { ids: ['I39'], label: 'EV arithmetic: fold is zero, rake enters exactly, the sign IS the price', run: () => {
    const bad = [];
    let foldN = 0;
    const K = P.CONSTANTS, KR = K.rake, D = K.depth;

    // -- (a) EV(FOLD) = 0 BY CONSTRUCTION, AND THE EXPRESSION IS THE EXPRESSION ----------------
    // The only money in `evBB` is money that goes in AT OR AFTER the decision node: the pot the node
    // built and hero's own stake in it. Blinds are sunk, so folding neither wins nor loses anything
    // measured here — there is no `foldEV` term, which is why there is none to get wrong. What can
    // be asserted is that the arithmetic contains nothing else: recompute it from the accessor's own
    // six keys and compare with Object.is, then check that `keep` compares against ZERO and that the
    // zero of the scale is exactly where hero gets his stake back.
    let recomputed = 0, geom = 0, keepBad = 0, potBad = 0;
    for (const { pos, node } of pairs) {
      if (node === '3bet') continue;
      for (const vp of VPIP_GRID) {
        for (const L of LANES) {
          const st = { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO',
            d: L.d, rakePct: L.rakePct, rakeCapBB: L.rakeCapBB, straddle: L.straddle };
          const cut = P.evCut(model, st, PAY);
          const env = cut.solved.env;
          const stake = P.evStake(model, env), rho = P.rakeRhoFactor(env);
          // the checkdown geometry, exactly: everyone puts in one stake and it checks down
          if (!Object.is(cut.potSize, stake * (cut.nOpp + 1))) potBad++;
          if (!Object.is(cut.stake, stake)) potBad++;
          geom++;
          for (const it of P.cellList(model)) {
            const e = cut.cells[it.key];
            const want = (e.ev * rho - e.invShare) * e.potMult * cut.potSize - stake;
            if (!Object.is(e.evBB, want)) recomputed++;
            if (e.keep !== (e.evBB >= 0)) keepBad++;
          }
        }
      }
    }
    if (recomputed) bad.push(`(a) ${recomputed} readings do not reproduce (ev*rho - invShare)*potMult*potSize - stake`);
    if (keepBad) bad.push(`(a) ${keepBad} readings compare keep against something other than zero`);
    if (potBad) bad.push(`(a) ${potBad} settings do not carry the checkdown geometry potSize = (nOpp+1)*stake`);

    /* THE FOLD LINE ITSELF, read off the LAYER at the two equities where it is EXACT. "EV(fold) = 0"
       is a claim about what is NOT in the expression, and the sharp form of it is the losing
       endpoint: a hand that never wins must lose EXACTLY its stake — no more. If a blind, an ante or
       any other sunk chip had leaked into the arithmetic, a zero-equity hand would be down more than
       it put in at the node, and this is the reading that would say so. The winning endpoint is the
       mirror: winning every time collects the whole raked pot and nothing beyond it.

       Read through a FABRICATED payoff rather than recomputed, so it is the shipped layer's own
       arithmetic being asked, and at 0 and 1 the multiplications are exact — the round-trip through
       a break-even equity is not, and asserting an IEEE round-trip would have been a claim about the
       floating-point unit rather than about the model. */
    {
      const probe = (ev) => {
        const f = function payoff() { return { ev, se: 1e-3, source: 'checkdown', supported: false, potMult: 1, invShare: 0 }; };
        f.modelHash = `fold-probe-${ev}`; f.route = 'projection'; return f;
      };
      let endBad = 0, endN = 0;
      for (const { pos, node } of pairs) {
        if (node === '3bet') continue;                      // the 3-bet route does not read the accessor
        for (const L of [LANES[0], LANES[5], LANES[11]]) {
          const st = { pos, node, v: 0.55, limpers: 2, raiserPos: 'CO',
            d: L.d, rakePct: L.rakePct, rakeCapBB: L.rakeCapBB, straddle: L.straddle };
          const lose = P.evCut(model, st, probe(0)), win = P.evCut(model, st, probe(1));
          const stake = lose.stake, rho = lose.rho;
          for (const it of P.cellList(model)) {
            endN++;
            if (!Object.is(lose.cells[it.key].evBB, -stake)) endBad++;
            if (lose.cells[it.key].keep !== false) endBad++;
            if (!Object.is(win.cells[it.key].evBB, rho * lose.potSize - stake)) endBad++;
          }
        }
      }
      if (endBad) bad.push(`(a) ${endBad} of ${endN} endpoint readings put the fold line off zero — `
        + 'a hand that never wins does not lose exactly its stake, so sunk money is in the expression');
      foldN = endN;
    }

    // -- (b) RAKE ENTERS THROUGH `rakeRhoFactor` AND NOWHERE ELSE ------------------------------
    // §7.2's I39 row fails on "rake re-modelled inside the payoff". Two clauses, and the second is
    // the one with teeth: the ACCESSOR NEVER SEES THE RAKE — its six keys are Object.is-identical
    // across rake settings at the same request — so a per-hand cap cannot be hiding inside `potMult`
    // or `invShare`. The first re-derives `1 - rho` from I31(c)'s own arithmetic, the depth-coupled
    // reference pot included.
    let rakeBad = 0, accessorMoved = 0, ident = 0, geomBad = 0;
    for (const rakePct of [0, 1, 2.5, 3, 5, 6]) {
      for (const straddle of [false, true]) {
        for (const d of [D.min, D.ref, D.max]) {
          for (const rakeDepth of [false, true]) {
            const env = P.envOf({ rakePct, straddle, d, rakeDepth });
            const pot = rakeDepth ? KR.potBB * Math.pow(d / D.ref, KR.potScale) : KR.potBB;
            const want = Math.min(rakePct / 100, KR.capBB / (pot * (straddle ? K.straddle.unit : 1)));
            if (Math.abs((1 - P.rakeRhoFactor(env)) - want) > 1e-15) rakeBad++;
            const st = { pos: 'BTN', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO',
              rakePct, straddle, d, rakeDepth };
            const cut = P.evCut(model, st, PAY);
            if (!Object.is(cut.rho, P.rakeRhoFactor(env))) rakeBad++;
            const zero = P.evCut(model, { ...st, rakePct: 0 }, PAY);
            for (const it of P.cellList(model)) {
              const a = cut.cells[it.key], z = zero.cells[it.key];
              ident++;
              // the accessor's own return, unmoved by the house
              if (!(Object.is(a.ev, z.ev) && Object.is(a.se, z.se) && a.source === z.source
                    && a.supported === z.supported && Object.is(a.potMult, z.potMult)
                    && Object.is(a.invShare, z.invShare))) accessorMoved++;
              // the checkdown pot identities: no per-hand cap can live here
              if (!(a.potMult === 1 && a.invShare === 0)) geomBad++;
            }
          }
        }
      }
    }
    if (rakeBad) bad.push(`(b) ${rakeBad} environments do not reproduce I31(c)'s rake arithmetic exactly`);
    if (accessorMoved) bad.push(`(b) the payoff return moved with the rake on ${accessorMoved} readings — rake is being re-modelled inside the payoff`);
    if (geomBad) bad.push(`(b) ${geomBad} readings carry a checkdown pot geometry other than potMult 1 / invShare 0`);

    // -- (c) THE VS-3-BET SIGN IS THE BREAKEVEN COMPARISON, AS AN IDENTITY ----------------------
    // THIS ROUTE BYPASSES THE FROZEN ACCESSOR, AND THAT IS SAID OUT LOUD RATHER THAN LEFT TO BE
    // NOTICED. `payoff()` takes CELL KEYS; the vs-3-bet decision is against a MIX of four villain
    // ranges, which is not a cell, so there is nothing to ask it. The share is `eqMixOf` and the
    // error is the blend's own — `seOfTrials(meta.trials.vs3bet)` combined by mix weight. It is a
    // SECOND EV route, it is the only way this clause can be meaningful, and the badge it wears is
    // the same `evBadge`'s, so the reader is not told it is anything better than it is.
    //
    // With the pot written from the price, the sign is an IDENTITY rather than an agreement:
    //   evBB >= 0  <=>  eqMix*(1-r)/p >= 1  <=>  eqMix >= p/(1-r) = breakevenPrice(env)
    // "Within tolerance" therefore means only the +/-se neighbourhood of zero, where the measurement
    // cannot resolve which side the cell is on. That band is COUNTED, never used as an allowance.
    let signBad = 0, signN = 0, inBand = 0, mixEvBad = 0, mixSeBad = 0;
    const mixSE = (mix) => {
      let w = 0; for (const m of mix) w += m * m;
      return P.seOfTrials(model.meta.trials.vs3bet) * Math.sqrt(w) / 100;
    };
    for (const pos of P.POSITIONS) {
      if (P.positionDisabled(pos, '3bet')) continue;
      for (const rakePct of [0, 2.5, 5]) {
        for (const sizing of [K.sizing.min, K.sizing.ref, K.sizing.max]) {
          for (const d of [D.min, D.ref, D.max]) {
            const st = { pos, node: '3bet', v: 0.55, limpers: 2, raiserPos: 'CO', rakePct, sizing, d };
            const cut = P.evCut(model, st, PAY);
            const env = cut.solved.env;
            const be = P.breakevenPrice(env);
            const se = mixSE(K.vs3bet.mix);
            for (const it of P.cellList(model)) {
              const e = cut.cells[it.key];
              signN++;
              if (!Object.is(e.ev, P.eqMixOf(it.cell, K.vs3bet.mix))) mixEvBad++;
              if (!Object.is(e.se, se)) mixSeBad++;
              const near = Math.abs(e.ev - be) <= e.se;
              if (near) inBand++;
              else if ((e.evBB >= 0) !== (e.ev >= be)) signBad++;
            }
          }
        }
      }
    }
    if (signBad) bad.push(`(c) ${signBad} of ${signN} vs-3-bet readings disagree with breakeven outside the +/-se band`);
    if (mixEvBad) bad.push(`(c) ${mixEvBad} vs-3-bet shares are not eqMixOf's own answer`);
    if (mixSeBad) bad.push(`(c) ${mixSeBad} vs-3-bet errors are not the blend's own seOfTrials`);

    // -- (d) THE BADGES DERIVE FROM DATA -------------------------------------------------------
    let badgeBad = 0, badgeN = 0, unsupported = 0, srcBad = 0;
    for (const { pos, node } of pairs) {
      const cut = P.evCut(model, { pos, node, v: 0.55, limpers: 2, raiserPos: 'CO' }, PAY);
      for (const it of P.cellList(model)) {
        const e = cut.cells[it.key];
        badgeN++;
        if (e.badge !== P.evBadge(e)) badgeBad++;
        if (e.source !== 'checkdown') srcBad++;
        if (!e.supported) { unsupported++; if (e.badge.indexOf('unsupported') !== 0) badgeBad++; }
      }
    }
    if (badgeBad) bad.push(`(d) ${badgeBad} badges are not evBadge's answer, or do not lead with the page's own word`);
    if (srcBad) bad.push(`(d) ${srcBad} readings claim a source other than 'checkdown' — Grade C ships one payoff`);
    if (unsupported !== badgeN) bad.push(`(d) only ${unsupported} of ${badgeN} readings are supported:false — the multiway door was quietly promoted`);

    // -- (e) `stake` IS A PURE DISPLAY SCALE ---------------------------------------------------
    // The pot geometry makes `evBB = stake * (dimensionless edge)`, so nothing decision-relevant may
    // read it. Perturbed by fabricating a distinct-hash twin whose sizing ladder starts at a
    // different rung — which is also the only way to move `stake` at all, since it is derived from
    // an identity of the game rather than typed. `mix` rides along because z = |evBB|/seBB is scale
    // free. If a future payoff ever reads `spr` this clause will start failing, and it should: `spr`
    // is depth/potSize, so a stake-sensitive payoff makes the display scale decision-relevant.
    const ladder = model.constants.solver.sizingLadder;
    const twinStake = {
      ...model,
      meta: { ...model.meta, hash: 'a'.repeat(64) },
      constants: { ...model.constants, solver: { ...model.constants.solver, sizingLadder: '6 / 18 / 54 / 162' } },
    };
    Object.defineProperty(twinStake, '__hydrated', { value: true });
    let scaleBad = 0, scaleN = 0;
    if (!(P.evStake(twinStake, undefined) === 2 * P.evStake(model, undefined))) {
      bad.push('(e) the fabricated ladder did not move the stake — the perturbation is not armed');
    }
    for (const { pos, node } of pairs) {
      for (const vp of [25, 55, 90]) {
        const st = { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' };
        const a = P.evCut(model, st, PAY), b = P.evCut(twinStake, st, PAY);
        if (!Object.is(a.width, b.width) || !Object.is(a.setWidth, b.setWidth)
          || !Object.is(a.keepWidth, b.keepWidth) || !Object.is(a.mixWidth, b.mixWidth)) scaleBad++;
        for (const it of P.cellList(model)) {
          scaleN++;
          const x = a.cells[it.key], y = b.cells[it.key];
          if (x.keep !== y.keep || x.mix !== y.mix) scaleBad++;
        }
      }
    }
    const kBase = evMixK(model, PAY).mixK, kScaled = evMixK(twinStake, PAY).mixK;
    if (!Object.is(kBase, kScaled)) bad.push(`(e) k moved with the display scale: ${kBase} -> ${kScaled}`);
    if (scaleBad) bad.push(`(e) ${scaleBad} readings changed a decision when only the display scale moved`);

    // -- (f) THE EV MEMO CARRIES `ip` AND THE MODEL HASH — ASSERTED, NOT ASSUMED ----------------
    // `scripts/lib/policy.mjs` is OUTSIDE gate I33(g)'s `MEMO_SCOPE` by filename, so that clause's
    // text detector never looks at this memo. Rather than exploit the blind spot, the key is written
    // as though the detector were watching AND both halves are asserted here: I33's own
    // `memoProblems` is run VOLUNTARILY over the `evCut` region, and the separation is probed
    // dynamically the way `ipMemoAliases` probes the accessor's — a memo that dropped an axis hands
    // the same OBJECT back for two requests that differ on it.
    let evSrc = '';
    try { evSrc = readFileSync(resolve(ROOT, 'scripts/lib/policy.mjs'), 'utf8'); }
    catch (err) { bad.push(`(f) policy.mjs is unreadable: ${err.message}`); }
    const from = evSrc.indexOf('const EV_MEMO = new Map();');
    const region = from < 0 ? '' : evSrc.slice(from, evSrc.indexOf('function evCells(', from));
    if (!region) bad.push('(f) the evCut memo region could not be located in policy.mjs');
    for (const why of memoProblems('scripts/lib/policy.mjs (evCut region, scanned voluntarily)', region)) bad.push(`(f) ${why}`);
    if (!/\bip\b/.test(stripComments(region)) || !/hash/i.test(stripComments(region))) {
      bad.push('(f) the evCut memo key names neither ip nor the model hash');
    }
    {
      const st = { pos: 'BTN', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO' };
      const twinHash = { ...model, meta: { ...model.meta, hash: 'b'.repeat(64) } };
      Object.defineProperty(twinHash, '__hydrated', { value: true });
      const PAY2 = makePayoff(twinHash);
      if (Object.is(P.evCut(model, { ...st, ip: false }, PAY), P.evCut(model, { ...st, ip: true }, PAY))) {
        bad.push('(f) the EV memo hands the same object back for ip on and off');
      }
      if (Object.is(P.evCut(model, st, PAY), P.evCut(twinHash, st, PAY2))) {
        bad.push('(f) the EV memo hands the same object back for two different models');
      }
      if (Object.is(P.evCut(model, st, PAY), P.evCut(model, st, PAY2))) {
        bad.push('(f) the EV memo hands the same object back for two different payoff bindings');
      }
      // ARMED: the probe must SEE a memo that dropped ip, or it is checking that two calls differ.
      const keyless = (() => { const m = new Map(); return (mo, s, p) => {
        const k = `${s.pos}|${s.node}|${s.v}`; if (!m.has(k)) m.set(k, P.evCut(mo, s, p)); return m.get(k); }; })();
      if (!Object.is(keyless(model, { ...st, ip: false }, PAY), keyless(model, { ...st, ip: true }, PAY))) {
        bad.push('(f) the aliasing probe is not armed: a keyless memo did not alias');
      }
    }

    G('I39', bad.length === 0,
      `EV arithmetic (§7.2). (a) EV(FOLD) = 0 BY CONSTRUCTION — the only money in the expression is `
      + `money that enters at or after the node, so there is no fold term to get wrong: over `
      + `${geom} settings x ${P.cellList(model).length} cells, every evBB reproduces `
      + `(ev*rho - invShare)*potMult*potSize - stake by Object.is, every keep compares against ZERO, `
      + `and the geometry is the checkdown one (potSize = (nOpp+1) stakes) at every setting. THE `
      + `SHARP FORM is read off the layer through a fabricated payoff at the two equities where the `
      + `arithmetic is exact: over ${foldN} endpoint readings a hand that NEVER WINS loses exactly `
      + `its stake and not a chip more — which is what says no blind and no sunk money is in the `
      + `expression — and a hand that always wins collects exactly the raked pot. (b) RAKE ENTERS ONLY THROUGH `
      + `rakeRhoFactor, the exact I31(c) machinery: 1 - rho reproduces min(pct, capBB/(rakePot*unit)) `
      + `to 1e-15 over 6 rake settings x straddle x depth {40,100,250} x both couplings including the `
      + `depth-coupled reference pot, and — the clause with teeth — the ACCESSOR'S OWN SIX KEYS ARE `
      + `Object.is-IDENTICAL across every rake setting over ${ident} readings, so a per-hand cap `
      + `cannot be hiding inside potMult or invShare; both hold their checkdown identities (1 and 0) `
      + `on every one. (c) THE VS-3-BET SIGN IS AN IDENTITY, NOT AN AGREEMENT: sign(evBB) = `
      + `sign(eqMix - breakevenPrice) on ${signN - inBand} of ${signN} readings, with the remaining `
      + `${inBand} inside the +/-se neighbourhood of zero where the measurement cannot resolve the `
      + `side — counted, never used as an allowance. THIS ROUTE BYPASSES THE FROZEN ACCESSOR and says `
      + `so: payoff() takes cell keys and a MIX is not a cell, so the share is eqMixOf's own and the `
      + `error is the blend's (seOfTrials(${model.meta.trials.vs3bet}) by mix weight), both asserted `
      + `by Object.is here. The pot is written from the price exactly as the page's nodePotBB writes `
      + `it, generalised to read sizingPrice so the identity survives the sizing axis. (d) badges: `
      + `all ${badgeN} are evBadge(source, se, supported)'s answer, all ${unsupported} lead with the `
      + `page's own word 'unsupported', and all ${badgeN} carry source 'checkdown' — under Grade C `
      + `every percentile reading is supported:false through the hero-only request shape, and the `
      + `multiway door is NOT quietly promoted. (e) STAKE IS A PURE DISPLAY SCALE, derived from `
      + `constants.solver.sizingLadder "${ladder}" (an arithmetic identity of the game, §6's measured `
      + `block) rather than typed: doubling it on a distinct-hash twin moves not one keep, mix, `
      + `width or k over ${scaleN} readings, and k stays ${kBase} by Object.is. (f) the EV memo `
      + `carries ip and the model hash — policy.mjs is OUT of I33(g)'s filename scope, so its own `
      + `detector is run here VOLUNTARILY over the evCut region rather than the blind spot being `
      + `exploited, and the separation is probed dynamically as well: ip on/off, two models and two `
      + `payoff bindings all hand back different objects, and a keyless memo is seen to alias`
      + (bad.length ? ` — ${bad.length} problems, first: ${bad[0]}` : ''));
    if (process.env.RUNDOWN_EV_DEBUG) for (const b of bad) console.error('  I39 >', b);
    } },

    // =========================================================================
    // I40 — what the cut moves
    // =========================================================================
    { ids: ['I40'], label: 'EV-cut behaviour: rake narrows, depth moves with the seat signs', run: () => {
    const bad = [];
    const K = P.CONSTANTS, KR = K.rake, D = K.depth;
    const pcts = pairs.filter((p) => p.node !== '3bet');

    // -- (a) RAKE NARROWS EV-MODE WIDTH — THE DELIBERATE ANTI-I31(a) ---------------------------
    // METHODOLOGY limitation 17: a percentile cut can change WHICH hands you play but never HOW
    // MANY, which is why I31(a) measures a 5% rake moving 27,675 scores and ZERO tiers. The absolute
    // EV cut is the designated structural fix, and this is the clause written to prove the fix
    // bites: at the same settings, on the same cells, the score-path width must not move and the
    // EV-mode width must.
    let rakeViol = 0, rakeN = 0, w0 = 0, w5 = 0, worstRake = '';
    let scoreMoved = 0, evMoved = 0, contrastN = 0;
    for (const { pos, node } of pcts) {
      for (const vp of VPIP_GRID) {
        for (const d of [D.min, D.ref, D.max]) {
          for (const rakeDepth of [false, true]) {
            for (const depthWidth of [false, true]) {
              const b = { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO', d, rakeDepth, depthWidth };
              const a = P.evCut(model, { ...b, rakePct: KR.min }, PAY);
              const c = P.evCut(model, { ...b, rakePct: KR.preset }, PAY);
              rakeN++; w0 += a.width; w5 += c.width;
              if (c.width > a.width) {
                rakeViol++;
                if (!worstRake) worstRake = `${pos}/${node}@${vp} d${d}${rakeDepth ? ' coupled' : ''}${depthWidth ? ' dw' : ''}`;
              }
              // the CONTRAST, on the legacy couplings so it is I31(a)'s own surface
              if (rakeDepth || depthWidth) continue;
              contrastN++;
              if (!Object.is(P.solve(model, { ...b, rakePct: KR.min }).width,
                             P.solve(model, { ...b, rakePct: KR.preset }).width)) scoreMoved++;
              if (!Object.is(a.width, c.width)) evMoved++;
            }
          }
        }
      }
    }
    if (rakeViol) bad.push(`(a) the ${KR.preset}% rake WIDENED the EV-mode set at ${rakeViol} of ${rakeN} settings, first ${worstRake}`);
    if (!(w5 < w0)) bad.push(`(a) pooled EV-mode width did not narrow under rake: ${pct(w0 / rakeN)} -> ${pct(w5 / rakeN)}`);
    if (scoreMoved !== 0) bad.push(`(a) the score path moved ${scoreMoved} widths under rake — I31(a) is broken, not re-scoped`);
    if (evMoved === 0) bad.push('(a) the EV-mode width did not move under rake anywhere — the fix does not bite');

    // -- (b) DEPTH MOVES EV-MODE WIDTH WITH I42'S SEAT SIGNS ------------------------------------
    // On I42 clause (c)'s DIFFERENCED CONTROL, and for its reason: painted width already drifts with
    // depth through M_deep and through cells crossing a fixed percentile cut, so an undifferenced
    // comparison measures the re-sort rather than the axis. Differenced against the same setting
    // with `depthWidth` OFF, the axis's own contribution to the EV-mode width is what is left.
    //
    // SCOPED EXACTLY AS I42 SCOPES ITSELF: asserted on the four seats whose factor moves further
    // than a cell is wide (CO, BTN, SB, BB), reported for UTG and HJ, whose factors are 0.9894 and
    // 0.9965 at 250 bb — under the granularity I16 and I21 both document. Reading a sign off a
    // quantity that rounds to zero would be reading noise.
    const seat = {};
    for (const pos of P.POSITIONS) seat[pos] = { deep: 0, shal: 0, n: 0 };
    for (const { pos, node } of pcts) {
      for (const vp of VPIP_GRID) {
        const st = { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' };
        const refOn = P.evCut(model, { ...st, depthWidth: true }, PAY).width;
        const refOff = P.evCut(model, st, PAY).width;
        const s = seat[pos];
        for (const [k, d] of [['deep', D.max], ['shal', D.min]]) {
          const on = P.evCut(model, { ...st, d, depthWidth: true }, PAY).width;
          const off = P.evCut(model, { ...st, d }, PAY).width;
          s[k] += (on - refOn) - (off - refOff);
        }
        s.n++;
      }
    }
    const STRONG = ['CO', 'BTN', 'SB', 'BB'];
    const seatLine = [];
    for (const pos of P.POSITIONS) {
      const s = seat[pos];
      s.deep /= s.n; s.shal /= s.n;
      seatLine.push(`${pos} ${(s.deep * 100 >= 0 ? '+' : '')}${(s.deep * 100).toFixed(3)}`);
      if (STRONG.indexOf(pos) < 0) continue;
      const wantLoose = K.baseR[pos] > 1;
      if ((s.deep > 0) !== wantLoose) bad.push(`(b) EV-mode painted sign deep ${pos}: ${(s.deep * 100).toFixed(3)} pts`);
      if ((s.shal < 0) !== wantLoose) bad.push(`(b) EV-mode painted sign shallow ${pos}: ${(s.shal * 100).toFixed(3)} pts`);
    }

    // -- (c) §7.2'S OFFERED PREDICTION, MEASURED — AND IT IS FALSIFIED --------------------------
    // "shallow+raked folds more than deep+raked at every seat". It does not, and the plan's own
    // instruction for that case is to ship the finding: the inversions are ENUMERATED in
    // `scripts/lib/ev-band.mjs` and compared in BOTH directions here, on skill.mjs's
    // WIDTH_*_EXCEPTIONS idiom — a record compared one way only is a record that quietly grows.
    const predOK = [], predInv = [], predEq = [];
    for (const { pos, node } of pcts) {
      for (const vp of VPIP_GRID) {
        const b = { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO',
          rakePct: KR.preset, rakeDepth: true, depthWidth: true };
        const sh = P.evCut(model, { ...b, d: D.min }, PAY).width;
        const dp = P.evCut(model, { ...b, d: D.max }, PAY).width;
        const key = `${pos}|${node}@${vp}`;
        if (sh < dp) predOK.push(key); else if (sh > dp) predInv.push(key); else predEq.push(key);
      }
    }
    const seen = new Set(predInv);
    for (const k of seen) if (!PREDICTION_EXCEPTION_KEYS.has(k)) bad.push(`(c) a NEW inversion the record does not carry: ${k}`);
    for (const k of PREDICTION_EXCEPTION_KEYS) if (!seen.has(k)) bad.push(`(c) a recorded inversion stopped inverting: ${k}`);
    if (predInv.length === 0) bad.push('(c) the prediction now holds everywhere — the record must be retired, not left standing');
    const byNode = {};
    for (const k of predInv) { const n = k.split('|')[1].split('@')[0]; byNode[n] = (byNode[n] || 0) + 1; }

    // -- (d) `k` IS RE-DERIVED FROM SCRATCH AND MUST EQUAL WHAT SHIPPED -------------------------
    // The baselineQuant / I36(e) idiom: the constant is DERIVED, so the failure that actually
    // happens is that the distribution is regenerated and the constant is not. Re-solved here from
    // the shipped cells every run and compared with Object.is, field by field — and `derivedAt` has
    // to still describe the default state, or the block is a true statement about a page nobody
    // opens any more.
    //
    // WHAT THAT FIELD-BY-FIELD COMPARISON IS AND IS NOT, stated because P4's red team measured it
    // (docs/refutations/P4.md) and three refuters of three reported the same thing. Under the house
    // GREEN command the comparison is a SELF-comparison: `verify.mjs`'s CLI calls `stampConstants`
    // before `verifyModel`, and that call rewrites `model.constants.evCut` from the very function
    // re-run here, so a k hand-edited on disk is silently restamped and this loop compares the
    // derivation with itself. What actually bounds the block is (i) the BRACKET below, which every
    // wrong derivation the refuters built — a doubled target, a halved one, a narrowed seat scope,
    // T1 counted instead of t4 — failed even after a full restamp and rebuild; (ii) the identities
    // asserted against the model and the accessor rather than against `fresh`; and (iii)
    // `test/ev-cut.test.mjs`, which reads the model off DISK without stamping and is what catches a
    // hand-moved number. The loop stays because a gate family run against an unstamped model (the
    // way `test/gates-*.test.mjs` runs it) is exactly where it does bite.
    const shipped = model.constants && model.constants.evCut;
    if (!shipped) {
      bad.push('(d) constants.evCut is not stamped — the EV MIX band has no shipped k, so the band is not drawn');
    } else {
      const fresh = evMixK(model, PAY);
      for (const f of ['mixK', 't4Mass', 'evMassAtK', 'evMassNextStep']) {
        if (!Object.is(shipped[f], fresh[f])) bad.push(`(d) ${f} re-derives as ${fresh[f]}, shipped ${shipped[f]}`);
      }
      for (const f of ['trials', 'sePt', 'seBBMean']) {
        if (!Object.is(shipped.seUnit[f], fresh.seUnit[f])) bad.push(`(d) seUnit.${f} re-derives as ${fresh.seUnit[f]}`);
      }
      /* seUnit, ASSERTED AGAINST SOMETHING OTHER THAN ITS OWN DERIVATION — added at P4's red-team
         stage, and it is the one row of the EV block three refuters of three could not falsify
         (`docs/refutations/P4.md`). `sePt: 0.9` and `seBBMean: 0.5`, simply typed in place of their
         derivations, shipped 60/60 gates, 632 tests and 2/2 variants current. The reason is
         structural rather than an oversight: `verify.mjs`'s CLI calls `stampConstants` BEFORE
         `verifyModel`, so `shipped` was written from `fresh`'s own function moments earlier and the
         loop above is a comparison of the derivation with itself; `test/ev-cut.test.mjs`, which
         reads the model off disk without stamping, did not carry seUnit either; and nothing
         downstream consumes it (the band reads each cell's own `seBB`). The block's own claim is
         "derived from the shipped trial count; never typed", and that is an IDENTITY with shipped
         data — I38(b)'s `vFloor === villainLattice.v[0]` shape — so it is asserted here as one. No
         anchor is invented: this is the anchor the block already claimed, made falsifiable. */
      const trialsCell = model.meta && model.meta.trials ? model.meta.trials.cell : null;
      if (shipped.seUnit.trials !== trialsCell) {
        bad.push(`(d) seUnit.trials is ${shipped.seUnit.trials} but the model ran ${trialsCell} trials per cell — `
          + 'the unit the band is published in is not the unit the payload was measured at');
      }
      if (!Object.is(shipped.seUnit.sePt, P.seOfTrials(trialsCell))) {
        bad.push(`(d) seUnit.sePt is ${shipped.seUnit.sePt} where seOfTrials(${trialsCell}) is `
          + `${P.seOfTrials(trialsCell)} — the point-scale se was typed, not derived from the shipped trial count`);
      }
      /* ...and `seBBMean` against a SECOND WALK written here, not against the module that produced
         it. Same seats, same accessor, same combo weighting, accumulated independently — the
         refuters' own recommendation, and the only form under which "a measurement of the shipped
         distribution" is a claim this gate can fail. */
      {
        const poolD = P.poolAt(model, P.villainLoadDefault(model));
        let seSum = 0, seN = 0;
        for (const { pos, node } of pairs) {
          const layer = P.evCut(poolD.model, { pos, node, v: poolD.v, limpers: 2, raiserPos: 'CO' }, PAY);
          for (const it of P.cellList(poolD.model)) {
            const se = layer.cells[it.key].seBB;
            if (isFinite(se)) { seSum += se * it.combos; seN += it.combos; }
          }
        }
        const mean = seN ? seSum / seN : null;
        if (!Object.is(shipped.seUnit.seBBMean, mean)) {
          bad.push(`(d) seUnit.seBBMean is ${shipped.seUnit.seBBMean} where an independent walk of the same `
            + `${pairs.length} seats measures ${mean} — the published unit is not the distribution's own`);
        }
      }
      if (shipped.derivedAt.state !== evDefaultKey(model)) {
        bad.push(`(d) derivedAt no longer describes the default state: "${shipped.derivedAt.state}" vs "${evDefaultKey(model)}"`);
      }
      if (shipped.derivedAt.pairs !== pairs.length) bad.push(`(d) derivedAt.pairs ${shipped.derivedAt.pairs} is not the ${pairs.length} legal seats`);
      if (!Object.is(shipped.derivedAt.t4Band, K.t4Band)) bad.push('(d) derivedAt.t4Band is not the live t4Band');
      if (shipped.kind !== 'derived') bad.push(`(d) the block calls itself '${shipped.kind}' rather than derived`);
      if (!/scoreAtCut/.test(shipped.derivation) || !/t4Band/.test(shipped.derivation)) {
        bad.push('(d) the shipped derivation sentence does not name the function and the mass it solves against');
      }
      // ...and the band is REACHED: a k nothing falls inside is a band that is not a band.
      const cut = P.evCut(model, { pos: 'BTN', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO' }, PAY);
      if (!Object.is(cut.mixK, shipped.mixK)) bad.push('(d) the runtime layer does not read the stamped k');
      if (!(shipped.evMassAtK > 0 && shipped.evMassAtK <= shipped.t4Mass && shipped.t4Mass <= shipped.evMassNextStep)) {
        bad.push(`(d) the target mass is not bracketed by the two achievable bands: `
          + `${shipped.evMassAtK} / ${shipped.t4Mass} / ${shipped.evMassNextStep}`);
      }
    }

    const ev = model.constants && model.constants.evCut;
    G('I40', bad.length === 0,
      `EV-cut behaviour (§3.4, §7.2). (a) RAKE NARROWS, AND THAT IS THE DELIBERATE ANTI-I31(a): over `
      + `${rakeN} settings — ${pcts.length} percentile seats x the 5-VPIP grid x depth {40,100,250} x `
      + `both couplings — the ${KR.preset}% rake widened the EV-mode set ${rakeViol} times, and pooled `
      + `width goes ${pct(w0 / rakeN)} -> ${pct(w5 / rakeN)}. THE CONTRAST IS THE POINT, measured on `
      + `I31(a)'s own legacy surface: at ${contrastN} identical settings the SCORE-path width moves `
      + `${scoreMoved} times and the EV-mode width moves ${evMoved}. That is METHODOLOGY limitation `
      + `17's designated structural fix biting — a percentile cut cannot change how many hands you `
      + `play, and an absolute cut can. (b) DEPTH MOVES EV-MODE WIDTH WITH I42's SEAT SIGNS, on I42 `
      + `clause (c)'s differenced control (axis on minus axis off, so the measurement is the axis and `
      + `not the re-sort): deep deltas ${seatLine.join(', ')} pts. ASSERTED on ${STRONG.join('/')}, `
      + `whose factor moves further than a cell is wide, and REPORTED for UTG and HJ — I42's own `
      + `scope, for I42's own reason. (c) §7.2's OFFERED PREDICTION IS FALSIFIED, and the finding `
      + `ships rather than the tolerance: "shallow+raked folds more than deep+raked at every seat" `
      + `holds at ${predOK.length} of ${predOK.length + predInv.length + predEq.length} seat-VPIP `
      + `readings and INVERTS at ${predInv.length}` + (predEq.length ? ` (${predEq.length} flat)` : '')
      + `. The inversions are not scattered: ${Object.keys(byNode).map((n) => `${byNode[n]} at ${n}`).join(', ')}, `
      + `with SB|raise and BB|raise inverting at 4 of 5 VPIPs each. The two couplings pull against `
      + `each other — rakeDepth grows the reference pot with the stack so the 3bb cap binds HARDER `
      + `when shallow, which puts the HIGHER effective rake deep, while depthWidth tightens every `
      + `seat whose baseR is under 1 as the stack grows. All ${PREDICTION_EXCEPTIONS.length} are `
      + `enumerated in scripts/lib/ev-band.mjs and compared in BOTH directions here. (d) THE EV MIX `
      + `BAND'S k IS RE-DERIVED FROM SCRATCH every run and Object.is-compared against the stamped `
      + `block: k = ${ev ? ev.mixK : '?'}, solved by scoreAtCut — the percentile cut's own function, `
      + `on its own cumMid convention — so the EV band carries t4Band's frequency mass by the same `
      + `arithmetic every other cut in the model is read with. The distribution is a STEP function `
      + `with tie plateaus, so the target ${ev ? pct(ev.t4Mass) : '?'} is BRACKETED rather than hit: `
      + `${ev ? pct(ev.evMassAtK) : '?'} strictly below k and ${ev ? pct(ev.evMassNextStep) : '?'} at `
      + `the next distinct z. Both readings ship in constants.evCut, and derivedAt is checked to still `
      + `describe the default state. THE UNIT IS ASSERTED AGAINST THE PAYLOAD RATHER THAN AGAINST ITS `
      + `OWN DERIVATION, after P4's red team typed sePt and seBBMean in place of theirs and shipped `
      + `60/60 green: seUnit.trials === meta.trials.cell, seUnit.sePt === seOfTrials(that count), and `
      + `seBBMean against a second walk of the same ${pairs.length} seats written here. Under the CLI `
      + `the field-by-field re-derivation is a self-comparison (stampConstants runs before the gates); `
      + `what bounds the block is the bracket, those identities, and test/ev-cut.test.mjs reading the `
      + `model off disk unstamped`
      + (bad.length ? ` — ${bad.length} problems, first: ${bad[0]}` : ''));
    if (process.env.RUNDOWN_EV_DEBUG) for (const b of bad) console.error('  I40 >', b);
    } },

    ],
  };
}
