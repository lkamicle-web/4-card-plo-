// equilibrium.mjs — the P3 baseline payload: what `data/equilibrium.json` IS, and what the shared
// core's `model.baselineTiers` block is cut from.
//
// V3-PLAN §3.3 (with its `Adjudicated (P3 launch)` and `Adjudicated (P3 relaunch)` blocks) and §5.3.
// The split between this module and `scripts/generate-equilibrium.mjs` is the one
// `checkdown-matrix.mjs` / `generate-checkdown-matrix.mjs` already uses, and for the same reason:
// the ceremony around an artifact (write it, validate it, own its determinism claim) is a script,
// but what the artifact CONTAINS is a contract, and a contract deserves a module a test can hold to
// rules. `test/equilibrium.test.mjs` holds this one; gate I36 and gate D9 read the artifact it
// describes.
//
// ---------------------------------------------------------------------------------------------
// WHAT SHIPS WHERE, and why there are two payloads rather than one.
//
//   data/equilibrium.json     FULL-ONLY (§5.3). The averaged strategy at every infoset, both
//                             depths, at full double precision; the exploitability and the
//                             frequencies; the payoff `source` and the label DERIVED from it; the
//                             cap list; the solver constants; the matrix's provenance and the
//                             validation residuals; the HU coverage map. Injected into
//                             index-full.html through the `@inject:eq` region, gated by D9.
//
//   model.baselineTiers       THE SHARED CORE (§5.3's one allowed addition, ≤ 12 KB, D6's named
//                             sub-budget). Per (pos, node, cell) baseline tiers, QUANTIZED, so that
//                             LITE keeps a tier-level vs-GTO colour mode instead of a disabled one.
//                             It carries its own `source` datum and its own copy of the cap list,
//                             so the label and the caps lite renders come off SHIPPED DATA rather
//                             than out of prose (I35 clauses (e) and (f)).
//
// The full artifact is not a superset of the core block by accident: the core block is the
// QUANTIZED cut of the same solve, and `baselineQuant` is the constant that says by how much. §6
// anchors it to "the payload bytes it buys", which is a measurement — `quantizationTable()` below
// produces it, and the number chosen is the one that table justifies.
//
// ---------------------------------------------------------------------------------------------
// THE MATRIX SHIPS BY REFERENCE, AND THAT IS D9's DECISION MADE ON D9's MEASUREMENT.
//
// §3.3's relaunch block defers the question here in those words: "whether p3-baseline's
// equilibrium.json embeds the matrix or references it by content hash is that step's decision under
// D9". The measurement is taken in `matrixShipping()` below rather than asserted: the 7,626-pair
// upper triangle costs ~67 KB as shipped floats against a ~65 KB payload without it, so embedding
// MORE THAN DOUBLES the artifact — the exact condition the deferral names — and the artifact ships
// a content-hash REFERENCE to `data/checkdown-matrix.json`, which is the Node-side source of truth
// either way. The measurement is recorded in the payload, so a reader can re-take the decision
// rather than trust it, and gate D9 re-checks the rule every run.
//
// ---------------------------------------------------------------------------------------------
// COVERAGE IS HEADS-UP, AND THE PAYLOAD SAYS SO IN DATA (V3-PLAN §3.3, adjudication 8).
//
// The solved tree has exactly two seats. The page's vocabulary has six positions and four nodes.
// Three (pos, node) pairs of the twenty-four have a solved analogue and twenty-one do not, and the
// twenty-one carry the NAMED REASON `'baseline is HU'` rather than a number, a blank or a zero.
// `coverageMap()` builds that table; D10's `SIM.available` idiom is what renders it. Nothing here
// invents a multiway claim, because nothing multiway was solved — and the data is what says so.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CAPS, CONSTANTS, ITER_CAP, PREFLOP_POT_BB, solveHU, labelFor,
} from './cfr.mjs';
import { RESULT_KEYS } from './payoff.mjs';
import { ARTIFACT as MATRIX_ARTIFACT, BOARDS, SEEDS } from './checkdown-matrix.mjs';
import { POSITIONS, NODES } from './policy.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

/** where the payload lands. Full-only: D10's negative manifest forbids it in lite. */
export const ARTIFACT = 'data/equilibrium.json';

/** the generator that writes it — hashed into `meta.generatorHash`, as the matrix artifact does */
export const GENERATOR = 'scripts/generate-equilibrium.mjs';

/**
 * The two effective stacks, and the canonical solve.
 *
 * Both depths per §3.3 ("solve both 100bb and 40bb ... they differ in exactly one terminal pot and
 * make a controlled pair for the depth axis"). `INIT_SEED` is 0 — the unperturbed simplex start,
 * the canonical one — and `PAYOFF_SEED` is matrix A, the first of the two named samples. The second
 * sample is solved too, but only so its spread can be RECORDED beside the primary: I35's two-seed
 * payoff axis is the gate that asserts on it, and an artifact that quietly shipped whichever of two
 * samples looked better would be a seed pick.
 */
export const STACKS = Object.freeze([100, 40]);
export const INIT_SEED = 0;
export const PAYOFF_SEED = SEEDS[0];
export const SPREAD_SEED = SEEDS[1];

/**
 * THE QUANTIZATION STEP for the shared-core block — `baselineQuant`, V3-PLAN §6.
 *
 * FLAGGED, NOT ANCHORED — and that is the P3 red team's verdict, not a hedge. §6's row for this
 * constant claims an anchor ("the payload bytes it buys … The table IS the anchor"); six refuters
 * of six returned UNANCHORABLE against it (docs/refutations/P3.md). They did not refute the table:
 * every one of them re-derived it exactly. What they refuted is that it fixes the VALUE —
 * regenerating at 0.02, at 0.05 and at 0.5 shipped 55/55 gates, 591/591 tests and 2/2 variants
 * current, the first bound that bit was D6's byte ceiling five orders of magnitude away, and the
 * anchor's own prose could be replaced with fabricated figures and still reach the Method view.
 *
 * The rule when an anchor is refuted is: do not invent a replacement. So the number ships FLAGGED
 * in §6's idiom — `QUANT_FLAG` below, named in the payload's `baselineQuant` entry and in the
 * block's `quantFlag`, badged `estimate` in the Method view (`UNANCHORED` in src/shell.html), and
 * BOUNDED: gate I36 clause (e) re-derives the table from the SHIPPED strategies on every verify and
 * requires the shipped step to be one the shipped anchor prices, every figure it quotes to be the
 * measured one, and the shared-core block to be exactly that quantization of those strategies.
 *
 * That ends the 500x band and the fabricable table. It does NOT make 0.01 the only shippable step —
 * 0.05 and 0.001 are priced rows and would pass — and the residue is precisely what the flag says:
 * WHICH priced step to take is a judgment about what a tier-level surface can paint, and nothing
 * here measures that.
 *
 * It is the ONLY new opinion constant this module introduces, and it is a display resolution rather
 * than a model number: it decides how finely a solved mixed strategy is written down, not what the
 * strategy is. The full artifact carries the same strategies at full double precision, so nothing
 * is lost — only the LITE core pays this rounding, which is what the 12 KB sub-budget is about.
 */
export const BASELINE_QUANT = 0.01;

