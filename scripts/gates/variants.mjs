// gates D10 D11 — the dual build, asserted against the artifacts on disk.
//
// V3-PLAN §5.3 / §9, and the first gates in this runner that read a BUILT PAGE rather than
// data/model.json. That is worth stating plainly, because docs/spikes/S-D.md §G audited all 44
// gates and found the opposite: every artifact-facing check lived in build.mjs, and nothing in
// verify.mjs had ever opened index.html. §9 changes that on purpose — "verify.mjs gains a variant
// manifest the D-gates read" — and the manifest is `scripts/lib/variant.mjs`, the same table the
// build uses, so a variant cannot be described one way to the builder and another to the gate.
//
// THE DIVISION OF LABOUR, since three mechanisms now guard the same seam and it should be obvious
// which one catches what:
//
//   build.mjs, on the RAW source     the fetch( and <script src=> refusals, absolute for both
//                                    artifacts including the one this build is not producing;
//                                    the @only: syntax rules; the dangling-call refusal (a lite
//                                    page calling a symbol only the full block declares).
//   build.mjs --check, per variant   the byte comparison: is the artifact on disk exactly what a
//                                    fresh build of today's inputs produces.
//   D10 / D11, here                  what is IN the artifact, and what the artifact CLAIMS —
//                                    read off the shipped file, with no build in the loop. This
//                                    is the half that still holds when someone hand-edits the
//                                    page, or ships a file built by a different revision.
//
// WHY THESE GATES DO NOT SHELL OUT TO A BUILD. Tempting — D11's claim is literally "both variants
// byte-compare under --check" — but `verifyModel` also runs inside `generate-data.mjs`, against a
// model held in memory while the one on disk is still the previous run's. A gate that rebuilt the
// page there would compare the artifact against the OLD dataset and fail for a reason that has
// nothing to do with the model. So the byte comparison stays where it can be honest, in the
// per-variant `--check` loop that the house GREEN rule already requires, and what is asserted here
// is the half that is true regardless of which process is running: the artifact was built from the
// shell that is on disk now, it names its own variant, and it makes its own claim and no other's.
//
// Neither gate is skippable-by-absence. The lite artifact is the non-negotiable one (locked 4.2),
// so a missing index.html FAILS both gates rather than reducing them to a no-op.

import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';

import { VARIANTS, VARIANT_NAMES } from '../lib/variant.mjs';
import { ROOT } from './_shared.mjs';

export const family = 'variants';
export const title = 'the dual build — the lite negative manifest (D10) and per-variant provenance (D11)';
export const ids = ['D10', 'D11'];

const rel = (p) => relative(ROOT, p);

/**
 * THE LITE NEGATIVE MANIFEST, as data.
 *
 * Every row is a thing the lite artifact must NOT contain, with the reason it must not, because a
 * negative gate whose rows have no stated reason is a gate nobody dares delete a row from later.
 * The patterns are the ones docs/spikes/S-D.md §D verified on the prototype's two artifacts — the
 * spike's negative manifest IS this list, which is what §5.3's annotation means by "D10 can be
 * written directly against the spike's assertions".
 *
 * `pattern` is matched against the artifact text. Each is anchored on something that cannot occur
 * incidentally: an inject marker, a top-level identifier binding, a CSS class selector.
 */
const LITE_FORBIDDEN = [
  {
    label: '@inject:eq region',
    pattern: /@(?:inject|end):eq\b/,
    why: 'the equilibrium region is full-only (§5.3); a lite page carrying its marker either '
      + 'shipped the payload or shipped an empty region pretending to be one',
  },
  {
    label: 'EQUILIBRIUM payload binding',
    pattern: /(?:^|[^\w$.])(?:const|let|var)\s+EQUILIBRIUM\b/,
    why: 'the solved baseline, the 7,626-pair matrix and the calibration detail ship in the '
      + 'full-only artifact and nowhere else',
  },
  {
    label: 'evEstimate estimator runtime',
    pattern: /(?:^|[^\w$.])(?:function\s+evEstimate\b|(?:const|let|var)\s+evEstimate\b)/,
    why: 'lite = full minus the solver/equilibrium payload, the EV-estimator runtime, and '
      + 'anything requiring the opened toolchain (§5.2)',
  },
  {
    label: '.solverpane CSS',
    pattern: /\.solverpane\b/,
    why: 'the solver detail pane is full-only; lite renders the mode disabled with a named REASON '
      + 'in the SIM.available idiom, which is markup, not the pane itself',
  },
];

