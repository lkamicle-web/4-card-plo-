#!/usr/bin/env node
/**
 * smoke.mjs — the headless gate for the built page(s).
 *
 *   node smoke.mjs                       every built variant, in turn
 *   node smoke.mjs path/to/page.html     one page
 *   node smoke.mjs --shots=dir --round=1
 *
 * Asserts, on a real file:// load of a shipping artifact:
 *   1. window.__ready === true          (the page sets it at the end of init)
 *   2. zero console errors, zero page errors
 *   3. 145 .cell nodes, displayed combos sum to exactly 270,725
 *   4. every cell carries a defined tier class across 6 positions × 4 nodes
 *      × VPIP {25, 55, 85}
 *   5. the slider morph: the retained floor check, then the layout-inclusive
 *      sweep run TWICE, once in each villain-profile state (§ below)
 *   6. a copied link reopens the same spot
 *   7. THE PER-VARIANT MANIFEST, at runtime (§ below)
 *   8. no horizontal page scroll at 1440 / 1360 / 1280 / 1024 / 390
 * and writes screenshots at 1440×900 / 1024×768 / 390×844.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS RUNS PER VARIANT, AND WHY IT IS NOT OPTIONAL (V3-PLAN §9)
 *
 * docs/spikes/S-D.md §F measured the one thing the dual build cannot prove from
 * text: lite-visible code calling a symbol that lives in an `@only:full` block
 * parses, minifies, passes every size gate and every refusal, and `--check`
 * reports the artifact CURRENT — because it is exactly what the build produced.
 * Then it throws in the browser. `build.mjs` now refuses the call at the seam
 * (danglingSymbols), and gate D10 greps the artifact, but neither can see a
 * symbol reached dynamically. Only loading the page can. So the per-variant
 * smoke run joins the per-variant `--check` in the GREEN definition, and the
 * assertion that carries that weight is the dullest one here: zero page errors
 * after the state sweep has exercised all 72 states.
 *
 * The variant is READ OFF THE ARTIFACT'S OWN BANNER, never passed in. A flag
 * could be wrong; the banner is what the build stamped, and D11 gates it. Which
 * variant a page is decides which manifest applies, so getting it from the file
 * means the lite manifest can never be checked against the full page.
 *
 * ---------------------------------------------------------------------------
 * THE MORPH BUDGET — three checks, two of them the same sweep in the two
 * villain-profile states (docs/spikes/S-E.md §3)
 *
 * The 8 ms budget was predicted to fail on its first re-run under Playwright.
 * It does not, and at the time this was written the reason was that
 * `__measureMorph` timed `{ S.v = clamp(v); render() }` and nothing else: JS
 * only, no style, no layout, no paint, with the readings sitting on Chromium's
 * `performance.now()` floor. A budget that cannot fail is not a budget.
 *
 * The fix S-E recommends is to make `__measureMorph` layout-inclusive, which is
 * an edit in src/shell.html. This harness does not need to wait for that: it can
 * force the flush itself, from outside. So both quantities are measured, and
 * both are named for what they are —
 *
 *   the 8 ms check      kept, unchanged, and REPORTED WITH ITS SLACK so nobody
 *                       reads it as a live tripwire. It is a floor check.
 *
 *                       ITS LABEL IS NOW CORRECTED, and the correction is the
 *                       P1 red team's (docs/refutations/P1.md). Two refuters
 *                       traced what it samples and found the "JS-only" account
 *                       above FALSIFIED: lane U's edit landed, and
 *                       `window.__measureMorph` now runs `render()` and then
 *                       `void document.body.offsetHeight` BEFORE it reads the
 *                       clock — asserted, in exactly those words, by
 *                       test/ui-rail.test.mjs ("the style + layout it forces
 *                       must be inside the timed region, or the number is a
 *                       lie"). So both budgets sample layout-inclusive work and
 *                       differ only in the sweep: 21 samples over v 40-80 by 2
 *                       here, 112 below, and which element's offsetHeight is
 *                       read. The "factor of eighty" was 8 / 0.0999999 against
 *                       the retired JS-only reading; on the current function it
 *                       is single digits. The number 8 is anchored to nothing
 *                       and is not defended as anything — the live slack line
 *                       the check prints is the only version of the claim that
 *                       cannot go stale, which is why the prose no longer
 *                       quotes a figure beside it. It is pinned against silent
 *                       edits by test/ui-rail.test.mjs, not by a page-side
 *                       twin: unlike the layout budget it has none.
 *   layout-inclusive,   the honest one, and the one that can fire. IT NOW RUNS
 *   PROFILE OFF,        WITH THE VILLAIN PROFILE OFF, because that is the state
 *   4.0 ms              it was anchored on and the page no longer loads into it
 *                       (see the two-row note below). Anchored:
 *                       S-E measured p95 2.7 ms over 528 samples. Re-measured
 *                       here over five independent 112-sample runs WITH THE
 *                       FIRST-RUN TOUR SUPPRESSED (see below — the earlier
 *                       readings had a VPIP animation running under them, so
 *                       they are not quoted): median 1.40 ms every run, p95
 *                       2.70 / 2.50 / 2.30 / 2.40 / 2.40 ms. 4.0 = the worst
 *                       observed p95 + ~48%, the same measured+headroom rule the
 *                       byte budgets use, and it agrees with S-E's figure to the
 *                       tenth. Gated on p95, not on `worst`, which ranges 4.5 to
 *                       8.1 ms: the tail is the host's scheduler, not the page,
 *                       and a budget that gates it would be measuring this
 *                       machine's load rather than this page's render.
 *
 *                       Re-measured AFTER the P2 pre-stage, with the sweep now
 *                       explicitly driven into the OFF state through the page's
 *                       own toggle, eleven runs: median 0.90-1.10 ms, p95
 *                       1.60-2.00. The anchor holds and 4.0 is not re-derived.
 *   layout-inclusive,   THE STATE THE PAGE ACTUALLY LOADS INTO, and a separate
 *   PROFILE ON,         measurement rather than a widened 4.0. Anchored on
 *   16 ms               nothing but this page: eleven runs of the same
 *                       112-sample sweep gave p95 10.50 / 10.50 / 10.60 /
 *                       10.60 / 10.60 / 10.60 / 10.70 / 10.70 / 10.70 / 10.80 /
 *                       10.80 ms, median 1.20-1.30. 16 = the worst observed p95
 *                       (10.80) + ~48% = 15.98 — the same measured+headroom rule
 *                       the OFF row and the byte budgets use. Gated on p95 for
 *                       the same reason the OFF row is.
 *                       It is NOT 4.0 with more slack: 4.0 is a measurement of
 *                       a different state, and quoting it here would be
 *                       tolerance-widening wearing an anchor's clothes.
 *                       The two halves are reported apart, because they are
 *                       different quantities: the FIRST visit to each VPIP is
 *                       10.6-10.9 median / 10.9-11.3 p95, and every revisit is
 *                       1.10-1.20 median / 1.8-2.1 p95. p95 over the whole sweep is
 *                       therefore a cold number by construction (14 of 112
 *                       samples are first visits, and they are the slowest 14),
 *                       WHICH IS THE INTENDED READING: a drag visits each VPIP
 *                       once, so the cold cost is what a user feels. The memo is
 *                       not pre-warmed to make this figure smaller.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE TWO ROWS, AND WHAT WAS ACTUALLY WRONG (P2 pre-stage, measured)
 *
 * This file used to carry a P1 red-team note diagnosing a failing layout row as
 * a COLD SWEEP — `__ready` firing while post-load work was still in flight, with
 * a warm-up here as the prescribed fix. THAT ACCOUNT IS WITHDRAWN. It was
 * measured on a PRE-FLIP page, where the villain profile was off by default, and
 * it is correct about that page and wrong about this one. The refutation record
 * (docs/refutations/P1.md) is immutable and still says what it said; this is the
 * correction, and it belongs here because this is the file that acted on it.
 *
 * WHAT THE FLIP DID. Barrier B1 made the villain profile ON the load default
 * (`src/shell.html`, `VP_DEFAULT`, derived from `POLICY.villainLoadDefault`).
 * The page's `curveKey` carries `vpKey()`, and the profile's v IS the table VPIP
 * slider — so with the profile on, every slider step asks for a ribbon the page
 * has not got, and the ribbon is 66 solved VPIP points. With the profile OFF,
 * `vpKey()` is the constant 'OFF', `curveKey` does not mention the slider at
 * all, and the same sweep is free. The 4.0 ms row was measuring the free case
 * and being read as though it measured the shipping one.
 *
 * WHAT WAS FIXED, AND WHAT WAS NOT. Two memos held exactly one entry each: the
 * page's `emodel()` shadow-model slot, and its `curveCache`. Both are now
 * bounded books — the shadow one inside `POLICY.profiledModel`, where the
 * construction lives after the P1 hoist, and the curve one in the page. Measured
 * on this box with this harness, five runs each, before and after:
 *
 *                       BEFORE (HEAD, 5 runs)      AFTER (11 runs)
 *   profile ON          median 10.60-10.80         median 1.20-1.30
 *                       p95    12.10-16.30         p95    10.50-10.80
 *                       revisits are NOT cheaper   revisits 1.1-1.2 / p95 1.8-2.1
 *   profile OFF         median 0.90-1.00           median 0.90-1.10
 *                       p95    1.50-1.70           p95    1.60-2.00
 *
 * The FIRST visit to each VPIP did not move and was never going to: 10.8 median
 * before, 10.7 after. Caching cannot make the first answer cheaper, and the 66
 * solves behind it are work the profile genuinely asks for. So the ON row is
 * pinned at 16 ms — a measurement of the page as it ships, cold visits included
 * — and the claim it makes is not "the morph is fast under ON" but "the morph
 * under ON is this, and it will be noticed when it changes".
 *
 * TWO ROWS RATHER THAN ONE, because one row cannot say both things: a single
 * budget would either be 4.0 and permanently red, or 16 and blind to a
 * regression in the state S-E measured. Each row asserts the profile state it
 * claims to have measured, from `vpKey()` on the page, so a toggle that stopped
 * working fails the row instead of quietly measuring OFF twice.
 *
 * ---------------------------------------------------------------------------
 * BROWSERS. Headless, and every context is a throwaway profile Playwright
 * creates and deletes. This never touches an installed browser: with
 * RUNDOWN_BROWSER unset it uses the Chromium `npx playwright install chromium`
 * downloaded into Playwright's own cache.
 *
 *   RUNDOWN_PLAYWRIGHT=playwright            (default; resolves via node_modules)
 *   RUNDOWN_BROWSER=/path/to/chromium        (default: Playwright's own download)
 *
 * package.json carries `npm run smoke`. Playwright is the repository's only
 * dependency, dev-time, and this file is its named consumer (docs/spikes/S-E.md).
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import { VARIANTS, VARIANT_NAMES } from './scripts/lib/variant.mjs';

const PLAYWRIGHT = process.env.RUNDOWN_PLAYWRIGHT || 'playwright';
const CHROMIUM = process.env.RUNDOWN_BROWSER ?? '';
const HERE = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const hit = argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  return hit ? (hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true) : d;
};
const positional = argv.filter((a) => !a.startsWith('--'))[0];
const SHOTS = flag('shots', null);
const ROUND = flag('round', '1');
const MORPH_BUDGET_MS = 8;          // a floor check, anchored to nothing; see the header
const MORPH_LAYOUT_BUDGET_MS = 4;   // layout-inclusive, PROFILE OFF; S-E §3's measurement + ~48%
const MORPH_LAYOUT_ON_BUDGET_MS = 16;  // layout-inclusive, PROFILE ON (the B1 load default); measured + ~48%
const TOTAL_COMBOS = 270725;
const WIDTHS = [1440, 1360, 1280, 1024, 390];

// ---------------------------------------------------------------------------
/* THE PER-VARIANT LOOP. With no page named, smoke runs over every artifact that
   has been built, each in its own process and its own screenshot directory —
   the same shape, and the same reasoning, as build.mjs's `--check` loop. A
   variant that has not been built is SKIPPED BY NAME, so "1 of 2 ran" cannot be
   read as "2 of 2 passed". A page named explicitly runs alone, which is what the
   `--round=` re-runs and any ad-hoc invocation want. */
