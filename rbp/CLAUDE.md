# RBP Stack

**Last Updated:** January 20, 2026

*For Claude Code only*: 

<ToolPolicy xmlns:tool="urn:claude:tools"
            precedence="OVERRIDE_DEFAULT"
            enforcement="MANDATORY">

  <Rule id="AUQ-1" scope="ALL_QUESTIONS">
    <Condition>You need information from the user</Condition>
    <Condition>You are uncertain about requirements</Condition>
    <Condition>Multiple valid interpretations exist</Condition>
    <Condition>You would otherwise guess or assume</Condition>
    <Action tool="AskUserQuestion" enforcement="REQUIRED">
      Use the AskUserQuestion tool. Do NOT embed questions in prose.
    </Action>
    <Prohibition>
      Never ask questions in plain text without invoking the tool.
    </Prohibition>
  </Rule>

  <Consequence violation="AUQ-1">
    Questions asked outside the tool are ignored by the user's interface.
    The user cannot see or respond to plain-text questions.
  </Consequence>

</ToolPolicy>


## Task Tracking

Use `bd` (Beads) for all task management:

```bash
bd status          # Overview
bd list            # All issues
bd list --open     # Open issues only
bd ready           # Next unblocked task
bd show <id>       # Issue details
bd create "desc"   # Create new issue
bd close <id>      # Close issue (only after tests pass)
bd graph           # Dependency graph
bd sync            # Sync with git
```

## Project Structure

```
rbp/                    # Installable package (main deliverable)
├── scripts/            # Core scripts (ralph.sh, close-with-proof.sh, etc.)
├── lib/src/            # TypeScript CLI source (commands, workflows, config)
├── commands/rbp/       # Slash commands (/rbp:start, /rbp:status, /rbp:validate)
├── templates/          # Config templates
├── install.sh          # Installer
└── validate.sh         # Validator

rbp/docs/               # Specification and diagrams
marketing/              # Twitter thread, LinkedIn narrative
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `rbp/scripts/ralph.sh` | Main execution loop - queries `bd ready`, implements, closes |
| `rbp/scripts/close-with-proof.sh` | Test-gated closure - runs tests before `bd close` |
| `rbp/scripts/parse-story-to-beads.sh` | Converts BMAD story to Beads tasks |
| `rbp/scripts/parse-spec-to-beads.sh` | Converts quick-plan spec to Beads tasks |
| `rbp/scripts/ralph-execute.sh` | Quick-plan workflow with optional Codex review |

## TypeScript CLI (Ralph)

The core execution engine is written in TypeScript using Commander.js. The CLI is named `ralph` and provides autonomous task execution with test verification.

### Global Options

Available on all commands:

```bash
ralph --config <path>     # Custom config file path
ralph --verbose           # Increase output verbosity (debug level)
ralph --quiet             # Decrease output verbosity (warn level)
ralph --json-errors       # Output errors as JSON (default: true)
ralph --no-json-errors    # Output errors as human-readable text
```

### Commands

**init**
```bash
ralph init                       # Initialize RBP config with auto-detection
ralph init --dry-run             # Preview detected configuration
ralph init --force               # Overwrite existing config
```

**run** (default)
```bash
ralph run                        # Run the execution loop
ralph run --bmad                 # Use BMAD workflow explicitly
ralph run --beads                # Use Beads workflow explicitly
ralph run --agent <provider>     # AI provider: claude, gemini, codex (default: claude)
ralph run --max-iterations <n>   # Max iterations (positive integer >= 1)
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
ralph exec-spec <file>           # Execute a spec file
ralph exec-spec <file> --skip-review     # Skip Codex review
ralph exec-spec <file> --max-iterations <n>  # Max iterations
ralph exec-spec <file> --dry-run  # Dry run mode
```

## Tech Stack

- **Execution:** Claude Code CLI
- **CLI Engine:** TypeScript + Commander.js (bun runtime)
- **State:** Beads (git-backed) - query `bd ready`, never mirror to JSON
- **Testing:** bun test + Playwright
- **Scripts:** Bash
- **Runtime:** bun

## Rules

### Beads is Source of Truth
- Query `bd ready` for next task
- Never create JSON files to track task state
- Never mark tasks complete without running tests

### Test-Gated Closure
- Run `bun test` before closing any task
- If tests fail, task stays open
- UI tasks require Playwright: `bunx playwright test`

### CLI Validation
- `--max-iterations` must be a positive integer >= 1 (prevents NaN)
- `--json-errors` and `--no-json-errors` are mutually exclusive
- `--bmad` and `--beads` flags cannot be used together
- The CLI auto-detects workflow if not specified

### Naming
- Scripts: `kebab-case.sh`
- Configs: `kebab-case.yaml`
- Docs: `kebab-case.md`

### Comments
- Minimal - code should be self-documenting
- Comment only: complex regex, non-obvious decisions, workarounds

## Commands

```bash
# Install RBP into a project
./rbp/install.sh /path/to/project

# Validate installation
./rbp/validate.sh

# Run autonomous execution (TypeScript CLI)
bun ./rbp/lib/src/cli.ts run

# Or using installed script
./rbp/scripts/ralph.sh

# Parse story to beads
./rbp/scripts/parse-story-to-beads.sh docs/stories/story-001.md
```

# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
