// The pool-skill axis, measured — the node-side half of V3-PLAN §3.4 (gates I37 and I38).
//
// WHY THIS FILE EXISTS AND WHY IT IS NOT `policy.mjs`. The dial itself is four lines of
// `policy.mjs` (`skillOf`, `poolVpip`, and the one call in `villainProfileOf`), because the whole
// design claim is that it is a COORDINATE CHANGE on the VPIP axis and adds no pathway. What is NOT
// four lines is the evidence: the width sweep, the vs-GTO divergence accounting, and the two
// enumerated exception records the gates re-derive every run. None of that ships in the page, so
// none of it belongs in the module that is inlined into it — `equilibrium.mjs` stands to
// `gates/baseline.mjs` in exactly this relation, and this file stands the same way to
// `gates/skill.mjs` and `test/skill.test.mjs`.
//
// THE TWO FROZEN RECORDS ARE THE POINT OF THE FILE. §7.2's I38 row says "per-cell exceptions
// enumerated, never tolerated away", and an allowance is what you write when you have not
// enumerated. So both exception sets are literals here, measured at P4 on the shipped model, and
// the gates fail on ANY difference in either direction — a new exception, a vanished one, a moved
// magnitude. That is strictly harsher than a tolerance and it is the only form under which the
// word "enumerated" means anything.

import * as P from './policy.mjs';

/**
 * The dial settings every sweep in this file walks.
 *
 * FIVE POINTS, NOT THREE: `constants.skill.detents` are the UI's stops and all three of them land
 * on measured lattice rows at the load default, which is exactly the set of settings least likely
 * to catch a badly-behaved interior. The two midpoints are here to be off-lattice — 47.5 and 32.5
 * from a lobby of 55 — so the interior is walked where the blend is actually interpolating and
 * where `villainEq` is actually labelling `interpolated`.
 */
export const SKILL_GRID = Object.freeze([0, 0.25, 0.5, 0.75, 1]);

/** The raiser the width sweep attributes a vs-Raise node to — `policy-sweep.mjs`'s own choice. */
export const SWEEP_RAISER = 'CO';

/**
 * The lobby VPIP: where the dial's `s = 0` endpoint sits, read out of the shipped lattice through
 * `villainLoadDefault` rather than typed. The page opens here (P1 barrier B1), so "the lobby
 * endpoint reproduces the current model exactly" is a claim about the state a reader actually sees.
 */
export function lobbyV(model) {
  const d = P.villainLoadDefault(model);
  return d.on ? d.v : null;
}

/** The 21 legal (position, node) pairs, in the sweep order `policy-sweep.mjs` uses. */
export function legalPairs(seats = 6) {
  const out = [];
  for (const node of P.NODES) {
    for (const pos of P.seatsFor(seats)) if (!P.positionDisabled(pos, node, seats)) out.push({ pos, node });
  }
  return out;
}

/**
 * The pools the dial resolves to, along the grid, from the lobby default.
 *
 * `pool.model` is the shadow, `pool.v` is the VPIP in `solve`'s unit; both come out of `poolAt`,
 * which is the one call the axis is meant to be used through.
 */
export function poolsAlong(model, grid = SKILL_GRID) {
  const v0 = lobbyV(model), q = (model.constants.villainLattice || {}).discipline;
  return grid.map((s) => {
    const pool = P.poolAt(model, { on: true, v: v0, q, skill: s });
    return { s, v0, v: pool.v, vPct: pool.profile.v, model: pool.model, profile: pool.profile };
  });
}

// ---------------------------------------------------------------------------
// I38's width accounting
// ---------------------------------------------------------------------------
/**
 * Painted combo-weighted width at every (pair, dial setting), plus the aggregate §7.2's I38 row
 * makes its claim about.
 *
 * THE AGGREGATE IS THE MEAN OVER THE 21 PAIRS, unweighted between pairs. Weighting pairs against
 * each other would need a frequency model for how often a seat is at a node, and this repository
 * has no such measurement — inventing one to average with would be a new opinion inside the gate
 * bounding an axis whose whole anchor is "no new opinion". Each pair's own number is already
 * combo-weighted, which is the weighting the claim names.
 */
