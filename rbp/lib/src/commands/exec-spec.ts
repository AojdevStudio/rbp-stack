import { Command } from "commander";
import { existsSync } from "fs";
import { getConfig, getGlobalOptions, parseMaxIterations } from "../cli";
import { runBeadsWorkflow } from "../workflows/beads";
import { emitCodexReview, emitSpecParsed } from "../observability/events";
import { logger, setLogLevel } from "../observability/logger";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";
import { parseSpecToBeads as parseSpecToBeadsImpl } from "../parsers/spec-to-beads";

export interface ExecSpecOptions {
  skipReview?: boolean;
  maxIterations?: string;
  dryRun?: boolean;
}

async function runCodexReview(specFile: string, config: any): Promise<void> {
  if (!config.codex.enabled) {
    logger.info("Codex review disabled in config");
    return;
  }

  logger.section("Codex Pre-Flight Review");
  emitCodexReview("start", specFile);

  try {
    const checkProc = Bun.spawnSync(["which", "codex"]);
    if (checkProc.exitCode !== 0) {
      logger.warn("Codex CLI not found. Skipping pre-flight review.");
      logger.info("Install Codex to enable spec review: https://codex.openai.com");
      return;
    }

    logger.info(`Running ${config.codex.model} review (reasoning: ${config.codex.reasoning_effort})...`);

    const reviewPrompt = `Review this implementation spec for:
1. Missing edge cases
2. Wrong technical approaches
3. Missing dependencies
4. Incomplete testing strategy
5. Security concerns
6. Tasks too large to split

Spec file: ${specFile}

Provide specific, actionable improvements. Be concise.`;

    const proc = Bun.spawn(
      [
        "codex",
        "exec",
        "--skip-git-repo-check",
        "-m",
        config.codex.model,
        "--config",
        `model_reasoning_effort=${config.codex.reasoning_effort}`,
        "--sandbox",
        "read-only",
      ],
      {
        stdin: new TextEncoder().encode(reviewPrompt),
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      console.log(stdout);
      emitCodexReview("complete", specFile, stdout.slice(0, 500));
      logger.success("Codex review complete");
    } else {
      logger.warn("Codex review failed or unavailable. Continuing without review.");
      emitCodexReview("failed", specFile, "Codex unavailable or failed");
    }
  } catch (error) {
    logger.warn("Codex review error. Continuing without review.");
    emitCodexReview("failed", specFile, String(error));
  }

  logger.info("Proceeding with execution...");
  await new Promise((resolve) => setTimeout(resolve, 2000));
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

  let specFile = file;
  if (!existsSync(specFile)) {
    const specsDir = config.paths.specs;
    const candidates = [
      `${specsDir}/${file}`,
      `${specsDir}/${file}.md`,
      `${process.cwd()}/${specsDir}/${file}`,
      `${process.cwd()}/${specsDir}/${file}.md`,
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

  if (options.dryRun) {
    logger.info("[DRY RUN] Would execute spec");
    logger.info(`[DRY RUN] Skip Review: ${options.skipReview ?? config.codex.skip_by_default}`);
    return;
  }

  const skipReview = options.skipReview ?? config.codex.skip_by_default;
  if (!skipReview) {
    await runCodexReview(specFile, config);
  } else {
    logger.info("Skipping Codex pre-flight review");
  }

  await parseSpecToBeads(specFile, config);

  logger.section("Execution Loop");

  const maxIterations = parseMaxIterations(options.maxIterations, config.execution.max_iterations);

  const result = await runBeadsWorkflow({
    config,
    maxIterations,
    dryRun: false,
    runTests: async () => {
      const proc = Bun.spawn(config.verification.test_command.split(" "), {
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      return { passed: exitCode === 0, output: stdout };
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
