// calibration-cells.mjs — per-cell aggregation and coverage (V3-PLAN §3.1 lane C, S-C §2 §4).
//
// Rows in, buckets out. Two things happen here and nothing else:
//
//   1. THE TWO DOORS ARE NEVER MIXED. Every bucket carries `hero` and `showdown` sub-totals
//      separately, computed by the same arithmetic and stored in different fields. There is no
//      combined mean anywhere in this file, because a combined mean is the exact number S-C §2
//      says cannot be interpreted: hero rows estimate E[bb], showdown rows estimate
//      E[bb | reached showdown], and averaging them estimates neither. If a caller wants a number
//      it must say which door it is reading.
//
//   2. COVERAGE IS COUNTED AGAINST THE SHIPPED TAXONOMY, NOT AGAINST WHAT ARRIVED. `coverage()`
//      takes the model's own cell list, so a cell nobody was dealt shows up as a zero rather than
//      as an absence — which is the difference between "123 cells, 89 covered" and "89 cells".
//
// THE BAR REPAIR, IN CODE. S-C §7.6's carry-forward finding is: COUNT HERO ROWS, NOT SHOWDOWNS.
// The plan's own §1 bar ("100 showdowns in 80 cells") is clearable by a corpus whose every hole
// card came through the biased door — 118/123 cells at 1M hands. So `coverage()` reports BOTH
// counts side by side and `sufficiency()` evaluates the bar against the hero count only, with the
// showdown count printed beside it as the descriptive figure it is. The two numbers disagreeing is
// the finding, and the report is built so it cannot hide.
//
// NO OPINION HERE EITHER. Means, sample standard deviations and standard errors, all textbook, all
// on the rows given. The only threshold that appears is the one the CALLER passes in.

/** the sample mean, sd (n-1) and standard error of a list of numbers; n < 2 has no sd */
export function summarize(values) {
  const n = values.length;
  if (n === 0) return { n: 0, sum: 0, mean: 0, sd: null, se: null };
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / n;
  if (n < 2) return { n, sum, mean, sd: null, se: null };
  let ss = 0;
  for (const v of values) { const d = v - mean; ss += d * d; }
  const sd = Math.sqrt(ss / (n - 1));
  return { n, sum, mean, sd, se: sd / Math.sqrt(n) };
}

/** bb/100 is how poker results are always quoted, and it is PC-4's unit */
export function bbPer100(stat) {
  return stat.n === 0 ? null : {
    n: stat.n,
    mean: stat.mean * 100,
    se: stat.se == null ? null : stat.se * 100,
  };
}

function emptyBucket(key) {
  return { key, hero: [], showdown: [] };
}

/**
 * Bucket rows by cell, and by (cell, position) when `byPosition` is set.
 *
 * The (cell, position) split is here because S-C §4 measured it as the binding constraint and the
 * number deserves to be reproducible rather than quoted: position divides the corpus by six, so
 * even at 100M hero hands only 123 of 738 (cell, position) buckets clear 100 rows. A harness that
 * only ever aggregates by cell cannot show that.
 */
export function aggregate(rows, opts = {}) {
  const byCell = new Map();
  const byCellPos = opts.byPosition ? new Map() : null;
  let hero = 0, showdown = 0;

  for (const r of rows) {
    if (r.knownVia !== 'hero' && r.knownVia !== 'showdown') {
      throw new Error(`calibration-cells: row with unknown knownVia ${JSON.stringify(r.knownVia)}`);
    }
    if (r.knownVia === 'hero') hero++; else showdown++;

    let b = byCell.get(r.cell);
    if (!b) { b = emptyBucket(r.cell); byCell.set(r.cell, b); }
    b[r.knownVia].push(r.netBB);

    if (byCellPos) {
      const k = `${r.cell}@${r.pos}`;
      let p = byCellPos.get(k);
      if (!p) { p = emptyBucket(k); byCellPos.set(k, p); }
      p[r.knownVia].push(r.netBB);
    }
  }

  const finish = (m) => {
    const out = new Map();
    for (const [k, b] of m) {
      out.set(k, Object.freeze({
        key: k,
        hero: Object.freeze(bbPer100(summarize(b.hero)) || { n: 0, mean: null, se: null }),
        showdown: Object.freeze(bbPer100(summarize(b.showdown)) || { n: 0, mean: null, se: null }),
      }));
    }
    return out;
  };

  return {
    byCell: finish(byCell),
    byCellPos: byCellPos ? finish(byCellPos) : null,
    totals: Object.freeze({ rows: rows.length, heroRows: hero, showdownRows: showdown }),
  };
}

/**
 * Coverage against the SHIPPED cell list. `cellKeys` is the model's own set (the caller passes
 * `Object.keys(model.cells).filter(k => model.cells[k].combos > 0)`), so an untouched cell is a
 * zero row rather than a missing one.
 */
export function coverage(agg, cellKeys, opts = {}) {
  const min = Number.isFinite(opts.min) ? opts.min : 100;
  const rows = [];
  let heroAtMin = 0, showdownAtMin = 0, touched = 0;
  for (const key of cellKeys) {
    const b = agg.byCell.get(key);
    const h = b ? b.hero.n : 0;
    const s = b ? b.showdown.n : 0;
    if (h + s > 0) touched++;
    if (h >= min) heroAtMin++;
    if (s >= min) showdownAtMin++;
    rows.push({ key, heroRows: h, showdownRows: s });
  }
  rows.sort((a, b) => (b.heroRows - a.heroRows) || (b.showdownRows - a.showdownRows)
    || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return Object.freeze({
    min,
    cells: cellKeys.length,
    touched,
    heroAtMin,
    showdownAtMin,
    rows: Object.freeze(rows),
  });
}

/**
 * The plan §1 bar, evaluated TWICE — once as written (showdowns) and once as S-C §7.6 repairs it
 * (hero rows) — and returned with both readings visible.
 *
 * `metAsWritten` can be true while `met` is false. That is not a bug in the report, it IS the
 * report: it is the exact gap S-C found, and printing only one of the two numbers is how the plan's
 * bar came to be passable by unusable data in the first place.
 */
export function sufficiency(cov, opts = {}) {
  const cellsNeeded = Number.isFinite(opts.cells) ? opts.cells : 80;
  return Object.freeze({
    rule: `>= ${cov.min} rows in >= ${cellsNeeded} of ${cov.cells} cells`,
    min: cov.min,
    cellsNeeded,
    heroCells: cov.heroAtMin,
    showdownCells: cov.showdownAtMin,
    met: cov.heroAtMin >= cellsNeeded,                    // the repaired bar: hero rows only
    metAsWritten: cov.showdownAtMin >= cellsNeeded,       // the plan's §1 bar, counting showdowns
    note: 'S-C §7.6: count hero rows, not showdowns. `metAsWritten` is the plan\'s original bar and'
      + ' is clearable by a corpus that fails PC-1 at any volume.',
  });
}
