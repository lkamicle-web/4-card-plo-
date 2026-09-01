*Phase 0 spike S-D · worktree branch `worktree-wf_5a8a2571-726-5` · verdict: PASS.*

# S-D — full/lite split cost

*Phase 0 feasibility spike, docs/V3-PLAN.md §1. Run 2026-08-31 on branch `worktree-wf_5a8a2571-726-5`, from `e6c6641`.*

**Question.** Is one source + feature flags viable?

**Verdict: YES — pass.** Both artifacts build, both are deterministic, both `--check` against their
own variant and go STALE against the other's, and `--variant=lite` over the *unmodified*
`src/shell.html` reproduces the pre-spike `index.html` **body byte for byte**. The failure branch
(§1: "full constrained to lite-plus-injected-blocks") is **not taken**. Markup divergence was not
invasive: the whole split, applied at six real seams in the 414 KB shell, costs **3,316 bytes of
source** and **zero bytes in the lite artifact**.

Every number below is produced by `node scripts/proto/s-d-measure.mjs`, which asserts 28 claims and
exits non-zero if any fails. It passes.

## What was built

| file | role |
|---|---|
| `scripts/lib/variant.mjs` | **new.** The variant table and the `@only:` stripper. Testable, so it is tested. |
| `scripts/build.mjs` | `--variant=lite\|full`, `--eq=`, per-variant regions/budgets/banner/`--check`. |
| `test/variant.test.mjs` | **new.** 22 tests. The first is inertness. |
| `scripts/proto/s-d-derive-shell.mjs` | **prototype.** Six anchored insertions producing a *marked copy* of the shell. |
| `scripts/proto/s-d-eq-payload.mjs` | **prototype.** A synthetic, deterministic stand-in for `data/equilibrium.json`. |
| `scripts/proto/s-d-measure.mjs` | **prototype.** The harness every number here comes from. |

`src/shell.html` was **not touched** — the brief forbids it, and the prototype honours that by
deriving a marked *copy* and building it through the `--source=` flag `build.mjs` already had. The
six insertions in `s-d-derive-shell.mjs` are the P1 diff, written as re-runnable code rather than
described in prose.

## The two seams

```
/* @inject:<region> */ … /* @end:<region> */     regions the build FILLS; `eq` is full-only
<!-- @only:full -->    … <!-- @end:only -->      markup a variant KEEPS; markers never ship
/* @only:lite */       … /* @end:only */         the same, in CSS and JavaScript
```

Ordering is load-bearing: **stripping runs before the `<script>` walk**, so a full-only script is
never minified, parse-gated or size-counted for a lite artifact it is not in.

## A. Inertness — the v3 identity constraint (§0.4a) applied to the build

| | bytes |
|---|---:|
| `index.html` at `e6c6641`, pre-spike | 492,221 |
| `--variant=lite` over the unmodified shell | 492,348 |
| **delta** | **+127 — all of it provenance banner** |
| page **body** (after the banner), both | 491,786 — sha256 `1b75e0ac4d3c…`, identical |

A source with no `@only:` marker compiles identically under every variant; the build says so on its
own report line (`no @only blocks (variant-inert source)`). The 127 bytes are the two banner lines
D11 *requires* — `VARIANT lite — …` and the `--variant=lite` in the rebuild hint.

**Landing cost, stated once: one `index.html` rebuild, +127 B, whole-file diff `2 insertions,
1 deletion`.** It was taken on this branch rather than deferred, because a build that changed and an
artifact that did not is precisely the half-split state the brief forbids leaving behind.

## B. The six seams exercised — chosen as the six hard cases

| # | seam | bytes | why it is the hard case |
|---|---|---:|---|
| 1 | CSS, full-only | 653 | block-comment syntax inside `<style>` |
| 2 | markup, full-only | — | a whole `<section>` pane |
| 3 | markup, lite-only | 1,468 (2+3) | the disabled-with-named-REASON replacement (§5.3) |
| 4 | honesty, per-variant | 361 | two siblings **disagreeing**, not one omitting — D11's case |
| 5 | `<script>`, full-only | 89 | markers wrap the `<script>` *tags*, so lite never sees `@inject:eq` at all |
| 6 | JavaScript, full-only | 745 | inside the 200 KB app script: what remains must still parse *and* minify |
| | **total** | **3,316 B** | 0.78 % of a 414 KB shell |

Seam 6 is the one that could have sunk this. It did not: the lite build strips the block, jsmin
re-lexes the remainder, the literal-list check passes, and the artifact parses.

## C. The byte table

