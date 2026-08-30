// sim-engine.test.mjs — the page-side Simulate engine, tested as the SHIPPED code.
//
// The engine lives in an inline <script> in src/shell.html, which is where it has to live: it is
// browser code and the page is one file. That is not a reason to leave it untested. This file
// slices the block out between its `@sim-engine` markers and runs it against a fake `window`, so
// the settings-hash contract, the cache's three degradation paths and the trial-count arithmetic
// are exercised as the exact text that ships — not as a copy that can drift from it.
//
// Every browser global the block touches is reached through `window.`, so `new Function('window',
// block)` is enough; running it in this realm rather than a vm context keeps built-in identity
// intact, which matters for the typed arrays that cross the boundary.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSimBundle } from '../scripts/lib/sim-bundle.mjs';
import { minify } from '../scripts/lib/jsmin.mjs';
import * as TAX from '../scripts/lib/taxonomy.mjs';
import { enumerateAll } from '../scripts/lib/taxonomy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));
const SHELL = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
const KERNEL = buildSimBundle(minify).kernel;
const NS = 'plo4:' + MODEL.meta.hash.slice(0, 12) + ':';

const BLOCK = (() => {
  const a = SHELL.indexOf('/* @sim-engine');
  const b = SHELL.indexOf('/* @end:sim-engine */');
  assert.ok(a > 0 && b > a, 'src/shell.html must carry the @sim-engine markers');
  return SHELL.slice(a, b);
})();

/** a localStorage that is a plain Map, optionally with a byte cap or a poisoned setItem */
function fakeStorage({ cap = Infinity, throwOn = null } = {}) {
  const m = new Map();
  const bytes = () => { let n = 0; for (const [k, v] of m) n += k.length + v.length; return n; };
  return {
    _map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (throwOn && throwOn(k, v, m)) {
        const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
      }
      m.set(k, String(v));
      if (bytes() > cap) { m.delete(k); const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    },
    removeItem: (k) => { m.delete(k); },
  };
}

function makeWindow(opts = {}) {
  const win = {
    MODEL,
    TAXONOMY: { rowOf: TAX.rowOf, colOf: TAX.colOf, subKeyOf: TAX.subKeyOf },
    SIM_KERNEL_SRC: KERNEL,
    SIM_ENTRY_SRC: '',
    location: { search: opts.search || '', hash: opts.hash || '' },
    navigator: { hardwareConcurrency: 4 },
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    localStorage: opts.localStorage === null ? undefined : (opts.localStorage || fakeStorage()),
    document: {
      hidden: false,
      addEventListener() { }, removeEventListener() { },
    },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (t) => clearTimeout(t),
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    /* no Worker and no Blob: the engine must degrade to the main-thread path and say so */
    URL: opts.URL, Blob: opts.Blob, Worker: opts.Worker,
  };
  if (opts.localStorage === null) {
    Object.defineProperty(win, 'localStorage', {
      get() { const e = new Error('The operation is insecure.'); e.name = 'SecurityError'; throw e; },
    });
  }
  Object.assign(win, opts.extra || {});
  // eslint-disable-next-line no-new-func
  new Function('window', BLOCK)(win);
  return win;
}

// ---------------------------------------------------------------------------
test('the engine reports itself available on a v2 dataset', () => {
  const w = makeWindow();
  assert.equal(w.SIM.available, true, w.SIM.unavailableReason);
  assert.equal(w.SIM.nMax, MODEL.meta.nMax);
  assert.equal(w.SIM.defaultTrials, 25000);
});

test('a dataset with no shipped order turns the engine off, and says why', () => {
  const noOrder = { ...MODEL, order: undefined };
  const w = makeWindow({ extra: { MODEL: noOrder } });
  // MODEL is captured at construction, so rebuild with the stripped model in place
  const w2 = (() => {
    const win = makeWindow();
    return win;
  })();
  assert.ok(w2.SIM.available);
  // build a fresh window whose MODEL genuinely lacks the order
  const win = {
    MODEL: noOrder, TAXONOMY: w.TAXONOMY, SIM_KERNEL_SRC: KERNEL,
    location: { search: '', hash: '' }, navigator: {}, performance: { now: () => 0 },
    localStorage: fakeStorage(), document: { hidden: false }, setTimeout, clearTimeout,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
  };
  // eslint-disable-next-line no-new-func
  new Function('window', BLOCK)(win);
  assert.equal(win.SIM.available, false);
  assert.match(win.SIM.unavailableReason, /ships no villain ordering/);
});

// ------------------------------------------------------- the settings-hash contract
test('the settings hash moves with v, q, trials — and only those', () => {
  const w = makeWindow();
  const base = { v: 55, q: 0.85, trials: 25000 };
  const h = (o) => w.SIM.settingsHash({ ...base, ...o });
  const H = h({});
  assert.match(H, /^[0-9a-f]{8}$/);
  assert.notEqual(H, h({ v: 56 }), 'villain VPIP is in');
  assert.notEqual(H, h({ q: 0.7 }), 'villain discipline is in');
  assert.notEqual(H, h({ trials: 100000 }), 'trial count is in');
});

