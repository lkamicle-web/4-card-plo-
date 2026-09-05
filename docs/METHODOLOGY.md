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
against *N* random opponents for N = 1..7, derive two numbers (raw strength, and how well the
hand *scales* into multiway pots), combine them with a documented scoring formula, and cut the
result at percentile thresholds that vary with position, action and table looseness. Every
constant in the formula is listed in the README and every one is a judgement call. The model's
job is to make the *shape* of good PLO preflop reasoning legible and explorable, not to be an
oracle. The Monte Carlo layer is objective; the scoring layer is opinion.

**One sentence above needs its scope written down rather than implied, because v3 changed what is
in the file.** Since P3 the model carries a solved object: an exact CFR+ fixed point of a
**heads-up** five-node preflop tree, solved over a checkdown payoff, shipped as quantized baseline
tiers and painted by the vs-GTO colour mode (invariant **I36** in §11 is what is asserted about it;
limitation 19 is what it is not). Three things keep "not a GTO solver" true anyway, and each is
gated rather than promised: the label is **GTO only where the game is heads-up** — nothing multiway
may wear that word, and the payload derives its own label from its own seat list so it cannot
acquire one by omission; the payoff behind it is a **checkdown**, which the block states on its
face, so it is an equilibrium of a game in which the flop never comes; and it **cuts no tiers** — vs-GTO is a colour mode laid over
the same percentile surface, and I22, I32 and `data/tiers-v3-default.fixture.txt` all still
reproduce byte-for-byte with the baseline shipped, while the EV surface beside it is held
display-only by gate **I34**'s quarantine for as long as limitation 18 stands. One solved heads-up
tree, beside a heuristic that does all of the deciding, is the whole of it.

**The claim each artifact makes — and the two artifacts do not make the same one.** v3 ships two
builds from one source (§9.11): `index.html`, the lite artifact, and `index-full.html`, the full
one. They differ by exactly one payload, so they are owed exactly one sentence each, and these are
the two:

> **`index.html`** — a self-contained offline page: the measured model, the scored grid, and the
> equilibrium baseline as quantized tiers with none of the strategies they came from
>
> **`index-full.html`** — a self-contained offline page: the measured model, the scored grid, the
> same quantized baseline tiers, and in data/equilibrium.json the solved strategies behind them

Each page carries its own sentence **twice** — in the provenance banner at the top of the file, and
on screen in Method → *What this is* — and carries none of the other's. That is not proof-read, it
is **grep-gated**: `scripts/lib/variant.mjs` holds the two strings, gate **D11** clause (b) requires
each artifact to contain its own, clause (f) requires the on-screen copy to exist outside the
banner, and clause (e) byte-compares both against the two quoted here — so this document cannot
drift from the pages it describes. The named failure mode is the one a copy-paste between two
shells produces: one artifact wearing the other's claim. The page cannot read this from
`model.json`, because `model.json` is the **shared** artifact and is injected byte-identically into
both; the sentence rides the variant seam instead, which is the only per-variant channel the build
has.

**And the opinion has never been checked against money.** v3 pre-registered the test that would
check it — does ordering hands by EV win more than ordering them by this score — wrote the criteria
before any EV number existed, built the harness, and then could not run it: no lawful, hero-visible,
assigned 4-card PLO corpus exists at any volume. The verdict ships **hard-failing** in
`model.calibration`, gate **I46** is green over that FAIL rather than over a pass, and the Method
view renders every row of the bar. Limitation 18 in §10 is the full record. Read the rest of this
document with that in front of it: everything from §5 on is a defensible opinion, and defensible is
not the same as *verified*.

The split matters and is worth restating in operational terms:

| Layer | Status | How to attack it |
|---|---|---|
| 5-card evaluator, Omaha 2-of-4 rule, RNG | Objective, gated by exact combinatorial counts | Run `node --test test/`; V5 asserts the nine exact C(52,5) category counts |
| Equity measurement (`eq[1..7]`, `vDelta`, `eqVs3bet`) | Objective up to Monte Carlo error (±0.16 pt/cell) | Re-run with a different seed; cross-check against `equity-ref.mjs`; or press **Simulate** and let the page re-measure it in front of you (§9.12) |
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

### 2.4 The sub-bucket depth layer — REMOVED

Earlier builds carried a second, finer key
(`pairStructure | suitPattern | connectivity | highCardQuality`) assigned to every hand in the
*same* enumeration pass, giving **341 non-empty sub-buckets** across the 123 non-empty cells
(mean 2.77). Each carried its own `mplay` and `cooler`, and an expand-in-place UI priced each one
*as-if standalone* against the cuts the grid was already painting.

**It has been cut.** The layer was the largest single block in `model.json` (69.5 KB of 187 KB),
and it bought a rung of resolution that could not be acted on: the buckets were deliberately never
re-cut into the percentile sort — inserting them would have moved every other cell's tier — so a
bucket verdict was always a hypothetical about a grid that was not being painted, and the panel had
to say so in as many words on every row. At the vs-3-bet node it could not say anything at all,
because that node cuts on `eqVs3bet`, which is measured per cell against a face-up mix and which
the sub layer never carried. **The cell is now the finest unit this model resolves**, and the
things that used to be said about buckets are said about cells or not at all.

What went with it: the `sub` block in `model.json`; the S4 generator stage; `subKeyOf`, `subLabel`,
`suitSub` and the three rank-only key fields in the classifier; `subVerdicts`, `asIfStandalone`,
`freqAtScore` and `expandReducer` in the policy; the expand panel, its keyboard navigation and its
URL parameter; the Simulate engine's stage 2 and the partial-run path that existed to serve it; and
gates **D3** and **I17**, which asserted the dual-key partition and the geometric-mean
reconstruction of a cell's `mplay` from its buckets'. Gate **D1** still pins
`Σ cells === 270,725`, which is what is left of the partition claim. The payload fell to
**118 KB**; gate D6's ceiling came down with it, because a removal that does not move the ceiling
has not really been paid back.

One consequence is recorded rather than glossed: the Simulate engine's cached-payload validator
used the buckets' combo-weighted mean to reconstruct the cell equity, and that partition identity
was the strongest check it had. There is no honest replacement for it at the cell layer — there is
nothing left to reconstruct a cell *from* — so what remains is shape and plausibility at every
index. **§9.12 sets out what that validation stopped buying**, including the fabrication it now
accepts. *(This pointed at "§12.4" until v3 P1. There is no §12 in this document and there never
was: the reference was to a section of an earlier draft, and it survived the sub-bucket cut by
pointing at nothing.)*

**v3 P5 — sub-cell resolution came back, and the two sentences above are what it was built around.**
V3-PLAN §4's item 10 asks for sub-cell resolution "done differently from v2's cut sub-buckets", and
the difference is the whole design: the **top-N list makes an ORDERING claim inside one cell and
never a verdict about a hand**. It carries no second key, no `mplay`, no `cooler` and no bytes — the
rungs are enumerated in the browser from the taxonomy the page already has — so neither of this
section's two reasons for the cut applies to it. §8 describes what it shows.

**The reason for never re-cutting sub-cell rows into the percentile sort is now a MEASUREMENT rather
than this paragraph.** The sentence above — "inserting them would have moved every other cell's
tier" — was written by people who correctly declined to do it and therefore never found out what it
would have cost. Gate **I47** clause (c) now does the insertion, in the gate and never on the page,
on every run: over 45 percentile seats it puts the 467 `adjRaw` rungs into the sort as rows and
measures the damage. **52 cells cross the aggressive line** for no reason except that non-cell rows
were inserted below them, and **368 more are SPLIT** — rungs on both sides of the new cut, which is
to say cells that no longer have a tier at all. That second number is this section's "a hypothetical
about a grid that was not being painted", stated as a count. The gate FAILS if either number ever
comes back zero, because a citation that has stopped describing the model should be re-argued rather
than re-quoted.

**One identity comes back, and it is structural where the lost one was measured.** D3/I17 asserted
that a cell's *`mplay`* reconstructed from its buckets', and this section records that there is "no
honest replacement for it at the cell layer". That is still true of anything measured. The rung
table's own identity is not measured: Σ of a cell's rung combos **is** its shipped `combos`, and the
combo-weighted mean of its rungs **is** its shipped `adjMean` at the emitter's precision, over all
123 cells. I47 clause (a) asserts both, on the block sliced out of the shipped shell — so if the
page's classifier and the emitter's ever disagree about which cell a hand belongs to, the page
withholds the list rather than printing a partition that does not partition.

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
- Emitted per cell to 3 dp. The reference field size, the category floor and the
  chop rule all ship as named constants in `constants.cooler`.

This is the measured content of "tens and jacks are the low end of top set", and it is what a
stack-depth axis has to be anchored on: at 100bb a cooler costs a bet, at 250bb it costs a stack.
Measured range across the 123 non-empty cells: **0.257** (`AA_BROADWAY × DS`) to **0.501**
(`TRIPS_SMALL × RB`), combo-weighted pool mean **0.3953**.

Two orderings the data confirms:

| Claim | Measured |
|---|---|
| coolers fall as the pair rank rises | small pairs **0.4386** → big pairs (J+) **0.3563** → AA rows **0.3184**, combo-weighted |
| `cooler(SSA) < cooler(SS)` in the same row — your flushes are the nut ones | holds in **18 of 18** rows that have both, by 0.003 to 0.073 |

One thing the ladder claim cannot be stated more finely than that: the 29-row cascade splits pairs
at J (`rowOf`: `big = p >= 11`), so **TT, JJ, QQ and KK are not separable**. The plan's TT > JJ > QQ > KK
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
justification. **The page exposes it as an editor**, on the same reasoning as the 3-bet mix — it is
a pool knob and a reader should be able to argue with it — but unlike the mix it cannot be blended
exactly, because the lattice was measured at one value of it. Any `q ≠ 0.85` is off the measured
data entirely: the page shows the random-villain baseline, says there is no shipped answer, and
offers the Simulate button (§9.12), which measures that setting for real.

**The ordering itself ships.** Because the button re-cuts the pool at VPIPs the generator never
measured, the eq1 permutation of the 16,432 classes is emitted into `model.json` rather than
re-derived in the browser — a second eq1 run would order classes near the cut differently, and the
page would then be measuring a different pool from the one this lattice was measured against. Gate
**D8** pins it; §9.12 has the format, the index space and the regeneration proof.

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
the V1/I5 and V2/V3/I4 blocks in `scripts/gates/engine.mjs`, so it cannot be lost to a refactor that
"generalises" the conservation check over whatever equity arrays it can find. (Those blocks lived in
`scripts/verify.mjs` until the gate-registry split moved them; the scope note moved with them, into
that file's header, which is the outcome this sentence was written to demand.) And the exemption is
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

#### Reaching the tiers — the shadow model

*(v3 P1, item 8. The machinery, not the default: the profile is still OFF at load.)*

The lattice was measured and shipped in v2, and the tiers were still cut from **random-opponent**
equities. That is the open half of limitation 1, and the reason it stayed open is structural rather
than lazy: `villainEq` answers *one cell at a time*, while the scoring pipeline wants a *model*.
`scripts/lib/tier-fixture-v2.mjs` names the gap exactly — "the villain profile reaches tiers through
`villainEq`, which the page calls and `solve` does not". The profile reached the grid through a path
in `src/shell.html` that no gate could see.

`policy.mjs` now carries that construction as **`profiledModel(model, profile)`**: the same object
graph with a profiled `cells` map, which `solve` can be handed in place of the shipped model. The
page's copy *was* a duplicate of this one, not a variant of it, and at the **P2 pre-stage it was
deleted**: `src/shell.html`'s `emodel()` now calls `profiledModel`, so one construction exists in the
repository and every property below is asserted where the code that has them lives. Three properties
are load-bearing and gate **I43** asserts each:

1. **OFF is object identity.** With the profile off, `profiledModel` returns *the model itself* —
   the same object, not an equal copy — because `villainEq` hands back `cell.eq`/`cell.rho` by
   reference for exactly this purpose. I43 checks it with `assert.equal`, never `deepEqual`: a
   deep-equal copy passes a value check and is still a different object under the solve memo, which
   is the failure mode rather than the symptom. An off-lattice `q` is also the model itself — the
   accessor refuses to interpolate an axis with one measurement on it, so the profile is on and
   nothing has moved, and the honest representation of that is the model.
2. **The shadow wears its own `meta.hash` prefix.** `solve` and `aggressiveSet` key their memos on
   the first eight characters of it, so a shadow wearing the real hash would be handed the
   *unprofiled* answer straight out of the cache — a silent wrong number, the failure `envKey`
   exists to prevent one layer down. I43 verifies it by interleaving profiled and unprofiled solves,
   which is what catches a memo that was warm from the other model.
3. **The load default lands on a lattice point.** `villainLoadDefault` reads v and q out of the
   *data* — the lattice's own centre point and the shipped discipline, v = 55 and q = 0.85 — so at
   load **all 123 live cells are cut from a measured row and none is labelled `interpolated`**. A
   default half a lattice step away would open the page on 123 interpolated numbers under a
   measured-looking grid.

`profiledModel` also keeps a **bounded per-profile book** of the shadows it has built, so a caller
sweeping the villain axis gets the same object back on a revisit instead of an equal rebuild — the
page's slider, `tier-fixture-v3`'s per-VPIP loop and I43's per-lattice-point loop all wanted one and
each had been hand-rolling its own. It is keyed by the model object through a `WeakMap` (a gate that
loads two models must not be handed the other one's shadow) and by the profile's measurement
identity (a fresh Simulate result must not be served a stale shadow), capped at 24 entries in
`SIMBOOK`'s idiom, and it is a *cache size* rather than a model constant: it cannot move a number,
only how often one is recomputed. What it is worth is small and is stated in §3.4, because the cost
the flip exposed was somewhere else.

I6, I7, I8, I9, I13 and I19 are re-run under the profile at every lattice point and all hold.
**V3-PLAN §7.2 predicted I8 would fail** — `TRASH × RB` reaching T1/T2 against a tight pool, on the
strength of the table above showing trash *gaining* — and **it does not**. Trash gains, and it does
not gain *enough*: a delta shared across a band moves scores and not ranks, and the cut is a
percentile. That is limitation 17's structural fact arriving from the other direction, and it is
worth more than the prediction would have been.

**The library default is still OFF, and that is what makes the flip below safe.**
`villainProfileOf` reads anything without `on: true` as OFF, every caller in this repository still
passes nothing, and `solve` has never received a profile argument. So the *legacy state* means
exactly what it always meant, and gates I22 and I32 keep asserting it. What changed at B1 is which
state the page opens in.

### 3.4 The B1 default flip — what turning the profile on actually moves

*(v3 P1, barrier B1. V3-PLAN §5.1's third-fixture ceremony; §0.4(c)'s move-diff, committed.)*

**The page now loads with the villain profile ON.** `src/shell.html` reads
`POLICY.villainLoadDefault(MODEL)` at boot instead of hard-coding a value, and opens on it — which
means the load state is derived from the shipped lattice rather than typed into the page. It
declines itself on a dataset where the page's own VPIP default is not the lattice point the load
default names, because opening on interpolated numbers under a measured-looking grid is the one
outcome limitation 1's partial closure must not produce. On the shipped data they coincide at
v = 55, so all 123 live cells load from a measured row (gate I43(b)).

**A default flip changes the page's initial state and no state's semantics.** That distinction is
the whole reason this is safe to do mid-program, and it is asserted rather than argued: I43(e)
pins the library default OFF, I43(a) pins OFF as *object identity*, and I22/I32 are green on the
other side of the flip — the legacy lane is still there, still reproducing v1 and v2 bit for bit.
The `#v1point` button clears the profile along with depth, rake and straddle, so the identity point
remains one click away. Permalinks changed with the default: `&vp` is now written in **both**
directions, since a present-means-on encoding would have silently dropped "I turned the villains
off" out of every shared link.

**The third fixture.** `data/tiers-v3-default.fixture.txt` freezes the ON surface over the same 12
environment lanes, the same 21 legal (node, position) pairs and the same 66 integer VPIPs as the v2
fixture — 16,632 settings × 123 cells — **alongside, not replacing, it**. On this page the villain
VPIP *is* the table VPIP slider, so each row is frozen at the profile the page is actually running
at that row's VPIP: measured at the lattice points, interpolated between them, and frozen either
way, because the user reaches the in-between with one drag. No lane of it is the v1 operating point
and it declares none. It carries no gate id — V3-PLAN §7.2 reserves ids at Phase 0 and names none
for it — so it is pinned under `node --test` (`test/tier-fixture-v3.test.mjs`), which is one of the
three GREEN checks; the test is proved to fail on a single flipped tier character.

**The move diff, printed by `freeze-tiers.mjs --v3` and committed here.** Between the two frozen
files, no pipeline in the middle:

| | |
|---|---|
| settings that move | **15,048 / 16,632** (90.5 %) |
| cell tiers that move | **285,708 / 2,045,736** (**13.97 %**) |
| net change in painted (T1/T2) slots | **−17,382** (−2.00 %) |
| lane that moves most / least | `d40/r0/s1` (26,576) / `d250/r5/s0` (20,058) |
| by VPIP, at v = 25 / 40 / 55 / 70 / 90 | 6,582 / 5,516 / 4,696 / 3,542 / **1,610** |
| top rank moves | T1→T5 60,792 · T5→T1 33,744 · T5→T3 18,748 · T2→T1 16,532 · T1→T2 16,460 |
| rows that move most | `RUN0_HIGH` 43,450 · `RUN0_LOW` 42,330 · `BROADWAY_RUN` 38,674 · `SMPAIR_CONN` 20,732 |
| at the exact load state (`d100/r5/s0`, rfi/CO, v = 55) | **24 of 123 cells** |

Three things in that table are worth saying out loud, because each of them is a claim the diff
either supports or refuses.

1. **It is a re-sort, not a tightening.** The net is only −2.00 % of painted slots, and 33,744 cells
   move *up* to T1 against 60,792 moving down to fold. A filtered field is not uniformly worse to
   play against; it is differently ordered, which is the same thing §3.3's cooler/nut table says
   one measurement at a time.
2. **The size of the move tracks how filtered the field is,** monotonically: 6,582 moved tiers at
   VPIP 25 down to 1,610 at VPIP 90. At 90 % VPIP the filtered pool nearly *is* random, so the flip
   nearly does nothing — which is the sanity check that says the mechanism is doing what it claims
   rather than adding noise.
3. **The rundowns and the broadway run move most.** They are the rank-overlap rows: exactly the
   hands whose value depends on what everybody else is holding, and therefore the hands a range
   assumption should move. If `AA_BIGPAIR` had topped this list, something would be wrong.

**14 % of the surface is a large move, and it is a change of default rather than a change of
model.** Nothing was re-measured and no constant moved; the page simply stops answering "what is
this hand worth against random opponents" by default and starts answering "against opponents who
play the VPIP you set". Both answers were already in the shipped data. What the ceremony records is
that we changed which one the page volunteers.

**What it cost, and what that cost turned out to be.** *(v3, P2 pre-stage.)* The flip made
`smoke.mjs`'s slider-morph budget red on the artifact — p95 12.1–16.3 ms against 4.0 — and the
diagnosis on record was wrong, so it is worth stating what it actually was. The ribbon is
**profile-dependent**: the page's `curveKey` carries the profile key, and on this page the villain's
v *is* the table VPIP slider, so with the profile on every slider step asks for a curve the page has
not got and re-solves all **66 VPIP points, 70 `solve` calls a step**. With the profile off the
profile key is a constant, `curveKey` never mentions the slider at all, and the same sweep is free —
which is the entire ON/OFF gap. It was not the shadow model: building one measures 0.1–0.9 ms.
Two one-entry memos turned a per-step cost into a permanent one and both are now bounded books —
the shadow model's inside `profiledModel` (§3.3), the curve's in the page — so revisiting a VPIP
costs **1.2 ms** where it used to cost 10.7. **The first visit to each VPIP did not move and could
not**: caching cannot make a first answer cheaper, and those 66 solves are work the profile
genuinely asks for. The budget is therefore **split rather than widened** — the 4.0 ms row keeps
S-E's anchor and smoke now drives the page into the OFF state through its own toggle to measure what
that number was measured on, and a second row is pinned at **16 ms** on the shipping default (worst
observed p95 10.80 + ~48 % = 15.98, the byte budgets' rule). Neither row is the other with slack.

---

### 3.5 The pool-skill axis — the fold-more half, and the half that is not built

*(v3 P4. V3-PLAN §3.4 and §6; gates I38 and I37. `constants.skill`, `poolVpip`, `poolAt`.)*

The brief's item 5 asks for one dial with two halves: **a tougher pool folds more preflop (shifting
the villain lattice) and plays better postflop (cutting realization).** RUNDOWN ships the first half
and **does not ship the second**, and the reason is not an oversight — it is the pre-written
consequence of a Phase-0 measurement, so it is stated here rather than discovered later.

**What the dial is.** `skill ∈ [0, 1]`, a field on the villain profile, `0` at the lobby. It
resolves through `poolVpip(v, s)` to a single number: the VPIP the pool plays.

```
poolVpip(v, s) = v                                 at s = 0   (v itself, by early return)
               = v + s * (vFloor - v)              in between
               = vFloor                            at s = 1   (the constant itself)
```

`vFloor` is **25 — `constants.villainLattice.v[0]`, re-described.** That is the anchor and it is an
identity rather than a choice: 25 is the tightest pool the lattice was ever *measured* at, so a dial
reaching past it would be asking the equity accessor a question no trial ever answered. Gate I38(b)
asserts `skill.vFloor === villainLattice.v[0]` on every run.

**It is a coordinate change on the VPIP axis and it adds no pathway — which is what "no new opinion"
means here.** The pool at `(v = 55, skill = 1)` and the pool at `(v = 25, skill = 0)` are the same
pool, and the code makes them literally the same object: `villainProfileOf` resolves the dial once,
`villainKey` therefore keys on the resolved VPIP, `profiledModel` hands back the identical shadow,
and `solve` hands back the identical result. Gate I38(c) asserts that over 336 solves, with a
half-applied dial armed as the case that must separate. Three consequences follow for free:

* **The lobby endpoint is the current model by construction**, not by a zero that happens to cancel.
* **The axis cannot reach the legacy lane.** Its whole mechanism is the lattice, so with the villain
  profile OFF it is inert whatever a caller passes — I22 and I32 cannot see it.
* **It cannot alias in a memo**, because there is no second key to forget.

**Direction, and what it does to the grid.** Skill up ⇒ the pool folds more ⇒ `v` falls ⇒ hero
tightens with it, because `widthFor` is increasing in `v` and `N_eff` falls with it. Measured over
the 21 legal (position, node) pairs, combo-weighted painted width runs **16.12 % → 15.79 % → 15.30 %
→ 14.76 % → 13.76 %** as the dial rises from the lobby, monotone at every step.

**The exceptions are enumerated, not allowed for** (gate I38(d), records in
`scripts/lib/skill.mjs`, compared in both directions every run). Six of the twenty-one pairs get
*wider* end to end, and they are exactly the six **vs-3-Bet** pairs, every one of them through the
same two cells — `BROADWAY_RUN|DS` and `BROADWAY_RUN|SSA` moving `T3 → T2`. At that node T2 is
**AMBUSH CALL**, so those cells move from CALL to CALL: what moved is a tier *label*, not a hand, and
`solve`'s `width` counts T1+T2 as aggressive mass and therefore measures the label. Eleven
(pair, step) interior rises are recorded beside them — the same six relabels, plus five nut-gate
releases where `N_eff` falls below `nutGate[2]` and a block of cells stops being demoted.

#### The plays-better half is not built, and its coefficient reaches exactly nothing

`constants.skill.playsBetter` **ships `null`.** Not a small number, not a default: no number.

The reason is a measurement. Phase 0's spike S-B graded **C** (best held-out p95 7.21 against a 5.0
band edge), so v3 ships no fitted postflop payoff — the shipped stub is a checkdown and is blind to
SPR. The plays-better half is defined as a cut through that layer, and there is no layer to cut
through. Underneath that, the standing hole is **limitation 16**: the measurement layer is all-in
equity at showdown, so nothing in this repository measures postflop play at all, and a coefficient
for "how much more equity a better pool realizes" could not be anchored even if the layer existed.

So the honest shipping shape is the one V3-PLAN §6 specifies — flagged, and **bounded by a gate on
its REACH rather than on its size**, since a size bound on a number that does not exist is
decoration. Gate I38(e) asserts three things every run:

1. `playsBetter` is `null` — no number was invented;
2. eight shipped files, comment- **and string-literal**-stripped, name it exactly where the
   declaration is and nowhere else (the flag names it, and that admission is a string, which is why
   the literals come out before the count);
3. over **9,225** per-cell readings taken along the whole dial, the realization the pipeline uses is
   bit-identical to the dial-blind `realization(pos, N, ν, d)`.

The day somebody wires a realization cut to this dial and picks a coefficient because one was
needed, (2) and (3) fire. That is the whole of what "unexercised" is worth as a claim.

#### The interior is `interpolated`, and the badge is the accessor's own

The endpoints are anchored — the pool as set at one end, the lattice's measured floor at the other.
**The path between them is not.** Nothing here measures a pool-skill scale, so no measurement says a
pool "half way to the floor" folds half the difference rather than a third or two thirds. Linear is
the form the two endpoints determine on their own; it ships **flagged** in `constants.skill.flag`,
**badged** `estimate` in the Method view, and **bounded** by gate I37's monotone-interpolation
clause, which recomputes it from the sentence `constants.skill.blend` publishes.

The per-cell label needs no new machinery, and that is the neatest part of the axis: at the load
default the three detents land on VPIP **55 / 40 / 25**, all three shipped lattice rows, so
`villainEq` reports `lattice`; the two midpoints land on **47.5** and **32.5**, off-lattice, so the
same accessor reports `interpolated` — the badge §6 asks for, emitted by the code that has always
emitted it.

#### What the dial cannot reach, and why that is recorded rather than passed

V3-PLAN §6 names two anchored endpoints for this axis: *"measured lattice at one end, solver baseline
at the other."* **Only the lattice end is reachable, and the measurement is worth stating plainly.**

The P3 baseline is **heads-up with the SB on the button**, and that SB **opens 88.85 % of combos**.
That is 33.85 points **looser** than the lobby's 55, so the setting "pool = baseline" lies on the
*loosen* side of the axis — the plays-better side, which Grade C does not build. Underneath the
arithmetic is a seat mismatch rather than a dial-range accident: the baseline's SB is the button and
plays in position, while the model's SB is a six-max small blind out of position (`baseR.SB` = 0.90,
the worst realization in the table). No setting of a pool dial brings a 33.6 % opening range onto an
88.9 % one.

So §7.2's *"signed vs-GTO divergence combo-weighted ≈ 0 at pool = baseline"* is **NOT MEASURABLE on
this payload, and gate I37(a) records it rather than passing it** — the I15 / I36-nesting precedent,
a clause scoped to what was measured and never toleranced into a pass. The detector is armed on the
shipped entry frequency and **fails** the day a baseline lands at or below the lobby, at which point
the clause is owed a measurement instead of this paragraph.

**Measured beside it, because unmeasurable is not a reason to publish nothing.** The signed
combo-weighted divergence along the dial, at the three (position, node) pairs the HU baseline covers:

| node | s = 0 (v 55) | 0.25 (47.5) | 0.5 (40) | 0.75 (32.5) | 1 (v 25) |
|---|---|---|---|---|---|
| `SB` × RFI | −1.095 | −1.099 | −1.116 | −1.167 | **−1.199** |
| `BB` × vs-Raise | −0.708 | −0.753 | −0.780 | −0.813 | **−0.852** |
| `SB` × vs-3-Bet | −0.917 | −0.917 | −0.917 | −0.917 | −0.917 |

Negative throughout — **the model is tighter than the HU equilibrium at every covered cell and every
setting** — and *growing* at two of the three nodes. **So "monotone exploit → equilibrium convergence
per cell", which V3-PLAN §3.4 offered for falsification, is falsified in the aggregate as well as per
cell.** The vs-3-Bet row is flat to the last digit because that node's only movement is the
T3 → T2 relabel above, and CALL and AMBUSH CALL are the same action on the baseline's scale.

**Per cell, §7.2's prediction lands.** Its wording is that *the rank-overlap rows — `BROADWAY_RUN`,
`RUN0_HIGH` — violate monotone convergence and move most as the pool tightens, not the junk rows.*
Measured: **29 of 369 readings violate**, and by rate the leaders are **`BROADWAY_RUN` 8 of 15** and
**`RUN0_HIGH` 3 of 12**, with the junk row **`TRASH` 1 of 12**, eighth. The set is a frozen record in
`scripts/lib/skill.mjs` and the *ordering* is asserted, not quoted — gate I37(d) fails if the two
named rows stop leading. This is I25's lesson transposed one more time: what a tightening pool moves
is the hands whose value is rank overlap, not the hands with no value at all.

**The control landed after the mechanism, which is the point of having shipped it without one.** At
P4 the axis shipped as a library axis with its constants rendered and gated, exactly as the 3-bet
sizing axis did at P1, on the reasoning that the first control to land should not also be the place
the model gets designed. The P4 UI step is that control, and because the mechanism was already
frozen and gated it is a *slider over an existing axis* rather than a new decision:

- **It is in the Villain profile section of the rail, under the toggle and above discipline `q`** —
  the coarser question first: `q` is how often a villain is drawn from the filtered range, the dial
  is how tight that range is at all. It is hidden with the rest of the profile's controls when the
  profile is off, which is the honest disablement rather than an invented one: with no filtered
  field there is no pool to re-describe.
- **It is live in BOTH artifacts.** Its whole mechanism is the shipped v-lattice, which is in
  `model.json`, which both builds inject verbatim. There is nothing full-only about it, so it is not
  given a variant split it does not have.
