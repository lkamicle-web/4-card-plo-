/**
 * test/ui-seats.test.mjs — V4-PLAN §2.6's table-size axis, tested as the text that ships.
 *
 * Lane U's half of the seat ladder: the control, the rail, the URL axis, the Method view's Table
 * size section and the two harnesses. Everything here is asserted against `src/shell.html`,
 * `smoke.mjs` and `browsers.mjs` as SOURCE, because that is what the build compiles and what a
 * reviewer diffs — a browser session proves the page works today, and a source assertion proves it
 * cannot quietly stop being written that way.
 *
 * THE FOUR TRAPS THIS FILE IS ABOUT, each of which shipped green somewhere in this repository's
 * history in a different costume:
 *
 *   1. AN AXIS THAT MOVES A TIER AND NOT THE MEMO KEY. `policy.envKey`'s docstring is a whole
 *      paragraph about it and the page keeps its OWN key. `seats` must be in both, or a re-solve
 *      at nine seats hands back the six-seat answer — silently, and only for the cells the memo
 *      happens to be holding.
 *   2. A SECOND COPY OF THE ENV BAG. The page used to spell the four env fields out twice, in
 *      `stateOf` and in `solveState`; a fifth axis added to one and not the other is the same
 *      silent wrong answer one level up. There is one literal now, and this file pins that.
 *   3. A COUNT TYPED BESIDE THE THING IT COUNTS. The vs-GTO coverage line reads "3 of 24" at six
 *      seats and must read "3 of 36" at nine WITHOUT the shipped block changing, so its
 *      denominator has to be `POSITIONS.length * NODES.length` and not the map's row count.
 *   4. A CENSUS THAT OUTLIVES ITS MEASUREMENT. The Method view's `extrapolated` table is swept
 *      live from the same function the Known-weaknesses paragraph runs; this file re-derives both
 *      sizes' counts straight from `policy.mjs` and requires the page's own enumeration to be the
 *      same domain.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { stripMarkedBlocks, stripOnlyBlocks, VARIANT_NAMES } from '../scripts/lib/variant.mjs';
import * as P from '../scripts/lib/policy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = readFileSync(join(ROOT, 'src', 'shell.html'), 'utf8');
const SMOKE = readFileSync(join(ROOT, 'smoke.mjs'), 'utf8');
const BROWSERS = readFileSync(join(ROOT, 'browsers.mjs'), 'utf8');
/** the shell with comments gone: a comment may quote a name, a string literal is a second copy */
const CODE = SHELL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

// ---------------------------------------------------------------- the marked block

test('@block:ring is a real region in both variants, and it is where the 9-max-only bytes are', () => {
  const r = stripMarkedBlocks(SHELL, 'ring');
  assert.ok(r.blocks >= 8, `@block:ring is marked in ${r.blocks} places, expected at least 8 — `
    + 'markup, CSS, the accessors, the control, the two harness hooks, the URL axis and the Method section');
  assert.ok(r.bytes > 8000, `the @block:ring source is the feature, not a marker census (${r.bytes} B)`);
  assert.ok(!/@block:ring/.test(r.text), 'the cut consumes its own opening markers');
  /* Shared code, not a full-only surface: both artifacts carry the whole of it, which is what makes
     `blocks.ring` one cap rather than two. */
  for (const v of VARIANT_NAMES) {
    assert.ok(stripMarkedBlocks(stripOnlyBlocks(SHELL, v).text, 'ring').blocks >= 8,
      `${v} carries the whole of @block:ring`);
  }
});

test('cutting @block:ring leaves a page that still parses as six-seat code', () => {
  /* The block census MEASURES by cutting, so every reference from shared code into this block has
     to be one the shared code can live without. The two that would break it are named here rather
     than left to the census to discover: `RING` is declared outside the block (and stays null), and
     nothing outside it calls `setSeats`, `applySeats`, `seatLabel` or `syncSeatsCtl` unbracketed. */
  const cut = stripMarkedBlocks(SHELL, 'ring').text.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(cut, /var RING = null;/, 'RING is declared in shared code, so a cut page still names it');
  for (const fn of ['setSeats', 'applySeats', 'syncSeatsCtl', 'wireSeatsCtl', 'seatLabel', 'RING_WHY', 'HAS_SEATS']) {
    assert.ok(!new RegExp(`\\b${fn}\\b`).test(cut),
      `${fn} survives the @block:ring cut — it must be inside the block, or bracketed at its call site`);
  }
});

