# RBP Stack Specification

**Ralph + Beads + PAI: Autonomous Epic Implementation**

Version: 2.0.0
Status: Draft
Author: JARVIS (PAI)
Date: 2026-01-09

---

## Executive Summary

The RBP Stack enables autonomous end-to-end Epic implementation by integrating three systems:

- **Beads**: Source of truth state engine providing dynamic memory, task scheduling, and enforcement
- **Ralph**: Iterative execution loop that queries Beads and drives continuous development
- **PAI**: Personal AI Infrastructure (unchanged, provides global identity)

The stack augments existing BMAD workflows with Beads-first enforcement, ensuring agents complete all required actions with verified test results before tasks close.

---

## Problem Statement

### The "Forgetful Agent" Problem

AI agents are good at coding but bad at housekeeping. They frequently:

- Complete code but forget to mark story status as "review"
- Update one artifact but not another (sprint-status.yaml vs story doc)
- Skip adding dev notes
- Mark tasks `[x]` without actually completing all requirements
- **Lie about completion** to exit early (mark checkbox without running tests)

### The Context Saturation Problem

Long-running tasks exhaust context windows, causing:

- State drift (agent forgets earlier decisions)
- Loss of coherence over extended conversations
- No persistent memory across sessions

### The Solution

**Beads as the primary state engine** (not a mirror):

1. `bd ready` returns the next task to work on
2. Tasks cannot close without passing tests (test-gated closure)
3. Playwright verification required for UI stories
4. Execution Sequencer groups large stories into manageable phases
5. Full audit trail via git-versioned `issues.jsonl`

---

## Architecture Overview

### Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│                     PAI (Global Layer)                       │
│              ~/.claude/ - Identity, Security                 │
│                    *** UNCHANGED ***                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ augments (does not modify)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Project Layer (.claude/)                    │
│         Project-level hooks for Beads integration            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ invokes
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 BMAD Workflows (_bmad/)                       │
│    /bmad:bmm:workflows:{create-story,dev-story,code-review}  │
│                    *** UNCHANGED ***                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ populates (one-time conversion)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              BEADS STATE ENGINE (.beads/)                    │
│     *** SOURCE OF TRUTH - NOT A MIRROR ***                  │
│     Dynamic memory + Task scheduler + Enforcement            │
│         bd ready → next task | bd close → verified           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ queried by (bd ready)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              RALPH LOOP (scripts/rbp/)                       │
│     Claude Code execution until bd ready returns nothing     │
│        Execution Sequencer groups subtasks into phases       │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Beads is the source of truth** - Ralph queries Beads, not story files
2. **PAI remains unchanged** - No modifications to global PAI configuration
3. **BMAD workflows remain unchanged** - Use existing slash commands as-is
4. **Test-gated closure** - `bd close` requires `bun test` to pass
5. **Playwright-gated UI** - UI stories require Playwright verification
6. **No atomizer needed** - 200k context fits all stories, but use Execution Sequencer for large ones

---

## Data Flow

### Story to Beads (One-Time Conversion)

```
BMAD story.md
     │
     │ parse-story-to-beads.sh
     │ (one-time conversion, NOT ongoing sync)
     ▼
Beads (issues.jsonl)
     │
     │ bd ready
     │ (returns next unblocked task)
     ▼
Ralph Loop executes task
     │
     │ bun test + playwright (if UI)
     │ (verification required)
     ▼
bd close (with proof)
     │
     │ bd ready (next task)
     ▼
Loop until all beads closed
```

### Why Beads Is Source of Truth (Not story.json)

| story.json approach | Beads-first approach |
|---------------------|----------------------|
| Flat JSON file | Graph with relationships |
| No history | Full git-backed audit trail |
| Agent marks `passes: true` | Agent must prove with test output |
| Reinvents state management | Uses purpose-built tool |
| Must sync two places | Single source of truth |

---

## Data Model

### 1:1 Mapping Between BMAD and Beads

