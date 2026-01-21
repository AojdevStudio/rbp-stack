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
  .option("--json-errors", "Output errors as JSON (default: true)", true);

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

export function getConfig(globalOptions: GlobalOptions) {
  return loadConfig({
    configPath: globalOptions.config,
  });
}