/**
 * The measured table that anchors it. Written out because §6's rule for this row is literally "the
 * payload bytes it buys, stated at D6's new sub-budget" — so the table IS the anchor, and a table
 * that lived only in a commit message would not be one.
 *
 * MEASURED on the shipped 400,000-board matrices, T100, init seed 0, over 3 nodes x 123 live cells
 * = 369 tier readings (`node scripts/generate-equilibrium.mjs --quant-table` re-derives it):
 *
 *   quant    quantized data   MIX cells of 369   tier readings that moved vs the step above
 *   0.05          4,589 B            15                        —
 *   0.01          4,964 B            20                        5
 *   0.001         5,357 B            23                        3
 *
 * The `nodes` bytes are the anchor column and the whole block's size is D6's reading, printed in
 * its detail line — see `quantizationTable` for why the two are kept apart.
 *
 * WHAT THE TABLE SAYS, and it is not "finer is better until it stops changing" — the reading never
 * stops changing, because a CFR+ average strategy has a long tail of vanishingly small weights and
 * a fine enough step will always resolve one more of them as a mix. The question the step actually
 * answers is which mixes a TIER-LEVEL surface can render, and that is arithmetic: at step `q` a
 * cell reads MIX exactly when its off-argmax weight reaches `q/2`. So 0.05 writes down as pure five
 * cells that mix at between 0.5% and 2.5% — frequencies a colour mode can and should paint, and a
 * vs-GTO comparison that called them pure would report a disagreement with the model that the
 * equilibrium does not make. Going ten times finer than 0.01 costs another 393 B and buys three
 * cells whose off-argmax weight is between 0.05% and 0.5%: mixes below the resolution of any
 * tier-level surface, and below the two-seed payoff spread the same solve reports.
 *
 * 0.01 is therefore taken — 4,964 B of quantized data, inside D6's 12,288 B sub-budget — and the
 * two steps either side are on the record with what each would have cost and bought. THE BLOCK'S
 * OWN SIZE IS NOT QUOTED HERE any more: this comment used to say "90.9% of its named sub-budget"
 * when the live reading was 91.4%, a stale figure a refuter caught (docs/refutations/P3.md), and a
 * number that goes stale in a comment is worth less than the one D6 and `--quant-table` print on
 * every run. THE PROSE BELOW IS NOT FREE TEXT: I36 clause (e) parses the steps and figures out of
 * it and checks each against a measurement taken from the shipped strategies, so a fabricated table
 * fails rather than ships.
 */
export const QUANT_ANCHOR = 'the payload bytes it buys (V3-PLAN §6), measured on the shipped T100 '
  + 'solve over 369 tier readings: 0.05 -> 4,589 B / 15 MIX; 0.01 -> 4,964 B / 20 MIX; 0.001 -> '
  + '5,357 B / 23 MIX. At step q a cell reads MIX exactly when its off-argmax weight reaches q/2, '
  + 'so 0.05 writes down as pure 5 cells mixing at 0.5%-2.5% and 0.001 buys 3 cells mixing at '
  + '0.05%-0.5% for 393 B more — under what a tier surface can paint. Re-derive: node '
  + 'scripts/generate-equilibrium.mjs --quant-table';

/**
 * THE FLAG — V3-PLAN §6's idiom, applied to the one constant this phase's red team broke.
 *
 * §6: "flagged" means named in `constants`, labelled in the Method view, and bounded by a gate. It
 * ships in the payload's `baselineQuant` entry (`kind: 'estimate'`, beside the anchor) AND in the
 * shared-core block as `quantFlag`, so LITE carries the admission too — a page that renders the
 * step without it would render an opinion as if it were checked, which is the P1 finding
 * `flagProblems` exists to stop. The badge is `UNANCHORED['baselineQuant']` in src/shell.html, and
 * the bound is I36 clause (e), which this string names so a reader can go and check it.
 *
 * It is deliberately about the CHOICE and not about the table: the table is measured, re-derivable
 * and now asserted every run. Calling the measurement an estimate would be as dishonest in one
 * direction as calling the choice a measurement was in the other.
 */
export const QUANT_FLAG = 'FLAGGED, not anchored — V3-PLAN §6, after the P3 red team returned 6 of '
  + '6 unanchorable (docs/refutations/P3.md). The table above is measured and now BINDING: gate I36 '
  + 'clause (e) re-derives it from the shipped strategies every run and refuses an unpriced step, a '
  + 'misquoted figure, or a block that is not that quantization. What stays opinion is WHICH priced '
  + 'step: 0.05 and 0.001 are priced too, and "under what a tier surface can paint" is a judgment '
  + 'nothing measures. That choice IS baselineQuant, and the estimate badge is on it.';

/**
 * THE HU COVERAGE MAP's positive half: the three (pos, node) pairs of the page's twenty-four that
 * the solved two-seat tree actually answers, and the tier each solved action maps to.
 *
 * The mapping is EXACT, not an interpretation, and that is worth stating because it is the reason
 * this block can exist at all. `policy.mjs`'s TIER_LABELS give each node's actions by name:
 *
 *   rfi     T1 RAISE   T2 RAISE (exploit)   T3 —      T4 MIX   T5 FOLD
 *   raise   T1 3-BET   T2 3-BET (vs loose)  T3 CALL   T4 MIX   T5 FOLD
 *   3bet    T1 4-BET   T2 AMBUSH CALL       T3 CALL   T4 MIX   T5 FOLD
 *
 * and the tree's three page-visible nodes offer exactly those actions:
 *
 *   n1  SB, {fold, raise}          = the open              -> (SB, rfi)
 *   n2  BB, {fold, call, raise}    = facing the open       -> (BB, raise), raiser SB
 *   n3  SB, {fold, call, raise}    = facing BB's 3-bet     -> (SB, 3bet)
 *
 * WHAT HAS NO ANALOGUE, said out loud rather than left to be noticed: **T2**. The model's T1/T2
 * split is the EXPLOIT split — aggressive here but not at the reference table — which is a
 * statement about two model settings, not about one equilibrium. A solved strategy has no reference
 * table to differ from, so no baseline cell is ever T2, and a vs-GTO comparison must read T1 and T2
 * as the same aggressive level or it will report a disagreement that is an artefact of the model's
 * own vocabulary. Nodes **n4** (BB facing the 4-bet) and **n5** (SB facing the cap) are solved and
 * shipped in the full artifact, but the page has no `vs 4-bet` or `vs 5-bet` node to render them
 * at, so they are absent from this map rather than folded into one that exists.
 */
export const HU_NODES = Object.freeze([
  Object.freeze({
    pos: 'SB', node: 'rfi', treeNode: 'n1', actor: 'SB',
    actions: Object.freeze(['fold', 'raise']),
    tierOf: Object.freeze({ fold: 'T5', raise: 'T1' }),
    what: 'the open — SB on the button raises to the pot-limit maximum 3bb or folds',
  }),
  Object.freeze({
    pos: 'BB', node: 'raise', treeNode: 'n2', actor: 'BB', raiser: 'SB',
    actions: Object.freeze(['fold', 'call', 'raise']),
    tierOf: Object.freeze({ fold: 'T5', call: 'T3', raise: 'T1' }),
    what: 'facing the 3bb open — fold, call, or 3-bet to 9bb',
  }),
  Object.freeze({
    pos: 'SB', node: '3bet', treeNode: 'n3', actor: 'SB',
    actions: Object.freeze(['fold', 'call', 'raise']),
    tierOf: Object.freeze({ fold: 'T5', call: 'T3', raise: 'T1' }),
    what: "facing BB's 9bb 3-bet — fold, call, or 4-bet to 27bb",
  }),
]);

/** the named reason every seat the solved tree does not contain renders with (§3.3, adjudication 8) */
export const NOT_HU_REASON = 'baseline is HU';

