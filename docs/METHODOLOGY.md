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

Each sub-bucket carries its **own** `mplay` and its own `cooler`, computed from its own hands'
features rather than borrowed from its cell (V2-PLAN §2.4). This matters because a cell's `mplay`
is a combo-weighted mean over hands that are not alike: `DBL_CONNECTOR × SS` holds three-flush and
single-suited hands together, and its buckets' `mplay` values differ by more than the rounding a
shipped verdict is quoted to. Because every `mplay` factor is raised to a combo *share*, and a
cell's share is the combo-weighted mean of its sub-buckets' shares, the cell value is exactly the
combo-weighted **geometric** mean of its buckets' — invariant **I17** asserts that reconstruction
(worst observed 0.00066 against a 0.002 rounding tolerance). `cooler` is a conditional rate whose
exact reconstruction weight is combos × P(set or better), which the file does not carry, so I17
asserts the weaker claim that holds for *any* weighting: the cell's rate lies inside its buckets'
range, within measurement error (worst observed 0.0130 of 0.04, at a cell holding one bucket where
the bracket collapses to a straight re-measurement).

---

## 3. What is measured

Per cell, the hero hand is **sampled fresh from the cell every trial**, so the measurement
converges to the cell mean — which is exactly what a cell displays.

- `eq[N]`, N = 1..7 — Monte Carlo equity (%) versus **N random opponents**, split pots counted
  fractionally. One deal deals seven villains and yields every prefix, so N = 6 and 7 cost extra
  showdown evaluations, not extra deals.
- `rho[N] = eq[N] · (N+1) / 100` — equity as a ratio of fair share. ρ = 1.00 is breakeven at any
  N, which is what makes the multiway decay comparable across N. Precomputed and shipped; ρ, not
  raw equity, is what the inspector curve plots.
- `cooler` — P(hero loses the pot | hero reached a set or better at showdown). §3.2.
- `vDelta` — the villain-VPIP equity lattice, as deltas from the random-villain baseline. §3.3.
- `eqVs3bet = { AA, KK, QQ, BWR }` — heads-up equity against a hand drawn from each face-up
  component range (§7). Shipped split into four components; the browser blends them.
- Per-cell features from enumeration: `danglers` (mean 0–2), `nutSuited` (share), `dom` (mean
  count of distinct hero ranks in {A, K, Q}), `adjMean` (§8), `mplay` (§5).

**Why the field runs to seven.** `N_eff` at the isolation node reaches 5.92 opponents (CO over
three limpers at VPIP 90) and 7.40 at the loosest setting the page allows (HJ over four limpers at
VPIP 90). Before v2 the equity curve stopped at five and everything above it was clamped down to
five and labelled `EXTRAPOLATED`. Measuring to seven removes the clamp everywhere the page can
actually go except that last case, where the badge still fires and still means what it says. The
unclamping was checked against invariant **I22** before it was allowed in, not assumed harmless:
of the 1,386 (node, position, VPIP) settings I22 sweeps, 15 have a raw `N_eff` above 5 — HJ over
two limpers from VPIP 77 to 90, and CO over two limpers at 90 — and all 15 paint exactly the tiers
they painted when they were clamped.

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

**ν stays a [1,5] slope, deliberately, now that ρ runs to 7.** The obvious tidy-up — redefine
`nuSlope` as `(rho[7] − rho[1]) / 6` — was measured and rejected. It moves the slope by up to
0.0262, which the `nuNorm` scale of 0.27 turns into **0.10 of ν** on the worst cell
(`TRIPS_BIG × RB`); ν is the anchor for `nuBar`, the nut gate's floors, `nu3betMin`, `nuOOP` and
several gate thresholds, every one of which was calibrated against the [1,5] definition. A silent
0.10 shift in the quantity all of those are pinned to is not a tidy-up. ν is therefore a [1,5]
slope by calibration history, N = 6 and 7 exist for interpolation, and the day someone wants ν on
the wider span they will have to re-derive the constants that hang off it in the same commit.

### 3.2 `cooler` — the depth anchor

```
cooler = P(hero loses the pot outright | hero's best five is a set or better)
```

Measured on the same S2 and S4 showdowns the equities come from — two counters over hands the
evaluator has already scored, and **no new randomness at all**, which is what makes it free.

- *A set or better* is the evaluator's category 3 and up: set, straight, flush, full house, quads,
  straight flush. Two pair does not count; the question is about hands you cannot fold.
- *Loses* is strictly worse than the best of **three** opponents — a four-handed pot, the modal
  loose-lobby showdown and close to the model's own typical `N_eff`. A chop is not a loss.
- Emitted per cell and per sub-bucket to 3 dp. The reference field size, the category floor and the
  chop rule all ship as named constants in `constants.cooler`.

This is the measured content of "tens and jacks are the low end of top set", and it is what a
stack-depth axis has to be anchored on: at 100bb a cooler costs a bet, at 250bb it costs a stack.
Measured range across the 123 non-empty cells: **0.257** (`AA_BROADWAY × DS`) to **0.501**
(`TRIPS_SMALL × RB`), combo-weighted pool mean **0.3953**. Across the 341 sub-buckets: 0.256 to
0.752 (`TRIPS_SMALL × RB`, the quads bucket — four of a rank in your hand and the fourth is dead,
so the set you make is the one everybody else can make too).

Two orderings the data confirms:

| Claim | Measured |
|---|---|
| coolers fall as the pair rank rises | small pairs **0.4386** → big pairs (J+) **0.3563** → AA rows **0.3184**, combo-weighted |
| `cooler(SSA) < cooler(SS)` in the same row — your flushes are the nut ones | holds in **18 of 18** rows that have both, by 0.003 to 0.073 |

One thing the ladder claim cannot be stated more finely than that: the 29-row cascade splits pairs
at J (`rowOf`: `big = p >= 11`), and the sub-bucket key's `highCardQuality` counts cards of rank T
or better, so **TT, JJ, QQ and KK are not separable in either key**. The plan's TT > JJ > QQ > KK
ladder is measurable here only as the three-step small → big → AA ladder above. Separating the
pair ranks would mean new rows, not a new measurement.

### 3.3 The villain-VPIP equity lattice

`eq[N]` versus **opponents who fold their worst hands**, at v ∈ {25, 40, 55, 70, 90}, shipped as
1-dp deltas from the random-villain baseline (`vDelta`, one row per v, one column per N).

**The ordering problem, and why it is not the model's own score.** "A villain plays the top v%"
needs an ordering of all 270,725 hands. Ordering them by this model's score `S` would make the
model an input to its own measurement — the filtered-villain equities would then be a mirror, and
every conclusion drawn from them circular. The ordering is therefore frozen to **eq1: equity
against one random opponent**, which is a fact about the deck and not about this model, and which
nothing in the scoring layer touches.

eq1 is measured once, on **suit-isomorphism classes** rather than on hands. Renaming suits cannot
change a hand's equity against a random opponent, so the 270,725 hands collapse into **16,432**
classes (16.48× fewer), one representative each, at 60,000 shared deals — 27,370 deals per class,
SE 0.30 pt. Two payoffs beyond the speed: two hands that differ only by suit names can never be
ordered apart by sampling noise, and the range boundary is suit-symmetric by construction. The
combo-weighted mean of the measured eq1 is **49.83** against the 50.00 that symmetry demands.

The pools take **whole classes**, so the cut lands on a class boundary and the realised fraction
misses its target by at most one class — measured, all five land within 0.005% of target. The eq1
value at each cut: 53.55 at v=25, 50.90 at 40, 48.72 at 55, 46.50 at 70, 42.24 at 90.

**`villainDiscipline` q = 0.85.** Each villain is drawn from the filtered pool with probability q
and from the whole deck with probability 1 − q. Even a 25-VPIP lobby reg turns up with junk, and a
hard percentile cliff at the range boundary is a fiction. q is **opinion**, not measurement; it
ships in `constants.villainLattice.discipline` and this paragraph is the whole of its
justification.

