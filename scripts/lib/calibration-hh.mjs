// calibration-hh.mjs — the hand-history parser (V3-PLAN §3.1 lane C, S-C §3).
//
// WHAT THIS IS. Text in, rows out:
//
//     parseCorpus(text, opts) -> { hands, rows, rejected, counts }
//
// A row is one (hand, player) pair whose four hole cards are known, carrying the cell the shipped
// taxonomy puts it in, the seat it was in relative to the button, the big blinds it won or lost,
// and — the field the whole spike turns on — HOW THE CARDS BECAME VISIBLE.
//
// THE VISIBILITY SPLIT IS THE POINT (S-C §2). Hole cards arrive through two doors and they are not
// interchangeable:
//
//   knownVia: 'hero'      dealt to the account that wrote the file. Visible on EVERY hand it is
//                         dealt in — folded, played, won, lost, mucked — so visibility is
//                         independent of how the hand turned out. One per hand; N hands, N rows.
//                         This is the ONLY door admissible for the primacy statistic (PC-1).
//   knownVia: 'showdown'  turned face up at the river. Conditional on the hand having been played
//                         not folded, having survived, and not having been mucked — all three
//                         correlated with the hand having worked out. Conditioning on it estimates
//                         E[bb | reached showdown], which is not what any ordering claim is about,
//                         and it is biased upward by construction. Descriptive coverage only.
//
// S-C's finding was that the plan's own bar (count SHOWDOWNS) is clearable by a corpus every one of
// whose hole cards comes through the biased door — 118 of 123 cells reach 100 showdowns in 1M
// hands. So the distinction is a FIRST-CLASS FIELD here rather than a footnote, and
// `scripts/lib/calibration.mjs` refuses showdown rows structurally rather than by convention.
//
// IT REFUSES RATHER THAN GUESSES. Every hand this parser cannot read for a reason it can name is
// rejected with that reason counted, and never coerced into a row:
//
//   * not 4-card Omaha (hold'em, 5-card, 6-card, hi/lo, stud) — the variant is read off the header
//   * not a cash game (tournament levels) — blinds in a tournament are not a stable bb unit
//   * not six-handed — the shipped model's POSITIONS list has exactly six seats, and a position
//     map for a short table is a MODELING CHOICE this file is not entitled to make. Rejecting is
//     free today (there is no corpus) and honest tomorrow.
//   * money that does not balance — sum(invested) - sum(returned) must equal sum(collected) + rake
//   * more than one `Dealt to X [cards]` line — that is not a first-person history, so its `hero`
//     door is not the door PC-1 describes
//
// CELLS COME FROM THE SHIPPED TAXONOMY, NEVER A REIMPLEMENTATION. `cellKeyOf` is imported from
// `scripts/lib/taxonomy.mjs`, so a parsed cell means exactly what a rendered cell means. The card
// encoding is likewise the shipped one (`rankCharValue` / `suitCharIndex`), so `Ac` becomes the
// same integer here as it does in the enumerator.
//
// NO NUMBER IN THIS FILE IS AN OPINION. Everything is arithmetic on the text: amounts, seat
// offsets, big-blind normalisation. There is no scoring, no threshold, no constant.

import { cellKeyOf, rankCharValue, suitCharIndex, RANK_CHARS, SUIT_CHARS } from './taxonomy.mjs';

/** the shipped six-max seat names, button-relative offset 0..5 */
export const POSITIONS_BY_BUTTON_OFFSET = Object.freeze(['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']);

/** the two visibility doors, in admissibility order (S-C §2) */
export const KNOWN_VIA = Object.freeze(['hero', 'showdown']);

/**
 * Every reason a hand can be refused. Frozen and exported so the report cannot invent a category
 * at print time and a caller can assert on the set: a reason nobody wrote down is a reason nobody
 * audits.
 */
