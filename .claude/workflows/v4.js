export const meta = {
  name: "v4",
  description: "RUNDOWN v4 execution workflow - the 9-max seat ladder, stages S0-S6 end to end in ONE launch per docs/V4-PLAN.md section 7.",
  whenToUse: "Launch once, from a top-level session, on main with a clean tree, to execute the whole of docs/V4-PLAN.md: precheck, the policy ladder generalisation, the four-lane fan-out (ring artifact / UI / fixtures+gates / skill+prose), integration and the 9-max fixture creation ceremony, the red team, the docs and D6 cite re-pin, and the boundary commit. Relaunch after a blocker with resumeFromRunId; unchanged stages replay from cache.",
  phases: [
    { title: "S0 precheck", detail: "Read-only: three checks green at HEAD, the three legacy fixtures present, data/tiers-9max.fixture.txt ABSENT, no --force in the history, tree clean. Aborts the run on red.", model: "sonnet" },
    { title: "S1 ladder generalisation", detail: "Serial on the main tree under a Fable work-order: seatsFor/LADDER9 and the structural functions replace every seat-keyed table, the two seat-literal offenders become predicates, the five re-typed NEST_CHAIN literals and baseline.mjs's two arrays become imports. Byte-identical at seats=6 - the three legacy fixtures compare clean before it may return.", model: "opus (max) + fable (high) architect" },
    { title: "S2 lane fan-out", detail: "Four isolated worktrees in parallel, single writer per file: R the ring artifact + the per-call nMax option through both kernels + D12, U the UI/Table control/smoke/browsers, F the freeze-tiers --seats9 kind + I48-I52 AND all seven id registrations (reserved.mjs, the family ids and EXPECTED_IDS - F is their single writer, no other lane opens scripts/gates/index.mjs), K the skill-exception measurement at the 12 newly legal pairs + SIXMAX rename + vs-GTO reasons. policy.mjs is frozen: a lane FILES policyDeltas, it never writes them.", model: "opus (xhigh) x4" },
    { title: "S3 integration + freeze", detail: "Serial on the main tree under a Fable work-order: merge the four lanes, apply the filed policy deltas and re-run I48, register the @block:ring page block and the top-level `ring` artifact budget row in BOTH variants shrink-first (the full variant's total raise is expected and paid), write I50's clauses from R4's enumeration, THEN create data/tiers-9max.fixture.txt with freeze-tiers --seats9 (created, never --force'd) and commit the sub-ladder diff into METHODOLOGY.", model: "opus (max) + fable (high) architect" },
    { title: "S4 red team", detail: "Three independent refuters attack every constant in plan section 4 and every rule in section 3, memos to the scratchpad; a resolver merges them into docs/refutations/V4.md under majority rule and applies the dispositions.", model: "opus (xhigh) x4" },
    { title: "S5 docs + re-pin", detail: "METHODOLOGY section 3.6 + limitation 20 + section 9.11 ring rows, README's What v4 added and backlog item 16, V4-PLAN annotated in place, package.json 4.0.0-dev, and the D6 literal-line cites in scripts/gates/data.mjs re-pinned by content after the documents grew.", model: "opus (xhigh)" },
    { title: "S6 verify + commit", detail: "Verify all three checks plus smoke, browsers and the three --check generators; on red, one Fable triage and exactly ONE opus-max fix round, then re-verify; refuse the commit if any blocker stands even when green; else commit at the boundary. Never push.", model: "sonnet verify, fable triage, opus (max) fix, haiku commit" }
  ]
};

// ---------------------------------------------------------------------------
// Shared prompt fragments
// ---------------------------------------------------------------------------

const HOUSE = [
  "CONTEXT - the repository you are working in:",
  "RUNDOWN, a 4-card PLO preflop range explorer at v3 (HEAD 1d988f5, verifier 62/62, 679 tests, both variants --check current). Two GENERATED artifacts index.html (lite) and index-full.html (full) - NEVER hand-edit either; edit src/shell.html and rebuild with `node scripts/build.mjs`. Zero-runtime-dependency Node pipeline; no new runtime or dev dependency may be added (README item 15).",
  "Key files: scripts/verify.mjs (the gate RUNNER; the gates themselves live as families under scripts/gates/, registered in scripts/gates/index.mjs whose EXPECTED_IDS is a frozen sequence the runner throws on), scripts/build.mjs, scripts/lib/variant.mjs (per-variant byte budgets + budgetSource), scripts/lib/policy.mjs (the scoring/opinion layer; POSITIONS at :12 is imported by 15 files), scripts/lib/skill.mjs, scripts/lib/mc.mjs, scripts/lib/sim-kernel.js, scripts/lib/cfr.mjs, scripts/lib/equilibrium.mjs, scripts/freeze-tiers.mjs (the SOLE fixture writer), data/model.json, data/checkdown-matrix.json, data/equilibrium.json, the three frozen fixtures data/tiers-v1.fixture.txt (I22), data/tiers-v2.fixture.txt (I32) and data/tiers-v3-default.fixture.txt (pinned by test/tier-fixture-v3.test.mjs), docs/METHODOLOGY.md (the LIVING SOURCE OF TRUTH - where it and the plan disagree, METHODOLOGY is right), docs/V4-PLAN.md (this run's plan - read the sections your task cites IN FULL before writing code), docs/V3-PLAN.md and docs/METHODOLOGY.md for precedent idioms.",
  "",
  "HOUSE RULES (non-negotiable):",
  "- GREEN means ALL THREE: `node scripts/verify.mjs` exits 0 with every gate pass; `node --test test/*.test.mjs` all pass; `node scripts/build.mjs --check` reports current for BOTH variants. At the run's close it additionally means `node smoke.mjs` 2/2 with the three existing morph rows unchanged against their 8/16/4 ms budgets, `node browsers.mjs` 2/2, and all THREE --check generators byte-identical (generate-checkdown-matrix.mjs, generate-equilibrium.mjs, generate-ring.mjs).",
  "- The objective/opinion split: the Monte Carlo layer is objective, scoring is opinion. CONSTANTS NEED ANCHORS: every new constant is named in `constants`, anchored per docs/V4-PLAN.md section 4, rendered by the Method view, and bounded by a gate. If you cannot anchor a constant, DO NOT invent a number - ship it gated + flagged + badged `estimate`, or surface it as a blocker in your structured return. Nobody types a seat number: the nine-seat baseRaise/baseR objects are BUILT BY RULE from the legacy six (section 2.3).",
  "- New model work needs new gates (ids I48-I52, D12, D13 per docs/V4-PLAN.md section 5.2) before the run can close. Gates are written to FAIL, never tolerances widened to pass. Byte ceilings tighten-never-widen except as a PAID raise under D6's from-above clause, and every raise carries its shrink-first measurement in bytes (section 2.7, rule R6).",
  "- THE v4 IDENTITY CONSTRAINT (plan section 0.4): the seat axis is INERT at seats = 6. A mechanism enters as (a) a new axis inert at legacy settings or (b) a new artifact. Option (c), a deliberate re-freeze, is FORBIDDEN this run. `--force` IS NOT AUTHORISED ANYWHERE IN THIS RUN, for any reason, by any agent, at any stage: `scripts/freeze-tiers.mjs --seats9` CREATES data/tiers-9max.fixture.txt (the file does not exist when the run starts; the writer refuses to overwrite without --force, and if you find yourself wanting --force the answer is a BLOCKER, never the flag). The three legacy fixtures must be green at the end with no --force anywhere in the run's history.",
  "- NO NEW SEAT-NAME LITERAL anywhere (plan section 2.1, gate I51(c)): not in policy, gates, tests, the shell, or docs prose the gates read. Every consumer takes its list from `seatsFor(seats)` or a structural function of it; the nine keys appear only inside LADDER9, seatsFor, fixtures and the display map.",
  "- Commit ONLY when this prompt says to. NEVER push. NEVER touch the user's installed browsers - browser testing is headless with throwaway temp profiles only.",
  "- You are fully autonomous: never ask the user anything; decide, or surface a blocker in your structured return value. Do not spawn subagents.",
  "- In structured returns, `blockers` is RESERVED for what must stop this run from committing: a deliverable you could not produce, a gate you could not make green without weakening it, a constant that can be neither anchored nor legitimately gated+flagged, or a decision only the owner can make that blocks correctness. Informational findings, resolved trade-offs, provenance notes, measured falsifications of the plan's predictions and items deliberately left for later belong in `summary`, NEVER in `blockers` - a note filed as a blocker halts the whole run (this aborted a v3 run; user-adjudicated 2026-08-31).",
  "- CAPPED RETURNS, DETAIL TO FILES: your structured return is read by an orchestrator with no context. Keep `summary` to at most 12 lines and every other field to the caps this prompt states. Anything longer - measurements, tables, diffs, enumerations, memos - goes in the detail FILE this prompt names (docs/spikes/V4-*.md, docs/refutations/V4.md, or your scratchpad) and you return its path. THAT DETAIL FILE IS A REQUIRED DELIVERABLE OF THIS BRIEF AND THIS INSTRUCTION OVERRIDES ANY DEFAULT GUIDANCE AGAINST WRITING REPORT OR SUMMARY FILES.",
  "- The plan is annotated in place as stages land, in the V2-PLAN/V3-PLAN idiom: `> **Measured (stage Sn).**` blocks under the prediction they confirm or falsify, the plan text above the annotation kept as written, reversals recorded rather than edited away. A falsified prediction is RECORDED, never patched away."
].join("\n");

// ---------------------------------------------------------------------------
// Model policy (v3 policy, carried over verbatim in shape; plan section 7.1)
// ---------------------------------------------------------------------------
// The LAUNCHING SESSION (Fable) does three things only: launches this script, receives its return
// value, reports it. Every agent() call below sets `model` and `effort` EXPLICITLY so a Fable
// launch never silently inherits Fable pricing onto every worker in the run:
//   fable @ high    - the ARCHITECT: writes the work-order for each opus@max step before it runs,
//                     and triages a red verification before the single fix round fires. READ-ONLY,
//                     writes nothing, spawns nothing: this script's fable tier is the last Fable
//                     layer (plan section 7.1). Its work-orders are appended to
//                     docs/spikes/V4-workorders.md by the worker that executes them, never returned.
//   opus @ xhigh    - the default worker: the four S2 lanes, the red-team refuters and resolver, S5.
//   opus @ max      - the three highest-stakes calls: S1 (the ladder generalisation - the
//                     load-bearing refactor that must be byte-identical at six seats), S3
//                     (integration + the fixture creation ceremony), and the ONE fix round.
//   sonnet @ medium - scout-shaped work: the S0 precheck and the S6 verify/re-verify agents, which
//                     run commands, grep gate ids and report. Quality-equivalent, ~5x cheaper.
//   haiku @ low     - the commit agent (git add / commit with a supplied message).

// The snapshot branch S1 publishes so the S2 worktrees can sit on its (uncommitted) tree.
// A git worktree is cut from HEAD and does NOT carry the main tree's uncommitted work (measured in
// the v3 P2 run), while plan section 7.2 keeps S1 "main tree, serial, uncommitted" and section 0.3
// keeps the commit at the boundary. `git stash create` resolves both: it writes a commit OBJECT for
// the current tree without touching the working tree, the index, the stash list or HEAD.
const SNAPSHOT_REF = "v4-s1-base";

const WORKORDERS = "docs/spikes/V4-workorders.md";

// Owner adjudication on a relaunch (plan section 7.5): pass
//   args: { adjudication: { stage: "S3", text: "..." } }
// and the prose is appended to THAT stage's prompt only, so every earlier agent() call keeps a
// byte-identical prompt and replays from cache under resumeFromRunId.
const ADJ = (args && typeof args === "object" && args.adjudication && typeof args.adjudication === "object")
  ? args.adjudication : null;
function ownerNote(stageId) {
  if (!ADJ || String(ADJ.stage) !== stageId || !ADJ.text) return "";
  return "\n\nOWNER ADJUDICATION FOR THIS STAGE (the run was relaunched after a blocker; this prose is the owner's decision and it BINDS - it may not be re-litigated, and it may not weaken a gate, widen a tolerance or authorise --force):\n" + String(ADJ.text);
}

// ---------------------------------------------------------------------------
// Schemas - every stage returns one; every measured field is a NUMBER, never prose
// ---------------------------------------------------------------------------

function extend(base, props, req) {
  const p = {};
  for (const k of Object.keys(base.properties)) p[k] = base.properties[k];
  for (const k of Object.keys(props)) p[k] = props[k];
  return { type: "object", properties: p, required: base.required.concat(req) };
}

const precheckSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    green: { type: "boolean" },
    head: { type: "string" },
    gateCount: { type: "number" },
    testCount: { type: "number" },
    fixturesPresent: { type: "array", items: { type: "string" } },
    ninemaxFixtureAbsent: { type: "boolean" },
    forceInLog: { type: "boolean" },
    treeClean: { type: "boolean" },
    summary: { type: "string" },
    blockers: { type: "array", items: { type: "string" } }
  },
  required: ["ok", "green", "head", "gateCount", "testCount", "fixturesPresent", "ninemaxFixtureAbsent", "forceInLog", "treeClean", "summary", "blockers"]
};

const ladderSchema = {
  type: "object",
  properties: {
    identityAtSix: { type: "boolean" },
    fixturesClean: { type: "array", items: { type: "string" } },
    forceInLog: { type: "boolean" },
    snapshotRef: { type: "string" },
    modelCodeBytes: { type: "number" },
    appCoreBytes: { type: "number" },
    legalPairsAtNine: { type: "number" },
    baseRRule: { type: "string" },
    censusClampedPct: { type: "number" },
    offendersRewritten: { type: "number" },
    memoPath: { type: "string" },
    newConstants: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    blockers: { type: "array", items: { type: "string" } }
  },
  required: ["identityAtSix", "fixturesClean", "forceInLog", "snapshotRef", "modelCodeBytes", "appCoreBytes", "legalPairsAtNine", "baseRRule", "censusClampedPct", "offendersRewritten", "memoPath", "newConstants", "summary", "blockers"]
};

const laneSchema = {
  type: "object",
  properties: {
    lane: { type: "string" },
    branch: { type: "string" },
    files: { type: "array", items: { type: "string" } },
    gateIds: { type: "array", items: { type: "string" } },
    measured: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, value: { type: "number" }, unit: { type: "string" } },
        required: ["name", "value", "unit"]
      }
    },
    policyDeltas: { type: "array", items: { type: "string" } },
    memoPath: { type: "string" },
    newConstants: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    blockers: { type: "array", items: { type: "string" } }
  },
  required: ["lane", "branch", "files", "gateIds", "measured", "policyDeltas", "memoPath", "newConstants", "summary", "blockers"]
};

// Lane R alone carries the ring numbers the final return needs, so they are REQUIRED of it.
const ringLaneSchema = extend(laneSchema, {
  ringWallSec: { type: "number" },
  ringPrefixWorstSE: { type: "number" },
  ringBytes: { type: "number" }
}, ["ringWallSec", "ringPrefixWorstSE", "ringBytes"]);

