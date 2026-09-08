# V4 S2 — lane K. The skill exceptions at nine seats, and the table-size-neutral prose.

Base: S1's tree (`v4-s1-base`, fast-forwarded into this worktree; `git diff v4-s1-base -- scripts/lib/policy.mjs`
empty). Written against docs/spikes/V4-ladder.md, V4-PLAN §0.2, §2.6, §3 (R5), §5.1, §6, §10 Q1, and
METHODOLOGY §3.5.

**State at return.** `node scripts/verify.mjs` **62/62, exit 0**. `node --test test/*.test.mjs`
**700 of 701** — the one red is `test/equilibrium.test.mjs`'s `sourceHash() === EQ.meta.generatorHash`,
which is the expected, pre-agreed consequence of editing `equilibrium.mjs` / `cfr.mjs` and is cleared
by S3's single regeneration (§7 below; docs/spikes/V4-ladder.md §9 predicted exactly this).
`node scripts/build.mjs --check` **2/2 current**. `node scripts/generate-checkdown-matrix.mjs --check`
byte-identical. `node scripts/generate-equilibrium.mjs --check` FAILS with its own "the SOURCE
drifted" message, same cause, same fix.

---

## 1. What was built

| # | File | What changed |
|---|---|---|
| 1 | `scripts/lib/skill.mjs` | `WIDTH_ENDPOINT_EXCEPTIONS_9` (9 entries) and `WIDTH_INTERIOR_EXCEPTIONS_9` (20), measured; `WIDTH_EXCEPTIONS[9]` stops being `null`; `seats` threaded into `widthProblems` clause (iii) |
| 2 | `scripts/lib/cfr.mjs` | `SIXMAX` → **`MULTIWAY_DEFERRAL`**, prose made table-size-neutral; `sixmaxDeferralProblems` → `multiwayDeferralProblems`; evidence and legs untouched |
| 3 | `scripts/lib/equilibrium.mjs` | `coverageMap(seats = 6)`; the `:710` `NEST_CHAIN` literal → `nestChain('rfi', 6)` (still six-seat-scoped); two shipped `notes` strings follow the rename |
| 4 | `scripts/gates/baseline.mjs` | I36(d) re-read at nine seats (3 of 36 / 33), the `24` literal made structural, the domain-label arming taken over both ladders, rename followed |
| 5 | `scripts/gates/solver.mjs` | rename only (I35 and I36 quote `.reopenRule` / `.reopenVerdict`; a half-done rename breaks them) |
| 6 | `test/skill-9max.test.mjs` | **new**, 10 tests: the records re-derive in both directions, armed against a perturbed model, plus the reach scan, the coverage reasons and the rename |
| 7 | `test/ladder.test.mjs`, `test/cfr.test.mjs`, `test/equilibrium.test.mjs` | the assertions my lane's measurement invalidates: S1's `WIDTH_EXCEPTIONS[9] === null` clause, and the rename's readers |

Nothing else was opened. `policy.mjs` untouched (0 policy deltas filed — §6).

---

## 2. R5 — the twelve pairs. **§10 Q1 answered, and the plan's own gloss falsified.**

`positionDisabled(…, 9)` disables exactly three pairs of the thirty-six, and they are the same three
structural facts as at six: `BB|rfi` ("BB closes the unopened pot by checking"), `UTG|limps` and
`UTG|raise` ("no one acts before UTG"). **33 legal at nine, 21 at six — S1's count reproduced, and no
node carries a second structural exclusion.**

But "the 12 new pairs" has **two derivations and they are not the same twelve**:

| derivation | the twelve | contains |
|---|---|---|
| **by KEY** — `legalPairs(9) \ legalPairs(6)` | `UTG1`, `UTG2`, `LJ` × all four nodes | `LJ|rfi`, `LJ|3bet` |
| **by LADDER POSITION** — legal at nine minus the image of legal-at-six under the `i+3` embedding | `UTG|{rfi,3bet}`, `UTG1|×4`, `UTG2|×4`, `LJ|{limps,raise}` | `UTG|rfi`, `UTG|3bet` |

