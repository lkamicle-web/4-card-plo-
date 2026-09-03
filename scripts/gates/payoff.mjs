// gate I33 — the payoff interface freeze (V3-PLAN §2), AMENDED at the P2 pre-stage.
//
// Clauses (a)-(h) on scripts/lib/payoff.mjs, plus the separate monotonicity clause, which is no
// longer written to be falsified because it HAS BEEN falsified — see (mono) below.
//
// WHAT THE AMENDMENT CEREMONY CHANGED (V3-PLAN §2's `Amended (P2 pre-stage)` block, from §3.2's
// Measured block and spike S-B):
//   (a) the return is SIX keys, not four — `potMult` and `invShare` join it, appended, with the
//       checkdown identities `potMult === 1` and `invShare === 0` asserted as identities;
//   (c) gains the spr-0 pot geometry: at spr 0 no source may report a moved pot;
//   (g) NEW — `opts.ip` in every memo key, because S-B measured ev(A,B,ip) != ev(A,B,not ip) by up
//       to 43 pt and today's stub is position-inert, so no test of VALUES can catch a keyless memo;
//   (h) NEW — the card-removal clause: `supported:false`'s real domain is shared-rank degeneracy,
//       and its failure mode is silent;
//   (mono) REWRITTEN TO THE MEASUREMENT, per house style, never deleted and never widened.
//
// The whole v3 chain — CFR, the EV cut, the EV UI, the inspector — fans out against
// this signature, so the freeze is a gate rather than a docstring. Pure arithmetic over the
// shipped equity ladders: no Monte Carlo, which is why the largest gate in the repository is also
// one of the cheapest.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

import * as P from '../lib/policy.mjs';
import * as PO from '../lib/payoff.mjs';
import { ROOT } from './_shared.mjs';

export const family = 'payoff';
export const title = 'the V3-PLAN §2 payoff interface freeze — the unlock for every v3 chain';
export const ids = ['I33'];

// =================================================================================================
// THE DETECTORS, at module scope.
//
// (g), (h) and (mono) are exported rather than buried inside `build` for one reason: `test/
// payoff.test.mjs` arms THE SAME CODE THE GATE RUNS. A harness that re-implements a detector proves
// only that the harness's copy fires. The registry reads `family`, `title`, `ids` and `build`, so
// extra exports cost nothing.
// =================================================================================================

/**
 * Comments out, before any text clause looks at a file.
 *
 * Load-bearing, not hygiene: `scripts/lib/payoff.mjs`'s own header is a thousand words ABOUT memo
 * keys and contains "memo", "key", "ip" and "hash" in prose. Scanned raw it would clear (g) for
 * entirely the wrong reason — the file would look compliant because it DISCUSSES compliance. The
 * `[^:\\]` guard on the line-comment arm is so a `://` inside a URL is not read as a comment.
 * (The precedent is test/ui-payoff-mirror.test.mjs's own strip, one step stronger.)
 */