test('the settings hash EXCLUDES depth, rake, straddle, mix, seat and node — by design', () => {
  /* V2-PLAN §1: those are scoring-layer dials over measurements that already exist. If any of them
     reached this hash, dragging the depth slider would evict the cache and offer to re-measure
     something no re-measurement could change. */
  const w = makeWindow();
  const base = { v: 55, q: 0.85, trials: 25000 };
  const H = w.SIM.settingsHash(base);
  for (const extra of [
    { d: 40 }, { d: 250 }, { rakePct: 5 }, { rakeCapBB: 0 }, { straddle: true },
    { mix: [50, 30, 15, 5] }, { pos: 'BTN' }, { node: '3bet' }, { limpers: 5 },
    { raiserPos: 'UTG' }, { colorBy: 'nut' },
  ]) {
    assert.equal(w.SIM.settingsHash({ ...base, ...extra }), H,
      `${Object.keys(extra)[0]} must not move the settings hash`);
  }
});

test('the hash is stable across equivalent spellings of the same number', () => {
  const w = makeWindow();
  const H = w.SIM.settingsHash({ v: 55, q: 0.85, trials: 25000 });
  assert.equal(w.SIM.settingsHash({ v: 55.0, q: 0.85, trials: 25000 }), H);
  assert.equal(w.SIM.settingsHash({ v: 55.0000000001, q: 0.85, trials: 25000 }), H);
  assert.notEqual(w.SIM.settingsHash({ v: 55.1, q: 0.85, trials: 25000 }), H);
});

// ------------------------------------------------------------- trial-count arithmetic
test('the +/- is derived from trials, on the same basis as the shipped +/-0.16', () => {
  const w = makeWindow();
  assert.equal(w.SIM.se(100000).toFixed(2), MODEL.meta.se.cell.toFixed(2),
    'at the generator\'s own 100k the engine reproduces meta.se.cell');
  assert.equal(+w.SIM.se(25000).toFixed(3), 0.316);
  assert.equal(+w.SIM.se(500).toFixed(3), 2.236);
  assert.equal(+w.SIM.se(100000).toFixed(3), 0.158);
  /* 4x trials halves it, which is the whole promise of the "re-run at 4x" link */
  assert.ok(Math.abs(w.SIM.se(100000) * 2 - w.SIM.se(25000)) < 1e-12);
});

test('normalize clamps to the shipped domain and honours the trials hook', () => {
  const w = makeWindow();
  assert.equal(w.SIM.normalize({ v: 5 }).v, MODEL.meta.vpip.min);
  assert.equal(w.SIM.normalize({ v: 500 }).v, MODEL.meta.vpip.max);
  assert.equal(w.SIM.normalize({}).v, MODEL.meta.vpip.default);
  assert.equal(w.SIM.normalize({}).q, MODEL.constants.villainLattice.discipline);
  assert.equal(w.SIM.normalize({ q: 9 }).q, 1);
  assert.equal(w.SIM.normalize({ q: -1 }).q, 0);
  assert.equal(w.SIM.normalize({}).trials, 25000);

  /* the harness hook, both spellings — and an explicit argument still wins, so a caller that means
     25,000 cannot be silently downgraded by a stale hook */
  w.__SIM_TRIALS = 500;
  assert.equal(w.SIM.normalize({}).trials, 500);
  assert.equal(w.SIM.normalize({ trials: 25000 }).trials, 25000);
  delete w.__SIM_TRIALS;

  const u = makeWindow({ search: '?simtrials=750&simnocache=1' });
  assert.equal(u.SIM.normalize({}).trials, 750);
  assert.equal(u.SIM.normalize({}).noCache, true);
});

// ------------------------------------------------------------------------- the cache
function payload(hash, extra) {
  return {
    tag: 'plo4-sim@1', hash, model: MODEL.meta.hash, orderHash: MODEL.meta.orderHash,
    nMax: MODEL.meta.nMax, v: 55, q: 0.85, trials: 500, trialsTotal: 61500,
    cells: { 'AA_BIGPAIR|DS': [70, 55, 45, 39, 35, 32, 29] }, subs: null, subsOf: null,
    fallbacks: 0, path: 'worker', at: Date.now(), ...extra,
  };
}

test('the cache probes by writing, and round-trips a result', () => {
  const ls = fakeStorage();
  const w = makeWindow({ localStorage: ls });
  const st = w.SIM.cache.status();
  assert.equal(st.backend, 'localStorage');
  assert.equal(st.probed, true);
  assert.equal(st.namespace, NS);
  assert.equal(ls._map.size, 0, 'the probe key is cleaned up');
});

test('a localStorage that throws on access degrades to memory, silently', () => {
  /* The documented WebKit behaviour on file://: SecurityError on the very first access. A `typeof`
     sniff would sail straight past it. */
  const w = makeWindow({ localStorage: null });
  const st = w.SIM.cache.status();
  assert.equal(st.backend, 'memory');
  assert.equal(st.probed, false);
  assert.match(st.lastError, /SecurityError/);
});

