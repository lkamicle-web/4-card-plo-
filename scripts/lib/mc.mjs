// mc.mjs — seeded Monte Carlo runner. Doubles as the worker-thread entry point.
//
// Stages:
//   'cells' : hero drawn fresh from the cell every trial; one deal (board + 5 villains) yields
//             equity vs N = 1..5 by comparing against villain prefixes.
//   'sub'   : identical, on the sub-bucket hand lists.
//   'vs3bet': heads-up, villain rejection-sampled from one face-up component range.
//
// Common random numbers: every unit inside a stage restarts the same board/villain stream (seeded
// from the stage name alone), so cross-cell RANKING noise is far below absolute noise. Hero draws
// use a separate stream seeded per unit key, so a unit's hero sample is reproducible on its own.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { Rng, fnv1a, makeTriplePartials, fillTriplePartials, bestOmaha } from './eval5.mjs';
import { sampleFromRange } from './villains.mjs';

const SELF = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------------------
// trial kernels
// ---------------------------------------------------------------------------

/**
 * Multi-N kernel. Returns Float64Array(5) of equities (%) vs N = 1..5.
 * @param {Uint32Array} pool packed hands to draw the hero from
 * @param {number} lo start index in pool
 * @param {number} hi end index (exclusive)
 */
function runMulti(pool, lo, hi, trials, heroSeed, streamSeed) {
  const heroRng = new Rng(heroSeed);
  const rng = new Rng(streamSeed);
  const tp = makeTriplePartials();
  const acc = new Float64Array(5);
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  const vs = new Int32Array(5);
  const span = hi - lo;

  for (let t = 0; t < trials; t++) {
    const pk = pool[lo + ((heroRng.next() % span) >>> 0)];
    const h0 = pk & 63, h1 = (pk >>> 6) & 63, h2 = (pk >>> 12) & 63, h3 = (pk >>> 18) & 63;
    // build the 48-card stock
    let n = 0;
    for (let c = 0; c < 52; c++) if (c !== h0 && c !== h1 && c !== h2 && c !== h3) deck[n++] = c;
    // partial Fisher-Yates for 25 cards (5 board + 5 villains x 4)
    for (let i = 0; i < 25; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[i];
    fillTriplePartials(board, tp);
    const hero = bestOmaha(h0, h1, h2, h3, tp);
    for (let k = 0; k < 5; k++) {
      const b = 5 + k * 4;
      vs[k] = bestOmaha(deck[b], deck[b + 1], deck[b + 2], deck[b + 3], tp);
    }
    let vmax = -1, vties = 0;
    for (let k = 0; k < 5; k++) {
      const s = vs[k];
      if (s > vmax) { vmax = s; vties = 1; } else if (s === vmax) vties++;
      if (hero > vmax) acc[k] += 1;
      else if (hero === vmax) acc[k] += 1 / (vties + 1);
    }
  }
  for (let k = 0; k < 5; k++) acc[k] = (100 * acc[k]) / trials;
  return acc;
}

/** Heads-up kernel vs a hand drawn from a face-up component range. Returns equity (%). */
function runVs(pool, lo, hi, range, trials, heroSeed, streamSeed) {
  const heroRng = new Rng(heroSeed);
  const rng = new Rng(streamSeed);
  const tp = makeTriplePartials();
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  const span = hi - lo;
  let acc = 0, used = 0;

  for (let t = 0; t < trials; t++) {
    const pk = pool[lo + ((heroRng.next() % span) >>> 0)];
    const h = [pk & 63, (pk >>> 6) & 63, (pk >>> 12) & 63, (pk >>> 18) & 63];
    let lo32 = 0, hi32 = 0;
    for (const c of h) { if (c < 32) lo32 |= 1 << c; else hi32 |= 1 << (c - 32); }
    const vpk = sampleFromRange(range, rng, lo32, hi32);
    if (vpk < 0) continue;                       // range fully blocked (never seen in practice)
    const v = [vpk & 63, (vpk >>> 6) & 63, (vpk >>> 12) & 63, (vpk >>> 18) & 63];
    for (const c of v) { if (c < 32) lo32 |= 1 << c; else hi32 |= 1 << (c - 32); }
    let n = 0;
    for (let c = 0; c < 52; c++) {
      const bit = c < 32 ? (lo32 & (1 << c)) : (hi32 & (1 << (c - 32)));
      if (!bit) deck[n++] = c;
    }
    for (let i = 0; i < 5; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      board[i] = deck[i];
    }
    fillTriplePartials(board, tp);
    const hs = bestOmaha(h[0], h[1], h[2], h[3], tp);
    const vsc = bestOmaha(v[0], v[1], v[2], v[3], tp);
    if (hs > vsc) acc += 1; else if (hs === vsc) acc += 0.5;
    used++;
  }
  return used ? (100 * acc) / used : 0;
}

/** Equity of one FIXED hero hand vs N random opponents (benchmark path, single-threaded). */
export function equityFixed(hole, trials, seedStr, nOpp) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  const need = 5 + nOpp * 4;
  let acc = 0;
  let n = 0;
  const base = new Int32Array(52);
  for (let c = 0; c < 52; c++) if (!hole.includes(c)) base[n++] = c;
  for (let t = 0; t < trials; t++) {
    deck.set(base);
    for (let i = 0; i < need; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[i];
    fillTriplePartials(board, tp);
    const hero = bestOmaha(hole[0], hole[1], hole[2], hole[3], tp);
    let vmax = -1, ties = 0;
    for (let k = 0; k < nOpp; k++) {
      const b = 5 + k * 4;
      const s = bestOmaha(deck[b], deck[b + 1], deck[b + 2], deck[b + 3], tp);
      if (s > vmax) { vmax = s; ties = 1; } else if (s === vmax) ties++;
    }
    if (hero > vmax) acc += 1; else if (hero === vmax) acc += 1 / (ties + 1);
  }
  return (100 * acc) / trials;
}

/** Equity of one FIXED hero hand vs one FIXED villain hand (benchmark path). */
export function equityVsFixed(hole, villain, trials, seedStr) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  let n = 0;
  const dead = new Set([...hole, ...villain]);
  const base = new Int32Array(52);
  for (let c = 0; c < 52; c++) if (!dead.has(c)) base[n++] = c;
  let acc = 0;
  for (let t = 0; t < trials; t++) {
    deck.set(base);
    for (let i = 0; i < 5; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      board[i] = deck[i];
    }
    fillTriplePartials(board, tp);
    const a = bestOmaha(hole[0], hole[1], hole[2], hole[3], tp);
    const b = bestOmaha(villain[0], villain[1], villain[2], villain[3], tp);
    if (a > b) acc += 1; else if (a === b) acc += 0.5;
  }
  return (100 * acc) / trials;
}

