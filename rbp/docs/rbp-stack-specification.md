# RBP Stack Specification

**Ralph + Beads + PAI: Autonomous Epic Implementation**

Version: 3.0.0
Status: Production
Author: JARVIS (PAI)
Date: 2026-01-25
Last Updated: 2026-01-25

---

## Executive Summary

The RBP Stack enables autonomous end-to-end Epic implementation by integrating three systems:

- **Beads**: Source of truth state engine providing dynamic memory, task scheduling, and enforcement
- **Ralph**: TypeScript CLI execution engine (lib/src/cli.ts) that queries Beads and drives continuous development
- **PAI**: Personal AI Infrastructure (unchanged, provides global identity)

The stack augments existing BMAD workflows with Beads-first enforcement, ensuring agents complete all required actions with verified test results before tasks close.

## Tech Stack

- **Execution Engine:** TypeScript CLI (lib/src/cli.ts) using Commander.js
- **Runtime:** Bun
- **AI Execution:** Claude Code CLI (invoked as subprocess)
- **State Management:** Beads (git-backed) - query `bd ready`, never mirror to JSON
- **Testing:** bun test + Playwright
- **Configuration:** Zod schema validation, YAML config files
- **Logging:** Structured logger with levels (lib/src/observability/logger.ts)
- **Error Handling:** Typed errors with ErrorCodes (lib/src/utils/errors.ts)
- **Workflow Detection:** Automatic BMAD vs Beads detection (lib/src/utils/project-detector.ts)

---

## Problem Statement

### The "Forgetful Agent" Problem

AI agents are good at coding but bad at housekeeping. They frequently:

- Complete code but forget to mark story status as "review"
- Update one artifact but not another (sprint-status.yaml vs story doc)
- Skip adding dev notes
- Mark tasks `[x]` without actually completing all requirements
- **Lie about completion** to exit early (mark checkbox without running tests)

### The Context Saturation Problem

Long-running tasks exhaust context windows, causing:

- State drift (agent forgets earlier decisions)
- Loss of coherence over extended conversations
- No persistent memory across sessions

### The Solution

**Beads as the primary state engine** (not a mirror):

1. `bd ready` returns the next task to work on
2. Tasks cannot close without passing tests (test-gated closure)
3. Playwright verification required for UI stories
4. Execution Sequencer groups large stories into manageable phases
5. Full audit trail via git-versioned `issues.jsonl`
6. **Failure state injection**: Previous attempt notes are injected into next iteration's context

---

## Architecture Overview

### Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│                     PAI (Global Layer)                       │
│              ~/.claude/ - Identity, Security                 │
│                    *** UNCHANGED ***                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ augments (does not modify)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Project Layer (.claude/)                    │
│         Project-level hooks for Beads integration            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ invokes
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 BMAD Workflows (_bmad/)                       │
│    /bmad:bmm:workflows:{create-story,dev-story,code-review}  │
│                    *** UNCHANGED ***                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ populates (one-time conversion)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              BEADS STATE ENGINE (.beads/)                    │
│     *** SOURCE OF TRUTH - NOT A MIRROR ***                  │
│     Dynamic memory + Task scheduler + Enforcement            │
│         bd ready → next task | bd close → verified           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ queried by (bd ready)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         RALPH CLI (TypeScript + Commander.js)                │
│     bun lib/src/cli.ts run - Primary execution engine        │
│     ralph.sh - Wrapper script for convenience                │
│        Execution Sequencer groups subtasks into phases       │
│        Failure State Injection: Previous notes → Context     │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Beads is the source of truth** - Ralph queries Beads, not story files
2. **PAI remains unchanged** - No modifications to global PAI configuration
3. **BMAD workflows remain unchanged** - Use existing slash commands as-is
4. **Test-gated closure** - `ralph close` requires tests to pass (enforced in TypeScript)
5. **Playwright-gated UI** - UI stories require Playwright verification
6. **Failure state injection** - Previous attempt notes injected as context for retry attempts
7. **No atomizer needed** - 200k context fits all stories, but use Execution Sequencer for large ones
8. **Automatic workflow detection** - CLI detects BMAD vs Beads automatically (lib/src/utils/project-detector.ts)
9. **TypeScript-first** - Core logic in TypeScript, bash scripts are wrappers only

### Workflow Auto-Detection

The Ralph CLI automatically detects which workflow to use (lib/src/utils/project-detector.ts):

