// gates I36 D9 — the P3 equilibrium baseline, read off the artifacts it ships as.
//
// V3-PLAN §3.3 (equilibrium anchors, §7.2's I36 row), §5.3 (the full-only payload's byte budget,
// §7.2's D9 row). One family for two gates because they share ONE expensive-to-load input — the
// shipped `data/equilibrium.json` and the `baselineTiers` block beside it in `data/model.json` —
// and the registry's family contract exists exactly so shared setup is paid for once.
//
// WHY A NEW FAMILY RATHER THAN TWO ROWS IN EXISTING ONES. I36 belongs beside I35 by subject and D9
// beside D10/D11 by mechanism, and putting them there would have interleaved two new ids into the
// middle of `EXPECTED_IDS`. The registry's own note says the report order is a thing reviewers diff
// and that every arrival so far has APPENDED so the previous report stays a strict prefix of the
// new one — 46 → 50 → 52 → 53. A family here keeps that: 53 is a strict prefix of 55, and D10/D11
// keep their place. The stated reason those two go last — "their family reads artifacts off disk
// and is the only one whose inputs are produced by a step outside the runner" — now describes this
// family too, which is why it sits after them rather than before.
//
// WHAT EACH GATE READS, and why neither re-solves:
//
//   I36  the SHIPPED tiers (`model.baselineTiers`) and the SHIPPED findings
//        (`data/equilibrium.json`'s `postPasses`). The equilibrium is what ships, so the anchors are
//        asserted on what ships. Re-solving here would assert something about a solve nobody will
//        ever see, and would put another second on the wall for the privilege. The artifact's own
//        determinism is `node scripts/generate-equilibrium.mjs --check`, at the milestone close-out.
//
//   D9   the artifact's BYTES, the variant manifest's budgets, and the built full page. Nothing is
//        rebuilt — `build.mjs --check` owns that, for the reason gates/variants.mjs states about
//        D11: `verifyModel` also runs inside `generate-data.mjs`, where a rebuild would compare
//        against the previous run's model.
//
// COST. Both gates are file reads and array walks over 123 cells: single-digit milliseconds. The
// only reason this family is not free is `data/equilibrium.json` itself, at 69 KB.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

import { TIER_RANK, solve } from '../lib/policy.mjs';
import { SIXMAX } from '../lib/cfr.mjs';
import {
  ARTIFACT, NOT_HU_REASON, BASELINE_QUANT, domainLabelFor,
  anchorProblems, nestingReadiness, postPassFindings, postPassRecordProblems, readingAt,
  quantProblems, quantReadings, pageEquilibrium, pageModel,
} from '../lib/equilibrium.mjs';
import { VARIANTS } from '../lib/variant.mjs';
import { ROOT } from './_shared.mjs';

export const family = 'baseline';
export const title = 'the P3 equilibrium baseline — its anchors (I36) and its byte budget (D9)';
export const ids = ['I36', 'D9'];
export const setupLabel = 'read data/equilibrium.json and the shipped baseline-tier block';

const rel = (p) => relative(ROOT, p);

/**
 * D6's named sub-budget for the shared-core block, restated here for D9's report only.
 *
 * NOT a second assertion: D6 owns that ceiling and asserts it. What D9 does with the number is
 * print it beside its own, because the two budgets are the two halves of §5.3's split — 12 KB of
 * quantized tiers in the shared core so lite keeps a vs-GTO mode, and everything else in the
 * full-only payload — and a reader looking at either number alone cannot see the trade.
 */
const BASELINE_SUB_BUDGET = 12 * 1024;

/**
 * A fabricated block whose tiers say something the real one does not — the shape every I36 clause
 * is armed against.
 *
 * `mutate` receives the block and may rewrite one reading. Deliberately a deep-ish copy of only
 * what the detectors touch: the arming has to be able to lie about a tier without the lie leaking
 * back into the block the gate is about to assert on.
 */
function fabricate(block, nodeKey, cell, tier, argmaxAction) {
  const copy = { ...block, nodes: {}, order: [...block.order], coverage: block.coverage };
  for (const k of Object.keys(block.nodes)) {
    copy.nodes[k] = { ...block.nodes[k], w: [...block.nodes[k].w], tiers: [...block.nodes[k].tiers] };
  }
  const n = copy.nodes[nodeKey];
  const i = copy.order.indexOf(cell);
  const N = n.actions.length;
  const steps = Math.round(1 / copy.quant);
  n.tiers[i] = tier;
  for (let a = 0; a < N; a++) n.w[i * N + a] = n.actions[a] === argmaxAction ? steps : 0;
  return copy;
}

