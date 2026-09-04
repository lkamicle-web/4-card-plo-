// gates I38 I37 — the P4 pool-skill axis, and the divergence accounting along it.
//
// V3-PLAN §3.4 (the axis, halved to its fold-more half by §3.6's Grade-C row), §6 (three constants:
// the fold-more half's lattice anchor, the interior blend, the plays-better coefficient), §7.2's
// I37 and I38 rows. One family for two gates because they share ONE expensive input — the pools
// the dial resolves to, and the ~100 solves taken along them — and the registry's family contract
// exists so shared setup is paid for once. `scripts/lib/skill.mjs` holds the measurement code and
// the three frozen records; this file is the assertions.
//
// WHAT EACH GATE IS FOR, in one line each:
//
//   I38  the AXIS. That the lobby endpoint is the current model by OBJECT IDENTITY, that the dial's
//        floor is the measurement's own floor, that the dial is a coordinate change on VPIP and
//        adds no second pathway, that combo-weighted width tightens along it with every exception
//        enumerated rather than allowed for, and that the plays-better coefficient — which Grade C
//        does not build — reaches exactly nothing.
//
//   I37  the DIVERGENCE. That the interior blend is the sentence the page publishes, that its
//        endpoints are reproduced exactly and land on measured lattice rows while its interior is
//        badged `interpolated`, that the per-cell convergence record is the one measured now, and
//        that §7.2's "≈ 0 at pool = baseline" clause is recorded as NOT MEASURABLE with a detector
//        armed against the day it becomes measurable — never toleranced into a pass.
//
// COST. The setup is 5 pools × 21 pairs of `P.solve`, all memoised, plus three file reads: a
// couple of hundred milliseconds.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as P from '../lib/policy.mjs';
import * as SK from '../lib/skill.mjs';
import { stripComments } from './payoff.mjs';
import { ROOT } from './_shared.mjs';

export const family = 'skill';
export const title = 'the P4 pool-skill axis (I38) and the vs-GTO divergence accounting along it (I37)';
// EMITTED AXIS-FIRST, which is why this reads I38 I37 rather than §7.2's catalog order: I37's
// clauses are measurements taken ALONG the dial, so a run where the axis itself is broken should
// say so on the line above the accounting rather than below it. EXPECTED_IDS carries the same
// order, and the registry's import-time guard is what keeps the two from drifting apart.
export const ids = ['I38', 'I37'];
export const setupLabel = 'resolve the dial to its pools and solve the 21 pairs along it';

/**
 * Comments AND string literals out. `stripComments` alone is not enough for the plays-better scan:
 * `constants.skill.flag` is a string that NAMES `playsBetter` — that is the admission §6 requires —
 * and the Method view's badge map carries `'skill.playsBetter'` as a key. Both are the flag working
 * as designed and neither is a read. What is left after this is code.
 */
export function stripLiterals(text) {
  return stripComments(text)
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/**
 * The files the plays-better clause scans, and the count each is allowed.
 *
 * `policy.mjs` gets ONE: the declaration `playsBetter: null`. Everything else gets ZERO. The gate
 * family and the test that arms it are deliberately out of scope — they are the code asserting the
 * field is unread, and counting them would be counting the thermometer.
 */
export const REACH_SCOPE = Object.freeze([
  ['scripts/lib/policy.mjs', 1],
  ['scripts/lib/skill.mjs', 0],
  ['scripts/lib/payoff.mjs', 0],
  ['scripts/lib/payoff-model.mjs', 0],
  ['scripts/lib/cfr.mjs', 0],
  ['scripts/lib/equilibrium.mjs', 0],
  ['scripts/lib/tier-fixture-v3.mjs', 0],
  ['src/shell.html', 0],
]);

/** `src/shell.html`'s own node table, read back so `skill.mjs`'s T2 mapping cannot drift from it. */
export function pageT2Table(shell) {
  const out = {};
  const re = /\{\s*key:\s*'([^']+)'[^}]*?t1:\s*'([^']*)'\s*,\s*t2:\s*'([^']*)'/g;
  for (let m = re.exec(shell); m; m = re.exec(shell)) out[m[1]] = m[2] === m[3] ? 1 : 3;
  return out;
}

