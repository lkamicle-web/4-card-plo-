// handsearch.test.mjs — V2-PLAN §5.1's parser, pinned against the taxonomy it resolves into and
// against the model the UI will look the answer up in.
//
// The parser's whole job is a claim about the taxonomy: "these four ranks with this suit code are
// THAT cell, or nothing at all." So the tests are not shape assertions on a return value — they
// re-derive the answer from `rowOf`/`colOf` and, for the negative verdicts, from the full
// 270,725-hand enumeration, which is the only thing that can prove a "void" is really void rather
// than a search that gave up early.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseHandQuery, suitsForRanks, SEARCH_SUFFIXES, RANK_CHARS, rankCharValue, rankValueChar,
  rowOf, colOf, rankValues, COL_ORDER, ROW_ORDER,
  SUIT_CHARS, cardChars,
} from '../scripts/lib/taxonomy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));

const P = (q) => parseHandQuery(q);
/** every distinct multiset of 4 ranks from 13, multiplicity <= 4 — 1,820 of them */
function rankMultisets() {
  const out = [];
  for (let a = 14; a >= 2; a--) for (let b = a; b >= 2; b--) for (let c = b; c >= 2; c--) for (let d = c; d >= 2; d--) {
    const m = {};
    for (const r of [a, b, c, d]) m[r] = (m[r] || 0) + 1;
    if (Object.values(m).some((x) => x > 4)) continue;
    out.push([a, b, c, d]);
  }
  return out;
}
const canonOf = (rs) => rs.map(rankValueChar).join('');
const SUFFIXES = Object.keys(SEARCH_SUFFIXES);

// ---------------------------------------------------------------------------
test('rank order does not matter — every permutation canonicalises to one answer', () => {
  const perms = ['9655', '5569', '5965', '6559', '5596', '5695'];
  const base = P('9655DS');
  assert.equal(base.status, 'ok');
  assert.equal(base.canon, '9655');
  for (const p of perms) {
    for (const suf of ['', 'DS', 'SS', 'RB', 'F']) {
      const a = P(p + suf), b = P('9655' + suf);
      assert.deepEqual(a, { ...b, input: a.input, query: a.query }, p + suf + ' differs from 9655' + suf);
    }
  }
  // and it holds over the whole rank space, not just one example
  let checked = 0;
  for (const rs of rankMultisets()) {
    const c = canonOf(rs);
    const shuffled = [rs[2], rs[0], rs[3], rs[1]].map(rankValueChar).join('');
    assert.equal(P(shuffled).canon, c);
    assert.equal(P(shuffled).row, P(c).row);
    checked++;
  }
  assert.equal(checked, 1820);
});

test('T J Q K A are ranks, case is irrelevant, separators are ignored', () => {
  for (const ch of 'TJQKA') {
    const r = P(ch + '765');
    assert.equal(r.status, 'ok', ch + '765 should parse');
    assert.equal(r.ranks[0], rankCharValue(ch));
  }
  assert.equal(rankCharValue('T'), 10);
  assert.equal(rankCharValue('A'), 14);
  assert.equal(rankValueChar(10), 'T');
  assert.equal(rankValueChar(14), 'A');
  const want = P('AKQJDS');
  for (const v of ['akqjds', 'AkQjDs', 'A K Q J ds', 'a,k,q,j-ds', 'AKQJ/ds']) {
    const g = P(v);
    assert.equal(g.status, 'ok', v);
    assert.deepEqual({ ...g, input: null, query: null }, { ...want, input: null, query: null }, v);
  }
});

test('the suffix table is exactly the spec\'s, and it is read off COL_ORDER', () => {
  assert.deepEqual(Object.keys(SEARCH_SUFFIXES).sort(), ['DS', 'F', 'FLAW', 'R', 'RB', 'SS', 'SSA']);
  for (const k of Object.keys(SEARCH_SUFFIXES)) {
    assert.ok(COL_ORDER.includes(SEARCH_SUFFIXES[k].col), k + ' -> ' + SEARCH_SUFFIXES[k].col);
  }
  assert.equal(SEARCH_SUFFIXES.R.col, 'RB');
  assert.equal(SEARCH_SUFFIXES.RB.col, 'RB');
  assert.equal(SEARCH_SUFFIXES.SS.col, 'SS');
  assert.equal(SEARCH_SUFFIXES.SSA.col, 'SSA');
  assert.equal(SEARCH_SUFFIXES.DS.col, 'DS');
  assert.equal(SEARCH_SUFFIXES.F.col, 'FLAW');
  // and one worked example per suffix, on a rank string every column can carry
  const got = {};
  for (const s of ['R', 'RB', 'SS', 'SSA', 'DS', 'F']) got[s] = P('AKT9' + s);
  assert.equal(got.R.cellKey, 'RUN2|RB');
  assert.deepEqual(got.RB, { ...got.R, input: got.RB.input, query: got.RB.query, suffix: 'RB' });
  assert.equal(got.SS.cellKey, 'RUN2|SS');
  assert.equal(got.SSA.cellKey, 'RUN2|SSA');
  assert.equal(got.DS.cellKey, 'RUN2|DS');
  assert.equal(got.F.cellKey, 'RUN2|FLAW');
  for (const s of ['R', 'RB', 'SS', 'SSA', 'DS', 'F']) assert.equal(got[s].level, 'cell', s);
});

