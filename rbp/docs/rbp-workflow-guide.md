# RBP Workflow Guide: Autonomous Task Execution

**Version:** 3.0
**Last Updated:** January 24, 2026
**Status:** Current Implementation

---

## Executive Summary

The RBP Stack (Ralph + Beads + PAI) provides autonomous task execution with test-gated verification. This document describes the **actual implementation** as of v3.0, which uses:

- **TypeScript CLI** (Commander.js + Bun runtime) - not bash loops
- **Beads integration** via `bd ready` - direct queries, no JSON mirrors
- **XML task injection** via `promptv3.md` - structured context delivery
- **Completion signal**: `<rbp:complete/>` - not `<promise>COMPLETE</promise>`
- **Slash commands**: `/rbp:start`, `/rbp:status`, `/rbp:validate` - not `/bmad:*`

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                  Ralph CLI (TypeScript)                  │
│              bun lib/src/cli.ts [command]                │
│                                                           │
│  Commands:                                                │
│  - run         Execute autonomous loop                    │
│  - status      Show execution state                       │
│  - close       Close task with test verification          │
│  - exec-spec   Execute a spec file                        │
└─────────────────────────────────────────────────────────┘
                          │
                          │ queries
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Beads CLI (Source of Truth)                 │
│                  bd ready --json                          │
│                                                           │
│  Returns: Bead object with:                               │
│  - id, title, status                                      │
│  - description, acceptance_criteria                       │
│  - estimated_size, parent_id                              │
└─────────────────────────────────────────────────────────┘
                          │
                          │ task data
                          ▼
┌─────────────────────────────────────────────────────────┐
│           Task XML Injection (buildTaskXml)              │
│                                                           │
│  Constructs:                                              │
│  <CurrentTask>                                            │
│    <BeadId>bd-abc123</BeadId>                             │
│    <Title>Task title</Title>                              │
│    <Description>Task details</Description>                │
│    <AcceptanceCriteria>                                   │
│      <Criterion>Tests pass</Criterion>                    │
│    </AcceptanceCriteria>                                  │
│  </CurrentTask>                                           │
└─────────────────────────────────────────────────────────┘
                          │
                          │ appended to
                          ▼
┌─────────────────────────────────────────────────────────┐
│               Prompt Template (promptv3.md)              │
│                                                           │
│  RBP Execution Protocol v3.0                              │
│  - Small changes philosophy                               │
│  - Exploration → Execution → Verification                 │
│  - Test-gated closure enforcement                         │
│  - Completion signal: <rbp:complete/>                     │
└─────────────────────────────────────────────────────────┘
                          │
                          │ piped to stdin
                          ▼
┌─────────────────────────────────────────────────────────┐
│           Claude Code CLI (--dangerously-skip)           │
│                                                           │
│  Executes task following protocol                         │
│  Outputs: stdout with completion signal                   │
└─────────────────────────────────────────────────────────┘
```

### TypeScript CLI Structure

```
lib/
├── src/
│   ├── cli.ts                    # Main entry point, Commander setup
│   ├── commands/
│   │   ├── run.ts                # run command implementation
│   │   ├── status.ts             # status command
│   │   ├── close.ts              # close command with test gating
│   │   └── exec-spec.ts          # spec execution
│   ├── workflows/
│   │   ├── beads.ts              # Beads workflow implementation
│   │   └── bmad.ts               # BMAD workflow implementation
│   ├── integrations/
│   │   └── beads-cli.ts          # Beads CLI wrapper functions
│   ├── observability/
│   │   ├── logger.ts             # Structured logging
│   │   └── events.ts             # Event emission
│   └── utils/
│       ├── errors.ts             # Error handling
│       ├── shell.ts              # Shell command parsing
│       └── project-detector.ts   # Workflow detection
└── dist/
    └── index.js                  # Compiled output
