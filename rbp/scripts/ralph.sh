#!/usr/bin/env bash
# Ralph - BMAD-aware autonomous execution loop with RBP gating
# Usage: ./ralph.sh [options] [max_iterations]
#
# Options:
#   --mode=bmad   Force BMAD mode (sprint-status.yaml)
#   --mode=beads  Force Beads mode (bd ready)
#   --help        Show this help message
#
# RBP Stack v2.1 - BMAD workflow integration
# - Reads story state from sprint-status.yaml
# - Invokes appropriate BMAD workflow (create-story, dev-story, code-review)
# - Uses RBP test-gated closure for verification
#
# Story State Machine:
#   backlog → create-story → drafted
#   drafted → (auto) → ready-for-dev
#   ready-for-dev → dev-story → in-progress
#   in-progress → (tests pass) → review
#   review → code-review → done (or back to in-progress if fails)

set -e

# Configuration defaults
MAX_ITERATIONS=50
FORCED_MODE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode=*)
      FORCED_MODE="${1#*=}"
      if [[ "$FORCED_MODE" != "bmad" && "$FORCED_MODE" != "beads" ]]; then
        echo "Error: --mode must be 'bmad' or 'beads'"
        exit 1
      fi
      shift
      ;;
    --max-iterations=*)
      MAX_ITERATIONS="${1#*=}"
      shift
      ;;
    --max-iterations)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --help|-h)
      head -n 20 "$0" | grep "^#" | sed 's/^# //'
      exit 0
      ;;
    *)
      # Assume positional argument is max_iterations
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      else
        echo "Error: Unknown argument '$1'"
        exit 1
      fi
      shift
      ;;
  esac
done
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RBP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Generate session ID for observability
RBP_SESSION_ID=$(uuidgen 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "ralph-$$-$(date +%s)")
export RBP_SESSION_ID

# Source event emitter for observability (optional, for backward compatibility)
# Note: emit-event.sh has been removed - observability is now handled by TS lib
if [ -f "$SCRIPT_DIR/emit-event.sh" ]; then
  source "$SCRIPT_DIR/emit-event.sh"
fi

# Auto-detect PROJECT_ROOT: prefer RBP_ROOT if it has beads (development mode),
# otherwise use parent directory (installed mode)
if [ -d "$RBP_ROOT/.beads" ]; then
  PROJECT_ROOT="$RBP_ROOT"
elif [ -d "$RBP_ROOT/../.beads" ]; then
  PROJECT_ROOT="$(cd "$RBP_ROOT/.." && pwd)"
else
  # No beads found - assume installed mode (parent directory)
  PROJECT_ROOT="$(cd "$RBP_ROOT/.." && pwd)"
fi

CONFIG_FILE="$PROJECT_ROOT/rbp-config.yaml"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"

