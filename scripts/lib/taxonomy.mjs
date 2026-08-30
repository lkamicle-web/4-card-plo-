// taxonomy.mjs — the 29-row rank-archetype cascade x 5-column suit topology.
// An exact partition of all C(52,4) = 270,725 four-card hands.
//
// The cascade is a direct port of the validated reference classifier; its rules are unchanged.
// Internally it reasons on rank VALUES 2..14 (A = 14) because every rule in the model brief is
// written that way ("pair >= J" means >= 11). Card indices use the engine encoding
// c = rank0*4 + suit with rank0 = 0..12, so rankValue = (c >> 2) + 2.
//
// No Node APIs: this module is inlined verbatim into the page for single-hand lookup.

export const ROW_ORDER = [
  'AA_BIGPAIR', 'AA_BROADWAY', 'AA_CONNECTED', 'AA_SMALLPAIR', 'AA_DANGLER', 'A_BLOCKED',
  'DBLPAIR_BIG', 'DBLPAIR_MIXED', 'BIGPAIR_CONN', 'BIGPAIR_ACE', 'BIGPAIR_JUNK', 'TRIPS_BIG',
  'BROADWAY_RUN', 'RUN0_HIGH', 'RUN0_LOW', 'RUN1_BOTTOM', 'RUN1_TOPMID', 'RUN2', 'RUN3',
  'ACE_RUN3', 'RUN3_DANGLER', 'DBL_CONNECTOR',
  'DBLPAIR_SMALL', 'SMPAIR_CONN', 'SMPAIR_ACE', 'SMPAIR_JUNK', 'TRIPS_SMALL',
  'ACE_JUNK', 'TRASH',
];

/** Display order, worst -> best suit topology. */
export const COL_ORDER = ['RB', 'FLAW', 'SS', 'SSA', 'DS'];

export const ROW_META = {
  AA_BIGPAIR:    { label: 'AA + big pair',          short: 'AA+bigpr',  band: 'AA' },
  AA_BROADWAY:   { label: 'AA + two broadway',      short: 'AA+bway',   band: 'AA' },
  AA_CONNECTED:  { label: 'AA + connectors',        short: 'AA+conn',   band: 'AA' },
  AA_SMALLPAIR:  { label: 'AA + small pair',        short: 'AA+smpr',   band: 'AA' },
  AA_DANGLER:    { label: 'AA + dangler',           short: 'AA+dang',   band: 'AA' },
  A_BLOCKED:     { label: 'Trip/quad aces',         short: 'AAA+',      band: 'AA' },
  DBLPAIR_BIG:   { label: 'Two big pairs',          short: '2 big pr',  band: 'BIGPAIR' },
  DBLPAIR_MIXED: { label: 'Big pair + small pair',  short: 'big+sm pr', band: 'BIGPAIR' },
  BIGPAIR_CONN:  { label: 'Big pair + connectors',  short: 'bigpr+con', band: 'BIGPAIR' },
  BIGPAIR_ACE:   { label: 'Big pair + ace',         short: 'bigpr+A',   band: 'BIGPAIR' },
  BIGPAIR_JUNK:  { label: 'Big pair + junk',        short: 'bigpr+jnk', band: 'BIGPAIR' },
  TRIPS_BIG:     { label: 'Big trips/quads',        short: 'big trips', band: 'BIGPAIR' },
  BROADWAY_RUN:  { label: 'Broadway run',           short: 'bway run',  band: 'RUNDOWN' },
  RUN0_HIGH:     { label: 'High rundown (0-gap)',   short: 'run0 high', band: 'RUNDOWN' },
  RUN0_LOW:      { label: 'Low rundown (0-gap)',    short: 'run0 low',  band: 'RUNDOWN' },
  RUN1_BOTTOM:   { label: '1-gap, bottom',          short: '1gap btm',  band: 'RUNDOWN' },
  RUN1_TOPMID:   { label: '1-gap, top/middle',      short: '1gap top',  band: 'RUNDOWN' },
  RUN2:          { label: '2-gap rundown',          short: '2gap run',  band: 'RUNDOWN' },
  RUN3:          { label: '3-gap rundown',          short: '3gap run',  band: 'RUNDOWN' },
  ACE_RUN3:      { label: 'Ace + 3-card run',       short: 'A+3run',    band: 'SEMI' },
  RUN3_DANGLER:  { label: '3-run + dangler',        short: '3run+dang', band: 'SEMI' },
  DBL_CONNECTOR: { label: 'Two connector pairs',    short: 'dbl conn',  band: 'SEMI' },
  DBLPAIR_SMALL: { label: 'Two small pairs',        short: '2 sm pr',   band: 'SMALLPAIR' },
  SMPAIR_CONN:   { label: 'Small pair + connectors', short: 'smpr+conn', band: 'SMALLPAIR' },
  SMPAIR_ACE:    { label: 'Small pair + ace',       short: 'smpr+A',    band: 'SMALLPAIR' },
  SMPAIR_JUNK:   { label: 'Small pair + junk',      short: 'smpr+junk', band: 'SMALLPAIR' },
  TRIPS_SMALL:   { label: 'Small trips/quads',      short: 'sm trips',  band: 'SMALLPAIR' },
  ACE_JUNK:      { label: 'Ace + junk',             short: 'A + junk',  band: 'JUNK' },
  TRASH:         { label: 'Trash',                  short: 'trash',     band: 'JUNK' },
};