test('the store is treated as shared and hostile: bad shapes are discarded', () => {
  const ls = fakeStorage();
  const w = makeWindow({ localStorage: ls });
  const h = w.SIM.settingsHash({ v: 55, q: 0.85, trials: 500 });

  const cases = {
    'another page\'s value': '{"hello":"world"}',
    'no tag': JSON.stringify({ ...payload(h), tag: undefined }),
    'a different model': JSON.stringify(payload(h, { model: 'deadbeef' })),
    'a different field size': JSON.stringify(payload(h, { nMax: 5 })),
    'an eq array of the wrong length': JSON.stringify(payload(h, { cells: { x: [1, 2, 3] } })),
    'a non-numeric equity': JSON.stringify(payload(h, { cells: { x: [1, 2, 3, 4, 5, 6, 'seven'] } })),
    'no cells at all': JSON.stringify(payload(h, { cells: {} })),
    'not even JSON': '{{{',
  };
  for (const [why, raw] of Object.entries(cases)) {
    ls._map.set(NS + h, raw);
    assert.equal(w.SIM.cache.peek({ v: 55, q: 0.85, trials: 500 }), null, why);
    assert.ok(!ls._map.has(NS + h), `${why} is removed, not left to be read again`);
  }
});

test('the cache evicts least-recently-used entries to stay inside its cap', async () => {
  const ls = fakeStorage();
  const w = makeWindow({ localStorage: ls });
  /* Pre-seed the index with two entries that between them fill the 1.5 MB cap, the older one
     first. Writing a third must drop the oldest. */
  ls._map.set(NS + 'old', 'x');
  ls._map.set(NS + 'new', 'x');
  ls._map.set(NS + 'idx', JSON.stringify([
    ['old', 800 * 1024, 1000],
    ['new', 800 * 1024, 2000],
  ]));
  const h = w.SIM.settingsHash({ v: 41, q: 0.85, trials: 1 });
  const r = await w.SIM.run({ v: 41, q: 0.85, trials: 1 }).promise;
  assert.equal(r.cache, 'localStorage');
  assert.ok(!ls._map.has(NS + 'old'), 'the least recently used entry was evicted');
  assert.ok(ls._map.has(NS + h), 'the new entry landed');
  const idx = JSON.parse(ls._map.get(NS + 'idx')).map((e) => e[0]);
  assert.ok(!idx.includes('old'));
  assert.ok(idx.includes(h));
});

test('QuotaExceededError is caught, answered by eviction, and retried exactly once', async () => {
  /* the boot-time write probe must still succeed, so only entry writes are poisoned */
  const isEntry = (k) => k.startsWith(NS) && !k.endsWith('idx') && !k.endsWith('probe');
  let throws = 1;
  const ls = fakeStorage({ throwOn: (k) => isEntry(k) && throws-- > 0 });
  const w = makeWindow({ localStorage: ls });
  const r = await w.SIM.run({ v: 42, q: 0.85, trials: 1 }).promise;
  assert.equal(r.cache, 'localStorage', 'the retry after eviction succeeded');
  assert.equal(w.SIM.cache.status().backend, 'localStorage');

  /* and when the store refuses even after eviction, the run still completes — in memory */
  const ls2 = fakeStorage({ throwOn: isEntry });
  const w2 = makeWindow({ localStorage: ls2 });
  const r2 = await w2.SIM.run({ v: 43, q: 0.85, trials: 1 }).promise;
  assert.equal(r2.cache, 'memory');
  assert.equal(w2.SIM.cache.status().backend, 'memory');
  assert.match(w2.SIM.cache.status().lastError, /QuotaExceededError/);
  /* the session still gets its hit */
  const again = await w2.SIM.run({ v: 43, q: 0.85, trials: 1 }).promise;
  assert.equal(again.source, 'cache');
});

// ------------------------------------------------------------- a real degraded run
test('with no Worker the engine degrades, runs, and reports the degradation', async () => {
  const w = makeWindow();
  const seen = [];
  const h = w.SIM.run({
    v: 47, q: 0.85, trials: 120, noCache: true,
    onProgress: (p) => seen.push(p),
  });
  const r = await h.promise;

  assert.equal(w.SIM.status().engine, 'fallback');
  assert.equal(w.SIM.status().degraded, true);
  assert.match(w.SIM.status().degradedWhy, /no Worker/);
  assert.equal(r.degraded, true);
  assert.equal(r.path, 'fallback');

  assert.equal(Object.keys(r.cells).length, 123, 'every non-empty cell measured');
  assert.equal(r.trialsPerCell, 120);
  assert.equal(r.trialsTotal, 123 * 120, 'the reported total is the total that ran');
  assert.equal(+r.se.toFixed(4), +(50 / Math.sqrt(120)).toFixed(4));
  for (const k of Object.keys(r.cells)) {
    assert.equal(r.cells[k].length, MODEL.meta.nMax, k);
    assert.ok(r.cells[k][0] > 0 && r.cells[k][0] < 100, k);
    assert.ok(MODEL.cells[k] && MODEL.cells[k].combos > 0, `${k} is a real non-empty cell`);
  }

  /* the progress payload carries what the bar needs */
  const last = seen[seen.length - 1];
  assert.ok(seen.some((p) => p.phase === 'prepare'));
  assert.ok(seen.some((p) => p.stage === 1 && p.units === 123));
  assert.equal(last.stages, 1);
  assert.ok(last.trialsDone === last.trialsTotal);
  assert.ok(last.rate > 0 && isFinite(last.rate));
  assert.equal(+last.se.toFixed(4), +(50 / Math.sqrt(120)).toFixed(4));
  assert.equal(last.degraded, true);
});

