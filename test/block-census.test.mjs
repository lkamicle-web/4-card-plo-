// block-census.test.mjs — the from-above byte clause (gate D6, v3 release consolidation) held to
// what it claims, and the census it reads held to what the build prints.
//
// docs/refutations/P5.md §3 recorded that every page ceiling was "anchored from below and open
// from above": `app` at 460 KB and at 512 KB shipped completely green, and a kilobyte moved from
// one block cap to another left the receiving block at measured +23.9 % with every gate passing.
// The clause that closes this is `pageCeilingProblems` in scripts/gates/data.mjs, and a bounding
// clause nobody has watched refuse is a clause nobody knows the shape of — so each of the P5
// refuters' perturbations is replayed here against it, and the assertion is that it says no.
//
// The second half is the census. D6 reads its measured bytes off the artifact and the shell on
// disk, through scripts/lib/block-census.mjs — the same function the build runs. That is one
// mechanism by construction for the marked blocks; for `app`, `total` and the model code the gate
// reads the artifact by its own region markers and the build reads its own assembled pieces, and
// the only oracle that ties those together is the build's report. So the build's `--check` line is
// parsed and compared, to the tenth of a KB it prints, for every figure the gate bounds.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { VARIANTS, VARIANT_NAMES, stripOnlyBlocks } from '../scripts/lib/variant.mjs';
import { compileShellScripts } from '../scripts/lib/shell-compile.mjs';
import { BLOCKS, blockCensus, pageCensus } from '../scripts/lib/block-census.mjs';
import {
  CEILING_MARGINS, REQUIRED_CEILINGS, ceilingBound, citeOf, citationProblems, pageCeilingProblems,
  readPageCeilings,
} from '../scripts/gates/data.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KB = 1024;

// ---------------------------------------------------------------------------
// the bound's arithmetic
// ---------------------------------------------------------------------------

test('the bound is measured × factor rounded UP to the whole KB — §9.11\'s own derivations reproduce', () => {
  /* The P3 raise: "377,993 B = 369.1 KB; +5 % is 387.6, rounded up to the whole KB: 388 KB". */
  assert.equal(ceilingBound(377993, 1.05), 388 * KB);
  /* The per-block caps as derived in §9.11: topn "4,844 B + 5 % = 5,087 B, rounded up to the whole
     KB" = 5 KB; calib "5,313 B + 5 % = 5,579 B" = 6 KB; gto 10,198 B and ev 11,403 B and skill
     3,532 B at +5 % = 11, 12 and 4 KB. */
  assert.equal(ceilingBound(4844, 1.05), 5 * KB);
  assert.equal(ceilingBound(5313, 1.05), 6 * KB);
  assert.equal(ceilingBound(10198, 1.05), 11 * KB);
  assert.equal(ceilingBound(11403, 1.05), 12 * KB);
  assert.equal(ceilingBound(3532, 1.05), 4 * KB);
  /* An exact whole-KB product is not rounded up a further KB. */
  assert.equal(ceilingBound(10 * KB / 1.05, 1.05), 10 * KB);
});

test('the margins are the documented ones, and each row says where it was read', () => {
  assert.equal(CEILING_MARGINS.total.factor, 1.05);
  assert.equal(CEILING_MARGINS.app.factor, 1.05);
  assert.equal(CEILING_MARGINS.appCore.factor, 1.05);
  assert.equal(CEILING_MARGINS.blocks.factor, 1.05);
  /* NOT 5 %: "the 8% margin this gate was calibrated with" (variant.mjs), "Left at 8% rather than
     trimmed to 5%" (build.mjs). A clause that applied 5 % here would be refusing a cap the
     documents allow, which is the wrong direction for a quotation. */
  assert.equal(CEILING_MARGINS.modelCode.factor, 1.08);
  for (const k of Object.keys(CEILING_MARGINS)) {
    assert.match(CEILING_MARGINS[k].cite, /variant\.mjs:\d+|build\.mjs:\d+/, `${k} cites its source line`);
  }
});

// ---------------------------------------------------------------------------
// the clause, refusing what the P5 refuters shipped
// ---------------------------------------------------------------------------

