# Observability Architecture Review

**Date:** 2026-01-16
**Reviewer:** Obi
**Status:** 🔴 MISMATCH DETECTED - Requires Fix

## Summary

The RBP observability integration spec references an **outdated PAI architecture**. The actual observability system has moved from the skills-based structure to a standalone directory.

---

## Architectural Mismatch

### ❌ Spec Assumptions (Outdated)

From `rbp/specs/rbp-observability-integration.md`:

```bash
# Spec assumes:
~/.claude/skills/Observability/manage.sh  # WRONG PATH
```

**Issues:**
- Line 123: "Execute `~/.claude/skills/Observability/manage.sh start`"
- Line 154: Checks `~/.claude/skills/Observability/` directory
- Assumes observability is part of PAI "skills" system

### ✅ Actual Architecture (Current)

```bash
# Real structure:
~/.claude/observability/
├── manage.sh              # Management script (start|stop|status)
├── apps/
│   ├── server/           # Port 4000 - WebSocket + health endpoint
│   └── client/           # Port 5172 - Vue dashboard
├── logs/
│   ├── server.log
│   └── client.log
├── .server.pid           # Current: 93858
└── .client.pid           # Current: 7071
```

**Actual Commands:**
```bash
~/.claude/observability/manage.sh start          # Start both services
~/.claude/observability/manage.sh status         # Check running state
~/.claude/observability/manage.sh stop           # Stop services
curl http://localhost:4000/health               # Health check
```

**Running Now:**
```
Server: http://localhost:4000 (PID 93858)
Client: http://localhost:5172 (PID 7071)
Dashboard: http://localhost:5172
```

---

## Code Issues Found

### 1. install.sh - Wrong Path Check

**File:** `rbp/install.sh:79-95`

```bash
# WRONG: Checks for PAI CORE, not Observability
if [ -d "$HOME/.claude/skills/CORE" ]; then
  print_success "PAI CORE found"
else
  echo "PAI Observability not found..."  # ← Misleading message
```

**Problem:**
- Checks `~/.claude/skills/CORE` (PAI identity system)
- Warning says "PAI Observability not found" (wrong!)
- Should check `~/.claude/observability/`

**Impact:** Install completes but warns about missing observability even when it's running.

### 2. Spec References Outdated Paths

**File:** `rbp/specs/rbp-observability-integration.md`

Lines referencing wrong paths:
- Line 123: "Execute `~/.claude/skills/Observability/manage.sh start`"
- Line 154: "If PAI is not found at `~/.claude/skills/Observability/`"
- Line 422: Duplicate path reference

**Impact:** Users following spec will look in wrong directory.

---

## Fix Required

### Update install.sh Check

**Replace lines 79-95 with:**

```bash
# Check for PAI Observability (optional but recommended)
echo ""
print_step "Checking optional dependencies..."

if [ -f "$HOME/.claude/observability/manage.sh" ]; then
  print_success "PAI Observability found"

  # Check if it's running
  if curl -s http://localhost:4000/health 2>/dev/null | grep -q "ok"; then
    print_success "Observability dashboard is running at http://localhost:5172"
  else
    echo -e "  ${YELLOW}Observability installed but not running${NC}"
    echo -e "  ${CYAN}Start with: ~/.claude/observability/manage.sh start${NC}"
  fi
else
  echo -e "  ${YELLOW}PAI Observability not found - observability features will be limited${NC}"
  echo -e "  ${YELLOW}Install PAI for real-time monitoring:${NC}"
  echo -e "  ${CYAN}https://github.com/danielmiessler/Personal_AI_Infrastructure.git${NC}"
  echo ""
  read -p "  Continue without PAI? (y/n): " choice
  if [ "$choice" != "y" ] && [ "$choice" != "Y" ]; then
    echo -e "${YELLOW}Installation cancelled. Install PAI first.${NC}"
    exit 1
  fi
fi

echo ""
```

**Benefits:**
1. ✅ Checks correct path (`~/.claude/observability/`)
2. ✅ Detects if observability is running via health check
3. ✅ Provides correct command to start it
4. ✅ Clear messaging about what's missing

---

## Event Flow (Already Correct)

The **good news**: The actual event emission is correct!

```
RBP Scripts (emit-event.sh)
  ↓ Writes JSONL events
  ↓ ~/.claude/history/raw-outputs/2026-01/2026-01-16_all-events.jsonl
  ↓
PAI Hooks (capture-all-events.ts)
  ↓ Watches file for new events
  ↓ Broadcasts via WebSocket
  ↓
Observability Server (localhost:4000)
  ↓ Receives events
  ↓ Streams to client
  ↓
Dashboard (localhost:5172)
  ✓ Displays RBP events in real-time
```

**Why it works:**
- `emit-event.sh` writes to correct location
- PAI hooks watch `~/.claude/history/raw-outputs/`
- Observability server is running and connected
- No changes needed to event emission logic

---

## Testing Checklist

After fixing install.sh:

```bash
# 1. Verify observability detection
./rbp/install.sh .
# Expected: "✓ PAI Observability found"

# 2. Test event emission
source rbp/scripts/emit-event.sh
emit_task_start 1 "test-001" "Test Task"

# 3. Verify event in JSONL
tail -1 ~/.claude/history/raw-outputs/$(date +%Y-%m)/$(date +%Y-%m-%d)_all-events.jsonl | jq '.'

# 4. Check dashboard shows event
# Open: http://localhost:5172
# Expected: See RBP:TaskStart event appear
```

---

## Recommended Actions

1. **IMMEDIATE:** Update `rbp/install.sh` to check correct observability path
2. **DOCUMENTATION:** Update spec to reference `~/.claude/observability/`
3. **VALIDATION:** Add test that verifies observability integration
4. **MONITORING:** Create script to verify dashboard is running before RBP starts

---

## Current Status

✅ **Working:**
- Event emission (`emit-event.sh`)
- Event file location (`~/.claude/history/raw-outputs/`)
- Dashboard running (localhost:5172)
- Server health endpoint (localhost:4000/health)

❌ **Broken:**
- Install script path check (checks wrong directory)
- Spec documentation (references old paths)

🟡 **Needs Verification:**
- RBP scripts auto-launch behavior
- Browser open on `/rbp:start`
- Headless environment detection

---

**Priority:** HIGH - Fix install.sh before next user installation
**Effort:** LOW - Single file update (install.sh lines 79-95)
**Risk:** LOW - Change only affects install-time checks, not runtime behavior
