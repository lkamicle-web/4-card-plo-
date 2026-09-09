# V4 S1 — the ladder generalisation. The interface the four S2 lanes and S3 read.
Base `e801f07`. GREEN at return: verify **62/62**, tests **691/691**, `build --check` 2/2 current. Identity at six seats PROVEN: the three legacy fixtures `--check` reproduce with an empty diff and byte-identical sha256, no `--force` anywhere, `git status` carries no `data/tiers-*`.

## 1. Interface — `scripts/lib/policy.mjs`. All exported, every `seats` defaults to 6.
    LADDER9 = ['UTG','UTG1','UTG2','LJ','HJ','CO','BTN','SB','BB']    SEAT_DISPLAY = {UTG1:'UTG+1', UTG2:'UTG+2'}
    seatsFor(seats)                  POSITIONS (===, by reference) at 6 · LADDER9 at 9 · 7 reads as 6 ({6,9} is a SET)
    behindNonBlind(pos, seats)       non-blind seats behind; was N_NB.   at 9: 6,5,4,3,2,1,0,0,0
    blindBehind(pos, seats)          blind seats behind;     was N_BL.   at 9: 2,2,2,2,2,2,2,1,0
    isBlind(pos, seats)              ladder index >= len-2
    nestChain(node, seats)           was NEST_CHAIN.  9/rfi UTG..BTN (7) · 9/limps === 9/raise UTG1..BTN (6) · 3bet []
    positionDisabled(pos,node,seats) reasons BUILT FROM THE LADDER — byte-identical at 6, no seat literal
    nMax(seats)                      7 at 6 (FROZEN) · 9 at 9.  `nMax(6)+0.0001 === 7.0001` is asserted, not assumed
    ladderConstants(seats)           {baseRaise, baseR}; at 6 THE LEGACY OBJECTS BY REFERENCE, built once at init at 9
    eqAtSeats(cell, N, seats, ring, key)      rhoAtSeats(cell, N, seats, ring, key)
    CONSTANTS.ladder = {seats,ladder9,earlyStep:0.77,baseRaiseRule:'geometric',baseRRule:'flat',anchor,flag,derived}
    CONSTANTS.straddle.seatDerivedFrom = 'ladder.earlyStep'      (`seat` stays a plain number, for I26/seatWidthFactor)

