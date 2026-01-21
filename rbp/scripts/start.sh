#!/usr/bin/env bash
# start.sh - Entry point for RBP autonomous loop
# Usage: ./start.sh [max-iterations]
#
# This is the ONLY entry point you need. Just run:
#   ./scripts/rbp/start.sh
#
# Modes:
#   BMAD: Uses sprint-status.yaml + epic branch. Ralph handles full workflow
#         (create-story → dev-story → code-review) with RBP test gates.
#   Beads: Uses .beads/ for task tracking. Setup from quick-plan specs.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ITERATIONS="${1:-50}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "$@"; }
log_info() { log "${CYAN}[RBP]${NC} $*"; }
log_warn() { log "${YELLOW}[RBP]${NC} $*"; }
log_error() { log "${RED}[RBP]${NC} $*"; }
log_success() { log "${GREEN}[RBP]${NC} $*"; }

# Find project root
find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    # Check for BMAD or Beads markers
    if [ -d "$dir/.beads" ] || [ -d "$dir/docs/bmm" ] || [ -d "$dir/_bmad" ]; then
      echo "$dir"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  echo "$PWD"
}

PROJECT_ROOT=$(find_project_root)
cd "$PROJECT_ROOT"

# Detect mode: bmad (sprint-status + epic branch) or beads
detect_mode() {
  # Check for BMAD: sprint-status.yaml + epic-N branch
  local branch=$(git branch --show-current 2>/dev/null || echo "")
  local has_sprint_status=false

  for path in "docs/bmm/sprint-status.yaml" "docs/bmm/implementation-artifacts/sprint-status.yaml" "_bmad/sprint-status.yaml" "sprint-status.yaml"; do
    [ -f "$PROJECT_ROOT/$path" ] && has_sprint_status=true && break
  done

  if [ "$has_sprint_status" = "true" ] && [[ "$branch" =~ ^epic-[0-9]+ ]]; then
    echo "bmad"
    return
  fi

  # Check for Beads
  if [ -d "$PROJECT_ROOT/.beads" ]; then
    echo "beads"
    return
  fi

  # Check for quick-plan specs (will use beads)
  if ls specs/*.md 2>/dev/null | xargs grep -l "RBP-TASKS-START" &>/dev/null 2>/dev/null; then
    echo "quickplan"
    return
  fi

  echo "unknown"
}

# Check prerequisites based on mode
check_prereqs() {
  local mode="$1"
  local missing=()

  command -v claude &>/dev/null || missing+=("claude")
  command -v bun &>/dev/null || missing+=("bun")

  [ "$mode" = "beads" ] || [ "$mode" = "quickplan" ] && {
    command -v bd &>/dev/null || missing+=("bd")
  }

  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing: ${missing[*]}"
    exit 1
  fi
}

# Check for existing beads tasks
has_beads_tasks() {
  command -v bd &>/dev/null || return 1
  local ready=$(bd ready --json --limit 1 2>/dev/null || echo "[]")
  [ "$ready" != "[]" ] && [ -n "$ready" ]
}

# Find and parse quickplan spec
setup_quickplan() {
  log_info "Looking for quick-plan spec..."
  local spec_file=$(ls specs/*.md 2>/dev/null | xargs grep -l "RBP-TASKS-START" 2>/dev/null | head -1)

  if [ -z "$spec_file" ]; then
    log_error "No actionable spec found"
    exit 1
  fi

  log_info "Found spec: $spec_file"
  "$SCRIPT_DIR/parse-spec-to-beads.sh" "$spec_file"
}

# Main flow
main() {
  local mode=$(detect_mode)

  log_info "═══════════════════════════════════════════════════════"
  log_info "  RBP Autonomous Loop"
  log_info "  Project: $PROJECT_ROOT"
  log_info "  Mode: $mode"
  log_info "═══════════════════════════════════════════════════════"

  check_prereqs "$mode"

  case "$mode" in
    bmad)
      # BMAD mode: ralph.sh handles everything (create-story, dev-story, code-review)
      log_info "BMAD mode detected. Ralph will orchestrate workflows."
      ;;

    beads)
      # Beads mode: check for tasks, run ralph
      if ! has_beads_tasks; then
        log_warn "No tasks in beads. Run 'bd create' or add a quick-plan spec."
        exit 1
      fi
      log_info "Tasks found in beads."
      ;;

    quickplan)
      # Quick-plan mode: setup beads from spec if needed
      if ! has_beads_tasks; then
        setup_quickplan
      else
        log_info "Tasks found in beads."
      fi
      ;;

    *)
      log_error "Unknown project type."
      log_error "Expected one of:"
      log_error "  - BMAD: sprint-status.yaml + epic-N branch"
      log_error "  - Beads: .beads/ directory"
      log_error "  - Quick-plan: specs/*.md with RBP-TASKS-START"
      exit 1
      ;;
  esac

  # Run ralph loop (handles both BMAD and Beads modes)
  log_info "Starting ralph loop (max $MAX_ITERATIONS iterations)..."
  exec "$SCRIPT_DIR/ralph.sh" "$MAX_ITERATIONS"
}

# Handle args
case "${1:-}" in
  --help|-h)
    echo "Usage: ./start.sh [max-iterations]"
    echo ""
    echo "Entry point for RBP autonomous loop."
    echo ""
    echo "Modes (auto-detected):"
    echo "  BMAD      - sprint-status.yaml + epic-N branch"
    echo "              Ralph orchestrates: create-story → dev-story → code-review"
    echo "  Beads     - .beads/ directory with existing tasks"
    echo "  Quick-plan - specs/*.md with RBP-TASKS-START marker"
    echo ""
    echo "Just run it. It figures out what to do."
    exit 0
    ;;
  *)
    main
    ;;
esac
