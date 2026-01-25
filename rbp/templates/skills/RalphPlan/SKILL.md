---
name: RalphPlan
description: Interactive planning skill with structured questioning for RBP projects. USE WHEN user says "plan with me", "ralph plan", "spec out", "plan a feature", or "plan a project".
---

# RalphPlan - Interactive Planning Workflow

## Overview

RalphPlan replaces non-interactive `/quick-plan` with a conversational, user-driven planning experience. This skill asks questions at every major decision point to ensure the spec matches user intent before creating Beads tasks.

**Key Features:**
- Heavy use of AskUserQuestion for requirements gathering
- Workflow auto-detection (BMAD vs Quick-plan)
- Tech stack preference integration
- User-controlled branching strategy
- Approval-gated task generation

## Text Notification

**When executing this skill, output:**
```
Running the **Plan** workflow from the **RalphPlan** skill...
```

## Workflow Routing

RalphPlan provides two primary workflows based on project detection:

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **BMAD Planning** | Sprint status YAML exists | Story-driven workflow, tasks map to story points |
| **Quick-plan Planning** | No sprint YAML | Spec-driven workflow, tasks are standalone units |

Both workflows follow the same interactive steps but generate different output formats.

## Workflow Detection

RalphPlan auto-detects your project type:

**BMAD Projects:**
- Sprint status YAML exists
- Story-driven workflow
- Tasks map to story points

**Quick-plan Projects:**
- No sprint YAML
- Spec-driven workflow
- Tasks are standalone units

**Always confirm detection with user:**
```
AskUserQuestion: "I detected this is a [BMAD|Quick-plan] project. Is that correct?"
```

## Interactive Planning Workflow

### Step 1: Detect and Confirm Project Type

```bash
# Check for BMAD indicators
if [ -f ".rbp/sprint-status.yaml" ]; then
  project_type="BMAD"
else
  project_type="Quick-plan"
fi
```

**Then ask:**
```
AskUserQuestion: "I detected this is a {project_type} project. Should I proceed with {project_type} workflow, or would you prefer the other approach?"
```

### Step 2: Gather Requirements

Use AskUserQuestion extensively:

**Scope Questions:**
1. "What is the high-level goal of this feature/project?"
2. "What are the must-have requirements? What's optional?"
3. "Are there any constraints I should know about? (timeline, dependencies, tech limitations)"

**Tech Stack Questions (if no tech-stack-preferences.md):**
1. "What language/framework should I use? (TypeScript, Python, Go, etc.)"
2. "What testing framework? (bun test, Playwright, pytest, etc.)"
3. "Any preferred libraries or tools?"

**If tech-stack-preferences.md exists:**
```
AskUserQuestion: "I found your tech stack preferences at {path}. Should I use those defaults, or do you want to override for this project?"
```

**Task Granularity:**
```
AskUserQuestion: "How granular should tasks be? (1-2 hour tasks, half-day tasks, or full-day tasks)"
```

### Step 3: Branching Strategy

**Critical question:**
```
AskUserQuestion: "When should I create feature branches?
- After every N tasks (specify N)
- After each epic/milestone
- One branch for entire feature
- Let me decide manually"
```

**Checkpoint frequency:**
```
AskUserQuestion: "How often should I commit and push?
- After each task closes
- After passing all tests
- At end of session only
- Custom frequency (describe)"
```

### Step 4: Draft Task Breakdown

Based on gathered requirements, draft tasks in this format:

```markdown
## Proposed Task Breakdown

### Epic: {Feature Name}

**Task 1: {Title}**
- Description: {what needs doing}
- Acceptance Criteria: {how to verify}
- Estimated Size: {1-2 hours | half-day | full-day}
- Dependencies: {none | blocks: task-X}

**Task 2: {Title}**
...

**Branching Plan:**
- Create branch: {when}
- Merge to main: {when}

**Testing Strategy:**
- Unit tests: {which tasks}
- Integration tests: {which tasks}
- Manual verification: {which tasks}
```

