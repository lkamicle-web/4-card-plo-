#!/usr/bin/env node
/**
 * browsers.mjs — harness gates SF (Firefox) and SS (Safari/WebKit).
 *
 *   node browsers.mjs [path/to/page.html] [--engines=chromium,firefox,webkit]
 *
 * V3-PLAN §9 / §7.2's S-gates row, item 17. Measures, in each engine, exactly the
 * three browser facts METHODOLOGY limitation 15 says have only ever been measured
 * in one browser on one machine:
 *
 *   F1  a classic Blob worker boots from a file:// page
 *   F2  localStorage is reachable there, via the page's own write-probe design
 *   F3  a hidden tab suspends requestAnimationFrame
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GATE ASSERTS, AND WHAT IT DOES NOT
 *
 * Not "everything works". The engine is written so that either answer to each
 * fact is safe — a browser that refuses the worker gets the main-thread
 * fallback, one that throws on localStorage gets a session-only in-memory cache
 * — so a red row here would mean a degraded page, not a broken one, and
 * degradation is allowed. What is NOT allowed is a degradation the page does
 * not say out loud.
 *
 * So every fact is measured TWICE: once against the raw browser, and once
 * against what the page CLAIMS about that browser. The gate is the agreement
 * between the two. A page that boots the worker and says "main-thread fallback"
 * fails; so does one that falls back silently. That is the whole point of §9's
 * "the on-screen disclosures are updated to whatever is measured, degradations
 * disclosed rather than patched blind".
 *
 * The claim side is read from `window.SIM.status()` rather than from a DOM
 * selector, deliberately: `status()` is what the on-screen sentences are
 * computed from (`simCacheHint` branches on `cache.backend`; the
 * "(main-thread fallback)" suffix on `degraded`), and reading the source datum
 * survives the inspector IA restructuring landing in the same phase. The one
 * disclosure read as literal on-screen TEXT is F3's, because F3's whole
 * re-scope is about a sentence appearing.
 *
 * ---------------------------------------------------------------------------
 * F3 IS RE-SCOPED, AND THE REASON IS RECORDED RATHER THAN QUIETLY DROPPED
 *
 * docs/spikes/S-E.md §5 established that the RAW fact — does a hidden tab
 * suspend rAF — cannot be measured headless by any available mechanism:
 * `page.bringToFront()` leaves `visibilityState === 'visible'`, CDP's
 * `Emulation.setPageVisibilityOverride` has been removed from the protocol, and
 * `Page.setWebLifecycleState frozen` changes nothing. Pretending otherwise
 * would be the worst outcome, so this harness does two things instead:
 *
 *   1. ASSERTS THAT IT IS STILL UNMEASURABLE. If a future Playwright makes a
 *      page genuinely report itself hidden, this row FAILS — and that failure
 *      is the signal to delete the limitation, not to widen the gate. A
 *      limitation nobody re-tests is a limitation that outlives its cause.
 *   2. MEASURES THE CONSEQUENCE, which is the claim that actually matters:
 *      with the tab reporting hidden and rAF stubbed to never fire, the run
 *      must PAUSE, SAY SO, and RESUME. Four clauses, no race — the run is
 *      started already hidden, so there is nothing to catch in flight.
 *
 * ---------------------------------------------------------------------------
 * BROWSERS. Headless, one throwaway Playwright-managed profile per context,
 * and never an installed browser: the binaries are the ones
 * `npx playwright install firefox webkit` put in Playwright's own cache.
 * Playwright's WebKit build is NOT Safari.app, and the SS row says so on every
 * run — it is the same engine family, not the same product.
 */
import { pathToFileURL } from 'node:url';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

import { VARIANTS, VARIANT_NAMES } from './scripts/lib/variant.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => {
  const hit = argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  return hit ? (hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true) : d;
};
const PLAYWRIGHT = process.env.RUNDOWN_PLAYWRIGHT || 'playwright';
const PAGE = resolve(HERE, argv.filter((a) => !a.startsWith('--'))[0] || VARIANTS.lite.out);

/** engine -> the gate id §7.2 reserved for it. chromium is the reference row, and owns no id. */
const GATE = { firefox: 'SF', webkit: 'SS', chromium: null };
const ENGINES = String(flag('engines', 'chromium,firefox,webkit')).split(',').map((s) => s.trim()).filter(Boolean);

