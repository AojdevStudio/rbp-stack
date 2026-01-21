/**
 * parse-spec command - Convert quick-plan spec to beads
 */

import { Command } from "commander";
import { parseSpecToBeads } from "../parsers/spec-to-beads";
import { logger } from "../observability/logger";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";

export interface ParseSpecOptions {
  // Future options can be added here
}

export async function parseSpecCommand(specFile: string, _options: ParseSpecOptions): Promise<void> {
  if (!specFile) {
    exitWithError(
      createError(ErrorCodes.MISSING_ARGUMENT, "Spec file path required", {
        suggestion: "Usage: ralph parse-spec <spec-file.md>",
      })
    );
  }

  const result = await parseSpecToBeads(specFile);

  if (!result.success) {
    exitWithError(
      createError(ErrorCodes.PARSE_ERROR, result.error || "Failed to parse spec", {
        suggestion: "Check that the spec file has RBP-TASKS markers or Implementation Tasks section",
      })
    );
  }

  process.exit(0);
}

export const parseSpecCommandDef = new Command("parse-spec")
  .description("Convert a quick-plan spec to beads")
  .argument("<spec-file>", "Path to the spec markdown file")
  .action(parseSpecCommand);