# Load observability configuration
load_observability_config() {
  RBP_OBSERVABILITY_ENABLED="true"

  [ ! -f "$CONFIG_FILE" ] && return

  local value=""
  if command -v yq &>/dev/null; then
    value=$(yq -r '.observability.enabled // "true"' "$CONFIG_FILE" 2>/dev/null)
  elif command -v python3 &>/dev/null; then
    value=$(python3 -c "
import yaml
try:
    with open('$CONFIG_FILE') as f:
        cfg = yaml.safe_load(f)
    obs = cfg.get('observability', {})
    print('false' if obs.get('enabled') == False else 'true')
except: print('true')
" 2>/dev/null)
  elif grep -q 'enabled:[[:space:]]*false' "$CONFIG_FILE" 2>/dev/null; then
    value="false"
  fi

  # Note: Using || true to prevent set -e from exiting if value != "false"
  [ "$value" = "false" ] && RBP_OBSERVABILITY_ENABLED="false" || true
}

# Initialize observability
load_observability_config
export RBP_OBSERVABILITY_ENABLED

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print banner
print_banner() {
  echo -e "${CYAN}"
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║          Ralph - Autonomous Execution Loop                ║"
  echo "║                  RBP Stack v2.0                           ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

# Check prerequisites
check_prerequisites() {
  local missing=()
  local mode="${1:-auto}"

  command -v claude &>/dev/null || missing+=("claude (Claude Code CLI)")
  command -v bun &>/dev/null || missing+=("bun")

  # Mode-specific checks
  if [ "$mode" = "beads" ]; then
    command -v bd &>/dev/null || missing+=("bd (beads)")
  fi

  # jq is recommended for reliable JSON parsing (beads mode)
  if [ "$mode" = "beads" ] && ! command -v jq &>/dev/null; then
    echo -e "${YELLOW}WARNING: jq not found - JSON parsing may be unreliable${NC}"
    echo -e "${YELLOW}Install with: brew install jq${NC}"
    echo ""
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    echo -e "${RED}ERROR: Missing prerequisites:${NC}"
    for item in "${missing[@]}"; do
      echo -e "  - $item"
    done
    exit 1
  fi

  # Check beads initialization only for beads mode
  if [ "$mode" = "beads" ] && [ ! -d "$PROJECT_ROOT/.beads" ]; then
    echo -e "${RED}ERROR: Beads not initialized. Run 'bd init' first.${NC}"
    exit 1
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# BMAD Sprint Status Functions
# ═══════════════════════════════════════════════════════════════════════════════

SPRINT_STATUS_FILE=""
CURRENT_EPIC=""

# Find sprint-status.yaml
find_sprint_status() {
  for status_path in \
    "$PROJECT_ROOT/docs/bmm/sprint-status.yaml" \
    "$PROJECT_ROOT/docs/bmm/implementation-artifacts/sprint-status.yaml" \
    "$PROJECT_ROOT/_bmad/sprint-status.yaml" \
    "$PROJECT_ROOT/sprint-status.yaml"; do
    if [ -f "$status_path" ]; then
      SPRINT_STATUS_FILE="$status_path"
      return 0
    fi
  done
  return 1
}

# Detect current epic from git branch
detect_current_epic() {
  local branch=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "")
  if [[ "$branch" =~ ^epic-([0-9]+) ]]; then
    CURRENT_EPIC="${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

# Get story status from sprint-status.yaml
# Usage: get_story_status "4-9-bulk-import-csv"
get_story_status() {
  local story_key="$1"
  [ -z "$SPRINT_STATUS_FILE" ] && return
  grep -E "^[[:space:]]+${story_key}:" "$SPRINT_STATUS_FILE" 2>/dev/null | \
    sed 's/.*:[[:space:]]*//' | tr -d '[:space:]' | head -1
}

# Find next actionable story for current epic
# Returns: story_key:status (e.g., "4-9-bulk-import-csv:backlog")
# Priority: in-progress > review > ready-for-dev > drafted > backlog
find_next_actionable_story() {
  if [ -z "$SPRINT_STATUS_FILE" ] || [ -z "$CURRENT_EPIC" ]; then
    return
  fi

  local statuses=("in-progress" "review" "ready-for-dev" "drafted" "backlog")
  for status in "${statuses[@]}"; do
    local story_key
    story_key=$(grep -E "^[[:space:]]+${CURRENT_EPIC}-[0-9]+[^:]*:[[:space:]]*${status}" "$SPRINT_STATUS_FILE" 2>/dev/null | head -1 | sed 's/^[[:space:]]*//' | cut -d: -f1)
    if [ -n "$story_key" ]; then
      echo "${story_key}:${status}"
      return
    fi
  done
}

# Update story status in sprint-status.yaml
# Usage: update_story_status "4-9-bulk-import-csv" "in-progress"
update_story_status() {
  local story_key="$1"
  local new_status="$2"

  if [ -z "$SPRINT_STATUS_FILE" ]; then
    echo -e "${YELLOW}Warning: No sprint-status.yaml found, cannot update status${NC}"
    return 1
  fi

  # Use sed to update the status
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^\([[:space:]]*${story_key}:\)[[:space:]]*.*/\1 ${new_status}/" "$SPRINT_STATUS_FILE"
  else
    sed -i "s/^\([[:space:]]*${story_key}:\)[[:space:]]*.*/\1 ${new_status}/" "$SPRINT_STATUS_FILE"
  fi

  echo -e "${GREEN}Updated ${story_key} → ${new_status}${NC}"
  log_progress "Status update: ${story_key} → ${new_status}"
}

# Check if all stories for current epic are done
is_epic_complete() {
  if [ -z "$SPRINT_STATUS_FILE" ] || [ -z "$CURRENT_EPIC" ]; then
    return 1
  fi

  # Count non-done/non-skipped stories
  # Note: grep -c returns exit code 1 when count is 0, so we capture output and default separately
  local pending_count
  pending_count=$(grep -cE "^[[:space:]]+${CURRENT_EPIC}-[0-9]+[^:]*:[[:space:]]*(backlog|drafted|ready-for-dev|in-progress|review)" "$SPRINT_STATUS_FILE" 2>/dev/null || true)
  pending_count=${pending_count:-0}

  [ "$pending_count" -eq 0 ]
}

# Check if JSON array is empty (returns 0 if empty, 1 otherwise)
json_array_empty() {
  local json="$1"
  if command -v jq &>/dev/null; then
    local count
    count=$(echo "$json" | jq 'length' 2>/dev/null || echo "0")
    [ "${count:-0}" = "0" ]
  else
    local compact
    compact=$(echo "$json" | tr -d '[:space:]')
    [ "$compact" = "[]" ] || [ -z "$compact" ]
  fi
}

# Get next ready task from beads (using --json for reliable parsing)
get_next_task() {
  cd "$PROJECT_ROOT"
  local ready_json
  ready_json=$(bd ready --json --limit 1 2>/dev/null || echo "[]")

  json_array_empty "$ready_json" && return

  if command -v jq &>/dev/null; then
    echo "$ready_json" | jq -c '.[0]' 2>/dev/null
  else
    echo "$ready_json"
  fi
}

# Check if all tasks are complete
all_tasks_complete() {
  cd "$PROJECT_ROOT"
  local ready_json
  ready_json=$(bd ready --json 2>/dev/null || echo "[]")
  json_array_empty "$ready_json"
}

# Log progress
log_progress() {
  local message="$1"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] $message" >> "$PROGRESS_FILE"
}

# Initialize progress file
init_progress() {
  if [ ! -f "$PROGRESS_FILE" ]; then
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "Project: $PROJECT_ROOT" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# BMAD Workflow Execution
# ═══════════════════════════════════════════════════════════════════════════════

# Run BMAD create-story workflow
run_create_story() {
  local story_key="$1"
  echo -e "${CYAN}Running BMAD create-story workflow for ${story_key}...${NC}"
  log_progress "BMAD: create-story for $story_key"

  cd "$PROJECT_ROOT"
  if claude /bmad:bmm:workflows:create-story <<< "Create story ${story_key}"; then
    update_story_status "$story_key" "drafted"
    return 0
  else
    echo -e "${RED}create-story workflow failed${NC}"
    return 1
  fi
}

# Run BMAD dev-story workflow
run_dev_story() {
  local story_key="$1"
  echo -e "${CYAN}Running BMAD dev-story workflow for ${story_key}...${NC}"
  log_progress "BMAD: dev-story for $story_key"

  cd "$PROJECT_ROOT"
  if claude /bmad:bmm:workflows:dev-story <<< "Implement story ${story_key}"; then
    # After dev-story, run tests directly (test-gated closure)
    echo -e "${YELLOW}Running RBP test gate...${NC}"
    if bun test 2>/dev/null; then
      echo -e "${GREEN}Tests passed! Moving to review.${NC}"
      update_story_status "$story_key" "review"
    else
      echo -e "${YELLOW}Tests not passing yet. Story remains in-progress.${NC}"
      # Keep status as in-progress for next iteration
    fi
    return 0
  else
    echo -e "${RED}dev-story workflow failed${NC}"
    return 1
  fi
}

# Run BMAD code-review workflow
run_code_review() {
  local story_key="$1"
  echo -e "${CYAN}Running BMAD code-review workflow for ${story_key}...${NC}"
  log_progress "BMAD: code-review for $story_key"

  cd "$PROJECT_ROOT"
  local output
  output=$(claude /bmad:bmm:workflows:code-review <<< "Review story ${story_key}" 2>&1 | tee /dev/stderr) || true

  # Check if review passed (look for approval indicators)
  if echo "$output" | grep -qiE "(approved|passed|complete|done|lgtm|ship.?it)"; then
    echo -e "${GREEN}Code review passed! Story complete.${NC}"
    update_story_status "$story_key" "done"
    return 0
  else
    echo -e "${YELLOW}Code review found issues. Back to development.${NC}"
    update_story_status "$story_key" "in-progress"
    return 0
  fi
}

# Run single iteration (BMAD-aware)
run_iteration() {
  local iteration=$1

  echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  Ralph Iteration $iteration of $MAX_ITERATIONS${NC}"
  echo -e "${BLUE}  Epic: $CURRENT_EPIC${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

  # Find next actionable story from sprint-status.yaml
  local story_info=$(find_next_actionable_story)

  if [ -z "$story_info" ]; then
    echo -e "${GREEN}No actionable stories found.${NC}"
    return 1
  fi

  local story_key=$(echo "$story_info" | cut -d: -f1)
  local story_status=$(echo "$story_info" | cut -d: -f2)

  echo -e "${CYAN}Current Story:${NC} $story_key"
  echo -e "${CYAN}Status:${NC} $story_status"
  echo ""

  log_progress "Iteration $iteration: Story $story_key ($story_status)"
  emit_task_start "$iteration" "$story_key" "$story_status" 2>/dev/null || true

  # Execute based on story state
  case "$story_status" in
    backlog)
      run_create_story "$story_key"
      ;;
    drafted)
      # Auto-approve drafted stories and start development
      echo -e "${YELLOW}Auto-approving drafted story...${NC}"
      update_story_status "$story_key" "ready-for-dev"
      # Continue to dev-story in same iteration
      update_story_status "$story_key" "in-progress"
      run_dev_story "$story_key"
      ;;
    ready-for-dev)
      update_story_status "$story_key" "in-progress"
      run_dev_story "$story_key"
      ;;
    in-progress)
      run_dev_story "$story_key"
      ;;
    review)
      run_code_review "$story_key"
      ;;
    *)
      echo -e "${YELLOW}Unknown status: $story_status${NC}"
      return 1
      ;;
  esac

  emit_task_progress "$iteration" "$story_key" "iteration_complete" 2>/dev/null || true
  log_progress "Iteration $iteration: Completed"
  return 0
}