const integrationSchema = {
  type: "object",
  properties: {
    merged: { type: "boolean" },
    lanesMerged: { type: "array", items: { type: "string" } },
    policyDeltasApplied: { type: "number" },
    fixtureCreatedNotForced: { type: "boolean" },
    fixtureSettings: { type: "number" },
    fixturePath: { type: "string" },
    i48: { type: "boolean" },
    i50RfiExact: { type: "boolean" },
    i50Clauses: { type: "number" },
    budgets: {
      type: "object",
      properties: {
        liteTotal: { type: "number" }, liteApp: { type: "number" }, liteAppCore: { type: "number" },
        liteRing: { type: "number" }, liteBlocksRing: { type: "number" },
        fullTotal: { type: "number" }, fullRing: { type: "number" }
      },
      required: ["liteTotal", "liteApp", "liteAppCore", "liteRing", "liteBlocksRing", "fullTotal", "fullRing"]
    },
    raises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ceiling: { type: "string" }, from: { type: "number" }, to: { type: "number" },
          shrinkFirstBytes: { type: "number" }
        },
        required: ["ceiling", "from", "to", "shrinkFirstBytes"]
      }
    },
    memoPath: { type: "string" },
    newConstants: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    blockers: { type: "array", items: { type: "string" } }
  },
  required: ["merged", "lanesMerged", "policyDeltasApplied", "fixtureCreatedNotForced", "fixtureSettings", "fixturePath", "i48", "i50RfiExact", "i50Clauses", "budgets", "raises", "memoPath", "newConstants", "summary", "blockers"]
};

const refuterSchema = {
  type: "object",
  properties: {
    memoPath: { type: "string" },
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          constant: { type: "string" },
          attack: { type: "string" },
          hasFalsifiableClaim: { type: "boolean" },
          unanchorable: { type: "boolean" },
          memo: { type: "string" }
        },
        required: ["constant", "attack", "hasFalsifiableClaim", "unanchorable", "memo"]
      }
    }
  },
  required: ["memoPath", "verdicts"]
};

const resolveSchema = {
  type: "object",
  properties: {
    done: { type: "boolean" },
    constants: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, verdict: { type: "string" }, disposition: { type: "string" } },
        required: ["name", "verdict", "disposition"]
      }
    },
    unanchored: { type: "array", items: { type: "string" } },
    docPath: { type: "string" },
    summary: { type: "string" },
    blockers: { type: "array", items: { type: "string" } }
  },
  required: ["done", "constants", "unanchored", "docPath", "summary", "blockers"]
};

const docsSchema = {
  type: "object",
  properties: {
    done: { type: "boolean" },
    sections: { type: "array", items: { type: "string" } },
    citesRepinned: { type: "number" },
    readmeCitesRepointed: { type: "number" },
    version: { type: "string" },
    raises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ceiling: { type: "string" }, from: { type: "number" }, to: { type: "number" },
          shrinkFirstBytes: { type: "number" }
        },
        required: ["ceiling", "from", "to", "shrinkFirstBytes"]
      }
    },
    memoPath: { type: "string" },
    summary: { type: "string" },
    blockers: { type: "array", items: { type: "string" } }
  },
  required: ["done", "sections", "citesRepinned", "readmeCitesRepointed", "version", "raises", "memoPath", "summary", "blockers"]
};

const bytesSchema = {
  type: "object",
  properties: {
    total: { type: "number" }, app: { type: "number" }, appCore: { type: "number" }, ring: { type: "number" }
  },
  required: ["total", "app", "appCore", "ring"]
};

const verifySchema = {
  type: "object",
  properties: {
    green: { type: "boolean" },
    gateTotal: { type: "number" },
    failingGates: { type: "array", items: { type: "string" } },
    missingGateIds: { type: "array", items: { type: "string" } },
    testTotal: { type: "number" },
    testFail: { type: "number" },
    buildCurrent: { type: "boolean" },
    smokeOk: { type: "boolean" },
    browsersOk: { type: "boolean" },
    generatorsByteIdentical: { type: "boolean" },
    lite: bytesSchema,
    full: bytesSchema,
    detail: { type: "string" }
  },
  required: ["green", "gateTotal", "failingGates", "missingGateIds", "testTotal", "testFail", "buildCurrent", "smokeOk", "browsersOk", "generatorsByteIdentical", "lite", "full", "detail"]
};

const fixSchema = {
  type: "object",
  properties: {
    done: { type: "boolean" },
    summary: { type: "string" },
    newConstants: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } }
  },
  required: ["done", "summary", "blockers"]
};

const commitSchema = {
  type: "object",
  properties: {
    committed: { type: "boolean" },
    hash: { type: "string" },
    message: { type: "string" }
  },
  required: ["committed", "hash", "message"]
};

const workOrderSchema = {
  type: "object",
  properties: {
    plan: { type: "string" },
    risks: { type: "array", items: { type: "string" } }
  },
  required: ["plan", "risks"]
};

// ---------------------------------------------------------------------------
// State + capped return (plan section 7.3)
// ---------------------------------------------------------------------------

const ZERO_BYTES = { total: 0, app: 0, appCore: 0, ring: 0 };

function mkState() {
  return {
    green: false,
    committed: null,
    verify: null,
    fixture: { settings: 0, path: "" },
    identity: { i48: false, i50: { rfiExact: false, clauses: 0 } },
    ring: { wallSec: 0, prefixAgreement: 0 },
    redTeam: { constants: 0, unanchored: [] },
    raises: [],
    detailFiles: [],
    blockers: [],
    notes: []
  };
}

function trunc(s, n) {
  const t = String(s === null || s === undefined ? "" : s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "..." : t;
}

function capList(a, n, len) {
  const src = Array.isArray(a) ? a : [];
  const out = src.slice(0, n).map(function (x) { return trunc(x, len); });
  if (src.length > n) out.push("(+" + (src.length - n) + " more)");
  return out;
}

function uniq(a) {
  return (Array.isArray(a) ? a : []).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; });
}

// THE RUN'S WHOLE RETURN (plan section 7.3). Every leaf is a number, a boolean, a short path or a
// capped one-line string: no prose, no memo, no diff, no log ever enters the launching session -
// the detail lives in the files listed in detailFiles. The arrays are hard-capped here so a red run
// cannot grow the object past a green one.
function finish(state) {
  const v = state.verify;
  return {
    green: state.green,
    committed: state.committed,
    gates: {
      total: v ? v.gateTotal : 0,
      fail: capList(v ? v.failingGates.concat(v.missingGateIds) : ["verification never ran"], 4, 60)
    },
    tests: { total: v ? v.testTotal : 0, fail: v ? v.testFail : -1 },
    build: { lite: v ? v.lite : ZERO_BYTES, full: v ? v.full : ZERO_BYTES },
    fixture: state.fixture,
    identity: state.identity,
    ring: state.ring,
    raises: state.raises.slice(0, 3),
    redTeam: { constants: state.redTeam.constants, unanchored: capList(state.redTeam.unanchored, 3, 40) },
    detailFiles: capList(uniq(state.detailFiles), 6, 56),
    blockers: capList(state.blockers, 4, 150)
  };
}

function collect(state, r) {
  if (!r) return;
  if (r.memoPath) state.detailFiles.push(r.memoPath);
  if (r.docPath) state.detailFiles.push(r.docPath);
  if (Array.isArray(r.blockers) && r.blockers.length) state.blockers.push(...r.blockers);
}

// ---------------------------------------------------------------------------
// Fable tier: the read-only architect (work-orders) and the read-only triage
// ---------------------------------------------------------------------------

async function fableWorkOrder(state, phaseTitle, label, taskDescription) {
  const wo = await agent([
    HOUSE,
    "",
    "TASK - orchestrator work-order (you are the Fable-tier architect of this run; you PLAN, you do not implement - read files freely, WRITE NOTHING, run no mutating command, spawn no subagent). A max-effort Opus worker is about to execute the step quoted below. Read the docs/V4-PLAN.md sections it cites and the current code it touches, then write its work-order: the decision points it will hit with your call on each, the sharp edges and integration risks, the order of operations, and what would count as a genuine blocker worth stopping the run for. Refine, never override, the plan - where you disagree with it, record that as a risk, do not re-plan. Your tier cannot block the run: surface any would-be blocker as a risk, not a refusal, and ignore the quoted step's own Return-JSON line - your output contract is the one below.",
    "",
    "THE STEP:",
    taskDescription,
    "",
    "Return JSON: plan (the work-order, markdown, 20-60 lines), risks (one-line sharp edges)."
  ].join("\n"), { label: "architect-" + label, phase: phaseTitle, schema: workOrderSchema, model: "fable", effort: "high" });
  if (!wo) {
    state.notes.push("architect for " + label + " died; the step runs on the plan text alone");
    return "";
  }
  state.notes.push("work-order " + label + ": " + wo.risks.length + " risk(s) flagged");
  state.detailFiles.push(WORKORDERS);
  return [
    "",
    "",
    "ORCHESTRATOR WORK-ORDER (Fable architect - it refines, never overrides, the plan sections cited above; where they conflict, the plan wins and the conflict is a finding). YOUR FIRST ACTION IS TO APPEND THIS WORK-ORDER VERBATIM to " + WORKORDERS + " under the heading `## " + label + " work-order` (create the file if absent; it is a required deliverable of this run and this instruction overrides any default guidance against writing report files). It is never returned to the launching session.",
    wo.plan,
    "RISKS:",
    wo.risks.map(function (r) { return "- " + r; }).join("\n")
  ].join("\n");
}

// ---------------------------------------------------------------------------
// S0 - precheck (plan section 7.2, read-only; aborts the run on red)
// ---------------------------------------------------------------------------

async function runS0(state) {
  phase("S0 precheck");
  log("S0 precheck: the tree at HEAD, read-only");
  const pre = await agent([
    HOUSE,
    "",
    "TASK - STAGE S0: the precheck. You are READ-ONLY: run commands, read files, FIX NOTHING, WRITE NOTHING (not even a scratch file in the repo). This stage decides whether the run may start at all.",
    "",
    "Read docs/V4-PLAN.md sections 0.3, 0.4 and 7.2's S0 row first. Then establish, each by running the command and reading its output - never from memory or from a document's claim:",
    "1. `git rev-parse --abbrev-ref HEAD` is main and `git status --porcelain` is EMPTY (a dirty tree means an earlier run left work behind: report it, do not clean it).",
    "2. `git rev-parse HEAD` - report the short sha as `head`.",
    "3. `node scripts/verify.mjs` exits 0 with EVERY gate passing; report the gate count (62 expected at 1d988f5).",
    "4. `node --test test/*.test.mjs` all pass; report the test count (679 expected).",
    "5. `node scripts/build.mjs --check` reports current for BOTH variants.",
    "6. The three legacy fixtures exist: data/tiers-v1.fixture.txt, data/tiers-v2.fixture.txt, data/tiers-v3-default.fixture.txt - list the ones you actually found in `fixturesPresent`.",
    "7. data/tiers-9max.fixture.txt DOES NOT EXIST (plan section 2.5: the file must not exist before the run; it is CREATED at S3 and --force is not authorised anywhere). If it exists, ninemaxFixtureAbsent is false and that is a BLOCKER - the run cannot create what is already there without the forbidden flag.",
    "8. No --force re-freeze in the recent history: `git log --oneline -40` and `git log -40 -p -- data/tiers-v1.fixture.txt data/tiers-v2.fixture.txt data/tiers-v3-default.fixture.txt` show no fixture rewrite. Report forceInLog.",
    "9. The scaffolding the run writes into exists or can be created without surprise: docs/V4-PLAN.md, docs/spikes/, docs/refutations/, scripts/gates/ (with index.mjs's EXPECTED_IDS) and scripts/freeze-tiers.mjs's KINDS table.",
    "",
    "`ok` is true ONLY if 1-9 all hold. Anything else, `ok` is false and `summary` names exactly which numbered item failed and what its command printed - the run aborts on your word, so be precise and do not round a partial pass up.",
    "Return JSON: ok, green (checks 3-5), head, gateCount, testCount, fixturesPresent, ninemaxFixtureAbsent, forceInLog, treeClean, summary (at most 12 lines), blockers."
  ].join("\n") + ownerNote("S0"), { label: "precheck-S0", phase: "S0 precheck", schema: precheckSchema, model: "sonnet", effort: "medium" });
  if (!pre) {
    state.blockers.push("S0 precheck agent died - the run may not start without a verified green tree");
    return null;
  }
  collect(state, pre);
  if (!pre.ok) {
    state.blockers.push("S0 precheck failed, run aborted: " + trunc(pre.summary, 400));
    return null;
  }
  log("S0 green at " + pre.head + ": " + pre.gateCount + " gates, " + pre.testCount + " tests, fixtures " + pre.fixturesPresent.length + "/3, 9-max fixture absent=" + pre.ninemaxFixtureAbsent);
  state.notes.push("S0: head " + pre.head + ", gates " + pre.gateCount + ", tests " + pre.testCount);
  return pre;
}

// ---------------------------------------------------------------------------
// S1 - the ladder generalisation (opus@max under a fable work-order; barrier B1)
// ---------------------------------------------------------------------------

