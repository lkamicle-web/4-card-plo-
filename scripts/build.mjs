#!/usr/bin/env node
// build.mjs — compile the hand-authored shell into the shipped single-file page.
//
//   node scripts/build.mjs [data/model.json] [--allow-fast] [--check]
//                          [--source=src/shell.html] [--out=index.html]
//                          [--no-minify] [--allow-over-budget]
//
// SOURCE AND ARTIFACT ARE TWO FILES.
//
//   src/shell.html   hand-authored. Markup, CSS and the app's JavaScript, fully commented. This is
//                    the file you edit. It is not runnable on its own: the model, the policy and
//                    the classifier are not in it.
//   index.html       generated, and never edited by hand. The shipped product: one file you can
//                    download and double-click, offline, with everything in it.
//
// Until Phase 4 those were the same file, which meant the shell could never be minified without
// destroying the source it was also serving as. Splitting them keeps both properties: the source
// stays readable, and the artifact is one self-contained file.
//
// WHAT A BUILD DOES
//
// 1. The shell's four marked regions are replaced with generated code. Everything between a start
//    and end marker is replaced; if only the start marker is present the end marker is inserted
//    after it on first build.
//
//      /* @inject:data */     ... /* @end:data */       ->  const MODEL = { ... };
//      /* @inject:policy */   ... /* @end:policy */     ->  const POLICY = (() => { ... })();
//      /* @inject:taxonomy */ ... /* @end:taxonomy */   ->  const TAXONOMY = (() => { ... })();
//      /* @inject:engine */   ... /* @end:engine */     ->  const SIM_KERNEL_SRC = "..."; SIM_ENTRY_SRC
//
//    The last one is the Simulate worker bundle (V2-PLAN §4), assembled by scripts/lib/sim-bundle.mjs
//    out of eval5/villain-range/order-pack and the marked portable slices of villains.mjs and
//    mc.mjs, and carried as two JS string literals the page turns into a Blob worker.
//
//    The two code regions are the real module sources with their `export` keywords stripped,
//    wrapped in an IIFE that returns every exported name. So the page calls POLICY.solve(MODEL,
//    state), TAXONOMY.rowOf(cards), and so on, and the model can never drift from the generator:
//    there is exactly one copy of the policy in the repository. The classifier is truncated at its
//    `@browser-cut` marker, which drops the full-enumeration code the page has no use for.
//
// 2. Every inline <script> in the shell — and the two injected module copies — go through
//    scripts/lib/jsmin.mjs, which removes comments and the whitespace that carries no meaning and
//    touches nothing else: every literal is copied byte for byte, every token-separating newline
//    survives (so automatic semicolon insertion behaves exactly as it did in the source), and no
//    identifier is renamed. The comments live on in src/shell.html and in scripts/lib/, which is
//    where a reader who wants them should be reading anyway. --no-minify turns the stripping off,
//    which is what the correctness harness diffs against.
//
//    Markup and CSS are NOT minified. jsmin is a JavaScript lexer with a test suite; writing an
//    HTML/CSS minifier to save a few more KB would mean shipping an untested rewriter over the
//    part of the page a browser is most particular about.
//
// 3. A provenance banner naming the source and its hash is written into the artifact, and the
//    result is size-gated and written to index.html.
//
// --check rebuilds in memory and compares against the index.html on disk. It therefore catches a
// stale artifact from any direction: an edited shell, a regenerated model, a changed policy, a
// changed minifier, or a hand-edit of the artifact itself. Exit 1 means "run the build".

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';
import { minify, JsminError } from './lib/jsmin.mjs';
import { buildSimBundle, asJsString } from './lib/sim-bundle.mjs';
import { compileShellScripts, ShellCompileError } from './lib/shell-compile.mjs';
import {
  VARIANTS, VARIANT_NAMES, stripOnlyBlocks, regionManifest, danglingSymbols, VariantError,
} from './lib/variant.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const ALLOW_FAST = argv.includes('--allow-fast');
const CHECK_ONLY = argv.includes('--check');
const NO_MINIFY = argv.includes('--no-minify');
const ALLOW_OVER_BUDGET = argv.includes('--allow-over-budget');
const MODEL_PATH = resolve(ROOT, argv.find((a) => !a.startsWith('--')) || 'data/model.json');
const flag = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const die = (msg) => { console.error(`build: ${msg}`); process.exit(1); };