export const REJECT_REASONS = Object.freeze([
  'not-a-hand-block',    // no parsable header line
  'not-omaha-pl',        // hold'em, stud, draw, limit omaha, anything that is not pot-limit Omaha
  'omaha-not-4-card',    // 5-card / 6-card Omaha, or a hole-card list that is not four cards
  'omaha-hi-lo',         // split-pot Omaha: netBB is not the quantity the model is about
  'not-cash',            // tournament / play-money: no stable big blind
  'no-stakes',           // the header carries no readable blind level
  'no-button',           // no `Seat #N is the button`
  'dead-button',         // the button seat was not dealt in
  'not-six-handed',      // see the header: a short-table position map is a choice, not a reading
  'no-blinds',           // nobody posted a big blind
  'multiple-dealt-to',   // not a first-person history
  'bad-cards',           // malformed, duplicated, or out-of-deck hole cards
  'money-imbalance',     // invested - returned !== collected + rake
  'truncated',           // the block ends mid-hand
]);
const REASON_SET = new Set(REJECT_REASONS);

/** half a cent — the tightest the currency amounts in these files are ever written */
const MONEY_EPS = 0.005;

// ---------------------------------------------------------------------------
// cards
// ---------------------------------------------------------------------------

/**
 * `Ac Kd Qh Js` -> [51, 45, 41, 36], using the SHIPPED encoding (rank index << 2 | suit index).
 * Returns null on anything that is not a clean list of distinct legal cards.
 */
export function cardsFromText(str) {
  const toks = String(str).trim().split(/\s+/).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const t of toks) {
    if (t.length !== 2) return null;
    const v = rankCharValue(t[0].toUpperCase());
    const s = suitCharIndex(t[1]);
    if (v < 2 || s < 0) return null;
    const card = ((v - 2) << 2) | s;
    if (seen.has(card)) return null;
    seen.add(card);
    out.push(card);
  }
  return out.length ? out : null;
}

/** the inverse, for reports and fixtures */
export function cardsToText(cards) {
  return cards.map((c) => RANK_CHARS[c >> 2] + SUIT_CHARS[c & 3]).join(' ');
}

// ---------------------------------------------------------------------------
// text scaffolding
// ---------------------------------------------------------------------------

const HEADER_RE = /^(?:PokerStars|PokerStars Zoom)\s+(?:Hand|Game)\s+#(\d+):\s*(.*?)\s*-\s*\d{4}\/\d{2}\/\d{2}/;

/**
 * Split a file into hand blocks. A block starts at a header line and runs to the line before the
 * next one, so a trailing partial hand stays a block and gets rejected as `truncated` rather than
 * silently dropped — a corpus that lost its last 400 bytes should say so.
 */
export function splitBlocks(text) {
  const lines = String(text).split(/\r?\n/);
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    if (HEADER_RE.test(line)) {
      if (cur) blocks.push(cur.join('\n'));
      cur = [line];
    } else if (cur) {
      cur.push(line);
    }
  }
  if (cur) blocks.push(cur.join('\n'));
  return blocks;
}

