/**
 * hooks command - Run RBP hooks manually or show hook information
 */

import { Command } from "commander";
import { runSessionStartHook, runPreCompactHook } from "../hooks";
import { logger } from "../observability/logger";

export interface HooksOptions {
  sessionStart?: boolean;
  preCompact?: boolean;
}

export async function hooksCommand(options: HooksOptions): Promise<void> {
  if (options.sessionStart) {
    const result = await runSessionStartHook();
    if (result.output) {
      console.log(result.output);
    }
    process.exit(0);
  }

  if (options.preCompact) {
    const result = await runPreCompactHook();
    if (result.output) {
      console.log(result.output);
    }
    process.exit(0);
  }

  // Show hook information
  logger.section("RBP Hooks");
  logger.info("");
  logger.info("Available hooks:");
  logger.info("");
  logger.info("  SessionStart (--session-start)");
  logger.info("    Displays current task context when a Claude Code session begins.");
  logger.info("    Shows progress and the next ready task.");
  logger.info("");
  logger.info("  PreCompact (--pre-compact)");
  logger.info("    Saves progress checkpoint before context compaction.");
  logger.info("    Writes to scripts/rbp/progress.txt for continuity.");
  logger.info("");
  logger.info("Usage:");
  logger.info("  ralph hooks --session-start   # Run session start hook");
  logger.info("  ralph hooks --pre-compact     # Run pre-compact hook");
  logger.info("");
  logger.info("Configure in .claude/settings.json:");
  logger.info(`
  "hooks": {
    "SessionStart": ["ralph", "hooks", "--session-start"],
    "PreCompact": ["ralph", "hooks", "--pre-compact"]
  }
`);

  process.exit(0);
}

export const hooksCommandDef = new Command("hooks")
  .description("Run RBP hooks or show hook information")
  .option("--session-start", "Run the session start hook")
  .option("--pre-compact", "Run the pre-compact hook")
  .action(hooksCommand);
