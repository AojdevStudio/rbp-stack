#!/usr/bin/env bash
# create-story-autonomous.sh - Non-interactive BMAD story generator
# Usage: ./create-story-autonomous.sh [epic-num] [story-num]
#
# Output: Path to created story file (stdout)
# Logs: stderr
#
# Story sources (in priority order):
#   1. sprint-status.yaml - preferred, has story IDs and status
#   2. Epic tech-spec file - fallback, parses table format
#
# Exit codes:
#   0 = Success (prints story path)
#   1 = No BMAD config found
#   2 = No epic found
#   3 = Epic complete (no more stories in backlog)

set -e

# Handle help early (before project root detection)
case "${1:-}" in
  --help|-h)
    echo "Usage: ./create-story-autonomous.sh [epic-num] [story-num]"
    echo ""
    echo "Non-interactive BMAD story generator for RBP autonomous loop."
    echo ""
    echo "Arguments:"
    echo "  epic-num   Epic number (auto-detected from branch if not provided)"
    echo "  story-num  Story number (auto-incremented if not provided)"
    echo ""
    echo "Story sources (priority order):"
    echo "  1. sprint-status.yaml - preferred, has story IDs and status"
    echo "  2. Epic tech-spec file - fallback, parses table format"
    echo ""
    echo "Exit codes:"
    echo "  0  Success (story path printed to stdout)"
    echo "  1  No BMAD config found"
    echo "  2  No epic found"
    echo "  3  Epic complete (no more stories in backlog)"
    echo ""
    echo "Examples:"
    echo "  ./create-story-autonomous.sh          # Auto-detect epic/story"
    echo "  ./create-story-autonomous.sh 4        # Epic 4, auto story num"
    echo "  ./create-story-autonomous.sh 4 7      # Epic 4, story 7"
    exit 0
    ;;
esac

EPIC_NUM="${1:-}"
STORY_NUM="${2:-}"
SPRINT_STATUS_FILE=""

# Colors for stderr output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Progress file (shared with ralph.sh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"

log() { echo -e "$@" >&2; }
log_info() { log "${CYAN}[INFO]${NC} $*"; }
log_warn() { log "${YELLOW}[WARN]${NC} $*"; }
log_error() { log "${RED}[ERROR]${NC} $*"; }
log_success() { log "${GREEN}[OK]${NC} $*"; }

# Append to progress.txt (unified logging with ralph.sh)
log_progress() {
  local message="$1"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] [story-creator] $message" >> "$PROGRESS_FILE"
}

# Find project root by looking for BMAD markers
find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -d "$dir/_bmad" ] || [ -d "$dir/docs/bmm" ] || [ -d "$dir/docs/bmad" ] || [ -d "$dir/.bmad-core" ]; then
      echo "$dir"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  echo ""
}

PROJECT_ROOT=$(find_project_root)
if [ -z "$PROJECT_ROOT" ]; then
  log_error "No BMAD config found (no _bmad/, docs/bmm/, docs/bmad/, or .bmad-core/)"
  exit 1
fi

cd "$PROJECT_ROOT"
log_info "Project root: $PROJECT_ROOT"

# Read a value from rbp-config.yaml using grep/sed (no yq dependency)
read_config() {
  local key="$1"
  local config_file="$PROJECT_ROOT/rbp-config.yaml"
  [ ! -f "$config_file" ] && return

  # Simple YAML parsing for keys under bmad: section
  sed -n '/^bmad:/,/^[a-z]/p' "$config_file" | \
    grep -E "^[[:space:]]*${key}:" | \
    sed 's/.*: *"\?\([^"]*\)"\?.*/\1/' | head -1
}

