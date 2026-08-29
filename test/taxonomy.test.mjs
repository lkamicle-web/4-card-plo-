// node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rowOf, colOf, nutSuited, danglerCount, domDistinct, adjRaw, subKeyOf, subLabel,
  gapOf4, gapVec, best3Span, isDoubleConnector, rankValues, topInGapOrientation,
  ROW_ORDER, COL_ORDER, ROW_META, BAND_ORDER, enumerateAll, spanExamples,
} from '../scripts/lib/taxonomy.mjs';
import { parseHand } from '../scripts/lib/eval5.mjs';

const h = (s) => parseHand(s);

test('the row cascade classifies the named hands', () => {
  const cases = [
    ['AsAhKsKh', 'AA_BIGPAIR'], ['AsAhKdQc', 'AA_BROADWAY'], ['AsAhJsTh', 'AA_BROADWAY'],
    ['AsAh9s8h', 'AA_CONNECTED'], ['AsAh2d2c', 'AA_SMALLPAIR'], ['AsAh7d2c', 'AA_DANGLER'],
    ['AsAhAdKc', 'A_BLOCKED'], ['AsAhAdAc', 'A_BLOCKED'],
    ['KsKhQdQc', 'DBLPAIR_BIG'], ['KsKh2d2c', 'DBLPAIR_MIXED'], ['2s2h3d3c', 'DBLPAIR_SMALL'],
    ['KsKhQdJc', 'BIGPAIR_CONN'], ['KsKhAd2c', 'BIGPAIR_ACE'], ['KsKh7d2c', 'BIGPAIR_JUNK'],
    ['QsQhQd2c', 'TRIPS_BIG'], ['2s2h2d5c', 'TRIPS_SMALL'],
    ['AsKhQdJc', 'BROADWAY_RUN'], ['KsQhJsTh', 'BROADWAY_RUN'],
    ['JsTh9s8h', 'RUN0_HIGH'], ['QsJhTd9c', 'RUN0_HIGH'],
    ['Ts9h8s7h', 'RUN0_LOW'], ['5s4h3s2h', 'RUN0_LOW'],
    // the wheel rundown is graded in the orientation that made it a rundown: its top card is the 4
    ['As4h3d2c', 'RUN0_LOW'],
    ['JsTh9d7c', 'RUN1_BOTTOM'], ['JsTh8d7c', 'RUN1_TOPMID'],
    ['As5h4d3c', 'RUN1_BOTTOM'], ['As5h3d2c', 'RUN1_TOPMID'], ['As5h4d2c', 'RUN1_TOPMID'],
    ['As9h8d7c', 'ACE_RUN3'], ['Ks8h7d6c', 'RUN3_DANGLER'],
    ['AsJhTd9c', 'RUN2'], ['KsJhTd9c', 'RUN1_TOPMID'],
    ['Ks9h5d2c', 'TRASH'], ['As9h5d2c', 'ACE_JUNK'],
  ];
  for (const [hand, row] of cases) assert.equal(rowOf(h(hand)), row, hand);
});

test('the suit classifier separates SS from SS-NUT', () => {
  assert.equal(colOf(h('AsAhKsKh')), 'DS');
  assert.equal(colOf(h('AsKs9h8d')), 'SSA');   // the two-suit is ace-topped
  assert.equal(colOf(h('KsQs9h8d')), 'SS');
  assert.equal(colOf(h('KsQs9s8d')), 'FLAW');  // three-flush
  assert.equal(colOf(h('KsQs9s8s')), 'FLAW');  // monotone
  assert.equal(colOf(h('Ks9h5d2c')), 'RB');
  assert.ok(nutSuited(h('AsKs9h8d')));
  assert.ok(!nutSuited(h('KsQs9h8d')));
  assert.ok(nutSuited(h('AsAhKsKh')), 'AAxx double-suited is double NUT suited');
});

test('the helpers are wheel-aware', () => {
  assert.equal(gapOf4(rankValues(h('As4h3d2c'))), 0, 'A432 is a wheel rundown with zero total gap');
  assert.equal(gapOf4(rankValues(h('As5h4d3c'))), 1, 'A543 is one gap short of a wheel run');
  assert.equal(best3Span(rankValues(h('As3h2d9c'))), 2, 'A32 is a perfect three-card run');
  assert.ok(isDoubleConnector(rankValues(h('KsQh7d6c'))));
  assert.ok(!isDoubleConnector(rankValues(h('KsQhJdTc'))));
  assert.deepEqual(gapVec(rankValues(h('JsTh9d7c'))), [0, 0, 1]);
  // the top card is read in whichever orientation gapOf4 scored the hand in
  assert.equal(topInGapOrientation(rankValues(h('As4h3d2c'))), 4, 'A432 tops out at the four');
  assert.equal(topInGapOrientation(rankValues(h('JsTh9s8h'))), 11);
  assert.equal(topInGapOrientation(rankValues(h('AsKhQdJc'))), 14, 'AKQJ keeps its ace high');
  assert.equal(topInGapOrientation(rankValues(h('Ts9h8s7h'))), 10, 'no ace, nothing to remap');
});

