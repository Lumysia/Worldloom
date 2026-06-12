# Normative Specification (Implementation Constitution)

> Companion to `design.md`. The design document answers why/what; this document
> answers how, and it is normative. Where the two conflict, this document wins.
> Where this document is silent, stop and ask (via the escalation flow in
> SKILL.md) — never improvise.
> Terminology follows RFC 2119: **MUST / MUST NOT / SHOULD / MAY**. Every MUST
> has an automated check.

## 0. Rules of Engagement

```text
R1  No re-deciding. Everything in §1 Decision Log (libraries, versions,
    directories, naming) is input, not suggestion. A better idea goes into
    docs/proposals/ as a proposal — never a direct change.
R2  No scope shrinking. Forbidden phrasings and behaviors: "simplify for MVP",
    "in-memory for now, swap later", "skip this edge case for now". Scope is
    defined by the task card; the DoD is acceptance tests — failing tests mean
    not done.
R3  No scope growing. Anything the task card does not ask for MUST NOT be
    implemented (including incidental caches, config options, abstraction
    layers). YAGNI is enforced by the task card, not judged by the implementer.
R4  No silent failure. No swallowing try/catch, no default-value masking of
    errors. Every impossible path in the kernel MUST crash explicitly via
    assertNever / invariant().
R5  Stuck means stop. Spec ambiguity, type mismatch, contradictory tests →
    raise the concrete question and stop. MUST NOT guess intent and continue.
R6  One task card per delivery. The orchestrator commits only after the
    reviewer verdict shows zero blocker/major issues; the commit message
    references the task card ID.
```

## 1. Decision Log (settled — do not re-litigate)

```text
runtime        Node 22 LTS, ESM only ("type": "module")
language       TypeScript 5.x, full strict (see §5 tsconfig)
monorepo       pnpm workspaces + turborepo
schema         zod@^4
ecs            bitecs@^0.4
expr rules     @marcbachmann/cel-js (CEL)
sandbox        quickjs-emscripten (M0 integrates only the interface; Builder lands in M3)
event store    better-sqlite3 (local) / postgres@drizzle-orm (server)
               — both implement the same EventStorePort; M0 ships only the SQLite driver
realtime       colyseus@^0.16 (lands in M1; not introduced in M0)
llm            ai@^5 (Vercel AI SDK; lands in M1; never imported by kernel)
id             ulid
i18n           ICU MessageFormat resources; built-in Intl (CLDR) for plural/
               number/date/collation; i18next + i18next-icu in apps/web (M1);
               eslint-plugin-i18next (no-literal-string) in lint
test           vitest + fast-check (property-based)
lint           eslint + dependency-cruiser (§5 rules)
format         prettier defaults; style is not a discussion topic
```

Adding any dependency MUST go through the escalation flow (human approval) and
MUST NOT duplicate functionality of the table above (e.g., no ajv, uuid, lodash,
rxjs, inversify).

## 2. Anti-Drift Rules (the forbidden moves)

| # | Forbidden move | Check |
|---|---|---|
| F1 | Bypassing events: any World Store write not going through `applyEvents()` | World Store mutators exported kernel-internal only; imports of mutators outside `projection.ts` blocked by dependency-cruiser |
| F2 | "Temporarily" skipping a pipeline gate (Auth/Schema/Policy/Precondition) | Pipeline is driven by the `PIPELINE_STAGES` constant array; a test asserts its contents (T-PIPE-01) |
| F3 | `Date.now()` / `Math.random()` / `performance.now()` / `setTimeout` inside the kernel | eslint no-restricted-syntax scoped to `packages/kernel` |
| F4 | Kernel importing LLM SDKs, network libs, Colyseus | dependency-cruiser rule K1 |
| F5 | `any`, `as unknown as`, `@ts-ignore`, non-null `!` assertions | eslint error; CI rejects |
| F6 | Mocking kernel tests with LLM calls, or tests touching the network | vitest network-deny config (undici mock agent throws) |
| F7 | Deferring ObservationScope ("full visibility for now") | T-OBS-* tests exist and must pass in M0 |
| F8 | Reinventing wheels: hand-rolled schema validation, ws protocol, ULID | dependency allowlist + review checklist |
| F9 | An utterance's LLM output applied directly as effects | Impossible by type: `ArbiterOutput` can only carry `ActionIntent[]` (§4.3) |
| F10 | Swallowed errors: `catch (e) {}` or `catch (e) { console.log(e) }` | eslint no-empty + custom rule |
| F11 | Replacing ticks with wall-clock, or storing `Date` in events | `Event` type has no Date field; eslint F3 |
| F12 | Weakened test assertions (blanket snapshots, `toBeDefined()`-style checks) | review checklist; property tests on critical paths |
| F13 | Hardcoded user-facing string literals outside `locales/` resources or `apps/web` i18n resources; localized strings compared/branched on in kernel or rules | eslint-plugin-i18next no-literal-string (scoped); review checklist; kernel-side grep for LocalizedText misuse |