// ---------------------------------------------------------------- trap 1: the memo key

test('the seat axis is in the page\'s own memo key, the way depth, rake and straddle are', () => {
  const m = /function envKey\(\)\s*\{([^}]*)\}/.exec(CODE);
  assert.ok(m, 'the page still has its own envKey');
  assert.match(m[1], /S\.seats/, 'seats is in the page memo key — an axis that moves a tier and not '
    + 'the key hands back another table\'s answer, silently');
  /* and policy's, which is the one `solve` and `aggressiveSet` cache under */
  assert.notEqual(P.envKey({ seats: 9 }), P.envKey({ seats: 6 }), 'policy.envKey separates the two sizes');
  assert.equal(P.envKey({ seats: 7 }), P.envKey({ seats: 6 }), 'and reads anything else as six — {6,9} is a set');
});

test('S.seats defaults to 6, which is the identity, and the axis is a member of env', () => {
  assert.match(CODE, /seats: 6,/, 'the state opens six-max');
  assert.match(CODE, /seats: S\.seats/, 'and the env bag carries it');
  assert.equal(P.envOf({}).seats, 6, 'policy agrees about the default');
  assert.equal(P.seatsFor(6), P.POSITIONS, 'six seats is the legacy array by reference, not a copy');
});

// ---------------------------------------------------------------- trap 2: one env literal

test('there is ONE env bag literal: solveState goes through stateOf rather than spelling it again', () => {
  const m = /function solveState\([^)]*\)\s*\{([\s\S]*?)\n\}/.exec(CODE);
  assert.ok(m, 'solveState is still there');
  assert.match(m[1], /stateOf\(/, 'solveState builds its state through stateOf');
  assert.ok(!/rakeCapBB: S\.rakeCap/.test(m[1]),
    'solveState must not carry a second copy of the env fields — that copy is how an axis reaches '
    + 'evaluate and misses solve');
  /* exactly one place in the page names `rakeCapBB: S.rakeCap`, and it is envArg */
  const hits = CODE.match(/rakeCapBB: S\.rakeCap/g) || [];
  assert.equal(hits.length, 1, `the env literal appears ${hits.length} times; one is the whole point`);
});

test('the ring payload reaches the solve through the state bag, and is null when nothing supplies it', () => {
  assert.match(CODE, /s\.ring = RING;/, 'stateOf carries the ring payload to policy');
  /* The accessors are the ONLY route above the shipped span, and at six seats they delegate. */
  const cell = { eq: [50, 45, 42, 40, 38, 36, 35], rho: [1, 1, 1, 1, 1, 1, 1], nu: 0.4 };
  assert.equal(P.eqAtSeats(cell, 7, 6, null, 'k'), P.eqAt(cell.eq, 7), 'six seats delegates, ring unread');
  assert.equal(P.eqAtSeats(cell, 7, 9, null, 'k'), P.eqAt(cell.eq, 7), 'nine seats at or under the span too');
  assert.throws(() => P.eqAtSeats(cell, 8.2, 9, null, 'k'), /data\/ring\.json/,
    'above the span with no payload it FAILS CLOSED, naming the file — never the last column');
});

// ---------------------------------------------------------------- the control and the rail

test('the Table control is two buttons in the environment rail, hidden until the axis exists', () => {
  assert.match(SHELL, /id="seatsrow"[^>]*hidden/, 'the row starts hidden and is shown by the feature detect');
  assert.match(SHELL, /id="seats6"[^>]*aria-pressed="true"/, 'six-max is the pressed default');
  assert.match(SHELL, /id="seats9"[^>]*aria-pressed="false"/);
  assert.match(SHELL, /id="seatsnote"/, 'and the disablement reason has somewhere to render');
  /* Inside `#tablesec`, beside depth / rake / straddle, which is where §2.6 puts it. */
  const sec = SHELL.slice(SHELL.indexOf('id="tablesec"'), SHELL.indexOf('id="vpsec"'));
  assert.ok(sec.includes('id="seatsrow"'), 'the control is in Table & stakes with the other env axes');
  assert.ok(sec.includes('id="straddle"') && sec.includes('id="depth"'), '(and they are still there)');
});

