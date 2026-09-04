// checkdown-matrix.mjs — THE MEASURED PAIRWISE CHECKDOWN PAYOFF MATRIX (V3-PLAN §3.3, the B2
// pre-stage). PORTED VERBATIM FROM PHASE-0 SPIKE S-A, `scripts/spikes/sa-matrix.mjs` on branch
// `worktree-wf_5a8a2571-726-2` — the construction is S-A's and the credit is S-A's; what is new
// here is the module's shape, one extra counter (see PER-CELL LIVE BOARDS below) and the fact that
// it now ships as a payoff source instead of as a spike fixture.
//
// LABEL, loud and up front, in S-A's own words: every number this file produces is a CHECKDOWN
// payoff — hero's share of the pot when the hand is dealt to showdown with NO POSTFLOP BETTING. It
// is not the payoff of a real PLO hand. It is "a game where postflop does not exist", which is
// exactly what `source: 'checkdown'` says downstream and what I35's label clause renders on-screen.
//
// WHY THIS EXISTS AND WHAT IT REPLACES. P2 solved the accessor's PROJECTION stub, and the projection
// is EXACTLY SEPARABLE — `ev(A,B) - 0.5 = (a_A - a_B)/2` to 1.1e-16 — so its equilibrium is a pure
// threshold in the shipped equity ladder and cannot express a blocker, a card-removal effect, or any
// pairwise structure whatsoever (§3.2's `Measured (P2 lane cfr)` block records that as a property to
// know before P3 reads anything into a solved strategy). This matrix is the thing that falsifies it:
// it is still checkdown, it is still zero-sum, and it is genuinely PAIRWISE.
//
// THE METHOD (shared-board / common-random-numbers, the mc.mjs idiom), unchanged from S-A:
//   for each board b:
//     deal 5 board cards from the full 52
//     for each of the 123 non-empty cells: draw ONE combo uniformly from the WHOLE cell; if it
//       collides with the board the cell SITS THIS BOARD OUT — it is not redrawn
//     for each unordered cell pair (i, j): if both cells are live and the two combos are
//       card-disjoint, score the showdown (1 / 0.5 / 0) into that pair's accumulator
// Sharing the board across all 7,503 off-diagonal pairs is the common-random-numbers discipline
// mc.mjs already uses: it makes the RANKING noise between pairs far smaller than the absolute noise,
// which is what the solver actually keys on.
//
// THE SINGLE-DRAW RULE IS LOAD-BEARING, NOT AN OPTIMISATION — S-A's finding, carried here with its
// measurement because this is the file that could lose it. S-A's first cut redrew on a board
// collision (up to 12 tries). That is a DIFFERENT PROBABILITY MEASURE and it is wrong: redrawing
// gives every board equal weight, whereas the deal being modelled — hero's hand first, board from
// what is left — weights a board in proportion to the number of cell-i hands it leaves alive.
// Measured against the shipped equity column the redraw version read +1.16 pt high on average and
// +5.33 pt high on `RUN0_HIGH|RB` — a bias larger than every effect v3 intends to model. With ONE
// draw and a sit-out the accepted samples are uniform over disjoint (board, handA, handB) triples
// exactly:
//     P(b, A, B) = 1/C(52,5) * 1/|i| * 1/|j|   — constant over every disjoint triple.
// The price is acceptance: a cell is live on ~66% of boards and a pair lands on ~30%, so a board
// buys ~0.30 samples per pair instead of ~0.69. `DRAW_TRIES = 1` is that measure. Raising it is not
// a speed/accuracy trade, it is a different estimator.
//
// EXACTNESS CLAUSES (structural, not measured):
//   E[i][i] = 0.5 exactly — two hands drawn from one cell are exchangeable.
//   E[i][j] + E[j][i] = 1 exactly — stored once per unordered pair and MIRRORED. That is what keeps
//   the solved game exactly zero-sum, so a non-zero v1 + v2 downstream is a solver bug, never noise.
//
// PER-CELL LIVE BOARDS — the one datum S-A's builder did not keep, added here for a stated reason.
// The diagonal's VALUE is exact by exchangeability, but I33 clause (d) demands an `se` that is
// positive and DERIVED FROM THE TRIAL COUNT THAT ACTUALLY RAN, never typed. S-A counted trials only
// for off-diagonal pairs, so a diagonal served through the accessor would have no honest `n`.
// `cellLive[i]` is the number of boards on which cell i was live; it feeds `se` and NOTHING ELSE —
// `E` is untouched by it.
//
// THE BOARD BUDGET: 400,000, AND IT IS THE TOLERANCE'S OWN REGIME RATHER THAN A NUMBER ANYBODY
// CHOSE. The first B2 run shipped 25,000 — the top of S-A's out-of-sample exploitability table
// (12.5k -> 0.053% of pot, 25k -> 0.0015%, 50k -> 0.0068%, 100k -> 0.0091%, 200k -> 0.0041%, 400k
// -> 0.0024%) — and I35's live payoff axis went RED on it: the two independently sampled matrices
// gave values 0.1508% (T100) / 0.1568% (T40) of pot apart against a 0.15% gate. That was not an
// unlucky seed pair. `solver.twoSeedTolPot` = 0.15% is anchored as "~4x S-A's measured spread", and
// S-A measured that spread (0.035%) AT 400,000 BOARDS; the per-entry `se` falls as boards^-1/2, so
// at 25,000 the expected spread is ~4x S-A's and the gate sat at ~1x the measurement. The two
// numbers came from two different S-A tables and were jointly unsatisfiable — over four 25k
// matrices the six pairwise spreads ran {0.151, 0.011, 0.128, 0.162, 0.023, 0.139}% at T100, and at
// 12,500 boards the maximum was 0.337%.
//
// The resolution (V3-PLAN §3.3's `Adjudicated (P3 relaunch)` block, decision 13) does not widen the
// tolerance and does not pick a seed: it builds the matrices at the board count the anchor was
// MEASURED at. 400,000 is S-A's own regime, so the anchor's stated ~4x margin becomes a measurement
// again instead of a claim. ZERO NEW CONSTANTS still holds — this count is not a band endpoint
// somebody preferred, it is the number the tolerance's own anchor was read off.
//
// AND IT REPRODUCES. At the shipped count the live payoff axis reads 0.0659% (T100) / 0.0615% (T40)
// of pot against S-A's 0.035%, leaving 2.3x / 2.4x under the unchanged 0.15% gate; the per-entry
// `se` is 0.147 equity pts against S-A's 0.143; the residual band is mean -0.094 / p95 0.542 / max
// 0.892 pt on sample A and -0.073 / 0.541 / 0.784 on B against S-A's -0.112 / 0.577 / 0.827; and
// the solved heads-up baseline lands at -0.14164 bb to SB with SB opening 88.86% and BB folding
// 0.155%, against S-A's -0.1418 / 89.3% / 0.16%. The value reproduces to 1.6e-4 bb.
//
// AND THAT IS WHY THE MATRIX IS NOW A SHIPPED ARTIFACT rather than a build in `build()`. One 400k
// matrix costs ~20 s single-thread (measured, this box; wall time is a property of the machine,
// which is why no number here asserts it), so building the pair inside every verify run would put
// ~40 s on a wall whose soft ceiling is 41.9 s. Under V3-PLAN §0.4's identity leg (b) the matrices
// enter as a NEW ARTIFACT, in the open: `data/checkdown-matrix.json`, generated ONCE by
// `scripts/generate-checkdown-matrix.mjs` (both seeds, in parallel), carrying in its `meta` the
// generator inputs — seed names, board count, a hash of the source that built it — plus a content
// hash. `shippedMatrices()` READS IT BACK, so verify pays milliseconds and its wall is the cost of
// the solves alone. The determinism claim is a `--check`-style gate owned by the generator
// (`node scripts/generate-checkdown-matrix.mjs --check` rebuilds both in memory from the recorded
// inputs and byte-compares against disk); it is NOT run inside verify, because that would cost the
// 40 s the artifact exists to avoid, and it joins the milestone's GREEN definition at the close-out
// instead. A cheap in-verify clause under I33 asserts the artifact's meta and its structural
// invariants every run.
//
// THE SEEDS ARE NAMES, NOT NUMBERS. Two independent matrices are needed for I35's two-seed PAYOFF
// axis (S-A's own reading of that clause: "value spread across independent payoff samples"). They
// are named `rundown-v3/checkdown-A` and `rundown-v3/checkdown-B`, fixed HERE, before anything was
// solved on them — a seed picked after looking at the answer is not a seed. `fnv1a` turns the name
// into the Rng's state, so the name IS the reproduction instruction.
//
// SCOPE, STATED SO IT IS NOT REDISCOVERED BY A GATE FAILING. This file's NAME matches neither I33
// clause (e)'s `CONSUMER` scope `/(cfr|solver|equilib|ev-cut)/i` nor clause (g)'s `MEMO_SCOPE`
// `/(payoff|cfr|solver|equilib|ev-cut)/i`. That is deliberate and it is the honest reading: this
// module is a PRODUCER of a payoff table, not a consumer of the accessor — it must not import
// `payoff.mjs` (that would be circular) and clause (e) would demand exactly that of a file inside
// its scope. Nothing here memoizes a payoff either: `shippedMatrices()` holds one loaded pair in a
// plain module variable, which is a table read, not a memo — there is no request-shaped key at all.
// The accessor route that SERVES this table lives in `payoff.mjs`, inside clause (e)'s subject and
// clause (g)'s scope, where it belongs.
//
// NODE-ONLY. This never reaches the page: P3 ships the SOLVED surface (`data/equilibrium.json`,
// full build only, gate D9), never the solver's inputs. So there is no `@browser-cut` here.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Rng, fnv1a, makeTriplePartials, fillTriplePartials, bestOmaha } from './eval5.mjs';
import { enumerateAll } from './taxonomy.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

