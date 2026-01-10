---
allowed-tools: Bash, Read
description: Start the RBP autonomous execution loop
argument-hint: [max-iterations]
---

# /rbp:start

Start the RBP autonomous execution loop to implement tasks with test-gated verification.

## Variables

MAX_ITERATIONS: $1 (optional, default: 50)
SCRIPTS_DIR: scripts/rbp
PROGRESS_FILE: scripts/rbp/progress.txt

## Workflow

1. Run `bd status` to show current task state
2. Run `bd ready` to display next available task
3. If no tasks ready, report "No tasks available" and stop
4. Confirm with user before starting execution loop
5. Run `./`SCRIPTS_DIR`/ralph.sh `MAX_ITERATIONS`` to start the execution loop
6. Monitor output for completion or errors

## Report

RBP Execution Started

Status: Execution loop running
Max Iterations: `MAX_ITERATIONS`
Progress Log: `PROGRESS_FILE`

Monitor with:
- `bd status` - Task overview
- `tail -f `PROGRESS_FILE`` - Live progress
- `Ctrl+C` - Stop execution
