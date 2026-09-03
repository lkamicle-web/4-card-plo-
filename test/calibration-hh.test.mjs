// node --test test/*.test.mjs
//
// The hand-history parser (V3-PLAN §3.1 lane C, S-C §3).
//
// The load-bearing tests here are the REFUSALS. A parser that accepts everything has no way to be
// wrong out loud: it turns a 5-card Omaha file into 4-card rows, a tournament into bb figures that
// mean nothing, and a hand whose arithmetic does not close into a `netBB` nobody can check. S-C's
// own prototype recorded that its money-balance clause "earned itself immediately — it rejected
// three fixture hands whose pot arithmetic I had written wrong, before I noticed", so the clause is
// kept armed and hand 900000007 is broken by exactly $0.25 on purpose.
//
// The second theme is the VISIBILITY SPLIT, which is the whole reason this parser exists in the
// shape it does. `knownVia` is not a label the caller may set: it is derived from which line of the
// file the cards came off, and the tests pin both doors and the case where a corpus has no hero at
// all (the datamined shape — hand 900000011).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCorpus, parseHand, splitBlocks, classifyVariant, cardsFromText, cardsToText,
  REJECT_REASONS, KNOWN_VIA, POSITIONS_BY_BUTTON_OFFSET,
} from '../scripts/lib/calibration-hh.mjs';
import { FIXTURE, FIXTURE_SHAPES, PROVENANCE } from '../scripts/lib/calibration-fixture.mjs';
import { cellKeyOf } from '../scripts/lib/taxonomy.mjs';
import { POSITIONS } from '../scripts/lib/policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PARSED = parseCorpus(FIXTURE);
const byId = new Map(PARSED.hands.map((h) => [h.id, h]));
const rejById = new Map(PARSED.rejected.map((r) => [r.id, r.reason]));

// ---------------------------------------------------------------------------
// the fixture is not data, and says so
// ---------------------------------------------------------------------------
test('the fixture declares itself synthetic — it can be parsed, never calibrated on', () => {
  assert.equal(PROVENANCE.synthetic, true);
  assert.equal(PROVENANCE.lawfullyHeld, null);
  // and the file itself carries the banner, so a reader who never opens the provenance record
  // still cannot mistake it for observed play
  const src = readFileSync(resolve(ROOT, 'scripts/lib/calibration-fixture.mjs'), 'utf8');
  assert.match(src, /NO OBSERVED PLAY, NO DOWNLOADED CORPUS/);
});

