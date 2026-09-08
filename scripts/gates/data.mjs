// gates D1 D2 D4 D5 I18 D6 D7 D8 — the data gates.
//
// What the shipped artifact IS, asserted against what it CLAIMS to be: the 270,725-combo
// partition, the structurally empty cells, schema completeness and number formatting, the mosaic
// geometry, the three payload sub-budgets, the V2-PLAN §2.5 ceiling read against the bytes that
// actually get written, and the integrity of the packed villain ordering the Simulate button
// re-cuts. No Monte Carlo: every number here is arithmetic over the model file.
//
// (D3 went with the sub-bucket layer it asserted. D1 already pins sum(cells) === 270,725, which
// is what is left of the dual-key partition claim.)

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { enumerateAll } from '../lib/taxonomy.mjs';
import { cutAt, classTableCanonical } from '../lib/villain-range.mjs';
import { ORDER_BITS, unpackOrder, orderHash, permutationProblem } from '../lib/order-pack.mjs';
import { VARIANTS, VARIANT_NAMES, stripOnlyBlocks } from '../lib/variant.mjs';
import { compileShellScripts } from '../lib/shell-compile.mjs';
import { BLOCKS, blockCensus, pageCensus } from '../lib/block-census.mjs';
import { ROOT, TOTAL, REF_MATRIX, REF_ORDER } from './_shared.mjs';

export const family = 'data';
export const title = 'the partition, the schema, the geometry, the payload budgets, the shipped villain order';
export const ids = ['D1', 'D2', 'D4', 'D5', 'I18', 'D6', 'D7', 'D8'];
export const setupLabel = 'enumerateAll()';

// ---------------------------------------------------------------------------
// D6's FROM-ABOVE CLAUSE on the page's byte ceilings (v3 release consolidation, 2026-09-05).
//
// The first of the two repairs the P5 red team wrote down and did not take (docs/refutations/P5.md
// §3, "The byte budgets are anchored from below and open from above"): every ceiling in
// scripts/lib/variant.mjs is refused DOWNWARD by the build — a page over its cap does not build —
// and until this clause nothing refused a cap UPWARD. `app` at 460 KB and at 512 KB shipped
// completely green, and a kilobyte moved from `gto`'s cap to `topn`'s left `topn` at measured
// +23.9 % with every gate passing. The only shipped statement about the +5 % rule was a regex on
// prose (`assert.match(budgetSource, /5%/)`).
//
// WHAT IS ASSERTED. For every ceiling that has a DOCUMENTED margin, that the ceiling is not looser
// than that margin over the build's own measured bytes, in the idiom every derivation in
// METHODOLOGY §9.11 spells out — measured × (1 + margin), rounded UP to the whole KB:
//
//     cap  <=  ceil(measured × factor / 1024) × 1024
//
// The margins are read out of the documents, never chosen here, and each row cites where:
//
//   total      +5 %   "Each budget below is that measurement plus about 5%, rounded" (build.mjs
//                     :470, the phase-4 retune: TOTAL 600 KB at :485); METHODOLOGY §9.11:2363 ("Page
//                     and app sit at the finished measurement plus about 5 %"); full's 660 KB is
//                     "held at +1.1% ... DELIBERATELY far below the 686K a fresh measured+5% would
//                     give" (variant.mjs:224; METHODOLOGY:2632). A bound at +5 % is the rule both
//                     rows claim to sit at or under.
//   app        +5 %   "398K is measured + 1.1%, far under the +5% this rule would allow (413K)"
//                     (variant.mjs:159); the P3 derivation "+5 % is 387.6, rounded up to the whole
//                     KB: 388 KB" (METHODOLOGY §9.11:2522) and the P5 readings at :2589 and :2620.
//   appCore    +5 %   the pre-raise app ceiling (variant.mjs:104), i.e. the 360 KB the phase-4
//                     retune set as "APP 360 KB ... Measured 344.8, headroom 4.4%" under the same
//                     "plus about 5%, rounded" rule (build.mjs:470, :489; METHODOLOGY §9.11:2363).
//                     The house rule this bound enforces is METHODOLOGY:254 — "a removal that does
//                     not move the ceiling has not been paid back".
//   modelCode  +8 %   "DELIBERATELY BELOW the 8% margin this gate was calibrated with" (variant.mjs
//                     :119, :136); "measurement plus about 8%, the margin this gate was originally
//                     calibrated with. Left at 8% rather than trimmed to 5%" (build.mjs:499);
//                     METHODOLOGY §9.11:2412. NOT 5 %: the document says 8 and says why.
//   blocks     +5 %   "a per-block ceiling at measured+5%" (variant.mjs:140); "`budgets.blocks`
//                     fixes it, at measured+5 % rounded up to the whole KB" (METHODOLOGY §9.11
//                     :2569), topn at :2600, calib at :2636.
//
// THE CITES ARE ANCHORED, NOT DECORATIVE (the fix round's finding F). A line number typed into a
// string drifts the day a paragraph above it grows, and a factor typed beside it is then a number
// citing nothing. So every row carries `anchors`: the file, the line, and the PHRASE that line was
// read from — and `readPageCeilings` opens each cited file and refuses the clause if the cited line
// no longer carries its phrase (naming the line the phrase moved to, when it merely moved). The
// factor stays a literal on purpose: a clause that PARSED the percentage out of the prose would
// widen itself the day someone typed 10, and tighten-never-widen is the rule. What the anchor
// buys is that the literal cannot silently outlive the sentence it quotes. `cite` — the string the
// detail line prints — is derived from the anchors, never typed twice.
//
// A DOCUMENTED CEILING THAT IS ABSENT IS REFUSED, NOT SKIPPED (the fix round's finding E). The
// first cut of this clause bounded the ceilings that existed and said nothing about one deleted
// from the table, so `appCore` removed from lite's row was 62/62 with `core` simply missing from
// the detail line, and `budgets: null` read as "not measured" and passed. Every one of `total`,
// `app`, `appCore`, `modelCode` and the five block caps is now REQUIRED to be present to be
// measured; a missing one is a problem naming it, and a missing table is five. build.mjs refuses
// the same absence at build time, so neither direction is left to a test's literal table.
//
// WHAT IS NOT ASSERTED, and stays open from above on the record (METHODOLOGY §9.11's release
// consolidation paragraph; README's backlog): `eq` — D9 clause (b) asserts its floor only, and its
// 73 KB is documented as one whole-KB step under measured+5 % (variant.mjs:88), so a bound would
// hold today, but the two measurements of "eq" (the file, which D9 reads, and the injected block,
// which the build reads) differ by the `const EQUILIBRIUM = ` wrapper, and a clause should name
// one before it exists; and this gate's OWN model.json sub-budgets (`BUD` below), whose documented
// margin is "4-5% on the large blocks" — a description in THIS file's `BUD` note, not a rule, and
// not a sentence of METHODOLOGY §9.10 — and whose `total` V3-PLAN §6 already records as unpinned.
//
// WHERE THE MEASURED FIGURES COME FROM. `pageCensus` reads `total`, `data`, `modelCode`, `eq` and
// therefore `app` off the artifact on disk by its own `@inject:` markers — the build's own
// definition of `app`, to the byte. `blockCensus` is the build's marked-block loop, lifted into
// scripts/lib/block-census.mjs so the build and this gate call ONE function: it recompiles the
// shell on disk once per block (~120 ms per variant). Neither reads data/model.json, so this runs
// honestly inside generate-data.mjs too, where the model in memory is not the one on disk (the trap
// gates/variants.mjs describes). A missing artifact, a missing shell, or a page the census cannot
// parse FAILS the clause rather than skipping it — D10's rule: lite is the non-negotiable artifact.
//
// TIGHTEN, NEVER LOOSEN. A ceiling this clause refuses is repaired by lowering the cap to the
// documented formula, never by editing the factor: the factors here are quotations.
// ---------------------------------------------------------------------------
/** The three files the margins are quoted from, by repo-relative path. */
const SRC = { V: 'scripts/lib/variant.mjs', B: 'scripts/build.mjs', M: 'docs/METHODOLOGY.md' };
/** An anchor: `file` at `line` (1-based) carries `quote` verbatim, or the cite has drifted. */
const at = (file, line, quote) => Object.freeze({ file, line, quote });