/** exactly one draw per cell per board — see THE SINGLE-DRAW RULE in the header */
const DRAW_TRIES = 1;

/**
 * The shipped board budget: 400,000 — the regime `solver.twoSeedTolPot` was ANCHORED at.
 *
 * Not an opinion constant, and not a band endpoint either. S-A measured the payoff-axis spread the
 * 0.15% tolerance quotes (0.035% of pot) at 400,000 boards; building the shipped matrices anywhere
 * else makes the anchor's "~4x margin" a claim rather than a measurement, which is exactly what the
 * first B2 run measured going wrong at 25,000 (spread 0.1508% / 0.1568% against the 0.15% gate).
 * See THE BOARD BUDGET in the header and V3-PLAN §3.3's `Adjudicated (P3 relaunch)` block.
 */
export const BOARDS = 400000;

/** where the generated pair lives, relative to the repository root */
export const ARTIFACT = 'data/checkdown-matrix.json';

/** the script that writes it — named here so a missing artifact can say how to make one */
export const GENERATOR = 'scripts/generate-checkdown-matrix.mjs';

/**
 * The two independent payoff samples, NAMED, and named before anything was solved on them.
 *
 * `[0]` is the primary — the matrix a request with no seed, or a numeric seed, is answered from.
 * `[1]` is the independent second sample that makes I35's two-seed PAYOFF axis non-vacuous.
 */
