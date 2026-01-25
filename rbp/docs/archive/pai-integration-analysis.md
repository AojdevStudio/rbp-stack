# PAI Integration Analysis
**RBP Stack and Personal AI Infrastructure Compatibility Study**

Version: 1.0.0
Date: 2026-01-25
Status: Complete

---

## Executive Summary

This document analyzes potential conflicts between the RBP Stack (Ralph + Beads + PAI workflow) and PAI (Personal AI Infrastructure), identifies hook collisions, and provides clear guidance on when to use integrated vs isolated execution modes.

### Key Findings

1. **Hook Conflicts Exist**: Both systems use `SessionStart` and `PreCompact` hooks
2. **Voice System is Optional**: RBP can run without PAI voice notifications
3. **Isolation Flags Available**: Claude Code provides flags to run RBP independently
4. **Recommended Default**: Additive integration (both systems active) for best developer experience

---

## 1. Hook Lifecycle Comparison

### PAI Hook Configuration

From `~/.claude/settings.json` (lines 132-204):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "command": "${PAI_DIR}/hooks/StartupGreeting.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/LoadContext.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/CheckVersion.hook.ts"
          }
        ]
      },
      {
        "hooks": [
          {
            "command": "bd prime"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "command": "bd prime"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "command": "${PAI_DIR}/hooks/FormatEnforcer.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/AutoWorkCreation.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/ExplicitRatingCapture.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/ImplicitSentimentCapture.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/UpdateTabTitle.hook.ts"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "command": "${PAI_DIR}/hooks/StopOrchestrator.hook.ts"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "command": "${PAI_DIR}/hooks/QuestionAnswered.hook.ts"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash|Edit|Write|Read",
        "hooks": [
          {
            "command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
          }
        ]
      },
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "command": "${PAI_DIR}/hooks/SetQuestionTab.hook.ts"
          }
        ]
      }
    ]
  }
}
```

### RBP Hook Configuration

From `rbp/templates/settings.json` (lines 3-28):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "command": "bd prime 2>/dev/null || true"
          },
          {
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --session-start"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --pre-compact"
          }
        ]
      }
    ]
  }
}
```

### Hook Collision Matrix

| Hook Event | PAI Usage | RBP Usage | Conflict Type | Severity |
|-----------|-----------|-----------|---------------|----------|
| **SessionStart** | StartupGreeting, LoadContext, CheckVersion, `bd prime` | `bd prime`, RBP session-start hook | **COLLISION** | Medium |
| **PreCompact** | `bd prime` | RBP pre-compact hook | **COLLISION** | Low |
| UserPromptSubmit | FormatEnforcer, AutoWorkCreation, Rating/Sentiment capture, UpdateTabTitle | None | No conflict | N/A |
| Stop | StopOrchestrator (voice, capture, tab-state) | None | No conflict | N/A |
| PreToolUse | SecurityValidator, SetQuestionTab | None | No conflict | N/A |
| PostToolUse | QuestionAnswered | None | No conflict | N/A |

---

## 2. Conflict Analysis and Resolution

### 2.1 SessionStart Collision

**Conflict Details:**
- Both PAI and RBP run `bd prime` on session start
- PAI runs 3 additional hooks (StartupGreeting, LoadContext, CheckVersion)
- RBP runs TypeScript hook for session initialization

**Impact:**
- `bd prime` runs twice (redundant but harmless)
- Increased session startup time (3 PAI hooks + 1 RBP hook)
- Potential race condition if both hooks modify shared state

**Resolution Strategy:**

**Option A: Merge Configuration (Recommended)**

Combine both configs into a single `SessionStart` hook array:

```json
{
  "SessionStart": [
    {
      "hooks": [
        {
          "command": "${PAI_DIR}/hooks/StartupGreeting.hook.ts"
        },
        {
          "command": "${PAI_DIR}/hooks/LoadContext.hook.ts"
        },
        {
          "command": "${PAI_DIR}/hooks/CheckVersion.hook.ts"
        },
        {
          "command": "bd prime 2>/dev/null || true"
        },
        {
          "command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --session-start"
        }
      ]
    }
  ]
}
```