`seats` is an ENV axis: `envOf` reads `s.seats`; `sealEnv` carries it NON-ENUMERABLY, so `JSON.stringify(env)` is byte-identical at 6 (`test/policy.test.mjs`'s v1 clause deep-equals it — that is why it is sealed, not plain); `envKey` appends `|${seats}` unconditionally; `OPERATING_POINT.seats = 6`; the `DEFAULT_ENV` fast path gains `seats === 6`. Threaded: `nEff`, `widthFor`, `width3For`, `depthWidthFactor`, `baseRealization(pos,d,seats)`, `realization(pos,N,nu,d,seats)` (TRAILING — old arity safe), `scoreCell(...,env,ring,key)`, `rankTable` (passes `opts.ring`, `it.key`), `solve` (BOTH the active and refSet cascades), `solve3bet`, `whyLines`. Read and confirmed seat-count-FREE: `derived()`, `postPasses`, `ribbon`, `entryVpip`, `verdictLine`, `tightenFor` (its `'CO'` default raiser is a pre-existing six-seat quirk that resolves at both sizes — recorded, not fixed; it does not change the legal-pair count).

Ring payload SHAPE lane R must produce (policy imports nothing; the page attaches it as `model.ring`):
    ring = { meta:{nMax:9,seeds,trials,se,generatorHash,contentHash}, cells:{ '<row>|<col>': { eq:[N8,N9], vDelta:{'<v>':[N8,N9]} } } }

`seats !== 9 || N <= 7` delegates to today's `eqAt`/`rhoAt` — same code path, so six seats is identical by construction, not by measurement. Above that it FAILS CLOSED: a missing payload throws a TypeError naming `data/ring.json`; a villain-profiled cell throws rather than mixing profiled 1..7 columns with unprofiled 8..9. `cells` is never read at N > 7. I52's tripwire goes against these accessors.

**policyDelta for lane R + S3** (policy.mjs is frozen after S1 — file it in `policyDeltas`): `vDeltaAtSeats(pts,vDelta,v,seats,ring,key)` plus threading `ring` through `villainEq`/`profiledModel`. S1 did NOT ship it because it forces `villainEq` to return 9-long `eq`, which is one decision with lane R's `SIM_NMAX`/`validEqArray` arity split (shell `:1181`, `:1318`, `:1407`), not two. Until it lands the profiled path above N=7 at nine seats throws — fail-closed, never silent.

`scripts/lib/skill.mjs` re-keyed: `legalPairs(seats=6)`, `widthTable(model,grid,seats=6)`, `widthProblems(model,grid,seats=6)`, `WIDTH_EXCEPTIONS = {6:{endpoint,interior}, 9:null}`, `widthExceptionsFor(seats)`. The two frozen arrays are BIT-FOR-BIT unchanged and keep their exported names. 9 is `null` = "unmeasured, lane K", never `[]`, and `widthProblems` refuses at 9 rather than passing vacuously. R5's 12 pairs are derived, not typed — `legalPairs(9) \ legalPairs(6)` — and it does contain `LJ|limps` and `LJ|raise`.

## 2. Six-seat identity — `test/ladder.test.mjs`, 12 tests, the witness. Keep it.
It carries the DELETED literals verbatim (`N_NB`, `N_BL`, `NEST_CHAIN`, both `positionDisabled` strings, the shell's three `legalPos` objects) and compares the functions against them. All reproduce exactly. `ladderConstants(6).baseRaise === CONSTANTS.baseRaise` by object identity, not by value.

## 3. §10 Q1 — legal pairs at nine seats: **33** (predicted 33; 21 at six).
`{rfi 8, limps 8, raise 8, 3bet 9}`. The three exclusions are the SAME three structural facts at both sizes; **no node carries a second structural exclusion** the six-seat table never exposed. The 12 new pairs: `UTG|{rfi,3bet}`, `UTG1|×4`, `UTG2|×4`, `LJ|{limps,raise}`.

## 4. R1 — `baseR` decided by measurement: I51(a)'s clauses run under BOTH candidate rules
    rule   baseR along UTG..BTN                       (a) monotone   (b) score   (b) width d40/d250
    flat   0.97 0.97 0.97 0.97 0.99 1.02 1.06              0             0              0
    step   0.91 0.93 0.95 0.97 0.99 1.02 1.06              0             0              0

Both pass -> **flat ships** (the plan's tie-break: fewer new numbers). `step` is the recorded rejected alternative and it is DERIVED too — `baseR(LJ) + (baseR(LJ)-baseR(HJ))·k`, the ladder's own first step continued — so neither rule types a seventh number. `baseRaise` is rule-independent: `0.16·0.77^k` gives UTG2 0.1232, UTG1 0.094864, UTG 0.07304528, strictly increasing along the ladder. Clause (c) (nesting at rfi, 12 lanes × 66 VPIP) is **0 violations of 4,752** — but it CANNOT discriminate between the rules, because the post-pass union makes nesting hold by construction. Both ship `kind:'estimate'` for S4.

## 5. R4 — the terms through which SEATS IN FRONT enter a node's width: exactly ONE
By reading the code: `widthFor` reads `baseRaise[pos]`, `seatWidthFactor` (straddle; `seatPinned` empty), `depthWidthFactor` (`baseR[pos]`) and `v` — all per-SEAT constants, none a count of seats in front. `width3For` reads `behindNonBlind` (seats BEHIND). `nEff` reads seats BEHIND. `scoreCell`, `realization`, `mNut`, `nuMin`, the nut gate and `tightenFor` are functions of `N`, `pos` and the raiser's seat. **The only seats-in-front term in the whole pipeline is the nesting post-pass's `nestChain(node, seats).indexOf(pos)`** (`policy.mjs` ~:2104–2110; the shell mirrors it at ~:3200). Exhaustive because it was then MEASURED rather than asserted: over **11,880** (shared pair × 12 lanes × 66 VPIP) comparisons the PRE-NESTING width, `N_eff` and aggressive set are **identical at 6 and 9 — 0 differences of any kind**. So I50's pre-nesting clause is EQUALITY, stronger than its monotone wording; if a later stage finds a difference, the list above is where the missing term must be.

## 6. Step 5b — the post-pass, on the v3-default surface (12 lanes, profile ON). Shared = the pair legal at BOTH sizes, compared by LADDER POSITION (9-max `i+3` vs 6-max `i`).
    node    comparisons  exact  STRICT superset  SUBSET VIOLATIONS  ring-needed   unioned cells per shared seat (total/worst)
    rfi        3960      3918         42                0               0         LJ 30/2 · HJ 10/1 · CO 4/1 · BTN 0 · SB 0
    limps      3600      3566         34                0             360         HJ 40/3 · CO 0 · BTN 0 · SB 0 · BB 0
    raise      3960      3136        824                0               0         HJ 322/3 · CO 320/3 · BTN 320/3 · SB 0 · BB 0
    3bet       4752      4752          0                0               0         chain empty — pre-registered exact, measured exact

**Containment holds everywhere: 0 subset violations.** I50 must be containment at rfi, limps AND raise, not rfi alone: `nestChain(limps|raise, 9)` is `UTG1..BTN`, so HJ/CO/BTN gain three unions at those nodes too. Two refinements of §5.2's prediction, recorded not patched: BTN at rfi gains its three unions but **zero cells** (its own set already contains the front seats'), and **`raise`, not `rfi`, is where nine-seat nesting bites hardest** (20.8% of shared settings). **Every excess cell is explained**: 1,046 of 1,046 (100%) are carried by a named front seat's own pre-union aggressive set — UTG+1 932, UTG+2 64, LJ 50 — because a front seat's larger `behindNonBlind` raises its `N_eff`, which moves `realization`, `nuMin(N)` and whether the `N >= nutGate[2]` demotion fires. **The nut-gate bypass is real in the code and NOT load-bearing here**: `solve` skips the demotion for cells already in `active`, and **0 of 1,046** excess cells are ones `pos`'s own gate would have demoted. METHODOLOGY limitation 10 should say exactly that. The 360 ring-needed settings are `limps` rows whose front seat (UTG+1/UTG+2) reads N > 7 at the default 2 limpers; they THREW rather than being proxied by a clamp, and are S3's once `ring.json` exists.

## 7. R3 — the `extrapolated` census. Method view's Table size section only; NO new rail chip.
    seats  domain           clamp  clamped       worst raw
    6      3,960 settings     7     47 = 1.19%   8.23 at limps / HJ / VPIP 90 / 4 limpers / straddled
    9      6,336 settings     9     19 = 0.30%   9.96 at limps / UTG+1 / VPIP 90 / 4 limpers / straddled

Domain re-derived for I48(c): nodes {rfi,limps,raise} (3bet excluded — N_eff does not tier it) × legal seats × limpers {1,2,3,4} at limps else {2} × straddle {off,on} × VPIP 25..90. The six-seat **integer** behind V3-BRIEF's recorded 1.19% is **47**, reproduced exactly. At nine the clamp MOVES rather than lifting and the clamped share FALLS: only `UTG1|limps` (14/528, 11 of 66 VPIP points, max 9.96) and `UTG2|limps` (5/528, 5 of 66, max 9.38) clamp at all. **No pair is clamped at more than half its 66 VPIP points**, so R3's escalation clause does not fire. The work-order's predicted nine-seat domain of 5,676 (43 rows) is wrong: limps and raise have **8** legal seats at nine, not 7, so it is 48 rows × 2 × 66 = **6,336**.

## 8. Offenders — both rewritten (offendersRewritten = 2); neither laundered, no literal kept
`width3For`'s limp branch `BTN||SB||BB` -> `L >= 2 && behindNonBlind(pos, seats) === 0`, ONE disjunct (`blindBehind < 2` is redundant: a blind's `behindNonBlind` is 0 at every table size). `solve3bet`'s `heroIP = CO||BTN` -> `behindNonBlind(pos,seats) <= 1 && !isBlind(pos,seats)` — the `!isBlind` half is NOT redundant, since SB and BB also have 0 non-blind seats behind. Both reproduce `{BTN,SB,BB}` / `{CO,BTN}` at six AND name the same two sets at nine.

## 9. Re-typed literal sites: five of six done; one deferred WITH its mechanism
Done: `gates/couplings.mjs`, `gates/env.mjs`, `gates/policy-sweep.mjs` -> `P.nestChain(node, 6)`; `gates/baseline.mjs:247,:353` -> the imported `POSITIONS`; `src/shell.html` below. **NOT done: `scripts/lib/equilibrium.mjs:710`.** Its source is hashed into `data/equilibrium.json`'s `meta.generatorHash` (`sourceHash()` = equilibrium.mjs + generator + cfr.mjs), so ANY byte change there fails `test/equilibrium.test.mjs` until the artifact is regenerated, which S1 is not authorised to do. Plan §7.2 already assigns this line to **lane K**, which also renames `SIXMAX` in `cfr.mjs` and hits the identical wall: make both edits together, regenerate `data/equilibrium.json` ONCE at S3, then `generate-equilibrium.mjs --check` reproduces. The brief's S1 list and §7.2 disagree here; §7.2 is right, and this is why.

Shell, S1's three ranges only: `POSITIONS` <- `window.POLICY.seatsFor(6)` with the six-seat literal kept as the marked legacy fallback (§10 Q3 — legacy-only, never nine); `NNB`/`NBL`/`legalPos` built structurally over `POSITIONS`; `posDisabledReason` passes `6`; `var N_EFF_MAX = 7` -> `nEffMax()` = `POLICY.nMax(S.seats || 6)` at all its use sites (`S.seats` is lane U's hook; absent today it reads 7); `aggNested`'s `['UTG','HJ','CO','BTN']` -> `POLICY.nestChain(node, 6)` with the literal-free fallback `POSITIONS.slice(0, NP-2)`. That fallback `evaluate` is dead once `POL` exists (reassigned ~:3498), so its limps/raise delta is unreachable — recorded.

