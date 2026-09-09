# V4 S3 — integration and the fixture freeze. The merge record, the deltas, the bytes, the ceremony.

Base `v4-s1-base` (`c76720d`), amended to `08132fc` by the bookkeeping step below. Merged R, U, F, K
in that order. **GREEN, re-measured on this tree at run 3** (§8c): `node scripts/verify.mjs`
**69/69, exit 0** · `node --test test/*.test.mjs` **787/787** · `node scripts/build.mjs --check`
**2/2 current** · **all four fixtures reproduce with empty diffs and are byte-unchanged** · all
three `--check` generators byte-identical · `smoke` 2/2 with the three morph rows unmoved at
8/16/4 ms · `browsers` 2/2 in three engines. **No `--force` anywhere in this run's history**, and
`data/tiers-9max.fixture.txt` did not exist when the ceremony began. Run 2's single blocker — the
ring's provenance hash — was cleared by the owner on this tree by regeneration; **§8b records the
clearance and keeps the design finding as a finding.**

---

## 0. Run 3 — what was CONFIRMED by observation rather than redone

Run 3 is a **continuation of the S3 that already ran**, not a second integration. The owner's
adjudication of 2026-09-08 overrides step 1's STOP clause (`git diff v4-s1-base` is non-empty
*because the lanes are merged*) and step 6's STOP clause (the fixture exists *because run 2 created
it*, with one plain `--seats9` run). **No history was touched, no lane re-merged, no fixture
re-created, no artifact hand-edited, and `--force` was not used.** Steps 1–5 were confirmed by
reading the tree:

| what | how it was confirmed | reading |
|---|---|---|
| the merge stands | `git log --oneline -6` | `57bae0f` (K) <- `61cd310` (F) <- `e513873` (U) <- `d9663f1` (R) <- `08132fc` (S1 amend) |
| the working tree is S3's own uncommitted output | `git status --porcelain` | **24 modified + 3 untracked** — the 23 run-2 paths plus `docs/spikes/V4-workorders.md`, which run 3 appended its own work-order to; **no commit made — S6 makes the boundary commit** |
| the 9-max fixture exists and was not re-created | `test -f`, `wc -c`, sha256 before/after every check | `data/tiers-9max.fixture.txt`, **833,021 B**, untracked, **byte-unchanged** across all of run 3 |
| the seven ids are registered, appended not interleaved | `EXPECTED_IDS` compared against `1d988f5:scripts/gates/index.mjs` | **62 -> 69**, the legacy 62 a **strict prefix**, tail `I48 I49 I50 I51 I52 D12 D13` |
| the ring's top-level budget row exists in **both** variants | `grep -n "ring: 20 \* 1024" scripts/lib/variant.mjs` | **2 hits** — `:128` (lite) and `:195` (full) |
| I50's clause list | `verify.mjs`'s own I50 line | **21 shared pairs over 7 per-node clauses + 3 cross-cutting = 10 asserted** |
| the five policy deltas are applied | read at their sites in `scripts/lib/policy.mjs` | `ring: state.ring` at `:2090` (U2, `evCutUncached`) and `:2333` (F1, `solveUncached`); F3's accessor-side `vDeltaAtSeats` contract at `:1085`; F2's memo identity (`contentHash.slice(0, 8)`) at `:1768`; F4's `constants.ladder.census` shipped in `data/model.json` as `{domain 6336, clamp 9, clamped 19, byPair {UTG1|limps 14, UTG2|limps 5}}` |
| I48 is green on the merged tree | `verify.mjs` | **pass** — legacy diff shape all `-`, 9max `-`, zeroing the ring moves 0 of 16,632 six-seat settings |

Run 3's own work was exactly four things: **append its work-order** to `docs/spikes/V4-workorders.md`,
**re-pin `TODAY`** (§8b.1), **re-run the whole GREEN list** (§8c), and **rewrite §8b from a blocker
into its resolution**. It touched **no** source file, no gate, no `variant.mjs`, no artifact, no
`data/*.json`, no fixture, `docs/METHODOLOGY.md` (whose line numbers are D6-cited) or
`docs/spikes/V4-S6-verification.md` — exactly one test byte and three documents.

---

## 1. Step 1 — which branch the tree normalisation took, and what it cost