test('the rail renders seatsFor(seats): one builder, no second copy of the chip markup', () => {
  assert.match(CODE, /function buildPosSeg\(\)/, 'the rail has a rebuild entry point');
  const m = /function buildPosSeg\(\)\s*\{([\s\S]*?)\n\}/.exec(CODE);
  assert.match(m[1], /POSITIONS\.forEach/, 'and it builds from POSITIONS, which IS the ladder');
  /* one place builds a seat chip */
  const chips = CODE.match(/b\.dataset\.pos = p;/g) || [];
  assert.equal(chips.length, 1, 'exactly one place builds a seat chip');
  assert.match(CODE, /POSITIONS = POL\.seatsFor\(S\.seats\)/, 'and the ladder comes from policy, never a literal');
});

test('nine seats is refused, by name, on a build that carries no ring payload', () => {
  const blk = stripMarkedBlocks(SHELL, 'ring');
  const kept = SHELL.length - blk.text.length;
  assert.ok(kept > 0);
  assert.match(SHELL, /n === 9 && !RING/, 'setSeats refuses the size the build cannot measure');
  assert.match(SHELL, /data\/ring\.json/, 'and the reason names the artifact that is missing');
  /* The reason is rendered, not merely stored: the button carries it and so does the note. */
  assert.match(CODE, /b\.title = off \? RING_WHY/, 'the disabled button says why');
  assert.match(CODE, /note\.innerHTML = RING_WHY/, 'and so does the row beneath it');
});

// ---------------------------------------------------------------- the URL axis

test('seats is persisted in the permalink like the other env axes, and read before pos', () => {
  assert.match(CODE, /h \+= '&seats=' \+ S\.seats/, 'the link carries the size');
  assert.match(CODE, /if \(S\.seats !== 6\)/, 'omitted at its default, so a six-max link is the length it was');
  const rh = CODE.slice(CODE.indexOf('function readHash()'));
  const iSeats = rh.indexOf("q.seats === '9'");
  const iPos = rh.indexOf('POSITIONS.indexOf(q.pos)');
  assert.ok(iSeats > 0 && iPos > iSeats,
    'the size is applied BEFORE pos, or a nine-seat link has its seat rejected by the six-seat list');
});

// ---------------------------------------------------------------- trap 3: the coverage denominator

test('the vs-GTO coverage denominator is all pos x node at the live size, not the shipped map\'s rows', () => {
  assert.match(CODE, /\(POSITIONS\.length \* NODES\.length\)/,
    'the denominator is structural — 24 at six seats, 36 at nine, from one expression');
  assert.ok(!/cov2\.length - covd\.length/.test(CODE),
    'the uncovered count must follow the same denominator, or the two halves of one sentence disagree');
  /* and the arithmetic the sentence will print, checked here rather than in prose */
  assert.equal(P.seatsFor(6).length * 4, 24);
  assert.equal(P.seatsFor(9).length * 4, 36);
  /* the three heads-up pairs are in BOTH ladders, so coverage stays 3 and the uncovered rows go 21 -> 33 */
  for (const p of ['SB', 'BB']) {
    assert.ok(P.seatsFor(6).includes(p) && P.seatsFor(9).includes(p), `${p} is a seat at both sizes`);
  }
  assert.equal(36 - 3, 33, 'the number §0.2 names');
});

// ---------------------------------------------------------------- trap 4: the census

