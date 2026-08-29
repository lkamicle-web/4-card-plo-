# METHODOLOGY

Everything RUNDOWN does to a hand, in order, with every constant named. If a number appears on
screen, its derivation is on this page.

Two rules govern this document:

1. **The `constants` object in `data/model.json` is the source of truth for values.** The app's
   Method view renders that object directly, so the app can never document a constant it isn't
   using. Where a number is quoted below, it is quoted as authored in the spec; if you have
   changed a constant, trust the data and the Method view over this prose.
2. **Where measurement and folklore conflict, measurement wins and the conflict is written
   down** (§9), never quietly reconciled.

---

## 0. Honesty statement

This is **not** a GTO solver and does not approximate one. PLO preflop solutions are not
publicly solved to equilibrium at 6-max with realistic stacks. What this tool ships is a
**transparent heuristic model**: for each starting hand we measure, by Monte Carlo, its equity
against *N* random opponents for N = 1..5, derive two numbers (raw strength, and how well the
hand *scales* into multiway pots), combine them with a documented scoring formula, and cut the
result at percentile thresholds that vary with position, action and table looseness. Every
constant in the formula is listed in the README and every one is a judgement call. The model's
job is to make the *shape* of good PLO preflop reasoning legible and explorable, not to be an
oracle. The Monte Carlo layer is objective; the scoring layer is opinion.

The split matters and is worth restating in operational terms:

| Layer | Status | How to attack it |
|---|---|---|
| 5-card evaluator, Omaha 2-of-4 rule, RNG | Objective, gated by exact combinatorial counts | Run `node --test test/`; V5 asserts the nine exact C(52,5) category counts |
| Equity measurement (`eq[1..5]`, `eqVs3bet`) | Objective up to Monte Carlo error (±0.16 pt/cell) | Re-run with a different seed; cross-check against `equity-ref.mjs` |
| ν, `M_nut`, `M_play`, `R(p)`, tier widths, gates | **Opinion**, informed by measurement | Edit `constants`, regenerate, watch the matrix move |

---

## 1. Card and hand model

```
rank r ∈ 0..12   ('2'=0, '3'=1, … 'T'=8, 'J'=9, 'Q'=10, 'K'=11, 'A'=12)
suit s ∈ 0..3    (s, h, d, c)
card c = r*4 + s                       0..51
hand   = a set of exactly 4 cards      C(52,4) = 270,725
```

The ace is high (12) for pair and kicker purposes and additionally plays low (rank −1) for
straights and connectivity. **Every connectivity computation is wheel-aware**: compute it with
A = 12 and again with A = −1, and take the better (smaller-gap) result. Throughout,
`r1 ≥ r2 ≥ r3 ≥ r4` are the four ranks sorted descending.

---

## 2. Taxonomy — the 29 × 5 grid

A 13×13 grid works for Hold'em because it has 169 strategically distinct hands. PLO has 270,725.
The only tractable visualization is a class grid: rows = rank-structure archetype, columns =
suit topology. The two axes are chosen because they are the two things a PLO player actually
reasons about, and because rank structure and suit structure are drawn close to independently —
so a rows × columns grid has meaningful cells almost everywhere rather than a sparse diagonal.

**The grid partitions all 270,725 hands exactly.** Gate D1 asserts this by full enumeration; the
generator refuses to emit otherwise.

### 2.1 Columns — suit topology (display order worst → best)

Take the multiset of suit-counts of the four cards, sorted descending. Only five patterns exist:
`4`, `31`, `22`, `211`, `1111`.

| Order | Key | Label | Rule | Combos | % |
|---|---|---|---|---|---|
| 1 | `RB` | Rainbow | pattern `1111` | 28,561 | 10.550 |
| 2 | `FLAW` | Suit-wasted | pattern `31` (three-flush) or `4` (monotone) | 47,476 | 17.537 |
| 3 | `SS` | Single-suited | pattern `211`, suited pair **not** ace-topped | 133,848 | 49.441 |
| 4 | `SSA` | Single-suited, nut | pattern `211` **and** the two-card suit contains the ace | 24,336 | 8.989 |
| 5 | `DS` | Double-suited | pattern `22` | 36,504 | 13.484 |

Notes that carry real weight:

- **`SS` is half of all PLO hands.** The modal PLO hand is single-suited to a non-ace card. This
  is itself a teaching point, and it is why the True-frequency column mode exists: with equal
  columns the eye reads five comparable populations, which is a lie about how often you are
  dealt each one. You are dealt the wrong flush about 5.5× as often as the right one
  (133,848 vs 24,336).
- **`FLAW` is placed last-but-one for playability, not equity, and that is deliberate.** In raw
  equity a three-flush and a monotone hand are slightly *better* than a rainbow: on `JT98`,
  rainbow 49.39%, monotone 50.71%, three-flush 51.48%. The fourth suited card adds a sliver of
  raw equity but is redundant — it removes one of your own flush outs and adds no new nut draw.
  The model expresses this with an explicit `M_play` penalty (§5), **never by faking the equity
  number**. Invariant I1 asserts `eq(FLAW) ≥ eq(RB)` for exactly this reason: if it ever fires,
  the evaluator has a suit bug.
- **`SSA` vs `SS` barely separates in raw equity** — `AJT9` ace-suited 56.31% vs J-suited 55.79%,
  a mere +0.52 pt. The difference is realization, not equity. This one measurement is the entire
  argument for ν and `M_nut` existing as separate machinery (§4, §5). It ships as the SSA column
  tooltip in the app.

A separate boolean `nutSuited` (at least one suited pair is ace-topped) is true for **45,880
hands (16.95%)**. It feeds scoring but is not a display column. An `AAxx` double-suited hand is
automatically double-***nut***-suited — the two aces are the only repeated rank available to top
a suit — which is a large part of why AAxx-ds is the best structure in the game.

### 2.2 Rows — 29 rank archetypes, strict first-match-wins cascade

Helpers, all wheel-aware:

- `G` = total gap of four distinct ranks = `r1 − r4 − 3`. `G = 0` is a perfect rundown (JT98).
- `gapVec = [r1−r2−1, r2−r3−1, r3−r4−1]` in the orientation minimizing the sum. **Gap position
  matters**: a gap at the bottom (`JT97`) costs far less than one at the top or middle
  (`J987`, `JT87`), because the top card still tops every straight the hand makes.
- `best3Span` = the smallest `max − min` over the four 3-card subsets. 2 = perfect 3-run.
- `isDoubleConnector` = `(r1−r2 ≤ 2) && (r3−r4 ≤ 2) && (r2−r3 ≥ 4)`.
- pair-cluster `span` = max − min of the three distinct ranks in a one-pair hand; `conn = span ≤ 4`.
- `danglerCount` = cards in neither a pair nor any 3-card cluster of span ≤ 4, capped at 2.

First match wins. This is what guarantees the partition.