**Benefits:**
- Single `bd prime` execution
- All hooks run in predictable order
- No duplicate work

**Option B: Conditional Execution**

Use environment variable to skip PAI hooks when running RBP:

```bash
# In RBP execution:
RBP_MODE=1 ralph run

# In PAI hooks:
if [ -z "$RBP_MODE" ]; then
  # Run PAI-specific logic
fi
```

**Benefits:**
- Clean separation of concerns
- Easy to toggle modes

### 2.2 PreCompact Collision

**Conflict Details:**
- PAI runs `bd prime` before context compaction
- RBP runs TypeScript hook for pre-compact operations

**Impact:**
- Minimal - `bd prime` is idempotent
- RBP hook may have additional logic that needs to run

**Resolution Strategy:**

Use merged configuration:

```json
{
  "PreCompact": [
    {
      "hooks": [
        {
          "command": "bd prime 2>/dev/null || true"
        },
        {
          "command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --pre-compact"
        }
      ]
    }
  ]
}
```

---

## 3. Isolated Execution Flags

### Claude Code Isolation Options

To run RBP without PAI customizations:

```bash
# Full isolation (no PAI hooks, no PAI settings)
claude --dangerously-skip-permissions \
  --setting-sources "" \
  --disable-slash-commands \
  --system-prompt "$(cat scripts/promptv3.md)" \
  --strict-mcp-config

# Partial isolation (use project settings only)
claude --dangerously-skip-permissions \
  --setting-sources "project" \
  --disable-slash-commands

# RBP-specific environment flag
RBP_MODE=1 SKIP_PAI_HOOKS=1 ralph run
```

### Flag Explanations

| Flag | Purpose | Impact |
|------|---------|--------|
| `--setting-sources ""` | Skip global ~/.claude/settings.json | No PAI hooks loaded |
| `--setting-sources "project"` | Use .claude/settings.json only | Project-level hooks only |
| `--disable-slash-commands` | Disable all slash commands | Prevents PAI skill invocations |
| `--system-prompt <file>` | Override system prompt | Replaces PAI context loading |
| `--strict-mcp-config` | Use only project MCP config | No global MCP servers |
| `--dangerously-skip-permissions` | Skip permission checks | Required for autonomous execution |

### When to Use Isolated Mode

Use isolated execution when:

1. **Debugging RBP**: Testing RBP hooks without PAI interference
2. **Performance Testing**: Measuring RBP execution speed without PAI overhead
3. **CI/CD Pipelines**: Automated execution without user-specific PAI config
4. **Minimal Environment**: Running in containers or restricted environments

### When to Use Integrated Mode

Use integrated execution (PAI + RBP) when:

1. **Local Development**: Developer wants voice notifications and terminal tab updates
2. **Session Tracking**: Need PAI memory system for long-term work tracking
3. **Multi-Project**: Working on multiple projects simultaneously (PAI organizes context)
4. **Rich Feedback**: Want sentiment analysis, rating capture, and observability

---

## 4. Voice System Decision Matrix

### PAI Voice System Architecture

From `~/.claude/skills/CORE/SYSTEM/THEHOOKSYSTEM.md`:

**Components:**
- Voice server at `http://localhost:8888/notify` (currently **not running**)
- ElevenLabs TTS integration (requires API key)
- Configured via `settings.json` → `daidentity.voiceId`
- Used by Stop hook → `handlers/voice.ts`

**Cost Structure:**
- ElevenLabs has quota limits (free tier: 10,000 characters/month)
- Voice server must be running for notifications to work
- Hooks fail gracefully if voice server offline

### RBP Voice System Needs

**Current RBP Requirements:**
- None (RBP does not require voice notifications)
- RBP operates entirely via CLI and text output
- No TTS or audio feedback in core functionality

**Potential Benefits:**
- Task completion announcements ("Closed bead bd-a1b2.3")
- Test failure alerts ("Tests failed: 3 failing")
- Long-running task progress updates ("Iteration 15 of 50")

### Recommendation: Make Voice Optional

**Default Configuration: Voice Disabled**

