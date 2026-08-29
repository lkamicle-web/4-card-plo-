# RUNDOWN v2 — PLAN

Scope agreed 2026-08-29. This document is the hand-off for the implementation session: what v2
contains, why, in what order, and what "done" means for each piece. It follows the same rules as
[METHODOLOGY.md](METHODOLOGY.md): the Monte Carlo layer is objective, the scoring layer is opinion,
and every new constant gets named, shipped in `constants`, and rendered by the Method view.

---

## 0. Scope

**In:**

1. **Stack-depth axis** — live slider (scoring layer), anchored by a new build-time measurement
   (the cooler rate, §2.1). No runtime simulation needed for depth itself.
2. **VPIP-filtered villains** — equity measured against opponents who fold their worst hands,
   not fully random ones. Closes limitation §10.1, the model's biggest named weakness.
3. **Straddle toggle** — modelled as a *transform* onto existing machinery (§4.3), not a new
   measurement.
4. **Sub-bucket expand-in-place UI** — consumes the 341-sub-bucket layer already shipped in
   `model.json` (123 cells × per-cell buckets with `eq[1..5]`, `nu`, `combos`, `label`, `ex`).
5. **Rake slider** — closes limitation §10.4. Pure scoring layer.
6. **Monte Carlo to N = 7** — closes limitation §10.5, removes the `EXTRAPOLATED` clamp badge
   at the iso node.
7. **In-browser Simulate button** — Web-Worker Monte Carlo with a chunked, stage-labelled
   progress bar ("Simulating 3.1M trials · cell 47/123 · ±0.35 pt"). The §10.9 frame-budget
   harness, built for real.

**Out (decided, not deferred by accident):**

- 5-card PLO mode (2.6M starting hands, new taxonomy — dilutes everything else).
- Street-by-street postflop realization simulation (the only version of depth that would be
  *measured* rather than scored; a v3-sized project on its own).
- Share/export (permalinks, printable charts).

**Non-negotiable carry-overs:** single file, offline, zero npm dependencies; measurement/opinion
split stated on every surface; painted width (not target width) everywhere a width is quoted;
every gate green before anything is emitted.

**The calibration constraint that makes v2 safe to build:** at depth 100bb, rake 0, straddle off,
random villains, the v2 pipeline must reproduce v1's tiers *exactly*, for every (node, position,
VPIP). All new machinery enters as multipliers/deltas that are identity at the v1 operating point.
This is invariant **I22** and it is the first gate to write.

---

## 1. Why depth needs no runtime simulation (the key architectural fact)

All-in equity does not change with stack depth. Every `eq[N]` number in the model is
depth-independent. Depth changes *realization* — what a mistake or a cooler costs you — which is
exactly the layer where `R(p, N, ν)` and `M_nut` already live. So:

- The depth slider is **live**, like the VPIP slider. No sim, no loading bar.
- What keeps it honest is a new **measured anchor** (§2.1) computed once at build time.
- The Simulate button therefore needs a different reason to exist, and it has one: VPIP-filtered
  villains (§3), which genuinely are a per-setting measurement.

The symmetry worth preserving in the code and the docs: **VPIP scales nut-weight through field
size (κ(N)); depth scales it through cost-when-wrong (λ(d), μ(d)).** Two dials on the same
machinery.

---

## 2. Workstream A — new build-time measurements (generator)

### 2.1 Cooler rate — `cooler`, the depth anchor

Per cell *and* per sub-bucket: the probability that, given the hand arrives at a **strong made
hand at showdown** (set or better: set, straight, flush, boat, quads, straight flush), it still
loses the pot. Piggybacks on the existing S2 showdowns — the evaluator already categorises both
hero and villain best-fives, so this is two counters per trial, near-zero added cost.

This is the measured content of "tens and jacks are the low end of top set." `TTxx` makes sets
that are top set less often and under-set more often than `JJxx`, which loses to `QQxx`, and so
on up to the AA rows. At 100bb a cooler costs a bet; at 250bb it costs a stack — so `cooler`
enters scoring with a weight that grows with depth (§4.1) and is inert at 100bb.

Sanity anchors the generator must land near (direction, not exact values — measure first, then
pin the measured numbers into the gate):

- `cooler` strictly decreasing up the pair ladder: TT-pair sub-buckets > JJ > QQ > KK > AA rows.
- Same row, suit columns: `cooler(SSA) < cooler(SS)` — your flushes are the nut ones.
- `2233r`-type cells near the top of the cooler table; `AA_BIGPAIR×DS` near the bottom.