| # | Key | Label | Rule | Combos |
|---|---|---|---|---|
| 1 | `AA_BIGPAIR` | AA + big pair | exactly 2 aces; other two equal, ≥ J | 108 |
| 2 | `AA_BROADWAY` | AA + two broadway | 2 aces; other two unpaired, both ≥ T | 576 |
| 3 | `AA_CONNECTED` | AA + connectors | 2 aces; other two unpaired, `x − y ≤ 3` | 2,304 |
| 4 | `AA_SMALLPAIR` | AA + small pair | 2 aces; other two equal, ≤ T | 324 |
| 5 | `AA_DANGLER` | AA + dangler | 2 aces; remainder | 3,456 |
| 6 | `A_BLOCKED` | Trip/quad aces | ≥ 3 aces | 193 |
| 7 | `DBLPAIR_BIG` | Two big pairs | two pairs, no AA, both ≥ T | 216 |
| 8 | `DBLPAIR_MIXED` | Big pair + small pair | two pairs, no AA, high pair ≥ J | 864 |
| 9 | `BIGPAIR_CONN` | Big pair + connectors | one pair ≥ J, `conn` | 3,456 |
| 10 | `BIGPAIR_ACE` | Big pair + ace | one pair ≥ J, ace kicker, not `conn` | 2,304 |
| 11 | `BIGPAIR_JUNK` | Big pair + junk | one pair ≥ J, remainder | 13,248 |
| 12 | `TRIPS_BIG` | Big trips/quads | trips or quads of rank ≥ J | 579 |
| 13 | `BROADWAY_RUN` | Broadway run | 4 distinct, all ≥ T | 1,280 |
| 14 | `RUN0_HIGH` | High rundown (0-gap) | `G = 0`, top card **in the gap-minimising orientation** ≥ J | 512 |
| 15 | `RUN0_LOW` | Low rundown (0-gap) | `G = 0`, top card in that orientation ≤ T | 1,792 |
| 16 | `RUN1_BOTTOM` | 1-gap, bottom | `G = 1`, gap at `gapVec[2]` | 2,304 |
| 17 | `RUN1_TOPMID` | 1-gap, top/middle | `G = 1`, gap at `gapVec[0]` or `[1]` | 4,608 |
| 18 | `RUN2` | 2-gap rundown | `G = 2` | 13,824 |
| 19 | `RUN3` | 3-gap rundown | `G = 3` | 20,480 |
| 20 | `ACE_RUN3` | Ace + 3-card run | 4 distinct, `G ≥ 4`, `best3Span ≤ 3`, ace present | 11,264 |
| 21 | `RUN3_DANGLER` | 3-run + dangler | 4 distinct, `G ≥ 4`, `best3Span ≤ 3`, no ace | 23,040 |
| 22 | `DBL_CONNECTOR` | Two connector pairs | 4 distinct, `isDoubleConnector` | 18,432 |
| 23 | `DBLPAIR_SMALL` | Two small pairs | two pairs, both ≤ 9 | 1,296 |
| 24 | `SMPAIR_CONN` | Small pair + connectors | one pair ≤ T, `conn` | 13,824 |
| 25 | `SMPAIR_ACE` | Small pair + ace | one pair ≤ T, ace kicker, not `conn` | 8,064 |
| 26 | `SMPAIR_JUNK` | Small pair + junk | one pair ≤ T, remainder | 35,136 |
| 27 | `TRIPS_SMALL` | Small trips/quads | trips or quads ≤ T | 1,737 |
| 28 | `ACE_JUNK` | Ace + junk | 4 distinct, no structure, ace present | 30,464 |
| 29 | `TRASH` | Trash | everything else | 55,040 |

**Total 270,725.**

**The 0-gap split is wheel-aware, and that matters.** `G` is already computed in whichever ace
orientation minimises the gap (§1), so `A432` reaches row 14/15 as a *perfect* rundown — scored
with the ace playing low. The high/low test therefore has to read the top card **in that same
orientation** (`taxonomy.topInGapOrientation`), or it grades a hand it admitted as `432A` on a card
the admitting computation never used. `A432` is a wheel rundown, not a high rundown, and files as
`RUN0_LOW`. Reading `r1` naively instead put all 256 wheel combos in `RUN0_HIGH`, where they
diluted the pure-broadway cells (`JT98`/`QJT9`) enough to fold them: the `RUN0_HIGH×RB` cell
measures **eq₁ 50.4, ν 0.41** on its own and blended to 54.3 / 0.32 with the wheel mixed in.
Consequence for the row table above: `RUN0_HIGH` is **512** combos and is now an **aceless** row —
its `SSA` cell is one of the 22 structurally empty ones — while `RUN0_LOW` is **1,792** and owns
the wheel, including a populated `SSA` cell. **The shipped advice moved, in both directions:**
rainbow high rundowns (`JT98r`, `QJT9r`) go from FOLD to a T1 open at HJ/CO/BTN/SB/BB (T2 at UTG),
and the wheel cell `A432` single-suited-to-the-ace goes the other way, from open-everywhere to a
fold at five of the six seats. Both are the same fix seen from opposite ends: two populations that
do not play alike were sharing one number. The 1-gap rows needed no equivalent fix: `gapVec` was
already wheel-aware, so `A543 → RUN1_BOTTOM` and `A532`/`A542 → RUN1_TOPMID` are each graded in the
orientation that admitted them. The unit tests assert both facts so they stay true.

**Display bands (6):** `AA` rows 1–6 (2.571%) · `Big pairs` 7–12 (7.634%) · `Rundowns` 13–19
(16.548%) · `Semi-connected` 20–22 (19.480%) · `Small pairs` 23–27 (22.184%) · `Junk` 28–29
(31.584%).

### 2.3 Structurally empty cells

**Twenty-two** of the 145 cells are combinatorially impossible. The list is **derived by
enumeration at build time, never hand-listed** (gate D2) — the count is whatever the cascade
produces, and the enumeration is the authority. Known members include `AA_BIGPAIR×SS`,
`DBLPAIR_BIG×SSA`, `TRASH×SSA` and `A_BLOCKED×DS`. Each carries a generated explanation of its
cause — for example, an ace-topped suited pair routes an `AA_BIGPAIR` hand to `SSA`, so
`AA_BIGPAIR×SS` cannot exist, and `RUN0_HIGH×SSA` cannot exist because `RUN0_HIGH` never holds an
ace once the wheel files as `RUN0_LOW`. They render as void cells and are skipped by keyboard navigation
with an announcement.

### 2.4 The sub-bucket depth layer

A second, finer key (`pairStructure | suitPattern | connectivity | highCardQuality`) is assigned
to every hand in the *same* enumeration pass, so every canonical class carries both keys.
Invariant **I17** asserts `Σ combos(sub-buckets of a cell) === combos(cell)` for all 145 cells
and `Σ cells === 270,725`. This build emits **341 non-empty sub-buckets** across the 123
non-empty cells (mean 2.77 per cell). The axes were coarsened to land in the 300–400 range the
source brief asks for: dual-keyed *per cell*, the brief's own finer four-field key produces over
600 buckets, and its quoted figure of 344 is a global count of that key, not a per-cell one.
The data ships day one; the expand-in-place UI that consumes it is a post-v1 feature.

---

## 3. What is measured

Per cell, the hero hand is **sampled fresh from the cell every trial**, so the measurement
converges to the cell mean — which is exactly what a cell displays.

- `eq[N]`, N = 1..5 — Monte Carlo equity (%) versus **N random opponents**, split pots counted
  fractionally.
- `rho[N] = eq[N] · (N+1) / 100` — equity as a ratio of fair share. ρ = 1.00 is breakeven at any
  N, which is what makes the multiway decay comparable across N. Precomputed and shipped; ρ, not
  raw equity, is what the inspector curve plots.
- `eqVs3bet = { AA, KK, QQ, BWR }` — heads-up equity against a hand drawn from each face-up
  component range (§7). Shipped split into four components; the browser blends them.
- Per-cell features from enumeration: `danglers` (mean 0–2), `nutSuited` (share), `dom` (mean
  count of distinct hero ranks in {A, K, Q}), `adjMean` (§8), `mplay` (§5).

