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
    { title: "P2 pre-stage", detail: "Serial, on the main tree, BEFORE fan-out (decided at the P1 close-out, 2026-09-02): the I33 amendment ceremony (S-B's three measured amendments to the frozen payoff interface + the falsified monotonicity clause rewritten to the measurement), then the slider-morph re-anchor (page emodel() hoisted onto POLICY.profiledModel with a per-VPIP memo, re-measured, ON-default budget pinned as its own smoke row). No commit inside the stage." },
    { title: "P2 chain fan-out", detail: "Payoff estimator and CFR solver engine built in parallel worktrees against the frozen I33 interface, per S-A/S-B spike memos and the three-band rule." },
    { title: "P2 integration", detail: "Merge the two P2 branches onto the main tree; I33 still green; grade-band consequences applied." },
    { title: "P2 adversarial verification", detail: "Refuters attack payoff params, stack-off knob, solver epsilon, iteration cap, tree/sizing set." },
    { title: "P2 verify + commit", detail: "Three checks green, I35 present; commit; one fix round on red." },
    { title: "P3 B2 pre-stage", detail: "Serial, on the main tree, BEFORE the baseline (adjudicated at the P3 launch, 2026-09-03): the payoff marriage under Grade C - S-A's measured pairwise checkdown matrix (one draw per cell per board, sit-out on collision, 12.5k-25k boards, two seeds) validated against the shipped eq column, served through the frozen six-key accessor as source 'checkdown', I33 run on it (B2; (c) rewritten to the card-removal residual, (h)'s first live case), I35's payoff axis live, the 6-max re-opening rule evaluated once by measurement and recorded, the reproduction check against S-A. No commit inside the stage. RELAUNCHED 2026-09-03 under decision 13 after the first run closed red on the two-seed payoff axis: the board band raised to S-A's 400k as a shipped, --check-gated matrix artifact; the tolerance untouched; the precheck accepts the recorded B2-red tree." },
    { title: "P3 equilibrium baseline", detail: "On the married solver: emit data/equilibrium.json (D9, full-only, the full variant built for real) + the quantized baseline-tier block (D6's 12 KB sub-budget) + the solver constants stamped into `constants` and the Method view; HU-only baseline labelled GTO, every other seat 'baseline is HU'; I36 scoped to the measurable clauses; vs-GTO colour mode live with the app byte-budget decision made in the open." },
    { title: "P3 adversarial verification", detail: "Refuters attack baselineQuant, the D9 budget arithmetic, the matrix's abstraction choices (product-of-marginals chance, the board budget) and the app-ceiling raise if one was made." },
    { title: "P3 verify + commit", detail: "Three checks green on BOTH variants (full no longer skipped by name), smoke + browsers on both, I33 on the matrix source, I35's payoff axis live and constants blocks > 0, I36/D9 present; commit; one fix round on red." },
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

  // ---------------------------------------------------------------------------------------------
  // P2 PRE-STAGE (decided at the P1 close-out, 2026-09-02). Two SERIAL steps on the MAIN tree,
  // before any worktree is cut. Plan section 3.2's Measured block records three amendments the
  // section-2 freeze needs "before P2 consumes it", and P2 is the phase that builds the consumers,
  // so the amendment is a named ceremony here, not something a lane does in passing. The second
  // step closes the one smoke row that is red at HEAD, whose cause was MEASURED at the close-out
  // (it is not the "cold sweep" note smoke.mjs carries - that was measured on a pre-flip page).
  // Model policy: the payoff freeze is one of the three opus@max calls (section 11), so its
  // amendment runs at that tier under a fable work-order; the morph fix is ordinary lane work.
  // Neither step commits - the milestone boundary commits everything or nothing.
  // ---------------------------------------------------------------------------------------------
  phase("P2 pre-stage");
  state.phasesRun.push("P2 pre-stage");
  const P2_PRE_STAGE = [
    {
      label: "p2-i33-amendment",
      effort: "max",
      prompt: [
        "TASK - P2 pre-stage step 1 of 2: THE I33 AMENDMENT CEREMONY, on the MAIN tree, serial, before the P2 fan-out cuts any worktree. Amending a frozen interface is a ceremony: it is done once, in the open, with the gate rewritten in the same step, and recorded per house style - never by a consumer in passing.",
        "",
        "READ FIRST, IN FULL: docs/V3-PLAN.md section 2 (the freeze, including its '> **Measured (phase 0, B0 step 2).**' block) and the '> **Measured (phase 0).**' block at the end of section 3.2; docs/spikes/S-B.md, especially 'Findings for the payoff interface freeze (section 2 / I33)'; scripts/lib/payoff.mjs (the frozen accessor and its header contract); scripts/gates/payoff.mjs (gate I33, clauses (a)-(f) + the separate monotonicity clause, each ARMED against a fabricated violator - keep that idiom); test/payoff.test.mjs and test/ui-payoff-mirror.test.mjs. S-B's prototype is the DEFINITION of the two new quantities: read scripts/spike/sb-core.mjs on the S-B spike branch (worktree-wf_5a8a2571-726-3; its checkout is listed by `git worktree list`, or use `git show worktree-wf_5a8a2571-726-3:scripts/spike/sb-core.mjs`) - potMult = E[F]/potSize where F is the final pot (uncalled bets included), invShare = E[hero invested]/E[F]. Freeze S-B's measured quantities, not a re-invention of them.",
        "",
        "THE THREE AMENDMENTS (each measured by S-B; the numbers are the anchors, quote them in the clause text):",
        "(i) payoff() ALSO returns `potMult` (S-B measured range 1.603-11.865 across 300 points) and `invShare` (0.199-0.730), because `EVbb = ev*finalPot - invested` is caller arithmetic that cannot be done from `ev` alone - the pot term is wrong by up to an order of magnitude without them. RESULT_KEYS becomes six; the header contract, the JSDoc and I33 clause (a) (arity, key names, value types) are rewritten together. THE STUB's values follow from what checkdown IS - no betting after the decision node, so E[F] = potSize and potMult = 1 exactly, with ZERO new constants. `invShare` under checkdown is hero's already-invested share of the pot at the node, which the four frozen arguments do not carry: decide the honest stub value from the definition and the arguments you have (never a typed split), state in the header exactly which arithmetic the caller owes and from which caller-known quantity, and make I33 assert the stub's values as identities (potMult === 1 at every spr for source:'checkdown'; whatever invShare identity you derive) so a later source that moves them is measured against a pinned baseline. If you conclude the definition needs an argument the signature lacks, that is a FINDING recorded in the plan annotation, not a fifth argument: the signature's arity stays four and `opts` is the door.",
        "(ii) `opts.ip` enters EVERY memo key. payoff.mjs deliberately has no memo today, so this amendment is to the CONTRACT and its gate: the header's memo rule names `ip` explicitly beside every argument and the model hash, and I33 gains an ARMED clause that a payoff memo which drops `ip` is caught - S-B measured ev(A,B,ip) != ev(A,B,not ip) by up to 43 pt, so a keyless memo is wrong by more than the whole error budget (the `envKey` docstring trap in a new place). Design the detector so it fires on a fabricated memoizing wrapper that omits ip and clears one that includes it, and so it will also cover consumers (P2's cfr.mjs / payoff-model.mjs and P4's EV cut) when they appear - the clause-(e) filename-scoped grep idiom is the precedent.",
        "(iii) `supported:false` gains the CARD-REMOVAL clause. Its real domain is shared-rank degeneracy, not multiway: cells pinning the same ranks make some (cell, cell, board) triples impossible from the observer's seat - AA_DANGLER|RB x AA_BIGPAIR|DS is degenerate on 12.56% of street evaluations, mean 0.73% over 50 pairs, 4/50 over 1% (S-A independently found 43 structurally undealable pairs, AA_* x A_BLOCKED, mass 3.6e-5). The failure mode is SILENT: S-B's first implementation collapsed every AA-vs-AA pair to a checkdown with no error raised. The clause: any source that evaluates against dealt boards must surface degeneracy honestly - an undealable or degenerate request returns supported:false (or its degeneracy mass, flagged), never a silent collapse to checkdown. The stub deals nothing and is exempt by construction, but the clause must be ARMED against a fabricated source that silently collapses a degenerate pair, and it must state the measured numbers.",
        "",
        "PLUS THE MONOTONICITY CLAUSE, which is already recorded as FALSIFIED (section 3.2's Measured block: inversions on 1.7% of pairs at spr 1, 8.1% at spr 4, 15.9% IP / 20.5% OOP at spr 10; worst case 9.1 pt LESS checkdown equity for 20.0 pt MORE ev). Rewrite it to the measurement per house style; do NOT delete it. The checkdown stub is monotone by construction (strictly increasing in hero's checkdown equity) and stays asserted so; a non-checkdown source at spr >= 4 is EXPECTED to show inversions in the measured band, and zero inversions from a source claiming to model realization is the new failure - write it that way, with the numbers.",
        "",
        "RECORD THE CEREMONY: (1) payoff.mjs's header contract rewritten to the six-key return and the ip-in-every-memo-key rule; (2) I33's clause text and its verifier detail line say what was amended and quote the anchors; (3) docs/V3-PLAN.md section 2 gains a `> **Amended (P2 pre-stage).**` block beneath the freeze (plan text above it kept as written - the V2-PLAN idiom), naming the three amendments, the rewritten monotonicity clause, and any finding from (i); (4) docs/METHODOLOGY.md wherever the payoff contract or I33 is described (grep 'payoff' and 'I33') is brought into agreement - METHODOLOGY wins on disagreement, so leave nothing in it that still describes the four-key return.",
        "",
        "CONSTRAINTS: the freeze is a test, not a doc - every amended clause must be able to FAIL and be shown to (fabricated violators, as the file already does). payoff.mjs is inlined into the page (build.mjs's moduleToIife), so keep its browser-safety rules (no top-level import, export const|let|function|class only, Node-only code below @browser-cut) and rebuild: `node scripts/build.mjs` then `--check` current for every built variant. Zero new constants: potMult = 1 and any invShare identity are arithmetic of the checkdown definition, not numbers you chose. I22, I32, I43 and the fixtures are untouched (payoff.mjs is not on the tier path; NEVER run freeze-tiers.mjs --force). Do not touch policy.mjs, src/shell.html or smoke.mjs - step 2 owns them. Run the three checks green (`node scripts/verify.mjs` all gates incl. I33; `node --test test/*.test.mjs`; `node scripts/build.mjs --check`). Do NOT commit - the milestone boundary commits.",
        "Return JSON: done (true only with the three checks green), summary (MUST state: the six keys and the stub's potMult/invShare identities with the caller arithmetic they imply; how the ip-memo clause and the card-removal clause are armed; the monotonicity clause's new wording; every file touched), newConstants (expected EMPTY - name anything you could not derive), blockers."
      ].join("\n")
    },
    {
      label: "p2-morph-reanchor",
      effort: "xhigh",
      prompt: [
        "TASK - P2 pre-stage step 2 of 2: THE SLIDER-MORPH RE-ANCHOR, on the MAIN tree, serial, after the I33 amendment (which is on the tree, uncommitted). You are the single writer of src/shell.html, scripts/lib/policy.mjs and smoke.mjs for this step.",
        "",
        "THE FACT: `node smoke.mjs` is RED on exactly one row at HEAD - 'slider-morph incl. layout p95 < 4 ms' reads p95 ~14-15 ms (median ~11). Everything else in smoke is green, and browsers.mjs (SF/SS) is green.",
        "THE MEASURED CAUSE (P1 close-out, 2026-09-02) - and it is NOT the 'cold sweep' account in smoke.mjs's header, which was measured on a PRE-FLIP page and is wrong for HEAD: the 4.0 ms anchor (S-E section 3, p95 2.7 ms) was measured with the villain profile OFF; barrier B1 made ON the load default (src/shell.html: `S.vp = VP_DEFAULT`, derived from POLICY.villainLoadDefault); and the page's own `emodel()` (src/shell.html, near 'function emodel()') memoizes ONE profiled model keyed by vpKey() = 'ON|v|q|hash', so every VPIP slider step rebuilds the shadow model (123 villainEq calls + hydrate) and re-solves against a fresh meta.hash. Measured on the same page: ON median 11.1 / p95 15.1 ms; OFF median 1.1 / p95 2.3 ms. The budget is not wrong and the harness is not cold; the page is doing the work the ON default asks for, once per slider step, with a memo that cannot hold two entries.",
        "",
        "DO, IN ORDER:",
        "1. THE FIX - hoist, do not patch. scripts/lib/policy.mjs already exports profiledModel(model, profile), and its header says the page's emodel() is 'a duplicate of this, not a variant of it' (lane M hoisted it at P1 and queued exactly this deletion). Make the page's emodel() delegate to POL.profiledModel (the un-injected-template fallback may keep a minimal builtin only if the page still needs one - measure whether it does), and give the profiled model a PER-VPIP MEMO: bounded (key on POLICY.villainKey, which already carries v|q|measured-identity; capped/LRU in the SIMBOOK idiom, never unbounded - the reachable key space is large), so a slider sweep revisits built models instead of rebuilding them. Decide where the memo lives (policy.mjs, so Node callers and I43 can see it, or the page) by measurement, and record the decision in the code. LOAD-BEARING INVARIANTS that must survive, each already gated: OFF is OBJECT IDENTITY - emodel() === MODEL (I22/I32/I43(a), assert.equal never deepEqual); nothing-moved is also MODEL itself; the shadow wears a different meta.hash (solve/aggressiveSet memos key on its first 8 chars - I43(c)); syncProfileCells()'s `VPM.applied === m` identity check and withVP()'s restore keep working (a pin evaluated under another profile must not thrash the memo). No tier semantics change: I22, I32, I43 green and data/tiers-v3-default.fixture.txt does NOT move (NEVER run freeze-tiers.mjs --force; if a fixture moves, your change is wrong, not the fixture).",
        "2. BYTES: deleting the page's duplicate SHRINKS the app block, which sits ~300 B under its 360 KB ceiling (scripts/lib/variant.mjs budgets.app; `node scripts/build.mjs --check` prints the split). Do NOT raise that ceiling - the raise-vs-shrink decision is P3's (METHODOLOGY section 9.11 is owed that paragraph then, not now). Report app-block bytes before and after, and the headroom.",
        "3. RE-MEASURE, then pin as a MEASUREMENT: rebuild, then run `node smoke.mjs` at least five times; the harness must be able to measure the layout-inclusive sweep in BOTH profile states on the same page - the load default (ON) and OFF (toggle through the page's own handle: window.__rundown exposes vpTrigger/emodel/vpKey and setV; drive the same control the user does, e.g. the #v1point button or the profile toggle, not S.vp directly if a render path depends on the toggle's side effects). Report median/p95/worst per run per state. Note what the per-VPIP memo does to the sweep: the first visit to each v is a build and every revisit a hit, so report the cold (first-visit) and warm (revisit) figures separately, and pin the row on the sweep as smoke actually runs it - a slider drag visits each v once, so the cold cost is what a user feels; do not pre-warm the memo to make the number smaller.",
        "4. PIN TWO ROWS: the existing OFF row keeps its 4.0 ms anchor (it IS the S-E measurement, so smoke must now run it with the profile OFF - measuring what it was anchored on), and a NEW ON-default row with its OWN budget = worst observed p95 over your runs + the same ~48% measured+headroom rule the OFF row and the byte budgets use. The ON row is a measurement with its own anchor line, NEVER a widened 4.0; if the fixed ON p95 lands inside 4.0 anyway, it still gets its own measured+headroom figure, and you say so. Gate both on p95, not worst, as the file already argues. Name the new budget constant beside MORPH_LAYOUT_BUDGET_MS with its anchor in the same comment style.",
        "5. CORRECT THE NOTE: replace smoke.mjs's 'cold sweep' paragraph with the measured cause (pre-flip vs post-flip page; the one-entry memo keyed by VPIP; the ON/OFF figures before and after the hoist) and the two-row pinning; keep the S-E anchor history intact. docs/refutations/P1.md is an immutable record - do not edit it; instead add a `> **Measured (P2 pre-stage).**` block beneath the smoke-budget text in docs/V3-PLAN.md (section 9 / the S-E annotation in section 1 - wherever the 4.0 ms row is specified) per the idiom, and bring docs/METHODOLOGY.md into agreement wherever it describes the morph budget or the page-side emodel duplicate (grep 'morph', 'emodel', 'profiledModel').",
        "6. Confirm test/ui-rail.test.mjs's __measureMorph assertion still holds, then run `node browsers.mjs` (SF/SS must stay green).",
        "7. Run the three checks green (`node scripts/verify.mjs` incl. I22/I32/I33/I43; `node --test test/*.test.mjs`; `node scripts/build.mjs --check` for every built variant) AND `node smoke.mjs` green on EVERY row, both morph rows included. Do NOT commit - the milestone boundary commits.",
        "Return JSON: done (true only with the three checks AND smoke green with both morph rows pinned), summary (MUST include: the emodel decision and where the per-VPIP memo lives and its bound; ON and OFF median/p95 before and after over >= 5 runs each, cold and warm; the two pinned budgets with their arithmetic; app-block bytes before/after and headroom; browsers.mjs status; every file touched), newConstants (the new ON-row smoke budget, with its anchor), blockers."
      ].join("\n")
    }
  ];
  const preStage = [];
  for (const step of P2_PRE_STAGE) {
    log("P2 pre-stage serial step: " + step.label);
    const order = step.effort === "max"
      ? await fableWorkOrder(state, "P2 pre-stage", step.label, step.prompt)
      : "";
    const r = await agent(HOUSE + "\n\n" + step.prompt + order, {
      label: step.label, phase: "P2 pre-stage", schema: stepSchema,
      model: "opus", effort: step.effort
    });
    if (!r || !r.done) {
      state.blockers.push("P2 pre-stage step failed: " + step.label + (r ? " - " + r.summary + " " + r.blockers.join("; ") : " (agent died)"));
      state.notes.push("P2 pre-stage aborted at " + step.label + "; no fan-out");
      return closeMilestone(state, "P2 verify + commit", [], "v3 P2 (partial, red)", "");
    }
    if (r.blockers.length) state.blockers.push(...r.blockers);
    preStage.push({ step: step.label, summary: r.summary, newConstants: r.newConstants || [] });
    state.notes.push(step.label + ": " + r.summary.slice(0, 400));
  }
  // The lanes' worktrees are cut from HEAD, and the pre-stage is UNCOMMITTED on the main tree by
  // design (no commit inside the stage), so the hand-off carries the amended contract in words and
  // tells each lane how to build against it without dragging the main tree's work into its branch.
  const preNote = [
    "",
    "",
    "PRE-STAGE HAND-OFF. The P2 pre-stage ran on the MAIN tree before you were spawned, and its work is UNCOMMITTED there (the milestone boundary commits). Your worktree was cut from HEAD, so it PREDATES the pre-stage. Its two steps reported (JSON):",
    JSON.stringify(preStage, null, 2),
    "Consequences for you: (1) THE FROZEN INTERFACE IS THE AMENDED ONE - payoff(cells, potSize, spr, opts) -> { ev, se, source, supported, potMult, invShare }; `opts.ip` is in every payoff memo key by contract (I33 gates it); supported:false carries the card-removal clause; the monotonicity clause is rewritten to S-B's measured inversion band. Build your new files against THAT contract. So that your worktree's tests exercise the amended stub rather than the four-key one, first run `git worktree list` (the main tree is the first line) and diff its scripts/lib/payoff.mjs, scripts/gates/payoff.mjs, test/payoff.test.mjs and test/ui-payoff-mirror.test.mjs against yours; if yours predate the amendment, COPY the main tree's versions into your worktree - but NEVER `git add` or commit those copies: they are the main tree's uncommitted work and land through the milestone commit. Your branch adds NEW files only (stage them by path, never `git add -A`), or the integration merge collides with the main tree's uncommitted amendment. (2) The morph re-anchor touched src/shell.html, scripts/lib/policy.mjs and smoke.mjs - none of which you may touch; nothing in it concerns your files.",
    "Under S-B Grade " + band + " the plan's Measured blocks (sections 3.2, 6, 14.1) bind: no estimator form won; at most form 1 (pairwise checkdown + fitted realization curve) as a flag-DISABLED prototype, never wired into payoff(); form 2 is not built; no estimator constant enters `constants` live; the stack-off knob is never created. S-A's anchors are measured, not chosen: epsilon = 5e-5 bb, iteration cap 2,000, two-seed clause 0.15% of pot, 12.5k-25k boards suffice, the 3/9/27/81 pot-limit ladder is an arithmetic identity with zero new constants, and I35's cap-list clause bounds the omissions (no limp, no sixth raise, no postflop). S-A's sampling-measure bug (redraw-on-collision biases equity; one draw per cell per board with a sit-out on collision is the correct measure, validated against the shipped eq column) applies to any payoff sampler."
  ].join("\n");

  phase("P2 chain fan-out");

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
      return agent(HOUSE + "\n\n" + s.prompt + preNote + "\n\nReturn JSON: lane (" + JSON.stringify(s.id) + "), branch, filesTouched, gatesAdded, newConstants (with one-line anchors), summary, blockers.", {
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
    "v3 P2: I33 amendment ceremony (potMult/invShare, ip-in-every-memo-key, card-removal clause) + morph re-anchor at the pre-stage; payoff-model.mjs prototype + solver engine (cfr.mjs) built in parallel against the amended frozen payoff interface; I35",
    "Grade band for this build was " + band + " - if B or C, confirm every model-sourced EV surface is estimate-badged (Grade C: stub still live, payoff() serving source:'checkdown'). Also confirm the P2 pre-stage landed: I33's detail line reports the six-key return (potMult/invShare), the ip-memo clause and the card-removal clause; and run `node smoke.mjs` and paste its two slider-morph rows (OFF at 4.0 ms and the ON-default row with its own measured budget) into detail - smoke is not in the GREEN trio (package.json), so a red smoke row is reported in detail, not as a failing gate, but it MUST be reported."
  );
}

