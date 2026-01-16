---
description: Creates implementation specs through deep codebase analysis and exhaustive questioning
argument-hint: <feature-description>
allowed-tools: Read, Write, Edit, Grep, Glob, MultiEdit, AskUserQuestion
model: opusplan
---

# Quick Plan

Create a comprehensive implementation spec for `USER_PROMPT` by first analyzing the codebase deeply, then conducting an exhaustive interview to close all gaps and make all decisions. The final spec in `PLAN_OUTPUT_DIRECTORY` should have ZERO open questions.

## Variables

USER_PROMPT: $ARGUMENTS
PLAN_OUTPUT_DIRECTORY: specs/
MAX_QUESTIONS_PER_ROUND: 4

## Workflow

### Phase 1: Deep Codebase Analysis

1. Parse `USER_PROMPT` to identify the feature area
2. Scan project structure to understand overall architecture
3. Search for files related to the feature area (grep for keywords, glob for patterns)
4. Read key files to understand:
   - Current architecture and patterns in use
   - Existing similar features to follow as templates
   - Integration points the new feature will touch
   - Testing patterns used in the project
5. Build mental model of how this feature fits into the existing codebase
6. Detect testing infrastructure:
   - Check package.json for "test" script and test dependencies (jest, vitest, @types/bun, etc.)
   - Check for test files (glob for *.test.*, *.spec.*, *.bats)
   - Identify test framework: bun:test, jest, vitest, pytest, cargo test, bats, etc.
   - Note test file naming conventions used in project
   - Record the exact test command from package.json or infer from framework

### Phase 2: Big-Picture Interview (Upfront)

Before drafting any spec sections, ask clarifying questions about:

**Vision & Constraints**
- What specific problem is this solving and for whom?
- What would make you consider this feature a failure?
- What's explicitly out of scope?
- What's the minimum viable version vs the ideal version?

Use AskUserQuestion with 2-4 questions. Challenge vague answers - push for specifics.

### Phase 3: Section-by-Section Drafting with Questions

For each spec section, draft what you know from the codebase analysis, then ask questions to fill gaps.

**Section 1: Problem Statement**
- Draft based on Phase 2 answers
- Ask: What triggered this need? What's the cost of NOT doing this?

**Section 2: Technical Requirements**
- Draft based on codebase analysis (patterns found, integration points)
- Ask: What performance constraints exist? What data models are involved?
- If multiple approaches exist, present 2-3 options with tradeoffs and a recommended default

**Section 3: Edge Cases & Error Handling**
- Draft common edge cases based on similar features in codebase
- Ask: What happens when [specific failure mode]? What's the recovery path?
- Challenge assumptions: "You said X, but what if Y happens?"

**Section 4: User Experience**
- Ask: What's the user's mental model? Where might they get confused?
- Ask: What feedback do they need at each step?

**Section 5: Scope & Tradeoffs**
- Draft based on Phase 2 scope answers
- Ask: What technical debt are you knowingly accepting?
- Present tradeoff decisions with recommended defaults

**Section 6: Integration Requirements**
- Draft based on codebase integration points found
- Ask: What other systems need to know about this?
- Ask: What's the migration path for existing data/users?

**Section 7: Security & Compliance**
- Ask: What sensitive data does this touch?
- Ask: What authentication/authorization is required?

**Section 8: Success Criteria & Testing**
- Draft based on testing patterns found in codebase
- Ask: How do you know when this is done?
- Ask: What are the acceptance criteria?

**Section 9: Testing Strategy (MANDATORY for RBP)**
- Identify test framework used in project:
  - Check package.json "devDependencies" for jest/vitest/@types/bun
  - Check for pytest.ini, Cargo.toml [dev-dependencies], or test files
  - Note the framework found (e.g., "Detected: Bun Test")
