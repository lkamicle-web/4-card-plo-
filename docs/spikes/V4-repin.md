# V4 S5 — the documents, and the D6 re-pin. One row per cite.

Stage S5 on the **main** tree. Everything the run measured is now in the record, and the last step
re-pointed every literal-line cite the earlier steps moved. The re-pin was done **last**, by
CONTENT — for each anchor the quoted phrase was grepped in its cited file, the line it sits on now
was taken, and only the number changed. **No quote was edited so that it would resolve, and no cite
was re-pointed at a different sentence that happened to match**; every phrase below occurs exactly
once in its file, so each re-point is unambiguous. The verifier was re-run after it.

**GREEN at return:** `node scripts/verify.mjs` **69/69, exit 0** · `node --test test/*.test.mjs`
**797/797** · `node scripts/build.mjs --check` **2/2 current**.

---

## 1. `scripts/gates/data.mjs` — D6's `CEILING_MARGINS`

**8 anchors re-pinned, 12 unmoved, 4 added. 24 checked, 0 problems.** Every METHODOLOGY cite moved,
and by the same offsets the new §3.6 and the §9.11 additions introduced; not one `variant.mjs` or
`build.mjs` cite moved, because both files were edited *without changing their line count* (the
budgetSource sentences are appended inside their existing final chunk lines).

| row | file | quoted phrase | old | new |
|---|---|---|---:|---:|
| `total` | docs/METHODOLOGY.md | measurement plus about 5 %, the same rule the phase-3 numbers were set by | 2363 | **2695** |
| `app` | docs/METHODOLOGY.md | +5 % is 387.6, rounded up to the whole KB: **388 KB** | 2522 | **2861** |
| `app` | docs/METHODOLOGY.md | under the +5 % this rule would allow (413 KB) | 2620 | **2959** |
| `appCore` | docs/METHODOLOGY.md | measurement plus about 5 %, the same rule the phase-3 numbers were set by | 2363 | **2695** |
| `modelCode` | docs/METHODOLOGY.md | that measurement plus about 8 % | 2412 | **2751** |
| `blocks` | docs/METHODOLOGY.md | at measured+5 % rounded up to the whole KB | 2569 | **2908** |
| `blocks` | docs/METHODOLOGY.md | 4,844 B + 5 % = 5,087 B, rounded up to the whole KB | 2600 | **2939** |
| `blocks` | docs/METHODOLOGY.md | 5,313 B + 5 % = 5,579 B, rounded up to the whole KB | 2636 | **2975** |
| `total` | scripts/build.mjs | Each budget below is that measurement plus about 5%, rounded | 498 | 498 (unmoved) |
| `total` | scripts/build.mjs | TOTAL 600 KB | 513 | 513 (unmoved) |
| `total` | scripts/lib/variant.mjs | DELIBERATELY far below the 686K a fresh measured+5% would give | 224 | 224 (unmoved) |
| `app` | scripts/lib/variant.mjs | far under the +5% this rule would allow (413K) | 159 | 159 (unmoved) |
| `appCore` | scripts/lib/variant.mjs | the app payload MINUS the `@block:gto` region — the pre-raise ceiling | 104 | 104 (unmoved) |
| `appCore` | scripts/build.mjs | Each budget below is that measurement plus about 5%, rounded | 498 | 498 (unmoved) |
| `appCore` | scripts/build.mjs | APP 360 KB (was 345). Measured 344.8, headroom 4.4% | 517 | 517 (unmoved) |
| `appCore` | docs/METHODOLOGY.md | a removal that does not move the ceiling | 254 | 254 (unmoved) |
| `modelCode` | scripts/lib/variant.mjs | DELIBERATELY BELOW the 8% margin this gate was calibrated | 119 | 119 (unmoved) |
| `modelCode` | scripts/lib/variant.mjs | calibrated +8%, which would give 56K | 136 | 136 (unmoved) |
| `modelCode` | scripts/build.mjs | measurement plus about 8%, the margin this gate was originally calibrated with | 527 | 527 (unmoved) |
| `blocks` | scripts/lib/variant.mjs | a per-block ceiling at measured+5% | 140 | 140 (unmoved) |
| **`ring`** *(new)* | scripts/lib/variant.mjs | ring 20K is NEW and is the ARTIFACT budget | — | **173** |
| **`ring`** *(new)* | docs/METHODOLOGY.md | the ring artifact's budget is that measurement plus 5 %, rounded up to the whole KB | — | **3062** |
| **`blocks.ring`** *(new)* | scripts/lib/variant.mjs | blocks.ring 11K is NEW and is TIGHTER THAN ITS OWN RULE | — | **173** |
| **`blocks.ring`** *(new)* | docs/METHODOLOGY.md | the ring block's cap is that measurement plus 5 %, rounded up to the whole KB | — | **3054** |

