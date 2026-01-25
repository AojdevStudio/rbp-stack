import { Command } from "commander";
import { getConfig, getGlobalOptions, validateOptions, parseMaxIterations } from "../cli";
import { runBeadsWorkflow } from "../workflows/beads";
import { runBmadWorkflow } from "../workflows/bmad";
import { emitWorkflowStart, emitWorkflowComplete } from "../observability/events";
import { logger, setLogLevel } from "../observability/logger";
import { checkBeadsInstalled } from "../integrations/beads-cli";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";
import { parseShellCommand } from "../utils/shell";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { findProjectRoot, findSprintStatusPath } from "../utils/project-detector";
import type { Bead } from "../integrations/beads-cli";
import { getProvider } from "../providers";
import { createNotificationManager } from "../notifications/factory";

/**
 * Build XML task injection matching promptv3 InjectionContract
 */
export function buildTaskXml(task: Bead): string {
  const escapeCdata = (s: string) => s.replace(/]]>/g, "]]]]><![CDATA[>");

  const description = task.description || task.notes || "No description provided";
  const criteria = task.acceptance_criteria || [];
  const size = task.estimated_size || "medium";

  const criteriaXml = criteria.length > 0
    ? criteria.map(c => `      <Criterion><![CDATA[${escapeCdata(c)}]]></Criterion>`).join("\n")
    : "      <Criterion><![CDATA[Task completed successfully]]></Criterion>";

  return `
  <CurrentTask>
    <BeadId><![CDATA[${escapeCdata(task.id)}]]></BeadId>
    <Title><![CDATA[${escapeCdata(task.title)}]]></Title>
    <Description><![CDATA[${escapeCdata(description)}]]></Description>
    <AcceptanceCriteria>
${criteriaXml}
    </AcceptanceCriteria>
    <EstimatedSize>${size}</EstimatedSize>
    ${task.parent_id ? `<ParentId><![CDATA[${escapeCdata(task.parent_id)}]]></ParentId>` : ""}
  </CurrentTask>
`;
}

export interface RunOptions {
  bmad?: boolean;
  beads?: boolean;
  dryRun?: boolean;
  maxIterations?: string;
  agent?: string;
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

  const agentName = options.agent ?? "claude";
  const provider = getProvider(agentName);

  if (!provider.isAvailable()) {
    exitWithError(
      createError(
        ErrorCodes.MISSING_PREREQUISITE,
        `Provider ${agentName} is not available`,
        {
          suggestion: `Install ${agentName} CLI or use a different provider with --agent flag`,
        }
      )
    );
  }

  logger.banner("Ralph - Autonomous Execution Loop", "RBP Stack v3.0");

  const projectRoot = findProjectRoot();
  let workflow: "bmad" | "beads" | null = null;

  if (options.bmad) {
    workflow = "bmad";
  } else if (options.beads) {
    workflow = "beads";
  } else {
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

  const notificationManager = createNotificationManager(config);
  if (notificationManager.hasConfiguredServices()) {
    logger.info("Notifications: Enabled");
  }

  logger.info(`Workflow: ${workflow.toUpperCase()}`);
  logger.info(`Agent Provider: ${provider.name}`);
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
      notificationManager,
      onTaskReady: async (task) => {
        logger.info(`Invoking ${provider.name} for task: ${task.id}`);

        const promptPath = join(projectRoot, "scripts/rbp/promptv3.md");
        if (!existsSync(promptPath)) {
          exitWithError(
            createError(
              ErrorCodes.CONFIG_NOT_FOUND,
              `Prompt file not found: ${promptPath}`,
              {
                suggestion: "Ensure RBP is properly installed with 'scripts/rbp/promptv3.md' present",
              }
            )
          );
        }

        const promptContent = readFileSync(promptPath, "utf-8");
        const taskXml = buildTaskXml(task);
        const prompt = `${promptContent}\n\n<!-- Task injected by Ralph -->\n${taskXml}`;

        const result = await provider.execute(prompt, { cwd: projectRoot });

        if (!result.success) {
          logger.warn(`${provider.name} execution had non-zero exit code`);
          if (result.stderr) {
            logger.debug(`${provider.name} stderr: ${result.stderr}`);
          }
        }

        console.log(result.stdout);
        if (result.stderr) {
          console.error(result.stderr);
        }
      },
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

  if (workflow === "bmad") {
    const result = await runBmadWorkflow({
      config,
      maxIterations,
      dryRun: options.dryRun,
      invokeSlashCommand: async (command: string, args?: string[]) => {
        logger.info(`Invoking BMAD workflow with ${provider.name}: ${command} ${args?.join(" ") ?? ""}`);

        const slashCommand = args?.length ? `${command} ${args.join(" ")}` : command;

        const prompt = `# BMAD Workflow Execution

Run the following slash command:

\`\`\`
${slashCommand}
\`\`\`

Execute this workflow following BMAD standards. After completion, run tests to verify the implementation.
`;

        const result = await provider.execute(prompt, { cwd: projectRoot });

        if (!result.success) {
          logger.warn(`BMAD workflow had non-zero exit code: ${result.exitCode}`);
          if (result.stderr) {
            logger.debug(`stderr: ${result.stderr}`);
          }
          throw new Error(`Workflow ${command} failed with exit code ${result.exitCode}`);
        }

        console.log(result.stdout);
        if (result.stderr) {
          console.error(result.stderr);
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
  .option("--agent <provider>", "AI provider to use (claude, gemini, codex)", "claude")
  .option("--dry-run", "Show what would happen without executing")
  .option("--max-iterations <n>", "Maximum iterations")
  .action(runCommand);
