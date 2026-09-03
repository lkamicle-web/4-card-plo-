#!/usr/bin/env node
// parse-hh.mjs — the calibration harness's command line (V3-PLAN §3.1 lane C).
//
//   node scripts/parse-hh.mjs                     the synthetic fixture, parsed and reported
//   node scripts/parse-hh.mjs <file|dir> ...      a real corpus, if one ever exists
//   node scripts/parse-hh.mjs --self-check        I46 clause (1): harness reproducibility
//   node scripts/parse-hh.mjs --self-play         PC-4's estimator on a self-play stream
//   node scripts/parse-hh.mjs --verdict           PC-0..PC-8, evaluated, failure-closed
//   node scripts/parse-hh.mjs --block             the object P5 would stamp into model.calibration
//
//   --json                    machine-readable instead of the table
//   --by-position             also bucket by (cell, position) — S-C §4's binding constraint
//   --hands N --seed N        the self-play stream's size and seed
//   --pos P --node N --vpip V where the orderings are cut
//   --out PATH                write the JSON somewhere; refuses data/ and *.fixture.txt
//
// THIS COMMAND CANNOT CHANGE THE MODEL. It reads `data/model.json`, it never writes it, and
// `--out` goes through `assertNotAModelPath` so it cannot be pointed at the dataset or at a tier
// fixture (`freeze-tiers.mjs` is the sole fixture writer). Run it as often as you like; the
// repository is the same afterwards.
//
// WITH NO ARGUMENTS IT RUNS ON A FIXTURE THAT IS DELIBERATELY INADMISSIBLE. S-C found no lawful,
// hero-visible 4-card PLO corpus, so the demo corpus is hand-authored and stamped `synthetic`, and
// `--verdict` on it fails PC-2 by name. That is the intended demonstration: the harness runs
// end-to-end and still refuses to certify anything.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCorpus, aggregate, coverage, sufficiency, makeCorpus, fixtureCorpus,
  evaluatePrimacy, harnessSelfCheck, buildCalibrationBlock, selfPlayConsistency,
  assertNotAModelPath, digest, FIXTURE_PROVENANCE,
} from './lib/calibration.mjs';
import { REJECT_REASONS } from './lib/calibration-hh.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// arguments
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
};
const num = (name, fallback) => {
  const raw = value(name, null);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};
const paths = argv.filter((a, i) => !a.startsWith('--')
  && !(i > 0 && ['--out', '--hands', '--seed', '--pos', '--node', '--vpip', '--min', '--cells'].includes(argv[i - 1])));

const asJson = flag('json');
const model = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));

const at = {
  pos: value('pos', 'CO'),
  node: value('node', 'rfi'),
  v: num('vpip', model.meta.vpip.ref) / 100,
};

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------
function collect(p) {
  const abs = resolve(p);
  const st = statSync(abs);
  if (st.isDirectory()) {
    return readdirSync(abs).flatMap((f) => {
      const child = join(abs, f);
      if (statSync(child).isDirectory()) return collect(child);
      return ['.txt', '.log', '.hhd'].includes(extname(f).toLowerCase()) ? [child] : [];
    });
  }
  return [abs];
}

function loadCorpus() {
  if (paths.length === 0) {
    const { parsed, corpus } = fixtureCorpus();
    return { parsed, corpus, files: ['<synthetic fixture>'], provenance: FIXTURE_PROVENANCE };
  }
  const files = paths.flatMap(collect);
  const text = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const parsed = parseCorpus(text, { limit: num('limit', Infinity) });
  // NO PROVENANCE IS INVENTED HERE. A corpus handed to this command on the command line arrives
  // with nothing said about how it was obtained, and PC-2 is exactly the criterion that forbids
  // guessing. `null` provenance is unevaluable, which PC-0 counts as FAIL — correctly.
  return { parsed, corpus: makeCorpus(parsed.rows, null), files, provenance: null };
}

// ---------------------------------------------------------------------------
// reports
// ---------------------------------------------------------------------------
const pct = (x, n) => (n ? `${((100 * x) / n).toFixed(1)}%` : '—');

function reportParse(parsed, files) {
  const c = parsed.counts;
  const out = [];
  out.push(`corpus: ${files.length} file(s)`);
  out.push(`  blocks ${c.blocks} · accepted ${c.accepted} · rejected ${c.rejected}`);
  const reasons = REJECT_REASONS.filter((r) => c.byReason[r] > 0).map((r) => `${r} ${c.byReason[r]}`);
  if (reasons.length) out.push(`  refused: ${reasons.join(' · ')}`);
  out.push('');
  out.push(`  hero rows      ${c.heroRows}   <- the admissible door (PC-1). Count THIS, not showdowns.`);
  out.push(`  showdown rows  ${c.showdownRows}   descriptive only: outcome-selected three times over`);
  out.push(`  cells touched  ${c.cellsTouched} of ${Object.keys(model.cells).filter((k) => model.cells[k].combos).length}`);
  return out.join('\n');
}

