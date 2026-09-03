// payoff-model.mjs — THE P2 PAYOFF ESTIMATOR, BUILT AND NOT WIRED IN. V3-PLAN §3.2, §6, §14.1.
//
// =================================================================================================
// READ THIS FIRST: THIS MODULE IS DISABLED, ON PURPOSE, BY A MEASUREMENT
// =================================================================================================
//
// `ENABLED` is `false` and nothing imports this file but its own test. That is not an oversight and
// it is not a staging step — it is what spike S-B's verdict COSTS, spent rather than argued with.
//
// S-B graded the payoff estimator **C**: best held-out p95 7.21 pot-fraction points against a
// pre-registered Grade B/C edge of 5.0, with the cost side agreeing independently (the forms that
// came closest cost 1.5-5.1x the pipeline budget; the ones that fit the budget were the worst).
// V3-PLAN §3.6's Grade-C row therefore fires and §3.2's Measured block binds: **the stub payoff
// stays, P2 builds no payoff table, and the payoff half of P2 becomes a payoff CORRECTION at most.**
// §6's two estimator rows resolve to "not exercised in v3", §14.1 resolves to "no form wins; none is
// adopted", and I46's primacy question is answered "no" a fortiori.
//
// So this file exists to answer one question the plan leaves open — "worth shipping as a labelled
// `estimate` IF any consumer needs an spr axis, and worth cutting if none does" — with a built
// thing and a measured number instead of an opinion. THE ANSWER IS CUT, and the number is below:
// this correction reaches held-out p95 **16.71**, which is 3.3x the Grade B/C edge and twice S-B's
// own form 1. The reasons are decomposed cut-by-cut in `payoff-fit.mjs`'s header, every row under
// one declared selection rule, and one row dwarfs the rest: **7.07 of the 8.28 pt is the measured
// pairwise checkdown table** that §3.2's Grade-C descope does not build. The shape of the
// correction is not what is wrong with it.
//
// WHAT IS NOT HERE, and why:
//   * **form 2 is not built.** §3.2: "Do not build form 2 — 1.5x over budget at 600 deals/pair, a
//     trial count whose own se (2.69 pt) already exceeds the Grade A edge." It is not started here.
//   * **the stack-off knob does not exist.** It is form 2's knob (`jamT`/`bluffT`/`jamMult` on the
//     threshold policy). §6 says it must be anchored from S-B's sensitivity sweep or else gated,
//     flagged and badged `interpolated`; since form 2 is not built, the knob is never CREATED,
//     which is the one outcome that needs no flag at all.
//   * **no constant from this file enters `constants`.** Grade C ships no estimator, so no
//     estimator constant may reach the opinion layer, the Method view, or `data/model.json`.
//     `test/payoff-model.test.mjs` asserts that as a property of the source, not as a promise.
//   * **`payoff.mjs` is untouched.** The live source is still `'checkdown'` on every path. I35's
//     Grade-C label keys off that shipped datum and must keep rendering.
//
// =================================================================================================
// WHAT IT IS, WHEN IT IS TURNED ON
// =================================================================================================
//
// S-B's form 1 — pairwise checkdown plus a fitted realization curve — reduced to the inputs this
// repository actually ships, and re-fitted to S-B's own 300-point street simulation on S-B's own
// train/held-out split. `payoff-fit.mjs` is the fitter and its header carries the whole derivation:
// the five surviving design terms, the two that were dropped to make conservation an identity, the
// five that were dropped for want of a per-cell flop-equity dispersion, and what each cut cost in
// held-out p95. `payoff-reference.mjs` is the ground truth, transcribed so the fit is reproducible
// after the spike worktree is gone. `FIT` below is the fitter's output, frozen, and
// `test/payoff-model.test.mjs` re-derives every digit of it — a coefficient cannot be edited here
// without editing the measurement it came from.
//
// The accessor has the frozen four-argument shape and returns the amended SIX keys:
//
//     makePayoffModel(model)  ->  (cells, potSize, spr, opts) -> { ev, se, source, supported,
//                                                                  potMult, invShare }
//
// It reaches the checkdown baseline THROUGH `payoff.mjs`'s own accessor rather than reading
// `model.cells[k].eq` itself — §2's "consume payoffs only through this accessor", which is also why
// every argument-validation decision, the multiway door and the malformed-request fallbacks are the
// frozen ones rather than a second, quieter copy of them.
//
// FOUR IDENTITIES IT KEEPS EXACTLY, because a source is measured against the stub's standard:
//   spr 0      `g = spr/(spr + S0)` is 0, so `ev` is the checkdown answer to the last bit, and
//              `potMult === 1`, `invShare === 0` — I33(c) and its P2 zero-constant half, as
//              identities rather than "within MC error".
//   zero-sum   the `ev` design is antisymmetric under (A,B,ip) -> (B,A,not ip), so I33(b) holds
//              structurally. MEASURED over all 15,006 ordered live pairs x the spr sweep; see the
//              test, which pins the exact bound rather than assuming one.
//   pot floor  `potMult = 1 + 2*spr*w` with `w` in (0,1): >= 1 always, <= 1 + 2*spr (the node's pot
//              plus both stacks — there is no more money), and seat-invariant to 5.3e-15 because
//              the final pot does not know which seat is hero. THE CEILING IS NOW ASSERTED: I33(a)
//              carries it, on every source and every path, because the P2 red team shipped
//              `1 + 100*spr*w` past all 53 gates and all 515 tests. The clause it needed did not
//              exist; the prose that described it did.
//   split      `invShare = q * (potMult - 1)/potMult` with `q = 0.5 + 0.5*tanh(...)`: the two
//              seats' post-node investments add up to the post-node money, exactly — MEASURED at
//              one ulp over all 151,290 swept returns, 71.5% of them bit-exact, and asserted at
//              that bound rather than at a tolerance.
//
// WHAT IT DOES BETTER THAN THE STUB, measured, and it is not `ev`. The stub must return
// `potMult === 1` and `invShare === 0` because that is what checkdown IS. Against S-B's reference
// those identities are wrong by mean 3.98x and 38.7 pt respectively; this correction gets them to
// mean 0.51 and 3.39 pt — 7.8x and 11x better. `ev`, which is what the grade is about, improves by
// much less: held-out p95 24.39 (the accessor's own base) -> 16.71. If a consumer ever needs the bb
// conversion more than it needs the share, that asymmetry is the finding to start from.
//
// =================================================================================================
// THE ONE UNANCHORED NUMBER, FLAGGED PER §6
// =================================================================================================
//
// `S0`, the curve's shape knob — the stack depth at which half the realization effect has arrived.
// V3-PLAN §6's rule for a knob with no anchor is: gated, flagged, badged `interpolated`, never
// invented. It is selected here by a declared rule (grouped 5-fold CV on the training pairs only,
// averaged over eight groupings) and it is STILL not anchored, three ways measured:
//   * the CV objective moves 2.6 pt across the entire grid — less than this estimator's own se;
//   * the per-shuffle argmin ranges over {2, 6, 8, 12, 16}, i.e. the winner depends on the fold
//     shuffle and not on the data;
//   * the CV winner is not the held-out winner, and the rule is not allowed to reach back for it.
// `UNANCHORED` below carries that, and the test asserts the flag exists and that the knob reaches
// no shipped surface. Under Grade C the badge has nowhere to render, which is stated rather than
// quietly skipped: if this module is ever enabled, the badge is the first thing it owes.
//
// =================================================================================================
// WHAT IT COSTS THE ARTIFACTS: NOTHING
// =================================================================================================
//
// Node-only, imported by nothing, injected by nothing. `build.mjs` inlines `policy.mjs` and
// `taxonomy.mjs` and no third module, so `index.html` does not move by a byte and D6/D7 are
// untouched. There is deliberately NO memo in here — the closed form is about thirty flops, so a
// cache would cost more than it saves, and a payoff memo is exactly where the `envKey` docstring's
// trap gets sprung. The file's NAME is nonetheless inside I33 clause (g)'s `MEMO_SCOPE`, so the day
// somebody adds one, the live gate reads the key and fails if `opts.ip` and the model hash are not
// in it. That coverage was written into (g) at the P2 pre-stage before this file existed.

