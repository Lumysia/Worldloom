# Review Checklist & Severity Standard (the reviewer's sole authority)

Verdict rule: any **blocker or major → REJECT**; only minor/nit → APPROVE.
A gate.sh failure is an unconditional REJECT. No item may be downgraded
because "the overall quality is good."

## Severity definitions

```text
blocker  Violates a normative MUST, or breaks the process itself.
         Cannot enter mainline until fixed.
major    Functional defect: DoD not fully met, scope deviation,
         missing error handling. Must be fixed.
minor    Quality issue: non-blocking; recorded in STATE.md's Debt section,
         repaid via a dedicated later card.
nit      Pure style preference. List it and move on.
```

## Blocker triggers (check every one)

```text
B1  Any gate.sh gate fails (re-run it yourself; never trust the worker's report)
B2  The diff touches files outside the task card's file scope
B3  Any anti-drift rule F1–F13 violated (walk the list; it lives in spec.md §2)
B4  Any determinism rule D1–D7 violated (in kernel code, focus on F3/D2/D4/D7:
    wall-clock, randomness, iteration order, language-blindness)
B5  Test contract (spec.md §6): a DoD-required T-* test is missing, renamed,
    or skipped (skip/todo)
B6  Modification of T01 artifacts: gate.sh, eslint, tsconfig,
    dependency-cruiser, or any pre-existing test
B7  A new dependency added without the escalation flow
B8  Core types in spec §4 had fields added/removed or signatures changed
```

## Major triggers

```text
M1  Any DoD item unmet (a test that exists but asserts nothing real counts —
    see M2)
M2  Sham assertions: toBeDefined()/toBeTruthy() instead of concrete values;
    blanket large-object snapshots instead of semantic assertions; a property
    test whose property degenerates to a constant
M3  Scope shrinking (R2): TODO/FIXME "later" markers, commented-out paths,
    hardcoded "temporary" return values
M4  Scope growing (R3): abstraction layers, config options, caches, or exports
    the task card never asked for
M5  Error handling: failure branches on critical paths (pipeline, store,
    hydrate) untested or swallowed
M6  Type escape: passes lint but semantically dodges the types (overly wide
    generics, unknown threaded to the bottom)
M7  Tests are held to the same law: test code violating F5/F10/F13 is graded
    at this level too
```

## Minor / Nit

```text
minor  Unclear naming, duplicated blocks, missing JSDoc on public exports,
       missing edge-case tests (beyond DoD)
nit    Formatting, comment wording, in-file ordering
```

## Process reminders

1. Read the entire diff file by file — no sampling.
2. Re-run gate.sh yourself.
3. Verify the task card's DoD item by item, then walk B1–B8 and M1–M7.
4. Output format is defined in the reviewer agent file
   (VERDICT/TASK/GATE/ISSUES/SUMMARY); every issue must carry file:line and the
   violated clause number so it is directly locatable.
5. Never provide fix code — describe the problem and the clause; fixing is the
   worker's job.
