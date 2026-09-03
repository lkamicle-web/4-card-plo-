// test/gates-variants.test.mjs — the dual build's gates driven through every branch they can FAIL
// on: D10, D11, and D6's restatement as the lite contract.
//
// The point of this file is not that the gates pass on today's index.html; `node scripts/verify.mjs`
// says that, every run. The point is the other direction. D10 is a NEGATIVE manifest and D11 is a
// provenance check, and both of them pass trivially on a page that happens not to contain anything
// interesting — which is exactly the shape of gate that rots into a no-op without anyone noticing,
// because it never once printed FAIL. So each row of the manifest gets a page that violates it, and
// each clause of D11 gets an artifact that breaks it, and the assertion is that the gate says so.
//
// `opts.artifacts` and `opts.shellText` are the injection seam — the same idiom I22/I32 use for
// `opts.tierFixture`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import * as variants from '../scripts/gates/variants.mjs';
import * as dataGates from '../scripts/gates/data.mjs';
import { VARIANTS } from '../scripts/lib/variant.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = JSON.parse(readFileSync(resolve(ROOT, 'data/model.json'), 'utf8'));

const SHELL = 'the shell this test pretends is on disk';
const SHELL_HASH = createHash('sha256').update(SHELL).digest('hex').slice(0, 16);

/** A minimal artifact that satisfies every clause, so a single deliberate defect is isolated. */
function page(variant, over = {}) {
  const spec = VARIANTS[variant];
  const claim = over.claim === undefined ? spec.claim : over.claim;
  const banner = over.banner !== undefined ? over.banner
    : `<!-- GENERATED FILE\n       src/shell.html   sha256 ${over.srcHash || SHELL_HASH}\n`
      + `     VARIANT ${over.stamp || variant} — ${claim}.\n-->`;
  /* The newline between the packed ordering and the body matters: D10's declaration patterns are
     anchored on a real token boundary, so `<base64>const EQUILIBRIUM` is correctly NOT a match —
     it is not a declaration. Splicing the two together would test the regex, not the gate. */
  return `${banner}\n<html>${model.order.packed}\n${over.body || ''}</html>`;
}

/** Run just this family and return its gates by id. */
function run(opts) {
  const gates = [];
  const ctx = { model, opts, G: (id, pass, detail) => gates.push({ id, pass, detail }) };
  const built = variants.build(ctx);
  for (const s of built.sections) s.run();
  return Object.fromEntries(gates.map((g) => [g.id, g]));
}

const base = (over = {}) => ({
  artifacts: { lite: page('lite', over.lite || {}), ...(over.full ? { full: page('full', over.full) } : {}) },
  shellText: SHELL,
});

test('the synthetic baseline passes both gates — otherwise the failures below prove nothing', () => {
  const g = run(base());
  assert.equal(g.D10.pass, true, g.D10.detail);
  assert.equal(g.D11.pass, true, g.D11.detail);
});

// ---------------------------------------------------------------------------
// D10 — the lite negative manifest, one violating page per row.
// ---------------------------------------------------------------------------

for (const [label, body] of [
  ['the @inject:eq region', '/* @inject:eq */ /* @end:eq */'],
  ['the EQUILIBRIUM payload binding', 'const EQUILIBRIUM = {a:1};'],
  ['the evEstimate runtime', 'function evEstimate(x){return x}'],
  ['the .solverpane CSS', '.solverpane { display: block }'],
]) {
  test(`D10 FAILS when the lite artifact carries ${label}`, () => {
    const g = run(base({ lite: { body } }));
    assert.equal(g.D10.pass, false);
    assert.match(g.D10.detail, /FORBIDDEN in lite/);
  });
}

test('D10 FAILS on a surviving @only: marker — the seam leaking into the artifact', () => {
  const g = run(base({ lite: { body: '<!-- @only:full --> x <!-- @end:only -->' } }));
  assert.equal(g.D10.pass, false);
  assert.match(g.D10.detail, /@only: marker/);
});

test('D10 FAILS when the lite artifact drops model.order — §5.2 keeps it unconditional', () => {
  const g = run({ artifacts: { lite: '<!-- VARIANT lite — x. -->\n<html>nothing</html>' }, shellText: SHELL });
  assert.equal(g.D10.pass, false);
  assert.match(g.D10.detail, /MISSING from lite: model\.order/);
});

test('D10 FAILS when there is no lite artifact at all — absence is not a skip', () => {
  const g = run({ artifacts: { lite: null }, shellText: SHELL });
  assert.equal(g.D10.pass, false);
  assert.match(g.D10.detail, /non-negotiable artifact/);
});

test('the baseline-tier block is lite-LEGAL, and the clause arms itself when it lands', () => {
  // Today: absent from the model, so absent from the page, and that agrees.
  assert.equal(model.baselineTiers, undefined);
  assert.equal(run(base()).D10.pass, true);
  // The day P3 emits it, a lite page WITHOUT it fails — the row is a requirement, not a permission
  // that also happens to be satisfied by omission.
  const withBlock = { ...model, baselineTiers: { q: [1, 2, 3] } };
  const gates = [];
  const built = variants.build({
    model: withBlock, opts: base(), G: (id, pass, detail) => gates.push({ id, pass, detail }),
  });
  for (const s of built.sections) s.run();
  const d10 = gates.find((g) => g.id === 'D10');
  assert.equal(d10.pass, false);
  assert.match(d10.detail, /MISSING from lite: baselineTiers/);
  // …and a page that carries it passes, which is what "lite-legal" means.
  const gates2 = [];
  const built2 = variants.build({
    model: withBlock,
    opts: base({ lite: { body: 'const M={baselineTiers:[1]}' } }),
    G: (id, pass, detail) => gates2.push({ id, pass, detail }),
  });
  for (const s of built2.sections) s.run();
  assert.equal(gates2.find((g) => g.id === 'D10').pass, true);
});