### 3.1 ν — nut scalability, the second number

```
nuSlope = (rho[5] − rho[1]) / 4
nu      = clamp((nuSlope + 0.08) / 0.27, 0, 1)
```

ν asks a single question: **as the pot goes multiway, does this hand's share of the pot rise or
fall relative to fair share?** A hand that makes nut straights and nut flushes gains; a hand that
makes second-best everything bleeds. Reference anchors the generator must land near:

| Hand | ν |
|---|---|
| `AAKKds` | ≈ 0.94 |
| `KQJTds` | 0.70 |
| `JT98ds` | 0.59 |
| `T987ds` | 0.53 |
| `5432ds` | 0.38 |
| `AA72r` | 0.16 |
| `K952r` | 0.07 |

The model constant `nuBar` = **0.42** is the reference point ν is compared against in `M_nut`.
The generator also emits the actual combo-weighted pool mean of ν as a separate field; the two
are not the same number and are not meant to be — `nuBar` is a fixed model constant so that the
scoring surface does not shift under you when the data is regenerated.

---

## 4. VPIP → expected opponents (`N_eff`)

`v` = table VPIP as a fraction. Slider domain **0.25 – 0.90**, default 0.55, reference 0.25.

```
c(v)        = 0.55 · v^1.25                     cold caller, non-blind
c_blind(v)  = min(0.95, 1.5·c(v) + 0.10)        blinds defend wider
c_limper(v) = min(0.90, 0.45 + 0.50·v)          committed limper facing an iso
```

6-max seats still to act: `n_nb = { UTG:3, HJ:2, CO:1, BTN:0, SB:0 }`, `n_bl = { UTG..BTN:2, SB:1 }`.

| Node | `N_eff` |
|---|---|
| **RFI** | `1 + n_nb(p)·c(v) + n_bl(p)·c_blind(v)` |
| **Iso over L limpers** | `1 + L·c_limper(v) + n_nb(p)·1.20·c(v) + n_bl(p)·c_blind(v)`, L ∈ 1..4 |
| **vs Raise** † | `1 + n_nb_behind(p)·0.90·c(v) + n_bl_remaining(p)·0.80·c_blind(v) + 1` |
| **vs 3-Bet** | not used — treated heads-up against the 3-bettor (§7) |

† **The vs-Raise formula is a spec addition, not from the source model brief**, and is flagged as
such here: hero plus the raiser plus dampened callers behind, with a 0.90 squeeze-risk factor on
cold callers and 0.80 on blinds facing a raise-and-call. It is a judgement call in the same class
as the other constants.

Reference values the implementation reproduces exactly: at v = 0.55, `c = 0.261`,
`c_blind = 0.491`, RFI `N_eff` = 2.76 (UTG) / 2.24 (CO) / 1.98 (BTN); at v = 0.90, RFI UTG = 4.09
and a CO iso over three limpers = 5.92.

**Structural exclusions.** BB has no RFI node (it can check, so it is disabled there). UTG has no
vs-Limps or vs-Raise node — nobody acts before UTG in 6-max — and the segment renders disabled
rather than silently producing a number.

**The clamp.** `N_eff` is clamped to [1, 5] for equity interpolation, which the iso node exceeds
at high VPIP (5.92). When it bites, the readout shows `N_eff 5.92 → clamped 5.00` with an
`EXTRAPOLATED` badge and reason strings append the pre-clamp value. This is a real limitation
(§10.5), surfaced rather than smoothed.

---

## 5. Realization and the score

```
R(p, N, ν) = base(p) · (1 − 0.10·(N−1)·(1−ν))
base = { UTG:0.97, HJ:0.99, CO:1.02, BTN:1.06, SB:0.90, BB:0.93 }
```

At N = 5, a ν = 0 hand realizes at **0.60×** and a ν = 1 hand at **1.00×**. That single line is
the mathematical statement of "non-nut speculative hands lose value to reverse implied odds."

```
S(h, p, N) = 100 · ρ(h,N) · M_nut(h,N) · M_play(h) · R(p, N, ν(h))

M_nut(h,N) = 1 + κ(N)·(ν(h) − nuBar)         nuBar = 0.42
κ(N)       = 0.15 + 0.13·(N−1)               0.15 heads-up → 0.67 six-way

M_play(h)  = product of:
    0.94 ^ danglerCount
    0.85  row ∈ {TRIPS_BIG, TRIPS_SMALL}
    0.70  quads
    0.78  row = A_BLOCKED
    0.93  r1 ≤ 9   (no card above a nine)
    0.95  FLAW and monotone      ·  0.97  FLAW and three-flush
    1.03  nutSuited
```

κ growing with N is the mechanism behind the whole product: **looseness does not reward more
hands, it reweights toward nut potential.** Heads-up, ν is worth a 15% swing; six-way, 67%.

For cells, `M_play` is evaluated on combo-weighted cell means of the boolean and count features,
and the generator emits the resolved per-cell float (`mplay`) so the browser and the generator
cannot disagree. ρ is interpolated linearly in N at runtime; `M_nut` and `R` are evaluated at the
fractional `N_eff`.

---

## 6. Tiers

Evaluated per (position, node, VPIP).

1. **Score** all 145 cells at `(p, N_eff(v))`, applying the vs-Raise ρ shift where relevant
   (§6.5). Sort descending, accumulate combos into a cumulative frequency.
2. **Aggressive width.**
   `w_raise(p,v) = base_raise(p) · (1 + 0.35·(v − 0.5))`, with
   `base_raise = { UTG:.16, HJ:.20, CO:.27, BTN:.45, SB:.33 }` (BB uses .33 at the vs-Limps node).
   Iso multiplies by the value factor `V(v) = 1 + 0.60·max(0, v − 0.5)`. vs-Raise replaces it with
   `w_3bet(v) = 0.06 + 0.10·v` and a call width `w_call(v) = 0.10 + 0.30·v`.
3. **Hard nut gate.** If `N_eff ≥ 3.0` and `ν < nu_min(N_eff)` where
   `nu_min(N) = min(nutGateCap, 0.20 + 0.10·(N − 3))`, `nutGateCap = 0.30` — 0.20 at 3-way, 0.30
   at 4-way, and **0.30 from there on** — the cell is demoted one tier regardless of score. Reason
   string: *folded by nut gate (ν 0.16 < 0.30 required at 4.5-way)*.

   **The cap is new and it is load-bearing.** Uncapped, `nu_min` reached 0.40 at five-way and
   demoted cells out of the aggressive set faster than `w_raise` added them, so the range the grid
   actually *painted* collapsed as the slider rose — BTN over two limpers went 45.7% painted at
   VPIP 55 down to 23.8% at VPIP 90 — which is the exact opposite of the product's claim. Nothing
   tested it, because every width the page plotted was `targetWidth`. Invariant **I21** now holds
   the painted number to the claim at all 15 (node, position) pairs, and §10.12 gives the figures.
4. **T1 / T2 — the exploit split.** The aggressive set is computed a second time at the reference
   `v_ref = 0.25`, same position and node. **T1** = aggressive at both. **T2** = aggressive at the
   current VPIP only. That is the definition of the orange tier: *the raise you only get because
   the table is loose*. Its reason string names the VPIP at which it enters. By construction T2 is
   empty at v = 25 (invariant I19).
5. **T3 — passive continue.** RFI has none (open-limping is never in this model's range; the
   legend chip is disabled). vs-Limps offers over-limping only for BTN/SB/BB with L ≥ 2, at
   `0.5·w_raise` of additional frequency and restricted to ν ≥ 0.45. vs-Raise offers CALL for the
   next `w_call(v)` of frequency, restricted by a ν floor when `N_eff ≥ 3`.
