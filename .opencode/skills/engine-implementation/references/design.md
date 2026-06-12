# Agentic Sandbox Engine — Design Document

> An AI-native, web-first sandbox game engine with swappable presentation layers.
> Design goals: **General (genre-agnostic), Generative (mechanics can be created at runtime), Elegant (minimal kernel), Clean (one-way dependencies)**.
> Engineering principle: **never build what a production-grade SDK/library already provides; never invent an architecture a paper has already validated.**

---

## 0. One-Page Summary

The entire system compresses into four sentences:

```text
Kernel owns truth.        The kernel holds the single authoritative world state (event-sourced).
Minds propose.            Every intelligence (NPC / Director / Builder / player) may only submit an Intent.
Surfaces render.          Presentation layers render state and submit intents; they never adjudicate.
Content defines.          Genre, rules, and entities all come from versioned content packages;
                          the kernel only knows the metamodel.
```

This yields four planes with strictly one-way dependencies:

```text
┌──────────────────────────────────────────────────────────────┐
│  Interface Plane      Presentation (Web / CLI / future Unreal)│
│        │  depends only on Protocol (Colyseus rooms + schema)  │
├────────▼──────────────────────────────────────────────────────┤
│  Cognition Plane      NPC minds / Director / Builder          │
│        │  may only submit Intents via Tools (MCP)             │
├────────▼──────────────────────────────────────────────────────┤
│  Simulation Kernel    ECS + event log + adjudication pipeline │
│        ▲  loads                                               │
├────────┴──────────────────────────────────────────────────────┤
│  Content Plane        git-versioned World Packages            │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Design Principles

**P1 — Single source of truth.** The authoritative history of a world is an append-only event log; every state (ECS projection, agent-visible view, client snapshot) is a derivative of the event stream. This is the standard Event Sourcing result: state is derivable by replay (rehydration), and the log natively provides auditing, replays, time-travel debugging, and optimistic concurrency control.

**P2 — Proposal/adjudication separation.** No intelligence (players included) can write state directly. Everyone submits an `Intent`; the kernel's adjudication pipeline decides whether an Intent becomes events or is rejected. This comes from Concordia's Game Master paradigm (entities state intentions, the GM adjudicates outcomes) and AI Town's engineering practice (humans and agents submit the same kind of input into the same engine).

**P3 — Minimal metamodel.** The kernel does not know character / item / quest; it only knows Entity / Component / Relation / Action / Rule / Event. Genre is data, not code paths.

**P4 — Generated code is untrusted.** Any rule code produced by the Builder is treated as untrusted input: schema validation → sandboxed execution → dry-run simulation → self-verification — all four gates must pass before entering a content package. The vm2 CVE series has proven that in-process JS sandboxes are not a security boundary, so the execution environment is WASM.

**P5 — Tiered cognition; tokens are a scarce resource.** Reflex tier (utility/behavior tree, 0 tokens, every tick), Habit tier (small model, seconds), Deliberation tier (large model + memory retrieval + reflection, minutes / event-triggered). The literature consensus: high-level cognition goes to the LLM, low-level control goes to conventional controllers; hybrid routing cuts roughly 40% of model calls.

**P6 — Buy wheels, don't build them.** For every subsystem, first ask "which existing library already does this at production grade": state sync → Colyseus; versioning → git; schemas → Zod; LLM access → Vercel AI SDK; tool protocol → MCP; sandbox → quickjs-emscripten; migrations → the Umzug pattern; observability → OpenTelemetry GenAI + Langfuse; storage → Postgres + pgvector; i18n → ICU MessageFormat + CLDR via the built-in `Intl` API. We keep exactly two things in-house: **the metamodel + adjudication pipeline** (the product's substance) and **the Arbiter/Director prompt engineering** (the product's soul).

**P7 — Single-player is a special case of multiplayer.** From day one the engine models "one persistent world, many observers": each observer holds a restricted view, and world time is independent of any observer's online status. Single-player is merely the degenerate case of "exactly one observer, and time is allowed to pause." See §8.

**P8 — The kernel is language-blind.** Truth is structured; prose is presentation. No human-language string ever participates in adjudication, rules, or identity. All player-facing text is either a localizable resource key or generated text tagged with its language. See §9.

---

## 2. Research Foundations → Design Decisions

This section is the provenance index for "why it is designed this way." Each paper/system contributes exactly one validated conclusion, mapped to one concrete mechanism.

| Source | Validated conclusion | Mechanism in this design |
|---|---|---|
| **Generative Agents** (Park et al. 2023, UIST) | Memory stream + retrieval (recency × importance × relevance) + reflection + planning; ablations prove each is essential for believable behavior | §6.3 Memory: three-factor retrieval scoring; Reflection as a scheduled job writing back into the stream |
| **Concordia** (DeepMind 2023) | A Game Master translates natural-language action attempts into legal world outcomes; both agents and the GM are composed from small reusable components | §5.4 Arbiter: the adjudication channel for natural-language Intents; §6.1 componentized minds |
| **Voyager** (Wang et al. 2023, NeurIPS) | An ever-growing library of executable code skills + iterative prompting (environment feedback / execution errors / self-verification) enables lifelong learning; skills are composable and transferable | §7 Builder: generation loop = generate → sandbox run → feedback → verify → commit; Skill Library = the package's `skills/` |
| **AI Town** (a16z/Convex 2023) | Engine and game rules layered apart; humans and agents submit isomorphic inputs; a journal records everything | §5.2 unified Intent pipeline; engine/package separation |
| **Event Sourcing** (Fowler; Azure Architecture Center) | Event stream is authoritative, state is a projection; snapshots bound replay cost; append conflicts use optimistic concurrency | §5.5 EventLog + Snapshot + projection rebuild |
| **Zep / Graphiti** (Rasmussen et al. 2025) | A temporal knowledge graph records fact validity windows (valid_from / invalid_at); old facts are closed, not deleted, supporting "what is true now vs. what was true then" | §6.3 bi-temporal modeling of Relationship/Semantic memory |
| **LLM game-agent surveys** (2025–2026) | NPCs must meet hard real-time budgets; separating high-level cognition (LLM) from low-level control is practice consensus; safety against adversarial player input must be enforced inside the tool environment | §6.2 tiered cognition; §5.3 PolicyGate enforced kernel-side, not prompt-side |
| **Colyseus (framework) & MMO partitioning literature** (Bharambe et al. NSDI'06; zone/AOI practice) | Authoritative rooms + delta sync out of the box; games tolerate weak consistency and exhibit highly local reads/writes, so worlds scale by spatial partitioning; interest management (AOI) decides what each observer receives | §8 multiplayer model: world = room, observation = AOI, partition seams reserved |
| **vm2 CVE series** (2023–2026) | In-process JS sandboxes are not a security boundary | §7.3 all generated code runs in QuickJS-WASM (capability-based security) |
| **Hybrid routing research** | Routing simple requests to cheap models / rule systems cuts 37–46% of LLM usage | §6.2 Cognition Router |
| **ICU MessageFormat / CLDR** (industry standard) | Plural, gender, and select grammar varies per language and is a solved problem; never concatenate user-facing strings | §9 all authored text is ICU MessageFormat resources; formatting via built-in `Intl` |

---

## 3. Architecture Overview

```text
Agentic Sandbox Engine

  Simulation Kernel (authoritative, deterministic, zero LLM dependencies)
    Metamodel          generic schemas for entity/component/relation/action/rule/event
    World Store        ECS projection (bitECS) + spatial index
    Intent Pipeline    validate → adjudicate → execute → journal
    Rule VM            WASM sandbox executor for package rules
    EventLog           append-only event stream (Postgres / SQLite)
    Clock & Scheduler  ticks, scheduled tasks, time scaling
    Projection         world-state rebuild, snapshots, replay

  Cognition Plane (everything that burns tokens)
    Cognition Router   reflex / habit / deliberation tier routing
    Persona Runtime    NPC minds (observe → retrieve → decide → Intent)
    Arbiter            adjudicator of natural-language intents (Game Master)
    Director           pacing & drama event proposer
    Memory Service     memory stream + temporal knowledge graph + reflection
    Tool Registry      MCP server: kernel capabilities exposed as tools

  Builder Plane (genesis & evolution, offline / semi-offline)
    Genesis Agent      natural language → World Package
    Evolution Agent    change proposals → patch + migration
    Verifier           schema validation / sandboxed dry-run / self-verification
    Package Repo       git repository (revision = commit)

  Interface Plane (swappable presentation)
    Protocol           Colyseus room schema + semantic events
    Web Adapter        React + PixiJS v8
    CLI/Debug Adapter  replayer, event-stream viewer, trace browser
    Future Adapters    Unreal / Native / Mobile
