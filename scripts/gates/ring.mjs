// gates I48 I49 I50 I51 I52 D12 D13 — the v4 seat ladder, the 9-max fixture, and the ring artifact.
//
// V4-PLAN §5.2. Seven gates, one family, and the thing they are collectively written to catch is
// the failure §0.4 forbids: the seat axis moving the six-seat product. The axis enters as a NEW
// AXIS THAT IS INERT AT `seats = 6` (option (a)) and the ring enters as a NEW ARTIFACT (option
// (b)); option (c), a deliberate re-freeze, is forbidden for the whole run. I48 is the gate on that
// sentence and everything else here is a gate on one mechanism of it.
//
// READ-ONLY, ALL OF IT. `scripts/freeze-tiers.mjs --seats9` is the sole writer of
// data/tiers-9max.fixture.txt and nothing in this file may write it, exactly as
// `scripts/gates/fixtures.mjs` may not write the three older baselines. A gate that regenerates its
// own expectation asserts nothing.
//
// WHAT IS RED HERE, AND WHY THAT IS THE GATES WORKING (stage S2, lane F). Four of these seven have
// subjects that a LATER STAGE produces, and every one of them FAILS CLOSED with a named detail line
// rather than passing over an absent subject:
//
//   I49   data/tiers-9max.fixture.txt does not exist until stage S3's freeze ceremony. §2.5 is
//         explicit that the file must not exist before the run, so the gate reporting `fixture
//         absent` is the designed state, not a defect.
//   I50   its TIER clause reads that same fixture. Its containment, excess-enumeration and
//         pre-nesting clauses do NOT and are measured green today (see the section).
//   I52   its page clauses read `SIM_NMAX` out of src/shell.html (lane R) and its census clause
//         reads `constants.ladder.census`, which policy.mjs does not carry yet — filed as a
//         policyDelta, since policy.mjs is frozen after S1.
//   D12   its clauses live in `scripts/gates/ring-artifact.mjs`, which lane R writes.
//   D13   its subject is the `@block:ring` region (lane U) and the `blocks.ring` / `ring` caps
//         (stage S3, `scripts/lib/variant.mjs`).
//
// A gate whose subject does not exist has exactly two honest options — fail, or not be registered —
// and §5.2 registers all seven deliberately, BEFORE their features, because that is the distinction
// `scripts/gates/reserved.mjs` draws between a reserved id and one chosen to fit code already
// written. Passing vacuously is not on the list.
//
// WHY D12 IS DELEGATED RATHER THAN DUPLICATED. §7.2 gives `ring-artifact.mjs` to lane R and this
// file to lane F, and gives BOTH ids to lane F to register, because `scripts/gates/index.mjs` has a
// single writer this run and a mismatch between the declared sequence and EXPECTED_IDS makes the
// runner THROW rather than fail a gate. So D12's id is declared HERE, where the registration is
// coherent with one import and one REGISTRY row, and its CLAUSES are delegated to lane R's module.
// `scripts/gates/ring-artifact.mjs` must therefore NOT be added to REGISTRY: it is a clause library
// this family calls, not a family of its own, and adding it would emit D12 twice.
//
// COST, measured on the reference machine: the nesting census 1.7 s, the I48(b) accessor tripwire
// and I51's ladder sweeps well under 1 s together, I49's fixture sweep ~6 s once the fixture exists.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

import * as P from '../lib/policy.mjs';
import * as TF from '../lib/tier-fixture.mjs';
import * as TF2 from '../lib/tier-fixture-v2.mjs';
import * as TF3 from '../lib/tier-fixture-v3.mjs';
import * as TF9 from '../lib/tier-fixture-9max.mjs';
import { VARIANTS } from '../lib/variant.mjs';
import { stripComments } from './payoff.mjs';
import { ROOT } from './_shared.mjs';

export const family = 'ring';
export const title = 'the v4 seat ladder (I48-I52), the 9-max fixture, and the ring artifact (D12, D13)';
export const ids = ['I48', 'I49', 'I50', 'I51', 'I52', 'D12', 'D13'];
export const setupLabel = 'read data/ring.json, enumerate the nine-seat surface (the nesting\n'
  + '                census is lazy, and is charged to I50 where it is read)';

const rel = (p) => relative(ROOT, p);

/* Lane R's D12 clause library, if it has landed. A DYNAMIC import because this file must load in a
   worktree that does not carry it — a static one would take the whole registry down and with it
   every other gate, which is a worse failure than the one D12 is written to report. */
let RING_ARTIFACT = null, RING_ARTIFACT_WHY = '';
try { RING_ARTIFACT = await import('./ring-artifact.mjs'); } catch (e) {
  RING_ARTIFACT_WHY = e && e.code === 'ERR_MODULE_NOT_FOUND'
    ? 'scripts/gates/ring-artifact.mjs is not present — lane R has not landed'
    : `scripts/gates/ring-artifact.mjs failed to load: ${e.message}`;
}

// ---------------------------------------------------------------------------
// the two structural domains these gates re-derive rather than read from a list
// ---------------------------------------------------------------------------
/**
 * V3-BRIEF :211's OWN DOMAIN, re-derived. The recorded 1.19 % is a percentage over "all 3,960
 * UI-reachable settings", and a percentage is not a gate — so the enumeration behind it is rebuilt
 * here and the gate asserts the INTEGER.
 *
 * The domain: nodes {rfi, limps, raise} — `3bet` is excluded because `nEff` returns the constant 2
 * there and does not tier it — x the legal seats at that node x limpers {1,2,3,4} at `limps` and
 * the single default elsewhere x straddle {off, on} x every integer VPIP. At six seats that is
 * 30 rows x 2 x 66 = 3,960, reproducing V3-BRIEF's own figure exactly; at nine it is 48 x 2 x 66 =
 * 6,336, which FALSIFIES the work-order's predicted 5,676 (that prediction assumed seven legal
 * seats at `limps` and `raise`, where the ladder gives eight).
 */
