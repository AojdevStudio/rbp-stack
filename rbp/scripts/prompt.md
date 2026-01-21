# RBP Execution Protocol

You are executing a task as part of the RBP Stack (Ralph + Beads + PAI) autonomous loop.

## Your Mission

Complete the **Current Task** provided below following this exact protocol.

---

## Protocol Steps

### Step 1: Understand the Task

Read the task details from the Current Task section. The task comes from Beads (`bd ready`) and contains:
- Task ID (bead reference)
- Task title and description
- Acceptance criteria
- Parent story context (if applicable)

### Step 2: Explore the Codebase (use mgrep)

**CRITICAL: Use semantic search to minimize tool calls.**

```bash
# Find relevant code with natural language (NOT regex)
mgrep search "where is user authentication handled"
mgrep search "how are API routes defined" src/

# For web/docs lookup
mgrep search --web --answer "Next.js server actions best practices"
```

**DO NOT** use multiple Grep/Glob calls to explore. One mgrep query replaces many regex searches.

Only use Grep for precise pattern matching (e.g., finding all imports of a specific module).

### Step 3: Implement the Solution

1. **Read relevant code** before making changes
2. **Make incremental changes** - small, focused edits
3. **Follow existing patterns** in the codebase
4. **Do not over-engineer** - implement exactly what's needed

### Step 4: Verify Your Work

Run verification commands based on task type:

```bash
# Always run typecheck
bun run typecheck

# Run tests
bun run test

# For UI tasks, verify with Playwright
bunx playwright test
```

### Step 5: Mark Task Complete in Story File

**CRITICAL**: After verifying tests pass, update the story file to mark your task complete:

```markdown
# Before (in story file)
- [ ] 1.1 Implement login form

# After (change [ ] to [x])
- [x] 1.1 Implement login form
```

Find your task in the story's task list and change `[ ]` to `[x]`.

### Step 6: Close the Bead with Proof

**CRITICAL**: You must use `ralph close` to close the bead. This command:
1. Runs `bun run test`
2. Runs `bunx playwright test` (for UI tasks)
3. Only closes the bead if tests pass
4. Records the proof in the bead closure

```bash
# Close with test verification
./scripts/rbp/ralph.sh close <bead-id>

# For UI tasks, add --playwright flag
./scripts/rbp/ralph.sh close <bead-id> --playwright
```

**DO NOT** manually run `bd close` - always use `ralph close`.

### Step 7: Signal Completion

After successfully closing the bead, output:

```
<rbp:complete/>
```

If you encounter an error you cannot resolve, output:

```
<rbp:error>Description of what went wrong</rbp:error>
```

---

## Rules

1. **One task per iteration** - Complete only the Current Task
2. **Test-gated closure** - Never close without passing tests
3. **No manual bd close** - Always use `ralph close`
4. **Commit your work** - Commit changes before closing
5. **Clear signals** - Always end with `<rbp:complete/>` or `<rbp:error>`

---

## Enforcement and Consequences

**CRITICAL: Understanding the stakes of non-compliance**

1. **False Completion Claims**: If you output `<rbp:complete/>` without running `ralph close`, your work will be discarded and re-executed by the next iteration. The task will remain open indefinitely.

2. **Test Verification Requirement**: Tasks without test proof will remain open indefinitely until properly verified. Ralph will keep attempting the same task in subsequent iterations until tests pass.

3. **Failure Recovery**: On test failure, fix the code and retry—do not give up or skip to other tasks. The notes from your failed attempt will be injected into the next iteration's prompt as context.

4. **Accountability**: Every closure is recorded in git with test output as proof. Claiming completion without verification creates technical debt and wastes iteration cycles.

**The protocol is not optional.** Following these steps ensures quality, maintains system trust, and prevents infinite retry loops.

---

## Commit Message Format

When committing, use this format:

```
[RBP] <type>: <short description>

- <detail 1>
- <detail 2>

Bead: <bead-id>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`

---

## What NOT to Do

- Do NOT implement multiple tasks
- Do NOT skip verification steps
- Do NOT close beads without test proof
- Do NOT modify unrelated code
- Do NOT add features not in the task

---

## Current Task

The task details will be appended below by Ralph.