/**
 * Conservation estimator: hero drawn uniformly from all 270,725 hands EVERY trial, so the mean is
 * an unbiased estimate of 100/(N+1) with an SE of about 0.1 pt at 200k trials. (Averaging a handful
 * of fixed random heroes instead has an SE near 0.9 pt — the spread of hand strengths dominates —
 * which is far too noisy for a +/-0.5 pt gate.)
 * @returns {number[]} mean equity (%) vs N = 1..5
 */
export function uniformMeanEquity(trials, seedStr) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const acc = new Float64Array(5);
  const deck = new Int32Array(52);
  const board = new Int32Array(5);
  const vs = new Int32Array(5);
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < 52; i++) deck[i] = i;
    for (let i = 0; i < 29; i++) {
      const j = i + ((rng.next() % (52 - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[4 + i];
    fillTriplePartials(board, tp);
    const hero = bestOmaha(deck[0], deck[1], deck[2], deck[3], tp);
    for (let k = 0; k < 5; k++) {
      const b = 9 + k * 4;
      vs[k] = bestOmaha(deck[b], deck[b + 1], deck[b + 2], deck[b + 3], tp);
    }
    let vmax = -1, vties = 0;
    for (let k = 0; k < 5; k++) {
      const s = vs[k];
      if (s > vmax) { vmax = s; vties = 1; } else if (s === vmax) vties++;
      if (hero > vmax) acc[k] += 1; else if (hero === vmax) acc[k] += 1 / (vties + 1);
    }
  }
  return Array.from(acc, (x) => (100 * x) / trials);
}

/**
 * Paired comparison: two hero hands measured over the SAME boards and villains, so the DIFFERENCE
 * between them carries almost no Monte Carlo noise. Both hands' cards are dead in every deal, which
 * biases both equities identically and leaves the comparison valid.
 * @returns {[number, number]}
 */
export function equityPaired(holeA, holeB, trials, seedStr, nOpp) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const dead = new Set([...holeA, ...holeB]);
  const base = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) base.push(c);
  const deck = Int32Array.from(base);
  const n = deck.length;
  const need = 5 + nOpp * 4;
  const board = new Int32Array(5);
  let accA = 0, accB = 0;
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < need; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[i];
    fillTriplePartials(board, tp);
    const a = bestOmaha(holeA[0], holeA[1], holeA[2], holeA[3], tp);
    const b = bestOmaha(holeB[0], holeB[1], holeB[2], holeB[3], tp);
    let vmax = -1, ties = 0;
    for (let k = 0; k < nOpp; k++) {
      const p = 5 + k * 4;
      const s = bestOmaha(deck[p], deck[p + 1], deck[p + 2], deck[p + 3], tp);
      if (s > vmax) { vmax = s; ties = 1; } else if (s === vmax) ties++;
    }
    if (a > vmax) accA += 1; else if (a === vmax) accA += 1 / (ties + 1);
    if (b > vmax) accB += 1; else if (b === vmax) accB += 1 / (ties + 1);
  }
  return [(100 * accA) / trials, (100 * accB) / trials];
}

