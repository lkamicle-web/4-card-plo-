// gate I46 — the calibration verdict, and the bar it was computed from.
//
// V3-PLAN §3.5, §5.4 and §7.2's I46 row. ONE GATE, SIX CLAUSES, AND THE WHOLE THING TURNS ON A
// DISTINCTION THAT IS EASY TO COLLAPSE AND FATAL TO COLLAPSE:
//
//   THE GATE IS GREEN.  THE VERDICT IS FAIL.  NEITHER SENTENCE WEAKENS THE OTHER.
//
// I46's claim (§7.2) is "harness reproducibility; fitted-vs-shipped disagreements ship as
// `calibration.disputed`, rendered in the Method view; the primacy verdict computed *only* from the
// Phase-0 pre-registered criteria". Not one of those three says the verdict must be 'pass'. What
// this gate asserts is that the answer on the page is the answer the pre-registered bar gives, that
// it was computed HERE rather than typed, and that every route to 'pass' is refused. On today's
// data the bar gives FAIL — S-C found no lawful, hero-visible, assigned 4-card PLO corpus exists at
// any volume, so PC-1/PC-2/PC-3 cannot be evaluated and PC-0 is failure-closed — so the gate passes
// while reporting a FAIL, as loudly as it would report a pass. That is the criteria's own REPORTING
// DUTY, and it is why `verify.mjs` can exit 0 with the decision layer still unfalsified.
//
// WHY IT IS LIVE AT ALL, since the P1 lane that built the harness argued it should not be. That
// argument (scripts/lib/calibration.mjs's header, kept there as the record) was a dichotomy: an
// honest I46 fails the build, a passable I46 is a lowered bar. The third form is this file. It
// exists because V3-PLAN §11 refuses to close a phase whose shipped feature has no gate id in
// `verify.mjs`'s output, and `model.calibration` is now shipped: stamped by the runner, budgeted by
// D6, rendered by the Method view, and read by `P.evPrimary`. A shipped artifact bounded only by
// `node --test` is the state §11 names. Inventing a second id was never available — §7.2 names one.
//
// WHAT WOULD MAKE THIS GATE DISHONEST, so the reader can check for it. Any of:
//   * a clause that reads `verdict === 'pass'` as the thing to assert (it reads LAWFULNESS instead:
//     'pass' iff every criterion passed AND a corpus was present — clause (d), armed);
//   * the criteria text edited to something today's data can clear (clause (c) byte-compares the
//     shipped copy against I46_CRITERIA, whose own digest is pinned and which test/gates-reserved
//     byte-compares against docs/spikes/S-C.md — three copies, no two of which can move together);
//   * the self-play consistency figure re-labelled as a money result (clause (f) feeds it to the
//     verdict machine and requires PC-4 to refuse it BY NAME);
//   * an empty `disputed` list read as "everything agreed" (clause (e) requires the reason).
//
// COST. One block rebuild (~12 ms: two orderings, a 20,000-hand self-play stream, a 987-pair PC-8
// scan), one harness self-check (~10 ms), one shell read. Well under a second.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as P from '../lib/policy.mjs';
import {
  buildCalibrationBlock, harnessSelfCheck, evaluatePrimacy, canonicalJson, digest,
  CRITERIA_DIGEST, I46_CRITERIA, PC_IDS, PC4_UNIT,
} from '../lib/calibration.mjs';
import { CATALOG } from './reserved.mjs';
import { stripComments } from './payoff.mjs';
import { ROOT } from './_shared.mjs';

export const family = 'calibration';
export const title = 'the primacy verdict (I46), computed only from the Phase-0 pre-registered bar';
export const ids = ['I46'];
export const setupLabel = 'rebuild model.calibration and run the harness self-check';

/** the seven checks `harnessSelfCheck` runs; named here so a check that stops running is visible */
const SELF_CHECKS = ['parse-twice', 'parse-chunked', 'aggregate-twice', 'selfplay-twice',
  'selfplay-seeded', 'paired-exact', 'z95-inverts'];