// ---------------------------------------------------------------------------
// Milestone: P3
// ---------------------------------------------------------------------------

// ADJUDICATED AT THE P3 LAUNCH (2026-09-03), binding on every P3 stage. Decisions 1-7 restate what
// the plan's Measured/Amended blocks already settled (§2, §3.2, §3.3, §3.6, §5.3, §6, §14, the S-A
// and S-B recommendations, docs/refutations/P2.md's "Findings recorded"); decisions 8-12 were made
// at this launch from those blocks. The stages RECORD them (the pre-stage's first duty) and execute
// them; nothing inside the run re-litigates them. Where a plan paragraph disagrees, the later
// Measured/Amended block wins, then these adjudications, and the disagreement is a finding.
const P3_ADJUDICATED = [
  "ADJUDICATED AT THE P3 LAUNCH (2026-09-03) - BINDING. Do not re-derive, re-open or soften any of these; where a plan paragraph disagrees, the later Measured/Amended block wins, then these, and the disagreement is a finding to record, never a reason to re-plan:",
  "(1) GRADE C STANDS. The checkdown stub is the live source in the PAGE (both variants - the page's accessor stays on the projection stub, source 'checkdown', six keys; D10). scripts/lib/payoff-model.mjs stays ENABLED=false, is never wired, and no estimator constant enters `constants`.",
  "(2) S-A'S ANCHORS BIND: epsilon 5e-5 bb; iteration cap 2,000; two-seed clause 0.15% of pot; 12.5k-25k boards [AMENDED BY (13) AT THE RELAUNCH: the band was MEASURED jointly unsatisfiable with the 0.15% gate; the shipped count is S-A's own 400,000]; the 3/9/27/81 ladder is an identity (zero constants); I35's cap list bounds the omissions (no limp, no sixth raise, no postflop).",
  "(3) B2: the solver consumes payoffs ONLY through scripts/lib/payoff.mjs (I33 clause (e)). The marriage to the real payoff is THIS milestone's job, gated on I33 passing on that source - which is the B2 pre-stage's whole task.",
  "(4) S-A's BB-positive finding ships RENDERED under the label 'a game where postflop does not exist', keyed off source === 'checkdown' (I35(f), cfr.mjs labelFor), never off `supported`.",
  "(5) I33 is the amended SIX-key contract { ev, se, source, supported, potMult, invShare }; opts.ip in every memo key (clause (g)); the card-removal clause (h). NO seventh key and NO arity change without a ceremony, and no ceremony is scheduled this milestone: the matrix is served inside the six keys.",
  "(6) Smoke rows are MEASUREMENTS: OFF 4.0 ms, ON 16 ms, floor 8 ms. Never widen.",
  "(7) The app byte-budget decision is P3's - see (12).",
  "(8) 6-MAX DEFERRAL UPHELD. §14 item 5's 'IN' was a wall-time verdict; the payoff DOMAIN binds (cfr.mjs's SIXMAX record, I35(d), §3.2's 'Measured (P2 lane cfr)' block). P3 ships the HU baseline - the SB and BB nodes of the capped heads-up tree - labelled 'GTO'; every other seat renders disabled-with-named-REASON 'baseline is HU' (§3.3's own fallback, in the SIM.available idiom). THE RE-OPENING RULE, evaluated ONCE by measurement in the B2 pre-stage and recorded: 6-max may be attempted only if ALL legs hold - (i) 2-way terminals come from the measured pairwise matrix; (ii) 3-way+ terminals come from a MEASURED k-way sampler that passes I33(b) (constant-sum over the k shares) and I33(h) (degeneracy surfaced, never collapsed); (iii) zero new opinion constants; (iv) inside the pipeline budget (METHODOLOGY's 688 cpu-s) and D9. If ANY leg fails - and (ii) fails at HEAD unless a k-way sampler exists and passes, which none does - cfr.mjs's SIXMAX record and I35(d) stand, and I36's positional-nesting clause (UTG within HJ within CO within BTN) is recorded as NOT MEASURABLE in the HU domain (the I15 precedent: scoped to the measurement), never toleranced.",
  "(9) THE SOLVER RENDERS THE MEASURED PAIRWISE CHECKDOWN MATRIX, not the projection stub. Construction = S-A's: scripts/spikes/sa-matrix.mjs on branch worktree-wf_5a8a2571-726-2 (its checkout is listed by `git worktree list`; or `git show worktree-wf_5a8a2571-726-2:scripts/spikes/sa-matrix.mjs`, with sa-validate.mjs beside it). Shared boards; ONE draw per cell per board with SIT-OUT on collision (the corrected sampling measure - redraw-on-collision biased +1.16 pt mean, +5.33 pt on RUN0_HIGH|RB); 12.5k-25k boards [AMENDED BY (13): 400,000 per seed, shipped as an on-disk artifact]; TWO independent seeds; diagonals exactly 0.5; off-diagonals stored once and mirrored (exactly zero-sum). VALIDATED against the shipped eq column BEFORE use (S-A's rule for every payoff sampler). Served through payoff.mjs as source:'checkdown' (the label clause fires unchanged; potMult 1 and invShare 0 remain identities - it is still checkdown). I33 must pass on it at B2. EXPECTED: clause (c) shows S-A's signed card-removal residual against the shipped column (mean -0.112 pt, p95 0.577, max 0.827 at 400k boards; ace-holding cells read ~0.6 pt low because the shipped number conditions villain on hero's aces being dead and the q-weighted sum does not) - REWRITE (c) TO THE MEASUREMENT, never widen; the 43 AA_* x A_BLOCKED undealable pairs (mass 3.6e-5) are clause (h)'s FIRST LIVE CASE - supported:false, never a silent collapse; I35's two-seed PAYOFF axis goes LIVE on the two independent matrices (S-A spread 0.035% of pot vs the 0.15% gate). The projection stub stays the lite page's accessor source (D10). REPRODUCTION CHECK, recorded: the P3 HU value, SB open and BB fold should land near S-A's -0.1418 bb / 89.3% / 0.16% (S-A used 400k boards); a gap is a FINDING about the board budget, reported with the numbers, never tuned away.",
  "(10) The solver constants (solver.epsilonBB, solver.iterCap, solver.twoSeedTolPot, solver.sizingLadder - cfr.mjs's CONSTANTS export, with their anchors) must reach `model.constants.solver` AND the Method view this milestone: §6's third leg, unmet at P2 (docs/refutations/P2.md finding 6). I35's constantsBlockProblems detector is armed and reports 0 blocks today; after P3 it must report > 0 blocks (on disk AND in every built page) and pass on each.",
  "(11) data/model.json is NOT regenerated: `cells`, `rows`, `cols`, `bands`, `order` and `benchmarks` stay BYTE-IDENTICAL (prove it with a key-by-key comparison of the serialized values before and after). The legal moves are exactly: verify's `gates` stamp; the new `constants.solver` block (10); and the §5.3 baseline-tier block as its own top-level key `baselineTiers` (the key gate D6 already reads for its named 12 KB sub-budget). Nothing else. Reason: test/payoff-model.test.mjs re-derives 17 coefficients from the shipped model (a regeneration trips it) and I22/I32 pin the tiers. NEVER run the Monte Carlo generator over the model and NEVER run scripts/freeze-tiers.mjs --force.",
  "(12) APP BYTE BUDGET: the lite app block is 359.1 of 360 KB (0.9 KB headroom). The UI step MEASURES what the vs-GTO mode costs in the minified app block, SHRINKS DEAD WEIGHT FIRST, and only if a raise is still needed makes it a STATED, PAID raise at measured+5% in the D6 idiom: a `core` clause re-asserts the old 360 KB ceiling against the app payload MINUS the new vs-GTO block, so no existing block gains a byte, and the build prints both readings. The raise-vs-shrink paragraph METHODOLOGY §9.11 is owed is written either way (the raise, or the shrink that avoided one). NEVER a silent raise; never a raise the gate cannot see.",
  "(13) ADJUDICATED AT THE P3 RELAUNCH (2026-09-03, after the first P3 run - wf_ac39face-2d4 - closed RED at B2; the user chose option (i), the only non-weakening): THE BOARD BAND IS RAISED; THE TOLERANCE IS NOT WIDENED; THE PAYOFF AXIS STAYS ASSERTED. The first run measured decision (2)'s two numbers jointly unsatisfiable: `solver.twoSeedTolPot` = 0.15% is ~4x a spread S-A measured at 400,000 boards (0.035%), the 12.5k-25k band is from S-A's out-of-sample exploitability table, and at 25k the LIVE payoff-axis spread read 0.1508% (T100) / 0.1568% (T40) - ~1x the gate (six pairs over four matrices: max 0.162% / 0.170%; at 12.5k max 0.337% / 0.322%). THEREFORE: (a) the shipped matrices are built at the board count the tolerance's anchor was MEASURED at - 400,000 boards per seed, S-A's own - so the anchor's stated ~4x margin is a measurement again rather than a claim; the count is not a band anyone chose, it is the anchor's regime. If the pipeline budget (METHODOLOGY's '6 minutes' hard against 188 s measured) forbids 400k AFTER you measure it, the count is the largest that fits and the resulting margin is REPORTED beside the anchor - never a widened tolerance, never a seed pick. (b) THE MATRIX BECOMES A SHIPPED, ON-DISK, COMMITTED ARTIFACT (V3-PLAN §0.4 identity leg (b): a new artifact, entered in the open): its OWN data file under data/ (decide the name and encoding; a Node-side input like data/model.json, never inlined into either page - D10's lite negative manifest forbids a solver payload in lite), and NOT data/equilibrium.json at the pre-stage, because build.mjs --check ARMS ITSELF the moment data/equilibrium.json exists and would demand index-full.html before p3-baseline can build it. It is generated ONCE by a named generator script (both seeds; ~22 s per matrix single-thread at 400k - parallelise the two seeds across processes if useful, mc.mjs's self-spawn idiom is the precedent) and carries in its meta the generator inputs (seed names, board count, the generator's own source hash) plus a content hash. verify READS IT BACK: I33's matrix route and I35's matrix solves consume the artifact, so verify's wall returns to the cost of the solves and the 41.9 s soft ceiling is respected. (c) THE DETERMINISM CLAIM IS A --check-STYLE GATE OWNED BY THE GENERATOR: `node <generator> --check` rebuilds both matrices in memory from the recorded inputs and compares bytes against the file on disk (build.mjs --check's idiom). It is NOT run inside verify (cost); it IS run at the P3 close-out and joins THIS milestone's GREEN definition beside the three checks, smoke and browsers. A cheap in-verify clause asserts the artifact's meta (count, seeds, hashes match the code that built it) and its structural invariants (antisymmetry, diagonal, conservation, the undealable set, the residual band against the shipped column) - I33's (c)/(h) on the matrix route already do most of this. (d) test/checkdown-matrix.test.mjs validates the ARTIFACT (reads it - milliseconds) and exercises the builder's mechanics only on a tiny board count (determinism from a seed name, antisymmetry, the sit-out measure) - never a 400k build in a test process. (e) cfr.mjs's `solver.twoSeedTolPot` anchor text is rewritten to the new measurement - the spread at the shipped count and the margin it leaves - and its 'at ~1x this tolerance' sentence goes; the VALUE 0.0015 does not move. (f) p3-baseline's data/equilibrium.json carries the primary matrix per §5.3, or a content-hash reference to the artifact if embedding would double the shipped bytes - decided by D9's measurement, stated either way; the artifact is the Node-side source of truth. (g) The reproduction check is re-run at the shipped count and recorded beside the 25k reading; the expectation is S-A's own numbers (-0.1418 bb / 89.3% / 0.16%) to within the two-seed spread. (h) RECORD FIRST: a `> **Adjudicated (P3 relaunch).**` block beneath §3.3's Adjudicated block - its 'THE ONE THING THIS STEP COULD NOT CLOSE' paragraph stays as written, it is the record of the red close - stating the option taken and the numbers; §2's `Measured (P3 B2)` block gains the artifact and the shipped count; METHODOLOGY's I33/I35 rows and its pipeline-budget paragraph are updated to the artifact and its cost."
].join("\n");