/** TODAY'S LIVE CENSUS — what `readPageCeilings()` reads off the main tree at the release
 *  consolidation, and asserted to still be that below (`readPageCeilings passes on the tree …`), so
 *  a rebuild that moves a byte must move these too, exactly as the manifest strings must. NOT the
 *  readings the caps were set from: `app` 398K was set against 392.7K (variant.mjs:159;
 *  METHODOLOGY:2620) and `modelCode` 54K against 53,353 B (variant.mjs:136), and the P5 rewrite's
 *  1.0K of core moved both since. `total` 597,942 B is on the record (variant.mjs:170, :232); `app`
 *  403,177 B and model code 53,376 B are recorded here and nowhere else. No assertion below turns on
 *  the byte: the bounds are 414K and 57K for either figure. */
const TODAY = {
  total: 597942, app: 403177, appCore: 403177 - 35290, modelCode: 53376,
  blocks: { gto: 10198, ev: 11403, skill: 3532, topn: 4844, calib: 5313 },
};
const loosened = (over) => ({ ...VARIANTS.lite.budgets, ...over });

test('today\'s caps clear the clause, and every ceiling is read', () => {
  const r = pageCeilingProblems('lite', VARIANTS.lite.budgets, TODAY);
  assert.deepEqual(r.problems, []);
  assert.equal(r.readings.length, 4 + BLOCKS.length, 'total, app, core, model code, and one per block');
  assert.match(r.readings.join(' '), /app 393\.7K\/398K≤414K/);
  assert.match(r.readings.join(' '), /model code 52\.1K\/54K≤57K/);
});

test('REFUTER 1 REPLAYED: `app` at 460 KB is refused, and the refusal names the ceiling and the bound', () => {
  const r = pageCeilingProblems('lite', loosened({ app: 460 * KB }), TODAY);
  assert.equal(r.problems.length, 1, r.problems.join(' | '));
  assert.match(r.problems[0], /^lite app: the ceiling 460K is LOOSER/);
  assert.match(r.problems[0], /393\.7K × 1\.05 rounded up to the whole KB is 414K/);
  assert.match(r.problems[0], /variant\.mjs:\d+/, 'the refusal cites where the margin was read');
});

test('REFUTER 3 REPLAYED: a kilobyte moved from `gto` to `topn` is refused on `topn`', () => {
  const r = pageCeilingProblems('lite',
    loosened({ blocks: { gto: 10 * KB, ev: 12 * KB, skill: 4 * KB, topn: 6 * KB, calib: 6 * KB } }), TODAY);
  /* gto at 10 KB = 10,240 B is 42 B ABOVE today's measured 10,198 B — tighter than the +5 % rule
     (which allows 11K) but still a cap the page fits under, so the build accepts it, and this clause
     has nothing to say about it and must not: it bounds looseness only. (The first draft of this
     comment had the build refusing it; 10,240 > 10,198, and it does not.) */
  assert.deepEqual(r.problems.map((p) => p.split(':')[0]), ['lite topn']);
  assert.match(r.problems[0], /4\.7K × 1\.05 rounded up to the whole KB is 5K/);
});

test('the model code is bounded at +8 %, not +5 %: 57 KB clears (52.1K × 1.08 rounds up to 57), 58 KB does not', () => {
  assert.deepEqual(pageCeilingProblems('lite', loosened({ modelCode: 57 * KB }), TODAY).problems, []);
  const r = pageCeilingProblems('lite', loosened({ modelCode: 58 * KB }), TODAY);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /^lite model code: the ceiling 58K is LOOSER/);
  assert.match(r.problems[0], /× 1\.08/);
});

