// policy.mjs — THE MODEL. N_eff, realization, score, percentile tiers, the exploit split,
// the nut gate, margins, the tier ribbon, and the vs-3-bet lab.
//
// This module is the single source of the model: the generator imports it, and the build inlines
// it verbatim into the page, so the browser and the data pipeline cannot disagree. It therefore
// uses NO Node APIs, no imports, and no syntax beyond plain ES2020.
//
// Everything here implements the documented formulas; nothing is fitted or hidden. The Monte Carlo
// layer (eq/rho/nu, produced by the generator) is objective. This layer is opinion, and every
// number it uses appears in CONSTANTS below and is rendered by the page's Method view.

export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const NODES = ['rfi', 'limps', 'raise', '3bet'];

/** tier ids, best action first */
export const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5'];
/** strength ordering used by the suit-monotonicity post-pass (higher = more aggressive) */
export const TIER_RANK = { T1: 4, T2: 3, T3: 2, T4: 1, T5: 0 };

export const TIER_LABELS = {
  rfi:   { T1: 'RAISE', T2: 'RAISE (exploit)', T3: '—', T4: 'MIX', T5: 'FOLD' },
  limps: { T1: 'ISO-RAISE', T2: 'ISO (exploit)', T3: 'OVER-LIMP', T4: 'MIX', T5: 'FOLD' },
  raise: { T1: '3-BET', T2: '3-BET (vs loose opener)', T3: 'CALL', T4: 'MIX', T5: 'FOLD' },
  // T2 leads with AMBUSH, not CALL: two adjacent legend chips both starting with CALL are
  // indistinguishable at a glance, and the ambush IS a flat call, never a re-raise.
  '3bet': { T1: '4-BET', T2: 'AMBUSH CALL', T3: 'CALL', T4: 'MIX', T5: 'FOLD' },
};

export const NODE_LABELS = { rfi: 'RFI', limps: 'vs Limps', raise: 'vs Raise', '3bet': 'vs 3-Bet' };