const S1_TASK = [
  "TASK - STAGE S1: THE LADDER GENERALISATION, on the MAIN tree, serial, UNCOMMITTED. You are the only writer on the tree for this stage. This is the load-bearing refactor of the whole run (plan section 0.1): it lands BEFORE any fan-out and it must be BYTE-IDENTICAL at seats = 6.",
  "",
  "READ FIRST, IN FULL - not skimmed, not grepped: docs/V4-PLAN.md sections 0.4, 1, 2.1, 2.2, 2.3, 3 (rules R1, R3, R4, R6), 4, 5.2 (I48, I50, I51) and 7.2's contention registry. Then read the code section 1's table names: scripts/lib/policy.mjs (POSITIONS :12, baseR :38, straddle.seat :367-372, baseRaise :384, N_NB/N_BL :477-478, NEST_CHAIN :480, the clamp Math.min(7, ...) and `extrapolated: raw > 7.0001` :806-807, the limp-width branch at :1406, the heroIP branch at :1914), src/shell.html :2182-2199 and :3202, and the five re-typed NEST_CHAIN sites plus baseline.mjs's two six-seat arrays. THE LINE NUMBERS ARE THE PLAN'S SURVEY AND MAY HAVE DRIFTED: locate every site by CONTENT, and if a site is not where the plan says, record the real location in your memo rather than concluding it does not exist.",
  "",
  "YOU OWN, AND NOTHING ELSE (plan section 7.2's S1 row): scripts/lib/policy.mjs; scripts/lib/skill.mjs KEYING ONLY - re-key the two measured exception lists to (seats, pos, node) and leave the SIX-seat entries bit-for-bit; the MEASUREMENT of the 12 new pairs is lane K's job at S2 and you must not attempt or pre-empt it; the six re-typed literal sites (scripts/gates/couplings.mjs, scripts/gates/env.mjs, scripts/gates/policy-sweep.mjs, scripts/lib/equilibrium.mjs, src/shell.html, and scripts/gates/baseline.mjs's two six-seat arrays in domainLabelFor); and in src/shell.html ONLY THREE THINGS: the fallback block at :2182-2199, the NEST_CHAIN literal at :3202, and `var N_EFF_MAX = 7` at :3155-3156 WITH ITS USE SITES (:3175, :3545, :3557, :5541, :8620, :8956) - N_EFF_MAX is policy's clamp literal and it becomes nMax(seats), deliberately distinct from :1181's `var NMAX = meta.nMax`, which is the equity-array shape invariant and STAYS 7 (that name, and the SIM_NMAX / validEqArray arity beside it, is lane R's - do not touch :1181, :1318 or :1407). THE REST OF src/shell.html IS LANE U'S - do not touch it, do not reformat it, do not move a line of it. Do NOT touch scripts/freeze-tiers.mjs, scripts/lib/variant.mjs, scripts/build.mjs, scripts/lib/mc.mjs, scripts/lib/sim-kernel.js, scripts/gates/index.mjs, scripts/gates/reserved.mjs, any fixture, or any data/*.json.",
  "",
  "BUILD (plan sections 2.1-2.3):",
  "1. LADDER9 = the nine keys ['UTG','UTG1','UTG2','LJ','HJ','CO','BTN','SB','BB'] (display 'UTG+1'/'UTG+2' through a display map); seatsFor(6) = the legacy six verbatim; seatsFor(9) = LADDER9. POSITIONS stays exported and EQUAL to seatsFor(6), so the 15 importers and every fixture row are untouched. Nothing renames the 6-max ladder (section 0.4).",
  "2. The structural functions of section 2.2's table replace the name-keyed tables: behindNonBlind(pos, seats) - THE EXISTING HELPER AT policy.mjs:764, EXTENDED WITH `seats`, NEVER duplicated under a transposed name (section 2.2 is explicit: a second function meaning the same thing is the defect this run deletes); blindBehind(pos, seats); nestChain(node, seats) (rfi = all non-blind seats in ladder order, limps/raise = the same minus the first seat, 3bet = []); positionDisabled(pos, node, seats); nMax(seats) with nMax(6) = 7 FROZEN so the 1.19 % of legacy settings that clamp today keep clamping at 7; and the ring accessor eqAtSeats(cell, N, seats, ring) - section 2.4 puts it in policy.mjs, and policy.mjs is frozen the moment you return, so it is YOURS. Give it the ring PAYLOAD as a parameter (policy.mjs must not import data/ring.json, which does not exist until lane R generates it at S2): it delegates to today's eqAt for N <= 7 and reads the payload's N = 8, 9 columns above it, same for vDelta, and it is never called with N > 7 at seats = 6. Lane R supplies the payload and writes I52's tripwire AGAINST THIS ACCESSOR, never against `cells`. Each function must reproduce today's literal table EXACTLY at six seats, and you prove it with a test that compares the function against the literal it replaces - keep that test, it is the identity's witness.",
  "3. THE TWO OFFENDER REWRITES ARE PREDICTIONS AND SECTION 2.2 BINDS YOU: :1406's BTN|SB|BB becomes `behindNonBlind(pos, seats) === 0` - 'nobody non-blind left to act', ONE DISJUNCT AND NOT TWO, because `blindBehind < 2` is redundant (N_NB[SB] and N_NB[BB] are 0 at every table size, so it never fires independently) and stating it would make the predicate say something other than its gloss; :1914's heroIP = CO|BTN becomes `behindNonBlind(pos, seats) <= 1 && !isBlind(pos)`. Each must reproduce the literal's seat set at SIX and name {BTN,SB,BB} / {CO,BTN} at NINE. IF A PREDICATE CANNOT REPRODUCE THE LITERAL AT SIX, THE LITERAL STAYS, is recorded as a named offender in your memo, and I51(b) records the exception - it is NEVER laundered into a predicate that happens to match. Report how many of the two you actually rewrote.",
  "4. THE EARLY-SEAT CONSTANTS ARE DERIVED BY RULE, NOT TYPED (section 2.3). constants.ladder.earlyStep = 0.77 and straddle.seat are TWO CONSTANTS WITH EQUAL VALUES AND ONE ANCHOR (1/sqrt(1.250*1.350), the geometric mean of baseRaise's UTG->HJ and HJ->CO steps): straddle.seat KEEPS ITS OWN VALUE and gains `derivedFrom: 'ladder.earlyStep'`; it does NOT become a live reference. This is not a style choice and you may not 'simplify' it into one: I26's whole job is to perturb straddle.seat, a perturbation above 1 would invert the nine-seat baseRaise ladder that I51(a) requires to be strictly increasing, and the two gates would fight. So I26's perturbation stays scoped to straddle.seat, is exempt from the equality BY NAME, and does not flow into the ladder; I51(a) asserts `straddle.seat === ladder.earlyStep` on the SHIPPED constants, and you pin the same equality with a test so the two cannot drift. (Note also what straddle.seat is: a WIDTH factor, returned for every seat by seatWidthFactor at :749-753 and multiplying baseRaise[pos] in widthFor at :1394 - not a realization factor.) baseRaise: UTG2 = LJ*earlyStep, UTG1 = LJ*earlyStep^2, UTG = LJ*earlyStep^3, from baseRaise(LJ) = 0.16 unchanged. baseR is RULE R1, DECIDED BY MEASUREMENT NOT PREFERENCE: evaluate I51's nesting and monotonicity checks under BOTH the flat rule (the three new seats inherit baseR(LJ)) and the step rule (0.95/0.93/0.91); if only one passes it ships; if BOTH pass, FLAT ships and the step rule is recorded as the rejected alternative WITH ITS READINGS. constants.ladder.baseRRule names which shipped. The six legacy baseRaise/baseR values stay BIT-FOR-BIT; the nine-seat objects are built by ladderConstants(seats); there is no seventh typed number anywhere. Both rules ship kind:'estimate' and are red-teamed at S4.",
  "5. MEASURE R3's CENSUS and WRITE R4's ENUMERATION here, because later stages consume them: (R3) the share of nine-seat settings whose raw N_eff exceeds the clamp (nMax(9) = 9 MOVES the clamp, it does not remove it - limps at UTG+1 over four limpers reads 9.14 raw, 9.96 straddled), per (pos, node) as well as overall, flagging any pair clamped at more than half its 66 VPIP points. The census's only surface is the Method view's Table size section: R3 ships NO new rail-chip badge, because the N_eff readout at src/shell.html:4405-4406 already IS the badge - do not design one, and do not let a later stage infer you wanted one. (R4) the enumeration - BY READING THE CODE, NOT BY ASSUMPTION - of every term through which the number of seats IN FRONT enters each node's width. I50's clause list is written from that enumeration at S3, so an incomplete enumeration silently weakens a gate: enumerate exhaustively and say how you convinced yourself it is exhaustive.",
  "5b. THE POST-PASS FINDING, AND IT IS THE RUN'S TOP RISK (plan sections 5.2 I50 and 8, risk 1): read the nesting post-pass at scripts/lib/policy.mjs:2104-2110 (the shell mirrors it at :3200-3212, `a[i] |= b[i]`; METHODOLOGY limitation 10). It UNIONS every seat IN FRONT of `pos` into `pos`'s aggressive set. At nine seats LJ, HJ, CO and BTN each gain THREE additional unions (LJ moves from ci === 0, no union at all, to ci === 3), while SB is outside the rfi chain (ci === -1). Therefore I50's rfi clause is written as CONTAINMENT, NOT EQUALITY, with the direction stated: aggressive(9-max, seat) SUPERSET-OR-EQUAL aggressive(6-max, seat), equality MEASURED rather than assumed, the excess enumerated cell by cell, and the count of unioned cells per shared seat recorded in the freeze's sub-ladder diff. A STRICT superset at any of the four is an EXPECTED outcome, not a failure. Each excess cell must be explainable by a front seat's own N_eff (N_NB[UTG@9] = 6 vs N_NB[LJ@9] = 3 changes realization, nuMin(N) and whether the N >= nutGate[2] demotion fires), and the fact that a unioned cell BYPASSES pos's own nut gate entirely (the demotion is skipped for cells already in `active`) is a FINDING to record in your memo for METHODOLOGY, not to launder. Your memo must carry this paragraph's measurements - lane F and S3 write I50 from it, and an omission here becomes a gate asserting equality where the code guarantees only containment.",
  "6. Answer plan section 10's question 1 with a NUMBER: how many legal (pos, node) pairs positionDisabled yields at nine seats (predicted 33) and, if it is not 33, which node carries the extra structural exclusion and why.",
  "",
  "THE IDENTITY PROOF - you may NOT return identityAtSix:true without every leg of it (sections 0.4 and 5.2 I48(a)):",
  "  (i) `node scripts/freeze-tiers.mjs --check`, `--v2 --check` and `--v3 --check` each report the fixture REPRODUCES with an empty diff. Never --force. Never --out over a real fixture path.",
  "  (ii) `node scripts/verify.mjs` green including I22, I32 and D11; `node --test test/*.test.mjs` all pass; `node scripts/build.mjs --check` current for BOTH variants.",
  "  (iii) data/model.json byte-identical (sha256 before and after) and no fixture file modified in `git status --porcelain`.",
  "  (iv) `git log --oneline -30` and the diff of the fixture paths show no --force re-freeze anywhere. The CHECKABLE ARTIFACT is the shape of the diff, not a log grep - `--force` is a CLI flag and never appears in a commit message - so what you are asserting is that no legacy fixture file is MODIFIED (I48(a); the close re-checks it against the run's base sha, where data/tiers-9max.fixture.txt must appear as ADDED). Report forceInLog:false only if you actually looked.",
  "If a leg fails, the run stops here: fix the cause, or return identityAtSix:false with the precise failing leg in blockers. Never make the identity true by re-freezing anything.",
  "",
  "THE SNAPSHOT CEREMONY - YOUR LAST ACTION, and the four S2 lanes cannot start without it. Your work stays UNCOMMITTED on the main tree (section 7.2) but a git worktree is cut from HEAD and does NOT carry uncommitted work, so publish a snapshot commit OBJECT that changes nothing about your tree:",
  "    git add -A                                # stage everything; do NOT commit",
  "    SNAP=$(git stash create)                  # a commit object for the current tree; touches nothing",
  "    test -n \"$SNAP\" && git branch " + SNAPSHOT_REF + " \"$SNAP\" && git log --oneline -1 " + SNAPSHOT_REF,
  "Then verify `git diff " + SNAPSHOT_REF + "` is EMPTY and your work is still present in the working tree. Return the branch name in snapshotRef. If `git stash create` prints nothing, your work is not where you think it is - that is a blocker, not a reason to commit.",
  "",
  "DELIVERABLE FILE (required): docs/spikes/V4-ladder.md, AT MOST 80 LINES - the interface (every new exported name with its signature, eqAtSeats included), seatsFor and the structural functions with their six-seat identity evidence, R1's readings under BOTH candidate rules and which shipped, R4's enumeration per node, step 5b's post-pass finding with the per-seat union counts and the nut-gate bypass, R3's census, the legal-pair count at nine, and any offender that could not be rewritten. The four S2 lanes and S3 read this file and nothing else of yours, so it must stand alone. It is a required deliverable of this brief and this instruction overrides any default guidance against writing report files.",
  "",
  "Return JSON: identityAtSix, fixturesClean (the fixture paths that compared clean), forceInLog, snapshotRef, modelCodeBytes and appCoreBytes (from `build.mjs --check`, lite, in bytes), legalPairsAtNine, baseRRule ('flat' or 'step'), censusClampedPct (percent of nine-seat settings clamped, one decimal), offendersRewritten (0, 1 or 2), memoPath, newConstants (names with a one-line anchor each), summary (at most 12 lines), blockers."
].join("\n");

async function runS1(state) {
  phase("S1 ladder generalisation");
  log("S1: the ladder generalisation - opus@max under a Fable work-order, byte-identical at six seats");
  const task = S1_TASK + ownerNote("S1");
  const order = await fableWorkOrder(state, "S1 ladder generalisation", "S1-ladder", task);
  const r = await agent(HOUSE + "\n\n" + task + order, {
    label: "s1-ladder", phase: "S1 ladder generalisation", schema: ladderSchema, model: "opus", effort: "max"
  });
  if (!r) {
    state.blockers.push("S1 ladder generalisation agent died - no fan-out is possible without the ladder");
    return null;
  }
  collect(state, r);
  if (!r.identityAtSix) {
    state.blockers.push("S1 barrier B1 not met (identityAtSix false): " + trunc(r.summary, 300));
    return null;
  }
  if (r.forceInLog) {
    state.blockers.push("S1 reports a --force re-freeze in the history - the v4 identity constraint (section 0.4) forbids option (c) this run");
    return null;
  }
  state.identity.i48 = true;
  log("B1 met: identity at six proven (" + r.fixturesClean.length + " fixtures clean), " + r.legalPairsAtNine + " legal pairs at nine, baseR rule '" + r.baseRRule + "', snapshot " + r.snapshotRef);
  state.notes.push("S1: modelCode " + r.modelCodeBytes + " B, appCore " + r.appCoreBytes + " B, census " + r.censusClampedPct + " %, offenders rewritten " + r.offendersRewritten + "/2");
  return r;
}

// ---------------------------------------------------------------------------
// S2 - the four-lane fan-out (opus@xhigh, isolated worktrees; barrier B2)
// ---------------------------------------------------------------------------