Both are 12; both contain `LJ|limps` and `LJ|raise`; they differ on exactly **two pairs each way**.
The plan's §3 R5 enumeration is the POSITION reading, while R5's own gloss — "the ones
`positionDisabled(…, 9)` newly makes legal" — describes the KEY reading, and `UTG|rfi` / `UTG|3bet`
are legal at six seats already, so the gloss cannot produce the enumeration. docs/spikes/V4-ladder.md
carries both too: its §1 says the set is `legalPairs(9) \ legalPairs(6)`, its §3 lists the position
reading.

**The position reading is the one that describes the measurement, and that is measured, not argued.**
Over I38(e)'s 14,760 nine-seat readings the realization the pipeline uses differs from the
*seats-blind* `realization(pos, N, nu, d)` at **5,535** of them — exactly the nine non-3bet pairs of
the KEY reading (615 readings each), because a seats-blind lookup of `baseR['UTG1']` returns
`undefined` and NaNs. The pair whose measurement is genuinely new and whose KEY is old, `UTG|rfi`, is
invisible to that check: `baseR` is flat, so nine-max UTG reads the same `0.97` six-max UTG does.
Neither reading may be used alone to decide "which pairs to measure" — **the shipped records cover all
33 legal pairs**, which is the only self-consistent answer and the one `widthProblems` compares in
both directions. Both derivations are pinned in `test/ladder.test.mjs` so the disagreement cannot be
quietly resolved by whoever edits next.

---

## 3. The procedure REPRODUCES — so the new pairs ship WITH exceptions

R5's fallback ("if the procedure is not reproducible from the docs, that is a finding, the new pairs
ship without exceptions, I38(e) is extended to say so") is **not taken**. METHODOLOGY §3.5 states the
procedure completely enough to re-run: the five-point `SKILL_GRID` (three detents plus the two
off-lattice midpoints), `SWEEP_RAISER = 'CO'`, `limpers: 2`, painted combo-weighted width from
`solve().width`, endpoint = "wider at s = 1 than at s = 0", interior = "wider at step i than at i−1".
Re-run at six seats it reproduces **both frozen arrays exactly** — 6 endpoint entries in order, 11
interior entries — and `widthProblems(model)` returns `[]`. That reproduction is asserted in
`test/skill-9max.test.mjs` as R5's precondition, not assumed.

### 3.1 The nine-seat measurement

Aggregate combo-weighted width over the 33 pairs, along the dial (pool VPIP 55 / 47.5 / 40 / 32.5 / 25):

    9 seats   13.0859 %  ->  12.6283  ->  12.3382  ->  11.7812  ->  10.9549     monotone, tightens
    6 seats   16.1244 %  ->  15.7909  ->  15.2985  ->  14.7598  ->  13.7561     (P4, unchanged)

**Endpoint exceptions: 9 of 33 pairs** — every seat's `3bet`, i.e. the six-seat record continued onto
the three seats the ladder adds. Each widens by **0.1729 points**, each through the same two cells
(`BROADWAY_RUN|DS`, `BROADWAY_RUN|SSA`) making the same `T3 -> T2` move, so `WIDTH_ENDPOINT_CELLS` and
`WIDTH_ENDPOINT_MOVE` are shared across both sizes rather than re-keyed. Expected: at `3bet`
`nestChain` is empty, so no seat's answer can depend on the seats in front of it.

**Interior exceptions: 20 (pair, step).**

    the relabel, 9        UTG|3bet@1 UTG1|3bet@1 UTG2|3bet@1 LJ|3bet@1 HJ|3bet@1
                          CO|3bet@1 BTN|3bet@1 SB|3bet@1 BB|3bet@1
    the granularity, 11   UTG2|rfi@1 HJ|rfi@1 BTN|rfi@2 · UTG2|limps@3 LJ|limps@2
                          LJ|limps@3 HJ|limps@4 BTN|limps@3 · HJ|raise@2 CO|raise@2 BTN|raise@2

### 3.2 Mechanism, measured cell by cell rather than carried over