**Then ask:**
```
AskUserQuestion: "I've drafted {N} tasks. Review the breakdown above. Should I:
1. Create all tasks as-is
2. Make changes (specify which tasks)
3. Add more tasks
4. Reduce granularity (merge tasks)
5. Start over with different approach"
```

### Step 5: Refine Based on Feedback

**If changes requested:**
- Make adjustments
- Show updated breakdown
- Ask for approval again

**Iterate until approved.**

### Step 6: Create Beads Tasks

Once approved, generate tasks:

```bash
# For each task in approved breakdown
bd create "{task_title}" \
  --description "{description}" \
  --acceptance-criteria "{criteria}" \
  --size "{size}" \
  --depends-on "{dependencies}"
```

**Confirmation:**
```
AskUserQuestion: "Created {N} tasks in Beads. Run 'bd list --open' to see them. Ready to start execution with 'ralph run'?"
```

## Tech Stack Integration

### If tech-stack-preferences.md exists:

```bash
# Check for preferences file
if [ -f "specs/tech-stack-preferences.md" ] || [ -f "docs/tech-stack-preferences.md" ]; then
  preferences_path="$(find . -name 'tech-stack-preferences.md' -type f)"
fi
```

**Read and summarize:**
```
AskUserQuestion: "Your tech stack preferences specify:
- Language: {lang}
- Framework: {framework}
- Testing: {test_framework}
- Style: {code_style}

Should I use these defaults for this project?"
```

### If no preferences file:

Offer to create one:
```
AskUserQuestion: "You don't have a tech-stack-preferences.md file yet. Would you like me to create one based on your answers, so future planning sessions can skip these questions?"
```

## Branching Strategy Details

### Option A: Task-Based Branching
```
Create branch after every {N} tasks
- N=1: Branch per task (fine-grained)
- N=5: Branch per milestone
- N=10: Branch per epic
```

### Option B: Milestone Branching
```
Create branch for each major deliverable:
- "feat/authentication"
- "feat/user-dashboard"
- "feat/payment-integration"
```

### Option C: Single Feature Branch
```
One branch for entire feature, squash merge at end
- Simpler git history
- Harder to isolate issues
```

**Always confirm user's preference before creating first branch.**

## Output Validation

Before finalizing, verify:

1. **All tasks have:**
   - Clear title
   - Acceptance criteria
   - Size estimate
   - Dependencies (if any)

2. **Branching strategy is explicit:**
   - When to create branches
   - When to merge
   - Naming convention

3. **Testing strategy defined:**
   - Which tasks need tests
   - Test types (unit/integration/e2e)
   - Manual verification steps

4. **User approved the plan:**
   - No pending questions
   - User confirmed ready to proceed

## Common Patterns

### Pattern: Frontend Feature
```
Tasks:
1. Component structure (1-2 hours)
2. State management (2-3 hours)
3. API integration (2-3 hours)
4. Styling (1-2 hours)
5. Unit tests (2 hours)
6. Playwright e2e tests (2 hours)

Branch: feat/user-profile
Tests: bun test + bunx playwright test
```

### Pattern: Backend API
```
Tasks:
1. Database schema (1 hour)
2. API endpoints (3-4 hours)
3. Business logic (2-3 hours)
4. Input validation (1 hour)
5. Unit tests (2 hours)
6. Integration tests (2 hours)

Branch: feat/payment-api
Tests: bun test
```

### Pattern: Full-Stack Feature
```
Tasks:
1. Database + API (4 hours)
2. Frontend components (3 hours)
3. Integration (2 hours)
4. End-to-end tests (3 hours)

Branch: feat/checkout-flow
Tests: bun test + bunx playwright test
```

## Examples

### Example 1: Planning a New Authentication Feature

**User Request:** "Plan with me - I want to add user authentication"

**Skill Execution:**

1. **Project Detection:**
   - Detects Quick-plan project (no sprint status YAML)
   - Confirms with user via AskUserQuestion

2. **Requirements Gathering:**
   - High-level goal: JWT-based auth with email/password
   - Must-have: login, signup, password reset
   - Optional: OAuth providers
   - Tech stack: TypeScript + bun (confirmed from defaults)
   - Task granularity: 1-2 hour tasks
   - Branching: One branch for entire auth feature

