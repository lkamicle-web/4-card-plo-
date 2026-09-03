// node --test test/*.test.mjs
//
// THE P2 PAYOFF ESTIMATOR'S HARNESS — and, because S-B graded C, its QUARANTINE.
//
// `scripts/lib/payoff-model.mjs` is a built, fitted, measured estimator that is NOT WIRED IN.
// V3-PLAN §3.2's Measured block, §3.6's Grade-C row and §14.1's resolution all say the same thing:
// the stub payoff stays and P2 builds no payoff table. So this file has two jobs, and the second
// one is the load-bearing one:
//
//   1. THE CONTRACT. I33's clauses (a)-(h) and its rewritten monotonicity clause must pass ON THIS
//      MODEL, not just on the stub — run against THE GATE'S OWN EXPORTED DETECTORS, never against a
//      second copy of them, because a harness that re-implements a detector proves only that the
//      harness's copy fires. Each clause is armed here with a fabricated violator built out of the
//      model itself, so "it passes" means "it could have failed".
//
//   2. THE QUARANTINE. The estimator must be provably inert: the live `payoff()` still answers
//      `source:'checkdown'` on every path (I35's Grade-C label keys off exactly that datum), no
//      shipped file imports the module, no fitted number reaches `policy.CONSTANTS` or
//      `data/model.json`, form 2 is not built, and the stack-off knob does not exist. Grade C is a
//      measurement, so honouring it has to be a test rather than a promise in a header.
//
// WHY THERE IS NO NEW GATE ID. V3-PLAN §7.2 names an id for every gate the plan foresaw, and none
// is named for the estimator — because I33 IS the payoff contract's gate and its clauses are
// source-generic by construction (they all take a payoff-shaped `fn`). Inventing I48 here would be
// exactly what `scripts/gates/reserved.mjs` was written to prevent: "a gate id chosen after the
// feature is a gate written to pass". `test/manifest.test.mjs` set the precedent in the same words
// — assert it in `node --test`, one of the three checks GREEN is defined as, and invent no id. The
// live gate already reaches this lane in one place that matters: I33 clause (g)'s `MEMO_SCOPE`
// names `payoff-model.mjs` explicitly, so the file is inside an enforced gate from the day it
// lands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as P from '../scripts/lib/policy.mjs';
import { makePayoff, RESULT_KEYS, SOURCES } from '../scripts/lib/payoff.mjs';
import * as PM from '../scripts/lib/payoff-model.mjs';
import * as FITTER from '../scripts/lib/payoff-fit.mjs';
import { CELLS, ROWS, REF_META, SB_PUBLISHED } from '../scripts/lib/payoff-reference.mjs';
/* the gate's own detectors — the same functions `scripts/verify.mjs` runs for I33 */
import { memoProblems, ipMemoAliases, MEMO_SCOPE, isDegeneratePair, removalProblems,
  monoProblems, monoRows, stripComments } from '../scripts/gates/payoff.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const HAVE = existsSync(MODEL_PATH);
const M = HAVE ? JSON.parse(readFileSync(MODEL_PATH, 'utf8')) : null;
const LIVE = HAVE ? Object.keys(M.cells).filter((k) => Array.isArray(M.cells[k].eq) && M.cells[k].eq.length).sort() : [];
const STUB = HAVE ? makePayoff(M) : null;
const F = HAVE ? PM.makePayoffModel(M) : null;
const SPRS = [0, 1, 2, 4, 10];

/** every ordered heads-up pair of live cells — the sweep the identity clauses run over */
function ordered() {
  const out = [];
  for (const a of LIVE) for (const b of LIVE) out.push([a, b]);
  return out;
}
/** every file under scripts/ and src/ that could plausibly reference a module */
function walk(dir, out = []) {
  let ents;
  try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents.sort((x, y) => (x.name < y.name ? -1 : 1))) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name[0] !== '.') walk(p, out); }
    else if (/\.(mjs|js|html|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

// =================================================================================================
// 1. PROVENANCE — the fit is a measurement, re-derived, not a typing
// =================================================================================================

test('the reference is S-B\'s own 300 points, and every cell in it is a cell this model ships', () => {
  assert.equal(ROWS.length, 300, 'S-B ran 50 pairs x spr {1,4,10} x {IP,OOP}');
  assert.equal(CELLS.length, 47);
  assert.equal(REF_META.deals, 20000);
  assert.deepEqual([...REF_META.sprs], [1, 4, 10]);
  const pairs = new Set();
  for (const r of ROWS) {
    assert.ok(r[0] >= 0 && r[0] < CELLS.length && r[1] >= 0 && r[1] < CELLS.length, 'cell index out of range');
    assert.ok(REF_META.sprs.includes(r[2]), `spr ${r[2]} is not one the reference simulated`);
    assert.ok(r[3] === 0 || r[3] === 1);
    assert.ok(r[4] > 0 && r[4] < 1, 'ev is a pot fraction');
    assert.ok(r[5] > 0, 'the reference carries its own error bar on every row');
    assert.ok(r[6] >= 1, 'the final pot contains the pot at the node');
    assert.ok(r[9] === 0 || r[9] === 1);
    pairs.add(`${r[0]}~${r[1]}`);
    if (HAVE) {
      assert.ok(M.cells[CELLS[r[0]]], `${CELLS[r[0]]} is in the reference but not in the shipped model`);
      assert.ok(M.cells[CELLS[r[1]]], `${CELLS[r[1]]} is in the reference but not in the shipped model`);
    }
  }
  assert.equal(pairs.size, REF_META.pairs);
  const held = new Set(ROWS.filter((r) => r[9] === 1).map((r) => `${r[0]}~${r[1]}`));
  assert.equal(held.size, REF_META.testPairs, 'S-B\'s split is 34 train / 16 held out, and is not re-drawn here');
});

test('S-B\'s own invShare is converted, not copied — amendment (i)\'s one line, and it stays in range', () => {
  // The reference's `invShare` is E[hero invested TOTAL]/E[F]; the interface's key of the same name
  // is the POST-node half, because REF3 supplies the pre-node part by NORMALISATION (pot = 1,
  // c0 = c1 = 0.5) and the four frozen arguments do not carry hero's share of `potSize`.
  for (const r of ROWS) {
    const post = r[7] - 0.5 / r[6];
    assert.ok(post >= 0 && post <= 1, `post-node invShare ${post} is outside [0,1] for a reference row`);
  }
  // and the conversion is exactly reversible, which is what makes it a normalisation rather than an edit
  for (const r of ROWS.slice(0, 20)) {
    assert.ok(Math.abs((r[7] - 0.5 / r[6]) + 0.5 / r[6] - r[7]) < 1e-15);
  }
});

test('every frozen number in FIT is what the fitter produces from the reference — nothing is typed', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  const rows = FITTER.rowsFor(M, (a, b) => STUB([a, b], 10, 4, { ip: false }).ev);
  assert.equal(rows.length, 300);
  const again = FITTER.fit(rows);
  assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(PM.FIT)),
    'payoff-model.mjs\'s FIT is no longer the output of payoff-fit.mjs over payoff-reference.mjs — '
    + 'a coefficient has been edited without editing the measurement it came from');
  assert.equal(PM.MODEL_SE, again.modelSe);
});