```

Dependency law (the only architectural constraint that needs lint enforcement):

```text
Interface  → the Protocol types package (and nothing else)
Cognition  → the Kernel's MCP tools (and nothing else)
Builder    → the Kernel's validator/simulator tools + git
Kernel     → depends on no upper layer; never imports any LLM SDK
Content    → loaded by the Kernel; read/written by the Builder; contains no trusted code
```

A deliberate decision: **Cognition and Builder are not kernel submodules.** The kernel must be able to run entirely without LLMs (replays, tests, deterministic simulation). This single cut is what guarantees that deterministic replay and unit tests never need to mock a model.

---

## 4. Metamodel

The kernel ships with, and only with, the following schemas, all defined in Zod (Zod v4 converts directly to JSON Schema, so the same definition serves runtime validation, LLM tool parameter schemas, and documentation generation):

```text
EntityType        { id, components: ComponentRef[], tags }
ComponentDef      { id, schema: ZodSchema, indexed?: bool }
RelationDef       { id, from, to, cardinality, schema? }      // first-class, not simulated via components
ActionDef         { id, actor, params: ZodSchema,
                    precondition: RuleRef[], effect: RuleRef[],
                    cost?, cooldown?, visibility }
RuleDef           { id, kind: 'condition'|'effect'|'trigger',
                    impl: WasmModuleRef | CelExpr }