export const CONSTANTS = {
  c: '0.55*v^1.25',
  cBlind: 'min(0.95,1.5*c+0.10)',
  cLimper: 'min(0.90,0.45+0.50*v)',
  isoBehind: 1.20,
  vsRaiseBehind: 0.90,
  vsRaiseBlind: 0.80,
  baseR: { UTG: 0.97, HJ: 0.99, CO: 1.02, BTN: 1.06, SB: 0.90, BB: 0.93 },
  multiwayRealizationSlope: 0.10,
  kappa: [0.15, 0.13],
  nuBar: 0.42,
  nuNorm: [0.08, 0.27],
  // ---- the depth dial (V2-PLAN §3.1; full write-up and every measurement in METHODOLOGY §5.1) ---
  // The symmetry the plan asks to be visible in the CODE, not only in the docs (§1):
  //
  //     M_nut (h, N) = 1 + kappa(N) * (nu(h) - nuBar)                 <- field size
  //     M_deep(h, d) = 1 + lambda(d) * (nu(h) - nuBar)                <- cost when you are wrong
  //                      - mu(d)     * (cooler(h) - coolerBar)
  //
  // Two dials on one piece of machinery, entering the score the same way and written the same way.
  // mu(d) is the half with no kappa analogue, and it is why the depth axis needed a MEASUREMENT:
  // `cooler` (METHODOLOGY §3.2) is the measured chance a hand that got there still loses, and a
  // cooler only ever costs what is behind it. All-in equity itself does not move with depth, so
  // there is nothing here to simulate — only to re-score.
  //
  // The coordinate is LOGARITHMIC because the slider's domain is geometrically symmetric about its
  // reference (100/40 = 250/100 = 2.5): u(d) = log2(d/100)/log2(2.5), so u(40) = -1, u(100) = 0,
  // u(250) = +1 and every constant below IS its own endpoint value. §3.1's alternative — linear in
  // d — was rejected: it puts 40bb only 40% as far from the reference as 250bb, on a quantity whose
  // unit is the stack-to-pot ratio, and it would give the positional term a different notion of
  // "deep" from lambda and mu. u(100) = 0 exactly, so all of this is the identity at the v1
  // operating point (I22). All four curves are OPINION, pinned against the I23 anchor set.
  depth: {
    min: 40, ref: 100, max: 250, detents: [40, 100, 200],
    // ANCHORED TO KAPPA. kappa swings 0.520 across the field axis (0.15 heads-up to 0.67 six-way);
    // lambda swings 2*lambda across the depth axis, so 0.25 gives depth 96% of the authority field
    // size has over the same quantity. The quantitative form of "two dials on one machine", and the
    // only non-arbitrary anchor available for a curve nothing can measure.
    lambda: 0.25,
    // ANCHORED TO THE TWO MEASUREMENTS' OWN SPREADS: equal score weight per standard deviation.
    // Combo-weighted over the 123 live cells sd(nu) = 0.0831 and sd(cooler) = 0.0353, so
    // mu = lambda * 0.0831/0.0353 = 0.589, rounded. Per-sd and not per-range: cooler's range is set
    // by two tiny cells (TRIPS_SMALL x RB, 441 combos), and matching ranges would give 0.91 and let
    // those two drive the dial. The term earns its place because corr(nu, cooler) = -0.590 — the
    // cooler measurement brings two thirds of its own variance, and that residual is where the
    // depth axis says something the VPIP axis cannot (the low rundowns: nutty AND cooler-prone).
    mu: 0.60,
    // ANCHORED TO baseR'S OWN SEAT STEPS. The POWER form (not a lerp) amplifies the edge a seat has
    // and leaves a neutral seat alone: across the whole slider HJ (0.99) moves 0.0035 and CO (1.02)
    // 0.007, while SB (0.90) moves 0.033 and BTN (1.06) 0.022 — about one step of baseR itself
    // (SB->BB 0.03, CO->BTN 0.04). The deep end is worth roughly one seat of position.
    //   HARD CONSTRAINT, asserted by I23(f): |beta| < 1. The exponent 1 + beta*u is order-preserving
    // only while positive; at beta = 1.2 it reaches -0.2 at 40bb and the seat table INVERTS (the
    // small blind realizes better than the button). Nothing else notices — positional nesting is a
    // cascade, so it enforces whatever order it is handed — which is why the gate checks it.
    beta: 0.35,
    // The reference cooler M_deep is signed against. Authored, not measured, for the reason nuBar is
    // (§5, §7): an anchor that moved on every regeneration would shift the surface under you. Held
    // at the round number nearest the measured pool mean (constants.coolerBarMeasured = 0.3953), so
    // the slider RE-SORTS the grid instead of inflating or deflating it.
    coolerBar: 0.40,
    // ---- vs-3-bet. The 0.290 price does NOT move with depth (see `breakevenPrice`); the shape of
    // the continue range does.
    // nuFloor shifts nuCall and nuOOP together, and 0.015 is chosen on a fact about the FILE: `nu`
    // ships to two decimals, so a floor landing ON a hundredth is a coin flip for every cell sitting
    // exactly there. 0.015 puts all four endpoint floors (0.385/0.415 and 0.405/0.435) on
    // half-hundredths. 0.010 was measured and rejected for exactly this — it puts nuOOP(250) at
    // 0.42 + 0.01 = 0.4299999999999999933, landing under the I15 anchor cell's nu of 0.43 by the
    // direction of a rounding error. §7's "a floor set AT a measurement fails on noise", applied to
    // the float grid. Consequence, owned: RUN0_LOW x DS stops defending out of position above about
    // 184bb — the highest-cooler cell in the rundown band, so that is the measurement talking.
    nuFloor: 0.015,
    // fourBet is the most conservative of the five because the measurement says the lever is half
    // dead: all 21 AA-row cells that can 4-bet measure 54.3-65.1% eqMix against the default mix, a
    // 4.3-point GAP above the 50% bar, so a falling bar has nothing to add and §3.1's "shallower
    // favours 4-bet" is not expressible here. Anything under 0.043 is provably inert both ways.
    // 0.06 is the round number just past the gap; deep it takes the bar to 0.56 and moves the three
    // weakest AA cells into the call lane, which is the half of the claim that survives.
    fourBet: 0.06,
    // ---- the depth->WIDTH factor (V3-PLAN item 6, brief §5.4; gate I42) -------------------------
    // ZERO NEW OPINION, and that is the whole reason it is here rather than in a fitted table.
    // brief §5.4: `baseRealization` ALREADY moves with depth, through `beta`, which is already in
    // the model and already gated (I23(f)). The ratio of a seat's realization at d to its
    // realization at the reference depth is therefore a free, signed, seat-dependent factor:
    //
    //     widthRatio(pos, d) = baseRealization(pos, d) / baseRealization(pos, 100)
    //
    // Measured on the shipped constants at 250bb: SB 0.9638  BB 0.9749  UTG 0.9894  HJ 0.9965
    // CO 1.0070  BTN 1.0206 — the blinds and the early seats TIGHTEN deep and CO/BTN LOOSEN,
    // because position compounds when there is more money behind. Exactly 1 at 100bb, because
    // u(100) = 0 and the exponent is 1 there.
    //
    // It is written as the RATIO and not as `baseR^(beta*u)` even though those are the same
    // quantity in real arithmetic: measured, the two forms differ by 1 ulp at HJ and BB, and I42
    // asserts the identity `width ratio === realization ratio` with `===` rather than a tolerance.
    // A form that is algebraically equal and numerically one ulp off would turn that gate into a
    // tolerance argument, which is how exactness claims rot.
    // A formula string, rendered by the Method view, carrying no number of its own — and bounded
    // like the other two: I42(f) asserts it character-for-character against a spelling composed from
    // `depth.ref`. The P1 red team replaced it with 'sqrt(beta)*log(d) -- NONSENSE' and with the
    // ratio inverted and squared, and every gate stayed green while the page published a formula the
    // code does not run.
    widthRatio: 'baseRealization(pos,d)/baseRealization(pos,100)',
    // No new constant: `beta` above is the only opinion involved and it is unchanged. What the
    // factor DOES force is a re-measured allowance where it compounds with M_deep — I23(d)'s
    // painted-width drift cap — and that allowance is measured under the axis ON inside I42, never
    // authored. Off by default (env.depthWidth); the default flip is a fixture ceremony (§0.4(c)).
  },
  // ---- the 3-bet SIZING axis (V3-PLAN item 9, METHODOLOGY §10.8; gate I44) ----------------------
  // Every threshold at the vs-3-bet node assumed a pot-sized 3-bet. `s` is the 3-bet's size as a
  // fraction of the pot-size raise, and the price it implies is EXACT ARITHMETIC on the game tree,
  // not an opinion:
  //
  //   hero opens to `o` into blinds `b`; villain raises to  o + s*(b + 2o)
  //   hero's call    c(s) = s*(b + 2o)
  //   final pot      P(s) = (b + 2o) * (1 + 2s)
  //   raw price      e(s) = c/P = s / (1 + 2s)          <- b and o CANCEL: the price is pure geometry
  //
  // so the price scales by e(s)/e(1) = 3s/(1+2s) and `vs3bet.breakeven` is left exactly where it
  // is. At s = 1 the factor is 3/3 = 1 and the shipped 0.290 is returned by reference, bit for bit
  // — which is I44's first clause and what keeps `sizing` a legal §0.4(a) axis.
  sizing: {
    // THE DOMAIN IS THE GAME'S, NOT AN AUTHORED WINDOW, and the top end is the interesting half:
    // **the pot-limit maximum IS s = 1**. There is no such thing as a 1.2x-pot 3-bet in PLO, so
    // the reference is the CEILING of this axis rather than a point in the middle of it, and
    // `sizing` can only ever make a 3-bet smaller. That is an arithmetic identity of the game (the
    // same identity V3-PLAN §6's phase-0 annotation records for the solver's 3/9/27/81 ladder), so
    // the domain introduces no constant at the top.
    //   The bottom, 0.25, is a judgement and is the only authored number here: below a quarter pot
    // a "3-bet" is a min-click, and the face-up value range this node models (60/25/10/5 AA/KK/QQ)
    // is not the range anybody min-3-bets.
    //   CORRECTED BY THE P1 RED TEAM (docs/refutations/P1.md), because the earlier sentence here was
    // false: this was described as "a display clamp, not a threshold — no decision reads it", and
    // `envOf` clamps `sizing` into [min, max] before anything downstream sees it. So it is a
    // BEHAVIOURAL FLOOR — the value at which the model stops answering the question it was asked and
    // starts answering a neighbouring one — with no consumer that can see it move. Two refuters
    // moved it to 0.001 with all 52 gates and the whole suite green, which is exactly right: nothing
    // in this repository measures where a raise stops being a 3-bet. It is therefore UNANCHORABLE,
    // it ships in `flag` below, and I44(e) PINS it — the I41(b) idiom, a literal that records the
    // reviewed value so it cannot drift silently, never a justification of it.
    min: 0.25, ref: 1, max: 1,
    // FORWARD-DECLARED UI DATA, and said that way rather than as a shipped UI fact: there is no
    // 3-bet-sizing control on the page yet, so nothing reads these. They are bounded, not anchored —
    // I44(e) asserts they lie on the ladder they claim to be on ([min, max], strictly increasing,
    // last one the pot-limit maximum), which is what stops the first slider that lands snapping to
    // an illegal super-pot 3-bet.
    detents: [0.5, 0.75, 1],
    // The formula this block's arithmetic actually runs, rendered by the Method view. NOT free
    // prose: I44(f) asserts it character-for-character against the spelling clause (b) recomputes,
    // so the page cannot publish one formula while the code runs another.
    priceAt: 'breakeven*3s/(1+2s)',
    // FLAGGED, AND IT CANNOT BE ANCHORED — said out loud rather than quietly held.
    // `vs3bet.call` sits 7 points above the price "because a 3-bet pot is played out of position
    // over three streets". That premium is a postflop claim, and a bigger 3-bet means a lower SPR,
    // which means LESS postflop to be wrong about — so the premium should shrink as s rises. By
    // how much is not measurable here: nothing in this repository measures postflop play, which is
    // the same hole limitation 16 names. So the premium is HELD CONSTANT at its pot-sized
    // calibration, the flag ships, and I44 measures the CONSEQUENCE (how the continue range moves
    // when only the price moves) instead of inventing a coefficient to hide it.
    // Written as a literal 1 and ASSERTED === sizing.ref by I44(e): a record that names a
    // calibration point has to name the point the gate probes, or it is decoration.
    premiumCalibratedAt: 1,
    // THE FLAG, in the shipped data so the Method view renders it rather than transcribing it — and
    // its own presence is now gated (I44(f)), because the P1 red team deleted it outright and the
    // whole tree stayed green: an admission nothing checks is a convention, not a claim.
    flag: 'THREE records in this block are opinion no measurement in this repository can settle, so they ship BOUNDED rather than justified — gate I44(e) pins each one and none of them is anchored by it. '
      + '`min` = 0.25 is an authored behavioural floor: nothing here measures where a raise stops being a 3-bet. '
      + '`premiumCalibratedAt` records that the 7-pt call premium is calibrated at pot-size and HELD CONSTANT across the axis — a bigger 3-bet is a lower SPR and the premium ought to shrink, and limitation 16 is why nothing here can say by how much, so I44(b) measures that consequence instead of inventing a coefficient. '
      + '`detents` are forward-declared UI stops with no consumer on the page today.',
  },
  // ---- the rake dial (V2-PLAN §3.2; every measurement in METHODOLOGY §5.2) ---------------------
  // CRUDE, and the plan says so. One fraction, applied two ways:
  //
  //     rakeFrac = min(rakePct/100, rakeCapBB / (potBB * unitBB))    <- §3.2's rakePct*capFactor
  //     rho_eff  = rho * (1 - rakeFrac)                              <- the flat haircut
  //     price    = breakeven / (1 - rakeFrac)                        <- EXACT arithmetic
  //
  // The min() is the cap: 5% of a 60bb pot capped at 3bb is 5%; of a 120bb pot, 2.5%.
  //
  // MEASURED AND OWNED, so nobody "fixes" it: the flat multiplier is TIER-INERT at the three
  // percentile nodes and that is what the plan's model SAYS. Score is 100*rho*M_nut*M_play*R*M_deep,
  // so a factor common to every cell scales every score, cut and margin alike and re-orders nothing.
  // Rake bites where a threshold is ABSOLUTE — the vs-3-bet node; see `callFloorAt`. Gate I31 pins
  // both halves.
  rake: {
    // `preset` is the UI's default (§3.2: "5% — the lobby this tool is for"). The FUNCTION default
    // is 0: gate I22 is the claim that v2 reproduces v1 at v1's operating point, which has no rake.
    min: 0, max: 6, preset: 5, capBB: 3,
    // The reference raked pot, in preflop units. AUTHORED like nuBar and coolerBar, and for the
    // same reason — it is what makes `rakeCapBB` mean anything, so it must not move under a
    // regeneration. 60 puts the default preset exactly on the cap's KNEE (3/60 = 5%), which is
    // where real 5%/3bb lobbies sit: they reach the cap in pots of 60bb and up.
    potBB: 60,
    // ---- the rake-DEPTH coupling (V3-PLAN item 6, brief §5.3; gate I41) ------------------------
    // THE DEFECT THIS FIXES, stated first: `potBB` above is a constant, so the model rakes a 250bb
    // game at the same 5% it rakes a 40bb game. Preflop pot sizes really do not scale with depth —
    // but the cap is measured against the FINAL pot, and the final pot does. `rakePotBB(env)`
    // therefore scales the reference pot with the stack:
    //
    //     potBB(d) = potBB * (d / depth.ref) ^ potScale
    //
    // THE ANCHOR IS THE KNEE, and it is an identity rather than a fit: `potScale` multiplies a
    // ratio that is 1 at d = 100, so potBB(100) = 60 = 3/0.05 EXACTLY — the existing constant
    // re-described, not replaced, and the 5% preset still lands exactly on the cap's knee at the v1
    // operating depth. Both straddle states are the identity there too (see `sealEnv`), which is
    // what keeps I22 and the 100bb lanes of I32 untouched.
    //
    // `potScale` IS THE ONE NEW OPINION IN ITEM 6 AND IT SHIPS FLAGGED. 1 is linear: "the final pot
    // scales with the effective stack", which is true when the stacks go in and progressively less
    // true when they do not — i.e. it is a MODELING CHOICE about how often a deep pot plays for
    // stacks, not a measurement, and nothing in this repository measures that. It is bounded by
    // gate I41 rather than justified: the gate pins the knee identity, the 250bb reading
    // (5.00% -> 2.00%, price 30.53% -> 29.59%), monotonicity in depth, and the exact arithmetic
    // including the straddle-doubled cap unit. See `rake.flag` below and METHODOLOGY §5.2.
    potScale: 1,
    // The formula the coupling actually runs, rendered by the Method view. NOT free prose: I41(f)
    // asserts it character-for-character against a spelling composed from `depth.ref`, which closes
    // the drift the P1 red team found twice over — a false formula published beside a true constant,
    // and a hard-coded 100 that would silently become a lie the day the reference depth moved.
    potBBAt: 'potBB*(d/100)^potScale',
    // The flag, in the shipped data so the Method view renders it rather than transcribing it — and
    // its presence, and the two names in it, are now gated by I41(f). Three refuters deleted this
    // string and watched 52 gates, 436 tests and a clean rebuild go green while the exponent shipped
    // with no admission attached (docs/refutations/P1.md).
    flag: 'potScale is unanchored opinion (linear) — bounded by gate I41, off by default (env.rakeDepth)',
  },
  // ---- the straddle (V2-PLAN §3.3; full write-up in METHODOLOGY §5.3) --------------------------
  // A UTG straddle is ONE fact — the preflop betting unit doubles — with three consequences this
  // model already has machinery for, which is why §3.3 is a transform and not a measurement:
  //   unit   stacks are d/2 units deep (the §3.1 dial), and the rake cap — the one quantity in the
  //          price layer that is NOT scale-free — is measured against twice as many big blinds.
  //   field  one extra blind-like defender behind every seat, joining N_eff at cBlind(v).
  //   seats  one more player behind you, so the opening bases shift one seat tighter.
  straddle: {
    unit: 2,
    // ONE SEAT OF THE MODEL'S OWN OPENING LADDER, geometric because widthFor is multiplicative:
    // baseRaise steps UTG->HJ 1.250x and HJ->CO 1.350x, so a seat is sqrt(1.250*1.350) = 1.2990
    // and one seat tighter is 1/1.2990 = 0.770. The CO->BTN step (1.667x) is excluded on purpose:
    // it is the step §7.2 wanted pinned.
    seat: 0.77,
    // Seats keeping their unstraddled base. EMPTY, and that is V2-PLAN §7.2's "BTN keeps its 0.45"
    // FALSIFIED: pinned, the button's PAINTED range gets wider under a straddle at 7 of its 30
    // settings and its mean nu falls at 8. A straddle puts one more player behind the button; it
    // cannot widen his open. A constant rather than a hard-coded seat name, so gate I26 can perturb
    // it — which is how the falsification was found.
    seatPinned: [],
  },
  mplay: {
    dangler: 0.94, trips: 0.85, quads: 0.70, aBlocked: 0.78,
    noCardAbove9: 0.93, monotone: 0.95, threeFlush: 0.97, nutSuited: 1.03,
  },
  baseRaise: { UTG: 0.16, HJ: 0.20, CO: 0.27, BTN: 0.45, SB: 0.33, BB: 0.33 },
  widthSlope: 0.35,
  isoValueFactor: 0.60,
  nutGate: [0.20, 0.10, 3.0],
  // Cap on the nut floor the gate demands. Uncapped, nuMin(N) reaches 0.40 at N_eff 5 and demotes
  // cells out of the aggressive range faster than widthFor adds them, so the PAINTED iso range fell
  // by up to half across the slider (BTN over 2 limpers: 45.7% at VPIP 55 down to 23.8% at 90) while
  // the tool's whole thesis is that a looser table earns a WIDER, nuttier range. Capped at 0.30 the
  // gate still bites hard at 3+ opponents without eating the widening it is meant to shape. Gate I21
  // holds the painted width to that claim.
  nutGateCap: 0.30,
  limpWidth: 0.5,
  limpNuMin: 0.45,
  w3bet: [0.06, 0.10],
  wCall: [0.10, 0.30],
  tighten: 0.12,
  // Re-anchored constants (documented in docs/METHODOLOGY.md). The model brief pinned these two
  // nut floors against HAND-level nu anchors (JT98ds 0.59, KQJTds 0.70). This grid scores CELLS,
  // whose nu is a combo-weighted mean: only 1.0% of all hands sit in a cell with nu >= 0.55, which
  // capped the vs-Raise 3-bet range at 2.8% of hands — below the model's own 6% minimum target
  // width, and completely static in VPIP. Both are re-anchored to nut floors the model already
  // uses elsewhere.
  nu3betMin: 0.40,          // brief value 0.55
  nu3betMinSpec: 0.55,
  raiseCallNuMin: 0.40,
  vs3bet: {
    mix: [0.60, 0.25, 0.10, 0.05], breakeven: 0.29, fourBet: 0.50,
    call: 0.36, ambushEq1: 0.45, domGate: 2,
    // The domination gate can now only ever CONFIRM a fold the equity test already made: 0.34 sits
    // below the 0.36 call floor, so no cell that clears the price is folded for domination alone.
    // eqVs3bet is measured against the actual AA/KK/QQ/BWR ranges (mc.mjs runVs samples the villain
    // from the component range with hero's cards removed), so shared ranks are already priced into
    // the equity twice over — blockers and equity both. At the old 0.44 escape the gate charged for
    // them a third time and folded BROADWAY_RUN x DS (eqMix 40.3%, nu 0.70, getting 2.45:1) while
    // calling RUN0_LOW x SS at 39.5%, which is backwards. The escape was also dead code: of the 19
    // non-AA cells with dom >= 2, none ever cleared 44%.
    domGateEqEscape: 0.34,
    // nuOOP is the nut floor for continuing out of position. Held just under the measured nu of the
    // I15 anchor cell RUN0_LOW x DS, so "RUN0_LOW x DS always continues" is true at all six seats
    // rather than at the two in-position ones. (Re-measure that cell after any regeneration: it is
    // the constant's only anchor. The floor is deliberately set below it, not at it.)
    nuCall: 0.40, nuOOP: 0.42, nuOOPSpec: 0.55,
  },
  // The declared-uncertainty band, in CUMULATIVE COMBO FREQUENCY — the same unit at all four nodes.
  // A cell is MIX when its combo-frequency midpoint sits within this band of a live decision
  // boundary. It was previously read in equity points at the vs-3-bet node, which is a unit error
  // and not a small one: hero equities against the face-up mix pile up on the 34-36% mode (42.2% of
  // all combos sit in that two-point bin), so an absolute +/-1.5 equity-point window there swept
  // 38.9% of the grid into MIX — about 9x the blend's own measurement SE of 0.165 pt.
  t4Band: 0.015,
  closeMargin: 2.0,
  adj: [2, -3, 4],
  // ---- the §10 limitations register (V3-PLAN §10, P1 lane M's doc slot) ------------------------
  // A REGISTER, NOT A SCORING CONSTANT, and the comment says so because the block it sits in
  // opens with "everything the model knows" and this is not that. Nothing below reads it; change
  // it and no tier moves.
  //
  // WHY IT IS HERE ANYWAY. METHODOLOGY §10's limitations are the honest half of this project and
  // the Method view renders `model.constants` and nothing else from shipped data — the page's
  // "Known weaknesses" list is hand-authored prose in the shell, which is exactly the transcription
  // this repository's own rule forbids ("the Method view renders shipped data, never transcribed
  // prose"). Carrying the two limitations v3 adds as DATA is the smallest honest fix available to
  // a lane that does not own the shell: they reach the page through the machinery that already
  // works, and the page's list can be re-pointed at this array later without a second source.
  //
  // THE TEETH. Each `note` must appear VERBATIM in docs/METHODOLOGY.md under the numbered entry it
  // names — the grep-gate idiom, asserted by I41 (16) and I42 (17), which are the gates whose own
  // flags cite these limitations as the reason a constant cannot be anchored. So a limitation
  // edited on the page but not in the document, or vice versa, fails the build rather than shipping
  // two versions of the same admission.
  limitations: [
    {
      n: 16,
      of: 'rho relevance decays with depth',
      note: 'The measurement layer is all-in equity at showdown, so it describes a 40bb game well '
        + 'and a 250bb game poorly: the deep end of the dial is exactly where the measurement stops '
        + 'applying, and M_deep is a scoring-layer patch over a measurement-layer relevance problem '
        + 'that no constant can fix.',
      fix: 'the postflop/SPR model — no constant fixes this',
      flagsItExplains: ['rake.potScale', 'sizing.premiumCalibratedAt'],
    },
    {
      n: 17,
      of: 'a percentile cut cannot change how many hands you play',
      note: 'A percentile cut can change which hands you play but never how many, so every dial '
        + 'that scales or shifts every cell moves the ordering and not the count; the absolute-EV '
        + 'cut is the designated structural fix, and its gate is written to prove the fix bites.',
      fix: 'the absolute-EV cut',
    },
  ],
};

// seats still to act, 6-max
const N_NB = { UTG: 3, HJ: 2, CO: 1, BTN: 0, SB: 0, BB: 0 };
const N_BL = { UTG: 2, HJ: 2, CO: 2, BTN: 2, SB: 1, BB: 0 };
/** the nesting chain the positional-containment post-pass walks, per node */
const NEST_CHAIN = { rfi: ['UTG', 'HJ', 'CO', 'BTN'], limps: ['HJ', 'CO', 'BTN'], raise: ['HJ', 'CO', 'BTN'], '3bet': [] };

/** structurally unavailable (position, node) pairs */
export function positionDisabled(pos, node) {
  if (node === 'rfi' && pos === 'BB') return 'BB closes the unopened pot by checking';
  if ((node === 'limps' || node === 'raise') && pos === 'UTG') return 'no one acts before UTG';
  return null;
}