/**
 * The fields the Method view must actually render, comment-stripped-grepped out of the shell.
 *
 * I47(d)'s idiom, and the same reason: a block that ships and does not render is a limitation that
 * lives in a document, which is precisely what §3.5 says P5 must stop doing ("stored as shipped
 * data and rendered by the Method view so the reason is *on screen* rather than in a doc").
 * `disputedReason` is on the list because an empty `disputed` table with no sentence beside it
 * reads as "nothing disagreed" — the ambiguity buildCalibrationBlock's own comment warns about.
 */
const RENDERED = ['MODEL.calibration', '.evaluated', '.disputed', '.disputedReason', '.limitation',
  '.successor', 'moneyValidated'];

/**
 * PC-0, AS A PREDICATE, WRITTEN ONCE AND USED TWICE.
 *
 * "model.calibration.verdict may be stamped 'pass' only if PC-1..8 all hold simultaneously on one
 * corpus declared before any EV number is computed. A criterion that cannot be evaluated counts as
 * FAIL. No 'not applicable', no partial credit."
 *
 * The clause that checks the shipped block and the clause that ARMS itself against a fabricated one
 * call this same function, which is the point: an arming test that exercises a different predicate
 * from the one in force proves nothing about the one in force.
 */
export function lawfulVerdict(block) {
  const ev = Array.isArray(block?.evaluated) ? block.evaluated : null;
  const allPass = !!ev && ev.length === PC_IDS.length && ev.every((c) => c.status === 'pass');
  const corpus = !!(block?.corpus && block.corpus.present);
  const want = allPass && corpus ? 'pass' : 'fail';
  return { want, ok: block?.verdict === want, allPass, corpus };
}

