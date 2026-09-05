/**
 * test/subcell.test.mjs — the page's sub-cell rung table, pinned to a brute-force enumeration of
 * every 4-card hand (V3-PLAN §4 item 10, §7.2's I47 row).
 *
 * WHY A MIRROR TEST AND NOT A UNIT TEST. `@subcell` ships a COMBINATORIAL shortcut: `rowOf` reads
 * only ranks, so the 270,725 combos factor into 1,820 rank multisets times their legal suit
 * assignments, and a cell walks only the multisets in its own row. That is a real optimisation and
 * real optimisations are where partitions quietly stop partitioning — a suit-assignment loop that
 * double-counts a pair, or that misses the quads case, would still produce a plausible-looking
 * list. So the block is compared against the thing it is a shortcut for: all 270,725 hands
 * enumerated the slow way, bucketed by (cell, adjRaw), rung for rung and combo for combo.
 *
 * The `new Function` slicing trick is `test/ui-mode.test.mjs`'s and `test/ui-payoff-mirror.test.mjs`'s,
 * for the same reason both of those give: the thing under test has to be the text that ships. The
 * block takes its taxonomy as an ARGUMENT precisely so this file can drive it with
 * `scripts/lib/taxonomy.mjs` — the same module the build inlines into the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rowOf, colOf, adjRaw, nutSuited, danglerCount, domDistinct } from '../scripts/lib/taxonomy.mjs';
import { handAdjust } from '../scripts/lib/policy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = readFileSync(join(ROOT, 'src', 'shell.html'), 'utf8');
const MODEL = JSON.parse(readFileSync(join(ROOT, 'data', 'model.json'), 'utf8'));

const START = '/* @subcell';
const END = '/* @end:subcell */';
const a = SHELL.indexOf(START);
const b = SHELL.indexOf(END);
assert.ok(a > 0 && b > a, 'src/shell.html must carry the @subcell markers');
const SRC = SHELL.slice(a, b);

/** the shipped block, evaluated standalone — no page, no MODEL, no globals */
const SUBCELL = new Function(`${SRC}\nreturn SUBCELL;`)();

/** the taxonomy adapter, built from the module the build inlines rather than from a copy of it */
const TX = {
  classify: (cards) => ({ row: rowOf(cards), col: colOf(cards), key: `${rowOf(cards)}|${colOf(cards)}` }),
  features: (cards) => ({ danglers: danglerCount(cards), nutSuited: !!nutSuited(cards),
    adjRaw: adjRaw(cards), dom: domDistinct(cards) }),
  colOf,
  nutSuited,
};

const LIVE = Object.keys(MODEL.cells).filter((k) => MODEL.cells[k].combos);

// ---------------------------------------------------------------------------
// the ground truth: every hand, the slow way
// ---------------------------------------------------------------------------
/** cellKey -> Map(adjRaw -> {combos, first}) where `first` is the rank-highest hand at that rung */
const TRUTH = (() => {
  const out = new Map();
  const h = [0, 0, 0, 0];
  for (let p = 0; p < 52; p++) {
    h[0] = p;
    for (let q = p + 1; q < 52; q++) {
      h[1] = q;
      for (let r = q + 1; r < 52; r++) {
        h[2] = r;
        for (let s = r + 1; s < 52; s++) {
          h[3] = s;
          const key = `${rowOf(h)}|${colOf(h)}`;
          let m = out.get(key);
          if (!m) { m = new Map(); out.set(key, m); }
          const ar = adjRaw(h);
          const e = m.get(ar);
          /* rank-descending order, the block's own tie-break: [r0,r1,r2,r3] sorted high-to-low,
             compared lexicographically */
          const ranks = h.map((c) => c >> 2).sort((x, y) => y - x);
          if (!e) m.set(ar, { combos: 1, best: ranks });
          else {
            e.combos++;
            for (let i = 0; i < 4; i++) {
              if (ranks[i] === e.best[i]) continue;
              if (ranks[i] > e.best[i]) e.best = ranks;
              break;
            }
          }
        }
      }
    }
  }
  return out;
})();

test('the ground truth is the whole hand space', () => {
  let n = 0;
  for (const m of TRUTH.values()) for (const e of m.values()) n += e.combos;
  assert.equal(n, 270725, 'C(52,4)');
  /* 123, not the grid's 145: the 22 structurally empty cells (METHODOLOGY §2.3) are empty because
     no hand can reach them, so a full enumeration never names one. That is also why the rung table
     below can be compared to the shipped `combos` with nothing left over. */
  assert.equal(TRUTH.size, 123, 'the live cells, and only those');
  assert.deepEqual([...TRUTH.keys()].sort(), LIVE.slice().sort());
});

