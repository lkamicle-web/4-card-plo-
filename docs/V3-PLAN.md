# RUNDOWN v3 — PLAN

Scope agreed 2026-08-30, from [`docs/V3-BRIEF.md`](V3-BRIEF.md) and the planning session's survey
of the tree at `e6c6641` (verifier 44/44 green in 22.2 s, 224/224 tests, `build.mjs --check`
current). This document is the implementation hand-off: what v3 contains, why, in what order, and
what "done" means for each piece. It follows the same rules as [METHODOLOGY.md](METHODOLOGY.md):
the Monte Carlo layer is objective, the scoring layer is opinion, and every new constant gets
named, anchored, shipped in `constants`, and rendered by the Method view.

**Annotation convention.** Executors annotate this file in place as phases land, exactly as
V2-PLAN was annotated: `> **Measured (phase N).**` blocks under the prediction they confirm or
falsify, resolutions appended under the open questions, reversals recorded rather than edited
away. The plan text above the annotations is kept as written. Where this document and METHODOLOGY
disagree, **METHODOLOGY is right** — it is the living document; this is the plan as agreed.

**Organizing principle: the gate catalog is designed before the features, and every phase is named
by what it can falsify.** A v3 feature without an invariant asserting its claim is not done
(brief §8). This plan specifies v3 primarily as a table of claims that can fail (§7), and
secondarily as the code that makes them true.

---

## 0. Scope

### 0.1 In

Brief §6 work items **1–18**, every one placed in a phase in §4 (item 11 carries the plan's one
explicit conditional cut-line, with both reasons stated there). Plus, as plan-mandated
infrastructure:

- The five Phase 0 feasibility spikes (§1) and the rule that later spike-dependent phases are
  written as contracts + gates + decision rules, never fixed designs (locked 4.9).
- The payoff interface freeze (§2) — the unlock for all chain fan-out.
- The v2-fixture succession for I22 (§5.1).
- The full/lite dual build (§5.2, §5.3, §9).
- A **gate-registry refactor of `verify.mjs`** (129 KB of single-file gate code is itself a
  write-contention point once four lanes add gates): split into a `scripts/gates/` registry at
  Phase 0, gated on **identical output for the pre-existing 44 gates before and after** (plus
  I32/I33, which the B0 ordering lands just before the refactor), with a per-gate timing line and
  a soft wall-time ceiling so verification cost stays a measured, gated quantity like everything
  else in this repository.
- The METHODOLOGY repairs the brief mandates (§10): limitation 16, the §5.1 structural-limit
  note, the §5.2 story reconciliation, and the staleness fixes (the "46 gates" line, the
  pre-sub-cut payload tables, the dangling §12.4 reference).

### 0.2 Out — decided, not deferred by accident

- 7-max / 9-max seat ladders (locked 4.8; v4). No seat-ladder work, and no *deepening* of the
  6-max hard-coding either: new code keys off `N_NB`/`N_BL`/`NEST_CHAIN`, adding no fresh
  seat-name literals (`heroIP` and `derived()` are the existing offenders, not the pattern).
- Mobile / narrow-viewport layout (locked 4.7).
- 5-card PLO.
- Any constant without an anchor (brief §2.1) — unanchorable constants ship gated and flagged, or
  not at all.
- Hand-editing `index.html` — generated; edit `src/shell.html` and rebuild.
- Any regeneration of the existing measurement layer except the squeeze stage (item 11, if it
  survives its cut-line). Every other v3 model change is scoring/decision-layer or new-artifact
  work, so the v1/v2 streams stay bit-stable and D8/I24/I25 are untouched.

### 0.3 Non-negotiable carry-overs

The objective/opinion layer split stated on every surface; measured-vs-folklore conflicts shipped,
never suppressed (the `benchmarks.disputed` idiom); two independent engines for anything
objective; painted width, not target width, wherever a width is quoted; Method view renders
shipped data, never transcribed prose; MC stream discipline (new measurements get new streams);
`freeze-tiers.mjs` remains the sole fixture writer; the lite artifact stays one downloadable,
double-clickable, offline, end-to-end-readable file. Every phase ends with
`node scripts/verify.mjs` green (all gates pass), `node --test test/*.test.mjs` green, and
`node scripts/build.mjs --check` current (both variants once the dual build exists); commit at
phase boundaries, no pushes unless asked.

### 0.4 The v3 identity constraint (v2's I22-analogue) — the legacy-lane identity

Freeze `data/tiers-v2.fixture.txt` from the current green tree **before any v3 code**, sweeping
wider than v1's fixture: all 21 legal (pos, node) pairs × every integer v 25–90 × depth
{40, 100, 250} × rake {0, preset} × straddle {off, on} × villain profile OFF. The sweep contains
the v1 operating point (100bb / rake 0 / straddle off / random villains), so v1 identity is
carried **transitively** inside the v2 fixture, and I22 keeps running beside it (§5.1).

Every v3 mechanism must enter as one of exactly three shapes:

(a) a **new axis inert at legacy settings** — EV mode off, vs-GTO off, skill dial neutral, 3-bet
sizing at pot, profile OFF with object identity;
(b) a **new artifact** that changes no existing byte's meaning (`data/equilibrium.json`, the
calibration block);
(c) a **deliberate re-freeze**, performed only by `freeze-tiers.mjs --force` with the move-diff
printed and committed.

Default flips (item 8) change the page's *initial state*, never the semantics of the legacy
state, and happen at exactly one named barrier (B1, §12). This is gate **I32**, written first, and
it is what makes v3 safe to build incrementally: at any commit, the v2 product is provably still
inside v3.

---

## 1. Phase 0 — five feasibility spikes, parallel, isolated worktrees

All five run in parallel isolated worktrees: each writes only scratch files and its own new
prototype files, never `policy.mjs` / `src/shell.html` / `verify.mjs` / `model.json`, so no merge
can contaminate the frozen fixture tree. Each deliverable is a numbers memo whose conclusions the
later phases key on (locked 4.9). What Phase 0 falsifies: five assumptions the brief takes on
faith — convergence, estimability, data existence, one-source viability, toolchain value.

**S-A — CFR convergence.** *Question:* does CFR+ converge on the 123-cell abstraction over a
capped HU preflop tree (open/fold/3-bet/call/4-bet/jam cap), fed the 7,626-pair payoff matrix, and
how fast? *Method:* build the matrix from the existing eq machinery (checkdown payoff, labeled as
such — the spike tests solver mechanics, not payoff truth), run CFR+ recording exploitability per
iteration. *Deliverable:* convergence curve, wall time, memory, tree spec. *Success:*
exploitability ≤ 0.25% of pot within 120 s single-thread Node and ≤ 1 GB. *Failure:*
oscillation/plateau, or whole-cell strategies flapping between iterations (abstraction artifacts)
→ Phase 3 switches to an LP/regret-matching variant for HU, and 6-max MCCFR is descoped to a
stretch goal.

