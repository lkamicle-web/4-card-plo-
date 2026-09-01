// gates I1 I2 I3 — the structural equity invariants.
//
// Claims about SHAPE rather than level: suit monotonicity down a row, that a dangler only ever
// costs equity (paired Monte Carlo over common boards, so the comparison carries no MC noise),
// and that rho points the way nu says as the field grows. Each is measured, not asserted from
// the taxonomy.

import { ROW_ORDER } from '../lib/taxonomy.mjs';
import { parseHand } from '../lib/eval5.mjs';
import { equityPaired } from '../lib/mc.mjs';

export const family = 'structure';
export const title = 'the three structural equity invariants — suits, danglers, and rho in N';
export const ids = ['I1', 'I2', 'I3'];

export function build(ctx) {
  const { model, fast, tolE, G } = ctx;

  return {
    sections: [
    // =========================================================================
    // I1 — suit monotonicity in equity
    // =========================================================================
    { ids: ['I1'], label: 'suit monotonicity in equity', run: () => {
    const chain = ['RB', 'FLAW', 'SS', 'DS'];
    const bad = [];
    for (const row of ROW_ORDER) {
      let prev = null, prevKey = null;
      for (const col of chain) {
        const c = model.cells[row + '|' + col];
        if (!c || !c.combos) continue;
        if (prev !== null && c.eq[0] < prev - tolE) bad.push(`${row}: ${col} ${c.eq[0]} < ${prevKey} ${prev}`);
        prev = c.eq[0]; prevKey = col;
      }
    }
    G('I1', bad.length === 0, `eq(DS) >= eq(SS) >= eq(FLAW) >= eq(RB) within +/-${tolE} pt for all 29 rows` +
      (bad.length ? ` — ${bad.slice(0, 3).join('; ')}` : ''));
    } },

    // =========================================================================
    // I2 — danglers only hurt (paired Monte Carlo, common boards)
    // =========================================================================
    { ids: ['I2'], label: 'danglers only hurt', run: () => {
    const pairs = [
      ['AsAh7d2c', 'AsAhQdJc'], ['KsKh7d2c', 'KsKhQdJc'], ['Ks9h5d2c', 'Ks9h8d7c'],
      ['AsKh8d2c', 'AsKhQdJc'], ['QsQh8d2c', 'QsQhJdTc'], ['JsTh9d2c', 'JsTh9d8c'],
      ['9s8h4d2c', '9s8h7d6c'], ['AsQh6d2c', 'AsQhJdTc'], ['TsTh6d2c', 'TsTh9d8c'],
      ['7s6h3d2c', '7s6h5d4c'],
    ];
    const bad = [];
    for (const [worse, better] of pairs) {
      const [a, b] = equityPaired(parseHand(worse), parseHand(better), 20000, `I2|${worse}`, 3);
      if (b < a - 0.3) bad.push(`${better} ${b.toFixed(2)} < ${worse} ${a.toFixed(2)}`);
    }
    G('I2', bad.length === 0,
      `${pairs.length} paired substitutions (dangler -> cluster-joining card) at N=3, 20k common deals each` +
      (bad.length ? ` — ${bad.join('; ')}` : ''));
    } },

    // =========================================================================
    // I3 — rho monotone in N
    // =========================================================================
    { ids: ['I3'], label: 'rho monotone in N', run: () => {
    // Corrected form. The claim is about DIRECTION, and the direction holds for every cell without
    // exception (endpoint test). The step-by-step form does not: an AA cell dominates a single
    // random hand less thoroughly than it dominates a field of two, so rho rises from N=1 to N=2
    // before decaying — a real, 8-sigma feature of the measurement, not sampling noise. Intermediate
    // reversals are therefore bounded rather than forbidden.
    const tol = fast ? 0.12 : 0.05;
    const badEnd = [], badStep = [];
    let worst = 0;
    for (const k of Object.keys(model.cells)) {
      const c = model.cells[k];
      if (!c.combos) continue;
      const up = c.nu > 0.5, down = c.nu < 0.3;
      if (!up && !down) continue;
      if (up && c.rho[4] <= c.rho[0]) badEnd.push(k);
      if (down && c.rho[4] >= c.rho[0]) badEnd.push(k);
      for (let i = 1; i < 5; i++) {
        const rev = up ? c.rho[i - 1] - c.rho[i] : c.rho[i] - c.rho[i - 1];
        if (rev > worst) worst = rev;
        if (rev > tol) badStep.push(`${k} step ${i} ${rev.toFixed(3)}`);
      }
    }
    G('I3', badEnd.length === 0 && badStep.length === 0,
      `rho(N=5) vs rho(N=1) points the way nu says for every cell with nu>0.5 or nu<0.3 ` +
      `(${badEnd.length} exceptions); largest intermediate reversal ${worst.toFixed(3)} of ${tol}` +
      (badStep.length ? ` — ${badStep[0]}` : ''));
    } },
    ],
  };
}