# Phase 1: Load BMAD configuration
load_bmad_config() {
  # First, try to read from rbp-config.yaml
  local cfg_epics_dir=$(read_config "epics_dir")
  local cfg_epic_pattern=$(read_config "epic_pattern")
  local cfg_stories_dir=$(read_config "stories_dir")
  local cfg_arch_dir=$(read_config "arch_dir")

  # If config has explicit paths, use them
  if [ -n "$cfg_epics_dir" ] && [ -d "$cfg_epics_dir" ]; then
    log_info "Using paths from rbp-config.yaml"
    EPICS_DIR="$cfg_epics_dir"
    EPIC_PATTERN="${cfg_epic_pattern:-epic}"
    STORIES_DIR="${cfg_stories_dir:-_bmad/implementation-artifacts/stories}"
    ARCH_DIR="${cfg_arch_dir:-_bmad/architecture}"
    BMAD_ROOT=$(dirname "$EPICS_DIR")

    mkdir -p "$STORIES_DIR"
    log_info "Epics dir: $EPICS_DIR"
    log_info "Epic pattern: $EPIC_PATTERN"
    log_info "Stories dir: $STORIES_DIR"
    return 0
  fi

  # Fall back to auto-detection
  log_info "Auto-detecting BMAD paths..."

  BMAD_ROOT=""
  EPICS_DIR=""
  EPIC_PATTERN=""

  # Check each possible root and find one with epics
  for root in "_bmad" "docs/bmm" "docs/bmad"; do
    if [ ! -d "$root" ]; then
      continue
    fi

    # Check for tech-specs (preferred)
    if [ -d "$root/tech-specs" ] && ls "$root/tech-specs"/tech-spec-epic*.md &>/dev/null; then
      BMAD_ROOT="$root"
      EPICS_DIR="$root/tech-specs"
      EPIC_PATTERN="tech-spec-epic"
      break
    fi

    # Check for epics directory
    if [ -d "$root/epics" ] && ls "$root/epics"/epic-*.md &>/dev/null; then
      BMAD_ROOT="$root"
      EPICS_DIR="$root/epics"
      EPIC_PATTERN="epic"
      break
    fi

    # Check root level
    if ls "$root"/epic-*.md &>/dev/null; then
      BMAD_ROOT="$root"
      EPICS_DIR="$root"
      EPIC_PATTERN="epic"
      break
    fi
  done

  # Fallback: use first existing directory even if no epics found
  if [ -z "$BMAD_ROOT" ]; then
    for root in "_bmad" "docs/bmm" "docs/bmad"; do
      if [ -d "$root" ]; then
        BMAD_ROOT="$root"
        EPICS_DIR="$root"
        EPIC_PATTERN="epic"
        break
      fi
    done
  fi

  if [ -z "$BMAD_ROOT" ]; then
    log_error "No BMAD root found"
    exit 1
  fi

  STORIES_DIR="$BMAD_ROOT/implementation-artifacts/stories"
  ARCH_DIR="$BMAD_ROOT/architecture"

  # Create stories directory if it doesn't exist
  mkdir -p "$STORIES_DIR"

  log_info "BMAD root: $BMAD_ROOT"
  log_info "Epics dir: $EPICS_DIR"
  log_info "Stories dir: $STORIES_DIR"

  # Find sprint-status.yaml
  for status_path in \
    "$PROJECT_ROOT/docs/bmm/sprint-status.yaml" \
    "$PROJECT_ROOT/docs/bmm/implementation-artifacts/sprint-status.yaml" \
    "$PROJECT_ROOT/_bmad/sprint-status.yaml" \
    "$PROJECT_ROOT/sprint-status.yaml"; do
    if [ -f "$status_path" ]; then
      SPRINT_STATUS_FILE="$status_path"
      log_info "Sprint status: $SPRINT_STATUS_FILE"
      break
    fi
  done
}

# Find next backlog story from sprint-status.yaml
# Returns: story ID (e.g., "4-9") or empty if no backlog stories
find_next_backlog_story() {
  local epic=$1
  [ -z "$SPRINT_STATUS_FILE" ] || [ ! -f "$SPRINT_STATUS_FILE" ] && return

  # Format: "  4-9-bulk-import-csv: backlog" or "  4-9: backlog"
  grep -E "^[[:space:]]+${epic}-[0-9]+[^:]*:[[:space:]]*backlog" "$SPRINT_STATUS_FILE" 2>/dev/null | \
    head -1 | sed 's/^[[:space:]]*//' | cut -d: -f1
}

# Get story description from sprint-status.yaml key
# Input: "4-9-bulk-import-csv" -> Output: "bulk-import-csv"
get_story_slug_from_key() {
  local key="$1"
  local epic="$2"
  # Remove epic prefix (e.g., "4-9-bulk-import-csv" -> "bulk-import-csv")
  echo "$key" | sed "s/^${epic}-[0-9]*-*//"
}

