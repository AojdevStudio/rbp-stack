#!/usr/bin/env bun
/**
 * RBP Stack - Session Start Hook
 *
 * Loads beads context at the start of each Claude Code session.
 * This hook runs automatically when a new session begins.
 */

import { $ } from "bun";

async function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Check if beads is initialized in this project
  const beadsDir = `${projectDir}/.beads`;
  const beadsExists = await Bun.file(beadsDir).exists().catch(() => false);

  if (!beadsExists) {
    // Beads not initialized, skip context loading
    return;
  }

  try {
    // Load beads context using bd prime
    await $`bd prime 2>/dev/null`.quiet();

    // Output session start marker
    console.log(`[RBP] Session started in ${projectDir}`);
    console.log(`[RBP] Beads context loaded. Run 'bd ready' to find available work.`);
  } catch {
    // bd prime may fail if beads CLI not available, that's ok
    console.log(`[RBP] Session started (beads context unavailable)`);
  }
}

main().catch(console.error);