import { makePayoff } from './payoff.mjs';
import { evDesign, potDesign, featuresOf, potMultOf, investOf } from './payoff-fit.mjs';
import { REF_META } from './payoff-reference.mjs';

/**
 * THE FLAG. `false` because S-B graded C (V3-PLAN §3.2, §3.6, §14.1).
 *
 * Nothing reads it yet, which is the point: this module is not wired into `payoff()`, so there is
 * no switch for it to throw. It exists so that "disabled" is a value a test can assert and a reader
 * can find, rather than a fact about the import graph that a future edit could silently reverse.
 */
export const ENABLED = false;

/** `source` this module stamps when it answers. Never `'checkdown'`: it is not the stub, and I33's
 *  card-removal exemption and I35's Grade-C label both key off exactly this datum. */
export const SOURCE = 'model';

/**
 * The fitted spr window — DERIVED FROM THE REFERENCE, not typed beside it.
 *
 * S-B simulated spr {1, 4, 10} and nothing outside it, so the largest depth anybody simulated is
 * where interpolation stops and extrapolation would start. A request above it comes back
 * `supported:false` — flagged, with the number still on it, which is what the interface asks for.
 * spr 0 is INSIDE the window and needs no measurement: `g` is 0 there and the answer is the
 * checkdown identity.
 *
 * IT WAS `= 10` UNTIL THE P2 RED TEAM, and that is the whole story of this line. The sentence above
 * was true of the source and enforced by nothing: all three refuters set the window to 40, to 1000
 * and to `Infinity` — deleting the extrapolation guard outright, which is precisely what the
 * anchor exists to forbid — and watched all 515 tests and all 53 gates stay green, because the
 * identifier occurred nowhere outside this file and no assertion ever requested a point above the
 * window. Nothing distinguished 10 from `Infinity`. Reading the maximum out of `REF_META.sprs`
 * makes the anchor the value: the window cannot now disagree with the reference it describes,
 * because it IS the reference. `test/payoff-model.test.mjs` adds the other half the memos asked
 * for — the boundary probe, `supported:false` just above the edge with the number still on it,
 * armed against a source that clamps instead of flagging.
 */
