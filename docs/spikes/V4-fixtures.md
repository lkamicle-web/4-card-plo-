# V4 S2 lane F — the fourth fixture kind and the I48–I52 gates. What S3 and the red team read.

Base `33a228f` (S1's `v4-s1-base`, fast-forwarded; `git diff v4-s1-base -- scripts/lib/policy.mjs`
empty). Branch `worktree-wf_3c958a35-f26-6`. At return: `verify` **64/69** with the five reds §5.2
requires, `node --test test/*.test.mjs` **717/717**, `build --check` **2/2 current**, `git status`
carries no `data/` change and no `data/tiers-9max.fixture.txt`.

---

## 1. What was built

| File | What |
|---|---|
| `scripts/lib/tier-fixture-9max.mjs` (NEW, 560 lines) | the fourth kind's library: domain, state, sweep, comparison, the sub-ladder diff and the nesting census |
| `scripts/freeze-tiers.mjs` | a fourth `KINDS` entry selected by `--seats9`, the `:150` selector and `kindFlag` beside it, a `ringPayload()` reader, and a refusal path that prints a census instead of a stack trace. **The three existing entries are untouched**; `--check` is already per-kind and was not generalised |
| `scripts/gates/ring.mjs` (NEW, 700 lines) | I48, I49, I50, I51, I52, D12, D13 — and nowhere else |
| `scripts/gates/reserved.mjs` | seven catalog entries, `status: 'live'` |
| `scripts/gates/index.mjs` | one import, one `REGISTRY` row, seven ids appended to `EXPECTED_IDS` (62 → 69) |
| `test/tier-fixture-9max.test.mjs` (NEW, 10 tests) | the kind, before the fixture exists |
| `test/gates-ring.test.mjs` (NEW, 16 tests) | every clause driven against a fabricated violator |
| `test/gates-reserved.test.mjs`, `test/calibration-gate.test.mjs`, `test/gates-solver.test.mjs` | the registration's other three copies — bookkeeping only, see §6 |

---

## 2. Measurements

### 2.1 The domain — §2.5's prediction, confirmed exactly

| Quantity | Predicted | Measured |
|---|---|---|
| legal (pos, node) pairs at nine seats | 33 | **33** — `{rfi 8, limps 8, raise 8, 3bet 9}` |
| settings | 26,136 | **26,136** = 33 × 66 VPIP × 12 lanes |
| cell tiers | — | **3,214,728** = 26,136 × 123 |
| six-seat domain, unchanged beside it | 21 pairs | **21** |

### 2.2 The fixture's byte size — S3 needs this before it creates the real one

The 720 refused rows (§3) are **bracketed, not estimated**: the encoder's cheapest payload for a row
is `-` and its dearest is a full delta list, so the real file lands between two measured encodings.

| | bytes | KB |
|---|---|---|
| lower (refused rows repeat their predecessor) | 828,605 | 809.2 |
| upper (refused rows differ in every cell) | 864,821 | 844.6 |
| spread attributable to the 720 | 36,216 | +4.37 % |
| mean bytes/row | 31.7 | — |

§2.5 predicted "roughly 0.8 MB". **Confirmed.**

### 2.3 The `extrapolated` census, both sizes — I48(c) and I52(c)

Domain re-derived from V3-BRIEF :211's own enumeration: nodes {rfi, limps, raise} (3bet excluded —
`nEff` returns the constant 2 there) × legal seats × limpers {1,2,3,4} at limps else {2} × straddle
{off, on} × VPIP 25..90.

| seats | domain | clamp | clamped | share | worst raw | by pair |
|---|---|---|---|---|---|---|
| 6 | 3,960 | 7 | **47** | 1.187 % | 8.227 at limps/HJ/v90/4limp/straddled | HJ 33 · CO 12 · BTN 2 |
| 9 | 6,336 | 9 | **19** | 0.300 % | 9.962 at limps/UTG+1/v90/4limp/straddled | UTG+1 14 · UTG+2 5 |

The six-seat **47** is the integer behind V3-BRIEF's recorded 1.19 %, reproduced exactly, and it is
what I48(c) asserts — a percentage is not a gate. Both figures independently reproduce
`docs/spikes/V4-ladder.md` §7. At nine seats the clamp **moves rather than lifts** and the clamped
share **falls**.

