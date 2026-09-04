// variant.mjs — the dual-build seam: variant specs and the `@only:` markup markers.
//
// S-D PROTOTYPE (docs/V3-PLAN.md §1, §5.2, §5.3, §9). Landed on the spike branch so P1 lane I has
// working machinery to merge rather than a description of one.
//
// WHY A SEPARATE MODULE. build.mjs is a script; this is the part of the dual build that has to be
// held to rules by a test (test/variant.test.mjs), exactly as shell-compile.mjs was lifted out for
// the same reason. The stripper below decides which markup, CSS and JavaScript reaches which
// artifact; every rule in it deserves a test that fails when it changes.
//
// THE TWO SEAMS, and the difference between them:
//
//   1. `@inject:<region>`  — already existed. A region the build FILLS with generated code. Under
//      the dual build a region is owned by a set of variants: `eq` is full-only, and a lite build
//      that finds an `@inject:eq` marker in its (already stripped) source FAILS rather than
//      quietly emitting an empty region. That refusal is the build-time half of gate D10.
//
//   2. `@only:<variant>` … `@end:only`  — new. A block of SOURCE that survives only in the named
//      variant. Written in whichever comment syntax the surrounding language has:
//
//          <!-- @only:full -->   …markup…      <!-- @end:only -->
//          /* @only:lite */      …CSS or JS…   /* @end:only */
//
// FOUR PROPERTIES THIS FILE IS RESPONSIBLE FOR:
//
//   INERTNESS. A source containing no `@only:` marker at all compiles to the same bytes under
//   every variant. That is the v3 identity constraint (§0.4a) applied to the build itself: the
//   variant axis must be inert at legacy settings, so `--variant=lite` over today's src/shell.html
//   reproduces today's index.html. Markers are removed in BOTH directions — the kept variant does
//   not carry its own `@only:` comments into the artifact — which is what makes that true.
//
//   ORDER. Stripping runs BEFORE the shell's <script> blocks are compiled. A full-only <script>
//   must never be minified, parse-gated and measured for a lite build it is not in.
//
//   LOUDNESS. Every `@only:`-shaped token in the file must parse as a real marker, name a real
//   variant, and balance. A typo (`@only:light`), a nested block, or an unclosed one is a build
//   failure with a line number — never a silently dropped or silently kept block. The failure mode
//   this guards against is the expensive one: a block that vanishes from an artifact nobody
//   diffed.
//
//   NO NESTING. Deliberate, not an omission. Nested `@only:` blocks make "which lines survive"
//   depend on an evaluation order a reader has to reconstruct, and no shipped case needs it. Two
//   sibling blocks say the same thing legibly.
//
// KNOWN LIMITATION, recorded rather than papered over: the stripper is a text scan, so a JavaScript
// *string literal* whose contents spell a marker would be read as one. The same hazard the
// `@inject:` seam has carried since v2. It is bounded by the balance check — a stray open with no
// close fails the build — and by the rule that the artifact carries no markers, so a leaked one is
// visible to a grep gate. If a shipped string ever needs those characters, it can be spelled by
// concatenation.

/** The comment forms a marker may be written in, in either language. */
const MARKER = /([ \t]*)(?:<!--\s*@(only:[A-Za-z0-9_-]+|end:only)\s*-->|\/\*\s*@(only:[A-Za-z0-9_-]+|end:only)\s*\*\/)([ \t]*\r?\n)?/g;

/** Anything marker-SHAPED, so a malformed one is reported rather than ignored. */
const LOOSE = /@(?:only:|end:only)/g;

export class VariantError extends Error {
  constructor(message) { super(message); this.name = 'VariantError'; }
}