// ---------------------------------------------------------------------------
// 0. the table environment — depth, rake, straddle
// ---------------------------------------------------------------------------
/**
 * The v1 operating point, and the default of every function below. Gate I22 asserts that the whole
 * pipeline paints v1's tiers here, so this object is the definition of "the new knobs are inert at
 * their defaults" rather than a claim about it.
 */
export const OPERATING_POINT = Object.freeze({
  d: CONSTANTS.depth.ref, rakePct: CONSTANTS.rake.min, rakeCapBB: CONSTANTS.rake.capBB, straddle: false,
  // ---- the v3 axes, at the LEGACY setting that makes each of them the identity ------------------
  // V3-PLAN §0.4(a): a v3 mechanism enters as "a new axis inert at legacy settings". These three
  // are that shape. They are OFF/at-reference here and their DEFAULTS ARE NOT FLIPPED in P1 — a
  // flip moves the tiers on the shallow, deep and straddled lanes of I32's surface, and §0.4(c)
  // says that is a deliberate `freeze-tiers.mjs --force` ceremony with the move-diff committed,
  // which belongs to the B1 integration stage and not to a lane worktree.
  //
  //   rakeDepth   the rake-depth coupling (item 6). false = `potBB` is the flat 60 it has always
  //               been. Note the coupling is the identity at 100bb in BOTH straddle states, so it
  //               is only the 40bb and 250bb lanes that a flip would move.
  //   depthWidth  the depth->width factor (item 6b). false = `widthFor` does not read depth, which
  //               is precisely the defect brief §5.1 records as limitation 17.
  //   sizing      the 3-bet size as a fraction of the pot-size raise (item 9). 1 = pot, and at
  //               s = 1 every threshold is returned by reference, not recomputed.
  rakeDepth: false, depthWidth: false, sizing: CONSTANTS.sizing.ref,
});

/**
 * Attach the two DERIVED quantities every consumer below reads, and freeze. Both are
 * non-enumerable, so `JSON.stringify(env)` still emits exactly the four axes the user set:
 *
 *   dEff      the depth the SCORING layer sees, in preflop units — a straddle halves it (§3.3),
 *             clamped to [40,250] for the reason `depthU` clamps. CONSEQUENCE, OWNED: the
 *             straddle's depth half saturates below 80bb, since 40/2 is off the bottom of the dial.
 *   rakePot   the reference raked pot in preflop units, `potBB` scaled by depth when `rakeDepth`
 *             is on and the flat `potBB` when it is off (V3-PLAN item 6).
 *   rakeFrac  the fraction of a won pot the house takes, min(pct, cap/(rakePot*unit)).
 */
function sealEnv(e) {
  const D = CONSTANTS.depth, R = CONSTANTS.rake;
  const unit = e.straddle ? CONSTANTS.straddle.unit : 1;
  const pct = e.rakePct / 100;
  Object.defineProperty(e, '__env', { value: true });   // non-enumerable: JSON.stringify(e) is clean
  Object.defineProperty(e, 'dEff', {
    value: e.straddle ? Math.min(D.max, Math.max(D.min, e.d / unit)) : e.d,
  });
  // The coupling reads the RAW depth `d`, not `dEff`, and that is load-bearing rather than a
  // slip. `d` is the stack in BIG BLINDS and the cap is quoted in big blinds; `dEff` is the same
  // stack re-expressed in preflop units, which is a change of unit and not a change of money. If
  // the scale read `dEff` it would double-count the straddle — the `* unit` below is already the
  // straddle's whole effect on this quantity (§5.3) — and the coupling would stop being the
  // identity at 100bb straddled, which is the one thing that keeps I32's 100bb lanes untouched.
  // Measured both ways before it was written: `dEff` moves d100/r5/s1 from 2.500% to 5.000%.
  const scale = (e.rakeDepth && e.d !== D.ref) ? Math.pow(e.d / D.ref, R.potScale) : 1;
  const rakePot = scale === 1 ? R.potBB : R.potBB * scale;
  Object.defineProperty(e, 'rakePot', { value: rakePot });
  Object.defineProperty(e, 'rakeFrac', {
    value: (pct <= 0 || e.rakeCapBB <= 0) ? 0 : Math.min(pct, e.rakeCapBB / (rakePot * unit)),
  });
  return Object.freeze(e);
}

const DEFAULT_ENV = sealEnv({ ...OPERATING_POINT });

/**
 * Normalise the table environment out of a state/opts bag. Returns the shared frozen default at the
 * v1 operating point, so the hot path allocates nothing and the identity case is `===`-checkable.
 * `d` clamps to the slider's own domain [40, 250] and `rakePct` to [0, 6] — outside those the curves
 * are extrapolation, the same discipline `nEff` applies to the equity curve. `rakeCapBB` has no
 * upper clamp: a cap so large it never binds is a legal (and common) rake structure.
 */
export function envOf(s) {
  if (!s) return DEFAULT_ENV;
  if (s.__env === true) return s;
  if (s.env && s.env.__env === true) return s.env;   // an opts bag carrying an already-normalised one
  const D = CONSTANTS.depth, R = CONSTANTS.rake, SZ = CONSTANTS.sizing;
  const rawD = s.d;
  const d = (rawD == null || !isFinite(rawD)) ? D.ref : Math.min(D.max, Math.max(D.min, rawD));
  const rakePct = (s.rakePct == null || !isFinite(s.rakePct)) ? R.min : Math.min(R.max, Math.max(R.min, s.rakePct));
  const rakeCapBB = (s.rakeCapBB == null || !isFinite(s.rakeCapBB)) ? R.capBB : Math.max(0, s.rakeCapBB);
  const straddle = !!s.straddle;
  // The three v3 axes. `sizing` clamps to its own domain for the reason `d` does — outside it the
  // price arithmetic is still exact but the RANGE model behind it is not describing the same game.
  const rakeDepth = s.rakeDepth === true;
  const depthWidth = s.depthWidth === true;
  const sizing = (s.sizing == null || !isFinite(s.sizing)) ? SZ.ref : Math.min(SZ.max, Math.max(SZ.min, s.sizing));
  if (d === D.ref && rakePct === R.min && rakeCapBB === R.capBB && !straddle
    && !rakeDepth && !depthWidth && sizing === SZ.ref) return DEFAULT_ENV;
  return sealEnv({ d, rakePct, rakeCapBB, straddle, rakeDepth, depthWidth, sizing });
}

/**
 * The memo key fragment for an environment. Every axis that can move a tier MUST appear here, or
 * the solve/aggressive-set caches hand back another environment's answer — which is a silent wrong
 * answer rather than a crash. All four axes move a tier now (`straddle` was in the key before it
 * did anything, which is why turning it on cost nothing here).
 *
 * THE THREE v3 AXES ARE IN THE KEY FROM THE DAY THEY EXIST, not from the day their defaults flip.
 * That is the trap this docstring has always described and V3-PLAN §7.2 predicts I32 catching: an
 * axis that moves a number but not the key hands back another environment's answer, and the
 * failure is silent. Adding them while they are still inert costs nothing measurable and means the
 * B1 default flip is a one-line change to `OPERATING_POINT` rather than a cache audit.
 */
export function envKey(env) {
  const e = envOf(env);
  return `${e.d}|${e.rakePct}|${e.rakeCapBB}|${e.straddle ? 1 : 0}`
    + `|${e.rakeDepth ? 1 : 0}|${e.depthWidth ? 1 : 0}|${e.sizing}`;
}

/** is a UTG straddle posted? (V2-PLAN §3.3 ships the UTG form only) */
export function straddleActive(env) { return envOf(env).straddle === true; }

/** the preflop betting unit in big blinds: 2 under a straddle, 1 otherwise */
export function unitBB(env) { return straddleActive(env) ? CONSTANTS.straddle.unit : 1; }

/** the depth the scoring layer sees, in preflop units — d under a straddle becomes d/2 (§3.3) */
export function effectiveDepth(env) { return envOf(env).dEff; }

/**
 * The reference raked pot in preflop units (V3-PLAN item 6, brief §5.3). `CONSTANTS.rake.potBB`
 * flat when the coupling is off; `potBB * (d/100)^potScale` when it is on.
 *
 * Reads the RAW depth, never `dEff` — see `sealEnv` for why, and I41 for the gate that pins it.
 * Exactly `potBB` at d = 100 whatever `potScale` is, because the ratio is 1 there and the branch
 * in `sealEnv` returns the constant itself rather than `potBB * Math.pow(1, s)`.
 */
export function rakePotBB(env) { return envOf(env).rakePot; }

/** is the rake-depth coupling on? (V3-PLAN item 6; legacy = off) */
export function rakeDepthActive(env) { return envOf(env).rakeDepth === true; }

/** is the depth->width factor on? (V3-PLAN item 6b; legacy = off) */
export function depthWidthActive(env) { return envOf(env).depthWidth === true; }

/** the 3-bet size as a fraction of the pot-size raise (V3-PLAN item 9; legacy = 1 = pot) */
export function sizingOf(env) { return envOf(env).sizing; }

/**
 * The depth->width factor for a seat: `baseRealization(pos, dEff) / baseRealization(pos, ref)`.
 *
 * BRIEF §5.4's FREE ANCHOR, and the word free is doing real work — this introduces no constant.
 * `beta` is already in the model and already gated (I23(f)); this is the ratio it already implies,
 * read off the function that already computes it. Exactly 1 when the axis is off, and exactly 1 at
 * the reference depth whether it is on or off, so `widthFor` is untouched at the operating point.
 *
 * Written as the ratio of two `baseRealization` calls, NOT as `Math.pow(baseR[pos], beta*u)`:
 * measured, the two differ by one ulp at HJ and BB, and gate I42 asserts
 * `width ratio === realization ratio` with `===`. Computing the factor from anything other than
 * the function the identity is stated against would make that gate a tolerance argument.
 *
 * The signs are the brief's and they are the interesting half: at 250bb SB 0.9638 / BB 0.9749 /
 * UTG 0.9894 / HJ 0.9965 tighten and CO 1.0070 / BTN 1.0206 loosen, because a seat whose base is
 * under 1 loses more of its equity to depth and a seat whose base is over 1 gains — position
 * compounds when there is money behind. Shallow the signs flip, for the same reason.
 */
export function depthWidthFactor(pos, env) {
  const e = envOf(env);
  if (e.depthWidth !== true) return 1;
  const D = CONSTANTS.depth;
  if (e.dEff === D.ref) return 1;
  return baseRealization(pos, e.dEff) / baseRealization(pos, D.ref);
}

/**
 * The fraction of a won pot the house takes: `min(rakePct/100, rakeCapBB / (rakePotBB * unitBB))`.
 * Exactly 0 at the v1 operating point, which is what makes every term below the identity there.
 *
 * The `unitBB` factor is the whole of V2-PLAN §3.3's "only the vs-3-bet absolute price recomputes
 * off the doubled preflop unit": every threshold here is a RATIO and therefore scale-free, and the
 * cap is the one exception, quoted in big blinds against a pot quoted in preflop units. Straddled,
 * the same pot is twice as many bb, so the cap binds twice as hard and the effective rake FALLS —
 * counter-intuitive, and the right answer for capped rake in a bigger game.
 */
export function rakeFraction(env) { return envOf(env).rakeFrac; }

/**
 * V2-PLAN §3.2's flat haircut on rho, `1 - rakePct*capFactor`. Exactly 1 at rakePct 0, so
 * `rho * rakeRhoFactor(env) === rho` bit for bit at the operating point (I22).
 *
 * READ THE `rake` BLOCK IN CONSTANTS BEFORE "FIXING" THIS: a factor common to every cell is
 * TIER-INERT at the three percentile nodes by construction. It scales the scores, the interpolated
 * cuts and the margins by one number. That is what §3.2 specifies, it is documented as crude, and
 * gate I31 pins both the inertness and the place rake does bite.
 */
export function rakeRhoFactor(env) { return 1 - rakeFraction(env); }

/**
 * The vs-3-bet pot-odds breakeven at the sizing `s`, after rake.
 *
 * **Depth does not move this** — V2-PLAN §3.1 is explicit that the 29% is a price, not a
 * preference, and prices are set by the sizing, not by the stacks behind it. Which is exactly why
 * V3-PLAN item 9 makes the SIZING an axis: the sentence above was true and the model had no dial
 * for the one thing it named.
 *
 * **Rake moves it**, and that half is exact arithmetic rather than opinion:
 *
 *   call c into a final pot P, collect P*(1-r) when you win
 *   e*(P*(1-r) - c) = (1-e)*c   =>   e = c / (P*(1-r)) = breakeven / (1 - r)
 *
 * **Sizing moves it, and that half is exact too** (V3-PLAN item 9, gate I44). With hero opening to
 * `o` into blinds `b` and villain 3-betting to `o + s*(b + 2o)`, hero calls `s*(b + 2o)` into a
 * final pot of `(b + 2o)*(1 + 2s)`, so the raw price is `s/(1 + 2s)` — `b` and `o` CANCEL, and the
 * price is pure geometry with no table assumption in it at all. The shipped 0.290 is that quantity
 * at s = 1 (up to the rounding METHODOLOGY §7 records), so the sizing enters as the ratio
 * `e(s)/e(1) = 3s/(1 + 2s)` and the constant is re-scaled rather than replaced.
 *
 * At s = 1 the constant is returned BY REFERENCE, not multiplied by a factor that happens to be 1
 * — the same discipline `baseRealization` applies to its exponent, and I44's first clause
 * ("pot-size = today bit-for-bit") is a claim about identity, not about rounding.
 */
export function breakevenPrice(env) {
  const e = envOf(env);
  const r = e.rakeFrac;
  const base = sizingPrice(e.sizing);
  return r === 0 ? base : base / (1 - r);
}

/**
 * The raw (unraked) vs-3-bet price at sizing `s`. Split out from `breakevenPrice` so gate I44 can
 * assert the sizing arithmetic without a rake in the way, and so the sizing readout and the price
 * readout cannot drift apart.
 */
export function sizingPrice(s) {
  const K = CONSTANTS.vs3bet, SZ = CONSTANTS.sizing;
  const x = (s == null || !isFinite(s)) ? SZ.ref : s;
  if (x === SZ.ref) return K.breakeven;                    // pot-size: the shipped constant itself
  return K.breakeven * (3 * x) / (1 + 2 * x);
}

