---
allowed-tools: Bash, Read
description: Show RBP execution status and task state
---

# /rbp:status

Display current RBP execution status including task progress, ready tasks, and recent activity.

## Variables

RALPH_CLI: ./scripts/rbp/ralph.sh
PROGRESS_FILE: scripts/rbp/progress.txt
TAIL_LINES: 10

## Workflow

**Option 1: Use ralph status command (recommended)**
```bash
./scripts/rbp/ralph.sh status
```
This shows current execution state including task progress, project type, and next actions.

**Option 2: Manual workflow**
1. Run `bd status` to show task database overview
2. Run `bd ready --limit 5` to show next available tasks
3. Run `bd list --status open` to show all open tasks
4. Check if `PROGRESS_FILE` exists:
   - If yes, run `tail -`TAIL_LINES` `PROGRESS_FILE`` to show recent progress
   - If no, report "No progress log found"
5. Summarize status: tasks complete, tasks remaining, next action

## Report

RBP Status

Task Overview:
- Total: [from bd status]
- Open: [count]
- Closed: [count]
- Ready: [count]

Next Task: [from bd ready]

Recent Progress:
[last TAIL_LINES lines from progress log]

Recommended Action:
- If tasks ready: `./scripts/rbp/ralph.sh start`
- If all complete: Proceed to code review
- If blocked: Resolve dependencies with `bd show <id>`