/**
 * The variant table. One row per shipped artifact.
 *
 * `regions` is the manifest gate D10 reads: exactly these `@inject:` regions may appear in this
 * variant's stripped source, and all of them must.
 *
 * `budgets` WAS deliberately NULL for full, and P3 is the phase that fills it. The house rule is
 * that a constant without an anchor is not invented: lite's three numbers are the measured-plus-5%
 * figures METHODOLOGY §9.11 derives, and until `data/equilibrium.json` existed there was no
 * measurement of a full artifact to derive full's from, so the full build REPORTED its bytes and
 * asserted nothing, loudly. `test/variant.test.mjs` pinned the null so the flip would have to be a
 * decision rather than a drift, and this is that decision, taken on P3's first real payload.
 *
 * FULL'S FOUR NUMBERS, and the two that are NOT measured+5%:
 *
 *   total  634 KB   HELD BELOW measured+5%, deliberately, and this line is a REPAIR. It was set
 *                   from a measurement of 618,127 B taken before the vs-GTO block landed in the
 *                   same phase, and never re-taken: the P3 red team measured the artifact at
 *                   628,036 B and reconciled the 9,909 B gap to the byte against §9.11's own
 *                   reading of the mode (docs/refutations/P3.md), so D9 was printing a measurement
 *                   and a ceiling that could not both describe the same page. The number is NOT
 *                   raised — a fresh measured+5% would be 646 KB — because a ceiling tighter than
 *                   its own rule is the conservative direction and the artifact fits. What is
 *                   fixed is the sentence: the live reading is 629,312 B = 614.6 KB, 3.2% under
 *                   the 634 KB ceiling. The 600 KB page budget stays LITE's (§5.3) — this is a
 *                   second number for a second artifact, not a raise of the first.
 *   eq      73 KB   MEASURED 71,249 B = 69.6 KB; 73 KB = 74,752 B is 4.9% above it, one whole-KB
 *                   step below the 74 KB a fresh measured+5% would round up to, and kept there for
 *                   the same reason as `total`. (It WAS exactly measured+5% at 70,704 B; the P3
 *                   red-team resolution added the baselineQuant flag to the payload, +545 B.) This
 *                   is D9's own tripwire on the injected payload, and it is separate from `total`
 *                   on purpose: the equilibrium block is the full build's dataset, so a solver
 *                   payload that doubled would otherwise hide inside a page-sized ceiling.
 *   app    388 KB   NOT measured+5% OF FULL — LITE'S NUMBER, adopted deliberately, and raised in
 *                   lite's row rather than here. Full measures 0.2 KB over lite (one `<script>`
 *                   wrapper and one bridge line): it is THE SAME APPLICATION CODE, so a fresh
 *                   measured+5% here would hand the shared block ~18 KB of headroom the lite
 *                   artifact does not have — the side-effect raise V3-PLAN §3.3's adjudication 12
 *                   forbids. Full is held to lite's ceiling and whichever variant's app grows first
 *                   fails first. THE RAISE ITSELF (360 -> 388 at P3) is lite's, paid for the vs-GTO
 *                   colour mode at measured+5%, and it comes with `appCore`.
 *   appCore 360 KB  THE PAID-RAISE CLAUSE, and the reason the raise above is not a gift. It binds
 *                   the app payload MINUS the `@block:gto` region — the pre-raise ceiling, still
 *                   facing the same bytes it faced before P3 (359.3 KB, 682 B of headroom). Same
 *                   number in both variants, for the same reason `app` is.
 *   modelCode 54 KB NOT measured+5%, for the same reason and more strictly: it is byte-identical
 *                   between the variants — the same two inlined modules, the same minifier.
 *
 *                   RAISED 50 -> 54 AT P4, and stated rather than nudged (the P2 precedent, which
 *                   ratified +4 KB the same way). What bought it is §3.4's absolute-EV cut landing
 *                   in policy.mjs: `evCut` and its memo, the shared per-cell arithmetic both the
 *                   sibling accessor and the EV-primary branch come through, `evBadge`, `evStake`,
 *                   `evPrimary` and the request shape — 4.6 KB stripped, measured 53,353 B = 52.1K.
 *                   THE DERIVATION DID NOT SHIP: `k` is solved in scripts/lib/ev-band.mjs, which the
 *                   page never loads, because the page reads only the stamped `constants.evCut.mixK`
 *                   — the `constants.solver`/`solverBlock` split, applied again. Without that move
 *                   the same feature measured 54.5K.
 *                   54 is measured + 3.6%, DELIBERATELY BELOW the 8% margin this gate was calibrated
 *                   with (which would give 56): a ceiling tighter than its own rule is the
 *                   conservative direction, which is the reading D9's own P3 repair settled on.
 */