export const SPR_MAX = Math.max(...REF_META.sprs);

/**
 * The unanchorable knob, flagged per V3-PLAN §6. `badge: 'interpolated'` is the badge it owes the
 * day anything renders it; under Grade C nothing does, and that is recorded rather than skipped.
 */
export const UNANCHORED = Object.freeze([Object.freeze({
  name: 'S0',
  value: 12,
  badge: 'interpolated',
  why: 'the realization curve\'s shape knob — the spr at which half the effect has arrived. It has '
    + 'no meaning outside the fit: selected by a declared grouped-CV rule on training pairs only, '
    + 'the CV objective moves 2.6 pt across the whole grid (less than the estimator\'s own se), the '
    + 'per-shuffle argmin ranges over {2, 6, 8, 12, 16}, and the CV winner is not the held-out '
    + 'winner. S-B measured the same from the other side: p95 26.31 -> 6.62 across its own grid at '
    + 'frozen coefficients.',
  gate: 'test/payoff-model.test.mjs re-derives it from payoff-reference.mjs by the declared rule, '
    + 'and asserts it reaches neither policy.mjs CONSTANTS nor data/model.json.',
  live: false,
})]);

/**
 * THE FIT, frozen — the output of `payoff-fit.mjs`'s `fit()` over `payoff-reference.mjs` and the
 * shipped model, to the digit. `test/payoff-model.test.mjs` recomputes it and deep-equals.
 *
 * `error` is in the natural unit of each quantity: pot-fraction POINTS for `ev` and `invShare`,
 * bare MULTIPLES for `potMult`. `disputed` is the `benchmarks.disputed` idiom — the held-out rows
 * this estimator disagrees with beyond the REFERENCE's own two sigma, shipped rather than
 * suppressed, worst first, with the full count beside the excerpt: 82 of 96.
 */
