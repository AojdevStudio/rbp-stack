import type { RbpConfig } from "../config/types";
import {
  getReadyBead,
  updateBeadStatus,
  closeBead,
  addBeadNote,
  type Bead,
} from "../integrations/beads-cli";
import {
  emitIterationStart,
  emitIterationEnd,
  emitTaskStart,
  emitTaskComplete,
  emitTaskFailed,
  emitTestResult,
} from "../observability/events";
import { logger } from "../observability/logger";
import { createError, ErrorCodes, type RbpError } from "../utils/errors";

export interface BeadsWorkflowOptions {
  config: RbpConfig;
  maxIterations?: number;
  dryRun?: boolean;
  onTaskReady?: (task: Bead) => Promise<void>;
  runTests?: () => Promise<{ passed: boolean; output: string }>;
}

export interface BeadsWorkflowResult {
  success: boolean;
  tasksCompleted: number;
  tasksFailed: number;
  iterations: number;
  error?: RbpError;
}

interface FailureContext {
  taskId: string;
  attempt: number;
  previousError?: string;
}

export async function runBeadsWorkflow(options: BeadsWorkflowOptions): Promise<BeadsWorkflowResult> {
  const {
    config,
    maxIterations = config.execution.max_iterations,
    dryRun = false,
    onTaskReady,
    runTests,
  } = options;

  let tasksCompleted = 0;
  let tasksFailed = 0;
  let iteration = 0;
  const failureContexts: Map<string, FailureContext> = new Map();

  logger.section(`Beads Workflow Starting`);
  logger.info(`Max Iterations: ${maxIterations}`);
  logger.info(`Test Command: ${config.verification.test_command}`);
  logger.info(`Dry Run: ${dryRun}`);

  while (iteration < maxIterations) {
    iteration++;
    emitIterationStart(iteration, maxIterations);

    const result = await getReadyBead();

    if (!result.success) {
      logger.error(`Failed to get ready task: ${result.error?.message}`);
      emitIterationEnd(iteration, "failure");
      return {
        success: false,
        tasksCompleted,
        tasksFailed,
        iterations: iteration,
        error: result.error,
      };
    }

    const task = result.data;

    if (!task) {
      logger.success("No more tasks available - workflow complete!");
      emitIterationEnd(iteration, "success");
      break;
    }

    logger.section(`Iteration ${iteration}/${maxIterations} | Task: ${task.id}`);
    logger.info(`Title: ${task.title}`);
    logger.info(`Status: ${task.status}`);

    if (dryRun) {
      logger.info(`[DRY RUN] Would process task: ${task.id}`);
      emitIterationEnd(iteration, "skipped", task.id);
      continue;
    }

    emitTaskStart(task.id, task.title);

    const failureContext = failureContexts.get(task.id);
    if (failureContext) {
      logger.warn(`Retry attempt ${failureContext.attempt + 1} for task ${task.id}`);
      if (failureContext.previousError) {
        logger.info(`Previous error: ${failureContext.previousError}`);
      }
    }

    const statusResult = await updateBeadStatus(task.id, "in_progress");
    if (!statusResult.success) {
      logger.error(`Failed to update task status: ${statusResult.error?.message}`);
      emitTaskFailed(task.id, task.title, statusResult.error?.message ?? "Failed to update status");
      tasksFailed++;
      emitIterationEnd(iteration, "failure", task.id);
      continue;
    }

    try {
      if (onTaskReady) {
        await onTaskReady(task);
      }

      if (runTests && config.verification.require_tests) {
        logger.info("Running tests...");
        const testResult = await runTests();
        emitTestResult(testResult.passed, testResult.output, task.id);

        if (!testResult.passed) {
          const errorMsg = `Tests failed for task ${task.id}`;
          logger.error(errorMsg);
          emitTaskFailed(task.id, task.title, errorMsg);

          failureContexts.set(task.id, {
            taskId: task.id,
            attempt: (failureContext?.attempt ?? 0) + 1,
            previousError: testResult.output.slice(0, 500),
          });

          const noteResult = await addBeadNote(task.id, `Test failure (attempt ${(failureContext?.attempt ?? 0) + 1}):\n${testResult.output.slice(0, 200)}`);
          if (!noteResult.success) {
            logger.warn(`Failed to add note to task: ${noteResult.error?.message}`);
          }

          const revertResult = await updateBeadStatus(task.id, "open");
          if (!revertResult.success) {
            logger.error(`Failed to revert task status: ${revertResult.error?.message}`);
          }

          tasksFailed++;
          emitIterationEnd(iteration, "failure", task.id);

          await new Promise((resolve) => setTimeout(resolve, config.execution.iteration_delay * 1000));
          continue;
        }

        logger.success("Tests passed!");
      }

      const closeResult = await closeBead(task.id);
      if (!closeResult.success) {
        logger.error(`Failed to close task: ${closeResult.error?.message}`);
        emitTaskFailed(task.id, task.title, closeResult.error?.message ?? "Failed to close task");
        tasksFailed++;
        emitIterationEnd(iteration, "failure", task.id);
        continue;
      }

      emitTaskComplete(task.id, task.title);
      failureContexts.delete(task.id);
      tasksCompleted++;
      logger.success(`Task ${task.id} completed`);
      emitIterationEnd(iteration, "success", task.id);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Task failed: ${errorMsg}`);
      emitTaskFailed(task.id, task.title, errorMsg);

      failureContexts.set(task.id, {
        taskId: task.id,
        attempt: (failureContext?.attempt ?? 0) + 1,
        previousError: errorMsg,
      });

      const revertOnErrorResult = await updateBeadStatus(task.id, "open");
      if (!revertOnErrorResult.success) {
        logger.error(`Failed to revert task status after error: ${revertOnErrorResult.error?.message}`);
      }
      tasksFailed++;
      emitIterationEnd(iteration, "failure", task.id);
    }

    await new Promise((resolve) => setTimeout(resolve, config.execution.iteration_delay * 1000));
  }

  logger.section("Workflow Complete");
  logger.info(`Tasks Completed: ${tasksCompleted}`);
  logger.info(`Tasks Failed: ${tasksFailed}`);
  logger.info(`Total Iterations: ${iteration}`);

  return {
    success: tasksFailed === 0,
    tasksCompleted,
    tasksFailed,
    iterations: iteration,
  };
}

export function injectFailureContext(prompt: string, context: FailureContext): string {
  return `${prompt}

---
PREVIOUS ATTEMPT CONTEXT:
This is attempt ${context.attempt + 1} for task ${context.taskId}.
${context.previousError ? `Previous error:\n${context.previousError}` : ""}
Please address the issues from the previous attempt.
---`;
}

export function isUiTask(task: Bead, keywords: string[]): boolean {
  const searchText = `${task.title} ${task.notes ?? ""} ${(task.labels ?? []).join(" ")}`.toLowerCase();
  return keywords.some((keyword) => searchText.includes(keyword.toLowerCase()));
}
