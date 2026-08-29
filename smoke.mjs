#!/usr/bin/env node
/**
 * smoke.mjs — headless gate for the built page (BUILD_SPEC §3.5.8).
 *
 *   node smoke.mjs [path/to/index.html] [--shots=dir] [--round=1]
 *
 * Asserts, on a real file:// load of the shipping page:
 *   1. window.__ready === true          (the page sets it at the end of init)
 *   2. zero console errors, zero page errors
 *   3. 145 .cell nodes, displayed combos sum to exactly 270,725
 *   4. every cell carries a defined tier class across 6 positions × 4 nodes
 *      × VPIP {25, 55, 85}
 *   5. one slider-morph render pass under the 8 ms budget
 * and writes screenshots at 1440×900 / 1024×768 / 390×844.
 *
 * Playwright is imported by absolute path and pointed at the preinstalled
 * Chromium; nothing is downloaded.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const PLAYWRIGHT = '/opt/node22/lib/node_modules/playwright/index.mjs';
const CHROMIUM = '/opt/pw-browsers/chromium';
const HERE = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const hit = argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  return hit ? (hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true) : d;
};
const PAGE = resolve(HERE, argv.filter((a) => !a.startsWith('--'))[0] || 'index.html');
const SHOTS = flag('shots', null);
const ROUND = flag('round', '1');
const MORPH_BUDGET_MS = 8;
const TOTAL_COMBOS = 270725;

if (!existsSync(PAGE)) { console.error(`smoke: ${PAGE} not found — run node scripts/build.mjs first`); process.exit(1); }
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const fails = [];
const check = (ok, label, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) fails.push(label);
};
/* A blocked/offline Google Fonts stylesheet is a network failure, not a page
   error: the layout is authored on the fallback metrics and the page is fully
   functional without it. Nothing else is tolerated. */
const isFontNoise = (t) =>
  /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|BLOCKED|CONNECTION|PROXY|TUNNEL)/.test(t);

const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const consoleErrors = [], pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error' && !isFontNoise(m.text())) consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));

console.log(`smoke: ${PAGE}`);
await page.goto(pathToFileURL(PAGE).href, { waitUntil: 'load' });

/* 1 — ready ------------------------------------------------------------- */
let ready = false;
try { await page.waitForFunction('window.__ready === true', { timeout: 15000 }); ready = true; }
catch { ready = await page.evaluate(() => window.__ready === true); }
check(ready, 'window.__ready === true', ready ? '' : await page.evaluate(() => window.__error || 'never set'));

/* dismiss the first-run tour so screenshots show the product ------------- */
await page.evaluate(() => { const t = document.getElementById('tour'); if (t) t.remove(); });

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

/* 5 — morph budget ------------------------------------------------------- */
const morph = await page.evaluate(() => {
  const R = window.__rundown;
  const samples = [];
  for (let v = 40; v <= 80; v += 2) samples.push(window.__measureMorph(v));
  samples.sort((a, b) => a - b);
  // Gate on p95, not the worst pass: a single host-scheduler hiccup on an
  // otherwise sub-millisecond morph is not a render regression.
  const p95 = samples[Math.floor(0.95 * (samples.length - 1))];
  return { median: samples[samples.length >> 1], p95, max: samples[samples.length - 1], n: samples.length };
});
check(morph.p95 < MORPH_BUDGET_MS, `slider-morph render pass p95 < ${MORPH_BUDGET_MS} ms`,
  `median ${morph.median.toFixed(2)} ms · p95 ${morph.p95.toFixed(2)} ms · worst ${morph.max.toFixed(2)} ms over ${morph.n} passes`);

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

/* no horizontal page scroll at any width --------------------------------- */
for (const w of [1440, 1024, 390]) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.waitForTimeout(120);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(over <= 1, `no horizontal page scroll at ${w}px`, `overflow ${over}px`);
}

await browser.close();

if (consoleErrors.length) console.log('\nconsole errors:\n' + consoleErrors.map((e) => '  ' + e).join('\n'));
if (pageErrors.length) console.log('\npage errors:\n' + pageErrors.map((e) => '  ' + e).join('\n'));
console.log(fails.length ? `\nsmoke: FAILED (${fails.length})` : '\nsmoke: all gates green');
process.exit(fails.length ? 1 : 0);