New per-cell field `cooler` (float, 3 dp), per-sub-bucket likewise. Invariant **I24** asserts the
orderings above.

### 2.2 N = 6, 7 equity

Extend `eq[]` / `rho[]` to N = 7. One deal with seven villains still yields all N via villain
prefixes, so the cost is ~40% more work in S2, not a new stage. Kills the `N_eff 5.92 → clamped
5.00` badge at the iso node; the clamp code stays (clamped at 7 now) with the badge reserved for
whatever exceeds it (nothing currently does — iso max is 5.92).

**Decision (recommend yes): ν stays defined on `rho[5] − rho[1]`.** Redefining ν onto the [1,7]
span would silently move every ν-anchored constant in the model (`nuBar`, gate floors, `nuOOP`'s
0.01 margin). Keep the definition, note in METHODOLOGY that ν is a [1,5] slope by calibration
history, and let N=6,7 serve interpolation only.

### 2.3 Villain-VPIP equity lattice

Measure `eq[N]` per cell against **filtered villains** at five lattice points,
v ∈ {25, 40, 55, 70, 90} (the verify grid). Ship as **deltas from the random-villain baseline**,
rounded to 1 dp, to control size. Browser interpolates linearly in v between lattice points and
labels the numbers `interpolated`; the Simulate button re-measures exactly (§5).

Villain range definition — the circularity problem and its resolution: "a villain plays top X%"
needs an ordering, and using our own score `S` would make the model an input to its own
measurement. Freeze the ordering to something objective and model-independent: **equity vs one
random opponent** (`eq[1]`), computed once over all 270,725 hands in S0/S1. A villain at table
VPIP v rejection-samples hands from the top-v fraction of that fixed ordering.

One softening knob, shipped as a constant: `villainDiscipline q = 0.85` — each villain is drawn
from the filtered range with probability q and from fully random with probability 1−q, because
even a 25-VPIP lobby reg shows up with junk sometimes, and because a hard percentile cliff at the
range boundary is a fiction. q is opinion; it is in `constants` and the Method view says so.

Expected shape (write these as gate directions after first measurement, invariant **I25**):

- At v = 90 the filtered pool is nearly random: every cell within tolerance of baseline.
- As v tightens, junk cells (`TRASH`, `ACE_JUNK`, `K952r`-likes) lose the most equity.
- Low rundowns lose the *least* — and may gain — because the tight pool is broadway/AA-heavy
  and shares no ranks with them. This is §7's domination lesson appearing in the multiway
  measurement, and it is the single most valuable new number in v2.
- Conservation invariants I4/I5 apply **only** to random-villain measurements; document that the
  filtered pool is not zero-sum-uniform and exclude it from those gates explicitly.

### 2.4 Per-sub-bucket `mplay`

The sub layer ships `eq`, `nu`, `combos` but borrows its cell's `mplay`. Emit the real
combo-weighted `mplay` per sub-bucket (same formula, same pass as the cell version) so sub-bucket
verdicts in the expand UI (§6) are not diluted by their row-mates. Also emit per-sub `cooler`
(§2.1). Extends invariant I17's partition check to the new fields (weighted means must
reconstruct the cell value within rounding).

### 2.5 Size budget

`model.json` is 105 KB today. New payload: eq to N=7 (+2 floats/cell), `cooler` (+1/cell,
+1/sub-bucket), villain lattice (5 v-points × 7 N × 123 cells as 1-dp deltas), sub `mplay`.
Budget: **≤ 220 KB** pretty-printed, measured by a new D-gate so it cannot creep silently. If the
lattice blows the budget, drop to v ∈ {25, 55, 90} and say so here.

---

## 3. Workstream B — scoring layer: depth, rake, straddle (policy.mjs)

### 3.1 Depth

Slider `d ∈ [40, 250]` bb, default 100, log-ish detents at 40 / 100 / 200. One new multiplier:

```
M_deep(h, d) = 1 + λ(d)·(ν(h) − nuBar) − μ(d)·(cooler(h) − coolerBar)
λ(100) = 0,  μ(100) = 0                      ← identity at the v1 operating point (I22)
λ, μ monotone in d; λ negative below 100bb    (shallow: raw equity matters, nuttiness less)
```

