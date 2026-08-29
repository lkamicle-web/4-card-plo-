#!/usr/bin/env node
// build.mjs — inject the model, the policy and the classifier into index.html.
//
//   node scripts/build.mjs [data/model.json] [--allow-fast] [--check] [--page=index.html] [--out=path]
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

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const ALLOW_FAST = argv.includes('--allow-fast');
const CHECK_ONLY = argv.includes('--check');
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

  return `const ${name} = (() => {\n${src}\nreturn { ${names.join(', ')} };\n})();`;
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

// Budgets. The hard gate is the 400 KB total the page must never exceed — that is the number that
// decides whether this stays a single double-clickable file, and it is now the one that actually
// binds: the built page sits within about a kilobyte of it. Anything added from here has to pay for
// itself by removing something else, which is the intended effect.
//
// The app figure is reported separately from the inlined policy/taxonomy, which are the model's own
// source rather than interface code. It is held at 245 KB, raised from 230 when the review round
// landed: the explanation surfaces those fixes added (a glossary behind every "?", the vs-3-bet
// equity histogram, the drill's curriculum mode and its always-fold baseline, orientation steps in
// the tour) are prose and markup, and the page is deliberately authored, commented and readable —
// an open-source tool whose claim is transparency should not ship minified.
const APP_BUDGET = 245 * 1024;

const problems = [];
if (total > 400 * 1024) problems.push(`index.html is ${(total / 1024).toFixed(1)} KB, budget 400 KB`);
if (app > APP_BUDGET) problems.push(`app CSS+JS+markup is ${(app / 1024).toFixed(1)} KB, budget ${APP_BUDGET / 1024} KB`);
if (/\bfetch\s*\(/.test(page)) problems.push('index.html calls fetch(), which is CORS-blocked on file://');
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