/* --- THE PER-VARIANT --check LOOP (V3-PLAN §9; the house GREEN rule, which reads "both variants
   once the dual build exists").
//
   `node scripts/build.mjs --check` with no `--variant=` checks EVERY shipped artifact, not the
   default one. A check that covered only lite would read as coverage while providing none the day
   a second artifact ships — and the whole reason S-D made `--check` report STALE against the other
   variant's file BY NAME was that a check which passes regardless of variant is worthless.

   Each variant is checked in a child process rather than in a loop inside this file. The child is
   this same script with `--variant=` appended, so every path below — the refusals, the region
   manifest, the budgets, the banner, the byte comparison — is exercised exactly as it is in a real
   single-variant run. A restructure into a callable function would have to prove it kept those
   identical; a re-exec does not.

   THE DISPOSITION TABLE, and it is failure-closed in both directions, which is the point:

     inputs present, artifact present   run the real --check (this is lite, today)
     inputs present, artifact ABSENT    FAIL — the child says "it has never been built"
     inputs ABSENT,  artifact present   FAIL here — the artifact outlived the input it was built
                                        from, which is the one state neither a build nor a byte
                                        comparison can notice
     inputs ABSENT,  artifact absent    SKIPPED, reported by name

   The third row is why the loop is worth writing today, and the second is why it is worth writing
   BEFORE the full artifact exists: the day P3 lands `data/equilibrium.json`, this loop starts
   demanding `index-full.html` with no edit to it. It arms itself. */
if (CHECK_ONLY && flag('variant') === null && flag('out') === null) {
  const relRoot = (p) => relative(ROOT, p);
  const eqPath = resolve(ROOT, flag('eq') || 'data/equilibrium.json');
  const self = fileURLToPath(import.meta.url);
  const skipped = [];
  const failed = [];
  const checked = [];

  for (const name of VARIANT_NAMES) {
    const spec = VARIANTS[name];
    const out = resolve(ROOT, spec.out);
    const missing = (spec.regions.includes('eq') ? [eqPath] : []).filter((f) => !existsSync(f));
    const built = existsSync(out);

    if (missing.length && !built) {
      skipped.push(`${name} (no ${missing.map(relRoot).join(', ')}, and no ${relRoot(out)} — `
        + 'that variant is not built in this repository yet)');
      continue;
    }
    if (missing.length && built) {
      console.log(`${relRoot(out)} is STALE: the ${name} artifact exists but `
        + `${missing.map(relRoot).join(', ')} does not — it outlived the input it was built from. `
        + `Restore the input and rebuild, or delete ${relRoot(out)}.`);
      failed.push(name);
      continue;
    }
    const r = spawnSync(process.execPath, [self, ...argv, `--variant=${name}`], { stdio: 'inherit' });
    if (r.error) die(`could not re-exec for --variant=${name}: ${r.error.message}`);
    if (r.status === 0) checked.push(name); else failed.push(name);
  }

  const parts = [`${checked.length}/${checked.length + failed.length} variant`
    + `${checked.length + failed.length === 1 ? '' : 's'} current`
    + (checked.length ? ` (${checked.join(', ')})` : '')];
  if (failed.length) parts.push(`STALE: ${failed.join(', ')}`);
  if (skipped.length) parts.push(`skipped: ${skipped.join('; ')}`);
  console.log(`build --check: ${parts.join(' · ')}`);
  process.exit(failed.length ? 1 : 0);
}

/* --- the dual build (docs/V3-PLAN.md §5.2/§5.3/§9; S-D prototype).
   `lite` is the default, and that is a decision rather than an alphabetical accident: lite is the
   non-negotiable artifact (locked 4.2), so a bare `node scripts/build.mjs` must keep producing it
   at index.html exactly as it did before this flag existed. */
const VARIANT_NAME = flag('variant') || 'lite';
if (!VARIANT_NAMES.includes(VARIANT_NAME)) {
  die(`--variant=${VARIANT_NAME} is not a variant — known variants are ${VARIANT_NAMES.join(', ')}`);
}
const VARIANT = VARIANTS[VARIANT_NAME];

