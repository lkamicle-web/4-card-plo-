# V4 S2 lane R — the ring artifact. What was built, what was measured, what the plan got wrong.

Base `v4-s1-base` (S1's snapshot **plus the owner's post-run-1 amendment to R2**). This worktree
carried run 1's lane R work, so `v4-s1-base` was merged into it before any edit; the diff of
`scripts/lib/policy.mjs` against that base is empty, which is the contention registry's own check.
Branch `worktree-wf_3c958a35-f26-4`.

**RUN 2**, after the owner's adjudication of run 1's R2 blocker (V4-PLAN §2.4 and rule R2, amended in
place). `data/ring.json` was regenerated fresh, `--check` re-run at a different worker count from the
write, the wall re-measured at four workers, and every D12 clause re-demonstrated failing on a
fabricated violator. Sections 3.2 and 4 below are kept as the record they are; §7 is rewritten from
"the blocker" into the adjudication and the reading under it.

**GREEN at return** — `node scripts/verify.mjs` exit 0 with **62/62** gates, `node --test
test/*.test.mjs` **734/734**, `node scripts/build.mjs --check` **2/2 current**, and
`node scripts/generate-ring.mjs --check` byte-identical. The gate count does NOT include D12: lane F
is the single writer of all seven v4 id registrations, so this lane's gate is written, tested and
unwired by design (§6.5). **No blockers.**

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
| `test/ring.test.mjs`, `test/ring-gate.test.mjs`, `test/ring-shell.test.mjs` | 43 tests (11 + 25 + 7); every D12 clause shown to fail on a fabricated violator |
| `test/block-census.test.mjs` | re-pinned `TODAY` + three literal readings — a MEASUREMENT, not a decision; see §6 |

`data/model.json` is **byte-identical**: sha256 `4c35c01424344f57373d5e4c6bc5cc6d50a7c8ffe7f0780eaf40b937f98d6963`
before lane R's first edit and after its last. The ring is a separate artifact, not a sub-block
(§0.4), and `cells[*].eq` / `cells[*].vDelta` never move.

---

## 2. The measurements

All values are RUN 2's, measured on the artifact this branch ships. Where run 1 differs the run-1
figure is given beside it; every agreement statistic reproduced to the last printed digit and both
fallback counts to the unit, which is the determinism claim making itself rather than being asserted.

| reading | value | against |
|---|---|---|
| **two-seed wall, 4 workers** | **1,255.4 s** (run 1: 1,213.6 s) | `ring.meta.wallBudget` **1,280 s** — **inside, at 0.98× of budget** |
| R-CELL, seed A / seed B | 15.3 s / 14.8 s | shipped S2's 12 s — the 1.16× §2.4 predicted, and got right |
| R-LATT, seed A / seed B | 624.0 s / 601.2 s | shipped S2L's 101 s — 6.2× and 6.0×, where §2.4 predicted 1.29× |
| D12(a) `--check` | **byte-identical**, exit 0, 630.3 s | rebuilt at **8 workers** against the write's 4; `wallSec` blanked on both sides |
| blocked-pool fallbacks, seed A / seed B | 5,195,877 / 5,210,970 | identical to run 1's and to the 8-worker rebuild's, to the unit |
| D12(c) worst prefix delta | 0.8488 pt = **5.31 · se.cell** (3.75 σ of `seDiff`) | §5.2's band 2.0 — **FALSIFIED**; the 5 σ outlier line holds |
| D12(b) worst two-seed delta | 0.8409 pt = **5.26 · se.cell** (3.72 σ of `seDiff`) | §5.2's band 2.0 — **FALSIFIED**; the 5 σ outlier line holds |
| worst per-cell agreement | twoSeed **2.63 σ** · prefix **3.75 σ** | the 5 σ outlier line, asserted on all 123 cells |
| `data/ring.json` on disk | **18,607 B** = 18.2 K | meta 1,469 · cells 15,362 · agree 1,235 |
| injected (`const RING = …`) | **18,620 B** = 18.2 K | the `ring` budget row S3 must add, capped from above at **20 KB** |
| `appCore` cost of lane R | **+373 B** (lite) | shrink-first: first cut read +614 B |
| worst N=7→8 seam, `eq(8) − eq(7)` | **−0.700 pt** (`TRIPS_BIG\|RB`) | ≤ 0 on all 123 cells, 3.09 σ of `seDiff` — a cross-artifact check neither file can make alone, and **now a D12(c) clause, not only a test** |
| worst N=8→9 step inside the ring | **−0.500 pt** (`TRIPS_SMALL\|RB`) | ≤ 0 on all 123 cells, 2.21 σ |
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
unblocked. METHODOLOGY should carry it beside limitation 20 — and it must be carried there whatever
the budget says, because the amended budget pays for the TIME the exhaustion costs and does nothing
about what the exhaustion does to the numbers.