function reportCoverage(parsed) {
  const cellKeys = Object.keys(model.cells).filter((k) => model.cells[k].combos > 0);
  const agg = aggregate(parsed.rows, { byPosition: flag('by-position') });
  const cov = coverage(agg, cellKeys, { min: num('min', 100) });
  const suf = sufficiency(cov, { cells: num('cells', 80) });
  const out = [];
  out.push('');
  out.push(`coverage at >= ${cov.min} rows (${suf.rule}):`);
  out.push(`  cells with enough HERO rows      ${cov.heroAtMin}/${cov.cells}   -> bar ${suf.met ? 'MET' : 'NOT MET'}`);
  out.push(`  cells with enough SHOWDOWN rows  ${cov.showdownAtMin}/${cov.cells}   -> plan §1 bar as written ${suf.metAsWritten ? 'MET' : 'NOT MET'}`);
  out.push(`  ${suf.note}`);
  if (agg.byCellPos) {
    let atMin = 0;
    for (const b of agg.byCellPos.values()) if (b.hero.n >= cov.min) atMin++;
    out.push(`  (cell, position) buckets with enough hero rows: ${atMin} of ${cov.cells * 6}`);
  }
  const top = cov.rows.filter((r) => r.heroRows + r.showdownRows > 0).slice(0, 12);
  if (top.length) {
    out.push('');
    out.push('  cell                       hero  showdown');
    for (const r of top) out.push(`  ${r.key.padEnd(26)} ${String(r.heroRows).padStart(4)}  ${String(r.showdownRows).padStart(8)}`);
  }
  return { text: out.join('\n'), agg, cov, suf };
}

function reportVerdict(ev) {
  const out = [''];
  out.push(`PRIMACY VERDICT: ${ev.verdict.toUpperCase()}   (I46, parked — criteria digest ${ev.criteriaDigest})`);
  out.push('  PC-0 is conjunctive and failure-closed: a criterion that cannot be evaluated is a FAIL.');
  out.push('');
  for (const c of ev.criteria) {
    const tag = c.status === 'pass' ? 'PASS' : c.status === 'fail' ? 'FAIL' : 'UNEVALUABLE';
    out.push(`  ${c.id}  ${tag.padEnd(11)} ${c.detail}`);
  }
  if (ev.unevaluable.length) {
    out.push('');
    out.push(`  ${ev.unevaluable.length} criteria could not be evaluated: ${ev.unevaluable.join(', ')}.`);
    out.push('  S-C: no lawful, hero-visible, assigned 4-card PLO corpus exists at any volume.');
    out.push('  The bar is PARKED, not lowered — it comes alive unchanged the day one does.');
  }
  return out.join('\n');
}

function reportSelfPlay(sp) {
  const s = sp.statistic, d = sp.disagreement;
  const out = [''];
  out.push(`self-play consistency — PC-4's estimator, ${sp.unit} units, payoff source '${sp.payoffSource}'`);
  out.push(`  NOT a calibration: no money, no corpus, no verdict. moneyValidated = ${sp.moneyValidated}.`);
  out.push(`  at ${sp.at.pos}/${sp.at.node} v=${sp.at.v} width=${sp.at.width.toFixed(6)} · seed ${sp.seed} · ${sp.hands} hands`);
  out.push(`  cut sizes: ev ${sp.cutSizes.ev} cells, score ${sp.cutSizes.score} cells`);
  out.push(`  disagreement: ${d.cells} cells, ${(100 * d.mass).toFixed(3)}% of combo mass`);
  out.push(`    only EV opens:    ${d.onlyEv.join(', ') || '—'}`);
  out.push(`    only score opens: ${d.onlyScore.join(', ') || '—'}`);
  out.push(`  D = ${s.D == null ? '—' : s.D.toExponential(4)} ${sp.unit}  SE ${s.se == null ? '—' : s.se.toExponential(4)}`);
  out.push(`  paired: ${s.zeros}/${s.n} hands contributed exactly zero (${pct(s.zeros, s.n)})`);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const emit = [];
const bag = {};

if (flag('self-check')) {
  const sc = harnessSelfCheck(model, { hands: num('hands', 5000), ...at });
  bag.selfCheck = sc;
  emit.push('');
  emit.push(`harness reproducibility (I46 clause 1): ${sc.ok ? 'OK' : 'BROKEN'}`);
  for (const k of sc.checks) emit.push(`  ${(k.ok ? 'ok  ' : 'FAIL')} ${k.name.padEnd(17)} ${k.detail}`);
  if (!sc.ok) process.exitCode = 1;
}

if (flag('self-play')) {
  const sp = selfPlayConsistency(model, { hands: num('hands', 200000), seed: num('seed', 1), ...at });
  bag.selfPlay = sp;
  emit.push(reportSelfPlay(sp));
}

if (flag('block')) {
  const { corpus } = loadCorpus();
  const block = buildCalibrationBlock(model, {
    corpus,
    selfPlayOpts: { hands: num('hands', 20000), seed: num('seed', 1), ...at },
  });
  bag.block = block;
  if (!asJson) emit.push(`\nmodel.calibration (BUILT, NOT WRITTEN) — digest ${digest(block)}\n`
    + JSON.stringify(block, null, 2));
}

if (!flag('self-check') && !flag('self-play') && !flag('block')) {
  const { parsed, corpus, files } = loadCorpus();
  const cov = reportCoverage(parsed);
  bag.counts = parsed.counts;
  bag.coverage = cov.cov;
  bag.sufficiency = cov.suf;
  emit.push(reportParse(parsed, files));
  emit.push(cov.text);
  if (flag('verdict')) {
    const ev = evaluatePrimacy({ model, corpus });
    bag.verdict = ev;
    emit.push(reportVerdict(ev));
  }
}

if (asJson) {
  process.stdout.write(`${JSON.stringify(bag, null, 2)}\n`);
} else {
  process.stdout.write(`${emit.join('\n')}\n`);
}

const out = value('out', null);
if (out) {
  // The refusal is a first-class outcome, not a crash: it prints one line and exits 1, so a
  // pipeline that tries to write the harness's report over the dataset gets a message it can read
  // rather than a stack trace it will paper over.
  let abs;
  try {
    abs = assertNotAModelPath(out, ROOT);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
  writeFileSync(abs, `${JSON.stringify(bag, null, 2)}\n`);
  process.stderr.write(`wrote ${abs}\n`);
}