- **The page distinguishes the TABLE VPIP from the POOL VPIP, and every villain-side reading is
  quoted in the pool's.** `S.v` is the table — what sets `N_eff`, what the big slider is about.
  `poolV()` is `POLICY.poolVpip(S.v, S.skill)`, the VPIP the pool plays, and it is what the lattice
  bracket, the sim book key, the trial request and every provenance sentence now read. Quoting the
  table VPIP on a provenance line while scoring against the pool VPIP would be a silent wrong
  number of exactly the shape this repository keeps finding in memo keys, so it is one function and
  not ten in-place expressions. At skill 0 it returns `S.v` and every one of those readings is the
  string it was.
- **The status line prints the accessor's own badge, not the dial's.** `POLICY.latticeBracket` at
  the resolved pool VPIP decides `lattice` versus `interpolated`, which is what gate I37(c) reads:
  at a detent every cell is cut from a measured row, at an interior setting none is. The line also
  states what the dial did **not** do — *folds more, plays no better* — because I38(e) bounds the
  plays-better half's reach at exactly zero and a control that let a reader infer otherwise would be
  the page acquiring a claim the measurement does not support. The harness hook deliberately does
  not surface `playsBetter` at all; I38(e)'s file scan refused the line that did.

#### What the P4 red team refuted here, and what replaced it

*(`docs/refutations/P4.md`. Three refuters, sixty memos over the phase; three of this section's
claims came back majority-unanchored and one of them came back refuted outright.)*

**The dial's DOMAIN was the refuted one.** `min: 0, ref: 0, max: 1` shipped as *anchored by
construction* — the story being that `poolVpip`'s two early returns are what make the endpoints
exact. Three refuters of three took that apart with the whole GREEN triple intact:

* `min = -1` ships **60/60 gates, the full suite and both variants current**, and it resolves the
  load default to **VPIP 85** — the dial running *backwards*, up the lattice, onto the plays-better
  side V3-PLAN §3.6's Grade C does not build. `wireVP` copies `SKILL.min` onto the page's own
  slider, so it is a setting a reader can select rather than an argument about the library.
* `max = 2` and `ref = 0.05` ship green too — the first leaving half the dial past the measured
  floor, the second putting a *loosening step* between two adjacent stops of the 0.01 slider.
* the construction story is vacuous: **both early returns are removable with everything green.**
  `v + 0·(f − v)` is `v` for every finite `v`, and `v + 1·(25 − v)` is exactly 25 for every double
  in [25, 90] — checked over three million draws. They remain, for the
  `sizingPrice`/`depthWidthFactor`/`interpolateDelta` discipline, but they are no longer offered as
  the reason the numbers are what they are.

**No replacement anchor was invented — §6's flagged idiom was applied instead, and a bound was
written.** The domain is now a third record in `constants.skill.flag`, badged `estimate` in the
Method view beside `blend` and `playsBetter`, and bounded by **I38(g)**, which asserts that the
triple is *forced* rather than chosen: the published blend returns the pool itself only at `ref` and
the floor only at `max`, so those two are pinned between the blend and the measured floor, `min` is
pinned by the dial's own direction, and a sweep at the page's own slider step confirms over 909
settings that the dial never moves a pool up, never reaches the floor before `max`, and is monotone
throughout. **A bound is not an anchor**, which is why the badge stays: `max = 1` is a unit
convention normalised against a blend that is itself unanchorable.

**The flag paid for that record itself.** `constants.skill` is D6's 1 KB block and the admission is
nearly all of it, so the domain's sentence was bought by trimming the flag rather than by raising a
ceiling. What left is the sentence about the unreachable solver baseline — not one of the flagged
records, and still carried by I37(a)'s report line, `reachReadiness`'s docstring and this section.

**The blend's LINEARITY was bounded as a sample and is now bounded as a shape.** Three refuters
independently shipped a curved dial — `v + (s + 0.05·sin(4πs))·(vFloor − v)`, published truthfully
in all three places the gate compares — that is monotone, exact at every setting I37(b) sampled, and
**60/60 green**, while moving the resolved pool by up to **2.3 VPIP points** at settings the slider
can select. The flag's own sentence, *"the path between them is linear"*, was true of the code and
invisible to the gate. I37(b) now asserts the **second difference is zero** at the page's own step,
which is what "linear" means when it is checked rather than said.

**Two findings were recorded rather than repaired**, because both are the standing limitation of an
idiom rather than a defect in this axis: the flag's *content* is bounded by a length and two
substrings, so a flag that denied everything it admits would ship; and `detents` is asserted in one
direction only, so a shipped stop must land on a measured row but a missing stop is not noticed. The
second is now partly protected from the side, since I38(g) pins the domain the enumeration runs over.

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

**The clamp.** `N_eff` is clamped to [1, 7] for equity interpolation. v1 clamped at 5 and the iso
node crossed it routinely (5.92 at VPIP 90); v2 measured the equity table out to seven villains, so
the clamp now sits above almost everything the field model produces and the readout is the raw
number. Where the clamp still bites — the reachable case is a high-VPIP isolation spot with three
or four limpers, more easily with the straddle on, since the straddler joins `N_eff` at `c_blind(v)`
— the number is scored at 7, the equity is read off the end of the measured curve, and the readout
carries an `EXTRAPOLATED` badge whose tooltip names the raw value. Method → Known weaknesses counts
every setting that reaches it. This is a real limitation (§10.5), surfaced rather than smoothed.

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
| Painted width: bounded drift across the full *d* range | **Survived.** Worst drift **3.164835** points from the 100 bb width (`rfi/BTN` at VPIP 70: 46.5 % at 40–60 bb against 49.6 % from 100 up — one cell crossing the cut), against a **3.65**-point allowance. The painted range never collapses either: narrowest **12.612060 %** at any depth (`rfi/UTG` at VPIP 25, 40 bb), against a **10.70 %** floor. **Both allowances were re-pinned at P5** (§11.1): they were I21's 4.0 and I12's 10 %, borrowed from two gates that sweep at the reference depth and never divided by *this* clause's own measurement. They are now that measurement ± 15 %, and both re-pins tighten. |

Attribution is computed, not asserted: for each demoted cell the two halves of `M_deep` are
evaluated separately at 200 bb, and a demotion is called μ-attributable only when the cooler half is
negative *and* larger in magnitude than the ν half.

**Scale.** Across the whole 40 → 250 bb span at VPIP 55, the depth dial moves **205** cell-tiers over
the 21 legal (node, position) pairs. The VPIP dial across its whole 25 → 90 span moves **241** over
the same pairs. Depth is deliberately the slightly quieter of the two: VPIP is the product's
headline axis, and depth is a re-sort on top of it.

#### What kind of re-sort — the dial is a *cooler* re-sort, not a nut-potential one

*(v3 P1, item 7. This section used to describe the dial as a nut-potential re-sort. It is not one,
and the correction is the point.)*

The v3 audit measured the thing this document had only asserted. Over the whole depth sweep, rank
movement from 40 bb to 250 bb correlates **+0.18 with ν** and **−0.42 with `cooler`** — nearly two
and a half times as strongly, and with the *cooler* sign. `BROADWAY_RUN × RB` climbs 12 places at
CO RFI (7–12 at every one of the 75 settings, mean 10.5) on a
ν of 0.37, which is *below* `nuBar`, so λ is pushing it **down** the whole way; the climb is bought
entirely by a cooler of 0.30. **What the slider mostly does is re-sort by what a hand loses, not by
what it wins.**

That is a real disagreement between the prose and the numbers, and there were exactly two honest
ways out: re-weight λ and μ until ν dominates, or re-describe the dial. The rule for choosing was
written down before the measurement was taken (V3-PLAN §3.1) — **re-weight only if a re-weighting
keeps I23(a)–(c) green while making corr(rank move, ν) dominant** — and it was then run:

| λ | μ | corr(ν) | corr(`cooler`) | ν dominant? | I23(a) | I23(b) | I23(c) | `RUN0_LOW` worse / better |
|---|---|---|---|---|---|---|---|---|
| **0.25** | **0.60** | +0.1770 | −0.4162 | no | pass | pass | **pass** | **49 / 9** |
| 0.25 | 0.30 | +0.2663 | −0.2099 | yes | pass | pass | **FAIL** | 0 / 73 |
| 0.25 | 0.15 | +0.3017 | −0.0564 | yes | pass | pass | **FAIL** | 0 / 75 |
| 0.50 | 0.60 | +0.3124 | −0.2563 | yes | pass | pass | **FAIL** | 0 / 70 |
| 0.60 | 0.20 | +0.3706 | −0.0143 | yes | pass | pass | **FAIL** | 0 / 75 |

*(All five rows on I23(g)'s own basis — 9,225 cell-settings, the three percentile nodes over the
six-depth grid — so the shipped row is the number the gate prints on every run rather than a
separately-taken reading a few points away from it. One trap is recorded with the table because it
produced a first version in which all five rows were identical: `solve` memoises on model hash ×
`envKey`, and λ/μ are **constants, not axes**, so they are not in that key — a sweep per candidate
has to clear the memo first or every candidate reads the shipped weights' cached answer.)*

**Every re-weighting that makes ν dominant fails I23(c), and every one of them fails it in the same
place**: `RUN0_LOW × DS` stops getting worse with depth (49 settings worse / 9 better as shipped;
0 worse / 70–75 better at every candidate). That is not bad luck to be tuned around — μ's dominance
*is* the `RUN0_LOW` finding, the most useful thing the depth dial says. A re-weighting deletes it.

The arithmetic is against it independently. λ is anchored to κ's own swing and μ to the two
measurements' standard deviations (the table above, in *The four constants*), so every candidate
breaks one anchor or the other: a re-weighting would ship an **unanchored** constant *and* a failing
gate. So the dial is re-described, and **the description is now gated**. I23 clause (g) computes
both correlations on every run and fails if `cooler` stops dominating — so this section and the
numbers move together or the build stops. The honest sentence is:

> **The depth slider re-sorts your range by what a hand costs when it is second best, and only
> secondarily by what it wins when it is best.** λ is the smaller half of it, and that is what the
> measurement says.

**Confirmed unchanged at v3 P5, which is the point of having gated it.** No phase after P1 touched
`depth.lambda` or `depth.mu` — they are 0.25 and 0.60 on the shipped model — and I23(g) still prints
**+0.1770 / −0.4162** on the same 9,225 cell-settings, so the correlations quoted in the table above
are the ones the gate computes on every run rather than a reading taken once and copied. Three
things ran over this dial in the meantime and none of them reached it: P4's pool-skill axis is a
coordinate change on VPIP, not on depth; the absolute-EV cut reads the score the dial produces and
does not enter it; and P5's allowance re-measure (§11.1) moved I23(d)'s *margins* while leaving
every measurement under them identical to six decimal places. Brief §5.2's finding — the dial's
story disagreed with the dial's behaviour — is therefore closed by description plus a gate, exactly
as the decision rule said it would be, and it stayed closed for four phases without anyone
re-reading this page.

#### Depth → width: the free anchor

*(v3 P1, item 6b. Off by default — `env.depthWidth` — and **v3 ships it off**: see the close-out at
the end of this subsection.)*

Until v3, **depth could not change how many hands you play**: `widthFor` read the environment only
through the straddle factor, so `CO` RFI targeted 28.13 % of the pool at 40 bb, at 100 bb and at
250 bb alike. That is limitation 17, and half of it has a fix that costs nothing.

`baseRealization(p, d) = base(p)^(1 + β·u(d))` already moves with depth, and it is already gated
(I23(f)). The ratio of a seat's realization at *d* to its realization at the reference is therefore
a signed, seat-dependent width factor with **no new constant behind it at all**:

```
widthRatio(p, d) = baseRealization(p, d) / baseRealization(p, 100)

    d = 250    SB 0.9638   BB 0.9749   UTG 0.9894   HJ 0.9965   CO 1.0070   BTN 1.0206
    d = 100    exactly 1 at every seat
    d =  40    SB 1.0376   BB 1.0257   UTG 1.0107   HJ 1.0035   CO 0.9931   BTN 0.9798
```

The signs are `base(p)`'s own — above 1 loosens deep, below 1 tightens — so **the blinds and the
early seats tighten as stacks deepen and CO/BTN loosen**, because position compounds when there is
money behind. Nothing here can be tuned: change the direction and you have changed `baseR`, which
I23(f) and every positional invariant already watch.

Two implementation notes are load-bearing and gate **I42** asserts both. The factor is written as
the **ratio of two `baseRealization` calls** rather than as `base(p)^(β·u)` — those are the same
quantity in real arithmetic and differ by one ulp at HJ and BB in IEEE-754, and I42's identity is
stated with `===`. And it is applied **last**, as one multiplication on the finished width, so the
composition `widthFor(deep) === widthFor(ref) · factor` is exact rather than a 1e-15 claim.

It applies at **all three percentile nodes**, including vs-Raise, where the straddle's seat factor
deliberately does not (limitation 13). Those are different objects: the straddle factor is a step
along `baseRaise`'s opening ladder and `w3bet` has no such base, while this is the ratio of a
*seat's realization* at two depths, which is defined whether or not that seat's width has a base.
Scoping it to the opening nodes would leave limitation 17 half-closed for a reason that does not
apply to it.

**What it costs, measured rather than assumed.** The factor compounds with `M_deep`, so painted
width drifts further across the slider than I23(d)'s 3.16 points: worst **4.787146** points, at
`rfi/BTN` VPIP 90 at 40 bb. I42 carries that as a re-measured allowance of **5.5** — the measurement
**+14.89 %** — rather than relaxing I23(d), because I23 sweeps the legacy lane and must keep
asserting the legacy number until the default flips. That +14.89 % is the **tightest margin any
allowance in the repository runs at**, which is why P5 adopted it as the shared re-pin idiom and
moved I23(d), I28 and I30 onto it instead of moving this one (§11.1). Its companion floor was the
last borrowed number in the clause and did move: I12's 10 % became **10.70 %**, the same measurement
I23(d) reads, at the same cell. On *painted* width the seat signs survive
at CO/BTN/SB/BB and are swamped at UTG/HJ, whose factors are 0.9894 and 0.9965 — about a third of a
point on a 16–20 % range, under the granularity I16 and I21 both document. I42 asserts the four and
reports the two.

**CLOSE-OUT AT v3 P5: the factor ships OFF, and that is a decision rather than an omission.** The
flip is a default move, so §0.4(c) of the plan makes it a `freeze-tiers.mjs --force` ceremony with a
printed move-diff — the same ceremony the villain-profile flip got at B1 — and P5 did not exercise
it. Two reasons, in order. The re-freeze at B1 was spent on item 8, whose default flip is the one
the product's headline axis needed; and this factor's whole value is that it half-closes limitation
17, which the absolute-EV cut then closed properly at P4 in a mode of its own (limitation 17's P4
block). Shipping a *second* width-moving default in the same release as the first, on the same page,
would have made the two indistinguishable in any measurement afterwards. So the axis stays inert at
legacy settings — shape (a) of the identity constraint — `widthFor` reads depth only when a caller
asks, I42 sweeps it ON at every run so it is gated rather than dormant, and **I22, I32 and
`data/tiers-v3-default.fixture.txt` all still reproduce byte-for-byte at the release boundary**.
Turning it on is a v3.1 decision with a ceremony already written for it.

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

#### The reference pot scales with depth — the knee is the anchor

*(v3 P1, item 6. Off by default — `env.rakeDepth` — pending the fixture ceremony that flips it.)*

`rake.potBB` above is a **constant**, and that is a defect with a name: the model rakes a 250 bb game
at the same 5 % it rakes a 40 bb game. Preflop pot sizes genuinely do not scale with depth — but the
cap is measured against the **final** pot, and the final pot does. So the reference pot scales:

```
rakePotBB(env) = potBB · (d / 100) ^ potScale                 potScale = 1
rakeFrac(env)  = min( rakePct/100 , rakeCapBB / (rakePotBB(env) · unitBB) )
```

**The anchor is the knee, and it is an identity rather than a fit.** `3 / 0.05 = 60` is the constant
that was already there; the ratio is 1 at 100 bb, so the coupled pot **is** the flat pot at the v1
operating depth — in *both* straddle states. Nothing at 100 bb moves by a bit, which is what lets
this land beside a green I22 and a green I32. The reading across the slider, which brief §5.3
predicted before the code existed:

| *d* | reference pot | `rakeFrac` at the 5 % preset | vs-3-bet price |
|---|---:|---:|---:|
| 40 bb | 24 units | 5.00 % | 30.53 % |
| 100 bb | **60 units** | **5.00 %** | **30.53 %** |
| 150 bb | 90 units | 3.33 % | 30.00 % |
| 250 bb | 150 units | **2.00 %** | **29.59 %** |

The flat stretch below the knee is part of the claim, not a rounding artefact: shallower than 100 bb
the reference pot is small enough that the **cap stops binding** and the house simply takes its
percentage, so the fraction has a floor and the floor is the lobby's own rate.

**It reads the raw depth, never `dEff`, and that distinction is worth a paragraph** because getting
it wrong is a wrong answer about money rather than a style question. `d` is the stack in *big
blinds* and the cap is quoted in big blinds; `dEff` is the same stack re-expressed in preflop units,
which is a change of unit and not a change of money. The straddle's whole effect on this quantity is
already the `· unitBB` in the denominator (§5.3). Reading `dEff` would double-count it and take a
100 bb straddled game from 2.50 % to 5.00 % — an I32 failure, and false besides. Measured both ways
before it was written; gate **I41** pins the version that is right.

**`potScale` is the one new opinion in this section, and it ships flagged.** 1 is linear: *the final
pot scales with the effective stack*, which is true when the money goes in and progressively less
true when it does not. Nothing in this repository measures how often a deep pot plays for stacks —
that is exactly the hole limitation 16 names — so the exponent is not justified, it is **bounded**:
it appears in `constants.rake.flag` in the shipped data, renders in the Method view, and I41 asserts
the knee identity, the 250 bb reading, monotonicity in depth, the exact arithmetic including the
straddle-doubled cap unit, and that the whole coupling is bit-inert when the axis is off.

One thing the coupling fixes that the table above does not show: at 40 bb **straddled**, the flat
model puts the reference pot at 120 bb against a 40 bb stack, and takes 2.50 % on the strength of a
pot the players cannot build. Coupled, the reference pot is 48 bb, the cap does not bind, and the
house takes its 5 %. The shallow straddled lane was the worst-described corner of the old model.

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

### 5.4 The absolute-EV cut — the second predicate, and the wall around it

*(v3 P4; V3-PLAN §3.4 and §5.4. Gates I34, I39, I40.)*

Everything above this line ranks. The score orders the cells, `widthFor` says how far down the
ordering to go, and the tier is whatever falls above that line. **That construction cannot answer
"is this hand profitable here"** — it can only answer "is this hand in the best 28 %" — which is
limitation 17, and the absolute-EV cut is its designated structural fix: a second predicate, `EV ≥
0`, computed **beside** the percentile cut on the same cells.

**Where it lives, and why that is the whole design.** V3-PLAN §3.4 says the predicate runs "beside
the percentile cut in `aggressiveSet`"; §5.4 says tier output must be identical across view modes
**by object identity**. Those two sentences are jointly satisfiable in exactly one shape, and it is
the shape that shipped: **view mode is not an input to `solve` or to `aggressiveSet` at all.**
`evCut(model, state, payoff)` is a *sibling* accessor with its own memo. It calls `solve`, hands the
**same object** back as `solved`, reads `aggressiveSet`'s memoised set, and writes its answer into a
map of its own. Nothing in it assigns to a memoised object. A mode flag threaded into the tier path
without a matching memo-key change is precisely the poisoning gate I34 exists to catch — the second
caller at those settings would be handed the first caller's *mode's* answer, silently — so the
architecture is not a stylistic preference, it is what makes the identity clause true rather than
toleranced. **The tier path is byte-identical whether or not anybody calls this**, which is why I22,
I32 and the v3 default fixture needed no ceremony for the phase that added it.

**The accessor is a per-call argument.** `policy.mjs` has no imports — the build inlines it verbatim
— so the payoff arrives as an argument on every call: the gates pass `makePayoff(model)`, and the
page will pass the `PAY` it already builds at boot on the day a control lands. **No page control
ships in the phase that added this**, on the item-9 precedent: the mechanism, its constants and its
gates land first, so the first control that lands is not also the place the model gets designed.
The Method view renders `constants.evCut` by construction, since it walks `Object.keys(constants)`. A module-level `setPayoff` would be V3-PLAN §2's "position re-entering through
global state" trap wearing a different hat, and would alias two models' EV in one process.
`payoff.modelHash` and its route tag are therefore *in* the memo key, along with `ip` and this
model's own hash — `policy.mjs` is outside gate I33(g)'s filename scope, so the key is written as
though that detector were watching and **I39(f) runs the detector here voluntarily** rather than
letting the blind spot stand.

**The arithmetic, and where the rake is allowed in.**

```
evBB = (ev · rakeRhoFactor(env) − invShare) · potMult · potSize − stake
```

Rake enters **only** through `rakeRhoFactor` — the exact §5.2 machinery, cap, straddle-doubled unit
and depth coupling included. **EV(fold) = 0 by construction**, not by cancellation: the only money in
that expression is money that goes in at or after the decision node, blinds are sunk, and there is
no fold term to get wrong. I39 reads the sharp form off the layer at the two equities where the
arithmetic is exact — a hand that never wins loses **exactly its stake and not a chip more**, which
is what says no sunk money leaked in.

**Two pot geometries, and the second one is a second EV route.** At the three percentile nodes the
request is the page's own hero-only shape, everyone at the node puts in one stake and it checks
down, so `potSize = (nOpp+1)` stakes and `keep ⟺ (nOpp+1)·ev·(1−r) ≥ 1` — the model's own fair-share
reading. At the vs-3-bet node **the frozen accessor cannot answer**: `payoff()` takes cell keys and
a *mix is not a cell*. The share is `eqMixOf` and the error is the blend's own
`seOfTrials(meta.trials.vs3bet)` by mix weight. That is a second route, it is said out loud here and
in I39's own detail rather than left to be noticed, and it is the only construction under which the
sign clause has content: with the pot written from the price the way the page's `nodePotBB` writes
it, `sign(evBB) = sign(eqMix − breakevenPrice(env))` is an **identity**, not an agreement.

**`stake` is a display scale and nothing turns on it.** It is the first rung of
`constants.solver.sizingLadder` — the pot-limit maximum from 0.5/1.0 blinds, an arithmetic identity
of the game (§6 of the plan), so no bb figure is typed anywhere. Because the pot is `(nOpp+1)`
stakes, `evBB = stake · (a dimensionless edge)`: `keep`, `mix`, `width` and the band's `k` are all
invariant under it, and I39(e) asserts that by doubling it on a fabricated twin.

**What it claims under Grade C: nothing about accuracy.** The payoff behind it is the checkdown
stub, every percentile-node reading comes back `supported:false` through the hero-only request
shape, and the badge — one function, `evBadge(source, se, supported)`, whose every input is proven
load-bearing by perturbation — says so on every cell. The cut is display-only. **I34 is what makes
that coherent rather than a hedge**: under the quarantine, no EV error of any size can reach a tier.

**And primacy is unreachable.** `evPrimary(model)` is `model.calibration?.verdict === 'pass'`, which
only the P5 ceremony may stamp and which limitation 18's pre-registered criteria mean can only ever be
stamped FAIL. The branch behind it **exists** — it requires `state.payoff` and throws without one,
never silently scoring — because a gate guarding a branch nobody wrote is a gate guarding a comment.
I34(d) fabricates a distinct-hash twin to prove the branch cuts real, different tiers, and the flag
is read **above the cache and is in the memo key**, which is the "flag check below the cache key"
failure §7.2 names.

**What it buys, measured.** At 225 identical settings a 5 % rake moves the score-path width **0
times** and the EV-mode width **177 times**; pooled across 900 settings the EV-mode width goes 22.83
% → 19.66 %. That is limitation 17's fix biting, in the one direction a percentile cut cannot go.

### 5.4.1 What the page shows — the EV surface and the three presentations

*(P4 UI step.)* The cut landed at P4 with **no page control**, on the item-9 precedent §3.5 also
invokes. This is the surface built on it, and the one thing to understand about all of it is that
**it is a re-quotation and never a re-computation**: `policy.mjs` owns the expression, the page owns
the picture.

**The EV colour mode paints `evBB`, and the page's own pot arithmetic is deleted rather than left
beside it.** Before P4 the mode painted the accessor's raw pot *fraction* and said so, because the
bb conversion needed `potMult` and `invShare` and the frozen interface did not yet return them. It
does now, and `policy.mjs` does the conversion for both the display path and the (unreachable)
EV-primary path, so the number painted is by construction the number a tier would be cut on the day
primacy is ever stamped. The page had a second pot arithmetic of its own — `nodePotBB()`, which
wrote the pot from the posted blinds while the layer writes it from the checkdown geometry
`(nOpp+1)` stakes — and it is **deleted**, not reconciled. Two pot arithmetics with one accessor
between them is the drift `policy.mjs` is inlined to prevent.

**The ramp's domain is the mode's own pre-existing anchor, re-expressed in bb.** It runs from `evBB`
at `ev = 0` to `evBB` at `ev = 2 × fair share` — the same "zero to twice the fair share, which puts
fair share on the middle step" the fraction ramp used, so no constant enters and two settings stay
comparable. **The first implementation used `ev = 1` for the top and that is recorded rather than
quietly fixed**: "a hand that always wins takes the raked pot" is an exact endpoint and a useless
one, because no cell on this grid is near it — 123 cells landed in three of seven steps and the ramp
stopped resolving the thing it exists for. Exactness at an unreachable end is not a virtue. Fair
share is exact *and reached*. Break-even then falls just above the middle step, at `ev = fair/ρ`,
because the rake is the only reason beating your share is not enough — and the legend prints which
step it is in, since a sequential ramp over a signed quantity must say where its zero is.

**Every mode-level honesty clause is derived, not typed.** The legend's source line is a *census*
over the layer's own cells (`checkdown, unsupported` today, and the sentence changes on its own the
day some of the grid becomes supported); the cell readout leads with the predicate's own decision
word and carries `evBadge`'s string verbatim; the colorblind channel is the bucket class `k0`–`k6`,
one per step, the same classes the cells carry, so the legend reads in the same channel the grid
does. The harness asserts **I13 in the mode at runtime** — 123 of 123 live cells carry a bucket —
beside the identical check the vs-GTO mode already had.

**The three presentations are §5.4's, and one of them is degenerate — which is recorded rather than
dressed up.** The rail's Display section carries a `Numbers` switch: **Score** (points clear of the
percentile cut), **EV** (big blinds clear of the fold), **Δ cut** (big blinds clear of the last hand
the score tells you to play). "Decision-delta" normally means EV(play) − EV(fold); here EV(fold) is
**exactly zero by construction**, so that reading *is* the absolute presentation, to the last bit,
and shipping one number twice under two names would be the page inventing a distinction the model
does not have. So the delta that ships is measured against the decision this page actually makes —
which is limitation 17's subject rendered per cell, and is two readings of the shipped layer
subtracted, introducing nothing.

**Score is the load default and the switch cannot reach a tier.** The tier path never reads the
presentation; the harness paints the grid in EV and back for each of the three and compares all 123
tier classes as strings, and it also asserts from the browser, from a **cold memo**, that
`evCut(...).solved` is the very object `solve` just returned. That is I34's quarantine seen from
outside Node.

**The inspector's four verdict lines keep four distinct meanings.** TIER, MARGIN, EV, DIVERGENCE.
MARGIN is the page's decision quantity and follows the presentation through the layer's own
`marginUnit`/`marginOf` seam; **EV stays the accessor's measured share with its own `se`**, because
that is the input the layer converts and because labelling the margin row "EV" would put the word on
two rows showing two different quantities. The bb figure is on the EV row's tooltip in every
presentation, and the full conversion — the six returned keys, then `ev → ×ρ_rake → −invShare →
×potMult → ×potSize → −stake → EV`, then the predicate, the MIX band and the two widths — is the
**Numbers** tab's waterfall, on the score waterfall's own chip idiom. Its last chip is the layer's
`evBB` rather than the row's own product, so an arithmetic that stopped closing would show on screen.

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

`heroIP` is simplified to `p ∈ {CO, BTN}` and the UI says so. The exact ν floors are in
`constants.vs3bet` and are rendered in the Method view.

#### The 3-bet sizing axis — exact geometry, and one thing it cannot say

*(v3 P1, item 9. This closes the first half of limitation 8; the second half is the flag below.)*

Every threshold at this node assumed a pot-sized 3-bet. `constants.sizing` makes the size an axis,
and **the price it implies is pure geometry** — there is no table assumption in it at all. With hero
opening to `o` into blinds `b` and villain 3-betting to `o + s·(b + 2o)`:

```
hero's call   c(s) = s·(b + 2o)
final pot     P(s) = (b + 2o)·(1 + 2s)
raw price     e(s) = c/P = s / (1 + 2s)        <- b and o CANCEL
```

so the sizing enters as the ratio `e(s)/e(1) = 3s/(1 + 2s)` and the shipped 0.290 is **re-scaled,
never replaced**. At `s = 1` the factor is 3/3 and the constant is returned by reference — bit for
bit, not to within rounding, which is gate **I44**'s first clause and what makes `sizing` a legal
new axis rather than a change to the existing surface.

**The top of the domain is the game's, not an authored window: the pot-limit maximum *is* `s = 1`.**
There is no 1.2×-pot 3-bet in PLO, so the reference is this axis's *ceiling* and the dial can only
make a 3-bet smaller. The bottom, 0.25, is the one authored number here and it is a display clamp
rather than a threshold — below a quarter pot, the face-up value range this node models is not the
range anybody min-3-bets.