export const BAND_ORDER = ['AA', 'BIGPAIR', 'RUNDOWN', 'SEMI', 'SMALLPAIR', 'JUNK'];
export const BAND_META = {
  AA:        { label: 'AA',             rows: [1, 6] },
  BIGPAIR:   { label: 'Big pairs',      rows: [7, 12] },
  RUNDOWN:   { label: 'Rundowns',       rows: [13, 19] },
  SEMI:      { label: 'Semi-connected', rows: [20, 22] },
  SMALLPAIR: { label: 'Small pairs',    rows: [23, 27] },
  JUNK:      { label: 'Junk',           rows: [28, 29] },
};

export const COL_META = {
  RB:   { label: 'Rainbow',              header: 'RAINBOW' },
  FLAW: { label: 'Suit-wasted',          header: 'FLAWED' },
  SS:   { label: 'Single-suited',        header: 'SINGLE-SUITED' },
  SSA:  { label: 'Single-suited, nut',   header: 'SS-NUT' },
  DS:   { label: 'Double-suited',        header: 'DOUBLE-SUITED' },
};

// ---------------------------------------------------------------------------
// column: suit topology
// ---------------------------------------------------------------------------
/** @param {number[]} cards 4 card indices */
export function colOf(cards) {
  const sc = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) sc[cards[i] & 3]++;
  const pat = sc.slice().sort((a, b) => b - a).filter((x) => x > 0).join('');
  if (pat === '4' || pat === '31') return 'FLAW';
  if (pat === '22') return 'DS';
  if (pat === '211') {
    const s = sc.indexOf(2);
    for (let i = 0; i < 4; i++) if ((cards[i] & 3) === s && (cards[i] >> 2) === 12) return 'SSA';
    return 'SS';
  }
  return 'RB';
}

/** at least one suited PAIR is ace-topped (16.95% of hands) */
export function nutSuited(cards) {
  const cnt = [0, 0, 0, 0], hasAce = [false, false, false, false];
  for (let i = 0; i < 4; i++) {
    const s = cards[i] & 3;
    cnt[s]++;
    if ((cards[i] >> 2) === 12) hasAce[s] = true;
  }
  for (let s = 0; s < 4; s++) if (cnt[s] >= 2 && hasAce[s]) return true;
  return false;
}

/** suit pattern key: '4' monotone, '31' three-flush, '22' ds, '211' ss, '1111' rainbow */
export function suitPattern(cards) {
  const sc = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) sc[cards[i] & 3]++;
  return sc.slice().sort((a, b) => b - a).filter((x) => x > 0).join('');
}

// ---------------------------------------------------------------------------
// rank-structure helpers (rank VALUES 2..14, wheel-aware)
// ---------------------------------------------------------------------------
export function rankValues(cards) {
  const rs = [ (cards[0] >> 2) + 2, (cards[1] >> 2) + 2, (cards[2] >> 2) + 2, (cards[3] >> 2) + 2 ];
  rs.sort((a, b) => b - a);
  return rs;
}