```

---

## Workflows

The RBP Stack supports two execution workflows:

### 1. Beads Workflow

**Trigger**: Project has `.beads/` directory or `--beads` flag

**Flow**:
```
bd ready --json
    ↓ (returns next task)
buildTaskXml(task)
    ↓ (creates XML block)
claude --dangerously-skip < (promptv3.md + taskXml)
    ↓ (executes task)
Check for <rbp:complete/> signal
    ↓
bun test (verification)
    ↓
bd close <id> (if tests pass)
    ↓
Loop until no tasks ready
```

**Key Files**:
- `lib/src/workflows/beads.ts` - Main workflow logic
- `scripts/promptv3.md` - Agent instructions
- `lib/src/integrations/beads-cli.ts` - Beads interface

### 2. BMAD Workflow

**Trigger**: Project has `sprint-status.yaml` or `--bmad` flag

**Flow**:
```
Read sprint-status.yaml
    ↓ (find active stories)
For each story:
    ↓
    Invoke BMAD slash command
    ↓
    Execute workflow
    ↓
    Transition story status
```

**Key Files**:
- `lib/src/workflows/bmad.ts` - BMAD integration
- `docs/bmm/implementation-artifacts/stories/` - Story files
- `docs/sprint-status.yaml` - Sprint tracking

---

## Task Injection Contract

### XML Structure (InjectionContract)

When Ralph fetches a task via `bd ready`, it constructs XML matching the promptv3.md InjectionContract:

```xml
<CurrentTask>
  <BeadId><![CDATA[bd-abc123]]></BeadId>
  <Title><![CDATA[Implement user authentication]]></Title>
  <Description><![CDATA[
    Add JWT-based authentication to the API.
    This requires middleware, token generation, and validation.
  ]]></Description>
  <AcceptanceCriteria>
    <Criterion><![CDATA[bun test passes]]></Criterion>
    <Criterion><![CDATA[Login endpoint returns valid JWT]]></Criterion>
    <Criterion><![CDATA[Protected routes verify token]]></Criterion>
  </AcceptanceCriteria>
  <EstimatedSize>medium</EstimatedSize>
  <ParentId><![CDATA[bd-parent-id]]></ParentId>
</CurrentTask>
```

### buildTaskXml Implementation

From `lib/src/commands/run.ts`:

```typescript
export function buildTaskXml(task: Bead): string {
  const escapeCdata = (s: string) => s.replace(/]]>/g, "]]]]><![CDATA[>");

  const description = task.description || task.notes || "No description provided";
  const criteria = task.acceptance_criteria || [];
  const size = task.estimated_size || "medium";

  const criteriaXml = criteria.length > 0
    ? criteria.map(c => `      <Criterion><![CDATA[${escapeCdata(c)}]]></Criterion>`).join("\n")
    : "      <Criterion><![CDATA[Task completed successfully]]></Criterion>";

  return `
  <CurrentTask>
    <BeadId><![CDATA[${escapeCdata(task.id)}]]></BeadId>
    <Title><![CDATA[${escapeCdata(task.title)}]]></Title>
    <Description><![CDATA[${escapeCdata(description)}]]></Description>
    <AcceptanceCriteria>
${criteriaXml}
    </AcceptanceCriteria>
    <EstimatedSize>${size}</EstimatedSize>
    ${task.parent_id ? `<ParentId><![CDATA[${escapeCdata(task.parent_id)}]]></ParentId>` : ""}
  </CurrentTask>
`;
}
```

### Bead Schema Extensions

The Beads CLI integration uses extended fields for RBP:

```typescript
export const BeadSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["open", "in_progress", "blocked", "deferred", "closed"]),

  // RBP Extensions
  description: z.string().optional(),           // Task details
  acceptance_criteria: z.array(z.string()).optional(),  // Verification criteria
  estimated_size: z.enum(["small", "medium", "needs-decomposition"]).optional(),
  parent_id: z.string().optional(),             // Parent bead reference

  // Standard fields
  priority: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  notes: z.string().optional(),
  labels: z.array(z.string()).optional(),
  // ... timestamps, etc.
});
```

---

## Execution Protocol (promptv3.md)

### Philosophy

The RBP Execution Protocol v3.0 enforces:

**Small Changes, Big Testing Budgets**
- Make each task the smallest possible unit of work
- Small change budget → Big testing/recovery budget
- Stay in the smart zone of the context window

### Core Principles

1. **Tracer Bullets First**: Validate architecture before building features
2. **One Logical Change**: Single task per iteration
3. **Test-Gated Closure**: No completion without proof
4. **Decompose, Don't Force**: Break down tasks that are too large
5. **Fight Entropy**: Leave code better than you found it

### Execution Phases

**Phase 1: Exploration (GENEROUS budget)**
- Use `mgrep` for semantic search
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

### Completion Signals

Three possible outcomes:

```xml
<!-- Success: All acceptance criteria met, tests pass -->
<rbp:complete/>

