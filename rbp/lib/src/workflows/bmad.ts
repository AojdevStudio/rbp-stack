import { existsSync, readFileSync, writeFileSync } from "fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { RbpConfig } from "../config/types";
import { logger } from "../observability/logger";
import { emitWorkflowStart, emitWorkflowComplete, emitTaskStart, emitTaskComplete, emitTaskFailed } from "../observability/events";
import { createError, ErrorCodes, type RbpError } from "../utils/errors";
import { findProjectRoot, findSprintStatusPath } from "../utils/project-detector";
import {
  invokeSlashCommand as invokeCliSlashCommand,
  checkClaudeInstalled,
  validateSlashCommand,
  buildSlashCommand,
  type BmadSlashCommandOptions,
} from "../integrations/bmad-cli";

export type StoryStatus = "backlog" | "drafted" | "ready-for-dev" | "in-progress" | "review" | "done";

export interface Story {
  id: string;
  title: string;
  status: StoryStatus;
  epic?: string;
}

export interface SprintStatus {
  epic?: string;
  current_story?: string;
  stories: Story[];
}

export interface BmadWorkflowOptions {
  config: RbpConfig;
  maxIterations?: number;
  dryRun?: boolean;
  sprintStatusPath?: string;
  invokeSlashCommand?: (command: string, args?: string[]) => Promise<void>;
  slashCommandOptions?: BmadSlashCommandOptions;
  autoSave?: boolean;
}

export interface BmadWorkflowResult {
  success: boolean;
  storiesCompleted: number;
  iterations: number;
  error?: RbpError;
}

const STATUS_TRANSITIONS: Record<StoryStatus, StoryStatus | null> = {
  backlog: "drafted",
  drafted: "ready-for-dev",
  "ready-for-dev": "in-progress",
  "in-progress": "review",
  review: "done",
  done: null,
};