export const VARIANTS = {
  lite: {
    name: 'lite',
    out: 'index.html',
    regions: ['data', 'taxonomy', 'policy', 'engine'],
    budgets: { total: 600 * 1024, app: 388 * 1024, appCore: 360 * 1024, modelCode: 54 * 1024,
      blocks: { gto: 11 * 1024, ev: 12 * 1024, skill: 4 * 1024 } },
    budgetSource: 'METHODOLOGY §9.11, measured + ~5% at the v2 phase-4 end; app raised to 388K at '
      + 'P3 to pay for the vs-GTO colour mode (measured 377,993 B = 369.1K + 5% = 387.6K, rounded '
      + 'up to the whole KB, 4.9% headroom), with appCore holding everything else to the 360K the '
      + 'app block faced before the raise — the mode is bracketed @block:gto and build.mjs compiles '
      + 'the shell twice to measure it, so both readings are printed and both are gated; modelCode '
      + 'raised to 54K at P4 to pay for the absolute-EV cut in policy.mjs (measured 53,353 B = '
      + '52.1K, held at +3.6% rather than at this gate\'s calibrated +8%, which would give 56K). '
      + 'P4 UI: app is NOT raised again — the EV surface and the skill dial fit inside the 388K '
      + 'P3 already paid for, and appCore FELL to 357.9K (from 359.4K) because deleting the page\'s '
      + 'own duplicate pot arithmetic returned more unmarked bytes than the shared edits added. '
      + 'What is new is `blocks`: a per-block ceiling at measured+5%, gto 11K (10,198 B), ev 12K '
      + '(11,403 B), skill 4K (3,532 B) — the P3 red team\'s finding that @block:gto had no cap of '
      + 'its own, so an app raise bounded a NAME rather than a feature (docs/refutations/P3.md)',
    /* The per-variant honesty sentence D11 grep-gates. One artifact, one claim: the lite page must
       not carry the full page's, and vice versa. Text is P5's to write (§5.2, §10); these are
       shaped placeholders carrying the load-bearing clause each variant owes the reader. */
    claim: 'a self-contained offline page: the shipped measurement, and nothing that needed a solver',
  },
  full: {
    name: 'full',
    out: 'index-full.html',
    regions: ['data', 'taxonomy', 'policy', 'engine', 'eq'],
    budgets: { total: 646 * 1024, app: 388 * 1024, appCore: 360 * 1024, modelCode: 54 * 1024, eq: 73 * 1024,
      blocks: { gto: 11 * 1024, ev: 12 * 1024, skill: 4 * 1024 } },
    budgetSource: 'D9, P3, both HELD BELOW measured+5% rather than re-derived up to it (the P3 red '
      + 'team found total quoting a measurement taken before the vs-GTO block landed — '
      + 'docs/refutations/P3.md): total 634K bounds a page measured at 629,312 B (614.6K), 3.2% of '
      + 'headroom where a fresh measured+5% would give 646K; eq 73K = 74,752 B bounds a payload '
      + 'measured at 71,249 B (69.6K), 4.9% above it, one whole-KB step under the 74K measured+5% '
      + 'would round to. A ceiling tighter than its own rule is the conservative direction; the '
      + 'stale figure it replaces was not. '
      + 'app and modelCode are LITE\'s numbers, not a fresh measurement — the application code is '
      + 'the same in both artifacts (full measures 359.7K against lite\'s 359.5K, the difference '
      + 'being one script wrapper and one bridge line), and a measured+5% here would hand the '
      + 'shared app block 17K of headroom lite does not have (V3-PLAN §3.3 adjudication 12). '
      + 'RAISED 634 -> 646K AT THE P4 UI, and the number is not a new one: 646K is exactly what the '
      + 'P3 repair computed as a fresh measured+5% for the pre-P4 page and DECLINED to take, on the '
      + 'reading that a ceiling tighter than its own rule is the conservative direction. The P4 UI '
      + 'grew the full page 13.1K (623.2 -> 636.3K, measured 651,528 B) and it grew INTO that '
      + 'declined headroom, so the raise is a number this repository had already priced rather than '
      + 'one invented to fit. It is still held below the CURRENT measured+5%, which would give 669K: '
      + '646K = 661,504 B is 1.5% above the artifact. `blocks` is shared with lite and is the same '
      + 'code in both artifacts',
    claim: 'a self-contained offline page carrying the solved baseline as well as the measurement',
  },
};

