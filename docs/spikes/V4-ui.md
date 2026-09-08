# V4 S2 lane U — the Table control and the nine-seat rail

Base `33a228f` (`v4-s1-base`, fast-forwarded into this worktree before any edit; `git diff v4-s1-base -- scripts/lib/policy.mjs` empty). Branch `worktree-wf_3c958a35-f26-5`.

**Files written.** `src/shell.html` (lane U's lines only — S1's `:2182–2199` / `:3202` / `:3155–3156` and lane R's `:1181` / `:1318` / `:1407` are untouched, verified by diff), `smoke.mjs`, `browsers.mjs`, `test/ui-seats.test.mjs` (new), `index.html` + `index-full.html` (rebuilt, never hand-edited), this memo. **Nothing else** — no `policy.mjs`, no `variant.mjs`, no `build.mjs`, no `data/model.json`, no `gates/`, no `index.mjs`/`reserved.mjs`.

---

## 1. What shipped

| § | Deliverable | Where |
|---|---|---|
| 1 | **Table control** `6-max ǀ 9-max` in the environment rail beside depth / rake / straddle, default 6-max, persisted in the permalink as `&seats=9` (omitted at the default), `seats` a member of `env` | `#seatsrow`, `@block:ring` |
| 2 | Position rail renders `seatsFor(seats)` — nine chips at nine, display names from `POLICY.SEAT_DISPLAY`; disabled reasons are `positionDisabled(pos, node, seats)`'s, never the view's | `buildPosSeg`, the `posDisabledReason` / `legalPos` overrides |
| 3 | Everything keyed by `(pos, node)` follows the rail, because `POSITIONS` **is** the ladder: the rail, hand search, the skill dial's status line, the EV surface, the sub-cell top-N, the raiser picker, `[`/`]` seat stepping, the field view and the CSV export all read the same array | one reassignment in `applySeats` |
| 4 | Method view gains **Table size — the seat ladder**: the ladder at both sizes, every structural function's output at both sizes, `constants.ladder` with rule / anchor / flag / the six derived numbers, the ring artifact's `meta`, and the `extrapolated` census with R3's per-(pos, node) breakdown | `@block:ring`, in `renderMethod` |
| 4b | **No new rail-chip badge**, by decision (rule R3) — pinned by a test that counts `badge-extrap` and fails on a third use | `test/ui-seats.test.mjs` |
| 5 | `smoke.mjs` gains **one** row (the toggle repaint against the 16 ms ON-default budget, 8 rounds / 16 toggles, asserting the size actually moved); `browsers.mjs` gains **F4** in all three engines, headless, throwaway profiles | `smoke.mjs`, `browsers.mjs` |
| 6 | §10 Q3 answered by measurement — below | §6 of this memo |

### The one design decision this lane took that the plan did not spell out

**Nine seats is refused, by name, on a build that does not carry `data/ring.json`.** Measured: **327 of the 6,336** nine-seat settings (**5.16 %**), *every one of them at the iso node*, drive `N_eff` above 7 — past the span `cells[*].eq` covers — where `policy.rhoAtSeats` fails closed with a `TypeError` naming the file. A page that offers a table size and then throws at one setting in twenty is worse than one that says why it cannot, so the 9-max button renders **disabled with the payload's absence as its reason** (lite's second solved depth is the precedent; V3-PLAN §8 item 15). The gate is on the **artifact**, not on the setting, so the failure is unreachable rather than rare. It lights up with no further edit the moment lane R's artifact lands — and `browsers.mjs` F4 and `smoke.mjs` 5b both fail loudly if it does not.

---

## 2. Measurements, in bytes