function multiplicities(rs) {
  const m = {};
  for (const r of rs) m[r] = (m[r] || 0) + 1;
  return m;
}
function shape(m) { return Object.values(m).sort((a, b) => b - a).join(''); }

/** total gap of 4 distinct ranks = r1 - r4 - 3, wheel-aware minimum */
export function gapOf4(rs) {
  const g = (arr) => { const s = arr.slice().sort((a, b) => b - a); return s[0] - s[3] - 3; };
  let best = g(rs);
  if (rs.includes(14)) best = Math.min(best, g(rs.map((r) => (r === 14 ? 1 : r))));
  return best;
}

/**
 * The top card in the SAME orientation gapOf4 scored the hand in. A432 is only a 0-gap rundown at
 * all because the wheel maps its ace to 1, so grading it "high" on the unmapped ace (14) reads the
 * hand in one orientation and grades it in another. A432's top card is the 4, and it plays like one:
 * paired Monte Carlo puts A432ds 8-11 points below JT98ds/QJT9ds, and 5.9 below T987ds, a member of
 * the LOW row. Used by rowOf's 0-gap high/low split so the two lines agree.
 */
export function topInGapOrientation(rs) {
  const g = (arr) => { const s = arr.slice().sort((a, b) => b - a); return [s[0], s[0] - s[3] - 3]; };
  const raw = g(rs);
  if (!rs.includes(14)) return raw[0];
  const w = g(rs.map((r) => (r === 14 ? 1 : r)));
  return w[1] < raw[1] ? w[0] : raw[0];
}

/** [r1-r2-1, r2-r3-1, r3-r4-1] in the orientation minimising the total gap */
export function gapVec(rs) {
  const mk = (arr) => {
    const s = arr.slice().sort((a, b) => b - a);
    return [s[0] - s[1] - 1, s[1] - s[2] - 1, s[2] - s[3] - 1];
  };
  let v = mk(rs);
  if (rs.includes(14)) {
    const w = mk(rs.map((r) => (r === 14 ? 1 : r)));
    if (w[0] + w[1] + w[2] < v[0] + v[1] + v[2]) v = w;
  }
  return v;
}

/** smallest max-min over the four 3-card subsets, wheel-aware */
export function best3Span(rs) {
  const variants = rs.includes(14) ? [rs, rs.map((r) => (r === 14 ? 1 : r))] : [rs];
  let best = 99;
  for (const v of variants) {
    for (let i = 0; i < 4; i++) {
      const sub = v.filter((_, j) => j !== i).sort((a, b) => b - a);
      best = Math.min(best, sub[0] - sub[2]);
    }
  }
  return best;
}

/** two separated connector pairs, e.g. KQ76 */
export function isDoubleConnector(rs) {
  const s = rs.slice().sort((a, b) => b - a);
  return (s[0] - s[1] <= 2) && (s[2] - s[3] <= 2) && (s[1] - s[2] >= 4);
}

/**
 * danglerCount: cards belonging to neither a pair nor any 3-card cluster of span <= 4
 * (wheel-aware), capped at 2.
 */
export function danglerCount(cards) {
  const rsRaw = rankValues(cards);
  const variants = rsRaw.includes(14) ? [rsRaw, rsRaw.map((r) => (r === 14 ? 1 : r))] : [rsRaw];
  let best = 2;
  for (const rs of variants) {
    const inPair = [false, false, false, false];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (i !== j && rs[i] === rs[j]) inPair[i] = true;
    }
    const inCluster = [false, false, false, false];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) for (let c = b + 1; c < 4; c++) {
      const t = [rs[a], rs[b], rs[c]].sort((x, y) => y - x);
      if (t[0] - t[2] <= 4) { inCluster[a] = true; inCluster[b] = true; inCluster[c] = true; }
    }
    let n = 0;
    for (let i = 0; i < 4; i++) if (!inPair[i] && !inCluster[i]) n++;
    best = Math.min(best, Math.min(n, 2));
  }
  return best;
}

