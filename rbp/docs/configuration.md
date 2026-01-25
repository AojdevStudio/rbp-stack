# RBP Stack Configuration Guide

**Version:** 3.0.0
**Last Updated:** January 25, 2026
**Status:** Production

---

## Table of Contents

- [Overview](#overview)
- [Configuration File](#configuration-file)
- [Configuration Sections](#configuration-sections)
- [Environment Variables](#environment-variables)
- [Claude Settings](#claude-settings)
- [Beads Configuration](#beads-configuration)
- [Hook Configuration](#hook-configuration)
- [CLI Flags](#cli-flags)
- [Configuration Examples](#configuration-examples)
- [Validation](#validation)

---

## Overview

The RBP Stack uses multiple configuration sources:

1. **rbp-config.yaml** - Primary RBP configuration
2. **.claude/settings.json** - Claude Code integration
3. **.beads/config.yaml** - Beads task management
4. **Environment variables** - Runtime overrides
5. **CLI flags** - Command-line options

Configuration is validated using Zod schemas at runtime.

---

## Configuration File

### Location

`rbp-config.yaml` in your project root.

### Format

YAML format with type validation via Zod schema.

### Loading Priority

1. CLI flag: `--config <path>` (highest priority)
2. Environment: `RBP_CONFIG_PATH`
3. Default: `./rbp-config.yaml`
4. Fallback: Built-in defaults

### Example

```yaml
project:
  name: "My Project"
  description: "Optional project description"

paths:
  stories: "docs/bmm/implementation-artifacts/stories"
  specs: "specs"
  beads: ".beads"
  scripts: "scripts"
  commands: "commands/rbp"

execution:
  max_iterations: 50
  phase_size: 5
  iteration_delay: 2

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
  epics_dir: "docs/bmm/epics"
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
  reasoning_effort: "high"
  skip_by_default: false

observability:
  enabled: true
  auto_launch: true
  pai_install_check: true

hooks:
  session_start: []
  pre_compact: []
```

---

## Configuration Sections

### Project Section

**Purpose:** Basic project metadata

```yaml
project:
  name: "Your Project Name"       # Required
  description: "Project description"  # Optional
```

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | "unknown" | Project name for logging and identification |
| `description` | string | No | - | Optional project description |

**Example:**
```yaml
project:
  name: "E-Commerce Platform"
  description: "Next.js-based online store with Stripe integration"
```

---

### Paths Section

**Purpose:** Customize file and directory locations

```yaml
paths:
  stories: "docs/bmm/implementation-artifacts/stories"
  specs: "specs"
  beads: ".beads"
  scripts: "scripts"
  commands: "commands/rbp"
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `stories` | string | `"docs/bmm/implementation-artifacts/stories"` | BMAD story files location |
| `specs` | string | `"specs"` | Quick-plan spec files location |
| `beads` | string | `".beads"` | Beads database directory |
| `scripts` | string | `"scripts"` | Scripts directory (contains promptv3.md) |
| `commands` | string | `"commands/rbp"` | Slash commands directory |

**Notes:**
- All paths are relative to project root
- Paths are validated at runtime
- Missing directories will cause warnings (not errors)

**Custom Structure Example:**
```yaml
paths:
  stories: "planning/stories"
  specs: "planning/specs"
  scripts: "build/rbp"
  commands: ".claude/rbp-commands"
```

---

### Execution Section

**Purpose:** Control autonomous execution behavior

```yaml
execution:
  max_iterations: 50
  phase_size: 5
  iteration_delay: 2
```

**Fields:**

| Field | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| `max_iterations` | number | 1-1000 | 50 | Maximum autonomous iterations before stopping |
| `phase_size` | number | 1-20 | 5 | Subtasks per execution phase (for large tasks) |
| `iteration_delay` | number | 0-60 | 2 | Seconds to wait between iterations |

**Validation:**
- `max_iterations` must be positive integer >= 1 (prevents NaN)
- `phase_size` must be positive integer >= 1
- `iteration_delay` can be 0 for no delay

**Examples:**

**Short tasks (quick iteration):**
```yaml
execution:
  max_iterations: 10
  phase_size: 3
  iteration_delay: 0
```

**Long-running tasks:**
```yaml
execution:
  max_iterations: 100
  phase_size: 10
  iteration_delay: 5
```

---

### Verification Section

**Purpose:** Configure test gating and verification commands

```yaml
verification:
  require_tests: true
  require_playwright_for_ui: true
  test_command: "bun test"
  typecheck_command: "bun run typecheck"
  playwright_command: "bunx playwright test"
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `require_tests` | boolean | `true` | Enforce test verification before closing tasks |
| `require_playwright_for_ui` | boolean | `true` | Require Playwright tests for UI tasks |
| `test_command` | string | `"bun test"` | Shell command to run unit tests |
| `typecheck_command` | string | `"bun run typecheck"` | Shell command for type checking |
| `playwright_command` | string | `"bunx playwright test"` | Shell command for Playwright tests |

**Test Gating:**
- When `require_tests: true`, `ralph close` runs `test_command`
- Task only closes if exit code is 0
- Failure notes are appended to bead for next iteration

**UI Detection:**
- If task contains UI keywords (see `ui_detection` section)
- And `require_playwright_for_ui: true`
- Then `playwright_command` must pass

**Examples:**

**npm project:**
```yaml
verification:
  test_command: "npm test"
  typecheck_command: "npm run type-check"
  playwright_command: "npm run test:e2e"
```

**Skip verification (not recommended):**
```yaml
verification:
  require_tests: false
  require_playwright_for_ui: false
```

**Custom test script:**
```yaml
verification:
  test_command: "./scripts/run-all-tests.sh"
```

---

### UI Detection Section

**Purpose:** Automatically detect UI tasks requiring Playwright verification

```yaml
ui_detection:
  enabled: true
  keywords: ["UI", "component", "button", "form"]
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable automatic UI task detection |
| `keywords` | string[] | `["UI", "component", "button", "form"]` | Keywords to detect UI tasks |

**How it works:**
1. Task title or description is checked for keywords
2. If match found, `requires_playwright: true` flag is set
3. During closure, Playwright tests are required (if enabled)

**Custom Keywords:**
```yaml
ui_detection:
  enabled: true
  keywords:
    - "frontend"
    - "React"
    - "Vue"
    - "styling"
    - "layout"
    - "responsive"
```

**Disable UI detection:**
```yaml
ui_detection:
  enabled: false
```

---

### BMAD Section

**Purpose:** Configure BMAD workflow integration

```yaml
bmad:
  epics_dir: "docs/bmm/epics"
  stories_dir: "docs/bmm/implementation-artifacts/stories"
  create_story: "/bmad:bmm:workflows:create-story"
  dev_story: "/bmad:bmm:workflows:dev-story"
  code_review: "/bmad:bmm:workflows:code-review"
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `epics_dir` | string | - | Optional epics directory |
| `epic_pattern` | string | - | Optional epic file pattern |
| `stories_dir` | string | - | Stories directory (auto-detected if not set) |
| `arch_dir` | string | - | Optional architecture docs directory |
| `create_story` | string | `"/bmad:bmm:workflows:create-story"` | Slash command for story creation |
| `dev_story` | string | `"/bmad:bmm:workflows:dev-story"` | Slash command for story development |
| `code_review` | string | `"/bmad:bmm:workflows:code-review"` | Slash command for code review |

**Auto-detection:**
- If `stories_dir` not set, system searches for `sprint-status.yaml`
- Searches in: `docs/bmm/implementation-artifacts/`, `docs/`, root

**Custom BMAD structure:**
```yaml
bmad:
  epics_dir: "planning/epics"
  stories_dir: "planning/implementation/stories"
  arch_dir: "docs/architecture"
```

---

### Quick-Plan Section

**Purpose:** Configure quick-plan spec workflow

```yaml
quick_plan:
  command: "/quick-plan"
  spec_template: "templates/spec-template.md"
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `command` | string | `"/quick-plan"` | Slash command for quick-plan |
| `spec_template` | string | `"templates/spec-template.md"` | Spec template file |

**Usage:**
- Used by `ralph exec-spec` command
- Template is used for generating new specs
- Command is invoked for interactive planning

---

### Codex Section

**Purpose:** Configure Codex adversarial review (optional)

```yaml
codex:
  enabled: true
  model: "gpt-5-codex"
  reasoning_effort: "high"
  skip_by_default: false
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable Codex review workflow |
| `model` | string | `"gpt-5-codex"` | OpenAI model for review |
| `reasoning_effort` | enum | `"high"` | Reasoning effort: `"low"` \| `"medium"` \| `"high"` |
| `skip_by_default` | boolean | `false` | Skip review unless explicitly requested |

**Codex Review:**
- Adversarial agent validates all acceptance criteria
- Runs after task completion but before closure
- Can be skipped with `--skip-review` flag

**Disable Codex:**
```yaml
codex:
  enabled: false
```

**Customize model:**
```yaml
codex:
  model: "gpt-4-turbo"
  reasoning_effort: "medium"
```

---

### Observability Section

**Purpose:** Configure PAI Observability Dashboard integration

```yaml
observability:
  enabled: true
  auto_launch: true
  pai_install_check: true
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable observability features |
| `auto_launch` | boolean | `true` | Auto-launch dashboard on `/rbp:start` |
| `pai_install_check` | boolean | `true` | Check for PAI installation |

**Dashboard:**
- Shows real-time progress
- Displays test results
- Tracks errors and warnings
- Available at http://localhost:5172

**Disable observability:**
```yaml
observability:
  enabled: false
```

---

### Hooks Section

**Purpose:** Define custom shell commands for lifecycle hooks

```yaml
hooks:
  session_start: []
  pre_compact: []
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `session_start` | string[] | `[]` | Commands to run when session starts |
| `pre_compact` | string[] | `[]` | Commands to run before context compaction |

**Example:**
```yaml
hooks:
  session_start:
    - "bd sync"
    - "git pull --rebase"
    - "bun install"
  pre_compact:
    - "bd sync"
    - "git add ."
    - "git commit -m 'Auto-commit before compaction' || true"
```

**Notes:**
- Commands run sequentially
- Non-zero exit codes are logged but don't stop execution
- Use `|| true` to ignore failures

---

## Environment Variables

### RBP-Specific

| Variable | Purpose | Example |
|----------|---------|---------|
| `RBP_CONFIG_PATH` | Override config file location | `/path/to/config.yaml` |
| `RBP_JSON_ERRORS` | Enable JSON error output | `true` or `false` |
| `RBP_LOG_LEVEL` | Set log level | `debug`, `info`, `warn`, `error` |

### Example Usage

```bash
# Use custom config
export RBP_CONFIG_PATH=/path/to/custom-config.yaml
ralph run

# Enable JSON errors
export RBP_JSON_ERRORS=true
ralph run

# Debug logging
export RBP_LOG_LEVEL=debug
ralph run --verbose
```

---

## Claude Settings

### Location

`.claude/settings.json` in your project root.

### Format

JSON format with Claude-specific structure.

### Example

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bd prime 2>/dev/null || true"
          },
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/lib/dist/index.js hooks --session-start"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/lib/dist/index.js hooks --pre-compact"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(bd:*)",
      "Bash(bun:*)",
      "Bash(scripts/*)"
    ]
  }
}
```

### Hooks

**SessionStart:**
- Runs when Claude Code session starts
- Used to prime Beads context
- Executes RBP session_start hooks

**PreCompact:**
- Runs before context window compaction
- Used to sync state before context reset
- Executes RBP pre_compact hooks

### Permissions

Allow list for Bash commands:
- `bd:*` - All Beads commands
- `bun:*` - All Bun commands
- `scripts/*` - All scripts in scripts directory

---

## Beads Configuration

### Location

`.beads/config.yaml` in your project root.

### Example

```yaml
project:
  name: "My Project"
  description: "Project description"

defaults:
  labels: ["rbp", "auto"]
  priority: "medium"

display:
  max_title_length: 80
  show_timestamps: true
```

**Integration with RBP:**
- RBP reads `project.name` for logging
- Default labels are applied to auto-created beads
- Display settings affect `bd list` output

---

## Hook Configuration

Hooks are defined in two places:

1. **rbp-config.yaml** - RBP-specific hooks
2. **.claude/settings.json** - Claude lifecycle hooks

### RBP Hooks (rbp-config.yaml)

```yaml
hooks:
  session_start:
    - "bd sync"
    - "git status"
  pre_compact:
    - "bd sync"
    - "git add ."
```

**Invocation:**
```bash
bun lib/dist/index.js hooks --session-start
bun lib/dist/index.js hooks --pre-compact
```

### Claude Hooks (.claude/settings.json)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bd prime"
      }
    ]
  }
}
```

**Execution:**
- Claude automatically runs SessionStart hooks
- PreCompact hooks run before context reset

---

## CLI Flags

### Global Flags

Available on all commands:

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--config <path>` | string | `./rbp-config.yaml` | Custom config file path |
| `--verbose` | boolean | `false` | Enable debug logging |
| `--quiet` | boolean | `false` | Minimal output (warnings only) |
| `--json-errors` | boolean | `true` | Output errors as JSON |
| `--no-json-errors` | boolean | - | Output human-readable errors |

### Command-Specific Flags

**ralph run:**
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--bmad` | boolean | - | Force BMAD workflow |
| `--beads` | boolean | - | Force Beads workflow |
| `--max-iterations <n>` | number | `50` | Override max iterations |
| `--dry-run` | boolean | `false` | Preview without executing |

**ralph close:**
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--force` or `-f` | boolean | `false` | Skip test verification |
| `--dry-run` | boolean | `false` | Preview without closing |

**ralph exec-spec:**
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--skip-review` | boolean | `false` | Skip Codex review |
| `--max-iterations <n>` | number | `50` | Override max iterations |
| `--dry-run` | boolean | `false` | Preview without executing |

### Flag Validation

**Mutually Exclusive:**
- `--bmad` and `--beads` cannot be used together
- `--json-errors` and `--no-json-errors` cannot be used together
- `--verbose` and `--quiet` cannot be used together

**Integer Validation:**
- `--max-iterations` must be positive integer >= 1
- Non-integer values cause validation error

---

## Configuration Examples

### Minimal Configuration

```yaml
project:
  name: "Simple Project"

execution:
  max_iterations: 10

verification:
  test_command: "echo 'No tests' && exit 0"
```

### Full-Featured Configuration

```yaml
project:
  name: "Enterprise App"
  description: "Full-stack enterprise application"

paths:
  stories: "docs/implementation/stories"
  specs: "planning/specs"
  scripts: "build/scripts"
  commands: ".claude/rbp"

execution:
  max_iterations: 100
  phase_size: 10
  iteration_delay: 3

verification:
  require_tests: true
  require_playwright_for_ui: true
  test_command: "npm run test:all"
  typecheck_command: "npm run type-check"
  playwright_command: "npm run test:e2e"

ui_detection:
  enabled: true
  keywords:
    - "UI"
    - "component"
    - "React"
    - "frontend"
    - "styling"

bmad:
  epics_dir: "docs/epics"
  stories_dir: "docs/implementation/stories"
  arch_dir: "docs/architecture"

codex:
  enabled: true
  model: "gpt-5-codex"
  reasoning_effort: "high"

observability:
  enabled: true
  auto_launch: true

hooks:
  session_start:
    - "bd sync"
    - "git pull --rebase"
    - "npm install"
  pre_compact:
    - "bd sync"
    - "git add ."
    - "git commit -m 'WIP' || true"
```

### Development Configuration

```yaml
project:
  name: "Dev Project"

execution:
  max_iterations: 5
  iteration_delay: 0

verification:
  require_tests: false
  require_playwright_for_ui: false
  test_command: "echo 'Skipping tests in dev mode'"

observability:
  enabled: false
```

---

## Validation

### Schema Validation

Configuration is validated using Zod at runtime:

```typescript
// lib/src/config/schema.ts
export const RbpConfigSchema = z.object({
  project: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  // ... additional fields
});
```

### Validation Errors

**Invalid type:**
```
Error: Configuration validation failed
  Code: INVALID_CONFIG
  Details: execution.max_iterations must be a number
  Suggestion: Check rbp-config.yaml for type errors
```

**Out of range:**
```
Error: Configuration validation failed
  Code: INVALID_CONFIG
  Details: execution.max_iterations must be >= 1
  Suggestion: Use a positive integer for max_iterations
```

### Validate Configuration

```bash
# Dry run shows parsed config
ralph run --dry-run

# Status command shows active config
ralph status

# Manual validation
bun -e 'console.log(require("./lib/dist/index.js").loadConfig())'
```

---

## See Also

- [Installation Guide](installation.md) - Setup instructions
- [CLI Reference](cli-reference.md) - Command documentation
- [Architecture Guide](architecture.md) - System design
- [Workflows Guide](workflows.md) - Step-by-step workflows
