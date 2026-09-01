#!/usr/bin/env node
// freeze-tiers.mjs — rewrite a tier baseline. A DELIBERATE MANUAL ACT, never part of a build.
//
//   node scripts/freeze-tiers.mjs [data/model.json] [--v2] [--out=path] [--force] [--check]
//
//     (no flags)  writes the fixture only if it does not exist yet
//     --v2        act on the v2 fixture (gate I32) instead of the v1 one (gate I22)
//     --check     re-runs the pipeline and prints the diff against the current fixture; writes
//                 nothing (this is what the gate asserts, in a form you can read)
//     --force     overwrites an existing fixture, after printing exactly what changes
//
// THE TWO BASELINES.
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
// A gate is only worth anything while the fixture is older than the code it judges, so nothing
// automatic may write these files: not verify.mjs, not generate-data.mjs, not build.mjs. If you
// are running this with --force, you are asserting that a tier moved *and that it was supposed
// to*. Say why in the commit message; the fixture diff is the evidence.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as TF from './lib/tier-fixture.mjs';
import * as TF2 from './lib/tier-fixture-v2.mjs';
import * as P from './lib/policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

// ---------------------------------------------------------------------------
// the two baselines, behind one interface. `build` returns everything the writer and the
// scope line need; `compare` is the same function the gate calls.
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
};

const kind = KINDS[flag('v2') ? 'v2' : 'v1'];
const modelPath = resolve(ROOT, args.find((a) => !a.startsWith('--')) || 'data/model.json');
const outPath = resolve(ROOT, opt('out') || kind.path);
const rel = (p) => relative(ROOT, p);

const model = JSON.parse(readFileSync(modelPath, 'utf8'));
P.hydrate(model);

const exists = existsSync(outPath);

// --check: report, write nothing. The same comparison the gate runs, printed for a human.
if (flag('check')) {
  if (!exists) { console.error(`no fixture at ${rel(outPath)} — run: node scripts/freeze-tiers.mjs${flag('v2') ? ' --v2' : ''}`); process.exit(1); }
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
  console.error(`      node scripts/freeze-tiers.mjs${flag('v2') ? ' --v2' : ''} --check      # what would change, and where`);
  console.error(`      node scripts/freeze-tiers.mjs${flag('v2') ? ' --v2' : ''} --force      # bless it`);
  process.exit(1);
}

const t0 = Date.now();
const generated = new Date().toISOString().slice(0, 10);
const built = kind.build(model, generated);

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

writeFileSync(outPath, built.text);
console.log(`froze ${built.sweep.length} settings x ${built.cells.length} cells -> ${rel(outPath)} ` +
  `(${(Buffer.byteLength(built.text) / 1024).toFixed(1)} KB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log(`  model ${rel(modelPath)} hash ${(model.meta.hash || '(none)').slice(0, 12)} · VPIP ` +
  `${model.meta.vpip.min}..${model.meta.vpip.max} · ${built.scope}`);
console.log(`  commit this file. verify.mjs reads it as gate ${kind.gate} and never writes it.`);