/** distinct hero ranks in {A, K, Q} — the domination feature for the vs-3-bet node */
export function domDistinct(cards) {
  const seen = new Set();
  for (let i = 0; i < 4; i++) { const r = cards[i] >> 2; if (r >= 10) seen.add(r); }
  return seen.size;
}

/** raw within-cell adjustment (section 2.9): 2*(#ranks >= J) - 3*danglers + 4*[nutSuited] */
export function adjRaw(cards) {
  let hi = 0;
  for (let i = 0; i < 4; i++) if ((cards[i] >> 2) >= 9) hi++;
  return 2 * hi - 3 * danglerCount(cards) + (nutSuited(cards) ? 4 : 0);
}

// ---------------------------------------------------------------------------
// ROW cascade — first match wins
// ---------------------------------------------------------------------------
export function rowOf(cards) {
  const rs = rankValues(cards);
  const m = multiplicities(rs);
  const sh = shape(m);
  const aces = m[14] || 0;

  // ---- ACES ----
  if (aces >= 3) return 'A_BLOCKED';
  if (aces === 2) {
    const rest = rs.filter((r) => r !== 14);
    if (rest[0] === rest[1]) return rest[0] >= 11 ? 'AA_BIGPAIR' : 'AA_SMALLPAIR';
    const x = rest[0], y = rest[1];
    if (x >= 10 && y >= 10) return 'AA_BROADWAY';
    if (x - y <= 3) return 'AA_CONNECTED';
    return 'AA_DANGLER';
  }

  // ---- TRIPS / QUADS (no AA) ----
  if (sh === '4' || sh === '31') {
    const trip = +Object.keys(m).find((r) => m[r] >= 3);
    return trip >= 11 ? 'TRIPS_BIG' : 'TRIPS_SMALL';
  }

  // ---- DOUBLE PAIRS (no AA) ----
  if (sh === '22') {
    const ps = Object.keys(m).map(Number).sort((a, b) => b - a);
    if (ps[0] >= 10 && ps[1] >= 10) return 'DBLPAIR_BIG';
    if (ps[0] >= 11) return 'DBLPAIR_MIXED';
    return 'DBLPAIR_SMALL';
  }

  // ---- ONE PAIR + 2 UNPAIRED ----
  if (sh === '211') {
    const p = +Object.keys(m).find((r) => m[r] === 2);
    const kk = rs.filter((r) => r !== p);
    const big = p >= 11;
    const dis = [p, kk[0], kk[1]].sort((a, b) => b - a);
    const wheelDis = dis.includes(14) ? dis.map((r) => (r === 14 ? 1 : r)).sort((a, b) => b - a) : null;
    const span = Math.min(dis[0] - dis[2], wheelDis ? wheelDis[0] - wheelDis[2] : 99);
    const conn = span <= 4;
    const aceHigh = kk.includes(14);
    if (big) return conn ? 'BIGPAIR_CONN' : (aceHigh ? 'BIGPAIR_ACE' : 'BIGPAIR_JUNK');
    return conn ? 'SMPAIR_CONN' : (aceHigh ? 'SMPAIR_ACE' : 'SMPAIR_JUNK');
  }

  // ---- FOUR DISTINCT RANKS ----
  const G = gapOf4(rs);
  const gv = gapVec(rs);
  if (rs.every((r) => r >= 10)) return 'BROADWAY_RUN';
  // high/low is read in the orientation that made this a 0-gap run, so the wheel hand A432 files as
  // LOW (top card 4) rather than HIGH on an ace it is not using as an ace. The 1-gap split below
  // already reads gapVec, which is wheel-aware, so A543/A532/A542 are graded in the same orientation
  // that admitted them (A543 -> BOTTOM, gap under the wheel ace; A532/A542 -> TOPMID) and need no
  // equivalent change.
  if (G === 0) return topInGapOrientation(rs) >= 11 ? 'RUN0_HIGH' : 'RUN0_LOW';
  if (G === 1) return gv[2] === 1 ? 'RUN1_BOTTOM' : 'RUN1_TOPMID';
  if (G === 2) return 'RUN2';
  if (G === 3) return 'RUN3';
  const b3 = best3Span(rs);
  if (b3 <= 3) return rs.includes(14) ? 'ACE_RUN3' : 'RUN3_DANGLER';
  if (isDoubleConnector(rs)) return 'DBL_CONNECTOR';
  if (rs.includes(14)) return 'ACE_JUNK';
  return 'TRASH';
}