export const SEEDS = Object.freeze(['rundown-v3/checkdown-A', 'rundown-v3/checkdown-B']);

/**
 * Build the checkdown payoff matrix over the non-empty cells. S-A's `buildMatrix`, verbatim in its
 * arithmetic, extended only by `cellLive` and by materialising the trial counts as full matrices.
 *
 * @param {{boards?: number, seed?: string, onProgress?: (b: number) => void}} cfg
 * @returns {{NC: number, keys: string[], q: Float64Array, combos: Float64Array,
 *            E: Float64Array, R: Float64Array, N: Int32Array, D: Int32Array,
 *            cellLive: Int32Array, meta: object}}
 *          `E` is the payoff (hero = row), `N` the live-and-disjoint trial count behind each entry
 *          (diagonal = `cellLive`), `D` the both-cells-live count, `R = N/D` the disjoint rate.
 */
export function buildMatrix(cfg = {}) {
  const boards = cfg.boards ?? BOARDS;
  const seed = cfg.seed ?? SEEDS[0];
  const t0 = Date.now();

  const en = enumerateAll();
  const live = [];
  for (let c = 0; c < en.cellKeys.length; c++) if (en.combos[c] > 0) live.push(c);
  const NC = live.length; // 123
  const keys = live.map((c) => en.cellKeys[c]);
  const combos = Float64Array.from(live, (c) => en.combos[c]);
  const total = combos.reduce((a, b) => a + b, 0);
  const q = Float64Array.from(combos, (x) => x / total);
  const start = Int32Array.from(live, (c) => en.cellStart[c]);
  const len = Int32Array.from(live, (c) => en.combos[c]);
  const byCell = en.byCell;

  // upper-triangle pair indexing: idx(i,j) = rowBase[i] + (j - i - 1), i < j
  const rowBase = new Int32Array(NC);
  let np = 0;
  for (let i = 0; i < NC; i++) { rowBase[i] = np; np += NC - i - 1; }
  /* TWICE hero's showdown score, as an exact integer: 2 for a win, 1 for a chop, 0 for a loss.
     The float `acc` this replaces held W + T/2; `wins2 = 2W + T` is the same number scaled by two
     and it fits an Int32 at any board count this file will ever run (2 * 400,000 = 800,000). The
     scaling is not an optimisation — it is what lets the artifact store INTEGERS and reconstruct
     `E` BIT-IDENTICALLY on the way back in: `(wins2/2)/cnt` divides by a power of two first, which
     is exact, so the loaded matrix is the built matrix to the last ulp rather than to a tolerance. */
  const wins2 = new Int32Array(np);
  const cnt = new Int32Array(np);   // boards where the pair was live AND card-disjoint
  const den = new Int32Array(np);   // boards where both cells were live (disjoint or not)
  const cellLive = new Int32Array(NC);  // boards where the cell drew a hand that missed the board

  const rng = new Rng(fnv1a(seed));
  const tp = makeTriplePartials();
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  const score = new Int32Array(NC);
  const mLo = new Int32Array(NC);
  const mHi = new Int32Array(NC);
  const live_ = new Uint8Array(NC);

  let boardsUsed = 0;
  for (let b = 0; b < boards; b++) {
    for (let i = 0; i < 52; i++) deck[i] = i;
    for (let i = 0; i < 5; i++) {
      const j = i + ((rng.next() % (52 - i)) >>> 0);
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
      board[i] = deck[i];
    }
    fillTriplePartials(board, tp);
    let bLo = 0, bHi = 0;
    for (let i = 0; i < 5; i++) {
      const c = board[i];
      if (c < 32) bLo |= (1 << c); else bHi |= (1 << (c - 32));
    }

    for (let i = 0; i < NC; i++) {
      live_[i] = 0;
      const s0 = start[i], n = len[i];
      for (let tries = 0; tries < DRAW_TRIES; tries++) {
        const pk = byCell[s0 + ((rng.next() % n) >>> 0)];
        const c0 = pk & 63, c1 = (pk >>> 6) & 63, c2 = (pk >>> 12) & 63, c3 = (pk >>> 18) & 63;
        let lo = 0, hi = 0;
        if (c0 < 32) lo |= (1 << c0); else hi |= (1 << (c0 - 32));
        if (c1 < 32) lo |= (1 << c1); else hi |= (1 << (c1 - 32));
        if (c2 < 32) lo |= (1 << c2); else hi |= (1 << (c2 - 32));
        if (c3 < 32) lo |= (1 << c3); else hi |= (1 << (c3 - 32));
        if ((lo & bLo) || (hi & bHi)) continue;
        mLo[i] = lo; mHi[i] = hi;
        score[i] = bestOmaha(c0, c1, c2, c3, tp);
        live_[i] = 1;
        break;
      }
      if (live_[i]) cellLive[i]++;
    }

    for (let i = 0; i < NC; i++) {
      if (!live_[i]) continue;
      const si = score[i], li = mLo[i], hi_ = mHi[i], base = rowBase[i];
      for (let j = i + 1; j < NC; j++) {
        if (!live_[j]) continue;
        const k = base + (j - i - 1);
        den[k]++;
        if ((li & mLo[j]) || (hi_ & mHi[j])) continue;
        const sj = score[j];
        wins2[k] += si > sj ? 2 : (si === sj ? 1 : 0);
        cnt[k]++;
      }
    }
    boardsUsed++;
    if (cfg.onProgress && (b % 5000) === 0) cfg.onProgress(b);
  }

  const m = materialise({ keys, combos, wins2, cnt, den, cellLive, boards: boardsUsed, seed });
  m.meta.buildMs = Date.now() - t0;
  return m;
}