> **Measured (phase 0).** *Confirmed, with four orders of magnitude of headroom — the failure
> branch above does not fire.* CFR+ (alternating updates, linear averaging, exact best-response
> exploitability) reaches ε ≤ 0.25% of pot at **iteration 46 in 11 ms** — 0.009% of the 120 s
> budget, and **0.018% of the 60 s half-budget**, so §3.3's 6-max clause is met by a factor of
> 5,400. Peak rss **63.7 MB** against the 1 GB bar (the model's own working set is ~1 MB). ε falls
> at ≈ T^−1.75 over five decades with no knee, plateau or oscillation. **The named failure mode was
> checked, not assumed:** whole-cell argmax flapping is *absent* under CFR+ (zero flips across all
> 615 infosets for the last 98,423 of 100,000 iterations) and *present* under a vanilla-CFR control,
> still flipping at iteration 99,467 — a difference in kind, and the reason §3.3 must specify CFR+
> rather than CFR. Correctness has four independent checks including an analytic ground truth (with
> `E ≡ 0.5` the game is blind economics with true value exactly 0 and Nash = SB opens 100%; solved
> −6.3e-8 bb, open 100.0000%). **Two findings beyond the verdict.** (1) *The tree this spec asks for
> is illegal in pot-limit*: at 100bb, facing a 27bb 4-bet, BB's maximum legal raise is 81, so "jam"
> is not an available action — a NLHE-shaped preflop tree does not port to PLO. The deliverable is
> the pot-limit maximum ladder **3/9/27/81**, solved at both 100bb and 40bb (5 decision nodes, 9
> terminals, 615 infosets, 1,599 action slots). (2) *A sampling-measure bug, found and fixed*:
> redrawing a cell's combo on a board collision weights every board equally instead of weighting a
> board by how many cell-*i* hands it leaves alive, and read **+1.16 pts high on average, +5.33 pts
> high on RUN0_HIGH|RB** — a bias larger than every effect v3 intends to model. P2 inherits the hard
> rule: every payoff sampler must reproduce the shipped `eq[1]` column before its numbers are
> believed. Memo: [`docs/spikes/S-A.md`](spikes/S-A.md).

**S-B — payoff estimator cost + error. The program's load-bearing spike.** *Question:* can
`payoff(cells, potSize, spr)` be estimated at acceptable cost, with what error vs street-simulated
ground truth? *Method:* prototype 2–3 estimator forms (checkdown + realization curve; one-street
rollout with a threshold stack-off policy; flop-equity-distribution buckets); compare against a
slow full-street MC reference on ~50 stratified pairs × spr ∈ {1, 4, 10}, chosen to include the
known stress cases (RUN0_LOW×DS, BROADWAY_RUN×RB, AA_DANGLER×RB). *Deliverable:* error table
(mean/p95/max in pot-fraction points), sensitivity of each form to its own opinion knobs, and the
cost of the full 7,626-pair × spr-grid precompute against the 6-minute pipeline budget.
*Success:* p95 ≤ 2.5 pts and precompute ≤ 6 min. *Explicit decision rules (the three-band rule):*
p95 ≤ 2.5 → payoff ships measurement-anchored (**Grade A**); 2.5–5.0 → payoff ships
`estimate`-badged and EV primacy is off the table for v3 — 4.4 fails closed (**Grade B**);
> 5.0 → the solver runs on checkdown payoff wearing the "a game where postflop does not exist"
label on-screen, and the B2 barrier decides whether vs-GTO ships caveated or not at all
(**Grade C**). §3.6 pre-writes what ships in each band, so a bad result degrades the program and
never stalls it.

> **Measured (phase 0).** *Falsified — both success criteria fail and the three-band rule lands on
> **Grade C**.* Best held-out p95 = **7.21** pot-fraction points (form 2R, one-street rollout +
> fitted curve); best *budget-affordable* held-out p95 = **8.01** (form 3R). Both exceed the
> pre-registered 5.0 edge, and **nothing tested reached 5.0 at any price**. Cost agrees
> independently: the forms that come closest cost **1.5–5.1×** the pipeline budget and the forms
> that fit it are the worst performers. The budget is not six minutes of any laptop but
> METHODOLOGY's recorded 172 s on four workers = **688 cpu-seconds**, which buys 208 reference
> deals/pair (se ≈ 3.70 pt): *a street-simulated payoff that fits the pipeline carries an se larger
> than the Grade A edge before any modelling error is counted.* **Error is dominated by one term.**
> Collapsing IP/OOP, position-averaged p95 is **3.39** — Grade B territory. It is the positional
> *gap* that nothing estimates: the reference's mean |IP−OOP| is 1.72 pt at spr 1 but **23.86 pt at
> spr 10** (max 43.46), and the best form still misses it with p95 10.89. Position enters the frozen
> interface through `opts.ip`, and it is exactly the argument no estimator serves. **The reference is
> itself an opinion layer, and that is the load-bearing caveat:** two of REF3's five knobs move the
> "ground truth" by more than the Grade A/B edge (`bluffT` p95 5.81, `betFrac` p95 4.44), so a
> p95 ≤ 2.5 verdict was unsupportable from a policy-based reference *no matter how the estimators
> performed*. **Grade A is blocked by the reference, not the estimator**, and needs a postflop-solver
> reference — v4 scope. *§6's mandatory pre-registration audit, reported beside the p95:* stub
> payoff `se` **0.1581 pt** (shipped `meta.se.cell` 0.16 agrees); smallest EV difference that moves
> a tier **0.1405 pt** predicate-reading / **0.1274 pt** ordering-reading. The 2.5 pt edge is
> **15.8×** the stub se and **17.8×** the median tier-move — a granularity mismatch **recorded as a
> finding, not redrawn**, because at the consequence level the edges are sound: 2.5 pt ≈ 7.5% of
> cells changing side of the aggressive cut, 5.0 pt ≈ 13.9%, the measured best form **19.0%**.
> Memo: [`docs/spikes/S-B.md`](spikes/S-B.md).

**S-C — hand-history data.** *Question:* does usable 4-card PLO hand-history data exist (volume,
hole-card visibility, licensing), and what would calibration actually fit? *Method:* inventory
sources, parse a sample, count per-cell showdown coverage, run the power analysis (hands needed
per cell/band for a ±bb/100 that can discriminate orderings — PLO variance is enormous; expect
band-level, not cell-level, resolution). *Deliverable:* corpus memo + parser prototype +
**pre-registered primacy criteria**: the exact out-of-sample statistic by which EV-ordering would
beat score-ordering, written down before any EV number exists, so the bar can never be lowered
post hoc. *Success:* ≥ ~1M parsed hands with ≥ 100 showdowns in ≥ 80 cells. *Failure:* Phase 5
ships the calibration harness + self-play consistency only, EV stays secondary permanently, and
METHODOLOGY §10 gains "the decision layer remains unfalsified against money" as a standing
limitation rendered in the Method view — a shipped sentence, not a silent gap.

> **Measured (phase 0).** *Falsified — the failure branch fires and §3.6's S-C row is taken
> verbatim.* **The success criterion as written is MET, and is overruled rather than redrawn.** At
> 1M hands a datamined corpus reaches **118 of 123 cells with ≥ 100 showdowns**, so the showdown
> clause passes — on data whose every hole card is *outcome-selected*. It is a counting test
> passable by a corpus that is structurally unable to answer the question; the acquisition and power
> conjuncts overrule it, and **the repair for future spikes is to count hero rows, not showdowns.**
> *Power (two-sided α = .05, power .80, σ = 140 bb/100):* this section's "band-level, not cell-level"
> prediction is **confirmed with a number** — the MDE at the plan's 1M bar is **10 bb/100 for a whole
> band, 120 bb/100 for the median cell, 295 for a median (cell, pos)**. Separating cells by 5 bb/100
> needs **578M dealt hands**; the paired ordering test needs **6M–77M hero hands = 6–77 years of one
> player's full-time play**. *Resolution, from shipped data alone:* of the 122 adjacent cell pairs by
> shipped HU checkdown equity, **87 (71%) are separated by less than 2·`meta.se.cell`** — already
> inseparable by the measurement RUNDOWN ships, before money and its ~100× larger noise enter. A
> 34M-hand corpus would also be 35–70 GB, which no single-file artifact can carry. **The deliverable
> that survives is the bar itself:** the pre-registered primacy criteria **PC-0..PC-8** are written
> verbatim into `scripts/gates/reserved.mjs` as I46's fixed bar and reproduced in the memo, the two
> copies byte-compared. PC-1/PC-2/PC-3 are unsatisfiable today and PC-0 is failure-closed, so **I46
> is unpassable by construction — parked, not lowered**, and comes alive unchanged the day a
> conforming corpus exists. *One finding the plan should absorb:* the observational framing was the
> wrong question — **no corpus size fixes PC-3, because you cannot read the EV of an action nobody
> took.** The only design that satisfies these criteria is a prospective randomised A/B test on the
> marginal cells, run by a player against their own play; named here as the successor experiment
> rather than left implicit, and out of scope for v3. Memo: [`docs/spikes/S-C.md`](spikes/S-C.md).

**S-D — full/lite split cost.** *Question:* is one source + feature flags viable? *Method:*
prototype `--variant=lite` in `build.mjs` (the `@inject`-marker seam plus `@only:` markup
markers), build both artifacts, run per-variant `--check`. *Deliverable:* working diff,
per-variant byte table, and the complete list of gates needing per-build scoping (D6/D7/D8, the
`fetch(`/`src=` refusals, §9.11's honest-claim sentence). *Success:* both artifacts deterministic
and byte-comparable. *Failure:* markup divergence proves invasive → **degrade, don't stop**: the
*full* build is constrained to lite-plus-injected-blocks (lite is the non-negotiable artifact per
4.2; full is the one that flexes) until real divergence machinery earns its way in. The worktree
must not leave a half-split build on the main tree.

> **Measured (phase 0).** *Confirmed — 28/28 harness checks pass, both artifacts deterministic and
> byte-comparable, so the failure branch does not fire and the full build is **not** constrained to
> lite-plus-injected-blocks.* **Inertness is the claim that mattered and it holds exactly:**
> `--variant=lite` over an *unmodified* `src/shell.html` differs from the pre-spike `index.html` by
> **+127 B, every byte of it the provenance banner** — the page body after the banner is
> **sha256-identical**. Byte table: lite **482.2 KB**, full **548.5 KB**, and only **0.5 KB of the
> 66.3 KB divergence is app code**; the rest is payload. Source cost is six seams — **3,316 B in a
> 414 KB shell (0.78%)**. The dual build is free: lite 103 ms, full 105 ms, both variants plus both
> `--check`s ≈ 415 ms, each `--check` reporting STALE against the other's artifact *and naming which
> one it found*. Every refusal fires: `fetch(` and `<script src=>` inside a full-only block while
> building lite, unwrapped `@inject:eq`, marker typos, unclosed / stray / nested `@only:`, and
> `--variant=medium`. **One measured gap, asserted in the harness so the finding cannot rot:**
> lite-visible code calling a full-only symbol **builds clean and ships the dangling call** — which
> is why the per-variant *smoke* run, not the per-variant `--check`, is the thing that catches it.
> **One named blocker carried forward:** full's size budgets are unanchored, so the build prints
> SIZE NOT GATED and pins `VARIANTS.full.budgets === null` by test to make the flip deliberate; D9
> sets it from the first real `data/equilibrium.json` at measured + 5% after P3, and must refuse a
> payload carrying `meta.synthetic: true`. Memo: [`docs/spikes/S-D.md`](spikes/S-D.md).

**S-E — what opening the toolchain buys.** *Question:* concretely, what is worth the identity
cost? *Method:* add `package.json` (no `"type"` field — preserves `.mjs`/`.js` semantics
repo-wide, and `sim-kernel.js`/`sim-worker.js` are deliberately classic scripts) with Playwright
as the only devDependency; get `smoke.mjs` green (headless, temp profiles only — never installed
browsers); then audit the wish list (bundler? TS? test framework?) against the known breakage
surface: `mc.mjs` self-spawning via `import.meta.url`, the `import.meta.url === argv[1]` CLI
detection, and jsmin's hand-authored-JS assumption all break under transpilation. *Deliverable:*
smoke output + a buy-list with per-item verdicts (each adoption needs a named consumer; default
answer for everything except Playwright is no) + the re-scoped rule drafted for METHODOLOGY:
**dependencies are dev-time only; both shipped artifacts and the generator remain
runtime-dependency-free.** *Success:* smoke green. *Failure branch that is a finding, not a
blocker:* **prediction, expected falsified — the 8 ms slider-morph p95 budget fails on first
re-run** (unmeasured since v1; the page has grown two model layers since). If it fires, the budget
is retuned to the measurement and pinned, not quietly widened.

> **Measured (phase 0).** *Smoke green enough to pass (**11/12**, deterministic over three runs);
> buy-list = **Playwright only**; and the prediction above is falsified — **but not in the direction
> predicted**.* Toolchain cost: `npm install` **1.90 s, 2 packages**, `package.json` 23 lines +
> `package-lock.json` 66 lines, **zero source files touched**, and all three checks byte-identical
> to baseline with `package.json` and `node_modules` present. **The three declines are now
> measurements rather than taste, and one is disqualifying on its own:** `esbuild --format=cjs`
> rewrites `import.meta`, so `verify.mjs`'s `import.meta.url === file://${argv[1]}` CLI detection
> **silently does not fire — the verifier exits 0 having run zero gates**, with no error and no
> warning. A toolchain that can turn the gate runner into a no-op cannot enter a repository whose
> whole discipline is "gates are written to FAIL". (TypeScript cannot be adopted at all without
> renaming `.mjs`; `tsc --checkJs` over the scripts yields 81 errors of which **zero are real
> defects**.) **The morph budget: the prediction was that 8 ms fails on first re-run; the
> measurement is that the budget is UNFALSIFIABLE.** `__measureMorph` times a JS-only pass whose p95
> is **0.100 ms — exactly one tick of Chromium's 100 µs clock** — so the gate cannot distinguish
> today's page from one 80× slower. Retuning to the measurement therefore means **tightening**:
> include a forced style+layout flush (measured p95 **2.700 ms**, max 5.500 over 528 passes) and set
> the budget to **4.0 ms** — measured p95 + ~50%, the same measured+headroom rule the byte budgets
> use. Do *not* keep 8 ms against the JS-only metric and call it green. That edit lives in
> `src/shell.html`, which the spike worktree may not touch, so it belongs to §8's UI workstream and
> lands with the S-gate re-arming (deferred to P1-U). **Smoke's one red is a shipped-page defect,
> not a toolchain verdict:** the topbar's intrinsic width is **1443 px against a 1279 px
> breakpoint**, so at every viewport in **1280–1442** the Drill, Guide, Settings and Info buttons sit
> outside the viewport, clipped by `body{overflow-x:hidden}` — invisible and unclickable, identical
> to the pixel in Chromium, Firefox and WebKit. 1280×800 and 1366×768 are both inside the band.
> Memo: [`docs/spikes/S-E.md`](spikes/S-E.md).

> **Measured (P2 pre-stage).** *The 4.0 ms row above is correct and was being read against the
> wrong page.* It was measured with the **villain profile off**; barrier **B1** made *on* the load
> default, and `smoke.mjs` went red on that one row at HEAD — p95 12.1–16.3 ms, median ~10.7 over
> five runs. **The P1 red team's "cold sweep" diagnosis is withdrawn**: it was taken on a pre-flip
> page, where it is right, and it does not describe this one. The cause, measured by instrumenting
> `POLICY.solve` from the harness, is that the ribbon **is** profile-dependent — `curveKey` carries
> `vpKey()`, and the profile's *v* **is** the table-VPIP slider — so with the profile on every
> slider step asks for a curve the page has not got and re-solves all 66 VPIP points, **70 solves a
> step**; with it off `vpKey()` is the constant `'OFF'`, `curveKey` never mentions the slider, and
> the same sweep is free. Two one-entry memos were what turned that into a permanent cost. Both are
> now **bounded books**: the shadow model's inside `POLICY.profiledModel` (where the P1 hoist put
> the construction, so `tier-fixture-v3` and I43 get it too), the curve's in the page. The page's
> duplicate `emodel()` construction — the deletion the P1 hoist queued — is **gone**, which is where
> the ~0.8 KB this cost the `app` block came from. After: profile-on median **1.20–1.30 ms**, p95
> **10.50–10.80** over eleven runs; profile-off unchanged at median ~1.0, p95 1.6–2.0. **The first
> visit to each VPIP did not move and could not** — 10.8 median before, 10.7 after — because caching
> cannot make a first answer cheaper and those 66 solves are work the profile genuinely asks for.
> **So the row is split in two rather than widened.** The 4.0 ms budget keeps its S-E anchor and
> `smoke.mjs` now drives the page **into the OFF state through its own toggle** to measure what that
> number was measured on; a **second row, 16 ms**, is pinned on the shipping default — worst observed
> p95 10.80 + ~48% = 15.98, the same measured+headroom rule the byte budgets use.
> **16 is not 4.0 with slack**: it is a measurement of a different state, and it is gated on p95 for
> the reason the OFF row is. Each row asserts the profile state it claims to have measured, from
> `vpKey()`, so a toggle that stops working fails a row instead of quietly measuring OFF twice.
> **Not raised, and left to P3:** the `app` byte ceiling (360 KB; headroom went 83 B → 901 B on the
> deletion, so this step gave bytes back rather than asking for them — METHODOLOGY §9.11 is owed
> that paragraph when P3 makes the raise-vs-shrink decision).

**Phase 0 also (the B0 deliverables, on the main tree, serial):**

1. Freeze `data/tiers-v2.fixture.txt` (gate **I32**), with I22 still green beside it — succession
   proven, not assumed (§5.1).
2. Freeze the payoff interface (§2) and land the checkdown stub + gate **I33**.
3. The `scripts/gates/` registry refactor, gated on identical output for the pre-existing 44
   gates (plus I32/I33, landed just before it).
4. Draft the full §7 gate catalog with reserved ids, and write S-C's pre-registered primacy
   criteria into it (I46) before any EV number exists.

---

## 2. The payoff interface freeze (the unlock)

`scripts/lib/payoff.mjs`, frozen at the end of Phase 0, present in both builds. Nothing in the
chain (estimator, solver, EV cut, EV UI) may start before this gate is green; once it is, all
four fan out against the stub (brief §7).

```js
payoff(cells, potSize, spr, opts) → {
  ev,        // hero's expected final-pot share, pot fraction in [0,1]
  se,        // one standard error, same unit — never absent, derived from real trial counts
  source,    // 'checkdown' | 'model' | 'simulated'
  supported, // false ⇒ ev is the checkdown fallback; request is outside the measured domain
}
```

Semantics: `cells` = cell keys, hero first (HU length 2; the array is the multiway door — a
multiway request may return `supported:false`, never a guess). `potSize` in current-unit bb
(straddle-aware via `unitBB(env)`); `spr` = effective stack ÷ potSize at the decision node.
`opts` = `{ ip: boolean, seed }` — **position enters through the argument, never through global
state.** `ev` is unit-pure (pot fractions); bb conversion (`EVbb = ev·finalPot − invested`) is
caller arithmetic, so rake and depth enter the *number* via the existing exact machinery
(`rakeFraction`, `unitBB`) rather than being re-modeled inside the payoff. Pure function of
(args, model hash) — memoizable only with every argument in the key (the `envKey` docstring rule,
extended). Out-of-domain never throws and never returns an unflagged number.

**The stub** returns shipped `eq[N]` at every spr (`source:'checkdown'`, `se` from the shipped
trial counts) — honestly the game the current measurement already describes — and unblocks the
CFR engine, the EV presentation, the EV cut, and the inspector simultaneously, without waiting
for S-B's winner.

> **Measured (phase 0, B0 step 2).** *The stub as written above cannot pass clause (b), and the
> refinement is recorded rather than edited away.* `eq` is measured against RANDOM opponents, so it
> carries no villain identity and `eq_A + eq_B ≠ 1` for almost every pair; returning it literally
> heads-up violates the zero-sum clause on **15,006 of 15,006 ordered pairs** (measured by breaking
> `payoff.mjs` back to the literal form and reading I33's own diagnostic). The two clauses are
> jointly satisfiable only if the stub conserves, so the heads-up stub returns the **zero-sum
> projection of the same shipped measurement**, `ev = 0.5 + (eq_A[0] − eq_B[0])/200` — the average
> of two readings of one quantity, built from shipped numbers only, **zero new constants**, and
> conserving to the last bit (I33(b) therefore asserts `= 1` exactly where §2 asked for `1 ± 2·se`).
> It is still checkdown and says so in `source`. Multiway takes no projection — there is no pair to
> project onto — so it returns hero's shipped `eq[N−1]` flagged `supported:false`: a number,
> flagged, never a guess presented as supported. **Consequence for downstream badges:** heads-up is
> `supported:true` today even though villain identity is unmeasured, so the checkdown honesty rides
> entirely on `source`. I35's Grade-C label must key off `source === 'checkdown'`, never off
> `supported`, or it will silently upgrade the checkdown game to a solved one.

**Gate I33 pins the freeze:**
(a) a unit test freezing arity, key names, and value types — the freeze is a test, not a doc;
(b) **zero-sum/conservation as an explicit clause**: HU, `ev(A,B) + ev(B,A) = 1 ± 2·se` over
shared deals;
(c) spr→0 identity: any non-stub source equals checkdown eq within MC error at spr = 0;
(d) `se > 0` always, derived from the trial count that actually ran, never typed;
(e) a **grep gate**: CFR, the EV cut, and the UI consume payoffs *only* through this accessor —
no consumer reads a payoff table directly (the taxonomy-absent-from-worker idiom);
(f) a page-side check that no caller renders a `supported:false` ev without the badge (the
fabricated-payload-assertion idiom — pin the limitation so prose can't upgrade it).

One clause written to be falsified: **ev monotone in checkdown equity at fixed spr** — the
prediction is that high-cooler hands break this at spr ≥ 4, and that break is the payoff model
*working* (realization is exactly what checkdown equity doesn't measure). When it fails, rewrite
the clause to the measurement per house style.

> **Amended (P2 pre-stage).** *The freeze above is kept as written; this is the ceremony that
> changes it, done once, in the open, with gate I33 rewritten in the same step.* §3.2's Measured
> block named three amendments the freeze needs before P2 consumes it, each measured by spike S-B.
> All three are now in `scripts/lib/payoff.mjs`'s header contract, in I33's clause text, and in the
> page's mirrored `@payoff-page` copy. **Zero new constants.**
>
> **(i) `payoff()` returns SIX keys, not four:** `potMult` and `invShare` are appended after
> `supported` (appended, never interleaved — `test/ui-payoff-mirror.test.mjs` pins key ORDER).
> `EVbb = ev·finalPot − invested` is caller arithmetic that cannot be done from `ev` alone: S-B
> measured `E[F]/potSize` at **1.603–11.865** and hero's share of `E[F]` at **0.199–0.730** over 300
> points, so a caller assuming `finalPot = potSize` is wrong in the pot term by up to an order of
> magnitude. The caller's arithmetic in full is `finalPot = potMult·potSize`,
> `invested = heroPre + invShare·finalPot`, `EVbb = ev·finalPot − invested`. **The stub's two
> values are identities, not choices:** checkdown means no betting after the decision node, so
> `E[F] = potSize` and `potMult === 1` exactly at every spr, and hero invests nothing after the node
> so `invShare === 0` exactly. I33 asserts both by `Object.is` over the named paths and all 15,006
> ordered heads-up pairs, so the first source that MOVES them is measured against a pinned baseline.
> **The finding from (i), recorded rather than patched away:** S-B's `invShare` is
> `E[hero invested TOTAL]/E[F]`, and its *total* includes a pre-node part that REF3 supplies by
> NORMALISATION (`pot = 1`, `c0 = c1 = 0.5` in `playRef`) rather than by measurement — a symmetric
> split is an assumption about the node, not a property of it. The four frozen arguments carry
> `potSize` but **not hero's share of it**, so the pre-node half is not a function of (arguments,
> model) and cannot honestly be returned. This interface therefore returns the **post-node** half,
> `invShare = E[hero's investment AFTER the node]/E[F]` — S-B's own quantity minus its reference
> normalisation, never a typed split — and the caller owes the `heroPre` term, which it knows
> because it built the node. Conversion back to S-B's reading is exact:
> `total = heroPre/finalPot + invShare`. **The signature's arity stays four**; if a future source
> needs `heroPre` for itself, `opts` is the door §2 froze for exactly that.
>
> **(ii) `opts.ip` enters EVERY memo key**, named beside `cells`, `potSize`, `spr`, `opts.seed` and
> the model hash. `payoff.mjs` deliberately has no memo, so this is an amendment to the CONTRACT and
> its gate: **I33 clause (g)** is a comment-stripped text scan (the `payoff.mjs` header is a thousand
> words *about* memo keys and would otherwise clear the clause by discussing it), scoped by filename
> over `scripts/` and `src/` on its own `/payoff|cfr|solver|equilib|ev-cut/` — **not** clause (e)'s
> `CONSUMER`, which demands the file *import* `payoff.mjs` and which `payoff.mjs` can never satisfy —
> plus the shell's `@payoff-page` block named explicitly. It is armed against a fabricated memoizing
> wrapper that omits `ip` and cleared by one that includes it, and it will cover P2's `cfr.mjs` /
> `payoff-model.mjs` and P4's EV cut the day they appear. A dynamic aliasing probe runs beside it
> (a keyless memo hands the same OBJECT back for `ip` on and off), with its own limit stated: a memo
> that CLONES its cached value evades the probe, so the text clause is the load-bearing one. The
> anchor: S-B measured `ev(A,B,ip) ≠ ev(A,B,¬ip)` **by up to 43 pt** while `ev(A,B,ip) +
> ev(B,A,¬ip) = 1` holds exactly, so a keyless memo is wrong by more than the whole error budget
> (the Grade A edge is 2.5 pt) and wrong silently — the `envKey` docstring's trap in a new place.
>
> **(iii) `supported:false` gains the CARD-REMOVAL clause.** Its real domain is shared-rank
> degeneracy, not multiway: cells pinning the same ranks make some (cell, cell, board) triples
> impossible from the observer's seat. `AA_DANGLER|RB` × `AA_BIGPAIR|DS` is degenerate on **12.56%**
> of street evaluations, mean **0.73%** over 50 pairs, **4/50 over 1%**; S-A independently found
> **43 structurally undealable pairs**, all `AA_*` × `A_BLOCKED`, combo mass 3.6e-5. The failure mode
> is SILENT — S-B's first implementation dead-carded the range against the opponent's actual hand and
> collapsed every AA-vs-AA pair to a checkdown with no error raised. **The clause:** any source that
> evaluates against DEALT BOARDS must surface degeneracy honestly — an undealable or degenerate
> request returns `supported:false`, which is what "flagged" MEANS in a six-key return carrying no
> mass field, never a silent collapse to checkdown. The stub deals nothing and is **exempt by
> construction**, keyed on the shipped `source` datum and checked rather than assumed. **I33 clause
> (h)** pins the two families structurally over the live cells (504 ordered pairs of 123 cells) and is
> armed against a fabricated collapser — the checkdown answer relabelled `'simulated'`, still
> `supported:true` — which it must catch on *every* degenerate pair, while the honest form clears and
> neither fires on a non-degenerate control.
>
> **The monotonicity clause, rewritten to the measurement per house style — not deleted, not
> widened.** §3.2's Measured block records the falsification: inversions on **1.7% of pairs at
> spr 1, 8.1% at spr 4, 15.9% IP / 20.5% OOP at spr 10**, worst case **9.1 pt LESS** checkdown equity
> for **20.0 pt MORE** ev. The clause is now two assertions split by `source`: **`checkdown` must
> show ZERO inversions** — the stub is strictly increasing in hero's checkdown equity by
> construction, and that half stays asserted because it is what catches the stub quietly ceasing to
> be the stub — while **any non-checkdown source at spr ≥ 4 must show inversions > 0**, since
> realization is exactly what checkdown equity does not measure and a source reproducing the
> checkdown ORDER perfectly is not modelling it. **Zero inversions from a source claiming to model
> realization is the new failure.** No upper bound is asserted and spr 1's 1.7% is not a floor: S-B's
> band is *reported* in the gate's detail line, never used as a tolerance, because 50 pairs cannot
> license one. Armed both ways — the stub relabelled `'model'` is flagged; a `'model'` that actually
> perturbs the order at spr ≥ 4 clears.
>
> **Untouched by the ceremony:** the four arguments, the `source` enum, clauses (b), (d), (e) and
> (f), I22/I32/I43 and the tier fixtures (`payoff.mjs` is not on the tier path). Clause (c) gains one
> zero-constant half — at spr 0 the effective stack is empty, so **no source** may report
> `potMult ≠ 1` or `invShare ≠ 0` there (S-B verified the companion half: spr 0 reproduces checkdown
> equity with delta exactly 0).

> **Measured (P3 B2) — the payoff marriage: the accessor gains a SECOND ROUTE and three clauses were
> rewritten to what it does.** *The freeze and the P2 amendment above are kept as written; this is
> the later measurement and it wins where they disagree.* P3's solver consumes the MEASURED PAIRWISE
> CHECKDOWN MATRIX (§3.3's `Adjudicated (P3 launch)` block, decision 9), and barrier B2 says it may
> not until I33 passes **on that source**. It does. **Zero new constants**, **no seventh key**, **no
> arity change**: the matrix arrives as an argument to `makeMatrixPayoff(model, matrices)` — the pure
> side's second door, below the `@browser-cut`, so the page's mirrored `@payoff-page` copy does not
> move by a byte and the lite app block stays at **359.1 KB** exactly (measured by `--check`;
> `build.mjs` inlines only `policy.mjs` and `taxonomy.mjs`, so the route costs the page nothing above
> or below the cut).
>
> **THE SOURCE.** `scripts/lib/checkdown-matrix.mjs`, S-A's `sa-matrix.mjs` ported verbatim in its
> arithmetic: shared boards, **one draw per cell per board with a sit-out on collision** (S-A's
> corrected measure — redraw-on-collision read **+1.16 pt** high on average and **+5.33 pt** on
> `RUN0_HIGH|RB`), diagonals exactly 0.5, off-diagonals stored once and mirrored. **25,000 boards**,
> the TOP of S-A's measured 12.5k–25k band, under two seeds NAMED before anything was solved on them:
> `rundown-v3/checkdown-A` and `rundown-v3/checkdown-B`. **1.65 s and 1.65 s** to build, 3.3 s for the
> pair, held once per process; verify's wall goes **26.3 s → 30.3 s**, 72% of the 41.9 s soft ceiling.
> One datum S-A did not keep is added and it is the only addition: a **per-cell live-board count**, so
> the diagonal's `se` has an honest *n* (I33(d) forbids a typed one). It touches `E` nowhere.
>
> **THE VALIDATION, before use, per S-A's own rule** (`test/checkdown-matrix.test.mjs`, on the shipped
> seeds). Antisymmetry **0** and diagonal **0** — to the bit, structurally. Conservation
> **50.000000%** on both. Residual of the q-weighted marginal against the shipped `eq[0]` column, in
> points: **A mean −0.101 / p95 0.779 / max 0.893**, **B mean −0.052 / 0.627 / 0.883**, against S-A's
> **−0.112 / 0.577 / 0.827** at 400k boards. The sign pattern is S-A's and it is robust as a
> **family mean**, not per cell: the four ace-holding families (`BIGPAIR_ACE`, `ACE_JUNK`,
> `SMPAIR_ACE`, `ACE_RUN3`, 20 cells) read **−0.460** pt (A) / **−0.288** pt (B) against **−0.032** /
> **−0.007** for the other 103. **43** structurally undealable pairs on both seeds, the same set, combo
> mass **3.584e-5**. Per-entry `se` from the two independent samples **0.575 pt** (rms|A−B| 0.815 over
> 7,460 measured pairs), against binomial arithmetic's prediction of 0.859 rms at the observed counts
> and against S-A's **0.143 pt** at 400k — noisier by ~4×, exactly as boards^−½ says it must be.
>
> **THE TRAP THAT ALMOST MADE I33 GREEN FOR THE WRONG REASON, recorded because it is the finding a
> reader would otherwise never see.** The matrix **is** checkdown — it is hero's share at showdown with
> no postflop betting — so it answers `source:'checkdown'`, and clauses **(c)**, **(h)** and **(mono)**
> all keyed their exemptions on exactly that string. Run as written, all three would have cleared
> **VACUOUSLY** over the one source they were written for. Each is now keyed on a `route` tag —
> `'projection'` | `'matrix'`, a function property beside `modelHash`, never a return key — and **the
> tag itself is armed**: the matrix relabelled `'projection'` is caught by (mono) on its 55 inversions
> and silently re-exempted from (h), and the projection relabelled `'matrix'` is caught for
> reproducing the equity order perfectly. An absent tag reads as `'projection'`, so forgetting it
> fails closed.
>
> **THE THREE REWRITES, in their shipped wording.**
>
> **(c) — the spr→0 identity.** *A pairwise checkdown source is compared to the shipped column by its
> Q-WEIGHTED MARGINAL, not by equality.* §2's "equals checkdown eq at spr 0" is false of any honest
> pairwise measurement, and the gap has a name: the shipped number conditions villain on hero's cards
> being dead and `sum_j q_j E_ij` uses the raw combo marginal, so the residual **is** the card-removal
> residual. The band is **REPORTED** (mean / p95 / max, with S-A's beside it) and **NEVER ASSERTED** —
> one spike's table cannot license a tolerance. What is asserted is the **SIGN PATTERN** (ace families
> below the rest) and **CONSERVATION** (combo-weighted mean 50 within the `n²·EPSILON` accumulation
> bound). Armed **deterministically** both ways: a source that cancels its own residual and reproduces
> the column exactly is flagged, and so is one carrying the same band with no family structure.
>
> **(h) — card removal, and its FIRST LIVE CASE.** The stub deals nothing and was exempt *by
> construction*; this route deals 25,000 boards. **43 unordered / 86 ordered** pairs come back
> `supported:false`, carrying the **stored 0.5** (which conserves bit-exactly and keeps the mirror
> residual at ulp level) and `se = Infinity` at *n* = 0 — the shipped `seOfTrials(0)` convention, never
> a typed floor. The count is not typed into the gate: the expected set is the **measurement's own**
> `meta.impossiblePairs`, and what is asserted structurally is that every member asks the deck for five
> or six aces. **AND THE OTHER HALF, which the old clause could not express:** the **420 ordered**
> `AA_*` × `AA_*` pairs are **DEALABLE** and stay `supported:true` with a **2.21× larger** mean `se`
> from their own smaller sample (disjoint rate 0.071–0.155 against 0.677 typical, 1,563 samples against
> 7,325) — *that* is degeneracy surfaced, when the pair is dealable: the cost lands in the error bar,
> not in a false flag.
>
> **(mono) — split by ROUTE, not by `source`.** The old checkdown half required **zero inversions**,
> and it was written for a source that is **exactly separable**: the projection's
> `ev(A,B) − 0.5 = (a_A − a_B)/2` to 1.1e-16. A measured pairwise matrix is checkdown and **not**
> separable — it knows who the villain is — so hero's ev against a fixed villain need not follow hero's
> equity against the field. Measured: **55 of 122 steps invert** at every spr against `AA_BIGPAIR|RB`,
> worst 0.2807 (440 of 976 over the whole spr × ip sweep). The count is **REPORTED and bounded by no
> tolerance**; what is asserted is that it is **not zero**, because zero would mean the matrix had
> become separable — i.e. had stopped being the thing the projection is not. The projection keeps its
> zero, by identity.
>
> **A CLAUSE FIRED THAT WAS NOT PREDICTED, and the predicate is rewritten to the measurement.**
> S-A's memo describes its 43 undealable pairs as "AA_* × A_BLOCKED — six aces". The matrix says **42**
> of them are, and the **43rd is `A_BLOCKED|RB` × `A_BLOCKED|SSA`**. `A_BLOCKED` is the taxonomy's
> **"Trip/quad aces"** (`rowOf` returns it on `aces >= 3`), so two such cells pin **six** aces between
> them — and I33(h)'s `isDegeneratePair` excluded exactly that pair, with `test/payoff.test.mjs`
> asserting the exclusion under the reason *"one ace each is two aces, which is dealable"*, which is a
> false statement about the taxonomy. The predicate is now an **ace-floor SUM ≥ 4** (`A_BLOCKED` 3,
> `AA_*` 2, everything else 0), derived from the cascade rather than restating a family list that had
> already been wrong once. Consequence, recorded: the degenerate scope grows from **504 to 506** ordered
> pairs over the 123 live cells; `payoff-model.mjs`'s local copy and its test move with it (that module
> stays `ENABLED=false` and unwired). Nothing else fired that was not predicted.
>
> **THE SHIPPED COUNT AND THE ARTIFACT (P3 relaunch — see §3.3's `Adjudicated (P3 relaunch)` block).**
> Everything measured above was measured on **25,000-board** matrices built inside `verify.mjs`, and
> it stands as the record of that run. What ships is the same construction at **400,000 boards per
> seed** — the regime `solver.twoSeedTolPot`'s own anchor was measured at — read from a generated,
> committed artifact, **`data/checkdown-matrix.json`** (307 KB, integers only, `E = (wins2/2)/cnt`
> reconstructed bit-identically), written once by `scripts/generate-checkdown-matrix.mjs` and never
> built during a verify run. The clause rewrites above are unchanged by the move; their numbers are
> not. At the shipped count: residual **mean −0.094 / p95 0.542 / max 0.892** pt (A) and **−0.073 /
> 0.541 / 0.784** (B) against S-A's **−0.112 / 0.577 / 0.827**; ace families **−0.417** vs **−0.032**
> (A) and **−0.358** vs **−0.018** (B); conservation 50.0000; the same **43** undealable pairs at
> combo mass 3.584e-5; per-entry `se` **0.147** pts against S-A's 0.143. I33 gains one clause for the
> artifact itself — **`(artifact)`**, cheap enough to run every time, armed against a tampered copy —
> and its `setupLabel` becomes a **read** (3 ms) where it was a build (~3.3 s).

---

## 3. Post-spike phase structure

Specified as contracts, gates, and decision rules keyed to spike outcomes (locked 4.9) — §3.7
lists what is deliberately not designed here. Every phase ends green on all three checks and
commits at its boundary.

### 3.1 P1 — parallel lanes (fan-out legal; single writer per contended file)

- **Lane M (owns `policy.mjs`):** items 6, 7, 9, 8 in that order. Rake–depth coupling (I41),
  depth→width factor (I42), the depth-dial re-description with the λ/μ re-weight decision made
  *from* the §5.2 measured correlations (folded into the I23 rewrite — decision rule: re-weight
  only if a re-weighting keeps I23(a–c) green while making corr(rank move, ν) dominant; otherwise
  re-describe, because the doc already celebrates the cooler result and honesty is cheaper than
  surgery), 3-bet sizing (I44), villain default-on last (I43) with the default flip landing at
  barrier B1 only, accompanied by the third-fixture ceremony (§5.1). **Early-ready, launched at P1:** items 6/7
  are spike-independent and identity at 100bb, so nothing in B0 blocks them beyond the fixture
  freeze and the gate-registry refactor. Under the one-launch-per-milestone orchestration (§11)
  the early start deliberately collapses into the P1 launch: lane M starts with the other lanes
  at the P1 boundary, carrying no spike dependency, and its merges wait for B1.
- **Lane U (owns `src/shell.html`):** items 12, 15, the inspector IA skeleton (item 14 first
  pass), colour-mode switch scaffolding with TIER live and EV rendering against the stub (§8).
- **Lane I (owns `build.mjs`):** item 16 dual build per S-D, item 18 smoke re-gated per S-E,
  item 17 FF/Safari harness (§9).
- **Lane C (new files only):** calibration harness + parser (item 2's plumbing) per S-C's spec;
  no constant may move here — the verdict is Phase 5's alone.

*P1 falsifies:* I23(d) by design — the width coupling is exactly the drift it caps; I31(a)'s
universal scope; the predicted seat-sign table in I42; and I8 under profile-ON (§7's I43
prediction).

### 3.2 P2 — payoff estimator ∥ solver engine

New files (`scripts/lib/payoff-model.mjs`, `scripts/lib/cfr.mjs`) — disjoint, legal fan-out
against the frozen interface. Payoff form per S-B's winner; solver per S-A's memo. Decision rule:
if S-B landed in the 2.5–5.0 band, the payoff ships `estimate`-badged and Phase 5's primacy
question is already answered "no" — the phase still ships, because the vs-GTO *structure* is
independent of payoff grade. M_deep's anchors (I23's measured counts, μ's sd-ratio) are
re-anchored, never silently broken, wherever the payoff model supersedes them. *Falsifies:* I33's
monotonicity clause; S-B's error bound out-of-sample.

> **Measured (phase 0) — S-B → Grade C.** The decision rule in this paragraph is written for the
> 2.5–5.0 band; S-B landed **above 5.0**, so §3.6's stronger row applies: **the stub payoff stays
> and P2 builds no payoff table.** Phase 5's primacy question is answered "no" *a fortiori* — and,
> independently, by S-C — while the phase still ships, because the vs-GTO *structure* is
> payoff-grade independent exactly as written. **Descope, per the measurement:** P2's payoff half
> becomes a payoff **correction**, not a payoff **table**. Form 1 (pairwise checkdown + fitted
> realization curve) costs 105 cpu-s — **0.2× the 688 cpu-second budget** — needs only the pairwise
> checkdown table plus a closed form, and reaches held-out p95 8.44 with Spearman 0.970; it is worth
> shipping as a labelled `estimate` **if** any consumer needs an spr axis, and worth cutting if none
> does. **Do not build form 2** (one-street rollout): 1.5× over budget at 600 deals/pair, a trial
> count whose own se (2.69 pt) already exceeds the Grade A edge. The **solver half is unaffected** —
> S-A passed, so `cfr.mjs` proceeds per §3.3, and S-A's board-budget finding applies here too (25k
> boards suffice; 400k is 10× more than the solver can use — spend the pipeline budget elsewhere).
> *This section's promised falsification has already happened:* I33's monotonicity clause fails at
> **1.7% of pairs at spr 1, 8.1% at spr 4, 15.9% IP / 20.5% OOP at spr 10**, worst case 9.1 pt
> *less* checkdown equity for 20.0 pt *more* ev. Rewrite the clause to the measurement per house
> style; do not delete it. **Three amendments the §2 freeze needs before P2 consumes it**, each
> measured: (i) `payoff()` must also return `potMult` (E[F]/potSize, measured range
> **1.603–11.865**) and `invShare` (**0.199–0.730**), or `EVbb = ev·finalPot − invested` is wrong by
> up to an order of magnitude in the pot term; (ii) `opts.ip` must be in every memo key —
> `ev(A,B,ip) ≠ ev(A,B,¬ip)` by up to **43 pt**, the `envKey` docstring trap in a new place; (iii)
> `supported:false` gains a **card-removal** clause, its real domain being shared-rank degeneracy
> (AA_DANGLER|RB × AA_BIGPAIR|DS is degenerate on **12.56%** of street evaluations), whose failure
> mode is silent — the first spike implementation collapsed every AA-vs-AA pair to a checkdown with
> no error raised.


> **Measured (P2 lane cfr) — the solver engine is built; 6-max is deferred on a DOMAIN finding, not
> on budget.** *This block records what `scripts/lib/cfr.mjs` and gate I35 actually do; where it and
> the paragraph above disagree, this is the later measurement.* **CFR+ per S-A** — alternating
> updates, regret matching+, linear averaging, exact best-response exploitability — over the capped
> heads-up tree at **both depths** (T100 and T40, one terminal pot apart). **The tree is DERIVED, so
> the sizing set ships zero new constants exactly as §6's measured block promised:**
> `potLimitLadder` recomputes 3 / 9 / 27 / 81 from the blinds and the pot-limit rule, I35 re-derives
> it independently, and `test/cfr.test.mjs` a third time, so a sizing that is **not** the pot-limit
> maximum fails a gate — misstate the rule and four assertions go at once; move the big blind and six
> do. *(Corrected by the P2 red team, `docs/refutations/P2.md`: this line said "a typed sizing
> therefore fails a gate", and a typed `[3, 9, 27, 81]` in fact passes. Three agreeing derivations
> cannot tell a derivation from a table that is right, and for an identity they do not need to — the
> claim is about the values.)* S-A's structural counts fall out
> rather than being asserted in: 5 nodes, 9 terminals, 615 infosets, 1,599 slots (SB 861 / BB 738).
> **B2 held:** every payoff arrives through the frozen accessor, using **all six keys** —
> `EVbb = ev·potMult·potSize − (heroPre + invShare·potMult·potSize)` is what the terminals evaluate,
> not the checkdown shortcut it collapses to, so P3's marriage is a change of argument rather than a
> rewrite of every terminal. I33 clause (e) now has its **first real consumer** and passes on it.
>
> **The anchors held on the stub, with room.** ε ≤ **5e-5 bb** at the **2,000**-iteration cap:
> measured worst **7.8e-6** over three seeds × two depths, with ε first crossing 5e-5 at iteration
> **332** (T100) / **316** (T40) against S-A's 456 — the same cap, a larger margin. §6's "ε ≤ the
> payoff's own `se`" is now an **assertion** rather than a sentence: I35 reads the accessor's `se`
> back and converts it at the tightest pot (1.52e-3 bb), so a quieter payoff forces ε **down**.
> Simplex error **2.2e-16** — one ulp — against the arithmetic accumulation bound `N·EPSILON`.
>
> **The two-seed clause needed splitting, and the split is the finding.** S-A defines it across
> independent *payoff samples*; under a checkdown source the accessor is **seed-inert**, so that
> reading is vacuous today. It is kept, *checked* rather than assumed (the two matrices are compared
> bit-for-bit), and **armed** with a fabricated seed-sensitive source that moves the value 7.6e-2 bb
> — so it has teeth the day a source is `'simulated'`. Beside it runs a second, non-vacuous axis:
> the **initial strategy** (the simplex point used while regrets are all-zero), spread **0.0004%** /
> **0.0006%** of pot against the 0.15% gate. *A note on what did not work, because it will be
> re-invented:* seeding the initial **regrets** is not the same perturbation — CFR+ regrets here live
> on the scale of the chance measure (q ≈ 1/123), so simplex-sized initial regrets are a large wrong
> prior that linear averaging carries past the cap (measured ε **2.1e-2**, four orders of magnitude
> worse). Perturbing a *distribution* is scale-free; perturbing a *magnitude* is not.
>
> **SIX-MAX IS DEFERRED, AND THE REASON IS NOT THE ONE §3.3 ANTICIPATED.** §3.3 greenlights 6-max
> MCCFR on one criterion — S-A inside half its wall-time budget — and S-A cleared it by **5,400×**.
> That criterion is met and the deferral does not rest on it. It rests on the **payoff's domain**,
> measured live by I35 every run over 24 six-handed tuples: **0 of 144** multiway returns are
> `supported`; the six shares miss 1 by up to **0.445**, so there is no constant-sum game to solve;
> and hero's share is **bit-identical across disjoint opponent sets**, because the multiway door
> returns equity against *random* opponents and therefore contains no opponent's cards at all. MCCFR
> on those payoffs would converge, correctly and fast, to the equilibrium of a game in which the
> other five players' hands do not exist — not a weaker baseline, a different question. **The
> deferral is gated by its own evidence:** if any of the three facts flips, I35 **fails** and the
> decision is re-made rather than inherited. §5.7's labeling is untouched and P3 still owns the
> on-screen "the baseline is HU" caveat.
>
> **The Grade-C finding reproduces on the projection stub, which is why the label is load-bearing.**
> Value to SB **−0.0816 bb** (T100) and **−0.0798** (T40) — **BB-positive at both depths**, SB opening
> 99.4% while BB folds **0.0001%** against a 3bb open. S-A's real pairwise matrix gave −0.1418 and
> 0.16%; the numbers differ because the stub is a different payoff, the *direction* is the same, and
> it is the direction the label is about. **A property of the stub worth recording before P3 reads
> anything into a solved strategy:** the projection is **exactly separable** —
> `ev(A,B) − 0.5 = (a_A − a_B)/2` to **1.1e-16** — so its equilibrium is a pure threshold in the
> shipped equity ladder and *cannot* express blockers, card removal, or any pairwise structure. The
> checkdown equilibrium's shape is an artifact of that; only a real payoff can falsify it.
>
> **I35 went live in P2, one phase before §7.2 reserved it**, because §3.2's deliverable is the
> solver and a gate written after its subject is a gate written to pass. Its solver-quality and
> 6-max clauses run against the engine; the two **disclosure** clauses have no shipped surface until
> P3 emits `data/equilibrium.json`, so they run over **zero units and report the count** rather than
> passing quietly, with their detectors armed against fabricated violators — I33(g)'s idiom, one
> phase earlier. The `supported`-keyed label is the armed violator and it is the *real* trap: all
> 15,129 heads-up returns **are** `supported:true`, so keying the caveat off `supported` renders
> nothing at all over a checkdown game.
>
> **Handed to P3, explicitly.** (1) The solver constants live in `cfr.mjs`'s `CONSTANTS` export with
> their anchors; P2 does **not** regenerate the model, so **P3 must stamp them into
> `model.constants`** at the same regeneration that emits `data/equilibrium.json` — I35's
> `constantsBlockProblems` is armed and will compare the two copies the moment one exists.
> (2) `CAPS.omitted` is the shipped datum the on-screen cap list must match. (3) Adding I35 to the
> enforced set moved `model.gates` and `meta.hash` by exactly one stamped row and nothing else —
> `cells`, `constants`, `order` and `benchmarks` are byte-identical, I22/I32 green, no fixture
> touched.


### 3.3 P3 — equilibrium baseline

Marry solver to payoff (the solver may not consume the real payoff until I33 passes on it —
barrier B2); emit `data/equilibrium.json` (full build only, gate D9) plus the quantized
baseline-tier block into the shared core (§5.3); vs-GTO colour mode + inspector comparison live.
Labeling per brief §5.7, on-screen: HU is "GTO"; anything multiway is "self-play fixed point" —
6-max MCCFR attempted only if S-A landed inside half its budget, else explicitly deferred with
the on-screen caveat that the baseline is HU. The vs-GTO comparand is **raw model tiers**, with
post-passed display noted — the post-passes (nesting, suit monotonicity) are impositions an
equilibrium may violate, and a violation is a finding to report, not launder. *Falsifies:*
emergent positional nesting at equilibrium (I36 — see §7's prediction).

> **Measured (phase 0) — S-A → pass, S-B → Grade C.** *Both conditionals in this paragraph resolve,
> and they resolve in opposite directions.* **Solver = CFR+** — not an LP/regret-matching variant
> (§3.6's S-A row does not fire) and *not* vanilla CFR: the vanilla control was still flipping
> whole-cell argmaxes at iteration 99,467 while CFR+ stopped at 1,577, and that is the one
> algorithmic choice the spike forces. **6-max MCCFR is greenlit by this section's own criterion:**
> HU landed at 11 ms against the 60,000 ms half-budget, inside by **5,400×**, so it is *attempted* in
> P3 and the "the baseline is HU" caveat is not pre-shipped. Its claims stay fixed-point-only per
> I35 and the §5.7 labeling is unchanged. **The tree spec is corrected before P3 writes code:**
> "open/fold/3-bet/call/4-bet/jam" at 100bb is not a legal pot-limit tree, so the tree is the
> pot-limit maximum ladder **3/9/27/81** — an arithmetic identity, hence **zero new constants** and
> *stronger* than §6 assumed (the sizing set is **anchored**, not merely flagged). Solve both 100bb
> (cap = the pot 5-bet to 81) and 40bb (where the cap is a genuine all-in); they differ in exactly
> one terminal pot and make a controlled pair for the depth axis. I35's cap-list clause still governs
> the *omissions* — no limp, no sixth raise, no postflop. **Grade C makes I35's checkdown-label
> clause load-bearing rather than defensive**, and the checkdown equilibrium shows why: its value is
> **BB-positive** — the button loses **0.1418 bb/hand**, BB folds **0.16%** against a 3bb open, SB
> opens 89.3%. That is what "postflop does not exist" looks like — strip position of its only source
> of value and the button's edge inverts — and a reader shown a 0.16% fold frequency *without* the
> label is shown a lie. Per §2's phase-0 annotation the label must key off `source === 'checkdown'`,
> never off `supported`. It also predicts the direction of any future Grade-A correction: a real
> payoff must move value toward the button and narrow BB's continuing range. *Anchors handed to §6,
> measured not chosen:* ε = **5e-5 bb** (the out-of-sample exploitability floor, 0.0034% of pot);
> iteration cap **2,000** (ε first crosses 5e-5 bb at iteration 456 / 40 ms — a 4× margin at 143 ms);
> and I35's two-seed clause gated at **0.15% of pot** against **0.035%** measured, written to fail.

> **Adjudicated (P3 launch).** *The paragraph and the phase-0 block above are kept as written; this
> is the decision taken at the P3 launch and executed at the B2 pre-stage, with the measured verdicts
> appended at the foot of the block. Where a sentence above disagrees, this is the later record.*
>
> **DECISION 9 — THE SOLVER RENDERS THE MEASURED PAIRWISE CHECKDOWN MATRIX, NOT THE PROJECTION
> STUB.** P2 married `cfr.mjs` to the frozen accessor and solved the *projection*: a source that is
> **exactly separable** (`ev(A,B) − 0.5 = (a_A − a_B)/2` to 1.1e-16), whose equilibrium is therefore a
> pure threshold in the shipped equity ladder and *cannot* express a blocker, a card-removal effect,
> or any pairwise structure at all. P3's baseline solves S-A's construction instead: shared boards;
> **one draw per cell per board with a sit-out on collision** (the corrected sampling measure —
> redraw-on-collision biased **+1.16 pt** mean and **+5.33 pt** on `RUN0_HIGH|RB`); diagonals exactly
> 0.5; off-diagonals stored once and mirrored, so the solved game stays **exactly** zero-sum; **25,000
> boards** (the top of S-A's measured 12.5k–25k band) under **two independently named seeds**. It is
> **validated against the shipped `eq[0]` column before use** — S-A's rule for every payoff sampler,
> written after the redraw bug. Served through `payoff.mjs` as `source:'checkdown'` (it *is*
> checkdown, so the label clause fires unchanged and `potMult === 1` / `invShare === 0` remain
> identities), inside the frozen SIX keys, with **no seventh key and no arity change**. The projection
> stub stays the **page's** accessor source in both variants (D10, adjudication 1). **Zero new
> constants:** the board count is inside a band S-A measured and the seeds are names.
>
> **I33 must pass on the matrix source at B2, and three clauses were predicted to fire.** (c) the
> spr→0 identity — the matrix differs from the shipped column by the **signed card-removal residual**,
> because the shipped number conditions villain on hero's aces being dead and the q-weighted marginal
> does not; the clause is rewritten to compare a pairwise checkdown source to the column *by its
> q-weighted marginal*, reporting the residual band and asserting the sign pattern. (h) the **43
> structurally undealable pairs** (`AA_*` × `A_BLOCKED`, combo mass 3.6e-5) are the clause's **first
> live case**: `supported:false` with a flagged fallback, never a silent collapse. (mono) the
> checkdown half was written for the separable projection; a pairwise matrix is checkdown and **not**
> separable, so it inverts against the shipped equity ladder — that inversion count *is* the
> measurement, and the clause is split by accessor ROUTE rather than by the `source` string, since
> both routes are `'checkdown'`. **Rewrite to the measurement, never widen, keep the armed violator.**
>
> **DECISION 8 — THE 6-MAX DEFERRAL IS UPHELD, ON THE PAYOFF DOMAIN.** §14 item 5's "IN" was a
> **wall-time** verdict; the payoff **domain** binds (`cfr.mjs`'s `SIXMAX` record, I35(d), §3.2's
> `Measured (P2 lane cfr)` block). P3 ships the HU baseline — the SB and BB nodes of the capped
> heads-up tree — labelled **"GTO"**; every other seat renders disabled-with-named-REASON *"baseline
> is HU"*, in this section's own fallback and the `SIM.available` idiom. **THE RE-OPENING RULE,
> evaluated ONCE by measurement at the B2 pre-stage and recorded here. 6-max may be attempted only if
> ALL FOUR legs hold:**
>
> - **(i)** 2-way terminals come from the measured pairwise matrix;
> - **(ii)** 3-way+ terminals come from a MEASURED k-way sampler that passes I33(b) (constant-sum over
>   the k shares) and I33(h) (degeneracy surfaced, never collapsed);
> - **(iii)** zero new opinion constants;
> - **(iv)** inside the pipeline budget (METHODOLOGY's stated pipeline budget) and D9.
>
> If ANY leg fails — and (ii) fails at HEAD unless a k-way sampler exists and passes, which none does
> — `cfr.mjs`'s `SIXMAX` record and I35(d) **stand**, and I36's positional-nesting clause (UTG within
> HJ within CO within BTN) is recorded as **NOT MEASURABLE in the HU domain** (the I15 precedent:
> scoped to the measurement), never toleranced.
>
> **MEASURED VERDICTS (B2 pre-stage).** *Appended at the end of the step that this block was written
> before.*
>
> **THE REPRODUCTION CHECK — decision 9's own test, and it passes.** P3's HU baseline solved on the
> matrix route (CFR+, 2,000-iteration cap, three init seeds, `payoffSeed` pinned to matrix A):
>
> | | value to SB (bb) | SB open | BB fold vs a 3bb open |
> |---|---:|---:|---:|
> | **P3 baseline, matrix, T100** | **−0.14054** | **88.85%** | **0.162%** |
> | **P3 baseline, matrix, T40** | **−0.13735** | **92.02%** | **0.159%** |
> | S-A, same construction at 400,000 boards | −0.1418 | 89.3% | 0.16% |
> | P2's projection stub, T100 / T40 | −0.0816 / −0.0798 | 99.4% | 0.0001% |
>
> The matrix reproduces S-A to **1.3e-3 bb** in value, **0.45 pt** in SB open and **0.002 pt** in BB
> fold **at a sixteenth of S-A's board budget**. The residual gap is the board budget itself and it is
> REPORTED, never tuned. The BB-POSITIVE finding survives intact and the Grade-C label renders on the
> matrix surface exactly as on the stub (I35(f), keyed on `source === 'checkdown'`, checked on both
> routes). Worst exploitability at the cap **9.5e-6 bb** (T100) / **4.6e-6** (T40) against ε = 5e-5;
> simplex error 2.22e-16; mirror residual 1.42e-14 bb. **Also recorded, because it changes what may be
> asserted:** the T40 seed-0 argmaxes settle at iteration **1,817** of 2,000 — above 0.9× the cap — so
> the flapping bound stays on the projection route and the matrix's flip iteration is reported instead.
>
> **THE RE-OPENING RULE, EVALUATED ONCE BY MEASUREMENT — leg (ii) fails, so the deferral STANDS.**
> Frozen in `cfr.mjs`'s `SIXMAX.reopenRule` and re-checked by I35(d) every run.
>
> - **(i) HOLDS.** 2-way terminals come from the measured pairwise matrix, served through the frozen
>   accessor (`route: 'matrix'`, `source: 'checkdown'`, six keys, arity four).
> - **(ii) FAILS.** No k-way sampler exists at HEAD and the pairwise matrix is not one — it scores
>   unordered CELL PAIRS on shared boards, so a multiway request still falls to the accessor's flagged
>   exit. `multiwayProbe` **on the matrix route**, 24 six-handed tuples: **0 of 144** supported, the six
>   shares miss 1 by up to **0.445** (so I33(b) has no constant-sum game to check), hero's share
>   **bit-identical across disjoint opponent sets** (so I33(h) has no k-way degeneracy to surface).
>   Building one is a NEW MEASUREMENT outside the B2 pre-stage's remit and it was not built.
> - **(iii) HOLDS for the pairwise matrix; NOT EVALUABLE for a sampler that does not exist.** The board
>   count is a measured band's endpoint and the seeds are names: zero new constants.
> - **(iv) HOLDS for the pairwise matrix; NOT EVALUABLE for 6-max.** METHODOLOGY states the pipeline
>   budget as **"6 minutes" hard against 188 s measured** on a 4-core box (§3.2 quotes the same budget
>   as 688 cpu-s; METHODOLOGY is the living source of truth and its own words are what leg (iv) quotes).
>   The two matrices cost **3.3 s**, ~1.8% of that measured wall. D9 is **not set at all** — §5.3 keeps
>   full's budgets `null` until a real `data/equilibrium.json` exists — so this leg cannot be cleared in
>   the direction that matters either.
>
> **Therefore: `SIXMAX` and I35(d) STAND, and the sentence P3's baseline phase quotes rather than
> re-derives is —** *I36's positional-nesting clause (UTG within HJ within CO within BTN) is NOT
> MEASURABLE in the HU domain: the solved tree has exactly two seats, SB and BB, so there is no
> UTG/HJ/CO/BTN nesting for an equilibrium to exhibit or to violate — scoped to the measurement (the
> I15 precedent), never toleranced.* It is stored verbatim in `SIXMAX.reopenVerdict` and I35(d) fails if
> it is removed.
>
> **THE ONE THING THIS STEP COULD NOT CLOSE — I35's two-seed PAYOFF axis, now LIVE, breaches its gate,
> and the two numbers it breaches between are BOTH this plan's.** The axis is wired exactly as decision
> 9 requires (solve on matrix A, solve on matrix B, init seed held at 0) and it FAILS: spread
> **0.1508% of pot at T100** and **0.1568% at T40** against the **0.15%** gate. This is arithmetic, not
> an unlucky pair. The tolerance is anchored on a spread S-A measured **at 400,000 boards** (0.035%,
> gated at ~4×); the board band is **12.5k–25k**; spread falls as boards^−½, so at 25,000 the per-entry
> `se` is ~4× S-A's (**0.575** vs 0.143 equity pts) and the expected spread is ~0.14% — the gate sits at
> **~1× the measurement, not ~4×**. Over four independently named matrices the six pairwise spreads run
> **{0.151, 0.011, 0.128, 0.162, 0.023, 0.139}%** at T100 and **{0.157, 0.013, 0.120, 0.170, 0.037,
> 0.133}%** at T40; at 12,500 boards the maxima are **0.337% / 0.322%**, so the bottom of the band is
> worse, not better. **The two anchors are jointly unsatisfiable at any seed pair anyone would be honest
> to name, and nothing was widened, seed-picked or exceeded to hide it.** Three options exist and all
> three are the user's: **(1)** amend the board band upward — ~400k restores S-A's own spread but costs
> ~22 s per matrix, which needs an on-disk matrix artifact plus a `--check`-style determinism gate to
> stay under verify's 41.9 s soft wall (a NEW ARTIFACT, §0.4 identity leg (b)); **(2)** a re-anchoring
> ceremony on `solver.twoSeedTolPot` (that is widening); **(3)** the axis reported rather than asserted
> at this budget (that is a weakening). Until one is chosen, **I35 fails**, `verify.mjs` exits 1, and
> `test/gates-solver.test.mjs`'s baseline assertion fails with it; everything else in this step is
> green and the tree is one decision away.

> **Adjudicated (P3 relaunch).** *The Adjudicated (P3 launch) block above is kept as written — its
> "THE ONE THING THIS STEP COULD NOT CLOSE" paragraph is the record of a red close and stays. This
> block is what was decided about it and what the decision measured.*
>
> **OPTION (1) WAS TAKEN: THE BOARD BAND IS RAISED, THE TOLERANCE IS NOT WIDENED, AND THE PAYOFF AXIS
> STAYS ASSERTED.** Options (2) and (3) were both weakenings — a re-anchoring ceremony on
> `solver.twoSeedTolPot`, or reporting an axis the plan asked to be asserted — and the house rule is
> that gates are written to fail, never toleranced to pass. What was wrong at the B2 pre-stage was
> not the gate: it was that the MEASUREMENT and its ANCHOR were taken in different regimes. S-A read
> the 0.035% payoff-axis spread the 0.15% tolerance quotes **at 400,000 boards**; the shipped
> matrices were at 25,000, an endpoint of a different S-A table (the out-of-sample exploitability
> band). So the matrices are now built at the count the anchor was measured at, the constant's VALUE
> 0.0015 does not move by a digit, and the anchor's stated ~4× margin is a measurement again rather
> than an extrapolation.
>
> **THE MATRIX IS A SHIPPED, COMMITTED ARTIFACT (§0.4 identity leg (b) — a new mechanism entering as
> a new artifact, in the open).** One 400,000-board matrix costs ~21 s, so building the pair inside
> `verify.mjs` would put ~40 s on a wall whose soft ceiling is 41.9 s. Instead:
> `data/checkdown-matrix.json`, **307 KB**, integers only — per seed the upper-triangle `wins2`
> (= 2×hero's showdown score, an exact Int32), `cnt` and `den` in `rowBase` order plus `cellLive`,
> with `keys` and `combos` shared. `E = (wins2/2)/cnt` reconstructs **bit-identically** (the division
> by two is exact), so the file records TRIALS rather than a rounding of results. Its `meta` carries
> the seed names, the board count, `generator`, a `generatorHash` (sha256 over
> `scripts/lib/checkdown-matrix.mjs` + the generator) and a `contentHash`. **No wall time, no Node
> version, no timestamp** — the byte-compare below needs a fully deterministic file, and wall time is
> a property of the machine. It is NOT `data/equilibrium.json` and it is not inlined into either page
> (D10's lite negative manifest forbids a solver payload in lite); whether p3-baseline's
> `equilibrium.json` embeds the matrix or references it by content hash is **that step's decision
> under D9**, deferred here and stated as deferred.
>
> **THE GENERATOR AND ITS `--check`.** `scripts/generate-checkdown-matrix.mjs` builds both seeds in
> parallel (`new Worker(SELF, { workerData })`, mc.mjs's idiom — nothing is split WITHIN a matrix, so
> the arithmetic is bit-for-bit the serial arithmetic), validates before writing (antisymmetry, the
> diagonal, conservation, the undealable set, the signed ace-family residual — S-A's rule, and
> nothing is written if a clause fails), and prints its `buildMs`. **`node
> scripts/generate-checkdown-matrix.mjs --check`** rebuilds both matrices in memory from the inputs
> the FILE records and byte-compares against disk (`build.mjs --check`'s idiom), naming which input
> drifted on a mismatch. It is **not run inside verify** — that would cost the ~40 s the artifact
> exists to avoid — and it **joins this milestone's GREEN definition at the close-out**, beside the
> three checks, smoke and browsers. What verify runs every time is a cheap **`(artifact)` clause under
> I33** (no new gate id: EXPECTED_IDS, METHODOLOGY's count and the registry would all move for
> something that is a property of I33's own source): seeds and board count match the code, keys match
> the model's live set, `generatorHash` equals the live hash of the sources — so a **stale** artifact
> is caught on the run that made it stale — `contentHash` recomputes, and every triangle entry
> satisfies `0 <= wins2 <= 2*cnt`. Armed against a tampered copy three ways: a flipped trial count, a
> flipped hash byte, a moved board count; the real file clears.
>
> **THE MEASURED VERDICT — the payoff axis at the shipped count.** Two independently sampled
> 400,000-board matrices, `rundown-v3/checkdown-A` and `rundown-v3/checkdown-B`, named before either
> was solved on and unchanged from the red run: spread **0.0659% of pot at T100** and **0.0615% at
> T40**, against the unchanged **0.15%** gate — a margin of **2.3× / 2.4×** where the 25,000-board
> matrices read 0.1508% / 0.1568% at ~1×. S-A's own figure at this count is 0.035%; ours is ~1.8× it,
> which is the two-sample spread of two-sample spreads and is REPORTED, not tuned. Per-entry `se`
> **0.147** equity pts against S-A's **0.143** (1.03×) — at 25,000 it was 0.575. The residual band
> against the shipped `eq[0]` column: **mean −0.094 / p95 0.542 / max 0.892** pt on sample A and
> **−0.073 / 0.541 / 0.784** on B, against S-A's **−0.112 / 0.577 / 0.827**. Ace-holding families
> **−0.417** vs **−0.032** for the other 103 cells (A) and **−0.358** vs **−0.018** (B) — the signed
> card-removal structure I33(c) asserts. Conservation 50.0000 on both; 43 undealable pairs, combo
> mass 3.584e-5, the same set on both samples.
>
> **THE REPRODUCTION CHECK, RE-RUN AT THE SHIPPED COUNT** (§3.3's own requirement, and the deltas in
> I35's detail line are now DERIVED from the run against a quoted `SA_REPRO` reference rather than
> typed, because the first run's typed "1.3e-3 bb / 0.45 pt / 0.002 pt / SIXTEENTH" was true of a
> 25,000-board matrix and became a lie the moment the count moved):
>
> | source | HU value to SB | SB open | BB fold vs 3bb open |
> | --- | --- | --- | --- |
> | S-A (400k boards) | −0.1418 bb | 89.3% | 0.16% |
> | **P3 matrix, T100, 400k (shipped)** | **−0.14164 bb** | **88.86%** | **0.155%** |
> | P3 matrix, T100, 25k (the red run) | −0.14054 bb | 88.85% | 0.162% |
> | P3 matrix, T40, 400k (shipped) | −0.13832 bb | 92.81% | 0.001% |
> | P2 projection stub (the page's accessor, D10) | −0.0816 bb | 99.4% | 0.0001% |
>
> The value reproduces S-A to **1.6e-4 bb**, SB open to **0.44 pt**, BB fold to **0.005 pt**, now at
> the SAME board budget — so what is left is the payoff-axis spread itself rather than the budget.
> **BB-positive at both depths**, which is what "a game where postflop does not exist" looks like and
> is what §3.3 ships RENDERED under that label (I35(f), keyed off `source === 'checkdown'`).
>
> **WHAT DID NOT MOVE, stated so nothing is inferred from silence.** `solver.twoSeedTolPot` = 0.0015,
> untouched — only its anchor TEXT is rewritten to the new measurement and the "at ~1× this tolerance"
> sentence goes. `SIXMAX.reopenRule`'s four legs keep their verdicts exactly — (i) HOLDS, (ii) FAILS,
> (iii) HOLDS for the pairwise matrix, (iv) HOLDS for the pairwise matrix — and only the 25,000-era
> NUMBERS inside legs (iii) and (iv)'s `measured` strings move (the count, and the build cost, which
> is now an artifact outside the pipeline). The re-opening rule's verdict, `SIXMAX.status`,
> `reopenVerdict` and I35(d) are unchanged; **I36's positional-nesting clause remains NOT MEASURABLE
> in the HU domain (the I15 precedent)**. `data/model.json` is not regenerated: `cells`, `rows`,
> `cols`, `bands`, `order`, `constants` and `benchmarks` are byte-identical to HEAD and the only diff
> is verify's own `gates` stamp and `meta.hash`. Zero new opinion constants: 400,000 is the regime the
> tolerance's anchor was read off, and the two seeds are names.
>
> **THE COST, MEASURED.** Generation ~21 s wall for both seeds in parallel (~21 s each single-thread,
> this box), OUTSIDE verify and outside METHODOLOGY's 188 s pipeline — a once-per-change step whose
> `--check` costs the same again. Verify's wall FELL: the payoff family's setup row is **3 ms** (it
> was ~3.3 s building two 25,000-board matrices), and the run is **29.5 s, 70% of the 41.9 s soft
> ceiling**. `test/checkdown-matrix.test.mjs` now validates the ARTIFACT — milliseconds — and
> exercises the builder's mechanics only at 300–400 boards.

> **Measured (P3) — the baseline SHIPS.** *What this section asked for, delivered, with the numbers
> and the two findings that came out of it.*
>
> **THE ARTIFACTS.** `data/equilibrium.json`, **69.0 KB** — full strategies at both depths at FULL
> double precision (28.6 KB per depth; a rounding would not have re-derived the frequencies shipped
> beside it, and the artifact's own check is that they do), the payoff `source` and the label
> DERIVED from it, `CAPS`, the four solver constants with their anchors, per-node frequencies,
> exploitability, wall time, the matrix's provenance and validation residuals, and the HU coverage
> map. `meta.synthetic` is `false`. Injected into `index-full.html` through the new `@inject:eq`
> region, gated by **D9** (§5.3). Beside it, in the SHARED core, `model.baselineTiers` at **10.9 KB
> of D6's named 12** — the quantized cut of the same solve, which is what buys LITE a tier-level
> vs-GTO mode instead of a disabled one.
>
> **COVERAGE IS HU, IN DATA.** Three of the page's twenty-four (pos, node) pairs have a solved
> analogue and the mapping is exact rather than interpreted: `n1` SB {fold, raise} is **SB × rfi**,
> `n2` BB {fold, call, raise} is **BB × raise with raiser SB**, `n3` SB {fold, call, raise} is
> **SB × 3bet**. The other twenty-one carry the named reason **"baseline is HU"** as a shipped datum,
> so the page renders it rather than supplying it (I36 clause (d) asserts exactly that). Two things
> have no analogue and are said out loud rather than left to be noticed: **`n4`/`n5`** are solved and
> ship in the full artifact but the page has no vs-4-bet or vs-5-bet node to render them at; and
> **T2** — the model's T1/T2 EXPLOIT split is a statement about two model settings, and a solved
> strategy has no reference table to differ from, so no baseline cell is ever T2 and a vs-GTO
> comparison must read T1 and T2 as one aggressive level.
>
> **LABELLING, FROM SHIPPED DATA.** HU is **"GTO"**; because the payoff `source` is `'checkdown'` it
> is *also* labelled **"a game where postflop does not exist"**, and the two are not in tension — it
> is an exact equilibrium OF a game in which postflop does not exist, and BB-positive value is what
> that looks like. Both the payload and the core block carry `source` and the label derived from it
> by `labelFor`, and I35 clause (f) now walks **five shipped label surfaces** (the two artifacts plus
> their injected copies in both pages) where it walked zero at P2. Clause (e) walks **five shipped
> cap lists** the same way. **No "self-play fixed point" surface exists, because nothing multiway was
> solved** — and the data is what says so.
>
> **THE SOLVER CONSTANTS REACH THE MODEL AND THE PAGE (adjudication 10, §6's third leg —
> `docs/refutations/P2.md` finding 6).** `verify.mjs`'s `stampConstants` gains a third source and
> writes `model.constants.solver` from `cfr.mjs`'s own CONSTANTS export, **authoritatively** rather
> than preserving whatever was there: a drifted block must be replaced, not carried across as if it
> were a measurement. The Method view walks `constants` generically, so the block renders without a
> new mechanism — it gains only a **tag of its own**, because the legend above that table makes a
> provenance claim ("opinion unless tagged", measurement tagged) and neither existing tag is true of
> four numbers whose source of truth is `cfr.mjs` and whose anchors are S-A's curves.
>
> **DECISION 11, PROVED.** `data/model.json` key-by-key against HEAD: `cells` (63,597 B), `rows`
> (3,095), `cols` (508), `bands` (480), `order` (41,256) and `benchmarks` (4,681) are **byte-identical
> to the character**. The only differences are the three legal moves — `constants` 3,698 → 6,020 B
> (`solver` is the only sub-key that moved), `gates` 666 → 691 B (I36 and D9 added, none removed),
> `baselineTiers` absent → 11,230 B — plus `meta.hash`. No Monte Carlo ran and `freeze-tiers.mjs` was
> not invoked; I22, I32, I43 and `test/payoff-model.test.mjs`'s 17-coefficient re-derivation are all
> green, and no fixture moved. That comparison is a one-off, so the PROPERTY behind it is pinned by
> `test/equilibrium.test.mjs` as well.
>
> **THE TWO FINDINGS.** *(i)* **`TRASH × RB` FOLDS at SB**, falsifying this milestone's own launch
> expectation that it would open — see §7.2's `Measured (P3)` block. *(ii)* **The equilibrium violates
> suit monotonicity on 7 of 369 shipped tier readings**, which is what forces §14 item 4's display
> decision, since the clause that was *predicted* to force it is not measurable in a two-seat tree.

### 3.4 P4 — skill axis + absolute-EV cut

Skill dial as offset-from-baseline (locked 4.3): the fold-more half re-uses the measured
v-lattice; the plays-better half cuts realization through the payoff layer. The EV cut runs
*beside* the percentile cut in `aggressiveSet` — a second predicate `EV ≥ 0` in EV mode — behind
the I34 quarantine, with margins gaining a third unit and `t4Band` reconciled in frequency terms.
I31(a) is re-scoped to the score path; I40 asserts the deliberate inversion (rake and depth *do*
move EV-mode width). *Falsifies:* monotone exploit→equilibrium convergence per cell (I37); "rake
folds the same hands at every depth" (I40's prediction).

> **Measured (phase 0) — S-B → Grade C.** §3.6's Grade-C row cuts this phase in half, in a
> pre-written way. **The skill axis halves to its fold-more (lattice) half.** That half re-uses the
> measured v-lattice and needs no payoff, so it ships. The plays-better half "cuts realization
> through the payoff layer" — and under Grade C there is no such layer to cut through: the stub is
> checkdown and spr-blind. So it is **not built in v3**, and §6's `skill-dial plays-better
> coefficient` row is not merely unanchored but unexercised; I38's reach-bounding clause is what
> keeps that honest. **The absolute-EV cut still ships — display-only and `estimate`-badged** —
> running beside the percentile cut behind the I34 quarantine exactly as specified. Grade C removes
> EV's claim to accuracy, not its right to be shown, and I34 is what makes that coherent rather than
> a hedge: under the quarantine tiers are bit-identical across view modes, so **no EV error of any
> size can move a tier** (S-B measured the smallest tier-moving EV difference in score mode as +∞ *by
> construction*). I40's assertions are unaffected — that rake and depth move EV-mode width is a
> structural claim about the cut, not about the payoff's accuracy. I37's two anchored endpoints both
> survive (the measured lattice, and the P3 solver baseline that S-A greenlit), so its
> monotone-interpolation clause stands as written.

### 3.5 P5 — calibration decision + residue

Run the pre-registered primacy test (S-C's criteria, untouched since Phase 0); ship
`calibration.disputed` for every fitted-vs-shipped disagreement; flip EV primary **only** if I46
passes (locked 4.4), the flip executing as a constants change through §5.1's re-freeze ceremony.
The verdict runs LAST, against the finished EV surface — stamping it earlier would validate stub
EV that P4 then replaces. Items 10 and 11 land here (11 subject to its §4 cut-line). Re-measure
every allowance re-pinned during P1–P4. METHODOLOGY final rewrite (§0 honesty statement, §10
items 16–17, per-variant claim sentences). *Falsifies:* q = 0.85 (I46's prediction), the I11b
thesis against money, and "EV beats score" itself.

> **Measured (phase 0) — S-C → fail.** *§3.6's S-C row is taken verbatim, with no re-planning.*
> **The pre-registered primacy test cannot run, and that is a verdict rather than a gap.** PC-1
> (hero visibility independent of outcome), PC-2 (lawful provenance) and PC-3 (assignment) are
> unsatisfiable — no lawful, hero-visible, assigned 4-card PLO corpus exists at any volume — and
> PC-0 makes a criterion that cannot be evaluated a FAIL. So **P5 ships the calibration harness plus
> self-play consistency only**, and `model.calibration.verdict` **ships hard-failing**, with
> PC-0..PC-8 stored as shipped data and rendered by the Method view so the reason is *on screen*
> rather than in a doc. **The harness is still worth building:** PC-4's paired statistic is exactly
> the shape a self-play consistency check takes, so the code is not wasted — only its input is
> missing. **EV primacy never flips**, so §5.1's re-freeze ceremony is not exercised for that reason
> (its trigger — a calibration-falsified constant — likewise cannot occur without a corpus). This
> section's three promised falsifications split accordingly: **"EV beats score" is unfalsifiable in
> v3 and ships saying so**; **q = 0.85 goes untested against money** for the same reason; and the
> I11b thesis is unreached. METHODOLOGY §10 gains **"the decision layer remains unfalsified against
> money"** as a standing limitation rendered from shipped data. Items 10 and 11 are untouched by
> this. **The successor experiment is named rather than left implicit:** no corpus size fixes PC-3 —
> you cannot read the EV of an action nobody took — so the only design that satisfies the bar is a
> *prospective randomised A/B test on the marginal cells*, run by a player against their own play,
> and it is out of scope for v3.

### 3.6 The Grade B program — the pre-written degraded v3

So that a failed spike cancels one track and never stalls or re-plans the program:

| Trigger | What ships instead |
|---|---|
| S-B in 2.5–5.0 band (Grade B) | Everything, but EV badged `estimate` everywhere; I46 pre-answered "no"; primacy structurally unreachable for v3 |
| S-B > 5.0 (Grade C) | Stub payoff stays; solver runs on checkdown wearing its on-screen label — gated, not prose: I35's checkdown-label clause (§7.2) asserts the label renders whenever the equilibrium surface's payoff source is `'checkdown'`, derived from shipped data; B2 decides vs-GTO caveated-or-cut; skill axis halved to its fold-more (lattice) half; EV ships display-only, `estimate`-badged |
| S-A fails | LP/regret-matching HU variant; 6-max descoped; if HU also fails, vs-GTO mode drops from the colour switch (TIER/EV ship), skill axis halved as above |
| S-C fails | Calibration harness + self-play consistency only; I46 unpassable by construction; score-primary permanent; the standing §10 limitation ships on-screen |
| S-D fails | Full build constrained to lite-plus-injected-blocks (degrade-not-stop); lite unaffected |
| S-E fails | Smoke budget re-pinned to measurement (a finding); adoption list shrinks to Playwright or nothing |

Each of these is a shippable, honest v3 — smaller thesis, zero rework.

> **Measured (phase 0).** *Which rows fired, recorded against the table as written.* **S-B > 5.0
> (Grade C) — FIRES** (best held-out p95 7.21). **S-C fails — FIRES** (no lawful, hero-visible,
> assigned corpus at any volume). **S-E — FIRES in substance**: the smoke budget is re-pinned to the
> measurement and the adoption list shrinks to Playwright, though as a *finding* rather than a
> failure — smoke itself is green at 11/12, and the budget was found **unfalsifiable rather than
> breached** (§1's S-E annotation). **S-A fails — DOES NOT FIRE** (pass, with 5,400× headroom on the
> half-budget clause; CFR+ stays, 6-max MCCFR stays a live target). **S-D fails — DOES NOT FIRE**
> (both artifacts deterministic and byte-comparable). The Grade-B row does not fire either: S-B
> landed a band below it. **Two live rows compound in one place**, worth stating because no single
> row says it: Grade C makes EV display-only and `estimate`-badged, and S-C makes score-primacy
> permanent, so §5.4's primacy machinery ships **failing by construction** rather than merely
> unexercised. **Zero re-planning was required**, which is what this table was for.

### 3.7 Not decidable pre-spike — encoded as rules, not designs

Estimator internals (S-B); solver tree shape and iteration budget (S-A); calibration fit form and
hyperparameters (S-C); the toolchain buy-list beyond Playwright (S-E); and whether λ/μ re-weight
or the dial re-describes (the §5.2 correlations decide). The plan specifies their *contracts and
gates* only; writing their designs today would be exactly the over-specification locked 4.9
forbids.

---

## 4. Work-item placement (brief §6, all 18)

| Item | Phase | Note |
|---|---|---|
| 1 postflop/SPR model | P2 | form decided by S-B; Grade-banded per §3.6 |
| 2 calibration | P1 harness (lane C) → P5 decision | primacy criteria pre-registered at Phase 0 |
| 3 absolute-EV cut | P4 | needs payoff + baseline; behind I34 |
| 4 solver | P2 engine → P3 baseline | HU first; 6-max MCCFR only if S-A healthy |
| 5 skill axis | P4 | offset from the P3 baseline |
| 6 rake–depth + depth-width | P1-M (early-ready, §3.1) | I41/I42; identity at 100bb |
| 7 depth-dial story | P1-M (early-ready, §3.1) | re-weight or re-describe, decided from §5.2's correlations; I23 rewrite |
| 8 villain default-on | P1-M, flip at B1 | I43 + third-fixture ceremony |
| 9 3-bet sizing | P1-M | I44; opinion constants scoped to pot sizing |
| 10 sub-cell top-N | P5 | on §8's adjRaw machinery, `estimate`-labeled everywhere; I47 |
| 11 squeeze node | P5, **conditional cut** | The one item requiring regeneration (a new S3b stage). Cut-line, two named reasons: (i) its payload competes for lite's D6 bytes after item-5 additions; (ii) it is hand-authored machinery for exactly the node the P3 solver models properly — building it late in the same release that obsoletes it must clear a higher bar. If the cut is taken, both reasons are recorded in METHODOLOGY §10 and it moves to v3.1 with solver results in hand. If built: gate I45. |
| 12 rail collapse | P1-U | first slot; self-contained |
| 13 colour modes | P1-U scaffold → P3 vs-GTO → P4 EV live | |
| 14 inspector IA | P1-U pass → P3/P4 content | |
| 15 top bar | P1-U | |
| 16 dual build | P1-I | per S-D |
| 17 FF/Safari | P1-I | exactly METHODOLOGY §10.15's three named facts |
| 18 Playwright/smoke | P0 (S-E) → P1-I | smoke gates every phase thereafter |

---

## 5. The mandatory decisions

### 5.1 I22 — keep it, add I32, retire both only at a calibration-forced re-freeze

**Decision: I22 stays.** The v2 fixture (`data/tiers-v2.fixture.txt`, gate **I32**) is frozen at
Phase 0 before any v3 code, its sweep containing the v1 operating point so v1 identity is carried
transitively, and **I22 and I32 run side by side for the whole program.** Early retirement is
rejected: the gate is computationally free, everything through the chain phases is identity at
the v1 operating point *by construction* (couplings knee'd at 100bb, EV/vs-GTO opt-in, default-on
tested with explicit harness state), and the gate's own charter reads "first gate written, never
removed" — retiring it early buys tidiness and spends culture.

Villain default-on interacts cleanly: the fixtures are recorded with profile OFF, the harness
calls `solve` with explicit state so UI defaults are irrelevant to it, and the OFF path's
object-identity contract (`assert.equal`, not deepEqual) is carried forward as I43's load-bearing
clause. What default-on actually threatens is *silence* — without I32, flipping the default could
quietly reroute the legacy path.

**The retirement trigger, pre-written:** I22 and I32 retire **together**, only when calibration
falsifies a default constant, via the sole-writer `freeze-tiers.mjs --force` ceremony with the
printed tier diff and a written METHODOLOGY reason — "a gate pinning falsified constants would
enforce a known-wrong opinion" — and the calibrated model re-freezes as the v3 fixture for v4's
sake. Silence is structurally impossible: `freeze-tiers.mjs` remains the sole fixture writer, and
the orchestration script names the freeze as a step gating any constants commit (§11).

**The third fixture:** when item 8 flips the default at B1, freeze
`data/tiers-v3-default.fixture.txt` at the new default state and commit the printed tier diff
into METHODOLOGY — alongside, not replacing, the v2 fixture. The EV-primacy flip, if it ever
happens, is likewise a constants change and passes through this same ceremony with its own
committed diff (§5.4).

### 5.2 Brief §5.9 — lite keeps Simulate

**Decision: yes.** Simulate is already offline, zero-runtime-dependency, and file://-safe in Web
Workers; dropping it frees only ~59 KB (model.order ~40 KB + the 18.8 KB worker bundle) against a
budget with over 100 KB of headroom, while removing the only tool that answers off-lattice
settings. The decisive argument: **under villain default-on (item 8), most slider positions
become interpolated, so Simulate becomes MORE load-bearing in lite, not less** — the badge idiom
plus one-click verification *is* lite's honesty story. An interpolated badge with no recourse is
a worse product than a 59 KB-heavier one.

Locked 4.2's "minus live compute" is re-read and recorded as: **lite = full minus the
solver/equilibrium payload, the EV-estimator runtime, and anything requiring the opened
toolchain.** The split becomes: *lite = the entire v2 feature set + the P1 model-correctness
fixes + the tier-level vs-GTO colour mode (§5.3); full = lite + solver detail / EV estimator /
skill axis + toolchain-built extras.* D8 and `model.order` stay unconditional across variants;
METHODOLOGY §9.11's honest-claim sentence is rewritten per variant and grep-gated so each
artifact carries only its own claim (D11).

### 5.3 D6/D7 under the dual build — plus D9/D10/D11

`model.json` stays the single shared artifact, and D6/D7 are re-scoped as **the lite contract**:
D6's block sub-budgets and D7's 220 KB ceiling bind the shared core, explicitly restated as
"binding on the lite artifact" (lite is the constraining consumer, brief §5.8).

**One shared-core addition is allowed and paid for by name:** the quantized equilibrium
**baseline-tier block** — per (pos, node, cell) baseline tiers, quantized, budgeted at
**≤ 12 KB** — joins D6 as a named sub-budget (D6 total raised from 120 to 132 KB, stated and paid
for at the gate), so lite keeps a tier-level vs-GTO colour mode. This is truer to 4.2's "same
model" than disabling vs-GTO in lite. Everything else the solver/payoff work produces — full
strategies, the 7,626-pair matrix, calibration detail — ships in the full-only artifact
`data/equilibrium.json`, injected via a new `@inject:eq` region, under new gate **D9**: a
measured+5% tripwire retuned once per phase. The full page gains its own total-size tripwire; the
600 KB page budget stays lite's.

**D10** asserts the lite manifest *negatively*: no `@inject:eq` region, no solver payload, no
estimator runtime; full-only modes render disabled-with-named-REASON in the `SIM.available`
idiom; the baseline-tier block is explicitly lite-legal. **D11** asserts dual determinism: both
variants byte-compare under `--check`, the variant is named in the provenance banner, and the
per-variant honesty sentence is grep-gated. The `fetch(` / `<script src=>` refusals stay
**absolute for both shipped artifacts** — both remain self-contained pages; only the dev
toolchain opens (S-E's rule).

> **Measured (phase 0) — S-D → pass.** One source + feature flags is viable, so this section is
> implemented as written and the full build is **not** constrained to lite-plus-injected-blocks.
> Measured: six seams, **3,316 B of source (0.78% of the 414 KB shell), 0 B in the lite artifact** —
> `--variant=lite` over an unmodified shell reproduces today's page body **sha256-identical**, the
> only delta a 127-byte provenance banner. Lite **482.2 KB** / full **548.5 KB**, of which only
> **0.5 KB** is app code; lite pays 1.5 KB over the inert build for the disablement pane and its
> claim sentence. **D10 and D11 can be written directly against the spike's assertions** — they are
> already phrased as gate claims — and the spike's negative manifest *is* D10's: lite carries no
> `@inject:eq`, no EQUILIBRIUM, no `evEstimate`, no `.solverpane` CSS; both carry `model.order`
> (packed/orderHash) per §5.2; neither artifact carries an `@only:` marker. **D9 is deliberately not
> set here.** Full's size budgets stay unanchored until a real `data/equilibrium.json` exists, so the
> build prints SIZE NOT GATED and pins `VARIANTS.full.budgets === null` by test to make the flip
> deliberate; D9 sets it at measured + 5% after P3 and **must refuse a payload carrying
> `meta.synthetic: true`**. P1 must not invent full's ceiling. **One measured gap D10 has to carry:**
> lite-visible code calling a full-only symbol **builds clean and ships the dangling call** — the
> per-variant `--check` cannot see it, so the per-variant *smoke* run is non-optional and joins §0.3's
> GREEN definition. *Noted for lane M:* METHODOLOGY §9.11's honest-claim sentence is stale on its own
> terms before it is even split per variant — it says 574.4 KB against a shipped 480.8 KB after the
> sub-bucket cut. Re-measure when splitting.

> **Measured (P3) — the full build is real, D9 is live, and the deferred matrix question is
> answered.**
>
> **BOTH VARIANTS ARE CURRENT.** `src/shell.html` gains the `@inject:eq` region wrapped in an
> `@only:full` block, plus one bridge line in the same wrapper so `window.EQUILIBRIUM` is reachable
> at runtime (`smoke.mjs` reads the artifact's globals, which is a different question from D10's grep
> over its text). Those two blocks are the shell's ONLY `@only:` blocks and a test pins the census,
> so a third appearing is either the UI step landing early or a block nobody diffed.
> `node scripts/build.mjs --check` reports **2/2 variants current**; `skipped: full` is gone.
> `node smoke.mjs` runs **2/2 variants green** with the three morph rows unchanged (floor 8, ON 16,
> OFF 4), and `browsers.mjs` — which ran only `index.html` until now — gained the same per-variant
> loop in `smoke.mjs`'s idiom and reports **2/2 variants green** across chromium, Firefox and WebKit.
>
> **D9'S FOUR NUMBERS.** `eq` **73 KB** from a measured 70,704 B (69.0 KB) + 5 %; `total` **634 KB**
> from a measured 618,127 B (603.6 KB) + 5 %, both rounded up to the whole KB. `app` **360 KB** and
> `modelCode` **50 KB** are **lite's numbers, adopted rather than re-measured** — full's app measures
> 359.7 KB against lite's 359.5, the difference being one `<script>` wrapper and one bridge line, so
> it is the same application code; a fresh measured+5 % would have been 377 KB and would have handed
> the shared block 17 KB of headroom lite does not have, which is the silent raise adjudication 12
> forbids. `test/variant.test.mjs`'s `budgets === null` pin existed to make this flip a decision, and
> it is flipped here to pin the SHAPE of the decision instead: `app` and `modelCode` must EQUAL
> lite's, `total` and `eq` must exceed the artifacts they were measured from.
>
> **Amended (P3 UI).** `app` is **388 KB** in both rows, not 360: the vs-GTO colour mode measured
> **10,035 B** in the minified app block against **556 B** of lite headroom, so the ceiling was
> raised to measured+5 % (377,993 B = 369.1 KB, +5 % = 387.6, rounded up) in adjudication 12's idiom.
> The clause above is unchanged in substance and is what keeps the raise honest — `app` must still be
> EQUAL between the variants, and so must the new **`appCore` 360 KB**, which re-asserts the pre-raise
> ceiling against the app payload minus the marked `@block:gto` region. `total`, `eq` and `modelCode`
> did not move; full measures 613.3 KB against its 634.
>
> **THE DEFERRED QUESTION — "embed the 7,626-pair matrix or reference it by content hash" — IS
> ANSWERED: REFERENCE, on a 2.51x measurement.** The subtlety is which encoding the rule is applied
> to. `data/checkdown-matrix.json` stores INTEGER COUNTERS, from which `E = (wins2/2)/cnt`
> reconstructs bit-identically; that is the artifact's own claim and the only embedding that ships
> the *same* matrix. It costs **102,001 B** against a **67,509 B** payload — a ratio of **2.51x**, so
> embedding more than doubles the artifact and §3.3's escape applies. `E` at full double precision
> costs 142,290 B (3.11x). `E` rounded to six decimals costs **66,985 B**, which is UNDER the
> threshold — and is not the same matrix. **Choosing a precision to fit a rule is choosing the
> answer**, so the rounding is recorded beside the decision rather than allowed to make it. The
> payload carries the artifact path, its `contentHash` and the whole measurement, and D9 re-applies
> the rule every run, so a payload that grew until embedding no longer doubled it fails rather than
> goes on saying "reference". Recorded beside it, as §3.3 asks: the two-seed payoff spread on this
> very payload, **0.0659 % of pot at T100 and 0.0615 % at T40**.
>
> **THE SHARED-CORE HALF.** `model.baselineTiers` lands at **10.9 KB of its named 12** — per
> (pos, node, cell) tiers over the three (pos, node) pairs the HU baseline covers, quantized at
> `baselineQuant = 0.01`, carrying its own `source` datum, its own copy of the cap list and the HU
> coverage map, so lite renders the label and the caps from SHIPPED DATA. D10's `baselineTiers` row
> **armed itself exactly as written**: it read "absent from the model, so absent from the page, and
> that agrees" for two phases, and now REQUIRES the block in lite. `constants.solver` is a SECOND
> shared-core block, 2.3 KB, and D6 pays for it in the same reserved-raise idiom — `meta` 13 -> 16 KB
> and `total` 132 -> 135 KB, with BOTH original ceilings re-asserted against the payload minus the
> new blocks (core 115.9/120 KB, metaCore 12.7/13 KB), so no existing block gained a byte.

### 5.4 EV primacy — exactly per locked 4.4

All three presentations (absolute EV, decision-delta, score) ship as switchable view modes; **the
score cuts tiers**; EV is badged by source through the `estimate`/`interpolated`/`measured`
idiom, with `se` derived from trial counts, never typed.

**Containment — gate I34, the EV quarantine:** tier output is **bit-identical across view modes
at every setting**, verified in one process with modes toggled interleaved (the
settings-hash-walk idiom — this is what catches memo poisoning), and with an **object-identity
clause** (`assert.equal`, not tolerance) so a shaky EV number is *structurally unable* to move a
tier. A unit test asserts the badge text derives from `source`/`se`, never hard-coded.

**Primacy is structurally unreachable:** the EV-primary code path is gated on
`model.calibration.verdict === 'pass'`, which only the P5 ceremony may stamp. The pass criteria
are pre-registered at Phase 0 from S-C's power analysis, before any EV number exists — no
post-hoc bar-lowering — and the verdict runs last, against the finished EV surface. The flip, if
it happens, is itself a constants change and passes through §5.1's fixture-re-freeze ceremony
with its own committed diff. If S-C fails, the gate is unpassable by construction: score-primary
becomes permanent, and "the decision layer remains unvalidated against money" ships as a standing
METHODOLOGY §10 limitation rendered in the Method view.

> **Measured (phase 0) — S-B → Grade C.** All three presentations still ship as switchable view
> modes and **the score still cuts tiers**: Grade C changes what EV *claims*, not where it sits. EV
> is `estimate`-badged everywhere and display-only, with `se` derived from trial counts as written.
> **I34's quarantine is what makes that coherent, and S-B measured its consequence exactly:** under
> the quarantine tiers are bit-identical across view modes, so the smallest EV difference that moves
> a tier is **+∞ by construction** — no EV error of any size can reach a tier. The EV-mode figures,
> recorded for §6's audit: the smallest EV difference that moves a tier is **0.1405 pt** under the
> predicate reading (§3.4's `EV ≥ 0` cut) and **0.1274 pt** under the ordering reading (this
> section's primacy, EV as sort key — with two cells tying at **0.0000**), against a stub payoff `se`
> of **0.1581 pt**.

> **Measured (phase 0) — S-C → fail.** **Primacy is now unreachable in fact as well as by
> construction.** The Phase-0 pre-registration this section requires is done: **PC-0..PC-8**,
> written before any EV number exists, stored verbatim in `scripts/gates/reserved.mjs` as I46's
> fixed bar and byte-compared against `docs/spikes/S-C.md` so neither copy can move alone. PC-1
> (admissible visibility), PC-2 (admissible provenance) and PC-3 (assignment) are unsatisfiable
> today, and PC-0 is failure-closed — a criterion that cannot be evaluated counts as FAIL — so
> `model.calibration.verdict` **can only be stamped FAIL**. The gate is unpassable by construction
> exactly as this section anticipates: **score-primary is permanent for v3**, and "the decision layer
> remains unfalsified against money" ships as a standing METHODOLOGY §10 limitation rendered in the
> Method view. **Parked, not lowered** — the bar is recorded at full strength, so it comes alive
> unchanged the day a lawful, hero-visible, assigned corpus exists. §5.1's fixture-re-freeze ceremony
> is therefore not exercised for primacy in v3.

---

## 6. New constants and anchors

Per brief §2.1: anchored, or flagged unanchorable and gated. "Flagged" means named in
`constants`, labeled in the Method view, and bounded by a gate.

| Constant | Anchor |
|---|---|
| payoff estimator params | fitted to S-B's street-sim ground truth; residuals shipped like `benchmarks.disputed` |
| estimator stack-off knob | anchor candidate from S-B's sensitivity sweep; if none survives, **cannot be anchored → gated, flagged, badged `interpolated`** |
| solver exploitability target ε | ≤ the payoff's own `se` — solving tighter than the payoff's error is fake precision |
| solver iteration cap | S-A's measured convergence curve |
| solver tree/sizing set | the existing pot-sized conventions (the `breakeven = 0.29` lineage); every cap listed on-screen; **flagged** as an abstraction choice, bounded by I35's cap-list clause (the on-screen list must match the solver's actual tree, grep-gated from shipped data) |
| `rake.potBB(d)` coupling form | knee-at-100bb identity (3/0.05 = 60 = the existing constant re-described); the scaling exponent is one new opinion — **flagged**: linear proposed, shipped gated (I41), with the honest statement that "final pot scales with effective stack" is a modeling choice |
| depth→width gain | none — the raw `baseRealization(pos,d)/baseRealization(pos,100)` ratio, zero new opinion (brief §5.4); the *allowances* it forces (I23(d), I28) are re-measured, not authored |
| skill-dial fold-more half | the measured v-lattice — no new opinion |
| skill-dial interior blend | **cannot be anchored → gated (I37), flagged, badged `interpolated`** (endpoints anchored: measured lattice at one end, solver baseline at the other; I37's monotone-interpolation clause is the bounding gate — endpoints reproduced exactly) |
| skill-dial plays-better coefficient | **cannot be anchored today** — no measurement of postflop skill exists; ships gated (I38 bounds its reach), flagged `estimate`, said out loud in METHODOLOGY |
| EV MIX band | width = k·payoff-`se` at default trials, **k fixed by arithmetic, not felt**: k is solved so the EV-mode MIX band's combo-weighted mass at default settings equals `t4Band`'s measured frequency mass — §10.11's frequency lesson transposed to EV units as an equation (the `se` sets the unit, `t4Band`'s mass sets the multiplier). Computed from the shipped distribution, so k introduces no new opinion; I40's width assertions bound the result |
| Phase-0 spike success thresholds (§1: S-A's 0.25%-pot / 120 s / 1 GB, S-B's 2.5 / 5.0 band edges, S-C's 1M / 100 / 80 counts) | **pre-registered decision thresholds, fixed before any measurement exists** — deliberately set in the plan so the bar cannot move once results are in (the I46 pre-registration idiom applied to the spikes themselves). They are decision rules for spike verdicts, not shipped model constants: none enters `constants` or the model; each is recorded with its verdict in the spike memo. The S-B edges are the load-bearing pair, so the flag has teeth: S-B's memo must report, beside its p95, the two structural quantities the edges stand in for — the stub payoff's `se` at default trials and the smallest EV difference that moves a tier under I34's quarantine — so the blind edges are audited against measured scale in the same memo that grades against them, and a mismatch ships as a finding, never a re-drawn line |
| sizing-axis defaults (item 9) | pot-size = the identity anchor; off-default thresholds are exact arithmetic on `breakeven(s)`; the 7-pt premium's sizing-dependence **cannot be anchored** — held constant, flagged "calibrated at pot", I44 measures the consequence |
| `baselineQuant` (tier quantization step) | the payload bytes it buys, stated at D6's new sub-budget — **MEASURED AT P3: 0.01.** The table IS the anchor, over 369 tier readings on the shipped T100 solve: `0.05 → 4,589 B / 15 MIX cells`, `0.01 → 4,964 B / 20 MIX`, `0.001 → 5,357 B / 23 MIX`. The reading never *stops* moving — a CFR+ average strategy has a long tail of tiny weights and a fine enough step always resolves one more — so the step is chosen on what a TIER-LEVEL surface can render, which is arithmetic: at step q a cell reads MIX exactly when its off-argmax weight reaches q/2. 0.05 writes down as pure five cells mixing at 0.5–2.5 % (a vs-GTO surface would paint a disagreement the equilibrium does not make); 0.001 buys three cells mixing at 0.05–0.5 % for 393 B more, below what the surface can paint and below the solve's own two-seed spread. Re-derivable: `node scripts/generate-equilibrium.mjs --quant-table`. The block lands at **11.5 KB of D6's 12**. **REFUTED AS AN ANCHOR AT P3 — 6 refuters of 6 returned *unanchorable* (`docs/refutations/P3.md`), and the disposition is §6's own: FLAGGED, no replacement anchor invented.** The table is not what was refuted (every refuter re-derived it exactly); the claim that it *fixes the value* is. Nothing in GREEN ran it, so 0.02, 0.05 and 0.5 all regenerated with 55/55 gates, 591/591 tests and 2/2 variants current, the first bound that bit was D6's byte ceiling five orders of magnitude away, and the anchor's own prose could be fabricated and still reach the Method view. The constant now ships §6's three legs — `kind: 'estimate'` with `flag` in `data/equilibrium.json` and `quantFlag` in `model.baselineTiers` (named, and in the surface **lite** reads), the `UNANCHORED['baselineQuant']` badge in the Method view (labelled), and **gate I36 clause (e)** (bounded), which re-derives the table from the shipped strategies every run and refuses an unpriced step, a misquoted figure, or a block that is not that quantization. 0.05 and 0.001 remain priced rows and would still pass: which priced step to take is a judgment about what a tier-level surface can paint, and that judgment is what the badge is on |
| `evPrimary` mechanism | `model.calibration.verdict`, anchored to I46 by construction — ships failing |
| per-build byte budgets (D9, full-page tripwire) | measured+5%, arithmetic — **SET AT P3 from the first real payload**: `eq` **73 KB** from a measured 70,704 B, `total` **634 KB** from a measured 618,127 B, both +5% rounded up to the whole KB. **REPAIRED AT P3's red-team stage: `total`'s measurement was stale and is now stated honestly (`docs/refutations/P3.md`).** It was taken before the vs-GTO block landed in the same phase; two refuters measured the artifact at 628,036 B and reconciled the 9,909 B gap to the byte against METHODOLOGY §9.11's own reading of the mode, so D9 printed a ceiling and a measurement that could not both be true. **Neither number was raised** — a fresh measured+5% would give 646 KB for `total` and 74 KB for `eq` — because a ceiling tighter than its own rule is the conservative direction; both rows now read as *held below* measured+5%, against the live readings `total` 629,312 B (614.6K, 3.2% under) and `eq` 71,249 B (69.6K, 4.9% under). `app` and `modelCode` are NOT re-measured: they are lite's numbers, because the application code is identical in both artifacts and a fresh measured+5% would hand the shared block 17 KB of headroom lite does not have (§3.3 adjudication 12) |
| calibration tolerances | pre-registered at Phase 0 from S-C's power analysis |

> **Measured (phase 0).** *Five rows of this table are now measurements rather than promises, and
> one flag's teeth bit.* **`solver exploitability target ε`.** The decision-relevant reading of "≤
> the payoff's own `se`" is *out-of-sample* exploitability — σ solved on one payoff sample, scored
> against an independent one — measured **5.16e-5 bb = 0.0034% of pot**, so **ε = 5e-5 bb**. The
> per-entry se (0.143 equity pts) is *not* the decision-relevant quantity, and the distinction earns
> its keep: it puts §1's 0.25%-of-pot spike threshold **74× above the noise floor**, so that
> threshold is real headroom rather than fake precision. **`solver iteration cap`: 2,000** — from the
> measured curve, where ε first crosses 5e-5 bb at iteration 456 / 40 ms, a 4× margin at 143 ms.
> **`solver tree/sizing set`: ANCHORED, not flagged.** The pot-limit maximum ladder **3/9/27/81** is
> an arithmetic identity of the game, so the sizing set introduces **zero new constants** — stronger
> than this row assumed. I35's cap-list clause still bounds the *omissions* (no limp, no sixth raise,
> no postflop), which remain abstraction choices and must render on-screen. **`payoff estimator
> params` and `estimator stack-off knob`: not exercised in v3.** S-B graded C and P2 ships no payoff
> table (§3.2), so no estimator is fitted and neither row ships an unanchored constant. **`Phase-0
> spike success thresholds`: the flag's teeth bit, and the line was not redrawn.** S-B's mandated
> audit was reported beside its p95 and found a genuine mismatch — the blind 2.5 / 5.0 edges sit
> **15.8–20× above** the granularity at which EV flips a cell (stub `se` 0.1581 pt; median tier-move
> 0.1405 pt predicate / 0.1274 pt ordering). At the *consequence* level the edges are defensible —
> 2.5 pt ≈ **7.5% of cells / 8.7% of combo mass** changing side of the aggressive cut, 5.0 pt ≈
> **13.9% / 15.2%**, and the measured best form ≈ **19.0% / 19.4%** — so the mismatch **ships as a
> finding**, which is exactly what this row pre-committed to. **`evPrimary` ships failing** as
> designed: see §5.4's S-C annotation.

---

## 7. The gate catalog (the plan's core)

### 7.1 Dispositions of the existing 44

I31(a) re-scoped to score mode — its "must be a deliberate model change" clause is being
*invoked*, not violated; I23(d)/I28/I30 re-pinned after I42 lands (re-measured allowances, not
authored ones); I12/I21 become env-conditional families (I30's own 8% floor is the precedent);
I19 kept verbatim in the legacy lane, its baseline-referenced successor folded into I38; I26(f)'s
exactness identity rewritten to the new width arithmetic (**prediction, expected falsified: the
1e-15 identity fails as written the moment `widthFor` reads depth** — under a straddle dEff
halves, so width moves by more than the seat factor; the rewrite asserts the new exact
composition); I31(c)'s `want = min(pct, capBB/(potBB·unit))` arithmetic rewritten to the
depth-coupled reference pot with the 100bb knee keeping the preset checks intact; I15 re-scoped
to default sizing; all default-state sweeps re-run under profile-ON. I22: §5.1. D6/D7: §5.3.
V1–V6, I4/I5 scope, D1/D2/D4/D5/D8, B, I20, I24, I25: untouched.

### 7.2 New gates — id, claim, how it FAILS

Ids continue the live numbering (I1–I31 with no I17; D1–D8 with no D3).

| # | Assertion |
|---|---|
| **I32** | **v2 reproduction**: the legacy lane (all new axes at legacy settings) bit-for-bit against `data/tiers-v2.fixture.txt` over the §0.4 sweep. Fails if any new axis leaks into the neutral path — the most likely mechanism being a memo key missing a new axis, the `envKey` docstring's exact trap. **Prediction, expected falsified at least once: I32 fires during I43's OFF-path refactor — that firing is the gate doing its job.** |
| **I33** | payoff contract, clauses (a)–(f) per §2 **plus** the separate monotonicity clause written to be falsified. |
| **I34** | **EV quarantine** per §5.4: bit-identical tiers across view modes, interleaved-toggle verification, object identity, badge-from-data, primacy path unreachable without `calibration.verdict === 'pass'`. Fails on memo aliasing or a flag check below the cache key. |
| **I35** | solver quality: exploitability ≤ ε; strategies sum to 1; two independent seeds reach the same HU value within tolerance. Fails if convergence is abstraction-sensitive. 6-max scoped to fixed-point-only claims. Two disclosure clauses with teeth: the on-screen cap/sizing list must match the solver's actual tree, derived from shipped data (the grep-gate idiom — the tree/sizing set's bounding clause, §6); and whenever the equilibrium surface's payoff `source` is `'checkdown'`, the "a game where postflop does not exist" label must render, derived from that shipped `source` datum, never prose (the Grade-C guard). |
| **I36** | equilibrium anchors: AA_BIGPAIR×DS opens everywhere; TRASH×RB never opens UTG; *emergent* positional nesting UTG ⊆ HJ ⊆ CO ⊆ BTN. **Prediction, expected falsified: nesting fails at some seat pair** — the failure forces the raw-vs-post-passed vs-GTO display decision and ships as a finding. |
| **I37** | divergence accounting: signed vs-GTO divergence combo-weighted ≈ 0 at pool = baseline; per-cell convergence toward equilibrium as the skill dial rises. Assigned as the skill-dial interior blend's bounding gate (§6): the blend must interpolate monotonically between the two anchored endpoints, each endpoint reproduced exactly (lattice end via I38's object identity, baseline end via the ≈ 0 clause). **Prediction, expected falsified (I25's lesson transposed): the rank-overlap rows — BROADWAY_RUN, RUN0_HIGH — violate monotone convergence and move most as the pool tightens, not the junk rows.** |
| **I38** | skill axis: the lobby endpoint reproduces the current model exactly (object identity); combo-weighted width tightens with skill; per-cell exceptions enumerated, never tolerated away; the plays-better coefficient's reach bounded (its unanchored flag's teeth). |
| **I39** | EV arithmetic: EV(fold) = 0; sign agrees with `breakeven` at vs-3-bet within tolerance; rake enters exactly (the I31(c) extension); badges derive from data. |
| **I40** | EV-cut behavior: in EV mode, rake narrows width at percentile nodes (the deliberate anti-I31(a)) and depth moves width with §5.4's seat signs. **Prediction offered for falsification: shallow+raked folds more than deep+raked at every seat** — if the coupling inverts anywhere, ship the finding. |
| **I41** | rake–depth: rakeFrac(100bb) = 5.00% identity, rakeFrac(250bb) = 2.00%, monotone in depth, exact arithmetic including the straddle-doubled cap unit; vs-3-bet price 30.53% → 29.59% across the slider. |
| **I42** | depth-width exactness: width ratio = realization ratio *exactly* (the I26(f) idiom); seat signs per brief §5.4 (blinds/early tighten deep, CO/BTN loosen); compounding with M_deep bounded by a **re-measured** allowance. |
| **I43** | default-on: at load defaults (v = 55 is a lattice point, q = 0.85) every tier is cut from measured rows — zero interpolated cells at load; OFF is object identity (`assert.equal`); I6/I7/I13/I19 sweeps re-run under ON. **Prediction, expected falsified: I8 (TRASH×RB never T1/T2) fails at tight-v profile-ON** — I25 measured TRASH *gaining* vs tight pools; if it fires, that is a shipped finding about junk vs rank overlap, not a tolerance bump. |
| **I44** | sizing: pot-size = today bit-for-bit; the continue range narrows monotonically in sizing. **Prediction, expected falsified: I15's "RUN0_LOW×DS always continues" fails at large sizings** and gets scoped to the default. |
| **I45** | squeeze stage (only if item 11 survives its cut-line): regeneration diff byte-identical outside new fields (the §9.12 diff idiom); frequency-banded MIX only (§10.11's lesson); stream discipline asserted. |
| **I46** | calibration: harness reproducibility; fitted-vs-shipped disagreements ship as `calibration.disputed`, rendered in the Method view; the primacy verdict computed *only* from the Phase-0 pre-registered criteria. **Prediction, expected falsified: fitted q ≠ 0.85** — both shipped. |
| **I47** | per-hand top-N: every number labeled `estimate`; no per-hand claim ever enters the percentile sort (§2.4's autopsy as a standing gate). |
| **D9** | full-only `data/equilibrium.json` budget, measured+5%, retuned once per phase. |
| **D10** | lite negative manifest per §5.3. |
| **D11** | dual determinism + per-variant provenance + grep-gated honesty sentences per §5.3. |
| **S-gates** (harness, not verify.mjs) | smoke re-armed per variant (with the §1 S-E prediction on its 8 ms budget); **SF** (Firefox) and **SS** (Safari), the two harness gates §9 defines, record METHODOLOGY §10.15's three facts per browser as *measured verdicts* — the gate asserts **the on-screen disclosure matches the measurement**, not that everything works. |

> **Measured (phase 0, B0 step 4).** The catalog above is drafted into the registry as
> **`scripts/gates/reserved.mjs` — a manifest of RESERVED IDS, not entries in the enforced set.**
> Nothing in it runs, nothing is stamped into `model.gates`, and the report is still the same **46
> gates in the same order**: `EXPECTED_IDS` remains the written-out literal it was, for the reason
> stated in `scripts/gates/index.mjs`, and the manifest is guarded against it **in both directions
> at import time** — a reserved id appearing in `EXPECTED_IDS`, or an id the manifest calls live
> that the registry stopped emitting, throws rather than passing quietly. Only **I32** and **I33**
> are live; **I34–I47, D9, D10, D11** are reserved; **SF** and **SS** are reserved as harness gates —
> §7.2 names ids only for those two, so none is invented for `smoke.mjs` itself. **I46 is recorded
> as parked**: S-C's PRE-REGISTERED PRIMACY CRITERIA **PC-0..PC-8** are stored verbatim as its fixed
> bar and byte-compared against `docs/spikes/S-C.md`, with PC-1/PC-2/PC-3 unsatisfiable and PC-0
> failure-closed, so the gate is **unpassable by construction — parked, not lowered**, carrying the
> named reason so it comes alive unchanged if that reason ever stops being true.
> `test/gates-reserved.test.mjs` pins all of it, including the two guards' own failure modes.

> **Measured (P3) — I36, and it is three different kinds of answer.** *This annotation sits under the
> I36 row above. Where that row's wording assumes six seats, the scoping below is the later record.*
>
> **I36 and D9 are promoted** by the three-line edit `scripts/gates/index.mjs` documents, into a new
> family `scripts/gates/baseline.mjs` appended after D10/D11 — the fourth time the report has grown
> by appending, and for the same reason each time: the 53-gate report stays a strict PREFIX of the
> 55-gate one, so this phase diffs as two added rows rather than as a re-ordering. The family sits
> last because the rule that kept D10/D11 last now describes it too: its inputs
> (`data/equilibrium.json`, `index-full.html`) are produced by a step outside the runner. **55 gates.**
>
> **THE ANCHORS HOLD, SCOPED TO THE SEATS THAT EXIST.** `AA_BIGPAIR × DS` opens **purely** at SB
> (raise 100/100 steps), continues **purely** at BB facing the 3bb open, and 4-bets **purely** at SB
> facing the 9bb 3-bet — "opens everywhere" read over the three (pos, node) pairs a two-seat tree
> has, with the count of readings stated rather than the six implied.
>
> **THE `TRASH × RB` CLAUSE HAS NO UTG, AND THE HU READING FALSIFIES THIS MILESTONE'S OWN
> EXPECTATION.** The launch block expected the cell to OPEN, reasoning from S-A's 89.3 % opening
> frequency. **It folds, purely** (`T5`, 100/0 steps). 88.86 % is a COMBO-WEIGHTED frequency over 123
> cells, and the ~11 % the equilibrium does not open is the bottom of the range rather than a thin
> spread — `TRASH|RB` is in it. So the model's own clause is **corroborated** rather than
> contradicted in the one seat where it can be read, and the scoped clause is *stronger* than the
> original rather than weaker: SB is the button, the loosest opening seat in the game, so "does not
> open even here" implies "does not open at UTG" under any monotone reading of position. Facing the
> open the same cell **calls** (`T3`) — a different claim, on price, which is why the clause is
> scoped to the open. **The expectation is recorded as falsified rather than quietly re-remembered
> the other way**, and `test/equilibrium.test.mjs` pins the reading.
>
> **THE NESTING CLAUSE IS NOT TESTABLE THIS MILESTONE, and §7.2's prediction is neither confirmed nor
> denied.** The solved tree has exactly two seats, so there is no UTG ⊆ HJ ⊆ CO ⊆ BTN nesting for an
> equilibrium to exhibit or to violate. The gate records that with the reason quoted verbatim from
> `cfr.mjs`'s `SIXMAX.reopenVerdict` — frozen when the 6-max re-opening rule was evaluated once by
> measurement and leg (ii) failed — and it is **never a pass and never toleranced** (the I15
> precedent). It **fails** the day a payload covers two seats of the chain, at which point the
> prediction is owed a measurement instead of this note; the detector is armed against exactly that
> coverage map.
>
> **SO THE DISPLAY DECISION IS MADE ON WHAT IS MEASURABLE, AND THE POST-PASSES ARE VIOLATED.**
> Measured on the solved tiers, never enforced on them: **suit monotonicity fails on 7 of 369 shipped
> tier readings** — `SB rfi RUN1_TOPMID SS→SSA` demotes **RAISE to FOLD** on adding suitedness, plus
> three at `BB raise` and three at `SB 3bet`, all `T3→T4` — while the **AA-band pass is not violated
> at all (0)**. §3.3's sentence is therefore load-bearing rather than defensive: an equilibrium *does*
> violate an imposition the display makes, and the one it violates hardest is a card-removal effect a
> percentile cut cannot express. Measured on the MODEL side at the reference VPIP over the same three
> settings, the model's own post-passes move **1 of 369 cells** — so choosing the raw comparand
> changes almost nothing about the model and everything about what may be said about the baseline.
> The finding is recorded in `data/equilibrium.json` and RE-DERIVED by the gate from the tiers in
> `data/model.json`, because the failure that actually happens is that the tiers are regenerated and
> the record is not.
>
> **D9 is live on the first payload that ever existed to measure**, and its own deferred decision —
> embed the 7,626-pair matrix or reference it — came out REFERENCE on a 2.51× measurement. See §5.3.

### 7.3 Adversarial verification duty

Every opinion-layer constant in §6 gets a red-team agent whose task is to move it and produce a
shipped claim that fails; a constant no perturbation can falsify is declared
unanchored-in-practice and flagged. Refutation memos are committed with the phase (§11 makes this
a named orchestration stage; red-team agents write only memos, so they fan out freely).

---

## 8. UI workstream (locked 4.5 / 4.6 / 4.7)

**Rail (item 12):** `.rsec-h` headers become buttons with chevron + value slot; the four existing
`.t-micro` tags (`#vpiptag`, `#tabletag`, `#vptag`, `#ribbonwho`) seed the collapsed values, four
summaries invented for thesis/pin/node/display; collapse is CSS-only on a body wrapper so the
`sync*`/`render*` repaints stay valid; persistence via the existing `store()` localStorage helper
with its write-probe (never the hash — it is the share channel), composing with per-feature
`hidden` (a section can be hidden-by-feature *and* collapsed-by-user); the "?" buttons keep
`stopPropagation`; the pinned/scroll split re-measured. Harness checks: collapse survives reload,
feature-hidden × collapsed compose, value slots update while collapsed.

**Matrix (item 13):** the colour-mode switch lives on the legend row — the matrix owns its
encoding, per 4.6, not the top bar and not the rail's Display section. TIER keeps classes; EV
gets a sequential ramp + the currently-unused `.ramp` legend helper; vs-GTO gets the page's first
true diverging signed ramp (the Δ-pin two-colour encoding is insufficient for signed magnitude).
Every mode must re-provide the colorblind redundancy channel (the hatch patterns are keyed to
`.tN` classes today), aria labels, and tooltip content — one harness check per mode, plus I13
(combos partition) asserted in every mode.

**Inspector (item 14):** the IA pass restructures to four tabs — Verdict (tier + margin + EV +
divergence, one line each with unit and badge), Numbers (equity ladder + EV decomposition +
waterfall), Composition, Hand — with the `liveInspector` drag-path selectors preserved or updated
in the same commit. EV and divergence slot into the existing margin/headline seams
(`marginUnit`/`eqSE` provenance machinery); the reason-line machinery gains the divergence
sentence.

**Top bar (item 15):** the view switch is unchanged; colour-mode is on the matrix; new full-only
modes render disabled-with-named-REASON in lite (the structural-disablement idiom). The Method
view extends by construction — new constants, gates, and the calibration verdict render from
shipped data (`stampConstants` flows new blocks in), so documentation cannot drift.

> **Measured (P3 UI) — vs-GTO is live, and the two things this section could not know in advance
> are the coverage and the price.**
>
> **COVERAGE IS THREE SEATS, IDENTICAL IN BOTH ARTIFACTS.** SB × RFI, BB × vs-Raise (raiser SB) and
> SB × vs-3-Bet — the heads-up tree's three page-visible nodes — with the other **21 of 24**
> (pos, node) pairs rendering the chip, the legend row and the grid disabled with the reason read off
> `model.baselineTiers.notCovered` ("baseline is HU"), never typed in the page. What differs between
> the artifacts is not *where* the mode paints but *what it reads*: lite runs off the quantized
> shared-core table at one solved stack, full off `@inject:eq`'s full-precision strategies at both,
> and lite renders the 40bb solve as a **disabled depth chip naming `data/equilibrium.json`**. The
> 100bb/40bb difference is real but small — one cell of 123 at SB × RFI.
>
> **THE ENCODING.** Five buckets over ±2.5 **action steps** on the baseline's own three-level scale
> (fold 0, call 1, raise 2), so each whole step owns a bucket and |d| < 0.5 is the middle one — the
> ramp's domain is arithmetic on the scale, not a chosen number, and it introduces no constant. The
> colorblind channel is a **mapping**, not the bucket index: agreement is `.k0` (bare), and either
> side of it the existing hatches are used in mirror pairs (45° vs −45° at one step, 90° vs 0° at
> two), so orientation reads as direction and the pair as magnitude. **No new CSS classes**, and I13
> is asserted in the mode both statically (every live cell has a baseline row; the shipped `order` is
> exactly the live cell space) and at runtime (`smoke.mjs`: 123 of 123 live cells carry a bucket).
>
> **T2 IS THE ONE JUDGEMENT CALL, AND IT IS RECORDED AS A DEVIATION FROM THE LAUNCH TEXT.** P3's
> launch record says a vs-GTO comparison "must read T1 and T2 as one aggressive level", on the
> premise that T2 is the model's exploit split of the aggressive band. That premise holds at RFI and
> vs-Raise, where the node's own tier labels make T2's label identical to T1's — and it does **not**
> hold at vs-3-Bet, where T1 is `4-BET` and T2 is labelled `CALL`. So the page reads T2 as the band
> it splits *at this node*, decided by the node's own labels: the adjudication's substance where it
> bites, and no wrong number at one of the three seats the baseline actually reaches.
>
> **THE COMPARAND IS RAW** (`preDisplay`), per §14 item 4, and the inspector says so per cell: the
> DIVERGENCE line names the raw tier, and where a display post-pass moved that cell the reason line
> says which pass. The grid keeps painting the post-passed tier in TIER mode, unchanged.
>
> **THE PRICE, AND ADJUDICATION 12's CEREMONY.** The mode measures **10,035 B** in the minified app
> block, over 15 marked regions, against **556 B** of lite headroom. Dead weight was cut first and
> there was **439 B** of it (three unused CSS rules), which did not avoid the raise and is reported
> as the finding it is: the shell had no fat left. `app` rose **360 → 388 KB** (measured 377,993 B
> + 5 %, rounded up) and a new **`appCore` 360 KB** holds the app payload *minus* the marked
> `@block:gto` region to the ceiling it faced before, at **359.3 KB with 682 B to spare — 126 B
> better than it went in**, because the shrink and the moved placeholder outweighed the ~430 B of
> shared code the mode's disablement work added to the legend row. `scripts/lib/variant.mjs` gains a third seam —
> `@block:<name>`, which ships nothing and strips nothing — and `build.mjs` compiles the shell twice
> so both readings are printed and both are gated. METHODOLOGY §9.11 carries the full paragraph.

---

## 9. Infrastructure workstream (items 16–18)

Dual build: a `--variant=lite|full` flag; `@only:full`/`@only:lite` markup markers in the
`@inject` style; per-variant budget constants; a per-variant `--check` loop; `verify.mjs` gains a
variant manifest the D-gates read (D6/D7 evaluated against lite, D9/D10 against their owners).
The `fetch(`/`<script src=>` refusals stay absolute for both artifacts (§5.3). `package.json`
with Playwright as sole devDependency, no `"type"` field; further adoptions require a named
consumer (S-E's rule); the zero-dep property is restated in METHODOLOGY as *a property of the
generator and both shipped artifacts*, no longer a repo-wide promise. Smoke runs per variant. The
FF/Safari harness comprises two named harness gates — **SF** (Firefox) and **SS** (Safari), the
ids §7.2's S-gates row uses — each measuring exactly METHODOLOGY §10.15's three named facts
(Blob-worker boot on file://, localStorage reachability via the write probe, rAF suspension
while hidden) and recording them as measured verdicts — headless,
temp profiles only, never the user's installed browsers — and the page's on-screen disclosures
are updated to whatever is measured, degradations disclosed rather than patched blind.

> **Measured (phase 0) — S-D → pass, S-E → buy Playwright only.** *Dual build.* Viable and
> effectively free: lite 103 ms, full 105 ms, both variants plus both `--check`s ≈ 415 ms, each
> variant reproducing its own digest across builds and reporting STALE against the other's artifact
> **by name**. Every refusal this section relies on was verified to fire, including `fetch(` and
> `<script src=>` inside a full-only block while building lite. **Merge order per §12 stands:** S-D's
> `scripts/lib/variant.mjs`, `scripts/build.mjs` and `test/variant.test.mjs` land first — inert on
> today's shell but for the banner and a one-time `index.html` rebuild — and only then are the six
> seams applied to `src/shell.html` for real. **The per-variant smoke run joins the per-variant
> `--check` in the GREEN definition**, because it is the only one of the two that catches a lite page
> calling a stripped symbol. *Toolchain.* **`package.json` + Playwright as the sole devDependency,
> and nothing else**: 2 packages, 1.90 s, 23 + 66 lines of repo text, zero source files touched, all
> three checks byte-identical to baseline. The three declines are measured, and one is disqualifying
> by itself — **`esbuild --format=cjs` makes `verify.mjs`'s CLI detection silently not fire, so the
> verifier exits 0 having run zero gates.** Every further adoption still needs a named consumer; the
> default stays no. *The two harness gates are two thirds cheaper than assumed and one third
> impossible as specified.* **F1** (Blob worker from `file://`) and **F2** (localStorage reachable
> there) are now measured **green on Chromium 151, Firefox 153 and WebKit 26.5**, with round-trips
> 4.6 / 6.0 / 10.0 ms — METHODOLOGY limitation 15 can be rewritten from "Firefox and Safari have not
> been run at all" to a three-engine table, with the honest caveat that **Playwright's WebKit is not
> Safari.app**. **F2 falsifies the expectation §9.12 quotes:** WebKit 26.5 does *not* throw
> `SecurityError` on the first `file://` localStorage access. The write probe stays the right design;
> the sentence explaining *why* becomes a measured verdict. **F3** (a hidden tab suspends rAF)
> **cannot be measured headless by any available mechanism** — `bringToFront` leaves
> `visibilityState` 'visible', `Emulation.setPageVisibilityOverride` is gone from CDP, and
> `Page.setWebLifecycleState` frozen changes nothing — so SF/SS re-scope the F3 clause to assert the
> **consequence** (stub `requestAnimationFrame` to stop; assert the run pauses and the disclosure
> renders), which is testable headless and is the claim that actually matters, and keep the raw fact
> as a standing limitation rather than pretending a headed run is in scope. *Smoke* re-arms per
> variant and reports **11/12** until §8 fixes the 1280–1442 px topbar clipping (§1's S-E
> annotation); its width list should gain **1280 and 1360** so the middle of the band is sampled, not
> only its 3 px edge.

---

## 10. METHODOLOGY repairs (brief §5.1–§5.7, all addressed)

| Brief finding | Disposition |
|---|---|
| 5.1 percentile cut cannot change how many hands you play | Added to §10 as **limitation 17** at P1 (lane M), with the structural argument; the absolute-EV cut (item 3, P4) is its designated structural fix, and I40 is the gate proving the fix bites |
| 5.2 depth dial's story vs behavior | Reconciled at P1-M by the §3.1 decision rule (re-weight λ/μ only if it keeps I23(a–c) green while making corr(rank move, ν) dominant; else re-describe); whichever way it goes, the measured correlation dominance is asserted in the I23 rewrite so docs and numbers cannot re-diverge |
| 5.3 `rake.potBB` doesn't scale with depth | Item 6, P1-M; gate I41; the knee-at-100bb identity is the anchor |
| 5.4 free anchor for depth→width | Item 6, P1-M; gate I42; zero new opinion |
| 5.5 ρ's relevance decays with depth | **Limitation 16 added to §10 at P1 regardless of whether the payoff model ships**, and rendered in the Method view; the postflop/SPR model (item 1) is its fix, M_deep named as a scoring patch over a measurement-relevance problem |
| 5.6 hard-coded 6-max | Background only (4.8); the no-new-seat-literals rule in §0.2 |
| 5.7 solver labeling + checkdown trap | On-screen labels per §3.3 (HU "GTO" / 6-max "self-play fixed point"); the checkdown trap drives S-B's three-band rule; §0's honesty statement rewritten at P5 per variant |

Staleness fixes (P1, lane M's doc slot): the "46 gates" line, the pre-sub-cut payload/page
tables in §9.10/§9.11, the dangling §12.4 reference, the present-tense sub-bucket prose in §9.12.

---

## 11. Orchestration

The orchestration script lives at **`.claude/workflows/v3.js`** and is committed with this plan.
It is launched **once per milestone** (Workflow tool with `scriptPath` and `args` — e.g.
`--milestone=P1`), and each launch runs **fully autonomously to the milestone boundary**
(locked 4.10): agents work through whole phases, run the verifier, and stop only for genuine
blockers or at the boundary. No mid-phase questions to the user.

Rules the script encodes:

- **Commit at phase boundaries when green** — all three checks (§0.3) — and **never push**.
- **Worktree isolation** for every stage where parallel agents could touch the same files;
  `policy.mjs` and `src/shell.html` are the named contention points, single-writer always (§12).
- **The fixture ceremonies are named steps**: no commit that moves a default constant can pass
  the script without the `freeze-tiers.mjs --force` step having run and its diff committed
  (§5.1) — this is what makes silent I22/I32 breakage structurally impossible.
- **Adversarial verification stages** (§7.3) fan out after each opinion-layer change; their memos
  are collected and committed with the phase.
- **New model work needs new gates** before the phase can close: the script's phase-end check
  greps the §7 catalog ids into `verify.mjs`'s (registry's) output and refuses the milestone
  commit if a shipped feature's gate id is absent.
- Spike results (Phase 0) are written as memos into `docs/spikes/`, and the P1+ launches read
  them — the script, not a human relay, carries the decision-rule inputs forward.
- **Model tiering, for credit efficiency** (every `agent()` call sets `model` explicitly, so the
  launching session's own model is never silently inherited by the workers). The Fable tier
  orchestrates *and plans*: a **Fable milestone architect** (read-only) writes the work-order for
  every max-effort step before that worker runs, and triages a red verification before the single
  fix round spends its shot — Fable plans, Opus executes. Workers run **Opus at xhigh** effort
  (implementation lanes, spikes, integrations, refuters and their resolution); **Opus at max**
  for the three highest-stakes calls (the payoff-interface freeze, the I34 EV-cut quarantine,
  the P5 calibration verdict) and for the fix round — each milestone allows exactly one before
  returning a blocker report, and it runs only after a worker already failed — each under a
  Fable-authored work-order or triage; **Sonnet at medium** for scout-shaped work (prechecks and
  the verify agents that run the three checks and grep gate ids); **Haiku** for phase-boundary
  commits. The script is launched from a **top-level session**, never from inside a
  sub-orchestrator — its Fable architect tier is the second and last Fable layer.

---

## 12. Sequencing (each phase ends: `verify.mjs` green, `node --test` green, `build.mjs --check` current — both variants once they exist)

| Phase | Content | Ends at barrier | Depends on |
|---|---|---|---|
| P0 | five spikes (worktrees) ∥ fixture freeze I32 · payoff freeze I33 · gate-registry refactor · gate catalog + pre-registered I46 criteria | **B0** | — |
| P1 | lanes M / U / I / C (§3.1) · third-fixture ceremony at the flip | **B1** | B0 (lane M's items 6/7 depend only on the freeze + refactor, not on spike reports; under the one-launch-per-milestone model they nevertheless launch with the P1 milestone — §3.1) |
| P2 | payoff estimator ∥ solver engine (disjoint new files) | **B2** | B0 (I33), S-A/S-B memos |
| P3 | equilibrium baseline · `equilibrium.json` + baseline-tier block · vs-GTO live | **B3** | B2 |
| P4 | skill axis + absolute-EV cut (I34 quarantine) | **B4** | B3 |
| P5 | calibration verdict (last, vs the finished EV surface) · items 10, 11 · METHODOLOGY rewrite · allowance re-measures | **B5** (release) | B4 |

**The barriers, named (brief §7's dependency structure made explicit):**

- **B0 (end-P0):** spikes reported, both fixtures frozen, payoff interface frozen, registry
  refactored. Nothing chain-dependent starts before this. *This is the brief's "freeze the payoff
  interface first" unlock.*
- **B1 (end-P1):** all four lane merges land together with the item-8 default flip and its
  fixture ceremony; I32 green after the merge; milestone commit.
- **B2 (P2→P3):** the solver may not consume the real payoff until I33 passes on it. (Grade C's
  vs-GTO caveated-or-cut decision is taken here.)
- **B3 (P3→P4):** skill axis and EV cut may not start before `equilibrium.json` + D9 + the
  baseline-tier block exist.
- **B4 (P4→P5):** the calibration decision runs only against the finished EV surface; the
  primacy flip and any constant re-freeze happen at this single ceremony or not at all.
- **B5 (end-P5):** the release boundary — calibration verdict stamped last, allowances
  re-measured, METHODOLOGY rewritten per variant, milestone commit; I22/I32 either still green
  or ceremonially retired with the written reason and committed diff.

**Fan-out is legal:** the five P0 spikes (worktrees); within P1 across the four lanes
(single-writer per contended file); within P2 between payoff and solver (disjoint new files);
everywhere for the red-team agents, which write only memos. Everything else is serial on purpose:
the contention files are where wrong guesses are expensive, and this plan keeps guesses out of
them until a spike or a gate has made them cheap.

**Contention registry:** `policy.mjs` — single writer (lane M in P1; the EV-cut agent in P4;
never two phases concurrently). `src/shell.html` — single writer (lane U; P3/P4 UI additions
serialize behind it). `verify.mjs` — defused at P0 by the registry split (each lane adds gate
*files*). `build.mjs` — lane I owns it in P1; S-D's worktree merges first. `freeze-tiers.mjs`
fixture writes — stop-the-world events (B0, B1, B4).

**Top risks:** S-B's error band is the plan's load-bearing unknown — §3.6 means a bad result
degrades the program to "labeled honestly" rather than deadlocking it. Calibration data may not
exist — fails closed to secondary-EV per 4.4, permanently and on-screen. The vs-GTO mode may
reveal the equilibrium violating the post-passes — planned for (I36's prediction is that it
does). Gate-count growth makes verifier wall-time a budget of its own — the registry refactor's
per-gate timing line and soft ceiling exist for exactly this.

---

## 13. Explicit non-goals (mirrors brief §9)

- 7-max and 9-max seat ladders (locked 4.8 — deferred to v4).
- Mobile / narrow-viewport layout (locked 4.7).
- 5-card PLO.
- Any constant without an anchor (brief §2.1) — the §6 table is exhaustive; a constant not in it
  ships flagged and gated or does not ship.
- Editing `index.html` directly — it is generated; edit `src/shell.html` and rebuild.

---

## 14. Open questions for the implementation session (none block Phase 0)

1. **S-B's winning estimator form** and its constants' anchors — decided by the spike's error
   table and sensitivity sweep; the three-band rule (§1) pre-commits the consequences.

   > **Resolved (phase 0). No form wins; none is adopted.** S-B graded **C** (best held-out p95
   > 7.21 > 5.0), so the Grade-C row fires: the stub payoff stays and P2 ships a payoff *correction*
   > at most, never a table (§3.2). The constants this question was about are therefore never
   > created. The finding underneath is that **the blocker on ever reaching Grade A is the
   > reference, not the estimator** — two of its five opinion knobs move the "ground truth" by more
   > than the Grade A/B edge — and a reference that does not have that problem needs a postflop
   > solver: v4 scope.
2. **λ/μ re-weight vs re-describe** (item 7) — decided at P1-M from the §5.2 correlations by the
   §3.1 rule; either outcome is asserted in the I23 rewrite.
3. **Whether item 11 survives its cut-line** — decided at P5 against D6's post-item-5 headroom
   and the solver's actual coverage of 3-bet pots; both reasons recorded either way.
4. **The vs-GTO display's raw-vs-post-passed rendering** — forced by I36's outcome, not pre-made;
   the comparand is raw either way (§3.3), the question is only what the grid shows next to it.

   > **Resolved (P3). THE GRID KEEPS SHOWING THE POST-PASSED TIERS; THE COMPARISON IS COMPUTED
   > AGAINST THE RAW ONES; AND THE BASELINE'S OWN VIOLATIONS SHIP AS A NAMED FINDING.** *Forced by
   > I36's outcome exactly as this question required — and by the half of I36 that turned out to be
   > measurable, which is not the half §7.2 predicted.*
   >
   > **The prediction this question was hung on is NOT TESTABLE.** §7.2 expected *nesting* to fail at
   > some seat pair and expected that failure to force the decision. The solved tree has two seats, so
   > there is no UTG/HJ/CO/BTN nesting to exhibit or violate; I36 records that as NOT MEASURABLE with
   > the reason, never as a pass. A decision cannot be forced by a prediction nobody can evaluate, so
   > it is made on what IS measurable — which is the other post-pass.
   >
   > **THE MEASUREMENT. Suit monotonicity is VIOLATED by the equilibrium: 7 of 369 shipped tier
   > readings.** The worst is `SB rfi RUN1_TOPMID SS→SSA`, which goes **RAISE to FOLD** when
   > suitedness is added — a card-removal effect a percentile cut on a score cannot express, and
   > precisely the kind of thing §3.3 means by "impositions an equilibrium may violate". The other six
   > are `T3→T4` demotions at `BB raise` and `SB 3bet`. The **AA-band** post-pass is **not** violated
   > (0 of 369), so the two impositions do not stand or fall together and the finding is about
   > suitedness specifically. On the MODEL side, over the same three settings at the reference VPIP,
   > the model's own post-passes move **1 of 369 cells** — so the raw-vs-post-passed distinction is
   > nearly vacuous for the model and entirely load-bearing for the baseline.
   >
   > **THE DECISION, and why each half goes the way it does.** The **comparand is RAW** — §3.3 fixes
   > that and the measurement does not disturb it. The **grid keeps painting the post-passed tiers**,
   > because that is what the grid has always painted, the UI already names them as enforcement rather
   > than emergence, and re-painting the grid raw would change the product's own display to serve a
   > comparison. What is NOT acceptable is the third possibility: a monotone-looking grid beside a
   > baseline that is not monotone, with nothing saying so. So the **7 violations ship as a named
   > finding** in `data/equilibrium.json`'s `postPasses`, re-derived and cross-checked by I36 against
   > the tiers in `data/model.json`, and the cells they name are the ones the vs-GTO surface must mark
   > rather than smooth. **Nothing is laundered: the equilibrium is written down as it solved.**
   >
   > *Rendering is p3-ui's, on this data. What is settled here is what the data says and which of the
   > two tier sets each side of the comparison uses.*
5. **6-max MCCFR in or out** — S-A's wall-time answer (attempted only if HU lands inside half its
   budget).

   > **Resolved (phase 0). IN.** HU landed at **11 ms against the 60,000 ms half-budget** — inside
   > by 5,400× — so the criterion is met and 6-max MCCFR is attempted in P3 rather than pre-deferred
   > with the on-screen caveat (§3.3). Its claims stay fixed-point-only per I35, and the §5.7
   > labeling split ("GTO" for HU, "self-play fixed point" for anything multiway) is unchanged.

   > **Adjudicated (P3 launch). OUT — the deferral is upheld, and the "IN" above is overridden.**
   > *The Resolved block is kept as written; this is the later record and it wins.* **That "IN" was a
   > WALL-TIME verdict** — this question asks only "does HU land inside half its budget", S-A landed
   > at 11 ms against 60,000 ms, and the criterion was met by 5,400×. **The measured payoff DOMAIN
   > overrides it.** I35 clause (d) re-measures the domain every run over 24 six-handed tuples and
   > `cfr.mjs`'s `SIXMAX` record states the finding: **0 of 144** multiway returns are `supported`,
   > the six shares miss 1 by up to **0.445** so there is no constant-sum game to solve, and hero's
   > share is **bit-identical across disjoint opponent sets** because the multiway door reads equity
   > against *random* opponents and therefore carries no opponent's cards at all. MCCFR on those
   > payoffs converges — correctly and fast — to the equilibrium of a game in which the other five
   > players' hands do not exist. That is not a weaker baseline, it is a different question, and
   > wall-time cannot answer it. **Budget was never the binding constraint; the payoff was** (§3.2's
   > `Measured (P2 lane cfr)` block says the same in the solver's own words).
   >
   > **P3 therefore ships the HU baseline** — the SB and BB nodes of the capped heads-up tree —
   > labelled "GTO", with every other seat rendered disabled-with-named-REASON *"baseline is HU"* in
   > the `SIM.available` idiom (§3.3). The §5.7 labeling split is unchanged and no multiway claim is
   > made at all. **The re-opening rule and its four legs are recorded in §3.3's
   > `Adjudicated (P3 launch)` block**, evaluated once by measurement at the B2 pre-stage; leg (ii)
   > needs a MEASURED k-way sampler passing I33(b) and I33(h), and none exists at HEAD.

6. **The full build's toolchain shape beyond Playwright** — S-E's buy-list; default no per item
   without a named consumer.

   > **Resolved (phase 0). Playwright, and nothing else.** Every other adoption is declined on a
   > measurement rather than on taste, and one decline is disqualifying on its own: `esbuild
   > --format=cjs` makes `verify.mjs`'s CLI detection **silently not fire, so the verifier exits 0
   > having run zero gates** (§9). TypeScript cannot be adopted without renaming `.mjs` off ESM
   > semantics, and `tsc --checkJs` over the scripts found **zero real defects** in 81 errors. The
   > named-consumer rule stands for anything proposed later.
