---
allowed-tools: Bash, Read, Glob, AskUserQuestion
description: Start the RBP autonomous execution loop
argument-hint: [spec-file | max-iterations]
context: fork
---

# /rbp:start

Start the RBP autonomous execution loop to implement tasks with test-gated verification.

**Runs in a forked context window** - your main session stays free.

## Variables

ARG1: $1 (optional - either a spec/story file path OR max iterations number)
MAX_ITERATIONS: default 10
SCRIPTS_DIR: scripts/rbp
PROGRESS_FILE: scripts/rbp/progress.txt

## Workflow Detection

**Two workflows supported:**

| Source | Parser | Executor | Features |
|--------|--------|----------|----------|
| Quick-plan spec (`specs/*.md`) | `parse-spec-to-beads.sh` | `ralph-execute.sh` | Codex pre-flight review |
| BMAD story (`stories/*.md`) | `parse-story-to-beads.sh` | `ralph.sh` | Direct execution |

**Detection logic:**
- File contains `<!-- RBP-TASKS-START -->` → Quick-plan spec
- File contains `## User Story` or in `stories/` folder → BMAD story
- Otherwise → Ask user which workflow

## Workflow

1. Run `bd status` to show current task state
2. Run `bd ready` to check for available tasks

### If NO tasks available:

3. **Auto-discover specs/stories** - Look for files:
   - Check if ARG1 is a file path (ends in .md) → use that file
   - Otherwise, search common locations:
     - `specs/*.md` (quick-plan)
     - `stories/*.md` (BMAD)
     - `docs/specs/*.md`
     - `docs/stories/*.md`
   - Use Glob tool to find files

4. **If file(s) found:**
   - Show the file(s) found
   - Ask user which to use (if multiple)
   - **Detect workflow type** using detection logic above
   - For quick-plan: Run `./rbp/scripts/ralph-execute.sh <spec-file>`
   - For BMAD: Run `./rbp/scripts/parse-story-to-beads.sh <story-file>` then `./rbp/scripts/ralph.sh`
   - Run `bd ready` to confirm tasks were created

5. **If NO file found:**
   - Report "No tasks in beads and no spec/story files found"
   - Suggest: "Create a spec with /quick-plan or a story with BMAD"
   - Stop

### If tasks ARE available:

6. Ask user: "Tasks exist. Run quick-plan workflow (with Codex) or BMAD workflow (direct)?"
7. Execute the selected workflow
8. Monitor output for completion or errors

## Report

RBP Execution Started

Status: Execution loop running in forked context
Max Iterations: `MAX_ITERATIONS`
Progress Log: `PROGRESS_FILE`

Monitor with:
- `bd status` - Task overview
- `tail -f `PROGRESS_FILE`` - Live progress
- `Ctrl+C` - Stop execution
