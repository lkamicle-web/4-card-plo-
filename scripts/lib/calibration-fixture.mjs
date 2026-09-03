// calibration-fixture.mjs — the SYNTHETIC hand-history fixture. NOT DATA. NEVER DATA.
//
// ============================================================================
//  EVERY HAND BELOW WAS TYPED BY HAND TO EXERCISE PARSER SHAPES.
//  NO OBSERVED PLAY, NO DOWNLOADED CORPUS, NO REAL ACCOUNT, NO REAL RESULT.
//  IT FEEDS NO NUMBER THAT SHIPS. IT IS INADMISSIBLE UNDER PC-2 BY CONSTRUCTION
//  AND `scripts/lib/calibration.mjs` REFUSES IT AS SUCH — see `PROVENANCE` below.
// ============================================================================
//
// WHY A FIXTURE AND NOT A DOWNLOAD. S-C's whole finding is that no lawful, hero-visible 4-card PLO
// corpus exists (PC-1, PC-2), so the harness has to be exercisable with none. A synthetic fixture
// is the only input this lane is entitled to produce — and making it *loudly* inadmissible is the
// point: the failure mode a calibration harness has is a plausible-looking file drifting into the
// estimator, and the cheapest defence is a corpus that says NO in a machine-readable field.
//
// WHAT IT COVERS. Twelve blocks: three clean six-max hands through the three visibility shapes
// (hero folds; hero + one showdown; hero + two showdowns), one uncalled-bet-returned hand, one
// observed hand with NO hero at all (the datamined shape, all rows showdown), and six refusals —
// hi/lo, five-card Omaha, hold'em, a five-handed table, a tournament, a hand whose money does not
// balance, and a file with two `Dealt to` lines. The rejects are the load-bearing half: a parser
// that accepts everything has no way to be wrong out loud.
//
// THE ARITHMETIC IS PART OF THE FIXTURE. Every accepted hand satisfies
// `sum(invested) - sum(returned) - sum(collected) - rake == 0` exactly, and hand 7 violates it by
// exactly $0.25 on purpose. S-C reported that its money-balance clause caught three hand-authored
// hands whose pot arithmetic was wrong before the author noticed; the clause is kept armed here
// for the same reason.
//
// The dates are 2000/01/01 — before online 4-card PLO existed in this file format. One more marker
// that these are not hands anybody played.

/**
 * The provenance record. `scripts/lib/calibration.mjs` reads `synthetic` and fails PC-2 on it, so
 * this fixture can be parsed, aggregated, digested and self-checked, and still can never reach the
 * primacy statistic. Failure-closed: a corpus with NO provenance record fails PC-2 too.
 */
export const PROVENANCE = Object.freeze({
  name: 'RUNDOWN synthetic parser fixture',
  synthetic: true,
  observed: false,
  lawfullyHeld: null,          // not applicable: nobody played these hands
  redistributable: true,       // it is ours; that is not the same as admissible
  note: 'Hand-authored to exercise parser shapes. Inadmissible under PC-2 by construction.',
});