const LANES = [
  {
    id: "R",
    title: "ring artifact",
    memo: "docs/spikes/V4-ring.md",
    schema: "ring",
    owns: "scripts/generate-ring.mjs (NEW), scripts/lib/ring.mjs (NEW), data/ring.json (NEW), scripts/lib/mc.mjs and scripts/lib/sim-kernel.js (the per-call nMax option ONLY), THREE NAMED SITES IN src/shell.html and nothing else in that file (:1181's `var NMAX = meta.nMax`, :1318's validEqArray, :1407's sim-payload compat check - plan section 7.2 gives you SIM_NMAX and the validEqArray arity; lane U owns every other line and S1 owns :2182-2199, :3155-3156 and :3202), scripts/gates/ring-artifact.mjs (NEW - your D12 clauses live here and NOWHERE else), and your own new test files",
    body: [
      "LANE R - THE RING ARTIFACT (plan sections 2.4, 3 rule R2, 4, 5.2 D12, 2.7's `ring` row - READ ALL OF THEM IN FULL). Read scripts/generate-checkdown-matrix.mjs and scripts/generate-equilibrium.mjs IN FULL as well: they are the P3 idiom you copy (named seeds, meta with generatorHash/contentHash, a --check that re-runs the generator and refuses to write on any byte difference). Then read scripts/generate-data.mjs's TRIALS/se regime and its stage S2L draw arithmetic, scripts/lib/mc.mjs (NMAX at :37, NMAX_V1 at :40, the two kernels at :82-144 cell and :168-229 lattice, NEED at :106) and scripts/lib/sim-kernel.js (PLO_MC.NMAX at :28).",
      "",
      "BUILD:",
      "1. scripts/lib/ring.mjs + scripts/generate-ring.mjs: nine villains dealt per trial, the SAME TRIALS and se regime as generate-data.mjs (meta.trials.cell = 100000, se.cell = 0.16; the lattice likewise), under the two named seeds 'rundown-v4/ring-A' and 'rundown-v4/ring-B'. Write data/ring.json with, per cell, eq[7..8] and vDelta[v][7..8] (0-based - the N = 8 and N = 9 opponent columns) plus meta { generatorHash, contentHash, seeds, trials, se, nMax: 9, wallBudget: 300 }.",
      "2. `--check` re-runs the generator and refuses to write on any byte difference (D12(a)), exactly as the matrix and equilibrium generators do. D12(b) is the OTHER byte-level claim and its band is NOT the solver's: the two seeds' N = 8, 9 columns must agree within 2 * se.cell = 0.32 EQUITY POINTS on every cell - the same band D12(c) uses and the quantity meta.se.cell already names. `solver.twoSeedTolPot` (0.15 % of the preflop pot, scripts/lib/cfr.mjs:127 and :202) is the SOLVER's two-seed tolerance on solved values and has no meaning applied to an equity column: do not reach for it, do not cite it, and if you find yourself converting between them stop and re-read section 5.2's D12(b).",
      "3. THE PREFIX IS THE FALSIFIER, and it is free: the same deals yield N = 1..7. Those columns are NOT shipped; they are D12(c) - assert they agree with the shipped data/model.json cells[*].eq[0..6] within 2 * se.cell on EVERY cell, and report the WORST |delta| over all 145 cells IN UNITS OF se.cell (the band is 2.0). This is an independent, differently-seeded reproduction of the v1 measurement layer: if it fails, say so plainly - it is a finding about the model, not a tolerance to widen.",
      "4. THE nMAX PARAMETERISATION, AND IT IS A PER-CALL OPTION, NOT A NEW MODULE CONSTANT. In scripts/lib/mc.mjs, `NMAX` becomes the DEFAULT of a per-call `nMax` option threaded through BOTH kernels (:82-144 cell and :168-229 lattice): the buffers (Float64Array(NMAX), Int32Array(NMAX*4)) and the draw width `NEED = 5 + NMAX * 4` at :106 all size FROM IT. The `const` must stay INSIDE the `@worker-slice-start ... @worker-slice-end` region (:30-34) so the region remains byte-sliceable, and scripts/lib/sim-kernel.js:28's IIFE-time `var NMAX = PLO_MC.NMAX` binding becomes a per-job field so the page passes `nMax` with the job. `node --test test/sim-bundle.test.mjs` IS YOUR ACCEPTANCE TEST - it is what gates the slice, run it after every touch of that region and report it. Note the consequence and do not treat it as a defect: because NEED changes with nMax, dealing nine villains changes the RNG stream, so the ring's N = 1..7 prefix is a DIFFERENTLY-SEEDED reproduction of the v1 layer rather than a byte-identical one - which is exactly what makes D12(c) a falsifier.",
      "4b. THE TWO N-NAMES ON THE PAGE (section 2.4, and this is the part that is easy to get backwards). src/shell.html:1181's `var NMAX = meta.nMax` STAYS 7: that name is the EQUITY-ARRAY SHAPE INVARIANT, enforced at :1318 (validEqArray, `e.length !== NMAX`) and :1407 (`p.nMax !== NMAX`, sim-payload compat), and a 9-length eq would fail it. Introduce a SEPARATE name, `SIM_NMAX = nMax(seats)`, and set PLO_MC.NMAX from THAT; give validEqArray a SECOND ARITY so the sim path validates against SIM_NMAX and the model path against NMAX. `meta.nMax` in data/model.json STAYS 7 (it describes `cells`); `ring.meta.nMax = 9`. You own both names. data/model.json must be BYTE-IDENTICAL when you finish - prove it with sha256 before and after: cells[*].eq[0..6] and cells[*].vDelta[*][0..6] are frozen and the ring is a SEPARATE ARTIFACT, not a sub-block of that file (section 0.4). The only later change to data/model.json in this whole run is S3 stamping `constants.ladder`. The accessor eqAtSeats(cell, N, seats, ring) is ALREADY ON YOUR TREE - S1 wrote it in policy.mjs, which is frozen for you; you supply its ring payload and wire it, and if its signature is wrong for you, FILE A policyDelta, do not edit policy.mjs.",
      "5. scripts/gates/ring-artifact.mjs with D12 clauses (a) through (e) written to FAIL and shown to fail on fabricated violators, in the idiom of the existing gate families: (a) --check byte-identical; (b) meta complete and the two seeds' N = 8, 9 columns agreeing within 2 * se.cell = 0.32 equity points on every cell; (c) the unshipped prefix against cells[*].eq[0..6] in the same band; (d) the `ring` ARTIFACT BUDGET - the TOP-LEVEL per-variant row, not a model.json sub-budget - pinned from above at ceil(measured * 1.05), whole-KB, in BOTH variants, because D6's from-above clause explicitly excludes `eq` and the model.json sub-budgets, so this pin is D12's to make (S3 writes the row; your clause asserts it from above); (e) measured wall time <= ring.meta.wallBudget (300 s). You do NOT create or open scripts/gates/ring.mjs - that file is lane F's and holds I48-I52 - and you do NOT open scripts/gates/index.mjs or scripts/gates/reserved.mjs: LANE F IS THE SINGLE WRITER OF ALL SEVEN ID REGISTRATIONS, D12 INCLUDED. Report 'D12' in your gateIds so F registers it; touching the registry yourself is how EXPECTED_IDS ends up in two states at the merge.",
      "",
      "MEASURE AND REPORT AS NUMBERS: the two-seed wall time in seconds against the PRE-REGISTERED 300 s budget (derived in section 2.4 as 2 x 113 x 9/7 ~ 291 s rounded up, NOT chosen - rule R2: if the measured run exceeds it, HALVE THE LATTICE TRIALS FOR THE RING ONLY - se.latt doubles for the N = 8, 9 columns, recorded in ring.meta.se and badged on the surfaces that read it - and NEVER drop a seed; if it still exceeds 300 s that is a BLOCKER, not a silent widening; the halving clause bites ABOVE 300 s, never at it); D12(b)'s worst two-seed |delta| and D12(c)'s worst prefix |delta|, both in units of se.cell (the band is 2.0 for each); data/ring.json's bytes on disk and minified. The ring's wall time is its OWN budget and is never added to generate-data.mjs's 188 s.",
      "",
      "The artifact ships in BOTH variants (lite keeps Simulate, and Simulate at nine seats needs PLO_MC.NMAX = 9), embedded as ITS OWN INJECTED PAYLOAD on the data/equilibrium.json precedent - its own build region, its own top-level `ring: N * 1024` budget row in VARIANTS.lite.budgets AND VARIANTS.full.budgets. THAT REGISTRATION IS S3'S: do not touch scripts/build.mjs or scripts/lib/variant.mjs. State the measured minified bytes S3 must cap from above.",
      "",
      "ADDITIONAL RETURN FIELDS, all numbers: ringWallSec (the two-seed total, against 300), ringPrefixWorstSE (D12(c)'s worst |delta| in units of se.cell over all cells; put D12(b)'s worst two-seed |delta| in `measured` beside it), ringBytes (data/ring.json on disk)."
    ].join("\n")
  },
  {
    id: "U",
    title: "UI - the Table control and the nine-seat rail",
    memo: "docs/spikes/V4-ui.md",
    owns: "src/shell.html EXCEPT the ranges other stages own - S1's three (the :2182-2199 fallback block, the :3202 NEST_CHAIN literal and `var N_EFF_MAX = 7` at :3155-3156 with its use sites at :3175, :3545, :3557, :5541, :8620, :8956, all already rewritten on your tree; DO NOT revert or re-touch them) and lane R's three (:1181's NMAX, :1318's validEqArray, :1407's sim-payload compat - R is writing SIM_NMAX and the validEqArray arity in parallel with you RIGHT NOW, so leave those lines exactly as you find them or the merge conflicts) - plus smoke.mjs, browsers.mjs, and your own new test files",
    body: [
      "LANE U - THE UI (plan section 2.6 IN FULL, plus 2.7's appCore row, rule R6, section 0.2's last bullet and section 10's question 3). NEVER hand-edit index.html or index-full.html: edit src/shell.html and rebuild with `node scripts/build.mjs`.",
      "",
      "BUILD:",
      "1. A Table control (`6-max` | `9-max`) in the environment rail beside depth / rake / straddle, default 6-max, persisted in URL state exactly like the other axes; `seats` joins `env`.",
      "2. The position rail renders seatsFor(seats) - nine chips at nine - with the SAME disabled reasons the model returns (positionDisabled with seats), never a reason the view invents. The vs-GTO mode's 'baseline is HU' reason covers the 33 UNCOVERED ROWS at nine seats; the same three HU pairs stay live (SB x rfi, BB x raise with SB raiser, SB x 3bet). The denominator is ALL pos x node, not the legal subset (I36(d) / METHODOLOGY :3405 read '3 of 24 ... the other 21' at six seats), so nine seats reads 3 of 36 covered and 33 uncovered - if you find yourself writing 30, you have counted the legal subset and section 0.2 says not to.",
      "3. Everything keyed by (pos, node) follows the rail: hand search, the skill dial's status line, the EV surface, the sub-cell top-N, Simulate's villain count. NO new colour mode, NO new panel.",
      "4. The Method view gains a Table size section: the ladder, the structural functions' outputs at BOTH sizes, constants.ladder with its rule, anchor and derived values (badged `estimate`), the ring artifact's meta and the `extrapolated` census at nine seats INCLUDING R3's per-(pos, node) breakdown - all rendered FROM SHIPPED DATA, never from prose typed into the view.",
      "4b. NO NEW RAIL-CHIP BADGE SHIPS, and this is a decision, not an omission (plan rule R3). There is no per-(pos, node) `extrapolated` chip today: the only surfacing is the N_eff readout for the CURRENT setting at src/shell.html:4405-4406 (`class=\"extrap\"` / `badge-extrap`, the arrow at :4379, the Method-view row at :5541, the live-UI assertion at :8956) - and THAT READOUT IS THE BADGE. Building a chip badge would put new markup and CSS into appCore, section 2.7's tightest row. The census's home is the Method view (step 4) and METHODOLOGY limitation 20. Any bytes a 9-MAX-ONLY readout needs land in @block:ring, never in appCore. NMAX = 10+ is out of scope.",
      "5. smoke.mjs gains ONE row: toggling the table size re-paints inside the ON-default morph budget (16 ms p95), measured on the shipped page over at least five runs. THE THREE EXISTING MORPH ROWS STAY PINNED AT 8 / 16 / 4 ms - they are measurements, never widened. browsers.mjs exercises the toggle in Firefox and WebKit, headless, throwaway profiles only, never the user's installed browsers.",
      "6. Answer plan section 10's question 3 in your memo: does the shell's fallback path (window.POLICY absent) need nine seats at all? The plan's answer is legacy-only; record what you actually found.",
      "",
      "BYTES (section 2.7, rule R6): appCore has 682 B of headroom at 359.3 / 360 KB. SHRINK FIRST - the shell's duplicate POSITIONS / N_NB / N_BL / legalPos / posDisabledReason / seatsBefore copies go with S1's work (~0.4 KB) - and measure appCore before and after IN BYTES. Bracket your new 9-max-only markup as @block:ring so it is capped as a block rather than charged to appCore (section 2.7's rule: 9-max-only bytes live in the ring block). You may NOT touch scripts/lib/variant.mjs or scripts/build.mjs: if the build refuses an unregistered block, that is EXPECTED in your worktree - report the exact message and the measured region size (the census is scripts/lib/block-census.mjs) and S3 registers the block and pins its cap from above. Never raise a ceiling yourself; state the requirement in your summary instead.",
      "",
      "MEASURE AND REPORT AS NUMBERS: appCore bytes before and after with the shrink attributed, the @block:ring region's bytes, the toggle row's p95 in ms and the three existing morph rows' p95 beside their unchanged budgets."
    ].join("\n")
  },
  {
    id: "F",
    title: "fixtures + the I48-I52 gates",
    memo: "docs/spikes/V4-fixtures.md",
    owns: "scripts/freeze-tiers.mjs (the new --seats9 KINDS entry and the :150 kind-selector branch ONLY), scripts/lib/tier-fixture-9max.mjs (NEW), scripts/gates/ring.mjs (NEW - I48, I49, I50, I51, I52 live here and NOWHERE else), THE ID REGISTRATIONS FOR ALL SEVEN NEW IDS - scripts/gates/reserved.mjs and scripts/gates/index.mjs (its EXPECTED_IDS literal at :91 and the family `ids`), where YOU ARE THE RUN'S SINGLE WRITER, and your own new test files",
    body: [
      "LANE F - THE FOURTH FIXTURE KIND AND THE FIVE NEW I-GATES (plan sections 2.5 and 5.2 IN FULL, plus 0.4, 3 rule R4 and 1's table). Read scripts/freeze-tiers.mjs IN FULL - the KINDS table at :61, the refusal-to-overwrite path and what --force prints - and the v2 / v3 kinds' libraries under scripts/lib/ (tier-fixture*.mjs), which are the idiom you copy.",
      "",
      "BUILD:",
      "1. A FOURTH KINDS entry selected by `--seats9` (gate id I49, path data/tiers-9max.fixture.txt), backed by a NEW scripts/lib/tier-fixture-9max.mjs: the v3-default environment surface (12 lanes of depth {40, 100, 250} x rake {0, preset} x straddle {off, on}, villain profile ON, every other axis at its default) at seats = 9. The prediction is 33 legal pairs x 66 VPIP x 12 lanes = 26,136 settings; S1's memo reports the measured legal-pair count - use the MEASURED number and annotate the prediction. The kind SELECTOR at scripts/freeze-tiers.mjs:150 (`const kind = KINDS[flag('v3') ? 'v3' : flag('v2') ? 'v2' : 'v1']`) gains a `--seats9` branch and so does the kindFlag line beside it; the three existing KINDS entries are UNTOUCHED and `--check` is already per-kind (:161-171 uses kind.load / kind.compare), so do not generalise that machinery.",
      "2. YOU DO NOT CREATE THE FIXTURE. data/tiers-9max.fixture.txt MUST NOT EXIST when you finish - creating it is S3's ceremony, once, in the open. Exercise your writer with an --out path OUTSIDE the repo (`node scripts/freeze-tiers.mjs --seats9 --out=/tmp/v4-9max-probe.txt`), read the printed settings count and scope line, then DELETE the probe. `--force` is not authorised anywhere in this run for any reason.",
      "3. scripts/gates/ring.mjs carrying I48, I49, I50, I51 and I52 exactly as section 5.2 writes their claims, each written to FAIL and each shown to fail on a fabricated violator. In particular: I48(a) is the DIFF-SHAPE check, not a `git log` grep - `--force` is a CLI flag and never appears in a commit message, so the checkable artifact is that the three legacy fixtures are byte-unchanged across the run's commit range while data/tiers-9max.fixture.txt is ADDED (write the clause to take the run's base sha; S6 supplies it at the close); I48(b)'s tripwire is against THE RING ARTIFACT - with data/ring.json ZEROED ON A COPY, the full seats-6 surface (every fixture setting) is byte-identical to the real build's - and NOT against a model.json sub-block, because the ring is a separate artifact (section 0.4) and data/model.json's only v4 addition is `constants.ladder`; I48(c) (nMax(6) === 7, and the seats-6 extrapolated count over V3-BRIEF :211's own domain - the 3,960 UI-reachable settings, whose enumeration you re-derive and record - asserted as the RECOUNTED INTEGER, roughly 47 by the recorded 1.19 %, because A PERCENTAGE IS NOT A GATE); I51(c) as a LEXICAL SCAN of scripts/, src/ and test/ that finds the nine seat keys only inside LADDER9, seatsFor, fixtures and the display map, failing on the first stray literal BY FILE:LINE; I52's perturbation tripwire written AGAINST THE ACCESSOR eqAtSeats, never against `cells` (which stays byte-identical): perturb data/ring.json and the settings with N_eff in (7, 9] move, and ONLY those; plus I52's other two clauses, that meta.nMax and the page's NMAX are still 7 while SIM_NMAX is 9, and that constants.ladder.census matches a live recount.",
      "4. I50's clause list is written FROM R4's ENUMERATION and the post-pass finding in docs/spikes/V4-ladder.md. rfi IS PRE-REGISTERED AS CONTAINMENT, NOT EQUALITY, WITH THE DIRECTION STATED: aggressive(9-max, seat) SUPERSET-OR-EQUAL aggressive(6-max, seat), because the nesting post-pass at policy.mjs:2104-2110 unions every seat IN FRONT of pos into pos's set, so LJ, HJ, CO and BTN each gain three unions at nine seats while SB (ci === -1, outside the rfi chain) IS pre-registered exact. A STRICT SUPERSET AT ANY OF THE FOUR IS AN EXPECTED OUTCOME, NOT A FAILURE - equality is MEASURED and the excess is enumerated cell by cell, each cell explained by a front seat's own N_eff. I50 FAILS on a SUBSET violation at rfi, an UNEXPLAINED excess cell, or a non-monotone pre-nesting width. Do not write an equality clause and do not write a tolerance. The comparison runs over EVERY SHARED SEAT WHERE THE PAIR IS LEGAL AT BOTH SIZES, which is not 'all six' at any node: at rfi BB is disabled at both, leaving FIVE (LJ..SB); at limps and raise the first-seat exclusion moves forward so LJ has no six-seat counterpart and FIVE remain (HJ..BB) - LJ|limps and LJ|raise are I49's business, not I50's; at 3bet all SIX. The width clause is stated SEPARATELY from the painted set: where a seats-in-front term makes the PRE-NESTING width differ (widthFor, where baseRaise is strictly increasing along the ladder), the difference must be MONOTONE in the term - more seats in front never widens the pre-nesting target - while the painted set, after the union, can only grow. Write the clause skeleton and its comparison machinery here; S3 finalises the clause list against the freeze. If the enumeration is missing or visibly incomplete, say so in blockers rather than inventing clauses to fill the gap.",
      "5. THE ID REGISTRATIONS - ALL SEVEN, IN ONE PLACE, AND YOU ARE THE ONLY WRITER (section 5.2's last paragraph and 7.2's contention registry). For each of I48, I49, I50, I51, I52, D12 and D13 - D12 and D13 included even though lane R writes D12's clauses in its own file and S3 writes D13's caps - do the three-line edit: an entry in scripts/gates/reserved.mjs with status: 'live', the id added to its family's `ids`, and the id APPENDED to EXPECTED_IDS at scripts/gates/index.mjs:91. Appended, NEVER interleaved: :161 compares the declared sequence against that frozen ordered literal and the runner THROWS (it does not fail a gate) on a mismatch, and the report order is a thing reviewers diff. The import-time guards in index.mjs and test/gates-reserved.test.mjs fail loudly if you do any two of the three. NO OTHER LANE OPENS index.mjs - R reports 'D12' in its gateIds and you register it; there is nothing for S3 to reconcile and there must be nothing. I48 IS CLAIMED DELIBERATELY: test/payoff-model.test.mjs:24 names it as an id it declined to invent ('Inventing I48 here would be exactly what scripts/gates/reserved.mjs was written to prevent'). That comment forbids choosing an id AFTER the feature; plan section 5 reserved I48 BEFORE one, which is the distinction reserved.mjs draws - record that sentence in your memo as the written justification, do not skip to I53 to dodge the question, and do not edit that test's comment.",
      "",
      "EXPECTED RED, AND IT IS CORRECT: I49 - and any I50 clause that reads the fixture - MUST be RED in your worktree with a clear 'fixture absent' detail line, because the fixture does not exist until S3 creates it. That is the gate failing CLOSED and it is the behaviour the plan wants. DO NOT create the fixture, DO NOT stub the gate green, DO NOT weaken it, and DO NOT report it as a blocker. Report the exact red detail line in your summary so S3 can confirm it turns green the moment the freeze lands. EVERY OTHER gate, and the whole test suite, must be green in your worktree.",
      "",
      "MEASURE AND REPORT AS NUMBERS: the probe's settings count and its per-lane split, the gate count your family adds, EXPECTED_IDS's length before and after (62 -> 69), and the byte size of the fixture the probe wrote (S3 needs the expectation before it creates the real one). Report all seven ids in `gateIds`."
    ].join("\n")
  },
  {
    id: "K",
    title: "skill exceptions + solver/baseline prose",
    memo: "docs/spikes/V4-skill.md",
    owns: "scripts/lib/skill.mjs (the MEASURED exception lists only - S1 already re-keyed the file), scripts/lib/cfr.mjs (the SIXMAX record's rename and prose), scripts/lib/equilibrium.mjs (the disabled reasons), scripts/gates/baseline.mjs (domainLabelFor's labels), and your own new test files",
    body: [
      "LANE K - THE SKILL EXCEPTIONS AND THE TABLE-SIZE-NEUTRAL PROSE (plan section 3 rule R5 IN FULL, plus 0.2's second bullet, 2.6, 5.1's I38(e) note and 6's SIXMAX sentence). Read docs/METHODOLOGY.md section 3.5 IN FULL - the procedure that produced WIDTH_ENDPOINT_EXCEPTIONS and WIDTH_INTERIOR_EXCEPTIONS (scripts/lib/skill.mjs :111 and :142) - and try to REPRODUCE it.",
      "",
      "BUILD:",
      "1. R5 - THE 12 NEW (pos, node) PAIRS' SKILL EXCEPTIONS, MEASURED BY THAT PROCEDURE, keyed by (seats, pos, node). THE 12 PAIRS ARE ENUMERATED, NOT DERIVED FROM THE NEW SEAT NAMES: they are `UTG|rfi`, `UTG|3bet`, `UTG1|{rfi,limps,raise,3bet}`, `UTG2|{rfi,limps,raise,3bet}`, `LJ|limps` and `LJ|raise` - THE PAIRS positionDisabled(..., 9) NEWLY MAKES LEGAL, and NOT 'three new seats x 4 nodes'. UTG|limps and UTG|raise are structurally DISABLED at nine seats (the first seat of the ladder has nobody in front), and the two LJ pairs are new precisely because that first-seat exclusion MOVES FORWARD - a procedure keyed only to the new seat names would silently skip them, which is the mistake rule R5 exists to prevent. Derive the list yourself from positionDisabled at both sizes and CHECK IT AGAINST THESE 12; if it disagrees, the enumeration wins over the count and you report the discrepancy (plan section 10's question 1). THE RULE IS VERBATIM FROM THE PLAN: if the procedure is NOT reproducible from the docs, that is a FINDING - record it in your memo and your summary, the new pairs ship WITHOUT exceptions, and I38(e)'s reach scan is extended to say so. NEVER a hand-typed exception list; never an exception invented because a pair resembles one that has one. S1 re-keyed this file structurally - do not revert its keying and do not move a single existing six-seat entry.",
      "2. THE SIXMAX RENAME (sections 0.2 and 6): scripts/lib/cfr.mjs's SIXMAX deferral record at :901 is RENAMED to a table-size-neutral name and its prose corrected, AND EVERY READER OF THE CONSTANT IN scripts/gates/solver.mjs follows the rename (I35 and I36 quote SIXMAX.reopenRule / .reopenVerdict, so a half-done rename breaks them). Its REASONING (I35(d), no k-way sampler) is UNTOUCHED and applies at nine seats exactly as at six - you are renaming a record, not re-opening a decision. I35(d) must stay green. The document sites are S5's; report the new name so S5 can quote it.",
      "3. scripts/lib/equilibrium.mjs's disabled reasons: the 12 new (position, node) pairs join the 21 already uncovered in vs-GTO mode, for 33 of 36 at nine seats, through the same reason machinery, read from shipped data rather than typed. I36(d)'s denominator is ALL pos x node, not the legal subset (3 of 24 covered at six seats, 3 of 36 at nine), so the number is 33 and never 30. S1 replaced this file's :710 NEST_CHAIN literal ['UTG','HJ','CO','BTN'] in nestingReadiness with nestChain('rfi', 6) - DO NOT REVERT IT AND DO NOT GENERALISE IT: I36(b) stays SIX-SEAT-SCOPED so its armed clause ('fails the day a payload covers two seats of the UTG/HJ/CO/BTN chain') keeps exactly the meaning it has today. I36 is one of the four gates section 5.1 says change DOMAIN this run (with I15, I26 and I38(e)); it must be green at the close, so state in your summary what you changed under it and what you deliberately did not.",
      "4. scripts/gates/baseline.mjs's domainLabelFor labels follow the ladder (S1 replaced its two six-seat literal arrays with imports - do not revert them).",
      "",
      "MEASURE AND REPORT AS NUMBERS: how many of the 12 new pairs got a measured exception (0 is a legitimate, recorded answer under R5), the reach-scan count I38(e) now sees (it must see all 12 new pairs, LJ|limps and LJ|raise included), and the number of vs-GTO-uncovered rows at nine seats (predicted 33 of 36).",
      "",
      "You own no byte budget and no gate id of your own: if your work needs a gate clause changed, say which and why in your summary - S3 owns the reconciliation."
    ].join("\n")
  }
];