# Legacy: Run single iteration (beads-based, for non-BMAD projects)
run_iteration_beads() {
  local iteration=$1

  echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  Ralph Iteration $iteration of $MAX_ITERATIONS (Beads mode)${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

  # Get next task
  local task=$(get_next_task)

  if [ -z "$task" ]; then
    echo -e "${GREEN}No more tasks ready. Checking if all complete...${NC}"
    return 1
  fi

  # Extract task ID and title for observability (using jq if available)
  local task_id=""
  local task_title=""
  if command -v jq &>/dev/null; then
    task_id=$(echo "$task" | jq -r '.id // "unknown"' 2>/dev/null || echo "unknown")
    task_title=$(echo "$task" | jq -r '.title // "Untitled"' 2>/dev/null || echo "Untitled")
  fi

  echo -e "${CYAN}Current Task:${NC}"
  echo "$task"
  echo ""

  log_progress "Iteration $iteration: Starting task $task_id"

  # Emit task start event
  emit_task_start "$iteration" "$task_id" "$task_title" 2>/dev/null || true

  # Build the prompt with current task context
  local prompt=$(cat "$SCRIPT_DIR/prompt.md")

  # Fetch previous notes for failure state injection
  local previous_notes=""
  if command -v jq &>/dev/null && [ -n "$task_id" ] && [ "$task_id" != "unknown" ]; then
    cd "$PROJECT_ROOT"
    previous_notes=$(bd show "$task_id" --json 2>/dev/null | jq -r '.notes // empty' || echo "")
  fi

  # Inject failure context if previous notes exist
  local failure_context=""
  if [ -n "$previous_notes" ]; then
    failure_context="

## Previous Attempt Failed

The last attempt encountered these issues:

$previous_notes

Fix the issues above before proceeding.
"
  fi

  prompt="$prompt$failure_context

## Current Task from Beads

\`\`\`
$task
\`\`\`

Execute this task following the RBP Protocol. Run tests to verify completion before marking the task as complete."

  # Execute via Claude Code
  echo -e "${YELLOW}Executing via Claude Code...${NC}\n"

  # Emit task progress event
  emit_task_progress "$iteration" "$task_id" "executing" 2>/dev/null || true

  local output
  output=$(echo "$prompt" | claude --dangerously-skip-permissions 2>&1 | tee /dev/stderr) || true

  # Check for completion signal
  if echo "$output" | grep -q "<rbp:complete/>"; then
    echo -e "\n${GREEN}Task marked complete with verification.${NC}"
    log_progress "Iteration $iteration: Task completed with verification"
    # Emit task complete event
    emit_task_complete "$iteration" "$task_id" "closed" 2>/dev/null || true
    return 0
  fi

  # Check for error signal
  if echo "$output" | grep -q "<rbp:error>"; then
    echo -e "\n${RED}Task encountered an error.${NC}"
    log_progress "Iteration $iteration: Task failed"
    # Extract error message if possible
    local error_msg=$(echo "$output" | grep -o '<rbp:error>[^<]*</rbp:error>' | sed 's/<[^>]*>//g' || echo "Unknown error")
    emit_error "$iteration" "$task_id" "$error_msg" 2>/dev/null || true
    return 0  # Continue to next iteration
  fi

  log_progress "Iteration $iteration: Completed iteration"
  emit_task_progress "$iteration" "$task_id" "iteration_complete" 2>/dev/null || true
  return 0
}

# Detect execution mode: bmad or beads
# NOTE: Must call find_sprint_status and detect_current_epic BEFORE calling detect_mode
# because $(detect_mode) runs in a subshell and any variables set inside are lost
detect_mode() {
  # Honor forced mode from --mode flag
  if [ -n "$FORCED_MODE" ]; then
    echo "$FORCED_MODE"
    return
  fi

  # Check if BMAD was already detected (variables set by pre-call)
  if [ -n "$SPRINT_STATUS_FILE" ] && [ -n "$CURRENT_EPIC" ]; then
    echo "bmad"
    return
  fi

  # Fall back to beads mode
  if [ -d "$PROJECT_ROOT/.beads" ]; then
    echo "beads"
    return
  fi

  echo "none"
}

# Main execution loop
main() {
  print_banner
  init_progress

  # Pre-detect BMAD mode by calling functions directly (not in subshell)
  # This sets SPRINT_STATUS_FILE and CURRENT_EPIC global variables
  find_sprint_status || true
  detect_current_epic || true

  # Now detect mode using the already-set variables
  local mode=$(detect_mode)

  local forced_suffix=""
  [ -n "$FORCED_MODE" ] && forced_suffix=" (forced)"

  case "$mode" in
    bmad)
      echo -e "${GREEN}Mode: BMAD (sprint-status.yaml)${forced_suffix}${NC}"
      echo -e "${CYAN}Epic: $CURRENT_EPIC${NC}"
      echo -e "${CYAN}Status file: $SPRINT_STATUS_FILE${NC}"
      check_prerequisites "bmad"
      ;;
    beads)
      echo -e "${GREEN}Mode: Beads${forced_suffix}${NC}"
      check_prerequisites "beads"
      ;;
    *)
      echo -e "${RED}ERROR: No task source found.${NC}"
      echo -e "Expected one of:"
      echo -e "  - sprint-status.yaml (BMAD mode) + epic-N branch"
      echo -e "  - .beads directory (Beads mode)"
      exit 1
      ;;
  esac

  echo -e "Max iterations: $MAX_ITERATIONS"
  echo -e "Project root: $PROJECT_ROOT"
  if [ "$RBP_OBSERVABILITY_ENABLED" = "true" ]; then
    echo -e "Observability: enabled (session: ${RBP_SESSION_ID:0:8}...)"
  fi
  echo ""

  log_progress "=== Ralph session started (mode: $mode) ==="

  # Emit loop start event
  emit_loop_start 1 "$MAX_ITERATIONS" 2>/dev/null || true

  for i in $(seq 1 $MAX_ITERATIONS); do
    # Check completion based on mode
    local complete=false
    if [ "$mode" = "bmad" ]; then
      is_epic_complete && complete=true
    else
      all_tasks_complete && complete=true
    fi

    if [ "$complete" = "true" ]; then
      echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
      if [ "$mode" = "bmad" ]; then
        echo -e "${GREEN}║           EPIC $CURRENT_EPIC COMPLETE!                       ║${NC}"
      else
        echo -e "${GREEN}║              ALL TASKS COMPLETE!                      ║${NC}"
      fi
      echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
      log_progress "=== Complete at iteration $i ==="
      emit_loop_end "$i" "all_complete" 2>/dev/null || true
      exit 0
    fi

    # Run appropriate iteration based on mode
    if [ "$mode" = "bmad" ]; then
      run_iteration $i || break
    else
      run_iteration_beads $i || break
    fi

    # Brief pause between iterations
    sleep 2
  done

  echo -e "\n${YELLOW}Ralph reached max iterations ($MAX_ITERATIONS).${NC}"
  echo -e "Check progress: $PROGRESS_FILE"
  if [ "$mode" = "bmad" ]; then
    echo -e "Check sprint status: cat $SPRINT_STATUS_FILE"
  else
    echo -e "Run 'bd status' to see remaining tasks."
  fi

  log_progress "=== Reached max iterations ==="
  emit_loop_end "$MAX_ITERATIONS" "max_iterations_reached" 2>/dev/null || true
  exit 1
}

# Handle script arguments
case "${1:-}" in
  --help|-h)
    echo "Usage: ./ralph.sh [max_iterations]"
    echo ""
    echo "Ralph - Beads-driven autonomous execution loop"
    echo ""
    echo "Options:"
    echo "  max_iterations  Maximum number of iterations (default: 50)"
    echo "  --help, -h      Show this help message"
    echo "  --status        Show current beads status"
    echo ""
    echo "Examples:"
    echo "  ./ralph.sh          # Run with default 50 iterations"
    echo "  ./ralph.sh 100      # Run with 100 iterations"
    exit 0
    ;;
  --status)
    cd "$PROJECT_ROOT"
    bd status
    exit 0
    ;;
  *)
    main
    ;;
esac