| block (KB) | lite | full | delta |
|---|---:|---:|---:|
| data — shared `model.json` | 113.9 | 113.9 | 0.0 |
| model code — `policy` + `taxonomy`, stripped | 40.5 | 40.5 | 0.0 |
| equilibrium — full-only payload | 0 | 65.8 | +65.8 |
| app — markup + CSS + minified JS | 327.8 | 328.3 | +0.5 |
| *of which sim engine* | *18.4* | *18.4* | *0.0* |
| **TOTAL artifact** | **482.2** | **548.5** | **+66.3** |

Exact: lite 493,748 B, full 561,696 B, synthetic `equilibrium.json` 67,409 B.

Three readings matter.

1. **Lite pays 1.5 KB for existing at all** (482.2 vs the 480.8 KB inert build) — the lite-only
   disablement pane and its claim sentence. That is the price of §5.3's "disabled with a named
   REASON" over hiding the mode, and it is the right price.
2. **Full's app block is +0.5 KB over lite**, not +66. Almost the entire divergence is *payload*,
   which is what §5.2 predicted when it defined lite as "full minus the solver/equilibrium payload,
   the EV-estimator runtime, and anything requiring the opened toolchain".
3. **The equilibrium block is accounted separately from `app`.** Folding a dataset into a budget
   calibrated against markup+CSS+JS would blow it for the wrong reason. `app` therefore means the
   same quantity in both variants, and lite's three budgets still bind exactly what they were
   calibrated against.

**The synthetic payload is synthetic.** 7,626 pairs × 3 SPR planes (int16) + 1,476 strategy triples
(uint8), seeded LCG, no clock — the *shape and size* §5.3 implies, with pseudo-random numbers
inside. It carries `meta.synthetic: true`, and **gate D9 must refuse that flag**. 65.8 KB is a
planning figure, not a measurement of anything solved.

## D. Determinism, `--check`, and the negative manifest — all measured

* Each variant built twice from identical inputs is byte-identical (lite `d43d2729ce42d475…`, full `65a3d96a8ceb6734…`).
* `--check` reports *current* for each variant against its own artifact.
* `--check` reports **STALE** for each variant against the *other's* artifact, and names what it
  found: *"index.html is the full artifact, and this is a lite --check"*. A check that passed
  regardless of variant would read as coverage while providing none.
* Lite carries: no `@inject:eq`, no `EQUILIBRIUM`, no `evEstimate`, no `.solverpane` CSS — and
  **does** carry `model.order` (`packed`/`orderHash`), which §5.2 keeps unconditional.
* Neither artifact carries an `@only:` marker.
* Each artifact carries its own claim sentence and **not** the other's, on screen and in the banner.

Build-time refusals, all verified to fire:

| refusal | verified |
|---|---|
| `fetch(` in a **full-only** block, building **lite** | refused |
| `<script src=>` in a **full-only** block, building **lite** | refused |
| `@inject:eq` nobody wrapped in `@only:full`, building lite | refused, names the owner |
| `@only:fulll` (mistyped variant) | refused, with a line number |
| unclosed `@only`, stray `@end:only`, nested `@only` | each refused, with a line number |
| `// @only:full` (marker-shaped, does nothing) | refused — the silent-no-op case |
| `--variant=full` with no equilibrium payload | refused |
| `--variant=medium` | refused |

**The first two are a design change, not a detail.** §5.3 calls the `fetch(`/`<script src=>`
refusals "absolute for both shipped artifacts". Scanning only the built page cannot deliver that:
a violation inside an `@only:full` block would be invisible to every lite build, so coverage would
depend on which artifacts someone happened to build. **Both refusals therefore now run on the raw,
un-stripped source, before any variant stripping** — a lite-only build refuses a full-only
violation. The post-build page scan stays as well, because it also covers the generated blocks.

## E. Cost

| | ms |
|---|---:|
| lite build | 103 |
| full build (incl. 66 KB payload) | 105 |
| lite `--check` | 102 |
| full `--check` | 103 |
| **both variants + both checks** | **~415** |

The dual build is free. A per-variant `--check` loop adds ~100 ms to the GREEN definition.
Repo GREEN on this branch: `verify.mjs` **44/44, exit 0**; `node --test test/*.test.mjs` **246 pass**
(224 + 22 new); `build.mjs --check` **current**.

## F. The one gap, measured rather than assumed

**Lite-visible code that calls a full-only symbol builds clean and ships the dangling call.**
Stripping is textual and runs before parsing, so `simAvailable()` calling a stripped `evEstimate()`
parses, minifies, passes every build gate, and throws in the browser — in the artifact that must not
break. This is not a defect in the seam; it is the boundary of what a text seam can prove.

Two candidate fixes, neither free: the **per-variant smoke run** (the S-gates, §7.2) catches it at
the cost of needing S-E's Playwright; a **free-identifier lint per variant** catches it in the build
but needs a JS scope analysis jsmin does not currently do. **Recommendation: the per-variant smoke
run is non-optional, not a nicety** — it is the only thing standing between a stripped symbol and a
broken lite page. The harness asserts the gap still exists, so this paragraph cannot rot silently.