/** the fixture text — hand blocks concatenated exactly as a site would write a session file */
export const FIXTURE = `PokerStars Hand #900000001: Omaha Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:01 ET
Table 'SyntheticTable' 6-max Seat #3 is the button
Seat 1: SynthHJ ($100.00 in chips)
Seat 2: SynthCO ($100.00 in chips)
Seat 3: SynthBTN ($100.00 in chips)
Seat 4: SynthSB ($100.00 in chips)
Seat 5: SynthBB ($100.00 in chips)
Seat 6: SyntheticHero ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
Dealt to SyntheticHero [Ac Ad Kh Ks]
SyntheticHero: folds
SynthHJ: folds
SynthCO: folds
SynthBTN: raises $2.50 to $3.50
SynthSB: folds
SynthBB: folds
Uncalled bet ($2.50) returned to SynthBTN
SynthBTN collected $2.50 from pot
*** SUMMARY ***
Total pot $2.50 | Rake $0
Seat 3: SynthBTN (button) collected ($2.50)

PokerStars Hand #900000002: Omaha Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:02 ET
Table 'SyntheticTable' 6-max Seat #4 is the button
Seat 1: SyntheticHero ($100.00 in chips)
Seat 2: SynthHJ ($100.00 in chips)
Seat 3: SynthCO ($100.00 in chips)
Seat 4: SynthBTN ($100.00 in chips)
Seat 5: SynthSB ($100.00 in chips)
Seat 6: SynthBB ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
Dealt to SyntheticHero [Ah Kh Qs Js]
SyntheticHero: raises $2.50 to $3.50
SynthHJ: folds
SynthCO: folds
SynthBTN: folds
SynthSB: folds
SynthBB: calls $2.50
*** FLOP *** [Th 4c 2d]
SynthBB: checks
SyntheticHero: bets $5
SynthBB: calls $5
*** TURN *** [Th 4c 2d] [8s]
SynthBB: checks
SyntheticHero: checks
*** RIVER *** [Th 4c 2d 8s] [3h]
SynthBB: checks
SyntheticHero: bets $8
SynthBB: calls $8
*** SHOW DOWN ***
SyntheticHero: shows [Ah Kh Qs Js] (a straight)
SynthBB: shows [9c 8c 7d 6d] (a pair of eights)
SyntheticHero collected $32.00 from pot
*** SUMMARY ***
Total pot $33.50 | Rake $1.50
Board [Th 4c 2d 8s 3h]
Seat 1: SyntheticHero showed [Ah Kh Qs Js] and won ($32.00) with a straight
Seat 6: SynthBB (big blind) showed [9c 8c 7d 6d] and lost with a pair of eights

PokerStars Hand #900000003: Omaha Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:03 ET
Table 'SyntheticTable' 6-max Seat #2 is the button
Seat 1: SynthCO ($100.00 in chips)
Seat 2: SynthBTN ($100.00 in chips)
Seat 3: SynthSB ($100.00 in chips)
Seat 4: SynthBB ($100.00 in chips)
Seat 5: SynthUTG ($100.00 in chips)
Seat 6: SyntheticHero ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
Dealt to SyntheticHero [2c 7d 9h Js]
SynthUTG: folds
SyntheticHero: folds
SynthCO: raises $2 to $3
SynthBTN: calls $3
SynthSB: folds
SynthBB: calls $2
*** FLOP *** [Kc Th 5s]
SynthBB: checks
SynthCO: bets $6
SynthBTN: folds
SynthBB: calls $6
*** TURN *** [Kc Th 5s] [2h]
SynthBB: checks
SynthCO: checks
*** RIVER *** [Kc Th 5s 2h] [8d]
SynthBB: checks
SynthCO: bets $12
SynthBB: calls $12
*** SHOW DOWN ***
SynthCO: shows [Ks Kd Ts 9d] (a full house)
SynthBB: shows [Ah Ad 5c 4c] (two pair)
SynthCO collected $43.50 from pot
*** SUMMARY ***
Total pot $45.50 | Rake $2.00
Board [Kc Th 5s 2h 8d]
Seat 1: SynthCO showed [Ks Kd Ts 9d] and won ($43.50) with a full house
Seat 4: SynthBB (big blind) showed [Ah Ad 5c 4c] and lost with two pair

PokerStars Hand #900000004: Omaha Hi/Lo Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:04 ET
Table 'SyntheticTable' 6-max Seat #3 is the button
Seat 1: SynthHJ ($100.00 in chips)
Seat 2: SynthCO ($100.00 in chips)
Seat 3: SynthBTN ($100.00 in chips)
Seat 4: SynthSB ($100.00 in chips)
Seat 5: SynthBB ($100.00 in chips)
Seat 6: SyntheticHero ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
Dealt to SyntheticHero [Ac 2d 3h 4s]
SyntheticHero: folds
SynthHJ: folds
SynthCO: folds
SynthBTN: folds
SynthSB: folds
Uncalled bet ($0.50) returned to SynthBB
SynthBB collected $1.00 from pot
*** SUMMARY ***
Total pot $1.00 | Rake $0
Seat 5: SynthBB (big blind) collected ($1.00)

PokerStars Hand #900000005: 5 Card Omaha Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:05 ET
Table 'SyntheticTable' 6-max Seat #3 is the button
Seat 1: SynthHJ ($100.00 in chips)
Seat 2: SynthCO ($100.00 in chips)
Seat 3: SynthBTN ($100.00 in chips)
Seat 4: SynthSB ($100.00 in chips)
Seat 5: SynthBB ($100.00 in chips)
Seat 6: SyntheticHero ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
Dealt to SyntheticHero [Ac Ad Kh Ks Qc]
SyntheticHero: folds
SynthHJ: folds
SynthCO: folds
SynthBTN: folds
SynthSB: folds
Uncalled bet ($0.50) returned to SynthBB
SynthBB collected $1.00 from pot
*** SUMMARY ***
Total pot $1.00 | Rake $0
Seat 5: SynthBB (big blind) collected ($1.00)

PokerStars Hand #900000006: Hold'em No Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:06 ET
Table 'SyntheticTable' 6-max Seat #3 is the button
Seat 1: SynthHJ ($100.00 in chips)
Seat 2: SynthCO ($100.00 in chips)
Seat 3: SynthBTN ($100.00 in chips)
Seat 4: SynthSB ($100.00 in chips)
Seat 5: SynthBB ($100.00 in chips)
Seat 6: SyntheticHero ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
Dealt to SyntheticHero [Ac Ad]
SyntheticHero: folds
SynthHJ: folds
SynthCO: folds
SynthBTN: folds
SynthSB: folds
Uncalled bet ($0.50) returned to SynthBB
SynthBB collected $1.00 from pot
*** SUMMARY ***
Total pot $1.00 | Rake $0
Seat 5: SynthBB (big blind) collected ($1.00)

PokerStars Hand #900000007: Omaha Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:07 ET
Table 'SyntheticTable' 6-max Seat #3 is the button
Seat 1: SynthHJ ($100.00 in chips)
Seat 2: SynthCO ($100.00 in chips)
Seat 3: SynthBTN ($100.00 in chips)
Seat 4: SynthSB ($100.00 in chips)
Seat 5: SynthBB ($100.00 in chips)
Seat 6: SyntheticHero ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
Dealt to SyntheticHero [Ac Ad Kh Ks]
SyntheticHero: folds
SynthHJ: folds
SynthCO: folds
SynthBTN: raises $2.50 to $3.50
SynthSB: folds
SynthBB: folds
Uncalled bet ($2.50) returned to SynthBTN
SynthBTN collected $2.50 from pot
*** SUMMARY ***
Total pot $2.50 | Rake $0.25
Seat 3: SynthBTN (button) collected ($2.50)

PokerStars Hand #900000008: Omaha Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:08 ET
Table 'SyntheticTable' 6-max Seat #3 is the button
Seat 1: SynthHJ ($100.00 in chips)
Seat 2: SynthCO ($100.00 in chips)
Seat 3: SynthBTN ($100.00 in chips)
Seat 4: SynthSB ($100.00 in chips)
Seat 5: SynthBB ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
Dealt to SynthBTN [Ac Ad Kh Ks]
SynthHJ: folds
SynthCO: folds
SynthBTN: folds
SynthSB: folds
Uncalled bet ($0.50) returned to SynthBB
SynthBB collected $1.00 from pot
*** SUMMARY ***
Total pot $1.00 | Rake $0
Seat 5: SynthBB (big blind) collected ($1.00)

PokerStars Hand #900000009: Omaha Pot Limit (Level V (75/150)) - 2000/01/01 00:00:09 ET
Table 'SyntheticTable' 6-max Seat #3 is the button
Seat 1: SynthHJ (3000 in chips)
Seat 2: SynthCO (3000 in chips)
Seat 3: SynthBTN (3000 in chips)
Seat 4: SynthSB (3000 in chips)
Seat 5: SynthBB (3000 in chips)
Seat 6: SyntheticHero (3000 in chips)
SynthSB: posts small blind 75
SynthBB: posts big blind 150
*** HOLE CARDS ***
Dealt to SyntheticHero [Ac Ad Kh Ks]
SyntheticHero: folds
SynthHJ: folds
SynthCO: folds
SynthBTN: folds
SynthSB: folds
Uncalled bet (75) returned to SynthBB
SynthBB collected 150 from pot
*** SUMMARY ***
Total pot 150 | Rake 0
Seat 5: SynthBB (big blind) collected (150)

PokerStars Hand #900000010: Omaha Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:10 ET
Table 'SyntheticTable' 6-max Seat #3 is the button
Seat 1: SynthHJ ($100.00 in chips)
Seat 2: SynthCO ($100.00 in chips)
Seat 3: SyntheticHero ($100.00 in chips)
Seat 4: SynthSB ($100.00 in chips)
Seat 5: SynthBB ($100.00 in chips)
Seat 6: SynthUTG ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
Dealt to SyntheticHero [Qc Qd Jh Ts]
SynthUTG: folds
SynthHJ: folds
SynthCO: raises $2.50 to $3.50
SyntheticHero: raises $8.50 to $12
SynthSB: folds
SynthBB: folds
SynthCO: folds
Uncalled bet ($8.50) returned to SyntheticHero
SyntheticHero collected $8.10 from pot
*** SUMMARY ***
Total pot $8.50 | Rake $0.40
Seat 3: SyntheticHero (button) collected ($8.10)

PokerStars Hand #900000011: Omaha Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:11 ET
Table 'SyntheticTable' 6-max Seat #5 is the button
Seat 1: SynthBB ($100.00 in chips)
Seat 2: SynthUTG ($100.00 in chips)
Seat 3: SynthHJ ($100.00 in chips)
Seat 4: SynthCO ($100.00 in chips)
Seat 5: SynthBTN ($100.00 in chips)
Seat 6: SynthSB ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
SynthUTG: folds
SynthHJ: raises $2 to $3
SynthCO: folds
SynthBTN: calls $3
SynthSB: folds
SynthBB: folds
*** FLOP *** [Qh 6s 3c]
SynthHJ: bets $5
SynthBTN: calls $5
*** TURN *** [Qh 6s 3c] [Jd]
SynthHJ: checks
SynthBTN: checks
*** RIVER *** [Qh 6s 3c Jd] [2s]
SynthHJ: checks
SynthBTN: bets $10
SynthHJ: calls $10
*** SHOW DOWN ***
SynthHJ: shows [Ac Ah 7s 2d] (two pair)
SynthBTN: shows [5c 5d 6h 7h] (three of a kind)
SynthBTN collected $35.75 from pot
*** SUMMARY ***
Total pot $37.50 | Rake $1.75
Board [Qh 6s 3c Jd 2s]
Seat 3: SynthHJ showed [Ac Ah 7s 2d] and lost with two pair
Seat 5: SynthBTN (button) showed [5c 5d 6h 7h] and won ($35.75) with three of a kind

PokerStars Hand #900000012: Omaha Pot Limit ($0.50/$1.00 USD) - 2000/01/01 00:00:12 ET
Table 'SyntheticTable' 6-max Seat #3 is the button
Seat 1: SynthHJ ($100.00 in chips)
Seat 2: SynthCO ($100.00 in chips)
Seat 3: SynthBTN ($100.00 in chips)
Seat 4: SynthSB ($100.00 in chips)
Seat 5: SynthBB ($100.00 in chips)
Seat 6: SyntheticHero ($100.00 in chips)
SynthSB: posts small blind $0.50
SynthBB: posts big blind $1
*** HOLE CARDS ***
Dealt to SyntheticHero [Ac Ad Kh Ks]
Dealt to SynthBTN [Qc Qd Jh Js]
SyntheticHero: folds
SynthHJ: folds
SynthCO: folds
SynthBTN: raises $2.50 to $3.50
SynthSB: folds
SynthBB: folds
Uncalled bet ($2.50) returned to SynthBTN
SynthBTN collected $2.50 from pot
*** SUMMARY ***
Total pot $2.50 | Rake $0
Seat 3: SynthBTN (button) collected ($2.50)
`;

/** what the fixture is FOR, in one place, so the tests and the CLI agree on the claim */
export const FIXTURE_SHAPES = Object.freeze([
  { id: '900000001', shape: 'hero folds preflop — one hero row, no showdown row' },
  { id: '900000002', shape: 'hero wins at showdown — hero row + one showdown row' },
  { id: '900000003', shape: 'hero folds, two villains show — hero row + two showdown rows' },
  { id: '900000004', shape: 'REJECT omaha-hi-lo' },
  { id: '900000005', shape: 'REJECT omaha-not-4-card (five-card Omaha)' },
  { id: '900000006', shape: 'REJECT not-omaha-pl (hold\'em)' },
  { id: '900000007', shape: 'REJECT money-imbalance (off by $0.25 on purpose)' },
  { id: '900000008', shape: 'REJECT not-six-handed (five dealt seats)' },
  { id: '900000009', shape: 'REJECT not-cash (tournament level)' },
  { id: '900000010', shape: 'hero 3-bets and takes it down — uncalled bet returned' },
  { id: '900000011', shape: 'observed hand, NO hero — two showdown rows, the datamined shape' },
  { id: '900000012', shape: 'REJECT multiple-dealt-to (not a first-person history)' },
]);
