/**
 * test/manifest.test.mjs — the dependency rule, enforced instead of described.
 *
 * V3-PLAN §9 item 18 / docs/spikes/S-E.md. The spike's verdict was "buy Playwright,
 * decline everything else", and it rests on two properties of package.json that are
 * invisible in a diff and catastrophic to lose:
 *
 *   1. THERE IS NO "type" FIELD. Adding one flips `.js` resolution for the whole
 *      repository. scripts/lib/sim-kernel.js and sim-worker.js are classic scripts
 *      by design — read as text and evaluated inside a Blob worker, never imported
 *      by Node — and the absence of the field is what reproduces the pre-manifest
 *      semantics exactly. Nothing fails loudly when this changes; things fail in a
 *      browser worker, at runtime, on someone else's machine.
 *
 *   2. PLAYWRIGHT IS THE ONLY DEPENDENCY, AND IT IS DEV-TIME. S-E measured three
 *      declines, one of them disqualifying by itself: `esbuild --format=cjs`
 *      rewrites `import.meta`, which makes verify.mjs's CLI detection silently not
 *      fire — the verifier exits 0 having run zero gates. A rule whose violation
 *      turns the gate runner into a no-op is not a rule to keep in prose.
 *
 * These are asserted here rather than as a verify.mjs gate on purpose: §7.2 names
 * gate ids, and none is named for the manifest. Inventing one would be worse than
 * this file, which runs inside `node --test` — one of the three checks GREEN is
 * defined as — and needs no id at all.
 *
 * The `runtime-dependency-free` claim itself is NOT re-derived here: it is a
 * property of the built artifacts, and build.mjs's absolute fetch( / <script src=>
 * refusals are what enforce it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

test('package.json has NO "type" field — .js stays classic, as sim-kernel.js is written', () => {
  assert.equal(Object.prototype.hasOwnProperty.call(PKG, 'type'), false,
    'a "type" field flips .js resolution repo-wide; scripts/lib/sim-kernel.js and sim-worker.js '
    + 'are classic scripts read as TEXT and evaluated in a Blob worker. See docs/spikes/S-E.md §1.');
  /* The reason is kept in the manifest itself, where the next person to reach for
     the field will actually be standing. */
  assert.ok(String(PKG['//type'] || '').includes('sim-kernel.js'),
    'the "//type" note explaining the omission has gone missing — restore it, or the omission '
    + 'reads as an oversight and gets "fixed"');
});

test('Playwright is the SOLE dependency, and it is dev-time', () => {
  assert.deepEqual(Object.keys(PKG.devDependencies || {}), ['playwright'],
    'every further adoption needs a named consumer and a memo; the default answer is no (S-E §6)');
  assert.equal(PKG.dependencies, undefined, 'a runtime dependency would break the zero-dep claim');
  assert.equal(PKG.peerDependencies, undefined);
  assert.equal(PKG.optionalDependencies, undefined);
  /* Pinned exactly. A range would let the harness's browser build drift under a gate
     whose whole output is a cross-engine version table. */
  assert.match(PKG.devDependencies.playwright, /^\d+\.\d+\.\d+$/,
    'pin Playwright exactly: SF/SS report the engine version as part of the measurement');
});

test('the dependency has its named consumers, and they exist', () => {
  assert.ok(String(PKG['//deps'] || '').includes('smoke.mjs'),
    'S-E\'s rule is that a dependency names its consumer; the note must say who uses Playwright');
  for (const f of ['smoke.mjs', 'browsers.mjs']) {
    assert.ok(existsSync(join(ROOT, f)), `${f} is a named Playwright consumer and must exist`);
  }
});

test('the three checks GREEN is defined as are runnable by name, and `green` is all three', () => {
  const s = PKG.scripts || {};
  assert.equal(s.verify, 'node scripts/verify.mjs');
  assert.equal(s.test, 'node --test test/*.test.mjs');
  assert.equal(s.check, 'node scripts/build.mjs --check');
  for (const part of [s.verify, s.test, s.check]) {
    assert.ok(s.green.includes(part), `npm run green must run \`${part}\``);
  }
  /* Deliberately NOT part of green: both need browsers downloaded, so they are
     named separately rather than made a silent prerequisite of the three checks
     every contributor runs. */
  for (const part of ['smoke', 'browsers']) {
    assert.ok(!s.green.includes(part), `\`green\` must not require ${part}: it needs downloaded browsers`);
    assert.ok(typeof s[part] === 'string' && s[part].length > 0, `npm run ${part} must exist`);
  }
});
