---
name: RbpExecution
description: RBP autonomous execution protocol and CLI usage. USE WHEN running ralph commands, executing tasks autonomously, closing tasks with test verification, understanding the execution flow, or working with the RBP workflow system.
---

# RBP Execution Protocol

This skill documents the autonomous execution protocol for the RBP Stack, including CLI commands, execution flow, and architectural constraints.

## Text Notification

**When executing a workflow, output:**
```
Running the **RBP Execution** workflow from the **RbpExecution** skill...
```

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "run ralph", "execute tasks", "autonomous execution" | Main execution loop |
| "close task", "verify tests", "task completion" | Test-gated closure workflow |
| "execute spec", "run specification" | Spec execution workflow |
| "check status", "execution state" | Status check workflow |

## Architectural Constraints

**CRITICAL:** Ralph execution operates under strict architectural boundaries:

1. **CLI-Only Execution**: Ralph runs exclusively via the TypeScript CLI (`ralph`) or the wrapper script (`./scripts/rbp/ralph.sh`). There is NO slash command for execution.

2. **Slash Commands Are Read-Only**: The Claude Code slash commands are for status visibility only:
   - `/rbp:status` - View current execution state
   - `/rbp:validate` - Validate RBP installation
   - **NEVER** use `/rbp:start` - this command does not exist

3. **Beads is Source of Truth**: All task state is managed by Beads. Never create JSON files to mirror task state.

4. **Test-Gated Closure**: Tasks can only be closed after tests pass. Failed tests keep the task open.

## CLI Commands

The Ralph CLI is implemented in TypeScript using Commander.js and runs on the bun runtime.

### Global Options

Available on all commands:

```bash
ralph --config <path>     # Custom config file path
ralph --verbose           # Increase output verbosity (debug level)
ralph --quiet             # Decrease output verbosity (warn level)
ralph --json-errors       # Output errors as JSON (default: true)
ralph --no-json-errors    # Output errors as human-readable text
```

### Execution Commands

**run** (default command)
```bash
ralph run                        # Run the execution loop with auto-detection
ralph run --beads                # Use Beads workflow explicitly
ralph run --bmad                 # Use BMAD workflow explicitly
ralph run --max-iterations <n>   # Limit iterations (positive integer >= 1)
ralph run --dry-run              # Dry run mode (no changes)
```

**status**
```bash
ralph status                     # Show current execution state
```

**close**
```bash
ralph close <id>                 # Close a task with test verification
ralph close <id> --force         # Force close without tests (-f)
ralph close <id> --dry-run       # Dry run mode
```

**exec-spec**
```bash
ralph exec-spec <file>           # Execute a spec file with quick-plan workflow
ralph exec-spec <file> --skip-review     # Skip Codex review step
ralph exec-spec <file> --max-iterations <n>  # Limit iterations
ralph exec-spec <file> --dry-run  # Dry run mode
```

### CLI Validation Rules

- `--max-iterations` must be a positive integer >= 1 (prevents NaN)
- `--json-errors` and `--no-json-errors` are mutually exclusive
- `--bmad` and `--beads` flags cannot be used together
- The CLI auto-detects workflow if not specified

## Execution Flow

The Ralph execution loop follows a strict test-driven workflow:

### Main Loop (ralph run)

1. **Query Next Task**
   ```bash
   bd ready  # Get next unblocked task
   ```

2. **Execute Task**
   - Use Claude Code to implement the task
   - Follow task requirements and acceptance criteria
   - Write tests alongside implementation

3. **Run Test Verification**
   ```bash
   bun test  # For backend/CLI tasks
   bunx playwright test  # For UI tasks
   ```

4. **Close Task (if tests pass)**
   ```bash
   ralph close <id>  # Only succeeds if tests pass
   ```

5. **Loop**
   - Return to step 1 until no tasks remain
   - Respect `--max-iterations` if specified

### Test-Gated Closure

The `ralph close` command enforces test verification:

```bash
# Standard closure (runs tests first)
ralph close issue-001

# Force closure (skips tests - use with caution)
ralph close issue-001 --force

# Dry run (shows what would happen)
ralph close issue-001 --dry-run
```

**Rules:**
- Tests MUST pass before closure
- Failed tests keep the task open
- Use `--force` only for documentation-only tasks
- Never force-close tasks with code changes

### Workflow Detection

Ralph auto-detects the workflow based on project state:

- **Beads Workflow**: Uses `bd ready` to get tasks from Beads
- **BMAD Workflow**: Uses `.rbp/current-spec-bead` for spec-based execution
- **Auto-Detection**: Checks for BMAD state, falls back to Beads

## Wrapper Script

The bash wrapper provides a convenient entry point:

```bash
# Run from project root
./scripts/rbp/ralph.sh

# Or with explicit workflow
./scripts/rbp/ralph.sh --beads
./scripts/rbp/ralph.sh --bmad

# With iteration limit
./scripts/rbp/ralph.sh --max-iterations 5
```

The wrapper script:
- Changes to the RBP lib directory
- Executes the TypeScript CLI via bun
- Preserves all CLI arguments and flags
- Returns to the original directory