Villains are dealt **before** the board, which is the physical order and the one that keeps the
joint law uniform over valid (villains, board) tuples; dealing the board first would silently
up-weight the boards that block the range. When a pool is so blocked by the cards already dealt
that no member of it survives 4,000 rejections, the trial deals a random hand instead and the
generator counts it: **4,179 of 430,500,000 villain draws (0.0010%)** in the shipped run.

**Conservation does not apply here.** Gates I4 and I5 assert that equities over a *uniform* field
sum to fair share. A filtered field is not uniform and its equities do not: the combo-weighted mean
delta is negative at every lattice point (−1.36 pt at v=25, −0.67 at v=90), because a hero drawn
from the whole deck faces opponents drawn from better than the whole deck. Those gates are scoped
to the random-villain measurements and must stay that way. The scope is written into the code, at
the V1/I5 and V2/V3/I4 blocks in `scripts/verify.mjs`, so it cannot be lost to a refactor that
"generalises" the conservation check over whatever equity arrays it can find. And the exemption is
an assertion rather than an excuse: **I25 asserts that the combo-weighted mean delta is negative at
every lattice point**, which is the same fact stated positively — the filtered field is measurably
not uniform, so conservation is not the property to test it against.

**What the measurement says.** The headline is not that weak hands lose equity against a tight
range — it is that *rank overlap*, not strength, decides who loses:

| At v = 25, versus random | delta at N=1 | at N=3 |
|---|---|---|
| `BROADWAY_RUN × RB` | **−25.8** | −20.6 |
| `RUN0_HIGH × DS` | −19.0 | −14.4 |
| `ACE_JUNK × RB` | −7.2 | −2.4 |
| `TRASH × RB` | −1.0 | **+2.7** |
| `RUN0_LOW × DS` | +8.7 | **+9.6** |
| `RUN0_LOW × SSA` | +11.2 | +12.5 |

A tight pool is broadway- and pair-heavy, so broadway hands are the ones playing into domination —
they lose a quarter of their heads-up equity. Low rundowns share no ranks with that pool and *gain*
nine to twelve points multiway. Trash, which shares nothing with anything, is roughly flat and
gains slightly multiway. This is §7's domination lesson turning up in the multiway measurement, and
it is the most useful number v2 adds.

At v = 90 the pool is the deck minus its worst tenth, and it is close to random but not equal to
it: mean |delta| **0.81 pt**, worst cell **3.6 pt** (`BROADWAY_RUN × RB` again — even the bottom
tenth of the deck contains the hands it most wants to be up against). Any gate asserting "v=90 ≈
random" has to be written to that measured 3.6, not to a hopeful half-point.

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

### 5.1 Stack depth — the second dial on the same machinery

```
S(h, p, N, d) = 100 · ρ(h,N) · M_nut(h,N) · M_play(h) · R(p, N, ν, d) · M_deep(h, d)

M_nut (h, N) = 1 + κ(N)·(ν(h) − nuBar)             κ(N) = 0.15 + 0.13·(N−1)
M_deep(h, d) = 1 + λ(d)·(ν(h) − nuBar)             λ(d) = lambda · u(d)
                 − μ(d)·(cooler(h) − coolerBar)    μ(d) = mu · u(d)

R(p, N, ν, d) = base(p)^(1 + β·u(d)) · (1 − 0.10·(N−1)·(1−ν))

u(d) = log2(d / 100) / log2(2.5)        u(40) = −1,  u(100) = 0,  u(250) = +1
```

**The two multipliers are deliberately the same shape, and that is the argument.** All-in equity
does not change with stack depth — every `eq[N]` in the model is depth-independent — so there is
nothing here to simulate and no loading bar to draw (V2-PLAN §1). What depth changes is
*realization*: what a mistake costs you. That is the layer `M_nut` and `R` already live in. So
**κ(N) scales nut weight through field size and λ(d) scales it through cost-when-wrong**, they
enter the score identically, and they are written identically in `policy.mjs`. The one term with
no κ analogue is `μ(d)·(cooler − coolerBar)`, because a cooler only ever costs what is behind it:
at 100 bb a bet, at 250 bb a stack.

The separation is not just rhetorical, and gate **I27** turns it into a testable fact: the three
`N_eff = 3.0` discontinuities the model contains on purpose (§11, I16) sit at exactly the same VPIP
at 40 bb and at 250 bb. A field effect does not move when the stacks move.

**The depth coordinate is logarithmic**, because the slider's own domain is geometrically symmetric
about its reference: 100/40 = 250/100 = 2.5. One normalised coordinate therefore drives all three
curves, and **each constant is its own endpoint value** — λ(250) = +`lambda`, λ(40) = −`lambda`.
V2-PLAN §3.1 offered a linear-in-`d` form (`base(p)^(1+β·(d−100)/150)`) or a lerp, to be picked
during calibration. Linear in `d` was rejected: it puts 40 bb only 40 % as far from the reference as
250 bb is, on a quantity whose natural unit is the stack-to-pot ratio, where the two are exactly
equidistant. It would also have given the positional term a different notion of "deep" from λ and μ.

`u(100) = 0` **exactly** — the code branches on it rather than trusting `Math.log2(1)`, and
`base(p)^1` is short-circuited rather than trusting `Math.pow` — so the whole depth layer is the
bit-exact identity at the v1 operating point. That is invariant **I22**, and it is checked twice:
by the tier fixture, and by a unit test that recomputes the v1 score expression by hand and
compares with `Object.is` over 10,000+ (cell, position, N, shift) combinations.

#### The four constants, all opinion

> **The caveat that used to stand here is closed.** `constants.depth` is now in the shipped
> `data/model.json`, along with `constants.rake` and `constants.straddle`, so the Method view can
> render every scoring constant this document describes and rule 1 holds again. It got there
> **without a regeneration**, because none of these constants contains any randomness: `verify.mjs`
> now refreshes `model.constants` from the live `policy.CONSTANTS` before it runs the gates
> (`stampConstants`), assembling the same `{ ...CONSTANTS, <measured> }` literal the generator
> builds and carrying the six measurement keys — `nuBarMeasured`, `coolerBarMeasured`, `nMax`,
> `mosaicTotal`, `cooler`, `villainLattice` — across untouched. Opinion's source of truth is the
> code; measurement's is the run that produced the file; the split is the generator's own.

| Constant | Value | How it was anchored |
|---|---|---|
| `depth.lambda` | **0.25** | To κ. κ swings 0.520 across the field axis (0.15 heads-up → 0.67 six-way); λ swings 2·λ across the depth axis. 2·0.25 = 0.50 gives depth **96 % of the authority field size has over the same quantity** — the quantitative form of "two dials on one piece of machinery", and the only non-arbitrary anchor available for a curve nothing can measure. |
| `depth.mu` | **0.60** | To the two measurements' own spreads. Combo-weighted over the 123 live cells, sd(ν) = **0.0831** and sd(`cooler`) = **0.0353**, so `mu = lambda · 0.0831/0.0353 = 0.589`, rounded. Matching per *standard deviation* rather than per *range* matters: `cooler`'s range is set by two tiny cells (`TRIPS_SMALL × RB`, 441 combos), and matching ranges would have given 0.91 and let those two drive the dial. |
| `depth.beta` | **0.35** | To `baseR`'s own seat steps. Across the whole slider HJ (base 0.99) moves 0.0035 and CO (1.02) moves 0.007, while SB (0.90) moves 0.033 and BTN (1.06) moves 0.022 — about one step of `baseR` itself (SB→BB is 0.03, CO→BTN 0.04). **The deep end of the slider is worth roughly one seat of position.** `|β| < 1` is a hard constraint, not a preference: the exponent `1 + β·u` is order-preserving only while it is positive, and at β = 1.2 it reaches −0.2 at 40 bb, where the seat table inverts and the small blind realizes better than the button. Gate I23(f) asserts the order directly, because nothing else notices — positional nesting is a cascade, so it enforces whatever order it is handed. |
| `depth.coolerBar` | **0.40** | The reference `cooler` the μ term is signed against. Authored, not measured, for exactly the reason `nuBar` is: an anchor that moved on every regeneration would shift the scoring surface under you. Held at the round number nearest the measured combo-weighted pool mean (`constants.coolerBarMeasured` = **0.3953**) so that the depth slider **re-sorts** the grid rather than inflating or deflating it. |