export function cellKeyOf(cards) { return rowOf(cards) + '|' + colOf(cards); }

// ---------------------------------------------------------------------------
// HAND SEARCH — V2-PLAN §5.1.  A pure parser, above the browser cut on purpose:
// it needs rowOf / colOf and the page needs it, so it is inlined with them.
// ---------------------------------------------------------------------------
// Grammar:   <4 ranks, any order> <optional suit code>
//   ranks    2..9 T J Q K A, case-insensitive, separators ignored
//   suffix   R | RB -> RB · SS -> SS · SSA -> SSA · DS -> DS · F | FLAW -> FLAW
//
// The suffix table is read off COL_ORDER, and a suffix names a COLUMN outright — ranks plus a suit
// code is a cell, and the cell is the finest thing this model resolves. `F` covers both the
// three-flush and the monotone pattern because `colOf` folds both into the one suit-wasted column;
// the search does not try to separate them, and neither does anything downstream of it.
export const SEARCH_SUFFIXES = {
  R: { col: 'RB' },
  RB: { col: 'RB' },
  SS: { col: 'SS' },
  SSA: { col: 'SSA' },
  DS: { col: 'DS' },
  F: { col: 'FLAW' },
  FLAW: { col: 'FLAW' },
};

export const RANK_CHARS = '23456789TJQKA';
/** 'T' -> 10, 'A' -> 14, anything else -> 0 */
export function rankCharValue(ch) { const i = RANK_CHARS.indexOf(ch); return i < 0 ? 0 : i + 2; }
/** 10 -> 'T', 14 -> 'A' */
export function rankValueChar(v) { return RANK_CHARS[v - 2] || '?'; }

/* The card alphabet, and the encoding every function above already uses:
 *     card = RANK_CHARS.indexOf(rank) * 4 + SUIT_CHARS.indexOf(suit)
 * The two alphabets are DISJOINT — no suit letter is a rank, no rank is a suit letter — which is
 * the whole reason one parser can take both query grammars without backtracking. See
 * parseHandQuery: the second character decides, once, and is never revisited. */
export const SUIT_CHARS = 'shdc';
/** 's' -> 0, 'C' -> 3, anything else -> -1 */
export function suitCharIndex(ch) { return SUIT_CHARS.indexOf(String(ch).toLowerCase()); }
/** 51 -> 'Ac' */
export function cardChars(card) { return RANK_CHARS[card >> 2] + SUIT_CHARS[card & 3]; }

/**
 * The first legal 4-card hand with these rank VALUES whose suit topology matches `want`
 * (`{col}`, or `{}` to match anything). Exhaustive over the 256 suit assignments and decided by
 * the shipped `colOf`, so "no such hand" is a proof, not a guess — which is what lets the parser
 * report a structurally empty cell as empty instead of guessing at it.
 * @returns {number[]|null} card indices, descending, or null
 */
export function suitsForRanks(ranks, want) {
  const r0 = [ranks[0] - 2, ranks[1] - 2, ranks[2] - 2, ranks[3] - 2];
  const cards = [0, 0, 0, 0];
  for (let a = 0; a < 256; a++) {
    cards[0] = r0[0] * 4 + (a & 3); cards[1] = r0[1] * 4 + ((a >> 2) & 3);
    cards[2] = r0[2] * 4 + ((a >> 4) & 3); cards[3] = r0[3] * 4 + ((a >> 6) & 3);
    let dup = false;
    for (let i = 0; i < 4 && !dup; i++) for (let j = i + 1; j < 4; j++) if (cards[i] === cards[j]) { dup = true; break; }
    if (dup) continue;
    if (want.col && colOf(cards) !== want.col) continue;
    return cards.slice().sort((x, y) => y - x);
  }
  return null;
}