export function widthTable(model, grid = SKILL_GRID, seats = 6) {
  const pools = poolsAlong(model, grid);
  const pairs = legalPairs(seats).map(({ pos, node }) => ({
    pos, node, key: `${pos}|${node}`,
    w: pools.map((p) => P.solve(p.model, { pos, node, v: p.v, limpers: 2, raiserPos: SWEEP_RAISER, seats }).width),
  }));
  const agg = grid.map((_, i) => pairs.reduce((a, r) => a + r.w[i], 0) / pairs.length);
  return { grid, pools, pairs, agg };
}

/**
 * THE FIRST FROZEN RECORD: every (pair) whose painted width is WIDER at full skill than at the
 * lobby — the endpoint exceptions to "combo-weighted width tightens with skill".
 *
 * MEASURED AT P4, AND THEY ARE ALL ONE THING. Six of the twenty-one pairs loosen, they are exactly
 * the six vs-3-Bet pairs, every one of them by the same 0.173 points, and the move is the same two
 * cells at all six: BROADWAY_RUN|SSA and BROADWAY_RUN|DS going T3 -> T2.
 *
 * WHY IT IS NOT A COUNTER-EXAMPLE TO THE CLAIM, stated rather than assumed away: at the vs-3-Bet
 * node T2 is `AMBUSH CALL` (see `TIER_LABELS`), so those two cells move from CALL to CALL. On the
 * baseline's three-level action scale — the scale the vs-GTO surface paints on — nothing moved at
 * all, which is why I37's divergence at `SB|3bet` is flat to the last digit across the whole dial.
 * What moved is `solve`'s `width`, which counts T1 and T2 as "aggressive mass" and is therefore
 * measuring a tier LABEL at this one node rather than an action. The record says so instead of the
 * gate quietly skipping the node the way I21 does.
 *
 * AND THE ROW IS THE PREDICTED ONE. §7.2's I37 prediction names BROADWAY_RUN and RUN0_HIGH as the
 * rows that misbehave as the pool tightens; the only cells in this record are BROADWAY_RUN.
 */
export const WIDTH_ENDPOINT_EXCEPTIONS = Object.freeze([
  'UTG|3bet', 'HJ|3bet', 'CO|3bet', 'BTN|3bet', 'SB|3bet', 'BB|3bet',
]);

/** The cells behind every one of them, and the tier move, re-derived by `widthProblems`. */
export const WIDTH_ENDPOINT_CELLS = Object.freeze(['BROADWAY_RUN|DS', 'BROADWAY_RUN|SSA']);
export const WIDTH_ENDPOINT_MOVE = Object.freeze({ from: 'T3', to: 'T2' });

/**
 * THE SECOND FROZEN RECORD: every (pair, step) at which the painted width goes UP as the dial
 * rises, inside the grid.
 *
 * MEASURED AT P4. Recorded as `pair@step` where step `i` is the move from `SKILL_GRID[i-1]` to
 * `SKILL_GRID[i]`. The endpoint record above is about the two ends; this one is about the path.
 *
 * WHAT CAUSES THEM, because a list with no mechanism behind it is a list that will be widened: the
 * nut gate. `solve` demotes a cell out of the aggressive range when `N >= nutGate[2]` and its `nu`
 * is under `nuMin(N)`, and `N` falls with the pool's VPIP — so at the step where `N` crosses the
 * gate's own threshold a block of cells stops being demoted and the painted width jumps UP even
 * though the target width fell. It is the same granularity effect I21's docstring records ("the
 * grid's quantum is a cell, and the largest single cell is 8.1% of all combos"), read along a
 * different axis. I21 answers it with a bounded dip allowance; §7.2's I38 row asks for enumeration
 * instead, so this is the enumeration, and the aggregate — which is what the row makes its claim
 * about — is monotone through all of it.
 *
 * MEASURED AT P4: ELEVEN, and six of them are the six vs-3-Bet pairs firing at the same step 1 —
 * the AMBUSH-CALL relabel of the endpoint record above, seen the moment it happens. The other five
 * are the nut-gate steps: UTG|rfi and HJ|rfi at step 1, BTN|rfi at step 2, BTN|limps at step 3,
 * HJ|limps at step 4.
 */
export const WIDTH_INTERIOR_EXCEPTIONS = Object.freeze([
  'UTG|rfi@1', 'HJ|rfi@1', 'BTN|rfi@2', 'BTN|limps@3', 'HJ|limps@4',
  'UTG|3bet@1', 'HJ|3bet@1', 'CO|3bet@1', 'BTN|3bet@1', 'SB|3bet@1', 'BB|3bet@1',
]);