```typescript
export function findProjectRoot(): string {
  // Find project root by looking for package.json, .git, etc.
  let current = process.cwd();
  // ... (walks up directory tree)
  return current;
}

export function findSprintStatusPath(projectRoot: string): string | null {
  // Check common BMAD locations
  const candidates = [
    join(projectRoot, "docs/bmm/implementation-artifacts/sprint-status.yaml"),
    join(projectRoot, "docs/sprint-status.yaml"),
    // ...
  ];
  return candidates.find(existsSync) ?? null;
}

// In lib/src/commands/run.ts:
if (options.bmad) {
  workflow = "bmad";
} else if (options.beads) {
  workflow = "beads";
} else {
  // Auto-detect
  const sprintStatusPath = findSprintStatusPath(projectRoot);
  const beadsInstalled = await checkBeadsInstalled();

  if (sprintStatusPath) {
    workflow = "bmad";
  } else if (beadsInstalled) {
    workflow = "beads";
  }
}
```

This allows running `ralph run` without flags and having it "just work".

---

## Data Flow

### Story to Beads (One-Time Conversion)

```
BMAD story.md
     │
     │ parse-story-to-beads.sh
     │ (one-time conversion, NOT ongoing sync)
     ▼
Beads (issues.jsonl)
     │
     │ bd ready
     │ (returns next unblocked task)
     ▼
Ralph Loop executes task
     │
     │ Injects previous failure notes if retry
     │ (failure state injection for context)
     ▼
Implement task
     │
     │ bun test + playwright (if UI)
     │ (verification required)
     ▼
close-with-proof.sh
     ├─ Tests pass? → bd close (with proof)
     └─ Tests fail? → Append failure notes to bead
     │
     │ bd ready (next task or retry same task)
     ▼
Loop until all beads closed
```

### Why Beads Is Source of Truth (Not story.json)

| story.json approach | Beads-first approach |
|---------------------|----------------------|
| Flat JSON file | Graph with relationships |
| No history | Full git-backed audit trail |
| Agent marks `passes: true` | Agent must prove with test output |
| Reinvents state management | Uses purpose-built tool |
| Must sync two places | Single source of truth |
| No failure context | Injects previous attempt notes for retry |

---

## Data Model

### 1:1 Mapping Between BMAD and Beads