function money(str) {
  const n = Number(String(str).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function reject(reason, id) {
  if (!REASON_SET.has(reason)) throw new Error(`calibration-hh: unlisted reject reason ${reason}`);
  return { ok: false, reason, id: id || null };
}

// ---------------------------------------------------------------------------
// variant
// ---------------------------------------------------------------------------

/**
 * Read the game description out of the header. Order matters: "Omaha Pot Limit" is a SUBSTRING of
 * "5 Card Omaha Pot Limit", so the disqualifying shapes are tested first. Getting this backwards
 * is the exact way a 5-card corpus quietly becomes a 4-card one.
 */
export function classifyVariant(desc) {
  const d = String(desc);
  const stakes = d.match(/\((?:\$|€|£)?\s*([\d.]+)\s*\/\s*(?:\$|€|£)?\s*([\d.]+)/);
  if (/Level\s+[IVXLC\d]+/i.test(d) || /Tournament/i.test(d)) return { reason: 'not-cash' };
  const game = d.split('(')[0].trim();
  if (/Hi\/?Lo|Hi-Lo|H\/L|Split/i.test(game)) return { reason: 'omaha-hi-lo' };
  if (/\b[56]\s*Card\s+Omaha/i.test(game)) return { reason: 'omaha-not-4-card' };
  if (!/Omaha/i.test(game)) return { reason: 'not-omaha-pl' };
  if (!/Pot\s*Limit/i.test(game)) return { reason: 'not-omaha-pl' };   // limit / no-limit Omaha
  if (!stakes) return { reason: 'no-stakes' };
  const sb = Number(stakes[1]), bb = Number(stakes[2]);
  if (!(sb > 0) || !(bb > 0)) return { reason: 'no-stakes' };
  return { game, sb, bb };
}

// ---------------------------------------------------------------------------
// one hand
// ---------------------------------------------------------------------------

/**
 * Parse one block. Returns `{ ok: true, hand }` or `{ ok: false, reason, id }`.
 *
 * The money model, stated once because everything downstream reads `netBB`:
 *
 *   invested   every chip the player pushed forward — blinds, antes, calls, bets, raises. A
 *              `raises $A to $B` line sets the player's commitment FOR THAT STREET to $B, so the
 *              increment is B minus what they already had out this street. Reading $A as the
 *              increment is the classic PokerStars parsing bug and it silently understates
 *              aggression, so the street ledger is explicit here.
 *   returned   the uncalled portion handed back.
 *   collected  what came back from the pot(s).
 *   netBB      (collected + returned - invested) / bb
 *
 * and the balance identity the hand must satisfy before any of it is believed:
 *
 *   sum(invested) - sum(returned) - sum(collected) - rake == 0
 */
export function parseHand(block) {
  const lines = String(block).split(/\r?\n/);
  const h = lines[0].match(HEADER_RE);
  if (!h) return reject('not-a-hand-block');
  const id = h[1];

  const variant = classifyVariant(h[2]);
  if (variant.reason) return reject(variant.reason, id);
  const { sb, bb } = variant;

  // --- table line: seat count claim and the button ------------------------
  let buttonSeat = null;
  for (const line of lines) {
    const m = line.match(/^Table\s+.*Seat\s+#(\d+)\s+is the button/);
    if (m) { buttonSeat = Number(m[1]); break; }
  }
  if (buttonSeat == null) return reject('no-button', id);

  // --- seats --------------------------------------------------------------
  // A seat is DEALT IN unless the file says otherwise. `is sitting out` and `out of hand` are the
  // two markers PokerStars writes; both mean no cards, so both mean no row.
  const players = new Map();     // name -> record
  const bySeat = new Map();
  for (const line of lines) {
    const m = line.match(/^Seat\s+(\d+):\s+(.+?)\s+\(\s*(?:\$|€|£)?([\d.]+)\s+in chips\)(.*)$/);
    if (!m) continue;
    const seat = Number(m[1]);
    const name = m[2];
    const tail = m[4] || '';
    const dealt = !/is sitting out|out of hand/i.test(tail);
    const rec = {
      seat, name, stack: Number(m[3]), dealt,
      invested: 0, returned: 0, collected: 0, street: 0,
      cards: null, knownVia: null,
    };
    players.set(name, rec);
    bySeat.set(seat, rec);
  }

  const dealtSeats = [...bySeat.keys()].filter((s) => bySeat.get(s).dealt).sort((a, b) => a - b);
  if (!bySeat.has(buttonSeat) || !bySeat.get(buttonSeat).dealt) return reject('dead-button', id);

  // THE SHORT-TABLE REFUSAL. The shipped model has six named seats and no others. Mapping five
  // dealt players onto them requires deciding which seat is missing, which is a modeling choice
  // and not a reading of the file. So: refuse, count it, and say so in the report.
  if (dealtSeats.length !== 6) return reject('not-six-handed', id);

  // button-relative positions: 0 = BTN, then SB, BB, UTG, HJ, CO going clockwise
  const bi = dealtSeats.indexOf(buttonSeat);
  for (let k = 0; k < dealtSeats.length; k++) {
    const rec = bySeat.get(dealtSeats[(bi + k) % dealtSeats.length]);
    rec.pos = POSITIONS_BY_BUTTON_OFFSET[k];
  }

  // --- the ledger ---------------------------------------------------------
  let sawBB = false;
  let rake = null;
  let inSummary = false;
  let dealtToCount = 0;
  let heroName = null;
  const showdownCards = new Map();   // name -> cards text

  const commit = (rec, total) => { // set this street's commitment to `total`
    const add = total - rec.street;
    if (add > 0) { rec.invested += add; rec.street = total; }
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\*\*\*\s+SUMMARY\s+\*\*\*/.test(line)) { inSummary = true; continue; }
    if (/^\*\*\*\s+(FLOP|TURN|RIVER|SHOW DOWN|FIRST|SECOND)\b/.test(line)) {
      for (const p of players.values()) p.street = 0;   // a new street resets the commitments
      continue;
    }

    if (!inSummary) {
      let m;
      if ((m = line.match(/^Dealt to\s+(.+?)\s+\[([^\]]+)\]\s*$/))) {
        dealtToCount++;
        heroName = m[1];
        showdownCards.set(' hero', m[2]);
        continue;
      }
      if ((m = line.match(/^(.+?): posts (?:small blind|big blind|the ante|small & big blinds)\s+(?:\$|€|£)?([\d.]+)/))) {
        const rec = players.get(m[1]);
        if (!rec) continue;
        const amt = money(m[2]);
        if (/big blind/i.test(line)) sawBB = true;
        // antes sit outside the street ledger: they are not part of a raise's "to" arithmetic
        if (/the ante/i.test(line)) rec.invested += amt;
        else { rec.invested += amt; rec.street = Math.max(rec.street, amt); }
        continue;
      }
      if ((m = line.match(/^(.+?): raises\s+(?:\$|€|£)?[\d.]+\s+to\s+(?:\$|€|£)?([\d.]+)/))) {
        const rec = players.get(m[1]); if (rec) commit(rec, money(m[2]));
        continue;
      }
      if ((m = line.match(/^(.+?): (?:calls|bets)\s+(?:\$|€|£)?([\d.]+)/))) {
        const rec = players.get(m[1]);
        if (rec) { const a = money(m[2]); rec.invested += a; rec.street += a; }
        continue;
      }
      if ((m = line.match(/^Uncalled bet\s+\(\s*(?:\$|€|£)?([\d.]+)\)\s+returned to\s+(.+?)\s*$/))) {
        const rec = players.get(m[2]); if (rec) rec.returned += money(m[1]);
        continue;
      }
      if ((m = line.match(/^(.+?)\s+collected\s+\(?(?:\$|€|£)?([\d.]+)\)?\s+from\s+/))) {
        const rec = players.get(m[1]); if (rec) rec.collected += money(m[2]);
        continue;
      }
      if ((m = line.match(/^(.+?): (?:shows|shows hand)\s+\[([^\]]+)\]/))) {
        showdownCards.set(m[1], m[2]);
        continue;
      }
    } else {
      let m;
      // `Seat 3: Alice (button) showed [Ac Kd Qh Js] and won ($12.50) with ...`
      // `Seat 5: Bob mucked [7c 7d 2h 3s]`   — revealed in the summary of an all-in
      if ((m = line.match(/^Seat\s+\d+:\s+(.+?)\s+(?:\([^)]*\)\s+)?(?:showed|mucked)\s+\[([^\]]+)\]/))) {
        if (!showdownCards.has(m[1])) showdownCards.set(m[1], m[2]);
        continue;
      }
      if ((m = line.match(/\|\s*Rake\s+(?:\$|€|£)?([\d.]+)/))) { rake = money(m[1]); continue; }
    }
  }

  if (!sawBB) return reject('no-blinds', id);
  if (dealtToCount > 1) return reject('multiple-dealt-to', id);
  if (rake == null) return reject('truncated', id);

  // --- the balance identity ----------------------------------------------
  let invested = 0, returned = 0, collected = 0;
  for (const p of players.values()) { invested += p.invested; returned += p.returned; collected += p.collected; }
  const imbalance = invested - returned - collected - rake;
  if (!(Math.abs(imbalance) <= MONEY_EPS)) return reject('money-imbalance', id);

  // --- cards, cells, rows -------------------------------------------------
  if (heroName != null) {
    const rec = players.get(heroName);
    if (!rec || !rec.dealt) return reject('bad-cards', id);
    const cards = cardsFromText(showdownCards.get(' hero'));
    if (!cards) return reject('bad-cards', id);
    if (cards.length !== 4) return reject('omaha-not-4-card', id);
    rec.cards = cards;
    rec.knownVia = 'hero';
  }
  showdownCards.delete(' hero');
  for (const [name, txt] of showdownCards) {
    const rec = players.get(name);
    if (!rec || !rec.dealt) continue;               // an observer line, not a dealt seat
    if (rec.knownVia === 'hero') continue;          // hero's door already the better one
    const cards = cardsFromText(txt);
    if (!cards) return reject('bad-cards', id);
    if (cards.length !== 4) return reject('omaha-not-4-card', id);
    rec.cards = cards;
    rec.knownVia = 'showdown';
  }

  // no two known hands may share a card — the deck check the file cannot do for itself
  const used = new Set();
  for (const p of players.values()) {
    if (!p.cards) continue;
    for (const c of p.cards) { if (used.has(c)) return reject('bad-cards', id); used.add(c); }
  }

  const rows = [];
  for (const s of dealtSeats) {
    const p = bySeat.get(s);
    if (!p.cards) continue;
    rows.push(Object.freeze({
      handId: id,
      seat: p.seat,
      pos: p.pos,
      cell: cellKeyOf(p.cards),
      knownVia: p.knownVia,
      cards: Object.freeze(p.cards.slice()),
      netBB: (p.collected + p.returned - p.invested) / bb,
      invBB: p.invested / bb,
      vpip: p.invested > (p.pos === 'BB' ? bb : (p.pos === 'SB' ? sb : 0)) + MONEY_EPS,
    }));
  }

  return {
    ok: true,
    hand: Object.freeze({
      id, sb, bb, buttonSeat,
      seats: dealtSeats.length,
      potBB: (invested - returned) / bb,
      rakeBB: rake / bb,
      heroName,
      rows: Object.freeze(rows),
    }),
  };
}