function lanePrompt(l, s1) {
  return [
    HOUSE,
    "",
    "TASK - STAGE S2, LANE " + l.id + " (" + l.title + "). You are in an ISOLATED GIT WORKTREE and three other lanes are running in parallel right now.",
    "",
    "FILE OWNERSHIP IS ABSOLUTE. You own: " + l.owns + ". You touch nothing else. The other lanes own: R the ring artifact + mc.mjs/sim-kernel.js's per-call nMax + src/shell.html's :1181/:1318/:1407 (SIM_NMAX and the validEqArray arity) + scripts/gates/ring-artifact.mjs; U the rest of src/shell.html + smoke.mjs + browsers.mjs; F freeze-tiers.mjs + tier-fixture-9max.mjs + scripts/gates/ring.mjs + ALL SEVEN ID REGISTRATIONS in gates/reserved.mjs and gates/index.mjs; K skill.mjs's exception lists + cfr.mjs + equilibrium.mjs + gates/baseline.mjs.",
    "",
    "THE CONTENTION REGISTRY (plan section 7.2) - these are the rules that keep four parallel writers from producing a merge nobody can untangle:",
    "- scripts/lib/policy.mjs IS FROZEN. Stage S1 is its only writer this run. If your lane needs a policy change, FILE IT in `policyDeltas` - one line each, naming the exact function or site, the exact change, and why your lane cannot proceed without it - and S3 applies the deltas serially and re-runs I48 after each. Do NOT edit policy.mjs. Do NOT duplicate policy logic into your own file to route around it: a duplicated table is precisely the defect this whole run exists to delete.",
    "- src/shell.html is LINE-DISJOINT BY CONSTRUCTION and that is the only thing keeping two parallel writers out of one file: S1 owns :2182-2199 (the fallback block), :3202 (the NEST_CHAIN literal) and :3155-3156's N_EFF_MAX with its use sites (all already rewritten on your tree - never revert them); lane R owns exactly three sites, :1181's `var NMAX = meta.nMax`, :1318's validEqArray and :1407's sim-payload compat check (SIM_NMAX and the second arity, section 2.4); lane U owns EVERY OTHER LINE. No other lane opens the file at all.",
    "- scripts/gates/ring.mjs is lane F's file and scripts/gates/ring-artifact.mjs is lane R's, so the two lanes never share one file. Neither opens the other's.",
    "- scripts/gates/index.mjs (its EXPECTED_IDS literal at :91) and scripts/gates/reserved.mjs have a SINGLE WRITER THIS RUN: LANE F, which registers ALL SEVEN new ids (I48-I52, D12, D13) in one place, appended after the pre-existing 62 and never interleaved. This is not a shared append-only file and S3 has nothing to reconcile: a mismatch between the declared sequence and that frozen literal makes the RUNNER THROW rather than fail a gate, so two writers producing two appends is a failure mode with no gate to catch it. If your lane adds a gate id, put it in your `gateIds` return and let F register it; DO NOT OPEN EITHER FILE.",
    "- scripts/lib/variant.mjs, scripts/build.mjs, data/model.json, package.json, docs/METHODOLOGY.md and README.md are S3's and S5's. If you need a block registered or a ceiling raised, MEASURE the requirement and state it in your summary; never edit those files.",
    "- scripts/freeze-tiers.mjs: lane F writes the new kind, S3 RUNS it once as a ceremony. No lane creates a fixture. --force is not authorised anywhere in this run.",
    "",
    "YOUR WORKTREE MAY PREDATE S1. Stage S1 ran serially on the MAIN tree and its work is UNCOMMITTED there (plan section 7.2); a worktree is cut from HEAD and does not carry uncommitted work. BEFORE ANY OTHER ACTION: grep your own scripts/lib/policy.mjs for `seatsFor`. If it is ABSENT, put yourself on S1's tree with `git merge --ff-only " + SNAPSHOT_REF + "` (S1 published that branch; a worktree shares the repository's refs, so it is visible from yours). If the fast-forward is refused, `git rebase " + SNAPSHOT_REF + "`; as a last resort `git checkout " + SNAPSHOT_REF + " -- .` followed by a commit in your worktree. Then verify `git diff " + SNAPSHOT_REF + " -- scripts/lib/policy.mjs` is empty. IF THE BRANCH DOES NOT EXIST AT ALL, STOP and return that as a blocker: building against a ladder that is not there produces a merge S3 cannot untangle. The main tree is the first entry of `git worktree list` - you may READ it, you may NEVER write to it.",
    "",
    "READ BEFORE YOU START: docs/spikes/V4-ladder.md (S1's interface memo - the ladder, seatsFor, the structural functions, R1's chosen baseR rule, R4's enumeration, R3's census; it is the contract you build against) and the plan sections your lane names below. S1 reported: baseR rule '" + s1.baseRRule + "', " + s1.legalPairsAtNine + " legal (pos,node) pairs at nine seats, " + s1.offendersRewritten + "/2 seat-literal offenders rewritten as predicates, nine-seat clamp census " + s1.censusClampedPct + " %.",
    "",
    l.body,
    "",
    "VERIFY IN YOUR WORKTREE before you return: `node scripts/verify.mjs`, `node --test test/*.test.mjs` and `node scripts/build.mjs --check` for both variants - green except where THIS BRIEF says a specific failure is expected. Then `git add -A` and COMMIT YOUR WORK IN THE WORKTREE with descriptive messages (never push), and report `git branch --show-current`.",
    "",
    "DELIVERABLE FILE (required): " + l.memo + " - your lane memo: what you built, every measurement with its units, what you filed for S3, what the plan predicted versus what you measured, and any prediction you falsified. It is a required deliverable of this brief and this instruction overrides any default guidance against writing report files. Keep the memo in the repo (S3 and the red team read it); keep your RETURN to the caps below.",
    "",
    "Return JSON, AT MOST 15 LINES OF CONTENT: lane (" + JSON.stringify(l.id) + "), branch, files (paths you wrote), gateIds (ids your lane adds), measured (array of {name, value (NUMBER), unit} - every measurement as a number, never prose), policyDeltas (filed policy.mjs changes, empty if none), memoPath, newConstants (names with a one-line anchor each), summary (at most 12 lines; put the expected-red readings and anything S3 must own HERE), blockers."
  ].join("\n") + ownerNote("S2-" + l.id);
}

