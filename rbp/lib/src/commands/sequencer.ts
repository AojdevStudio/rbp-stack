/**
 * sequencer command - Organize subtasks into execution phases
 */

import { Command } from "commander";
import { sequenceStory } from "../parsers/sequencer";
import { logger } from "../observability/logger";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";

export interface SequencerOptions {
  phaseSize?: string;
}

export async function sequencerCommand(storyId: string, options: SequencerOptions): Promise<void> {
  if (!storyId) {
    exitWithError(
      createError(ErrorCodes.MISSING_ARGUMENT, "Story ID required", {
        suggestion: "Usage: ralph sequencer <story-id> [--phase-size <n>]",
      })
    );
  }

  const phaseSize = options.phaseSize ? parseInt(options.phaseSize, 10) : 5;

  if (isNaN(phaseSize) || phaseSize < 1) {
    exitWithError(
      createError(ErrorCodes.INVALID_ARGUMENT, "Phase size must be a positive number", {
        suggestion: "Use a number like 3, 5, or 10",
      })
    );
  }

  const result = await sequenceStory(storyId, phaseSize);

  if (!result.success) {
    exitWithError(
      createError(ErrorCodes.SEQUENCER_ERROR, result.error || "Failed to sequence story", {
        suggestion: "Check that the story ID exists and has subtasks",
      })
    );
  }

  process.exit(0);
}

export const sequencerCommandDef = new Command("sequencer")
  .description("Organize story subtasks into execution phases")
  .argument("<story-id>", "The parent bead ID for the story")
  .option("-p, --phase-size <n>", "Number of subtasks per phase (default: 5)")
  .action(sequencerCommand);