> **Re-measured (run 2).** Nothing above moved. The two lattice stages read 624.0 s and
> 601.2 s (6.2× and 6.0× of the shipped S2L's 101 s) against run 1's 584.1 s and
> 599.1 s — the same cost model, ~4 % of machine variance between runs — and the blocked-pool
> fallback counts came back **identical to the unit**: 5,195,877 and 5,210,970, in run 1, in run 2's
> write at four workers, and in run 2's `--check` at eight. The exhaustion is deterministic, which is
> what makes it a property of the construction rather than of the afternoon.

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
- **D12(b)** would need ≈ **597,000 trials per cell** to make 0.32 a 3.5 σ bound — six times the
  measured wall. [Run 2 note, kept beside the run-1 sentence rather than replacing it: that wall was
  then 4× the 300 s pre-registration and is now 0.98× the amended 1,280 s, so the ratio changed and
  the arithmetic did not — six times 1,255 s is over two hours per seed pair.]

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
problem §7 records — run 1 as a blocker, run 2 as the owner's re-derivation. A supporting datum, measured: the number of readings past the
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

**`job.tag` — one field beyond `nMax` in `mc.mjs`, and it is named here because the brief scoped
this lane to the per-call `nMax` option.** The two named seeds have to produce two independent
samples, and `mc.mjs`'s worker body derives every stream name from `job.stage` / `job.key` /
`job.v` — none of which carries a seed. Without a seed-bearing prefix the two seeds would run the
same streams and D12(b) would compare a measurement with itself, which is the one thing the second
seed exists to prevent. So `job.tag` is an OPTIONAL stream-name prefix: absent on every job
`generate-data.mjs` builds, so the v1/v2 streams are untouched **by construction** rather than by
measurement, and set to the seed name on every job `generate-ring.mjs` builds. It is inert at the
legacy settings in exactly the sense §0.4 asks a new mechanism to be, and `test/ring.test.mjs`
asserts a tagless job reproduces the untagged stream.

**The cross-artifact seam is now a GATE clause, not only a test (run 2).** `eqAtSeats` joins
`model.json`'s N ≤ 7 to the ring's N = 8, 9, and nothing inside either file can tell whether the two
halves line up: a ring measured against a different pool, a stale kernel, or a column read off by one
leaves both files internally consistent and the JOIN wrong. Run 1 asserted the seam in
`test/ring.test.mjs`; run 2 also asserts it in D12(c), which reads `data/model.json`'s cells through
`ctx.model` and refuses any cell where the ring's N = 8 rises above the model's N = 7 — **zero
tolerance**, the same discipline as `eq[9] ≤ eq[8]`, with the worst margin printed on the report on a
passing run too. Two fabricated violators cover it, including the one-hundredth-of-a-point case that
proves there is no band hiding in it.

---

## 6. Filed for S3

1. **`variant.mjs` — add a top-level `ring` budget row to BOTH variants.** `ring: 20 * 1024` in
   `VARIANTS.lite.budgets` and `VARIANTS.full.budgets`. Measured injected payload **18,620 B**
   (18.2 K); `ceil(measured × 1.05)` to the whole KB is **20 KB**. D12(d) asserts this from above
   and FAILS while the row is absent — it does so today, naming both variants and printing the exact
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
   registers it, **every clause including (e) is GREEN** on this branch except (d), which is red
   only because item 1's row does not exist yet and goes green the moment S3 adds it. That is the
   one deliberate red, and it is the gate asking for the registration rather than the gate broken.
6. **One `policyDelta`, and it is S1's own, now unblocked by lane R.** Add
   `vDeltaAtSeats(pts, vDelta, v, seats, ring, key)` beside `eqAtSeats` and thread `ring` through
   `villainEq` / `profiledModel`. S1 filed it and deliberately did not ship it because it forces
   `villainEq` to return a nine-long `eq`, which S1 recorded as **one decision with lane R's
   `SIM_NMAX` / `validEqArray` arity split, not two**. Lane R has now made that decision: `SIM_NMAX`
   is a separate name from `NMAX`, `validEqArray` takes the width as an argument, and a nine-long
   `eq` on the sim path is valid, so a nine-long `eq` out of `villainEq` no longer breaks the model
   path. Until the delta lands, the villain-profiled path above N = 7 at nine seats **throws** —
   fail-closed, never silent — and **the ring already ships `vDelta[v][N=8, N=9]` for all 123 cells,
   so the data the delta needs exists.** `eqAtSeats(cell, N, seats, ring, key)` itself needs no
   change: lane R supplies its payload and the `eq` columns work as written.

---

## 7. The adjudication, and the reading under it

Run 1 filed a blocker here. R2's blocker clause had fired exactly as written: the measured two-seed
wall was **1,213.6 s** against a pre-registered **300 s**, R2's halving remedy was measured at
≈ 622 s and eight workers at 660.8 s, so neither could reach the budget, and lane R had no authority
to widen a pre-registration. It did not halve (halving cannot fit and would permanently coarsen
`se.latt` for nothing), did not drop a seed, did not widen, and did not reach for `--force`.

**The owner adjudicated on 2026-09-08, before this relaunch, by amending the plan itself.** The
amendment is in `docs/V4-PLAN.md` in four places — beneath §2.4's derivation, beneath rule R2, in
§4's `ring.meta.wallBudget` row, and in §5.2's D12(e) spec — and it is a re-derivation, not a
widening:

> `2 × (12 × 1.16 + 101 × 6.2) ≈ 1,280 s`, four workers.

It is **the same shape as the derivation it replaces**, `2 × (S2 + S2L)`, with the two per-kernel
coefficients this lane MEASURED (§3.2) in place of the assumed `9/7`. The 300 s derivation is
falsified and is kept as written everywhere it appears — in the plan, in `ring.mjs`'s `WALL_BUDGET`
docstring, in D12's header, and in §3.2 above. What changed is the cost model the pre-registration
rests on, and it changed because it was measured false, which is the plan's own rule for a falsified
prediction.

Three things the amendment explicitly does **not** do, each of which this lane re-checked rather
than assumed:

- **It does not coarsen the measurement.** The lattice ships at the full `generate-data` regime —
  `trials.latt` 100,000, `se.latt` 0.16, identical to `data/model.json`'s. No halving,
  because halving was measured unable to reach even the old budget; nothing is badged `estimate` and
  `ring.meta.se` carries the shipped regime.
- **It does not drop a seed.** Both named seeds ran in full; D12(b) is still a comparison of two
  measurements rather than of a measurement with itself.
- **It does not buy the budget with parallelism.** The budget is pre-registered AT FOUR WORKERS, the
  derivation's own regime. METHODOLOGY :2798 pins that worker count cannot move a number, so a
  larger count is a wall-clock trade and never a way to pass D12(e). This run re-measured at four.

### The reading under it, re-measured this run

| reading | value | against |
|---|---|---|
| two-seed wall, **4 workers** | **1,255.4 s** | `ring.meta.wallBudget` **1,280 s** — inside, at 0.98x of budget |
| R-CELL, seed A / seed B | 15.3 s / 14.8 s | shipped S2's 12 s (the 1.16× the plan predicted, and got right) |
| R-LATT, seed A / seed B | 624.0 s / 601.2 s | shipped S2L's 101 s (the 6.2× the plan predicted linear, and got wrong) |
| `--check` rebuild, **8 workers** | 630.3 s | byte-identical to the 4-worker write, `meta.wallSec` blanked on both sides |

D12(e) is **green** and still fails closed: it asserts `meta.wallBudget === ring.mjs`'s
`WALL_BUDGET` (so a budget edited into the artifact rather than into the code is refused by name) and
`meta.wallSec <= meta.wallBudget`, and `test/ring-gate.test.mjs` fabricates a violator for each — the
budget mutated back to the falsified 300, and a wall of 2,000 s. **No blocker is filed for the wall
this run.**

**The margin is 24.6 s — 1.9 % — and that is stated rather than rounded away.** Run 1 read 1,213.6 s
and run 2 reads 1,255.4 s on the same box with the same seeds and byte-identical output, so ~3.4 % of
run-to-run machine variance is the observed spread of a quantity whose budget has 1.9 % of room. The
re-derivation is honest — it is `2 × (12 × 1.16 + 101 × 6.2)` from measured coefficients, not a
number chosen to clear a measurement — but a slower box, or this box under load, can put a correct
ring over D12(e). That is not a reason to widen anything, and this lane has not: R2 as amended says
exactly what happens then (halve the ring's lattice trials, never drop a seed, and blocker if it
still exceeds), and halving now comfortably fits at ≈ 654 s, which it could not do against 300. The
note is for whoever regenerates the ring next — S3, S5, or the red team — so a machine-variance
failure is read as machine variance and neither widened nor mistaken for a construction change.
`meta.wallSec` is stored precisely so the comparison is against a recorded number rather than a
memory.

### What is carried forward as a finding, not laundered by the budget

§3.2's mechanism stands unchanged and is a **measurement-layer limitation**, not merely a cost:
at nine villains the VPIP-filtered pools cannot be dealt from one deck without distortion. By the
ninth villain 40 of 52 cards are dead; **5.7 % of the ninth villain's v = 25 draws are not from the
range at all** but are random fallbacks after `RANGE_TRIES = 4,000` rejections, and the draws that do
succeed are selected for being unblocked. That belongs in METHODOLOGY beside limitation 20, in S5's
hands. The budget pays for the time it costs; it does not make the tightest pools at nine seats mean
what they mean at six.