test('`core` and `total` are bounded too — a removal that does not move the ceiling is refused', () => {
  /* Delete 20 KB of unmarked code and leave both ceilings where they are: core 339.3K × 1.05 =
     356.3 -> 357 KB < 360, and app 373.7K × 1.05 = 392.4 -> 393 KB < 398. Unmarked bytes are in
     both readings, so BOTH caps are now looser than the rule and both are refused — the removal
     has to be paid back on each. */
  const shrunk = { ...TODAY, app: TODAY.app - 20 * KB, appCore: TODAY.appCore - 20 * KB };
  const r = pageCeilingProblems('lite', VARIANTS.lite.budgets, shrunk);
  assert.deepEqual(r.problems.map((p) => p.split(':')[0]), ['lite app', 'lite core']);
  const t = pageCeilingProblems('lite', loosened({ total: 615 * KB }), TODAY);
  assert.deepEqual(t.problems.map((p) => p.split(':')[0]), ['lite total']);
  assert.deepEqual(pageCeilingProblems('lite', loosened({ total: 614 * KB }), TODAY).problems, []);
});

test('a cap for a block the shell no longer marks is pure headroom, and is refused', () => {
  const gone = { ...TODAY, blocks: { ...TODAY.blocks, calib: 0 } };
  const r = pageCeilingProblems('lite', VARIANTS.lite.budgets, gone);
  assert.deepEqual(r.problems.map((p) => p.split(':')[0]), ['lite calib']);
  assert.match(r.problems[0], /0\.0K × 1\.05 rounded up to the whole KB is 0K/);
});

test('one byte above appCore + capSum clears THIS clause — the equality pin in variant.test.mjs is what catches it', () => {
  /* Stated so the division of labour is on the record: this clause bounds each ceiling against its
     own measurement; the identity app === appCore + Σcaps is the other repair and lives beside the
     cap table's restatement. */
  const caps = VARIANTS.lite.budgets.blocks;
  const capSum = Object.keys(caps).reduce((a, k) => a + caps[k], 0);
  const r = pageCeilingProblems('lite', loosened({ app: VARIANTS.lite.budgets.appCore + capSum + 1 }), TODAY);
  assert.deepEqual(r.problems, []);
});

// ---------------------------------------------------------------------------
// the clause, refusing what the fix round found it skipping
// ---------------------------------------------------------------------------

test('a documented ceiling DELETED from the table is refused by name, not skipped (finding E)', () => {
  /* The first cut bounded the ceilings that existed: `appCore` deleted from lite's row verified
     62/62 with `core` simply missing from the detail line. Every required ceiling is now a refusal
     when absent, and the others are still read. */
  const without = (key) => { const b = { ...VARIANTS.lite.budgets }; delete b[key]; return b; };
  const labels = { total: 'total', app: 'app', appCore: 'core', modelCode: 'model code' };
  for (const key of REQUIRED_CEILINGS) {
    const r = pageCeilingProblems('lite', without(key), TODAY);
    assert.deepEqual(r.problems.map((p) => p.split(':')[0]), [`lite ${labels[key]}`], key);
    assert.match(r.problems[0], /the documented ceiling is ABSENT from the table/);
    assert.match(r.problems[0], /variant\.mjs:\d+|build\.mjs:\d+/, 'the refusal still cites the margin');
    assert.equal(r.readings.length, 3 + BLOCKS.length, `${key} absent: the other ceilings are still read`);
  }
  /* One block cap gone: refused on that block, the other four still read. */
  const blocks = { ...VARIANTS.lite.budgets.blocks };
  delete blocks.calib;
  const one = pageCeilingProblems('lite', loosened({ blocks }), TODAY);
  assert.deepEqual(one.problems.map((p) => p.split(':')[0]), ['lite calib']);
  assert.equal(one.readings.length, 4 + BLOCKS.length - 1);
  /* The whole block table gone: one refusal naming all five. */
  const none = pageCeilingProblems('lite', without('blocks'), TODAY);
  assert.deepEqual(none.problems.map((p) => p.split(':')[0]), ['lite blocks']);
  for (const name of BLOCKS) assert.ok(none.problems[0].includes(name), `names ${name}`);
  /* No table at all — the pre-P3 "SIZE NOT GATED" stance — is every ceiling absent at once. */
  const nul = pageCeilingProblems('lite', null, TODAY);
  assert.equal(nul.problems.length, 1);
  assert.match(nul.problems[0], /^lite: no budgets table/);
  assert.deepEqual(nul.readings, []);
});

