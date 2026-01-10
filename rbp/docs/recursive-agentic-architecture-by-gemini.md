# The Recursive Agentic Architecture: Orchestrating Autonomous Development with Ralph, BMAD-METHOD, and Beads

## 1. Introduction: The Transition to Autonomous Recursive Loops

Software engineering is undergoing a fundamental shift. We're moving from human-centric coding augmented by AI assistants to **autonomous agentic loops** where humans serve as architects and orchestrators.

This report presents a comprehensive architecture for a high-fidelity autonomous development environment. The system integrates four distinct technologies:

- **Ralph**: An iterative execution loop that drives continuous development
- **BMAD-METHOD**: A structured agile agent framework for planning
- **Beads**: A persistent graph-based memory system for task management
- **PAI**: Personal AI Infrastructure for global identity and security

### The Problem We're Solving

Current generative AI workflows suffer from a critical disconnect: there's a gap between high-level strategic planning and low-level tactical execution. 

While Large Language Models (LLMs) excel at generating code snippets, they struggle with long-horizon tasks. The challenges include:

- **Context window limitations**: Models lose coherence over extended conversations
- **State drift**: The agent "forgets" earlier decisions and constraints
- **Lack of structured memory**: No persistent way to track progress across sessions

The "Ralph" technique addresses persistence through iterative loops, but a raw loop lacks the structured memory needed to navigate complex project specifications without "hallucinating" or deviating from the roadmap.

### The Solution

By combining these four technologies, we create a system capable of rigorous, self-correcting development:

- **BMAD-METHOD** acts as the "Legislative" layer, defining strict requirements via PRDs and Stories
- **Beads** serves as the "Executive" memory, managing atomic, graph-linked tasks
- **PAI** preserves global identity and toolset, ensuring secure, personalized operation
- **Ralph** provides the kinetic energy to drive execution

This report details the theoretical underpinnings, architectural specifications, and practical scripting required to realize this recursive agentic system. We focus specifically on the automated decomposition of monolithic BMAD stories into executable Beads tasks.
## 2. Theoretical Framework: Overcoming the Context Horizon

To understand the necessity of the Ralph-BMAD-Beads stack, one must first analyze the failure modes inherent in linear agentic workflows. The primary constraint in modern AI engineering is not model intelligence, but "Context Management" and "Execution Fatigue."

### 2.1 The Limits of Linear Execution and the "Ralph" Solution

Standard interactions with coding agents follow a simple pattern: you provide a prompt, the model generates a response. This "single-turn" interaction model works fine for simple tasks, but it's insufficient for complex feature implementation.

Complex development requires:
- Iterative refinement
- Error correction cycles
- State persistence across sessions

Geoffrey Huntley's "Ralph" technique addresses this by introducing **"Eventual Consistency"** to AI generation.2

#### How Ralph Works

Ralph is fundamentally a bash loop:

```bash
while :; do cat PROMPT.md | claude-code ; done
```

This loop relentlessly pipes context into an agent until a termination condition is met.2 It mimics the behavior of a persistent developer who iterates until the code works.

**The Philosophy**: While an LLM's single-shot output is non-deterministic and prone to defects, a continuous loop that incorporates feedback (compiler errors, test results) will converge on a correct solution over time.1

#### The Problem: Context Saturation

However, the raw Ralph loop suffers from **"Context Saturation"**. As the agent iterates:

- The conversation history fills with verbose error logs
- Failed attempts accumulate
- Early steps pollute the context window

If tasked with a monolithic feature (e.g., "Build the entire Payment System"), the context becomes polluted with irrelevant details from early steps, degrading performance on later steps.

**The Solution**: We need a mechanism to "reset" context while preserving progress. This is where Beads comes in.

### 2.2 The Structured Planning Imperative: BMAD-METHOD

Ralph provides the kinetic energy to drive execution, but it lacks direction. Without rigorous specifications, a recursive loop will iterate on bad assumptions, producing code that compiles correctly but functions incorrectly.

**BMAD-METHOD** (Breakthrough Method for Agile AI-Driven Development) provides the necessary structural guardrails.4

#### How BMAD Works

BMAD operates on **"Spec-Oriented Development"**. It uses specialized agents (Analyst, Architect, Product Manager) to generate hierarchical documentation:

- Project Briefs
- PRDs (Product Requirement Documents)
- Tech Specs
- Stories

#### The Context Bloat Problem

A critical insight from BMAD research: **"Context Bloat"** is dangerous.7

When an agent loads a comprehensive workflow file containing steps for analysis, drafting, technical specification, and review, it wastes thousands of tokens on instructions irrelevant to the immediate task.

#### The Story Decomposition Challenge