/**
 * The card grammar's half of parseHandQuery: four SPECIFIC cards, rank+suit each, in any order.
 * The cell comes back from the classifier itself rather than being synthesised from a suit code,
 * so `AsKsQs Js` lands in FLAW because `colOf` puts it there — no suffix, no inference.
 * `out` is parseHandQuery's shared result skeleton.
 */
function parseCards(s, out) {
  const cards = [];
  let i = 0;
  while (i < s.length && cards.length < 4) {
    const rv = rankCharValue(s[i]);
    if (!rv) {
      out.status = 'invalid';
      out.message = '"' + s[i] + '" is not a rank — a card is a rank then a suit (As Kh 9s 8d)';
      return out;
    }
    if (i + 1 === s.length) { out.message = 'suit of the ' + s[i] + ' — s, h, d or c'; return out; }
    const su = suitCharIndex(s[i + 1]);
    if (su < 0) {
      out.status = 'invalid';
      out.message = '"' + s[i + 1] + '" is not a suit — use s, h, d or c';
      return out;
    }
    const card = (rv - 2) * 4 + su;
    if (cards.indexOf(card) >= 0) { out.status = 'invalid'; out.message = cardChars(card) + ' appears twice'; return out; }
    cards.push(card);
    i += 2;
  }
  if (cards.length < 4) {
    out.message = (4 - cards.length) + (cards.length === 3 ? ' more card' : ' more cards');
    return out;
  }
  if (i < s.length) { out.status = 'invalid'; out.message = 'more than four cards — a PLO hand holds exactly four'; return out; }

  cards.sort((a, b) => b - a);
  out.status = 'ok'; out.level = 'hand'; out.cards = cards;
  out.ranks = rankValues(cards);
  out.canon = cards.map(cardChars).join('');
  out.row = rowOf(cards); out.col = colOf(cards);
  out.cellKey = out.row + '|' + out.col;
  out.message = 'one specific hand — the cell it actually lands in';
  return out;
}

/**
 * Parse a §5.1 hand-search query and resolve it as deep as the input determines.
 *
 * ONE box, TWO grammars — this is the universal finder:
 *   cards   four specific cards, rank+suit each, any order      AsKh9s8d
 *   class   four ranks, any order, plus an optional suit code   9655 · 9655DS
 * They are told apart on the SECOND CHARACTER and never backtracked: the rank and suit alphabets
 * are disjoint, so a rank followed by a suit letter can only be the card grammar, and a class
 * query's second character is always another rank. Every other field below is shared, so the
 * caller reads one `level` and does not care which grammar produced it.
 *
 * status  'ok'          resolved; read `level`
 *         'incomplete'  a legal prefix — keep typing (''/'96'/'9655S'/'AsK')
 *         'invalid'     cannot become a legal query ('9655X', '965DS', 'AAAAA', 'AsAs9h8d')
 *         'void'        well-formed, but NO legal hand has those ranks in that column
 * level   'row'   ranks only — the rank row, identical in all five suit columns
 *         'cell'  ranks + a suit code: one cell
 *         'hand'  four specific cards: the cell they actually land in, read off the classifier
 *                 instead of synthesised from a suit code
 *
 * Pure: no model, no DOM, no clock. Every field is derived from the taxonomy above.
 */