/**
 * THE ONE CODE PATH from raw counters to a served matrix — shared by `buildMatrix` and by the
 * artifact loader, deliberately and for a gate's sake.
 *
 * I33's `(route)` clause asserts `meta.seed` and `meta.boards` on the matrices the accessor is
 * handed, and I35 solves on them; if the loader assembled `E`/`R`/`N`/`D`/`meta` its own way, a
 * clause could fire for a WIRING reason — two constructions that disagree — rather than for a
 * measurement reason, which is the failure mode a gate cannot tell you about. One function, two
 * callers: the matrix the generator validated is the matrix verify reads, or neither is.
 *
 * `buildMs` is NOT set here. It is a property of the machine, it is added by `buildMatrix` alone,
 * and it is the reason a loaded matrix's `meta` is otherwise identical to a built one's — the
 * artifact carries no clock, so `--check` can byte-compare.
 *
 * @param {{keys: string[], combos: ArrayLike<number>, wins2: ArrayLike<number>,
 *          cnt: ArrayLike<number>, den: ArrayLike<number>, cellLive: ArrayLike<number>,
 *          boards: number, seed: string}} raw  the upper-triangle counters in `rowBase` order
 */
export function materialise(raw) {
  const keys = [...raw.keys];
  const NC = keys.length;
  const combos = Float64Array.from(raw.combos, Number);
  const total = combos.reduce((a, b) => a + b, 0);
  const q = Float64Array.from(combos, (x) => x / total);
  const wins2 = raw.wins2, cnt = raw.cnt, den = raw.den;
  const cellLive = Int32Array.from(raw.cellLive, Number);

  const rowBase = new Int32Array(NC);
  let np = 0;
  for (let i = 0; i < NC; i++) { rowBase[i] = np; np += NC - i - 1; }

  // materialise the full 123 x 123 matrix, exactly antisymmetric by construction
  const E = new Float64Array(NC * NC);
  // R[i][j] = P(a cell-i hand and a cell-j hand are card-disjoint), 1 on the diagonal by fiat. Not
  // used by the product-of-marginals chance model, but it is what proves the impossible pairs are
  // impossible — and what makes the AA_* x AA_* family's degeneracy visible as a NUMBER rather than
  // as an assertion (I33(h)'s "degeneracy surfaced, never collapsed").
  const R = new Float64Array(NC * NC);
  // the trial counts, mirrored, so `se` can be read for any ORDERED pair. The diagonal carries
  // `cellLive`, which is the honest n behind an exchangeability identity.
  const N = new Int32Array(NC * NC);
  const D = new Int32Array(NC * NC);
  let minCnt = Infinity, sumCnt = 0, zeroPairs = 0;
  const impossible = [];
  for (let i = 0; i < NC; i++) {
    E[i * NC + i] = 0.5;
    R[i * NC + i] = 1;
    N[i * NC + i] = cellLive[i];
    D[i * NC + i] = cellLive[i];
    for (let j = i + 1; j < NC; j++) {
      const k = rowBase[i] + (j - i - 1);
      const n = cnt[k];
      if (n < minCnt) minCnt = n;
      sumCnt += n;
      const e = n > 0 ? (wins2[k] / 2) / n : 0.5;
      if (n === 0) { zeroPairs++; impossible.push([keys[i], keys[j]]); }
      E[i * NC + j] = e;
      E[j * NC + i] = 1 - e;
      const r = den[k] > 0 ? n / den[k] : 0;
      R[i * NC + j] = r; R[j * NC + i] = r;
      N[i * NC + j] = n; N[j * NC + i] = n;
      D[i * NC + j] = den[k]; D[j * NC + i] = den[k];
    }
  }
  // combined product-of-marginals probability mass sitting on pairs that cannot be dealt
  let impossibleMass = 0;
  for (const [ka, kb] of impossible) {
    const a = keys.indexOf(ka), b = keys.indexOf(kb);
    impossibleMass += 2 * q[a] * q[b];
  }

  return {
    NC, keys, q, combos, E, R, N, D, cellLive,
    /* the upper-triangle counters this matrix was materialised FROM, in `rowBase` order and kept
       as integers. `serialize` writes exactly these, which is what makes the artifact a record of
       the measurement rather than a rounding of its results. */
    raw: { wins2, cnt, den },
    meta: {
      boards: raw.boards,
      pairs: np + NC,
      offDiagonalPairs: np,
      minPairSamples: minCnt,
      meanPairSamples: sumCnt / np,
      minCellLive: cellLive.reduce((a, b) => Math.min(a, b), Infinity),
      unsampledPairs: zeroPairs,
      impossiblePairs: impossible,
      impossibleMass,
      seed: raw.seed,
      payoffSource: 'checkdown',
      payoffLabel: 'checkdown to showdown, no postflop betting — a game where postflop does not exist',
    },
  };
}