test('F is the suit-wasted column, and covers both patterns in it', () => {
  // `colOf` folds the three-flush and the monotone pattern into one column, and so does `F`. The
  // parser does not try to separate them — nothing downstream of it can tell them apart either.
  const mono = P('AKT9F');
  assert.equal(mono.status, 'ok');
  assert.equal(mono.level, 'cell');
  assert.equal(mono.col, 'FLAW');
  assert.equal(colOf(mono.cards), 'FLAW');

  // a pair needs two suits, so a paired hand can never be four of one suit — and F still resolves,
  // because the same column carries the three-flush form
  for (const q of ['AA98F', '9655F', 'KK32F', 'TT98FLAW']) {
    const r = P(q);
    assert.equal(r.status, 'ok', q);
    assert.equal(r.level, 'cell', q);
    assert.equal(r.col, 'FLAW', q);
    assert.equal(colOf(r.cards), 'FLAW', q);
  }
  // and where the column is genuinely unrealisable it is void, not a cell
  for (const q of ['AAKKF', 'JJTTF', '5522F']) {
    assert.equal(P(q).status, 'void', q);
    assert.equal(P(q).level, null, q);
  }
});

test('the resolution ladder goes exactly as deep as the input determines', () => {
  const row = P('9655');
  assert.equal(row.level, 'row');
  assert.equal(row.col, null);
  assert.equal(row.cellKey, null);
  assert.equal(row.row, rowOf(row.cards));
  // the row claim: the same row in all five columns
  for (const col of COL_ORDER) {
    const c = suitsForRanks(row.ranks, { col });
    if (c) assert.equal(rowOf(c), row.row, col);
  }
  const cell = P('9655F');
  assert.equal(cell.level, 'cell');
  assert.equal(cell.cellKey, 'SMPAIR_CONN|FLAW');

  const ds = P('9655DS');
  assert.equal(ds.level, 'cell');
  assert.equal(ds.cellKey, 'SMPAIR_CONN|DS');
});

test('garbage and partial inputs are told apart', () => {
  const st = (q) => P(q).status;
  // incomplete = a legal prefix; keep typing
  for (const q of ['', '   ', '9', '96', '965', '9655S', '9655D', '9655F'.slice(0, 5) + 'L', 'AKT9FLA']) {
    assert.equal(st(q), 'incomplete', JSON.stringify(q));
  }
  // invalid = cannot be extended into a legal query
  for (const q of ['9655X', '9655B', '9655SSAA', '965DS', '9DS', 'DS', 'XXXX', '1234', '9655 DS extra', 'AAAAA', '96555']) {
    assert.equal(st(q), 'invalid', JSON.stringify(q));
  }
  // a partial input never claims a cell
  for (const q of ['', '96', '9655S', '9655X', '965DS']) {
    const r = P(q);
    assert.equal(r.level, null, q);
    assert.equal(r.cellKey, null, q);
    assert.ok(r.message.length > 0, q + ' must say why');
  }
  // null / undefined / non-strings do not throw
  for (const q of [null, undefined, 0, {}, []]) assert.equal(P(q).status === 'ok', false);
  assert.equal(P(null).status, 'incomplete');
});

test('every "ok" resolution is re-derivable from the taxonomy itself', () => {
  let row = 0, cell = 0, voids = 0;
  for (const rs of rankMultisets()) {
    const canon = canonOf(rs);
    const bare = P(canon);
    assert.equal(bare.status, 'ok', canon);
    assert.equal(bare.level, 'row');
    assert.equal(bare.row, rowOf(bare.cards));
    assert.deepEqual(rankValues(bare.cards), rs);
    row++;
    for (const suf of SUFFIXES) {
      const r = P(canon + suf), want = SEARCH_SUFFIXES[suf];
      assert.ok(['ok', 'void'].includes(r.status), canon + suf + ' -> ' + r.status);
      assert.equal(r.row, bare.row, canon + suf);
      assert.equal(r.cellKey, bare.row + '|' + want.col, canon + suf);
      if (r.status === 'void') { assert.equal(r.cards, null); voids++; continue; }
      assert.deepEqual(rankValues(r.cards), rs, canon + suf);
      assert.equal(rowOf(r.cards) + '|' + colOf(r.cards), r.cellKey, canon + suf);
      assert.equal(r.level, 'cell', canon + suf);
      assert.equal(colOf(r.cards), want.col, canon + suf);
      cell++;
    }
  }
  assert.equal(row, 1820);
  assert.ok(cell > 8000 && voids > 0, `cell ${cell} void ${voids}`);
});