/**
 * The vs-3-bet continue floor — where rake reaches a DECISION. The model's own reason line has
 * always described `call` as "the price plus 7 points, because a 3-bet pot is played out of
 * position over three streets": the 7 points are opinion, the price under them is arithmetic. So
 * rake moves the floor by exactly what it moves the price, premium unchanged.
 *
 * An INTERPRETATION, named as one. §3.2 says rake "raises the 0.290 price directly" — but in v1
 * that price was DISPLAY-ONLY, quoted in the WHY panel and consulted by nothing, so raising it
 * alone would have made §3.2's own promise ("every marginal hand moves toward fold") false at the
 * only node where it can be true. Rejected alternative: leave the floor at 0.36 and change the text.
 *
 * V3-PLAN item 9 puts the SIZING through the same door, and the 7 points are the reason it needed a
 * decision rather than a line of code. The premium is a postflop claim ("a 3-bet pot is played out
 * of position over three streets"), and a bigger 3-bet buys a lower SPR — less postflop, so a
 * smaller premium. By how much, nothing here can say: the measurement layer is all-in equity at
 * showdown (limitation 16), which is exactly the quantity that cannot answer this. So the premium
 * is HELD CONSTANT at its pot-sized calibration, shipped flagged as `sizing.flag`, and gate I44
 * measures what that costs instead of a coefficient being invented to hide it.
 *
 * The branch is on the PRICE, not on the rake: at s != 1 with no rake the price has still moved,
 * and a `rakeFraction(env) === 0` early return would silently ship the pot-sized floor.
 */
export function callFloorAt(env) {
  const price = breakevenPrice(env);
  return price === CONSTANTS.vs3bet.breakeven ? CONSTANTS.vs3bet.call
    : CONSTANTS.vs3bet.call + (price - CONSTANTS.vs3bet.breakeven);
}

/**
 * The straddle's seat transform: `baseRaise` one seat tighter, for the seats §3.3 shifts. Exactly 1
 * with no straddle, so `widthFor` is untouched at the operating point.
 */
export function seatWidthFactor(pos, env) {
  if (!straddleActive(env)) return 1;
  const S = CONSTANTS.straddle;
  return S.seatPinned.indexOf(pos) >= 0 ? 1 : S.seat;
}

// ---------------------------------------------------------------------------
// 1. VPIP -> expected opponents
// ---------------------------------------------------------------------------
export function cCall(v) { return 0.55 * Math.pow(v, 1.25); }
export function cBlind(v) { return Math.min(0.95, 1.5 * cCall(v) + 0.10); }
export function cLimper(v) { return Math.min(0.90, 0.45 + 0.50 * v); }

/** seats behind hero that are non-blind, when hero faces an open from an earlier seat */
function behindNonBlind(pos) { return N_NB[pos]; }

/**
 * Expected opponents at a node, and the field size the equity curve is read at.
 *
 * `N` is clamped to the span the Monte Carlo actually covers, and that span is now 1..7
 * (V2-PLAN §2.2): one deal deals seven villains and yields every prefix, so the iso node's
 * genuinely six- and seven-way spots are measured rather than pretended to be five-way. The clamp
 * and the `extrapolated` flag stay — they now bite above 7, which the model still reaches at the
 * loosest iso settings (HJ over four limpers at VPIP 90 raises 7.40 opponents).
 *
 * Unclamping was checked against gate I22 before it landed, not assumed safe: the 15 settings in
 * the I22 domain whose raw N_eff sits between 5 and 5.61 paint exactly the tiers they painted when
 * they were clamped to 5.00.
 *
 * @returns {{raw:number, N:number, extrapolated:boolean}}
 */
export function nEff(state) {
  const { node, pos, v } = state;
  const L = state.limpers == null ? 2 : state.limpers;
  // §3.3's field half: the straddler is one extra defender BEHIND EVERY SEAT (he acts last preflop)
  // and defends like a blind, so he joins at cBlind(v) with the same discount the node applies to
  // its blinds. The six modelled seats keep their names — they are positions relative to the
  // button, which a straddle does not move — and the straddler is the seventh player: §3.3's
  // "de-facto UTG+straddler table". Nothing at the vs-3-bet node, which is heads-up by
  // construction.
  const str = straddleActive(state);
  const c = cCall(v), cb = cBlind(v), cl = cLimper(v);
  let raw;
  if (node === 'rfi') {
    raw = 1 + N_NB[pos] * c + N_BL[pos] * cb;
    if (str) raw += cb;
  } else if (node === 'limps') {
    raw = 1 + L * cl + N_NB[pos] * CONSTANTS.isoBehind * c + N_BL[pos] * cb;
    if (str) raw += cb;
  } else if (node === 'raise') {
    raw = 1 + behindNonBlind(pos) * CONSTANTS.vsRaiseBehind * c
            + N_BL[pos] * CONSTANTS.vsRaiseBlind * cb + 1;
    if (str) raw += CONSTANTS.vsRaiseBlind * cb;
  } else {
    raw = 2; // vs 3-bet is treated heads-up; N_eff is not used for tiering
  }
  const N = Math.min(7, Math.max(1, raw));
  return { raw, N, extrapolated: raw > 7.0001 };
}

// ---------------------------------------------------------------------------
// 2. realization, nut multiplier, score
// ---------------------------------------------------------------------------
/**
 * The normalised log-depth coordinate: -1 at 40 bb, 0 at 100 bb, +1 at 250 bb.
 *
 * `u(ref) === 0` EXACTLY, which is what makes every depth term below the exact identity at the v1
 * operating point (I22) rather than the identity to within a rounding error. `Math.log2(1)` is +0
 * by the ECMAScript spec, so the early return is belt-and-braces — but I22's bit-identity is too
 * important to hold by appeal to a spec paragraph.
 *
 * The far endpoint is not exact and does not need to be: `250/100` is exact in binary, `40/100` is
 * not, so u(40) lands one ulp inside -1. These constants are opinion at the second decimal. The
 * clamp keeps |u| <= 1 a property rather than an observation, so "lambda(250) IS the constant"
 * stays a safe thing to say about the CONSTANTS block.
 */
export function depthU(d) {
  const D = CONSTANTS.depth;
  const dd = (d == null || !isFinite(d)) ? D.ref : Math.min(D.max, Math.max(D.min, d));
  if (dd === D.ref) return 0;
  return Math.min(1, Math.max(-1, Math.log2(dd / D.ref) / Math.log2(D.max / D.ref)));
}

// kappa(N) and lambda(d) are the same idea measured along two different axes, and M_nut / M_deep
// below are deliberately the same shape. See the `depth` block in CONSTANTS.
export function kappa(N) { return CONSTANTS.kappa[0] + CONSTANTS.kappa[1] * (N - 1); }
export function lambda(d) { return CONSTANTS.depth.lambda * depthU(d); }
export function mu(d) { return CONSTANTS.depth.mu * depthU(d); }

export function mNut(nu, N) { return 1 + kappa(N) * (nu - CONSTANTS.nuBar); }

/**
 * M_deep(h, d) = 1 + lambda(d)*(nu - nuBar) - mu(d)*(cooler - coolerBar).
 *
 * Deep, nut potential is worth more (lambda > 0) and a cooler costs a stack rather than a bet
 * (mu > 0). Shallow both flip: raw equity is most of the game at 40bb, which is `lambda(40) < 0`.
 *
 * `cooler` is DROPPED, not defaulted, when the model does not carry it — a v1 dataset predates
 * V2-PLAN §2.1, and scoring it against a bar it was never measured for would be an invention. The
 * lambda half still works, because nu is v1 data.
 *
 * @param {number} nu       the cell's nut scalability
 * @param {number} [cooler] the cell's measured cooler rate, or null on a pre-v2 model
 * @param {number} [d]      stack depth in bb; defaults to the v1 operating point, where this is 1
 */
export function mDeep(nu, cooler, d) {
  const u = depthU(d);
  if (u === 0) return 1;                                   // the v1 operating point, exactly (I22)
  const D = CONSTANTS.depth;
  const coolTerm = (cooler == null || !isFinite(cooler)) ? 0 : cooler - D.coolerBar;
  return 1 + D.lambda * u * (nu - CONSTANTS.nuBar) - D.mu * u * coolTerm;
}

/**
 * The positional realization base, spread wider with depth: `base(p) ^ (1 + beta*u(d))` pushes the
 * bases away from 1 as the exponent grows, widening BTN's edge over SB in both directions at once
 * rather than needing a per-seat table of depth deltas.
 *
 * The exponent is exactly 1 at the reference depth, and the branch on it is load-bearing:
 * ECMAScript specifies `Math.pow` as "implementation-approximated" and does NOT require
 * `Math.pow(x, 1) === x`. Every shipping libm happens to special-case it; I22 does not rest on that.
 */
export function baseRealization(pos, d) {
  const b = CONSTANTS.baseR[pos];
  const e = 1 + CONSTANTS.depth.beta * depthU(d);
  return e === 1 ? b : Math.pow(b, e);
}

export function realization(pos, N, nu, d) {
  return baseRealization(pos, d) * (1 - CONSTANTS.multiwayRealizationSlope * (N - 1) * (1 - nu));
}

/**
 * The hard nut gate's floor stays a function of the FIELD and of nothing else. Depth enters through
 * M_deep and the positional spread; keeping it out of the gate is what keeps the two dials
 * separable, so "the nut gate bit here" always means the table got looser and never that the stacks
 * got deeper. Gate I27 turns that into a testable fact: the N_eff = 3.0 discontinuities sit at the
 * same VPIP at 40bb and at 250bb.
 */
export function nuMin(N) {
  return Math.min(CONSTANTS.nutGateCap, CONSTANTS.nutGate[0] + CONSTANTS.nutGate[1] * (N - 3));
}

// ---- the vs-3-bet thresholds, as depth moves them -------------------------------------------
// The price does not move (`breakevenPrice`); the SHAPE of the continue range does. Deep favours the
// in-position call-and-cooler plan, so the 4-bet bar rises and hands that would have jammed at 40bb
// call at 250; and a deep 3-bet pot is where a second-best hand costs a stack, so the nut floors
// rise too — M_deep's lambda restated at a node that cuts on thresholds instead of a percentile.
export function nuCallAt(env) { return CONSTANTS.vs3bet.nuCall + CONSTANTS.depth.nuFloor * depthU(envOf(env).dEff); }
export function nuOOPAt(env) { return CONSTANTS.vs3bet.nuOOP + CONSTANTS.depth.nuFloor * depthU(envOf(env).dEff); }
export function fourBetAt(env) { return CONSTANTS.vs3bet.fourBet + CONSTANTS.depth.fourBet * depthU(envOf(env).dEff); }

/**
 * Linear interpolation of a cell's rho over fractional N, clamped to the span the data covers.
 * The span is read from the array itself rather than hard-coded, because v2 measures N = 1..7
 * (V2-PLAN §2.2) while a v1 model carries N = 1..5 — and a policy that silently indexed past the
 * end of a five-long array would produce NaN rather than a clamp.
 */
export function rhoAt(rho, N) {
  const hi = rho.length;
  const x = Math.min(hi, Math.max(1, N));
  const i = Math.min(hi - 2, Math.floor(x) - 1);
  const f = x - (i + 1);
  return rho[i] + (rho[i + 1] - rho[i]) * f;
}
export function eqAt(eq, N) { return rhoAt(eq, N); }

// ---------------------------------------------------------------------------
// 2b. the villain profile — reading the VPIP lattice (V2-PLAN §2.3, §4)
// ---------------------------------------------------------------------------
/**
 * The villain profile is OFF, and the whole point of this object is that OFF is not a value of
 * `v` — it is the absence of the axis. Every accessor below returns the SHIPPED arrays by
 * reference when the profile is off, so the random-villain path is `===`-identical to what it was
 * before this section existed. Gate I22 (v1 tier reproduction, bit for bit) is the proof, and it
 * is left untouched deliberately: a helper that "happened to" reproduce v1 through a zero delta
 * would be one rounding change away from not doing so.
 */
export const VILLAIN_OFF = Object.freeze({ on: false, v: null, q: null, measured: null });

/**
 * Normalise a villain-profile bag. Anything falsy, or `{on:false}`, is the OFF profile.
 * @param {object|null} p `{ on, v, q, measured }` — `measured` is a per-cell eq map from the
 *   Simulate engine (V2-PLAN §4), keyed by cell key, each value an eq array in N = 1..NMAX order.
 * @param {object} [model] read for the lattice span and the shipped discipline. The lattice lives
 *   in the DATA (the generator measures it), not in this file's CONSTANTS, so without a model the
 *   clamp falls back to the page's own VPIP dial, [25, 90].
 * @returns {{on:boolean, v:number|null, q:number|null, measured:object|null}}
 */
export function villainProfileOf(p, model) {
  if (!p || p.on !== true) return VILLAIN_OFF;
  const V = (model && model.constants && model.constants.villainLattice) || {};
  const vp = (model && model.meta && model.meta.vpip) || {};
  const pts = V.v || [];
  const lo = pts.length ? pts[0] : (vp.min || 25), hi = pts.length ? pts[pts.length - 1] : (vp.max || 90);
  const v = (p.v == null || !isFinite(p.v)) ? null : Math.min(hi, Math.max(lo, p.v));
  const q = (p.q == null || !isFinite(p.q)) ? (V.discipline == null ? null : V.discipline) : p.q;
  return { on: true, v, q, measured: p.measured || null };
}

/**
 * Where `v` sits on the shipped lattice.
 * @returns {{lo:number, hi:number, f:number, exact:boolean}} indices into the lattice array, and
 *   the blend weight. `exact` is true only when `v` IS a lattice point, in which case `lo === hi`
 *   and the caller must not blend at all — see `interpolateDelta`.
 */