EventDef          { id, schema: ZodSchema }                    // shape of domain events
SpaceDef          { id, topology: 'grid'|'graph'|'continuous' }
PersonaDef        { id, identity, drives, cognition: TierConfig,
                    observation: ScopeRule[] }                 // an NPC's factory settings
```

Genre objects are all data compositions:

```text
character = EntityType(components: [identity, position, inventory, ...])
quest     = EntityType(components: [objective, progress]) + trigger rules
faction   = EntityType + RelationDef(member_of, allied_with, ...)
```

Rule implementations (`RuleDef.impl`) have two channels: simple conditions use **CEL expressions** (declarative, statically analyzable, zero sandbox overhead); complex logic uses **WASM modules** (TS generated by the Builder, compiled/bundled into QuickJS-WASM executables). Both are pure functions: `(world_view, params) -> effects[]`, no IO allowed.

---

## 5. Simulation Kernel

### 5.1 World Store

The ECS projection layer uses bitECS: entities are numeric IDs, component stores have free shapes (fitting package-defined dynamic components), queries are systems. The spatial index (grid/graph) hangs beside the World Store, shared by visibility culling and AOI (§8.3). The World Store is a **pure projection** — it can be discarded at any moment and fully rebuilt from the latest snapshot + event replay.

### 5.2 Intent Pipeline (the unified action pipeline)

Players, NPCs, the Director, and system scheduled tasks all submit the same thing:

```text
Intent {
  id, actor,                       // who (actor is an in-world entity, not a network connection)
  kind: 'action' | 'utterance',    // structured action or natural language
  action?: { def: ActionRef, params },   // kind = action
  text?:   string,                        // kind = utterance (free-form intent)
  client_seq, idempotency_key
}
```

The pipeline (single-threaded per world, deterministic, batched per tick):

```text
Intent
  → AuthGate        does the submitter have the right to play this actor (§8.2 identity model)
  → routing:
      action    → SchemaGate (Zod) → PolicyGate → Precondition (Rule VM)
      utterance → Arbiter (Cognition Plane, §5.4) → translated into action(s), re-enters pipeline
  → Effect execution (Rule VM, pure functions, producing effects[])
  → transactional application to the World Store
  → append EventLog (with causal chain: event.caused_by = intent.id)
  → projection update → Colyseus state patch pushed automatically (culled per observer)
```

Key property: **the utterance channel is the only entry point where an LLM participates in adjudication, and its output is still structured actions** — the LLM never directly produces effects. Replays can therefore skip the Arbiter (the events already record the actions it translated at the time), keeping the entire history deterministically replayable.

### 5.3 PolicyGate

Constraints are hard-enforced kernel-side, never relying on prompt compliance (surveys note that game agents face adversarial player input; prompt-level safety will inevitably be bypassed):

```text
- Visibility: an actor may only reference entities inside its observation scope
- Budget: per-actor action frequency / resource caps (in multiplayer this doubles
  as anti-spam/anti-cheat)
- Information walls: world facts not yet unlocked never appear in any Observation
  (spoiler protection at the data layer)
- Consistency: effects may only write components declared by the ActionDef (least privilege)
```

### 5.4 Arbiter

We adopt Concordia's Game Master pattern but narrow its authority: Concordia's GM narrates world outcomes directly; our Arbiter only does **translation and adjudication**. Its output is still structured actions plus a piece of narrative text (journaled as a `narration` event); world outcomes are executed by the Rule VM.

```text
utterance("I throw my torch into the barn")
  → Arbiter retrieves: actor state, visible entities, available ActionDefs, relevant rule digests
  → emits one of three verdicts:
      translate: [throw(item:torch, target:barn), ignite(barn)]
      reject:    "You are not holding a torch" (citing the specific failed precondition)
      improvise: proposes an ephemeral ActionDef → Builder fast path (§7.4)
```

`improvise` is where generativity comes from: when the player does something the content package never defined, the system does not refuse — it triggers a micro-genesis.

### 5.5 EventLog and Time

```text
Event { world_id, seq, tick, type: EventRef, payload,
        actor?, caused_by?, revision }