<!-- Failure: Critical error prevents continuation -->
<rbp:error>Detailed error description</rbp:error>

<!-- Decomposition: Task too large, created subtasks -->
<rbp:decomposed>Created beads: bd-x, bd-y, bd-z</rbp:decomposed>
```

### Tool Usage

**Primary search**: `mgrep` (semantic search)
- Replaces multiple `grep`/`glob` calls
- Context-efficient exploration

**Closure tool**: `ralph close <id>` (NEVER `bd close` directly)
- Runs tests before closing
- Only closes if tests pass
- Records proof at closure

**Decomposition tool**: `bd create "subtask" --parent <id>`
- Create child beads when task too large

---

## Commands

### ralph run

Execute the autonomous execution loop.

```bash
# Auto-detect workflow
bun lib/src/cli.ts run

# Explicit workflow
bun lib/src/cli.ts run --beads
bun lib/src/cli.ts run --bmad

# Limit iterations
bun lib/src/cli.ts run --max-iterations 5

# Dry run (show plan without executing)
bun lib/src/cli.ts run --dry-run
```

**Options**:
- `--beads` - Use Beads workflow
- `--bmad` - Use BMAD workflow
- `--max-iterations <n>` - Maximum iterations (positive integer >= 1)
- `--dry-run` - Show execution plan without running

**Auto-detection logic**:
1. Check for `sprint-status.yaml` → BMAD
2. Check for `bd --version` → Beads
3. If neither found → Error

### ralph status

Show current execution state.

```bash
bun lib/src/cli.ts status
```

**Output**:
- Project type (BMAD/Beads)
- Task progress
- Next available task
- Configuration details

### ralph close

Close a task with test verification.

```bash
# Normal closure (runs tests)
bun lib/src/cli.ts close <bead-id>

# Force closure (skip tests) - USE WITH CAUTION
bun lib/src/cli.ts close <bead-id> --force

# Dry run
bun lib/src/cli.ts close <bead-id> --dry-run
```

**Verification steps**:
1. Run `bun test`
2. Check exit code
3. If pass → `bd close <id>`
4. If fail → Keep task open, log failure

### ralph exec-spec

Execute a quick-plan spec file.

```bash
# Execute spec with default settings
bun lib/src/cli.ts exec-spec specs/my-feature.md

# Skip Codex review
bun lib/src/cli.ts exec-spec specs/my-feature.md --skip-review