The "Story" artifact in BMAD—typically named `{epic}.{story}.story.md`—contains detailed acceptance criteria and architectural context.6

However, these stories can be lengthy and multifaceted. Asking a Ralph loop to "Implement Story 1.1" often leads to failure because the story contains too many distinct atomic tasks:

- Database migration
- API endpoint
- Frontend component
- Integration test

The agent attempts to do everything at once, saturates its context, and fails.

**Our Solution**: This architecture introduces a "Decomposition Layer" to bridge this gap—automatically breaking stories into atomic, executable tasks.
### 2.3 The Graph Memory Revolution: Beads vs. Markdown Lists

The traditional method for tracking agent tasks is a `TODO.md` file. While human-readable, flat Markdown lists are disastrous for autonomous agents.

#### Why TODO.md Fails

- **Ambiguity**: An agent cannot easily discern dependencies. Does "Build API" block "Build UI"?
- **Staleness**: Updating a text file requires rewriting it, consuming tokens and risking corruption
- **Lack of State**: A checkbox `[ ]` does not convey "In Progress," "Blocked," or "Failed Verification"

#### Enter Beads

Beads, developed by Steve Yegge, replaces linear lists with a **directed acyclic graph (DAG)** stored in a git-friendly `issues.jsonl` format.8

Key features:

- Every task gets a unique, immutable ID (e.g., `bd-a1b2`)
- Strict dependency enforcement
- The command `bd ready` returns only unblocked tasks ready for execution9

#### Why This Matters

This capability is the linchpin of our architecture. It transforms the Ralph loop from a "dumb" iterator into a "smart" orchestrator.

Instead of "thinking" about what to do next, the Ralph loop simply queries the Beads database. This externalizes the project state, allowing the agent's context window to remain clean and focused solely on the immediate task.

### 2.4 The Global Operating System: PAI

The final component is the "Operating System" for the agent. **PAI** (Personal AI Infrastructure) defines the global environment—the "Who am I?" and "What tools do I have?" of the AI.3

#### The Global-Local Paradox

A key requirement of this architecture is the **"Global PAI, Local BMAD"** paradox:

- **Global (PAI)**: User identity, security preferences, and core tool definitions must remain consistent across projects
- **Local (BMAD)**: Specific development workflows change from repo to repo

#### How PAI Solves This

PAI achieves this via **Hooks and Skills**.11

By configuring PAI's `SessionStart` hook, we can dynamically inject "Local Awareness" into the global agent. When Claude starts in a directory:

1. PAI checks for BMAD and Beads configuration files
2. Loads the appropriate context-handling skills
3. "Augments" the global agent with local capabilities
4. Without polluting the global configuration12

This allows the agent to adapt to local project constraints while maintaining global identity and security.
## 3. Comparative Analysis of Architectures

To illustrate the advantages of the RBP (Ralph-Beads-PAI) architecture, we compare it against standard implementation patterns.

**Table 1: Comparative Analysis of Autonomous Development Architectures**

| Feature | Standard "Chat" Workflow | Raw Ralph Loop (Bash) | RBP Architecture (Proposed) |
|---------|-------------------------|----------------------|----------------------------|
| Execution Model | Human-driven prompts (Ping-Pong) | Continuous while loop | Graph-driven Orchestration |
| Context Management | Manual context clearing | Context fills until crash/reset | Atomic "Sub-Stories" (Clean context per task) |
| Planning Artifacts | Loose prompt instructions | Raw PROMPT.md file | Structured BMAD Stories & PRDs |
| State Persistence | Chat History (Ephemeral) | File System (Code only) | Beads Database (issues.jsonl + Git) |
| Dependency Handling | Implicit / Hallucinated | Linear / Scripted | Explicit DAG (Graph-based blocking) |
| Failure Recovery | Human intervention required | Retry loop (often infinite) | Circuit breaker via Beads status / PAI Hooks |
| Global/Local Scope | Confused (Mix of global/local) | Local only (script per repo) | PAI Global Identity + Dynamic Local Injection |
| Token Efficiency | Low (Repeatedly sending full history) | Medium (Pipes full prompt) | High (Sends only atomic task context) |

## 4. Architectural Specification

This section details the technical architecture of the system, defining the interaction between the Global Layer (PAI), the Planning Layer (BMAD), the Memory Layer (Beads), and the Kinetic Layer (Ralph).

### 4.1 System Topology

The system is organized into four concentric layers, each with specific responsibilities and boundaries.

**Layer 1: The Global Substrate (PAI)**