const SOURCE_PATH = resolve(ROOT, flag('source') || 'src/shell.html');
const OUT_PATH = resolve(ROOT, flag('out') || VARIANT.out);
const EQ_PATH = resolve(ROOT, flag('eq') || 'data/equilibrium.json');
const rel = (p) => relative(ROOT, p);

if (!existsSync(MODEL_PATH)) die(`no model at ${MODEL_PATH} — run scripts/generate-data.mjs first`);
if (!existsSync(SOURCE_PATH)) {
  die(`no shell source at ${rel(SOURCE_PATH)} — that file is the hand-authored source; index.html `
    + 'is generated from it');
}

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

// ---------------------------------------------------------------------------
// compile: shell source -> artifact
// ---------------------------------------------------------------------------
const source = readFileSync(SOURCE_PATH, 'utf8');
const sourceHash = createHash('sha256').update(source).digest('hex');

/* The artifact carries a banner naming its source. If that banner turns up in the source, someone
   has copied the built page over it — which would replace the commented shell with the minified
   one. Refuse, loudly, rather than build from it. */
const BANNER_RE = /<!-- GENERATED FILE[\s\S]*?-->\n?/;
if (BANNER_RE.test(source)) {
  die(`${rel(SOURCE_PATH)} carries a GENERATED FILE banner — it looks like a copy of the built `
    + 'index.html. The source is the commented, un-minified shell; restore it from git rather '
    + 'than building from a generated page.');
}

/* Walk every <script> in the shell source and run its body through the same lexer the injected
   modules use. The rules, and the reasoning behind each, are in scripts/lib/shell-compile.mjs —
   it lives there rather than here so test/shell-compile.test.mjs can hold it to them. */
