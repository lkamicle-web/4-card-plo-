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

> **Measured (phase 1).** Full numbers in METHODOLOGY §3.2. Range 0.257 (`AA_BROADWAY × DS`) to
> 0.501 (`TRIPS_SMALL × RB`) across cells, 0.256 to 0.752 across sub-buckets, pool mean 0.3953.
> `cooler(SSA) < cooler(SS)` holds in **18 of 18** rows that have both. `DBLPAIR_SMALL × RB` (the
> 2233r cell) is 0.454, fifth from the top; `AA_BIGPAIR × DS` is 0.276, fourth from the bottom.
> **One anchor above is not expressible in this taxonomy**: `rowOf` splits pairs at J and the
> sub-bucket key's `highCardQuality` counts T-or-better, so TT, JJ, QQ and KK share rows and
> buckets. I24 can assert the three-step ladder small pairs 0.4386 → big pairs 0.3563 → AA rows
> 0.3184, not a five-step one. Separating the pair ranks is new rows, not a new measurement.

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

> **Measured (phase 1).** Full numbers in METHODOLOGY §3.3. Two of the three shape predictions
> above survived measurement and one did not — I25 must be written to the measurement, not to this
> list.
> - **v=90 is close to random but not equal to it**: mean |delta| 0.81 pt, worst cell 3.6 pt
>   (`BROADWAY_RUN × RB`). A tolerance under ~4 pt fails.
> - **Low rundowns gain, and gain most**: `RUN0_LOW × DS` +8.7 at N=1 and +9.6 at N=3,
>   `RUN0_LOW × SSA` +11.2 / +12.5. Confirmed, and it is the headline number.
> - **Junk does NOT lose the most.** `TRASH × RB` is −1.0 at N=1 and *+2.7* at N=3;
>   `SMPAIR_JUNK × SS` is −0.3 / +2.7. The biggest losers are broadway hands —
>   `BROADWAY_RUN × RB` −25.8 / −20.6, `RUN0_HIGH × DS` −19.0 / −14.4 — because a tight pool is
>   broadway-heavy and what a tight pool punishes is *rank overlap*, not weakness. `ACE_JUNK × RB`
>   (−7.2 / −2.4) is the only junk row that loses much, and it loses it to the aces in the pool.
> - I4/I5 remain scoped to the random-villain measurements. The filtered field is not uniform: the
>   combo-weighted mean delta is −1.36 pt at v=25 and −0.67 at v=90.

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

> **Measured (phase 1), and the decision: all five v-points ship.**
>
> | | minified (as emitted) | `JSON.stringify(m, null, 1)` |
> |---|---|---|
> | v1, committed | 105.1 KB (107,667 B) | 161.7 KB |
> | v2, 5 lattice rows | **142.7 KB (146,171 B)** | 241.6 KB |
> | v2, 3 lattice rows | 134.6 KB (137,854 B) | 221.0 KB |
>
> The ceiling above is read against the file **as emitted**, where 142.7 KB sits comfortably inside
> 220 KB. Two reasons, in order:
> 1. The 220 KB is stated against "`model.json` is 105 KB today", and that 105 KB is the minified
>    file — v1 pretty-prints to 161.7 KB. The two numbers in the same sentence have to be on the
>    same basis.
> 2. Read literally as a pretty-printed ceiling, **this section's own remedy does not satisfy it**:
>    dropping to three v-points still pretty-prints to 221.0 KB. A rule its own escape hatch cannot
>    meet is the wrong reading of the rule.
>
> Dropping to three points also costs real accuracy, which is the argument that would matter if the
> budget were close. Reconstructing the measured v=40 row by interpolating {25, 55} misses by up to
> **1.80 pt** (p95 0.80, sd 0.39); v=70 from {55, 90} misses by up to 1.01 (p95 0.43). Against a
> shipped precision of 0.1 pt and a measurement SE of 0.16, that is not rounding — the delta curve
> is genuinely convex in v between 25 and 55, which is exactly the interval a loose-lobby tool
> cares about.
>
> Component sizes: cells 62.2 KB, sub 69.5 KB, meta+tables 10.6 KB. Gate D6's sub-budgets are
> raised to 65 / 72 / 13 / 150 KB with the reasoning stated at the gate.
>
> **The D-gate this section asks for is now written: D7**, and it reads the 220 KB against the
> file *as emitted* (146,551 B = 143.1 KB, 35% headroom — the table above reads 146,171 B because
> it was measured before the phase-1 and phase-2 gate names and constant blocks were stamped into
> the same payload; METHODOLOGY §9.10 carries the byte-by-byte accounting) for the two reasons above. The pretty-printed figure is printed in D7's and
> D6's detail lines on every run — 241.7 KB — and is
> recorded rather than asserted, precisely so that the reading this section settled on cannot be
> mistaken for the pretty-printed one going unmeasured. D6 keeps the tighter per-block budgets that
> catch a creeping payload; D7 is this section's contract and is deliberately slack against D6.
> Full write-up: METHODOLOGY §9.10.
>
> One thing this budget does not cover, and should: the model is injected verbatim into
> `index.html`, which is **already 419.1 KB against its own 400 KB build gate** before v2 adds
> anything. With the 5-row model the page would be ~456.6 KB (~448.5 KB with 3 rows). Phase 3 has
> to deal with that; shipping two fewer lattice rows would not have saved it.

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