6. **T4 — declared uncertainty.** Any cell whose cumulative-combo-frequency midpoint sits within
   `t4Band` = **±1.5% of total combos** of a live tier boundary is displayed as MIX. **`t4Band` is
   one band, in one unit — cumulative combo frequency — at all four nodes**, including vs-3-bet
   (§7). MIX is an **overlay on the displayed tier, not an action level**: the
   post-passes in step 8 run on the underlying action tier (`wouldBe`), and MIX is applied for
   display afterwards. Without that ordering the suit-monotonicity promotion would erase every
   MIX cell adjacent to a CALL, which is the opposite of declaring uncertainty. This is the model saying *I am not confident here*, which is a different
   statement from *play this as a mix*, and the UI renders it as a hard 45° split of its two
   neighbor tiers rather than a blend.
7. **T5** — everything else folds.
8. **Post-passes, in order.**
   **(a) Positional nesting** — `range(UTG) ⊆ HJ ⊆ CO ⊆ BTN` is *enforced* by union-cascade at
   fixed (v, node), not emergent, and the UI says so.
   **(b) Suit monotonicity** — scan each row left to right in display order; if a better suit
   topology carries a worse action, promote it. Adding suitedness never demotes. Applies to the
   displayed tier only; scores are untouched. This makes invariant I9 checkable by eye.
9. **Margin.** `margin(cell) = S(cell) − S(nearest tier cut)` in score points (in equity points at
   the vs-3-bet node — margin and the MIX band are deliberately in different units there, because
   the margin answers *how far from the price* and the band answers *how much of the grid is this
   close*). A `CLOSE` chip appears at `|margin| < 2.0`, and drill grading treats CLOSE
   answers as neither right nor a leak.
10. **Tier Ribbon.** For the selected cell the full pipeline is evaluated at every integer VPIP
    from 25 to 90 — 66 points, about 0.3 ms — producing the boundary labels (`RAISE → FOLD @ 61`)
    and the caption sentence. It is recomputed on selection, position and node change, never per
    drag frame.

### 6.5 The vs-Raise shift

```
rho_vs(h,N) = rho(h,N) − tighten·(1 − ν(h))
tighten     = 0.12 · (1 − w_raise(raiser_pos, v))
```

A raise is information: the raiser's range is stronger than random, and the hands that suffer
most are the ones that needed a multiway field to realize. The shift is proportional to how tight
the raiser's position implies they are. The 3-bet tier is additionally restricted to hands with
`ν ≥ nu3betMin` **or** membership of a small value whitelist — the AA rows, `DBLPAIR_BIG`, and
`BROADWAY_RUN` — **in this pool the 3-bet is value-heavy and nutted, never a polarized bluff
construction, because the pool does not fold.**

`BROADWAY_RUN` is on that whitelist because `AKQJ` is a value 3-bet by any PLO standard and the
cell-mean ν of the row (0.37–0.70 by suit topology) drops parts of it under a hard 0.40 floor.
The whitelist is the minimal fix: it cannot re-order any cell's score, whereas softening the floor
into a score penalty would move the grid everywhere. With it, `BROADWAY_RUN×DS` and `×SS` are a T1
3-BET at every seat that has a vs-Raise node, and `×RB` at every seat but HJ, where it displays as
MIX. Without it the whole row folded to a raise.

---

## 7. The vs-3-bet node — the exploit

The pool this tool is aimed at 3-bets a **face-up** range. Against a known range, equity vs random
is the wrong number entirely. The villain is modelled explicitly:

```
VILLAIN_3BET = 60% AAxx | 25% KKxx | 10% QQxx | 5% BROADWAY_RUN     (editable in the app)
```

Component membership is first-match-wins, so `AAKK` samples as AAxx: AAxx = exactly two aces;
KKxx = exactly two kings and fewer than two aces; QQxx = exactly two queens and fewer than two
kings or aces; BWR = the `BROADWAY_RUN` row.

The generator measures `eqVs3bet[i]` per cell against each component separately, and the browser
blends `eqMix = Σ wᵢ · eqVs3bet[i]`. **This blend is exact, not an approximation** — expectation
is linear over the villain draw — which is why the mix editor can be a live control instead of a
regeneration.

Policy at this node uses **absolute thresholds against the pot-odds price**, not a percentile sort:

```
breakeven = 0.290                  pot-sized 3-bet: risk ~8.5bb to win a ~20.5bb pot
dom       = count of hero's DISTINCT ranks ∈ {A, K, Q}   (cells use the rounded cell mean)

T1 4-BET : row ∈ AA rows 1–5 AND eqMix ≥ 0.50
dom gate : dom ≥ 2 AND row ∉ rows 1–5 AND eqMix < 0.34 → FOLD
           ("dominated — N of your ranks live in their face-up range")
T3 CALL  : eqMix ≥ 0.36 AND ν ≥ nuCall AND (hero in position OR ν ≥ nuOOP), survives the dom gate
T2 CALL  : the subset of T3 with eq[1] < 0.45 — the ambush. This call exists ONLY because
           their range is face-up; vs an unknown 3-bettor it is a fold.
T4 MIX   : cumulative combo frequency within ±t4Band of the call cut, or — for the AA rows,
           the only rows that can reach T1 here — of the 4-bet cut
T5 FOLD  : the rest
```

**The MIX band at this node is measured in frequency, not equity points.** `vs3betCuts(model, mix)`
ranks the 123 live cells by `eqMix` descending, walks cumulative combo frequency, and interpolates
where that ordering crosses the 36% call floor and the 50% four-bet threshold; it returns `null`
for a boundary the grid never crosses, and those cuts ship on every solved cell as `cumMid`,
`callCut` and `fourBetCut` so the page can draw the histogram and the boundary lines without
recomputing. At the default mix the call cut lands at **36.6% of combos** and the four-bet cut at
**2.5%**. This replaced an absolute ±1.5-equity-point window, which was a unit error — see §10.11
for why it mattered and what it was hiding.

**The domination-gate escape sits at 0.34, below the 0.36 call floor, deliberately.** `eqVs3bet` is
measured against the *actual* AA/KK/QQ/BWR ranges with hero's cards removed, so shared ranks are
already priced into the equity twice — as blockers and as equity. At the old 0.44 escape the gate
charged for them a third time and folded `BROADWAY_RUN×DS` (eqMix 40.3%, ν 0.70, getting 2.45:1)
while calling `RUN0_LOW×SS` at 39.0%, which is backwards. At 0.34 the gate can only ever *confirm*
a fold the price already made: it still catches five cells (`BIGPAIR_ACE×RB` 32.0, `TRIPS_BIG×SSA`
25.8, `BROADWAY_RUN×RB` 32.2, `ACE_RUN3×RB` 30.3, `ACE_RUN3×FLAW` 33.7) and every one of them
fails the 36% floor independently.

**Deviation on record.** One consequence is that `BIGPAIR_ACE×DS` — your own kings with an ace —
now **calls** at eqMix 40.5% / ν 0.53, where the 0.44 escape folded it. The source brief explicitly
wants that hand folded ("your own KK is drawing to a set against a set-plus-overpair", §7.1 lesson
4). We ship the call and name the disagreement rather than special-casing the cell: at 40.5% into a
29% price with double-suited nut potential, folding is a worse answer than the slogan is a good one.
The slogan survives where it was measured — `KK98ds` at 34.1%, and every rainbow / suit-wasted
big-pair cell, still folds.