test('every block in the fixture is accounted for by FIXTURE_SHAPES', () => {
  const ids = splitBlocks(FIXTURE).map((b) => b.match(/#(\d+):/)[1]);
  assert.deepEqual(ids, FIXTURE_SHAPES.map((s) => s.id));
  for (const s of FIXTURE_SHAPES) {
    const rejected = s.shape.startsWith('REJECT');
    assert.equal(rejById.has(s.id), rejected, `${s.id}: ${s.shape}`);
  }
});

// ---------------------------------------------------------------------------
// the accept path
// ---------------------------------------------------------------------------
test('the fixture parses to the counts it was authored for', () => {
  assert.equal(PARSED.counts.blocks, 12);
  assert.equal(PARSED.counts.accepted, 5);
  assert.equal(PARSED.counts.rejected, 7);
  assert.equal(PARSED.counts.heroRows, 4);
  assert.equal(PARSED.counts.showdownRows, 5);
});

test('positions are read off the button, and they are the shipped six', () => {
  assert.deepEqual([...POSITIONS_BY_BUTTON_OFFSET].sort(), [...POSITIONS].sort());
  // hand 1: button seat 3, hero seat 6 -> three seats after the button -> UTG
  assert.equal(byId.get('900000001').rows[0].pos, 'UTG');
  // hand 3: button seat 2, hero seat 6 -> HJ
  assert.equal(byId.get('900000003').rows.find((r) => r.knownVia === 'hero').pos, 'HJ');
  // hand 10: hero IS the button
  assert.equal(byId.get('900000010').rows[0].pos, 'BTN');
});

test('netBB is the money identity, not an estimate', () => {
  // hand 2: hero invested 16.50, collected 32.00, bb = 1  ->  +15.50
  const h2 = byId.get('900000002');
  const hero = h2.rows.find((r) => r.knownVia === 'hero');
  assert.equal(hero.netBB, 15.5);
  assert.equal(h2.rows.find((r) => r.knownVia === 'showdown').netBB, -16.5);
  // hand 10: hero invested 12, got 8.50 back uncalled and collected 8.10  ->  +4.60
  assert.ok(Math.abs(byId.get('900000010').rows[0].netBB - 4.6) < 1e-9);
});

test('a raise is read as a TOTAL, not an increment — the classic PokerStars parsing bug', () => {
  // hand 10: `raises $8.50 to $12` after posting nothing. Reading $8.50 as the increment would
  // make hero's investment 8.50 and netBB +8.10 instead of +4.60.
  const hero = byId.get('900000010').rows[0];
  assert.ok(Math.abs(hero.invBB - 12) < 1e-9, `invested ${hero.invBB}, expected 12`);
});

test('cells come from the shipped taxonomy, not from a reimplementation', () => {
  for (const h of PARSED.hands) {
    for (const r of h.rows) assert.equal(r.cell, cellKeyOf(r.cards));
  }
  assert.equal(byId.get('900000001').rows[0].cell, 'AA_BIGPAIR|RB');
  assert.equal(byId.get('900000002').rows[0].cell, 'BROADWAY_RUN|DS');
});

// ---------------------------------------------------------------------------
// the visibility split
// ---------------------------------------------------------------------------
test('knownVia is derived from WHICH LINE the cards came off, and only ever those two values', () => {
  for (const h of PARSED.hands) for (const r of h.rows) assert.ok(KNOWN_VIA.includes(r.knownVia));
  // hand 2 went to showdown with hero in it: hero's row keeps the UNBIASED door
  const h2 = byId.get('900000002');
  assert.equal(h2.rows.filter((r) => r.knownVia === 'hero').length, 1);
  assert.equal(h2.rows.filter((r) => r.knownVia === 'showdown').length, 1);
});

test('a hand hero FOLDED still yields a hero row — that is what outcome-independent means', () => {
  const h1 = byId.get('900000001');
  assert.equal(h1.rows.length, 1);
  assert.equal(h1.rows[0].knownVia, 'hero');
  assert.equal(h1.rows[0].netBB, 0);
  assert.equal(h1.rows[0].vpip, false);
});

test('an observed hand with no hero yields ONLY showdown rows — the datamined shape', () => {
  const h11 = byId.get('900000011');
  assert.equal(h11.heroName, null);
  assert.equal(h11.rows.length, 2);
  assert.ok(h11.rows.every((r) => r.knownVia === 'showdown'));
});

// ---------------------------------------------------------------------------
// the refusals — the half that has teeth
// ---------------------------------------------------------------------------
test('every reject reason the fixture triggers is in the frozen list', () => {
  for (const [, reason] of rejById) assert.ok(REJECT_REASONS.includes(reason), reason);
});

test('the six refusals the fixture authors, by name', () => {
  assert.equal(rejById.get('900000004'), 'omaha-hi-lo');
  assert.equal(rejById.get('900000005'), 'omaha-not-4-card');
  assert.equal(rejById.get('900000006'), 'not-omaha-pl');
  assert.equal(rejById.get('900000007'), 'money-imbalance');
  assert.equal(rejById.get('900000008'), 'not-six-handed');
  assert.equal(rejById.get('900000009'), 'not-cash');
  assert.equal(rejById.get('900000012'), 'multiple-dealt-to');
});

test('the money-balance clause fires on an arithmetic error of half a big blind', () => {
  // hand 7 is hand 1 with `Rake $0.25` against an unchanged `collected $2.50`. It is otherwise a
  // perfectly well-formed hand: nothing but the arithmetic gives it away.
  const good = FIXTURE.match(/PokerStars Hand #900000001[\s\S]*?(?=\nPokerStars Hand)/)[0];
  const bad = FIXTURE.match(/PokerStars Hand #900000007[\s\S]*?(?=\nPokerStars Hand)/)[0];
  assert.equal(parseHand(good).ok, true);
  const r = parseHand(bad);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'money-imbalance');
});

test('the variant test is ordered so a 5-card file cannot pass as a 4-card one', () => {
  // "Omaha Pot Limit" is a SUBSTRING of "5 Card Omaha Pot Limit". Testing the permissive shape
  // first is how a 5-card corpus quietly becomes a 4-card one.
  assert.equal(classifyVariant('5 Card Omaha Pot Limit ($0.50/$1.00 USD)').reason, 'omaha-not-4-card');
  assert.equal(classifyVariant('6 Card Omaha Pot Limit ($0.50/$1.00 USD)').reason, 'omaha-not-4-card');
  assert.equal(classifyVariant('Omaha Hi/Lo Pot Limit ($0.50/$1.00 USD)').reason, 'omaha-hi-lo');
  assert.equal(classifyVariant("Hold'em No Limit ($0.50/$1.00 USD)").reason, 'not-omaha-pl');
  assert.equal(classifyVariant('Omaha Limit ($0.50/$1.00 USD)').reason, 'not-omaha-pl');
  assert.equal(classifyVariant('Omaha Pot Limit (Level V (75/150))').reason, 'not-cash');
  const ok = classifyVariant('Omaha Pot Limit ($0.50/$1.00 USD)');
  assert.equal(ok.reason, undefined);
  assert.deepEqual([ok.sb, ok.bb], [0.5, 1]);
});

test('a short table is REFUSED rather than mapped onto six seats by guesswork', () => {
  const r = parseHand(FIXTURE.match(/PokerStars Hand #900000008[\s\S]*?(?=\nPokerStars Hand)/)[0]);
  assert.equal(r.reason, 'not-six-handed');
});

test('a dead button is refused — there is no seat to measure position from', () => {
  const block = FIXTURE.match(/PokerStars Hand #900000001[\s\S]*?(?=\nPokerStars Hand)/)[0]
    .replace('Seat 3: SynthBTN ($100.00 in chips)', 'Seat 3: SynthBTN ($100.00 in chips) is sitting out');
  assert.equal(parseHand(block).reason, 'dead-button');
});

test('a truncated block is a rejection, never a silently shorter hand', () => {
  const block = FIXTURE.match(/PokerStars Hand #900000001[\s\S]*?(?=\nPokerStars Hand)/)[0]
    .split('*** SUMMARY ***')[0];
  assert.equal(parseHand(block).reason, 'truncated');
});

test('cards that are not a legal distinct four are refused, not coerced', () => {
  assert.equal(cardsFromText('Ac Ac Kh Ks'), null);      // duplicate
  assert.equal(cardsFromText('Ac Xd Kh Ks'), null);      // no such rank
  assert.equal(cardsFromText('Ac Kd Qh Jz'), null);      // no such suit
  assert.equal(cardsFromText(''), null);
  const c = cardsFromText('Ac Kd Qh Js');
  assert.equal(c.length, 4);
  assert.equal(cardsToText(c), 'Ac Kd Qh Js');
  // a duplicated card ACROSS two revealed hands is a deck violation the file cannot self-check
  const block = FIXTURE.match(/PokerStars Hand #900000002[\s\S]*?(?=\nPokerStars Hand)/)[0]
    .replaceAll('[9c 8c 7d 6d]', '[Ah Kh Qs Js]');
  assert.equal(parseHand(block).reason, 'bad-cards');
});

// ---------------------------------------------------------------------------
// shape
// ---------------------------------------------------------------------------
test('splitBlocks keeps a trailing partial hand rather than dropping it', () => {
  const blocks = splitBlocks(`${FIXTURE}\nPokerStars Hand #900000099: Omaha Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:99 ET\nTable 'x' 6-max Seat #1 is the button`);
  assert.equal(blocks.length, 13);
  assert.equal(parseCorpus(blocks[12]).counts.rejected, 1);
});

test('text with no hand header yields nothing rather than throwing', () => {
  const r = parseCorpus('this is not a hand history at all\nnor is this\n');
  assert.equal(r.counts.blocks, 0);
  assert.equal(r.rows.length, 0);
});

test('rows are frozen — a consumer cannot retag a showdown row as hero', () => {
  const r = PARSED.rows.find((x) => x.knownVia === 'showdown');
  assert.throws(() => { r.knownVia = 'hero'; }, TypeError);
});
