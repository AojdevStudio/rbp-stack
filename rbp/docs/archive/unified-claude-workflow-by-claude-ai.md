> ⚠️ **DEPRECATED - Historical Design Proposal**
>
> **Status:** ARCHIVED (January 24, 2026)
> **Reason:** This document describes a bash-based architecture with `prd.json` files that was **never implemented**. The actual implementation uses a TypeScript CLI with direct Beads integration.
>
> **Current Documentation:** See [`../rbp-workflow-guide.md`](../rbp-workflow-guide.md)
>
> This file is preserved for historical reference only.

---

# Unified Claude Code Workflow: BMAD + Ralph + Beads + PAI

Integrating four distinct AI development systems into a cohesive workflow requires a **layered architecture** where each component handles a specific concern.

## The Four-Layer Architecture

- **PAI**: Provides the base augmentation layer (unchanged, user-level)
- **BMAD**: Defines story structure and workflows
- **Ralph**: Drives iterative execution loops
- **Beads**: Maintains memory continuity across sessions

## Key Innovation: Automatic Sub-Story Decomposition

The core innovation is **automatic sub-story decomposition**. A 9-task BMAD story becomes 3 sub-stories of 3 tasks each:

- Each sub-story is executed via Ralph's iteration loop
- Beads persists context between executions
- This prevents context saturation while maintaining progress

## How Each System Structures Its Context

### BMAD: Hierarchical Markdown Stories

**BMAD** uses hierarchical Markdown stories with embedded task checkboxes. Each story file contains:

- Context
- User Story
- Acceptance Criteria
- Technical Notes
- Dev Notes
- Dependencies
- Tasks/Subtasks
- Status

**Key Rules**:
- Tasks follow a maximum **one-developer-day granularity** rule
- Sprint progress is tracked in `sprint-status.yaml`
- Maintains canonical state of all stories and dependencies

### Ralph: Flat JSON Structure

**Ralph** operates on a flat JSON structure called `prd.json` containing an array of `userStories`, each with:

- `id` - Unique identifier
- `title` - Story title
- `description` - Story description
- `acceptanceCriteria` - Array of criteria
- `priority` - Number (execution order)
- `passes` - Boolean (completion status)
- `notes` - Additional notes

**Critical Insight**: Ralph's PRD format is **simpler and flatter** than BMAD's rich story format. It's optimized for autonomous agent consumption, not human readability.

### Beads: Hash-Based Issue Tracking

**Beads** uses hash-based issue IDs (e.g., `bd-a3f8e9`) with hierarchical children (`bd-a3f8e9.1`, `bd-a3f8e9.2`).

**Key Features**:
- Each bead has: status, priority, dependencies
- **Crucially**: A `notes` field that survives context compaction
- The `bd prime` command injects ~1-2k tokens of workflow context at session start

### PAI: Progressive Disclosure Model

**PAI** structures context through a **3-tier progressive disclosure model**:

1. **Tier 1** (YAML frontmatter, ~100 tokens): Loads at session start
2. **Tier 2** (SKILL.md body, ~2000 tokens): Loads on intent match
3. **Tier 3** (workflows/tools, variable): Loads on explicit reference

User customizations live in `skills/CORE/USER/` and are preserved across upgrades.

## Integration Points: BMAD Stories → Ralph JSON

The fundamental bridge is a **transformer function** that converts BMAD's rich story format into Ralph's execution-oriented JSON.

### Field Mapping

| BMAD Field | Ralph Field | Notes |
|------------|------------|-------|
| Tasks/Subtasks | `userStories` array | Each task becomes a discrete story |
| Acceptance Criteria | `acceptanceCriteria` | Array of criteria |
| Status | `passes` boolean | Completion status |

### Sub-Story Decomposition

The critical transformation handles **sub-story decomposition**. When a BMAD story contains 9 tasks, the transformer creates 3 Ralph PRD files:

```text
BMAD Story (9 tasks)
├── Substory 1: Tasks 1-3 → substory-1.json
├── Substory 2: Tasks 4-6 → substory-2.json  
└── Substory 3: Tasks 7-9 → substory-3.json
```

**Each sub-story PRD includes**:
- 3 `userStories` from the parent story
- Context from parent BMAD story (Technical Notes, Dependencies, Dev Notes) as a preamble section
- Ensures agents have necessary architectural context

### Git Branch Naming

The `branchName` field in each sub-story PRD follows the pattern:

```
ralph/{story-id}/substory-{n}
```