export function latticeBracket(pts, v) {
  const n = pts.length;
  if (!n) return { lo: -1, hi: -1, f: 0, exact: false };
  for (let i = 0; i < n; i++) if (pts[i] === v) return { lo: i, hi: i, f: 0, exact: true };
  if (v <= pts[0]) return { lo: 0, hi: 0, f: 0, exact: false };
  if (v >= pts[n - 1]) return { lo: n - 1, hi: n - 1, f: 0, exact: false };
  let i = 0;
  while (i < n - 2 && pts[i + 1] < v) i++;
  return { lo: i, hi: i + 1, f: (v - pts[i]) / (pts[i + 1] - pts[i]), exact: false };
}

/**
 * Linear interpolation of one cell's shipped equity deltas over v.
 *
 * EXACTNESS AT THE LATTICE POINTS IS A REQUIREMENT, not a happy accident: the page labels an
 * off-lattice number `interpolated` and an on-lattice number as measured, and those two labels must
 * not disagree about the same cell at v = 55. So a lattice hit returns the shipped row itself
 * rather than `a + (b - a) * f` with f = 0 — which is exact here but is exactly the expression that
 * stops being exact at f = 1 (a + (b - a) is not b in IEEE-754 for every a, b).
 *
 * @param {number[]} pts the lattice v-points, ascending
 * @param {number[][]} vDelta one row per lattice point, one column per N
 * @param {number} v
 * @returns {{delta:number[], exact:boolean}}
 */
export function interpolateDelta(pts, vDelta, v) {
  const br = latticeBracket(pts, v);
  if (br.lo < 0) return { delta: null, exact: false };
  if (br.exact || br.lo === br.hi) return { delta: vDelta[br.lo], exact: br.exact };
  const a = vDelta[br.lo], b = vDelta[br.hi], f = br.f;
  const out = new Array(a.length);
  for (let k = 0; k < a.length; k++) out[k] = a[k] + (b[k] - a[k]) * f;
  return { delta: out, exact: false };
}

/**
 * The profile-aware equity accessor. THE one place the page should read equity from once the
 * villain axis exists.
 *
 * Three sources, in priority order:
 *   'measured'     the Simulate engine ran and handed back real trials for this cell (§4)
 *   'interpolated' the shipped lattice, blended in v (and labelled as such)
 *   'shipped'      the random-villain baseline, by reference
 *
 * The lattice is measured at ONE discipline (q = 0.85). At any other q there is no shipped answer —
 * that is precisely the state the Simulate button exists for — so `supported` goes false and the
 * accessor falls back to the baseline rather than pretending the q axis is interpolable.
 *
 * @param {object} model
 * @param {string} key the cell key, needed only to look up a measured result
 * @param {object} cell the MODEL cell (hydrated)
 * @param {object|null} profile see `villainProfileOf`
 * @returns {{eq:number[], rho:number[], source:string, exact:boolean, supported:boolean,
 *            v:number|null, q:number|null}}
 */
export function villainEq(model, key, cell, profile) {
  const p = villainProfileOf(profile, model);
  const base = { eq: cell.eq, rho: cell.rho, source: 'shipped', exact: true, supported: true, v: null, q: null };
  if (!p.on || p.v == null) return base;

  if (p.measured) {
    const m = p.measured[key];
    if (m && m.length === cell.eq.length) {
      return { eq: m, rho: m.map((e, i) => (e * (i + 2)) / 100), source: 'measured', exact: true, supported: true, v: p.v, q: p.q };
    }
  }
  const V = (model && model.constants && model.constants.villainLattice) || {};
  const pts = V.v || [];
  const disc = V.discipline;
  if (!pts.length || !Array.isArray(cell.vDelta) || cell.vDelta.length !== pts.length) {
    return { ...base, supported: false, v: p.v, q: p.q };
  }
  if (p.q != null && disc != null && p.q !== disc) {
    // an off-lattice discipline has no shipped answer at all — say so, do not invent one
    return { ...base, supported: false, v: p.v, q: p.q };
  }
  const { delta, exact } = interpolateDelta(pts, cell.vDelta, p.v);
  if (!delta) return { ...base, supported: false, v: p.v, q: p.q };
  const eq = new Array(cell.eq.length);
  for (let k = 0; k < eq.length; k++) eq[k] = cell.eq[k] + delta[k];
  return {
    eq,
    rho: eq.map((e, i) => (e * (i + 2)) / 100),
    source: exact ? 'lattice' : 'interpolated',
    exact, supported: true, v: p.v, q: p.q,
  };
}

/**
 * The standard error the page should quote for a measurement of `trials` multiway trials, in
 * equity points: `50 / sqrt(trials)`, the binomial SE at p = 0.5 — the same expression the
 * generator writes into `meta.se` for the shipped dataset, so a simulated badge and a shipped one
 * are on the same basis. 100k -> 0.16 (the shipped figure), 25k -> 0.32.
 *
 * NOTE, and it matters for badge copy: V2-PLAN §4 quotes "+/-0.35 pt" at 25k trials against "the
 * shipped +/-0.16". Those two cannot both come from one formula — 0.16 is 50/sqrt(100,000), and
 * 50/sqrt(25,000) is 0.32, not 0.35. The plan's 0.35 is an arithmetic slip, and this returns the
 * figure that is on the same basis as the one the model already ships.
 */
export function seOfTrials(trials) { return trials > 0 ? 50 / Math.sqrt(trials) : Infinity; }

// ---------------------------------------------------------------------------
// 2c. the villain profile as a SHADOW MODEL (V3-PLAN item 8, gate I43)
// ---------------------------------------------------------------------------
/**
 * FNV-1a over a string, 8 hex characters. Pure arithmetic — no Node APIs, no imports, which is why
 * it is here rather than borrowed from `node:crypto`: this module is inlined into the page verbatim.
 * It is a CACHE-KEY hash and nothing else; nothing security-shaped depends on it.
 */
export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

/**
 * The memo-key fragment for a villain profile. `'OFF'` when the profile is off — a CONSTANT, so the
 * off keys are stable and the off path is one string comparison.
 *
 * Every axis that can move a number is in here, for the same reason `envKey` exists: the solve memo
 * must not hand back another field's answer. `measured` contributes its own identity, because a
 * Simulate result replaces the lattice for the cells it covers.
 */
export function villainKey(profile, model) {
  const p = villainProfileOf(profile, model);
  if (!p.on) return 'OFF';
  let m = '-';
  if (p.measured) {
    m = p.measured.settingsHash || p.measured.hash;
    if (!m) { let n = 0; for (const k in p.measured) if (Object.prototype.hasOwnProperty.call(p.measured, k)) n++; m = 'n' + n; }
  }
  return `ON|${p.v}|${p.q}|${m}`;
}

/* THE PER-PROFILE SHADOW MEMO (P2 pre-stage, the slider-morph re-anchor).
 *
 * WHY IT IS HERE AND NOT IN THE PAGE. Before this the page carried its own copy of the construction
 * below and its own memo, and that memo held ONE entry keyed by the profile — so with the villain
 * profile on by load default (barrier B1) every VPIP slider step rebuilt the shadow from scratch.
 * The page's copy is now deleted and `src/shell.html`'s `emodel()` delegates here, which leaves
 * exactly one construction in the repository and exactly one place to memoise it. Two measurements
 * decided that it is THIS place rather than a second page-side book:
 *
 *   BYTES. `app` (markup + CSS + minified app JS) was 83 B under its 360 KB ceiling at the time of
 *   the hoist and the ceiling is not this step's to raise (P3 owns that decision). A memo written
 *   here lands in the MODEL-CODE block, which had 4.8 KB of its 50 KB ceiling free, and deleting
 *   the page's duplicate gives `app` back about a kilobyte instead of spending more of it.
 *
 *   REACH. `scripts/lib/tier-fixture-v3.mjs` hand-rolls this same per-VPIP cache (its `shadows`
 *   Map, "built ONCE PER VPIP ... the difference between a sweep that takes seconds and one that
 *   takes minutes") and gate I43(d) builds one shadow per lattice point. Both now get it for free,
 *   and neither has to know that it needed it.
 *
 * WHAT IT IS WORTH, MEASURED, and this is the honest half of the story: building a shadow costs
 * 0.1-0.9 ms, so the memo takes about 0.3 ms off a slider step that measured ~11 ms with the
 * profile on. It is not what makes the morph fast — the ribbon's 66-point re-solve behind
 * `src/shell.html`'s curve book is — and smoke.mjs's two morph rows carry that measurement.
 *
 * BOUNDED, IN THE `SIMBOOK` IDIOM, because the reachable key space is not small: `villainKey` spans
 * 66 table-VPIP values times every discipline the q editor can reach times a measurement identity
 * per Simulate run, and a shadow is ~123 copied cells. An unbounded book would be a leak with a
 * cache's name on it. `SHADOW_CAP` is 24 — the same entry cap `SIMBOOK` runs on the page, and
 * comfortably above the 14 distinct VPIP values smoke's layout sweep visits. It is a cache size and
 * NOT a model constant: it cannot move a number, only how often one is recomputed, which is why it
 * is not in `constants` and why it sits beside `MEMO_CAP` rather than in §6's anchor table.
 *
 * KEYED BY THE MODEL OBJECT, through a WeakMap, because `villainKey` says nothing about WHICH model
 * was profiled: a gate that loads two models in one process must not be handed the other one's
 * shadow. The entry also remembers the `measured` object it was built from and is rejected if that
 * identity moved, so a re-measurement at settings whose hash is unchanged can never be served a
 * stale shadow — the `validate`-on-read discipline `SIMBOOK` runs, for the same reason.
 *
 * ITS CONTRACT IS `solve`'s CONTRACT: a caller that MUTATES a model in place gets a stale answer,
 * here and out of `SOLVE_MEMO` both, because both key on identities the mutation does not touch.
 * Nothing in this repository mutates a loaded model, and a caller that wants to should build a new
 * object rather than ask either memo to notice.
 */
const SHADOW_CAP = 24;
const SHADOWS = new WeakMap();

/**
 * THE PROFILE-ON MACHINERY (V3-PLAN item 8). `villainEq` answers one cell at a time; the scoring
 * pipeline wants a MODEL. So the profile is expressed as a SHADOW MODEL — the same object graph
 * with a profiled `cells` map — which `solve` can be handed in place of the shipped one.
 *
 * This construction previously lived in `src/shell.html` and nowhere else, which meant the villain
 * axis reached tiers through a path no gate could see: `scripts/lib/tier-fixture-v2.mjs` records
 * exactly that, "the villain profile reaches tiers through `villainEq`, which the page calls and
 * `solve` does not". Hoisting it here is what makes I43 possible at all, and it is the only reason
 * the hoist happened — the page's copy was a duplicate of this, not a variant of it. THE PAGE'S
 * COPY IS NOW GONE (P2 pre-stage): `src/shell.html`'s `emodel()` calls this function, so the
 * duplicate the P1 hoist queued for deletion has been deleted and there is one construction left.
 *
 * THREE THINGS ARE LOAD-BEARING.
 *
 *  1. **OFF IS OBJECT IDENTITY.** With the profile off this returns THE MODEL ITSELF — the same
 *     object, not an equal copy. `villainEq` returns `cell.eq`/`cell.rho` by reference for exactly
 *     this reason, and I22/I32's claim is about identity, not about rounding. I43 asserts it with
 *     `assert.equal`, never `deepEqual`: a deep-equal copy would satisfy a value check and still
 *     be a different object under the memo, which is the failure mode, not the symptom.
 *
 *  2. **NOTHING MOVED IS ALSO OFF.** An off-lattice `q` is `supported: false` at every cell — the
 *     accessor refuses to interpolate an axis with one measurement on it — so the profile is on and
 *     no number has changed. The honest representation of that is the model itself, not a
 *     hash-shifted twin that makes the caller re-solve 123 identical cells. The BADGE says the
 *     profile is on; the numbers say they are the shipped ones, because they are.
 *
 *  3. **THE SHADOW WEARS A DIFFERENT `meta.hash`.** `solve` and `aggressiveSet` key their memos on
 *     the first eight characters of it, so a shadow wearing the real hash would be handed the
 *     unprofiled answer straight out of the cache — a silent wrong number, the same failure
 *     `envKey` exists to prevent.
 *
 * @param {object} model   the shipped model (hydrated or not)
 * @param {object|null} profile see `villainProfileOf`
 * @returns {object} the model itself when the profile is off or inert, else a shadow model
 */
export function profiledModel(model, profile) {
  const key = villainKey(profile, model);
  if (key === 'OFF') return model;
  const p = villainProfileOf(profile, model);
  let book = SHADOWS.get(model);
  if (!book) { book = new Map(); SHADOWS.set(model, book); }
  const hit = book.get(key);
  if (hit) {
    if (hit.measured === p.measured) { book.delete(key); book.set(key, hit); return hit.model; }
    book.delete(key);
  }
  const built = profiledModelUncached(model, p, key);
  if (book.size >= SHADOW_CAP) book.delete(book.keys().next().value);
  book.set(key, { measured: p.measured, model: built });
  return built;
}

function profiledModelUncached(model, p, key) {
  hydrate(model);
  const cells = {};
  let moved = 0;
  for (const k of Object.keys(model.cells)) {
    const c = model.cells[k];
    if (!c.combos) { cells[k] = c; continue; }
    const got = villainEq(model, k, c, p);
    if (got.eq === c.eq) { cells[k] = c; continue; }   // unsupported — shipped, by reference
    const nc = {};
    for (const f in c) if (Object.prototype.hasOwnProperty.call(c, f)) nc[f] = c[f];
    nc.eq = got.eq; nc.rho = got.rho; nc.vpSource = got.source;
    cells[k] = nc; moved++;
  }
  if (!moved) return model;
  const m = {};
  for (const f in model) if (Object.prototype.hasOwnProperty.call(model, f)) m[f] = model[f];
  m.meta = {};
  for (const f in model.meta) if (Object.prototype.hasOwnProperty.call(model.meta, f)) m.meta[f] = model.meta[f];
  m.meta.hash = fnv1a(key) + String(model.meta.hash).slice(8);
  m.cells = cells;
  return hydrate(m);
}