export const FIT = Object.freeze({
    "S0": 12,
    "ev": {
      "terms": [
        "x*g",
        "g*s",
        "g*dNu",
        "g*dCool",
        "g*dEq"
      ],
      "coef": [
        0.26208201478785575,
        0.2562448422645716,
        0.48124985824231375,
        -1.2329224791513997,
        0.5241640295825001
      ]
    },
    "potMult": {
      "terms": [
        "1",
        "g",
        "x*s",
        "x*g*s",
        "g*mNu",
        "g*mCool",
        "g*x*x"
      ],
      "coef": [
        1.5304568384962707,
        -4.818135959155784,
        8.039895886754866,
        -5.567341033381057,
        -1.4626539467840896,
        0.39433815287561985,
        5.766184761465605
      ]
    },
    "invShare": {
      "terms": [
        "x*g",
        "g*s",
        "g*dNu",
        "g*dCool",
        "g*dEq"
      ],
      "coef": [
        1.3092530025700402,
        0.20658315431369165,
        0.2361883976385734,
        -0.9754343871651919,
        2.618506005141527
      ]
    },
    "error": {
      "ev": {
        "train": {
          "mean": 5.1269,
          "p50": 3.7407,
          "p95": 14.1388,
          "max": 22.363,
          "bias": -1.9652,
          "rms": 6.772,
          "n": 204
        },
        "held": {
          "mean": 5.5751,
          "p50": 4.1256,
          "p95": 16.7143,
          "max": 23.7801,
          "bias": 0.2874,
          "rms": 7.5531,
          "n": 96
        },
        "all": {
          "mean": 5.2703,
          "p50": 3.8427,
          "p95": 16.6034,
          "max": 23.7801,
          "bias": -1.2444,
          "rms": 7.0314,
          "n": 300
        }
      },
      "evBase": {
        "held": {
          "mean": 9.4175,
          "p50": 7.953,
          "p95": 24.385,
          "max": 33.171,
          "bias": 1.4559,
          "rms": 11.9461,
          "n": 96
        },
        "all": {
          "mean": 8.9665,
          "p50": 7.812,
          "p95": 22.875,
          "max": 33.171,
          "bias": -1.341,
          "rms": 11.2265,
          "n": 300
        }
      },
      "potMult": {
        "train": {
          "mean": 0.4435,
          "p50": 0.2316,
          "p95": 1.483,
          "max": 3.0436,
          "bias": -0.0246,
          "rms": 0.6805,
          "n": 204
        },
        "held": {
          "mean": 0.6524,
          "p50": 0.2926,
          "p95": 2.1501,
          "max": 4.4929,
          "bias": 0.2679,
          "rms": 1.0889,
          "n": 96
        },
        "all": {
          "mean": 0.5103,
          "p50": 0.2488,
          "p95": 1.742,
          "max": 4.4929,
          "bias": 0.069,
          "rms": 0.8332,
          "n": 300
        }
      },
      "potMultStub": {
        "all": {
          "mean": 3.9813,
          "p50": 3.9755,
          "p95": 8.3009,
          "max": 10.8648,
          "bias": -3.9813,
          "rms": 4.6211,
          "n": 300
        }
      },
      "invShare": {
        "train": {
          "mean": 3.0011,
          "p50": 2.5225,
          "p95": 7.8439,
          "max": 18.9135,
          "bias": -0.6973,
          "rms": 4.0173,
          "n": 204
        },
        "held": {
          "mean": 4.23,
          "p50": 2.9007,
          "p95": 12.8488,
          "max": 15.3352,
          "bias": 1.5532,
          "rms": 5.7362,
          "n": 96
        },
        "all": {
          "mean": 3.3943,
          "p50": 2.6107,
          "p95": 10.3711,
          "max": 18.9135,
          "bias": 0.0229,
          "rms": 4.6372,
          "n": 300
        }
      },
      "invShareStub": {
        "all": {
          "mean": 38.6719,
          "p50": 38.9216,
          "p95": 55.4416,
          "max": 68.8059,
          "bias": -38.6719,
          "rms": 39.7634,
          "n": 300
        }
      },
      "bySpr": [
        {
          "spr": 1,
          "p95": 18.7311
        },
        {
          "spr": 4,
          "p95": 12.6114
        },
        {
          "spr": 10,
          "p95": 11.7027
        }
      ]
    },
    "disputed": {
      "n": 82,
      "of": 96,
      "worst": [
        {
          "a": "BROADWAY_RUN|RB",
          "b": "AA_BIGPAIR|DS",
          "spr": 1,
          "ip": true,
          "estimated": 41.04,
          "reference": 17.26,
          "refSe": 0.31
        },
        {
          "a": "BROADWAY_RUN|RB",
          "b": "AA_BIGPAIR|DS",
          "spr": 1,
          "ip": false,
          "estimated": 37.1,
          "reference": 17.23,
          "refSe": 0.16
        },
        {
          "a": "BROADWAY_RUN|RB",
          "b": "AA_DANGLER|RB",
          "spr": 1,
          "ip": false,
          "estimated": 43.54,
          "reference": 26.22,
          "refSe": 0.32
        },
        {
          "a": "AA_DANGLER|RB",
          "b": "ACE_JUNK|RB",
          "spr": 1,
          "ip": false,
          "estimated": 55.56,
          "reference": 72.58,
          "refSe": 0.43
        },
        {
          "a": "BROADWAY_RUN|RB",
          "b": "AA_DANGLER|RB",
          "spr": 10,
          "ip": false,
          "estimated": 31.95,
          "reference": 15.15,
          "refSe": 0.25
        },
        {
          "a": "BROADWAY_RUN|RB",
          "b": "AA_DANGLER|RB",
          "spr": 4,
          "ip": false,
          "estimated": 38.23,
          "reference": 21.52,
          "refSe": 0.32
        },
        {
          "a": "BROADWAY_RUN|RB",
          "b": "AA_DANGLER|RB",
          "spr": 1,
          "ip": true,
          "estimated": 47.48,
          "reference": 30.84,
          "refSe": 0.36
        },
        {
          "a": "BROADWAY_RUN|RB",
          "b": "AA_BIGPAIR|DS",
          "spr": 4,
          "ip": false,
          "estimated": 26.76,
          "reference": 12.8,
          "refSe": 0.22
        },
        {
          "a": "AA_BIGPAIR|DS",
          "b": "ACE_JUNK|DS",
          "spr": 1,
          "ip": false,
          "estimated": 57.97,
          "reference": 71.64,
          "refSe": 0.46
        },
        {
          "a": "AA_DANGLER|RB",
          "b": "RUN0_HIGH|DS",
          "spr": 10,
          "ip": true,
          "estimated": 59.03,
          "reference": 72.51,
          "refSe": 0.28
        },
        {
          "a": "AA_DANGLER|RB",
          "b": "ACE_JUNK|RB",
          "spr": 1,
          "ip": true,
          "estimated": 59.5,
          "reference": 72.89,
          "refSe": 0.42
        },
        {
          "a": "RUN0_LOW|DS",
          "b": "AA_BIGPAIR|DS",
          "spr": 10,
          "ip": true,
          "estimated": 40.66,
          "reference": 53.87,
          "refSe": 0.45
        }
      ]
    },
    "modelSe": 0.075531,
    "selection": {
      "S0": 12,
      "argminPerShuffle": [
        16,
        16,
        12,
        12,
        8,
        2,
        16,
        6
      ],
      "curve": [
        {
          "S0": 0.125,
          "meanP95": 17.5596,
          "minP95": 17.1096,
          "maxP95": 18.0932
        },
        {
          "S0": 0.25,
          "meanP95": 17.2478,
          "minP95": 16.65,
          "maxP95": 17.8154
        },
        {
          "S0": 0.5,
          "meanP95": 16.7562,
          "minP95": 16.1057,
          "maxP95": 17.3301
        },
        {
          "S0": 0.75,
          "meanP95": 16.3049,
          "minP95": 15.8912,
          "maxP95": 16.8483
        },
        {
          "S0": 1,
          "meanP95": 15.9254,
          "minP95": 15.4893,
          "maxP95": 16.4532
        },
        {
          "S0": 1.5,
          "meanP95": 15.6522,
          "minP95": 15.1756,
          "maxP95": 15.938
        },
        {
          "S0": 2,
          "meanP95": 15.8299,
          "minP95": 15.1202,
          "maxP95": 16.6295
        },
        {
          "S0": 3,
          "meanP95": 15.7698,
          "minP95": 15.0414,
          "maxP95": 16.5286
        },
        {
          "S0": 4,
          "meanP95": 15.6842,
          "minP95": 14.4774,
          "maxP95": 17.1415
        },
        {
          "S0": 6,
          "meanP95": 15.3591,
          "minP95": 14.1003,
          "maxP95": 16.6114
        },
        {
          "S0": 8,
          "meanP95": 15.1385,
          "minP95": 14.1301,
          "maxP95": 16.3975
        },
        {
          "S0": 12,
          "meanP95": 15.0025,
          "minP95": 14.3673,
          "maxP95": 16.1543
        },
        {
          "S0": 16,
          "meanP95": 15.053,
          "minP95": 14.5815,
          "maxP95": 16.022
        },
        {
          "S0": 24,
          "meanP95": 15.2872,
          "minP95": 14.8088,
          "maxP95": 15.9494
        },
        {
          "S0": 32,
          "meanP95": 15.484,
          "minP95": 14.9964,
          "maxP95": 16.1929
        }
      ]
    }
  });