- **Location**: `~/.config/pai`
- **Role**: The immutable identity and security layer
- **Components**:
  - **Hooks**: 
    - `hooks/initialize-session.ts` (Bootstrap)
    - `hooks/stop-hook.sh` (Loop persistence)
  - **Skills**: 
    - `skills/bmad-integrator` (Understanding BMAD syntax)
    - `skills/beads-controller` (JSONL manipulation)
  - **Security**: `hooks/PreToolUse` prevents destructive commands (e.g., `rm -rf`, external network calls without whitelist)13

**Layer 2: The Project Constitution (BMAD-METHOD)**

- **Location**: Project Root (.bmad/, docs/)
- **Role**: The definitive source of truth for requirements.
- **Artifacts**:
  - PRD: docs/prd.md (High-level vision).
  - Stories: docs/stories/{epic}.{story}.story.md (Detailed specs).
- **Constraint**: BMAD artifacts are read-only for the Execution Agent but read-write for the Planning Agent.

**Layer 3: The State Engine (Beads)**

- **Location**: Project Root (.beads/)
- **Role**: The dynamic memory and task scheduler.
- **Data Structure**: issues.jsonl (Git-tracked text database).
- **Mapping**:
  - Beads Epic: Corresponds 1:1 with a BMAD Story.
  - Beads Task: Corresponds to an Atomic Unit of Work (Sub-Story).
- **Logic**: The Ralph loop relies entirely on bd ready to determine the next action.

**Layer 4: The Kinetic Orchestrator (Ralph)**

- **Location**: Environment (PATH)
- **Role**: The relentless driver of the development cycle.
- **States**:
  - Decomposition: Transforming BMAD Stories into Beads Graphs.
  - Execution: Iteratively solving Beads Tasks.
  - Verification: Running tests and closing Beads.

### 4.2 The "Decomposition Pattern" Workflow

The core innovation of this architecture is the **automated breaking down of long BMAD stories**. This process prevents the "Context Bloat" issue we identified earlier.7

#### The Workflow: From Story to Tasks

Here's how a monolithic BMAD story gets transformed into executable Beads tasks:

**Step 1: Ingestion**
- The Ralph script targets a specific BMAD Story file (e.g., `user-auth.story.md`)

**Step 2: Analysis**
- The script invokes a "Planner Agent" (via Claude Code)
- The agent receives the BMAD Story and the beads-controller skill

**Step 3: Decomposition**
- The Planner Agent analyzes the Acceptance Criteria (AC) in the story
- It breaks these ACs into 3-4 sequential, atomic tasks

**Example Decomposition:**

**BMAD Story**: "Implement OAuth2 Login with Google."

**Beads Tasks**:
1. "Scaffold OAuth callback route and controller"
2. "Implement Google Strategy configuration and env vars"
3. "Create User model creation logic on successful callback"
4. "Write integration test for auth flow"

**Step 4: Graph Generation**
- The Planner Agent outputs a shell script containing `bd create` commands
- **Crucially**: It sets dependencies—Task 4 depends on Task 3, which depends on Task 2, etc.

**Step 5: Injection**
- The Ralph script executes these commands
- The Beads database is populated with the task graph

**Step 6: Handover**
- The Planner Agent exits
- The Ralph Execution Loop begins, picking up Task 1
## 5. Technical Implementation

The following sections provide the specific code and configuration required to implement this architecture.

### 5.1 The Orchestration Script: super-ralph.sh

This shell script is the heart of the "Local Ralph" execution. It manages the lifecycle of the BMAD story decomposition and the subsequent execution loop.