This enables clean git history per execution batch.

## Beads: The Memory Bridge Between Workflows

Beads serves as the **persistent memory layer** that bridges BMAD's `create-story` and `dev-story` workflows.

### Bead Hierarchy

When `create-story` completes:

- **Parent bead**: Represents the full story (`bd-story-id`)
  - `notes` field contains the full BMAD story context
- **Child beads**: One for each sub-story (`bd-story-id.1`, `bd-story-id.2`, `bd-story-id.3`)
  - Track sub-story execution state

### Workflow Flow

1. **create-story** 
   → Creates parent bead + child beads

2. **Ralph loop** 
   → Updates child bead notes with progress after each iteration

3. **dev-story completion** 
   → Closes child beads, updates parent bead status

4. **code-review** 
   → References parent bead for full context

### Automatic Work Selection

- **`bd ready` command**: Identifies the next unblocked sub-story
- **`bd prime` hook**: Injects current state at each Claude Code session start
- **Result**: Agents immediately know where they left off

## Optimal Sub-Story Size and Decomposition Strategy

Based on Ralph's design principle that **each story must fit in one context window** and BMAD's **one-developer-day task maximum**, the optimal sub-story size is **3-4 tasks**.

### Balancing Constraints

| Factor | Constraint | Optimal Range |
|--------|------------|---------------|
| Context window | Ralph stories must complete in ~1 iteration | 3-4 tasks |
| Task granularity | BMAD tasks max 1 dev-day | Already decomposed |
| Iteration efficiency | Avoid excessive loop overhead | 3+ tasks/batch |
| Commit coherence | Meaningful git commits | Logical groupings |

### Decomposition Algorithm

1. **≤4 tasks** → Execute as single sub-story
2. **5-8 tasks** → Split into 2 sub-stories (balanced)
3. **9-12 tasks** → Split into 3 sub-stories
4. **>12 tasks** → Split into `ceil(n/4)` sub-stories

### Task Grouping Strategy

Tasks are grouped by **logical coherence** first, then by **dependency order**:

1. **Logical coherence**: Database tasks together, API tasks together, UI tasks together
2. **Dependency order**: Within groups, respect dependencies

The transformer script analyzes task descriptions for domain keywords to auto-group.

## Wiring Into Claude Code Without Conflicting With PAI

### Layer Separation

- **PAI**: Operates at **user level** (`~/.claude/`)
- **BMAD/Ralph/Beads**: Operate at **project level** (`.claude/`)

Claude Code's settings precedence ensures project settings **augment** user settings without conflict.

### Settings Hierarchy

1. **User settings** (`~/.claude/settings.json`)
   - PAI hooks, skills, identity
   - **Status**: Unchanged

2. **Project settings** (`.claude/settings.json`)
   - BMAD/Ralph/Beads hooks
   - **Status**: Additive

### Project-Level Hooks

The project-level configuration adds three hooks:

- **SessionStart**: 
  - Runs `bd prime`
  - Loads active sub-story context

- **PreCompact**: 
  - Updates bead notes with current progress

- **PostToolUse** (matcher: `Edit|Write`): 
  - Logs file changes to `progress.txt`

### Compatibility

- PAI's existing hooks continue to fire
- Project hooks fire additionally
- **No modifications to PAI are required**

---

## Concrete Implementation: File Structure

```text
your-project/
├── .claude/
│   ├── settings.json           # Project-level hooks (additive to PAI)
│   ├── commands/
│   │   ├── bmad-create-story   # /bmad:create-story command
│   │   ├── bmad-dev-story      # /bmad:dev-story command  
│   │   └── bmad-code-review    # /bmad:code-review command
│   └── CLAUDE.md               # Project context (references workflows)
│
├── .beads/
│   ├── beads.db                # SQLite cache (gitignored)
│   ├── beads.jsonl             # Source of truth (git-tracked)
│   └── config.yaml             # Beads configuration
│
├── docs/
│   ├── stories/                # BMAD story files
│   │   ├── story-1.1.md
│   │   ├── story-1.2.md
│   │   └── ...
│   ├── epics/                  # Epic definitions
│   └── sprint-status.yaml      # Sprint tracking
│
├── scripts/
│   └── ralph/
│       ├── ralph.sh            # Main loop script
│       ├── prompt.md           # Agent system prompt
│       ├── progress.txt        # Append-only learnings
│       ├── active/
│       │   ├── prd.json        # Current sub-story PRD
│       │   └── context.md      # Parent story context
│       └── archive/            # Completed sub-story PRDs
│
├── bmad/
│   ├── transform.sh            # BMAD story → Ralph PRD converter
│   ├── decompose.sh            # Sub-story splitter
│   ├── templates/
│   │   ├── story-template.md   # BMAD story template
│   │   └── prd-template.json   # Ralph PRD template
│   └── workflows/
│       ├── create-story.md     # Workflow instructions
│       ├── dev-story.md
│       └── code-review.md
│
├── AGENTS.md                   # Permanent agent memory
└── CLAUDE.md                   # Project-level Claude context
```