/** one standard error on `ev`, in pot fractions: the held-out RMS deviation from the reference,
 *  derived from the 96 held-out points that actually ran at 20,000 deals a pair. It is 67.6x-74.2x
 *  the checkdown stub's own `se` — measured over all 15,006 ordered live pairs at spr 4, and
 *  corrected from "about 46x" by the P2 red team (docs/refutations/P2.md), which found that figure
 *  to be this se against a DIFFERENT one: §6's 0.1581 pt tier-EV se, not the per-pair `se` that
 *  `Math.hypot` below actually combines it with. That is the honest size of a Grade-C correction's
 *  error bar, and it is worse than the sentence used to admit. */
export const MODEL_SE = FIT.modelSe;

// ---------------------------------------------------------------------------
// the arithmetic
// ---------------------------------------------------------------------------

const dot = (d, c) => { let v = 0; for (let i = 0; i < d.length; i++) v += d[i] * c[i]; return v; };

/**
 * The two measured card-removal families, from I33 clause (h). Kept as a local copy DELIBERATELY:
 * `scripts/gates/` is verification code and a library may not import it, so the test imports the
 * gate's own `isDegeneratePair` and asserts the two agree on all 504 ordered pairs of the live
 * cells. A copy that is proved equal to the original every run is not a second opinion.
 */