/** Equities of a fixed set of hands in one pot over shared deals. They sum to exactly 100. */
export function sharedDealEquities(holes, trials, seedStr) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const dead = new Set(holes.flat());
  const base = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) base.push(c);
  const deck = Int32Array.from(base);
  const n = deck.length;
  const board = new Int32Array(5);
  const acc = new Float64Array(holes.length);
  const sc = new Int32Array(holes.length);
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < 5; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      board[i] = deck[i];
    }
    fillTriplePartials(board, tp);
    let mx = -1, ties = 0;
    for (let k = 0; k < holes.length; k++) {
      const h = holes[k];
      const v = bestOmaha(h[0], h[1], h[2], h[3], tp);
      sc[k] = v;
      if (v > mx) { mx = v; ties = 1; } else if (v === mx) ties++;
    }
    for (let k = 0; k < holes.length; k++) if (sc[k] === mx) acc[k] += 1 / ties;
  }
  return Array.from(acc, (x) => (100 * x) / trials);
}

/**
 * Run the production evaluator and the independent reference evaluator over the SAME deals.
 * @param {(hole:number[], board:number[])=>number} refBest the reference Omaha search
 * @returns {{a:number, b:number, disagree:number}} equity under each engine, and the number of
 *          trials where the two engines ranked the showdown differently (must be 0)
 */
export function crossEngineEquity(hole, refBest, trials, seedStr, nOpp) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const base = [];
  for (let c = 0; c < 52; c++) if (!hole.includes(c)) base.push(c);
  const deck = Int32Array.from(base);
  const n = deck.length;
  const need = 5 + nOpp * 4;
  const board = new Array(5);
  let accA = 0, accB = 0, disagree = 0;
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < need; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    for (let i = 0; i < 5; i++) board[i] = deck[i];
    fillTriplePartials(board, tp);
    const ha = bestOmaha(hole[0], hole[1], hole[2], hole[3], tp);
    const hb = refBest(hole, board);
    let amax = -1, aties = 0, bmax = -1, bties = 0;
    for (let k = 0; k < nOpp; k++) {
      const p = 5 + k * 4;
      const v = [deck[p], deck[p + 1], deck[p + 2], deck[p + 3]];
      const sa = bestOmaha(v[0], v[1], v[2], v[3], tp);
      const sb = refBest(v, board);
      if (sa > amax) { amax = sa; aties = 1; } else if (sa === amax) aties++;
      if (sb > bmax) { bmax = sb; bties = 1; } else if (sb === bmax) bties++;
    }
    const ea = ha > amax ? 1 : ha === amax ? 1 / (aties + 1) : 0;
    const eb = hb > bmax ? 1 : hb === bmax ? 1 / (bties + 1) : 0;
    if (ea !== eb) disagree++;
    accA += ea; accB += eb;
  }
  return { a: (100 * accA) / trials, b: (100 * accB) / trials, disagree };
}

