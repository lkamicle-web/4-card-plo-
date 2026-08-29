// node --test test/*.test.mjs
//
// Gate reproductions for the three gates phase 1 added to scripts/verify.mjs — I24 (the cooler
// rate's shape, V2-PLAN §2.1), I25 (the villain-VPIP lattice's shape, §2.3) and D7 (the §2.5
// payload ceiling). Same discipline as the D1/D2/I17 reproductions in taxonomy.test.mjs: the
// assertion is re-derived here from the committed data/model.json rather than by calling
// verifyModel(), so a rewrite of the gate that quietly drops an assertion still fails here.
//
// Several of these tests exist to pin down what the gates deliberately do NOT assert — the
// per-row pair ladder that the taxonomy cannot express, and the "junk loses most" prediction that
// the measurement falsified. Those are the two places where a future reader is most likely to
// "fix" a gate back into asserting something untrue.
//
// Skipped on a --fast dataset: the thresholds below are the full-precision ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const HAVE_MODEL = existsSync(MODEL_PATH);
const M = HAVE_MODEL ? JSON.parse(readFileSync(MODEL_PATH, 'utf8')) : null;
const SKIP = !HAVE_MODEL || !!M.meta.fast;

const LIVE = M ? Object.keys(M.cells).filter((k) => M.cells[k].combos > 0) : [];
const BAND = {};
if (M) for (const r of M.rows) BAND[r.key] = r.band;
const rowOf = (k) => k.split('|')[0];
const bandMean = (band) => {
  let num = 0, den = 0;
  for (const k of LIVE) {
    if (BAND[rowOf(k)] !== band) continue;
    num += M.cells[k].combos * M.cells[k].cooler; den += M.cells[k].combos;
  }
  return num / den;
};

// ---------------------------------------------------------------------------
// I24 — the cooler rate
// ---------------------------------------------------------------------------
test('I24: the cooler ladder is a three-step BAND ladder, AA < big pairs < small pairs', { skip: SKIP }, () => {
  const aa = bandMean('AA'), bp = bandMean('BIGPAIR'), sp = bandMean('SMALLPAIR');
  assert.ok(bp - aa >= 0.03, `AA ${aa.toFixed(4)} -> big pairs ${bp.toFixed(4)}`);
  assert.ok(sp - bp >= 0.03, `big pairs ${bp.toFixed(4)} -> small pairs ${sp.toFixed(4)}`);
  // the shipped measurement, to 3 dp: 0.3184 / 0.3563 / 0.4386
  assert.ok(Math.abs(aa - 0.3184) < 0.02 && Math.abs(bp - 0.3563) < 0.02 && Math.abs(sp - 0.4386) < 0.02);
});

test('I24: the ladder is NOT assertable per row — which is why the gate is written at band level', { skip: SKIP }, () => {
  // V2-PLAN §2.1 asked for TT > JJ > QQ > KK > AA. `rowOf` splits pairs at J, so that ordering is
  // not expressible; and the row means are not even ordered inside a band. This test records the
  // counterexamples so nobody "tightens" I24 into a per-row gate and gets a red build for it.
  const rowMean = (row) => {
    let num = 0, den = 0;
    for (const k of LIVE) {
      if (rowOf(k) !== row) continue;
      num += M.cells[k].combos * M.cells[k].cooler; den += M.cells[k].combos;
    }
    return num / den;
  };
  assert.ok(rowMean('AA_SMALLPAIR') > rowMean('BIGPAIR_CONN'),
    'an AA row sits above a big-pair row (AA_SMALLPAIR 0.3453 > BIGPAIR_CONN 0.3216)');
  assert.ok(rowMean('DBLPAIR_MIXED') > rowMean('AA_SMALLPAIR'),
    'a big-pair row sits above every AA row (DBLPAIR_MIXED 0.3942)');
});