> **Calibrated (phase 2).** Constants, derivations and full anchor outcomes in METHODOLOGY §5.1;
> I23/I27/I28 are written. `lambda = 0.25`, `mu = 0.60`, `beta = 0.35`, `coolerBar = 0.40`,
> `nuFloor = 0.015`, `fourBet = 0.06`, all on a **logarithmic** depth coordinate
> `u(d) = log2(d/100)/log2(2.5)`, which is ±1 at the endpoints because the slider's domain is
> geometrically symmetric about its reference (100/40 = 250/100 = 2.5). **Two of this section's
> four anchors survived as written, one had to be restated in a different unit, and one is false.**
>
> - **`AA72r` — survived.** `AA_DANGLER×RB` has 0 monotonicity violations and gains a tier at 40 bb
>   at 8 of 105 settings, all at `raise/BTN` and `raise/SB`.
> - **Rundown-DS — restated. "Tier non-decreasing with depth" is not an assertable claim**, and the
>   reason is structural rather than about rundowns: a tier here is a **percentile cut, not a
>   property of the cell**, so a cell whose own `M_deep` rises is still demoted when the cells above
>   it rise faster. Measured, the claim fails in both directions at once — `RUN0_HIGH×DS` and
>   `BROADWAY_RUN×DS` never change tier at any depth (true and vacuous), `RUN2×DS` and
>   `RUN1_TOPMID×DS` change tier both ways. In **score rank** it holds and I23 asserts it there.
> - **And it is outright false for the LOW rundowns.** `RUN0_LOW×DS` — 5432ds and the wheel — gets
>   *worse* with depth (worse rank at 250 than at 40 at 49 of 75 settings, better at 9), because
>   `RUN0_LOW` carries the highest `cooler` in the rundown band (0.4268, against a 0.40 bar) while
>   its ν of 0.43 is a whisker over `nuBar`, so the μ term overrules the λ term. I23 asserts the
>   falsified form. This is the most useful thing the depth dial says.
> - **J/T big pairs via the μ term — false, for the same taxonomy reason that broke §2.1's five-step
>   cooler ladder.** `rowOf` splits pairs at J, so JJ/QQ/KK share the big-pair band and TT sits with
>   the small pairs; combo-weighted the big-pair band's `cooler` is 0.3563, *below* the bar, so μ
>   **promotes** 21 of its 23 cells with depth. Measured at 200 bb: 46 big-pair demotions, every one
>   attributable to λ and **not one** to μ, against 92 μ-attributable demotions over 7 cells, every
>   one a small pair or `RUN0_LOW`. The small-pair band (0.4386) is the one μ punishes.
> - **Painted width — survived.** Worst drift 3.16 pts against I21's 4.0 allowance; narrowest
>   painted range 12.6% at any depth against I12's 10% floor.
> - **Positional spread: the power form, not the lerp, and not linear in `d`.** The power form
>   amplifies the edge a seat already has and leaves a neutral seat alone (HJ moves 0.0035 across
>   the whole slider, SB moves 0.033 — one step of `baseR`). `|β| < 1` is a hard constraint: above
>   it the exponent goes negative at 40 bb and the seat table inverts. I23(f) asserts the order.
> - **"Shallower favours 4-bet" is not expressible through the 4-bet threshold on this grid.** All
>   21 AA-row cells that can 4-bet measure 54.3–65.1% eqMix against the default mix, a 4.3-point gap
>   above the 50% bar, so a falling bar has nothing to add. Only the deep half of that anchor is
>   implemented. Moving the bar also exposed a **missing rung**: an AA row that fails the 4-bet bar
>   used to fall through to the nut floors and fold at 54% into a 29% price. AA rows are now exempt
>   from those floors (unreachable at the v1 operating point, so I22 is untouched).
> - **§3.2's stated rake model is tier-inert as written.** A flat multiplier on ρ scales every
>   score, every cut and every margin equally and re-orders nothing at the three percentile nodes.
>   Recorded here so the follow-up worker does not implement it and then hunt for the effect.
>   *(Phase 2B: implemented as written, and the prediction confirmed exactly — 0 of 27,675 tiers
>   move. It is now asserted by gate I31(a) rather than merely expected. See §3.2.)*