export const VARIANT_NAMES = Object.keys(VARIANTS);

/** Which variants own a given `@inject:` region — the inverse of VARIANTS[*].regions. */
export function regionOwners(region) {
  return VARIANT_NAMES.filter((v) => VARIANTS[v].regions.includes(region));
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/**
 * Remove every `@only:` block that does not belong to `variant`, and the markers of the ones that
 * do. Returns the stripped text plus a census the build reports and a gate can assert on.
 *
 * @param {string} src
 * @param {string} variant one of VARIANT_NAMES
 * @param {object} [opts]
 * @param {string} [opts.label] what to call the file in error messages
 * @returns {{text:string, kept:number, dropped:number, keptBytes:number, droppedBytes:number,
 *            blocks:Array<{variant:string,line:number,bytes:number,kept:boolean,body:string,
 *                          at:number,end:number}>}}  `at`/`end` are offsets into `src`.
 */
export function stripOnlyBlocks(src, variant, opts = {}) {
  const label = opts.label || 'shell';
  const die = (m) => { throw new VariantError(`${label}: ${m}`); };
  if (!VARIANT_NAMES.includes(variant)) {
    die(`unknown variant ${JSON.stringify(variant)} — known variants are ${VARIANT_NAMES.join(', ')}`);
  }

  /* Pass 1: every marker-shaped token must be a real marker. A `//`-commented one, a stray space
     after the colon, an HTML marker inside a JS comment — all of them silently do nothing under a
     regex that only looks for the strict form, and "silently does nothing" is the failure this
     seam cannot afford. Count first, match second, compare. */
  const loose = [];
  for (let m; (m = LOOSE.exec(src));) loose.push(m.index);
  LOOSE.lastIndex = 0;

  const strict = [];
  for (let m; (m = MARKER.exec(src));) strict.push(m);
  MARKER.lastIndex = 0;

  if (loose.length !== strict.length) {
    const seen = new Set(strict.map((m) => src.indexOf('@', m.index)));
    const bad = loose.find((i) => !seen.has(i));
    const where = bad == null ? '' : ` (first at line ${lineOf(src, bad)}: `
      + `${JSON.stringify(src.slice(Math.max(0, bad - 12), bad + 24))})`;
    die(`found ${loose.length} @only-shaped tokens but only ${strict.length} well-formed markers`
      + `${where} — write them as \`<!-- @only:full -->\` or \`/* @only:lite */\`, closed by `
      + '`@end:only` in the same comment syntax');
  }

  let out = '';
  let at = 0;
  let open = null;
  const blocks = [];

  /* HOW MUCH OF THE LINE A MARKER TAKES WITH IT. Two cases, and the distinction is the difference
     between a clean artifact and one pocked with the blank lines and stray indentation of markers
     that used to be there:
       - a marker ALONE ON ITS LINE takes the whole line — its indentation and its newline — so a
         kept block comes out at the indentation it was authored at and a dropped one leaves no gap.
       - a marker sharing its line with content takes only itself, so `<div><!-- @only:full -->x
         <!-- @end:only --></div>` neither dedents the div nor swallows the line break after it.
     "Alone on its line" means: nothing but whitespace before it, and nothing but whitespace after
     it. Both halves are required — a marker that opens a line but is followed by content on the
     same line would otherwise have its content dedented. */
  const cut = (m) => {
    const startsLine = m.index === 0 || src[m.index - 1] === '\n';
    const endsLine = m[4] != null;
    if (startsLine && endsLine) return [m.index, m.index + m[0].length];
    return [m.index + m[1].length, m.index + m[0].length - (m[4] ? m[4].length : 0)];
  };

  for (const m of strict) {
    const token = m[2] ?? m[3];
    const [cutStart, cutEnd] = cut(m);

    if (token === 'end:only') {
      if (!open) die(`@end:only at line ${lineOf(src, m.index)} closes nothing`);
      const body = src.slice(open.bodyAt, cutStart);
      const kept = open.variant === variant;
      if (kept) out += body;
      /* `body` rides along because the build needs the text of the blocks it DROPPED, not just
         their sizes: S-D §F measured that lite-visible code calling a symbol declared inside a
         dropped block builds clean and ships the dangling call. Naming what was removed is what
         lets build.mjs refuse that (D10's build-time half). */
      blocks.push({
        variant: open.variant, line: open.line, bytes: Buffer.byteLength(body), kept, body,
        at: open.bodyAt, end: cutStart,
      });
      open = null;
      at = cutEnd;
      continue;
    }

    const name = token.slice('only:'.length);
    if (!VARIANT_NAMES.includes(name)) {
      die(`@only:${name} at line ${lineOf(src, m.index)} names no variant — `
        + `known variants are ${VARIANT_NAMES.join(', ')}`);
    }
    if (open) {
      die(`@only:${name} at line ${lineOf(src, m.index)} opens inside the @only:${open.variant} `
        + `block opened at line ${open.line} — @only blocks do not nest (write two siblings)`);
    }
    out += src.slice(at, cutStart);
    open = { variant: name, line: lineOf(src, m.index), bodyAt: cutEnd };
    at = cutEnd;
  }

  if (open) die(`@only:${open.variant} opened at line ${open.line} is never closed by @end:only`);
  out += src.slice(at);

  const keptB = blocks.filter((b) => b.kept);
  const dropB = blocks.filter((b) => !b.kept);
  return {
    text: out,
    kept: keptB.length,
    dropped: dropB.length,
    keptBytes: keptB.reduce((s, b) => s + b.bytes, 0),
    droppedBytes: dropB.reduce((s, b) => s + b.bytes, 0),
    blocks,
  };
}

/**
 * THE THIRD SEAM, and it is a MEASURING TAPE rather than a switch.
 *
 * `@block:<name>` … `@end:block` marks a region of source that ships in every variant — nothing is
 * stripped from any artifact by it — so that the build can compile the shell a SECOND time with
 * those regions removed and report what the named feature costs. V3-PLAN §3.3's adjudication 12
 * requires that a raise to the app budget be stated, paid, and visible to the gate: the vs-GTO
 * colour mode is marked `@block:gto`, the app ceiling was raised by its measured size + 5%, and a
 * `core` ceiling holds everything else to the number it faced before the raise. Without the second
 * compile the two readings would be an assertion; with it they are a measurement the build prints
 * on every run.
 *
 * WHY NOT REUSE `@only:`. Those blocks are variant-conditional and their bytes are a fact about the
 * artifact; these ship everywhere and their bytes are a fact about a FEATURE. Overloading one
 * marker with both meanings would make "which lines are in this file" depend on which question was
 * being asked, and D10's negative manifest reads the `@only:` census directly.
 *
 * The opening marker may carry prose after the name (the mode's block is a thirty-line comment),
 * so the scan is by delimiter rather than by regex: the marker opens at `/* @block:<name>` or
 * `<!-- @block:<name>` and the region ends at the matching `@end:block` in the same comment syntax.
 * Nesting is refused for the same reason `@only:` refuses it.
 *
 * @param {string} src
 * @param {string} name the block name, e.g. 'gto'
 * @param {object} [opts]
 * @returns {{text:string, blocks:number, bytes:number}} `bytes` is the SOURCE size removed; what
 *          the build reports is the difference between two COMPILED shells, which is smaller.
 */
export function stripMarkedBlocks(src, name, opts = {}) {
  const label = opts.label || 'shell';
  const die = (m) => { throw new VariantError(`${label}: ${m}`); };
  const opens = [`/* @block:${name}`, `<!-- @block:${name}`];
  const closes = ['/* @end:block */', '<!-- @end:block -->'];
  let out = '', at = 0, blocks = 0, bytes = 0;
  for (;;) {
    let i = -1, kind = -1;
    for (let k = 0; k < opens.length; k++) {
      const j = src.indexOf(opens[k], at);
      if (j >= 0 && (i < 0 || j < i)) { i = j; kind = k; }
    }
    if (i < 0) break;
    const close = closes[kind];
    const j = src.indexOf(close, i);
    if (j < 0) die(`@block:${name} opened at line ${lineOf(src, i)} is never closed by @end:block`);
    const body = src.slice(i, j + close.length);
    for (const o of opens) {
      if (body.indexOf(o, 1) > 0) die(`@block:${name} at line ${lineOf(src, i)} contains another one — marked blocks do not nest`);
    }
    /* a region alone on its lines takes its whole lines with it, so the second compile does not
       differ from the first by a trail of blank lines the first one never had */
    let a = i, b = j + close.length;
    while (a > 0 && (src[a - 1] === ' ' || src[a - 1] === '\t')) a--;
    if (a === 0 || src[a - 1] === '\n') { if (src[b] === '\r') b++; if (src[b] === '\n') b++; } else a = i;
    out += src.slice(at, a);
    bytes += Buffer.byteLength(src.slice(a, b));
    at = b;
    blocks++;
  }
  if (!blocks) return { text: src, blocks: 0, bytes: 0 };
  out += src.slice(at);
  return { text: out, blocks, bytes };
}

/**
 * The `@inject:` region manifest, read off the STRIPPED source. This is gate D10's build-time half:
 * a lite build that can still see an `@inject:eq` marker refuses, and a full build missing one
 * refuses too — so neither "the full-only payload leaked into lite" nor "the full artifact shipped
 * without its payload" can happen quietly.
 *
 * @param {string} strippedSrc
 * @param {string} variant
 * @param {object} [opts]
 * @returns {string[]} the regions to fill, in VARIANTS[variant].regions order
 */
export function regionManifest(strippedSrc, variant, opts = {}) {
  const label = opts.label || 'shell';
  const spec = VARIANTS[variant];
  const present = new Set();
  for (const m of strippedSrc.matchAll(/\/\*\s*@inject:([a-z0-9-]+)\s*\*\//g)) present.add(m[1]);

  const missing = spec.regions.filter((r) => !present.has(r));
  if (missing.length) {
    throw new VariantError(`${label}: the ${variant} build needs @inject:${missing.join(', @inject:')}`
      + ` — marker${missing.length === 1 ? '' : 's'} not found`);
  }
  const extra = [...present].filter((r) => !spec.regions.includes(r));
  if (extra.length) {
    const owners = extra.map((r) => `${r} (${regionOwners(r).join('/') || 'no variant'})`);
    throw new VariantError(`${label}: the ${variant} build must not contain @inject:${extra.join(', @inject:')}`
      + ` — ${owners.join(', ')}. Wrap the region in an \`@only:\` block for the variant that owns it.`);
  }
  return spec.regions;
}

/**
 * Declarations a text introduces at any nesting depth: `function f`, `const f =`, `let f =`,
 * `var f =`, and `class f`. Deliberately crude — this is a name census, not a scope analysis — and
 * crude in the safe direction: over-collecting a name only ever means the check below decides a
 * symbol IS declared in the kept text and stays quiet, which is the same answer it gives today.
 */
const DECL = /(?:^|[^\w$.])(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=)/g;

function declaredNames(text) {
  const names = new Set();
  for (const m of text.matchAll(DECL)) names.add(m[1] || m[2] || m[3]);
  return names;
}

/**
 * THE ONE GAP S-D MEASURED, closed at the seam that creates it.
 *
 * Stripping is textual and runs before parsing, so lite-visible code that calls a function declared
 * inside an `@only:full` block **builds clean**: the remainder parses, minifies, passes every size
 * and refusal gate, and then throws in the browser — in the artifact that is not allowed to break.
 * `--check` cannot see it (the artifact is exactly what the build produced), and only a per-variant
 * smoke run catches it afterwards. docs/spikes/S-D.md §F recorded that as the boundary of what a
 * text seam can prove.
 *
 * It is not, in fact, the boundary. The build knows two things a general free-identifier lint would
 * have to rediscover: exactly which names this variant REMOVED, and the full text it KEPT. That is
 * enough for the case that actually happens, without a scope analysis jsmin does not do:
 *
 *   a name declared only inside a block this variant dropped, and CALLED in the text it kept.
 *
 * Scoped to CALL sites (`name(`) rather than bare references on purpose. A call is unambiguous —
 * markup prose and CSS do not call functions — whereas a bare identifier match would fire on the
 * word appearing in a sentence. Bare references to dropped *data* (`EQUILIBRIUM`) are covered from
 * the other side, by gate D10's negative manifest over the built artifact; between the two, the
 * dangling call and the dangling datum are both refused.
 *
 * The false-positive guard is the `declaredNames(strip.text)` subtraction: a common name that a
 * full-only block happens to reuse (`render`, `fmt`) is only reported if the kept text does not
 * declare it too — i.e. only when the call really would resolve to nothing.
 *
 * BOTH LINE NUMBERS ARE SOURCE LINE NUMBERS, and that is why `src` is a parameter rather than the
 * function just reading `strip.text`. The declaration's line comes from the original file; if the
 * call site's line came from the STRIPPED text, one error message would carry two line numbers in
 * two different coordinate systems, several hundred lines apart in a 415 KB shell, with nothing
 * saying so. Cheap to get right: the call is located in the original, skipping any hit that falls
 * inside a block this variant dropped (those are the definition's own recursive calls, not
 * dangling ones).
 *
 * @param {{text:string, blocks:Array<{variant:string,line:number,kept:boolean,body:string,
 *          at:number,end:number}>}} strip  the return value of stripOnlyBlocks
 * @param {string} src the ORIGINAL source those blocks were stripped from
 * @returns {Array<{name:string, fromVariant:string, fromLine:number, line:number}>}
 */
export function danglingSymbols(strip, src) {
  const dropped = strip.blocks.filter((b) => !b.kept);
  if (!dropped.length) return [];
  const kept = declaredNames(strip.text);
  const inDropped = (i) => dropped.some((b) => i >= b.at && i < b.end);
  const out = [];
  const seen = new Set();
  for (const b of dropped) {
    for (const name of declaredNames(b.body)) {
      if (kept.has(name) || seen.has(name)) continue;
      if (!new RegExp(`(?:^|[^\\w$.])${name}\\s*\\(`).test(strip.text)) continue;
      const call = new RegExp(`(?:^|[^\\w$.])${name}\\s*\\(`, 'g');
      let at = null;
      for (let m; (m = call.exec(src));) {
        if (!inDropped(m.index)) { at = m.index + m[0].indexOf(name); break; }
      }
      seen.add(name);
      out.push({
        name,
        fromVariant: b.variant,
        fromLine: b.line,
        line: at === null ? b.line : src.slice(0, at).split('\n').length,
      });
    }
  }
  return out;
}
