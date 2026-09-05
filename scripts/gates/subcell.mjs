// gate I47 — the sub-cell top-N, and §2.4's autopsy kept as a standing measurement.
//
// V3-PLAN §4 item 10 (sub-cell resolution, "done differently from v2's cut sub-buckets"), §7.2's
// I47 row, and METHODOLOGY §2.4 — the record of why the LAST attempt at sub-cell resolution was
// removed. One gate, six clauses, and the load-bearing one is (c).
//
// WHAT §2.4 ACTUALLY SAYS, because the whole gate is built on it. The removed sub-bucket layer gave
// every hand a second key and priced each bucket as-if standalone, and it was cut for two reasons:
// it cost 69.5 KB of a 187 KB payload, and — the reason that matters here — "the buckets were
// deliberately never re-cut into the percentile sort: inserting them would have moved every other
// cell's tier, so a bucket verdict was always a hypothetical about a grid that was not being
// painted". The layer's authors knew that and left the sort alone. NOBODY MEASURED THE THING THEY
// WERE AVOIDING, so the reason survived as a sentence in a document, which is the kind of reason
// that gets re-litigated by whoever arrives next with a plausible idea about sub-cell tiers.
//
// So clause (c) does the insertion — in the gate, never on the page — and MEASURES it. The number
// it prints is how many cells lose or change their tier when sub-cell rows enter the percentile
// sort, re-derived on every run against the current model. A standing gate whose failure mode is
// "the harm we cite stopped being real" is a gate that cannot rot into folklore.
//
// THE OTHER FIVE, in one line each:
//
//   (a) the ENUMERATION IS THE SHIPPED MODEL'S. The page's `@subcell` block is sliced out of
//       src/shell.html and evaluated here — the same text the artifact runs — and its rungs must
//       reconstruct every cell's shipped `combos` exactly and its shipped `adjMean` to the
//       precision the emitter wrote. §2.4 recorded the loss of the sub-layer's one partition
//       identity (D3/I17); this is a structural identity in its place, and it is what refuses the
//       list on the page if the two taxonomy halves ever disagree about which cell a hand is in.
//   (b) NO PER-HAND CLAIM ENTERS THE PERCENTILE SORT — §7.2's own words. The sort's population is
//       exactly `cellList`, 123 rows, Σ combos = 270,725, no row carrying a per-hand field; and
//       `handAdjust` — the only per-hand arithmetic in the layer — has ZERO call sites inside
//       policy.mjs. It exists to be called by the page and by nothing else.
//   (d) EVERY PER-HAND NUMBER IS LABELLED `estimate`, EVERYWHERE IT RENDERS. Every row the block
//       builds carries the badge as DATA, and every per-hand surface in the shell carries the token
//       in its own text. Two of those surfaces did NOT when this gate was written — the hand
//       panel's margin box and the drill reveal's margin line — and they were repaired rather than
//       scoped out, which is the clause doing its job.
//   (e) N IS READ, NOT CHOSEN. The list length is the cell's own `ex.length`, so item 10 ships zero
//       NEW constants and §6 has nothing to anchor. `want` must BE the read, textually, over the
//       WHOLE of its body — the P5 red team got both a second-line literal and a digit-free
//       laundered SIX past the one-line digit scan this used to be (docs/refutations/P5.md).
//   (f) THE vs-3-BET NODE GETS NO POINTS NUMBER, which is §2.4's other sentence: "at the vs-3-bet
//       node it could not say anything at all, because that node cuts on eqVs3bet". The list still
//       renders its ordering; what it declines to print is a magnitude the node does not use.
//
// COST. One shell read, 123 rung enumerations off the shipped block (~0.3 s), and the clause-(c)
// insertion over the percentile seats. Low seconds.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as P from '../lib/policy.mjs';
import * as T from '../lib/taxonomy.mjs';
import { stripComments } from './payoff.mjs';
import { ROOT, VPIP_GRID } from './_shared.mjs';

export const family = 'subcell';
export const title = 'the sub-cell top-N (I47), and §2.4\'s autopsy kept as a measurement';
export const ids = ['I47'];
export const setupLabel = 'slice @subcell out of the shell and enumerate all 123 rung tables';

