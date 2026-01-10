# /rbp:validate - Validate RBP Installation

Verify that the RBP Stack is properly installed and configured.

## What This Checks

1. **Prerequisites**
   - `bd` (beads) command available
   - `bun` command available
   - `claude` CLI available

2. **Directory Structure**
   - `scripts/rbp/` exists with all scripts
   - `.claude/commands/rbp/` exists with commands
   - `.beads/` initialized

3. **Configuration**
   - `rbp-config.yaml` exists and is valid
   - `.claude/settings.json` has RBP hooks

4. **Test Infrastructure**
   - `bun run test` command works
   - `bun run typecheck` command works

## Run Validation

```bash
./scripts/rbp/validate.sh
```

## Expected Output

```
RBP Stack Validation
═══════════════════════════════════════════════════════

Prerequisites:
  [✓] bd (beads) installed
  [✓] bun installed
  [✓] claude CLI installed

Directory Structure:
  [✓] scripts/rbp/ exists
  [✓] .claude/commands/rbp/ exists
  [✓] .beads/ initialized

Scripts:
  [✓] ralph.sh
  [✓] prompt.md
  [✓] close-with-proof.sh
  [✓] sequencer.sh
  [✓] parse-story-to-beads.sh

Configuration:
  [✓] rbp-config.yaml exists
  [✓] hooks configured

═══════════════════════════════════════════════════════
RBP Stack: READY
═══════════════════════════════════════════════════════
```

## Fixing Issues

If validation fails:

1. **Missing prerequisites**: Install the missing tool
   ```bash
   # Install beads (pick one)
   brew install steveyegge/beads/bd
   # or: curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
   # or: npm install -g @beads/bd

   # Install bun
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Missing scripts**: Re-run installer
   ```bash
   /path/to/rbp/install.sh .
   ```

3. **Beads not initialized**: Initialize beads
   ```bash
   bd init
   ```

4. **Missing config**: Copy template
   ```bash
   cp /path/to/rbp/templates/rbp-config.yaml ./rbp-config.yaml
   ```