export function build(ctx) {
  const { model } = ctx;

  const entry = CATALOG.find((e) => e.id === 'I46');
  const shipped = model.calibration || null;

  // THE REBUILD. Same function, same (absent) options, run inside the gate — so clause (b) can say
  // the verdict on the page was produced by this call rather than by a hand that typed it.
  const rebuilt = buildCalibrationBlock(model);
  const self = harnessSelfCheck(model);
  // A memo warmed by the rebuild's orderings must not be handed to a later gate that asked for a
  // cold one (I34(a)'s references, I47(b)'s interleave). `stampCalibration` clears it too; this is
  // the second half of the same discipline, because the gate re-runs the same work.
  P.clearSolveMemo();

  let shellSrc = null, shellErr = null;
  try { shellSrc = stripComments(readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8')); }
  catch (err) { shellErr = err.message; }

  return {
    sections: [

    { ids: ['I46'], label: 'the primacy verdict, and every route to \'pass\'', run: () => {
    const bad = [];

    if (!shipped) {
      ctx.G('I46', false, 'model.calibration is not stamped. V3-PLAN §3.5 requires the verdict to '
        + 'ship as data and render in the Method view whatever it is; scripts/verify.mjs stamps it '
        + 'via stampCalibration() immediately after stampConstants(). An unstamped model cannot be '
        + 'checked against the bar, and an unchecked verdict is the failure this gate exists for.');
      return;
    }

    // -- (a) HARNESS REPRODUCIBILITY — §7.2's clause (1) -------------------------------------------
    // Not "the harness agrees with itself": each of the seven is a specific way a pipeline like this
    // stops being reproducible (a parser with state, a parser sensitive to how the corpus was split
    // into files, an aggregator leaking bucket order, a stream that ignores its seed). The last one
    // is the one that matters most, because without it every future "two independent runs agree"
    // claim is empty.
    if (!self.ok) {
      for (const k of self.checks) if (!k.ok) bad.push(`(a) harness self-check ${k.name} failed: ${k.detail}`);
    }
    const ranChecks = self.checks.map((k) => k.name);
    if (ranChecks.join(' ') !== SELF_CHECKS.join(' ')) {
      bad.push(`(a) the self-check ran [${ranChecks.join(' ')}], not the seven checks it claims `
        + `[${SELF_CHECKS.join(' ')}] — a check that stops running cannot report its own absence`);
    }
    if (self.criteriaDigest !== CRITERIA_DIGEST) bad.push('(a) the self-check judged a different bar');

    // -- (b) THE SHIPPED VERDICT WAS COMPUTED HERE -------------------------------------------------
    // The block is rebuilt from the same model with the same (absent) options and digest-compared
    // field by field. A typed verdict, a stale block left over from an earlier model, or a stamp
    // that quietly took different options all fail here — and this is also the hash-churn tripwire:
    // verify stamps, build embeds, verify re-runs, and if the two runs disagreed the artifact and
    // the file would be describing different verdicts.
    const CMP = ['verdict', 'evaluated', 'unevaluable', 'pc8', 'selfPlay', 'disputed',
      'disputedReason', 'corpus', 'statistic', 'halves', 'criteriaDigest', 'limitation', 'successor'];
    for (const k of CMP) {
      if (digest(canonicalJson(shipped[k] ?? null)) !== digest(canonicalJson(rebuilt[k] ?? null))) {
        bad.push(`(b) model.calibration.${k} is not what buildCalibrationBlock produces on this model`);
      }
    }
    const wholeMatch = canonicalJson(shipped) === canonicalJson(rebuilt);
    if (!wholeMatch) bad.push('(b) the shipped block is not a re-derivation of itself');

    // -- (c) THE BAR IS THE PRE-REGISTERED BAR -----------------------------------------------------
    // Byte-equal text AND equal digest, because either alone is weaker than it looks: a digest with
    // no text is unauditable on the page, and text with no digest cannot be compared to the record.
    // The third copy — docs/spikes/S-C.md — is byte-compared in test/gates-reserved.test.mjs, so no
    // two of the three can be edited together by one hand.
    if (shipped.criteria !== I46_CRITERIA) {
      bad.push('(c) the shipped criteria text is not I46_CRITERIA — the bar on the page is not the bar');
    }
    if (shipped.criteriaDigest !== CRITERIA_DIGEST) {
      bad.push(`(c) the shipped criteria digest ${shipped.criteriaDigest} is not ${CRITERIA_DIGEST}`);
    }
    if (digest(I46_CRITERIA) !== CRITERIA_DIGEST) bad.push('(c) CRITERIA_DIGEST is not the digest of the criteria');
    for (let i = 0; i <= 8; i++) {
      if (!shipped.criteria.includes(`PC-${i}`)) bad.push(`(c) PC-${i} is missing from the shipped bar`);
    }
    if (!/A criterion\s+that cannot be evaluated counts as FAIL/.test(shipped.criteria)) {
      bad.push('(c) the shipped bar no longer states PC-0\'s failure-closed rule');
    }

    // -- (d) FAILURE-CLOSED, AND ARMED -------------------------------------------------------------
    // The clause is `lawfulVerdict`, not `verdict === 'fail'`: what has to hold is that the verdict
    // AGREES WITH THE BAR, so this same gate stays correct on the day a conforming corpus exists and
    // the answer legitimately becomes 'pass'. Today the bar says FAIL and the block says FAIL.
    const law = lawfulVerdict(shipped);
    if (!law.ok) bad.push(`(d) the shipped verdict ${JSON.stringify(shipped.verdict)} is not what PC-0 gives (${law.want})`);
    if (shipped.verdict !== 'fail') {
      bad.push(`(d) the verdict is ${JSON.stringify(shipped.verdict)}. S-C's finding has not changed: `
        + 'no lawful, hero-visible, assigned corpus exists, so PC-1/2/3 cannot be evaluated');
    }
    if (shipped.corpus.present !== false) bad.push('(d) a corpus is claimed; PC-2 admits none today');
    for (const id of entry.blockedBy) {
      if (!shipped.unevaluable.includes(id)) {
        bad.push(`(d) ${id} is recorded in the catalog as unsatisfiable but the block did not report it unevaluable`);
      }
    }
    if (P.evPrimary(model) !== false) bad.push('(d) evPrimary is true on the shipped model — EV is cutting tiers');
    /* THE ARMING. A gate whose predicate has never been shown to refuse anything is a gate nobody
       has tested. Three fabrications, none of which is ever written to disk: the shipped block with
       its verdict flipped to 'pass' (the post-hoc stamp); a block whose criteria all pass but which
       names no corpus (the "we checked everything we could" evasion PC-0's second sentence exists
       to refuse); and one criterion left `unevaluable` among passes (PC-0's "no partial credit"). */
    const passAll = PC_IDS.map((id) => ({ id, status: 'pass', detail: 'FABRICATED BY GATE I46' }));
    const ARMS = [
      ['the shipped block re-stamped pass', { ...shipped, verdict: 'pass' }],
      ['all criteria pass with no corpus', { evaluated: passAll, corpus: { present: false }, verdict: 'pass' }],
      ['one criterion unevaluable among passes', {
        evaluated: passAll.map((c, i) => (i === 2 ? { ...c, status: 'unevaluable' } : c)),
        corpus: { present: true }, verdict: 'pass' }],
      ['no evaluation at all', { evaluated: null, corpus: { present: true }, verdict: 'pass' }],
    ];
    for (const [what, fake] of ARMS) {
      if (lawfulVerdict(fake).ok) bad.push(`(d) the failure-closed rule ACCEPTS a fabricated block: ${what}`);
    }
    // ...and the control: the rule must still be able to say 'pass', or it is not a rule, it is a
    // constant. A block with every criterion passing on a present corpus is lawful at 'pass'.
    if (!lawfulVerdict({ evaluated: passAll, corpus: { present: true }, verdict: 'pass' }).ok) {
      bad.push('(d) the failure-closed rule cannot return pass at all — it is a constant, not a bar');
    }

    // -- (e) `disputed`, AND THE METHOD VIEW ------------------------------------------------------
    // §7.2: "fitted-vs-shipped disagreements ship as calibration.disputed, rendered in the Method
    // view". The list is EMPTY today because no fit was run — PC-2 admits no corpus to fit against —
    // and that is a different fact from "everything agreed", so the reason is required beside it.
    if (!Array.isArray(shipped.disputed)) bad.push('(e) calibration.disputed is not a list');
    else if (shipped.disputed.length === 0) {
      if (!shipped.disputedReason) {
        bad.push('(e) disputed is empty and says nothing about why — an empty table reads as agreement');
      }
    } else {
      for (const d of shipped.disputed) {
        if (!d || typeof d.name !== 'string' || !('shipped' in d) || !('fitted' in d)) {
          bad.push(`(e) a disputed entry does not name what disagreed with what: ${JSON.stringify(d)}`);
        }
      }
      if (shipped.disputedReason) bad.push('(e) disputed is non-empty and still carries the no-fit reason');
    }
    if (shellErr) bad.push(`(e) src/shell.html could not be read: ${shellErr}`);
    else {
      for (const token of RENDERED) {
        if (!shellSrc.includes(token)) {
          bad.push(`(e) the Method view never reads ${token} — the block ships and does not render`);
        }
      }
      // the limitation sentence itself, on the page, in the block's own words rather than a paraphrase
      if (!shellSrc.includes('MODEL.calibration.limitation')) {
        bad.push('(e) limitation 18 is not rendered FROM the shipped block — a retyped sentence goes stale');
      }
    }

    // -- (f) THE SELF-PLAY FIGURE IS NOT A RESULT --------------------------------------------------
    // The one way this limitation could quietly stop being true is a number that looks like a
    // result. So the block's own figure is fed to the verdict machine and PC-4 must refuse it BY
    // NAME — not by the corpus being absent, which would refuse it for the wrong reason.
    const sp = shipped.selfPlay;
    if (!sp) bad.push('(f) no self-play consistency figure ships at all');
    else {
      if (sp.unit !== 'potFrac') bad.push(`(f) the self-play unit is ${JSON.stringify(sp.unit)}, not potFrac`);
      if (sp.unit === PC4_UNIT) bad.push('(f) the self-play figure is labelled as PC-4\'s money statistic');
      if (sp.moneyValidated !== false) bad.push('(f) the self-play figure claims to be money-validated');
      const asStat = { unit: sp.unit, D: sp.D, se: sp.se, paired: true, mass: sp.disagreementMass };
      const laundered = evaluatePrimacy({ model, statistic: asStat });
      const pc4 = laundered.criteria.find((c) => c.id === 'PC-4');
      if (!pc4 || pc4.status !== 'fail') {
        bad.push(`(f) feeding the self-play figure to the verdict machine does not FAIL PC-4 (${pc4 && pc4.status})`);
      }
      if (!/potFrac/.test(String(pc4 && pc4.detail))) {
        bad.push('(f) PC-4 refuses the self-play figure without naming the unit it refused');
      }
      if (laundered.verdict !== 'fail') bad.push('(f) a self-play statistic reached a passing verdict');
    }

    const un = shipped.unevaluable.length;
    ctx.G('I46', bad.length === 0,
      `THE GATE IS GREEN AND THE VERDICT IS ${shipped.verdict.toUpperCase()}; those are two statements about `
      + `two different things (V3-PLAN §3.5, §5.4, §7.2's I46 row). What is asserted is that the answer on `
      + `the page is the answer the PRE-REGISTERED bar gives, not that the answer is yes. `
      + `(a) the harness reproduces: ${self.checks.length}/${SELF_CHECKS.length} checks green — a parser run `
      + `twice and run over a corpus split into files, an aggregator run twice, a self-play stream that `
      + `reproduces under one seed and REFUSES to under another, the paired estimator against a hand-computed `
      + `vector, and the 95% multiplier round-tripped through the CDF it was solved from. `
      + `(b) THE SHIPPED VERDICT WAS COMPUTED HERE: the block is rebuilt from this model inside the gate and `
      + `canonical-digest compared over ${CMP.length} fields${wholeMatch ? ' and as a whole' : ''}, so a typed `
      + `verdict or one left over from an earlier model fails rather than ships. `
      + `(c) THE BAR IS THE PHASE-0 BAR: the shipped criteria text is byte-equal to I46_CRITERIA and its digest `
      + `is ${CRITERIA_DIGEST}; the third copy (docs/spikes/S-C.md) is byte-compared in test/gates-reserved, so `
      + `no two of the three copies can move together. Nothing in it was narrowed to fit today's data. `
      + `(d) FAILURE-CLOSED AND ARMED: the clause asserts the verdict AGREES WITH THE BAR rather than that it `
      + `is FAIL — 'pass' iff all eight criteria pass on a present corpus — so it stays correct the day a `
      + `conforming corpus exists. Today ${un} of ${PC_IDS.length} criteria are UNEVALUABLE `
      + `[${shipped.unevaluable.join(' ')}] because S-C found no lawful, hero-visible, assigned 4-card PLO `
      + `corpus at any volume, PC-0 counts an unevaluable criterion as FAIL, PC-8 is ${shipped.pc8.status} `
      + `(${shipped.pc8.substantive}/${shipped.pc8.transposed} transposed pairs exceed 2*se.cell = `
      + `${shipped.pc8.threshold}), and evPrimary is FALSE on the shipped model. The rule REFUSES all `
      + `${ARMS.length} fabricated 'pass' blocks — including this very block with its verdict re-stamped — `
      + `and still returns 'pass' for a lawful one, so it is a bar and not a constant. `
      + `(e) DISPUTED SHIPS EMPTY WITH ITS REASON: no fit was run because PC-2 admits no corpus to fit against, `
      + `which is a different fact from everything agreeing, and the sentence saying so renders beside the `
      + `empty table. §7.2's prediction "fitted q != 0.85" is therefore UNTESTED — neither falsified nor `
      + `confirmed — and the page says that rather than implying agreement. All ${RENDERED.length} fields the `
      + `Method view must read are grep-checked in the shell. `
      + `(f) THE SELF-PLAY FIGURE IS NOT A RESULT: ${sp && sp.hands ? sp.hands.toLocaleString() : '—'} hands at `
      + `seed ${sp && sp.seed} (harness sampling parameters carried in the block as DATA, not constants — they `
      + `enter no score and are anchored by nothing because they anchor nothing), D = `
      + `${sp ? sp.D : '—'} ${sp ? sp.unit : ''} with moneyValidated:false, and feeding it to the verdict `
      + `machine FAILS PC-4 by name rather than by the corpus being absent. That is the one way this `
      + `limitation could quietly stop being true, refused structurally.`
      + (bad.length ? ` — ${bad.length} problems, first: ${bad[0]}` : ''));
    } },

    ],
  };
}
