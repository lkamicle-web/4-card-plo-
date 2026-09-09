# V4 Stage S6 — verification, and the one fix round

**Tree:** `main`, HEAD `57bae0f` (S3's four lane merges) with S4/S5/S6's work in the working tree.
`RUNDOWN_V4_BASE` unset, so I48(a)'s fallback base is `e801f07`, the commit that added
`docs/V4-PLAN.md`. No commit was made by this round; no `--force` was run anywhere, at any stage,
for any reason.

> **This file replaces a stale run-1 report of the same name.** That report was written from
> `1d988f5` *before* the four fan-out lanes were merged: it read 62/62 gates, 691 tests, no
> `scripts/generate-ring.mjs`, no `--seats9` flag, no `data/tiers-9max.fixture.txt`, and concluded
> **RED — "integration (S5) never merged"**. Every one of those findings was true of the tree it
> looked at and is false of this one; it was untracked, so it would have ridden into the boundary
> commit as a contradiction of the run it was filed under. It is overwritten rather than deleted —
> this paragraph is the record that it existed and what it said.

---

## 1. The verification round's report, and what each item turned out to be

| # | verifier's item | disposition |
|---|---|---|
| 1 | `generate-ring.mjs --check` RED — contentHash drift | **REAL, and fixed here.** Root cause is not the same-session verify trap the verifier attributed it to. See §2. |
| 2 | I48(a) `--force` evidence — the 9-max fixture cannot show as ADDED | **NOT A DEFECT.** The gate is green; the letter is satisfiable only by the boundary commit. See §4. |
| 3 | model identity — `evCut.derivedAt.state` gained `\|6`, `straddle.seatDerivedFrom` is new | **REAL, and fixed here.** Both were §0.4 violations in the working tree. See §3. |

Everything else the verifier reported was green and is still green: 69/69 gates, the test suite
(797 tests then; 798 now, the extra one being the violator test §3 adds), both builds current,
smoke 2/2, browsers 2/2, the registry prefix (69 = 62 + 7 appended), the changed-domain gates
I15/I26/I36/I38, D13's caps, the top-level ring budget row, and the checkdown-matrix and
equilibrium generators byte-identical.

---

## 2. Root cause A — the ring's provenance stamp, a scheduling omission

`ring.meta.model.hash` records `data/model.json`'s **whole-file** hash (`generate-ring.mjs:242`
reads `model.meta.hash`). The narrow input the villain pools are actually built from is
`meta.orderHash`, and D12(c) asserts *that* one; the whole-file hash is deliberately **not**
asserted, because it moves on any §0.4-authorised stamp. That disposition is on the record at
`docs/METHODOLOGY.md` §3.6, `scripts/gates/ring-artifact.mjs:300-309` and
`docs/spikes/V4-integration.md` §8b.2 — recorded as a finding, not repaired, because the repair
lands in bytes that *are* `generatorHash`.

The standing cost of that decision is one sentence: **any stamp into `data/model.json` forces a
~21-minute deterministic re-stamp of `data/ring.json` that changes not one measured column.**

What happened is exactly that, and nothing more exotic:

- S3's owner regeneration wrote `ring.meta.model.hash = d20e334f…`.
- S4 (the `constants.ladder.flag` prose) and S5 (limitation 20 as `constants.limitations[2]`)
  legitimately re-stamped `data/model.json`.
- `docs/spikes/V4-repin.md` §5 finding 1 recorded `--check` as **already RED before S5 touched
  anything** and prescribed the remedy: regenerate the ring as the **last** model-touching act of
  the run. S6's brief only *checked* it. Nobody scheduled the regeneration.

Two corrections to the verifier's attribution, both material:

1. **It is not the "verify stamps model.json" same-session trap.** That trap would have been cured
   by a clean checkout. This is not: HEAD's ring does match HEAD's `model.json`, but the boundary
   commit carries the *stamped* `model.json`, so a post-commit `--check` would be red without the
   regeneration against the final stamp. A clean-checkout re-run would have been false comfort.
2. **"18,600 B vs 18,598 B" is not a 7-byte phantom.** Those are JavaScript string lengths of a file
   containing multibyte punctuation; `data/ring.json` was 18,605 bytes on disk. There is no second,
   hidden drift to chase.