**The two new rows are CITE rows and the module says so.** Neither ceiling is *enforced* from
`CEILING_MARGINS`: `blocks.ring` is bounded by the `blocks` row, whose clause iterates the whole
block table rather than a fixed list, and the artifact row is **D12(d)**'s pin, because D6's
from-above clause excludes `eq` and the `model.json` sub-budgets and this row is the same kind of
thing. What they add is the thing `citationProblems` exists for — the +5 % both were set by is now
held to the lines documenting it, in `variant.mjs`'s manifest and in METHODOLOGY §9.11. Deliberately
**not** changed: `gates/ring-artifact.mjs`'s `RING_CEILING_FACTOR` still reads
`CEILING_MARGINS.blocks.factor`, so there is still exactly one shipped copy of 1.05 — which is what
the S4 red team's finding on that constant was about. D6 now prints both rows' cites and reports
**24 cited lines re-read this run**.

## 2. `README.md` — the ungated METHODOLOGY cites

**24 line numbers re-pointed, 2 left alone**, all located by content against the pre-S5 file
(`git show HEAD:docs/METHODOLOGY.md`, identical to the pre-edit tree over lines 1–3670) and each
target re-read after the move. Nothing but a reader catches a wrong one, so each was verified by
printing the destination line.

| README line | what it cites | old | new |
|---|---|---:|---:|
| backlog 1 | §5.1's depth→width close-out … its ceremony | 1113–1124 | **1445–1456** |
| backlog 2 | limitation 19's head; "the node is cut" | 3355, 3419 | **3792, 3856** |
| backlog 3 | the claim-scope rule sentence | 3426 | **3863** |
| backlog 4 | limitation 19's multiway-probe passage; the I35 row | 3406–3419, 3565 | **3843–3856, 4057** |
| backlog 5 | §0's honesty statement; limitation 18 + its P5 update | 68 *(unmoved)*, 3289, 3301 | 68, **3726, 3738** |
| backlog 6 | limitation 18's successor experiment | 3320–3321 | **3757–3758** |
| backlog 7 | §3.5's head *(unmoved)*; the plays-better subsection; the I37 row | 617 *(unmoved)*, 666, 3569 | 617, **694, 4061** |
| backlog 8 | limitation 8; §7's premium flag | 3052, 1723 | **3467, 2055** |
| backlog 12 | §9.11's app-raise measurement | 2522 | **2861** |
| backlog 12 | §9.11's "budgets, retuned" paragraph | 2362 | **2694** |
| backlog 12 | the `depth.beta` anchor row | 964 | **1296** |
| backlog 13 | §8.1's "where that N comes from" | 1871 | **2203** |
| backlog 14 | §9.11's release-consolidation span | 2643–2705 | **2982–3044** |
| backlog 15 | the one-dependency paragraph | 2717 | **3132** |
| backlog 17 | limitation 15 | 3175 | **3612** |

One non-METHODOLOGY cite was re-pointed in the same pass because it had drifted for the same reason:
the Method view's *Known weaknesses* read of `constants.limitations`, `src/shell.html:8969` →
**:9375**.

## 3. Document sections written or rewritten

**docs/METHODOLOGY.md**

