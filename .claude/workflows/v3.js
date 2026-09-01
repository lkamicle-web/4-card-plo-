export const meta = {
  name: "v3",
  description: "RUNDOWN v3 execution workflow - one launch per milestone (phase0, P1, P2, P3, P4, P5), fully autonomous to the milestone boundary per docs/V3-PLAN.md.",
  phases: [
    { title: "P0 spikes + B0 freezes", detail: "Five feasibility spikes in parallel isolated worktrees; on the main tree, serial: v2 fixture freeze (I32), payoff interface freeze (I33), gate-registry refactor." },
    { title: "P0 consolidation", detail: "Spike memos written to docs/spikes/, docs/V3-PLAN.md annotated in place with > Measured blocks, affected phase specs adjusted, gate catalog + pre-registered I46 criteria drafted." },
    { title: "P0 verify + commit", detail: "All three checks green, required gate ids present; commit at the boundary; one fix round on red, else structured blocker report." },
    { title: "P1 lane fan-out", detail: "Lanes M/U/I/C in isolated worktrees; single writer per contended file (policy.mjs=M, src/shell.html=U, build.mjs=I, C new files only)." },
    { title: "P1 integration + B1 flip", detail: "Merge all four lanes, item-8 default flip, third-fixture ceremony (tiers-v3-default), I32 green after merge." },
    { title: "P1 adversarial verification", detail: "Three independent refuters attack the P1 opinion constants; majority rules; unanchorable constants surface as blockers or ship gated+flagged per plan section 6." },
    { title: "P1 verify + commit", detail: "Three checks green, I41/I42/I43/I44 (+D10/D11) present; commit; one fix round on red." },
    { title: "P2 chain fan-out", detail: "Payoff estimator and CFR solver engine built in parallel worktrees against the frozen I33 interface, per S-A/S-B spike memos and the three-band rule." },
    { title: "P2 integration", detail: "Merge the two P2 branches onto the main tree; I33 still green; grade-band consequences applied." },
    { title: "P2 adversarial verification", detail: "Refuters attack payoff params, stack-off knob, solver epsilon, iteration cap, tree/sizing set." },
    { title: "P2 verify + commit", detail: "Three checks green, I35 present; commit; one fix round on red." },
    { title: "P3 equilibrium baseline", detail: "B2: solver consumes the real payoff only after I33 passes on it; emit data/equilibrium.json (D9) + quantized baseline-tier block; vs-GTO colour mode live." },
    { title: "P3 adversarial verification", detail: "Refuters attack baselineQuant and the D9 budget arithmetic." },
    { title: "P3 verify + commit", detail: "Three checks green, I36/D9 present; commit; one fix round on red." },
    { title: "P4 skill + EV cut", detail: "B3 precheck; skill axis as offset-from-baseline, then the absolute-EV cut behind the I34 quarantine, then UI wiring; policy.mjs single-writer serial." },
    { title: "P4 adversarial verification", detail: "Refuters attack the skill-dial interior blend, plays-better coefficient, EV MIX band." },
    { title: "P4 verify + commit", detail: "Three checks green, I34/I37/I38/I39/I40 present; commit; one fix round on red." },
    { title: "P5 calibration + residue", detail: "Allowance re-measures, item 10, item 11 cut-line decision, calibration verdict LAST against the finished EV surface, METHODOLOGY final rewrite." },
    { title: "P5 adversarial verification", detail: "Refuters attack any constant moved by the calibration ceremony and item-10 estimate labeling." },
    { title: "P5 verify + commit", detail: "Three checks green, I46/I47 (+I45 iff squeeze shipped) present; commit; one fix round on red." }
  ]
};

// ---------------------------------------------------------------------------
// Shared prompt fragments
// ---------------------------------------------------------------------------

const HOUSE = [
  "CONTEXT - the repository you are working in:",
  "RUNDOWN, a 4-card PLO preflop range explorer. Single generated artifact index.html (NEVER hand-edit it; edit src/shell.html and rebuild via scripts/build.mjs). Zero-runtime-dependency Node pipeline. Key files: scripts/verify.mjs (gate runner; after the P0 registry refactor the gates live as files under scripts/gates/), scripts/build.mjs, scripts/lib/policy.mjs (the scoring/opinion layer), scripts/freeze-tiers.mjs (the SOLE fixture writer), data/model.json, data/tiers-v1.fixture.txt (v1, gate I22), data/tiers-v2.fixture.txt (v2, gate I32), docs/METHODOLOGY.md (the living source of truth - where it and the plan disagree, METHODOLOGY is right), docs/V3-PLAN.md (the plan; read the sections your task cites IN FULL before writing code), docs/V3-BRIEF.md.",
  "",
  "HOUSE RULES (non-negotiable):",
  "- GREEN means ALL THREE: `node scripts/verify.mjs` exits 0 with every gate pass; `node --test test/*.test.mjs` all pass; `node scripts/build.mjs --check` reports current (both variants once the dual build exists).",
  "- The objective/opinion split: the Monte Carlo layer is objective, scoring is opinion. CONSTANTS NEED ANCHORS: every new constant is named in `constants`, anchored per docs/V3-PLAN.md section 6, rendered by the Method view, and bounded by a gate. If you cannot anchor a constant, DO NOT invent a number - ship it gated + flagged + badged per the plan, or surface it as a blocker in your structured return.",
  "- New model work needs new gates (ids per docs/V3-PLAN.md section 7) before its phase can close. Gates are written to FAIL, never tolerances widened to pass.",
  "- The v3 identity constraint (plan section 0.4): every mechanism enters as (a) a new axis inert at legacy settings, (b) a new artifact, or (c) a deliberate re-freeze via `scripts/freeze-tiers.mjs --force` with the printed move-diff committed. NEVER run freeze-tiers with --force unless this prompt explicitly names that ceremony as your step. freeze-tiers.mjs is the sole fixture writer.",
  "- Commit ONLY when this prompt says to, with a descriptive message. NEVER push. NEVER touch the user's installed browsers - browser testing is headless with temp profiles only.",
  "- You are fully autonomous: never ask the user anything; decide, or surface a blocker in your structured return value.",
  "- In structured returns, `blockers` is RESERVED for issues that must stop this milestone from committing: a deliverable you could not produce, a gate you could not make green without weakening it, a constant that can be neither anchored nor legitimately gated+flagged, or a decision only the user can make that blocks correctness. Informational findings, resolved trade-offs, provenance notes, and items deliberately left for a later phase belong in `summary`, NEVER in `blockers` - a note filed as a blocker halts the whole milestone (this aborted the first phase0 run; user-adjudicated 2026-08-31)."
].join("\n");

const MILESTONES = ["phase0", "P1", "P2", "P3", "P4", "P5"];

// ---------------------------------------------------------------------------
// Model policy (credit efficiency, decided 2026-08-31)
// ---------------------------------------------------------------------------
// The LAUNCHING SESSION (Fable) is the orchestrator. Its control-flow cost is near zero (this
// script is deterministic JS), but it is NOT a passive launcher: the fable tier below does the
// high-level planning inside the run. Workers are tiered by task shape, and every agent() call
// sets `model` explicitly so a Fable launch never silently inherits Fable pricing onto every
// worker in the run:
//   fable @ high   - the milestone ARCHITECT: writes the work-order for every opus@max step
//                    before that worker runs (decision points called, sharp edges, order of
//                    operations), and triages a red verification before the fix round fires.
//                    Fable plans; it never implements - its calls are read-only.
//   opus @ xhigh   - the default worker: implementation lanes, spikes, integration/merges,
//                    consolidation, red-team refuters and their resolution.
//   opus @ max     - the highest-stakes calls only: the payoff-interface freeze (the program's
//                    load-bearing architecture contract), the I34 EV-cut quarantine, the P5
//                    calibration verdict (sole --force authorization), and the fix round (one
//                    per milestone, running only after a worker already failed).
//                    Each executes under a fable-authored work-order or triage.
//   sonnet @ medium - scout-shaped work: prechecks and verification agents that run commands,
//                    read memos, grep gate ids, and report. Quality-equivalent there, ~5x cheaper.
//   haiku          - commit agents (git add / commit with a supplied message).

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const verifySchema = {
  type: "object",
  properties: {
    green: { type: "boolean" },
    failingGates: { type: "array", items: { type: "string" } },
    missingGateIds: { type: "array", items: { type: "string" } },
    detail: { type: "string" }
  },
  required: ["green", "failingGates", "missingGateIds", "detail"]
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

const stepSchema = {
  type: "object",
  properties: {
    done: { type: "boolean" },
    summary: { type: "string" },
    newConstants: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } }
  },
  required: ["done", "summary", "blockers"]
};

const spikeSchema = {
  type: "object",
  properties: {
    spike: { type: "string" },
    questionAnswered: { type: "boolean" },
    success: { type: "boolean" },
    grade: { type: "string" },
    measurements: { type: "string" },
    recommendation: { type: "string" },
    memo: { type: "string" },
    branch: { type: "string" }
  },
  required: ["spike", "questionAnswered", "success", "grade", "measurements", "recommendation", "memo", "branch"]
};

const laneSchema = {
  type: "object",
  properties: {
    lane: { type: "string" },
    branch: { type: "string" },
    filesTouched: { type: "array", items: { type: "string" } },
    gatesAdded: { type: "array", items: { type: "string" } },
    newConstants: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    blockers: { type: "array", items: { type: "string" } }
  },
  required: ["lane", "branch", "filesTouched", "gatesAdded", "newConstants", "summary", "blockers"]
};

const refuterSchema = {
  type: "object",
  properties: {
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
  required: ["verdicts"]
};

const precheckSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    detail: { type: "string" },
    gradeBand: { type: "string" }
  },
  required: ["ok", "detail", "gradeBand"]
};

// stepSchema + an explicit calibration verdict, so the milestone close can pick the required
// gate list mechanically (I22/I32 retired iff the ceremony ran) instead of guessing from prose.
const calibrationSchema = {
  type: "object",
  properties: {
    done: { type: "boolean" },
    summary: { type: "string" },
    verdict: { type: "string" },
    newConstants: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } }
  },
  required: ["done", "summary", "verdict", "blockers"]
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
// State + generic stages
// ---------------------------------------------------------------------------

function mkState(milestone) {
  return { milestone, phasesRun: [], green: false, commits: [], blockers: [], notes: [] };
}

