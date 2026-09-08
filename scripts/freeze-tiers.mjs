#!/usr/bin/env node
// freeze-tiers.mjs — rewrite a tier baseline. A DELIBERATE MANUAL ACT, never part of a build.
//
//   node scripts/freeze-tiers.mjs [data/model.json] [--v2|--v3|--seats9] [--out=path] [--force] [--check]
//
//     (no flags)  writes the fixture only if it does not exist yet
//     --v2        act on the v2 fixture (gate I32) instead of the v1 one (gate I22)
//     --v3        act on the v3 DEFAULT fixture — the villain-profile-ON surface the page loads
//                 into after item 8's B1 flip (V3-PLAN §5.1's third fixture)
//     --seats9    act on the 9-MAX fixture (gate I49) — the same default surface at `seats = 9`
//                 (V4-PLAN §2.5). The file does not exist before the v4 run; creating it is stage
//                 S3's ceremony, performed once, in the open.
//     --check     re-runs the pipeline and prints the diff against the current fixture; writes
//                 nothing (this is what the gate asserts, in a form you can read)
//     --force     overwrites an existing fixture, after printing exactly what changes
//
// THE FOUR BASELINES.
//
//   v1 / I22 — `data/tiers-v1.fixture.txt`. At the v1 operating point — depth 100bb, rake 0,
//   straddle off, random villains — the pipeline paints the tier v1 painted, on every cell, at
//   every (node, position, integer VPIP). 1,386 settings.
//
//   v2 / I32 — `data/tiers-v2.fixture.txt`. The same claim over the whole ENVIRONMENT SURFACE
//   (V3-PLAN §0.4): 12 lanes of depth {40,100,250} x rake {0,preset} x straddle {off,on}, villain
//   profile OFF, with every v3 axis at its legacy setting. 16,632 settings. Lane `d100/r0/s0` is
//   the v1 operating point, so v1 identity lives inside it transitively — and I22 keeps running
//   beside I32 (§5.1), because succession is proven, not assumed.
//
//   v3 / no gate — `data/tiers-v3-default.fixture.txt`. The SAME 12 lanes with the villain profile
//   ON, which is the state the page opens in after the B1 default flip. V3-PLAN §5.1 asks for this
//   fixture "alongside, not replacing, the v2 fixture" and for the tier diff to be committed into
//   METHODOLOGY; writing it prints that diff, taken between the two frozen files. §7.2 reserves no
//   gate id for it, so it is pinned under `node --test` instead of inventing one — the same call
//   `test/manifest.test.mjs` makes, for the same reason.
//
//   9max / I49 — `data/tiers-9max.fixture.txt`. The SAME 12 lanes and the same profile-ON state as
//   the v3-default fixture, at `seats = 9`: 33 legal (position, node) pairs x 66 VPIP x 12 lanes =
//   26,136 settings (V4-PLAN §2.5; the 33 is measured and confirms the plan's prediction exactly).
//   UNLIKE the v3-default fixture it TAKES A GATE, and the divergence is deliberate: §5 reserved
//   I49 *before* the fixture existed, which is the condition `tier-fixture-v3.mjs`'s header names
//   as the thing it could not claim. The freeze prints the SUB-LADDER DIFF against the v3-default
//   file — the evidence gate I50 is scored on.
//
// A gate is only worth anything while the fixture is older than the code it judges, so nothing
// automatic may write these files: not verify.mjs, not generate-data.mjs, not build.mjs. If you
// are running this with --force, you are asserting that a tier moved *and that it was supposed
// to*. Say why in the commit message; the fixture diff is the evidence.
//
// `--force` IS NOT AUTHORISED ANYWHERE IN THE v4 RUN (V4-PLAN §0.4: option (c), a deliberate
// re-freeze, is forbidden this run). The three legacy fixtures must show as UNMODIFIED and
// `data/tiers-9max.fixture.txt` as ADDED across the whole run's commit range — that is gate
// I48(a), which reads the shape of the diff rather than grepping a log, because `--force` is a CLI
// flag and never appears in a commit message.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as TF from './lib/tier-fixture.mjs';
import * as TF2 from './lib/tier-fixture-v2.mjs';
import * as TF3 from './lib/tier-fixture-v3.mjs';
import * as TF9 from './lib/tier-fixture-9max.mjs';
import * as P from './lib/policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