```

Storage is one append-only Postgres table (SQLite in local single-player mode). No Kafka/EventStoreDB — single-world event volume doesn't justify it; swap later behind the same interface if scale demands. Standard Event Sourcing companions: a **Snapshot** every N ticks and before each migration (serialized World Store + current revision); projection rebuild = latest snapshot + replay of subsequent events; concurrent appends use stream-version optimistic concurrency.

Clock: the kernel tick is a logical clock (default 1 tick = 1 in-game minute, scalable). All Scheduler tasks, cooldowns, and memory timestamps reference ticks, never wall-clock — the precondition for deterministic replay. The time policy (pausable / persistent / on-demand) is world configuration, not an engine assumption; see §8.4.

---

## 6. Cognition Plane

### 6.1 Componentized Minds

Following Concordia's componentization: a Persona is not one prompt but an assembly of cognitive components (Identity, Drives, Observation, RecentMemory, Plan, SocialContext, ...). Each component independently produces a context fragment; an assembler composes them into the decision prompt. Components are reusable across content packages — the other half of "generality."

### 6.2 Cognition Router (three tiers)

```text
Tier 0  Reflex (every tick, 0 tokens)
        Utility scoring / behavior trees: movement, patrols, daily routines,
        standard responses to known stimuli. Implemented as package CEL rules
        + the kernel Scheduler.

Tier 1  Habit (seconds, small model)
        Templated decisions: greetings, haggling, simple emotional reactions.
        A small model (Haiku/4o-mini class) + compact context; output constrained
        by action schemas.

Tier 2  Deliberation (event-triggered, large model)
        Triggers: important events (importance score above threshold), direct
        player interaction, plan expiry, Director nomination. Full pipeline:
        observe → retrieve memory → (maybe reflect) → plan → propose Intent
```

The router itself is deterministic rules (stimulus importance × relationship closeness × remaining budget), not yet another LLM. Degradation policy: when budgets are exhausted, Tier 2 falls to Tier 1, Tier 1 falls to Tier 0 — the world never stalls because of API rate limits.

### 6.3 Memory Service

Three stores, each taking an off-the-shelf approach:

```text
Episodic   Memory stream (the original Generative Agents structure)
           Storage: Postgres + pgvector
           Retrieval: score = α·recency + β·importance + γ·relevance
                      (the paper's original recipe — a few dozen lines of SQL,
                      no framework needed)
           Reflection: scheduled job; takes recent high-score memories → LLM
                       distills high-level insights → written back into the stream

Relational Temporal knowledge graph (the Graphiti/Zep bi-temporal pattern)
           Fact = edge { from, to, predicate, valid_from, invalid_at }
           Updates close old edges rather than deleting → can answer both
           "now" and "back then"
           Implementation: a Postgres adjacency table to start; switch to
           managed Zep or a Graphiti service at scale

Design     World-design memory (Builder only): why a rule is the way it is,
           what the player wished for — lives in the git repo's commit messages
           + docs/; no separate system.
```

Note: **the EventLog is the authoritative history; Memory is cognitive material** (forgettable, fallible, subjective). An NPC misremembering is a feature, not a bug — but adjudication always consults the EventLog.

### 6.4 Director

The Director is a low-frequency Persona variant whose duty is pacing, not truth: it observes global event density, player behavior patterns, and untriggered narrative hooks, and its output is likewise only Intents (`spawn_event`, `nudge_persona`, `schedule_encounter`) going through the same adjudication pipeline. It has zero privileges — which makes "drama" just ordinary, replayable, auditable events.

### 6.5 Tool Registry (MCP)

Kernel capabilities are exposed as one MCP server; tool schemas are generated directly from the Metamodel's Zod definitions:

```text
runtime:  observe(scope) / query_entity / list_affordances(actor)
          submit_intent / read_events(filter)
memory:   recall(query) / relations(entity, at_tick?) / write_reflection
builder:  inspect_package / validate / simulate(scenario) /
          propose_patch / plan_migration / explain_diff
```

Why MCP over a custom tool protocol: whatever agent SDK the Cognition plane uses (Vercel AI SDK / OpenAI Agents / Claude Agent SDK), it can consume MCP; future third-party agents (players bringing their own NPCs) get standard auth and transport; any MCP inspector works for debugging.

---

## 7. Builder Plane

### 7.1 Shape

The Builder is not a runtime service; it is a **coding agent operating on a git repository**. A World Package *is* a git repo; a revision *is* a commit; branches, diffs, reverts, blame, and tags all come free from git. The embedded implementation uses isomorphic-git (pure JS, runs in browser and Node).

```text
world-package/                      (= git repo)
  manifest.json                     name, engine version range, entry, sourceLocale
  metamodel/                        EntityType / Component / Relation definitions (JSON + Zod)
  actions/  rules/  events/         rule definitions; complex rules ship TS source + compiled wasm
  personas/                         PersonaDef + cognitive component assemblies
  spaces/                           maps / topology
  locales/                          ICU MessageFormat resources per BCP 47 tag (§9)
  seed/                             initial world event sequence (genesis is events!)
  skills/                           Builder skill library (Voyager-style, reusable across packages)
  migrations/                       0007_add_hunger_component.ts ...
  tests/                            scenario simulation assertions
  docs/                             design intent (Design Memory)