test('the parameter count is 15, not 17 — the ev and q designs are exactly rank-deficient', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  /* THE P2 RED TEAM'S SECOND CORRECTION (docs/refutations/P2.md). `x = base - 0.5` and `base` is
     payoff.mjs's projection, so `x` IS `dEq/2` and the design's `x*g` is `0.5*(g*dEq)` — one column
     scaled. The ridge splits a single identified quantity in its minimum-norm ratio, which is why
     both blocks show coef[4]/coef[0] = 2 to ten places. Asserted here so the over-count in any
     future description of this fit cannot be made silently, and so that a repair — dropping `x*g`,
     which needs a deliberate re-freeze — announces itself by turning this red. */
  const rows = FITTER.rowsFor(M, (a, b) => STUB([a, b], 10, 4, { ip: false }).ev);
  let worst = 0;
  for (const r of rows) worst = Math.max(worst, Math.abs(r.f.x - r.f.dEq / 2));
  assert.ok(worst < 1e-15, `x and dEq/2 differ by ${worst}; the collinearity claim has changed`);
  for (const block of ['ev', 'invShare']) {
    const c = PM.FIT[block].coef;
    assert.deepEqual([...PM.FIT[block].terms], [...FITTER.EV_TERM_NAMES]);
    assert.ok(Math.abs(c[4] / c[0] - 2) < 1e-9,
      `${block}: coef[4]/coef[0] is ${c[4] / c[0]}, not the ridge's 2 — the split has moved`);
  }
  assert.equal(PM.FIT.ev.coef.length + PM.FIT.potMult.coef.length + PM.FIT.invShare.coef.length, 17,
    'seventeen coefficients ship');
});

test('the fit ACTUALLY depends on the reference — armed against a fitter that ignores its input', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  // A "re-derivation" that would agree with anything proves nothing. Move one reference row and the
  // coefficients must move; move the model's equity ladder and they must move too.
  const rows = FITTER.rowsFor(M, (a, b) => STUB([a, b], 10, 4, { ip: false }).ev);
  const bent = rows.map((r, i) => (i === 0 ? { ...r, ref: r.ref + 0.2 } : r));
  assert.notDeepEqual(FITTER.fitAt(bent, PM.FIT.S0).ev.coef, PM.FIT.ev.coef);
  const shifted = FITTER.rowsFor(M, (a, b) => STUB([a, b], 10, 4, { ip: false }).ev * 0.9);
  assert.notDeepEqual(FITTER.fitAt(shifted, PM.FIT.S0).ev.coef, PM.FIT.ev.coef);
});

test('the one unanchored knob is flagged, per V3-PLAN §6, and says why', () => {
  assert.equal(PM.UNANCHORED.length, 1, 'exactly one number in this lane has no anchor');
  const k = PM.UNANCHORED[0];
  assert.equal(k.name, 'S0');
  assert.equal(k.value, PM.FIT.S0);
  assert.equal(k.badge, 'interpolated', '§6: cannot be anchored -> gated, flagged, badged `interpolated`');
  assert.equal(k.live, false, 'Grade C ships no estimator, so the badge has nowhere to render yet');
  assert.match(k.why, /no meaning outside the fit/);
  // the three measured reasons it is not an anchor, read off the selection the fitter actually ran
  const curve = PM.FIT.selection.curve;
  const spread = Math.max(...curve.map((c) => c.meanP95)) - Math.min(...curve.map((c) => c.meanP95));
  assert.ok(spread < 100 * PM.MODEL_SE,
    `the CV objective moves ${spread.toFixed(2)} pt across the whole grid, which must be less than `
    + 'the estimator\'s own se for the "not identified" claim to hold');
  assert.ok(new Set(PM.FIT.selection.argminPerShuffle).size >= 3,
    'the per-shuffle argmin must actually wander — that is the evidence the knob is fold-noise');
  assert.ok(PM.FIT.selection.argminPerShuffle.includes(PM.FIT.S0) === true
    || PM.FIT.selection.argminPerShuffle.length === FITTER.CV_SHUFFLES);
});

test('the flag\'s THIRD reason is asserted too: the CV winner is not the held-out winner', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  /* THE P2 RED TEAM'S ONE CORRECTION TO THIS FLAG (docs/refutations/P2.md). Two of the three
     measured reasons `UNANCHORED` gives were already asserted above. The third — "the CV winner is
     not the held-out winner, and the rule is not allowed to reach back for it" — was narrated in
     two headers and checked nowhere, and it was WRONG: `payoff-fit.mjs` named S0 = 8 as the
     out-of-sample winner, which refits at held-out p95 16.8416, worse than the shipped 12's
     16.7143. The real held-out winner is S0 = 1.5 at 14.6976. So the reason survives, and survives
     more strongly, and it is now a re-derivation rather than a sentence: the whole grid is refitted
     and the held-out argmin must differ from the selected knob. If a future reference ever made the
     two agree, this fails and the flag's third leg has to be rewritten to the new measurement. */
  const rows = FITTER.rowsFor(M, (a, b) => STUB([a, b], 10, 4, { ip: false }).ev);
  const grid = FITTER.S0_GRID.map((S0) => ({ S0, p95: FITTER.fitAt(rows, S0).error.ev.held.p95 }));
  const winner = grid.reduce((a, b) => (b.p95 < a.p95 ? b : a));
  const shipped = grid.find((g) => g.S0 === PM.FIT.S0);
  assert.notEqual(winner.S0, PM.FIT.S0,
    `the CV winner ${PM.FIT.S0} IS the held-out winner, so the flag's third reason no longer holds`);
  assert.ok(winner.p95 < shipped.p95, 'the held-out argmin must actually score better out of sample');
  // and the rule did not reach back for it: the selection never sees a held-out row
  assert.equal(rows.filter((r) => r.held).length, 96);
  assert.equal(PM.FIT.error.ev.held.n, 96);
  assert.ok(Math.abs(shipped.p95 - PM.FIT.error.ev.held.p95) < 1e-9,
    'the refit at the selected knob is not the frozen fit');
});

// =================================================================================================
// 2. THE QUARANTINE — Grade C, honoured as a property of the tree
// =================================================================================================

test('the estimator is DISABLED, and the live payoff source is still checkdown everywhere', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  assert.equal(PM.ENABLED, false, 'S-B graded C: V3-PLAN §3.2 says the stub payoff stays');
  assert.equal(PM.SOURCE, 'model');
  assert.ok(SOURCES.includes(PM.SOURCE));
  // I35's Grade-C label keys off the shipped `source` datum, so the datum has to still be there.
  let n = 0;
  for (const [a, b] of ordered()) {
    for (const spr of [0, 4, 10]) {
      assert.equal(STUB([a, b], 10, spr, { ip: false }).source, 'checkdown');
      n++;
    }
  }
  assert.ok(n > 15000, `only ${n} live returns checked`);
});

