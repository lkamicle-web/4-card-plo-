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
  /* `baselineTiers` is in the shipped model since P3, and D10's positive half requires the lite
     page to carry it (§5.3: the block is what buys lite a tier-level vs-GTO mode). So the minimal
     passing artifact carries it too — `over.body` still isolates whatever defect a test is about,
     and the lite-LEGAL test below drives the page that OMITS it. */
  const core = over.omitBaseline ? '' : 'const M={baselineTiers:1};';
  /* THE ON-SCREEN COPY (D11 clause (f), P5). The banner alone no longer satisfies D11: the page has
     to make its claim where a reader of the PAGE sees it, so the minimal passing artifact carries
     the sentence a second time in its body. `over.onlyBanner` drops it, which is that clause's own
     failure branch. */
  const screen = over.onlyBanner ? '' : `<p>This artifact is ${claim}.</p>`;
  return `${banner}\n<html>${model.order.packed}\n${core}${screen}${over.body || ''}</html>`;
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

test('the baseline-tier block is lite-LEGAL, and the clause has ARMED ITSELF — the block landed', () => {
  /* THE ROW FLIPPED SIDES AT P3, exactly as it was written to. It used to read "absent from the
     model, so absent from the page, and that agrees", with the note that the day P3 emitted the
     block the row would start REQUIRING it in lite. P3 emitted it (scripts/generate-equilibrium.mjs
     writes model.baselineTiers), so what is pinned here is the requirement rather than the
     agreement — and the failure direction is the one that matters: a lite page that DROPPED the
     block fails, which is the opposite of a forbidden row and is what "lite-legal" means. */
  assert.ok(model.baselineTiers, 'P3 ships the block; §5.3 is what buys lite its vs-GTO mode');
  assert.equal(run(base()).D10.pass, true);
  const g = run(base({ lite: { omitBaseline: true } }));
  assert.equal(g.D10.pass, false);
  assert.match(g.D10.detail, /MISSING from lite: baselineTiers/);
  /* ...and the row is still conditional on the model, not hard-coded: a model without the block
     agrees with a page without it, which is what kept this gate honest for two phases. */
  const noBlock = { ...model };
  delete noBlock.baselineTiers;
  const gates = [];
  const built = variants.build({
    model: noBlock,
    opts: base({ lite: { omitBaseline: true } }),
    G: (id, pass, detail) => gates.push({ id, pass, detail }),
  });
  for (const s of built.sections) s.run();
  assert.equal(gates.find((x) => x.id === 'D10').pass, true);
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

// --- clause (f), the on-screen copy, and clause (e), the document coupling (P5) ------------

test('D11 FAILS when the claim lives only in the banner and never on the page', () => {
  /* The clause exists because (b) is satisfied by the banner alone, and the banner is a comment
     nobody reading the PAGE sees. This is the artifact §5.3 would otherwise accept. */
  const g = run(base({ lite: { onlyBanner: true } }));
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /ONLY in its provenance banner/);
});

test('D11 FAILS when METHODOLOGY §0 no longer quotes a claim verbatim', () => {
  const doc = `## 0. Honesty statement\n\nindex.html and index-full.html.\n\n> ${VARIANTS.lite.claim}\n\n> ${VARIANTS.full.claim}\n\n## 1. Next\n`;
  assert.equal(run({ ...base({ full: {} }), methodologyText: doc }).D11.pass, true);
  // one word changed in the document copy — the drift this clause exists to catch
  const drifted = doc.replace('quantized tiers', 'quantised tiers');
  const g = run({ ...base({ full: {} }), methodologyText: drifted });
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /METHODOLOGY §0 does not quote the lite claim verbatim/);
});

test('D11 FAILS when §0 quotes the sentences but names neither artifact', () => {
  const doc = `## 0. Honesty statement\n\n> ${VARIANTS.lite.claim}\n\n> ${VARIANTS.full.claim}\n\n## 1. Next\n`;
  const g = run({ ...base({ full: {} }), methodologyText: doc });
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /never names index\.html/);
});