if (!positional) {
  const built = VARIANT_NAMES.filter((v) => existsSync(resolve(HERE, VARIANTS[v].out)));
  const skipped = VARIANT_NAMES.filter((v) => !built.includes(v));
  if (!built.length) {
    console.error('smoke: no artifact has been built — run node scripts/build.mjs first');
    process.exit(1);
  }
  const failed = [];
  for (const v of built) {
    const args = [fileURLToPath(import.meta.url), VARIANTS[v].out,
      ...argv.filter((a) => !a.startsWith('--shots=')),
      ...(SHOTS ? [`--shots=${join(SHOTS, v)}`] : [])];
    const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: HERE });
    if (r.status !== 0) failed.push(v);
  }
  console.log(`\nsmoke: ${built.length - failed.length}/${built.length} variants green`
    + (failed.length ? ` · FAILED: ${failed.join(', ')}` : '')
    + (skipped.length ? ` · not built: ${skipped.join(', ')}` : ''));
  process.exit(failed.length ? 1 : 0);
}

const PAGE = resolve(HERE, positional);
if (!existsSync(PAGE)) { console.error(`smoke: ${PAGE} not found — run node scripts/build.mjs first`); process.exit(1); }
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const fails = [];
const check = (ok, label, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) fails.push(label);
};