/**
 * The profile the page LOADS with once item 8's default is flipped — v at the lattice's own centre
 * point, q at the shipped discipline. Read from the DATA, never written out: the lattice lives in
 * `model.constants.villainLattice` because the generator measured it, and a load default typed into
 * this file could name a v the lattice does not carry.
 *
 * NOTHING IS FLIPPED HERE, BEFORE OR AFTER B1. `villainProfileOf` treats anything without
 * `on: true` as OFF, and every caller in this repository still passes nothing — `solve` has never
 * seen a profile and does not now. The flip V3-PLAN §5.1 asks for is the PAGE's initial state
 * (`src/shell.html` reads this function at boot and opens on what it returns), performed at barrier
 * B1 with the third fixture frozen and the move-diff committed. Keeping the library default OFF is
 * what makes I22 and I32 survive that flip, and I43(e) is the assertion that says so.
 *
 * `exact` is the claim I43's first clause turns into a gate: at this profile every live cell reads
 * a MEASURED lattice row, so zero cells are labelled `interpolated` at load. A default that landed
 * between lattice points would open the page on interpolated numbers under a measured-looking grid.
 */
export function villainLoadDefault(model) {
  const V = (model && model.constants && model.constants.villainLattice) || {};
  const pts = V.v || [];
  if (!pts.length || V.discipline == null) return VILLAIN_OFF;
  return { on: true, v: pts[(pts.length - 1) >> 1], q: V.discipline, measured: null };
}

/**
 * Aggressive target width for (pos, node, v). The straddle shifts the OPENING bases one seat
 * tighter (§3.3) and nothing else: `w3bet` has no seat base, so the vs-Raise width is untouched.
 * The factor is exactly 1 with no straddle, and `x * 1 === x`, but it is branched anyway — the same
 * discipline `baseRealization` applies to its exponent.
 */
export function widthFor(pos, node, v, env) {
  const K = CONSTANTS;
  // V3-PLAN item 6b: the depth->width factor is applied LAST, as one multiplication on the finished
  // width, at every node including vs-Raise. Two decisions are in that sentence.
  //   WHY LAST. `(w * g) / w` is not `g` in IEEE-754, but `w * g` IS exactly `w * g` — so gate
  // I42's exactness clause is stated as the PRODUCT identity `widthFor(deep) === widthFor(ref) * g`
  // and holds bit for bit. Folding `g` into `b` alongside `seatWidthFactor` would leave only a
  // 1e-15 claim, and §7.1 asks for the exact composition, not a tolerance.
  //   WHY vs-RAISE TOO, where `seatWidthFactor` deliberately does not apply. The straddle's seat
  // factor is a step along `baseRaise`'s own opening ladder, and `w3bet` has no seat base for it to
  // act on (limitation 13). This factor is not that: it is the ratio of a SEAT's realization at two
  // depths, which is defined for a seat whether or not its width has a seat base. Scoping it to the
  // opening nodes would leave limitation 17 half-closed — depth still unable to change how many
  // hands you play at the vs-Raise node — for a reason that does not apply to it.
  const g = depthWidthFactor(pos, env);
  if (node === 'raise') {
    const w = K.w3bet[0] + K.w3bet[1] * v;
    return g === 1 ? w : w * g;
  }
  const f = seatWidthFactor(pos, env);
  const b = f === 1 ? K.baseRaise[pos] : K.baseRaise[pos] * f;
  const base = b * (1 + K.widthSlope * (v - 0.5));
  const w = node === 'limps' ? base * (1 + K.isoValueFactor * Math.max(0, v - 0.5)) : base;
  return g === 1 ? w : w * g;
}

/** the passive-continue width (T3), 0 when the node has no T3 */
export function width3For(pos, node, v, limpers, env) {
  const K = CONSTANTS;
  if (node === 'raise') return K.wCall[0] + K.wCall[1] * v;
  if (node === 'limps') {
    const L = limpers == null ? 2 : limpers;
    if (L >= 2 && (pos === 'BTN' || pos === 'SB' || pos === 'BB')) return K.limpWidth * widthFor(pos, node, v, env);
  }
  return 0;
}

/**
 * The vs-Raise range-tightening shift applied to rho. It reads the OPENER's width, so under a
 * straddle it grows with the opener's own tightening — and because the shift is `-shift*(1 - nu)`
 * it is the one straddle effect that is NON-UNIFORM across cells at a percentile node.
 */
export function tightenFor(raiserPos, v, env) {
  return CONSTANTS.tighten * (1 - widthFor(raiserPos || 'CO', 'rfi', v, env));
}

// ---------------------------------------------------------------------------
// 3. scoring one cell
// ---------------------------------------------------------------------------
/**
 * @param {object} cell a MODEL cell (needs rho, nu, mplay; cooler when the model carries it)
 * @param {object} [env] the table environment (depth / rake / straddle); defaults to v1's
 * @returns {{S:number, rho:number, mnut:number, mdeep:number, mplay:number, R:number}}
 */
export function scoreCell(cell, pos, N, shift, env) {
  const e = envOf(env);
  let rho = rhoAt(cell.rho, N);
  if (shift) rho -= shift * (1 - cell.nu);
  const rf = rakeRhoFactor(e);
  if (rf !== 1) rho *= rf;                                   // V2-PLAN §3.2's flat haircut
  const mn = mNut(cell.nu, N);
  const md = mDeep(cell.nu, cell.cooler, e.dEff);
  const R = realization(pos, N, cell.nu, e.dEff);
  return { S: 100 * rho * mn * cell.mplay * R * md, rho, mnut: mn, mdeep: md, mplay: cell.mplay, R };
}

/** the within-cell single-hand adjustment (section 2.9) — an interpolation, never a measurement */
export function handAdjust(S, adjRawValue, adjMean) {
  return S * (1 + (adjRawValue - adjMean) / 100);
}

// ---------------------------------------------------------------------------
// 4. the percentile machinery
// ---------------------------------------------------------------------------
/**
 * Fill the quantities the emitter leaves out because they are exactly derivable, so the shipped
 * file carries no duplicated state that could drift. Idempotent; call once after loading MODEL.
 *   rho[N] = eq[N] * (N+1) / 100      oneIn = round(comboTotal / combos)
 */
export function hydrate(model) {
  if (model.__hydrated) return model;
  for (const key of Object.keys(model.cells)) {
    const c = model.cells[key];
    if (!c.combos) continue;
    // non-enumerable, so hydrating a model never changes what JSON.stringify emits
    if (!c.rho) Object.defineProperty(c, 'rho', { value: c.eq.map((e, i) => (e * (i + 2)) / 100), configurable: true });
    if (c.oneIn == null) Object.defineProperty(c, 'oneIn', { value: Math.round(model.meta.comboTotal / c.combos), configurable: true });
    if (c.nuSlope == null) Object.defineProperty(c, 'nuSlope', { value: (c.rho[4] - c.rho[0]) / 4, configurable: true });
  }
  Object.defineProperty(model, '__hydrated', { value: true, enumerable: false });
  return model;
}

function cellList(model) {
  if (!model.__list) {
    const list = [];
    for (const key of Object.keys(model.cells)) {
      const c = model.cells[key];
      if (!c.combos) continue;
      list.push({ key, cell: c, combos: c.combos });
    }
    Object.defineProperty(model, '__list', { value: list, enumerable: false });
  }
  return model.__list;
}

/**
 * Score + sort + cut. Returns the ranked table plus the cut scores.
 * Pure percentile machinery — no gates, no splits.
 */
export function rankTable(model, pos, node, v, opts) {
  const o = opts || {};
  const env = envOf(o);
  const total = model.meta.comboTotal;
  const info = nEff({ node, pos, v, limpers: o.limpers, env });
  const shift = node === 'raise' ? tightenFor(o.raiserPos, v, env) : 0;
  const list = cellList(model);
  const rows = new Array(list.length);
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const sc = scoreCell(it.cell, pos, info.N, shift, env);
    rows[i] = { key: it.key, cell: it.cell, combos: it.combos, ...sc };
  }
  rows.sort((a, b) => b.S - a.S);
  let cum = 0;
  for (const r of rows) {
    const share = r.combos / total;
    r.cumBefore = cum;
    r.cumMid = cum + share / 2;
    cum += share;
    r.cumAfter = cum;
  }
  return { rows, N: info.N, rawN: info.raw, extrapolated: info.extrapolated, shift, env };
}

/** score at a given cumulative frequency, linearly interpolated between straddling cells */
function scoreAtCut(rows, w) {
  if (w <= 0) return rows.length ? rows[0].S + 1 : 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].cumMid >= w) {
      if (i === 0) return rows[0].S;
      const a = rows[i - 1], b = rows[i];
      const f = (w - a.cumMid) / (b.cumMid - a.cumMid || 1);
      return a.S + (b.S - a.S) * f;
    }
  }
  return rows.length ? rows[rows.length - 1].S : 0;
}

/**
 * The aggressive set at (pos, node, v), AFTER the percentile cut and the nut gate but BEFORE the
 * T1/T2 split and the display post-passes. This is the set the exploit split and the positional
 * nesting cascade are defined on.
 */
const AGGR_MEMO = new Map();
function aggressiveSet(model, pos, node, v, opts) {
  const key = `${model.meta.hash ? model.meta.hash.slice(0, 8) : ''}|${pos}|${node}|${v}|`
    + `${opts.limpers == null ? 2 : opts.limpers}|${opts.raiserPos || 'CO'}|${envKey(opts)}`;
  const hit = AGGR_MEMO.get(key);
  if (hit) return hit;
  if (AGGR_MEMO.size >= MEMO_CAP) AGGR_MEMO.clear();
  const out = aggressiveSetUncached(model, pos, node, v, opts);
  AGGR_MEMO.set(key, out);
  return out;
}
function aggressiveSetUncached(model, pos, node, v, opts) {
  const t = rankTable(model, pos, node, v, opts);
  const w = widthFor(pos, node, v, t.env);
  const gate = t.N >= CONSTANTS.nutGate[2];
  const need = nuMin(t.N);
  const set = new Set();
  for (const r of t.rows) {
    if (r.cumMid >= w) break;
    if (gate && r.cell.nu < need) continue;      // nut gate demotes out of the aggressive set
    set.add(r.key);
  }
  return { set, table: t, w };
}

// ---------------------------------------------------------------------------
// 5. vs-3-bet: absolute thresholds against the pot-odds price
// ---------------------------------------------------------------------------
export function eqMixOf(cell, mix) {
  const m = mix || CONSTANTS.vs3bet.mix;
  const e = cell.eqVs3bet;
  return (m[0] * e.AA + m[1] * e.KK + m[2] * e.QQ + m[3] * e.BWR) / 100;
}

const AA_ROWS = new Set(['AA_BIGPAIR', 'AA_BROADWAY', 'AA_CONNECTED', 'AA_SMALLPAIR', 'AA_DANGLER']);

/**
 * The vs-3-bet node's decision boundaries expressed in cumulative combo frequency — the same axis
 * the other three nodes cut on. Rank every live cell by eqMix, walk the cumulative frequency, and
 * report where the ordering crosses the call floor and the four-bet threshold. Returns null for a
 * boundary the grid never crosses (not a live boundary at that mix).
 * @returns {{rows:Array, callCut:number|null, fourBetCut:number|null}}
 */
export function vs3betCuts(model, mix, env) {
  const total = model.meta.comboTotal;
  const rows = [];
  for (const it of cellList(model)) rows.push({ key: it.key, combos: it.combos, em: eqMixOf(it.cell, mix) });
  rows.sort((a, b) => b.em - a.em);
  let cum = 0;
  for (const r of rows) { const share = r.combos / total; r.cumMid = cum + share / 2; cum += share; }
  const cross = (thr) => {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].em > thr) continue;
      if (i === 0) return null;                       // the whole grid is below it — not a boundary
      const a = rows[i - 1], b = rows[i];
      const f = (a.em - thr) / ((a.em - b.em) || 1);
      return a.cumMid + (b.cumMid - a.cumMid) * f;
    }
    return null;                                      // the whole grid is above it — not a boundary
  };
  // The ORDERING here is by eqMix and is depth- AND rake-independent — all-in equity does not move
  // with the stacks (V2-PLAN §1) and the house does not deal the cards. What moves is where the
  // thresholds fall on it, so the cuts do move: depth on the 4-bet bar, rake on the call floor.
  return { rows, callCut: cross(callFloorAt(env)), fourBetCut: cross(fourBetAt(env)) };
}