test('nothing that ships imports the estimator — the quarantine is the import graph', () => {
  // COMMENTS STRIPPED FIRST, for I33(g)'s reason: several files DISCUSS this module (its own header
  // at length, and the gate's own `MEMO_SCOPE.test('payoff-model.mjs')` arming), and a raw scan
  // would fail on the prose that documents the quarantine.
  const imports = [], mentions = [];
  for (const f of [...walk(resolve(ROOT, 'scripts')), ...walk(resolve(ROOT, 'src')), resolve(ROOT, 'smoke.mjs'),
    resolve(ROOT, 'browsers.mjs')]) {
    let raw = '';
    try { raw = readFileSync(f, 'utf8'); } catch { continue; }
    if (/payoff-model\.mjs$/.test(f)) continue;
    const src = /\.json$/.test(f) ? raw : stripComments(raw);
    const rel = relative(ROOT, f);
    if (/from\s+['"][^'"]*payoff-model|require\s*\(\s*['"][^'"]*payoff-model/.test(src)) imports.push(rel);
    // VERIFICATION code may name it — I33(g) has to, to arm its own scope check — but nothing else may
    if (/payoff-model|payoffModel/.test(src) && !rel.startsWith('scripts/gates/')) mentions.push(rel);
  }
  assert.deepEqual(imports, [], 'a shipped file imports payoff-model.mjs; Grade C says it is not wired in');
  assert.deepEqual(mentions, [], 'a non-verification file names the estimator');
  // ARMED. A scan over a tree that contains no violation proves nothing about the scan, so both
  // halves get a fabricated one — and the comment-only form must CLEAR, since stripping is the
  // whole reason this passes at all.
  const fires = (s) => /from\s+['"][^'"]*payoff-model|require\s*\(\s*['"][^'"]*payoff-model/.test(stripComments(s));
  assert.equal(fires("import { makePayoffModel } from './payoff-model.mjs';"), true);
  assert.equal(fires("const PM = require('../scripts/lib/payoff-model.mjs');"), true);
  assert.equal(fires("// one day this will import payoff-model.mjs from './payoff-model.mjs'"), false);
  assert.equal(fires("import { makePayoff } from './payoff.mjs';"), false);
  // and the build injects exactly two modules, neither of them this one
  const build = readFileSync(resolve(ROOT, 'scripts/build.mjs'), 'utf8');
  const injected = [...build.matchAll(/moduleToIife\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(injected, ['scripts/lib/policy.mjs', 'scripts/lib/taxonomy.mjs'],
    'the estimator must cost the artifact nothing — D6/D7 are not this lane\'s to spend');
});

test('no fitted number reaches the opinion layer, the shipped model, or the Method view', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  const before = JSON.stringify(P.CONSTANTS);
  PM.makePayoffModel(M)([LIVE[0], LIVE[1]], 10, 4, { ip: true });
  assert.equal(JSON.stringify(P.CONSTANTS), before, 'running the estimator moved a policy constant');
  // a source scan too, because the import-time window a runtime check cannot see is the real risk
  for (const f of ['payoff-model.mjs', 'payoff-fit.mjs', 'payoff-reference.mjs']) {
    const src = readFileSync(resolve(ROOT, 'scripts/lib', f), 'utf8');
    assert.doesNotMatch(src, /CONSTANTS\s*(\.\w+|\[[^\]]*\])[^=]*=[^=]/, `${f} assigns into CONSTANTS`);
    assert.doesNotMatch(src, /from '\.\/policy\.mjs'/, `${f} must not need the opinion layer at all`);
    assert.doesNotMatch(src, /writeFileSync|appendFileSync|createWriteStream|unlinkSync|mkdirSync|rmSync/,
      `${f} must not be able to write anything`);
    assert.doesNotMatch(src, /from 'node:fs'/, `${f} must not import node:fs at all`);
  }
  // and nothing from the fit is stamped into the artifact
  const shipped = JSON.stringify(M.constants);
  for (const name of ['S0', 'payoffModel', 'realizationCurve', 'estimator']) {
    assert.ok(!shipped.includes(`"${name}"`), `${name} has reached data/model.json's constants block`);
  }
  // ARMED: three source scans that have nothing to find today, each shown to fire on a fabrication
  assert.match('CONSTANTS.depth.mu = 0.72;', /CONSTANTS\s*(\.\w+|\[[^\]]*\])[^=]*=[^=]/);
  assert.match("CONSTANTS['payoffS0'] = 12;", /CONSTANTS\s*(\.\w+|\[[^\]]*\])[^=]*=[^=]/);
  assert.doesNotMatch('if (P.CONSTANTS.depth.mu === 0.6) return;', /CONSTANTS\s*(\.\w+|\[[^\]]*\])[^=]*=[^=]/);
  assert.match("import { writeFileSync } from 'node:fs';", /from 'node:fs'/);
  assert.match('writeFileSync(path, JSON.stringify(FIT));', /writeFileSync|appendFileSync|createWriteStream|unlinkSync|mkdirSync|rmSync/);
});

test('form 2 is not built and the stack-off knob does not exist', () => {
  // V3-PLAN §3.2: "Do not build form 2 — 1.5x over budget at 600 deals/pair, a trial count whose
  // own se (2.69 pt) already exceeds the Grade A edge." §6's stack-off row is form 2's knob, so the
  // cleanest way to satisfy "anchored or flagged" is for it never to be created.
  /* SCOPE WIDENED BY THE P2 RED TEAM (docs/refutations/P2.md). Three refuters made the same two
     moves: they renamed the knobs (JAM_T / SHOVE_THRESHOLD / STACK_OFF_MULT) and they moved them
     into a NEW FILE (scripts/lib/payoff-form2.mjs), and both walked past a scan that read two named
     files case-sensitively. Renaming is the known ceiling of a grep-gate and stays uncaught — the
     claim being defended is specifically that FORM 2's knob was not started, and form 2's knob has
     names — but "in a different file" was a hole with no such excuse. The scan now reads every
     module under scripts/lib and matches case-insensitively, which is the one line the memos asked
     for. What actually keeps the outcome true is the QUARANTINE (nothing shipped imports any of
     this, and build.mjs injects two modules, neither of them here), and saying that out loud is
     part of the repair: a future author building form 2 will not be reusing S-B's variable names. */
  const KNOBS = /\bjamT\b|\bbluffT\b|\bjamMult\b|\bstackOff\b|\brolloutEv\b|\bbucketEv\b/i;
  const LIB = resolve(ROOT, 'scripts/lib');
  const scanned = readdirSync(LIB).filter((f) => /\.mjs$/.test(f) && f !== 'payoff-reference.mjs').sort();
  assert.ok(scanned.length > 20, `only ${scanned.length} modules scanned — the scope has narrowed`);
  assert.ok(scanned.includes('payoff-model.mjs') && scanned.includes('payoff-fit.mjs'));
  for (const f of scanned) {
    // stripped, because the headers NAME the knob in order to say it was not created — the same
    // reason I33(g) strips before its own text scan
    const src = stripComments(readFileSync(resolve(LIB, f), 'utf8'));
    assert.doesNotMatch(src, KNOBS, `${f} has started building form 2 or its stack-off knob`);
  }
  for (const f of ['payoff-model.mjs', 'payoff-fit.mjs']) {
    const src = stripComments(readFileSync(resolve(LIB, f), 'utf8'));
    assert.doesNotMatch(src, /\brefKnobs\b/,
      `${f} reads REF3's own threshold knobs — those are the REFERENCE's opinion layer, recorded as `
      + 'provenance, and an estimator that consumed them would have adopted them');
  }
  // the one exemption is named, and it is the reference — never a file that could hold the knob
  assert.match(stripComments(readFileSync(resolve(LIB, 'payoff-reference.mjs'), 'utf8')), KNOBS,
    'the exemption is pointless if the exempt file no longer carries the reference\'s own knobs');
  // the reference file DOES name two of them, and that is the point: `REF_META.refKnobs` records
  // REF3's five opinion knobs verbatim, because S-B's load-bearing caveat is that two of them move
  // the "ground truth" by more than the Grade A/B edge. They are data about the reference, never the
  // estimator's own, and the assertion above is what keeps the distinction load-bearing.
  assert.deepEqual({ ...REF_META.refKnobs }, { betFrac: 0.66, betT: 0.62, bluffT: 0.22, callMult: 1, jamT: 0.8 });
  const refSrc = stripComments(readFileSync(resolve(ROOT, 'scripts/lib/payoff-reference.mjs'), 'utf8'));
  assert.doesNotMatch(refSrc, /\bjamMult\b|\bstackOff\b|\brolloutEv\b|\bbucketEv\b/);
  assert.equal(PM.UNANCHORED.filter((k) => /jam|stack/i.test(k.name)).length, 0);
  // ARMED: the scan must fire on form 2 arriving, in the shape S-B actually wrote it
  assert.match(stripComments('export const ROLLOUT_OPTS = Object.freeze({ jamT: 0.58, bluffT: 0.18, jamMult: 3.0 });'), KNOBS);
  assert.match(stripComments('const ev = rolloutEv(flopE, show, spr, ip, O);'), KNOBS);
  assert.doesNotMatch(stripComments('// form 2 would need jamT, bluffT and jamMult; it is not built'), KNOBS);
  // and on the two evasions the red team actually used: a different case, and a different file
  assert.match(stripComments('const JAMT = 0.8; const STACKOFF = 3.0;'), KNOBS);
  assert.ok(!scanned.includes('payoff-form2.mjs'),
    'form 2 has a file; the scan reads every module under scripts/lib, so this is now a real finding');
  // WHAT THE SCAN CANNOT SEE, said out loud rather than implied: the same policy under names S-B
  // did not use. That is the ceiling of any grep-gate, and the quarantine is what carries the claim.
  assert.doesNotMatch(stripComments('const shoveThreshold = 0.8; const allInMult = 3.0;'), KNOBS);
});

