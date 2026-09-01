*Phase 0 spike S-B · worktree branch `worktree-wf_5a8a2571-726-3` · verdict: Grade C (fail).*

# S-B — payoff estimator cost + error

**Verdict: Grade C.** Best held-out p95 = **7.21** pot-fraction points (form 2R); best budget-affordable held-out p95 = **8.01** (form 3R). Both exceed the pre-registered 5.0 edge, so the three-band rule lands on §3.6's Grade-C row. Cost agrees independently: the forms that come closest cost 1.5–5.1× the pipeline budget, and the forms that fit the budget are the worst performers. Nothing tested reached 5.0 at any price.

Run: tree at `e6c6641`, Node v25.9.0, 18-core M-series. 50 stratified pairs × spr {1, 4, 10} × {IP, OOP} = 300 points, 20,000 shared deals per pair, 36.5 s wall on 14 workers. Prototype in `scripts/spike/`, raw numbers in `sb-results.json`, transcripts in `scripts/spike/logs/`.

## What was measured against what

`ev` is defined as the **ratio of expectations** `E[W]/E[F]`: per hand `F` is the final pot (uncalled bets included), `W` what hero collects. This is the only reading of §2's "expected final-pot share" that makes I33(b) exact *per hand* rather than within 2·se, and I33(c) exact at spr = 0 — both verified in `sb-checks.mjs` (max |w + w′ − F| = 0 over 200,000 random states; spr = 0 reproduces checkdown equity with delta exactly 0).

**REF3**, the reference: HU, pot = 1, effective stack = spr, three streets. Each player knows both cells (the payoff signature makes ranges public) and his own four cards, estimates equity against the opponent's cell over 32 sampled runouts × 24 range hands per street, and acts on a polar threshold policy (bet 0.66 pot at eq ≥ 0.62 or ≤ 0.22; call at pot odds; jam at 0.80) with one raise. Reference se: **mean 0.377 pt, max 0.702 pt** — the grade is not a noise artifact.

Five forms plus two hybrids, fitted on 34 train pairs, reported on 16 held out: **0 STUB** shipped `eq[1]` (villain-cell-blind and spr-blind — what Grade C ships); **P** pairwise checkdown `eq(A,B)`; **1** checkdown + fitted realization curve; **2** one-street flop rollout with a threshold stack-off policy; **3** flop-equity-distribution buckets joined by odds ratio; **2R/3R** forms 2 and 3 plus the same fitted correction form 1 gets.

## Error table — pot-fraction points, |estimator − reference|

| form | ALL mean | ALL p95 | ALL max | **TEST p95** | spr=1 p95 | spr=4 p95 | spr=10 p95 | ρ |
|---|---|---|---|---|---|---|---|---|
| 0 STUB `eq[1]` | 10.12 | 27.88 | 45.77 | **37.04** | 27.25 | 27.55 | 32.38 | 0.396 |
| P pairwise checkdown | 6.49 | 21.02 | 28.24 | **19.21** | 3.54 | 13.08 | 24.05 | 0.718 |
| 1 checkdown + curve | 2.46 | 6.62 | 14.97 | **8.44** | 4.72 | 6.01 | 8.65 | 0.970 |
| 2 one-street rollout | 6.97 | 23.28 | 33.28 | **25.69** | 4.28 | 18.20 | 29.19 | 0.727 |
| 3 flop-eq buckets | 5.87 | 20.33 | 27.92 | **18.52** | 3.89 | 13.40 | 23.31 | 0.766 |
| 2R rollout + curve | 2.33 | 6.39 | 13.10 | **7.21** | 2.30 | 5.72 | 7.42 | 0.976 |
| 3R buckets + curve | 2.72 | 7.04 | 15.46 | **8.01** | 5.05 | 6.42 | 9.19 | 0.965 |

Error is dominated by one term. Collapsing IP and OOP, position-averaged p95 is **3.39** (2R), 4.00 (1), 4.76 (3R) — **Grade B territory**. It is the positional *gap* nothing gets: the reference's mean absolute IP−OOP difference is 1.72 pt at spr = 1, **11.93 pt at spr = 4, 23.86 pt at spr = 10** (max 43.46), and the best form still misses it with p95 10.89. Position enters the frozen interface through `opts.ip`, and it is exactly the argument no estimator serves.

