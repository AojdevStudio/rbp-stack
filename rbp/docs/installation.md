# RBP Stack Installation Guide

**Version:** 3.0.0
**Last Updated:** January 25, 2026
**Status:** Production

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Installation](#detailed-installation)
- [Post-Install Validation](#post-install-validation)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

---

## Prerequisites

Before installing the RBP Stack, ensure you have the following dependencies installed:

### Required Dependencies

| Tool | Minimum Version | Installation | Verification |
|------|----------------|--------------|--------------|
| **Beads CLI** | latest | `brew install beads` or from [beads.dev](https://beads.dev) | `bd --version` |
| **Bun** | 1.0+ | `curl -fsSL https://bun.sh/install \| bash` | `bun --version` |
| **Claude Code CLI** | latest | Install from [claude.ai/code](https://claude.ai/code) | `claude --version` |
| **Git** | 2.0+ | `brew install git` or system package manager | `git --version` |

### Optional Dependencies

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Playwright** | UI testing | `bunx playwright install` (after install) |
| **jq** | JSON parsing | `brew install jq` |

### System Requirements

- **Operating System:** macOS, Linux, or WSL2 on Windows
- **Shell:** bash or zsh
- **Disk Space:** ~50MB for RBP package + dependencies
- **Network:** Internet access for initial dependency installation

---

## Quick Start

For experienced users who want to get started immediately:

**Option A: npm Package (Recommended)**

```bash
# 1. Install RBP globally
bun add -g rbp-stack

# 2. Navigate to your project
cd /path/to/your/project

# 3. Initialize RBP (auto-detects tech stack)
ralph init

# 4. Initialize Beads (if not already initialized)
bd init

# 5. Start using RBP
ralph run
```

**Option B: Use Without Installing**

```bash
# Run directly with bunx (no global install needed)
cd /path/to/your/project
bunx ralph init
bunx ralph run
```

**Option C: Clone Repository (Development)**

```bash
# 1. Clone the repository
git clone https://github.com/AojdevStudio/rbp-stack.git
cd rbp-stack/rbp

# 2. Build and link
bun install && bun run build && bun link

# 3. Navigate to your project
cd /path/to/your/project

# 4. Initialize and run
ralph init
ralph run
```

---

## Detailed Installation

### Method 1: npm Package (Recommended)

The simplest way to use RBP Stack is via the published npm package.

**Global Installation:**

```bash
# Install globally with bun
bun add -g rbp-stack

# Or with npm
npm install -g rbp-stack
```

**Per-Project Installation:**

```bash
# Add as dev dependency
bun add -D rbp-stack

# Run via package.json scripts
# Add to package.json: "scripts": { "ralph": "ralph" }
bun run ralph run
```

**No Installation (bunx):**

```bash
# Run directly without installing
bunx ralph init
bunx ralph run
bunx ralph status
```

### Method 2: Clone Repository (Development/Contributing)

For contributing or local development:

```bash
# Clone the repository
git clone https://github.com/AojdevStudio/rbp-stack.git
cd rbp-stack/rbp

# Install dependencies and build
bun install
bun run build

# Link for global access
bun link

# Now 'ralph' command is available globally
ralph --version
```

### Method 3: Legacy Installer (Deprecated)

> **Note:** The `install.sh` script is deprecated. Use npm package instead.

For projects that need the legacy installation method:

```bash
# Clone the repository
git clone https://github.com/AojdevStudio/rbp-stack.git

# Run legacy installer
./rbp-stack/rbp/install.sh /path/to/your/project

# This copies files to your project (not recommended)
```

### Post-Installation Setup

After installing via any method:

**1. Initialize RBP in your project:**

```bash
cd /path/to/your/project

# Initialize with auto-detection
ralph init

# Or preview what will be created
ralph init --dry-run
```

**What `ralph init` does:**
- Detects your tech stack (test command, package manager)
- Creates `rbp-config.yaml` with sensible defaults
- Sets up `.claude/settings.json` with RBP hooks
- Detects existing Beads setup

**2. Initialize Beads (if not already):**

```bash
bd init

# Configure project
bd config set project.name "Your Project Name"
bd config set defaults.labels "rbp,auto"
```

**3. Install Playwright (Optional, for UI Testing):**

```bash
bunx playwright install
```

---

## Post-Install Validation

### Verify Installation

**Check ralph command:**

```bash
ralph --version
# Should output: 3.0.0
```

**Check status:**

```bash
ralph status
# Shows current RBP configuration and task state
```

**Run built-in validation:**

```bash
# In Claude Code CLI
/rbp:validate
# Runs comprehensive validation checks
```

### Manual Verification

**Test Beads:**
```bash
bd status
# Should show project status without errors
```

**Test configuration:**
```bash
ralph run --dry-run
# Shows what would happen without making changes
```

**Expected dry-run output:**
```
[DRY RUN] Execution Plan
========================

Workflow: BEADS
Max iterations: 50
Test command: bun test

Would query 'bd ready' for next task
Would invoke Claude for each task
Would run tests before closing tasks

[DRY RUN] No changes made
```

---

## Configuration

### Basic Configuration

Edit `rbp-config.yaml` in your project root:

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
  max_iterations: 50          # Maximum autonomous iterations
  phase_size: 5               # Subtasks per execution phase
  iteration_delay: 2          # Seconds between iterations

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

### Project-Specific Paths

If your project has a custom structure, update the `paths` section:

```yaml
paths:
  stories: "docs/stories"           # Your story location
  specs: "planning/specs"           # Your spec location
  scripts: "scripts"                # Top-level scripts directory
  commands: "commands/rbp"          # RBP slash commands
```

### Test Commands

If you're not using bun for testing:

```yaml
verification:
  test_command: "npm test"          # Or "yarn test", "pnpm test"
  typecheck_command: "npm run typecheck"
```

### Workflow-Specific Configuration

**For BMAD projects:**
```yaml
bmad:
  stories_dir: "docs/implementation/stories"
  create_story: "/bmad:bmm:workflows:create-story"
```

**For Quick-Plan projects:**
```yaml
quick_plan:
  command: "/quick-plan"
  spec_template: "templates/spec-template.md"
```

---

## Troubleshooting

### Installation Issues

#### "bd: command not found"

**Problem:** Beads CLI is not installed or not in PATH.

**Solution:**
```bash
# Install Beads
brew install beads

# Or download from beads.dev
curl -fsSL https://beads.dev/install.sh | bash

# Verify installation
bd --version
```

#### "bun: command not found"

**Problem:** Bun runtime is not installed.

**Solution:**
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Restart shell or source profile
source ~/.bashrc  # or ~/.zshrc

# Verify installation
bun --version
```

#### "Permission denied: ./install.sh"

**Problem:** Install script is not executable.

**Solution:**
```bash
chmod +x /path/to/rbp/install.sh
/path/to/rbp/install.sh
```

#### "lib/dist/index.js not found"

**Problem:** TypeScript CLI hasn't been compiled.

**Solution:**
```bash
cd /path/to/rbp
bun install
bun run build

# Verify dist exists
ls lib/dist/index.js
```

### Post-Install Issues

#### "No workflow detected"

**Problem:** Neither BMAD nor Beads detected.

**Solution:**
```bash
# Initialize Beads
bd init

# Or use explicit flag
bun lib/src/cli.ts run --beads
```

#### "rbp-config.yaml: Parse error"

**Problem:** Invalid YAML syntax in configuration.

**Solution:**
```bash
# Validate YAML syntax
bun -e 'console.log(require("yaml").parse(require("fs").readFileSync("rbp-config.yaml", "utf-8")))'

# Or use online validator: yamllint.com
```

#### "SessionStart hook not running"

**Problem:** `.claude/settings.json` not configured correctly.

**Solution:**
```bash
# Check settings file
cat .claude/settings.json

# Should contain:
# "hooks": {
#   "SessionStart": [
#     {"type": "command", "command": "bd prime 2>/dev/null || true"}
#   ]
# }

# If missing, re-run installer
/path/to/rbp/install.sh --force
```

### Runtime Issues

#### "bd ready: No open issues found"

**Problem:** No tasks in Beads database.

**Solution:**
```bash
# Create a test task
bd create "Test task" --description "Verify RBP installation"

# Verify it's ready
bd ready

# Or parse an existing story
scripts/parse-story-to-beads.sh docs/stories/story-001.md
```

#### "Tests command not found"

**Problem:** Test command in config doesn't exist.

**Solution:**
```yaml
# Update rbp-config.yaml
verification:
  test_command: "echo 'No tests configured' && exit 0"
```

#### "Playwright not installed"

**Problem:** UI tests require Playwright but it's not installed.

**Solution:**
```bash
# Install Playwright
bunx playwright install

# Or disable Playwright requirement
# Edit rbp-config.yaml:
verification:
  require_playwright_for_ui: false
```

### Getting Help

If you encounter issues not covered here:

1. **Check validation output:**
   ```bash
   ./validate.sh
   ```

2. **Enable verbose logging:**
   ```bash
   bun lib/src/cli.ts run --verbose
   ```

3. **Check error logs:**
   ```bash
   tail -f scripts/progress.txt
   ```

4. **View full config:**
   ```bash
   bun lib/src/cli.ts status
   ```

5. **Open an issue:**
   Visit [github.com/AojdevStudio/rbp-stack/issues](https://github.com/AojdevStudio/rbp-stack/issues)

---

## Uninstallation

To completely remove RBP from your project:

```bash
# Run uninstaller
/path/to/rbp/uninstall.sh

# Manual cleanup (if needed)
rm -rf lib/
rm -rf commands/rbp/
rm -f scripts/promptv3.md
rm -f scripts/progress.txt
rm -f ralph.sh
rm -f rbp-config.yaml

# Remove from .claude/settings.json
# (Remove SessionStart hooks for bd and bun)

# Beads data is preserved unless you explicitly remove it
# rm -rf .beads/
```

**Warning:** This does not remove `.beads/` by default, preserving your task history. To completely remove Beads:

```bash
bd destroy  # Removes all beads data
```

---

## Next Steps

After successful installation:

1. **Read the Configuration Guide:** [configuration.md](configuration.md)
2. **Explore CLI Commands:** [cli-reference.md](cli-reference.md)
3. **Follow a Workflow Tutorial:** [workflows.md](workflows.md)
4. **Review Architecture:** [architecture.md](architecture.md)

---

## Installation Checklist

Use this checklist to ensure complete installation:

**Prerequisites:**
- [ ] Beads CLI installed (`bd --version`)
- [ ] Bun runtime installed (`bun --version`)
- [ ] Claude Code CLI installed (`claude --version`)
- [ ] Git installed (`git --version`)

**RBP Installation:**
- [ ] RBP installed (`bun add -g rbp-stack` or `bunx ralph --version`)
- [ ] Project initialized (`ralph init`)
- [ ] Configuration created (`rbp-config.yaml` exists)

**Beads Setup:**
- [ ] Beads initialized (`bd init`)
- [ ] Project configured (`bd config set project.name "..."`)

**Verification:**
- [ ] Ralph CLI working (`ralph --version` → 3.0.0)
- [ ] Dry run succeeds (`ralph run --dry-run`)
- [ ] Test command working (`bun test`)
- [ ] Slash commands available (`/rbp:validate`)
- [ ] Playwright installed (if needed, `bunx playwright install`)

---

## See Also

- [Architecture Guide](architecture.md) - System design
- [CLI Reference](cli-reference.md) - Command documentation
- [Configuration Guide](configuration.md) - Configuration options
- [Workflows Guide](workflows.md) - Step-by-step workflows
