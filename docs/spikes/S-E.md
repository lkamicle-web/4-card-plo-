*Phase 0 spike S-E · worktree branch `worktree-wf_5a8a2571-726-6` · verdict: PASS (buy Playwright only).*

# S-E — what opening the toolchain buys

*Phase 0 feasibility spike, V3-PLAN §1. Isolated worktree on `worktree-wf_5a8a2571-726-6` at
`e6c6641`; commit `dbc333b`. macOS 15.5 / arm64 / Node v25.9.0 / npm 11.12.1. No file outside
`package.json`, `package-lock.json` and `spikes/S-E/` was written.*

**Verdict: buy Playwright, decline everything else — and all three declines are now measurements,
not taste.** The spike's own question resolves in favour of the adoption; the literal success
criterion ("smoke green") does not, because the newly-armed harness immediately found a real page
defect that this worktree is not permitted to fix. That is the harness earning its keep on day one,
not the toolchain failing.

## 1. The manifest, and what it cost

`package.json` with **no `"type"` field** (so `.js` stays CommonJS-by-default exactly as it was
when no manifest existed — verified: there is no `package.json` anywhere above the repo root), and
Playwright as the only `devDependencies` entry.

| | |
|---|---|
| `npm install` | **1.90 s**, 2 packages (`playwright` 1.62.1 + `playwright-core`), `node_modules` **18 MB**, lockfile 66 lines / 3 resolved entries |
| `npx playwright install chromium` | **24.8 s**, **554 MB** (chromium 356 + headless-shell 196 + ffmpeg 2.5) |
| `npx playwright install firefox webkit` | **16.8 s**, **+576 MB** → 1.1 GB in `~/Library/Caches/ms-playwright` |
| repo diff | 23 + 66 lines of manifest. Zero source files touched. |

**Identity holds.** With the manifest and `node_modules` present: `verify.mjs` exit 0, **44/44**
gates, 25.0 s; `node --test` **224/224**; `build.mjs --check` reports **`index.html is up to
date`** at a byte-identical 480.7 KB. Adding the manifest is inert, which is the property the
`"type"`-field omission was chosen to guarantee.

`smoke.mjs`'s built-in defaults are a CI image's absolute paths, so `package.json` carries
`npm run smoke` = `RUNDOWN_PLAYWRIGHT=playwright RUNDOWN_BROWSER= node smoke.mjs` — the bare
specifier resolves through `node_modules` (smoke documents that form) and the empty
`RUNDOWN_BROWSER` selects Playwright's own download. Headless, throwaway profiles, never an
installed browser.

## 2. Smoke: 11 of 12, in 2.05 s, deterministic over three runs

Green: `__ready`, zero console errors, zero page errors, 145 cells, 270,725 combos, tier class
defined in all 72 states, morph budget, copied-link round-trip, no h-scroll at 1024 and 390, and
five screenshots written. One red: **`no horizontal page scroll at 1440px — overflow 3px`**.

## 3. The prediction: falsified, and the reason matters more than the result

The plan predicted the 8 ms slider-morph p95 would fail on first re-run. It does not — it passes by
a factor of eighty, because **the metric does not measure what the budget names**.

`__measureMorph` is `performance.now()` around `{ S.v = clamp(v); render() }`: JS only, no style, no
layout, no paint. Chromium's smallest observable non-zero `performance.now()` delta here is
**0.0999999 ms**, so the readings are at the clock floor.

| measurement | n | median | p95 | max |
|---|---|---|---|---|
| smoke's own sample, ×5 | 105 | 0.000 | **0.100** | 0.300 |
| dense sweep v 25..90 ×8 | 528 | 0.000 | 0.100 | 0.200 |
| `setV` + forced layout flush | 528 | 1.200 | **2.700** | 5.500 |
| `setV`, rAF-to-rAF | 66 | 16.700 | 17.200 | 17.500 |