```bash
#!/bin/bash
# ==============================================================================
# Script Name: super-ralph.sh
# Description: Recursive Agentic Orchestrator for BMAD/Beads/PAI integration.
#              Orchestrates the breakdown of BMAD stories into Beads tasks
#              and executes them via a Ralph loop.
# Version:     1.0.0
# Author:      Domain Expert (Generated for Report)
# ==============================================================================

set -e  # Exit immediately if a command exits with a non-zero status.

# --- Configuration & Constants ---
STORY_FILE="$1"
MAX_ITERATIONS=50
LOG_FILE="ralph-execution.log"
PLAN_PROMPT_FILE=".ralph_plan_prompt.md"
WORK_PROMPT_FILE=".ralph_work_prompt.md"

# ANSI Color Codes for readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[$timestamp]${NC} $1"
    echo "[$timestamp] $1" >> "$LOG_FILE"
}

error_exit() {
    echo -e "${RED}$1${NC}"
    exit 1
}

check_dependencies() {
    # Verify essential tools are available in the PATH
    command -v claude >/dev/null 2>&1 || error_exit "Claude Code is not installed."

| error_exit "Claude Code is not installed."
    command -v bd >/dev/null 2>&1 || error_exit "Beads (bd) is not installed."

| error_exit "Beads (bd) is not installed."
    command -v jq >/dev/null 2>&1 || error_exit "jq is not installed."

| error_exit "jq is not installed."
    
    if [ -z "$STORY_FILE" ]; then
        error_exit "Usage: ./super-ralph.sh <path-to-bmad-story.md>"
    fi

    if [ ! -f "$STORY_FILE" ]; then
        error_exit "Story file not found: $STORY_FILE"
    fi
    
    log "Dependencies verified. Target Story: $STORY_FILE"
}

# --- Phase 1: Context Injection (Global PAI -> Local) ---
# This phase prepares the Prompt that instructs the Agent to behave as a Planner.
# It leverages the PAI global identity but focuses it on the local task.

generate_planning_prompt() {
    cat <<EOF
# ROLE
You are an Expert Architect Agent within the BMAD-METHOD framework. 
You are operating within a PAI-augmented environment.

# OBJECTIVE
Analyze the provided BMAD User Story and decompose it into a directed graph of atomic executable tasks using Beads (bd).

# CONTEXT
- **Input Story**: ${STORY_FILE}
- **Methodology**: BMAD (Breakthrough Method for Agile AI-Driven Development)
- **Memory System**: Beads (Git-backed Graph Issue Tracker)

# INSTRUCTIONS
1. **Analyze**: Read the story file content carefully. Identify the Acceptance Criteria (AC).
2. **Decompose**: Break the story down into 3-4 granular, sequential "Sub-Stories" (Tasks).
   - Each task must be atomic (implementable in one coding session).
   - Tasks must be sequentially linked using dependencies to prevent context saturation.
3. **Output**: Generate a BASH SCRIPT BLOCK containing 'bd create' commands.
   - Use the format: \`id=\$(bd create "Title" --json | jq -r.id)\`
   - Link tasks: \`bd create "Next Task" --deps \$id\`
   - Tag all issues with "ralph-managed" and "story-ref:$(basename "$STORY_FILE")".
   - DO NOT write code or explanations outside the bash block.
EOF
}

# --- Phase 2: The Decomposition Loop (Planner Agent) ---

decompose_story() {
    # Check if we already have open tasks for this story.
    # We filter Beads issues by the tag 'story-ref:<filename>' to be precise.
    STORY_TAG="story-ref:$(basename "$STORY_FILE")"
    
    # We use jq to count issues containing the specific tag
    EXISTING_TASKS=$(bd list --status open --json | jq --arg tag "$STORY_TAG" '[. | select(.labels? | contains($tag))] | length')
    
    if [ "$EXISTING_TASKS" -gt 0 ]; then
        log "Found $EXISTING_TASKS existing open tasks for this story. Resuming execution."
        return
    fi

    log "No active tasks found. Initiating Story Decomposition..."
    
    # 1. Prepare the Prompt
    generate_planning_prompt > "$PLAN_PROMPT_FILE"
    echo -e "\n\n--- STORY CONTENT START ---\n" >> "$PLAN_PROMPT_FILE"
    cat "$STORY_FILE" >> "$PLAN_PROMPT_FILE"
    echo -e "\n--- STORY CONTENT END ---\n" >> "$PLAN_PROMPT_FILE"

    # 2. Invoke Claude (Planner Mode)
    # We explicitly ask the user to confirm the plan generation or pipe it if autonomous.
    log "Invoking Planner Agent to generate Beads graph..."
    
    # NOTE: In a fully automated setup, we would capture stdout. 
    # For safety/verification, we prompt the user or use a tool-use pattern.
    # Here we simulate the command generation.
    
    echo -e "${YELLOW}!!! PLANNER AGENT ACTIVE!!!${NC}"
    # The following line simulates passing the prompt to Claude and executing the output.
    # In practice, this requires a 'tool use' enabled Claude that can run the bash commands directly.
    # Or we pipe the output to a temporary script.
    
    # Ideally: claudecode -p "$PLAN_PROMPT_FILE" --tool-allowed "bash"
    
    # For this script, we assume the agent has executed the creation commands 
    # via the PAI 'bash' tool during the session. 
    # If not, we would implement a capture loop here.
    
    # Simulate wait for user/agent interaction
    echo "Waiting for Beads graph generation... (Press Enter when agent is done)"
    read -r
    
    # 3. Verify Graph Creation
    NEW_TASKS=$(bd list --status open --json | jq --arg tag "$STORY_TAG" '[. | select(.labels? | contains($tag))] | length')
    if [ "$NEW_TASKS" -eq 0 ]; then
        error_exit "Decomposition failed. No Beads tasks were created."
    fi
    
    log "Decomposition successful. $NEW_TASKS tasks queued."
}

# --- Phase 3: The Ralph Execution Loop (Worker Agent) ---

run_ralph_loop() {
    log "Starting Ralph Kinetic Loop..."
    
    ITERATION=0
    while [ $ITERATION -lt $MAX_ITERATIONS ]; do
        ((ITERATION++))
        
        # 1. Query the State Engine (Beads)
        # 'bd ready' returns only unblocked tasks.
        # We assume the Decomposition phase linked them sequentially, 
        # so this should return exactly one task (the next one in the chain).
        
        READY_TASK_JSON=$(bd ready --json | jq -r '. // empty')
        
        if [ -z "$READY_TASK_JSON" ]; then
            # No ready tasks. Are we done, or blocked?
            OPEN_COUNT=$(bd list --status open --json | jq '. | length')
            if [ "$OPEN_COUNT" -eq 0 ]; then
                log "${GREEN}All tasks completed. Story Implemented!${NC}"
                
                # Optional: Trigger PAI hook to update BMAD Story status to "Implemented"
                #./scripts/update-bmad-status.sh "$STORY_FILE" "Implemented"
                exit 0
            else
                log "${RED}Tasks are open but blocked.${NC} Manual intervention required."
                bd list --status open
                exit 1
            fi
        fi
        
        # 2. Extract Task Context
        TASK_ID=$(echo "$READY_TASK_JSON" | jq -r '.id')
        TASK_TITLE=$(echo "$READY_TASK_JSON" | jq -r '.title')
        TASK_DESC=$(echo "$READY_TASK_JSON" | jq -r '.description')
        
        log "Iteration $ITERATION: Executing Task :: $TASK_TITLE"
        
        # 3. Update State (In Progress)
        bd update "$TASK_ID" --status in_progress >/dev/null
        
        # 4. Construct Worker Prompt
        # This is a "Local" prompt. It does NOT need the full BMAD story text again,
        # just the specific task details and a reference to the file.
        # This saves massive tokens.
        
        cat <<EOF > "$WORK_PROMPT_FILE"
# WORKER AGENT INSTRUCTION
You are a Sub-Agent implementing a specific atomic task.

# TASK DETAILS
- **ID**: $TASK_ID
- **Title**: $TASK_TITLE
- **Description**: $TASK_DESC

# CONTEXT
- Parent Story: $STORY_FILE (Refer to this for broad architectural alignment only)
- Current Working Directory: $(pwd)

# REQUIREMENTS
1. **Implement**: Write the code required for this specific task.
2. **Verify**: Create or update a test case to verify this specific task.
3. **Execute**: Run the test.
4. **Report**: If successful, output "TASK_COMPLETE". If failed, attempt fix.
EOF

        # 5. Execute Kinetic Action (Claude)
        log "Dispatching Worker Agent..."
        
        # We pipe the prompt to Claude.
        # Ideally, we use the '--non-interactive' flag if available, or rely on the tool harness.
        # We assume PAI 'stop-hook' is monitoring this process.
        
        # Example command (conceptual):
        # claude --prompt-file "$WORK_PROMPT_FILE" --auto-approve
        
        log "Agent working... (Simulated)"
        # Simulating external agent process completion
        sleep 2
        
        # 6. Verification and Closure
        # In a real loop, we would parse Claude's output or check 'git status'.
        # Here we assume the agent ran 'bd close' if it finished.
        # If the agent forgot, we check tests.
        
        # Check if the task is still open in Beads
        IS_OPEN=$(bd show "$TASK_ID" --json | jq -r '.status')
        
        if [ "$IS_OPEN" = "closed" ]; then
            log "Task $TASK_ID confirmed closed. Proceeding to next node."
        else
            log "Task $TASK_ID remains open. Attempting verification..."
            # Simple heuristic: If tests pass, close it.
            #./run_tests.sh && bd close "$TASK_ID"
            
            # For this script, we force a prompt if not closed.
            echo "Task $TASK_ID is still open. Did the agent finish? (y/n)"
            read -r CONFIRM
            if [ "$CONFIRM" = "y" ]; then
                 bd close "$TASK_ID" --reason "Manual confirmation in Ralph loop"
            else
                 log "Retrying task..."
                 # Loop continues, picking up same task
            fi
        fi
        
        # Cleanup
        rm -f "$WORK_PROMPT_FILE"
    done
    
    error_exit "Maximum iterations ($MAX_ITERATIONS) reached. Loop terminated for safety."
}

# --- Main Execution Flow ---
check_dependencies
decompose_story
run_ralph_loop
```