**Why the μ term is not a restatement of the λ term.** Combo-weighted, corr(ν, `cooler`) = **−0.590**
across the 123 live cells. The two measurements share about a third of their variance and the other
two thirds is what the depth axis says that the VPIP axis cannot. Where they disagree — a hand that
is nutty *and* cooler-prone — μ is allowed to overrule λ, and the most important thing the depth
dial says is a case of exactly that (below).

The **hard nut gate stays a function of the field and of nothing else** (§6 step 3). Depth enters
through `M_deep` and the positional spread only. That is what keeps the two dials separable, so
"the nut gate bit here" always means the table got looser and never means the stacks got deeper.

#### What the anchors said, and what the measurement said back

V2-PLAN §3.1 wrote four directional anchors before the curves existed. Two survived as written, one
had to be restated in a different unit, and one is false. Gate **I23** is written to the
measurement, the way I24 and I25 are.

| §3.1's anchor | Verdict |
|---|---|
| `AA72r`-type cells: tier non-increasing as *d* rises, gaining a tier somewhere at 40 bb | **Survived.** `AA_DANGLER × RB` has **0** monotonicity violations across the depth grid at all 105 settings (checked on a 5 bb grid too), gains a tier at 40 bb at **8** of them — all at `raise/BTN` and `raise/SB`, where bare aces are a shove rather than a hand — and moves at all at 44. |
| `JT98ds` / rundown-DS cells: tier non-decreasing with depth | **Restated — the unit was wrong, not the direction.** A tier here is a **percentile cut, not a property of the cell**: a mid-pack cell whose own `M_deep` rises is still demoted when the cells above it rise faster. Measured, the claim fails in both directions at once — `RUN0_HIGH × DS` and `BROADWAY_RUN × DS` never change tier at any depth at any setting (true and vacuous), while `RUN2 × DS` and `RUN1_TOPMID × DS` change tier *both ways*. In **score rank**, which is a property of the cell, it holds: `BROADWAY_RUN × DS` loses no rank at any depth step and gains up to 26 places from 40 bb to 250; `RUN0_HIGH × DS` / `× SS` finish better at 250 than at 40 at **75/75** and **70/75** settings. |
| — *(and the same anchor read on the low rundowns)* | **False, and asserted in its falsified form.** `RUN0_LOW × DS` — 5432ds and the wheel — gets **worse** with depth: worse rank at 250 than at 40 at **49** of 75 settings, better at 9. `RUN0_LOW` carries `cooler` **0.4268**, the highest in the rundown band and well above the 0.40 bar, while its ν of 0.43 is a whisker over `nuBar` — so μ overrules λ. That is the right poker answer (the low end of a straight is what gets stacked deep) and it is the most useful thing the depth dial says. |
| Big-pair rows with pair rank J/T demoted at 200 bb **via the μ·cooler term specifically** | **False for the J half, for the same taxonomy reason that broke §2.1's five-step cooler ladder (I24).** `rowOf` splits pairs at J, so JJ/QQ/KK share the big-pair band while TT sits with the small pairs. Combo-weighted the big-pair band's `cooler` is **0.3563**, *below* the 0.40 bar, so the μ term **promotes** 21 of its 23 cells with depth. Measured at 200 bb against 100 bb: **46** big-pair demotions, every one attributable to λ (low ν) and **not one** to μ; and **92** μ-attributable demotions over 7 cells, every one a small pair or `RUN0_LOW`. The small-pair band (**0.4386**) is the one μ punishes. The TT half of "tens and jacks are the low end of top set" is what this taxonomy can express; separating JJ from TT is new rows, not a new constant. |
| Painted width: bounded drift across the full *d* range | **Survived.** Worst drift **3.16** points from the 100 bb width (`rfi/BTN` at VPIP 70: 46.5 % at 40–60 bb against 49.6 % from 100 up — one cell crossing the cut), against I21's own 4.0-point allowance. The painted range never collapses either: narrowest **12.6 %** at any depth, against I12's 10 % floor. |

Attribution is computed, not asserted: for each demoted cell the two halves of `M_deep` are
evaluated separately at 200 bb, and a demotion is called μ-attributable only when the cooler half is
negative *and* larger in magnitude than the ν half.

**Scale.** Across the whole 40 → 250 bb span at VPIP 55, the depth dial moves **205** cell-tiers over
the 21 legal (node, position) pairs. The VPIP dial across its whole 25 → 90 span moves **241** over
the same pairs. Depth is deliberately the slightly quieter of the two: VPIP is the product's
headline axis, and depth is a re-sort on top of it.

#### The vs-3-bet node under depth

The 29 % pot-odds breakeven **does not move with depth**. It is a price, set by the sizing, and
prices are not preferences (rake does move it — §10.4 — and that is exact arithmetic, not opinion).
What moves is the shape of the continue range, through two constants:

- **`depth.nuFloor` = 0.015**, shifting `nuCall` and `nuOOP` together: 0.385 / 0.415 and 0.405 /
  0.435 at the two ends. Deep, an SPR of ~12 after the call is where a second-best hand costs a
  stack, so the nut floors rise; shallow, an SPR of ~1.5 is a flip and raw equity is most of the
  game — the same statement λ makes, at a node that cuts on absolute thresholds instead of on a
  percentile. The **value** was chosen on a fact about the file rather than about poker: ν ships to
  two decimals, so a floor landing *on* a hundredth is a coin flip for every cell sitting exactly
  there. 0.015 puts all four endpoint floors on half-hundredths. 0.010 was measured and rejected
  for precisely this — it puts `nuOOP(250)` at `0.42 + 0.01`, which is 0.4299999999999999933 in
  binary, and lands on the low side of the I15 anchor cell's ν of 0.43 purely by the direction of a
  rounding error. §7's rule that a floor set *at* a measurement fails on noise applies to the float
  grid as well as to the measurement.
- **`depth.fourBet` = 0.06**, on the 50 % four-bet bar. **This lever is half dead and the
  measurement says so.** Against the default mix all 21 AA-row cells that can four-bet measure
  between **54.3 %** and **65.1 %**, so there is a 4.3-point gap below the bar and *nothing for a
  falling bar to add*: V2-PLAN §3.1's "shallower favours 4-bet" is not expressible through this
  threshold on this grid, and any value under 0.043 would be provably inert in both directions.
  0.06 is the round number just past the gap. Deep it takes the bar to 0.56 and moves the three
  weakest AA cells — the rainbow and suit-wasted danglers and connectors — out of the four-bet lane
  and into the call lane, which is the half of the plan's claim that survives.

Consequences of both, stated rather than avoided:

1. **`RUN0_LOW × DS` stops defending out of position above about 184 bb.** I15 asserts that anchor
   at the v1 operating point, where it is untouched; the depth term takes it away deep, and that is
   the cell with the highest cooler rate in the rundown band, so it is the measurement talking.
2. **The ladder gained a rung it did not have.** Until the bar could move, it was a constant 0.50
   and every AA cell measured at least 54.3 %, so no AA hand ever fell through to the nut floors and
   nobody had to decide what should happen if one did. With the bar at 0.56, three of them do — and
   the floors would have folded them, because `AA_DANGLER × RB` is ν 0.22. Folding aces at 54 % into
   a 29 % price is not a defensible verdict at any stack depth, so **an AA row is now exempt from
   the nut floors**: the floors exist to keep *speculative* hands out of a 3-bet pot, and AAxx is
   the one row that is never speculative. The branch is unreachable at the v1 operating point, so
   I22 is untouched; it is reachable at a hand-edited villain mix, where it is also the right
   answer. One visible consequence at the operating point: the AA rows' `margin` at this node now
   reports the four-bet bar rather than a nut floor their decision never consulted. That
   mis-attribution was already there — an `AA_DANGLER` cell read *"18 ν points short of the 0.40
   continue floor"* on a cell the model was telling you to four-bet — and it is fixed in the same
   pass. No tier moves; 5,016 margins and 6,600 reason lists do, all of them AA rows at this node.

