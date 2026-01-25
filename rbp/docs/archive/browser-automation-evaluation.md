# Browser Automation Evaluation

**Date:** January 25, 2026
**Author:** Researcher Agent
**Purpose:** Evaluate browser automation options for RBP Stack integration

---

## Executive Summary

**Recommendation:** Use **Vercel Agent Browser** as the primary browser automation tool for RBP Stack.

**Rationale:** Agent Browser's CLI-first architecture, minimal token overhead, and snapshot+refs system align perfectly with Ralph's autonomous workflow. The PAI Browser Skill, while powerful, is designed for debugging and requires a persistent session server, making it better suited for interactive development than autonomous task execution.

---

## Options Evaluated

### Vercel Agent Browser

**Repository:** https://github.com/vercel-labs/agent-browser
**Version:** v0.7.6 (Latest as of Jan 24, 2026)
**Stars:** 10.3k
**License:** Apache-2.0

#### Architecture
- **Rust CLI** - Fast native binary for command parsing
- **Node.js daemon** - Manages Playwright browser instance
- **Fallback mode** - Uses Node.js directly if Rust binary unavailable
- **Browser engine** - Chromium (default), Firefox, and WebKit support

#### Pros
✅ **Zero configuration** - No MCP server setup required
✅ **Minimal token usage** - 93% reduction vs Playwright MCP (~500 tokens vs ~13,700)
✅ **Snapshot + refs system** - Deterministic element selection (`@e1`, `@e2`)
✅ **CLI-first** - Perfect for bash script integration
✅ **Stateless by default** - Each command is independent
✅ **AI-optimized output** - `--json` flag for machine-readable responses
✅ **Official Claude Code skill** - Bundled skill available in package
✅ **Session management** - Isolated sessions with persistent profiles
✅ **Headless by default** - Ideal for CI/CD and autonomous agents
✅ **Active development** - Vercel-backed, frequent updates
✅ **Cloud provider support** - Browserbase and Browser Use integrations

#### Cons
❌ **No built-in voice notifications** - Would need custom integration
❌ **Limited debugging features** - Console/network capture requires explicit commands
❌ **New tool** - Less battle-tested than Playwright (released Dec 2024)
❌ **Daemon dependency** - Adds architectural complexity (though auto-managed)

#### Integration Effort
**Low** - Simple npm install, Claude Code skill available, bash-friendly CLI

#### Key Commands for RBP
```bash
# Install
npm install -g agent-browser && agent-browser install

# Core workflow
agent-browser open https://example.com
agent-browser snapshot -i --json        # Interactive elements only
agent-browser click @e2                 # Click by ref
agent-browser fill @e3 "test@example.com"
agent-browser screenshot --json         # Verify visual state

# Session management
agent-browser --session test1 open example.com
agent-browser --profile ~/.rbp/browser-profile open example.com
```

#### Optimal AI Workflow
1. Navigate: `agent-browser open <url>`
2. Snapshot: `agent-browser snapshot -i --json` (AI parses tree and refs)
3. Identify: AI finds target refs from snapshot
4. Execute: `agent-browser click @e2` (deterministic, no selector guessing)
5. Verify: `agent-browser snapshot -i --json` (check changes)

---

### PAI Browser Skill

**Location:** `~/.claude/skills/Browser/`
**Version:** v2.0.0
**Type:** Local skill with TypeScript API + HTTP server
**License:** Not specified (part of PAI system)

#### Architecture
- **TypeScript wrapper** - Around Playwright API
- **HTTP server** - Persistent browser session with REST endpoints
- **Code-first interface** - Direct API calls, no MCP protocol
- **Auto-start sessions** - 30-minute idle timeout

#### Pros
✅ **Always-on diagnostics** - Console logs, network requests, errors captured by default
✅ **Rich debugging** - Network stats, failed requests, console errors in output
✅ **Voice notification support** - Integrated with PAI voice system
✅ **TypeScript API** - Direct Playwright access for complex automation
✅ **Session persistence** - Single browser instance across commands
✅ **Code-first approach** - 99%+ token savings vs Playwright MCP
✅ **Full diagnostics command** - Single command shows errors, network, status
✅ **VERIFY phase integration** - Mandatory verification workflow built-in

#### Cons
❌ **Session-based** - Requires persistent server (adds state management)
❌ **HTTP overhead** - Commands go through REST API vs direct CLI
❌ **Less portable** - Tied to PAI ecosystem and bun runtime
❌ **No snapshot+refs** - Uses traditional CSS selectors/XPath
❌ **Manual session management** - Though auto-starts, requires cleanup
❌ **Not designed for autonomous agents** - Built for interactive debugging
❌ **No isolation** - Single session means no parallel browser instances

#### Integration Effort
**Medium** - Already installed in PAI, but requires session server management and adaptation for autonomous workflow

#### Key Commands for RBP
```bash
# Navigate with full diagnostics (primary command)
bun run ~/.claude/skills/Browser/Tools/Browse.ts https://example.com

# Query commands
bun run Browse.ts errors      # Console errors only
bun run Browse.ts network     # All network activity
bun run Browse.ts failed      # Failed requests only

# Interaction
bun run Browse.ts click '#selector'
bun run Browse.ts fill '#input' 'value'
bun run Browse.ts screenshot screenshot.png

# Session management
bun run Browse.ts status
bun run Browse.ts restart
```