- **§3.6 The table-size axis — six seats and nine** *(new, ~300 lines)*: the ladder and the one
  identity it turns on (six-max `UTG` **is** nine-max `LJ`); the structural functions that replaced
  the name-keyed tables, with what each returns at nine and `test/ladder.test.mjs` as the witness;
  the 33/21 legal-pair count; the early-seat rules with their derived values (`baseRaise`
  0.1232 · 0.094864 · 0.07304528, `baseR` flat) and **the red team's verdict on each**; the ring
  artifact, its meta, its re-derived wall budget and its agreement statistics, plus the
  rejection-exhaustion finding and the model-hash provenance coupling; the extrapolated census at
  both sizes; and the **sub-ladder diff folded in from the S3 handoff**, which is deleted from the
  end of the file rather than duplicated.
- **§3.5**: the "five nut-gate releases" sentence **corrected to the measurement** (2 of the 5 cross
  `nutGate[2]`, 0 of the 35 crossing cells were `gated`), and the nine-seat exception record added —
  9 endpoint / 20 interior, the one six-seat exception the axis erases, the three it creates.
- **§9.11**: a new v4 paragraph — `blocks.ring` 11 KB and the top-level per-variant `ring` 20 KB
  artifact budget (explicitly *not* a `model.json` sub-budget), then every raise with its
  measurement and its shrink-first bytes: `appCore` 360→361, `app` 398→410 by the cap-sum equality,
  lite `total` 600→625 with §2.7's fit prediction falsified, **full `total` 660→695**, the 1,257 B
  recovered before any of it was asked for, the two artifact shrinks measured and declined, and
  **S5's own `modelCode` 56→57 KB**. The v3 budget table is marked as the v3 release reading and
  points at the v4 paragraph. Closing note: `metaCore` now reads 13,300 B of 13,312.
- **§10 limitation 20** *(new)*: the early-seat constants are extrapolated from the model's own
  six-seat ladder and no nine-handed corpus of any kind has touched them — shipped in
  `constants.limitations` and rendered in the Method view from shipped data, like 16 and 17.
- **§10 limitation 10**: the nine-seat reading — the containment measurement (0 subset violations in
  16,632 comparisons, 1,722 of 1,722 excess cells attributed), the per-seat union counts, and **the
  nut-gate bypass** recorded as the finding §5.2 asked for (0 of 1,046 excess cells would have been
  demoted, so nothing painted today depends on it).
- **§10**: a disposition paragraph — *7-max / 8-max are out; 9-max ships as an axis*.
- **The `SIXMAX` prose at all four sites**, located by content: :3406 (limitation 19's re-opening
  sentence), :3425 (its claim-scope sentence), :3565 (the I35 row's `(d)` heading and its
  `reopenRule` cite) and :3566 (the I36 row's `reopenVerdict` cite). The reasoning is untouched;
  only the table-size framing moved, and the rename carries its own one-line provenance note.
- **I36(d)'s coverage datum** now reads 3 of 36 with 33 uncovered at nine seats beside its 3 of 24.

**README.md** — *What v4 added* (after *What v3 added*); backlog item **16 CLOSED** with the
7-max/8-max residue restated as the deliberate out-of-scope decision it is; *Regenerating the data*
gains the three out-of-pipeline generators and `generate-ring.mjs`'s **own 1,280 s wall budget**,
stated as separate from `generate-data.mjs`'s 188 s and with the falsified 300 s derivation
recorded; *Repo layout* corrected for the dual build (both artifacts, all four data artifacts, the
four fixtures, the gate families, the plans and records); the standing-limitation count 19 → 20.

**docs/V4-PLAN.md** — `> **Measured (stage S5).**` blocks beneath §2.2 (the legal-pair count, plus
the two-derivations caution), §2.4 (the ring wall against **both** the 300 s as written and the
owner-amended 1,280 s, beneath the owner's blocks, which are left exactly as written), §2.7 (S5's
`modelCode` raise and a re-measurement of every other ceiling), §3 R1 (both rules' readings side by
side), §3 R3 (the census, and limitation 20 now existing), §5.2 D12 (the prefix agreement, the
falsified 2·se band and the two zero-tolerance seam clauses); and **§10.1 Resolutions** answering
questions 1, 2 and 3 with the evidence that answered them.

**package.json** — `version` → `4.0.0-dev`.

## 4. The one ceiling this stage moved, and the four pins it re-measured

`modelCode` **56 K → 57 K**, in both variants, because limitation 20 ships as data. Measured
267 B of minified `policy.mjs`, 57,198 → **57,465 B** against a 57,344 B cap: over by 121 B. The
shrink was measured first and returns 47 B (3 B for joining the note's two chunks, 6 B for trimming
`of`, 38 B of *model payload* — not `modelCode` — for dropping `flagsItExplains`), so the raise is
taken rather than the admission trimmed. Both `budgetSource` strings carry the arrow `-> 57K` and a
`SHRINK-FIRST, MEASURED IN BYTES` sentence, which is what D13 reads.

Four measurement pins moved with it, each a measurement and not a decision:
`test/block-census.test.mjs`'s `TODAY` (`total` 633,326 → **633,856**, `modelCode` 57,198 →
**57,465**; `app`, `appCore` and all six block figures byte-identical) and its `model code
55.9K/56K` reading regex; `test/variant.test.mjs`'s lite budgets deepEqual; and
`test/gates-variants.test.mjs`'s metaCore-reservation reading regex, which was written
`1[3-9.]+K` — a character class that cannot match a tenth of `0`. Nobody noticed while the padded
reading landed at 13.7 K; limitation 20's 263 B took `metaCore` to 13,300 B, so the same 1,024 B of
padding now prints **14.0 K** and the pattern went red on its own spelling. Widened to
`1[3-9]\.\dK`, which is what it always meant; the refusal itself (`g.pass === false`) is untouched.

