# V4 S2 lane R — the ring artifact. What was built, what was measured, what the plan got wrong.

Base `v4-s1-base` (S1's snapshot; this worktree predated it and was fast-forwarded onto it before any
edit). Branch `worktree-wf_3c958a35-f26-4`.

**GREEN at return** — `node scripts/verify.mjs` exit 0 with **62/62** gates, `node --test
test/*.test.mjs` **731/731**, `node scripts/build.mjs --check` **2/2 current**, and
`node scripts/generate-ring.mjs --check` byte-identical. The 62 do NOT include D12: lane F is the
single writer of all seven v4 id registrations, so this lane's gate is written, tested and unwired
by design (§6.5). **One blocker**, R2's — §7, and in the return.

---

## 1. What shipped

| file | what it is |
|---|---|
| `scripts/lib/ring.mjs` | the construction: seeds, bands, agreement statistics, serialise/deserialise, the two source hashes |
| `scripts/generate-ring.mjs` | the ceremony: measure both seeds, validate before writing, `--check` |
| `data/ring.json` | the artifact — per cell `eq[N=8, N=9]` and `vDelta[v][N=8, N=9]`, plus meta |
| `scripts/gates/ring-artifact.mjs` | D12 (a)–(e). Lane R's file; `gates/ring.mjs` (I48–I52) is lane F's and neither opens the other's |
| `scripts/lib/mc.mjs` | `nMax` as a per-call option on BOTH kernels; `tag` as an optional stream prefix; the worker body threads both |
| `scripts/lib/sim-kernel.js` | the IIFE-time `var NMAX = PLO_MC.NMAX` becomes a per-job `widthOf(job)` |
| `src/shell.html` | three named sites only — `:1181` (`NMAX` + the new `SIM_NMAX`/`setSimSeats`), `:1318` (`validEqArray` second arity), `:1407` (the sim-payload compat check, including the `validMeasurement(p, p.nMax)` on its last line) |
| `test/ring.test.mjs`, `test/ring-gate.test.mjs`, `test/ring-shell.test.mjs` | 40 tests (11 + 22 + 7); every D12 clause shown to fail on a fabricated violator |
| `test/block-census.test.mjs` | re-pinned `TODAY` + three literal readings — a MEASUREMENT, not a decision; see §6 |

`data/model.json` is **byte-identical**: sha256 `4c35c01424344f57373d5e4c6bc5cc6d50a7c8ffe7f0780eaf40b937f98d6963`
before lane R's first edit and after its last. The ring is a separate artifact, not a sub-block
(§0.4), and `cells[*].eq` / `cells[*].vDelta` never move.

---

## 2. The measurements

| reading | value | against |
|---|---|---|
| two-seed wall, 4 workers | **1,213.6 s** | R2's pre-registered 300 s — **4.05× over** |
| D12(c) worst prefix delta | 0.8488 pt = **5.31 · se.cell** (3.75 σ of `seDiff`) | §5.2's band 2.0 — **FALSIFIED**; the 5 σ outlier line holds |
| D12(b) worst two-seed delta | 0.8409 pt = **5.26 · se.cell** (3.72 σ of `seDiff`) | §5.2's band 2.0 — **FALSIFIED**; the 5 σ outlier line holds |
| `data/ring.json` on disk | **18,606 B** = 18.2 K | note 505 · meta 1,468 · cells 15,362 · agree 1,235 |
| injected (`const RING = …`) | **18,619 B** = 18.2 K | the `ring` budget row S3 must add, capped from above at **20 KB** |
| `appCore` cost of lane R | **+373 B** (lite) | shrink-first: first cut read +614 B |
| D12(a) `--check` | **byte-identical**, exit 0 | rebuilt at 8 workers against the write's 4; `wallSec` blanked both sides |
| worst N=7→8 seam, `eq(8) − eq(7)` | **−0.700 pt** (`TRIPS_BIG\|RB`) | monotone on all 123 cells, ~3.1 σ of `seDiff` — a cross-artifact check neither file can make alone |
| worst N=8→9 step inside the ring | **−0.500 pt** (`TRIPS_SMALL\|RB`) | monotone on all 123 cells |
| D12(b) bias / spread | **0.129 σ** / **0.847×** | inside 2 and 2 |
| D12(c) bias / spread | **0.436 σ** / **0.922×** | inside 2 and 2 |
| numbers past the pre-registered 0.32 pt | 153 of 1,476 · 88 of 861 | Gaussian noise at `seDiff` predicts 232 and 135 — **fewer breaches than noise alone predicts** |