/**
 * `key -> row index` for one matrix, as a prototype-less plain object.
 *
 * A plain object rather than a `Map`, and prototype-less, for two reasons worth stating. First,
 * `'constructor'` and `'__proto__'` are then UNKNOWN CELL KEYS rather than inherited answers — the
 * same rule `payoff.mjs`'s `cellOf` follows. Second, `payoff.mjs` is inside I33 clause (g)'s memo
 * scope and builds the same index inline for its matrix route (it imports nothing, since the
 * matrices are arguments): a `Map` consulted beside a request is exactly the shape (g)'s detector
 * is built to notice, and it should not have to tell a payoff cache from a table lookup by reading
 * intent. This export is the same construction for callers outside that file.
 */
export function indexOf(m) {
  const idx = Object.create(null);
  for (let i = 0; i < m.keys.length; i++) idx[m.keys[i]] = i;
  return idx;
}

/**
 * The q-weighted marginal of every row, in equity POINTS — the quantity that is comparable to the
 * shipped `cells[k].eq[0]` column, and the one I33 clause (c) compares.
 *
 * `sum_j q[j] * E[i][j]` is hero's share against ONE opponent drawn from the whole population. The
 * shipped number measures the same thing and the two DO NOT AGREE EXACTLY, by construction: the
 * shipped measurement conditions the villain on hero's cards being dead, and this sum uses the raw
 * combo marginal `q`. The residual is the CARD-REMOVAL residual and it is signed — see the clause.
 */
