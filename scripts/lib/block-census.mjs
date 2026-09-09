// block-census.mjs — the two byte censuses the page's ceilings are measured against.
//
// Lifted out of scripts/build.mjs at the v3 release consolidation, for the same reason
// shell-compile.mjs was lifted out of it before: a measurement that lives only inside the build
// can be gated only by the build. METHODOLOGY §9.11's ceilings are anchored from BELOW by the
// build (a page over its ceiling fails to build) and were, until this file existed, open from
// ABOVE — nothing asserted that a ceiling was not looser than the +5 % rule it claims to be set by,
// so `app` at 460 KB shipped green (docs/refutations/P5.md §3, "The byte budgets are anchored from
// below and open from above"). Gate D6's from-above clause needs the build's own measured figures
// at verify time, and the honest way to give it those is for both to call the same function over
// the same inputs rather than for the gate to re-derive the census in its own words.
//
// TWO CENSUSES, because the figures come from two different places:
//
//   blockCensus   the MARKED-BLOCK census — what each `@block:<name>` region costs in the
//                 artifact's own bytes. It is a difference of two COMPILES (the stripped shell as
//                 authored, and the same shell with one block's regions cut, through the same
//                 stripper and the same minifier), so it cannot be read off the artifact: the
//                 markers ship nothing and the minified page carries no trace of where a block
//                 began. This is the loop build.mjs ran inline at P3–P5, byte for byte.
//   pageCensus    the ARTIFACT census — `total`, `data`, `modelCode`, `eq` and `app`, read off the
//                 built page by its own `/* @inject:<key> */ … /* @end:<key> */` markers, which the
//                 build leaves in the artifact around every generated region. `app` is the build's
//                 own definition (scripts/build.mjs: everything that is not the dataset, the inlined
//                 model source or the full-only payload), so the number the gate reads is the number
//                 the build gated, to the byte.
//
// Neither function reads a file: the build passes what it has in hand, and the gate passes what it
// read from disk (or what a test injected). Neither depends on data/model.json's CONTENTS, which is
// what lets D6 run this inside generate-data.mjs against an in-memory model without comparing the
// artifact to the wrong dataset — the trap scripts/gates/variants.mjs explains at length.

import { stripMarkedBlocks } from './variant.mjs';
import { compileShellScripts } from './shell-compile.mjs';

/** The marked blocks, in the order the build reports them. Adding a block means adding a cap. */
export const BLOCKS = ['gto', 'ev', 'skill', 'topn', 'calib', 'ring'];

/** The generated regions whose bytes are NOT `app` (build.mjs: `app = total - data - modelCode - eq`). */
export const APP_EXCLUDED_REGIONS = ['data', 'policy', 'taxonomy', 'eq', 'ring'];

/**
 * The marked-block census: each `@block:<name>` region's cost in compiled bytes.
 *
 * @param {string} onlyText the shell AFTER variant stripping (stripOnlyBlocks(...).text) — a block
 *                          is measured for the variant it ships in, exactly as the build measures it
 * @param {number} shellBytes byte length of the compiled shell as authored — the baseline every cut
 *                            is subtracted from; the build already has it, so it is passed rather
 *                            than recompiled
 * @param {object} [opts]
 * @param {string} [opts.label] what to call the file in error messages
 * @param {string[]} [opts.blocks] which blocks to measure (default: all of BLOCKS)
 * @returns {{by:Record<string,number>, total:number}} `by[name]` is 0 for a block the shell does
 *          not mark, so a block that vanished reads as 0 rather than as absent
 */
export function blockCensus(onlyText, shellBytes, opts = {}) {
  const label = opts.label || 'shell';
  const blocks = opts.blocks || BLOCKS;
  const by = {};
  let total = 0;
  for (const name of blocks) {
    const cut = stripMarkedBlocks(onlyText, name, { label });
    if (!cut.blocks) { by[name] = 0; continue; }
    const core = compileShellScripts(cut.text, { label, noMinify: false });
    const b = shellBytes - Buffer.byteLength(core.html);
    by[name] = b;
    total += b;
  }
  return { by, total };
}

/**
 * The artifact census, read off a built page by its own region markers.
 *
 * @param {string} page the artifact text
 * @param {object} [opts]
 * @param {string} [opts.label] what to call the artifact in error messages
 * @returns {{total:number, data:number, modelCode:number, eq:number, app:number, regions:Record<string,number>}}
 * @throws {Error} on a page that is not a built artifact — a region marker missing, unclosed, or
 *         present twice — because a census of the wrong file is worse than no census
 */
export function pageCensus(page, opts = {}) {
  const label = opts.label || 'artifact';
  const regions = {};
  for (const key of APP_EXCLUDED_REGIONS) {
    /* The build splices every generated region as `${start}\n${body}\n${end}` (scripts/build.mjs,
       the `for (const key of regions)` loop), so the body is exactly what sits between the marker
       line and the end-marker line. */
    const start = `/* @inject:${key} */\n`;
    const end = `\n/* @end:${key} */`;
    const si = page.indexOf(start);
    if (si < 0) {
      /* `eq` is full-only; a lite page has no such region and its term is 0, as in the build. Every
         other region is in both artifacts, and its absence means this is not a built page. */
      /* `ring` is in BOTH variants once v4 ships, but a page built before it has no such region
         and its term is 0 — the same tolerance `eq` gets, for the same reason. */
      if (key === 'eq' || key === 'ring') { regions[key] = 0; continue; }
      throw new Error(`${label}: no /* @inject:${key} */ region — not a page scripts/build.mjs produced`);
    }
    const ei = page.indexOf(end, si + start.length);
    if (ei < 0) throw new Error(`${label}: the @inject:${key} region is never closed by @end:${key}`);
    if (page.indexOf(start, si + start.length) >= 0) {
      throw new Error(`${label}: the @inject:${key} region appears more than once`);
    }
    regions[key] = Buffer.byteLength(page.slice(si + start.length, ei));
  }
  const total = Buffer.byteLength(page);
  const data = regions.data;
  const modelCode = regions.policy + regions.taxonomy;
  const eq = regions.eq;
  /* THE RING COMES OUT OF `app` HERE TOO, and the duplication is the point of the comment:
     `scripts/build.mjs` computes the same quantity from its own generated blocks, and if only one
     of the two subtracted the ring the two would disagree by 18 KB and `appCore` would read over
     budget in exactly one of them. D6 reads this function; the build reads its own. */
  const ring = regions.ring;
  return { total, data, modelCode, eq, ring, app: total - data - modelCode - eq - ring, regions };
}