---

## 3. Two predictions of the plan, falsified by measurement

### 3.1 §2.4's RNG-stream mechanism — right conclusion, wrong reason

> "Because `NEED` changes with `nMax`, dealing nine villains changes the RNG stream, so the ring's
> `N = 1..7` prefix is a differently-seeded reproduction of the v1 layer rather than a
> byte-identical one."

Measured (`test/ring.test.mjs`, first test): at the **same seeds**, raising `runMulti`'s width from 7
to 9 leaves `eq[0..4]` — N = 1..5, the v1 columns — **bit-identical**, and moves only `eq[5..6]`.
The first 25 cards are dealt by an unconditional loop that does not know how many villains follow,
and every villain past the fifth is appended by `extraRng` at a strictly higher deck index; the
5 → 7 lockstep argument (I22) survives 7 → 9 intact. What actually diverges is the **per-trial
stride** of the second stream — `extraRng` consumes `NEED − 25` draws per trial and that count moves
with `nMax` — so N = 6 and 7 differ from the second trial onward.

The prefix is a genuinely independent reproduction anyway, because the ring runs under its **own two
named seeds** rather than v1's. So D12(c) is a real falsifier — for the reason the seeds give it, not
the reason §2.4 gives.

`runMultiFiltered` is the opposite case and is asserted too: villains are dealt **before** the board,
each consuming a hero-dependent number of draws, so a wider field shifts every column including
N = 1. That asymmetry is why the ring's `vDelta` baseline is its own `runMulti` column and never
`model.json`'s.

### 3.2 §2.4's cost model — linear in villains for one kernel, 6× for the other

The 300 s budget is derived as `2 × 113 × 9/7 ≈ 291`, on the assumption that cost scales about
linearly in villain count because the per-trial draw is `NEED = 5 + nMax·4`.

Measured, per cell, at 5,000 trials (`AA_BIGPAIR|DS`):

| v | nMax 7 | nMax 9 | fallback rate 7 | fallback rate 9 |
|---|---|---|---|---|
| 25 | 66 ms | 608 ms | 0.029 % | **5.744 %** |
| 40 | 39 ms | 283 ms | 0.000 % | 1.344 % |
| 55 | 31 ms | 135 ms | 0.000 % | 0.087 % |
| 70 | 28 ms | 83 ms | 0.000 % | 0.002 % |
| 90 | 25 ms | 61 ms | 0.000 % | 0.000 % |
| **Σ lattice** | **189 ms** | **1,170 ms** | | **6.2×** |
| `runMulti` (random villains) | 19 ms | 22 ms | | **1.16×** |

The assumption holds for `runMulti` (1.16× against the predicted 1.29×) and fails badly for
`runMultiFiltered`. The mechanism is not the draw width: it is **rejection-sampling exhaustion**.
`runMultiFiltered` draws each villain from the VPIP-filtered pool against an increasingly blocked
deck; by the ninth villain 40 of 52 cards are dead, the tightest pools cannot supply a live member,
and each failure burns the full `RANGE_TRIES = 4,000` rejection budget before falling back to a
random hand. At v = 25 the fallback rate rises **198-fold**.