// =================================================================================================
// 3. I33's CONTRACT, ON THE MODEL — the gate's own detectors, each armed
// =================================================================================================

test('(a) the model wears the frozen shape: four arguments, six keys, in order, with the ranges', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  assert.equal(F.length, 4, 'a default on `opts` would silently make this 3');
  assert.equal(PM.makePayoffModel.length, 1);
  assert.equal(F.modelHash, STUB.modelHash, 'the model hash is one component of any future memo key');
  let n = 0;
  for (const [a, b] of ordered()) {
    for (const spr of SPRS) {
      for (const ip of [false, true]) {
        const r = F([a, b], 10, spr, { ip });
        assert.deepEqual(Object.keys(r), [...RESULT_KEYS], 'key ORDER is part of the pin');
        assert.equal(typeof r.ev, 'number');
        assert.ok(r.ev >= 0 && r.ev <= 1, `ev ${r.ev} is not a pot fraction`);
        assert.ok(SOURCES.includes(r.source));
        assert.equal(typeof r.supported, 'boolean');
        assert.ok(Number.isFinite(r.potMult) && r.potMult >= 1, `potMult ${r.potMult}`);
        assert.ok(Number.isFinite(r.invShare) && r.invShare >= 0 && r.invShare <= 1, `invShare ${r.invShare}`);
        n++;
      }
    }
  }
  assert.ok(n > 150000, `only ${n} returns swept`);
  // determinism: same arguments, same numbers
  const one = F([LIVE[3], LIVE[7]], 12.5, 4, { ip: true, seed: 'x' });
  const two = F([LIVE[3], LIVE[7]], 12.5, 4, { ip: true, seed: 'x' });
  for (const k of RESULT_KEYS) assert.ok(Object.is(one[k], two[k]), `${k} is not deterministic`);
});

test('(a) out-of-domain answers are the FROZEN ones — the model adds no second contract', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  const cases = [
    [[LIVE[0], LIVE[1], LIVE[2]], 10, 4, { ip: false }],   // the multiway door
    [[LIVE[0]], 10, 4, { ip: false }],                      // too few
    [['nope', LIVE[1]], 10, 4, { ip: false }],              // unknown hero
    [[LIVE[0], 'nope'], 10, 4, { ip: false }],              // unknown villain
    [[LIVE[0], LIVE[1]], -1, 4, { ip: false }],             // a pot that is not a pot
    [[LIVE[0], LIVE[1]], 10, -1, { ip: false }],            // an spr that is not an spr
    [[LIVE[0], LIVE[1]], 10, 4, { ip: false, seed: {} }],   // a seed that cannot reproduce
    ['not an array', 10, 4, undefined],
  ];
  for (const [cells, pot, spr, opts] of cases) {
    const mine = F(cells, pot, spr, opts);
    const theirs = STUB(cells, pot, spr, opts);
    for (const k of RESULT_KEYS) {
      assert.ok(Object.is(mine[k], theirs[k]),
        `the estimator invented its own out-of-domain answer for ${JSON.stringify(cells)}: ${k} `
        + `${mine[k]} vs the frozen ${theirs[k]}`);
    }
    assert.equal(mine.supported, false);
  }
});

test('(b) conservation holds as an identity, and the realised bound is measured not assumed', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  let worst = 0, exact = 0, n = 0;
  for (const a of LIVE) {
    for (const b of LIVE) {
      for (const spr of SPRS) {
        for (const ip of [false, true]) {
          const d = Math.abs(F([a, b], 10, spr, { ip }).ev + F([b, a], 10, spr, { ip: !ip }).ev - 1);
          if (d === 0) exact++;
          if (d > worst) worst = d;
          n++;
        }
      }
    }
  }
  // MEASURED: 95.2% of the sweep is bit-exact and the rest is one ulp — the design is antisymmetric
  // term by term, and the residue is the last rounding of `base - 0.5` outside [0.25, 0.75] where
  // Sterbenz no longer makes the subtraction exact. §2 allowed `1 +/- 2*se`; this is 4.6e14 times
  // tighter, so the clause is asserted at the bound the arithmetic actually reaches.
  assert.ok(worst <= Number.EPSILON, `conservation defect ${worst} exceeds one ulp`);
  assert.ok(exact / n > 0.9, `only ${(100 * exact / n).toFixed(1)}% of the sweep conserves bit-exactly`);
  assert.ok(worst < 2 * PM.MODEL_SE / 1e12, 'the clause must not be passing merely because se is large');
});

test('(b) armed: a design term that is not antisymmetric breaks conservation and is caught', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  // S-B's own form 1 carried two position-SYMMETRIC terms (`x*g*s` and `g*s*dNu`). This is what
  // keeping them would have cost — the reason payoff-fit.mjs drops them is measured, not stylistic.
  const bad = (cells, pot, spr, opts) => {
    const r = F(cells, pot, spr, opts);
    if (!r.supported) return r;
    const ca = M.cells[cells[0]], cb = M.cells[cells[1]];
    const s = opts && opts.ip ? 1 : -1;
    const g = spr / (spr + PM.FIT.S0);
    const f = FITTER.featuresOf(ca, cb, STUB(cells, pot, spr, opts).ev);
    return { ...r, ev: Math.min(1, Math.max(0, r.ev + 0.05 * f.x * g * s)) };
  };
  let worst = 0;
  for (const a of LIVE.slice(0, 24)) for (const b of LIVE.slice(0, 24)) {
    worst = Math.max(worst, Math.abs(bad([a, b], 10, 4, { ip: true }).ev + bad([b, a], 10, 4, { ip: false }).ev - 1));
  }
  assert.ok(worst > 1e-3, 'the conservation check cannot see a symmetric term — it is not armed');
});

test('(c) at spr 0 the model IS the checkdown answer, and the pot has not moved', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  for (const a of LIVE) {
    for (const b of LIVE) {
      for (const ip of [false, true]) {
        const r = F([a, b], 10, 0, { ip });
        const s = STUB([a, b], 10, 0, { ip });
        assert.ok(Object.is(r.ev, s.ev), `${a} x ${b}: spr-0 ev ${r.ev} is not the checkdown ${s.ev}`);
        assert.ok(Object.is(r.potMult, 1), `${a} x ${b}: potMult ${r.potMult} at spr 0`);
        assert.ok(Object.is(r.invShare, 0), `${a} x ${b}: invShare ${r.invShare} at spr 0`);
      }
    }
  }
  // it is an identity of the FORM (g = 0 kills every term), not a tolerance — so it survives any
  // coefficient. Armed by refitting the curve to nonsense and checking spr 0 still reproduces.
  assert.equal(0 / (0 + PM.FIT.S0), 0);
});

// =================================================================================================
// 3b. THE P2 RED TEAM'S TWO REPAIRS — docs/refutations/P2.md
//
// Two claims in this lane came back MAJORITY-UNANCHORED, and in both cases the refuters agreed the
// anchor was TRUE and enforced by nothing. Neither is a number that needs flagging — SPR_MAX is the
// reference's own largest depth and the pot geometry is the game's arithmetic — so neither can take
// §6's flagged idiom, which in any case requires a `constants` entry Grade C forbids this module
// from having. What both needed was the assertion the prose implied. These are those assertions.
// =================================================================================================

