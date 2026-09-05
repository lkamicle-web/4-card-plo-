// gates I41 I42 I43 I44 — the P1 lane-M mechanisms (V3-PLAN §3.1, items 6, 6b, 9, 8).
//
// Four axes land in this phase and every one of them enters as V3-PLAN §0.4(a) — "a new axis
// inert at legacy settings". That shape is not a hedge, it is the only shape available: three of
// the four move tiers on the shallow, deep and straddled lanes of I32's frozen surface, and §0.4
// says a change of that kind is a deliberate `freeze-tiers.mjs --force` ceremony with the
// move-diff committed, which belongs to the B1 integration stage rather than to a lane worktree.
// So each gate below asserts TWO things about its mechanism: that it does what §3.1 says when it
// is ON, and that it is the bit-identical identity when it is OFF. The second half is what lets
// I32 stay green in the same run.
//
//   I41  the rake-depth coupling (item 6)      — one new opinion, `rake.potScale`, flagged
//   I42  the depth->width factor (item 6b)     — zero new opinion, the free anchor of brief §5.4
//   I43  the villain profile-ON machinery (8)  — the LIBRARY default stays OFF; B1 flipped the PAGE's
//   I44  the 3-bet sizing axis (item 9)        — exact arithmetic, one unanchorable flag
//
// Two of §7.2's expected-falsified predictions are tested here and BOTH SURVIVE. They are
// reported as findings rather than quietly dropped, with the measurement that says why — a
// prediction that was offered for falsification and did not fall is a result, and the number that
// would have falsified it is the useful part.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ROW_ORDER, COL_ORDER } from '../lib/taxonomy.mjs';
import * as P from '../lib/policy.mjs';
import { ROOT, TOTAL, VPIP_GRID, overPct, underPct } from './_shared.mjs';

export const family = 'couplings';
export const title = 'the v3 axes — rake-depth, depth-width, villain profile-ON, 3-bet sizing';
export const ids = ['I41', 'I42', 'I43', 'I44'];

/** the depth grid the coupling gates sweep — the slider's detents plus both endpoints and the knee */
const DGRID = [40, 60, 80, 100, 120, 150, 200, 250];
const NODES3 = ['rfi', 'limps', 'raise'];

/**
 * THE LIMITATIONS REGISTER'S BOUNDING CLAUSE — the grep-gate idiom, shared by I41 and I42.
 *
 * `CONSTANTS.limitations` ships two of METHODOLOGY §10's entries as DATA so the Method view renders
 * them instead of transcribing them. That is only worth anything if the two copies cannot drift, so
 * each `note` must appear VERBATIM in docs/METHODOLOGY.md under the numbered entry it names.
 *
 * Split across I41 and I42 rather than given a gate of its own, and the split is by SUBJECT rather
 * than by convenience: limitation 16 is the named reason `rake.potScale` cannot be anchored, which
 * is I41's own flag, and limitation 17 is the defect I42's factor half-closes. Each gate proves the
 * limitation it leans on is actually published, in both places, rather than asserted in a comment.
 *
 * SCOPED TO THE ENTRY'S OWN BLOCK, and that is the P1 red team's correction rather than a
 * refinement. The first version searched the whole flattened document for the sentence and checked
 * separately that a numbered heading line for N existed at all. A refuter SWAPPED the two entries' `n` values —
 * so limitation 16, the named reason `rake.potScale` cannot be anchored, carried the percentile-cut
 * note — left both notes byte-identical to METHODOLOGY.md, and passed all 52 gates. The docstring
 * above promised "under the numbered entry it names" and the code did not check it. It does now:
 * the search runs over the slice from entry N's own heading to the next numbered entry and
 * nowhere else, so a
 * note filed under the wrong number fails, and so does a note relocated out of its entry.
 *
 * @returns {string[]} the problems, empty when the register and the document agree
 */
function limitationProblems(n) {
  const out = [];
  const reg = P.CONSTANTS.limitations || [];
  const e = reg.find((x) => x.n === n);
  if (!e) return [`limitation ${n} is missing from constants.limitations`];
  if (!e.note || e.note.length < 80) out.push(`limitation ${n}'s note is missing or a stub`);
  if (!e.of || !e.fix) out.push(`limitation ${n} does not name what it is about or what would fix it`);
  // THE CHAIN FROM THE ADMISSION TO THE CONSTANTS IT LEGITIMISES. `flagsItExplains` is the only
  // machine-readable link from a limitation to the flags that cite it, and it too was deletable
  // with everything green. Where it is declared it must resolve: every path a real shipped
  // constant, in a block that actually carries a flag.
  for (const path of e.flagsItExplains || []) {
    const [blk, key] = path.split('.');
    const block = P.CONSTANTS[blk];
    if (!block || typeof block !== 'object' || !(key in block)) {
      out.push(`limitation ${n} says it explains ${path}, which is not a shipped constant`);
    } else if (!block.flag) {
      out.push(`limitation ${n} says it explains ${path}, whose block ships no flag`);
    }
  }
  let doc = null;
  try { doc = readFileSync(resolve(ROOT, 'docs/METHODOLOGY.md'), 'utf8'); } catch (err) {
    return [`METHODOLOGY.md is unreadable, so the register cannot be checked: ${err.message}`];
  }
  // the numbered entry must exist in §10's list, and the shipped sentence must be inside IT
  const head = new RegExp(`^${n}\\. \\*\\*`, 'm').exec(doc);
  if (!head) { out.push(`METHODOLOGY §10 has no entry ${n}`); return out; }
  const rest = doc.slice(head.index + head[0].length);
  const nxt = /^\d+\. \*\*/m.exec(rest);
  const block = nxt ? rest.slice(0, nxt.index) : rest;
  // WHITESPACE-NORMALISED, and only whitespace. METHODOLOGY is hard-wrapped at 100 columns and its
  // list items are indented, so the same sentence is one string here and four lines with leading
  // spaces there. Collapsing runs of whitespace to a single space on BOTH sides compares the words
  // and the punctuation exactly — every character that carries meaning — while letting the document
  // stay wrapped the way the rest of it is. Nothing else is normalised: no case folding, no
  // punctuation stripping, so a changed word or a moved comma still fails.
  const flat = (t) => t.replace(/\s+/g, ' ');
  if (e.note && flat(block).indexOf(flat(e.note)) < 0) {
    out.push(`limitation ${n}'s shipped note does not appear verbatim under METHODOLOGY.md entry ${n} — `
      + `the page and the document have drifted; fix BOTH, never one`);
  }
  return out;
}

/**
 * THE FLAG'S OWN THREE LEGS, asserted rather than assumed — V3-PLAN §6's "flagged" idiom is
 * "named in `constants`, labeled in the Method view, and bounded by a gate", and the P1 red team
 * found the first two legs unenforced on every flag in this lane: `constants.rake.flag` and
 * `constants.sizing.flag` could each be emptied or deleted with 52 gates, 436 tests and a clean
 * rebuild all green, at which point `stampConstants` republishes the block without the admission
 * and the Method view silently loses the sentence that legitimises the number.
 *
 * @param {string} blk        the constants block that carries the flag
 * @param {string[]} names    substrings the flag must contain — the constants it flags, and the gate
 * @param {string[]} badged   dotted constant paths that must carry the Method view's `estimate` badge
 */
function flagProblems(blk, names, badged) {
  const out = [];
  const flag = (P.CONSTANTS[blk] || {}).flag;
  if (typeof flag !== 'string' || flag.length < 60) {
    out.push(`constants.${blk}.flag is missing or a stub — the admission that legitimises this block is not shipped`);
  } else {
    for (const nm of names) if (flag.indexOf(nm) < 0) out.push(`constants.${blk}.flag does not name ${nm}`);
  }
  // THE BADGE LEG. The Method view renders `constants` generically, so before this clause a flagged
  // number rendered as an ordinary field, indistinguishable from an anchored one. `UNANCHORED` in
  // src/shell.html is the map that gives it the `estimate` tag; a flagged path missing from it is a
  // number the page presents as if it were checked.
  let shell = null;
  try { shell = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8'); } catch (err) {
    return out.concat(`src/shell.html is unreadable, so the badge cannot be checked: ${err.message}`);
  }
  const map = /var UNANCHORED = \{([^}]*)\}/.exec(shell);
  if (!map) {
    out.push('src/shell.html no longer carries the UNANCHORED badge map — every flagged constant would render unbadged');
    return out;
  }
  for (const path of badged) {
    if (map[1].indexOf(`'${path}'`) < 0) out.push(`${path} is flagged but not badged in the Method view`);
  }
  return out;
}