test('a re-run at the same settings is bit-identical, and the second is a cache hit', async () => {
  const w = makeWindow();
  const a = await w.SIM.run({ v: 48, q: 0.85, trials: 60, noCache: true }).promise;
  const b = await w.SIM.run({ v: 48, q: 0.85, trials: 60, noCache: true }).promise;
  assert.equal(a.settingsHash, b.settingsHash);
  for (const k of Object.keys(a.cells)) assert.deepEqual(b.cells[k], a.cells[k], k);

  const c = await w.SIM.run({ v: 48, q: 0.85, trials: 60 }).promise;
  assert.equal(c.source, 'measured');
  const d = await w.SIM.run({ v: 48, q: 0.85, trials: 60 }).promise;
  assert.equal(d.source, 'cache');
  for (const k of Object.keys(a.cells)) assert.deepEqual(d.cells[k], a.cells[k], k);
});

test('stage 2 measures the sub-buckets of one named cell, and only that cell', async () => {
  const w = makeWindow();
  const KEY = 'SMPAIR_CONN|DS';
  const stages = [];
  const r = await w.SIM.run({
    v: 61, q: 0.9, trials: 40, subsOf: KEY, noCache: true,
    onProgress: (p) => { if (p.stage) stages.push(p.stage); },
  }).promise;
  assert.deepEqual([...new Set(stages)], [1, 2]);
  assert.ok(r.subs && r.subs[KEY]);
  assert.equal(Object.keys(r.subs).length, 1, 'only the named cell is expanded');
  const measured = Object.keys(r.subs[KEY]).sort();
  const shipped = MODEL.sub[KEY].map((s) => s.key).sort();
  assert.deepEqual(measured, shipped, 'the sub-bucket keys are the shipped ones');
  assert.equal(r.trialsTotal, (123 + shipped.length) * 40);
});

test('a run can be cancelled, and says so', async () => {
  const w = makeWindow();
  const h = w.SIM.run({ v: 49, q: 0.85, trials: 200, noCache: true });
  h.cancel();
  await assert.rejects(h.promise, (e) => e.cancelled === true);
});

test('an off-lattice q is measurable, and lands away from the q=0.85 number', async () => {
  /* The reason the button exists at all: there is no shipped answer at q != 0.85, and this is the
     only thing that can produce one. If a change ever made q inert, this test fails. */
  const w = makeWindow();
  const a = await w.SIM.run({ v: 55, q: 0.85, trials: 800, noCache: true }).promise;
  const b = await w.SIM.run({ v: 55, q: 0.2, trials: 800, noCache: true }).promise;
  assert.notEqual(a.settingsHash, b.settingsHash);
  /* BROADWAY_RUN|RB is the cell V2-PLAN §2.3 found loses most to a tight pool (-20.6 pt of eq at
     v=55); slackening the discipline to 0.2 hands most of that back. Way outside the 1.8 pt of
     standard error 800 trials buys. */
  const key = 'BROADWAY_RUN|RB';
  assert.ok(Math.abs(a.cells[key][0] - b.cells[key][0]) > 5,
    `q moves ${key}: ${a.cells[key][0]} at q=0.85 vs ${b.cells[key][0]} at q=0.2`);
});

// ------------------------------------------------------- the hard trials ceiling
test('the engine clamps every trial request to its ceiling, whoever asks', () => {
  /* A ceiling only the button honours is not a ceiling: `SIM.run({trials: 4e9})` from a console, a
     stale `?simtrials=`, or a second UI that forgot the rule would all sail past it. So the clamp
     lives in normalize, and this checks every door into it. */
  const w = makeWindow();
  assert.equal(w.SIM.maxTrials, 100000);
  assert.equal(w.SIM.maxTrials, 4 * w.SIM.defaultTrials, 'the ceiling IS 4x the default — one step');

  for (const asked of [100001, 400000, 1e6, 4e9, Number.MAX_SAFE_INTEGER]) {
    assert.equal(w.SIM.normalize({ trials: asked }).trials, 100000, `asked for ${asked}`);
  }
  assert.equal(w.SIM.normalize({ trials: 100000 }).trials, 100000, 'the ceiling itself is honoured');
  assert.equal(w.SIM.normalize({ trials: 99999 }).trials, 99999, 'below it, nothing is touched');
  assert.equal(w.SIM.normalize({ trials: 0 }).trials, 1, 'and the floor still holds');
  assert.equal(w.SIM.normalize({ trials: -5 }).trials, 1);

  /* the URL hook and the window hook go through the same clamp */
  const u = makeWindow({ search: '?simtrials=999999' });
  assert.equal(u.SIM.normalize({}).trials, 100000);
  const x = makeWindow();
  x.__SIM_TRIALS = 12345678;
  assert.equal(x.SIM.normalize({}).trials, 100000);
});

test('a clamped request lands on the same cache entry an honest one would', () => {
  /* This is why the clamp is above the settings hash and not below it. If every rejected excess
     minted its own key, an unbounded caller would still be an unbounded grower of cache entries —
     which is the exact failure the ceiling exists to prevent, moved one layer down. */
  const w = makeWindow();
  const at = (t) => w.SIM.settingsHash({ v: 55, q: 0.85, trials: t });
  assert.equal(at(400000), at(100000));
  assert.equal(at(4e9), at(100000));
  assert.notEqual(at(25000), at(100000));
});