Also worth stating because the verifier got it backwards: HEAD's `data/equilibrium.json` is **stale
against HEAD's own generator** (lane K's `cfr.mjs`/`equilibrium.mjs` edits moved `generatorHash`).
The working-tree copy is S3's step-6 ceremony regeneration, it passes `--check`, and it must ride
into the boundary commit untouched. Its modified status is *not* "purely a side effect of S6's
commands".

---

## 3. Root cause C — two S1-era provenance fields outside `constants.ladder`

§0.4 requires that at `seats = 6` every byte of `data/model.json` outside the new `constants.ladder`
block is identical to `1d988f5`. Two fields broke it, both entered at S1, both accepted at B1, and
`docs/spikes/V4-ladder.md:79` recorded them at the time as two of "exactly four diffs" — so this is
a claim that was written down and then not re-read against the constraint, not a claim that was
hidden.

**(i) `constants.evCut.derivedAt.state` gained a `|6` segment.** `policy.mjs`'s `envKey` appended
`|${e.seats}` unconditionally; `scripts/lib/ev-band.mjs`'s `evDefaultKey` embeds `envKey`; and
`constants.evCut.derivedAt.state` **ships that string**. So the seat axis was not inert at six *in
the shipped model*, even though it was inert in every number.

Repaired by serialising the segment only when the size is not the legacy one:

    `${…}|${e.sizing}` + (e.seats === 6 ? '' : `|${e.seats}`)

The axis stays **in the key**. Removing it would hand one table size the other size's memoised
answer — the trap `envKey`'s own docstring is about, and the one `test/ladder.test.mjs:186` pins.
`envOf` normalises any other integer to 6 before this runs, so no third serialisation exists to
collide with either. All four existing pins still hold, live-derived rather than literal:
`envKey({seats:9}) !== envKey({seats:6})`, `envKey({seats:6}) === envKey({})`,
`envKey({seats:7}) === envKey({})`, and I40(d)/`test/ev-cut.test.mjs` re-derive both sides.
The page's own `envKey()` (`src/shell.html:3028`) is a different function with a different format
and was not touched. Nothing pins the fingerprint as a literal anywhere — grepped: the only place
the full string is written out is `docs/refutations/P4.md:381`, in a refuter's prose from the phase
that introduced `derivedAt`, and the repaired string matches that quotation character for
character again.

**(ii) `constants.straddle.seatDerivedFrom` moved into the ladder block** as
`constants.ladder.anchorSharedWith: 'straddle.seat'`. I51(a)'s assertion moved with it and **both
clauses are kept** — the `Object.is(straddle.seat, ladder.earlyStep)` equality *and* the provenance
string asserted by value, with its failure sentence unchanged. The string clause had no
fabricated-violator test of its own before this round (only the equality clause did); it has one
now, which re-points the string at itself and then deletes it. `straddle.seat` stays a plain number,
so I26 and `seatWidthFactor` read exactly what they read before.

**Sub-budget arithmetic, checked before the move rather than after.** `gates/data.mjs` computes
`metaCore = sizes.meta − solver − skill − evCut − ladder`. `straddle` is not a reserved block, so
its bytes count against `metaCore`; `ladder` is subtracted. The relocation therefore moves ~37 B
**out of** the constrained side and **into** a block that is subtracted from it: `metaCore` falls
and `ladder` rises. Measured after: seat ladder **668 B / 1 K**, `meta+tables` core **13.0 K / 13 K**.
**No ceiling moved in either direction, and none needed to.** The falsified §2.7 prediction recorded
at `gates/data.mjs:623-627` stands as measured at S1; an S6 note was appended beside it, not over it.

### The residual, measured field-by-field against `1d988f5`