export function build(ctx) {
  const { model, opts = {}, G } = ctx;

  const eqPath = resolve(ROOT, ARTIFACT);
  const eqText = opts.equilibrium !== undefined ? opts.equilibrium
    : (existsSync(eqPath) ? readFileSync(eqPath, 'utf8') : null);
  let payload = null, parseError = null;
  if (eqText != null) {
    try { payload = JSON.parse(eqText); } catch (e) { parseError = e.message; }
  }
  const block = model.baselineTiers || null;

  return {
    sections: [
    // =========================================================================
    // I36 — the equilibrium anchors, SCOPED TO THE MEASUREMENT
    // =========================================================================
    { ids: ['I36'], label: 'the equilibrium anchors, scoped to the HU domain', run: () => {
    if (!block) {
      G('I36', false, `data/model.json carries no baselineTiers block — P3 ships one (§5.3), so its `
        + 'absence is a failure, not a skip. Run scripts/generate-equilibrium.mjs.');
      return;
    }
    if (!payload) {
      G('I36', false, parseError
        ? `${ARTIFACT} is not JSON — ${parseError}`
        : `there is no ${ARTIFACT} — the post-pass finding I36 checks the tiers against lives in it. `
          + 'Run scripts/generate-equilibrium.mjs.');
      return;
    }
    const bad = [];

    // ================================================================================
    // (a) THE TWO NAMED ANCHORS, over the seats that exist
    // ================================================================================
    // §7.2: "AA_BIGPAIR x DS opens everywhere; TRASH x RB never opens UTG". The tree has two seats,
    // so `anchorProblems` reads the three (pos, node) pairs that exist and says so; the detector
    // and its reasoning live in scripts/lib/equilibrium.mjs beside the block it reads, exactly as
    // I35's detectors live in cfr.mjs beside the solver.
    for (const why of anchorProblems(block)) bad.push(`(a) ${why}`);

    const rAA = readingAt(block, 'SB|rfi', 'AA_BIGPAIR|DS');
    const rAAbb = readingAt(block, 'BB|raise', 'AA_BIGPAIR|DS');
    const rAA3 = readingAt(block, 'SB|3bet', 'AA_BIGPAIR|DS');
    const rTrash = readingAt(block, 'SB|rfi', 'TRASH|RB');
    const rTrashBB = readingAt(block, 'BB|raise', 'TRASH|RB');

    /* ARMED, three ways, on THE SAME detector the assertion runs — a fabricated block in which the
       best hand in the deck folds its button, one in which it folds to a 3bb open, and one in
       which the junk cell opens. Each must be caught; the real block must clear. */
    const aFoldsAA = anchorProblems(fabricate(block, 'SB|rfi', 'AA_BIGPAIR|DS', 'T5', 'fold')).length > 0;
    const aFoldsAAvs = anchorProblems(fabricate(block, 'BB|raise', 'AA_BIGPAIR|DS', 'T5', 'fold')).length > 0;
    const aOpensTrash = anchorProblems(fabricate(block, 'SB|rfi', 'TRASH|RB', 'T1', 'raise')).length > 0;
    const aClears = anchorProblems(block).length === 0;
    if (!(aFoldsAA && aFoldsAAvs && aOpensTrash)) {
      bad.push(`(a) the anchor detector is not armed: a folded AA_BIGPAIR|DS at SB flagged `
        + `${aFoldsAA}, folded to the open flagged ${aFoldsAAvs}, an opening TRASH|RB flagged `
        + `${aOpensTrash}`);
    }

    // ================================================================================
    // (b) THE NESTING CLAUSE — RECORDED NOT MEASURABLE, never passed and never toleranced
    // ================================================================================
    // §7.2 predicts "nesting fails at some seat pair" and marks the prediction expected-falsified.
    // It is NOT TESTABLE this milestone. The reason is not this gate's to invent: V3-PLAN §3.3's
    // Adjudicated block evaluated the 6-max re-opening rule ONCE by measurement, leg (ii) failed,
    // and the consequence was frozen verbatim in cfr.mjs's SIXMAX.reopenVerdict. This clause quotes
    // that record rather than restating it, and FAILS if either half stops holding — if the record
    // disappears, or if a payload ever covers two seats of the nesting chain, in which case the
    // clause is owed a real measurement instead of this note.
    const nest = nestingReadiness(block);
    if (nest.measurable) {
      bad.push(`(b) the nesting chain is now measurable — ${nest.present.join(', ')} of `
        + `UTG/HJ/CO/BTN are covered — so "not measurable in the HU domain" has stopped being true `
        + 'and the clause is owed a measurement rather than this note (V3-PLAN §7.2\'s prediction '
        + 'becomes testable at that point)');
    }
    if (!/NOT\s+MEASURABLE/i.test(String(SIXMAX.reopenVerdict))) {
      bad.push('(b) cfr.mjs\'s SIXMAX.reopenVerdict no longer records the not-measurable verdict '
        + 'this clause quotes — the reason a clause is scoped must outlive the scoping');
    }
    /* ARMED: a payload whose coverage claims a third seat must flip `measurable`. Without this the
       clause could go on reporting "two seats" forever after the tree grew. */
    const bArmed = nestingReadiness({
      ...block,
      coverage: [...block.coverage, { pos: 'CO', node: 'rfi', covered: true }, { pos: 'BTN', node: 'rfi', covered: true }],
    }).measurable === true;
    if (!bArmed) bad.push('(b) the nesting-readiness detector is not armed: a coverage map claiming CO and BTN still reads not-measurable');

    // ================================================================================
    // (c) THE COMPARAND IS RAW MODEL TIERS, and the post-passes are MEASURED not enforced
    // ================================================================================
    // §3.3: "The vs-GTO comparand is raw model tiers, with post-passed display noted — the
    // post-passes (nesting, suit monotonicity) are impositions an equilibrium may violate, and a
    // violation is a finding to report, not launder."
    //
    // Two halves. First, the finding recorded in the full artifact must describe the tiers that
    // ship in the shared core — the failure that actually happens is that the tiers are regenerated
    // and the record is not, leaving the artifact stating a previous solve's violation count.
    // Second, the comparand's own definition is checked against the model: `preDisplay` is the
    // action BEFORE the post-passes, and it must be a real distinction rather than a synonym.
    const derived = postPassFindings(block, model.rows, model.cols, TIER_RANK);
    for (const why of postPassRecordProblems(payload.postPasses, derived)) bad.push(`(c) ${why}`);

    const vRef = model.meta.vpip.ref / 100;
    let modelMoved = 0, modelCells = 0, rawMissing = 0;
    for (const row of (payload.coverage || []).filter((r) => r.covered)) {
      const s = solve(model, { pos: row.pos, node: row.node, v: vRef, raiserPos: row.raiser });
      for (const k of Object.keys(s.cells)) {
        modelCells++;
        if (s.cells[k].preDisplay === undefined) rawMissing++;
        else if (s.cells[k].preDisplay !== s.cells[k].action) modelMoved++;
      }
    }
    if (rawMissing) {
      bad.push(`(c) ${rawMissing} model cells carry no \`preDisplay\` — the RAW tier is the `
        + 'comparand §3.3 names, and a comparand that is not recorded cannot be compared against');
    }
    /* ARMED: a record claiming the equilibrium is monotone when the shipped tiers are not. This is
       the laundering §3.3 forbids, written as a fabricated violator. */
    const cArmed = postPassRecordProblems(
      { ...payload.postPasses, suitMonotonicity: { violations: [], count: 0 } }, derived,
    ).length > 0;
    const cClears = postPassRecordProblems(payload.postPasses, derived).length === 0;
    if (!cArmed) {
      bad.push('(c) the post-pass record detector is not armed: a record claiming zero suit-monotonicity '
        + 'violations cleared against tiers that have some');
    }

    // ================================================================================
    // (d) COVERAGE IS HU, AND EVERY UNCOVERED SEAT NAMES ITS REASON
    // ================================================================================
    // Adjudication 8: "every other seat renders disabled-with-named-REASON 'baseline is HU'". The
    // gate's job is that the REASON is in the DATA, so the page cannot supply it from prose — the
    // same rule I35 clause (f) applies to the label.
    const cov = block.coverage || [];
    const uncovered = cov.filter((r) => !r.covered);
    const unreasoned = uncovered.filter((r) => r.reason !== NOT_HU_REASON);
    if (cov.length !== 24) bad.push(`(d) the shipped coverage map has ${cov.length} rows, not the page's 6 positions x 4 nodes`);
    if (unreasoned.length) {
      bad.push(`(d) ${unreasoned.length} uncovered (pos, node) pairs carry no named reason `
        + `(${unreasoned.slice(0, 3).map((r) => `${r.pos}|${r.node}`).join(', ')}) — "${NOT_HU_REASON}" `
        + 'must be a shipped datum, not a sentence the page supplies');
    }
    if (!cov.some((r) => r.covered)) bad.push('(d) the coverage map claims nothing is covered');

    /* §5.7's labeling split, checked as a DERIVATION rather than as a string. "HU is GTO; anything
       multiway is a self-play fixed point" is a rule about how many seats were solved, so the label
       must follow from the shipped seat list. The failure this catches is the one that matters the
       day a multiway surface ships: a payload labelled "GTO" by omission. */
    for (const [where, unit] of [['baselineTiers', block], [ARTIFACT, payload.domain]]) {
      if (!unit) continue;
      const want = domainLabelFor(unit.seats);
      const got = unit.domainLabel !== undefined ? unit.domainLabel : unit.label;
      if (got !== want) {
        bad.push(`(d) ${where} solves ${(unit.seats || []).length} seats but is labelled `
          + `${JSON.stringify(got)} — §5.7's split is "HU is GTO, anything multiway is a self-play `
          + `fixed point", so the label is ${JSON.stringify(want)} and it is DERIVED from the seat `
          + 'list, never typed beside it');
      }
    }
    /* ARMED: six seats must not read "GTO". */
    const dArmed = domainLabelFor(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']) === 'self-play fixed point'
      && domainLabelFor(['SB', 'BB']) === 'GTO';
    if (!dArmed) bad.push('(d) the domain-label derivation is not armed: a six-seat surface does not read as a self-play fixed point');

    // ================================================================================
    // (e) baselineQuant — THE ANCHOR TABLE MADE BINDING, AND THE FLAG'S THREE LEGS
    // ================================================================================
    // The P3 red team's one majority-unanchored constant (docs/refutations/P3.md, six memos of
    // six). §6's row claims "the payload bytes it buys … The table IS the anchor"; the table was
    // true and NOTHING RAN IT, so 0.02, 0.05 and 0.5 all regenerated green, and the anchor's own
    // prose — which ships into both artifacts and renders beside the value — could be replaced
    // with fabricated figures and ship green too. No replacement anchor was invented: the constant
    // is now FLAGGED per §6, and this clause is the bound that makes the flag worth having.
    //
    // The measurement is taken from what SHIPS: the payload's full-precision strategies at the
    // block's own depth, quantized by the same `quantizedNodes` the generator writes the block
    // with. `strategyOf` emits the shortest decimal that round-trips a double, so the shipped
    // strategies are the solve bit-for-bit and the re-derivation is exact rather than tolerant.
    const eqDepth = payload.depths ? payload.depths[`T${block.stack}`] : null;
    for (const why of quantProblems(block, eqDepth && eqDepth.strategy)) bad.push(`(e) ${why}`);
    /* the same readings the assertion used, for the report — one function, so the printed table and
       the checked table cannot drift (which is the defect this clause is here about) */
    const readings = eqDepth && eqDepth.strategy ? quantReadings(block, eqDepth.strategy) : [];

    /* ARMED FOUR WAYS, on the same detector the assertion runs: a fabricated byte figure, a
       fabricated MIX count, a step the shipped table does not price, and a deleted flag. Each must
       be caught; the real block must clear. */
    const eStrategy = eqDepth && eqDepth.strategy;
    const eFab = (mut) => quantProblems({ ...block, ...mut }, eStrategy).length > 0;
    const eBytes = eFab({ quantAnchor: String(block.quantAnchor).replace(/4,964/, '4,900') });
    const eMix = eFab({ quantAnchor: String(block.quantAnchor).replace(/20 MIX/, '21 MIX') });
    const eStep = eFab({ quant: 0.02 });
    const eFlag = eFab({ quantFlag: '' });
    const eClears = quantProblems(block, eStrategy).length === 0;
    if (!(eBytes && eMix && eStep && eFlag)) {
      bad.push(`(e) the quantization detector is not armed: a fabricated byte figure flagged ${eBytes}, `
        + `a fabricated MIX count ${eMix}, an unpriced step ${eStep}, a deleted flag ${eFlag}`);
    }

    /* THE BADGE LEG, read out of the shell source exactly as I41(g)/I44(f) read it. The Method view
       renders the step beside its anchor; without the `UNANCHORED` entry it renders like a measured
       number, which is the P1 finding (docs/refutations/P1.md) applied to a new flag. */
    let eBadged = null;
    try {
      const shell = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
      const map = /var UNANCHORED = \{([^}]*)\}/.exec(shell);
      if (!map) bad.push('(e) src/shell.html no longer carries the UNANCHORED badge map — every flagged constant would render unbadged');
      else if (map[1].indexOf("'baselineQuant'") < 0) {
        bad.push('(e) baselineQuant is flagged but not badged in the Method view — it would render '
          + 'like the measured numbers beside it');
      } else eBadged = true;
      /* and the page must actually READ the map for this constant rather than merely list it */
      if (shell.indexOf("UNANCHORED['baselineQuant']") < 0) {
        bad.push("(e) nothing in src/shell.html reads UNANCHORED['baselineQuant'] — a badge map "
          + 'entry no renderer consults is a flag nobody sees');
      }
      if (shell.indexOf('quantFlag') < 0) {
        bad.push('(e) the Method view does not render the shipped quantFlag — §6\'s flagged idiom '
          + 'is named + LABELLED + gated, and this is the labelled leg');
      }
    } catch (err) {
      bad.push(`(e) src/shell.html is unreadable, so the badge cannot be checked: ${err.message}`);
    }

    // ================================================================================
    // the verdict — the measurements print whether or not the gate passes (I33's idiom)
    // ================================================================================
    const say = (r) => (r ? `${r.argmax} ${r.weights.join('/')} of ${r.steps} (${r.tier})` : 'NO READING');
    const pp = payload.postPasses || {};
    const suit = pp.suitMonotonicity || { count: 0, violations: [] };
    const detail = `(a) THE TWO NAMED ANCHORS, SCOPED TO THE SEATS THAT EXIST — the solved tree has `
      + `two, so "opens everywhere" is read over the three (pos, node) pairs that exist rather than `
      + `over six. AA_BIGPAIR|DS: SB rfi ${say(rAA)}, BB vs the open ${say(rAAbb)}, SB vs the 3-bet `
      + `${say(rAA3)} — the best hand in the deck opens, continues and 4-bets, purely, at every seat `
      + `there is. TRASH|RB: §7.2's clause is "never opens UTG" and THERE IS NO UTG, so it is scoped `
      + `to SB — the BUTTON, the loosest opening seat in the game, which makes the scoped clause `
      + `STRONGER than the original rather than weaker — and the reading is ${say(rTrash)}. `
      + `**THE LAUNCH BLOCK'S EXPECTATION IS FALSIFIED, and that is the finding:** P3's launch `
      + `expected TRASH|RB to OPEN, reasoning from the 89.3% opening frequency; it folds, purely. `
      + `88.86% is a COMBO-WEIGHTED number over 123 cells and the ~11% it does not open is the `
      + `bottom of the range, not a thin spread — so the model's own clause is CORROBORATED in the `
      + `one seat where it can be read. Facing the open, TRASH|RB ${say(rTrashBB)} — it continues on `
      + `price, which is a different claim and is why the clause is scoped to the open. `
      + `(b) POSITIONAL NESTING: NOT MEASURABLE IN THE HU DOMAIN, recorded rather than passed and `
      + `never toleranced (the I15 precedent). ${nest.reason} Seats solved: ${nest.seats.join(', ')}; `
      + `of the UTG/HJ/CO/BTN chain, ${nest.present.length} are covered. §7.2's prediction — "nesting `
      + `fails at some seat pair" — is therefore NOT TESTABLE this milestone; it is not reported as `
      + `holding and it is not reported as failing. The reason is quoted from cfr.mjs's `
      + `SIXMAX.reopenVerdict, which I35(d) re-checks every run, and this clause FAILS the day a `
      + `payload covers two seats of the chain — at which point the prediction is owed a measurement. `
      + `(c) THE COMPARAND IS RAW MODEL TIERS (policy.mjs's \`preDisplay\`), and the post-passes are `
      + `MEASURED ON THE EQUILIBRIUM RATHER THAN ENFORCED ON IT. **SUIT MONOTONICITY IS VIOLATED: `
      + `${suit.count} of ${derived.readings} shipped tier readings**${suit.count ? ` — ${suit.violations.join('; ')}` : ''}. `
      + `The AA-band pass is not: ${(pp.aaBand || {}).count} violations. So §3.3's sentence is not `
      + `defensive — an equilibrium DOES violate an imposition the display makes, and the one it `
      + `violates hardest (SB rfi RUN1_TOPMID SS->SSA, RAISE to FOLD) is a card-removal effect a `
      + `percentile cut cannot express. The record in ${ARTIFACT} is re-derived from the shipped `
      + `tiers here and matches (${cClears}); a record claiming zero violations over these tiers is `
      + `flagged (${cArmed}). MODEL SIDE, same three settings at VPIP ${model.meta.vpip.ref}: the `
      + `model's own post-passes move ${modelMoved} of ${modelCells} cells, so choosing the raw `
      + `comparand changes almost nothing about the MODEL and everything about what may be said `
      + `about the BASELINE. (d) COVERAGE IS HU: ${cov.filter((r) => r.covered).length} of `
      + `${cov.length} (pos, node) pairs are solved and the other ${uncovered.length} carry the `
      + `named reason "${NOT_HU_REASON}" as a SHIPPED DATUM — the page renders it, it does not `
      + `supply it. §5.7's split is a DERIVATION here rather than a string: ${nest.seats.length} `
      + `seats solved -> label ${JSON.stringify(block.domainLabel)}, and a six-seat surface would `
      + `read ${JSON.stringify(domainLabelFor(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']))} instead — so `
      + `no multiway surface can be labelled "GTO" by omission, and none exists to be, because `
      + `nothing multiway was solved. `
      + `(e) baselineQuant ${block.quant}${block.quant === BASELINE_QUANT ? '' : ' (NOT the module default)'} `
      + `is FLAGGED, NOT ANCHORED — the P3 red team's one majority-unanchored constant, 6 memos of 6 `
      + `(docs/refutations/P3.md). §6's row claimed the byte table as its anchor; the table was true `
      + `and nothing ever ran it, so 0.02, 0.05 and 0.5 all regenerated with every gate, test and `
      + `build green, and the anchor's own prose could be fabricated and still reach the Method view. `
      + `NO REPLACEMENT ANCHOR WAS INVENTED. The table is now BINDING instead, re-derived from the `
      + `SHIPPED T${block.stack} strategies here on every run — ${readings.map((r) => `${r.quant} -> `
        + `${r.bytes.toLocaleString()} B / ${r.mix} MIX${r.shipped ? ' [SHIPPED]' : ''}`).join(', ')} — `
      + `each checked against the figure the shipped anchor quotes for it, with the shipped step `
      + `required to be one of the steps that anchor prices and the shared-core block required to BE `
      + `that quantization of those strategies (armed: fabricated byte figure flagged ${eBytes}, `
      + `fabricated MIX ${eMix}, unpriced step ${eStep}, deleted flag ${eFlag}; the real block clears `
      + `${eClears}). WHAT THAT DOES NOT DO, said out loud: 0.05 and 0.001 are priced rows and would `
      + `still pass — which step to take is a judgment about what a tier-level surface can paint, and `
      + `nothing measures that. So the constant ships §6's three legs instead: quantFlag in the block `
      + `and \`flag\` + kind 'estimate' in the payload (named), UNANCHORED['baselineQuant'] badged in `
      + `the Method view (${eBadged ? 'badged' : 'NOT BADGED'}), and this clause (gated).`
      + (bad.length ? ` — FAILS: ${bad.join(' · ')}` : '');
    G('I36', bad.length === 0, detail);
    } },

    // =========================================================================
    // D9 — the full-only payload's byte budget, and the full page's own tripwire
    // =========================================================================
    { ids: ['D9'], label: 'the equilibrium payload budget and the full-page tripwire', run: () => {
    const spec = VARIANTS.full;
    const bad = [];

    if (!payload) {
      G('D9', false, parseError
        ? `${ARTIFACT} is not JSON — ${parseError}`
        : `there is no ${ARTIFACT}. P3 emits it (§5.3) and full's budgets are now set FROM it, so `
          + 'its absence is a failure, not a skip. Run scripts/generate-equilibrium.mjs.');
      return;
    }

    /* (a) THE SYNTHETIC REFUSAL, first because it is the one that is not about size. §5.3: "D9
       must refuse a payload carrying meta.synthetic: true". docs/spikes/S-D.md's prototype payload
       carries that flag precisely so that shipping it is loud rather than a plausible-looking 66 KB
       of numbers nobody solved. Read strictly: anything truthy fails, absence and `false` pass. */
    if (payload.meta && payload.meta.synthetic) {
      bad.push(`(a) ${ARTIFACT} carries meta.synthetic — this is a stand-in payload, not a solved `
        + 'baseline, and §5.3 refuses it outright. No size clause below can make it shippable.');
    }

    /* (b) THE PAYLOAD'S OWN BYTE TRIPWIRE, measured + 5% (§6's "per-build byte budgets" row: the
       anchor is arithmetic). The budget lives in scripts/lib/variant.mjs beside the variant it
       belongs to, so the build and the gate cannot hold different numbers — the same rule D10/D11
       follow with the manifest. */
    const eqBytes = opts.equilibrium !== undefined ? Buffer.byteLength(eqText)
      : (existsSync(eqPath) ? statSync(eqPath).size : 0);
    if (!spec.budgets || spec.budgets.eq == null) {
      bad.push('(b) VARIANTS.full.budgets.eq is not set — D9 is the gate that sets it, and an unset '
        + 'budget here means the flip was made in the build and not in the manifest');
    } else if (eqBytes > spec.budgets.eq) {
      bad.push(`(b) ${ARTIFACT} is ${(eqBytes / 1024).toFixed(1)} KB, over its `
        + `${spec.budgets.eq / 1024} KB budget — retune once per phase (§5.3), never per commit`);
    }

    /* (c) THE FULL PAGE'S OWN TOTAL-SIZE TRIPWIRE. §5.3: "The full page gains its own total-size
       tripwire; the 600 KB page budget stays lite's." Read off the artifact on disk rather than
       rebuilt, for gates/variants.mjs's stated reason. A missing full artifact is a FAILURE from
       this step on: the plan's words are that `skipped: full` is no longer acceptable once the
       payload exists. */
    const fullPath = resolve(ROOT, spec.out);
    const fullBytes = opts.fullBytes !== undefined ? opts.fullBytes
      : (existsSync(fullPath) ? statSync(fullPath).size : null);
    if (fullBytes === null) {
      bad.push(`(c) there is no ${spec.out} — ${ARTIFACT} exists, so the full variant is buildable `
        + 'and must be built (scripts/build.mjs --variant=full)');
    } else if (spec.budgets && fullBytes > spec.budgets.total) {
      bad.push(`(c) ${spec.out} is ${(fullBytes / 1024).toFixed(1)} KB, over its `
        + `${spec.budgets.total / 1024} KB budget`);
    }

    /* (d) AND THE PAYLOAD MUST ACTUALLY BE IN THE PAGE. A budget on a file the artifact does not
       carry measures nothing. The injected copy is parsed back out and compared on the two fields
       that identify it — a page built from an older payload passes every size clause above. */
    const fullText = opts.fullText !== undefined ? opts.fullText
      : (fullBytes === null ? null : readFileSync(fullPath, 'utf8'));
    if (fullText !== null) {
      const injected = pageEquilibrium(fullText);
      if (!injected) bad.push(`(d) ${spec.out} carries no EQUILIBRIUM binding — the @inject:eq region did not fill`);
      else if (injected.meta.contentHash !== payload.meta.contentHash) {
        bad.push(`(d) ${spec.out} carries equilibrium ${String(injected.meta.contentHash).slice(0, 16)}… `
          + `but ${ARTIFACT} is ${String(payload.meta.contentHash).slice(0, 16)}… — rebuild the full page`);
      } else if (injected.meta.synthetic) {
        bad.push(`(d) ${spec.out} carries a synthetic payload even though the file on disk does not`);
      }
      const injectedModel = pageModel(fullText);
      if (injectedModel && !injectedModel.baselineTiers) {
        bad.push(`(d) ${spec.out} carries no baselineTiers block — it is shared-core, so both variants have it`);
      }
    }

    /* (e) THE SHIPPING DECISION MUST STILL MATCH ITS OWN MEASUREMENT. §3.3 deferred "embed the
       matrix or reference it by content hash" to this gate, and the payload records the
       measurement it was decided on. Re-applying the rule here is what stops the decision outliving
       the numbers: if the payload grew until embedding no longer doubled it, an artifact that still
       says "reference" is a choice nobody re-took. */
    const sh = payload.matrix && payload.matrix.shipping;
    if (!sh) bad.push('(e) the payload records no matrix shipping decision');
    else {
      const want = sh.ratio >= 2 ? 'reference' : 'embedded';
      if (sh.ships !== want) {
        bad.push(`(e) the payload ships the matrix by ${sh.ships} but its own measurement (ratio `
          + `${sh.ratio.toFixed(2)}x) says ${want} — the decision no longer matches the numbers it was made on`);
      }
      if (sh.ships === 'reference' && !(payload.matrix.contentHash && payload.matrix.artifact)) {
        bad.push('(e) the matrix ships by reference but the payload carries no artifact path and content hash');
      }
    }

    const kb = (b) => (b / 1024).toFixed(1);
    const sizes = spec.budgets || {};
    const detail = `${ARTIFACT} ${kb(eqBytes)} KB/${(sizes.eq || 0) / 1024} KB · ${spec.out} `
      + `${fullBytes === null ? 'NOT BUILT' : kb(fullBytes)} KB/${(sizes.total || 0) / 1024} KB. `
      + `BOTH SET THIS PHASE, from the first real payload, and the anchor is arithmetic: `
      + `${spec.budgetSource}. meta.synthetic is ${JSON.stringify(payload.meta && payload.meta.synthetic)} `
      + `— §5.3's refusal is a clause here rather than a convention, and S-D's prototype payload `
      + `carries that flag precisely so shipping it is loud. THE 7,626-PAIR MATRIX SHIPS BY `
      + `${sh ? sh.ships.toUpperCase() : '?'}, and the decision §3.3 deferred to this gate was taken `
      + `on ITS OWN MEASUREMENT: a FAITHFUL embedding — the artifact's integer counters, the only `
      + `encoding from which the served numbers reconstruct bit-identically — costs `
      + `${sh ? sh.embedBytes.toLocaleString() : '?'} B against a `
      + `${sh ? sh.withoutBytes.toLocaleString() : '?'} B payload, a ratio of `
      + `${sh ? sh.ratio.toFixed(2) : '?'}x, so embedding would MORE THAN DOUBLE the artifact and `
      + `§3.3's escape applies. Also measured and recorded, because it is the number that would have `
      + `made embedding look affordable: E rounded to six decimals costs `
      + `${sh && sh.options ? sh.options.rounded6.bytes.toLocaleString() : '?'} B — under the `
      + `threshold, and NOT THE SAME MATRIX, so it does not get to decide. The reference carries the `
      + `artifact path and its contentHash ${String((payload.matrix || {}).contentHash).slice(0, 16)}…, `
      + `and data/checkdown-matrix.json stays the Node-side source of truth (I33's (artifact) clause `
      + `is what keeps it honest). RECORDED BESIDE IT, the two-seed payoff spread on this very `
      + `payload: T100 ${(100 * payload.depths.T100.twoSeedSpreadPot).toFixed(4)}% of pot, T40 `
      + `${(100 * payload.depths.T40.twoSeedSpreadPot).toFixed(4)}% — I35 is the gate that asserts on `
      + `those; here they are a datum beside the matrix they came from. THE SHARED-CORE HALF of §5.3's `
      + `split, for the trade to be visible in one place: the quantized baseline-tier block is `
      + `${kb(Buffer.byteLength(JSON.stringify(model.baselineTiers || {})))} KB of D6's `
      + `${BASELINE_SUB_BUDGET / 1024} KB sub-budget, which is what buys LITE a tier-level vs-GTO mode `
      + `while everything else here stays full-only.`
      + (bad.length ? ` — FAILS: ${bad.join(' · ')}` : '');
    G('D9', bad.length === 0, detail);
    } },
    ],
  };
}