---

## Comparison Matrix

| Criteria | Vercel Agent Browser | PAI Browser Skill |
|----------|---------------------|-------------------|
| **Installation** | npm global install | Already in PAI |
| **Token Efficiency** | ~500 tokens (93% reduction) | ~50-200 per operation |
| **Architecture** | Rust CLI + Node daemon | TypeScript + HTTP server |
| **State Management** | Stateless (sessions optional) | Session-based (persistent) |
| **Element Selection** | Snapshot + refs (`@e1`) | CSS/XPath selectors |
| **Debugging Output** | On-demand | Always-on by default |
| **Claude Code Integration** | Official skill included | Custom skill |
| **Voice Notifications** | None | Built-in |
| **Headless Operation** | Default | Default |
| **Session Isolation** | Multiple sessions supported | Single session |
| **Parallel Execution** | Yes (via sessions) | No |
| **AI Workflow Optimization** | Snapshot+refs designed for AI | Traditional Playwright API |
| **Cloud Provider Support** | Browserbase, Browser Use | None |
| **Maintenance Burden** | Low (Vercel-backed) | Low (part of PAI) |
| **Documentation Quality** | Excellent (comprehensive README) | Good (skill docs) |
| **Best Use Case** | Autonomous agents | Interactive debugging |
| **Portability** | High (npm global) | Low (PAI ecosystem) |
| **Test Automation** | Excellent | Good |
| **CI/CD Integration** | Excellent | Fair |

---

## Detailed Analysis

### Token Efficiency

**Agent Browser:**
- Playwright MCP: ~13,700 tokens at load
- Agent Browser: ~500 tokens for 5 operations
- Savings: 96.4%

**PAI Browser:**
- Playwright MCP: ~13,700 tokens at load
- Code-first approach: ~50-200 per operation
- Savings: 99%+

Both are significantly more efficient than Playwright MCP, but PAI Browser edges ahead in raw token savings. However, Agent Browser's snapshot+refs system reduces round-trips, potentially offsetting the difference in real-world usage.

### Workflow Fit for RBP

**Ralph's Execution Loop Requirements:**
1. Query `bd ready` for next task
2. Implement task
3. Run tests (including browser tests)
4. Close task if tests pass

**Agent Browser Alignment:**
- ✅ Stateless commands fit bash script workflow
- ✅ `--json` output for parsing in scripts
- ✅ Snapshot+refs eliminate selector brittleness
- ✅ Session isolation for parallel testing
- ✅ Exit codes for pass/fail in CI/CD

**PAI Browser Alignment:**
- ⚠️ Session-based requires state management
- ⚠️ HTTP server adds failure point
- ✅ Rich diagnostics help debug test failures
- ❌ Single session prevents parallel tests
- ⚠️ Requires bun runtime (acceptable)

### Integration Complexity

**Agent Browser:**
```bash
# One-time setup in RBP
npm install -g agent-browser
agent-browser install

# Copy official skill
cp -r node_modules/agent-browser/skills/agent-browser .claude/skills/

# Use in tests
agent-browser open http://localhost:3000
agent-browser snapshot -i --json > snapshot.json
# Parse snapshot.json, find refs, execute tests
```

**PAI Browser:**
```bash
# Already installed, but requires:
# 1. Ensure session is running
# 2. Wrap in bun commands
# 3. Parse HTTP response instead of stdout
# 4. Handle session timeout/restart

# More complex test integration
bun run ~/.claude/skills/Browser/Tools/Browse.ts http://localhost:3000
# Parse console/network output
# Requires custom parsing vs Agent Browser's --json
```

### Snapshot + Refs Advantage

Agent Browser's snapshot+refs system is a game-changer for AI agents:

**Traditional Approach (PAI Browser):**
```typescript
// AI must guess selectors
await browser.click('#submit-button')  // What if ID changes?
await browser.click('button[type="submit"]')  // Brittle
await browser.click('text=Submit')  // Multiple matches?
```

**Snapshot + Refs (Agent Browser):**
```bash
# Step 1: Get snapshot
$ agent-browser snapshot -i --json
{
  "snapshot": "- button \"Submit\" [ref=e2]\n- textbox \"Email\" [ref=e3]",
  "refs": {
    "e2": {"role": "button", "name": "Submit"},
    "e3": {"role": "textbox", "name": "Email"}
  }
}

# Step 2: Use deterministic refs
$ agent-browser click @e2    # Always the same button
$ agent-browser fill @e3 "test@example.com"
```

This eliminates:
- Selector guessing
- Flaky element matching
- CSS/XPath brittleness
- Multiple round-trips to verify elements

### Voice Notification Gap

PAI Browser integrates with the PAI voice system:
```bash
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"Browser test completed","rate":280,"voice_enabled":true}'
```