35 cells cross INTO the aggressive mass across the twenty steps. `N` falls at every one of the 11
granularity steps (that is the axis working). Of the 35: **9** are MIX cells whose T4 overlay stops
straddling the cut (so they start counting as aggressive mass again), **18** are the nine relabels'
two cells, **8** are plain cut crossings. At **4 of the 11** granularity steps the falling `N` also
crosses `nutGate[2] = 3.0` — `UTG2|rfi@1` (3.024 → 2.718), `HJ|limps@4` (3.154 → 2.875),
`BTN|limps@3` (3.025 → 2.830), `HJ|raise@2` (3.071 → 2.895) — and at the other 7 it does not.

> **Falsified, recorded not patched.** The six-seat record's docstring and METHODOLOGY §3.5 both say
> the five non-3bet interior rises are "nut-gate releases where `N_eff` falls below `nutGate[2]` and a
> block of cells stops being demoted". Measured: **2 of those 5** steps cross the threshold
> (`BTN|limps@3`, `HJ|limps@4`); `UTG|rfi@1`, `HJ|rfi@1` and `BTN|rfi@2` all happen at `N` between
> 1.7 and 2.8, nowhere near 3.0. And **0 of the 35** crossing cells (at either table size) carried the
> `gated` flag at the step before. The sentence is not wrong about *a* mechanism — `aggressiveSet`
> applies the same gate invisibly, without setting `gated` — it is wrong that the gate is what fires
> at those three steps. The six-seat arrays are frozen bit-for-bit and were NOT touched; the nine-seat
> docstring states what was measured; **METHODOLOGY §3.5's sentence is S5's to repair** (§7).

### 3.3 What the seat axis did to the six-seat exceptions

Compared by ladder position (six-max `i` against nine-max `i+3`, so six-max UTG ≡ nine-max LJ):
**16 of the 21 shared pairs have bit-identical width vectors at both table sizes**; 5 differ, and all
5 are the nesting post-pass S1 measured — `UTG|rfi`→`LJ|rfi` and `HJ|rfi` at s = 0, and
`HJ|raise` / `CO|raise` / `BTN|raise` at exactly one setting each (s = 0.5).

* **One six-seat exception is ERASED by the seat axis:** `UTG|rfi@1` maps to `LJ|rfi@1`, which does
  **not** rise at nine seats — LJ's s = 0 width starts at 13.6049 % instead of 13.4705 % because the
  post-pass unions UTG/UTG+1/UTG+2's rfi sets into it, and the step falls instead of rising.
* **Three new shared-seat exceptions are CREATED by it:** `HJ|raise@2`, `CO|raise@2`, `BTN|raise@2` —
  `nestChain('raise', 9)` runs UTG+1..BTN, so those three gain unions at a node where six seats has no
  front seats to supply any. This is S1's §6 "`raise`, not `rfi`, is where nine-seat nesting bites
  hardest" showing up on a different surface.

### 3.4 How many of the twelve got an exception

| reading of "the 12" | endpoint | interior entries | **distinct pairs with any exception** |
|---|---|---|---|
| by position (R5's enumeration) | 3 (`UTG\|3bet`, `UTG1\|3bet`, `UTG2\|3bet`) | 7 | **6 of 12** |
| by key | 3 (`UTG1\|3bet`, `UTG2\|3bet`, `LJ\|3bet`) | 7 | **6 of 12** |

The six by the position reading: `UTG|3bet`, `UTG1|3bet`, `UTG2|3bet`, `UTG2|rfi`, `UTG2|limps`,
`LJ|limps`. Zero would have been a legitimate recorded answer under R5; it is not the answer.

### 3.5 The measurement owes nothing to lane R

The largest `N_eff` anywhere in the nine-seat sweep is **4.995**, against `nMax(6) = 7`, so
`eqAtSeats` / `rhoAtSeats` never leave the shipped `cells[*].eq` columns: **0 settings needed
`data/ring.json`** and none threw. Had the sweep's own settings reached past seven (S1 measured 360
such settings on the *census* surface, at 4 limpers with a straddle) this record would have been
unmeasurable until S3. Asserted in the new test, because it is the reason lane K could measure at S2.

---

## 4. The rename