### 3.2 Rake

Slider `rakePct ∈ [0, 6]` % with a cap input in bb (`rakeCapBB`, default 3bb at 100bb scale),
default preset 5% — the lobby this tool is for. Model: rake is a haircut on won pots, so it
shifts every breakeven. Implementation: a flat multiplier on ρ for tier-cut purposes
(`rho_eff = rho · (1 − rakePct·capFactor)`) — crude, documented as such, and honest about the
direction §10.4 already states: every marginal hand moves toward fold. At the vs-3-bet node it
raises the 0.290 price directly (that one is exact arithmetic, not opinion).

> **Implemented (phase 2B).** Constants, derivations and measurements in METHODOLOGY §5.2; gate
> **I31** is written. One fraction carries the feature —
> `rakeFrac = min(rakePct/100, rakeCapBB / (potBB · unitBB))`, which is this section's
> `rakePct · capFactor` with `capFactor = min(1, rakeCapBB / (rakePct/100 · potBB · unitBB))` — and
> it needed one new authored constant, `rake.potBB = 60`, the reference raked pot in preflop units,
> because a cap quoted in big blinds means nothing without a pot to cap. 60 puts the 5% default
> preset exactly on the cap's knee (3/60 = 5%), which is also where real 5%/3bb lobbies sit.
> `rake.preset = 5` is shipped for the phase-3 slider; the *function* default stays 0 so I22 is the
> identity. Depth does **not** move the rake, and rake does **not** move the 4-bet bar (that is a
> comparison against a range, not a price hero is being laid; and `0.50/(1−0.05) = 0.5263` is inert
> inside the same 4.3-point gap §3.1 measured anyway).
>
> - **This section's own model is tier-inert at the three percentile nodes, and that is now
>   asserted rather than lamented.** Measured at the preset over 27,675 cell-settings: 0 tiers move,
>   every score moves, and every score ratio equals `1 − rakeFrac` to within 2 ulp. I31(a) pins it,
>   so turning rake into a non-uniform haircut has to be a deliberate model change with its own
>   argument. (Predicted at the `rakeRhoFactor` seam during phase 2A; the implementation confirmed
>   it exactly.)
> - **"Raises the 0.290 price directly" needed an interpretation, and it is named as one.** In v1
>   that price was *display-only* — quoted in the WHY panel, consulted by nothing — so raising it
>   would have changed no decision and made this section's own promise false. The model's reason
>   line has always described the continue floor as "the price plus 7 points, because a 3-bet pot is
>   played out of position over three streets", so the price moves by exact arithmetic
>   (`breakeven / (1 − r)`, 29% → 30.53% at the preset) and the floor rides on it with the 7-point
>   premium invariant (36% → 37.53%). Measured effect: the vs-3-bet continue range narrows
>   monotonically in `rakePct` on the action tier, 45 → 41 cells at UTG and 49 → 44 at CO across
>   0–6%. The alternative — leave the floor at 0.36 and let rake change only the panel's text — was
>   considered and rejected.

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

