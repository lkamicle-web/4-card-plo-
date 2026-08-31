# RUNDOWN v3 — BRIEF FOR THE PLANNING SESSION

**This document is input, not output.** It is the context for a planning agent whose job is to
produce `docs/V3-PLAN.md` and a ready-to-run orchestration script. It records what the repository
is, what v3 is trying to become, which decisions are already locked, and what a code audit on
2026-08-30 found that constrains the plan.

Written after a working session that read the model layer, ran the verifier, and measured the
things §5 reports. Every number in §5 was measured against the tree at commit `31a63a3`, with
`node scripts/verify.mjs` green at 44/44 and `node scripts/build.mjs --check` reporting the
artifact current.

---

## 0. Your task

Produce two artifacts:

1. **`docs/V3-PLAN.md`** — the implementation hand-off, in the same idiom as
   [`docs/V2-PLAN.md`](V2-PLAN.md): numbered sections, an honest scope statement naming what is out
   and why, every new constant named and justified with an anchor, every new invariant specified as
   a gate, and a sequencing section where each phase ends on a green verifier.
2. **A ready-to-run orchestration script** — the actual `Workflow` script that executes the plan:
   phases, fan-out stages, verification agents, and the dependency barriers §7 requires. The next
   session should be able to launch it rather than re-derive the orchestration.

Read `docs/METHODOLOGY.md` and `docs/V2-PLAN.md` before writing. METHODOLOGY is the living document
and the source of truth where anything disagrees.

---

## 1. What RUNDOWN is

A 4-card PLO preflop range explorer. A **29 × 5 hand-class matrix** — rank archetype × suit
topology, an exact partition of all 270,725 starting hands into 145 cells, of which **123 are
non-empty** — where every cell carries an action tier and the whole surface recomputes live under a
table-VPIP slider.

Current shape:

- `index.html` (480.7 KB) is **generated** and is the whole product: offline, no network, no build
  step for the user. `src/shell.html` is the hand-authored source.
- `data/model.json` (113.9 KB of a 220 KB budget) is the committed generator output.
- `scripts/lib/policy.mjs` is **the model** — the single source of the scoring layer, imported by
  the generator and inlined into the page so the browser and the data cannot disagree.
- `scripts/verify.mjs` runs **44 gates** and the generator refuses to emit if any fails.
- Zero npm dependencies anywhere. Node stdlib only.

The layer split is the project's central claim and must survive v3:

| Layer | Status |
|---|---|
| Evaluator, RNG, equity measurement | **Objective**, gated by exact combinatorics and a second independent engine |
| ν, `M_nut`, `M_play`, `R(p)`, tier widths, gates | **Opinion**, informed by measurement |

---

## 2. The culture the plan must preserve

This matters more than any individual feature. The repository is trustworthy because of these
habits, and a plan that breaks them costs more than it buys.

1. **Every constant has an anchor.** `mu` is anchored to the ratio of two measured standard
   deviations. `lambda` is anchored to `kappa`'s own swing. `straddle.seat = 0.77` is the geometric
   mean of the model's own opening-ladder steps. **There is not one felt constant in the repo.**
   A v3 constant with no anchor beyond "this seemed right" would spend the thing that makes the
   project credible. If a number cannot be anchored, the plan should say so out loud and gate it.
2. **Measurement beats folklore, and the conflict gets written down.** Gate `B` compares 77 rows
   against a published reference table and **ships the six disagreements** as `benchmarks.disputed`
   rather than suppressing them.
3. **The plan's own predictions get falsified in the gates.** I26 falsified V2-PLAN §7.2's "BTN
   keeps its base". I23(c) asserts the plan's rundown claim is *false* for low rundowns. METHODOLOGY
   §10.12 retracts a README number that was measuring an artifact. **Write v3's gates so they can
   fail this way**, and expect some to.
4. **Two engines beat one.** The production evaluator is cross-checked against an independently
   written reference (`equity-ref.mjs`) with zero per-trial ranking disagreements required.
5. **Nothing is hidden behind a disclosure.** Every limitation is in METHODOLOGY §10 *and* rendered
   in the app's Method view, straight out of shipped data, so documentation cannot drift from
   behavior.

---

## 3. The v3 thesis

v1 and v2 built a tool for **loose, low-stakes lobbies**, and the page says on screen that tight,
tough, short-handed games are out of its measured domain.

**v3's goal is one tool that serves both ends.** A player should be able to use it in a 75%-VPIP
lobby *and* in a tough game against good players, and get an answer they can trust in both. That
requires two things the tool does not have:

- **An equilibrium baseline** — what a solid strategy looks like independent of pool leaks.
- **An EV presentation** — numbers in a real unit, not only an abstract score with a rank.