# Extract story number from key
# Input: "4-9-bulk-import-csv" -> Output: "9"
get_story_num_from_key() {
  local key="$1"
  local epic="$2"
  # Extract the story number after epic prefix
  echo "$key" | sed "s/^${epic}-//" | grep -oE '^[0-9]+' | head -1
}

# Check if epic is complete (all stories done/skipped)
is_epic_complete() {
  local epic=$1
  [ -z "$SPRINT_STATUS_FILE" ] || [ ! -f "$SPRINT_STATUS_FILE" ] && return 1

  local backlog_count
  backlog_count=$(grep -cE "^[[:space:]]+${epic}-[0-9]+[^:]*:[[:space:]]*backlog" "$SPRINT_STATUS_FILE" 2>/dev/null || echo "0")
  [ "$backlog_count" -gt 0 ] && return 1

  # No backlog stories - check if there ARE any stories at all
  local total_stories
  total_stories=$(grep -cE "^[[:space:]]+${epic}-[0-9]+" "$SPRINT_STATUS_FILE" 2>/dev/null || echo "0")
  [ "$total_stories" -gt 0 ]
}

# Phase 2: Find current epic number from git branch or filesystem
find_current_epic() {
  # If epic number provided as argument, use it
  if [ -n "$EPIC_NUM" ]; then
    echo "$EPIC_NUM"
    return 0
  fi

  # Try to detect from git branch (e.g., epic-4/feature-name)
  local branch=$(git branch --show-current 2>/dev/null || echo "")
  if [[ "$branch" =~ ^epic-([0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi

  # Fall back to finding highest epic number in filesystem
  local highest=0
  if [ -d "$EPICS_DIR" ]; then
    for epic_file in "$EPICS_DIR"/${EPIC_PATTERN}-*.md "$EPICS_DIR"/${EPIC_PATTERN}*.md; do
      if [ -f "$epic_file" ]; then
        local num=$(basename "$epic_file" | grep -oE '[0-9]+' | head -1)
        if [ -n "$num" ] && [ "$num" -gt "$highest" ]; then
          highest=$num
        fi
      fi
    done
  fi

  if [ "$highest" -gt 0 ]; then
    echo "$highest"
  else
    echo ""
  fi
}

# Phase 3: Find next story number
find_next_story_number() {
  local epic=$1

  # If story number provided as argument, use it
  if [ -n "$STORY_NUM" ]; then
    echo "$STORY_NUM"
    return 0
  fi

  # Find highest existing story number for this epic
  local highest=0
  for story_file in "$STORIES_DIR"/story-${epic}-*.md; do
    if [ -f "$story_file" ]; then
      # Extract story number: story-4-7-name.md -> 7
      local num=$(basename "$story_file" | sed -n "s/story-${epic}-\([0-9]*\).*/\1/p")
      if [ -n "$num" ] && [ "$num" -gt "$highest" ]; then
        highest=$num
      fi
    fi
  done

  echo $((highest + 1))
}

# Phase 4: Parse epic file for story details
parse_epic_for_story() {
  local epic=$1
  local story_num=$2
  local story_slug="${3:-}"

  # Try multiple naming patterns for epic file
  local epic_file=""
  for pattern in "$EPICS_DIR/${EPIC_PATTERN}-${epic}.md" "$EPICS_DIR/${EPIC_PATTERN}${epic}.md" "$EPICS_DIR/epic-${epic}.md"; do
    if [ -f "$pattern" ]; then
      epic_file="$pattern"
      break
    fi
  done

  if [ -z "$epic_file" ] || [ ! -f "$epic_file" ]; then
    log_warn "Epic file not found for epic $epic"
    log_warn "  Searched in: $EPICS_DIR"
    # If we have story_slug from sprint-status, we can still generate a story
    if [ -n "$story_slug" ]; then
      log_info "Using story slug from sprint-status: $story_slug"
      local title_from_slug=$(echo "$story_slug" | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g')
      STORY_TITLE="Story ${epic}.${story_num}: ${title_from_slug}"
      STORY_ROLE="developer"
      STORY_CAPABILITY="implement ${story_slug//-/ }"
      STORY_BENEFIT="the feature can progress toward completion"
      STORY_ACS="| AC1 | Implementation complete | Tests pass |"
      STORY_TASKS="- [ ] 1.1 Review requirements from tech-spec
- [ ] 1.2 Implement functionality
- [ ] 1.3 Write tests
- [ ] 1.4 Verify acceptance criteria"
      return 0
    fi
    log_error "No epic file and no story slug available"
    exit 2
  fi

  log_info "Parsing epic file: $epic_file"

  # Try to find story info from table format first (tech-spec style)
  # Format: "| 9 | 4-9 | Bulk import CSV | 4-4, 4-5 |"
  local table_row=""
  table_row=$(grep -E "^\|[[:space:]]*[0-9]+[[:space:]]*\|[[:space:]]*${epic}-${story_num}[[:space:]]*\|" "$epic_file" 2>/dev/null | head -1 || echo "")

  if [ -n "$table_row" ]; then
    log_info "Found story in table format"
    # Extract description from table (third column)
    local description=$(echo "$table_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4); print $4}')
    if [ -n "$description" ]; then
      STORY_TITLE="Story ${epic}.${story_num}: ${description}"
      STORY_ROLE="developer"
      STORY_CAPABILITY="implement ${description,,}"
      STORY_BENEFIT="the feature can progress toward completion"
      STORY_ACS="| AC1 | ${description} complete | Tests pass |"
      STORY_TASKS="- [ ] 1.1 Review requirements from tech-spec section
- [ ] 1.2 Implement functionality
- [ ] 1.3 Write tests
- [ ] 1.4 Verify acceptance criteria"

      # Try to find more details in the tech-spec (look for story section)
      local detail_section=""
      detail_section=$(sed -n "/###.*${epic}-${story_num}/,/^###[^#]/p" "$epic_file" 2>/dev/null | head -50 || echo "")
      if [ -z "$detail_section" ]; then
        # Try story X.Y format
        detail_section=$(sed -n "/###.*Story.*${story_num}/,/^###[^#]/p" "$epic_file" 2>/dev/null | head -50 || echo "")
      fi

      if [ -n "$detail_section" ]; then
        # Parse any acceptance criteria from detail section
        local acs=$(echo "$detail_section" | grep -E "^\s*[-*].*AC|^\s*AC[0-9]|^\|.*AC" | head -10)
        if [ -n "$acs" ]; then
          STORY_ACS="$acs"
        fi
        # Parse any tasks
        local tasks=$(echo "$detail_section" | grep -E "^\s*[-*]\s*\[[ x]\]|^\s*[0-9]+\." | head -20)
        if [ -n "$tasks" ]; then
          STORY_TASKS="$tasks"
        fi
      fi
      return 0
    fi
  fi

  # Fall back to original parsing for markdown header format
  # Extract total story count from epic
  local total_stories=$(grep -c "^### Story" "$epic_file" 2>/dev/null || echo "0")
  if [ "$total_stories" -eq 0 ]; then
    # Try counting table rows with story IDs
    total_stories=$(grep -cE "^\|[[:space:]]*[0-9]+[[:space:]]*\|[[:space:]]*${epic}-[0-9]+" "$epic_file" 2>/dev/null || echo "0")
  fi
  if [ "$total_stories" -eq 0 ]; then
    # Last resort: look for numbered stories
    total_stories=$(grep -cE "Story\s*${epic}\.[0-9]+" "$epic_file" 2>/dev/null || echo "10")
  fi

  log_info "Total stories in epic: $total_stories (detected)"
  log_info "Generating story number: $story_num"

  # Only check story count if we're NOT using sprint-status.yaml
  if [ -z "$SPRINT_STATUS_FILE" ]; then
    if [ "$story_num" -gt "$total_stories" ] && [ "$total_stories" -gt 0 ]; then
      log_warn "Epic $epic appears complete ($total_stories stories)"
      log_progress "COMPLETE: Epic $epic finished ($total_stories stories)"
      exit 3
    fi
  fi

  # Try to find story section with markdown headers
  local story_section=""
  local story_pattern="Story[[:space:]]*${epic}[[:space:]]*[\.:][[:space:]]*${story_num}"

  story_section=$(sed -n "/###.*${story_pattern}/,/^###[^#]/p" "$epic_file" 2>/dev/null | head -50)

  if [ -z "$story_section" ]; then
    story_section=$(sed -n "/Story ${epic}\.${story_num}/,/Story ${epic}\./p" "$epic_file" 2>/dev/null | head -50)
  fi

  if [ -z "$story_section" ]; then
    # Generate placeholder using story_slug if available
    log_warn "Could not find story ${epic}.${story_num} section in epic, generating template"
    if [ -n "$story_slug" ]; then
      local title_from_slug=$(echo "$story_slug" | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g')
      STORY_TITLE="Story ${epic}.${story_num}: ${title_from_slug}"
      STORY_CAPABILITY="implement ${story_slug//-/ }"
    else
      STORY_TITLE="Story ${epic}.${story_num}: Implementation Task"
      STORY_CAPABILITY="complete the implementation for story ${epic}.${story_num}"
    fi
    STORY_ROLE="developer"
    STORY_BENEFIT="the feature can progress toward completion"
    STORY_ACS="| AC1 | Implementation complete | Tests pass |"
    STORY_TASKS="- [ ] 1.1 Review requirements
- [ ] 1.2 Implement functionality
- [ ] 1.3 Write tests
- [ ] 1.4 Verify acceptance criteria"
    return 0
  fi

  # Parse story title
  STORY_TITLE=$(echo "$story_section" | grep -m1 -E "^###|Story ${epic}\.${story_num}" | sed 's/^###\s*//' | sed 's/Story/Story/' || echo "Story ${epic}.${story_num}")

  # Parse user story (As a... I want... so that...)
  STORY_ROLE=$(echo "$story_section" | grep -ioE "as (a |an )[^,]*" | sed 's/as a\s*//i' | sed 's/as an\s*//i' | head -1 || echo "user")
  STORY_CAPABILITY=$(echo "$story_section" | grep -ioE "I want[^,]*" | sed 's/I want\s*//i' | head -1 || echo "this feature implemented")
  STORY_BENEFIT=$(echo "$story_section" | grep -ioE "so that[^.]*" | sed 's/so that\s*//i' | head -1 || echo "the system works as expected")

  # Parse acceptance criteria
  STORY_ACS=$(echo "$story_section" | grep -E "^\s*[-*].*AC|^\s*AC[0-9]|^\|.*AC" | head -10 || echo "| AC1 | Feature implemented | Tests pass |")

  # Parse tasks
  STORY_TASKS=$(echo "$story_section" | grep -E "^\s*[-*]\s*\[[ x]\]|^\s*[0-9]+\." | head -20 || echo "- [ ] Implement feature
- [ ] Write tests")
}

# Phase 5: Gather architecture context
gather_arch_context() {
  ARCH_CONTEXT=""
  [ ! -d "$ARCH_DIR" ] && return

  for arch_file in "$ARCH_DIR"/*.md; do
    [ ! -f "$arch_file" ] && continue
    local basename
    basename=$(basename "$arch_file" .md)
    local snippet
    snippet=$(head -20 "$arch_file" | grep -v "^#" | head -5 | tr '\n' ' ')
    [ -n "$snippet" ] && ARCH_CONTEXT="${ARCH_CONTEXT}
- **${basename}**: ${snippet:0:200}..."
  done
}

# Phase 6: Generate story file
generate_story_file() {
  local epic=$1
  local story_num=$2
  local story_slug="${3:-}"

  # Create slug - prefer provided slug, otherwise derive from title
  local slug="${story_slug:-}"
  if [ -z "$slug" ]; then
    slug=$(echo "$STORY_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/story [0-9.]*: *//' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | head -c 50)
  fi
  slug="${slug:-implementation}"

  local story_file="$STORIES_DIR/story-${epic}-${story_num}-${slug}.md"

  log_info "Generating: $story_file"

  cat > "$story_file" << EOF
# Story ${epic}.${story_num}: ${STORY_TITLE#*: }

Status: Draft

## Story

As a **${STORY_ROLE}**,
I want **${STORY_CAPABILITY}**,
so that **${STORY_BENEFIT}**.

## Acceptance Criteria

| AC# | Criteria | Verification |
|-----|----------|--------------|
${STORY_ACS}

## Tasks / Subtasks

### Task 1: Implementation (AC: 1)

${STORY_TASKS}

## Dev Notes

### Architecture Context
${ARCH_CONTEXT:-No architecture docs found.}

### Previous Story Insights

Check previous story files in this epic for patterns and learnings.

---

*Generated by create-story-autonomous.sh*
EOF

  # Output path to stdout (the main output of this script)
  echo "$story_file"
}

# Main execution
main() {
  log_info "═══════════════════════════════════════════════════════"
  log_info "  RBP Autonomous Story Creator (BMAD Workflow)"
  log_info "═══════════════════════════════════════════════════════"
  log_progress "=== Story creation started ==="

  # Phase 1: Load config
  load_bmad_config

  # Phase 2: Find epic
  EPIC=$(find_current_epic)
  if [ -z "$EPIC" ]; then
    log_error "No epic found (check branch name or provide epic number)"
    log_progress "FAILED: No epic found"
    exit 2
  fi
  log_info "Epic: $EPIC"
  log_progress "Epic detected: $EPIC"

  # Phase 3: Find next story - prefer sprint-status.yaml
  local story_key=""
  local story_slug=""

  if [ -n "$STORY_NUM" ]; then
    # Story number explicitly provided
    NEXT_STORY="$STORY_NUM"
    story_key="${EPIC}-${STORY_NUM}"
    log_info "Using provided story number: $NEXT_STORY"
  elif [ -n "$SPRINT_STATUS_FILE" ]; then
    # Use sprint-status.yaml as source of truth
    story_key=$(find_next_backlog_story "$EPIC")

    if [ -n "$story_key" ]; then
      NEXT_STORY=$(get_story_num_from_key "$story_key" "$EPIC")
      story_slug=$(get_story_slug_from_key "$story_key" "$EPIC")
      log_info "Next backlog story from sprint-status: $story_key (story $NEXT_STORY)"
    else
      # No backlog stories - check if epic is complete
      if is_epic_complete "$EPIC"; then
        log_warn "Epic $EPIC complete (no backlog stories in sprint-status.yaml)"
        log_progress "COMPLETE: Epic $EPIC finished (all stories done/skipped)"
        exit 3
      else
        log_warn "No backlog stories found for epic $EPIC in sprint-status.yaml"
        log_progress "COMPLETE: No backlog stories for epic $EPIC"
        exit 3
      fi
    fi
  else
    # Fall back to filesystem-based detection
    log_warn "No sprint-status.yaml found, using filesystem detection"
    NEXT_STORY=$(find_next_story_number "$EPIC")
    story_key="${EPIC}-${NEXT_STORY}"
    log_info "Next story (filesystem): $NEXT_STORY"
  fi

  # Phase 4: Invoke BMAD create-story workflow via Claude
  log_info "Invoking BMAD create-story workflow..."
  log_info "Story: $story_key"
  log_progress "Running BMAD create-story for $story_key"

  # Build context for the workflow
  local workflow_prompt="Create story ${story_key} for Epic ${EPIC}.

Story ID: ${story_key}
Epic: ${EPIC}
Story Number: ${NEXT_STORY}
Story Slug: ${story_slug:-$story_key}

Use the tech-spec at: ${EPICS_DIR}/${EPIC_PATTERN}-${EPIC}.md (or tech-spec-epic-${EPIC}.md)
Sprint status: ${SPRINT_STATUS_FILE:-not found}
Stories directory: ${STORIES_DIR}

Create a complete story file following BMAD standards."

  # Run the BMAD create-story workflow
  cd "$PROJECT_ROOT"

  if claude /bmad:bmm:workflows:create-story <<< "$workflow_prompt"; then
    log_success "BMAD create-story workflow completed"
    log_progress "Story created via BMAD workflow: $story_key"

    # Output the expected story file path (for chaining with other scripts)
    local expected_story_file="$STORIES_DIR/story-${story_key}.md"
    if [ -f "$expected_story_file" ]; then
      echo "$expected_story_file"
    else
      # Try with slug
      local story_with_slug="$STORIES_DIR/story-${EPIC}-${NEXT_STORY}-${story_slug}.md"
      if [ -f "$story_with_slug" ]; then
        echo "$story_with_slug"
      else
        # Find any matching story file
        local found_story=$(ls -1 "$STORIES_DIR"/story-${EPIC}-${NEXT_STORY}*.md 2>/dev/null | head -1)
        if [ -n "$found_story" ]; then
          echo "$found_story"
        fi
      fi
    fi
  else
    log_error "BMAD create-story workflow failed"
    log_progress "FAILED: BMAD create-story for $story_key"
    exit 1
  fi
}

# Execute
main