3. **Task Breakdown Draft:**

   **Epic: JWT-Based Authentication**

   - **Task 1:** Database schema for users (1 hour)
     - Create users table with email, password_hash, created_at
     - Acceptance: Migration runs, schema validates

   - **Task 2:** Password hashing utilities (1 hour)
     - Implement bcrypt hashing and comparison
     - Acceptance: Unit tests pass for hash/compare

   - **Task 3:** Signup endpoint (2 hours)
     - POST /auth/signup with email validation
     - Acceptance: Returns JWT on success, 400 on invalid input
     - Dependencies: task-1, task-2

   - **Task 4:** Login endpoint (2 hours)
     - POST /auth/login with credential verification
     - Acceptance: Returns JWT on success, 401 on bad credentials
     - Dependencies: task-1, task-2

   - **Task 5:** Password reset flow (2 hours)
     - Reset token generation and email sending
     - Acceptance: Token expires after 1 hour, email sent
     - Dependencies: task-1

   - **Task 6:** Integration tests (2 hours)
     - Test full signup -> login -> reset flow
     - Acceptance: All edge cases covered, 100% coverage
     - Dependencies: task-3, task-4, task-5

   **Branching Plan:**
   - Branch: feat/jwt-authentication
   - Merge: After all tests pass

   **Testing Strategy:**
   - Unit tests: task-2
   - Integration tests: task-6
   - Manual verification: Postman/curl testing

4. **User Approval:**
   - User reviews and approves all 6 tasks

5. **Beads Task Creation:**
   - Creates 6 tasks in Beads with proper dependencies
   - Confirms readiness to execute with `ralph run`

**Outcome:** 6 well-defined tasks with clear acceptance criteria, dependencies, and testing strategy, ready for autonomous execution.

## Error Handling

**If user is unsure:**
```
AskUserQuestion: "You mentioned you're not sure about {aspect}. Would you like me to:
1. Suggest a default based on similar projects
2. Show examples of different approaches
3. Skip this for now and decide later
4. Research options and present recommendations"
```

**If conflicting requirements:**
```
AskUserQuestion: "I noticed a conflict: you want {A} but also {B}, which are incompatible. Which should take priority?"
```

**If scope is too large:**
```
AskUserQuestion: "This feature has {N} tasks spanning {X} hours. Should I:
1. Break into multiple epics
2. Reduce scope (which features to defer?)
3. Proceed as-is
4. Get more help (assign to multiple developers)"
```

## Success Criteria

RalphPlan session is successful when:

1. Project type detected and confirmed
2. All requirements gathered via questions
3. Tech stack preferences applied or created
4. Branching strategy agreed upon
5. Task breakdown drafted and approved
6. Beads tasks created with dependencies
7. User ready to execute with `ralph run`

## Tips for Effective Planning

**Ask open-ended questions first:**
- "What problem are we solving?"
- "Who is this for?"
- "What does success look like?"

**Then narrow down:**
- "Which of these is most critical?"
- "What's the simplest version that works?"
- "What can we defer to v2?"

**Confirm understanding:**
- "So to summarize: you want {X}, {Y}, and {Z}. Correct?"
- "Did I miss anything important?"

**Visualize scope:**
- "This will take approximately {N} hours"
- "Split into {M} milestones"
- "First deliverable in {timeframe}"

## Integration with Ralph Execution

Once tasks are created, Ralph can execute them:

```bash
# Start autonomous execution
ralph run

# Or execute specific task
bd update <task-id> --status in_progress
# [do work]
ralph close <task-id>  # Runs tests before closing
```

RalphPlan hands off cleanly to Ralph execution by ensuring:
- Tasks have clear acceptance criteria
- Dependencies are explicit
- Tests are defined
- Branching strategy is documented

## Notes

- RalphPlan is consultative, not autonomous
- Every major decision requires user input
- Use AskUserQuestion liberally - better to over-ask than under-deliver
- Save user preferences to avoid repeat questions in future sessions
- If stuck, ask the user how to proceed