---

### 5.2 Rake — one fraction, applied two ways, and honest about which one moves anything

V2-PLAN §3.2's model, implemented as written and **documented as crude because it is crude**. One
number carries the whole feature:

```
rakeFrac(env) = min( rakePct/100 ,  rakeCapBB / (potBB · unitBB) )
```

which is `rakePct · capFactor` in the plan's notation, with `capFactor = min(1, rakeCapBB /
(rakePct/100 · potBB · unitBB))`. It is the real thing a house takes as a fraction of the pot: the
headline percentage until the cap is reached, and `cap / pot` after that. It enters in two places.

**On the score, as §3.2 specifies:** `rho_eff = rho · (1 − rakeFrac)`, applied after the vs-Raise
`tighten` shift, inside `scoreCell`.

**On the price, as exact arithmetic:** call `c` into a final pot `P` and collect `P·(1 − r)` when
you win, so `e·(P(1−r) − c) = (1−e)·c` and `e = c / (P(1−r)) = breakeven / (1 − r)`. The 0.290
constant is untouched; the price is derived from it. At the 5% default preset the price is 30.53%.

| Constant | Value | What it is |
|---|---|---|
| `rake.min` / `rake.max` | **0** / **6** | The slider's domain, clamped in `envOf` the way `d` is: outside it the model is extrapolating. |
| `rake.preset` | **5** | The **UI's** default (§3.2: "5% — the lobby this tool is for"). The **function** default is 0, because gate I22 is the claim that v2 reproduces v1 at v1's operating point and that point has no rake. Phase 3 reads `preset`; nothing in the scoring layer does. |
| `rake.capBB` | **3** | The cap, in big blinds, and the default of `OPERATING_POINT.rakeCapBB`. |
| `rake.potBB` | **60** | The reference raked pot, in preflop units. **Authored**, like `nuBar` and `coolerBar`, and for the same reason — it is the number that makes `rakeCapBB` mean anything, so it must not move under a regeneration. 60 is chosen so that the default preset sits exactly on the cap's knee (3 / 60 = 5%), which is also true of the lobbies this models: a 5%/3bb game reaches its cap in pots of 60bb and up, and a single-raised pot at 100bb usually does not. |

Putting the preset on the knee has a consequence worth stating, because the preset sits there **by
construction**: the cap binds at 3 / 60 = 5%, so every slider setting from the preset upward yields
the same `rakeFrac` of 0.05 — 5%, 5.5% and 6% are bit-identical in every derived quantity, and the
flat tail in I31(b)'s detail line (`UTG … 42 → 41 → 41`) is that, not noise. Straddled the knee
moves down to 2.5%, the same 3bb cap measured against a 2bb unit, so a Phase-3 slider running to 6%
is inert above 5% unstraddled and above 2.5% straddled.

#### The finding that matters, asserted rather than lamented

**A flat multiplier on ρ is tier-inert at the three percentile nodes, by construction.** Every score
is `100·ρ·M_nut·M_play·R·M_deep`, so a factor common to every cell scales every score, every
interpolated cut and every margin by one number and re-orders nothing. Measured at the 5% preset
over 27,675 cell-settings: **0 tiers move, every score moves, and every score ratio equals
(1 − rakeFrac) to within 2 ulp.** This was predicted before the code was written (the note stood at
the `rakeRhoFactor` seam through the depth work) and it is now **gate I31(a)** — asserted, so that
nobody "fixes" the rake into a non-uniform haircut without making that a deliberate model change
with its own justification. What such a model would have to look like: subtractive rather than
multiplicative, or applied before the `tighten` shift rather than after it.

So the direction §10.4 states — *every marginal hand moves toward fold* — is realised at the one
node whose threshold is **absolute**: vs-3-bet. There the price is arithmetic and the **continue
floor rides on it**:

```
callFloorAt(env) = call + ( breakevenPrice(env) − breakeven )        0.36 → 0.3753 at 5%
```

This is an **interpretation, and it is worth naming as one.** §3.2 says rake "raises the 0.290 price
directly" — but in v1 that price was *display-only*: it is quoted in the WHY panel and consulted by
nothing. Raising a number nobody reads would have made §3.2's own promise false at the only node
where it can be true. The model's own reason line has always described the floor as *"the price plus
7 points, because a 3-bet pot is played out of position over three streets"* — the 7 points are the
opinion, the price underneath them is arithmetic — so rake moves the floor by exactly the amount it
moves the price and the premium rides on top unchanged. The alternative, rejected: leave the floor at
0.36 and let rake change only the panel's text. Measured effect at the preset: the vs-3-bet continue
range narrows monotonically in `rakePct` on the **action** tier (not the MIX overlay, for the reason
I16 documents), from 45 cells to 41 at UTG and 49 to 44 at CO across 0–6%.

**The 4-bet bar is deliberately left unraked.** It is a comparison against the villain's range, not a
price hero is being laid, and raking it would be a second opinion where §3.2 asked for arithmetic.
The choice costs nothing measurable today: `0.50 / (1 − 0.05) = 0.5263` sits inside the same
4.3-point gap above the highest-folding AA cell that §5.1 measured for the depth term.

---

### 5.3 The straddle — one fact with three consequences

**UTG straddle only** (V2-PLAN §3.3), modelled as a pure transform onto machinery that already
exists, which is why it needs no new measurement. The one fact is that **the preflop betting unit
doubles**; `CONSTANTS.straddle` holds exactly two numbers.

| Constant | Value | What it is |
|---|---|---|
| `straddle.unit` | **2** | The preflop unit, in big blinds. Everything below is this number. |
| `straddle.seat` | **0.77** | One seat of the model's *own* opening ladder, as a geometric mean because `widthFor` is multiplicative: `baseRaise` steps UTG→HJ ×1.250 and HJ→CO ×1.350, so a seat is √(1.250·1.350) = 1.2990 and one seat tighter is 1/1.2990 = **0.770**. The CO→BTN step (×1.667) is excluded from the mean on purpose — see below. |
| `straddle.seatPinned` | **[]** | Seats that keep their unstraddled base. Empty, and that is a **falsification of V2-PLAN §7.2** — see below. |

```
straddle ON  ⇒  dEff  = clamp(d / unit)              the §5.1 dial, unchanged
                N_eff += cBlind(v)                    (× vsRaiseBlind at the vs-Raise node)
                w      = baseRaise[pos] · seat · (1 + widthSlope·(v − 0.5))
                rake   = min(pct, cap / (potBB · unit))