`appCore` is the constrained row. Baseline is this worktree **after S1** (not the plan's pre-S1 figure).

| | lite | full |
|---|---|---|
| `appCore` before (S1 base) | 368,096 B = 359.5 K | 368,246 B = 359.6 K |
| `appCore` after, **`ring` registered** | **368,471 B = 359.8 K** | **368,621 B = 360.0 K** |
| Δ shared | **+375 B** | **+375 B** |
| headroom under the 360 K ceiling | **169 B** | **19 B** |
| `appCore` after, `ring` NOT registered (this worktree's build) | 379,317 B = 370.4 K | 379,467 B = 370.6 K |
| `@block:ring` region | **10,846 B** | **10,846 B** |
| `app` | 414,650 B = 404.9 K | 414,800 B = 405.1 K |
| `total` | 612,878 B = 598.5 K | 684,298 B = 668.3 K |
| `blocks.gto` | 10,241 B (was 10,198; +43 B, the coverage denominator) | same |

**Shrink-first, rule R6 — 308 B recovered before asking for anything, each step measured on the artifact:**

| shrink | recovered |
|---|---|
| `solveState` stops spelling the env bag a second time and goes through `stateOf`; the `by` accumulator becomes a 3-triple rather than three named fields | 83 B |
| `seatLabel`, `extrapReach`'s ladder and clamp lookups read the local `POL` instead of `window.POLICY`; the rail chip's `title` back to the key | 94 B |
| `stateOf` builds its env half from `envArg()` — **one** env literal in the page now, down from two | 92 B |
| `seatLabel` moved out of shared code into `@block:ring`; `buildPosSeg` reads the display map inline | 39 B |

Gross shared cost before shrinking was **+683 B**; after, **+375 B**. The plan's §2.7 prediction that the shell's duplicate `POSITIONS` / `N_NB` / `N_BL` / `legalPos` / `posDisabledReason` / `seatsBefore` copies would pay for the additions (~0.4 KB) is **falsified twice over**: S1 measured that rewrite as **+0.2 K net** rather than −0.4 K (its memo §11), and this lane found nothing further to delete in shared code without moving pre-existing bytes into a new block, which would be laundering rather than shrinking.

### Timings

| row | budget | measured |
|---|---|---|
| **table-size toggle repaint, p95** (new) | 16 ms | **2.40 / 2.50 / 2.60 ms** over three runs of 8 rounds (16 toggles), chromium 1440×900 |
| — its cold half | (excluded by the p95 gate, as the ON/OFF rows exclude theirs) | the **first** toggle costs **25.2–25.6 ms**: nine chips built, nine seats × the rail's per-seat width readout solved from an empty memo. Once per session, on a click rather than a drag |
| slider-morph short sweep, p95 | 8 ms — **unmoved** | 1.60 ms (lite) / 1.20 ms (full) |
| morph incl. layout, profile **ON**, p95 | 16 ms — **unmoved** | 12.30 ms (lite) / 13.10 ms (full) |
| morph incl. layout, profile **OFF**, p95 | 4 ms — **unmoved** | 2.80 ms (lite) / 2.00 ms (full) |

The toggle figures were taken with a **harness-side synthetic ring** injected before load (a linear continuation of `eq[6]`, never committed, never shipped) because this worktree has no `data/ring.json`. The stub's *values* are meaningless and the quantity measured — style + layout after a re-solve of the whole rail — does not read them. The shipped `smoke.mjs` row does **not** stub anything: it drives the real buttons and is **RED here by construction**, naming the missing artifact. S3 re-runs it against lane R's real payload.

Layout, nine chips, `.seg.seg-wide` (the one new CSS rule, 9-max-only, in `@block:ring`): **0 px horizontal overflow at 1440 / 1360 / 1280 / 1024**, seg 407 px. Permalink round trip verified: `#pos=UTG&…&seats=9` reopens at nine seats with `UTG` honoured, which the six-seat list would have rejected — hence the seats read is first in `readHash`.

---

## 3. What S3 must own (measured requirements, never taken here)

1. **Register the block.** `scripts/lib/block-census.mjs`'s `BLOCKS` gains `'ring'`, and `scripts/lib/variant.mjs`'s `budgets.blocks` gains `ring` **in both variants**. Until then `build.mjs` refuses, with exactly:
   > `build: app CSS+JS+markup is 404.9 KB, budget 398 KB; app minus the marked blocks is 370.4 KB, budget 360 KB (the pre-raise app ceiling — a raise pays for the block it named, not for the rest)`

   and `node scripts/build.mjs --check` reports `0/2 variants current · STALE: lite, full`.
2. **`blocks.ring` = 11 KB.** Measured 10,846 B; `ceilingBound(10846, 1.05)` = 12 KB, so 11 KB (11,264 B) is **tighter than the rule and still above the artifact** — the conservative direction this repository has taken five times. D6's from-above clause covers it with no gate edit (`gates/data.mjs:255` iterates `Object.keys(budgets.blocks)`).
3. **`app` = 409 KB, both variants**, mechanically, by the equality pin: `appCore` 360 + Σcaps (11 + 12 + 4 + 5 + 6 + **11**) = 49 → 409. Measured app is 405.1 K, so it fits, and `ceilingBound(414800, 1.05)` = 426 K bounds it.
4. **`appCore` stays 360 KB.** It fits in both variants — but with **19 B** of headroom in full. If lane R's `SIM_NMAX` / `validEqArray` edits at `:1181` / `:1318` / `:1407` cost more than that, the honest move is a paid raise to **361 KB** (= measured + 0.3 %, far inside the +5 % rule) carrying the shrink record in §2 above as its `budgetSource` sentence. **Do not** widen it by more than the measurement.
5. **`total` (full) must be raised.** 684,298 B = **668.3 K against 660 K** — over by 8,458 B *before* the ring data payload lands. This is §2.7's own prediction (“a raise is EXPECTED”), and D9 is the one red gate in this worktree. `ceilingBound(684298, 1.05)` = 702 K bounds it; the number is S3's to set after the ring payload is in. **`total` (lite)** is 598.5 K against 600 K — 1,946 B of headroom, which the ring data (est. 7–8 KB) will also consume.
6. **`test/variant.test.mjs`'s `MARKED` map** (`:476`) lists five blocks and must list six; its comment already anticipates “will survive a sixth”. `test/block-census.test.mjs` and `test/gates-variants.test.mjs` follow the registration.
7. **`data/model.json` is not modified by this lane** — but note that `scripts/verify.mjs` **writes gate verdicts into it** and rehashes, so a failing D9 leaves `gates.D9: "FAIL"` and a moved `meta.hash` behind, which then fails `test/equilibrium.test.mjs`'s artifact-hash check as a knock-on. It was restored (`git checkout -- data/model.json`) before the commit and the artifacts were rebuilt against the pristine file.

### Gate ids this lane adds

**None.** Every claim lane U makes is asserted by `test/ui-seats.test.mjs`, by `smoke.mjs`'s 5b row or by `browsers.mjs`'s F4 — none of which needs a reserved id. `I51(c)`'s **page half** (no new seat-name literal in `src/shell.html`, `smoke.mjs`, `browsers.mjs`) is asserted there too, as a test rather than as a second gate, and lane F owns the gate.

### Policy deltas filed (policy.mjs is frozen; S3 applies)

1. **`solveUncached` drops `state.ring`.** `scripts/lib/policy.mjs:2251` builds `const opts = { limpers: state.limpers, raiserPos: state.raiserPos, env }` and hands it to `aggressiveSet` → `rankTable`, which reads `o.ring` at `:1675`. So `scoreCell` is called with `ring === undefined` on **every** solve and `rhoAtSeats` fails closed above N = 7. **Measured in the browser, not inferred:**
   - `POLICY.rankTable(MODEL, 'UTG1', 'limps', 0.9, { limpers: 4, env: { seats: 9, straddle: true }, ring })` → **ok**
   - `POLICY.solve(MODEL, { pos: 'UTG1', node: 'limps', v: 0.9, limpers: 4, straddle: true, seats: 9, ring })` → **throws** `policy: N_eff over 7 at nine seats needs the data/ring.json payload for AA_BIGPAIR|RB`
   - a nine-seat sweep of 108 states (9 seats × 4 nodes × VPIP {25,55,90}) with the payload present: **27 throw**, all of them iso.
   The fix is one line: `ring: state.ring` in that opts literal. The page already supplies it (`stateOf` sets `s.ring = RING`). Without it the 9-max UI is unusable even once `data/ring.json` exists.
2. **S1's `vDeltaAtSeats` delta stands as filed** (docs/spikes/V4-ladder.md, the policyDelta paragraph) — re-filed here as a dependency, not a new finding. **Measured beside it, and it refines S1's expectation rather than confirming it:** `ringCols`' villain-profile refusal (`cell.vpSource` → throw) was **not reached** on the worst nine-seat setting at either the shipped `q` or an interpolated one — `profiledModel` returned the model itself (`moved === 0`, 0 of 145 cells carrying `vpSource`) on the probes run here, so the profiled path did not mix profiled and unprofiled columns because it had nothing profiled to mix. Recorded as *not reached*, **not** as *cannot happen*: lane R's vDelta work is what decides it.

---

## 4. Predictions, and what measurement said

| plan says | measured |
|---|---|
| §2.7: shrink-first pays for `appCore` (~0.4 KB from the shell's duplicate tables) | **Falsified.** S1's rewrite was +0.2 K net, not −0.4 K; this lane recovered 308 B by de-duplicating the env bag and moving new code into the block, and still spends +375 B |
| §2.6: nine seats reads **3 of 36** covered, 33 uncovered | **Confirmed, and rendered from a structural denominator** (`POSITIONS.length * NODES.length`) so six seats still prints the recorded `3 of 24 … the other 21`, byte for byte, from the same expression |
| §2.6 / R3: the nine-seat census belongs in the Method view, no rail chip | **Shipped that way**, and the numbers reproduce S1's R3 census exactly on screen: 6-max **47 of 3,960 (1.19 %)**, 9-max **19 of 6,336 (0.30 %)**, worst raw 9.96 at iso / UTG+1 / VPIP 90 / 4 limpers / straddled |
| §5.2 I48(c): the six-seat census domain is 3,960 | **Confirmed as a domain, with a discrepancy recorded**: the page's pre-existing `extrapReach` sweeps **four** nodes and totals **4,752**; the recorded 1.19 % is over the **three** nodes that can clamp (vs 3-Bet's `N_eff` is the constant 2). The new section therefore takes its denominator from the sweep's own per-pair counts with the 3-bet rows dropped — 3,960 and 6,336 — rather than printing 0.99 % where METHODOLOGY records 1.19 %. The page's *existing* Known-weaknesses paragraph still prints 4,752 and no percentage, so nothing on screen contradicts anything; **lane F should know which denominator I48(c) is written against** |
| §10 Q1 (S1): 33 legal pairs at nine seats, the same three structural exclusions | **Confirmed on screen** — the Table size section's own row reads `UTG × vs Limps, UTG × vs Raise, BB × RFI` at *both* sizes, and `21 of 24` / `33 of 36` |
| §2.6: the toggle repaints inside the ON-default budget | **Confirmed**, p95 2.4–2.6 ms against 16 ms. The **first** toggle is 25.2–25.6 ms cold, which the p95 gate excludes by the same reasoning the ON/OFF rows use — recorded rather than smoothed |

### §10 Q3 — does the shell's fallback path (`window.POLICY` absent) need nine seats?

**No. Legacy-only by definition, and the answer is now structural rather than a decision.** `HAS_SEATS` requires `POL` (an injected policy exporting `seatsFor`, `nMax`, `positionDisabled`, `behindNonBlind`, `rhoAtSeats`) **and** `constants.ladder` in the shipped model; without them the control never renders and `S.seats` can only be 6. Three consequences, each checked:

- The six-seat literal S1 left at `src/shell.html:2187` is reachable only on a page with no policy, and on such a page the ladder cannot change — so it is a legacy fallback in fact, not merely in intent.
- `aggNested`'s fallback `nestChain(node, 6)` (S1's `:3202`) and the fallback `NNB`/`NBL` tables are dead the moment `POL` exists (`evaluate`, `rhoAt`, `eqAt`, `nEffRaw`, `realization`, `scoreOf` are all reassigned at `:3510`), and `applySeats` keeps `NNB`/`NBL` consistent anyway by calling `POL.behindNonBlind` / `POL.blindBehind` rather than re-deriving the formula.
- `readHash` refuses `&seats=9` when the axis is unavailable, so a nine-seat link opened on a policy-less build opens at six rather than at a size the page would then throw at.

---

## 5. Verification in this worktree

- `node scripts/verify.mjs` — **61 of 62 pass; D9 FAIL**, `index-full.html 668.3 KB/660 KB`. Expected: §3 items 1 and 5.
- `node --test test/*.test.mjs` — **704 pass, 4 fail**, all four in the byte-ceiling family and all four resolved by §3 items 1–6: `readPageCeilings passes on the tree as it stands`, `D9 PASSES on the shipped artifacts`, `lite carries the METHODOLOGY §9.11 budgets…`, `the shell carries five marked features…`. `test/ui-seats.test.mjs` — **17 of 17 pass**. (A fifth, `pageModel and pageEquilibrium read the built artifacts back`, appears only when `data/model.json` has been left dirty by a verify run — see §3 item 7 — and is absent from the committed tree.)
- `node scripts/build.mjs --check` — **0/2 current**, refused on budget, message in §3 item 1. The artifacts committed here are what the build produces; registering the block changes budgets and not bytes, so S3's rebuild is byte-identical and `--check` goes green on the registration alone.
- `node smoke.mjs` — **0/2**, one row each: the new 5b, red by construction with the ring absent. **The three morph rows are green and unmoved at 8 / 16 / 4 ms.**
- `node browsers.mjs` — **2/2 variants green**, chromium + Firefox + WebKit, F1–F4 all green; F4 reads `ring payload absent · control DISABLED with its reason · rail 6 -> 6 -> 6, clamp 7 -> 7` in every engine and will read `live, round-trips` once the payload lands. Headless, Playwright-managed throwaway profiles, no installed browser touched.

## 6. Residue, recorded

- The census sentence's worst-setting string prints the ladder **key** (`UTG1`) where the table above it prints the display name (`UTG+1`). Fixing it costs ~11 B of `appCore`, and `appCore` has 19 B of headroom in full; it was left rather than spent, and the ladder row of the same table is the key→name map. If S3 pays the `appCore` raise in §3 item 4, `seatLabel(pos)` goes back into `extrapReach`'s `at` string.
- `NMAX` at `src/shell.html:1181` (lane R's) and the `nEffMax()` clamp are two different numbers and stay so: `NMAX` describes the shape of `cells` and is 7 at both sizes; the clamp is `policy.nMax(seats)`. The Table size section says this out loud, which is I52's claim rendered rather than asserted.
- Mobile / narrow-viewport layout for nine chips is **out of scope** (§0.2). The topbar's existing media query hides the seat rail below the breakpoint, so nothing new breaks there; nothing new was designed for it either.