```
s = 0.25   price 14.50%   floor 21.50%
s = 0.50   price 21.75%   floor 28.75%
s = 0.75   price 26.10%   floor 33.10%
s = 1.00   price 29.00%   floor 36.00%     <- pot, and today, bit for bit
```

**The flag: the 7-point premium is held constant, and that is an admission rather than a claim.**
The call floor sits 7 points above the price *"because a 3-bet pot is played out of position over
three streets"*. That is a **postflop** claim, and a bigger 3-bet buys a lower SPR — less postflop to
be wrong about — so the premium ought to *shrink* as `s` rises. By how much, nothing here can say:
the measurement layer is all-in equity at showdown, which is precisely the quantity that cannot
answer this (limitation 16). So the premium is held at its pot-sized calibration, ships flagged as
`constants.sizing.flag`, and I44 **measures the consequence** instead of a coefficient being
invented to hide it.

**And the consequence is small, for the same structural reason rake's is.** Across the whole domain
the price travels 14.5 points and the continue range moves **0.47**. The floor is not what binds for
most of this grid — the **ν floors** are — so a dial that moves only the price moves few decisions.
That is §10.14's lesson about rake, arriving at the same node by a different road.

Two notes on how I44 states the monotonicity claim, because both were measured rather than assumed.
It is asserted on the model's **verdict** (`wouldBe`), not on the MIX-inclusive continue width: MIX
is a band in cumulative combo *frequency* around a **moving** cut, so a cut sliding past the 34–36 %
pile-up (§10.11) sweeps cells into MIX and back out, and the MIX-inclusive reading is non-monotone
at 60 of the same steps where the verdict is monotone at all of them. That is the overlay moving,
not the decision. And V3-PLAN §7.2 predicted that I15's *"`RUN0_LOW × DS` always continues"* would
fail at large sizings; **it does not, and the number says why** — that cell blends 41.80 % against
the face-up mix and the floor reaches it at `s = 2.001`, twice the pot-limit maximum. The floor's
asymptote is 50.50 % and no legal 3-bet gets there, so the anchor is not merely unfalsified, it is
**unfalsifiable in this game**. I15 is therefore not re-scoped, and the reason is arithmetic.

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
No Monte Carlo runs for this number: the browser's one Monte Carlo (§9.12) re-measures cell equity
against a filtered field, and does not touch the within-cell adjustment.

**That sentence was not true of two surfaces until v3 P5, and gate I47 is what found them.** The
counterfactual lane wore the word; the hand panel's margin box and the drill reveal's margin line
did not, and both have been printing `adjRaw`-adjusted numbers since v1 — the drill's "the model has
this 4.2 points from your answer" is a per-hand margin, not a cell one. I47 clause (d) names the
per-hand surfaces one at a time rather than grepping the file, because a file-wide grep passes on a
page where one surface carries the word and four do not, which is exactly the state it found. Both
were repaired rather than scoped out.

### 8.1 The sub-cell top-N — rungs, not hands *(v3 P5, item 10)*

`adjRaw` is a small integer, so **a cell's hands do not form a ranking; they form at most fifteen
RUNGS**, and every hand on a rung scores identically. A list of "the 6 best hands in this cell" would
therefore be inventing resolution the model does not have — it would be picking six arbitrary members
of a tie. What the Composition tab shows instead, for the selected cell:

- **one row per rung**, strongest first, down to the cell's own `N`, plus the **floor** rung when one
  is cut off, so the reader sees the spread rather than only its top;
- for each row, a **representative hand** (the rank-highest one at that rung, which is what makes it
  deterministic), the **points it is worth against the cell mean** — `score'(h) − S(C)`, §8's own
  interpolation — and **how much of the cell shares that rung**, as a share and a combo count;
- a header count of the cell's rungs, the `estimate` badge, and two closing lines: that these are
  representatives rather than a ranking of hands, and that **a rung is not a tier — the ordering lives
  inside the cell and never enters the percentile cut**, naming the tier the grid paints for all of
  them.

**`N` is read, not chosen.** The list length is the length of the cell's own shipped `ex` array — the
same N the Example hands grid already renders — so item 10 ships **zero new constants** and §6 has
nothing to anchor. I47 clause (e) asserts that `want` — the block's one function for the question
"how many rows?" — **is** that read, textually: its whole body, comments stripped and whitespace
collapsed, must be `return (cell.ex && cell.ex.length) || 0;`, so a cap, a `Math.min`, or a length
laundered through a string cannot enter it. The clause used to scan one line for digits, and the
P5 red team walked a chosen six past it twice — once by reformatting `want` onto three lines, once
by spelling six as `'aaaaaa'.length`; both perturbations now fail the gate (`docs/refutations/P5.md`).

**Where that N comes from, said plainly.** *Zero new constants* is exact and *zero constants* would
not be. The six examples a cell ships are `spanExamples(E.exByAdj[unit], 6)` in
`scripts/generate-data.mjs` — the **Example-hands convention**, a pre-existing emitter choice that
predates this phase, is named in no `model.constants` key, and is not a quantity the sub-cell layer
derives. The top-N adopts it rather than inventing one, which is why §6 has nothing to anchor here;
what §6 would have to anchor, if anyone ever wanted the list length to be a decision of its own, is
that emitter choice and not this layer.

**At the vs-3-bet node the list keeps its ordering and drops its magnitudes.** §2.4 records that the
removed layer "could not say anything at all" at that node, because it cuts on `eqVs3bet` — measured
per cell against a face-up mix, carrying no within-cell resolution. The list says that in as many
words and prints each rung's `adjRaw` instead of a points figure, which is the same declining to
answer, made visible instead of silent.

**Where the rungs come from.** `rowOf` reads only ranks, so the 270,725 combos factor into 1,820 rank
multisets times their legal suit assignments: the page classifies the multisets once and a cell then
walks only those in its own row. Nothing is shipped in `model.json` for this — the whole feature is
4.7 KB of application code (§9.11) — and `test/subcell.test.mjs` pins the shortcut against a
brute-force enumeration of every hand in the deck, rung for rung and combo for combo.

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
123 cells, and its `nu`, `mplay` and `eqVs3bet`, with **zero** differences.
`test/v2-measure.test.mjs` keeps a frozen copy of the v1 kernel and holds the current one against
it, so a future edit that perturbs a v1 stream fails with a pointed message rather than as 170,478
moved tiers.

### 9.3 Trial budget

| Stage | Work | Trials | Standard error |
|---|---|---|---|
| S0 enumerate | classify all 270,725 hands; per-cell lists, features, combo matrices; empty-cell causes; mosaic geometry | exact | — |
| S0b classes | collapse the deck into 16,432 suit-isomorphism classes | exact | — |
| S1 villain prep | enumerate the four 3-bet component ranges into packed arrays | exact | — |
| S1b villain ordering | 60,000 shared deals over the 16,432 class representatives → eq1, then the five filtered pools | ~658M showdowns | ±0.30 pt/class |
| S2 cell equity | 100,000 multiway trials per non-empty cell (hero fresh from cell, 7 villains + board, prefix comparison) + the cooler counters | ~12.3M | ±0.16 pt/cell |
| S2L villain lattice | 100,000 trials per cell per lattice point, villains from the filtered pool | ~61.5M | ±0.16 pt, paired on hero |
| S3 vs 3-bet | 40,000 heads-up trials per cell per component, villain rejection-sampled by range index against a 52-bit used-mask | ~19.7M | ±0.25 pt |
| S5 derive + emit | ρ, ν, wave delays, `mplay`, `cooler`, lattice deltas, `adjMean`, rounding, hashing | — | — |
| S6 verify | all gates, benchmark re-measurement, cross-engine check | ~1.2M | — |

Four workers, jobs handed out a chunk at a time so a slow unit cannot starve a worker, results
posted as `Float64Array` transferables. Measured wall clock for the shipped v2 run on a 4-core box:
**188 s** — S1b 27 s, S2 12 s, S2L 101 s, S3 5 s, S4 13 s, benchmarks 7 s, verify 22 s. The hard
budget is still 6 minutes. `--fast` divides every trial count by 10 (~30 s), widens verify
tolerances, and stamps `meta.fast = true` so a fast dataset cannot be shipped into the page by
accident.

