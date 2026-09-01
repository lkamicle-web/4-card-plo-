*Phase 0 spike S-A · worktree branch `worktree-wf_5a8a2571-726-2` · verdict: PASS.*

# S-A — CFR+ convergence on the 123-cell abstraction

**Verdict: PASS.** All three criteria met with four orders of magnitude of headroom, and the half-budget clause
that gates 6-max MCCFR is met by a factor of 5,400. §3.6's "S-A fails" row does not fire: P3 keeps CFR+ for
heads-up and 6-max MCCFR stays a live target, not a stretch goal. **What this measures, and what it does
not:** the payoff is a **checkdown** — hero's share of the pot at showdown with no postflop betting. Every
equilibrium below is the equilibrium *of that game*, "a game where postflop does not exist". S-A tests solver
mechanics; S-B tests whether a real payoff is estimable. Reproduce with `sa-matrix.mjs` then `sa-run.mjs`;
raw log and per-iteration curve in `scripts/spikes/results/`.

## Tree spec (the deliverable)

Heads-up, SB on the button, blinds 0.5/1.0, preflop pot 1.5bb. Every raise is the **pot-limit maximum**, which
from the blinds is exactly the ladder 3, 9, 27, 81 — an arithmetic identity of the game, so the sizing set
introduces **zero new constants**. Five decision nodes, nine terminals, 123 × 5 = **615 infosets**, 1,599
action slots (SB 861, BB 738). Not in the tree, said out loud: no SB limp, no sixth raise, no postflop —
abstraction choices P3 must render on-screen under I35's cap-list clause.

| node | actor | actions | showdown pot if called |
|---|---|---|---|
| n1 | SB | fold (−0.5) \| open 3 | — |
| n2 | BB | fold (+1) \| call \| 3-bet 9 | 6 |
| n3 | SB | fold (−3) \| call \| 4-bet 27 | 18 |
| n4 | BB | fold (+9) \| call \| cap | 54 |
| n5 | SB | fold (−27) \| call | 162 (T100) / 80 (T40) |

**Finding, unprompted: the tree the brief asks for is illegal in pot-limit.** "open / 3-bet / 4-bet / jam" at
100bb cannot be played — facing a 27bb 4-bet, BB's maximum legal raise is 81, so a 100bb jam is not a legal
action. A NLHE-shaped preflop tree does not port to PLO. Two depths were solved: **T100** (100bb, cap = the pot
5-bet to 81; the 19bb behind is irrelevant under a checkdown payoff) and **T40** (40bb = the shipped
`depth.min`, where the 4-bet to 27 leaves 13 behind so the cap action *is* a legal all-in). They differ in
exactly one terminal pot.

## The payoff matrix

7,626 pairs = 7,503 measured off-diagonal + 123 diagonals that are **exactly 0.5** (two hands from one cell are
exchangeable). Off-diagonals are stored once and mirrored, so `E[i][j] + E[j][i] = 1` to the bit — worst
residual 0.000e+0 — and the solved game is **exactly** zero-sum. 400,000 shared boards, mean **114,151
samples/pair**, **22.0 s** single-thread: 6% of the 6-minute pipeline budget. Checks: combo-weighted mean
equity **50.0000 %** (conservation); q-weighted row sum against the shipped `eq[1]` column mean **−0.112** pt,
p95 **0.577** pt, max **0.827** pt; per-entry se from an independent second matrix **0.143** equity pts
(rms|A−B| 0.202, max 1.142); **43** structurally undealable pairs (AA_* × A_BLOCKED — six aces), mass 3.6e-5.

**A sampling-measure bug, found and fixed — carry this into P2.** The first cut redrew a cell's combo when it
collided with the board (12 tries). That is a different probability measure: redrawing weights every board
equally, whereas the deal being modelled weights a board by how many cell-*i* hands it leaves alive. Against
the shipped `eq[1]` column it read **+1.16 pts high on average and +5.33 pts high on RUN0_HIGH|RB** — a bias
larger than every effect v3 intends to model. The fix is one draw per cell per board with a sit-out on
collision, making accepted samples exactly uniform over disjoint (board, handA, handB) triples. *Any* P2 payoff
sampler must be validated against the shipped `eq` column first. The surviving −0.112 pt residual is signed the
way card removal predicts: ace-holding cells (BIGPAIR_ACE, ACE_JUNK, SMPAIR_ACE, ACE_RUN3) read ~0.6 pt *low*,
because the shipped number conditions the villain on hero's aces being dead and the q-weighted sum does not.
Chance is the **product of marginals** — no cell-level card removal between players: an abstraction choice that
keeps the game exactly zero-sum, and whose 43 undealable pairs carry 3.6e-5 of the mass.

## Convergence (CFR+, alternating updates, linear averaging, exact best-response exploitability)

Target ε ≤ 0.25 % of pot, graded on the **tightest** reading — the 1.5bb preflop pot, ε ≤ 0.00375 bb; any larger normaliser makes the bar easier.