/**
 * §5.7's labeling split, DERIVED FROM THE SEAT COUNT rather than typed beside the payload.
 *
 * V3-PLAN §3.3: "Labeling per brief §5.7, on-screen: HU is 'GTO'; anything multiway is 'self-play
 * fixed point'." That is a rule about how many seats were solved, so the shipped datum is the seat
 * list and the label follows from it — the same discipline `labelFor(source)` applies to the
 * Grade-C caveat, and for the same reason: a label typed beside data it is supposed to describe
 * outlives the data.
 *
 * Today it returns `'GTO'`, and the multiway arm has never been taken because nothing multiway has
 * been solved (the re-opening rule's leg (ii) fails at HEAD). The arm exists anyway so the day a
 * multiway surface ships it cannot be labelled "GTO" by omission, and the gate arms against exactly
 * that: a fabricated six-seat block must read `'self-play fixed point'`.
 */
export function domainLabelFor(seats) {
  const n = Array.isArray(seats) ? seats.length : 0;
  if (n === 2) return 'GTO';
  return n > 2 ? 'self-play fixed point' : null;
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// =================================================================================================
// THE SHIPPED SURFACES — what I35's disclosure clauses walk, and where they find them
// =================================================================================================

/**
 * The solver-constants block as it is stamped into `model.constants.solver`.
 *
 * Built from `cfr.mjs`'s CONSTANTS array and from nothing else, which is the point: V3-PLAN §6's
 * third leg (docs/refutations/P2.md finding 6) is that a constant must be RENDERED where a reader
 * can audit it, and the Method view renders `model.constants` generically — so the way to satisfy
 * it is to put the solver's own numbers in that object, not to write a second copy of them into the
 * page. I35's `constantsBlockProblems` reads the block back and fails on any disagreement, so the
 * two cannot drift; this function is the only writer.
 *
 * The ANCHORS ride along in `anchors`, keyed by the same short names. §6's contract for a constant
 * is "anchored, or flagged unanchorable and gated", and an anchor that lives only in a source
 * comment is not on the page. Every one of these is `anchored` or `identity` — this module ships no
 * unanchored number, which is why none of them carries an `estimate` badge.
 */
export function solverBlock(list = CONSTANTS) {
  const out = {};
  const anchors = {};
  for (const c of list) {
    const short = c.name.slice(c.name.indexOf('.') + 1);
    out[short] = c.value;
    anchors[short] = { unit: c.unit, kind: c.kind, anchor: c.anchor };
  }
  out.anchors = anchors;
  return out;
}

/**
 * Read `const MODEL = {...};` back out of a built page.
 *
 * `build.mjs` writes the injected data region as exactly that one line, between its own markers, so
 * this is a parse rather than a scrape. It matters that the gates can do it: D10 greps the artifact
 * for what must not be there, and this is the other half — reading what IS there, as the page will
 * see it, so a constants block that reached `data/model.json` but not the artifact is caught.
 */
export function pageModel(text) {
  const m = /^const MODEL = (\{.*\});$/m.exec(text);
  return m ? JSON.parse(m[1]) : null;
}

/** the same, for the full-only equilibrium payload */
export function pageEquilibrium(text) {
  const m = /^const EQUILIBRIUM = (\{.*\});$/m.exec(text);
  return m ? JSON.parse(m[1]) : null;
}

/**
 * Every shipped surface I35's disclosure clauses have to walk, gathered in ONE place.
 *
 * Until P3 there were none, and I35 said so — "0 on-screen lists exist to check", "0 shipped
 * constants blocks to check" — with its detectors armed against fabricated violators. This is the
 * function that makes those counts non-zero, and gathering them here rather than inside the gate is
 * deliberate: the gate asserts, this enumerates, and `test/equilibrium.test.mjs` can hand the gate
 * a fabricated surface by overriding `opts` without reaching into the filesystem.
 *
 * Three kinds, matching the three clauses:
 *
 *   constants   `[where, block]` — I35's constants clause, `constantsBlockProblems`
 *   capLists    `[where, list]`  — I35 clause (e), `capListProblems`
 *   labels      `[where, {source, label}]` — I35 clause (f), `labelProblems`
 *
 * `where` is a path, because a failure that does not say WHICH shipped copy disagreed sends the
 * reader to check all of them.
 */
export function shippedSurfaces(opts = {}) {
  const files = opts.files || {};
  const read = (p) => {
    if (Object.prototype.hasOwnProperty.call(files, p)) return files[p];
    const abs = resolve(ROOT, p);
    try { return readFileSync(abs, 'utf8'); } catch { return null; }
  };
  const constants = [];
  const capLists = [];
  const labels = [];

  const addModel = (where, model) => {
    if (!model) return;
    if (model.constants && model.constants.solver) constants.push([`${where} constants.solver`, model.constants.solver]);
    const bt = model.baselineTiers;
    if (bt) {
      if (bt.caps && bt.caps.omitted) capLists.push([`${where} baselineTiers.caps`, bt.caps.omitted]);
      labels.push([`${where} baselineTiers`, bt]);
    }
  };
  const addEq = (where, eq) => {
    if (!eq) return;
    if (Array.isArray(eq.constants)) constants.push([`${where} constants`, solverBlock(eq.constants)]);
    if (eq.caps && eq.caps.omitted) capLists.push([`${where} caps`, eq.caps.omitted]);
    if (eq.payoff) labels.push([`${where} payoff`, eq.payoff]);
  };

  const modelText = read('data/model.json');
  if (modelText) addModel('data/model.json', JSON.parse(modelText));
  const eqText = read(ARTIFACT);
  if (eqText) addEq(ARTIFACT, JSON.parse(eqText));
  for (const page of opts.pages || ['index.html', 'index-full.html']) {
    const text = read(page);
    if (text === null) continue;
    addModel(page, pageModel(text));
    addEq(page, pageEquilibrium(text));
  }
  return { constants, capLists, labels };
}

/**
 * The hash of the source that produces the payload: this module, the generator, and the solver.
 *
 * Same construction and same reasoning as `checkdown-matrix.mjs`'s `sourceHash` — a payload is
 * reproducible from its inputs only if the code that consumed them has not moved, so the artifact
 * records which code that was, and `test/equilibrium.test.mjs` recomputes it every run — NOT D9,
 * which reads the artifact's bytes and its injected copy but never re-hashes this source (P3 red
 * team, docs/refutations/P3.md). `cfr.mjs` is in the hash because it
 * IS the solve; `payoff.mjs` and `checkdown-matrix.mjs` are not, because their own artifact already
 * carries a `generatorHash` that this payload references by content hash.
 */
export function sourceHash() {
  const self = readFileSync(resolve(HERE, 'equilibrium.mjs'), 'utf8');
  const gen = readFileSync(resolve(ROOT, GENERATOR), 'utf8');
  const cfr = readFileSync(resolve(HERE, 'cfr.mjs'), 'utf8');
  return sha256(`${self}\n${gen}\n${cfr}`);
}

/**
 * The payload's content hash — `verify.mjs`'s `meta.hash` idiom, with ONE documented exclusion.
 *
 * `meta.buildMs` is blanked as well as `meta.contentHash`. Wall time is a property of the machine
 * and not of the repository (the same sentence the registry's soft wall-time ceiling is written
 * under), so a hash that included it would change on every regeneration for a reason that is not
 * about the payload. §3.3's task list asks the artifact to carry its wall time, so it carries it —
 * and the determinism claim is made about everything else, explicitly, rather than quietly dropped.
 */
export function contentHash(payload) {
  const meta = { ...payload.meta, contentHash: '', buildMs: 0 };
  return sha256(JSON.stringify({ ...payload, meta }));
}

/** canonical serialisation: one line, hash stamped in, exactly what the generator writes */
export function serialize(payload) {
  const stamped = { ...payload, meta: { ...payload.meta, contentHash: contentHash(payload) } };
  return JSON.stringify(stamped);
}

// =================================================================================================
// the strategy, as it ships
// =================================================================================================

/**
 * The averaged strategy at every infoset, at FULL double precision.
 *
 * Not quantized, and the difference between this and `model.baselineTiers` is the whole point of
 * having two payloads: the full artifact is the solve, and a solve written down to three decimals is
 * a different object that happens to look similar. `JSON.stringify` emits the shortest decimal that
 * round-trips a double, so this reconstructs bit-identically — the frequencies reported beside it
 * can therefore be RE-DERIVED from the shipped strategy rather than trusted, which is what makes
 * them checkable.
 */
function strategyOf(avg) {
  const out = {};
  for (const k of Object.keys(avg)) out[k] = Array.from(avg[k]);
  return out;
}

/**
 * The combo-weighted action frequencies, RE-DERIVED from the shipped strategy and the shipped
 * chance measure rather than copied from the solve.
 *
 * `cfr.mjs` computes the same seven numbers internally, and this recomputes them from what the
 * artifact actually contains. If the two ever disagree, the artifact does not say what the solve
 * said — which is exactly the failure a payload should be able to detect about itself, and D9's
 * clause is what detects it.
 */
export function frequenciesFrom(strategy, q, K) {
  const w = (arr, N, a) => { let s = 0; for (let i = 0; i < K; i++) s += q[i] * arr[i * N + a]; return s; };
  return {
    sbOpen: w(strategy.n1, 2, 1), sbFoldN1: w(strategy.n1, 2, 0),
    bbFoldVsOpen: w(strategy.n2, 3, 0), bbCallVsOpen: w(strategy.n2, 3, 1), bb3bet: w(strategy.n2, 3, 2),
    sb4bet: w(strategy.n3, 3, 2), bbCap: w(strategy.n4, 3, 2),
  };
}

// =================================================================================================
// the quantized shared-core block
// =================================================================================================

/**
 * Quantize one infoset's mixed strategy to integer multiples of `quant`, SUM-PRESERVING.
 *
 * Round each weight to the nearest step, then push the whole rounding error onto the largest
 * component so the integers sum to exactly `1/quant`. That last step is not cosmetic: the sum is
 * the block's own checkable invariant (D6 measures the bytes, but a reader — and gate I36 — checks
 * that a strategy still sums to one), and independent rounding breaks it on about a third of the
 * cells. Pushing the residue onto the LARGEST component is the choice that cannot flip a pure
 * strategy to mixed or a mixed one's argmax.
 */
export function quantizeRow(weights, quant) {
  const steps = Math.round(1 / quant);
  const out = weights.map((x) => Math.round(x * steps));
  let sum = out.reduce((s, x) => s + x, 0);
  if (sum !== steps) {
    let bi = 0;
    for (let i = 1; i < out.length; i++) if (out[i] > out[bi]) bi = i;
    out[bi] += steps - sum;
    sum = steps;
  }
  return out;
}

/**
 * The tier a quantized row reads as — the ONE derivation in this file, and it introduces no
 * constant of its own.
 *
 *   more than one non-zero step  ->  T4 (MIX)
 *   otherwise                    ->  the tier of the single action carrying all the weight
 *
 * "More than one non-zero step" is a statement about `baselineQuant` and nothing else: at 0.01 a
 * strategy that plays an action less than half a percent of the time is written down as pure, and
 * that threshold IS the quantization step rather than a second opinion sitting on top of it. The
 * model's own MIX band (`constants.t4Band`) is deliberately NOT reused here — it is a frequency
 * MASS band over a tier cut, a different object, and borrowing it would import a scoring-layer
 * opinion into a solved strategy.
 */
export function tierOfRow(steps, tierOf, actions) {
  const live = [];
  for (let a = 0; a < steps.length; a++) if (steps[a] > 0) live.push(a);
  if (live.length !== 1) return 'T4';
  return tierOf[actions[live[0]]];
}

/**
 * The full (pos, node) coverage table — all `POSITIONS × NODES`, every row saying whether the
 * baseline answers it and, when it does not, WHY in the words §3.3 fixes.
 *
 * Built over the page's own vocabulary rather than over the solver's, so a node the page gains
 * later shows up here as uncovered rather than as absent. That is the difference between a map and
 * a list of what happened to be solved.
 */
export function coverageMap() {
  /* A PROTOTYPE-LESS PLAIN OBJECT, not a Map, and the reason is I33 clause (g) — which flagged the
     Map this used to be, correctly. (g)'s detector looks for a cache being consulted (`new Map(`,
     `.get(`, `.has(`) with a KEY BEING BUILT beside it, because that is the shape of a payoff memo
     with a key missing `ip`; a `Map` keyed on a template literal a few lines from a payoff import
     is indistinguishable from one. `checkdown-matrix.mjs`'s `indexOf` carries the same note for the
     same reason: a gate should not have to tell a lookup table from a cache by reading intent, so
     the lookup is written in the form that is not a cache. */
  const covered = Object.create(null);
  for (const h of HU_NODES) covered[h.pos + '|' + h.node] = h;
  const out = [];
  for (const pos of POSITIONS) {
    for (const node of NODES) {
      const h = covered[pos + '|' + node];
      out.push(h
        ? { pos, node, covered: true, treeNode: h.treeNode, actor: h.actor, what: h.what,
          ...(h.raiser ? { raiser: h.raiser } : {}) }
        : { pos, node, covered: false, reason: NOT_HU_REASON });
    }
  }
  return out;
}

/**
 * THE QUANTIZED `nodes` TABLE — the only part of the shared-core block the step actually touches,
 * built from a strategy map and the live-cell order and from nothing else.
 *
 * Factored out of `buildBaselineTiers` so that ONE piece of code produces it in all three places
 * that need it: the generator writing the block, `quantizationTable()` pricing the steps either
 * side, and gate I36 clause (e) re-measuring both from the SHIPPED artifact. That last one is why
 * the signature takes a plain `{ nodeId: number[] }` map rather than a solver run — the gate has
 * `data/equilibrium.json`'s full-precision strategies and no run, and a second implementation
 * reading them would only prove the two copies agree with each other.
 *
 * @param {Record<string, ArrayLike<number>>} strategy  per tree node, K x actions weights
 * @param {string[]} order                              the live cells, in the block's own order
 * @param {number} quant                                the step
 */
export function quantizedNodes(strategy, order, quant) {
  const K = order.length;
  const nodes = {};
  for (const h of HU_NODES) {
    const N = h.actions.length;
    const arr = strategy[h.treeNode];
    const w = [];
    const tiers = [];
    for (let i = 0; i < K; i++) {
      const steps = quantizeRow(Array.from(arr.slice(i * N, i * N + N)), quant);
      for (const s of steps) w.push(s);
      tiers.push(tierOfRow(steps, h.tierOf, h.actions));
    }
    nodes[`${h.pos}|${h.node}`] = {
      treeNode: h.treeNode, actor: h.actor, actions: [...h.actions],
      ...(h.raiser ? { raiser: h.raiser } : {}),
      tierOf: { ...h.tierOf },
      w, tiers,
    };
  }
  return nodes;
}

/**
 * The shared-core block: `model.baselineTiers`.
 *
 * §5.3's one allowed shared-core addition, and the thing that buys LITE a tier-level vs-GTO colour
 * mode. Everything a reader needs to render that mode HONESTLY is in here as data:
 *
 *   `source` / `label`   I35 clause (f): the "a game where postflop does not exist" caveat is
 *                        derived from the shipped `source` datum, never from prose and never from
 *                        `supported`.
 *   `caps`               I35 clause (e): the on-screen cap list must match the solver's actual
 *                        tree, and this is the datum it is derived from.
 *   `coverage`           adjudication 8: twenty-one of the twenty-four (pos, node) pairs render
 *                        disabled with the named reason, and the reason is here rather than in the
 *                        page's source.
 *   `quant`              §6: the constant, shipped beside the data it quantizes, with its anchor.
 *
 * ONE DEPTH, and it is stated rather than implied: the block ships the 100bb solve, because 100bb
 * is the model's own reference depth (`constants.depth.ref`) and the shared core has no depth axis
 * to key a second table on. The 40bb solve ships in the full artifact. `depthCaveat` records what
 * that means for a reader who has moved the depth dial, so the UI step renders a caveat rather than
 * a silently wrong comparison.
 */
export function buildBaselineTiers(run, model, quant = BASELINE_QUANT) {
  const nodes = quantizedNodes(strategyOf(run.avg), run.live, quant);
  return {
    source: run.source,
    label: run.label,
    domain: 'heads-up',
    seats: ['SB', 'BB'],
    domainLabel: domainLabelFor(['SB', 'BB']),
    stack: run.tree.stack,
    depthRef: model.constants && model.constants.depth ? model.constants.depth.ref : null,
    depthCaveat: 'the solved baseline is the 100bb tree, the model\'s own reference depth '
      + '(constants.depth.ref). The depth dial moves the MODEL\'s tiers and does not move this '
      + 'baseline: a vs-GTO comparison away from 100bb is comparing a depth-adjusted model against '
      + 'a 100bb equilibrium, and must say so.',
    solver: {
      route: run.route, iters: run.iters, initSeed: run.seed, payoffSeed: String(run.payoffSeed),
      exploitabilityBB: run.eps, valueBB: run.value,
    },
    matrix: { artifact: MATRIX_ARTIFACT, seeds: [...SEEDS], boards: BOARDS },
    caps: { modelled: [...CAPS.modelled], omitted: [...CAPS.omitted] },
    quant,
    quantAnchor: QUANT_ANCHOR,
    quantFlag: QUANT_FLAG,
    encoding: 'per (pos|node): `w` is one integer per (cell, action) in `order` x `actions` order, '
      + 'in steps of `quant`, summing to 1/quant per cell; `tiers` is the tier that row reads as '
      + '(more than one non-zero step = T4 MIX, otherwise `tierOf[action]`). T2 never appears: it '
      + 'is the model\'s exploit split against its own reference table, and a solved strategy has '
      + 'no reference table to differ from.',
    order: [...run.live],
    nodes,
    coverage: coverageMap(),
    notCovered: NOT_HU_REASON,
  };
}

// =================================================================================================
// I36's detectors — the equilibrium anchors, SCOPED TO THE MEASUREMENT
// =================================================================================================

/**
 * One cell's reading out of the shared-core block: its quantized weights, the action carrying most
 * of them, and the tier it was written down as.
 *
 * `argmax` is what the anchor clauses turn on rather than the tier, and the difference matters at
 * exactly one place: a T4 (MIX) cell still has a most-played action, and "AA_BIGPAIR x DS opens"
 * should be true of a cell that raises 97% and calls 3% — the mix is not a failure to open. Ties
 * resolve to the EARLIER action, which is the conservative direction: `actions` is ordered
 * fold-first, so a true 50/50 between fold and raise reads as fold and an "it opens" clause fails
 * on it rather than passing on a coin flip.
 */
export function readingAt(block, nodeKey, cell) {
  const n = block.nodes && block.nodes[nodeKey];
  if (!n) return null;
  const i = block.order.indexOf(cell);
  if (i < 0) return null;
  const N = n.actions.length;
  const w = n.w.slice(i * N, i * N + N);
  let bi = 0;
  for (let a = 1; a < N; a++) if (w[a] > w[bi]) bi = a;
  return { cell, node: nodeKey, weights: w, argmax: n.actions[bi], tier: n.tiers[i], steps: Math.round(1 / block.quant) };
}

/**
 * THE TWO ANCHORS §7.2 NAMES, SCOPED TO THE SEATS THAT EXIST.
 *
 * §7.2's I36 row reads: "AA_BIGPAIR x DS opens everywhere; TRASH x RB never opens UTG; emergent
 * positional nesting UTG subset HJ subset CO subset BTN". The solved tree has two seats, so:
 *
 *   "opens everywhere"    becomes "opens at SB, the only seat that opens", plus the companion the
 *                         two-seat tree DOES give us — it continues against the open at BB, and
 *                         4-bets facing the 3-bet at SB. Three readings where six seats would have
 *                         given more, and the clause says how many it had.
 *   "never opens UTG"     has NO UTG. Scoped to the seat that exists it becomes a STRONGER claim,
 *                         not a weaker one: SB is the button and the loosest opening seat in the
 *                         game, so "does not open even here" implies "does not open at UTG" under
 *                         any monotone reading of position. What is asserted is what was measured;
 *                         what UTG would have done is recorded as not measurable.
 *   positional nesting    is not here at all — see `nestingReadiness`.
 *
 * A NOTE ON THE LAUNCH BLOCK'S EXPECTATION, because it was falsified and the falsification is the
 * finding. P3's launch expected TRASH x RB to OPEN at SB, reasoning from S-A's 89.3% opening
 * frequency. It does not: it folds, purely. 88.86% is a COMBO-WEIGHTED frequency over 123 cells,
 * and the ~11% it does not open is not spread thinly — it is the bottom of the range, and TRASH|RB
 * is in it. So the model's own clause is CORROBORATED rather than contradicted in the one seat
 * where it can be read, and the gate asserts the measurement rather than the expectation.
 */
export function anchorProblems(block) {
  const out = [];
  const need = (nodeKey, cell, want, why) => {
    const r = readingAt(block, nodeKey, cell);
    if (!r) { out.push(`${cell} has no reading at ${nodeKey} — the anchor cannot be measured`); return null; }
    if (want === 'raise' && r.argmax !== 'raise') {
      out.push(`${cell} at ${nodeKey} plays ${r.argmax} (${r.weights.join('/')} of ${r.steps}, tier ${r.tier}) — ${why}`);
    }
    if (want === 'continue' && r.argmax === 'fold') {
      out.push(`${cell} at ${nodeKey} folds (${r.weights.join('/')} of ${r.steps}, tier ${r.tier}) — ${why}`);
    }
    if (want === 'fold' && r.argmax !== 'fold') {
      out.push(`${cell} at ${nodeKey} plays ${r.argmax} (${r.weights.join('/')} of ${r.steps}, tier ${r.tier}) — ${why}`);
    }
    return r;
  };
  need('SB|rfi', 'AA_BIGPAIR|DS', 'raise',
    '§7.2\'s "AA_BIGPAIR x DS opens everywhere", scoped to the one seat that opens');
  need('BB|raise', 'AA_BIGPAIR|DS', 'continue',
    'the best hand in the deck must continue against a 3bb open');
  need('SB|3bet', 'AA_BIGPAIR|DS', 'raise',
    'the best hand in the deck must 4-bet facing a 9bb 3-bet');
  need('SB|rfi', 'TRASH|RB', 'fold',
    '§7.2\'s "TRASH x RB never opens UTG", scoped to SB — the button, the LOOSEST opening seat in '
    + 'the game, so this is the stronger reading rather than the weaker one');
  return out;
}

/**
 * THE NESTING CLAUSE, AND WHY IT IS RECORDED RATHER THAN PASSED.
 *
 * §7.2 predicts "nesting fails at some seat pair" and calls the prediction expected-falsified. It is
 * NOT TESTABLE this milestone, and the reason is the one V3-PLAN §3.3's Adjudicated block froze in
 * `cfr.mjs`'s `SIXMAX.reopenVerdict` after evaluating the re-opening rule by measurement: the
 * solved tree has exactly two seats, so there is no UTG/HJ/CO/BTN nesting for an equilibrium to
 * exhibit or to violate. The I15 precedent — a clause scoped to what was measured, never toleranced
 * into a pass.
 *
 * This returns the READINESS rather than a verdict, so the gate can report "not measurable, for
 * this reason" and can also FAIL if the reason stops being true: the day a payload covers a third
 * seat, `measurable` flips and the clause is owed a real measurement instead of this note.
 */
export function nestingReadiness(block) {
  const seats = [...new Set((block.coverage || []).filter((r) => r.covered).map((r) => r.pos))].sort();
  const chain = ['UTG', 'HJ', 'CO', 'BTN'];
  const present = chain.filter((p) => seats.includes(p));
  return {
    seats,
    chain,
    present,
    measurable: present.length >= 2,
    reason: present.length >= 2
      ? `${present.length} of the nesting chain's seats are covered — the clause is measurable and owes a measurement`
      : 'the solved tree has exactly two seats, SB and BB, so there is no UTG/HJ/CO/BTN nesting for '
        + 'an equilibrium to exhibit or to violate — scoped to the measurement (the I15 precedent), '
        + 'never toleranced',
  };
}

/**
 * THE POST-PASSES, MEASURED AGAINST THE EQUILIBRIUM — §3.3's own question, and §14 item 4's.
 *
 * §3.3: "the post-passes (nesting, suit monotonicity) are impositions an equilibrium may violate,
 * and a violation is a finding to report, not launder". So this counts them, on the SOLVED tiers,
 * using `policy.mjs`'s own orderings:
 *
 *   suit monotonicity  adding suitedness never demotes, scanning the model's `cols` in order
 *   AA-band            tier(AA_BIGPAIR) >= ... >= tier(A_BLOCKED) down the band, per column
 *
 * Both are ENFORCED on the model's display by `postPasses()`; neither is enforced here, because
 * enforcing them on a solved strategy is exactly the laundering §3.3 forbids. What comes out is a
 * count and a list, and the list is what the display decision is made on.
 */
export function postPassFindings(block, rows, cols, rank) {
  const colKeys = cols.map((c) => (typeof c === 'string' ? c : c.key));
  const rowKeys = rows.map((r) => (typeof r === 'string' ? r : r.key));
  const tierAt = (nodeKey, cell) => {
    const r = readingAt(block, nodeKey, cell);
    return r ? r.tier : null;
  };
  const suit = [];
  const aa = [];
  for (const nodeKey of Object.keys(block.nodes)) {
    for (const row of rowKeys) {
      let prev = null, prevCol = null;
      for (const col of colKeys) {
        const t = tierAt(nodeKey, `${row}|${col}`);
        if (t === null) continue;
        if (prev !== null && rank[t] < rank[prev]) suit.push(`${nodeKey} ${row} ${prevCol}->${col} ${prev}->${t}`);
        prev = t; prevCol = col;
      }
    }
    for (const col of colKeys) {
      let prev = null, prevRow = null;
      for (const row of AA_BAND) {
        const t = tierAt(nodeKey, `${row}|${col}`);
        if (t === null) continue;
        if (prev !== null && rank[t] > rank[prev]) aa.push(`${nodeKey} ${col} ${prevRow}->${row} ${prev}->${t}`);
        prev = t; prevRow = row;
      }
    }
  }
  return {
    readings: Object.keys(block.nodes).length * block.order.length,
    suitMonotonicity: { violations: suit, count: suit.length },
    aaBand: { violations: aa, count: aa.length },
    note: 'measured on the SOLVED tiers, never enforced on them: the post-passes are display '
      + 'impositions (policy.mjs postPasses) and an equilibrium is entitled to violate them. '
      + 'V3-PLAN §3.3 and §14 item 4.',
  };
}

/** the AA band's strength order, the same list `policy.mjs`'s post-pass walks */
const AA_BAND = ['AA_BIGPAIR', 'AA_BROADWAY', 'AA_CONNECTED', 'AA_SMALLPAIR', 'AA_DANGLER', 'A_BLOCKED'];

/**
 * Does a RECORDED post-pass finding describe the tiers it ships beside?
 *
 * The failure this catches is the one that actually happens: the tiers are regenerated, the record
 * is not, and the artifact goes on stating a violation count from a previous solve. Comparing the
 * record against a re-derivation is the whole check, and it is why the record lives in
 * `data/equilibrium.json` while the tiers it describes live in `model.baselineTiers` — two
 * artifacts, one derived from the other, cross-checked by a gate that reads both.
 */
export function postPassRecordProblems(record, derived) {
  const out = [];
  if (!record || typeof record !== 'object') return ['the post-pass finding is missing from the payload'];
  for (const half of ['suitMonotonicity', 'aaBand']) {
    const r = record[half], d = derived[half];
    if (!r) { out.push(`the payload records no ${half} finding`); continue; }
    if (r.count !== d.count) {
      out.push(`the payload records ${r.count} ${half} violations but the shipped tiers have ${d.count}`);
      continue;
    }
    const a = [...(r.violations || [])].sort().join(' | ');
    const b = [...d.violations].sort().join(' | ');
    if (a !== b) out.push(`the payload's ${half} violations are not the shipped tiers' (${a} vs ${b})`);
  }
  if (record.readings !== derived.readings) {
    out.push(`the payload records ${record.readings} tier readings, the shipped tiers have ${derived.readings}`);
  }
  return out;
}

/**
 * The bytes each candidate quantization costs — `baselineQuant`'s anchor, as a computation.
 *
 * §6's row for this constant reads "the payload bytes it buys, stated at D6's new sub-budget", so
 * the anchor is a table and this is what produces it. It also reports how many cells CHANGE TIER
 * between steps, because bytes alone cannot say whether a coarser step is free: a step that rounds
 * a genuinely mixed cell to pure buys its bytes by making the page paint a disagreement the
 * equilibrium does not make.
 *
 * `dataBytes` IS THE ANCHOR COLUMN, and `blockBytes` is reported beside it. The distinction is not
 * pedantry — it is what keeps the anchor from being circular. The block carries `quantAnchor`, a
 * prose field quoting this very table, so a table measured on the WHOLE block would be measuring a
 * quantity that moves when its own description is edited. `nodes` is the only part of the block the
 * quantization touches, so that is what the constant is anchored to; the whole-block figure is what
 * D6's sub-budget binds, and D6 prints it.
 */
export function quantizationTable(run, model, quants = [0.05, 0.01, 0.001]) {
  const rows = [];
  let prev = null;
  for (const q of quants) {
    const block = buildBaselineTiers(run, model, q);
    let moved = 0;
    if (prev) {
      for (const key of Object.keys(block.nodes)) {
        const a = prev.nodes[key].tiers, b = block.nodes[key].tiers;
        for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) moved++;
      }
    }
    let mixed = 0;
    for (const key of Object.keys(block.nodes)) mixed += block.nodes[key].tiers.filter((t) => t === 'T4').length;
    rows.push({
      quant: q,
      dataBytes: Buffer.byteLength(JSON.stringify(block.nodes)),
      blockBytes: Buffer.byteLength(JSON.stringify(block)),
      movedVsPrev: moved,
      mixedCells: mixed,
    });
    prev = block;
  }
  return rows;
}

