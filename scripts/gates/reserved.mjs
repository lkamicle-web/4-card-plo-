// The §7 gate catalog — RESERVED IDS, NOT THE ENFORCED SET.
//
// V3-PLAN §0.1's organizing principle is that the gate catalog is designed before the features:
// "a v3 feature without an invariant asserting its claim is not done". B0 step 4 therefore drafts
// the whole of §7 now, at Phase 0, with ids reserved — so that a lane arriving in P1..P5 finds its
// gate id already spoken for, with the claim already written, instead of inventing one to fit the
// code it just wrote. A gate id chosen after the feature is a gate written to pass.
//
// THIS FILE IS A MANIFEST, NOT A REGISTRY. Nothing here runs. Nothing here is stamped into
// `model.gates`. Nothing here appears in the 46-gate report, and `EXPECTED_IDS` in ./index.mjs
// stays the written-out literal it was — a reserved id is a promise about a future run, and
// letting promises leak into the enforced set is exactly how a suite starts reporting gates it
// never executed. ./index.mjs imports this file only to run the two disjointness guards described
// there; the guards print nothing, so the report's bytes are untouched.
//
// STATUS VALUES
//   'live'      enforced today; MUST appear in EXPECTED_IDS (guarded in ./index.mjs)
//   'reserved'  id claimed, claim written, not yet enforced; MUST NOT appear in EXPECTED_IDS
//   'parked'    reserved AND unpassable by construction — the bar is fixed and cannot be met
//               today, for written-down reasons. Parked is not lowered: the entry carries the
//               criteria that must hold and the named reason they cannot, so the day the reason
//               stops being true the gate comes alive unchanged.
//
// RUNNER VALUES
//   'verify'    runs inside scripts/verify.mjs's registry
//   'harness'   runs outside it — §7.2's S-gates row, §9's browser harness. `smoke.mjs` is
//               re-armed per variant alongside these two; §7.2 names ids only for SF and SS, so
//               only those two are reserved here. No id is invented for smoke itself.
//
// Promoting an entry is a three-line edit made deliberately: flip `status` to 'live', add the id
// to a family's `ids`, add it to EXPECTED_IDS. The guards fail loudly on any two of the three.

// ---------------------------------------------------------------------------
// I46's bar, fixed at Phase 0, before any EV number exists.
//
// Reproduced VERBATIM from S-C's memo (docs/spikes/S-C.md §6), which is the pre-registration
// record. test/gates-reserved.test.mjs asserts these two copies are byte-identical, so neither can
// be edited without the other — which is the whole point of pre-registration: V3-PLAN §5.4 says
// "no post-hoc bar-lowering", and a bar that lives in one place is a bar one commit can move.
//
// The criteria may be made STRICTER by a committed plan change, never looser, and never after an
// EV number is computed.
export const I46_CRITERIA = `
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
`.slice(1, -1); // the literal's own opening and closing newlines, and nothing else

// ---------------------------------------------------------------------------
/**
 * The §7 catalog. Order follows V3-PLAN §7.2's table.
 *
 * `claim` is the assertion, compressed from §7.2 — the plan is the source of truth and this is the
 * index into it. `fails` records the failure mode the gate exists to catch, because §7.2's column
 * header is "how it FAILS" and a gate whose failure mode nobody wrote down is a gate that will be
 * widened. `prediction` carries the plan's expected-falsified predictions forward verbatim in
 * substance: those are the gates that are supposed to fire.
 */
