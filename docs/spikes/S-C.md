*Phase 0 spike S-C · worktree branch `worktree-wf_5a8a2571-726-4` · verdict: FAIL.*

# S-C — hand-history data. Numbers memo.

**Verdict: FAIL.** Phase 5 ships the calibration harness + self-play consistency only; EV stays
secondary permanently; I46 is unpassable by construction; METHODOLOGY §10 gains *"the decision layer
remains unfalsified against money"* as a standing limitation rendered in the Method view.

*Bar (plan §1, not moved here):* ≥ ~1M parsed hands with ≥ 100 showdowns in ≥ 80 cells. It fails on
three independent conjuncts. The middle one is the finding — the bar as written does not test it.

| # | Conjunct | Result |
|---|---|---|
| 1 | **Acquisition** — a lawful corpus exists | FAIL. No public 4-card PLO corpus at any scale. The commercial ones are datamined; datamining *and the use of datamined hands* is prohibited by every major operator. |
| 2 | **Estimand** — hole cards visible for a reason unrelated to the outcome | FAIL. Datamined hands have no hero *by definition*, so 100% of their hole cards come from showdown, which is outcome-selected three times over. |
| 3 | **Power** — enough hands to discriminate orderings | FAIL. 6.2M–77M hero hands for the paired ordering test; cell-level resolution is 2–3 orders of magnitude out of reach. |

## 1. Corpus inventory

| Source | Volume | 4-card PLO? | Hole cards | Usable |
|---|---|---|---|---|
| PHH (uoftcprg) — largest public poker corpus, MIT/CC-BY-4.0 | ~620M | **no** — hold'em + 1 Badugi hand | full / observed | no |
| HandHQ July-2009 dump (in PHH, Zenodo) | 21.6M | **no** — NLHE | observed | no |
| ACPC logs 2009–2017 (in PHH) | ~620M | **no** — FL/NL hold'em | full | no |
| IRC Poker DB (U. Alberta, 1995–2001) | >10M | `#omahahi`, `#omahapot` exist | *"hole cards of folded hands are not available"* | no — wrong era, free chips, showdown-only |
| HandHQ.com / HHDealer.com | 100k–7M/pack | yes | observed only, datamined | no |
| Pokerenergy (WPN, 888, Chico, PokerBros, PPPoker) | "hundreds of thousands to millions" | yes, incl. PLO4/5/6 | observed only, datamined | no |
| A player's own hand histories | ~1M/yr at very high volume | yes | **hero: every hand** | **the only admissible door** |

Two quotations carry the section. The IRC database's own docs: *"the hole cards of folded hands are
not available."* And the vendors' own definition of the product — hand history *"in which you did
not participate."* A corpus you did not participate in has no hero seat; no hero seat, no unbiased
hole cards. Volume and visibility are the same trade made in opposite directions, and no vendor
sells both. Licensing closes the door the estimand left open: operators prohibit "datamining hands
or private results", "the use of hands ... acquired through datamining", and "the mass sharing of
hands ... for the purpose of analysis of opponents". RUNDOWN is open source; a calibration fitted to
a corpus that cannot be named, redistributed, or reproduced is not one this project can ship,
independently of whether the statistics would have worked.

## 2. The visibility split — why the bar can be passed by unusable data

Hole cards arrive through two doors, and the parser makes the distinction a first-class field
(`knownVia`) rather than a footnote. **`hero`**: dealt to the account that wrote the file, visible on
*every* hand it is dealt in — folded, played, won, lost, mucked — so independent of the outcome; one
per hand, N hands give N rows. **`showdown`**: turned face up at the river, conditional on the hand
having been (a) played not folded, (b) survived, (c) not mucked — all three correlated with the hand
having worked out. Conditioning on them estimates `E[bb | reached showdown]`, not what any ordering
claim is about, biased upward by construction.

The plan's bar counts **showdowns**, and a 1M-hand corpus clears it: **118/123 cells** reach 100
showdowns at a 0.30 showdown rate (112/123 play-tilted). The criterion-as-written is *met* — by a
corpus whose every hole card comes through the biased door. Not redrawn here: reported met on its
own terms and overruled by conjuncts 1 and 3. Repair for future spikes: **count hero rows.**

## 3. Parser prototype — `scripts/prototypes/s-c/hh-parse.mjs`

PokerStars-format PLO cash parser: seats → positions relative to the button, per-player
invested/returned/collected → `netBB`, hole cards tagged `hero` or `showdown`, cells from the
**shipped** `cellKeyOf` (never a reimplementation, so a parsed cell means what a rendered cell
means). Refuses rather than guesses — non-Omaha, 5/6-card Omaha, hi/lo, and hands whose money does
not balance are rejected with a counted reason. On the hand-authored, clearly labelled fixture (**no
observed data**; it exercises format shapes and feeds no number in this memo):