# Limit iterations
bun lib/src/cli.ts exec-spec specs/my-feature.md --max-iterations 10
```

---

## Slash Commands

### /rbp:start

Start the RBP autonomous execution loop.

**Location**: `commands/rbp/start.md`

**Behavior**:
1. Run `bd status` to show current state
2. Run `bd ready` to check for available tasks
3. If no tasks:
   - BMAD projects: Auto-continue epic (generate next story)
   - Quick-plan projects: Find specs with `<!-- RBP-TASKS-START -->` markers
4. If tasks available: Run `ralph run` (auto-detects workflow)
5. Loop until completion

**Observability Integration**:
- Checks for PAI Observability Dashboard
- Launches if not running: `~/.claude/observability/manage.sh start`
- Opens browser to http://localhost:5172
- Shows real-time progress, test results, errors

### /rbp:status

Show RBP execution status.

**Location**: `commands/rbp/status.md`

**Output**:
- Task overview (total, open, closed, ready)
- Next task from `bd ready`
- Recent progress from `progress.txt`
- Recommended action

### /rbp:validate

Validate RBP installation.

**Location**: `commands/rbp/validate.md`

**Checks**:
- Prerequisites: `bd`, `bun`, `claude`
- Directory structure: `lib/dist/`, `commands/rbp/`, `.beads/`
- Configuration: `rbp-config.yaml`

---

## Project Structure

```
project/
├── .beads/
│   ├── issues.jsonl          # Source of truth (git-tracked)
│   └── config.yaml           # Beads configuration
│
├── commands/
│   └── rbp/
│       ├── start.md          # /rbp:start command
│       ├── status.md         # /rbp:status command
│       └── validate.md       # /rbp:validate command
│
├── lib/                      # TypeScript CLI
│   ├── src/
│   │   ├── cli.ts
│   │   ├── commands/
│   │   ├── workflows/
│   │   └── integrations/
│   └── dist/
│       └── index.js
│
├── scripts/
│   ├── promptv3.md           # Execution protocol
│   ├── progress.txt          # Append-only learnings
│   └── ralph.sh              # Bash wrapper (optional)
│
├── docs/
│   ├── bmm/implementation-artifacts/  # BMAD artifacts
│   │   ├── stories/
│   │   └── sprint-status.yaml
│   └── rbp-stack-specification.md
│
├── rbp-config.yaml           # RBP configuration
└── CLAUDE.md                 # Project context
```

---

## Configuration

### rbp-config.yaml

```yaml
execution:
  max_iterations: 10
  auto_continue: true

verification:
  test_command: "bun test"
  require_playwright: false

beads:
  labels:
    - "rbp"
  auto_sync: true

logging:
  level: "info"
  json_errors: true
```

### Validation Rules

From `lib/src/cli.ts`:

1. **max_iterations**: Must be positive integer >= 1 (prevents NaN)
2. **json_errors**: Boolean, defaults to true
3. **--bmad** and **--beads**: Mutually exclusive flags

---

## Beads Integration

### Key Functions

From `lib/src/integrations/beads-cli.ts`:

```typescript
// Check if beads is installed
export async function checkBeadsInstalled(): Promise<boolean>

// Get next ready task
export async function getReadyBead(): Promise<BeadsCliResult<Bead | null>>

// List all beads with filters
export async function listBeads(options: {
  status?: string;
  all?: boolean;
}): Promise<BeadsCliResult<Bead[]>>

// Show specific bead
export async function showBead(id: string): Promise<BeadsCliResult<Bead>>

// Update bead status
export async function updateBeadStatus(
  id: string,
  status: "open" | "in_progress" | "blocked" | "deferred" | "closed"
): Promise<BeadsCliResult<void>>

// Close bead
export async function closeBead(id: string): Promise<BeadsCliResult<void>>

