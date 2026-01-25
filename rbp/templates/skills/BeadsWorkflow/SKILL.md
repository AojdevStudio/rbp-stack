---
name: BeadsWorkflow
description: Beads (bd) git-backed issue tracking workflow for RBP projects. USE WHEN tracking tasks, finding available work, closing issues, or syncing with git.
---

# BeadsWorkflow Skill

Beads (bd) is a git-backed issue tracking system. It is the **source of truth** for all task management in RBP projects.

## Text Notification

**When executing a workflow, output:**
```
Running the **BeadsWorkflow** workflow from the **BeadsWorkflow** skill...
```

## Workflow Routing

| User Intent | Workflow Action |
|-------------|----------------|
| Find next task | Execute `bd ready` |
| View task details | Execute `bd show <id>` |
| Claim a task | Execute `bd update <id> --status in_progress` |
| Close completed task | Execute test-gated closure workflow |
| Sync with remote | Execute `bd sync` |
| View project status | Execute `bd status` |

## Core Commands

### Task Discovery

```bash
bd status              # Overview of task database (open, closed, blocked)
bd ready               # Show next available task (no blockers, ready to work)
bd list                # Show all tasks
bd list --open         # Show only open tasks
bd show <id>           # View detailed information about a specific task
```

### Task Management

```bash
bd create "description"           # Create a new task
bd update <id> --status in_progress   # Claim a task
bd update <id> --status blocked       # Mark task as blocked
bd close <id>                     # Close a completed task
bd graph                          # Show dependency graph
```

### Synchronization

```bash
bd sync                # Sync task database with git remote
```

## Standard Workflow

### 1. Find Available Work

```bash
bd ready
```

This shows the next unblocked task that's ready to work on. If nothing is ready, check `bd list --open` to see what's blocked.

### 2. Claim the Task

```bash
bd update <id> --status in_progress
```

This marks the task as yours and signals you're actively working on it.

### 3. View Task Details

```bash
bd show <id>
```

Read the full task description, acceptance criteria, and any dependencies.

### 4. Complete the Work

Implement the feature or fix according to the task requirements.

### 5. Run Tests (MANDATORY)

**CRITICAL:** Never close a task without running tests first.

```bash
bun test                    # Unit tests
bunx playwright test        # UI tests (if applicable)
```

If tests fail, the task stays open. Fix the failures before proceeding.

### 6. Close the Task

```bash
bd close <id>
```

Only run this after tests pass. This marks the task as complete.

### 7. Sync with Remote

```bash
bd sync
```

This pushes your task state changes to the git remote. Always run this at the end of your session.

## Best Practices

### Beads is the Source of Truth

- Never create JSON files to mirror Beads state
- Always query `bd ready` to find the next task
- Don't manually track task status in separate files
- Trust Beads to manage dependencies and blockers

### Test-Gated Closure

- **NEVER** close a task without running tests
- If tests fail, investigate and fix before closing
- For UI tasks, run Playwright tests: `bunx playwright test`
- Use `rbp/scripts/close-with-proof.sh` for automated test verification

### Session Management

At the end of each work session:

1. Close completed tasks: `bd close <id>`
2. Sync with remote: `bd sync`
3. Verify state: `bd status`
4. Commit and push all changes: `git push`

### Dependency Management

- Use `bd graph` to visualize task dependencies
- Don't start blocked tasks - work on `bd ready` output instead
- Update blockers when dependencies are resolved

### Creating Quality Tasks

When creating tasks with `bd create`:

- Write clear, actionable descriptions
- Include acceptance criteria
- Specify dependencies if applicable
- Keep tasks atomic and focused

## Common Patterns

### Daily Startup

```bash
bd status              # See project overview
bd ready               # Find next task
bd show <id>           # Read task details
bd update <id> --status in_progress  # Claim it
```

### Before Closing a Task

```bash
bun test               # Run tests
bd close <id>          # Close only if tests pass
bd sync                # Sync with remote
```

### Checking Progress

```bash
bd status              # High-level overview
bd list --open         # See all remaining work
bd graph               # Visualize dependencies
```

## Integration with Ralph CLI

The Ralph CLI (`bun rbp/lib/src/cli.ts run`) automatically:

1. Queries `bd ready` to find the next task
2. Implements the task
3. Runs tests via `close-with-proof.sh`
4. Closes the task only if tests pass

This creates a fully autonomous execution loop with Beads as the task source.

## Examples

### Example 1: Starting a New Work Session

```bash
# Get project overview
bd status

# Find next available task
bd ready

# View task details
bd show 42

# Claim the task
bd update 42 --status in_progress
```

### Example 2: Completing a Task

```bash
# Run tests (MANDATORY)
bun test

# If tests pass, close the task
bd close 42

# Sync with remote
bd sync
```

### Example 3: End of Session

```bash
# Verify all tasks are properly closed
bd status

# Sync task state
bd sync

# Commit and push all changes
git add -A
git commit -m "Session work complete"
git push
```

## Troubleshooting

### No tasks show in `bd ready`

- Check `bd list --open` - tasks may be blocked
- Use `bd graph` to see dependency structure
- Resolve blocking tasks first

### Task state out of sync

```bash
bd sync                # Pull latest from remote
```

### Need to unblock a task

```bash
bd update <id> --status open  # Remove in_progress status
```

## Rules

1. **Always check `bd ready`** before starting work
2. **Never close without tests** - use `bun test` first
3. **Run `bd sync`** at the end of every session
4. **Beads is the source of truth** - never create parallel tracking systems
5. **Respect dependencies** - don't work on blocked tasks