The product framing that follows: *here is equilibrium, and here is what your table's leaks are
worth on top of it.* The exploit is expressed as an **offset from a baseline** rather than as the
whole model.

---

## 4. Locked decisions — do not re-litigate

These were decided in the scoping conversation. Treat them as constraints.

| # | Decision |
|---|---|
| 4.1 | **The toolchain opens up fully.** Real dependencies, real build. The zero-dependency rule is retired for the full build. |
| 4.2 | **A "lite" build still ships on GitHub Pages: same model, minus live compute.** One source of truth, feature-flagged, regenerated every release. Advertised explicitly — *download the single offline file, or use the full version.* |
| 4.3 | **Solver and skill axis together.** A computed equilibrium baseline, plus a pool-skill dial expressing the exploit as an offset from it. |
| 4.4 | **EV: build all three presentations** — absolute EV, decision-delta, and the existing score — switchable as a view mode. **But which one is *primary* is gated on calibration passing.** Ship with the score as the ordering and EV badged as an estimate, exactly as `interpolated` / `measured` / `estimate` already work. EV graduates to primary only when validated. A shaky EV number must never be able to corrupt the tier structure. |
| 4.5 | **Left rail: collapsible groups with remembered state.** Every group header always visible; bodies collapse independently; a collapsed row still displays its current value (`▶ TABLE & STAKES    100bb`). Not an accordion, not tabs. |
| 4.6 | **Grid: a colour-mode switch on one matrix** — `TIER` / `EV` / `vs-GTO`. One grid stays the object of attention; the mode changes what it encodes. The vs-GTO mode encodes signed divergence (tighter than equilibrium / looser than equilibrium). |
| 4.7 | **UI scope: the matrix, the inspector, and the top bar / view tabs.** Mobile and narrow-viewport layout is **out**. |
| 4.8 | **7-max and 9-max are deferred to v4.** Removed from v3 as too much testing surface for the value. Do not plan seat-ladder work. |
| 4.9 | **Phase 0 is a set of parallel feasibility spikes**, and the detailed plan for later phases is written from what they find. Do not over-specify phases that depend on spike outcomes. |
| 4.10 | **Agents run fully autonomously to a milestone.** Minimize check-ins. Stop only for genuine blockers or at major milestone boundaries. Do not design a plan that asks the user questions mid-phase. |

---

## 5. Audit findings that constrain the plan

Measured on 2026-08-30. These are the things a planner would otherwise have to rediscover.

### 5.1 Depth cannot change how many hands you play, and this is undocumented

`widthFor(pos, node, v, env)` at `policy.mjs:677` reads `env` only through `seatWidthFactor`, which
is the **straddle** factor. Depth is not an argument to width anywhere.

```
CO RFI target width:   40bb 28.13%   100bb 28.13%   250bb 28.13%
```

Painted width does wobble ±1–2 points, non-monotonically (rfi/UTG at VPIP 62 runs 16.1 → 14.1 →
15.1 across the slider), but that is **cells crossing a fixed percentile cut as the ordering
re-sorts**, not a trend.

The root cause generalizes and the plan should treat it as structural: **a percentile-cut model
cannot express "fewer hands are profitable," only "different hands are best."** This is the same
fact that makes rake tier-inert (I31: 5% rake moves all 27,675 scores and zero tiers). Both dials
bite only at the vs-3-bet node, whose thresholds are absolute prices. **This is the strongest
argument for the absolute-EV cut being a structural fix rather than a feature.**

Not currently in METHODOLOGY §10. It should be.

### 5.2 The depth dial's advertised behavior does not match its measured behavior

CO RFI, 40bb → 250bb: 106 of 123 cells change rank, some by 17 places. But:

```
corr(rank move, nu)     = +0.191
corr(rank move, cooler) = -0.414
```

The dial is documented as a nut-potential re-sort; it is mostly a cooler re-sort.
`BROADWAY_RUN|RB` climbs +12 places with ν = 0.37 — *below* the 0.42 reference, so `lambda` is
pushing it down — purely on a cooler of 0.30. Either re-weight `lambda`/`mu`, or re-describe the
dial. The docs and the numbers currently disagree.

### 5.3 `rake.potBB` does not scale with depth — a real defect with a free fix

```
d=40bb   rakeFrac = 0.0500
d=100bb  rakeFrac = 0.0500
d=250bb  rakeFrac = 0.0500     ← identical
```

The model says a 250bb game is raked at the same 5% as a 40bb game. Preflop pot sizes do not scale
with depth, but the **final** pot does, and the cap is measured against the final pot. If the
reference pot scaled with effective depth, the fraction falls 5.00% → 2.00% by 250bb and the
vs-3-bet price moves 30.53% → 29.59%.