## Spec Execution Workflow

For executing quick-plan specifications:

```bash
# Execute a spec file
ralph exec-spec specs/feature-implementation.md

# Skip Codex review
ralph exec-spec specs/feature-implementation.md --skip-review

# With iteration limit
ralph exec-spec specs/feature-implementation.md --max-iterations 10
```

**Flow:**
1. Parse spec file to Beads tasks
2. Optional: Run Codex review
3. Execute tasks via `ralph run --beads`
4. Close tasks as tests pass

## Best Practices

### Task Management

- Always query `bd ready` for the next task
- Never hardcode task IDs in scripts
- Update task status as work progresses
- Close tasks only after test verification

### Testing Strategy

- Write tests alongside implementation
- Run tests before every closure attempt
- Use Playwright for UI/browser tasks
- Use bun test for backend/CLI tasks

### Error Handling

- Check exit codes after every command
- Log failures with context
- Never skip test verification on failure
- Keep tasks open on test failure

### Iteration Control

- Use `--max-iterations` to limit execution scope
- Set reasonable limits for exploratory work
- Allow unlimited iterations for production execution
- Monitor progress with `ralph status`

## Common Workflows

### Standard Execution

```bash
# Start autonomous execution
./scripts/rbp/ralph.sh

# Check status
ralph status

# View available work
bd ready
```

### Limited Iteration Run

```bash
# Run for 5 iterations only
ralph run --max-iterations 5

# Check what's remaining
bd list --open
```

### Manual Task Closure

```bash
# Close a specific task (with tests)
ralph close issue-001

# Force close (skip tests - documentation only)
ralph close issue-001 --force
```

### Spec-Based Execution

```bash
# Execute a spec file
ralph exec-spec specs/user-authentication.md

# Skip review and limit iterations
ralph exec-spec specs/user-authentication.md --skip-review --max-iterations 10
```

## Troubleshooting

### Tests Fail on Closure

**Symptom:** `ralph close` fails with test errors

**Solution:**
1. Review test output
2. Fix failing tests
3. Re-run tests manually: `bun test`
4. Retry closure: `ralph close <id>`

### No Tasks Available

**Symptom:** `bd ready` returns no tasks

**Solution:**
1. Check for blocked tasks: `bd list --blocked`
2. Review dependencies: `bd graph`
3. Unblock tasks or create new ones

### CLI Validation Errors

**Symptom:** CLI rejects arguments

**Solution:**
1. Check that `--max-iterations` is a positive integer >= 1
2. Don't combine `--bmad` and `--beads`
3. Don't use both `--json-errors` and `--no-json-errors`

### Workflow Auto-Detection Issues

**Symptom:** Wrong workflow selected

**Solution:**
1. Use explicit flags: `--beads` or `--bmad`
2. Check for `.rbp/current-spec-bead` file
3. Verify Beads installation: `bd status`

## Integration Points

### Beads CLI

Ralph integrates tightly with Beads:

```bash
bd ready              # Next task
bd status             # Overview
bd list --open        # Open tasks
bd show <id>          # Task details
bd close <id>         # Close (without tests)
bd sync               # Sync with git
```

### Test Runners

Ralph supports multiple test runners:

```bash
bun test              # Unit/integration tests
bunx playwright test  # UI/browser tests
```

### Claude Code CLI

Ralph is designed to work with Claude Code's agent system:

```bash
claude --execute ./scripts/rbp/ralph.sh
```

## Configuration

Ralph uses YAML configuration for project settings:

```yaml
# .rbp/config.yaml
project:
  name: "My Project"
  beads_enabled: true

execution:
  max_iterations: 100
  test_command: "bun test"
  test_timeout: 300

workflows:
  default: "beads"
```

## Security Considerations

- Never force-close tasks with code changes
- Always run tests before closure
- Review spec files before execution
- Limit iterations for untrusted specs
- Use dry-run mode for validation

## Performance Optimization

- Use `--max-iterations` to control scope
- Monitor with `ralph status`
- Profile tests for slow tasks
- Parallelize independent tasks in Beads
- Cache test results when safe

## Examples

### Example 1: Standard Execution Flow

```bash
# Start the execution loop
./scripts/rbp/ralph.sh

# Ralph will:
# 1. Query bd ready for next task
# 2. Implement the task
# 3. Run tests
# 4. Close task if tests pass
# 5. Repeat until no tasks remain
```

### Example 2: Manual Task Closure with Test Verification

```bash
# Attempt to close a task
ralph close issue-042

# If tests fail, task stays open
# Fix the issue, then retry
ralph close issue-042
```

### Example 3: Spec-Based Execution

```bash
# Execute a specification file
ralph exec-spec specs/new-feature.md

# Ralph will:
# 1. Parse spec to Beads tasks
# 2. Run Codex review (optional)
# 3. Execute tasks autonomously
# 4. Close each task after tests pass
```

## References

- [RBP Stack Specification](../../docs/rbp-stack-specification.md)
- [Beads CLI Documentation](https://github.com/user/beads)
- [Commander.js](https://github.com/tj/commander.js)
- [Bun Runtime](https://bun.sh)