// ---------------------------------------------------------------------------
// self-containment
// ---------------------------------------------------------------------------
test('the block is self-contained — it reaches for no page and no model', () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const re of [/\bdocument\b/, /\bwindow\b/, /(?<![A-Za-z0-9_])S\./, /(?<![A-Za-z0-9_.])\$\(/,
    /\bMODEL\b/, /(?<![A-Za-z0-9_.])TX\b/, /(?<![A-Za-z0-9_.])CK\b/]) {
    assert.ok(!re.test(code), `@subcell must not reference ${re}`);
  }
});

test('N IS READ, NOT CHOSEN: the block carries no top-N literal', () => {
  /* The list length is `cell.ex.length` — the same N the Example hands grid already renders — so
     item 10 introduces no constant for §6 to anchor. The failure this guards is someone "fixing"
     an empty list by typing a 6, which would create an unanchored constant in a marked block that
     no gate in §7 knows about. `want` must read the cell and nothing else. */
  const src = SRC.slice(SRC.indexOf('function want('));
  const body = src.slice(0, src.indexOf('\n', src.indexOf('}', src.indexOf('{'))));
  assert.match(body, /cell\.ex\.length/);
  /* the empty-cell fallback is a legal 0; anything larger would be a chosen N */
  for (const lit of body.match(/[0-9]+/g) || []) {
    assert.ok(Number(lit) === 0, `want() must contain no chosen length — found ${lit} in: ${body}`);
  }
  for (const key of LIVE) {
    assert.equal(SUBCELL.want(MODEL.cells[key]), MODEL.cells[key].ex.length, key);
  }
  assert.equal(SUBCELL.want({}), 0, 'a cell with no shipped examples asks for no list at all');
});

// ---------------------------------------------------------------------------
// the rung table, against the enumeration
// ---------------------------------------------------------------------------
test('every live cell reproduces the brute-force rung table exactly', () => {
  let rungs = 0;
  let combos = 0;
  for (const key of LIVE) {
    const [row, col] = key.split('|');
    const got = SUBCELL.rungs(TX, row, col);
    const want = TRUTH.get(key);
    assert.equal(got.length, want.size, `${key}: rung count`);
    let prev = Infinity;
    for (const g of got) {
      assert.ok(g.adj < prev, `${key}: rungs come strongest-first and never tie`);
      prev = g.adj;
      const w = want.get(g.adj);
      assert.ok(w, `${key}: rung adjRaw ${g.adj} does not exist`);
      assert.equal(g.combos, w.combos, `${key}: rung ${g.adj} combo count`);
      /* the representative is a REAL hand of this cell, at this rung, and it is the rank-highest
         one — the tie-break the block documents */
      assert.equal(`${rowOf(g.ex)}|${colOf(g.ex)}`, key, `${key}: representative is in the cell`);
      assert.equal(adjRaw(g.ex), g.adj, `${key}: representative sits on its own rung`);
      assert.equal(new Set(g.ex).size, 4, `${key}: representative is four distinct cards`);
      assert.deepEqual(g.ex.map((c) => c >> 2).sort((x, y) => y - x), w.best,
        `${key}: representative is the rank-highest hand at rung ${g.adj}`);
      combos += g.combos;
    }
    rungs += got.length;
  }
  assert.equal(combos, 270725, 'the live cells account for every combo in the deck');
  assert.ok(rungs > 400 && rungs < 600, `the grid resolves into ${rungs} rungs in total`);
});

test('THE PARTITION IDENTITY: the rungs reconstruct the shipped combos and adjMean', () => {
  /* This is what makes the list a reading of the shipped model rather than a second model beside
     it. §2.4's removed layer had exactly one identity of this kind (D3/I17) and losing it was the
     part of the cut that was recorded as a loss; the rung table is structural rather than measured,
     so it keeps one — and if the page's classifier and the emitter's ever disagree about which cell
     a hand is in, this is the assertion that says so. */
  for (const key of LIVE) {
    const [row, col] = key.split('|');
    const rs = SUBCELL.rungs(TX, row, col);
    let n = 0;
    let s = 0;
    for (const r of rs) { n += r.combos; s += r.adj * r.combos; }
    assert.equal(n, MODEL.cells[key].combos, `${key}: Σ rung combos`);
    const mean = s / n;
    const shipped = MODEL.cells[key].adjMean;
    const dp = String(shipped).includes('.') ? String(shipped).split('.')[1].length : 0;
    assert.equal(Number(mean.toFixed(dp)), shipped, `${key}: adjMean ${mean} vs shipped ${shipped}`);
  }
});

test('a second call returns the same object — the table is memoised per cell', () => {
  const one = SUBCELL.rungs(TX, 'RUN2', 'DS');
  assert.ok(Object.is(one, SUBCELL.rungs(TX, 'RUN2', 'DS')));
});