## 3. Determinism Contract (the kernel's supreme constraint)

All code in `packages/kernel` MUST satisfy: replaying the same `(seed, event
sequence)` on any machine yields a **bit-identical** serialized World Store.

```text
D1  Randomness: the only random source is an injected PRNG (pure-function
    xoshiro128**, seeded from the world-creation event). PRNG state is part of
    the World Store and serializes with snapshots.
D2  Time: the kernel's only time is the tick (uint). Wall-clock exists only in
    the server package, whose sole duty is deciding when to call kernel.step().
D3  Ordering: multiple Intents within one tick MUST be processed in
    (priority, arrival_seq) order; arrival_seq is assigned by EventStore append
    order, never by in-memory ordering.
D4  Iteration: any traversal that affects event output order (entity sets,
    rule triggers) MUST be explicitly sorted by ULID lexicographic order.
    Relying on Map/Set/object-key insertion order is forbidden.
D5  Serialization: snapshot and event payload JSON MUST use canonical form
    (sorted keys; implementation: fast-json-stable-stringify).
D6  Floats: the World Store MUST NOT hold accumulated floating-point results;
    numeric components use integers (fixed point: coordinate = cell × 1000).
    CEL may compare floats but never write them back.
D7  Language: the kernel never formats, translates, collates, or branches on
    human-language text. Localized resolution happens at the edges
    (presentation / prompt assembly) only.
```

Acceptance: T-DET-01 (same seed, 10,000 ticks run twice, snapshot SHA-256
identical), T-DET-02 (same-tick Intents submitted out of order produce the same
final state as in-order submission).

## 4. Core Types (signatures are the contract; no field additions/removals)

These live in `packages/metamodel/src/` — the repository's single source of
type truth. Field changes go through the escalation flow.

### 4.1 Identity & primitives

```ts
// ids.ts
export type WorldId   = string & { readonly __brand: 'WorldId' };   // ulid
export type EntityId  = string & { readonly __brand: 'EntityId' };  // ulid
export type PlayerId  = string & { readonly __brand: 'PlayerId' };
export type ActorRef  = EntityId;          // an actor is always an in-world entity
export type Tick      = number;            // uint, logical clock
export type Seq       = number;            // monotonic within an EventStore
export type Bcp47     = string & { readonly __brand: 'Bcp47' };     // language tag
```

### 4.2 Localized text (i18n surface in the metamodel)

```ts
// i18n.ts
// Authored text: a key resolved against the package's locales/<bcp47>.json
// (ICU MessageFormat). Components/definitions MUST use LocalizedText for any
// human-readable field; raw display strings in component schemas are F13.
export interface LocalizedText {
  key: string;                          // e.g. "entity.blacksmith.name"
  params?: Record<string, string | number>;  // ICU arguments
}

// Generated prose (narration, dialogue) recorded in events:
export interface GeneratedText {
  text: string;
  lang: Bcp47;                          // the language it was actually produced in
}
// Translations of GeneratedText for other recipients are derived data
// (cache keyed by (worldId, seq, lang)) and MUST NOT be appended as events.
```

### 4.3 Intent & Event