```

**Depth.** `d → d/2`, clamped to the slider's own domain the way every other depth is. *Owned
consequence:* the depth half **saturates below 80 bb** — 40/2 is already off the bottom of the dial —
so a straddle at 40–80 bb is a pure field-and-seat effect.

**Field.** The straddler is one extra defender behind *every* seat (he acts last preflop) and he
defends like a blind, so he joins `N_eff` at `cBlind(v)`, at the same discount the node already
applies to its blinds. The six modelled seats keep their names — they are positions relative to the
button, which a straddle does not move — and the straddler is the seventh player: §3.3's "de-facto
UTG+straddler table". Nothing is added at the vs-3-bet node, which is heads-up by construction.
§7.2's second lean is kept: **no straddler iso node.** The straddler is modelled as a defender,
never as a hero seat.

**Seats, and where §7.2 is wrong.** §7.2 leaned *"BTN keeps its 0.45 base under a straddle"*.
Measured over 5 RFI seats × 5 VPIP × 6 depths, **that lean makes I26 false**: with BTN pinned the
button's *painted* range gets **wider** at 7 of its 30 settings (up to +2.49 points, worst at VPIP 25
/ 40 bb; 16 of 30 on 10k-trial data) and its mean ν **falls** at 8. A straddle cannot make the button
open wider — it puts one more player behind him. So the factor applies at **every** seat,
`seatPinned` ships empty, and §7.2's lean is recorded as falsified rather than honoured. Candidates
measured: no seat shift at all (48 of 150 settings *loosen* — the field and depth halves alone
cannot carry the claim), BTN pinned (7 loosen), BTN+SB pinned (19 loosen), every seat (**0 loosen,
150 of 150 tighter**).

*Not asserted, and measured so it can be stated instead:* the **vs-Raise** node does not tighten.
`w3bet` is a flat percentile of the pool with no seat base, so §3.3's seat transform has nothing to
act on there; measured it goes both ways (47 tighter, 77 looser, 26 unchanged). **A straddle tightens
the range you open; it does not tighten the range you 3-bet with.** That is a real limitation of the
transform, listed in §10.

**Prices.** Every threshold in this model is a **ratio** and therefore scale-free — the 29% vs-3-bet
breakeven does not move under a straddle at rake 0. The single exception is the **rake cap**, which
is quoted in big blinds while the pot it caps is quoted in preflop units, and that is the whole of
§3.3's "only the vs-3-bet absolute price recomputes off the doubled preflop unit". Under a straddle
the same pot is twice as many big blinds, so the cap binds twice as hard and the effective rake
**falls**: 5% becomes 2.5% at the shipped 3bb cap. Counter-intuitive and correct — capped rake in a
bigger game is a smaller fraction.

#### The composition case §3.3 asked to have checked

§3.3 flagged it explicitly: *"shallow + multiway both point the same way once M_deep's λ flips sign
below 100 bb — verify this composition explicitly; if λ(50) < 0 fights the field effect, the gate
documents which wins and why."* It does fight it. **The field wins.**

Isolated at **matched width** (the I11b construction — score the grid with one half of the transform
at a time and cut at the width the *unstraddled* model paints, so the seat shift cannot flatter the
result), over 150 RFI settings:

| Half | mean Δν | settings |
|---|---|---|
| field only (`N → N + cBlind(v)`) | **+0.286 pts** | 130 up, 0 down |
| depth only (`d → d/2`) | **−0.144 pts** | 24 up, 76 down |
| both | **+0.183 pts** | 113 up, 20 down |

The depth half does exactly what §3.3 feared — shallower stacks make nuttiness worth less (λ < 0) and
coolers cost less (μ < 0), and it re-sorts *away* from ν at 76 of 150 settings. It is simply not big
enough to turn the result over: the composed transform keeps **64%** of the field effect (44% on
10k-trial data).

**And the reason is worth keeping, because on the ν coefficient alone the depth half *should* win.**
Δκ = 0.13·cBlind(v) is +0.032 (VPIP 25) to +0.107 (VPIP 90), against λ(d/2) − λ(d) = **−0.189 flat** —
the depth term is 2× to 6× larger. What completes the field's margin is not the opinion layer but the
**measurement**: the multiway realization slope adds another +0.027 to +0.122 per unit ν, and ρ is
read further up its own N curve, which is §3.1's inversion (I3) doing the work. The margin is
thinnest exactly where κ has least to give — at VPIP 25 it is +0.076 points with 11 of 30 settings
going the other way — and widest at VPIP 70 (+0.301). Pinned by **gate I26(c)**, which asserts each
half separately, so a future change that reverses the verdict fails with the decomposition in its
detail line rather than as a moved tier somewhere else.

#### What the transform does not model

- **BB can open under a straddle** (the straddler acts after the blinds), so `positionDisabled('BB',
  'rfi')` is wrong under a straddle and SB is no longer second-to-last. Not implemented: it is a
  structural change to the game tree and to the grid the page paints, not a scoring change. Listed
  in §10.
- The **2 bb the straddler posts** is dead money the `derived()` pot readout does not add. That
  readout multiplies by the unit so it is quoted in big blinds correctly; the dead money is a
  copy-level omission.

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

**Both ν floors and the four-bet bar now move with stack depth** (§5.1). All three values quoted
above are the ones at the v1 operating depth of 100 bb, which is where I15 and §7.1's anchors are
asserted; `nuOOP` reaches 0.435 at 250 bb, which takes the `RUN0_LOW×DS` anchor away out of position
above about 184 bb. The price at the top of this section — 0.290 — does **not** move with depth.
And the AA rows are exempt from these floors entirely, a rung the depth term forced into existence:
see §5.1's "The vs-3-bet node under depth".

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

**Stream discipline across the v1/v2 boundary.** Invariant I22 requires v2 to paint v1's tiers
exactly, which requires every v1 equity to reproduce bit for bit, which requires every v1 stream to
consume exactly the draws it consumed in v1 — in the same order, leaving the same stream position.
So the new measurements never interleave into an old stream:

| New measurement | Where its randomness comes from |
|---|---|
| villains 6 and 7 | a second stream, `stream6\|<stage>`, continuing the same partial Fisher-Yates into deck positions 25–32 after the v1 stream has finished with positions 0–24. The v1 draws cannot see it, and the first 25 positions are never revisited. |
| `cooler` | nothing. It is two counters over showdowns the kernel has already evaluated. |
| the eq1 ordering | its own stage and its own stream, `eq1\|<block>`, split into a fixed 30 blocks so that `--workers` cannot move a number. |
| the villain lattice | `villain\|latt\|<v>`, reseeded per trial so that rejection sampling — whose draw count depends on hero's cards — cannot make one cell's stream drift out of step with another's. Hero is drawn from the *cell* stage's stream, so the shipped delta is a paired comparison, hand for hand. |

Verified, not assumed: the regenerated file reproduces the committed v1 model's `eq[1..5]` on all
123 cells and all 341 sub-buckets, and its `nu`, `mplay` and `eqVs3bet`, with **zero** differences.
`test/v2-measure.test.mjs` keeps a frozen copy of the v1 kernel and holds the current one against
it, so a future edit that perturbs a v1 stream fails with a pointed message rather than as 170,478
moved tiers.

### 9.3 Trial budget

| Stage | Work | Trials | Standard error |
|---|---|---|---|
| S0 enumerate | classify all 270,725 hands; per-cell and per-sub-bucket lists, features, combo matrices; empty-cell causes; mosaic geometry | exact | — |
| S0b classes | collapse the deck into 16,432 suit-isomorphism classes | exact | — |
| S1 villain prep | enumerate the four 3-bet component ranges into packed arrays | exact | — |
| S1b villain ordering | 60,000 shared deals over the 16,432 class representatives → eq1, then the five filtered pools | ~658M showdowns | ±0.30 pt/class |
| S2 cell equity | 100,000 multiway trials per non-empty cell (hero fresh from cell, 7 villains + board, prefix comparison) + the cooler counters | ~12.3M | ±0.16 pt/cell |
| S2L villain lattice | 100,000 trials per cell per lattice point, villains from the filtered pool | ~61.5M | ±0.16 pt, paired on hero |
| S3 vs 3-bet | 40,000 heads-up trials per cell per component, villain rejection-sampled by range index against a 52-bit used-mask | ~19.7M | ±0.25 pt |
| S4 sub-buckets | 40,000 multiway trials per sub-bucket | ~13.6M | ±0.25 pt |
| S5 derive + emit | ρ, ν, wave delays, `mplay`, `cooler`, lattice deltas, `adjMean`, rounding, hashing | — | — |
| S6 verify | all gates, benchmark re-measurement, cross-engine check | ~1.2M | — |

Four workers, jobs handed out a chunk at a time so a slow unit cannot starve a worker, results
posted as `Float64Array` transferables. Measured wall clock for the shipped v2 run on a 4-core box:
**188 s** — S1b 27 s, S2 12 s, S2L 101 s, S3 5 s, S4 13 s, benchmarks 7 s, verify 22 s. The hard
budget is still 6 minutes. `--fast` divides every trial count by 10 (~30 s), widens verify
tolerances, and stamps `meta.fast = true` so a fast dataset cannot be shipped into the page by
accident.

The lattice is the expensive stage and it is the honest cost of the measurement: five VPIP points
× 123 cells is five times S2's work, and it is why the villain pools are precomputed once (S1b)
rather than re-derived per cell.

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

### 9.10 Payload budget — what `model.json` costs, and on which basis

The data file is committed, injected verbatim into `index.html`, and therefore paid for twice.
V2-PLAN §2.5 budgets it at **≤ 220 KB**, and gate **D7** enforces that on the artifact **as
emitted** — the exact minified byte string `generate-data.mjs` writes to disk, which is also what
`build.mjs` injects.

| | minified, as emitted | `JSON.stringify(m, null, 1)` |
|---|---|---|
| v1 | 105.1 KB (107,667 B) | 161.7 KB |
| **v2, shipped** (5 lattice rows) | **143.1 KB (146,551 B)** | **242.2 KB** |
| v2, 3 lattice rows (not shipped) | 134.6 KB (137,854 B) | 221.0 KB |

The v2 row has moved three times since the measurement pass, and none of the moves is payload.
`model.gates` is part of the file, so each new gate adds a key/value pair: **+38 B** for I24/I25/D7
(phase 1, taking 146,171 → 146,209), **+39 B** for I23/I27/I28 (phase 2A, → 146,248), and in phase
2B **+52 B** for I26/I29/I30/I31 together with **+251 B for `constants.depth`, `constants.rake` and
`constants.straddle`**, which `stampConstants` put into the file without a regeneration (§5.1)
— 146,551 in total. V2-PLAN §2.5's table records the original pre-gate reading, 146,171 B. The
measured payload — cells, sub-buckets, lattice — is unchanged throughout.

**Why the minified basis, stated plainly.** The plan's sentence budgets 220 KB against
"`model.json` is 105 KB today", and that 105 KB is the *minified* v1 file — v1 pretty-prints to
161.7 KB. Two numbers in one sentence have to be on the same basis. And read literally as a
pretty-printed ceiling, the rule is unsatisfiable by its own escape hatch: §2.5's stated fallback
of dropping the villain lattice to three v-points still pretty-prints to 221.0 KB. A rule its own
remedy cannot meet is the wrong reading of the rule. The pretty-printed figure is not hidden — it
is printed in the detail lines of both D6 and D7 on every run, and it is 242.2 KB.

Inside that ceiling, **D6** carries the budget that actually bites: cells ≤ 65 KB (measured
62.2), sub ≤ 72 KB (69.5), meta + tables ≤ 13 KB (10.8), total ≤ 150 KB (143.1) — 4–5 % headroom
on the two large blocks, the same margin v1 ran at (38.6 / 40 KB and 58.4 / 60 KB). Those budgets
are sized to catch a payload that creeps, not to leave room for one, and the meta budget was
*tightened* from 14 KB because the new measurement constants cost under a kilobyte between them.
D7 is the published contract and is deliberately slack against D6: if D7 ever fires, D6 fired a
long time earlier.

One honesty note on the numbers those gates print. At generate time the model has not yet had
`gates` and `meta.hash` stamped into it, so the size measured inside the generator run is ~0.6 KB
short of the file that lands on disk; re-running `node scripts/verify.mjs` over the written file
reports the true 146,551 B. Both readings sit far inside the ceiling, and D7's unit test asserts
the equality that makes the basis honest — `Buffer.byteLength(JSON.stringify(model))` is exactly
the size of `data/model.json` on disk.

**What this budget does not cover.** `index.html` is **already 419.1 KB against its own 400 KB
build gate** before v2 adds anything, and the model is injected into it verbatim; with the v2
payload the page measures 457.7 KB. That is a `build.mjs` problem, not a `model.json` problem —
shipping two fewer lattice rows would have saved ~8 KB of a ~58 KB overage — and it is called out
as such in V2-PLAN §2.5.

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
3. **Stack depth is scored, never measured.** The `d ∈ [40, 250]` axis (§5.1) is a scoring-layer
   re-sort: `M_deep` and a widened positional spread, anchored on the *measured* `cooler` rate but
   with curves that are pure opinion, calibrated against I23's anchor set and nothing else. This is
   defensible because all-in equity genuinely is depth-independent, so nothing about the
   measurement changes when the stacks do — but the thing depth actually changes, street-by-street
   realization, is not modelled at all here and would be a v3-sized project (V2-PLAN §0). Outside
   [40, 250] the model has nothing to say and `d` clamps, the way `N_eff` does.
4. **Rake is modelled, crudely, and it moves less than you would expect.** Low-stakes lobbies rake
   roughly 5% of every pot and V2-PLAN §3.2's model of that is now implemented (§5.2): one fraction,
   `min(pct, cap/pot)`, applied as a flat haircut on ρ and as exact arithmetic on the vs-3-bet
   price. The limitation is what that model *can* express — a haircut common to every cell moves no
   percentile tier, so at the RFI, iso and vs-Raise nodes the slider changes every score and no
   decision. Only the vs-3-bet node, whose threshold is absolute, actually tightens. A rake model
   that re-sorted the grid would have to be non-uniform across cells, which is a much bigger claim
   about what rake does to hand values, and it is not made. Gate I31 asserts both halves.
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

13. **The straddle changes the game tree and the model only changes the scoring.** V2-PLAN §3.3
    models a UTG straddle as a transform — one extra blind-like defender, half the effective depth,
    the opening bases one seat tighter — and that transform is exact within the scoring layer
    (§5.3). What it does not do is change the tree: under a straddle the big blind no longer closes
    the pot, so BB *can* open-raise and the small blind is no longer second-to-last, but
    `positionDisabled('BB', 'rfi')` still refuses that node. Nor does the vs-Raise 3-bet width
    tighten, because `w3bet` is a flat percentile of the pool with no seat base for the transform to
    act on — measured, it moves both ways (47 tighter, 77 looser, 26 unchanged over 150 settings).
    So the honest scope of the feature is: **a straddle tightens the range you open and re-sorts it
    toward nut potential; it does not restructure who is allowed to act.**
14. **The rake model is a flat haircut and a flat haircut cannot move a percentile.** §5.2 states
    this in full and gate I31 asserts it: at the RFI, iso and vs-Raise nodes the rake slider changes
    every score and no tier. It is the model V2-PLAN §3.2 specifies and it is documented as crude
    there and here; the direction it claims — every marginal hand toward fold — is real only at the
    vs-3-bet node, whose threshold is an absolute price. A rake model that re-sorted the grid would
    have to be non-uniform across cells, which is a different and much bigger claim about what rake
    does to hand values, and it is not made.

### v2 list

Monte Carlo to N = 7 · stack-depth axis · a rake model · VPIP-filtered villains instead of random
ones · a 3-bet sizing control · the expand-in-place sub-bucket UI that consumes the depth layer
already in the data · the frame-budget harness above, if anything ever needs to compute at runtime.

---

## 11. Invariants

Thirty-one model invariants, asserted by `scripts/verify.mjs` over v ∈ {25, 40, 55, 70, 90} × 6
positions × 4 nodes — I22, the regression gate, sweeps every integer v from 25 to 90 instead,
I24/I25 assert the shape of the v2 build-time measurements over the emitted data itself,
I23/I27/I28 sweep the depth axis on top of the same grid, and I26/I29/I30/I31 sweep the straddle
toggle and the rake slider — **45 gates in total** with the D and V families and the benchmark
gate. The numbering has no holes left: I26 was reserved by V2-PLAN §3.4 for the straddle and is now
written to the measurement, like the rest of the I23–I31 block. **Any violation fails the build**
and nothing is emitted. The gate results are stamped into `model.gates` and rendered by the Method
view, so the page shows the gates *this* dataset passed — as, now, are the scoring constants
themselves (§5.1).

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
| I17 | Dual-key partition: Σ sub-bucket combos = cell combos for all 145 cells; Σ cells = 270,725. Extended to the fields the sub layer carries in its own right (§2.4): the combo-weighted **geometric** mean of the buckets' `mplay` rebuilds the cell's exactly, to a 3-dp rounding tolerance of 0.002 (worst measured 0.00066, `DBL_CONNECTOR×SS`); and every cell's `cooler` lies inside its buckets' range, widened by 0.04 for the sampling error between a 100k-trial cell and its 40k-trial buckets (worst measured 0.0130 at `BIGPAIR_ACE×DS`, one of the 45 cells holding a single bucket, where the bracket collapses to a straight re-measurement). The `cooler` half is a bracket rather than a reconstruction because the exact weight is combos × P(set or better), which the file deliberately does not carry. |
| I18 | Geometry: the quantized mosaic column widths sum to exactly 530 px and each is within 1 px of exact proportionality. |
| I19 | **T2 is empty at v = 25** for every (position, node ∈ {RFI, vs-Limps, vs-Raise}) — the exploit-tier definition holds by construction. |
| I20 | Cross-engine agreement: `eval5.mjs` and the independently written `equity-ref.mjs` agree within ±0.6 pt on ten benchmark hands. |
| I21 | **The painted range widens as the table loosens.** `aggrCombos / 270,725` — not `targetWidth` — is wider at VPIP 90 than at VPIP 25 at all 15 (node, position) pairs: rfi UTG 14.1→16.6, HJ 16.5→21.4, CO 24.2→30.8, BTN 40.9→51.3, SB 28.3→36.4; limps HJ 16.9→27.0, CO 23.9→36.9, BTN 39.1→48.5, SB 27.9→44.8, BB 27.9→45.9; raise HJ 6.6→12.4, CO 6.1→11.2, BTN 6.1→12.4, SB 6.1→11.3, BB 6.2→10.0. Asserted as endpoints plus a bounded local dip, **not** pointwise: pointwise is unsatisfiable for the granularity reason I16 documents — one cell crossing the percentile cut is a visible step. The dip allowance is 4.0 points, half the largest single cell (8.1%); the worst measured drawdown is 3.2 points at rfi/BTN, v = 0.73. This gate exists because nothing tested the painted number before, which is how the range could collapse to half its width at the iso nodes without any gate firing. |

| I22 | **v1 reproduction.** At the v1 operating point — 100 bb deep, rake 0, straddle off, random villains, two limpers, a CO raiser, the default 3-bet mix — the pipeline paints the tiers v1 painted, exactly: all 123 non-empty cells at all 1,386 (node, position, integer VPIP ∈ [25, 90]) settings, 170,478 tiers, compared character for character against `data/tiers-v1.fixture.txt` (27 KB, delta-encoded down the VPIP axis because adjacent steps differ by 0.78 cells on average — the same fact I16 asserts). Both halves of each decision are frozen, the action tier *and* the MIX overlay sitting on it, so a change that swaps a CALL for a MIX-over-CALL is caught rather than shrugged at. On failure the gate reports how many settings and how many cell tiers moved, and names the first four. The gate costs ~0.3 s of pure policy math and no Monte Carlo, which is what makes it affordable to keep forever. **Scoped to full-precision data:** on a `--fast` dataset the tier half is explicitly *not asserted* and says so in its own detail line, because 10k-trial equities are a different measurement — 7.4% of tiers move on noise alone, which is not the policy drift this gate exists to catch. What it still asserts on `--fast` data is the structural half: the cell set and the (node, position, VPIP) domain are unchanged. |
| I24 | **The cooler rate has the shape it measured.** `cooler` is P(the hand loses the pot outright **given** it reached showdown with a set or better), at three opponents, chops not counted as losses (§3.2). Asserted: the three-step *band* ladder, combo-weighted — AA 0.3184 < big pairs 0.3563 < small pairs 0.4386, each step ≥ 0.03; `cooler(SSA) ≤ cooler(SS) + 0.01` in all 18 rows carrying both columns (18/18 hold strictly today, and the gate says so, but the three thinnest margins are 0.003–0.009 against a difference SE of ~0.004, so a strict gate would be a coin flip on `RUN1_BOTTOM` at the next regeneration); `DBLPAIR_SMALL×RB` (2233r) in the top 8 of 123 cells and `AA_BIGPAIR×DS` in the bottom 8 — measured ranks 5 and 4, pinned as rank bounds so the anchors survive a shift of the whole table; every value in [0, 1] and inside the measured envelope (cells 0.257–0.501, sub-buckets 0.256–0.752), which is a guard against a changed *definition* rather than against noise; and `constants.coolerBarMeasured` rebuilding from the shipped cells to 0.00006 of a 0.002 rounding tolerance. **What it does not assert, deliberately:** V2-PLAN §2.1's five-step pair ladder TT > JJ > QQ > KK > AA is not expressible in this taxonomy (`rowOf` splits pairs at J; the sub-bucket key counts T-or-better), and the ladder is not even monotone per *row* inside a band — `AA_SMALLPAIR` 0.3453 sits above `BIGPAIR_CONN` 0.3216. Separating the pair ranks is new rows, not a new measurement. |
| I25 | **The villain-VPIP lattice has the shape it measured, not the shape that was predicted.** §2.3 wrote three expected shapes before the measurement; two survived and one did not, and the gate is written to the data (§3.3). Asserted: at v = 90 the filtered pool converges on the random baseline without equalling it — mean absolute delta 0.81 pt over 123 cells × 7 N and worst cell 3.6 pt, pinned at ≤ 1.2 and ≤ 5.0, so a "v = 90 ≈ random" tolerance under ~4 pt would have failed; mean absolute delta falling monotonically along the lattice (4.19 / 3.10 / 2.40 / 1.76 / 0.81 pt at v = 25 / 40 / 55 / 70 / 90); at v = 25 the six worst cells at N = 1, 3 and 5 all lying in rows {`BROADWAY_RUN`, `RUN0_HIGH`} with `BROADWAY_RUN×RB` ≤ −15 at N=1 and `RUN0_HIGH×DS` ≤ −8 at N=3 — *rank overlap*, not weakness; the six best all lying in {`RUN0_LOW`, `RUN1_TOPMID`, `RUN1_BOTTOM`}, every `RUN0_LOW` cell gaining at every N, and `RUN0_LOW×SSA` ≥ +5 at N=1 and N=3; and the combo-weighted mean delta negative at every lattice point, which is the positive form of the I4/I5 scope decision. **What it does not assert, deliberately:** §2.3's prediction that junk loses most. It is false — `TRASH×RB` *gains* multiway (+2.7 at N=3) — and the gate reports that measurement in its detail line instead of asserting the prediction. |
| I23 | **The depth axis moves the grid in the direction it claims to** (§5.1), swept over d = 40 / 60 / 100 / 150 / 200 / 250 bb at all 105 (node, position, VPIP) settings. Asserted: **(a)** `AA_DANGLER×RB`, the AA72r class, never gains a tier as stacks deepen (0 violations, on this grid and on a 5 bb one) and gains one at 40 bb at ≥ 4 settings (measured 8, all at `raise/BTN` and `raise/SB`); **(b)** in **score rank**, not tier — a tier here is a percentile cut, not a property of a cell — `BROADWAY_RUN×DS` loses no rank as depth rises and `RUN0_HIGH×DS` / `×SS` finish better at 250 than at 40 at ≥ 60 of 75 settings (measured 75 and 70); **(c)** the low-rundown falsification, asserted positively so it cannot be quietly reverted: `RUN0_LOW×DS` ranks *worse* at 250 than at 40 at strictly more settings than it ranks better (measured 49 against 9), and μ-attributable demotions at 200 bb exist (92 over 7 cells) with **none of them a big pair**; **(d)** painted width drifts at most 4.0 points from its 100 bb value across the whole range (I21's allowance; measured 3.16) and never falls below 10 % (I12's floor; measured 12.6 %); **(e)** I7, I8, I9, I13 and I19 all still hold at 40 and 250 bb; **(f)** the positional bases keep their seat order at 40 / 100 / 250 and their spread widens with depth — this is the clause that catches `|β| ≥ 1`, where the exponent goes negative and the seats invert, which nothing else in the pipeline notices. **What it does not assert:** V2-PLAN §3.1's "big-pair rows with pair rank J/T demoted at 200 bb via the μ·cooler term". It is false for the J half and the reason is the same taxonomy split that broke §2.1's five-step cooler ladder — `rowOf` splits pairs at J, the big-pair band's `cooler` is 0.3563 which is *below* the bar, so μ promotes 21 of its 23 cells; its 46 measured demotions are all λ's. The gate reports those figures in its detail line instead. |
| I27 | **I16's continuity, re-run at both ends of the depth slider.** Every VPIP step at 40 bb and at 250 bb changes at most 3 % of combos or at most 5 of 145 cells, and the three deliberate `N_eff = 3.0` discontinuities (raise/HJ @ 45, raise/CO @ 54, raise/BTN @ 70) are at the same VPIP at both depths. No widening was needed: the worst non-cliff step is 0 cells over the allowance at both ends. That last fact is the κ(N) / λ(d) separation as something testable — a field effect does not move when the stacks move. |
| I28 | **I21's painted widening, re-run at both ends of the depth slider.** The painted range is wider at VPIP 90 than at 25 at all 15 (node, position) pairs at 40 bb and at 250 bb. The dip allowance is **widened from I21's 4.0 to 6.5 points**, on a measurement rather than an assumption: I21 sized 4.0 as half the largest single cell, against a worst drawdown of 3.2 points at 100 bb, but at 250 bb the worst event is a simultaneous *three*-cell exchange — `RUN3_DANGLER×SS` (4.79 % of combos) in, `ACE_JUNK×SS` (3.16 %) and `ACE_JUNK×FLAW` (2.29 %) out, net **5.45** points at rfi/BTN VPIP 82. Three cells sits inside I16's own 5-cell allowance and the whole event is smaller than the largest single cell (`TRASH×SS`, 11.4 %), so it is the granularity both I16 and I21 already document, not a trend. At 40 bb the worst dip is 2.1 points, better than at the operating depth. |
| I26 | **The straddle moves the grid the way §3.3 says, and the composition case it flagged is decided by measurement** (§5.3), over 5 RFI seats × 5 VPIP × 6 depths. Asserted: **(a)** the painted **opening** range tightens at every seat and every setting — 150/150 at RFI and 150/150 at the iso node — which is where **V2-PLAN §7.2's "BTN keeps its 0.45 base" is falsified**: pinned, the button paints *wider* at 7 of 30 settings (up to +2.49 points) and its mean ν falls at 8, so `straddle.seatPinned` ships empty; **(b)** the painted range gets nuttier (148/150 at RFI, 150/150 iso, worst fall 0.13 points); **(c)** the composition, isolated at matched width — field-only +0.286 pts with 0 of 150 going the other way, depth-only −0.144 with 76 down, both +0.183 with 20 down: **the field wins**, keeping 64% of its own effect, even though λ(d/2) − λ(d) = −0.189 is 2–6× larger than Δκ = 0.13·cBlind(v) on the ν coefficient. What completes the field's margin is the *measurement* — the multiway realization slope and ρ read further up its N curve; **(e)** I6/I7/I8/I9/I10/I13/I19 all hold straddled at 40/100/250 bb; **(f)** the transform is exactly the transform (N_eff gains `cBlind(v)`, `dEff = clamp(d/2)`, `widthFor` scales by `seatWidthFactor`, and the price does not move at rake 0). **What it does not assert, deliberately:** the vs-Raise node. `w3bet` has no seat base, so measured it goes both ways (47 tighter / 77 looser / 26 unchanged) and the gate reports that instead of pretending otherwise. |
| I29 | **I16's continuity, re-run with the straddle ON** at 40 / 100 / 250 bb (effective 40 / 50 / 125). Every VPIP step changes at most 3% of combos or at most 5 of 145 cells; worst non-cliff step is 0 cells at all three depths, so no widening was needed. The interesting half is the mirror of I27: depth leaves the `N_eff = 3.0` discontinuities exactly where they are, and the **straddle drags every one of them forward** — raise/HJ 45 → 34, raise/CO 54 → 39, raise/BTN 70 → 47 — and adds a fifth at raise/SB 70 that the unstraddled table never reaches. Asserted structurally rather than as a pinned list: `N_eff` is strictly larger straddled at all 990 (node, seat, VPIP) settings, so a crossing of 3.0 can only come earlier. Between them I27 and I29 make the κ(N) / λ(d) separation testable from both sides. |
| I30 | **I21's painted widening, re-run with the straddle ON** at 40 / 100 / 250 bb. Wider at VPIP 90 than at 25 at all 15 (node, position) pairs. **No widening of I21's own 4.0-point dip allowance was needed** — unlike I28's — because a narrower target width has fewer cells straddling the cut: the straddled worst dip is 2.86 points against the 3.16 the unstraddled model runs at. The painted **floor** is its own, at 8% rather than I12's 10%: a straddled UTG opens 8.96% of hands at VPIP 25, which is the seat transform doing its job (the target itself fell 23%) and not the nut-gate collapse I12 guards against. |
| I31 | **The rake does what §3.2's model can do, and is asserted not to do what it cannot** (§5.2). **(a)** The flat haircut on ρ is **tier-inert at the three percentile nodes by construction**: 0 of 27,675 tiers move at the 5% preset, all 27,675 scores do, and every score ratio equals (1 − rakeFrac) to within 2 ulp. Asserted so that turning rake into a non-uniform haircut has to be a deliberate model change. **(b)** Where the threshold is absolute it bites: the vs-3-bet continue range narrows monotonically in `rakePct` on the **action** tier, 45 → 41 cells at UTG and 49 → 44 at CO across 0–6%. **(c)** The arithmetic is exact — `price = breakeven / (1 − r)`, the 7-point premium over it is invariant, `rakeFrac = min(pct, cap / (potBB·unit))`, and a straddle doubles the unit the cap is measured against so the same 3bb cap takes 2.5% instead of 5%. |
| D7 | **The payload ceiling** (a data gate, listed here with its siblings). `model.json` as emitted — the exact minified byte string written to disk — against V2-PLAN §2.5's 220 KB budget: measured **146,551 B = 143.1 KB, 35% headroom**. The ceiling is read on the minified basis because the plan states it in the same sentence as "`model.json` is 105 KB today", which is the minified v1 file, and because the literal pretty-printed reading is unsatisfiable by the plan's own escape hatch (§9.10). The pretty-printed figure, 242.2 KB, is printed in the gate's detail line and recorded, not asserted. D6 carries the tighter per-block budgets that actually catch a creeping payload; D7 is the published contract and is deliberately slack against it. |


I22 is the gate that lets v2 be built at all. The depth axis, the rake slider, the straddle
toggle and the VPIP-filtered villains all enter the scoring layer as multipliers or deltas that
are *the identity* at the operating point above; I22 is the only thing standing between "the new
knob is inert at its default" and "we think it probably is". So the discipline around its
expectation matters as much as the assertion: **nothing in the build writes the fixture.**
`scripts/freeze-tiers.mjs` is the sole writer, it refuses to overwrite without `--force`, and
`--force` prints every tier that is about to move before it moves it. A gate that regenerates its
own expectation asserts nothing, and the fixture carries a content digest so that hand-editing it
into agreement fails loudly instead of quietly.

I20 is the one worth dwelling on. `equity-ref.mjs` is a second equity engine written separately
from the production one, kept in the repo purely to disagree with it. Two independent
implementations agreeing on a number is much stronger evidence than either one agreeing with
itself at a higher trial count.