test('the extrapolated census is swept, per (position, node), over one domain at both sizes', () => {
  assert.match(CODE, /function extrapReach\(seats\)/, 'the census takes a table size');
  assert.match(CODE, /extrapReach\(9\), c6 = extrapReach\(6\)/,
    'and the Method view runs the SAME function at both sizes rather than a second enumeration');
  assert.match(CODE, /by\[pos \+ '\|' \+ node\]/, 'with the per-(pos, node) breakdown R3 asks for');
  /* and the printed SHARE is taken over the record's domain — the sweep's own per-pair counts with
     the vs-3-bet rows dropped — so the page cannot print 0.99 % where METHODOLOGY records 1.19 % */
  assert.match(CODE, /!== '3bet'\) t \+= r\.by\[k\]\[1\]/, 'the denominator excludes the node that cannot clamp');
  /* THE DOMAIN, re-derived here from policy and compared with the page's own enumeration rules:
     4 nodes x legal seats x VPIP 25..90 x limpers {1..4} at limps else {2} x straddle {off,on}. */
  const count = (seats) => {
    let n = 0;
    for (const node of P.NODES) {
      if (node === '3bet') continue;                 // N_eff is the constant 2; the node cannot clamp
      for (const pos of P.seatsFor(seats)) {
        if (P.positionDisabled(pos, node, seats)) continue;
        n += 2 * (node === 'limps' ? 4 : 1) * (90 - 25 + 1);
      }
    }
    return n;
  };
  assert.equal(count(6), 3960, 'the six-seat domain V3-BRIEF :211 records');
  assert.equal(count(9), 6336, 'and the nine-seat one — 48 legal rows, not the work order\'s 43');
  /* the integer behind the recorded 1.19 %, and the nine-seat reading the section prints */
  const fires = (seats) => {
    let f = 0;
    for (const node of P.NODES) {
      for (const pos of P.seatsFor(seats)) {
        if (P.positionDisabled(pos, node, seats)) continue;
        for (const str of [false, true]) {
          for (const L of node === 'limps' ? [1, 2, 3, 4] : [2]) {
            for (let v = 25; v <= 90; v++) {
              if (P.nEff({ pos, node, v: v / 100, limpers: L, straddle: str, seats }).extrapolated) f++;
            }
          }
        }
      }
    }
    return f;
  };
  assert.equal(fires(6), 47, '47 of 3,960 — the integer the recorded 1.19 % is a rounding of');
  assert.equal(fires(9), 19, 'at nine seats the clamp MOVES rather than lifting, and the share falls');
});

// ---------------------------------------------------------------- no new seat-name literal

test('no NEW seat-name literal in the page or in either harness (I51(c), the page half)', () => {
  /* The three keys the ladder gained. They may appear in `policy.mjs`'s LADDER9 and SEAT_DISPLAY,
     in the fixtures and in `test/ladder.test.mjs`, and NOWHERE the page or the harnesses can read
     them from — every consumer takes its list from `seatsFor`. Checked on the SOURCE including
     comments, because a comment naming a seat is how the next one gets typed. */
  for (const f of [['src/shell.html', SHELL], ['smoke.mjs', SMOKE], ['browsers.mjs', BROWSERS]]) {
    for (const key of ['UTG1', 'UTG2', 'LJ']) {
      assert.ok(!new RegExp(`['"\`]${key}['"\`]`).test(f[1]),
        `${f[0]} carries the seat-name literal "${key}" — take the list from seatsFor(seats)`);
    }
  }
  /* and the display forms are policy's map, not a second table in the page */
  assert.match(CODE, /POL\.SEAT_DISPLAY/, 'the rail reads the display map');
  assert.ok(!/UTG\+1/.test(SHELL), 'and does not carry its own copy of it');
  assert.deepEqual(P.SEAT_DISPLAY, { UTG1: 'UTG+1', UTG2: 'UTG+2' });
});

// ---------------------------------------------------------------- the Method view section

test('the Table size section renders from shipped data, never from prose typed beside it', () => {
  const i = SHELL.indexOf('<h3>Table size &mdash; the seat ladder</h3>');
  assert.ok(i > 0, 'the Method view gains the section §2.6 step 4 asks for');
  const sec = SHELL.slice(i, SHELL.indexOf("html += '<h3>Constants", i));
  for (const [what, re] of [
    ['the ladder', /POL\.seatsFor|sf\(n\)/],
    ['behindNonBlind', /POL\.behindNonBlind/],
    ['blindBehind', /POL\.blindBehind/],
    ['nestChain', /POL\.nestChain/],
    ['positionDisabled', /POL\.positionDisabled/],
    ['nMax', /POL\.nMax/],
    ['the rule', /LD\.baseRaiseRule/],
    ['the baseR rule', /LD\.baseRRule/],
    ['the step', /LD\.earlyStep/],
    ['the anchor', /LD\.anchor/],
    ['the flag', /LD\.flag/],
    ['the derived values', /LD\.derived\.baseRaise/],
    ['the ring meta', /RING\.meta\.generatorHash/],
    ['the census', /cx\.fires/],
  ]) assert.match(sec, re, `the section renders ${what} from the shipped data`);
  /* the numbers must not ALSO be typed: 0.77 and the three derived baseRaise values are data */
  for (const n of ['0.77', '0.07304528', '0.094864', '0.1232']) {
    assert.ok(!sec.includes(n), `${n} is typed into the Method view — it is constants.ladder's, and it can drift`);
  }
  /* and `ladder.derived` wears the estimate badge, which is the whole of what "no nine-handed
     measurement stands behind these" is allowed to look like on screen */
  assert.match(CODE, /'ladder\.derived': 1/, 'the badge map names it');
});

