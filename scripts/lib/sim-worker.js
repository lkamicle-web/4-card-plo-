/* sim-worker.js — the BROWSER twin of mc.mjs's Node worker body (V2-PLAN §4).
 *
 * This file is a CLASSIC SCRIPT, deliberately: no `import`, no `export`, no `type=module`. The
 * spike (scratchpad/spike-workers/REPORT.md §4) measured that Chrome refuses module workers on a
 * `file://` page and reports the refusal as an `onerror` with an EMPTY message, and that
 * `importScripts(blob:)` fails there too. One flat script in one Blob is the only shape that boots
 * in all three engines from a local file, so this file is concatenated after the kernel modules
 * rather than importing them, and reads them off the `PLO_ENGINE` object the kernel string ends
 * with. scripts/lib/sim-bundle.mjs does the concatenation.
 *
 * It is never loaded by Node and never shipped on its own; it exists as a file so the entry has
 * comments, a diff history and a unit test (test/sim-worker.test.mjs evaluates it against a fake
 * worker global and drives the protocol below).
 *
 * PROTOCOL — the contract the UI reads is scratchpad/phase4/engine-api.md.
 *
 *   out { booted:true }                                    unprompted, as soon as the script runs
 *
 *   in  { cmd:'init', order:{packed,n,bits}, pool:Uint32Array, starts:Int32Array }
 *   out { ready:true, classes, universe, ms }   |   { error }
 *
 *   in  { cmd:'jobs', jobs:[ {id,kind,pool,unit,key,stage,hash,v,q,trials} ] }
 *   out { results:[ {id,eq:Float64Array,fallbacks,trials,slices,ms} | {id,error} ] }
 *       (the eq buffers are transferred)
 *
 *   in  { cmd:'ping' }   out { pong:true }
 *
 * A job that throws is reported as `{id, error}` rather than thrown, so one bad unit cannot take
 * down a pool mid-run.
 */
(function () {
  'use strict';

  var E = PLO_ENGINE;                                  // set by the kernel half of the bundle
  var JOB = E.job;
  var ST = null;

  var now = (typeof performance !== 'undefined' && performance.now)
    ? function () { return performance.now(); } : function () { return Date.now(); };

  /* One villain pool per v, cached: a run holds v fixed across all 123 cells, and cutting the pool
     walks 16,432 classes and filters 270,725 hands. Paying that once per run rather than once per
     cell is the difference between milliseconds and most of a second of pure overhead. */
  function rangeAt(v) {
    if (ST.rangeV === v && ST.range) return ST.range;
    ST.range = JOB.buildRange(ST.universe, ST.ct, ST.order, v);
    ST.rangeV = v;
    return ST.range;
  }

  function boot(msg) {
    var t0 = now();
    /* The universe is the CELL POOL the page sent, not a fresh enumeration, and that is a fidelity
       decision rather than a saving. `buildRanges` in the generator materialises a filtered pool by
       walking its hand list in enumeration order; a pool built by walking a different order holds
       the same SET but hands it to `sampleFromRange` in a different sequence. Reusing the page's
       cell pool — which is rebuilt to be the generator's own `E.byCell` — makes the browser's pool
       at a lattice v identical, hand for hand, to the one the shipped lattice was measured
       against. */
    var universe = msg.pool;
    if (!universe || universe.length !== 270725) {
      throw new Error('init: the cell pool must be the whole 270,725-hand universe, got '
        + (universe ? universe.length : 'nothing'));
    }
    var ct = E.vrange.classTableCanonical(universe);
    var order = E.order.unpackOrder(msg.order.packed, msg.order.n);
    var bad = E.order.permutationProblem(order, msg.order.n);
    if (bad) throw new Error('init: the shipped villain order is not a permutation — ' + bad);
    if (ct.n !== msg.order.n) {
      throw new Error('init: enumeration yields ' + ct.n + ' classes, the shipped order carries ' + msg.order.n);
    }
    ST = {
      universe: universe, ct: ct, order: order,
      pools: { cell: universe }, starts: { cell: msg.starts },
      range: null, rangeV: null,
    };
    return { classes: ct.n, universe: universe.length, ms: now() - t0 };
  }

  function runOne(job) {
    if (!ST) throw new Error('jobs before init');
    var pool = ST.pools[job.pool], starts = ST.starts[job.pool];
    if (!pool || !starts) throw new Error('unknown pool "' + job.pool + '"');
    var t0 = now();
    var r = JOB.runUnit(pool, starts, job.kind === 'multi' ? null : rangeAt(job.v), job);
    return {
      id: job.id, eq: r.eq, fallbacks: r.fallbacks, trials: r.trials, slices: r.slices,
      ms: now() - t0,
    };
  }

  self.onmessage = function (ev) {
    var msg = ev.data, i, out, xfer, r;
    if (!msg) return;
    if (msg.cmd === 'ping') { self.postMessage({ pong: true }); return; }

    if (msg.cmd === 'init') {
      try {
        var b = boot(msg);
        self.postMessage({ ready: true, classes: b.classes, universe: b.universe, ms: b.ms });
      } catch (e) { self.postMessage({ error: String((e && e.message) || e) }); }
      return;
    }


    if (msg.cmd === 'jobs') {
      out = []; xfer = [];
      for (i = 0; i < msg.jobs.length; i++) {
        try { r = runOne(msg.jobs[i]); out.push(r); xfer.push(r.eq.buffer); }
        catch (e) { out.push({ id: msg.jobs[i].id, error: String((e && e.message) || e) }); }
      }
      /* Transfer the RESULT buffers — the worker is done with them. The other half of the spike's
         rule is that the POOLS must not be transferred at init: transfer neuters the sender's
         ArrayBuffer, and every worker in the pool needs its own copy of the same hands. */
      self.postMessage({ results: out }, xfer);
      return;
    }
  };

  /* The boot signal. The page treats "no message within ~2 s" as a failed spawn and falls through
     to the main-thread path, because Chrome's rejection of a worker script arrives as an onerror
     with no message, no filename and no line number — there is nothing else to detect it by. */
  self.postMessage({ booted: true });
})();