test('a "void" verdict is proved by the full enumeration, not assumed', () => {
  // build the ground truth once: which (rank pattern, column) pairs any of the 270,725 hands
  // actually realises
  const haveCol = new Set();
  const h = [0, 0, 0, 0];
  for (let a = 0; a < 52; a++) {
    h[0] = a;
    for (let b = a + 1; b < 52; b++) {
      h[1] = b;
      for (let c = b + 1; c < 52; c++) {
        h[2] = c;
        for (let d = c + 1; d < 52; d++) {
          h[3] = d;
          const canon = canonOf(rankValues(h));
          haveCol.add(canon + ' ' + colOf(h));
        }
      }
    }
  }
  let voids = 0, cells = 0;
  for (const rs of rankMultisets()) {
    const canon = canonOf(rs);
    for (const suf of SUFFIXES) {
      const r = P(canon + suf), want = SEARCH_SUFFIXES[suf];
      const colReal = haveCol.has(canon + ' ' + want.col);
      if (r.status === 'void') { assert.equal(colReal, false, canon + suf + ' is NOT void'); voids++; continue; }
      assert.equal(colReal, true, canon + suf + ' claims a column no hand realises');
      assert.equal(r.level, 'cell', canon + suf);
      cells++;
    }
  }
  assert.equal(voids + cells, 1820 * SUFFIXES.length);
  assert.ok(voids > 0 && cells > 0);
});

test('every resolution names something the shipped model actually carries', () => {
  const live = new Set(Object.keys(MODEL.cells).filter((k) => (MODEL.cells[k].combos || 0) > 0));
  const allCells = new Set();
  for (const r of ROW_ORDER) for (const c of COL_ORDER) allCells.add(r + '|' + c);
  let ok = 0, voided = 0;
  for (const rs of rankMultisets()) {
    const canon = canonOf(rs);
    for (const suf of SUFFIXES) {
      const r = P(canon + suf);
      assert.ok(allCells.has(r.cellKey), r.cellKey + ' is not one of the 145 cells');
      if (r.status === 'void') { voided++; continue; }
      assert.ok(live.has(r.cellKey), canon + suf + ' -> ' + r.cellKey + ' is not a live cell');
      ok++;
    }
  }
  assert.ok(ok > 0 && voided > 0);
  // and the rank-row rung always names a row the grid draws
  const rows = new Set(MODEL.rows.map((x) => x.key));
  for (const rs of rankMultisets()) assert.ok(rows.has(P(canonOf(rs)).row));
});

test('suitsForRanks is exhaustive and deterministic', () => {
  // `{}` always succeeds — four cards of any legal rank multiset exist
  for (const rs of rankMultisets()) {
    const c = suitsForRanks(rs, {});
    assert.ok(c, canonOf(rs));
    assert.equal(new Set(c).size, 4);
    assert.deepEqual(rankValues(c), rs);
    assert.deepEqual(c, c.slice().sort((x, y) => y - x), 'cards come back descending');
  }
  // deterministic: same query, same cards, every time
  for (const q of ['AKQJDS', '9655SS', 'AA98F', 'TT32RB']) {
    assert.deepEqual(P(q).cards, P(q).cards);
    assert.deepEqual(P(q).cards, parseHandQuery(q.toLowerCase()).cards);
  }
  // an impossible ask returns null rather than a wrong hand
  assert.equal(suitsForRanks([14, 14, 14, 14], { col: 'DS' }), null);
  assert.equal(suitsForRanks([14, 14, 13, 13], { col: 'FLAW' }), null);
  assert.equal(RANK_CHARS.length, 13);
});

// ---------------------------------------------------------------------------
// The CARD grammar — the second half of the universal finder. Same parser, same result shape;
// the only new thing is that the classifier is asked directly instead of being reconstructed
// from a suit code, so the answer is the cell the hand really lands in.
// ---------------------------------------------------------------------------
const cardsOf = (str) => {
  const out = [];
  for (let i = 0; i < str.length; i += 2) out.push(RANK_CHARS.indexOf(str[i].toUpperCase()) * 4 + SUIT_CHARS.indexOf(str[i + 1].toLowerCase()));
  return out;
};