Exact λ/μ curves are calibration work for the implementation session — pin them with anchors,
not vibes. Anchor set to calibrate against (directional, asserted by invariant **I23**):

- `AA72r`-type cells (high eq₁, low ν, mid cooler): tier non-increasing as d rises; at 40bb they
  should *gain* a tier somewhere (short stacks are where bare aces shine).
- `JT98ds` / rundown-DS cells: tier non-decreasing with depth.
- Big-pair rows with pair rank J/T (the motivating TT/JJ case): demoted at 200bb relative to
  100bb at at least one (position, node, VPIP) each, via the μ·cooler term.
- Painted width at every (node, pos, v): bounded drift across the full d range (reuse the I21
  dip-allowance pattern) — depth re-sorts, it must not collapse the range.

Positional realization spread widens with depth (position is worth more deep):
`base(p) → base(p)^(1 + β·(d−100)/150)` or a lerp — pick during calibration, keep β in constants.

vs-3-bet node: the 29% pot-odds breakeven is price, not depth — unchanged. What moves is the
continue *shape*: deeper favours the in-position call-and-cooler plan, shallower favours 4-bet.
Implement as a depth term on `nuCall`/`nuOOP` and on the 4-bet eqMix threshold; document beside
the existing §7 constants.

### 3.2 Rake

Slider `rakePct ∈ [0, 6]` % with a cap input in bb (`rakeCapBB`, default 3bb at 100bb scale),
default preset 5% — the lobby this tool is for. Model: rake is a haircut on won pots, so it
shifts every breakeven. Implementation: a flat multiplier on ρ for tier-cut purposes
(`rho_eff = rho · (1 − rakePct·capFactor)`) — crude, documented as such, and honest about the
direction §10.4 already states: every marginal hand moves toward fold. At the vs-3-bet node it
raises the 0.290 price directly (that one is exact arithmetic, not opinion).

### 3.3 Straddle

**Decision: UTG straddle only** (2×BB, straddler acts last preflop), the common loose-lobby form.
Modelled as a transform — no new measurement:

```
straddle ON ⇒
  effective depth   d → d/2            (stacks halve in straddle units — reuses §3.1 machinery)
  field             one extra blind-like defender: straddler joins N_eff with c_blind(v)
  seats             width bases shift one seat tighter (UTG opens under the straddle like a
                    de-facto UTG+straddler table; BTN keeps its base — calibrate in session)
  prices            all thresholds already scale-free in pot-odds terms; only the vs-3-bet
                    absolute price recomputes off the doubled preflop unit
```

Because straddle = shallower + one more player, and both of those dials already exist, the
whole feature is ~30 lines of node math plus UI chip plus gates. Directional gate (**I26**):
straddle on ⇒ painted RFI ranges tighten at every seat at fixed (d, v), and mean ν of the painted
range rises (shallow + multiway both point the same way once M_deep's λ flips sign below 100bb —
verify this composition explicitly; if λ(50) < 0 fights the field effect, the gate documents
which wins and why).

### 3.4 New/updated invariants (verify.mjs)

| # | Assertion |
|---|---|
| I22 | **v1 reproduction**: at d=100, rake 0, straddle off, random villains — tier-identical to v1 output for all (node, pos, v). First gate written, never removed. |
| I23 | Depth direction: the §3.1 anchor set, plus painted-width bounded drift across d. |
| I24 | Cooler sanity: pair-ladder ordering, SSA < SS same row, range [0,1], AA_BIGPAIR×DS near-bottom. |
| I25 | Villain filter: v=90 ≈ random within tol; junk loses most at v=25; rundown-DS cells lose least/gain; I4/I5 scoped to random-villain data only. |
| I26 | Straddle direction per §3.3. |
| I16/I21 analogues | Continuity and painted-width gates re-run across the d slider endpoints and the straddle toggle. |

---

## 4. Workstream C — in-browser Simulate (the button and the bar)

**When it appears:** the page always loads instantly on precomputed + interpolated data. Any
setting that leaves the measured lattice (off-lattice villain VPIP if the user wants exact
numbers, or a custom villain-discipline q) surfaces an `interpolated` badge and a **Simulate**
button. Depth/rake/straddle changes never trigger it (§1). The custom 3-bet mix stays a live
exact blend — no sim, as today.