test('every cite is anchored: the cited line carries the quoted phrase on disk, and a quote per row names its percentage (finding F)', () => {
  const c = citationProblems();
  assert.deepEqual(c.problems, [], c.problems.join(' | '));
  const anchors = Object.values(CEILING_MARGINS).reduce((a, r) => a + r.anchors.length, 0);
  assert.equal(c.checked, anchors);
  assert.ok(anchors >= 5, 'at least one anchor per row');
  for (const k of Object.keys(CEILING_MARGINS)) {
    const row = CEILING_MARGINS[k];
    const pct = Math.round((row.factor - 1) * 100);
    assert.ok(row.anchors.some((a) => a.quote.includes(`${pct}%`) || a.quote.includes(`${pct} %`)),
      `${k}: at least one quoted phrase names +${pct} %, so the literal factor is the document's number`);
    assert.equal(row.cite, citeOf(row.anchors), `${k}: the printed cite is derived from the anchors, not typed twice`);
    for (const a of row.anchors) assert.ok(a.quote.length >= 12, `${k}: "${a.quote}" is a phrase, not a token`);
  }
});

test('a cite whose line drifted is refused naming where the phrase went; a phrase gone or a file unreadable fails closed', () => {
  const real = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
  const all = Object.values(CEILING_MARGINS).flatMap((r) => r.anchors);
  /* One blank line inserted at the top of variant.mjs: every variant.mjs cite is one line stale. */
  const shifted = (rel) => (rel.endsWith('variant.mjs') ? `\n${real(rel)}` : real(rel));
  const d = citationProblems(CEILING_MARGINS, shifted);
  assert.equal(d.problems.length, all.filter((a) => a.file.endsWith('variant.mjs')).length);
  for (const p of d.problems) {
    const m = /cites variant\.mjs:(\d+) for .* the phrase is at :(\d+) now/.exec(p);
    assert.ok(m, p);
    assert.equal(+m[2], +m[1] + 1, 'the refusal names the line the phrase moved to');
  }
  /* The percentage edited out of the prose: the modelCode quotes are gone, and the factor stays. */
  const gone = (rel) => real(rel).replace(/8%/g, 'N%').replace(/8 %/g, 'N %');
  const g = citationProblems(CEILING_MARGINS, gone);
  assert.equal(g.problems.length, CEILING_MARGINS.modelCode.anchors.length, g.problems.join(' | '));
  for (const p of g.problems) assert.match(p, /^modelCode's margin cites .* the phrase is gone from the file/);
  /* A cited file that cannot be read is a failure, not a pass. */
  const unreadable = (rel) => (rel.endsWith('METHODOLOGY.md') ? null : real(rel));
  const u = citationProblems(CEILING_MARGINS, unreadable);
  assert.equal(u.problems.length, all.filter((a) => a.file.endsWith('METHODOLOGY.md')).length);
  for (const p of u.problems) assert.match(p, /cannot be read — fail closed$/);
  /* And the seam is the one readPageCeilings honours, so D6 goes red on the same drift. */
  const rp = readPageCeilings({ readSource: shifted, artifacts: { lite: null, full: null } });
  assert.ok(rp.problems.some((p) => /variant\.mjs:\d+ for/.test(p)), 'readPageCeilings carries the cite refusal');
});

// ---------------------------------------------------------------------------
// the census, read off disk, against the build's own report
// ---------------------------------------------------------------------------

test('pageCensus refuses a page that is not a built artifact', () => {
  assert.throws(() => pageCensus('<html>no regions</html>', { label: 'x' }), /no \/\* @inject:data \*\/ region/);
  const twice = '/* @inject:data */\nA\n/* @end:data */ /* @inject:data */\nB\n/* @end:data */';
  assert.throws(() => pageCensus(twice, { label: 'x' }), /appears more than once/);
  const open = '/* @inject:data */\nA\n';
  assert.throws(() => pageCensus(open, { label: 'x' }), /never closed/);
});

test('pageCensus reads each region to the byte, and `app` is the build\'s definition', () => {
  const page = 'HEAD/* @inject:data */\n12345\n/* @end:data */MID/* @inject:policy */\nab\n/* @end:policy */'
    + '/* @inject:taxonomy */\nxyz\n/* @end:taxonomy */TAIL';
  const c = pageCensus(page);
  assert.equal(c.data, 5);
  assert.equal(c.modelCode, 5);
  assert.equal(c.eq, 0, 'a lite page has no eq region and its term is 0');
  assert.equal(c.total, Buffer.byteLength(page));
  assert.equal(c.app, c.total - c.data - c.modelCode - c.eq);
});

test('readPageCeilings passes on the tree as it stands, for both artifacts, and fails closed on an absent one', () => {
  const r = readPageCeilings();
  assert.deepEqual(r.problems, [], r.problems.join(' | '));
  assert.deepEqual(Object.keys(r.measured).sort(), [...VARIANT_NAMES].sort());
  /* TODAY is the live census, not a remembered one — see its note. A rebuild that moves a byte
     fails here until the fixture says the new number. */
  assert.deepEqual(r.measured.lite, TODAY, 'TODAY must be what the tree measures now');
  assert.equal(r.anchors, Object.values(CEILING_MARGINS).reduce((a, m) => a + m.anchors.length, 0),
    'every cite was re-read on the way to the readings');
  for (const v of VARIANT_NAMES) {
    const m = r.measured[v];
    assert.equal(m.appCore, m.app - Object.values(m.blocks).reduce((a, b) => a + b, 0));
    assert.ok(m.app <= VARIANTS[v].budgets.app, `${v} app is under its cap`);
  }
  const absent = readPageCeilings({ artifacts: { lite: null, full: null } });
  assert.equal(absent.problems.length, 2);
  assert.match(absent.problems[0], /there is no index\.html .* fail closed/);
  const fake = readPageCeilings({ artifacts: { lite: '<html>not a build</html>', full: null } });
  assert.match(fake.problems[0], /^lite: the ceilings cannot be measured/);
});

test('the census agrees with `build.mjs --check`\'s own report, to the tenth of a KB it prints, for every figure D6 bounds', () => {
  const shell = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  for (const v of VARIANT_NAMES) {
    const spec = VARIANTS[v];
    const res = spawnSync(process.execPath, [resolve(ROOT, 'scripts/build.mjs'), '--check', `--variant=${v}`],
      { cwd: ROOT, encoding: 'utf8' });
    const line = (res.stdout + res.stderr).split('\n').find((l) => l.includes(`[${v}]`) && l.includes(' app '));
    assert.ok(line, `build --check printed no report line for ${v}: ${res.stdout}${res.stderr}`);
    const num = (re) => { const m = re.exec(line); assert.ok(m, `${re} not in: ${line}`); return +m[1]; };
    const kb = (b) => +(b / KB).toFixed(1);

    const page = readFileSync(resolve(ROOT, spec.out), 'utf8');
    const pc = pageCensus(page, { label: spec.out });
    const only = stripOnlyBlocks(shell, v, { label: 'src/shell.html' });
    const base = compileShellScripts(only.text, { label: 'src/shell.html' });
    const bc = blockCensus(only.text, Buffer.byteLength(base.html), { label: 'src/shell.html' });

    assert.equal(kb(pc.total), num(/\[\w+\] ([\d.]+) KB \(data/), `${v} total`);
    assert.equal(kb(pc.data), num(/data ([\d.]+) \+/), `${v} data`);
    assert.equal(kb(pc.modelCode), num(/model code ([\d.]+) /), `${v} model code`);
    if (spec.regions.includes('eq')) assert.equal(kb(pc.eq), num(/equilibrium ([\d.]+) /), `${v} eq`);
    assert.equal(kb(pc.app), num(/\+ app ([\d.]+) KB/), `${v} app`);
    for (const name of BLOCKS) {
      assert.equal(kb(bc.by[name]), num(new RegExp(`${name} ([\\d.]+)`)), `${v} block ${name}`);
    }
    assert.equal(kb(pc.app - bc.total), num(/-> core ([\d.]+)/), `${v} core`);
  }
});
