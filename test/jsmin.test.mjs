// node --test test/*.test.mjs
//
// scripts/lib/jsmin.mjs strips the comments and dead whitespace out of the two module sources
// scripts/build.mjs inlines into index.html. It is the one place in the build that rewrites
// shipping code, so it gets tested twice over:
//
//   1. against adversarial sources, because comment stripping is where a naive implementation is
//      wrong in ways that only show up on some inputs — `//` inside a string, a `/*` inside a
//      template, a regex literal holding a quote. Each case is evaluated before and after and the
//      two results must agree exactly.
//   2. against the real thing, because agreeing on toy inputs is not the claim. The policy and
//      taxonomy IIFEs are built the way build.mjs builds them, stripped and unstripped, evaluated
//      in fresh VM contexts, and required to expose the same exports and compute the same numbers
//      as a direct import of the module.
//
// Neither of these renames an identifier or rewrites an expression, because jsmin does not: the
// output is the same program with the prose taken out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { stripJs, minify, JsminError } from '../scripts/lib/jsmin.mjs';
import * as P from '../scripts/lib/policy.mjs';
import * as T from '../scripts/lib/taxonomy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_PATH = resolve(ROOT, 'data/model.json');
const HAVE_MODEL = existsSync(MODEL_PATH);

/* Values built inside a VM context carry that realm's prototypes, so deepStrictEqual rejects them
   even when every own property matches. Compare the serialisations instead, with NaN and the
   infinities spelled out so they are not silently flattened to null. */
const shape = (v) => JSON.stringify(v, (k, x) =>
  (typeof x === "number" && !Number.isFinite(x) ? `#${String(x)}` : x));
const same = (a, b, msg) => assert.equal(shape(a), shape(b), msg);

/* ---------------------------------------------------------------- 1. adversarial sources */

// Each case declares `r`; the harness evaluates the source and its stripped form and compares.
// Anything that survives this list survives policy.mjs, which contains none of it.
const CASES = [
  ['a line comment inside a string',
    String.raw`const a = 'http://x//y'; const b = "// not a comment"; const r = [a, b];`],
  ['a block-comment opener inside a string',
    String.raw`const a = '/* nope */'; const b = "*/ also not"; const r = [a, b];`],
  ['a template holding slashes and comment markers',
    'const n = 3;\nconst s = `a//b /*c*/ ${n / 1} ${`in${n}ner`} end`;\nconst r = [s];'],
  ['nested template braces around an IIFE',
    'const o = { x: { y: 2 } };\nconst s = `${ o.x.y } ${ (() => { return `${o.x.y + 1}` })() }`;\nconst r = [s];'],
  ['a regex containing quotes and an escaped slash',
    String.raw`const re = /['"\/]+/g; const r = ["a'b\"c/d".replace(re, '-'), re.source];`],
  ['a regex whose character class holds / and *',
    String.raw`const re = /[/*]x[^/]y/; const r = [re.test('*x!y'), re.source];`],
  ['division a regex heuristic could swallow',
    String.raw`const a = 10, b = 2, c = 5; const r = [a /b/ c, (a) /b/ (c), [a][0] /b/ c];`],
  ['a regex after return, and after typeof',
    String.raw`function f() { return /a"b/.source; } const r = [f(), typeof /x'y/];`],
  ['ASI: a bare return above a comment line',
    'function f() {\n  // c\n  return\n  5;\n}\nconst r = [f()];'],
  ['ASI: statements opening with [ and (',
    'let x = 1\nlet y = [7, 8]\n;[x] = y\nconst r = [x, y]'],
  ['unary and increment spacing',
    'let a = 1, b = 2; const r = [a + +b, a - -b, a + ++b, a - --b];'],
  ['keyword-adjacent literals',
    String.raw`let x = 1; let out = []; switch (x) { case 1: out.push('one'); break; } const r = [typeof x, x in { 1: 1 }, void 0, out];`],
  ['multiline template whitespace, which is load-bearing',
    'const r = [`line1\n   indented\n\nblank`];'],
  ['escapes at the closing quote',
    String.raw`const r = ['a\\', "b\"c", 'd\'e', ` + '`f\\`g`];'],
  ['number forms',
    String.raw`const r = [0.5, .5, 1e-3, 0x1f, 1_000, 5 .toString(), 1..toFixed(1)];`],
  ['comments wedged between tokens',
    'const r = [typeof/*c*/1, 1/*c*/+/*c*/2, 1 +/*c*/+2];'],
  ['a trailing comment with no final newline',
    'const r = [1];\n// trailing comment with no newline'],
];