**The knee lands on exactly 100bb** (`3 / 0.05 = 60 = potBB`), so the coupling is the identity at
the v1 operating point and I22 survives untouched. That is a strong signal it is the natural
completion of the constant rather than a bolt-on.

### 5.4 There is a free anchor for a depth→width factor

`baseRealization` already moves with depth, gated by I23(f). The 250bb/100bb ratios:

```
SB 0.9638   BB 0.9749   UTG 0.9894   HJ 0.9965   CO 1.0070   BTN 1.0206
```

Signed correctly and seat-dependent — deep should tighten the blinds and early seats and **loosen**
CO/BTN, because position compounds when deep. Derived from `beta = 0.35`, already in the model, so
it introduces no new opinion. Identity at 100bb. Note it compounds with `M_deep`, which already
demotes low-ν hands when deep; size accordingly.

### 5.5 ρ's relevance decays with depth — this is limitation 16 and it is not written down

The entire measurement layer is **all-in equity at showdown**: 100% of stacks in, every hand, to the
river. That number is most applicable at 40bb, where flop stack-offs are routine, and least
applicable at 250bb, where three streets of pot control mean the stacks never go in.

So the deep end of the slider is exactly where the *measurement* loses relevance, and `M_deep` is a
scoring-layer patch over a measurement-layer relevance problem. **No constant fixes this** — it is
what the postflop/SPR model is for. Add it to METHODOLOGY §10 as limitation 16 regardless of whether
the model ships.

### 5.6 The table is hard-coded 6-max, and "N = 7" meant something else

`policy.mjs:215`:

```js
const N_NB = { UTG: 3, HJ: 2, CO: 1, BTN: 0, SB: 0, BB: 0 };
const N_BL = { UTG: 2, HJ: 2, CO: 2, BTN: 2, SB: 1, BB: 0 };
```

v2 extended the **measurement** to seven opponents (`NMAX = 7`, `eq[1..7]`). It did not add seats.
Six and seven opponents are reached by *crowding a 6-max pot* with limpers and a straddle. Census
over all 3,960 UI-reachable settings: max raw `N_eff` 8.23 (limps/HJ, VPIP 90, 4 limpers, straddle);
`N_eff > 5` in 14.5%; `> 6` in 5.2%; clamped at 7 in 1.19%. Relevant only as background — table size
is deferred (4.8).

### 5.7 Solver feasibility

- **Heads-up is tractable.** 123 cells gives 7,626 unordered pairs — the full payoff matrix is
  precomputable in one pipeline run, and CFR over a capped preflop tree converges fast at that size.
- **Exact payoff tables die past heads-up.** ~325k triples three-way; astronomically worse at six.
  Multiway needs Monte Carlo CFR (outcome sampling), which samples showdowns instead of looking them
  up. Standard, well-understood, makes 6-max feasible.
- **The hard dependency:** a preflop solver needs a payoff at every terminal node. Fed checkdown
  equity, it solves *PLO where postflop does not exist* — the game the current measurement already
  describes — and would produce confident equilibrium ranges for a game nobody plays. **That is
  worse than the honest heuristic already shipping.**
- **Label it correctly at 6-max.** Heads-up Nash is unique in value and "GTO" is honest. Six-handed,
  CFR converges to a self-play fixed point with no uniqueness or interchangeability guarantee.
  Given §2.3, budget for saying so.

### 5.8 Two existing gates need a decision

- **I22** asserts v2 reproduces v1's tiers bit for bit at the v1 operating point (1,386 settings ×
  123 cells = 170,478 tiers, frozen against model `f90a11188a67`). v3 changes the model. The plan
  must decide explicitly: re-anchor to a v2 fixture, or retire it and say why. Silently breaking it
  is not an option.
- **D6/D7** cap `model.json` at 220 KB. The full build may not need that ceiling, but **the lite
  Pages build does**. Any measurement that grows the payload has to answer to lite.

### 5.9 An open question the plan must resolve

4.2 says lite "drops live compute," but the **Simulate button is live compute and already ships in
v2**, working offline from `file://` in Web Workers. Does lite keep Simulate and lose only the
solver, or lose both? The plan must state this, not leave it implied.

---

## 6. Work items

All of these are in scope. Ordering below is by value, not by execution order — see §7.

**Structural**

1. **Postflop / SPR realization model.** The largest gap and the prerequisite for almost everything
   else. Turns "equity × opinion" into something closer to EV. Also the fix for §5.5.
2. **Calibration against a hand-history database.** Not one constant has ever been checked against
   money won. The measurement layer is gated to death; the decision layer is unfalsified. Highest
   credibility-per-effort item in the repo. Also the gate that decides 4.4's EV primacy.
3. **An absolute EV cut alongside the percentile cut.** The structural fix for §5.1 — the reason
   rake and depth cannot move width today.