async function runS2(state, s1) {
  phase("S2 lane fan-out");
  log("S2: fanning out lanes R / U / F / K in isolated worktrees off " + SNAPSHOT_REF);
  // parallel(), not pipeline(): the four lanes are a genuine fan-out (plan sections 7.2 and 8),
  // isolation guaranteed by one worktree each plus single-writer file ownership.
  const lanes = (await parallel(LANES.map(function (l) {
    return function () {
      return agent(lanePrompt(l, s1), {
        label: "lane-" + l.id, phase: "S2 lane fan-out",
        schema: l.schema === "ring" ? ringLaneSchema : laneSchema,
        model: "opus", effort: "xhigh", isolation: "worktree"
      });
    };
  }))).filter(Boolean);
  for (const l of lanes) {
    log("Lane " + l.lane + " on " + l.branch + ": gates [" + l.gateIds.join(", ") + "], " + l.policyDeltas.length + " policy delta(s) filed");
    if (l.memoPath) state.detailFiles.push(l.memoPath);
    if (l.blockers.length) state.blockers.push(...l.blockers.map(function (b) { return "lane " + l.lane + ": " + b; }));
    if (typeof l.ringWallSec === "number") {
      state.ring = { wallSec: l.ringWallSec, prefixAgreement: l.ringPrefixWorstSE };
      log("Ring: " + l.ringWallSec + " s against the 300 s pre-registered budget; worst prefix delta " + l.ringPrefixWorstSE + " x se.cell (band 2.0); " + l.ringBytes + " B");
    }
  }
  if (lanes.length < LANES.length) {
    state.blockers.push("only " + lanes.length + "/4 S2 lanes returned - missing lane work must not be silently dropped, and B2 is not met");
  }
  return lanes;
}

// ---------------------------------------------------------------------------
// S3 - integration + the fixture creation ceremony (opus@max under a work-order; barrier B3)
// ---------------------------------------------------------------------------

function s3Task(s1, lanes) {
  return [
    "TASK - STAGE S3: INTEGRATION AND THE FIXTURE FREEZE, on the MAIN tree, serial. You merge four parallel lanes, pay the byte budgets, write I50's clauses and then CREATE the fourth fixture - a stop-the-world ceremony that happens once, in the open, and never with --force.",
    "",
    "READ FIRST, IN FULL: docs/V4-PLAN.md sections 7.2 (the contention registry - it is your merge rule book), 2.5, 2.7 (EVERY row of the byte table), 5.2 (I48-I52, D12, D13), 5.3, 3 (rules R4 and R6), 0.4 and 1's byte facts. Then read the five memos on the tree: docs/spikes/V4-ladder.md and each lane's docs/spikes/V4-*.md. The lanes reported (JSON):",
    JSON.stringify(lanes.map(function (l) {
      return { lane: l.lane, branch: l.branch, files: l.files, gateIds: l.gateIds, measured: l.measured, policyDeltas: l.policyDeltas, memoPath: l.memoPath, summary: l.summary };
    }), null, 2),
    "",
    "DO, IN THIS ORDER - the order is load-bearing:",
    "1. NORMALISE THE TREE FIRST, because it decides whether the merges can apply at all. S1's work is on the main tree UNCOMMITTED and the four lane branches descend from the snapshot commit `" + SNAPSHOT_REF + "`. Run `git status --porcelain`, `git log --oneline -3` and `git diff " + SNAPSHOT_REF + "`. If the tree is dirty and `git diff " + SNAPSHOT_REF + "` is EMPTY (the snapshot describes the tree exactly), run `git reset --soft " + SNAPSHOT_REF + "` - which moves HEAD onto the snapshot and leaves every byte of the working tree alone - then `git commit --amend -m \"v4 S1 (mid-run): ladder generalisation\"` so the tree is CLEAN and S1's work is a commit the lane branches already share. If `git diff " + SNAPSHOT_REF + "` is NOT empty, STOP and report it: the snapshot does not describe the tree and a merge would silently drop work. If the tree is already clean with S1's work committed, do nothing. Record which branch you took in your memo. This is merge bookkeeping, never the boundary commit - S6 makes that, and nothing is ever pushed.",
    "2. MERGE the four lane branches in the order R, U, F, K, resolving conflicts BY FILE OWNERSHIP (section 7.2, restated in each lane's brief). scripts/gates/index.mjs and scripts/gates/reserved.mjs have a SINGLE WRITER - lane F, which registered all seven ids (I48-I52, D12, D13) - so there is NOTHING TO RECONCILE THERE and a conflict in either file means a lane broke its brief: report that rather than merging both sides. VERIFY, do not rewrite: the pre-existing 62 ids are a strict PREFIX of EXPECTED_IDS, the seven new ids follow them, 69 in total, and the order the families DECLARE reproduces the frozen literal exactly or the runner THROWS (that check is deliberately not a gate: a gate that has gone missing cannot report its own absence). src/shell.html is line-disjoint by construction across S1's three ranges, lane R's three sites (:1181, :1318, :1407) and lane U's remainder; a textual conflict there is a fact to report, not a judgement call to make.",
    "3. APPLY THE FILED policyDeltas, one at a time, to scripts/lib/policy.mjs - frozen since S1, and you are its only writer now. After EACH delta re-run I48 and the three legacy fixture --checks BEFORE applying the next. A delta that moves the six-seat surface is REJECTED and reported, never absorbed; a delta that only a lane's convenience wanted is refused with a reason. Report policyDeltasApplied as a count.",
    "4. REGISTER THE RING AND PAY THE BUDGETS, SHRINK-FIRST (section 2.7's table row by row, and rule R6). THE RING IS EMBEDDED AS ITS OWN INJECTED PAYLOAD, ON THE data/equilibrium.json PRECEDENT - the full variant's `eq 73K` region, printed by the build census as its own region - AND IT IS NOT A model.json SUB-BUDGET. Concretely, two separate new caps: (i) `blocks.ring`, the PAGE block, registered as @block:ring in scripts/build.mjs for BOTH variants (D6's from-above clause covers it AUTOMATICALLY - pageCeilingProblems iterates [...BLOCKS, ...Object.keys(budgets.blocks).filter(...)] at gates/data.mjs:255 - so it is bounded at ceil(measured * 1.05) with NO gate edit; asserted by D13); and (ii) a TOP-LEVEL `ring: N * 1024` budget row in BOTH VARIANTS.lite.budgets AND VARIANTS.full.budgets (scripts/lib/variant.mjs:128-129 and :195-196, the same place the other top-level rows live), pinned from above by D12(d) at ceil(measured * 1.05), whole-KB, because D6's from-above clause EXPLICITLY EXCLUDES `eq` and the model.json sub-budgets.",
    "4b. WHAT DOES NOT MOVE, AND CHECK IT RATHER THAN ASSUMING IT. data/model.json grows by EXACTLY ONE ADDITION, `constants.ladder` - a few hundred bytes, absorbed by core's existing headroom - so `BUD`, `BUD.total`, `CORE_BUDGET` and `core` at scripts/gates/data.mjs:584-592 NEED NO EDIT and core's 116.0 / 120 KB is genuinely not raised. Stamp `constants.ladder` through the SURGICAL stamp path the P3 baseline used in scripts/generate-data.mjs, never by re-running the generator over `cells`, whose eq[0..6] and vDelta[*][0..6] are frozen. blocks.skill is NOT raised either - the 12 new skill-exception entries ship INSIDE @block:ring - and its cap and core's must equal 1d988f5's. (Section 5.2's D13 names two different things `core`: model.json's 120 KB sub-budget at gates/data.mjs:590 is the one that may not be raised; the page ceiling D6 also prints as `core` is appCore, which is the shrink-first row below.)",
    "4c. THE RAISES. modelCode and appCore are SHRINK-FIRST: the ladder functions replace the tables and both offenders go (modelCode 52.1 / 54 KB), the shell's duplicate POSITIONS / NNB / NBL / legalPos copies go (~0.4 KB against appCore's 682 B of headroom at 359.3 / 360 KB); a raise, if the measurement still demands one, is paid at cap <= ceil(measured * 1.08) for modelCode and ceil(measured * 1.05) for appCore. `app` is raised EXACTLY by the blocks.ring cap plus any appCore raise, IN BOTH VARIANTS - the equality pin app === appCore + sum(block caps) at test/variant.test.mjs:280 (lite) and :285 (full), with whole-KB caps at :288, is the arithmetic, not a guideline. AND THE ONE RAISE THE PLAN EXPECTS RATHER THAN FEARS: the FULL variant's `total`, at 653.7 / 660 KB with only 6,478 B of headroom against a ring block plus a ring payload. Pay it at cap <= ceil(measured * 1.05) under D6's from-above clause (its bound today is 687 K). Lite's total (583.9 / 600 KB) is expected to fit; if it does not, it is paid the same way. EVERY RAISE, INCLUDING THE EXPECTED ONE, CARRIES ITS MEASURED SHRINK ATTEMPT IN BYTES in variant.mjs's budgetSource sentence - a raise without a shrink-first sentence in bytes is a D13 FAILURE, not a formatting lapse - and goes in your `raises` return field with its from, to and shrinkFirstBytes.",
    "5. WRITE I50's CLAUSE LIST, BEFORE THE FREEZE, from R4's enumeration AND the post-pass finding in docs/spikes/V4-ladder.md (lane F built the skeleton and the comparison machinery). rfi IS PRE-REGISTERED AS CONTAINMENT, NOT EQUALITY: aggressive(9-max, seat) SUPERSET-OR-EQUAL aggressive(6-max, seat) for LJ, HJ, CO and BTN - each gains three unions at nine seats from the nesting post-pass at policy.mjs:2104-2110 - with SB (outside the rfi chain) pre-registered EXACT. The comparison runs over every shared seat where the pair is legal AT BOTH SIZES: five at rfi (LJ..SB, BB disabled at both), five at limps and raise (HJ..BB - LJ has no six-seat counterpart and is I49's business), six at 3bet. The width clause is stated separately: where a seats-in-front term makes the PRE-NESTING width differ, the difference is MONOTONE in that term - more seats in front never widens the pre-nesting target - while the painted set, after the union, can only grow. I50 fails on a SUBSET violation at rfi, an UNEXPLAINED excess cell, or a non-monotone pre-nesting width; a STRICT SUPERSET IS AN EXPECTED READING AND NOT A FAILURE. Report the clause count and, in i50RfiExact, whether the measured containment came out as EQUALITY (false is a legitimate, expected answer that does not by itself stop the run). Every excess cell must be explained by a front seat's own N_eff, and the nut-gate bypass (a unioned cell skips pos's own N >= nutGate[2] demotion) is RECORDED in METHODOLOGY as a finding, never laundered. If the excess cannot be explained - or if rfi shows a SUBSET violation - the plan's top risk has fired: RECORD THE MECHANISM in the plan as a `> **Measured (stage S3).**` block and in your memo, and let I50 assert what is true; the prediction is refined in place, never patched away and never softened into a tolerance.",
    "6. THE FIXTURE CREATION CEREMONY. Confirm `test ! -f data/tiers-9max.fixture.txt` FIRST. Then run `node scripts/freeze-tiers.mjs --seats9` EXACTLY ONCE. Read the printed settings count and compare it with the predicted 26,136 (33 legal pairs x 66 VPIP x 12 lanes), annotating the plan's prediction with a Measured block whichever way it lands. Then `node scripts/freeze-tiers.mjs --seats9 --check` must report REPRODUCES with an empty diff, and I49 must go green. IF THE FILE ALREADY EXISTS: STOP. Do not pass --force, do not delete the file and re-create it, do not rename it - return it as a blocker naming what you found. --force is not authorised anywhere in this run and deleting a fixture to dodge the refusal is the same act wearing a hat.",
    "7. THE SUB-LADDER DIFF. The freeze prints it and you commit it into docs/METHODOLOGY.md: for EVERY SHARED SEAT WHERE THE PAIR IS LEGAL AT BOTH SIZES (section 2.5 - five at rfi, five at limps and raise, six at 3bet), which (node, VPIP, cell) readings differ between the 9-max row and its 6-max counterpart, PLUS THE COUNT OF CELLS THE NESTING POST-PASS UNIONED INTO THAT SEAT. That diff, union counts included, is the evidence I50 is scored on. The FULL table goes in your memo file; METHODOLOGY gets the summary under a clearly headed subsection that S5 folds into its new section 3.6.",
    "8. RE-VERIFY EVERYTHING ON THE MERGED TREE: `node scripts/verify.mjs` green with I48, I49, I50, I51, I52, D6, D11, D12, D13 all present and passing and the pre-existing 62 still passing (FOUR change DOMAIN at nine seats - I15, I26, I38(e) AND I36, whose (b) clause now reads nestChain('rfi', 6) and stays six-seat-scoped while its (d) coverage datum is re-read as 3 of 36 - read section 5.1 and confirm each is evaluated at both sizes rather than quietly narrowed); `node --test test/*.test.mjs`; `node scripts/build.mjs --check` current for BOTH variants; the three legacy fixtures still reproducing; `node smoke.mjs` with the three existing morph rows at 8 / 16 / 4 ms UNCHANGED plus lane U's new toggle row; `node browsers.mjs`; all three --check generators byte-identical.",
    "9. DO NOT MAKE THE BOUNDARY COMMIT - S6 does, after the red team and the docs. Do not push anything, ever.",
    "",
    "DELIVERABLE FILE (required): docs/spikes/V4-integration.md - the merge record (what conflicted and how ownership resolved it), every filed policy delta with its verdict, the byte table before and after with each shrink and each raise in BYTES, the full sub-ladder diff, I50's clause list with its per-clause outcome, and the freeze's printed output. It is a required deliverable of this brief and this instruction overrides any default guidance against writing report files.",
    "",
    "Return JSON: merged, lanesMerged, policyDeltasApplied, fixtureCreatedNotForced (true only if you created it with a plain --seats9 run and never used --force), fixtureSettings, fixturePath, i48, i50RfiExact (did the pre-registered CONTAINMENT come out as equality - false is expected and legitimate), i50Clauses, budgets {liteTotal, liteApp, liteAppCore, liteRing, liteBlocksRing, fullTotal, fullRing} in BYTES, raises (each {ceiling, from, to, shrinkFirstBytes} - the full-variant total raise belongs here), memoPath, newConstants, summary (at most 12 lines), blockers."
  ].join("\n");
}

async function runS3(state, s1, lanes) {
  phase("S3 integration + freeze");
  log("S3: merging four lanes, paying the budgets, then the fixture creation ceremony");
  const task = s3Task(s1, lanes) + ownerNote("S3");
  const order = await fableWorkOrder(state, "S3 integration + freeze", "S3-integration", task);
  const r = await agent(HOUSE + "\n\n" + task + order, {
    label: "s3-integrate", phase: "S3 integration + freeze", schema: integrationSchema, model: "opus", effort: "max"
  });
  if (!r) {
    state.blockers.push("S3 integration agent died - the lanes are merged nowhere and the fixture does not exist");
    return null;
  }
  collect(state, r);
  state.identity.i48 = state.identity.i48 && r.i48;
  state.identity.i50 = { rfiExact: r.i50RfiExact, clauses: r.i50Clauses };
  state.fixture = { settings: r.fixtureSettings, path: r.fixturePath };
  state.raises.push(...(r.raises || []));
  if (!r.merged) state.blockers.push("S3 integration did not complete: " + trunc(r.summary, 300));
  if (!r.fixtureCreatedNotForced) {
    state.blockers.push("the 9-max fixture was not created by a plain --seats9 run - the v4 identity constraint forbids --force anywhere in this run (section 0.4)");
  }
  log("B3: merged " + r.lanesMerged.join("+") + ", " + r.policyDeltasApplied + " policy delta(s) applied, fixture " + r.fixtureSettings + " settings (predicted 26136), I50 " + r.i50Clauses + " clauses rfiExact=" + r.i50RfiExact + ", " + (r.raises || []).length + " raise(s)");
  state.notes.push("S3 budgets (lite, B): total " + r.budgets.liteTotal + ", app " + r.budgets.liteApp + ", appCore " + r.budgets.liteAppCore + ", ring " + r.budgets.liteRing);
  return r;
}

