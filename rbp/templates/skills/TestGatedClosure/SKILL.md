---
name: TestGatedClosure
description: Test-gated closure protocol ensuring tasks are never closed without passing tests. USE WHEN closing tasks, verifying test results, or enforcing quality gates before completion.
---

# Test-Gated Closure

## Text Notification

**When executing a workflow, output:**
```
Running the **Test-Gated Closure** workflow from the **TestGatedClosure** skill...
```

## Workflow Routing

| User Intent | Workflow |
|-------------|----------|
| Close a task after implementation | Test-Gated Closure Protocol |
| Verify task completion | Test-Gated Closure Protocol |
| Force close without tests | Forced Closure (use sparingly) |

## Core Principle

Tasks MUST pass all tests before closure. This is the fundamental quality gate in the RBP execution loop.

**Non-Negotiable Rules:**
- Tasks cannot be marked complete without passing tests
- If tests fail, the task stays open
- No exceptions - this protects code quality and system integrity

## Protocol

### Test-Gated Closure Workflow

1. **Complete Implementation** - Finish coding the task
2. **Run Tests** - Execute `bun test` to verify functionality
3. **Check Results**:
   - **Passing** → `ralph close <id>` to close the task
   - **Failing** → Fix issues and repeat from step 2
4. **Never Skip Tests** - Always verify before closure

### Commands

#### Test-Gated Closure
```bash
ralph close <id>          # Runs tests, then closes if passing
ralph close <id> --force  # Force close without tests (use sparingly)
```

#### Manual Test Execution
```bash
bun test                  # Run unit tests
bunx playwright test      # Run UI tests (for frontend tasks)
```

## Script Integration

### close-with-proof.sh

The `close-with-proof.sh` script automates test-gated closure:

```bash
./rbp/scripts/close-with-proof.sh <task-id>
```

**Behavior:**
1. Executes test suite (`bun test`)
2. Checks test results
3. If passing: Closes task via `bd close <id>`
4. If failing: Reports failure, keeps task open

## CLI Integration

The `ralph close` command automatically enforces test-gated closure:

1. Executes test suite (`bun test`)
2. Checks test results
3. If passing: Closes task via `bd close <id>`
4. If failing: Reports failure, keeps task open

This makes quality gates automatic and enforceable in the autonomous execution loop.

## Why This Matters

**Quality Assurance**
- Prevents broken code from being marked complete
- Catches regressions before they enter the codebase
- Maintains high quality standards in autonomous execution

**Accountability**
- Creates a verifiable completion standard
- Tests serve as proof of functionality
- Enables confident autonomous task execution

**System Integrity**
- Ensures each closed task is production-ready
- Builds trust in the autonomous execution loop
- Protects against cascading failures from incomplete work

## Rules

**Write Tests First** - Create tests as part of task implementation, not after

**Test Locally** - Run `bun test` frequently during development to catch issues early

**Comprehensive Coverage** - Ensure tests cover edge cases and error conditions

**UI Tasks** - Frontend work requires Playwright tests for user interactions

**Force Close Sparingly** - Use `--force` only when tests are temporarily broken for legitimate reasons

## Common Scenarios

### Scenario 1: Standard Task Completion
```bash
# After implementing feature
bun test
# All tests pass
ralph close task-123
```

### Scenario 2: Test Failures
```bash
# After implementing feature
bun test
# Some tests fail
# Fix failing tests
bun test
# All tests pass
ralph close task-123
```

### Scenario 3: UI Task with Playwright
```bash
# After implementing UI feature
bunx playwright test
# All tests pass
ralph close task-456
```

## Anti-Patterns

**Never:**
- Mark tasks complete without running tests
- Skip test failures to "save time"
- Close tasks planning to "fix tests later"
- Disable or comment out failing tests to force closure
- Use `--force` flag as default behavior
- Close tasks with known failing tests

## Examples

### Example 1: Completing a Backend Task
```bash
# User completes authentication middleware implementation
$ bun test
✓ auth middleware validates JWT tokens
✓ auth middleware rejects invalid tokens
✓ auth middleware handles missing tokens
All tests passed!

$ ralph close auth-middleware-task
✓ Tests passed
✓ Task closed: auth-middleware-task
```

### Example 2: Test Failure Blocks Closure
```bash
# User completes payment processor
$ bun test
✓ payment processor initializes correctly
✗ payment processor handles refunds
  Expected status 200, got 400
✗ payment processor validates amounts
  Amount validation failing for negative values

$ ralph close payment-task
✗ Tests failed - task remains open
Fix the failing tests before closing.
```

### Example 3: Frontend Task with Playwright
```bash
# User completes dashboard UI
$ bunx playwright test
✓ dashboard displays user data
✓ dashboard handles loading states
✓ dashboard shows error messages
All tests passed!

$ ralph close dashboard-task
✓ Tests passed
✓ Task closed: dashboard-task
```