`SIXMAX` → **`MULTIWAY_DEFERRAL`** (`scripts/lib/cfr.mjs`), and `sixmaxDeferralProblems` →
`multiwayDeferralProblems` with it — the record's own detector, named after the same table size.
**Reasoning untouched:** `status`, `budgetCriterion`, `claimScope` (`fixed-point-only`), `revisitWhen`,
all four `reopenRule` legs with their verdicts and measured text, and `reopenVerdict`'s "NOT MEASURABLE
in the HU domain" are the same claims; only the sentences that made a payoff-domain fact sound like a
table-size fact moved ("a fixed point of that is not a fixed point of **multiway** PLO, at six seats or
at nine"). **I35(d) is green**, and so are I35's other clauses and I36(b), which quote the record.

Readers updated: `scripts/gates/solver.mjs` (16 mentions + 7 calls), `scripts/gates/baseline.mjs` (5),
`test/cfr.test.mjs` (4 + 3), `test/equilibrium.test.mjs` (2), and `equilibrium.mjs`'s docstring plus its
two shipped `notes` strings.

**One site keeps the old name deliberately: `cfr.mjs`'s `CAPS.omitted` line** `'no seats beyond the
blinds — six-max is deferred, see SIXMAX'`. That string is not prose, it **ships**: verbatim into
`data/equilibrium.json`'s `caps`, `data/model.json`'s `baselineTiers.caps` and both built pages
(`grep -c "see SIXMAX"`: 1, 1, 1, 2). I35 clause (e) audits the on-screen list against the live array,
and `generate-equilibrium.mjs --check` additionally compares the freshly built block against
`data/model.json`'s, so editing it without rewriting those four artifacts in the same step turns I35
red and the generator's `--check` with it. `data/model.json` is S3's/S5's file. Filed in §7; a comment
at the site says the same thing so the next reader does not "fix" it in isolation.

---

## 5. The disabled reasons — 33 of 36, through the same machinery

`coverageMap(seats = 6)` now walks `seatsFor(seats) × NODES`. Measured:

| seats | rows | covered | uncovered, each carrying `NOT_HU_REASON` |
|---|---|---|---|
| 6 | 24 | 3 | **21** |
| 9 | 36 | 3 | **33** |

The covered three are the solved HU tree's own — `SB|rfi`, `BB|raise`, `SB|3bet` — and **not one of
them is a seat the ladder adds**, so the covered set is identical at both sizes. The denominator is
ALL pos × node and not the legal subset, which is what makes it **33 and never 30** (the same reading
that gives 21 and not 18 at six seats).

**Six seats is inert, proven rather than claimed:** `JSON.stringify(coverageMap())` is identical to
`data/equilibrium.json`'s `coverage` AND to `data/model.json`'s `baselineTiers.coverage`. The nine-seat
map is **not shipped**: §0.2 ships no multiway baseline, the block's 12 KB sub-budget is bought for
tiers, and every row the ladder adds is uncovered by construction. The page renders the nine-seat
reasons from the shipped `notCovered` datum plus its own rail — lane U's wiring, and lane U should know
that `src/shell.html:8844`/`:8866` currently derive the "N of M" sentence from `bb2.coverage.length`,
which reads 24 at any table size.

**I36(b) stays six-seat-scoped.** The `['UTG','HJ','CO','BTN']` literal in `nestingReadiness` is gone —
it was one of the five re-typed `NEST_CHAIN` copies — but what replaced it is `nestChain('rfi', 6)`,
not `nestChain('rfi', seats)`. Generalising it would silently change what the armed clause ("fails the
day a payload covers two seats of the UTG/HJ/CO/BTN chain") means, since the nine-seat rfi chain is
seven seats long. The baseline is heads-up at every table size, so the six-seat chain is the whole of
what this check has ever had to watch. `payload.anchors.nesting.chain` is unchanged in value.

---

## 6. `policyDeltas`: none

Nothing in this lane needed `policy.mjs`. The one thing that came close is `widthProblems` clause
(iii)'s seats-blind `P.solve` — fixed **inside `skill.mjs`** by threading the `seats` the function
already takes. Left seats-blind it would not have thrown: `realization('UTG1', …)` reads
`baseR['UTG1']` out of the six-seat object, gets `undefined`, and returns **NaN** for every cell, so
clause (iii) would have reported whatever a NaN-ordered table produced as "the cells this pair loosens
through". Pinned in `test/skill-9max.test.mjs`.

---

## 7. Filed for S3 / S5 / lane F / lane U

1. **REGENERATION (S3, blocking the one red test).** `node scripts/generate-equilibrium.mjs` — rewrites
   `data/equilibrium.json` and, surgically, `data/model.json`'s `baselineTiers` — then rebuild both
   variants. The dry run validates today (`--dry`, 0.7 s, 0 validation failures). **Measured delta:
   +22 B** on `data/equilibrium.json` and the same in the full page's `@inject:eq` region: the two
   `notes` strings gain `MULTIWAY_DEFERRAL` for `SIXMAX` (+11 each) and nothing else in the payload
   moves (`coverage`, `caps`, `anchors.nesting.chain`, every strategy identical; the solve reads
   nothing I touched). `baselineTiers` does not change at all, so D6's 12 KB sub-budget is unaffected.
2. **GATE CLAUSE — I38(d)/(e) domain (S3; `scripts/gates/skill.mjs` is nobody's file this run).** The
   gate calls `SK.widthProblems(model)` and builds `pairs = SK.legalPairs()` at six seats, so today it
   sees 21 pairs and **9,225** reach-scan readings and the nine-seat records ship measured but
   ungated. Extending it needs three edits: `widthProblems(model, SKILL_GRID, 9)` beside the six-seat
   call; `legalPairs(9)` for the (c)/(e) sweeps; and **the `seats` argument threaded into the (e)
   probe's `P.solve` and `P.realization`** — without the latter the probe compares a nine-seat `R`
   against a seats-blind formula and reports 5,535 false mismatches. Measured target: **14,760**
   readings, **0** mismatches. Until that lands, `test/skill-9max.test.mjs` re-derives both records in
   both directions on every `node --test` run, armed against a perturbed model.

   **THE BRIEF'S "all 12 new pairs" IS FALSIFIED FOR THE (e) PROBE, and the number is 9, not 12.**
   Clause (e)'s reach scan opens with `if (node === '3bet') continue;` — *the vs-3-bet node is not
   scored through `R`* — at BOTH table sizes, so three of the twelve (`UTG|3bet`, `UTG1|3bet`,
   `UTG2|3bet`) are outside the probe by a pre-existing structural exclusion, not by anything this
   lane did or failed to do. Measured, extended to nine seats: 24 non-3bet pairs scanned (15 at six),
   **9 of the 12** new pairs reached — and `LJ|limps` and `LJ|raise`, the two the brief singles out
   because a name-keyed procedure would skip them, ARE both among the 9. The other three are covered
   instead by (c)/(d): `legalPairs(9)` puts all 33 pairs in the gate's pair list and
   `widthProblems(model, SKILL_GRID, 9)` re-derives both records over all 33 in both directions, and
   all three of those pairs carry an endpoint exception there. So the twelve ARE gated; what is 9
   rather than 12 is the reach probe specifically. Today, unextended, the probe reaches **1** of the
   12 (`UTG|rfi`, whose key is a six-seat key already).
3. **METHODOLOGY (S5).** (a) the four `SIXMAX` sites §6 names — :3406, :3425, :3565 (I35), :3566 (I36)
   — become `MULTIWAY_DEFERRAL`; (b) §3.5's "five nut-gate releases" sentence is falsified as worded
   (§3.2 above) and needs the measured wording; (c) §3.5's exception paragraphs gain the nine-seat
   record — 9 endpoint / 20 interior, the erased `UTG|rfi@1`, the three new `raise@2` rises;
   (d) I36(d)'s coverage datum reads "3 of 24 … the other 21" at :3405 and now also 3 of 36 / 33 at
   nine.
4. **THE SHIPPED CAP-LIST STRING (S3 + S5).** `'no seats beyond the blinds — six-max is deferred, see
   SIXMAX'` still names the old constant in four artifacts. Repairing it is a `cfr.mjs` one-liner plus
   the same regeneration as (1), and it must be done in ONE step or I35(e) goes red. It is table-size
   prose in a shipped surface, so §6's "table-size-neutral at all sites" is not finished until it is.
5. **LANE F / I51(c) — A COLLISION WITH NO SHARED FILE TO CATCH IT (S3 must adjudicate).** Lane F is
   writing I51(c), "no new seat-name literal", in parallel and cannot see this lane's tree. This lane
   necessarily ships **13 lines carrying `UTG1` / `UTG2` / `LJ` as string literals**, and every one of
   them is a frozen MEASUREMENT RECORD or a test pinning a derivation against one — never a consumer
   building a seat list, which is what the rule is actually about:
   - `scripts/lib/skill.mjs` :170, :207, :208, :210 — the two nine-seat exception arrays. They are the
     exact idiom of the six-seat arrays above them (`'UTG|3bet'`, `'BTN|limps@3'`), which I38(d) has
     read since P4, and they are re-derived in BOTH directions by `widthProblems` on every run, so a
     wrong literal here fails a gate rather than hiding in one.
   - `test/skill-9max.test.mjs` :138-139 — the twelve pairs, pinned as the enumeration R5 names.
   - `test/ladder.test.mjs` :250, :254-256, :268-270 — the two twelves, pinned so that their
     *disagreement* (§2) cannot be silently lost. This follows S1's own precedent in this same file,
     which "carries the deleted literals verbatim and compares against them".

   **Recommendation:** I51(c)'s allowlist should read *records and their tests* alongside `LADDER9`,
   `seatsFor`, the fixtures and the display map — the plan's list of exempt sites was written before
   these records existed. If instead I51(c) is written as a bare scan of `scripts/` and `test/`, it
   goes RED on integration against work that is correct, and neither lane's gates can see it coming
   because F and K share no file. Flagged here because the contention registry has no other channel
   for it.
6. **LANE F / registry prose.** `scripts/gates/reserved.mjs` mentions `SIXMAX` at :200, :306 and :316
   (descriptions only, nothing executes them). Lane F is that file's single writer this run; the
   rename should ride along with the seven id registrations.
7. **LANE U / page prose.** `src/shell.html:8868` says "six-max is deferred on the payoff's domain",
   which is the same table-size framing in the reader's own words, and :8844/:8866 derive the coverage
   sentence's denominator from the shipped 24-row map (§5).
8. **No byte ceiling is claimed or needed by this lane** beyond (1)'s +22 B, which lands in the full
   variant's `equilibrium` block (69.6 KB today) and not in `appCore`.

---

## 8. Predictions: what held, what moved

| prediction | source | measured |
|---|---|---|
| 33 legal (pos, node) pairs at nine seats, no second structural exclusion | §10 Q1, S1 | **held** — 33, three exclusions, all structural |
| the 12 new pairs are `UTG\|{rfi,3bet}`, `UTG1×4`, `UTG2×4`, `LJ\|{limps,raise}` | §3 R5 | **held as an enumeration, falsified as a gloss** — `positionDisabled(…,9)` "newly makes legal" a *different* twelve (§2) |
| the procedure may not be reproducible from the docs | §3 R5 | **falsified** — it reproduces both six-seat arrays exactly |
| I36(d) at nine seats is 3 of 36, 33 uncovered | §2.6, §5.1 | **held** — and 30 would have been the error the plan warned about |
| the nine-seat interior rises are the nut gate | METHODOLOGY §3.5, carried over | **falsified** — 4 of 11 cross the threshold at nine, 2 of 5 at six, 0 of 35 crossing cells were `gated` |
| every exception is a property of the seat, so the six-seat entries carry over | implicit in "the ladder is inert at the shared seats" | **falsified in both directions** — the post-pass ERASES `UTG\|rfi@1` at its nine-seat position and CREATES three `raise@2` rises at shared seats |
| the deferral record's reasoning survives the rename | §0.2, §6 | **held** — I35(d) green, all four legs and the verdict unmoved |
| I38(e)'s reach scan "must see all 12 new pairs" | S2 lane K brief | **falsified as worded** — clause (e) skips the vs-3-bet node at BOTH sizes (`R` is null there), so the probe reaches **9 of 12**; `LJ\|limps` and `LJ\|raise` are both among the 9, and the 3 vs-3-bet pairs are gated by (c)/(d) over all 33 instead (§7 item 2) |
| extending I38(e) to nine seats is a matter of passing `seats` | implicit | **held, with a trap measured** — `P.realization` must take `seats` too, or the probe reports **5,535** false mismatches out of 14,760 |