/* Which variant is this? Off the banner the build stamped and D11 gates — never a
   flag. A page with no stamp is a page this harness cannot decide the manifest
   for, and that is a failure, not a reason to run the lite one by default. */
const stamp = /^\s*VARIANT (\S+) —/m.exec(readFileSync(PAGE, 'utf8'));
if (!stamp) {
  console.error(`smoke: ${relative(HERE, PAGE)} carries no VARIANT banner line, so which artifact `
    + 'it is cannot be established — rebuild it with scripts/build.mjs');
  process.exit(1);
}
const VARIANT_NAME = stamp[1];
if (!VARIANT_NAMES.includes(VARIANT_NAME)) {
  console.error(`smoke: ${relative(HERE, PAGE)} is stamped VARIANT ${VARIANT_NAME}, which is not a `
    + `variant — known variants are ${VARIANT_NAMES.join(', ')}`);
  process.exit(1);
}

/* A blocked/offline Google Fonts stylesheet is a network failure, not a page
   error: the layout is authored on the fallback metrics and the page is fully
   functional without it. Nothing else is tolerated. */
const isFontNoise = (t) =>
  /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|BLOCKED|CONNECTION|PROXY|TUNNEL)/.test(t);

if (PLAYWRIGHT.includes('/') && !existsSync(PLAYWRIGHT)) {
  console.error(`smoke: no Playwright at ${PLAYWRIGHT} — set RUNDOWN_PLAYWRIGHT to its index.mjs`);
  process.exit(2);
}
if (CHROMIUM && !existsSync(CHROMIUM)) {
  console.error(`smoke: no browser at ${CHROMIUM} — set RUNDOWN_BROWSER to a Chromium binary, `
    + 'or to the empty string to use the one Playwright installed');
  process.exit(2);
}