test('I24: cooler(SSA) <= cooler(SS) + 0.01 in every row carrying both columns', { skip: SKIP }, () => {
  let both = 0, strict = 0, thinnest = Infinity;
  for (const r of M.rows) {
    const a = M.cells[`${r.key}|SSA`], b = M.cells[`${r.key}|SS`];
    if (!a || !b || !a.combos || !b.combos) continue;
    both++;
    const d = a.cooler - b.cooler;
    assert.ok(d <= 0.01, `${r.key}: SSA ${a.cooler} vs SS ${b.cooler}`);
    if (d < 0) { strict++; thinnest = Math.min(thinnest, -d); }
  }
  assert.equal(both, 18, '18 rows carry both an SSA and an SS cell');
  assert.equal(strict, 18, 'all 18 hold strictly in the shipped data');
  // and the reason the GATE carries a tolerance rather than asserting the strict form: the
  // thinnest margin is inside the measurement error of two independent runs (difference SE ~0.004).
  assert.ok(thinnest < 0.004 * 2, `thinnest strict margin ${thinnest.toFixed(3)} is under 2 SE`);
});

test('I24: rank anchors — 2233r near the top, AA_BIGPAIR|DS near the bottom', { skip: SKIP }, () => {
  const byCooler = LIVE.slice().sort((x, y) => M.cells[y].cooler - M.cells[x].cooler);
  const top = byCooler.indexOf('DBLPAIR_SMALL|RB') + 1;
  const bottom = byCooler.length - byCooler.indexOf('AA_BIGPAIR|DS');
  assert.ok(top >= 1 && top <= 8, `DBLPAIR_SMALL|RB is rank ${top} of ${byCooler.length}`);
  assert.ok(bottom >= 1 && bottom <= 8, `AA_BIGPAIR|DS is rank ${bottom} from the bottom`);
});

test('I24: every cooler is a probability, inside the measured envelope', { skip: SKIP }, () => {
  let cMin = Infinity, cMax = -Infinity, sMin = Infinity, sMax = -Infinity, nSub = 0;
  for (const k of LIVE) {
    const c = M.cells[k].cooler;
    assert.ok(c >= 0 && c <= 1, `${k} cooler ${c}`);
    cMin = Math.min(cMin, c); cMax = Math.max(cMax, c);
  }
  for (const k of Object.keys(M.sub)) for (const s of M.sub[k]) {
    assert.ok(s.cooler >= 0 && s.cooler <= 1, `${k} # ${s.key} cooler ${s.cooler}`);
    nSub++; sMin = Math.min(sMin, s.cooler); sMax = Math.max(sMax, s.cooler);
  }
  assert.equal(nSub, 341);
  assert.ok(cMin >= 0.15 && cMax <= 0.65, `cells ${cMin}-${cMax} inside [0.15, 0.65]`);
  assert.ok(sMin >= 0.15 && sMax <= 0.85, `sub-buckets ${sMin}-${sMax} inside [0.15, 0.85]`);
});

test('I24: constants.coolerBarMeasured rebuilds from the shipped cells', { skip: SKIP }, () => {
  let num = 0, den = 0;
  for (const k of LIVE) { num += M.cells[k].combos * M.cells[k].cooler; den += M.cells[k].combos; }
  assert.equal(den, 270725);
  assert.ok(Math.abs(num / den - M.constants.coolerBarMeasured) <= 0.002,
    `rebuilt ${(num / den).toFixed(5)} vs shipped ${M.constants.coolerBarMeasured}`);
});

// ---------------------------------------------------------------------------
// I25 — the villain-VPIP lattice
// ---------------------------------------------------------------------------
const V = M ? (M.constants.villainLattice || {}).v || [] : [];
const NM = M ? M.meta.nMax : 0;
const latStat = () => V.map((v, vi) => {
  let sum = 0, sumAbs = 0, n = 0, max = 0;
  for (const k of LIVE) for (const d of M.cells[k].vDelta[vi]) {
    sum += d; sumAbs += Math.abs(d); n++; max = Math.max(max, Math.abs(d));
  }
  return { v, mean: sum / n, meanAbs: sumAbs / n, max };
});

test('I25: v=90 is close to the random baseline, but not equal to it', { skip: SKIP }, () => {
  const hi = latStat()[V.length - 1];
  assert.equal(hi.v, 90);
  assert.ok(hi.meanAbs <= 1.2, `mean |delta| ${hi.meanAbs.toFixed(2)} pt`);
  assert.ok(hi.max <= 5.0, `worst cell ${hi.max} pt`);
  // the half that matters for anyone re-pinning the tolerance: it is NOT zero, so a gate written
  // as "v=90 == random" with a tolerance under ~4 pt fails on the shipped data.
  assert.ok(hi.max > 3.0, `worst cell ${hi.max} pt is a real deviation, not noise`);
});