**The AMBUSH tier (T2) is structurally empty at every seat in this build, and we do not paint an
empty chip.** No cell clears `eqMix ≥ 36%` *and* `ν ≥ 0.40` while measuring under 45% heads-up vs
random. It hangs on one cell: `RUN0_LOW×SS` is eqMix 39.0 / eq₁ 44.1 — both qualifying — but
ν 0.38, just under the continue floor, which the wheel admixture pulled it below. We did not widen
`ambushEq1`, relax the in-position gating, or lower `nuCall` to rescue the tier; a call that only
exists because a threshold was moved for it is not an exploit, it is a fitted result. The mechanism
is still described here because the *shape* is right — vs a face-up AA range there are hands you
call with that you would fold to an unknown — it just does not currently have a member.

`heroIP` is simplified to `p ∈ {CO, BTN}` and the UI says so. Sizing is not modelled — every
threshold assumes a pot-sized 3-bet (§10.8). The exact ν floors are in `constants.vs3bet` and are
rendered in the Method view.

**Two ν floors were re-anchored, and both values ship.** The source brief pinned `nu3betMin` at
0.55 and the out-of-position call floor `nuOOP` at 0.55 against *hand-level* ν anchors. Applied
to *cell-mean* ν they are far tighter than intended: only 1.0% of hands sit in a cell whose mean
ν reaches 0.55, which pinned the vs-Raise 3-betting range at 2.8% of combos — below this model's
own 6% floor, and flat across the whole slider. This build therefore uses `nu3betMin = 0.40` and
`nuOOP = 0.42`. The brief's numbers are shipped alongside as `nu3betMinSpec` and `nuOOPSpec` and
are visible in the Method view, so the change is inspectable rather than silent.

`nuOOP = 0.42` has exactly one anchor and it is worth stating plainly: it is held just *below* the
measured ν of `RUN0_LOW×DS`, which this build measures at **0.43**. That is what makes the §7.1
anchor "`RUN0_LOW×DS` always calls" true at all six seats rather than only at the two in-position
ones, and it is what invariant I15 asserts unconditionally. The margin is 0.01 — one regeneration
away from binding — so the constant carries a comment in `policy.mjs` telling the next person to
re-measure that cell after any regeneration. A floor set *at* a measurement rather than below it is
a floor that fails on noise.

Note also that `nuBar` inside `M_nut` stays at the authored 0.42 (§5). The *measured*
combo-weighted pool mean is 0.2954, shipped as `constants.nuBarMeasured`. `nuBar` is a
normalisation anchor, not a measurement, and it is left where the model was calibrated.

### 7.1 The four lessons, read straight off the measurements

Against `AsAhKdQc` — AA with big broadway side cards, the *strongest* member of the range, so
these numbers are conservative. The column is the **reference table** gate B validates against;
this build's own engine re-measures every row inside gate B's ±0.6 pt tolerance and lands
slightly lower on the rundowns (`5432ds` 47.45, `KK98ds` 34.14, `AdKcQsJh` 17.99), and it is
those measured values — not the reference — that the page's hand lookup displays:

| Hero | Equity vs `AsAhKdQc` (reference) |
|---|---|
| `5432ds` | **47.58%** |
| `2345ds` | 47.50% (same hand, independent seed — a consistency check, Δ 0.08) |
| `T987ds` | 46.94% |
| `9876ds` | 46.87% |
| `JT98ds` | 46.44% |
| `KKQQds` | 42.62% |
| `KQJTds` | 37.51% |
| `QQJTds` | 35.81% |
| `KK98ds` | **34.16%** |
| `AdKcQsJh` | **17.97%** |
| `JT98ds` vs a *weak* AA (`AsAh2d3c`) | **51.59%** |

1. **A double-suited rundown is roughly a coinflip against a strong AA hand** (46–48%), and you
   are being offered ~29%. You cannot fold. The correct response is call — in position — and
   stack them when you flop big. Rarely 4-bet: that collapses the pot to heads-up *and* reopens
   their AA to a pot-sized shove where your edge is smallest.
2. **Domination, not high-card quality, is what kills you.** `AdKcQsJh` looks premium and runs
   **18%**, because three of its four ranks sit in the villain's hand. The pool's own bias toward
   pretty broadway hands is exactly what makes this spot profitable for someone who understands it.
3. **Low rundowns gain the most against aces.** `5432ds` is 40.8% against a random hand but 47.5%
   against AAKQ — a **+6.6-point swing** from being 3-bet at. Hands that look worthless in a vacuum
   are among the best hands to defend with against a face-up big-pair range: no shared ranks, and
   they make the straights the AA hand cannot beat.
4. **Your own kings are the worst hand to continue with.** `KK98ds` at 34% is drawing to a set
   against a set-plus-overpair. In this pool, *"I have kings"* is the single most expensive thought.

Sanity anchors the shipped policy must reproduce, both unconditional (invariant I15):
`RUN0_LOW×DS` always continues — at all six seats, eqMix **41.8%** against a 29% price, ν 0.43
against the 0.42 out-of-position floor — and `BROADWAY_RUN×RB` never continues, on the price alone
(eqMix **32.2%**, under the 36% floor; the domination gate confirms it but does not cause it).
`AA_BIGPAIR×DS` is always the top tier (invariant I7).

---

## 8. Within-cell hand adjustment — labelled `estimate`

A cell is a mean, and `RUN2` spans `QJ97` down to `6432`. For a concrete hand `h` in cell `C`:

```
adjRaw(h)  = 2·(# ranks ≥ J) − 3·danglerCount(h) + 4·[nutSuited(h)]
score'(h)  = S(C, p, N_eff) · (1 + (adjRaw(h) − adjMean(C)) / 100)
```

`adjMean(C)` is emitted per cell. `score'` feeds the single-hand verdict, the counterfactual lane
(swap one card, 192 candidates, reclassify with the same cascade, rank by `score'`), and drill
grading.

**Every surface that shows this carries the word `estimate`**, and its tooltip says why: *ranked
by an interpolation, not a measurement; the ranking is reliable, the magnitudes are approximate.*
No Monte Carlo runs in the browser (§10.9).

---

## 9. Monte Carlo setup and calibration

### 9.1 Engine

`scripts/lib/eval5.mjs` is a bitmask / rank-histogram 5-card evaluator: four 13-bit masks built in
one pass, a straight-high lookup table including the wheel, and a score packed as
`category << 26 | tiebreak` in an int32. Measured at roughly 34.6M evaluations/second, and exact
on all nine C(52,5) category counts.

PLO showdown is the best of C(4,2) × C(5,3) = 60 combinations. **Board-triple partials** are
precomputed once per trial (1.7–1.8× measured speedup). One deal with five villains yields equity
against N = 1..5 simultaneously via villain prefixes — about 2.9× more data per unit of time than
running each N separately. No perfect-hash and no 2+2 lookup table; both were considered and
rejected as unnecessary at this trial count.

### 9.2 Randomness, seeding, and common random numbers

All randomness is **seeded xorshift128**, with the seed derived per (stage, cell-key) by an FNV-1a
hash of the key string. Runs are therefore reproducible bit-for-bit with no seed input at all —
there is no global seed knob and no `--seed` flag, because a per-stream key is what lets a single
cell be re-measured in isolation and still land on the same number. `meta.seed` (`rundown-v1`) is a
build label recording the scheme, not a parameter.

