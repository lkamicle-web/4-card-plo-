// sim-bundle.mjs — assemble the in-browser Simulate engine into ONE flat classic script.
//
// WHY ONE FLAT SCRIPT, AND WHY NOT MODULES
//
// The spike (scratchpad/spike-workers/REPORT.md §4) measured every worker shape against a
// `file://` page in Chrome, WebKit and Gecko. Only one passes everywhere: a classic (non-module)
// `Worker` spawned from a SINGLE self-contained Blob URL. Module workers are refused by Chrome on
// `file://`, and so is `importScripts(blob:)` — and Chrome's refusal arrives as an `onerror` with
// no message, no filename and no line number, so it is the failure mode you would debug last.
// V2-PLAN §4's stated approach ("build.mjs inlines them as worker source") therefore has to mean
// ONE string, not a graph of blobs.
//
// A classic worker has a single global scope, so a naive concatenation of four modules risks
// top-level collisions (three of these files define something called `n`, `out` or `i` at some
// depth, and two export a `size`). Each module is therefore wrapped in an IIFE that returns its
// exports, exactly as the spike recommends, and the modules that need names from earlier ones bind
// them in a prelude.
//
// TWO STRINGS, NOT ONE
//
// The bundle is emitted as a KERNEL half and an ENTRY half:
//
//   kernel   the four IIFEs, ending in `var PLO_ENGINE = {…}`. Evaluating this on the MAIN thread
//            is safe and is exactly what the rAF fallback does — it runs the same kernels the
//            worker runs, so a degraded run is slower, not different.
//   entry    scripts/lib/sim-worker.js: `self.onmessage`, `self.postMessage`. On the main thread
//            `self` IS `window`, so evaluating this half outside a worker would clobber
//            `window.onmessage`. It is only ever concatenated for the Blob.
//
// WHAT IS IN, AND WHAT IS DELIBERATELY OUT
//
//   in   eval5.mjs (whole)          the evaluator and the RNG
//        villain-range.mjs (whole)  canonicalOf / buildSuitClasses / cutAt / classTableCanonical
//        order-pack.mjs (whole)     unpacking the shipped eq1 ordering
//        villains.mjs (slice)       sampleFromRange only
//        mc.mjs (slice)             runMulti + runMultiFiltered + the cooler classifier
//
//   out  taxonomy.mjs               22 KB, and the worker has no use for it: `rowOf` is only
//                                   needed to BUILD the hero pools, which is main-thread work
//                                   whose output travels in the boot payload.
//        mc.mjs's Node worker body, `startPool`, `runJobs`, `runEq1`, the benchmark kernels, and
//        everything that touches `node:worker_threads` or `node:url`.
//
// The slices are marked in the source files with `@worker-slice-start` / `@worker-slice-end`, so a
// future edit that drags a Node dependency into the portable region fails the build rather than
// producing a worker that dies with an empty error.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const SLICE_START = '/* @worker-slice-start';
const SLICE_END = '/* @worker-slice-end */';

/** Read a module source, optionally narrowed to its `@worker-slice` region. */
function readSource(path, sliced) {
  let src = readFileSync(resolve(ROOT, path), 'utf8');
  if (sliced) {
    const a = src.indexOf(SLICE_START);
    const b = src.indexOf(SLICE_END);
    if (a < 0 || b < 0 || b < a) throw new Error(`${path}: missing or inverted @worker-slice markers`);
    src = src.slice(a, b);
  }
  return src;
}

/**
 * Strip ES module syntax and wrap in an IIFE returning the exported names.
 * @param {string} src module source (possibly a slice)
 * @param {string} path for error messages
 * @param {string} prelude lines bound at the top of the IIFE — how a slice gets the names its
 *   `import` used to provide
 * @returns {{body:string, names:string[]}}
 */
