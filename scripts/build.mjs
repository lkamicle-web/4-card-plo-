#!/usr/bin/env node
// build.mjs — inject the model, the policy and the classifier into index.html.
//
//   node scripts/build.mjs [data/model.json] [--allow-fast] [--check] [--page=index.html] [--out=path]
//                          [--no-minify] [--allow-over-budget]
//
// index.html carries three marked regions. Everything between a start and end marker is replaced;
// if only the start marker is present the end marker is inserted after it on first build.
//
//     /* @inject:data */     ... /* @end:data */       ->  const MODEL = { ... };
//     /* @inject:policy */   ... /* @end:policy */     ->  const POLICY = (() => { ... })();
//     /* @inject:taxonomy */ ... /* @end:taxonomy */   ->  const TAXONOMY = (() => { ... })();
//
// The two code regions are the real module sources with their `export` keywords stripped, wrapped
// in an IIFE that returns every exported name. So the page calls POLICY.solve(MODEL, state),
// TAXONOMY.rowOf(cards), and so on, and the model can never drift from the generator: there is
// exactly one copy of the policy in the repository.
//
// The classifier is truncated at its `@browser-cut` marker, which drops the full-enumeration code
// the page has no use for.
//
// The two injected code regions — and ONLY those — are stripped of comments and of the whitespace
// that carries no meaning, by scripts/lib/jsmin.mjs. They are machine-generated copies of module
// sources that live, fully commented, in scripts/lib/; the reader who wants them reads the module. The
// hand-authored app shell around them is left byte-for-byte alone: index.html is simultaneously the
// source and the artifact, so minifying the shell would destroy the source. --no-minify turns the
// stripping off, which is what the correctness harness diffs against.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { minify, JsminError } from './lib/jsmin.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const ALLOW_FAST = argv.includes('--allow-fast');
const CHECK_ONLY = argv.includes('--check');
const NO_MINIFY = argv.includes('--no-minify');
const ALLOW_OVER_BUDGET = argv.includes('--allow-over-budget');
const MODEL_PATH = resolve(ROOT, argv.find((a) => !a.startsWith('--')) || 'data/model.json');
const PAGE_ARG = argv.find((a) => a.startsWith('--page='));
const PAGE_PATH = resolve(ROOT, PAGE_ARG ? PAGE_ARG.slice(7) : 'index.html');

const die = (msg) => { console.error(`build: ${msg}`); process.exit(1); };

if (!existsSync(MODEL_PATH)) die(`no model at ${MODEL_PATH} — run scripts/generate-data.mjs first`);
if (!existsSync(PAGE_PATH)) die(`no index.html at ${PAGE_PATH}`);

const raw = readFileSync(MODEL_PATH, 'utf8');
const model = JSON.parse(raw);

// --- refuse a fast dataset, and refuse one that did not pass its own gates
if (model.meta.fast && !ALLOW_FAST) {
  die('data/model.json was generated with --fast (reduced trial counts). Re-run the generator '
    + 'without --fast, or pass --allow-fast if you are deliberately building a preview.');
}
const failed = Object.entries(model.gates || {}).filter(([, v]) => v !== 'pass');
if (failed.length) die(`model gates did not pass: ${failed.map(([k]) => k).join(', ')}`);

// --- the hash stamped by verify must still describe this file
const restamped = createHash('sha256')
  .update(JSON.stringify({ ...model, meta: { ...model.meta, hash: '' } })).digest('hex');
if (restamped !== model.meta.hash) {
  die('data/model.json has been edited since it was verified (hash mismatch). Re-run '
    + 'scripts/verify.mjs, which restamps the gates and the hash.');
}

// ---------------------------------------------------------------------------
// module source -> browser IIFE
// ---------------------------------------------------------------------------
function moduleToIife(path, name, { cutAt } = {}) {
  let src = readFileSync(resolve(ROOT, path), 'utf8');
  if (cutAt) {
    const i = src.indexOf(cutAt);
    if (i < 0) die(`${path} is missing its ${cutAt} marker`);
    src = src.slice(0, i);
  }
  if (/^\s*import\s/m.test(src)) die(`${path} has an import statement; the page cannot resolve one`);

  const names = [];
  src = src.replace(/^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, id) => {
    names.push(id);
    return `${kind} ${id}`;
  });
  if (/^export\s/m.test(src)) die(`${path} has an export form build.mjs does not understand`);
  if (!names.length) die(`${path} exports nothing`);

  /* minify() re-lexes its own output and compares literal lists, so a state-machine slip is a
     build failure rather than a silently corrupted page. */
  if (!NO_MINIFY) {
    try { src = minify(src); }
    catch (e) {
      if (e instanceof JsminError) die(`${path}: ${e.message} — refusing to ship it`);
      throw e;
    }
  }

  const block = `const ${name} = (() => {\n${src}\nreturn { ${names.join(', ')} };\n})();`;
  try { new Function(block); } catch (e) { die(`${path}: injected block does not parse — ${e.message}`); }
  return block;
}

const blocks = {
  data: `const MODEL = ${JSON.stringify(model)};`,
  policy: moduleToIife('scripts/lib/policy.mjs', 'POLICY'),
  taxonomy: moduleToIife('scripts/lib/taxonomy.mjs', 'TAXONOMY', { cutAt: '/* @browser-cut' }),
};

// ---------------------------------------------------------------------------
// splice into index.html
// ---------------------------------------------------------------------------
let page = readFileSync(PAGE_PATH, 'utf8');
const before = page;