/** The printed form of one file's anchors: `variant.mjs:159`, `METHODOLOGY §9.11:2522,:2620`. */
const citeName = { [SRC.V]: 'variant.mjs', [SRC.B]: 'build.mjs', [SRC.M]: 'METHODOLOGY' };
export function citeOf(anchors) {
  const byFile = new Map();
  for (const a of anchors) {
    if (!byFile.has(a.file)) byFile.set(a.file, []);
    byFile.get(a.file).push(a.line);
  }
  return [...byFile].map(([file, lines]) => `${citeName[file] || file}:${lines.join(',:')}`).join('; ');
}

const margin = (factor, anchors) => Object.freeze({ factor, anchors: Object.freeze(anchors), cite: citeOf(anchors) });

export const CEILING_MARGINS = Object.freeze({
  total: margin(1.05, [
    at(SRC.B, 470, 'Each budget below is that measurement plus about 5%, rounded'),
    at(SRC.B, 485, 'TOTAL 600 KB'),
    at(SRC.M, 2363, 'measurement plus about 5 %, the same rule the phase-3 numbers were set by'),
    at(SRC.V, 224, 'DELIBERATELY far below the 686K a fresh measured+5% would give'),
  ]),
  app: margin(1.05, [
    at(SRC.V, 159, 'far under the +5% this rule would allow (413K)'),
    at(SRC.M, 2522, '+5 % is 387.6, rounded up to the whole KB: **388 KB**'),
    at(SRC.M, 2620, 'under the +5 % this rule would allow (413 KB)'),
  ]),
  appCore: margin(1.05, [
    at(SRC.V, 104, 'the app payload MINUS the `@block:gto` region — the pre-raise ceiling'),
    at(SRC.B, 470, 'Each budget below is that measurement plus about 5%, rounded'),
    at(SRC.B, 489, 'APP 360 KB (was 345). Measured 344.8, headroom 4.4%'),
    at(SRC.M, 2363, 'measurement plus about 5 %, the same rule the phase-3 numbers were set by'),
    at(SRC.M, 254, 'a removal that does not move the ceiling'),
  ]),
  modelCode: margin(1.08, [
    at(SRC.V, 119, 'DELIBERATELY BELOW the 8% margin this gate was calibrated'),
    at(SRC.V, 136, 'calibrated +8%, which would give 56K'),
    at(SRC.B, 499, 'measurement plus about 8%, the margin this gate was originally calibrated with'),
    at(SRC.M, 2412, 'that measurement plus about 8 %'),
  ]),
  blocks: margin(1.05, [
    at(SRC.V, 140, 'a per-block ceiling at measured+5%'),
    at(SRC.M, 2569, 'at measured+5 % rounded up to the whole KB'),
    at(SRC.M, 2600, '4,844 B + 5 % = 5,087 B, rounded up to the whole KB'),
    at(SRC.M, 2636, '5,313 B + 5 % = 5,579 B, rounded up to the whole KB'),
  ]),
});

/** The ceilings the clause REQUIRES in every variant's table, in the order it reads them. */
export const REQUIRED_CEILINGS = Object.freeze(['total', 'app', 'appCore', 'modelCode']);

/**
 * Hold every anchor to its line: the cited file, at the cited line, still carries the quoted phrase.
 *
 * @param {object} [margins] CEILING_MARGINS, or a table a test built
 * @param {(relPath:string)=>string|null} [readSource] the seam: repo-relative path -> file text, or
 *        null when the file cannot be read (the default reads ROOT)
 * @returns {{problems:string[], checked:number}}
 */
export function citationProblems(margins = CEILING_MARGINS, readSource) {
  const read = readSource || ((rel) => {
    const p = resolve(ROOT, rel);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  });
  const cache = new Map();
  const linesOf = (file) => {
    if (!cache.has(file)) { const t = read(file); cache.set(file, t == null ? null : t.split('\n')); }
    return cache.get(file);
  };
  const problems = [];
  let checked = 0;
  for (const row of Object.keys(margins)) {
    for (const a of margins[row].anchors) {
      checked += 1;
      const lines = linesOf(a.file);
      const where = `${citeName[a.file] || a.file}:${a.line}`;
      if (lines === null) {
        problems.push(`${row}'s margin cites ${where}, and ${a.file} cannot be read — fail closed`);
        continue;
      }
      const line = lines[a.line - 1];
      if (line != null && line.includes(a.quote)) continue;
      const now = lines.findIndex((l) => l.includes(a.quote)) + 1;
      problems.push(`${row}'s margin cites ${where} for "${a.quote}", and that line no longer carries it — `
        + (now ? `the phrase is at :${now} now; re-pin the cite to the line, never the factor to a guess`
          : 'the phrase is gone from the file; re-find where the margin is documented before trusting the factor'));
    }
  }
  return { problems, checked };
}