// The B2 pre-stage: ONE serial step, opus@max under a fable work-order (model policy above - the
// payoff marriage is the "solver consumes the real payoff" event and takes the payoff-freeze tier),
// on the MAIN tree, between the precheck and p3-baseline. No commit inside the stage.
// The relaunch (2026-09-03): the first run of the pre-stage did DO 1-8 and left its work UNCOMMITTED on
// the main tree, red on exactly one clause. The second run builds on that tree and executes decision 13.
const P3_RELAUNCH_CONTEXT = [
  "RELAUNCH CONTEXT (2026-09-03). This is the SECOND run of this step. The first run (wf_ac39face-2d4) did everything in DO 1-8 and its work is on the MAIN tree, UNCOMMITTED: new scripts/lib/checkdown-matrix.mjs and test/checkdown-matrix.test.mjs; modified scripts/lib/payoff.mjs, scripts/lib/cfr.mjs, scripts/lib/payoff-model.mjs, scripts/gates/payoff.mjs, scripts/gates/solver.mjs, scripts/gates/reserved.mjs, test/payoff.test.mjs, test/payoff-model.test.mjs, test/gates-solver.test.mjs, docs/V3-PLAN.md, docs/METHODOLOGY.md. READ ITS RECORD FIRST: V3-PLAN §3.3's `Adjudicated (P3 launch)` block (especially 'MEASURED VERDICTS' and 'THE ONE THING THIS STEP COULD NOT CLOSE'), §2's `Measured (P3 B2)` block, cfr.mjs's SIXMAX.reopenRule, and I35's failure line in `node scripts/verify.mjs`. DO NOT redo that work and DO NOT revert it: build on it.",
  "THE TREE'S EXPECTED STATE WHEN YOU START (the precheck confirmed it - its report is below): verify 52/53 with I35 clause (c/payoff) the ONLY failure (0.1508% T100 / 0.1568% T40 against 0.15%); tests 534/535 with test/gates-solver.test.mjs's 'I35 PASSES on the shipped model' the only failure - it stays AS WRITTEN and must pass by the end; build --check lite current (if data/model.json carries a `gates.I35: FAIL` stamp, `git checkout -- data/model.json` first: verify restamps it every run, and cells/rows/cols/bands/order/constants/benchmarks are byte-identical to HEAD throughout).",
  "YOUR TASK IS DECISION (13) OF THE ADJUDICATED BLOCK, END TO END - (a) through (h) - and then the checks green: `node scripts/verify.mjs` 53/53 with I35's payoff axis LIVE and PASSING at the shipped count (its margin reported); `node --test test/*.test.mjs` all green; `node scripts/build.mjs --check` lite current, full still skipped by name at THIS step; PLUS the generator's own `--check` green. Re-do the reproduction check and the §3.3 / §2 records at the shipped count as (13)(g)/(h) say. Everything else in DO 1-8 is already done: confirm it still holds (run the gates) rather than re-implementing it. Steps 1 (the launch Adjudicated blocks) and 7 (the re-opening rule) are DONE and stand; do not rewrite them. Do NOT commit."
].join("\n");

