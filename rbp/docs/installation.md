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

```bash
# 1. Clone or download RBP package
git clone https://github.com/AojdevStudio/rbp-stack.git rbp
cd rbp

# 2. Navigate to your project
cd /path/to/your/project

# 3. Run installer
/path/to/rbp/install.sh

# 4. Validate installation
./validate.sh

# 5. Initialize Beads (if not already initialized)
bd init

# 6. Start using RBP
bun lib/src/cli.ts run
```

---

## Detailed Installation

### Step 1: Obtain the RBP Package

**Option A: Clone from Git**
```bash
git clone https://github.com/AojdevStudio/rbp-stack.git rbp
cd rbp
```

**Option B: Download ZIP**
```bash
curl -LO https://github.com/AojdevStudio/rbp-stack/archive/main.zip
unzip main.zip
mv rbp-stack-main rbp
cd rbp
```

**Option C: Use from Local Development**
```bash
# If you already have RBP checked out
cd /path/to/rbp-stack
```

### Step 2: Navigate to Your Project

```bash
cd /path/to/your/project
```

Your project should be a git repository. If not, initialize it:

```bash
git init
```

### Step 3: Run the Installer

The installer will copy all necessary files to your project:

```bash
/path/to/rbp/install.sh
```

**What the installer does:**

1. **Copies TypeScript CLI**
   - Copies `lib/` directory containing the TypeScript source
   - Preserves `lib/dist/` compiled JavaScript

2. **Copies Scripts**
   - `scripts/promptv3.md` - Agent execution protocol
   - `scripts/progress.txt` - Execution log template

3. **Copies Slash Commands**
   - `commands/rbp/start.md` - `/rbp:start` command
   - `commands/rbp/status.md` - `/rbp:status` command
   - `commands/rbp/validate.md` - `/rbp:validate` command

4. **Copies Templates**
   - `templates/settings.json` - Claude settings template
   - `templates/rbp-config.yaml` - Configuration template

5. **Creates Wrapper Script**
   - `ralph.sh` - Convenience wrapper for TypeScript CLI

6. **Sets Up Claude Configuration**
   - Creates or updates `.claude/settings.json`
   - Adds SessionStart hooks for `bd prime`
   - Adds permission allowances for `bd` and `bun` commands

7. **Creates RBP Configuration**
   - Creates `rbp-config.yaml` with default values
   - Customizes paths based on project structure

**Example output:**
```
RBP Stack Installer v3.0.0
==========================

Checking prerequisites...
✓ bun found (v1.0.20)
✓ bd found (v0.5.2)
✓ claude found (v1.2.0)
✓ git found (v2.39.2)

Installing RBP to: /Users/you/project

Copying files...
✓ lib/ copied
✓ scripts/ copied
✓ commands/rbp/ copied
✓ templates/ copied
✓ ralph.sh created

Configuring project...
✓ .claude/settings.json created
✓ rbp-config.yaml created

Installation complete!

Next steps:
1. Run ./validate.sh to verify installation
2. Run bd init (if not already initialized)
3. Run bun lib/src/cli.ts run to start
```

### Step 4: Install Dependencies

If your project doesn't have a `package.json`, the installer will create one. Install dependencies:

```bash
bun install
```

### Step 5: Initialize Beads

If your project doesn't already have Beads initialized:

```bash
bd init
```

This creates:
- `.beads/issues.jsonl` - Task database (git-tracked)
- `.beads/config.yaml` - Beads configuration
- `.beads/beads.db` - SQLite cache (gitignored)

**Configure Beads for your project:**
```bash
# Set project name
bd config set project.name "Your Project Name"

# Set default labels
bd config set defaults.labels "rbp,auto"
```

### Step 6: Install Playwright (Optional, for UI Testing)

If your project includes UI components:

```bash
bunx playwright install
```

This installs browser binaries for Chromium, Firefox, and WebKit.

---

## Post-Install Validation

### Run the Validator

The validator checks that all components are correctly installed:

```bash
./validate.sh
```

**Expected output:**
```
RBP Stack Validation v3.0.0
============================

Checking prerequisites...
✓ bun (v1.0.20)
✓ bd (v0.5.2)
✓ claude (v1.2.0)
✓ git (v2.39.2)

Checking installation...
✓ lib/dist/index.js exists
✓ scripts/promptv3.md exists
✓ commands/rbp/start.md exists
✓ commands/rbp/status.md exists
✓ commands/rbp/validate.md exists
✓ ralph.sh exists and is executable
✓ .claude/settings.json exists
✓ rbp-config.yaml exists

Checking Beads...
✓ .beads/issues.jsonl exists
✓ .beads/config.yaml exists
✓ bd ready command works

Checking configuration...
✓ rbp-config.yaml is valid YAML
✓ Paths are correctly configured

All checks passed! ✓

Run 'bun lib/src/cli.ts run' to start.
```

### Manual Verification

**Test Beads:**
```bash
bd status
# Should show project status without errors
```

**Test Ralph CLI:**
```bash
bun lib/src/cli.ts --version
# Should output: 3.0.0
```

**Test Slash Commands:**
```bash
# In Claude Code CLI
/rbp:validate
# Should run validation checks
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

- [ ] Beads CLI installed (`bd --version`)
- [ ] Bun runtime installed (`bun --version`)
- [ ] Claude Code CLI installed (`claude --version`)
- [ ] Git installed (`git --version`)
- [ ] RBP package downloaded
- [ ] Installer executed (`install.sh`)
- [ ] Validation passed (`./validate.sh`)
- [ ] Beads initialized (`bd init`)
- [ ] Dependencies installed (`bun install`)
- [ ] Configuration customized (`rbp-config.yaml`)
- [ ] Playwright installed (if needed, `bunx playwright install`)
- [ ] Test command working (`bun test`)
- [ ] Ralph CLI working (`bun lib/src/cli.ts --version`)
- [ ] Slash commands available (`/rbp:validate`)

---

## See Also

- [Architecture Guide](architecture.md) - System design
- [CLI Reference](cli-reference.md) - Command documentation
- [Configuration Guide](configuration.md) - Configuration options
- [Workflows Guide](workflows.md) - Step-by-step workflows