const evalR = (code) => JSON.stringify(runInNewContext(code + '\n;r', {}));

test('stripping preserves the program on sources that break naive comment strippers', () => {
  for (const [label, src] of CASES) {
    const out = minify(src);
    assert.equal(evalR(out), evalR(src), label);
  }
});

test('re-lexing the output finds the same literals it started with', () => {
  for (const [label, src] of CASES) {
    const first = stripJs(src);
    const second = stripJs(first.code);
    assert.deepEqual(second.literals, first.literals, label);
    // and it is a fixed point: a second strip changes nothing
    assert.equal(second.code, first.code, `${label} (not idempotent)`);
  }
});

test('every newline that separated two tokens survives, so ASI is unchanged', () => {
  // The one rewrite that would silently change meaning is joining lines. jsmin collapses runs of
  // whitespace but never deletes the last newline in a run.
  const src = 'function f() {\n  return\n  5\n}\nconst r = [f()]';
  const out = minify(src);
  assert.equal(evalR(out), evalR(src));
  assert.match(out, /return\n5/);
  assert.equal(runInNewContext(out + '\n;r', {})[0], undefined);
});

test('literals are copied byte for byte', () => {
  const src = 'const r = ["  two  spaces  ", `tpl\n  keeps\n  indent`, \'/*not a comment*/\'];';
  const vals = runInNewContext(minify(src) + '\n;r', {});
  same(vals, runInNewContext(src + '\n;r', {}));
  assert.equal(vals[0], '  two  spaces  ');
});

test('identifiers are not renamed', () => {
  const out = minify('function aVeryLongName(anArgument) { /* c */ return anArgument + 1; }\nconst r = [aVeryLongName(1)];');
  assert.match(out, /aVeryLongName/);
  assert.match(out, /anArgument/);
});

test('malformed input throws JsminError rather than guessing', () => {
  assert.throws(() => minify('const a = 1; /* never closed'), JsminError);
  assert.throws(() => minify('const s = `never closed'), JsminError);
  assert.throws(() => minify('const s = `open ${ 1 + 1'), JsminError);
});

/* ---------------------------------------------------------------- 2. the real module sources */

/* build.mjs's moduleToIife, reproduced: cut at the marker, strip `export`, wrap in an IIFE that
   returns every exported name. Kept in step with build.mjs by the export-parity assertions below —
   if build.mjs's wrapping changes shape, those are what notice. */
function iife(relPath, name, cutAt) {
  let src = readFileSync(resolve(ROOT, relPath), 'utf8');
  if (cutAt) src = src.slice(0, src.indexOf(cutAt));
  const names = [];
  src = src.replace(/^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, id) => {
    names.push(id);
    return `${kind} ${id}`;
  });
  return { names, block: (body) => `const ${name} = (() => {\n${body}\nreturn { ${names.join(', ')} };\n})();\n;${name}`, src };
}

const POLICY_SRC = iife('scripts/lib/policy.mjs', 'POLICY', null);
const TAX_SRC = iife('scripts/lib/taxonomy.mjs', 'TAXONOMY', '/* @browser-cut');

const build = (s, stripped) => runInNewContext(s.block(stripped ? minify(s.src) : s.src), { console });


const P0 = build(POLICY_SRC, false), P1 = build(POLICY_SRC, true);
const T0 = build(TAX_SRC, false), T1 = build(TAX_SRC, true);

test('the injected blocks expose the same exports stripped as unstripped', () => {
  assert.ok(POLICY_SRC.names.length > 40, `policy exports ${POLICY_SRC.names.length}`);
  assert.deepEqual(Object.keys(P1).sort(), Object.keys(P0).sort());
  assert.deepEqual(Object.keys(T1).sort(), Object.keys(T0).sort());
  // and the same exports the module itself does
  assert.deepEqual(Object.keys(P1).sort(), Object.keys(P).filter((k) => k !== 'default').sort());
  // taxonomy is truncated at @browser-cut, so it is a strict subset
  const tax = Object.keys(T).filter((k) => k !== 'default');
  for (const k of Object.keys(T1)) assert.ok(tax.includes(k), `TAXONOMY.${k} is not a taxonomy.mjs export`);
  for (const k of ['enumerateAll', 'spanExamples']) assert.ok(!(k in T1), `${k} should be cut for the browser`);
});

test('stripping actually removes something, and only from the copy', () => {
  const before = POLICY_SRC.src.length, after = minify(POLICY_SRC.src).length;
  assert.ok(after < before * 0.65, `policy.mjs ${before} -> ${after} B, expected under 65%`);
  // the module on disk is untouched: it still has its comments
  assert.match(readFileSync(resolve(ROOT, 'scripts/lib/policy.mjs'), 'utf8'), /\/\/ /);
});

