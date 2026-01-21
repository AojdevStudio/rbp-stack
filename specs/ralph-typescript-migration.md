# Ralph TypeScript Migration Specification

**Generated:** 2026-01-20
**Status:** Ready for Implementation
**RBP Compatible:** Yes

## Problem Statement

The current RBP execution scripts (`ralph.sh`, `ralph-execute.sh`, and supporting scripts) are implemented in Bash with significant complexity:

- **YAML parsing requires 3 fallback methods** (yq → python → grep/sed)
- **JSON handling requires jq with fallbacks** for systems without jq
- **No unit testing possible** for workflow logic
- **Platform-specific hacks** (macOS vs GNU sed detection)
- **Growing complexity** (~700 lines in ralph.sh alone)

This migration rewrites the entire script suite in TypeScript, leveraging Bun's native capabilities for a cleaner, testable, maintainable codebase.

**Cost of NOT doing this:** Continued maintenance burden, inability to add features confidently, no test coverage for critical autonomous execution logic.

## Technical Requirements

### Architecture Overview

```
rbp/
├── package.json              # Isolated dependencies (commander, zod)
├── tsconfig.json             # TypeScript configuration
├── ralph.sh                  # Thin bash wrapper (~5 lines)
├── lib/
│   ├── src/
│   │   ├── cli.ts            # Commander CLI definition
│   │   ├── commands/
│   │   │   ├── run.ts        # ralph run (default)
│   │   │   ├── close.ts      # ralph close <id>
│   │   │   ├── status.ts     # ralph status
│   │   │   └── exec-spec.ts  # ralph exec-spec <file>
│   │   ├── config/
│   │   │   ├── schema.ts     # Zod schemas for config validation
│   │   │   ├── loader.ts     # YAML + CLI flag merging
│   │   │   └── types.ts      # Exported TypeScript types
│   │   ├── workflows/
│   │   │   ├── bmad.ts       # BMAD story state machine
│   │   │   ├── beads.ts      # Beads task iteration
│   │   │   └── codex.ts      # Codex pre-flight review
│   │   ├── integrations/
│   │   │   ├── beads-cli.ts  # bd CLI wrapper with Zod validation
│   │   │   ├── claude-cli.ts # claude CLI wrapper
│   │   │   └── bmad-cli.ts   # BMAD slash command invocation
│   │   ├── observability/
│   │   │   ├── events.ts     # Event emission (replaces emit-event.sh)
│   │   │   ├── logger.ts     # Text progress logging
│   │   │   └── sanitizer.ts  # Secret redaction
│   │   ├── utils/
│   │   │   ├── shell.ts      # Shell execution helpers
│   │   │   ├── errors.ts     # Structured JSON error handling
│   │   │   └── colors.ts     # Terminal colors
│   │   └── index.ts          # Main entry point
│   └── dist/                 # Compiled output (built during install)
├── tests/
│   ├── config.test.ts
│   ├── workflows/
│   │   ├── bmad.test.ts
│   │   └── beads.test.ts
│   ├── integrations/
│   │   └── beads-cli.test.ts
│   └── commands/
│       ├── run.test.ts
│       └── close.test.ts
├── install.sh                # Updated installer (runs bun build)
└── validate.sh               # Updated validator
```

### Dependencies (rbp/package.json)

```json
{
  "name": "rbp-stack",
  "version": "3.0.0",
  "type": "module",
  "scripts": {
    "build": "bun build ./lib/src/index.ts --outdir ./lib/dist --target bun",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.4.0"
  }
}
```

### CLI Interface

```bash
# Default: run execution loop
ralph                           # Auto-detect workflow (bmad or beads)
ralph --bmad                    # Force BMAD workflow
ralph --beads                   # Force Beads workflow
ralph --max-iterations 100      # Set iteration limit
ralph --dry-run                 # Show what would happen

# Subcommands
ralph run [options]             # Explicit run (same as default)
ralph close <id> [options]      # Close task with test verification
ralph status                    # Show current state
ralph exec-spec <file>          # Execute spec file (replaces ralph-execute.sh)

# Global options
ralph --help                    # Show help
ralph --version                 # Show version
ralph --config <path>           # Custom config file
ralph --verbose                 # Increase output
ralph --quiet                   # Decrease output
ralph --json-errors             # Output errors as JSON (default: true)
```

### Configuration Schema (Zod)