- Note test file naming convention: *.test.ts, *.spec.ts, *.bats, test_*.py, etc.
- Draft unit tests required for each component/function
- Draft integration tests for system interactions
- If UI involved, note Playwright/E2E test requirements
- Specify the exact test command to run:
  - MUST be non-interactive (no --watch, no coverage prompts, no -i flags)
  - Examples by framework:
    - Bun: `bun test`
    - Jest: `npm test` or `npx jest`
    - Vitest: `npx vitest run` (NOT `npx vitest` which watches)
    - Pytest: `uv run pytest` or `pytest`
    - Cargo: `cargo test`
    - Bats: `bats test/`
  - Verify command exists in package.json "scripts" or is directly runnable
  - Command should be copy-pasteable and run without user interaction
- For each edge case identified in Section 3, add a corresponding test case
- Organize tests by type: unit tests (fast, isolated), integration tests (system interactions), E2E tests (full user flows)

**Section 10: Implementation Tasks (MANDATORY for RBP)**
- Break down the feature into discrete, ordered tasks
- Each task must have:
  - **ID**: Kebab-case unique identifier (e.g., "task-001", "auth-setup", "user-model")
  - **Dependencies**: Task IDs this depends on (e.g., "task-001, task-002") or "none"
  - **Files**: Comma-separated file paths to create/modify
  - **Acceptance**: Clear criteria - "what must be true when done"
  - **Tests**: Test file(s) that validate this task
- Task sizing: Each task should be completable in 1-2 hours (implement + test + verify)
  - ✅ Good size: "Create user model schema with validation"
  - ❌ Too large: "Implement entire authentication system"
  - ❌ Too small: "Add single import statement"
- Dependency rules (CRITICAL for parser):
  - Use task IDs only in Dependencies field (e.g., "task-001, task-002")
  - Use "none" explicitly for zero dependencies (not "", "N/A", "-", or omitted)
  - Ensure dependencies are acyclic (no circular references: A→B→A)
  - All dependency IDs must reference valid task IDs defined in the spec
  - Order tasks by dependency (foundation first, features second)
- Tag UI tasks with `[UI]` suffix in title for Playwright auto-detection:
  - UI keywords: component, visual, browser, render, button, form, modal, page, dashboard
  - Example: "### Task 3: Create Login Form [UI]"
- Enclose ALL tasks in RBP-TASKS markers (parser depends on these):
  ```markdown
  <!-- RBP-TASKS-START -->
  [all tasks here]
  <!-- RBP-TASKS-END -->
  ```

### Phase 4: Resolution Loop

After all sections are drafted:
1. Review for any remaining ambiguities or open questions
2. Use AskUserQuestion to resolve EVERY remaining unknown
3. When you don't know the answer and user is uncertain:
   - Present 2-3 concrete options with tradeoffs
   - Recommend a default option
   - Wait for confirmation before proceeding
4. Continue until the spec has ZERO open questions

### Phase 5: Write Final Spec

Generate filename from topic (kebab-case) and write to `PLAN_OUTPUT_DIRECTORY`.

### Phase 5.5: Validate RBP Compatibility

Before writing the final spec, validate:

1. ✅ Header includes "**RBP Compatible:** Yes"
2. ✅ Test Command is specified and non-interactive (no --watch, -i, or prompts)
3. ✅ Testing Strategy section exists with framework identified
4. ✅ Implementation Tasks section has `<!-- RBP-TASKS-START -->` and `<!-- RBP-TASKS-END -->` markers
5. ✅ Each task has all required fields: ID, Dependencies, Files, Acceptance, Tests
6. ✅ All dependency IDs reference valid tasks defined in the spec
7. ✅ No circular dependencies exist (check dependency chain)
8. ✅ Dependencies use "none" explicitly for zero-dependency tasks (not blank or N/A)
9. ✅ At least one test exists for each major component/feature
10. ✅ UI tasks are tagged with [UI] suffix in title

If any validation fails, fix before finalizing spec. The parser (`parse-spec-to-beads.sh`) will reject malformed specs.

## Spec Document Format