function toIife(src, path, prelude = '') {
  if (/^\s*import\s/m.test(src)) throw new Error(`${path}: an import survived into the worker slice`);
  const names = [];
  const stripped = src.replace(/^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, id) => {
    names.push(id);
    return `${kind} ${id}`;
  });
  if (/^export\s/m.test(stripped)) throw new Error(`${path}: an export form this bundler does not understand`);
  if (!names.length) throw new Error(`${path}: exports nothing into the worker bundle`);
  return {
    body: `(function () {\n'use strict';\n${prelude}${stripped}\nreturn { ${names.join(', ')} };\n})()`,
    names,
  };
}

/**
 * Build the two halves of the engine bundle.
 * @param {(src:string)=>string} [minify] optional minifier applied to each half
 * @returns {{kernel:string, entry:string, worker:string, parts:object}}
 *   `worker` is kernel + entry — the exact string the page turns into a Blob URL.
 */
export function buildSimBundle(minify) {
  const parts = {};
  const pieces = [];

  const add = (name, varName, path, { sliced = false, prelude = '' } = {}) => {
    const { body, names } = toIife(readSource(path, sliced), path, prelude);
    pieces.push(`var ${varName} = ${body};`);
    parts[name] = { path, exports: names, bytes: body.length };
  };

  add('eval5', 'PLO_EVAL5', 'scripts/lib/eval5.mjs');
  add('vrange', 'PLO_VRANGE', 'scripts/lib/villain-range.mjs');
  add('order', 'PLO_ORDER', 'scripts/lib/order-pack.mjs');
  add('villains', 'PLO_VILLAINS', 'scripts/lib/villains.mjs', {
    sliced: true,
    prelude: '',
  });
  add('mc', 'PLO_MC', 'scripts/lib/mc.mjs', {
    sliced: true,
    /* the names mc.mjs imports at module scope, rebound from the IIFEs above. This prelude is the
       whole of the "browser twin" for the kernels themselves — the kernel bodies are untouched. */
    prelude: 'var Rng = PLO_EVAL5.Rng, fnv1a = PLO_EVAL5.fnv1a,\n'
      + '    makeTriplePartials = PLO_EVAL5.makeTriplePartials, fillTriplePartials = PLO_EVAL5.fillTriplePartials,\n'
      + '    bestOmaha = PLO_EVAL5.bestOmaha, categoryOf = PLO_EVAL5.categoryOf;\n'
      + 'var sampleFromRange = PLO_VILLAINS.sampleFromRange;\n',
  });

  /* The shared unit-of-work sits between the module IIFEs and PLO_ENGINE: it names PLO_EVAL5 /
     PLO_MC / PLO_VRANGE directly, and both execution paths reach it through PLO_ENGINE.job. */
  const jobSrc = readSource('scripts/lib/sim-kernel.js', false);
  parts.job = { path: 'scripts/lib/sim-kernel.js', exports: ['PLO_JOB'], bytes: jobSrc.length };

  let kernel = "'use strict';\n" + pieces.join('\n') + '\n' + jobSrc + '\n'
    + 'var PLO_ENGINE = { eval5: PLO_EVAL5, vrange: PLO_VRANGE, order: PLO_ORDER, '
    + 'villains: PLO_VILLAINS, mc: PLO_MC, job: PLO_JOB };\n';
  let entry = readSource('scripts/lib/sim-worker.js', false);
  for (const [label, src] of [['sim-kernel.js', jobSrc], ['sim-worker.js', entry]]) {
    if (/^\s*(import|export)\s/m.test(src.replace(/\/\*[\s\S]*?\*\//g, ''))) {
      throw new Error(`scripts/lib/${label} must be a classic script — no import/export`);
    }
  }

  if (minify) { kernel = minify(kernel); entry = minify(entry); }
  return { kernel, entry, worker: kernel + '\n' + entry, parts };
}

/**
 * Escape a bundle half as a JavaScript string literal safe to embed in an inline `<script>`.
 * `JSON.stringify` handles quoting; the `</` rewrite is what stops a future `'</script>'` inside
 * the engine from ending the page's script element early. `"<\/"` and `"</"` are the same string.
 */
export function asJsString(src) {
  return JSON.stringify(src).replace(/<\//g, '<\\/');
}