The rAF row is vsync cadence, not work. The middle row is the honest quantity. **The budget is 80×
the p95 it gates: it could not detect a page eighty times slower than this one.** Per the plan's own
instruction the budget is retuned to the measurement — which here means *tightening*: move
`__measureMorph` to a layout-inclusive pass and set the budget to **4.0 ms** (measured p95 + ~50%,
the same measured+headroom rule the byte budgets already use). That edit is in `src/shell.html`,
outside this worktree's write scope; it belongs to §8 at P1.

## 4. What the harness bought immediately: a 163-pixel dead band in the topbar

The 3 px at 1440 is the **top edge of a band**, not a rounding wobble. `documentElement.scrollWidth`
is a constant **1443** across it, while the topbar's breakpoint is at 1279:

| width | 1024 | 1200 | 1279 | **1280** | 1320 | 1360 | 1400 | 1440 | 1442 | 1443 | 1920 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| chromium 151 | 0 | 0 | 0 | **163** | 123 | 83 | 43 | 3 | 1 | 0 | 0 |
| firefox 153 | 0 | 0 | 0 | **163** | 123 | 83 | 43 | 3 | 1 | 0 | 0 |
| webkit 26.5 | 0 | 0 | 0 | **163** | 123 | 83 | 43 | 3 | 1 | 0 | 0 |

Identical to the pixel in three engines, so it is layout, not a browser artifact. Nothing scrolls —
`body{overflow-x:hidden}` **clips** it. At 1280 px, `#drillbtn` (left 1287), `#guidebtn` (1366),
`#setbtn` (1391) and `#infobtn` (1425) are wholly off-screen and unclickable; the screenshot shows
the bar ending at "Method" with four controls simply gone. **1280×800 and 1366×768 are both inside
the band.** smoke sampled 1440/1024/390 and caught only the 3 px edge; the width list should gain
1280 and 1360.

## 5. METHODOLOGY limitation 15, two thirds retired

| engine | F1 Blob worker on `file://` | F2 `localStorage` write probe | F3 rAF suspends while hidden |
|---|---|---|---|
| chromium 151.0.7922.34 | **boots**, 4.6 ms round-trip | **reachable** | *unmeasurable headless* |
| firefox 153.0 | **boots**, 6.0 ms | **reachable** | *unmeasurable headless* |
| webkit 26.5 | **boots**, 10.0 ms | **reachable** | *unmeasurable headless* |

The page reaches `__ready` in all three. Two notes with teeth:

* **F2 falsifies the documented expectation.** §9.12 says WebKit "is documented to throw
  `SecurityError` on the first `localStorage` access from a `file://` page". It does not throw in
  WebKit 26.5. The write-probe design is still right; the sentence explaining *why* must become a
  measured verdict. Honest caveat: Playwright's WebKit build is **not Safari.app**.
* **F3 is not measurable by any headless mechanism available.** `page.bringToFront()` leaves
  `visibilityState === 'visible'` (144 rAF/1.2 s, same as foreground); CDP
  `Emulation.setPageVisibilityOverride` has been removed from the protocol; CDP
  `Page.setWebLifecycleState frozen` changes nothing. Re-scope SF/SS's F3 clause to the
  *consequence* — stub `requestAnimationFrame` to stop, assert the run pauses and the disclosure
  renders — and keep the raw fact as a standing limitation.

## 6. The buy list — every item needs a named consumer; the default is no