### 2.4 The nesting census — I50's evidence, over 16,272 comparisons

| node | comparisons | exact | strict superset | **subset violations** | excess cells | **unexplained** | pre-nesting diffs | refused |
|---|---|---|---|---|---|---|---|---|
| rfi | 3,960 | 3,918 | 42 | **0** | 44 | **0** | 0 | 0 |
| limps | 3,600 | 3,566 | 34 | **0** | 40 | **0** | 0 | 360 |
| raise | 3,960 | 2,750 | 1,210 | **0** | 1,638 | **0** | 0 | 0 |
| 3bet | 4,752 | 4,752 | 0 | **0** | 0 | **0** | 0 | 0 |
| **total** | **16,272** | **14,986** | **1,286** | **0** | **1,722** | **0** | **0** | **360** |

Unioned cells per shared seat, each attributed to the front seat that carried it:

    rfi     LJ 30 (worst 2) <- UTG+2:30 · HJ 10 (1) <- UTG+2:10 · CO 4 (1) <- UTG+2:4 · BTN 0 · SB 0
    limps   HJ 40 (worst 3) <- LJ:38, UTG+2:2 · CO 0 · BTN 0 · SB 0 · BB 0
    raise   HJ 556 (4) <- UTG+1:534, UTG+2:14, LJ:8 · CO 548 (4) · BTN 534 (4) · SB 0 · BB 0
    3bet    chain empty — pre-registered exact, measured exact

### 2.5 Gate count and cost

| | before | after |
|---|---|---|
| `EXPECTED_IDS.length` | 62 | **69** (+7) |
| `CATALOG.length` | 21 | 28 |
| `LIVE_IDS.length` | 20 | 27 |
| `node --test` | 691 | **717** (+26) |
| ring family wall | — | **3,320 ms** (I48 889 · I50 1,769 · I51 653 · I52 6 · D13 2 · setup 1) |
| suite wall | 26,200 ms anchor | **36,074 ms = 86 % of the 41,920 ms soft ceiling** |

**A number S5 must own.** I49 costs 0 ms today because it fails on an absent file. Once S3's freeze
lands it becomes a 26,136-setting sweep — measured at **5.7 s** standalone — which puts the suite at
roughly **42 s, at or just over the soft ceiling**. The ceiling is soft by design and never changes
the exit code, but `WALL_MEASURED_MS` (26,200, four runs on the reference machine) is now describing
a suite two thirds its size. S5 should re-measure it; lane F did not, because a re-pin is a
measurement of the FINAL suite and that suite does not exist yet.

---

## 3. The measured blocker: the nine-seat surface is not solvable today

**This is the finding of the lane.** The v3-default surface at `seats = 9` cannot be frozen with the
policy layer as S1 left it, and it is **not** merely that `data/ring.json` is absent.

Measured over the full 26,136 settings: **25,416 solve, 720 (2.755 %) refuse.** Every refusal is at
`limps`, at exactly the six seats of `nestChain('limps', 9)` — UTG+1, UTG+2, LJ, HJ, CO, BTN — 120
settings each. The split is not uniform across lanes, because the straddler is one more defender
behind every seat: a straddled lane refuses 90 (VPIP 76..90 × 6 pairs), an unstraddled one 30
(86..90 × 6). Worst raw `N_eff` 8.162 at `UTG1|limps`. Two independent causes, both fail-closed:

1. **`solve` never hands the ring down.** `solveUncached` builds `opts = {limpers, raiserPos, env}`
   (`policy.mjs:2258`) and `rankTable` reads `opts.ring` (`:1675`), so `scoreCell` is called with
   `ring === undefined` and `ringCols` throws for every `N_eff > 7` cell **even when the artifact
   exists on disk**. The refusal is correct — it is the silent `cells` read at N > 7 that §0.2
   forbids — but nothing above it can supply what it wants. `docs/spikes/V4-ladder.md` §1 lists
   `solve` among the threaded call sites; measured, the ring is not among what it threads.
2. **Profiled cells refuse the ring columns.** With a payload handed straight to `rankTable`, the
   same settings throw `… is villain-profiled and the ring columns are not — refusing to mix`. At
   profile ON, **all 123 live cells carry `vpSource`** (measured at VPIP 90), so the refusal fires
   on the first cell of every affected row. This is S1's own undelivered `vDeltaAtSeats` policyDelta
   seen from the fixture side, and it means the profile-ON surface at nine seats has 720 unreachable
   settings until it lands.