export function isDegenerate(a, b) {
  const fam = (k) => (typeof k === 'string' ? k.split('|')[0] : '');
  const A = fam(a), B = fam(b);
  const aa = (f) => /^AA_/.test(f);
  return (aa(A) && aa(B)) || (aa(A) && B === 'A_BLOCKED') || (A === 'A_BLOCKED' && aa(B));
}

/**
 * Assemble the return, the six keys in the frozen order, with the same "a bad number never leaves
 * wearing supported:true" idiom `payoff.mjs`'s own `finish` uses — and, like it, RETURNING the bad
 * number rather than clamping it, so a gate can still see it.
 */
function finish(ev, se, supported, potMult, invShare) {
  const evOk = Number.isFinite(ev) && ev >= 0 && ev <= 1;
  const seOk = typeof se === 'number' && se > 0 && !Number.isNaN(se);
  const pmOk = Number.isFinite(potMult) && potMult >= 1;
  const isOk = Number.isFinite(invShare) && invShare >= 0 && invShare <= 1;
  return {
    ev,
    se: seOk ? se : Infinity,
    source: SOURCE,
    supported: !!supported && evOk && seOk && pmOk && isOk,
    potMult,
    invShare,
  };
}

/**
 * Bind the estimator to one model. Mirrors `makePayoff`'s shape exactly — arity 4, `.modelHash` —
 * so that the day `ENABLED` becomes true the swap is one line at one call site.
 *
 * The returned function is pure: same arguments and same model, same six numbers, no state.
 */