Stress-pair p95: 6.50 (2R), 6.97 (1), 21.02 (P), 32.78 (stub). RUN0_LOW|DS × BROADWAY_RUN|RB goes from checkdown 49.72 to reference 70.92 IP / 44.07 OOP at spr = 10 — a 27-point positional swing on a pair the checkdown calls a coin flip. BROADWAY_RUN|RB × AA_DANGLER|RB *loses* value as spr rises (30.19 → 26.16 IP / 21.98 OOP): the rank-overlap row realizes worse than its raw equity, deep.

## Knob sensitivity

p95 over all 300 points as one knob moves. **form 1** shape knob `S0` ∈ {1…12}: 9.74 → 6.62 refit, **26.31 → 6.62 frozen** — the curve is not robust to its own shape parameter, which has no anchor outside the fit. **form 2**: `jamT` 23.28–25.00, `bluffT` 23.28–25.12, `jamMult` 22.62–23.89 — flat; already far enough from the reference that no knob rescues it. **form 3**: `jamT` 20.33–22.10, `rho` 20.33–21.74, `anchor` on 20.33 / off 21.13, and the knob that matters, `percept` (act on your vs-field bucket, or on the h2h estimate): **20.33 vs 24.51** — collapsing the two perceptions to complements destroys the joint structure. **2R/3R** with coefficients refit per knob: `jamT` moves p95 5.89–6.39 and 7.04–7.93; the fit absorbs the simulation knobs, so the honest reading is that the *fit* is doing the work, not the simulation.

**The reference is itself an opinion layer, and this is the load-bearing caveat.** One REF3 knob at a time moves the "ground truth": `bluffT` 0.22→0.10 **p95 5.81, max 10.93**; `betFrac` 0.66→1.00 p95 4.44; `betT` 0.62→0.70 p95 2.92; `callMult` ±0.15 p95 ≤ 1.39; `jamT` 0.80→0.70 p95 0.83. **Two of five reference knobs move it by more than the Grade A/B edge, one by more than the B/C edge.** The table measures agreement with a specific street simulation, not with truth: a p95 ≤ 2.5 claim would have been unsupportable from this reference even had a form earned it. Recorded, not corrected — Grade A needs a postflop-solver reference, which is v4 scope.

## Precompute cost against the budget