`git status --porcelain` was dirty (S1's work fully STAGED) and `git diff v4-s1-base` was **EMPTY**,
so the snapshot described the tree exactly and the first branch of the brief applies:
`git reset --soft v4-s1-base` (index already equalled the snapshot; the working tree was not
touched) then `git commit --amend`, preserving the original body so the owner's R2 amendment keeps
its provenance. **Both shas recorded: `c76720d` -> `08132fc`.** The branch `v4-s1-base` still points
at `c76720d`, so the pre-amend object survives.

The amend rewrote `c76720d` while the four lane branches still descend from it, so the merge base
moved back to `33a228f` (the stash-shaped WIP commit). Both sides then carry the identical R2 hunk
and it merged clean, which was re-checked with `git merge-tree` against the amended HEAD rather than
trusted from the pre-amend prediction. Afterwards `git status --porcelain` showed exactly one line,
the untracked stray below.

**FOR S5/S6, NOT MINE TO DELETE:** `docs/spikes/V4-S6-verification.md` is untracked on this tree. It
is **run 1's** S6 report and it says RED. It is not this run's, it is not referenced by anything, and
a `git add -A` at the boundary commit would carry it in. Flagged rather than removed.

**All four lane tips had merge-base `c76720d` exactly** — every lane rebased itself after lane F
found that a worktree cut from `33a228f` would silently revert the owner's R2 amendment. Verified
before merging, not assumed.

## 2. Step 2 — the merges, and the one thing that conflicted

| lane | branch | conflicts | resolution |
|---|---|---|---|
| **R** ring | `worktree-wf_3c958a35-f26-4` | none | — |
| **U** UI | `worktree-wf_3c958a35-f26-5` | `index.html`, `index-full.html` | **took lane U's side.** Both are GENERATED and are rebuilt in step 4; hand-merging a generated artifact is the one resolution that cannot be right. `src/shell.html` was "changed in both" and **auto-merged clean**, which is §7.2's line-disjoint construction holding: S1's three ranges, lane R's three named sites and lane U's remainder never touched a shared line. |
| **F** fixtures/gates | `worktree-wf_3c958a35-f26-6` | none | — |
| **K** skill/prose | `worktree-wf_3c958a35-f26-7` | none | — |

**`scripts/gates/index.mjs` and `scripts/gates/reserved.mjs` did not conflict**, which is the
contention registry working rather than luck: lane F is their single writer and registered all seven
ids in one edit. Verified rather than merged — `EXPECTED_IDS.length === 69`, the pre-existing **62
are a strict prefix** (checked against `e801f07`'s literal, comment-stripped), the seven new ids
follow in order, no duplicates, and importing the module does not throw. The runner's declared-vs-
frozen check is deliberately not a gate, so this was checked by hand.

**Lane R's and S1's six owned shell regions were re-verified byte-for-byte present after the merge**:
`SIM_NMAX` + `setSimSeats` (:1206–1224), `validEqArray(e, n)` (:1368), `p.nMax !== SIM_NMAX` (:1466),
S1's `seatsFor(6)` fallback (:2248), `nEffMax()` (11 sites) and `nestChain(node, 6)` (:3287).

## 3. Step 3 — the filed policy deltas, one at a time, with verdicts

`scripts/lib/policy.mjs` was frozen after S1 and S3 is its only writer. Each delta was applied alone
and followed by **I48 + the three legacy fixture `--check`s + a modelCode measurement** before the
next. **All five green at every step; the three legacy fixtures never moved a byte.**

| # | filed by | delta | verdict | modelCode after |
|---|---|---|---|---|
| 1 | F1 / U1 | `ring: state.ring` in `solveUncached`'s `opts` | **APPLIED.** One `opts` object feeds the active cascade, the nesting union over `chain[i]` and both reference-VPIP sweeps — confirmed by reading, not assumed. Without it 720 of 26,136 nine-seat settings threw with `data/ring.json` on disk. | 56,286 B |
| 1b | F1 (`solve3bet` half) | thread the ring into `solve3bet` too | **REFUSED, with reason.** `solve3bet` scores off `cell.eqVs3bet`, `cell.nu` and `cell.dom`; `vs3betCuts` was read end to end and indexes no equity column by `N`. There is no read there for a ring to serve, so the line would have been dead code asserting a coupling that does not exist. Lane F's own census agrees: **0 of the 720 refusals were at `3bet`**. | — |
| 2 | U2 | the same one line in `evCutUncached`'s `aggressiveSet` call | **APPLIED.** Not the same defect twice: `solveUncached` throws into the tier path (fatal), `evCutUncached` throws into `evLayer`, which catches and sets `out = null` — so the EV colour mode would have **disabled itself by name** at the 328 ring-consulting settings rather than crashing. The quieter failure, and the one that ships unnoticed. | 56,302 B |
| 3 | F3 / S1 | `vDeltaAtSeats(...)` + `ring` through `villainEq`/`profiledModel` | **APPLIED IN SUBSTANCE, REFUSED IN SHAPE — see §3.1.** | 56,866 B |
| 4 | F2 | a ring identity in the `SOLVE_MEMO` / `AGGR_MEMO` (and `EV_MEMO`) keys | **APPLIED.** `envKey`'s trap one level down: none of model hash, position, node, v or `envKey` moves when the payload does, so two different rings in one process would share every entry and the second read would be handed the first's answer. Keyed on `ring.meta.contentHash.slice(0, 8)`, the **empty string** with no ring in hand — so at six seats every key gains a trailing `\|` and nothing else. | 57,028 B |
| 5 | F4 | `CONSTANTS.ladder.census` | **APPLIED.** `{domain: 6336, clamp: 9, clamped: 19, byPair: {UTG+1\|limps: 14, UTG+2\|limps: 5}}`, a frozen measured record in the `WIDTH_EXCEPTIONS` idiom. Safe to type because **I52(c) recounts it live on every verify** and fails on a stale one; not derivable at module load because it is a 6,336-setting sweep. `constants.ladder` is 610 B against its reserved 1,024 B. | 57,175 B |

**`modelCode` is NOT raised**: 57,175 B against the 57,344 B cap S1 paid for, **169 B under it**.
Five deltas cost 905 B and the ceiling absorbed them.

### 3.1 F3 — the one design decision worth reading

S1 filed this as `vDeltaAtSeats(pts, vDelta, v, seats, ring, key)` plus `ring` threaded through
`villainEq`/`profiledModel`, and **recorded that it would force `villainEq` to return nine-long
`eq`**. That shape is **refused**, and the accessor-side design taken instead.

A nine-long `eq` out of `villainEq` ripples into `NMAX` (the equity-array shape invariant the page
pins and lane R spent its whole shell budget keeping at 7), into `hydrate`, into
`tier-fixture-9max.mjs`'s `profiledModel(...)` call and into the sim payload's `validEqArray` — five
places, to move a number two columns wider. The accessor-side form is **one** place:

- `profiledModelUncached` stamps `nc.vp = got.v` beside the `nc.vpSource` it already stamps —
  on the **shadow** cell only. `model.cells` is never written and a shadow is never serialised.
- `ringCols` for a profiled cell returns `r.eq[i] + interpolateDelta(ring.meta.v, pts.map(p => r.vDelta[p]), cell.vp).delta[i]` — the **ring's own** vDelta lattice at the **same v** the cell's
  1..7 columns were profiled at. Verified before use: `ring.meta.v` deep-equals
  `model.constants.villainLattice.v` (`[25,40,55,70,90]`) and both carry `discipline` 0.85, so the
  two halves of the join are the same axis. All 123 ring cells carry all five lattice rows.
- `villainEq` keeps returning seven-long arrays. The model path, `NMAX`, `hydrate` and lane F's
  fixture library need no change at all.

**What still fails closed, and is asserted with a fabricated violator for each**: a `measured`
profile source (the ring has no measured columns); a profiled cell carrying no `v`; a ring with no
vDelta lattice of its own. **A limitation for S5, not something to widen the delta for:** a
nine-wide Simulate measurement never reaches a cell anyway — `villainEq` drops it at
`m.length === cell.eq.length` — so `vpSource === 'measured'` at nine seats above N = 7 refuses
permanently, by name.

**Measured, and it is the reason the freeze could run at all:** with F1 + F3, lane F's 720 refusals
became **zero**, and I50's comparison count went **16,272 -> 16,632**.

**One assertion this changed and it is re-pointed, not deleted.** `test/ladder.test.mjs`'s
"refusing to mix" now checks five cases instead of one: the join it CAN make (profiled at a v
halfway between two ring lattice points), the three it cannot, and — measured rather than assumed —
that a `v` outside the ring's lattice **CLAMPS** to the end row rather than throwing. It clamps
because `latticeBracket` clamps at both ends, and that is right rather than a hole: the model's own
1..7 columns clamp by the *same function on the same rule*, so both halves of the join land on the
same lattice row together. A first draft of that test asserted a throw; the throw was unreachable.

## 4. Step 4 — the ring registered, and the byte table before and after

**The ring is its own injected payload on the `data/equilibrium.json` precedent, and it is NOT a
`model.json` sub-budget.** Two separate new caps, as the brief requires: the page block
`blocks.ring`, and the top-level artifact row `ring` in both variants' `budgets`.

### 4.1 The identifier decision, which was a real collision and not a style choice

Lane R measured the injected form as `` const RING = …; ``. **That identifier cannot be used.**
`src/shell.html`'s main script declares `var RING = null` at its own top level and reads
`window.RING` later in the same script: a global `const RING` in a separate script is a
**SyntaxError** against that `var`, and a `window.RING = …` is nulled by the `var` before the read.
The shipped form is **`MODEL.ring = …;`** — it assigns and declares nothing, it is the seam
`docs/spikes/V4-ladder.md` specified, and lane U's `HAS_SEATS` block already reads it as its second
source. The two forms are the same length (13 characters), so lane R's 18,620 B measurement is
unchanged.

`ringInjectedForm` is **ONE export**, in `scripts/lib/variant.mjs`, used by `scripts/build.mjs` and
re-exported by `scripts/gates/ring-artifact.mjs` so D12(d) measures the string the build emits. It
is not in `scripts/lib/ring.mjs` **because that file's bytes are hashed into `data/ring.json`'s
`meta.generatorHash`**: one line added there reddens D12(a) and costs a 21-minute regeneration of an
artifact that has not changed.

### 4.2 What was registered

`variant.mjs` `regions += 'ring'` in both. `block-census.mjs`: `BLOCKS += 'ring'`,
`APP_EXCLUDED_REGIONS += 'ring'`, and `pageCensus` returns `ring` and **subtracts it from `app`** —
`build.mjs` computes the same quantity from its own generated blocks, and if only one of the two had
subtracted it, D6 and the build would have disagreed by 18 KB and `appCore` would have read over
budget in exactly one of them. `build.mjs` reads `data/ring.json` for **both** variants (dies if
absent, the `eq` idiom), prints its provenance line **after** the shell-hash line (D11 takes the
first `sha256`), and gates it on `BUDGETS.ring`.

**A naming defect this caught:** the build report first printed `+ ring 18.2` for the payload while
the block census printed `ring 10.6`, and `block-census.test.mjs`'s parser — which reads block
figures by name — matched the payload. One report line may not print two quantities under one word.
The payload term is now `ring payload`, exactly as the `eq` region's payload prints as
`equilibrium`, and the test asserts both.

### 4.3 The byte table — before (`v4-s1-base`, measured) and after (this tree, measured)

| ceiling | before (B) | before | after (B) | after | cap before | cap after | bound (from above) |
|---|---|---|---|---|---|---|---|
| `total` lite | 601,614 | 587.5K | **633,258** | 618.4K | 600K | **625K** | 650K |
| `total` full | 673,034 | 657.3K | **704,700** | 688.2K | 660K | **695K** | 723K |
| `app` lite | 403,386 | 393.9K | **415,326** | 405.6K | 398K | **410K** | 426K |
| `app` full | 403,536 | 394.1K | **415,476** | 405.7K | 398K | **410K** | 427K |
| `appCore` lite | 368,096 | 359.5K | **369,147** | 360.5K | 360K | **361K** | 379K |
| `appCore` full | 368,246 | 359.6K | **369,297** | 360.6K | 360K | **361K** | 379K |
| `modelCode` | 56,270 | 55.0K | **57,175** | 55.8K | 56K | 56K *(not raised)* | 61K |
| `blocks.ring` | — | — | **10,846** | 10.6K | — | **11K** *(new)* | 12K |
| `ring` (artifact) | — | — | **18,618** | 18.2K | — | **20K** *(new)* | 20K |
| `blocks.gto` | 10,198 | 10.0K | 10,241 | 10.0K | 11K | 11K | 11K |
| `blocks.ev / skill / topn / calib` | 11,403 / 3,532 / 4,844 / 5,313 | | unchanged | | 12K / 4K / 5K / 6K | unchanged | |
| `eq` (full) | 71,270 | 69.6K | 71,292 | 69.6K | 73K | 73K | — |
| `core` (model.json 120K) | | 116.0K | | 116.1K | 120K | 120K *(not raised)* | — |

`blocks.gto` moved +43 B on lane U's coverage denominator; `eq` moved +22 B on lane K's rename.

**RUN-3 BYTE DELTAS, and they are the only ones.** The `after` column above reads the tree as it
stands **after the owner's regeneration of `data/ring.json`** (§8b). Three figures fell by two bytes
each against the run-2 measurement, all of them the same two bytes: the regenerated artifact embeds
`meta.wallSec 1213` where the pre-merge one embedded `1255.4`. `ring` 18,620 -> **18,618**, `total`
lite 633,260 -> **633,258**, `total` full 704,702 -> **704,700**. **Nothing else moved** — `app`,
`appCore`, `modelCode` and all six block figures are byte-identical, which is what identifies the
mover as the ring's own provenance stamp and not a page edit. **No cap arithmetic changes**:
ceil(18,618 x 1.05) = 19,549 B still rounds to 20K, and 633,258 x 1.05 is still under 650K.
**Deliberately NOT chased into `variant.mjs`:** its `budgetSource` sentences, the test comments and
the plan's Measured blocks still quote 18,620 B and 633,260 B. No gate and no test asserts those
literals — D13 checks the caps and the block are *present*, `variant.test.mjs` matches `/695/` and
`/660/` — and editing `variant.mjs` would move the seven D6 cite line numbers and redden D11 for a
two-byte provenance nicety. **Recorded as drift for S5's docs pass, not repaired at S3.**

### 4.4 Shrink-first, measured in bytes (rule R6) — **1,257 B recovered before anything was asked for**

| shrink | bytes | what |
|---|---|---|
| **S3** | **708** | the ring region's shipped HTML comment cut from 950 B to 242 B. The reasoning moved into `variant.mjs`'s `ringInjectedForm` docstring, which is build-time and never ships — the `eq` region's own one-line form. **Measured, not estimated: HTML comments are not stripped by the shell compiler and land in `appCore`, the tightest row on the page.** |
| lane U | 308 | `solveState` through `stateOf` (−83), the local `POL` in `seatLabel`/`extrapReach` (−94), one env literal in the page instead of two (−92), `seatLabel` moved into `@block:ring` (−39) |
| lane R | 241 | its `SIM_NMAX` / `validEqArray` / `p.nMax` cut, first draft +614 B, shipped +373 B |
| S1 | **0** | §2.7 predicted the shell's duplicate `POSITIONS`/`NNB`/`NBL`/`legalPos` copies would return ~0.4 KB. **Measured +0.2 K NET** (its memo §11). Recorded falsified, not patched. |

**Two shrinks on the artifact itself were measured and DECLINED, with their reasons in
`budgetSource`:** rendering `data/ring.json`'s `vDelta` as an array of five pairs indexed by
`meta.v` saves a measured **3,075 B** (16.5 % of the artifact) but changes the payload shape
`docs/spikes/V4-ladder.md` fixes as the accessor's contract, and re-cutting it costs a 1,255 s
regeneration of a byte-identical measurement; dropping `note` + `agree` (**1,740 B**) would take the
per-cell agreement record D12(b)/(c) get their teeth from off the artifact.

Nothing further is available without moving pre-existing bytes into a marked block, which is
laundering rather than shrinking.

### 4.5 The raises, each with its arithmetic

- **`appCore` 360K -> 361K, both variants.** Over by 507 B (lite) / 657 B (full) after the shrink.
  361K = 369,664 B is **measured + 0.1 %** against a +5 % bound of 379K — the smallest whole-KB step
  that exists.
- **`app` 398K -> 410K, both variants.** **Arithmetic, not judgement**: the equality pin
  (`test/variant.test.mjs`) is `app === appCore + Σ(block caps)`, and 361 + (11+12+4+5+6+11 = 49) =
  410. Measured `app` is 405.6K and would have fitted under 406K; the caps must together fit inside
  `app − appCore`, which is what the caps were added for.
- **`total` lite 600K -> 625K.** §2.7's "expected to fit" **falsified**. Measured + 1.10 %, bound 650K.
- **`total` full 660K -> 695K.** The raise §2.7 *expected*. Measured + 1.03 %, bound 723K.
- **New: `blocks.ring` 11K** (measured 10,846 B; +5 % rounds to 12K, so 11K is one whole-KB step
  **under** its own bound and still above the block) and **`ring` 20K** (18,620 B injected).

D6's four `build.mjs` cites moved by exactly 28 lines when the ring's read, banner line, byte term
and budget clause landed (`:470 -> :498`, `:485 -> :513`, `:489 -> :517`, `:499 -> :527`) and were
**re-pinned**. The seven `variant.mjs` cites did **not** move: every raise's prose was appended
*into* an existing `budgetSource` line, so the file's line count is unchanged at 559.
METHODOLOGY's cites did not move either — §7's subsection is appended at the end.

## 5. Step 5 — I50's clause list, written BEFORE the freeze

Each shared seat is sorted into one of two clauses **structurally**, by its index in
`nestChain(node, 9)` — the only seats-in-front term R4's enumeration found. No seat name is typed;
a ladder that changed shape moves the clause list with it.

> `index > 0` -> **CONTAINMENT** (seats in front exist; a strict superset is an EXPECTED reading and
> equality is MEASURED). `index <= 0` -> **EXACT** (absent from the chain, or first in it: nothing in
> front for the post-pass to union, so a single unioned cell is a FAILURE).

**10 asserted clauses: 7 per-node + 3 cross-cutting.**

| # | clause | pairs | outcome |
|---|---|---|---|
| 1 | rfi CONTAINMENT | LJ, HJ, CO, BTN | **pass** — 42 strict supersets, 44 excess cells, 0 subset violations |
| 2 | rfi EXACT | SB | **pass** — 0 unions |
| 3 | limps CONTAINMENT | HJ, CO, BTN | **pass** — 34 strict supersets, 40 excess cells |
| 4 | limps EXACT | SB, BB | **pass** — 0 unions |
| 5 | raise CONTAINMENT | HJ, CO, BTN | **pass** — 1,210 strict supersets, 1,638 excess cells |
| 6 | raise EXACT | SB, BB | **pass** — 0 unions |
| 7 | 3bet EXACT | all six | **pass** — the chain is empty; 0 unions, 4,752 exact |
| 8 | (i) tier reproduction off the two frozen files | 21 pairs | **pass** — 1,568/16,632 differ, 2,426 cell tiers |
| 9 | (ii) no unexplained excess cell | 1,722 cells | **pass** — 1,722 of 1,722 attributed to a named front seat |
| 10 | (iii) pre-nesting width monotone in the term | 16,632 | **pass** — measured EQUAL, 0 differences either way |

**`i50RfiExact` = FALSE**, the expected and legitimate answer: 7 of the 10 containment pairs measured
a strict superset, 3 measured equality. **BTN at rfi is one of the three** — three new seats in
front of it, three unions, **zero cells**, because its own pre-union set already contained theirs.

## 6. Step 6 — the ceremony

    $ test ! -f data/tiers-9max.fixture.txt        # CONFIRMED absent
    $ node scripts/freeze-tiers.mjs --seats9       # once, no --force

    froze 26136 settings x 123 cells -> data/tiers-9max.fixture.txt (813.5 KB, 8.2s)
      model data/model.json hash 0b563af107d9 · VPIP 25..90 · 12 environment lanes
      [d40/r0/s0 d40/r0/s1 d40/r5/s0 d40/r5/s1 d100/r0/s0 d100/r0/s1 d100/r5/s0 d100/r5/s1
       d250/r0/s0 d250/r0/s1 d250/r5/s0 d250/r5/s1] x 33 legal (node, position) pairs at seats=9,
      villain profile on(v=vpip,q=0.85)
      commit this file. verify.mjs reads it as gate I49 and never writes it.

    $ node scripts/freeze-tiers.mjs --seats9 --check
    I49 reproduces: 26136 settings x 123 cells identical to data/tiers-9max.fixture.txt

**26,136 settings — §2.5's prediction (33 x 66 x 12) confirmed to the setting.** 833,021 B on disk,
inside lane F's measured 809.2–844.6 KB bracket. **0 comparisons refused**, against lane F's 720 at
S2: deltas F1 and F3 are what closed them, so the domain froze whole rather than with a hole in it.

**The stamping trap fired exactly as predicted, and the resolution is worth recording.** `verify.mjs`
stamps every verdict into `data/model.json` and `build.mjs` refuses a model carrying a non-`pass`
stamp. After the freeze, verify read 68/69 with **D9 failing because the artifacts had not been
rebuilt for the regenerated equilibrium** — and the rebuild that would fix it was blocked by D9's own
FAIL stamp. Broken with `git checkout -- data/model.json` (restoring an all-pass stamp), then
build -> verify -> build -> verify, which reaches a **fixed point**: model.json byte-identical across
the last verify, 69/69, `--check` 2/2. Budgets were not touched to get there.

## 7. The sub-ladder diff (full)

The summary is committed to `docs/METHODOLOGY.md` under "S3 handoff — the sub-ladder diff", appended
at the end so that no D6 or I36 line cite moves; S5 folds it into the new §3.6.

    THE SUB-LADDER DIFF — 6-max (data/tiers-v3-default.fixture.txt) -> 9-max (this file), over the
    shared seats only (the pair legal at both sizes, compared by LADDER POSITION):
      1568/16632 shared settings differ, 2426 cell tiers
      rfi:   3960 comparisons, 3794 exact,  166 differ,  212 cell tiers — by seat LJ:150 HJ:12 CO:4
      limps: 3960 comparisons, 3918 exact,   42 differ,   48 cell tiers — by seat HJ:42
      raise: 3960 comparisons, 2600 exact, 1360 differ, 2166 cell tiers — by seat HJ:470 CO:460 BTN:430
      3bet:  4752 comparisons, 4752 exact,    0 differ,    0 cell tiers

    THE NESTING CENSUS — what the positional post-pass unions into each shared seat (0 refused)
      rfi/LJ(9)  vs UTG(6): 792 cmp, 764 exact,  28 sup, 0 SUBSET,  30 unioned (worst 2), 0 unexpl — UTG+2:30
      rfi/HJ(9)  vs HJ(6):  792 cmp, 782 exact,  10 sup, 0 SUBSET,  10 unioned (worst 1), 0 unexpl — UTG+2:10
      rfi/CO(9)  vs CO(6):  792 cmp, 788 exact,   4 sup, 0 SUBSET,   4 unioned (worst 1), 0 unexpl — UTG+2:4
      rfi/BTN(9) vs BTN(6): 792 cmp, 792 exact,   0 sup, 0 SUBSET,   0 unioned,           0 unexpl
      rfi/SB(9)  vs SB(6):  792 cmp, 792 exact,   0 sup, 0 SUBSET,   0 unioned,           0 unexpl
      limps/HJ(9)  vs HJ(6):  792 cmp, 758 exact,  34 sup, 0 SUBSET,  40 unioned (worst 3), 0 unexpl — LJ:38 UTG+2:2
      limps/CO · BTN · SB · BB:      792 cmp each, 792 exact each, 0 sup, 0 SUBSET, 0 unioned, 0 unexpl
      raise/HJ(9)  vs HJ(6):  792 cmp, 380 exact, 412 sup, 0 SUBSET, 556 unioned (worst 4), 0 unexpl — UTG+1:534 UTG+2:14 LJ:8
      raise/CO(9)  vs CO(6):  792 cmp, 388 exact, 404 sup, 0 SUBSET, 548 unioned (worst 4), 0 unexpl — UTG+1:526 UTG+2:14 LJ:8
      raise/BTN(9) vs BTN(6): 792 cmp, 398 exact, 394 sup, 0 SUBSET, 534 unioned (worst 4), 0 unexpl — UTG+1:514 UTG+2:14 LJ:6
      raise/SB · BB:                 792 cmp each, 792 exact each, 0 sup, 0 SUBSET, 0 unioned, 0 unexpl
      3bet/all six:                  792 cmp each, 792 exact each, 0 sup, 0 SUBSET, 0 unioned, 0 unexpl
      every pair: pre-nesting differs 0 (non-monotone 0)

## 8. Step 8 — the four gates that changed DOMAIN, and two gates rewritten in the open

- **I36** — (b) stays `nestChain('rfi', 6)`, six-seat-scoped, so its armed clause keeps today's
  meaning; (d) re-read at nine seats as **3 of 36, 33 uncovered** (denominator is all pos x node).
  Untouched by S3; lane K's work, verified green.
- **I15 / I26** — unchanged in claim, evaluated at both sizes via I51. Green.
- **I38(d)/(e)** — extended by S3 (`scripts/gates/skill.mjs` was nobody's file this run):
  `widthTable`/`widthProblems(model, SKILL_GRID, 9)` beside the six-seat calls, `legalPairs(seats)`
  for the sweep, and **`seats` threaded into BOTH the (e) probe's `P.solve` and its
  `P.realization`**. Measured: **23,985 readings (9,225 at six + 14,760 at nine), 0 mismatches** —
  lane K's predicted counts exactly. Threaded into only the first, the probe reports 5,535 false
  mismatches, which is a gate written to fail on correct work; the docstring says so.
- **I51(c)** — fired on lane K's 13 measured-record lines, as lane K predicted and as lane F's own
  pin note said it should. **Resolved in the open, and the gate had a real defect underneath it.**
  The note prescribes "add the file to ALLOW with its reason, never move this number" — but
  `scanSeatLiterals` counted legacy hits **before** the allow check, so adding a file to ALLOW could
  not have resolved anything. The allowlist now exempts the ratchet as well as the stray scan, and
  the exempted total is **counted and printed** beside it so nothing hides by being allowed.
  Three files added with reasons: `scripts/lib/skill.mjs` (the `WIDTH_*_EXCEPTIONS_9` records —
  measured, not derivable, and re-derived in **both directions** by `widthProblems` every run, so a
  wrong key there fails I38 rather than hiding behind I51), `test/skill-9max.test.mjs` and
  `test/ui-seats.test.mjs` (the seat names are the assertions' own search terms).
  The +33 that fired the gate, measured file by file against `v4-s1-base`: skill.mjs **+19**,
  skill-9max.test.mjs **+11**, ladder.test.mjs **+2**, ui-seats.test.mjs **+5**, and — a genuine
  **fall**, which is the direction the ratchet exists for — equilibrium.mjs **−4**, where the
  re-typed `NEST_CHAIN` literal became `nestChain('rfi', 6)`.
  **`LEGACY_PIN` was TIGHTENED 655 -> 487**, not moved up: over the 35 files it now guards the count
  measures 487, so 655 would have left **168 occurrences of slack** in a ratchet whose whole job is
  to bite. The 201 occurrences inside the five allowlisted files are printed on every run.
  **0 strays.**
- **`constants.ladder.census`, the one constant S3 adds**, meets all four legs: named in
  `constants`, anchored by R3's method (the domain V3-BRIEF :211 enumerates), **rendered by the
  Method view**, and **bounded by I52(c)**. Worth stating how the rendering works, because it is not
  the obvious way round: the page does **not** print the stored constant — it sweeps `extrapReach`
  live and prints the recount, the same enumeration the Known-weaknesses paragraph runs. The stored
  record and the rendered number therefore agree *because I52(c) fails when they do not*, rather
  than because one is a copy of the other. That is the stronger arrangement, and it is why a typed
  6,336-setting census is safe to type at all.
- **I52(b)** — the second gate rewritten, and it was **failing on correct work**. The clause was
  `/\bSIM_NMAX\s*=\s*(\d+)/ === 9`, a lexical match on a typed width; lane R shipped the split with
  **no width literal at all** (`setSimSeats` asks `constants.ladder.seats` whether it recognises the
  count, then asks `policy.nMax` for the width, so the shell gains neither a seat nor a width
  literal). Against that shell the detector reported "declares no SIM_NMAX" — and would have passed
  a dead `var SIM_NMAX = 9`. The clause now **extracts and EVALUATES** the setter:
  `setSimSeats(9) -> 9`, `setSimSeats(6) -> 7`, and an unnamed table size `7 -> 7`. Strictly
  stronger than the literal it replaces, and fail-closed: an extraction that does not parse is a FAIL.

## 8b. RESOLVED by the owner's regeneration on the merged tree — and the provenance coupling stands as a finding

> **Status.** This section was filed at run 2's return as S3's single blocker. It was cleared by the
> owner on this exact tree on 2026-09-08 with the one command the generator's own drift message
> prescribes, and the readings are recorded at the end. **The diagnosis below is kept verbatim,
> because the design finding it names is not fixed and is not S3's to fix** — the ring still records
> `data/model.json`'s whole-file hash as provenance when the input its pools are built from is
> `orderHash`. What follows is the run-2 text as written.

**`node scripts/generate-ring.mjs --check` FAILED at run 2's return, and the measurement is not what failed.** The
check re-measured both seeds in **1,220.3 s** and its drift reporter — which compares `contentHash`
**and every one of the 123 cells' two columns** — flagged **`contentHash` alone. Not one column
moved.** Both blocked-pool fallback counts reproduced **to the unit** (5,195,877 and 5,210,970),
which is lane R's determinism claim making itself for a third independent time.

**The cause, diagnosed rather than guessed.** `meta.model.hash` is `data/model.json`'s **whole-file**
hash, read live at build and at check time (`generate-ring.mjs`, the `model:` block). It moved
`0b563af1…` -> `d20e334f…` when this stage stamped `constants.ladder.census` and the sixty-nine gate
verdicts — **both changes §0.4 explicitly authorises**. `generatorHash` and `kernelHash` are
UNCHANGED and were checked (`ring.mjs` + `generate-ring.mjs`, and `mc.mjs`'s `@worker-slice` region:
neither was touched this stage). So does `meta.model.orderHash`, which pins `model.order.packed` —
**the input the villain pools are actually built from**.

**The artifact is therefore coupled to bytes that cannot affect it**, in a run whose own plan
guarantees those bytes move. `data/ring.json` must be regenerated after *any* change to
`data/model.json`, or its `--check` fails on provenance rather than on measurement.

**The remedy is the one the generator's own drift message prescribes** — "regenerate with
`node scripts/generate-ring.mjs`". It is a ~21-minute run at four workers (D12(e)'s own regime), the
cells come back identical, and **D12(e) has room**: the check just measured both seeds at 1,220.3 s
against the 1,280 s budget. **This environment's command classifier refuses to run it**, three
invocations, so S3 could not produce it. Filed as a blocker with that single command as the fix.

**What was NOT done, and why.** Editing `meta.model.hash` in the artifact by hand is worse than
`--force` and was not considered. Narrowing what `contentHashOf` covers (to `orderHash` alone, or
excluding the model hash the way `wallSec` is already excluded) is a **weakening of a byte-identity
claim** and is not S3's to take unilaterally — and it is circular besides: both candidate edits land
in `ring.mjs` or `generate-ring.mjs`, whose bytes ARE `generatorHash`, so either would redden the
check by a second route and need the same regeneration anyway. **The design question — should the
ring record `orderHash` alone rather than the whole-file hash? — is real and is S5's or the red
team's**, not a thing to settle inside an integration stage.

---

### 8b.1 How it was cleared — the owner's regeneration, 2026-09-08, on this tree

**Deterministic re-stamping of generated artifacts by their own generators. No source file, no test,
no document was touched, and no `--force` was used anywhere.**

| step | reading |
|---|---|
| `verify.mjs` idempotence on `data/model.json` proved first | two consecutive runs, identical sha256 — so the stamp is a fixed point and the regeneration would not be chasing a moving hash |
| `node scripts/generate-ring.mjs` (default 4 workers) | wall **1,213.0 s** against the amended **1,280 s** budget — **inside**, D12(e) green |
| R-LATT, the two seeds | **595.7 s / 587.3 s** |
| blocked-pool fallbacks | **5,195,877 / 5,210,970** — **identical to the unit** with lane R's write and with run 2's check, a fourth independent reproduction |
| `meta.model.hash` | **`0b563af1…` -> `d20e334f…`** re-stamped; `meta.model.orderHash` **`8fee6769…` UNCHANGED** — which is the finding in one line: the input did not move, the provenance record did |
| `contentHash` | **`b39f9de681988a3a`** |
| `data/ring.json` on disk | **18,605 B** (2 B shorter than lane R's write: `wallSec 1213` for `1255.4`) |
| `node scripts/generate-ring.mjs --check --workers=8` | **OK, byte-identical** to a rebuild from its own recorded inputs with `meta.wallSec` blanked on both sides, **650.7 s** |
| both pages rebuilt (`build.mjs`, then `--variant=full`) | `build --check` **2/2 current** — lite 618.4 KB, full 688.2 KB |
| `node scripts/verify.mjs` | **69/69 pass, exit 0** |
| `node --test test/*.test.mjs` | **786 / 787** — the single red being `test/block-census.test.mjs`'s `TODAY` pin, `total` 633,260 expected against 633,258 measured: **exactly the two bytes the regenerated ring embeds** |

**That one red was run 3's whole remit and is now green.** `TODAY` is re-pinned to `total: 633258`;
the `deepStrictEqual` diff was verified to move **`total` and nothing else** before the byte was
changed — `app` 415,326, `appCore` 369,147, `modelCode` 57,175 and all six block figures identical —
which is the check that distinguishes a provenance re-stamp from a page edit. **It is a measurement,
not a decision, and no ceiling moved.** The fixture's comment block carries the reason.

### 8b.2 What is still true, and what it costs

The coupling is **not** repaired, and repairing it was correctly refused twice. Both candidate edits
— narrowing `contentHashOf` to `orderHash`, or excluding the model hash the way `wallSec` is already
excluded — land in `ring.mjs` or `generate-ring.mjs`, **whose bytes ARE `generatorHash`**, so either
would redden `--check` by a second route and force *another* ~21-minute regeneration to settle. The
standing cost, stated plainly for the red team: **any §0.4-authorised stamp into `data/model.json`
— a new constant, a new gate verdict — forces a ~21-minute re-stamp of `data/ring.json` that changes
not one measured column.** It is carried into the return as a named finding wearing a constant's
badge (`ring.meta.model.hash` vs `ring.meta.model.orderHash`) so **S4 attacks the coupling and S5
documents it**; it is not a number to anchor and not a thing to edit at S3.

> **Appended 2026-09-08 (stage S6, the fix round) — the cost above came due, and was paid.** S4 and
> S5 each stamped `data/model.json` again (the `flag` prose; limitation 20 as
> `constants.limitations[2]`), so `generate-ring.mjs --check` was red at the verification round
> exactly as this section predicts — `docs/spikes/V4-repin.md` §5 finding 1 had already recorded it
> and prescribed the remedy. S6 executed the regeneration as the **last** model-touching act of the
> run, after a sha256 fixed point on `data/model.json` was proved by consecutive verifies. The
> coupling itself is still **not** repaired and still should not be repaired here, for the reason
> given above. Readings: `docs/spikes/V4-S6-verification.md` §6.

## 8c. Run-3 re-verification — the whole GREEN list, re-run on this tree after the re-pin

Every row below was run in this order, on the merged tree as it stands, **after** the `TODAY` re-pin
and **after** the owner's regeneration. `verify.mjs` is run **before** `build --check` every time,
because verify stamps `data/model.json` and a stale stamp is what makes `--check` report STALE.

| command | result | wall |
|---|---|---|
| `node scripts/verify.mjs` | **69 / 69 pass, exit 0** — all 69 verdict lines read `pass`, none `fail` | 39.6 s |
| — `data/model.json` sha256 before vs after that run | **UNCHANGED** — the stamp is byte-idempotent, so `--check` cannot go STALE behind it | — |
| `node scripts/build.mjs --check` | **2 / 2 variants current** (lite 618.4 KB, full 688.2 KB; ring payload 18.2 K in both) | 3 s |
| `node --test test/*.test.mjs` | **787 / 787 pass, 0 fail**, exit 0 | 25 s |
| `node scripts/freeze-tiers.mjs --check` (v1 / I22) | `I22 reproduces: 1386 settings x 123 cells identical` | 2 s |
| `node scripts/freeze-tiers.mjs --v2 --check` (I32) | `I32 reproduces: 16632 settings x 123 cells identical` | 5 s |
| `node scripts/freeze-tiers.mjs --v3 --check` (test-pinned) | `reproduces: 16632 settings x 123 cells identical` | 5 s |
| `node scripts/freeze-tiers.mjs --seats9 --check` (I49) | **`I49 reproduces: 26136 settings x 123 cells identical`** | 7 s |
| — all four fixture sha256s, before vs after those four checks | **BYTE-UNCHANGED**, all four. `--check` wrote nothing; `--force` was not used | — |
| `node scripts/generate-checkdown-matrix.mjs --check` | `OK … byte-identical` (314,167 B, contentHash `3356b2226b5b2087`) | 21 s |
| `node scripts/generate-equilibrium.mjs --check` | `OK … re-solves byte-identically` (71,215 B, contentHash `d118c922fe2886e3`), and `model.json`'s `baselineTiers` is the block this solve produces | 12 s |
| `node smoke.mjs` | **2 / 2 variants green** | 8 s |
| `node browsers.mjs` | **2 / 2 variants green**, chromium + Firefox + WebKit, headless, throwaway profiles | 17 s |
| `node scripts/generate-ring.mjs --check --workers=8` | **`OK  data/ring.json is byte-identical to a rebuild from its own recorded inputs, with meta.wallSec blanked on both sides`** (18,598 B compared, contentHash **`b39f9de681988a3a`**; recorded 1213 s, re-measured 617.5 s) — and `data/ring.json`'s sha256 is **unchanged** by the run, so `--check` wrote nothing | **618.0 s** |

**§8b's blocker is closed by measurement in this environment, not only by the owner's word.** The
11-minute ring check was run here (background task, 8 workers, `data/ring.json` sha256 taken before
and after) and it reproduces the owner's reading exactly: **`contentHash b39f9de681988a3a`**, and the
two blocked-pool fallback counts land on **5,195,877 / 5,210,970** — **identical to the unit** with
lane R's original write, with run 2's failing check, and with the owner's regeneration. That is the
**fifth** independent reproduction of those two integers, and it is what makes run 2's failure
unambiguously a provenance re-stamp rather than a measurement drift: the numbers never moved, only
the hash of a file the pools do not read.

**The three morph rows are UNMOVED against their 8 / 16 / 4 ms budgets**, measured on the shipped
artifacts with the real ring: lite p95 **0.80 / 12.30 / 1.90 ms**, full p95 **0.90 / 11.90 / 1.90 ms**.
Lane U's fourth row reads **p95 1.70 ms lite / 1.80 ms full against 16 ms** — `rail 9 seats at 9-max
and 6 back at 6-max · N_eff clamp 7 -> 9 · seat UTG -> LJ -> UTG, kept by distance from the button`.
`browsers.mjs` F4 reads `ring payload present · control live · rail 6 -> 9 -> 6, clamp 7 -> 9` in all
three engines.

**The seven new gates, as `verify.mjs` prints them on this tree:**

- **I48** pass — diff shape `legacy [v1:- v2:- v3-default:-] 9max:-` across `e801f07d..HEAD`; zeroing
  the ring moves **0 of 16,632** six-seat settings; nMax(6) = 7 and **47/3,960 = 1.187 %** clamped at
  six against **19/6,336 = 0.300 %** at nine — the clamp share **falls** as the ladder lengthens.
- **I49** pass — `26136 settings x 123 cells identical`, 3,214,728 tiers, 12 lanes x 2,178.
- **I50** pass — **21 shared pairs, 10 clauses asserted**; 16,632 comparisons, **0 subset violations,
  0 unexplained excess cells, 0 non-monotone pre-nesting widths**; tier clause (i) 1,568/16,632
  shared settings differ over 2,426 cell tiers.
- **I51** pass — **0 stray new-seat literals in 109 files**; legacy pin **487** (tightened from 655).
- **I52** pass — perturbing `data/ring.json` moves **180/180** settings above N_eff 7 and **0/25,956**
  at or below it; `cells[*].eq` stays 7 long; `setSimSeats` evaluates 9 -> 9, 6 -> 7, 7 -> 7.
- **D12** pass — the falsified band printed as FALSIFIED on every run (two-seed 5.26, prefix 5.31
  against the pre-registered 2.0), seam worst **−0.700 pt** at `TRIPS_BIG|RB` (must be ≤ 0), ring
  18.2 K ≤ 20.0 K, wall **1213 s / 1280 s**.
- **D13** pass — the ring block and its ceilings present in both variants, caps pinned from above.

**The four gates that changed DOMAIN, re-read on this tree and confirmed evaluated at both sizes
rather than quietly narrowed** (§5.1, and §8 for how each got there):

- **I38(e)** — `over 23985 per-cell readings along the dial AT BOTH TABLE SIZES the realization the
  pipeline uses is bit-identical to the dial-blind realization(pos, N, nu, d, seats)`, **0 mismatches**,
  `the seat count threaded into the probe's solve AND its formula, which is the half that reports
  5,535 false mismatches when it is missed`.
- **I36** — (b) **stays six-seat-scoped on purpose** and keeps its meaning: `NOT MEASURABLE IN THE HU
  DOMAIN, recorded rather than passed and never toleranced … of the UTG/HJ/CO/BTN chain, 0 are
  covered`. (d) is the datum that was re-read: `AT NINE SEATS THE SAME MACHINERY READS 3 of 36, so 33
  pairs carry it — the denominator is ALL pos x node and not the legal subset, which is why it is 33
  and never 30`.
- **I15** — its continuation claim is asserted `at all six seats` and is carried at nine through I51's
  structural readings; unchanged in claim, green.
- **I26** — `straddle direction over 5 seats x 5 VPIP x 6 depths`, unchanged in claim, and I51(a)
  re-asserts `straddle.seat === ladder.earlyStep === 0.77` as **two constants on one anchor** at both
  sizes. Green.

**`verify.mjs`'s wall is 39,619 ms — 95 % of the 41,920 ms soft ceiling**, because I49 became a
26,136-setting sweep (6,298 ms, 15.9 % of the suite) the moment the fixture existed. The ceiling is
**soft by design and never changes the exit code**. `WALL_MEASURED_MS` (26,200) now describes a
suite two-thirds this size: **S5 re-measures it. Not raised here.**


## 9. Findings carried forward (not blockers)

1. **`Simulate`'s field width does not follow the rail.** Lane R built `setSimSeats` and its
   docstring says "Lane U calls this from the Table control"; lane U did not. `applySeats` never
   calls it, and the sim jobs carry `nMax: NMAX` (7) at `src/shell.html:2070` and `:2142`. So at
   nine seats **Simulate measures seven opponents**, consistently and without error, where §2.6 says
   its villain count follows the rail. It was left rather than wired, deliberately and recorded
   here: wiring it produces nine-wide measurements which `villainEq` then **drops** at
   `m.length === cell.eq.length`, so the naive fix silently disables the measured villain profile at
   nine seats — a worse behaviour than the one it replaces. It needs the width, `validMeasurement`,
   the result slice and the cache key moved together, which is a lane-U-sized change, not an
   integration edit. **For S5 to write down and the red team to price.**
2. **A nine-wide Simulate measurement never reaches the tiers** — `villainEq` drops it on length.
   Not a crash; a measurement-layer limitation for METHODOLOGY.
3. **The ring's D12(e) margin is 24.6 s (1.9 %) against 3.4 % of measured run-to-run variance.**
   `data/ring.json` was **not** regenerated at S3 and must not be: any kernel or generator edit
   reddens D12(a) by hash and forces a ~21-minute rerun.
4. **Lane K's shipped `see SIXMAX` cap string** is table-size prose in four artifacts. Renaming it
   moves `model.json`'s `baselineTiers.caps`, which §0.4 puts outside `constants.ladder`. **Left
   this run and filed**, per the risk register.
5. **`WALL_MEASURED_MS` (26,200) now describes a suite two-thirds its size**: verify's wall reads
   **39.6 s at run 3** (42.0 s at run 2) against the 41,920 ms soft ceiling, because I49 became a
   26,136-setting sweep the moment the fixture existed — 6,298 ms, 15.9 % of the suite, on its own.
   The ceiling is soft and never changes the exit code. **S5 re-measures. Not raised here.**
6. **`node smoke.mjs` 2/2 and `node browsers.mjs` 2/2, on the shipped artifacts with the real ring.**
   Re-measured at run 3 (§8c): the three morph rows are **unmoved** against their 8 / 16 / 4 ms
   budgets (lite p95 0.80 / 12.30 / 1.90; full 0.90 / 11.90 / 1.90), and lane U's new row reads
   **p95 1.70 ms lite / 1.80 ms full against 16 ms**, exercising the real payload rather than a stub: `rail 9 seats at 9-max and 6
   back at 6-max · N_eff clamp 7 -> 9 · seat UTG -> LJ -> UTG, kept by distance from the button`.
   `browsers.mjs` F4 reads `ring payload present · control live · rail 6 -> 9 -> 6, clamp 7 -> 9` in
   **chromium, Firefox and WebKit**, headless, throwaway profiles, no installed browser touched.
7. **`data/model.json` changed by exactly what §0.4 permits**: `constants.ladder` (with S3's
   `census`), the 69 gate stamps and `meta.hash`. `cells`, `order`, `orderHash`, `calibration` and
   `baselineTiers` are byte-identical — `generate-equilibrium.mjs --check` re-solves
   `baselineTiers` byte-identically and confirms it.
8. **THE PROVENANCE COUPLING, promoted from §8b to a named finding for the red team.**
   `ring.meta.model.hash` is a **whole-file canonical hash of `data/model.json`, carried as
   provenance only**; `ring.meta.model.orderHash` is **the input the villain pools are actually
   built from**. The artifact's `contentHash` covers the former, so **any §0.4-authorised stamp into
   `data/model.json` — a new constant, a new gate verdict — reddens `generate-ring.mjs --check` and
   forces a ~21-minute regeneration that changes not one measured column**. It fired exactly once
   this run (run 2's blocker) and the owner cleared it by regenerating; `orderHash` did **not** move
   (`8fee6769…` on both sides), which is the finding in one line. **Not repaired here, deliberately:**
   both candidate narrowings land in `ring.mjs` / `generate-ring.mjs`, whose bytes *are*
   `generatorHash`, so either reddens the check by a second route and needs the same regeneration.
   **S4 attacks the coupling; S5 documents it.** It is returned in `newConstants` as a finding
   wearing a constant's badge, not as a number to anchor.
9. **A pre-existing figure inconsistency in `variant.mjs:233`, surfaced not chased.** The full
   variant's `budgetSource` prose says the page measures **704,433 B = 687.9K**; the tree measures
   **704,700 B = 688.2K** and `build --check` prints 688.2 KB. The cap arithmetic is unaffected
   (695K = 711,680 B is above either reading, and its +5 % bound is 723K), no gate or test asserts
   the literal, and editing `variant.mjs` would move the **seven D6 cite line numbers** and redden
   D11 for a prose nicety. **An S5 docs item.**
10. **Run-3 prose drift, same class, same disposition.** `variant.mjs`'s `budgetSource` sentences,
   the test comments and `docs/V4-PLAN.md`'s Measured blocks quote the run-2 figures **18,620 B**
   (ring injected) and **633,260 B** (lite total); the tree now measures **18,618** and **633,258**
   after the owner's regeneration (§4.3's run-3 note). Nothing asserts them, the caps are unchanged,
   and the only file that *must* agree with the tree — `test/block-census.test.mjs`'s `TODAY` — was
   re-pinned. **S5 folds the prose in.**