/**
 * The anchor table AS THE SHIPPED ARTIFACT RE-DERIVES IT: every step the shipped `quantAnchor`
 * prices, the figures it quotes for that step, and the figures the shipped strategies actually give.
 *
 * One function so that the assertion (`quantProblems`) and the report (I36's detail line, which
 * prints the table on every run) cannot disagree — the failure mode this whole clause exists to
 * close is a printed number and a checked number drifting apart.
 *
 * The parse is loose about spacing and strict about digits: the anchor is prose a human wrote, and
 * the figures in it are the assertion.
 */
export function quantReadings(block, strategy) {
  const rows = [];
  const re = /(\d*\.\d+|\d+)\s*->\s*([\d,]+)\s*B\s*\/\s*(\d+)\s*MIX/g;
  const anchor = String((block && block.quantAnchor) || '');
  for (let m = re.exec(anchor); m; m = re.exec(anchor)) {
    const quant = Number(m[1]);
    const nodes = quantizedNodes(strategy, block.order, quant);
    let mix = 0;
    for (const k of Object.keys(nodes)) mix += nodes[k].tiers.filter((t) => t === 'T4').length;
    rows.push({
      quant,
      quotedBytes: Number(m[2].replace(/,/g, '')),
      quotedMix: Number(m[3]),
      bytes: Buffer.byteLength(JSON.stringify(nodes)),
      mix,
      shipped: quant === block.quant,
    });
  }
  return rows;
}

