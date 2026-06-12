---
name: engine-implementation
description: >-
  Multi-agent implementation workflow for the Agentic Sandbox Engine. Use when
  the task involves implementing, reviewing, advancing, or resuming this engine
  project (orchestrator dispatches task cards, workers write code, reviewers
  grade issues by severity; commits happen only with zero blocker/major
  findings). Bundles the design document, normative spec, task cards, review
  checklist, and quality-gate script.
license: MIT
metadata:
  version: "1.1"
---

# Engine Implementation Workflow

This skill defines the multi-agent implementation process for the Agentic
Sandbox Engine from zero through M0 and beyond. Three roles: **orchestrator**
(dispatch/release), **worker** (implementation), **reviewer** (grading).
There are no PRs; a commit *is* the release, and the only release condition is
**gate.sh passes AND the review finds zero blocker/major issues**.

## File map (load on demand — do not read everything at once)

```text
references/design.md            Design document (why/what). Consult for planning
                                and disputes. Includes multiplayer (§8) and
                                i18n (§9) models.
references/spec.md              Normative spec (how). Mandatory for workers;
                                contains type contracts, determinism rules,
                                anti-drift list, test contract, open questions.
references/tasks.md             Task cards (T01...). Each card: goal / file
                                scope / DoD / dependencies.
references/review-checklist.md  Review standard & severity definitions.
                                The reviewer's sole authority.
references/state-template.md    Initial template for STATE.md.
scripts/gate.sh                 Quality gate: install→lint→typecheck→depcruise→test.
```

## Externalized state

Project memory lives in no agent's context; it lives in `docs/agents/STATE.md`
(git-tracked): the task ledger (pending / in_progress / done / blocked), human
rulings (Decisions), and leftover minor debt (Debt). **Only the orchestrator
writes this file.** Every agent's fresh session begins by reading STATE.md —
sessions can be interrupted and resumed at any time.

## Main loop (executed by the orchestrator)

```text
LOOP:
  1. Read STATE.md → pick the next pending task Tn whose dependencies are done;
     mark it in_progress
  2. Assemble a brief → Task-call the worker:
       brief = the full Tn card from tasks.md
             + any Decisions in STATE.md relevant to Tn
             + one line: "Do only this card; report using the delivery format."
       (Self-contained. No chat history. No other tasks' information.)
  3. Worker returns:
       a. reports "stuck / ambiguity" → record in STATE.md, ask the human,
          wait → back to 2
       b. reports done → continue
  4. Task-call the reviewer: brief = "Review Tn" + the full Tn card + file scope
  5. Parse VERDICT:
       REJECT  → attach the ISSUES verbatim to a fresh brief, back to 2
                 (a new worker session, armed with the issue list).
                 3 cumulative REJECTs on one task → mark blocked, record all
                 issues, stop and report to the human. Never lower the bar.
       APPROVE → continue
  6. git status — confirm all changes sit inside Tn's file scope
     → git add <in-scope files> && git commit -m "feat(Tn): <summary> [reviewed: pass]"
  7. STATE.md: mark Tn done; record minor/nit items under Debt; back to 1
```

## Severity & release (shared by all roles)

```text
blocker  violates a spec.md MUST (anti-drift F*, determinism D*, dependency
         rules K*), gate failure, missing/renamed/sham tests, out-of-scope changes
major    DoD not fully met, scope shrinking (R2), scope growing (R3),
         swallowed errors, missing error handling on critical paths
minor    naming, duplication, missing docs, non-critical code quality
nit      pure style

Release = 0 blockers AND 0 majors. minor/nit are logged as debt, never blocking.
```

## Escalate to the human (all roles)

Stop and wait for the human in these cases — **no agent may decide alone**:
touching an open question (Q items in spec.md §7); adding a dependency;
modifying gate.sh / lint / tsconfig / dependency-cruiser rules; 3 failed review
rounds on one task; discovering a self-contradiction in spec.md (record the
contradiction in STATE.md).

## Context discipline (why it is built this way; violating it = drift)

- Worker / reviewer always get a **fresh session and a narrow brief**: the
  dominant failure mode of multi-agent systems is context pollution — stuffing
  unrelated history into a subagent measurably degrades its judgment.
- The reviewer is read-only and re-runs the gate itself: review independence is
  enforced by permissions, not by exhortation.
- The orchestrator never touches code: its context is reserved for the task
  graph; writing code would crowd out dispatch judgment.
- All "completed" knowledge goes into STATE.md and the git log — never into
  anyone's conversation history.