| BMAD Artifact | Beads Equivalent | Relationship |
|---------------|------------------|--------------|
| Story | Parent Bead | 1 story = 1 parent bead |
| Task (## Task N:) | Child Bead | 1 task = 1+ child beads |
| Subtask (- [ ] N.N) | Atomic child bead | Chained with dependencies |
| Housekeeping action | Child Bead | Explicit beads for status updates |

### BMAD Story Structure (from analysis)

```markdown
# Story X.Y: Title
Status: [done|in-progress|review]

## Story
As a **[role]**, I want **[feature]**, so that **[benefit]**.

## Acceptance Criteria
| AC# | Criteria | Verification |
|-----|----------|--------------|
| AC1 | [What] | [How to verify] |

## Tasks / Subtasks
- [ ] **Task 1: Title** (AC: #1, #2)
  - [ ] 1.1 Subtask description
  - [ ] 1.2 Another subtask
```

### Bead Hierarchy Example

```
bd-a1b2 (Story: "4-2-admin-dashboard")
├── bd-a1b2.1 (Task 1: Create constants file - AC: 12)
│   ├── bd-a1b2.1.1 (Subtask: 1.1)
│   └── bd-a1b2.1.2 (Subtask: 1.2, depends on 1.1)
├── bd-a1b2.2 (Task 2: Admin layout structure - AC: 1, 5, 6, depends on 1.2)
│   ├── bd-a1b2.2.1 (Subtask: 2.1)
│   └── bd-a1b2.2.2 (Subtask: 2.2, depends on 2.1)
├── bd-a1b2.3 (Task 3: AdminSidebar - AC: 2, 4, 5, depends on 2.2)
│   ├── bd-a1b2.3.1 (Subtask: 3.1)
│   ├── bd-a1b2.3.2 (Subtask: 3.2, depends on 3.1)
│   ├── bd-a1b2.3.3 (Subtask: 3.3, depends on 3.2)
│   └── ...
├── ...
├── bd-a1b2.H1 (Housekeeping: Update sprint-status → in-progress)
├── bd-a1b2.H2 (Housekeeping: Update sprint-status → review)
└── bd-a1b2.H3 (Housekeeping: Add dev notes)
```

### Bead Fields

```json
{
  "id": "bd-a1b2.2",
  "title": "Task 2: Admin layout structure",
  "type": "task",
  "status": "open",
  "priority": 2,
  "parent": "bd-a1b2",
  "parent_id": "bd-a1b2",
  "story_ref": "docs/bmm/implementation-artifacts/stories/story-4-2-admin-dashboard.md",
  "description": "Create the main admin layout component with sidebar and content area",
  "acceptance_criteria": ["AC1: Sidebar renders with 256px width", "AC5: Layout is responsive", "AC6: Content area fills remaining space"],
  "estimated_size": "medium",
  "subtasks": ["bd-a1b2.2.1", "bd-a1b2.2.2"],
  "requires_playwright": true,
  "dependencies": ["bd-a1b2.1.2"],
  "notes": "FAILED: 2026-01-19 14:32:15\ntypecheck: PASS\nbun test: FAIL (exit code 1)\nplaywright: SKIPPED"
}
```

**New fields for RBP Task Injection:**
- **description**: Task details (string, optional) - used if provided, falls back to notes
- **acceptance_criteria**: Array of acceptance criteria strings (array, optional) - injected into XML
- **estimated_size**: Task complexity estimate - "small", "medium", or "needs-decomposition" (enum, optional, defaults to "medium")
- **parent_id**: Reference to parent bead ID (string, optional) - enables hierarchy context in task injection

---

## Task Injection and XML Contract

### XML Task Injection (Ralph buildTaskXml)

When Ralph queries a ready task via `bd ready`, it constructs an XML block matching the promptv3 InjectionContract:

```typescript
export function buildTaskXml(task: Bead): string {
  const escapeCdata = (s: string) => s.replace(/]]>/g, "]]]]><![CDATA[>");

  const description = task.description || task.notes || "No description provided";
  const criteria = task.acceptance_criteria || [];
  const size = task.estimated_size || "medium";

  // Builds XML with CDATA-escaped content
  return `
  <CurrentTask>
    <BeadId><![CDATA[${escapeCdata(task.id)}]]></BeadId>
    <Title><![CDATA[${escapeCdata(task.title)}]]></Title>
    <Description><![CDATA[${escapeCdata(description)}]]></Description>
    <AcceptanceCriteria>
${criteria.map(c => `      <Criterion><![CDATA[${escapeCdata(c)}]]></Criterion>`).join("\n")}
    </AcceptanceCriteria>
    <EstimatedSize>${size}</EstimatedSize>
    ${task.parent_id ? `<ParentId><![CDATA[${escapeCdata(task.parent_id)}]]></ParentId>` : ""}
  </CurrentTask>
`;
}
```

This XML is appended directly to the promptv3.md prompt content, enabling Claude to receive structured task context without string interpolation issues.

### Injection Flow

```
bd ready --json
    ↓ (returns Bead object)
buildTaskXml(task)
    ↓ (constructs XML block)
promptv3.md + XML appended
    ↓ (passed to Claude stdin)
Claude receives complete prompt with injected task
```

---

## Subtask Execution

### Atomic Subtask Creation

When a task contains subtasks, `parse-spec-to-beads.sh` creates them as **separate child beads with chained dependencies**:

```bash
# Subtask 1: No dependencies
bd create "Subtask 1.1" --parent "$TASK_BEAD" -l "subtask"

# Subtask 2: Depends on Subtask 1
bd create "Subtask 1.2" --parent "$TASK_BEAD" -l "subtask" --depends "subtask-1-1-bead-id"

# Subtask 3: Depends on Subtask 2
bd create "Subtask 1.3" --parent "$TASK_BEAD" -l "subtask" --depends "subtask-1-2-bead-id"

# Task depends on final subtask
bd update "$TASK_BEAD" --depends "subtask-1-3-bead-id"
```

### Benefits of Atomic Subtasks

- **Clear sequencing**: Each subtask has explicit dependencies
- **Granular tracking**: Each subtask is independently verifiable
- **Failure recovery**: If subtask N fails, only that subtask retries
- **Optimal context**: Ralph executes one subtask per iteration

---

## Failure State Injection

### How It Works

When a task is retried after test failure:

1. `close-with-proof.sh` appends failure notes to the bead (test output, exit codes, etc.)
2. Ralph reads these notes via `bd show <task-id> --json`
3. The notes are injected into the prompt as "Previous Attempt Failed" section
4. Agent can see exactly what failed and fix it

### Implementation

In `ralph.sh` (lines 217-237):

```bash
# Fetch previous notes for failure state injection
local previous_notes=""
if command -v jq &>/dev/null && [ -n "$task_id" ] && [ "$task_id" != "unknown" ]; then
  cd "$PROJECT_ROOT"
  previous_notes=$(bd show "$task_id" --json 2>/dev/null | jq -r '.notes // empty' || echo "")
fi

# Inject failure context if previous notes exist
local failure_context=""
if [ -n "$previous_notes" ]; then
  failure_context="

## Previous Attempt Failed

The last attempt encountered these issues:

$previous_notes

Fix the issues above before proceeding.
"
fi

prompt="$prompt$failure_context

## Current Task from Beads

\`\`\`
$task
\`\`\`"
```

### Failure Note Injection (TypeScript Implementation)

When tests fail, the CLI appends failure notes to the bead (lib/src/commands/close.ts):

```typescript
if (!testResult.passed) {
  // Append failure notes for next iteration's context
  const timestamp = new Date().toISOString();
  const failureNote = `FAILED: ${timestamp}\n${testResult.output}`;

  await appendBeadNotes(beadId, failureNote);

  exitWithError(createError(ErrorCodes.TEST_FAILURE, "Tests failed", {
    suggestion: "Fix failing tests before closing the bead"
  }));
}
```

The next iteration reads these notes via `bd show <id> --json` and injects them into the prompt context.

---

## Execution Sequencer

### The Problem

Large stories have 50-70 subtasks. While they fit in token budget (largest = 12.9%), executing all subtasks without structure leads to:

- Cognitive overload
- No intermediate verification
- No commit checkpoints

### The Solution: Execution Phases

The Execution Sequencer groups subtasks into phases of 3-5 subtasks each:

```
Task 3: AdminSidebar (9 subtasks total)
├── Phase 1: Setup (subtasks 3.1-3.2)
│   └── Verify: Component renders, basic styling
│   └── Commit: "feat(admin): scaffold AdminSidebar component"
├── Phase 2: Navigation (subtasks 3.3-3.4)
│   └── Verify: Links render, routing works
│   └── Commit: "feat(admin): add sidebar navigation links"
└── Phase 3: Features (subtasks 3.5-3.9)
    └── Verify: Collapse, persistence, keyboard shortcut
    └── Commit: "feat(admin): complete sidebar interactions"
```

### Sequencer Logic

The Execution Sequencer is implemented in TypeScript (lib/src/parsers/sequencer.ts):

```typescript
export interface ExecutionPhase {
  phaseNumber: number;
  subtasks: string[];  // Bead IDs
  startIndex: number;
  endIndex: number;
}

export function calculateExecutionPhases(
  subtasks: string[],
  phaseSize: number = 5
): ExecutionPhase[] {
  if (subtasks.length <= phaseSize) {
    // Single phase
    return [{
      phaseNumber: 1,
      subtasks: subtasks,
      startIndex: 0,
      endIndex: subtasks.length - 1,
    }];
  }

  // Multi-phase
  const phases: ExecutionPhase[] = [];
  const totalPhases = Math.ceil(subtasks.length / phaseSize);

  for (let i = 0; i < totalPhases; i++) {
    const startIndex = i * phaseSize;
    const endIndex = Math.min(startIndex + phaseSize - 1, subtasks.length - 1);

    phases.push({
      phaseNumber: i + 1,
      subtasks: subtasks.slice(startIndex, endIndex + 1),
      startIndex,
      endIndex,
    });
  }

  return phases;
}
```

Configured via `config.execution.phase_size` (default: 5).

---

## Verification System

### Multi-Layered Defense Against Lying Agents

```
Layer 1: Objective Acceptance Criteria
  └─ Every task auto-includes: "bun test passes"

Layer 2: Protocol Mandate (promptv3.md)
  └─ Worker instructions require: Implement → Test → Verify → Close

Layer 3: Failure State Injection
  └─ Previous attempt notes injected for retry context
  └─ Agent cannot claim "unknown error" on retry

Layer 4: Test Gating (CRITICAL - TypeScript CLI)
  └─ ralph close REQUIRES test output as proof
  └─ Implemented in lib/src/commands/close.ts
  └─ No checkbox marking - only ralph close counts

Layer 5: Playwright Gating (UI stories)
  └─ UI acceptance criteria require: "playwright test passes"
  └─ Visual verification, not just unit tests
  └─ Configured via config.verification.require_playwright_for_ui

Layer 6: Code Review (Optional - Codex)
  └─ Separate adversarial agent validates all ACs
  └─ Enabled via config.codex.enabled

Layer 7: Audit Trail
  └─ All state changes in git-versioned issues.jsonl
```

### Test-Gated Closure (TypeScript Implementation)

The `ralph close` command (lib/src/commands/close.ts) implements test-gated closure:

```typescript
export async function closeCommand(beadId: string, options: CloseOptions): Promise<void> {
  const config = getConfig(globalOptions);
  const projectRoot = findProjectRoot();

  // Fetch bead info
  const bead = await getBeadInfo(beadId);

  if (!options.force && config.verification.require_tests) {
    // Run tests
    const testResult = await runTests(config.verification.test_command, projectRoot);

    if (!testResult.passed) {
      // Append failure notes
      await appendBeadNotes(beadId, `FAILED: ${new Date().toISOString()}\n${testResult.output}`);
      exitWithError(createError(ErrorCodes.TEST_FAILURE, "Tests failed", {
        suggestion: "Fix failing tests before closing the bead"
      }));
    }

    // Run Playwright if required
    if (bead.requires_playwright && config.verification.require_playwright_for_ui) {
      const playwrightResult = await runTests(config.verification.playwright_command, projectRoot);
      if (!playwrightResult.passed) {
        exitWithError(createError(ErrorCodes.TEST_FAILURE, "Playwright tests failed"));
      }
    }
  }

  // Close with proof
  await closeBead(beadId, `Verified: ${testResult.output.slice(-200)}`);
  logger.success(`Closed: ${beadId}`);
}
```

### Playwright Integration

For UI stories, Playwright verification is **required** before closure:

```typescript
// tests/admin-dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('AC1: AdminLayout renders sidebar and content', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('[data-testid="admin-layout"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-sidebar"]')).toHaveCSS('width', '256px');
});

test('AC4: Sidebar collapses with 200ms animation', async ({ page }) => {
  await page.goto('/admin');
  const sidebar = page.locator('[data-testid="admin-sidebar"]');
  await page.click('[data-testid="sidebar-toggle"]');
  // Playwright handles animation timing
  await expect(sidebar).toHaveCSS('width', '64px');
});
```

---

## Ralph CLI Implementation

### TypeScript CLI (Primary Execution Engine)

The Ralph CLI is written in TypeScript using Commander.js and runs on bun. The CLI implements:

1. **Query Beads** for next ready task via `bd ready --json`
2. **Build task XML** via `buildTaskXml()` matching InjectionContract (lib/src/commands/run.ts)
3. **Append XML to promptv3.md** for context injection
4. **Execute via Claude Code** subprocess
5. **Check for completion signals** (`<rbp:complete/>` or `<rbp:error>`)
6. **Loop until all tasks closed** or max iterations reached

Key implementation (lib/src/commands/run.ts, lines 118-172):

```typescript
if (workflow === "beads") {
  const result = await runBeadsWorkflow({
    config,
    maxIterations,
    dryRun: options.dryRun,
    onTaskReady: async (task) => {
      // Spawn Claude subprocess
      const proc = Bun.spawn(
        ["claude", "--dangerously-skip-permissions"],
        { stdin: "pipe", stdout: "pipe", stderr: "pipe", cwd: projectRoot }
      );

      // Read promptv3.md and build task XML
      const promptContent = readFileSync(promptPath, "utf-8");
      const taskXml = buildTaskXml(task);
      const prompt = `${promptContent}\n\n<!-- Task injected by Ralph -->\n${taskXml}`;

      // Inject prompt and execute
      proc.stdin?.write(new TextEncoder().encode(prompt));
      proc.stdin?.end();

      // Capture output
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      console.log(stdout);
      if (stderr) console.error(stderr);
    },
    runTests: async () => {
      // Run configured test command
      const proc = Bun.spawn(parseShellCommand(config.verification.test_command), {
        stdout: "pipe", stderr: "pipe", cwd: projectRoot,
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return { passed: exitCode === 0, output: stderr ? `${stdout}\n${stderr}` : stdout };
    },
  });
}
```

### ralph.sh (Wrapper Script)

`ralph.sh` in the project root is a convenience wrapper that invokes the TypeScript CLI:

```bash
#!/usr/bin/env bash
# Wrapper for the TypeScript CLI
exec bun "$(dirname "$0")/lib/src/cli.ts" run "$@"
```

### promptv3.md (Agent Execution Protocol)

Located at `scripts/promptv3.md` (copied to project root during installation), the RBP Execution Protocol (v3.0) defines comprehensive execution guidance including:

- Small changes philosophy (tracer bullets before full features)
- Three execution phases: Exploration → Execution → Verification
- XML-based InjectionContract for structured task context
- Enforcement of test-gated closure via `ralph close` (CLI command wraps test verification)
- Failure recovery via decomposition and retries
- Context window budget management (small changes = big testing budget)

The prompt enforces quality through:

```xml
<EnforcementAndConsequences>
  <Clause id="E1" name="Context Window Management">
    <Statement>
      If you make large changes and tests fail, you'll be in the dumb zone
      trying to fix cascading failures. Small changes = small blast radius = room to recover.
    </Statement>
  </Clause>
  <Clause id="E2" name="False Completion">
    <Statement>
      Outputting <![CDATA[<rbp:complete/>]]> without `ralph close` proof means work is discarded.
      Task remains open. Next iteration re-attempts.
    </Statement>
  </Clause>
  <Clause id="E3" name="Decomposition is Success">
    <Statement>
      Recognizing a task is too large and decomposing it is correct behavior.
      <![CDATA[<rbp:decomposed/>]]> is a valid, successful outcome.
    </Statement>
  </Clause>
  <Finality>The protocol is not optional. Small changes. Big testing. Stay smart.</Finality>
</EnforcementAndConsequences>
```

---

## Configuration

### Ralph Configuration (rbp-config.yaml)

Ralph uses a YAML configuration file with the following schema:

```yaml
project:
  name: "your-project-name"
  description: "Optional project description"

paths:
  stories: "docs/bmm/implementation-artifacts/stories"
  specs: "specs"
  beads: ".beads"
  scripts: "scripts"                    # NOT scripts/rbp - top-level scripts dir
  commands: "commands/rbp"              # NOT .claude/commands/rbp

execution:
  max_iterations: 50                    # 1-1000, default 50
  phase_size: 5                         # Subtasks per execution phase
  iteration_delay: 2                    # Seconds between iterations

verification:
  require_tests: true
  require_playwright_for_ui: true
  test_command: "bun test"
  typecheck_command: "bun run typecheck"
  playwright_command: "bunx playwright test"

ui_detection:
  enabled: true
  keywords: ["UI", "component", "button", "form"]

bmad:
  epics_dir: "docs/bmm/epics"          # Optional
  stories_dir: "docs/bmm/implementation-artifacts/stories"
  create_story: "/bmad:bmm:workflows:create-story"
  dev_story: "/bmad:bmm:workflows:dev-story"
  code_review: "/bmad:bmm:workflows:code-review"

quick_plan:
  command: "/quick-plan"
  spec_template: "templates/spec-template.md"

codex:
  enabled: true
  model: "gpt-5-codex"
  reasoning_effort: "high"              # low | medium | high
  skip_by_default: false

observability:
  enabled: true
  auto_launch: true
  pai_install_check: true

hooks:
  session_start: []                     # Array of shell commands
  pre_compact: []                       # Array of shell commands
```

All sections are optional with defaults defined in `lib/src/config/schema.ts`.

### Claude Settings (.claude/settings.json)

Project-level Claude configuration (separate from RBP config):

```json
{
  "hooks": {
    "SessionStart": [
      {"type": "command", "command": "bd prime 2>/dev/null || true"}
    ]
  },
  "permissions": {
    "allow": [
      "Bash(bd *)",
      "Bash(bun *)",
      "Bash(bunx playwright *)"
    ]
  }
}
```

Note: No `PostToolUse` hook for syncing - Beads is the source of truth, not story checkboxes.

---

## File Structure

### RBP Package (Installable)

```
rbp/                               # Installable package
├── lib/src/                       # TypeScript CLI source (PRIMARY)
│   ├── cli.ts                     # Main CLI entrypoint
│   ├── commands/
│   │   ├── run.ts                 # Run command (default)
│   │   ├── status.ts              # Status command
│   │   ├── close.ts               # Close command
│   │   └── exec-spec.ts           # Execute spec command
│   ├── workflows/
│   │   ├── beads.ts               # Beads workflow implementation
│   │   ├── bmad.ts                # BMAD workflow implementation
│   │   └── codex.ts               # Codex review workflow
│   ├── config/
│   │   ├── schema.ts              # Zod config schema
│   │   ├── loader.ts              # Config file loader
│   │   └── types.ts               # TypeScript config types
│   ├── integrations/
│   │   ├── beads-cli.ts           # Beads CLI wrapper
│   │   └── claude-cli.ts          # Claude CLI wrapper
│   ├── observability/
│   │   ├── logger.ts              # Structured logging
│   │   ├── events.ts              # Event emission
│   │   └── sanitizer.ts           # Output sanitization
│   ├── parsers/
│   │   ├── story-to-beads.ts      # BMAD story parser
│   │   ├── spec-to-beads.ts       # Spec parser
│   │   └── sequencer.ts           # Execution phase grouping
│   └── utils/
│       ├── errors.ts              # Error types and handling
│       ├── shell.ts               # Shell command utilities
│       └── project-detector.ts    # Project structure detection
│
├── scripts/
│   ├── promptv3.md                # Agent execution protocol (v3.0)
│   └── progress.txt               # Append-only execution log
│
├── commands/rbp/                  # Slash commands for Claude
│   ├── start.md                   # /rbp:start
│   ├── status.md                  # /rbp:status
│   └── validate.md                # /rbp:validate
│
├── templates/
│   ├── settings.json              # .claude/settings.json template
│   ├── rbp-config.yaml            # Configuration template
│   └── spec-template.md           # Quick-plan spec template
│
├── ralph.sh                       # Wrapper script (calls lib/src/cli.ts)
├── install.sh                     # Installation script
├── validate.sh                    # Validation script
└── uninstall.sh                   # Uninstallation script
```

### Installed Project Structure

```
your-project/
├── .claude/
│   └── settings.json              # Claude hooks (from template)
│
├── .beads/
│   ├── config.yaml                # Beads configuration
│   ├── issues.jsonl               # SOURCE OF TRUTH (git-tracked)
│   └── beads.db                   # SQLite cache (gitignored)
│
├── _bmad/                         # BMAD installation (if using BMAD)
│   └── bmm/workflows/
│
├── docs/bmm/implementation-artifacts/
│   ├── stories/                   # BMAD story files (reference only)
│   └── sprint-status.yaml
│
├── scripts/
│   ├── promptv3.md                # Agent protocol (copied from rbp/scripts/)
│   └── progress.txt               # Execution log
│
├── commands/rbp/                  # Slash commands (copied from rbp/commands/)
│   ├── start.md
│   ├── status.md
│   └── validate.md
│
├── tests/                         # Playwright tests
│   └── *.spec.ts
│
├── rbp-config.yaml                # Ralph configuration
├── AGENTS.md                      # Permanent agent memory
└── CLAUDE.md                      # Project context
```

---

## Story Analysis (From Real Data)

Based on analysis of 76 BMAD stories:

| Metric | Value |
|--------|-------|
| Total stories | 76 |
| Avg tokens/story | 3,914 |
| Largest story | 12,962 tokens (12.9% of 100k usable budget) |
| Avg subtasks/story | 24 |
| Most complex | 70 subtasks (story-3-7-review-incorrect-answers.md) |

### Story Complexity Distribution

| Size | Count | Strategy |
|------|-------|----------|
| Small (≤2 tasks) | 38 | Single loop, no phases |
| Medium (3-5 tasks) | 3 | Single loop, commit per task |
| Large (>5 tasks) | 35 | Multi-phase execution, commit per phase |

### Verdict: No Atomizer Needed

All stories fit within 200k token budget. Use **Execution Sequencer** for large stories instead of splitting them.

---

## Installation

### First-Time Setup

```bash
# 1. Clone or download the RBP package
git clone <rbp-repo-url> rbp

# 2. Install RBP into your project
cd your-project
../rbp/install.sh

# This will:
# - Copy lib/ directory (TypeScript CLI source)
# - Copy scripts/ (promptv3.md, progress.txt)
# - Copy commands/rbp/ (slash commands)
# - Copy templates/ (settings.json, rbp-config.yaml)
# - Create ralph.sh wrapper script
# - Set up .claude/settings.json
# - Initialize rbp-config.yaml

# 3. Initialize Beads (if not already)
bd init

# 4. Install dependencies
bun install

# 5. Install Playwright (if using UI tests)
bunx playwright install

# 6. Validate installation
./validate.sh
```

### Configuration

After installation, customize `rbp-config.yaml`:

```yaml
project:
  name: "your-project"
  description: "Your project description"

# Adjust paths if needed
paths:
  stories: "docs/stories"  # Your story location

# Configure verification commands
verification:
  test_command: "npm test"  # If not using bun
```

---

## Execution Flow

### CLI Commands

```bash
# Run the execution loop (primary command)
bun lib/src/cli.ts run
# or using wrapper
./ralph.sh

# Run with specific workflow
ralph run --beads                  # Force Beads workflow
ralph run --bmad                   # Force BMAD workflow

# Run with options
ralph run --max-iterations 100     # Custom max iterations
ralph run --dry-run                # Preview what would happen

# Check current status
ralph status

# Close a task with test verification
ralph close <bead-id>
ralph close <bead-id> --force      # Skip tests (not recommended)

# Execute a spec file
ralph exec-spec specs/feature.md
ralph exec-spec specs/feature.md --skip-review  # Skip Codex review

# Global options (all commands)
ralph --verbose run                # Debug logging
ralph --quiet run                  # Minimal logging
ralph --config custom.yaml run     # Custom config file
ralph --no-json-errors run         # Human-readable errors
```

### Starting a New Story (BMAD Workflow)

```bash
# 1. Create story using BMAD
# Invoke: /bmad:bmm:workflows:create-story

# 2. Convert story to Beads (one-time)
# Parser scripts are in lib/src/parsers/ (TypeScript)
# Or use bd CLI directly to create issues

# 3. Start Ralph loop
ralph run --bmad
```

### Starting a New Task (Beads Workflow)

```bash
# 1. Create beads manually or import from spec
bd create "Implement feature X"

# 2. Start Ralph loop
ralph run --beads
# Or auto-detect:
ralph run
```

### Resuming Work

```bash
# Ralph automatically resumes from where it left off
# bd ready returns the next unblocked task (or retry if previous failed)
ralph run
```

---

## Monitoring

### Check Progress

```bash
# See what's ready to work on
bd ready

# See all open tasks
bd list --status open

# See closed tasks
bd list --status closed

# Watch real-time
watch -n 5 "bd list --json | jq '.[] | {id, title, status}'"
```

---

## Changelog

### v3.0.0 (2026-01-25)

- **BREAKING**: Complete TypeScript rewrite of Ralph CLI
- **BREAKING**: File structure reorganized - lib/src/ is primary, not scripts/rbp/
- **BREAKING**: Configuration moved to rbp-config.yaml with Zod schema validation
- **BREAKING**: Commands moved from .claude/commands/rbp/ to commands/rbp/
- **BREAKING**: Scripts moved from scripts/rbp/ to scripts/ (top-level)
- Added: Commander.js-based CLI with structured commands (run, status, close, exec-spec)
- Added: Comprehensive config schema (lib/src/config/schema.ts) with 9 sections
- Added: Structured logging with levels (lib/src/observability/logger.ts)
- Added: Typed error handling with ErrorCodes (lib/src/utils/errors.ts)
- Added: Automatic workflow detection (BMAD vs Beads)
- Added: TypeScript parsers for story/spec conversion (lib/src/parsers/)
- Added: Beads CLI integration wrapper (lib/src/integrations/beads-cli.ts)
- Added: Codex review workflow (lib/src/workflows/codex.ts)
- Added: UI detection configuration (config.ui_detection)
- Added: Quick-plan configuration (config.quick_plan)
- Added: Observability configuration (config.observability)
- Changed: ralph.sh is now a wrapper script, not the main loop
- Changed: Test-gated closure implemented in TypeScript (lib/src/commands/close.ts)
- Changed: Execution Sequencer implemented in TypeScript (lib/src/parsers/sequencer.ts)
- Updated: Installation process copies entire lib/ directory
- Updated: Validation checks TypeScript CLI installation
- Maintained: promptv3.md agent protocol (XML InjectionContract)
- Maintained: Beads as source of truth architecture
- Maintained: Test-gated closure requirement
- Maintained: Failure state injection mechanism

### v2.0.0 (2026-01-09)

- **BREAKING**: Beads is now source of truth (not story.json mirror)
- **BREAKING**: Claude Code replaces amp as execution engine
- Added: Execution Sequencer for large stories
- Added: Playwright verification required for UI stories
- Added: Test-gated closure with proof
- Added: Multi-phase commit strategy
- Added: Failure state injection (previous attempt notes in context)
- Added: Atomic subtask creation with dependency chaining
- Added: Enforcement and Consequences section in protocol
- Added: Failure note appending in close-with-proof.sh
- Added: Extended Bead schema with description, acceptance_criteria, estimated_size, parent_id
- Added: buildTaskXml() function for XML task injection matching promptv3 InjectionContract
- Added: promptv3.md with XML InjectionContract for structured task context
- Removed: PostToolUse sync hook (no longer needed)
- Removed: story.json concept (use Beads directly)
- Updated: Story analysis from 76 real BMAD stories
- Updated: All scripts for new architecture

### v1.0.0 (2026-01-09)

- Initial specification (superseded by v2.0.0)