// ---------------------------------------------------------------------------
// D11 — provenance, the honesty sentence, source-hash currency.
// ---------------------------------------------------------------------------

test("D11 FAILS on the named failure mode: one artifact carrying the other's claim sentence", () => {
  const g = run(base({ lite: { body: `<p>${VARIANTS.full.claim}</p>` } }));
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /carries the full claim sentence as well as its own/);
});

test('D11 FAILS when the banner stamps the wrong variant for the file it is in', () => {
  const g = run(base({ lite: { stamp: 'full' } }));
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /stamped VARIANT full/);
});

test('D11 FAILS on a claim sentence that has drifted from the manifest', () => {
  const g = run(base({ lite: { claim: 'a self-contained offline page, probably' } }));
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /but the manifest's lite claim is/);
});

test('D11 FAILS on two banner lines — a banner appended to an artifact that had one', () => {
  const doubled = page('lite');
  const g = run({
    artifacts: { lite: `${doubled}\n     VARIANT lite — ${VARIANTS.lite.claim}.\n` },
    shellText: SHELL,
  });
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /carries 2 VARIANT banner lines/);
});

test('D11 FAILS when the artifact was built from a different shell than the one on disk', () => {
  const g = run(base({ lite: { srcHash: '0123456789abcdef' } }));
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /was built from src\/shell\.html 0123456789abcdef/);
});

test('D11 FAILS on an artifact with no source hash in its banner', () => {
  const g = run(base({ lite: { banner: `<!-- GENERATED FILE\n     VARIANT lite — ${VARIANTS.lite.claim}.\n-->` } }));
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /carries no source hash/);
});

test('D11 checks BOTH artifacts when both exist, and names the absent one when one does not', () => {
  const both = run(base({ full: {} }));
  assert.equal(both.D11.pass, true, both.D11.detail);
  assert.match(both.D11.detail, /2\/2 artifacts present/);
  const one = run(base());
  assert.match(one.D11.detail, /not built: full/);
  // and a defect in the SECOND artifact is still caught
  const bad = run(base({ full: { claim: VARIANTS.lite.claim } }));
  assert.equal(bad.D11.pass, false);
});

// ---------------------------------------------------------------------------
// D6's restatement — the baseline-tier sub-budget, and the RESERVATION that makes the
// 120 -> 132 KB raise cost nothing to anyone but the block it was raised for.
//
// This is the test that matters for the raise. §5.3 says the sub-budget is "named and paid for at
// the gate", and it would be very easy to read that as "add 12 to the total and move on" — which
// hands 12 KB of headroom to `cells`, to `meta`, to `order`, and to every future block, before the
// baseline block exists at all. The gate instead keeps the original 120 KB ceiling alive as a
// `core` clause over the payload MINUS the baseline block. These tests are the proof that the two
// readings differ and that the strict one is the one implemented.
// ---------------------------------------------------------------------------

/** Run the data family's D6 section over `m` and return the gate. */
function d6(m) {
  const gates = [];
  const built = dataGates.build({ model: m, G: (id, pass, detail) => gates.push({ id, pass, detail }) });
  for (const s of built.sections) if (s.ids.includes('D6')) s.run();
  return gates.find((g) => g.id === 'D6');
}

/** Pad `meta` so the payload's CORE (everything but the baseline block) grows by ~`kb` KB. */
const padCore = (m, kb) => ({ ...m, meta: { ...m.meta, _pad: 'x'.repeat(kb * 1024) } });
const withBaseline = (m, kb) => ({ ...m, baselineTiers: { q: 'y'.repeat(kb * 1024) } });

test('D6 passes today, and its detail names the baseline sub-budget and the core clause', () => {
  const g = d6(model);
  assert.equal(g.pass, true, g.detail);
  assert.match(g.detail, /baseline tiers 0\.0K\/12K/);
  assert.match(g.detail, /of which core .*\/120K/);
  assert.match(g.detail, /BINDING ON THE LITE ARTIFACT/);
});

test('THE RESERVATION BITES: core over 120K FAILS even though the 132K total is not reached', () => {
  // 113.9K core + 10K padding = ~124K: under the new 132K total, over the reserved-out 120K core.
  // Under the naive reading of "raise the total to 132" this would pass. It must not.
  const bloated = padCore(model, 10);
  const g = d6(bloated);
  assert.equal(g.pass, false, `expected FAIL, got: ${g.detail}`);
  assert.match(g.detail, /total 12[0-9.]+K\/132K/);
});

test('the 12K is spendable by the baseline block and by nothing else', () => {
  // Exactly the case §5.3 raised the ceiling for: a real baseline block inside its 12K, on top of
  // an unchanged core. Total goes past the old 120K ceiling, and that is allowed.
  const g = d6(withBaseline(model, 10));
  assert.equal(g.pass, true, g.detail);
  assert.match(g.detail, /baseline tiers 10\.0K\/12K/);
});

test('a baseline block over its own 12K FAILS, and does not borrow from the core', () => {
  const g = d6(withBaseline(model, 14));
  assert.equal(g.pass, false, `expected FAIL, got: ${g.detail}`);
  assert.match(g.detail, /baseline tiers 14\.0K\/12K/);
});
