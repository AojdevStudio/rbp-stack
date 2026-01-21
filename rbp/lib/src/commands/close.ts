import { Command } from "commander";
import { getConfig, getGlobalOptions } from "../cli";
import { showBead, closeBead, addBeadNote, updateBeadStatus } from "../integrations/beads-cli";
import { emitTestResult, emitTaskComplete, emitTaskFailed } from "../observability/events";
import { logger, setLogLevel } from "../observability/logger";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";
import { isUiTask } from "../workflows/beads";

export interface CloseOptions {
  force?: boolean;
  dryRun?: boolean;
}

export async function closeCommand(id: string, options: CloseOptions): Promise<void> {
  const globalOptions = getGlobalOptions();

  if (globalOptions.verbose) {
    setLogLevel("debug");
  } else if (globalOptions.quiet) {
    setLogLevel("warn");
  }

  const config = getConfig(globalOptions);

  logger.section(`Closing Task: ${id}`);

  const beadResult = await showBead(id);
  if (!beadResult.success || !beadResult.data) {
    exitWithError(
      beadResult.error ??
        createError(ErrorCodes.BEADS_COMMAND_FAILED, `Task not found: ${id}`)
    );
  }

  const bead = beadResult.data;
  logger.info(`Title: ${bead.title}`);
  logger.info(`Status: ${bead.status}`);

  if (options.dryRun) {
    logger.info("[DRY RUN] Would run tests and close task");
    return;
  }

  if (!options.force && config.verification.require_tests) {
    const needsPlaywright = config.verification.require_playwright_for_ui &&
      isUiTask(bead, config.ui_detection.keywords);

    const testCommand = needsPlaywright
      ? config.verification.playwright_command
      : config.verification.test_command;

    logger.info(`Running tests: ${testCommand}`);

    const proc = Bun.spawn(testCommand.split(" "), {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    const passed = exitCode === 0;
    emitTestResult(passed, stdout, id);

    if (!passed) {
      logger.error("Tests failed!");
      console.log(stdout);
      if (stderr) console.error(stderr);

      await addBeadNote(id, `Test failure:\n${stdout.slice(0, 500)}`);
      emitTaskFailed(id, bead.title, "Tests failed");

      exitWithError(
        createError(ErrorCodes.TEST_FAILED, "Cannot close task - tests failed", {
          details: { output: stdout.slice(0, 1000) },
          suggestion: "Fix the failing tests before closing",
        })
      );
    }

    logger.success("Tests passed!");
  } else if (options.force) {
    logger.warn("Force closing without tests");
  }

  const closeResult = await closeBead(id);
  if (!closeResult.success) {
    exitWithError(
      closeResult.error ??
        createError(ErrorCodes.BEADS_COMMAND_FAILED, `Failed to close task: ${id}`)
    );
  }

  emitTaskComplete(id, bead.title);
  logger.success(`Task ${id} closed`);
}

export const closeCommandDef = new Command("close")
  .description("Close a task with test verification")
  .argument("<id>", "Task ID to close")
  .option("-f, --force", "Force close without running tests")
  .option("--dry-run", "Show what would happen without executing")
  .action(closeCommand);