## G. The complete list of gates needing per-build scoping

Auditing all 44: **no gate in `verify.mjs` reads the built artifact** — every artifact-facing check
lives in `build.mjs`. That is why this list is short, and it is the best structural news in the
spike. The 37 `I*`/`V*` gates and `D1/D2/D4/D5` read `model.json` and the enumeration, both shared;
they need **no** scoping and **no** edit.

| gate | owner | disposition |
|---|---|---|
| **D6** block sub-budgets | `verify.mjs` | **Restate, don't rewrite.** Binds `model.json`, which is shared, so it is already correct; §5.3 re-reads it as *the lite contract*, lite being the constraining consumer. One real change: the ≤ 12 KB quantized baseline-tier block joins as a named sub-budget, total 120 → **132 KB**, stated and paid for at the gate. Generator work, not build work. |
| **D7** 220 KB payload ceiling | `verify.mjs` | **Restate only.** Same shared `model.json`; the comment gains "binding on the lite artifact". No code change. |
| **D8** shipped villain ordering | `verify.mjs` | **Explicitly unconditional (§5.2).** No scoping. Add the positive assertion that *both* artifacts carry `model.order` — verified here; needs an owner. |
| `TOTAL`/`APP`/`MODEL_CODE` budgets | `build.mjs` | **Now per-variant**, in `variant.mjs`. Lite's three carry METHODOLOGY §9.11's figures unchanged. **Full's are `null` — see the blocker below.** |
| `fetch(` refusal | `build.mjs` | **Absolute, and now enforced on the raw source** so a lite-only build refuses a full-only violation. Page scan retained. |
| `<script src=>` refusal | `shell-compile.mjs` + `build.mjs` | Same. The `shell-compile` check still runs post-strip; the new raw-source scan is what makes "absolute" true. |
| §9.11 honest-claim sentence | `docs/METHODOLOGY.md` | **Rewrite per variant + grep-gate (D11).** Prototyped on screen and in the banner; the *prose* is lane M / P5. The current sentence ("574 KB of self-contained offline page…") is also **stale on its own terms** — the shipped page is 480.8 KB after the sub-bucket cut. Both numbers need re-measuring when the sentence is split. |
| `--check` currency | house rules | **Per-variant loop.** Both artifacts, both variants. ~100 ms. |
| `smoke.mjs` | harness | **Per-variant run.** *No change to `smoke.mjs` needed* — it already takes a page path. Full needs extra assertions for the solver pane, and distinct `--shots=` dirs. |
| **D9** equilibrium payload size | new | Owns full's total. Must also **refuse `meta.synthetic`**. |
| **D10** lite negative manifest | new | Half of it exists as a build refusal already (`@inject:eq` unwrapped fails the lite build); the rest is the artifact grep set verified in §D above. |
| **D11** dual determinism + provenance + honesty | new | All three mechanisms prototyped and passing. |

## H. Blocker for P1 — one, named

**Full's size budgets are unanchored and are therefore not asserted.** Lite's three numbers come
from a measured page; there is no full artifact to measure, because the equilibrium payload it would
be sized around has not been solved. Inventing a ceiling would ship an unanchored constant wearing
the costume of a checked one, so the full build **prints its bytes, says `SIZE NOT GATED` on stderr,
and asserts nothing**. `VARIANTS.full.budgets === null` is pinned by a test, so the flip to a real
number has to be made deliberately.

**P1 lane I must not invent this number.** It is D9's, set from the first real `data/equilibrium.json`
at measured + 5 %, once P3 has run.

## I. Recommendation

**Take the pass branch of §1's decision rule.** One source + feature flags is viable; do not
constrain the full build to lite-plus-injected-blocks. Concretely, for P1 lane I (item 16):

1. Merge this branch's `variant.mjs`, `build.mjs` and `test/variant.test.mjs` **first**, per §12's
   "S-D's worktree merges first". They are inert on today's shell apart from the 127-byte banner.
2. Apply the six insertions in `s-d-derive-shell.mjs` to `src/shell.html` for real, and delete the
   derive script.
3. Add the per-variant `--check` loop and the per-variant smoke run to the GREEN definition.
4. Write D10 and D11 against the assertions in `s-d-measure.mjs` §D/§E — they are already phrased as
   gate claims.
5. Leave D9 and full's budgets to P3. Delete `s-d-eq-payload.mjs` the day a real payload exists.
6. Restate D6/D7 as the lite contract; add D6's ≤ 12 KB baseline-tier sub-budget (120 → 132 KB) when
   the generator emits the block.