## 10. I51(c) baseline for lane F — gate "no NEW literal", not "no literal"
Scanning `scripts/ src/ test/`: the three NEW keys `'UTG1' 'UTG2' 'LJ'` appear **0 times** outside `policy.mjs` (LADDER9/SEAT_DISPLAY) and `test/ladder.test.mjs`. The six legacy keys appear **331 times across 34 files** and always did — I51(c) as literally worded is already violated by them. Gate it as: the new keys confined to that allowlist, and the legacy count not rising.

## 11. Byte ceilings — TWO paid raises, both of them predictions of §2.7 that measurement falsified
    modelCode   54K -> 56K    measured 56,270 B = 55.0K (was 53,376 B). +1.9%; D6's bound is +8% (60K)
    model.json  meta 19->20K, total 145->146K, with a NEW reserved `ladder: 1K` sub-budget (measured 520 B)

§2.7 predicted shrink-first would pay for `modelCode`, and that `gates/data.mjs`'s `BUD` would need no edit. **Both falsified, measured.** modelCode: the deletions returned 470 B against 3,364 B added (+2,894 net) after 414 B of trimming; the byte-by-byte record is in `variant.mjs`'s `budgetSource` and `test/variant.test.mjs`'s pin. model.json: `constants.ladder` plus the straddle provenance string is 557 B against 315 B of `metaCore` headroom, and the block is still 287 B with BOTH prose fields emptied, so it cannot fit without deleting a §4-required constant. The D6 raise is the gate's own "reserved, not granted" idiom applied a sixth time: `core` still faces the original 120K and `metaCore` the original 13K, so **no pre-existing block gains one byte**. NOT raised: `appCore` (359.3 -> 359.5K lite with 544 B left, full 359.6K with 394 B), `app`, `total`, `blocks.*`, `core`, `cells`. **S3 owns `variant.mjs`/`data.mjs`: re-measure after the lane merges and the vDelta policyDelta, tighten if it fits, and S5 must re-pin D6's METHODOLOGY cites.** `variant.mjs` was edited WITHOUT changing its line count, so D6's `variant.mjs:104/119/136/140/159/224` cites still resolve — re-check that after any further edit there.