test('a run asked for more than the ceiling MEASURES the ceiling and SAYS the ceiling', () => {
  /* The honesty half. A clamped run must not report the number it was asked for — the badge, the
     +/- and the cached payload all derive from `trialsPerCell`, so a lie here is a lie everywhere. */
  const w = makeWindow();
  const cap = w.SIM.maxTrials;
  const asked = 400000;
  const norm = w.SIM.normalize({ trials: asked });
  assert.equal(norm.trials, cap);
  assert.equal(+w.SIM.se(norm.trials).toFixed(3), +(50 / Math.sqrt(cap)).toFixed(3));
  assert.notEqual(+w.SIM.se(norm.trials).toFixed(3), +(50 / Math.sqrt(asked)).toFixed(3));
});

test('the ceiling is where a simulated number is as precise as the shipped one', () => {
  /* The claim the tooltip makes, checked against the data rather than asserted in prose. */
  const w = makeWindow();
  assert.equal(+w.SIM.se(w.SIM.maxTrials).toFixed(2), MODEL.meta.se.cell);
  assert.equal(w.SIM.maxTrials, MODEL.meta.trials.latt,
    'the ceiling is the shipped dataset\'s own per-cell trial count');
});

// ---------------------------------------------- F1: the cache validates subs, not only cells
/* Adversarial verification reproduced this: sub arrays rewritten in the shared file:// store to
   [99.9 x 7] were accepted by both validators and painted "RAISE +224.9" on four buckets under a
   chip that said "measured". Both validators walked `cells` and neither looked at `subs`. */
function goodPayload(w, over) {
  const cellKey = 'SMPAIR_CONN|DS';
  const shipped = MODEL.sub[cellKey].map((s) => s.key);
  const cells = {};
  for (const k of Object.keys(MODEL.cells)) if (MODEL.cells[k].combos) cells[k] = MODEL.cells[k].eq.slice();
  const subs = {};
  subs[cellKey] = {};
  for (const k of shipped) subs[cellKey][k] = MODEL.cells[cellKey].eq.slice();
  return {
    tag: 'plo4-sim@1', hash: 'deadbeef', model: MODEL.meta.hash, orderHash: MODEL.meta.orderHash,
    nMax: MODEL.meta.nMax, v: 55, q: 0.85, trials: 900, trialsTotal: 900 * 123,
    cells, subs, subsOf: cellKey, fallbacks: 0, path: 'worker', at: Date.now(), ...over,
  };
}

test('validMeasurement accepts a real payload, with and without a sub block', () => {
  const w = makeWindow();
  const p = goodPayload(w);
  assert.equal(w.SIM.validMeasurement(p), true, 'a stage-2 payload');
  assert.equal(w.SIM.validMeasurement({ ...p, subs: null, subsOf: null }), true, 'a stage-1-only payload');
});

test('the reproduced attack is rejected: fabricated sub equities fail the partition identity', () => {
  const w = makeWindow();
  const KEY = 'SMPAIR_CONN|DS';
  const p = goodPayload(w);
  const poisoned = { ...p, subs: { [KEY]: {} } };
  for (const k of Object.keys(p.subs[KEY])) poisoned.subs[KEY][k] = [99.9, 99.9, 99.9, 99.9, 99.9, 99.9, 99.9];
  assert.equal(w.SIM.validMeasurement(poisoned), false,
    'sub arrays are well-formed and in range, so only the partition check can catch them');
  /* and the same payload reaches neither the cache nor the book */
  const ls = fakeStorage();
  const w2 = makeWindow({ localStorage: ls });
  ls._map.set('plo4:' + MODEL.meta.hash.slice(0, 12) + ':' + w2.SIM.settingsHash({ v: 55, q: 0.85, trials: 900 }),
    JSON.stringify({ ...poisoned, hash: w2.SIM.settingsHash({ v: 55, q: 0.85, trials: 900 }) }));
  assert.equal(w2.SIM.cache.peek({ v: 55, q: 0.85, trials: 900 }), null, 'discarded, not served');
});

test('every way a sub block can be malformed is rejected', () => {
  const w = makeWindow();
  const KEY = 'SMPAIR_CONN|DS';
  const p = goodPayload(w);
  const one = Object.keys(p.subs[KEY])[0];
  const bad = {
    'a 7-character string instead of an array': { ...p.subs[KEY], [one]: '1234567' },
    'a short array': { ...p.subs[KEY], [one]: [1, 2, 3] },
    'a non-numeric entry': { ...p.subs[KEY], [one]: [50, 40, 30, 25, 20, 17, 'x'] },
    'a NaN': { ...p.subs[KEY], [one]: [50, 40, 30, 25, 20, 17, NaN] },
    'an out-of-range equity': { ...p.subs[KEY], [one]: [150, 40, 30, 25, 20, 17, 14] },
    'a negative equity': { ...p.subs[KEY], [one]: [-1, 40, 30, 25, 20, 17, 14] },
    'a bucket key this model does not ship': { ...p.subs[KEY], 'not|a|bucket': p.subs[KEY][one] },
  };
  for (const [why, block] of Object.entries(bad)) {
    assert.equal(w.SIM.validMeasurement({ ...p, subs: { [KEY]: block } }), false, why);
  }
  /* and the envelope around it */
  assert.equal(w.SIM.validMeasurement({ ...p, subsOf: 'NO_SUCH|CELL' }), false, 'a cell that does not exist');
  assert.equal(w.SIM.validMeasurement({ ...p, subs: { [KEY]: {}, 'AA_BIGPAIR|DS': {} } }), false, 'two cells');
  assert.equal(w.SIM.validMeasurement({ ...p, subsOf: null }), false, 'subs without subsOf');
  assert.equal(w.SIM.validMeasurement({ ...p, subs: null }), false, 'subsOf without subs');
  assert.equal(w.SIM.validMeasurement({ ...p, subs: { [KEY]: {} } }), false, 'an empty block');
});