| BMAD Artifact | Beads Equivalent | Relationship |
|---------------|------------------|--------------|
| Story | Parent Bead | 1 story = 1 parent bead |
| Task (## Task N:) | Child Bead | 1 task = 1+ child beads |
| Subtask (- [ ] N.N) | Atomic work unit | Grouped into execution phases |
| Housekeeping action | Child Bead | Explicit beads for status updates |

### BMAD Story Structure (from analysis)

```markdown
# Story X.Y: Title
Status: [done|in-progress|review]

## Story
As a **[role]**, I want **[feature]**, so that **[benefit]**.

## Acceptance Criteria
| AC# | Criteria | Verification |
|-----|----------|--------------|
| AC1 | [What] | [How to verify] |

## Tasks / Subtasks
- [ ] **Task 1: Title** (AC: #1, #2)
  - [ ] 1.1 Subtask description
  - [ ] 1.2 Another subtask
```

### Bead Hierarchy Example

```
bd-a1b2 (Story: "4-2-admin-dashboard")
├── bd-a1b2.1 (Task 1: Create constants file - AC: 12)
│   └── Subtasks: 1.1, 1.2 (execution phase 1)
├── bd-a1b2.2 (Task 2: Admin layout structure - AC: 1, 5, 6)
│   └── Subtasks: 2.1, 2.2 (execution phase 2)
├── bd-a1b2.3 (Task 3: AdminSidebar - AC: 2, 4, 5, 10, 11, 13)
│   └── Subtasks: 3.1-3.4 (execution phase 3)
├── ...
├── bd-a1b2.H1 (Housekeeping: Update sprint-status → in-progress)
├── bd-a1b2.H2 (Housekeeping: Update sprint-status → review)
└── bd-a1b2.H3 (Housekeeping: Add dev notes)
```

### Bead Fields

```json
{
  "id": "bd-a1b2.2",
  "title": "Task 2: Admin layout structure",
  "type": "task",
  "status": "open",
  "priority": 2,
  "parent": "bd-a1b2",
  "story_ref": "docs/bmm/implementation-artifacts/stories/story-4-2-admin-dashboard.md",
  "acceptance_criteria": ["AC1", "AC5", "AC6"],
  "subtasks": ["2.1", "2.2"],
  "requires_playwright": true,
  "dependencies": ["bd-a1b2.1"],
  "notes": ""
}
```

---

## Execution Sequencer

### The Problem

Large stories have 50-70 subtasks. While they fit in token budget (largest = 12.9%), executing all subtasks without structure leads to:

- Cognitive overload
- No intermediate verification
- No commit checkpoints

### The Solution: Execution Phases

The Execution Sequencer groups subtasks into phases of 3-5 subtasks each:

```
Task 3: AdminSidebar (9 subtasks total)
├── Phase 1: Setup (subtasks 3.1-3.2)
│   └── Verify: Component renders, basic styling
│   └── Commit: "feat(admin): scaffold AdminSidebar component"
├── Phase 2: Navigation (subtasks 3.3-3.4)
│   └── Verify: Links render, routing works
│   └── Commit: "feat(admin): add sidebar navigation links"
└── Phase 3: Features (subtasks 3.5-3.9)
    └── Verify: Collapse, persistence, keyboard shortcut
    └── Commit: "feat(admin): complete sidebar interactions"
```

### Sequencer Logic

```bash
#!/usr/bin/env bash
# scripts/rbp/sequencer.sh
# Groups subtasks into execution phases

BEAD_ID=$1
PHASE_SIZE=${2:-5}  # Default 5 subtasks per phase

# Get subtask count
SUBTASKS=$(bd show "$BEAD_ID" --json | jq -r '.subtasks | length')

if [ "$SUBTASKS" -le "$PHASE_SIZE" ]; then
  echo "SINGLE_PHASE"
  exit 0
fi

# Calculate phases
PHASES=$(( (SUBTASKS + PHASE_SIZE - 1) / PHASE_SIZE ))

echo "MULTI_PHASE:$PHASES"
for i in $(seq 1 $PHASES); do
  START=$(( (i - 1) * PHASE_SIZE + 1 ))
  END=$(( i * PHASE_SIZE ))
  [ $END -gt $SUBTASKS ] && END=$SUBTASKS
  echo "PHASE_$i:$START-$END"
done
```

---

## Verification System

### Multi-Layered Defense Against Lying Agents

```
Layer 1: Objective Acceptance Criteria
  └─ Every task auto-includes: "bun run test passes"

Layer 2: Protocol Mandate
  └─ Worker instructions require: Implement → Test → Verify → Close

Layer 3: Test Gating (CRITICAL)
  └─ bd close REQUIRES test output as proof
  └─ No checkbox marking - only bd close counts

Layer 4: Playwright Gating (UI stories)
  └─ UI acceptance criteria require: "playwright test passes"
  └─ Visual verification, not just unit tests

Layer 5: Code Review
  └─ Separate adversarial agent validates all ACs

Layer 6: Audit Trail
  └─ All state changes in git-versioned issues.jsonl
```

### Test-Gated Closure

```bash
#!/usr/bin/env bash
# scripts/rbp/close-with-proof.sh

BEAD_ID=$1

# Get bead info
BEAD_JSON=$(bd show "$BEAD_ID" --json)
REQUIRES_PLAYWRIGHT=$(echo "$BEAD_JSON" | jq -r '.requires_playwright // false')

# Run unit/integration tests
echo "Running bun test..."
if ! bun run test 2>&1 | tee /tmp/test-output.txt; then
  echo "FAILED: Tests did not pass. Bead remains open."
  exit 1
fi

# Run Playwright if required
if [ "$REQUIRES_PLAYWRIGHT" = "true" ]; then
  echo "Running Playwright verification..."
  if ! bunx playwright test --reporter=line 2>&1 | tee /tmp/playwright-output.txt; then
    echo "FAILED: Playwright tests did not pass. Bead remains open."
    exit 1
  fi
fi

# Close with proof
bd close "$BEAD_ID" --reason "Verified: $(tail -5 /tmp/test-output.txt)"
echo "CLOSED: $BEAD_ID"
```

### Playwright Integration

For UI stories, Playwright verification is **required** before closure:

```typescript
// tests/admin-dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('AC1: AdminLayout renders sidebar and content', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('[data-testid="admin-layout"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-sidebar"]')).toHaveCSS('width', '256px');
});

test('AC4: Sidebar collapses with 200ms animation', async ({ page }) => {
  await page.goto('/admin');
  const sidebar = page.locator('[data-testid="admin-sidebar"]');
  await page.click('[data-testid="sidebar-toggle"]');
  // Playwright handles animation timing
  await expect(sidebar).toHaveCSS('width', '64px');
});
```

---

## Ralph Loop Implementation

### ralph.sh (Claude Code Version)

```bash
#!/usr/bin/env bash
# scripts/rbp/ralph.sh
# Iterates until all Beads are closed

set -e

MAX_ITERATIONS=${1:-50}
PROMPT_FILE="scripts/rbp/prompt.md"
PROGRESS_FILE="scripts/rbp/progress.txt"

echo "═══════════════════════════════════════════════════════════════"
echo "  RBP STACK - RALPH LOOP (Claude Code)"
echo "  Max iterations: $MAX_ITERATIONS"
echo "═══════════════════════════════════════════════════════════════"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "═══ Iteration $i of $MAX_ITERATIONS ═══"

  # Query Beads for next ready task
  READY_TASK=$(bd ready --json 2>/dev/null | jq -r '.[0] // empty')

  if [ -z "$READY_TASK" ]; then
    OPEN_COUNT=$(bd list --status open --json 2>/dev/null | jq 'length')

    if [ "$OPEN_COUNT" -eq 0 ]; then
      echo ""
      echo "═══════════════════════════════════════════════════════════════"
      echo "  ALL BEADS CLOSED - STORY COMPLETE"
      echo "  <promise>COMPLETE</promise>"
      echo "═══════════════════════════════════════════════════════════════"
      exit 0
    else
      echo "Tasks are open but blocked. Manual intervention required."
      bd list --status open
      exit 1
    fi
  fi

  # Extract task details
  TASK_ID=$(echo "$READY_TASK" | jq -r '.id')
  TASK_TITLE=$(echo "$READY_TASK" | jq -r '.title')
  STORY_REF=$(echo "$READY_TASK" | jq -r '.story_ref')
  REQUIRES_PLAYWRIGHT=$(echo "$READY_TASK" | jq -r '.requires_playwright // false')

  echo "Task: $TASK_TITLE"
  echo "Bead: $TASK_ID"
  echo "Playwright Required: $REQUIRES_PLAYWRIGHT"

  # Check if multi-phase execution needed
  PHASE_INFO=$(scripts/rbp/sequencer.sh "$TASK_ID")
  echo "Execution: $PHASE_INFO"

  # Mark bead in progress
  bd update "$TASK_ID" --status in_progress 2>/dev/null || true

  # Build prompt with task context
  PROMPT=$(cat <<EOF
$(cat "$PROMPT_FILE")

---

## Current Task

**Bead ID**: $TASK_ID
**Title**: $TASK_TITLE
**Story**: $STORY_REF
**Playwright Required**: $REQUIRES_PLAYWRIGHT
**Execution Mode**: $PHASE_INFO

### Acceptance Criteria
$(bd show "$TASK_ID" --json 2>/dev/null | jq -r '.acceptance_criteria | join("\n- ")' || echo "See story file")

### Subtasks
$(bd show "$TASK_ID" --json 2>/dev/null | jq -r '.subtasks | join("\n- ")' || echo "See story file")

### Notes from Previous Iterations
$(bd show "$TASK_ID" --json 2>/dev/null | jq -r '.notes // "None"')

---

## Progress Log (recent)

$(tail -30 "$PROGRESS_FILE" 2>/dev/null || echo "No previous progress")
EOF
)

  # Execute Claude Code (pipe prompt to claude CLI)
  echo "$PROMPT" | claude --print 2>&1 | tee -a "$PROGRESS_FILE"

  # Brief pause between iterations
  sleep 2
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  MAX ITERATIONS REACHED"
echo "═══════════════════════════════════════════════════════════════"
exit 1
```

### prompt.md

```markdown
# RBP Agent Instructions

You are an autonomous coding agent in the RBP Stack, powered by Claude Code.

## Protocol

1. **Check Bead**: Read the current task from Beads (provided below)
2. **Load Context**: Read the story file for full acceptance criteria
3. **Implement**: Complete the task following existing code patterns
4. **Test**: Run `bun run test`
5. **Playwright** (if required): Run `bunx playwright test`
6. **Close Bead**: Run `scripts/rbp/close-with-proof.sh <BEAD_ID>`
7. **Continue**: End response (next iteration picks up next task)

## Critical Rules

- ONLY work on the task specified in this prompt
- MUST run tests before attempting to close bead
- DO NOT mark story checkboxes - only `bd close` matters
- If tests fail, FIX THE CODE and re-test (do not skip)
- For multi-phase tasks, commit after each phase

## Verification Commands

```bash
# Unit/integration tests
bun run test

# Playwright (if requires_playwright: true)
bunx playwright test

# Close bead with proof
scripts/rbp/close-with-proof.sh <BEAD_ID>
```

## Multi-Phase Execution

If the task shows `MULTI_PHASE:N`, execute in phases:

1. Implement subtasks for phase 1
2. Run tests
3. Commit: `git commit -m "feat(scope): phase 1 - description"`
4. Proceed to phase 2
5. Repeat until all phases complete
6. Close bead with proof

## Completion Signal

When you successfully close a bead, the loop will automatically:
1. Query `bd ready` for the next task
2. Start a fresh iteration with that task

If ALL beads are closed, the loop exits with `<promise>COMPLETE</promise>`.

## Begin

Read the story file at the path specified above, then implement the current task.
```

---

## Hook Configuration

### Project-Level Settings (.claude/settings.json)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bd prime 2>/dev/null || echo 'Beads not initialized'"
      },
      {
        "type": "command",
        "command": "scripts/rbp/show-active-task.sh"
      }
    ],
    "PreCompact": [
      {
        "type": "command",
        "command": "scripts/rbp/save-progress-to-beads.sh"
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(bd *)",
      "Bash(bun *)",
      "Bash(bunx playwright *)",
      "Bash(scripts/rbp/*)"
    ]
  }
}
```

Note: No `PostToolUse` hook for syncing - Beads is the source of truth, not story checkboxes.

---

## File Structure

```
your-project/
├── .claude/
│   └── settings.json              # Project-level hooks
│
├── .beads/
│   ├── config.yaml                # Beads configuration
│   ├── issues.jsonl               # SOURCE OF TRUTH (git-tracked)
│   └── beads.db                   # SQLite cache (gitignored)
│
├── _bmad/                         # BMAD installation (unchanged)
│   └── bmm/workflows/
│
├── docs/bmm/implementation-artifacts/
│   ├── stories/                   # BMAD story files (reference only)
│   └── sprint-status.yaml
│
├── scripts/rbp/
│   ├── ralph.sh                   # Main execution loop
│   ├── prompt.md                  # Agent instructions
│   ├── progress.txt               # Append-only learnings
│   ├── sequencer.sh               # Execution phase grouping
│   ├── close-with-proof.sh        # Test-gated bead closure
│   ├── parse-story-to-beads.sh    # One-time story → beads conversion
│   ├── show-active-task.sh
│   └── save-progress-to-beads.sh
│
├── tests/                         # Playwright tests
│   └── *.spec.ts
│
├── AGENTS.md                      # Permanent agent memory
└── CLAUDE.md                      # Project context
```

---

## Story Analysis (From Real Data)

Based on analysis of 76 BMAD stories:

| Metric | Value |
|--------|-------|
| Total stories | 76 |
| Avg tokens/story | 3,914 |
| Largest story | 12,962 tokens (12.9% of 100k usable budget) |
| Avg subtasks/story | 24 |
| Most complex | 70 subtasks (story-3-7-review-incorrect-answers.md) |

### Story Complexity Distribution

| Size | Count | Strategy |
|------|-------|----------|
| Small (≤2 tasks) | 38 | Single loop, no phases |
| Medium (3-5 tasks) | 3 | Single loop, commit per task |
| Large (>5 tasks) | 35 | Multi-phase execution, commit per phase |

### Verdict: No Atomizer Needed

All stories fit within 200k token budget. Use **Execution Sequencer** for large stories instead of splitting them.

---

## Initialization

### First-Time Setup

```bash
# 1. Install BMAD (if not already)
bunx bmad-method@alpha install