/* The one disclosure read as literal page text (F3). Kept here, next to the
   assertion, so a change to the sentence in src/shell.html fails this gate
   rather than silently un-testing it. */
const PAUSE_SENTENCE = 'this tab is in the background';

if (!existsSync(PAGE)) {
  console.error(`browsers: ${relative(HERE, PAGE)} not found — run node scripts/build.mjs first`);
  process.exit(1);
}
const pageText = readFileSync(PAGE, 'utf8');
const stamp = /^\s*VARIANT (\S+) —/m.exec(pageText);
const VARIANT_NAME = stamp && VARIANT_NAMES.includes(stamp[1]) ? stamp[1] : null;
if (!VARIANT_NAME) {
  console.error(`browsers: ${relative(HERE, PAGE)} carries no usable VARIANT banner line`);
  process.exit(1);
}

let pw;
try { pw = await import(PLAYWRIGHT); }
catch (e) {
  console.error(`browsers: cannot load Playwright ("${PLAYWRIGHT}") — ${e.message}\n`
    + '       run `npm install`, then `npx playwright install chromium firefox webkit`.');
  process.exit(2);
}

const rows = [];
const fails = [];
const record = (engine, gate, fact, ok, measured, disclosed, note) => {
  rows.push({ engine, gate, fact, ok, measured, disclosed, note: note || '' });
  if (!ok && gate) fails.push(`${gate}/${fact}`);
  if (!ok && !gate) fails.push(`${engine}/${fact}`);
};

