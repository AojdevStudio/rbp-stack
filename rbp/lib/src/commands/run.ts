import { Command } from "commander";
import { getConfig, getGlobalOptions, validateOptions, parseMaxIterations } from "../cli";
import { runBeadsWorkflow } from "../workflows/beads";
import { runBmadWorkflow } from "../workflows/bmad";
import { emitWorkflowStart, emitWorkflowComplete } from "../observability/events";
import { logger, setLogLevel } from "../observability/logger";
import { checkBeadsInstalled } from "../integrations/beads-cli";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";
import { parseShellCommand } from "../utils/shell";
import { existsSync } from "fs";
import { findProjectRoot, findSprintStatusPath } from "../utils/project-detector";

export interface RunOptions {
  bmad?: boolean;
  beads?: boolean;
  dryRun?: boolean;
  maxIterations?: string;
}

export async function runCommand(options: RunOptions): Promise<void> {
  const globalOptions = getGlobalOptions();
  validateOptions(options);

  if (globalOptions.verbose) {
    setLogLevel("debug");
  } else if (globalOptions.quiet) {
    setLogLevel("warn");
  }

  const config = getConfig(globalOptions);
  const maxIterations = parseMaxIterations(options.maxIterations, config.execution.max_iterations);

  logger.banner("Ralph - Autonomous Execution Loop", "RBP Stack v3.0");

  let workflow: "bmad" | "beads" | null = null;

  if (options.bmad) {
    workflow = "bmad";
  } else if (options.beads) {
    workflow = "beads";
  } else {
    const projectRoot = findProjectRoot();
    const sprintStatusPath = findSprintStatusPath(projectRoot);
    const beadsInstalled = await checkBeadsInstalled();

    if (sprintStatusPath) {
      workflow = "bmad";
    } else if (beadsInstalled) {
      workflow = "beads";
    }
  }

  if (!workflow) {
    exitWithError(
      createError(
        ErrorCodes.NO_WORKFLOW_DETECTED,
        "Could not detect workflow type",
        {
          suggestion: "Use --bmad or --beads flag, or initialize beads with 'bd init'",
        }
      )
    );
  }

  logger.info(`Workflow: ${workflow.toUpperCase()}`);
  logger.info(`Config: ${globalOptions.config ?? "default"}`);
  logger.info(`Max Iterations: ${maxIterations}`);
  logger.info(`Dry Run: ${options.dryRun ?? false}`);

  if (options.dryRun) {
    logger.section("[DRY RUN] Execution Plan");
    logger.info(`Would run ${workflow.toUpperCase()} workflow`);
    logger.info(`Max iterations: ${maxIterations}`);
    logger.info(`Test command: ${config.verification.test_command}`);
    if (workflow === "beads") {
      logger.info("Would query 'bd ready' for next task");
      logger.info("Would invoke Claude for each task");
      logger.info("Would run tests before closing tasks");
    } else if (workflow === "bmad") {
      logger.info("Would read sprint-status.yaml for stories");
      logger.info("Would invoke BMAD slash commands");
      logger.info("Would transition story statuses on completion");
    }
    logger.success("[DRY RUN] No changes made");
    return;
  }

  if (workflow === "beads") {
    const result = await runBeadsWorkflow({
      config,
      maxIterations,
      dryRun: options.dryRun,
      onTaskReady: async (task) => {
        logger.info(`Invoking Claude for task: ${task.id}`);
        const proc = Bun.spawn(
          ["claude", "--dangerously-skip-permissions"],
          {
            stdin: "pipe",
            stdout: "pipe",
            stderr: "pipe",
          }
        );

        const prompt = `# RBP Task Execution

## Current Task

\`\`\`json
${JSON.stringify(task, null, 2)}
\`\`\`

Execute this task following the RBP Protocol. Run tests to verify completion before marking the task as complete.
`;

        proc.stdin?.write(new TextEncoder().encode(prompt));
        proc.stdin?.end();

        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          proc.exited,
        ]);

        if (exitCode !== 0) {
          logger.warn("Claude execution had non-zero exit code");
          if (stderr) {
            logger.debug(`Claude stderr: ${stderr}`);
          }
        }

        console.log(stdout);
        if (stderr) {
          console.error(stderr);
        }
      },
      runTests: async () => {
        const proc = Bun.spawn(parseShellCommand(config.verification.test_command), {
          stdout: "pipe",
          stderr: "pipe",
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

  if (workflow === "bmad") {
    const result = await runBmadWorkflow({
      config,
      maxIterations,
      dryRun: options.dryRun,
      invokeSlashCommand: async (command: string, args?: string[]) => {
        logger.info(`Invoking BMAD workflow: ${command} ${args?.join(" ") ?? ""}`);

        // Build the slash command invocation
        const slashCommand = args?.length ? `${command} ${args.join(" ")}` : command;

        const proc = Bun.spawn(
          ["claude", "--dangerously-skip-permissions"],
          {
            stdin: "pipe",
            stdout: "pipe",
            stderr: "pipe",
          }
        );

        const prompt = `# BMAD Workflow Execution

Run the following slash command:

\`\`\`
${slashCommand}
\`\`\`

Execute this workflow following BMAD standards. After completion, run tests to verify the implementation.
`;

        proc.stdin?.write(new TextEncoder().encode(prompt));
        proc.stdin?.end();

        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          proc.exited,
        ]);

        if (exitCode !== 0) {
          logger.warn(`BMAD workflow had non-zero exit code: ${exitCode}`);
          if (stderr) {
            logger.debug(`stderr: ${stderr}`);
          }
          throw new Error(`Workflow ${command} failed with exit code ${exitCode}`);
        }

        console.log(stdout);
        if (stderr) {
          console.error(stderr);
        }
      },
    });

    if (!result.success && result.error) {
      exitWithError(result.error);
    }

    process.exit(result.success ? 0 : 1);
  }
}

export const runCommandDef = new Command("run")
  .description("Run the execution loop (default command)")
  .option("--bmad", "Use BMAD workflow")
  .option("--beads", "Use Beads workflow")
  .option("--dry-run", "Show what would happen without executing")
  .option("--max-iterations <n>", "Maximum iterations")
  .action(runCommand);