// ---------------------------------------------------------------------------
// S4 - the red team (plan sections 5.3 and 7.4; barrier B4)
// ---------------------------------------------------------------------------

// Section 7.4's eight targets, in the plan's own order of expected heat, plus the two section-4
// constants section 5.3 also puts in scope (constants.ladder.derived and ring.meta.wallBudget /
// rule R2), interleaved where their heat belongs. Whatever S1, the lanes and S3 declared as new
// constants is added to this list and deduped, so a constant nobody predicted still gets attacked.
const REDTEAM_TARGETS = [
  "constants.ladder.earlyStep = 0.77 - a SECOND constant with the same value as straddle.seat, which keeps its own value and gains derivedFrom:'ladder.earlyStep' rather than becoming a live reference (anchor: 1/sqrt(1.250*1.350), the geometric mean of baseRaise's UTG->HJ and HJ->CO steps) - is one step of the SIX-seat ladder the right step for three seats that ladder never contained, and does the two-constants-one-anchor split buy anything beyond keeping I26 and I51(a) from fighting?",
  "constants.ladder.baseRaiseRule = 'geometric' and its OUTPUT at the new front seats (UTG2/UTG1/UTG ~ 0.1232 / 0.0949 / 0.0731 from baseRaise(LJ) = 0.16) - is a 7.3 % nine-handed UTG open defensible, and is the anchor seat right (plan section 10 question 2)?",
  "constants.ladder.baseRRule - rule R1's flat-vs-step choice, the decision rule that ties go to flat, and the rejected alternative's readings on BOTH the score and the width surface (depthWidthFactor, the d = 40 and d = 250 lanes)",
  "constants.ladder.derived - the six derived numbers shipping kind:'estimate', and whether the Method-view badge is actually rendered from shipped data",
  "the ring's two-seed tolerance (D12(b)'s 2 * se.cell = 0.32 equity points, NOT the solver's twoSeedTolPot) and the choice nMax(9) = 9 (why not 8), plus ring.meta.trials / se / seeds",
  "D12(c)'s 2 * se.cell agreement band for the unshipped N = 1..7 prefix against cells[*].eq[0..6]",
  "ring.meta.wallBudget = 300 s, derived as 2 x 113 s x 9/7 ~ 291 s rounded up, and rule R2's halve-the-lattice fallback (does halving change what the shipped columns MEAN, and is the badge armed?)",
  "rule R3's extrapolated-census thresholds - the 'more than half its 66 VPIP points' rule, the decision that no new rail-chip badge ships, and METHODOLOGY limitation 20",
  "every byte-ceiling raise made in section 2.7 and its shrink-first sentence in variant.mjs's budgetSource - the FULL variant's total (653.7 / 660 KB, 6,478 B) above all, since the plan expects to pay it (a raise without a measured shrink in bytes is a D13 failure)",
  "the LJ naming - the claim that 6-max UTG is structurally 9-max LJ, and that a rail label is a claim gate I50 can fail"
];

function refuterPrompt(constants, idx) {
  return [
    HOUSE,
    "",
    "TASK - adversarial refutation (refuter #" + (idx + 1) + " of 3, INDEPENDENT - do not coordinate, do not read the other refuters' memos). For EACH of these v4 constants and rules, just shipped:",
    constants.map(function (c) { return "- " + c; }).join("\n"),
    "",
    "Your job is to try to MOVE each one and produce a shipped claim that FAILS. Read its anchor in docs/V4-PLAN.md sections 3 and 4 and in docs/METHODOLOGY.md, read docs/spikes/V4-ladder.md and the lane memos, find its definition in the code (scripts/lib/policy.mjs, scripts/lib/ring.mjs, scripts/lib/variant.mjs, the `constants` block in data/model.json and the generated page), perturb it in a SCRATCH COPY, and check whether some shipped, gated claim - a scripts/gates/ gate run by verify.mjs, a test, an on-screen Method-view statement - actually fails under the perturbation.",
    "WRITE NO REPO FILES: scratch copies live in a temp directory and are deleted; your memos are written to YOUR OWN SCRATCHPAD DIRECTORY (an absolute path outside the repository - use /tmp if you have none), one file for all your verdicts, and you return that path. The scratchpad memo is a required deliverable of this brief and this instruction overrides any default guidance against writing report files; the resolver reads it and commits it verbatim into docs/refutations/V4.md.",
    "A constant no perturbation can falsify is unanchored-in-practice, whatever its documentation says. A constant the plan itself marks unanchorable must be verifiably gated + flagged in `constants` + labelled in the Method view + badged `estimate`; check every leg. Attack the ARGUMENT too, not only the wiring: 'the model's only anchored seat step' is a claim about the model's evidence, and section 7.4 asks you to test whether it survives being extended to seats the evidence never saw.",
    "Return JSON: memoPath (absolute path to your memo file), verdicts - one per constant: { constant (COPIED BYTE-FOR-BYTE from the list above, parentheticals included - the majority tally keys on this exact string and a paraphrase fragments the vote), attack (what you perturbed and how), hasFalsifiableClaim (true if a shipped claim fails when it moves), unanchorable (true if nothing falsifies it in practice), memo (3-10 sentences, committed verbatim into docs/refutations/V4.md) }."
  ].join("\n");
}

async function redTeam(state, constants) {
  phase("S4 red team");
  const targets = uniq(constants);
  if (!targets.length) {
    state.blockers.push("S4 had no constants to attack - v4 ships a whole constants.ladder block, so an empty list means the earlier stages did not report theirs");
    return null;
  }
  log("S4: three independent refuters against " + targets.length + " constant(s)/rule(s)");
  const refuters = (await parallel([0, 1, 2].map(function (i) {
    return function () {
      return agent(refuterPrompt(targets, i), {
        label: "refuter-" + (i + 1), phase: "S4 red team", schema: refuterSchema, model: "opus", effort: "xhigh"
      });
    };
  }))).filter(Boolean);
  if (refuters.length < 2) {
    state.blockers.push("adversarial verification degraded: fewer than 2 refuters returned at S4");
  }
  const tally = {};
  for (const r of refuters) {
    for (const vd of r.verdicts) {
      const t = tally[vd.constant] || (tally[vd.constant] = { n: 0, unanchorable: 0, memos: [] });
      t.n += 1;
      if (vd.unanchorable) t.unanchorable += 1;
      t.memos.push("[" + (vd.hasFalsifiableClaim ? "falsifiable" : "NOT falsifiable") + (vd.unanchorable ? ", unanchorable" : "") + "] " + vd.attack + " -- " + vd.memo);
    }
  }
  const majorityUnanchored = Object.keys(tally).filter(function (k) { return tally[k].unanchorable * 2 > tally[k].n; });
  if (majorityUnanchored.length) log("Majority verdict unanchored-in-practice: " + majorityUnanchored.map(function (s) { return trunc(s, 60); }).join(" | "));
  const res = await agent([
    HOUSE,
    "",
    "TASK - STAGE S4 red-team resolution, on the MAIN tree. Three independent refuters attacked v4's constants and rules. Their memo files are at these paths (READ THEM - they are the verbatim record you commit):",
    refuters.map(function (r, i) { return "refuter " + (i + 1) + ": " + r.memoPath; }).join("\n"),
    "Their structured verdicts and the majority tally (JSON; use it if a memo file is unreadable):",
    JSON.stringify({ tally: tally, majorityUnanchored: majorityUnanchored }, null, 2),
    "",
    "Do:",
    "1. Write docs/refutations/V4.md: one section per constant, ALL refuters' memos verbatim, plus the majority verdict and the disposition you applied. It is committed with the run and it is a required deliverable of this brief, overriding any default guidance against writing report files. Follow the idiom of docs/refutations/P3.md.",
    "2. For EACH majority-unanchored constant: if docs/V4-PLAN.md section 3 or 4 already marks it an estimate or unanchorable, VERIFY it actually ships gated + flagged in `constants` + labelled in the Method view + badged (`estimate`/`interpolated`), and fix whichever leg is missing. If the plan claims it IS anchored, the anchor is refuted: DO NOT invent a replacement anchor - flag the constant in the plan's flagged idiom if a bounding gate exists, otherwise report it as a blocker. A majority-unanchored constant ships gated + flagged + badged, or it is CUT (the P3/P4 precedent, section 5.3).",
    "3. Where a refuter shows a shipped claim does NOT fail under perturbation, that gate is asserting less than it says: record it, and if the fix is a clause the gate can carry, write it.",
    "4. Do not commit and do not push; S6 commits the run.",
    "Return JSON: done, constants (one {name, verdict ('anchored'|'unanchored'|'flagged'|'cut'), disposition (one line)} per constant attacked), unanchored (the names the majority called unanchorable), docPath (docs/refutations/V4.md), summary (at most 12 lines), blockers (each majority-unanchored constant that could be neither anchored nor legitimately gated+flagged - those stop the run)."
  ].join("\n") + ownerNote("S4"), { label: "redteam-resolve", phase: "S4 red team", schema: resolveSchema, model: "opus", effort: "xhigh" });
  if (!res) {
    state.blockers.push("S4 red-team resolution agent died - the refutation record was never committed to the tree");
    return null;
  }
  collect(state, res);
  state.redTeam = { constants: res.constants.length, unanchored: res.unanchored || [] };
  log("S4: " + res.constants.length + " constant(s) adjudicated, " + (res.unanchored || []).length + " majority-unanchored -> " + res.docPath);
  return res;
}

// ---------------------------------------------------------------------------
// S5 - docs + the D6 cite re-pin (opus@xhigh; barrier B5)
// ---------------------------------------------------------------------------

async function runS5(state, s1, s3) {
  phase("S5 docs + re-pin");
  log("S5: METHODOLOGY 3.6 + limitation 20, README, plan annotations, and the D6 literal-line re-pin");
  const r = await agent([
    HOUSE,
    "",
    "TASK - STAGE S5: THE DOCUMENTS AND THE D6 RE-PIN, on the MAIN tree. Everything the run measured becomes the record here, and the last step re-pins the literal-line cites the earlier steps moved. Plan section 8's risk 5 names this stage as the one that turns a run red late - so do the re-pin LAST, after every other document edit, and re-run the verifier after it.",
    "",
    "READ FIRST, IN FULL: docs/V4-PLAN.md sections 6, 2.7 (its last paragraph is your re-pin mandate), 5.1, 0.1, 0.2 and 10. Then read the tree's own record: docs/spikes/V4-ladder.md, the four lane memos, docs/spikes/V4-integration.md, docs/refutations/V4.md, and scripts/gates/data.mjs's CEILING_MARGINS block (the `at(file, line, quote)` anchors and citeOf).",
    "Stage readings you are recording: legal pairs at nine = " + s1.legalPairsAtNine + "; baseR rule '" + s1.baseRRule + "'; nine-seat clamp census " + s1.censusClampedPct + " %; fixture " + s3.fixtureSettings + " settings at " + s3.fixturePath + "; I50 " + s3.i50Clauses + " clauses, rfi exact = " + s3.i50RfiExact + "; ring " + state.ring.wallSec + " s, worst prefix delta " + state.ring.prefixAgreement + " x se.cell; raises: " + JSON.stringify(state.raises) + ".",
    "",
    "DO, IN THIS ORDER:",
    "1. docs/METHODOLOGY.md - a new section 3.6 'The table-size axis': the ladder, the structural functions, the early-seat rules WITH their derived values and the red team's verdict on each, the ring artifact and its meta, the extrapolated census, and the sub-ladder diff S3 committed (fold S3's subsection in rather than duplicating it). A new LIMITATION 20: the early-seat constants are extrapolated from the model's own six-seat ladder - no nine-handed corpus of any kind has touched them - and it must be rendered in the Method view from shipped data, like the other standing limitations. LIMITATION 10 (the nesting post-pass) gains I50's nine-seat reading: the CONTAINMENT measurement, the per-seat union counts, and the nut-gate bypass section 5.2 records as a finding. Section 9.11 gains the ring rows - `blocks.ring` and the TOP-LEVEL per-variant `ring` artifact budget, which is NOT a model.json sub-budget - and every raise sentence with its shrink-first bytes, the full variant's total raise included. Section 10's '7-max and 9-max deferred' line is rewritten to '7-max / 8-max out; 9-max shipped as an axis'. The SIXMAX prose becomes TABLE-SIZE-NEUTRAL at ALL FOUR SITES, and it is not a 14-line block: :3406 (the entry itself), :3425, and the two gate rows :3565 (I35, quoting SIXMAX.reopenRule) and :3566 (I36, quoting SIXMAX.reopenVerdict) - lane K renamed the record in cfr.mjs and its readers in gates/solver.mjs; you fix the document, locating each site by CONTENT since these are the plan's survey line numbers. The reasoning is untouched, only its table-size framing.",
    "2. README.md - 'What v4 added' after 'What v3 added'; backlog item 16 CLOSED with the 7-max/8-max residue restated as the deliberate out-of-scope decision it is (section 0.2); 'Regenerating the data' gains scripts/generate-ring.mjs with its own 300 s budget, stated as separate from generate-data.mjs's 188 s; 'Repo layout' corrected for the dual build (an open v3.1 item, repaired here because the section is being edited anyway).",
    "3. docs/V4-PLAN.md annotated IN PLACE in the V2-PLAN/V3-PLAN idiom: `> **Measured (stage Sn).**` blocks beneath the predictions this run confirmed OR FALSIFIED - the legal-pair count, the fixture settings count against 26,136, the ring wall time against 300 s, D12(c)'s prefix agreement, R1's decision with both rules' readings, R3's census, I50's rfi containment (equality measured, or a strict superset with its per-seat union counts), and every byte raise - the full variant's total above all. Plan text above each annotation is kept AS WRITTEN; reversals are recorded, never edited away. Append the section 10 resolutions: questions 1, 2 and 3 answered with the evidence that answered them.",
    "4. package.json version -> '4.0.0-dev'.",
    "5. THE D6 RE-PIN - the named step, and the run is red until it is done. scripts/gates/data.mjs's CEILING_MARGINS carries `at(file, line, quote)` anchors and D6 asserts that the cited FILE at the cited LINE still carries the QUOTED phrase. You have just grown docs/METHODOLOGY.md, and S3 grew scripts/lib/variant.mjs's budgetSource, so those line numbers have moved. RE-PIN BY CONTENT: for each anchor, grep the quoted phrase in its cited file, take the line it is on NOW, and update the number. NEVER edit a quote so that it resolves, and NEVER re-point a cite at a different sentence that happens to match: the cite names one specific claim, and a cite resolving to the wrong sentence is strictly worse than a red gate. Add D6's two NEW rows (`ring`, `blocks.ring`) with their own anchors into the same structure. Report citesRepinned - the number of anchors whose line number you changed.",
    "6. README's METHODOLOGY line cites (roughly 20, ungated) re-pointed the same content-first way. Nothing but a reader catches a wrong one, so be exact. Report readmeCitesRepointed.",
    "7. Re-run `node scripts/verify.mjs` (D6 green with its cites resolving), `node --test test/*.test.mjs` and `node scripts/build.mjs --check` for both variants. If a doc edit moved a byte count past a ceiling, that is a MEASURED raise to pay under section 2.7's rules with its shrink-first sentence - report it in `raises`, never a quiet widening.",
    "8. Do not commit; S6 commits the run. Never push.",
    "",
    "DELIVERABLE FILE (required): docs/spikes/V4-repin.md - one row per cite (file, quoted phrase, old line, new line) for both data.mjs and README, plus the list of document sections written. It is a required deliverable of this brief and this instruction overrides any default guidance against writing report files.",
    "",
    "Return JSON: done, sections (the document sections you wrote or rewrote), citesRepinned, readmeCitesRepointed, version, raises (any ceiling this stage had to move, each {ceiling, from, to, shrinkFirstBytes}), memoPath, summary (at most 12 lines), blockers."
  ].join("\n") + ownerNote("S5"), { label: "s5-docs", phase: "S5 docs + re-pin", schema: docsSchema, model: "opus", effort: "xhigh" });
  if (!r) {
    state.blockers.push("S5 docs agent died - METHODOLOGY, README and the D6 cite re-pin are undone, so D6 will be red");
    return null;
  }
  collect(state, r);
  state.raises.push(...(r.raises || []));
  if (!r.done) state.blockers.push("S5 docs stage did not complete: " + trunc(r.summary, 300));
  log("S5: " + r.sections.length + " section(s), " + r.citesRepinned + " D6 cite(s) re-pinned, " + r.readmeCitesRepointed + " README cite(s) re-pointed, version " + r.version);
  return r;
}

