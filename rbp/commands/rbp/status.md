# /rbp:status - Show RBP Status

Display the current status of the RBP execution loop and beads state.

## What This Shows

1. **Beads Status** - Open/closed tasks, progress percentage
2. **Current Task** - Next task ready for execution
3. **Recent Progress** - Last entries from progress log
4. **Verification State** - Test pass/fail history

## Commands to Run

### Quick Status
```bash
bd status
```

### Detailed Task List
```bash
# All tasks
bd list

# Open tasks only
bd list --open

# Completed tasks
bd list --closed
```

### Progress History
```bash
# View progress log
cat scripts/rbp/progress.txt

# Last 20 entries
tail -20 scripts/rbp/progress.txt
```

### Task Tree (if parent/child structure)
```bash
bd tree
```

## Status Interpretation

- **Ready tasks** = Available for execution
- **In-progress** = Currently being worked on
- **Closed** = Completed with verification proof
- **Blocked** = Waiting on dependencies

## Next Steps

Based on status:
- If tasks ready: Run `/rbp:start` or `./scripts/rbp/ralph.sh`
- If all complete: Story is done, proceed to code review
- If blocked: Resolve dependencies manually