// Create new bead
export async function createBead(
  title: string,
  options: CreateBeadOptions
): Promise<BeadsCliResult<string>>
```

### Workflow Integration

From `lib/src/workflows/beads.ts`:

```typescript
export async function runBeadsWorkflow(options: {
  config: RbpConfig;
  maxIterations: number;
  dryRun?: boolean;
  onTaskReady: (task: Bead) => Promise<void>;
  runTests: () => Promise<{ passed: boolean; output: string }>;
}): Promise<WorkflowResult>
```

**Loop logic**:
1. Call `getReadyBead()` to fetch next task
2. If no task → Exit with success
3. Build task XML via `buildTaskXml(task)`
4. Invoke `onTaskReady(task)` callback (executes Claude)
5. Check for completion signal in output
6. If complete → Run `runTests()` callback
7. If tests pass → Close bead, continue
8. If tests fail → Log failure, retry next iteration
9. Loop until max iterations or no tasks

---

## Error Handling

### Error Codes

From `lib/src/utils/errors.ts`:

```typescript
export enum ErrorCodes {
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
  INVALID_CONFIG = "INVALID_CONFIG",
  NO_WORKFLOW_DETECTED = "NO_WORKFLOW_DETECTED",
  BEADS_COMMAND_FAILED = "BEADS_COMMAND_FAILED",
  BEADS_PARSE_ERROR = "BEADS_PARSE_ERROR",
  TEST_FAILURE = "TEST_FAILURE",
  WORKFLOW_ERROR = "WORKFLOW_ERROR",
}
```

### Structured Errors

```typescript
export interface RbpError {
  code: ErrorCodes;
  message: string;
  details?: Record<string, unknown>;
  suggestion?: string;
}
```

**JSON error output** (default):
```json
{
  "error": {
    "code": "BEADS_COMMAND_FAILED",
    "message": "bd ready failed",
    "details": {
      "stderr": "No open issues found"
    },
    "suggestion": "Run 'bd status' to check the beads state"
  }
}
```

**Human-readable output** (`--no-json-errors`):
```
Error: bd ready failed
  Code: BEADS_COMMAND_FAILED
  Details: stderr = "No open issues found"
  Suggestion: Run 'bd status' to check the beads state
```

---

## Testing

### CLI Tests

Located at `lib/src/commands/run.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { parseMaxIterations } from "../cli";