Note the ordering: `ringCols` checks `!r` before `cell.vpSource`, so cause 1 masks cause 2 today.
Fixing only cause 1 moves all 720 refusals from the first message to the second; both are needed.

**The writer refuses rather than emitting a hole.** `sweepTiers` walks the whole sweep, collects the
census, and throws `NineSeatIncomplete`; `freeze-tiers.mjs` prints the census and exits 1 without
writing. A 25,416-row file wearing a 26,136-row claim would make I49 pass over a domain nobody
chose, which is worse than no file. `test/tier-fixture-9max.test.mjs` pins that behaviour.

---

## 4. Filed for stage S3

### 4.1 policyDeltas (`scripts/lib/policy.mjs` is frozen after S1)

| # | Site | Change | Why the lane cannot proceed without it |
|---|---|---|---|
| F1 | `solveUncached`, `policy.mjs:2258` (and `solve3bet`) | thread `state.ring` into `opts` on both the active and the `refSet` cascade | without it the 9-max fixture cannot be built at all: 720 settings throw even with `data/ring.json` present |
| F2 | `SOLVE_MEMO` / `AGGR_MEMO` keys | add a ring identity (`ring.meta.contentHash`) | with F1 alone, two different rings in one process share a memo entry and the second is handed the first's answer — `envKey`'s own trap one level down. This is why I52's tripwire goes through the un-memoised `rankTable` |
| F3 | `vDeltaAtSeats(pts, vDelta, v, seats, ring, key)` + `ring` through `villainEq` / `profiledModel` | S1's own filed delta | the 9-max fixture is profile-ON by §2.5; without it every affected cell refuses. Bound up with lane R's `SIM_NMAX` / `validEqArray` arity split, as S1 said |
| F4 | `CONSTANTS.ladder.census` | add `{domain, clamp, clamped, byPair}` at nine seats, computed by R3's method | I52(c) asserts a shipped census against a live recount and there is no shipped census to be stale against. The numbers are §2.3's; the gate recounts them every run |

F1–F3 are ordered: F1 then F3 then F2 (F2 is only reachable once something threads a ring).

### 4.2 Decisions only S3 can take

- **I51(c) and lane K's R5 exception lists.** The 12 new pairs include `UTG1|…`, `UTG2|…`,
  `LJ|limps`, `LJ|raise` — new seat keys — and `UTG|rfi`, `UTG|3bet`, which raise the legacy count.
  Both clauses will fire on lane K's work. §1's table calls those lists "measured, not derivable",
  which is the strongest case in the repository for a hand-keyed seat name; the resolution is to add
  `scripts/lib/skill.mjs` to `ALLOW` in `scripts/gates/ring.mjs` **with its reason**, or to have
  lane K key them structurally. The gate firing is the mechanism that forces that decision into the
  open; do not move `LEGACY_PIN` to make it quiet.
- **`src/shell.html` and the allowlist.** §2.6 has the rail render `seatsFor(seats)` and take labels
  from `SEAT_DISPLAY`, so the page should need no key of its own. If lane U finds it does, that is
  the same deliberate allowlist decision.
- **The seven gate stamps.** `verify.mjs` writes `model.gates` only on a run it completes, and five
  of the seven are red by design, so the stamps cannot land until S3 closes them. `test/gates-reserved.test.mjs`
  carries a **named, exact** exception for precisely those seven; when a clean verify writes all 69,
  delete `PENDING_V4` and the assertion collapses back to the equality it was.
- **`WALL_MEASURED_MS`** — §2.5's last paragraph.

### 4.3 The freeze ceremony, when the deltas have landed

    node scripts/freeze-tiers.mjs --seats9        # NO --force, ever, this run