test('the exported constants survive stripping exactly', () => {
  for (const k of Object.keys(P0).filter((k) => typeof P0[k] !== 'function')) {
    same(P1[k], P0[k], `POLICY.${k}`);
    same(P1[k], P[k], `POLICY.${k} vs module`);
  }
  for (const k of Object.keys(T0).filter((k) => typeof T0[k] !== 'function')) {
    same(T1[k], T0[k], `TAXONOMY.${k}`);
    same(T1[k], T[k], `TAXONOMY.${k} vs module`);
  }
});

test('the stripped policy computes the same scalars as the module, exactly', () => {
  const calls = [
    ['cCall', [0.2]], ['cCall', [0.55]], ['cBlind', [0.55]], ['cLimper', [0.9]],
    ['depthU', [20]], ['depthU', [100]], ['depthU', [400]],
    ['kappa', [4]], ['lambda', [40]], ['mu', [40]], ['mNut', [0.8, 5]],
    ['mDeep', [0.3, 0.5, 60]], ['baseRealization', ['UTG', 100]], ['realization', ['CO', 3, 0.4, 100]],
    ['nuMin', [5]], ['seatWidthFactor', ['UTG', {}]], ['seatWidthFactor', ['BTN', { straddle: true }]],
    ['effectiveDepth', [{ d: 250 }]], ['effectiveDepth', [{ d: 100, straddle: true }]],
    ['rakeFraction', [{ rakePct: 5, rakeCapBB: 3 }]], ['breakevenPrice', [{ rakePct: 5, rakeCapBB: 3 }]],
    ['callFloorAt', [{ d: 200 }]], ['nuCallAt', [{ d: 200 }]], ['fourBetAt', [{ d: 200 }]],
    ['envKey', [{ d: 60, rakePct: 5, rakeCapBB: 3 }]], ['straddleActive', [{ straddle: true }]],
    ['unitBB', [{ straddle: true }]], ['widthFor', ['CO', 'rfi', 55, {}]],
    ['tightenFor', ['UTG', 55, {}]], ['rhoAt', [[30, 32, 34, 36, 38], 3]],
    ['nEff', [{ pos: 'CO', node: 'rfi', v: 55, limpers: 2 }]],
    ['positionDisabled', ['BB', '3bet']],
  ];
  for (const [fn, args] of calls) {
    const clone = () => args.map((a) => structuredClone(a));
    const want = P[fn](...clone());
    same(P1[fn](...clone()), want, `POLICY.${fn}(${JSON.stringify(args)})`);
    same(P0[fn](...clone()), want, `unstripped POLICY.${fn}`);
  }
});

test('the stripped taxonomy classifies the same hands as the module', () => {
  // a fixed pseudo-random sample, so a failure is reproducible
  let s = 12345;
  const rand = (m) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % m; };
  const hands = [];
  for (let i = 0; i < 4000; i++) {
    const set = new Set();
    while (set.size < 4) set.add(rand(52));
    hands.push([...set]);
  }
  for (const fn of ['rowOf', 'colOf', 'cellKeyOf', 'suitPattern', 'nutSuited',
    'adjRaw', 'danglerCount', 'domDistinct']) {
    for (const h of hands) {
      const want = T[fn](h);
      same(T1[fn](h), want, `TAXONOMY.${fn}([${h}])`);
      same(T0[fn](h), want, `unstripped TAXONOMY.${fn}([${h}])`);
    }
  }
});

test('the stripped policy solves identically to the module', { skip: !HAVE_MODEL && 'no data/model.json' }, () => {
  const raw = readFileSync(MODEL_PATH, 'utf8');
  const states = [];
  for (const node of ['rfi', 'limps', 'raise', '3bet']) {
    for (const pos of ['UTG', 'CO', 'BTN', 'BB']) {
      for (const v of [25, 55, 85]) {
        for (const env of [undefined, { d: 40, rakePct: 5, rakeCapBB: 3 }, { d: 200, straddle: true }]) {
          states.push({ pos, node, v, limpers: 2, raiserPos: 'CO', env });
        }
      }
    }
  }
  for (const st of states) {
    const want = JSON.stringify(P.solve(JSON.parse(raw), st));
    assert.equal(JSON.stringify(P1.solve(JSON.parse(raw), st)), want, `${st.node}/${st.pos}/${st.v}`);
    assert.equal(JSON.stringify(P0.solve(JSON.parse(raw), st)), want, `unstripped ${st.node}/${st.pos}/${st.v}`);
  }
});
