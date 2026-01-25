# RBP Stack Architecture

**Version:** 3.0.0
**Last Updated:** January 25, 2026
**Status:** Production

---

## Table of Contents

- [Overview](#overview)
- [System Components](#system-components)
- [Layer Model](#layer-model)
- [Data Flow](#data-flow)
- [Execution Loop](#execution-loop)
- [File Structure](#file-structure)
- [Component Interactions](#component-interactions)
- [Design Principles](#design-principles)

---

## Overview

The RBP Stack is an autonomous development system that combines three core components:

- **Ralph**: TypeScript CLI execution engine using Commander.js
- **Beads**: Git-backed task graph serving as the single source of truth
- **PAI**: Personal AI Infrastructure (global layer, unchanged)

The system enables end-to-end autonomous Epic implementation with test-gated verification, preventing AI agents from marking tasks complete without proof.

### Key Architectural Decisions

1. **Beads is the source of truth** - not JSON files, not story checkboxes
2. **TypeScript-first** - core logic in TypeScript, bash scripts are wrappers
3. **Test-gated closure** - tasks cannot close without passing tests
4. **Workflow auto-detection** - system determines BMAD vs Beads automatically
5. **XML task injection** - structured context delivery to Claude

---

## System Components

### Ralph CLI (TypeScript Execution Engine)

**Location:** `lib/src/cli.ts`
**Runtime:** Bun
**Framework:** Commander.js

The Ralph CLI is the primary execution engine that orchestrates autonomous task completion.

**Core Responsibilities:**
- Query Beads for next ready task
- Build XML task context
- Spawn Claude Code subprocess
- Parse completion signals
- Run test verification
- Close tasks with proof

**Commands:**
```
ralph run         - Execute autonomous loop
ralph status      - Show execution state
ralph close <id>  - Close task with test verification
ralph exec-spec   - Execute a spec file
```

**Technology Stack:**
- TypeScript 5.x with strict mode
- Commander.js for CLI structure
- Zod for configuration validation
- Bun subprocess API for shell commands

### Beads (State Engine)

**Location:** `.beads/issues.jsonl`
**Type:** Git-backed JSONL database
**CLI:** `bd` (external dependency)

Beads provides dynamic memory, task scheduling, and enforcement through a git-versioned task graph.

**Core Responsibilities:**
- Store task state and relationships
- Provide dependency graph
- Track task history in git
- Support atomic operations
- Return next unblocked task

**Data Model:**
```typescript
interface Bead {
  id: string;
  title: string;
  status: "open" | "in_progress" | "blocked" | "deferred" | "closed";

  // RBP Extensions
  description?: string;
  acceptance_criteria?: string[];
  estimated_size?: "small" | "medium" | "needs-decomposition";
  parent_id?: string;

  // Standard fields
  priority?: string | number;
  notes?: string;
  labels?: string[];
}
```

### Claude Code (Execution Agent)

**Invocation:** `claude --dangerously-skip-permissions`
**Input:** Stdin (prompt + task XML)
**Output:** Stdout (code changes + completion signal)

Claude Code executes the actual implementation work following the RBP Execution Protocol (promptv3.md).

**Completion Signals:**
```xml
<rbp:complete/>                     <!-- Success -->
<rbp:error>message</rbp:error>      <!-- Failure -->
<rbp:decomposed>beads</rbp:decomposed>  <!-- Task too large -->
```

---

## Layer Model

```
┌─────────────────────────────────────────────────────────┐
│                  PAI (Global Layer)                      │
│           ~/.claude/ - Identity, Security                │
│                   *** UNCHANGED ***                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ augments (does not modify)
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Project Layer (.claude/)                      │
│      Project-level hooks for Beads integration           │
│                                                           │
│  - SessionStart: bd prime                                │
│  - SessionStart: bun hooks --session-start               │
│  - PreCompact: bun hooks --pre-compact                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ invokes
                     ▼
┌─────────────────────────────────────────────────────────┐
│          BMAD Workflows (_bmad/) [Optional]              │
│   /bmad:bmm:workflows:{create-story,dev-story}           │
│               *** UNCHANGED ***                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ populates (one-time)
                     ▼
┌─────────────────────────────────────────────────────────┐
│        BEADS STATE ENGINE (.beads/)                      │
│        *** SOURCE OF TRUTH ***                           │
│    Dynamic memory + Task scheduler + Enforcement         │
│      bd ready → next task | ralph close → verified       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ queried by
                     ▼
┌─────────────────────────────────────────────────────────┐
│      RALPH CLI (TypeScript + Commander.js)               │
│    bun lib/src/cli.ts run - Primary execution engine     │
│       Queries Beads → Builds XML → Spawns Claude         │
└─────────────────────────────────────────────────────────┘
```

**Layer Principles:**
1. **PAI remains unchanged** - no modifications to global configuration
2. **Project layer uses hooks** - integration without invasive changes
3. **BMAD is optional** - system works with or without BMAD workflows
4. **Beads is central** - all state flows through the Beads engine
5. **Ralph is TypeScript-first** - bash scripts are convenience wrappers

---

## Data Flow

### Task Lifecycle

```
┌──────────────────┐
│  Story/Spec      │
│  (BMAD or Plan)  │
└────────┬─────────┘
         │
         │ parse-story-to-beads.sh (one-time)
         │ parse-spec-to-beads.sh (one-time)
         ▼
┌──────────────────┐
│  Beads Tasks     │
│  (issues.jsonl)  │
└────────┬─────────┘
         │
         │ bd ready --json
         ▼
┌──────────────────┐
│  Ralph CLI       │
│  (TypeScript)    │
└────────┬─────────┘
         │
         │ buildTaskXml(task)
         ▼
┌──────────────────┐
│  XML Context     │
│  (CurrentTask)   │
└────────┬─────────┘
         │
         │ append to promptv3.md
         ▼
┌──────────────────┐
│  Claude Code     │
│  (subprocess)    │
└────────┬─────────┘
         │
         │ <rbp:complete/>
         ▼
┌──────────────────┐
│  Test Runner     │
│  (bun test)      │
└────────┬─────────┘
         │
         │ exit code 0
         ▼
┌──────────────────┐
│  bd close <id>   │
│  (with proof)    │
└──────────────────┘
```

### Failure State Injection

When tests fail, failure notes are appended to the bead and injected into the next iteration:

```
Task fails tests
    ↓
Append notes to bead
    ↓
bd show <id> --json
    ↓
Extract notes field
    ↓
Inject into prompt as "Previous Attempt Failed"
    ↓
Claude sees exact error and can fix
```

**Benefits:**
- Agent cannot claim "unknown error"
- Full context for debugging
- No state loss between iterations
- Incremental learning

---

## Execution Loop

### Autonomous Loop Diagram

```
START
  │
  ├─→ bd ready --json
  │       │
  │       ├─ No tasks? → EXIT SUCCESS
  │       │
  │       └─ Task found
  │           │
  │           ├─→ Read previous notes (if any)
  │           │
  │           ├─→ buildTaskXml(task)
  │           │
  │           ├─→ Append to promptv3.md
  │           │
  │           ├─→ Spawn Claude subprocess
  │           │       stdin: prompt + XML
  │           │       stdout: captured
  │           │
  │           ├─→ Parse output for signals
  │           │       │
  │           │       ├─ <rbp:complete/> found?
  │           │       │       │
  │           │       │       ├─→ Run bun test
  │           │       │       │       │
  │           │       │       │       ├─ PASS → bd close <id>
  │           │       │       │       │           │
  │           │       │       │       │           └─→ Loop
  │           │       │       │       │
  │           │       │       │       └─ FAIL → Append notes
  │           │       │       │                   │
  │           │       │       │                   └─→ Loop (retry)
  │           │       │
  │           │       ├─ <rbp:error/> found?
  │           │       │       └─→ Log error, EXIT FAILURE
  │           │       │
  │           │       └─ <rbp:decomposed/> found?
  │           │               └─→ Loop (new subtasks created)
  │           │
  │           ├─ Max iterations reached?
  │           │       └─→ EXIT INCOMPLETE
  │           │
  │           └─→ Loop
```

### Execution Phases (from promptv3.md)

**Phase 1: Exploration (GENEROUS budget)**
- Use semantic search (mgrep)
- Read existing patterns
- Understand minimal change needed
- Locate existing tests

**Phase 2: Execution (MINIMAL budget)**
- One logical change only
- Follow existing patterns
- No gold plating
- If writing >50 lines, reconsider

**Phase 3: Verification (LARGE budget)**
- Run `bun run typecheck`
- Run `bun run test`
- For UI: `bunx playwright test`
- Fix failures (you have budget for this)

**Philosophy:** Small change budget → Big testing/recovery budget

---

## File Structure

### RBP Package (Installable)

```
rbp/
├── lib/
│   ├── src/                        # TypeScript CLI source
│   │   ├── cli.ts                  # Main entrypoint
│   │   ├── commands/
│   │   │   ├── run.ts              # Run command
│   │   │   ├── status.ts           # Status command
│   │   │   ├── close.ts            # Close command
│   │   │   └── exec-spec.ts        # Spec execution
│   │   ├── workflows/
│   │   │   ├── beads.ts            # Beads workflow
│   │   │   └── bmad.ts             # BMAD workflow
│   │   ├── integrations/
│   │   │   ├── beads-cli.ts        # Beads CLI wrapper
│   │   │   └── claude-cli.ts       # Claude CLI wrapper
│   │   ├── config/
│   │   │   ├── schema.ts           # Zod config schema
│   │   │   ├── loader.ts           # Config loader
│   │   │   └── types.ts            # TypeScript types
│   │   ├── observability/
│   │   │   ├── logger.ts           # Structured logging
│   │   │   ├── events.ts           # Event emission
│   │   │   └── sanitizer.ts        # Output sanitization
│   │   ├── parsers/
│   │   │   ├── story-to-beads.ts   # Story parser
│   │   │   ├── spec-to-beads.ts    # Spec parser
│   │   │   └── sequencer.ts        # Execution sequencer
│   │   └── utils/
│   │       ├── errors.ts           # Error handling
│   │       ├── shell.ts            # Shell utilities
│   │       └── project-detector.ts # Workflow detection
│   └── dist/
│       └── index.js                # Compiled output
│
├── scripts/
│   ├── promptv3.md                 # Execution protocol
│   └── progress.txt                # Append-only log
│
├── commands/rbp/                   # Slash commands
│   ├── start.md                    # /rbp:start
│   ├── status.md                   # /rbp:status
│   └── validate.md                 # /rbp:validate
│
├── templates/
│   ├── settings.json               # Claude settings template
│   ├── rbp-config.yaml             # Config template
│   └── spec-template.md            # Spec template
│
├── ralph.sh                        # Wrapper script
├── install.sh                      # Installer
├── validate.sh                     # Validator
└── uninstall.sh                    # Uninstaller
```

### Installed Project Structure

```
project/
├── .beads/
│   ├── issues.jsonl                # SOURCE OF TRUTH (git-tracked)
│   ├── config.yaml                 # Beads config
│   └── beads.db                    # SQLite cache (gitignored)
│
├── .claude/
│   └── settings.json               # Project hooks
│
├── lib/                            # TypeScript CLI (copied)
│   ├── src/
│   └── dist/
│
├── scripts/
│   ├── promptv3.md                 # Agent protocol
│   └── progress.txt                # Execution log
│
├── commands/rbp/                   # Slash commands
│   ├── start.md
│   ├── status.md
│   └── validate.md
│
├── docs/
│   ├── bmm/implementation-artifacts/  # BMAD (optional)
│   │   ├── stories/
│   │   └── sprint-status.yaml
│   └── rbp-stack-specification.md
│
├── rbp-config.yaml                 # RBP configuration
├── CLAUDE.md                       # Project context
└── AGENTS.md                       # Agent memory
```

---

## Component Interactions

### Ralph ↔ Beads

**Query Ready Task:**
```typescript
// lib/src/integrations/beads-cli.ts
export async function getReadyBead(): Promise<BeadsCliResult<Bead | null>> {
  const result = await execBeadsCommand(["ready", "--json"]);
  if (!result.success) {
    return result;
  }
  const bead = JSON.parse(result.stdout) as Bead;
  return { success: true, data: bead };
}
```

**Close Task:**
```typescript
// lib/src/commands/close.ts
export async function closeCommand(beadId: string, options: CloseOptions) {
  // Run tests first
  const testResult = await runTests();

  if (!testResult.passed && !options.force) {
    await appendBeadNotes(beadId, `FAILED: ${testResult.output}`);
    exitWithError(createError(ErrorCodes.TEST_FAILURE, "Tests failed"));
  }

  // Close with proof
  await closeBead(beadId, `Verified: ${testResult.output.slice(-200)}`);
}
```

### Ralph ↔ Claude

**Task Injection:**
```typescript
// lib/src/commands/run.ts
const promptPath = join(projectRoot, "scripts/promptv3.md");
const promptContent = readFileSync(promptPath, "utf-8");
const taskXml = buildTaskXml(task);
const fullPrompt = `${promptContent}\n\n<!-- Task injected by Ralph -->\n${taskXml}`;

const proc = Bun.spawn(
  ["claude", "--dangerously-skip-permissions"],
  { stdin: "pipe", stdout: "pipe", stderr: "pipe", cwd: projectRoot }
);

proc.stdin?.write(new TextEncoder().encode(fullPrompt));
proc.stdin?.end();
```

**Completion Detection:**
```typescript
const [stdout, stderr, exitCode] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
  proc.exited,
]);

// Parse for completion signals
if (stdout.includes("<rbp:complete/>")) {
  // Success - run tests
}
if (stdout.includes("<rbp:error>")) {
  // Failure - extract error
}
if (stdout.includes("<rbp:decomposed>")) {
  // Decomposition - continue loop
}
```

### Beads ↔ Git

Beads uses git for version control and audit trail:

```bash
# After bd close
cd .beads
git add issues.jsonl
git commit -m "Close: bd-abc123 - Implement feature X"

# Full history available
git log issues.jsonl
```

**Benefits:**
- Every state change is versioned
- Rollback capability
- Audit trail for compliance
- Multi-user collaboration support

---

## Design Principles

### 1. Single Source of Truth

**Problem:** Multiple state stores lead to drift and inconsistency.

**Solution:** Beads is the only source of task state. No JSON files, no checkboxes.

```typescript
// ❌ WRONG: Mirror state to JSON
const tasks = JSON.parse(readFileSync("story.json"));
tasks[0].completed = true;
writeFileSync("story.json", JSON.stringify(tasks));

// ✅ RIGHT: Query Beads directly
const task = await getReadyBead();
await closeBead(task.id);
```

### 2. Test-Gated Closure

**Problem:** Agents mark tasks complete without running tests.

**Solution:** `ralph close` requires test proof before closure.

```typescript
// lib/src/commands/close.ts
if (!options.force && config.verification.require_tests) {
  const testResult = await runTests(config.verification.test_command);

  if (!testResult.passed) {
    // Append failure notes for context injection
    await appendBeadNotes(beadId, `FAILED: ${new Date().toISOString()}\n${testResult.output}`);
    exitWithError(createError(ErrorCodes.TEST_FAILURE, "Tests failed"));
  }
}
```

### 3. Failure State Injection

**Problem:** Context loss between iterations when tasks fail.

**Solution:** Inject previous failure notes into prompt for retry.

```typescript
// Read previous notes
const bead = await showBead(taskId);
const previousNotes = bead.notes || "";

if (previousNotes) {
  const failureContext = `
## Previous Attempt Failed

${previousNotes}

Fix the issues above before proceeding.
`;
  prompt = `${prompt}\n${failureContext}`;
}
```

### 4. TypeScript-First Architecture

**Problem:** Bash scripts are hard to test, debug, and maintain.

**Solution:** Core logic in TypeScript, bash as thin wrappers.

```bash
# ralph.sh (wrapper)
#!/usr/bin/env bash
exec bun "$(dirname "$0")/lib/src/cli.ts" run "$@"
```

```typescript
// lib/src/cli.ts (core logic)
export const program = new Command()
  .name("ralph")
  .version("3.0.0")
  .description("RBP autonomous execution loop")
  .addCommand(runCommandDef)
  .addCommand(statusCommandDef)
  .addCommand(closeCommandDef);
```

### 5. Workflow Auto-Detection

**Problem:** Users must remember which workflow their project uses.

**Solution:** Detect workflow automatically based on project structure.

```typescript
// lib/src/utils/project-detector.ts
export function detectWorkflow(projectRoot: string): "bmad" | "beads" | null {
  // Check for BMAD
  const sprintStatusPath = findSprintStatusPath(projectRoot);
  if (sprintStatusPath) {
    return "bmad";
  }

  // Check for Beads
  const beadsInstalled = await checkBeadsInstalled();
  if (beadsInstalled) {
    return "beads";
  }

  return null;
}
```

---

## See Also

- [Installation Guide](installation.md) - Setup and configuration
- [CLI Reference](cli-reference.md) - Command-line interface
- [Configuration Guide](configuration.md) - Configuration options
- [Workflows Guide](workflows.md) - Step-by-step workflows
- [RBP Stack Specification](rbp-stack-specification.md) - Complete technical spec