## 12. `data/model.json` — the one permitted change, proved key-by-key
`cells`, `order`, `baselineTiers`, `calibration` byte-identical. Exactly four diffs: `+constants.ladder`, `+constants.straddle.seatDerivedFrom`, `meta.hash` (provenance; the P4/P5 precedent), and `constants.evCut.derivedAt.state`, the recorded `envKey` string, which gained its `|6` seats field — a PROVENANCE string, not a value: `evCut.mixK` is unchanged. Also, so nobody infers S1 forgot them: `constants.ladder.flag` names I51 before I51 exists (harmless — `couplings`' `flagProblems` runs per NAMED block only), and the Method view's UNANCHORED / `estimate` badge for `ladder.derived` is lane U's to render.

---

## 13. Appended 2026-09-08 (stage S6, the fix round) — two of §12's four diffs were repaired, not kept

§12 above recorded **exactly four diffs** against `1d988f5` and S6's verification round re-read them
against §0.4's own words ("every byte of `data/model.json` outside the new `constants.ladder` block
is identical to `1d988f5`"). **Two of the four were outside that block and are now gone.** The
record above stands as measured at S1; this is what happened to it, not an edit of it.

    was (S1..S5)                                   now (S6)
    constants.straddle.seatDerivedFrom             constants.ladder.anchorSharedWith
      = 'ladder.earlyStep'                           = 'straddle.seat'
    constants.evCut.derivedAt.state ends '|1|6'     ...ends '|1'  (byte-identical to v3's string)

1. **The provenance sibling moved into the block.** `straddle.seat` is still a plain number for I26
   and `seatWidthFactor`; I51(a) keeps **both** clauses (the `Object.is` equality and the string
   asserted by value) and gained a fabricated-violator test for the string half, which it never had.
   The bytes crossed *out* of `metaCore` and *into* `ladder`, which `metaCore` subtracts, so the
   ladder block reads 668 B against its 1K cap and no D6 ceiling moved in either direction.
2. **`envKey` serialises the seat axis inertly instead of unconditionally.** The line in §1b's table
   above — "`envKey` appends `|${seats}` unconditionally" — is the sentence that put a `|6` into the
   shipped `constants.evCut.derivedAt.state`, because `evDefaultKey` embeds `envKey` and that block
   ships. The axis is **still in the key** (removing it would hand one table size the other's
   memoised answer, which is the trap `envKey`'s docstring exists for, and
   `test/ladder.test.mjs`'s `notEqual(envKey({seats:9}), envKey({seats:6}))` still holds); the seat
   segment is simply not serialised at 6. `envOf` normalises every other integer to 6 first, so no
   third serialisation exists.

**Residual, measured field-by-field after both repairs:** ten paths differ from `1d988f5` —
`meta.hash`, the seven §5.2 verdict stamps, `constants.limitations` (limitation 20) and
`constants.ladder` — with `cells`, `rows`, `order`, `baselineTiers`, `calibration`, `bands` and
`benchmarks` byte-identical as whole blocks. Recorded under V4-PLAN §0.4 as
`Measured (stage S6)`; readings in `docs/spikes/V4-S6-verification.md`.
