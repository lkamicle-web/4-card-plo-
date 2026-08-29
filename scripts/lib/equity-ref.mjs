// equity-ref.mjs — the INDEPENDENT cross-check oracle.
//
// This is the original validated Monte Carlo engine, ported to ESM with its logic unchanged:
// its own 5-card evaluator (array/sort based, no bitmasks), its own naive best-of-60 Omaha search,
// its own xorshift128+ RNG, its own dealing loop. Nothing here is shared with scripts/lib/eval5.mjs.
// verify.mjs runs both engines on the benchmark hands and asserts they agree within +/-0.6 pt
// (invariant I20). Two independent implementations agreeing is stronger evidence than either alone.
//
// Slow by design. Never used by the generator's hot path.

const RS = '23456789TJQKA';
const SS = 'shdc';

export function parseCard(str) { return RS.indexOf(str[0]) * 4 + SS.indexOf(str[1]); }
export function parseHand(s) {
  const out = [];
  for (let i = 0; i < s.length; i += 2) out.push(parseCard(s.slice(i, i + 2)));
  return out;
}
const rk = (c) => c >> 2;
const st = (c) => c & 3;

// ---- 5-card evaluator -> integer score (higher better) ----
export function eval5(a, b, c, d, e) {
  const cs = [a, b, c, d, e];
  const rc = new Int8Array(13); const sc = new Int8Array(4);
  for (const x of cs) { rc[rk(x)]++; sc[st(x)]++; }
  let flush = false; for (let i = 0; i < 4; i++) if (sc[i] === 5) flush = true;
  const dis = []; for (let r = 12; r >= 0; r--) if (rc[r]) dis.push(r);
  let straight = -1;
  if (dis.length === 5) {
    if (dis[0] - dis[4] === 4) straight = dis[0];
    else if (dis[0] === 12 && dis[1] === 3 && dis[4] === 0) straight = 3; // wheel A5432, high = 5
  }
  const groups = dis.slice().sort((x, y) => (rc[y] - rc[x]) || (y - x));
  const kick = () => groups.reduce((acc, r) => acc * 13 + r, 0);
  let cat;
  if (straight >= 0 && flush) return 8 * 371293 * 13 + straight;
  const counts = dis.map((r) => rc[r]).sort((x, y) => y - x);
  if (counts[0] === 4) cat = 7;
  else if (counts[0] === 3 && counts[1] === 2) cat = 6;
  else if (flush) cat = 5;
  else if (straight >= 0) return 4 * 371293 * 13 + straight;
  else if (counts[0] === 3) cat = 3;
  else if (counts[0] === 2 && counts[1] === 2) cat = 2;
  else if (counts[0] === 2) cat = 1;
  else cat = 0;
  return cat * 371293 * 13 + kick();
}

// ---- best Omaha hand: exactly 2 of 4 hole + 3 of 5 board ----
const H2 = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const B3 = [[0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4], [0, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]];
export function omahaBest(hole, board) {
  let best = -1;
  for (let i = 0; i < 6; i++) {
    const h0 = hole[H2[i][0]], h1 = hole[H2[i][1]];
    for (let j = 0; j < 10; j++) {
      const b = B3[j];
      const v = eval5(h0, h1, board[b[0]], board[b[1]], board[b[2]]);
      if (v > best) best = v;
    }
  }
  return best;
}

// ---- RNG (xorshift128+, deterministic) ----
let s0 = 0x9E3779B9 | 0, s1 = 0x85EBCA6B | 0;
function seed(n) { s0 = (n * 2654435761) | 0 || 1; s1 = (n * 40503 + 12345) | 0 || 2; for (let i = 0; i < 20; i++) rnd(); }
function rnd() {
  let x = s0; const y = s1;
  s0 = y; x ^= x << 23; x ^= x >>> 17; x ^= y ^ (y >>> 26); s1 = x;
  return ((s0 + s1) >>> 0) / 4294967296;
}

/** hero equity (%) vs `nRandom` random opponents and/or explicit villain hands */
export function equity(heroStr, opts = {}) {
  const { villains = [], nRandom = 1, trials = 100000, seedN = 42 } = opts;
  seed(seedN);
  const hero = parseHand(heroStr);
  const vil = villains.map(parseHand);
  const dead = new Set([...hero, ...vil.flat()]);
  const stock = []; for (let c = 0; c < 52; c++) if (!dead.has(c)) stock.push(c);
  const need = nRandom * 4 + 5;
  let eq = 0;
  const arr = stock.slice();
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rnd() * (arr.length - i));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    const board = arr.slice(0, 5);
    const hands = [hero, ...vil];
    for (let k = 0; k < nRandom; k++) hands.push(arr.slice(5 + k * 4, 9 + k * 4));
    const scores = hands.map((h) => omahaBest(h, board));
    const mx = Math.max(...scores);
    const ties = scores.filter((v) => v === mx).length;
    if (scores[0] === mx) eq += 1 / ties;
  }
  return 100 * eq / trials;
}