export function detectEpicFromBranch(): string | null {
  try {
    const proc = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
    const branch = new TextDecoder().decode(proc.stdout).trim();

    const epicMatch = branch.match(/^epic[/-]?(\d+)/i);
    if (epicMatch) {
      return epicMatch[1];
    }

    const featureMatch = branch.match(/^feature[/-]?(\d+)/i);
    if (featureMatch) {
      return featureMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

export function loadSprintStatus(path: string): SprintStatus | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, "utf-8");
    const parsed = parseYaml(content) as SprintStatus;
    if (!parsed || !Array.isArray(parsed.stories)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSprintStatus(path: string, status: SprintStatus): boolean {
  try {
    const content = stringifyYaml(status);
    writeFileSync(path, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}

export async function executeSlashCommand(
  command: string,
  storyId?: string,
  options?: BmadSlashCommandOptions
): Promise<{ success: boolean; output?: string; error?: string }> {
  if (!validateSlashCommand(command)) {
    return {
      success: false,
      error: `Invalid slash command format: ${command}`,
    };
  }

  const fullCommand = buildSlashCommand(command, storyId);
  const result = await invokeCliSlashCommand(fullCommand, [], options);

  return {
    success: result.success,
    output: result.output,
    error: result.error?.message,
  };
}

export function findNextStory(status: SprintStatus): Story | null {
  const storyOrder: StoryStatus[] = ["in-progress", "ready-for-dev", "drafted", "backlog"];

  for (const targetStatus of storyOrder) {
    const story = status.stories.find((s) => s.status === targetStatus);
    if (story) {
      return story;
    }
  }

  return null;
}

export function getWorkflowForStatus(status: StoryStatus, config: RbpConfig): string | null {
  switch (status) {
    case "backlog":
    case "drafted":
      return config.bmad.create_story;
    case "ready-for-dev":
    case "in-progress":
      return config.bmad.dev_story;
    case "review":
      return config.bmad.code_review;
    case "done":
      return null;
    default:
      return null;
  }
}

export async function runBmadWorkflow(options: BmadWorkflowOptions): Promise<BmadWorkflowResult> {
  const {
    config,
    maxIterations = config.execution.max_iterations,
    dryRun = false,
    invokeSlashCommand,
    slashCommandOptions,
    autoSave = true,
  } = options;

  const projectRoot = findProjectRoot();
  const sprintStatusPath = options.sprintStatusPath ?? findSprintStatusPath(projectRoot) ?? `${projectRoot}/docs/bmm/sprint-status.yaml`;

  let storiesCompleted = 0;
  let iteration = 0;

  logger.section("BMAD Workflow Starting");

  const epic = detectEpicFromBranch();
  if (epic) {
    logger.info(`Detected Epic: ${epic}`);
  }

  const sprintStatus = loadSprintStatus(sprintStatusPath);
  if (!sprintStatus) {
    return {
      success: false,
      storiesCompleted: 0,
      iterations: 0,
      error: createError(
        ErrorCodes.NO_WORKFLOW_DETECTED,
        `Sprint status file not found: ${sprintStatusPath}`,
        { suggestion: "Create a sprint-status.yaml file or use --beads flag" }
      ),
    };
  }

  emitWorkflowStart("bmad", { epic, stories: sprintStatus.stories.length });

  logger.info(`Sprint Status: ${sprintStatusPath}`);
  logger.info(`Stories: ${sprintStatus.stories.length}`);
  logger.info(`Max Iterations: ${maxIterations}`);
  logger.info(`Dry Run: ${dryRun}`);

  const useIntegratedCli = !invokeSlashCommand && (await checkClaudeInstalled());
  if (useIntegratedCli) {
    logger.info("Using integrated Claude CLI for slash commands");
  }

  while (iteration < maxIterations) {
    iteration++;

    const story = findNextStory(sprintStatus);

    if (!story) {
      logger.success("All stories complete!");
      break;
    }

    logger.section(`Iteration ${iteration}/${maxIterations} | Story: ${story.id}`);
    logger.info(`Title: ${story.title}`);
    logger.info(`Status: ${story.status}`);

    const workflow = getWorkflowForStatus(story.status, config);

    if (!workflow) {
      logger.info(`No workflow for status: ${story.status}`);
      continue;
    }

    if (dryRun) {
      logger.info(`[DRY RUN] Would run: ${workflow}`);
      logger.info(`[DRY RUN] Story would transition: ${story.status} → ${STATUS_TRANSITIONS[story.status]}`);
      continue;
    }

    logger.info(`Running workflow: ${workflow}`);
    emitTaskStart(story.id, story.title);

    let workflowSuccess = false;

    if (invokeSlashCommand) {
      try {
        await invokeSlashCommand(workflow, [story.id]);
        workflowSuccess = true;
      } catch (error) {
        logger.error(`Workflow failed: ${error instanceof Error ? error.message : String(error)}`);
        emitTaskFailed(story.id, story.title, error instanceof Error ? error.message : String(error));
      }
    } else if (useIntegratedCli) {
      const result = await executeSlashCommand(workflow, story.id, slashCommandOptions);
      if (result.success) {
        workflowSuccess = true;
      } else {
        logger.error(`Workflow failed: ${result.error}`);
        emitTaskFailed(story.id, story.title, result.error ?? "Unknown error");
      }
    } else {
      logger.warn("No slash command invoker provided and Claude CLI not available - skipping execution");
    }

    if (workflowSuccess) {
      const nextStatus = STATUS_TRANSITIONS[story.status];
      if (nextStatus) {
        story.status = nextStatus;
        if (nextStatus === "done") {
          storiesCompleted++;
        }

        if (autoSave) {
          saveSprintStatus(sprintStatusPath, sprintStatus);
        }
      }

      logger.success(`Story ${story.id} transitioned to: ${story.status}`);
      emitTaskComplete(story.id, story.title);
    }

    await new Promise((resolve) => setTimeout(resolve, config.execution.iteration_delay * 1000));
  }

  emitWorkflowComplete("bmad", storiesCompleted);

  logger.section("Workflow Complete");
  logger.info(`Stories Completed: ${storiesCompleted}`);
  logger.info(`Total Iterations: ${iteration}`);

  return {
    success: true,
    storiesCompleted,
    iterations: iteration,
  };
}