const P3_PRE_STAGE = {
  label: "p3-b2-marriage",
  effort: "max",
  prompt: [
    "TASK - P3 B2 PRE-STAGE: THE PAYOFF MARRIAGE, on the MAIN tree, serial, before p3-baseline. This is the 'solver consumes the real payoff' event (V3-PLAN §3.3's barrier B2; §12) and takes the payoff-freeze tier. You are the only writer on the tree for this step. Nothing here commits - the milestone boundary commits.",
    "",
    "READ FIRST, IN FULL: the ADJUDICATED block below (decisions 8 and 9 are yours to execute and record); docs/V3-PLAN.md §2 (incl. its Measured and Amended blocks), §3.2 (both Measured blocks), §3.3 (+ Measured), §5.3, §6 (+ Measured), §14 items 4-5; docs/spikes/S-A.md ('The payoff matrix', 'Anchors handed to §6', 'The finding P3 must render'); docs/refutations/P2.md §'Findings recorded' (an immutable record - findings 1-3, 6 and 8 bear on you; never edit that file); scripts/lib/payoff.mjs (the header contract, prepare/evaluate/finish, makePayoff, setDefaultModel, the @browser-cut marker); scripts/gates/payoff.mjs (I33 clauses (a)-(h) + the monotonicity clause, each ARMED against a fabricated violator - keep that idiom for every clause you touch); scripts/lib/cfr.mjs (solveHU's injected `payoff`, liveCells, terminalMatrix, TWO_SEED_AXES, SIXMAX, multiwayProbe, sixmaxDeferralProblems, labelFor); scripts/gates/solver.mjs (I35 - especially clause (c)'s payoff axis, clause (d), and `constantsUnits`); test/payoff.test.mjs, test/ui-payoff-mirror.test.mjs (pins the page's mirrored @payoff-page copy and its key ORDER), test/cfr.test.mjs, test/gates-solver.test.mjs; and S-A's construction itself: `git show worktree-wf_5a8a2571-726-2:scripts/spikes/sa-matrix.mjs` and `git show worktree-wf_5a8a2571-726-2:scripts/spikes/sa-validate.mjs`.",
    "",
    "DO, IN ORDER:",
    "1. RECORD FIRST - your first duty, before any code. Add a `> **Adjudicated (P3 launch).**` block beneath §3.3's Measured block and another beneath §14 item 5's Resolved block in docs/V3-PLAN.md (plan text above each kept as written - the V2-PLAN idiom). Each states decisions 8 and 9 in the plan's voice with the numbers, and names the re-opening rule's four legs verbatim; the §3.3 block is where you append the rule's measured verdict and the reproduction check at the end of this step. §14.5's block must say plainly that its 'IN' was a wall-time verdict overridden by the measured payoff domain.",
    "2. THE MATRIX BUILDER. Port S-A's construction into the repo as a NEW Node-only module (e.g. scripts/lib/checkdown-matrix.mjs; note that I33(g)'s comment-stripped memo scan is filename-scoped on /payoff|cfr|solver|equilib|ev-cut/ over scripts/ and src/ - know whether your filename is inside it; either is fine, a memo that keys `ip` clears it, and a table read is not a memo). Credit S-A in the header. Keep the construction EXACTLY: shared boards; one draw per cell per board; sit-out on collision (DRAW_TRIES = 1 is load-bearing, and the header explains the measure); diagonals 0.5; off-diagonals stored once and mirrored; the per-pair live-and-disjoint counts KEPT - they are the trial counts `se` derives from, and the datum that makes an undealable pair KNOWN rather than guessed. Deterministic from a seed string (eval5's Rng/fnv1a). Board budget from S-A's out-of-sample table (12.5k boards -> 0.053% of pot, 25k -> 0.0015%): choose inside 12.5k-25k by measurement of the reproduction check in step 6 and of verify's soft wall ceiling (41.9 s; the registry's wall is ~27.5 s at HEAD; I35 alone was ~1.2 s) - state which count and why. Two independent seeds, NAMED. Record the wall time per matrix.",
    "3. VALIDATE BEFORE USE (S-A's hard rule). Port sa-validate's checks - antisymmetry to the bit; diagonal 0.5; the q-weighted marginal reconstruction against the shipped eq[0] column (report mean / p95 / max in pts, and the sign pattern by ace-holding cell family); conservation (combo-weighted mean 50.0000); the count of structurally undealable pairs (expect 43, all AA_* x A_BLOCKED, mass 3.6e-5); the per-entry se from the two seeds - and make them a test under test/ that runs on the seeds you ship. The numbers must land near S-A's (mean -0.112, p95 0.577, max 0.827 at 400k boards; yours at 12.5k-25k are noisier - report both readings side by side).",
    "4. SERVE IT THROUGH THE ACCESSOR, inside the frozen six-key contract. payoff.mjs's header names TWO ways in - `makePayoff(model)` (pure) and `setDefaultModel`. Add the matrix as a route on the PURE side, BELOW the @browser-cut so the page's inlined copy and its @payoff-page mirror do not move by a byte (the lite app block has 0.9 KB of headroom and P3-UI needs it) - e.g. an exported makeMatrixPayoff(model, matrix) that shares prepare/validate/finish with the stub; if you conclude the route must sit above the cut, measure the byte cost and say so. Its returns: source:'checkdown' (it IS checkdown); supported:true on measured pairs; potMult 1 / invShare 0 (identities); `se` from the pair's own live-and-disjoint sample count, never typed; and for the undealable pairs supported:false with a FLAGGED fallback number (clause (h)'s first live case - never a silent collapse). `opts.ip`: the matrix is position-inert like the stub, and the memo rule still names `ip`. `opts.seed`: decide, and document in the header, how the two independent matrices are addressed so I35's payoff axis can solve on each - arity stays four, `opts` is the door.",
    "5. I33 ON THE MATRIX SOURCE - this is B2. Run every clause, (a)-(h) plus monotonicity, on the matrix route IN ADDITION to the stub; the verifier's I33 detail line must NAME the matrix source and each clause's outcome on it. PREDICTED FIRINGS, each handled by REWRITING THE CLAUSE TO THE MEASUREMENT (house style: never widen, never delete, keep the armed violator): (c) spr->0 identity - the matrix differs from the shipped column by the signed card-removal residual; write (c) so a pairwise checkdown source is compared to the shipped column by its q-weighted marginal, with the residual band REPORTED (mean/p95/max, quoting S-A's) and the sign pattern ASSERTED (ace-holding families low), armed against a source that reproduces the column too perfectly AND against one whose residual is unsigned noise. (h) the 43 undealable pairs must come back supported:false - assert the count and the AA_* x A_BLOCKED family structurally, and that the fallback is flagged. THE MONOTONICITY CLAUSE's checkdown half ('checkdown must show ZERO inversions') was written for the SEPARABLE projection stub; the pairwise matrix is checkdown but NOT separable, so it WILL show inversions against the shipped equity ladder - that is the measurement (the stub's exact separability, ev(A,B) - 0.5 = (a_A - a_B)/2 to 1.1e-16, is precisely what the matrix falsifies, and it is the pairwise structure the plan wants rendered). Split the clause by the accessor ROUTE, not by the `source` string (both are 'checkdown'): the projection keeps zero inversions by identity; the matrix's inversion count at spr 0 is REPORTED and bounded only by an armed violator, never by a tolerance. Any clause that fires which you did NOT predict is a finding: record it with the numbers in a `> **Measured (P3 B2).**` block beneath §2's Amended block, then rewrite to the measurement.",
    "6. I35 ON THE MATRIX SOURCE + THE REPRODUCTION CHECK. Make I35 solve on the matrix route (both depths, three init seeds) in addition to - or instead of, decide and say - the stub; its two-seed PAYOFF axis goes LIVE (solve on matrix A, solve on matrix B, spread vs 0.15% of pot; S-A measured 0.035%), with the seed-inert check now reporting that the axis is exercised; clause (a)'s se floor is re-read from the matrix's own se. Record the reproduction check in the I35 detail line AND in the §3.3 Adjudicated block: HU value to SB, SB open %, BB fold % vs open, at T100 and T40, beside S-A's -0.1418 bb / 89.3% / 0.16% and P2's stub readings (-0.0816 / 99.4% / 0.0001%); a gap is a finding about the board budget, with the numbers, never a knob. The label (I35(f)) keys off source 'checkdown' and must still render on the matrix surface - assert it.",
    "7. THE RE-OPENING RULE (decision 8), evaluated ONCE by measurement, recorded in the §3.3 Adjudicated block and in cfr.mjs's SIXMAX record (append a frozen `reopenRule` entry naming the four legs and each leg's measured verdict; I35(d) must keep passing - SIXMAX.status stays 'deferred'). Leg (i) holds after step 4. Leg (ii) - MEASURE it: run multiwayProbe on the matrix route (expect 0 of 144 supported, shares not constant-sum, hero's share opponent-invariant - the matrix is pairwise); state whether any k-way sampler exists that passes I33(b)+(h) - none does at HEAD, and you do NOT build one: it is a new measurement outside this step's remit and the deferral is upheld. Legs (iii)/(iv) as measured. Then record: SIXMAX and I35(d) stand; I36's positional-nesting clause is not measurable in the HU domain (the I15 precedent) - write that sentence so p3-baseline, which writes I36, can quote it.",
    "8. RECORD. §2 gains a `> **Measured (P3 B2).**` block beneath its Amended block (the matrix route; which clauses fired on it and each rewrite's wording; the validation numbers; the two seeds and board count). §3.3's Adjudicated block gains the verdicts from steps 6 and 7. docs/METHODOLOGY.md, wherever the payoff contract, I33, I35 or the solver's payoff source is described (grep 'payoff', 'I33', 'I35', 'checkdown', 'projection', 'solver'), is brought into agreement - METHODOLOGY wins on disagreement, so leave nothing in it that still says the solver runs on the projection stub.",
    "",
    "CONSTRAINTS: payoff.mjs browser-safety rules (no top-level import above @browser-cut; export const|let|function|class only; rebuild with `node scripts/build.mjs` then `--check`). ZERO new opinion constants: the board count is inside S-A's measured band and the seeds are names - say so; if you find you needed a number S-A did not measure, it ships flagged per §6 and is named in newConstants. Do not touch scripts/lib/policy.mjs, src/shell.html (p3-baseline and p3-ui own it), smoke.mjs, browsers.mjs, data/model.json, the fixtures, or docs/refutations/*. Do NOT emit data/equilibrium.json and do NOT build the full variant - both are p3-baseline's. Run the three checks green: `node scripts/verify.mjs` (all gates, incl. I33 on both routes and I35 on the matrix), `node --test test/*.test.mjs`, `node scripts/build.mjs --check` (lite current; full still skipped by name at THIS step). Do NOT commit.",
    "Return JSON: done (true only with the three checks green), summary (MUST state: the matrix module and accessor-route names; boards, seed names and wall time per matrix; the validation numbers - mean/p95/max, conservation, undealable count, per-entry se; which I33 clauses fired on the matrix and each rewrite's wording; I35's payoff-axis spread; the reproduction check vs S-A with the T100/T40 numbers; the re-opening rule's per-leg verdict; every file touched), newConstants (expected EMPTY), blockers."
  ].join("\n")
};