### 5.2 PAI Hook Configuration: The Global-Local Bridge

To satisfy the requirement of keeping PAI global while respecting local BMAD contexts, we utilize PAI's hook system. These scripts reside in ~/.config/pai/hooks/ and are executed automatically by the PAI runtime (augmenting Claude Code).

#### 5.2.1 initialize-session.ts (Global Bootstrap)

This hook acts as the "Sense Organ" for the global agent. It detects the local environment and injects the necessary skills.

```typescript


// File: ~/.config/pai/hooks/initialize-session.ts
// Purpose: Detect BMAD/Beads environment and load local context into Global PAI session.

import { HookContext } from 'pai-types'; // Conceptual type definition
import * as fs from 'fs';
import * as path from 'path';

export async function onSessionStart(context: HookContext) {
  const cwd = process.cwd();
  
  // 1. Detection: Look for BMAD and Beads markers
  const isBmadProject = fs.existsSync(path.join(cwd, '.bmad'));
  const hasBeads = fs.existsSync(path.join(cwd, '.beads'));

  if (isBmadProject) {
    context.system.log("Detected BMAD-METHOD Project Structure.");
    
    // 2. Skill Injection: Load the 'BMAD' skill from Global PAI library
    // This allows the agent to understand PRDs, Stories, and Agile syntax
    await context.agent.loadSkill('bmad-core');
    
    // 3. Dynamic Context: Read the 'active' story if implied by environment
    // (e.g., if a file is open or explicitly passed in env vars)
    if (process.env.ACTIVE_STORY) {
       const storyPath = path.join(cwd, process.env.ACTIVE_STORY);
       if (fs.existsSync(storyPath)) {
         context.agent.injectContext({
           type: 'file',
           path: storyPath,
           description: 'Current Active BMAD Story'
         });
       }
    }
  }

  if (hasBeads) {
    context.system.log("Detected Beads Memory Graph.");
    
    // 4. Tool Injection: Enable 'beads-manager' skill
    // This gives the agent deep knowledge of 'bd' CLI commands and JSON output parsing
    await context.agent.loadSkill('beads-manager');
    
    // 5. Ralph Configuration: Set mode to 'Sub-Agent'
    // This tells the agent it is running inside a loop, not a chat
    context.session.setMetadata('mode', 'ralph-worker');
    
    // 6. Safety: Register the Stop Hook to prevent premature exits
    // This ensures the agent calls 'bd close' before trying to exit the session
    context.hooks.register('beforeExit', async () => {
       // Logic to check if active bead is closed
       // implementation detail in stop-hook.ts
    });
  } else if (isBmadProject) {
    // 7. Advisory: If BMAD exists but Beads is missing, suggest initialization
    context.system.warn("BMAD detected without Beads. Ralph loop will not function correctly.");
    context.agent.suggest("Run 'bd init' to enable persistent graph memory.");
  }
}
```