/**
 * I36 clause (e)'s detector — THE ANCHOR TABLE, MADE BINDING, and the flag's own legs.
 *
 * THE FINDING THIS ANSWERS (docs/refutations/P3.md, six memos of six). `quantizationTable()` above
 * is honest and nothing ever ran it: only the generator's manual `--quant-table` flag did. So the
 * step could be moved to 0.02 — a value the table does not price — or to 0.5, regenerated honestly,
 * and the repository stayed green; and the anchor's PROSE, which ships into both artifacts and
 * renders beside the value, could be replaced with fabricated figures and shipped green as well.
 * Three refuters independently prescribed the same one assertion, and this is it.
 *
 * WHAT IT ASSERTS, all of it re-derived from what SHIPS and none of it typed here:
 *
 *   1. every step the shipped `quantAnchor` prices is re-measured from the shipped full-precision
 *      strategies, and the bytes and MIX count it quotes must be the measured ones;
 *   2. the shipped step must be one of the steps its own anchor prices;
 *   3. the shipped shared-core block must BE that quantization of those strategies — the two
 *      artifacts are one artifact, and a block regenerated from a different solve than the payload
 *      beside it fails here;
 *   4. the FLAG must ship, and must name the constant and the gate that bounds it — §6's idiom,
 *      the leg `flagProblems` enforces for `constants.rake.flag` in the couplings family.
 *
 * WHAT IT DOES NOT DO, said out loud: it does not make 0.01 the only shippable step. 0.05 and 0.001
 * are priced rows and would pass. That is exactly what the flag admits, and inventing a bound that
 * selected between them would be inventing the anchor the red team just took away.
 *
 * The parse is deliberately loose about spacing and strict about digits: the anchor is prose a human
 * wrote and the figures are the assertion.
 *
 * @param {object} block     the shared-core block (`model.baselineTiers`)
 * @param {object} strategy  the shipped full-precision strategies at the block's own depth
 */