for (const [key, body] of Object.entries(blocks)) {
  const start = `/* @inject:${key} */`;
  const end = `/* @end:${key} */`;
  const si = page.indexOf(start);
  if (si < 0) die(`index.html is missing the ${start} marker`);
  const ei = page.indexOf(end, si);
  const tail = ei < 0 ? page.slice(si + start.length) : page.slice(ei + end.length);
  page = `${page.slice(0, si)}${start}\n${body}\n${end}${tail}`;
}

// ---------------------------------------------------------------------------
// size gates
// ---------------------------------------------------------------------------
const total = Buffer.byteLength(page);
const dataBytes = Buffer.byteLength(blocks.data);
const modelCode = Buffer.byteLength(blocks.policy) + Buffer.byteLength(blocks.taxonomy);
const app = total - dataBytes - modelCode;
const report = `index.html ${(total / 1024).toFixed(1)} KB `
  + `(data ${(dataBytes / 1024).toFixed(1)} + model code ${(modelCode / 1024).toFixed(1)} `
  + `+ app ${(app / 1024).toFixed(1)} KB)`;

// Budgets. Three numbers, retuned 2026-08-29 for v2 (previously: 400 KB total, 245 KB app, and no
// gate at all on the inlined model code). v2 grew all three inputs at once — the dataset went to
// N=7 with a cooler rate and a villain lattice, the policy grew a whole environment layer (depth,
// rake, straddle), and the shell grew the controls, the expand-in-place sub view, hand search, the
// Method env section and an 11-step tour — so the old numbers describe a page that no longer
// exists. Measured 2026-08-29 at 516.7 KB total = data 143.1 + model code 43.7 + app 329.9; each
// budget below is that measurement plus about 5%, rounded. (Calibrated against 513.7/326.8 and
// re-read at 516.7/329.9 when the phase-end verification pass fixed four cross-feature defects in
// the shell. The budgets deliberately did not move with the reading, which now sits 4.5% under.)
//
//   TOTAL 540 KB (was 400). Still the number that decides whether this stays one double-clickable
//   file, and still the one meant to bind. It is no longer a "fits in 400" claim: the honest claim
//   is half a megabyte of self-contained page, most of it measured data.
//
//   APP 345 KB (was 245, itself raised from 230 when the review round landed). The app figure is
//   reported apart from the inlined policy/taxonomy, which are the model's own source rather than
//   interface code. The decision behind this number, taken at the v2 phase end and recorded in
//   docs/V2-PLAN.md: THE APP SHELL IS NOT MINIFIED. index.html is simultaneously the hand-authored
//   source and the shipped artifact, so running the shell through jsmin in place would permanently
//   destroy the source's comments, and splitting source from artifact to avoid that would break the
//   single-file contract the whole project rests on. An open-source tool whose claim is
//   transparency should not ship a shell nobody can read. Minifying the shell behind a
//   source/artifact split remains available as a Phase 4 option if the total ever has to come down.
//
//   MODEL CODE 46 KB (new gate). Calibrated from scratch, because since Phase 3 this measures a
//   STRIPPED quantity: scripts/lib/jsmin.mjs removes comments and dead whitespace from the two
//   injected module copies, which at this build takes them from 99.8 KB to 43.7 KB. The old
//   unstripped figure is not comparable and must not be carried forward. Because these blocks are
//   machine-generated copies, the gate's job is narrower than the other two — it catches a jsmin
//   regression or a policy.mjs that has doubled in size, not "too much prose".
//
// The data block carries no budget here; its ceiling is gate D7 in scripts/verify.mjs, which owns
// the payload size question and can reason about what the bytes buy.
const TOTAL_BUDGET = 540 * 1024;
const APP_BUDGET = 345 * 1024;
const MODEL_CODE_BUDGET = 46 * 1024;

const problems = [];
const sizeProblems = [];
const kb = (b) => (b / 1024).toFixed(1);
if (total > TOTAL_BUDGET) sizeProblems.push(`index.html is ${kb(total)} KB, budget ${TOTAL_BUDGET / 1024} KB`);
if (app > APP_BUDGET) sizeProblems.push(`app CSS+JS+markup is ${kb(app)} KB, budget ${APP_BUDGET / 1024} KB`);
if (modelCode > MODEL_CODE_BUDGET) {
  sizeProblems.push(`inlined model code is ${kb(modelCode)} KB, budget ${MODEL_CODE_BUDGET / 1024} KB`
    + (NO_MINIFY ? ' (this build passed --no-minify; the budget assumes stripping)' : ''));
}
if (/\bfetch\s*\(/.test(page)) problems.push('index.html calls fetch(), which is CORS-blocked on file://');
/* --allow-over-budget exists for one job: producing an inspectable artifact mid-rebuild, when the
   page is knowingly over budget and the point of the build is to measure how far over. It never
   suppresses a correctness gate, and CI must not pass it. */
if (sizeProblems.length && ALLOW_OVER_BUDGET) console.error(`build: OVER BUDGET (--allow-over-budget): ${sizeProblems.join('; ')}`);
else problems.push(...sizeProblems);
if (problems.length) { console.error(report); die(problems.join('; ')); }

if (CHECK_ONLY) {
  console.log(`build --check: ${report}`);
  console.log(page === before ? 'index.html is up to date' : 'index.html is STALE — run scripts/build.mjs');
  process.exit(page === before ? 0 : 1);
}

const OUT_ARG = argv.find((a) => a.startsWith('--out='));
writeFileSync(OUT_ARG ? resolve(ROOT, OUT_ARG.slice(6)) : PAGE_PATH, page);
console.log(`build: ${report}`);
console.log(`build: model ${model.meta.version} · ${model.meta.generated} · ${model.meta.hash.slice(0, 8)} · `
  + `${Object.keys(model.gates).length} gates pass`);