## 5. Findings, for S6 rather than for this stage

1. **`node scripts/generate-ring.mjs --check` is RED on this tree, and it was red before S5 touched
   anything.** `ring.meta.model.hash` records `d20e334f…`, the `data/model.json` whole-file hash as
   it stood at S3's regeneration; the live model has been re-stamped since (S4's clause work, and
   now limitation 20), so the rebuild's meta cannot match the file's and `--check` fails on
   `contentHash`. This is exactly the standing cost `docs/spikes/V4-integration.md` §8b.2 recorded
   and asked S5 to document: **any stamp into `model.json` forces a ~21-minute deterministic
   re-stamp of `data/ring.json` that changes not one measured column.** It is documented in
   METHODOLOGY §3.6. The remedy is the one the owner already ran once at S3 —
   `node scripts/generate-ring.mjs` (no `--force` involved; it is not that kind of writer) — and it
   must be the **last** model-touching act of the run, because anything stamped after it re-opens
   the same gap. S5 did not run it: the run's close-out list is S6's, the regeneration is ~21
   minutes of wall, and doing it before the boundary commit would have put an unverified artifact
   into the same commit as the documents.
2. **METHODOLOGY §10 never carried a "7-max and 9-max deferred" line.** §6 of the plan asks for that
   line to be rewritten; the sentence lives in **README backlog item 16**, which step 2 of this
   brief rewrites, and METHODOLOGY's §10 pointed at the README as "the one consolidated list"
   instead. The disposition is written into METHODOLOGY §10 anyway, as its own paragraph beside
   limitation 20, so the document states it rather than only referring to the README.
3. **`cfr.mjs`'s `CAPS.omitted` still says "six-max is deferred, see SIXMAX"** — a shipped string in
   four artifacts. Repairing it is a one-line edit plus a `generate-equilibrium.mjs` regeneration in
   the same step, or I35(e) goes red; lane K filed it deliberately (`cfr.mjs:338`) and it is not a
   documents-stage edit. §6's "table-size-neutral at all sites" is finished for the four METHODOLOGY
   sites and open for that one.
4. **`docs/spikes/V4-S6-verification.md` is stale.** It is an untracked read-only report of a tree
   state that no longer exists (it predates the four lane merges) and it reads as a RED verdict on
   work that has since landed. Left in place — it is not this stage's to delete — but it should not
   be read as a statement about this tree.
