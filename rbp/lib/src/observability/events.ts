import { existsSync, mkdirSync, appendFileSync } from "fs";
import { homedir } from "os";
import { sanitizeObject } from "./sanitizer";

export interface RbpEvent {
  timestamp: string;
  session_id: string;
  source_app: string;
  event_type: string;
  data: Record<string, unknown>;
}

const SESSION_ID = process.env.RBP_SESSION_ID ?? `ralph-${Date.now()}`;
const SOURCE_APP = process.env.RBP_SOURCE_APP ?? "RBP-Ralph";

function getEventFilePath(): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const date = `${yearMonth}-${String(now.getDate()).padStart(2, "0")}`;
  const dir = `${homedir()}/.claude/history/raw-outputs/${yearMonth}`;

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return `${dir}/${date}_all-events.jsonl`;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export function emitEvent(eventType: string, data: Record<string, unknown>): void {
  const event: RbpEvent = {
    timestamp: formatTimestamp(),
    session_id: SESSION_ID,
    source_app: SOURCE_APP,
    event_type: eventType,
    data: sanitizeObject(data),
  };

  const line = JSON.stringify(event) + "\n";
  const filePath = getEventFilePath();
  appendFileSync(filePath, line);
}

export function emitIterationStart(iteration: number, maxIterations: number, taskId?: string): void {
  emitEvent("iteration_start", {
    iteration,
    max_iterations: maxIterations,
    task_id: taskId,
  });
}

export function emitIterationEnd(iteration: number, status: "success" | "failure" | "skipped", taskId?: string): void {
  emitEvent("iteration_end", {
    iteration,
    status,
    task_id: taskId,
  });
}

export function emitTaskStart(taskId: string, title: string): void {
  emitEvent("task_start", {
    task_id: taskId,
    title,
  });
}

export function emitTaskComplete(taskId: string, title: string): void {
  emitEvent("task_complete", {
    task_id: taskId,
    title,
  });
}

export function emitTaskFailed(taskId: string, title: string, error: string): void {
  emitEvent("task_failed", {
    task_id: taskId,
    title,
    error,
  });
}

export function emitTestResult(passed: boolean, output: string, taskId?: string): void {
  emitEvent("test_result", {
    passed,
    output: output.slice(0, 1000),
    task_id: taskId,
  });
}

export function emitWorkflowStart(workflow: "bmad" | "beads", config: Record<string, unknown>): void {
  emitEvent("workflow_start", {
    workflow,
    config,
  });
}

export function emitWorkflowComplete(workflow: "bmad" | "beads", tasksCompleted: number): void {
  emitEvent("workflow_complete", {
    workflow,
    tasks_completed: tasksCompleted,
  });
}

export function emitCodexReview(status: "start" | "complete" | "failed", specFile: string, findings?: string): void {
  emitEvent("codex_review", {
    status,
    spec_file: specFile,
    findings: findings?.slice(0, 500),
  });
}

export function emitSpecParsed(specFile: string, taskCount: number): void {
  emitEvent("spec_parsed", {
    spec_file: specFile,
    task_count: taskCount,
  });
}

export function getSessionId(): string {
  return SESSION_ID;
}