Within a stage, trial index *t* uses the **same board and villain stream across every cell**
(common random numbers). This matters more than the absolute trial count: it means cross-cell
*ranking* noise is far below absolute noise, and ranking is what the matrix actually displays. Two
cells 0.3 points apart are ordered reliably even though each carries ±0.16 of absolute error.

### 9.3 Trial budget

| Stage | Work | Trials | Standard error |
|---|---|---|---|
| S0 enumerate | classify all 270,725 hands; per-cell lists; combo matrices; empty-cell causes; mosaic geometry | exact | — |
| S1 villain prep | enumerate the four 3-bet component ranges into packed arrays | exact | — |
| S2 cell equity | 100,000 multiway trials per non-empty cell (hero fresh from cell, 5 villains + board, prefix comparison) | ~14.5M | ±0.16 pt/cell |
| S3 vs 3-bet | 40,000 heads-up trials per cell per component, villain rejection-sampled by range index against a 52-bit used-mask | ~23.2M | ±0.25 pt |
| S4 sub-buckets | 40,000 multiway trials per sub-bucket | ~13.8M | ±0.25 pt |
| S5 derive + emit | ρ, ν, wave delays, `mplay`, `adjMean`, rounding, hashing | — | — |
| S6 verify | all gates, benchmark re-measurement, cross-engine check | ~1.2M | — |

Four workers, items striped `k % W`, results posted as `Float64Array` transferables. Total wall
clock is roughly 2–3 minutes on a 4-core box with a hard budget of 6 minutes. `--fast` divides
every trial count by 10 (~25 s), widens verify tolerances, and stamps `meta.fast = true` so a fast
dataset cannot be shipped into the page by accident.

### 9.4 Engine gates (run first — they catch evaluator bugs)

| # | Test | Expected |
|---|---|---|
| V1 | Two fixed hands, equities summed | 100.0 ± 0.3 |
| V2 | Mean equity, 60 random heroes vs 1 random | 50.0 ± 0.5 |
| V3 | Mean equity, 40 random heroes vs 3 random | 25.0 ± 0.5 |
| V4 | `5432ds` and `2345ds` vs the same villain, different seeds | equal within 0.3 |
| V5 | Ranking order SF > quads > boat > flush > straight > trips > 2pair > pair > high, **and** the nine exact C(52,5) category counts (1302540 / 1098240 / 123552 / 54912 / 10200 / 5108 / 3744 / 624 / 40) | strict |
| V6 | Omaha 2-of-4 rule: `KdKh` on board `7s7h7d7cKs` beats `AsAh` (KKK77 > 777AA) | pass |

**V6 is the classic Omaha implementation bug.** A Hold'em-style "best five of nine" evaluator
silently returns the wrong answer here and every downstream number is subtly wrong. It stays in
the test suite forever.

### 9.5 Heads-up reference equities (vs one random hand)

| Hand | Equity | | Hand | Equity |
|---|---|---|---|---|
| `AAJTds` | 71.08 | | `KK72r` | 56.62 |
| `AAKKds` | 70.82 | | `JT98ds` | 55.26 |
| `AA98ds` | 69.80 | | `T987ds` | 52.70 |
| `KKQQds` | 68.52 | | `AAAA` | **51.57** |
| `AAKKss` | 67.90 | | `QJ76ss` | 51.24 |
| `AAKKr` | 65.00 | | `JT98r` | 48.72 |
| `AA22r` | 63.65 | | `QQQ2r` | 47.38 |
| `AAK2r` | 62.02 | | `K952r` | 43.41 |
| `AA72r` | 61.64 | | `5432ds` | 40.95 |
| `AKQJds` | 61.57 | | `2233r` | **38.48** |
| `KQJTds` | 59.43 | | `2222` (quad deuces) | **9.28** |
| `AAAK` | 57.25 | | | |

Three of these carry the tool's argument on their own:

- **Quad aces is a 51.6% hand** — barely better than a coinflip against a random hand, and the
  worst possible AA holding. It cannot make a set, cannot flush, cannot straight. The best cards
  in the deck, in the wrong structure, make an almost worthless hand.
- **Quad deuces is 9.3%.** It is the floor of the entire game and the single best credibility
  anchor in the data: any evaluator that reports a plausible-looking number here is broken.
- **`2233` rainbow (38.5%) is worse than pure trash `K952` rainbow (43.4%).** Two small pairs is
  not "two chances at a set"; it is a hand with no high card, no flush and no straight.
- **`AAJTds` ≈ `AAKKds`** (71.08 vs 70.82, inside 2σ). The two best hands in PLO are statistically
  tied. Rank matters far less than structure.

### 9.6 Suitedness ladder — identical ranks `JT98`, four topologies

| Topology | Equity vs 1 random | Δ vs rainbow |
|---|---|---|
| double-suited | **55.07** | +5.68 |
| single-suited (high card suited) | 52.37 | +2.98 |
| single-suited (low card suited) | 52.40 | +3.01 |
| three-flush | 51.48 | +2.09 |
| monotone | 50.71 | +1.32 |
| rainbow | 49.39 | — |

Which card is suited barely moves raw equity (52.37 vs 52.40). It moves *nut* value, which raw
equity does not capture — again the argument for ν.

### 9.7 Nut-flush premium

| Hand | Equity | Δ |
|---|---|---|
| `AJT9` ace-suited (`AsJsTh9d`) | **56.31** | +0.52 |
| `AJT9` J-suited (`AhJsTs9d`) | 55.79 | — |
| `AJT9` rainbow (`AhJsTd9c`) | 53.25 | −2.54 |

**The nut-flush premium is only +0.5 points of preflop equity.** Anyone building this model from
equity alone concludes that nut suits barely matter, and they are wrong. The premium is in
realization, not equity. This single row is why `ν` / `M_nut` exist.

### 9.8 Multiway decay — the calibration table that matters most

Equity (%) vs N random opponents; breakeven is 100/(N+1) = 50.0 / 33.3 / 25.0 / 20.0 / 16.67.

| Hand | N=1 | N=2 | N=3 | N=4 | N=5 | × breakeven @ 5 |
|---|---|---|---|---|---|---|
| `AAKKds` | 70.58 | 54.21 | 45.17 | 39.50 | **35.06** | 2.10 |
| `AAKQds` | 69.09 | 51.41 | 41.64 | 35.02 | **30.80** | 1.85 |
| `KQJTds` | 59.18 | 45.34 | 36.19 | 30.65 | **27.05** | 1.62 |
| `AsKsQhJh` | 60.90 | 45.74 | 36.60 | 31.26 | **26.84** | 1.61 |
| `JT98ds` | 55.61 | 42.02 | 32.87 | 28.10 | **23.89** | 1.43 |
| `T987ds` | 52.59 | 39.08 | 30.29 | 25.46 | **21.66** | 1.30 |
| `AA72r` | 61.30 | 40.73 | 29.03 | 22.00 | **17.88** | 1.07 |
| `5432ds` | 40.49 | 28.72 | 22.04 | 18.55 | **14.96** | **0.90 (−EV)** |
| `KK72r` | 56.59 | 36.04 | 24.98 | 18.90 | **15.03** | **0.90 (−EV)** |
| `K952r` | 42.59 | 25.56 | 17.62 | 13.02 | **10.18** | **0.61 (−EV)** |

Also measured: `KKQQds` vs `AsAhKdQc` + 1 random = 37.68%; `JT98ds` vs the same + 1 random =
**39.81%**, + 3 random = 30.01%. The rundown *overtakes* the big pairs as the pot goes multiway.
That crossover is the same fact the ν machinery encodes, arrived at from a different direction.

### 9.9 Folklore versus measurement