// ---------------------------------------------------------------------------
// the three baselines, behind one interface. `build` returns everything the writer and the scope
// line need; `compare` is the same function the gate (or, for v3, the test) calls; `report` is the
// optional ceremony evidence a freeze owes the reader.
// ---------------------------------------------------------------------------
const KINDS = {
  v1: {
    gate: 'I22',
    what: 'v1 tier reproduction',
    path: TF.FIXTURE_PATH,
    load: (text) => TF.parseFixture(text),
    compare: (model, fx, n) => TF.compareToFixture(model, fx, n),
    build(model, generated) {
      const cells = TF.fixtureCells(model);
      const settings = TF.fixtureSettings(model);
      const sweep = TF.sweepTiers(model, cells, settings);
      return {
        cells, sweep,
        text: TF.encodeFixture({ model, cells, sweep, generated }),
        scope: `${settings.length / (model.meta.vpip.max - model.meta.vpip.min + 1)} legal (node, position) pairs`,
      };
    },
  },
  v2: {
    gate: 'I32',
    what: 'v2 tier reproduction over the §0.4 environment surface',
    path: TF2.FIXTURE_PATH,
    load: (text) => TF2.parseFixture(text),
    compare: (model, fx, n) => TF2.compareToFixture(model, fx, n),
    build(model, generated) {
      const cells = TF2.fixtureCells(model);
      const lanes = TF2.laneSpecs();
      const settings = TF2.fixtureSettings(model, lanes);
      const sweep = TF2.sweepTiers(model, cells, settings, new Map(lanes.map((L) => [L.id, L])));
      return {
        cells, sweep,
        text: TF2.encodeFixture({ model, cells, lanes, sweep, generated }),
        scope: `${lanes.length} environment lanes [${lanes.map((L) => L.id).join(' ')}] x ` +
          `${settings.length / lanes.length / (model.meta.vpip.max - model.meta.vpip.min + 1)} legal (node, position) pairs`,
      };
    },
  },
  v3: {
    gate: '(no gate — pinned by test/tier-fixture-v3.test.mjs)',
    what: 'the v3 DEFAULT surface: villain profile ON, the state the page loads into',
    path: TF3.FIXTURE_PATH,
    load: (text) => TF3.parseFixture(text),
    compare: (model, fx, n) => TF3.compareToFixture(model, fx, n),
    build(model, generated) {
      const cells = TF3.fixtureCells(model);
      const lanes = TF3.laneSpecs(model);
      const settings = TF3.fixtureSettings(model, lanes);
      const sweep = TF3.sweepTiers(model, cells, settings, new Map(lanes.map((L) => [L.id, L])));
      return {
        cells, sweep,
        text: TF3.encodeFixture({ model, cells, lanes, sweep, generated }),
        scope: `${lanes.length} environment lanes [${lanes.map((L) => L.id).join(' ')}] x ` +
          `${settings.length / lanes.length / (model.meta.vpip.max - model.meta.vpip.min + 1)} legal (node, position) pairs, ` +
          `villain profile ${TF3.villainsField(model)}`,
      };
    },
    /**
     * THE CEREMONY'S EVIDENCE (V3-PLAN §0.4(c), §5.1). A fixture that did not exist has nothing to
     * diff against itself, so the diff worth printing is the OTHER one: what the default flip moves
     * relative to the legacy lane I32 still pins. Taken between the two FROZEN FILES, with no
     * pipeline in the middle.
     */
    report(built) {
      const offPath = resolve(ROOT, TF2.FIXTURE_PATH);
      if (!existsSync(offPath)) {
        console.log(`  (no ${rel(offPath)} to diff against — the move diff is skipped)`);
        return;
      }
      const off = TF2.parseFixture(readFileSync(offPath, 'utf8'));
      const on = TF3.parseFixture(built.text);
      const d = TF3.moveDiff(on, off, 12);
      for (const p of d.problems) console.log(`  PROBLEM — ${p}`);
      console.log('');
      console.log(`THE B1 MOVE DIFF — villain profile OFF (${rel(offPath)}) -> ON (this file):`);
      console.log(`  ${d.movedRows}/${d.rows} settings move, ${d.movedCells}/${d.totalCells} cell tiers ` +
        `(${(100 * d.movedCells / d.totalCells).toFixed(3)}%)`);
      const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
      for (const [lane, n] of sorted(d.byLane)) console.log(`  lane ${lane}: ${n} cell tiers`);
      console.log('  by move:');
      for (const [move, n] of sorted(d.byMove)) console.log(`    ${move}: ${n}`);
      console.log('  by taxonomy row (top 10):');
      for (const [row, n] of sorted(d.byRow).slice(0, 10)) console.log(`    ${row}: ${n}`);
      console.log('  examples:');
      for (const e of d.examples) console.log(`    ${e}`);
      console.log('');
    },
  },
  seats9: {
    gate: 'I49',
    what: 'the 9-MAX surface: the v3-default state at seats = 9 (V4-PLAN §2.5)',
    path: TF9.FIXTURE_PATH,
    load: (text) => TF9.parseFixture(text),
    compare: (model, fx, n) => TF9.compareToFixture(model, fx, n, ringPayload()),
    build(model, generated) {
      const cells = TF9.fixtureCells(model);
      const lanes = TF9.laneSpecs(model);
      const settings = TF9.fixtureSettings(model, lanes);
      const sweep = TF9.sweepTiers(model, cells, settings, new Map(lanes.map((L) => [L.id, L])), ringPayload());
      return {
        cells, sweep, lanes, settings,
        text: TF9.encodeFixture({ model, cells, lanes, sweep, generated }),
        scope: `${lanes.length} environment lanes [${lanes.map((L) => L.id).join(' ')}] x ` +
          `${settings.length / lanes.length / (model.meta.vpip.max - model.meta.vpip.min + 1)} legal (node, position) pairs ` +
          `at seats=${TF9.SEATS}, villain profile ${TF9.villainsField(model)}`,
      };
    },
    /**
     * THE CEREMONY'S EVIDENCE (V4-PLAN §2.5, and the input gate I50 is scored on). Two halves,
     * deliberately of different kinds:
     *
     *   THE SUB-LADDER DIFF, taken between the two FROZEN FILES with no pipeline in the middle —
     *   the `compareV1Containment` / `moveDiff` idiom for the third time. Which (lane, VPIP, cell)
     *   readings differ between the 9-max row and its 6-max counterpart, over every shared seat
     *   where the pair is legal at BOTH sizes.
     *
     *   THE NESTING CENSUS, which no frozen file can carry: how many cells the positional post-pass
     *   unioned into each shared seat, and which FRONT SEAT carried each one. §5.2 requires every
     *   excess cell to be explained by a front seat's own N_eff, so the explanation is enumerated
     *   here rather than asserted.
     */
    report(built) {
      const sixPath = resolve(ROOT, TF3.FIXTURE_PATH);
      if (!existsSync(sixPath)) {
        console.log(`  (no ${rel(sixPath)} to diff against — the sub-ladder diff is skipped)`);
      } else {
        const six = TF3.parseFixture(readFileSync(sixPath, 'utf8'));
        const nine = TF9.parseFixture(built.text);
        const d = TF9.subLadderDiff(nine, six, 12);
        for (const p of d.problems) console.log(`  PROBLEM — ${p}`);
        console.log('');
        console.log(`THE SUB-LADDER DIFF — 6-max (${rel(sixPath)}) -> 9-max (this file), over the`);
        console.log('shared seats only (the pair legal at both sizes, compared by LADDER POSITION):');
        console.log(`  ${d.movedRows}/${d.rows} shared settings differ, ${d.movedCells} cell tiers`);
        for (const [node, st] of d.byNode) {
          const seats = [...st.bySeat.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}:${n}`).join(' ');
          console.log(`  ${node}: ${st.comparisons} comparisons, ${st.exact} exact, ${st.moved} differ, ` +
            `${st.cells} cell tiers${seats ? ` — by seat ${seats}` : ''}`);
        }
        console.log('  examples:');
        for (const e of d.examples) console.log(`    ${e}`);
      }
      console.log('');
      const t = Date.now();
      const c = TF9.nestingCensus(model, built.lanes, built.settings, { ring: ringPayload() });
      console.log(`THE NESTING CENSUS — what the positional post-pass unions into each shared seat`);
      console.log(`  (${((Date.now() - t) / 1000).toFixed(1)}s; ${c.refused} comparisons refused)`);
      for (const p of c.problems) console.log(`  PROBLEM — ${p}`);
      for (const [, st] of c.byPair) {
        const fronts = [...st.byFront.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}:${n}`).join(' ');
        console.log(`  ${st.node}/${st.nine}(9) vs ${st.six}(6): ${st.comparisons} comparisons, ` +
          `${st.exact} exact, ${st.strictSuper} strict superset, ${st.subsetViolations} SUBSET VIOLATIONS, ` +
          `${st.unioned} unioned cells (worst ${st.worstUnioned}), ${st.unexplained} unexplained, ` +
          `pre-nesting differs ${st.preDiff} (non-monotone ${st.widthNonMonotone})` +
          (fronts ? ` — carried by ${fronts}` : ''));
      }
      console.log('');
    },
  },
};

