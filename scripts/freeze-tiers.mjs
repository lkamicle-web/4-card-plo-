#!/usr/bin/env node
// freeze-tiers.mjs — rewrite the I22 baseline. A DELIBERATE MANUAL ACT, never part of a build.
//
//   node scripts/freeze-tiers.mjs [data/model.json] [--out=path] [--force] [--check]
//
//     (no flags)  writes the fixture only if it does not exist yet
//     --check     re-runs the pipeline and prints the diff against the current fixture; writes
//                 nothing (this is what I22 asserts, in a form you can read)
//     --force     overwrites an existing fixture, after printing exactly what changes
//
// I22 says: at the v1 operating point — depth 100bb, rake 0, straddle off, random villains — the
// pipeline paints the tier v1 painted, on every cell, at every (node, position, integer VPIP).
// The gate is only worth anything while the fixture is older than the code it judges, so nothing
// automatic may write this file: not verify.mjs, not generate-data.mjs, not build.mjs. If you are
// running this with --force, you are asserting that a tier moved *and that it was supposed to*.
// Say why in the commit message; the fixture diff is the evidence.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FIXTURE_PATH, fixtureCells, fixtureSettings, sweepTiers, encodeFixture, parseFixture,
  compareToFixture,
} from './lib/tier-fixture.mjs';
import * as P from './lib/policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const modelPath = resolve(ROOT, args.find((a) => !a.startsWith('--')) || 'data/model.json');
const outPath = resolve(ROOT, opt('out') || FIXTURE_PATH);
const rel = (p) => relative(ROOT, p);

const model = JSON.parse(readFileSync(modelPath, 'utf8'));
P.hydrate(model);

const exists = existsSync(outPath);

// --check: report, write nothing. The same comparison I22 runs, printed for a human.
if (flag('check')) {
  if (!exists) { console.error(`no fixture at ${rel(outPath)} — run: node scripts/freeze-tiers.mjs`); process.exit(1); }
  const fx = parseFixture(readFileSync(outPath, 'utf8'));
  const d = compareToFixture(model, fx, 20);
  if (d.ok) {
    console.log(`I22 reproduces: ${d.total} settings x ${fx.cells.length} cells identical to ${rel(outPath)}`);
    console.log(`  frozen ${fx.frozen} from model ${fx.modelHash.slice(0, 12)} · now ${(model.meta.hash || '').slice(0, 12)}`);
    process.exit(0);
  }
  console.log(`I22 would FAIL: ${d.settings}/${d.total} settings differ, ${d.cells} cell tiers`);
  for (const s of d.structural) console.log(`  structural — ${s}`);
  for (const e of d.examples) console.log(`  ${e}`);
  process.exit(1);
}

if (exists && !flag('force')) {
  console.error(`refusing to overwrite ${rel(outPath)}.`);
  console.error('');
  console.error('  This file is the v1 tier baseline that invariant I22 asserts against. Overwriting it');
  console.error('  makes I22 pass by definition, which is the one thing it must never do. Rewrite it only');
  console.error('  when a tier was MEANT to move, and only after looking at what moves:');
  console.error('');
  console.error('      node scripts/freeze-tiers.mjs --check      # what would change, and where');
  console.error('      node scripts/freeze-tiers.mjs --force      # bless it');
  process.exit(1);
}

const t0 = Date.now();
const cells = fixtureCells(model);
const settings = fixtureSettings(model);
const sweep = sweepTiers(model, cells, settings);
const generated = new Date().toISOString().slice(0, 10);
const text = encodeFixture({ model, cells, sweep, generated });

if (exists) {
  // --force. Print the damage before doing it.
  const before = parseFixture(readFileSync(outPath, 'utf8'));
  const d = compareToFixture(model, before, 20);
  if (d.ok) {
    console.log('the existing fixture already reproduces — rewriting it changes nothing but the header.');
  } else {
    console.log(`OVERWRITING the I22 baseline. ${d.settings}/${d.total} settings move, ${d.cells} cell tiers:`);
    for (const s of d.structural) console.log(`  structural — ${s}`);
    for (const e of d.examples) console.log(`  ${e}`);
    if (d.cells > d.examples.length) console.log(`  ... and ${d.cells - d.examples.length} more`);
    console.log('');
  }
}

writeFileSync(outPath, text);
console.log(`froze ${sweep.length} settings x ${cells.length} cells -> ${rel(outPath)} ` +
  `(${(Buffer.byteLength(text) / 1024).toFixed(1)} KB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log(`  model ${rel(modelPath)} hash ${(model.meta.hash || '(none)').slice(0, 12)} · VPIP ` +
  `${model.meta.vpip.min}..${model.meta.vpip.max} · ${settings.length / (model.meta.vpip.max - model.meta.vpip.min + 1)} legal (node, position) pairs`);
console.log('  commit this file. verify.mjs reads it as gate I22 and never writes it.');