/** measured × factor, rounded UP to the whole KB — the idiom every §9.11 derivation uses. */
export const ceilingBound = (measured, factor) => Math.ceil((measured * factor) / 1024) * 1024;

const K = (b) => `${(b / 1024).toFixed(1)}K`;
const KB = (b) => `${b / 1024}K`;

/**
 * The clause as a pure function, so a test can hand it a loosened cap and watch it refuse.
 *
 * @param {string} variant
 * @param {object} budgets VARIANTS[variant].budgets
 * @param {{total:number, app:number, appCore:number, modelCode:number, blocks:Record<string,number>}} m
 *        the measured bytes
 * @returns {{problems:string[], readings:string[]}} `problems` is empty when every documented
 *          margin holds; `readings` is one `name measured/cap≤bound` entry per ceiling checked
 */
export function pageCeilingProblems(variant, budgets, m) {
  const problems = [];
  const readings = [];
  if (!budgets) {
    /* No table at all. The build's own `else` branch prints "SIZE NOT GATED" for this and goes on,
       which was the pre-P3 stance for a full artifact nobody had measured; both artifacts have
       carried a table since P3, and a table that vanished is every documented ceiling gone at once. */
    problems.push(`${variant}: no budgets table — every documented ceiling (${REQUIRED_CEILINGS.join(', ')}, `
      + `blocks ${BLOCKS.join('/')}) is absent, and an unbounded ceiling is not a checked one`);
    return { problems, readings };
  }
  const check = (name, cap, measured, rule, label) => {
    if (cap == null) {
      problems.push(`${variant} ${label}: the documented ceiling is ABSENT from the table — a ceiling `
        + `deleted is a ceiling nothing bounds; every documented ceiling must be present to be measured `
        + `(${rule.cite})`);
      return;
    }
    const bound = ceilingBound(measured, rule.factor);
    readings.push(`${label} ${K(measured)}/${KB(cap)}≤${KB(bound)}`);
    if (cap > bound) {
      problems.push(`${variant} ${label}: the ceiling ${KB(cap)} is LOOSER than its documented margin — `
        + `measured ${K(measured)} × ${rule.factor.toFixed(2)} rounded up to the whole KB is ${KB(bound)} `
        + `(${rule.cite}); tighten the cap to the formula, never the formula to the cap`);
    }
  };
  check('total', budgets.total, m.total, CEILING_MARGINS.total, 'total');
  check('app', budgets.app, m.app, CEILING_MARGINS.app, 'app');
  check('appCore', budgets.appCore, m.appCore, CEILING_MARGINS.appCore, 'core');
  check('modelCode', budgets.modelCode, m.modelCode, CEILING_MARGINS.modelCode, 'model code');
  if (!budgets.blocks) {
    problems.push(`${variant} blocks: the per-block ceilings are ABSENT from the table — `
      + `${BLOCKS.join(', ')} each need a cap to be measured against (${CEILING_MARGINS.blocks.cite})`);
  } else {
    /* Every marked block needs its cap (absent -> refused above); a cap for a name the shell does
       not mark measures 0 and is refused as looser than 0K, which is the right answer for headroom
       nothing spends. */
    const names = [...BLOCKS, ...Object.keys(budgets.blocks).filter((n) => !BLOCKS.includes(n))];
    for (const name of names) {
      const measured = m.blocks && m.blocks[name] != null ? m.blocks[name] : 0;
      check(name, budgets.blocks[name], measured, CEILING_MARGINS.blocks, name);
    }
  }
  return { problems, readings };
}

/**
 * Read every variant's ceilings and measurements off disk (or off the injection seam) and judge
 * them. `opts.artifacts` / `opts.shellText` are the seams gates/variants.mjs already honours.
 *
 * @param {object} [opts]
 * @returns {{problems:string[], lines:string[], measured:Record<string,object>}}
 */
export function readPageCeilings(opts = {}) {
  const out = { problems: [], lines: [], measured: {}, anchors: 0 };
  /* The cites first: a factor whose sentence has moved is not a documented margin, whatever the
     ceilings measure. `opts.readSource` is the test seam for a drifted file. */
  const cites = citationProblems(CEILING_MARGINS, opts.readSource);
  out.anchors = cites.checked;
  out.problems.push(...cites.problems);
  const shellLabel = 'src/shell.html';
  let shell = opts.shellText != null ? opts.shellText : null;
  if (shell === null) {
    const p = resolve(ROOT, shellLabel);
    if (!existsSync(p)) {
      out.problems.push(`there is no ${shellLabel} to measure the marked blocks against — fail closed`);
      return out;
    }
    shell = readFileSync(p, 'utf8');
  }
  for (const v of VARIANT_NAMES) {
    const spec = VARIANTS[v];
    /* A variant without a table is NOT skipped: it is measured, and pageCeilingProblems refuses the
       absent table by name (finding E). */
    let text = null;
    if (opts.artifacts) text = opts.artifacts[v] == null ? null : opts.artifacts[v];
    else {
      const p = resolve(ROOT, spec.out);
      if (existsSync(p)) text = readFileSync(p, 'utf8');
    }
    if (text === null) {
      out.problems.push(`there is no ${spec.out} to read ${v}'s ceilings against — fail closed, `
        + 'as D10 does: an unmeasured ceiling is not a checked one');
      continue;
    }
    try {
      const pc = pageCensus(text, { label: spec.out });
      const only = stripOnlyBlocks(shell, v, { label: shellLabel });
      const base = compileShellScripts(only.text, { label: shellLabel });
      const bc = blockCensus(only.text, Buffer.byteLength(base.html), { label: shellLabel, blocks: BLOCKS });
      const m = { total: pc.total, app: pc.app, appCore: pc.app - bc.total, modelCode: pc.modelCode, blocks: bc.by };
      out.measured[v] = m;
      const r = pageCeilingProblems(v, spec.budgets, m);
      out.problems.push(...r.problems);
      out.lines.push(`${v} ${r.readings.join(' · ')}`);
    } catch (e) {
      out.problems.push(`${v}: the ceilings cannot be measured — ${e.message}`);
    }
  }
  return out;
}