describe("CLI validation", () => {
  test("parseMaxIterations validates positive integers", () => {
    expect(parseMaxIterations("5", 10)).toBe(5);
    expect(parseMaxIterations("0", 10)).toBe(10); // Falls back to default
    expect(parseMaxIterations("-1", 10)).toBe(10);
    expect(parseMaxIterations("abc", 10)).toBe(10);
  });
});
```

### Verification Strategy

**Unit tests**: Core functions, parsers, validators
- Location: `lib/src/**/*.test.ts`
- Run: `bun test`

**Integration tests**: Full workflow execution
- Location: `tests/integration/`
- Run: `bun test tests/integration/`

**Playwright tests**: UI verification (for UI stories)
- Location: `tests/*.spec.ts`
- Run: `bunx playwright test`

---

## Differences from Old Documentation

### OLD (unified-claude-workflow-by-claude-ai.md)

- Bash-based architecture
- `prd.json` files for task storage
- Complex decomposer scripts
- `<promise>COMPLETE</promise>` signal
- `/bmad:*` slash commands
- `bmad/` directory structure
- Story → Ralph JSON transformation
- Sub-story decomposition algorithm

### NEW (Actual Implementation)

- **TypeScript CLI** (Commander.js + Bun)
- **Beads as source of truth** (no JSON files)
- **XML task injection** via `buildTaskXml()`
- **`<rbp:complete/>` signal**
- **`/rbp:*` slash commands**
- **`scripts/` directory**
- **Direct Beads queries** via `bd ready --json`
- **No decomposition** - tasks managed in Beads

---

## Migration Notes

If you have old RBP v1.0 installations:

1. **Remove old structure**:
   ```bash
   rm -rf bmad/
   rm -rf scripts/ralph/active/prd.json
   rm -rf scripts/ralph/archive/
   ```

2. **Initialize Beads**:
   ```bash
   bd init
   ```

3. **Install new CLI**:
   ```bash
   cd scripts/rbp
   bun install
   bun run build
   ```

4. **Update slash commands**:
   - Replace `.claude/commands/bmad-*` with `rbp-*`
   - Update command references in workflows

5. **Migrate tasks**:
   - Convert existing stories to Beads:
     ```bash
     scripts/parse-story-to-beads.sh docs/stories/story-*.md
     ```

---

## Troubleshooting

### "No workflow detected"

**Symptom**: `ralph run` exits with error

**Cause**: Neither BMAD nor Beads detected

**Fix**:
1. For Beads: Run `bd init`
2. For BMAD: Create `sprint-status.yaml`
3. Or use explicit flag: `ralph run --beads`

### "bd ready" returns no tasks

**Symptom**: Loop exits immediately

**Cause**: No open/ready beads in database

**Fix**:
1. Check bead status: `bd list --status open`
2. Create tasks from story: `parse-story-to-beads.sh story.md`
3. Verify dependencies: `bd graph`

### Tests fail but task closes anyway

**Symptom**: Task marked closed despite test failures

**Cause**: Using `bd close` directly instead of `ralph close`

**Fix**: Always use `ralph close <id>` which enforces test gating

### Task stuck in loop (retries infinitely)

**Symptom**: Same task executes repeatedly

**Cause**: Tests fail, no progress made

**Fix**:
1. Check failure notes: `bd show <id>`
2. Fix code manually if needed
3. Run tests locally: `bun test`
4. Force close if appropriate: `ralph close <id> --force`

---

## Best Practices

1. **Always use ralph close**: Never call `bd close` directly
2. **Small tasks**: Break large tasks into subtasks via `bd create --parent`
3. **Test first**: Write tests before implementation
4. **Tracer bullets**: Implement minimal path first, then expand
5. **Read progress.txt**: Check learnings before starting new tasks
6. **Commit frequently**: After each task completion
7. **Use mgrep**: Semantic search reduces tool calls
8. **Decompose early**: If task feels too large, use `<rbp:decomposed/>`

---

## Appendix A: Command Reference

### ralph CLI

```bash
# Run with auto-detection
ralph run

# Run specific workflow
ralph run --beads
ralph run --bmad

# Limit iterations
ralph run --max-iterations 5

# Dry run
ralph run --dry-run

# Show status
ralph status

# Close task with tests
ralph close <id>

# Force close (skip tests)
ralph close <id> --force

# Execute spec file
ralph exec-spec specs/feature.md

# Global options
ralph --config path/to/config.yaml run
ralph --verbose run
ralph --quiet run
ralph --json-errors run
ralph --no-json-errors run
```

### Beads CLI

```bash
# Check ready tasks
bd ready

# List all tasks
bd list

# Show specific task
bd show <id>

# Create task
bd create "Task title"

# Create subtask
bd create "Subtask title" --parent <parent-id>

# Update status
bd update <id> --status in_progress

# Close task (prefer ralph close)
bd close <id>

# Sync to git
bd sync

# Show dependency graph
bd graph
```

---

## Appendix B: File Formats

### sprint-status.yaml (BMAD)

```yaml
project: "My Project"
current_phase: 4
current_epic: 1
current_sprint: 1

epics:
  - id: 1
    name: "Epic Name"
    status: in-progress
    stories:
      - id: "4-1"
        title: "Story Title"
        status: done
      - id: "4-2"
        title: "Another Story"
        status: in-progress
```

### issues.jsonl (Beads)

```jsonl
{"id":"bd-abc123","title":"Implement auth","status":"open","priority":1}
{"id":"bd-def456","title":"Add tests","status":"closed","priority":2}
```

### rbp-config.yaml

```yaml
execution:
  max_iterations: 10
  auto_continue: true

verification:
  test_command: "bun test"
  require_playwright: false

beads:
  labels:
    - "rbp"
  auto_sync: true

logging:
  level: "info"
  json_errors: true
```

---

## Conclusion

The RBP Stack v3.0 provides autonomous task execution with:

- **TypeScript CLI** for reliable execution
- **Beads integration** for task management
- **XML task injection** for structured context
- **Test-gated closure** for quality assurance
- **Two workflows** (BMAD and Beads) for flexibility

This documentation reflects the **actual implementation** as of January 2026. For older documentation (pre-v3.0), see `docs/archive/`.