```
blocks 12 · accepted 10 · rejected 2 (not-omaha-pl 1, omaha-not-4-card 1)
hero rows 10 · showdown rows 7 · 16 of 123 cells touched
11,230 bytes · 1.73 ms · 144 us/hand
```

The money-balance clause earned itself immediately: it rejected three fixture hands whose pot
arithmetic I had written wrong, before I noticed. ≈0.94 kB/hand here, ~1–2 kB for real hands, so a
34M-hand corpus is 35–70 GB uncompressed — worth stating because RUNDOWN ships as one
double-clickable file and no corpus this size can be a repo artifact.

## 4. Coverage — `scripts/prototypes/s-c/coverage-power.mjs`

Cell frequencies are **exact**: all C(52,4) = 270,725 hands enumerated through `cellKeyOf` (265 ms),
reproducing the shipped `combos` rather than reading them. 123 non-empty cells; min 18 combos
(`AA_BIGPAIR|DS`, 1 in 15,040), median 576, max 30,960 (`TRASH|SS`, 11.4%).

| Corpus (hero) | cells ≥ 100 | (cell,pos) ≥ 100 of 738 | rarest cell |
|---|---|---|---|
| 100k | 89/123 | 44/738 | 6.6 obs |
| **1M** | **121/123** | **97/738** | 66.5 obs |
| 10M | 123/123 | 123/738 | 665 obs |
| 100M | 123/123 | 123/738 | 6,649 obs |

Coverage is the easy half and not the binding constraint. Column 3 is the one to read: even at 100M
hands only 123 of 738 (cell, position) buckets clear 100 — position divides by six and the rare
cells never recover.

## 5. Power

Two-sided α = 0.05, power = 0.80. Per-hand σ **swept over 100 / 140 / 180 bb/100** — reported range
for 6-max PLO4 is 110–180, most regulars 130–160, so the sweep brackets it and includes an
optimistic end the conclusion must survive. Nothing below depends on picking one σ.

**Per-cell**, `n = 2σ²(z_{α/2}+z_β)²/δ²` per cell:

| δ | σ=100 | σ=140 | σ=180 | dealt hands for the *median* cell (σ=140) |
|---|---|---|---|---|
| 100 bb/100 | 1.6k | 3.1k | 5.1k | 1.4M |
| 20 bb/100 | 39.2k | 76.9k | 127k | 36.2M |
| 10 bb/100 | 157k | 308k | 509k | **145M** |
| 5 bb/100 | 628k | 1.2M | 2.0M | 578M |

Inverted at the plan's own 1M bar, minimum detectable effect (σ=140): **median cell 120 bb/100**
(n=2.1k) · **median (cell,pos) 295 bb/100** (n=355) · **whole JUNK band 10 bb/100** (n=316k). A
1M-hand corpus can only tell you a cell differs from its neighbour by more than a buy-in per 100
hands. The plan predicted "band-level, not cell-level, resolution": **confirmed with a number** —
bands 10, cells 120.

**Ordering — the estimand primacy turns on.** Not "what is cell X's EV" but "does the accept/reject
set an EV ordering induces beat the score ordering's, out of sample". Both run on the *same* stream
and on every hand they agree the difference is exactly zero, so the estimator is paired and its
variance comes only from the disagreement mass `m`: `SE = σ√(m/N)`, effect `= m·δ`, so
`N = (z_{α/2}+z_β)²σ²/(m·δ²)`. Pairing buys orders of magnitude then gives most back — the hands the
orderings disagree about are the marginal ones, whose true gap δ is small *by construction*. Hands
required, σ = 140:

| m \ δ | 10 bb/100 | 5 bb/100 | 3 bb/100 | 2 bb/100 |
|---|---|---|---|---|
| 15% mass | 1.0M | 4.1M | 11.4M | 25.6M |
| 10% mass | 1.5M | 6.2M | 17.1M | 38.5M |
| 5% mass | 3.1M | 12.3M | 34.2M | 76.9M |

The plausible cell — orderings agreeing on most of the range, differing by a few bb/100 at the
margin — is **6M to 77M hero hands**. At 80 hands/hour/table and four tables a very high-volume
grinder makes ~1M hands a year: **6 to 77 years of one player's full-time play**, at one stake, one
site, one population, playing their own strategy rather than either arm's.

**Resolution — what a calibration would fit.** Sorting the 123 cells by shipped HU checkdown equity
gives 122 adjacent pairs, median gap **0.20 equity points**, against the shipped
`meta.se.cell = 0.16`. **87 of 122 (71%) are separated by less than 2·se** — already inseparable by
the measurement RUNDOWN ships, before money and its ~100× larger noise enter. The direct answer:
**not the cell ordering.** At best a few band boundaries, coarsely.

## 6. PRE-REGISTERED PRIMACY CRITERIA

Written before any EV number exists; reproduced verbatim into gate **I46**. May be made *stricter* by
a committed plan change, never looser, and never after an EV number is computed.