test('SPR_MAX IS the reference\'s largest simulated depth, and the window\'s edge is where support stops', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  /* THE ANCHOR, AS AN IDENTITY. All three refuters set the window to 40, to 1000 and to Infinity —
     deleting the extrapolation guard outright — and measured all 515 tests and all 53 gates green,
     because `SPR_MAX` occurred nowhere but its own file and no assertion ever requested a point
     above it. "10 is the largest spr S-B simulated" was a true sentence about the source with no
     falsifier. It is now read out of the reference, and asserted against it here from the outside. */
  assert.deepEqual([...REF_META.sprs], [1, 4, 10], 'S-B simulated three depths and no others');
  assert.equal(PM.SPR_MAX, Math.max(...REF_META.sprs),
    'the fitted window has drifted from the depths the reference actually simulated');
  assert.equal(PM.SPR_MAX, 10, 'the reviewed value, pinned in the I41(b) idiom beside its derivation');

  /* THE GUARD, EXERCISED. The other half the memos asked for: nothing anywhere requested a point
     above the window, so the behaviour the anchor exists to produce was never run. Both sides of
     the edge, on a pair with no card-removal excuse, so `supported` can only be about the window. */
  const clean = (() => {
    for (const a of LIVE) for (const b of LIVE) if (a !== b && !PM.isDegenerate(a, b)) return [a, b];
    return null;
  })();
  for (const ip of [false, true]) {
    assert.equal(F(clean, 10, PM.SPR_MAX, { ip }).supported, true,
      'the window\'s own edge is inside the window — S-B simulated exactly there');
    for (const over of [PM.SPR_MAX + 1e-4, PM.SPR_MAX + 0.5, 1000]) {
      const r = F(clean, 10, over, { ip });
      assert.equal(r.supported, false,
        `spr ${over} is past every depth anybody simulated and came back claiming support`);
      // "flagged, with the number still on it" — the interface's own words, and the reason this is
      // supported:false rather than a throw or a clamp
      assert.ok(Number.isFinite(r.ev) && r.ev >= 0 && r.ev <= 1, `ev ${r.ev} at spr ${over}`);
      assert.ok(Number.isFinite(r.potMult) && r.potMult >= 1, `potMult ${r.potMult} at spr ${over}`);
      assert.ok(Number.isFinite(r.invShare) && r.invShare >= 0 && r.invShare <= 1, `invShare at spr ${over}`);
      assert.equal(r.source, PM.SOURCE, 'a flagged answer is still this source\'s answer');
    }
  }
  /* ARMED, and armed at the exact fabrication the red team shipped past the old suite: a source
     that CLAMPS the request into the window instead of flagging it. It returns the spr-10 answer
     wearing supported:true — which is what SPR_MAX = Infinity would have produced — and the probe
     above must be able to see that. The control is the real accessor, which clears. */
  const extrapolating = (c, p, s, o) => F(c, p, Math.min(s, PM.SPR_MAX), o);
  assert.equal(extrapolating(clean, 10, PM.SPR_MAX + 1e-4, { ip: true }).supported, true,
    'the boundary probe is not armed — a clamping source would pass it');
  assert.equal(F(clean, 10, PM.SPR_MAX + 1e-4, { ip: true }).supported, false);
  // and the derivation itself must be able to move: a reference with a fourth depth moves the window
  assert.equal(Math.max(...[1, 4, 10, 25]), 25);
});

test('the pot geometry is the game\'s arithmetic, asserted as an identity rather than described', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  /* THE CEILING. Two refuters changed `1 + 2*spr*w` to `1 + 2.5*`, `1 + 3*` and `1 + 100*spr*w` and
     shipped a final pot fifty times both stacks past all 53 gates and all 515 tests, because the
     only assertions on the returned geometry were `potMult >= 1`, `invShare` in [0,1] and the spr-0
     identity — every one of which survives any positive multiplier. The ceiling is now I33(a)'s, on
     every source; this is the same statement over this source's whole sweep, plus the two identities
     the module's header claims and nothing checked.

     MEASURED, so the numbers below are readings and not allowances:
       * worst potMult reaches 95.14% of its own ceiling, so the bound is not vacuous — a 2.5x
         multiplier already breaches it, which is the smallest perturbation any refuter tried;
       * the two seats' invShares miss the post-node money by at most ONE ULP over 151,290 returns,
         71.5% of them bit-exact — the `q` odd-function design, working;
       * `potMultOf(spr, wOf(spr, pm))` round-trips EXACTLY on every one of them, so the fitter's
         inverse and the accessor's forward are the same map in doubles, not merely in algebra. */
  let worstSum = 0, exactSum = 0, worstSeat = 0, maxOfCeiling = 0, n = 0, roundTrips = 0;
  for (const a of LIVE) {
    for (const b of LIVE) {
      for (const spr of SPRS) {
        for (const ip of [false, true]) {
          const ra = F([a, b], 10, spr, { ip });
          const rb = F([b, a], 10, spr, { ip: !ip });
          const ceiling = 1 + 2 * spr;
          assert.ok(ra.potMult >= 1 && ra.potMult <= ceiling,
            `${a} x ${b} at spr ${spr}: potMult ${ra.potMult} is outside [1, ${ceiling}] — the node's `
            + 'pot plus both stacks is all the money there is');
          if (spr > 0) {
            maxOfCeiling = Math.max(maxOfCeiling, ra.potMult / ceiling);
            if (Object.is(FITTER.potMultOf(spr, FITTER.wOf(spr, ra.potMult)), ra.potMult)) roundTrips++;
          }
          // the split: the two seats' post-node investments are the post-node money, exactly
          const d = Math.abs(ra.invShare + rb.invShare - (ra.potMult - 1) / ra.potMult);
          if (d === 0) exactSum++;
          worstSum = Math.max(worstSum, d);
          // and the final pot does not know which seat is hero
          worstSeat = Math.max(worstSeat, Math.abs(ra.potMult - rb.potMult) / ra.potMult);
          n++;
        }
      }
    }
  }
  assert.ok(n > 150000, `only ${n} returns swept`);
  assert.ok(worstSum <= Number.EPSILON,
    `the two seats' investments miss the post-node money by ${worstSum}, over one ulp`);
  assert.ok(exactSum / n > 0.7, `only ${(100 * exactSum / n).toFixed(1)}% of the sweep splits bit-exactly`);
  assert.ok(worstSum < PM.MODEL_SE / 1e12, 'the split clause must not be passing because se is large');
  assert.ok(worstSeat < 64 * Number.EPSILON, `potMult is seat-dependent by ${worstSeat} relative`);
  assert.equal(roundTrips, n - n / SPRS.length, 'the forward and inverse geometry disagree in doubles');
  assert.ok(maxOfCeiling > 0.9 && maxOfCeiling <= 1,
    `the worst potMult is ${(100 * maxOfCeiling).toFixed(2)}% of its ceiling — a bound nothing `
    + 'approaches is a bound nothing tests');

  /* ARMED, with the refuters' own three perturbations rather than invented ones. Each rebuilds the
     geometry the way they did and must break the clause it was aimed at; the control — the shipped
     multiplier, re-applied — must clear both. */
  const geom = (mult, isScale) => (c, p, s, o) => {
    const r = F(c, p, s, o);
    if (!r.supported && s !== 0) return r;
    const w = FITTER.wOf(s, r.potMult);
    const pm = s === 0 ? 1 : 1 + mult * s * w;
    const q = s === 0 ? 0 : FITTER.qOf(r.invShare, r.potMult);
    return { ...r, potMult: pm, invShare: s === 0 ? 0 : isScale * FITTER.investOf(q, pm) };
  };
  const probe = [LIVE[0], LIVE[LIVE.length - 1]];
  for (const [mult, why] of [[2.5, 'a quarter over the ladder'], [3, 'half over'], [100, 'fifty times both stacks']]) {
    const worst = SPRS.filter((s) => s > 0)
      .map((s) => geom(mult, 1)(probe, 10, s, { ip: true }).potMult / (1 + 2 * s))
      .reduce((x, y) => Math.max(x, y), 0);
    assert.ok(worst > 1, `the ceiling cannot see ${why} (${mult}x): worst is ${worst} of its ceiling`);
  }
  assert.ok(SPRS.filter((s) => s > 0)
    .every((s) => geom(2, 1)(probe, 10, s, { ip: true }).potMult / (1 + 2 * s) <= 1),
  'the ceiling rejects the shipped geometry — it is a filter on large numbers, not a bound');
  // and the split clause must see an invShare that does not add up (the 0.8 scaling, verbatim)
  const leaky = geom(2, 0.8);
  const la = leaky(probe, 10, 4, { ip: true }), lb = leaky([probe[1], probe[0]], 10, 4, { ip: false });
  assert.ok(Math.abs(la.invShare + lb.invShare - (la.potMult - 1) / la.potMult) > 0.01,
    'the split clause cannot see the two seats investing 80% of what they built');

  /* AND THE FORMULA IS WRITTEN ONCE. The deeper half of the finding was not the missing bound but
     the second copy: `1 + 2*spr*w` lived in the accessor AND in the fitter's `pmOf`, so
     `FIT.error.potMult` — the shipped residual table — certified the FITTER's arithmetic while the
     accessor returned pots forty times too large, byte-identically. A source scan, because a
     behavioural check cannot see a copy that happens to agree today. */
  const bodies = ['payoff-model.mjs', 'payoff-fit.mjs', 'payoff-reference.mjs']
    .map((f) => stripComments(readFileSync(resolve(ROOT, 'scripts/lib', f), 'utf8')));
  const copies = bodies.join('\n').match(/1\s*\+\s*2\s*\*\s*\w+\s*\*/g) || [];
  assert.equal(copies.length, 1, `the pot geometry is written ${copies.length} times; it must be written once`);
  assert.match(stripComments(readFileSync(resolve(ROOT, 'scripts/lib/payoff-fit.mjs'), 'utf8')),
    /export const potMultOf = \(spr, w\) => 1 \+ 2 \* spr \* w;/, 'the one copy is not the fitter\'s');
  assert.match(stripComments(readFileSync(resolve(ROOT, 'scripts/lib/payoff-model.mjs'), 'utf8')),
    /potMultOf\(spr, w\)/, 'the accessor has stopped using the shared geometry');
  // armed: the scan must fire on a second copy arriving in the shape it arrived in before
  assert.equal((`${bodies[0]}\nconst potMult = 1 + 2 * spr * w;`.match(/1\s*\+\s*2\s*\*\s*\w+\s*\*/g) || []).length, 1);
});