/** the three percentile nodes — the only ones with a sort for a per-hand claim to get into */
const PCT_NODES = ['rfi', 'limps', 'raise'];

/**
 * THE SHIPPED BLOCK, EVALUATED. `scripts/build.mjs` already does this to the injected regions (a
 * `new Function` parse check on text that is about to ship), and the reason to do it here is
 * stronger: a gate that asserted these numbers against a COPY of the algorithm would be asserting
 * that two copies agree, which is not the claim. What has to be true is that the text the artifact
 * runs reconstructs the shipped model, so that text is what runs.
 */
function loadBlock(shell) {
  const a = shell.indexOf('/* @subcell');
  const b = shell.indexOf('/* @end:subcell */');
  if (a < 0 || b < a) return { err: 'src/shell.html carries no @subcell block' };
  try { return { src: shell.slice(a, b), api: new Function(`${shell.slice(a, b)}\nreturn SUBCELL;`)() }; }
  catch (e) { return { err: `@subcell does not evaluate standalone — ${e.message}` }; }
}

/**
 * THE TEXT OF ONE FUNCTION, BRACE-MATCHED. Clause (e)'s window used to be `slice(0, indexOf('\n'))`
 * — the first line — which made the gate weaker than the test standing behind it the moment anyone
 * reformatted the function it reads. This returns everything BETWEEN the outermost braces, so the
 * window is the function rather than a line of it.
 */
function bodyOf(src, needle) {
  const at = src.indexOf(needle);
  if (at < 0) return null;
  const open = src.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  return null;
}

/**
 * What `want` must BE. Not a constant of the model — the expression itself, quoted so clause (e)'s
 * claim ("N is read, not chosen") is ASSERTED rather than approximated by a digit scan. The `0` is
 * the empty-cell fallback: a cell with no shipped examples asks for no list at all.
 */
const WANT_IDENTITY = 'return (cell.ex && cell.ex.length) || 0;';

/** the taxonomy adapter the page builds as `TXSUB`, rebuilt here off the module the build inlines */
const TX = {
  classify: (cards) => ({ row: T.rowOf(cards), col: T.colOf(cards) }),
  features: (cards) => ({ adjRaw: T.adjRaw(cards), nutSuited: !!T.nutSuited(cards) }),
  colOf: T.colOf,
  nutSuited: T.nutSuited,
};

/**
 * §2.4's counterfactual, run for real: the rung rows inserted into the percentile sort the way the
 * removed layer's authors declined to. Returns what it costs, per seat.
 *
 * `rows` is `rankTable`'s own output, so the CELL side of the comparison is the shipped sort with
 * nothing simulated about it; only the rung side is the hypothetical.
 */
function insertionDamage(model, rungsOf, pos, node, v) {
  const t = P.rankTable(model, pos, node, v, { limpers: 2, raiserPos: 'CO' });
  const w = P.widthFor(pos, node, v, t.env);
  const cellCut = P.scoreAtCut(t.rows, w);
  const total = model.meta.comboTotal;

  const sub = [];
  for (const r of t.rows) {
    for (const g of rungsOf(r.key)) {
      sub.push({ key: r.key, S: P.handAdjust(r.S, g.adj, r.cell.adjMean), combos: g.combos });
    }
  }
  sub.sort((a, b) => b.S - a.S);
  let cum = 0;
  for (const r of sub) { const share = r.combos / total; r.cumMid = cum + share / 2; cum += share; }
  const rungCut = P.scoreAtCut(sub, w);

  /* MOVED: cells that change side of the aggressive line for no reason except that rows which are
     not cells were inserted below them. This is the "would have moved every other cell's tier"
     clause, counted. */
  let moved = 0;
  for (const r of t.rows) if ((r.S >= cellCut) !== (r.S >= rungCut)) moved++;
  /* SPLIT: cells with rungs on both sides of the new line — cells that no longer HAVE a tier. This
     is the half §2.4 calls "a hypothetical about a grid that was not being painted". */
  const side = new Map();
  const straddling = new Set();
  for (const r of sub) {
    const up = r.S >= rungCut;
    if (!side.has(r.key)) side.set(r.key, up);
    else if (side.get(r.key) !== up) straddling.add(r.key);
  }
  return { moved, split: straddling.size, cells: t.rows.length, rows: sub.length,
    cellCut, rungCut, drop: cellCut - rungCut };
}