```

An elegant detail: `seed/` is not a JSON dump of world state but **a genesis event sequence**. New world = empty World Store + replay of seed events. Genesis and runtime use the same pipeline — one less special case.

### 7.2 Generation Loop (the Voyager pattern)

```text
Player wish (natural language)
  → Genesis/Evolution Agent drafts a patch (metamodel changes + rule code + tests
    + sourceLocale strings)
  → Verifier:
      1. Schema validation (Zod)
      2. Static checks (rule purity, least-privilege component writes,
         no hardcoded user-facing strings — §9)
      3. Sandboxed compile & execute (QuickJS-WASM)
      4. Dry-run simulation: replay recent events on a forked world copy + run tests/
      5. Self-verification: the agent checks whether the simulation output satisfies
         the wish (Voyager's self-verification)
  → On failure: errors and simulation feedback are fed back into the prompt; iterate
    (Voyager's iterative prompting)
  → On success: git commit + MigrationPlan generated → confirmation → kernel runs the migration
```

Validated rule patterns settle into `skills/` (economy skeletons, reputation systems, day/night routines, ...); future generation composes existing skills before writing from scratch — a direct application of Voyager's "skills are composable, transferable, and mitigate catastrophic forgetting," and the seed of a content ecosystem.

### 7.3 Sandbox

All generated code executes in quickjs-emscripten (QuickJS compiled to WASM): capability-based security, no host IO, CPU/memory quotas; the host injects only a read-only world_view and an effects collector. Explicitly not vm2/node:vm (repeatedly falsified), and not per-rule OS containers (too heavy per rule; if the Builder's overall coding session runs in a Claude Agent SDK / OpenAI Agents managed sandbox, that's a separate concern).

### 7.4 Migration

Borrow the mature mental model of database migrations (Umzug style): a migration is an `up(world)` pure-function file, executed in order and exactly once per world; an automatic snapshot precedes execution; on failure, roll back to the snapshot; the result is journaled (`migration_applied` event with from/to commit hashes). The Arbiter's `improvise` fast path runs a trimmed version of the same loop: ephemeral ActionDefs are tagged `ephemeral`; after the session, the Evolution Agent decides to promote (commit) or discard.

---

## 8. Multiplayer Model (built in from day one)

The core answer first: **this architecture needs no multiplayer rework, but six decisions must be made correctly on day one** — they are brutally expensive to retrofit and nearly free to get right up front. The three hardest things to retrofit into a multiplayer game (server authority, per-observer culled views, a serializable input pipeline) are already base assumptions here: authoritative server + proposal/adjudication separation (P2) eliminates the client cheating surface; Colyseus's room model and delta sync are inherently multi-client; event sourcing provides exactly the auditing and dispute arbitration a shared world needs. The MMO literature (Colyseus, NSDI'06) adds that game state reads/writes are highly local and tolerate weak consistency — so scaling is **spatial partitioning**, not distributed consensus, and we only need to reserve the seams.

These six decisions go into day-one code:

### 8.1 world = room; the room is a host, not the world

One world instance maps to one Colyseus Room; the Room process runs one kernel instance. **The Room is a short-lived host; the world is a persistent event stream**: on start, the Room hydrates the world from snapshot + EventLog; with nobody online it sleeps or ticks at low frequency per the time policy (§8.4); destroying the Room loses nothing. Colyseus's horizontal scaling model — each Room belongs to a single process, processes coordinate matchmaking via Redis — aligns perfectly with "one single-threaded deterministic kernel per world": **zero concurrency inside a world, unbounded parallelism across worlds**. This also answers capacity: more worlds = more Rooms = more processes; no distributed kernel needed.

### 8.2 Identity in three layers: Account ≠ Player ≠ Actor

Single-player thinking says "the player is the character"; multiplayer must split:

```text
Account   authentication identity (auth layer: Colyseus auth module / any IdP)
Player    a participant profile in a given world (permissions, budgets, ownership, locale)
Actor     an in-world entity (a character). A Player plays an Actor through a
          possession relation; can switch bodies, can possess zero (spectating);
          on disconnect the Actor falls back to Tier-0 control
```

`Intent.actor` references an Actor; the AuthGate verifies "does the Player behind this connection currently possess this Actor." This split incidentally solves reconnection (Colyseus supports reconnect natively; the Actor is handed back seamlessly), spectating, GM possession for debugging, and the future "players bring their own agent to play their character."

### 8.3 Observation is interest management (AOI)

In single-player, per-observer view culling is spoiler protection; in multiplayer the same mechanism is AOI / interest management — each client receives only state deltas inside its view, which is both a bandwidth and an anti-cheat concern (invisible data is simply never sent). Three layers share one `ObservationScope` implementation (spatial range × relational range × information walls):

```text
PolicyGate            uses it to constrain what an Intent may reference (kernel side)
Persona               uses it to build NPC Observations (cognition side)
Colyseus StateView    uses it to cull each client's state sync (protocol side)
```

Make it a first-class kernel concept on day one, not a render-layer filter — this is the **single most important** multiplayer-compatibility item, because retrofitting "full-state sync" into "per-observer sync" amounts to rewriting the sync layer.

### 8.4 Time policy is world configuration

A single-player world may pause; a shared world cannot freeze because one player shut their laptop. Time policy is manifest configuration, not an engine assumption:

```text
time_policy:
  pausable      single-player / co-op save-file style: pause when nobody is online (default)
  persistent    persistent world: low-frequency ticks when empty (NPCs keep living,
                Director throttled)
  on_demand     lazy catch-up: on Room hydration, fast-forward the offline ticks
```

`on_demand` is feasible precisely because the kernel is deterministic and LLM-free: offline catch-up runs only Tier-0 reflexes and scheduled tasks — the world "keeps turning" without burning tokens.

### 8.5 The Builder under multiplayer: from command to proposal

In single-player, the player is the creator-god; in a shared world, "I want to add a hunger system" is a **governance question**. Reuse existing mechanisms; build nothing new:

```text
- World-modification rights are a permission bit on Player (owner / builder / visitor)
- The Evolution Agent's output is already a git branch + patch
  → under multiplayer this is simply a Pull Request: owner approval merges and
    triggers the migration
- Migrations need a downtime window: Room broadcasts a countdown → snapshot →
  migrate → resume
  (event sourcing makes rollback = return to snapshot; disputes are always arbitrable)
- The Arbiter's improvise degrades in shared worlds to ephemeral-only actions;
  promotion must go through the PR flow
```

### 8.6 Partition seams: reserve now, use later

Per-world player count is bounded by single-process kernel throughput. Beyond that, the scaling path is the standard MMO answer: spatially split the world into zones, one Room/kernel shard per zone, cross-zone interaction via events (entity migration = source zone emits `entity_departed`, target zone emits `entity_arrived` — two ordinary events). **We do not implement partitioning now, but three day-one disciplines turn it into incremental work instead of a rewrite:**

```text
1. Global IDs: entity/event IDs are ULIDs; no ID ever encodes a "which process" assumption
2. Self-contained events: every Event carries world_id (zone_id later); payloads contain
   no in-memory references
3. Rule locality: RuleDefs declare their read/write footprint (§5.3 already requires
   least privilege), so whether a rule crosses zones is statically decidable —
   cross-zone rules route to a coordinator later
```

The LLM side has no partitioning problem: the Cognition Plane is already a stateless external caller, horizontally scalable by nature. The only new multiplayer constraint is that **token budgets refine from "per world" to "per Player / per Persona pool"** (the PolicyGate already has budget gates; this just adds one dimension).

### 8.7 Conclusion

The genuinely additional design = §8.2 identity layers + §8.4 time policy + §8.5 governance flow — all three are thin. Every other multiplayer capability (authority, sync, view culling, audit, scale-out) is a free by-product of decisions already made. **The only real discipline: no code may ever assume "the world has exactly one observer" or "the observer is always online."** Put that one line in the code-review checklist.

---

## 9. Internationalization (i18n)

A text-heavy AI-native engine cannot bolt i18n on later: generated prose, authored content, and UI chrome each need a different strategy, and the event log makes language choices permanent. Day-one principle (P8): **the kernel is language-blind** — no human-language string ever participates in adjudication, identity, or rules.

### 9.1 Three kinds of text, three strategies

```text
Authored content text   (entity names, descriptions, quest prose, action labels)
  → Resource keys + ICU MessageFormat files per BCP 47 tag in the package's
    locales/ directory. Components never store display strings; they store
    LocalizedText = { key, params? }. Resolution happens at the edge
    (presentation or prompt assembly), never in the kernel.

Generated text          (Arbiter narration, NPC dialogue, Director flavor)
  → Produced at runtime in a target locale and recorded in the EventLog as
    { text, lang } with a BCP 47 tag. The log keeps what was actually said —
    replay shows history verbatim. Translations for other recipients are
    DERIVED data (cacheable per (event, locale), produced by a Tier-1 small
    model), never new events.

UI chrome               (buttons, panels, debug tools)
  → Standard app-level i18n: i18next + i18next-icu in the Interface Plane.
    Entirely outside the engine's concern.
```

### 9.2 Locale model

```text
- manifest.sourceLocale     the language the package was authored in (the only
                            locale guaranteed complete)
- Player.locale             per-player preference (lives on the Player profile, §8.2)
- Fallback chain            player locale → package sourceLocale → 'en'
- Generation policy         text addressed to a single recipient is generated in
                            that recipient's locale; ambient/world narration is
                            generated in sourceLocale and translated per recipient
                            at delivery time
```

In mixed-locale multiplayer, dialogue between players is their own text (lang-tagged as typed); an NPC addressing multiple players generates once in sourceLocale and per-recipient translations are derived at the edge.

### 9.3 Rules that keep the kernel language-blind

```text
- IDs, keys, EventDef types, component names: never localized, never translated
- CEL expressions and Rule VM code never read or compare localized strings
- Sorting/collation of display text uses Intl.Collator in presentation only
- Plural/gender/select grammar lives in ICU messages, never in string
  concatenation; numbers/dates/relative time use the built-in Intl APIs (CLDR)
- A hardcoded user-facing string literal outside locales/ or UI resource files
  is a lint error (eslint-plugin-i18next no-literal-string)
```

### 9.4 The Builder and translation

The Genesis/Evolution Agent authors strings only in `sourceLocale`. Translation is itself a Builder skill: an LLM translation pass produces additional locale files, verified mechanically (ICU placeholder/plural-category preservation, key parity with sourceLocale) plus an LLM back-translation spot check, and lands through the same git commit flow as any other patch. Missing keys in a non-source locale fall back per §9.2 and are reported as package warnings, never runtime crashes.

### 9.5 Don't reinvent

ICU MessageFormat (plural/gender/select), CLDR via the built-in `Intl` API (PluralRules, NumberFormat, DateTimeFormat, RelativeTimeFormat, Collator), BCP 47 tags, the i18next ecosystem (with i18next-icu) for the Web Adapter, eslint-plugin-i18next for hardcoded-string lint. The only in-house piece is the thin `LocalizedText` type in the metamodel and the resolution fallback chain.

---

## 10. Interface Plane

### 10.1 Protocol = Colyseus + semantic events

Transport and sync are delegated wholesale to Colyseus: server authority, `@colyseus/schema` binary delta sync, room-as-world-instance, built-in matchmaking/reconnect and horizontal scaling, client SDKs covering JS/Unity/Godot/Defold and more — the cost of a future Unreal/Native adapter drops from "implement a protocol" to "use an existing SDK."

The engine defines only the semantic layer:

```text
RoomState (Colyseus schema, auto-synced)
  ├─ entities: Map<id, EntityView>     // projection culled per observer (StateView)
  ├─ space: SpaceView
  └─ tick, revision

Messages (explicit send/receive)
  client → server:  Intent
  server → client:  SemanticEvent      // narration / dialogue / fx hint (lang-tagged, §9)
                    InteractionPrompt  // the current actor's affordances
                    DebugTrace         // dev mode: decision chains
```

Visibility filtering (each player sees differently) uses Colyseus StateView; information walls are culled server-side, not hidden client-side. Clients may do visual prediction (interpolation, anticipatory animation) but never local adjudication.

### 10.2 Web Adapter

```text
React 19 + TypeScript + Vite     UI shell, panels, revision history (renders git log directly)
PixiJS v8                        world rendering: tiles/chunks, sprite batching,
                                 viewport culling, camera
@colyseus/sdk                    connection, state callbacks
Zustand                          client-local UI state (server state belongs to
                                 Colyseus; never duplicated)
TanStack Query                   non-realtime data (package browsing, history queries)
i18next + react-i18next + i18next-icu   UI chrome localization (§9)
```

The CLI/Debug Adapter is second priority (ahead of any native client): event-stream tail, replay controller, Persona decision-trace browser. Half of an event-sourced system's developer experience lives in this tool.

---

## 11. Technology Selection

| Layer | Choice | Rationale | Alternative / when to switch |
|---|---|---|---|
| Language/runtime | TypeScript + Node 22 LTS | Full-stack isomorphic; thickest Cognition/Builder ecosystem | Bun (when stable); hot paths sink to Rust→WASM |
| ECS / World Store | **bitECS v0.4** | Minimal, data-oriented, free-shaped component stores (fits the dynamic metamodel), built-in serialization | miniplex (if DX outweighs throughput) |
| Schema | **Zod v4** | One definition → runtime validation + JSON Schema (for LLM tools) + TS types | — |
| Declarative rules | **CEL** (cel-js) | Google-validated safe expression language; statically analyzable, non-looping | json-logic (simpler but weaker) |
| Generated-code sandbox | **quickjs-emscripten** | WASM capability-based isolation; the vm2 path is CVE-falsified | V8 isolate pools at server scale |
| Event store | **Postgres** (append-only table) / local SQLite | Single-world volume suffices; easy optimistic concurrency; one less component | Kurrent/EventStoreDB (multi-world high throughput) |
| Vectors/memory | **pgvector** + three-factor scoring (in-house, ~100 lines) | The paper's recipe is simple; don't import a framework for a simple need | Relational memory at scale → Zep / Graphiti service |
| Relational data | Drizzle ORM | Light, SQL-transparent | Prisma |
| LLM access | **Vercel AI SDK v5** | TS-native, 25+ provider portability, first-class streaming/tool calling | Single-vendor lock-in: OpenAI Agents SDK JS or Claude Agent SDK |
| Builder coding agent | **Claude Agent SDK** (or OpenAI Agents SDK + managed sandbox) | Off-the-shelf "coding agent operating on a repo" runtime; no homemade harness | OpenHands (self-host preference) |
| Orchestration | No LangGraph (default) | Our "graph" is the Intent pipeline itself; optional module only if the Builder needs resumable long-horizon human-in-the-loop flows | LangGraph JS |
| Tool protocol | **MCP** | Universal across agent SDKs; ecosystem tooling (inspectors) for free | — |
| Realtime sync/rooms | **Colyseus 0.16** | Authoritative rooms + schema delta sync + StateView + matchmaking/reconnect + Redis scale-out + multi-platform SDKs | PartyKit/DO (edge preference); homemade (never) |
| Auth | Colyseus auth module + any IdP (OIDC) | The three-layer identity model (§8.2) relies only on standard claims | — |
| HTTP API | Hono | Light, web-standard, runs on any runtime | Fastify |
| i18n | **ICU MessageFormat + built-in Intl (CLDR) + i18next/i18next-icu**; eslint-plugin-i18next | Industry standards end to end; in-house surface is only LocalizedText + fallback chain (§9) | FormatJS stack (equivalent; pick one, don't mix) |
| Version/branch/diff | **git** (isomorphic-git) | Everything a revision system needs, natively; multiplayer governance = PR flow | — |
| Migrations | Umzug pattern (own runner, ~200 lines) | Database-migration mental model transfers directly | — |
| Rendering | PixiJS v8 + React 19 | Mature; batching and viewport culling cover 2D sandbox needs | — |
| Observability | **OpenTelemetry** (GenAI semantic conventions) + **Langfuse** | Traces span the Intent pipeline and LLM calls; cost attribution to Persona/Player | — |
| Object storage | S3-compatible (snapshots, replays, assets) | — | — |

---

## 12. Repository Shape

```text
engine/
  packages/
    metamodel/        Zod definitions & types (the only package everyone depends on)
    kernel/           World Store, Intent Pipeline, Rule VM, EventLog, Clock
    protocol/         Colyseus schemas + message types (the Interface's only visible surface)
    cognition/        Router, Persona Runtime, Arbiter, Director, Memory
    builder/          Genesis/Evolution Agent, Verifier, migration runner
    mcp-server/       kernel tools exposed via MCP
    server/           assembly: Colyseus rooms + Hono + persistence + identity
  apps/
    web/              React + PixiJS adapter
    cli/              replayer, event tail, trace browser
  content/
    packages/         world packages (each its own git repo, referenced via subtree/submodule)
    skills/           cross-package Builder skill library
  docs/
```

Dependency lint (enforced with dependency-cruiser): `kernel` may not import anything above it; `apps/*` may only import `protocol`.

---

## 13. Roadmap

```text
M0  Kernel loop (no LLM): metamodel + Intent pipeline + EventLog + replay + CLI
    Acceptance: a pure rule-driven toy world; the event stream replays
    deterministically, bit-identical.
    Multiplayer & i18n disciplines take effect here: ObservationScope,
    three-layer identity, ULIDs, time_policy interface, LocalizedText.

M1  Single Persona: tiered cognition + memory stream + MCP tools; Colyseus
    + minimal web rendering.
    Acceptance: one NPC lives a believable day in a small town
    (the Generative Agents interview methodology).

M2  Arbiter: the utterance channel; free-text intents translated/rejected/improvised.
    Acceptance: of 10 player actions the package never defined, ≥7 get
    reasonable adjudication.

M3  Builder: wish → patch → verification loop → git commit → migration.
    Acceptance: add a "hunger system" to a running world in natural language;
    old saves migrate losslessly.

M4  Multiplayer on: a second Player joins the same world + possession +
    builder PR governance.
    Acceptance: two players' views leak nothing to each other; the world follows
    time_policy when one goes offline; the owner approves one world change and
    a migration with a downtime window completes.

M5  Director + skill-library consolidation + persistent worlds (persistent
    time_policy) + localized content packages (a second locale shipped through
    the Builder translation skill).
```

Every milestone's acceptance criteria are deliberately auto-evaluable by agents — so the engine's own iteration can be handed to a Builder-style loop.

---

## 14. Stable Contracts (Invariants)

```text
Truth:       Only the Kernel writes state; the EventLog is the sole authoritative
             history; WorldState is a projection.
Symmetry:    Players, NPCs, the Director, and the Builder submit the same Intent
             through the same pipeline.
Translation: LLMs only translate intents into structured actions; they never
             produce effects directly.
Distrust:    Generated code = untrusted input; sandbox + dry-run + self-verification
             is the only path into a package.
Tiering:     Tokens are spent only at Tier 2; any model failure makes the world
             dumber, never stops it.
Content:     Genre is data; packages are git repos; genesis is events; migrations
             run exactly once.
Boundaries:  Presentation sees only the Protocol; Cognition sees only Tools;
             the Kernel sees no LLM SDK.
Multiplayer: Single-threaded within a world, parallel across worlds; no code may
             assume a single or always-online observer; view culling by
             ObservationScope is a kernel duty, not a render duty.
Language:    The kernel is language-blind; authored text is keys + ICU resources;
             generated text is lang-tagged in the log; translations are derived
             data, never events.
```
