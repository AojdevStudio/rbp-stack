/**
 * generate-story command - Generate BMAD story from epic
 */

import { Command } from "commander";
import { generateStory } from "../parsers/story-generator";
import { logger } from "../observability/logger";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";

export interface GenerateStoryOptions {
  epic?: string;
  story?: string;
  useClaude?: boolean;
}

export async function generateStoryCommand(options: GenerateStoryOptions): Promise<void> {
  const result = await generateStory({
    epicNum: options.epic,
    storyNum: options.story,
    useClaude: options.useClaude,
  });

  if (!result.success) {
    const exitCode = result.exitCode || 1;

    if (exitCode === 3) {
      // Epic complete - not an error
      logger.success(result.error || "Epic complete");
      process.exit(0);
    }

    exitWithError(
      createError(ErrorCodes.STORY_GENERATION_FAILED, result.error || "Failed to generate story", {
        suggestion: "Check BMAD configuration and sprint-status.yaml",
      })
    );
  }

  logger.success(`Story generated: ${result.storyFilePath}`);
  console.log(result.storyFilePath);
  process.exit(0);
}

export const generateStoryCommandDef = new Command("generate-story")
  .description("Generate a BMAD story from epic tech-spec")
  .option("-e, --epic <num>", "Epic number (auto-detected from branch if not provided)")
  .option("-s, --story <num>", "Story number (auto-incremented if not provided)")
  .option("--use-claude", "Use Claude for enhanced story generation")
  .action(generateStoryCommand);
