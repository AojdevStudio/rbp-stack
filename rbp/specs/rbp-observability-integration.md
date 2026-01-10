# RBP Observability Integration Specification

**Generated:** 2026-01-09 23:31:00
**Status:** Ready for Implementation
**RBP Compatible:** Yes

## Problem Statement

### Why This Exists

RBP's autonomous execution loops (`ralph.sh` and `ralph-execute.sh`) currently lack real-time observability. Users cannot see what Ralph is doing without manually tailing `progress.txt` or running `bd status` repeatedly. This creates three pain points:

1. **Progress Blindness**: No way to watch task execution in real-time
2. **Debug Difficulty**: When tests fail or tasks error, tracing through text logs is tedious
3. **Multi-Session Chaos**: Running multiple RBP sessions (different projects/specs) with no unified view

**Who It's For:**
- Users running RBP autonomous loops who want real-time feedback
- Developers debugging failed tasks and test failures
- Power users running multiple parallel RBP sessions

**Cost of NOT Doing This:**
- Frustration from "is it stuck or just slow?" uncertainty
- Time wasted grepping through logs to debug failures
- Risk of missing critical errors in background executions

### The Solution

**Integrate RBP into the existing PAI Observability Dashboard** rather than building standalone tooling.

**Architecture:**
```
RBP (ralph.sh/ralph-execute.sh)
  ↓ emits structured JSONL events
  ↓ writes to ~/.claude/history/.../all-events.jsonl
  ↓
PAI Hooks (existing capture-all-events.ts)
  ↓ detects new RBP events
  ↓ broadcasts via WebSocket
  ↓
PAI Observability Dashboard (http://localhost:5172)
  ↓ displays RBP alongside agent activity
  ✓ Real-time task progress
  ✓ Test results
  ✓ Error traces
```

**Key Insight:** Beads already has `bd activity --follow` for task-level observability. What's missing is execution-level visibility (what Ralph is doing, test output, Claude's reasoning). Emitting structured events solves this.

## Technical Requirements

### Event Schema

RBP emits events compatible with PAI's existing JSONL format:

```typescript
interface RBPEvent {
  source_app: "RBP" | "RBP-QuickPlan" | "RBP-BMAD";
  session_id: string;          // RBP session UUID
  hook_event_type: "RBP:TaskStart" | "RBP:TaskProgress" | "RBP:TaskComplete" | "RBP:TestRun" | "RBP:TestResult" | "RBP:Error";
  payload: {
    session_id: string;
    cwd: string;                // Project root
    hook_event_name: string;    // Same as hook_event_type
    rbp_data: {
      iteration: number;         // Current Ralph iteration
      task_id?: string;          // Beads task ID
      task_title?: string;       // Human-readable task name
      test_command?: string;     // Test command run
      test_output?: string;      // Stdout/stderr from tests
      test_exit_code?: number;   // 0 = pass, non-zero = fail
      error_message?: string;    // Error details if failed
      bead_status?: "open" | "in_progress" | "closed";
    };
  };
  timestamp: number;             // Unix timestamp (ms)
  timestamp_pst: string;         // Human-readable PST
}
```

### Event Emission Points

**In `ralph.sh` (BMAD workflow):**

| Execution Point | Event Type | Data |
|----------------|------------|------|
| Loop start | `RBP:TaskStart` | iteration, task_id, task_title |
| Claude execution begins | `RBP:TaskProgress` | iteration, task_id, status |
| Test run triggered | `RBP:TestRun` | iteration, task_id, test_command |
| Test completes | `RBP:TestResult` | iteration, task_id, test_exit_code, test_output |
| Task closed successfully | `RBP:TaskComplete` | iteration, task_id, bead_status="closed" |
| Error encountered | `RBP:Error` | iteration, task_id, error_message |
| Loop completion | `RBP:TaskComplete` | iteration=final, status="all complete" |

**In `ralph-execute.sh` (Quick-plan workflow):**

Additional events:
- `RBP:CodexReview` - when Codex pre-flight runs
- `RBP:SpecParsed` - when spec is parsed to beads

### File Modifications

**New Files:**
- `rbp/scripts/emit-event.sh` - Bash helper to emit JSONL events
- `rbp/commands/quick-plan.md` - Copy of PAI quick-plan command (bundled in repo)
- `specs/rbp-observability-integration.md` - This spec