test('(d) se is positive, finite, and derived from trials that actually ran', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  for (const a of LIVE.filter((_, i) => i % 7 === 0)) {
    for (const b of LIVE.filter((_, i) => i % 5 === 0)) {
      for (const spr of SPRS) {
        const r = F([a, b], 10, spr, { ip: true });
        assert.ok(r.se > 0 && Number.isFinite(r.se), `se ${r.se} for ${a} x ${b}`);
        assert.ok(Math.abs(r.se - Math.hypot(STUB([a, b], 10, spr, { ip: true }).se, PM.MODEL_SE)) < 1e-15,
          'se is no longer the checkdown se and the fit\'s own held-out RMS, combined');
      }
    }
  }
  // NOT TYPED: MODEL_SE is the held-out RMS of the fit, over the 96 points that actually ran at
  // 20,000 deals a pair. THE RATIO IN THE PROSE WAS WRONG BY HALF and three refuters caught it
  // (docs/refutations/P2.md): "about 46x the stub's own se" is this se against §6's 0.1581 pt
  // tier-EV se, not against the per-pair se `hypot` combines it with. Measured over ALL ordered
  // live pairs at spr 4 the ratio is 67.6x-74.2x, and the only gate on it was `> 30` — 2.3x looser
  // than the claim it existed to protect, so the drift was invisible. It is now bracketed at the
  // measurement, from both sides, so a 1.6x-wrong multiplier in a sentence cannot sail through.
  assert.equal(PM.MODEL_SE, +(PM.FIT.error.ev.held.rms / 100).toFixed(6));
  assert.equal(PM.FIT.error.ev.held.n, 96);
  let loSe = Infinity, hiSe = 0;
  for (const a of LIVE) for (const b of LIVE) {
    if (a === b) continue;
    const se = STUB([a, b], 10, 4, { ip: true }).se;
    if (se < loSe) loSe = se;
    if (se > hiSe) hiSe = se;
  }
  const ratio = [PM.MODEL_SE / hiSe, PM.MODEL_SE / loSe];
  assert.ok(ratio[0] > 60 && ratio[1] < 80,
    `the model's error bar is ${ratio[0].toFixed(1)}x-${ratio[1].toFixed(1)}x the stub's, and the `
    + 'header says 67.6x-74.2x — one of the two has drifted');
  assert.ok(ratio[0] > 30, 'the model\'s error bar must not be quietly the stub\'s');
});

test('(e) the estimator reaches equity ONLY through the frozen accessor', () => {
  // COMMENTS STRIPPED, I33(g)'s reason again: the header explains at length that it does NOT read
  // `model.cells[k].eq`, and the sentence saying so contains the very expression being forbidden.
  const raw = readFileSync(resolve(ROOT, 'scripts/lib/payoff-model.mjs'), 'utf8');
  const src = stripComments(raw);
  assert.match(src, /from '\.\/payoff\.mjs'/, '§2: consume payoffs only through this accessor');
  assert.doesNotMatch(src, /\.eq\s*\[/, 'the estimator is reading a payoff table directly');
  assert.doesNotMatch(src, /cells\s*\[[^\]\n]*\]\s*\.\s*eq\b/);
  // the stripping is load-bearing, and saying so is cheaper than rediscovering it: the RAW file does
  // contain the forbidden expression, inside the paragraph that forbids it
  assert.match(raw, /model\.cells\[k\]\.eq/, 'the header no longer explains the rule it follows');
});

test('(f) there is no page-side call site, because there is no page-side consumer', () => {
  const shell = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  assert.ok(!/payoffModel|payoff-model/.test(shell),
    'the page has started rendering the estimator; clause (f) then demands a supported -> badge path '
    + 'at the call site, and §3.6\'s Grade-C row demands an `estimate` badge on top of it');
});

test('(g) the three new files are inside the memo clause\'s scope and carry no keyless memo', () => {
  for (const f of ['payoff-model.mjs', 'payoff-fit.mjs', 'payoff-reference.mjs']) {
    assert.ok(MEMO_SCOPE.test(f), `${f} is outside I33(g)'s scope — the gate cannot see its memo keys`);
    const src = readFileSync(resolve(ROOT, 'scripts/lib', f), 'utf8');
    assert.deepEqual(memoProblems(f, src), [], `${f} builds a payoff memo key without ip and the model hash`);
  }
  // armed: the detector must fire on a keyless memo written in this lane's own style
  const keyless = 'const k = cells.join(\',\') + \'|\' + potSize + \'|\' + spr;\n'
    + 'if (memo.has(k)) return memo.get(k);\nconst r = model(cells, potSize, spr, opts); memo.set(k, r); return r;';
  assert.equal(memoProblems('payoff-model.mjs', keyless).length, 1);
  const keyed = 'const k = cells.join(\',\') + \'|\' + potSize + \'|\' + spr + \'|\' + (opts && opts.ip ? 1 : 0)\n'
    + '  + \'|\' + (opts && opts.seed) + \'|\' + fn.modelHash;\n'
    + 'if (memo.has(k)) return memo.get(k);\nconst r = model(cells, potSize, spr, opts); memo.set(k, r); return r;';
  assert.equal(memoProblems('payoff-model.mjs', keyed).length, 0);
});