/* THE TWO REFUSALS RUN ON THE RAW SOURCE, BEFORE ANY VARIANT STRIPPING, and that ordering is the
   whole point. Both are absolute for both shipped artifacts (§5.3) — but if they only ran on the
   built page, a `fetch(` or a `<script src=>` living inside an `@only:full` block would be invisible
   to every lite build. CI would then have to build BOTH variants to catch it, and a refusal whose
   coverage depends on which artifacts someone happened to build is not absolute. Scanning the
   un-stripped source makes a lite-only build refuse a full-only violation, which is the property
   the word "absolute" was claiming all along. The post-build page scan stays too: it also covers
   the generated blocks, which are not in the source at all. */
{
  const src = /<script\b([^>]*)>/gi;
  for (let m; (m = src.exec(source));) {
    if (/\bsrc\s*=/i.test(m[1])) {
      die(`${rel(SOURCE_PATH)}: <script src=…> at line ${source.slice(0, m.index).split('\n').length}`
        + ' would break the single-file, offline promise — refused in every variant, including the'
        + ' ones this build is not producing');
    }
  }
  if (/\bfetch\s*\(/.test(source)) {
    die(`${rel(SOURCE_PATH)} calls fetch(), which is CORS-blocked on file:// — refused in every`
      + ' variant, including the ones this build is not producing');
  }
}

/* Variant stripping runs BEFORE the <script> walk: a full-only <script> must never be minified,
   parse-gated or size-counted for a lite artifact it is not in. */
let only;
try { only = stripOnlyBlocks(source, VARIANT_NAME, { label: rel(SOURCE_PATH) }); }
catch (e) {
  if (e instanceof VariantError) die(e.message);
  throw e;
}

/* S-D §F's measured gap, refused here rather than left to the browser: code this variant KEEPS
   calling a function this variant DROPPED. The build is the only place with both halves in hand —
   see danglingSymbols() in lib/variant.mjs for why it is scoped to call sites, and why a name the
   kept text also declares is not a finding. This is the build-time half of gate D10; the artifact
   half (no EQUILIBRIUM, no evEstimate, no solver payload in lite) is D10 proper in verify.mjs. */
{
  const dangling = danglingSymbols(only, source);
  if (dangling.length) {
    const first = dangling[0];
    die(`${rel(SOURCE_PATH)}: the ${VARIANT_NAME} build keeps a call to ${first.name}() at line `
      + `${first.line}, but ${first.name} is declared only inside the @only:${first.fromVariant} `
      + `block opened at line ${first.fromLine} — the ${VARIANT_NAME} page would parse, ship, and `
      + `throw at runtime`
      + (dangling.length > 1
        ? ` (${dangling.length} such symbols: ${dangling.map((d) => d.name).join(', ')})`
        : '')
      + '. Move the caller into the same @only block, or give the variant its own definition.');
  }
}

let shell;
try { shell = compileShellScripts(only.text, { label: rel(SOURCE_PATH), noMinify: NO_MINIFY }); }
catch (e) {
  if (e instanceof ShellCompileError) die(e.message);
  throw e;
}

/* The Simulate engine (V2-PLAN §4). Two strings, not one, and the reason is in sim-bundle.mjs:
   the KERNEL half is safe to evaluate on the main thread and is what the rAF fallback runs, while
   the ENTRY half installs `self.onmessage` and would clobber `window.onmessage` outside a worker.
   The page concatenates them for the Blob and evaluates the kernel alone for the fallback. */
let sim;
try { sim = buildSimBundle(NO_MINIFY ? null : minify); }
catch (e) {
  if (e instanceof JsminError) die(`sim bundle: ${e.message} — refusing to ship it`);
  die(`sim bundle: ${e.message}`);
}
for (const [half, src] of [['kernel', sim.kernel], ['entry', sim.entry]]) {
  try { new Script(src); } catch (e) { die(`sim bundle ${half} does not parse — ${e.message}`); }
}

/* The full-only equilibrium payload (§5.3): the solved baseline, the pair matrix and the
   calibration detail that must NOT be in lite. It is a separate file from model.json on purpose —
   model.json stays the single shared artifact both variants inject, and D6/D7 keep binding it as
   the lite contract. */
let eqRaw = null;
if (VARIANT.regions.includes('eq')) {
  if (!existsSync(EQ_PATH)) {
    die(`the ${VARIANT_NAME} build needs ${rel(EQ_PATH)} — the full-only equilibrium payload `
      + '(V3-PLAN §5.3). Generate it, or build --variant=lite.');
  }
  eqRaw = readFileSync(EQ_PATH, 'utf8');
  try { JSON.parse(eqRaw); } catch (e) { die(`${rel(EQ_PATH)} is not JSON — ${e.message}`); }
}

const blocks = {
  data: `const MODEL = ${JSON.stringify(model)};`,
  policy: moduleToIife('scripts/lib/policy.mjs', 'POLICY'),
  taxonomy: moduleToIife('scripts/lib/taxonomy.mjs', 'TAXONOMY', { cutAt: '/* @browser-cut' }),
  engine: `const SIM_KERNEL_SRC = ${asJsString(sim.kernel)};\n`
    + `const SIM_ENTRY_SRC = ${asJsString(sim.entry)};`,
  eq: eqRaw === null ? null : `const EQUILIBRIUM = ${JSON.stringify(JSON.parse(eqRaw))};`,
};

/* Which regions this variant fills, checked BOTH ways against the stripped source: a missing one
   fails, and so does one this variant does not own. That second half is gate D10's build-time
   teeth — an `@inject:eq` region that someone forgot to wrap in `@only:full` fails the lite build
   instead of shipping an empty region into the artifact that must not have it. */
let regions;
try { regions = regionManifest(shell.html, VARIANT_NAME, { label: rel(SOURCE_PATH) }); }
catch (e) {
  if (e instanceof VariantError) die(e.message);
  throw e;
}

let page = shell.html;
for (const key of regions) {
  const body = blocks[key];
  if (body == null) die(`internal: no generated block for @inject:${key}`);
  const start = `/* @inject:${key} */`;
  const end = `/* @end:${key} */`;
  const si = page.indexOf(start);
  if (si < 0) die(`${rel(SOURCE_PATH)} is missing the ${start} marker`);
  const ei = page.indexOf(end, si);
  const tail = ei < 0 ? page.slice(si + start.length) : page.slice(ei + end.length);
  page = `${page.slice(0, si)}${start}\n${body}\n${end}${tail}`;
}

/* Provenance, in the artifact, where someone who opened the wrong file will see it. The source
   hash is what --check reads back to say *which* input drifted. Nothing here may vary between two
   builds of the same inputs — no timestamps — or --check's rebuild-and-compare stops working. */
/* The variant line is what makes the banner answer "which of the two artifacts am I holding?" —
   D11's per-variant provenance clause. It also means the two artifacts can never be byte-identical
   even if their contents happen to coincide, which is the property that keeps a `--check` run
   honest when the out paths are passed by hand. */
const eqLine = eqRaw === null ? ''
  : `       data/equilibrium.json   ${(Buffer.byteLength(eqRaw) / 1024).toFixed(1)} KB `
    + `· sha256 ${createHash('sha256').update(eqRaw).digest('hex').slice(0, 16)}\n`;
const banner = `<!-- GENERATED FILE — do not edit. Built by scripts/build.mjs from:\n`
  + `       ${rel(SOURCE_PATH)}   sha256 ${sourceHash.slice(0, 16)}\n`
  + `       data/model.json   ${model.meta.version} · ${model.meta.hash.slice(0, 16)}\n`
  + eqLine
  + `       scripts/lib/policy.mjs + scripts/lib/taxonomy.mjs (inlined)\n`
  + `     VARIANT ${VARIANT_NAME} — ${VARIANT.claim}.\n`
  + `     Comments and dead whitespace are stripped from the JavaScript${NO_MINIFY ? ' — EXCEPT IN THIS BUILD, which passed --no-minify' : ''};\n`
  + `     the commented originals are the files above. Edit ${rel(SOURCE_PATH)}, then run:\n`
  + `       node scripts/build.mjs --variant=${VARIANT_NAME}\n-->`;
const doctype = /^<!doctype html>\r?\n/i.exec(page);
page = doctype ? `${doctype[0]}${banner}\n${page.slice(doctype[0].length)}` : `${banner}\n${page}`;

// ---------------------------------------------------------------------------
// size gates
// ---------------------------------------------------------------------------
const total = Buffer.byteLength(page);
const dataBytes = Buffer.byteLength(blocks.data);
const modelCode = Buffer.byteLength(blocks.policy) + Buffer.byteLength(blocks.taxonomy);
const engineBytes = Buffer.byteLength(blocks.engine);
const eqBytes = blocks.eq === null ? 0 : Buffer.byteLength(blocks.eq);
/* `app` keeps its established meaning — everything that is not the dataset or the inlined model
   source — so the APP budget below still binds the same quantity it was calibrated against. The
   engine's share of it is reported separately because it is machine-generated like the model code,
   not hand-written interface code, and a reader deserves to know which is which. */
/* The equilibrium payload comes OUT of `app` as well as out of `data`: it is neither interface
   code nor the shared model, it is the full build's own dataset, and folding it into `app` would
   silently blow a budget calibrated against markup+CSS+JS. It is reported on its own line and
   gated on its own (D9). At lite this term is 0 and every number below is what it was. */
const app = total - dataBytes - modelCode - eqBytes;
const report = `${rel(OUT_PATH)} [${VARIANT_NAME}] ${(total / 1024).toFixed(1)} KB `
  + `(data ${(dataBytes / 1024).toFixed(1)} + model code ${(modelCode / 1024).toFixed(1)} `
  + (eqBytes ? `+ equilibrium ${(eqBytes / 1024).toFixed(1)} ` : '')
  + `+ app ${(app / 1024).toFixed(1)} KB, of which sim engine ${(engineBytes / 1024).toFixed(1)})`;

// Budgets. Three numbers, set 2026-08-30 against the finished v2 page — the phase-4 end retune,
// done once and in one place rather than nudged per change. (History: v1 ran 400 KB total / 245 KB
// app and no gate at all on the inlined model code; the phase-3 end moved those to 540 / 345 and
// added a 46 KB model-code gate; a provisional 580 KB total carried the page through the middle of
// phase 4. All of that is superseded by this block.)
//
// MEASURED, on the shipped build:
//
//   index.html   588,210 B = 574.4 KB
//     data       187,874 B = 183.5 KB   the injected model
//     model code  47,282 B =  46.2 KB   inlined policy.mjs + taxonomy.mjs, stripped
//     app        353,054 B = 344.8 KB   markup + CSS + minified app JS (incl. 18.8 KB sim bundle)
//
// Each budget below is that measurement plus about 5%, rounded — the same rule the phase-3 numbers
// were set by, and tight enough that a moderately large regression fails rather than fits.
//
// WHAT MOVED THE NUMBER, both directions, because the total is UP while the shell got smaller:
//
//   -62.6 KB  the source/artifact split. The app shell now goes through jsmin too, which took the
//             page from 516.7 to 454.1 KB (app 329.9 -> 267.3). Markup and CSS are untouched.
//   +40.4 KB  data: the frozen villain ordering the Simulate button re-cuts (V2-PLAN §4, gate D8).
//             Fixed-size — 16,432 classes at 15 bits — so it will not creep, but it is paid once.
//   +18.8 KB  the inlined Simulate worker bundle (kernel + entry, minified), injected as JS strings.
//   +58.7 KB  the Simulate/villain-profile surface itself: the engine module, the profile control
//             and q editor, the segmented progress bar, the badges, the shadow-model plumbing, the
//             honesty copy, the Method rewrite and a twelfth tour step.
//    +2.5 KB  policy.mjs's villain-profile equity accessor, in the model-code block.
//
//   TOTAL 600 KB (was 540, provisionally 580). Measured 574.4, headroom 4.5%. Still the number
//   that decides whether this stays one double-clickable file. The honest claim is not "it fits in
//   400": it is 572 KB of self-contained offline page, a third of it measured data.
//
//   APP 360 KB (was 345). Measured 344.8, headroom 4.4%. Reported apart from the inlined
//   policy/taxonomy, which are the model's own source rather than interface code, so this gate
//   keeps binding the same quantity it was calibrated against: markup, CSS and the minified app
//   JavaScript. It is the tighter of the two in practice — data is fixed and model code is capped,
//   so a shell regression hits APP first, which is what should happen.
//
//   MODEL CODE 50 KB (was 46). RATIFIED, not re-derived: policy.mjs grew the villain-profile
//   equity accessor — the lattice interpolation, the exactness rule at the lattice points, and the
//   strict-identity OFF path that keeps gate I22 checkable — which took the measurement to 46.2 KB,
//   over the old 46 KB gate. The raise was a necessity, not a convenience, and 50 is that
//   measurement plus about 8%, the margin this gate was originally calibrated with. Left at 8%
//   rather than trimmed to 5%: this gate measures a STRIPPED quantity (jsmin takes the two injected
//   module copies from 107.0 KB to 46.2 KB at this build), so its job is narrower than the other
//   two — it catches a jsmin regression or a policy.mjs that has doubled, not "too much prose" —
//   and a 5% margin on a stripped figure is a margin on the minifier's ratio as much as on the
//   source. Building with --no-minify deliberately blows it (107.0 KB against 50), and the failure
//   says so.
//
// The data block carries no budget here; its ceiling is gate D7 in scripts/verify.mjs, which owns
// the payload size question and can reason about what the bytes buy. Full accounting, with the
// decision history the split reversed: docs/METHODOLOGY.md §9.11.
//
// UNDER THE DUAL BUILD these three are LITE's numbers, and they are unchanged: the budgets live in
// scripts/lib/variant.mjs keyed by variant, and lite's row carries exactly the figures above. The
// full build has NO budgets, on purpose. Every number in this block was derived from a measurement
// of a page that exists; there is no measurement of a full artifact, because the equilibrium
// payload it would be sized around has not been solved yet. Inventing a ceiling would ship an
// unanchored constant wearing the costume of a checked one — so the full build prints its bytes,
// says out loud that nothing is asserted, and leaves the number to gate D9 once P3 produces a real
// data/equilibrium.json. See docs/spikes/S-D.md.
const BUDGETS = VARIANT.budgets;

const problems = [];
const sizeProblems = [];
const kb = (b) => (b / 1024).toFixed(1);
if (BUDGETS) {
  if (total > BUDGETS.total) sizeProblems.push(`${rel(OUT_PATH)} is ${kb(total)} KB, budget ${BUDGETS.total / 1024} KB`);
  if (app > BUDGETS.app) sizeProblems.push(`app CSS+JS+markup is ${kb(app)} KB, budget ${BUDGETS.app / 1024} KB`);
  if (modelCode > BUDGETS.modelCode) {
    sizeProblems.push(`inlined model code is ${kb(modelCode)} KB, budget ${BUDGETS.modelCode / 1024} KB`
      + (NO_MINIFY ? ' (this build passed --no-minify; the budget assumes stripping)' : ''));
  }
} else {
  console.error(`build: [${VARIANT_NAME}] SIZE NOT GATED — ${VARIANT.budgetSource}. `
    + `Measured ${kb(total)} KB total / ${kb(app)} KB app / ${kb(eqBytes)} KB equilibrium.`);
}
if (/\bfetch\s*\(/.test(page)) problems.push(`${rel(OUT_PATH)} calls fetch(), which is CORS-blocked on file://`);
/* The artifact must not carry the seam's own markers. A leaked `@only:` is either a marker the
   stripper failed to consume or a string literal that spelled one, and either way the page is not
   the page the manifest describes. Cheap, and it closes the stripper's one known text-scan hazard
   at the artifact rather than trusting the scan. */
if (/@only:|@end:only/.test(page)) {
  problems.push(`${rel(OUT_PATH)} still contains an @only: marker — the variant seam did not consume it`);
}
/* --allow-over-budget exists for one job: producing an inspectable artifact mid-rebuild, when the
   page is knowingly over budget and the point of the build is to measure how far over. It never
   suppresses a correctness gate, and CI must not pass it. */
if (sizeProblems.length && ALLOW_OVER_BUDGET) console.error(`build: OVER BUDGET (--allow-over-budget): ${sizeProblems.join('; ')}`);
else problems.push(...sizeProblems);
if (problems.length) { console.error(report); die(problems.join('; ')); }

const shellLine = `shell ${rel(SOURCE_PATH)} ${kb(Buffer.byteLength(source))} KB source`
  + (only.blocks.length
    ? ` -> @only ${only.kept} kept (${kb(only.keptBytes)} KB) / ${only.dropped} dropped `
      + `(${kb(only.droppedBytes)} KB)`
    : ' -> no @only blocks (variant-inert source)')
  + ` -> ${shell.blocks} inline script${shell.blocks === 1 ? '' : 's'} `
  + (NO_MINIFY ? `copied verbatim (--no-minify)` : `${kb(shell.before)} -> ${kb(shell.after)} KB`);

// ---------------------------------------------------------------------------
// --check: is the artifact on disk what this build produces?
// ---------------------------------------------------------------------------
if (CHECK_ONLY) {
  console.log(`build --check: ${report}`);
  console.log(`build --check: ${shellLine}`);
  const onDisk = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, 'utf8') : null;
  if (onDisk === page) {
    console.log(`${rel(OUT_PATH)} is up to date`);
    process.exit(0);
  }
  /* Say which input drifted. The artifact records the hash of the shell it was built from, so a
     shell edited without a rebuild — the common case, and the one this gate exists for — is named
     exactly, rather than reported as a generic byte difference. */
  let why;
  const stampedVariant = onDisk === null ? null : /^\s*VARIANT (\w+) —/m.exec(onDisk);
  if (onDisk === null) why = `there is no ${rel(OUT_PATH)} — it has never been built`;
  else if (stampedVariant && stampedVariant[1] !== VARIANT_NAME) {
    /* The likeliest way to get here is a --check with --out= pointed at the other artifact, and a
       generic byte-difference message would send the reader hunting for a drifted input that is
       fine. Name it. */
    why = `${rel(OUT_PATH)} is the ${stampedVariant[1]} artifact, and this is a ${VARIANT_NAME} `
      + `--check — pass --variant=${stampedVariant[1]}, or point --out= at ${VARIANT.out}`;
  } else {
    const stamped = /sha256 ([0-9a-f]{16})/.exec(onDisk);
    if (!stamped) why = `${rel(OUT_PATH)} carries no build banner, so it was not produced by this build`;
    else if (stamped[1] !== sourceHash.slice(0, 16)) {
      why = `${rel(SOURCE_PATH)} has changed since ${rel(OUT_PATH)} was built `
        + `(source ${sourceHash.slice(0, 12)}…, artifact was built from ${stamped[1].slice(0, 12)}…)`;
    } else {
      why = `${rel(OUT_PATH)} differs from a fresh build of the same shell — data/model.json, `
        + 'scripts/lib/*.mjs or the build itself changed, or the artifact was hand-edited';
    }
  }
  console.log(`${rel(OUT_PATH)} is STALE: ${why} — run scripts/build.mjs`);
  process.exit(1);
}

writeFileSync(OUT_PATH, page);
console.log(`build: ${report}`);
console.log(`build: ${shellLine}`);
console.log(`build: model ${model.meta.version} · ${model.meta.generated} · ${model.meta.hash.slice(0, 8)} · `
  + `${Object.keys(model.gates).length} gates pass`);