test('the partition tolerance is loose enough that a real measurement is never discarded', () => {
  /* The failure mode of a check like this is a false discard, which costs a re-measurement rather
     than a wrong number — but it should still essentially never happen. A whole standard error of
     scatter on every bucket must pass. */
  const w = makeWindow();
  const KEY = 'SMPAIR_CONN|DS';
  const p = goodPayload(w);
  const se = 50 / Math.sqrt(p.trials);
  const jittered = { [KEY]: {} };
  let i = 0;
  for (const k of Object.keys(p.subs[KEY])) {
    jittered[KEY][k] = p.subs[KEY][k].map((x) => x + (i % 2 ? se : -se));
    i++;
  }
  assert.equal(w.SIM.validMeasurement({ ...p, subs: jittered }), true);
});

// ------------------------- F1, second pass: HOSTILE PAYLOAD FIXTURES (worker-f P11B / P11D)
/* The first version of this validator walked `cells` and never looked at `subs`. The second added
 * the partition identity — and evaluated it at index 0 alone, over whatever subset of buckets the
 * payload chose to include. Adversarial verification re-broke it with one line changed: the expand
 * panel paints `eq @ N` for the CURRENT field size (an interpolation of indices 2-3) and scores its
 * verdicts off the same rows, so index 0 is the one number the check covered and the one number the
 * panel does not show.
 *
 * These are FIXTURES, not mutations, and the distinction is the lesson. Mutating the validator can
 * only prove that a check it already performs is load-bearing; it can never reveal an attack the
 * unmutated validator accepts. A hostile payload can.
 */
const F1_KEY = 'SMPAIR_CONN|DS';                 /* 4 buckets, 1,728 combos — worker-f's own target */

/** P11B: leave the guarded index exactly as measured, fabricate every other one. */
function indexShifted(p, key, value) {
  const block = {};
  for (const [k, arr] of Object.entries(p.subs[key])) block[k] = arr.map((x, n) => (n === 0 ? x : value));
  return { ...p, subs: { [key]: block } };
}

test('P11B: the partition identity is checked at EVERY field size, not only at index 0', () => {
  const w = makeWindow();
  const p = goodPayload(w);
  const shipped = MODEL.sub[F1_KEY];
  const attack = indexShifted(p, F1_KEY, 99.9);

  /* the premise of the attack, asserted rather than asserted-about: index 0 still reconstructs the
     cell exactly, which is precisely why the previous version accepted this payload */
  let wsum = 0, mean0 = 0;
  for (const s of shipped) { wsum += s.combos; mean0 += s.combos * attack.subs[F1_KEY][s.key][0]; }
  assert.ok(Math.abs(mean0 / wsum - p.cells[F1_KEY][0]) < 1e-9,
    'the fixture must be index-0-consistent, or it is not the attack');
  assert.equal(w.SIM.validMeasurement(attack), false,
    '99.9% at every field size the panel actually paints, under an index-0 disguise');

  /* and one index at a time, so no single field size is left unguarded */
  for (let n = 1; n < MODEL.meta.nMax; n++) {
    const block = {};
    for (const [k, arr] of Object.entries(p.subs[F1_KEY])) { block[k] = arr.slice(); block[k][n] = 99.9; }
    assert.equal(w.SIM.validMeasurement({ ...p, subs: { [F1_KEY]: block } }), false, `index ${n} alone`);
  }
});

test('P11B through the real load path: the poisoned entry is discarded, an honest one is served', () => {
  const settings = { v: 55, q: 0.85, trials: 900 };
  const ls = fakeStorage();
  const w = makeWindow({ localStorage: ls });
  const hash = w.SIM.settingsHash(settings);
  const honest = goodPayload(w, { hash });
  const write = (payload) => ls._map.set(NS + hash, JSON.stringify(payload));

  write(indexShifted(honest, F1_KEY, 99.9));
  assert.equal(w.SIM.cache.peek(settings), null, 'discarded on read, not served');
  assert.equal(ls._map.has(NS + hash), false, 'and dropped, so it is not re-read for ever');

  /* the control that makes the discard mean something: the SAME envelope with honest buckets is
     served, so what failed was the payload and not the plumbing */
  write(honest);
  const got = w.SIM.cache.peek(settings);
  assert.ok(got && got.subsOf === F1_KEY, 'an honest payload at the same key is still a hit');
});