let chromium;
try { ({ chromium } = await import(PLAYWRIGHT)); }
catch (e) {
  console.error(`smoke: cannot load Playwright ("${PLAYWRIGHT}") — ${e.message}\n`
    + '       run `npm install` (Playwright is the repository\'s only dependency, dev-time), then\n'
    + '       `npx playwright install chromium`.');
  process.exit(2);
}
const browser = await chromium.launch({
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  args: ['--allow-file-access-from-files'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const consoleErrors = [], pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error' && !isFontNoise(m.text())) consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));

/* THE FIRST-RUN TOUR IS SUPPRESSED BEFORE IT ARMS, NOT DISMISSED AFTER IT SHOWS.
   The page arms it with `setTimeout(runTour, 400)` at the end of init, and the
   old dismissal here — remove `#tour` once `__ready` is set — ran at roughly
   50 ms, which is to say it removed an element that did not exist yet and then
   let the tour open on top of everything below it. So for ~30 s the tour was
   driving `setProfile`, `S.pos`, `S.node` and an `animateTo` VPIP ramp UNDER the
   72-state sweep and both morph measurements, and standing in the screenshots
   this line exists to keep it out of. Its twin in browsers.mjs was worse than
   noise: it cancelled the run that gate was measuring.
   Suppressed through the page's own guard — the sessionStorage key init checks —
   and then VERIFIED, because a suppression that quietly stops working returns us
   to measuring a moving target while reporting green. */
await page.addInitScript(() => {
  try { window.sessionStorage.setItem('rundown.tour', '1'); } catch (e) { /* asserted below */ }
});

console.log(`smoke [${VARIANT_NAME}]: ${PAGE}`);
await page.goto(pathToFileURL(PAGE).href, { waitUntil: 'load' });

/* 1 — ready ------------------------------------------------------------- */
let ready = false;
try { await page.waitForFunction('window.__ready === true', { timeout: 15000 }); ready = true; }
catch { ready = await page.evaluate(() => window.__ready === true); }
check(ready, 'window.__ready === true', ready ? '' : await page.evaluate(() => window.__error || 'never set'));

/* 1b — and nothing is driving the controls underneath ---------------------
   Past the 400 ms arming window, so an absent `#tour` means suppressed rather
   than not-yet-opened — the distinction the old dismissal missed. */
await page.waitForTimeout(600);
const tourQuiet = await page.evaluate(() => !document.getElementById('tour'));
check(tourQuiet, 'the first-run tour is suppressed, so nothing drives the controls under measurement',
  tourQuiet ? '' : 'sessionStorage was not writable at document start — every timing below is racing a 30 s tour');

/* 2 — clean console ----------------------------------------------------- */
check(consoleErrors.length === 0, 'zero console errors', consoleErrors.slice(0, 3).join(' | '));
check(pageErrors.length === 0, 'zero page errors', pageErrors.slice(0, 3).join(' | '));

/* 3 — the partition is on screen ---------------------------------------- */
const cells = await page.evaluate(() => {
  const n = [...document.querySelectorAll('.cell')];
  return { count: n.length, combos: n.reduce((s, e) => s + (+e.dataset.combos || 0), 0) };
});
check(cells.count === 145, '145 cell nodes', `got ${cells.count}`);
check(cells.combos === TOTAL_COMBOS, `displayed combos = ${TOTAL_COMBOS.toLocaleString()}`, cells.combos.toLocaleString());

/* 4 — every state paints every cell -------------------------------------- */
const sweep = await page.evaluate(async () => {
  const R = window.__rundown;
  const bad = [];
  let states = 0;
  for (const node of ['rfi', 'limps', 'raise', '3bet']) {
    R.setNode(node);
    for (const pos of ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']) {
      R.setPos(pos);
      for (const v of [25, 55, 85]) {
        R.setV(v);
        states++;
        for (const el of document.querySelectorAll('.cell')) {
          if (el.classList.contains('void')) continue;
          const has = /(^|\s)(t[1-5]|cb)(\s|$)/.test(el.className);
          if (!has) bad.push(`${node}/${R.S.pos}/${v}/${el.dataset.key}:${el.className}`);
        }
      }
    }
  }
  R.setNode('rfi'); R.setPos('UTG'); R.setV(55);
  return { states, bad: bad.slice(0, 5), n: bad.length };
});
check(sweep.n === 0, `tier class defined in all ${sweep.states} states`, sweep.bad.join(' | '));

/* 4b — THE DANGLING-SYMBOL BACKSTOP (S-D §F).
   The sweep above has just driven all 72 states through every render path. If a
   variant stripped a symbol something still calls, this is where it surfaced —
   as a page error. Asserted separately from the clean-console check at load so
   the report says WHICH of the two happened: a page that boots and then breaks
   when you move the slider is a different bug from one that never boots. */
check(pageErrors.length === 0, `no page error across all ${sweep.states} states (the stripped-symbol backstop)`,
  pageErrors.slice(0, 3).join(' | '));

/* 5 — the morph, measured twice ------------------------------------------ */
const stats = (s) => {
  s.sort((a, b) => a - b);
  return { median: s[s.length >> 1], p95: s[Math.floor(0.95 * (s.length - 1))], max: s[s.length - 1], n: s.length };
};
const morph = stats(await page.evaluate(() => {
  const out = [];
  for (let v = 40; v <= 80; v += 2) out.push(window.__measureMorph(v));
  return out;
}));
/* Gate on p95, not the worst pass: a single host-scheduler hiccup on an
   otherwise sub-millisecond morph is not a render regression. */
check(morph.p95 < MORPH_BUDGET_MS, `slider-morph short sweep p95 < ${MORPH_BUDGET_MS} ms`,
  `median ${morph.median.toFixed(2)} ms · p95 ${morph.p95.toFixed(2)} ms · worst ${morph.max.toFixed(2)} ms `
  + `over ${morph.n} passes — ${(MORPH_BUDGET_MS / Math.max(morph.p95, 0.1)).toFixed(0)}x of slack. `
  + 'This is a FLOOR CHECK and the budget below is the live one: 8 is anchored to nothing, the slack '
  + 'printed here is the only non-stale statement about it, and both sweeps time the same '
  + 'layout-inclusive quantity now that __measureMorph flushes inside the timed region');
/* THE LAYOUT-INCLUSIVE SWEEP, RUN ONCE IN EACH PROFILE STATE. One function, so the two rows differ
   in nothing but the state of the page under them: 8 rounds over VPIP 25-90 by 5, 112 samples, the
   flush forced from out here. The rounds are kept apart in the return value because the two halves
   are different quantities — round 0 is the FIRST visit to each VPIP and every later round is a
   revisit, which is the whole of what the profiled page's caches can and cannot do for a user. */
const layoutSweep = async () => {
  const rows = await page.evaluate(() => {
    const R = window.__rundown;
    const out = [];
    for (let round = 0; round < 8; round++) {
      for (let v = 25; v <= 90; v += 5) {
        const t0 = performance.now();
        R.setV(v);
        void document.documentElement.offsetHeight;   // force style + layout
        out.push({ round, ms: performance.now() - t0 });
      }
    }
    return out;
  });
  const all = stats(rows.map((r) => r.ms));
  all.cold = stats(rows.filter((r) => r.round === 0).map((r) => r.ms));
  all.warm = stats(rows.filter((r) => r.round > 0).map((r) => r.ms));
  return all;
};
const line = (s) => `median ${s.median.toFixed(2)} ms · p95 ${s.p95.toFixed(2)} ms · worst ${s.max.toFixed(2)} ms`;
const splits = (s) => `first visit to each VPIP ${line(s.cold)} over ${s.cold.n}; revisits ${line(s.warm)} over ${s.warm.n}`;
/* Which state each sweep ran in, taken from the page rather than assumed. A toggle that silently
   stopped working would otherwise measure the same state twice and report two green rows for it —
   which is exactly how the row below came to be anchored on a number the shipping page no longer
   loads into. `vpKey()` is 'OFF' when the profile is off and 'ON|v|q|measured' when it is on. */
const vpState = () => page.evaluate(() => window.__rundown.vpKey());
/* Through the control a user clicks, never by writing S.vp: the toggle cancels a running
   measurement, re-solves, repaints the ribbon and rewrites the hash, and a sweep that skipped all
   of that would be timing a page no user can reach. */
const toggleVP = () => page.evaluate(() => {
  const b = document.getElementById('vptoggle');
  if (b) b.click();
});

const onKey = await vpState();
const morphOn = await layoutSweep();
check(onKey !== 'OFF' && morphOn.p95 < MORPH_LAYOUT_ON_BUDGET_MS,
  `slider-morph incl. layout, villain profile ON, p95 < ${MORPH_LAYOUT_ON_BUDGET_MS} ms`,
  `${line(morphOn)} over ${morphOn.n} passes · profile key at entry ${onKey} · ${splits(morphOn)} `
  + `(anchor: measured on this page after the P2 pre-stage hoist; budget = worst observed p95 + ~48%. `
  + `THE COLD HALF IS THE POINT — a drag visits each VPIP once, so the first-visit figure is what a `
  + `user feels, and the memo is deliberately not pre-warmed here)`);
if (onKey === 'OFF') {
  console.log('  ..    the page did not load with the villain profile on, so the row above measured the '
    + 'wrong state — barrier B1 made ON the load default (src/shell.html, VP_DEFAULT)');
}

await toggleVP();
const offKey = await vpState();
const morphL = await layoutSweep();
check(offKey === 'OFF' && morphL.p95 < MORPH_LAYOUT_BUDGET_MS,
  `slider-morph incl. layout, villain profile OFF, p95 < ${MORPH_LAYOUT_BUDGET_MS} ms`,
  `${line(morphL)} over ${morphL.n} passes · profile key at entry ${offKey} · ${splits(morphL)} `
  + `(anchor: S-E §3 measured p95 2.7 ms with the profile off; budget = measured + ~48%)`);
await toggleVP();                                   // back to the state the page ships in
await page.evaluate(() => window.__rundown.setV(55));

/* provenance of the model + policy --------------------------------------- */
const src = await page.evaluate(() => ({
  policy: window.__policySource, taxonomy: window.__taxonomySource,
  version: window.MODEL.meta.version, fast: !!window.MODEL.meta.fast
}));
console.log(`  ..    model ${src.version}${src.fast ? ' (FAST)' : ''} · policy: ${src.policy} · taxonomy: ${src.taxonomy}`);

/* 6 — a copied link reopens the same spot (state -> URL -> state) --------- */
const link = await page.evaluate(() => {
  const R = window.__rundown;
  R.setNode('raise'); R.setPos('BTN'); R.setV(85);
  const sel = document.querySelector('#nodesec select');
  if (sel) { sel.value = 'UTG'; sel.dispatchEvent(new Event('change')); }
  document.getElementById('copylink').click();      /* writes the hash synchronously */
  return { hash: location.hash, cls: [...document.querySelectorAll('.cell')].map((e) => e.className).join('|') };
});
const rt = await ctx.newPage();
await rt.addInitScript(() => { try { sessionStorage.setItem('rundown.tour', '1'); } catch (e) { } });
await rt.goto(pathToFileURL(PAGE).href + link.hash, { waitUntil: 'load' });
await rt.waitForFunction('window.__ready === true', { timeout: 15000 });
const back = await rt.evaluate(() => [...document.querySelectorAll('.cell')].map((e) => e.className).join('|'));
await rt.close();
check(/raiser=UTG/.test(link.hash) && back === link.cls, 'copied link reopens the same spot',
  link.hash + (back === link.cls ? '' : ' — tier vector differs'));
await page.evaluate(() => { const R = window.__rundown; R.setNode('rfi'); R.setPos('UTG'); R.setV(55); });

/* 7 — THE PER-VARIANT MANIFEST, at runtime -------------------------------
   Gate D10 greps the artifact's TEXT. This is the same manifest read off the
   loaded page's globals, which is a different question: a symbol can be absent
   from the source and present at runtime (or the reverse) in ways a grep cannot
   see. Both halves are cheap, so both run.
     `model.order` is asserted in BOTH variants, per §5.2 — it is unconditional,
   and under villain default-on it is what keeps an off-lattice VPIP honest. */
const globals = await page.evaluate(() => ({
  equilibrium: typeof window.EQUILIBRIUM,
  evEstimate: typeof window.evEstimate,
  synthetic: !!(window.EQUILIBRIUM && window.EQUILIBRIUM.meta && window.EQUILIBRIUM.meta.synthetic),
  order: !!(window.MODEL && window.MODEL.order && window.MODEL.order.packed),
  baselineTiers: !!(window.MODEL && window.MODEL.baselineTiers),
}));
check(globals.order, `model.order is on the page (§5.2, unconditional in every variant)`);
if (VARIANT_NAME === 'lite') {
  check(globals.equilibrium === 'undefined' && globals.evEstimate === 'undefined',
    'lite carries no equilibrium payload and no estimator runtime',
    `EQUILIBRIUM ${globals.equilibrium} · evEstimate ${globals.evEstimate}`);
} else {
  check(globals.equilibrium === 'object', `${VARIANT_NAME} carries its equilibrium payload`,
    `EQUILIBRIUM ${globals.equilibrium}`);
  /* D9's clause, enforced at the page too: a synthetic stand-in must never ship.
     docs/spikes/S-D.md's prototype payload carries meta.synthetic exactly so that
     shipping it is a loud failure rather than a plausible-looking 66 KB. */
  check(!globals.synthetic, 'the shipped equilibrium payload is not the synthetic stand-in',
    globals.synthetic ? 'meta.synthetic is true — this is S-D\'s prototype payload, not a solved one' : '');
}
console.log(`  ..    baseline-tier block ${globals.baselineTiers ? 'present' : 'not yet emitted (P3)'} `
  + '— lite-legal either way (§5.3)');

/* screenshots ------------------------------------------------------------ */
if (SHOTS) {
  for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { const t = document.getElementById('tour'); if (t) t.remove(); });
    await page.waitForTimeout(220);
    const file = join(SHOTS, `ui-${w}-r${ROUND}.png`);
    await page.screenshot({ path: file });
    console.log(`  ..    ${file}`);
  }
  /* the morph, seen: VPIP 25 vs 85 at 1440 */
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const v of [25, 85]) {
    await page.evaluate((vv) => { window.__rundown.setV(vv); document.getElementById('vpip').value = vv; }, v);
    await page.waitForTimeout(320);
    const file = join(SHOTS, `morph-v${v}-r${ROUND}.png`);
    await page.screenshot({ path: file });
    console.log(`  ..    ${file}`);
  }
}