#### 5.2.2 stop-hook.sh (The Ralph Persistence Mechanism)

Standard Claude Code sessions try to exit when the model thinks it is done. In a Ralph loop, "done" with a sub-task does not mean the session should end; it means the loop should iterate. This hook intercepts the exit signal.

```bash
#!/bin/bash
# File: ~/.config/pai/hooks/stop-hook.sh
# Purpose: Prevent Claude from exiting if the Beads task is not closed.

# Check if we are in a Ralph managed session
if [ -z "$RALPH_TASK_ID" ]; then
  exit 0
fi

# Get the current task ID (assumed exported by the orchestrator)
CURRENT_TASK_ID="$RALPH_TASK_ID"

if [ -n "$CURRENT_TASK_ID" ]; then
  # Check status in Beads
  STATUS=$(bd show "$CURRENT_TASK_ID" --json | jq -r '.status')
  
  if [ "$STATUS" != "closed" ]; then
    echo "BLOCKING EXIT: Task $CURRENT_TASK_ID is still '$STATUS'."
    echo "You must successfully verify the code and run 'bd close $CURRENT_TASK_ID' before exiting."
    exit 1 # Non-zero exit code blocks the agent's exit attempt
  fi
fi

exit 0
```

### 5.3 Beads Configuration: Adapting to BMAD

Beads is a general-purpose tool. To work seamlessly with BMAD, we configure it to understand the distinction between "Epics" (BMAD Stories) and "Sub-Stories" (Ralph Tasks).

