#!/usr/bin/env bash
# Ralph - RBP Autonomous Execution Loop
# Thin wrapper for TypeScript implementation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v bun &>/dev/null; then
  echo "Error: bun is required but not installed." >&2
  echo "Install bun: https://bun.sh/docs/installation" >&2
  exit 1
fi

exec bun "$SCRIPT_DIR/lib/dist/index.js" "$@"