**Engine:** `eval5.mjs` and `mc.mjs` are already dependency-free ES modules. `build.mjs` inlines
them as worker source; workers spawn from Blob URLs so the single-file/offline promise holds.
**Risk to retire first, before any other C work:** classic (non-module) Blob workers from a
`file://` page across Chrome/Safari/Firefox. Fallback if any target browser refuses: chunked
main-thread compute yielding via rAF — the §10.9 harness either way, just a worse duty cycle.
Write the spike, then commit to one path.

**Budget & honesty:** default 25k multiway trials/cell (≈3.1M total, ±0.35 pt vs the shipped
±0.16). Every simulated number carries a `simulated ±0.35` badge where shipped numbers say
nothing. Same seeded xorshift128 scheme keyed by (stage, cell, settings-hash) — reruns are
bit-identical, and the bar can resume after a tab-throttle without drift.

**The bar** (user-specified, pipeline-stage form): a segmented bar, one segment per pipeline
stage, filling in chunks of cells:

```
[███████████░░░░░░░░░░░░░]  Stage 1/2 — cell equity vs filtered villains
Simulating 3,075,000 trials · cell 47/123 · ±0.35 pt · ~18s left
```

Stages for a villain re-measure: (1) cell equity, (2) sub-bucket equity (only if the expand UI
is open on a custom setting — otherwise skipped and the bar says so). ETA from measured
trials/sec, not a guess. On completion: numbers swap in with the badge flip
`interpolated → measured (25k)`, and the result caches in `localStorage` keyed by settings-hash +
model hash, so revisiting a custom setting is instant. A `Re-run at 4× trials` link in the badge
tooltip for the suspicious.

---

## 5. Workstream D — sub-bucket expand-in-place UI

Data verdict: **feasible now** — `sub` ships 123 keys with per-bucket `eq[1..5]`, `nu`, `combos`,
`label`, and example hands. §2.4 adds per-sub `mplay` and `cooler` so verdicts are self-contained.

- Click / `Enter` on a cell → the cell expands in place into its sub-bucket rows (mean 2.77,
  max ~6), each with: label, combos, `oneIn`, eq at current N_eff, ν, and a **would-be tier** —
  the tier this bucket would earn if scored as its own cell at the current settings, shown with
  its margin. Label stays honest: buckets are not re-cut into the percentile sort (that would
  change every other cell's tier); the copy says `scored as-if standalone`.
- The TT/JJ story becomes visible here: inside the small-pair and big-pair rows, the high-pair
  buckets separate from their row-mates, and the depth slider moves them apart further via
  `cooler`.
- Keyboard nav descends into expanded rows and announces; structurally-empty sub-buckets don't
  exist (the layer only ships non-empty buckets), so no void handling needed.
- One cell expanded at a time; expansion state survives position/node/VPIP changes; Esc
  collapses.

---

## 6. Sequencing (each phase ends: `verify.mjs` green, `node --test` green, smoke pass)

| Phase | Content | Depends on |
|---|---|---|
| 1 | I22 harness first (freeze v1 output as fixture) · §2 generator work: cooler, N=7, villain lattice, sub mplay · I24/I25 · size gate | — |
| 2 | §3 policy: M_deep + rake + straddle, constants, calibration against anchors · I23/I26 · METHODOLOGY additions | 1 |
| 3 | §5 sub-bucket expand UI · depth/rake/straddle controls · Method view renders new constants + gates · tour additions | 2 |
| 4 | §4 Simulate harness (browser-worker spike FIRST) · progress bar · badges · localStorage cache · smoke coverage for the sim path | 1 (villain model), 3 (UI shell) |

Phase 4 last is deliberate: the button needs the villain lattice to exist so "off-lattice" is a
meaningful state, and the spike result (Blob workers on file://) can still reshape its internals
without touching anything shipped in phases 1–3.

## 7. Open questions for the implementation session (none block phase 1)

1. λ(d), μ(d) exact curves and β for the positional spread — calibrate against §3.1 anchors,
   then pin the measured outcomes into I23.
2. Straddle seat/width details: does BTN keep its 0.45 base under a straddle, and does the
   straddler get an iso node? (Lean: yes and no respectively, but measure the field first.)
3. `villainDiscipline q` default (0.85 proposed) and whether it is user-editable like the 3-bet
   mix (lean: yes, it's the same kind of pool knob).
4. Villain lattice density if the 220 KB budget bites: {25,55,90} + interpolation vs 5 points.
5. Whether the drill mode should quiz depth spots in v2 or stay VPIP-only (lean: stay, revisit
   in v2.1).