```typescript
import { z } from 'zod';

export const RbpConfigSchema = z.object({
  project: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),

  paths: z.object({
    stories: z.string().default('docs/bmm/implementation-artifacts/stories'),
    specs: z.string().default('specs'),
    beads: z.string().default('.beads'),
    scripts: z.string().default('scripts/rbp'),
  }),

  execution: z.object({
    max_iterations: z.number().min(1).max(1000).default(50),
    phase_size: z.number().min(1).max(20).default(5),
    iteration_delay: z.number().min(0).max(60).default(2),
  }),

  verification: z.object({
    require_tests: z.boolean().default(true),
    require_playwright_for_ui: z.boolean().default(true),
    test_command: z.string().default('bun test'),
    typecheck_command: z.string().default('bun run typecheck'),
    playwright_command: z.string().default('bunx playwright test'),
  }),

  ui_detection: z.object({
    enabled: z.boolean().default(true),
    keywords: z.array(z.string()).default(['UI', 'component', 'button', 'form']),
  }),

  bmad: z.object({
    epics_dir: z.string().optional(),
    stories_dir: z.string().optional(),
    create_story: z.string().default('/bmad:bmm:workflows:create-story'),
    dev_story: z.string().default('/bmad:bmm:workflows:dev-story'),
    code_review: z.string().default('/bmad:bmm:workflows:code-review'),
  }),

  codex: z.object({
    enabled: z.boolean().default(true),
    model: z.string().default('gpt-5-codex'),
    reasoning_effort: z.enum(['low', 'medium', 'high']).default('high'),
    skip_by_default: z.boolean().default(false),
  }),

  observability: z.object({
    enabled: z.boolean().default(true),
    auto_launch: z.boolean().default(true),
  }),
});

export type RbpConfig = z.infer<typeof RbpConfigSchema>;
```

### Beads CLI Types (Zod-validated)

```typescript
export const BeadSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['open', 'in_progress', 'closed']),
  notes: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  created: z.string(),
  updated: z.string(),
});

export const BeadListSchema = z.array(BeadSchema);

export type Bead = z.infer<typeof BeadSchema>;
```

### Error Handling (Structured JSON)

```typescript
export interface RbpError {
  code: string;           // e.g., "CONFIG_INVALID", "BEADS_NOT_INITIALIZED"
  message: string;        // Human-readable message
  details?: unknown;      // Additional context
  suggestion?: string;    // How to fix it
}

export function exitWithError(error: RbpError): never {
  if (process.env.RBP_JSON_ERRORS !== 'false') {
    console.error(JSON.stringify(error));
  } else {
    console.error(`Error [${error.code}]: ${error.message}`);
    if (error.suggestion) {
      console.error(`Suggestion: ${error.suggestion}`);
    }
  }
  process.exit(1);
}
```

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Both `--bmad` and `--beads` specified | Exit with error: "Cannot use --bmad and --beads together" |
| No workflow detected (no sprint-status.yaml, no .beads) | Exit with error, suggest `bd init` or check branch name |
| Beads CLI not installed | Exit with error: "bd command not found. Install beads first." |
| Bun not installed | Bash wrapper shows error before TypeScript runs |
| Invalid YAML config | Zod validation error with specific field path |
| `bd ready --json` returns malformed JSON | Catch parse error, retry once, then fail with details |
| Test command fails | Emit error event, append failure to bead notes, continue loop |
| Claude CLI hangs | Respect timeout from config, kill process, emit timeout error |
| BMAD workflow slash command fails | Emit error, keep story in current status, retry next iteration |

## User Experience

### Mental Model

Users think of Ralph as:
1. **An autonomous executor** that picks up work and completes it
2. **A test enforcer** that won't lie about completion
3. **A workflow orchestrator** for BMAD or Beads-based development

### Output Format (Moderate Verbosity)

```
╔═══════════════════════════════════════════════════════════╗
║          Ralph - Autonomous Execution Loop                ║
║                    RBP Stack v3.0                         ║
╚═══════════════════════════════════════════════════════════╝

Workflow: BMAD
Epic: 4
Config: rbp-config.yaml
Max Iterations: 50

═══════════════════════════════════════════════════════════
  Iteration 1/50 | Story: 4-9-bulk-import-csv | Status: backlog
═══════════════════════════════════════════════════════════

→ Running create-story workflow...
✓ Story drafted
→ Running dev-story workflow...
→ Running tests...
✓ Tests passed (23 passed, 0 failed)
✓ Story moved to review

═══════════════════════════════════════════════════════════
  Iteration 2/50 | Story: 4-9-bulk-import-csv | Status: review
═══════════════════════════════════════════════════════════

→ Running code-review workflow...
✓ Review approved
✓ Story complete

╔═══════════════════════════════════════════════════════════╗
║              EPIC 4 COMPLETE!                             ║
╚═══════════════════════════════════════════════════════════╝
```