4. **Equilibrium solver** (§5.7) — heads-up first, multiway via MCCFR.
5. **Pool-skill axis.** A second dial beside VPIP: tougher pools fold more (shifting the villain
   lattice) *and* play better postflop (cutting realization). Expressed as an offset from the
   solver's baseline (4.3).

**Model correctness**

6. **Rake–depth coupling** (§5.3) and the **realization-anchored depth width factor** (§5.4).
7. **Reconcile the depth dial's story with its measured behavior** (§5.2).
8. **Villain profile default-on** — the lattice is measured and shipped; the tiers are still cut
   from random-opponent equities. Closes the remaining half of METHODOLOGY §10.1.
9. **3-bet sizing control** — §10.8; every threshold currently assumes a pot-sized 3-bet.
10. **Sub-cell resolution**, done differently from v2's cut sub-buckets. §10.2 calls cell means the
    largest single error source; METHODOLOGY §2.4 explains why the expand-in-place UI failed.
    Per-hand scores for a top-N list may succeed where a whole extra grid layer did not.
11. **Squeeze / multiway 3-bet node** — vs-3-bet is heads-up by construction today.

**UI** (4.5, 4.6, 4.7)

12. Left rail: collapsible groups, remembered state, values visible when collapsed.
13. Matrix: colour-mode switch (`TIER` / `EV` / `vs-GTO`), signed divergence encoding.
14. Inspector: must carry EV, decision deltas, the equilibrium comparison *and* the existing score
    decomposition without becoming a wall. Needs its own information-architecture pass.
15. Top bar / view tabs: where the new modes live.

**Infrastructure**

16. The full/lite dual-build (4.1, 4.2), including the §5.9 decision.
17. Firefox and Safari verification of the Simulate worker path — METHODOLOGY §10.15, never run.
18. Playwright installed so `smoke.mjs` gates again — it has not run since v1.

---

## 7. Dependency structure — where fan-out is legal

The single most important planning fact: **items 1, 3, 4 and 5 form a chain, not a set.**

```
  postflop/SPR payoff model  ──►  solver  ──►  equilibrium baseline  ──►  skill axis as offset
             │                                          │
             └──────────►  absolute EV cut  ◄───────────┘
                                  │
                          calibration decides
                          whether EV goes primary
```

**The unlock: freeze the payoff interface first.** Define and gate
`payoff(cells, potSize, spr) → EV` as the very first thing after the spikes. Once that contract
exists, the payoff estimator and the CFR engine can be built in parallel against a stub, and the EV
presentation layer can be built against it too. Without the contract frozen, these three cannot be
fanned out and any plan that pretends otherwise will deadlock.

**Genuinely parallel from day one** (no dependency on the chain): the UI work (12–15, though 13 and
14 need the EV/solver *interface* to render against, not the implementation), the model-correctness
fixes (6–9), the dual-build infrastructure (16), and the coverage items (17–18).

**Phase 0 spikes** (4.9) — run these in parallel, and write the rest of the plan from their results:

- Does CFR converge on this abstraction, and how fast? Build the 7,626-pair heads-up payoff matrix
  and run it.
- Can a postflop/SPR payoff estimator be built at acceptable cost, and what is its error?
- Does hand-history data exist in usable quantity, and what would calibration actually fit?
- What does the full/lite split cost in practice — is one source with feature flags viable?
- What does opening the toolchain buy that is worth the identity cost, concretely?

---

## 8. Orchestration requirements

- **Fully autonomous to milestones** (4.10). Agents work through whole phases, run the verifier,
  commit when green. Stop only for genuine blockers or at major milestone boundaries. Do not build
  a plan that asks questions mid-phase.
- **Every phase ends green**: `node scripts/verify.mjs` exits 0 with all gates `pass`,
  `node --test test/*.test.mjs` passes, `node scripts/build.mjs --check` reports current.
- **Commit at phase boundaries once the verifier is green. Do not push unless asked.**
- **New model work needs new gates.** A v3 feature without an invariant asserting its claim is not
  done. Write gates that can fail (§2.3).
- **Constants need anchors** (§2.1). An agent that cannot anchor a constant should surface that
  rather than inventing one.
- **Use worktree isolation** for any stage where parallel agents write to the same files —
  `policy.mjs` and `src/shell.html` are the contention points.
- **Adversarial verification** on anything touching the opinion layer: the repo's credibility rests
  on constants being defensible, so a second agent should try to refute each new one.

---

## 9. Explicit non-goals

- 7-max and 9-max seat ladders (4.8 — deferred to v4).
- Mobile / narrow-viewport layout (4.7).
- 5-card PLO.
- Any constant without an anchor (§2.1).
- Editing `index.html` directly — it is generated; edit `src/shell.html` and rebuild.