/**
 * The ring payload the nine-seat surface needs above `N_eff = 7`, read from disk ONCE.
 *
 * A PAYLOAD PARAMETER, NOT AN IMPORT: `policy.mjs` loads no file and imports nothing (V4-PLAN
 * §2.4), so the ring reaches the accessors from here. Absent, this returns null and the pipeline
 * FAILS CLOSED at the first setting that needs it — which is the correct behaviour and the one
 * `tier-fixture-9max.mjs`'s header records the measurement for.
 */
let RING = undefined;
function ringPayload() {
  if (RING !== undefined) return RING;
  const p = resolve(ROOT, 'data/ring.json');
  RING = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
  return RING;
}

const kind = KINDS[flag('seats9') ? 'seats9' : flag('v3') ? 'v3' : flag('v2') ? 'v2' : 'v1'];
const kindFlag = flag('seats9') ? ' --seats9' : flag('v3') ? ' --v3' : flag('v2') ? ' --v2' : '';
const modelPath = resolve(ROOT, args.find((a) => !a.startsWith('--')) || 'data/model.json');
const outPath = resolve(ROOT, opt('out') || kind.path);
const rel = (p) => relative(ROOT, p);

const model = JSON.parse(readFileSync(modelPath, 'utf8'));
P.hydrate(model);