test('the 0-gap row split files the wheel rundown low', () => {
  const E = enumerateAll();
  const n = (k) => E.combos[E.cellIdx.get(k)];
  // A432 is 256 combos: HIGH keeps only the two aceless sets (JT98, QJT9)
  assert.equal(ROW_ORDER.filter((r) => r === 'RUN0_HIGH').length, 1);
  assert.equal(COL_ORDER.reduce((s, c) => s + n('RUN0_HIGH|' + c), 0), 512);
  assert.equal(COL_ORDER.reduce((s, c) => s + n('RUN0_LOW|' + c), 0), 1792);
  assert.equal(n('RUN0_HIGH|SSA'), 0, 'JT98/QJT9 cannot hold an ace-topped suited pair');
  assert.equal(n('RUN0_LOW|SSA'), 72, 'the wheel hand brings SS-NUT into the low row');
});

test('danglers, domination and the within-cell adjustment', () => {
  assert.equal(danglerCount(h('JsTh9d8c')), 0);
  // wheel-aware: the deuce clusters with the aces (A-2 is a wheel connector), the seven does not
  assert.equal(danglerCount(h('AsAh7d2c')), 1);
  assert.equal(danglerCount(h('KsKh7d2c')), 2);
  assert.equal(danglerCount(h('JsTh9d2c')), 1);
  assert.equal(domDistinct(h('AdKcQsJh')), 3);
  assert.equal(domDistinct(h('AsAhKdQc')), 3);
  assert.equal(domDistinct(h('JsTh9s8h')), 0);
  // 2*(#ranks >= J) - 3*danglers + 4*nutSuited
  assert.equal(adjRaw(h('JsTh9d8c')), 2);   // one card >= J, no danglers, not nut-suited
  assert.equal(adjRaw(h('AsAh7d2c')), 4 - 3); // two aces, one dangler
  // AK98: two cards >= J (+4), but AK and 98 form no 3-card cluster so both halves dangle
  // (-6), and the ace-topped suited pair pays +4
  assert.equal(adjRaw(h('AsKs9h8d')), 4 - 6 + 4);
});

test('D1 — the 29x5 grid is an exact partition of all 270,725 hands', () => {
  const E = enumerateAll();
  assert.equal(E.total, 270725);
  let sum = 0;
  for (const n of E.combos) sum += n;
  assert.equal(sum, 270725);
  assert.equal(E.cellKeys.length, ROW_ORDER.length * COL_ORDER.length);
  assert.equal(E.cellKeys.length, 145);
});

test('D1 — the published combo counts reproduce exactly', () => {
  const E = enumerateAll();
  const expect = {
    'AA_BIGPAIR|DS': 18, 'AA_BIGPAIR|SSA': 72, 'AA_BIGPAIR|RB': 18,
    'A_BLOCKED|SSA': 144, 'A_BLOCKED|RB': 49,
    'BROADWAY_RUN|FLAW': 260, 'RUN2|SS': 6912, 'SMPAIR_JUNK|SS': 21960, 'TRASH|SS': 30960,
    'ACE_JUNK|SSA': 8568, 'DBL_CONNECTOR|DS': 2592,
  };
  for (const [k, n] of Object.entries(expect)) assert.equal(E.combos[E.cellIdx.get(k)], n, k);
  const colTotals = { RB: 28561, FLAW: 47476, SS: 133848, SSA: 24336, DS: 36504 };
  for (const [col, n] of Object.entries(colTotals)) {
    let s = 0;
    for (const row of ROW_ORDER) s += E.combos[E.cellIdx.get(row + '|' + col)];
    assert.equal(s, n, col);
  }
});

test('D2 — the structurally empty cells are exactly the derivable ones', () => {
  const E = enumerateAll();
  const empty = E.cellKeys.filter((k, i) => E.combos[i] === 0);
  assert.equal(empty.length, 22);
  for (const k of ['AA_BIGPAIR|SS', 'DBLPAIR_BIG|SSA', 'TRASH|SSA', 'A_BLOCKED|DS']) {
    assert.ok(empty.includes(k), `${k} must be structurally empty`);
  }
});

test('I17 — the sub-bucket layer partitions every cell', () => {
  const E = enumerateAll();
  let total = 0, buckets = 0;
  for (let i = 0; i < E.cellKeys.length; i++) {
    const m = E.subs[i];
    if (E.combos[i] === 0) { assert.equal(m.size, 0); continue; }
    let s = 0;
    for (const rec of m.values()) s += rec.combos;
    assert.equal(s, E.combos[i], E.cellKeys[i]);
    total += s;
    buckets += m.size;
  }
  assert.equal(total, 270725);
  assert.ok(buckets >= 300 && buckets <= 400, `${buckets} sub-buckets, target band 300-400`);
});

test('sub-keys and their labels are well formed', () => {
  const k = subKeyOf(h('AsAhKsKh'));
  assert.equal(k.split('|').length, 4);
  assert.ok(subLabel(k).includes('double-suited'));
  assert.ok(!subLabel(k).includes('undefined'));
});

test('every row and band is described', () => {
  for (const r of ROW_ORDER) {
    assert.ok(ROW_META[r], r);
    assert.ok(ROW_META[r].short.length <= 10, `${r} short label is <= 10 chars`);
    assert.ok(BAND_ORDER.includes(ROW_META[r].band));
  }
});

test('span examples cover a cell from best to worst', () => {
  const E = enumerateAll();
  const i = E.cellIdx.get('RUN2|SS');
  const ex = spanExamples(E.exByAdj[i], 6);
  assert.equal(ex.length, 6);
  assert.equal(new Set(ex).size, 6);
  const tiny = spanExamples(E.exByAdj[E.cellIdx.get('AA_BIGPAIR|DS')], 6);
  assert.ok(tiny.length >= 1 && tiny.length <= 6);
  assert.equal(new Set(tiny).size, tiny.length);
});
