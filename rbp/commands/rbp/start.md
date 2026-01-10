# /rbp:start - Start Ralph Execution Loop

Start the RBP autonomous execution loop on the current project.

## What This Does

1. Checks prerequisites (beads, bun, claude)
2. Queries `bd ready` for the next available task
3. Executes the task via Claude Code
4. Requires test verification before closing beads
5. Repeats until all tasks complete or max iterations reached

## Usage

Run this command when you have beads ready for execution.

## Prerequisites

- `.beads/` initialized (`bd init`)
- Tasks created in beads (`bd create` or `parse-story-to-beads.sh`)
- `bun` installed for running tests
- Tests configured in `package.json`

## Execution

```bash
# Start with default 50 iterations
./scripts/rbp/ralph.sh

# Start with custom iteration limit
./scripts/rbp/ralph.sh 100
```

## During Execution

The loop will:
1. Display current task from `bd ready`
2. Execute implementation via Claude Code
3. Run `close-with-proof.sh` to verify tests pass
4. Close the bead only if all tests pass
5. Move to next task

## Stopping the Loop

- Press `Ctrl+C` to interrupt
- The loop stops automatically when all tasks complete
- Progress is saved to `scripts/rbp/progress.txt`

## After Completion

View final status with:
```bash
bd status
bd list --closed
```