**Modified Files:**
- `rbp/scripts/ralph.sh` - Add event emission calls
- `rbp/scripts/ralph-execute.sh` - Add event emission calls
- `rbp/scripts/close-with-proof.sh` - Emit test result events
- `rbp/commands/rbp/start.md` - Add auto-launch of observability dashboard
- `rbp/install.sh` - Copy quick-plan.md to commands/, check PAI requirement
- `rbp/README.md` - Document PAI requirement and observability features

### Integration with PAI Observability

**Auto-Launch Behavior:**

When `/rbp:start` is invoked:
1. Check if PAI Observability is running (check port 4000/5172)
2. If not running:
   - Execute `~/.claude/skills/Observability/manage.sh start`
   - Wait for server to be ready (poll http://localhost:4000/health)
3. Open browser to http://localhost:5172 (in forked context)
4. Proceed with RBP execution (emit events as Ralph runs)

**Configuration:**

Add to `rbp-config.yaml`:
```yaml
observability:
  enabled: true                    # Emit events
  auto_launch: true                # Auto-start PAI dashboard on /rbp:start
  pai_install_check: true          # Verify PAI is installed before starting
```

**Fallback if PAI Not Installed:**

If PAI is not found:
1. Emit warning: "PAI Observability not found. Install from: https://github.com/danielmiessler/Personal_AI_Infrastructure.git"
2. Disable event emission (`observability.enabled = false`)
3. Continue with standard progress.txt logging
4. Do not block execution

## Edge Cases & Error Handling

### PAI Not Installed

**Scenario:** User runs `/rbp:start` but PAI is not installed at `~/.claude/skills/Observability/`

**Handling:**
```bash
if [ ! -f ~/.claude/skills/Observability/manage.sh ]; then
  echo "⚠️  PAI Observability not found"
  echo "Install PAI from: https://github.com/danielmiessler/Personal_AI_Infrastructure.git"
  echo "Continuing without real-time observability..."
  OBSERVABILITY_ENABLED=false
fi
```

- Exit code: 0 (continue)
- Fallback: Use progress.txt only
- No blocking of RBP execution

### Observability Server Won't Start

**Scenario:** `manage.sh start` fails (port conflict, missing dependencies)

**Handling:**
```bash
timeout 10s bash -c 'until curl -s http://localhost:4000/health; do sleep 1; done' 2>/dev/null || {
  echo "⚠️  Could not start PAI Observability (timeout)"
  echo "Check: ~/.claude/skills/Observability/manage.sh status"
  echo "Continuing with file-based logging..."
  OBSERVABILITY_ENABLED=false
}
```

- Exit code: 0 (continue)
- Fallback: File logging
- User can manually start dashboard later

### Event File Write Failure

**Scenario:** Cannot write to `~/.claude/history/raw-outputs/YYYY-MM/YYYY-MM-DD_all-events.jsonl` (permissions, disk full)

**Handling:**
```bash
emit_event() {
  local event_json="$1"
  local event_file="$HOME/.claude/history/raw-outputs/$(date +%Y-%m)/$(date +%Y-%m-%d)_all-events.jsonl"

  # Ensure directory exists
  mkdir -p "$(dirname "$event_file")" 2>/dev/null || return 1

  # Try to append
  echo "$event_json" >> "$event_file" 2>/dev/null || {
    # Silently fail - don't block execution
    return 1
  }
}
```

- Exit code: 0 (continue)
- Fallback: Event lost, but execution continues
- No error spam (silent failure)

### Malformed JSON Event

**Scenario:** emit-event.sh generates invalid JSON (special characters, escaping issues)

**Handling:**
- Use `jq` to validate before writing:
  ```bash
  echo "$event_json" | jq -c '.' >> "$event_file" 2>/dev/null || {
    # Invalid JSON - log to stderr for debugging but don't block
    echo "Invalid RBP event JSON (skipped)" >&2
    return 1
  }
  ```
- If jq not installed: write raw JSON (PAI dashboard will skip invalid lines)

### Browser Won't Open

**Scenario:** `/rbp:start` tries to open http://localhost:5172 but browser fails

**Handling:**
```bash
if command -v open &>/dev/null; then
  open http://localhost:5172 2>/dev/null || true
elif command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:5172 2>/dev/null || true
fi

# Always print the URL regardless of browser success
echo ""
echo "📊 Observability Dashboard: http://localhost:5172"
echo ""
```

- Exit code: 0 (continue)
- Fallback: User opens browser manually
- URL always printed

## User Experience

### Mental Model

**User Perspective:** "When I run `/rbp:start`, I should immediately see a live dashboard showing what Ralph is doing, just like I see agent activity in PAI Observability."

**Key Principle:** RBP is not special-cased - it's just another event source in the PAI ecosystem. The observability dashboard treats RBP tasks the same way it treats agent tool calls.

### Confusion Points & Solutions

**1. Confusion: "I ran /rbp:start but don't see the dashboard"**

**Solution:** Explicit terminal output on launch:
```
RBP Execution Started
═══════════════════════════════════════════════════════

📊 Observability Dashboard: http://localhost:5172
   Showing real-time task progress, test results, and errors

📝 File Logs: scripts/rbp/progress.txt

Monitor with:
- Browser: http://localhost:5172 (live updates)
- Terminal: tail -f scripts/rbp/progress.txt
- Beads: bd activity --follow
- Tasks: bd status
```

**2. Confusion: "The dashboard shows agent activity but not my RBP tasks"**

**Solution:** Filter UI in PAI Observability dashboard:
- Add dropdown: "Show: [ All | Agents Only | RBP Only ]"
- RBP events have `source_app: "RBP"` for easy filtering
- Default: Show All (agents + RBP together)

*Note: This requires a small PAI Observability update (out of scope for RBP, but recommended)*

**3. Confusion: "Which file do I check when something fails?"**

**Solution:** Error event includes file path:
```json
{
  "hook_event_type": "RBP:Error",
  "payload": {
    "rbp_data": {
      "error_message": "Tests failed (exit code 1)",
      "test_output": "...",
      "log_file": "scripts/rbp/progress.txt"
    }
  }
}
```

Dashboard displays: "❌ Task failed. Details: scripts/rbp/progress.txt:142"

### Feedback Requirements

**At Each Step:**

1. **Session Start:** "RBP session started. Dashboard: http://localhost:5172"
2. **Task Start:** Event emitted → Dashboard shows "▶️ Task 1: Create ITC Risk Data Models"
3. **Test Running:** Event emitted → Dashboard shows "🧪 Running: uv run pytest tests/test_itc_risk.py"
4. **Test Pass:** Event emitted → Dashboard shows "✅ Tests passed (0.8s)"
5. **Test Fail:** Event emitted → Dashboard shows "❌ Tests failed (exit 1)" + expand for output
6. **Task Complete:** Event emitted → Dashboard shows "✓ Task 1 complete" + progress bar updates
7. **Error:** Event emitted → Dashboard shows "⛔ Error: [message]" with red highlight

## Scope & Tradeoffs

### In Scope (MVP - All Implemented)

✅ **Core Event Emission:**
- emit-event.sh bash helper
- Events emitted from ralph.sh for all key execution points
- Events emitted from ralph-execute.sh including Codex review
- Events emitted from close-with-proof.sh for test results

✅ **PAI Integration:**
- Auto-launch of PAI Observability dashboard on /rbp:start
- Health check to verify dashboard is running
- Browser auto-open to http://localhost:5172

✅ **Configuration:**
- rbp-config.yaml observability section
- Install-time PAI dependency check
- Graceful fallback when PAI not installed

✅ **Documentation:**
- README update with PAI requirement and install link
- Bundle quick-plan.md in rbp/commands/
- Event schema documented for future PAI dashboard filtering

### Out of Scope

❌ **Modifying PAI Observability Dashboard:**
- RBP-specific filtering UI (use existing dashboard as-is)
- Custom RBP visualization (events display like any other agent activity)
- Historical event storage (PAI dashboard is ephemeral, this is intentional)

❌ **Advanced Event Types:**
- Codex reasoning trace (just emit start/complete, not full reasoning)
- Inter-task dependency visualization (beads handles this with `bd graph`)
- Performance metrics (execution time, memory usage)

❌ **Standalone RBP Dashboard:**
- No custom TUI with `blessed` or `ink`
- No separate web UI just for RBP
- No tmux status bar integration (rely on PAI dashboard)

### Technical Debt Knowingly Accepted

**1. No Event Validation:**
- **Accepted:** emit-event.sh doesn't validate required fields before writing
- **Why:** Adds complexity, and invalid events are just skipped by PAI dashboard
- **Mitigation:** Use jq if available to catch malformed JSON
- **Future:** Could add JSON schema validation if events frequently malformed

**2. No Event Batching:**
- **Accepted:** Each event is written immediately (one write per event)
- **Why:** Simplicity, and event volume is low (< 100 events per session)
- **Mitigation:** Use append mode (`>>`) which is relatively efficient
- **Future:** Could batch events if high-volume usage emerges

**3. Requires PAI Installed:**
- **Accepted:** Full observability requires PAI infrastructure
- **Why:** Building standalone dashboard duplicates PAI work
- **Mitigation:** Graceful fallback to progress.txt if PAI missing
- **Future:** Could contribute RBP filtering to PAI Observability upstream

## Integration Requirements

### PAI Dependency

**Hard Requirement:** For full observability, users must have PAI installed.

**Installation Link:**
https://github.com/danielmiessler/Personal_AI_Infrastructure.git

**Check During `./rbp/install.sh`:**
```bash
if [ -d "$HOME/.claude/skills/Observability" ]; then
  echo "✅ PAI Observability found"
else
  echo "⚠️  PAI not found - observability features will be limited"
  echo "   Install PAI for real-time monitoring:"
  echo "   https://github.com/danielmiessler/Personal_AI_Infrastructure.git"
  echo ""
  read -p "Continue without PAI? (y/n): " choice
  if [ "$choice" != "y" ]; then
    exit 1
  fi
fi
```

**Behavior if PAI Missing:**
- Install succeeds (not a blocker)
- `/rbp:start` skips auto-launch of dashboard
- Event emission disabled
- Falls back to progress.txt only

### File System Integration

**Event File Location:**
`$HOME/.claude/history/raw-outputs/YYYY-MM/YYYY-MM-DD_all-events.jsonl`

**Directory Creation:**
```bash
# In emit-event.sh
EVENT_FILE="$HOME/.claude/history/raw-outputs/$(date +%Y-%m)/$(date +%Y-%m-%d)_all-events.jsonl"
mkdir -p "$(dirname "$EVENT_FILE")" 2>/dev/null
```

**File Rotation:** Automatic daily rotation (matches PAI's existing convention)

### Quick-Plan Command Integration

**Source:** PAI's `/quick-plan` command at `~/.claude/skills/quick-plan/SKILL.md`

**Distribution:** Bundled copy in RBP repo at `rbp/commands/quick-plan.md`

**Install Process:**
1. `./rbp/install.sh` copies quick-plan.md to project's `.claude/commands/`
2. Symlink or direct copy (TBD based on install.sh pattern)
3. User can run `/quick-plan` from any RBP-enabled project

**Sync Strategy (Future):**
- Bundle current version at release time
- Document in README that updates to quick-plan require RBP update
- Future: Could add `rbp update-commands` to pull latest from PAI

## Security & Compliance

### Sensitive Data

**Event Payload Contents:**
- Task IDs (safe - just beads IDs like "itc-001")
- Task titles (safe - user-defined, no system secrets)
- Test commands (safe - user-defined)
- Test output (potentially sensitive - could include API keys in error messages)

**Sanitization Required:**
```bash
# In emit-event.sh
sanitize_output() {
  local output="$1"
  # Redact common secret patterns
  echo "$output" | \
    sed 's/api[_-]key[=:][^ ]*/API_KEY=[REDACTED]/gi' | \
    sed 's/password[=:][^ ]*/PASSWORD=[REDACTED]/gi' | \
    sed 's/token[=:][^ ]*/TOKEN=[REDACTED]/gi'
}
```

**When Not to Sanitize:**
- Task titles/descriptions (user controls these)
- Bead IDs (not sensitive)
- Timestamps, iteration numbers

### File Permissions

**Event File:**
```bash
# After creating event file
chmod 600 "$EVENT_FILE"  # Only user can read/write
```

**Config File:**
```bash
# rbp-config.yaml should not contain secrets
# But enforce restrictive permissions anyway
chmod 644 rbp-config.yaml
```

### No Network Exposure

**Critical:** All observability is local-only
- Events written to local filesystem
- PAI Observability binds to localhost only (127.0.0.1:4000, 127.0.0.1:5172)
- No external API calls
- No cloud uploads

**Firewall Safety:** Even if ports 4000/5172 exposed, they're localhost-bound

## Success Criteria & Testing

### Acceptance Criteria

**Functional Requirements:**

✅ **FR1:** `/rbp:start` auto-launches PAI Observability dashboard
- **Test:** Run `/rbp:start`, verify browser opens to http://localhost:5172
- **Expected:** Dashboard loads, server is healthy

✅ **FR2:** RBP events appear in dashboard in real-time
- **Test:** Start Ralph loop, watch dashboard for task start events
- **Expected:** See "▶️ Task 1: [title]" appear within 1 second of task start

✅ **FR3:** Test results are captured and displayed
- **Test:** Run task that includes tests, watch dashboard
- **Expected:** See "🧪 Running: bun test" then "✅ Tests passed" or "❌ Tests failed"

✅ **FR4:** Errors are emitted with full context
- **Test:** Trigger a test failure, check dashboard
- **Expected:** Event shows error message, test output, and file path for debugging

✅ **FR5:** Graceful fallback when PAI not installed
- **Test:** Uninstall PAI, run `/rbp:start`
- **Expected:** Warning printed, execution continues with progress.txt logging

✅ **FR6:** Quick-plan command bundled and functional
- **Test:** After install, run `/quick-plan` in project
- **Expected:** Quick-plan workflow launches (codebase analysis, interview, spec generation)

**Non-Functional Requirements:**

✅ **NFR1:** Event emission adds < 50ms overhead per event
- **Test:** Time Ralph iteration with/without event emission
- **Expected:** No noticeable slowdown

✅ **NFR2:** Invalid events don't crash execution
- **Test:** Inject malformed JSON test output, verify Ralph continues
- **Expected:** Invalid event skipped, execution proceeds

✅ **NFR3:** Dashboard handles 100+ events without lag
- **Test:** Run long Ralph session (20+ iterations), monitor dashboard
- **Expected:** UI remains responsive, events display smoothly

### Testing Strategy

**Integration Tests (Manual - MVP):**

This feature is primarily integration/E2E, so manual testing is appropriate for MVP.

**Test Plan:**

```bash
# Test 1: Happy path (PAI installed, everything works)
cd /path/to/test-project
./rbp/install.sh
/rbp:start specs/test-spec.md
# Verify:
# - Dashboard opens in browser
# - Events appear in real-time
# - Test results shown
# - Task closes successfully

# Test 2: PAI not installed (fallback)
mv ~/.claude/skills/Observability ~/.claude/skills/Observability.bak
/rbp:start
# Verify:
# - Warning about missing PAI
# - Execution continues
# - progress.txt logs as normal
mv ~/.claude/skills/Observability.bak ~/.claude/skills/Observability

# Test 3: Dashboard won't start (port conflict)
# Start something else on port 4000
python3 -m http.server 4000 &
/rbp:start
# Verify:
# - Timeout waiting for dashboard
# - Warning printed
# - Execution continues
kill %1  # Stop http.server

# Test 4: Test failure captured
# Create spec with failing test
/rbp:start specs/failing-spec.md
# Verify:
# - Dashboard shows red "❌ Tests failed"
# - Test output visible
# - Error event emitted

# Test 5: Quick-plan command works
/quick-plan "Add user authentication"
# Verify:
# - Quick-plan workflow launches
# - Spec generated in specs/
# - Ready to parse with /rbp:start
```

**Event Schema Validation:**

```bash
# Test emit-event.sh directly
cd rbp/scripts
./emit-event.sh "RBP:TaskStart" '{"iteration":1,"task_id":"test-001","task_title":"Test Task"}'

# Verify event file
tail -1 ~/.claude/history/raw-outputs/$(date +%Y-%m)/$(date +%Y-%m-%d)_all-events.jsonl | jq '.'

# Expected output:
{
  "source_app": "RBP",
  "session_id": "...",
  "hook_event_type": "RBP:TaskStart",
  "payload": {
    "session_id": "...",
    "cwd": "...",
    "hook_event_name": "RBP:TaskStart",
    "rbp_data": {
      "iteration": 1,
      "task_id": "test-001",
      "task_title": "Test Task"
    }
  },
  "timestamp": 1704936660000,
  "timestamp_pst": "2026-01-09 23:31:00 PST"
}
```

### Performance Benchmarks

**Target Latencies:**
- Event emission: < 10ms per event
- Dashboard update: < 100ms from event to UI display
- Total overhead: < 5% of Ralph execution time

**Acceptable:** Event emission should not be noticeable to user.

## Implementation Notes

### Codebase-Specific Guidance

**Files to Create:**

1. **`rbp/scripts/emit-event.sh`**
   - Bash function to emit RBP events
   - Takes event_type and rbp_data JSON
   - Generates full event with timestamp
   - Appends to all-events.jsonl
   - Handles directory creation, sanitization

2. **`rbp/commands/quick-plan.md`**
   - Copy of PAI quick-plan command
   - Bundled in RBP repo for standalone usage
   - Install script copies to project .claude/commands/

**Files to Modify:**

1. **`rbp/scripts/ralph.sh`**
   - Source emit-event.sh
   - Emit events at: task start, progress, test run, test result, task complete, error, loop end
   - Add session_id generation
   - Check observability config flag

2. **`rbp/scripts/ralph-execute.sh`**
   - Source emit-event.sh
   - Emit events for: Codex review start/complete, spec parsed
   - Same session_id as ralph.sh

3. **`rbp/scripts/close-with-proof.sh`**
   - Emit RBP:TestRun before running tests
   - Emit RBP:TestResult after tests (include exit code, output)

4. **`rbp/commands/rbp/start.md`**
   - Add workflow step: Check if observability running, launch if not
   - Update report to include dashboard URL

5. **`rbp/install.sh`**
   - Add PAI dependency check
   - Copy quick-plan.md to .claude/commands/
   - Create ~/.claude/history/raw-outputs/ directory structure

6. **`rbp/README.md`**
   - Add "Requirements" section with PAI link
   - Add "Observability" section explaining dashboard
   - Add screenshot (future) of dashboard showing RBP events

7. **`rbp/templates/rbp-config.yaml`**
   - Add observability section:
     ```yaml
     observability:
       enabled: true
       auto_launch: true
       pai_install_check: true
     ```

### Patterns to Follow

**Event Emission Pattern:**
```bash
# In ralph.sh
source "$SCRIPT_DIR/emit-event.sh"

# At task start
emit_rbp_event "RBP:TaskStart" "{
  \"iteration\": $iteration,
  \"task_id\": \"$task_id\",
  \"task_title\": \"$task_title\"
}"
```

**Session ID Generation:**
```bash
# At start of ralph.sh
SESSION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
export RBP_SESSION_ID="$SESSION_ID"
```

**Config Check Pattern:**
```bash
# Read from rbp-config.yaml
OBSERVABILITY_ENABLED=$(grep -A3 '^observability:' rbp-config.yaml | grep 'enabled:' | awk '{print $2}')

if [ "$OBSERVABILITY_ENABLED" != "true" ]; then
  # Skip event emission
  return 0
fi
```

## Testing Strategy

### Integration Test (Primary)

**File:** Manual test checklist (no automated integration test for MVP)

**Why Manual?**
- Requires PAI Observability dashboard running
- Involves browser verification
- End-to-end workflow testing
- Small scope (< 10 integration points)

**Test Checklist:**

1. ✅ Install RBP with PAI present
   - Verify quick-plan.md copied
   - Verify PAI check passes

2. ✅ Run /rbp:start with spec
   - Dashboard auto-launches
   - Browser opens
   - Events appear in UI

3. ✅ Verify all event types
   - TaskStart
   - TestRun
   - TestResult (pass)
   - TaskComplete

4. ✅ Trigger test failure
   - TestResult (fail) event
   - Error details visible

5. ✅ Install RBP without PAI
   - Warning shown
   - Execution continues
   - No events emitted

6. ✅ Dashboard already running
   - /rbp:start detects it
   - Doesn't restart
   - Events still work

## Implementation Tasks

<!-- RBP-TASKS-START -->

### Task 1: Create emit-event.sh Event Emitter
- **ID:** obs-001
- **Dependencies:** none
- **Files:** `rbp/scripts/emit-event.sh`
- **Acceptance:** Emits valid JSONL events to ~/.claude/history/.../all-events.jsonl, handles directory creation, sanitizes output
- **Tests:** Manual - run emit-event.sh directly, verify event in file with `jq`

### Task 2: Add Session ID to Ralph
- **ID:** obs-002
- **Dependencies:** none
- **Files:** `rbp/scripts/ralph.sh`
- **Acceptance:** Generate UUID session_id at start, export as RBP_SESSION_ID
- **Tests:** Run ralph.sh, check RBP_SESSION_ID env var is set

### Task 3: Integrate Events into ralph.sh
- **ID:** obs-003
- **Dependencies:** obs-001, obs-002
- **Files:** `rbp/scripts/ralph.sh`
- **Acceptance:** Emit events at TaskStart, TestRun, TestResult, TaskComplete, Error, loop end
- **Tests:** Run ralph.sh on test spec, verify all event types in all-events.jsonl

### Task 4: Integrate Events into ralph-execute.sh
- **ID:** obs-004
- **Dependencies:** obs-001, obs-002
- **Files:** `rbp/scripts/ralph-execute.sh`
- **Acceptance:** Emit CodexReview and SpecParsed events
- **Tests:** Run ralph-execute.sh, verify Codex events emitted

### Task 5: Integrate Events into close-with-proof.sh
- **ID:** obs-005
- **Dependencies:** obs-001
- **Files:** `rbp/scripts/close-with-proof.sh`
- **Acceptance:** Emit TestRun before tests, TestResult after (with exit code and output)
- **Tests:** Run close-with-proof.sh on passing and failing tests, verify both cases

### Task 6: Add Observability Auto-Launch to /rbp:start
- **ID:** obs-006
- **Dependencies:** none
- **Files:** `rbp/commands/rbp/start.md`
- **Acceptance:** Check if PAI Observability running, launch if not, health check, open browser
- **Tests:** Run /rbp:start, verify dashboard opens in browser

### Task 7: Add PAI Dependency Check to install.sh
- **ID:** obs-007
- **Dependencies:** none
- **Files:** `rbp/install.sh`
- **Acceptance:** Check for ~/.claude/skills/Observability/, warn if missing, allow continuation
- **Tests:** Run install.sh with and without PAI, verify behavior

### Task 8: Bundle quick-plan.md in RBP Repo
- **ID:** obs-008
- **Dependencies:** none
- **Files:** `rbp/commands/quick-plan.md` (new), `rbp/install.sh` (modified)
- **Acceptance:** Copy quick-plan.md to rbp/commands/, install.sh copies to .claude/commands/
- **Tests:** After install, /quick-plan command works

### Task 9: Add Observability Config to rbp-config.yaml
- **ID:** obs-009
- **Dependencies:** none
- **Files:** `rbp/templates/rbp-config.yaml`
- **Acceptance:** Add observability section with enabled, auto_launch, pai_install_check flags
- **Tests:** Verify config file valid YAML, flags respected by scripts

### Task 10: Update README with PAI Requirement
- **ID:** obs-010
- **Dependencies:** none
- **Files:** `rbp/README.md`
- **Acceptance:** Add Requirements section with PAI install link, add Observability section
- **Tests:** Manual review - README clear and accurate

### Task 11: End-to-End Integration Test
- **ID:** obs-011
- **Dependencies:** obs-003, obs-004, obs-005, obs-006
- **Files:** N/A (testing only)
- **Acceptance:** Run full workflow (install → /rbp:start → tasks execute → dashboard shows events)
- **Tests:** Follow integration test checklist from Testing Strategy section

<!-- RBP-TASKS-END -->

### Test Command

```bash
# Integration test (manual)
# See "Integration Test (Primary)" section above for full checklist

# Event emission validation (automated)
cd rbp/scripts && ./emit-event.sh "RBP:TaskStart" '{"iteration":1,"task_id":"test-001"}' && tail -1 ~/.claude/history/raw-outputs/$(date +%Y-%m)/$(date +%Y-%m-%d)_all-events.jsonl | jq '.'
```

---

**End of Specification**

**Status:** ✅ Ready for Implementation - Zero Open Questions