export function build(ctx) {
  const { model, G } = ctx;

  const shellPath = resolve(ROOT, 'src/shell.html');
  let shell = null, shellErr = null;
  try { shell = readFileSync(shellPath, 'utf8'); } catch (err) { shellErr = err.message; }

  const K = P.CONSTANTS.skill;
  const V = model.constants.villainLattice || {};
  const PTS = V.v || [];
  const lobby = SK.lobbyV(model);
  const pools = SK.poolsAlong(model);
  const pairs = SK.legalPairs();

  return {
    sections: [

    // =========================================================================
    // I38 — the skill axis itself
    // =========================================================================
    { ids: ['I38'], label: 'skill: the lobby identity, the measured floor, and the reach of what is not built', run: () => {
    const bad = [];

    // -- (a) THE LOBBY ENDPOINT IS THE CURRENT MODEL, BY OBJECT IDENTITY ---------------------------
    // §7.2's first I38 clause, and it is the one the whole §0.4(a) identity constraint rests on. The
    // claim is not "the numbers agree at skill 0" — a deep-equal twin satisfies that and is still a
    // different object under `SOLVE_MEMO`, which is I43's own lesson stated with `assert.equal`.
    for (let v = 25; v <= 90; v += 0.5) {
      if (!Object.is(P.poolVpip(v, K.ref), v)) bad.push(`(a) poolVpip(${v}, ref) is not v itself`);
      if (!Object.is(P.poolVpip(v), v)) bad.push(`(a) poolVpip(${v}) with no dial is not v itself`);
      if (!Object.is(P.poolVpip(v, null), v)) bad.push(`(a) poolVpip(${v}, null) is not v itself`);
    }
    const q = V.discipline;
    const lobbyProfile = { on: true, v: lobby, q };
    const withZero = { on: true, v: lobby, q, skill: 0 };
    if (P.profiledModel(model, withZero) !== P.profiledModel(model, lobbyProfile)) {
      bad.push('(a) a skill-0 profile builds a DIFFERENT shadow from a profile with no skill field');
    }
    const pn = P.villainProfileOf(lobbyProfile, model);
    if (P.villainProfileOf(pn, model) !== pn) bad.push('(a) villainProfileOf is not idempotent — the dial can be applied twice');
    if (P.poolAt(model, null).model !== model) bad.push('(a) poolAt with no profile does not return the model itself');
    if (P.poolAt(model, { on: false, skill: 1 }).model !== model) {
      bad.push('(a) a full-skill dial with the profile OFF moved the model — the axis has leaked into the legacy lane');
    }
    if (P.poolAt(model, { on: false, skill: 1 }).v !== null) bad.push('(a) poolAt reports a VPIP with the profile off');
    // ...and the shadow's memo prefix must separate two MODELS, not just two profiles. `SOLVE_MEMO`
    // reads eight characters of `meta.hash`, and before P4 those eight came from `villainKey` alone
    // — the same eight for every model wearing that profile, so two models profiled at one (v, q) in
    // one process shared a memo entry. Found while arming I38's own records against a perturbed
    // model; the fix is in `profiledModelUncached` and this is the assertion on it.
    {
      const twin = { ...model, meta: { ...model.meta, hash: 'f'.repeat(64) } };
      Object.defineProperty(twin, '__hydrated', { value: true });
      const a = P.profiledModel(model, lobbyProfile), b = P.profiledModel(twin, lobbyProfile);
      if (a.meta.hash.slice(0, 8) === b.meta.hash.slice(0, 8)) {
        bad.push('(a) two different models profiled at the same (v, q) share a solve-memo prefix — '
          + 'the shadow hash does not carry the base model, so the second one is handed the first\'s answer');
      }
      if (a.meta.hash.slice(0, 8) === model.meta.hash.slice(0, 8)) bad.push('(a) the shadow wears the shipped hash prefix');
    }

    // -- (b) THE FLOOR IS THE MEASUREMENT'S OWN FLOOR ---------------------------------------------
    // §6's anchor for the fold-more half is "the measured v-lattice — no new opinion", and this is
    // what makes that an identity rather than a slogan: the dial's far end is `villainLattice.v[0]`,
    // the tightest pool any trial was ever run against, re-described in `CONSTANTS` so the transform
    // needs no model. If the lattice's floor ever moves and this constant does not, the dial starts
    // extrapolating and this fires.
    if (!PTS.length) bad.push('(b) the shipped model carries no villain lattice for the dial to be anchored on');
    else if (K.vFloor !== PTS[0]) {
      bad.push(`(b) skill.vFloor is ${K.vFloor} but the measured lattice starts at ${PTS[0]} — the dial reaches past the measurement`);
    }
    for (const v of [...PTS, 47.5, 32.5, 63, 88]) {
      if (v <= K.vFloor) continue;
      if (!Object.is(P.poolVpip(v, K.max), K.vFloor)) {
        bad.push(`(b) poolVpip(${v}, max) is ${P.poolVpip(v, K.max)}, not the floor constant itself`);
      }
      for (const s of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        const r = P.poolVpip(v, s);
        if (!(r >= K.vFloor && r <= v)) bad.push(`(b) poolVpip(${v}, ${s}) = ${r} leaves [floor, v]`);
      }
    }
    for (const v of [10, 20, K.vFloor]) {
      if (!Object.is(P.poolVpip(v, 1), v)) bad.push(`(b) poolVpip(${v}, 1) moved a pool already at or under the floor`);
    }
    for (const s of [0, 0.25, 0.5, 0.75, 1, -3, 4]) {
      const r = P.villainProfileOf({ on: true, v: 90, q, skill: s }, model).v;
      if (!(r >= PTS[0] && r <= PTS[PTS.length - 1])) bad.push(`(b) the dial at s=${s} resolves outside the lattice span: ${r}`);
    }

    // -- (c) THE DIAL IS A COORDINATE CHANGE ON VPIP, AND ADDS NO SECOND PATHWAY -------------------
    // The mechanised form of §6's "no new opinion". A pool at (v0, s) and a pool at (poolVpip(v0,s),
    // 0) are the same pool, so they must be the SAME OBJECT and their tiers must be the same objects
    // too — not equal ones. This is what makes it safe for `villainKey` to leave `skill` out of the
    // memo key, and it is what would fail the day somebody gives the dial a second consumer that
    // `poolAt` does not resolve.
    let coordChecks = 0;
    for (const v0 of [90, 70, 55, 40]) {
      for (const s of [0.25, 0.5, 0.75, 1]) {
        const vr = P.poolVpip(v0, s);
        const a = P.poolAt(model, { on: true, v: v0, q, skill: s });
        const b = P.poolAt(model, { on: true, v: vr, q });
        if (a.model !== b.model) bad.push(`(c) (v=${v0}, s=${s}) and (v=${vr}, s=0) build different shadows`);
        if (!Object.is(a.v, b.v)) bad.push(`(c) (v=${v0}, s=${s}) solves at ${a.v}, the hand-moved slider at ${b.v}`);
        for (const { pos, node } of pairs) {
          const sa = P.solve(a.model, { pos, node, v: a.v, limpers: 2, raiserPos: SK.SWEEP_RAISER });
          const sb = P.solve(b.model, { pos, node, v: b.v, limpers: 2, raiserPos: SK.SWEEP_RAISER });
          coordChecks++;
          if (sa !== sb) bad.push(`(c) ${pos}|${node} at (v=${v0}, s=${s}) is not the hand-moved slider's own answer`);
        }
      }
    }
    // ARMED. A dial with a second pathway — width resolved, equities not — must be visible here, or
    // the clause above is checking that two identical calls agree with each other.
    {
      const split = P.solve(P.poolAt(model, { on: true, v: 55, q }).model,
        { pos: 'BTN', node: 'rfi', v: P.poolVpip(55, 1) / 100, limpers: 2, raiserPos: SK.SWEEP_RAISER });
      const whole = P.solve(P.poolAt(model, { on: true, v: 55, q, skill: 1 }).model,
        { pos: 'BTN', node: 'rfi', v: P.poolVpip(55, 1) / 100, limpers: 2, raiserPos: SK.SWEEP_RAISER });
      if (split === whole) bad.push('(c) the arming case did not separate — a half-applied dial is indistinguishable here, so this clause proves nothing');
    }

    // -- (d) COMBO-WEIGHTED WIDTH TIGHTENS, WITH EVERY EXCEPTION ENUMERATED ------------------------
    // §7.2: "combo-weighted width tightens with skill; per-cell exceptions enumerated, never
    // tolerated away". The aggregate is the claim; the two frozen records in skill.mjs are the
    // exceptions, and they are compared in BOTH directions, so a vanished exception fails as loudly
    // as a new one. I21 answers the same granularity problem on the VPIP axis with a bounded dip
    // allowance; this row asks for enumeration instead, and an allowance is what you write when you
    // have not enumerated.
    const wt = SK.widthTable(model);
    for (const line of SK.widthProblems(model)) bad.push(`(d) ${line}`);

    // -- (e) THE PLAYS-BETTER COEFFICIENT REACHES EXACTLY NOTHING ----------------------------------
    // §6 says it "cannot be anchored today"; §3.4's Grade-C annotation says it is "not merely
    // unanchored but UNEXERCISED" and that this clause "is what keeps that honest". So the bound is
    // not on a coefficient's size — there is no coefficient — it is on its REACH, and the reach is
    // asserted at zero three ways: no number was invented, nothing reads the field, and the
    // realization the pipeline uses at every setting of the dial is bit-for-bit the realization the
    // dial-blind formula gives. The failure this is armed against is somebody wiring a realization
    // cut to the dial and picking a number because one was needed.
    if (!Object.is(K.playsBetter, null)) {
      bad.push(`(e) skill.playsBetter is ${JSON.stringify(K.playsBetter)} — a number was invented for a quantity `
        + 'nothing in this repository measures (V3-PLAN §6); it ships null or it ships anchored');
    }
    for (const [rel, allowed] of REACH_SCOPE) {
      let text;
      try { text = readFileSync(resolve(ROOT, rel), 'utf8'); } catch (err) { bad.push(`(e) ${rel} is unreadable: ${err.message}`); continue; }
      const n = (stripLiterals(text).match(/playsBetter/g) || []).length;
      if (n !== allowed) {
        bad.push(`(e) ${rel} reads playsBetter ${n} time(s) in code, ${allowed} allowed — the unexercised `
          + 'coefficient has acquired a consumer, and V3-PLAN §6 says it cannot have one unanchored');
      }
    }
    let rProbe = 0;
    for (const p of pools) {
      for (const { pos, node } of pairs) {
        if (node === '3bet') continue;              // the vs-3-bet node is not scored through `R`
        const out = P.solve(p.model, { pos, node, v: p.v, limpers: 2, raiserPos: SK.SWEEP_RAISER });
        for (const k of Object.keys(out.cells)) {
          const e = out.cells[k];
          if (e.R == null) continue;
          rProbe++;
          const want = P.realization(pos, out.N, p.model.cells[k].nu, P.CONSTANTS.depth.ref);
          if (!Object.is(e.R, want)) {
            bad.push(`(e) ${pos}|${node} ${k} at s=${p.s} realizes ${e.R} where the dial-blind formula `
              + `gives ${want} — the plays-better half has acquired a reach`);
          }
        }
      }
    }

    // -- (f) THE FLAG'S THREE LEGS ----------------------------------------------------------------
    // §6's "flagged" is "named in `constants`, labeled in the Method view, and bounded by a gate".
    // The P1 red team deleted `constants.sizing.flag` outright with everything green, which is why
    // I41(g)/I44(f) assert the first two legs from the outside; this is that idiom for `skill`.
    // THREE RECORDS SINCE P4's RED-TEAM STAGE, not two: the dial's DOMAIN joined them when three
    // refuters of three refuted "anchored by construction" (docs/refutations/P4.md). It is named
    // here as `min`/`ref`/`max` in the flag's own backtick convention, badged beside the other two,
    // and bounded by clause (g) below.
    if (typeof K.flag !== 'string' || K.flag.length < 60) {
      bad.push('(f) constants.skill.flag is missing or a stub — the admission that legitimises this block is not shipped');
    } else {
      for (const nm of ['playsBetter', 'blend', '`min`', '`ref`', '`max`']) {
        if (K.flag.indexOf(nm) < 0) bad.push(`(f) constants.skill.flag does not name ${nm}`);
      }
    }
    if (shell == null) bad.push(`(f) src/shell.html is unreadable, so the Method view's badge cannot be checked: ${shellErr}`);
    else {
      const map = /var UNANCHORED = \{([^}]*)\}/.exec(shell);
      if (!map) bad.push('(f) src/shell.html no longer carries the UNANCHORED badge map — every flagged constant would render unbadged');
      else for (const path of ['skill.playsBetter', 'skill.blend', 'skill.min', 'skill.ref', 'skill.max']) {
        if (map[1].indexOf(`'${path}'`) < 0) bad.push(`(f) ${path} is flagged but not badged in the Method view`);
      }
      // ...AND THE MAP IS READ WHERE THE CONSTANTS RENDER. A P4 refuter left the map intact and
      // deleted the BRANCH that consumes it in `constHTML`, and the badge left the Method view with
      // the skill family and 47 tests still green — the P1 failure (a flag deleted with everything
      // green) displaced one level, so the answer is I36(e)'s: assert the reader, not the table.
      if (!/UNANCHORED\[q\][^;]*tag-e[^;]*estimate/.test(shell)) {
        bad.push('(f) nothing in src/shell.html reads UNANCHORED where constants render — the badge map '
          + 'is a lookup table with no consumer, so every flagged constant renders like a measured one');
      }
    }

    // -- (g) THE DOMAIN IS FORCED BY THE BLEND AND THE FLOOR, AND NOW BOUNDED ----------------------
    // ADDED AT P4's RED-TEAM STAGE (docs/refutations/P4.md). `min`/`ref`/`max` shipped claiming to be
    // "anchored by construction" — by `poolVpip`'s two early returns — and three refuters of three
    // refuted it: `min` = -1 ships 60/60 gates, 632 tests and 2/2 variants current while resolving
    // the load default to VPIP 85, i.e. LOOSENING the pool onto the plays-better side §3.6's Grade C
    // does not build, and `wireVP` copies this constant straight onto the page's slider so a reader
    // can select it. `max` = 2 and `ref` = 0.05 shipped green as well, and the early returns turn out
    // to be removable with everything green, so they were never the anchor they were offered as.
    //
    // NO REPLACEMENT ANCHOR IS INVENTED HERE. The domain is FORCED, not chosen: the published blend
    // returns `v` only at s = 0 and the floor only at s = 1, so `ref` and `max` are pinned by the
    // blend and the measured floor between them, and `min` = `ref` because any lower setting moves a
    // pool UP an axis the dial only ever moves down. That is what this clause asserts — the forcing,
    // and then the three properties the domain exists to guarantee, swept at the PAGE's own slider
    // step rather than at a resolution chosen here, because the settings a reader can select are the
    // settings that need bounding. The triple still ships FLAGGED and badged: a bound is not an
    // anchor, and `max` = 1 is a unit convention normalised against a blend that is itself
    // unanchorable.
    const domainProbes = [...PTS, 47.5, 32.5, 63, 88, lobby].filter((v) => v != null);
    for (const v of domainProbes) {
      if (!Object.is(SK.blendValue(v, K.ref), v)) {
        bad.push(`(g) the published blend does not return the pool itself at ref=${K.ref} `
          + `(v=${v} gives ${SK.blendValue(v, K.ref)}) — the lobby setting is not the one the blend forces`);
      }
      if (!Object.is(SK.blendValue(v, K.max), K.vFloor)) {
        bad.push(`(g) the published blend does not reach the floor at max=${K.max} `
          + `(v=${v} gives ${SK.blendValue(v, K.max)}, floor ${K.vFloor}) — the far endpoint is a `
          + 'convention the blend does not force, so the early return is changing the function rather than protecting it');
      }
      if (!Object.is(P.poolVpip(v, K.min), v)) {
        bad.push(`(g) the dial's lower bound s=${K.min} does not resolve to the lobby at v=${v} `
          + `(${P.poolVpip(v, K.min)}) — either it loosens the pool or it puts the lobby out of reach`);
      }
    }
    // the page's own resolution, read back rather than typed — the I35 cap-list / I37(e) idiom
    let step = null;
    if (shell == null) bad.push('(g) src/shell.html is unreadable, so the dial cannot be swept at the page\'s own step');
    else {
      const m = /id="vpskill"[^>]*\sstep="([^"]+)"/.exec(shell);
      if (!m || !isFinite(+m[1]) || +m[1] <= 0) bad.push('(g) the page\'s skill slider publishes no usable step');
      else step = +m[1];
      if (!/\.min\s*=\s*SKILL\.min\s*;\s*[\w$]+\.max\s*=\s*SKILL\.max/.test(shell)) {
        bad.push('(g) the page\'s skill slider no longer takes its bounds from SKILL.min/SKILL.max — '
          + 'the domain this clause bounds is not the domain the reader is given');
      }
    }
    let swept = 0;
    if (step != null) {
      if (!(isFinite(K.min) && isFinite(K.max) && K.max > K.min)) {
        bad.push(`(g) the domain [${K.min}, ${K.max}] is not an interval the dial can be swept over`);
      } else {
        const n = Math.min(2000, Math.max(1, Math.round((K.max - K.min) / step)));
        const ds = (K.max - K.min) / n;
        for (const v of domainProbes) {
          if (v <= K.vFloor) continue;                 // nothing left to fold: `poolVpip` returns v
          let prev = P.poolVpip(v, K.min);
          for (let i = 0; i <= n; i++) {
            const s = Math.round((K.min + i * ds) / step) * step;
            const r = P.poolVpip(v, s);
            swept++;
            if (r > v + 1e-12) {
              bad.push(`(g) the dial LOOSENS at v=${v}, s=${s}: the pool resolves to ${r}, above the `
                + 'lobby it was set at — that is the plays-better side of the axis, which Grade C does not build');
            }
            if (s < K.max && !(r > K.vFloor)) {
              bad.push(`(g) the dial reaches the measured floor at s=${s}, before max=${K.max} `
                + `(v=${v} resolves to ${r}) — the settings past it are a dead zone the reader can still select`);
            }
            if (r > prev + 1e-12) {
              bad.push(`(g) the dial is not monotone at the page's own step: v=${v} goes ${prev} -> ${r} at s=${s}`);
            }
            prev = r;
          }
        }
      }
    }

    G('I38', bad.length === 0,
      `(a) the lobby endpoint is the model itself, by object identity — poolVpip(v, ref) is v over the `
      + `whole [25, 90] domain, a skill-0 profile builds the SAME shadow object as no skill field at all, `
      + `and a full-skill dial with the profile OFF leaves the model untouched (the axis cannot reach `
      + `I22's or I32's legacy lane, because its whole mechanism is the lattice). `
      + `(b) the floor is the MEASUREMENT's: skill.vFloor = ${K.vFloor} === villainLattice.v[0], the dial `
      + `returns it as the constant itself at s = max, and never leaves [${PTS[0]}, ${PTS[PTS.length - 1]}]. `
      + `(c) THE DIAL IS A COORDINATE CHANGE ON VPIP AND NOTHING ELSE, mechanised: over 16 (v0, s) pairs `
      + `× ${pairs.length} legal (pos, node) pairs, ${coordChecks} solves, the pool at (v0, s) and the pool `
      + `at (poolVpip(v0,s), 0) are the SAME shadow object and hand back the SAME solve object — which is `
      + `what §6's "no new opinion" means when it is asserted rather than said, and why villainKey leaves `
      + `skill out of the memo key. A half-applied dial separates (armed). `
      + `(d) combo-weighted width TIGHTENS along the dial: the aggregate over ${pairs.length} pairs runs `
      + `${wt.agg.map((x) => (100 * x).toFixed(2) + '%').join(' -> ')} at pool VPIP `
      + `${wt.pools.map((p) => p.vPct).join('/')}, monotone at every step. EVERY EXCEPTION IS ENUMERATED, `
      + `never allowed for: ${SK.WIDTH_ENDPOINT_EXCEPTIONS.length} pairs widen end to end and they are `
      + `exactly the six vs-3-Bet pairs, all through the same two cells `
      + `(${SK.WIDTH_ENDPOINT_CELLS.join(', ')}, ${SK.WIDTH_ENDPOINT_MOVE.from}->${SK.WIDTH_ENDPOINT_MOVE.to}) `
      + `— which is CALL to AMBUSH CALL, the same action on the baseline's scale, so what moved is a tier `
      + `label and not a hand; and ${SK.WIDTH_INTERIOR_EXCEPTIONS.length} (pair, step) interior rises, six `
      + `of them that same relabel and five of them the nut gate releasing as N falls. Both records are `
      + `compared in both directions. `
      + `(e) THE PLAYS-BETTER COEFFICIENT REACHES EXACTLY NOTHING, which is Grade C's own claim made `
      + `checkable: it ships null rather than a number nothing measures, ${REACH_SCOPE.length} files are `
      + `scanned comment- and literal-stripped and only policy.mjs's declaration may name it, and over `
      + `${rProbe} per-cell readings along the dial the realization the pipeline uses is bit-identical to `
      + `the dial-blind realization(pos, N, nu, d). `
      + `(f) the flag's three legs: constants.skill.flag names all THREE unanchored records — `
      + `playsBetter, blend and the domain — each carries the Method view's estimate badge, and the `
      + `badge map is read where the constants render (a P4 refuter deleted that branch with the map `
      + `intact and everything green). `
      + `(g) THE DOMAIN IS FORCED, AND SINCE P4's RED TEAM IT IS BOUNDED RATHER THAN ASSERTED TO BE `
      + `ANCHORED: the published blend returns the pool itself only at ref = ${K.ref} and the floor `
      + `only at max = ${K.max}, so those two are pinned by the blend and the measured floor between `
      + `them, and min = ${K.min} is pinned by the dial's own direction. Swept over ${swept} settings `
      + `at the PAGE's own slider step (${step == null ? '?' : step}, read back out of src/shell.html `
      + `with its SKILL.min/SKILL.max wiring), the dial never moves a pool UP, never reaches the floor `
      + `before max, and is monotone throughout — which is what min = -1 (the load default resolving `
      + `to VPIP 85, on the plays-better side Grade C does not build) shipped 60/60 green for want of.`
      + (bad.length ? ` — ${bad.length} problems, first: ${bad[0]}` : ''));
    } },

    // =========================================================================
    // I37 — divergence accounting along the dial
    // =========================================================================
    { ids: ['I37'], label: 'divergence: the blend, its endpoints, and convergence toward the equilibrium', run: () => {
    const bad = [];
    const notes = [];

    // -- (a) "≈ 0 AT pool = baseline" — NOT MEASURABLE, AND RECORDED AS SUCH -----------------------
    // The I15 / I36-nesting precedent: a clause scoped to what was measured, never toleranced into a
    // pass, and armed to FAIL the day its reason stops being true. See `reachReadiness` for the
    // measurement — the shipped baseline is HEADS-UP with the SB on the button and opens 88.85% of
    // combos, which is 33.85 points LOOSER than the lobby, so "pool = baseline" is a setting on the
    // loosen side of the axis and Grade C builds only the fold-more side.
    const reach = SK.reachReadiness(model);
    if (reach.measurable) {
      bad.push('(a) the baseline\'s entry frequency now lies inside the dial\'s reach, so §7.2\'s '
        + '"signed vs-GTO divergence combo-weighted ≈ 0 at pool = baseline" is MEASURABLE and is owed a '
        + `measurement rather than this note — ${reach.why}`);
    }

    // -- (b) THE INTERIOR BLEND IS THE SENTENCE THE PAGE PUBLISHES --------------------------------
    // I42(f)/I44(f)'s idiom: the P1 red team shipped a Method view publishing a formula the code does
    // not run, and every formula string in `constants` has been gated character-for-character since.
    // The endpoints are excluded on purpose — both early-return by design, and asserting the closed
    // form there would assert the arithmetic the early returns exist to avoid.
    if (K.blend !== SK.blendSpelling()) {
      bad.push(`(b) constants.skill.blend publishes "${K.blend}" but the code runs "${SK.blendSpelling()}"`);
    }
    // The reader's own resolution, read back out of the page rather than typed here — the same step
    // I38(g) sweeps the domain at, and the reason the shape check below is a bound on what a visitor
    // can actually select rather than on a grid this file chose.
    const stepM = shell == null ? null : /id="vpskill"[^>]*\sstep="([^"]+)"/.exec(shell);
    const bStep = stepM && isFinite(+stepM[1]) && +stepM[1] > 0 ? +stepM[1] : null;
    let shapeN = 0;
    for (const v of [90, 70, 55, 40]) {
      for (const s of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        if (!Object.is(P.poolVpip(v, s), SK.blendValue(v, s))) {
          bad.push(`(b) poolVpip(${v}, ${s}) = ${P.poolVpip(v, s)} is not what the published blend gives (${SK.blendValue(v, s)})`);
        }
      }
      // MONOTONE, AND — SINCE P4's RED-TEAM STAGE — THE SHAPE ITSELF, at the page's own resolution.
      // This clause used to walk 20 interior settings and assert monotonicity and the two endpoints.
      // Three refuters independently showed that is not a bound on the curve: published
      // self-consistently across `constants.skill.blend`, `blendSpelling()` and `blendValue()`,
      // `v + (s + 0.05*sin(4*pi*s))*(vFloor - v)` is monotone, exact at every setting this clause
      // sampled, and shipped 60/60 gates, 632 tests and 2/2 variants current while moving the
      // resolved pool by up to 2.3 VPIP points in between — at settings the 0.01 slider can select.
      // The character-exact spelling check above catches a page publishing a formula the code does
      // not run; it cannot catch a formula published truthfully and still curved. LINEAR IN s IS A
      // SECOND DIFFERENCE OF ZERO, so that is what is asserted now, at the step the page itself
      // publishes, with an IEEE guard rather than a tolerance: 1e-9 VPIP points is seven orders of
      // magnitude below the 0.15-point move one slider notch makes at the tightest probe here.
      if (bStep == null) bad.push('(b) the page publishes no slider step, so the blend cannot be walked at the reader\'s own resolution');
      else {
        const n = Math.max(2, Math.round((K.max - K.min) / bStep));
        const val = [];
        for (let i = 0; i <= n; i++) {
          const s = Math.min(K.max, K.min + i * bStep);
          const cur = P.poolVpip(v, s);
          if (i && cur > val[i - 1]) {
            bad.push(`(b) the blend is not monotone at v=${v}: s=${Math.min(K.max, K.min + (i - 1) * bStep)} gives ${val[i - 1]}, s=${s} gives ${cur}`);
          }
          val.push(cur);
          shapeN++;
        }
        for (let i = 1; i + 1 < val.length; i++) {
          const d2 = val[i - 1] - 2 * val[i] + val[i + 1];
          if (Math.abs(d2) > 1e-9) {
            bad.push(`(b) the blend is NOT LINEAR at v=${v}, s=${Math.min(K.max, K.min + i * bStep)}: the second `
              + `difference over three adjacent slider settings is ${d2}, not zero — the published spelling `
              + 'and the code agree with each other on a curve that is not the straight line the flag claims');
            break;
          }
        }
      }
      // The two endpoints, with LITERAL 0 and 1 rather than with K.ref and K.max — a P4 refuter's
      // recommendation, and the reason is that a constant cannot be asked to certify itself: read
      // through K.ref a moved lobby setting would move this assertion with it. Where the constants
      // ARE checked is I38(g), which derives them from the published blend instead.
      if (!Object.is(P.poolVpip(v, 0), v)) bad.push(`(b) the lobby endpoint is not reproduced exactly at v=${v}`);
      if (!Object.is(P.poolVpip(v, 1), K.vFloor)) bad.push(`(b) the lattice endpoint is not reproduced exactly at v=${v}`);
    }

    // -- (c) THE BADGE, EMITTED BY THE MACHINERY THAT ALREADY EXISTS -------------------------------
    // §6 asks the interior blend to be "badged `interpolated`". It already is: an interior setting
    // lands the pool off the measured lattice and `villainEq` labels every cell it reads there. The
    // detents land ON measured rows at the load default, so the two labels say opposite things about
    // the same dial, which is the whole point of having them.
    const probeCells = Object.keys(model.cells)
      .filter((k) => model.cells[k].combos && Array.isArray(model.cells[k].vDelta));
    if (!probeCells.length) bad.push('(c) no shipped cell carries a vDelta row, so the lattice badge cannot be read');
    let badged = 0;
    for (const p of pools) {
      const onLattice = PTS.indexOf(p.vPct) >= 0;
      const want = onLattice ? 'lattice' : 'interpolated';
      for (const key of probeCells) {
        const got = P.villainEq(model, key, model.cells[key], p.profile);
        badged++;
        if (got.source !== want) {
          bad.push(`(c) at s=${p.s} the pool is VPIP ${p.vPct} (${onLattice ? 'a measured lattice row' : 'off-lattice'}) `
            + `but ${key} is labelled '${got.source}', not '${want}'`);
        }
        if (got.exact !== onLattice) bad.push(`(c) at s=${p.s} ${key}'s exact flag disagrees with the lattice`);
      }
    }
    // ...and the DETENTS are forced by the lattice rather than chosen: at the load default the only
    // settings that land the pool on a measured row are the ones shipped, so an authored detent
    // fails here instead of quietly shipping a stop the accessor has to interpolate at.
    for (const d of K.detents) {
      if (PTS.indexOf(P.poolVpip(lobby, d)) < 0) {
        bad.push(`(c) detent s=${d} puts the load-default pool at VPIP ${P.poolVpip(lobby, d)}, which is not a measured lattice row`);
      }
    }

    // -- (d) PER-CELL CONVERGENCE TOWARD THE EQUILIBRIUM, AND THE PREDICTION ------------------------
    // §7.2's second I37 clause, with its own prediction attached: "the rank-overlap rows —
    // BROADWAY_RUN, RUN0_HIGH — violate monotone convergence and move most as the pool tightens, not
    // the junk rows". Measured at P4 it is CORROBORATED, and both halves are asserted: the violation
    // set is compared against the frozen record in both directions, and the two named rows must
    // still lead by violation rate with TRASH below them.
    const conv = SK.convergenceProblems(model);
    for (const line of conv.problems) bad.push(`(d) ${line}`);
    const t = conv.table;
    for (const nd of t.nodes) {
      const a = nd.signed.map(Math.abs);
      if (a[a.length - 1] > a[0]) {
        notes.push(`${nd.key} DIVERGES: ${nd.signed.map((x) => x.toFixed(4)).join(' -> ')}`);
      }
    }

    // -- (e) THE T2 READING IS THE PAGE'S, NOT A SECOND COPY OF IT --------------------------------
    // `skill.mjs`'s T2_AT is the page's own judgement precomputed, and a precomputed copy is a copy.
    // Read the page's table back and fail if they ever disagree — the grep-gate idiom I35's cap-list
    // clause runs on.
    if (shell == null) bad.push(`(e) src/shell.html is unreadable, so the T2 reading cannot be checked against the page: ${shellErr}`);
    else {
      const page = pageT2Table(shell);
      if (Object.keys(page).length !== P.NODES.length) {
        bad.push(`(e) src/shell.html's node table read back ${Object.keys(page).length} nodes, expected ${P.NODES.length}`);
      }
      for (const node of P.NODES) {
        if (page[node] !== SK.T2_AT[node]) {
          bad.push(`(e) at ${node} the page reads T2 as level ${page[node]} and skill.mjs as ${SK.T2_AT[node]} — `
            + 'the divergence measured here is not the divergence the surface paints');
        }
      }
    }

    G('I37', bad.length === 0,
      `(a) §7.2's "signed vs-GTO divergence combo-weighted ≈ 0 at pool = baseline" is NOT MEASURABLE on `
      + `this payload and is RECORDED rather than passed (the I15/I36-nesting precedent). ${reach.why}. `
      + `Underneath the arithmetic is a seat mismatch: the baseline's SB is the BUTTON and in position, `
      + `the model's SB is a six-max small blind out of position (baseR 0.90), so no setting of a pool `
      + `dial brings a 33.6% opening range onto an 88.9% one. The detector is armed on the shipped entry `
      + `frequency and FAILS the day it lands at or below the lobby ${reach.lobby}. `
      + `MEASURED BESIDE IT, because the clause being unmeasurable is not a reason to publish nothing: `
      + `the signed combo-weighted divergence along the dial is `
      + t.nodes.map((n) => `${n.key} ${n.signed.map((x) => x.toFixed(3)).join('/')}`).join(' · ')
      + ` at pool VPIP ${t.pools.map((p) => p.vPct).join('/')} — negative throughout (the model is TIGHTER `
      + `than the HU equilibrium everywhere) and, at two of the three nodes, GROWING as the pool tightens. `
      + `(b) the interior blend is the sentence the page publishes: constants.skill.blend = "${K.blend}" `
      + `recomputed against poolVpip at 5 interior settings x 4 lobby VPIPs, and — since P4's red team `
      + `shipped a monotone SINUSOIDAL dial that agreed with linear at every setting this clause used to `
      + `sample, 60/60 green, 2.3 VPIP points out in between — walked over ${shapeN} settings at the `
      + `page's own slider step ${bStep == null ? '?' : bStep} with the SECOND DIFFERENCE asserted at `
      + `zero (1e-9 pt IEEE guard, seven orders under one notch's 0.15-pt move): monotone throughout AND `
      + `linear, not merely monotone through the sampled points. Both anchored endpoints are reproduced `
      + `EXACTLY, read at LITERAL s=0 and s=1 rather than through the constants they pin (v itself at 0, `
      + `the lattice floor ${K.vFloor} at 1) — §7.2's monotone-interpolation clause, which is what bounds `
      + `the one constant here that cannot be anchored. `
      + `(c) the badge is the accessor's own, over ${badged} cell readings: at the ${K.detents.length} `
      + `detents the pool lands on measured lattice rows and every cell reads 'lattice'; at the interior `
      + `settings ${pools.filter((p) => PTS.indexOf(p.vPct) < 0).map((p) => p.vPct).join(' and ')} it is `
      + `off-lattice and every cell reads 'interpolated'. The detents are FORCED by the lattice rather `
      + `than chosen — from the load default only s in {${K.detents.join(', ')}} lands on a measured row. `
      + `(d) per-cell convergence toward the equilibrium: ${conv.found.length} of `
      + `${t.nodes.reduce((a, n) => a + n.cells.length, 0)} readings VIOLATE it, enumerated in `
      + `skill.mjs's record and compared in both directions. §7.2's PREDICTION IS CORROBORATED — the two `
      + `rank-overlap rows it names lead by violation rate `
      + `(${conv.ranked.slice(0, 2).map((r) => `${r} ${conv.rate[r].bad}/${conv.rate[r].n}`).join(', ')}), and the junk row `
      + `TRASH is ${conv.rate.TRASH ? `${conv.rate.TRASH.bad}/${conv.rate.TRASH.n}` : '0'}. `
      + `(e) the T2 reading is read back out of src/shell.html's own node table, so the divergence measured `
      + `here is the divergence the surface paints.`
      + (notes.length ? ` DIVERGENT NODES: ${notes.join(' · ')}.` : '')
      + (bad.length ? ` — ${bad.length} problems, first: ${bad[0]}` : ''));
    } },

    ],
  };
}