### Dry Run Output

```bash
$ ralph --dry-run --bmad

[DRY RUN] Would execute BMAD workflow
[DRY RUN] Detected epic: 4
[DRY RUN] Sprint status file: docs/bmm/sprint-status.yaml
[DRY RUN] Next story: 4-9-bulk-import-csv (status: backlog)
[DRY RUN] Would run: /bmad:bmm:workflows:create-story
[DRY RUN] No changes made
```

## Scope & Tradeoffs

### In Scope

- Full rewrite of ralph.sh, ralph-execute.sh, emit-event.sh
- Migration of close-with-proof.sh to internal function
- New CLI with subcommands
- Comprehensive test coverage (80%+)
- Zod validation for all external data
- Structured JSON error output

### Out of Scope (Future Work)

- Migration of parse-story-to-beads.sh (keep bash for now)
- Migration of parse-spec-to-beads.sh (keep bash for now)
- npm publishing (manual install via install.sh)
- Watch mode for development

### Technical Debt Accepted

- Bash wrapper still required (thin, acceptable)
- parse-*-to-beads.sh remain bash (defer to future PR)
- No hot reload during development (acceptable for CLI tool)

## Integration Requirements

### Systems Affected

1. **install.sh** - Must run `bun install` and `bun build` during installation
2. **validate.sh** - Must check for lib/dist/ and bun availability
3. **Slash commands** - `/rbp:start` must invoke new `ralph` command
4. **Claude prompt.md** - Update to reference `ralph close` instead of `close-with-proof.sh`

### Migration Path

1. User runs new `install.sh`
2. Installer detects old bash scripts, removes them
3. Installs new TypeScript-based ralph
4. Runs `bun build` to compile
5. Updates slash commands to use new CLI
6. Validates installation

## Security & Compliance

### Sensitive Data

- Config files may contain paths but no secrets
- Observability events are sanitized (same patterns as current emit-event.sh)
- Test output is sanitized before logging

### Authentication

- No authentication required for local execution
- Claude CLI handles its own auth
- Beads CLI handles its own auth

## Success Criteria & Testing

### Acceptance Criteria

1. `ralph` command executes BMAD workflow identically to bash version
2. `ralph --beads` command executes Beads workflow identically to bash version
3. `ralph exec-spec` replaces ralph-execute.sh functionality
4. `ralph close <id>` replaces close-with-proof.sh functionality
5. All tests pass with 80%+ coverage
6. Structured JSON errors work correctly
7. Dry-run mode works for all commands
8. Config validation catches invalid YAML

### Definition of Done

- [ ] All commands functional
- [ ] 80%+ test coverage
- [ ] install.sh updated and working
- [ ] validate.sh updated and working
- [ ] prompt.md updated
- [ ] Slash commands updated
- [ ] Old bash scripts removed

## Testing Strategy

### Test Framework

Bun's built-in test runner (`bun test`)

### Test Command

```bash
bun test
```

### Unit Tests

- [ ] Test: Config schema validates correct YAML → File: `tests/config.test.ts`
- [ ] Test: Config schema rejects invalid YAML with helpful errors → File: `tests/config.test.ts`
- [ ] Test: CLI flag merging overrides YAML values → File: `tests/config.test.ts`
- [ ] Test: Beads CLI wrapper parses bd ready --json → File: `tests/integrations/beads-cli.test.ts`
- [ ] Test: Beads CLI wrapper handles malformed JSON → File: `tests/integrations/beads-cli.test.ts`
- [ ] Test: BMAD state machine transitions correctly → File: `tests/workflows/bmad.test.ts`
- [ ] Test: BMAD detects epic from branch name → File: `tests/workflows/bmad.test.ts`
- [ ] Test: Beads workflow finds next ready task → File: `tests/workflows/beads.test.ts`
- [ ] Test: Beads workflow injects failure context → File: `tests/workflows/beads.test.ts`
- [ ] Test: Event emission produces valid JSONL → File: `tests/observability/events.test.ts`
- [ ] Test: Sanitizer redacts API keys and tokens → File: `tests/observability/sanitizer.test.ts`
- [ ] Test: Error formatter outputs valid JSON → File: `tests/utils/errors.test.ts`

### Integration Tests

