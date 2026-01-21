---
allowed-tools: Bash, Read, Glob
description: Start the RBP autonomous execution loop
argument-hint: [spec-file | max-iterations]
context: fork
---

# /rbp:start

Start the RBP autonomous execution loop to implement tasks with test-gated verification.

**Runs in a forked context window** - your main session stays free.

## CRITICAL: Headless Execution

This command MUST run without human interaction. NEVER ask questions - make autonomous decisions:

| Situation | Autonomous Action |
|-----------|-------------------|
| Ambiguous project type | Prefer BMAD if both exist |
| Script returns error | Log error, report to user, stop |
| Epic complete (exit 3) | Report completion summary, stop |
| Missing dependencies | Log what's missing, stop |
| Tests fail | Keep task open, continue to next |

## CRITICAL: Use mgrep for Exploration

**Minimize tool calls with semantic search.** Use mgrep instead of multiple Grep/Glob calls.

```bash
# Find project structure with natural language
mgrep search "BMAD configuration files"
mgrep search "epic definitions and stories"

# For directory checks, use simple bash (faster)
[ -d "docs/bmm" ] && echo "BMAD project"
```

**Rule:** One mgrep query replaces 10+ Grep/Glob calls. Use it.

## Variables

ARG1: $1 (optional - either a spec/story file path OR max iterations number)
MAX_ITERATIONS: default 10
RALPH_CLI: bun ./rbp/lib/src/index.ts
PROGRESS_FILE: scripts/rbp/progress.txt

## Workflow Detection

**Two workflows supported:**

| Source | Parser | Executor | Features |
|--------|--------|----------|----------|
| Quick-plan spec (`specs/*.md`) | `ralph parse-spec` | `ralph exec-spec` | Codex pre-flight review |
| BMAD story (`stories/*.md`) | `ralph parse-story` | `ralph run --bmad` | Direct execution |

**Detection logic:**
- File contains `<!-- RBP-TASKS-START -->` → Quick-plan spec
- File contains `## User Story` or in `stories/` folder → BMAD story
- Otherwise → Ask user which workflow

## Workflow

### Step 0: Launch PAI Observability Dashboard (if available)

Before starting execution, check for PAI Observability integration:

1. **Check if PAI Observability is installed:**
   - Look for `~/.claude/observability/manage.sh`
   - If not found: Print warning and continue without dashboard

2. **Check if dashboard is already running:**
   ```bash
   curl -s http://localhost:4000/health 2>/dev/null
   ```
   - If running: Skip launch, just note it's available

3. **Launch dashboard if not running:**
   ```bash
   ~/.claude/observability/manage.sh start
   ```
   - Wait up to 10 seconds for startup
   - Verify with health check

4. **Open browser (unless headless):**
   - Check for CI/headless environment variables: `$CI`, `$GITHUB_ACTIONS`, `$GITLAB_CI`, `$JENKINS_URL`, `$CODESPACES`
   - Check for SSH without display: `$SSH_CONNECTION` without `$DISPLAY`
   - If not headless: Open http://localhost:5172 in browser

5. **Always print dashboard URL:**
   ```
   Observability Dashboard: http://localhost:5172
   ```

### Main Workflow Steps

1. Run `bd status` to show current task state
2. Run `bd ready` to check for available tasks

### If NO tasks available:

3. **Detect project type** by checking for BMAD artifacts:
   - Look for `docs/bmm/` or `docs/bmad/` directories → BMAD project
   - Look for `specs/*.md` with `<!-- RBP-TASKS-START -->` → Quick-plan project
   - If both exist, prefer BMAD if epic/stories structure is present

4. **For BMAD projects - Auto-continue the epic:**
   a. Find the current epic branch (e.g., `epic-4/admin-dashboard`)
   b. **Run autonomous story generation:**
      ```bash
      STORY_FILE=$(bun ./rbp/lib/src/index.ts generate-story --json 2>/dev/null | jq -r '.path')
      EXIT_CODE=$?
      ```
   c. **Handle exit codes:**
      - `0`: Story created at `$STORY_FILE`, continue to parse
      - `1`: Config error - report "No BMAD config found" and stop
      - `2`: No epic found - report "No epic detected" and stop
      - `3`: Epic complete - report completion summary and stop
   d. **Parse to beads and execute:**
      ```bash
      bun ./rbp/lib/src/index.ts parse-story "$STORY_FILE"
      bun ./rbp/lib/src/index.ts run --bmad
      ```
   e. Loop back to step 1 (check for more tasks)

5. **For Quick-plan projects:**
   - Check if ARG1 is a file path (ends in .md) → use that file
   - Otherwise, find specs with `<!-- RBP-TASKS-START -->` markers
   - If found: Run `bun ./rbp/lib/src/index.ts exec-spec <spec-file>`
   - If not found: Report "No actionable specs found" and stop

   **Alternative: Use start subcommand for auto-detection:**
   ```bash
   bun ./rbp/lib/src/index.ts start
   ```

6. **If neither project type detected:**
   - Report "No BMAD epic or quick-plan specs found"
   - Suggest: "Initialize with BMAD or create a spec with /quick-plan"
   - Stop

### If tasks ARE available:

7. **Use the unified start command (auto-detects project type):**
   ```bash
   bun ./rbp/lib/src/index.ts start
   ```
   Or run directly with explicit workflow:
   - BMAD project → `bun ./rbp/lib/src/index.ts run --bmad`
   - Beads-only project → `bun ./rbp/lib/src/index.ts run --beads`
8. Monitor output for completion or errors
9. Loop back to step 1 when tasks complete (up to MAX_ITERATIONS)

## Report

RBP Execution Started
═══════════════════════════════════════════════════════

Observability Dashboard: http://localhost:5172
   Showing real-time task progress, test results, and errors

File Logs: scripts/rbp/progress.txt

Status: Execution loop running in forked context
Max Iterations: `MAX_ITERATIONS`

Monitor with:
- Browser: http://localhost:5172 (live updates)
- Terminal: tail -f `PROGRESS_FILE`
- Ralph Status: bun ./rbp/lib/src/index.ts status
- Beads: bd activity --follow
- Tasks: bd status
- Stop: Ctrl+C