function finish(state) {
  return {
    milestone: state.milestone,
    phasesRun: state.phasesRun,
    green: state.green,
    commits: state.commits,
    blockers: state.blockers,
    notes: Array.isArray(state.notes) ? state.notes.join(" | ") : String(state.notes)
  };
}

function verifyPrompt(requiredGateIds, extraNote) {
  return [
    HOUSE,
    "",
    "TASK - verification. Run, in the repo root, capturing full output:",
    "1. `node scripts/verify.mjs`",
    "2. `node --test test/*.test.mjs`",
    "3. `node scripts/build.mjs --check` (and, if the dual build exists, `--check` for BOTH variants)",
    requiredGateIds.length
      ? "Then grep the verifier output for these required gate ids, which MUST each appear and pass: " + requiredGateIds.join(", ") + "."
      : "No specific gate ids are hard-required for this verification; report the three checks as they stand.",
    extraNote ? extraNote : "",
    "A shipped feature whose plan-catalog gate id is absent from the registry output is a missing gate - the milestone may NOT commit. Do not fix anything yourself; you only report.",
    "Return JSON: green (true only if all three checks pass AND no required gate id is missing), failingGates (gate names / failing test names, empty if green), missingGateIds (required ids absent from verifier output), detail (a paste of the decisive failure lines, or 'all green')."
  ].join("\n");
}

function fixPrompt(v) {
  return [
    HOUSE,
    "",
    "TASK - ONE fix round. The milestone verification came back red. Failure detail from the verification agent:",
    "FAILING GATES/TESTS: " + v.failingGates.join(", "),
    "MISSING REQUIRED GATE IDS: " + v.missingGateIds.join(", "),
    "DETAIL:",
    v.detail,
    "",
    "Diagnose and fix the ROOT CAUSE in the repo. Hard limits: you may NOT weaken, delete, or widen a gate or tolerance to get green; you may NOT run freeze-tiers.mjs --force; you may NOT hand-edit index.html (edit src/shell.html and rebuild). If a required gate id is missing, write the missing gate per its docs/V3-PLAN.md section 7 spec - UNLESS the gate was retired by a documented ceremony (a retirement recorded in docs/METHODOLOGY.md with its written reason and committed diff, e.g. I22/I32 after a calibration 'pass'): NEVER re-create a ceremonially retired gate; report the retirement as the finding instead. Re-run the three checks locally until green or until you conclude the failure is a genuine blocker.",
    "Return JSON: done (true if you believe the tree is now green), summary, newConstants (names of any constants you had to add, should normally be empty), blockers (empty, or the precise reason this cannot be fixed without a decision above your pay grade)."
  ].join("\n");
}

function commitPrompt(message) {
  return [
    HOUSE,
    "",
    "TASK - phase-boundary commit. The tree has just been verified green. Run `git add -A` then commit EVERYTHING with a descriptive message beginning: " + JSON.stringify(message),
    "Extend the message body with a short list of what landed (read `git status`/`git diff --stat` first). NEVER push. Return JSON: committed, hash (the new commit hash from `git rev-parse HEAD`), message (the first line used)."
  ].join("\n");
}