- [ ] Test: `ralph status` shows correct state → File: `tests/commands/status.test.ts`
- [ ] Test: `ralph close` runs tests before closing → File: `tests/commands/close.test.ts`
- [ ] Test: `ralph --dry-run` doesn't execute anything → File: `tests/commands/run.test.ts`
- [ ] Test: Conflicting flags show error → File: `tests/cli.test.ts`

### E2E Tests (Manual Verification)

- [ ] Install on fresh project, run ralph --beads
- [ ] Install on BMAD project, run ralph --bmad
- [ ] Run ralph exec-spec with sample spec

## Implementation Tasks

<!-- RBP-TASKS-START -->

### Task 1: Initialize TypeScript project structure
- **ID:** ts-001
- **Dependencies:** none
- **Files:** `rbp/package.json`, `rbp/tsconfig.json`, `rbp/lib/src/index.ts`
- **Acceptance:** `bun build` compiles without errors, `bun test` runs (even if no tests yet)
- **Tests:** Manual verification of build

### Task 2: Implement Zod config schema and loader
- **ID:** ts-002
- **Dependencies:** ts-001
- **Files:** `rbp/lib/src/config/schema.ts`, `rbp/lib/src/config/loader.ts`, `rbp/lib/src/config/types.ts`
- **Acceptance:** Can load rbp-config.yaml, validate it, merge with CLI flags
- **Tests:** `tests/config.test.ts`

### Task 3: Implement structured error handling
- **ID:** ts-003
- **Dependencies:** ts-001
- **Files:** `rbp/lib/src/utils/errors.ts`, `rbp/lib/src/utils/colors.ts`
- **Acceptance:** Errors output as JSON, include code/message/suggestion
- **Tests:** `tests/utils/errors.test.ts`

### Task 4: Implement Beads CLI wrapper with Zod validation
- **ID:** ts-004
- **Dependencies:** ts-002, ts-003
- **Files:** `rbp/lib/src/integrations/beads-cli.ts`
- **Acceptance:** Can call `bd ready --json`, parse and validate response
- **Tests:** `tests/integrations/beads-cli.test.ts`

### Task 5: Implement observability event emitter
- **ID:** ts-005
- **Dependencies:** ts-003
- **Files:** `rbp/lib/src/observability/events.ts`, `rbp/lib/src/observability/sanitizer.ts`, `rbp/lib/src/observability/logger.ts`
- **Acceptance:** Emits JSONL events to ~/.claude/history/raw-outputs/, sanitizes secrets
- **Tests:** `tests/observability/events.test.ts`, `tests/observability/sanitizer.test.ts`

### Task 6: Implement Beads workflow logic
- **ID:** ts-006
- **Dependencies:** ts-004, ts-005
- **Files:** `rbp/lib/src/workflows/beads.ts`
- **Acceptance:** Can iterate through beads tasks, inject failure context, track progress
- **Tests:** `tests/workflows/beads.test.ts`

### Task 7: Implement BMAD workflow logic
- **ID:** ts-007
- **Dependencies:** ts-004, ts-005
- **Files:** `rbp/lib/src/workflows/bmad.ts`, `rbp/lib/src/integrations/bmad-cli.ts`
- **Acceptance:** Can read sprint-status.yaml, detect epic, run BMAD slash commands
- **Tests:** `tests/workflows/bmad.test.ts`

### Task 8: Implement Claude CLI wrapper
- **ID:** ts-008
- **Dependencies:** ts-003, ts-005
- **Files:** `rbp/lib/src/integrations/claude-cli.ts`
- **Acceptance:** Can invoke claude with prompt, capture output, handle timeouts
- **Tests:** `tests/integrations/claude-cli.test.ts`

### Task 9: Implement Commander CLI with subcommands
- **ID:** ts-009
- **Dependencies:** ts-002, ts-003
- **Files:** `rbp/lib/src/cli.ts`, `rbp/lib/src/commands/run.ts`, `rbp/lib/src/commands/status.ts`, `rbp/lib/src/commands/close.ts`, `rbp/lib/src/commands/exec-spec.ts`
- **Acceptance:** All subcommands parse correctly, --help works, conflicting flags error
- **Tests:** `tests/cli.test.ts`, `tests/commands/*.test.ts`

### Task 10: Implement `ralph run` command
- **ID:** ts-010
- **Dependencies:** ts-006, ts-007, ts-008, ts-009
- **Files:** `rbp/lib/src/commands/run.ts`
- **Acceptance:** Executes full loop for both BMAD and Beads workflows
- **Tests:** `tests/commands/run.test.ts`