```markdown
# [Feature Name] Specification

**Generated:** [timestamp]
**Status:** Ready for Implementation
**RBP Compatible:** Yes

## Problem Statement
[Why this exists, who it's for, cost of not doing it]

## Technical Requirements
[Architecture decisions, data models, performance constraints]
[Decisions made with rationale]

## Edge Cases & Error Handling
[Specific failure modes and recovery paths]

## User Experience
[Mental model, confusion points, feedback requirements]

## Scope & Tradeoffs
[What's in/out, technical debt accepted, MVP vs ideal]

## Integration Requirements
[Systems affected, migration path]

## Security & Compliance
[Sensitive data, auth requirements]

## Success Criteria & Testing
[Acceptance criteria, test approach]

## Testing Strategy

### Test Framework
[Framework detected from package.json or test files: bun:test, jest, vitest, pytest, cargo test, bats, etc.]

### Test File Convention
[Naming pattern used in project: *.test.ts, *.spec.ts, test_*.py, *_test.go, etc.]

### Test Command
```bash
[Exact non-interactive command to run all tests - must be copy-pasteable]
# Examples: bun test, npm test, npx vitest run, uv run pytest, cargo test
# DO NOT use: --watch, -i, or commands that prompt for input
```

### Unit Tests
[Fast, isolated tests for individual components/functions]
- [ ] Test: [description] → File: `[path/to/test.test.ts]`
- [ ] Test: [description] → File: `[path/to/test.test.ts]`

### Integration Tests
[Tests for system interactions, API calls, database operations]
- [ ] Test: [description] → File: `[path/to/integration.test.ts]`

### E2E/Playwright Tests (if UI)
[Full user workflow tests in browser]
- [ ] Test: [description] → File: `[path/to/e2e.spec.ts]`

## Implementation Tasks

<!-- RBP-TASKS-START -->
<!-- CRITICAL: Parser depends on these markers - do not remove or modify -->

### Task 1: [Descriptive Title]
- **ID:** task-001  <!-- Unique kebab-case ID - used by Dependencies field in other tasks -->
- **Dependencies:** none  <!-- Use "none" explicitly, NOT blank/"N/A"/"-" -->
- **Files:** `[file1.ts]`, `[file2.ts]`  <!-- Comma-separated paths to create/modify -->
- **Acceptance:** [What must be true when done]  <!-- Clear criteria for completion -->
- **Tests:** `[test file that validates this task]`  <!-- Test file(s) that prove this works -->

### Task 2: [Descriptive Title]
- **ID:** task-002
- **Dependencies:** task-001  <!-- Task IDs only, comma-separated if multiple: "task-001, task-003" -->
- **Files:** `[file3.ts]`
- **Acceptance:** [What must be true when done]
- **Tests:** `[test file that validates this task]`

### Task 3: [Descriptive Title] [UI]
<!-- Tag UI tasks with [UI] suffix - parser auto-detects for Playwright -->
- **ID:** task-003
- **Dependencies:** task-002
- **Files:** `[component.tsx]`
- **Acceptance:** [What must be true when done]
- **Tests:** `[playwright test file]`  <!-- E2E test for UI components -->

<!-- RBP-TASKS-END -->
<!-- Parser extracts tasks between START/END markers - ensure all tasks are enclosed -->

## Implementation Notes
[Codebase-specific guidance: files to modify, patterns to follow]
```

## Questioning Rules

- NEVER leave questions in the spec - resolve them via AskUserQuestion
- CHALLENGE vague answers: "fast" must become "< 100ms p99"
- PROBE assumptions: "You said X works - what if it doesn't?"
- QUANTIFY everything: users, requests/sec, data volume
- When uncertain, SUGGEST 2-3 options with a recommended default
- WAIT for confirmation on suggested defaults before finalizing
- VALIDATE task dependencies: Ensure all task IDs are unique and dependency IDs reference valid tasks
- VERIFY dependency graph is acyclic: Check no task depends on itself through chain (A→B→C→A)
- CONFIRM test command is runnable: Ask user to verify if unsure about test script location or syntax
- VERIFY task granularity: If a task spans >3 files or >200 LOC, suggest splitting into smaller tasks
- CHECK edge case coverage: Ensure each edge case from Section 3 has a corresponding test in Testing Strategy

## Report

After creating and saving the implementation plan:

```
Implementation Plan Created

File: PLAN_OUTPUT_DIRECTORY/<filename.md>
Topic: <brief description>
Open Questions: 0 (all resolved via interview)
Key Decisions Made:
- <decision 1>
- <decision 2>
- <decision 3>
```