test('D11 FAILS when the quote sits OUTSIDE §0 — the couplings.mjs scoping lesson', () => {
  /* The P1 red team's finding on the limitations register, transposed: a sentence found somewhere
     in a 3,500-line document is not a sentence the section carries. */
  const doc = `## 0. Honesty statement\n\nindex.html and index-full.html.\n\n> ${VARIANTS.full.claim}\n\n`
    + `## 9. Elsewhere\n\n> ${VARIANTS.lite.claim}\n`;
  const g = run({ ...base({ full: {} }), methodologyText: doc });
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /does not quote the lite claim verbatim/);
});

test('D11 FAILS when there is no §0 at all to carry the claims', () => {
  const g = run({ ...base({ full: {} }), methodologyText: '# METHODOLOGY\n\n## 1. Cards\n' });
  assert.equal(g.D11.pass, false);
  assert.match(g.D11.detail, /no §0 honesty statement/);
});

test('the two claim sentences are not substrings of one another', () => {
  /* If they were, "carries its own and none of the other's" would be unsatisfiable and the gate
     would be asserting something no pair of artifacts could ever pass. */
  assert.ok(!VARIANTS.lite.claim.includes(VARIANTS.full.claim));
  assert.ok(!VARIANTS.full.claim.includes(VARIANTS.lite.claim));
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

test('D6 passes today, and its detail names both sub-budgets and both core clauses', () => {
  const g = d6(model);
  assert.equal(g.pass, true, g.detail);
  /* P3 FILLED BOTH RESERVATIONS, so the pins move from "0.0K" to a real reading. The baseline block
     was reserved at P1 and claimed here; the solver-constants block is P3's own raise, made in the
     same idiom. What is pinned is that BOTH core re-assertions are printed — the 120K payload core
     and the 13K meta core — because those are the numbers that prove no existing block gained a
     byte, and a detail line that stopped printing them would hide exactly that. */
  assert.match(g.detail, /baseline tiers \d+\.\dK\/12K/);
  assert.match(g.detail, /solver constants \d+\.\dK\/3K/);
  assert.match(g.detail, /of which core .*\/120K/);
  assert.match(g.detail, /of which core .*\/13K/);
  assert.match(g.detail, /BINDING ON THE LITE ARTIFACT/);
});

test('THE RESERVATION BITES: core over 120K FAILS even though the 135K total is not reached', () => {
  // 115.9K core + 10K padding = ~126K: under the 135K total, over the reserved-out 120K core.
  // Under the naive reading of "raise the total" this would pass. It must not — and it must not for
  // the solver block's raise either, which is why the assertion is on the CORE reading.
  const bloated = padCore(model, 10);
  const g = d6(bloated);
  assert.equal(g.pass, false, `expected FAIL, got: ${g.detail}`);
  assert.match(g.detail, /of which core 12[0-9.]+K\/120K/);
});

test('THE SECOND RESERVATION BITES: the meta bucket minus the solver block still faces 13K', () => {
  /* P3's own raise, tested the same way P1's was. `meta` went 13K -> 16K to make room for
     `constants.solver`, and the raise is RESERVED: `metaCore` (the bucket minus that block) still
     faces the original 13K, so no other member of the meta bucket gained a byte. Padding `rows`
     lands inside the bucket and outside the solver block, which is exactly the case that must
     still fail. */
  const bloated = { ...model, rows: [...model.rows, { key: 'PAD', pad: 'z'.repeat(1024) }] };
  const g = d6(bloated);
  assert.equal(g.pass, false, `expected FAIL, got: ${g.detail}`);
  assert.match(g.detail, /of which core 1[3-9.]+K\/13K/);
});

test('a solver-constants block over its own 3K FAILS, and does not borrow from the meta core', () => {
  const fat = { ...model, constants: { ...model.constants, solver: { ...model.constants.solver, pad: 'z'.repeat(4 * 1024) } } };
  const g = d6(fat);
  assert.equal(g.pass, false, `expected FAIL, got: ${g.detail}`);
  assert.match(g.detail, /solver constants \d+\.\dK\/3K/);
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