/**
 * THE POSITIVE HALF, and it is not decoration.
 *
 * A negative manifest alone is satisfiable by shipping an empty file. These are the things §5.2
 * and §5.3 say lite MUST keep, so the gate fails in both directions.
 *
 * `baselineTiers` is the interesting row. §5.3 buys lite a tier-level vs-GTO colour mode by adding
 * ONE shared-core block — per (pos, node, cell) quantized baseline tiers, ≤ 12 KB, paid for as a
 * named D6 sub-budget. It is therefore EXPLICITLY LITE-LEGAL, and the way to say that in a gate is
 * not a comment: it is a conditional assertion that arms itself. The block does not exist yet (it
 * is P3 generator work), so today the row reads "absent from the model, so absent from the page,
 * and that agrees". The day the generator emits it, this row starts REQUIRING it in lite — which
 * is the opposite of a forbidden row, in the same list, so nobody can later mistake it for one.
 */
function positiveClauses(model, page) {
  const out = [];
  /* §5.2 keeps `model.order` unconditional across variants — it is what makes Simulate honest at
     an off-lattice v, and lite is the variant that needs it MOST under villain default-on. Grepped
     by a slice of the packed string itself rather than by the word "order": the assertion is that
     the shipped page carries THIS ordering, not that it carries something order-shaped. */
  const packed = model.order && model.order.packed;
  out.push({
    label: 'model.order',
    ok: !!packed && page.includes(packed.slice(0, 64)),
    detail: packed
      ? `${model.order.n} classes, ${model.order.bits}-bit packed, shipped verbatim `
        + `(${packed.slice(0, 12)}…) — §5.2 keeps it unconditional`
      : 'NO ORDER BLOCK IN THE MODEL — §5.2 requires one in every variant',
  });
  const bt = model.baselineTiers;
  out.push({
    label: 'baselineTiers (lite-LEGAL)',
    ok: bt === undefined || page.includes('baselineTiers'),
    detail: bt === undefined
      ? 'not in the model yet (P3) — the row is armed and will require it in lite when it lands'
      : 'present in the model and present in the lite page, as §5.3 requires',
  });
  return out;
}

/**
 * The artifacts that exist on disk right now, keyed by variant.
 *
 * `opts.artifacts` overrides the disk read — the same seam I22/I32 use for `opts.tierFixture`, and
 * for the same reason: a gate whose only input is a 481 KB file the build just wrote cannot be
 * shown to FAIL, and a gate nobody has watched fail is a gate nobody knows the shape of. The
 * override takes `{ lite: '<page text>', full: '<page text>' }`; test/gates-variants.test.mjs
 * drives every failure branch below through it.
 */
function artifacts(opts = {}) {
  if (opts.artifacts) {
    const found = {};
    for (const v of Object.keys(opts.artifacts)) {
      if (opts.artifacts[v] == null) continue;
      found[v] = { path: resolve(ROOT, VARIANTS[v] ? VARIANTS[v].out : v), text: opts.artifacts[v] };
    }
    return found;
  }
  const found = {};
  for (const v of VARIANT_NAMES) {
    const p = resolve(ROOT, VARIANTS[v].out);
    if (existsSync(p)) found[v] = { path: p, text: readFileSync(p, 'utf8') };
  }
  return found;
}