> **Implemented (phase 2B).** Full write-up in METHODOLOGY §5.3; gates **I26** (direction and
> composition), **I29** (I16's continuity across the toggle) and **I30** (I21's painted widening
> across the toggle) are written. Two constants: `straddle.unit = 2` — the preflop unit doubles,
> which is the *whole* fact — and `straddle.seat = 0.77`, one seat of `baseRaise`'s own ladder as a
> geometric mean of its UTG→HJ (×1.250) and HJ→CO (×1.350) steps.
>
> - **λ(d/2) < 0 DOES fight the field effect, and the field wins.** Isolated at matched width (the
>   I11b construction) over 150 RFI settings: field-only **+0.286** pts of mean ν with 0 of 150
>   going the other way, depth-only **−0.144** with 76 down, both **+0.183** with 20 down — the
>   composed transform keeps **64%** of the field effect (44% on 10k-trial data). The reason is
>   worth carrying, because on the ν coefficient alone the depth half *should* win: Δκ =
>   0.13·cBlind(v) is +0.032…+0.107 against λ(d/2) − λ(d) = **−0.189 flat**, 2–6× smaller. What
>   completes the field's margin is the MEASUREMENT — the multiway realization slope (+0.027…+0.122
>   per unit ν) and ρ read further up its own N curve (I3's inversion). The margin is thinnest where
>   κ has least to give: at VPIP 25 it is +0.076 pts with 11 of 30 settings going the other way.
>   I26(c) asserts each half separately, so a change that reverses the verdict fails with the
>   decomposition in its detail line.
> - **§7.2's "BTN keeps its base" is FALSIFIED, by I26's own claim.** With BTN pinned the button's
>   painted range gets *wider* under a straddle at 7 of its 30 settings (up to +2.49 pts, worst at
>   VPIP 25 / 40 bb; 16 of 30 on 10k-trial data) and its mean ν falls at 8 — and a straddle cannot
>   make the button open wider, it puts one more player behind him. So the seat factor applies at
>   every seat and `straddle.seatPinned` ships empty. Candidates measured: no shift at all (48 of
>   150 loosen — the field and depth halves alone cannot carry the gate), BTN pinned (7), BTN+SB
>   pinned (19), every seat (**0**, 150/150 tighter, 148/150 nuttier). §7.2's other lean — no
>   straddler iso node — is kept.
> - **"Painted RFI tightens at every seat" is true; the same claim at the vs-RAISE node is false and
>   is reported rather than asserted.** `w3bet` is a flat percentile with no seat base, so the
>   transform has nothing to act on there: measured 47 tighter / 77 looser / 26 unchanged. A
>   straddle tightens the range you **open**, not the range you 3-bet with.
> - **"Only the vs-3-bet absolute price recomputes off the doubled unit" resolves to the rake cap,
>   and to nothing else.** Every threshold in the model is a ratio and therefore scale-free; the cap
>   is the single quantity quoted in big blinds against a pot quoted in preflop units. Under a
>   straddle the same pot is twice as many big blinds, so the cap binds twice as hard and the
>   effective rake *falls* — 5% becomes 2.5% at the shipped 3bb cap. At rake 0 the straddle moves no
>   price at all, which is the sentence's real content.
> - **Unmodelled, and listed in METHODOLOGY §10:** under a straddle the BB no longer closes the pot,
>   so `positionDisabled('BB', 'rfi')` is wrong — that is a change to the game tree and to the grid
>   the page paints, not to the scoring layer, and it is not made here.
> - **Side-effect worth knowing:** the straddle's depth half **saturates below 80 bb**, because 40/2
>   is off the bottom of the §3.1 dial and `dEff` clamps like every other depth.

### 3.4 New/updated invariants (verify.mjs)

| # | Assertion |
|---|---|
| I22 | **v1 reproduction**: at d=100, rake 0, straddle off, random villains — tier-identical to v1 output for all (node, pos, v). First gate written, never removed. |
| I23 | **Written (phase 2), to the measurement.** Depth direction over d = 40/60/100/150/200/250 at all 105 settings: the `AA72r` anchor as written (0 violations, 8 settings gaining a tier at 40 bb); the rundown anchor restated in **score rank**, because a tier is a percentile cut and not a property of a cell; the low-rundown case asserted in its **falsified** form (`RUN0_LOW×DS` worse at 250 than at 40 at 49 of 75 settings against 9 better); μ-attributable demotions exist and **none is a big pair**, which is the §3.1 J/T anchor's falsification asserted rather than dropped; painted-width drift ≤ 4.0 pts and painted floor ≥ 10%; I7/I8/I9/I13/I19 re-run at both endpoints; and the seat order preserved with the positional spread widening, which is what catches `|β| ≥ 1`. Full write-up: METHODOLOGY §5.1. |
| I24 | **Written (phase 1), to the measurement.** Cooler sanity: the three-step *band* ladder AA 0.3184 < big pairs 0.3563 < small pairs 0.4386 (≥ 0.03 per step) — the five-step pair ladder §2.1 asked for is not expressible in this taxonomy, and the ladder is not monotone per row inside a band either; `cooler(SSA) ≤ cooler(SS) + 0.01` in all 18 rows carrying both (18/18 strict today, tolerance because the thinnest margins are ~1 SE); range [0,1] plus the measured envelope; `DBLPAIR_SMALL×RB` in the top 8 and `AA_BIGPAIR×DS` in the bottom 8 of 123 cells (measured ranks 5 and 4); `coolerBarMeasured` rebuilds from the shipped cells. |
| I25 | **Written (phase 1), to the measurement — and one bullet of §2.3 is *not* asserted, because it is false.** v=90 converges without equalling random (mean abs delta ≤ 1.2, worst cell ≤ 5.0; measured 0.81 / 3.6), and mean abs delta falls monotonically along the lattice; at v=25 the six worst cells at N=1/3/5 all lie in {`BROADWAY_RUN`, `RUN0_HIGH`} — *rank overlap*, not weakness — and the six best all lie in {`RUN0_LOW`, `RUN1_TOPMID`, `RUN1_BOTTOM`}, every `RUN0_LOW` cell gaining at every N; combo-weighted mean delta negative at every lattice point, which is the I4/I5 scope decision stated positively. The "junk loses most" bullet is reported in the gate's detail line (`TRASH×RB` +2.7 at N=3, a gain) and asserted nowhere. |
| I26 | **Written (phase 2B), to the measurement.** Straddle direction over 5 RFI seats × 5 VPIP × 6 depths: the painted OPENING range tightens at every seat (150/150 rfi, 150/150 iso) and gets nuttier (148/150, 150/150); §7.2's "BTN keeps its base" is falsified and the falsification is what decides `straddle.seatPinned`; the composition §3.3 asked about is decomposed at matched width and **the field beats λ(d/2)**, keeping 64% of its own effect; I6/I7/I8/I9/I10/I13/I19 re-run straddled at 40/100/250 bb; and the transform's own arithmetic is asserted exactly. The vs-Raise node is measured (47 tighter / 77 looser / 26 unchanged) and deliberately not asserted. Full write-up: METHODOLOGY §5.3. |
| I29/I30 | **Written (phase 2B)** — the straddle half of the I16/I21 analogues, at 40 / 100 / 250 bb with the toggle on. Neither needed a widening: I29's worst non-cliff step is 0 cells, I30's worst dip is 2.86 pts against I21's own 4.0 (better than the unstraddled 3.16). I30 does carry its own painted floor, 8% rather than I12's 10%, because a straddled UTG opens 8.96% at VPIP 25 and that is the seat transform working, not a range collapse. I29's finding is the mirror of I27's: depth leaves the N_eff = 3.0 cliffs where they are, the straddle drags all of them forward (raise/HJ 45→34, CO 54→39, BTN 70→47) and adds a fifth at raise/SB. |
| I31 | **Written (phase 2B), to the measurement.** Rake per §3.2: (a) the flat haircut is tier-inert at the three percentile nodes BY CONSTRUCTION — 0 of 27,675 tiers move at the 5% preset, all 27,675 scores do, every ratio equals 1 − rakeFrac to 2 ulp — asserted so that making it non-uniform has to be a deliberate model change; (b) at the vs-3-bet node the continue range narrows monotonically in rakePct on the action tier (45→41 cells at UTG, 49→44 at CO); (c) the arithmetic is exact, including the straddle interaction on the cap. |
| I27/I28 | **Written (phase 2)** — the depth half. I27 is I16's continuity and I28 is I21's painted widening, both re-run at 40 and 250 bb. I27 needed no widening at all. I28's dip allowance is widened from 4.0 to 6.5 pts because the worst event at 250 bb is a simultaneous three-cell exchange (net 5.45 pts at rfi/BTN VPIP 82), not the single-cell flicker I21 sized against. The straddle half is I29/I30 below. |
| D7 | **Written (phase 1).** §2.5's payload ceiling, on `model.json` as emitted: 146,551 B = 143.1 KB of 220 KB. Not an invariant, listed here because it was commissioned with I24/I25. |

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

### 5.1 Hand search (added 2026-08-29, ships with Phase 3)

- Input: a rank string (any order, e.g. `9655` = `5569`) plus an optional suit-class suffix —
  `9655R`/`9655RB`, `9655SS`, `9655SSA`, `9655DS`, `9655F`. `T`/`J`/`Q`/`K`/`A` accepted for
  broadway ranks. Parser canonicalizes the rank string to the taxonomy's rank-pattern before
  lookup, so order never matters.
- Suffix map, read off `taxonomy.mjs`'s actual `COL_ORDER` (`RB`, `FLAW`, `SS`, `SSA`, `DS`):
  `R`/`RB` → `RB`, `SS` → `SS`, `SSA` → `SSA`, `DS` → `DS`. **`F` ("flaw") → `FLAW`, narrowed to
  its monotone population.** The taxonomy has no column of its own for four-of-one-suit: `colOf`
  maps both pattern `31` (three-flush) and pattern `4` (monotone) onto the single `FLAW` column
  ("suit-wasted"), so a bare rank+`FLAW` lookup can't tell them apart at the cell level. The
  sub-bucket layer can: `suitSub` keys three-flush as `ms3` and monotone as `ms4`. `F` resolves to
  the `FLAW` cell's `ms4` sub-bucket (the other three sub-key fields — pair structure,
  connectivity, high-card quality — are already pinned by the ranks) wherever that sub-bucket is
  non-empty. Three-flush has no suffix of its own this phase; out of scope.