export function build(ctx) {
  const { model, G, opts = {} } = ctx;

  const E = enumerateAll();
  // D6 measures the block sizes; D7 reads D6's total back. Declared here because two sections
  // share it — it was a verifyModel-scope `let` for exactly the same reason.
  let sizes;

  return {
    sections: [
    // =========================================================================
    // D1 — the partition
    // =========================================================================
    { ids: ['D1'], label: 'the partition', run: () => {
    let bad = 0;
    for (const line of REF_MATRIX.trim().split('\n')) {
      const p = line.split(/\s+/);
      for (let i = 0; i < 5; i++) {
        const got = E.combos[E.cellIdx.get(p[0] + '|' + REF_ORDER[i])];
        if (got !== +p[i + 1]) bad++;
      }
    }
    let modelSum = 0;
    for (const k of Object.keys(model.cells)) modelSum += model.cells[k].combos;
    G('D1', E.total === TOTAL && bad === 0 && modelSum === TOTAL,
      `enumeration ${E.total}, matrix mismatches ${bad}, model combo sum ${modelSum}`);
    } },

    // =========================================================================
    // D2 — empty cells
    // =========================================================================
    { ids: ['D2'], label: 'empty cells', run: () => {
    const enumEmpty = new Set();
    for (let i = 0; i < E.cellKeys.length; i++) if (E.combos[i] === 0) enumEmpty.add(E.cellKeys[i]);
    const modelEmpty = new Set(Object.keys(model.cells).filter((k) => model.cells[k].combos === 0));
    const same = enumEmpty.size === modelEmpty.size && [...enumEmpty].every((k) => modelEmpty.has(k));
    const leaked = [...modelEmpty].filter((k) => model.cells[k].eq !== undefined);
    const haveWhy = [...modelEmpty].every((k) => typeof model.cells[k].why0 === 'string' && model.cells[k].why0.length > 10);
    G('D2', same && leaked.length === 0 && haveWhy,
      `${enumEmpty.size} structurally empty cells, all match, ${leaked.length} leaked equities, causes present: ${haveWhy}`);
    } },

    // =========================================================================
    // D4 — schema completeness and number formatting
    // =========================================================================
    { ids: ['D4'], label: 'schema completeness and number formatting', run: () => {
    const NM = model.meta.nMax || 5;
    const nV = (model.constants.villainLattice && model.constants.villainLattice.v.length) || 0;
    const need = ['combos', 'oneIn', 'eq', 'nu', 'nuSlope', 'rho', 'danglers', 'nutSuited', 'dom',
      'mplay', 'adjMean', 'waveD', 'eqVs3bet', 'ex']
      .concat(NM > 5 ? ['cooler', 'vDelta'] : []);
    let bad = 0, fmt = 0;
    for (const k of Object.keys(model.cells)) {
      const c = model.cells[k];
      if (!c.combos) continue;
      for (const f of need) if (c[f] === undefined) bad++;
      if (c.eq.length !== NM) bad++;
      if (!c.ex.length) bad++;
      for (const e of c.eq) if (+e.toFixed(1) !== e) fmt++;
      if (+c.nu.toFixed(2) !== c.nu) fmt++;
      if (c.cooler !== undefined && +c.cooler.toFixed(3) !== c.cooler) fmt++;
      if (nV) {
        if (!Array.isArray(c.vDelta) || c.vDelta.length !== nV) bad++;
        else for (const row of c.vDelta) {
          if (row.length !== NM) bad++;
          else for (const d of row) if (+d.toFixed(1) !== d) fmt++;
        }
      }
    }
    const notable = Object.keys(model.cells).filter((k) => model.cells[k].notable).length;
    G('D4', bad === 0 && fmt === 0 && notable === 5,
      `eq[1..${NM}] and ${nV} villain-VPIP delta rows on every cell; missing fields ${bad}, ` +
      `formatting violations ${fmt}, notable cells ${notable}/5`);
    } },

    // =========================================================================
    // D5 / I18 — geometry
    // =========================================================================
    { ids: ['D5', 'I18'], label: 'mosaic geometry', run: () => {
    const sum = model.cols.reduce((a, c) => a + c.mosaicW, 0);
    let off = 0;
    for (const c of model.cols) {
      const exact = (c.combos / TOTAL) * (model.constants.mosaicTotal || 530);
      if (Math.abs(c.mosaicW - exact) > 1) off++;
    }
    const ok = sum === 530 && off === 0;
    G('D5', ok, `mosaic widths ${model.cols.map((c) => c.mosaicW).join('/')} sum ${sum}, off-by->1px ${off}`);
    G('I18', ok, `sum ${sum} === 530, every width within 1px of exact proportionality; equal mode is 5 x 106`);
    } },

    // =========================================================================
    // D6 — size budgets
    // =========================================================================
    { ids: ['D6'], label: 'size budgets', run: () => {
    const b = (o) => Buffer.byteLength(JSON.stringify(o));
    sizes = {
      cells: b(model.cells),
      meta: b(model.meta) + b(model.rows) + b(model.cols) + b(model.bands) + b(model.constants) + b(model.benchmarks),
      order: model.order ? b(model.order) : 0,
      baseline: model.baselineTiers ? b(model.baselineTiers) : 0,
      solver: model.constants && model.constants.solver ? b(model.constants.solver) : 0,
      skill: model.constants && model.constants.skill ? b(model.constants.skill) : 0,
      evCut: model.constants && model.constants.evCut ? b(model.constants.evCut) : 0,
      ladder: model.constants && model.constants.ladder ? b(model.constants.ladder) : 0,
      calibration: model.calibration ? b(model.calibration) : 0,
      total: b(model),
    };
    // Budgets, raised for the v2 payload (V2-PLAN §2.5), in the same spirit as build.mjs's own
    // budget note: a raise has to be stated and paid for, not slipped in.
    //   cells 40 -> 65K   measured 62.2K. eq[] grows from five numbers to seven (§2.2), plus
    //                     `cooler` (§2.1), plus the villain-VPIP lattice — the whole reason v2
    //                     exists — shipped as 1-dp deltas from the random-villain baseline rather
    //                     than as absolute equities, precisely to keep this number down.
    //   meta  14 -> 13K   measured 10.8K, and TIGHTENED from 14K: the new measurement constants
    //                     (the cooler definition, the lattice points, villainDiscipline q, the
    //                     realised range fractions) cost under a kilobyte between them.
    //   total 120 -> 150K measured 142.7K.
    // Headroom is 4-5% on the large blocks, the same margin v1 ran (38.6/40K, 58.4/60K): these
    // are meant to catch a payload that creeps, not to leave room for one.
    //
    // PHASE 4 RAISE, stated and paid for in the same spirit:
    //   order   new, 43K   measured 40.3K. The frozen eq1 permutation over 16,432 suit-isomorphism
    //                     classes, 15 bits each, base64. It is here because V2-PLAN §4's Simulate
    //                     button cuts a villain pool at an off-lattice v, and eq1 is a 10^9-showdown
    //                     measurement the browser cannot repeat — repeating it would land on a
    //                     DIFFERENT ordering and quietly re-answer a different question. This is
    //                     the price of the button being honest; gate D8 audits the bytes.
    //   total 150 -> 195K measured 183.5K. Exactly the order block plus the old 143.1K reading of
    //                     the file on disk. Headroom 6%, the same margin as the blocks above.
    //
    // SUB-BUCKET CUT, and the budget comes DOWN with it — a removal that does not move the ceiling
    // has not really been paid back:
    //   sub     72K -> 0   the layer is gone: no `sub` block, no per-bucket mplay/cooler, and the
    //                      cell is now the finest unit this model resolves.
    //   total  195 -> 120K measured 113.9K, against 183.5K before the cut — the whole 69.5K of the
    //                      sub block, and nothing else moved. Headroom 5%, the same margin as
    //                      every block above.
    //
    // V2-PLAN §2.5 quotes its ceiling as "220 KB pretty-printed". Measured, the emitted file is
    // 143.1 KB as written and 242.2 KB under JSON.stringify(m, null, 1). The plan compares that
    // ceiling against "model.json is 105 KB today", which is the MINIFIED v1 file (v1
    // pretty-prints to 161.7 KB) — and its own stated fallback, dropping the lattice to three
    // v-points, still pretty-prints to 221.0 KB. So the literal reading is not satisfiable by the
    // plan's own remedy, and the ceiling is read on the basis it was written against: the file as
    // emitted. See docs/V2-PLAN.md §2.5, updated with these measurements.
    //
    // THE DUAL BUILD (V3-PLAN §5.3, P1 lane I): this gate is RESTATED, not rewritten. `model.json`
    // stays the single shared artifact both variants inject, and §5.3 re-reads D6 as **the lite
    // contract** — lite is the constraining consumer (brief §5.8), so the numbers above bind the
    // lite artifact and the full artifact inherits them for the shared core and carries its own
    // payload separately under D9. Not one byte of the budgets above moves for that restatement.
    //
    // THE ONE ADDITION, named and paid for at the gate:
    //   baseline  new, 12K   the quantized equilibrium baseline-tier block — per (pos, node, cell)
    //                        baseline tiers — which is what buys LITE a tier-level vs-GTO colour
    //                        mode instead of a disabled one. §5.3's judgement, and it is the right
    //                        one: "same model" (locked 4.2) is truer than "same model minus the
    //                        mode we could not afford".
    //   total  120 -> 132K   ...and this is where the phrase "paid for" has to mean something. A
    //                        ceiling raised by 12K before the 12K block exists is 12K of headroom
    //                        handed to every OTHER block, which is precisely the tolerance-widening
    //                        this repository refuses. So the raise is RESERVED, not granted: the
    //                        `core` clause below re-asserts the ORIGINAL 120K ceiling against the
    //                        payload minus the baseline block, and the 132K total can only be
    //                        approached by the baseline block actually being there. Today
    //                        `sizes.baseline` is 0, `core === total`, and this gate is bit-for-bit
    //                        as strict as it was. The day P3 emits the block, it gets its 12K and
    //                        nothing else does.
    //
    // P3 LANDED BOTH BLOCKS, and the SECOND one is a raise this gate had not reserved. Same idiom,
    // stated the same way, and measured before it was granted:
    //   baseline  12K  CLAIMED. Measured 11.5K of the 12K reserved above (`baselineQuant` = 0.01;
    //                  the quantization's own byte table was offered as that constant's anchor,
    //                  V3-PLAN §6 — the P3 red team refuted it AS AN ANCHOR, 6 memos of 6, so the
    //                  constant now ships FLAGGED with its admission in the block itself and the
    //                  table made binding by I36 clause (e); see docs/refutations/P3.md and
    //                  scripts/lib/equilibrium.mjs). Nothing about the reservation changes — the
    //                  block simply exists now, so `core` and `total` part company.
    //   solver     3K  new. `constants.solver` — the four CFR+ constants with their ANCHORS, stamped
    //                  from cfr.mjs by `stampConstants` (adjudication 10; §6's third leg, which
    //                  docs/refutations/P2.md finding 6 recorded as the unmet one). Measured 2.3K,
    //                  of which 2.2K is anchor prose, and the prose is the point: §6's contract is
    //                  "named in `constants`, labeled in the Method view, bounded by a gate", and an
    //                  anchor that lives only in a source comment is not on the page.
    //   meta   13 -> 16K   the solver block lands inside the meta bucket, which was at 12.7K of 13K.
    //   total 132 -> 135K
    //                  BOTH RAISES ARE RESERVED, NOT GRANTED, and there are now two re-assertions
    //                  rather than one: `core` (total minus BOTH new blocks) still faces the
    //                  original 120K, and `metaCore` (the meta bucket minus the solver block) still
    //                  faces the original 13K. Measured, those two readings are 115.9K and 12.7K —
    //                  the same bytes, against the same ceilings, as the run before P3. No existing
    //                  block gained one byte of headroom, and the gate prints all four numbers so
    //                  that cannot be taken on trust.
    //
    // P4 ADDS A THIRD RESERVED BLOCK, by the same rule and measured before it was granted:
    //   skill      1K  new. `constants.skill` — the pool-skill axis's domain, its lattice-anchored
    //                  floor, the interior blend's published formula, the plays-better coefficient
    //                  that ships `null` because Grade C does not build it, and the `flag` that says
    //                  all of that out loud (V3-PLAN §6; gates I37/I38). Measured 991 B, of which
    //                  ~840 B is the flag: the same trade the solver block made, and made for the
    //                  same reason — §6's contract is "named in `constants`, labeled in the Method
    //                  view, bounded by a gate", and an admission that lives only in a source
    //                  comment is not on the page.
    //   meta   16 -> 17K   the skill block lands inside the meta bucket, which was at 12.7K of 13K —
    //                  340 B of headroom, so the block does not fit without the raise and the raise
    //                  is what has to be stated.
    //   total 135 -> 136K
    //                  RESERVED, NOT GRANTED, exactly as the other two were: `core` now subtracts
    //                  all THREE new blocks and still faces the original 120K, and `metaCore`
    //                  subtracts the solver and skill blocks and still faces the original 13K. No
    //                  pre-existing block gains one byte of headroom, and the gate prints every
    //                  reading so that cannot be taken on trust.
    //
    // P4'S SECOND DELIVERABLE ADDS A FOURTH RESERVED BLOCK, measured before it was granted:
    //   evCut      2K  new. `constants.evCut` — the EV MIX band's multiplier `k`, the t4 mass it was
    //                  solved against, the mass the rounded k actually delivers and the next step up
    //                  (the target lies between them: the distribution is a step function with tie
    //                  plateaus, so no achievable band hits it exactly), the se unit, a fingerprint
    //                  of the default state it was derived at, and the DERIVATION SENTENCE. Measured
    //                  1,141 B, of which ~740 B is that sentence — the same trade the solver and
    //                  skill blocks made: §6's contract is "named in `constants`, labeled in the
    //                  Method view, bounded by a gate", and a derivation that lives only in a source
    //                  comment is not on the page. Gate I40 re-derives the whole block from scratch
    //                  every run and Object.is-compares it against this one.
    //   meta   17 -> 19K   the block lands inside the meta bucket, which is at 13.7K of 17K after the
    //                  skill raise — 3.3K of headroom, which would have fitted. It is raised anyway,
    //                  by the same rule the other three were: a block gets its own reserved
    //                  sub-budget so that its bytes cannot be spent by anything else, and `metaCore`
    //                  keeps facing the original 13K with all four subtracted.
    //   total 136 -> 138K
    //                  RESERVED, NOT GRANTED. `core` now subtracts all FOUR blocks and still faces
    //                  the original 120K; `metaCore` subtracts the three that live in `constants`
    //                  and still faces the original 13K. Nothing pre-existing gains a byte.
    //
    // P5 ADDS A FIFTH RESERVED BLOCK, measured before it was granted and stated rather than nudged:
    //   calibration 7K  new, and it is the only block here that is not a constant. `model.calibration`
    //                  — the primacy verdict, the Phase-0 pre-registered criteria VERBATIM (3,300 B
    //                  of the total, and the largest single line item in it), the digest that pins
    //                  them, all eight PC rows with their statuses and details, PC-8's numbers, the
    //                  absent-corpus record with S-C's reason, the empty `disputed` list WITH the
    //                  sentence saying why it is empty, the self-play consistency figures stamped
    //                  potFrac/moneyValidated:false, and the limitation and successor sentences.
    //                  Measured 6,394 B = 6.2K; 7K is measured+5% (6,714 B) rounded up to the whole
    //                  KB, the D9 rule applied here.
    //                  WHY THE CRITERIA TEXT SHIPS RATHER THAN JUST ITS DIGEST, since half the block
    //                  is that one string: V3-PLAN §3.5 requires the reason the decision layer is
    //                  unfalsified to be "on screen rather than in a doc", and a digest is not a
    //                  reason. It is the same trade `constants.evCut` made for its derivation
    //                  sentence and the solver block made for its cap list.
    //                  IT IS NOT INSIDE `constants` and that is deliberate: it is not an opinion the
    //                  scoring layer holds, it is a verdict ABOUT the opinions, and `stampConstants`
    //                  would then have had to decide whether to carry it across (it must not — see
    //                  `stampCalibration`, which re-derives it every run on the `evCut` precedent).
    //                  So `meta` is untouched by it and `metaCore` still faces the original 13K with
    //                  the same three blocks subtracted as before.
    //   total 138 -> 145K
    //                  RESERVED, NOT GRANTED, for the fifth time and by the same rule. `core` now
    //                  subtracts all FIVE blocks and still faces the original 120K. The raise is
    //                  exactly the sub-budget, so no pre-existing block gains one byte — and this
    //                  time the arithmetic is worth stating, because the block would have FITTED
    //                  without a raise: the payload was 131.8K of 138K, and 6.2K of calibration
    //                  lands at 137.9K with 339 B to spare. Squeezing it into the existing headroom
    //                  is exactly what this gate's own rule forbids — a block gets its own reserved
    //                  sub-budget so that its bytes cannot be spent by anything else, and so that
    //                  nothing else's bytes can be spent by it.
    //   meta  19 -> 20K   and total 145 -> 146K, RESERVED NOT GRANTED for the SIXTH time and by the
    //   ladder 1K (new)   same rule, at v4 S1 for `constants.ladder` (V4-PLAN §2.1-2.3): the nine-seat
    //                     ladder, the early-seat rule and its derived values. Measured 520 B, cap 1K.
    //                     V4-PLAN §2.7 PREDICTED NO EDIT HERE — "the ladder constants land in the
    //                     existing headroom, and BUD, BUD.total, CORE_BUDGET and core need no edit" —
    //                     and that prediction is FALSIFIED, recorded rather than patched away: the
    //                     block plus `straddle.seatDerivedFrom` is 557 B against 315 B of metaCore
    //                     headroom, so `metaCore` measured 13,557 B of 13,312 B. Every field it
    //                     carries is one §4's constants table requires, and the block is 287 B with
    //                     BOTH prose fields emptied, so it cannot be squeezed under the old ceiling
    //                     without deleting a documented constant. Raised by EXACTLY the sub-budget:
    //                     `core` still faces the original 120K and `metaCore` the original 13K, so
    //                     no pre-existing block gains one byte and none of its bytes can be spent by
    //                     anything else — which is what the two core readings below prove.
    const BUD = {
      cells: 65 * 1024, meta: 20 * 1024, order: 43 * 1024,
      baseline: 12 * 1024, solver: 3 * 1024, skill: 1 * 1024, evCut: 2 * 1024, ladder: 1 * 1024,
      calibration: 7 * 1024, total: 146 * 1024,
    };
    // the pre-raise 120K and 13K, still binding — every reserved block subtracted, none of them granted
    const CORE_BUDGET = BUD.total - BUD.baseline - BUD.solver - BUD.skill - BUD.evCut - BUD.ladder - BUD.calibration;
    const META_CORE_BUDGET = BUD.meta - BUD.solver - BUD.skill - BUD.evCut - BUD.ladder;
    const core = sizes.total - sizes.baseline - sizes.solver - sizes.skill - sizes.evCut - sizes.ladder - sizes.calibration;
    const metaCore = sizes.meta - sizes.solver - sizes.skill - sizes.evCut - sizes.ladder;
    /* THE PAGE'S CEILINGS, FROM ABOVE — the clause the P5 red team wrote down (see the header
       above `CEILING_MARGINS`). Everything before this line asserts that a payload is UNDER its
       ceiling; this asserts that the page's ceilings are not ABOVE the margins the documents claim
       for them. It reads the artifacts and the shell on disk, never the model, so it is the same
       assertion inside generate-data.mjs as here. */
    const page = readPageCeilings(opts);
    const ok = sizes.cells <= BUD.cells && sizes.meta <= BUD.meta
      && sizes.order <= BUD.order && sizes.baseline <= BUD.baseline
      && sizes.solver <= BUD.solver && sizes.skill <= BUD.skill && sizes.evCut <= BUD.evCut
      && sizes.ladder <= BUD.ladder
      && sizes.calibration <= BUD.calibration
      && metaCore <= META_CORE_BUDGET
      && core <= CORE_BUDGET && sizes.total <= BUD.total
      && page.problems.length === 0;
    G('D6', ok, (page.problems.length ? `PAGE CEILINGS FROM ABOVE: ${page.problems.join(' · ')} · ` : '') +
      `cells ${(sizes.cells / 1024).toFixed(1)}K/${BUD.cells / 1024}K · ` +
      `meta+tables ${(sizes.meta / 1024).toFixed(1)}K/${BUD.meta / 1024}K ` +
      `(of which core ${(metaCore / 1024).toFixed(1)}K/${META_CORE_BUDGET / 1024}K) · ` +
      `order ${(sizes.order / 1024).toFixed(1)}K/${BUD.order / 1024}K · ` +
      `baseline tiers ${(sizes.baseline / 1024).toFixed(1)}K/${BUD.baseline / 1024}K · ` +
      `solver constants ${(sizes.solver / 1024).toFixed(1)}K/${BUD.solver / 1024}K · ` +
      `skill axis ${(sizes.skill / 1024).toFixed(1)}K/${BUD.skill / 1024}K · ` +
      `EV band ${(sizes.evCut / 1024).toFixed(1)}K/${BUD.evCut / 1024}K · ` +
      `seat ladder ${(sizes.ladder / 1024).toFixed(1)}K/${BUD.ladder / 1024}K · ` +
      `calibration ${(sizes.calibration / 1024).toFixed(1)}K/${BUD.calibration / 1024}K · ` +
      `total ${(sizes.total / 1024).toFixed(1)}K/${BUD.total / 1024}K ` +
      `(of which core ${(core / 1024).toFixed(1)}K/${CORE_BUDGET / 1024}K — the baseline block's ` +
      `${BUD.baseline / 1024}K, the solver block's ${BUD.solver / 1024}K, the skill block's ` +
      `${BUD.skill / 1024}K, the EV band's ${BUD.evCut / 1024}K, the seat ladder's ` +
      `${BUD.ladder / 1024}K and the calibration verdict's ` +
      `${BUD.calibration / 1024}K are reserved for them ` +
      `and grant no other block headroom, which is what the two core readings prove; ` +
      `pretty-printed ${(Buffer.byteLength(JSON.stringify(model, null, 1)) / 1024).toFixed(1)}K). ` +
      `BINDING ON THE LITE ARTIFACT (§5.3): model.json is shared, and lite is the constraining consumer. ` +
      `PAGE CEILINGS FROM ABOVE (release consolidation; docs/refutations/P5.md §3's first repair, ` +
      `measured/cap≤cap-bound): ${page.lines.join('; ') || 'not measured'} — ` +
      `bound = measured × margin rounded up to the whole KB; margins, each quoted from the line it cites: ` +
      [['total', 'total'], ['app', 'app'], ['appCore', 'core'], ['modelCode', 'model code'], ['blocks', 'blocks']]
        .map(([k, label]) => `${label} +${Math.round((CEILING_MARGINS[k].factor - 1) * 100)}% (${CEILING_MARGINS[k].cite})`)
        .join(' · ') +
      `; ${page.anchors} cited lines re-read this run and each still carries its phrase; a documented ceiling ` +
      `absent from a variant's table is refused, not skipped. ` +
      `Still open from above: eq (D9 asserts its floor only) and this gate's own model.json sub-budgets`);
    } },

    // =========================================================================
    // D7 — the V2-PLAN §2.5 payload ceiling, read against the artifact as shipped
    // =========================================================================
    { ids: ['D7'], label: 'the §2.5 payload ceiling', run: () => {
    // V2-PLAN §2.5 budgets the v2 payload at "<= 220 KB", in the same breath as "model.json is
    // 105 KB today" — and that 105 KB is the MINIFIED v1 file on disk (v1 pretty-prints to
    // 161.7 KB under JSON.stringify(m, null, 1)). Two numbers in one sentence have to be on the
    // same basis, so the ceiling binds the artifact as emitted: the exact byte string
    // generate-data.mjs writes to data/model.json.
    //   Read as a pretty-printed ceiling instead, the rule is unsatisfiable by its own escape
    // hatch — §2.5's stated fallback of dropping the villain lattice to three v-points still
    // pretty-prints to 221.0 KB (measured), and the five-point file that ships pretty-prints to
    // 242.2 KB. A rule its own remedy cannot meet is the wrong reading of the rule, so the
    // pretty-printed figure is RECORDED here, honestly, and not asserted.
    //   Measured on the shipped run: 146,551 B = 143.1 KB as emitted, 242.2 KB pretty-printed.
    // (V2-PLAN §2.5 and METHODOLOGY §9.10 record 146,171 B for the same payload: that reading was
    // taken before any gate names were stamped into `model.gates`, and before `stampConstants`
    // put the depth / rake / straddle constants in the file. The measured payload is unchanged.)
    // D6 above carries the tighter operational budgets (150 KB total, 4-5% headroom per block)
    // that catch a payload creeping block by block. D7 is the published contract from the plan,
    // and is deliberately slack against D6 — if it ever fires, D6 fired a long time earlier.
    //   One honesty note about the number this gate prints: at generate time `gates` and
    // `meta.hash` are not yet stamped into the model, so the size measured there is ~0.6 KB short
    // of the file that lands on disk. Re-running `node scripts/verify.mjs` over the written file
    // reports the true size (146,551 B). Both readings sit far inside the ceiling.
    //
    // THE DUAL BUILD (V3-PLAN §5.3): restated only, no code change. `model.json` is the shared
    // core both variants inject, so this ceiling is **binding on the lite artifact** — lite is the
    // constraining consumer, and a payload that fits lite fits full by construction. The full-only
    // `data/equilibrium.json` is NOT measured here and never should be: it is a different file
    // under a different gate (D9), sized from its own first real measurement at +5%, and folding
    // it into a ceiling calibrated against the shared model would blow that ceiling for a reason
    // that has nothing to do with the model creeping.
    const BUDGET = 220 * 1024;
    const emitted = sizes.total;
    const pretty = Buffer.byteLength(JSON.stringify(model, null, 1));
    G('D7', emitted <= BUDGET,
      `model.json as emitted (minified, the bytes written to disk) ${emitted.toLocaleString()} B = ` +
      `${(emitted / 1024).toFixed(1)} KB of the ${BUDGET / 1024} KB V2-PLAN §2.5 ceiling, ` +
      `${((1 - emitted / BUDGET) * 100).toFixed(0)}% headroom; pretty-printed (null, 1) ` +
      `${(pretty / 1024).toFixed(1)} KB — recorded, not asserted (see the gate comment: the plan's ` +
      `own 3-point fallback pretty-prints to 221.0 KB, so that reading is unsatisfiable)`);
    } },

    // =========================================================================
    // D8 — the shipped villain ordering (V2-PLAN §4)
    // =========================================================================
    { ids: ['D8'], label: 'the shipped villain ordering', run: () => {
    // The Simulate button cuts a villain pool at a v this generator never measured, so the frozen
    // eq1 ordering ships with the model (scripts/lib/order-pack.mjs explains why it cannot be
    // recomputed in the browser). This gate is the whole integrity story for those 40 KB, and it
    // is cheap enough — 20 ms of class-building on top of an enumeration D1 already paid for — to
    // run on every verify rather than behind a flag.
    //
    // Four claims, in ascending order of what they would catch:
    //   1. it decodes, and is an EXACT permutation of 0..n-1. A duplicated or missing class id
    //      silently changes which hands are in the pool at every v; a length check alone would not
    //      see it.
    //   2. its hash matches meta.orderHash — so an order transplanted from another model, or a
    //      hand-edited payload, is caught even if it happens to be a valid permutation.
    //   3. the index space is real: the number of distinct suit-isomorphism classes recomputed
    //      from the enumeration is n, and the class ids the browser will derive (ascending
    //      canonical representative) span exactly the same range.
    //   4. RECONSTRUCTION — the part that actually ties the order to the shipped measurement. Run
    //      the generator's own cut rule over the shipped order at each lattice point and check the
    //      realised range fraction reproduces `constants.villainLattice.realized`, to the 4 dp
    //      those numbers ship at. Those fractions land on class boundaries, so they are a fine
    //      fingerprint of the ordering near every cut: a swap anywhere in the first 90% of the
    //      order that moved a class across any of the five cuts would change one of them.
    const o = model.order;
    const vl = (model.constants && model.constants.villainLattice) || {};
    const notes = [];
    let ok = false;
    if (!o || typeof o.packed !== 'string') {
      notes.push('model.order is missing');
    } else if (o.bits !== ORDER_BITS) {
      notes.push(`model.order.bits ${o.bits}, this build packs at ${ORDER_BITS}`);
    } else if (vl.classes != null && o.n !== vl.classes) {
      notes.push(`model.order.n ${o.n} disagrees with constants.villainLattice.classes ${vl.classes}`);
    } else {
      let order = null;
      try { order = unpackOrder(o.packed, o.n); }
      catch (e) { notes.push(`decode failed: ${e.message}`); }
      if (order) {
        const perm = permutationProblem(order, o.n);
        if (perm) notes.push(`not a permutation: ${perm}`);
        const h = orderHash(order);
        if (h !== model.meta.orderHash) notes.push(`hash ${h} != meta.orderHash ${model.meta.orderHash}`);
        const ct = classTableCanonical(E.byCell);
        if (ct.n !== o.n) notes.push(`enumeration yields ${ct.n} classes, order carries ${o.n}`);
        else {
          const shipped = Object.keys(vl.realized || {}).map(Number).sort((a, b) => a - b);
          const bad = [];
          for (const v of shipped) {
            const got = +(cutAt(order, ct.size, E.total, v).cum / E.total).toFixed(4);
            if (got !== vl.realized[v]) bad.push(`v${v} ${got} != ${vl.realized[v]}`);
          }
          if (bad.length) notes.push(`realised fractions do not reconstruct: ${bad.join(', ')}`);
          else notes.push(`${shipped.length} lattice cuts reconstruct exactly ` +
            `(${shipped.map((v) => `v${v} ${(vl.realized[v] * 100).toFixed(2)}%`).join(' · ')})`);
        }
        if (!notes.some((s) => /missing|failed|!=|not a permutation|disagrees|yields/.test(s))) ok = true;
      }
    }
    G('D8', ok, `villain order: ${o ? `${o.n} classes, ${o.bits}-bit packed, ` +
      `${(o.packed.length / 1024).toFixed(1)} KB base64, hash ${model.meta.orderHash} · ` : ''}${notes.join('; ')}`);
    } },
    ],
    done: () => ({ sizes }),
  };
}
