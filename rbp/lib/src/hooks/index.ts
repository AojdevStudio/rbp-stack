/**
 * RBP Hooks
 * Ported from show-active-task.sh and save-progress-to-beads.sh
 *
 * Hooks are scripts that run automatically via Claude Code's hooks:
 * - SessionStart: show-active-task - displays current task context
 * - PreCompact: save-progress - saves progress checkpoint
 */

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { dirname, join } from "path";
import { getBeadsStatus, getReadyBead, listBeads } from "../integrations/beads-cli";

export interface SessionStartResult {
  hasProject: boolean;
  readyTask?: string;
  progress?: {
    completed: number;
    total: number;
  };
  output: string;
}

export interface PreCompactResult {
  success: boolean;
  status: {
    open: number;
    total: number;
    currentTask: string | null;
  };
  output: string;
}

/**
 * SessionStart hook - displays current RBP task context
 * This runs automatically when a Claude Code session begins
 */
export async function runSessionStartHook(): Promise<SessionStartResult> {
  // Check if beads is available
  const isBeadsProject = existsSync(".beads");

  if (!isBeadsProject) {
    return {
      hasProject: false,
      output: "",
    };
  }

  // Get ready task
  const readyResult = await getReadyBead();
  const readyTask = readyResult.success && readyResult.data ? readyResult.data.title : null;

  // Get status
  const statusResult = await getBeadsStatus();
  const status = statusResult.success && statusResult.data
    ? statusResult.data
    : { open: 0, total: 0, ready: null };

  const completed = status.total - status.open;

  if (!readyTask) {
    if (status.total === 0) {
      return {
        hasProject: true,
        output: "",
      };
    }

    return {
      hasProject: true,
      progress: { completed, total: status.total },
      output: `
RBP Status: All ${completed}/${status.total} tasks complete
`,
    };
  }

  const output = `
════════════════════════════════════════════════════════
  RBP Active Task
════════════════════════════════════════════════════════

${readyTask}

Progress: ${completed}/${status.total} tasks complete

Commands:
  Start loop:  ralph run
  View status: bd status
════════════════════════════════════════════════════════
`;

  return {
    hasProject: true,
    readyTask,
    progress: { completed, total: status.total },
    output,
  };
}

/**
 * PreCompact hook - saves current progress state to beads
 * This runs automatically before context compaction
 */
export async function runPreCompactHook(progressDir?: string): Promise<PreCompactResult> {
  // Check if beads is available
  const isBeadsProject = existsSync(".beads");

  if (!isBeadsProject) {
    return {
      success: false,
      status: { open: 0, total: 0, currentTask: null },
      output: "",
    };
  }

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const progressFile = progressDir
    ? join(progressDir, "progress.txt")
    : "scripts/rbp/progress.txt";

  // Ensure progress file directory exists
  const progressDirPath = dirname(progressFile);
  if (!existsSync(progressDirPath)) {
    try {
      mkdirSync(progressDirPath, { recursive: true });
    } catch {
      // Ignore mkdir errors
    }
  }

  // Get current status
  const statusResult = await getBeadsStatus();
  const status = statusResult.success && statusResult.data
    ? statusResult.data
    : { open: 0, total: 0, ready: null };

  const readyResult = await getReadyBead();
  const currentTask = readyResult.success && readyResult.data
    ? readyResult.data.title
    : "None";

  // Log to progress file
  const logEntry = `[${timestamp}] Context compaction - progress checkpoint
  Open tasks: ${status.open}
  Total tasks: ${status.total}
  Current task: ${currentTask}

`;

  try {
    appendFileSync(progressFile, logEntry);
  } catch {
    // Ignore write errors
  }

  const completed = status.total - status.open;
  const output = `
RBP Progress Saved:
  Tasks: ${completed}/${status.total} complete
  Current: ${currentTask}
`;

  return {
    success: true,
    status: {
      open: status.open,
      total: status.total,
      currentTask,
    },
    output,
  };
}

/**
 * Generate hook scripts that can be installed
 */
export function generateHookScripts(): {
  sessionStart: string;
  preCompact: string;
} {
  const sessionStart = `#!/usr/bin/env bun
// SessionStart hook - show active task
import { runSessionStartHook } from "./lib/dist/index.js";

const result = await runSessionStartHook();
if (result.output) {
  console.log(result.output);
}
`;

  const preCompact = `#!/usr/bin/env bun
// PreCompact hook - save progress
import { runPreCompactHook } from "./lib/dist/index.js";

const result = await runPreCompactHook();
if (result.output) {
  console.log(result.output);
}
`;

  return { sessionStart, preCompact };
}