Kernels, single-threaded (the driver's per-worker wall clock overstates cost 1.2–2.8× on 50 jobs over 14 workers): checkdown MC **0.69 µs/trial**, REF3 **431.8 µs/deal**, flop-only **228.7 µs/deal**, flop-equity bucket **16.5 µs/cell-sample**, form-3 query **27.1 µs** per (pair, spr, position).

The budget is **not** 6 minutes of this laptop. METHODOLOGY records the v2 pipeline at **188 s of its 360 s hard budget on a four-core box**, so the payoff precompute has **172 s on 4 workers = 688 cpu-seconds**. For 7,626 pairs × 6 grid points:

| item | cpu-s | s @ 4 workers | vs budget |
|---|---|---|---|
| checkdown table @ 20k trials/pair (forms P, 1, 3) | 105.5 | 26.4 | **0.2× FITS** |
| checkdown table @ 40k trials/pair | 211.1 | 52.8 | **0.3× FITS** |
| form 3 per-cell buckets @ 20k samples (123 cells) | 40.7 | 10.2 | **0.1× FITS** |
| form 3 query over the whole grid | 1.2 | 0.3 | **0.0× FITS** |
| form 2 flop rollout @ 600 / 2 000 deals per pair | 1 046 / 3 488 | 262 / 872 | 1.5× / 5.1× OVER |
| REF3 itself @ 2 000 / 20 000 deals per pair | 6 585 / 65 852 | 1 646 / 16 463 | 9.6× / 95.7× OVER |

The headroom buys **208 REF3 deals per pair (se ≈ 3.70 pt)** or **394 flop-only deals per pair (se ≈ 2.69 pt)**: a street-simulated payoff that fits the pipeline carries a standard error larger than the Grade A edge before any modelling error is counted. The payoff table is 7,626 entries where the shipped cell table is 123 — a 62× wider object asked for comparable precision.

## The pre-registration audit (§6, mandatory beside the p95)

| quantity | value |
|---|---|
| stub payoff `se` at default trials — `seOfTrials(100,000)` = 50/√n | **0.1581 pt** (shipped `meta.se.cell` 0.16, agrees) |
| smallest EV that moves a tier, predicate reading (§3.4's `EV ≥ 0`), median over 21 legal (pos, node) | **0.1405 pt** (min 0.0017) |
| smallest EV that moves a tier, ordering reading (§5.4 primacy, EV as sort key), median cut gap | **0.1274 pt** (min 0.0000 — two cells tie at a cut) |
| pre-registered Grade A edge | 2.5 pt = **15.8×** the stub se, **17.8×** the median tier-move |
| pre-registered Grade B/C edge | 5.0 pt = **31.6×** the stub se |

Under I34's quarantine as written, score mode's answer is +∞ by construction — tiers are bit-identical across view modes, so no EV difference of any size moves a tier there. The above are EV-mode figures.

**Mismatch, recorded not redrawn.** The blind edges sit 16–20× above the granularity at which EV flips a cell. They are not arbitrary at the *consequence* level, though: perturbing every cell's EV by iid uniform(−d, +d) and recutting the aggressive set at the same width moves

| d (pt) | 0.16 (stub se) | 0.50 | 1.00 | **2.50** | **5.00** | 7.20 (measured best) |
|---|---|---|---|---|---|---|
| cells flipped | 0.58% | 1.62% | 3.20% | **7.51%** | **13.87%** | 18.96% |
| combo mass flipped | 0.75% | 2.05% | 3.79% | **8.74%** | **15.23%** | 19.41% |

2.5 pt ≈ 8% of the map moving, 5.0 pt ≈ 15% — defensible edges in consequence terms even though coarse in granularity terms. The measured best form would move **19% of the map**. The line stays where it was pre-registered; this is the audit, not a redraw.

## Findings for the payoff interface freeze (§2 / I33)

1. **`ev` alone cannot do the bb conversion.** `EVbb = ev·finalPot − invested` needs two numbers the frozen signature does not return: across 300 points `E[F]/potSize` ranged **1.603 to 11.865** and hero's share of `E[F]` ranged **0.199 to 0.730**. `payoff()` must also return `potMult` and `invShare`, or caller arithmetic is wrong by up to an order of magnitude in the pot term.
2. **I33's monotonicity clause fails as predicted, and harder.** Pairs where higher checkdown equity gives lower ev: **1.7% at spr = 1, 8.1% at spr = 4, 15.9% IP / 20.5% OOP at spr = 10**. Worst: BROADWAY_RUN|RB × AA_DANGLER|RB vs AA_DANGLER|RB × AA_SMALLPAIR|DS — 9.1 pt *less* checkdown equity, 20.0 pt *more* ev at spr = 10. Rewrite the clause to the measurement.
3. **`supported:false` has a real domain, and it is card-removal degeneracy, not multiway.** Cells pinning the same ranks make some (cell, cell, board) triples impossible from the observer's seat: AA_DANGLER|RB × AA_BIGPAIR|DS is degenerate on **12.56%** of street evaluations (the four aces are shared); mean 0.73% over 50 pairs, 4/50 over 1%. Getting this wrong is silent — the first implementation dead-carded the range against the opponent's *actual* hand and collapsed every AA-vs-AA pair to a checkdown with no error raised. That belongs in I33 as a clause.
4. **Add a position clause to I33.** `ev(A,B,ip) + ev(B,A,¬ip) = 1` holds exactly per hand (verified), but `ev(A,B,ip) ≠ ev(A,B,¬ip)` by up to 43 pt. Any implementation memoizing without `ip` in the key is wrong by more than the entire error budget — the `envKey` docstring trap, in a new place.

## Recommendation

Take **§3.6's Grade-C row unchanged**, and do not re-plan around it. The stub payoff stays; the solver runs on checkdown wearing the "a game where postflop does not exist" label, gated by I35's checkdown-label clause from the shipped `source` datum. B2 decides vs-GTO caveated-or-cut; the skill axis halves to its fold-more (lattice) half; EV ships display-only and `estimate`-badged. I46 is pre-answered "no" a fortiori.

Descope P2 from a payoff **table** to a payoff **correction**: form 1 costs 105 cpu-s (0.2× budget), needs only the pairwise checkdown table plus a closed form, and reaches p95 8.44 held out — worth shipping as a labelled `estimate` *if* a consumer needs an spr axis at all, and worth cutting if none does. Do not build form 2: it is 1.5× over budget at a trial count whose own se already exceeds the Grade A edge. The blocker on any future Grade A is the reference, not the estimator.