export function marginals(m) {
  const { NC, q, E } = m;
  const out = new Float64Array(NC);
  for (let i = 0; i < NC; i++) {
    let s = 0;
    for (let j = 0; j < NC; j++) s += q[j] * E[i * NC + j];
    out[i] = 100 * s;
  }
  return out;
}

/** combo-weighted mean equity over the whole matrix — 50.0000 exactly is conservation */
export function conservation(m) {
  const mg = marginals(m);
  let s = 0;
  for (let i = 0; i < m.NC; i++) s += m.q[i] * mg[i];
  return s;
}

/**
 * The structurally undealable pairs, as unordered `[keyA, keyB]` — the pairs where 400,000 shared
 * boards produced not one disjoint draw.
 *
 * S-A found 43 of them at 400k boards, every one `AA_*` x `A_BLOCKED` (six aces between two hands,
 * which is two more than a deck has), carrying 3.6e-5 of the combo mass. They are I33 clause (h)'s
 * FIRST LIVE CASE: the accessor answers them `supported:false` with the stored 0.5 on them, which
 * conserves bit-exactly and is loud, rather than collapsing to a checkdown number nobody flagged.
 */
export function undealablePairs(m) {
  return m.meta.impossiblePairs.map((p) => [p[0], p[1]]);
}