// ---------------------------------------------------------------------------
async function measure(engineName) {
  const type = pw[engineName];
  if (!type) throw new Error(`no Playwright engine named ${engineName}`);
  const browser = await type.launch({
    /* Chromium needs the flag to let a file:// page reach a Blob worker at all;
       the other two do not take it, and passing it would be a launch error. */
    ...(engineName === 'chromium' ? { args: ['--allow-file-access-from-files'] } : {}),
  });
  const version = browser.version();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
  /* THE GUIDED TOUR AUTO-STARTS 400 ms AFTER INIT ON A FIRST VISIT WITH NO HASH,
     AND IT DRIVES THE EXACT CONTROL THIS GATE MEASURES. Its `paint()` sets the
     villain profile per step, so a tour step landing mid-measurement calls
     `setProfile(false)` -> `simCancelOnChange` -> the harness's run is cancelled
     before `getEngine` ever resolves. That is what a red SF row turned out to be:
     not Firefox refusing anything, but a 30-second animation reaching in and
     switching off the feature under test, at a moment that varies with how fast
     the machine got here. Suppressed through the page's OWN guard — the
     sessionStorage key it checks — rather than by racing it, and the suppression
     is then VERIFIED below, because a harness that silently failed to suppress
     it would be back to measuring a moving target. */
  await page.addInitScript(() => {
    window.__SIM_NOCACHE = 1;
    try { window.sessionStorage.setItem('rundown.tour', '1'); } catch (e) { /* asserted below */ }
  });
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: 'load' });

  let booted = false;
  try { await page.waitForFunction('window.__ready === true', { timeout: 30000 }); booted = true; }
  catch { booted = false; }

  const out = { engineName, version, booted, pageErrors, gate: GATE[engineName] };
  if (!booted) { await browser.close(); return out; }

  /* Past the 400 ms arming window, so this is the real answer and not an early one. */
  await page.waitForTimeout(600);
  out.tourQuiet = await page.evaluate(() => !document.getElementById('tour'));

  /* --- F1 ---------------------------------------------------------------
     RAW: a classic Blob worker, built and round-tripped in the page. The
     shipped engine's worker is a Blob worker for the same reason — a file://
     page cannot load a worker from a path — so this is the fact itself, not a
     proxy for it. */
  out.f1raw = await page.evaluate(async () => {
    try {
      const t0 = performance.now();
      const src = 'self.onmessage=function(e){self.postMessage(e.data*2)}';
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      const ok = await new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error('timeout')), 8000);
        w.onmessage = (e) => { clearTimeout(to); res(e.data === 42); };
        w.onerror = (e) => { clearTimeout(to); rej(new Error(String((e && e.message) || 'worker error'))); };
        w.postMessage(21);
      });
      const ms = +(performance.now() - t0).toFixed(1);
      w.terminate();
      return { boots: ok, ms, err: '' };
    } catch (e) { return { boots: false, ms: null, err: String((e && e.message) || e) }; }
  });

  /* --- F2 ---------------------------------------------------------------
     RAW: the same write probe the page's cache uses — set, read back, remove.
     A `typeof localStorage` sniff is NOT this test: §9.12's design note is that
     the object can exist and still throw on first access from file://. */
  out.f2raw = await page.evaluate(() => {
    try {
      const k = '__rundown_probe__', v = String(Date.now());
      window.localStorage.setItem(k, v);
      const got = window.localStorage.getItem(k);
      window.localStorage.removeItem(k);
      return { reachable: got === v, err: got === v ? '' : 'read back wrong value' };
    } catch (e) { return { reachable: false, err: String((e && e.name) || e) }; }
  });

  /* --- what the page CLAIMS ---------------------------------------------
     One real run through the page's own Simulate button path, forced neither
     way, so `status().engine` reports what the page actually chose rather than
     what a hook told it to choose.

     WHAT IS OBSERVED IS THE ENGINE DECISION, NOT THE RUN'S COMPLETION, and the
     difference is a gate bug this harness had and this comment exists to keep
     out. The first version waited for `simRunning()` to go false and then read
     `status()`. That reads a DIFFERENT MOMENT in each browser: a run that
     finishes in 200 ms (chromium, firefox) is read after it ended, one that is
     still going at the 60 s deadline (webkit, slower per trial) is read mid-run
     — and a cross-engine table whose three rows are sampled at three different
     points in the run is not comparing engines. It also fails OPEN in one
     direction and CLOSED in the other: if the run ends before `getEngine`
     resolves — an error, a cancel — `ENGINE` is still null and the gate reports
     the bare string 'not started' with no cause attached, which is what a flake
     looked like here before this was rewritten.
     The decision is a single observable transition (`engine` leaves 'not
     started'), it happens during boot, and it is the whole of what F1 asserts.
     So: poll for it, bound the wait, and if it never comes say WHAT ELSE
     happened — whether the run was still going, and what the page recorded —
     instead of reporting an absence as a measurement. */
  out.claim = await page.evaluate(async () => {
    const R = window.__rundown;
    if (!R || !window.SIM || !window.SIM.available) {
      return { available: false, why: 'the page exposes no SIM.available surface' };
    }
    if (!R.hasVP) return { available: false, why: 'HAS_VP is false: this build has no villain lattice' };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    R.setProfile(true);
    R.setV(57);
    /* The setters repaint and push the hash. Let that land before the run starts,
       so nothing the settings change schedules can cancel the run it precedes. */
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const decided = () => window.SIM.status().engine !== 'not started';
    R.startSim();
    const started = R.simRunning();
    const t0 = performance.now();
    while (!decided() && R.simRunning() && performance.now() - t0 < 30000) await sleep(25);
    const st = window.SIM.status();
    const ms = +(performance.now() - t0).toFixed(0);
    /* Whatever it chose, we have the answer; the rest of the run is cost with no
       evidence in it, and F3 wants a quiet page. */
    if (R.simRunning()) R.simCancel('the harness has its measurement');
    return {
      available: true, engine: st.engine, degraded: st.degraded, degradedWhy: st.degradedWhy,
      workers: st.workers, backend: st.cache.backend, probed: st.cache.probed,
      cacheError: st.cache.lastError, decidedInMs: ms, started,
      /* only meaningful when the decision never arrived — the diagnosis */
      endedUndecided: !decided(),
      callbackError: st.callbackError ? `${st.callbackError.name}: ${st.callbackError.message}` : '',
    };
  });

  /* --- F3, part 1: still unmeasurable? ----------------------------------
     No stubbing here. If any of this starts reporting 'hidden', S-E §5's
     finding has expired and limitation 15 needs rewriting — which is a gate
     failure, because a stale limitation is a lie in the Method view. */
  await page.bringToFront();
  out.f3raw = await page.evaluate(() => ({
    visibilityState: document.visibilityState, hidden: document.hidden,
  }));

  /* --- F3, part 2: the consequence --------------------------------------
     Started ALREADY HIDDEN with rAF stubbed dead, so there is no in-flight
     race: the fallback loop's first gap lands on a hidden tab and parks. Four
     clauses — pauses, says so, freezes, resumes — then cancelled, because the
     run completing is not the claim and waiting for it is not free. */
  out.f3seen = await page.evaluate(async (SENTENCE) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ev = [];
    let done = false, err = null, cancelled = false;
    /* THE FALLBACK PATH IS THE ONE THIS FACT IS ABOUT. The worker path is not
       rAF-paced — it has no pause to observe — so the hidden-tab machinery
       lives entirely in the main-thread fallback loop, which is exactly the
       code a browser that REFUSES the worker would be running. Forcing it here
       is not making the test easier; it is pointing the test at the only place
       the behaviour exists. The engine is disposed first because one engine is
       cached per page, and the worker one is already up from the F1 run. */
    window.__SIM_FORCE = 'fallback';
    if (window.SIM.dispose) window.SIM.dispose();

    /* BOOT THE FALLBACK ENGINE WHILE THE TAB IS STILL VISIBLE AND rAF STILL
       WORKS. `mainThreadEngine()` builds the pools and a canonical class table
       over 270,725 hands; on a loaded machine that is comfortably longer than
       any sleep this block would otherwise wait. Booting it inside the hidden
       window made every timing below a race against a cost that has nothing to
       do with the fact being measured — the run had not yet reached the loop
       when the harness looked for the pause, so `sawPaused` and `froze` came
       back false on a page that behaves correctly. Paid up front, `getEngine`
       returns the cached engine in a microtask and the run reaches its first
       hidden-check immediately. */
    let bootErr = '';
    try { if (window.SIM.boot) await window.SIM.boot({ force: 'fallback' }); }
    catch (e) { bootErr = String((e && e.message) || e); }
    if (bootErr) {
      return {
        sawPaused: false, froze: false, completedWhileHidden: false, advanced: false,
        cleared: false, err: 'the main-thread fallback engine would not boot: ' + bootErr,
        cancelled: false, events: 0,
        sentenceInPage: document.documentElement.innerHTML.indexOf(SENTENCE) >= 0,
      };
    }

    const realRaf = window.requestAnimationFrame;
    const hide = (on) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => on });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (on ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    const last = () => (ev.length ? ev[ev.length - 1] : null);
    const doneCount = () => (last() ? last().done : 0);
    /* Every wait below is a BOUNDED POLL on an observable transition, never a
       fixed sleep sized by guesswork: a fixed sleep is either too short (a flake
       on a loaded machine) or too slow (paid on every green run), and it makes
       the gate's verdict a function of the host rather than the browser. */
    const until = async (pred, ms) => {
      const t0 = performance.now();
      while (!pred() && performance.now() - t0 < ms) await sleep(20);
      return pred();
    };

    window.requestAnimationFrame = function () { return 0; };
    hide(true);
    const h = window.SIM.run({
      v: 57, q: 0.85, trials: 20000,
      onProgress: (p) => ev.push({ paused: !!p.paused, done: p.trialsDone }),
      onDone: () => { done = true; },
      onError: (e) => { err = String((e && e.message) || e); },
      onCancel: () => { cancelled = true; },
    });
    /* 1. it pauses, and says so — `paused: true` reaching a progress callback IS
          the disclosure's data source. */
    const sawPaused = await until(() => ev.some((e) => e.paused) || done || err, 15000);
    const atHide = doneCount();
    /* 2. it freezes: nothing advances while it stays hidden. This one cannot be
          a poll — the claim is that nothing happens — so it is the single
          deliberate dwell, and it is short because the fallback loop's duty
          cycle would have advanced the counter many times over within it. */
    await sleep(400);
    const froze = doneCount() === atHide;
    const completedWhileHidden = done;

    /* 3. it resumes, and 4. clears the flag. */
    window.requestAnimationFrame = realRaf;
    hide(false);
    const advanced = await until(() => doneCount() > atHide || done || err, 20000);
    const cleared = await until(() => !!last() && !last().paused, 5000);

    if (h && h.cancel) h.cancel();
    await sleep(80);
    window.__SIM_FORCE = null;
    if (window.SIM.dispose) window.SIM.dispose();
    return {
      sawPaused: sawPaused && ev.some((e) => e.paused),
      froze, completedWhileHidden, advanced, cleared, err, cancelled, events: ev.length,
      sentenceInPage: document.documentElement.innerHTML.indexOf(SENTENCE) >= 0,
    };
  }, PAUSE_SENTENCE);

  await browser.close();
  return out;
}