End to end, the shipped S2L stage is 101 s at seven villains (METHODOLOGY :1955, four workers on a
four-core box); the ring's own lattice stages measured **584.1 s** and **599.1 s** at the same trial
count and worker count — **5.9×**, reproducing the per-cell ratio to within 5 %.

**This is a finding about the measurement layer at nine seats, not only about the budget.** A v = 25
villain pool cannot be dealt nine times from one deck without distortion: 5.7 % of the ninth
villain's draws are not from the range at all, and the ones that succeed are selected for being
unblocked. METHODOLOGY should carry it beside limitation 20.

---

## 4. The pre-registered agreement band is unsatisfiable — by arithmetic, not by luck

§5.2 writes D12(b) and D12(c) as *"agree within `2 · se.cell` = 0.32 equity points on every cell"*.

`se.cell` is the standard error of **one** column. Both clauses compare **two** independently sampled
columns, and the standard error of their difference is `√2 · se.cell` = 0.224. So 0.32 is **1.41 σ**
on the quantity it is applied to, and "on every cell" asks a 1.41 σ event never to occur in 861 draws
whose expected count is about 136.

No trial budget rescues either clause:

- **D12(c)** compares against the **shipped** layer, whose own `se.cell` = 0.158 is frozen. Even an
  infinitely precise ring leaves `se_diff ≥ 0.158`, so 0.32 is at most **2.02 σ** in the limit.
- **D12(b)** would need ≈ **597,000 trials per cell** to make 0.32 a 3.5 σ bound — six times a wall
  budget that is already 4× over.