export function build(ctx) {
  const { model, opts = {}, G } = ctx;
  const files = artifacts(opts);
  const shellPath = resolve(ROOT, 'src/shell.html');

  return {
    sections: [
    // =========================================================================
    // D10 — the lite negative manifest (§5.3)
    // =========================================================================
    { ids: ['D10'], label: 'the lite negative manifest', run: () => {
    const lite = files.lite;
    if (!lite) {
      G('D10', false, `there is no ${VARIANTS.lite.out} — lite is the non-negotiable artifact `
        + '(locked 4.2), so its absence is a failure, not a skip. Run scripts/build.mjs.');
      return;
    }
    const hits = LITE_FORBIDDEN.filter((r) => r.pattern.test(lite.text));
    const pos = positiveClauses(model, lite.text);
    const posBad = pos.filter((p) => !p.ok);
    /* The marker check belongs here rather than beside the forbidden rows because it is about the
       SEAM, not the payload: a surviving @only: is either a marker the stripper failed to consume
       or a string literal that spelled one, and in both cases the page is not the page the
       manifest describes. build.mjs refuses it too — deliberately twice, because this one also
       covers an artifact that was not produced by today's build.mjs. */
    const marker = /@only:|@end:only/.test(lite.text);
    const ok = hits.length === 0 && posBad.length === 0 && !marker;
    G('D10', ok, ok
      ? `${rel(lite.path)}: ${LITE_FORBIDDEN.length} forbidden patterns absent `
        + `(${LITE_FORBIDDEN.map((r) => r.label).join(', ')}), no @only: marker survived, `
        + pos.map((p) => `${p.label} ${p.detail}`).join('; ')
        + '. The dangling-call half — lite code calling a full-only symbol — is refused in '
        + 'build.mjs at the seam and re-checked by the per-variant smoke run (S-D §F).'
      : [
        ...hits.map((r) => `FORBIDDEN in lite: ${r.label} — ${r.why}`),
        ...posBad.map((p) => `MISSING from lite: ${p.label} — ${p.detail}`),
        ...(marker ? [`${rel(lite.path)} still carries an @only: marker — the seam leaked`] : []),
      ].join(' · '));
    } },

    // =========================================================================
    // D11 — dual determinism, per-variant provenance, the grep-gated honesty sentence
    // =========================================================================
    { ids: ['D11'], label: 'per-variant provenance and honesty', run: () => {
    const names = Object.keys(files);
    if (!names.includes('lite')) {
      G('D11', false, `there is no ${VARIANTS.lite.out} to check the provenance of`);
      return;
    }
    const shellText = opts.shellText != null ? opts.shellText
      : (existsSync(shellPath) ? readFileSync(shellPath, 'utf8') : null);
    const shellHash = shellText === null ? null
      : createHash('sha256').update(shellText).digest('hex').slice(0, 16);
    const problems = [];
    const notes = [];

    for (const v of names) {
      const { path, text } = files[v];
      const spec = VARIANTS[v];

      /* (a) PROVENANCE. Exactly one VARIANT line, naming a known variant, and naming THIS one.
         Two lines would mean a banner appended to an artifact that already had one. */
      const stamps = [...text.matchAll(/^\s*VARIANT (\S+) — (.+?)\.$/gm)];
      if (stamps.length !== 1) {
        problems.push(`${rel(path)} carries ${stamps.length} VARIANT banner lines, expected exactly 1`);
        continue;
      }
      const [, stamped, claim] = stamps[0];
      if (stamped !== v) {
        problems.push(`${rel(path)} is stamped VARIANT ${stamped} but ${rel(path)} is `
          + `${v}'s artifact per the manifest — one of the two is wrong`);
        continue;
      }

      /* (b) THE HONESTY SENTENCE, grep-gated. Its own, and none of the others'. The "and none of
         the others'" half is D11's named failure mode — "one artifact carrying the other's claim
         sentence" — and it is the half that keeps a copy-paste between the two shells honest.
         Searched over the WHOLE artifact, not just the banner, so the on-screen sentence §5.3
         also requires is covered by the same clause the day it lands in the shell: this arms
         itself rather than needing a gate edit. */
      if (claim !== spec.claim) {
        problems.push(`${rel(path)}'s banner claims "${claim}" but the manifest's ${v} claim is `
          + `"${spec.claim}"`);
      }
      if (!text.includes(spec.claim)) {
        problems.push(`${rel(path)} does not carry the ${v} claim sentence`);
      }
      /* (f) THE ON-SCREEN COPY (P5, §5.2/§5.3 and METHODOLOGY §0). Clause (b) is satisfied by the
         banner alone, and a claim only a `head -6` reader ever sees is not a claim the page makes:
         §5.3 asks for the sentence ON SCREEN, and this is the clause the comment above (b) promised
         would arm itself the day it landed in the shell. It did, at P5 — Method -> What this is
         renders `ARTIFACT.claim`, which the variant seam supplies because model.json is shared and
         cannot carry a per-variant string. Asserted as an occurrence AFTER the banner ends, which
         is the cheapest statement that a second copy exists somewhere the reader can reach. */
      const bEnd = text.indexOf('-->');
      if (bEnd >= 0 && !text.slice(bEnd).includes(spec.claim)) {
        problems.push(`${rel(path)} carries the ${v} claim ONLY in its provenance banner — `
          + 'the page has to make the claim on screen too (Method -> What this is)');
      }
      for (const other of VARIANT_NAMES) {
        if (other === v) continue;
        if (text.includes(VARIANTS[other].claim)) {
          problems.push(`${rel(path)} carries the ${other} claim sentence as well as its own — `
            + 'each artifact makes exactly one claim, and it is its own');
        }
      }

      /* (c) DETERMINISM, the half that does not need a build: the artifact stamps the sha256 of
         the shell it was compiled from, and that must be the shell on disk. Combined with the
         build's determinism — pinned by test/variant.test.mjs building the same source twice and
         comparing bytes — "the artifact matches its source hash" and "the artifact byte-compares
         under --check" are the same statement. The difference is that this one is true inside
         generate-data.mjs too, where a rebuild would be comparing against last run's model. */
      const src = /sha256 ([0-9a-f]{16})/.exec(text);
      if (!src) problems.push(`${rel(path)} carries no source hash in its banner`);
      else if (shellHash && src[1] !== shellHash) {
        problems.push(`${rel(path)} was built from src/shell.html ${src[1]}…, but the shell on `
          + `disk is ${shellHash}… — rebuild it (scripts/build.mjs --variant=${v})`);
      }
      notes.push(`${v} ${rel(path)}`);
    }

    /* (e) THE DOCUMENT SIDE, byte-compared (P5). The three copies of each sentence — manifest,
       banner, screen — are held together by (b) and (f); this is the fourth, and it is the one that
       rots silently, because a document does not fail to build. METHODOLOGY §0 quotes both claims
       and says which artifact carries which, so the grep-gate idiom `gates/couplings.mjs` uses for
       limitations 16/17 applies here unchanged: the shipped string must appear VERBATIM inside the
       section that claims to quote it, whitespace-normalised and nothing else normalised.
       SCOPED TO §0's OWN SLICE, for the reason the P1 red team established on the limitations
       register — a sentence found somewhere else in a 3,500-line document is not a sentence §0
       carries. Blockquote markers are stripped before flattening so the quotes can stay hard-
       wrapped like the rest of the file. Each artifact's FILENAME must be inside the same slice
       too: two sentences a reader cannot attribute to a file are not a per-variant claim. */
    /* `opts.methodologyText` is this clause's injection seam, in the idiom `opts.artifacts` and
       `opts.shellText` already use above: a clause whose only input is a 3,500-line file on disk
       cannot be shown to FAIL, and a gate nobody has watched fail is a gate nobody knows the shape
       of. test/gates-variants.test.mjs drives every branch below through it. */
    let docText = opts.methodologyText != null ? opts.methodologyText : null;
    if (docText === null) {
      try { docText = readFileSync(resolve(ROOT, 'docs/METHODOLOGY.md'), 'utf8'); } catch (err) {
        problems.push('docs/METHODOLOGY.md is unreadable, so the per-variant claims cannot be '
          + `checked against the document that quotes them: ${err.message}`);
      }
    }
    if (docText !== null) {
      const h = /^## 0\. /m.exec(docText);
      if (!h) problems.push('docs/METHODOLOGY.md has no §0 honesty statement to carry the claims');
      else {
        const after = docText.slice(h.index + h[0].length);
        const nx = /^## /m.exec(after);
        const sec0 = nx ? after.slice(0, nx.index) : after;
        const flat = (t) => t.replace(/^[ \t]*>[ \t]?/gm, ' ').replace(/\s+/g, ' ');
        const flatSec = flat(sec0);
        for (const v of VARIANT_NAMES) {
          if (flatSec.indexOf(flat(VARIANTS[v].claim)) < 0) {
            problems.push(`METHODOLOGY §0 does not quote the ${v} claim verbatim — the manifest and `
              + 'the document have drifted; fix BOTH, never one');
          }
          if (flatSec.indexOf(VARIANTS[v].out) < 0) {
            problems.push(`METHODOLOGY §0 quotes claims but never names ${VARIANTS[v].out}, so a `
              + 'reader cannot tell which artifact makes which');
          }
        }
      }
    }

    /* (d) The variants that did NOT ship an artifact are named, so "1 of 2 checked" can never be
       mistaken for "2 of 2 checked". */
    const absent = VARIANT_NAMES.filter((v) => !names.includes(v));
    const ok = problems.length === 0;
    G('D11', ok, ok
      ? `${names.length}/${VARIANT_NAMES.length} artifacts present [${notes.join(', ')}]`
        + (absent.length ? ` · not built: ${absent.join(', ')}` : '')
        + ` · each stamps its own variant, carries its own honesty sentence and no other's — in `
        + 'its banner AND on screen (f) — and '
        + `matches src/shell.html ${shellHash}… . METHODOLOGY §0 quotes both sentences verbatim and `
        + 'names both artifacts (e), so the manifest, the two banners, the two pages and the '
        + 'document are one string apiece with gates between them. The byte comparison itself is '
        + 'the per-variant `node scripts/build.mjs --check` loop, which is part of the GREEN '
        + 'definition.'
      : problems.join(' · '));
    } },
    ],
  };
}
