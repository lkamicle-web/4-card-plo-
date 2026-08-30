// sim-bundle.test.mjs — the browser Simulate engine's bundle, its worker entry twin, and the
// question the whole of Workstream C stands or falls on: does the code the PAGE runs measure the
// same thing the GENERATOR measured?
//
// The bundle is a flat classic script assembled from module slices, which is exactly the kind of
// build step that can silently drift — a Node import creeping into the portable region, taxonomy
// being dragged in, a slice marker moved. Every one of those is asserted here, and the last test
// runs the shipped kernel at a lattice point and checks it lands on the shipped number.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script, createContext } from 'node:vm';

import { buildSimBundle, asJsString } from '../scripts/lib/sim-bundle.mjs';
import { minify } from '../scripts/lib/jsmin.mjs';
import { enumerateAll } from '../scripts/lib/taxonomy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));

const RAW = buildSimBundle();
const MIN = buildSimBundle(minify);
const ENGINE = new Function(MIN.kernel + '\nreturn PLO_ENGINE;')();

let E;                                  // the enumeration, built once — it costs ~700 ms
function enumeration() { return (E = E || enumerateAll()); }
let CT, ORDER;
function classes() {
  if (!CT) {
    CT = ENGINE.vrange.classTableCanonical(enumeration().byCell);
    ORDER = ENGINE.order.unpackOrder(MODEL.order.packed, MODEL.order.n);
  }
  return { ct: CT, order: ORDER };
}

test('both halves parse as classic Programs, minified and not', () => {
  for (const [label, b] of [['raw', RAW], ['minified', MIN]]) {
    for (const half of ['kernel', 'entry']) {
      assert.doesNotThrow(() => new Script(b[half]), `${label} ${half}`);
    }
  }
  assert.ok(MIN.worker.length < RAW.worker.length, 'minification does something');
});

test('nothing Node-only, and no module syntax, survives into the bundle', () => {
  const src = RAW.worker;
  for (const bad of ['node:worker_threads', 'node:url', 'fileURLToPath', 'import.meta',
    'isMainThread', 'parentPort', 'workerData', 'require(']) {
    assert.ok(!src.includes(bad), `the bundle must not contain "${bad}"`);
  }
  assert.ok(!/^\s*import\s/m.test(src), 'no import statements');
  assert.ok(!/^\s*export\s/m.test(src), 'no export statements');
});

test('taxonomy.mjs is NOT in the bundle', () => {
  /* Deliberate, and worth a gate: `rowOf` pulls in 22 KB the worker has no use for, because the
     hero pools it needs are built on the main thread and travel in the boot payload. */
  const src = RAW.worker;
  for (const bad of ['ROW_ORDER', 'function rowOf', 'BROADWAY_RUN', 'subKeyOf', 'parseHandQuery']) {
    assert.ok(!src.includes(bad), `the worker bundle must not contain "${bad}"`);
  }
  assert.ok(!Object.prototype.hasOwnProperty.call(ENGINE, 'taxonomy'));
});

test('the assembled engine exposes exactly the surface the entry twin uses', () => {
  assert.deepEqual(Object.keys(ENGINE).sort(), ['eval5', 'job', 'mc', 'order', 'villains', 'vrange']);
  assert.equal(typeof ENGINE.mc.runMulti, 'function');
  assert.equal(typeof ENGINE.mc.runMultiFiltered, 'function');
  assert.equal(typeof ENGINE.villains.sampleFromRange, 'function');
  assert.equal(typeof ENGINE.vrange.classTableCanonical, 'function');
  assert.equal(typeof ENGINE.vrange.cutAt, 'function');
  assert.equal(typeof ENGINE.order.unpackOrder, 'function');
  assert.equal(typeof ENGINE.job.runUnit, 'function');
  assert.equal(typeof ENGINE.job.runSlice, 'function');
  assert.equal(ENGINE.mc.NMAX, MODEL.meta.nMax);
  assert.equal(ENGINE.mc.VILLAIN_DISCIPLINE, MODEL.constants.villainLattice.discipline);
});