/**
 * THE FIRST RECORD AT NINE SEATS — V4-PLAN §3's rule R5, measured at S2 over `legalPairs(9)`.
 *
 * THE PROCEDURE IS REPRODUCIBLE FROM THE DOCS, and that is R5's first question answered rather than
 * assumed: re-running METHODOLOGY §3.5's procedure at six seats — the five-point `SKILL_GRID`, the
 * `SWEEP_RAISER` attribution, `limpers: 2`, painted combo-weighted width, "wider at s = 1 than at
 * s = 0" — reproduces both six-seat arrays above EXACTLY, in order and in content
 * (`test/skill-9max.test.mjs` asserts that reproduction beside these). So R5's fallback ("if the
 * procedure is not reproducible, the new pairs ship WITHOUT exceptions") is NOT taken, and nothing
 * here is hand-typed or inferred from resemblance to a six-seat entry.
 *
 * NINE of the thirty-three pairs widen end to end, and they are again exactly the vs-3-Bet pairs —
 * now all nine seats of the ladder, through THE SAME two cells and the same tier move as at six
 * (`WIDTH_ENDPOINT_CELLS`, `WIDTH_ENDPOINT_MOVE`, re-derived at nine seats by `widthProblems`), by
 * the same 0.1729 points at every one of the nine. The reading is the six-seat one continued, which
 * is what the seat axis being inert at the shared seats predicts: at this node `nestChain` is empty,
 * so no seat's answer can depend on the seats in front of it.
 *
 * THE SWEEP READS NO RING. The largest `N_eff` anywhere in the nine-seat sweep is 4.995 against
 * `nMax(6)` = 7, so `eqAtSeats` / `rhoAtSeats` never leave the shipped `cells[*].eq` columns: this
 * record is measured on the shipped payload alone and depends on neither `data/ring.json` nor the
 * `vDelta` policyDelta that docs/spikes/V4-ladder.md files for lane R. It would have been
 * unmeasurable until S3 if the sweep's own settings reached past seven, and they do not.
 */
export const WIDTH_ENDPOINT_EXCEPTIONS_9 = Object.freeze([
  'UTG|3bet', 'UTG1|3bet', 'UTG2|3bet', 'LJ|3bet', 'HJ|3bet',
  'CO|3bet', 'BTN|3bet', 'SB|3bet', 'BB|3bet',
]);

/**
 * THE SECOND RECORD AT NINE SEATS — TWENTY (pair, step) interior rises, same `pair@step` spelling.
 *
 * MEASURED AT S2, and the mechanism is measured with them rather than carried over as a sentence:
 *
 *   NINE are the AMBUSH-CALL relabel of the endpoint record above, seen the moment it happens —
 *   every seat's `3bet@1`, each of them exactly `BROADWAY_RUN|SSA` and `BROADWAY_RUN|DS` going
 *   T3 -> T2 with `N` unmoved at 2.000. The same thing the six-seat record names, at nine seats.
 *
 *   ELEVEN are the granularity effect, and here is what it measures as: at every one of them `N`
 *   FALLS as the pool tightens (that is the axis working), the cut re-ranks, and one or two cells
 *   cross INTO the aggressive mass even though the target width fell — 35 crossing cells over the
 *   twenty steps, of which 9 are MIX cells whose T4 overlay stops straddling the cut and therefore
 *   start counting as aggressive mass again. At 4 of the 11 the falling `N` also crosses
 *   `nutGate[2]` = 3.0 (UTG+2|rfi@1, HJ|limps@4, BTN|limps@3, HJ|raise@2), so the nut gate switches
 *   off at that step; at the other 7 it does not. **The nut gate is therefore not the whole
 *   mechanism, and the six-seat record's "five nut-gate steps" sentence is the same overstatement
 *   read at six** — by this measurement 2 of those 5 steps cross the threshold (BTN|limps@3,
 *   HJ|limps@4) and 3 do not. Recorded, not patched: the six-seat arrays are frozen bit-for-bit and
 *   METHODOLOGY §3.5 owns the prose (S5's repair, docs/spikes/V4-skill.md).
 *
 * WHAT MOVED RELATIVE TO SIX SEATS, compared by LADDER POSITION (nine-max `i+3` against six-max
 * `i`, the embedding S1 measured the ladder identity under): four of the five six-seat non-3bet
 * rises survive at their own seat (HJ|rfi@1, BTN|rfi@2, BTN|limps@3, HJ|limps@4) and ONE DOES NOT —
 * six-max `UTG|rfi@1` maps to `LJ|rfi@1`, which does not rise at nine seats, because the nesting
 * post-pass unions LJ's rfi set with UTG/UTG+1/UTG+2's and the s = 0 width it starts from is
 * already 13.6049% rather than 13.4705%. An exception ERASED by the seat axis is as much a
 * measurement as one created by it. The three new shared-seat rises (HJ|raise@2, CO|raise@2,
 * BTN|raise@2) are the other side of the same post-pass: `nestChain('raise', 9)` runs UTG+1..BTN,
 * so those three seats gain unions at `raise` that six seats has no front seats to supply, and each
 * differs from its six-seat twin at exactly ONE dial setting (s = 0.5).
 */