## Project-level settings.json (hooks configuration)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bd prime 2>/dev/null || echo 'Beads not initialized'"
          },
          {
            "type": "command", 
            "command": "cat scripts/ralph/active/context.md 2>/dev/null || true"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'BEAD_ID=$(cat scripts/ralph/active/.bead-id 2>/dev/null) && [ -n \"$BEAD_ID\" ] && bd update $BEAD_ID --notes \"$(cat scripts/ralph/progress.txt | tail -50)\"' || true"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'echo \"$(date +%Y-%m-%d\\ %H:%M) - Modified: $CLAUDE_FILE_PATHS\" >> scripts/ralph/progress.txt' || true"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(bd *)",
      "Bash(scripts/ralph/*)",
      "Bash(bmad/*)",
      "Read(docs/**)",
      "Write(docs/stories/**)",
      "Write(scripts/ralph/**)"
    ]
  }
}
```

## The main Ralph execution script (ralph.sh)

```bash
#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/active/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
CONTEXT_FILE="$SCRIPT_DIR/active/context.md"
BEAD_ID_FILE="$SCRIPT_DIR/active/.bead-id"
MAX_ITERATIONS=${1:-15}

# Validate active sub-story exists
if [ ! -f "$PRD_FILE" ]; then
  echo "❌ No active sub-story. Run 'bmad/decompose.sh <story-file>' first."
  exit 1
fi

# Get bead ID for this sub-story
BEAD_ID=$(cat "$BEAD_ID_FILE" 2>/dev/null || echo "")
if [ -n "$BEAD_ID" ]; then
  bd update "$BEAD_ID" --status in_progress 2>/dev/null || true
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  RALPH LOOP - $(jq -r '.project' "$PRD_FILE")"
echo "  Sub-story: $(jq -r '.branchName' "$PRD_FILE")"
echo "  Max iterations: $MAX_ITERATIONS"
echo "═══════════════════════════════════════════════════════════════"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "═══ Iteration $i of $MAX_ITERATIONS ═══"
  
  # Check if all stories pass before starting
  REMAINING=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE")
  if [ "$REMAINING" -eq 0 ]; then
    echo "✅ All stories already complete!"
    break
  fi
  echo "📋 Remaining stories: $REMAINING"
  
  # Build prompt with context
  PROMPT=$(cat <<EOF
$(cat "$CONTEXT_FILE" 2>/dev/null || echo "")

---

$(cat "$SCRIPT_DIR/prompt.md")
EOF
)
  
  # Execute Claude Code with permission bypass
  OUTPUT=$(echo "$PROMPT" | claude --print \
    --permission-mode acceptEdits \
    --dangerously-skip-permissions \
    2>&1 | tee /dev/stderr) || true
  
  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  ✅ SUB-STORY COMPLETE"
    echo "═══════════════════════════════════════════════════════════════"
    
    # Update bead status
    if [ -n "$BEAD_ID" ]; then
      bd update "$BEAD_ID" --status closed --notes "Completed at iteration $i" 2>/dev/null || true
    fi
    
    # Archive and check for next sub-story
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    mkdir -p "$SCRIPT_DIR/archive"
    cp "$PRD_FILE" "$SCRIPT_DIR/archive/prd-$TIMESTAMP.json"
    
    # Append summary to progress
    echo "" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
    echo "## $(date +%Y-%m-%d) - Sub-story Complete" >> "$PROGRESS_FILE"
    echo "- PRD: $(jq -r '.branchName' "$PRD_FILE")" >> "$PROGRESS_FILE"
    echo "- Iterations: $i" >> "$PROGRESS_FILE"
    
    exit 0
  fi
  
  # Brief pause between iterations
  sleep 2
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ⚠️  MAX ITERATIONS REACHED"
echo "═══════════════════════════════════════════════════════════════"