async function runP3(state) {
  phase("P3 equilibrium baseline");
  state.phasesRun.push("P3 equilibrium baseline");
  const pre = await agent([
    HOUSE,
    "",
    "TASK - P3 precheck (barrier B2, under S-B Grade C). This launch may find the tree in ONE of two states, and you report which. (A) CLEAN AT HEAD: `git status` clean; `node scripts/verify.mjs` 53/53 incl. I22, I32, I33 (six keys, clauses (a)-(h) + monotonicity) and I35; `node --test test/*.test.mjs` all pass; `node scripts/build.mjs --check` reports lite current and full SKIPPED BY NAME (no data/equilibrium.json yet - expected here and only here). (B) THE RECORDED B2-RED STATE left by the first P3 run (wf_ac39face-2d4, 2026-09-03), the pre-stage's work UNCOMMITTED on the main tree: new scripts/lib/checkdown-matrix.mjs and test/checkdown-matrix.test.mjs; modified scripts/lib/payoff.mjs, scripts/lib/cfr.mjs, scripts/lib/payoff-model.mjs, scripts/gates/payoff.mjs, scripts/gates/solver.mjs, scripts/gates/reserved.mjs, test/payoff.test.mjs, test/payoff-model.test.mjs, test/gates-solver.test.mjs, docs/V3-PLAN.md, docs/METHODOLOGY.md - and NOTHING ELSE modified (src/shell.html, scripts/lib/policy.mjs, smoke.mjs, browsers.mjs, the fixtures and docs/refutations/* untouched; data/model.json may carry a verify stamp, see below); verify 52/53 with I35 the ONLY failing gate and clause (c/payoff) its only failing clause (0.1508% T100 / 0.1568% T40 against 0.15%); tests with EXACTLY one failure, test/gates-solver.test.mjs's 'I35 PASSES on the shipped model'; build --check lite current AFTER `git checkout -- data/model.json` (verify restamps gates.I35 FAIL + meta.hash into it every run; restoring it is the ONE change you may make, and you confirm by a key-by-key comparison that cells/rows/cols/bands/order/constants/benchmarks match HEAD). EITHER state is ok=true; ANY other red - a different failing gate, a second failing test, an unexpected modified file - is ok=false with the detail. In both states also verify: scripts/lib/payoff-model.mjs has ENABLED === false and scripts/lib/cfr.mjs exists; `node smoke.mjs` is green with its three slider-morph rows (floor 8 ms, ON 16 ms, OFF 4 ms); `git worktree list` shows worktree-wf_5a8a2571-726-2, or `git show worktree-wf_5a8a2571-726-2:scripts/spikes/sa-matrix.mjs` prints the file; docs/spikes/S-B.md's grade band (Grade C: p95 > 5.0) and docs/spikes/S-A.md's verdict. THE B2 CONDITION - I33 passing on a non-stub source - is NOT yours to assert: under Grade C there is no `source:'model'`, and the B2 pre-stage that follows you runs I33 on the measured matrix. Report Grade C explicitly.",
    "Return JSON: ok (state A or B holds exactly), detail (WHICH state, A or B; the verify/test/check/smoke readings; whether you restored data/model.json; anything failing), gradeBand ('C' expected)."
  ].join("\n"), { label: "precheck-P3", phase: "P3 equilibrium baseline", schema: precheckSchema, model: "sonnet", effort: "medium" });
  if (!pre || !pre.ok) {
    state.blockers.push("P3 precheck failed (the tree must be green and the S-A construction reachable before B2): " + (pre ? pre.detail : "agent died"));
    return finish(state);
  }
  log("Precheck passed (grade " + pre.gradeBand + "); B2 pre-stage: the payoff marriage on the measured matrix");

  // ---------------------------------------------------------------------------------------------
  // P3 B2 PRE-STAGE (decided at the P3 launch, 2026-09-03). ONE serial step on the MAIN tree,
  // before p3-baseline: the payoff marriage. Under Grade C the "real payoff" is the measured
  // pairwise checkdown matrix (decision 9), and B2 is I33 passing on it. opus@max under a fable
  // work-order - the payoff-freeze tier, because this is the "solver consumes the real payoff"
  // event. No commit inside the stage; the milestone boundary commits everything or nothing.
  // ---------------------------------------------------------------------------------------------
  phase("P3 B2 pre-stage");
  state.phasesRun.push("P3 B2 pre-stage");
  log("P3 pre-stage serial step: " + P3_PRE_STAGE.label);
  const marriageTask = P3_PRE_STAGE.prompt + "\n\n" + P3_ADJUDICATED + "\n\n" + P3_RELAUNCH_CONTEXT + "\n\nPRECHECK REPORTED (JSON): " + JSON.stringify(pre.detail);
  const order = await fableWorkOrder(state, "P3 B2 pre-stage", P3_PRE_STAGE.label, marriageTask);
  const b2 = await agent(HOUSE + "\n\n" + marriageTask + order, {
    label: P3_PRE_STAGE.label, phase: "P3 B2 pre-stage", schema: stepSchema,
    model: "opus", effort: P3_PRE_STAGE.effort
  });
  if (!b2 || !b2.done) {
    state.blockers.push("P3 B2 pre-stage failed: " + P3_PRE_STAGE.label + (b2 ? " - " + b2.summary + " " + b2.blockers.join("; ") : " (agent died)"));
    state.notes.push("P3 B2 pre-stage aborted; no baseline built");
    return closeMilestone(state, "P3 verify + commit", [], "v3 P3 (partial, red)", "");
  }
  if (b2.blockers.length) state.blockers.push(...b2.blockers);
  const preStage = { step: P3_PRE_STAGE.label, summary: b2.summary, newConstants: b2.newConstants || [] };
  state.notes.push(P3_PRE_STAGE.label + ": " + b2.summary.slice(0, 400));

  phase("P3 equilibrium baseline");
  const base = await agent([
    HOUSE,
    "",
    "TASK - P3 equilibrium baseline, per docs/V3-PLAN.md sections 3.3 and 5.3 (with their Measured and Adjudicated blocks), on the MAIN tree (single writer this step). S-B grade band: " + pre.gradeBand + ". THE B2 PRE-STAGE RAN BEFORE YOU and its work is on the tree UNCOMMITTED (the milestone boundary commits) - build on it, never revert it. It reported (JSON):",
    JSON.stringify(preStage, null, 2),
    "",
    "Do:",
    "1. EMIT data/equilibrium.json from the married solver (scripts/lib/cfr.mjs solveHU on the matrix route the pre-stage landed; both depths T100 and T40; init seed 0 canonical): full strategies (the averaged strategy per infoset), the 7,626-pair matrix - per decision (13) its source of truth is the committed Node-side artifact the pre-stage generated at the shipped board count; equilibrium.json carries the primary matrix per §5.3, or a content-hash reference to the artifact if embedding would double the shipped bytes (decide by D9's measurement and say which; the two-seed spread recorded as a datum beside it) - the payoff `source` ('checkdown') and the label derived from it, CAPS (the on-screen cap list's source datum), the solver constants, per-node frequencies, exploitability, wall time, the validation residuals, the HU coverage map; `meta.synthetic` absent or false. FULL build only. Write gate D9 (promote it from scripts/gates/reserved.mjs the three-line way scripts/gates/index.mjs documents: flip `status`, add the id to a family's `ids`, add it to EXPECTED_IDS): a measured+5% byte tripwire on the file, refusing a payload carrying meta.synthetic: true (§5.3), plus the full page's own total-size tripwire; set VARIANTS.full.budgets in scripts/lib/variant.mjs from the measurement (+5%, arithmetic, stated in budgetSource) and update test/variant.test.mjs's null pin DELIBERATELY - it exists to make this flip a decision.",
    "2. MAKE THE FULL VARIANT BUILD FOR REAL: add the `@inject:eq` region to src/shell.html wrapped in `@only:full` (this seam and step 4's Method-view row are the ONLY src/shell.html edits you make; p3-ui owns the rest). The build must produce index-full.html; `node scripts/build.mjs --check` must report BOTH variants current - 'skipped: full' is no longer acceptable from this step on. D10's lite negative manifest and D11's dual determinism must pass. smoke.mjs already iterates every built variant; if browsers.mjs runs only index.html, extend it to every built variant in smoke.mjs's idiom.",
    "3. THE BASELINE-TIER BLOCK into the shared core: per (pos, node, cell) baseline tiers, quantized via a named `baselineQuant` constant anchored to the payload bytes it buys (measure two or three quantizations and state the bytes each costs - that table IS the anchor), written as model.baselineTiers (the key gate D6 already reads for its 12 KB sub-budget), carrying its own `source:'checkdown'` datum and the cap list, so lite's tier-level vs-GTO mode renders the label and the caps from shipped data. COVERAGE IS HU (decision 8): the solved nodes map onto the page's vocabulary (scripts/lib/policy.mjs NODES rfi/limps/raise/3bet and POSITIONS) as SB x rfi (the open), BB x raise with raiser SB (facing the open), and SB x 3bet (facing BB's 3-bet); every other (pos, node) pair carries the named reason 'baseline is HU' in the block rather than a number. D6 must print the baseline sub-budget filled and its core clause still binding.",
    "4. STAMP THE SOLVER CONSTANTS (decision 10): model.constants.solver = cfr.mjs's CONSTANTS values (epsilonBB, iterCap, twoSeedTolPot, sizingLadder) with their anchors, through the surgical path scripts/generate-data.mjs's stampConstants and the gates stamp already use - NOT a Monte Carlo regeneration; append the on-disk block and every built page's block to I35's `constantsUnits` so the gate reads them back; render the row in the Method view (src/shell.html renders `constants` generically - confirm it, and if the solver block needs its own row, add only that). Then PROVE decision 11: a key-by-key comparison of data/model.json before and after showing cells/rows/cols/bands/order/benchmarks byte-identical; test/payoff-model.test.mjs's 17-coefficient re-derivation, I22, I32 and I43 green; no fixture moved (NEVER run freeze-tiers.mjs --force).",
    "5. LABELING per §3.3 and decision 8, from shipped data not prose: HU is 'GTO'; the 'a game where postflop does not exist' label keyed off the shipped source datum (I35(f)); the on-screen cap list derived from shipped CAPS (I35(e)); 'baseline is HU' as the named reason on every non-HU seat; no 'self-play fixed point' surface exists because nothing multiway is solved - the data says so.",
    "6. WRITE GATE I36 (promote it from reserved.mjs the three-line way), SCOPED TO THE MEASUREMENT: the comparand is RAW model tiers with post-passed display noted (§3.3 - the post-passes, nesting and suit monotonicity, are impositions an equilibrium may violate; a violation is a finding to report, never laundered). In the HU domain the measurable clauses are: AA_BIGPAIR x DS opens at SB (the 'opens everywhere' clause over the seats that exist) and continues vs the open at BB; TRASH x RB's 'never opens UTG' has NO UTG to measure - record the HU reading instead (its SB open frequency under checkdown; expect it OPENS, since S-A measured SB opening 89.3%, which is the finding the label is about) and scope the clause to what is measured; the emergent positional-nesting clause is NOT MEASURABLE in the HU domain (decision 8, the I15 precedent - quote the pre-stage's sentence): the gate records it as not measurable with the reason, never as a pass and never toleranced, and the plan's prediction 'nesting fails at some seat pair' is recorded as NOT TESTABLE this milestone. The raw-vs-post-passed display decision (§14 item 4) is made on what IS measurable: whether the solved HU tiers violate the post-passes (suit monotonicity within a row; the SB-open set's relation to the model's SB rfi tiers) - report which predictions fired. Every clause armed against a fabricated violator. Record the outcome as a `> **Measured (P3).**` annotation in §7.2 beneath the I36 row and a Resolved block under §14 item 4.",
    "",
    P3_ADJUDICATED,
    "",
    "Run the three checks green (`node scripts/verify.mjs` incl. I22/I32/I33/I35/I36/D6/D9/D10/D11; `node --test test/*.test.mjs`; `node scripts/build.mjs --check` with BOTH variants current), `node smoke.mjs` green on both built variants (the three morph rows unchanged: floor 8, ON 16, OFF 4 - never widen), `node browsers.mjs` green. Do not commit.",
    "Return JSON: done, summary (MUST state: equilibrium.json's bytes and D9's number; the baseline block's bytes vs 12 KB and baselineQuant's anchor table; the HU coverage map; the constants stamp and the decision-11 comparison result; I36's per-clause outcome incl. which predictions fired and which are not measurable; full/lite --check, smoke and browsers status; every file touched), newConstants (with one-line anchors - baselineQuant expected here, and D9's budget), blockers."
  ].join("\n"), { label: "p3-baseline", phase: "P3 equilibrium baseline", schema: stepSchema, model: "opus", effort: "xhigh" });
  if (!base || !base.done) {
    state.blockers.push("P3 baseline failed" + (base ? ": " + base.blockers.join("; ") : " (agent died)"));
    return closeMilestone(state, "P3 verify + commit", [], "v3 P3 (partial, red)", "");
  }
  if (base.blockers.length) state.blockers.push(...base.blockers);
  state.notes.push("p3-baseline: " + base.summary.slice(0, 400));

  const ui = await agent([
    HOUSE,
    "",
    "TASK - P3 UI: vs-GTO live, per docs/V3-PLAN.md section 8 (you are the single src/shell.html writer this step; the B2 pre-stage and p3-baseline are on the tree UNCOMMITTED - build on them, never revert them). p3-baseline reported (JSON):",
    JSON.stringify({ summary: base.summary, newConstants: base.newConstants || [] }, null, 2),
    "",
    "Do:",
    "1. Wire the vs-GTO colour mode onto the matrix legend-row switch scaffolded in P1 (MODES key 'gto', kind 'diverging'; availability keyed off modeCaps().equilibrium - in LITE that capability comes from model.baselineTiers, in FULL from the injected EQUILIBRIUM block; the scaffold's own comment says one line flips): the page's first true diverging signed ramp (the delta-pin two-colour encoding is insufficient for signed magnitude), a colorblind redundancy channel, aria labels, tooltip content, I13's combos-partition asserted in this mode; in LITE the mode runs off the quantized baseline-tier block, in FULL off the @inject:eq detail; full-only depth renders disabled-with-named-REASON in lite.",
    "2. COVERAGE IS HU (decision 8): the mode is live at SB x rfi, BB x raise (raiser SB) and SB x 3bet, and at every other (pos, node) the chip and the grid render disabled-with-named-REASON 'baseline is HU' in the SIM.available idiom - the reason read from the shipped block, not typed in the page. The 'a game where postflop does not exist' label renders wherever the baseline paints, derived from the shipped source datum (I35(f)); the cap list renders from shipped CAPS (I35(e)). HU is labelled 'GTO'.",
    "3. Inspector: the vs-GTO divergence line slots into the Verdict tab's margin/headline seams (the marginUnit/eqSE provenance machinery) and the reason-line machinery gains the divergence sentence; the comparand rendering follows the I36 outcome p3-baseline recorded in §7.2 and §14 item 4 (raw either way; the grid display decision per the finding).",
    "4. THE BYTE-BUDGET DECISION (decision 12). Measure the lite app block before and after (`node scripts/build.mjs --check` prints the split; HEAD was 359.1 of 360 KB). SHRINK DEAD WEIGHT FIRST - the scaffold's placeholder prose, duplicated strings, anything the P1/P2 lanes left inert - and report what you removed and its bytes. If the mode still does not fit, raise the ceiling as a STATED, PAID raise at measured+5% in the D6 idiom in scripts/lib/variant.mjs: the `app` budget rises; a `core` clause re-asserts the old 360 KB against the app payload MINUS the measured vs-GTO block (mark the block in the source so the build can measure it); the build prints both readings; test/variant.test.mjs's pin is updated deliberately; and docs/METHODOLOGY.md §9.11 gains the raise-vs-shrink paragraph it is owed (the number, what was shrunk first, why the remainder is paid for by name). If it fits, §9.11 gets the paragraph anyway - the shrink that avoided the raise. NEVER a silent raise. Name the raise, if made, in newConstants with its anchor.",
    "",
    P3_ADJUDICATED,
    "",
    "Everything inert at legacy settings (TIER default): I22, I32 and I43 must stay green; test/ui-mode.test.mjs and test/ui-payoff-mirror.test.mjs change only where the mode's behaviour changed. Run the three checks green (both variants current), `node smoke.mjs` green on both built variants (the morph rows never widened; add a smoke row in the existing idiom asserting the vs-GTO chip's state per variant and the label's presence in the mode), `node browsers.mjs` green. Do not commit.",
    "Return JSON: done, summary (MUST state: the vs-GTO coverage actually live per variant; app-block bytes before/after, what was shrunk, and the ceiling decision with its arithmetic; the §9.11 paragraph's gist; every file touched), newConstants (the app-ceiling raise if made, with its anchor; else empty), blockers."
  ].join("\n"), { label: "p3-ui", phase: "P3 equilibrium baseline", schema: stepSchema, model: "opus", effort: "xhigh" });
  if (!ui || !ui.done) {
    state.blockers.push("P3 UI failed" + (ui ? ": " + ui.blockers.join("; ") : " (agent died)"));
    return closeMilestone(state, "P3 verify + commit", [], "v3 P3 (partial, red)", "");
  }
  if (ui.blockers.length) state.blockers.push(...ui.blockers);
  state.notes.push("p3-ui: " + ui.summary.slice(0, 400));

  // The red-team list: the two constants §6 always named for P3, the matrix's two abstraction
  // choices (decision 9 - S-A's construction carries them), whatever the three steps declared
  // (baselineQuant, D9's budget, and the app-ceiling raise if p3-ui made one).
  const p3Constants = [
    "baselineQuant tier-quantization step (anchor: the payload bytes it buys, stated at D6's sub-budget)",
    "D9 equilibrium.json byte budget (anchor: measured+5%, arithmetic)",
    "matrix chance measure = product of marginals (abstraction choice, S-A: no cell-level card removal between the two players; 43 structurally undealable pairs carrying 3.6e-5 of the combo mass, surfaced by I33(h) as supported:false)",
    "matrix board budget - shared boards inside S-A's 12.5k-25k band, two named seeds (anchor: S-A's out-of-sample exploitability-by-matrix-size table; bounded by I35(c)'s live payoff axis and the recorded reproduction check against S-A's 400k-board reading)"
  ];
  for (const c of (preStage.newConstants || [])) if (p3Constants.indexOf(c) === -1) p3Constants.push(c);
  for (const c of (base.newConstants || [])) if (p3Constants.indexOf(c) === -1) p3Constants.push(c);
  for (const c of (ui.newConstants || [])) if (p3Constants.indexOf(c) === -1) p3Constants.push(c);
  await redTeam(state, "P3 adversarial verification", p3Constants, "docs/refutations/P3.md");

  return closeMilestone(
    state, "P3 verify + commit", ["I22", "I32", "I33", "I35", "I36", "D6", "D9", "D10", "D11"],
    "v3 P3: equilibrium baseline - the payoff marriage at B2 on the measured pairwise checkdown matrix (I33 (c)/(h) rewritten to the measurement), data/equilibrium.json (D9) + baseline-tier block, HU-only baseline labelled GTO with the 6-max deferral upheld by measurement, vs-GTO colour mode live (I36), solver constants stamped",
    "CLOSE-OUT REQUIREMENTS FOR P3 (each is a red condition if unmet, reported in detail): (1) `node scripts/build.mjs --check` must report BOTH variants current - index.html [lite] AND index-full.html [full]; a line reading 'skipped: full (no data/equilibrium.json ...)' is RED for this milestone, not a skip. (2) Run `node smoke.mjs` (it iterates every built variant - both must be green; paste the three slider-morph rows per variant - floor 8 ms, ON 16 ms, OFF 4 ms - and the vs-GTO row) and `node browsers.mjs` on both built variants; smoke/browsers are not in the GREEN trio (package.json) but any red row is pasted into detail and counts as NOT green here. (3) I33's detail line must NAME the matrix source and show clauses (c) and (h) passing ON IT - (c) rewritten to the signed card-removal residual, (h) with the 43 AA_* x A_BLOCKED undealable pairs supported:false. (4) I35's detail line must show the two-seed PAYOFF axis LIVE (two independent matrices, spread vs 0.15% of pot), a `constants` block count > 0 with every block passing, the label derived from source 'checkdown', the SIXMAX deferral standing with the re-opening rule's verdict recorded, and the reproduction-check numbers. (5) I36 and D9 present and passing, with I36's positional-nesting clause recorded not-measurable in the HU domain (never toleranced). (6) data/equilibrium.json exists, is full-only (D10 green on lite: no @inject:eq, no EQUILIBRIUM, no evEstimate in index.html), and the lite page's accessor still serves the projection stub (source 'checkdown', six keys). (7) The lite app ceiling is either untouched, or raised as a stated, paid raise whose core clause the build prints and whose METHODOLOGY §9.11 paragraph exists. (8) Decision (13): the matrix artifact's own `--check` (the generator's rebuild-and-compare, `node <generator> --check`) is GREEN and its meta names the shipped board count (400,000 unless the record says the budget forbade it) and both seeds; I35's payoff axis passes at that count with the margin reported in its detail line. Grade band C: no model-sourced EV surface; scripts/lib/payoff-model.mjs still ENABLED=false."
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