**One measurement sits OUTSIDE this pipeline, deliberately: the checkdown payoff matrices.**
`scripts/generate-checkdown-matrix.mjs` builds the two named 400,000-board samples the solver is
solved on and writes `data/checkdown-matrix.json` — ~21 s wall with the two seeds in parallel
(~21 s each single-thread), once per change to the construction, never per model run. It is not a
pipeline stage and it is not a verify step: at 400,000 boards a per-run build would put ~40 s on a
wall whose soft ceiling is 41.9 s, so the pair enters as a **generated, committed artifact**
(V3-PLAN §0.4 identity leg (b)) that verify **reads** in 3 ms. The determinism claim travels with
the generator rather than with verify — `node scripts/generate-checkdown-matrix.mjs --check`
rebuilds both matrices in memory from the inputs the file itself records and byte-compares against
disk (`build.mjs --check`'s idiom), costing the same ~21 s again, and it belongs to the **milestone's
green definition at its close-out** rather than to any per-run check. What runs every time is I33's
cheap `(artifact)` clause, which catches the one failure that would otherwise wait for the next
`--check`: a **stale** artifact, whose recorded `generatorHash` no longer matches the source in the
working tree.

**A SECOND ONE JOINED IT AT P3, and it is cheap rather than expensive.**
`scripts/generate-equilibrium.mjs` solves the HU baseline on that shipped matrix at both depths and
writes two things — `data/equilibrium.json` (the full-only payload, gate D9) and
`model.baselineTiers` (the quantized shared-core block, D6's 12 KB sub-budget). It costs **~0.6 s**
of solving, so budget is not why it sits outside the pipeline: the reason is that the artifact is
what **ships**, so it has to exist on disk before the full page can inject it or D9 can measure it.
`verify.mjs` reads it; it does not make it. Its determinism claim travels the same way the matrix's
does — `node scripts/generate-equilibrium.mjs --check` re-solves from the inputs the file records
and byte-compares, and also re-derives the baseline-tier block and compares it against the one in
`data/model.json` — with **one documented exclusion**: `meta.buildMs` is blanked on both sides,
because V3-PLAN §3.3 asks the payload to carry its wall time and wall time is a property of the
machine rather than of the repository. The exclusion is stated rather than achieved by quietly
dropping the field, and `meta.contentHash` is computed with the same two fields blanked so a reader
can recompute it from the file.

Neither generator touches the Monte Carlo. **`data/model.json` is not regenerated by P3 at all**:
`cells`, `rows`, `cols`, `bands`, `order` and `benchmarks` are byte-identical to the run before it,
and the only writes are verify's own `gates` stamp, the new `constants.solver` block and the
`baselineTiers` key — V3-PLAN §3.3's adjudication 11, proved by a key-by-key comparison at the
milestone and pinned as a property by `test/equilibrium.test.mjs`.

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
| v2 at the end of phase 3 (5 lattice rows) | 143.1 KB (146,551 B) | 242.2 KB |
| v2 at the phase-4 end (+ the frozen villain ordering) | 183.5 KB (187,859 B) | 282.5 KB |
| v2, 3 lattice rows (not shipped) | 134.6 KB (137,854 B) | 221.0 KB |
| v3, after the sub-bucket cut, before P1 | 113.9 KB (116,643 B) | 172.2 KB |
| **shipped, v3 P1** (+ the coupling constants, + D10/D11) | **115.3 KB (118,032 B)** | **173.7 KB** |

*(The last row is the file as it stands. Everything above it is history and is kept because the
budget argument below is about how the number moved, not only about where it landed: the cut took
69.5 KB out of a 183.5 KB file and D6's ceiling came down with it, from 195 KB to 120 KB. A removal
that does not move the ceiling has not been paid back. The **1,389 B** P1 then spent is `constants`
and gate keys and nothing else — `rake.potScale`/`potBBAt`/`flag`, `depth.widthRatio`, the `sizing`
block, the two `limitations` entries, and six gate keys (I41–I44 from the scoring lane, D10/D11 from
the dual build) — which is the shape every v3 scoring phase should have: the measured payload does
not move, because the axes re-score what is already measured.)*

The phase-3 row moved three times after the measurement pass, and none of those moves is payload.
`model.gates` is part of the file, so each new gate adds a key/value pair: **+38 B** for I24/I25/D7
(phase 1, taking 146,171 → 146,209), **+39 B** for I23/I27/I28 (phase 2A, → 146,248), and in phase
2B **+52 B** for I26/I29/I30/I31 together with **+251 B for `constants.depth`, `constants.rake` and
`constants.straddle`**, which `stampConstants` put into the file without a regeneration (§5.1)
— 146,551 in total. V2-PLAN §2.5's table records the original pre-gate reading, 146,171 B. The
measured payload — cells, lattice — is unchanged throughout.

**Phase 4's addition is payload, and with the sub-bucket layer cut it is now the largest single
item in the file after the cells: +40.4 KB for `model.order`,** the frozen eq1 ordering of the
16,432 suit-isomorphism classes,
15-bit packed into 30,810 bytes and base64'd to 41,080 characters, plus `meta.orderHash` and gate
D8's key. §9.12 is why it has to ship at all — the Simulate button re-cuts the villain pool at a
VPIP the generator never measured, and it must cut *the same ordering* the shipped lattice was
measured against or it is correcting one measurement with a different one. It took the emitted file
to **187,859 B = 183.5 KB** at the phase-4 end, the sub-bucket cut then took it to **116,643 B =
113.9 KB**, and v3 P1's constants took it to **118,006 B = 115.2 KB**, where it stands. The rest of
the file was byte-identical to the phase-3 payload: the
regeneration that produced it differs from the committed model in exactly five fields, and 145,827
bytes of JSON are the same on both sides once those five are removed (§9.12).

**Why the minified basis, stated plainly.** The plan's sentence budgets 220 KB against
"`model.json` is 105 KB today", and that 105 KB is the *minified* v1 file — v1 pretty-prints to
161.7 KB. Two numbers in one sentence have to be on the same basis. And read literally as a
pretty-printed ceiling, the rule is unsatisfiable by its own escape hatch: §2.5's stated fallback
of dropping the villain lattice to three v-points still pretty-prints to 221.0 KB. A rule its own
remedy cannot meet is the wrong reading of the rule. The pretty-printed figure is not hidden — it
is printed in the detail lines of both D6 and D7 on every run, and it is 173.7 KB as it stands
(242.2 KB before the sub-bucket cut, which is the reading the paragraph above argues against).

Inside that ceiling, **D6** carries the budget that actually bites. As it stands, after the
sub-bucket cut (§2.4) and v3 P1's new scoring constants: cells ≤ 65 KB (measured 62.2), meta +
tables ≤ 13 KB (12.1), **order ≤ 43 KB (40.3)**, **baseline tiers ≤ 12 KB (0.0, nothing there yet)**,
total ≤ 132 KB (115.3) — 4–7 % headroom per block, close to the margin v1 ran at (38.6 / 40 KB and
58.4 / 60 KB). The `sub ≤ 72 KB` sub-budget is **gone** along with the 69.5 KB block it bounded, and
the total came down 195 → 120 KB in the same commit.

**The 120 → 132 KB raise is RESERVED, not granted.** *(v3 P1, the dual build; V3-PLAN §5.3.)* The
12 KB is the baseline-tier block P3 will add, and a `core` clause re-asserts the original **120 KB
against the payload minus that block** — so no existing block gains a byte of headroom before the
block it was raised for exists. The gate's own line prints both readings on every run
(`total 115.3K/132K (of which core 115.3K/120K)`), which is what stops the raise being usable by
anything but the thing it was raised for.

**P3 FILLED IT, AND MADE A SECOND RESERVATION IN THE SAME IDIOM.** The baseline-tier block landed
at **11.5 KB of its 12** — per (pos, node, cell) tiers over the three (pos, node) pairs the
heads-up baseline covers, quantized at `baselineQuant = 0.01`, carrying its own `source` datum, its
own copy of the cap list and the HU coverage map so that lite renders the label and the caps from
**shipped data** rather than from prose. It also carries `quantFlag`, and that is the P3 red team's
doing: `baselineQuant` was the one constant six refuters of six returned **unanchorable**
(`docs/refutations/P3.md`). The byte table §6 offered as its anchor is real — every refuter
re-derived it exactly — but nothing in GREEN ever ran it, so 0.02, 0.05 and 0.5 all regenerated with
every gate, test and build passing, and the anchor's own prose could be replaced with fabricated
figures and still reach the Method view. **No replacement anchor was invented.** The constant now
ships §6's flagged idiom instead — `kind: 'estimate'`, the flag in both surfaces, the
`UNANCHORED['baselineQuant']` badge in the Method view — and the table is made **binding** by I36
clause (e), which re-derives it from the shipped strategies every run and refuses a step the table
does not price, a figure it misquotes, or a block that is not that quantization of those strategies.
0.05 and 0.001 remain priced rows and would still pass: *which* priced step to take is a judgment
about what a tier-level surface can paint, and that judgment is what the badge is on. The second block is `constants.solver`: the four CFR+
constants **with their anchors**, stamped from `cfr.mjs` by `stampConstants`, **2.3 KB** of which
2.2 KB is anchor prose — and the prose is the point, because §6's contract is "named in
`constants`, labeled in the Method view, bounded by a gate" and an anchor that lives only in a
source comment is not on the page. It lands inside the `meta` bucket, which was at 12.7 of 13 KB, so
`meta` goes **13 → 16 KB** and `total` **132 → 135 KB**. Both raises are reserved the same way and
there are now **two** re-assertions rather than one: `core` (the payload minus *both* new blocks)
still faces the original 120 KB at **115.9**, and `metaCore` (the bucket minus the solver block)
still faces the original 13 KB at **12.7** — the same bytes against the same ceilings as the run
before P3. The gate prints all four numbers, so "no existing block gained a byte" is a reading
rather than a claim.

**P4 AND P5 ADDED THREE MORE BLOCKS BY THE SAME RULE, AND THE READING IS BROUGHT CURRENT HERE.** P4
reserved two: `constants.skill` (**1 KB**, measured 0.9 — the dial's domain, its blend and the
`UNANCHORED` flags §6 requires it to carry) and `constants.evCut` (**2 KB**, measured 1.1 — the EV
MIX band's `k`, the bracket it was solved inside, and the derivation sentence), taking `meta`
**16 → 19 KB** and `total` **135 → 138 KB**. P5 reserved the fifth and it is the only one of the
five that is not a constant: **`calibration` 7 KB, measured 6,394 B = 6.2**, the primacy verdict —
the eight PC rows with their statuses, the pre-registered criteria **verbatim** (3.3 KB of the 6.2,
and the largest line item in it), the digest that pins them, the absent-corpus record with S-C's
reason, the empty `disputed` list *with the sentence saying why it is empty*, and the self-play
figures stamped `potFrac` / `moneyValidated: false`. `total` goes **138 → 145 KB**.

Three things about that fifth block are worth stating rather than leaving to the gate line.
**(i) It is not inside `constants`**, and that is deliberate: it is not an opinion the scoring layer
holds, it is a verdict *about* the opinions. So `meta` does not move for it and `metaCore` still
faces the original 13 KB with the same three blocks subtracted as before. **(ii) The criteria text
ships, not just its digest**, which is half the block — because V3-PLAN §3.5 requires the reason the
decision layer is unfalsified to be "on screen rather than in a doc", and a digest is not a reason.
It is the same trade `constants.solver` made for its anchor prose and `constants.evCut` for its
derivation sentence. **(iii) It would have fitted without a raise, and was raised anyway.** The
payload was 131.8 of 138 KB and 6.2 KB of calibration lands at 137.9 with 339 B to spare. Spending
that headroom is exactly what this gate's own idiom forbids: a block gets its own reserved
sub-budget so that its bytes cannot be spent by anything else, *and so that nothing else's bytes can
be spent by it*. The raise is exactly the sub-budget, so no pre-existing block gains a byte.

As it stands, every reading D6 prints: cells **62.2 / 65 KB**, meta + tables **17.0 / 19** (of which
core **12.7 / 13**), order **40.3 / 43**, baseline tiers **11.5 / 12**, solver constants **2.3 / 3**,
skill axis **0.9 / 1**, EV band **1.1 / 2**, calibration **6.2 / 7**, total **138.1 / 145** — of
which **core 116.0 / 120**, the same bytes against the same ceiling as the run before any of the
five blocks existed.
Those budgets are sized to catch a payload that creeps, not to leave room for one, and the meta
budget was *tightened* from 14 KB because the new measurement constants cost under a kilobyte
between them. The `order` sub-budget and the total's raise from 150 KB are phase 4's, stated at the
gate in the same form as the v2 raise above it: the ordering is a fixed-size object — 16,432 classes
at 15 bits is 40.1 KB whatever else changes — so a budget that leaves it 7 % is not leaving room for
creep, it is leaving room for the class count to be recounted. D7 is the published contract and is
deliberately slack against D6: if D7 ever fires, D6 fired a long time earlier.

One honesty note on the numbers those gates print. At generate time the model has not yet had
`gates` and `meta.hash` stamped into it, so the size measured inside the generator run is ~0.6 KB
short of the file that lands on disk; re-running `node scripts/verify.mjs` over the written file
reports the true byte count, 118,006 B as it stands. Both readings sit far inside the ceiling, and D7's unit test asserts
the equality that makes the basis honest — `Buffer.byteLength(JSON.stringify(model))` is exactly
the size of `data/model.json` on disk.

**What this budget does not cover: the page itself.** The model is injected into `index.html`
verbatim, and that file has its own budget. v1 shipped at 419.1 KB against a 400 KB gate; adding
the v2 payload alone would have made it ~457.7 KB, and by the end of phase 3 — with the environment
layer in the policy and the controls, sub-view, hand search and longer tour in the shell — it
reached 572.8 KB unstripped. That was never a `model.json` problem: shipping two fewer lattice rows would have
saved ~8 KB of it. It was a page problem, and §9.11 is how it was settled.

### 9.11 The page's own size, and the source/artifact split

*(v2 decision, 2026-08-29; revised at the phase-4 end, 2026-08-30.)* Measured on the shipped build:

| | KB, phase-4 end | **KB, as it stands (v3 P5, lite)** |
|---|---:|---:|
| `data` — the injected model | 183.5 | **138.1** |
| model code — inlined `policy.mjs` + `taxonomy.mjs`, **stripped** | 46.2 | **52.1** |
| app shell — CSS, markup and the **minified** app JavaScript | 344.8 | **393.7** |
| *of which:* the inlined Simulate worker bundle | *18.8* | *18.4* |
| *of which:* the vs-GTO colour mode (`@block:gto`, P3) | — | *10.0* |
| *of which:* the absolute-EV surface (`@block:ev`, P4) | — | *11.1* |
| *of which:* the pool-skill dial (`@block:skill`, P4) | — | *3.4* |
| *of which:* the sub-cell top-N (`@block:topn`, P5) | — | *4.7* |
| *of which:* the calibration verdict (`@block:calib`, P5) | — | *5.2* |
| *the app block with all five cut out* (`core`) | *344.8* | ***359.3*** |
| **total `index.html`** | **574.4** | **583.9** |

*(The full artifact is the same page plus the 69.6 KB equilibrium payload and one bridge line:
653.7 KB total, app 393.9. Its budgets are below. The five marked blocks are the same code in both
artifacts, which is why `app` and `appCore` are one number each rather than two.)*

The right-hand column is the build as it stands; the left is the phase-4 reading this section was
originally written against, kept because the argument below is about what the split and the
minifier bought, and those numbers are the before. Between them sit two removals rather than any
new economy: the sub-bucket layer went (§2.4, −69.5 KB of data and the expand panel that read it),
and the shell shrank with it. **The right-hand column is now the finished v3 reading**, and every
row of it moved: `data` +9.0 (the P3 baseline-tier block and the P5 calibration verdict, both
shared-core additions paid for as named D6 sub-budgets), model code +6.3, app +24.4.

The *model code* column was the one to watch across v3, and it is worth reading what it did. The
sub-bucket cut took it to 43.9 KB; P1's four axes spent 0.8 of that, to 44.7 against a 50 KB gate;
and P4's absolute-EV cut — the one v3 mechanism that is a scoring predicate rather than a display
mode — took it to **52.1 against a 54 KB gate**, the raise stated in its own paragraph below. It
ends v3 with **1.9 KB of headroom**, the tightest of the four budgets in proportional terms after
`core`, and the thing that kept it from being much worse is a split rather than an economy: `k`'s
derivation lives in `scripts/lib/ev-band.mjs`, which the page never loads, on the `constants.solver`
precedent. Without that the same feature measured 54.5 KB and the raise would have had to be 6.

Three things were done about it, and the third reverses a decision this section used to defend.

**Done: the injected module copies are stripped.** `scripts/build.mjs` inlines `policy.mjs` and
`taxonomy.mjs` into the page so the shipped policy can never drift from the one the generator ran.
Those copies are machine-generated duplicates — the commented originals are right there in
`scripts/lib/`, and anyone reading the model reads them, not the paste. So since v2 they go through
`scripts/lib/jsmin.mjs`, a zero-dependency character-level lexer that removes comments and dead
whitespace while preserving every literal, every token-separating newline (so automatic semicolon
insertion is unchanged) and every identifier name. Nothing is renamed and no expression is
rewritten: it is the same program with the prose taken out. On this build it takes the two blocks
from **107.0 KB to 46.2 KB — 60.8 KB, 57%**.

The stripping is proved rather than trusted. `minify()` re-lexes its own output and compares the
literal lists, failing the build if they differ; the assembled IIFE is parse-checked; and
`test/jsmin.test.mjs` evaluates both stripped and unstripped blocks in fresh VM contexts and
requires identical exports, identical constants, identical scalar results and an identical
`POLICY.solve` across a state sweep, against a direct import of the module.

**Done in phase 4, reversing what this section used to say: the app shell is minified too, behind a
source/artifact split.** Until phase 4 `index.html` was simultaneously the hand-authored source and
the shipped artifact, and this section defended leaving it unminified on the grounds that stripping
it would delete the source's own comments, and that splitting source from artifact to avoid *that*
"would break the single-file contract this project rests on". **The first half was true; the second
half was wrong, and the split is what shows it.** The contract is that the thing you download is one
file you can double-click, read end to end, and check against its own claims. Splitting does not
touch that: `index.html` is still one self-contained offline file with a provenance banner at the
top naming the source it came from. What the split gives up is a much smaller property — that the
file you *edit* and the file you *ship* are the same file — and the readable original is not lost,
it is committed beside the artifact.

So:

- **`src/shell.html`** is now the hand-authored source — 564.1 KB of commented markup, CSS and
  application JavaScript (415.5 KB when the split was made, 480.3 at the end of v2), `git mv`'d out
  of `index.html` with the generated regions emptied to bare markers. It is the file you edit and
  the file a reader should read.
- **`index.html` is generated and never hand-edited.** `scripts/build.mjs` walks every inline
  `<script>` in the source and runs its body through the same `jsmin.mjs` lexer the injected module
  copies go through, splices in the model, the policy, the classifier and the Simulate worker
  bundle, and writes the banner. Markup and CSS are shipped **as authored** — minifying those needs
  an HTML/CSS rewriter with no test suite behind it, over the part of the page a browser is most
  particular about, which is a much worse trade than the JavaScript path where a tested lexer
  already existed.
- The same three safety nets run per `<script>` as run on the module copies: parse as authored,
  minify, parse again — so a syntax error in the shell is reported against the shell rather than
  blamed on the minifier, and a lexer slip that changed a literal fails the build.

What that bought, measured as a `--no-minify` control build against the shipped one: the whole page
**785.0 → 574.4 KB** at the phase-4 end. The app shell's three inline scripts went 371.0 → 251.1 KB,
the machine-assembled worker bundle 48.1 → 18.8 KB, and the injected module copies 107.0 → 46.2 KB.
**As v3 ends the same control build reads 913.0 → 583.9 KB**, and the same three readings are
477.7 → 289.7 KB, 47.5 → 18.4 KB, and 163.2 → 52.1 KB — so the minifier is now removing 329.1 KB,
more than half of it prose in `policy.mjs`, which is exactly the asymmetry a *stripped* budget was
chosen to measure: the reader gets the reasoning from the source and the page does not carry it.
Roughly 86 KB of markup and CSS is untouched in both — up from 84, which is v3's UI markup and its
CSS, and it is the one part of the page nothing has ever compressed.

**Staleness has teeth, because a generated artifact that can silently drift is worse than no split
at all.** `node scripts/build.mjs --check` rebuilds the whole page in memory and compares it byte
for byte with the `index.html` on disk. One mechanism catches every direction of drift — an edited
shell, a regenerated model, a changed `policy.mjs`/`taxonomy.mjs`/`jsmin.mjs`/`build.mjs`, or a
hand-edit of the artifact — with no hash bookkeeping to keep in sync. The banner's source hash is
then read back only to *name* the culprit, because "the shell was edited without a rebuild" is the
common case and deserves a specific message. The banner carries no timestamp: nothing in the
artifact may vary between two builds of the same inputs, or the comparison stops working. Two builds
of the same tree are byte-identical, and a `src/shell.html` that ever carries the banner is refused
as a copy of the built page rather than compiled from.

**The budgets, retuned to that reality — once, at the phase end.** All three sit at the finished
measurement plus about 5 %, the same rule the phase-3 numbers were set by:

| gate | v1 | phase 3 | **budget** | measured, phase-4 end | **measured, as it stands** | headroom |
|---|---:|---:|---:|---:|---:|---:|
| total `index.html` | 400 KB | 540 KB | **600 KB** | 574.4 | **583.9** | 2.7 % |
| app shell | 245 KB | 345 KB | **398 KB** *(P5)* | 344.8 | **393.7** | 1.1 % |
| app shell **minus the five marked blocks** (`core`) | — | — | **360 KB** | 344.8 | **359.3** | **0.2 %** |
| inlined model code | *(none)* | 46 KB | **54 KB** *(P4)* | 46.2 | **52.1** | 3.5 % |

*(The budget column is what `build.mjs` enforces. **Three numbers moved across v3, each in its own
paragraph below and never in the same commit as the thing that filled it**: the app shell at P3
(360 → 388, the vs-GTO mode), at P4/P5 (388 → 392 → 398, the marked-block cap rule rather than the
artifact), and the model code at P4 (50 → 54, the absolute-EV cut). The `core` row is the other half
of every one of those raises: the same payload with all five marked blocks cut out, still facing the
360 KB ceiling the app block faced before any of them — which is what makes a raise a payment for
the feature it named rather than a grant to whatever grows next. It ends v3 with **0.2 % of
headroom** (0.7 KB), the tightest number on this page, and the next feature to touch unmarked app
code owes this section a paragraph before it spends it. The measured columns are the phase-4 reading these
budgets were sized against and the reading as it stands.)*

**The app-shell tripwire fired at P3, and the two paragraphs below are what happened. What follows
first is the record as it stood at B1**, kept because it is the measurement the raise was argued
against. P1's UI workstream — the collapsible rail, the matrix's own colour-mode
switch with its ramp hatches, and the four-tab inspector — spent **32.4 KB** of app shell, taking it
from 326.8 to 359.2 against a 360 KB gate. Nothing is over and nothing was widened to get here: the
budget is doing precisely what a tripwire is for, which is to make the next addition an explicit
decision instead of a diff nobody sized.

It was **deliberately not retuned at B1**, though the once-per-phase rule would have allowed it. Two
reasons. First, a budget raised in the same commit as the change that filled it is a budget that has
stopped being evidence — the 5 % rule sizes a tripwire against a *finished* measurement, and the
UI work §8 schedules is not finished. Second, "raise the ceiling" and "make the shell smaller" are
genuinely competing answers here and the second has not been tried: the shell carries markup and CSS
**as authored**, because minifying those needs an HTML/CSS rewriter with no test suite behind it,
and that trade was priced when 75 KB was untouched rather than 84. Whoever lands the next UI phase
owns that decision and owes it a paragraph, in this section, with the measurement it was sized
against — the same ceremony every earlier raise on this page got.

The total is *up* despite the shell now being minified, and both halves of that are worth stating:
the split took the page down to 454.1 KB, and phase 4 then spent it — 40.4 KB of frozen villain
ordering in the dataset (§9.10), 18.8 KB of inlined worker bundle, and the Simulate surface itself,
the villain-profile control, the q editor, the progress bar, the badges, a twelfth tour step and the
honesty copy that goes with all of them. A budget is a tripwire, not an allowance, so it was moved
deliberately and in one place rather than nudged per change: the interim numbers taken during the
phase (a provisional 580 KB) are gone, replaced by this reading.

The model-code gate was **raised 46 → 50 KB, out of necessity rather than convenience**: `policy.mjs`
grew the villain-profile equity accessor — the lattice interpolation, the exactness rule at the
lattice points, and the strict-identity OFF path that keeps gate I22 checkable (§9.12) — which took
the measurement to 46.2 KB, over the old gate. The new number is that measurement plus about 8 %,
the margin it was originally calibrated with. Its number was calibrated from scratch in phase 3
because it measures a *stripped* quantity; the old unstripped figures are not on the same basis and
were not carried forward. Its job stays narrower than the other two: it catches a `jsmin` regression
or a `policy.mjs` that has doubled, not "too much prose". Building with `--no-minify` deliberately
blows it — **119.7 KB against 50** as it stands, 107.0 at the phase-4 end — and the failure says so.
v3 P1's own scoring additions — the rake–depth coupling, the depth→width factor, the sizing
arithmetic and the villain shadow model — are visible in this number and are still smaller than what
the sub-bucket cut removed from the same file: 46.2 → 43.9 → **44.7 KB**. The unstripped column moved
much further than the stripped one (107.0 → 119.7) and that gap is the point of measuring a
*stripped* quantity: most of what P1 added to `policy.mjs` is the reasoning, which the reader gets
from the source and the page does not carry.

The honest claim is no longer "it fits in 400 KB", and it is no longer "the shell is source you read
in the shipped file" either. As v3 ends it is two claims, because there are two artifacts:
**584 KB of self-contained offline page — 138 KB of measured data, 52 KB of the model's own source,
394 KB of application — generated from 564 KB of commented source that is committed next to it and
that `--check` will not let it drift from**, and the same page plus a 70 KB solved payload at
**654 KB**.

**From v3 P1 that sentence is per-artifact, and it is grep-gated rather than proof-read.** The dual
build (V3-PLAN §5.3) ships *lite* as `index.html` and *full* as `index-full.html`; each artifact
carries exactly one honesty sentence, and gate **D11** asserts both directions — that an artifact
carries its own claim, **and that it carries none of the others'**. "One artifact wearing the other's
claim sentence" is the named failure mode, and it is the one a copy-paste between two shells
produces.

**P5 WROTE THE FINAL WORDING, AND IT LIVES IN §0 RATHER THAN HERE.** The two sentences are quoted in
full at the top of this document, where an honesty statement belongs, and this section owns only the
mechanism: `scripts/lib/variant.mjs` holds the strings, D11 clause (b) greps each artifact for its
own, clause (f) requires a second copy **outside the provenance banner** — the page has to make its
claim where a reader of the page sees it, not only where a reader of `head -6` does — and clause (e)
byte-compares both against the copies in §0. The placeholders these replaced said lite carried
*nothing that needed a solver*, which was already false when it was written: lite ships
`model.baselineTiers`, and those tiers **are** solver output, quantized and paid for as a named D6
sub-budget precisely so lite keeps a vs-GTO colour mode. What lite does not carry is the strategies
they were quantized from, and that is what the shipped sentence says. **The sentence cannot come
from `model.json`**, which is the shared artifact and is injected byte-identically into both pages;
it rides the variant seam, which is the only per-variant channel the build has, and it is the seam's
first use in the lite direction (`test/variant.test.mjs` pins the census at four blocks).

**AND THE PARAGRAPH THIS EDIT ITSELF OWES, WHICH IS THE SMALLEST ONE IN THE SECTION.** The
on-screen copy is unmarked app code, so it is spent out of `core` rather than out of a block cap:
**358.3 → 359.3 KB against the 360 KB ceiling** — 1.0 KB for the two variant blocks, the Method
view paragraph that renders them, and the Known-weaknesses entries that now render limitations 16
and 17 out of `constants.limitations` instead of retyping them — and **no ceiling moved**. That
leaves the tightest headroom on this page, and it is the right place to have spent it: the
alternative was a sixth `@block:` cap and a sixth `app` raise for one paragraph, which would have
bought bytes by widening a rule.

The full artifact's size budget **was deliberately `null`** until D9
set it from the first real `data/equilibrium.json`; **P3 set it**, and the four numbers are worth
reading together because two of them are not measured+5 %. `total` **634 KB** was set from a measured
618,127 B + 5 % — **a measurement taken before the vs-GTO block landed in the same phase, and the P3
red team caught it**: two refuters independently measured the artifact at 628,036 B and reconciled
the 9,909 B gap to the byte against §9.11's own reading of the mode (`docs/refutations/P3.md`), so
D9 was printing a ceiling and a measurement that could not both describe the same page. **The number
was not raised.** A fresh measured+5 % would be 646 KB; a ceiling *tighter* than its own rule is the
conservative direction and the artifact fits, so what was repaired is the sentence: `total` **634 KB**
bounds a page measured at **629,312 B (614.6 KB)**, 3.2 % of headroom, and is stated as *held below*
measured+5 % rather than derived from it. `eq` **73 KB** = 74,752 B bounds a payload measured at
**71,249 B (69.6 KB)**, 4.9 % above it — it was exactly measured+5 % at 70,704 B until the same
red-team resolution added `baselineQuant`'s flag to the payload (+545 B), and it is likewise kept one
whole-KB step under what a fresh measured+5 % would round up to. It is a *separate* tripwire on the injected payload, because the
equilibrium block is the full build's dataset and a solver payload that doubled would otherwise hide
inside a page-sized ceiling until it broke it. `app` and `modelCode` are **lite's numbers, adopted
rather than re-measured**: the application code is the same in both artifacts (full measures
359.7 KB against lite's 359.5, the difference being one `<script>` wrapper and one bridge line), and
a fresh measured+5 % would have been 377 KB — **17 KB of headroom handed to the shared app block as
a side effect of a second variant existing**, which is exactly the silent raise V3-PLAN §3.3's
adjudication 12 forbids. Full is therefore held to lite's ceiling and whichever variant grows first
fails first.

**THE RAISE-VS-SHRINK PARAGRAPH ADJUDICATION 12 IS OWED, AND IT IS A SHRINK.** Lite's app block
stood at **359.1 of 360 KB** — 0.9 KB of headroom — going into P3. The equilibrium seam's first
draft carried a ten-line HTML comment above it explaining the region, and HTML comments are *not*
stripped by the build (only `<script>` bodies go through jsmin), so it shipped in the markup of
**both** artifacts and took lite's app block to **360.1 KB**: over budget, by a comment. The fix was
not a raise. The comment was cut to one line pointing at `scripts/lib/variant.mjs`, where the
explanation belongs and where it costs the artifact nothing, and lite's app came back to
**359.2 KB**. So P3 added **0.1 KB** to the app block and no ceiling moved. The episode is recorded
rather than tidied away because it is the cheap version of the expensive lesson: the thing that
blew a byte budget was documentation in the wrong file, it was caught by the gate rather than by
review, and the first instinct — raise the number by one — would have spent the headroom the
vs-GTO mode is going to need.

**AND THE RAISE-VS-SHRINK PARAGRAPH P3's UI STEP IS OWED, WHICH IS A RAISE: `app` 360 -> 388 KB,
paid for by name.** The vs-GTO colour mode — §8 item 13's diverging signed ramp, its legend, its
per-seat disablement, its baseline-depth switch, its inspector line, its help copy and the Method
view's rendering of the shipped cap list — measures **10,035 B (9.8 KB)** in the minified app block,
across **15 marked regions**. Lite went in with **556 B** of headroom. There was no arrangement of
those two numbers that fit, so the ceiling moved, and every clause adjudication 12 asks for is in
place:

- **Shrink first, and it was tried before the raise rather than after it.** The shell was searched
  for dead weight and there was **439 B** of it: `.t-display1`, a type role nothing uses; `.bandrail`
  and its two child rules, a mobile band-jump control that was never built; and `.rail.m-open,
  .inspector.m-open`, superseded by `.inspector.open` when the sheet was written. All four are CSS,
  which the build ships **as authored**, so they were real shipped bytes. A scan for unreferenced
  top-level functions came back empty (359 of them, every one called), a duplicate-string scan found
  **737 B** across the whole artifact and most of it SVG path fragments, and the markup's hosts are
  already empty divs the page fills. **The source had no fat left**, which is the finding: the
  shrink was 439 B against a 10,035 B feature, and it did not avoid the raise. It is reported as
  what it was rather than dressed up, and most of it was spent again immediately — the legend row
  now keeps an unavailable mode's *reason* on screen instead of falling back in silence, which is
  about **430 B** and serves Δ-pin and EV as much as vs-GTO. With the display-help entry for the
  mode (a ~120 B placeholder saying no build ships a baseline) moving inside the marked block where
  it belongs, everything that is **not** the mode came out **126 B smaller** than it went in:
  367,958 B against 368,084.
- **The number is measured+5 %, in the D6 idiom.** Lite's app block with the mode in it measures
  **377,993 B = 369.1 KB**; +5 % is 387.6, rounded up to the whole KB: **388 KB**, 4.9 % headroom.
  Full is held to the same number, not a fresh measurement of its own, for the reason the paragraph
  above gives.
- **The raise buys exactly one feature, and the gate can see that.** The mode is bracketed in the
  source by `@block:gto` … `@end:block` markers — a third seam in `scripts/lib/variant.mjs` that
  ships nothing and strips nothing, and exists only to be measured. `build.mjs` compiles the shell
  **twice**, once as authored and once with those regions cut, through the same stripper and the
  same minifier; the difference is the mode's cost in the artifact's own bytes. It then prints both
  readings — `app 369.1 KB, of which sim engine 18.4, vs-GTO 9.8 -> core 359.3` — and enforces
  both: `app` against 388 KB and **`core` against the 360 KB the app block faced before the raise**.
  No existing block gained a byte, and none can drift into the new headroom without failing `core`.
  `test/ui-mode.test.mjs` asserts the other direction — that every one of the mode's symbols
  disappears when the marked regions are cut — so a byte of vs-GTO living *outside* its markers,
  which is the way this accounting would quietly become false, is a test failure.
- **`core` is 682 B from firing**, which is the number for whoever works here next, and it is the
  same tripwire it always was — a little further from firing than it was before P3, not closer:
  the ceiling did not move for anything but the mode.

**AND THE RAISE-VS-SHRINK PARAGRAPH P4's UI STEP IS OWED, WHICH IS A SHRINK ON THE CEILING THAT
MATTERS AND A RAISE ON ONE THAT DID NOT EXIST YET.** The P4 UI is two marked features: the EV
surface with its three presentations (`@block:ev`, **11,403 B = 11.1 KB**) and the pool-skill dial
(`@block:skill`, **3,532 B = 3.4 KB**). What happened to each ceiling is worth stating separately,
because they did not all move the same way.

- **`app` was not raised, and did not need to be.** Lite's app block went 369.1 → **382.5 KB**
  against the **388 KB** P3 had already paid for. Two features totalling 14.6 KB fit inside a
  ceiling set eight months of work earlier only because that ceiling was measured+5 % on a payload
  that then shrank; the headroom is spent now, and whoever lands the next app-side feature is
  starting from 5.5 KB.
- **`appCore` was not raised and the reading under it FELL, 359.4 → 357.9 KB.** This is the first
  time a UI phase has *returned* bytes to the unmarked block, and the reason is the deletion above:
  `nodePotBB()` and the old per-cell payoff call site came out, the EV surface went in behind
  markers, and the shared edits that remain — the pool-VPIP repointing, the presentation-aware
  readout, the shrinkable badge rule — cost less than what left. The shrink-first duty was
  discharged by deleting a duplicate rather than by hunting dead CSS, which is the better version of
  the same discipline.
- **`total` (full) was raised 634 → 646 KB, and the number is not a new one.** The full page grew
  623.2 → **636.3 KB (651,528 B)**. 646 KB is *exactly* what the P3 repair computed as a fresh
  measured+5 % for the pre-P4 page and **declined to take**, on the reading that a ceiling tighter
  than its own rule is the conservative direction. The page has now grown into that declined
  headroom, so the raise is a figure this repository had already priced rather than one invented to
  fit, and it stays below the *current* measured+5 %, which would be 669 KB. Lite's `total` is
  untouched at 600 KB against 566.5.
- **The per-block ceilings are new, and they are the P3 red team's one structural finding turned
  into a gate.** That review recorded that `@block:gto` had **no cap of its own**: the app raise
  named a feature and then bounded nothing inside that name, so 12.4 KB of filler could be added to
  the marked region and every gate stayed green — a raise that bounds a *name* rather than a
  *feature*. `budgets.blocks` fixes it, at measured+5 % rounded up to the whole KB in the same idiom
  as everything else here: **gto 11 KB** (10,198 B), **ev 12 KB** (11,403 B), **skill 4 KB**
  (3,532 B). `build.mjs` now compiles the shell once per marked block rather than once in total,
  `core` is `app` minus *all* of them, and `test/variant.test.mjs` asserts the caps sum to no more
  than the raise they explain — so the accounting cannot become decoration over a ceiling that was
  already passed. The gto cap is retro-fitted to a feature that shipped a phase earlier, which is
  the point: the finding was about the mechanism, not about that one block.

**AND THE RAISE-VS-SHRINK PARAGRAPH P5's ITEM 10 IS OWED, WHICH IS A RAISE FORCED BY THE CAP RULE
RATHER THAN BY THE ARTIFACT.** The sub-cell top-N is one marked feature (`@block:topn`, **4,844 B =
4.7 KB**), and the interesting thing about its accounting is that the page would have fitted without
any change at all.

- **`app` was raised 388 → 392 KB, and the artifact is not why.** Lite's app block went 382.5 →
  **387.6 KB**, still under the 388 KB ceiling P3 paid for. What does not fit is the **sum of the
  per-block caps**: `test/variant.test.mjs` asserts they together fit inside `app − appCore`, and
  gto 11 + ev 12 + skill 4 + topn 5 = **32 KB** against a 28 KB raise. So the raise is the P4
  paragraph above working exactly as intended one phase later — the four marked features are now
  bounded by *their own sum* rather than by whatever `core` happens to leave lying about, and a
  feature that would otherwise have hidden inside the unmarked block's leftover headroom had to be
  declared. 392 KB is measured **+1.1 %**, far under the +5 % this rule would allow (407 KB), on the
  standing reading that a ceiling tighter than its own rule is the conservative direction.
- **`appCore` was not raised, and the 358.0 → 358.3 KB its reading moved is not the feature.** Every
  byte of the top-N — the enumerator, the renderer, the call site and the harness hook — is inside
  `@block:topn`. The ~0.3 KB that *is* unmarked is the I47(d) repair to the hand panel and the drill
  reveal: two per-hand surfaces that predate this phase, finally saying `estimate`.
- **`total` was raised nowhere.** Lite went 566.5 → **571.5 KB** against 600, full 636.3 → **641.3 KB**
  (656,682 B) against the 646 the P4 UI already priced. **`data` did not move at all**, which is the sentence
  §2.4's cut earns: the last attempt at sub-cell resolution cost 69.5 KB of payload and this one
  costs none, because the rungs are enumerated in the browser from the taxonomy the page already
  carries rather than shipped as a second key on every hand.
- **The new cap is `topn` 5 KB** (4,844 B + 5 % = 5,087 B, rounded up to the whole KB), set by the
  same rule as the other three and asserted by the same test. **It refused something during the
  phase, which is worth one sentence because it is the first time a per-block cap has actually
  bitten:** a 262 B pointer to the new surface, drafted into the Method view's *Known weaknesses*
  bullet for limitation 2, took the block to 5,106 B — 14 B under the cap, so still green, and with
  a margin of 0.3 % where the rule asks for 5. The choice was a 6 KB cap and a 393 KB `app`, or the
  sentence. The sentence went: the page's weakness bullets are already deliberately shorter than
  §10's entries (limitation 1's whole "closed by default in v3" passage is not in its bullet
  either), the Composition tab says the same thing at length where a reader is actually looking at
  a cell, and a ceiling loosened by 1 KB is headroom the next feature grows into unbounded.

**AND THE SAME PARAGRAPH FOR P5's CALIBRATION STEP, WHICH IS THE FIRST TIME `total` HAD TO BE
MEASURED RATHER THAN TAKEN OFF A SHELF.** The Method view's calibration section is one marked
feature (`@block:calib`, **5,313 B = 5.2 KB**), and the verdict it renders costs the page a second
time in `data`, which is why this entry moves two ceilings where item 10 moved one.

- **`app` was raised 392 → 398 KB, and the artifact is again not the whole reason.** Lite's app
  block went 387.6 → **392.7 KB**, 0.7 KB over the ceiling — so unlike item 10 the page really is
  over. But what *sets* the number is the cap rule for the third time: gto 11 + ev 12 + skill 4 +
  topn 5 + calib 6 = **38 KB** must fit inside `app − appCore`. 398 KB is measured **+1.3 %**, far
  under the +5 % this rule would allow (413 KB).
- **`appCore` was not raised and its reading did not move at all** — 358.3 KB before the section and
  358.3 KB after it, to the tenth of a KB. That is the cleanest evidence any of these raises has
  produced that the money bought the feature and nothing else: every byte of the section, including
  the *Known weaknesses* entry for limitation 18 and the `renderMethod` call site, is inside the
  markers.
- **`total` (full) was raised 646 → 660 KB, and this one is a fresh measurement.** The P4 raise
  could take a number the P3 repair had already priced and declined; there was no such number left.
  The full page grew 641.3 → **652.8 KB (668,417 B)** — 11.5 KB, in two pieces that are budgeted
  separately because they are two different things: **6.4 KB of shared model payload**
  (`model.calibration`, D6's fifth reserved sub-budget, which lite pays for too) and **5.2 KB of
  Method-view section** (`@block:calib`, capped at 6 KB). 660 KB = 675,840 B is **1.1 %** above the
  artifact, deliberately far below the **686 KB** a fresh measured+5 % would give, on the standing
  reading this row settled at P3 and re-applied at P4 — a ceiling tighter than its own rule is the
  conservative direction. `eq` is untouched at 73 KB (`data/equilibrium.json` did not change this
  phase). Lite's `total` is untouched at 600 KB against **582.9**.
- **The new cap is `calib` 6 KB** (5,313 B + 5 % = 5,579 B, rounded up to the whole KB). It is a
  large block for a Method-view section and most of it is prose, which is the trade the section
  exists to make: the eight criteria, the unevaluable count, the corpus that is not there and the
  reason it is not, PC-8's numbers, and the words `potFrac` and `moneyValidated: false` on the one
  figure that could be mistaken for a result. A FAIL rendered in a sentence would have been cheaper
  and would have been the thing V3-PLAN §3.5 wrote "on screen rather than in a doc" to prevent.

**One dependency, scoped as a property rather than a promise.** *(From spike S-E §7.)* This
repository is no longer "zero-dependency" flatly, and pretending otherwise would have been the
easier sentence. Playwright is a **dev-time** dependency with two named consumers, `smoke.mjs` and
`browsers.mjs`, and no runtime reach at all. The promise that survives is the one that was ever
load-bearing and is now stated exactly: **the generator and both shipped artifacts have zero runtime
dependencies** — `index.html` fetches nothing, imports nothing and runs from `file://`, and
`scripts/generate-data.mjs` builds it with nothing but Node. That is mechanically enforced rather
than asserted here: `test/manifest.test.mjs` pins Playwright as the *sole* dependency and pins the
manifest's deliberate absence of a `"type"` field (adding one would flip `.js` resolution repo-wide
and break the two classic worker scripts) — two properties that are invisible in a diff and
catastrophic to lose. Any further adoption needs a named consumer and a memo; the default answer is
no.

### 9.12 The Simulate button — the one Monte Carlo that runs in your browser

*(v2 phase 4, 2026-08-30.)* Everything in §§1–8 is measured at build time and read out of
`model.json`; the browser does arithmetic. **One surface is different, and this section is its
honesty spec.** With the villain profile on and the table VPIP or the discipline `q` off the
measured lattice, the page can run the same Monte Carlo the generator ran — same evaluator, same
kernels, same seeding scheme — on your machine, and replace interpolated numbers with measured ones.
§10.9 used to say no Monte Carlo runs in the browser. One does now, **and only when you press it**.

**What arms it, and what can never arm it.** The villain profile is a control and its default is
OFF.

| profile | v | q | what the numbers are | button |
|---|---|---|---|---|
| off | anything | anything | the shipped random-villain measurement, **by reference** | no |
| on | ∈ {25, 40, 55, 70, 90} | 0.85 | the shipped `vDelta` row, **exactly** | no |
| on | off-lattice | 0.85 | linear blend of the two bracketing rows, badged `interpolated` | yes |
| on | anything | ≠ 0.85 | there is no shipped answer; the baseline is shown and labelled | yes |

Three details in that table are load-bearing. **OFF is object identity, not equality**:
`POLICY.villainEq` returns `cell.eq` and `cell.rho` by reference, asserted with `assert.equal`
rather than `deepEqual`, and gate **I22 — v1's tiers, bit for bit — still passes untouched**. A
helper that reproduced v1 by adding 0.0 would be one rounding change away from not doing so.
**A lattice hit returns the shipped row itself**, never `a + (b−a)·f`, which is exact at f = 0 and is
precisely the expression that stops being exact at f = 1; and the "already measured" branch is
checked before the "measured in this browser" one, so even a simulation at v = 55 cannot put a badge
on numbers that are already the measurement. **A custom `q` reports `supported: false`** and shows
the random-villain baseline rather than interpolating an axis with a single measurement on it — that
is the state the button exists for.

What may **never** arm it: depth, rake percentage, rake cap, straddle, position, node, limper count,
raiser seat, the 3-bet mix, colouring. None of them moves an equity (V2-PLAN §1) — they are
*scoring*, not *measurement*. Asserted twice: a decision-table unit test that feeds eleven extra
keys and requires the answer not to move, and a browser check that drives each control at a lattice
VPIP and re-reads the DOM.

**The trial budget and the ±.** The default is **25,000 trials per cell over the 123 non-empty
cells — 3,075,000 trials**. The ± is `50/√n`, the binomial standard error at p = 0.5 in equity
points, which is **the same expression the generator writes into `meta.se`**, so a simulated badge
and a shipped one are on the same basis:

| trials/cell | ± | |
|---|---|---|
| 100,000 | **0.158** | the shipped lattice (§9.3) |
| 25,000 | **0.316** | the Simulate default |
| 500 | 2.236 | the test hook |

V2-PLAN §4 quotes "±0.35 pt vs the shipped ±0.16". Those two numbers cannot come from one formula —
0.16 *is* `50/√100000`, and `50/√25000` is 0.32. **The 0.35 is an arithmetic slip and the code is
written to the measurement**, in the same way I25 and D7 were. Every badge derives from the trial
count that actually ran, never from a constant: the reduced-trials test hook can make a run cheap,
and it must not be able to make a badge lie about how much measurement is behind a number.

**The ceiling: 100,000 trials/cell, one step, no compounding.** V2-PLAN §4 offers a
"`Re-run at 4× trials`" link. Left unbounded that is a ladder — 25k → 100k → 400k → 1.6M, each rung
minting a new settings hash, a new cache entry and a new book entry, for a quarter of a tenth of a
point and minutes of compute. It is **one step, and it lands on the ceiling**. `100,000` is 4× the
default *and* `MODEL.meta.trials.latt`, the shipped dataset's own per-cell trial count, which makes
it the exact point at which a simulated equity is as precise as the file it is arguing with — ±0.16
either way. The tooltip says so; a test asserts that claim against the data rather than leaving it
in prose. At the ceiling the badge chip is disabled and the rail button is hidden.

The clamp lives in the engine's `normalize`, not in the button, and **above** the settings hash. A
ceiling only the UI honours is not a ceiling — a console call, a stale `?simtrials=` or a second
consumer would all sail past one — and if every rejected excess minted its own key, an unbounded
caller would still be an unbounded grower of cache entries, which is the same failure moved one
layer down. So `settingsHash({trials: 4e9}) === settingsHash({trials: 100000})`, and everything
reported derives from the clamped count: a run that asked for 400,000 measures 100,000 and **says**
100,000. Measured cost of the two rungs: 3.4 s at 25k, 13.3 s at 100k (12,300,000 trials).

**Seeding, and what "bit-identical" is a claim about.** The same seeded xorshift128 as §9.2. The
seed is an FNV-1a hash of `sim|<what>|<stage>|<cell key>|<settings hash>|<slice index>` and
**nothing else** — not the wall clock, not the worker count, not the order chunks were handed out
in. Three consequences, all asserted:

- a re-run at the same settings is **bit-identical**;
- a run interrupted by a tab throttle resumes by re-running **only the cell that was in flight**,
  with no drift;
- `workers=1` and `workers=8` produce the same numbers.

**Both execution paths slice the work identically**, at a fixed 5,000-trial slice. The main-thread
fallback *has* to slice, because it must hand the frame back; if only it sliced, the two paths would
draw different hands and land on different numbers for identical settings — and the cache is keyed
by settings alone, so a number measured one way could be served to a session running the other. Both
estimates would be unbiased and inside the same ±, but "the same settings gave me a different
answer" is exactly what a tool like this may not do quietly. Measured worst `|delta|` between a
fallback run and a worker run over 123 cells × 7 field sizes: **0**. The slice size is fixed rather
than adaptive, because an adaptive one would make the *result* depend on how busy the machine was.

**The frozen ordering, and why 40 KB of permutation ships.** The button cuts a villain pool at a
VPIP the generator never measured, and it cannot re-derive the cut. The ordering is eq1 (§3.3), a
Monte Carlo over 16,432 suit-isomorphism classes × 60,000 shared deals; a second run would order
classes near the cut differently, and the browser would then be simulating a **different pool** from
the one the shipped lattice was measured against while calling the difference a correction. So the
permutation itself ships, in `model.order`: 16,432 class ids at 15 bits each (2¹⁴ = 16,384 is 48
short), 30,810 bytes base64'd to 41,080 characters — **40.1 KB** — plus `meta.orderHash`. An
arithmetic coder would reach the 25.5 KB information-theoretic floor and save ~14 KB; that is not
worth an unauditable decoder in this page.

The index space is the load-bearing detail. Numbering classes by first appearance would tie the
payload to `taxonomy.mjs`'s enumeration order, and the taxonomy is deliberately **not** in the
worker bundle. The shipped permutation is therefore expressed in an enumeration-independent space —
**classes sorted by their canonical packed representative, ascending** — so any consumer that can
enumerate the 270,725 hands in any order arrives at the same numbering.

**Gate D8** asserts four claims, in ascending order of what they catch: the payload decodes to an
**exact permutation** of 0…n−1 (a duplicate or missing id silently changes the pool at every v, and
a length check would not see it); its hash matches `meta.orderHash` (catching an order transplanted
from another model, or a hand-edit that is still a valid permutation); re-deriving the classes from
the enumeration yields exactly n; and running the generator's own cut rule over the shipped order
reproduces `constants.villainLattice.realized` at all five lattice points to the 4 dp it ships at —
those fractions land on class boundaries, so they fingerprint the ordering near every cut. It costs
19 ms and runs on every verify. `test/order-pack.test.mjs` makes the stronger check the gate cannot:
the pools themselves, hand for hand, at all five cuts (67,682 / 108,291 / 148,893 / 189,506 /
243,645 hands, all identical), plus four off-lattice cuts landing within a class of target. **The
browser cuts the same pool the generator cut, and cuts sensible pools where the generator never
went.**

**The regeneration reproduces the committed model bit-identically.** Adding a field to the emitted
file means re-running the generator, which means the file's every measured number is re-drawn — so
it was diffed rather than trusted. A full 184 s run differs from the pre-change model in exactly
five fields: the new `order` block, `meta.orderHash`, gate D8's key, `meta.hash` (which moves because
those did) and `meta.generated`. **With those five removed, 145,827 bytes of JSON on each side,
byte-identical** — every `eq`, every `vDelta`, every `cooler`, `nu`, `mplay`, `combos`, `eqVs3bet`,
every benchmark and every constant. Recorded in the phase-4 verification artifact `regen-proof.txt`.
The one further difference the diff surfaced is key *order* in `model.gates` — the committed file
listed D7 last, a fresh generation lists it where `verifyModel` emits it — which means the committed
map had been written by a later `verify.mjs` restamp rather than by a generation. That predates and
is independent of this change; no value differs.

One cosmetic consequence to know when reading a date off the page: **`meta.generated` reads
`2026-08-30`**, one day ahead of the local date the rest of this phase is stamped with, because the
generator stamps `new Date().toISOString()` in UTC and the run crossed midnight UTC. It is a build
label, not an input to anything, and it is the date the Method view and the build banner quote.

**The settings hash: what a measurement depends on, stated as code.** `SIM.settingsHash({v, q,
trials})` returns 8 hex characters over `meta.hash`, `meta.orderHash`, `v`, `q`, `trials` and
`nMax` — **and nothing else, by design**. Depth, rake percentage, rake cap, straddle, the 3-bet mix,
position, node, limper count, raiser seat and colouring are all **out**, for the same reason they
cannot arm the button: they are scoring, not measurement. A hash that included them would throw away
a perfectly good measurement every time someone dragged the depth slider, and would be claiming a
dependency the model does not have. Asserted by a test that walks eleven of them, and from both
sides in the browser — driving depth/rake/cap/straddle after a measurement leaves the hash, the
cache entry and the badge untouched. Numbers are canonicalised, so 55, 55.0 and 55.0000000001 are
one entry.

**One stage.** A run measures the 123 live cells and nothing else. It used to be two — stage 2 was
the sub-buckets of the expanded cell — with a bar that drew a second segment, a sentence explaining
when that segment was skipped, and a partial-run path that reused a cached stage 1 while running
only stage 2. All of it went with the layer (§2.4). A run now measures every live cell or it does
not run, which is why a cache hit at the settings hash is a complete answer by construction and the
`subsOf` scope input no longer exists to be kept out of the key.

**Where it runs.** The engine is one flat classic script assembled at build time out of
`eval5.mjs`, `villain-range.mjs`, `order-pack.mjs` and the marked portable slices of `villains.mjs`
and `mc.mjs` — V2-PLAN §4's "already dependency-free ES modules" was optimistic; the browser needs
a separate entry twin and a single flat bundle, which is what the spike settled on. It is built in
**two halves**, a kernel and an entry, because `self === window` on the main thread and evaluating
the entry outside a worker would install `window.onmessage`; the worker Blob is kernel + entry and
the fallback evaluates the kernel alone. Same code, no duplication. `taxonomy.mjs` is not in it,
asserted by a test that greps for its exports, and the portable slices are marked in the source so
that an edit dragging a Node dependency into one fails the build instead of producing a worker that
dies with an empty error message.

Measured in headless Chrome on `file://`: the classic Blob worker **does boot** — 4 workers, ~25 ms
of in-worker init each — at **901,195 filtered trials/s**, giving a full 25k/cell run in **3.42 s**,
measured end to end rather than extrapolated. (V2-PLAN §4's mock-up bar says "~18s left"; the real
thing is five times faster.) A one-off ~150 ms main-thread pass groups all 270,725 hands by cell,
once per page.

**If the worker does not boot it degrades, and says so.** The fallback is rAF-chunked main-thread
compute inside a 24 ms frame budget at a 0.35 duty cycle — §10.9's frame-budget harness, built for
real. It is **much slower, often 10× or more**, and that copy is deliberately not a bounded factor:
measured here at 12× (15.0 s against 1.27 s at 8,000/cell), but the ratio moves with core count and
with whatever else the page is doing, so an "N–M×" claim would be a number the page cannot stand
behind. A harness check now fails any bounded-multiplier claim in the painted line. The fallback
also **stops while the tab is in the background**, and says that too — with a caveat worth recording
because it was a real bug: the disclosure cannot live inside the rAF loop, since rAF is exactly what
a hidden tab suspends. It did, for one round, and the result was a frozen bar with a stale countdown
instead of the word *paused*. A `visibilitychange` listener registered for the lifetime of the run
reports it now, and `tick`'s own `document.hidden` guard is kept for a browser that does not suspend
rAF. The run resumes on unhide with a bit-identical result.

**The cache promises nothing, and neither does this document.** It is best-effort. The backend is
decided once, at load, by a **real write probe** rather than a `typeof` sniff; if the probe fails,
the engine degrades silently to an in-memory `Map` for the session. **The reason used to be a
citation and is now a measurement, and the measurement went the other way.** This section used to
say WebKit "is documented to throw `SecurityError` on the first `localStorage` access from a
`file://` page". Spike S-E measured it and gate **SS** independently reproduced it: WebKit 26.5 does
**not** throw — `localStorage` is reachable from `file://` and the page caches to it. The probe
stays, because the design argument never depended on which browser throws: a `typeof` sniff answers
a question about the API's *presence* when what the engine needs to know is whether a *write*
succeeds, and that is a different question in any browser with storage disabled, a full quota, or a
private window. What changed is that the sentence explaining it is now a verdict this repository
measured rather than a fact it repeated. Keys are namespaced
`plo4:<model hash>:<settings hash>`, the cap is ~1.5 MB with LRU eviction, and `QuotaExceededError`
is handled explicitly (evict, retry once, then live in memory). **Chrome shares one `localStorage`
area across every `file://` page on the machine**, so the store is treated as hostile: every read is
validated against a tag, the model hash, the settings hash, the field size, **the settings the
payload itself declares** (a payload whose `v`, `q` or `trials` disagree with what was asked for is
dropped — the trial count is what sets the tolerance below, and a validator must not let the thing
it is judging pick its own yardstick) and the shape of every equity array, and anything that fails
is discarded rather than shown.

**What this validation stopped buying when the sub layer went, stated plainly.** A payload used to
carry a sub-bucket block, and that block was held to far more than shape: it had to name a cell
this model ships, carry **every** bucket that cell ships and no others, and its combo-weighted mean
had to reconstruct that cell's equity **at every field size N**. That partition identity was the
strongest check here, and it is gone with the thing it was an identity about — at the cell layer
there is nothing left to reconstruct a cell *from*. What remains is shape and plausibility, applied
at every index rather than at one: every equity array is `NMAX` finite numbers inside [0, 100], and
a payload with no trial count is refused. The `max(1 pt, 8σ)` tolerance that the identity used, and
the 6,888-gap measurement behind it, are gone with it too.

The consequence is not hidden: a flat 99.9 across one cell is now **accepted**, where the partition
check would have caught it. The claim the page may make about a cached measurement was always
"well-formed, plausible and internally consistent, never trustworthy"; it is now "well-formed and
plausible", and `test/sim-engine.test.mjs` asserts the fabrication that passes, so nobody can
quietly upgrade the prose back. The page keeps a second, in-memory book of completed runs bounded on
the same terms — ~1.5 MB **and** a 24-entry cap, evicted least-recently-*used* so a VPIP you keep
returning to survives a walk along the slider — and runs the same validation on read as on write,
because an entry can arrive there straight out of the shared store. Validation is not authentication
and cannot be: it buys well-formed, plausible and internally consistent, never *trustworthy* — there
is no secret here to key a digest on, so a fabrication that is self-consistent as well as well-formed
is indistinguishable from a real measurement. **The residual used to be describable precisely and it
no longer is, which is a widening rather than a narrowing and is recorded as one.** While the sub
layer existed it was *any* fabrication landing within `max(1 pt, 8σ)` of the partition identity —
two shapes, the obvious one moving a cell and its buckets together and the quieter one leaving
`cells` honest and shifting the buckets alone by less than the noise band, with 13.33 pt of room at
900 trials/cell and 2.53 at the shipped 25,000. That tolerance, that measurement and the identity
they were about all went with the layer (§2.4). What is left is a strictly larger residual with no
number on it: any payload that is well-formed and plausible at every index, which a flat 99.9 across
one cell satisfies.

What the page says is that a cache hit "may come back instantly … a pleasant surprise, not a
promise", and when the backend is memory it says results are kept for this session only.
**Persistence is measured to work in Chrome on `file://` and is unverified everywhere else, so it is
not promised anywhere.** Measured: 14.5 KB per stored setting, hit in 0.2–0.3 ms with no bar drawn
at all — the observable difference between "instant" and "fast".

**When the page's own code fails, you see it on the page.** Two layers, because they answer
different questions. The engine invokes every caller callback through a wrapper: a throw is logged
with the callback named, recorded at `SIM.status().callbackError`, and then **swallowed** — the run
continues and the result is still delivered. Before that, a throw fell into the run's own promise
chain and came back out as `onError`, so the page announced *"last run failed"* about a measurement
that had in fact succeeded, and the real defect — a paint function that throws — reached nothing
anyone looks at. The page then guards each of its own four handlers, and on a throw writes a plain
*"Display error … the measurement is running and is unaffected"* line with `textContent` — no
template, because whatever just threw must not be asked to render its own failure — and keeps it
**sticky** in the rail note, because clearing the bar at the end of a run would otherwise take a
mid-run display bug away with it.

**What it does not measure.** Equity against the filtered field, and nothing else. `cooler`, `nu`,
`mplay` and `eqVs3bet` stay shipped build-time measurements; the within-cell hand adjustment (§8) is
still an interpolation and still says `estimate`. A simulated result re-scores through the same
`POLICY.villainEq` → `rankTable`/`solve` path as a shipped one: the button changes where an equity
came from, not what is done with it.

**How this is checked.** 110 unit tests across the packed order, the bundle, the shipped engine text
and the shipped UI-logic text (both sliced out of `src/shell.html` by their markers and evaluated,
so the tests cannot drift from a copy); a real-browser harness of 38 sim checks driving genuine
Monte Carlo runs on `file://` — including a genuinely hidden tab, a worker control run to prove the
hide was observable at all, a cold/warm cache across an actual page reload, and the re-run chip
clicked to the ceiling — and 33 mutations, each a one-line lie the page could plausibly tell, every
one of which turns a check red.

---

## 10. Known limitations

Nothing here is hidden behind a disclosure. They are listed in the app's Method view too.

1. **Equity is measured against *random* opponents, not against ranges.** Loose lobbies make this
   a far better approximation than it would be in a tight game — at 90% VPIP an opponent's calling
   range genuinely is close to random — but at the tight end of the slider it overstates
   speculative hands. The vs-Raise `tighten` shift (§6.5) is a patch, not a solution.
   **Partly closed in v2, and closed by default in v3:** the villain-profile control switches the
   grid onto the VPIP-filtered lattice (§3.3), and the Simulate button (§9.12) measures settings the
   lattice does not cover. **At barrier B1 that control's default was flipped on** (§3.4), so the
   page as it loads now scores against opponents playing the VPIP you set, not against random ones.
   What survives of this limitation is smaller and still real: the lattice is measured at five VPIP
   points and one discipline `q`, so away from those the page is interpolating (badged), and `q`
   itself is opinion with nothing calibrating it (limitation 18). Random opponents remain one click
   away at the `#v1point` button, and gate **I22 pins that path**, not the default — which is
   exactly why the flip could happen without weakening anything.
2. **Cell means hide within-cell variance.** `RUN2` spans `QJ97` down to `6432`. One number for a
   cell is a real simplification. The taxonomy is designed to minimize it — rundowns are split by
   gap *count* and gap *position*, and `RUN0` is split high/low in the wheel-aware orientation
   (§2.2), which is what keeps `JT98` out of the same cell as `A432` — but it remains the largest
   single source of error. The §8 adjustment reduces it for named hands and is labelled `estimate`
   wherever it appears.
   **Narrowed, not closed, at v3 P5:** the sub-cell top-N (§8.1) makes the within-cell spread
   *visible* — `RUN3 × DS` resolves into 15 `adjRaw` rungs and the list shows the top six and the
   floor, with each rung's combo share — so the reader can see how wide the cell they are being sold
   one number for actually is. What it does NOT do is give any of those rungs a tier, and gate I47
   measures why on every run: put the rungs into the percentile sort and 52 cells cross the
   aggressive line while 368 more are split onto both sides of it (§2.4). **The cell is still the
   finest unit this model resolves.** What changed is that the error this limitation names is now
   shown rather than only admitted.
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
5. **`N_eff` clamps at 7.** *(v2: was "saturates at 5". The Monte Carlo was extended to seven
   villains, which is what v1 listed here as the easy win, so the limitation moved rather than
   disappeared.)* The equity table now stops at seven, above almost everything the field model
   produces: the iso node's 5.9 at VPIP 90, which used to clamp on sight, is now read directly off
   measured data. The clamp still exists, and it is still reachable — a high-VPIP isolation spot
   over three or four limpers can push raw `N_eff` past 7, more easily with the straddle on, since
   the straddler joins the count at `c_blind(v)`. When it bites, the score is taken at N = 7 and the
   equity is read off the end of the measured curve, so the number is an extrapolation and the
   readout says so: the `N_eff` figure is marked and an `EXTRAPOLATED` badge carries the raw value
   in its tooltip. The page counts how many settings reach it and prints that census in Method →
   Known weaknesses, so the size of the limitation is a measured number rather than a claim.
   Depth and rake do not move `N_eff` at all; only the field does.
6. **The scoring constants are opinion.** `kappa`, `M_play`, `base_raise`, `R(p)`, `nu_min` and
   the tier widths are judgement calls informed by measurement, not derived from it. They live in
   one `constants` object precisely so a skeptic can change them and re-render.
7. **The 3-bet villain mix is hand-authored.** `VILLAIN_3BET` encodes one specific pool. Against a
   different pool it is simply wrong — which is why the mix is editable in the app, and why the
   blend is exact rather than a re-measurement.
8. **3-bet sizing: the price now moves with it; the 7-point premium still does not.** *(v3 P1
   halved this. It read "3-bet sizing is not modelled — every threshold at that node assumes a
   pot-sized 3-bet (~8.5bb to win ~20.5bb ⇒ 29% breakeven)".)* `constants.sizing` makes the size an
   axis and the **price** it implies is exact geometry: `s/(1+2s)`, with the opening size and the
   blinds cancelling out of it entirely (§7). What is still not modelled is the **premium**: the
   call floor sits 7 points above the price because a 3-bet pot is played out of position over
   three streets, and a bigger 3-bet buys a lower SPR — less postflop to be wrong about — so that
   premium ought to shrink as the sizing rises. Nothing here can say by how much, for limitation
   16's reason, so it is **held constant at its pot-sized calibration and flagged as such** in
   `constants.sizing.flag`, with gate I44 measuring the consequence rather than a coefficient being
   invented to hide it.
9. **Live Monte Carlo in the browser runs only when you press the button** *(v1's "none at all" no
   longer holds; §9.12)*. Every number the page loads with is precomputed and the browser does
   arithmetic — nothing computes on load and nothing computes behind your back. The one exception
   is the **Simulate** button, which appears only when the villain profile is on at a setting the
   shipped lattice does not cover, and which measures 3,075,000 trials (±0.32) in Web Workers
   spawned from a Blob URL, or on the main thread if a browser refuses them. That fallback is this
   limitation's own prescription built for real: chunked work, yielded to the event loop inside a
   24 ms frame budget at a 0.35 duty cycle, stopped while the tab is hidden. It is much slower,
   often 10× or more, and the page says so rather than quoting a bound it cannot hold to.
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

    **THE LESSON TRANSPOSED, AT v3 P4 — the EV MIX band is banded in frequency too.** §5.4's
    absolute-EV cut gives margins a **third unit**, bb, and a band in a third unit is exactly where
    this mistake gets made a second time. So it was not made: the EV band's half-width is `k ·
    payoff-se`, and **`k` is not free**. It is solved so that the band's combo-weighted mass at the
    default state equals `t4Band`'s own measured frequency mass — the `se` sets the unit, `t4Band`'s
    mass sets the multiplier, and no bb figure is chosen anywhere. The crossing is read by
    `scoreAtCut`, *the same function and the same `cumMid` convention the percentile cut itself is
    solved with*, so "equals" means here what it means everywhere else in the model. Measured: **k =
    2.453**, against a pooled t4 mass of **4.95 %** of combos.

    One thing this transposition surfaced that the frequency case did not. The EV distribution is a
    **step function with fat tie plateaus** — a checkdown payoff hands many cells identical equity,
    and one cell is read at several seats — so *no achievable band hits the target exactly*. The
    crossing is therefore the definition, and both sides of it ship: `evMassAtK` **4.05 %** strictly
    below k and `evMassNextStep` **5.33 %** at the next distinct z, with the 4.95 % target between
    them. That bracket is a **measurement of the shipped distribution**, not a tolerance somebody
    allowed, and gate I40 re-derives the whole block from scratch every run and `Object.is`-compares
    it against what shipped — because the failure that actually happens to a derived constant is
    that the data is regenerated and the constant is not.

    **AND P4's RED TEAM MEASURED WHAT THAT LAST SENTENCE IS WORTH** (`docs/refutations/P4.md`).
    Three refuters independently re-derived every figure above without the repository's own code —
    `k` 2.453, the target 4.9486 %, both bracket readings, `sePt` = 50/√100,000 — and all three
    reproduced bit for bit, so the arithmetic is what it says it is. All three then reported the
    same structural hole: under the house GREEN command `verify.mjs` calls `stampConstants`
    **before** the gates, so the block I40 compares was written moments earlier by the very function
    it re-runs, and the field-by-field comparison is a **self-comparison**. What actually holds the
    block is the **bracket** — every wrong derivation the refuters built (a doubled target, a halved
    one, the seat scope narrowed to RFI, T1 counted instead of t4) failed on it *after* a full
    restamp and rebuild — and `test/ev-cut.test.mjs`, which reads the model off disk unstamped. One
    row had neither: **`seUnit`**, whose `sePt`, `seBBMean` and `trials` could each be *typed* in
    place of their derivations and ship 60/60 green. Its anchor was true and enforced by nothing, so
    it is now asserted as the identity it claims to be — against `meta.trials.cell`, against
    `seOfTrials`, and against a second independent walk of the same 21 seats — in the gate and in
    the unit test. The tie plateau is also more literal than the paragraph above implies: the
    crossing is straddled by two rows carrying the *identical* z, so `scoreAtCut`'s interpolation
    multiplies a zero gap and `k` is that plateau's own z rounded **down** by 1.2e-5, which is
    exactly what drops the whole plateau out of the band and produces the 0.9-point undershoot the
    bracket publishes.
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
15. **Three engines now, one machine still — and one of the three facts remains unmeasurable.**
    *(Rewritten at v3 P1 from what `browsers.mjs` measures; gates **SF** and **SS**.)* §9.12 rests on
    three load-bearing browser facts: **F1** a classic Blob worker boots from a `file://` page,
    **F2** `localStorage` is reachable there, **F3** a hidden tab suspends `requestAnimationFrame`.
    Each is now measured **twice** — once against the raw browser and once against what the page
    *claims* about it — and the gate is the **agreement** between them, so a page that boots the
    worker and reports "fallback" fails, and so does one that degrades silently.

    | | Chromium 151.0.7922.34 | Firefox 153.0 | WebKit 26.5 |
    |---|---|---|---|
    | F1 worker boots from `file://` | yes, page reports `worker` | yes, page reports `worker` | yes, page reports `worker` |
    | F2 `localStorage` reachable | yes, page caches to it | yes, page caches to it | **yes** — falsifying the claim §9.12 used to repeat |
    | F3 hidden tab suspends rAF | **not measurable headless** | **not measurable headless** | **not measurable headless** |
    | F3's *consequence* | measured green | measured green | measured green |

    **Two caveats with teeth.** Playwright's WebKit build **is not Safari.app** — the harness prints
    that on every run, and this row is evidence about WebKit, not about the browser your reader
    uses. And F3's raw fact is unmeasurable headless by any mechanism available (`bringToFront`
    leaves `visibilityState` at `"visible"`), so the gate **asserts that it is unmeasurable** and
    measures the consequence instead: the fallback run pauses, freezes, does not finish while
    hidden, resumes, clears the flag, and the page carries the sentence it renders from. If a future
    Playwright ever makes the raw fact measurable, that row goes **red** and forces this limitation
    to be deleted rather than the gate to be widened.

    Everything else here is still **one machine**: the throughput figures, the 12× fallback ratio and
    the cache's survival across a restart are single-box readings and are quoted as such. Both
    harnesses run headless against Playwright-managed throwaway profiles and never an installed
    browser. `smoke.mjs` now runs — Playwright is the repository's one dev-time dependency
    (§9.11) — so the screenshot gate and the slider-morph budget are measured again rather than
    inherited from v1; the old JS-only 8 ms figure is kept only as an explicitly-labelled floor
    check that reports its own slack. **The layout-inclusive budget is now two rows, because one
    number cannot describe two states** *(P2 pre-stage; the account is in §3.4)*: with the villain
    profile **off** — the state S-E measured, and the one smoke now drives the page into through its
    own toggle — p95 is **1.6–2.0 ms against a 4.0 ms budget**; with it **on**, which is what the
    page loads into after B1, p95 is **10.5–10.8 ms against a 16 ms budget** measured on this page
    and pinned the same measured-plus-headroom way. Each row asserts the profile state it claims to
    have measured, so a toggle that stops working fails a row rather than quietly measuring the
    other state twice.

    **One thing the harness found that is worth recording, because it had been contaminating
    measurements silently.** The first-run tour auto-arms 400 ms after init and drives the very
    control under test — its per-step `setProfile()` cancels a running simulation — so both
    harnesses were measuring a moving target: `smoke.mjs` had removed the tour element ~50 ms after
    `__ready`, i.e. before it existed, and a 30-second animation then ran underneath the whole state
    sweep, both morph measurements and every screenshot. Both harnesses now suppress the tour
    through the page's own `sessionStorage` guard, and **the suppression is itself a gate row** in
    each, because a suppression that quietly stops working puts us back where we were while
    reporting green. A deliberate tour exercise — run it, assert zero page errors — would be a
    reasonable later addition; 30 seconds per variant is too slow for smoke as it stands.
16. **ρ's relevance decays with depth, and the deep end of the slider is where the measurement
    means least.** *(v3 P1, brief §5.5.)* The entire measurement layer is **all-in equity at
    showdown**: 100 % of stacks in, every hand, every street, to the river. That number is most
    applicable at 40 bb, where flop stack-offs are routine and the preflop decision really is close
    to an all-in decision. It is least applicable at 250 bb, where three streets of pot control mean
    the stacks usually never go in — so the deep end of the dial is exactly where the *measurement*
    stops describing the spot, while the model keeps quoting it with the same confidence.
    **`M_deep` is a scoring-layer patch over a measurement-layer relevance problem**, and naming it
    that way is the point: no constant fixes this, because the missing thing is not a coefficient
    but a street-by-street realization model. That is what the postflop/SPR work is for. It is also
    the hole under two flags this build ships: `rake.potScale` (how often a deep pot plays for
    stacks) and `sizing.premiumCalibratedAt` (how the 7-point premium moves with SPR) are both
    unanswerable for the same reason, and both are bounded by gates instead of being guessed.
    *Shipped verbatim as `constants.limitations[0].note` and rendered in the Method view — as of P5
    in Method → Known weaknesses, as the shipped string itself rather than a retyped copy of it, and
    this sentence and the shipped one are byte-compared by gate I41, so the page and this document
    cannot drift:* The measurement layer is all-in equity at showdown, so it describes a 40bb game
    well and a 250bb game poorly: the deep end of the dial is exactly where the measurement stops
    applying, and M_deep is a scoring-layer patch over a measurement-layer relevance problem that
    no constant can fix.
17. **A percentile cut cannot change how many hands you play — only which ones.** *(v3 P1, brief
    §5.1.)* Three of the four nodes cut a fixed percentile of the pool, so a dial that scales, or
    shifts, or re-weights every cell moves the *ordering* and not the *count*. This is why the rake
    slider is tier-inert (limitation 14, gate I31: 5 % rake moves all 27,675 scores and zero tiers),
    and it is why depth could not change your opening width at all until v3's `depthWidth` factor
    gave `widthFor` a depth term (§5.1). Painted width does wobble a point or two across a dial —
    that is cells crossing a fixed cut as the ordering re-sorts, which is granularity, not a trend.
    It also cuts the other way, and that is worth stating because it looks like a win: I43 measured
    the villain profile failing to move `TRASH × RB` into the raising range even against the
    tightest pool, *because* a delta shared across a band moves scores and not ranks.
    **The designated structural fix is an absolute-EV cut** — a rule of the form "play it when its
    EV is positive" rather than "play the best 28 %" — which is the one construction that can
    express *fewer hands are profitable here*. It is the strongest argument for that work being a
    structural repair rather than a feature, and its gate is written to prove the fix bites: in EV
    mode rake must **narrow** width at the percentile nodes, which is the deliberate opposite of
    what I31 asserts today.

    **THE FIX LANDED AT v3 P4, AND IT BITES — but this limitation does not come off the list, and
    the paragraph above is left standing verbatim because it is still true of the tier surface.**
    §5.4's absolute-EV cut ships as a second predicate computed beside the percentile cut, and gate
    I40 measured the consequence the paragraph above predicted: at **225 identical settings** a 5 %
    rake moves the score-path width **0 times** and the EV-mode width **177 times**, and over 900
    settings the EV-mode width narrows **22.83 % → 19.66 %** and widens at none of them. So "a rule
    of the form *play it when its EV is positive*" is no longer a designated fix; it is a shipped
    surface, and it does express *fewer hands are profitable here*. I31(a) is correspondingly
    **re-scoped to the score path** — its "must be a deliberate model change" clause was *invoked*
    rather than violated, and the re-scope is asserted rather than announced: I31 now measures the
    EV-mode set moving at the same preset that leaves every percentile tier alone.

    **Three things keep this on the limitations list anyway.** The EV surface is
    **display-only** — gate I34's quarantine means no EV number of any size can move a tier, and
    that is deliberate, not provisional, while limitation 18 stands. The payoff behind it is the
    checkdown stub, so every percentile-node reading is `supported:false` and badged. And the
    **grid still paints the percentile tiers**, so the width numbers on this page remain answers to
    "which hands". What has changed is that the model can now *also* answer "how many", in its own
    mode, with its own badge on it.

    Until the EV surface is a tier surface, this limitation stands, and the width numbers on this
    page are answers to "which hands", never to "how many".
    *Shipped verbatim as `constants.limitations[1].note` and rendered in the Method view — as of P5
    in Method → Known weaknesses, as the shipped string itself rather than a retyped copy of it, and
    this sentence and the shipped one are byte-compared by gate I42, so the page and this document
    cannot drift:* A percentile cut can change which hands you play but never how many, so every
    dial that scales or shifts every cell moves the ordering and not the count; the absolute-EV cut
    is the designated structural fix, and its gate is written to prove the fix bites.
18. **The decision layer remains unfalsified against money.** *(v3 P1, from spike S-C; V3-PLAN §3.5,
    §5.4.)* Everything in §§1–3 is measured. Everything from §5 on — realization, the score, the
    tier cuts, `q` = 0.85, the depth and rake curves — is **opinion that has never been checked
    against a result**. The pre-registered test that would check it (criteria **PC-0..PC-8**, written
    at Phase 0 before any EV number existed and stored verbatim in `scripts/gates/reserved.mjs`)
    **cannot be run**: PC-1 (hero's cards visible independently of the outcome), PC-2 (lawful
    provenance) and PC-3 (assignment) are unsatisfiable, because no lawful, hero-visible, assigned
    4-card PLO corpus exists at any volume. PC-0 is failure-closed — a criterion that cannot be
    evaluated counts as FAIL — so **the verdict is unpassable by construction, and the bar is
    recorded at full strength rather than lowered to what today's data could clear.** It comes alive
    unchanged the day such a corpus exists.

    **Updated at P5, where the gate went live and the verdict did not change.** This entry read "I46
    is parked" from P1 until P5, and the distinction that sentence was compressing is now made in
    two places rather than one. `model.calibration` is **stamped on every `verify.mjs` run**
    (`stampCalibration`, on the `constants.evCut` precedent: re-derived every time, never carried
    across, so a verdict cannot go stale while the EV surface under it is regenerated), it is
    budgeted by D6's fifth reserved sub-budget at 6.2 of 7 KB, and the Method view renders every row
    of it. Gate **I46 is live** and **green over a FAIL** — it asserts that the shipped verdict is
    the verdict the pre-registered bar gives, which today is FAIL, and it is armed against four
    fabricated `pass` blocks. Nothing in `I46_CRITERIA` moved; its digest `58a70f0cb95a44ed` is
    asserted by the gate and its text byte-compared against `docs/spikes/S-C.md` by a test. The
    catalog keeps the parking notice on the live entry under the name `verdictUnpassable`, precisely
    so that "the gate is enforced" can never be read as "S-C succeeded". **The §5.1 fixture-re-freeze
    ceremony was NOT exercised**: EV primacy never flipped, `freeze-tiers.mjs --force` was not run,
    and I22, I32 and the v3 default fixture all still reproduce byte-for-byte.

    **Two consequences, both structural.** The absolute-EV surface is display-only and stays
    `estimate`-badged everywhere; score-primary is permanent for v3, not by preference but because
    the flip is gated on a verdict that can only be stamped FAIL. And **no corpus size fixes this**:
    you cannot read the EV of an action nobody took, so the only design that satisfies the bar is a
    *prospective randomised A/B test on the marginal cells*, run by a player against their own play.
    That is the named successor experiment, and it is out of scope for v3.

    **The bar as written is weaker than the bar as meant, and that is worth stating wherever it is
    quoted.** The pre-registered sufficiency threshold counts *showdowns*; S-C's carry-forward
    finding is that it should count **hero rows**, because a datamined corpus can clear a
    showdown-counted bar at any volume while failing PC-1 outright — hero's cards are visible there
    only when the hand went to showdown, which is exactly the outcome-dependent visibility PC-1
    forbids. The harness therefore evaluates and reports **both readings** rather than picking one,
    and a test builds the datamined shape at volume (90 cells × 120 showdown rows, zero hero rows)
    to assert all three facts at once: the bar as written is met, the repaired bar is not, and PC-1
    refuses the corpus.

    One number the harness *can* produce today, because it needs no corpus: **PC-8 passes.** 890 of
    987 transposed cell pairs (**90.2 %**) have a shipped heads-up equity gap wider than 2 × the
    cell standard error, so where the score ordering and the EV ordering disagree, they disagree
    across real distance rather than inside the error bars. That is a finding to set beside S-C §5's
    "71 % of *adjacent* pairs sit inside the error bars", which it does not contradict and is often
    mistaken for: the transposed set is not the adjacent set.

    A calibration harness ships anyway, because PC-4's paired estimator is exactly the shape a
    **self-play consistency** check takes — the code is not wasted, only its input is missing. Its
    output is stamped `unit: 'potFrac'` / `moneyValidated: false` at every field a caller might read,
    and feeding it to the verdict machine fails PC-4 by name; a number that looks like a result is
    the one way this limitation could quietly stop being true. **P5 renders this limitation from
    shipped data in the Method view** (`model.calibration`), so the reason is on screen and not only
    in this document; it is stated here from P1 because it is true from P1. The rendered section
    carries the verdict banner, all eight criteria with their statuses, PC-8's numbers, the absent
    corpus and its reason, the self-play figures with `potFrac` and `moneyValidated: false` written
    on them, and — because an empty table reads as agreement — **the sentence saying the `disputed`
    list is empty for want of anything to fit against, not for want of a disagreement.** The
    prediction V3-PLAN §7.2 attached to this gate, *fitted q ≠ 0.85*, is therefore **untested**:
    neither falsified nor confirmed, which is a third outcome the plan did not have a slot for and
    the honest one to record.

19. **The squeeze / multiway 3-bet node is not modelled, and the two reasons it was cut are
    measurements rather than a preference.** *(v3 P5; V3-PLAN §4 item 11, which carries the plan's
    one conditional cut-line and its one permitted regeneration.)* The vs-3-bet node is **heads-up
    by construction** (§4): hero is scored against the 3-bettor alone, and a squeeze appears nowhere
    in this model as a node hero can act at — only as the vs-Raise `N_eff` formula's dampening of
    *somebody else's* call, 0.90 on cold callers and 0.80 on blinds. Closing that was work item 11,
    and it was the only item in v3 that required a new Monte Carlo stage (S3b), so the plan
    pre-registered a cut-line with two named reasons and left the decision to a measurement at P5.
    The reasons are quoted as written:

    > (i) its payload competes for lite's D6 bytes after item-5 additions; (ii) it is hand-authored
    > machinery for exactly the node the P3 solver models properly — building it late in the same
    > release that obsoletes it must clear a higher bar.

    **Reason (i) bites, and it bites at every level of D6 at once.** Measured after item 5's
    additions (`constants.skill` 948 B of its reserved 1,024, which is what forced the `meta` raise
    to 17 KB, and `constants.evCut` 1,141 B of 2,048 behind it), the payload has **2,917 B** free in
    `cells`, **4,117 B** free on the `core` reading that still faces the pre-raise 120 KB, and
    **6,360 B** free in `total` — the whole model, every reserved block included. Item 10 spent none
    of it, because the sub-cell rungs are enumerated in the browser. Against that, the **smallest
    payload an S3b stage could possibly ship** is one field per live cell of exactly the shape S3
    already ships — `eqVs3bet`'s four face-up components, measured three-way instead of heads-up —
    and that field costs **6,530 B** across the 123 live cells, 53.1 B each, measured on the emitted
    block rather than estimated. **It does not fit.** It overruns `cells` by 3,613 B, `core` by
    2,413 B, and it overruns the entire model's remaining budget by 170 B — so it would not fit even
    if every other block surrendered its headroom. And a one-caller field is not the multiway node
    it is named for: resolving the caller count the way the vs-Raise formula already distinguishes
    it costs **13,060 B** at L ∈ {1, 2} and **19,590 B** at L ∈ {1, 2, 3}, which is 6.7× the `cells`
    headroom and 3.1× the whole model's.

    **The reserved-raise idiom does not rescue it, and the reason is the one D9 already recorded.**
    Four blocks have been added to the shared core under that idiom — `baselineTiers`,
    `constants.solver`, `constants.skill`, `constants.evCut` — and each time the raise was reserved
    for the new block while `core` and `metaCore` kept facing the pre-raise ceilings, so no existing
    block gained a byte. That works because each was a genuinely new top-level block. Squeeze
    equities are per-cell measured data and belong in `cells`, the one block that has never had a
    reserved sub-budget because it *is* the core: raising it raises `core` with it, which is the
    silent raise the idiom exists to forbid. Hoisting the same numbers into a top-level
    `model.squeeze` block purely to qualify for a reserved raise would be shaping the payload around
    the gate instead of around the model — and this repository has already ruled on that move, at
    the D9 embedding decision: **choosing a precision to fit a rule is choosing the answer.**

    **Reason (ii) bites by halves, and the halves have to be separated to be honest about it.** The
    P3 baseline's solved tree **is** the 3-bet pot: five decision nodes over the pot-limit ladder 3
    / 9 / 27 / 81 bb, nine terminals, with `n2` the 3-bet itself (BB facing the 3 bb open — fold,
    call, or 3-bet to 9 bb), `n3` the 4-bet decision, and `n4`/`n5` the rest of the ladder, solved
    to an exact CFR+ equilibrium at two depths. So the half of item 11 the solver reaches, it
    reaches **better than hand-authoring could**: an equilibrium where item 11 would have shipped an
    authored range. The half it does not reach is the half that makes a squeeze a squeeze, and there
    the deferral is itself a measurement, not a schedule. `coverage` reports **3 of 24 (pos, node)
    rows covered**, the `3bet` row at **1 of 6** seats, and all 21 uncovered rows carry one reason —
    "baseline is HU". `SIXMAX`'s re-opening rule fails on leg (ii) structurally: `multiwayProbe`
    over 24 six-handed tuples gets `supported: true` on **0 of 144** requests, the six shares miss 1
    by up to **0.445**, and hero's share is **bit-identical across disjoint opponent sets** — no
    opponent's cell enters any payoff, so there is no multiway game there to be a fixed point of.

    Put together, building S3b now would author a multiway *scoring* layer for precisely the node
    whose multiway *payoff* this repository has measured as absent, while the k-way sampler that
    would supply that payoff is itself an S3b-class measurement nobody has written. It would also
    ship a node that the two surfaces v3 exists for cannot render: no vs-GTO column, because the
    baseline covers no multiway row, and no EV column, because the payoff accessor refuses every
    multiway request. A node that can only be painted in TIER mode, in the release whose thesis is
    the other two modes, is exactly the "higher bar" the plan asked for, and it is not cleared.

    **So the node is cut, and it moves to v3.1 with solver results in hand** — the release in which
    a measured k-way sampler satisfies leg (ii), the baseline covers seats beyond the blinds, and
    the squeeze can be *solved* rather than authored. Nothing was built for it here: no S3b stage,
    no gate I45, no field in the payload, and this entry is the whole of what P5 spent on it. The
    limitation this leaves standing is the one at the top of this entry, stated at its true size:
    **hero can 3-bet in this model only heads-up, and the multiway version of that decision is not
    approximated, badged or interpolated — it is absent.** The claim-scope rule from `SIXMAX`
    carries forward unchanged to whatever v3.1 builds: nothing multiway may be labelled GTO or
    equilibrium; heads-up is "GTO" and anything multiway is a "self-play fixed point".

### v2 list — shipped

Every item on the v1 wish list is now in the page: Monte Carlo to N = 7 · a stack-depth axis (§5.1)
· a rake model (§5.2) · VPIP-filtered villains instead of random ones (§3.3) · the frame-budget
harness, built for real as the Simulate button's main-thread fallback (§9.12). A straddle toggle
(§5.3) was added along the way and was not on the list.

**One item shipped and was then cut: the expand-in-place sub-bucket UI.** It worked, and the layer
under it was measured, but a bucket verdict was always a hypothetical about a grid that was not
being painted — see §2.4 for what it cost and what went with it.

**One item did not ship in v2: a 3-bet sizing control.** *(Half-closed in v3 P1 — the price is now
an axis and the premium is not; see limitation 8.)* The 3-bet *mix* was editable in v2; the
*sizing* was not.

The honest v2.1 list is now short and mostly about coverage rather than model. **Two items came off
it at v3 P1 and one got worse.** Off: Firefox and WebKit now run the worker path and the
`localStorage` probe, as gates SF and SS, and one of the facts that was being repeated turned out to
be false (limitation 15). Off: the 3-bet *sizing* is now an axis (limitation 8). Worse, or rather
now stated at its true size: `q` is opinion with nothing calibrating it, and so is everything else
in the decision layer — limitation 18 is what that sentence grew into once S-C established that the
test which would settle it cannot be run at all. Unchanged: the cell is the finest unit the model
resolves, so there is nothing finer than a cell to ask about (§2.4); and 5-card PLO and
street-by-street postflop realization remain out of scope by decision rather than by omission
(V2-PLAN §0).

---

## 11. Invariants

Forty-five model invariants, asserted by `scripts/verify.mjs` over v ∈ {25, 40, 55, 70, 90} × 6
positions × 4 nodes — I22, the regression gate, sweeps every integer v from 25 to 90 instead,
I32 sweeps that same VPIP axis across all twelve depth × rake × straddle lanes at once,
I24/I25 assert the shape of the v2 build-time measurements over the emitted data itself,
I23/I27/I28 sweep the depth axis on top of the same grid, I26/I29/I30/I31 sweep the straddle
toggle and the rake slider, I41–I44 sweep the four v3 axes, and D10/D11 read the built artifacts
off disk, I35 solves the heads-up tree on BOTH payoff routes, I36/D9 read P3's equilibrium
baseline off `data/equilibrium.json` and the block it cuts into the shared core, I38/I37 walk
P4's pool-skill dial from the lobby to the lattice floor and account for the divergence along it,
and I34/I39/I40 quarantine P4's absolute-EV cut, check its arithmetic and measure what it moves,
I47 slices P5's sub-cell top-N out of `src/shell.html` and re-measures §2.4's autopsy, and I46
judges the primacy verdict against the criteria pre-registered at Phase 0 —
**62 gates in total** with the rest of the D and V families and the benchmark gate. The counts are derived from `EXPECTED_IDS` in
`scripts/gates/index.mjs`, which is the frozen report order and is written out rather than
generated, precisely so that a family quietly disappearing produces a mismatch instead of a smaller
report that agrees with itself.

The numbering has one deliberate gap and no accidental ones. I1–I16, I18–I33, I34, I35–I44, I46 and
I47 plus D9/D10/D11 are live with **I17 retired**
(it went with the sub-bucket layer it asserted, §2.4); **I45 is reserved,
not missing** — its id and its claim were written down in `scripts/gates/reserved.mjs` ahead of the
feature, so a later phase finds its gate id already spoken for with the claim already stated instead
of inventing one to fit the code it just wrote. A gate id chosen after the feature is a gate written
to pass. (I45 gates the squeeze stage, which was **cut at P5** on two measurements rather than
deferred by preference — limitation 19 — so the gate stands unchanged for the day the stage is
built.) The registry guards that boundary in both directions at import time: a reserved id leaking
into the enforced set throws, and so does a live gate the registry stopped emitting.

**I46 went live at P5, and the one thing that must not be read into that is that its bar was met.**
Phase 0 recorded I46 as *parked* — reserved AND unpassable by construction, because its bar (the
pre-registered primacy criteria PC-0..PC-8) is fixed and cannot be met, for reasons recorded with
it. Those reasons have not changed and the bar has not moved: `I46_CRITERIA` is byte-compared
against `docs/spikes/S-C.md` in `test/gates-reserved.test.mjs`, its digest `58a70f0cb95a44ed` is
asserted by the gate, and PC-1/PC-2/PC-3 are still unevaluable. **What went live is the gate; what
stays FAIL by construction is the verdict**, and the catalog says so in two separate fields —
`status: 'live'` and `verdictUnpassable: true`, the second carrying `blockedBy`, `blockedReason` and
`consequence` exactly as it did while parked. The promotion was owed: V3-PLAN §11 refuses to close a
phase whose shipped feature has no gate id in `verify.mjs`'s output, and `model.calibration` is
shipped — stamped by the runner, budgeted by D6, rendered by the Method view and read by
`evPrimary`. A gate that passes on an honest FAIL is not a gate written to pass; the six clauses
assert that the verdict *agrees with the bar*, and clause (d) is armed against four fabricated
`pass` blocks including the shipped one with its verdict re-stamped.

**Any violation fails the build** and nothing is emitted. The gate results are stamped into
`model.gates` and rendered by the Method view, so the page shows the gates *this* dataset passed —
as, now, are the scoring constants themselves (§5.1).

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
| ~~I17~~ | **Retired with the sub-bucket layer (§2.4).** It asserted the dual-key partition — Σ sub-bucket combos = cell combos for all 145 cells — and the geometric-mean reconstruction of a cell's `mplay` from its buckets'. There are no buckets to partition, and **D1** still pins Σ cells = 270,725. The number is not reused. |
| I18 | Geometry: the quantized mosaic column widths sum to exactly 530 px and each is within 1 px of exact proportionality. |
| I19 | **T2 is empty at v = 25** for every (position, node ∈ {RFI, vs-Limps, vs-Raise}) — the exploit-tier definition holds by construction. |
| I20 | Cross-engine agreement: `eval5.mjs` and the independently written `equity-ref.mjs` agree within ±0.6 pt on ten benchmark hands. |
| I21 | **The painted range widens as the table loosens.** `aggrCombos / 270,725` — not `targetWidth` — is wider at VPIP 90 than at VPIP 25 at all 15 (node, position) pairs: rfi UTG 14.1→16.6, HJ 16.5→21.4, CO 24.2→30.8, BTN 40.9→51.3, SB 28.3→36.4; limps HJ 16.9→27.0, CO 23.9→36.9, BTN 39.1→48.5, SB 27.9→44.8, BB 27.9→45.9; raise HJ 6.6→12.4, CO 6.1→11.2, BTN 6.1→12.4, SB 6.1→11.3, BB 6.2→10.0. Asserted as endpoints plus a bounded local dip, **not** pointwise: pointwise is unsatisfiable for the granularity reason I16 documents — one cell crossing the percentile cut is a visible step. The dip allowance is 4.0 points, half the largest single cell (8.1%); the worst measured drawdown is 3.2 points at rfi/BTN, v = 0.73. This gate exists because nothing tested the painted number before, which is how the range could collapse to half its width at the iso nodes without any gate firing. |

| I22 | **v1 reproduction.** At the v1 operating point — 100 bb deep, rake 0, straddle off, random villains, two limpers, a CO raiser, the default 3-bet mix — the pipeline paints the tiers v1 painted, exactly: all 123 non-empty cells at all 1,386 (node, position, integer VPIP ∈ [25, 90]) settings, 170,478 tiers, compared character for character against `data/tiers-v1.fixture.txt` (27 KB, delta-encoded down the VPIP axis because adjacent steps differ by 0.78 cells on average — the same fact I16 asserts). Both halves of each decision are frozen, the action tier *and* the MIX overlay sitting on it, so a change that swaps a CALL for a MIX-over-CALL is caught rather than shrugged at. On failure the gate reports how many settings and how many cell tiers moved, and names the first four. The gate costs ~0.3 s of pure policy math and no Monte Carlo, which is what makes it affordable to keep forever. **Scoped to full-precision data:** on a `--fast` dataset the tier half is explicitly *not asserted* and says so in its own detail line, because 10k-trial equities are a different measurement — 7.4% of tiers move on noise alone, which is not the policy drift this gate exists to catch. What it still asserts on `--fast` data is the structural half: the cell set and the (node, position, VPIP) domain are unchanged. |
| I24 | **The cooler rate has the shape it measured.** `cooler` is P(the hand loses the pot outright **given** it reached showdown with a set or better), at three opponents, chops not counted as losses (§3.2). Asserted: the three-step *band* ladder, combo-weighted — AA 0.3184 < big pairs 0.3563 < small pairs 0.4386, each step ≥ 0.03; `cooler(SSA) ≤ cooler(SS) + 0.01` in all 18 rows carrying both columns (18/18 hold strictly today, and the gate says so, but the three thinnest margins are 0.003–0.009 against a difference SE of ~0.004, so a strict gate would be a coin flip on `RUN1_BOTTOM` at the next regeneration); `DBLPAIR_SMALL×RB` (2233r) in the top 8 of 123 cells and `AA_BIGPAIR×DS` in the bottom 8 — measured ranks 5 and 4, pinned as rank bounds so the anchors survive a shift of the whole table; every value in [0, 1] and inside the measured envelope (cells 0.257–0.501), which is a guard against a changed *definition* rather than against noise; and `constants.coolerBarMeasured` rebuilding from the shipped cells to 0.00006 of a 0.002 rounding tolerance. **What it does not assert, deliberately:** V2-PLAN §2.1's five-step pair ladder TT > JJ > QQ > KK > AA is not expressible in this taxonomy (`rowOf` splits pairs at J), and the ladder is not even monotone per *row* inside a band — `AA_SMALLPAIR` 0.3453 sits above `BIGPAIR_CONN` 0.3216. Separating the pair ranks is new rows, not a new measurement. |
| I25 | **The villain-VPIP lattice has the shape it measured, not the shape that was predicted.** §2.3 wrote three expected shapes before the measurement; two survived and one did not, and the gate is written to the data (§3.3). Asserted: at v = 90 the filtered pool converges on the random baseline without equalling it — mean absolute delta 0.81 pt over 123 cells × 7 N and worst cell 3.6 pt, pinned at ≤ 1.2 and ≤ 5.0, so a "v = 90 ≈ random" tolerance under ~4 pt would have failed; mean absolute delta falling monotonically along the lattice (4.19 / 3.10 / 2.40 / 1.76 / 0.81 pt at v = 25 / 40 / 55 / 70 / 90); at v = 25 the six worst cells at N = 1, 3 and 5 all lying in rows {`BROADWAY_RUN`, `RUN0_HIGH`} with `BROADWAY_RUN×RB` ≤ −15 at N=1 and `RUN0_HIGH×DS` ≤ −8 at N=3 — *rank overlap*, not weakness; the six best all lying in {`RUN0_LOW`, `RUN1_TOPMID`, `RUN1_BOTTOM`}, every `RUN0_LOW` cell gaining at every N, and `RUN0_LOW×SSA` ≥ +5 at N=1 and N=3; and the combo-weighted mean delta negative at every lattice point, which is the positive form of the I4/I5 scope decision. **What it does not assert, deliberately:** §2.3's prediction that junk loses most. It is false — `TRASH×RB` *gains* multiway (+2.7 at N=3) — and the gate reports that measurement in its detail line instead of asserting the prediction. |
| I23 | **The depth axis moves the grid in the direction it claims to** (§5.1), swept over d = 40 / 60 / 100 / 150 / 200 / 250 bb at all 105 (node, position, VPIP) settings. Asserted: **(a)** `AA_DANGLER×RB`, the AA72r class, never gains a tier as stacks deepen (0 violations, on this grid and on a 5 bb one) and gains one at 40 bb at ≥ 4 settings (measured 8, all at `raise/BTN` and `raise/SB`); **(b)** in **score rank**, not tier — a tier here is a percentile cut, not a property of a cell — `BROADWAY_RUN×DS` loses no rank as depth rises and `RUN0_HIGH×DS` / `×SS` finish better at 250 than at 40 at ≥ 60 of 75 settings (measured 75 and 70); **(c)** the low-rundown falsification, asserted positively so it cannot be quietly reverted: `RUN0_LOW×DS` ranks *worse* at 250 than at 40 at strictly more settings than it ranks better (measured 49 against 9), and μ-attributable demotions at 200 bb exist (92 over 7 cells) with **none of them a big pair**; **(d)** painted width drifts at most **3.65** points from its 100 bb value across the whole range (measured 3.164835 at `rfi/BTN` VPIP 70, 40 bb) and never falls below **10.70 %** (measured 12.612060 % at `rfi/UTG` VPIP 25). Both allowances were **re-pinned at P5** (§11.1) from I21's borrowed 4.0 and I12's borrowed 10 %, neither of which had ever been divided by this clause's own measurement; **(e)** I7, I8, I9, I13 and I19 all still hold at 40 and 250 bb; **(f)** the positional bases keep their seat order at 40 / 100 / 250 and their spread widens with depth — this is the clause that catches `|β| ≥ 1`, where the exponent goes negative and the seats invert, which nothing else in the pipeline notices. **What it does not assert:** V2-PLAN §3.1's "big-pair rows with pair rank J/T demoted at 200 bb via the μ·cooler term". It is false for the J half and the reason is the same taxonomy split that broke §2.1's five-step cooler ladder — `rowOf` splits pairs at J, the big-pair band's `cooler` is 0.3563 which is *below* the bar, so μ promotes 21 of its 23 cells; its 46 measured demotions are all λ's. The gate reports those figures in its detail line instead. |
| I27 | **I16's continuity, re-run at both ends of the depth slider.** Every VPIP step at 40 bb and at 250 bb changes at most 3 % of combos or at most 5 of 145 cells, and the three deliberate `N_eff = 3.0` discontinuities (raise/HJ @ 45, raise/CO @ 54, raise/BTN @ 70) are at the same VPIP at both depths. No widening was needed: the worst non-cliff step is 0 cells over the allowance at both ends. That last fact is the κ(N) / λ(d) separation as something testable — a field effect does not move when the stacks move. |
| I28 | **I21's painted widening, re-run at both ends of the depth slider.** The painted range is wider at VPIP 90 than at 25 at all 15 (node, position) pairs at 40 bb and at 250 bb. The dip allowance is **6.30 points, above I21's 4.0**, on a measurement rather than an assumption: I21 sized 4.0 as half the largest single cell, against a worst drawdown of 3.2 points at 100 bb, but at 250 bb the worst event is a simultaneous *three*-cell exchange — `RUN3_DANGLER×SS` (4.79 % of combos) in, `ACE_JUNK×SS` (3.16 %) and `ACE_JUNK×FLAW` (2.29 %) out, net **5.450549** points at rfi/BTN VPIP 82. Three cells sits inside I16's own 5-cell allowance and the whole event is smaller than the largest single cell (`TRASH×SS`, 11.4 %), so it is the granularity both I16 and I21 already document, not a trend. At 40 bb the worst dip is 2.1 points, better than at the operating depth. **Re-pinned at P5** from 6.5 (§11.1): the measurement did not move, the margin did — the old pin claimed "~19 % headroom, the same margin I21 runs at" while running at +19.3 % against I21's own +25.0 %. |
| I26 | **The straddle moves the grid the way §3.3 says, and the composition case it flagged is decided by measurement** (§5.3), over 5 RFI seats × 5 VPIP × 6 depths. Asserted: **(a)** the painted **opening** range tightens at every seat and every setting — 150/150 at RFI and 150/150 at the iso node — which is where **V2-PLAN §7.2's "BTN keeps its 0.45 base" is falsified**: pinned, the button paints *wider* at 7 of 30 settings (up to +2.49 points) and its mean ν falls at 8, so `straddle.seatPinned` ships empty; **(b)** the painted range gets nuttier (148/150 at RFI, 150/150 iso, worst fall 0.13 points); **(c)** the composition, isolated at matched width — field-only +0.286 pts with 0 of 150 going the other way, depth-only −0.144 with 76 down, both +0.183 with 20 down: **the field wins**, keeping 64% of its own effect, even though λ(d/2) − λ(d) = −0.189 is 2–6× larger than Δκ = 0.13·cBlind(v) on the ν coefficient. What completes the field's margin is the *measurement* — the multiway realization slope and ρ read further up its N curve; **(e)** I6/I7/I8/I9/I10/I13/I19 all hold straddled at 40/100/250 bb; **(f)** the transform is exactly the transform (N_eff gains `cBlind(v)`, `dEff = clamp(d/2)`, `widthFor` scales by `seatWidthFactor`, and the price does not move at rake 0). **What it does not assert, deliberately:** the vs-Raise node. `w3bet` has no seat base, so measured it goes both ways (47 tighter / 77 looser / 26 unchanged) and the gate reports that instead of pretending otherwise. |
| I29 | **I16's continuity, re-run with the straddle ON** at 40 / 100 / 250 bb (effective 40 / 50 / 125). Every VPIP step changes at most 3% of combos or at most 5 of 145 cells; worst non-cliff step is 0 cells at all three depths, so no widening was needed. The interesting half is the mirror of I27: depth leaves the `N_eff = 3.0` discontinuities exactly where they are, and the **straddle drags every one of them forward** — raise/HJ 45 → 34, raise/CO 54 → 39, raise/BTN 70 → 47 — and adds a fifth at raise/SB 70 that the unstraddled table never reaches. Asserted structurally rather than as a pinned list: `N_eff` is strictly larger straddled at all 990 (node, seat, VPIP) settings, so a crossing of 3.0 can only come earlier. Between them I27 and I29 make the κ(N) / λ(d) separation testable from both sides. |
| I30 | **I21's painted widening, re-run with the straddle ON** at 40 / 100 / 250 bb. Wider at VPIP 90 than at 25 at all 15 (node, position) pairs. **No widening of I21's own 4.0-point dip allowance was needed** — unlike I28's — because a narrower target width has fewer cells straddling the cut: the straddled worst dip is 2.858990 points against the 3.16 the unstraddled model runs at. **Re-pinned at P5 to 3.30** (§11.1), *below* I21's 4.0: the borrowed number ran at +39.9 % headroom, the loosest in the repository, and the re-pin turns "no widening needed" from a sentence beside the number into a claim the number itself makes. The painted **floor** is its own, at 8 % rather than I12's 10 %: the narrowest straddled range is 8.964078 % at `rfi/UTG` VPIP **27** at 40 bb, which is the seat transform doing its job (the target itself fell 23 %) and not the nut-gate collapse I12 guards against. That floor **stands** at P5 — it was already tighter (−10.8 %) than the re-pin idiom, and a re-pin may tighten and never widen. (The prose used to say VPIP 25; the gate has always printed the true setting from the live sweep, and P5 corrected the sentence to match it.) |
| I31 | **The rake does what §3.2's model can do, and is asserted not to do what it cannot** (§5.2). **(a)** The flat haircut on ρ is **tier-inert *on the score path* at the three percentile nodes, by construction**: 0 of 27,675 tiers move at the 5% preset, all 27,675 scores do, and every score ratio equals (1 − rakeFrac) to within 2 ulp. Asserted so that turning rake into a non-uniform haircut has to be a deliberate model change. **RE-SCOPED TO THE SCORE PATH AT v3 P4** (V3-PLAN §7.1): the clause's own "must be a deliberate model change" is being *invoked*, not violated — §3.4's absolute-EV cut is that change, and the qualifier is **measured rather than asserted**. At 75 of the same settings the EV-mode aggressive set moves under the same 5% preset **59 times** and narrows or holds at all 75, so "score path" names a real boundary between two cuts rather than softening this one. I40 carries the EV side's claims. **(b)** Where the threshold is absolute it bites: the vs-3-bet continue range narrows monotonically in `rakePct` on the **action** tier, 45 → 41 cells at UTG and 49 → 44 at CO across 0–6%. **(c)** The arithmetic is exact — `price = breakeven / (1 − r)`, the 7-point premium over it is invariant, `rakeFrac = min(pct, cap / (potBB·unit))`, and a straddle doubles the unit the cap is measured against so the same 3bb cap takes 2.5% instead of 5%. |
| I32 | **v2 reproduction, over the whole environment surface** (V3-PLAN §0.4, §5.1). I22 pins one point; I32 pins the surface that point sits in, and it was frozen **before any v3 code existed**. The sweep is 21 legal (position, node) pairs × every integer VPIP ∈ [25, 90] × depth {40, 100, 250} bb × rake {0, 5%} × straddle {off, on} × villain profile OFF — 12 environment lanes, 16,632 settings, 123 cells, **2,045,736 tiers** — compared character for character against `data/tiers-v2.fixture.txt` (469 KB, delta-encoded down the VPIP axis inside each (lane, node, position) block, exactly as I22's fixture is). The claim is the *legacy lane*: with every v3 axis at its legacy setting — EV mode off, vs-GTO off, skill dial neutral, 3-bet sizing at pot, profile OFF — the pipeline paints these tiers. **Why the surface and not the point:** every v3 mechanism will be read by code already carrying a depth, a rake and a straddle, so the leak I22 cannot see is a memo key that forgot a new axis and hands back another environment's answer on the raked/shallow/straddled path — which is the path the page actually opens on. Demonstrated rather than asserted, in `test/tier-fixture-v2.test.mjs`: a 10% move in `depth.lambda` and a 3% move in `straddle.seat` each leave the v1 operating point *exactly* where it was (I22 stays green through both) and each move the v2 surface. **Three failure kinds, reported separately:** tier drift, named per lane; structural drift of the cell set or the (lane, node, position, VPIP) domain; and **lane drift** — the recompute deliberately runs on the *frozen* lanes, so a moved `rake.preset` or `rake.capBB` produces zero tier diffs and has to be its own red or it would be no red at all. **Succession, proven rather than assumed:** lane `d100/r0/s0` *is* the v1 operating point (checked by `envOf` object identity), and the gate's third clause diffs `data/tiers-v1.fixture.txt` against that lane artefact-to-artefact, with no pipeline in the middle, so it holds even on a day the pipeline is broken. I22 and I32 therefore run side by side and **retire together, never separately** — only at a calibration-forced re-freeze (§5.1 of the v3 plan). ~3.5 s of pure policy math, no Monte Carlo. **Scoped to full-precision data** on the same terms as I22: on a `--fast` dataset the tier half is not asserted and says so; the structural half and the v1 containment, neither of which depends on trial count, still are. |
| I33 | **The payoff interface freeze, as amended** (V3-PLAN §2 and its `Amended (P2 pre-stage)` block). `payoff(cells, potSize, spr, opts)` is frozen at **four arguments and six return keys** — `{ev, se, source, supported, potMult, invShare}` — and the freeze is a *test*, not a doc: every clause below is armed against a fabricated violator and shown to fire. The stub is the **zero-sum projection of the shipped checkdown measurement**, `0.5 + (eq_A[0] − eq_B[0])/200` — §2's literal "return shipped `eq[N]`" cannot pass §2's own conservation clause, and the projection is the only form built from shipped numbers alone that still conserves (exactly, to the last bit, over all **15,006 ordered heads-up pairs**). **(a)** arity, key names, key ORDER, types, the `source` enum, `ev ∈ [0,1]` and determinism over 30 named request shapes and ~90,000 returns, plus one anchor recomputed straight from `model.cells` — and, since the P2 red team (`docs/refutations/P2.md`), the pot's **physical ceiling**: `potMult ≤ 1 + 2·spr`, because the pot at the node plus both stacks is all the money there is. Only the floor was asserted before, and three refuters shipped a final pot **fifty times both stacks** past every gate and every test while three docstrings described the bound they had just broken. It is not a tolerance — the 1 and the 2 are the game's — and it is skipped where `spr` is not a depth, since those requests are (a)'s out-of-domain business. **(b)** conservation as an identity where §2 asked for 1 ± 2·se. **(c)** the spr→0 identity, plus the amended **pot geometry** half: an empty effective stack cannot move the pot, so `potMult === 1` and `invShare === 0` at spr 0 for *any* source. **(d)** `se > 0` always, derived from the trial count that actually ran (`seOfTrials(100,000)/100` at p = 0.5), `Infinity` where no trial backs the number, never typed. **(e)** a filename-scoped grep gate: CFR, the EV cut and the UI consume payoffs only through this accessor. **(f)** page-side, no caller renders a `supported:false` ev without the badge. **THE THREE AMENDMENTS, each measured by spike S-B and each carrying its numbers.** **(i)** `potMult` = E[final pot]/potSize and `invShare` = E[hero's *post-node* investment]/E[final pot] exist because `EVbb = ev·finalPot − invested` cannot be computed from `ev` alone: S-B measured E[F]/potSize at **1.603–11.865** and hero's share of E[F] at **0.199–0.730** over 300 points, so the pot term is otherwise wrong by up to an order of magnitude. Under checkdown both are **identities, asserted by `Object.is`**: no betting after the decision node means the final pot *is* the pot at the node, so `potMult === 1` and `invShare === 0` — **zero new constants**. The caller owes `finalPot = potMult·potSize`, `invested = heroPre + invShare·finalPot`, where `heroPre` (hero's own contribution to `potSize`) is caller-known because the caller built the node; S-B's published `invShare` bundles that pre-node term via REF3's `c0 = c1 = 0.5` **normalisation** rather than a measurement, and `total = heroPre/finalPot + invShare` converts back exactly. The arity stays four; `opts` is the door. **(ii)** `opts.ip` is in **every** payoff memo key, beside `cells`, `potSize`, `spr`, `opts.seed` and the model hash. S-B measured `ev(A,B,ip) ≠ ev(A,B,¬ip)` **by up to 43 pt** while `ev(A,B,ip) + ev(B,A,¬ip) = 1` holds exactly, so a keyless memo is wrong by more than the entire error budget (the Grade A edge is 2.5 pt) and wrong *silently* — the `envKey` docstring's trap in a new place. `payoff.mjs` has no memo by design, so clause **(g)** is a contract clause with a detector: a comment-stripped text scan (the header is a thousand words *about* memo keys and would otherwise clear the clause by discussing it) over `scripts/` and `src/` on its own memo scope, plus the page's `@payoff-page` block by name, armed against a keyless memoizing wrapper and cleared by a keyed one, with a dynamic aliasing probe beside it whose own blind spot (a memo that clones its value) is stated in the detail line. **(iii)** `supported:false`'s real domain is **card-removal degeneracy**, not multiway: `AA_DANGLER|RB` × `AA_BIGPAIR|DS` is degenerate on **12.56%** of street evaluations (mean 0.73% over 50 pairs, 4/50 over 1%), and S-A independently found **43 structurally undealable pairs**, `AA_*` × `A_BLOCKED`, combo mass 3.6e-5. The failure mode is **silent** — S-B's first implementation collapsed every AA-vs-AA pair to a checkdown with no error raised — so clause **(h)** requires any source evaluating against *dealt boards* to return `supported:false` on such a request (with no mass field in the six keys, that is what "flagged" means), never a silent collapse. The stub deals nothing and is **exempt by construction** — and since P3's B2 pre-stage that exemption is keyed on the accessor's `route` tag rather than on the shipped `source` datum, because the measured pairwise matrix *is* `source:'checkdown'` and would otherwise have inherited an exemption written for a source that deals no cards. Checked rather than assumed over all **506** ordered degenerate pairs (504 before B2: the matrix measured `A_BLOCKED|RB` × `A_BLOCKED|SSA` as structurally undealable, `A_BLOCKED` being the taxonomy's "Trip/quad aces", so the predicate is now an **ace-floor sum ≥ 4** rather than a family list). **The monotonicity clause was written to be falsified, and it was — so it is rewritten to the measurement, never deleted and never widened.** S-B: inversions on **1.7% of pairs at spr 1, 8.1% at spr 4, 15.9% IP / 20.5% OOP at spr 10**, worst case **9.1 pt less** checkdown equity for **20.0 pt more** ev. **Three** assertions, split by **route** since B2 rather than by `source`: the `projection` route must show **zero** inversions (the stub is strictly increasing in hero's `eq[0]` by construction — this is what catches the stub quietly ceasing to be the stub); the `matrix` route must show **more than zero**, because a measured pairwise checkdown is *not* separable and zero would mean it had become so — measured **472 of 976 steps** (123 cells × spr {0,1,4,13} × ip {off,on}) against `AA_BIGPAIR|RB`, worst 0.2805, with the count reported and bounded by no tolerance; and **any non-checkdown source at spr ≥ 4 must show inversions > 0**, because realization is precisely what checkdown equity does not measure. **Zero inversions from a source claiming to model realization is the new failure.** No upper bound is asserted and spr 1's 1.7% is not a floor — the band is *reported*, never used as a tolerance. **AND SINCE P3'S B2 PRE-STAGE EVERY CLAUSE RUNS ON A SECOND ROUTE — the measured pairwise checkdown matrix, which is the source the solver now consumes** (V3-PLAN §2's `Measured (P3 B2)` block, §3.3's `Adjudicated (P3 launch)` block). `makeMatrixPayoff(model, matrices)` serves `scripts/lib/checkdown-matrix.mjs` — S-A's construction, **400,000 shared boards** under two NAMED seeds, one draw per cell per board with a sit-out on collision, diagonals exactly 0.5, off-diagonals stored once and mirrored — inside the same six keys, the same arity of four and the same `source:'checkdown'`, because it *is* a checkdown. **That last identity is the trap:** three clauses keyed their exemptions on that string, so without a `route` tag the matrix would have cleared **(c)**, **(h)** and the monotonicity clause *vacuously* instead of firing them. The tag is a function property beside `modelHash` (never a seventh return key, never a fifth argument), an absent tag reads as `projection` so forgetting it fails closed, and the tag itself is **armed** — the matrix relabelled `projection` is caught on its 472 inversions and silently re-exempted from (h), the projection relabelled `matrix` is caught for reproducing the equity order exactly. **(c) is rewritten to the measurement:** a pairwise checkdown source is compared to the shipped column by its **q-weighted marginal**, not by equality, because the shipped number conditions villain on hero's cards being dead and the marginal does not — the residual **is** the card-removal residual. Reported rather than asserted: mean **−0.094** pt / p95 **0.542** / max **0.892** (seed A), **−0.073 / 0.541 / 0.784** (seed B), against S-A's **−0.112 / 0.577 / 0.827** at the same 400,000 boards. What *is* asserted is the **sign pattern** — the four ace-holding families read **−0.417** pt against **−0.032** for the other 103 — and **conservation** at 50 within the `n²·EPSILON` accumulation bound; armed deterministically against a source that reproduces the column exactly and against one whose residual carries the same band with no family structure. **(h) gets its first live case:** **43 unordered / 86 ordered** pairs come back `supported:false` carrying the stored 0.5 (which conserves bit-exactly) and `se = Infinity` at n = 0, the expected set taken from the measurement's own record rather than typed, every member asking the deck for five or six aces — while the **420 ordered** `AA_*` × `AA_*` pairs are **dealable** and stay supported with a **2.21×** larger `se` from their own smaller sample (25,145 samples against 117,363). *That* is degeneracy surfaced when the pair is dealable: the cost lands in the error bar, not in a false flag. The projection half is pure arithmetic over the shipped equity ladders and costs ~50 ms; **the matrix pair is a generated, committed ARTIFACT** — `data/checkdown-matrix.json`, 307 KB of integer trial counts from which `E = (wins2/2)/cnt` reconstructs bit-identically — written once by `scripts/generate-checkdown-matrix.mjs` (~21 s wall, both seeds in parallel) and **read** here in **3 ms**, timed under the family's own setup label. Building it inside verify would put ~40 s on a 41.9 s soft wall, which is why V3-PLAN §0.4's identity leg (b) applies: a new mechanism entering as a new artifact, in the open. One extra clause guards it every run — **(artifact)**: the seeds and board count match the code, the keys match the model's live set, the recorded `generatorHash` (sha256 over `checkdown-matrix.mjs` + the generator) equals the live hash so a **stale** artifact is caught on the run that made it stale, the `contentHash` recomputes, and every triangle entry satisfies `0 ≤ wins2 ≤ 2·cnt`; armed against a tampered copy three ways (a flipped trial count, a flipped hash byte, a moved board count). The stronger claim — that the file **rebuilds byte-for-byte** from its own recorded inputs — is `node scripts/generate-checkdown-matrix.mjs --check`, deliberately **outside** verify because it costs the ~40 s the artifact exists to avoid, and part of the milestone's green definition at its close-out. |
| D7 | **The payload ceiling** (a data gate, listed here with its siblings). `model.json` as emitted — the exact minified byte string written to disk — against V2-PLAN §2.5's 220 KB budget: measured **118,006 B = 115.2 KB, 48% headroom** after the sub-bucket cut (§2.4) and v3 P1's constants, against 187,859 B = 183.5 KB before the cut. The ceiling is read on the minified basis because the plan states it in the same sentence as "`model.json` is 105 KB today", which is the minified v1 file, and because the literal pretty-printed reading is unsatisfiable by the plan's own escape hatch (§9.10). The pretty-printed figure, 173.7 KB, is printed in the gate's detail line and recorded, not asserted. D6 carries the tighter per-block budgets that actually catch a creeping payload; D7 is the published contract and is deliberately slack against it. |
| D8 | **The frozen villain ordering is a real permutation, and it is *this* model's** (a data gate, phase 4; §9.12). Four claims in ascending order of what they catch: the 15-bit packed payload decodes to an **exact permutation of 0…16,431** — a duplicate or missing class id silently changes the pool at every VPIP and a length check would not see it; its own 64-bit hash matches `meta.orderHash`, which catches an order transplanted from another model or a hand-edit that happens to still be a valid permutation; re-deriving the classes from the enumeration yields exactly 16,432, so the index space the payload is expressed in is real; and **running the generator's own cut rule over the shipped order reproduces `constants.villainLattice.realized` at all five lattice points to the 4 dp it ships at** (25.00 / 40.00 / 55.00 / 70.00 / 90.00 %) — those realized fractions land on class boundaries, so they fingerprint the ordering near every cut. It costs 19 ms on the enumeration D1 already pays for and runs unconditionally. The stronger check the gate cannot make is in `test/order-pack.test.mjs`, which compares the *pools* hand for hand at all five cuts. |
| I41 | **The rake–depth coupling, and the knee that anchors it** (v3 item 6, §5.2). `rakePotBB = potBB·(d/100)^potScale`. **(a)** The knee is an *identity*, not a fit: `3/0.05 = 60` is the constant that was already there, the ratio is 1 at 100 bb, and `rakeFrac` is `===` its uncoupled value there at every rake percentage in **both** straddle states — which is what leaves I22 and I32's four 100 bb lanes untouched. **(b)** The reading brief §5.3 predicted before the code existed: `rakeFrac` 5.00 % → **2.00 %** and the vs-3-bet price 30.53 % → **29.59 %** from 100 to 250 bb. **(c)** Monotone non-increasing in depth, and the flat stretch below the knee is the *claim* — shallower, the reference pot is small enough that the cap stops binding and the house simply takes its percentage. **(d)** The arithmetic recomputed independently over 240 settings including the **straddle-doubled cap unit**: the scale reads the raw depth, never `dEff`, because the straddle's whole effect on this quantity is already the doubled unit and reading `dEff` double-counts it (measured: it moves lane `d100/r5/s1` from 2.50 % to 5.00 %). **(e)** With the axis off every one of those settings is bit-identical to the flat-`potBB` value. `potScale` is the one new opinion, ships in `constants.rake.flag`, and this gate is its bound rather than its justification. |
| I42 | **The depth→width factor is exactly the realization ratio** (v3 item 6b, §5.1). **Zero new opinion** — it is `baseRealization(pos,d)/baseRealization(pos,100)`, the ratio `beta` already implies and I23(f) already gates. **(a)** Exact in the I26(f) idiom and stated as a **product** so it is bit-for-bit rather than 1e-15: `widthFor(deep) === widthFor(ref)·factor`, and `factor ===` the realization ratio, over 720 (seat, node, VPIP, depth, straddle) combinations. Written as a quotient it could only ever be a tolerance — the two algebraically equal forms differ by one ulp at HJ and BB. **(b)** The seat signs are brief §5.4's, asserted on target width where they are deterministic: at 250 bb SB 0.9638 / BB 0.9749 / UTG 0.9894 / HJ 0.9965 tighten and CO 1.0070 / BTN 1.0206 loosen, and the sign is `baseR`'s own so it cannot be tuned. **(c)** On *painted* width, differenced against the same setting with the axis off so granularity cancels, the signs survive at CO/BTN/SB/BB and are **reported rather than asserted** at UTG/HJ, whose factors move less than a cell is wide. **(d)** The allowance the compounding with `M_deep` forces is **re-measured, not authored**: worst painted drift 4.787146 points against I23(d)'s 3.16 with the axis off, allowance **5.5** — the measurement +14.89 %, which P5 re-measured, left standing, and adopted as the repository-wide re-pin idiom (§11.1). Its companion floor did move, from I12's borrowed 10 % to **10.70 %**. **(e)** With the axis off all 720 widths are bit-identical and the factor is exactly 1. |
| I43 | **The villain profile can reach the tiers, and OFF is object identity** (v3 item 8, §3.3). The shadow-model construction now lives in `policy.mjs` (`profiledModel`) rather than only in the page, which is what makes any of this assertable. **(a)** OFF is **object identity** over seven off-shaped profiles, asserted with `===` and never `deepEqual` — a deep-equal copy passes a value check and is still a different object under the solve memo, which is the failure mode rather than the symptom; an off-lattice `q` is also the model itself, because the accessor refuses to interpolate an axis with one measurement on it. **(b)** At the load default (**v = 55**, a lattice point, **q = 0.85**, the shipped discipline) all **123/123** live cells are cut from a measured row and **0** are interpolated; half a lattice step away all 123 are, so the clause is not vacuous. **(c)** The shadow carries its own `meta.hash` prefix and profiled/unprofiled solves are stable and *different* under interleaved calls — a shadow wearing the shipped hash would be handed the unprofiled answer out of the cache. **(d)** I6/I7/I8/I9/I13/I19 re-run under ON at every lattice point: 0 violations. **V3-PLAN §7.2 predicted I8 would fail at tight v and it does not** — trash gains against a tight pool and does not gain *enough*, because a delta shared across a band moves scores and not ranks. **(e)** The default is still OFF, asserted rather than assumed: flipping it is a fixture ceremony, not a lane's decision. |
| I44 | **3-bet sizing: pot is the identity, and the premium's silence is bounded** (v3 item 9, §7). **(a)** Pot-size is today **bit for bit** — `envOf({sizing:1})` is the shared default env by `===`, price and floor are the shipped constants by reference, and 12,915 cell-settings swept at `s = 1` differ from the unsized sweep in **0**. **(b)** The arithmetic is exact and the geometry is why: hero calls `s(b+2o)` into `(b+2o)(1+2s)`, so the price is `s/(1+2s)` and the opening size and the blinds *cancel*. **(c)** The continue range narrows **monotonically**, asserted on the model's verdict and not on the MIX-inclusive width — MIX is a band in cumulative frequency around a *moving* cut, so the MIX reading is non-monotone at 60 of the same steps where the verdict is monotone at all of them. The span is 0.47 points for a price that travels 14.5, because at this node the ν floors bind before the price does. **(d)** I15's two anchors hold at every legal sizing. **V3-PLAN §7.2 predicted `RUN0_LOW × DS` would stop continuing at large sizings; it cannot** — that cell blends 41.80 % and the floor reaches it at `s = 2.001`, twice the pot-limit maximum, against an asymptote of 50.50 %. The **7-point premium is held constant across the axis** and that is an admission: a bigger 3-bet is a lower SPR and the premium ought to shrink, but limitation 16 is why nothing here can say by how much. This gate measures the consequence instead. |
| I35 | **The CFR+ solver, and what it is a solver *of*** (V3-PLAN §3.2 / §3.3, per spike S-A). CFR+ — alternating updates, regret matching+, linear averaging — on the 123-cell abstraction over the capped heads-up preflop tree, with **exact best-response** exploitability. Two depths are solved and differ in exactly one terminal pot: **T100** (the cap is the pot 5-bet to 81) and **T40** (the cap is a genuine all-in). **The sizing set introduces zero new constants**: every raise is the pot-limit maximum, which from blinds 0.5/1.0 is exactly the ladder **3 / 9 / 27 / 81** — an arithmetic identity, and the gate *re-derives* it from the pot-limit rule rather than reading it back — three independent times, in `potLimitLadder`, in I35's own `EXPECT` literal and in a second loop written out in `test/cfr.test.mjs` — **so a sizing that is not the pot-limit maximum fails**: misstate the rule and four assertions go at once, move the big blind and six do. This row used to say "so a typed sizing fails", and the P2 red team refuted it (`docs/refutations/P2.md`): a typed `[3, 9, 27, 81]` behind the same stack cap passes everything, because a derivation and a table that agree are indistinguishable by any check of values. That is the correct outcome for an identity — the claim is about the values, not about the code — and the sentence is now the claim the checks make. (S-A found the brief's "open / 3-bet / 4-bet / jam at 100bb" tree is **illegal** in pot limit: facing a 27bb 4-bet the maximum legal raise is 81, so a 100bb jam is not an available action. A NLHE-shaped preflop tree does not port to PLO.) Five decision nodes, nine terminals, 615 infosets, 1,599 action slots (SB 861 / BB 738) — all of which fall out of the tree rather than being asserted into it. **(a)** Exploitability ≤ **ε = 5e-5 bb** at the **2,000**-iteration cap; measured worst **7.8e-6** on the projection and **1.2e-5** on the measured pairwise matrix over three init seeds × two depths, and a 13-iteration solve breaches it at 2.3e-2, so the bar can fail. §6's rule that ε must not be tighter than the payoff's own `se` is *asserted*, not recited: the accessor's own `se` is read back and converted at the tightest pot (1.5 bb), and ε must sit under **the minimum over both routes** — the matrix's `se` comes from its own per-pair sample counts and the stub's from `meta.trials.cell`, so they are two different numbers rather than two readings of one. A quieter payoff forces ε **down**. **(b)** Every infoset is a probability distribution, against the **accumulation bound** `N·EPSILON` (an arithmetic fact about IEEE addition, not a tolerance); measured 2.2e-16, one ulp. Any probability outside [0,1] reports Infinity, which a bare sum check would miss. **(c)** Two independent seeds, on **two axes named separately, and since B2 both are live**: the *init* axis (the simplex point used while regrets are all-zero) spreads **0.0004 % / 0.0006 %** of pot on the projection and 0.0004 % / 0.0002 % on the matrix, against the **0.15 %** gate. The *payoff* axis (S-A's own reading — `opts.seed` threaded into every accessor call) remains **inert under the projection**, so those two samples are bit-identical and the spread is exactly 0 *for a stated reason, checked rather than assumed*, and it stays armed with a fabricated seed-sensitive source that moves the value 7.6e-2 bb. **Against the matrix it is live and it passes with margin:** `opts.seed` selects which of two independently sampled matrices answers, and the two give values **0.0659 % of pot apart at T100 and 0.0615 % at T40** — **2.3× / 2.4×** under the gate. That margin is a measurement rather than a claim only because the matrices are built at **400,000 boards**, which is the board count S-A read the 0.035 % anchor at. **This is the one place a v3 gate has been red and been made green without being touched, so the mechanism is worth stating.** At the B2 pre-stage the shipped matrices were at **25,000** — the top of S-A's *out-of-sample exploitability* band, a different S-A table — and the axis read **0.1508 % / 0.1568 %**, i.e. at ~1× a gate anchored at ~4× on a 400,000-board measurement. Spread falls as boards^−½, so the tolerance and the board budget were **jointly unsatisfiable**; the full six-pair table is in V3-PLAN §3.3's `Adjudicated (P3 launch)` block and the resolution in its `Adjudicated (P3 relaunch)` block. Of the three available moves — more boards, a re-anchoring ceremony on `solver.twoSeedTolPot`, or reporting the axis instead of asserting it — the last two are weakenings, so the **measurement** moved into the anchor's regime and the constant's value **0.0015 did not change by a digit**. The seed names were fixed before either matrix was solved on and were not reconsidered. **(d) Six-max is deferred, and the deferral is gated by its own evidence rather than by prose.** Budget is *not* the reason — S-A cleared §3.3's half-budget criterion by **5,400×**. The reason is the payoff's domain, re-measured every run: every multiway request returns `supported:false`, the six shares miss 1 by up to **0.445** (so there is no constant-sum game to solve), and hero's share is **bit-identical across disjoint opponent sets** — the multiway door reads equity against *random* opponents, so no opponent's cards enter any payoff. MCCFR on that would converge, correctly and quickly, to the equilibrium of a game in which the other five players' hands do not exist. If any of the three facts flips, this clause **fails** and the decision is re-made — and it is re-measured on the matrix route too, since a new payoff source is exactly what could re-open it: 0 of 144 supported, shares miss 1 by 0.445, hero's share still opponent-invariant, because the matrix is **pairwise** and multiway still falls to the accessor's flagged exit. **The re-opening rule** V3-PLAN §3.3 sets is therefore evaluated once, by measurement, and frozen in `cfr.mjs`'s `SIXMAX.reopenRule`: leg (i) holds, **leg (ii) fails** (no measured k-way sampler exists and the pairwise matrix is not one), legs (iii) and (iv) hold for the pairwise matrix and are not evaluable for a sampler that does not exist. So the deferral **stands**, and **I36's positional-nesting clause is NOT MEASURABLE in the HU domain** — the solved tree has exactly two seats, so there is no UTG/HJ/CO/BTN nesting for an equilibrium to exhibit or violate; scoped to the measurement (the I15 precedent), never toleranced. **(e)/(f) Two disclosure clauses with teeth, armed a phase before their subject exists** — the I33(g) idiom: the cap list must match the tree in *both* directions (a dropped omission understates the abstraction, an invented one overstates it), and whenever the payoff `source` is `'checkdown'` the **"a game where postflop does not exist"** label must render, derived from that datum and **never** from `supported`. That trap is the real one here: all 15,129 heads-up returns on the projection *are* `supported:true`, so a `supported`-keyed label shows no caveat at all. The label renders on **both** routes, which is the point of keying it off `source` — a measured pairwise checkdown is still a game where postflop does not exist. On the matrix route the clause's companion assertion is rewritten to the measurement: **86 unsupported returns per showdown terminal**, exactly the undealable pairs, twice over for the two orderings, derived from the matrix's own record rather than typed, with the fallback flagged rather than collapsed (I33 clause (h)'s first live case). P2 ships no equilibrium surface, so both clauses run over **zero units and report the count** instead of passing quietly. **THE FINDING THE LABEL EXISTS FOR:** the checkdown equilibrium is **BB-positive**, on both payoff sources. **On the measured pairwise matrix — the source P3's baseline is solved on — the button loses 0.14164 bb/hand at 100 bb (0.13832 at 40 bb), opening 88.86 % while BB folds 0.155 % against a 3 bb open.** That is the reproduction check against S-A's own solve of the same construction (−0.1418 bb / 89.3 % / 0.16 % at 400,000 boards): value to **1.6e-4 bb**, SB open to **0.44 pt**, BB fold to **0.005 pt**, now at **the same board budget S-A used**, so what remains is the payoff-axis spread itself rather than the budget. The deltas in the gate's own detail line are **derived from the run** against a quoted reference, never typed: the B2 pre-stage typed its deltas as prose and they became false the moment the board count moved. The **projection stub**, which remains the page's own accessor source (D10), gives −0.0816 bb at 100 bb (−0.0798 at 40 bb), opening 99.4 % while BB folds 0.0001 % — a different payoff and therefore different numbers, with the same *direction*, which is what the label is about. The stub is **exactly separable** (`ev(A,B) − 0.5 = (a_A − a_B)/2` to 1.1e-16), so its equilibrium is a pure threshold in the equity ladder and cannot express a blocker; the matrix can, and 472 of 976 steps of the equity ladder invert under it. Strip position of its only source of value and the button's edge inverts; that is what "postflop does not exist" looks like, and it also predicts the direction of any future Grade-A correction. **Validated four ways** beyond its own clauses: the analytic ground truth (with every showdown a coin flip the value is 0 and SB opens 100 %), the bracket `BR_SB ≥ v ≥ −BR_BB`, monotone convergence over five decades, and a mirror residual of 1.4e-14 bb on both routes — one ulp of the half-pot, since the solver mirrors the matrix and *measures* what that costs rather than assuming it is free. ~2.3 s for the eight solves; the two checkdown matrices are **read** once per process by the payoff family from `data/checkdown-matrix.json` and cost this gate nothing. |
| I36 | **The equilibrium anchors, SCOPED TO THE MEASUREMENT** (V3-PLAN §3.3, §7.2, §14 item 4). Asserted on the SHIPPED tiers — `model.baselineTiers`, the block lite renders — rather than on a solve nobody sees, and on the artifact's recorded findings beside them. §7.2 wrote three clauses for a six-seat game and the solved tree has **two seats**, so each is scoped to what exists and the scoping is stated rather than absorbed. **(a) "AA_BIGPAIR × DS opens everywhere"** is read over the three (pos, node) pairs that exist: it **opens purely at SB** (`raise` 100/100), **continues purely at BB** facing the 3 bb open, and **4-bets purely at SB** facing the 9 bb 3-bet. **"TRASH × RB never opens UTG" has no UTG**, so it is scoped to **SB — the button, and the loosest opening seat in the game**, which makes the scoped clause *stronger* than the original rather than weaker: not opening even here implies not opening at UTG under any monotone reading of position. **THE P3 LAUNCH BLOCK EXPECTED IT TO OPEN, AND THE MEASUREMENT SAYS OTHERWISE: it folds, purely.** 88.86 % is a *combo-weighted* frequency over 123 cells and the ~11 % the equilibrium does not open is the bottom of the range rather than a thin spread — so the model's own clause is **corroborated** in the one seat where it can be read. Facing the open, the same cell **calls**, on price, which is a different claim and is why the clause is scoped to the open. **(b) Emergent positional nesting is NOT MEASURABLE in the HU domain** — recorded, never passed, never toleranced (the I15 precedent). The reason is not this gate's to invent: it is quoted from `cfr.mjs`'s `SIXMAX.reopenVerdict`, frozen after the 6-max re-opening rule was evaluated once by measurement and leg (ii) failed, and I35(d) re-checks it every run. **§7.2's prediction — "nesting fails at some seat pair" — is therefore NOT TESTABLE this milestone**: it is not reported as holding and it is not reported as failing. The clause **fails** the day a payload covers two seats of the UTG/HJ/CO/BTN chain, at which point the prediction is owed a measurement instead of this note; the detector is armed against exactly that. **(c) The comparand is RAW model tiers** (`policy.mjs`'s `preDisplay`, the action before the two display post-passes), and the post-passes are **measured on the equilibrium rather than enforced on it** — enforcing them on a solved strategy is the laundering §3.3 forbids. **SUIT MONOTONICITY IS VIOLATED: 7 of 369 shipped tier readings**, worst `SB rfi RUN1_TOPMID SS→SSA`, which demotes **RAISE to FOLD** on adding suitedness — a card-removal effect a percentile cut cannot express. The **AA-band** pass is not violated at all (0), so the two impositions do not stand or fall together. The finding is **recorded in `data/equilibrium.json` and re-derived here from the tiers in `data/model.json`**: two artifacts, one derived from the other, cross-checked — because the failure that actually happens is that the tiers are regenerated and the record is not. Armed against a record claiming zero violations over tiers that have some. **Model side, same three settings at the reference VPIP: the model's own post-passes move 1 of 369 cells**, so choosing the raw comparand changes almost nothing about the model and everything about what may be said about the baseline. **(d) Coverage is HU, and the reason is a shipped datum**: 3 of 24 (pos, node) pairs are solved and the other 21 carry the named reason **"baseline is HU"** in the block, so the page renders it rather than supplying it. **(e) `baselineQuant` is FLAGGED, not anchored, and this clause is the bound that makes the flag worth having** (the P3 red team's one majority-unanchored constant — six memos of six, `docs/refutations/P3.md`). § 6's row claimed the byte table as the anchor; the table was true and **nothing ever ran it**, so 0.02, 0.05 and 0.5 all regenerated with every gate, test and build green, and the anchor's own prose — which ships into both artifacts and renders beside the value — could be replaced with fabricated figures and ship green too. **No replacement anchor was invented.** The table is made **binding** instead: every run it is re-derived from the **shipped** full-precision strategies at the block's own depth (`strategyOf` emits the shortest decimal that round-trips a double, so the re-derivation is exact rather than tolerant) — 0.05 → 4,589 B / 15 MIX, **0.01 → 4,964 B / 20 MIX (shipped)**, 0.001 → 5,357 B / 23 MIX — each figure checked against what the shipped anchor quotes for it, the shipped step required to be one the anchor **prices**, and the shared-core block required to **be** that quantization of those strategies, so the block and the payload cannot be two different solves. Armed four ways: a fabricated byte figure, a fabricated MIX count, an unpriced step, a deleted flag. **What it deliberately does not do:** 0.05 and 0.001 are priced rows and would still pass — *which* priced step to take is a judgment about what a tier-level surface can paint, nothing measures that, and that residue is exactly what the flag admits. The other two legs of §6's idiom are asserted here too: the flag must ship in the block (naming the constant and this gate) and `baselineQuant` must carry the Method view's **estimate** badge. |
| D9 | **The full-only payload's byte budget, and the full page's own tripwire** (V3-PLAN §5.3, §7.2). Five clauses, and the first is not about size. **(a)** A payload carrying `meta.synthetic: true` is **refused outright** — S-D's prototype payload carries that flag precisely so that shipping it is loud rather than a plausible-looking 66 KB of numbers nobody solved, and no size clause can rescue it. **(b)** `data/equilibrium.json` **69.6 KB against 73**. **(c)** `index-full.html` **614.6 KB against 634**; both ceilings are now stated as *held below* measured+5 % rather than derived from it — §9.11 has the repair the P3 red team forced, and neither number was raised. The 600 KB page budget stays **lite's**, and this is a second number for a second artifact rather than a raise of the first. Both budgets live in `scripts/lib/variant.mjs` beside the variant they belong to, so the build and the gate cannot hold different numbers. **(d)** The payload must actually be **in** the page: the injected copy is parsed back out of `index-full.html` and matched on `contentHash`, because a budget on a payload the artifact does not carry measures nothing. **(e) The shipping decision is re-applied to its own measurement.** V3-PLAN §3.3 deferred "embed the 7,626-pair matrix or reference it by content hash" to this gate; it came out **REFERENCE**, and the measurement is the reason. A **faithful** embedding — the artifact's own integer counters, the only encoding from which `E = (wins2/2)/cnt` reconstructs bit-identically — costs **102,001 B** against a **67,509 B** payload, a **2.51×** ratio, so embedding would more than double the artifact. Recorded beside it, because it is the number that would have made embedding look affordable: `E` rounded to six decimals costs **66,985 B**, *under* the threshold — and is **not the same matrix**, so it does not get to decide. Choosing a precision to fit a rule is choosing the answer. `data/checkdown-matrix.json` stays the Node-side source of truth and I33's `(artifact)` clause is what keeps it honest. The gate re-applies the rule every run, so a payload that grew until embedding no longer doubled it would fail rather than go on saying "reference". |
| I38 | **The pool-skill axis: what it is, and what it is not** (V3-PLAN §3.4 / §6; §3.5 above). Five clauses on an axis whose entire mechanism is one function, and that is the claim rather than a summary of it. **(a) The lobby endpoint is the current model BY OBJECT IDENTITY.** `poolVpip(v, ref)` returns `v` *itself* over the whole [25, 90] domain (`Object.is`, by early return, not by an offset that cancels); a `skill: 0` profile builds the **same shadow object** as a profile with no skill field at all; `villainProfileOf` is a **fixed point** on its own output, so the dial cannot be applied twice by a consumer that re-normalises; and with the villain profile **OFF** a full-skill dial leaves the model untouched — the axis cannot reach I22's or I32's legacy lane, because its whole mechanism is the lattice and there is no lattice being read. Added at P4 and armed by the test that found it: the **shadow's memo prefix now carries the base model**, because before this it came from `villainKey` alone and two models profiled at the same (v, q) in one process shared a `SOLVE_MEMO` entry — the `envKey` failure one level up, where the missing axis is *which model*. **(b) The floor is the MEASUREMENT's floor.** `skill.vFloor` = 25 = `villainLattice.v[0]`, asserted as an identity every run: the dial's reach is the reach of the trials, and a dial that went past the tightest pool ever measured would be asking the accessor a question no trial answered. At `s = max` the constant is returned *itself* — `v + 1·(f − v)` is not `f` for every `v` in IEEE-754, and a far endpoint that misses the lattice by one ulp gets labelled `interpolated`. **(c) THE DIAL IS A COORDINATE CHANGE ON VPIP AND ADDS NO SECOND PATHWAY**, which is §6's "no new opinion" mechanised rather than asserted: over 16 (v0, s) pairs × 21 legal (position, node) pairs — **336 solves** — the pool at (v0, s) and the pool at (`poolVpip(v0,s)`, 0) are the **same shadow object** and hand back the **same solve object**. That is what makes it *correct* for `villainKey` to leave `skill` out of the memo key rather than merely convenient. A half-applied dial is armed as the case that must separate. **(d) Combo-weighted width tightens: 16.12 % → 13.76 %** over the 21 pairs, monotone at every step of the five-point grid — **and every exception is enumerated, never allowed for**, in both directions, against frozen records. Six pairs widen end to end and they are exactly the six **vs-3-Bet** pairs, all through `BROADWAY_RUN|DS` and `BROADWAY_RUN|SSA` going T3 → T2, which at that node is **CALL → AMBUSH CALL**: a tier label moving, not a hand, and `width` counts T1+T2 so it measures the label. Eleven interior (pair, step) rises: those six relabels plus five nut-gate releases as `N_eff` falls. I21 answers the same granularity problem on the VPIP axis with a bounded dip allowance; §7.2 asks this row for enumeration instead, and an allowance is what you write when you have not enumerated. **(e) The plays-better coefficient is bounded at REACH ZERO, not at a size.** It ships `null` — Grade C leaves no payoff layer to cut through and limitation 16 means nothing here measures postflop play, so no number is invented. Eight shipped files are scanned comment- **and string-literal**-stripped (the flag *names* the coefficient, which is the admission §6 requires, and an admission is not a read), and only `policy.mjs`'s declaration may name it; and over **9,225** per-cell readings along the whole dial the realization the pipeline uses is **bit-identical** to the dial-blind `realization(pos, N, ν, d)`. The failure this is armed against is somebody wiring a realization cut to the dial and picking a coefficient because one was needed. **(f)** §6's three legs: `constants.skill.flag` names **all three** unanchored records — `playsBetter`, `blend` and the domain — each carries the Method view's **estimate** badge, and since P4's red team the **badge map's reader** is asserted too, not just the map: a refuter left `UNANCHORED` intact, deleted the branch in `constHTML` that consumes it, and shipped with the family and 47 tests green, which is the P1 failure (a flag deleted with everything green) displaced one level. **(g) THE DOMAIN IS FORCED, AND BOUNDED — added at P4's red-team stage, because its anchor was refuted.** `min`/`ref`/`max` shipped claiming to be *anchored by construction*, by the two early returns; three refuters of three showed otherwise with the whole triple green — `min = -1` resolves the load default to **VPIP 85**, LOOSENING the pool onto the plays-better side Grade C does not build (and `wireVP` copies that number onto the page's slider, so a reader can select it), `max = 2` and `ref = 0.05` shipped green too, and **both early returns are removable with everything green** (`v + 0·(f − v)` *is* `v`, and `v + 1·(25 − v)` is exactly 25 for every double in [25, 90] over 3,000,000 draws). No replacement anchor was invented. What is asserted now is the **forcing**: the published blend returns the pool itself only at `ref` and the floor only at `max`, so those two are pinned by the blend and the measured floor between them, and `poolVpip(v, min)` must be the lobby itself. Then the dial is **swept at the page's own slider step** (0.01, read back out of `src/shell.html` along with its `SKILL.min`/`SKILL.max` wiring, so the domain bounded is the domain a reader is given): over **909 settings** it never moves a pool up, never reaches the floor before `max`, and is monotone throughout. A bound is not an anchor — `max = 1` is a unit convention normalised against a blend that is itself unanchorable — so the triple ships flagged and badged beside the other two. |
| I37 | **Divergence accounting along the dial — and the clause that is recorded rather than passed** (V3-PLAN §3.4 / §6 / §7.2; §3.5 above). **(a) "Signed vs-GTO divergence combo-weighted ≈ 0 at pool = baseline" is NOT MEASURABLE on this payload.** "Pool = baseline" is a *setting of the pool dial*, and the P3 baseline is heads-up with the SB on the button **opening 88.85 % of combos** — **33.85 points looser than the lobby's 55**, so the setting lies on the *loosen* side of the axis, which is the plays-better half Grade C does not build. Underneath the arithmetic is a seat mismatch rather than a range accident: the baseline's SB is the button and in position, the model's SB is a six-max small blind out of position (`baseR` 0.90). Recorded, never toleranced into a pass (the I15 / I36-nesting precedent), with the detector armed on the **shipped** entry frequency so it **fails** the day a baseline lands at or below the lobby and the clause is owed a measurement instead of a note. **Measured beside it, because unmeasurable is not a reason to publish nothing:** the signed combo-weighted divergence is **negative at all three covered nodes and every setting** — the model is *tighter* than the HU equilibrium everywhere — and **grows** as the pool tightens at two of them (`SB` × RFI −1.095 → −1.199, `BB` × vs-Raise −0.708 → −0.852; `SB` × vs-3-Bet flat at −0.917, because that node's only movement is the AMBUSH-CALL relabel and CALL and AMBUSH CALL are the same action on the baseline's scale). **So "monotone exploit → equilibrium convergence", which §3.4 offered for falsification, is falsified in the aggregate as well as per cell.** **(b) The interior blend is the sentence the page publishes — and, since P4's red team, the SHAPE that sentence describes.** `constants.skill.blend` is recomputed against `poolVpip` at 5 interior settings × 4 lobby VPIPs — the I42(f)/I44(f) idiom, after the P1 red team shipped a Method view publishing a formula the code does not run — with **both anchored endpoints reproduced exactly**, read at **literal** `s = 0` and `s = 1` rather than through the constants they pin, because a constant cannot be asked to certify itself. That much bounds the *spelling*; it does not bound the *curve*, and three refuters proved it by shipping `v + (s + 0.05·sin(4πs))·(vFloor − v)` — published self-consistently in the constant, in `blendSpelling()` and in `blendValue()` — monotone, exact at every setting the clause sampled, **60/60 green**, and up to **2.3 VPIP points** away from linear at settings the 0.01 slider can select, while the shipped flag went on saying "the path between them is linear". So the clause now walks the blend at the page's own slider step and asserts its **second difference is zero** (a 1e-9-point IEEE guard, seven orders below the 0.15-point move one notch makes at the tightest probe): linear in `s` *is* a second difference of zero, and `test/skill.test.mjs` carries the refuters' ripple as an armed control so the check cannot go blind. This is §7.2's monotone-interpolation clause, and it is what bounds the one constant here that cannot be anchored: nothing measures a pool-skill scale, so linear is the form the two endpoints determine on their own and it ships flagged rather than justified. **(c) The `interpolated` badge is the accessor's own, not a second one.** At the load default the three detents land on VPIP 55 / 40 / 25, all measured lattice rows, and `villainEq` reports `lattice`; the two midpoints land on 47.5 and 32.5 and the same accessor reports `interpolated`. **(d) Per-cell convergence toward the equilibrium: 29 of 369 readings VIOLATE it**, enumerated in a frozen record compared in both directions. **§7.2's prediction is CORROBORATED, and the *ordering* is asserted rather than quoted**: the two rank-overlap rows it names lead by violation rate — `BROADWAY_RUN` **8 of 15**, `RUN0_HIGH` **3 of 12** — while the junk row `TRASH` is **1 of 12** and eighth, so "not the junk rows" is a measurement here and not a turn of phrase. I25's lesson transposed: what a tightening pool moves is the hands whose value is rank overlap. **(e)** The T2 reading — whether a model T2 is the aggressive or the passive level, which the baseline has no T2 to answer — is read back out of `src/shell.html`'s own node table every run, so the divergence measured here is the divergence the surface paints and not a second copy of the page's judgement. |
| I34 | **The EV quarantine: no EV error of any size can move a tier** (V3-PLAN §5.4, §3.4). The load-bearing call is architectural — **view mode is not an input to `solve` or `aggressiveSet`**. The EV cut is a *sibling* accessor, `evCut(model, state, payoff)`, which consumes the memoised solve object and hands the same object back; a mode flag threaded into the tier path without a matching memo-key change is exactly the poisoning this gate exists to catch. **(a)** 420 settings — 21 legal seats × the 5-VPIP grid × the 12 environment lanes, sampled 1-in-3 of 1,260 and **ordered by `fnv1a` of each setting's own key**, which is measured to mix them (40.6% of consecutive visits differ on seat, node, VPIP *and* lane at once, against 45.6% expected of a random ordering of this surface and 1.2% in construction order — the mixing bar is computed from the surface rather than chosen). Each gets a **memo-cold reference serialisation** of all 123 cells' tier, action, pre-display action, MIX overlay, gate flag, promotion, score, margin, rank and frequency, plus eight aggregates. **(b)** The walk then visits all 420 with score/EV/score **interleaved** and 55 hash-chosen memo clears, and the tiers are identical **by object**: 51,660 `Object.is` comparisons on the cell objects themselves, the solve object unmoved across every EV read, `evCut(...).solved === solve(...)` throughout, and one more pass EV-first from a cold memo. Armed against a wrapper that mutates a memoised cell. **(c)** Every badge is `evBadge(source, se, supported)`'s answer and moves when any one of the three moves. **(d)** `evPrimary` is **false on the shipped model** — no `calibration` block exists, only the P5 ceremony may stamp one, and S-C's verdict means it can only ever be stamped FAIL — it rejects every near-miss verdict (`'pass '`, `'Pass'`, `1`, `true`), and the path behind it is **real**: a fabricated distinct-hash twin with `verdict: 'pass'` throws without a payoff, cuts different tiers with one, and never aliases the shipped model's memo. The flag is read **above the cache and is in the key**. |
| I39 | **EV arithmetic: fold is zero, rake enters exactly, and the vs-3-bet sign is an identity** (V3-PLAN §7.2). `evBB = (ev·rakeRhoFactor(env) − invShare)·potMult·potSize − stake`. **(a)** **EV(fold) = 0 by construction** — the only money in the expression is money that enters at or after the node, so there is no fold term to get wrong. Over 900 settings × 123 cells every `evBB` reproduces the expression by `Object.is`, every `keep` compares against **zero**, and the geometry is the checkdown one (`potSize = (nOpp+1)` stakes). The sharp form is read off the layer through a fabricated payoff at the two equities where the arithmetic is exact: over 1,845 endpoint readings a hand that **never wins loses exactly its stake and not a chip more** — which is what says no blind and no sunk money is in there — and a hand that always wins collects exactly the raked pot. **(b)** Rake enters **only** through `rakeRhoFactor`, the exact I31(c) machinery: `1 − ρ` reproduces `min(pct, capBB/(rakePot·unit))` to 1e-15 over 6 rake settings × straddle × depth {40,100,250} × both couplings, and — the clause with teeth — **the accessor's own six keys are `Object.is`-identical across every rake setting** over 8,856 readings, so a per-hand cap cannot be hiding inside `potMult` or `invShare`; both hold their checkdown identities (1 and 0) everywhere. **(c)** `sign(evBB) = sign(eqMix − breakevenPrice(env))` on 19,926 of 19,926 vs-3-bet readings, with nothing left inside the ±se band — an **identity**, because the pot is written from the price exactly as the page's `nodePotBB` writes it, generalised to read `sizingPrice` so it survives the sizing axis. **This route bypasses the frozen accessor and says so**: `payoff()` takes cell keys and a *mix is not a cell*, so the share is `eqMixOf`'s and the error is the blend's own `seOfTrials(40,000)` by mix weight. **(d)** All 2,583 badges are `evBadge`'s answer, all lead with the page's own word `unsupported`, and all carry source `checkdown` — under Grade C every percentile reading is `supported:false` through the hero-only request shape, and the multiway door is **not** quietly promoted. **(e)** `stake` is a **pure display scale**, derived from `constants.solver.sizingLadder` rather than typed: doubling it on a distinct-hash twin moves not one `keep`, `mix`, `width` or `k` over 7,749 readings. **(f)** `policy.mjs` is outside I33(g)'s filename scope, so that detector is run here **voluntarily** over the `evCut` memo region rather than the blind spot being exploited, and the separation is probed dynamically as well — `ip` on/off, two models and two payoff bindings all hand back different objects, and a keyless memo is *seen* to alias. |
| I40 | **What the EV cut moves — including the prediction it falsifies** (V3-PLAN §3.4, §7.2). **(a) Rake NARROWS EV-mode width, which is the deliberate anti-I31(a)**: over 900 settings (15 percentile seats × 5 VPIP × depth {40,100,250} × both couplings) the 5% rake widened the EV-mode set **0 times**, and pooled width goes **22.83% → 19.66%**. The contrast is the point, measured on I31(a)'s own legacy surface: at 225 identical settings the **score-path width moves 0 times and the EV-mode width moves 177**. That is limitation 17's designated structural fix biting. **(b)** Depth moves EV-mode width with I42's seat signs, on I42 clause (c)'s **differenced control** (axis on minus axis off, so the reading is the axis and not the re-sort): deep deltas UTG +0.000, HJ +0.000, CO +0.021, BTN +0.308, SB −0.678, BB −0.863 pts. **Asserted on CO/BTN/SB/BB and reported for UTG/HJ** — I42's own scope, for I42's own reason. **(c) §7.2's offered prediction is FALSIFIED and the finding ships**: "shallow+raked folds more than deep+raked at every seat" holds at 57 of 75 seat–VPIP readings and **inverts at 18**, and the inversions are not scattered — 13 of them are at the vs-Raise node, with `SB|raise` and `BB|raise` inverting at 4 of 5 VPIPs each. The two couplings pull against each other: `rakeDepth` grows the reference pot with the stack so the 3bb cap binds *harder* when shallow, putting the higher effective rake **deep**, while `depthWidth` tightens every seat whose `baseR` is under 1 as the stack grows. All 18 are enumerated in `scripts/lib/ev-band.mjs` and compared in **both** directions. **(d)** The MIX band's `k` is **re-derived from scratch every run** and `Object.is`-compared against the stamped `constants.evCut`, with `derivedAt` checked to still describe the default state — **and P4's red team measured what that comparison is worth, so the clause now says it.** Under the house GREEN command the field-by-field comparison is a **self-comparison**: `verify.mjs`'s CLI calls `stampConstants` before `verifyModel`, so the block was written from the very function the gate re-runs, and a hand-edited `k` is silently restamped. What actually bounds the block is **the bracket** — `0 < evMassAtK ≤ t4Mass ≤ evMassNextStep`, which caught every wrong derivation three refuters built (a doubled target, a halved one, a narrowed seat scope, T1 counted instead of t4) *after* a full restamp and rebuild — and `test/ev-cut.test.mjs`, which reads the model off disk **unstamped**. The one row that had neither was **`seUnit`**: `sePt: 0.9`, `seBBMean: 0.5` and `trials: 12345`, typed in place of their derivations, shipped 60/60 green, and no refuter could falsify it. Its anchor was true and enforced by nothing (the P2 precedent), so it is now asserted as the **identity it claims to be** — `seUnit.trials === meta.trials.cell`, `seUnit.sePt === seOfTrials(that count)`, both against the model and the accessor rather than against the fresh derivation, and `seBBMean` against a **second walk of the same 21 seats written in the gate** — in I40(d) *and* in the unit test that reads the file unstamped. |
| I46 | **The primacy verdict, and every route to 'pass'** (V3-PLAN §3.5 / §5.4 / §7.2; limitation 18). **THE GATE IS GREEN AND THE VERDICT IS FAIL — two statements about two different things, and collapsing them is the one misreading this row exists to prevent.** What is asserted is that the answer on the page is the answer the *pre-registered* bar gives, not that the answer is yes. **(a)** The harness reproduces: 7 of 7 self-checks, including a self-play stream that reproduces under one seed and is REQUIRED not to under another — without that, every future "two runs agree" claim is empty. **(b)** The shipped block is REBUILT inside the gate from the same model and canonical-digest compared over 13 fields, so a typed verdict, a stale block from an earlier model, or a stamp that quietly took different options fails rather than ships. **(c)** The bar is byte-equal to `I46_CRITERIA` and its digest is `58a70f0cb95a44ed`; the third copy lives in `docs/spikes/S-C.md` and is byte-compared by `test/gates-reserved.test.mjs`, so no two of the three can be edited together. **(d)** Failure-closed and **armed**: the clause is `verdict === 'pass'` **iff** all eight criteria pass on a present corpus, so it stays correct the day a conforming corpus exists — and it refuses four fabricated `pass` blocks, including the shipped block with its verdict re-stamped, while still returning `pass` for a lawful one. Today 7 of 8 criteria are unevaluable, PC-8 passes (890 / 987 transposed pairs beyond 2·se.cell), and `evPrimary` is false on the shipped model. **(e)** `disputed` ships **empty with its reason** — no fit was run because PC-2 admits no corpus to fit against, which is a different fact from everything agreeing — and seven fields the Method view must render are grep-checked in the shell. §7.2's prediction *fitted q ≠ 0.85* is therefore **untested**: neither falsified nor confirmed, and the page says so. **(f)** The self-play figure is proven not to be a result: `potFrac`, `moneyValidated: false`, and feeding it to the verdict machine fails **PC-4 by name** rather than by the corpus being absent. |


I22 is the gate that lets v2 be built at all. The depth axis, the rake slider, the straddle
toggle and the VPIP-filtered villains all enter the scoring layer as multipliers or deltas that
are *the identity* at the operating point above; I22 is the only thing standing between "the new
knob is inert at its default" and "we think it probably is". So the discipline around its
expectation matters as much as the assertion: **nothing in the build writes the fixture.**
`scripts/freeze-tiers.mjs` is the sole writer, it refuses to overwrite without `--force`, and
`--force` prints every tier that is about to move before it moves it. A gate that regenerates its
own expectation asserts nothing, and the fixture carries a content digest so that hand-editing it
into agreement fails loudly instead of quietly.

**I32 is the same gate one level up, and it is what lets v3 be built incrementally.** v2's
mechanisms could be checked at a single point because each was the identity there. v3's cannot:
its axes are read by code that is already carrying a depth, a rake and a straddle, so "inert at
the default" has to be checked on the surface the product actually opens on, not only at the
origin. `data/tiers-v2.fixture.txt` froze that surface — 12 lanes, 2,045,736 tiers — from the
green tree *before the first line of v3 code*, which is the only moment at which such a fixture is
worth anything. Every v3 mechanism must then enter as one of exactly three shapes: a new axis
inert at legacy settings, a new artifact that changes no existing byte's meaning, or a deliberate
re-freeze through the same `--force` ceremony with the printed move-diff committed. The same
sole-writer discipline applies verbatim, `--v2` selecting the second baseline; and because the v1
operating point is one of the twelve lanes, I22 lives inside I32 transitively — a containment the
gate *checks*, artefact against artefact, rather than assuming. The two retire together or not at
all.

I20 is the one worth dwelling on. `equity-ref.mjs` is a second equity engine written separately
from the production one, kept in the repo purely to disagree with it. Two independent
implementations agreeing on a number is much stronger evidence than either one agreeing with
itself at a higher trial count.

### 11.1 The P5 allowance re-measure — one margin, measured, and a rule about direction

V3-PLAN §7.1 disposes of three v2 gates as "I23(d)/I28/I30 re-pinned after I42 lands (**re-measured
allowances, not authored ones**)", and §3.5 asks P5 to "re-measure every allowance re-pinned during
P1–P4". This is that pass, and what it found is worth stating plainly, because nothing here was
*false*.

