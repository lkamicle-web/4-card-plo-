/* sim-kernel.js — the unit of work, shared by BOTH browser execution paths (V2-PLAN §4).
 *
 * A classic-script fragment, appended to the kernel half of the engine bundle (see
 * scripts/lib/sim-bundle.mjs). It sits above `PLO_ENGINE` and below the module IIFEs, so it can
 * name `PLO_EVAL5`, `PLO_MC` and `PLO_VRANGE` directly.
 *
 * WHY THE WORK IS SLICED, AND WHY BOTH PATHS SLICE IT THE SAME WAY
 *
 * The rAF fallback (spike §4, variant C) has to hand the frame back regularly or the page freezes.
 * `runMultiFiltered` is not resumable — it seeds its RNGs at entry and runs the whole loop — so the
 * fallback has to call it in pieces and average.
 *
 * That leaves a choice with an honesty cost attached. If ONLY the fallback sliced, the worker path
 * and the fallback path would draw different hands and land on different numbers for identical
 * settings — and since the cache is keyed by settings alone, a number measured one way could be
 * served to a session running the other. Both estimates are unbiased and within the same +/-, but
 * "the same settings gave me a different answer" is exactly the kind of thing a tool like this must
 * not do quietly.
 *
 * So the WORKER slices too, identically. One `runUnit`, one slice size, one seed scheme: the two
 * paths are bit-identical, the fallback is only slower, and the cache is safe to share between
 * them. The slices are independent streams whose weighted mean is an unbiased estimator with the
 * same variance as one long run, so nothing is paid for it statistically.
 */
var PLO_JOB = (function () {
  'use strict';
  var fnv1a = PLO_EVAL5.fnv1a;
  var NMAX = PLO_MC.NMAX;

  /* ~32 ms of work on the measured single-thread throughput (about 157k filtered trials/s), i.e.
     one frame. Fixed, not adaptive: an adaptive slice size would make the RESULT depend on how
     busy the machine was, which is the one thing a seeded measurement must never do. */
  var SLICE = 5000;

  /* V2-PLAN §4: "the same seeded xorshift128 scheme keyed by (stage, cell, settings-hash)".
     `s` is the slice index, so a cell's stream is a pure function of (stage, cell, settings, slice)
     and of nothing else — not of worker count, not of chunk order, not of how many cells ran
     first. That is what makes a re-run bit-identical and a resume-after-throttle driftless: the
     interrupted cell restarts from slice 0 and lands on the same numbers. */
  function seedOf(what, job, s) {
    return fnv1a('sim|' + what + '|' + job.stage + '|' + job.key + '|' + job.hash + '|' + s);
  }

  /**
   * Materialise the VPIP-filtered villain pool at `v` from the shipped ordering.
   * @param {Uint32Array} universe the hand universe, in the generator's own cell-enumeration order
   * @param {{size:Int32Array, cidOf:Int32Array}} ct the canonical class table
   * @param {Int32Array} order the shipped eq1-descending permutation
   * @param {number} v VPIP percentage
   */
  function buildRange(universe, ct, order, v) {
    var cut = PLO_VRANGE.cutAt(order, ct.size, universe.length, v);
    var out = new Uint32Array(cut.cum), w = 0, j;
    for (j = 0; j < universe.length; j++) if (cut.keep[ct.cidOf[j]]) out[w++] = universe[j];
    return out;
  }

  /** how many slices `trials` decomposes into */
  function sliceCount(trials) { return Math.ceil((trials | 0) / SLICE); }

  /**
   * Run ONE slice of a unit. The fallback drives this directly so it can hand the frame back
   * between slices; the worker reaches it through `runUnit`. Same function, same seeds, same
   * numbers.
   * @param {Uint32Array} pool the packed hands, grouped by unit
   * @param {Int32Array} starts unit offsets into `pool`
   * @param {Uint32Array|null} range the filtered villain pool ('latt'), or null ('multi')
   * @param {object} job { id, kind, unit, key, stage, hash, q, trials }
   * @param {number} s slice index
   * @returns {{eq:number[], n:number, fallbacks:number}|null} null past the last slice
   */
  function runSlice(pool, starts, range, job, s) {
    var lo = starts[job.unit], hi = starts[job.unit + 1];
    if (!(hi > lo)) throw new Error('unit ' + job.unit + ' is empty');
    var want = job.trials | 0;
    if (!(want > 0)) throw new Error('trials must be positive, got ' + job.trials);
    var from = s * SLICE;
    if (from >= want) return null;
    var n = Math.min(SLICE, want - from);
    var r = job.kind === 'multi'
      ? PLO_MC.runMulti(pool, lo, hi, n, seedOf('hero', job, s),
        seedOf('stream', job, s), seedOf('stream6', job, s))
      : PLO_MC.runMultiFiltered(pool, lo, hi, range, job.q, n,
        seedOf('hero', job, s), seedOf('vill', job, s));
    return { eq: r.eq, n: n, fallbacks: r.fallbacks || 0 };
  }

  /**
   * Measure one whole cell over `job.trials` trials.
   * @returns {{eq:Float64Array, fallbacks:number, trials:number, slices:number}}
   */
  function runUnit(pool, starts, range, job) {
    var acc = new Float64Array(NMAX);
    var done = 0, fallbacks = 0, s = 0, k, r;
    while ((r = runSlice(pool, starts, range, job, s)) !== null) {
      for (k = 0; k < NMAX; k++) acc[k] += r.eq[k] * r.n;
      fallbacks += r.fallbacks; done += r.n; s++;
    }
    var eq = new Float64Array(NMAX);
    for (k = 0; k < NMAX; k++) eq[k] = acc[k] / done;
    return { eq: eq, fallbacks: fallbacks, trials: done, slices: s };
  }

  return {
    SLICE: SLICE, NMAX: NMAX, seedOf: seedOf, buildRange: buildRange,
    sliceCount: sliceCount, runSlice: runSlice, runUnit: runUnit,
  };
})();