function censusOf(seats) {
  const L = P.seatsFor(seats);
  const nm = P.nMax(seats);
  let domain = 0, clamped = 0, worst = 0, worstAt = '';
  const byPair = new Map();
  for (const node of P.NODES) {
    if (node === '3bet') continue;
    for (const pos of L) {
      if (P.positionDisabled(pos, node, seats)) continue;
      for (const limpers of node === 'limps' ? [1, 2, 3, 4] : [2]) {
        for (const straddle of [false, true]) {
          for (let vp = 25; vp <= 90; vp++) {
            const env = P.envOf({ straddle, seats });
            const r = P.nEff({ node, pos, v: vp / 100, limpers, env });
            domain++;
            if (r.extrapolated) { clamped++; byPair.set(`${pos}|${node}`, (byPair.get(`${pos}|${node}`) || 0) + 1); }
            if (r.raw > worst) { worst = r.raw; worstAt = `${node}/${pos}/v${vp}/${limpers}limp/straddle${straddle ? 1 : 0}`; }
          }
        }
      }
    }
  }
  return { seats, clamp: nm, domain, clamped, worst, worstAt, byPair };
}

/** the ring payload as shipped, or null. A PAYLOAD parameter — policy.mjs loads no file (§2.4). */
function ringOnDisk() {
  const p = resolve(ROOT, 'data/ring.json');
  if (!existsSync(p)) return { ring: null, path: p, bytes: 0 };
  return { ring: JSON.parse(readFileSync(p, 'utf8')), path: p, bytes: statSync(p).size };
}

/**
 * A ring payload with every column ZEROED, over whatever cell set is available.
 *
 * I48(b)'s tripwire needs a ring that is unmistakably WRONG, and it must exist even before lane R
 * ships the real artifact — otherwise the tripwire would be armed only on the day it is least
 * likely to fire. Zeroing the real payload when it exists, and synthesising an all-zero one over
 * the model's own live cells when it does not, gives the same claim in both worlds: reading the
 * ring at six seats is not merely unnecessary, it does not happen.
 */
function zeroedRing(model, real) {
  const cells = {};
  if (real && real.cells) {
    for (const k of Object.keys(real.cells)) {
      const c = real.cells[k];
      cells[k] = { eq: (c.eq || [0, 0]).map(() => 0) };
    }
    return { meta: { nMax: 9, synthetic: 'zeroed by gate I48(b)' }, cells };
  }
  for (const it of P.cellList(model)) cells[it.key] = { eq: [0, 0] };
  return { meta: { nMax: 9, synthetic: 'zeroed by gate I48(b), synthesised — no data/ring.json' }, cells };
}

/**
 * I48(a)'s CLAIM ABOUT THE SHAPE OF A DIFF, as a pure function of `git diff --name-status` rows.
 *
 * Pure so that the clause can be SHOWN TO FAIL on a fabricated violator — a hand-written row saying
 * a legacy fixture is 'M' — without fabricating a commit range to produce one. That matters more
 * here than anywhere else in this family: this is the clause standing in for "no `--force`", and a
 * clause nobody can demonstrate failing is a clause nobody should believe.
 *
 * @param {Array<string[]>} rows  `[status, ...paths]` tuples, as `--name-status` emits them
 */
export function diffShapeProblems(rows, legacy, nine) {
  const out = [];
  const statusOf = (p) => (rows.find((r) => r[r.length - 1] === p) || [])[0] || '-';
  for (const p of legacy) {
    const st = statusOf(p);
    if (st !== '-') out.push(`${p} shows as '${st}' — a legacy fixture MOVED`);
  }
  const n = statusOf(nine);
  if (n !== '-' && n !== 'A') {
    out.push(`${nine} shows as '${n}', not 'A' — added-not-modified is what "no --force" looks like from the outside`);
  }
  return { problems: out, statusOf };
}

/**
 * THE ALLOWLIST §5.2(c) names — "LADDER9, seatsFor, fixtures and the display map" — as files, with
 * the reason each is on it. ADDING TO THIS LIST IS THE DELIBERATE ACT the clause exists to force.
 *
 * The two entries are the definition itself and the identity witness. `src/shell.html` is NOT on it:
 * §2.6 has the rail render `seatsFor(seats)` and take its labels from `SEAT_DISPLAY`, so the page
 * should need no key of its own, and if lane U finds it does, this gate firing is how that gets
 * decided in the open. `scripts/lib/skill.mjs` is not on it either, and R5's measured exception
 * lists are the case most likely to earn a place: §1's table calls them "measured, not derivable",
 * which is the strongest argument in the repository for a hand-keyed seat name — but the argument
 * has to be made and recorded, not assumed by a gate that was written to be quiet about it.
 */
export const ALLOW = new Map([
  ['scripts/lib/policy.mjs', 'LADDER9 and SEAT_DISPLAY — the definition and the display map'],
  ['test/ladder.test.mjs', 'the six-seat identity witness, which carries the deleted literals verbatim'],
]);

/**
 * I51(c)'s LEXICAL SCAN, as a pure function of `[{file, src}]`, for the same reason: a fabricated
 * file carrying a stray key is how the clause is shown to fail, and a scan that could only read the
 * real tree could never be demonstrated at all.
 *
 * `src` is expected COMMENT-STRIPPED by the caller — prose about a seat is not a literal.
 */
export function scanSeatLiterals(files, allow) {
  const NEW_KEYS = P.LADDER9.filter((k) => !P.POSITIONS.includes(k));
  const strays = [];
  let legacyHits = 0, legacyFiles = 0;
  for (const { file, src } of files) {
    let hits = 0;
    for (const k of P.POSITIONS) hits += (src.match(new RegExp(`\\b${k}\\b`, 'g')) || []).length;
    if (hits) { legacyHits += hits; legacyFiles++; }
    if (allow.has(file)) continue;
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const k of NEW_KEYS) {
        if (new RegExp(`\\b${k}\\b`).test(lines[i])) strays.push(`${file}:${i + 1} carries the new seat key ${k}`);
      }
    }
  }
  return { strays, legacyHits, legacyFiles, scanned: files.length, newKeys: NEW_KEYS };
}

/** `git` output as text, or null when git cannot answer (which is a FAIL, never a pass) */
function git(args) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

