// gates I22 I32 — the tier-fixture regressions.
//
// READ-ONLY, both of them. `scripts/freeze-tiers.mjs` is the SOLE writer of
// data/tiers-v1.fixture.txt and data/tiers-v2.fixture.txt; nothing in this file may write either,
// and a re-freeze is the deliberate ceremony of V3-PLAN §0.4(c), never a gate repairing itself.
//
// I22 pins one operating point. I32 pins all twelve environment lanes of the §0.4 surface, and
// its third clause proves the succession rather than assuming it — v1's fixture must still be
// found verbatim inside the v2 artifact, diffed artifact-to-artifact with no pipeline between.

import { resolve, relative } from 'node:path';

import * as P from '../lib/policy.mjs';
import * as TF from '../lib/tier-fixture.mjs';
import * as TF2 from '../lib/tier-fixture-v2.mjs';
import { ROOT } from './_shared.mjs';

export const family = 'fixtures';
export const title = 'the frozen-tier regressions — v1 (I22) and the v3 legacy-lane identity (I32)';
export const ids = ['I22', 'I32'];

export function build(ctx) {
  const { model, opts, fast, G } = ctx;

  return {
    sections: [
    { ids: ['I22'], label: 'v1 tier reproduction', run: () => {
    // =======================================================================
    // I22 — the v1 reproduction gate.
    //
    // v2 adds a stack-depth axis, a rake slider, a straddle toggle and VPIP-filtered villains.
    // Each of them is allowed into the pipeline on one condition: at the v1 operating point —
    // depth 100bb, rake 0, straddle off, random villains — it must be the identity. This gate is
    // the enforcement. `data/tiers-v1.fixture.txt` holds the tier v1 painted on all 123 non-empty
    // cells at all 1,386 (node, position, integer VPIP) settings, both the action tier and the MIX
    // overlay, and the whole sweep must reproduce it character for character.
    //
    // Nothing here writes the fixture. `scripts/freeze-tiers.mjs` is the only writer and it
    // refuses to overwrite without --force, because a gate that regenerates its own expectation
    // asserts nothing. Cost is ~0.3 s of pure policy math — no Monte Carlo — so it stays cheap
    // enough to be permanent.
    const path = resolve(ROOT, opts.tierFixture || TF.FIXTURE_PATH);
    let fx = null, err = null;
    try { fx = TF.loadFixture(path); } catch (e) { err = e; }
    if (!fx) {
      const why = err && err.code === 'ENOENT'
        ? `no fixture at ${relative(ROOT, path)} — freeze one with: node scripts/freeze-tiers.mjs`
        : `fixture unreadable: ${err.message}`;
      G('I22', false, `v1 tier reproduction — ${why}`);
    } else {
      const d = TF.compareToFixture(model, fx, 4);
      const scope = `${d.total} settings x ${fx.cells.length} cells (${d.totalCells.toLocaleString()} tiers)`;
      const diag = `${d.settings}/${d.total} settings differ, ${d.cells} cell tiers` +
        (d.structural.length ? `; ${d.structural.join('; ')}` : '') +
        (d.examples.length ? `; e.g. ${d.examples.join(' | ')}` : '') +
        (d.cells > d.examples.length ? ` (+${d.cells - d.examples.length} more — node scripts/freeze-tiers.mjs --check)` : '');
      if (fast) {
        // The tier half of this gate compares a POLICY against a fixture computed from the shipped
        // 100k-trial equities. A --fast dataset is a different measurement — 10k trials, +/-0.5 pt
        // per cell — so the tiers it paints move for reasons that have nothing to do with the
        // policy drift I22 exists to catch (measured: 7.4% of tiers, from noise alone). Asserting
        // it here would paint the CI path red on every run and teach everyone to ignore the colour.
        // So on --fast data the gate asserts only the half that still means something — that the
        // cell set and the (node, position, VPIP) domain are unchanged — and reports the tier drift
        // as an observation rather than a claim. build.mjs refuses to ship --fast data anyway.
        G('I22', d.structural.length === 0,
          `v1 tier reproduction NOT ASSERTED on --fast data (10k-trial equities are a different ` +
          `measurement, not policy drift): ${d.settings}/${d.total} settings and ${d.cells} of ` +
          `${d.totalCells.toLocaleString()} tiers move. Structural domain unchanged: ${scope}` +
          (d.structural.length ? ` — ${d.structural.join('; ')}` : ''));
      } else {
        G('I22', d.ok,
          `v1 tiers reproduce exactly at the v1 operating point (${fx.operatingPoint}): ${scope} ` +
          `frozen ${fx.frozen} from model ${fx.modelHash.slice(0, 12)}` + (d.ok ? '' : ` — ${diag}`));
      }
    }
    } },

    { ids: ['I32'], label: 'v2 reproduction over the §0.4 environment surface', run: () => {
    // =======================================================================
    // I32 — the v2 reproduction gate. The LEGACY LANE, over the whole environment surface.
    //
    // I22 above pins one point: 100bb / rake 0 / straddle off / random villains. That was the
    // right shape for v2, whose every mechanism was a multiplier that is the identity there. It
    // is not the right shape for v3. v3 adds an EV mode, a vs-GTO colour mode, a skill dial, a
    // 3-bet sizing axis and a default-on villain profile, and every one of them will be read by
    // code that is ALREADY carrying a depth, a rake and a straddle. A gate that only watches
    // 100/0/off cannot see a v3 axis leaking into the raked, shallow, straddled path — which is
    // the path the product actually opens on (the page boots at the 5% preset).
    //
    // So I32 freezes the surface (V3-PLAN §0.4): 21 legal (pos, node) pairs x every integer v in
    // 25..90 x depth {40, 100, 250} x rake {0, preset} x straddle {off, on} x villain profile
    // OFF — 12 lanes, 16,632 settings, 2,045,736 tiers — and asserts that with every v3 axis at
    // its LEGACY setting the pipeline reproduces it bit for bit. The failure mode it is written
    // to catch is `envKey`'s own documented trap: a memo key that forgot a new axis, handing back
    // another environment's answer. That is a silent wrong answer, not a crash.
    //
    // SUCCESSION, PROVEN RATHER THAN ASSUMED. Lane `d100/r0/s0` IS the v1 operating point, so the
    // v1 fixture is inside this one — that is what §5.1 means by v1 identity being carried
    // transitively. The containment is not asserted by assertion: the third clause below diffs
    // the two frozen artefacts directly against each other, with no pipeline in the middle, so it
    // holds even on a day the pipeline is broken. And I22 keeps running above, unmodified. §5.1
    // retires the two together, never separately, and only at a calibration-forced re-freeze.
    //
    // Nothing here writes the fixture: `scripts/freeze-tiers.mjs --v2` is the only writer, and it
    // refuses to overwrite without --force. Cost is ~3.5 s of pure policy math, no Monte Carlo.
    const path32 = resolve(ROOT, opts.tierFixtureV2 || TF2.FIXTURE_PATH);
    let fx2 = null, err2 = null;
    try { fx2 = TF2.loadFixture(path32); } catch (e) { err2 = e; }
    if (!fx2) {
      const why = err2 && err2.code === 'ENOENT'
        ? `no fixture at ${relative(ROOT, path32)} — freeze one with: node scripts/freeze-tiers.mjs --v2`
        : `fixture unreadable: ${err2.message}`;
      G('I32', false, `v2 tier reproduction — ${why}`);
    } else {
      const d = TF2.compareToFixture(model, fx2, 4);
      const scope = `${d.lanes} environment lanes x ${d.total / d.lanes} settings x ` +
        `${fx2.cells.length} cells (${d.totalCells.toLocaleString()} tiers)`;

      // clause 3, computed whether or not the tier halves pass: the v1 fixture must still be
      // found, character for character, on the v2 fixture's v1-point lane.
      let contain = null, containWhy = '';
      try {
        contain = TF2.compareV1Containment(fx2, TF.loadFixture(resolve(ROOT, opts.tierFixture || TF.FIXTURE_PATH)));
      } catch (e) { containWhy = `the v1 fixture could not be read for the containment check: ${e.message}`; }
      const containOk = !!(contain && contain.ok);
      const containNote = contain
        ? (contain.ok
          ? `v1's ${contain.rows} settings reproduced verbatim on lane ${fx2.v1Point}`
          : `v1 containment BROKEN on lane ${fx2.v1Point}: ${contain.bad} settings differ` +
            (contain.problems.length ? ` — ${contain.problems.join('; ')}` : ''))
        : containWhy;

      const lanes = [...(d.byLane || new Map())].map(([k, n]) => `${k}:${n}`).join(' ');
      const diag = `${d.settings}/${d.total} settings differ, ${d.cells} cell tiers` +
        (d.structural.length ? `; ${d.structural.join('; ')}` : '') +
        (lanes ? `; by lane ${lanes}` : '') +
        (d.examples.length ? `; e.g. ${d.examples.join(' | ')}` : '') +
        (d.cells > d.examples.length ? ` (+${d.cells - d.examples.length} more — node scripts/freeze-tiers.mjs --v2 --check)` : '');

      if (fast) {
        // Same disarm as I22, for the same reason: the fixture is computed from the shipped
        // 100k-trial equities, and a --fast dataset is a different MEASUREMENT (10k trials,
        // +/-0.5 pt per cell), so the tiers it paints move for reasons that have nothing to do
        // with the axis leakage this gate exists to catch. The structural half — cell set, lane
        // set, domain, and the v1 containment, none of which depend on trial count — still
        // asserts. build.mjs refuses to ship --fast data anyway.
        G('I32', d.structural.length === 0 && containOk,
          `v2 tier reproduction NOT ASSERTED on --fast data (10k-trial equities are a different ` +
          `measurement, not axis leakage): ${d.settings}/${d.total} settings and ${d.cells} of ` +
          `${d.totalCells.toLocaleString()} tiers move. Structural surface unchanged: ${scope}; ${containNote}` +
          (d.structural.length ? ` — ${d.structural.join('; ')}` : ''));
      } else {
        G('I32', d.ok && containOk,
          `v2 tiers reproduce exactly on the legacy lane, over the whole §0.4 environment surface ` +
          `(${fx2.legacyState} · depth {40,100,250} x rake {0,${P.CONSTANTS.rake.preset}} x straddle {off,on}): ` +
          `${scope} frozen ${fx2.frozen} from model ${fx2.modelHash.slice(0, 12)}. I22 succession: ${containNote}` +
          (d.ok ? '' : ` — ${diag}`));
      }
    }
    } },
    ],
  };
}