Both facts are asserted in `test/ring.test.mjs` ("the pre-registered 2·se.cell band is
unsatisfiable"), so this is a standing claim rather than a paragraph.

### What the gate does instead

The plan's rule where a prediction fails is to **record** it, and this repository's rule is that a
tolerance is never widened to make a gate pass. Both are honoured by separating the two things a band
does. The pre-registered reading is **reported on every run**, in §5.2's own units, against §5.2's
own 2.0, carrying the word `FALSIFIED` when it breaches — permanently on the gate's report. What is
**asserted** is the same constant `se.cell` with the error propagation a difference requires, plus
the two clauses that actually discriminate:

| clause | statistic | why it has teeth |
|---|---|---|
| BIAS | mean signed delta ≤ 2 · `seDiff` | a systematic error moves it; noise does not |
| SPREAD | RMS delta ≤ 2 · `seDiff` | catches a trial count that is not what `meta` says |
| OUTLIER | no cell past 5 σ, checked on all 123 from the artifact's own per-cell record | catches a wrong pool, a wrong kernel, a stale slice |
| MONOTONE | `eq[N=9] ≤ eq[N=8]`, **zero tolerance**, per cell | catches a column read off by one — which a band of any width sails past |

`OUTLIER_SIGMA = 5` is anchored by the artifact's own shape rather than tuned to it: over the
1,476 + 861 comparisons it makes, the Gaussian false-alarm probability of one 5 σ excursion is
5.7 × 10⁻⁴. The precedent is in the tree — `test/sim-bundle.test.mjs`'s fidelity tests draw the same
line at 4 σ for 20 comparisons and give the same reason: the point is to catch a wrong pool or a
wrong kernel, "which are worth whole points, not a tenth".

**The seam is the check neither artifact can make alone.** `eqAtSeats` joins `model.json`'s N ≤ 7 to
the ring's N = 8, 9, and nothing inside either file can tell whether the two halves line up. Measured
on all 123 cells: the ring's N = 8 sits **below** the model's N = 7 with a worst-case margin of
0.700 pt, and the ring's own N = 8 → 9 step is at least 0.500 pt. Both are ~3 σ of `seDiff`, so the
join is not marginal, and `test/ring.test.mjs` asserts it **strictly, with no tolerance**.

**A note on the bias denominator, which is `seDiff` and not `seDiff/√n`.** Common random numbers
(`mc.mjs`'s header) make the per-cell errors correlated, so their mean does not average down. This
was measured, not assumed: at 5,000 trials the two-seed mean delta read 0.112 pt, which is 4.3 σ of
an independent-sample mean and 0.11 σ of a shared-stream one. `meta.twoSeed.biasSigmaIndep` keeps the
independence-assuming figure beside it so the size of that correlation stays on the record — on the
shipped ring it reads 4.95 (two-seed) and 12.78 (prefix) against 0.129 and 0.436.

**And the honest limit of that clause, stated rather than buried.** The shipped prefix mean is
−0.0986 pt: the ring reads about a tenth of a point BELOW the shipped layer on average. Under the
shared-stream denominator that is 0.44 σ and unremarkable; under an independence assumption it would
be 12.8 σ. The truth is between them and **one pair of seeds cannot resolve which**, because common
random numbers leave the whole comparison with an effective sample size closer to 1 than to 861.
There is no mechanism that would bias the two estimators against each other — both are unbiased
estimators of the same quantity and the shipped rounding to 1 dp is symmetric — so the reading is
recorded as noise. Resolving it properly would need more seeds, which is the same wall budget
problem §7 is already a blocker about. A supporting datum, measured: the number of readings past the
pre-registered 0.32 pt is 153 of 1,476 and 88 of 861, where Gaussian noise at `seDiff` predicts 232
and 135 — the measurement is QUIETER than the conservative `50/√n` bound, not noisier, which is what
`spread` at 0.847× and 0.922× says too.

---

## 5. Design decisions worth naming

**The artifact records its agreement per cell, and not the columns themselves.** §2.4 says the
N = 1..7 prefix is not shipped, and it is not. But a gate that re-measured would cost five minutes
inside a 41.9 s wall, and a gate that read a single stored verdict would be reading a claim rather
than data. So `agree.twoSeed` and `agree.prefix` carry **one number per cell** — that cell's worst
|delta| in units of the propagated standard error — index-aligned with `Object.keys(cells)`. The gate
walks all 123 and fails on any one of them; `--check` proves the numbers are what the generator
actually produced. Cost: ~1.4 KB.

**`--check` is proven ACROSS worker counts, not merely repeated.** The artifact is written at 4
workers and re-measured at 8; `runJobs` hands out chunks dynamically and indexes results by job id,
so the answer is worker-count independent by construction, and this exercises that rather than
assuming it. The rebuild is byte-identical and the two runs' fallback counts agree to the unit.

**`meta.wallSec` is in the artifact, and it is the one documented exclusion from `--check`'s
byte-compare.** The checkdown matrix keeps wall time out of its file entirely and prints it, because
wall time is a property of the machine. That option is not open here: D12(e) is a gate on the
measured wall, and a gate cannot judge a number that lives only in a log. So it is stored,
`contentHash` is computed with it blanked (exactly as `contentHash` itself is), and `--check` blanks
it on both sides and says so — `generate-equilibrium.mjs`'s `meta.buildMs` precedent, taken
deliberately rather than drifted into.

**Two source hashes, not one.** `generatorHash` covers `ring.mjs` + `generate-ring.mjs`.
`kernelHash` covers **`mc.mjs`'s `@worker-slice` region only** — the exact bytes the browser bundle
slices out and the exact bytes that decide what an equity number means. Hashing all of `mc.mjs` would
make every unrelated edit look like a stale ring and cost five minutes to disprove; hashing none of
it would let an edit to the kernel go unnoticed. This is the coupling that makes D12 bite on lane R's
own change.

**The villain pools are rebuilt from the SHIPPED ordering, never re-measured.** `model.order.packed`
was frozen precisely because a second `eq1` run would order the classes near the cut differently.
Re-measuring here would give the ring's `vDelta` a different pool from the one `model.json`'s
`vDelta` was measured against, and the two would stop being the same quantity at different N. The
generator uses the browser's own path (`sim-kernel.js`'s `buildRange`), which
`test/sim-bundle.test.mjs` already pins against the shipped lattice.

**The two N-names on the page.** `NMAX` stays 7 — it is the equity-array shape invariant, and the
ring exists as a separate artifact so that it can stay 7. `SIM_NMAX` is the simulation field width
and moves with the table via `setSimSeats(seats)`, which asks `constants.ladder.seats` whether it
recognises the count before asking `policy.nMax` for the width — so the shell gains **no seat literal
and no width literal**, and a stale `?seats=`, a console call or a pre-ladder build all fall back to
`NMAX`. `validEqArray(e, n)` and `validMeasurement(m, n)` default to `NMAX`, so every pre-existing
caller means what it meant. The compat check pins `p.nMax` to the width **in force**, so a payload
measured at another table size is refused rather than reinterpreted — the stored value is never its
own yardstick.

---

## 6. Filed for S3

1. **`variant.mjs` — add a top-level `ring` budget row to BOTH variants.** `ring: 20 * 1024` in
   `VARIANTS.lite.budgets` and `VARIANTS.full.budgets`. Measured injected payload **18,619 B**
   (18.2 K); `ceil(measured × 1.05)` to the whole KB is **20 KB**. D12(d) asserts this from above and
   FAILS while the row is absent — it does so today, naming both variants and printing the exact
   line to add, which is the gate working rather than the gate broken.
2. **`build.mjs` — register the ring's own injected region**, on the `data/equilibrium.json`
   precedent (`const RING = ${JSON.stringify(JSON.parse(raw))};`), in **both** variants — lite keeps
   Simulate, and Simulate at nine seats needs the nine-column width. D12(d) measures exactly that
   string, so the two agree by construction.
3. **`total` will need a raise in BOTH variants, and lite's was not predicted.** §2.7 says lite's
   total is "expected to fit"; with the ring injected it does not. Lite measures 587.9 K against
   600 K (12.1 K of headroom) and full 657.6 K against 660 K (2.4 K) — the ring is **18.2 K** injected.
   Both raises are paid at `ceil(measured × 1.05)` with the shrink-first sentence in `budgetSource`.
   **The shrink-first measurement R6 requires, in bytes:** the plan estimated 7-8 KB by counting the
   1,476 shipped numbers at 4.9 B each and not the framing around them — 123 cell keys, 615 quoted
   VPIP keys, the `eq`/`vDelta` keys and the JSON punctuation. One shrink is available and was
   measured, not guessed: rendering `vDelta` as an ARRAY of five pairs indexed by `meta.v` — which is
   `data/model.json`'s own shape for the same quantity — takes `cells` from 15,362 B to 12,287 B,
   **saving 3,075 B (16.5 % of the artifact)**. Lane R did NOT take it, because
   `docs/spikes/V4-ladder.md` specifies the consumed shape as `vDelta:{'<v>':[N8,N9]}` and contract
   fidelity across a four-lane merge is worth more than 3 KB when both `total` ceilings are being
   raised regardless. It is S3's to take if `total` is tight. The `agree` arrays (1,235 B) are what
   give D12(b)/(c) per-cell teeth at gate time and are not a shrink candidate.
4. **`test/block-census.test.mjs`'s `TODAY` fixture is a four-lane contention point.** Any lane that
   moves a page byte moves it, and three literal readings beside it (`app …K/398K≤…K`, the refuter's
   `… × 1.05 rounded up …`, and the `total` bound pair). Lane R re-pinned it to its own measurement
   to stay green; **S3 should re-pin it once after the merge** rather than reconciling four races.
   It is a measurement, not a decision.
5. **D12 is not registered in this worktree** — lane F owns all seven id registrations. When F
   registers it, **clause (e) will be RED** until the R2 blocker below is adjudicated. Nothing else
   in D12 fails.
6. **`policyDeltas`: none.** S1's `eqAtSeats(cell, N, seats, ring, key)` takes the ring payload as a
   parameter and needs no change for the `eq` columns. S1's own filed delta —
   `vDeltaAtSeats(pts, vDelta, v, seats, ring, key)` plus threading `ring` through
   `villainEq`/`profiledModel` — is still needed for the villain-profiled path above N = 7, and lane
   R has now settled the decision S1 said it was coupled to: `SIM_NMAX` is a separate name from
   `NMAX`, `validEqArray` takes the width as an argument, and a nine-long `eq` on the sim path is
   valid. `villainEq` may therefore return a nine-long `eq` at nine seats without breaking the model
   path. **The ring ships `vDelta[v][N=8, N=9]` for all 123 cells, so the data that delta needs
   exists.**

---

## 7. The blocker — R2, stated as R2 asks for it

The measured two-seed wall is **1,213.6 s** against the pre-registered **300 s** — **4.05× over** —
at four workers, the regime the budget was derived from (METHODOLOGY: "Four workers … on a 4-core
box: 188 s — … S2 12 s, S2L 101 s"), and METHODOLOGY :2798 records that `workers=1` and `workers=8`
produce the same numbers, so choosing a larger count to meet a wall budget would be gaming it rather
than measuring it. The four stages read: R-CELL 14.9 s and 15.0 s (against the shipped S2's 12 s —
the 1.16× the plan predicted), R-LATT 584.1 s and 599.1 s (against the shipped S2L's 101 s — 5.9×,
where the plan predicted 1.29×). **The whole of the overrun is in one kernel, for one measured
reason**, and §3.2 above is that reason.

R2's remedy is to **halve the lattice trials for the ring only** and never to drop a seed. That does
not save it. Lattice cost is **linear in trials**, measured directly rather than assumed — 4 cells ×
5 VPIP at nine villains: 50,000 trials 40.97 s / 91,755 fallbacks, 100,000 trials 82.81 s / 183,648
fallbacks, a ratio of **2.021** on time and **2.001** on fallbacks. So halving gives 30 s of cell
stage + 592 s of lattice ≈ **622 s** — still **2.07× over**. R2's own next sentence then applies:
*"if it still exceeds 300 s, that is a blocker, not a silent widening."* (Derived from two measured
points rather than run end to end: a second full pass costs 11 minutes to produce a strictly worse
artifact that fails the same clause.)

**What lane R did not do, deliberately.** It did not halve. Halving is a remedy for fitting the
budget; measurement says it cannot fit, so halving would permanently coarsen `se.latt` on the shipped
N = 8, 9 columns and still fail the clause. The artifact therefore ships at the regime the brief
mandates — the same `TRIALS` and `se` as `generate-data.mjs` — and the owner adjudicates with the
best artifact in hand rather than a degraded one.

**And more parallelism does not answer it either, measured rather than argued.** The `--check`
re-measurement was deliberately run at **8 workers** against the write's 4 — which also makes the
determinism claim stronger than a same-regime rerun would. It reproduced **byte-identically**, with
identical blocked-pool fallback counts — 5,195,877 and 5,210,970, to the unit, reproduced across
four independent runs of this generator — and took **660.8 s**: a 1.84× speedup for 2× the workers,
and **still 2.20× over the 300 s budget**. Doubling the
parallelism does not reach it, and METHODOLOGY :2798's pin — worker count cannot move a number —
means it could never have been anything but a wall-clock trade.

**What only the owner can decide.** Either (a) the budget is re-derived from the measured cost model
rather than the assumed one — the honest number is `2 × (12·1.16 + 101·6.2) ≈ 1,280 s`, and it is a
one-off cost paid per change to the construction, never per model run or per verify, exactly as the
checkdown matrix's 21 s is; or (b) the ring's lattice ships at a coarser `se.latt` with the badge R2
requires. Lane R has no authority to widen a pre-registered budget and has not.
