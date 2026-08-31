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

**S-D — full/lite split cost.** *Question:* is one source + feature flags viable? *Method:*
prototype `--variant=lite` in `build.mjs` (the `@inject`-marker seam plus `@only:` markup
markers), build both artifacts, run per-variant `--check`. *Deliverable:* working diff,
per-variant byte table, and the complete list of gates needing per-build scoping (D6/D7/D8, the
`fetch(`/`src=` refusals, §9.11's honest-claim sentence). *Success:* both artifacts deterministic
and byte-comparable. *Failure:* markup divergence proves invasive → **degrade, don't stop**: the
*full* build is constrained to lite-plus-injected-blocks (lite is the non-negotiable artifact per
4.2; full is the one that flexes) until real divergence machinery earns its way in. The worktree
must not leave a half-split build on the main tree.

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

### 3.4 P4 — skill axis + absolute-EV cut

Skill dial as offset-from-baseline (locked 4.3): the fold-more half re-uses the measured
v-lattice; the plays-better half cuts realization through the payoff layer. The EV cut runs
*beside* the percentile cut in `aggressiveSet` — a second predicate `EV ≥ 0` in EV mode — behind
the I34 quarantine, with margins gaining a third unit and `t4Band` reconciled in frequency terms.
I31(a) is re-scoped to the score path; I40 asserts the deliberate inversion (rake and depth *do*
move EV-mode width). *Falsifies:* monotone exploit→equilibrium convergence per cell (I37); "rake
folds the same hands at every depth" (I40's prediction).

### 3.5 P5 — calibration decision + residue

Run the pre-registered primacy test (S-C's criteria, untouched since Phase 0); ship
`calibration.disputed` for every fitted-vs-shipped disagreement; flip EV primary **only** if I46
passes (locked 4.4), the flip executing as a constants change through §5.1's re-freeze ceremony.
The verdict runs LAST, against the finished EV surface — stamping it earlier would validate stub
EV that P4 then replaces. Items 10 and 11 land here (11 subject to its §4 cut-line). Re-measure
every allowance re-pinned during P1–P4. METHODOLOGY final rewrite (§0 honesty statement, §10
items 16–17, per-variant claim sentences). *Falsifies:* q = 0.85 (I46's prediction), the I11b
thesis against money, and "EV beats score" itself.

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
| `baselineQuant` (tier quantization step) | the payload bytes it buys, stated at D6's new sub-budget |
| `evPrimary` mechanism | `model.calibration.verdict`, anchored to I46 by construction — ships failing |
| per-build byte budgets (D9, full-page tripwire) | measured+5%, arithmetic |
| calibration tolerances | pre-registered at Phase 0 from S-C's power analysis |

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
2. **λ/μ re-weight vs re-describe** (item 7) — decided at P1-M from the §5.2 correlations by the
   §3.1 rule; either outcome is asserted in the I23 rewrite.
3. **Whether item 11 survives its cut-line** — decided at P5 against D6's post-item-5 headroom
   and the solver's actual coverage of 3-bet pots; both reasons recorded either way.
4. **The vs-GTO display's raw-vs-post-passed rendering** — forced by I36's outcome, not pre-made;
   the comparand is raw either way (§3.3), the question is only what the grid shows next to it.
5. **6-max MCCFR in or out** — S-A's wall-time answer (attempted only if HU lands inside half its
   budget).
6. **The full build's toolchain shape beyond Playwright** — S-E's buy-list; default no per item
   without a named consumer.
