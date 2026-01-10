# RBP Stack

**Last Updated:** January 9, 2026

Autonomous Epic implementation system. Test-gated verification prevents false completion claims.

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

## Tech Stack

- **Execution:** Claude Code CLI
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

# Run autonomous execution
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