test('NO new rail-chip badge ships, and the decision is visible in the source (rule R3)', () => {
  /* There is one `extrapolated` surface and it is the N_eff readout for the CURRENT setting. A
     per-(pos, node) chip would put markup and CSS into appCore, §2.7's tightest row; the census
     lives in the Method view instead. Asserted by counting the badge's own class. */
  const uses = (SHELL.match(/badge-extrap/g) || []).length;
  assert.equal(uses, 2, `badge-extrap appears ${uses} times — one CSS rule and one readout; `
    + 'a third is a rail chip nobody decided to ship');
  assert.ok(!/class="[^"]*\bextrap\b[^"]*"/.test(SHELL.slice(SHELL.indexOf('id="posseg"'), SHELL.indexOf('id="facingtabs"'))),
    'and the position rail carries no extrapolated badge');
});

// ---------------------------------------------------------------- the harnesses

test('smoke.mjs gains ONE row, reads the ON-default budget, and the three morph rows are unmoved', () => {
  assert.match(SMOKE, /const MORPH_BUDGET_MS = 8;/, 'the floor check is unmoved');
  assert.match(SMOKE, /const MORPH_LAYOUT_BUDGET_MS = 4;/, 'the profile-OFF budget is unmoved');
  assert.match(SMOKE, /const MORPH_LAYOUT_ON_BUDGET_MS = 16;/, 'the profile-ON budget is unmoved');
  /* the new row reads the ON budget rather than inventing a fourth number */
  assert.match(SMOKE, /table-size toggle repaint p95 < \$\{MORPH_LAYOUT_ON_BUDGET_MS\} ms/,
    'the toggle row is read against the ON-default budget, not a new one');
  const rows = (SMOKE.match(/MORPH_LAYOUT_ON_BUDGET_MS/g) || []).length;
  assert.equal(rows, 5, 'the ON budget is declared once and read by exactly two rows (each naming it twice)');
  /* and it asserts the size MOVED, the way the profile row asserts the profile did */
  assert.match(SMOKE, /const moved = seats9\.seats === 9/, 'the row proves the state changed');
  assert.match(SMOKE, /round < 8/, 'over at least five rounds of toggling');
  /* driven through the buttons, never by writing S.seats */
  assert.match(SMOKE, /getElementById\('seats' \+ n\)/, 'through the control a user clicks');
  assert.ok(!/setSeats\(/.test(SMOKE), 'and never by calling the setter behind it');
});

test('browsers.mjs measures the control in every engine, raw fact beside the page\'s claim', () => {
  assert.match(BROWSERS, /F4 {2}the table-size control/, 'F4 is documented in the header with F1..F3');
  assert.match(BROWSERS, /out\.f4raw = /, 'the RAW fact: does this artifact carry the ring payload');
  assert.match(BROWSERS, /out\.f4 = /, 'and what the page claims about it');
  assert.match(BROWSERS, /q\.disabled && !!q\.why/, 'without the payload the control must be disabled AND say why');
  assert.match(BROWSERS, /q\.nine\.rail === 9/, 'with it the rail must actually reach nine seats');
  assert.match(BROWSERS, /q\.back\.rail === 6/, 'and come back');
  /* headless, throwaway profiles — the standing house rule, asserted where it is easy to lose */
  assert.ok(!/executablePath|channel:/.test(BROWSERS), 'never an installed browser');
});