// =================================================================================================
// THE ARTIFACT — V3-PLAN §0.4 identity leg (b): a new mechanism entering as a new artifact, in the
// open, with its inputs written down beside it.
// =================================================================================================

/** sha256 of a string, hex — the repository's one hash, as `verify.mjs` uses for `meta.hash` */
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/**
 * The hash of the SOURCE that produces the artifact: this module plus the generator, in that order.
 *
 * It is the honest half of "deterministic from a seed name". A seed and a board count reproduce the
 * matrix only if the code that consumes them has not moved, so the artifact records which code that
 * was. I33's cheap `(artifact)` clause recomputes this every run: edit the construction and forget
 * to regenerate, and the gate says so on the same run rather than at the next `--check`.
 *
 * Deliberately NOT a hash of the whole `scripts/lib` tree. `eval5.mjs` and `taxonomy.mjs` are under
 * gates of their own (D1, V5, the enumeration identities) and hashing them here would make every
 * unrelated edit look like a stale matrix; what this covers is the two files that decide what the
 * numbers MEAN.
 */
export function sourceHash() {
  const self = readFileSync(resolve(HERE, 'checkdown-matrix.mjs'), 'utf8');
  const gen = readFileSync(resolve(ROOT, GENERATOR), 'utf8');
  return sha256(`${self}\n${gen}`);
}

/**
 * The artifact's canonical text: one JSON object, INTEGERS ONLY, newline-terminated.
 *
 * WHAT IS IN IT AND WHY IT IS THE COUNTERS RATHER THAN `E`. Storing `E` would store 15,129 floats
 * per seed whose last bits are a rounding of the thing actually measured; storing `wins2`, `cnt`
 * and `den` stores the measurement, and `materialise` reconstructs `E` from them BIT-IDENTICALLY —
 * `(wins2/2)/cnt` divides by a power of two before the only inexact operation. So the file is a
 * record of trials, not of results, and the reconstruction is an identity rather than a tolerance.
 *
 * WHAT IS DELIBERATELY ABSENT: wall time, Node version, timestamp, machine. All three would make
 * the byte-compare in `--check` fail for reasons that are not the code's, and wall time is a
 * property of the machine — the repository's own doctrine. The generator PRINTS its `buildMs`; the
 * artifact does not carry it.
 *
 * `keys` and `combos` are shared (the two samples index the same abstraction, and `combos` is
 * `taxonomy.enumerateAll()`'s own integer count) — storing them is what lets a reader reconstruct
 * `q` without paying the 0.5 s enumeration.
 */
export function serialize(matrices) {
  const generatorHash = sourceHash();
  const body = {
    note: 'The measured pairwise CHECKDOWN payoff matrix — hero\'s share of the pot at showdown '
      + 'with NO postflop betting, over the 123 non-empty cells. Generated by ' + GENERATOR
      + '; see scripts/lib/checkdown-matrix.mjs for the construction (spike S-A\'s) and '
      + 'V3-PLAN §3.3 for why it is a shipped artifact. Counters, not results: E = (wins2/2)/cnt.',
    meta: {
      seeds: matrices.map((m) => m.meta.seed),
      boards: matrices[0].meta.boards,
      generator: GENERATOR,
      generatorHash,
      contentHash: '',
    },
    keys: [...matrices[0].keys],
    combos: Array.from(matrices[0].combos, Number),
    samples: matrices.map((m) => ({
      seed: m.meta.seed,
      wins2: Array.from(m.raw.wins2),
      cnt: Array.from(m.raw.cnt),
      den: Array.from(m.raw.den),
      cellLive: Array.from(m.cellLive),
    })),
  };
  body.meta.contentHash = sha256(JSON.stringify(body));
  return `${JSON.stringify(body)}\n`;
}

/**
 * Parse the artifact's text back into two served matrices, through `materialise` — the same tail
 * the builder runs, on purpose (see `materialise`'s own note).
 *
 * The content hash is CHECKED here rather than only in the gate, because a corrupt file must fail
 * loudly at the point of use: a matrix half-read is a payoff that is quietly wrong everywhere.
 */