- Resolution ladder: rank string alone pins the row (`rowOf` is rank-only — same row in all five
  columns); rank + suffix pins the cell; rank + `F`, and incidentally rank + any suffix once the
  ranks are fully specified, pins a single sub-bucket, because the suit axis is the only
  sub-bucket field the suffix doesn't already fix.
- Behavior: resolves to the taxonomy cell at current settings, scrolls to and highlights it. When
  the shape pins a specific sub-bucket, opens §5's expand-in-place view with that sub-bucket
  highlighted. A bare rank string with no suffix highlights the rank-row across all suit columns
  instead of expanding anything.
- Keyboard: reachable by shortcut, consistent with §5's existing nav; `Esc` clears the search and
  any resulting highlight/expansion; matches and no-match both announced for screen readers, the
  same pattern §2.3 uses for void-cell announcements.
- Pure client feature: a rank/suit parser plus a lookup against the already-shipped
  `cellKeys`/`subs` structures — no new measurement, no new `model.json` field. Its bytes count
  against Phase 3's UI-shell size budget.

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
   **Resolved (phase 2).** λ = 0.25 anchored to κ's own swing (2λ = 0.50 against κ's 0.520, i.e.
   depth gets 96% of the authority field size has over nut weight); μ = 0.60 anchored to the two
   measurements' combo-weighted standard deviations (λ·sd(ν)/sd(cooler) = 0.589); β = 0.35 anchored
   to `baseR`'s own seat steps — the deep end of the slider is worth about one seat of position.
   All three on a logarithmic depth coordinate. Anchor outcomes, including the two falsifications,
   are annotated in §3.1 above and written into I23.
