<div align="center">

<img src="docs/rbp-hero-banner.jpg" alt="RBP Stack - Stop trusting. Start verifying." width="800"/>

# RBP Stack

### **Stop trusting AI agents. Start verifying them.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
<!-- [![GitHub stars](https://img.shields.io/github/stars/AojdevStudio/rbp-stack?style=social)](https://github.com/AojdevStudio/rbp-stack/stargazers) -->

*The first autonomous Epic implementation system that prevents AI agents from lying about task completion.*

<br />

[**View Demo**](#demo) · [**Quick Start**](#quick-start) · [**How It Works**](#how-it-works) · [**Documentation**](docs/rbp-stack-specification.md)

</div>

<br />

---

<br />

## The Problem Everyone Ignores

You give an AI agent an Epic. It returns "done" with all checkboxes marked complete.

Then you look at the code.

- Tests were never run
- The UI doesn't render
- Half the subtasks were skipped
- There's no audit trail

**Sound familiar?**

You trusted the agent. The agent lied.

<br />

> *"We spent 3 months building an AI-powered development workflow. 76 stories later, we discovered a painful truth: agents mark tasks 'complete' without doing the work. Checkboxes are just booleans. There's no proof."*

<br />

---

<br />

## The Insight That Changed Everything

After months of frustration, we discovered something simple:

<br />

<div align="center">

### **Agents can lie to checkboxes.**
### **They cannot lie to tests.**

</div>

<br />

A checkbox is self-reported. A test is objective verification.

If `bun test` fails, the lie is exposed. Period.

So we built a system around one unbreakable rule:

<br />

<div align="center">

## **No task closes without proof.**

</div>

<br />

---

<br />

## Introducing the RBP Stack

**R**alph + **B**eads + **P**AI

A verification-first autonomous development system.

<br />

<div align="center">

| Component | Role |
|:----------|:-----|
| **Ralph** | Autonomous execution loop that never stops until done |
| **Beads** | Git-backed task graph — the single source of truth |
| **Tests** | The gatekeeper that agents cannot bypass |

</div>

<br />

```
Workflow A (BMAD):
Epic  →  BMAD Story  →  Beads  →  Ralph Loop  →  Verified Code

Workflow B (Quick-Plan):
Feature Idea  →  /quick-plan  →  Spec  →  Codex Review  →  Beads  →  Ralph Loop  →  Verified Code

Both workflows use the same gatekeeper:
                              close-with-proof.sh
                                       ↓
                              Tests pass? → Close task
                              Tests fail? → Keep trying
```

<br />

<div align="center">

<img src="docs/rbp-2-workflow-flow.jpg" alt="RBP Workflow" width="700"/>

*From requirements to verified code. No human intervention required.*

</div>

<br />

---

<br />

## See It In Action

<details>
<summary><b>📺 Demo: Watch Ralph implement a feature autonomously</b></summary>

<br />

<!-- Replace with actual GIF/video when available -->
```bash
# 1. Convert your story to beads
./scripts/rbp/parse-story-to-beads.sh docs/stories/story-001.md

# 2. Launch Ralph
./scripts/rbp/ralph.sh

# 3. Watch the magic happen
# Ralph queries Beads → Implements task → Runs tests → Only closes if tests pass
# Repeats until all tasks complete
```

*GIF coming soon — star the repo to get notified!*

</details>

<br />

---

<br />

## Defense in Depth

We don't trust agents. We verify them at every layer.

<br />

<div align="center">

<img src="docs/rbp-3-verification-system.jpg" alt="Verification System" width="600"/>

</div>

<br />

| Layer | Mechanism | What It Prevents |
|:------|:----------|:-----------------|
| **1** | Objective Acceptance Criteria | Vague "it works" claims |
| **2** | Protocol Mandate | Skipping verification steps |
| **3** | Failure State Injection | "I don't remember what went wrong" |
| **4** | Test Gating (`bun test`) | Claims without passing tests |
| **5** | Playwright Verification | UI lies ("looks correct") |
| **6** | Human Code Review | Subtle implementation issues |
| **7** | Beads Audit Trail | Retroactive tampering |

<br />

An agent **cannot** game this system. Either the tests pass or they don't.

<br />

---

<br />

## Quick Start

### Prerequisites

```bash
# Beads - Git-backed task tracker (one-time global install, pick one)
brew install steveyegge/beads/bd                # Homebrew (recommended)
# or: curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
# or: npm install -g @beads/bd
# or: go install github.com/steveyegge/beads/cmd/bd@latest

# Bun - JavaScript runtime (one-time global install)
curl -fsSL https://bun.sh/install | bash

# Claude Code CLI (one-time global install)
# https://claude.ai/download

# PAI Observability (optional, for real-time monitoring dashboard)
# https://github.com/danielmiessler/Personal_AI_Infrastructure.git
```

### Install

```bash
# Clone the repository
git clone https://github.com/AojdevStudio/rbp-stack.git

# Install into your project
./rbp/install.sh /path/to/your/project

# Validate installation
/path/to/your/project/scripts/rbp/validate.sh
```

### Run (Two Workflows)

**Workflow A: BMAD Stories** (structured story-driven)

```bash
# Create a story with BMAD
/bmad:bmm:workflows:create-story

# Convert to beads
./scripts/rbp/parse-story-to-beads.sh docs/stories/story-001.md

# Launch autonomous execution
./scripts/rbp/ralph.sh
```

**Workflow B: Quick-Plan Specs** (interview-driven)

```bash
# Create a spec through codebase analysis + interview
/quick-plan "add user authentication with JWT"

# Execute with optional Codex pre-flight review
./scripts/rbp/ralph-execute.sh specs/add-user-authentication.md

# Or skip the Codex review
./scripts/rbp/ralph-execute.sh specs/add-user-authentication.md --skip-review
```

**Monitor Progress**

```bash
bd status        # Task status
bd list --open   # Open tasks
bd tree          # Task hierarchy
```

<br />

---

<br />

## Ralph CLI Reference

Ralph is the autonomous execution engine for RBP. It's written in TypeScript and runs on Bun.

### Global Options

Available on all commands:

```bash
ralph --config <path>        # Custom config file path
ralph --verbose              # Increase output verbosity (debug level)
ralph --quiet                # Decrease output verbosity (warn level)
ralph --json-errors          # Output errors as JSON (default: true)
ralph --no-json-errors       # Output errors as human-readable text
```

**Error Format:** By default, errors are output as JSON for programmatic processing. Use `--no-json-errors` to get human-readable text output. The `--json-errors` and `--no-json-errors` flags are mutually exclusive.

### Commands

**run** (default command)

```bash
ralph run                              # Run the execution loop
ralph run --bmad                       # Use BMAD workflow explicitly
ralph run --beads                      # Use Beads workflow explicitly
ralph run --max-iterations <n>         # Max iterations (positive integer >= 1)
ralph run --dry-run                    # Dry run mode (no changes)
```

**Validation Rules:**
- `--max-iterations` must be a positive integer >= 1 (prevents NaN)
- `--bmad` and `--beads` flags cannot be used together
- The CLI auto-detects workflow if not specified

**status**

```bash
ralph status                           # Show current execution state
```

**close**

```bash
ralph close <id>                       # Close a task with test verification
ralph close <id> --force               # Force close without tests (-f)
ralph close <id> --dry-run             # Dry run mode
```

**exec-spec**

```bash
ralph exec-spec <file>                 # Execute a spec file
ralph exec-spec <file> --skip-review   # Skip Codex review
ralph exec-spec <file> --max-iterations <n>  # Max iterations
ralph exec-spec <file> --dry-run       # Dry run mode
```

<br />

---

<br />

## How It Works

<br />

<div align="center">

<img src="docs/rbp-1-layer-architecture.jpg" alt="Architecture" width="700"/>

</div>

<br />

### The Core Loop

```bash
while tasks_remain:
    task = bd ready           # Query Beads for next unblocked task
    implement(task)           # Agent implements the task
    close-with-proof.sh       # THE GATEKEEPER
        ├── bun test          # Unit tests must pass
        ├── playwright test   # UI tests must pass (if UI task)
        └── bd close          # Only now can the task close
```

### The Gatekeeper Script

```bash
#!/usr/bin/env bash
# close-with-proof.sh - The agent cannot bypass this

# Run tests
bun run test || exit 1

# Run Playwright for UI tasks (auto-detected)
if [[ "$TASK_TYPE" == "ui" ]]; then
    bunx playwright test || exit 1
fi

# Only close if all tests pass
bd close "$BEAD_ID"
echo "✅ Task verified and closed"
```

**This is script-level enforcement.** The agent has no way around it.

<br />

---

<br />

## Failure State Injection

When a task fails its test verification, Ralph automatically injects the failure context into the next attempt:

```
Task Iteration 1:
  ├── Run tests
  ├── Tests fail → Append failure notes to bead
  └── Ralph continues to next task

Task Iteration 2 (when task becomes ready again):
  ├── Read previous failure notes from bead
  ├── Inject "Previous Attempt Failed" section into prompt
  ├── Agent sees exactly what went wrong
  ├── Agent fixes the issues
  ├── Run tests again
  └── If pass → Close with proof
```

This prevents the agent from making the same mistake twice.

<br />

---

<br />

## Atomic Subtasks

When a task contains subtasks, the parser creates them as **separate child beads with explicit dependencies**:

```
Task: "Create admin dashboard"
├── Subtask 1.1: Build layout structure (no dependencies)
│   └── Bead ID: bd-123.1.1
├── Subtask 1.2: Add sidebar (depends on 1.1)
│   └── Bead ID: bd-123.1.2
├── Subtask 1.3: Implement navigation (depends on 1.2)
│   └── Bead ID: bd-123.1.3
└── Task depends on final subtask (1.3)
```

Benefits:
- **Clear sequencing**: Each subtask has explicit dependencies
- **Granular tracking**: Each subtask is independently verifiable
- **Failure recovery**: If subtask 2 fails, only that subtask retries (not 1.1)
- **Optimal context**: Ralph executes one subtask per iteration

<br />

---

<br />

## Quick-Plan Workflow

Don't have BMAD? Use the Quick-Plan workflow instead.

### How It Works

```
/quick-plan "feature description"
         ↓
    Codebase Analysis (scans your project)
         ↓
    Interview (asks clarifying questions until ZERO gaps remain)
         ↓
    specs/feature-name.md (with mandatory Testing Strategy + Implementation Tasks)
         ↓
./ralph-execute.sh specs/feature-name.md
         ↓
    [Optional] Codex Pre-Flight Review (GPT-5-Codex analyzes spec)
         ↓
    Parse Spec → Beads (creates task graph with dependencies)
         ↓
    Ralph Loop (bd ready → implement → test → close, repeat)
         ↓
    Verified Code
```

### The Spec Format

Quick-plan generates specs with two mandatory RBP sections:

```markdown
## Testing Strategy

### Test Framework
bun test (detected from package.json)

### Test Command
`bun test`

### Unit Tests
- [ ] Test: User model validation → File: `tests/user.test.ts`
- [ ] Test: JWT token generation → File: `tests/auth.test.ts`

## Implementation Tasks

<!-- RBP-TASKS-START -->
### Task 1: Create user model
- **ID:** task-001
- **Dependencies:** none
- **Files:** `src/models/user.ts`
- **Acceptance:** User model with email, password hash, timestamps
- **Tests:** `tests/user.test.ts`
- **Subtasks:**
  - [ ] Define TypeScript interfaces
  - [ ] Implement validation logic
  - [ ] Add timestamp fields

### Task 2: Add JWT authentication [UI]
- **ID:** task-002
- **Dependencies:** task-001
- **Files:** `src/auth/jwt.ts`, `src/components/LoginForm.tsx`
- **Acceptance:** Login returns valid JWT, stored in httpOnly cookie
- **Tests:** `tests/auth.test.ts`
<!-- RBP-TASKS-END -->
```

### Codex Pre-Flight Review

Before executing, `ralph-execute.sh` optionally runs GPT-5-Codex to review the spec:

```bash
# With Codex review (default)
./scripts/rbp/ralph-execute.sh specs/feature.md

# Skip review
./scripts/rbp/ralph-execute.sh specs/feature.md --skip-review
```

Codex checks for:
- Missing edge cases
- Wrong technical approaches
- Missing task dependencies
- Incomplete testing strategy
- Security concerns

### UI Auto-Detection

Tasks tagged with `[UI]` or containing UI keywords automatically get the `requires-playwright` flag. The gatekeeper runs Playwright tests for these tasks.

<br />

---

<br />

## Key Decisions

### Why Beads as Source of Truth?

The agent queries `bd ready` instead of reading JSON files.

- **No stale state** — Beads is always current
- **No sync issues** — Single source of truth
- **Git-backed** — Full audit trail

### Why No Story Atomization?

We analyzed 76 real BMAD stories:

| Metric | Value |
|:-------|:------|
| Average story size | 3,914 tokens |
| Largest story | 12,962 tokens |
| Context budget used | 12.9% of 100k |

**All stories fit in a single context window.** For larger stories, our Execution Sequencer groups subtasks into phases of 3-5.

### Why Test-Gating at Script Level?

Agents can be told "run tests before closing." They can ignore the instruction.

Scripts cannot be ignored. `close-with-proof.sh` **runs** the tests. Either they pass or the task stays open.

<br />

---

<br />

## What's Included

```
rbp/
├── scripts/
│   ├── ralph.sh              # Main execution loop
│   ├── ralph-execute.sh      # Quick-plan execution (with Codex review)
│   ├── close-with-proof.sh   # Test-gated closure (THE GATEKEEPER)
│   ├── emit-event.sh         # PAI Observability event emitter
│   ├── parse-story-to-beads.sh  # BMAD Story → Beads conversion
│   ├── parse-spec-to-beads.sh   # Quick-plan Spec → Beads conversion (with atomic subtasks)
│   ├── sequencer.sh          # Phase grouping for large stories
│   ├── show-active-task.sh   # Display current task
│   └── save-progress-to-beads.sh  # Sync progress to bead notes
├── commands/rbp/
│   ├── start.md              # /rbp:start command (with dashboard auto-launch)
│   ├── status.md             # /rbp:status command
│   └── validate.md           # /rbp:validate command
├── lib/src/
│   ├── cli.ts                # TypeScript CLI entry point (Commander.js)
│   ├── commands/             # CLI command implementations
│   ├── workflows/            # BMAD and Beads workflow handlers
│   ├── config/               # Configuration loading and validation
│   └── utils/                # Shared utilities and error handling
├── templates/
│   ├── rbp-config.yaml         # Base configuration
│   ├── rbp-config.example.yaml # Documented config with comments
│   └── spec-template.md        # Quick-plan spec format template
├── install.sh                # One-line installation
├── validate.sh               # Installation checker
└── README.md                 # Package documentation
```

Key features of included scripts:
- **ralph.sh**: Failure state injection, completion signal detection
- **close-with-proof.sh**: Failure note appending, multi-layer verification
- **parse-spec-to-beads.sh**: Atomic subtask creation with dependency chaining
- **cli.ts**: TypeScript CLI with validation rules for arguments and options

<br />

---

<br />

## Tech Stack

- **Execution:** Claude Code CLI
- **CLI Engine:** TypeScript + Commander.js (bun runtime)
- **State:** Beads (git-backed) — query `bd ready`, never mirror to JSON
- **Testing:** bun test + Playwright
- **Scripts:** Bash
- **Runtime:** bun

<br />

---

<br />

## Configuration

```yaml
# rbp-config.yaml
project:
  name: "your-project"

paths:
  stories: "docs/stories"      # BMAD stories
  specs: "specs"               # Quick-plan specs

execution:
  max_iterations: 10
  phase_size: 5

verification:
  require_tests: true
  require_playwright_for_ui: true
  test_command: "bun run test"

quick_plan:
  command: "/quick-plan"
  spec_template: "templates/spec-template.md"

codex:
  enabled: true                # Set false if Codex not installed
  model: "gpt-5-codex"
  reasoning_effort: "high"
  skip_by_default: false       # Set true to skip review by default

observability:
  enabled: true                # Emit events to PAI dashboard
  auto_launch: true            # Auto-start dashboard with /rbp:start
```

<br />

---

<br />

## Observability

RBP integrates with [PAI (Personal AI Infrastructure)](https://github.com/danielmiessler/Personal_AI_Infrastructure.git) for real-time observability of task execution.

### What You Get

| Feature | Description |
|:--------|:------------|
| **Real-time Dashboard** | Watch task progress in your browser |
| **Event Stream** | See RBP:TaskStart, RBP:TestRun, RBP:TestResult events live |
| **Debug Visibility** | Trace through test failures and errors |
| **Multi-Session Support** | Run multiple RBP sessions with distinct session IDs |

### Setup

```bash
# 1. Install PAI (if not already installed)
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git ~/PAI
cd ~/PAI && ./install.sh

# 2. RBP auto-detects PAI and emits events automatically
# Events are written to: ~/.claude/history/raw-outputs/YYYY-MM/YYYY-MM-DD_all-events.jsonl

# 3. Launch dashboard with /rbp:start or manually:
~/.claude/observability/manage.sh start
# Dashboard: http://localhost:5172
```

### Event Types

| Event | Emitted When |
|:------|:-------------|
| `RBP:LoopStart` | Ralph begins execution |
| `RBP:TaskStart` | A task is picked from `bd ready` |
| `RBP:TaskProgress` | Task status changes (executing, iteration_complete) |
| `RBP:TaskComplete` | Task closed with proof |
| `RBP:TestRun` | Tests are about to run |
| `RBP:TestResult` | Tests complete (includes exit code, output) |
| `RBP:Error` | An error occurred |
| `RBP:CodexReview` | Codex pre-flight review starts/completes |
| `RBP:SpecParsed` | Spec parsed to Beads |
| `RBP:LoopEnd` | Ralph loop completes |

### Without PAI

RBP works without PAI — observability events are simply not emitted. You can still monitor progress via:

```bash
# File-based logs
tail -f scripts/rbp/progress.txt

# Beads activity
bd activity --follow

# Task status
bd status
```

<br />

---

<br />

## The Story Behind RBP

I've been using the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) for a while now. It's probably the best tool I've found for building software projects with AI — structured stories, clear acceptance criteria, the whole workflow. I'm also an avid [Claude Code](https://claude.ai) user. These tools changed how I build.

But something was missing.

Every time I kicked off a BMAD story, I'd watch the AI work... then it would stop. Ask a question. Wait for me. I'd answer, it would continue... then stop again. The constant back-and-forth was killing my productivity. I wanted to give it an Epic and walk away. Come back to working code.

**I wanted long-running autonomous processes.**

Then I discovered [Ralph](https://ghuntley.com/ralph/) — Geoffrey Huntley's pattern for relentless AI execution loops. And [Beads](https://github.com/steveyegge/beads) — Steve Yegge's git-backed task graph. Something clicked.

*What if I could combine BMAD's structured stories with Ralph's autonomous loops and Beads' persistent memory?*

I started building. 76 stories later, I had a working system. But I also discovered something uncomfortable: AI agents lie. They mark tasks "complete" without running tests. They check boxes without doing the work.

The realization hit me: **Checkboxes are self-reported. Tests are objective.**

An agent can flip a boolean. It cannot fake a passing test.

So I added test-gated closure. No task closes without proof. The script runs the tests — either they pass or the task stays open. The agent has no say in the matter.

Then I realized: when a task fails, the agent needs to see what went wrong. So I added failure state injection. The previous attempt's notes are automatically injected into the retry prompt. Now agents can learn from their mistakes without human guidance.

Finally, I made subtasks atomic. Each subtask is a separate bead with explicit dependencies, not just checklist items. This lets Ralph execute them sequentially with test verification after each one.

**The RBP Stack is the result.**

What started as a productivity hack became a verification-first autonomous development system. BMAD creates the stories. Beads tracks the state. Ralph drives the execution. Tests guard the gates. Failure notes teach the next attempt.

Now I give it an Epic and walk away. Come back to verified, working code.

<br />

<div align="center">

### I wanted to stop babysitting AI. This is how I did it.

</div>

<br />

---

<br />

## Roadmap

- [x] Core execution loop (Ralph)
- [x] Test-gated closure
- [x] Story → Beads conversion (BMAD workflow)
- [x] Spec → Beads conversion (Quick-Plan workflow)
- [x] Codex pre-flight review integration
- [x] UI auto-detection (Playwright)
- [x] Execution sequencer for large stories
- [x] Real-time progress dashboard (PAI Observability integration)
- [x] Failure state injection (previous attempt context)
- [x] Atomic subtask creation with dependencies
- [ ] Parallel task execution
- [ ] Integration with more test frameworks

<br />

---

<br />

## Contributing

Contributions welcome! Please ensure:

1. All scripts have tests
2. Documentation is updated
3. **The verification system is never bypassed**

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

<br />

---

<br />

## Acknowledgments

- **[Beads](https://github.com/steveyegge/beads)** — Git-backed issue tracking by Steve Yegge
- **[BMAD](https://github.com/bmad-code-org/BMAD-METHOD)** — Structured story creation framework
- **[Claude Code](https://claude.ai)** — Execution environment
- **[Ralph Pattern](https://ghuntley.com/ralph/)** — The original autonomous loop concept by Geoffrey Huntley

<br />

---

<br />

## License

MIT License — see [LICENSE](LICENSE) for details.

<br />

---

<br />

<div align="center">

**Built with frustration. Verified with tests.**

<br />

If this helped you, [⭐ star the repo](https://github.com/AojdevStudio/rbp-stack) — it helps others find it.

<br />

[![Star History Chart](https://api.star-history.com/svg?repos=AojdevStudio/rbp-stack&type=Date)](https://star-history.com/#AojdevStudio/rbp-stack&Date)

</div>
