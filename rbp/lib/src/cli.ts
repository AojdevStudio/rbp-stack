import { Command } from "commander";
import { loadConfig } from "./config/loader";
import { exitWithError, createError, ErrorCodes } from "./utils/errors";

export interface GlobalOptions {
  config?: string;
  verbose?: boolean;
  quiet?: boolean;
  jsonErrors?: boolean;
}

export const program = new Command()
  .name("ralph")
  .version("3.0.0")
  .description("RBP autonomous execution loop")
  .option("-c, --config <path>", "Custom config file path")
  .option("-v, --verbose", "Increase output verbosity")
  .option("-q, --quiet", "Decrease output verbosity")
  .option("--json-errors", "Output errors as JSON (default: true)", true)
  .option("--no-json-errors", "Output errors as human-readable text")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    // Wire --json-errors flag to environment variable for error formatting
    if (opts.jsonErrors === false) {
      process.env.RBP_JSON_ERRORS = "false";
    } else {
      process.env.RBP_JSON_ERRORS = "true";
    }
  });

export function getGlobalOptions(): GlobalOptions {
  return program.opts();
}

export function validateOptions(options: { bmad?: boolean; beads?: boolean }): void {
  if (options.bmad && options.beads) {
    exitWithError(
      createError(
        ErrorCodes.WORKFLOW_CONFLICT,
        "Cannot use --bmad and --beads together",
        { suggestion: "Choose one workflow type or let ralph auto-detect" }
      )
    );
  }
}

export function parseMaxIterations(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    exitWithError(
      createError(
        ErrorCodes.INVALID_ARGUMENT,
        `Invalid max-iterations value: "${value}"`,
        { suggestion: "Provide a positive integer >= 1" }
      )
    );
  }

  return parsed;
}

export function getConfig(globalOptions: GlobalOptions) {
  return loadConfig({
    configPath: globalOptions.config,
  });
}