export function quantProblems(block, strategy) {
  const out = [];
  if (!block || !block.nodes || !Array.isArray(block.order)) return ['there is no shared-core block to check'];
  if (!strategy) {
    return [`the payload ships no strategies at T${block.stack}, so the anchor table cannot be re-derived `
      + 'from what ships — and a table re-derived from anything else is not an anchor'];
  }
  const priced = quantReadings(block, strategy);
  if (priced.length < 2) {
    out.push(`the shipped quantAnchor prices ${priced.length} step(s) — §6's row for this constant IS `
      + 'the table, and a table that does not price the alternatives cannot be one');
    return out;
  }
  for (const row of priced) {
    if (row.bytes !== row.quotedBytes) {
      out.push(`the anchor prices step ${row.quant} at ${row.quotedBytes.toLocaleString()} B and the shipped `
        + `strategies quantize to ${row.bytes.toLocaleString()} B`);
    }
    if (row.mix !== row.quotedMix) {
      out.push(`the anchor claims ${row.quotedMix} MIX cells at step ${row.quant}; the shipped strategies give ${row.mix}`);
    }
  }
  const shipped = priced.find((r) => r.quant === block.quant);
  if (!shipped) {
    out.push(`the shipped step ${block.quant} is not one of the steps its own anchor prices `
      + `(${priced.map((r) => r.quant).join(', ')}) — the table IS the anchor, so a step it does not `
      + 'price ships with none');
  } else if (JSON.stringify(quantizedNodes(strategy, block.order, block.quant)) !== JSON.stringify(block.nodes)) {
    out.push('the shared-core block is not the quantization of the shipped strategies at the shipped '
      + 'step — the block and the payload are two different solves');
  }
  const flag = block.quantFlag;
  if (typeof flag !== 'string' || flag.length < 60) {
    out.push('the block ships no quantFlag — baselineQuant is FLAGGED (V3-PLAN §6, docs/refutations/P3.md) '
      + 'and the admission that legitimises it must travel with the data, not sit in a comment');
  } else {
    for (const nm of ['baselineQuant', 'I36']) {
      if (flag.indexOf(nm) < 0) out.push(`the shipped quantFlag does not name ${nm}`);
    }
  }
  return out;
}

