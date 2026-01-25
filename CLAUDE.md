# RBP Stack

**Last Updated:** January 25, 2026

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
rbp/                    # Installable npm package (main deliverable)
├── lib/src/            # TypeScript CLI source (commands, workflows, config)
├── scripts/            # Core bash scripts
├── commands/rbp/       # Slash commands (/rbp:status, /rbp:validate)
├── templates/          # Config templates, hooks, skills
├── install.sh          # Legacy installer (deprecated - use npm)
└── validate.sh         # Installation validator

rbp/docs/               # Comprehensive documentation
specs/                  # Planning documents and checklists
.github/workflows/      # CI/CD automation (release.yml)
```

## Tech Stack

- **Package:** npm package `rbp-stack` published to registry
- **Execution:** Claude Code CLI
- **CLI Engine:** TypeScript + Commander.js (bun runtime)
- **State:** Beads (git-backed) - query `bd ready`, never mirror to JSON
- **Testing:** bun test + Playwright
- **Scripts:** Bash
- **Runtime:** bun

## Installation

**Preferred (npm):**
```bash
# Install globally
bun add -g rbp-stack

# Or use directly without install
bunx ralph init
bunx ralph run
bunx ralph status
```

**Legacy (install.sh):**
```bash
# Deprecated - use npm install instead
./rbp/install.sh /path/to/project
./rbp/validate.sh
```

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

## Publishing to npm

**Current Version:** 1.0.0
**Package Name:** rbp-stack
**Registry:** https://www.npmjs.com/package/rbp-stack

### Version Bumping

```bash
cd rbp

# Bump version (updates package.json)
npm version patch   # 1.0.0 -> 1.0.1
npm version minor   # 1.0.0 -> 1.1.0
npm version major   # 1.0.0 -> 2.0.0
```

### Automated Releases

Push a version tag to trigger automated npm publish via GitHub Actions:

```bash
git tag v1.0.1
git push origin v1.0.1
```

This runs `.github/workflows/release.yml` which:
1. Builds the CLI with bun
2. Runs tests
3. Publishes to npm
4. Creates a GitHub release

**Setup:** Add `NPM_TOKEN` to GitHub secrets (Settings → Secrets → Actions)

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