test('P11B: a run is never answered with a poisoned entry — it measures instead', async () => {
  /* 100 trials/cell keeps the run cheap while leaving the tolerance (400/sqrt(100) = 40 pt) far
     tighter than the fabrication (99.9 against a cell equity in the 20-50 range). */
  const settings = { v: 55, q: 0.85, trials: 100 };
  const ls = fakeStorage();
  const w = makeWindow({ localStorage: ls });
  const hash = w.SIM.settingsHash(settings);
  ls._map.set(NS + hash, JSON.stringify(indexShifted(goodPayload(w, { hash, trials: 100 }), F1_KEY, 99.9)));

  const r = await w.SIM.run({ ...settings, subsOf: F1_KEY }).promise;
  assert.equal(r.source, 'measured', 'a poisoned entry must not satisfy a run');
  for (const [k, arr] of Object.entries(r.subs[F1_KEY])) {
    for (const x of arr) assert.notEqual(x, 99.9, `${k} carries a fabricated equity`);
  }
});

test('P11D: a subset of a cell\'s buckets is not its partition, and is rejected', () => {
  const w = makeWindow();
  const p = goodPayload(w);
  const keys = Object.keys(p.subs[F1_KEY]);
  assert.ok(keys.length > 1, 'the fixture cell must ship more than one bucket');

  /* (a) the attack as reproduced: ONE bucket, its index 0 set to the cell equity so the old check's
     subset mean "reconstructed" perfectly, everything the panel paints fabricated */
  const one = { [keys[0]]: p.cells[F1_KEY].map((x, n) => (n === 0 ? x : 99.9)) };
  assert.equal(w.SIM.validMeasurement({ ...p, subs: { [F1_KEY]: one } }), false, 'one bucket of four');

  /* (b) an HONEST subset is rejected too, and must be: the engine never writes one, and the mean of
     part of a cell is not an estimate of the cell. Anything less is a hole shaped like this one. */
  const honestSubset = { ...p.subs[F1_KEY] };
  delete honestSubset[keys[0]];
  assert.equal(w.SIM.validMeasurement({ ...p, subs: { [F1_KEY]: honestSubset } }), false, 'three of four');

  /* (c) the count restored with an unknown key standing in for a shipped one — the same size, a
     different partition. Counting keys is not enough; every shipped key has to be read out. */
  const swapped = { ...honestSubset, 'not|a|bucket|here': p.subs[F1_KEY][keys[0]] };
  assert.equal(Object.keys(swapped).length, keys.length, 'the fixture must match the shipped count');
  assert.equal(w.SIM.validMeasurement({ ...p, subs: { [F1_KEY]: swapped } }), false, 'a substituted key');
});

test('the tolerance is not the payload\'s to choose: a lie about the trial count buys nothing', () => {
  /* The tolerance is a multiple of the standard error at `trials`, so a payload claiming one trial
     would be handing itself a 400-point tolerance — every fabrication inside it. The validator
     cannot know better on its own; the CACHE does, because it knows what was asked for. */
  const settings = { v: 55, q: 0.85, trials: 900 };
  const ls = fakeStorage();
  const w = makeWindow({ localStorage: ls });
  const hash = w.SIM.settingsHash(settings);
  const attack = { ...indexShifted(goodPayload(w, { hash }), F1_KEY, 99.9), trials: 1 };

  assert.equal(w.SIM.validMeasurement(attack), true,
    'on its own the validator believes the trial count it is given — which is the point');
  assert.equal(w.SIM.cache.peek(settings), null, 'so the envelope binds it to the settings requested');
  ls._map.set(NS + hash, JSON.stringify(attack));
  assert.equal(w.SIM.cache.peek(settings), null, 'a payload that lies about `trials` is not a hit');

  /* the same discipline over the other two settings the payload declares */
  for (const lie of [{ v: 60 }, { q: 0.5 }]) {
    ls._map.set(NS + hash, JSON.stringify({ ...goodPayload(w, { hash }), ...lie }));
    assert.equal(w.SIM.cache.peek(settings), null, `a payload that lies about ${Object.keys(lie)[0]}`);
  }
});

test('requiring the whole partition is safe: the shipped sub layer IS the hands\' own partition', () => {
  /* This is the invariant "no subsets" rests on. If a cell's shipped bucket list ever disagreed
     with the partition `buildSubPool` derives from that cell's HANDS (the same TAX.subKeyOf), the
     engine's own honest output would be discarded on every read — a false discard on every cell, in
     silence. It agrees today for all 123 cells, key for key and combo for combo; this fails the
     moment a regeneration breaks that, which is the only warning that would arrive in time. */
  const E = enumerateAll();
  let cells = 0, buckets = 0;
  for (let i = 0; i < E.cellKeys.length; i++) {
    const key = E.cellKeys[i], list = MODEL.sub[key], derived = E.subs[i];
    if (!MODEL.cells[key] || !MODEL.cells[key].combos) continue;
    assert.ok(list && list.length, `${key} ships no sub layer`);
    assert.deepEqual([...derived.keys()].sort(), list.map((s) => s.key).sort(), key);
    assert.equal(new Set(list.map((s) => s.key)).size, list.length, `${key} ships a duplicate key`);
    for (const s of list) {
      assert.equal(derived.get(s.key).combos, s.combos, `${key} / ${s.key}`);
      /* A zero-combo bucket would carry weight 0 in the identity, so its row would be free to say
         anything. There are none — every bucket is a non-empty set of hands by construction — and
         this is the assertion that keeps it that way. */
      assert.ok(s.combos > 0, `${key} / ${s.key} carries no combos`);
    }
    cells++; buckets += list.length;
  }
  assert.equal(cells, 123);
  assert.equal(buckets, 341);
});