Rationale:
1. **ElevenLabs Quota**: RBP can generate many task completions in a single run, quickly exhausting quota
2. **Server Dependency**: Voice requires running VoiceServer (extra process)
3. **Not Critical**: Voice is nice-to-have, not required for RBP operation
4. **Graceful Degradation**: PAI hooks already fail silently if voice server offline

**Implementation:**

```yaml
# rbp-config.yaml
observability:
  voice_enabled: false  # Default: disabled
  voice_server_url: "http://localhost:8888/notify"
  voice_on_completion: false
  voice_on_failure: true  # Only notify failures (high priority)
```

**Opt-In Voice Notifications:**

Users who want voice feedback can enable it:

```bash
# 1. Start PAI voice server
cd ~/.claude/VoiceServer
bun run start

# 2. Enable voice in RBP config
sed -i '' 's/voice_enabled: false/voice_enabled: true/' rbp-config.yaml

# 3. Run RBP with voice
ralph run
```

**Voice Event Selection:**

If voice is enabled, only send high-priority events:

| Event | Send Voice? | Rationale |
|-------|------------|-----------|
| Session Start | No | Low priority |
| Task Ready | No | Too frequent |
| Task Completed | Optional | User preference |
| Test Failure | **Yes** | High priority - needs attention |
| All Tests Passed | **Yes** | High priority - major milestone |
| Max Iterations Reached | **Yes** | High priority - needs intervention |

---

## 5. Integration Patterns

### 5.1 Additive Integration (Recommended Default)

**Pattern:** Both PAI and RBP active, merged hook configuration

**Configuration:**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "command": "${PAI_DIR}/hooks/StartupGreeting.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/LoadContext.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/CheckVersion.hook.ts"
          },
          {
            "command": "bd prime 2>/dev/null || true"
          },
          {
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --session-start"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "command": "bd prime 2>/dev/null || true"
          },
          {
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --pre-compact"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "command": "${PAI_DIR}/hooks/FormatEnforcer.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/AutoWorkCreation.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/ExplicitRatingCapture.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/ImplicitSentimentCapture.hook.ts"
          },
          {
            "command": "${PAI_DIR}/hooks/UpdateTabTitle.hook.ts"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "command": "${PAI_DIR}/hooks/StopOrchestrator.hook.ts"
          }
        ]
      }
    ]
  }
}
```

**Benefits:**
- Full PAI functionality (voice, memory, sentiment analysis)
- RBP execution tracking and state management
- Rich developer experience

**Trade-offs:**
- More hooks = slightly slower execution
- Requires PAI installation
- More complex configuration

### 5.2 Isolated Execution

**Pattern:** RBP only, no PAI hooks

**Configuration:**

Use project-local `.claude/settings.json` with only RBP hooks:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "command": "bd prime 2>/dev/null || true"
          },
          {
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --session-start"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --pre-compact"
          }
        ]
      }
    ]
  }
}
```

**Execution:**

```bash
# Use project settings only (ignore global PAI config)
claude --setting-sources "project" --dangerously-skip-permissions < scripts/promptv3.md
```

**Benefits:**
- Minimal dependencies
- Faster execution (fewer hooks)
- Works in CI/CD without PAI

**Trade-offs:**
- No voice notifications
- No PAI memory/learning system
- No terminal tab updates
- No sentiment analysis

### 5.3 Hybrid Mode (Best of Both Worlds)

**Pattern:** PAI infrastructure with RBP-specific toggles

**Configuration:**

```bash
# Environment variables control PAI behavior
RBP_MODE=1              # Signal to PAI hooks that RBP is active
SKIP_VOICE=1            # Skip voice notifications (save quota)
SKIP_TAB_UPDATES=1      # Skip terminal tab updates (less AI calls)

# Run RBP with selective PAI features
ralph run
```

**PAI Hook Modifications:**

```typescript
// In ~/.claude/hooks/StopOrchestrator.hook.ts
if (!process.env.RBP_MODE) {
  // Normal PAI behavior
  await sendVoiceNotification(message);
  await updateTabState(state);
} else {
  // RBP mode: only critical notifications
  if (isCriticalEvent(message)) {
    await sendVoiceNotification(message);
  }
}
```