export function makePayoffModel(model) {
  const stub = makePayoff(model);
  const cells = model && model.cells ? model.cells : {};
  const S0 = FIT.S0;

  const fn = function payoffModel(cellKeys, potSize, spr, opts) {
    const under = stub(cellKeys, potSize, spr, opts);
    // Every out-of-domain decision is the FROZEN one: multiway, malformed arguments, unknown cells,
    // a bad seed. The stub already made it and already flagged it, and answering it again here
    // would be a second copy of the contract that could drift from the first.
    if (!under.supported) return under;

    const a = cellKeys[0], b = cellKeys[1];
    const ca = cells[a], cb = cells[b];
    const s = opts && opts.ip ? 1 : -1;
    const g = spr / (spr + S0);
    const f = featuresOf(ca, cb, under.ev);

    /* `0.5 + ((base - 0.5) + delta)` rather than `base + delta`, for the reason payoff.mjs
       rearranges its own projection: the design is antisymmetric term by term, so writing the
       answer as a displacement from the midpoint is what lets the two orderings sum to 1 to the
       last bit instead of to within a few ulps. The test measures the realised bound. */
    const raw = 0.5 + ((under.ev - 0.5) + dot(evDesign(f, g, s), FIT.ev.coef));
    const ev = Math.min(1, Math.max(0, raw));

    /* the pot geometry. `potMultOf`/`investOf` are `payoff-fit.mjs`'s — the SAME expression the
       fitter's residual table was computed from, imported rather than re-typed, because the P2 red
       team made this line return a final pot fifty times both stacks and watched `FIT.error.potMult`
       stay byte-identical: two copies meant the residuals certified the fitter's arithmetic and not
       the accessor's. `1 + 2*spr*w` is the game's arithmetic in pot-fraction units and not a fitted
       bracket: with the node's pot normalised to 1 and `spr` behind each player, the final pot
       cannot be less than 1 nor more than 1 + 2*spr. `w` in (0,1) is the only fitted part, and
       I33(a) now asserts the ceiling instead of describing it. */
    const w = 1 / (1 + Math.exp(-dot(potDesign(f, g, s), FIT.potMult.coef)));
    const potMult = potMultOf(spr, w);
    /* hero's share `q` of the post-node money, through an ODD function so the two seats' shares
       sum to 1 exactly and their investments therefore sum to the pot they built. Measured over all
       151,290 swept returns, that sum misses the post-node money by at most ONE ULP. */
    const q = 0.5 + 0.5 * Math.tanh(dot(evDesign(f, g, s), FIT.invShare.coef));
    const invShare = investOf(q, potMult);

    /* WHY A DEGENERATE PAIR IS FLAGGED HERE, when this file deals no cards. I33(h)'s exemption is
       keyed on `source === 'checkdown'`, and this is not that — but the deeper reason is that the
       exemption would be false anyway: the curve's COEFFICIENTS were fitted to REF3, which dealt
       boards and could not deal the impossible ones. S-B measured AA_DANGLER|RB x AA_BIGPAIR|DS
       degenerate on 12.56% of street evaluations. So this source inherits the reference's
       card-removal error on exactly those pairs and says so, which is what `supported:false` is
       for in a six-key return with no mass field.
       The spr bound is the other honest limit: above SPR_MAX the curve is extrapolating past every
       depth anybody simulated. Both keep the NUMBER and drop the claim. */
    const inWindow = spr <= SPR_MAX;
    const clean = !isDegenerate(a, b);
    const honest = Number.isFinite(raw) && raw >= 0 && raw <= 1;

    return finish(ev, Math.hypot(under.se, MODEL_SE), inWindow && clean && honest, potMult, invShare);
  };
  fn.modelHash = stub.modelHash;
  return fn;
}