```yaml
# File: .beads/config.yaml
# Purpose: Configure Beads to model BMAD hierarchy.

project:
  name: "BMAD-Ralph-Integration"
  description: "Graph memory for Ralph execution loop"

# Define Issue Types that map to BMAD concepts
types:
  - name: sub-story
    color: "#4287f5" # Blue
    description: "Atomic implementation task derived from a BMAD Story"
    icon: "🔨"
  
  - name: analysis
    color: "#a832a4" # Purple
    description: "Investigation or Decomposition task"
    icon: "🔍"

  - name: bug
    color: "#f54242" # Red
    description: "Issues discovered during Ralph loop execution"
    icon: "🐛"

# Automation rules
automation:
  # When all sub-stories are closed, prompt to update parent BMAD story
  on_close:
    run_script: "scripts/check_bmad_completion.sh"

# Git Integration Settings
storage:
  backend: sqlite
  sync:
    mode: jsonl
    path:.beads/issues.jsonl
    auto_import: true
    auto_export: true
    # Ideally, we verify the JSONL is valid before syncing to prevent corruption
    verify_json: true 
```

## 6. Operational Workflow and Best Practices

### 6.1 The "Day One" Bootstrap

For a domain expert initializing this stack on a new machine:

1. **PAI Setup**: Clone the user's PAI repo to ~/.config/pai. This pulls in the TypeScript hooks and the "Beads Skill" definition.
2. **Tool Installation**: Ensure claude (Claude Code), bd (Beads), and jq are in the $PATH.
3. **Project Init**:
   ```bash
   git clone <repo>
   npx bmad-method install  # Scaffolds .bmad/ and docs/
   bd init  # Scaffolds .beads/
   cp /path/to/super-ralph.sh .  # Or add to global scripts
   ```

### 6.2 The Decomposition Phase

When `super-ralph.sh` runs, the "Planner Agent" phase is critical.

#### Best Practice: Sequential Dependencies

The prompt instructs the agent to create **sequential dependencies** (`--deps`). This is vital.

**Why?** If the agent creates 4 parallel tasks, the Ralph loop might pick them up in random order. By forcing dependencies (Task B depends on Task A), we ensure proper sequencing:

- Database schema is built before the API endpoint that queries it
- API endpoints exist before frontend components that call them
- Implementation completes before integration tests run

#### Token Economics

This phase consumes the most tokens because it reads the full BMAD story. However, **it only happens once per story**, making it a worthwhile investment.

### 6.3 The Kinetic Loop Phase

#### Monitoring Progress

Run this command in a separate terminal for a real-time dashboard:

```bash
watch -n 5 "bd list --status open --json | jq"
```

This shows the agent's progress as it works through tasks.

#### Intervention Protocol

If the agent enters an infinite loop (e.g., repeatedly failing a test and retrying the same fix), intervene:

1. **Kill the script** (Ctrl+C)
2. **Manually fix** the code or the test
3. **Close the task** manually: `bd close <id>`
4. **Restart the script**

Because Beads persists state in `issues.jsonl`, the script resumes exactly where it left off.

## 7. Advanced Topics

### 7.1 Token Economics and Cost Analysis

The RBP architecture offers significant cost savings over traditional "Context Stuffing."

- **Traditional Method**: Loading a 2,000-line PRD.md + Story.md + Architecture.md (~15k tokens) for every interaction. Over 50 turns, this is 750k tokens.
- **RBP Method**:
  - Decomposition: 15k tokens (Once).
  - Task Execution: The sub-agent only sees the atomic Beads task (~200 tokens) and the specific file it is editing (~2k tokens). Over 50 turns (across 4 tasks), this might be 100k tokens.
  - **Savings**: ~85% reduction in input tokens.

### 7.2 Security Considerations

Granting an autonomous loop "Bash Access" is inherently risky.

- **PAI Sandboxing**: The PreToolUse hook in PAI is the primary defense. It should be configured to whitelist only specific commands (bd, git, npm test, ls, cat) and block dangerous ones (rm, curl, ssh).
- **Git Safety**: Since Beads is backed by Git, every action by the agent is versioned. If Ralph "goes rogue" and deletes code, a simple `git checkout .` restores the state. The issues.jsonl file provides a forensic audit trail of why the agent took that action.

## 8. Future Directions

The integration of Ralph, BMAD, and Beads creates a **"Self-Driving" software development lifecycle**. Future iterations of this architecture could include:

### Swarm Topology

Instead of a single Ralph loop, **multiple loops could run in parallel** (if tasks are not dependent). Beads would act as the synchronization primitive (Mutex) to prevent merge conflicts.

**Benefits**:
- Faster execution for independent tasks
- Better resource utilization
- Natural parallelization of development work

### Self-Healing Stories

If a worker agent discovers that a Beads task is impossible (e.g., "API implementation" fails because the "Schema" task was flawed), it could:

1. Flag the task as "Blocked"
2. Trigger a "Re-Planning" event
3. Summon the Architect Agent to refactor the graph

This creates a **self-correcting system** that adapts when initial plans prove flawed.

## 9. Conclusion

This report has detailed the architecture for a robust, recursive agentic workflow. By fusing four key technologies, we achieve a system that addresses the fundamental limitations of current AI coding assistants:

