# RBP Stack CLI Reference

**Version:** 3.0.0
**Last Updated:** January 25, 2026
**Status:** Production

---

## Table of Contents

- [Overview](#overview)
- [Global Options](#global-options)
- [Commands](#commands)
  - [ralph run](#ralph-run)
  - [ralph status](#ralph-status)
  - [ralph close](#ralph-close)
  - [ralph exec-spec](#ralph-exec-spec)
- [Exit Codes](#exit-codes)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

The Ralph CLI is the primary interface for autonomous task execution in the RBP Stack. It's written in TypeScript using Commander.js and runs on the Bun runtime.

### Invocation

```bash
# Direct invocation
bun lib/src/cli.ts [command] [options]

# Using wrapper script
./ralph.sh [command] [options]

# If installed globally (after bun link)
ralph [command] [options]
```

### Command Structure

```
ralph [global-options] <command> [command-options] [arguments]
```

**Example:**
```bash
ralph --verbose run --beads --max-iterations 10
```

---

## Global Options

Global options are available on all commands and must be specified before the command name.

### --config <path>

**Purpose:** Specify a custom configuration file path

**Type:** String (file path)

**Default:** `./rbp-config.yaml`

**Example:**
```bash
ralph --config /path/to/custom-config.yaml run
```

**Use cases:**
- Multiple project configurations
- Environment-specific configs (dev, staging, prod)
- Testing different configurations

---

### --verbose

**Purpose:** Enable debug-level logging

**Type:** Boolean flag

**Default:** `false`

**Example:**
```bash
ralph --verbose run
```

**Output includes:**
- Debug messages
- Subprocess command invocations
- Detailed error traces
- Configuration loading steps
- Bead query results

**Use cases:**
- Troubleshooting issues
- Understanding execution flow
- Development and testing

---

### --quiet

**Purpose:** Reduce output to warnings and errors only

**Type:** Boolean flag

**Default:** `false`

**Example:**
```bash
ralph --quiet run
```

**Output includes:**
- Warning messages
- Error messages
- Critical information only

**Use cases:**
- Production environments
- Automated scripts
- Clean output for parsing

---

### --json-errors

**Purpose:** Output errors in JSON format (default)

**Type:** Boolean flag

**Default:** `true`

**Example:**
```bash
ralph --json-errors run
```

**Output format:**
```json
{
  "error": {
    "code": "BEADS_COMMAND_FAILED",
    "message": "bd ready failed",
    "details": {
      "stderr": "No open issues found"
    },
    "suggestion": "Run 'bd status' to check beads state"
  }
}
```

**Use cases:**
- Machine parsing
- Logging systems
- CI/CD integration

---

### --no-json-errors

**Purpose:** Output errors in human-readable format

**Type:** Boolean flag

**Default:** `false`

**Example:**
```bash
ralph --no-json-errors run
```

**Output format:**
```
Error: bd ready failed
  Code: BEADS_COMMAND_FAILED
  Details: stderr = "No open issues found"
  Suggestion: Run 'bd status' to check beads state
```

**Use cases:**
- Development
- Manual debugging
- Terminal output

**Note:** Mutually exclusive with `--json-errors`

---

## Commands

### ralph run

**Purpose:** Execute the autonomous execution loop

**Usage:**
```bash
ralph run [options]
```

**Description:**

Runs the main autonomous execution loop, which:
1. Queries Beads for the next ready task (`bd ready`)
2. Builds XML task context
3. Spawns Claude Code subprocess
4. Parses completion signals
5. Runs test verification
6. Closes tasks with proof
7. Loops until completion or max iterations

---

#### Options

##### --bmad

**Type:** Boolean flag

**Default:** Auto-detect

**Description:** Force BMAD workflow

**Example:**
```bash
ralph run --bmad
```

**Use cases:**
- Override auto-detection
- Ensure BMAD workflow is used
- Debug workflow selection

**Note:** Mutually exclusive with `--beads`

---

##### --beads

**Type:** Boolean flag

**Default:** Auto-detect

**Description:** Force Beads workflow

**Example:**
```bash
ralph run --beads
```

**Use cases:**
- Override auto-detection
- Ensure Beads workflow is used
- Testing Beads integration

**Note:** Mutually exclusive with `--bmad`

---

##### --max-iterations <n>

**Type:** Positive integer >= 1

**Default:** From config (default: 50)

**Description:** Override maximum iterations

**Example:**
```bash
ralph run --max-iterations 10
```

**Validation:**
- Must be positive integer
- Must be >= 1
- Non-integer values cause error

**Use cases:**
- Limit execution time
- Testing
- Development

---

##### --dry-run

**Type:** Boolean flag

**Default:** `false`

**Description:** Show execution plan without running

**Example:**
```bash
ralph run --dry-run
```

**Output:**
```
[DRY RUN] Execution Plan
========================

Workflow: BEADS
Max iterations: 50
Test command: bun test

Would query 'bd ready' for next task
Would invoke Claude for each task
Would run tests before closing tasks

[DRY RUN] No changes made
```

**Use cases:**
- Preview configuration
- Verify workflow detection
- Test configuration changes

---

#### Workflow Auto-Detection

If neither `--bmad` nor `--beads` is specified, Ralph auto-detects the workflow:

**Detection logic:**
1. Check for `sprint-status.yaml` in standard locations
   - If found → BMAD workflow
2. Check if `bd` command is available
   - If found → Beads workflow
3. If neither found → Error

**Locations searched for sprint-status.yaml:**
- `docs/bmm/implementation-artifacts/sprint-status.yaml`
- `docs/sprint-status.yaml`
- `sprint-status.yaml`

---

#### Examples

**Basic execution:**
```bash
ralph run
```

**Beads workflow with limit:**
```bash
ralph run --beads --max-iterations 5
```

**BMAD workflow dry run:**
```bash
ralph run --bmad --dry-run
```

**Verbose execution:**
```bash
ralph --verbose run --max-iterations 10
```

---

### ralph status

**Purpose:** Show current execution state

**Usage:**
```bash
ralph status
```

**Description:**

Displays current project status including:
- Workflow type (BMAD/Beads)
- Task counts (total, open, closed, ready)
- Next available task
- Recent progress
- Configuration summary

**Output example:**
```
RBP Stack Status
================

Project: My Project
Workflow: BEADS
Config: ./rbp-config.yaml

Tasks:
  Total: 25
  Open: 10
  In Progress: 2
  Closed: 13

Next Ready Task:
  ID: bd-abc123
  Title: Implement user authentication
  Priority: 1
  Status: open

Recent Progress:
  [2026-01-25 10:32] Closed: bd-xyz789 - Add login form
  [2026-01-25 10:15] Closed: bd-def456 - Create auth middleware

Configuration:
  Max Iterations: 50
  Test Command: bun test
  Playwright Required: true

Recommended Action:
  Run 'ralph run' to continue
```

---

#### Options

None. Status command doesn't accept additional options.

---

#### Examples

**Basic status:**
```bash
ralph status
```

**Status with custom config:**
```bash
ralph --config custom.yaml status
```

**JSON error format:**
```bash
ralph --json-errors status
```

---

### ralph close

**Purpose:** Close a task with test verification

**Usage:**
```bash
ralph close <bead-id> [options]
```

**Description:**

Closes a task with test-gated verification:
1. Fetch bead info
2. Run configured test command
3. Check exit code
4. If tests pass → Close bead with proof
5. If tests fail → Append failure notes, keep open

**Critical:** This is the ONLY way to properly close tasks in RBP. Never use `bd close` directly.

---

#### Arguments

##### <bead-id>

**Type:** String

**Required:** Yes

**Description:** Bead ID to close

**Example:**
```bash
ralph close bd-abc123
```

---

#### Options

##### --force / -f

**Type:** Boolean flag

**Default:** `false`

**Description:** Skip test verification and force closure

**Example:**
```bash
ralph close bd-abc123 --force
```

**Use cases:**
- Tests are broken for unrelated reasons
- Emergency closure required
- Development/testing

**Warning:** Use sparingly. Defeats test-gated closure principle.

---

##### --dry-run

**Type:** Boolean flag

**Default:** `false`

**Description:** Show what would happen without closing

**Example:**
```bash
ralph close bd-abc123 --dry-run
```

**Output:**
```
[DRY RUN] Close Task
====================

Bead ID: bd-abc123
Title: Implement user authentication
Status: open

Would run tests: bun test
Would check Playwright: false
Would close if tests pass

[DRY RUN] No changes made
```

---

#### Test Verification Flow

```
ralph close <id>
    ↓
Fetch bead info
    ↓
Check require_tests config
    ↓
Run test_command
    ├─ Exit 0 (PASS)
    │   ↓
    │   Check requires_playwright
    │   ├─ Yes → Run playwright_command
    │   │   ├─ Exit 0 (PASS) → Close bead
    │   │   └─ Exit !0 (FAIL) → Append notes, keep open
    │   └─ No → Close bead
    │
    └─ Exit !0 (FAIL)
        ↓
        Append failure notes
        ↓
        Keep task open
        ↓
        Exit with error
```

---

#### Examples

**Normal closure:**
```bash
ralph close bd-abc123
```

**Force closure (skip tests):**
```bash
ralph close bd-abc123 --force
```

**Dry run:**
```bash
ralph close bd-abc123 --dry-run
```

**With custom config:**
```bash
ralph --config dev.yaml close bd-abc123
```

---

### ralph exec-spec

**Purpose:** Execute a quick-plan spec file

**Usage:**
```bash
ralph exec-spec <spec-file> [options]
```

**Description:**

Executes a quick-plan specification file:
1. Parse spec file
2. Convert to Beads tasks (via `parse-spec-to-beads.sh`)
3. Optionally run Codex review
4. Execute autonomous loop
5. Report completion

---

#### Arguments

##### <spec-file>

**Type:** String (file path)

**Required:** Yes

**Description:** Path to spec markdown file

**Example:**
```bash
ralph exec-spec specs/user-auth.md
```

**Spec format:**
- Markdown file with task sections
- Uses `<!-- RBP-TASKS-START -->` markers
- Contains acceptance criteria

---

#### Options

##### --skip-review

**Type:** Boolean flag

**Default:** `false`

**Description:** Skip Codex adversarial review

**Example:**
```bash
ralph exec-spec specs/user-auth.md --skip-review
```

**Use cases:**
- Quick iterations
- Non-critical features
- Codex not configured

---

##### --max-iterations <n>

**Type:** Positive integer >= 1

**Default:** From config (default: 50)

**Description:** Override maximum iterations

**Example:**
```bash
ralph exec-spec specs/user-auth.md --max-iterations 20
```

---

##### --dry-run

**Type:** Boolean flag

**Default:** `false`

**Description:** Show execution plan without running

**Example:**
```bash
ralph exec-spec specs/user-auth.md --dry-run
```

**Output:**
```
[DRY RUN] Spec Execution Plan
==============================

Spec File: specs/user-auth.md
Codex Review: Enabled
Max Iterations: 50

Would parse spec to Beads tasks
Would run Codex review (if enabled)
Would execute autonomous loop
Would report completion

[DRY RUN] No changes made
```

---

#### Examples

**Execute spec:**
```bash
ralph exec-spec specs/user-auth.md
```

**Skip Codex review:**
```bash
ralph exec-spec specs/user-auth.md --skip-review
```

**Limited iterations:**
```bash
ralph exec-spec specs/user-auth.md --max-iterations 10
```

**Dry run:**
```bash
ralph exec-spec specs/user-auth.md --dry-run
```

**Verbose execution:**
```bash
ralph --verbose exec-spec specs/user-auth.md
```

---

## Exit Codes

Ralph uses standard exit codes to indicate execution results:

| Exit Code | Meaning | Description |
|-----------|---------|-------------|
| `0` | Success | All tasks completed successfully |
| `1` | Failure | Error occurred during execution |
| `2` | Invalid Arguments | Command-line arguments invalid |
| `3` | Configuration Error | Configuration file invalid or not found |
| `4` | Workflow Error | Workflow detection or execution failed |
| `5` | Test Failure | Tests failed during verification |

### Examples

**Success:**
```bash
ralph run
# Exit code: 0
```

**Invalid arguments:**
```bash
ralph run --max-iterations abc
# Exit code: 2
# Error: Invalid max-iterations value: "abc"
```

**Configuration error:**
```bash
ralph --config missing.yaml run
# Exit code: 3
# Error: Configuration file not found: missing.yaml
```

**Test failure:**
```bash
ralph close bd-abc123
# Exit code: 5
# Error: Tests failed
```

---

## Error Handling

### Error Format

#### JSON Errors (default)

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "key": "value"
    },
    "suggestion": "How to fix the issue"
  }
}
```

#### Human-Readable Errors

```
Error: Human-readable message
  Code: ERROR_CODE
  Details: key = "value"
  Suggestion: How to fix the issue
```

---

### Error Codes

| Code | Description | Suggestion |
|------|-------------|------------|
| `CONFIG_NOT_FOUND` | Configuration file missing | Check path or create rbp-config.yaml |
| `INVALID_CONFIG` | Configuration validation failed | Check YAML syntax and field types |
| `NO_WORKFLOW_DETECTED` | Cannot detect BMAD or Beads | Use --bmad/--beads flag or initialize beads |
| `WORKFLOW_CONFLICT` | --bmad and --beads both specified | Choose one workflow type |
| `BEADS_COMMAND_FAILED` | bd command failed | Check beads installation and state |
| `BEADS_PARSE_ERROR` | Failed to parse bd output | Check bd command output format |
| `TEST_FAILURE` | Tests failed during verification | Fix failing tests before closing |
| `INVALID_ARGUMENT` | Invalid command-line argument | Check argument format and type |

---

### Error Examples

**Configuration not found:**
```bash
ralph --config missing.yaml run
```

```json
{
  "error": {
    "code": "CONFIG_NOT_FOUND",
    "message": "Configuration file not found: missing.yaml",
    "details": {
      "path": "missing.yaml"
    },
    "suggestion": "Create configuration file or use default ./rbp-config.yaml"
  }
}
```

**Invalid max-iterations:**
```bash
ralph run --max-iterations -5
```

```json
{
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "Invalid max-iterations value: \"-5\"",
    "details": {
      "value": "-5"
    },
    "suggestion": "Provide a positive integer >= 1"
  }
}
```

**Workflow conflict:**
```bash
ralph run --bmad --beads
```

```json
{
  "error": {
    "code": "WORKFLOW_CONFLICT",
    "message": "Cannot use --bmad and --beads together",
    "details": {},
    "suggestion": "Choose one workflow type or let ralph auto-detect"
  }
}
```

---

## Examples

### Basic Workflows

**Start autonomous execution:**
```bash
ralph run
```

**Check project status:**
```bash
ralph status
```

**Close completed task:**
```bash
ralph close bd-abc123
```

---

### Advanced Workflows

**Limited iterations with verbose output:**
```bash
ralph --verbose run --max-iterations 5
```

**Custom config with dry run:**
```bash
ralph --config staging.yaml run --dry-run
```

**Force close with human-readable errors:**
```bash
ralph --no-json-errors close bd-abc123 --force
```

---

### CI/CD Integration

**Automated execution with JSON output:**
```bash
#!/bin/bash
set -e

# Run with JSON errors for parsing
ralph --json-errors run --max-iterations 10 > output.json

# Check exit code
if [ $? -eq 0 ]; then
  echo "Success"
else
  echo "Failed"
  cat output.json | jq '.error'
  exit 1
fi
```

---

### Development Workflows

**Quick test cycle:**
```bash
# Dry run to verify config
ralph run --dry-run

# Run single iteration
ralph run --max-iterations 1

# Check status
ralph status

# Force close for testing
ralph close bd-test --force
```

---

### Debugging

**Full verbose output:**
```bash
ralph --verbose run --max-iterations 1 2>&1 | tee debug.log
```

**Check configuration:**
```bash
ralph --config custom.yaml status
```

**Dry run all commands:**
```bash
ralph run --dry-run
ralph close bd-abc123 --dry-run
ralph exec-spec specs/test.md --dry-run
```

---

## See Also

- [Architecture Guide](architecture.md) - System design
- [Configuration Guide](configuration.md) - Configuration options
- [Installation Guide](installation.md) - Setup instructions
- [Workflows Guide](workflows.md) - Step-by-step workflows