export function deserialize(text) {
  const body = JSON.parse(text);
  const stated = body.meta.contentHash;
  const recomputed = sha256(JSON.stringify({ ...body, meta: { ...body.meta, contentHash: '' } }));
  if (stated !== recomputed) {
    throw new Error(`checkdown-matrix: ${ARTIFACT} fails its own content hash (states ${stated}, `
      + `computes ${recomputed}) — regenerate it with \`node ${GENERATOR}\``);
  }
  return body.samples.map((s) => materialise({
    keys: body.keys, combos: body.combos,
    wins2: Int32Array.from(s.wins2), cnt: Int32Array.from(s.cnt), den: Int32Array.from(s.den),
    cellLive: Int32Array.from(s.cellLive),
    boards: body.meta.boards, seed: s.seed,
  }));
}

/* The shipped pair, LOADED at most once per process and held in a plain module variable.
   NOT A MEMO: there is no request-shaped key here and nothing is looked up — it is one table, read
   when first asked for. The reconstruction happens exactly once per process for a reason the wall
   cares about: doing it per request would put ~15 ms of array work inside the payoff accessor, and
   a per-request table rebuild is also the shape I33 clause (g)'s memo detector is built to notice. */
let SHIPPED = null;

/**
 * The two shipped matrices, in `SEEDS` order, READ FROM THE ARTIFACT once per process.
 *
 * `[0]` is the primary. This used to build them (~40 s for the pair at the shipped board count),
 * which is why it now reads: verify's wall is the cost of the solves plus milliseconds, and the
 * determinism claim moved to the generator's own `--check` (V3-PLAN §3.3's `Adjudicated (P3
 * relaunch)` block). The construction still takes no model — `taxonomy.enumerateAll()` is the deal
 * space and `data/model.json` is never read — which is why the result can be VALIDATED against the
 * shipped equity column rather than being derived from it.
 */
export function shippedMatrices() {
  if (SHIPPED === null) SHIPPED = loadShippedMatrices();
  return SHIPPED;
}

/** read + verify the artifact, with a message that says how to make one if it is not there */
export function loadShippedMatrices(path = resolve(ROOT, ARTIFACT)) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new Error(`checkdown-matrix: ${ARTIFACT} is missing (${e.code}) — it is a generated, `
      + `committed artifact, not a build product of verify. Make it with \`node ${GENERATOR}\` `
      + `(~20 s per seed, both seeds in parallel).`);
  }
  const ms = deserialize(text);
  if (!(ms.length === SEEDS.length && ms.every((m, i) => m.meta.seed === SEEDS[i]))) {
    throw new Error(`checkdown-matrix: ${ARTIFACT} carries [${ms.map((m) => m.meta.seed)}], not the `
      + `named samples [${SEEDS}] — regenerate it with \`node ${GENERATOR}\``);
  }
  return ms;
}

/**
 * BUILD the two shipped matrices from their names. The generator's entry point, and nothing else's.
 *
 * Kept separate from `shippedMatrices()` so that the expensive path has to be ASKED FOR by name: a
 * consumer that reaches for the matrices gets the artifact, and only the script whose job is to
 * write the artifact pays the ~40 s.
 */
export function buildShippedMatrices(boards = BOARDS) {
  return SEEDS.map((seed) => buildMatrix({ boards, seed }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  }));
  const boards = Number(args.boards ?? BOARDS);
  const seeds = args.seed ? [args.seed] : SEEDS;
  for (const seed of seeds) {
    const m = buildMatrix({ boards, seed });
    const und = undealablePairs(m);
    console.log(JSON.stringify({
      seed, boards: m.meta.boards, buildMs: m.meta.buildMs,
      meanPairSamples: +m.meta.meanPairSamples.toFixed(1),
      minPairSamples: m.meta.minPairSamples, minCellLive: m.meta.minCellLive,
      undealable: und.length, mass: m.meta.impossibleMass,
      conservation: +conservation(m).toFixed(4),
    }));
  }
}