export const CATALOG = [
  {
    id: 'I32', status: 'live', runner: 'verify', phase: 'P0', plan: '§0.4, §5.1, §7.2',
    claim: 'v2 reproduction: the legacy lane, all new axes at legacy settings, bit-for-bit against '
      + 'data/tiers-v2.fixture.txt over the §0.4 sweep.',
    fails: 'any new axis leaking into the neutral path — most likely a memo key missing a new axis.',
    prediction: 'expected falsified at least once: I32 fires during I43\'s OFF-path refactor.',
  },
  {
    id: 'I33', status: 'live', runner: 'verify', phase: 'P0', plan: '§2, §7.2',
    claim: 'the payoff interface contract, clauses (a)-(f), plus the separate monotonicity clause.',
    fails: 'a consumer reading a payoff table directly, or an unflagged out-of-domain number.',
    prediction: 'monotonicity expected falsified at spr >= 4 — S-B measured it: 1.7% of pairs at '
      + 'spr 1, 20.5% OOP at spr 10.',
  },
  {
    id: 'I34', status: 'reserved', runner: 'verify', phase: 'P4', plan: '§5.4, §7.2',
    claim: 'EV quarantine: tier output bit-identical across view modes at every setting, verified '
      + 'in one process with modes toggled interleaved (the settings-hash-walk idiom), with an '
      + 'object-identity clause (assert.equal, not tolerance); badge text derives from source/se; '
      + 'the EV-primary path is unreachable without model.calibration.verdict === \'pass\'.',
    fails: 'memo aliasing, or a flag check below the cache key.',
  },
  {
    id: 'I35', status: 'reserved', runner: 'verify', phase: 'P3', plan: '§3.3, §6, §7.2',
    claim: 'solver quality: exploitability <= epsilon; strategies sum to 1; two independent seeds '
      + 'reach the same HU value within tolerance; 6-max scoped to fixed-point-only claims. Two '
      + 'disclosure clauses with teeth: the on-screen cap/sizing list must match the solver\'s '
      + 'actual tree, derived from shipped data; and whenever the equilibrium surface\'s payoff '
      + 'source is \'checkdown\', the "a game where postflop does not exist" label must render, '
      + 'derived from that shipped source datum, never prose.',
    fails: 'convergence that is abstraction-sensitive; a label keyed off prose or off `supported` '
      + 'rather than off `source` (the §2 phase-0 annotation names that trap).',
    note: 'S-B graded C, so the checkdown-label clause is load-bearing rather than defensive. '
      + 'S-A measured the anchors: epsilon = 5e-5 bb out-of-sample, two-seed spread gate at 0.15% '
      + 'of pot against 0.035% measured.',
  },
  {
    id: 'I36', status: 'reserved', runner: 'verify', phase: 'P3', plan: '§3.3, §7.2',
    claim: 'equilibrium anchors: AA_BIGPAIR x DS opens everywhere; TRASH x RB never opens UTG; '
      + 'emergent positional nesting UTG subset HJ subset CO subset BTN.',
    fails: 'nesting holding only because a post-pass imposed it — the comparand is raw model tiers.',
    prediction: 'expected falsified: nesting fails at some seat pair; the failure forces the '
      + 'raw-vs-post-passed vs-GTO display decision and ships as a finding.',
  },
  {
    id: 'I37', status: 'reserved', runner: 'verify', phase: 'P4', plan: '§6, §7.2',
    claim: 'divergence accounting: signed vs-GTO divergence combo-weighted ~ 0 at pool = baseline; '
      + 'per-cell convergence toward equilibrium as the skill dial rises; the interior blend '
      + 'interpolates monotonically between two anchored endpoints, each reproduced exactly.',
    fails: 'an interior blend that is not bounded by its endpoints — the unanchored constant\'s teeth.',
    prediction: 'expected falsified: the rank-overlap rows (BROADWAY_RUN, RUN0_HIGH) violate '
      + 'monotone convergence and move most as the pool tightens, not the junk rows.',
  },
  {
    id: 'I38', status: 'reserved', runner: 'verify', phase: 'P4', plan: '§6, §7.2',
    claim: 'skill axis: the lobby endpoint reproduces the current model exactly (object identity); '
      + 'combo-weighted width tightens with skill; per-cell exceptions enumerated, never tolerated '
      + 'away; the plays-better coefficient\'s reach bounded.',
    fails: 'an unanchored coefficient reaching further than its flag admits.',
  },
  {
    id: 'I39', status: 'reserved', runner: 'verify', phase: 'P4', plan: '§7.2',
    claim: 'EV arithmetic: EV(fold) = 0; sign agrees with breakeven at vs-3-bet within tolerance; '
      + 'rake enters exactly (the I31(c) extension); badges derive from data.',
    fails: 'rake re-modelled inside the payoff instead of entering through the exact machinery.',
    note: 'S-B: `ev` alone cannot do the bb conversion — E[F]/potSize ranged 1.603 to 11.865 and '
      + 'hero\'s share of E[F] 0.199 to 0.730 across the measured grid.',
  },
  {
    id: 'I40', status: 'reserved', runner: 'verify', phase: 'P4', plan: '§3.4, §7.2',
    claim: 'EV-cut behavior: in EV mode rake narrows width at percentile nodes (the deliberate '
      + 'anti-I31(a)) and depth moves width with §5.4\'s seat signs; bounds the EV MIX band width.',
    fails: 'the coupling inverting somewhere — in which case ship the finding.',
    prediction: 'offered for falsification: shallow+raked folds more than deep+raked at every seat.',
  },
  {
    id: 'I41', status: 'live', runner: 'verify', phase: 'P1', plan: '§7.2',
    claim: 'rake-depth: rakeFrac(100bb) = 5.00% identity, rakeFrac(250bb) = 2.00%, monotone in '
      + 'depth, exact arithmetic including the straddle-doubled cap unit; vs-3-bet price '
      + '30.53% -> 29.59% across the slider.',
    fails: 'the knee-at-100bb identity moving — which would break I22/I32 in the same run.',
  },
  {
    id: 'I42', status: 'live', runner: 'verify', phase: 'P1', plan: '§7.2',
    claim: 'depth-width exactness: width ratio = realization ratio exactly (the I26(f) idiom); '
      + 'seat signs per brief §5.4; compounding with M_deep bounded by a re-measured allowance.',
    fails: 'an authored allowance standing in for a re-measured one.',
  },
  {
    id: 'I43', status: 'live', runner: 'verify', phase: 'P1', plan: '§5.1, §7.2',
    claim: 'default-on: at load defaults (v = 55 is a lattice point, q = 0.85) every tier is cut '
      + 'from measured rows — zero interpolated cells at load; OFF is object identity '
      + '(assert.equal); I6/I7/I13/I19 sweeps re-run under ON.',
    fails: 'the OFF path silently rerouting when the default flips.',
    prediction: 'expected falsified: I8 (TRASH x RB never T1/T2) fails at tight-v profile-ON.',
  },
  {
    id: 'I44', status: 'live', runner: 'verify', phase: 'P1', plan: '§7.2',
    claim: 'sizing: pot-size = today bit-for-bit; the continue range narrows monotonically in sizing.',
    fails: 'the 7-pt premium\'s sizing-dependence being asserted rather than held constant + flagged.',
    prediction: 'expected falsified: I15\'s "RUN0_LOW x DS always continues" fails at large sizings '
      + 'and gets scoped to the default.',
  },
  {
    id: 'I45', status: 'reserved', runner: 'verify', phase: 'P5', plan: '§4 item 11, §7.2',
    conditional: 'only if item 11 (the squeeze stage) survives its §4 cut-line.',
    claim: 'squeeze stage: regeneration diff byte-identical outside new fields (the §9.12 diff '
      + 'idiom); frequency-banded MIX only; stream discipline asserted.',
    fails: 'a regeneration touching a byte outside the new stage.',
  },
  {
    id: 'I46', status: 'parked', runner: 'verify', phase: 'P5', plan: '§3.5, §5.4, §7.2',
    claim: 'calibration: harness reproducibility; fitted-vs-shipped disagreements ship as '
      + 'calibration.disputed, rendered in the Method view; the primacy verdict computed ONLY from '
      + 'the Phase-0 pre-registered criteria in I46_CRITERIA above.',
    fails: 'any route to model.calibration.verdict === \'pass\' that does not evaluate PC-0..PC-8; '
      + 'a criterion that cannot be evaluated counted as anything other than FAIL (PC-0).',
    prediction: 'expected falsified: fitted q != 0.85 — both shipped.',
    criteria: 'I46_CRITERIA',
    // ---- the parking notice -------------------------------------------------
    unpassable: true,
    blockedBy: ['PC-1', 'PC-2', 'PC-3'],
    blockedReason: 'S-C FAILED. No lawful, hero-visible, assigned 4-card PLO corpus exists at any '
      + 'volume, so PC-1 (admissible visibility), PC-2 (admissible provenance) and PC-3 '
      + '(assignment) are unsatisfiable today; PC-5 would need ~5M such hands. Under PC-0 a '
      + 'criterion that cannot be evaluated counts as FAIL, so the verdict is FAIL by '
      + 'construction. THE BAR IS NOT LOWERED, IT IS PARKED: I46 comes alive unchanged the day a '
      + 'conforming corpus exists. S-C\'s further finding is that no corpus size fixes PC-3 — you '
      + 'cannot read the EV of an action nobody took — so the successor experiment is a '
      + 'prospective randomised A/B test on the marginal cells, out of scope for v3 and named '
      + 'rather than left implicit.',
    consequence: 'score-primary is permanent for v3; EV ships as a switchable view mode under the '
      + 'I34 quarantine and never cuts tiers; "the decision layer remains unfalsified against '
      + 'money" ships as a standing METHODOLOGY §10 limitation rendered from shipped data.',
  },
  {
    id: 'I47', status: 'reserved', runner: 'verify', phase: 'P5', plan: '§4 item 10, §7.2',
    claim: 'per-hand top-N: every number labeled estimate; no per-hand claim ever enters the '
      + 'percentile sort (§2.4\'s autopsy as a standing gate).',
    fails: 'a per-hand number reaching the sort — the exact regression §2.4 recorded.',
  },
  {
    id: 'D9', status: 'reserved', runner: 'verify', phase: 'P3', plan: '§5.3, §7.2',
    claim: 'full-only data/equilibrium.json byte budget, measured+5%, retuned once per phase.',
    fails: 'a budget set before the first real payload exists.',
    note: 'S-D blocker: full\'s size budgets are unanchored today; VARIANTS.full.budgets === null '
      + 'is pinned by a test so the flip must be deliberate, and D9 must refuse a payload carrying '
      + 'meta.synthetic: true.',
  },
  {
    id: 'D10', status: 'live', runner: 'verify', phase: 'P1', plan: '§5.3, §7.2',
    claim: 'the lite negative manifest: no @inject:eq region, no solver payload, no estimator '
      + 'runtime; full-only modes render disabled-with-named-REASON in the SIM.available idiom; '
      + 'the baseline-tier block is explicitly lite-legal.',
    fails: 'a full-only payload reaching lite — or lite-visible code calling a full-only symbol, '
      + 'which S-D measured BUILDS CLEAN and ships the dangling call.',
    note: 'LIVE at P1 (scripts/gates/variants.mjs), split across three mechanisms: the artifact '
      + 'manifest is the gate itself; the dangling-call half is refused in build.mjs by '
      + 'danglingSymbols(), which closes S-D §F at the seam rather than leaving it to the browser; '
      + 'the per-variant smoke run backstops both. The baseline-tier row is a POSITIVE clause in '
      + 'the same list — absent from the model today, and armed to require it in lite the day P3 '
      + 'emits it.',
  },
  {
    id: 'D11', status: 'live', runner: 'verify', phase: 'P1', plan: '§5.3, §7.2',
    claim: 'dual determinism: both variants byte-compare under --check, the variant is named in the '
      + 'provenance banner, and the per-variant honesty sentence is grep-gated.',
    fails: 'one artifact carrying the other\'s claim sentence.',
    note: 'LIVE at P1 (scripts/gates/variants.mjs). The byte-comparison clause is carried by the '
      + 'per-variant `build.mjs --check` loop rather than by the gate, because verifyModel also '
      + 'runs inside generate-data.mjs where a rebuild would compare against the previous run\'s '
      + 'model.json; what the gate asserts instead is source-hash currency, which is the same '
      + 'statement given a deterministic build and is true in both processes.',
  },
  {
    id: 'SF', status: 'live', runner: 'harness', phase: 'P1', plan: '§7.2 S-gates, §9',
    claim: 'Firefox: METHODOLOGY §10.15\'s three named facts recorded as MEASURED VERDICTS — the '
      + 'gate asserts the on-screen disclosure matches the measurement, not that everything works.',
    fails: 'a disclosure that outlives the measurement contradicting it.',
    note: 'S-E measured F1 (Blob worker from file://) and F2 (localStorage write probe) green on '
      + 'Firefox 153, and found F3 (rAF suspends while hidden) UNMEASURABLE headless by any '
      + 'available mechanism — re-scope F3 to assert the consequence (stub rAF, assert the run '
      + 'pauses and the disclosure renders) and keep the raw fact as a standing limitation.',
    live: 'browsers.mjs (P1 lane I). Firefox 153.0: F1 Blob worker BOOTS on file:// (single-digit '
      + 'ms) and the page reports engine "worker", deciding within ~300 ms; F2 localStorage '
      + 'REACHABLE and the page caches to localStorage; F3 raw still unmeasurable (bringToFront '
      + 'leaves visibilityState "visible") and ASSERTED to be so, so the limitation cannot outlive '
      + 'its cause — with the consequence measured green: the fallback run pauses, freezes, does '
      + 'not finish hidden, resumes, clears the flag, and the page carries the sentence it renders '
      + 'from. Firefox is where the harness\'s own race showed first: the first-run tour auto-arms '
      + '400 ms after init and its per-step setProfile() CANCELLED the run being measured, so SF '
      + 'read a red row off a page that was behaving correctly. The tour is now suppressed through '
      + 'its own sessionStorage guard and the suppression is itself a gate row.',
  },
  {
    id: 'SS', status: 'live', runner: 'harness', phase: 'P1', plan: '§7.2 S-gates, §9',
    claim: 'Safari/WebKit: the same three facts as SF, recorded as measured verdicts, with the '
      + 'honest caveat that Playwright\'s WebKit build is not Safari.app.',
    fails: 'the same way SF does.',
    note: 'S-E: F2 FALSIFIES the expectation quoted in METHODOLOGY §9.12 — WebKit 26.5 does NOT '
      + 'throw SecurityError on the first file:// localStorage access. The write probe stays the '
      + 'right design; the sentence explaining why becomes a measured verdict.',
    live: 'browsers.mjs (P1 lane I). WebKit 26.5, all three facts on the same terms as SF: the '
      + 'worker boots (single-digit ms) and the page chooses it, localStorage is reachable — '
      + 'INDEPENDENTLY REPRODUCING S-E\'s falsification of §9.12\'s SecurityError expectation — and '
      + 'the F3 consequence is green. The harness prints the caveat on every run: Playwright\'s '
      + 'WebKit is not Safari.app.',
  },
];