export const WIDTH_INTERIOR_EXCEPTIONS_9 = Object.freeze([
  'UTG2|rfi@1', 'HJ|rfi@1', 'BTN|rfi@2',
  'UTG2|limps@3', 'LJ|limps@2', 'LJ|limps@3', 'HJ|limps@4', 'BTN|limps@3',
  'HJ|raise@2', 'CO|raise@2', 'BTN|raise@2',
  'UTG|3bet@1', 'UTG1|3bet@1', 'UTG2|3bet@1', 'LJ|3bet@1', 'HJ|3bet@1',
  'CO|3bet@1', 'BTN|3bet@1', 'SB|3bet@1', 'BB|3bet@1',
]);

/**
 * THE TWO RECORDS AT BOTH TABLE SIZES, KEYED BY (seats, pos, node) — V4-PLAN §2.6, R5.
 *
 * The six-seat entries above are UNTOUCHED, bit for bit, and keep their own exported names because
 * `scripts/gates/skill.mjs` and `test/skill.test.mjs` read them directly. What changed at S1 is
 * that they became reachable under a table size; what changed at S2 is that nine seats stopped
 * being `null` — the measurement has been taken, so the honest value is the measurement.
 *
 * WHICH TWELVE PAIRS ARE "NEW" HAS TWO ANSWERS AND THEY ARE NOT THE SAME TWELVE. Both are recorded
 * here because R5 is explicitly a rule about not missing pairs:
 *
 *   BY KEY — `legalPairs(9) \ legalPairs(6)` — is `UTG1`, `UTG2` and `LJ` at all four nodes.
 *     `UTG|rfi` and `UTG|3bet` are NOT in it: they are legal at six seats already, so
 *     `positionDisabled(…, 9)` does not "newly make them legal" in the literal sense R5's gloss
 *     uses.
 *   BY LADDER POSITION — the pairs at nine seats that the six-seat table does not already answer
 *     under the `i+3` embedding (six-max UTG..BB sits at nine-max LJ..BB, with the same
 *     `behindNonBlind`, `blindBehind` and `baseR`) — is V4-PLAN §3 R5's own enumeration:
 *     `UTG|{rfi,3bet}`, `UTG1|×4`, `UTG2|×4`, `LJ|{limps,raise}`.
 *
 * The two agree on the COUNT (12) and on `LJ|limps` / `LJ|raise`, and differ on exactly two pairs
 * each way: the key reading adds `LJ|{rfi,3bet}`, the position reading adds `UTG|{rfi,3bet}`. THE
 * POSITION READING IS THE ONE THAT DESCRIBES THE MEASUREMENT, and that is itself measured rather
 * than argued: over I38(e)'s 14,760 nine-seat readings the realization the pipeline uses differs
 * from the SEATS-BLIND `realization(pos, N, nu, d)` at exactly 5,535 of them, and those are exactly
 * the nine non-3bet pairs of the KEY reading — while the pair whose measurement is genuinely new
 * and whose key is old, `UTG|rfi`, is invisible to a seats-blind check because `baseR` is flat and
 * nine-max UTG reads the same 0.97 six-max UTG does. Neither reading may be used alone as "the
 * pairs to measure": the records below cover ALL 33 legal pairs, which is the only self-consistent
 * answer and is what `widthProblems` compares in both directions.
 */
export const WIDTH_EXCEPTIONS = Object.freeze({
  6: Object.freeze({ endpoint: WIDTH_ENDPOINT_EXCEPTIONS, interior: WIDTH_INTERIOR_EXCEPTIONS }),
  9: Object.freeze({ endpoint: WIDTH_ENDPOINT_EXCEPTIONS_9, interior: WIDTH_INTERIOR_EXCEPTIONS_9 }),
});
/** the frozen records at a table size, or `null` where nothing has been measured */
export function widthExceptionsFor(seats) { return WIDTH_EXCEPTIONS[seats] || null; }

