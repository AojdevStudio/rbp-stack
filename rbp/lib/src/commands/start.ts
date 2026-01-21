/**
 * start command - Entry point that auto-detects project type
 * Ported from start.sh
 */

import { Command } from "commander";
import { detectProjectContext, checkPrerequisites, findQuickPlanSpec } from "../utils/project-detector";
import { parseSpecToBeads } from "../parsers/spec-to-beads";
import { logger } from "../observability/logger";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";
import { runCommand } from "./run";

export interface StartOptions {
  maxIterations?: string;
}

export async function startCommand(options: StartOptions): Promise<void> {
  const context = await detectProjectContext();

  logger.banner("RBP Autonomous Loop", "v3.0");
  logger.info(`Project: ${context.projectRoot}`);
  logger.info(`Mode: ${context.mode}`);

  // Check prerequisites
  const prereqs = checkPrerequisites(context.mode);
  if (!prereqs.ok) {
    exitWithError(
      createError(ErrorCodes.MISSING_PREREQUISITE, `Missing: ${prereqs.missing.join(", ")}`, {
        suggestion: "Install the missing tools and try again",
      })
    );
  }

  switch (context.mode) {
    case "bmad":
      logger.info("BMAD mode detected. Ralph will orchestrate workflows.");
      await runCommand({
        bmad: true,
        maxIterations: options.maxIterations,
      });
      break;

    case "beads":
      logger.info("Tasks found in beads.");
      await runCommand({
        beads: true,
        maxIterations: options.maxIterations,
      });
      break;

    case "quickplan":
      // Setup beads from spec if needed
      const specFile = findQuickPlanSpec(context.projectRoot);
      if (specFile) {
        logger.info(`Found spec: ${specFile}`);
        logger.info("Parsing spec to beads...");
        const parseResult = await parseSpecToBeads(specFile);
        if (!parseResult.success) {
          exitWithError(
            createError(ErrorCodes.PARSE_ERROR, parseResult.error || "Failed to parse spec", {
              suggestion: "Check the spec file format",
            })
          );
        }
      }
      await runCommand({
        beads: true,
        maxIterations: options.maxIterations,
      });
      break;

    default:
      exitWithError(
        createError(ErrorCodes.NO_WORKFLOW_DETECTED, "Unknown project type", {
          suggestion: `Expected one of:
  - BMAD: sprint-status.yaml + epic-N branch
  - Beads: .beads/ directory
  - Quick-plan: specs/*.md with RBP-TASKS-START`,
        })
      );
  }
}

export const startCommandDef = new Command("start")
  .description("Auto-detect project type and start execution")
  .option("--max-iterations <n>", "Maximum iterations (default: 50)")
  .action(startCommand);