/** ids reserved for future phases — never in EXPECTED_IDS, never stamped into model.gates */
export const RESERVED_IDS = CATALOG.filter((e) => e.status !== 'live').map((e) => e.id);

/** ids the catalog claims are enforced today — must all be in EXPECTED_IDS */
export const LIVE_IDS = CATALOG.filter((e) => e.status === 'live').map((e) => e.id);

/** entries whose bar is fixed but cannot be met — parked, not lowered */
export const PARKED = CATALOG.filter((e) => e.status === 'parked');

// Import-time self-consistency, so a hand-edit cannot leave the manifest incoherent.
{
  const seen = new Set();
  for (const e of CATALOG) {
    if (seen.has(e.id)) throw new Error(`gate catalog: duplicate reserved id ${e.id}`);
    seen.add(e.id);
    if (!['live', 'reserved', 'parked'].includes(e.status)) {
      throw new Error(`gate catalog: ${e.id} has unknown status ${JSON.stringify(e.status)}`);
    }
    if (!['verify', 'harness'].includes(e.runner)) {
      throw new Error(`gate catalog: ${e.id} has unknown runner ${JSON.stringify(e.runner)}`);
    }
    if (!e.claim || !e.fails) throw new Error(`gate catalog: ${e.id} is missing claim or fails`);
    if (e.status === 'parked' && !(e.unpassable && e.blockedReason && e.blockedBy?.length)) {
      throw new Error(`gate catalog: ${e.id} is parked but does not say why it cannot pass`);
    }
  }
}