// =================================================================================================
// the full artifact
// =================================================================================================

/**
 * How the 7,626-pair matrix ships — MEASURED, then decided, in that order, and measured on the
 * encoding that would still be the same matrix.
 *
 * §3.3's relaunch block defers exactly this to D9: "equilibrium.json carries the primary matrix per
 * §5.3, or a content-hash reference to the artifact if embedding would double the shipped bytes".
 * §5.3's default is EMBED; the reference is the escape, and the escape's condition is a
 * measurement, so the measurement decides.
 *
 * THE MEASUREMENT HAS TO BE TAKEN ON THE FAITHFUL ENCODING, and that is the whole subtlety here.
 * `data/checkdown-matrix.json` stores INTEGER COUNTERS — per pair, `wins2` and `cnt`, from which
 * `E = (wins2/2)/cnt` reconstructs BIT-IDENTICALLY (the division by two is exact). That property is
 * the artifact's own claim and the reason it stores trials rather than results. An embedding that
 * rounded `E` to six decimals would be ~67 KB and would slip under a 2x rule — but it would ship a
 * DIFFERENT MATRIX from the one the solver consumed and the one the artifact commits to, so
 * choosing the rounding to fit the rule is choosing the answer. Three readings are therefore taken
 * and the RULE IS APPLIED TO THE FAITHFUL ONE:
 *
 *   counters   the artifact's own encoding, bit-identical on reconstruction — the only embedding
 *              that ships the same matrix
 *   doubles    `E` at full double precision, also bit-identical, but more expensive than the
 *              counters it is derived from
 *   rounded6   `E` at six decimals — cheaper, and NOT the same matrix; reported so the number that
 *              would have made embedding look affordable is on the record beside the reason it was
 *              not used
 *
 * Gate D9 re-applies the rule every run, so an artifact that embedded above the threshold, or
 * referenced below it, is a decision that stopped matching its own measurement.
 */
export function matrixShipping(matrix, withoutBytes) {
  const NC = matrix.NC;
  const doubles = [], rounded = [];
  for (let i = 0; i < NC; i++) {
    for (let j = i; j < NC; j++) {
      doubles.push(matrix.E[i * NC + j]);
      rounded.push(Number(matrix.E[i * NC + j].toFixed(6)));
    }
  }
  const b = (x) => Buffer.byteLength(JSON.stringify(x));
  /* the artifact's own two integer arrays, off-diagonal only — the diagonal is 0.5 by fiat and
     costs nothing to store, which is exactly why the artifact does not store it */
  const counters = b(Array.from(matrix.raw.wins2)) + b(Array.from(matrix.raw.cnt));
  const options = {
    counters: { bytes: counters, faithful: true, note: 'the artifact\'s own encoding: E = (wins2/2)/cnt reconstructs bit-identically' },
    doubles: { bytes: b(doubles), faithful: true, note: 'E at full double precision' },
    rounded6: { bytes: b(rounded), faithful: false, note: 'E rounded to 6 decimals — CHEAPER AND NOT THE SAME MATRIX' },
  };
  const embedBytes = counters;
  const ratio = (withoutBytes + embedBytes) / withoutBytes;
  return {
    pairs: doubles.length,
    embedBytes,
    withoutBytes,
    ratio,
    options,
    rule: 'V3-PLAN §5.3 embeds by default; §3.3 (deferred to D9) takes a content-hash reference '
      + 'instead if embedding would double the shipped bytes. ratio = (payload + faithful '
      + 'embedding) / payload, where "faithful" is the artifact\'s own integer-counter encoding — '
      + 'the only one that reconstructs the served numbers bit-identically. Reference at ratio >= 2.',
    ships: ratio >= 2 ? 'reference' : 'embedded',
  };
}

