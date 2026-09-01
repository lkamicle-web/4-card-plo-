// Constants the gate families share. Lifted VERBATIM out of scripts/verify.mjs when the
// single-file gate body became this registry (V3-PLAN §0.1) — same bytes, same order, so the
// reference matrix below still diffs cleanly against its own history.
//
// ROOT is the one line that had to change: this file sits one directory deeper than verify.mjs
// did, so the walk up is '../..' rather than '..'.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const TOTAL = 270725;

// the reference 29x5 combo matrix, columns in DS SSA SS RB FLAW order.
// RUN0_HIGH / RUN0_LOW carry the corrected wheel split (taxonomy.mjs topInGapOrientation): the 256
// A432 combos file as LOW, so HIGH is 768 -> 512 (and HIGH x SSA empties, since JT98/QJT9 hold no
// ace) and LOW is 1536 -> 1792 (gaining the row's first SSA cell). Column totals are unchanged.
export const REF_MATRIX = `AA_BIGPAIR 18 72 0 18 0
AA_BROADWAY 72 288 72 72 72
AA_CONNECTED 288 1152 288 288 288
AA_SMALLPAIR 54 216 0 54 0
AA_DANGLER 432 1728 432 432 432
A_BLOCKED 0 144 0 49 0
DBLPAIR_BIG 36 0 144 36 0
DBLPAIR_MIXED 144 0 576 144 0
BIGPAIR_CONN 432 324 1836 432 432
BIGPAIR_ACE 288 864 576 288 288
BIGPAIR_JUNK 1656 0 8280 1656 1656
TRIPS_BIG 0 36 396 147 0
BROADWAY_RUN 180 288 432 120 260
RUN0_HIGH 72 0 288 48 104
RUN0_LOW 252 72 936 168 364
RUN1_BOTTOM 324 72 1224 216 468
RUN1_TOPMID 648 144 2448 432 936
RUN2 1944 864 6912 1296 2808
RUN3 2880 1440 10080 1920 4160
ACE_RUN3 1584 3168 3168 1056 2288
RUN3_DANGLER 3240 0 12960 2160 4680
DBL_CONNECTOR 2592 1224 9144 1728 3744
DBLPAIR_SMALL 216 0 864 216 0
SMPAIR_CONN 1728 540 8100 1728 1728
SMPAIR_ACE 1008 3024 2016 1008 1008
SMPAIR_JUNK 4392 0 21960 4392 4392
TRIPS_SMALL 0 108 1188 441 0
ACE_JUNK 4284 8568 8568 2856 6188
TRASH 7740 0 30960 5160 11180`;
export const REF_ORDER = ['DS', 'SSA', 'SS', 'RB', 'FLAW'];

export const CAT_COUNTS = [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40];

export const VPIP_GRID = [25, 40, 55, 70, 90];
export const NODES = ['rfi', 'limps', 'raise', '3bet'];