function solve3bet(model, state) {
  const K = CONSTANTS.vs3bet;
  const env = envOf(state);
  const nuCall = nuCallAt(env), nuOOP = nuOOPAt(env), fourBet = fourBetAt(env);
  // Rake moves the price and the floor together (`callFloorAt`). The 4-bet bar is left to depth
  // alone: it is a comparison against the villain's RANGE, not a price hero is being laid, and
  // raking it would be a second opinion where §3.2 asked for arithmetic. It costs nothing
  // measurable — 0.50/(1-0.05) = 0.5263 is inside the same 4.3-point gap the depth term measured.
  const price = breakevenPrice(env), callFloor = callFloorAt(env);
  const heroIP = state.pos === 'CO' || state.pos === 'BTN';
  const cuts = vs3betCuts(model, state.mix, env);
  const freq = new Map(cuts.rows.map((r) => [r.key, r.cumMid]));
  const out = {};
  for (const it of cellList(model)) {
    const c = it.cell;
    const row = it.key.split('|')[0];
    const em = eqMixOf(c, state.mix);
    const isAA = AA_ROWS.has(row);
    const dom = Math.round(c.dom);
    const reasons = [];
    let tier = 'T5';
    let dominated = false;

    if (dom >= K.domGate && !isAA && em < K.domGateEqEscape) {
      dominated = true;
      tier = 'T5';
    } else if (isAA && em >= fourBet) {
      tier = 'T1';
    } else if (em >= callFloor && (isAA || (c.nu >= nuCall && (heroIP || c.nu >= nuOOP)))) {
      // The `isAA` escape from the nut floors is A RUNG THIS LADDER DID NOT HAVE, and the depth
      // term on the 4-bet bar is what exposed the gap. Until v2 the bar was a constant 0.50 and
      // every AA-row cell measured at least 54.3% against the default mix, so no AA hand ever fell
      // through here and nobody had to decide what should happen. With the bar at 0.56 at 250bb,
      // three of them do — and without this escape they hit the nut floors, fail them
      // (AA-with-a-dangler is nu 0.22) and FOLD. Folding aces at 54% into a 29% price is not
      // defensible at any depth; the floors keep SPECULATIVE hands out of a 3-bet pot and AAxx is
      // the one row that is never speculative. Unreachable at the v1 operating point, so I22 is
      // untouched; reachable at a hand-edited mix, where it is also the right answer.
      tier = c.eq[0] < K.ambushEq1 * 100 ? 'T2' : 'T3';
    }
    // Declared uncertainty, in cumulative combo frequency — the same construction and the same
    // t4Band as the other three nodes (see solveUncached). A cell is MIX when it sits within the
    // band of a LIVE boundary: the call floor for every cell, and additionally the four-bet
    // threshold for the AA rows, the only rows that can reach T1 here.
    const cm = freq.get(it.key);
    const nearCall = cuts.callCut != null && Math.abs(cm - cuts.callCut) < CONSTANTS.t4Band;
    const nearFourBet = isAA && cuts.fourBetCut != null
      && Math.abs(cm - cuts.fourBetCut) < CONSTANTS.t4Band;
    const t4 = !dominated && (nearCall || nearFourBet);

    // ---- margin: the distance to the constraint that actually BINDS ----------------------------
    // Each clause the tier decision consulted, as a signed gap in its own unit, IN THE ORDER THE
    // DECISION CONSULTS THEM. The first failing clause is reported, so a folded cell can never
    // render a positive distance from a threshold it merely happened to clear, and the reported
    // unit (marginUnit/marginOf) says whether it is an equity gap or a nut gap.
    const gaps = [];
    if (dominated) gaps.push({ v: (em - K.domGateEqEscape) * 100, unit: 'eq pts', of: `the ${(K.domGateEqEscape * 100).toFixed(0)}% domination escape` });
    gaps.push({ v: (em - callFloor) * 100, unit: 'eq pts', of: `the ${(callFloor * 100).toFixed(0)}% call floor` });
    // An AA row's decision does not consult the nut floors (the isAA escape above), so they are not
    // among its gaps either. Before v2 they were pushed for every cell, and an AA row with a dangler
    // reported "18 nu points short of the 0.40 continue floor" on a cell the model was telling you
    // to FOUR-BET — the exact mis-attribution the paragraph above exists to prevent, surviving only
    // because nothing looked at an AA row's margin. Changes AA-row margins here and nothing else.
    if (!isAA) {
      gaps.push({ v: (c.nu - nuCall) * 100, unit: 'ν pts', of: `the ${nuCall.toFixed(2)} continue floor` });
      if (!heroIP) gaps.push({ v: (c.nu - nuOOP) * 100, unit: 'ν pts', of: `the ${nuOOP.toFixed(2)} out-of-position nut floor` });
    }
    // The 4-bet bar is a boundary only for an AA row that has already cleared it; an AA row that
    // merely calls has not FAILED the 4-bet bar, it simply is not a 4-bet, so it never binds.
    if (isAA && em >= fourBet) gaps.push({ v: (em - fourBet) * 100, unit: 'eq pts', of: `the ${(fourBet * 100).toFixed(0)}% 4-bet bar` });
    const firstFail = gaps.find((g) => g.v < 0);
    // A cell that clears everything reports the TIGHTEST thing it cleared, so a hand that scrapes
    // past a floor reads as close rather than comfortable.
    const bind = firstFail || gaps.reduce((a, b) => (a.v <= b.v ? a : b));
    const margin = bind.v;

    // ---- reasons: signed against the threshold the decision actually used -----------------------
    if (dominated) {
      reasons.push({ sign: -1, text: `dominated — ${dom} of your ranks live in their face-up range`, value: (em - K.domGateEqEscape) * 100 });
    }
    reasons.push({
      sign: em >= callFloor ? 1 : -1,
      text: `${(em * 100).toFixed(1)}% against the face-up mix vs the ${(callFloor * 100).toFixed(0)}% call floor`,
      value: (em - callFloor) * 100,
    });
    if (isAA) {
      // Same reason the nut floors are absent from `gaps`: an AA row is never held to them, so a
      // line about them would be describing a test that did not run.
      if (em < fourBet) reasons.push({ sign: 1, text: `aces are never held to the nut floors — at ${(em * 100).toFixed(1)}% into a ${(price * 100).toFixed(0)}% price this calls rather than 4-bets`, value: (em - fourBet) * 100 });
    } else if (c.nu < nuCall) reasons.push({ sign: -1, text: `nut potential ${c.nu.toFixed(2)} is below the ${nuCall.toFixed(2)} continue floor`, value: (c.nu - nuCall) * 100 });
    else if (!heroIP && c.nu < nuOOP) reasons.push({ sign: -1, text: `nut potential ${c.nu.toFixed(2)} clears the continue floor but not the ${nuOOP.toFixed(2)} needed out of position`, value: (c.nu - nuOOP) * 100 });
    else if (!heroIP) reasons.push({ sign: 1, text: `nut potential ${c.nu.toFixed(2)} is nutty enough to continue out of position`, value: (c.nu - nuOOP) * 100 });
    if (tier === 'T2') reasons.push({ sign: 1, text: `+EXPLOIT — vs an unknown 3-bettor this is a fold (${c.eq[0].toFixed(1)}% vs random)`, value: em * 100 - c.eq[0] });
    reasons.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    // The raw price is CONTEXT, appended unsigned after the ranking rather than competing in it.
    // Signing it against 0.29 was the old bug: 72% of combos measure 30-43%, so nearly every folded
    // cell carried a positive "beats the price" line and the panel argued against its own verdict.
    const ranked = reasons.slice(0, 3);
    ranked.push({
      sign: 0,
      text: `raw pot odds are ${(price * 100).toFixed(1)}% — the call floor sits ${((callFloor - price) * 100).toFixed(0)} points above them, because a 3-bet pot is played out of position over three streets`,
      value: 0,
    });

    out[it.key] = {
      action: tier, t4, score: em * 100, margin, marginOf: bind.of, marginUnit: bind.unit,
      eqMix: em, dom, dominated,
      cumMid: cm, callCut: cuts.callCut, fourBetCut: cuts.fourBetCut,
      reasons: ranked, rank: 0,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. solve — the whole pipeline for one (pos, node, v)
// ---------------------------------------------------------------------------
/**
 * @param {object} model the MODEL literal
 * @param {object} state { pos, node, v (fraction 0.25..0.90), limpers, raiserPos, mix }
 * @returns {{ cells:Object, order:string[], N:number, rawN:number, extrapolated:boolean,
 *             width:number, width3:number, nutShare:number, composition:Object }}
 */
// A small memo, because the ribbon and the entry-VPIP lookup each evaluate the whole pipeline at
// all 66 integer VPIP points, and the page re-solves the current state on every read. Keyed by the
// full state, so it can only ever return the answer the pipeline would have recomputed. Results are
// shared, not copied: treat a solve() result as read-only.
const SOLVE_MEMO = new Map();
const MEMO_CAP = 800;

export function clearSolveMemo() { SOLVE_MEMO.clear(); AGGR_MEMO.clear(); }

export function solve(model, state) {
  hydrate(model);
  const key = `${model.meta.hash ? model.meta.hash.slice(0, 8) : ''}|${state.pos}|${state.node}|${state.v}|`
    + `${state.limpers == null ? 2 : state.limpers}|${state.raiserPos || 'CO'}|${state.mix ? state.mix.join(',') : ''}`
    + `|${envKey(state)}`;
  const hit = SOLVE_MEMO.get(key);
  if (hit) return hit;
  const out = solveUncached(model, state);
  if (SOLVE_MEMO.size >= MEMO_CAP) SOLVE_MEMO.clear();
  SOLVE_MEMO.set(key, out);
  return out;
}

function solveUncached(model, state) {
  const total = model.meta.comboTotal;
  const node = state.node, pos = state.pos, v = state.v;
  const env = envOf(state);

  let cells, table = null, N = 2, rawN = 2, extrapolated = false;

  if (node === '3bet') {
    cells = solve3bet(model, state);
    const ordered = Object.keys(cells).sort((a, b) => cells[b].score - cells[a].score);
    ordered.forEach((k, i) => { cells[k].rank = i + 1; });
  } else {
    const opts = { limpers: state.limpers, raiserPos: state.raiserPos, env };
    const cur = aggressiveSet(model, pos, node, v, opts);
    table = cur.table; N = table.N; rawN = table.rawN; extrapolated = table.extrapolated;

    // 8a. positional nesting — union-cascade over the earlier seats of this node's chain.
    // Copied first: the per-position sets are memoised and must never be mutated in place.
    const active = new Set(cur.set);
    const chain = NEST_CHAIN[node];
    const ci = chain.indexOf(pos);
    if (ci > 0) {
      for (let i = 0; i < ci; i++) {
        for (const k of aggressiveSet(model, chain[i], node, v, opts).set) active.add(k);
      }
    }

    // 4. the exploit split: aggressive here but not at the reference table
    const vRef = model.meta.vpip.ref / 100;
    let refSet = new Set();
    if (Math.abs(v - vRef) > 1e-9) {
      const ref = aggressiveSet(model, pos, node, vRef, opts);
      refSet = ref.set;
      if (ci > 0) for (let i = 0; i < ci; i++) for (const k of aggressiveSet(model, chain[i], node, vRef, opts).set) refSet.add(k);
    } else {
      refSet = new Set(active);
    }

    const w = cur.w;
    const w3 = width3For(pos, node, v, state.limpers, env);
    const gate = N >= CONSTANTS.nutGate[2];
    const need = nuMin(N);
    const sCutAgg = scoreAtCut(table.rows, w);
    const sCut3 = w3 > 0 ? scoreAtCut(table.rows, w + w3) : null;

    cells = {};
    table.rows.forEach((r, i) => {
      const c = r.cell;
      let tier;
      let gated = false;
      if (active.has(r.key)) {
        tier = refSet.has(r.key) ? 'T1' : 'T2';
      } else {
        const passiveOk = w3 > 0 && r.cumMid < w + w3
          && (node !== 'limps' || c.nu >= CONSTANTS.limpNuMin)
          && (node !== 'raise' || N < 3 || c.nu >= CONSTANTS.raiseCallNuMin);
        const wouldBeAggr = r.cumMid < w;
        if (wouldBeAggr && gate && c.nu < need) { gated = true; tier = w3 > 0 ? 'T3' : 'T5'; }
        else if (passiveOk && !(gate && c.nu < need)) tier = 'T3';
        else tier = 'T5';
      }

      // The vs-Raise 3-bet construction is value-heavy and nutted, never a bluff shape. The floor is
      // a hard demotion, so it is carried with an explicit value whitelist rather than softened into
      // a score penalty (which would re-order cells everywhere else). BROADWAY_RUN is on it for the
      // same reason DBLPAIR_BIG is: AKQJ is a value 3-bet by any PLO standard, and the row's
      // combo-weighted nu lands under the floor only because the rainbow and suit-wasted columns
      // drag the mean down.
      if (node === 'raise' && (tier === 'T1' || tier === 'T2')) {
        const row = r.key.split('|')[0];
        if (!(c.nu >= CONSTANTS.nu3betMin || AA_ROWS.has(row)
              || row === 'DBLPAIR_BIG' || row === 'BROADWAY_RUN')) {
          tier = w3 > 0 && r.cumMid < w + w3 ? 'T3' : 'T5';
        }
      }

      // 6. declared uncertainty: within +/- t4Band of frequency of any live boundary.
      // T4 is an OVERLAY on the action tier, applied after the post-passes, never an action level
      // of its own — otherwise the monotonicity passes would erase MIX cells next to a CALL.
      const nearAgg = Math.abs(r.cumMid - w);
      const near3 = w3 > 0 ? Math.abs(r.cumMid - (w + w3)) : Infinity;
      const t4 = Math.min(nearAgg, near3) < CONSTANTS.t4Band;

      const nearestCut = nearAgg <= near3 ? sCutAgg : sCut3;
      const margin = r.S - nearestCut;

      cells[r.key] = {
        action: tier, t4, score: r.S, rank: i + 1, margin, gated,
        rho: r.rho, mnut: r.mnut, mplayF: r.mplay, R: r.R,
        cumMid: r.cumMid, reasons: [],
      };
    });

    // reason lines, generated from the model's own terms
    for (const r of table.rows) {
      const e = cells[r.key];
      e.reasons = whyLines(r, e, { pos, node, v, N, w, gate, need, model, env });
    }
  }

  // The action BEFORE the two cross-cell display post-passes. Recorded so that §5's "scored as-if
  // standalone" verdict — which has no neighbours and therefore cannot have an AA-band or suit
  // promotion applied to it — can be checked against the pipeline it claims to reproduce. Purely
  // additive: nothing below reads it, and no tier, score or margin moves.
  for (const k of Object.keys(cells)) cells[k].preDisplay = cells[k].action;
  postPasses(model, cells);
  // the MIX overlay goes on last, so wouldBe always names the action the model actually chose
  for (const k of Object.keys(cells)) {
    const e = cells[k];
    e.wouldBe = e.action;
    e.tier = e.t4 ? 'T4' : e.action;
  }

  // aggregates
  let aggrCombos = 0, aggrNu = 0, contCombos = 0;
  const composition = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 };
  for (const it of cellList(model)) {
    const e = cells[it.key];
    composition[e.tier] += it.combos;
    if (e.tier === 'T1' || e.tier === 'T2') { aggrCombos += it.combos; aggrNu += it.combos * it.cell.nu; }
    if (e.tier !== 'T5') contCombos += it.combos;
  }

  return {
    cells, N, rawN, extrapolated, env,
    // targetWidth is w_raise / w_3bet — the percentile the model AIMS at, and the number the
    // position sub-labels quote. width is what the grid actually paints after the nut gate has
    // demoted cells out of the aggressive range, so width <= targetWidth whenever the gate bites.
    targetWidth: node === '3bet' ? null : widthFor(pos, node, v, env),
    width: aggrCombos / total,
    continueWidth: contCombos / total,
    nutShare: aggrCombos ? aggrNu / aggrCombos : 0,
    composition,
    cutScore: table ? scoreAtCut(table.rows, widthFor(pos, node, v, env)) : null,
  };
}

/** the AA band, in the order the model asserts is a strength order */
const AA_BAND = ['AA_BIGPAIR', 'AA_BROADWAY', 'AA_CONNECTED', 'AA_SMALLPAIR', 'AA_DANGLER', 'A_BLOCKED'];

/**
 * Display post-passes. Both are enforcement, not emergence, and the UI says so:
 *  (a) AA-band row monotonicity — tier(AA_BIGPAIR) >= ... >= tier(A_BLOCKED). Enforced by promoting
 *      the EARLIER (stronger) row, so the pass can never fold a hand the raw scores wanted to play.
 *      The model brief states this ordering as an invariant; at cell granularity a few settings
 *      break it on raw score (AA + small pair briefly outscores AA + connectors at high N), so it
 *      is enforced the same way positional nesting and suit monotonicity are.
 *  (b) Suit monotonicity — adding suitedness never demotes, scanning RB -> FLAW -> SS -> SSA -> DS.
 */
function postPasses(model, cells) {
  for (const col of model.cols) {
    let prevKey = null;
    for (let i = AA_BAND.length - 1; i >= 0; i--) {
      const k = AA_BAND[i] + '|' + col.key;
      const e = cells[k];
      if (!e) continue;
      if (prevKey && TIER_RANK[e.action] < TIER_RANK[cells[prevKey].action]) {
        e.action = cells[prevKey].action;
        e.promoted = 'aa-band';
      }
      prevKey = k;
    }
  }
  const cols = model.cols.map((c) => c.key);
  for (const row of model.rows) {
    let prev = null;
    for (const col of cols) {
      const e = cells[row.key + '|' + col];
      if (!e) continue;
      if (prev && TIER_RANK[e.action] < TIER_RANK[prev.action]) { e.action = prev.action; e.promoted = 'suit'; }
      prev = e;
    }
  }
}

/**
 * Name the LARGEST M_play penalty this cell actually carries, rather than reciting the same three
 * causes everywhere. All but the residual is reconstructible from the shipped cells: the dangler
 * term (the biggest factor, and the whole penalty for 52% of penalised combos), trips and blocked
 * aces from the row key, nut-suited from the cell's share. The leftover mono / three-flush /
 * no-card-above-9 group is not carried per cell, so it is named by the column and no finer.
 */
function mplayCause(r) {
  const M = CONSTANTS.mplay;
  const row = r.key.split('|')[0], col = r.key.split('|')[1];
  const dang = Math.pow(M.dangler, r.cell.danglers || 0);
  const trips = (row === 'TRIPS_BIG' || row === 'TRIPS_SMALL') ? M.trips : 1;
  const blocked = row === 'A_BLOCKED' ? M.aBlocked : 1;
  const suited = Math.pow(M.nutSuited, r.cell.nutSuited || 0);
  const residual = r.mplay / (dang * trips * blocked * suited);
  const terms = [
    [dang, (r.cell.danglers || 0) >= 1.5 ? `${(r.cell.danglers).toFixed(1)} dangling cards on average`
      : `a dangler on ${((r.cell.danglers || 0) * 100).toFixed(0)}% of these hands`],
    [trips, 'trips block their own outs'],
    [blocked, 'the extra aces are dead cards'],
    [residual, col === 'FLAW' ? 'a third card of the suit is wasted' : 'no card above a nine'],
  ].filter((t) => t[0] < 0.999);
  if (!terms.length) return 'dead cards, wasted suits or no card above a nine';
  terms.sort((a, b) => a[0] - b[0]);
  return terms[0][1];
}

/** ranked, signed reason lines built from the multiplier terms that actually fired */
function whyLines(r, e, ctx) {
  const out = [];
  const S = r.S;
  const push = (sign, text, value) => out.push({ sign, text, value });

  const rhoTerm = r.rho;
  push(rhoTerm >= 1 ? 1 : -1,
    rhoTerm >= 1
      ? `equity ${(rhoTerm * 100 / (ctx.N + 1)).toFixed(1)}% is ${rhoTerm.toFixed(2)}x its fair share at ${ctx.N.toFixed(1)}-way`
      : `equity ${(rhoTerm * 100 / (ctx.N + 1)).toFixed(1)}% is only ${rhoTerm.toFixed(2)}x its fair share at ${ctx.N.toFixed(1)}-way`,
    (rhoTerm - 1) * 100);

  if (Math.abs(r.mnut - 1) > 0.005) {
    // Signed against nuBar, the normalisation ANCHOR — not the measured pool mean of 0.2954.
    // Calling 0.42 "the pool mean" told the 40% of combos between the two the opposite of the truth.
    push(r.mnut > 1 ? 1 : -1,
      r.mnut > 1
        ? `nut potential ${r.cell.nu.toFixed(2)} is above the model's ν reference ${CONSTANTS.nuBar.toFixed(2)} — scales into multiway pots`
        : `nut potential ${r.cell.nu.toFixed(2)} is below the model's ν reference ${CONSTANTS.nuBar.toFixed(2)} — loses value multiway`,
      S * (1 - 1 / r.mnut));
  }
  if (Math.abs(r.mplay - 1) > 0.005) {
    push(r.mplay > 1 ? 1 : -1, r.mplay > 1 ? 'ace-topped suited pair — the flushes it makes are the nuts'
      : `structural penalty — ${mplayCause(r)}`, S * (1 - 1 / r.mplay));
  }
  const env = envOf(ctx.env);
  const dE = env.dEff;
  const rBase = baseRealization(ctx.pos, dE);
  if (Math.abs(r.R - rBase) > 0.005 || Math.abs(rBase - 1) > 0.005) {
    push(r.R >= 1 ? 1 : -1,
      `realization ${r.R.toFixed(2)} at ${ctx.pos} with ${ctx.N.toFixed(1)} opponents`,
      S * (1 - 1 / r.R));
  }
  // The depth term, named only when it fires. At the v1 operating point M_deep is exactly 1, so
  // nothing is pushed and the reason list is byte-identical to v1's. Which HALF of M_deep is doing
  // the work is worth saying, because the two can disagree: nu is what you win, cooler what you
  // lose, and a hand can be nutty and cooler-prone at once.
  //   The depth quoted is the EFFECTIVE one, in preflop units: under a straddle 100bb of chips is
  // 50 units of stack, and the unit is what the scoring layer scored (§3.3).
  if (Math.abs(r.mdeep - 1) > 0.005) {
    const nuPart = lambda(dE) * (r.cell.nu - CONSTANTS.nuBar);
    const coolPart = r.cell.cooler == null ? 0 : -mu(dE) * (r.cell.cooler - CONSTANTS.depth.coolerBar);
    const deep = dE > CONSTANTS.depth.ref;
    const at = env.straddle ? `${dE} straddles` : `${dE}bb`;
    const text = Math.abs(coolPart) > Math.abs(nuPart)
      ? (coolPart < 0
        ? `coolers ${(r.cell.cooler * 100).toFixed(0)}% of the time it gets there — at ${at} that costs more than a bet`
        : `hard to cooler (${(r.cell.cooler * 100).toFixed(0)}%), which is worth less at ${at} than at 100`)
      : (nuPart > 0
        ? `nut potential ${r.cell.nu.toFixed(2)} is worth more at ${at} — deeper stacks pay the nuts`
        : `nut potential ${r.cell.nu.toFixed(2)} is worth ${deep ? 'less than the pot it now plays for' : 'less at ' + at + ' — short stacks pay raw equity'}`);
    push(r.mdeep > 1 ? 1 : -1, text, S * (1 - 1 / r.mdeep));
  }
  if (e.gated) {
    push(-1, `folded by nut gate (nu ${r.cell.nu.toFixed(2)} < ${ctx.need.toFixed(2)} required at ${ctx.N.toFixed(1)}-way)`, -Math.abs(e.margin) - 1e-6);
  }
  out.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return out.slice(0, 4);
}

/** the one-line verdict shown above the WHY block */
export function verdictLine(model, state, key, solved) {
  const e = solved.cells[key];
  if (!e) return '';
  const lab = TIER_LABELS[state.node];
  if (state.node === '3bet') {
    const em = e.eqMix != null ? (e.eqMix * 100).toFixed(1) : '?';
    if (e.tier === 'T2') return `+EXPLOIT — ${lab.T2}. Their range is face-up; vs an unknown 3-bettor this is a fold.`;
    if (e.tier === 'T1') return `${lab.T1} — ${em}% against their face-up mix, above the ${(fourBetAt(state) * 100).toFixed(0)}% 4-bet bar.`;
    if (e.tier === 'T3') return `${lab.T3} — ${em}% against their face-up mix, above the ${(callFloorAt(state) * 100).toFixed(0)}% call floor.`;
    if (e.tier === 'T4') return `MIX — this cell sits inside the model's uncertainty band around a live boundary. Either action is defensible.`;
    // A fold is stated against whatever actually bound it, never against the 29% raw price the
    // hand may well have cleared.
    return `FOLD — ${em}% against their face-up mix · ${Math.abs(e.margin).toFixed(1)} ${e.marginUnit || 'eq pts'} short of ${e.marginOf || 'the call floor'}.`;
  }
  const w = widthFor(state.pos, state.node, state.v, state);
  if (e.gated) {
    return `FOLD — nut gate: nu below the floor required at N_eff ${solved.N.toFixed(1)}. Would otherwise rank ${e.rank}/${Object.keys(solved.cells).length}.`;
  }
  if (e.tier === 'T2') {
    const entry = entryVpip(model, state, key);
    return `+EXPLOIT — enters the range at VPIP ${entry == null ? '?' : entry}. At a ${model.meta.vpip.ref}% table this is a fold.`;
  }
  if (e.tier === 'T1') return `${lab.T1} — ranks ${e.rank}/${Object.keys(solved.cells).length} · inside the top ${(w * 100).toFixed(1)}% cut.`;
  if (e.tier === 'T3') return `${lab.T3} — beyond the aggressive cut but inside the continue range.`;
  if (e.tier === 'T4') return `MIX — the model is not confident here: ${Math.abs(e.margin).toFixed(1)} score points from the boundary.`;
  return `FOLD — ranks ${e.rank}/${Object.keys(solved.cells).length}, outside the top ${(w * 100).toFixed(1)}% cut.`;
}

// ---------------------------------------------------------------------------
// 7. the tier ribbon: the full pipeline at every integer VPIP
// ---------------------------------------------------------------------------
/**
 * @returns {{ spans:string[], vs:number[], boundaries:Array, caption:string, text:string }}
 */
export function ribbon(model, state, key) {
  const lo = model.meta.vpip.min, hi = model.meta.vpip.max;
  const spans = [], vs = [];
  for (let p = lo; p <= hi; p++) {
    const s = solve(model, { ...state, v: p / 100 });
    spans.push(s.cells[key] ? s.cells[key].tier : 'T5');
    vs.push(p);
  }
  const lab = TIER_LABELS[state.node];
  const boundaries = [];
  for (let i = 1; i < spans.length; i++) {
    if (spans[i] !== spans[i - 1]) boundaries.push({ v: vs[i], from: spans[i - 1], to: spans[i], label: `${lab[spans[i - 1]]} → ${lab[spans[i]]} @ ${vs[i]}` });
  }
  // Built from the LAST boundary alone, the caption named the wrong low-end action for every cell
  // crossing more than one (286 of 2,465): RAISE -> MIX -> FOLD read as "MIX below".
  let caption;
  if (!boundaries.length) {
    caption = `${lab[spans[0]]} at every table VPIP from ${lo} to ${hi}.`;
  } else if (boundaries.length === 1) {
    const b = boundaries[0];
    caption = `${lab[b.to]} from VPIP ${b.v} upward. ${lab[b.from]} below.`;
  } else {
    const parts = [`${lab[spans[0]]} to VPIP ${boundaries[0].v - 1}`];
    for (let i = 0; i < boundaries.length; i++) {
      const to = i + 1 < boundaries.length ? boundaries[i + 1].v - 1 : hi;
      parts.push(`${lab[boundaries[i].to]} ${boundaries[i].v}${to > boundaries[i].v ? `–${to}` : ''}`);
    }
    caption = `${parts.join(', then ')}.`;
  }
  const text = `Tier by table VPIP: ` + boundaries.map((b) => b.label).join('; ') + (boundaries.length ? '.' : `${lab[spans[0]]} throughout.`);
  return { spans, vs, boundaries, caption, text };
}

/** first VPIP at which a cell is aggressive — used by the T2 exploit reason string */
export function entryVpip(model, state, key) {
  const lo = model.meta.vpip.min, hi = model.meta.vpip.max;
  for (let p = lo; p <= hi; p++) {
    const s = solve(model, { ...state, v: p / 100 });
    const t = s.cells[key] && s.cells[key].tier;
    if (t === 'T1' || t === 'T2') return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 8. derived teaching readouts (copy-level numbers, never model inputs)
// ---------------------------------------------------------------------------
export function derived(state, info) {
  const L = state.limpers == null ? 2 : state.limpers;
  // Quoted in PREFLOP UNITS, which is what makes every threshold scale-free. Straddled the unit is
  // 2bb, so the readout — the one place the page prints an absolute bb figure — multiplies by it;
  // `pot` stays in units, exactly so at unit 1. Copy-level simplification: the 2bb the straddler
  // posts is dead money this table does not add.
  const u = unitBB(state);
  let pot;
  if (state.node === 'rfi') pot = 3.5;
  else if (state.node === 'limps') pot = 3 * L + 2;
  else if (state.node === 'raise') pot = 2 * 3.5 + 1.5;
  else pot = 20.5;
  const potBB = u === 1 ? pot : pot * u;
  return {
    nEff: info.raw,
    nEffClamped: info.N,
    extrapolated: info.extrapolated,
    seeFlop: info.N,
    pot, unitBB: u, potBB,
    text: `N_eff ${info.raw.toFixed(2)} · ≈${info.N.toFixed(1)} see the flop · pot ≈${potBB.toFixed(1)}bb`,
  };
}

/** breakeven equity vs N opponents */
export function breakeven(N) { return 100 / (N + 1); }