/**
 * Solve the baseline and assemble the payload.
 *
 * `payoff` is injected rather than constructed here for the same reason `solveHU` takes one: a
 * module that reached for the process-wide accessor could not be shown to fail, and the gate's
 * arming needs to hand it a fabricated source.
 */
export function buildEquilibrium({ model, payoff, matrixMeta = {}, iters = ITER_CAP, quant = BASELINE_QUANT }) {
  const t0 = Date.now();
  const depths = {};
  const runs = {};
  const spreadRuns = {};
  for (const stack of STACKS) {
    const run = solveHU({
      model, stack, iters, seed: INIT_SEED, payoffSeed: PAYOFF_SEED, payoff, trackFlips: true,
    });
    runs[stack] = run;
    spreadRuns[stack] = solveHU({
      model, stack, iters, seed: INIT_SEED, payoffSeed: SPREAD_SEED, payoff,
    });
    const strategy = strategyOf(run.avg);
    depths[`T${stack}`] = {
      stack,
      tree: {
        ladder: run.tree.sizings.map(Number),
        capAllIn: run.tree.capAllIn,
        nodes: run.tree.nodes.map((n) => ({ id: n.id, actor: n.actor, actions: [...n.actions] })),
        terminals: run.tree.terminals,
        infosetsPerCell: run.tree.infosetsPerCell,
        slotsPerCell: run.tree.slotsPerCell,
      },
      strategy,
      frequencies: frequenciesFrom(strategy, run.q, run.live.length),
      valueBB: run.value,
      brSB: run.brSB,
      brBB: run.brBB,
      exploitabilityBB: run.eps,
      bracketOk: run.bracketOk,
      simplexError: run.simplexError,
      mirrorMax: run.mirrorMax,
      unsupported: run.unsupported,
      lastFlip: run.lastFlip,
      iters: run.iters,
      initSeed: run.seed,
      payoffSeed: String(run.payoffSeed),
      twoSeedSpreadBB: Math.abs(run.value - spreadRuns[stack].value),
      twoSeedSpreadPot: Math.abs(run.value - spreadRuns[stack].value) / PREFLOP_POT_BB,
      secondSampleValueBB: spreadRuns[stack].value,
    };
  }
  const primary = runs[100];

  const payload = {
    meta: {
      kind: 'rundown-v3 equilibrium baseline (heads-up, CFR+, measured pairwise checkdown payoff)',
      synthetic: false,
      plan: 'V3-PLAN §3.3, §5.3; gate D9; gate I36',
      generator: GENERATOR,
      generatorHash: sourceHash(),
      contentHash: '',
      /* THE MODEL PROVENANCE, keyed on what the SOLVE actually read rather than on `meta.hash`.
         `meta.hash` covers the whole file including verify's own `gates` stamp, so it moves every
         time a gate is added or flips — for reasons that have nothing to do with this baseline —
         and a payload asserting equality against it would demand a re-solve after every gate edit.
         What the solve depends on is the cells and the combo total, so that is what is hashed. */
      model: {
        version: model.meta.version,
        cellsHash: sha256(JSON.stringify(model.cells)),
        comboTotal: model.meta.comboTotal,
      },
      buildMs: 0,
      cells: primary.live.length,
      comboTotal: primary.comboTotal,
    },
    /* THE PAYOFF SOURCE DATUM, and the label DERIVED from it. I35 clause (f) reads exactly these
       two fields off the shipped surface: `labelFor(source)` and nothing else decides the label, so
       a surface that keyed it off `supported` — where every heads-up showdown is supported and the
       caveat would silently vanish — fails rather than renders. */
    payoff: {
      source: primary.source,
      label: labelFor(primary.source),
      route: primary.route,
      keys: [...RESULT_KEYS],
      potMult: 1,
      invShare: 0,
      identities: 'potMult === 1 and invShare === 0 are what checkdown IS: the final pot is the '
        + 'preflop pot and nobody invests after it (V3-PLAN §2, the amended six-key contract).',
    },
    /* THE ON-SCREEN CAP LIST's source datum (I35 clause (e)). The list a page renders must be
       derived from this, not typed beside it: the clause checks a candidate list against BOTH the
       declared omissions and the tree the solver actually built. */
    caps: { modelled: [...CAPS.modelled], omitted: [...CAPS.omitted] },
    /* the solver constants, with their anchors, as `cfr.mjs` states them — the same array
       `model.constants.solver` is stamped from, so the two cannot drift (I35's constants clause
       walks both). */
    constants: CONSTANTS.map((c) => ({ ...c })),
    matrix: {
      artifact: MATRIX_ARTIFACT,
      seeds: [...SEEDS],
      primarySeed: PAYOFF_SEED,
      spreadSeed: SPREAD_SEED,
      boards: BOARDS,
      contentHash: matrixMeta.contentHash || null,
      generatorHash: matrixMeta.generatorHash || null,
      shipping: null,        // filled below, once the payload's size without it is known
      validation: null,      // filled by the generator: the residual band, from I33(c)'s own code
    },
    depths,
    coverage: coverageMap(),
    domain: { seats: ['SB', 'BB'], label: domainLabelFor(['SB', 'BB']) },
    /* §6's flagged idiom, and `kind` is the half that moved: the P3 red team returned 6 of 6
       unanchorable against this row's claimed anchor, so it ships `estimate` with the flag beside
       the (still measured, now binding) table. See QUANT_FLAG and gate I36 clause (e). */
    baselineQuant: {
      name: 'baselineQuant', value: quant, unit: 'strategy weight', kind: 'estimate',
      anchor: QUANT_ANCHOR, flag: QUANT_FLAG,
    },
    notes: {
      domain: 'heads-up. The solved tree has exactly two seats, SB (on the button) and BB. '
        + `Every other (pos, node) the page can render carries the named reason "${NOT_HU_REASON}" `
        + 'in `coverage` — see V3-PLAN §3.3\'s adjudication 8 and cfr.mjs\'s SIXMAX record.',
      multiway: 'NONE. No multiway claim is made and no "self-play fixed point" surface exists, '
        + 'because nothing multiway was solved: the re-opening rule\'s leg (ii) fails at HEAD (no '
        + 'measured k-way sampler exists) and cfr.mjs\'s SIXMAX.reopenVerdict records it.',
      label: 'HU is labelled "GTO" — DERIVED from the seat count in `domain`, not typed here '
        + '(V3-PLAN §3.3, brief §5.7) — and, because the payoff `source` is '
        + '\'checkdown\', it is labelled "a game where postflop does not exist" at the same time. '
        + 'The two are not in tension: it is an exact equilibrium OF A GAME IN WHICH POSTFLOP DOES '
        + 'NOT EXIST, and the value being BB-positive is what that looks like.',
    },
  };
  payload.meta.buildMs = Date.now() - t0;
  return { payload, runs, spreadRuns };
}