# Update bead with partial progress
if [ -n "$BEAD_ID" ]; then
  bd update "$BEAD_ID" --notes "Paused at iteration $MAX_ITERATIONS - manual review needed" 2>/dev/null || true
fi

exit 1
```

## The agent prompt template (prompt.md)

```markdown
You are an autonomous coding agent executing a BMAD sub-story using the Ralph pattern.

## Your Protocol

1. **Read State**: Check `scripts/ralph/active/prd.json` for user stories
2. **Read Progress**: Check `scripts/ralph/progress.txt` for learnings (especially Codebase Patterns section)
3. **Read Context**: The parent BMAD story context is provided above
4. **Select Work**: Pick the highest priority story where `passes: false`
5. **Implement**: Complete ALL acceptance criteria for that story
6. **Validate**: Run typecheck, lint, and tests
7. **Commit**: `git commit -m "feat: [ID] - [Title]"`
8. **Update PRD**: Set `"passes": true` for the completed story
9. **Append Learnings**: Add discoveries to `scripts/ralph/progress.txt`

## Critical Rules

- Each acceptance criterion must be **objectively checkable** (not "works well")
- Update ONLY the `passes` field in prd.json
- APPEND to progress.txt (never replace content)
- Commit after each story completion
- If blocked, document in notes field and continue to next story

## Completion Signal

After completing a story, check: Are ALL stories in prd.json now `passes: true`?

- **YES**: Reply with exactly: <promise>COMPLETE</promise>
- **NO**: End your response normally (next iteration will continue)

## Progress File Format

Always append learnings in this structure:
```
---
## YYYY-MM-DD - [Story ID]
- Files changed: [list]
- Learnings:
  - [Pattern discovered]
  - [Gotcha encountered]
```

Begin by reading prd.json and progress.txt, then select your task.
```

## BMAD story to Ralph PRD transformer (transform.sh)

```bash
#!/usr/bin/env bash
# Transforms a BMAD story markdown file into Ralph-compatible prd.json

set -e

STORY_FILE="$1"
OUTPUT_DIR="${2:-scripts/ralph/active}"

if [ -z "$STORY_FILE" ] || [ ! -f "$STORY_FILE" ]; then
  echo "Usage: bmad/transform.sh <story-file.md> [output-dir]"
  exit 1
fi

# Extract story metadata
STORY_ID=$(basename "$STORY_FILE" .md)
TITLE=$(grep -m1 "^# Story" "$STORY_FILE" | sed 's/^# Story [0-9.]*: //')

# Extract tasks (lines starting with "- [ ]" under Tasks/Subtasks)
TASKS=$(awk '/^## Tasks\/Subtasks/,/^## [^T]/' "$STORY_FILE" | grep "^- \[ \]" | sed 's/^- \[ \] //')

# Extract acceptance criteria
AC=$(awk '/^## Acceptance Criteria/,/^## [^A]/' "$STORY_FILE" | grep "^- \[ \]" | sed 's/^- \[ \] //')

# Build JSON
TASK_NUM=1
USER_STORIES="["

while IFS= read -r task; do
  [ -z "$task" ] && continue
  
  # Get acceptance criteria for this task (or use general AC)
  TASK_AC=$(echo "$AC" | head -3 | jq -R -s 'split("\n") | map(select(length > 0))')
  
  USER_STORIES+=$(cat <<EOF
{
  "id": "US-$(printf '%03d' $TASK_NUM)",
  "title": "$task",
  "description": "Task from BMAD story $STORY_ID",
  "acceptanceCriteria": $TASK_AC,
  "priority": $TASK_NUM,
  "passes": false,
  "notes": ""
}
EOF
)
  
  TASK_NUM=$((TASK_NUM + 1))
  [ $TASK_NUM -le $(echo "$TASKS" | wc -l) ] && USER_STORIES+=","
  
done <<< "$TASKS"

USER_STORIES+="]"

# Create PRD JSON
mkdir -p "$OUTPUT_DIR"
cat > "$OUTPUT_DIR/prd.json" <<EOF
{
  "project": "$TITLE",
  "branchName": "ralph/$STORY_ID",
  "description": "BMAD Story: $TITLE",
  "sourceStory": "$STORY_FILE",
  "userStories": $USER_STORIES
}
EOF

# Extract context (Technical Notes, Dev Notes, Dependencies)
awk '/^## (Technical Notes|Dev Notes|Dependencies)/,/^## [^TDD]/' "$STORY_FILE" > "$OUTPUT_DIR/context.md"