Five dip- and drift-allowances shipped describing the **same** margin and running at five different
ones. Each number was real, each gate passed, and each detail line printed a true measurement — but
"the margin" was several numbers wearing one name, and two of the five had never been divided by
their own gate's measurement at all:

| Gate | Old allowance | Measurement (shipped model) | Realised | What the prose said |
|---|---|---|---|---|
| I21 | 4.0 pts | 3.2 | +25.0 % | "half the largest single cell" — a **structural** anchor, and the origin of the rest |
| I23(d) | 4.0 pts | 3.164835 | +26.4 % | "I21's" — **borrowed**, from a gate that sweeps at the reference depth |
| I23(d) floor | 10 % | 12.612060 | −20.7 % | "I12's" — **borrowed** the same way |
| I28 | 6.5 pts | 5.450549 | +19.3 % | "~19 % headroom … the same margin I21 runs at" (I21's is +25.0 %) |
| I30 | 4.0 pts | 2.858990 | +39.9 % | "I21's own; no widening needed" — **borrowed**, and the loosest in the repository |
| I30 floor | 8 % | 8.964078 | −10.8 % | its own, measured on its own sweep from the start |
| I42(d) | 5.5 pts | 4.787146 | +14.89 % | "the measurement plus I28's own ~15 % margin" (I28's is +19.3 %) |
| I42(d) floor | 10 % | 12.612060 | −20.7 % | "I12's" — **borrowed** |

**The margin now has one value and an anchor: +15 %, taken from I42(d),** which at +14.89 % is the
tightest any allowance in this repository already ran at. It is chosen *because* it is the tightest
of the shipped set and for no other reason — adopting the tightest number already in evidence is the
only choice that cannot weaken a gate, and it invents nothing. Gate tolerances are not shipped
constants here (none of them is in `model.constants`), so this needs no badge and no flag; it needs
an anchor, and that is the anchor. It lives in `scripts/gates/_shared.mjs` as `P5_MARGIN`.

**The rule matters more than the number: a re-pin may tighten, never widen.** Where the idiom would
*loosen* an allowance a gate already carries, the existing pin stands and the gate prints its own
realised margin instead. So P5's effect on every allowance is monotone in one direction, and
"re-measure" can never be the sentence that precedes a weaker gate:

| Gate | P5 | Result |
|---|---|---|
| I23(d) ceiling | 4.0 → **3.65** | tightened (+15.3 %) |
| I23(d) floor | 10 % → **10.70 %** | tightened (−15.2 %) |
| I28 | 6.5 → **6.30** | tightened (+15.6 %) |
| I30 ceiling | 4.0 → **3.30** | tightened (+15.4 %) — and now *below* I21's 4.0, so "no widening needed" is a claim the number makes |
| I30 floor | 8 % | **stands** — the idiom would put it at 7.62 %, which is looser |
| I42(d) ceiling | 5.5 | **stands** — already the tightest, and now the anchor for the other three |
| I42(d) floor | 10 % → **10.70 %** | tightened (−15.2 %) |

Every ratio above is **divided in the gate at run time** from the live measurement rather than typed
beside it, and printed in the detail line — the same "derived from shipped data, never prose" idiom
I23(g), I41 and I42(g) already use for their own claims. A margin that drifts away from its
measurement therefore shows up in the report on the next run.

**Two findings fell out of the pass, and neither is a defect in a gate.** First, the measurements
themselves did not move: all seven reproduce their P1 values to six decimal places on the shipped
model, so this is a margin change and not a correction. Second, I30's prose located its narrowest
straddled range at "rfi/UTG VPIP 25"; it is at **VPIP 27** (8.964078 %), with VPIP 25 reading
9.0084 % at 100 bb. The gate has always printed the true setting from the live sweep — only the
sentence beside it was stale, and nothing read the sentence. That is exactly the class of drift a
re-measure exists to catch.

**The `--fast` lane was measured and deliberately left alone.** Its looser twins (6.0 / 8.0 / 9.0 /
5.0 / 7.5 / 8.0) are noise allowances for a 10,000-trial model, not shipped numbers. They were
re-measured at P5 on a fast draw and all hold with room — but on that draw I28's worst dip lands at
`d40 limps/SB@62` (4.37 pts) rather than the shipped model's `d250 rfi/BTN@82` (5.45), which is
precisely the sampling spread a noise allowance exists to absorb. Re-pinning one to a single Monte
Carlo draw would make it tighter than the noise it is there for, so the fast pins keep their place
and say so in the gate.