It prints the settings count, the scope line, the **sub-ladder diff** against
`data/tiers-v3-default.fixture.txt` (§2.5's committed evidence) and the **nesting census** of §2.4.
Expect a file between 809.2 and 844.6 KB. Then re-run `verify.mjs` **without** `--no-write` so the
seven stamps land, and re-run `build --check`.

---

## 5. Predictions confirmed, refined and falsified

**Confirmed exactly.** §2.5's 33 legal pairs and 26,136 settings. §2.5's "roughly 0.8 MB".
V3-BRIEF :211's 1.19 % as the integer 47 over 3,960. `docs/spikes/V4-ladder.md` §7's nine-seat
census (19/6,336 = 0.300 %, worst 9.962). §5.2's containment direction at rfi: 0 subset violations.
R4's enumeration: **0 pre-nesting differences of any kind** over 16,272 comparisons, so I50's
clause (iii) holds as equality, which is stronger than the monotone wording it was written to.

**Refined, recorded not patched.** §5.2 predicted the nesting post-pass would bite at `rfi`. It bites
at `limps` and `raise` too, and `raise` is where it bites hardest — independently reproducing
`docs/spikes/V4-ladder.md` §6. I50 is therefore written as containment at all three, not at rfi alone.

**Falsified, measured.**

1. **§2.5's freezability.** The plan describes the 9-max fixture as a thing this run creates. Measured,
   it cannot be created at all until F1 and F3 land: 720 of 26,136 settings refuse. §3.
2. **`docs/spikes/V4-ladder.md` §1's threading claim.** It lists `solve` among the sites that carry
   `ring`. `solveUncached` does not; `opts` at `:2258` has three keys. §3, cause 1.
3. **`docs/spikes/V4-ladder.md` §10's literal count.** S1 records "331 across 34 files". This gate's
   own scanner — every occurrence of each legacy key in comment-stripped, git-tracked
   `.mjs/.js/.html` under `scripts/ src/ test/` — reads **655 across 38** on the same tree, and lane
   F's two new files contribute **zero** of it. Neither number is wrong; they are two different
   measurements. `LEGACY_PIN` is this scanner's own reading, because a pin its own code cannot
   reproduce is a pin nobody can debug.
4. **My own S1-comparison at `raise`.** `docs/spikes/V4-ladder.md` §6 reports raise as 3,136 exact /
   824 strict superset / 322+320+320 unioned. This lane measures 2,750 / 1,210 / 556+548+534. The
   two count **different objects**: S1's table is the painted TIER vector, this census is the
   pre-display AGGRESSIVE SET, and at `raise` — and only at `raise` — the vs-3-bet value whitelist
   (`nu3betMin` plus the AA / DBLPAIR_BIG / BROADWAY_RUN allowlist, `policy.mjs:2336–2343`) demotes
   many unioned cells back out of T1/T2 before they reach a fixture. `rfi`, `limps` and `3bet` agree
   with S1 **to the cell**, which is what identifies the whitelist as the whole of the difference.
   Both objects are legitimate; I50 scores the aggressive set because that is the set the nesting
   cascade is defined on, and reads the tier claim off the frozen files where the whitelist has
   already been applied.

---

## 6. The registration, and the three other copies

`scripts/gates/index.mjs:161` compares the families' declared sequence against the frozen
`EXPECTED_IDS` literal and the runner **throws** — it does not fail a gate — on a mismatch. That is
why §7.2 gives this file one writer, and why all seven ids went in **one** edit, appended, never
interleaved: 62 stays a strict prefix of 69.

Registering seven ids touches **four** copies, not three, and the fourth is a test:

1. `scripts/gates/reserved.mjs` — seven entries, `status: 'live'`.
2. the family's `ids` — `scripts/gates/ring.mjs`.
3. `EXPECTED_IDS` — `scripts/gates/index.mjs`.
4. `test/gates-reserved.test.mjs` — `PLAN_V4_S52`, `LIVE_IDS`, the count 62 → 69, the literal count,
   and the `model.gates` exception of §4.2. Two more tests carry the tail's arithmetic:
   `test/gates-solver.test.mjs` (`EXPECTED_IDS.length - 12` → `- 19`, and the slice) and
   `test/calibration-gate.test.mjs` (I46 is no longer last; it is now the end of the **v3 prefix**,
   which is the property that was worth pinning all along).

**D12 is registered here and its clauses are lane R's.** `scripts/gates/ring-artifact.mjs` is
**not** a family and must **not** be added to `REGISTRY` — it would emit D12 twice and the runner
would throw. `ring.mjs` loads it through a guarded dynamic `import()` and accepts either shape lane R
wrote: a `d12(ctx)` clause function returning `{pass, detail}`, or a family-shaped module with
`build(ctx)` whose D12 section is run against this runner's own `G`. **So there is nothing for S3 to
reconcile in either direction.** The dynamic import is also why the whole registry does not fall over
in a worktree that lacks the file.

**I48 is claimed deliberately.** `test/payoff-model.test.mjs:24` names I48 as an id it declined to
invent — *"Inventing I48 here would be exactly what `scripts/gates/reserved.mjs` was written to
prevent: a gate id chosen after the feature is a gate written to pass."* That comment forbids
choosing an id **after** the feature, to fit code already written. §5 reserved I48 **before** one, in
the plan, with its claim written out. Those are opposite acts and the two do not conflict. The
comment stands unedited; `reserved.mjs` carries the written justification; `test/gates-ring.test.mjs`
asserts that **both** copies survive, wrap-normalised so a reflow cannot silently retire either.
Skipping to I53 to dodge the question would have been the dishonest move — a hole in the sequence
hiding a decision nobody wanted to write down.

---

## 7. The five reds, and the exact line each turns green on

Every one fails **closed** on a subject a later step produces. None passes vacuously; a loop in
`test/gates-ring.test.mjs` asserts that for the three whose subject is wholly absent.

| gate | detail line, verbatim | who closes it |
|---|---|---|
| **I49** | `9-max tier reproduction — fixture absent at data/tiers-9max.fixture.txt — stage S3's ceremony creates it: node scripts/freeze-tiers.mjs --seats9` | S3, after F1 + F3 |
| **I50** | `(i) fixture absent at data/tiers-9max.fixture.txt — the sub-ladder tier diff has nothing to read until stage S3's freeze` — clauses (ii) and (iii) are **green**: 0 subset violations, 0 unexplained, 0 pre-nesting differences | S3, same freeze |
| **I52** | `(a) no data/ring.json — the ring artifact is lane R's…`; `(b) src/shell.html declares no SIM_NMAX`; `(c) constants.ladder.census is absent` | lane R, then S3 (F4) |
| **D12** | `the ring artifact — scripts/gates/ring-artifact.mjs is not present — lane R has not landed` | lane R |
| **D13** | `no blocks.ring cap` × 2 variants, `no top-level ring artifact budget` × 2, `index.html carries no @block:ring region` × 2 | lane U (block) + S3 (caps) |

**I48 and I51 are green now**, and both were driven against fabricated violators: a `git diff` row
showing a legacy fixture as `M`; `ladder.earlyStep` nudged off `straddle.seat`; an inverted opening
ladder; `ladder.derived.kind` flipped off `'estimate'`; a stray new seat key in a file outside the
allowlist, reported by `file:line`.

---

## 8. Notes for the red team

- **`--force` appears nowhere in this run's history.** `data/tiers-9max.fixture.txt` does not exist;
  `git status` carries no `data/` change; the three legacy fixtures are green (I22, I32, and the v3
  pin under `node --test`). I48(a) reads the diff **shape** across `e801f07..HEAD` — the base is
  `RUNDOWN_V4_BASE` when S6 supplies it, and otherwise the commit that added `docs/V4-PLAN.md`,
  which is the run's own base by construction. The fallback is not a quiet one: with no base at all
  the clause **fails** rather than going silent.
- **I48(b) is armed before the artifact exists.** With no `data/ring.json` it synthesises an
  all-zero payload over the model's own live cells — a strictly harsher perturbation than zeroing a
  real one — and runs through `rankTable`, never through `solve`. A tripwire routed through `solve`
  would measure nothing at all today and report green, which is the trap §3 cause 1 sets.
- **`preNesting` is a reconstruction of `aggressiveSetUncached`**, needed because `aggressiveSet` is
  memoised on a key that omits the ring. `test/tier-fixture-9max.test.mjs` greps policy.mjs for the
  five lines it reproduces, so the copy cannot drift from its original in silence.
- **The lane typed no seat number and no seat name.** `RAISER` is `seatsFor(6)[2]`, not `'CO'`;
  `SEATS` is the last member of `constants.ladder.seats`, not `9`. I51(c)'s scan reads zero new-key
  literals and zero added legacy hits from either of lane F's two new files.
