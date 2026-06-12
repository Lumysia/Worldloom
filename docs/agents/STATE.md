# STATE — Agentic Sandbox Engine Implementation Ledger

> This file is the project's externalized memory. Only the orchestrator may
> write it. Tracked by git. Every agent's new session starts by reading this
> file.

## Task Ledger

| Task | Status | Review rounds | Commit | Notes |
|---|---|---|---|---|
| T01 | done | 1 | 955964d | Released with reviewer approval; no debt |
| T02 | pending | - | - | |
| T03 | pending | - | - | |
| T04 | pending | - | - | Q1 settled in spec §7 |
| T05 | pending | - | - | Q2 settled in spec §7 |
| T06 | pending | - | - | Q3 settled in spec §7 |
| T07 | pending | - | - | |
| T08 | pending | - | - | |
| T09 | pending | - | - | |
| T10 | pending | - | - | |
| T11 | pending | - | - | M0 final acceptance; Q4 settled in spec §7 |

Status values: pending / in_progress / review / done / blocked

## Decisions (human rulings)

<!-- Format: Qn [date] one-line ruling -->

Q1 [2026-06-12] Relations use a dedicated RelationStore inside the World Store, not bitECS component-pair simulation.
Q2 [2026-06-12] CEL exposes exactly get, has, related, hasRelation, distance, actor, param, tick; all access is ObservationScope-bounded and fail-closed.
Q3 [2026-06-12] infoWall keys use <packageId>.<domain>.<name>, lowercase kebab-case dot-separated segments; kernel. is reserved.
Q4 [2026-06-12] Locale resources use locales/<bcp47>/<domain>.json; loader merges domains and key collisions are validation errors.

## Blocked

(none yet)

## Debt (minor/nit items left by reviews)

<!-- Format: T05 [minor] pipeline/gates.ts:88 naming — to be repaid -->

(none yet)