- **Global Identity (PAI)**: Consistent user identity and security across projects
- **Strategic Planning (BMAD-METHOD)**: Structured requirements and specifications
- **State Management (Beads)**: Persistent, graph-based task tracking
- **Kinetic Execution (Ralph)**: Relentless iterative development loops

### The "Sub-Story" Pattern

The provided `super-ralph.sh` script and architectural specifications enable the decomposition of monolithic stories into atomic, graph-managed tasks.

This "Sub-Story" pattern, enabled by Beads, transforms the Ralph loop from a simple retry mechanism into a **sophisticated orchestrator** capable of navigating complex, multi-stage engineering challenges with minimal human oversight.

### The Result

The result is a development environment that is not just "automated," but **"autonomous"** in the truest sense—capable of:

- **Planning**: Breaking down complex stories into executable tasks
- **Executing**: Iteratively implementing code with feedback loops
- **Verifying**: Running tests and validating correctness
- **Persisting**: Maintaining state across sessions and iterations

This architecture represents a fundamental shift toward truly autonomous software development.

## Citations

1. Ralph Loop Concepts & Implementation.
2. BMAD-METHOD Workflows & Artifacts.
3. Beads Memory, Graph Logic & Commands.
4. PAI Hooks, Skills & Architecture.

## Works Cited

- frankbria/ralph-claude-code: Autonomous AI development loop for Claude Code with intelligent exit detection - GitHub, accessed January 9, 2026, https://github.com/frankbria/ralph-claude-code
- Ralph Wiggum as a "software engineer" - Geoffrey Huntley, accessed January 9, 2026, https://ghuntley.com/ralph/
- Personal_AI_Infrastructure/README.md at main - GitHub, accessed January 9, 2026, https://github.com/danielmiessler/Personal_AI_Infrastructure/blob/main/README.md
- bmad-code-org/BMAD-METHOD: Breakthrough Method for Agile Ai Driven Development, accessed January 9, 2026, https://github.com/bmad-code-org/BMAD-METHOD
- BMAD-METHOD/docs/modules/bmm-bmad-method/index.md at main - GitHub, accessed January 9, 2026, https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/modules/bmm-bmad-method/index.md
- The BMAD Method: A Framework for Spec Oriented AI-Driven Development, accessed January 9, 2026, https://recruit.group.gmo/engineer/jisedai/blog/the-bmad-method-a-framework-for-spec-oriented-ai-driven-development/
- From Token Hell to 90% Savings: How BMAD v6 Revolutionized AI-Assisted Development | by Trung Hiếu Trần - Medium, accessed January 9, 2026, https://medium.com/@hieutrantrung.it/from-token-hell-to-90-savings-how-bmad-v6-revolutionized-ai-assisted-development-09c175013085
- The Beads Revolution: How I Built The TODO System That AI Agents Actually Want to Use, accessed January 9, 2026, https://steve-yegge.medium.com/the-beads-revolution-how-i-built-the-todo-system-that-ai-agents-actually-want-to-use-228a5f9be2a9
- steveyegge/beads - A memory upgrade for your coding agent - GitHub, accessed January 9, 2026, https://github.com/steveyegge/beads
- Beads: A Git-Friendly Issue Tracker for AI Coding Agents | Better Stack Community, accessed January 9, 2026, https://betterstack.com/community/guides/ai/beads-issue-tracker-ai-agents/
- danielmiessler/Personal_AI_Infrastructure: Personal AI Infrastructure for upgrading humans. - GitHub, accessed January 9, 2026, https://github.com/danielmiessler/Personal_AI_Infrastructure
- Personal_AI_Infrastructure/Tools/PAIPackTemplate.md at main - GitHub, accessed January 9, 2026, https://github.com/danielmiessler/Personal_AI_Infrastructure/blob/main/Tools/PAIPackTemplate.md
- claude-code/plugins/README.md at main - GitHub, accessed January 9, 2026, https://github.com/anthropics/claude-code/blob/main/plugins/README.md
- BMAD-METHOD/docs/modules/core/core-workflows.md at main - GitHub, accessed January 9, 2026, https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/modules/core/core-workflows.md
- BMAD-METHOD/CHANGELOG.md at main - GitHub, accessed January 9, 2026, https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md
- beads/docs/FAQ.md at main · steveyegge/beads - GitHub, accessed January 9, 2026, https://github.com/steveyegge/beads/blob/main/docs/FAQ.md
- Personal_AI_Infrastructure/Packs/kai-history-system.md at main - GitHub, accessed January 9, 2026, https://github.com/danielmiessler/Personal_AI_Infrastructure/blob/main/Packs/kai-history-system.md