// ---------------------------------------------------------------------------
console.log(`browsers [${VARIANT_NAME}]: ${relative(HERE, PAGE)}`);
console.log(`  gates: ${ENGINES.map((e) => `${e}${GATE[e] ? ` = ${GATE[e]}` : ' (reference, no gate id)'}`).join(' · ')}\n`);

for (const engineName of ENGINES) {
  let m;
  try { m = await measure(engineName); }
  catch (e) {
    record(engineName, GATE[engineName], 'launch', false, String(e && e.message || e), '', '');
    console.log(` FAIL  ${engineName}: ${e && e.message || e}`);
    continue;
  }
  const g = m.gate;
  const tag = `${engineName} ${m.version}${g ? ` [${g}]` : ' [reference]'}`;
  console.log(`  ${tag}`);

  if (!m.booted) {
    record(engineName, g, 'boot', false, 'the page never reached __ready', '', m.pageErrors.slice(0, 2).join(' | '));
    console.log(` FAIL  ${engineName}: the page never reached __ready — ${m.pageErrors.slice(0, 2).join(' | ')}`);
    continue;
  }
  record(engineName, g, 'boot', m.pageErrors.length === 0, `__ready, ${m.pageErrors.length} page errors`, '', m.pageErrors.slice(0, 2).join(' | '));
  console.log(`${m.pageErrors.length === 0 ? '  ok  ' : ' FAIL '} boots on file:// with no page errors`
    + (m.pageErrors.length ? `  — ${m.pageErrors.slice(0, 2).join(' | ')}` : ''));

  /* Not one of the three facts — a precondition for measuring them. It is a gate
     row rather than a comment because the alternative is a harness that quietly
     goes back to racing the tour the day sessionStorage stops being writable. */
  record(engineName, g, 'quiet', m.tourQuiet, 'the auto-tour is suppressed via its own sessionStorage guard',
    'nothing is driving the controls under test');
  if (!m.tourQuiet) {
    console.log(' FAIL  the guided tour is RUNNING: it drives the villain profile per step, so every '
      + 'measurement below is racing it — sessionStorage was not writable at document start');
  }

  /* F1 */
  const f1ok = m.claim.available
    && (m.f1raw.boots ? (m.claim.engine === 'worker' && !m.claim.degraded)
      : (m.claim.engine === 'fallback' && m.claim.degraded));
  /* A decision that never arrived is not the verdict 'not started'; it is the
     absence of a verdict, and it gets said in those words. */
  const undecided = m.claim.available && m.claim.endedUndecided
    ? ` — THE PAGE'S RUN ENDED WITHOUT CHOOSING AN ENGINE (started ${m.claim.started}, `
      + `${m.claim.decidedInMs} ms${m.claim.callbackError ? `, callback error ${m.claim.callbackError}` : ''}): `
      + 'that is an error or a cancel inside SIM.run, not a browser fact'
    : '';
  record(engineName, g, 'F1', f1ok,
    `Blob worker on file:// ${m.f1raw.boots ? `BOOTS in ${m.f1raw.ms} ms` : `REFUSED (${m.f1raw.err})`}`,
    `page reports engine "${m.claim.engine}", degraded ${m.claim.degraded}${m.claim.degradedWhy ? ` (${m.claim.degradedWhy})` : ''}`,
    undecided || (m.claim.available ? '' : m.claim.why));
  console.log(`${f1ok ? '  ok  ' : ' FAIL '} F1 worker: measured ${m.f1raw.boots ? `boots (${m.f1raw.ms} ms)` : `refused — ${m.f1raw.err}`}`
    + ` · page says ${m.claim.engine}${m.claim.degraded ? ' (degraded, disclosed as main-thread fallback)' : `, ${m.claim.workers} workers`}`
    + `, decided in ${m.claim.decidedInMs} ms${undecided}`);

  /* F2 */
  const f2ok = m.claim.available && (m.f2raw.reachable
    ? (m.claim.backend === 'localStorage' && m.claim.probed)
    : (m.claim.backend === 'memory' && !!m.claim.cacheError));
  record(engineName, g, 'F2', f2ok,
    `localStorage write probe ${m.f2raw.reachable ? 'REACHABLE' : `REFUSED (${m.f2raw.err})`}`,
    `page cache backend "${m.claim.backend}"${m.claim.cacheError ? `, lastError ${m.claim.cacheError}` : ''}`);
  console.log(`${f2ok ? '  ok  ' : ' FAIL '} F2 storage: measured ${m.f2raw.reachable ? 'reachable' : `refused — ${m.f2raw.err}`}`
    + ` · page caches to ${m.claim.backend}`
    + (m.claim.backend === 'memory' ? ' (disclosed as "kept for this session only")' : ''));

  /* F3 — the standing limitation, still standing */
  const f3unmeasurable = m.f3raw.visibilityState === 'visible' && m.f3raw.hidden === false;
  record(engineName, g, 'F3-raw', f3unmeasurable,
    `bringToFront leaves visibilityState "${m.f3raw.visibilityState}"`,
    'unmeasurable headless — recorded as a standing limitation (S-E §5)');
  console.log(`${f3unmeasurable ? '  ok  ' : ' FAIL '} F3 raw: NOT MEASURABLE headless — visibilityState stays `
    + `"${m.f3raw.visibilityState}" with no override available`
    + (f3unmeasurable ? ' (the limitation stands, as recorded)'
      : ' — IT IS NOW MEASURABLE: rewrite METHODOLOGY limitation 15 rather than widening this gate'));

  /* F3 — the consequence */
  const s = m.f3seen;
  const f3ok = !!(s && s.sawPaused && s.froze && !s.completedWhileHidden && s.advanced && s.cleared
    && s.sentenceInPage && !s.err);
  record(engineName, g, 'F3-consequence', f3ok,
    `hidden + rAF stubbed: paused ${s.sawPaused}, froze ${s.froze}, completed-while-hidden ${s.completedWhileHidden}, resumed ${s.advanced}, flag cleared ${s.cleared}`,
    `the page carries "${PAUSE_SENTENCE}": ${s.sentenceInPage}`, s.err || '');
  console.log(`${f3ok ? '  ok  ' : ' FAIL '} F3 consequence: run pauses (${s.sawPaused}), freezes (${s.froze}), `
    + `does not finish hidden (${!s.completedWhileHidden}), resumes (${s.advanced}), clears the flag (${s.cleared}), `
    + `and the disclosure sentence is on the page (${s.sentenceInPage})${s.err ? ` — ${s.err}` : ''}`);

  if (engineName === 'webkit') {
    console.log('  ..    SS caveat, printed every run: Playwright\'s WebKit is NOT Safari.app. Same engine '
      + 'family, different product — these verdicts are WebKit\'s, and METHODOLOGY must say so.');
  }
  console.log('');
}