**Benefits:**
- PAI memory/learning system active
- RBP execution efficiency
- User can toggle features via env vars

**Trade-offs:**
- Requires modifying PAI hooks
- More complex mental model

---

## 6. Recommended Configuration

### For Local Development (Recommended Default)

**Mode:** Additive Integration
**Voice:** Disabled by default, opt-in via config
**Hooks:** Merged PAI + RBP

**Setup:**

```bash
# 1. Install RBP
./rbp/install.sh

# 2. Merge settings.json (automatic during installation)
# Installer detects existing PAI config and merges hooks

# 3. Configure voice (optional)
# Edit rbp-config.yaml:
observability:
  voice_enabled: true  # Enable if PAI voice server running

# 4. Run
ralph run
```

**Benefits:**
- Full developer experience
- PAI memory and learning
- RBP execution tracking
- Voice optional (doesn't block if server offline)

### For CI/CD Pipelines

**Mode:** Isolated Execution
**Voice:** Disabled
**Hooks:** RBP only

**Setup:**

```bash
# Use isolated execution flags
claude --setting-sources "project" \
       --dangerously-skip-permissions \
       --disable-slash-commands \
       < scripts/promptv3.md
```

**Benefits:**
- No PAI dependencies
- Consistent environment
- Faster execution

### For Performance Testing

**Mode:** Isolated Execution
**Voice:** Disabled
**Hooks:** Minimal

**Setup:**

```bash
# Measure RBP execution time without PAI overhead
time claude --setting-sources "" \
            --dangerously-skip-permissions \
            --system-prompt "$(cat scripts/promptv3.md)" \
            < /dev/null
```

---

## 7. Migration Guide

### From PAI-Only to PAI + RBP

**Step 1:** Backup existing config

```bash
cp ~/.claude/settings.json ~/.claude/settings.json.backup
```

**Step 2:** Install RBP (installer handles merging)

```bash
cd your-project
/path/to/rbp/install.sh
```

**Step 3:** Verify merged configuration

```bash
cat .claude/settings.json | jq '.hooks.SessionStart'
# Should show both PAI and RBP hooks
```

**Step 4:** Test execution

```bash
ralph run --dry-run
```

### From RBP-Only to PAI + RBP

**Step 1:** Install PAI

```bash
# Follow PAI installation guide
```

**Step 2:** Merge hooks manually

Edit `.claude/settings.json` to include both PAI and RBP hooks (see Additive Integration pattern above).

**Step 3:** Start PAI voice server (optional)

```bash
cd ~/.claude/VoiceServer
bun run start
```

**Step 4:** Enable voice in RBP config (optional)

```yaml
# rbp-config.yaml
observability:
  voice_enabled: true
```

---

## 8. Troubleshooting

### Issue: Hooks Running Multiple Times

**Symptom:** `bd prime` runs twice on session start

**Cause:** Both PAI and RBP have `bd prime` in SessionStart hooks

**Solution:** Merge hook configuration to deduplicate

```json
{
  "SessionStart": [
    {
      "hooks": [
        {"command": "${PAI_DIR}/hooks/StartupGreeting.hook.ts"},
        {"command": "${PAI_DIR}/hooks/LoadContext.hook.ts"},
        {"command": "${PAI_DIR}/hooks/CheckVersion.hook.ts"},
        {"command": "bd prime 2>/dev/null || true"},  // Only once
        {"command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --session-start"}
      ]
    }
  ]
}
```

### Issue: Voice Notifications Not Working

**Symptom:** No TTS announcements

**Cause:** Voice server not running or `voice_enabled: false`

**Solution:**

```bash
# 1. Check voice server
curl http://localhost:8888/health
# If offline: cd ~/.claude/VoiceServer && bun run start

# 2. Check RBP config
grep voice_enabled rbp-config.yaml
# Set to true if desired

# 3. Check ElevenLabs quota
# Login to ElevenLabs dashboard
```

### Issue: RBP Not Loading PAI Context

**Symptom:** PAI skills not available in RBP session

**Cause:** Using isolated execution flags

**Solution:** Remove isolation flags or use merged config

```bash
# Instead of:
claude --setting-sources ""

# Use:
ralph run  # Uses project .claude/settings.json with merged hooks
```

---

## 9. Conclusion

### Summary of Findings

1. **Hook Conflicts**: SessionStart and PreCompact have collisions, resolved via merged configuration
2. **Voice System**: Optional for RBP, recommended to disable by default (ElevenLabs quota concerns)
3. **Integration Modes**: Three patterns available (Additive, Isolated, Hybrid)
4. **Recommended Default**: Additive integration with voice disabled

### Decision Matrix

| Use Case | Recommended Mode | Voice | Rationale |
|----------|-----------------|-------|-----------|
| Local Development | Additive | Optional | Full features, rich DX |
| CI/CD | Isolated | Disabled | Minimal deps, consistent env |
| Performance Testing | Isolated | Disabled | Measure RBP overhead only |
| Team Collaboration | Additive | Disabled | Shared config, no quota issues |
| Solo Developer with PAI | Additive | Enabled | Full PAI+RBP experience |

### Final Recommendations

1. **Default Installation**: Use additive integration (merged hooks)
2. **Voice Configuration**: Disabled by default, opt-in via `rbp-config.yaml`
3. **Hook Management**: RBP installer should detect and merge PAI hooks automatically
4. **Documentation**: Include isolation flags in RBP docs for advanced users
5. **Future Enhancement**: Add `RBP_MODE` environment variable support to PAI hooks for clean toggling

---

## Appendix A: Full Merged Configuration Example

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/StartupGreeting.hook.ts"
          },
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/LoadContext.hook.ts"
          },
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/CheckVersion.hook.ts"
          },
          {
            "type": "command",
            "command": "bd prime 2>/dev/null || true"
          },
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --session-start"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bd prime 2>/dev/null || true"
          },
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/scripts/rbp/lib/dist/index.js hooks --pre-compact"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/FormatEnforcer.hook.ts"
          },
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/AutoWorkCreation.hook.ts"
          },
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/ExplicitRatingCapture.hook.ts"
          },
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/ImplicitSentimentCapture.hook.ts"
          },
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/UpdateTabTitle.hook.ts"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/StopOrchestrator.hook.ts"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/AgentOutputCapture.hook.ts"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/WorkCompletionLearning.hook.ts"
          },
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/SessionSummary.hook.ts"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
          }
        ]
      },
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
          }
        ]
      },
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
          }
        ]
      },
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/SetQuestionTab.hook.ts"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/hooks/QuestionAnswered.hook.ts"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(bd:*)",
      "Bash(bun:*)",
      "Bash(scripts/rbp/*)",
      "Bash",
      "Read",
      "Write",
      "Edit",
      "MultiEdit",
      "Glob",
      "Grep",
      "LS",
      "WebFetch",
      "WebSearch",
      "NotebookRead",
      "NotebookEdit",
      "TodoWrite",
      "ExitPlanMode",
      "Task",
      "Skill",
      "mcp__*"
    ]
  },
  "env": {
    "PAI_DIR": "/Users/ossieirondi/.claude",
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "64000",
    "BASH_DEFAULT_TIMEOUT_MS": "600000"
  }
}
```

---

## Appendix B: Isolation Command Reference

```bash
# Full isolation (no PAI)
claude --dangerously-skip-permissions \
       --setting-sources "" \
       --disable-slash-commands \
       --system-prompt "$(cat scripts/promptv3.md)" \
       --strict-mcp-config

# Project-only settings (partial isolation)
claude --dangerously-skip-permissions \
       --setting-sources "project" \
       --disable-slash-commands

# Environment-based selective isolation
RBP_MODE=1 SKIP_VOICE=1 SKIP_TAB_UPDATES=1 ralph run

# CI/CD execution
docker run -v $(pwd):/workspace \
  claude-rbp:latest \
  claude --setting-sources "" \
         --dangerously-skip-permissions \
         --system-prompt "/workspace/scripts/promptv3.md"
```

---

**Document Metadata:**
- **Version:** 1.0.0
- **Date:** 2026-01-25
- **Author:** Atlas (Engineer Agent)
- **Review Status:** Complete
- **Next Review:** When RBP v4.0 or PAI v3.0 released