const exists = existsSync(outPath);

// --check: report, write nothing. The same comparison the gate runs, printed for a human.
if (flag('check')) {
  if (!exists) { console.error(`no fixture at ${rel(outPath)} — run: node scripts/freeze-tiers.mjs${kindFlag}`); process.exit(1); }
  const fx = kind.load(readFileSync(outPath, 'utf8'));
  const d = kind.compare(model, fx, 20);
  if (d.ok) {
    console.log(`${kind.gate} reproduces: ${d.total} settings x ${fx.cells.length} cells identical to ${rel(outPath)}`);
    console.log(`  frozen ${fx.frozen} from model ${fx.modelHash.slice(0, 12)} · now ${(model.meta.hash || '').slice(0, 12)}`);
    process.exit(0);
  }
  console.log(`${kind.gate} would FAIL: ${d.settings}/${d.total} settings differ, ${d.cells} cell tiers`);
  for (const s of d.structural) console.log(`  structural — ${s}`);
  if (d.byLane) for (const [lane, n] of d.byLane) console.log(`  lane ${lane}: ${n} cell tiers`);
  for (const e of d.examples) console.log(`  ${e}`);
  process.exit(1);
}

if (exists && !flag('force')) {
  console.error(`refusing to overwrite ${rel(outPath)}.`);
  console.error('');
  console.error(`  This file is the tier baseline that invariant ${kind.gate} asserts against. Overwriting it`);
  console.error(`  makes ${kind.gate} pass by definition, which is the one thing it must never do. Rewrite it only`);
  console.error('  when a tier was MEANT to move, and only after looking at what moves:');
  console.error('');
  console.error(`      node scripts/freeze-tiers.mjs${kindFlag} --check      # what would change, and where`);
  console.error(`      node scripts/freeze-tiers.mjs${kindFlag} --force      # bless it`);
  process.exit(1);
}