`data/model.json` differs in exactly **ten paths**:

    meta.hash
    constants.limitations          (§6's limitation 20, appended as item [2])
    constants.ladder               (the block §0.4 excepts by name)
    gates.I48  gates.I49  gates.I50  gates.I51  gates.I52  gates.D12  gates.D13

`cells`, `rows`, `order`, `baselineTiers`, `calibration`, `bands` and `benchmarks` are byte-identical
as **whole blocks** — `cells` has 145 entries, 123 of which carry `eq` and `vDelta`, and the whole
block compares equal, so not one measured number moved. `constants.evCut` and
`constants.straddle` no longer differ at all.

This residual cannot be driven to zero and should not be: reverting the seven verdict stamps would
make `build.mjs` refuse the model (it will not build a stamped non-pass) and `--check` report STALE,
and deleting limitation 20 would delete a §6 deliverable. It is the v3 P-stage precedent exactly.

---

## 4. Item 2 — I48(a) is green; the verifier's letter needs the boundary commit

Gate I48(a) reads the diff shape of the fixtures over `e801f07..HEAD` and accepts `-` for a fixture
that is not yet committed. Its own report this run:

    (a) diff shape legacy [tiers-v1.fixture.txt:- tiers-v2.fixture.txt:- tiers-v3-default.fixture.txt:-]
        9max:- across e801f07d..HEAD (base from the commit that added docs/V4-PLAN.md)

The evidence available **before** the boundary commit, and it is the substantive evidence:

    $ git status --porcelain data/
     M data/equilibrium.json
     M data/model.json
     M data/ring.json
    ?? data/tiers-9max.fixture.txt          <- untracked: A appears only after the commit

    $ git diff --name-status e801f07..HEAD -- data/
    M	data/model.json
    A	data/ring.json                       <- no legacy fixture in ANY state, modified or otherwise

    $ node scripts/freeze-tiers.mjs --seats9 --check
    reproduces byte-for-byte, empty diff

A fixture that reproduces byte-for-byte from the shipped constants is proof that neither `--force`
nor a hand edit produced it — that is what the check is *for*. The literal "ADDED in
`e801f07..HEAD`" is satisfiable only by the commit agent's single boundary commit. Making it true
early would require committing, `git add -N`, or a split "fixture commit", all of which are
forbidden and all of which would break the single-boundary-commit idiom. If a re-verifier still
marks this PARTIAL, it is an owner adjudication under plan §7.5, not a code fix.

---

## 5. Order of operations actually executed

Every stamp-affecting edit landed **before** the regeneration; nothing model-touching ran after it.

1. Triage appended verbatim to `docs/spikes/V4-workorders.md` under `## S6 triage`.
2. `policy.mjs`: `envKey` inert serialisation; `seatDerivedFrom` → `ladder.anchorSharedWith`.
   `gates/ring.mjs` I51(a) clause re-pointed (both clauses kept); `test/ladder.test.mjs` and
   `test/gates-ring.test.mjs` updated and strengthened; `gates/data.mjs`'s sub-budget note appended.
3. Records: V4-PLAN §0.4 `Measured (stage S6)`; `docs/refutations/V4.md` #18 dated append;
   `docs/spikes/V4-ladder.md` §13 dated append; this file. **No `docs/METHODOLOGY.md` edit** — D6
   cites it by literal line, and after S5's re-pin those lines are :254, :2695, :2751, :2861, :2908,
   :2939, :2959, :2975, :3054 and :3062 (read off D6's own report). Inserting above any of them
   would redden D6 late, which is plan §8's mode (5). Nothing this round needed to say belonged in
   METHODOLOGY: §3.6 already documents the ring/model stamp coupling this round paid.
4. Fixed point proved **before** the regeneration: three consecutive `node scripts/verify.mjs` runs,
   `shasum -a 256 data/model.json` identical each time.
5. `node scripts/generate-ring.mjs` — alone, on an idle machine, default 4 workers (D12(e)'s own
   regime), no `--force` (the writer has no such flag).
6. Both variants rebuilt; verify re-run and the sha256 re-read; the full check battery.

---

## 6. Readings

Every number below was read off a command run in this tree, in the order the commands were run.

### 6.1 The fixed point, proved BEFORE the regeneration

`node scripts/verify.mjs` run three times in a row after the last identity edit — **69/69 gates,
exit 0**, ~40 s each — with the file hash read between runs:

    shasum -a 256 data/model.json
    950d437bcc10afd01e4563d9e8a1e7eb2b759a8d67eb043ccc5e3db813310aa1   (identical all three times)
    model.meta.hash = f35156df4ee9ecc310774a38d675d43263579138f185f00215eede9c1c1d5d33

The second value is the one `generate-ring.mjs:242` copies into `ring.meta.model.hash`. Call it
**H**. Had it moved between runs the regeneration would have been chasing a moving target and the
correct action would have been to stop; it did not move.

### 6.2 The regeneration — `node scripts/generate-ring.mjs`, alone, 4 workers (D12(e)'s own regime)

    R-CELL   A 14.3 s   B 14.1 s
    R-LATT   A 564.9 s (5,195,877 blocked-pool fallbacks)
             B 563.6 s (5,210,970 blocked-pool fallbacks)
    wall     1,156.9 s against the pre-registered 1,280 s budget (R2) — INSIDE, 123.1 s = 9.6 % of margin

That is **faster than S3's 1,213 s**, i.e. the margin widened rather than narrowed, and the two
fallback counts are **identical to the pair S3 recorded** — the strongest cheap determinism signal
the run has. The wall was read before anything was built on it. No `--force`: the writer has no such
flag, and R2's halving clause (which would move `se.latt` and the badged surfaces) was not reached
and is not this round's to pull in any case.

**And not one measured column moved**, which is the whole claim of a provenance re-stamp:

| | before | after |
|---|---|---|
| `meta.model.hash` | `d20e334f…` (S3's stamp) | **`f35156df…` = H** |
| `meta.model.orderHash` | `8fee6769f6e3b7dd` | `8fee6769f6e3b7dd` (unchanged) |
| `meta.model.nMax` | 7 | 7 |
| `meta.generatorHash` | `6486b8b2af8827c6…` | identical |
| `meta.kernelHash` | `2318d2d41b037244…` | identical |
| `meta.contentHash` | `b39f9de681988a3a…` | `eea6dda2bc47b277…` (derived; moves with the stamp) |
| `meta.wallSec` | 1213 | 1156.9 |
| `cells` (123 entries) | — | **0 of 123 differ; the whole block compares equal** |
| everything outside `cells` + `meta` | — | identical |
| bytes on disk | 18,605 | 18,607 (+2 B: `wallSec` gained two characters) |

Only three `meta` fields moved in total: `contentHash`, `wallSec` and `model`.

### 6.3 Nothing re-opened the gap

    node scripts/build.mjs                      lite 619.0 KB · ring payload 18.2 · app 405.6 · core 360.5
    node scripts/build.mjs --variant=full       full 688.8 KB · ring payload 18.2 · app 405.8 · core 360.7
    node scripts/verify.mjs                     69/69 gates pass, exit 0, 40.8 s
    shasum -a 256 data/model.json               950d437b… — STILL H's file, unchanged by the regeneration
    model.meta.hash                             f35156df… — STILL the value the new ring pins
    node scripts/build.mjs --check              2/2 variants current (lite, full)

D12's own line after the regeneration: `gen 6486b8b2 · kern 2318d2d4 · … · ring 18.2K injected
(18.2K on disk) ≤ 20.0K · wall 1156.9s / 1280s`. D13: `app === appCore + Σ caps (361K + 49K = 410K),
model.json's core 120K / metaCore 13K / skill 1K unraised`. **No ceiling was raised by this round,
in either artifact or in `model.json`'s sub-budgets.**

### 6.4 Tests, and the one re-pin

`node --test test/*.test.mjs` → **798/798 pass, exit 0** (797 before, plus §3's violator test).

The first run had exactly one red, `test/block-census.test.mjs`'s `TODAY` census, and it moved
**only the two fields the edits explain**:

    total      633,856 -> 633,873   (+17 B)
    modelCode   57,465 ->  57,484   (+19 B)
    app 415,348 · appCore 369,169 · gto 10,241 · ev 11,403 · skill 3,532 · topn 4,844 ·
    calib 5,313 · ring 10,846      — ALL BYTE-IDENTICAL

It decomposes to the byte, and every term is one of this round's two edits or its consequence:
**+19 B** of `modelCode` for the two `policy.mjs` repairs; **−2 B** of stamped `constants` because
`"anchorSharedWith":"straddle.seat"` is two characters shorter than the sibling it replaced;
**−2 B** more because `derivedAt.state` lost its `|6`; **+2 B** of injected ring payload for
`wallSec 1156.9` against `1213`. 19 − 2 − 2 + 2 = **17**. Re-pinned once, after the final build, with
the note inside the existing comment so no assertion line shifted. `modelCode` reads 57,484 B
against the 57 KB (58,368 B) cap S5 paid for — 884 B under it, no raise.

### 6.5 The close-out battery

| command | result |
|---|---|
| `generate-checkdown-matrix.mjs --check` | OK, byte-identical (314,167 B, contentHash `3356b2226b5b2087`) |
| `generate-equilibrium.mjs --check` | OK, re-solves byte-identically (71,215 B, contentHash `d118c922fe2886e3`); `baselineTiers` (11,780 B) confirmed as the block this solve produces |
| `freeze-tiers.mjs --check` (v1, I22) | reproduces — 1,386 settings × 123 cells identical |
| `freeze-tiers.mjs --v2 --check` (I32) | reproduces — 16,632 × 123 identical |
| `freeze-tiers.mjs --v3 --check` | reproduces — 16,632 × 123 identical |
| `freeze-tiers.mjs --seats9 --check` (I49) | reproduces — 26,136 × 123 identical |
| `node smoke.mjs` | **2/2 variants green** |
| `node browsers.mjs` | **2/2 variants green** (SF, SS + chromium reference; headless, throwaway profiles) |
| `generate-ring.mjs --check --workers=8` | **OK — `data/ring.json` is byte-identical to a rebuild from its own recorded inputs**, `meta.wallSec` blanked on both sides (the one documented exclusion; 18,600 B, contentHash `eea6dda2bc47b277`; recorded 1,156.9 s, re-measured 614.4 s at 8 workers). **This is the check that was RED at the verification round.** The two fallback counts came back 5,195,877 / 5,210,970 for the third time. |

The three legacy morph rows, unchanged and inside their budgets on the lite artifact — short sweep
p95 **0.90 ms** / 8, profile-ON p95 **11.90 ms** / 16, profile-OFF p95 **1.80 ms** / 4 — plus lane
U's table-size toggle row at p95 **1.90 ms** / 16, which also reads back the rail (9 seats at 9-max,
6 at 6-max), the `N_eff` clamp moving 7 → 9, and the seat name round-tripping UTG → LJ → UTG.

**All four fixture `--check` kinds reproduce and no `--force` was run at any point in this round.**
`data/tiers-9max.fixture.txt` was neither rewritten nor touched; it reproduces from the shipped
constants after both identity edits, which is independent evidence that the edits moved no tier.

### 6.6 Final tree state

`git status --porcelain` — 32 modified, 5 untracked, nothing staged:

    M .claude/workflows/v4.js        M scripts/build.mjs             M test/block-census.test.mjs
    M README.md                      M scripts/gates/data.mjs        M test/gates-reserved.test.mjs
    M data/equilibrium.json          M scripts/gates/reserved.mjs    M test/gates-ring.test.mjs
    M data/model.json                M scripts/gates/ring-artifact.mjs  M test/gates-variants.test.mjs
    M data/ring.json                 M scripts/gates/ring.mjs        M test/ladder.test.mjs
    M docs/METHODOLOGY.md            M scripts/gates/skill.mjs       M test/ring-gate.test.mjs
    M docs/V4-PLAN.md                M scripts/lib/block-census.mjs  M test/shell-compile.test.mjs
    M docs/spikes/V4-ladder.md       M scripts/lib/policy.mjs        M test/skill-9max.test.mjs
    M docs/spikes/V4-workorders.md   M scripts/lib/variant.mjs       M test/tier-fixture-9max.test.mjs
    M index-full.html                M src/shell.html                M test/variant.test.mjs
    M index.html                     M package.json
    ?? data/tiers-9max.fixture.txt   ?? docs/refutations/V4.md       ?? docs/spikes/V4-integration.md
    ?? docs/spikes/V4-repin.md       ?? docs/spikes/V4-S6-verification.md

`docs/METHODOLOGY.md`, `src/shell.html`, `scripts/lib/variant.mjs`, `scripts/build.mjs` and the
other gate/test files carry S1-S5's work, not this round's. **This round touched exactly seven
files** plus the two generated artifacts and the two generated data files: `scripts/lib/policy.mjs`,
`scripts/gates/ring.mjs`, `scripts/gates/data.mjs` (a comment), `test/ladder.test.mjs`,
`test/gates-ring.test.mjs`, `test/block-census.test.mjs`, and the records
(`docs/V4-PLAN.md`, `docs/refutations/V4.md`, `docs/spikes/V4-ladder.md`,
`docs/spikes/V4-integration.md`, `docs/spikes/V4-workorders.md`, this file).

**No legacy fixture appears under `data/` in any state** — not modified, not staged, not rewritten;
`git diff --name-status e801f07..HEAD -- data/` still shows only `M data/model.json` and
`A data/ring.json`. Nothing was committed, nothing was staged, and no `git add -N` or split
"fixture commit" was used to make the 9-max fixture read as ADDED early. The boundary commit is the
commit agent's.