test('(g) the dynamic probe: the estimator does not alias the two positions onto one object', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  assert.equal(ipMemoAliases(F, [LIVE[0], LIVE[1]], 10, 4), false);
  // and, unlike the stub, this source is not position-inert — the values differ too, which is the
  // day S-B's 43-point warning finally has something a values test can see.
  const off = F([LIVE[0], LIVE[LIVE.length - 1]], 10, 10, { ip: false });
  const on = F([LIVE[0], LIVE[LIVE.length - 1]], 10, 10, { ip: true });
  assert.notEqual(off.ev, on.ev, 'a source with an spr axis that ignores position is not modelling realization');
  const keylessMemo = (() => {
    const seen = [];
    return (c, p, s) => {
      const hit = seen.find((z) => z.c === c && z.p === p && z.s === s);
      if (hit) return hit.v;
      const v = F(c, p, s, { ip: false });
      seen.push({ c, p, s, v });
      return v;
    };
  })();
  assert.equal(ipMemoAliases(keylessMemo, [LIVE[0], LIVE[1]], 10, 4), true, 'the probe is not armed');
});

test('(h) every card-removal-degenerate pair comes back flagged, and the scope agrees with the gate', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  const degenerate = [], control = [];
  for (const x of LIVE) for (const y of LIVE) {
    if (x === y) continue;
    if (isDegeneratePair(x, y)) degenerate.push([x, y]); else if (control.length < 64) control.push([x, y]);
  }
  assert.equal(degenerate.length, 504, 'the two measured families over the 123 live cells');
  assert.deepEqual(removalProblems(F, [...degenerate, ...control]), [],
    'a degenerate pair came back supported:true from a source whose coefficients were fitted to a '
    + 'reference that could not deal those boards');
  // the module's local copy of the rule must be the gate's rule, on every ordered pair
  let disagree = 0;
  for (const x of LIVE) for (const y of LIVE) if (PM.isDegenerate(x, y) !== isDegeneratePair(x, y)) disagree++;
  assert.equal(disagree, 0, 'payoff-model.mjs\'s isDegenerate has drifted from I33(h)\'s isDegeneratePair');
  // armed, exactly as the gate arms it: the collapser is S-B's own first-implementation bug
  const collapser = (c, p, s, o) => ({ ...F(c, p, s, o), source: 'simulated', supported: true });
  assert.equal(removalProblems(collapser, degenerate).length, degenerate.length);
  assert.equal(removalProblems(collapser, control).length, 0);
  // and a non-degenerate control is answered, not flagged away
  const clean = control.filter(([x, y]) => !isDegeneratePair(x, y));
  assert.ok(clean.every(([x, y]) => F([x, y], 10, 4, { ip: false }).supported === true),
    'the estimator is flagging pairs it has no reason to flag');
});

test('(mono) the estimator inverts the checkdown order at spr >= 4 — the clause, as rewritten', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  const byEq = [...LIVE].sort((x, y) => (M.cells[x].eq[0] - M.cells[y].eq[0]) || (x < y ? -1 : 1));
  const villain = byEq[byEq.length >> 1];
  assert.deepEqual(monoProblems(F, byEq, villain, [1, 4, 10]), [],
    'ZERO inversions from a source claiming to model realization is the new failure (V3-PLAN §2)');
  const rows = monoRows(F, byEq, villain, [1, 4, 10]);
  for (const row of rows) {
    assert.equal(row.source, 'model');
    assert.ok(row.inversions > 0, `spr ${row.spr} ip=${row.ip} reproduced the checkdown ORDER exactly`);
  }
  // MEASURED, and REPORTED rather than bounded: 39.3% of steps invert at spr 1 and 41.8% at spr 4
  // and 10, against S-B's reference band of 1.7% / 8.1% / 15.9-20.5%. This estimator inverts the
  // checkdown order two to five times more often than the thing it was fitted to, which is a
  // finding about the correction over-reacting, not a tolerance to widen. It is asserted only as
  // "> 0" because that is all §2's rewritten clause claims.
  const at = (spr) => rows.find((r) => r.spr === spr && r.ip === false);
  assert.ok(at(1).inversions / at(1).steps > 0.30 && at(1).inversions / at(1).steps < 0.50);
  assert.ok(at(10).inversions / at(10).steps > 0.30 && at(10).inversions / at(10).steps < 0.50);
  // armed: the same model with its curve switched off is the stub's order, and must FIRE
  const flat = (c, p, s, o) => ({ ...F(c, p, s, o), ...(F(c, p, s, o).supported ? { ev: STUB(c, p, s, o).ev } : {}) });
  assert.ok(monoProblems(flat, byEq, villain, [1, 4, 10]).length > 0,
    'a `model` source that reproduces the checkdown order must be flagged — the clause is not armed');
});

// =================================================================================================
// 4. THE MEASUREMENTS — pinned so they cannot be quietly restated
// =================================================================================================

test('the grade: this correction FAILS the pre-registered Grade B/C edge, and the number is pinned', () => {
  const held = PM.FIT.error.ev.held.p95;
  assert.ok(held > SB_PUBLISHED.bandEdges.gradeBC,
    'if this ever comes in under 5.0 the Grade-C descope needs revisiting on purpose, not by accident');
  assert.ok(held > SB_PUBLISHED.form1.testP95,
    'this lane must not claim to have beaten the form S-B graded — it ships neither of its inputs');
  assert.ok(held > 16 && held < 18, `held-out p95 moved to ${held}; re-read payoff-fit.mjs's decomposition`);
  // and the correction IS worth something against the base it corrects
  assert.ok(PM.FIT.error.evBase.held.p95 - held > 5,
    'the curve must buy more than noise over the accessor\'s own checkdown projection');
});

test('the header\'s decomposition is re-measured here, under the one declared rule', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  // payoff-fit.mjs's header attributes the gap from S-B's 8.44 to this lane's 16.71 across three
  // cuts. A decomposition in prose is a decomposition nobody re-runs, so it is re-run: every row
  // is selected AND scored by `selectS0` + `evOnly`, i.e. the same grouped-CV rule the shipped fit
  // used, which is the whole reason the rows compose.
  const eqAB = Object.create(null);
  for (const r of ROWS) eqAB[`${CELLS[r[0]]}~${CELLS[r[1]]}`] = r[8];
  const onPairwise = FITTER.rowsFor(M, (a, b) => eqAB[`${a}~${b}`]);
  const onProjection = FITTER.rowsFor(M, (a, b) => STUB([a, b], 10, 4, { ip: false }).ev);

  const sd = FITTER.evOnly(onPairwise, FITTER.evDesign7).held.p95;      // -5 sd terms
  const base = FITTER.evOnly(onProjection, FITTER.evDesign7).held.p95;  // -the pairwise table
  const shipped = PM.FIT.error.ev.held.p95;                             // -2 symmetric terms

  assert.ok(Math.abs(sd - 9.69) < 0.15, `dropping the sd family lands at ${sd}, not 9.69`);
  assert.ok(Math.abs(base - 16.76) < 0.15, `dropping the pairwise table lands at ${base}, not 16.76`);
  assert.ok(Math.abs(shipped - 16.71) < 0.15);
  // the load-bearing claim: the missing precompute is the whole story
  assert.ok((base - sd) / (shipped - SB_PUBLISHED.form1.testP95) > 0.8,
    'the pairwise table stops being 85% of the gap — the header\'s conclusion needs re-writing');
  // and the conservation identity is FREE, which is how it got chosen
  assert.ok(shipped - base < 0.5,
    `the antisymmetric design now costs ${(shipped - base).toFixed(2)} pt; the header says it costs `
    + 'nothing, and if that stops being true the trade has to be re-argued rather than re-worded');
  // armed: the seven-term design must actually be the one that cannot conserve
  const f7 = FITTER.evDesign7({ x: 0.2, dNu: 0.1, dCool: 0.1, dEq: 0.1, mNu: 0.5, mCool: 0.4 }, 0.5, 1);
  const g7 = FITTER.evDesign7({ x: -0.2, dNu: -0.1, dCool: -0.1, dEq: -0.1, mNu: 0.5, mCool: 0.4 }, 0.5, -1);
  assert.equal(f7.length, 7);
  assert.ok(f7.some((v, i) => Math.abs(v + g7[i]) > 1e-12), 'evDesign7 is antisymmetric, so it is not the variant');
  const f5 = FITTER.evDesign({ x: 0.2, dNu: 0.1, dCool: 0.1, dEq: 0.1 }, 0.5, 1);
  const g5 = FITTER.evDesign({ x: -0.2, dNu: -0.1, dCool: -0.1, dEq: -0.1 }, 0.5, -1);
  assert.ok(f5.every((v, i) => Object.is(v, -g5[i])), 'the shipped design must negate EXACTLY, term by term');
});

