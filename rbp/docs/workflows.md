# RBP Stack Workflows Guide

**Version:** 3.0.0
**Last Updated:** January 25, 2026
**Status:** Production

---

## Table of Contents

- [Overview](#overview)
- [BMAD Workflow](#bmad-workflow)
- [Beads Workflow](#beads-workflow)
- [Quick-Plan Workflow](#quick-plan-workflow)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Overview

The RBP Stack supports three primary workflows:

1. **BMAD Workflow** - Epic-driven development with structured stories
2. **Beads Workflow** - Direct task-based development
3. **Quick-Plan Workflow** - Spec-driven development with optional Codex review

All workflows share the same core execution loop and test-gated closure system.

---

## BMAD Workflow

**Best for:** Large projects with multiple epics, formal requirements, and structured story creation.

### Overview

The BMAD (Business Model → Architecture → Development) workflow integrates with the BMAD methodology for structured Epic implementation.

**Key components:**
- BMAD story files (`docs/bmm/implementation-artifacts/stories/`)
- Sprint status tracking (`docs/sprint-status.yaml`)
- BMAD slash commands (`/bmad:bmm:workflows:*`)
- Story-to-Beads conversion

---

### Step 1: Create Epic and Stories

**Using BMAD slash commands:**

```bash
# In Claude Code CLI
/bmad:bmm:workflows:create-story
```

**What this does:**
1. Prompts for epic information
2. Generates story structure
3. Creates acceptance criteria
4. Defines tasks and subtasks
5. Saves to `docs/bmm/implementation-artifacts/stories/`

**Example story structure:**
```markdown
# Story 4.2: Admin Dashboard

Status: in-progress

## Story

As an **administrator**, I want **a comprehensive dashboard**, so that **I can monitor system activity**.

## Acceptance Criteria

| AC# | Criteria | Verification |
|-----|----------|--------------|
| AC1 | Dashboard displays user count | Playwright test verifies count element |
| AC2 | Sidebar navigates to sections | Click navigation, verify URL change |
| AC3 | Layout responsive on mobile | Playwright mobile viewport test |

## Tasks / Subtasks

- [ ] **Task 1: Create constants file** (AC: #1)
  - [ ] 1.1 Define dashboard routes
  - [ ] 1.2 Create navigation items array

- [ ] **Task 2: Admin layout structure** (AC: #1, #2)
  - [ ] 2.1 Create AdminLayout component
  - [ ] 2.2 Add sidebar and content area

- [ ] **Task 3: AdminSidebar component** (AC: #2, #3)
  - [ ] 3.1 Scaffold component
  - [ ] 3.2 Add navigation links
  - [ ] 3.3 Implement collapse functionality
```

---

### Step 2: Convert Story to Beads

**Parse story into Beads tasks:**

```bash
# One-time conversion from story to beads
./scripts/parse-story-to-beads.sh docs/bmm/implementation-artifacts/stories/story-4-2-admin-dashboard.md
```

**What this does:**
1. Parses story markdown
2. Creates parent bead for story
3. Creates child beads for tasks
4. Creates atomic beads for subtasks
5. Sets up dependency chain
6. Adds acceptance criteria to beads

**Example bead hierarchy:**
```
bd-abc123 (Story: "4-2-admin-dashboard")
├── bd-abc123.1 (Task 1: Create constants file)
│   ├── bd-abc123.1.1 (Subtask: 1.1)
│   └── bd-abc123.1.2 (Subtask: 1.2, depends on 1.1)
├── bd-abc123.2 (Task 2: Admin layout, depends on 1.2)
│   ├── bd-abc123.2.1 (Subtask: 2.1)
│   └── bd-abc123.2.2 (Subtask: 2.2, depends on 2.1)
└── bd-abc123.3 (Task 3: AdminSidebar, depends on 2.2)
    ├── bd-abc123.3.1 (Subtask: 3.1)
    ├── bd-abc123.3.2 (Subtask: 3.2, depends on 3.1)
    └── bd-abc123.3.3 (Subtask: 3.3, depends on 3.2)
```

**Verify conversion:**
```bash
bd list
# Should show all created beads

bd graph
# Should show dependency graph
```

---

### Step 3: Start Autonomous Execution

**Using slash command:**

```bash
# In Claude Code CLI
/rbp:start
```

**What this does:**
1. Checks for PAI Observability Dashboard
2. Launches dashboard if not running
3. Shows current status
4. Runs `ralph run` (auto-detects BMAD workflow)
5. Loops until completion

**Manual execution:**

```bash
ralph run --bmad
```

---

### Step 4: Monitor Progress

**Check status:**
```bash
ralph status
```

**Watch real-time:**
```bash
# Open observability dashboard
open http://localhost:5172

# Or watch beads
watch -n 5 "bd list --status open"
```

**Check completion:**
```bash
bd list --status closed
```

---

### Step 5: Code Review (Optional)

**Invoke code review workflow:**

```bash
# In Claude Code CLI
/bmad:bmm:workflows:code-review
```

**What this does:**
1. Reviews completed story
2. Validates all acceptance criteria
3. Checks test coverage
4. Reviews code quality
5. Provides feedback

---

### Step 6: Update Story Status

**Mark story complete:**

After all tasks are verified:

1. Update story markdown:
   ```markdown
   Status: done
   ```

2. Update sprint status:
   ```yaml
   # docs/sprint-status.yaml
   stories:
     - id: "4-2"
       title: "Admin Dashboard"
       status: done  # Changed from in-progress
   ```

3. Sync changes:
   ```bash
   bd sync
   git add .
   git commit -m "Complete story 4-2: Admin Dashboard"
   ```

---

### BMAD Workflow Summary

```
Create Epic
    ↓
Create Story via /bmad:bmm:workflows:create-story
    ↓
Parse to Beads (one-time)
    ↓
/rbp:start (autonomous execution)
    ↓
Monitor progress
    ↓
/bmad:bmm:workflows:code-review (optional)
    ↓
Update story status → done
    ↓
Commit and sync
```

---

## Beads Workflow

**Best for:** Agile teams, direct task management, no formal story requirements.

### Overview

The Beads workflow uses Beads directly for task management without BMAD stories.

**Key components:**
- Beads CLI (`bd` commands)
- Direct task creation and management
- No story files required
- Flexible dependency management

---

### Step 1: Initialize Beads

```bash
# Initialize beads in project
bd init

# Configure project
bd config set project.name "Your Project"
bd config set defaults.labels "rbp,feature"
```

---

### Step 2: Create Tasks

**Manual creation:**

```bash
# Create parent task
bd create "Implement user authentication" \
  --description "Add JWT-based auth to API" \
  --priority 1 \
  --labels feature,auth

# Get task ID from output
# Example: bd-abc123

# Create subtasks with dependencies
bd create "Create auth middleware" \
  --parent bd-abc123 \
  --labels subtask

bd create "Add login endpoint" \
  --parent bd-abc123 \
  --depends bd-abc123.1 \
  --labels subtask

bd create "Add token validation" \
  --parent bd-abc123 \
  --depends bd-abc123.2 \
  --labels subtask
```

**Using JSON import:**

```bash
# Create tasks.json
cat > tasks.json << 'EOF'
[
  {
    "title": "Implement user authentication",
    "description": "Add JWT-based auth",
    "acceptance_criteria": [
      "Login endpoint returns valid JWT",
      "Protected routes verify token",
      "bun test passes"
    ],
    "estimated_size": "medium",
    "priority": 1
  },
  {
    "title": "Create auth middleware",
    "parent": "bd-abc123",
    "estimated_size": "small"
  }
]
EOF

# Import (if bd supports JSON import)
bd import tasks.json
```

---

### Step 3: Set Acceptance Criteria

```bash
# Update task with acceptance criteria
bd update bd-abc123 \
  --notes "
Acceptance Criteria:
- Login endpoint returns valid JWT
- Protected routes verify token
- Tests pass (bun test)
- Playwright tests pass (auth flow)
"
```

**Or use description field (RBP extension):**

```bash
# If Beads supports custom fields
bd set bd-abc123 acceptance_criteria "Login endpoint returns JWT"
bd set bd-abc123 acceptance_criteria --append "Protected routes verify token"
bd set bd-abc123 acceptance_criteria --append "bun test passes"
```

---

### Step 4: Start Autonomous Execution

```bash
# Using slash command
/rbp:start

# Or manually
ralph run --beads
```

---

### Step 5: Track Progress

**View next task:**
```bash
bd ready
```

**View all tasks:**
```bash
bd list
```

**View specific task:**
```bash
bd show bd-abc123
```

**View dependency graph:**
```bash
bd graph
```

---

### Step 6: Manual Intervention (if needed)

**Update task status:**
```bash
bd update bd-abc123 --status in_progress
```

**Add notes:**
```bash
bd update bd-abc123 --notes "WIP: Implemented middleware, need to add tests"
```

**Close task manually:**
```bash
# Not recommended - use ralph close instead
ralph close bd-abc123
```

---

### Beads Workflow Summary

```
bd init
    ↓
Create tasks (bd create)
    ↓
Set acceptance criteria
    ↓
ralph run --beads
    ↓
Monitor (bd ready, bd list)
    ↓
Manual intervention if needed
    ↓
All tasks closed
```

---

## Quick-Plan Workflow

**Best for:** Feature planning, spec-driven development, rapid iteration.

### Overview

The Quick-Plan workflow uses specification files for feature planning with optional adversarial review by Codex.

**Key components:**
- Spec files (`specs/*.md`)
- `/quick-plan` slash command
- Codex review (optional)
- Spec-to-Beads conversion

---

### Step 1: Create Spec

**Using quick-plan command:**

```bash
# In Claude Code CLI
/quick-plan "Implement user authentication with JWT"
```

**What this does:**
1. Asks clarifying questions
2. Analyzes codebase architecture
3. Generates implementation spec
4. Creates acceptance criteria
5. Defines task breakdown
6. Saves to `specs/user-auth.md`

**Example spec structure:**
```markdown
# Spec: User Authentication with JWT

## Overview

Implement JWT-based authentication for the API.

## Acceptance Criteria

- [ ] AC1: Login endpoint returns valid JWT token
- [ ] AC2: Protected routes verify JWT token
- [ ] AC3: Token refresh mechanism works
- [ ] AC4: Tests pass (bun test)
- [ ] AC5: Playwright tests pass (auth flow)

## Implementation Plan

<!-- RBP-TASKS-START -->

### Task 1: Auth Middleware

**Description:** Create middleware to validate JWT tokens

**Subtasks:**
- Create `middleware/auth.ts`
- Implement token validation logic
- Add error handling for invalid tokens
- Write unit tests

**Acceptance Criteria:** AC2

**Estimated Size:** medium

---

### Task 2: Login Endpoint

**Description:** Create POST /auth/login endpoint

**Subtasks:**
- Create route handler
- Implement credential validation
- Generate JWT token
- Write integration tests

**Acceptance Criteria:** AC1

**Estimated Size:** medium

**Depends On:** Task 1

<!-- RBP-TASKS-END -->

## Test Plan

- Unit tests for middleware
- Integration tests for login endpoint
- Playwright E2E test for full auth flow
```

---

### Step 2: Review Spec (Optional)

**Manual review:**
```bash
# Edit spec file
code specs/user-auth.md
```

**Codex review (adversarial):**

If Codex is enabled in config:
```yaml
codex:
  enabled: true
  model: "gpt-5-codex"
  reasoning_effort: "high"
```

Codex automatically reviews the spec and provides feedback.

---

### Step 3: Convert Spec to Beads

```bash
# Parse spec to beads
./scripts/parse-spec-to-beads.sh specs/user-auth.md
```

**What this does:**
1. Parses spec markdown between `RBP-TASKS-START` and `RBP-TASKS-END`
2. Creates beads for each task
3. Creates atomic subtasks with dependencies
4. Extracts acceptance criteria
5. Sets estimated_size field
6. Links to spec file

---

### Step 4: Execute Spec

**Using exec-spec command:**

```bash
ralph exec-spec specs/user-auth.md
```

**What this does:**
1. Parses spec to beads (if not already done)
2. Runs Codex review (if enabled and not `--skip-review`)
3. Executes autonomous loop
4. Reports completion

**With options:**

```bash
# Skip Codex review
ralph exec-spec specs/user-auth.md --skip-review

# Limit iterations
ralph exec-spec specs/user-auth.md --max-iterations 20

# Dry run
ralph exec-spec specs/user-auth.md --dry-run
```

---

### Step 5: Monitor and Iterate

**Check progress:**
```bash
ralph status
```

**Update spec if needed:**

If requirements change:
1. Edit `specs/user-auth.md`
2. Re-parse: `./scripts/parse-spec-to-beads.sh specs/user-auth.md`
3. Continue execution: `ralph run`

---

### Quick-Plan Workflow Summary

```
/quick-plan "Feature description"
    ↓
Generated spec saved
    ↓
Codex review (optional)
    ↓
ralph exec-spec specs/feature.md
    ↓
Autonomous execution
    ↓
Monitor progress
    ↓
Update spec if needed → Re-parse → Continue
```

---

## Common Patterns

### Pattern 1: Starting Fresh Project

```bash
# 1. Initialize beads
bd init
bd config set project.name "My Project"

# 2. Create initial tasks
bd create "Setup project structure" --priority 1
bd create "Add linting and formatting" --priority 2
bd create "Configure CI/CD" --priority 3

# 3. Start autonomous execution
ralph run

# 4. Monitor
watch -n 5 "bd list --status open"
```

---

### Pattern 2: Daily Development

```bash
# Morning: Check status
ralph status

# Start work session
/rbp:start

# Lunch: Check progress
bd list --status closed | tail -10

# Afternoon: Continue
ralph run

# Evening: Sync and commit
bd sync
git add .
git commit -m "Daily progress: $(date +%Y-%m-%d)"
git push
```

---

### Pattern 3: Feature Development

```bash
# 1. Create feature spec
/quick-plan "Add user profile editing"

# 2. Review generated spec
code specs/user-profile-editing.md

# 3. Execute with Codex review
ralph exec-spec specs/user-profile-editing.md

# 4. Monitor observability dashboard
open http://localhost:5172

# 5. Verify completion
bd list --status closed | grep "profile"

# 6. Manual testing
npm run dev
# Test in browser

# 7. Commit
git add .
git commit -m "feat: Add user profile editing"
```

---

### Pattern 4: Bug Fixing

```bash
# 1. Create bug task
bd create "Fix: Login fails with special characters in password" \
  --description "Password validation regex is incorrect" \
  --priority 1 \
  --labels bug,security

# 2. Add reproduction steps to notes
bd update bd-bug123 --notes "
Reproduction:
1. Try password: p@ssw0rd!
2. Login fails with 400 error
3. Expected: Should accept special chars
"

# 3. Start focused execution
ralph run --max-iterations 5

# 4. Verify fix
bun test
bunx playwright test

# 5. Close with proof
ralph close bd-bug123

# 6. Commit
git add .
git commit -m "fix: Accept special chars in password validation"
```

---

### Pattern 5: Large Epic Decomposition

**When epic is too large:**

```bash
# 1. Create parent bead for epic
bd create "Epic: Admin Dashboard Redesign" \
  --description "Complete redesign of admin interface" \
  --labels epic

# Get epic ID (e.g., bd-epic123)

# 2. Create child beads for major features
bd create "Feature: New sidebar navigation" \
  --parent bd-epic123 \
  --labels feature

bd create "Feature: Dashboard widgets" \
  --parent bd-epic123 \
  --depends bd-epic123.1 \
  --labels feature

bd create "Feature: User management" \
  --parent bd-epic123 \
  --depends bd-epic123.2 \
  --labels feature

# 3. Create subtasks for each feature
bd create "Design sidebar component" \
  --parent bd-epic123.1 \
  --labels subtask

bd create "Implement routing" \
  --parent bd-epic123.1 \
  --depends bd-epic123.1.1 \
  --labels subtask

# 4. Execute with phases
# Execution Sequencer automatically groups into phases
ralph run --max-iterations 100

# 5. Monitor phases
bd graph | less
```

---

### Pattern 6: CI/CD Integration

**GitHub Actions example:**

```yaml
# .github/workflows/rbp-auto.yml
name: RBP Autonomous Execution

on:
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours
  workflow_dispatch:

jobs:
  auto-execute:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Setup Beads
        run: |
          curl -fsSL https://beads.dev/install.sh | bash
          bd init

      - name: Run RBP
        run: |
          ralph --json-errors run --max-iterations 5 > output.json
        continue-on-error: true

      - name: Check results
        run: |
          if [ $? -eq 0 ]; then
            echo "Success: Tasks completed"
          else
            echo "Error occurred:"
            cat output.json | jq '.error'
            exit 1
          fi

      - name: Commit results
        run: |
          git config user.name "RBP Bot"
          git config user.email "bot@example.com"
          git add .
          git commit -m "RBP: Auto-execution $(date +%Y-%m-%d)" || true
          git push
```

---

### Pattern 7: Recovery from Failures

**When tasks fail repeatedly:**

```bash
# 1. Check failure notes
bd show bd-failed123

# 2. Analyze error
tail -50 scripts/progress.txt

# 3. Fix manually if needed
# Edit code to fix issue

# 4. Run tests locally
bun test
bunx playwright test

# 5. Update bead with fix notes
bd update bd-failed123 --notes "Fixed: Updated regex pattern"

# 6. Try closing again
ralph close bd-failed123

# 7. If still fails, decompose
bd create "Subtask: Fix regex pattern" \
  --parent bd-failed123

bd create "Subtask: Add test coverage" \
  --parent bd-failed123 \
  --depends bd-failed123.1

# 8. Close original, work on subtasks
bd close bd-failed123
ralph run
```

---

## Troubleshooting

### Issue: "No workflow detected"

**Symptom:**
```
Error: Could not detect workflow type
  Suggestion: Use --bmad or --beads flag, or initialize beads
```

**Solution:**
```bash
# Option 1: Initialize Beads
bd init
ralph run

# Option 2: Use explicit flag
ralph run --beads

# Option 3: Create sprint-status.yaml for BMAD
mkdir -p docs
echo "project: My Project" > docs/sprint-status.yaml
ralph run --bmad
```

---

### Issue: "bd ready: No open issues"

**Symptom:**
```
No open issues found
Loop exits immediately
```

**Solution:**
```bash
# Check beads status
bd list

# If empty, create tasks
bd create "Test task"

# Or parse story/spec
./scripts/parse-story-to-beads.sh docs/stories/story.md

# Verify
bd ready
```

---

### Issue: Tests fail but task closes anyway

**Symptom:**
```
Tests failed but task marked closed
```

**Cause:** Using `bd close` directly instead of `ralph close`

**Solution:**
```bash
# Always use ralph close
ralph close bd-abc123

# Never use bd close directly
# bd close bd-abc123  # ❌ WRONG
```

---

### Issue: Task stuck in retry loop

**Symptom:**
```
Same task executes repeatedly
Tests fail every time
No progress
```

**Solution:**
```bash
# 1. Check failure notes
bd show bd-stuck123

# 2. View failure history
bd show bd-stuck123 | grep "FAILED:"

# 3. Fix code manually
code src/problem-file.ts

# 4. Run tests locally
bun test

# 5. Once passing, close task
ralph close bd-stuck123

# 6. If tests still fail, force close and create new task
ralph close bd-stuck123 --force
bd create "Fix: Address test failures in feature X" \
  --description "Previous attempt had issues: [describe]"
```

---

### Issue: Observability dashboard not launching

**Symptom:**
```
/rbp:start doesn't open dashboard
Dashboard shows connection error
```

**Solution:**
```bash
# Check if dashboard is installed
ls ~/.claude/observability/

# If not installed, install PAI
# Follow PAI installation guide

# Manually launch dashboard
~/.claude/observability/manage.sh start

# Open in browser
open http://localhost:5172

# Check status
~/.claude/observability/manage.sh status
```

---

### Issue: Spec parsing fails

**Symptom:**
```
./scripts/parse-spec-to-beads.sh fails
No beads created from spec
```

**Solution:**
```bash
# 1. Check spec format
cat specs/feature.md

# 2. Verify markers present
grep -n "RBP-TASKS" specs/feature.md

# 3. Ensure proper markdown structure
# Must have:
# - <!-- RBP-TASKS-START -->
# - Task sections with ### headers
# - <!-- RBP-TASKS-END -->

# 4. Validate manually
./scripts/parse-spec-to-beads.sh specs/feature.md --dry-run

# 5. Check parser logs
tail -50 scripts/progress.txt
```

---

## See Also

- [Architecture Guide](architecture.md) - System design
- [CLI Reference](cli-reference.md) - Command documentation
- [Configuration Guide](configuration.md) - Configuration options
- [Installation Guide](installation.md) - Setup instructions