```ts
// intent.ts
export type Intent = ActionIntent | UtteranceIntent;

export interface IntentBase {
  id: string;                    // ulid, generated by the submitter
  worldId: WorldId;
  actor: ActorRef;
  submittedBy: PlayerId | 'system';
  idempotencyKey: string;
}

export interface ActionIntent extends IntentBase {
  kind: 'action';
  action: { def: string; params: unknown };   // params validated by ActionDef.schema
}

export interface UtteranceIntent extends IntentBase {
  kind: 'utterance';
  text: string;
  lang: Bcp47;                   // language of the utterance as typed/spoken
}

// event.ts — append-only, immutable once written
export interface WorldEvent {
  worldId: WorldId;
  seq: Seq;                      // assigned by the EventStore
  tick: Tick;
  type: string;                  // an EventDef id, or kernel-reserved 'kernel.*'
  payload: unknown;              // canonical JSON validated by EventDef.schema
  actor?: ActorRef;
  causedBy?: string;             // intent id or upstream event 'w:seq'
  revision: string;              // content-package git commit hash
}
```

### 4.4 Adjudication & effects

```ts
// pipeline.ts
export type IntentVerdict =
  | { ok: true;  events: NewEvent[] }                 // NewEvent = WorldEvent without seq
  | { ok: false; code: RejectCode; reason: string;    // reason cites the failed gate
      gate: 'auth' | 'schema' | 'policy' | 'precondition' };

export type RejectCode =
  | 'UNKNOWN_ACTOR' | 'NOT_POSSESSED' | 'SCHEMA_INVALID'
  | 'OUT_OF_SCOPE'  | 'BUDGET_EXCEEDED' | 'PRECONDITION_FAILED'
  | 'UNKNOWN_ACTION';

// Rule VM effect model: rules are pure functions producing Effects;
// the kernel translates Effects into events.
export type Effect =
  | { op: 'set';    entity: EntityId; component: string; value: unknown }
  | { op: 'remove'; entity: EntityId; component: string }
  | { op: 'spawn';  type: string; components: Record<string, unknown> }
  | { op: 'despawn'; entity: EntityId }
  | { op: 'relate'; from: EntityId; to: EntityId; relation: string; data?: unknown }
  | { op: 'unrelate'; from: EntityId; to: EntityId; relation: string }
  | { op: 'emit';   type: string; payload: unknown };   // domain event

// arbiter.ts — the type-level guarantee behind F9:
// the Arbiter cannot possibly produce an Effect.
export type ArbiterOutput =
  | { verdict: 'translate'; actions: ActionIntent[]; narration: GeneratedText }
  | { verdict: 'reject';    reason: GeneratedText }
  | { verdict: 'improvise'; draftAction: unknown; narration: GeneratedText };
```

### 4.5 Kernel ports (hexagonal: the kernel sees Ports, never implementations)

```ts
// ports.ts — implementations live in the server package;
// the kernel exposes only createKernel.
export interface EventStorePort {
  append(events: NewEvent[], expectedSeq: Seq): Promise<AppendResult>;  // optimistic concurrency
  read(from: Seq, to?: Seq): AsyncIterable<WorldEvent>;
  latestSeq(): Promise<Seq>;
}

export interface SnapshotPort {
  save(s: { seq: Seq; tick: Tick; revision: string; blob: Uint8Array }): Promise<void>;
  loadLatest(): Promise<{ seq: Seq; tick: Tick; revision: string; blob: Uint8Array } | null>;
}

export interface Kernel {
  submit(intent: Intent): IntentVerdict | Promise<IntentVerdict>;
  step(): Promise<WorldEvent[]>;          // advance 1 tick: order queue → adjudicate → apply → persist
  observe(scope: ObservationScope): WorldView;       // the only read path
  hydrate(): Promise<void>;               // snapshot + replay
}

// The Arbiter is a Port injected into the kernel — the kernel does not know
// an LLM sits behind it.
export interface ArbiterPort {
  adjudicate(u: UtteranceIntent, ctx: WorldView): Promise<ArbiterOutput>;
}
```

### 4.6 ObservationScope (first-class in M0; the object of F7)