export function build(ctx) {
  const { model, G } = ctx;

  const shellPath = resolve(ROOT, 'src/shell.html');
  let shell = null, shellErr = null;
  try { shell = readFileSync(shellPath, 'utf8'); } catch (err) { shellErr = err.message; }
  const block = shell ? loadBlock(shell) : { err: shellErr };

  const live = P.cellList(model);

  return {
    sections: [

    { ids: ['I47'], label: 'per-hand top-N: labelled estimate, and kept out of the sort', run: () => {
    const bad = [];
    if (block.err) {
      G('I47', false, `the shipped @subcell block could not be read: ${block.err}`);
      return;
    }
    const SUB = block.api;
    const rungCache = new Map();
    const rungsOf = (key) => {
      if (!rungCache.has(key)) rungCache.set(key, SUB.rungs(TX, key.split('|')[0], key.split('|')[1]));
      return rungCache.get(key);
    };

    // -- (a) THE ENUMERATION IS THE SHIPPED MODEL'S ------------------------------------------------
    // Σ of a cell's rung combos is its shipped `combos`, and the combo-weighted mean of its rungs is
    // its shipped `adjMean`. Both are structural rather than measured, which is why this identity
    // can exist at all where §2.4 says the sub-layer's equity one cannot be replaced.
    let rungTotal = 0, comboTotal = 0, maxRungs = 0, singles = 0;
    for (const it of live) {
      const rs = rungsOf(it.key);
      let n = 0, s = 0, prev = Infinity;
      for (const r of rs) {
        if (!(r.adj < prev)) bad.push(`(a) ${it.key}: rungs are not strictly descending at ${r.adj}`);
        prev = r.adj;
        n += r.combos; s += r.adj * r.combos;
      }
      if (n !== it.combos) bad.push(`(a) ${it.key}: rungs sum to ${n} combos, the model ships ${it.combos}`);
      const shipped = it.cell.adjMean;
      const dp = String(shipped).includes('.') ? String(shipped).split('.')[1].length : 0;
      if (Number((s / n).toFixed(dp)) !== shipped) {
        bad.push(`(a) ${it.key}: rung mean ${s / n} does not round to the shipped adjMean ${shipped}`);
      }
      rungTotal += rs.length; comboTotal += n; maxRungs = Math.max(maxRungs, rs.length);
      if (rs.length === 1) singles++;
    }
    if (comboTotal !== model.meta.comboTotal) {
      bad.push(`(a) the rung tables account for ${comboTotal} combos, not ${model.meta.comboTotal}`);
    }

    // -- (b) NO PER-HAND CLAIM ENTERS THE PERCENTILE SORT -------------------------------------------
    // §7.2's own sentence. Three ways of saying it, because the failure has three shapes: a row that
    // is not a cell, a per-hand field riding along on a row that is, and a call site.
    const PER_HAND = ['adj', 'adjRaw', 'ex', 'hand', 'rung', 'delta', 'badge'];
    let sortRows = 0, sortSweeps = 0;
    for (const node of PCT_NODES) {
      for (const pos of P.POSITIONS) {
        if (P.positionDisabled(pos, node)) continue;
        for (const vPct of VPIP_GRID) {
          const t = P.rankTable(model, pos, node, vPct / 100, { limpers: 2, raiserPos: 'CO' });
          sortSweeps++;
          if (t.rows.length !== live.length) {
            bad.push(`(b) ${pos}/${node}/${vPct}: the sort holds ${t.rows.length} rows, not ${live.length} cells`);
          }
          let combos = 0;
          for (const r of t.rows) {
            combos += r.combos;
            if (!model.cells[r.key] || !model.cells[r.key].combos) bad.push(`(b) the sort holds a non-cell row ${r.key}`);
            for (const f of PER_HAND) {
              if (Object.prototype.hasOwnProperty.call(r, f)) bad.push(`(b) sort row ${r.key} carries a per-hand field \`${f}\``);
            }
            sortRows++;
          }
          if (combos !== model.meta.comboTotal) {
            bad.push(`(b) ${pos}/${node}/${vPct}: the sort weighs ${combos} combos, not ${model.meta.comboTotal}`);
          }
        }
      }
    }
    /* THE CALL-SITE SCAN, on the grep-gate idiom (§6). `handAdjust` is exported for the page; if it
       is ever CALLED inside the layer, a per-hand number has entered the model's own arithmetic and
       every clause above is measuring the wrong thing. One occurrence is allowed: the declaration. */
    const policySrc = stripComments(readFileSync(resolve(ROOT, 'scripts/lib/policy.mjs'), 'utf8'));
    const uses = (policySrc.match(/handAdjust/g) || []).length;
    if (uses !== 1) bad.push(`(b) handAdjust appears ${uses} times in policy.mjs; only its declaration may`);

    /* THE INTERLEAVED CLAUSE, I34's idiom transposed: doing all of the sub-cell work between two
       COLD solves must leave the tiers character-identical. A memo poisoned by a per-hand read
       would show up here and nowhere else. */
    const probe = { pos: 'CO', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO' };
    P.clearSolveMemo();
    const cold = P.solve(model, probe).cells;
    const before = Object.keys(cold).map((k) => `${k}:${cold[k].tier}`).join('|');
    P.clearSolveMemo();
    for (const it of live) {
      const t = SUB.rows(TX, { rowKey: it.key.split('|')[0], colKey: it.key.split('|')[1], cell: it.cell }, 100);
      for (const r of t.rows) P.handAdjust(100, r.adj, it.cell.adjMean);
    }
    const warm = P.solve(model, probe).cells;
    const after = Object.keys(warm).map((k) => `${k}:${warm[k].tier}`).join('|');
    if (before !== after) bad.push('(b) tiers moved across the sub-cell work — the quarantine leaks');

    // -- (c) §2.4's AUTOPSY, MEASURED RATHER THAN QUOTED --------------------------------------------
    const damage = [];
    for (const node of PCT_NODES) {
      for (const pos of P.POSITIONS) {
        if (P.positionDisabled(pos, node)) continue;
        for (const vPct of [40, 55, 70]) {
          damage.push({ pos, node, vPct, ...insertionDamage(model, rungsOf, pos, node, vPct / 100) });
        }
      }
    }
    const worst = damage.slice().sort((a, b) => (b.moved + b.split) - (a.moved + a.split))[0];
    const totMoved = damage.reduce((a, d) => a + d.moved, 0);
    const totSplit = damage.reduce((a, d) => a + d.split, 0);
    /* THE STANDING CLAIM. If this ever comes back zero, the citation this whole feature is built on
       has stopped describing the model, and the right response is to re-open the question rather
       than to keep quoting §2.4. A gate that cannot fail is a comment. */
    if (!(totMoved > 0)) bad.push('(c) inserting sub-cell rows moved NO cell — §2.4\'s stated reason no longer holds and must be re-argued');
    if (!(totSplit > 0)) bad.push('(c) no cell is split by a sub-cell sort — §2.4\'s stated reason no longer holds and must be re-argued');
    /* and the other half: the shipped sort does not contain any of it */
    for (const d of damage) {
      if (d.rows <= d.cells) bad.push(`(c) ${d.pos}/${d.node}: the counterfactual inserted nothing, so it measured nothing`);
    }

    // -- (d) EVERY PER-HAND NUMBER IS LABELLED estimate ---------------------------------------------
    let badged = 0;
    for (const it of live) {
      const t = SUB.rows(TX, { rowKey: it.key.split('|')[0], colKey: it.key.split('|')[1], cell: it.cell }, 100);
      if (t.badge !== 'estimate') bad.push(`(d) ${it.key}: the list carries no estimate badge`);
      if (!t.rows.length) bad.push(`(d) ${it.key}: the list is empty`);
      for (const r of t.rows) {
        if (r.badge !== 'estimate') bad.push(`(d) ${it.key}: rung ${r.adj} reached a surface without its badge`);
        badged++;
      }
    }
    /* THE SURFACE SCAN. Every function in the shell that prints a per-hand number must carry the
       token in its own text — named one by one, because a file-wide grep would pass on a page where
       one surface carries the word and four do not, which is exactly the state item 10 found. */
    const SURFACES = ['renderTopN', 'renderHandPanel', 'cfLane', 'revealBlock'];
    for (const fn of SURFACES) {
      const at = shell.indexOf(`function ${fn}(`);
      if (at < 0) { bad.push(`(d) src/shell.html has no ${fn} — the per-hand surface list is stale`); continue; }
      const next = shell.indexOf('\nfunction ', at + 1);
      const body = shell.slice(at, next < 0 ? shell.length : next);
      if (!/tag-e|ESTIMATE|estimate/.test(body)) bad.push(`(d) ${fn} prints a per-hand number without the estimate label`);
    }

    // -- (e) N IS READ, NOT CHOSEN ------------------------------------------------------------------
    for (const it of live) {
      const n = SUB.want(it.cell);
      if (n !== (it.cell.ex || []).length) bad.push(`(e) ${it.key}: the list length ${n} is not the cell's own ex.length`);
      const t = SUB.rows(TX, { rowKey: it.key.split('|')[0], colKey: it.key.split('|')[1], cell: it.cell }, 100);
      const rs = rungsOf(it.key);
      const expect = rs.length <= n ? rs.length : n + 1;
      if (t.rows.length !== expect) bad.push(`(e) ${it.key}: ${t.rows.length} rows where N=${n} over ${rs.length} rungs allows ${expect}`);
    }
    // THE SCAN IS THE WHOLE OF `want`, AND THE CLAIM IS THE IDENTITY. This read one LINE until the
    // P5 red team, and all three refuters walked through the gap it left. A chosen `return 6;`
    // written on the second line of a reformatted `want` passed I47 outright — only
    // test/subcell.test.mjs, whose window already ran to the closing brace, refused it, so the
    // shipped GATE was weaker than the test standing behind it. And a chosen SIX spelled without
    // digits — `var NSIX = 'aaaaaa'.length` returned in the read's place — passed the gate AND
    // every test, because the old clause was a digit regex and the equality beside it is vacuous
    // while every live cell ships exactly six examples: `read` and `chosen 6` are observationally
    // identical everywhere the page renders. Both were re-run against the clause below and both
    // now fail. What is asserted is no longer "no digits here" but the thing METHODOLOGY claims —
    // `want` IS the read, textually — so a cap, a `Math.min`, or a length laundered through a
    // string cannot enter it from anywhere in the block. That makes any rewrite of this one line a
    // deliberate re-decision, which is the correct cost for a function whose whole job is to have
    // no opinion. (docs/refutations/P5.md)
    const wantBody = bodyOf(block.src, 'function want(');
    if (wantBody === null) bad.push('(e) the block has no `want(` whose body this clause can read');
    for (const lit of String(wantBody).match(/[0-9]+/g) || []) {
      if (Number(lit) !== 0) bad.push(`(e) the block chooses a list length (${lit}) instead of reading one`);
    }
    const wantNorm = stripComments(String(wantBody)).replace(/\s+/g, ' ').trim();
    if (wantBody !== null && wantNorm !== WANT_IDENTITY) {
      bad.push(`(e) want() is not the identity read \`${WANT_IDENTITY}\` — it is \`${wantNorm}\``);
    }

    // -- (f) THE vs-3-BET NODE GETS NO POINTS NUMBER ------------------------------------------------
    if (SUB.scored('3bet') !== false) bad.push('(f) the block scores the vs-3-bet node, which cuts on eqVs3bet');
    for (const node of PCT_NODES) if (SUB.scored(node) !== true) bad.push(`(f) the block declines to score ${node}`);
    if (!/eqVs3bet/.test(String(SUB.reason))) bad.push('(f) the vs-3-bet reason does not name what the node cuts on');
    let nulls = 0;
    for (const it of live) {
      const t = SUB.rows(TX, { rowKey: it.key.split('|')[0], colKey: it.key.split('|')[1], cell: it.cell }, null);
      for (const r of t.rows) { if (r.delta !== null) bad.push(`(f) ${it.key}: a points delta survived the vs-3-bet path`); nulls++; }
    }
    /* and the page must actually take that path: the base it passes is guarded by `scored` */
    if (!/scored \? ev\.sc\[rec\.i\] : null/.test(shell)) {
      bad.push('(f) renderTopN no longer guards the base it passes with SUBCELL.scored');
    }

    G('I47', bad.length === 0,
      `the sub-cell top-N is an ordering inside the cell, labelled estimate, and structurally unable to reach the tiers `
      + `(V3-PLAN §4 item 10, §7.2's I47 row, METHODOLOGY §2.4). `
      + `(a) the SHIPPED @subcell block — sliced out of src/shell.html and evaluated here rather than `
      + `re-implemented — resolves the ${live.length} live cells into ${rungTotal} adjRaw rungs `
      + `(${singles} cells hold one, the deepest holds ${maxRungs}), and the enumeration RECONSTRUCTS the `
      + `shipped model: Σ rung combos = ${comboTotal} = model.meta.comboTotal cell by cell, and every `
      + `cell's combo-weighted rung mean rounds to its shipped adjMean at the emitter's own precision. `
      + `§2.4 records the sub-layer's partition identity (D3/I17) as a loss with "no honest replacement `
      + `at the cell layer"; that was true of the MEASURED identity and this is a structural one, which `
      + `is why it can exist. `
      + `(b) NO PER-HAND CLAIM ENTERS THE PERCENTILE SORT, three ways: over ${sortSweeps} (pos, node, VPIP) `
      + `sorts the population is exactly cellList — ${sortRows} rows, every one a live cell, weighing `
      + `${model.meta.comboTotal} combos each time, none carrying any of {${PER_HAND.join(', ')}}; handAdjust `
      + `appears ${uses} time in policy.mjs and it is the declaration, so the layer's only per-hand `
      + `arithmetic has ZERO call sites inside the layer; and enumerating every rung of every cell and `
      + `scoring all ${badged} rows the page would render BETWEEN two cold solves leaves the tier string `
      + `identical. `
      + `(c) §2.4's AUTOPSY IS RE-MEASURED, NOT QUOTED. Its stated reason for never re-cutting the sub `
      + `layer into the sort — "inserting them would have moved every other cell's tier" — is executed `
      + `here over ${damage.length} percentile seats: inserting the rungs as rows moves ${totMoved} cells `
      + `across the aggressive line and SPLITS ${totSplit} more onto both sides of it, worst at `
      + `${worst.pos}/${worst.node}/VPIP ${worst.vPct} (${worst.moved} moved, ${worst.split} split, the cut `
      + `score moving ${worst.drop >= 0 ? '-' : '+'}${Math.abs(worst.drop).toFixed(2)} points as ${worst.rows} `
      + `rows replace ${worst.cells}). A cell `
      + `that is split does not have a tier at all, which is the "hypothetical about a grid that was not `
      + `being painted" in one number. The page does none of this: the shipped sort is clause (b)'s. `
      + `(d) EVERY PER-HAND NUMBER WEARS THE WORD. All ${badged} rows carry badge:'estimate' as DATA rather `
      + `than as prose, and all ${SURFACES.length} per-hand surfaces in the shell carry the token in their own `
      + `text (${SURFACES.join(', ')}). TWO OF THOSE FAILED WHEN THIS GATE WAS WRITTEN — the hand panel's `
      + `margin box and the drill reveal's margin line have carried the within-cell adjustment since v1 `
      + `and said so nowhere — and were repaired rather than scoped out. `
      + `(e) N IS READ: the list is the cell's own ex.length rungs plus the floor rung when one is cut off, `
      + `and \`want()\` contains no chosen number, so item 10 ships ZERO new constants. `
      + `(f) at vs-3-bet the list keeps its ordering and drops its magnitudes — ${nulls} readings come back `
      + `delta:null and the reason names eqVs3bet — which is §2.4's "at the vs-3-bet node it could not say `
      + `anything at all" honoured rather than worked around.`
      + (bad.length ? ` — ${bad.length} problems, first: ${bad[0]}` : ''));
    } },

    ],
  };
}