/* 8 — no horizontal page scroll at any width -----------------------------
   1280 and 1360 are new, and they are here because docs/spikes/S-E.md §4 found
   what the old list could not: the 3 px seen at 1440 is the TOP EDGE of a band,
   not a rounding wobble. `documentElement.scrollWidth` is a constant 1443 from
   1280 to 1442 while the topbar's breakpoint sits at 1279, so at 1280 the
   overflow is 163 px and four controls (#drillbtn, #guidebtn, #setbtn,
   #infobtn) are wholly off-screen — clipped, not scrollable, by
   `body{overflow-x:hidden}`. Identical to the pixel in Chromium, Firefox and
   WebKit, so it is layout, not a browser artifact. 1280×800 and 1366×768 are
   both inside the band, which is to say: the two commonest laptop widths.
     Sampling only 1440 caught the 3 px edge and reported it as a rounding
   nuisance for as long as it has existed. The fix is in src/shell.html (§8,
   lane U); the measurement belongs here now, whether or not the fix has landed,
   because a gate that is written after the fix is a gate written to pass. */
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.waitForTimeout(120);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(over <= 1, `no horizontal page scroll at ${w}px`, `overflow ${over}px`);
}

await browser.close();

if (consoleErrors.length) console.log('\nconsole errors:\n' + consoleErrors.map((e) => '  ' + e).join('\n'));
if (pageErrors.length) console.log('\npage errors:\n' + pageErrors.map((e) => '  ' + e).join('\n'));
console.log(fails.length ? `\nsmoke [${VARIANT_NAME}]: FAILED (${fails.length})` : `\nsmoke [${VARIANT_NAME}]: all gates green`);
process.exit(fails.length ? 1 : 0);