| iter | 1 | 13 | 25 | 40 | **46** | 456 | 2,130 | 100,000 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ms | 1 | 7 | 9 | 11 | **11** | 40 | 143 | 6,086 |
| ε (bb) | 2.175e+0 | 2.947e-2 | 8.795e-3 | 3.774e-3 | **2.931e-3** | 5.120e-5 | 3.247e-6 | 5.112e-9 |
| % of pot | 144.98 | 1.965 | 0.586 | 0.2516 | **0.1954** | 0.00341 | 0.00022 | 3e-7 |

**Wall time to target 11 ms** = 0.009 % of the 120 s budget and **0.018 % of the 60 s half-budget**. Throughput
16.4k it/s, so 120 s buys ~2.0M iterations against the 46 needed. **Peak rss 63.7 MB** with two matrices and
four solvers live, against a 44.9 MB bare-Node baseline and a 1,024 MB budget — the model's own working set is
~1 MB (each matrix is 242 KB).

| | value to SB (bb) | ε final (bb) | target at | last argmax flip |
|---|---:|---:|---:|---:|
| CFR+ T100 matrix A | −0.14183675 | 5.11e-9 | iter 46 / 11 ms | iter 1,577 |
| CFR+ T40 matrix A | −0.13815859 | 1.88e-9 | iter 34 / 5 ms | iter 991 |
| CFR+ T100 matrix B | −0.14131743 | 1.73e-9 | iter 46 / 7 ms | iter 1,533 |
| vanilla CFR T100 (control) | −0.14183089 | 1.13e-5 | iter 344 / 32 ms | **iter 99,467** |

## The failure modes, checked rather than assumed

- **Oscillation / plateau: absent.** ε falls monotonically at ≈ T^−1.75 over five decades, with no knee.
- **Whole-cell flapping: absent under CFR+.** Zero argmax changes across 615 infosets for the last 98,423 of
  100,000 iterations. Vanilla CFR was **still flipping at iteration 99,467** — a difference in kind, and the
  reason to specify CFR+ rather than CFR in P3.
- **Correctness, four independent checks.** Zero-sum residual 2.8e-16; simplex error 2.2e-16 (I35's "strategies
  sum to 1"); best-response bracket `BR_SB ≥ v ≥ −BR_BB` holds; and an analytic ground truth — with `E ≡ 0.5`
  the game is blind economics with value exactly 0 and a Nash profile of *SB opens 100 %, BB never folds*:
  solved −6.3e-8 bb, ε 4.5e-7 bb, open 100.0000 %, fold 1.07e-5 %.
- **Abstraction sensitivity: one flap, and it is the payoff's, not the solver's.** Independent payoff matrices
  give values 5.19e-4 bb apart (0.035 % of pot), mean per-cell total-variation 0.0070. Four of 615 infosets
  disagree on argmax; three are mixed, where argmax carries no claim. The one pure/pure disagreement is n5 /
  BIGPAIR_ACE|DS (0.106 % combo mass): equity against BB's cap range **33.350 %** in A, **33.232 %** in B,
  indifference point exactly **33.333 %** — a 0.12-pt wobble, inside the 0.143-pt per-entry se, flipping a
  0.027 bb decision. Payoff noise, transmitted faithfully.

## Anchors handed to §6 — measured, not chosen

- **Exploitability target ε.** §6 says ε ≤ the payoff's own se; the decision-relevant version is *out-of-sample*
  exploitability — σ solved on matrix A, scored against matrix B. Measured **5.16e-5 bb = 0.0034 % of pot**.
  Recommend **ε = 5e-5 bb**, 74× tighter than the 0.25 % spike threshold, so that threshold sits above the
  noise floor and is not fake precision.
- **Iteration cap.** ε first crosses 5e-5 bb at **iteration 456 (40 ms)**. Recommend **2,000** — a 4× margin,
  143 ms, 0.24 % of the half-budget.
- **I35's two-seed clause.** Value spread across independent payoff samples 5.19e-4 bb (0.035 % of pot).
  Recommend the gate at **0.15 % of pot** (≈4× measured), written to fail.
- **Payoff board budget.** Out-of-sample ε by matrix size: 12.5k boards → 0.053 % of pot; 25k → 0.0015 %; 50k →
  0.0068 %; 100k → 0.0091 %; 200k → 0.0041 %; 400k → 0.0024 %. Past ~25k the reading is dominated by the
  reference matrix's own noise: **12.5k boards (1.2 s) already supports the 0.25 % target**, and 400k (22 s) is
  10× more than the solver can use.
- **Tree headroom.** ~15 µs per showdown terminal per iteration, so 2,000 iterations inside 60 s buys ~2,000
  showdown terminals: sizings per node, limps and a sixth raise all fit. Tree richness is not the binding
  constraint; the payoff is.

## The finding P3 must render, not bury

The checkdown equilibrium's value is **BB-positive** — the button loses 0.1418 bb/hand, BB folds **0.16 %**
against a 3bb open, SB opens 89.3 %. That is what "postflop does not exist" looks like: strip position of its
only source of value and the button's edge inverts. Under Grade C this surface ships, and I35's
checkdown-label clause is load-bearing — a reader shown a 0.16 % BB fold frequency without that label is shown
a lie. It also predicts the Grade-A correction's direction: a real payoff must move value toward the button and
narrow BB's continuing range.