// ---------------------------------------------------------------------------
// the arithmetic, mirrored to the layer
// ---------------------------------------------------------------------------
test('adjust() IS handAdjust(), to the last bit, over every rung of every cell', () => {
  let n = 0;
  for (const key of LIVE) {
    const [row, col] = key.split('|');
    const { adjMean } = MODEL.cells[key];
    for (const r of SUBCELL.rungs(TX, row, col)) {
      for (const S of [1, 12.5, 41.973, 100, 187.25]) {
        assert.ok(Object.is(SUBCELL.adjust(S, r.adj, adjMean), handAdjust(S, r.adj, adjMean)),
          `${key} rung ${r.adj} at S=${S}`);
        n++;
      }
    }
  }
  assert.ok(n > 2000, `${n} readings compared`);
});

// ---------------------------------------------------------------------------
// the rows the page renders
// ---------------------------------------------------------------------------
const recOf = (key) => ({ rowKey: key.split('|')[0], colKey: key.split('|')[1], cell: MODEL.cells[key] });

test('EVERY ROW CARRIES ITS OWN estimate BADGE, as data rather than as prose', () => {
  for (const key of LIVE) {
    const t = SUBCELL.rows(TX, recOf(key), 100);
    assert.equal(t.badge, 'estimate', `${key}: the list`);
    assert.ok(t.rows.length > 0);
    for (const r of t.rows) assert.equal(r.badge, 'estimate', `${key}: row at rung ${r.adj}`);
  }
});

test('the list is at most N rungs plus the floor, and the floor is only shown when it is cut off', () => {
  for (const key of LIVE) {
    const t = SUBCELL.rows(TX, recOf(key), 100);
    const n = SUBCELL.want(MODEL.cells[key]);
    const rs = SUBCELL.rungs(TX, ...key.split('|'));
    assert.equal(t.rungs, rs.length, key);
    assert.equal(t.exact, true, `${key}: the reconstruction is exact, so the list renders`);
    if (rs.length <= n) {
      assert.equal(t.rows.length, rs.length, `${key}: a short cell shows every rung`);
      assert.ok(!t.rows.some((r) => r.floor), `${key}: nothing is cut off, so nothing is flagged`);
    } else {
      assert.equal(t.rows.length, n + 1, `${key}: N rungs plus the floor`);
      assert.equal(t.rows.filter((r) => r.floor).length, 1);
      const last = t.rows[t.rows.length - 1];
      assert.ok(last.floor);
      assert.equal(last.adj, rs[rs.length - 1].adj, `${key}: the floor row is the weakest rung`);
      assert.equal(last.rank, rs.length);
    }
    /* the shares are the rung combos over the cell's, and they sum to one over the whole table */
    let share = 0;
    for (const r of rs) share += r.combos / MODEL.cells[key].combos;
    assert.ok(Math.abs(share - 1) < 1e-12, `${key}: shares partition the cell`);
  }
});

test('the delta is the interpolation and nothing else', () => {
  for (const key of ['RUN2|DS', 'TRASH|SS', 'AA_BIGPAIR|RB', 'BROADWAY_RUN|SSA']) {
    const cell = MODEL.cells[key];
    const t = SUBCELL.rows(TX, recOf(key), 137.5);
    for (const r of t.rows) {
      assert.ok(Object.is(r.delta, handAdjust(137.5, r.adj, cell.adjMean) - 137.5), `${key} rung ${r.adj}`);
      assert.equal(r.delta >= 0, r.adj >= cell.adjMean, `${key}: sign follows the cell mean`);
    }
  }
});

test('THE vs-3-BET NODE GETS NO POINTS NUMBER — §2.4\'s own sentence, kept', () => {
  /* "At the vs-3-bet node it could not say anything at all, because that node cuts on eqVs3bet."
     The removed layer's answer was to print a number anyway. This one declines: `scored` is false
     there, the caller passes no base, and every delta comes back null with the reason to render
     in its place. */
  assert.equal(SUBCELL.scored('3bet'), false);
  for (const node of ['rfi', 'limps', 'raise']) assert.equal(SUBCELL.scored(node), true, node);
  assert.match(SUBCELL.reason, /eqVs3bet/);
  for (const key of LIVE) {
    const t = SUBCELL.rows(TX, recOf(key), null);
    for (const r of t.rows) {
      assert.equal(r.delta, null, `${key}: rung ${r.adj} must carry no points delta`);
      assert.equal(r.badge, 'estimate', `${key}: and still says what it is`);
    }
  }
});

test('a cell whose enumeration does not reconstruct it is refused, not shown', () => {
  /* `exact` is the page's own tripwire on the two taxonomy halves disagreeing. Feed it a cell whose
     shipped `combos` is wrong and it must come back false rather than rendering a partition that
     does not partition anything. */
  const cell = { ...MODEL.cells['RUN2|DS'], combos: MODEL.cells['RUN2|DS'].combos + 1 };
  const t = SUBCELL.rows(TX, { rowKey: 'RUN2', colKey: 'DS', cell }, 100);
  assert.equal(t.exact, false);
});