2. Straddle seat/width details: does BTN keep its 0.45 base under a straddle, and does the
   straddler get an iso node? (Lean: yes and no respectively, but measure the field first.)
   **Resolved (phase 2B): NO and no — the first lean is falsified, the second is kept.** Measured,
   pinning BTN's base makes I26's own claim false: the button's painted range gets *wider* under a
   straddle at 7 of its 30 (VPIP, depth) settings, by up to 2.49 points, and its mean ν falls at 8.
   A straddle puts one more player behind the button; it cannot widen his opening range. So the
   0.77 seat factor applies at every seat and `straddle.seatPinned` ships empty. The straddler
   still gets no iso node: he is modelled as one extra blind-like defender in `N_eff`, never as a
   hero seat. Working, and the three rejected candidates, in METHODOLOGY §5.3.
3. `villainDiscipline q` default (0.85 proposed) and whether it is user-editable like the 3-bet
   mix (lean: yes, it's the same kind of pool knob).
   **Resolved (phase 1) for the generator half only:** q = 0.85 as proposed, shipped as
   `constants.villainLattice.discipline` and labelled opinion in METHODOLOGY §3.3. Whether the page
   exposes it is still open, and is a phase-3/4 question — an off-lattice q is exactly the state
   the Simulate button (§4) exists for.
4. Villain lattice density if the 220 KB budget bites: {25,55,90} + interpolation vs 5 points.
   **Resolved (phase 1): all five ship.** The budget does not bite on the emitted file (142.8 KB of
   220 KB), the three-point fallback would not have satisfied the literal pretty-printed reading
   either (221.0 KB), and interpolating v=40 out of {25,55} misses the measured row by up to
   1.80 pt. Full working in §2.5 above; the ceiling is now enforced on that basis by gate **D7**,
   which reports both readings on every run.
5. Whether the drill mode should quiz depth spots in v2 or stay VPIP-only (lean: stay, revisit
   in v2.1).