/** Shared-deal cross-engine check for a heads-up match against a FIXED villain hand. */
export function crossEngineEquityVs(hole, villain, refBest, trials, seedStr) {
  const rng = new Rng(fnv1a(seedStr));
  const tp = makeTriplePartials();
  const dead = new Set([...hole, ...villain]);
  const base = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) base.push(c);
  const deck = Int32Array.from(base);
  const n = deck.length;
  const board = new Array(5);
  let accA = 0, accB = 0, disagree = 0;
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < 5; i++) {
      const j = i + ((rng.next() % (n - i)) >>> 0);
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      board[i] = deck[i];
    }
    fillTriplePartials(board, tp);
    const a1 = bestOmaha(hole[0], hole[1], hole[2], hole[3], tp);
    const b1 = bestOmaha(villain[0], villain[1], villain[2], villain[3], tp);
    const a2 = refBest(hole, board);
    const b2 = refBest(villain, board);
    const e1 = a1 > b1 ? 1 : a1 === b1 ? 0.5 : 0;
    const e2 = a2 > b2 ? 1 : a2 === b2 ? 0.5 : 0;
    if (e1 !== e2) disagree++;
    accA += e1; accB += e2;
  }
  return { a: (100 * accA) / trials, b: (100 * accB) / trials, disagree };
}

// ---------------------------------------------------------------------------
// worker body
// ---------------------------------------------------------------------------
if (!isMainThread && workerData && workerData.__mcWorker) {
  const { pools, starts, ranges } = workerData;
  parentPort.on('message', (msg) => {
    const out = [];
    for (const job of msg.jobs) {
      const pool = pools[job.pool];
      const st = starts[job.pool];
      const lo = st[job.unit], hi = st[job.unit + 1];
      if (job.kind === 'vs3bet') {
        out.push({
          id: job.id,
          eq: runVs(pool, lo, hi, ranges[job.comp], job.trials,
            fnv1a(`hero|${job.stage}|${job.key}|${job.comp}`), fnv1a(`stream|${job.stage}|${job.comp}`)),
        });
      } else {
        out.push({
          id: job.id,
          eq: Array.from(runMulti(pool, lo, hi, job.trials,
            fnv1a(`hero|${job.stage}|${job.key}`), fnv1a(`stream|${job.stage}`))),
        });
      }
    }
    parentPort.postMessage({ results: out });
  });
  parentPort.postMessage({ ready: true });
}

// ---------------------------------------------------------------------------
// pool driver (main thread)
// ---------------------------------------------------------------------------
/** Boot a worker pool once; reuse across every stage. */
export async function startPool(cfg) {
  const workers = [];
  const boot = [];
  for (let w = 0; w < cfg.workers; w++) {
    const wk = new Worker(SELF, {
      workerData: { __mcWorker: true, pools: cfg.pools, starts: cfg.starts, ranges: cfg.ranges },
    });
    workers.push(wk);
    boot.push(new Promise((res, rej) => { wk.once('message', res); wk.once('error', rej); }));
  }
  await Promise.all(boot);
  return workers;
}

export async function stopPool(workers) {
  for (const wk of workers) await wk.terminate();
}

/**
 * Run a job list across the pool. Jobs are handed out one chunk at a time so slow units cannot
 * starve a worker (dynamic load balancing beats static striping when unit cost varies).
 * @param {object[]} jobs each { id, pool, unit, kind, stage, key, trials, comp? }
 */
export function runJobs(workers, jobs, onProgress, chunkSize = 4) {
  const results = new Array(jobs.length);
  const chunks = [];
  for (let i = 0; i < jobs.length; i += chunkSize) chunks.push(jobs.slice(i, i + chunkSize));
  let next = 0, done = 0;

  return new Promise((resolve, reject) => {
    if (!chunks.length) return resolve(results);
    let live = 0;
    const handlers = [];
    const feed = (wk) => {
      if (next >= chunks.length) return false;
      wk.postMessage({ jobs: chunks[next++] });
      live++;
      return true;
    };
    workers.forEach((wk) => {
      const h = (m) => {
        if (!m || !m.results) return;
        for (const r of m.results) { results[r.id] = r.eq; done++; }
        live--;
        if (onProgress) onProgress(done, jobs.length);
        if (!feed(wk) && live === 0) {
          handlers.forEach(([w, fn]) => w.off('message', fn));
          resolve(results);
        }
      };
      handlers.push([wk, h]);
      wk.on('message', h);
      wk.on('error', reject);
    });
    workers.forEach((wk) => feed(wk));
    workers.forEach((wk) => feed(wk));   // two chunks in flight per worker hides IPC latency
  });
}