# 2. Initialize Beads
bd init

# 3. Create RBP scripts directory
mkdir -p scripts/rbp

# 4. Copy RBP scripts (from this spec or template repo)
# ralph.sh, prompt.md, sequencer.sh, close-with-proof.sh, etc.

# 5. Create project-level Claude settings
mkdir -p .claude
cat > .claude/settings.json << 'EOF'
{
  "hooks": {
    "SessionStart": [
      {"type": "command", "command": "bd prime 2>/dev/null || true"},
      {"type": "command", "command": "scripts/rbp/show-active-task.sh"}
    ]
  }
}
EOF

# 6. Install Playwright
bunx playwright install

# 7. Initialize progress file
echo "# RBP Progress Log" > scripts/rbp/progress.txt
```

---

## Execution Flow

### Starting a New Story

```bash
# 1. Create story using BMAD (existing workflow)
# Invoke: /bmad:bmm:workflows:create-story

# 2. Convert story to Beads (one-time)
scripts/rbp/parse-story-to-beads.sh docs/bmm/implementation-artifacts/stories/story-X-Y-title.md

# 3. Start Ralph loop
scripts/rbp/ralph.sh
```

### Resuming Work

```bash
# Ralph automatically resumes from where it left off
# bd ready returns the next unblocked task
scripts/rbp/ralph.sh
```

---

## Monitoring

### Check Progress

```bash
# See what's ready to work on
bd ready

# See all open tasks
bd list --status open

# See closed tasks
bd list --status closed

# Watch real-time
watch -n 5 "bd list --json | jq '.[] | {id, title, status}'"
```

---

## Changelog

### v2.0.0 (2026-01-09)

- **BREAKING**: Beads is now source of truth (not story.json mirror)
- **BREAKING**: Claude Code replaces amp as execution engine
- Added: Execution Sequencer for large stories
- Added: Playwright verification required for UI stories
- Added: Test-gated closure with proof
- Added: Multi-phase commit strategy
- Removed: PostToolUse sync hook (no longer needed)
- Removed: story.json concept (use Beads directly)
- Updated: Story analysis from 76 real BMAD stories
- Updated: All scripts for new architecture

### v1.0.0 (2026-01-09)

- Initial specification (superseded by v2.0.0)