export function stripComments(text) {
  return String(text).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

/**
 * (g)'s file scope. DELIBERATELY NOT clause (e)'s `CONSUMER`: (e) demands the file IMPORT
 * payoff.mjs, which payoff.mjs itself can never do, and `payoff-model.mjs` is a producer rather
 * than a consumer. This is the memo scope — anything that could plausibly cache a payoff — and it
 * is written to cover P2's `cfr.mjs` and `payoff-model.mjs` and P4's EV cut before they exist.
 */
export const MEMO_SCOPE = /(payoff|cfr|solver|equilib|ev[-_]?cut)/i;

/** things that look like a cache being consulted or filled */
const MEMO_ANCHOR = /new\s+(?:Weak)?Map\s*\(|\bmemo\w*\b|\bcache\w*\b|\.\s*(?:has|get)\s*\(/gi;
/** ...and evidence that a KEY is being built near it, which is what makes it a memo and not a lookup */
const KEY_BUILD = /`[^`\n]*\$\{|\.join\s*\(|\+\s*['"][^'"\n]*['"]\s*\+|\bkey\s*=[^=]/;

/**
 * (g) THE MEMO CLAUSE. Every payoff memo key must carry `ip` and the model hash.
 *
 * The window is 600 characters forward and 400 back from the anchor — clause (f)'s idiom, widened
 * backwards because a key is usually BUILT above the `.has()` that consults it. A window only
 * counts as a memo if a key is being built in it; a bare `Map` of something else is not a payoff
 * cache and must not trip a payoff gate.
 *
 * WHAT THIS CANNOT SEE, stated rather than implied: a memo that CLONES its cached value evades the
 * companion identity probe below, and a file that merely mentions `ip` near a key evades this text
 * clause. Text is what is available while the stub is position-inert — the day a source is not
 * inert, the 43-point gap S-B measured is what a values test would finally have to work with.
 */
export function memoProblems(name, rawText) {
  const text = stripComments(rawText);
  const out = [];
  const reported = [];
  MEMO_ANCHOR.lastIndex = 0;
  for (let m = MEMO_ANCHOR.exec(text); m; m = MEMO_ANCHOR.exec(text)) {
    const w = text.slice(Math.max(0, m.index - 400), m.index + 600);
    if (!KEY_BUILD.test(w)) continue;
    const missing = [];
    if (!/\bip\b/.test(w)) missing.push('ip');
    if (!/hash/i.test(w)) missing.push('the model hash');
    if (!missing.length) continue;
    if (reported.some((i) => Math.abs(i - m.index) < 200)) continue;   // one memo, one report
    reported.push(m.index);
    out.push(`${name}: a payoff memo at offset ${m.index} builds a key without ${missing.join(' and ')}`
      + ` — S-B measured ev(A,B,ip) != ev(A,B,!ip) by up to 43 pt, so that key hands back the other`
      + ` position's answer, silently`);
  }
  return out;
}

/**
 * (g)'s companion, dynamic. A memo that forgot `ip` hands back THE SAME OBJECT for two requests
 * that differ only in position. Under the stub the two VALUES are equal, so object identity is the
 * only signal there is — which is exactly why this cannot be the whole clause and the text one is
 * load-bearing.
 */
export function ipMemoAliases(fn, cells, pot, spr) {
  return Object.is(fn(cells, pot, spr, { ip: false }), fn(cells, pot, spr, { ip: true }));
}

/**
 * (h) THE CARD-REMOVAL CLAUSE — which pairs are degenerate, structurally, from the cell keys.
 *
 * Two measured families, and no third invented one. `AA_*` x `AA_*`: the two cells pin all four
 * aces between them, so a large slice of (cell, cell, board) triples is impossible from the
 * observer's seat — S-B measured `AA_DANGLER|RB` x `AA_BIGPAIR|DS` degenerate on 12.56% of street
 * evaluations, mean 0.73% over 50 pairs, 4 of 50 over 1%. `AA_*` x `A_BLOCKED|*`: S-A independently
 * found 43 structurally UNDEALABLE pairs there, combo mass 3.6e-5.
 */
export function isDegeneratePair(a, b) {
  const fam = (k) => (typeof k === 'string' ? k.split('|')[0] : '');
  const aa = (f) => /^AA_/.test(f);
  const blocked = (f) => f === 'A_BLOCKED';
  const A = fam(a), B = fam(b);
  return (aa(A) && aa(B)) || (aa(A) && blocked(B)) || (blocked(A) && aa(B));
}

/**
 * (h) THE DETECTOR. Any source that evaluates against DEALT BOARDS must surface degeneracy
 * honestly: a degenerate or undealable request comes back `supported:false` — which is what
 * "flagged" MEANS in a six-key return that carries no degeneracy-mass field — never a silent
 * collapse to a checkdown answer wearing `supported:true`.
 *
 * `source:'checkdown'` is EXEMPT BY CONSTRUCTION and that exemption is the clause's own hinge: the
 * stub deals no cards at all, it reads shipped equity ladders, so there is no removal for it to get
 * wrong. The exemption is keyed on the shipped `source` datum, never on prose — the same rule I35's
 * Grade-C label runs on.
 *
 * THE DEGENERACY SCOPE LIVES HERE, not in the caller's list, and that is what makes the clause
 * assertable rather than a tautology: hand it any pairs at all and only the degenerate ones are held
 * to the rule. A detector that flagged whatever it was given would "fire" on a fabricated violator
 * for the trivial reason that it fires on everything, and the control arming below is exactly the
 * check that catches that mistake — it did, on the first run of this clause.
 */
export function removalProblems(fn, pairs) {
  const out = [];
  for (const [a, b] of pairs) {
    if (!isDegeneratePair(a, b)) continue;
    let r; try { r = fn([a, b], 10, 4, { ip: false }); } catch (e) { out.push(`${a} x ${b}: THREW ${e.message}`); continue; }
    if (r.source === 'checkdown') continue;
    if (r.supported) {
      out.push(`${a} x ${b}: source '${r.source}' deals boards and still answered a card-removal-`
        + `degenerate pair supported:true — S-B's first implementation collapsed every AA-vs-AA pair `
        + `to a checkdown with no error raised, which is what silent looks like`);
    }
  }
  return out;
}

/** (mono) one monotonicity sweep: hero's ev against a fixed villain, walking hero up the eq[0] ladder */
export function monoRows(fn, byEq, villain, sprs, ips = [false, true]) {
  const rows = [];
  for (const spr of sprs) {
    for (const ip of ips) {
      let inversions = 0, steps = 0, worst = 0, prev = -Infinity, source = null;
      for (const k of byEq) {
        const r = fn([k, villain], 10, spr, { ip });
        if (source === null) source = r.source;
        if (prev > -Infinity) { steps++; if (r.ev < prev) { inversions++; worst = Math.max(worst, prev - r.ev); } }
        prev = r.ev;
      }
      rows.push({ spr, ip, source, inversions, steps, worst });
    }
  }
  return rows;
}

/**
 * (mono) THE CLAUSE, REWRITTEN TO THE MEASUREMENT. §2 wrote "ev monotone in checkdown equity at
 * fixed spr" and predicted its own break; S-B broke it and measured how hard: inversions on 1.7% of
 * pairs at spr 1, 8.1% at spr 4, 15.9% IP / 20.5% OOP at spr 10, worst case 9.1 pt LESS checkdown
 * equity for 20.0 pt MORE ev. So the clause has two halves now, split by `source`:
 *
 *   checkdown            0 inversions, REQUIRED. The stub is affine in eq[0] — strictly increasing
 *                        in hero's checkdown equity — so this is true by construction and stays
 *                        asserted: it is what catches the stub silently ceasing to be the stub.
 *   any other source,    inversions > 0, REQUIRED. Realization is exactly what checkdown equity
 *   at spr >= 4          does not measure, so a source that claims to model it and reproduces a
 *                        perfect ordering is not modelling it. ZERO inversions is the new failure.
 *
 * spr >= 4 is §2's own pre-registered threshold, not a number chosen here, and it is already a
 * sweep point. NO UPPER BOUND IS ASSERTED: S-B's band is REPORTED in the detail line, because
 * asserting "inversions <= 20.5%" would invent a tolerance out of a single spike's 50 pairs. spr 1
 * is likewise reported and not asserted — 1.7% is too near zero to be a floor.
 */
export function monoProblems(fn, byEq, villain, sprs) {
  const out = [];
  for (const row of monoRows(fn, byEq, villain, sprs)) {
    if (row.source === 'checkdown') {
      if (row.inversions) {
        out.push(`(mono) 'checkdown' is strictly increasing in hero eq[0] BY CONSTRUCTION, and it `
          + `inverted ${row.inversions} of ${row.steps} steps at spr ${row.spr} ip=${row.ip} `
          + `(worst ${row.worst.toFixed(4)}) — the stub has stopped being the stub`);
      }
    } else if (row.spr >= 4 && row.inversions === 0) {
      out.push(`(mono) source '${row.source}' is perfectly monotone at spr ${row.spr} ip=${row.ip} `
        + `over ${row.steps} steps. S-B measured 8.1% of pairs inverting at spr 4 and 15.9% IP / `
        + `20.5% OOP at spr 10, worst 9.1 pt less checkdown equity for 20.0 pt more ev, so a source `
        + `claiming to model realization and reproducing the checkdown ORDER exactly is not `
        + `modelling realization`);
    }
  }
  return out;
}

export function build(ctx) {
  const { model, G } = ctx;

  return {
    sections: [
    { ids: ['I33'], label: 'the §2 contract as amended, clauses (a)-(h) + monotonicity', run: () => {
    // =======================================================================
    // I33 — the payoff interface freeze (V3-PLAN §2). The unlock, asserted.
    //
    // WHAT IS BEING FROZEN, AND WHY IT IS FROZEN BEFORE IT IS BUILT. Four whole workstreams — the
    // CFR engine, the EV presentation, the absolute-EV cut, the inspector — are about to fan out
    // against ONE signature, `payoff(cells, potSize, spr, opts) ->
    // {ev, se, source, supported, potMult, invShare}`,
    // while the thing behind it is still a checkdown stub. That is only safe if the SHAPE cannot
    // move underneath them, so §2 makes the shape a gate rather than a docstring: "the freeze is a
    // test, not a doc". Everything this gate asserts is cheap, deterministic arithmetic over the
    // shipped equity ladders — no Monte Carlo, no sampling, no clock.
    //
    // THE ONE PLACE THE STUB REFINES §2, RECORDED HERE RATHER THAN QUIETLY. §2 describes the stub
    // as "returns shipped eq[N] at every spr". Taken literally that cannot pass §2's OWN clause
    // (b): `eq` is measured against RANDOM opponents, so eq_A + eq_B is not 1 for almost any pair
    // and conservation fails nearly everywhere. The two clauses are jointly satisfiable only if
    // the stub conserves, so the heads-up stub returns the zero-sum PROJECTION of the same shipped
    // measurement — 0.5 + (eq_A[0] - eq_B[0])/200 — which uses only shipped numbers, introduces no
    // constant, and conserves to the last bit. Clause (b) below therefore asserts an identity
    // where §2 only asked for 1 +/- 2 se. The honesty is carried by `source:'checkdown'`, which is
    // what I35's Grade-C label keys off later — NOT by `supported`, which answers the different
    // question of whether the REQUEST was in the measured domain.
    //
    // FIVE CLAUSES ARE VACUOUS TODAY AND ARE ARMED ANYWAY. (c), (e), (f), (g) and (h) have nothing
    // to catch yet: no source but 'checkdown' exists, no consumer file exists, no memo exists
    // anywhere, and the page has no payoff call site. A clause that cannot fire is worth nothing, so
    // each runs its detector against a FABRICATED input and asserts that the detector fires — the
    // fabricated-payload idiom. That is what makes them armed rather than decorative, and it is why
    // the two clauses this amendment ADDS arrive armed on the day they are written.
    //
    // THE AMENDED RETURN. Six keys. `potMult` = E[final pot]/potSize and `invShare` = E[hero's
    // POST-node investment]/E[final pot] — S-B's own two quantities, the second with its REF3
    // normalisation (a symmetric 0.5/0.5 pre-node split, an assumption about the node rather than a
    // measurement of it) removed, because the four frozen arguments do not carry hero's share of
    // `potSize` and this file will not type one. Under checkdown both are IDENTITIES, asserted as
    // such below: no betting after the decision node means the final pot IS the pot at the node.
    const KEYS = ['ev', 'se', 'source', 'supported', 'potMult', 'invShare'];
    const bad = [];                            // clause failures, in clause order
    const eqOK = (k) => Array.isArray(model.cells[k].eq) && model.cells[k].eq.length > 0;
    const live = Object.keys(model.cells).filter(eqOK).sort();
    const nMax = live.length ? model.cells[live[0]].eq.length : 0;
    const F = PO.makePayoff(model);            // the pure route — the model is an argument here
    const eq0 = (k) => model.cells[k].eq[0];

    // The expected keys and the source enum are written out HERE rather than imported from the
    // module under test. A gate that reads its own expectation from its subject asserts nothing —
    // the same reason freeze-tiers.mjs, not verify.mjs, writes the tier fixtures.
    const SRC = ['checkdown', 'model', 'simulated'];
    if (!(Array.isArray(PO.SOURCES) && PO.SOURCES.length === SRC.length && SRC.every((s, i) => PO.SOURCES[i] === s))) {
      bad.push(`(a) the source enum is [${[...(PO.SOURCES || [])].join(',')}], not [${SRC.join(',')}] — `
        + `widening it is how an unmeasured payoff gets a respectable-looking label`);
    }
    const same = (a, b) => KEYS.every((x) => Object.is(a[x], b[x]));
    const shapeOf = (r) => Object.keys(r).slice().sort().join(',') === KEYS.slice().sort().join(',')
      && typeof r.ev === 'number' && typeof r.se === 'number'
      && typeof r.source === 'string' && SRC.includes(r.source)
      && typeof r.supported === 'boolean'
      && typeof r.potMult === 'number' && typeof r.invShare === 'number';
    /* the two new keys' RANGES are structural, not tolerances: the final pot contains the pot at
       the node (nobody takes chips back out) so potMult >= 1, and hero cannot invest more after the
       node than the whole final pot so invShare is in [0,1]. Neither bound is a number chosen here.
       THE CEILING IS THE P2 RED TEAM'S REPAIR, and it is the same kind of statement: with the pot
       at the node normalised to 1 and `spr` behind EACH player, the whole world contains
       `1 + 2*spr`, so a final pot above that is money that does not exist. Three refuters changed
       an estimator's `1 + 2*spr*w` to `1 + 2.5*`, `1 + 3*` and `1 + 100*spr*w` — a final pot fifty
       times both stacks — and every one of them shipped past all 53 gates and all 515 tests,
       because only the FLOOR was ever asserted. The sentence above this line existed; the clause
       did not. `spr` is passed in rather than read off the return because the bound is a statement
       about the REQUEST, and it is skipped for a request whose spr is not a depth at all — those
       paths are (a)'s out-of-domain business, and NaN <= anything is false for the wrong reason. */
    const potCeil = (spr) => (Number.isFinite(spr) && spr >= 0 ? 1 + 2 * spr : Infinity);
    const potOfOk = (r, spr) => Number.isFinite(r.potMult) && r.potMult >= 1
      && r.potMult <= potCeil(spr)
      && Number.isFinite(r.invShare) && r.invShare >= 0 && r.invShare <= 1;
    /* THE CHECKDOWN IDENTITIES. Not "approximately 1": exactly 1, by Object.is, because checkdown
       means no betting after the node and therefore E[F] = potSize with nothing invested after it.
       Pinning them as identities is what lets P2's first non-checkdown source be MEASURED against a
       baseline instead of against nobody's expectation. */
    const identityOf = (r) => r.source !== 'checkdown' || (Object.is(r.potMult, 1) && Object.is(r.invShare, 0));

    // -- (a) the freeze: arity, keys, types, range, determinism, and one named anchor ----------
    // The arity check is not pedantry: a `opts = {}` default parameter silently makes the function
    // report length 3, and a length-3 payoff is a payoff whose fourth argument someone forgot.
    const arity = PO.payoff.length === 4 && F.length === 4 && PO.makePayoff.length === 1;

    // every distinct code path through the accessor, named. (d) reuses this list.
    const A = live[0], B = live[live.length - 1], C = live[live.length >> 1];
    const ladder = (n) => Array.from({ length: n }, (_, i) => live[i % live.length]);
    const paths = [
      ['heads-up, ip on', [A, B], 10, 4, { ip: true }],
      ['heads-up, ip off', [A, B], 10, 4, { ip: false }],
      ['heads-up, opts absent', [A, B], 10, 4, undefined],
      ['heads-up, opts null', [A, B], 10, 4, null],
      ['heads-up, seeded', [A, B], 10, 4, { seed: 'rundown-v3' }],
      ['heads-up, spr 0', [A, B], 10, 0, {}],
      ['multiway 3', [A, B, C], 10, 4, {}],
      ['multiway at the end of the ladder', ladder(nMax + 1), 10, 4, {}],
      ['past the end of the ladder', ladder(nMax + 2), 10, 4, {}],
      ['unknown hero key', ['NOPE|XX', A], 10, 4, {}],
      ['unknown villain key', [A, 'NOPE|XX'], 10, 4, {}],
      ['a prototype key is an unknown key', ['__proto__', A], 10, 4, {}],
      ['constructor is an unknown key', ['constructor', A], 10, 4, {}],
      ['cells not an array', 'AA_BIGPAIR|DS', 10, 4, {}],
      ['cells null', null, 10, 4, {}],
      ['cells empty', [], 10, 4, {}],
      ['one cell is not a hand', [A], 10, 4, {}],
      ['a non-string cell key', [A, 7], 10, 4, {}],
      ['potSize 0', [A, B], 0, 4, {}],
      ['potSize negative', [A, B], -3, 4, {}],
      ['potSize NaN', [A, B], NaN, 4, {}],
      ['potSize infinite', [A, B], Infinity, 4, {}],
      ['potSize a string', [A, B], '10', 4, {}],
      ['spr negative', [A, B], 10, -1, {}],
      ['spr NaN', [A, B], 10, NaN, {}],
      ['spr infinite', [A, B], 10, Infinity, {}],
      ['opts not an object', [A, B], 10, 4, 7],
      ['opts an array', [A, B], 10, 4, []],
      ['a seed nobody can reproduce', [A, B], 10, 4, { seed: {} }],
      ['a NaN seed', [A, B], 10, 4, { seed: NaN }],
    ];
    let threw = 0, shapeBad = 0, rangeBad = 0, detBad = 0, returns = 0, potBad = 0, idBad = 0;
    for (const [why, cells, pot, spr, opts] of paths) {
      let r = null;
      try { r = F(cells, pot, spr, opts); } catch (e) { threw++; bad.push(`(a) "${why}" THREW: ${e.message}`); continue; }
      returns++;
      if (!shapeOf(r)) { shapeBad++; if (bad.length < 6) bad.push(`(a) "${why}" broke the return shape`); }
      if (!(Number.isFinite(r.ev) && r.ev >= 0 && r.ev <= 1)) {
        rangeBad++; if (bad.length < 6) bad.push(`(a) "${why}" returned ev ${r.ev}, outside [0,1] — a pot fraction is not a percentage`);
      }
      if (!potOfOk(r, spr)) {
        potBad++; if (bad.length < 6) bad.push(`(a) "${why}" returned potMult ${r.potMult} / invShare ${r.invShare}, outside the structural ranges [1, 1+2*spr] and [0,1] at spr ${spr}`);
      }
      if (!identityOf(r)) {
        idBad++; if (bad.length < 6) bad.push(`(a) "${why}" is source 'checkdown' but reports potMult ${r.potMult} / invShare ${r.invShare} — checkdown has no betting after the node, so the pot cannot have moved`);
      }
      // determinism, at both ip values: the same arguments must give the same object, twice.
      for (const ip of [false, true]) {
        const o = (opts && typeof opts === 'object' && !Array.isArray(opts)) ? { ...opts, ip } : opts;
        let x = null, y = null;
        try { x = F(cells, pot, spr, o); y = F(cells, pot, spr, o); } catch { detBad++; continue; }
        if (!same(x, y)) { detBad++; if (bad.length < 6) bad.push(`(a) "${why}" is not deterministic at ip=${ip}`); }
      }
    }
    // the named anchor: the heads-up return, recomputed straight from model.cells with no payoff
    // code in the middle. This is what pins the UNIT (percent vs fraction) and the INDEX (eq[0] is
    // one opponent, not two) at a point a human can read — the two easiest silent bugs in the file.
    const anchorPair = ['AA_BIGPAIR|DS', 'TRASH|RB'].every((k) => live.includes(k))
      ? ['AA_BIGPAIR|DS', 'TRASH|RB'] : [A, B];
    const anchorWant = (eq0(anchorPair[0]) + (100 - eq0(anchorPair[1]))) / 200;
    const anchorGot = F(anchorPair, 10, 4, { ip: false }).ev;
    const anchorOk = Math.abs(anchorGot - anchorWant) < 1e-15;
    if (!arity) bad.push(`(a) arity is ${PO.payoff.length}/${F.length}, not 4/4 — a default on \`opts\` is the usual cause`);
    if (!anchorOk) bad.push(`(a) the anchor ${anchorPair.join(' vs ')} returned ${anchorGot} where model.cells says ${anchorWant}`);

    /* ARMED, the amendment's own half. The six-key shape and the two identities have to be able to
       FAIL, and the two ways they realistically would are: a source that never grew the keys (the
       pre-amendment four-key return), and a source that reports a moved pot while still calling
       itself checkdown. The third fabrication is the control — a moved pot under a NON-checkdown
       source is not a violation, it is the whole point of P2, and a clause that flagged it would be
       a clause nobody could ship past. */
    const legacyFour = (c, pt, sp, o) => { const { potMult, invShare, ...rest } = F(c, pt, sp, o); return rest; };
    const movedCheckdown = (c, pt, sp, o) => ({ ...F(c, pt, sp, o), potMult: 1.6, invShare: 0.2 });
    const movedModel = (c, pt, sp, o) => ({ ...F(c, pt, sp, o), source: 'model', potMult: 1.6, invShare: 0.2 });
    /* the CEILING's own fabrication, and it is the P2 red team's exact perturbation rather than an
       invented one: a source whose pot geometry is `1 + 100*spr*w` instead of `1 + 2*spr*w`. It
       must fire at every spr the sweep uses, and the control — the same source at a LEGAL fraction
       of the same ceiling — must clear, or the clause is just rejecting large numbers. */
    const overflowPot = (sp) => ({ ...F([A, B], 10, sp, { ip: false }), source: 'model', potMult: 1 + 100 * sp * 0.5, invShare: 0.4 });
    const legalPot = (sp) => ({ ...F([A, B], 10, sp, { ip: false }), source: 'model', potMult: 1 + 2 * sp * 0.5, invShare: 0.4 });
    const probe = [A, B];
    const shapeFires = !shapeOf(legacyFour(probe, 10, 4, { ip: false }));
    const idFires = !identityOf(movedCheckdown(probe, 10, 4, { ip: false }));
    const idClears = identityOf(movedModel(probe, 10, 4, { ip: false })) && potOfOk(movedModel(probe, 10, 4, { ip: false }), 4);
    const ceilFires = [1, 4, 10].every((sp) => !potOfOk(overflowPot(sp), sp));
    const ceilClears = [1, 4, 10].every((sp) => potOfOk(legalPot(sp), sp));
    /* and the skip has to be a skip, not a hole: a request whose spr is not a depth is (a)'s
       out-of-domain business, and the ceiling must neither fire nor silently pass a bad pot there */
    const ceilSkips = potOfOk({ potMult: 1e6, invShare: 0.4 }, NaN) && !potOfOk({ potMult: 0.5, invShare: 0.4 }, NaN);
    if (!(shapeFires && idFires && idClears && ceilFires && ceilClears && ceilSkips)) {
      bad.push(`(a) the amendment is not armed: a four-key return rejected ${shapeFires}, a moved `
        + `checkdown pot rejected ${idFires}, a moved 'model' pot allowed ${idClears}, a pot above `
        + `1+2*spr rejected ${ceilFires}, a legal pot below it allowed ${ceilClears}, a non-depth `
        + `spr skipped without dropping the floor ${ceilSkips}`);
    }

    // -- (b) zero-sum conservation over EVERY ordered heads-up pair ----------------------------
    // §2 asks for ev(A,B) + ev(B,A) = 1 +/- 2 se over shared deals. Under the projection it is an
    // identity, so the measured worst deviation below is 0 and the 2-se band is reported only to
    // show how much room the clause is not using.
    let worstSum = 0, sumBad = 0, tightBand = Infinity, pairs = 0;
    let minSe = Infinity, maxSe = 0, infSe = 0;
    const conserveViolations = (fn, keys) => {
      let n = 0;
      for (let i = 0; i < keys.length; i++) {
        for (let j = 0; j < keys.length; j++) {
          if (i === j) continue;
          const ra = fn([keys[i], keys[j]], 10, 4, { ip: false });
          const rb = fn([keys[j], keys[i]], 10, 4, { ip: false });
          if (Math.abs(ra.ev + rb.ev - 1) > 2 * Math.hypot(ra.se, rb.se)) n++;
        }
      }
      return n;
    };
    for (let i = 0; i < live.length; i++) {
      for (let j = 0; j < live.length; j++) {
        if (i === j) continue;
        pairs++;
        const ra = F([live[i], live[j]], 10, 4, { ip: false });
        const rb = F([live[j], live[i]], 10, 4, { ip: false });
        const dev = Math.abs(ra.ev + rb.ev - 1);
        const band = 2 * Math.hypot(ra.se, rb.se);
        if (dev > band) { sumBad++; if (bad.length < 8) bad.push(`(b) ${live[i]} vs ${live[j]}: sum ${(ra.ev + rb.ev).toFixed(9)}, band ${band.toExponential(1)}`); }
        if (dev > worstSum) worstSum = dev;
        if (band < tightBand) tightBand = band;
        for (const r of [ra, rb]) {                       // (a)'s range and (d) ride along
          if (!(Number.isFinite(r.ev) && r.ev >= 0 && r.ev <= 1)) {
            rangeBad++; if (bad.length < 10) bad.push(`(a) ${live[i]} vs ${live[j]} returned ev ${r.ev}, outside [0,1]`);
          }
          /* the amended keys, over the WHOLE ordered heads-up sweep and not just the named paths:
             15,006 chances for the identities to be approximately-1 rather than 1 */
          if (!potOfOk(r, 4)) { potBad++; if (bad.length < 10) bad.push(`(a) ${live[i]} vs ${live[j]} returned potMult ${r.potMult} / invShare ${r.invShare}, outside the structural ranges — the ceiling at spr 4 is ${potCeil(4)}`); }
          if (!identityOf(r)) { idBad++; if (bad.length < 10) bad.push(`(a) ${live[i]} vs ${live[j]} is 'checkdown' with potMult ${r.potMult} / invShare ${r.invShare}`); }
          if (!(r.se > 0)) { if (bad.length < 10) bad.push(`(d) ${live[i]}/${live[j]} reported se ${r.se}`); }
          if (Number.isFinite(r.se)) { if (r.se < minSe) minSe = r.se; if (r.se > maxSe) maxSe = r.se; } else infSe++;
        }
      }
    }
    // ARMED: a fabricated payoff that puts a thumb on hero's side of the scale must fail (b). If
    // this does not fire, clause (b) is asserting nothing and the number above is decoration.
    const tilted = (cells, pot, spr, opts) => {
      const r = F(cells, pot, spr, opts);
      return { ...r, ev: Math.min(1, r.ev + 0.05) };
    };
    const demo = live.slice(0, 12);
    const tiltFires = conserveViolations(tilted, demo);
    const realQuiet = conserveViolations(F, demo);
    const demoPairs = demo.length * (demo.length - 1);
    if (sumBad) bad.push(`(b) conservation FAILS on ${sumBad} of ${pairs} ordered pairs`);
    if (tiltFires < demoPairs || realQuiet !== 0) {
      bad.push(`(b) the clause is not armed: a fabricated non-conserving payoff fired on only `
        + `${tiltFires}/${demoPairs} pairs (and the real one on ${realQuiet})`);
    }

    // -- (c) spr -> 0 identity ------------------------------------------------------------------
    // §2: "any non-stub source equals checkdown eq within MC error at spr = 0". Every source today
    // is 'checkdown', so the sweep below finds nothing to compare — and says so, rather than
    // passing quietly. Reported beside it, MEASURED AND NOT ASSERTED: the stub is spr-inert, which
    // is exactly what "a game where postflop does not exist" means. That inertness is deliberately
    // not a pass condition, because P2's real payoff is SUPPOSED to break it.
    /* AMENDED (P2 pre-stage): (c) also pins the POT GEOMETRY at spr 0, and for EVERY source, not
       only for non-stub ones. spr 0 is an empty effective stack — there is nothing left to bet — so
       the final pot is the pot at the node whoever is answering: potMult === 1 and invShare === 0,
       exactly. S-B verified the companion half independently (spr 0 reproduces checkdown equity
       with delta exactly 0). Zero constants: this is what an empty stack IS. */
    const SPRS = [0, 1, 4, 13];
    let nonStub = 0, nonStubBad = 0, sprMoved = 0, sprReturns = 0, spr0Bad = 0, spr0Seen = 0;
    for (let i = 0; i < live.length; i++) {
      for (let j = 0; j < live.length; j++) {
        if (i === j) continue;
        const base = F([live[i], live[j]], 10, 0, { ip: false });
        spr0Seen++;
        if (!(Object.is(base.potMult, 1) && Object.is(base.invShare, 0))) {
          spr0Bad++;
          if (bad.length < 12) bad.push(`(c) ${live[i]} vs ${live[j]} at spr 0 reports potMult ${base.potMult} / invShare ${base.invShare} — an empty effective stack cannot move the pot`);
        }
        if (base.source !== 'checkdown') {
          nonStub++;
          const want = eq0(live[i]) / 100;
          if (Math.abs(base.ev - want) > 2 * base.se) {
            nonStubBad++;
            if (bad.length < 12) bad.push(`(c) ${live[i]} vs ${live[j]} at spr 0: source ${base.source} gives ${base.ev}, checkdown says ${want}`);
          }
        }
        for (const spr of SPRS) {
          sprReturns++;
          const r = F([live[i], live[j]], 10, spr, { ip: false });
          if (!same(r, base)) sprMoved++;
          if (!(Number.isFinite(r.ev) && r.ev >= 0 && r.ev <= 1)) {
            rangeBad++; if (bad.length < 12) bad.push(`(a) ${live[i]} vs ${live[j]} at spr ${spr} returned ev ${r.ev}, outside [0,1]`);
          }
        }
      }
    }
    if (nonStubBad) bad.push(`(c) ${nonStubBad} of ${nonStub} non-checkdown returns disagree with checkdown eq at spr 0`);
    if (spr0Bad) bad.push(`(c) ${spr0Bad} of ${spr0Seen} spr-0 returns report a moved pot`);
    // ARMED: the spr-0 geometry is a real assertion, so a source that moves the pot at spr 0 — any
    // source, including a legitimately non-checkdown one — must be caught by it.
    const spr0Fires = !(Object.is(movedModel([A, B], 10, 0, { ip: false }).potMult, 1));
    const spr0Clears = Object.is(F([A, B], 10, 0, { ip: false }).potMult, 1)
      && Object.is(F([A, B], 10, 0, { ip: false }).invShare, 0);
    if (!(spr0Fires && spr0Clears)) {
      bad.push(`(c) the spr-0 geometry is not armed: fabricated moved pot caught ${spr0Fires}, real one cleared ${spr0Clears}`);
    }

    // -- (d) se > 0 on every path, including the fallbacks and the extremes ---------------------
    // The sweep above already covered every heads-up return. What is left is the malformed paths
    // and two fabricated models pinned at the ends of the range, where a naive sqrt(p(1-p)/n)
    // would report exactly 0 and claim certainty from a finite sample.
    const eqAll = (v) => {
      const cells = {};
      for (const k of Object.keys(model.cells)) {
        const c = model.cells[k];
        cells[k] = Array.isArray(c.eq) ? { ...c, eq: c.eq.map(() => v) } : c;
      }
      return PO.makePayoff({ ...model, cells });
    };
    let seBad = 0, seNamed = 0;
    for (const [why, cells, pot, spr, opts] of paths) {
      let r; try { r = F(cells, pot, spr, opts); } catch { continue; }
      seNamed++;
      if (!(r.se > 0)) { seBad++; if (bad.length < 14) bad.push(`(d) "${why}" reported se ${r.se}`); }
      if (Number.isFinite(r.se)) { if (r.se < minSe) minSe = r.se; if (r.se > maxSe) maxSe = r.se; } else infSe++;
    }
    for (const [label, f] of [['0%', eqAll(0)], ['100%', eqAll(100)]]) {
      for (const cells of [[A, B], [A, B, C]]) {
        const r = f(cells, 10, 4, { ip: false });
        seNamed++;
        if (!(r.se > 0 && Number.isFinite(r.se))) {
          seBad++; bad.push(`(d) a cell measured at ${label} reported se ${r.se} — the Laplace clamp is missing`);
        }
      }
    }
    if (seBad) bad.push(`(d) se was not positive on ${seBad} of ${seNamed} named paths`);

    // -- (e) the grep gate: payoff consumers go through the accessor ----------------------------
    // §2: "CFR, the EV cut and the UI consume payoffs ONLY through this accessor". Scope is by
    // FILENAME, deliberately: the legacy equity readers (policy.mjs, sim-kernel.js, shell.html,
    // this file) are not payoff consumers and must not trip a gate about payoffs. VERIFICATION CODE
    // is out of scope for the same reason, and by directory: `test/` (a future test/cfr.test.mjs
    // has every right to fabricate a payoff table) and `scripts/gates/` (the registry refactor is
    // about to land, and a gate file named solver.mjs asserting things about the solver is not a
    // solver consuming payoffs). The clause is about PRODUCT consumers. The UI is covered by clause
    // (f) instead, which is page-side and specific.
    const CONSUMER = /(cfr|solver|equilib|ev[-_]?cut)/i;
    const consumerProblems = (name, text) => {
      const p = [];
      if (!/from\s+['"][^'"]*payoff\.mjs['"]|\bPAYOFF\s*\./.test(text)) p.push(`${name} never imports payoff.mjs`);
      if (/\.eq\s*\[/.test(text) || /\bcells\s*\[[^\]\n]*\]\s*\.\s*eq\b/.test(text)) p.push(`${name} reads a payoff table directly`);
      return p;
    };
    const walk = (dir, out) => {
      let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
      for (const e of [...ents].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0))) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'gates' && e.name[0] !== '.') walk(p, out); }
        else if (/\.(mjs|js|html)$/.test(e.name)) out.push(p);
      }
      return out;
    };
    /* The detail line below reports the CONSUMER count and not the scanned-file count, on purpose:
       the gate-registry refactor is about to add ~46 files under scripts/gates/, and a gate whose
       output moves when an unrelated file appears cannot serve as that refactor's byte-identical
       baseline. What this clause is about is how many payoff consumers exist, which is 0. */
    const scanned = [...walk(resolve(ROOT, 'scripts'), []), ...walk(resolve(ROOT, 'src'), [])];
    const consumers = scanned.filter((p) => CONSUMER.test(p.slice(p.lastIndexOf('/') + 1)));
    for (const p of consumers) {
      let text = ''; try { text = readFileSync(p, 'utf8'); } catch { bad.push(`(e) ${relative(ROOT, p)} is unreadable`); continue; }
      for (const why of consumerProblems(relative(ROOT, p), text)) bad.push(`(e) ${why}`);
    }
    // ARMED, three ways: the detector must flag a violator, clear a compliant consumer, and — the
    // one that keeps this gate from becoming a nuisance — leave a legacy eq reader alone.
    const eFires = consumerProblems('cfr.mjs', 'const p = model.cells[k].eq[0] / 100;').length === 2;
    const eClears = consumerProblems('ev-cut.mjs',
      "import { payoff } from './payoff.mjs';\nconst { ev, supported } = payoff(cells, pot, spr, { ip });").length === 0;
    const eScoped = !CONSUMER.test('policy.mjs') && !CONSUMER.test('shell.html') && !CONSUMER.test('sim-kernel.js');
    if (!(eFires && eClears && eScoped)) {
      bad.push(`(e) the detector is not armed: violator flagged ${eFires}, compliant cleared ${eClears}, legacy readers out of scope ${eScoped}`);
    }
    /* The detail line said "vacuous today" unconditionally, which was true only while no consumer
       existed. P2's solver lane landed scripts/lib/cfr.mjs, so the clause now has a real subject and
       the sentence would otherwise contradict the count printed beside it. The ASSERTION above is
       untouched — this only makes the prose report which of the two states the clause is in. */
    const eVacuity = consumers.length === 0
      ? 'vacuous today and armed anyway'
      : `all ${consumers.length} import the accessor and none reads a payoff table directly, and armed besides`;

    // -- (f) page-side: no caller renders a supported:false ev without the badge ----------------
    // Read-only, and it reads the SOURCE shell, never the generated page: touching either would
    // put `build.mjs --check` out of date, and this gate is not allowed to cost that. The page has
    // the badge idiom already — `badge: 'unsupported'`, from the villain accessor's own
    // `supported:false` — so what the clause demands the day a payoff call site appears is that it
    // joins that path rather than inventing a second, quieter one.
    // The badge is required PER CALL SITE, inside a 600-character window, not merely somewhere in
    // the file. `badge` already appears twenty-odd times in the shell (the villain accessor's own
    // `supported:false` path), so a file-wide test would be satisfied by machinery that has nothing
    // to do with the payoff — a clause that passes for the wrong reason is worse than no clause.
    const badgeProblems = (text) => {
      const re = /\bpayoff\s*\(/g;
      const sites = [];
      for (let m = re.exec(text); m; m = re.exec(text)) sites.push(m.index);
      const problems = sites
        .filter((i) => { const w = text.slice(i, i + 600); return !(/supported/.test(w) && /badge/.test(w)); })
        .map((i) => `a payoff call site at offset ${i} has no supported -> badge path within 600 chars`);
      return { sites: sites.length, problems };
    };
    let shellText = null;
    try { shellText = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8'); } catch (e) { bad.push(`(f) src/shell.html unreadable: ${e.message}`); }
    const fShell = shellText === null ? { sites: -1, problems: [] } : badgeProblems(shellText);
    for (const why of fShell.problems) bad.push(`(f) src/shell.html: ${why}`);
    // ARMED: the detector must see a fabricated call site and must clear a fabricated badged one.
    const fFires = badgeProblems('const r = payoff(cells, pot, spr, {ip}); paint(r.ev);').problems.length === 1;
    const fClears = badgeProblems('const r = payoff(cells, pot, spr, {ip});\nif (!r.supported) t.badge = "unsupported";').problems.length === 0;
    if (!(fFires && fClears)) bad.push(`(f) the detector is not armed: call site seen ${fFires}, badged form cleared ${fClears}`);

    // -- (g) NEW (P2 pre-stage): `opts.ip` is in every memo key ---------------------------------
    // §2 froze the memo rule as "memoizable only with every argument in the key"; the amendment
    // NAMES the argument that will be dropped. S-B measured ev(A,B,ip) != ev(A,B,not ip) BY UP TO
    // 43 POINTS while ev(A,B,ip) + ev(B,A,not ip) = 1 holds exactly — so a memo missing `ip` is
    // wrong by more than the entire error budget (the Grade A edge is 2.5 pt), and it is wrong
    // SILENTLY. That is the `envKey` docstring's trap in a new place.
    //
    // Today payoff.mjs deliberately has no memo, so this clause is a contract clause with a
    // detector rather than a finding: scope is by FILENAME (clause (e)'s idiom) over its own
    // MEMO_SCOPE — payoff.mjs itself can never satisfy (e)'s "imports payoff.mjs", so it needs its
    // own scope — plus the page's mirrored @payoff-page block, named explicitly because the shell's
    // filename matches nothing. Comments are stripped first: payoff.mjs's header is a thousand
    // words ABOUT memo keys and would otherwise clear the clause by discussing it.
    const memoUnits = [];
    for (const f of scanned) {
      if (!MEMO_SCOPE.test(f.slice(f.lastIndexOf('/') + 1))) continue;
      let text = ''; try { text = readFileSync(f, 'utf8'); } catch { bad.push(`(g) ${relative(ROOT, f)} is unreadable`); continue; }
      memoUnits.push([relative(ROOT, f), text]);
    }
    if (shellText !== null) {
      const s0 = shellText.indexOf('/* @payoff-page');
      const s1 = shellText.indexOf('/* @end:payoff-page */');
      if (s0 < 0 || s1 <= s0) bad.push('(g) src/shell.html has lost its @payoff-page markers, so the page copy is out of scope by accident');
      else memoUnits.push(['src/shell.html @payoff-page', shellText.slice(s0, s1)]);
    }
    let memoBad = 0;
    for (const [name, text] of memoUnits) {
      for (const why of memoProblems(name, text)) { memoBad++; if (bad.length < 14) bad.push(`(g) ${why}`); }
    }
    // ARMED, four ways: the text detector must flag a keyless memo, clear a keyed one, and leave
    // policy.mjs (whose `envKey` solve memos are a DIFFERENT key rule) out of scope by filename;
    // and the dynamic probe must catch a keyless memo aliasing two positions onto one object.
    const gKeyless = 'const k = cells.join(\',\') + \'|\' + pot + \'|\' + spr;\n'
      + 'if (memo.has(k)) return memo.get(k);\nconst r = payoff(cells, pot, spr, opts); memo.set(k, r); return r;';
    const gKeyed = 'const k = cells.join(\',\') + \'|\' + pot + \'|\' + spr + \'|\' + (opts && opts.ip ? 1 : 0)\n'
      + '  + \'|\' + (opts && opts.seed) + \'|\' + PAY.modelHash;\n'
      + 'if (memo.has(k)) return memo.get(k);\nconst r = payoff(cells, pot, spr, opts); memo.set(k, r); return r;';
    const gFires = memoProblems('cfr.mjs', gKeyless).length === 1;
    const gClears = memoProblems('cfr.mjs', gKeyed).length === 0;
    const gScoped = !MEMO_SCOPE.test('policy.mjs') && !MEMO_SCOPE.test('taxonomy.mjs') && MEMO_SCOPE.test('payoff-model.mjs');
    /* the dynamic half: a keyless memoizing wrapper hands the SAME OBJECT back for ip on and off.
       Under the stub the two VALUES are identical, so identity is the only signal there is — and
       a memo that cloned its cached value would slip past this, which is why the text clause above
       is load-bearing rather than a belt on braces. */
    const keylessMemo = (() => {
      const m = new Map();
      return (cells, pot, spr, opts) => {
        const k = `${cells}|${pot}|${spr}`;
        if (!m.has(k)) m.set(k, F(cells, pot, spr, opts));
        return m.get(k);
      };
    })();
    const gProbeFires = ipMemoAliases(keylessMemo, [A, B], 10, 4);
    const gProbeClears = !ipMemoAliases(F, [A, B], 10, 4);
    if (!(gFires && gClears && gScoped && gProbeFires && gProbeClears)) {
      bad.push(`(g) the memo clause is not armed: keyless flagged ${gFires}, keyed cleared ${gClears}, `
        + `scope ${gScoped}, alias probe fired ${gProbeFires}, real accessor cleared ${gProbeClears}`);
    }

    // -- (h) NEW (P2 pre-stage): the card-removal clause on `supported:false` ---------------------
    // §2 wrote `supported:false` as the multiway door. S-B measured its REAL domain: shared-rank
    // degeneracy. Cells pinning the same ranks make some (cell, cell, board) triples impossible
    // from the observer's seat — AA_DANGLER|RB x AA_BIGPAIR|DS is degenerate on 12.56% of street
    // evaluations, mean 0.73% over 50 pairs, 4 of 50 over 1% — and S-A independently found 43
    // structurally UNDEALABLE pairs (AA_* x A_BLOCKED, combo mass 3.6e-5). The failure mode is
    // SILENT: S-B's first implementation dead-carded the range against the opponent's actual hand
    // and collapsed every AA-vs-AA pair to a checkdown with no error raised.
    //
    // The clause: any source that evaluates against DEALT BOARDS must surface degeneracy honestly —
    // `supported:false`, which is what "flagged" means in a six-key return with no mass field —
    // never a silent collapse. The stub deals nothing and is EXEMPT BY CONSTRUCTION, which is
    // asserted rather than assumed: it must answer these pairs `source:'checkdown'`.
    const degenerate = [];
    const control = [];
    for (const x of live) {
      for (const y of live) {
        if (x === y) continue;
        if (isDegeneratePair(x, y)) degenerate.push([x, y]);
        else if (control.length < 64) control.push([x, y]);
      }
    }
    let degenNotStub = 0;
    for (const [x, y] of degenerate) {
      if (F([x, y], 10, 4, { ip: false }).source !== 'checkdown') {
        degenNotStub++;
        if (bad.length < 16) bad.push(`(h) ${x} x ${y} is answered by a non-checkdown source, so the exemption no longer covers it`);
      }
    }
    /* the live check runs over the degenerate pairs AND the controls: the detector carries the
       degeneracy scope itself, so handing it both is what proves the scope is doing work. */
    for (const why of removalProblems(F, [...degenerate, ...control])) { if (bad.length < 16) bad.push(`(h) ${why}`); }
    // ARMED: `collapser` is the exact bug S-B hit — the checkdown answer relabelled as a dealt-board
    // source and still called supported. It must fire on every degenerate pair; the honest form,
    // identical but flagging them, must clear; and neither may fire on a non-degenerate control.
    const collapser = (c, pt, sp, o) => ({ ...F(c, pt, sp, o), source: 'simulated', supported: true });
    const honest = (c, pt, sp, o) => {
      const r = F(c, pt, sp, o);
      const degen = Array.isArray(c) && c.length === 2 && isDegeneratePair(c[0], c[1]);
      return { ...r, source: 'simulated', supported: !degen };
    };
    const hFires = removalProblems(collapser, degenerate).length === degenerate.length;
    const hClears = removalProblems(honest, degenerate).length === 0;
    const hControl = removalProblems(collapser, control).length === 0;
    const hFamilies = isDegeneratePair('AA_DANGLER|RB', 'AA_BIGPAIR|DS')
      && isDegeneratePair('AA_BIGPAIR|DS', 'A_BLOCKED|RB') && isDegeneratePair('A_BLOCKED|SSA', 'AA_DANGLER|DS')
      && !isDegeneratePair('TRASH|RB', 'RUN2|DS') && !isDegeneratePair('A_BLOCKED|RB', 'A_BLOCKED|SSA');
    if (!(hFires && hClears && hControl && hFamilies)) {
      bad.push(`(h) the card-removal clause is not armed: silent collapser caught on `
        + `${removalProblems(collapser, degenerate).length}/${degenerate.length} pairs (want all), `
        + `honest form cleared ${hClears}, controls quiet ${hControl}, families right ${hFamilies}`);
    }

    // -- (mono) THE CLAUSE §2 WROTE TO BE FALSIFIED, AND IT WAS -----------------------------------
    // §2: "ev monotone in checkdown equity at fixed spr", with the prediction that high-cooler hands
    // break it at spr >= 4. S-B broke it and measured how hard: inversions on 1.7% of pairs at
    // spr 1, 8.1% at spr 4, 15.9% IP / 20.5% OOP at spr 10; worst case 9.1 pt LESS checkdown equity
    // for 20.0 pt MORE ev (BROADWAY_RUN|RB x AA_DANGLER|RB against AA_DANGLER|RB x AA_SMALLPAIR|DS).
    // House style is to rewrite the clause to the measurement, never to delete it and never to widen
    // a tolerance — so it is now two assertions split by `source`, and the band is REPORTED:
    //
    //   'checkdown'   0 inversions, still REQUIRED. The stub is affine in eq[0] — strictly
    //                 increasing in hero's checkdown equity — so this is what catches the stub
    //                 quietly ceasing to be the stub.
    //   any other     inversions > 0 at spr >= 4, REQUIRED. Realization is exactly what checkdown
    //   source        equity does not measure; a source that claims to model it and reproduces the
    //                 checkdown ORDER perfectly is not modelling it. Zero is the new failure.
    //
    // NO UPPER BOUND. Asserting "at most 20.5%" would invent a tolerance from one spike's 50 pairs.
    // spr 1's 1.7% is reported and not asserted for the same reason — too near zero to be a floor.
    const byEq = [...live].sort((x, y) => (eq0(x) - eq0(y)) || (x < y ? -1 : 1));
    const monoVillain = live.includes('AA_BIGPAIR|RB') ? 'AA_BIGPAIR|RB' : B;
    const monoReal = monoRows(F, byEq, monoVillain, SPRS);
    const inversions = monoReal.reduce((n, r) => n + r.inversions, 0);
    const steps = monoReal.reduce((n, r) => n + r.steps, 0);
    for (const why of monoProblems(F, byEq, monoVillain, SPRS)) { if (bad.length < 18) bad.push(why); }
    /* ARMED, and this is the half the rewrite adds: the stub RELABELLED 'model' is monotone, which
       is now a FAILURE, and a fabricated 'model' that actually perturbs the order at spr >= 4 is
       what passing looks like. The perturbation is a deterministic per-key jolt, so the gate stays
       reproducible; its size is arbitrary because it is a fabrication, not a claim about poker. */
    const asModel = (c, pt, sp, o) => ({ ...F(c, pt, sp, o), source: 'model' });
    const jolt = (k) => { let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return ((h % 1000) / 1000 - 0.5) * 0.2; };
    const realizing = (c, pt, sp, o) => {
      const r = asModel(c, pt, sp, o);
      if (!(sp >= 4) || !Array.isArray(c)) return r;
      return { ...r, ev: Math.min(1, Math.max(0, r.ev + jolt(String(c[0])))) };
    };
    const monoFires = monoProblems(asModel, byEq, monoVillain, SPRS).length > 0;
    const monoClears = monoProblems(realizing, byEq, monoVillain, SPRS).length === 0;
    const monoStubHeld = monoProblems(F, byEq, monoVillain, SPRS).length === 0;
    if (!(monoFires && monoClears)) {
      bad.push(`(mono) the rewritten clause is not armed: a monotone 'model' source flagged `
        + `${monoFires}, an order-perturbing 'model' source cleared ${monoClears}`);
    }

    G('I33', bad.length === 0,
      `payoff interface frozen (V3-PLAN §2) on scripts/lib/payoff.mjs and AMENDED at the P2 `
      + `pre-stage (§2's Amended block, from §3.2's Measured block and spike S-B): the return is `
      + `SIX keys — potMult and invShare APPENDED — \`opts.ip\` is named in the memo rule, and `
      + `supported:false gains the card-removal clause. The stub is the ZERO-SUM `
      + `PROJECTION of the shipped checkdown measurement, 0.5 + (eqA[0] - eqB[0])/200 — §2's literal `
      + `"return shipped eq[N]" cannot pass §2's own clause (b), and this is the only form that uses `
      + `nothing but shipped numbers and still conserves. `
      + `(a) arity ${PO.payoff.length}, keys {${KEYS.join(',')}}, types and source enum hold on all `
      + `${paths.length} named paths (${threw} threw, ${shapeBad} broke shape), ev in [0,1] on all `
      + `${(returns + pairs * 2 + sprReturns).toLocaleString()} returns (${rangeBad} outside), `
      + `${detBad} determinism failures over ${paths.length * 2} double calls; the anchor `
      + `${anchorPair[0]} vs ${anchorPair[1]} = ${anchorGot.toFixed(6)} recomputed from model.cells, `
      + `which is what pins percent-vs-fraction and eq[0]-is-one-opponent. AMENDED (i): the caller `
      + `cannot do \`EVbb = ev*finalPot - invested\` from \`ev\` alone — S-B measured E[F]/potSize `
      + `at 1.603..11.865 and hero's share of E[F] at 0.199..0.730 over 300 points, so the pot term `
      + `is wrong by up to an order of magnitude — hence potMult = E[F]/potSize (>= 1 structurally) `
      + `and invShare = E[hero's POST-node investment]/E[F] (in [0,1]). THE STUB'S TWO IDENTITIES, `
      + `asserted by Object.is over the ${paths.length} named paths and all `
      + `${(pairs * 2).toLocaleString()} heads-up sweep returns: potMult === 1 and invShare === 0 at `
      + `every spr for source:'checkdown' (${potBad} out of range, ${idBad} identity breaks) — `
      + `checkdown means no betting after the node, so E[F] = potSize and hero invests nothing after `
      + `it. ZERO NEW CONSTANTS: 1 and 0 are what checkdown IS. FINDING, recorded not patched: S-B's `
      + `invShare is E[hero invested TOTAL]/E[F] and its total carries a PRE-node part that REF3 `
      + `supplies by normalisation (pot = 1, c0 = c1 = 0.5) rather than by measurement; the four `
      + `frozen arguments do not carry hero's share of potSize, so this interface returns the `
      + `post-node half and the caller owes \`invested = heroPre + invShare*finalPot\` with heroPre `
      + `its own — it built the node. Conversion back is exact: total = heroPre/finalPot + invShare. `
      + `Arity stays FOUR; \`opts\` is the door if a source ever needs heroPre. `
      + `THE CEILING, ADDED AT THE P2 RED TEAM (docs/refutations/P2.md): potMult <= 1 + 2*spr on `
      + `every path and every sweep return, because the node's pot plus both stacks is all the money `
      + `there is. Only the FLOOR was asserted before, so an estimator returning \`1 + 100*spr*w\` — `
      + `a final pot fifty times both stacks — shipped past all 53 gates and all 515 tests while the `
      + `sentence describing the bound sat three docstrings away. It is not a tolerance: 1 and 2 are `
      + `the game's, and the clause skips a request whose spr is not a depth because those are (a)'s `
      + `out-of-domain business. Armed: a four-key `
      + `return rejected ${shapeFires}, a moved checkdown pot rejected ${idFires}, a moved 'model' `
      + `pot allowed ${idClears}, a pot above 1+2*spr rejected at spr {1,4,10} ${ceilFires}, a legal `
      + `pot at half the same ceiling allowed ${ceilClears}, a non-depth spr skipped without `
      + `dropping the floor ${ceilSkips}. `
      + `(b) conservation over all ${pairs.toLocaleString()} ordered HU pairs: worst `
      + `|ev(A,B)+ev(B,A)-1| = ${worstSum.toExponential(1)} against a tightest 2-se band of `
      + `${tightBand.toExponential(1)} — §2 asks for 1 +/- 2 se and the projection delivers 1 exactly; `
      + `armed: a fabricated +0.05 payoff violates ${tiltFires}/${demoPairs} pairs where the real one `
      + `violates ${realQuiet}. `
      + `(c) spr->0 identity: ${pairs.toLocaleString()} returns swept at spr 0, ${nonStub} carry a `
      + `non-checkdown source, so the equity half has nothing to compare yet and says so instead of `
      + `passing quietly. AMENDED: the POT GEOMETRY half applies to every source — an empty `
      + `effective stack cannot move the pot, so potMult === 1 and invShare === 0 at spr 0 on all `
      + `${spr0Seen.toLocaleString()} returns (${spr0Bad} moved), armed against a fabricated `
      + `spr-0 pot mover (${spr0Fires}) and cleared on the real one (${spr0Clears}); S-B verified the `
      + `companion half independently (spr 0 reproduces checkdown with delta exactly 0). Measured `
      + `beside it and NOT asserted: the stub is spr-inert — ${sprMoved} of `
      + `${sprReturns.toLocaleString()} returns move across spr {${SPRS.join(',')}} — which is what a `
      + `game where postflop does not exist looks like, and exactly what P2 is meant to break. `
      + `(d) se > 0 on every path: ${seNamed} named paths plus ${(pairs * 2).toLocaleString()} sweep `
      + `returns, finite range ${minSe.toExponential(1)}..${maxSe.toExponential(1)} pot fractions `
      + `(the shipped basis: seOfTrials(${model.meta.trials.cell.toLocaleString()})/100 = `
      + `${(P.seOfTrials(model.meta.trials.cell) / 100).toExponential(1)} at p=0.5), and Infinity on `
      + `the ${infSe} no-hero fallbacks — n=0 trials, the shipped seOfTrials(0) convention, never a `
      + `typed number. `
      + `(e) grep: scripts/ and src/ walked by filename, ${consumers.length} files match `
      + `/cfr|solver|equilib|ev-cut/ — ${eVacuity}: the detector flags a `
      + `fabricated cfr.mjs reading .eq[ (${eFires}), clears a fabricated ev-cut.mjs going through `
      + `payoff.mjs (${eClears}), and leaves policy.mjs / shell.html / sim-kernel.js out of scope `
      + `(${eScoped}) so legacy equity readers cannot trip a payoff gate. `
      + `(f) page-side: src/shell.html carries ${fShell.sites} payoff call sites, so nothing can `
      + `render a supported:false ev unbadged; armed the same way (fabricated call site seen `
      + `${fFires}, fabricated badged form cleared ${fClears}), and the day a call site lands it must `
      + `join the page's existing badge:'unsupported' path. `
      + `(g) AMENDED (ii), THE MEMO KEY: every payoff memo key carries cells, potSize, spr, `
      + `opts.ip, opts.seed and modelHash — \`ip\` NAMED because it is the one that gets dropped. `
      + `S-B measured ev(A,B,ip) != ev(A,B,!ip) by up to 43 pt (while ev(A,B,ip) + ev(B,A,!ip) = 1 `
      + `holds exactly), so a keyless memo is wrong by more than the whole error budget — the Grade A `
      + `edge is 2.5 pt — and wrong silently: the envKey docstring's trap in a new place. `
      + `${memoUnits.length} units scanned COMMENT-STRIPPED FIRST (files under scripts/ and src/ `
      + `matching /payoff|cfr|solver|equilib|ev-cut/, plus src/shell.html's @payoff-page block by `
      + `name — the shell's filename matches nothing), ${memoBad} violations; payoff.mjs has no memo `
      + `today by design, so this is a contract clause with a detector. Armed four ways: a keyless `
      + `key flagged (${gFires}), a key carrying ip + seed + modelHash cleared (${gClears}), `
      + `policy.mjs's own envKey memos out of scope while payoff-model.mjs is in (${gScoped}), and a `
      + `DYNAMIC probe — a keyless memoizing wrapper hands the same OBJECT back for ip on and off `
      + `(${gProbeFires}) where the real accessor does not (${gProbeClears}). Stated rather than `
      + `implied: a memo that CLONES its cached value evades the probe, and under a position-inert `
      + `stub the two values are equal so no test of values can discriminate — the text clause is the `
      + `load-bearing one until a source makes those 43 points visible. `
      + `(h) AMENDED (iii), CARD REMOVAL: supported:false's real domain is shared-rank degeneracy, `
      + `not multiway. AA_DANGLER|RB x AA_BIGPAIR|DS is degenerate on 12.56% of street evaluations `
      + `(mean 0.73% over 50 pairs, 4/50 over 1%); S-A independently found 43 structurally undealable `
      + `pairs, AA_* x A_BLOCKED, combo mass 3.6e-5. Any source evaluating against DEALT BOARDS must `
      + `return supported:false on such a request — with no mass field in the six keys, that is what `
      + `"flagged" means — never a silent collapse to checkdown, which is precisely what S-B's first `
      + `implementation did with no error raised. ${degenerate.length} ordered degenerate pairs over `
      + `the ${live.length} live cells; the stub deals nothing and is EXEMPT BY CONSTRUCTION, checked `
      + `rather than assumed (${degenNotStub} answered by a non-checkdown source). Armed: a `
      + `fabricated collapser — the checkdown answer relabelled 'simulated', still supported — is `
      + `caught on every degenerate pair (${hFires}), the honest form flagging them clears `
      + `(${hClears}), neither fires on ${control.length} non-degenerate controls (${hControl}), and `
      + `the family predicate is right (${hFamilies}). `
      + `(mono) THE CLAUSE §2 WROTE TO BE FALSIFIED, AND IT WAS — REWRITTEN TO THE MEASUREMENT, not `
      + `deleted and not widened. S-B: inversions on 1.7% of pairs at spr 1, 8.1% at spr 4, 15.9% IP `
      + `/ 20.5% OOP at spr 10; worst case 9.1 pt LESS checkdown equity for 20.0 pt MORE ev. Two `
      + `assertions, split by source, over ${byEq.length} cells x spr {${SPRS.join(',')}} x ip `
      + `{off,on} against ${monoVillain}: 'checkdown' must show ZERO inversions — strictly increasing `
      + `in hero eq[0] by construction, and today ${inversions} of ${steps} steps (${monoStubHeld}) — `
      + `while ANY OTHER source at spr >= 4 must show inversions > 0, because realization is exactly `
      + `what checkdown equity does not measure and a source reproducing the checkdown order `
      + `perfectly is not modelling it. NO UPPER BOUND IS ASSERTED: S-B's band is reported here, `
      + `never as a tolerance, and spr 1's 1.7% is too near zero to be a floor. Armed: the stub `
      + `relabelled 'model' is monotone and is now FLAGGED (${monoFires}); a 'model' that perturbs `
      + `the order at spr >= 4 clears (${monoClears})`
      + (bad.length ? ` — FAILS: ${bad.slice(0, 6).join('; ')}${bad.length > 6 ? ` (+${bad.length - 6} more)` : ''}` : ''));
    } },
    ],
  };
}