```
PC-0  CONJUNCTIVE, FAILURE-CLOSED.  model.calibration.verdict may be stamped 'pass' only if PC-1..8
      all hold simultaneously on one corpus declared before any EV number is computed. A criterion
      that cannot be evaluated counts as FAIL. No 'not applicable', no partial credit.

PC-1  ADMISSIBLE VISIBILITY.  Only hands whose hero hole cards were visible for a reason independent
      of the hand's outcome (parser field knownVia='hero') enter the statistic. Showdown-revealed
      hole cards are inadmissible for primacy and may appear only in descriptive coverage reporting.
      A corpus wholly or partly showdown-derived fails PC-1 at any volume.

PC-2  ADMISSIBLE PROVENANCE.  The corpus must be lawfully held: the account holder's own play, or
      obtained with the operator's written permission. Datamined or observed third-party hands are
      inadmissible regardless of volume, as is any corpus that cannot be named in METHODOLOGY and
      re-obtained by a reader.

PC-3  ASSIGNMENT.  For every admissible hand the arm's prescribed action must be the action actually
      taken, and which arm's prescription was followed must be independent of the hand's cards given
      its cell -- i.e. randomised at cell level, or a behaviour policy that is known and used for
      importance weights with the effective sample size reported. Observational data under an
      unknown behaviour policy fails PC-3.

PC-4  THE STATISTIC.  D = mean over the corpus of (bb won under the EV ordering) minus (bb won under
      the score ordering), both cut at the same VPIP, evaluated hand-by-hand on the same stream so
      that hands where the orderings agree contribute exactly zero. D is reported in bb/100 with its
      standard error, paired, no bootstrap re-weighting.

PC-5  PRECISION.  SE(D) <= 0.20 bb/100. A precision floor, not a hand count: it tightens
      automatically as the disagreement mass shrinks and cannot be satisfied by declaring a smaller
      corpus adequate. (At sigma = 140 bb/100 and 10% disagreement mass: roughly 5M admissible
      hands.)

PC-6  SIGN AND SIGNIFICANCE.  The lower bound of the 95% confidence interval on D must be strictly
      greater than zero. A point estimate favouring EV without clearing zero is a FAIL, reported as
      such rather than described as encouraging.

PC-7  REPLICATION.  The corpus is split into two halves by time, the split declared before any EV
      number is computed. D must be positive with a 95% lower bound above zero in EACH half
      independently, and the two half-estimates must agree within 2 SE of their difference. A result
      appearing in one half only is a FAIL.

PC-8  SUBSTANCE (anchor, not threshold).  The re-ordering must exceed the model's own measurement
      noise: of the cell pairs the EV ordering transposes relative to the score ordering, more than
      half must have a shipped HU equity gap exceeding 2 * meta.se.cell. A re-ordering entirely
      inside the shipped measurement's error bars is a re-labelling, not a finding, and fails.

REPORTING DUTY.  Whatever the verdict, D, SE(D), both half-estimates, the disagreement mass, the
corpus size and its provenance ship in model.calibration and render in the Method view. A FAIL is
shipped as loudly as a pass would have been.
```

Today **PC-1, PC-2 and PC-3 are unsatisfiable** — no lawful, hero-visible, assigned 4-card PLO
corpus exists at any volume; PC-5 would need ~5M such hands. I46 is unpassable by construction,
exactly as plan §5.4 anticipates, for written-down reasons that would stop being true the day a real
corpus appeared. The bar is not lowered; it is parked.

## 7. Recommendation

Take the **S-C-fails branch of plan §3.6 verbatim**, no re-planning:

1. **P5 ships the calibration harness + self-play consistency only.** Still worth building — PC-4's
   paired statistic is the shape a self-play consistency check takes, so the code is not wasted,
   only its input is missing.
2. **`model.calibration.verdict` ships hard-failing**, with PC-0..PC-8 as shipped data rendered by
   the Method view, so the reason is on screen rather than in a doc.
3. **Score-primary is permanent for v3.** EV ships as a switchable view mode under the I34
   quarantine and never cuts tiers.
4. **METHODOLOGY §10 gains the standing limitation**, rendered from shipped data.
5. **One correction to carry forward:** the observational framing was the wrong question. No corpus
   size fixes PC-3 — you cannot read the EV of an action nobody took. The only design satisfying
   these criteria is a *prospective randomised A/B test on the marginal cells*, run by a player
   against their own play. Out of scope for v3; name it as the successor experiment.
6. **Repair the bar for future spikes:** count hero rows, not showdowns (§2).

## 8. What this spike did not do

No corpus was downloaded — acquisition needs the user's go-ahead, and every candidate was
disqualified on provenance or variant before volume mattered. The inventory rests on vendor and
operator documentation, treated as claims rather than verified holdings; the IRC database's Omaha
channels were disqualified on its own published description rather than by inspection. Coverage,
power and resolution numbers are exact arithmetic over the shipped taxonomy and shipped model, and
depend on no corpus at all — they would not move if one arrived.
