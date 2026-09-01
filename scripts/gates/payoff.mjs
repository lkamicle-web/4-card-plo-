// gate I33 — the payoff interface freeze (V3-PLAN §2).
//
// Clauses (a)-(f) on scripts/lib/payoff.mjs, plus the separate monotonicity clause written to be
// falsified. The whole v3 chain — CFR, the EV cut, the EV UI, the inspector — fans out against
// this signature, so the freeze is a gate rather than a docstring. Pure arithmetic over the
// shipped equity ladders: no Monte Carlo, which is why the largest gate in the repository is also
// one of the cheapest.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

import * as P from '../lib/policy.mjs';
import * as PO from '../lib/payoff.mjs';
import { ROOT } from './_shared.mjs';

export const family = 'payoff';
export const title = 'the V3-PLAN §2 payoff interface freeze — the unlock for every v3 chain';
export const ids = ['I33'];

export function build(ctx) {
  const { model, G } = ctx;

  return {
    sections: [
    { ids: ['I33'], label: 'the §2 contract, clauses (a)-(f) + monotonicity', run: () => {
    // =======================================================================
    // I33 — the payoff interface freeze (V3-PLAN §2). The unlock, asserted.
    //
    // WHAT IS BEING FROZEN, AND WHY IT IS FROZEN BEFORE IT IS BUILT. Four whole workstreams — the
    // CFR engine, the EV presentation, the absolute-EV cut, the inspector — are about to fan out
    // against ONE signature, `payoff(cells, potSize, spr, opts) -> {ev, se, source, supported}`,
    // while the thing behind it is still a checkdown stub. That is only safe if the SHAPE cannot
    // move underneath them, so §2 makes the shape a gate rather than a docstring: "the freeze is a
    // test, not a doc". Everything this gate asserts is cheap, deterministic arithmetic over the
    // shipped equity ladders — no Monte Carlo, no sampling, no clock.
    //
    // THE ONE PLACE THE STUB REFINES §2, RECORDED HERE RATHER THAN QUIETLY. §2 describes the stub
    // as "returns shipped eq[N] at every spr". Taken literally that cannot pass §2's OWN clause
    // (b): `eq` is measured against RANDOM opponents, so eq_A + eq_B is not 1 for almost any pair
    // and conservation fails nearly everywhere. The two clauses are jointly satisfiable only if
    // the stub conserves, so the heads-up stub returns the zero-sum PROJECTION of the same shipped
    // measurement — 0.5 + (eq_A[0] - eq_B[0])/200 — which uses only shipped numbers, introduces no
    // constant, and conserves to the last bit. Clause (b) below therefore asserts an identity
    // where §2 only asked for 1 +/- 2 se. The honesty is carried by `source:'checkdown'`, which is
    // what I35's Grade-C label keys off later — NOT by `supported`, which answers the different
    // question of whether the REQUEST was in the measured domain.
    //
    // THREE CLAUSES ARE VACUOUS TODAY AND ARE ARMED ANYWAY. (c), (e) and (f) have nothing to catch
    // yet: no source but 'checkdown' exists, no consumer file exists, and the page has no payoff
    // call site. A clause that cannot fire is worth nothing, so each of the three runs its detector
    // against a FABRICATED input and asserts that the detector fires — the fabricated-payload
    // idiom. That is what makes them armed rather than decorative.
    const KEYS = ['ev', 'se', 'source', 'supported'];
    const bad = [];                            // clause failures, in clause order
    const eqOK = (k) => Array.isArray(model.cells[k].eq) && model.cells[k].eq.length > 0;
    const live = Object.keys(model.cells).filter(eqOK).sort();
    const nMax = live.length ? model.cells[live[0]].eq.length : 0;
    const F = PO.makePayoff(model);            // the pure route — the model is an argument here
    const eq0 = (k) => model.cells[k].eq[0];

    // The expected keys and the source enum are written out HERE rather than imported from the
    // module under test. A gate that reads its own expectation from its subject asserts nothing —
    // the same reason freeze-tiers.mjs, not verify.mjs, writes the tier fixtures.
    const SRC = ['checkdown', 'model', 'simulated'];
    if (!(Array.isArray(PO.SOURCES) && PO.SOURCES.length === SRC.length && SRC.every((s, i) => PO.SOURCES[i] === s))) {
      bad.push(`(a) the source enum is [${[...(PO.SOURCES || [])].join(',')}], not [${SRC.join(',')}] — `
        + `widening it is how an unmeasured payoff gets a respectable-looking label`);
    }
    const same = (a, b) => KEYS.every((x) => Object.is(a[x], b[x]));
    const shapeOf = (r) => Object.keys(r).slice().sort().join(',') === KEYS.slice().sort().join(',')
      && typeof r.ev === 'number' && typeof r.se === 'number'
      && typeof r.source === 'string' && SRC.includes(r.source)
      && typeof r.supported === 'boolean';

    // -- (a) the freeze: arity, keys, types, range, determinism, and one named anchor ----------
    // The arity check is not pedantry: a `opts = {}` default parameter silently makes the function
    // report length 3, and a length-3 payoff is a payoff whose fourth argument someone forgot.
    const arity = PO.payoff.length === 4 && F.length === 4 && PO.makePayoff.length === 1;

    // every distinct code path through the accessor, named. (d) reuses this list.
    const A = live[0], B = live[live.length - 1], C = live[live.length >> 1];
    const ladder = (n) => Array.from({ length: n }, (_, i) => live[i % live.length]);
    const paths = [
      ['heads-up, ip on', [A, B], 10, 4, { ip: true }],
      ['heads-up, ip off', [A, B], 10, 4, { ip: false }],
      ['heads-up, opts absent', [A, B], 10, 4, undefined],
      ['heads-up, opts null', [A, B], 10, 4, null],
      ['heads-up, seeded', [A, B], 10, 4, { seed: 'rundown-v3' }],
      ['heads-up, spr 0', [A, B], 10, 0, {}],
      ['multiway 3', [A, B, C], 10, 4, {}],
      ['multiway at the end of the ladder', ladder(nMax + 1), 10, 4, {}],
      ['past the end of the ladder', ladder(nMax + 2), 10, 4, {}],
      ['unknown hero key', ['NOPE|XX', A], 10, 4, {}],
      ['unknown villain key', [A, 'NOPE|XX'], 10, 4, {}],
      ['a prototype key is an unknown key', ['__proto__', A], 10, 4, {}],
      ['constructor is an unknown key', ['constructor', A], 10, 4, {}],
      ['cells not an array', 'AA_BIGPAIR|DS', 10, 4, {}],
      ['cells null', null, 10, 4, {}],
      ['cells empty', [], 10, 4, {}],
      ['one cell is not a hand', [A], 10, 4, {}],
      ['a non-string cell key', [A, 7], 10, 4, {}],
      ['potSize 0', [A, B], 0, 4, {}],
      ['potSize negative', [A, B], -3, 4, {}],
      ['potSize NaN', [A, B], NaN, 4, {}],
      ['potSize infinite', [A, B], Infinity, 4, {}],
      ['potSize a string', [A, B], '10', 4, {}],
      ['spr negative', [A, B], 10, -1, {}],
      ['spr NaN', [A, B], 10, NaN, {}],
      ['spr infinite', [A, B], 10, Infinity, {}],
      ['opts not an object', [A, B], 10, 4, 7],
      ['opts an array', [A, B], 10, 4, []],
      ['a seed nobody can reproduce', [A, B], 10, 4, { seed: {} }],
      ['a NaN seed', [A, B], 10, 4, { seed: NaN }],
    ];
    let threw = 0, shapeBad = 0, rangeBad = 0, detBad = 0, returns = 0;
    for (const [why, cells, pot, spr, opts] of paths) {
      let r = null;
      try { r = F(cells, pot, spr, opts); } catch (e) { threw++; bad.push(`(a) "${why}" THREW: ${e.message}`); continue; }
      returns++;
      if (!shapeOf(r)) { shapeBad++; if (bad.length < 6) bad.push(`(a) "${why}" broke the return shape`); }
      if (!(Number.isFinite(r.ev) && r.ev >= 0 && r.ev <= 1)) {
        rangeBad++; if (bad.length < 6) bad.push(`(a) "${why}" returned ev ${r.ev}, outside [0,1] — a pot fraction is not a percentage`);
      }
      // determinism, at both ip values: the same arguments must give the same object, twice.
      for (const ip of [false, true]) {
        const o = (opts && typeof opts === 'object' && !Array.isArray(opts)) ? { ...opts, ip } : opts;
        let x = null, y = null;
        try { x = F(cells, pot, spr, o); y = F(cells, pot, spr, o); } catch { detBad++; continue; }
        if (!same(x, y)) { detBad++; if (bad.length < 6) bad.push(`(a) "${why}" is not deterministic at ip=${ip}`); }
      }
    }
    // the named anchor: the heads-up return, recomputed straight from model.cells with no payoff
    // code in the middle. This is what pins the UNIT (percent vs fraction) and the INDEX (eq[0] is
    // one opponent, not two) at a point a human can read — the two easiest silent bugs in the file.
    const anchorPair = ['AA_BIGPAIR|DS', 'TRASH|RB'].every((k) => live.includes(k))
      ? ['AA_BIGPAIR|DS', 'TRASH|RB'] : [A, B];
    const anchorWant = (eq0(anchorPair[0]) + (100 - eq0(anchorPair[1]))) / 200;
    const anchorGot = F(anchorPair, 10, 4, { ip: false }).ev;
    const anchorOk = Math.abs(anchorGot - anchorWant) < 1e-15;
    if (!arity) bad.push(`(a) arity is ${PO.payoff.length}/${F.length}, not 4/4 — a default on \`opts\` is the usual cause`);
    if (!anchorOk) bad.push(`(a) the anchor ${anchorPair.join(' vs ')} returned ${anchorGot} where model.cells says ${anchorWant}`);

    // -- (b) zero-sum conservation over EVERY ordered heads-up pair ----------------------------
    // §2 asks for ev(A,B) + ev(B,A) = 1 +/- 2 se over shared deals. Under the projection it is an
    // identity, so the measured worst deviation below is 0 and the 2-se band is reported only to
    // show how much room the clause is not using.
    let worstSum = 0, sumBad = 0, tightBand = Infinity, pairs = 0;
    let minSe = Infinity, maxSe = 0, infSe = 0;
    const conserveViolations = (fn, keys) => {
      let n = 0;
      for (let i = 0; i < keys.length; i++) {
        for (let j = 0; j < keys.length; j++) {
          if (i === j) continue;
          const ra = fn([keys[i], keys[j]], 10, 4, { ip: false });
          const rb = fn([keys[j], keys[i]], 10, 4, { ip: false });
          if (Math.abs(ra.ev + rb.ev - 1) > 2 * Math.hypot(ra.se, rb.se)) n++;
        }
      }
      return n;
    };
    for (let i = 0; i < live.length; i++) {
      for (let j = 0; j < live.length; j++) {
        if (i === j) continue;
        pairs++;
        const ra = F([live[i], live[j]], 10, 4, { ip: false });
        const rb = F([live[j], live[i]], 10, 4, { ip: false });
        const dev = Math.abs(ra.ev + rb.ev - 1);
        const band = 2 * Math.hypot(ra.se, rb.se);
        if (dev > band) { sumBad++; if (bad.length < 8) bad.push(`(b) ${live[i]} vs ${live[j]}: sum ${(ra.ev + rb.ev).toFixed(9)}, band ${band.toExponential(1)}`); }
        if (dev > worstSum) worstSum = dev;
        if (band < tightBand) tightBand = band;
        for (const r of [ra, rb]) {                       // (a)'s range and (d) ride along
          if (!(Number.isFinite(r.ev) && r.ev >= 0 && r.ev <= 1)) {
            rangeBad++; if (bad.length < 10) bad.push(`(a) ${live[i]} vs ${live[j]} returned ev ${r.ev}, outside [0,1]`);
          }
          if (!(r.se > 0)) { if (bad.length < 10) bad.push(`(d) ${live[i]}/${live[j]} reported se ${r.se}`); }
          if (Number.isFinite(r.se)) { if (r.se < minSe) minSe = r.se; if (r.se > maxSe) maxSe = r.se; } else infSe++;
        }
      }
    }
    // ARMED: a fabricated payoff that puts a thumb on hero's side of the scale must fail (b). If
    // this does not fire, clause (b) is asserting nothing and the number above is decoration.
    const tilted = (cells, pot, spr, opts) => {
      const r = F(cells, pot, spr, opts);
      return { ...r, ev: Math.min(1, r.ev + 0.05) };
    };
    const demo = live.slice(0, 12);
    const tiltFires = conserveViolations(tilted, demo);
    const realQuiet = conserveViolations(F, demo);
    const demoPairs = demo.length * (demo.length - 1);
    if (sumBad) bad.push(`(b) conservation FAILS on ${sumBad} of ${pairs} ordered pairs`);
    if (tiltFires < demoPairs || realQuiet !== 0) {
      bad.push(`(b) the clause is not armed: a fabricated non-conserving payoff fired on only `
        + `${tiltFires}/${demoPairs} pairs (and the real one on ${realQuiet})`);
    }

    // -- (c) spr -> 0 identity ------------------------------------------------------------------
    // §2: "any non-stub source equals checkdown eq within MC error at spr = 0". Every source today
    // is 'checkdown', so the sweep below finds nothing to compare — and says so, rather than
    // passing quietly. Reported beside it, MEASURED AND NOT ASSERTED: the stub is spr-inert, which
    // is exactly what "a game where postflop does not exist" means. That inertness is deliberately
    // not a pass condition, because P2's real payoff is SUPPOSED to break it.
    const SPRS = [0, 1, 4, 13];
    let nonStub = 0, nonStubBad = 0, sprMoved = 0, sprReturns = 0;
    for (let i = 0; i < live.length; i++) {
      for (let j = 0; j < live.length; j++) {
        if (i === j) continue;
        const base = F([live[i], live[j]], 10, 0, { ip: false });
        if (base.source !== 'checkdown') {
          nonStub++;
          const want = eq0(live[i]) / 100;
          if (Math.abs(base.ev - want) > 2 * base.se) {
            nonStubBad++;
            if (bad.length < 12) bad.push(`(c) ${live[i]} vs ${live[j]} at spr 0: source ${base.source} gives ${base.ev}, checkdown says ${want}`);
          }
        }
        for (const spr of SPRS) {
          sprReturns++;
          const r = F([live[i], live[j]], 10, spr, { ip: false });
          if (!same(r, base)) sprMoved++;
          if (!(Number.isFinite(r.ev) && r.ev >= 0 && r.ev <= 1)) {
            rangeBad++; if (bad.length < 12) bad.push(`(a) ${live[i]} vs ${live[j]} at spr ${spr} returned ev ${r.ev}, outside [0,1]`);
          }
        }
      }
    }
    if (nonStubBad) bad.push(`(c) ${nonStubBad} of ${nonStub} non-checkdown returns disagree with checkdown eq at spr 0`);

    // -- (d) se > 0 on every path, including the fallbacks and the extremes ---------------------
    // The sweep above already covered every heads-up return. What is left is the malformed paths
    // and two fabricated models pinned at the ends of the range, where a naive sqrt(p(1-p)/n)
    // would report exactly 0 and claim certainty from a finite sample.
    const eqAll = (v) => {
      const cells = {};
      for (const k of Object.keys(model.cells)) {
        const c = model.cells[k];
        cells[k] = Array.isArray(c.eq) ? { ...c, eq: c.eq.map(() => v) } : c;
      }
      return PO.makePayoff({ ...model, cells });
    };
    let seBad = 0, seNamed = 0;
    for (const [why, cells, pot, spr, opts] of paths) {
      let r; try { r = F(cells, pot, spr, opts); } catch { continue; }
      seNamed++;
      if (!(r.se > 0)) { seBad++; if (bad.length < 14) bad.push(`(d) "${why}" reported se ${r.se}`); }
      if (Number.isFinite(r.se)) { if (r.se < minSe) minSe = r.se; if (r.se > maxSe) maxSe = r.se; } else infSe++;
    }
    for (const [label, f] of [['0%', eqAll(0)], ['100%', eqAll(100)]]) {
      for (const cells of [[A, B], [A, B, C]]) {
        const r = f(cells, 10, 4, { ip: false });
        seNamed++;
        if (!(r.se > 0 && Number.isFinite(r.se))) {
          seBad++; bad.push(`(d) a cell measured at ${label} reported se ${r.se} — the Laplace clamp is missing`);
        }
      }
    }
    if (seBad) bad.push(`(d) se was not positive on ${seBad} of ${seNamed} named paths`);

    // -- (e) the grep gate: payoff consumers go through the accessor ----------------------------
    // §2: "CFR, the EV cut and the UI consume payoffs ONLY through this accessor". Scope is by
    // FILENAME, deliberately: the legacy equity readers (policy.mjs, sim-kernel.js, shell.html,
    // this file) are not payoff consumers and must not trip a gate about payoffs. VERIFICATION CODE
    // is out of scope for the same reason, and by directory: `test/` (a future test/cfr.test.mjs
    // has every right to fabricate a payoff table) and `scripts/gates/` (the registry refactor is
    // about to land, and a gate file named solver.mjs asserting things about the solver is not a
    // solver consuming payoffs). The clause is about PRODUCT consumers. The UI is covered by clause
    // (f) instead, which is page-side and specific.
    const CONSUMER = /(cfr|solver|equilib|ev[-_]?cut)/i;
    const consumerProblems = (name, text) => {
      const p = [];
      if (!/from\s+['"][^'"]*payoff\.mjs['"]|\bPAYOFF\s*\./.test(text)) p.push(`${name} never imports payoff.mjs`);
      if (/\.eq\s*\[/.test(text) || /\bcells\s*\[[^\]\n]*\]\s*\.\s*eq\b/.test(text)) p.push(`${name} reads a payoff table directly`);
      return p;
    };
    const walk = (dir, out) => {
      let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
      for (const e of [...ents].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0))) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'gates' && e.name[0] !== '.') walk(p, out); }
        else if (/\.(mjs|js|html)$/.test(e.name)) out.push(p);
      }
      return out;
    };
    /* The detail line below reports the CONSUMER count and not the scanned-file count, on purpose:
       the gate-registry refactor is about to add ~46 files under scripts/gates/, and a gate whose
       output moves when an unrelated file appears cannot serve as that refactor's byte-identical
       baseline. What this clause is about is how many payoff consumers exist, which is 0. */
    const scanned = [...walk(resolve(ROOT, 'scripts'), []), ...walk(resolve(ROOT, 'src'), [])];
    const consumers = scanned.filter((p) => CONSUMER.test(p.slice(p.lastIndexOf('/') + 1)));
    for (const p of consumers) {
      let text = ''; try { text = readFileSync(p, 'utf8'); } catch { bad.push(`(e) ${relative(ROOT, p)} is unreadable`); continue; }
      for (const why of consumerProblems(relative(ROOT, p), text)) bad.push(`(e) ${why}`);
    }
    // ARMED, three ways: the detector must flag a violator, clear a compliant consumer, and — the
    // one that keeps this gate from becoming a nuisance — leave a legacy eq reader alone.
    const eFires = consumerProblems('cfr.mjs', 'const p = model.cells[k].eq[0] / 100;').length === 2;
    const eClears = consumerProblems('ev-cut.mjs',
      "import { payoff } from './payoff.mjs';\nconst { ev, supported } = payoff(cells, pot, spr, { ip });").length === 0;
    const eScoped = !CONSUMER.test('policy.mjs') && !CONSUMER.test('shell.html') && !CONSUMER.test('sim-kernel.js');
    if (!(eFires && eClears && eScoped)) {
      bad.push(`(e) the detector is not armed: violator flagged ${eFires}, compliant cleared ${eClears}, legacy readers out of scope ${eScoped}`);
    }

    // -- (f) page-side: no caller renders a supported:false ev without the badge ----------------
    // Read-only, and it reads the SOURCE shell, never the generated page: touching either would
    // put `build.mjs --check` out of date, and this gate is not allowed to cost that. The page has
    // the badge idiom already — `badge: 'unsupported'`, from the villain accessor's own
    // `supported:false` — so what the clause demands the day a payoff call site appears is that it
    // joins that path rather than inventing a second, quieter one.
    // The badge is required PER CALL SITE, inside a 600-character window, not merely somewhere in
    // the file. `badge` already appears twenty-odd times in the shell (the villain accessor's own
    // `supported:false` path), so a file-wide test would be satisfied by machinery that has nothing
    // to do with the payoff — a clause that passes for the wrong reason is worse than no clause.
    const badgeProblems = (text) => {
      const re = /\bpayoff\s*\(/g;
      const sites = [];
      for (let m = re.exec(text); m; m = re.exec(text)) sites.push(m.index);
      const problems = sites
        .filter((i) => { const w = text.slice(i, i + 600); return !(/supported/.test(w) && /badge/.test(w)); })
        .map((i) => `a payoff call site at offset ${i} has no supported -> badge path within 600 chars`);
      return { sites: sites.length, problems };
    };
    let shellText = null;
    try { shellText = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8'); } catch (e) { bad.push(`(f) src/shell.html unreadable: ${e.message}`); }
    const fShell = shellText === null ? { sites: -1, problems: [] } : badgeProblems(shellText);
    for (const why of fShell.problems) bad.push(`(f) src/shell.html: ${why}`);
    // ARMED: the detector must see a fabricated call site and must clear a fabricated badged one.
    const fFires = badgeProblems('const r = payoff(cells, pot, spr, {ip}); paint(r.ev);').problems.length === 1;
    const fClears = badgeProblems('const r = payoff(cells, pot, spr, {ip});\nif (!r.supported) t.badge = "unsupported";').problems.length === 0;
    if (!(fFires && fClears)) bad.push(`(f) the detector is not armed: call site seen ${fFires}, badged form cleared ${fClears}`);

    // -- the separate clause, written to be falsified -------------------------------------------
    // §2: ev monotone in checkdown equity at fixed spr. The prediction is that high-cooler hands
    // BREAK this at spr >= 4 once a real payoff model lands, and that the break is the payoff
    // model working — realization is precisely what checkdown equity does not measure. Under the
    // stub ev is affine in eq[0], so this passes by construction and is worth nothing yet; it is
    // written now so that P2 has to confront it. When it fails, §2's house rule is to rewrite the
    // clause to the measurement, never to widen a tolerance.
    const byEq = [...live].sort((x, y) => (eq0(x) - eq0(y)) || (x < y ? -1 : 1));
    const monoVillain = live.includes('AA_BIGPAIR|RB') ? 'AA_BIGPAIR|RB' : B;
    let inversions = 0, steps = 0;
    for (const spr of SPRS) {
      for (const ip of [false, true]) {
        let prev = -Infinity;
        for (const k of byEq) {
          const ev = F([k, monoVillain], 10, spr, { ip }).ev;
          if (prev > -Infinity) { steps++; if (ev < prev) { inversions++; if (bad.length < 16) bad.push(`(mono) ${k} at spr ${spr} ip=${ip}: ${ev} < ${prev}`); } }
          prev = ev;
        }
      }
    }
    if (inversions) bad.push(`(mono) ev is not monotone in checkdown equity: ${inversions} inversions of ${steps} steps`);

    G('I33', bad.length === 0,
      `payoff interface frozen (V3-PLAN §2) on scripts/lib/payoff.mjs; the stub is the ZERO-SUM `
      + `PROJECTION of the shipped checkdown measurement, 0.5 + (eqA[0] - eqB[0])/200 — §2's literal `
      + `"return shipped eq[N]" cannot pass §2's own clause (b), and this is the only form that uses `
      + `nothing but shipped numbers and still conserves. `
      + `(a) arity ${PO.payoff.length}, keys {${KEYS.join(',')}}, types and source enum hold on all `
      + `${paths.length} named paths (${threw} threw, ${shapeBad} broke shape), ev in [0,1] on all `
      + `${(returns + pairs * 2 + sprReturns).toLocaleString()} returns (${rangeBad} outside), `
      + `${detBad} determinism failures over ${paths.length * 2} double calls; the anchor `
      + `${anchorPair[0]} vs ${anchorPair[1]} = ${anchorGot.toFixed(6)} recomputed from model.cells, `
      + `which is what pins percent-vs-fraction and eq[0]-is-one-opponent. `
      + `(b) conservation over all ${pairs.toLocaleString()} ordered HU pairs: worst `
      + `|ev(A,B)+ev(B,A)-1| = ${worstSum.toExponential(1)} against a tightest 2-se band of `
      + `${tightBand.toExponential(1)} — §2 asks for 1 +/- 2 se and the projection delivers 1 exactly; `
      + `armed: a fabricated +0.05 payoff violates ${tiltFires}/${demoPairs} pairs where the real one `
      + `violates ${realQuiet}. `
      + `(c) spr->0 identity: ${pairs.toLocaleString()} returns swept at spr 0, ${nonStub} carry a `
      + `non-checkdown source, so the clause has nothing to compare yet and says so instead of `
      + `passing quietly. Measured beside it and NOT asserted: the stub is spr-inert — ${sprMoved} of `
      + `${sprReturns.toLocaleString()} returns move across spr {${SPRS.join(',')}} — which is what a `
      + `game where postflop does not exist looks like, and exactly what P2 is meant to break. `
      + `(d) se > 0 on every path: ${seNamed} named paths plus ${(pairs * 2).toLocaleString()} sweep `
      + `returns, finite range ${minSe.toExponential(1)}..${maxSe.toExponential(1)} pot fractions `
      + `(the shipped basis: seOfTrials(${model.meta.trials.cell.toLocaleString()})/100 = `
      + `${(P.seOfTrials(model.meta.trials.cell) / 100).toExponential(1)} at p=0.5), and Infinity on `
      + `the ${infSe} no-hero fallbacks — n=0 trials, the shipped seOfTrials(0) convention, never a `
      + `typed number. `
      + `(e) grep: scripts/ and src/ walked by filename, ${consumers.length} files match `
      + `/cfr|solver|equilib|ev-cut/ — vacuous today and armed anyway: the detector flags a `
      + `fabricated cfr.mjs reading .eq[ (${eFires}), clears a fabricated ev-cut.mjs going through `
      + `payoff.mjs (${eClears}), and leaves policy.mjs / shell.html / sim-kernel.js out of scope `
      + `(${eScoped}) so legacy equity readers cannot trip a payoff gate. `
      + `(f) page-side: src/shell.html carries ${fShell.sites} payoff call sites, so nothing can `
      + `render a supported:false ev unbadged; armed the same way (fabricated call site seen `
      + `${fFires}, fabricated badged form cleared ${fClears}), and the day a call site lands it must `
      + `join the page's existing badge:'unsupported' path. `
      + `(mono) THE CLAUSE WRITTEN TO BE FALSIFIED: ev non-decreasing in hero eq[0] over `
      + `${byEq.length} cells x spr {${SPRS.join(',')}} x ip {off,on} against ${monoVillain} — `
      + `${inversions} inversions of ${steps} steps. True BY CONSTRUCTION under the stub, which is `
      + `why it is worth nothing yet: §2 predicts high-cooler hands break it at spr >= 4 once a real `
      + `payoff model lands, and that break is the model WORKING. Rewrite it to the measurement then, `
      + `do not widen it`
      + (bad.length ? ` — FAILS: ${bad.slice(0, 6).join('; ')}${bad.length > 6 ? ` (+${bad.length - 6} more)` : ''}` : ''));
    } },
    ],
  };
}