/**
 * Re-derive both records and both monotonicity claims. Returns the problem lines; an empty array
 * is the gate passing.
 */
export function widthProblems(model, grid = SKILL_GRID, seats = 6) {
  const EX = widthExceptionsFor(seats);
  if (!EX) return [`the width exception records are UNMEASURED at ${seats} seats — see WIDTH_EXCEPTIONS`];
  const t = widthTable(model, grid, seats);
  const out = [];
  const EPS = 1e-12;

  // (i) the claim itself: the aggregate tightens, monotonically, over the whole grid
  for (let i = 1; i < t.agg.length; i++) {
    if (t.agg[i] > t.agg[i - 1] + EPS) {
      out.push(`the combo-weighted aggregate WIDENS from s=${grid[i - 1]} to s=${grid[i]}: `
        + `${(100 * t.agg[i - 1]).toFixed(4)}% -> ${(100 * t.agg[i]).toFixed(4)}%`);
    }
  }
  if (!(t.agg[t.agg.length - 1] < t.agg[0] - EPS)) {
    out.push(`the combo-weighted aggregate does not tighten across the dial: `
      + `${(100 * t.agg[0]).toFixed(4)}% -> ${(100 * t.agg[t.agg.length - 1]).toFixed(4)}%`);
  }

  // (ii) the endpoint exceptions, against the frozen list — both directions
  const endpoint = t.pairs.filter((r) => r.w[r.w.length - 1] > r.w[0] + EPS).map((r) => r.key);
  const wantE = EX.endpoint.join(' ');
  if (endpoint.join(' ') !== wantE) {
    out.push(`the endpoint exception set moved — measured [${endpoint.join(' ')}], recorded [${wantE}]`);
  }

  // (iii) the cells behind them, and the tier move, at every recorded pair
  //
  // `seats` IS THREADED HERE, and it has to be from the moment nine seats stops being `null`: the
  // two solves below are the ones that name the CELLS behind an endpoint exception, and a
  // seats-blind solve at `UTG1` reads `baseR['UTG1']` out of the six-seat object, gets `undefined`,
  // and realizes every cell at NaN — which does not throw, orders as if every cell were equal, and
  // would have reported whatever that produced as "the cells this pair loosens through".
  for (const key of endpoint) {
    const [pos, node] = key.split('|');
    const a = P.solve(t.pools[0].model, { pos, node, v: t.pools[0].v, limpers: 2, raiserPos: SWEEP_RAISER, seats });
    const b = P.solve(t.pools[t.pools.length - 1].model,
      { pos, node, v: t.pools[t.pools.length - 1].v, limpers: 2, raiserPos: SWEEP_RAISER, seats });
    const moved = Object.keys(a.cells).filter((k) => a.cells[k].action !== b.cells[k].action).sort();
    if (moved.join(' ') !== WIDTH_ENDPOINT_CELLS.join(' ')) {
      out.push(`${key} loosens through cells [${moved.join(' ')}], recorded [${WIDTH_ENDPOINT_CELLS.join(' ')}]`);
      continue;
    }
    for (const k of moved) {
      if (a.cells[k].action !== WIDTH_ENDPOINT_MOVE.from || b.cells[k].action !== WIDTH_ENDPOINT_MOVE.to) {
        out.push(`${key} ${k} moves ${a.cells[k].action}->${b.cells[k].action}, recorded `
          + `${WIDTH_ENDPOINT_MOVE.from}->${WIDTH_ENDPOINT_MOVE.to}`);
      }
    }
  }

  // (iv) the interior exceptions, against the frozen list — both directions
  const interior = [];
  for (const r of t.pairs) {
    for (let i = 1; i < r.w.length; i++) if (r.w[i] > r.w[i - 1] + EPS) interior.push(`${r.key}@${i}`);
  }
  const wantI = [...EX.interior].sort().join(' ');
  if ([...interior].sort().join(' ') !== wantI) {
    out.push(`the interior exception set moved — measured ${interior.length} `
      + `[${[...interior].sort().join(' ')}], recorded ${EX.interior.length} [${wantI}]`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// I37's divergence accounting
// ---------------------------------------------------------------------------
/**
 * How a model T2 reads on the baseline's three-level action scale, per node.
 *
 * A COPY OF THE PAGE'S JUDGEMENT, AND GATED AS ONE. `src/shell.html`'s `BASE.agg` resolves T2 from
 * its own `NODES` table — "T2 carries T1's label" means aggressive, otherwise it is the passive
 * level — because the baseline has no T2 of its own to compare against. This is that rule with the
 * page's answers precomputed, so the gate can measure the same divergence the surface paints
 * without executing the page; I37(e) re-reads the table out of `src/shell.html` and fails if the
 * two ever disagree. `policy.mjs`'s own `TIER_LABELS` cannot be used for this: it spells T2 as
 * "RAISE (exploit)" where the page spells it "RAISE", so deriving from it would silently flip
 * every RFI reading to the passive level.
 */
export const T2_AT = Object.freeze({ rfi: 1, limps: 3, raise: 1, '3bet': 3 });

/** A tier on the baseline's scale: fold 0, call 1, raise 2. `null` node = the baseline's own tiers. */
export function actionLevel(tier, node) {
  let n = +String(tier).slice(1) || 5;
  if (n === 2) n = node == null ? 1 : T2_AT[node];
  if (n === 4) n = 3;
  return (5 - n) / 2;
}

/** The (pos, node, raiser) triples the shipped baseline actually covers, read off the block. */
export function coveredNodes(bt) {
  return Object.keys(bt.nodes).map((k) => {
    const [pos, node] = k.split('|');
    return { key: k, pos, node, raiser: bt.nodes[k].raiser || null };
  });
}

/** The baseline's expected action level for one cell at one node, on its own weights. */
export function baselineLevel(bt, nodeKey, cell) {
  const nd = bt.nodes[nodeKey];
  const j = bt.order.indexOf(cell);
  if (!nd || j < 0) return null;
  const N = nd.actions.length;
  let b = 0;
  for (let a = 0; a < N; a++) b += nd.w[j * N + a] * bt.quant * actionLevel(nd.tierOf[nd.actions[a]], null);
  return b;
}

/**
 * The signed vs-GTO divergence, per covered node and per cell, along the dial.
 *
 * THE COMPARAND IS THE RAW MODEL TIER (`preDisplay`), which is P3's own display decision (§14 item
 * 4, I36): the two post-passes are impositions, the shipped baseline violates suit monotonicity in
 * 7 of its 369 readings, and scoring a post-passed tier against an equilibrium would book the
 * model's own enforcement as agreement. Reading it any other way here would measure a different
 * quantity from the one the page paints.
 */
export function divergenceTable(model, grid = SKILL_GRID) {
  const bt = model.baselineTiers;
  const pools = poolsAlong(model, grid);
  const nodes = coveredNodes(bt).map((nd) => {
    const solves = pools.map((p) => P.solve(p.model,
      { pos: nd.pos, node: nd.node, v: p.v, limpers: 2, raiserPos: nd.raiser || SWEEP_RAISER }));
    const cells = [];
    let mass = 0;
    const signed = grid.map(() => 0);
    for (const key of bt.order) {
      const b = baselineLevel(bt, nd.key, key);
      const c = model.cells[key];
      if (b == null || !c || !c.combos) continue;
      const d = solves.map((s) => actionLevel(s.cells[key].preDisplay || s.cells[key].action, nd.node) - b);
      cells.push({ key, base: b, d, combos: c.combos });
      mass += c.combos;
      for (let i = 0; i < grid.length; i++) signed[i] += c.combos * d[i];
    }
    return { ...nd, cells, mass, signed: signed.map((x) => x / mass) };
  });
  return { grid, pools, nodes };
}

/**
 * THE THIRD FROZEN RECORD: every (node, cell) whose distance from the equilibrium GROWS as the
 * dial rises — the counter-examples to §7.2's "per-cell convergence toward equilibrium as the skill
 * dial rises".
 *
 * MEASURED AT P4: 29 of 369 readings, and §7.2's PREDICTION LANDS. The row that violates most is
 * BROADWAY_RUN (8 of its 12 readings), RUN0_HIGH is next by rate (3 of 6), and the junk row the
 * prediction says will NOT be the culprit contributes exactly one (TRASH|DS). The prediction is
 * recorded as CORROBORATED rather than quietly absorbed, and the record is a literal so that a
 * regeneration which moves one of them has to say so.
 *
 * Stored as `nodeKey cell` pairs, sorted, one per line's worth of meaning.
 */
export const CONVERGENCE_VIOLATIONS = Object.freeze([
  'SB|rfi ACE_RUN3|SSA', 'SB|rfi BROADWAY_RUN|DS', 'SB|rfi BROADWAY_RUN|FLAW',
  'SB|rfi BROADWAY_RUN|SS', 'SB|rfi BROADWAY_RUN|SSA', 'SB|rfi RUN0_HIGH|DS',
  'SB|rfi RUN0_LOW|RB', 'SB|rfi RUN2|SS', 'SB|rfi SMPAIR_ACE|FLAW', 'SB|rfi SMPAIR_ACE|SS',
  'BB|raise ACE_JUNK|SSA', 'BB|raise ACE_RUN3|DS', 'BB|raise ACE_RUN3|SSA',
  'BB|raise BIGPAIR_ACE|RB', 'BB|raise BIGPAIR_CONN|FLAW', 'BB|raise BIGPAIR_CONN|RB',
  'BB|raise BIGPAIR_JUNK|FLAW', 'BB|raise BIGPAIR_JUNK|RB', 'BB|raise BROADWAY_RUN|DS',
  'BB|raise BROADWAY_RUN|FLAW', 'BB|raise BROADWAY_RUN|SS', 'BB|raise BROADWAY_RUN|SSA',
  'BB|raise DBL_CONNECTOR|SSA', 'BB|raise RUN0_HIGH|DS', 'BB|raise RUN0_HIGH|SS',
  'BB|raise RUN2|SS', 'BB|raise RUN3|SSA', 'BB|raise SMPAIR_ACE|FLAW', 'BB|raise TRASH|DS',
]);

/** The rows §7.2's I37 prediction names, and what they must keep doing for it to stand. */
export const PREDICTED_ROWS = Object.freeze(['BROADWAY_RUN', 'RUN0_HIGH']);

/** Re-derive the convergence violations and the prediction's standing. */
export function convergenceProblems(model, grid = SKILL_GRID) {
  const t = divergenceTable(model, grid);
  const out = [];
  const EPS = 1e-12;
  const found = [];
  for (const nd of t.nodes) {
    for (const c of nd.cells) {
      const a = c.d.map(Math.abs);
      if (a.some((x, i) => i > 0 && x > a[i - 1] + EPS)) found.push(`${nd.key} ${c.key}`);
    }
  }
  const want = [...CONVERGENCE_VIOLATIONS].sort().join('\n');
  if ([...found].sort().join('\n') !== want) {
    const extra = found.filter((x) => !CONVERGENCE_VIOLATIONS.includes(x));
    const gone = CONVERGENCE_VIOLATIONS.filter((x) => !found.includes(x));
    out.push(`the convergence-violation record moved: ${found.length} measured against `
      + `${CONVERGENCE_VIOLATIONS.length} recorded`
      + (extra.length ? ` · new [${extra.join(', ')}]` : '')
      + (gone.length ? ` · gone [${gone.join(', ')}]` : ''));
  }
  // the prediction, checked rather than quoted: the two named rows must still lead by rate
  const rate = {};
  for (const nd of t.nodes) {
    for (const c of nd.cells) {
      const row = c.key.split('|')[0];
      rate[row] = rate[row] || { n: 0, bad: 0 };
      rate[row].n++;
      if (found.includes(`${nd.key} ${c.key}`)) rate[row].bad++;
    }
  }
  const ranked = Object.keys(rate).filter((r) => rate[r].bad > 0)
    .sort((a, b) => (rate[b].bad / rate[b].n) - (rate[a].bad / rate[a].n) || rate[b].bad - rate[a].bad);
  // The prediction is asserted, not quoted. §7.2 says the rank-overlap rows violate and "move most
  // as the pool tightens, NOT the junk rows", so what has to hold is an ORDERING: those two rows
  // lead by violation rate. Measured at P4 they are exactly the top two — BROADWAY_RUN 8 of 15
  // readings, RUN0_HIGH 3 of 12 — and TRASH, the junk row, is 1 of 12 and eighth. If that ordering
  // ever flips the prediction is owed a re-measurement rather than a silent pass.
  const top = ranked.slice(0, PREDICTED_ROWS.length).sort().join(' ');
  if (top !== [...PREDICTED_ROWS].sort().join(' ')) {
    out.push(`§7.2's I37 prediction names [${[...PREDICTED_ROWS].sort().join(' ')}] as the rows that `
      + `violate monotone convergence most; measured, the top ${PREDICTED_ROWS.length} by rate are `
      + `[${top}] — the prediction has moved and is owed a re-measurement`);
  }
  const junk = rate.TRASH ? rate.TRASH.bad / rate.TRASH.n : 0;
  for (const row of PREDICTED_ROWS) {
    const r = rate[row] ? rate[row].bad / rate[row].n : 0;
    if (!(r > junk)) {
      out.push(`${row} violates at ${(100 * r).toFixed(1)}% against the junk row TRASH's `
        + `${(100 * junk).toFixed(1)}% — "not the junk rows" no longer describes the measurement`);
    }
  }
  return { problems: out, found, rate, ranked, table: t };
}

/**
 * §7.2's OTHER I37 CLAUSE — "signed vs-GTO divergence combo-weighted ~ 0 at pool = baseline" — and
 * whether the shipped payload can carry it at all.
 *
 * IT CANNOT, AND THIS RETURNS THE READINESS RATHER THAN A VERDICT, on the I15 / I36-nesting
 * precedent: a clause scoped to what was measured, never toleranced into a pass, and armed to FAIL
 * the day its reason stops being true.
 *
 * THE REASON, MEASURED. "pool = baseline" is a setting of the pool dial, so the clause needs the
 * baseline's own entry frequency to lie inside the dial's reach. P3 solved a HEADS-UP tree with the
 * SB on the button, and that SB OPENS 88.85% of combos — LOOSER than the lobby's 55, so the setting
 * lies on the loosen side of the axis, which is the plays-better half Grade C does not build (§3.6).
 * The gap is 33.85 points and the two frequencies do not even share a denominator (combos here,
 * suit-isomorphism classes on the lattice), which is worth saying and is not worth arguing about at
 * this distance. Underneath it is a seat mismatch rather than a dial-range accident: the baseline's
 * SB is the BUTTON and is in position postflop, while the model's SB is a six-max small blind out
 * of position (`baseR.SB` = 0.90, the worst seat in the table), so no pool setting brings a 33.6%
 * opening range onto an 88.85% one.
 *
 * `measurable` flips the day a shipped baseline's entry frequency lands at or below the lobby, and
 * the gate fails from that day until the clause is given a real measurement.
 */
export function reachReadiness(model) {
  const bt = model.baselineTiers;
  const v0 = lobbyV(model), floor = P.CONSTANTS.skill.vFloor;
  // the opening node: the one whose action set is exactly fold/raise
  const open = coveredNodes(bt).find((nd) => {
    const a = bt.nodes[nd.key].actions;
    return a.length === 2 && a.indexOf('fold') >= 0 && a.indexOf('raise') >= 0;
  });
  if (!open) return { measurable: false, why: 'the shipped baseline has no opening node to read an entry frequency from' };
  const nd = bt.nodes[open.key], N = nd.actions.length, fi = nd.actions.indexOf('fold');
  let enter = 0, mass = 0;
  bt.order.forEach((key, i) => {
    const c = model.cells[key];
    if (!c || !c.combos) return;
    mass += c.combos;
    for (let a = 0; a < N; a++) if (a !== fi) enter += c.combos * nd.w[i * N + a] * bt.quant;
  });
  const entry = 100 * enter / mass;
  return {
    measurable: entry <= v0,
    node: open.key, entry, lobby: v0, floor, gap: entry - v0,
    reach: [floor, v0],
    why: `the baseline's ${open.key} entry frequency is ${entry.toFixed(2)}% of combos, ${(entry - v0).toFixed(2)} `
      + `points LOOSER than the lobby ${v0} and outside the fold-more dial's reach [${floor}, ${v0}] — `
      + `"pool = baseline" sits on the plays-better side of the axis, which Grade C does not build`,
  };
}

/**
 * The interior blend, recomputed from the spelling `constants.skill.blend` publishes.
 *
 * NOT DECORATION: the P1 red team shipped a page publishing `sqrt(beta)*log(d)` for a formula the
 * code does not run, and I42(f)/I44(f) are the answer. Same idiom — the gate evaluates the
 * published sentence and compares it to the function, at interior settings where neither early
 * return is in the way.
 */
export function blendSpelling() { return `v + s*(vFloor - v)`; }
export function blendValue(v, s) { return v + s * (P.CONSTANTS.skill.vFloor - v); }