export function build(ctx) {
  const { model, opts, fast, G } = ctx;

  const lanes = TF3.laneSpecs(model);
  const settings9 = TF9.fixtureSettings(model, lanes);
  const disk = ringOnDisk();

  // THE FAMILY'S SHARED SETUP: the nesting census I50 is scored on, and the same function the freeze
  // ceremony prints its numbers from. LAZY — computed on first read rather than in `build` — because
  // `build` is also what test/gates-ring.test.mjs calls to drive one section at a time, and paying
  // 1.7 s of census to exercise I51's monotonicity violator would be 1.7 s spent on nothing. Under
  // the runner it is still computed exactly once, immediately before the section that wants it.
  let census = null, censusErr = null, censusDone = false;
  const censusOnce = () => {
    if (censusDone) return census;
    censusDone = true;
    try { census = TF9.nestingCensus(model, lanes, settings9, { ring: disk.ring }); }
    catch (e) { censusErr = e.message; }
    return census;
  };

  return {
    sections: [

    // =======================================================================
    { ids: ['I48'], label: 'seat-axis inertness: the diff shape, the ring tripwire, the clamp', run: () => {
    // I48 — THE IDENTITY CONSTRAINT OF §0.4, IN THREE CLAUSES.
    //
    // (a) THE DIFF SHAPE, NOT A LOG GREP. "No --force" is not observable in a commit message:
    //     --force is a CLI flag. What IS observable is the SHAPE of the run's diff — the three
    //     legacy fixtures UNMODIFIED and data/tiers-9max.fixture.txt ADDED. A legacy fixture
    //     showing as modified fails this clause whatever the log says.
    //
    //     The base is the sha stage S0 recorded, supplied through RUNDOWN_V4_BASE. Absent that, the
    //     clause DOES NOT go quiet: it falls back to the commit that ADDED docs/V4-PLAN.md, which
    //     is the run's own base by construction (the plan and the workflow were committed beside
    //     each other at §7.6's launch), and every commit the run makes is inside that range.
    const bad = [];
    const LEGACY = [TF.FIXTURE_PATH, TF2.FIXTURE_PATH, TF3.FIXTURE_PATH];
    let base = (process.env.RUNDOWN_V4_BASE || '').trim();
    let baseFrom = 'RUNDOWN_V4_BASE';
    if (!base) {
      const added = git(['log', '--diff-filter=A', '--format=%H', '--', 'docs/V4-PLAN.md']);
      base = (added || '').split('\n').filter(Boolean).pop() || '';
      baseFrom = 'the commit that added docs/V4-PLAN.md';
    }
    let shape = '';
    if (!base) {
      bad.push('(a) no base sha: RUNDOWN_V4_BASE is unset and the commit that added docs/V4-PLAN.md '
        + 'could not be found, so the run\'s diff range is unknown and the inertness claim is unchecked');
    } else {
      const stat = git(['diff', '--name-status', `${base}..HEAD`, '--', 'data/']);
      if (stat === null) {
        bad.push(`(a) git could not diff ${base.slice(0, 8)}..HEAD — the diff shape is unchecked`);
      } else {
        const rows = stat.split('\n').filter(Boolean).map((l) => l.split('\t'));
        const d = diffShapeProblems(rows, LEGACY, TF9.FIXTURE_PATH);
        const statusOf = d.statusOf;
        for (const p of d.problems) bad.push(`(a) ${p} (across ${base.slice(0, 8)}..HEAD)`);
        const nine = statusOf(TF9.FIXTURE_PATH);
        // the working tree half: an uncommitted edit to a legacy fixture is the same failure
        const dirty = git(['status', '--porcelain', '--', ...LEGACY]);
        if (dirty === null) bad.push('(a) git status could not be read for the legacy fixtures');
        else if (dirty) bad.push(`(a) uncommitted changes to a legacy fixture: ${dirty.replace(/\n/g, '; ')}`);
        shape = `legacy [${LEGACY.map((p) => `${p.split('/').pop()}:${statusOf(p)}`).join(' ')}] `
          + `9max:${nine} across ${base.slice(0, 8)}..HEAD (base from ${baseFrom})`;
      }
    }

    // (b) THE RING TRIPWIRE, AGAINST THE ACCESSOR. With data/ring.json zeroed on a copy, the whole
    //     seats-6 surface must be byte-identical to the real build's. It runs through `rankTable`,
    //     never through `solve`: `solveUncached` does not hand a ring down at all (policy.mjs:2258),
    //     so a tripwire routed through `solve` would be measuring nothing and reporting green. The
    //     scored table is compared score-for-score, which is strictly finer than the tier vector.
    const zero = zeroedRing(model, disk.ring);
    let cmp = 0, moved = 0, firstMoved = '';
    for (const L of lanes) {
      for (const node of P.NODES) {
        for (const pos of P.seatsFor(6)) {
          if (P.positionDisabled(pos, node, 6)) continue;
          for (let vp = model.meta.vpip.min; vp <= model.meta.vpip.max; vp += (fast ? 5 : 1)) {
            const env = P.envOf({ limpers: 2, raiserPos: TF9.RAISER, seats: 6, ...TF2.envArgs(L), ...TF3.DEFAULT_LANE });
            const o = { limpers: 2, raiserPos: TF9.RAISER, env };
            const a = P.rankTable(model, pos, node, vp / 100, { ...o, ring: null });
            const b = P.rankTable(model, pos, node, vp / 100, { ...o, ring: zero });
            cmp++;
            for (let i = 0; i < a.rows.length; i++) {
              if (a.rows[i].key === b.rows[i].key && Object.is(a.rows[i].S, b.rows[i].S)) continue;
              moved++;
              if (!firstMoved) firstMoved = `${L.id} ${node}/${pos}@v${vp} row ${i} ${a.rows[i].key} S ${a.rows[i].S} -> ${b.rows[i].S}`;
              break;
            }
          }
        }
      }
    }
    if (moved) bad.push(`(b) zeroing data/ring.json MOVED ${moved} of ${cmp} seats-6 settings — the ring is being read at six seats. First: ${firstMoved}`);

    // (c) THE CLAMP IS FROZEN AT SEVEN, and the census behind V3-BRIEF's 1.19 % is asserted as the
    //     RECOUNTED INTEGER. `nMax(6) + 0.0001 === 7.0001` bit-for-bit is asserted rather than
    //     assumed, because that sum is what `nEff` compares `raw` against and an ulp there moves
    //     the `extrapolated` flag.
    const c6 = censusOf(6);
    if (P.nMax(6) !== 7) bad.push(`(c) nMax(6) is ${P.nMax(6)}, not 7 — the six-seat clamp moved`);
    if (!Object.is(P.nMax(6) + 0.0001, 7.0001)) bad.push('(c) nMax(6) + 0.0001 is not bit-identically 7.0001');
    if (c6.domain !== 3960) bad.push(`(c) the re-derived six-seat domain is ${c6.domain} settings, V3-BRIEF :211 counted 3,960`);
    if (c6.clamped !== 47) bad.push(`(c) ${c6.clamped} of ${c6.domain} six-seat settings clamp; the integer behind V3-BRIEF's recorded 1.19 % is 47`);

    const c9 = censusOf(9);
    G('I48', bad.length === 0,
      `seat-axis inertness at six seats. (a) diff shape ${shape || '(unchecked)'}; `
      + `(b) zeroing the ring moved 0 of ${cmp} seats-6 settings (${disk.ring ? `${disk.bytes} B payload zeroed` : 'no data/ring.json — an all-zero payload synthesised over the model\'s own cells'}); `
      + `(c) nMax(6) 7 and ${c6.clamped}/${c6.domain} = ${(100 * c6.clamped / c6.domain).toFixed(3)} % clamp `
      + `[${[...c6.byPair.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' ')}], worst raw `
      + `${c6.worst.toFixed(3)} at ${c6.worstAt} — the recounted INTEGER behind V3-BRIEF :211's 1.19 %. `
      + `At nine seats the clamp MOVES to ${c9.clamp} and the share FALLS: ${c9.clamped}/${c9.domain} = `
      + `${(100 * c9.clamped / c9.domain).toFixed(3)} % [${[...c9.byPair.entries()].map(([k, n]) => `${k}:${n}`).join(' ') || 'none'}]`
      + (bad.length ? ` — ${bad.join('; ')}` : ''));
    } },

    // =======================================================================
    { ids: ['I49'], label: 'the 9-max fixture reproduces', run: () => {
    // I49 — the same claim I32 makes for six seats, at nine. §2.5.
    //
    // THE FIXTURE IS EXPECTED TO BE ABSENT UNTIL STAGE S3 and this gate is expected to be RED until
    // it lands: §2.5 says the file must not exist before the run, and the freeze is a deliberate
    // ceremony performed once, in the open. `fixture absent` is this gate failing CLOSED.
    const path = resolve(ROOT, opts.tierFixture9max || TF9.FIXTURE_PATH);
    let fx = null, err = null;
    try { fx = TF9.loadFixture(path); } catch (e) { err = e; }
    if (!fx) {
      const why = err && err.code === 'ENOENT'
        ? `fixture absent at ${rel(path)} — stage S3's ceremony creates it: node scripts/freeze-tiers.mjs --seats9`
        : `fixture unreadable: ${err.message}`;
      G('I49', false, `9-max tier reproduction — ${why}`);
      return;
    }
    const d = TF9.compareToFixture(model, fx, 4, disk.ring);
    const scope = `${d.lanes} environment lanes x ${d.total / d.lanes} settings x ${fx.cells.length} cells `
      + `(${d.totalCells.toLocaleString()} tiers)`;
    const byLane = [...(d.byLane || new Map())].map(([k, n]) => `${k}:${n}`).join(' ');
    const diag = `${d.settings}/${d.total} settings differ, ${d.cells} cell tiers`
      + (d.structural.length ? `; ${d.structural.join('; ')}` : '')
      + (byLane ? `; by lane ${byLane}` : '')
      + (d.examples.length ? `; e.g. ${d.examples.join(' | ')}` : '')
      + (d.cells > d.examples.length ? ` (+${d.cells - d.examples.length} more — node scripts/freeze-tiers.mjs --seats9 --check)` : '');
    if (fast) {
      // The same disarm I22 and I32 carry, for the same reason: the fixture is computed from the
      // shipped 100k-trial equities and --fast data is a different MEASUREMENT, not seat drift.
      G('I49', d.structural.length === 0,
        `9-max tier reproduction NOT ASSERTED on --fast data: ${d.settings}/${d.total} settings move. `
        + `Structural surface unchanged: ${scope}` + (d.structural.length ? ` — ${d.structural.join('; ')}` : ''));
    } else {
      G('I49', d.ok,
        `9-max tiers reproduce exactly at seats=${TF9.SEATS} (${fx.legacyState}): ${scope} frozen ${fx.frozen} `
        + `from model ${fx.modelHash.slice(0, 12)}` + (d.ok ? '' : ` — ${diag}`));
    }
    } },

    // =======================================================================
    { ids: ['I50'], label: 'the sub-ladder identity over every shared seat', run: () => {
    // I50 — §5.2, and the clause list is written from R4's ENUMERATION (docs/spikes/V4-ladder.md
    // §5), not from a guess. Three clauses of three different kinds:
    //
    //   (i)  THE TIER CLAUSE, read off the two FROZEN FILES with no pipeline in the middle — the
    //        `compareV1Containment` idiom, for the third time. Red until the 9-max fixture exists.
    //   (ii) CONTAINMENT, PRE-REGISTERED WITH ITS DIRECTION: aggressive(9-max, seat) SUPERSET-OR-
    //        EQUAL aggressive(6-max, seat). The nesting post-pass (policy.mjs:2104-2110) unions
    //        every seat IN FRONT of `pos` into `pos`'s set, so at nine seats LJ, HJ, CO and BTN
    //        each gain three unions at `rfi` — and at `limps` and `raise` too, which §5.2's own
    //        prediction did not say and docs/spikes/V4-ladder.md §6 corrects. SB is outside the rfi
    //        chain (ci === -1) and is pre-registered EXACT. A STRICT SUPERSET IS AN EXPECTED
    //        OUTCOME, NOT A FAILURE: equality is measured, never assumed, and every excess cell
    //        must be attributable to a named front seat. THERE IS NO TOLERANCE HERE and no equality
    //        clause. What fails is a SUBSET violation or an UNEXPLAINED excess cell.
    //   (iii) THE PRE-NESTING WIDTH, stated SEPARATELY from the painted set. R4 found exactly ONE
    //        seats-in-front term in the whole pipeline — the post-pass itself — so a wider
    //        nine-seat pre-nesting target would mean a term nobody enumerated. Monotone in the
    //        term: more seats in front never widens it.
    //
    // The comparison runs over EVERY SHARED SEAT WHERE THE PAIR IS LEGAL AT BOTH SIZES, which is
    // not "all six" at any node: five at `rfi` (BB disabled at both), five at `limps` and `raise`
    // (the first-seat exclusion moves forward, so LJ has no six-seat counterpart — LJ|limps and
    // LJ|raise are I49's business), and all six at `3bet`. Twenty-one pairs.
    const bad = [];
    censusOnce();
    if (censusErr) bad.push(`(ii/iii) the nesting census could not run: ${censusErr}`);
    let totals = { cmp: 0, exact: 0, sup: 0, sub: 0, uni: 0, unex: 0, pre: 0, nonmono: 0, ref: 0 };
    if (census) {
      for (const p of census.problems) bad.push(p);
      for (const [, st] of census.byPair) {
        totals.cmp += st.comparisons; totals.exact += st.exact; totals.sup += st.strictSuper;
        totals.sub += st.subsetViolations; totals.uni += st.unioned; totals.unex += st.unexplained;
        totals.pre += st.preDiff; totals.nonmono += st.widthNonMonotone; totals.ref += st.refused;
      }
      if (totals.sub) bad.push(`(ii) ${totals.sub} SUBSET violations — containment is broken`);
      if (totals.unex) bad.push(`(ii) ${totals.unex} excess cells are carried by no front seat — unexplained`);
      if (totals.nonmono) bad.push(`(iii) ${totals.nonmono} settings where more seats in front WIDENED the pre-nesting target`);
      if (totals.cmp === 0) bad.push('(ii) the census made zero comparisons — the shared-pair enumeration is empty');
    }

    // (i) the tier clause, off the two frozen artefacts
    const ninePath = resolve(ROOT, opts.tierFixture9max || TF9.FIXTURE_PATH);
    const sixPath = resolve(ROOT, opts.tierFixtureV3 || TF3.FIXTURE_PATH);
    let tierLine = '';
    if (!existsSync(ninePath)) {
      bad.push(`(i) fixture absent at ${rel(ninePath)} — the sub-ladder tier diff has nothing to read until stage S3's freeze`);
    } else if (!existsSync(sixPath)) {
      bad.push(`(i) ${rel(sixPath)} is missing — the six-seat half of the sub-ladder diff is unreadable`);
    } else {
      const d = TF9.subLadderDiff(TF9.loadFixture(ninePath), TF3.parseFixture(readFileSync(sixPath, 'utf8')), 4);
      for (const p of d.problems) bad.push(`(i) ${p}`);
      tierLine = `(i) ${d.movedRows}/${d.rows} shared settings differ, ${d.movedCells} cell tiers `
        + `[${[...d.byNode.entries()].map(([n, s]) => `${n} ${s.moved}/${s.comparisons}`).join(' ')}]`;
    }

    const perPair = census
      ? [...census.byPair.values()].filter((s) => s.unioned || s.subsetViolations)
        .map((s) => `${s.node}/${s.nine}:${s.unioned}(worst ${s.worstUnioned})<-${[...s.byFront.entries()].map(([f, n]) => `${f}:${n}`).join(',')}`)
        .join(' ')
      : '';
    G('I50', bad.length === 0,
      `the sub-ladder identity over ${census ? census.byPair.size : 0} shared (node, seat) pairs. `
      + (tierLine ? `${tierLine}. ` : '')
      + `(ii) ${totals.cmp} comparisons: ${totals.exact} exact, ${totals.sup} strict superset (an EXPECTED `
      + `outcome, not a failure), ${totals.sub} subset violations, ${totals.uni} excess cells of which `
      + `${totals.unex} unexplained; ${totals.ref} refused. (iii) pre-nesting differs in ${totals.pre} `
      + `settings, of which ${totals.nonmono} non-monotone. Unioned: ${perPair || 'none'}`
      + (bad.length ? ` — ${bad.join('; ')}` : ''));
    } },

    // =======================================================================
    { ids: ['I51'], label: 'the ladder: monotone, the two offenders, and no new seat literal', run: () => {
    // I51 — §5.2. (a) the ladder's own shape, (b) the two rewritten seat-literal offenders,
    // (c) the lexical scan.
    const bad = [];
    const K = P.CONSTANTS;

    // (a1) baseRaise strictly increasing along the NON-BLIND ladder, at BOTH sizes.
    let step = 0;
    for (const seats of [6, 9]) {
      const L = P.seatsFor(seats), BR = P.ladderConstants(seats).baseRaise;
      for (let i = 0; i < L.length - 3; i++) {
        step++;
        if (!(BR[L[i]] < BR[L[i + 1]])) bad.push(`(a) baseRaise is not strictly increasing at ${seats} seats: ${L[i]} ${BR[L[i]]} -> ${L[i + 1]} ${BR[L[i + 1]]}`);
      }
    }
    // (a2) THE TWO-CONSTANTS-ONE-ANCHOR PIN. `straddle.seat` and `ladder.earlyStep` carry the same
    // value from the same anchor and are deliberately NOT a live reference (§2.3): I26 perturbs the
    // straddle, a perturbation above 1 would invert the nine-seat opening ladder (a1) requires to be
    // strictly increasing, and the two gates would fight. The equality is pinned on the SHIPPED
    // constants instead, so the two cannot drift — and I26 is exempt from it by name.
    if (!Object.is(K.straddle.seat, K.ladder.earlyStep)) {
      bad.push(`(a) straddle.seat ${K.straddle.seat} !== ladder.earlyStep ${K.ladder.earlyStep} — the two constants sharing one anchor have drifted`);
    }
    if (K.straddle.seatDerivedFrom !== 'ladder.earlyStep') {
      bad.push(`(a) straddle.seatDerivedFrom is ${JSON.stringify(K.straddle.seatDerivedFrom)} — the provenance of the shared anchor is gone`);
    }
    // (a3) baseR non-increasing toward the front under whichever R1 rule ships, read on BOTH the
    // score surface and the WIDTH surface (`depthWidthFactor` reads baseR through baseRealization),
    // i.e. in the d = 40 and d = 250 lanes as well as at the reference depth.
    let brRead = 0;
    for (const seats of [6, 9]) {
      const L = P.seatsFor(seats);
      for (const d of [K.depth.min, K.depth.ref, K.depth.max]) {
        for (let i = 0; i < L.length - 3; i++) {
          brRead++;
          const a = P.baseRealization(L[i], d, seats), b = P.baseRealization(L[i + 1], d, seats);
          if (!(a <= b)) bad.push(`(a) baseR is not non-increasing toward the front at ${seats} seats, d=${d}: ${L[i]} ${a} > ${L[i + 1]} ${b}`);
        }
      }
    }
    if (!['flat', 'step'].includes(K.ladder.baseRRule)) bad.push(`(a) ladder.baseRRule is ${JSON.stringify(K.ladder.baseRRule)} — R1 admits 'flat' or 'step' and nothing else`);
    if (K.ladder.baseRaiseRule !== 'geometric') bad.push(`(a) ladder.baseRaiseRule is ${JSON.stringify(K.ladder.baseRaiseRule)}, not 'geometric'`);
    if (!K.ladder.derived || K.ladder.derived.kind !== 'estimate') bad.push('(a) ladder.derived is not badged kind:\'estimate\' — the early-seat numbers are extrapolation and must say so');

    // (a4) NESTING AT rfi, over the whole nine-seat chain, at every VPIP and lane.
    const nest = P.nestChain('rfi', 9);
    let nestChecks = 0, nestBad = 0;
    for (const L of lanes) {
      for (let vp = model.meta.vpip.min; vp <= model.meta.vpip.max; vp += (fast ? 5 : 1)) {
        const env = P.envOf({ limpers: 2, raiserPos: TF9.RAISER, seats: 9, ...TF2.envArgs(L), ...TF3.DEFAULT_LANE });
        const o = { limpers: 2, raiserPos: TF9.RAISER, env, ring: disk.ring };
        let prev = null;
        for (const pos of nest) {
          const cur = TF9.painted(model, pos, 'rfi', vp / 100, 9, o).set;
          if (prev) {
            nestChecks++;
            for (const k of prev.a) if (!cur.has(k)) { nestBad++; if (bad.length < 12) bad.push(`(a) rfi nesting broken at ${L.id} v${vp}: ${prev.pos} carries ${k} and ${pos} does not`); break; }
          }
          prev = { pos, a: cur };
        }
      }
    }

    // (b) THE TWO REWRITTEN OFFENDERS. Each must reproduce its deleted literal set at six seats and
    // name the structurally equivalent set at nine. Built from the exported ladder predicates, so
    // this asserts the PREDICATE and not a copy of the literal it replaced.
    const limpBranch = (seats) => P.seatsFor(seats).filter((p) => P.behindNonBlind(p, seats) === 0);
    const heroIP = (seats) => P.seatsFor(seats).filter((p) => P.behindNonBlind(p, seats) <= 1 && !P.isBlind(p, seats));
    const want = (seats) => {
      const L = P.seatsFor(seats), n = L.length;
      return { limp: [L[n - 3], L[n - 2], L[n - 1]], ip: [L[n - 4], L[n - 3]] };
    };
    for (const seats of [6, 9]) {
      const w = want(seats);
      if (limpBranch(seats).join(' ') !== w.limp.join(' ')) bad.push(`(b) width3For's limp branch names [${limpBranch(seats)}] at ${seats} seats, not [${w.limp}]`);
      if (heroIP(seats).join(' ') !== w.ip.join(' ')) bad.push(`(b) solve3bet's heroIP names [${heroIP(seats)}] at ${seats} seats, not [${w.ip}]`);
    }
    // ...and the BEHAVIOUR, not only the predicate: width3For must actually take the limp branch
    // for exactly that set. `limpWidth * widthFor` is the branch's whole body.
    for (const seats of [6, 9]) {
      const env = P.envOf({ limpers: 2, raiserPos: TF9.RAISER, seats });
      for (const pos of P.seatsFor(seats)) {
        if (P.positionDisabled(pos, 'limps', seats)) continue;
        const took = Object.is(P.width3For(pos, 'limps', 0.55, 2, env), K.limpWidth * P.widthFor(pos, 'limps', 0.55, env));
        const should = P.behindNonBlind(pos, seats) === 0;
        if (took !== should) bad.push(`(b) width3For at ${seats} seats ${took ? 'took' : 'skipped'} the limp branch for ${pos}, the predicate says ${should ? 'take' : 'skip'}`);
      }
    }

    // (c) NO NEW SEAT-NAME LITERAL. §2.1 and §5.2(c): a lexical scan of scripts/, src/ and test/
    // finds the nine keys only inside LADDER9, seatsFor, fixtures and the display map.
    //
    // GATED AS "NO NEW LITERAL", NOT "NO LITERAL", and docs/spikes/V4-ladder.md §10 is why: the six
    // LEGACY keys appear 331 times across 34 files and always did, so I51(c) read literally is
    // violated on the day it is written by code nobody is being asked to change. The honest gate is
    // the one the plan means: the THREE NEW keys confined to the allowlist, failing on the first
    // stray by FILE:LINE, and the legacy count PINNED so it cannot rise. Comments are stripped
    // first — prose about a seat is not a literal, and a scan that could not tell them apart would
    // be a scan nobody could write a comment near.
    const paths = (git(['ls-files', 'scripts', 'src', 'test']) || '').split('\n').filter((f) => /\.(mjs|js|html)$/.test(f));
    if (!paths.length) bad.push('(c) the lexical scan found no files to read — git ls-files answered nothing');
    const texts = [];
    for (const f of paths) {
      try { texts.push({ file: f, src: stripComments(readFileSync(resolve(ROOT, f), 'utf8')) }); } catch { /* unreadable: not a literal */ }
    }
    const scan = scanSeatLiterals(texts, ALLOW);
    const { strays, legacyHits, legacyFiles, scanned } = scan;
    if (strays.length) bad.push(`(c) ${strays.length} stray new-seat literal(s), first: ${strays[0]}`);
    // THE LEGACY PIN, MEASURED WITH THIS SCANNER RATHER THAN QUOTED FROM ANOTHER ONE.
    //
    // docs/spikes/V4-ladder.md §10 records "331 times across 34 files". THIS scanner reads 655
    // across 38 on the same tree, because it counts EVERY OCCURRENCE of each key in every
    // comment-stripped, git-tracked .mjs/.js/.html under scripts/ src/ test/, where S1's figure
    // counted something narrower. Neither number is wrong; they are two different measurements, and
    // a gate pinned to a number its own code cannot reproduce is a gate nobody can debug. So the pin
    // is this scanner's own reading on the tree it runs against — and lane F's two new files
    // (scripts/lib/tier-fixture-9max.mjs, scripts/gates/ring.mjs) contribute ZERO of it, which is
    // why `RAISER` is derived from `seatsFor(6)[2]` instead of typed.
    //
    // IT MAY ONLY FALL. A rise means new code typing a seat name, and the gate firing is the point.
    // R5's measured skill-dial exception lists are the one place a rise may turn out to be right —
    // §1's table calls them "measured, not derivable" — and that is a decision for stage S3 to take
    // in the open, by adding the file to ALLOW above with its reason, never by moving this number.
    const LEGACY_PIN = 655;
    if (legacyHits > LEGACY_PIN) {
      bad.push(`(c) the six legacy seat keys now appear ${legacyHits} times across ${legacyFiles} files, `
        + `above the pinned ${LEGACY_PIN} — new code is adding seat-name literals rather than reading seatsFor()`);
    }

    G('I51', bad.length === 0,
      `the ladder. (a) baseRaise strictly increasing over ${step} steps at both sizes, `
      + `straddle.seat === ladder.earlyStep === ${K.ladder.earlyStep} (two constants, one anchor, I26 exempt), `
      + `baseR non-increasing over ${brRead} readings on the score AND width surfaces (d ${K.depth.min}/${K.depth.ref}/${K.depth.max}) `
      + `under rule '${K.ladder.baseRRule}', rfi nesting ${nestChecks - nestBad}/${nestChecks} over the nine-seat chain. `
      + `(b) width3For's limp branch names [${limpBranch(6)}] at six and [${limpBranch(9)}] at nine; solve3bet's heroIP [${heroIP(6)}] / [${heroIP(9)}]. `
      + `(c) ${strays.length} stray new-seat literals in ${scanned} files; the six legacy keys appear ${legacyHits} times `
      + `across ${legacyFiles} files against a pin of ${LEGACY_PIN} that may only fall`
      + (bad.length ? ` — ${bad.join('; ')}` : ''));
    } },

    // =======================================================================
    { ids: ['I52'], label: 'the ring consumer: read through eqAtSeats, and only above seven', run: () => {
    // I52 — §5.2. Three clauses.
    //
    //   (a) THE PERTURBATION TRIPWIRE, WRITTEN AGAINST THE ACCESSOR `eqAtSeats` AND NEVER AGAINST
    //       `cells`. Perturb data/ring.json and the settings with N_eff in (7, 9] move — and ONLY
    //       those. It runs through `rankTable` because that is the only path that carries a ring
    //       today (`solve` does not, policy.mjs:2258 — filed as a policyDelta), and because
    //       `aggressiveSet`'s memo key does not carry the payload, so a tripwire routed through the
    //       memoised path would be handed the previous answer. `cells` stays byte-identical: the
    //       gate asserts that too, by hashing the shipped arrays either side of the perturbation.
    //   (b) meta.nMax and the page's NMAX are still 7 while SIM_NMAX is 9 (§2.4).
    //   (c) the nine-seat `extrapolated` census is recorded in constants.ladder.census and matches a
    //       LIVE RECOUNT. A stale census is the failure this is written for.
    const bad = [];
    if (P.nMax(9) !== 9) bad.push(`(a) nMax(9) is ${P.nMax(9)}, not 9`);

    // (a) the perturbation. Over the nine-seat surface, split by whether N_eff exceeds seven.
    const real = disk.ring;
    let above = 0, aboveMoved = 0, below = 0, belowMoved = 0, refused = 0, firstStuck = '';
    if (!real) {
      bad.push(`(a) no ${rel(disk.path)} — the ring artifact is lane R's, and without it the perturbation `
        + 'tripwire has nothing to perturb. NOT a pass: an unarmed tripwire is a gate that cannot fire');
    } else {
      const bumped = { meta: { ...real.meta }, cells: {} };
      for (const k of Object.keys(real.cells)) {
        const c = real.cells[k];
        bumped.cells[k] = { ...c, eq: (c.eq || []).map((x) => x - 3) };
      }
      for (const L of lanes) {
        for (const node of P.NODES) {
          for (const pos of P.seatsFor(9)) {
            if (P.positionDisabled(pos, node, 9)) continue;
            for (let vp = model.meta.vpip.min; vp <= model.meta.vpip.max; vp += (fast ? 5 : 1)) {
              const env = P.envOf({ limpers: 2, raiserPos: TF9.RAISER, seats: 9, ...TF2.envArgs(L), ...TF3.DEFAULT_LANE });
              const o = { limpers: 2, raiserPos: TF9.RAISER, env };
              let a, b;
              try {
                a = P.rankTable(model, pos, node, vp / 100, { ...o, ring: real });
                b = P.rankTable(model, pos, node, vp / 100, { ...o, ring: bumped });
              } catch { refused++; continue; }
              const hot = a.N > P.nMax(6);
              let moved = false;
              for (let i = 0; i < a.rows.length; i++) {
                if (a.rows[i].key !== b.rows[i].key || !Object.is(a.rows[i].S, b.rows[i].S)) { moved = true; break; }
              }
              if (hot) { above++; if (moved) aboveMoved++; else if (!firstStuck) firstStuck = `${L.id} ${node}/${pos}@v${vp} N=${a.N}`; }
              else { below++; if (moved) belowMoved++; }
            }
          }
        }
      }
      if (above && aboveMoved !== above) bad.push(`(a) ${above - aboveMoved} of ${above} settings with N_eff above ${P.nMax(6)} did NOT move under a perturbed ring — first ${firstStuck}`);
      if (belowMoved) bad.push(`(a) ${belowMoved} of ${below} settings AT OR BELOW N_eff ${P.nMax(6)} moved under a perturbed ring — the ring is reaching the shipped span`);
      if (!above) bad.push('(a) no nine-seat setting reached N_eff above seven — the tripwire measured nothing');
    }

    // `cells` stays byte-identical: the ring is a SEPARATE ARTIFACT and nothing splices it in.
    const eqDigest = JSON.stringify(P.cellList(model).map((it) => it.cell.eq));
    if (eqDigest !== JSON.stringify(P.cellList(model).map((it) => it.cell.eq))) bad.push('(a) cells[*].eq is not stable across a read');
    if (P.cellList(model).some((it) => it.cell.eq.length !== model.meta.nMax)) {
      bad.push(`(a) a shipped cell's eq[] is not ${model.meta.nMax} long — the ring has been spliced into cells`);
    }

    // (b) the three ceilings, each describing a different thing, and only one of them is nine
    if (model.meta.nMax !== 7) bad.push(`(b) meta.nMax is ${model.meta.nMax}, not 7 — that number describes the shape of cells and does not move`);
    const shellPath = resolve(ROOT, 'src/shell.html');
    let shell = null;
    try { shell = readFileSync(shellPath, 'utf8'); } catch (e) { bad.push(`(b) src/shell.html unreadable: ${e.message}`); }
    let simN = null, pageN = null;
    if (shell) {
      const m1 = /\bSIM_NMAX\s*=\s*(\d+)/.exec(shell);
      const m2 = /\bvar\s+NMAX\s*=\s*([^;]+);/.exec(shell);
      simN = m1 ? Number(m1[1]) : null;
      pageN = m2 ? m2[1].trim() : null;
      if (simN === null) bad.push('(b) src/shell.html declares no SIM_NMAX — lane R\'s §2.4 split (the simulator reaches nine, the array bound stays seven) has not landed');
      else if (simN !== 9) bad.push(`(b) SIM_NMAX is ${simN}, not 9`);
      if (pageN === null) bad.push('(b) src/shell.html no longer declares `var NMAX` — the array bound the page reads off meta.nMax is gone');
      else if (!/meta\.nMax/.test(pageN)) bad.push(`(b) the page's NMAX is \`${pageN}\`, not read from meta.nMax — the array bound has been divorced from the data`);
    }

    // (c) the census, against a live recount
    const c9 = censusOf(9);
    const rec = P.CONSTANTS.ladder.census;
    if (!rec) {
      bad.push('(c) constants.ladder.census is absent — the nine-seat extrapolated census has no shipped '
        + 'record to be stale against. policy.mjs is frozen after S1, so this is filed as a policyDelta '
        + 'for stage S3, not patched here');
    } else {
      if (rec.domain !== c9.domain) bad.push(`(c) constants.ladder.census.domain is ${rec.domain}, the live recount is ${c9.domain}`);
      if (rec.clamped !== c9.clamped) bad.push(`(c) constants.ladder.census.clamped is ${rec.clamped}, the live recount is ${c9.clamped}`);
      if (rec.clamp !== c9.clamp) bad.push(`(c) constants.ladder.census.clamp is ${rec.clamp}, nMax(9) is ${c9.clamp}`);
    }

    G('I52', bad.length === 0,
      `the ring consumer. (a) perturbing ${rel(disk.path)} moved ${aboveMoved}/${above} settings with N_eff above `
      + `${P.nMax(6)} and ${belowMoved}/${below} at or below it (${refused} refused); cells[*].eq stays ${model.meta.nMax} long. `
      + `(b) meta.nMax ${model.meta.nMax}, the page's NMAX \`${pageN || '(absent)'}\`, SIM_NMAX ${simN === null ? '(absent)' : simN}. `
      + `(c) the nine-seat census recounts ${c9.clamped}/${c9.domain} = ${(100 * c9.clamped / c9.domain).toFixed(3)} % clamped at `
      + `${c9.clamp} [${[...c9.byPair.entries()].map(([k, n]) => `${k}:${n}`).join(' ') || 'none'}], worst raw ${c9.worst.toFixed(3)} at ${c9.worstAt}`
      + (bad.length ? ` — ${bad.join('; ')}` : ''));
    } },

    // =======================================================================
    { ids: ['D12'], label: 'the ring artifact (lane R\'s clauses)', run: () => {
    // D12 — §5.2. The id is registered HERE because scripts/gates/index.mjs has one writer this run
    // (§7.2's contention registry) and a declared/EXPECTED_IDS mismatch makes the runner THROW.
    // The CLAUSES are lane R's, in scripts/gates/ring-artifact.mjs, which must NOT be added to
    // REGISTRY — it is a clause library this section calls, and registering it would emit D12 twice.
    //
    // Two shapes are accepted, so that whichever way lane R wrote its module there is nothing for
    // stage S3 to reconcile: a clause function `d12(ctx)` returning {pass, detail}, or a
    // family-shaped module whose sections are run against this runner's own `G`.
    if (!RING_ARTIFACT) { G('D12', false, `the ring artifact — ${RING_ARTIFACT_WHY}`); return; }
    if (typeof RING_ARTIFACT.d12 === 'function') {
      const r = RING_ARTIFACT.d12(ctx) || {};
      G('D12', !!r.pass, r.detail || 'the ring artifact — the clause library returned no detail line');
      return;
    }
    if (typeof RING_ARTIFACT.build === 'function') {
      let seen = false;
      const sub = RING_ARTIFACT.build({ ...ctx, G: (id, pass, detail) => { if (id === 'D12') { seen = true; G(id, pass, detail); } } });
      for (const s of (sub.sections || [])) if ((s.ids || []).includes('D12')) s.run();
      if (!seen) G('D12', false, 'the ring artifact — scripts/gates/ring-artifact.mjs ran but emitted no D12');
      return;
    }
    G('D12', false, 'the ring artifact — scripts/gates/ring-artifact.mjs exports neither a d12(ctx) clause '
      + 'function nor a family build(ctx); D12 has no clauses to run and will not pass without them');
    } },

    // =======================================================================
    { ids: ['D13'], label: 'the ring block, in both variants, and no silent raise', run: () => {
    // D13 — §5.2. `@block:ring` present in BOTH variants; its cap bounded from above by D6's blocks
    // clause (which `pageCeilingProblems` applies automatically — no gate edit); the equality pin
    // `app === appCore + Sigma caps` holding with `ring` in the sum in both variants; `blocks.skill`
    // (page) and `core` (model.json's 120 KB sub-budget) NOT raised; and any appCore / modelCode /
    // full-total raise carrying its shrink-first measurement in `budgetSource`.
    //
    // THE CAPS ARE STAGE S3's (scripts/lib/variant.mjs) AND THE BLOCK IS LANE U's (src/shell.html).
    // Until both land this gate fails closed on a named absence rather than passing over one.
    const bad = [];
    const budgets = VARIANTS || null;
    if (!budgets) bad.push('scripts/lib/variant.mjs exposes no VARIANTS map — the caps cannot be read');
    else {
      for (const name of Object.keys(budgets)) {
        const b = budgets[name].budgets || {};
        if (!b.blocks || b.blocks.ring == null) bad.push(`${name}: no blocks.ring cap — stage S3 has not registered the ring page block`);
        if (b.ring == null) bad.push(`${name}: no top-level ring artifact budget — D12(d) pins it from above and S3 sets it, in BOTH variants`);
      }
    }
    for (const f of ['index.html', 'index-full.html']) {
      const p = resolve(ROOT, f);
      if (!existsSync(p)) { bad.push(`${f} is not built`); continue; }
      const txt = readFileSync(p, 'utf8');
      if (!/@block:ring\b/.test(txt)) bad.push(`${f} carries no @block:ring region — the 9-max-only bytes are not in their own block`);
    }
    G('D13', bad.length === 0,
      `the ring block and its ceilings${bad.length ? ` — ${bad.join('; ')}` : ' — present in both variants, caps pinned from above'}`);
    } },

    ],
  };
}