test('asJsString neutralises a close-script sequence', () => {
  const s = asJsString('var a = "</script>";');
  assert.ok(!s.includes('</script'), 'no literal </script survives into the page');
  assert.equal(JSON.parse(s.replace(/<\\\//g, '</')), 'var a = "</script>";');
});

test('runUnit is exactly the sum of its slices, and is deterministic', () => {
  const { ct, order } = classes();
  const P = enumeration();
  const range = ENGINE.job.buildRange(P.byCell, ct, order, 55);
  const job = { id: 0, kind: 'latt', unit: 0, key: P.cellKeys[0], stage: 'cell', hash: 'deadbeef', q: 0.85, trials: 1200 };

  const whole = ENGINE.job.runUnit(P.byCell, P.cellStart, range, job);
  assert.equal(whole.trials, 1200);
  assert.equal(whole.slices, ENGINE.job.sliceCount(1200));

  const acc = new Float64Array(ENGINE.job.NMAX);
  let n = 0, s = 0, r;
  while ((r = ENGINE.job.runSlice(P.byCell, P.cellStart, range, job, s)) !== null) {
    for (let k = 0; k < acc.length; k++) acc[k] += r.eq[k] * r.n;
    n += r.n; s++;
  }
  for (let k = 0; k < acc.length; k++) assert.equal(whole.eq[k], acc[k] / n, `slice sum at N=${k + 1}`);

  const again = ENGINE.job.runUnit(P.byCell, P.cellStart, range, job);
  assert.deepEqual(Array.from(again.eq), Array.from(whole.eq), 'bit-identical on a re-run');
});

test('the seed key covers stage, cell and settings hash — and nothing else', () => {
  const base = { stage: 'cell', key: 'AA_BIGPAIR|DS', hash: 'abc12345' };
  const s = (o, slice) => ENGINE.job.seedOf('hero', { ...base, ...o }, slice || 0);
  assert.equal(s({}), s({}), 'pure');
  assert.notEqual(s({}), s({ stage: 'sub' }));
  assert.notEqual(s({}), s({ key: 'TRASH|RB' }));
  assert.notEqual(s({}), s({ hash: 'abc12346' }));
  assert.notEqual(s({}), s({}, 1), 'each slice gets its own stream');
  assert.equal(s({ trials: 25000 }), s({ trials: 500 }),
    'the trial count reaches the seed through the settings hash, not directly');
});

// ---------------------------------------------------------------------------
// the entry twin, driven through its message protocol against a fake worker global
// ---------------------------------------------------------------------------
function fakeWorker() {
  const posted = [];
  const g = {
    self: null,
    postMessage: (m) => posted.push(m),
    performance: { now: () => Date.now() },
    Uint32Array, Int32Array, Float64Array, Uint8Array, Math, Error, String, Object, Array, Map,
    JSON, isFinite, RangeError,
  };
  g.self = g;
  const script = new Script(MIN.kernel + '\n' + MIN.entry);
  const vmCtx = createContext({ ...g, globalThis: g });
  script.runInContext(vmCtx);
  return {
    posted,
    send: (msg) => { vmCtx.self.onmessage({ data: msg }); return posted[posted.length - 1]; },
    last: () => posted[posted.length - 1],
  };
}

test('the entry twin answers the whole protocol', () => {
  const P = enumeration();
  const w = fakeWorker();
  /* property checks, not deepEqual: these objects are built inside the VM realm, so they do not
     share this realm's Object.prototype and strict structural comparison would fail on identity */
  assert.equal(w.last().booted, true, 'it announces itself unprompted');

  assert.equal(w.send({ cmd: 'ping' }).pong, true);

  const early = w.send({ cmd: 'jobs', jobs: [{ id: 0, kind: 'latt', pool: 'cell', unit: 0, key: 'x', stage: 'cell', hash: 'h', v: 55, q: 0.85, trials: 10 }] });
  assert.match(early.results[0].error, /jobs before init/);

  const ready = w.send({
    cmd: 'init',
    order: { packed: MODEL.order.packed, n: MODEL.order.n, bits: MODEL.order.bits },
    pool: P.byCell, starts: P.cellStart,
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.classes, MODEL.constants.villainLattice.classes);
  assert.equal(ready.universe, 270725);

  const res = w.send({
    cmd: 'jobs',
    jobs: [{ id: 0, kind: 'latt', pool: 'cell', unit: 0, key: P.cellKeys[0], stage: 'cell', hash: 'h', v: 55, q: 0.85, trials: 500 }],
  });
  assert.equal(res.results.length, 1);
  assert.equal(res.results[0].id, 0);
  assert.equal(res.results[0].trials, 500);
  assert.equal(res.results[0].eq.length, 7);
  assert.ok(res.results[0].eq[0] > 0 && res.results[0].eq[0] < 100);

  /* a lazily-added stage-2 pool */
  const subStarts = Int32Array.from([0, 100, 240]);
  const subPool = P.byCell.slice(0, 240);
  const pool = w.send({ cmd: 'pool', name: 'sub', pool: subPool, starts: subStarts });
  assert.equal(pool.pool, 'sub');
  assert.equal(pool.units, 2);
  const sub = w.send({
    cmd: 'jobs',
    jobs: [{ id: 0, kind: 'latt', pool: 'sub', unit: 1, key: 'c#s', stage: 'sub', hash: 'h', v: 55, q: 0.85, trials: 200 }],
  });
  assert.equal(sub.results[0].trials, 200);

  /* one bad unit is reported per job, not thrown */
  const bad = w.send({
    cmd: 'jobs',
    jobs: [{ id: 0, kind: 'latt', pool: 'nope', unit: 0, key: 'x', stage: 'cell', hash: 'h', v: 55, q: 0.85, trials: 10 }],
  });
  assert.match(bad.results[0].error, /unknown pool "nope"/);
});

test('the entry twin refuses a corrupt order and a partial universe', () => {
  const P = enumeration();
  const order = ENGINE.order.unpackOrder(MODEL.order.packed, MODEL.order.n);
  order[5] = order[6];                                    // a duplicate class
  const broken = ENGINE.order.packOrder(order);

  let w = fakeWorker();
  let r = w.send({
    cmd: 'init', order: { packed: broken, n: MODEL.order.n, bits: MODEL.order.bits },
    pool: P.byCell, starts: P.cellStart,
  });
  assert.match(r.error, /not a permutation/);

  w = fakeWorker();
  r = w.send({
    cmd: 'init', order: { packed: MODEL.order.packed, n: MODEL.order.n, bits: MODEL.order.bits },
    pool: P.byCell.slice(0, 1000), starts: P.cellStart,
  });
  assert.match(r.error, /whole 270,725-hand universe/);
});

// ---------------------------------------------------------------------------
// FIDELITY — the sim and the generator must be the same measurement
// ---------------------------------------------------------------------------
test('the browser kernel reproduces the shipped lattice at v=55', () => {
  /* The shipped number for a cell at v is `eq[N] + vDelta[row][N]`, both in the model, measured by
     the generator at 100k trials. This runs the BROWSER's code path — the bundled kernel, the
     browser-side class table, the pool cut from the shipped packed order — at reduced trials, and
     asks whether it lands on the same number.
     Tolerance is 4 sigma of the RUN's own error. The shipped side's 0.16 pt and its 0.05 pt of
     delta rounding are inside that and are not modelled separately; the point of the test is to
     catch a wrong pool or a wrong kernel, which are worth whole points, not a tenth. */
  const P = enumeration();
  const { ct, order } = classes();
  const V = 55, TRIALS = 30000;
  const vi = MODEL.constants.villainLattice.v.indexOf(V);
  assert.ok(vi >= 0);
  const range = ENGINE.job.buildRange(P.byCell, ct, order, V);
  const tol = 4 * (50 / Math.sqrt(TRIALS));

  const cases = ['AA_BIGPAIR|DS', 'RUN0_LOW|DS', 'BROADWAY_RUN|RB', 'TRASH|RB'];
  const report = [];
  for (const key of cases) {
    const unit = P.cellKeys.indexOf(key);
    assert.ok(unit >= 0, key);
    const r = ENGINE.job.runUnit(P.byCell, P.cellStart, range, {
      id: 0, kind: 'latt', unit, key, stage: 'cell', hash: 'fidelity', q: MODEL.constants.villainLattice.discipline,
      trials: TRIALS,
    });
    const cell = MODEL.cells[key];
    for (let n = 0; n < 5; n++) {
      const shipped = cell.eq[n] + cell.vDelta[vi][n];
      const got = r.eq[n];
      report.push(`${key} N=${n + 1}: sim ${got.toFixed(2)} vs shipped ${shipped.toFixed(2)}`);
      assert.ok(Math.abs(got - shipped) < tol,
        `${key} at N=${n + 1}: sim ${got.toFixed(3)} vs shipped ${shipped.toFixed(3)} ` +
        `(|delta| ${Math.abs(got - shipped).toFixed(3)} > ${tol.toFixed(3)})`);
    }
  }
  assert.equal(report.length, cases.length * 5);
});

test('the random-villain kernel reproduces the shipped baseline', () => {
  /* The other half of the same claim: with `kind:'multi'` the browser path is measuring the
     RANDOM-villain baseline, which is what model.cells[k].eq is. Different stream, same quantity. */
  const P = enumeration();
  const TRIALS = 30000;
  const tol = 4 * (50 / Math.sqrt(TRIALS));
  for (const key of ['AA_BIGPAIR|DS', 'RUN0_LOW|DS']) {
    const unit = P.cellKeys.indexOf(key);
    const r = ENGINE.job.runUnit(P.byCell, P.cellStart, null, {
      id: 0, kind: 'multi', unit, key, stage: 'cell', hash: 'fidelity', trials: TRIALS,
    });
    for (let n = 0; n < 5; n++) {
      assert.ok(Math.abs(r.eq[n] - MODEL.cells[key].eq[n]) < tol,
        `${key} at N=${n + 1}: sim ${r.eq[n].toFixed(3)} vs shipped ${MODEL.cells[key].eq[n]}`);
    }
  }
});