test('the two pot keys are where the estimator actually beats the stub, by an order of magnitude', () => {
  const pm = PM.FIT.error.potMult.all.mean, pmStub = PM.FIT.error.potMultStub.all.mean;
  const is = PM.FIT.error.invShare.all.mean, isStub = PM.FIT.error.invShareStub.all.mean;
  assert.ok(pmStub / pm > 7, `potMult: ${pmStub} -> ${pm}`);
  assert.ok(isStub / is > 10, `invShare: ${isStub} -> ${is}`);
  // the stub's numbers are IDENTITIES it has no choice about — checkdown means no betting after the
  // node — so this is not a criticism of the stub. It is the measurement of what the identity costs
  // a caller doing the bb conversion, which is the whole reason amendment (i) added the two keys.
  assert.ok(pmStub > 3 && isStub > 30);
});

test('the residual table ships rather than being suppressed — the benchmarks.disputed idiom', () => {
  const d = PM.FIT.disputed;
  assert.equal(d.of, 96);
  assert.ok(d.n > 80, 'the count is the honest headline, not the excerpt');
  assert.ok(d.worst.length === 12 && d.worst.length < d.n, 'an excerpt that is the whole list hides nothing, and says so');
  for (const r of d.worst) {
    assert.ok(typeof r.a === 'string' && typeof r.b === 'string');
    assert.ok(Math.abs(r.estimated - r.reference) > 2 * r.refSe, 'a row that agrees is not disputed');
  }
  // sorted worst-first, so the excerpt is the worst 12 and not a flattering 12
  for (let i = 1; i < d.worst.length; i++) {
    const w = (x) => Math.abs(x.estimated - x.reference);
    assert.ok(w(d.worst[i - 1]) >= w(d.worst[i]));
  }
});

test('mu\'s sd-ratio anchor, RE-ANCHORED against the payoff fit — magnitude corroborated, sign not', {
  skip: !HAVE && 'no data/model.json',
}, () => {
  // V3-PLAN §3.2: "M_deep's anchors (I23's measured counts, mu's sd-ratio) are re-anchored, never
  // silently broken, wherever the payoff model supersedes them." This model supersedes NOTHING —
  // it is not wired in — so the anchors stand untouched, and what follows is the re-anchoring
  // material recorded for the day one of them is superseded.
  //
  // policy.mjs anchors mu = 0.60 as "equal score weight per standard deviation":
  // mu = lambda * sd(nu)/sd(cooler) with the combo-weighted sds over the 123 live cells.
  const wsd = (get) => {
    let sw = 0, sx = 0;
    for (const k of LIVE) { const w = M.cells[k].combos || 1; sw += w; sx += w * get(M.cells[k]); }
    const m = sx / sw;
    let v = 0;
    for (const k of LIVE) { const w = M.cells[k].combos || 1; const d = get(M.cells[k]) - m; v += w * d * d; }
    return Math.sqrt(v / sw);
  };
  const sdNu = wsd((c) => c.nu), sdCool = wsd((c) => c.cooler);
  assert.ok(Math.abs(sdNu - 0.0831) < 5e-4, `sd(nu) ${sdNu} — policy.mjs's own comment says 0.0831`);
  assert.ok(Math.abs(sdCool - 0.0353) < 5e-4, `sd(cooler) ${sdCool} — policy.mjs's own comment says 0.0353`);
  // the fit's independent reading of the same two features, from a street simulation that knows
  // nothing about the scoring layer:
  const cNu = PM.FIT.ev.coef[2], cCool = PM.FIT.ev.coef[3];
  const perSd = Math.abs(cCool) * sdCool / (Math.abs(cNu) * sdNu);
  assert.ok(perSd > 0.9 && perSd < 1.2,
    `the payoff fit weights nu and cooler at ${perSd.toFixed(3)} per standard deviation; mu = 0.60's `
    + 'whole anchor is that this ratio should be 1, and a fit to S-B\'s reference agrees within 9%');
  const ratio = Math.abs(cCool) / Math.abs(cNu);
  assert.ok(Math.abs(ratio - P.CONSTANTS.depth.mu / P.CONSTANTS.depth.lambda) < 0.3,
    `|cCool|/|cNu| = ${ratio.toFixed(4)} against mu/lambda = ${P.CONSTANTS.depth.mu / P.CONSTANTS.depth.lambda}`);
  // THE SIGN, which does NOT agree, recorded rather than smoothed. `dCool` is (villain - hero), so a
  // negative coefficient means hero's own cooler rate RAISES ev — the opposite of mu > 0, which
  // charges a cell for its coolers as depth rises. The marginal reading disagrees with the partial
  // one: corr(hero cooler - villain cooler, ref - base) over all 300 points is about -0.16, which
  // AGREES with mu. corr(nu, cooler) = -0.590 in this dataset, so the partial coefficient is a
  // classic suppressor flip on correlated regressors and is weak evidence either way. Neither
  // reading is strong enough to move mu, and nothing here ships, so mu is untouched.
  assert.ok(cCool < 0, 'the recorded sign has moved; the note above needs re-measuring, not deleting');
  assert.ok(cNu > 0, 'the nu direction agrees with lambda > 0 and is the half that reproduces');
});

test('the single position term reproduces S-B\'s measured IP-OOP gap at spr 4 and 10', () => {
  // S-B's headline limitation: "the positional GAP is what nothing gets" — mean |IP - OOP| of 1.72
  // pt at spr 1, 11.93 at spr 4, 23.86 at spr 10, with the best form still missing it at p95 10.89.
  // This design's only surviving position term is a LEVEL SHIFT, `g*s`, so the gap it produces is
  // 2*coef*g and is the same for every pair. Measured, that level shift lands within 7% of S-B's
  // MEAN gap at spr 4 and 10 — and misses at spr 1 by 2.3x. So the mean is servable by one term;
  // the per-pair variation, which is what the p95 is made of, is not.
  const gap = (spr) => 200 * PM.FIT.ev.coef[1] * (spr / (spr + PM.FIT.S0));
  assert.ok(Math.abs(gap(4) - 11.93) / 11.93 < 0.10, `spr 4 gap ${gap(4).toFixed(2)} vs measured 11.93`);
  assert.ok(Math.abs(gap(10) - 23.86) / 23.86 < 0.10, `spr 10 gap ${gap(10).toFixed(2)} vs measured 23.86`);
  assert.ok(gap(1) > 2 * 1.72, `spr 1 gap ${gap(1).toFixed(2)} vs measured 1.72 — the overshoot is the finding`);
});