// ---------------------------------------------------------------------------
// a corpus
// ---------------------------------------------------------------------------

/**
 * Parse a whole file (or a concatenation of files).
 *
 * The counts are the report S-C §3 prints, and every one of them is a count of things that
 * happened rather than an estimate: blocks seen, hands accepted, hands rejected by reason, rows by
 * visibility door, cells touched. `heroRows` is the number that matters and the number S-C §7.6
 * says future spikes must count instead of showdowns.
 */
export function parseCorpus(text, opts = {}) {
  const blocks = splitBlocks(text);
  const hands = [];
  const rows = [];
  const rejected = [];
  const byReason = Object.create(null);
  for (const r of REJECT_REASONS) byReason[r] = 0;

  const limit = Number.isFinite(opts.limit) ? opts.limit : Infinity;
  for (const b of blocks) {
    if (hands.length >= limit) break;
    const res = parseHand(b);
    if (!res.ok) {
      byReason[res.reason]++;
      rejected.push({ id: res.id, reason: res.reason });
      continue;
    }
    hands.push(res.hand);
    for (const row of res.hand.rows) rows.push(row);
  }

  let heroRows = 0, showdownRows = 0;
  const cells = new Set();
  for (const r of rows) {
    if (r.knownVia === 'hero') heroRows++; else showdownRows++;
    cells.add(r.cell);
  }

  return {
    hands, rows, rejected,
    counts: Object.freeze({
      blocks: blocks.length,
      accepted: hands.length,
      rejected: rejected.length,
      byReason: Object.freeze({ ...byReason }),
      heroRows,
      showdownRows,
      cellsTouched: cells.size,
    }),
  };
}
