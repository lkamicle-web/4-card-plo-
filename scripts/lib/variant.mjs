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
 * `budgets` is deliberately NULL for full. The house rule is that a constant without an anchor is
 * not invented: lite's three numbers are the measured-plus-5% figures METHODOLOGY §9.11 derives and
 * they are carried over unchanged, but there is no measurement of a full artifact yet — the
 * equilibrium payload it is sized around does not exist. So the full build REPORTS its bytes and
 * asserts nothing, loudly, until D9 sets the number from the first real `data/equilibrium.json`.
 * A fabricated ceiling would be worse than an absent one: it would read as a checked claim.
 */
export const VARIANTS = {
  lite: {
    name: 'lite',
    out: 'index.html',
    regions: ['data', 'taxonomy', 'policy', 'engine'],
    budgets: { total: 600 * 1024, app: 360 * 1024, modelCode: 50 * 1024 },
    budgetSource: 'METHODOLOGY §9.11, measured + ~5% at the v2 phase-4 end',
    /* The per-variant honesty sentence D11 grep-gates. One artifact, one claim: the lite page must
       not carry the full page's, and vice versa. Text is P5's to write (§5.2, §10); these are
       shaped placeholders carrying the load-bearing clause each variant owes the reader. */
    claim: 'a self-contained offline page: the shipped measurement, and nothing that needed a solver',
  },
  full: {
    name: 'full',
    out: 'index-full.html',
    regions: ['data', 'taxonomy', 'policy', 'engine', 'eq'],
    budgets: null,
    budgetSource: 'UNANCHORED — D9 sets it from the first measured data/equilibrium.json (+5%)',
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