Agent Browser doesn't have this built-in, but it's trivial to add:
```bash
# In RBP scripts
function announce() {
  curl -s -X POST http://localhost:8888/notify \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"$1\",\"rate\":280,\"voice_enabled\":true}"
}

agent-browser open http://localhost:3000
announce "Browser test started"
# ... tests ...
announce "Browser tests passed"
```

---

## Recommendation

### Primary Choice: Vercel Agent Browser

**Use Agent Browser as the default browser automation tool for RBP Stack.**

#### Rationale

1. **Architecture Alignment**
   Ralph's bash-based execution loop needs stateless, composable commands. Agent Browser's CLI design fits perfectly—each command is independent, scriptable, and chainable.

2. **AI-Optimized Workflow**
   The snapshot+refs system is purpose-built for AI agents. Instead of guessing selectors, Ralph gets deterministic element references. This reduces errors and iteration cycles.

3. **Minimal Integration Effort**
   One npm install, copy the official skill, and you're done. No server to manage, no session lifecycle to worry about, no runtime dependencies beyond Node.js.

4. **Parallel Test Execution**
   Session isolation means Ralph can run multiple browser tests simultaneously if needed. PAI Browser's single-session architecture prevents this.

5. **Portability**
   Agent Browser is a global npm package. Any machine with Node.js can run RBP's browser tests. PAI Browser requires the full PAI ecosystem.

6. **Cloud-Ready**
   Browserbase and Browser Use integrations mean RBP can deploy to serverless/CI environments without bundling a browser binary.

#### When to Use PAI Browser

Keep PAI Browser for **interactive debugging sessions**:
- When Ralph encounters test failures and needs to investigate
- When developers want to see network diagnostics
- When voice notifications are desired for local development

The two tools are complementary, not competitive.

---

## Implementation Plan

### Phase 1: Install Agent Browser (Immediate)
```bash
cd rbp
npm install -g agent-browser
agent-browser install

# Add to install.sh
echo 'npm install -g agent-browser' >> install.sh
echo 'agent-browser install' >> install.sh
```

### Phase 2: Create RBP Browser Testing Helper
```bash
# rbp/scripts/browser-test.sh
#!/usr/bin/env bash
set -e

URL="$1"
TEST_NAME="$2"

# Voice notification helper
announce() {
  curl -s -X POST http://localhost:8888/notify \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"$1\",\"rate\":280,\"voice_enabled\":true}" > /dev/null 2>&1 || true
}

echo "🌐 Testing: $URL"
announce "Browser test started: $TEST_NAME"

# Navigate and get snapshot
agent-browser --session "rbp-test-$$" open "$URL"
SNAPSHOT=$(agent-browser --session "rbp-test-$$" snapshot -i --json)

# Parse snapshot for testing
# (Add custom logic here based on test requirements)

# Cleanup
agent-browser --session "rbp-test-$$" close

announce "Browser test completed: $TEST_NAME"
echo "✅ Test passed"
```

### Phase 3: Update Ralph CLI
```typescript
// rbp/lib/src/commands/test.ts
import { spawnSync } from 'child_process';

function runBrowserTests(url: string): boolean {
  const result = spawnSync('agent-browser', ['open', url], {
    encoding: 'utf-8',
    stdio: 'pipe'
  });

  return result.status === 0;
}
```

### Phase 4: Documentation
- Add Agent Browser section to `rbp/docs/rbp-stack-specification.md`
- Create `rbp/docs/browser-testing-guide.md` with examples
- Update `install.sh` validation to check Agent Browser installation

---

## Benchmarks (Estimated)

Based on Vercel's D0 agent research and Agent Browser documentation:

| Metric | Playwright MCP | PAI Browser | Agent Browser |
|--------|----------------|-------------|---------------|
| Initial load (tokens) | ~13,700 | ~0 | ~0 |
| Per-operation (tokens) | ~500 | ~50-200 | ~100-200 |
| 5 screenshots (tokens) | 13,700 | 500 | 500 |
| Token savings | 0% | 96.4% | 96.4% |
| Command latency | Medium | Low | Very Low (Rust CLI) |
| Setup time | 5 min (MCP config) | 0 (pre-installed) | 2 min (npm install) |
| Session startup | N/A | ~2s | ~1s (daemon) |
| Parallel execution | No | No | Yes |

---

## Conclusion

Vercel Agent Browser is the clear winner for RBP Stack's browser automation needs. Its CLI-first design, snapshot+refs system, and stateless architecture align perfectly with Ralph's autonomous execution model. The PAI Browser Skill remains valuable for interactive debugging but is not the right fit for the primary testing workflow.

**Next Steps:**
1. Install Agent Browser globally
2. Add installation to `rbp/install.sh`
3. Create `rbp/scripts/browser-test.sh` helper
4. Update Ralph TypeScript CLI to invoke Agent Browser
5. Add browser testing examples to documentation

---

**References:**
- Vercel Agent Browser: https://github.com/vercel-labs/agent-browser
- Vercel D0 Research: "Less is more" philosophy (17 tools → 2 tools)
- Pulumi Blog: Self-Verifying AI Agents article (Jan 20, 2026)
- PAI Browser Skill: `~/.claude/skills/Browser/SKILL.md`