### Task 11: Implement `ralph close` command (replaces close-with-proof.sh)
- **ID:** ts-011
- **Dependencies:** ts-004, ts-005, ts-009
- **Files:** `rbp/lib/src/commands/close.ts`
- **Acceptance:** Runs tests, only closes bead if tests pass, emits events
- **Tests:** `tests/commands/close.test.ts`

### Task 12: Implement `ralph exec-spec` command (replaces ralph-execute.sh)
- **ID:** ts-012
- **Dependencies:** ts-006, ts-009
- **Files:** `rbp/lib/src/commands/exec-spec.ts`, `rbp/lib/src/workflows/codex.ts`
- **Acceptance:** Can run Codex review, invoke parse-spec-to-beads.sh, then run loop
- **Tests:** `tests/commands/exec-spec.test.ts`

### Task 13: Implement dry-run mode for all commands
- **ID:** ts-013
- **Dependencies:** ts-010, ts-011, ts-012
- **Files:** `rbp/lib/src/commands/run.ts`, `rbp/lib/src/commands/close.ts`, `rbp/lib/src/commands/exec-spec.ts`
- **Acceptance:** --dry-run shows what would happen without executing
- **Tests:** `tests/commands/run.test.ts` (dry-run cases)

### Task 14: Create thin bash wrapper
- **ID:** ts-014
- **Dependencies:** ts-010
- **Files:** `rbp/ralph.sh`
- **Acceptance:** `./ralph.sh` invokes bun lib/dist/index.js correctly
- **Tests:** Manual verification

### Task 15: Update install.sh for TypeScript build
- **ID:** ts-015
- **Dependencies:** ts-014
- **Files:** `rbp/install.sh`
- **Acceptance:** Installs deps, runs bun build, removes old bash scripts
- **Tests:** Manual verification on fresh project

### Task 16: Update validate.sh for new structure
- **ID:** ts-016
- **Dependencies:** ts-015
- **Files:** `rbp/validate.sh`
- **Acceptance:** Checks for lib/dist/, bun availability, correct symlinks
- **Tests:** Manual verification

### Task 17: Update prompt.md to reference new CLI
- **ID:** ts-017
- **Dependencies:** ts-011
- **Files:** `rbp/scripts/prompt.md`
- **Acceptance:** References `ralph close` instead of `close-with-proof.sh`
- **Tests:** Manual review

### Task 18: Update slash commands for new CLI
- **ID:** ts-018
- **Dependencies:** ts-014
- **Files:** `rbp/commands/rbp/start.md`, `rbp/commands/rbp/status.md`, `rbp/commands/rbp/validate.md`
- **Acceptance:** Slash commands invoke new ralph CLI correctly
- **Tests:** Manual verification

### Task 19: Remove deprecated bash scripts
- **ID:** ts-019
- **Dependencies:** ts-015, ts-016, ts-017, ts-018
- **Files:** Remove: `rbp/scripts/ralph.sh` (old), `rbp/scripts/ralph-execute.sh`, `rbp/scripts/emit-event.sh`, `rbp/scripts/close-with-proof.sh`
- **Acceptance:** Old scripts deleted, no references remain
- **Tests:** `grep -r "ralph-execute" rbp/` returns nothing

### Task 20: Achieve 80%+ test coverage
- **ID:** ts-020
- **Dependencies:** ts-001 through ts-019
- **Files:** `tests/**/*.test.ts`
- **Acceptance:** `bun test --coverage` shows 80%+ coverage
- **Tests:** Coverage report

<!-- RBP-TASKS-END -->

## Implementation Notes

### Codebase-Specific Guidance

1. **Bun's native YAML:** Use `Bun.file().text()` then `YAML.parse()` from `yaml` package or use bun's experimental YAML support if available

2. **Commander setup pattern:**
```typescript
import { Command } from 'commander';

const program = new Command()
  .name('ralph')
  .version('3.0.0')
  .description('RBP autonomous execution loop');

program
  .command('run', { isDefault: true })
  .option('--bmad', 'Use BMAD workflow')
  .option('--beads', 'Use Beads workflow')
  .option('--dry-run', 'Show what would happen')
  .action(runCommand);
```

3. **Shell execution:** Use Bun's `Bun.spawn()` for subprocess execution

4. **Event file path:** Same as current: `~/.claude/history/raw-outputs/YYYY-MM/YYYY-MM-DD_all-events.jsonl`

5. **Keep parse-spec-to-beads.sh:** The exec-spec command should shell out to this script rather than reimplementing parsing logic

6. **Test mocking:** Mock `bd` and `claude` CLI calls in tests, don't require real installations