// ---------------------------------------------------------------------------
// S6 - verify -> (triage -> ONE fix -> re-verify) -> commit (plan sections 7.2 and 7.5)
// ---------------------------------------------------------------------------

// The three frozen baselines' gates, the seven new ids, and I36 - one of the four gates section 5.1
// says changes DOMAIN this run (its (b) clause becomes nestChain('rfi', 6), its (d) coverage datum
// is re-read as 3 of 36), so the close must see it green rather than merely still declared.
const REQUIRED_GATES = ["I22", "I32", "I36", "I48", "I49", "I50", "I51", "I52", "D6", "D11", "D12", "D13"];

function closeNote(head) {
  return [
  "Also confirm each of the following, and report any that is false as a failing gate under the name given:",
  "- 'fixture present': data/tiers-9max.fixture.txt exists and `node scripts/freeze-tiers.mjs --seats9 --check` reproduces with an empty diff.",
  "- 'I48(a) --force evidence': run `git diff --stat " + head + "..HEAD -- data/` and `git log --oneline " + head + "..HEAD` (" + head + " is the sha the run started from, before any v4 work). data/tiers-v1.fixture.txt, data/tiers-v2.fixture.txt and data/tiers-v3-default.fixture.txt must be UNMODIFIED and data/tiers-9max.fixture.txt must be ADDED. Added-not-modified is the operational proof that no --force ran; a legacy fixture showing as modified is a failure of the v4 identity constraint, not a detail.",
  "- 'registry prefix': the pre-existing 62 gate ids are a strict PREFIX of EXPECTED_IDS (scripts/gates/index.mjs:91) and the seven new ids (I48-I52, D12, D13) are appended after them - 69 in total, written by lane F alone.",
  "- 'changed-domain gates': I15, I26, I36 and I38 - the four section 5.1 says change DOMAIN at nine seats - are each present and PASSING, not narrowed to keep them green.",
  "- 'D13 caps': blocks.skill (page) and core (data/model.json's 120 KB sub-budget at gates/data.mjs:590, NOT the page ceiling D6 also prints as `core`, which is appCore) have caps EQUAL to 1d988f5's - they may not be raised - app === appCore + sum(block caps) holds for BOTH variants with `ring` in the sum, and every raised ceiling carries a shrink-first sentence with bytes in variant.mjs's budgetSource.",
  "- 'ring budget row': `ring` is a TOP-LEVEL budget row in BOTH VARIANTS.lite.budgets and VARIANTS.full.budgets (the data/equilibrium.json precedent), whole-KB and pinned from above by D12(d) - NOT a data/model.json sub-budget, and gates/data.mjs:584-592's BUD / BUD.total / CORE_BUDGET / core are UNEDITED.",
  "- 'model identity': every byte of data/model.json outside the new `constants.ladder` block is identical to 1d988f5, and cells[*].eq[0..6] / vDelta[*][0..6] are untouched.",
  "- 'record present': docs/refutations/V4.md, docs/spikes/V4-ladder.md, docs/spikes/V4-integration.md and docs/spikes/V4-workorders.md all exist, and package.json's version is 4.0.0-dev."
  ].join("\n");
}

function verifyPrompt(requiredGateIds, extraNote) {
  return [
    HOUSE,
    "",
    "TASK - STAGE S6 verification. You REPORT; you fix nothing, write nothing and commit nothing. Run each of these in the repo root and capture the full output:",
    "1. `node scripts/verify.mjs`",
    "2. `node --test test/*.test.mjs`",
    "3. `node scripts/build.mjs --check` for BOTH variants",
    "4. `node smoke.mjs` - 2/2, with the three EXISTING morph rows read against their unchanged 8 / 16 / 4 ms budgets plus v4's table-size toggle row inside the 16 ms ON-default budget",
    "5. `node browsers.mjs` - 2/2, headless with throwaway profiles only",
    "6. all THREE --check generators byte-identical: `node scripts/generate-checkdown-matrix.mjs --check`, `node scripts/generate-equilibrium.mjs --check`, `node scripts/generate-ring.mjs --check`",
    "7. `node scripts/freeze-tiers.mjs --check`, `--v2 --check`, `--v3 --check` and `--seats9 --check` - each reproduces with an empty diff",
    requiredGateIds.length
      ? "Then grep the verifier output for these required gate ids, which MUST each appear AND pass: " + requiredGateIds.join(", ") + "."
      : "No specific gate ids are hard-required for this verification; report the checks as they stand.",
    extraNote ? extraNote : "",
    "Report the byte readings as NUMBERS IN BYTES for both variants: total, app, appCore, and the ring block (the @block:ring region as scripts/lib/block-census.mjs measures it; report 0 only if the block genuinely does not exist).",
    "A shipped feature whose plan-catalog gate id is absent from the registry output is a MISSING GATE and the run may not commit. Do not fix anything yourself.",
    "Return JSON: green (true only if 1-7 pass, the extra confirmations hold, AND no required gate id is missing), gateTotal, failingGates (gate names / failing test names / the extra-confirmation names above, empty if green), missingGateIds, testTotal, testFail, buildCurrent, smokeOk, browsersOk, generatorsByteIdentical, lite {total, app, appCore, ring}, full {total, app, appCore, ring}, detail (a paste of the decisive failure lines, or 'all green')."
  ].join("\n");
}

function fixPrompt(v, triage) {
  return [
    HOUSE,
    "",
    "TASK - THE ONE FIX ROUND (plan section 7.5: exactly one per run, then a blocker report). The run's verification came back red. The verification agent reported:",
    "FAILING GATES/TESTS/CONFIRMATIONS: " + v.failingGates.join(", "),
    "MISSING REQUIRED GATE IDS: " + v.missingGateIds.join(", "),
    "DETAIL:",
    v.detail,
    "",
    "Diagnose and fix the ROOT CAUSE in the repo. HARD LIMITS, none of them negotiable by any triage: you may NOT weaken, delete, widen or narrow the domain of a gate or a tolerance to get green; you may NOT run scripts/freeze-tiers.mjs with --force, and you may not delete, rename or re-create a fixture to dodge its refusal; you may NOT hand-edit index.html or index-full.html (edit src/shell.html and rebuild); you may NOT add a runtime or dev dependency; you may NOT re-generate data/model.json's cells. If a required gate id is missing, WRITE the gate per its docs/V4-PLAN.md section 5.2 spec. If a byte ceiling is the failure, pay it per section 2.7 with its shrink-first measurement in bytes, or shrink until it fits. Re-run the checks locally until green or until you conclude the failure is a genuine blocker for the owner.",
    triage ? "\nORCHESTRATOR TRIAGE (Fable-tier diagnosis - follow it unless the evidence in the tree contradicts it, and say so if it does; the hard limits above are NOT negotiable by this triage). APPEND IT VERBATIM to " + WORKORDERS + " under the heading `## S6 triage` as your first action - that file is a required deliverable of this run:\n" + triage.plan + "\nRISKS:\n" + triage.risks.map(function (r) { return "- " + r; }).join("\n") : "",
    "",
    "Return JSON: done (true if you believe the tree is now green), summary (at most 12 lines - the root cause, the fix, and what you proved about it), newConstants (should normally be empty), blockers (empty, or the precise reason this cannot be fixed without a decision only the owner can make)."
  ].join("\n");
}

function commitPrompt(message) {
  return [
    HOUSE,
    "",
    "TASK - the boundary commit. The tree has just been verified green with no standing blockers. Run `git add -A`, then commit EVERYTHING with a message whose FIRST LINE is exactly: " + JSON.stringify(message),
    "Then extend the body in this repository's own idiom (read `git log -3` and `git status`/`git diff --stat` first): a short list of what landed, the new gate ids, the byte readings, and a final `Green:` line with the verifier/test/build/smoke/browsers/generator readings. THE MESSAGE MUST END WITH THIS LINE, exactly, as its last line:",
    "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>",
    "NEVER push. NEVER amend or rewrite an existing commit other than the one you are creating. Return JSON: committed, hash (from `git rev-parse HEAD`), message (the first line you used)."
  ].join("\n");
}

async function closeMilestone(state, requiredGateIds, commitMessage, extraNote) {
  const P = "S6 verify + commit";
  phase(P);
  log("S6: verifying (required gates: " + (requiredGateIds.length ? requiredGateIds.join(", ") : "none - partial/red close") + ")");
  let v = await agent(verifyPrompt(requiredGateIds, extraNote), {
    label: "verify-v4", phase: P, schema: verifySchema, model: "sonnet", effort: "medium"
  });
  if (!v) {
    state.blockers.push("verification agent died on the first pass - the tree's state is unknown");
    return finish(state);
  }
  state.verify = v;
  if (!v.green || v.missingGateIds.length > 0) {
    if (state.blockers.length > 0) {
      // Standing blockers already forbid the commit, so the outcome is decided: do not spend the
      // Fable triage and the single opus@max fix round on a run that cannot close (v3 precedent).
      state.green = false;
      state.blockers.push("run red with standing blockers - triage and the fix round skipped: " +
        trunc(v.failingGates.concat(v.missingGateIds).join(", "), 200));
      return finish(state);
    }
    log("Red: " + trunc(v.failingGates.concat(v.missingGateIds).join(", "), 160) + " - triaging, then the single fix round");
    const triage = await agent([
      HOUSE,
      "",
      "TASK - failure triage (you are the Fable-tier orchestrator of this run; read files freely, WRITE NOTHING, fix nothing, spawn nothing). The run's verification came back red:",
      "FAILING GATES/TESTS/CONFIRMATIONS: " + v.failingGates.join(", "),
      "MISSING REQUIRED GATE IDS: " + v.missingGateIds.join(", "),
      "DETAIL:\n" + v.detail,
      "Diagnose the most likely root cause(s) from the repo state and write the strategy the SINGLE fix round must follow: where to look first, what the fix must and must not touch (never weaken a gate, never re-freeze or delete a fixture, never --force, never hand-edit the generated pages), and how to prove it fixed the cause rather than the symptom. Plan section 8 names the five predicted failure modes - check each against the evidence before inventing a sixth: (1) the rfi sub-ladder identity - which is CONTAINMENT, not equality, because the post-pass at policy.mjs:2104-2110 unions every seat in front into pos, so a strict superset is EXPECTED and only a subset violation, an UNEXPLAINED excess cell, or a unioned cell that bypasses pos's nut gate turning out to be load-bearing is a failure, (2) appCore's headroom forcing a raise despite shrink-first, (3) the ring generator overrunning 300 s, (4) the skill-exception procedure not reproducing, (5) the D6 re-pin turning the run red late.",
      "Return JSON: plan (the fix strategy, markdown), risks (ways the obvious fix would be wrong)."
    ].join("\n"), { label: "triage-v4", phase: P, schema: workOrderSchema, model: "fable", effort: "high" });
    if (!triage) state.notes.push("triage died; the fix round runs on the failure detail alone");
    const fix = await agent(fixPrompt(v, triage) + ownerNote("S6"), {
      label: "fix-v4", phase: P, schema: fixSchema, model: "opus", effort: "max"
    });
    if (fix && fix.blockers.length) state.blockers.push(...fix.blockers);
    if (!fix) state.blockers.push("the single fix round died - no second round is authorised (plan section 7.5)");
    v = await agent(verifyPrompt(requiredGateIds, extraNote), {
      label: "reverify-v4", phase: P, schema: verifySchema, model: "sonnet", effort: "medium"
    });
    if (v) state.verify = v;
  }
  if (v && v.green && v.missingGateIds.length === 0) {
    // Verifier-green is necessary, not sufficient: a run with standing blockers is not clean and
    // may NOT commit (v3 precedent, plan section 7.1's reserved-blockers rule).
    if (state.blockers.length > 0) {
      state.green = false;
      log("Verifier green but " + state.blockers.length + " blocker(s) stand - refusing the boundary commit");
      state.blockers.push("verifier green but blockers stand - commit REFUSED (verifier-green is not run-clean)");
      return finish(state);
    }
    state.green = true;
    const c = await agent(commitPrompt(commitMessage), {
      label: "commit-v4", phase: P, schema: commitSchema, model: "haiku", effort: "low"
    });
    if (c && c.committed) {
      state.committed = c.hash;
      log("Committed: " + c.hash);
    } else {
      state.green = false;
      state.blockers.push("commit agent failed after a green verification - the work is on the tree, uncommitted");
    }
  } else {
    state.green = false;
    state.blockers.push("run red after the one fix round: " +
      (v ? trunc(v.failingGates.concat(v.missingGateIds).join(", ") + " | " + v.detail, 260) : "the re-verification agent died"));
  }
  return finish(state);
}

// ---------------------------------------------------------------------------
// Dispatch - S0 to S6, one launch (plan section 7.6)
// ---------------------------------------------------------------------------

const COMMIT_MESSAGE = "v4: the 9-max seat ladder - policy generalised to seatsFor/LADDER9 (I51), ring artifact data/ring.json (D12/D13), fourth fixture created at nine seats (I49), seat axis inert at six (I48), sub-ladder identity (I50), ring consumer (I52)";

async function main() {
  log("v4 workflow - the 9-max seat ladder, S0-S6 in one launch (tokens remaining: " + budget.remaining() + ")");
  const state = mkState();

  const pre = await runS0(state);
  if (!pre) return finish(state);

  const s1 = await runS1(state);
  if (!s1) return closeMilestone(state, [], "v4 (partial, red at B1)", closeNote(pre.head));

  const lanes = await runS2(state, s1);
  if (lanes.length < LANES.length || state.blockers.length) {
    state.notes.push("B2 not met; no integration, no freeze");
    return closeMilestone(state, [], "v4 (partial, red at B2)", closeNote(pre.head));
  }

  const s3 = await runS3(state, s1, lanes);
  if (!s3 || !s3.merged || state.blockers.length) {
    state.notes.push("B3 not met; no red team, no docs");
    return closeMilestone(state, [], "v4 (partial, red at B3)", closeNote(pre.head));
  }

  const constants = REDTEAM_TARGETS
    .concat(s1.newConstants || [])
    .concat(lanes.reduce(function (a, l) { return a.concat(l.newConstants || []); }, []))
    .concat(s3.newConstants || []);
  await redTeam(state, constants);

  const s5 = await runS5(state, s1, s3);
  if (!s5) state.notes.push("S5 did not return; D6's cites are unre-pinned and the close will read red");

  return closeMilestone(state, REQUIRED_GATES, COMMIT_MESSAGE, closeNote(pre.head));
}

return await main();