| Claim | Verdict |
|---|---|
| "AAKKds is the best PLO hand, ~67% vs random" | **Disputed.** Measured 70.8%. A cited 300k-trial sim also reports ~71%. The 67% figure appears to be folklore. |
| "AAKKds is only ~52% against AAJTds" | **Consistent** — the two are statistically tied vs random (70.82 / 71.08). |
| "Double-suited is worth +3 to +4 points over rainbow" | **Understated.** Measured +5.7 on `JT98` and +5.8 on `AAKK`. |
| "The nut-flush premium is large preflop" | **False in raw equity** — +0.5 pt. It is real, and it lives in realization. |
| "AAxx rarely exceeds 65–70% preflop vs a range" | Consistent — vs-random numbers sit at the top of that band and fall vs a real range. |
| Published top-30 lists (AAKKds, AAJTds, AAQQds, … JT98ds, KQJTds) | Broadly reproduced by `S(h, CO, N=2)`. A soft ordering check only — the published lists disagree with each other. |

The generator additionally emits a `benchmarks.disputed` list: rows where this build's own
high-trial re-measurement (240k trials, both engines agreeing over shared deals) disagrees with
the published reference value by more than Monte Carlo error. Those rows are shipped rather than
suppressed, and the Method view renders them. A benchmark table that never disagrees with itself
is a table nobody is actually running.

---

## 10. Known limitations

Nothing here is hidden behind a disclosure. They are listed in the app's Method view too.

1. **Equity is measured against *random* opponents, not against ranges.** Loose lobbies make this
   a far better approximation than it would be in a tight game — at 90% VPIP an opponent's calling
   range genuinely is close to random — but at the tight end of the slider it overstates
   speculative hands. The vs-Raise `tighten` shift (§6.5) is a patch, not a solution.
   VPIP-filtered villains are the top of the v2 list.
2. **Cell means hide within-cell variance.** `RUN2` spans `QJ97` down to `6432`. One number for a
   cell is a real simplification. The taxonomy is designed to minimize it — rundowns are split by
   gap *count* and gap *position*, and `RUN0` is split high/low in the wheel-aware orientation
   (§2.2), which is what keeps `JT98` out of the same cell as `A432` — but it remains the largest
   single source of error. The §8 adjustment reduces it for named hands and is labelled `estimate`
   wherever it appears.
3. **No stack depth.** Everything assumes ~100bb. Real PLO ranges change materially at 40bb and at
   250bb, and nut potential matters more the deeper you get.
4. **No rake.** Low-stakes lobbies rake roughly 5% of every pot, which pushes every marginal hand
   toward fold. The model's thresholds are therefore implicitly slightly too loose.
5. **`N_eff` saturates at 5.** The iso node genuinely reaches 5.9 expected opponents at VPIP 90;
   the equity table stops at five villains, so it clamps and says so on screen. Extending the
   Monte Carlo to N = 7 is cheap in code and expensive in runtime — an easy v2 win.
6. **The scoring constants are opinion.** `kappa`, `M_play`, `base_raise`, `R(p)`, `nu_min` and
   the tier widths are judgement calls informed by measurement, not derived from it. They live in
   one `constants` object precisely so a skeptic can change them and re-render.
7. **The 3-bet villain mix is hand-authored.** `VILLAIN_3BET` encodes one specific pool. Against a
   different pool it is simply wrong — which is why the mix is editable in the app, and why the
   blend is exact rather than a re-measurement.
8. **3-bet sizing is not modelled.** Every threshold at that node assumes a pot-sized 3-bet
   (~8.5bb to win ~20.5bb ⇒ 29% breakeven). There is no sizing editor in v1; the assumption is
   named in the UI beside the number.
9. **No live Monte Carlo in the browser.** Every number in the page is precomputed; the browser
   does arithmetic only. If a future version ever adds runtime compute, the required pattern is a
   frame-budget harness: chunk the work, yield to the event loop, and never let a compute pass
   exceed the render budget the slider is measured against.
10. **Positional nesting is enforced, not emergent.** `UTG ⊆ HJ ⊆ CO ⊆ BTN` is imposed as a
    post-pass. It is what a human expects a range chart to obey; it is not something the score
    function produces on its own, and the UI marks it where it bites.
11. **Hero equities against the face-up range pile up on one two-point bin, and the MIX band used
    to be read in the wrong unit.** The measurement is the interesting part and it has not changed:
    against the default AA/KK/QQ/broadway mix, **42.3% of all combos** land in the 34–36% equity
    bin, with a second shelf of 14.4% at 30–32%. The mode sits five to seven points *above* the
    29% pot-odds breakeven and immediately *below* the 36% call floor, which is why the node has a
    genuinely crowded boundary rather than a clean one.

    What was wrong was the band, not the data. T4 at this node was defined in *equity points*
    (±1.5 of the 36% floor) while the other three nodes band in cumulative combo frequency — one
    constant, `t4Band`, read in two units. Dropped onto that mode, an absolute ±1.5-point window
    swept **38.9% of the grid** into MIX, about 9× the blend's own measurement standard error
    (0.165 pt against `se.vs3bet` 0.25 per component). Any absolute threshold anywhere near the
    mode would have produced the same pile-up; the number was reporting the shape of the histogram,
    not the model's uncertainty. Re-banding in frequency against the interpolated call cut (§7)
    drops MIX to **3.66% of combos** — 2.3 points of that from the call boundary and 1.4 from the
    AA rows' four-bet boundary.

    The crowding is still true and is still shown: the vs-3-bet lab renders the `eqMix` histogram
    with the 29 / 36 / 44 lines drawn on it, so the pile-up is visible as a fact about PLO rather
    than smuggled in as a tier. What is *not* done, deliberately, is turning closeness into a
    mixing frequency — a 0→1 call-frequency ramp across the band would be an invented solve output.
    Closeness is expressed by the margin, in equity points, on the cell.
12. **The thesis is real, and one earlier version of it was measuring an artifact.** At UTG RFI the
    painted aggressive range moves **14.1% → 16.6%** across the whole slider while its mean nut
    potential moves **0.409 → 0.425**, +1.6 points — the direction the product claims, at a modest
    size.

    The isolation nodes do **not** move further in the same direction, and an earlier build of this
    document claimed they did (+5.6 points at CO vs limpers). That number was real as measured and
    wrong as interpreted: the uncapped nut gate was demoting low-ν cells faster than the width
    formula added them, so the iso range was *collapsing* as the slider rose and nut share climbed
    only because the bottom of the range had been deleted. With the gate capped (§6, step 3) the
    ranges widen as they should and the raw nut-share change goes **negative** at every isolation
    and vs-Raise node — limps/CO **−1.7**, limps/BB **−2.5**, raise/BTN **−2.8**. Widening a range
    necessarily reaches deeper into the pool; that is the honest price of playing more hands.

    The surviving claim is about *ordering*, and it is the one invariant I11 now asserts: at
    **matched width**, the range a loose table opens is nuttier than an equally wide range drawn
    from the tight-table ordering, at all 15 (node, position) pairs (+0.1 to +2.1 points). **A loose
    table re-sorts your range toward nut potential; it does not make a wider range nuttier in the
    mean.** The compositional migration the matrix shows directly — gold leaving RB/FLAW for SSA/DS
    — is that re-sort, and it is the larger and more visible effect.

### v2 list

Monte Carlo to N = 7 · stack-depth axis · a rake model · VPIP-filtered villains instead of random
ones · a 3-bet sizing control · the expand-in-place sub-bucket UI that consumes the depth layer
already in the data · the frame-budget harness above, if anything ever needs to compute at runtime.