```ts
export interface ObservationScope {
  observer: ActorRef | PlayerId;
  spatial:  { kind: 'radius'; center: EntityId; cells: number }
          | { kind: 'region'; region: string }
          | { kind: 'all' };               // system/debug only; AuthGate-verified
  infoWalls: string[];                     // unlocked information-wall keys
}
// One implementation reused in three places: PolicyGate reference checks /
// Persona observation / StateView culling (M1).
export interface WorldView { /* read-only projection; entities filtered by scope,
                                component fields filtered by infoWalls */ }
```

## 5. Package Boundaries & Compiler Baseline

```js
// .dependency-cruiser.cjs (excerpt; K-rule violations = error)
module.exports = { forbidden: [
  { name: 'K1-kernel-purity',
    from: { path: '^packages/kernel' },
    to:   { path: '^packages/(cognition|builder|protocol|server)|^(ai|colyseus|openai|i18next)' },
    severity: 'error' },
  { name: 'K2-kernel-no-io',
    from: { path: '^packages/kernel' },
    to:   { path: '^(node:fs|node:net|node:http|better-sqlite3|drizzle-orm)' },
    severity: 'error' },              // storage implementations live in server; injected via Ports
  { name: 'K3-apps-protocol-only',
    from: { path: '^apps/' },
    to:   { path: '^packages/(kernel|cognition|builder)' },
    severity: 'error' },
  { name: 'K4-metamodel-leaf',
    from: { path: '^packages/metamodel' },
    to:   { path: '^packages/(?!metamodel)' },
    severity: 'error' },
]};
```

```jsonc
// tsconfig baseline (inherited by all packages; never loosened)
{ "compilerOptions": {
    "strict": true, "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true, "noImplicitOverride": true,
    "verbatimModuleSyntax": true, "isolatedModules": true } }
```

## 6. Test Contract (acceptance is the spec; test names are a stable API —
## never rename or delete)

```text
T-DET-01   Same seed, 10k ticks replayed twice → identical snapshot SHA-256
T-DET-02   Same-tick Intents submitted out of order → final state equals in-order
T-PIPE-01  PIPELINE_STAGES === ['auth','schema','policy','precondition','effect','journal']
T-PIPE-02  ≥1 case per RejectCode; reason includes gate name + the specific definition id
T-PIPE-03  property: for any valid ActionIntent, (state after replay) === (state after live processing)
T-EVT-01   append optimistic concurrency: stale expectedSeq → rejected, zero side effects
T-EVT-02   non-canonical-JSON event payload → append throws
T-OBS-01   radius scope: out-of-range entities absent from WorldView
T-OBS-02   infoWall: locked component fields are absent from WorldView (not null)
T-OBS-03   PolicyGate: Intent referencing an out-of-scope entity → OUT_OF_SCOPE
T-SNAP-01  hydrate(snapshot@n + events n..m) === full replay 0..m
T-RULE-01  CEL condition: timeout / out-of-scope access → rule fails, kernel survives
T-UTT-01   With FakeArbiter (deterministic stub): utterance → translate → event
           carries lang-tagged narration
T-UTT-02   During replay the ArbiterPort is never called (spy asserts zero calls)
T-I18N-01  LocalizedText resolution: player locale → sourceLocale → 'en' fallback
           chain; missing key in non-source locale yields a package warning,
           never a crash; ICU plural args render per locale
T-GATE-01  A deliberate K1 violation fixture is rejected by depcruise
           (guards the guardrail)
```

`FakeArbiter` is part of M0: a deterministic lookup-table implementation that
makes the utterance channel end-to-end testable with zero LLMs (the companion
to F6).

## 7. Open Questions (touching one = stop and ask, citing the number)

```text
Q1  Relation storage layout in bitECS (component-pair simulation vs. a separate
    adjacency table) → must be decided before T04
Q2  The whitelist of world functions exposed to the CEL environment → before T05
Q3  Namespace convention for infoWall keys → before T06
Q4  Locale resource file layout inside packages (one file per locale vs. one
    file per domain per locale) → before T11
```

After a human ruling, the answer is recorded in the Decisions section of
`docs/agents/STATE.md`. An implementer discovering a new ambiguity reports a
new Q item — never decides alone.
