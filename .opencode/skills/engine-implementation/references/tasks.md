# Task Cards

Each card is a complete unit of work for a worker. Fields: Goal / File scope
(the only paths the worker may touch) / DoD (definition of done = tests that
must pass) / Depends on. The orchestrator dispatches in dependency order.
**Workers must not modify any file outside scope, and must not merge multiple
cards into one delivery.**

Implicit DoD on every card: gate.sh fully green; new code has tests; zero
F*/D*/R* violations.

---

## M0 — Kernel loop (no LLM)

### T01 Repository skeleton & quality gate
- Goal: pnpm workspace + turborepo; root tsconfig/eslint/prettier/
  dependency-cruiser (spec §5 rules verbatim); eslint-plugin-i18next wired
  (scoped per F13); CI = the four gate.sh gates (lint / typecheck / depcruise /
  test); vitest network-deny config.
- File scope: root config files, `turbo.json`, `.dependency-cruiser.cjs`,
  empty `packages/*/package.json` shells, `.github/workflows/ci.yml` (optional).
- DoD: gate.sh fully green on empty packages; a fixture
  `packages/kernel/src/__violation__.ts` deliberately importing colyseus is
  rejected by depcruise — solidified as test `T-GATE-01`.
- Depends on: none.

### T02 metamodel package
- Goal: all types from spec §4 (including `Bcp47`, `LocalizedText`,
  `GeneratedText`) + matching Zod schemas + canonical-JSON utility
  (fast-json-stable-stringify wrapper) + zod→JSON Schema export.
- File scope: `packages/metamodel/**`.
- DoD: types compile; valid/invalid fixture tests per schema;
  zod→JSON Schema snapshot test (snapshot human-confirmed once).
- Depends on: T01.

### T03 EventStore (SQLite) + SnapshotPort
- Goal: better-sqlite3 implementations of `EventStorePort` and `SnapshotPort`;
  append-only table, monotonic seq, optimistic concurrency.
- File scope: `packages/server/src/store/**` + matching tests.
- DoD: T-EVT-01, T-EVT-02.
- Depends on: T02.

### T04 World Store projection
- Goal: bitECS wrapper; `applyEvents()` as the sole write entry; application of
  all 7 Effect ops; World Store serialize/deserialize (for snapshots).
- File scope: `packages/kernel/src/projection/**` + tests.
- DoD: apply + serialization round-trip test per Effect op; serialization
  idempotence (serialize(deserialize(x)) === x).
- Depends on: T02. Q1 ruling applies (spec §7): dedicated RelationStore.

### T05 Intent Pipeline (action channel)
- Goal: `PIPELINE_STAGES`-driven pipeline; AuthGate / SchemaGate / PolicyGate /
  CEL precondition / effect execution / journal; all RejectCodes.
- File scope: `packages/kernel/src/pipeline/**`,
  `packages/kernel/src/rules/**`, tests.
- DoD: T-PIPE-01, T-PIPE-02, T-PIPE-03, T-RULE-01.
- Depends on: T03, T04. Q2 ruling applies (spec §7): the eight-function CEL whitelist, fail-closed.

### T06 ObservationScope & WorldView
- Goal: spec §4.6; the three spatial kinds (radius/region/all); infoWall
  field-level filtering (locked fields absent from WorldView, not null).
- File scope: `packages/kernel/src/observe/**`, tests.
- DoD: T-OBS-01, T-OBS-02, T-OBS-03.
- Depends on: T04, T05. Q3 ruling applies (spec §7): <packageId>.<domain>.<name> keys.

### T07 Clock / Scheduler / step()
- Goal: tick advancement; same-tick Intent ordering (D3); PRNG injection (D1);
  scheduled tasks (ActionIntents fired at future ticks).
- File scope: `packages/kernel/src/clock/**`, `packages/kernel/src/kernel.ts`,
  tests.
- DoD: T-DET-01, T-DET-02.
- Depends on: T05.

### T08 hydrate & snapshot policy
- Goal: `hydrate()` = loadLatest snapshot + replay of remaining events;
  automatic snapshot every 1000 ticks; PRNG state included in snapshots.
- File scope: `packages/kernel/src/hydrate/**`,
  `packages/server/src/store/**` (append-only changes), tests.
- DoD: T-SNAP-01.
- Depends on: T07.

### T09 utterance channel + ArbiterPort + FakeArbiter
- Goal: UtteranceIntents routed to the injected ArbiterPort; translate results
  re-enter the pipeline as ActionIntents; lang-tagged narration journaled as an
  event; the replay path bypasses the Arbiter.
- File scope: `packages/kernel/src/arbiter/**`,
  `packages/kernel/src/pipeline/**` (extension only), tests.
- DoD: T-UTT-01, T-UTT-02.
- Depends on: T07.

### T10 CLI
- Goal: four subcommands — `world create / replay / tail / inspect` — working
  only through the public Kernel interface and the EventStorePort.
- File scope: `apps/cli/**`.
- DoD: scripted end-to-end: create toy world → run 500 ticks → replay and
  verify snapshot hash equality (solidified as test `T-CLI-01`).
- Depends on: T08, T09.

### T11 demo-village content package (M0 final acceptance)
- Goal: 3 entity types, 5 actions, 2 information walls, a seed event sequence —
  all defined as data, zero kernel changes. Ships `locales/en.json` (source)
  and `locales/zh-Hans.json`; every human-readable field uses LocalizedText.
- File scope: `content/packages/demo-village/**`,
  `packages/kernel/src/loader/**`, tests.
- DoD: M0 acceptance test `T-M0-01`: load package → replay seed → run 1000
  ticks → deterministic hash equality; each of the 5 actions has one success
  and one rejection case. Plus `T-I18N-01` (fallback chain + ICU plural
  rendering across the two locales). Q4 ruling applies (spec §7): locales/<bcp47>/<domain>.json.
- Depends on: T10.

---

## M1+ (placeholders — refined jointly by the human and the orchestrator after
## M0 completes; implementing ahead of refinement is forbidden)

```text
M1  Cognition: tier router, Persona Runtime, memory stream (pgvector),
    MCP server, Colyseus integration, minimal web rendering (i18next UI chrome)
M2  Arbiter: real LLM implementation replacing FakeArbiter on the production path
M3  Builder: git packages, generation loop, QuickJS-WASM, migration runner,
    translation skill (locale files via the Builder flow)
M4  Multiplayer: three-layer identity, time_policy, possession, StateView
    culling, governance flow
```

Refinement rule: new task cards must follow this file's format
(Goal / File scope / DoD / Depends on); DoDs must be executable tests, and each
new test enters spec.md §6's test contract before its card opens.