---

## 11. Invariants

Twenty-one model invariants, asserted by `scripts/verify.mjs` over v ∈ {25, 40, 55, 70, 90} × 6
positions × 4 nodes — 34 gates in total with the D and V families and the benchmark gate. **Any
violation fails the build** and nothing is emitted. The gate results are stamped into
`model.gates` and rendered by the Method view, so the page shows the gates *this* dataset passed.

| # | Invariant |
|---|---|
| I1 | Suit monotonicity in equity for fixed ranks: `eq(DS) ≥ eq(SS) ≥ eq(FLAW) ≥ eq(RB)` within MC tolerance. FLAW ≥ RB is deliberate (§2.1); if it fires, the evaluator has a suit bug. |
| I2 | Danglers only hurt: over 200 fixed sample pairs, replacing a dangler with a cluster-joining card never lowers equity or score. |
| I3 | ρ is monotone in N per cell — increasing for ν > 0.5, decreasing for ν < 0.3. |
| I4 | Conservation: mean equity over uniform hands = 100/(N+1) ± 0.5 for each N. |
| I5 | Zero-sum: N+1 fixed hands' equities sum to 100 ± 0.3. |
| I6 | Positional nesting holds after the post-pass. |
| I7 | `AA_BIGPAIR×DS` is in the strongest tier at every setting and node. No exceptions. |
| I8 | `TRASH×RB` and `TRIPS_SMALL×RB` are never T1 or T2 at any setting. |
| I9 | Displayed tier is non-decreasing along RB → FLAW → SS → SSA → DS for every row. |
| I10 | AA-band row monotonicity: tier(`AA_BIGPAIR`) ≥ … ≥ tier(`A_BLOCKED`) at every setting. |
| I11 | `nutShare = Σ combos·ν / Σ combos` of the aggressive range, across VPIP. **This is the formal statement of the product's claim**, and it is asserted in two parts with no scope carve-outs. **I11b — the claim:** at *matched width*, the VPIP 90 range is nuttier than an equally wide range drawn from the VPIP 25 score ordering. Holding width fixed makes the test immune to range collapse in either direction. It passes at all 15 (node, position) pairs: rfi/UTG +2.1, rfi/HJ +0.6, rfi/CO +0.5, rfi/BTN +0.8, rfi/SB +0.1, limps/HJ +0.3, limps/CO +0.3, limps/BTN +0.5, limps/SB +0.4, limps/BB +0.2, raise/HJ +0.7, raise/CO +0.6, raise/BTN +1.4, raise/SB +0.6, raise/BB +0.7 — thinnest is rfi/SB at +0.10 points, roughly 2 SE, and every figure is printed in the gate detail rather than summarised, so the thin one is visible. **I11a — the price:** no pair loses more than 3.0 points of *raw* nut share across the slider. It measures rfi/UTG +1.6 and rfi/HJ +0.2 but goes negative everywhere else (worst raise/BTN −2.8). Both facts are true at once; the previous form of this gate could only see one of them, and the +5.6 it reported at limps/CO was an artifact of the uncapped nut gate collapsing the range (§10.12). |
| I12 | Target aggressive width — the percentile the model *aims* at — stays in [0.10, 0.60] at RFI and [0.12, 0.70] at iso, plus a 10% floor on the *painted* range (the range after the nut gate and the post-passes, which is narrower than target wherever the gate bites; narrowest measured 14.1% at rfi/UTG, v = 0.25, against a 14.6% target). `solve()` returns both `targetWidth` and `width`, and **every width quoted in these docs, on the Thesis Sparkline and in the tour is `width`, the painted one** — quoting the target is what let the collapse in §10.12 go unnoticed. Two places on the page still show `targetWidth`, deliberately and labelled as the model's target rather than its output: the small figure under each position chip, and the `width cut` row in the inspector's *Constants in play* table. At rfi/UTG, v = 0.90 those read 18.2% against a painted 16.6%. |
| I13 | Frequencies partition to 1.000 ± 1e-6; combos across tiers sum to exactly 270,725. |
| I14 | **The inversion exists.** In ρ it holds exactly for the named pair: `AA_DANGLER×RB` 1.250 > 1.130 at N = 1, and 1.164 < 1.476 at N = 5. In *score* the named pair does not invert at UTG — N_eff is already 1.78 at v = 0.25, past the crossing — so the gate asserts the cell's score rank instead: `AA_DANGLER×RB` falls from rank 45 to rank 72 across the slider, passed by 27 cells (e.g. `BROADWAY_RUN×RB`). The measured figures are stamped into `meta.inversion`. If this fails, the slider does nothing and the product has no reason to exist. |
| I15 | vs 3-bet at the default mix, both statements unconditional at all six seats: `BROADWAY_RUN×RB` never continues (eqMix 32.2%, under the 36% floor); `RUN0_LOW×DS` always continues (eqMix 41.8%, ν 0.43 against the 0.42 out-of-position floor). Earlier drafts scoped the second to in-position seats and attributed the fold in the first to the domination gate; neither qualifier survives, and the gate asserts the plain statements the docs make. |
| I16 | Continuity: between adjacent integer VPIP steps, at most 3% of total combos **or** at most 5 of 145 cells change tier. (The combo clause alone is below the taxonomy's own granularity — the largest single cell is 8.1% of all combos — so one cell flipping can exceed 3% without anything discontinuous happening.) Three deliberate discontinuities are excluded and named: raise/HJ @ 45, raise/CO @ 54, raise/BTN @ 70, where N_eff crosses 3.0 and the nut gate and the vs-Raise call floor switch on together. |
| I17 | Dual-key partition: Σ sub-bucket combos = cell combos for all 145 cells; Σ cells = 270,725. |
| I18 | Geometry: the quantized mosaic column widths sum to exactly 530 px and each is within 1 px of exact proportionality. |
| I19 | **T2 is empty at v = 25** for every (position, node ∈ {RFI, vs-Limps, vs-Raise}) — the exploit-tier definition holds by construction. |
| I20 | Cross-engine agreement: `eval5.mjs` and the independently written `equity-ref.mjs` agree within ±0.6 pt on ten benchmark hands. |
| I21 | **The painted range widens as the table loosens.** `aggrCombos / 270,725` — not `targetWidth` — is wider at VPIP 90 than at VPIP 25 at all 15 (node, position) pairs: rfi UTG 14.1→16.6, HJ 16.5→21.4, CO 24.2→30.8, BTN 40.9→51.3, SB 28.3→36.4; limps HJ 16.9→27.0, CO 23.9→36.9, BTN 39.1→48.5, SB 27.9→44.8, BB 27.9→45.9; raise HJ 6.6→12.4, CO 6.1→11.2, BTN 6.1→12.4, SB 6.1→11.3, BB 6.2→10.0. Asserted as endpoints plus a bounded local dip, **not** pointwise: pointwise is unsatisfiable for the granularity reason I16 documents — one cell crossing the percentile cut is a visible step. The dip allowance is 4.0 points, half the largest single cell (8.1%); the worst measured drawdown is 3.2 points at rfi/BTN, v = 0.73. This gate exists because nothing tested the painted number before, which is how the range could collapse to half its width at the iso nodes without any gate firing. |

I20 is the one worth dwelling on. `equity-ref.mjs` is a second equity engine written separately
from the production one, kept in the repo purely to disagree with it. Two independent
implementations agreeing on a number is much stronger evidence than either one agreeing with
itself at a higher trial count.
