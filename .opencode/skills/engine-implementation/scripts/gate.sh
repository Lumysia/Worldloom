#!/usr/bin/env bash
# gate.sh — quality gate. GATE_RESULT: PASS only when all gates are green.
# This file is a T01 artifact; no later task card may modify it.
set -uo pipefail

FAIL=0
step() {
  local name="$1"; shift
  echo "──── GATE: ${name} ────"
  if "$@"; then
    echo "GATE ${name}: ok"
  else
    echo "GATE ${name}: FAIL"
    FAIL=1
  fi
}

# 0. Dependencies ready (frozen lockfile — no drive-by dependency upgrades)
step install pnpm install --frozen-lockfile

# 1–4. The four gates
step lint       pnpm -w lint
step typecheck  pnpm -w typecheck
step depcruise  pnpm -w depcruise
step test       pnpm -w test -- --run

echo "════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "GATE_RESULT: PASS"
  exit 0
else
  echo "GATE_RESULT: FAIL"
  exit 1
fi