| item | named consumer | verdict |
|---|---|---|
| **Playwright (npm)** | `smoke.mjs`; the SF/SS harness gates (§9) | **BUY** — the only adoption |
| **Playwright firefox + webkit browsers** | SF/SS; retires 2 of limitation 15's 3 facts | **BUY** — same dependency, +576 MB, no new package |
| bundler (esbuild/rollup) | none | **NO — disqualifying.** `--format=cjs` makes verify's CLI detection **silently not fire**; the verifier exits 0 having run zero gates. `--format=esm` survives and buys nothing. |
| minifier as a build step | would be `APP_BUDGET` | **NO.** Buys 37.6 KB raw / 8.2 KB gz on the shell, 8.5 KB on the model modules. The dual build (§9) buys more and costs no dependency. Re-open only if the app block passes ~350 KB of its 360, and note it would cost the generator's zero-dependency property. |
| TypeScript (transpile) | none | **NO.** Cannot compile `import.meta` to CommonJS at all — TS1343, exit 2, and the emitted `.js` is a hard SyntaxError under Node's CJS loader. It cannot even be adopted incrementally: `tsc` treats `.mjs` as ESM regardless of `module`, so the whole tree must be renamed first. |
| TypeScript (`--checkJs --noEmit`) | the payoff contract (§2) | **NO.** 81 errors today, 53 of them purely "no `@types/node`" (a second mandatory dependency); of the remaining 28, **21 trace to one incrementally-built object literal** and **zero are real defects**. I33 asserts payoff *behaviour*, which is the stronger check. |
| test framework (vitest/jest) | none — `node:test` carries 224 tests | **NO** |
| linter / formatter | none | **NO.** A formatter rewrites the hand-authored sources jsmin's byte budget is calibrated against. |
| `@types/node` | only as TypeScript's dependency | **NO** (falls with TS) |

The transpilation evidence, in full: untranspiled, both patterns work. `tsc` 5.9.3 on `.mjs` with
`module=commonjs` is a **no-op**. Renamed to `.ts`, it is **TS1343 ×2, exit 2**. esbuild 0.28.2
`--format=cjs` rewrites `import.meta` to `{}`, so `fileURLToPath(undefined)` throws
`ERR_INVALID_ARG_TYPE` — and, worse, the CLI detection prints *"did NOT fire"* with **no error at
all**. In a repo whose discipline is "gates are written to FAIL, never tolerances widened to pass",
a tool that can turn the gate runner into a silent no-op is not a close call.

## 7. The re-scoped rule, drafted for METHODOLOGY

> **Dependencies are dev-time only.** The repository carries a `package.json` with exactly one
> `devDependency`, Playwright, whose consumer is `smoke.mjs` and the browser-harness gates. It has
> no `"type"` field, so `.mjs`/`.js` resolution is unchanged and `sim-kernel.js` / `sim-worker.js`
> remain the classic scripts they are written as. **Both shipped artifacts and the generator remain
> runtime-dependency-free**: `index.html` loads no script it does not contain, issues no `fetch`,
> and `scripts/build.mjs` and everything it imports run on the Node standard library alone. The
> zero-dependency claim is therefore a property of *the generator and the shipped artifacts*, and
> is no longer a repo-wide promise. Any further adoption requires a **named consumer** and a memo
> recording what was measured; the default answer is no. Nothing that transpiles, bundles or
> rewrites the sources may enter the generator: `import.meta.url` self-spawning
> (`scripts/lib/mc.mjs`), the `import.meta.url === argv[1]` CLI detection (`scripts/verify.mjs`)
> and jsmin's hand-authored-JavaScript assumption all break under it — one of them silently, in the
> direction of a verifier that passes without running a gate.

## 8. Files

`package.json`, `package-lock.json`, and six prototypes under `spikes/S-E/`: `diagnose.mjs`
(overflow sweep + morph resolution), `overflow.mjs` (band edges + culprit chain), `topbar-band.mjs`
(cross-engine band), `three-facts.mjs` (the SF/SS prototype), `raf-hidden.mjs` (F3 mechanisms
tried; headed mode is opt-in behind `S_E_HEADED` and was **not** run), `minify-compare.mjs`
(byte table via `compileShellScripts`' own `opts.minify` seam — `build.mjs` unmodified; esbuild and
terser live in a scratch install and are **not** repo dependencies).
