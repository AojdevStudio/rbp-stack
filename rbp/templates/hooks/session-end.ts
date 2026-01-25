#!/usr/bin/env bun
/**
 * RBP Stack - Session End Hook
 *
 * Performs cleanup and sync at the end of each Claude Code session.
 * Reminds to sync beads and push changes.
 */

import { $ } from "bun";

async function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Check if beads is initialized
  const beadsDir = `${projectDir}/.beads`;
  const beadsExists = await Bun.file(beadsDir).exists().catch(() => false);

  console.log(`\n[RBP] Session ending...`);

  if (beadsExists) {
    try {
      // Sync beads with git
      await $`bd sync 2>/dev/null`.quiet();
      console.log(`[RBP] Beads synced with git.`);
    } catch {
      console.log(`[RBP] Warning: Could not sync beads. Run 'bd sync' manually.`);
    }
  }

  // Check for uncommitted changes
  try {
    const status = await $`git status --porcelain 2>/dev/null`.text();
    if (status.trim()) {
      console.log(`[RBP] Warning: Uncommitted changes detected. Remember to commit and push.`);
    } else {
      console.log(`[RBP] Working directory clean.`);
    }
  } catch {
    // Git not available or not a repo
  }

  console.log(`[RBP] Session complete.\n`);
}

main().catch(console.error);