export function build(ctx) {
  const { model, fast, G } = ctx;

  return {
    sections: [

    // =========================================================================
    // I41 — the rake-depth coupling (V3-PLAN item 6, brief §5.3)
    // =========================================================================
    { ids: ['I41'], label: 'rake-depth: the knee identity and the price across the slider', run: () => {
      // brief §5.3 records the defect in one line: `rakeFrac` is 0.0500 at 40bb, at 100bb and at
      // 250bb — "the model says a 250bb game is raked at the same 5% as a 40bb game". Preflop pot
      // sizes genuinely do not scale with depth, but the CAP is measured against the final pot and
      // the final pot does, so the fix is to scale the reference pot: potBB(d) = 60*(d/100)^potScale.
      //
      // THE ANCHOR IS THE KNEE AND IT IS AN IDENTITY, NOT A FIT. 3/0.05 = 60 is the existing
      // constant, and the ratio is 1 at d = 100, so the coupled pot IS the flat pot at the v1
      // operating depth — in BOTH straddle states, which is the clause that matters, because it is
      // what leaves I32's four 100bb lanes untouched. brief §5.3 calls that "a strong signal it is
      // the natural completion of the constant rather than a bolt-on" and this gate is where that
      // stops being rhetoric.
      //
      // `potScale` IS THE ONE NEW OPINION AND THIS GATE IS ITS BOUND, not its justification. 1 is
      // linear — "the final pot scales with the effective stack" — which is true when the money
      // goes in and progressively less true when it does not. Nothing in this repository measures
      // how often a deep pot plays for stacks (that is limitation 16's hole, exactly), so the
      // constant ships FLAGGED in `constants.rake.flag` and bounded here.
      const R = P.CONSTANTS.rake, D = P.CONSTANTS.depth, K = P.CONSTANTS.vs3bet;
      const bad = [];
      const on = (d, straddle, rakePct = R.preset) => P.rakeFraction({ d, straddle, rakePct, rakeDepth: true });
      const off = (d, straddle, rakePct = R.preset) => P.rakeFraction({ d, straddle, rakePct });

      // (a) THE KNEE IDENTITY. At the reference depth the coupling changes nothing at all, at any
      // rake percentage, in either straddle state — and it is `===`, not a tolerance, because the
      // branch in sealEnv returns `R.potBB` itself rather than `R.potBB * Math.pow(1, s)`.
      for (const straddle of [false, true]) {
        for (const rakePct of [0, 1, 2, R.preset, R.max]) {
          if (on(D.ref, straddle, rakePct) !== off(D.ref, straddle, rakePct)) {
            bad.push(`knee r${rakePct}${straddle ? ' straddled' : ''}: ${on(D.ref, straddle, rakePct)} vs ${off(D.ref, straddle, rakePct)}`);
          }
        }
        if (P.rakePotBB({ d: D.ref, straddle, rakeDepth: true }) !== R.potBB) bad.push(`rakePotBB(100)${straddle ? ' straddled' : ''} is not potBB`);
      }
      const kneeFrac = on(D.ref, false);
      if (kneeFrac !== R.capBB / R.potBB) bad.push('the 5% preset no longer sits on the cap knee at 100bb');

      // (b) THE 250bb READING, the number brief §5.3 predicted before the code existed.
      const deepFrac = on(D.max, false);
      if (Math.abs(deepFrac - 0.02) > 1e-15) bad.push(`rakeFrac(250) = ${deepFrac} != 2.00%`);
      const priceRef = P.breakevenPrice({ d: D.ref, rakePct: R.preset, rakeDepth: true });
      const priceDeep = P.breakevenPrice({ d: D.max, rakePct: R.preset, rakeDepth: true });
      if (priceRef.toFixed(4) !== '0.3053') bad.push(`price(100) = ${priceRef.toFixed(4)} != 0.3053`);
      if (priceDeep.toFixed(4) !== '0.2959') bad.push(`price(250) = ${priceDeep.toFixed(4)} != 0.2959`);

      // (c) MONOTONE IN DEPTH — non-increasing, and the flat stretch below the knee is part of the
      // claim rather than a defect: shallower than 100bb the reference pot is small enough that the
      // CAP stops binding and the house simply takes its percentage, so the fraction cannot fall
      // further. The model has a floor and it is the lobby's own percentage.
      let prev = Infinity, flat = 0, falls = 0;
      for (const d of DGRID) {
        const f = on(d, false);
        if (f > prev + 1e-18) bad.push(`not monotone at d=${d}: ${f} > ${prev}`);
        else if (f === prev) flat++; else if (prev !== Infinity) falls++;
        prev = f;
      }

      // (d) THE ARITHMETIC, RECOMPUTED INDEPENDENTLY, including the straddle-doubled cap unit.
      // The straddle's whole effect on this quantity is the `* unit` on the denominator (§5.3), and
      // the coupling must not double-count it: the scale reads the RAW depth, so a straddled game
      // at 100bb still reaches the cap at 2.5% and not 5%. Measured the other way during
      // development — reading `dEff` moves lane d100/r5/s1 from 2.500% to 5.000%, which is an I32
      // failure and a wrong answer about money.
      let worst = 0;
      for (const d of DGRID) {
        for (const straddle of [false, true]) {
          for (const rakePct of [0, 1, 2, R.preset, R.max]) {
            for (const cap of [R.capBB, 1, 10]) {
              const unit = straddle ? P.CONSTANTS.straddle.unit : 1;
              const pot = R.potBB * Math.pow(d / D.ref, R.potScale);
              const want = rakePct <= 0 ? 0 : Math.min(rakePct / 100, cap / (pot * unit));
              const got = P.rakeFraction({ d, straddle, rakePct, rakeCapBB: cap, rakeDepth: true });
              const dev = Math.abs(got - want);
              if (dev > worst) worst = dev;
              if (dev > 1e-15) bad.push(`arith d${d} r${rakePct} cap${cap}${straddle ? ' str' : ''}`);
            }
          }
        }
      }
      const strRef = on(D.ref, true), strDeep = on(D.max, true), strShallow = on(D.min, true);

      // (e) INERT WHEN OFF, bit for bit, over the whole surface — the half that keeps I32 green.
      let offBad = 0;
      for (const d of DGRID) for (const straddle of [false, true]) for (const rakePct of [0, 2, R.preset, R.max]) {
        const unit = straddle ? P.CONSTANTS.straddle.unit : 1;
        const legacy = rakePct <= 0 ? 0 : Math.min(rakePct / 100, R.capBB / (R.potBB * unit));
        if (P.rakeFraction({ d, straddle, rakePct }) !== legacy) offBad++;
      }
      if (offBad) bad.push(`${offBad} settings move with the coupling OFF — the axis is not inert`);

      // (f) THE FLAG'S REASON IS PUBLISHED, not merely believed. `potScale` is unanchorable because
      // the measurement layer cannot say how often a deep pot plays for stacks — which is
      // METHODOLOGY §10's limitation 16. This clause asserts that limitation exists, in the
      // document AND in the shipped data, byte-for-byte the same sentence.
      const lim16 = limitationProblems(16);
      bad.push(...lim16);

      // (g) THE FLAG AND THE FORMULA ARE THEMSELVES BOUNDED — the P1 red team's two findings on this
      // constant, closed in the idiom clause (f) already owns.
      //
      // THE FLAG. Three refuters deleted `constants.rake.flag` outright and watched 52 gates, 436
      // tests and a clean rebuild all pass, with `stampConstants` then republishing the rake block
      // WITHOUT the admission — so the page lost the sentence that legitimises `potScale` and
      // nothing noticed. Of gated + flagged + badged, only "gated" was real. The flag must exist,
      // must name the constant it flags and the gate that bounds it, and `potScale` must carry the
      // Method view's `estimate` badge rather than rendering like an anchored field.
      bad.push(...flagProblems('rake', ['potScale', 'I41'], ['rake.potScale']));
      // THE FORMULA STRING. `potBBAt` is rendered by the Method view under "Constants (rendered from
      // the shipped data)" and was read by nothing: refuters replaced it with 'potBB*(d/40)^7',
      // 'potBB*(100/d)^2' and 'ANYTHING AT ALL' and the tree stayed green, so the page could publish
      // one formula while this gate narrated another in the terminal. It is now asserted
      // character-for-character against a spelling COMPOSED FROM `depth.ref`, which closes the
      // second half of the finding too — the literal 100 in the string would have become a lie the
      // day the reference depth moved, with nothing firing.
      const wantPotBBAt = `potBB*(d/${D.ref})^potScale`;
      if (R.potBBAt !== wantPotBBAt) {
        bad.push(`rake.potBBAt reads "${R.potBBAt}" but the coupling computes "${wantPotBBAt}" — `
          + `the Method view would publish a formula the model does not run`);
      }

      G('I41', bad.length === 0,
        `rake-depth coupling (V3-PLAN item 6, brief §5.3), potBB(d) = ${R.potBB}*(d/${D.ref})^${R.potScale}. ` +
        `(a) THE KNEE IS AN IDENTITY, not a fit: 3/0.05 = ${R.potBB} is the existing constant, the ratio is 1 at ` +
        `${D.ref}bb, and rakeFrac is === its uncoupled value there at every rake percentage in BOTH straddle ` +
        `states (${(kneeFrac * 100).toFixed(2)}% unstraddled, ${(strRef * 100).toFixed(2)}% straddled) — which is ` +
        `what leaves I32's four ${D.ref}bb lanes untouched. (b) the 250bb reading brief §5.3 predicted before this ` +
        `code existed: rakeFrac ${(kneeFrac * 100).toFixed(2)}% -> ${(deepFrac * 100).toFixed(2)}%, vs-3-bet price ` +
        `${(priceRef * 100).toFixed(2)}% -> ${(priceDeep * 100).toFixed(2)}%. (c) monotone non-increasing over ` +
        `d = ${DGRID.join('/')}: ${falls} falling steps and ${flat} flat, and the flat stretch is the CLAIM — ` +
        `below the knee the reference pot is small enough that the cap stops binding and the house just takes its ` +
        `percentage, so the fraction has a floor and it is the lobby's own rate. (d) the arithmetic recomputed ` +
        `independently over ${DGRID.length}x2x5x3 settings, worst deviation ${worst.toExponential(1)}, INCLUDING ` +
        `the straddle-doubled cap unit: straddled the fraction is ${(strShallow * 100).toFixed(2)}% / ` +
        `${(strRef * 100).toFixed(2)}% / ${(strDeep * 100).toFixed(2)}% at 40/100/250, because the scale reads the ` +
        `RAW depth and the straddle's whole effect here is the doubled unit — reading dEff instead double-counts ` +
        `it and moves lane d100/r5/s1 to 5.00%. (e) with the axis OFF every one of those settings is bit-identical ` +
        `to the flat-potBB value, which is how this lands beside a green I32. THE FLAG: potScale is the one new ` +
        `opinion in item 6 — linear is a modeling choice about how often a deep pot plays for stacks, and nothing ` +
        `here measures that (limitation 16's hole). It ships in constants.rake.flag and this gate is its bound. ` +
        `(f) AND THAT REASON IS PUBLISHED RATHER THAN BELIEVED: METHODOLOGY §10 limitation 16 ships as ` +
        `constants.limitations[0] and renders in the Method view from the shipped data, and its sentence is ` +
        `byte-compared against docs/METHODOLOGY.md here — the grep-gate idiom, so the page and the document ` +
        `cannot carry two versions of the same admission — and the search is SCOPED to entry 16's own ` +
        `block, so a note filed under the wrong number fails too. (g) THE OTHER TWO LEGS OF "FLAGGED", ` +
        `after the P1 red team found both unenforced (docs/refutations/P1.md): constants.rake.flag must ` +
        `exist and must name both potScale and this gate — deleting it used to leave everything green ` +
        `while the artifact shipped the exponent with no admission attached — and potScale must carry ` +
        `the Method view's ESTIMATE badge, so a bounded number cannot render like an anchored one. The ` +
        `formula string is bounded the same way: potBBAt is asserted character-for-character against ` +
        `"${wantPotBBAt}", composed from depth.ref rather than a hard-coded 100, because a page that ` +
        `publishes its own arithmetic must publish the arithmetic it runs` +
        (bad.length ? ` — FAILS: ${bad.slice(0, 4).join('; ')}` : ''));
    } },

    // =========================================================================
    // I42 — the depth->width factor (V3-PLAN item 6b, brief §5.4)
    // =========================================================================
    { ids: ['I42'], label: 'depth-width: the free anchor, exactly', run: () => {
      // brief §5.1 is the defect: `widthFor` reads `env` only through the straddle factor, so depth
      // cannot change how many hands you open — CO RFI paints a 28.13% target at 40, 100 and 250bb
      // alike. brief §5.4 is the fix, and its whole point is that it costs NOTHING: `baseRealization`
      // already moves with depth through `beta`, which is already in the model and already gated by
      // I23(f), so the ratio of a seat's realization at d to its realization at the reference IS a
      // signed, seat-dependent width factor with no new constant behind it.
      //
      // THIS GATE'S FIRST CLAUSE IS AN EXACTNESS CLAIM IN THE I26(f) IDIOM, and it is stated as a
      // PRODUCT rather than a quotient on purpose. `(w*g)/w` is not `g` in IEEE-754, so a ratio
      // claim could only ever be a 1e-15 tolerance; `w*g` is exactly `w*g`, so the composition is
      // asserted with `===` and the identity is bit-for-bit rather than nearly.
      const D = P.CONSTANTS.depth;
      const bad = [];
      let exChecks = 0;

      // (a) EXACTNESS, both halves.
      for (const pos of P.POSITIONS) {
        for (const node of NODES3) {
          if (P.positionDisabled(pos, node)) continue;
          for (const v of [0.25, 0.55, 0.90]) {
            for (const d of DGRID) {
              for (const straddle of [false, true]) {
                const e = { d, straddle, depthWidth: true };
                const g = P.depthWidthFactor(pos, e);
                const wRef = P.widthFor(pos, node, v, { straddle });
                const wD = P.widthFor(pos, node, v, e);
                exChecks++;
                if (wD !== (g === 1 ? wRef : wRef * g)) bad.push(`product ${pos}/${node}/v${v}/d${d}${straddle ? '/str' : ''}`);
                const dEff = P.envOf(e).dEff;
                const want = dEff === D.ref ? 1 : P.baseRealization(pos, dEff) / P.baseRealization(pos, D.ref);
                if (g !== want) bad.push(`ratio ${pos} d${d}${straddle ? ' str' : ''}`);
              }
            }
          }
        }
      }

      // (b) THE SEAT SIGNS, on TARGET width, exactly. brief §5.4: deep tightens the blinds and the
      // early seats and LOOSENS CO/BTN, because position compounds when there is money behind.
      // Asserted on target width because target width is a deterministic function of the factor;
      // the painted reading is clause (c), where granularity gets a vote.
      const signOK = [];
      const factorAt = {};
      for (const pos of P.POSITIONS) {
        const deep = P.depthWidthFactor(pos, { d: D.max, depthWidth: true });
        const shal = P.depthWidthFactor(pos, { d: D.min, depthWidth: true });
        factorAt[pos] = { deep, shal };
        const wantLoose = P.CONSTANTS.baseR[pos] > 1;   // the sign is baseR's own, and nothing else
        if ((deep > 1) !== wantLoose) bad.push(`seat sign deep ${pos}: factor ${deep}`);
        if ((shal < 1) !== wantLoose) bad.push(`seat sign shallow ${pos}: factor ${shal}`);
        signOK.push(`${pos} ${deep.toFixed(4)}`);
        // and every node's target width carries that sign, at every VPIP
        for (const node of NODES3) {
          if (P.positionDisabled(pos, node)) continue;
          for (const vp of VPIP_GRID) {
            const w0 = P.widthFor(pos, node, vp / 100, { depthWidth: true });
            const w1 = P.widthFor(pos, node, vp / 100, { d: D.max, depthWidth: true });
            if ((w1 > w0) !== wantLoose) bad.push(`target sign ${pos}/${node}@${vp}`);
          }
        }
      }

      // (c) THE PAINTED READING, differenced against the SAME setting with the axis off. That
      // control is what makes the claim about the AXIS: painted width already drifts with depth
      // through M_deep and through cells crossing a fixed percentile cut (I23(d) measures 3.16 pts
      // of exactly that), so an undifferenced painted comparison measures the re-sort, not the
      // factor. Differenced, the factor's own contribution is visible — and it is visible only at
      // the four seats whose factor moves further than a cell is wide. UTG and HJ are 0.9894 and
      // 0.9965 deep, about a third of a percent on a 16-20% range, which is under the granularity
      // I16 and I21 both document; they are REPORTED, not asserted, and that is the honest scope.
      const seatDelta = {};
      for (const pos of P.POSITIONS) seatDelta[pos] = { deep: 0, shal: 0, n: 0 };
      let driftOn = 0, driftAt = '', minPainted = 1, minAt = '';
      for (const node of NODES3) {
        for (const pos of P.POSITIONS) {
          if (P.positionDisabled(pos, node)) continue;
          for (const vp of VPIP_GRID) {
            const st = { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' };
            const refOn = P.solve(model, { ...st, depthWidth: true }).width;
            const refOff = P.solve(model, st).width;
            const s = seatDelta[pos];
            for (const [k, d] of [['deep', D.max], ['shal', D.min]]) {
              const onW = P.solve(model, { ...st, d, depthWidth: true }).width;
              const offW = P.solve(model, { ...st, d }).width;
              s[k] += (onW - refOn) - (offW - refOff);
            }
            s.n++;
            // the re-measured allowance: painted drift from the 100bb value, with the axis ON
            for (const d of DGRID) {
              const w = P.solve(model, { ...st, d, depthWidth: true }).width;
              if (Math.abs(w - refOn) > driftOn) { driftOn = Math.abs(w - refOn); driftAt = `${node}/${pos}@${vp} d${d}`; }
              if (node !== 'raise' && w < minPainted) { minPainted = w; minAt = `${node}/${pos}@${vp} d${d}`; }
            }
          }
        }
      }
      const strong = ['CO', 'BTN', 'SB', 'BB'];         // |factor - 1| > 1 pt at 250bb
      const weak = ['UTG', 'HJ'];
      const painted = [];
      for (const pos of P.POSITIONS) {
        const s = seatDelta[pos];
        s.deep /= s.n; s.shal /= s.n;
        painted.push(`${pos} ${(s.deep * 100 >= 0 ? '+' : '')}${(s.deep * 100).toFixed(3)}`);
        if (strong.indexOf(pos) < 0) continue;
        const wantLoose = P.CONSTANTS.baseR[pos] > 1;
        if ((s.deep > 0) !== wantLoose) bad.push(`painted sign deep ${pos}: ${(s.deep * 100).toFixed(3)} pts`);
        if ((s.shal < 0) !== wantLoose) bad.push(`painted sign shallow ${pos}: ${(s.shal * 100).toFixed(3)} pts`);
      }

      // (d) THE COMPOUNDING ALLOWANCE, RE-MEASURED — V3-PLAN §7.2's own words, and §6's rule that
      // the allowances this factor forces are "re-measured, not authored". I23(d) caps painted drift
      // across depth with the axis off (measured 3.16). With the axis ON the factor and M_deep
      // compound and the worst event grows; the number below is the measurement. It is recorded
      // HERE rather than by relaxing I23, because I23 sweeps the legacy lane and must keep asserting
      // the legacy number until B1 flips the default.
      //
      // MEASURED (P5) — RE-MEASURED, ONE PIN MOVES AND ONE STANDS. §3.5 asks P5 to re-measure every
      // allowance re-pinned during P1-P4; this clause was already written to that discipline, so
      // what P5 owes it is a check rather than a correction. Re-measured on the shipped model over
      // this gate's own eight-depth sweep with the axis ON:
      //
      //     driftOn      4.787146 pts at rfi/BTN@90 d40   ceiling  5.5 STANDS (+14.9%)
      //     minPainted  12.612060 pts at rfi/UTG@25 d40   floor   10.0 -> 10.70 (-15.2%)
      //
      // THE CEILING STANDS AND IS NOW THE ANCHOR FOR THE OTHER THREE. Its stated derivation was
      // "that measurement plus I28's own ~15% margin" — the ~15% was right about THIS pin and wrong
      // about I28, which ran at +19.3%. P5 resolved that by keeping the number and fixing the
      // sentence: 5.5 against 4.787146 is +14.89%, the TIGHTEST margin any allowance in this
      // repository runs at, and ./_shared.mjs's P5_MARGIN adopts exactly it — so I23(d), I28 and
      // I30 have all been re-pinned ONTO the margin this clause was already keeping. The
      // measurement is unchanged to six decimal places from the P1 reading, so nothing here is a
      // finding.
      //
      // THE FLOOR MOVES, because it was the one borrowed number left in this clause: 10% was I12's,
      // sized on I12's own reference-depth sweep and never divided by the measurement standing
      // beside it. Re-pinned to 10.70 alongside I23(d)'s, which reads the same 12.612060 pts at the
      // same cell — the axis LOOSENS UTG at 40 bb, so the narrowest painted range with it on is the
      // narrowest with it off, and the two clauses can share one number honestly.
      //
      // The fast lane's 7.5 / 8.0 are NOT re-pinned, for the reason I23(d) and I28 give: they are
      // noise allowances for a 10k-trial model, measured at P5 (3.72 pts drift, 12.73% narrowest)
      // and left where they are rather than tightened onto a single Monte Carlo draw.
      const allowOn = fast ? 0.075 : 0.055;      // 4.787146 pts measured; 5.5 STANDS at +14.89%, the P5 anchor
      if (driftOn > allowOn) bad.push(`painted drift ${(driftOn * 100).toFixed(2)} pts at ${driftAt} over the re-measured allowance ${(allowOn * 100).toFixed(1)}`);
      const floorPainted = fast ? 0.08 : 0.107;  // 12.612060 pts measured -> 10.70 (was I12's borrowed 10.0)
      if (minPainted < floorPainted) bad.push(`painted range collapses to ${(minPainted * 100).toFixed(1)}% at ${minAt}`);

      // (e) INERT WHEN OFF, bit for bit.
      let offBad = 0, offN = 0;
      for (const pos of P.POSITIONS) for (const node of NODES3) {
        if (P.positionDisabled(pos, node)) continue;
        for (const v of [0.25, 0.55, 0.90]) for (const d of DGRID) for (const straddle of [false, true]) {
          offN++;
          if (P.widthFor(pos, node, v, { d, straddle }) !== P.widthFor(pos, node, v, { straddle })) offBad++;
          if (P.depthWidthFactor(pos, { d, straddle }) !== 1) offBad++;
        }
      }
      if (offBad) bad.push(`${offBad} of ${offN} widths move with the axis OFF — depth is leaking into widthFor`);

      // (f) THE DEFECT THIS HALF-CLOSES IS PUBLISHED. A factor that lets depth reach `widthFor` is
      // only half of limitation 17 — the other three quarters of the model still cut percentiles —
      // so the limitation has to exist and stay published, in the document and in the shipped data.
      const lim17 = limitationProblems(17);
      bad.push(...lim17);

      // (g) THE FORMULA STRING IS BOUNDED TOO, in the same idiom clause (f) already owns, and the
      // asymmetry the P1 red team named is the argument: this file spent thirty lines byte-comparing
      // the limitation NOTES against METHODOLOGY.md and nothing at all on the formula strings that
      // make arithmetic claims about the code standing beside them. `depth.widthRatio` renders in
      // the Method view under "Constants (rendered from the shipped data)" and was read by nothing —
      // refuters replaced it with 'sqrt(beta)*log(d) -- NONSENSE' and with the ratio inverted and
      // squared, and all 52 gates stayed green while the page published a formula this very clause
      // proves the code does not run. Composed from `depth.ref` rather than a literal 100, so the
      // string cannot go quietly false the day the reference depth moves.
      const wantWidthRatio = `baseRealization(pos,d)/baseRealization(pos,${D.ref})`;
      if (D.widthRatio !== wantWidthRatio) {
        bad.push(`depth.widthRatio reads "${D.widthRatio}" but clause (a) proves the code computes `
          + `"${wantWidthRatio}" — the Method view would publish a formula the model does not run`);
      }

      G('I42', bad.length === 0,
        `depth->width factor (V3-PLAN item 6b, brief §5.4) — ZERO NEW OPINION: it is ` +
        `baseRealization(pos,d)/baseRealization(pos,${D.ref}), the ratio beta already implies and I23(f) ` +
        `already gates. (a) EXACT, in the I26(f) idiom and stated as a PRODUCT so it is bit-for-bit rather than ` +
        `1e-15: widthFor(deep) === widthFor(ref) * factor, and factor === the realization ratio, over ` +
        `${exChecks} (seat, node, VPIP, depth, straddle) combinations with 0 deviations. Written as a quotient ` +
        `it could only be a tolerance — the two algebraically equal forms differ by 1 ulp at HJ and BB. ` +
        `(b) THE SEAT SIGNS ARE brief §5.4's, asserted on target width where they are deterministic, at 250bb: ` +
        `${signOK.join(' ')} — blinds and early seats TIGHTEN deep, CO/BTN LOOSEN, and the sign is baseR's own ` +
        `(above 1 loosens, below 1 tightens), so it cannot be tuned. Every node and VPIP carries it. ` +
        `(c) painted width, DIFFERENCED against the same setting with the axis off so the granularity drift ` +
        `I23(d) measures cancels and what is left is the factor: ${painted.join(' ')} pts at 250bb. Asserted at ` +
        `${strong.join('/')}, whose factors move further than a cell is wide; REPORTED and not asserted at ` +
        `${weak.join('/')} (0.9894 / 0.9965 — about a third of a point on a 16-20% range, under the granularity ` +
        `I16 and I21 both document). (d) the compounding allowance is RE-MEASURED, not authored (§6): with the ` +
        `axis ON the worst painted drift from the ${D.ref}bb value is ${(driftOn * 100).toFixed(2)} pts at ` +
        `${driftAt} against I23(d)'s 3.16 with it off, and the allowance is ${(allowOn * 100).toFixed(1)} — that ` +
        `measurement +${overPct(allowOn, driftOn).toFixed(1)}%, divided here rather than quoted. ` +
        (fast ? 'The 10k-trial lane keeps its noise allowances and was NOT re-pinned at P5. '
          : `RE-MEASURED AT P5 (V3-PLAN §3.5) AND THE CEILING STANDS: this margin is the TIGHTEST any ` +
            `allowance in the repository runs at, so P5 adopted it as the shared idiom and re-pinned I23(d), ` +
            `I28 and I30 ONTO it rather than moving this one — a re-pin may tighten and never widen. `) +
        `The painted range never falls below ` +
        `${(minPainted * 100).toFixed(1)}% (${minAt}, floor ${(floorPainted * 100).toFixed(2)}%` +
        `${fast ? '' : `, RE-PINNED AT P5 from I12's borrowed 10% to that measurement ` +
          `-${underPct(floorPainted, minPainted).toFixed(1)}% — the last authored number in this clause`}). ` +
        `I23(d) keeps its own legacy sweep because I23 sweeps the legacy lane; the two now read the same ` +
        `narrowest cell and carry the same floor. (e) with the axis ` +
        `OFF all ${offN} widths are bit-identical and the factor is exactly 1 — depth does not reach widthFor, ` +
        `which is the defect brief §5.1 names. (f) that defect is PUBLISHED and stays published: METHODOLOGY §10 ` +
        `limitation 17 ships as constants.limitations[1], renders in the Method view from the shipped data, and ` +
        `its sentence is byte-compared against docs/METHODOLOGY.md here. This factor half-closes it — the other ` +
        `three quarters of the model still cut percentiles, and the absolute-EV cut is the named structural fix ` +
        `— and the search is SCOPED to entry 17's own block, so a note filed under the wrong number fails too. ` +
        `(g) THE FORMULA STRING CARRIES THE SAME BOUND AS THE NOTES, which is the asymmetry the P1 red team ` +
        `named: depth.widthRatio is asserted character-for-character against "${wantWidthRatio}", composed from ` +
        `depth.ref rather than a hard-coded ${D.ref}. It renders in the Method view and was read by nothing, so ` +
        `the page could publish a formula that clause (a) proves the code does not run` +
        (bad.length ? ` — FAILS: ${bad.slice(0, 4).join('; ')}` : ''));
    } },

    // =========================================================================
    // I43 — the villain profile, ON (V3-PLAN item 8)
    // =========================================================================
    { ids: ['I43'], label: 'villain profile-ON: the machinery, with the library default still OFF', run: () => {
      // METHODOLOGY §10.1's remaining half: the lattice is measured and shipped, and the tiers are
      // still cut from random-opponent equities. `scripts/lib/tier-fixture-v2.mjs` records exactly
      // why no gate could see it — "the villain profile reaches tiers through `villainEq`, which the
      // page calls and `solve` does not". So the shadow-model construction has been hoisted out of
      // `src/shell.html` into `policy.mjs` (`profiledModel`), and this gate is what that hoist was
      // for. THE LIBRARY DEFAULT IS STILL OFF: `villainProfileOf` treats anything without `on: true`
      // as OFF and every caller in this repository still passes nothing. B1 has since performed §5.1's
      // ceremony and flipped the PAGE's initial state — a different object entirely, and clause (e)
      // below is what stops the two ever being confused for one another.
      const bad = [];
      const V = (model.constants && model.constants.villainLattice) || {};
      const pts = V.v || [];

      // (a) OFF IS OBJECT IDENTITY — `assert.equal`, never `deepEqual`. A deep-equal copy satisfies
      // a value check and is still a different object under the solve memo, which is the failure
      // mode rather than the symptom.
      for (const p of [null, undefined, false, {}, { on: false }, P.VILLAIN_OFF, { on: false, v: 55, q: 0.85 }]) {
        if (P.profiledModel(model, p) !== model) bad.push(`OFF is not object identity for ${JSON.stringify(p)}`);
        if (P.villainKey(p, model) !== 'OFF') bad.push(`villainKey is not 'OFF' for ${JSON.stringify(p)}`);
      }
      // and an off-lattice discipline is ALSO the model itself: the accessor refuses to interpolate
      // an axis with one measurement on it, so the profile is on and nothing has moved. The honest
      // representation of that is the model, not a hash-shifted twin of it.
      if (pts.length && V.discipline != null && P.profiledModel(model, { on: true, v: pts[0], q: V.discipline / 2 }) !== model) {
        bad.push('an off-lattice q does not fall back to the model itself');
      }

      // (b) THE LOAD DEFAULT: v is a LATTICE POINT and q IS the shipped discipline, so every tier at
      // load is cut from a MEASURED row and zero cells are labelled `interpolated`. A default landing
      // between lattice points would open the page on interpolated numbers under a measured-looking
      // grid — which is the whole reason this clause exists rather than "the default is on".
      const def = P.villainLoadDefault(model);
      if (!def.on) bad.push('there is no load default — the lattice is missing from the shipped constants');
      if (pts.indexOf(def.v) < 0) bad.push(`the load default v=${def.v} is not a lattice point (${pts.join('/')})`);
      if (def.q !== V.discipline) bad.push(`the load default q=${def.q} is not the shipped discipline ${V.discipline}`);
      const shadow = P.profiledModel(model, def);
      if (shadow === model) bad.push('the load default moved nothing — the profile would be a no-op');
      let latt = 0, interp = 0, unmoved = 0, live = 0;
      for (const k of Object.keys(shadow.cells)) {
        const c = shadow.cells[k];
        if (!c.combos) continue;
        live++;
        if (c.vpSource === 'lattice') latt++;
        else if (c.vpSource === 'interpolated') interp++;
        else unmoved++;
      }
      if (interp !== 0) bad.push(`${interp} cells are interpolated at the load default`);
      if (latt !== live) bad.push(`${live - latt} of ${live} live cells are not cut from a measured row at load`);
      // the contrast, so the clause is not vacuous: OFF the lattice, every cell IS interpolated
      let offLatticeInterp = 0;
      if (pts.length > 1) {
        const mid = (pts[0] + pts[1]) / 2;
        const sh2 = P.profiledModel(model, { on: true, v: mid, q: V.discipline });
        for (const k of Object.keys(sh2.cells)) if (sh2.cells[k].vpSource === 'interpolated') offLatticeInterp++;
      }
      if (!offLatticeInterp) bad.push('an off-lattice v produces no interpolated cells — the label is dead');

      // (c) THE SHADOW MUST NOT BE HANDED THE UNPROFILED ANSWER. `solve` keys its memo on the first
      // eight characters of `meta.hash`, so a shadow wearing the real hash is a silent wrong number.
      // Verified by INTERLEAVING, which is what catches a memo that was warm from the other model.
      if (shadow.meta.hash.slice(0, 8) === model.meta.hash.slice(0, 8)) bad.push('the shadow wears the shipped hash prefix');
      {
        const st = { pos: 'CO', node: 'rfi', v: 0.55, limpers: 2, raiserPos: 'CO' };
        const a1 = P.solve(model, st), b1 = P.solve(shadow, st), a2 = P.solve(model, st), b2 = P.solve(shadow, st);
        const key = 'RUN2|DS';
        if (a1.cells[key].score !== a2.cells[key].score) bad.push('the unprofiled solve is not stable under interleaving');
        if (b1.cells[key].score !== b2.cells[key].score) bad.push('the profiled solve is not stable under interleaving');
        if (a1.cells[key].score === b1.cells[key].score) bad.push('profiled and unprofiled scores agree — the profile is not reaching solve');
      }

      // (d) I6 / I7 / I8 / I13 / I19 RE-RUN UNDER ON, at every lattice point rather than only at the
      // load default: the load default is where B1 opens the page, and the user may move it anywhere.
      const struct = [];
      const vs = fast ? [def.v] : pts;
      for (const pv of vs) {
        const m = P.profiledModel(model, { on: true, v: pv, q: V.discipline });
        for (const node of ['rfi', 'limps', 'raise', '3bet']) {
          for (const pos of P.POSITIONS) {
            if (P.positionDisabled(pos, node)) continue;
            for (const vp of VPIP_GRID) {
              const s = P.solve(m, { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' });
              const at = `v${pv} ${node}/${pos}@${vp}`;
              if (s.cells['AA_BIGPAIR|DS'].tier !== 'T1') struct.push(`I7 ${at}`);
              for (const k of ['TRASH|RB', 'TRIPS_SMALL|RB']) if (['T1', 'T2'].includes(s.cells[k].tier)) struct.push(`I8 ${k} ${at}`);
              if (node !== '3bet' && Object.values(s.composition).reduce((a, b) => a + b, 0) !== TOTAL) struct.push(`I13 ${at}`);
              if (vp === model.meta.vpip.ref && node !== '3bet' && Object.keys(s.cells).some((k) => s.cells[k].tier === 'T2')) struct.push(`I19 ${at}`);
              for (const row of ROW_ORDER) {
                let prev = null;
                for (const col of COL_ORDER) {
                  const e = s.cells[row + '|' + col];
                  if (!e) continue;
                  if (prev && P.TIER_RANK[e.wouldBe] < P.TIER_RANK[prev]) struct.push(`I9 ${at} ${row}x${col}`);
                  prev = e.wouldBe;
                }
              }
            }
          }
          if (node === '3bet') continue;
          const chain = node === 'rfi' ? ['UTG', 'HJ', 'CO', 'BTN'] : ['HJ', 'CO', 'BTN'];
          for (const vp of VPIP_GRID) {
            const inRange = (e) => e.tier === 'T1' || e.tier === 'T2' || (e.tier === 'T4' && (e.wouldBe === 'T1' || e.wouldBe === 'T2'));
            const sets = chain.map((pos) => {
              const s = P.solve(m, { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' });
              return new Set(Object.keys(s.cells).filter((k) => inRange(s.cells[k])));
            });
            for (let i = 1; i < sets.length; i++) for (const k of sets[i - 1]) if (!sets[i].has(k)) struct.push(`I6 v${pv} ${node}@${vp} ${chain[i - 1]}->${chain[i]} ${k}`);
          }
        }
      }
      if (struct.length) bad.push(`${struct.length} structural violations under ON: ${struct.slice(0, 3).join('; ')}`);

      // (e) THE LIBRARY DEFAULT IS STILL OFF, asserted rather than assumed. Before B1 this caught a
      // lane that "meant not to flip it" and did. After B1 it is doing MORE work, not less: the flip
      // that landed is the page's initial state, and this clause is what says the legacy state's
      // SEMANTICS did not move with it. `solve` still receives no profile and OFF is still object
      // identity — which is the entire reason I22 and I32 survive a default flip, so this must keep
      // failing if anyone ever "simplifies" the flip down out of the page and into the library.
      if (P.villainProfileOf(undefined, model).on !== false) bad.push('villainProfileOf now defaults to ON — the flip has leaked out of the page and into the library, and I22/I32 no longer asserts what it says it asserts');
      if (P.VILLAIN_OFF.on !== false) bad.push('VILLAIN_OFF is not off');

      G('I43', bad.length === 0,
        `villain profile-ON machinery (V3-PLAN item 8), hoisted out of src/shell.html into ` +
        `policy.mjs.profiledModel so a gate can see it at all — tier-fixture-v2 records the gap it closes ` +
        `("the profile reaches tiers through villainEq, which the page calls and solve does not"). ` +
        `(a) OFF IS OBJECT IDENTITY, asserted with === over 7 off-shaped profiles and never deepEqual: a ` +
        `deep-equal copy passes a value check and is still a different object under the memo. An off-lattice q ` +
        `is also the model itself — the accessor will not interpolate an axis with one measurement on it. ` +
        `(b) the load default is v = ${def.v} (a lattice point of ${pts.join('/')}) and q = ${def.q} (the shipped ` +
        `discipline), so all ${latt}/${live} live cells are cut from a MEASURED row and ${interp} are ` +
        `interpolated; ${unmoved} unmoved. Not vacuous: half a lattice step away ${offLatticeInterp} cells are ` +
        `labelled interpolated. (c) the shadow carries its own meta.hash prefix and the profiled and unprofiled ` +
        `solves are stable and DIFFERENT under interleaved calls — a shadow wearing the shipped hash would be ` +
        `handed the unprofiled answer out of the cache, which is a silent wrong number. (d) I6/I7/I8/I9/I13/I19 ` +
        `re-run under ON at ${vs.length} lattice point${vs.length === 1 ? '' : 's'} x ${VPIP_GRID.length} VPIP x ` +
        `21 legal seats: ${struct.length} violations. **V3-PLAN §7.2's PREDICTION IS NOT FALSIFIED AND THAT IS ` +
        `THE FINDING**: it expected I8 (TRASH x RB never T1/T2) to fail at tight-v profile-ON, on the strength of ` +
        `I25 having measured TRASH gaining against tight pools. It gains, and it does not gain enough — the ` +
        `percentile cut is what holds, because a delta common to a band moves scores and not ranks. That is the ` +
        `same structural fact limitation 17 names, arriving from the other direction. (e) THE LIBRARY DEFAULT ` +
        `IS STILL OFF: villainProfileOf reads anything without on:true as OFF and solve receives no profile, so ` +
        `the legacy state's SEMANTICS are what they always were. B1 has run §5.1's ceremony and flipped the ` +
        `PAGE's initial state, freezing data/tiers-v3-default.fixture.txt beside the v2 one; this clause keeps ` +
        `those two facts distinct, and it is why I22/I32 are still green on the far side of a default flip` +
        (bad.length ? ` — FAILS: ${bad.slice(0, 4).join('; ')}` : ''));
    } },

    // =========================================================================
    // I44 — the 3-bet sizing axis (V3-PLAN item 9, METHODOLOGY §10.8)
    // =========================================================================
    { ids: ['I44'], label: 'sizing: pot is the identity, and what moves when it is not', run: () => {
      // METHODOLOGY §7 ends on "Sizing is not modelled — every threshold assumes a pot-sized 3-bet",
      // and §5's own docstring says the price "does not move with depth ... prices are set by the
      // sizing" — a sentence that named the one dial the model did not have. Item 9 is that dial.
      //
      // THE ARITHMETIC IS EXACT AND THE GEOMETRY IS WHY. Hero opens to `o` into blinds `b`, villain
      // 3-bets to o + s(b+2o), hero calls s(b+2o) into a final pot of (b+2o)(1+2s), so the price is
      // s/(1+2s) — `b` and `o` CANCEL. There is no table assumption in the sizing term at all, which
      // is what lets the shipped 0.290 be re-scaled by e(s)/e(1) rather than replaced.
      const K = P.CONSTANTS.vs3bet, SZ = P.CONSTANTS.sizing;
      const bad = [];
      const sizes = [SZ.min, 0.4, 0.5, 0.6, 0.75, 0.9, SZ.ref];

      // (a) POT-SIZE IS TODAY, BIT FOR BIT. The env normalises to the shared frozen default (===),
      // the price is the shipped constant BY REFERENCE, and a full tier sweep at s = 1 differs from
      // the sweep with no sizing argument in zero cells.
      if (P.envOf({ sizing: SZ.ref }) !== P.envOf({})) bad.push('sizing=1 does not normalise to the shared default env');
      if (P.sizingPrice(SZ.ref) !== K.breakeven) bad.push('sizingPrice(1) is not the shipped breakeven');
      if (P.breakevenPrice({ sizing: SZ.ref }) !== K.breakeven) bad.push('breakevenPrice at s=1 is not the shipped breakeven');
      if (P.callFloorAt({ sizing: SZ.ref }) !== K.call) bad.push('callFloorAt at s=1 is not the shipped call floor');
      let bit = 0, bitN = 0;
      for (const node of ['rfi', 'limps', 'raise', '3bet']) for (const pos of P.POSITIONS) {
        if (P.positionDisabled(pos, node)) continue;
        for (const vp of VPIP_GRID) {
          const st = { pos, node, v: vp / 100, limpers: 2, raiserPos: 'CO' };
          const a = P.solve(model, st), c = P.solve(model, { ...st, sizing: SZ.ref });
          for (const k of Object.keys(a.cells)) {
            bitN++;
            if (a.cells[k].tier !== c.cells[k].tier || a.cells[k].score !== c.cells[k].score) bit++;
          }
        }
      }
      if (bit) bad.push(`${bit} of ${bitN} cells move at s = 1 — the identity anchor is broken`);

      // (b) THE ARITHMETIC, recomputed independently, and composed with rake in the right order.
      let worst = 0;
      let premMin = Infinity, premMax = -Infinity;
      for (const s of sizes) {
        for (const rakePct of [0, 2, P.CONSTANTS.rake.preset]) {
          const e = { sizing: s, rakePct };
          const raw = s === SZ.ref ? K.breakeven : K.breakeven * (3 * s) / (1 + 2 * s);
          const want = raw / (1 - P.rakeFraction(e));
          const got = P.breakevenPrice(e);
          worst = Math.max(worst, Math.abs(got - want));
          if (got !== want) bad.push(`price arithmetic s${s} r${rakePct}`);
          const prem = P.callFloorAt(e) - got;
          premMin = Math.min(premMin, prem); premMax = Math.max(premMax, prem);
        }
      }
      // THE FLAG WITH TEETH: the 7-point premium is HELD CONSTANT across the whole axis. That is not
      // a claim that it should be — a bigger 3-bet is a lower SPR and therefore less postflop to be
      // wrong about, so the premium ought to shrink — it is the admission that nothing here can say
      // by how much, because the measurement layer is all-in equity at showdown (limitation 16).
      const premSpread = premMax - premMin;
      if (premSpread > 1e-15) bad.push(`the call premium is not constant across the axis (spread ${premSpread})`);
      if (Math.abs(premMin - (K.call - K.breakeven)) > 1e-15) bad.push('the premium is not the shipped 7 points');

      // (c) THE CONTINUE RANGE NARROWS MONOTONICALLY IN SIZING — asserted on the model's VERDICT
      // (`wouldBe`), never on `continueWidth`. The difference is not pedantry: `continueWidth`
      // counts the T4/MIX overlay, and MIX is a band in cumulative combo FREQUENCY around a moving
      // cut, so a cut sliding past the 34-36% pile-up (§10.11) sweeps cells into MIX and back out
      // again. Measured, the MIX-inclusive reading is non-monotone at 60 of the settings below while
      // the verdict is monotone at every one of them — the overlay moving, not the decision.
      let viol = 0, first = '', widest = 0, narrows = 0, checks = 0;
      const contOf = (pos, vp, s) => {
        const out = P.solve(model, { pos, node: '3bet', v: vp / 100, limpers: 2, raiserPos: 'CO', sizing: s });
        let n = 0;
        for (const k of Object.keys(out.cells)) if (out.cells[k].wouldBe !== 'T5') n += model.cells[k].combos;
        return n / TOTAL;
      };
      let mixViol = 0;
      for (const pos of P.POSITIONS) {
        for (const vp of VPIP_GRID) {
          let prev = null, prevMix = null;
          for (const s of sizes) {
            const w = contOf(pos, vp, s);
            checks++;
            if (prev != null) {
              if (w > prev + 1e-12) { viol++; if (!first) first = `${pos}@${vp} s${s}: ${(prev * 100).toFixed(2)} -> ${(w * 100).toFixed(2)}`; }
              if (w < prev - 1e-12) narrows++;
            }
            prev = w;
            const mw = P.solve(model, { pos, node: '3bet', v: vp / 100, limpers: 2, raiserPos: 'CO', sizing: s }).continueWidth;
            if (prevMix != null && mw > prevMix + 1e-12) mixViol++;
            prevMix = mw;
          }
          widest = Math.max(widest, contOf(pos, vp, SZ.min) - contOf(pos, vp, SZ.ref));
        }
      }
      if (viol) bad.push(`${viol} monotonicity violations, first ${first}`);
      if (!narrows) bad.push('the continue range never narrows — the axis is inert at the node it exists for');

      // (d) I15's TWO ANCHORS ACROSS THE DOMAIN, and §7.2's second prediction.
      let lowFold = 0, bwCont = 0;
      for (const s of sizes) for (const pos of P.POSITIONS) for (const vp of VPIP_GRID) {
        const c = P.solve(model, { pos, node: '3bet', v: vp / 100, limpers: 2, raiserPos: 'CO', sizing: s }).cells;
        if (c['RUN0_LOW|DS'].wouldBe === 'T5') lowFold++;
        if (c['BROADWAY_RUN|RB'].wouldBe !== 'T5') bwCont++;
      }
      if (bwCont) bad.push(`BROADWAY_RUN|RB continues at ${bwCont} settings`);
      // the number that WOULD have falsified the prediction, computed rather than asserted
      const emLow = P.eqMixOf(model.cells['RUN0_LOW|DS'], null);
      const t = emLow - (K.call - K.breakeven);
      const sBreak = t / (3 * K.breakeven - 2 * t);
      if (lowFold) bad.push(`RUN0_LOW|DS folds at ${lowFold} settings inside the pot-limit domain`);

      // (e) THE DOMAIN IS ASSERTED, NOT READ — the P1 red team's central finding on this gate, and
      // it was a fair hit. Every clause above BUILDS ITS SWEEP FROM `SZ.min` and `SZ.ref`, so none of
      // them can bound either one: move the clamp and the sweep moves with it. Measured by the
      // refuters, `sizing.min` went to 0.001 and `sizing.max` to 2 with all 52 gates and the whole
      // suite green — a 0.1%-of-pot "3-bet" inside the modelled range, and a domain admitting a
      // 2x-pot raise that is not a legal PLO action, while this gate's own report line narrated a
      // window it had never swept. §6 recorded `min` as "bounded by I44's domain sweep"; a sweep
      // anchored at the constant cannot bound the constant, so here is the bound.
      //
      // TWO KINDS OF CLAUSE, and the difference is the whole point of §6. The TOP of the domain is an
      // IDENTITY — the pot-limit maximum IS s = 1, an arithmetic fact of the game — so it is asserted
      // outright. The BOTTOM is an authored judgement nothing here measures, so it is PINNED in the
      // I41(b) idiom: a literal that records the reviewed value and fails on any drift, which proves
      // the shipped clamp is the one that was reviewed and never that 0.25 is right.
      if (SZ.ref !== 1) bad.push(`sizing.ref is ${SZ.ref}, not 1 — pot-size is the identity anchor`);
      if (SZ.max !== SZ.ref) bad.push(`sizing.max ${SZ.max} !== sizing.ref ${SZ.ref} — the pot-limit maximum IS the reference`);
      if (!(SZ.min > 0 && SZ.min < SZ.ref)) bad.push(`sizing.min ${SZ.min} is not a clamp strictly inside the domain`);
      // THE CLAMP IS A CLAMP IN BOTH DIRECTIONS. These two probe the MECHANISM, so reading SZ is
      // right here — the VALUE is bounded by the pin below and by max === ref above, and 2 is left
      // as a literal because it is a real illegal super-pot 3-bet rather than an offset from a
      // constant that could move.
      if (P.envOf({ sizing: SZ.min / 2 }).sizing !== SZ.min) bad.push('a sizing below min is not clamped to min');
      if (P.envOf({ sizing: 2 }).sizing !== SZ.max) bad.push('a sizing above max is not clamped — the page could quote an illegal super-pot 3-bet');
      // THE PIN on the authored end. 0.29 * (3*0.25)/(1+0.5) = 0.145 exactly, and it is a literal
      // here on purpose: recomputing it from SZ.min would be self-consistent under any clamp.
      const pinnedMinPrice = 0.145;
      if (P.sizingPrice(SZ.min) !== pinnedMinPrice) {
        bad.push(`sizingPrice(min) is ${P.sizingPrice(SZ.min)}, not the pinned ${pinnedMinPrice} — the clamp has moved`);
      }
      // THE DETENTS ARE ON THE LADDER THEY CLAIM TO BE ON. Read by nothing today — there is no
      // sizing control on the page — so a refuter set them to [9, 9, 9] and to [0.1, 0.9, 7] with
      // everything green, and the Method view would have rendered an illegal 7x-pot stop under the
      // heading "Constants (rendered from the shipped data)".
      const det = SZ.detents || [];
      if (!det.length) bad.push('sizing.detents is empty');
      if (det.some((x) => !(x >= SZ.min && x <= SZ.max))) bad.push(`a sizing detent is outside [${SZ.min}, ${SZ.max}]: ${det.join(', ')}`);
      if (det.length && det[det.length - 1] !== SZ.ref) bad.push('the last sizing detent is not the pot-limit maximum');
      if (det.some((x, i) => i > 0 && x <= det[i - 1])) bad.push(`the sizing detents are not strictly increasing: ${det.join(', ')}`);
      // THE RECORDED CALIBRATION POINT IS THE POINT THIS GATE PROBES. `premiumCalibratedAt` was
      // inert: set to 0.25 or 0.37 — a shipped, Method-view-rendered claim that the 7-point premium
      // was calibrated at a quarter pot, which is false — it passed everything. Clause (b) measures
      // the premium from vs3bet's own constants and never consulted this datum, so the two could not
      // disagree. Now they must.
      if (SZ.premiumCalibratedAt !== SZ.ref) {
        bad.push(`premiumCalibratedAt ${SZ.premiumCalibratedAt} is not sizing.ref ${SZ.ref} — the record names a calibration point the gate does not probe`);
      }
      const premAtCalib = P.callFloorAt({ sizing: SZ.premiumCalibratedAt }) - P.breakevenPrice({ sizing: SZ.premiumCalibratedAt });
      if (Math.abs(premAtCalib - (K.call - K.breakeven)) > 1e-15) {
        bad.push(`the premium at the recorded calibration point is ${premAtCalib}, not the shipped ${K.call - K.breakeven}`);
      }

      // (f) THE FLAG AND THE FORMULA, bounded in the idiom I41(f) already owns. `constants.sizing.flag`
      // could be emptied or deleted with 52 gates, 436 tests and a clean rebuild green, and because
      // `stampConstants` republishes the whole block from the live object, the admission left the
      // Method view with it. `priceAt` was read by nothing and could spell 'breakeven*s' — dropping
      // the 1/(1+2s) denominator that is the entire geometric argument — with the page rendering it
      // as the model's own description of arithmetic clause (b) recomputes correctly beside it.
      bad.push(...flagProblems('sizing', ['min', 'premiumCalibratedAt', 'detents', 'I44'],
        ['sizing.min', 'sizing.premiumCalibratedAt', 'sizing.detents']));
      const wantPriceAt = 'breakeven*3s/(1+2s)';
      if (SZ.priceAt !== wantPriceAt) {
        bad.push(`sizing.priceAt reads "${SZ.priceAt}" but clause (b) recomputes "${wantPriceAt}" — `
          + `the Method view would publish a formula the model does not run`);
      }
      // and limitation 16 is the named reason THIS block's premium record cannot be anchored, so the
      // chain from the flag to the admission is asserted here the way I41(f) asserts its own half
      const lim16sz = limitationProblems(16);
      if (!lim16sz.length) {
        const e16 = (P.CONSTANTS.limitations || []).find((x) => x.n === 16);
        if (!(e16.flagsItExplains || []).includes('sizing.premiumCalibratedAt')) {
          bad.push('limitation 16 no longer names sizing.premiumCalibratedAt among the flags it explains');
        }
      }
      bad.push(...lim16sz);

      G('I44', bad.length === 0,
        `3-bet sizing axis (V3-PLAN item 9, METHODOLOGY §10.8) over s in [${SZ.min}, ${SZ.max}]. ` +
        `THE DOMAIN'S TOP IS THE GAME'S: the pot-limit maximum IS s = 1, so the reference is this axis's ` +
        `CEILING and sizing can only make a 3-bet smaller — an arithmetic identity, not an authored window. ` +
        `(a) pot-size is today BIT FOR BIT: envOf({sizing:1}) === the shared default env, the price and the floor ` +
        `are the shipped constants by reference, and ${bitN.toLocaleString()} cell-settings swept at s = 1 differ ` +
        `from the unsized sweep in ${bit}. (b) the arithmetic is exact and the geometry is why — hero calls ` +
        `s(b+2o) into (b+2o)(1+2s), so the price is s/(1+2s) and the opening size and the blinds CANCEL; ` +
        `recomputed against rake {0,2,${P.CONSTANTS.rake.preset}}%, worst deviation ${worst.toExponential(1)}, ` +
        `price ${(P.sizingPrice(SZ.min) * 100).toFixed(2)}% at s=${SZ.min} rising to ` +
        `${(K.breakeven * 100).toFixed(2)}% at pot. THE UNANCHORABLE FLAG, WITH TEETH: the ` +
        `${((K.call - K.breakeven) * 100).toFixed(0)}-point call premium is HELD CONSTANT across the axis ` +
        `(spread ${premSpread.toExponential(1)}) and that is an admission, not a claim — a bigger 3-bet is a ` +
        `lower SPR and therefore less postflop to be wrong about, so the premium ought to shrink, and nothing ` +
        `here can say by how much because the measurement layer is all-in equity at showdown (limitation 16). ` +
        `This gate measures the consequence instead of inventing a coefficient to hide it. (c) the continue range ` +
        `narrows monotonically: ${viol} violations over ${checks} readings, ${narrows} strictly-narrowing steps, ` +
        `widest span ${(widest * 100).toFixed(2)} pts. ASSERTED ON THE VERDICT (wouldBe), NOT ON continueWidth — ` +
        `the MIX-inclusive reading is non-monotone at ${mixViol} of the same steps, because MIX is a band in ` +
        `cumulative frequency around a MOVING cut and a cut sliding past the 34-36% pile-up (§10.11) sweeps cells ` +
        `in and back out. That is the overlay moving, not the decision. The span is small for a price that ` +
        `travels ${((K.breakeven - P.sizingPrice(SZ.min)) * 100).toFixed(1)} points, and the reason is the same ` +
        `one I31 records for rake: at this node the NUT FLOORS bind before the price does for most of the grid. ` +
        `(d) I15's two anchors hold at every sizing — BROADWAY_RUN|RB never continues, RUN0_LOW|DS always does. ` +
        `**V3-PLAN §7.2's PREDICTION IS NOT FALSIFIED, AND THE NUMBER SAYS WHY**: it expected "RUN0_LOW x DS ` +
        `always continues" to fail at large sizings. That cell blends ${(emLow * 100).toFixed(2)}% against the ` +
        `face-up mix, and the floor reaches it at s = ${sBreak.toFixed(3)} — TWICE the pot-limit maximum. The ` +
        `anchor is not merely unfalsified, it is unfalsifiable in this game: the floor's asymptote is ` +
        `${((K.call - K.breakeven + K.breakeven * 1.5) * 100).toFixed(2)}% and no legal 3-bet reaches it. So I15 ` +
        `is NOT re-scoped to the default, and the reason is arithmetic rather than tolerance. ` +
        `(e) THE DOMAIN IS NOW ASSERTED RATHER THAN READ — the P1 red team's central hit on this gate ` +
        `(docs/refutations/P1.md), which moved sizing.min to 0.001 and sizing.max to 2 with every gate green, ` +
        `because every clause above builds its sweep FROM those endpoints. The top is asserted as the identity ` +
        `it is (max === ref === 1, and a request at s = 2 must clamp); the bottom is PINNED in the I41(b) idiom ` +
        `— sizingPrice(${SZ.min}) === ${pinnedMinPrice} exactly — which proves the shipped clamp is the one that ` +
        `was reviewed and NEVER that ${SZ.min} is right, because nothing here measures where a raise stops being ` +
        `a 3-bet. The detents are asserted onto the ladder they claim (inside [${SZ.min}, ${SZ.max}], strictly ` +
        `increasing, last one the pot-limit maximum), and premiumCalibratedAt === sizing.ref with the premium ` +
        `re-measured AT that point (${(premAtCalib * 100).toFixed(0)} pts) — the record now names the point this ` +
        `gate probes instead of being decoration beside it. (f) AND THE FLAG IS ITSELF BOUNDED: ` +
        `constants.sizing.flag must exist and name all three records plus this gate — deleting it used to leave ` +
        `everything green while stampConstants quietly republished the block without the admission — each of the ` +
        `three carries the Method view's ESTIMATE badge, and priceAt is asserted character-for-character against ` +
        `"${wantPriceAt}", the arithmetic clause (b) recomputes` +
        (bad.length ? ` — FAILS: ${bad.slice(0, 4).join('; ')}` : ''));
    } },

    ],
  };
}