// ---------------------------------------------------------------------------
/* The table METHODOLOGY limitation 15 is rewritten from. Printed rather than
   written: the doc edit is a human decision about wording, and this harness's
   job is to make sure the wording cannot outlive the measurement. */
console.log('  MEASURED VERDICTS — the table METHODOLOGY limitation 15 is rewritten from');
console.log('  ' + '-'.repeat(96));
console.log(`  ${'ENGINE'.padEnd(26)}${'GATE'.padEnd(7)}${'F1 worker'.padEnd(22)}${'F2 localStorage'.padEnd(22)}F3 rAF suspension`);
for (const engineName of ENGINES) {
  const r = rows.filter((x) => x.engine === engineName);
  const f = (name) => r.find((x) => x.fact === name);
  if (!r.length) continue;
  const f1 = f('F1'), f2 = f('F2'), f3 = f('F3-consequence');
  console.log(`  ${engineName.padEnd(26)}${(GATE[engineName] || '—').padEnd(7)}`
    + `${(f1 ? (f1.measured.includes('BOOTS') ? 'boots' : 'refused') : 'not run').padEnd(22)}`
    + `${(f2 ? (f2.measured.includes('REACHABLE') ? 'reachable' : 'refused') : 'not run').padEnd(22)}`
    + `${f3 ? (f3.ok ? 'consequence green; raw fact unmeasurable' : 'CONSEQUENCE FAILED') : 'not run'}`);
}
console.log('  ' + '-'.repeat(96));
console.log('  Every row is one headless run against a throwaway profile. WebKit here is Playwright\'s');
console.log('  build, not Safari.app. The raw F3 fact stays unmeasured by decision, not by omission.');

console.log(fails.length
  ? `\nbrowsers: FAILED (${fails.length}) — ${fails.join(', ')}`
  : `\nbrowsers: all gates green (${ENGINES.map((e) => GATE[e]).filter(Boolean).join(', ')} + chromium reference)`);
process.exit(fails.length ? 1 : 0);