test('the limit of the check, written down: a self-consistent fabrication still passes', () => {
  /* There is no secret on this page, so a payload fabricated to be well-formed AND consistent is
     indistinguishable from a real one — including one that moves a cell and its buckets together.
     The documentation says so in as many words; this is the same statement in a form that fails if
     anyone ever upgrades the prose to a guarantee. */
  const w = makeWindow();
  const p = goodPayload(w);
  const flat = { ...p, cells: { ...p.cells, [F1_KEY]: new Array(MODEL.meta.nMax).fill(99.9) },
    subs: { [F1_KEY]: {} } };
  for (const k of Object.keys(p.subs[F1_KEY])) flat.subs[F1_KEY][k] = new Array(MODEL.meta.nMax).fill(99.9);
  assert.equal(w.SIM.validMeasurement(flat), true,
    'validation buys well-formed, plausible and internally consistent — never trustworthy');
});

// ------------------------------------------- F2: subsOf, the cache key, and the partial hit
test('subsOf stays OUT of the settings hash — it is scope, not a measurement input', () => {
  const w = makeWindow();
  const base = { v: 55, q: 0.85, trials: 500 };
  assert.equal(w.SIM.settingsHash({ ...base, subsOf: 'SMPAIR_CONN|DS' }), w.SIM.settingsHash(base));
  assert.equal(w.SIM.settingsHash({ ...base, subsOf: 'AA_BIGPAIR|DS' }), w.SIM.settingsHash(base));
});

test('a cached stage-1-only run no longer denies stage 2 for ever', () => {
  /* The reproduced defect: run with nothing expanded, then run with a cell expanded at the same
     settings, and the cache answered the second request with the first result — `subs: null`,
     `source: 'cache'` — permanently, because the store is on disk. */
  const KEY = 'SMPAIR_CONN|DS';
  const w = makeWindow();
  return (async () => {
    const a = await w.SIM.run({ v: 46, q: 0.85, trials: 20 }).promise;
    assert.equal(a.subsOf, null);
    assert.equal(a.subs, null);

    const b = await w.SIM.run({ v: 46, q: 0.85, trials: 20, subsOf: KEY }).promise;
    assert.equal(b.source, 'partial', 'stage 1 reused, stage 2 actually run');
    assert.equal(b.subsOf, KEY);
    assert.ok(b.subs && b.subs[KEY], 'the sub-buckets the user asked for exist');
    assert.deepEqual(Object.keys(b.subs[KEY]).sort(), MODEL.sub[KEY].map((s) => s.key).sort());
    /* the cells are the CACHED ones, byte for byte — that is the point of not re-running stage 1 */
    for (const k of Object.keys(a.cells)) assert.deepEqual(b.cells[k], a.cells[k], k);
    /* and only the sub-buckets were paid for */
    assert.equal(b.trialsRun, MODEL.sub[KEY].length * 20);
    assert.equal(b.trialsTotal, a.trialsTotal + b.trialsRun);

    /* a later request that the cache DOES satisfy is a plain hit again */
    const c = await w.SIM.run({ v: 46, q: 0.85, trials: 20, subsOf: KEY }).promise;
    assert.equal(c.source, 'cache');
    assert.equal(c.subsOf, KEY);
    /* and a request for LESS than the entry carries is satisfied by it */
    const d = await w.SIM.run({ v: 46, q: 0.85, trials: 20 }).promise;
    assert.equal(d.source, 'cache');
  })();
});

test('a second expanded cell gets its own stage 2, not the first cell\'s', () => {
  const X = 'SMPAIR_CONN|DS', Y = 'AA_BIGPAIR|DS';
  const w = makeWindow();
  return (async () => {
    const a = await w.SIM.run({ v: 44, q: 0.85, trials: 20, subsOf: X }).promise;
    assert.equal(a.subsOf, X);
    const b = await w.SIM.run({ v: 44, q: 0.85, trials: 20, subsOf: Y }).promise;
    assert.equal(b.subsOf, Y, 'the cell that was asked for, not the cached one');
    assert.ok(b.subs[Y] && !b.subs[X]);
    assert.equal(b.source, 'partial');
  })();
});

test('the partial run reports a rate for what it ran, not for what it inherited', () => {
  const KEY = 'SMPAIR_CONN|DS';
  const w = makeWindow();
  return (async () => {
    await w.SIM.run({ v: 43, q: 0.85, trials: 20 }).promise;
    const b = await w.SIM.run({ v: 43, q: 0.85, trials: 20, subsOf: KEY }).promise;
    assert.ok(b.rate > 0 && isFinite(b.rate));
    assert.ok(b.rate <= (b.trialsRun * 1000) / Math.max(1, b.elapsedMs) + 1e-9,
      'the rate is computed from trialsRun, so it cannot be inflated by the cached stage 1');
  })();
});
