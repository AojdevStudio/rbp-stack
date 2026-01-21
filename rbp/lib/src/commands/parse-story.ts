/**
 * parse-story command - Convert BMAD story to beads
 */

import { Command } from "commander";
import { parseStoryToBeads } from "../parsers/story-to-beads";
import { logger } from "../observability/logger";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";

export interface ParseStoryOptions {
  // Future options can be added here
}

export async function parseStoryCommand(storyFile: string, _options: ParseStoryOptions): Promise<void> {
  if (!storyFile) {
    exitWithError(
      createError(ErrorCodes.MISSING_ARGUMENT, "Story file path required", {
        suggestion: "Usage: ralph parse-story <story-file.md>",
      })
    );
  }

  const result = await parseStoryToBeads(storyFile);

  if (!result.success) {
    exitWithError(
      createError(ErrorCodes.PARSE_ERROR, result.error || "Failed to parse story", {
        suggestion: "Check that the story file exists and has valid BMAD format",
      })
    );
  }

  process.exit(0);
}

export const parseStoryCommandDef = new Command("parse-story")
  .description("Convert a BMAD story to beads")
  .argument("<story-file>", "Path to the story markdown file")
  .action(parseStoryCommand);