const t0 = Date.now();
const generated = new Date().toISOString().slice(0, 10);
/* A DOMAIN THE PIPELINE CANNOT ANSWER IS A REFUSAL TO FREEZE, NOT A STACK TRACE. The nine-seat
   surface reaches `N_eff > 7`, where the scoring layer reads `data/ring.json` through `eqAtSeats`
   and FAILS CLOSED without it (V4-PLAN §2.4). Printing the census and exiting is the actionable
   form of that: the alternative — writing the rows that did solve — would put a hole in a fixture
   whose gate then passes over a domain nobody chose. */
let built;
try { built = kind.build(model, generated); } catch (e) {
  if (e.name !== 'NineSeatIncomplete') throw e;
  const c = e.census;
  console.error(`refusing to freeze ${rel(outPath)} — the pipeline cannot answer the whole domain.`);
  console.error('');
  console.error(`  ${c.refused} of ${c.total} settings (${(100 * c.refused / c.total).toFixed(3)} %) refuse; ${c.solved} solve.`);
  for (const line of c.lines) console.error(`  ${line}`);
  console.error('');
  console.error('  A fixture missing rows would make its gate assert a domain nobody chose, so nothing');
  console.error('  is written. Supply the payload the refusals name, or land the policy changes they');
  console.error('  point at, and run this again — the count above is the acceptance test.');
  process.exit(1);
}

if (exists) {
  // --force. Print the damage before doing it.
  const before = kind.load(readFileSync(outPath, 'utf8'));
  const d = kind.compare(model, before, 20);
  if (d.ok) {
    console.log('the existing fixture already reproduces — rewriting it changes nothing but the header.');
  } else {
    console.log(`OVERWRITING the ${kind.gate} baseline. ${d.settings}/${d.total} settings move, ${d.cells} cell tiers:`);
    for (const s of d.structural) console.log(`  structural — ${s}`);
    if (d.byLane) for (const [lane, n] of d.byLane) console.log(`  lane ${lane}: ${n} cell tiers`);
    for (const e of d.examples) console.log(`  ${e}`);
    if (d.cells > d.examples.length) console.log(`  ... and ${d.cells - d.examples.length} more`);
    console.log('');
  }
}

if (kind.report) kind.report(built);

writeFileSync(outPath, built.text);
console.log(`froze ${built.sweep.length} settings x ${built.cells.length} cells -> ${rel(outPath)} ` +
  `(${(Buffer.byteLength(built.text) / 1024).toFixed(1)} KB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log(`  model ${rel(modelPath)} hash ${(model.meta.hash || '(none)').slice(0, 12)} · VPIP ` +
  `${model.meta.vpip.min}..${model.meta.vpip.max} · ${built.scope}`);
console.log(`  commit this file. verify.mjs reads it as gate ${kind.gate} and never writes it.`);
