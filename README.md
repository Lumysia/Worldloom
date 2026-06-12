# agentic-engine-dev — OpenCode multi-agent implementation pack

OpenCode skill pack for building the Agentic Sandbox Engine:
an **orchestrator** (primary) dispatches task cards, **workers** (subagents)
implement, a **reviewer** (subagent) grades findings by severity; **a commit
happens only with zero blocker/major findings**, then the next task begins.
No PR flow — the gated commit *is* the release.

## Install

Copy the `.opencode/` directory into your project repository root (an empty
repo is fine — task T01 builds the skeleton):

```bash
unzip agentic-engine-dev.zip
cp -r agentic-engine-dev/.opencode /path/to/your-repo/
cd /path/to/your-repo && git init   # if not yet initialized
opencode
```

## Contents

```text
.opencode/
  agent/
    orchestrator.md     primary agent: dispatch only, never writes code;
                        edit permission locked to docs/agents/
    worker.md           subagent: implements one task card, tests-first
    reviewer.md         subagent: read-only + may run tests; emits a structured
                        VERDICT
  skills/engine-implementation/
    SKILL.md            workflow charter: main loop, severity ladder,
                        escalation rules, context discipline
    references/
      design.md         design document (why/what) — incl. multiplayer (§8)
                        and i18n (§9)
      spec.md           normative spec (type contracts, anti-drift F1–F13,
                        determinism D1–D7, test contract, open questions Q1–Q4)
      tasks.md          task cards T01–T11 (M0) + M1–M4 placeholders
      review-checklist.md  review standard (B1–B8 / M1–M7)
      state-template.md    task-ledger template
    scripts/
      gate.sh           quality gate: install→lint→typecheck→depcruise→test
```

## Usage

1. Start OpenCode and Tab-switch to `orchestrator` (or set
   `"default_agent": "orchestrator"` in opencode.json).
2. Say `start` (or `continue`). The orchestrator reads/creates
   `docs/agents/STATE.md`, dispatches the next task to a worker → review →
   gated commit, and loops.
3. It will stop and ask you in these situations (by design):
   - an open question Q1–Q4 in spec.md is touched (before T04/T05/T06/T11);
   - one task fails review 3 times;
   - a new dependency or a quality-gate change is needed.
   Your answers are recorded in STATE.md's Decisions section and never asked
   again.
4. Resuming after an interruption: open a new session and say `continue` —
   all state lives in STATE.md and the git log.

## Model suggestions

The agent files do not pin a model (your default is used). If you want to
split: give the orchestrator and reviewer your strongest model (dispatch
judgment and review strictness are the most model-hungry); the worker can run
a cheaper model — the spec and the review loop exist precisely to contain
worker drift. Add `model: provider/model-id` to any agent's frontmatter.

## Editing the spec

`spec.md` / `tasks.md` / `review-checklist.md` are the law texts for the
agents; humans may edit them at any time — then tell the orchestrator
"the spec changed, re-read and continue." The agents themselves have no
authority to modify these files.