export function parseHandQuery(q) {
  const input = q == null ? '' : String(q);
  const s = input.replace(/[\s,\-_./]/g, '').toUpperCase();
  const out = {
    input, query: s, status: 'incomplete', level: null,
    ranks: null, canon: '', suffix: null,
    row: null, col: null, cellKey: null, cards: null, message: '',
  };
  if (!s) { out.message = 'four cards — AsKh9s8d — or four ranks — 9655, 9655DS'; return out; }

  /* one character of lookahead, no backtracking: see the note on SUIT_CHARS */
  if (rankCharValue(s[0]) && suitCharIndex(s[1]) >= 0) return parseCards(s, out);

  const ranks = [];
  let i = 0;
  while (i < s.length && ranks.length < 4 && RANK_CHARS.indexOf(s[i]) >= 0) { ranks.push(rankCharValue(s[i])); i++; }
  const rest = s.slice(i);
  if (ranks.length < 4) {
    if (rest) {
      out.status = 'invalid';
      out.message = '"' + rest[0] + '" is not a rank — four ranks come first (2-9, T, J, Q, K, A)';
    } else {
      out.message = (4 - ranks.length) + (ranks.length === 3 ? ' more rank' : ' more ranks');
    }
    return out;
  }
  /* order never matters: canonicalise to the descending rank pattern the taxonomy reasons on */
  ranks.sort((a, b) => b - a);
  out.ranks = ranks;
  out.canon = ranks.map(rankValueChar).join('');

  /* rowOf is rank-only, so ANY legal suiting of these ranks names the row */
  const anyCards = suitsForRanks(ranks, {});
  out.row = rowOf(anyCards);

  if (!rest) {
    out.status = 'ok'; out.level = 'row'; out.cards = anyCards;
    out.message = 'rank row — the same row in all five suit columns';
    return out;
  }
  if (RANK_CHARS.indexOf(rest[0]) >= 0) {
    out.status = 'invalid'; out.message = 'more than four ranks — a PLO hand holds exactly four';
    return out;
  }
  const suf = Object.prototype.hasOwnProperty.call(SEARCH_SUFFIXES, rest) ? SEARCH_SUFFIXES[rest] : null;
  if (!suf) {
    const partial = Object.keys(SEARCH_SUFFIXES).some((k) => k.length > rest.length && k.slice(0, rest.length) === rest);
    out.status = partial ? 'incomplete' : 'invalid';
    out.message = partial ? 'keep typing — R/RB, SS, SSA, DS or F'
      : '"' + rest + '" is not a suit code — use R/RB, SS, SSA, DS or F';
    return out;
  }
  out.suffix = rest; out.col = suf.col;
  out.cellKey = out.row + '|' + suf.col;

  const cards = suitsForRanks(ranks, suf);
  if (cards) {
    out.status = 'ok'; out.level = 'cell'; out.cards = cards;
    out.message = 'one cell — the suit code names the column, the ranks name the row';
    return out;
  }
  out.status = 'void';
  out.message = 'no legal hand has those ranks — that cell is structurally empty';
  return out;
}

/* @browser-cut — everything below this line is Node-side only and is not inlined into the page */

// ---------------------------------------------------------------------------
// Full enumeration (Node-side; also the source of every combo count in the model)
// ---------------------------------------------------------------------------
/**
 * Enumerate all 270,725 hands once, producing everything downstream needs.
 * @returns {{
 *   cellIndex: Int16Array, hands: Uint32Array, cellStart: Int32Array,
 *   cellKeys: string[], combos: Int32Array, feat: object
 * }}
 */
