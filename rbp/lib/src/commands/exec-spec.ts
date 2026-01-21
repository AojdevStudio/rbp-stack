import { Command } from "commander";
import { existsSync } from "fs";
import { join } from "path";
import { getConfig, getGlobalOptions, parseMaxIterations } from "../cli";
import { runBeadsWorkflow } from "../workflows/beads";
import { runCodexReview as runCodexReviewWorkflow } from "../workflows/codex";
import { emitSpecParsed } from "../observability/events";
import { logger, setLogLevel } from "../observability/logger";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";
import { parseShellCommand } from "../utils/shell";
import { parseSpecToBeads as parseSpecToBeadsImpl } from "../parsers/spec-to-beads";
import { findProjectRoot } from "../utils/project-detector";
import type { RbpConfig } from "../config/types";

export interface ExecSpecOptions {
  skipReview?: boolean;
  maxIterations?: string;
  dryRun?: boolean;
}

async function performCodexReview(specFile: string, config: RbpConfig): Promise<void> {
  const result = await runCodexReviewWorkflow({ specFile, config });

  if (!result.skipped) {
    logger.info("Proceeding with execution...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function parseSpecToBeads(specFile: string, _config: any): Promise<number> {
  const result = await parseSpecToBeadsImpl(specFile);

  if (!result.success) {
    logger.error(`Failed to parse spec: ${result.error}`);
    return 0;
  }

  emitSpecParsed(specFile, result.tasksCreated);
  return result.tasksCreated;
}

export async function execSpecCommand(file: string, options: ExecSpecOptions): Promise<void> {
  const globalOptions = getGlobalOptions();

  if (globalOptions.verbose) {
    setLogLevel("debug");
  } else if (globalOptions.quiet) {
    setLogLevel("warn");
  }

  const config = getConfig(globalOptions);

  logger.banner("Ralph Execute - Spec Runner", "RBP Stack v3.0");

  const projectRoot = findProjectRoot();
  let specFile = file;
  if (!existsSync(specFile)) {
    const specsDir = config.paths.specs;
    const candidates = [
      join(projectRoot, specsDir, file),
      join(projectRoot, specsDir, `${file}.md`),
      join(specsDir, file),
      join(specsDir, `${file}.md`),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        specFile = candidate;
        break;
      }
    }

    if (!existsSync(specFile)) {
      exitWithError(
        createError(ErrorCodes.SPEC_NOT_FOUND, `Spec file not found: ${file}`, {
          suggestion: `Check the file exists in ${specsDir}/`,
        })
      );
    }
  }

  logger.info(`Spec File: ${specFile}`);

  const maxIterations = parseMaxIterations(options.maxIterations, config.execution.max_iterations);
  const skipReview = options.skipReview ?? config.codex.skip_by_default;

  if (options.dryRun) {
    logger.section("[DRY RUN] Execution Plan");
    logger.info(`Spec file: ${specFile}`);
    logger.info(`Skip Codex review: ${skipReview}`);
    logger.info(`Max iterations: ${maxIterations}`);
    logger.info(`Test command: ${config.verification.test_command}`);
    logger.info("Steps that would execute:");
    if (!skipReview) {
      logger.info("  1. Run Codex pre-flight review");
    }
    logger.info(`  ${skipReview ? "1" : "2"}. Parse spec to Beads tasks`);
    logger.info(`  ${skipReview ? "2" : "3"}. Run Beads workflow (up to ${maxIterations} iterations)`);
    logger.success("[DRY RUN] No changes made");
    return;
  }

  if (!skipReview) {
    await performCodexReview(specFile, config);
  } else {
    logger.info("Skipping Codex pre-flight review");
  }

  await parseSpecToBeads(specFile, config);

  logger.section("Execution Loop");

  const result = await runBeadsWorkflow({
    config,
    maxIterations,
    dryRun: options.dryRun,
    runTests: async () => {
      const proc = Bun.spawn(parseShellCommand(config.verification.test_command), {
        stdout: "pipe",
        stderr: "pipe",
        cwd: projectRoot,
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      const output = stderr ? `${stdout}\n${stderr}` : stdout;
      return { passed: exitCode === 0, output };
    },
  });

  if (!result.success && result.error) {
    exitWithError(result.error);
  }

  process.exit(result.success ? 0 : 1);
}

export const execSpecCommandDef = new Command("exec-spec")
  .description("Execute a spec file")
  .argument("<file>", "Spec file path")
  .option("--skip-review", "Skip Codex pre-flight review")
  .option("--max-iterations <n>", "Maximum iterations")
  .option("--dry-run", "Show what would happen without executing")
  .action(execSpecCommand);