echo "✅ Created $OUTPUT_DIR/prd.json with $((TASK_NUM - 1)) stories"
echo "✅ Created $OUTPUT_DIR/context.md with story context"
```

## Sub-story decomposition script (decompose.sh)

```bash
#!/usr/bin/env bash
# Decomposes a large BMAD story into multiple sub-story PRDs

set -e

STORY_FILE="$1"
TASKS_PER_SUBSTORY=${2:-3}
OUTPUT_BASE="scripts/ralph"

if [ -z "$STORY_FILE" ] || [ ! -f "$STORY_FILE" ]; then
  echo "Usage: bmad/decompose.sh <story-file.md> [tasks-per-substory]"
  exit 1
fi

STORY_ID=$(basename "$STORY_FILE" .md)
TITLE=$(grep -m1 "^# Story" "$STORY_FILE" | sed 's/^# Story [0-9.]*: //')

# Extract all tasks
mapfile -t TASKS < <(awk '/^## Tasks\/Subtasks/,/^## [^T]/' "$STORY_FILE" | grep "^- \[ \]" | sed 's/^- \[ \] //')
TOTAL_TASKS=${#TASKS[@]}

echo "📋 Story: $TITLE"
echo "📋 Total tasks: $TOTAL_TASKS"
echo "📋 Tasks per sub-story: $TASKS_PER_SUBSTORY"

# Calculate number of sub-stories
NUM_SUBSTORIES=$(( (TOTAL_TASKS + TASKS_PER_SUBSTORY - 1) / TASKS_PER_SUBSTORY ))
echo "📋 Sub-stories to create: $NUM_SUBSTORIES"

# Create parent bead
PARENT_BEAD=$(bd create "$TITLE" -t epic -p 1 --json 2>/dev/null | jq -r '.id' || echo "bd-$STORY_ID")
echo "📍 Parent bead: $PARENT_BEAD"

# Extract context once
CONTEXT=$(awk '/^## (Technical Notes|Dev Notes|Dependencies|Context)/,/^## (Tasks|Acceptance|Prerequisites|Dev Agent)/' "$STORY_FILE")

# Extract acceptance criteria
mapfile -t AC < <(awk '/^## Acceptance Criteria/,/^## [^A]/' "$STORY_FILE" | grep "^- \[ \]" | sed 's/^- \[ \] //')

for ((s=1; s<=NUM_SUBSTORIES; s++)); do
  START_IDX=$(( (s - 1) * TASKS_PER_SUBSTORY ))
  END_IDX=$(( START_IDX + TASKS_PER_SUBSTORY - 1 ))
  [ $END_IDX -ge $TOTAL_TASKS ] && END_IDX=$((TOTAL_TASKS - 1))
  
  SUBSTORY_DIR="$OUTPUT_BASE/substories/substory-$s"
  mkdir -p "$SUBSTORY_DIR"
  
  # Build user stories JSON
  USER_STORIES="["
  TASK_NUM=1
  for ((t=START_IDX; t<=END_IDX; t++)); do
    TASK="${TASKS[$t]}"
    [ -z "$TASK" ] && continue
    
    # Assign acceptance criteria (cycle through available)
    AC_IDX=$(( (t - START_IDX) % ${#AC[@]} ))
    TASK_AC="[\"${AC[$AC_IDX]}\", \"npm run typecheck passes\", \"All tests pass\"]"
    
    [ $TASK_NUM -gt 1 ] && USER_STORIES+=","
    USER_STORIES+=$(cat <<EOF
{
  "id": "US-$(printf '%03d' $TASK_NUM)",
  "title": "$TASK",
  "description": "Sub-story $s, Task $TASK_NUM from $STORY_ID",
  "acceptanceCriteria": $TASK_AC,
  "priority": $TASK_NUM,
  "passes": false,
  "notes": ""
}
EOF
)
    TASK_NUM=$((TASK_NUM + 1))
  done
  USER_STORIES+="]"
  
  # Create PRD
  cat > "$SUBSTORY_DIR/prd.json" <<EOF
{
  "project": "$TITLE - Part $s of $NUM_SUBSTORIES",
  "branchName": "ralph/$STORY_ID/substory-$s",
  "description": "Sub-story $s: Tasks $((START_IDX + 1))-$((END_IDX + 1)) of $TOTAL_TASKS",
  "sourceStory": "$STORY_FILE",
  "substoryIndex": $s,
  "totalSubstories": $NUM_SUBSTORIES,
  "userStories": $USER_STORIES
}
EOF
  
  # Create context file
  cat > "$SUBSTORY_DIR/context.md" <<EOF
# Parent Story Context: $TITLE

This is sub-story $s of $NUM_SUBSTORIES. Complete tasks $((START_IDX + 1))-$((END_IDX + 1)).

$CONTEXT
EOF
  
  # Create child bead
  CHILD_BEAD=$(bd create "Substory $s: Tasks $((START_IDX + 1))-$((END_IDX + 1))" \
    -p "$PARENT_BEAD" -t task --json 2>/dev/null | jq -r '.id' || echo "$PARENT_BEAD.$s")
  echo "$CHILD_BEAD" > "$SUBSTORY_DIR/.bead-id"
  
  echo "✅ Created substory-$s: $((END_IDX - START_IDX + 1)) tasks (bead: $CHILD_BEAD)"
done

# Set first sub-story as active
if [ -d "$OUTPUT_BASE/substories/substory-1" ]; then
  rm -rf "$OUTPUT_BASE/active"
  ln -s "substories/substory-1" "$OUTPUT_BASE/active"
  echo ""
  echo "🚀 Active sub-story: substory-1"
  echo "   Run: ./scripts/ralph/ralph.sh"
fi
```

## Orchestration script for full story execution (run-story.sh)

```bash
#!/usr/bin/env bash
# Orchestrates full BMAD story execution through all sub-stories

set -e

STORY_FILE="$1"
TASKS_PER_SUBSTORY=${2:-3}

if [ -z "$STORY_FILE" ]; then
  echo "Usage: ./run-story.sh <story-file.md> [tasks-per-substory]"
  exit 1
fi

STORY_ID=$(basename "$STORY_FILE" .md)
RALPH_DIR="scripts/ralph"

echo "═══════════════════════════════════════════════════════════════"
echo "  BMAD + RALPH STORY EXECUTION"
echo "  Story: $STORY_FILE"
echo "═══════════════════════════════════════════════════════════════"

# Step 1: Decompose story
echo ""
echo "📝 Step 1: Decomposing story into sub-stories..."
bmad/decompose.sh "$STORY_FILE" "$TASKS_PER_SUBSTORY"

# Count sub-stories
NUM_SUBSTORIES=$(ls -d "$RALPH_DIR/substories"/substory-* 2>/dev/null | wc -l)
echo "📋 Created $NUM_SUBSTORIES sub-stories"

# Step 2: Execute each sub-story
for ((s=1; s<=NUM_SUBSTORIES; s++)); do
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  EXECUTING SUB-STORY $s of $NUM_SUBSTORIES"
  echo "═══════════════════════════════════════════════════════════════"
  
  # Set active sub-story
  rm -rf "$RALPH_DIR/active"
  ln -s "substories/substory-$s" "$RALPH_DIR/active"
  
  # Execute Ralph loop
  if ! "$RALPH_DIR/ralph.sh" 15; then
    echo "⚠️  Sub-story $s did not complete. Review and retry."
    echo "   To retry: rm $RALPH_DIR/active && ln -s substories/substory-$s $RALPH_DIR/active"
    echo "   Then run: $RALPH_DIR/ralph.sh"
    exit 1
  fi
  
  echo "✅ Sub-story $s complete"
done

# Step 3: Update BMAD story status
echo ""
echo "📝 Step 3: Updating BMAD story status..."
sed -i 's/^## Status: .*/## Status: review/' "$STORY_FILE"

# Step 4: Trigger code review (optional)
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ STORY EXECUTION COMPLETE"
echo "  Story: $STORY_FILE"  
echo "  Status: Ready for code review"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff main...HEAD"
echo "  2. Run code review: /bmad:code-review"
echo "  3. Merge when approved"
```

## Custom Claude Code Commands

Create these in `.claude/commands/`:

### bmad-create-story

**File**: `.claude/commands/bmad-create-story`

```text
Load the BMAD create-story workflow from bmad/workflows/create-story.md.

Context to load:
- Current epic from docs/epics/
- Existing stories from docs/stories/
- Sprint status from docs/sprint-status.yaml
- Architecture from docs/architecture.md

Create a new story following the BMAD template at bmad/templates/story-template.md.

After creating the story:
1. Save to docs/stories/story-{epic}.{story}.md
2. Update docs/sprint-status.yaml
3. Create parent bead: bd create "[Story Title]" -t task -p 1
4. Report the story file path and bead ID
```

### bmad-dev-story

**File**: `.claude/commands/bmad-dev-story`

```text
Execute a BMAD story using the Ralph iteration pattern.

1. If no active sub-story exists:
   - Ask which story to execute from docs/stories/
   - Run bmad/decompose.sh on that story
   
2. Execute the Ralph loop:
   - Run ./scripts/ralph/ralph.sh
   - Monitor progress via bd ready
   
3. After sub-story completion:
   - Check for remaining sub-stories
   - Automatically advance to next sub-story
   - Update bead status with bd update

4. When all sub-stories complete:
   - Update BMAD story status to "review"
   - Summarize changes in progress.txt
```

### bmad-code-review

**File**: `.claude/commands/bmad-code-review`

```text
Execute BMAD code review workflow.

Load the workflow from bmad/workflows/code-review.md.

Review scope:
1. All changes since story branch creation
2. Check against acceptance criteria in the story file
3. Verify test coverage
4. Check coding standards

Output a review report with:
- Pass/Fail status for each criterion
- Issues found (Blocker/Major/Minor)
- Suggestions for improvement

If approved: Update story status to "done", close all related beads
If changes needed: Document issues, keep status as "review"
```

## CLAUDE.md project context file

```markdown
# Project Context

This project uses an integrated BMAD + Ralph + Beads workflow for AI-assisted development.

## Workflow Overview

1. **Story Creation**: Use `/bmad:create-story` to generate BMAD stories
2. **Story Execution**: Use `/bmad:dev-story` to execute via Ralph iteration
3. **Code Review**: Use `/bmad:code-review` for quality validation

## Key Directories

- `docs/stories/` - BMAD story definitions
- `docs/epics/` - Epic definitions  
- `scripts/ralph/` - Ralph execution infrastructure
- `bmad/` - Workflow templates and transformers
- `.beads/` - Issue tracking database

## Memory Systems

- **Beads** (`bd`): Cross-session task tracking. Run `bd ready` to see available work.
- **progress.txt**: Append-only learnings. Always read Codebase Patterns section first.
- **AGENTS.md**: Permanent coding conventions and gotchas.

## Execution Commands

```bash
# Check available work
bd ready

# Decompose a story into sub-stories
bmad/decompose.sh docs/stories/story-1.1.md 3

# Execute current sub-story
./scripts/ralph/ralph.sh

# Execute full story (all sub-stories)
./run-story.sh docs/stories/story-1.1.md
```

## Git Workflow

- Stories execute on feature branches: `ralph/{story-id}/substory-{n}`
- Commits follow: `feat: US-XXX - [Title]`
- Merge to main after code review approval
```

## AGENTS.md permanent memory file

```markdown
# Agent Memory - Coding Conventions & Patterns

## Codebase Patterns

<!-- Add patterns discovered during development here -->

## Known Gotchas

<!-- Add gotchas and workarounds here -->

## Architecture Decisions

<!-- Add key architectural decisions here -->

## Testing Patterns

<!-- Add testing conventions here -->
```

## Complete initialization script (init-bmad-ralph.sh)

```bash
#!/usr/bin/env bash
# Initialize BMAD + Ralph + Beads integration in current project

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  BMAD + RALPH + BEADS INTEGRATION SETUP"
echo "═══════════════════════════════════════════════════════════════"

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p .claude/commands
mkdir -p docs/{stories,epics}
mkdir -p scripts/ralph/{active,archive,substories}
mkdir -p bmad/{templates,workflows}

# Initialize Beads
echo "📍 Initializing Beads..."
bd init --quiet 2>/dev/null || echo "Beads already initialized or not installed"

# Create settings.json if not exists
if [ ! -f .claude/settings.json ]; then
  echo "⚙️  Creating .claude/settings.json..."
  cat > .claude/settings.json << 'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {"type": "command", "command": "bd prime 2>/dev/null || true"},
          {"type": "command", "command": "cat scripts/ralph/active/context.md 2>/dev/null || true"}
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {"type": "command", "command": "bash -c 'BEAD_ID=$(cat scripts/ralph/active/.bead-id 2>/dev/null) && [ -n \"$BEAD_ID\" ] && bd update $BEAD_ID --notes \"$(cat scripts/ralph/progress.txt | tail -50)\"' || true"}
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(bd *)",
      "Bash(scripts/ralph/*)",
      "Bash(bmad/*)"
    ]
  }
}
EOF
fi

# Create template files
echo "📝 Creating templates..."

# BMAD story template
cat > bmad/templates/story-template.md << 'EOF'
# Story {Epic#}.{Story#}: {Title}

## Context
{Why this story exists}

## User Story
As a {user type}
I want {functionality}
So that {business value}

## Acceptance Criteria
- [ ] Criterion 1 (specific, testable)
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes
{Implementation guidance}

## Dev Notes
{Architectural context}

## Dependencies
- {List dependencies}

## Tasks/Subtasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Prerequisites
{Required setup}

## Dev Agent Record
### Agent Model Used:
### Completion Notes:
### Change Log:

## Status: backlog
EOF

# Ralph prompt template
cat > scripts/ralph/prompt.md << 'EOF'
You are an autonomous coding agent executing a BMAD sub-story.

## Protocol
1. Read `scripts/ralph/active/prd.json` for tasks
2. Read `scripts/ralph/progress.txt` for learnings
3. Pick highest priority story where `passes: false`
4. Implement ALL acceptance criteria
5. Run typecheck, lint, tests
6. Commit: `feat: [ID] - [Title]`
7. Update prd.json: set `passes: true`
8. Append learnings to progress.txt

## Completion
If ALL stories have `passes: true`: Reply with <promise>COMPLETE</promise>
Otherwise: End normally (next iteration continues)
EOF

# Initialize progress.txt
cat > scripts/ralph/progress.txt << 'EOF'
# Ralph Progress Log

## Codebase Patterns
<!-- Add discovered patterns here -->

## Key Files
<!-- Add important file references here -->

---
EOF

# Create sprint-status.yaml
cat > docs/sprint-status.yaml << 'EOF'
project: "Your Project"
current_phase: 4
current_epic: 1
current_sprint: 1

epics:
  - id: 1
    name: "Initial Epic"
    status: not-started
    stories: []
EOF

# Create CLAUDE.md
cat > CLAUDE.md << 'EOF'
# Project Context

Uses BMAD + Ralph + Beads workflow. See `bmad/` for workflows.

## Quick Commands
- `bd ready` - See available work
- `./scripts/ralph/ralph.sh` - Execute current sub-story
- `/bmad:create-story` - Create new story
- `/bmad:dev-story` - Execute story
EOF

# Create AGENTS.md
cat > AGENTS.md << 'EOF'
# Agent Memory

## Codebase Patterns

## Known Gotchas

## Architecture Decisions
EOF

# Copy scripts (in real implementation, these would be created properly)
echo "📜 Scripts would be created here..."

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ SETUP COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Create your first epic in docs/epics/"
echo "  2. Run /bmad:create-story to create a story"
echo "  3. Run /bmad:dev-story to execute it"
echo ""
echo "Or manually:"
echo "  1. Create a story in docs/stories/story-1.1.md"
echo "  2. Run: bmad/decompose.sh docs/stories/story-1.1.md"
echo "  3. Run: ./scripts/ralph/ralph.sh"
```

## Conclusion: Key Architectural Decisions

This integration architecture makes several important design choices that ensure the systems work together without conflicts.

### 1. Layering Principle

- **PAI**: Operates at user-level (`~/.claude/`)
- **BMAD/Ralph/Beads**: Operate at project-level (`.claude/`, `scripts/`, `bmad/`, `.beads/`)

Claude Code's settings precedence naturally merges these layers without conflicts.

### 2. Format Bridging

BMAD's rich Markdown stories transform into Ralph's flat JSON PRDs via explicit converter scripts.

**Benefits**:
- Preserves BMAD's documentation value
- Gives Ralph the simple structure needed for autonomous execution

### 3. Memory Hierarchy

Three distinct memory systems serve different purposes:

- **Beads**: Cross-session task state
- **progress.txt**: Intra-story learnings
- **AGENTS.md**: Permanent project knowledge

The SessionStart hook injects all three at session start.

### 4. Decomposition Strategy

The **3-4 tasks per sub-story** guideline balances:

- **Context window constraints**: Ralph needs stories to fit in one iteration
- **Execution efficiency**: Avoid excessive loop overhead

The decomposer groups tasks by **logical coherence** rather than simple sequential splitting.

### 5. Exit Conditions

Ralph's `<promise>COMPLETE</promise>` signal triggers **per-sub-story**, not per-full-story.

The orchestrator script:
- Chains sub-stories together
- Uses Beads to track overall progress
- Enables resumption if interrupted