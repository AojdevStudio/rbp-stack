# {Feature Name} Specification

**RBP Compatible: Yes**

## Problem Statement

{Describe the problem this feature solves. What user need does it address? What's broken or missing?}

## Proposed Solution

{High-level description of the solution approach. What will be built?}

## Technical Details

### Test Command

`bun test`

### Files Affected

- `src/path/to/file.ts` - {what changes}
- `tests/path/to/test.ts` - {new tests}

### Dependencies

{External libraries or internal modules this depends on}

## Implementation Tasks

<!-- RBP-TASKS-START -->
### Task 1: {Task Title}
- **ID:** task-001
- **Dependencies:** none
- **Files:** `src/path/to/file.ts`
- **Acceptance:** {Objective, testable criteria}
- **Tests:** {Specific test cases that must pass}

### Task 2: {Task Title}
- **ID:** task-002
- **Dependencies:** task-001
- **Files:** `src/path/to/other.ts`
- **Acceptance:** {Objective, testable criteria}
- **Tests:** {Specific test cases that must pass}

### Task 3: {Task Title}
- **ID:** task-003
- **Dependencies:** task-002
- **Files:** `src/path/to/another.ts`, `tests/another.test.ts`
- **Acceptance:** {Objective, testable criteria}
- **Tests:** {Specific test cases that must pass}
<!-- RBP-TASKS-END -->

## Out of Scope

{What this feature explicitly does NOT include}

## Testing Strategy

- Unit tests for {core logic}
- Integration tests for {API endpoints / data flow}
- {If UI:} Playwright tests for {visual components}

## Rollback Plan

{How to revert if something goes wrong}

---

## RBP Task Format Reference

Each task MUST follow this format for the parser to work:

```markdown
### Task N: {Title}
- **ID:** task-NNN
- **Dependencies:** task-MMM or none
- **Files:** {comma-separated file paths}
- **Acceptance:** {testable criteria - what "done" looks like}
- **Tests:** {specific test cases that will verify completion}
```

**Rules:**
- IDs must be unique (task-001, task-002, etc.)
- Dependencies reference other task IDs, or "none" if no blockers
- Acceptance criteria must be objective (no "looks good" or "works correctly")
- Tests must be specific enough to write actual test code from
