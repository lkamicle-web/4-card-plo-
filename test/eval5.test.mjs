// node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eval5, categoryOf, CATEGORY_NAMES, parseHand, parseCard, handStr, cardStr,
  makeTriplePartials, fillTriplePartials, bestOmaha, bestOmahaNaive, STRAIGHT_HI, Rng, fnv1a,
} from '../scripts/lib/eval5.mjs';
import { equityFixed, equityVsFixed, sharedDealEquities } from '../scripts/lib/mc.mjs';
import { omahaBest as refOmahaBest } from '../scripts/lib/equity-ref.mjs';

test('card parsing round-trips', () => {
  assert.equal(parseCard('2s'), 0);
  assert.equal(parseCard('Ac'), 51);
  assert.equal(cardStr(0), '2s');
  assert.equal(handStr(parseHand('AsAhKsKh')), 'AsAhKsKh');
  assert.deepEqual(parseHand('as ks 9h 8h'), parseHand('AsKs9h8h'));
});

test('V5 — the nine C(52,5) category frequencies are exact', () => {
  const expected = [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40];
  const cnt = new Array(9).fill(0);
  for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let c = b + 1; c < 52; c++)
    for (let d = c + 1; d < 52; d++) for (let e = d + 1; e < 52; e++) cnt[categoryOf(eval5(a, b, c, d, e))]++;
  for (let i = 0; i < 9; i++) assert.equal(cnt[i], expected[i], CATEGORY_NAMES[i]);
});

test('V5 — hand ranking order is strict', () => {
  const order = ['9s8s7s6s5s', '9s9h9d9c2s', '9s9h9d2s2h', 'As9s7s4s2s',
    '9s8h7d6c5s', '9s9h9d2s3h', '9s9h7d7c2s', '9s9h7d5c2s', 'As9h7d5c2s'];
  let prev = Infinity;
  for (let i = 0; i < order.length; i++) {
    const v = eval5(...parseHand(order[i]));
    assert.equal(categoryOf(v), 8 - i, order[i]);
    assert.ok(v < prev, `${order[i]} must rank below the previous category`);
    prev = v;
  }
});

test('the wheel is a straight, and the lowest one', () => {
  const wheel = eval5(...parseHand('As5h4d3c2s'));
  const six = eval5(...parseHand('6s5h4d3c2s'));
  assert.equal(categoryOf(wheel), 4);
  assert.ok(wheel < six);
  assert.equal(STRAIGHT_HI[(1 << 12) | (1 << 3) | (1 << 2) | (1 << 1) | 1], 3);
});

test('V6 — Omaha uses exactly two hole cards', () => {
  const tp = makeTriplePartials();
  fillTriplePartials(parseHand('7s7h7d7cKs'), tp);
  const kk = parseHand('KdKh2s3h');   // KKK77
  const aa = parseHand('AsAh2d3c');   // 7777A, beaten
  assert.ok(bestOmaha(...kk, tp) > bestOmaha(...aa, tp));
});

test('board-triple partials agree with the naive best-of-60 on random deals', () => {
  const rng = new Rng(fnv1a('partials'));
  const tp = makeTriplePartials();
  for (let t = 0; t < 3000; t++) {
    const deck = [...Array(52).keys()];
    for (let i = 0; i < 9; i++) {
      const j = i + rng.int(52 - i);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    const hole = deck.slice(0, 4), board = deck.slice(4, 9);
    fillTriplePartials(board, tp);
    assert.equal(bestOmaha(...hole, tp), bestOmahaNaive(hole, board));
  }
});

test('I20 — the independent reference evaluator ranks every showdown identically', () => {
  const rng = new Rng(fnv1a('cross'));
  const tp = makeTriplePartials();
  for (let t = 0; t < 4000; t++) {
    const deck = [...Array(52).keys()];
    for (let i = 0; i < 13; i++) {
      const j = i + rng.int(52 - i);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    const a = deck.slice(0, 4), b = deck.slice(4, 8), board = deck.slice(8, 13);
    fillTriplePartials(board, tp);
    const mineCmp = Math.sign(bestOmaha(...a, tp) - bestOmaha(...b, tp));
    const refCmp = Math.sign(refOmahaBest(a, board) - refOmahaBest(b, board));
    assert.equal(mineCmp, refCmp);
  }
});

test('V1 / I5 — equities over shared deals sum to exactly 100', () => {
  const e = sharedDealEquities([parseHand('AsAhKsKh'), parseHand('JsTh9s8h'), parseHand('Ks9h5d2c')], 20000, 'sum');
  assert.ok(Math.abs(e.reduce((a, b) => a + b, 0) - 100) < 1e-9);
});

test('benchmark equities reproduce the calibration table', () => {
  const rows = [
    ['AsAhKsKh', 70.82], ['AsAhJsTh', 71.08], ['KsKhQsQh', 68.52], ['AsAh7d2c', 61.64],
    ['JsTh9s8h', 55.26], ['AsAhAdAc', 51.57], ['5s4h3s2h', 40.95],
    // K952r: the published 43.41 is one of the rows this build disputes — both engines measure
    // 42.50 over shared deals at 240k trials. See benchmarks.disputed in data/model.json.
    ['Ks9h5d2c', 42.50],
    ['2s2h3d3c', 38.48], ['2s2h2d2c', 9.28],
  ];
  for (const [hand, expected] of rows) {
    // 200k trials: SE ~0.11 pt, so the +/-0.6 gate is a real check rather than a seed lottery
    const m = equityFixed(parseHand(hand), 200000, `test|${hand}`, 1);
    assert.ok(Math.abs(m - expected) <= 0.6, `${hand}: ${m.toFixed(2)} vs ${expected}`);
  }
});

test('the face-up 3-bet inversion reproduces', () => {
  const low = equityVsFixed(parseHand('5s4h3s2h'), parseHand('AsAhKdQc'), 60000, 'test|inv|low');
  const pretty = equityVsFixed(parseHand('AdKcQsJh'), parseHand('AsAhKdQc'), 60000, 'test|inv|pretty');
  assert.ok(Math.abs(low - 47.58) <= 0.6, `5432ds ${low.toFixed(2)}`);
  assert.ok(Math.abs(pretty - 17.97) <= 0.6, `AKQJ ${pretty.toFixed(2)}`);
  assert.ok(low > pretty + 25, 'the trash hand beats the pretty one by a mile');
});

test('the RNG is deterministic and platform-independent', () => {
  const a = new Rng(fnv1a('seed'));
  const b = new Rng(fnv1a('seed'));
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  assert.notEqual(new Rng(fnv1a('other')).next(), new Rng(fnv1a('seed')).next());
});