test('four specific cards resolve to the hand rung, re-derived from the classifier', () => {
  for (const q of ['AsKh9s8d', 'AsKsQsJs', '9s9h6s5h', 'Ad2d3c4h', 'TsTh3s2h', 'AcAdAhKs']) {
    const r = P(q);
    const cards = cardsOf(q).sort((a, b) => b - a);
    assert.equal(r.status, 'ok', q);
    assert.equal(r.level, 'hand', q);
    assert.deepEqual(r.cards, cards, q);
    assert.equal(r.canon, cards.map(cardChars).join(''), q);
    assert.equal(r.row, rowOf(cards), q);
    assert.equal(r.col, colOf(cards), q);
    assert.equal(r.cellKey, rowOf(cards) + '|' + colOf(cards), q);
    assert.deepEqual(r.ranks, rankValues(cards), q);
    assert.equal(r.suffix, null, q);
    // and it names a live cell
    assert.ok((MODEL.cells[r.cellKey].combos || 0) > 0, q + ' -> ' + r.cellKey);
  }
});

test('card order, case and separators are all irrelevant', () => {
  const want = P('AsKh9s8d');
  for (const v of ['askh9s8d', 'ASKH9S8D', '8dAs9sKh', 'As Kh 9s 8d', 'as,kh-9s.8d', '9s/8d/As/Kh']) {
    const g = P(v);
    assert.equal(g.status, 'ok', v);
    assert.deepEqual({ ...g, input: null, query: null }, { ...want, input: null, query: null }, v);
  }
  // canon is itself a legal query, so the box round-trips whatever it prints
  assert.deepEqual(P(want.canon), { ...want, input: want.canon, query: want.canon.toUpperCase() });
});

test('partial and broken card inputs are told apart from class queries', () => {
  const st = (q) => P(q).status;
  // a legal prefix of a card query — keep typing
  for (const q of ['As', 'AsK', 'AsKh', 'AsKh9', 'AsKh9s', 'AsKh9s8']) assert.equal(st(q), 'incomplete', q);
  // and it never claims a cell on the way
  for (const q of ['As', 'AsKh', 'AsKh9s8']) {
    const r = P(q);
    assert.equal(r.level, null, q);
    assert.equal(r.cellKey, null, q);
    assert.ok(r.message.length > 0, q + ' must say why');
  }
  assert.equal(st('AsKx'), 'invalid');          // x is not a suit
  assert.equal(st('AsK7h9s8d'), 'invalid');     // K7 is not a card
  assert.equal(st('AsAs9h8d'), 'invalid');      // the same card twice
  assert.equal(st('AsKh9s8dAc'), 'invalid');    // five cards
  assert.match(P('AsAs9h8d').message, /appears twice/);
  assert.match(P('AsKh9s8dAc').message, /exactly four/);
});

test('the two grammars are told apart on one character and never collide', () => {
  // disjoint alphabets: that is what makes the single-character decision safe
  for (const ch of RANK_CHARS) assert.equal(SUIT_CHARS.indexOf(ch.toLowerCase()), -1, ch);
  for (const ch of SUIT_CHARS) assert.equal(RANK_CHARS.indexOf(ch.toUpperCase()), -1, ch);
  // every legal class query still parses as a class query, over the whole rank space
  for (const rs of rankMultisets()) {
    for (const suf of ['', ...SUFFIXES]) {
      const r = P(canonOf(rs) + suf);
      assert.notEqual(r.level, 'hand', canonOf(rs) + suf + ' was read as a card query');
    }
  }
  // and the pre-existing verdicts on the ambiguous-looking strings are unchanged
  assert.equal(P('9DS').status, 'invalid');
  assert.equal(P('DS').status, 'invalid');
  assert.equal(P('9655D').status, 'incomplete');
});

test('the two rungs agree: a hand and the class query for its ranks land on the same cell', () => {
  // The suit code names a column and the hand IS its column, so the two halves of the finder must
  // never disagree about where a hand lives. Every column maps to exactly one suffix now — there
  // is no ambiguous case left, because there is nothing below the cell to be ambiguous about.
  const BY_COL = { DS: 'DS', SS: 'SS', SSA: 'SSA', RB: 'RB', FLAW: 'F' };
  let agreed = 0;
  const h = [0, 0, 0, 0];
  for (let a = 0; a < 52; a += 3) {
    h[0] = a;
    for (let b = a + 1; b < 52; b += 7) {
      h[1] = b;
      for (let c = b + 1; c < 52; c += 11) {
        h[2] = c;
        for (let d = c + 1; d < 52; d += 13) {
          h[3] = d;
          const hand = P(h.slice().sort((x, y) => y - x).map(cardChars).join(''));
          assert.equal(hand.status, 'ok');
          const cls = P(canonOf(rankValues(h)) + BY_COL[colOf(h)]);
          assert.equal(cls.status, 'ok', hand.canon);
          assert.equal(cls.cellKey, hand.cellKey, hand.canon + ' cell');
          agreed++;
        }
      }
    }
  }
  assert.ok(agreed > 100, `agreed ${agreed}`);
});