export function enumerateAll() {
  const cellKeys = [];
  const cellIdx = new Map();
  for (const r of ROW_ORDER) for (const c of COL_ORDER) { cellIdx.set(r + '|' + c, cellKeys.length); cellKeys.push(r + '|' + c); }
  const NC = cellKeys.length; // 145

  const TOTAL = 270725;
  const packed = new Uint32Array(TOTAL);
  const cellOf = new Int16Array(TOTAL);
  const combos = new Int32Array(NC);

  // per-cell feature accumulators
  const accDang = new Float64Array(NC);
  const accNut = new Float64Array(NC);
  const accDom = new Float64Array(NC);
  const accAdj = new Float64Array(NC);
  const accMono = new Float64Array(NC);   // share of pattern '4'
  const accTri = new Float64Array(NC);    // share of pattern '31'
  const accHi9 = new Float64Array(NC);    // share with r1 <= 9 (no card above 9)
  const accQuads = new Float64Array(NC);
  // per-cell examples indexed by adjRaw value, so 6 can be picked to SPAN the cell
  const exByAdj = Array.from({ length: NC }, () => new Map());


  const h = [0, 0, 0, 0];
  let n = 0;
  for (let a = 0; a < 52; a++) {
    h[0] = a;
    for (let b = a + 1; b < 52; b++) {
      h[1] = b;
      for (let c = b + 1; c < 52; c++) {
        h[2] = c;
        for (let d = c + 1; d < 52; d++) {
          h[3] = d;
          const ci = cellIdx.get(rowOf(h) + '|' + colOf(h));
          const pk = (a | (b << 6) | (c << 12) | (d << 18)) >>> 0;
          packed[n] = pk;
          cellOf[n] = ci;
          combos[ci]++;
          n++;

          const dg = danglerCount(h);
          const ns = nutSuited(h);
          const pat = suitPattern(h);
          const rs = rankValues(h);
          let hiCount = 0;
          for (let i = 0; i < 4; i++) if ((h[i] >> 2) >= 9) hiCount++;
          const ar = 2 * hiCount - 3 * dg + (ns ? 4 : 0);
          accDang[ci] += dg;
          accNut[ci] += ns ? 1 : 0;
          accDom[ci] += domDistinct(h);
          accAdj[ci] += ar;
          if (pat === '4') accMono[ci]++;
          if (pat === '31') accTri[ci]++;
          if (rs[0] <= 9) accHi9[ci]++;
          const mm = multiplicities(rs);
          if (Object.values(mm).some((x) => x === 4)) accQuads[ci]++;

          // keep the first four and the last four hands at each adjRaw value, so the examples span
          // the enumeration rather than clustering at its start (the enumeration runs low ranks
          // first, so head-only sampling would show AAJJds where the cell's headline hand is AAKKds)
          let bucket = exByAdj[ci].get(ar);
          if (!bucket) { bucket = { head: [], tail: [], n: 0 }; exByAdj[ci].set(ar, bucket); }
          if (bucket.head.length < 4) bucket.head.push(pk);
          else bucket.tail[bucket.n % 4] = pk;
          bucket.n++;

        }
      }
    }
  }

  // group hand indices by cell into one packed array with offsets
  const cellStart = new Int32Array(NC + 1);
  for (let i = 0; i < NC; i++) cellStart[i + 1] = cellStart[i] + combos[i];
  const cursor = cellStart.slice(0, NC);
  const byCell = new Uint32Array(TOTAL);
  for (let i = 0; i < TOTAL; i++) byCell[cursor[cellOf[i]]++] = packed[i];

  return {
    total: n, cellKeys, cellIdx, combos, byCell, cellStart,
    feat: {
      danglers: accDang, nut: accNut, dom: accDom, adj: accAdj,
      mono: accMono, tri: accTri, hi9: accHi9, quads: accQuads,
    },
    exByAdj,
  };
}

/**
 * Pick up to `want` example combos spanning a cell's adjRaw range: strongest, weakest, and an even
 * spread between. Cells with fewer distinct adjRaw values than `want` are topped up with siblings
 * at the same value, so a cell only ever returns fewer than `want` when it holds fewer combos.
 */
export function spanExamples(map, want = 6) {
  const keys = [...map.keys()].sort((a, b) => b - a);
  if (keys.length === 0) return [];
  const order = [];
  if (keys.length <= want) {
    order.push(...keys.map((_, i) => i));
  } else {
    const pick = new Set([0, keys.length - 1]);
    for (let i = 1; i < want - 1; i++) pick.add(Math.round((i * (keys.length - 1)) / (want - 1)));
    order.push(...[...pick].sort((a, b) => a - b));
  }
  const flat = (b) => {
    const t = b.tail.slice(b.n % 4).concat(b.tail.slice(0, b.n % 4)).filter((x) => x !== undefined);
    return b.head.concat(t.filter((x) => !b.head.includes(x)));
  };
  const out = [];
  for (const i of order) out.push(flat(map.get(keys[i]))[0]);
  for (let depth = 1; depth < 8 && out.length < want; depth++) {
    for (const i of order) {
      const b = flat(map.get(keys[i]));
      if (b.length > depth && out.length < want && !out.includes(b[depth])) out.push(b[depth]);
    }
  }
  return out;
}

export function unpackHand(pk) {
  return [pk & 63, (pk >>> 6) & 63, (pk >>> 12) & 63, (pk >>> 18) & 63];
}