// Fable-tier planning (model policy above): the milestone architect writes the work-order a
// max-effort Opus worker executes. Read-only, refines-never-overrides the plan; a null return
// (architect died) degrades to the plan text alone rather than blocking the step.
async function fableWorkOrder(state, phaseTitle, label, taskDescription) {
  const wo = await agent([
    HOUSE,
    "",
    "TASK - orchestrator work-order (you are the Fable-tier milestone architect; you PLAN, you do not implement - read files freely, WRITE NOTHING). A max-effort Opus worker is about to execute the step quoted below. Read the docs/V3-PLAN.md sections it cites and the current code it touches, then write its work-order: the decision points it will hit with your call on each, the sharp edges and integration risks, the order of operations, and what would count as a genuine blocker worth stopping for. Refine, never override, the plan - where you disagree with it, record that as a risk, do not re-plan. Your tier cannot block a milestone: surface any would-be blocker as a risk, not a refusal, and ignore the quoted step's own Return-JSON line - your output contract is the one below.",
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
  return "\n\nORCHESTRATOR WORK-ORDER (Fable milestone architect - it refines, never overrides, the plan sections cited above; where they conflict, the plan wins and the conflict is a finding):\n" +
    wo.plan + "\nRISKS:\n" + wo.risks.map(function (r) { return "- " + r; }).join("\n");
}

async function closeMilestone(state, phaseTitle, requiredGateIds, commitMessage, extraNote) {
  phase(phaseTitle);
  state.phasesRun.push(phaseTitle);
  log("Verifying: " + state.milestone + " (required gates: " + requiredGateIds.join(", ") + ")");
  let v = await agent(verifyPrompt(requiredGateIds, extraNote), {
    label: "verify-" + state.milestone, phase: phaseTitle, schema: verifySchema, model: "sonnet", effort: "medium"
  });
  if (!v) {
    state.blockers.push("verification agent died on first pass");
    return state;
  }
  if (!v.green || v.missingGateIds.length > 0) {
    if (state.blockers.length > 0) {
      // Standing blockers already forbid this milestone's commit, so the outcome is decided:
      // don't spend the fable triage + opus@max fix round on a milestone that cannot close.
      state.green = false;
      state.blockers.push("milestone red with standing blockers - triage/fix skipped: " +
        v.failingGates.concat(v.missingGateIds).join(", ") + " | " + v.detail);
      return state;
    }
    log("Red: " + v.failingGates.concat(v.missingGateIds).join(", ") + " - triaging, then the single fix round");
    // Fable triages the failure before the one fix round spends its only shot (model policy above).
    const triage = await agent([
      HOUSE,
      "",
      "TASK - failure triage (you are the Fable-tier orchestrator; read files freely, WRITE NOTHING, fix nothing). The milestone verification came back red:",
      "FAILING GATES/TESTS: " + v.failingGates.join(", "),
      "MISSING REQUIRED GATE IDS: " + v.missingGateIds.join(", "),
      "DETAIL:\n" + v.detail,
      "Diagnose the most likely root cause(s) from the repo state and write the strategy the SINGLE fix round should follow: where to look first, what the fix must and must not touch (never weaken gates, never re-freeze fixtures), and how to prove it fixed the cause rather than the symptom.",
      "Return JSON: plan (the fix strategy, markdown), risks (ways the obvious fix would be wrong)."
    ].join("\n"), { label: "triage-" + state.milestone, phase: phaseTitle, schema: workOrderSchema, model: "fable", effort: "high" });
    if (!triage) state.notes.push("triage for " + state.milestone + " died; the fix round runs on the failure detail alone");
    const fix = await agent(fixPrompt(v) + (triage
      ? "\n\nORCHESTRATOR TRIAGE (Fable-tier diagnosis - follow it unless the evidence in the tree contradicts it, and say so if it does; the hard limits above are NOT negotiable by this triage):\n" + triage.plan + "\nRISKS:\n" + triage.risks.map(function (r) { return "- " + r; }).join("\n")
      : ""), {
      label: "fix-" + state.milestone, phase: phaseTitle, schema: stepSchema, model: "opus", effort: "max"
    });
    if (fix && fix.blockers.length) state.blockers.push(...fix.blockers);
    v = await agent(verifyPrompt(requiredGateIds, extraNote), {
      label: "reverify-" + state.milestone, phase: phaseTitle, schema: verifySchema, model: "sonnet", effort: "medium"
    });
  }
  if (v && v.green && v.missingGateIds.length === 0) {
    // Verifier-green is necessary but not sufficient: a milestone with standing blockers
    // (red-team unresolvable constants, failed lanes/steps, aborted chains) is not clean and
    // may NOT commit - brief sections 2.1 and 8. green=true is never emitted beside blockers.
    if (state.blockers.length > 0) {
      state.green = false;
      state.notes.push("verifier green but " + state.blockers.length + " blocker(s) stand - milestone commit REFUSED (verifier-green is not milestone-clean)");
      log("Verifier green but blockers stand - refusing the milestone commit");
      return state;
    }
    state.green = true;
    const c = await agent(commitPrompt(commitMessage), {
      label: "commit-" + state.milestone, phase: phaseTitle, schema: commitSchema, model: "haiku", effort: "low"
    });
    if (c && c.committed) {
      state.commits.push(c.hash + " " + c.message);
      log("Committed: " + c.hash);
    } else {
      state.green = false;
      state.blockers.push("commit agent failed after green verification");
    }
  } else {
    state.green = false;
    state.blockers.push(
      "milestone red after one fix round - do NOT proceed to the next milestone: " +
      (v ? v.failingGates.concat(v.missingGateIds).join(", ") + " | " + v.detail : "re-verification agent died")
    );
  }
  return state;
}

// ---------------------------------------------------------------------------
// Adversarial verification (plan section 7.3, brief sections 2.1 and 8)
// ---------------------------------------------------------------------------

function refuterPrompt(constants, idx) {
  return [
    HOUSE,
    "",
    "TASK - adversarial refutation (refuter #" + (idx + 1) + " of 3, independent; do not coordinate). For EACH of these opinion-layer constants just shipped:",
    constants.map(function (c) { return "- " + c; }).join("\n"),
    "",
    "Your job is to try to MOVE each constant and produce a shipped claim that fails: read its anchor in docs/V3-PLAN.md section 6 and in docs/METHODOLOGY.md, find its definition in the code (start at scripts/lib/policy.mjs, scripts/lib/, and the `constants` block in data/model.json / the generated page), perturb it in a scratch copy, and check whether some shipped, gated claim (a verify.mjs/scripts/gates/ gate, a test, an on-screen Method-view statement) actually fails under the perturbation. WRITE NO REPO FILES - scratch copies go in a temp dir; your memo is returned as text, not written.",
    "A constant no perturbation can falsify is unanchored-in-practice, whatever its documentation says. A constant the plan itself marks 'cannot be anchored' must be verifiably gated + flagged + badged; check that it is.",
    "Return JSON: verdicts, one per constant: { constant (COPIED BYTE-FOR-BYTE from the list above, parentheticals included - the majority tally keys on this exact string; a paraphrase fragments the vote), attack (what you perturbed and how), hasFalsifiableClaim (true if a shipped claim fails when it moves), unanchorable (true if nothing falsifies it in practice), memo (3-10 sentences, committed later verbatim into docs/refutations/) }."
  ].join("\n");
}

async function redTeam(state, phaseTitle, constants, refutationDoc) {
  phase(phaseTitle);
  state.phasesRun.push(phaseTitle);
  if (!constants.length) {
    state.notes.push("no new opinion constants at " + phaseTitle + "; red-team stage skipped");
    return;
  }
  log("Red-teaming " + constants.length + " constant(s): " + constants.join(", "));
  const refuters = (await parallel([0, 1, 2].map(function (i) {
    return function () {
      return agent(refuterPrompt(constants, i), {
        label: "refuter-" + (i + 1), phase: phaseTitle, schema: refuterSchema, model: "opus", effort: "xhigh"
      });
    };
  }))).filter(Boolean);
  if (refuters.length < 2) {
    state.blockers.push("adversarial verification degraded: fewer than 2 refuters returned at " + phaseTitle);
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
  const unanchored = Object.keys(tally).filter(function (k) {
    return tally[k].unanchorable * 2 > tally[k].n;
  });
  if (unanchored.length) log("Majority verdict unanchored-in-practice: " + unanchored.join(", "));
  const res = await agent([
    HOUSE,
    "",
    "TASK - red-team resolution. Three independent refuters attacked this phase's new opinion constants. Their memos (JSON):",
    JSON.stringify({ tally: tally, majorityUnanchored: unanchored }, null, 2),
    "",
    "Do, on the main tree:",
    "1. Write the refutation memos verbatim into " + refutationDoc + " (one section per constant, all refuters' memos, plus the majority verdict). They are committed with the phase.",
    "2. For each majority-unanchored constant: if docs/V3-PLAN.md section 6 already marks it 'cannot be anchored', verify it ships gated + flagged in `constants` + labeled in the Method view + badged (`estimate`/`interpolated`), and fix the flagging if any leg is missing. If the plan claims it IS anchored, the anchor is refuted: DO NOT invent a replacement anchor - flag the constant per section 6's flagged idiom if a bounding gate exists, otherwise report it as a blocker.",
    "3. Do not commit; the milestone-close stage commits.",
    "Return JSON: done, summary, newConstants (empty), blockers (each majority-unanchored constant that could be neither anchored nor legitimately gated+flagged - these stop the milestone)."
  ].join("\n"), { label: "redteam-resolve", phase: phaseTitle, schema: stepSchema, model: "opus", effort: "xhigh" });
  if (!res) state.blockers.push("red-team resolution agent died at " + phaseTitle);
  else {
    if (res.blockers.length) state.blockers.push(...res.blockers);
    state.notes.push("red-team " + phaseTitle + ": " + res.summary);
  }
}

// ---------------------------------------------------------------------------
// Milestone: phase0
// ---------------------------------------------------------------------------

const SPIKES = [
  {
    id: "S-A",
    title: "CFR convergence",
    body: "QUESTION: does CFR+ converge on the 123-cell abstraction over a capped HU preflop tree (open/fold/3-bet/call/4-bet/jam cap), fed the 7,626-pair payoff matrix, and how fast? METHOD: build the matrix from the existing eq machinery (checkdown payoff, LABELED as such - this spike tests solver mechanics, not payoff truth); run CFR+ recording exploitability per iteration. DELIVERABLE: convergence curve, wall time, memory, tree spec. SUCCESS: exploitability <= 0.25% of pot within 120 s single-thread Node and <= 1 GB. FAILURE MEANS: oscillation/plateau, or whole-cell strategies flapping between iterations -> Phase 3 switches to an LP/regret-matching variant for HU and 6-max MCCFR is descoped to a stretch goal. Record wall time explicitly against HALF the budget too - 6-max MCCFR is attempted in P3 only if HU lands inside half its budget."
  },
  {
    id: "S-B",
    title: "payoff estimator cost + error (the program's load-bearing spike)",
    body: "QUESTION: can `payoff(cells, potSize, spr)` be estimated at acceptable cost, with what error vs street-simulated ground truth? METHOD: prototype 2-3 estimator forms (checkdown + realization curve; one-street rollout with a threshold stack-off policy; flop-equity-distribution buckets); compare against a slow full-street MC reference on ~50 stratified pairs x spr in {1,4,10}, including the known stress cases (RUN0_LOW x DS, BROADWAY_RUN x RB, AA_DANGLER x RB). DELIVERABLE: error table (mean/p95/max in pot-fraction points), sensitivity of each form to its own opinion knobs, and the cost of the full 7,626-pair x spr-grid precompute against the 6-minute pipeline budget. SUCCESS: p95 <= 2.5 pts and precompute <= 6 min. THE THREE-BAND RULE (report your band as grade): p95 <= 2.5 -> Grade A (payoff ships measurement-anchored); 2.5-5.0 -> Grade B (payoff ships estimate-badged, EV primacy off the table for v3); > 5.0 -> Grade C (solver runs on checkdown payoff wearing the 'a game where postflop does not exist' on-screen label; B2 decides vs-GTO caveated-or-cut). The band edges are PRE-REGISTERED blind thresholds (plan section 6): your memo must ALSO report, beside the p95, the stub payoff's se at default trials and the smallest EV difference that would move a tier under the planned I34 quarantine, so the blind edges are audited against measured scale in the same memo - a mismatch is a finding to record, never a reason to re-draw the line."
  },
  {
    id: "S-C",
    title: "hand-history data",
    body: "QUESTION: does usable 4-card PLO hand-history data exist (volume, hole-card visibility, licensing), and what would calibration actually fit? METHOD: inventory sources, parse a sample, count per-cell showdown coverage, run the power analysis (hands needed per cell/band for a +-bb/100 that can discriminate orderings; PLO variance is enormous - expect band-level, not cell-level, resolution). DELIVERABLE: corpus memo + parser prototype + PRE-REGISTERED PRIMACY CRITERIA: the exact out-of-sample statistic by which EV-ordering would beat score-ordering, written down BEFORE any EV number exists, so the bar can never be lowered post hoc - these criteria must appear verbatim in your memo; they become gate I46's fixed bar. SUCCESS: >= ~1M parsed hands with >= 100 showdowns in >= 80 cells. FAILURE MEANS: Phase 5 ships the calibration harness + self-play consistency only, EV stays secondary permanently, and METHODOLOGY section 10 gains 'the decision layer remains unfalsified against money' as a standing limitation rendered in the Method view."
  },
  {
    id: "S-D",
    title: "full/lite split cost",
    body: "QUESTION: is one source + feature flags viable? METHOD: prototype `--variant=lite` in scripts/build.mjs (the @inject-marker seam plus @only: markup markers), build both artifacts, run per-variant --check. DELIVERABLE: working diff, per-variant byte table, and the complete list of gates needing per-build scoping (D6/D7/D8, the fetch(/src= refusals, METHODOLOGY 9.11's honest-claim sentence). SUCCESS: both artifacts deterministic and byte-comparable. FAILURE MEANS (degrade, don't stop): the full build is constrained to lite-plus-injected-blocks until real divergence machinery earns its way in; lite is the non-negotiable artifact. IMPORTANT: your worktree must not leave a half-split build on the main tree - your prototype stays on your branch."
  },
  {
    id: "S-E",
    title: "what opening the toolchain buys",
    body: "QUESTION: concretely, what is worth the identity cost? METHOD: add package.json (NO \"type\" field - preserves .mjs/.js semantics repo-wide; sim-kernel.js/sim-worker.js are deliberately classic scripts) with Playwright as the ONLY devDependency; get smoke.mjs green (headless, temp browser profiles only - NEVER the user's installed browsers); then audit the wish list (bundler? TS? test framework?) against the known breakage surface: mc.mjs self-spawning via import.meta.url, the import.meta.url === argv[1] CLI detection, and jsmin's hand-authored-JS assumption all break under transpilation. DELIVERABLE: smoke output + a buy-list with per-item verdicts (each adoption needs a named consumer; default answer for everything except Playwright is no) + the re-scoped rule drafted for METHODOLOGY: dependencies are dev-time only; both shipped artifacts and the generator remain runtime-dependency-free. SUCCESS: smoke green. KNOWN PREDICTION (a finding, not a blocker, if it fires): the 8 ms slider-morph p95 budget fails on first re-run - if so, retune the budget to the measurement and pin it in your memo; do not quietly widen it."
  }
];

function spikePrompt(s) {
  return [
    HOUSE,
    "",
    "TASK - Phase 0 feasibility spike " + s.id + " (" + s.title + "), per docs/V3-PLAN.md section 1. You are in an ISOLATED GIT WORKTREE: write only scratch files and your own new prototype files. NEVER touch scripts/lib/policy.mjs, src/shell.html, scripts/verify.mjs, or data/model.json - no merge from this worktree may contaminate the frozen fixture tree.",
    "",
    s.body,
    "",
    "When done: `git add` your prototype/scratch files and commit them IN THIS WORKTREE (never push) so the branch survives for later reference; run `git branch --show-current` and report it.",
    "Return JSON: spike (" + JSON.stringify(s.id) + "), questionAnswered, success (against the stated criteria), grade ('A'|'B'|'C' for S-B; 'pass'|'fail' otherwise; 'n/a' if truly inapplicable), measurements (the actual numbers - wall time, error table, byte table, coverage counts - as text), recommendation (which decision-rule branch the plan should take), memo (the full numbers memo in markdown, self-contained, 30-120 lines; it will be committed verbatim to docs/spikes/" + s.id + ".md), branch."
  ].join("\n");
}

const B0_STEPS = [
  {
    label: "b0-fixture-freeze",
    prompt: [
      "TASK - B0 step 1: freeze the v2 fixture BEFORE any v3 code (docs/V3-PLAN.md sections 0.4 and 5.1). Using scripts/freeze-tiers.mjs (the sole fixture writer; extend it if the sweep needs it, without changing existing fixture output), freeze data/tiers-v2.fixture.txt over the full sweep: all 21 legal (pos,node) pairs x every integer v 25-90 x depth {40,100,250} x rake {0,preset} x straddle {off,on} x villain profile OFF. The sweep contains the v1 operating point (100bb / rake 0 / straddle off / random villains) so v1 identity is carried transitively. Then write gate I32 into the verifier: the legacy lane (all new axes at legacy settings) bit-for-bit against data/tiers-v2.fixture.txt over that sweep. I22 MUST remain green beside it - succession proven, not assumed. Do not commit.",
      "Return JSON: done, summary, newConstants (empty expected), blockers."
    ].join("\n")
  },
  {
    label: "b0-payoff-freeze",
    effort: "max", // the program's load-bearing architecture contract (model policy above)
    prompt: [
      "TASK - B0 step 2: freeze the payoff interface (docs/V3-PLAN.md section 2 - read it in full and follow it exactly). Create scripts/lib/payoff.mjs exporting payoff(cells, potSize, spr, opts) -> { ev, se, source, supported } with exactly the section-2 semantics: cells = cell keys hero-first (HU length 2; multiway may return supported:false, never a guess); potSize in current-unit bb; spr = effective stack / potSize; opts = { ip, seed } - position enters through the argument, never global state; ev is unit-pure pot fraction in [0,1]; se always present and > 0, derived from real trial counts, never typed; out-of-domain never throws and never returns an unflagged number; pure function of (args, model hash). Implement THE STUB: return shipped eq[N] at every spr (source:'checkdown', se from the shipped trial counts). Then write gate I33 with clauses (a)-(f) from section 2 PLUS the separate monotonicity clause (ev monotone in checkdown equity at fixed spr - the clause written to be falsified; it is additional to the six, not one of them). Do not commit.",
      "Return JSON: done, summary, newConstants, blockers."
    ].join("\n")
  },
  {
    label: "b0-gate-registry",
    prompt: [
      "TASK - B0 step 3: the gate-registry refactor (docs/V3-PLAN.md section 0.1). scripts/verify.mjs is ~129 KB of single-file gate code and a write-contention point. Split the gates into a scripts/gates/ registry (one file or coherent group per gate family), with scripts/verify.mjs becoming the runner. HARD GATE ON THE REFACTOR ITSELF: byte-identical gate OUTPUT before and after - capture `node scripts/verify.mjs` output pre-refactor, compare post-refactor; all 44 existing gates (plus the new I32/I33 landed just before you) must report identically. Add a per-gate timing line and a soft wall-time ceiling (measured+margin, stated in the output) so verification cost stays a measured, gated quantity. Do not commit.",
      "Return JSON: done, summary, newConstants, blockers."
    ].join("\n")
  }
];

async function runPhase0(state) {
  phase("P0 spikes + B0 freezes");
  state.phasesRun.push("P0 spikes + B0 freezes");
  log("Fanning out 5 spikes (worktrees) + 3 serial B0 steps (main tree)");

  // parallel(), not pipeline(): the five spikes are a genuine fan-out (plan section 1, locked 4.9),
  // each in its own isolated worktree - same idiom as the red-team refuters.
  const spikesP = parallel(SPIKES.map(function (s) {
    return function () {
      return agent(spikePrompt(s), {
        label: "spike-" + s.id, phase: "P0 spikes + B0 freezes",
        schema: spikeSchema, model: "opus", effort: "xhigh", isolation: "worktree"
      });
    };
  }));

  const b0P = (async function () {
    const out = [];
    for (const step of B0_STEPS) {
      log("B0 serial step: " + step.label);
      const order = step.effort === "max"
        ? await fableWorkOrder(state, "P0 spikes + B0 freezes", step.label, step.prompt)
        : "";
      const r = await agent(HOUSE + "\n\n" + step.prompt + order, {
        label: step.label, phase: "P0 spikes + B0 freezes", schema: stepSchema,
        model: "opus", effort: step.effort || "xhigh"
      });
      out.push(r);
      if (!r || !r.done) {
        state.blockers.push("B0 step failed: " + step.label + (r ? " - " + r.summary + " " + r.blockers.join("; ") : " (agent died)"));
        break;
      }
      if (r.blockers.length) state.blockers.push(...r.blockers);
    }
    return out;
  })();

  const spikeResults = (await spikesP).filter(Boolean);
  await b0P;
  if (state.blockers.length) {
    state.notes.push("B0 serial chain aborted; not consolidating");
    return closeMilestone(state, "P0 verify + commit", [], "v3 P0 (partial, red)", "");
  }
  for (const s of spikeResults) {
    log("Spike " + s.spike + ": success=" + s.success + " grade=" + s.grade + " -> " + s.recommendation.slice(0, 120));
  }
  if (spikeResults.length < SPIKES.length) {
    state.blockers.push("only " + spikeResults.length + "/5 spikes returned verdicts; missing spikes must be treated as FAILED per their plan failure branch");
  }

  phase("P0 consolidation");
  state.phasesRun.push("P0 consolidation");
  const cons = await agent([
    HOUSE,
    "",
    "TASK - Phase 0 consolidation, on the main tree (no worktree). The five feasibility spikes returned these structured verdicts (JSON):",
    JSON.stringify(spikeResults, null, 2),
    "",
    "Do all of the following:",
    "1. Create docs/spikes/ and write each spike's `memo` field verbatim to docs/spikes/<id>.md (S-A..S-E), adding a one-line header with its branch name. A spike that returned nothing gets a memo stating it failed and naming its plan failure branch.",
    "2. Annotate docs/V3-PLAN.md IN PLACE, exactly in the V2-PLAN idiom: under each spike spec in section 1, append a `> **Measured (phase 0).**` block with the spike's measurements and verdict - confirmations AND falsifications recorded, plan text above the annotations kept as written, reversals recorded rather than edited away.",
    "3. Adjust the affected later-phase specs per the plan's own decision rules: apply S-B's three-band rule (section 3.6 Grade table) by annotating sections 3.2/3.4/5.4 with the selected band and its consequences; apply S-A's branch (CFR+ vs LP/regret-matching, 6-max in/out per the half-budget rule) to section 3.3; apply S-C's outcome to sections 3.5/5.4; apply S-D's outcome to section 5.3/9; apply S-E's buy-list to section 9. Annotations only - do not rewrite plan prose.",
    "4. Draft the full section 7 gate catalog with reserved ids into the scripts/gates/ registry as stubs or a registry manifest (reserved, not yet enforced), and write S-C's PRE-REGISTERED PRIMACY CRITERIA verbatim (from the S-C memo) into the I46 entry - the bar is fixed now, before any EV number exists. If S-C failed, record I46 as unpassable-by-construction.",
    "Do not commit. Return JSON: done, summary, newConstants (empty expected), blockers."
  ].join("\n"), { label: "consolidate", phase: "P0 consolidation", schema: stepSchema, model: "opus", effort: "xhigh" });
  if (!cons || !cons.done) {
    state.blockers.push("consolidation failed" + (cons ? ": " + cons.blockers.join("; ") : " (agent died)"));
  } else if (cons.blockers.length) {
    state.blockers.push(...cons.blockers);
  }
  state.notes.push("spike verdicts: " + spikeResults.map(function (s) { return s.spike + "=" + (s.success ? "pass" : "FAIL") + "/" + s.grade; }).join(", "));

  return closeMilestone(
    state, "P0 verify + commit", ["I22", "I32", "I33"],
    "v3 P0: five spikes measured, v2 fixture frozen (I32), payoff interface frozen (I33), gate registry split",
    "Also confirm: scripts/gates/ registry exists and the verifier reports a per-gate timing line; docs/spikes/S-A.md..S-E.md exist; docs/V3-PLAN.md contains '> **Measured (phase 0).**' annotations."
  );
}

// ---------------------------------------------------------------------------
// Milestone: P1
// ---------------------------------------------------------------------------

const LANES = [
  {
    id: "M",
    owns: "scripts/lib/policy.mjs (SINGLE WRITER - no other lane touches it)",
    body: "Lane M, per docs/V3-PLAN.md section 3.1, items 6, 7, 9, 8 IN THAT ORDER. Item 6: rake-depth coupling - rake.potBB(d) scaling with the knee-at-100bb identity anchor (3/0.05 = 60 re-described; scaling exponent is one new opinion, shipped FLAGGED and gated), gate I41 (rakeFrac(100bb)=5.00% identity, rakeFrac(250bb)=2.00%, monotone in depth, exact arithmetic incl. the straddle-doubled cap unit, vs-3-bet price 30.53% -> 29.59% across the slider). Item 6b/7: depth->width factor from the raw baseRealization(pos,d)/baseRealization(pos,100) ratio (zero new opinion), gate I42 (width ratio = realization ratio EXACTLY, seat signs per brief 5.4: blinds/early tighten deep, CO/BTN loosen; compounding with M_deep bounded by a RE-MEASURED allowance); plus the depth-dial re-description with the lambda/mu decision made FROM the measured METHODOLOGY 5.2 correlations by the section 3.1 rule (re-weight only if it keeps I23(a-c) green while making corr(rank move, nu) dominant; otherwise re-describe), folded into the I23 rewrite. Item 9: 3-bet sizing axis, gate I44 (pot-size = today bit-for-bit; continue range narrows monotonically in sizing; the 7-pt premium's sizing-dependence CANNOT be anchored - held constant, flagged 'calibrated at pot', I44 measures the consequence). Item 8: villain default-on - build gate I43 and the profile-ON machinery (at load defaults v=55 lattice point, q=0.85, every tier cut from measured rows, zero interpolated cells at load; OFF is OBJECT IDENTITY, assert.equal not deepEqual; I6/I7/I13/I19 sweeps re-run under ON) BUT DO NOT FLIP THE DEFAULT - the flip and its fixture ceremony happen at the B1 integration stage, not in your worktree. Everything you land must be inert at legacy settings so I32 stays green (couplings knee'd at 100bb). Doc slot: add METHODOLOGY section 10 limitations 16 and 17 (rho relevance decay; percentile cut cannot change how many hands you play, absolute-EV cut named as the designated fix) rendered in the Method view via the constants/limitations machinery, and the staleness fixes (the '46 gates' line, pre-sub-cut payload tables in 9.10/9.11, the dangling 12.4 reference, present-tense sub-bucket prose in 9.12).",
    constants: ["rake.potBB depth-coupling scaling exponent (flagged, gate I41)", "depth->width gain via baseRealization ratio (claimed zero-new-opinion - verify)", "3-bet sizing off-default thresholds (exact arithmetic on breakeven(s)) and the 7-pt premium held-constant-at-pot flag (gate I44)"]
  },
  {
    id: "U",
    owns: "src/shell.html (SINGLE WRITER - no other lane touches it)",
    body: "Lane U, per docs/V3-PLAN.md sections 3.1 and 8. Item 12 rail collapse: .rsec-h headers become buttons with chevron + value slot; seed collapsed values from the four existing .t-micro tags (#vpiptag, #tabletag, #vptag, #ribbonwho); invent four summaries for thesis/pin/node/display; collapse is CSS-only on a body wrapper so sync*/render* repaints stay valid; persistence via the existing store() localStorage helper with its write-probe (NEVER the hash - it is the share channel); compose with per-feature `hidden`; '?' buttons keep stopPropagation; re-measure the pinned/scroll split. Harness checks: collapse survives reload, feature-hidden x collapsed compose, value slots update while collapsed. Item 15 top bar: view switch unchanged; colour-mode control lives on the MATRIX legend row, not the top bar; full-only modes render disabled-with-named-REASON (the SIM.available idiom). Item 14 first pass: inspector IA restructured to four tabs - Verdict / Numbers / Composition / Hand - with the liveInspector drag-path selectors preserved or updated in the same commit. Item 13 scaffold: colour-mode switch on the legend row with TIER mode fully live and EV mode rendering against the frozen payoff STUB (scripts/lib/payoff.mjs) with its source badge; every mode re-provides the colorblind redundancy channel, aria labels, tooltip content; I13 (combos partition) asserted in every mode. Everything inert at legacy settings; edit src/shell.html only, rebuild via scripts/build.mjs.",
    constants: []
  },
  {
    id: "I",
    owns: "scripts/build.mjs (SINGLE WRITER - no other lane touches it)",
    body: "Lane I, per docs/V3-PLAN.md sections 3.1 and 9, and the S-D/S-E memos in docs/spikes/ (READ THEM FIRST; follow their verdicts - if S-D failed, the full build is constrained to lite-plus-injected-blocks). Item 16 dual build: --variant=lite|full flag, @only:full/@only:lite markers in the @inject style, per-variant budget constants, per-variant --check loop, a variant manifest that the D-gates read (D6/D7 evaluated against lite - restated as 'binding on the lite artifact', D6 total raised 120->132 KB with the baseline-tier sub-budget named and paid for at the gate); gates D10 (lite negative manifest: no @inject:eq region, no solver payload, no estimator runtime; baseline-tier block explicitly lite-legal) and D11 (dual determinism, variant named in the provenance banner, per-variant honesty sentence grep-gated). The fetch(/<script src=> refusals stay ABSOLUTE for both artifacts. Item 18: package.json with Playwright as sole devDependency, no \"type\" field; smoke re-gated per variant per the S-E memo (if the 8 ms slider-morph budget fired, pin the retuned measured budget). Item 17: FF/Safari harness measuring exactly METHODOLOGY 10.15's three named facts (Blob-worker boot on file://, localStorage reachability via the write probe, rAF suspension while hidden) - headless, temp profiles only, NEVER the user's installed browsers; on-screen disclosures updated to whatever is measured, degradations disclosed rather than patched blind.",
    constants: ["per-variant byte budgets and the full-page tripwire (measured+5%, arithmetic - verify the arithmetic; D9 does not exist until P3 and is red-teamed there)", "smoke slider-morph p95 budget (re-pinned to measurement if the S-E prediction fired)"]
  },
  {
    id: "C",
    owns: "NEW FILES ONLY (scripts/lib/calibration*, scripts/parse-hh*, test files for them) - touch nothing that exists",
    body: "Lane C, per docs/V3-PLAN.md section 3.1 and the S-C memo in docs/spikes/S-C.md (READ IT FIRST). Build the calibration harness + hand-history parser plumbing per S-C's spec: parser, per-cell showdown aggregation, reproducibility harness, and the plumbing that will later compute the pre-registered I46 statistic. NO CONSTANT MAY MOVE HERE - the verdict is Phase 5's alone; the harness must be able to REPORT fitted-vs-shipped disagreements (the future calibration.disputed idiom) without writing any of them into the model. If S-C failed, build the self-play-consistency harness half only and record the corpus absence in your summary.",
    constants: []
  }
];

function lanePrompt(l) {
  return [
    HOUSE,
    "",
    "TASK - P1 lane " + l.id + ". You are in an ISOLATED GIT WORKTREE. File ownership is absolute: you own " + l.owns + ". Do not modify files owned by other lanes (M: scripts/lib/policy.mjs; U: src/shell.html; I: scripts/build.mjs). Gates you add go in scripts/gates/ as NEW files (the registry exists precisely so lanes don't contend on verify.mjs). Shared docs: lane M owns the METHODOLOGY edits this phase; other lanes queue doc changes in their summary for the integration agent.",
    "",
    l.body,
    "",
    "Read docs/V3-PLAN.md sections 3.1, 7, and 8, and any '> **Measured (phase 0).**' annotations before starting - spike outcomes may have adjusted your spec. Run the three checks in your worktree until green. Commit your work IN THE WORKTREE with descriptive messages (never push). Report `git branch --show-current`.",
    "Return JSON: lane, branch, filesTouched, gatesAdded (gate ids), newConstants (names of opinion-layer constants you added, with one-line anchors), summary, blockers."
  ].join("\n");
}

async function runP1(state) {
  phase("P1 lane fan-out");
  state.phasesRun.push("P1 lane fan-out");
  log("Fanning out lanes M / U / I / C in isolated worktrees");
  // parallel(), not pipeline(): the four lanes are a genuine fan-out (plan sections 3.1 and 12),
  // isolation guaranteed by one worktree each + single-writer file ownership.
  const lanes = (await parallel(LANES.map(function (l) {
    return function () {
      return agent(lanePrompt(l), {
        label: "lane-" + l.id, phase: "P1 lane fan-out",
        schema: laneSchema, model: "opus", effort: "xhigh", isolation: "worktree"
      });
    };
  }))).filter(Boolean);
  for (const l of lanes) {
    log("Lane " + l.lane + " done on branch " + l.branch + " (gates: " + l.gatesAdded.join(", ") + ")");
    if (l.blockers.length) state.blockers.push(...l.blockers.map(function (b) { return "lane " + l.lane + ": " + b; }));
  }
  if (lanes.length < LANES.length) {
    state.blockers.push("only " + lanes.length + "/4 P1 lanes returned; missing lane work must not be silently dropped");
    state.notes.push("P1 aborted before integration");
    return closeMilestone(state, "P1 verify + commit", [], "v3 P1 (partial, red)", "");
  }

  phase("P1 integration + B1 flip");
  state.phasesRun.push("P1 integration + B1 flip");
  const integ = await agent([
    HOUSE,
    "",
    "TASK - P1 integration + the B1 barrier, on the MAIN tree. The four lane agents finished in isolated worktrees. Their reports (JSON):",
    JSON.stringify(lanes, null, 2),
    "",
    "Do, in order:",
    "1. Merge all four lane branches into the current branch (merge, resolving conflicts by file ownership: policy.mjs=M, src/shell.html=U, build.mjs=I, C's files are new). Apply any doc changes the non-M lanes queued in their summaries.",
    "2. Run the three checks; fix integration-level breakage (interface mismatches between lanes), but do NOT rewrite lane logic or weaken gates.",
    "3. THE B1 FLIP (docs/V3-PLAN.md sections 3.1, 5.1): flip the item-8 villain-profile default to ON - the flip changes the page's INITIAL STATE only, never the semantics of the legacy state; the OFF path stays object-identical. Then THE THIRD-FIXTURE CEREMONY: run scripts/freeze-tiers.mjs to freeze data/tiers-v3-default.fixture.txt at the new default state and commit the printed tier diff into docs/METHODOLOGY.md - ALONGSIDE, not replacing, the v2 fixture. This is the ONE prompt in P1 authorized to run the freeze ceremony.",
    "4. Confirm I22 AND I32 are green AFTER the merge and the flip (the whole point of the legacy lane). If I32 fires, the plan predicts this exact firing during the OFF-path work - fix the leak (most likely a memo key missing a new axis), never the fixture.",
    "Do not make the milestone commit (a later stage does). Return JSON: done, summary, newConstants (any constants integration itself introduced - expected empty), blockers."
  ].join("\n"), { label: "integrate-P1", phase: "P1 integration + B1 flip", schema: stepSchema, model: "opus", effort: "xhigh" });
  if (!integ || !integ.done) {
    state.blockers.push("P1 integration failed" + (integ ? ": " + integ.blockers.join("; ") : " (agent died)"));
    return closeMilestone(state, "P1 verify + commit", [], "v3 P1 (partial, red)", "");
  }
  if (integ.blockers.length) state.blockers.push(...integ.blockers);

  const p1Constants = [];
  for (const l of lanes) p1Constants.push(...(l.newConstants || []));
  for (const l of LANES) p1Constants.push(...l.constants);
  const uniq = p1Constants.filter(function (c, i) { return p1Constants.indexOf(c) === i; });
  await redTeam(state, "P1 adversarial verification", uniq, "docs/refutations/P1.md");

  return closeMilestone(
    state, "P1 verify + commit", ["I22", "I32", "I33", "I41", "I42", "I43", "I44", "D10", "D11"],
    "v3 P1: lanes M/U/I/C merged - rake-depth (I41), depth-width (I42), sizing (I44), villain default-on at B1 (I43) + third fixture, rail/top-bar/inspector IA, dual build (D10/D11), calibration plumbing",
    "Also confirm data/tiers-v3-default.fixture.txt exists and its tier diff is recorded in docs/METHODOLOGY.md; run --check for BOTH variants."
  );
}

// ---------------------------------------------------------------------------
// Milestone: P2
// ---------------------------------------------------------------------------

async function runP2(state) {
  phase("P2 chain fan-out");
  state.phasesRun.push("P2 chain fan-out");
  const pre = await agent([
    HOUSE,
    "",
    "TASK - P2 precheck (the payoff-interface freeze must precede all chain fan-out). Verify: (1) scripts/lib/payoff.mjs exists with the frozen section-2 signature; (2) gate I33 is present and GREEN right now (run `node scripts/verify.mjs`); (3) docs/spikes/S-A.md and docs/spikes/S-B.md exist - read both and extract S-B's grade band (A: p95<=2.5, B: 2.5-5.0, C: >5.0) and S-A's verdict (CFR+ ok, or LP/regret-matching fallback; 6-max in or out per the half-budget rule). Change nothing.",
    "Return JSON: ok (all three conditions hold), detail (S-A verdict + anything failing), gradeBand ('A'|'B'|'C')."
  ].join("\n"), { label: "precheck-P2", phase: "P2 chain fan-out", schema: precheckSchema, model: "sonnet", effort: "medium" });
  if (!pre || !pre.ok) {
    state.blockers.push("P2 precheck failed - the frozen payoff interface (I33 green) is the fan-out unlock: " + (pre ? pre.detail : "agent died"));
    return finish(state);
  }
  const band = pre.gradeBand;
  log("P2 fan-out under S-B Grade " + band + " (" + pre.detail.slice(0, 140) + ")");

  const p2Specs = [
    {
      id: "payoff-model",
      prompt: [
        "TASK - P2 payoff estimator, per docs/V3-PLAN.md sections 3.2 and 3.6, in an ISOLATED WORKTREE. Create scripts/lib/payoff-model.mjs (NEW file; also new test/gate files only - do not modify scripts/lib/payoff.mjs's frozen interface, policy.mjs, or src/shell.html). Implement the estimator form the S-B memo (docs/spikes/S-B.md) selected as winner, wired behind the frozen payoff() accessor as source:'model'. S-B's grade band is " + band + ": Grade A -> measurement-anchored; Grade B -> every emitted number badged `estimate`, EV primacy already answered 'no' for v3; Grade C -> DO NOT wire the model in - keep the checkdown stub as the live source, land your prototype behind a disabled flag, and say so in your summary. Estimator params are fitted to S-B's street-sim ground truth with residuals shipped like benchmarks.disputed; the stack-off knob takes its anchor from S-B's sensitivity sweep, and if none survives it CANNOT be anchored -> gated, flagged, badged `interpolated` - never invented. I33's clauses (a)-(f) (incl. spr->0 identity to checkdown, zero-sum, se>0 from real trials, supported:false honesty) must pass ON YOUR MODEL, and its monotonicity clause is expected to be falsified at spr>=4 on high-cooler hands - when it fails, rewrite the clause to the measurement per house style and record the finding. Wherever the payoff model supersedes M_deep's anchors (I23's measured counts, mu's sd-ratio), re-anchor them explicitly - never silently break them. Run the three checks green in your worktree; commit there (never push); report your branch."
      ].join("\n")
    },
    {
      id: "cfr",
      prompt: [
        "TASK - P2 solver engine, per docs/V3-PLAN.md sections 3.2 and 3.6, in an ISOLATED WORKTREE. Create scripts/lib/cfr.mjs (NEW file; also new test/gate files only - do not modify scripts/lib/payoff.mjs's frozen interface, policy.mjs, or src/shell.html). Implement the solver per the S-A memo (docs/spikes/S-A.md): CFR+ on the 123-cell abstraction over the capped HU preflop tree if S-A passed, else the LP/regret-matching variant S-A recommended; 6-max MCCFR only if S-A landed inside HALF its wall-time budget, otherwise leave it explicitly deferred. THE B2 RULE: the solver consumes payoffs ONLY through the frozen scripts/lib/payoff.mjs accessor (gate I33 clause e - no direct payoff-table reads), and in this phase it runs against whatever source that accessor serves - do not wire it to the real payoff model yourself; that marriage is P3's job, gated on I33 passing on the model. Write gate I35: exploitability <= epsilon; strategies sum to 1; two independent seeds reach the same HU value within tolerance; 6-max (if present) scoped to fixed-point-only claims. Constants: epsilon <= the payoff's own se (solving tighter than the payoff's error is fake precision); iteration cap anchored to S-A's measured convergence curve; the tree/sizing set anchored to the existing pot-sized conventions (the breakeven = 0.29 lineage), every cap listed on-screen via the constants block, FLAGGED as an abstraction choice. Run the three checks green in your worktree; commit there (never push); report your branch."
      ].join("\n")
    }
  ];

  // parallel(), not pipeline(): payoff estimator and solver engine fan out against the frozen
  // I33 interface (plan section 3.2 - disjoint new files, one isolated worktree each).
  const pair = (await parallel(p2Specs.map(function (s) {
    return function () {
      return agent(HOUSE + "\n\n" + s.prompt + "\n\nReturn JSON: lane (" + JSON.stringify(s.id) + "), branch, filesTouched, gatesAdded, newConstants (with one-line anchors), summary, blockers.", {
        label: "p2-" + s.id, phase: "P2 chain fan-out",
        schema: laneSchema, model: "opus", effort: "xhigh", isolation: "worktree"
      });
    };
  }))).filter(Boolean);
  for (const r of pair) {
    if (r.blockers.length) state.blockers.push(...r.blockers.map(function (b) { return r.lane + ": " + b; }));
  }
  if (pair.length < 2) {
    state.blockers.push("P2 fan-out incomplete (" + pair.length + "/2 returned)");
    return closeMilestone(state, "P2 verify + commit", [], "v3 P2 (partial, red)", "");
  }

  phase("P2 integration");
  state.phasesRun.push("P2 integration");
  const integ = await agent([
    HOUSE,
    "",
    "TASK - P2 integration, on the MAIN tree. Merge these two worktree branches (disjoint new files; conflicts should be near-nil - if both added gate registry entries or test helpers, reconcile):",
    JSON.stringify(pair, null, 2),
    "",
    "After merging: run the three checks; confirm I33 is still green (on the stub, and on the model if Grade A/B wired it); confirm the I33 clause-(e) grep gate still proves every consumer goes through the accessor. Fix integration-level breakage only; do not rewrite either component or weaken gates. Do not commit (a later stage does).",
    "Return JSON: done, summary, newConstants (expected empty), blockers."
  ].join("\n"), { label: "integrate-P2", phase: "P2 integration", schema: stepSchema, model: "opus", effort: "xhigh" });
  if (!integ || !integ.done) {
    state.blockers.push("P2 integration failed" + (integ ? ": " + integ.blockers.join("; ") : " (agent died)"));
    return closeMilestone(state, "P2 verify + commit", [], "v3 P2 (partial, red)", "");
  }
  if (integ.blockers.length) state.blockers.push(...integ.blockers);

  const p2Constants = [];
  for (const r of pair) p2Constants.push(...(r.newConstants || []));
  const defaults = [
    "payoff estimator params (anchor: fitted to S-B street-sim ground truth, residuals shipped)",
    "estimator stack-off knob (anchor from S-B sensitivity sweep, else flagged interpolated)",
    "solver exploitability target epsilon (anchor: <= payoff se)",
    "solver iteration cap (anchor: S-A measured convergence curve)",
    "solver tree/sizing set (anchor: existing pot-sized conventions, flagged abstraction choice)"
  ];
  for (const d of defaults) if (p2Constants.indexOf(d) === -1) p2Constants.push(d);
  await redTeam(state, "P2 adversarial verification", p2Constants, "docs/refutations/P2.md");

  return closeMilestone(
    state, "P2 verify + commit", ["I22", "I32", "I33", "I35"],
    "v3 P2: payoff estimator (payoff-model.mjs) + solver engine (cfr.mjs) built in parallel against the frozen payoff interface; I35",
    "Grade band for this build was " + band + " - if B or C, confirm every model-sourced EV surface is estimate-badged (Grade C: stub still live)."
  );
}

// ---------------------------------------------------------------------------
// Milestone: P3
// ---------------------------------------------------------------------------

async function runP3(state) {
  phase("P3 equilibrium baseline");
  state.phasesRun.push("P3 equilibrium baseline");
  const pre = await agent([
    HOUSE,
    "",
    "TASK - P3 precheck (barrier B2). Verify: (1) scripts/lib/payoff-model.mjs and scripts/lib/cfr.mjs exist and I35 is green; (2) THE B2 CONDITION: gate I33 passes ON THE REAL PAYOFF MODEL (source:'model') - not just the stub - by running the verifier and reading the I33 gate output. Read docs/spikes/S-A.md and docs/spikes/S-B.md for the grade band. If S-B was Grade C, the B2 decision applies: report gradeBand 'C' so the vs-GTO surface ships caveated (checkdown label) or cut per plan sections 3.2/3.6. Change nothing.",
    "Return JSON: ok (conditions hold, or Grade C explicitly acknowledged), detail, gradeBand."
  ].join("\n"), { label: "precheck-P3", phase: "P3 equilibrium baseline", schema: precheckSchema, model: "sonnet", effort: "medium" });
  if (!pre || !pre.ok) {
    state.blockers.push("P3 precheck failed at barrier B2 (solver may not consume the real payoff until I33 passes on it): " + (pre ? pre.detail : "agent died"));
    return finish(state);
  }
  log("B2 passed (grade " + pre.gradeBand + "); building the equilibrium baseline");

  const base = await agent([
    HOUSE,
    "",
    "TASK - P3 equilibrium baseline, per docs/V3-PLAN.md sections 3.3 and 5.3, on the MAIN tree (single writer this phase). S-B grade band: " + pre.gradeBand + ". Do:",
    "1. Marry the solver (scripts/lib/cfr.mjs) to the payoff accessor's best available source (Grade C: checkdown, wearing the on-screen 'a game where postflop does not exist' label). Emit data/equilibrium.json - FULL build only, injected via a new @inject:eq region - carrying full strategies, the 7,626-pair matrix, calibration detail. Write gate D9: measured+5% byte tripwire on it.",
    "2. Emit the quantized baseline-tier block into the shared core (per (pos,node,cell) baseline tiers, quantized via a named `baselineQuant` constant anchored to the payload bytes it buys) budgeted <= 12 KB - the named D6 sub-budget (D6 total 132 KB). Lite keeps the tier-level vs-GTO mode; confirm D10's lite negative manifest still passes.",
    "3. Labeling per plan 3.3, on-screen: HU is 'GTO'; anything multiway is 'self-play fixed point'; 6-max MCCFR only if the S-A memo showed HU inside half its budget, else explicitly deferred with the on-screen caveat that the baseline is HU.",
    "4. The vs-GTO comparand is RAW model tiers with post-passed display noted - the post-passes (nesting, suit monotonicity) are impositions an equilibrium may violate; a violation is a finding to report, not launder. Write gate I36: AA_BIGPAIR x DS opens everywhere; TRASH x RB never opens UTG; emergent positional nesting UTG within HJ within CO within BTN - the plan PREDICTS the nesting clause fails at some seat pair; if it does, record the finding (a Measured annotation in docs/V3-PLAN.md section 7) and scope the clause to the measurement rather than tolerancing it away. The raw-vs-post-passed display decision is forced by that outcome (plan section 14.4).",
    "Run the three checks green (both variants). Do not commit.",
    "Return JSON: done, summary, newConstants (with one-line anchors - baselineQuant expected here), blockers."
  ].join("\n"), { label: "p3-baseline", phase: "P3 equilibrium baseline", schema: stepSchema, model: "opus", effort: "xhigh" });
  if (!base || !base.done) {
    state.blockers.push("P3 baseline failed" + (base ? ": " + base.blockers.join("; ") : " (agent died)"));
    return closeMilestone(state, "P3 verify + commit", [], "v3 P3 (partial, red)", "");
  }
  if (base.blockers.length) state.blockers.push(...base.blockers);

  const ui = await agent([
    HOUSE,
    "",
    "TASK - P3 UI: vs-GTO live, per docs/V3-PLAN.md section 8 (you are the single src/shell.html writer this phase). Wire the vs-GTO colour mode onto the matrix legend-row switch scaffolded in P1: the page's first true diverging signed ramp (the delta-pin two-colour encoding is insufficient for signed magnitude), colorblind redundancy channel, aria labels, tooltip content, I13 combos-partition asserted in this mode; in LITE the mode runs off the quantized baseline-tier block, in FULL off @inject:eq detail; full-only depth renders disabled-with-named-REASON in lite. Inspector: the vs-GTO divergence line slots into the Verdict tab's margin/headline seams (marginUnit/eqSE provenance machinery) and the reason-line machinery gains the divergence sentence. The comparand rendering follows the I36 outcome recorded in docs/V3-PLAN.md section 7 annotations (raw either way; the grid display decision per the finding). Everything inert at legacy settings (TIER default): I32 must stay green. Run the three checks green (both variants). Do not commit.",
    "Return JSON: done, summary, newConstants (expected empty), blockers."
  ].join("\n"), { label: "p3-ui", phase: "P3 equilibrium baseline", schema: stepSchema, model: "opus", effort: "xhigh" });
  if (!ui || !ui.done) {
    state.blockers.push("P3 UI failed" + (ui ? ": " + ui.blockers.join("; ") : " (agent died)"));
    return closeMilestone(state, "P3 verify + commit", [], "v3 P3 (partial, red)", "");
  }
  if (ui.blockers.length) state.blockers.push(...ui.blockers);

  const p3Constants = ["baselineQuant tier-quantization step (anchor: the payload bytes it buys, stated at D6's sub-budget)", "D9 equilibrium.json byte budget (anchor: measured+5%, arithmetic)"];
  for (const c of (base.newConstants || [])) if (p3Constants.indexOf(c) === -1) p3Constants.push(c);
  await redTeam(state, "P3 adversarial verification", p3Constants, "docs/refutations/P3.md");

  return closeMilestone(
    state, "P3 verify + commit", ["I22", "I32", "I33", "I35", "I36", "D9", "D10", "D11"],
    "v3 P3: equilibrium baseline - solver married to payoff at B2, data/equilibrium.json (D9) + baseline-tier block, vs-GTO colour mode live (I36)",
    "Both variants must --check current; the baseline-tier block must be lite-legal under D10."
  );
}

// ---------------------------------------------------------------------------
// Milestone: P4
// ---------------------------------------------------------------------------

async function runP4(state) {
  phase("P4 skill + EV cut");
  state.phasesRun.push("P4 skill + EV cut");
  const pre = await agent([
    HOUSE,
    "",
    "TASK - P4 precheck (barrier B3). Verify data/equilibrium.json exists (or its @inject:eq region in the full build), gate D9 is green, and the quantized baseline-tier block ships in the shared core (D6's named sub-budget). Run `node scripts/verify.mjs` to confirm. Also read docs/spikes/S-B.md for the grade band (Grade C halves the skill axis to its fold-more half per plan 3.6). Change nothing.",
    "Return JSON: ok, detail, gradeBand."
  ].join("\n"), { label: "precheck-P4", phase: "P4 skill + EV cut", schema: precheckSchema, model: "sonnet", effort: "medium" });
  if (!pre || !pre.ok) {
    state.blockers.push("P4 precheck failed at barrier B3 (skill axis and EV cut may not start before equilibrium.json + D9 + baseline-tier block exist): " + (pre ? pre.detail : "agent died"));
    return finish(state);
  }

  const skill = await agent([
    HOUSE,
    "",
    "TASK - P4 skill axis, per docs/V3-PLAN.md section 3.4 (grade band " + pre.gradeBand + "; Grade C: build ONLY the fold-more half). You write scripts/lib/policy.mjs first this phase; the EV-cut agent follows you serially - leave it clean. Skill dial as offset-from-baseline: the fold-more half re-uses the measured v-lattice (anchor: no new opinion); the plays-better half cuts realization through the payoff layer - its coefficient CANNOT be anchored today (no measurement of postflop skill exists): ship it gated (I38 bounds its reach), flagged `estimate`, said out loud in METHODOLOGY. The interior blend between the anchored endpoints (measured lattice at one end, solver baseline at the other) CANNOT be anchored -> gated, flagged, badged `interpolated`. Write gate I38: the lobby endpoint reproduces the current model exactly (OBJECT IDENTITY); combo-weighted width tightens with skill; per-cell exceptions enumerated, never tolerated away; the plays-better coefficient's reach bounded. Also gate I37 (divergence accounting): signed vs-GTO divergence combo-weighted ~ 0 at pool = baseline; per-cell convergence toward equilibrium as the dial rises - the plan PREDICTS the rank-overlap rows (BROADWAY_RUN, RUN0_HIGH) violate monotone convergence; if they do, ship the finding as a Measured annotation, do not tolerance it away. Everything inert at the lobby default: I32 stays green. Run the three checks green. Do not commit.",
    "Return JSON: done, summary, newConstants (with one-line anchors), blockers."
  ].join("\n"), { label: "p4-skill", phase: "P4 skill + EV cut", schema: stepSchema, model: "opus", effort: "xhigh" });
  if (!skill || !skill.done) {
    state.blockers.push("P4 skill axis failed" + (skill ? ": " + skill.blockers.join("; ") : " (agent died)"));
    return closeMilestone(state, "P4 verify + commit", [], "v3 P4 (partial, red)", "");
  }
  if (skill.blockers.length) state.blockers.push(...skill.blockers);

  const evcutTask = [
    "TASK - P4 absolute-EV cut, per docs/V3-PLAN.md sections 3.4 and 5.4. You are the designated scripts/lib/policy.mjs writer for this step (the skill-axis agent has finished). The EV cut runs BESIDE the percentile cut in aggressiveSet - a second predicate EV >= 0 active only in EV mode - with margins gaining a third unit and t4Band reconciled in frequency terms. THE I34 QUARANTINE (write this gate first): tier output BIT-IDENTICAL across view modes at every setting, verified in ONE process with modes toggled interleaved (the settings-hash-walk idiom - this is what catches memo poisoning), with an OBJECT-IDENTITY clause (assert.equal, not tolerance) so a shaky EV number is structurally unable to move a tier; badge text derives from source/se, never hard-coded; the EV-primary code path gated on model.calibration.verdict === 'pass', which only the P5 ceremony may stamp - ships failing closed. Gate I39: EV(fold) = 0; sign agrees with breakeven at vs-3-bet within tolerance; rake enters exactly (the I31(c) extension); badges derive from data. Gate I40: in EV mode, rake narrows width at percentile nodes (the deliberate anti-I31(a)) and depth moves width with the seat signs; the plan OFFERS for falsification 'shallow+raked folds more than deep+raked at every seat' - if the coupling inverts anywhere, ship the finding. Re-scope I31(a) to the score path. EV MIX band width = k x payoff-se at default trials, where k is NOT free: solve k so the EV-mode MIX band's combo-weighted mass at default settings equals t4Band's measured frequency mass - the section 10.11 transposition made arithmetic on the shipped distribution (the se sets the unit, t4Band's mass sets the multiplier; no felt number anywhere). Everything inert in score mode: I32 stays green. Run the three checks green. Do not commit.",
    "Return JSON: done, summary, newConstants (with one-line anchors), blockers."
  ].join("\n");
  const evcutOrder = await fableWorkOrder(state, "P4 skill + EV cut", "p4-evcut", evcutTask);
  const evcut = await agent(HOUSE + "\n\n" + evcutTask + evcutOrder, { label: "p4-evcut", phase: "P4 skill + EV cut", schema: stepSchema, model: "opus", effort: "max" });
  if (!evcut || !evcut.done) {
    state.blockers.push("P4 EV cut failed" + (evcut ? ": " + evcut.blockers.join("; ") : " (agent died)"));
    return closeMilestone(state, "P4 verify + commit", [], "v3 P4 (partial, red)", "");
  }
  if (evcut.blockers.length) state.blockers.push(...evcut.blockers);

  const ui = await agent([
    HOUSE,
    "",
    "TASK - P4 UI, per docs/V3-PLAN.md section 8 (single src/shell.html writer). Make the EV colour mode fully live against the real payoff surface (sequential ramp + the .ramp legend helper, colorblind redundancy, aria, tooltips, I13 in-mode); surface the skill dial (full build; disabled-with-named-REASON in lite if it depends on full-only payload); inspector Verdict/Numbers tabs gain the EV decomposition + waterfall content against the marginUnit/eqSE provenance seams; all three presentations (absolute EV, decision-delta, score) switchable per plan 5.4, score cutting tiers, EV badged by source. Everything inert at legacy settings (score mode default): I32 and I34 stay green. Run the three checks green (both variants). Do not commit.",
    "Return JSON: done, summary, newConstants (expected empty), blockers."
  ].join("\n"), { label: "p4-ui", phase: "P4 skill + EV cut", schema: stepSchema, model: "opus", effort: "xhigh" });
  if (!ui || !ui.done) {
    state.blockers.push("P4 UI failed" + (ui ? ": " + ui.blockers.join("; ") : " (agent died)"));
  } else if (ui.blockers.length) state.blockers.push(...ui.blockers);

  const p4Constants = [
    "skill-dial interior blend (plan-declared unanchorable: must ship gated + flagged + badged interpolated)",
    "skill-dial plays-better coefficient (plan-declared unanchorable: gated by I38's reach bound, flagged estimate)",
    "EV MIX band k (anchor: k solved so the EV-mode MIX mass at default settings equals t4Band's measured frequency mass - the section 10.11 transposition as arithmetic; payoff-se sets the unit, t4Band's mass sets k; verify the arithmetic, not a feeling)"
  ];
  for (const r of [skill, evcut]) for (const c of (r.newConstants || [])) if (p4Constants.indexOf(c) === -1) p4Constants.push(c);
  await redTeam(state, "P4 adversarial verification", p4Constants, "docs/refutations/P4.md");

  return closeMilestone(
    state, "P4 verify + commit", ["I22", "I32", "I33", "I34", "I35", "I36", "I37", "I38", "I39", "I40"],
    "v3 P4: skill axis as offset-from-baseline (I37/I38) + absolute-EV cut behind the I34 quarantine (I39/I40); EV mode live",
    "I34's interleaved-toggle clause must actually run interleaved in one process; EV-primary path must be verifiably unreachable (calibration.verdict unstamped)."
  );
}

// ---------------------------------------------------------------------------
// Milestone: P5
// ---------------------------------------------------------------------------

async function runP5(state) {
  phase("P5 calibration + residue");
  state.phasesRun.push("P5 calibration + residue");
  const pre = await agent([
    HOUSE,
    "",
    "TASK - P5 precheck (barrier B4). Verify the finished EV surface exists: I34/I37/I38/I39/I40 all green (run the verifier), and the pre-registered I46 primacy criteria written at Phase 0 are present and UNTOUCHED since (git log on the gate file/registry entry - any post-P0 edit to the criteria is a blocker: the bar may never move once EV numbers exist). Read docs/spikes/S-C.md for whether calibration data exists. Change nothing.",
    "Return JSON: ok, detail, gradeBand (S-C 'pass' or 'fail')."
  ].join("\n"), { label: "precheck-P5", phase: "P5 calibration + residue", schema: precheckSchema, model: "sonnet", effort: "medium" });
  if (!pre || !pre.ok) {
    state.blockers.push("P5 precheck failed at barrier B4: " + (pre ? pre.detail : "agent died"));
    return finish(state);
  }

  const steps = [
    {
      label: "p5-remeasure",
      prompt: "TASK - P5 allowance re-measures, per docs/V3-PLAN.md sections 3.5 and 7.1. Re-measure every allowance re-pinned during P1-P4 (I23(d), I28, I30's compounding allowances, and any others annotated as provisional in the gate registry): recompute each from the current shipped model, re-pin the gate to the measurement (measured value + the gate's stated margin idiom), and record each re-pin as a Measured annotation. Never widen an allowance to make a gate pass without the measurement in hand. Run the three checks green. Do not commit. Return JSON: done, summary, newConstants, blockers."
    },
    {
      label: "p5-item10",
      prompt: "TASK - P5 item 10: per-hand/sub-cell top-N, per docs/V3-PLAN.md sections 3.5 and 7.2 (gate I47), built on the section-8 adjRaw machinery. Every per-hand number is labeled `estimate` everywhere it renders; gate I47 asserts no per-hand claim ever enters the percentile sort (the brief 2.4 autopsy as a standing gate). Owns its slice of src/shell.html and policy read-paths for this step (previous P5 steps are done; you run serially). Run the three checks green. Do not commit. Return JSON: done, summary, newConstants, blockers."
    },
    {
      label: "p5-item11",
      prompt: "TASK - P5 item 11 cut-line decision, per docs/V3-PLAN.md section 4 item 11. DECIDE (do not ask): measure D6's actual post-item-5 headroom and inspect the P3 solver's coverage of 3-bet pots. If EITHER reason bites - (i) the squeeze payload competes for lite's D6 bytes, or (ii) the solver already models exactly this node - TAKE THE CUT: record BOTH reasons verbatim in docs/METHODOLOGY.md section 10, note the move to v3.1-with-solver-results, and build nothing. If both clear convincingly, build the squeeze stage as a new S3b regeneration stage (the ONE permitted regeneration: new MC stream, regeneration diff byte-identical outside new fields per the 9.12 diff idiom, frequency-banded MIX only) with gate I45. Run the three checks green. Do not commit. Return JSON: done, summary (state the decision and both reasons), newConstants, blockers."
    },
    {
      label: "p5-calibration",
      schema: calibrationSchema,
      effort: "max", // stamps the primacy verdict and holds the sole --force authorization (model policy above)
      prompt: "TASK - P5 calibration verdict - runs LAST against the finished EV surface, per docs/V3-PLAN.md sections 3.5, 5.1 and 5.4. S-C outcome: " + pre.gradeBand + ". If S-C failed: the verdict is unpassable by construction - stamp nothing, make score-primary permanent, and ensure 'the decision layer remains unfalsified against money' ships as a standing METHODOLOGY section 10 limitation rendered in the Method view. If data exists: run the calibration harness (lane C's plumbing) against the corpus; ship `calibration.disputed` for EVERY fitted-vs-shipped disagreement, rendered in the Method view; compute the primacy verdict ONLY from the Phase-0 pre-registered I46 criteria, bar untouched. Write/finalize gate I46. IF AND ONLY IF the verdict is 'pass': flip EV primary as a constants change through the section-5.1 re-freeze ceremony - you are the ONE P5 prompt authorized to run `scripts/freeze-tiers.mjs --force`, with the printed move-diff committed into docs/METHODOLOGY.md, retiring I22+I32 together with the written reason ('a gate pinning falsified constants would enforce a known-wrong opinion') and re-freezing the calibrated model as the v3 fixture. If the verdict is not 'pass', touch no fixture and leave the primacy path failing closed. The plan predicts fitted q != 0.85 - if so, ship both (shipped constant + disputed entry). Run the three checks green. Do not commit. Return JSON: done, summary (include the verdict), verdict ('pass' ONLY if the I46 primacy verdict passed AND the re-freeze ceremony ran; 'fail' if the criteria were computed and not met; 'no-data' if S-C failed and the verdict is unpassable by construction), newConstants (any constant the ceremony re-froze, named), blockers."
    },
    {
      label: "p5-methodology",
      prompt: "TASK - P5 METHODOLOGY final rewrite, per docs/V3-PLAN.md sections 3.5 and 10. Rewrite docs/METHODOLOGY.md's section 0 honesty statement per variant (grep-gated per D11 so each artifact carries only its own claim); confirm section 10 items 16-17 and any standing limitation from the calibration verdict are present and rendered in the Method view from shipped data (stampConstants flows the new blocks - documentation cannot drift); reconcile the section 5.2 depth-dial story with whatever the P1 lane-M decision was; verify every v3 constant in the plan's section 6 table appears named in `constants`, anchored or flagged, and rendered. Run the three checks green. Do not commit. Return JSON: done, summary, newConstants (expected empty), blockers."
    }
  ];

  const collected = [];
  let calibrationVerdict = "not-run";
  for (const s of steps) {
    log("P5 serial step: " + s.label);
    const order = s.effort === "max"
      ? await fableWorkOrder(state, "P5 calibration + residue", s.label, s.prompt)
      : "";
    const r = await agent(HOUSE + "\n\n" + s.prompt + order, {
      label: s.label, phase: "P5 calibration + residue", schema: s.schema || stepSchema,
      model: "opus", effort: s.effort || "xhigh"
    });
    if (!r || !r.done) {
      state.blockers.push("P5 step failed: " + s.label + (r ? " - " + r.blockers.join("; ") : " (agent died)"));
      return closeMilestone(state, "P5 verify + commit", [], "v3 P5 (partial, red)", "");
    }
    if (r.blockers.length) state.blockers.push(...r.blockers);
    collected.push(...(r.newConstants || []));
    if (s.label === "p5-calibration" && typeof r.verdict === "string") calibrationVerdict = r.verdict;
    state.notes.push(s.label + ": " + r.summary.slice(0, 200));
  }

  await redTeam(state, "P5 adversarial verification", collected, "docs/refutations/P5.md");

  // I22/I32 are conditionally required, the same way I45 already is: on the calibration-'pass'
  // branch the section-5.1 ceremony retires them BY DESIGN, so requiring them there would make
  // the program's own success path unable to close its release milestone.
  const ceremonyRetired = calibrationVerdict === "pass";
  state.notes.push("calibration verdict: " + calibrationVerdict + (ceremonyRetired ? " (I22/I32 retired by the section-5.1 ceremony; dropped from the required-gate list)" : " (no re-freeze; I22/I32 still required)"));
  const p5Required = ceremonyRetired
    ? ["I33", "I34", "I46", "I47"]
    : ["I22", "I32", "I33", "I34", "I46", "I47"];
  const p5Note = ceremonyRetired
    ? "The calibration verdict was 'pass' and the section-5.1 re-freeze ceremony retired I22 and I32 - their ids are NOT required; their absence is NOT a missing gate, and they must NOT be re-created. Green ADDITIONALLY requires the retirement evidence, all three legs: (1) the written METHODOLOGY reason ('a gate pinning falsified constants would enforce a known-wrong opinion'), (2) the committed move-diff from freeze-tiers.mjs --force, (3) the re-frozen v3 fixture's gate present and passing in the verifier output. Any missing leg goes in failingGates and green=false. I45 is required IFF the squeeze stage was built (read the item-11 decision in docs/METHODOLOGY.md section 10 to know which)."
    : "The calibration verdict was NOT 'pass' (" + calibrationVerdict + "), so no fixture re-freeze may have occurred: I22 and I32 must each appear and pass, and any --force re-freeze found in the history is itself a failure to report. I45 is required IFF the squeeze stage was built (read the item-11 decision in docs/METHODOLOGY.md section 10 to know which). If S-C failed, I46's passing form is its unpassable-by-construction scope: the gate asserts the verdict stays unstamped and the standing limitation ships on-screen - that assertion passing IS the green condition for I46.";

  return closeMilestone(
    state, "P5 verify + commit", p5Required,
    "v3 P5: allowances re-measured, per-hand top-N (I47), item-11 decision recorded, calibration verdict stamped last (I46), METHODOLOGY final rewrite - v3 release boundary",
    p5Note
  );
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function main() {
  let requested = (args && typeof args === "object" && args.milestone) ? String(args.milestone)
    : (typeof args === "string" && args.trim()) ? args.trim().replace(/^--milestone=/, "")
    : "phase0";
  if (requested === "P0") requested = "phase0"; // the plan names the phase P0 everywhere; accept it
  if (MILESTONES.indexOf(requested) === -1) {
    return {
      milestone: requested,
      phasesRun: [],
      green: false,
      commits: [],
      blockers: ["unknown milestone " + JSON.stringify(requested)],
      notes: "valid milestones, one Workflow launch each, in order: " + MILESTONES.join(", ")
    };
  }
  log("v3 workflow - milestone " + requested + " (tokens remaining: " + budget.remaining() + ")");
  const state = mkState(requested);
  let result = state;
  if (requested === "phase0") result = await runPhase0(state);
  else if (requested === "P1") result = await runP1(state);
  else if (requested === "P2") result = await runP2(state);
  else if (requested === "P3") result = await runP3(state);
  else if (requested === "P4") result = await runP4(state);
  else if (requested === "P5") result = await runP5(state);
  const out = (result && result.milestone) ? finish(result) : result;
  log("Milestone " + requested + " done: green=" + out.green + ", commits=" + out.commits.length + ", blockers=" + out.blockers.length);
  return out;
}

return await main();