test('I25: the lattice converges monotonically on the baseline as v loosens', { skip: SKIP }, () => {
  const s = latStat();
  for (let i = 1; i < s.length; i++) {
    assert.ok(s[i - 1].meanAbs - s[i].meanAbs >= 0.2,
      `v=${s[i - 1].v} ${s[i - 1].meanAbs.toFixed(2)} -> v=${s[i].v} ${s[i].meanAbs.toFixed(2)}`);
  }
});

test('I25: at v=25 the biggest losers are rank overlap, not weakness', { skip: SKIP }, () => {
  const lo = V.indexOf(25);
  const at = (k, n) => M.cells[k].vDelta[lo][n - 1];
  for (const n of [1, 3, 5]) {
    const worst = LIVE.map((k) => [k, at(k, n)]).sort((a, b) => a[1] - b[1]).slice(0, 6);
    for (const [k] of worst) {
      assert.ok(['BROADWAY_RUN', 'RUN0_HIGH'].includes(rowOf(k)), `N=${n}: ${k} among the six worst`);
    }
  }
  assert.ok(at('BROADWAY_RUN|RB', 1) <= -15, `BROADWAY_RUN|RB N=1 ${at('BROADWAY_RUN|RB', 1)}`);
  assert.ok(at('RUN0_HIGH|DS', 3) <= -8, `RUN0_HIGH|DS N=3 ${at('RUN0_HIGH|DS', 3)}`);
  // V2-PLAN §2.3 predicted junk would lose the most. It does not, and no gate asserts that it
  // does. This is the measurement that killed the prediction; keep it visible.
  assert.ok(at('TRASH|RB', 3) > 0, `TRASH|RB GAINS multiway against a tight pool: ${at('TRASH|RB', 3)}`);
  assert.ok(at('SMPAIR_JUNK|SS', 3) > 0, `SMPAIR_JUNK|SS ${at('SMPAIR_JUNK|SS', 3)}`);
});

test('I25: at v=25 the low rundowns gain, and gain most', { skip: SKIP }, () => {
  const lo = V.indexOf(25);
  const at = (k, n) => M.cells[k].vDelta[lo][n - 1];
  for (const n of [1, 3, 5]) {
    const best = LIVE.map((k) => [k, at(k, n)]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    for (const [k] of best) {
      assert.ok(['RUN0_LOW', 'RUN1_TOPMID', 'RUN1_BOTTOM'].includes(rowOf(k)), `N=${n}: ${k} among the six best`);
    }
  }
  for (const k of LIVE.filter((x) => rowOf(x) === 'RUN0_LOW')) {
    for (let j = 0; j < NM; j++) assert.ok(M.cells[k].vDelta[lo][j] > 0, `${k} N=${j + 1}`);
  }
  assert.ok(at('RUN0_LOW|SSA', 1) >= 5 && at('RUN0_LOW|SSA', 3) >= 5);
});

test('I25: the filtered field is not uniform — which is why I4/I5 stay scoped to random villains', { skip: SKIP }, () => {
  for (const s of latStat()) {
    assert.ok(s.mean < 0, `v=${s.v} combo-weighted mean delta ${s.mean.toFixed(2)} pt`);
  }
});

// ---------------------------------------------------------------------------
// D7 — the payload ceiling
// ---------------------------------------------------------------------------
test('D7: model.json as emitted is inside the 220 KB ceiling, and that IS the file on disk', { skip: !HAVE_MODEL }, () => {
  const emitted = Buffer.byteLength(JSON.stringify(M));
  assert.equal(emitted, statSync(MODEL_PATH).size,
    'the gate measures JSON.stringify(model), which is byte-for-byte what generate-data.mjs writes');
  assert.ok(emitted <= 220 * 1024, `${(emitted / 1024).toFixed(1)} KB of 220 KB`);
  // Recorded, not asserted, and the reason D7 reads the minified file: pretty-printed the shipped
  // payload is 241.7 KB, and V2-PLAN §2.5's own fallback (three lattice rows) is 221.0 KB — the
  // literal pretty-printed reading is unsatisfiable by the plan's own remedy.
  assert.ok(Buffer.byteLength(JSON.stringify(M, null, 1)) > emitted);
});
