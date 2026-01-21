import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, readFileSync, rmSync, mkdirSync } from "fs";
import { homedir } from "os";
import {
  emitEvent,
  getSessionId,
  emitIterationStart,
  emitIterationEnd,
  emitTaskStart,
  emitTaskComplete,
  emitTaskFailed,
  emitTestResult,
  emitWorkflowStart,
  emitWorkflowComplete,
  emitCodexReview,
  emitSpecParsed,
} from "../../lib/src/observability/events";

describe("events", () => {
  const testDir = `${homedir()}/.claude/history/raw-outputs`;

  test("getSessionId returns consistent value", () => {
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);
  });

  test("emitEvent creates valid JSONL", () => {
    emitEvent("test_event", { key: "value", count: 42 });

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const date = `${yearMonth}-${String(now.getDate()).padStart(2, "0")}`;
    const filePath = `${testDir}/${yearMonth}/${date}_all-events.jsonl`;

    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const event = JSON.parse(lastLine);

    expect(event.event_type).toBe("test_event");
    expect(event.data.key).toBe("value");
    expect(event.data.count).toBe(42);
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.session_id).toBe(getSessionId());
  });

  test("emitEvent sanitizes sensitive data", () => {
    emitEvent("sensitive_test", {
      normal: "safe data",
      secret: "api_key=sk-12345678901234567890abcdef",
    });

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const date = `${yearMonth}-${String(now.getDate()).padStart(2, "0")}`;
    const filePath = `${testDir}/${yearMonth}/${date}_all-events.jsonl`;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const event = JSON.parse(lastLine);

    expect(event.data.normal).toBe("safe data");
    expect(event.data.secret).toContain("[REDACTED]");
    expect(event.data.secret).not.toContain("sk-12345678901234567890abcdef");
  });
});

describe("event emission functions", () => {
  const testDir = `${homedir()}/.claude/history/raw-outputs`;

  function getLatestEvent(): Record<string, unknown> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const date = `${yearMonth}-${String(now.getDate()).padStart(2, "0")}`;
    const filePath = `${testDir}/${yearMonth}/${date}_all-events.jsonl`;
    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    return JSON.parse(lines[lines.length - 1]);
  }

  test("emitIterationStart emits correct event", () => {
    emitIterationStart(1, 10, "task-123");
    const event = getLatestEvent();

    expect(event.event_type).toBe("iteration_start");
    expect((event.data as Record<string, unknown>).iteration).toBe(1);
    expect((event.data as Record<string, unknown>).max_iterations).toBe(10);
    expect((event.data as Record<string, unknown>).task_id).toBe("task-123");
  });

  test("emitIterationStart works without taskId", () => {
    emitIterationStart(2, 5);
    const event = getLatestEvent();

    expect(event.event_type).toBe("iteration_start");
    expect((event.data as Record<string, unknown>).iteration).toBe(2);
    expect((event.data as Record<string, unknown>).task_id).toBeUndefined();
  });

  test("emitIterationEnd emits correct event", () => {
    emitIterationEnd(3, "success", "task-456");
    const event = getLatestEvent();

    expect(event.event_type).toBe("iteration_end");
    expect((event.data as Record<string, unknown>).iteration).toBe(3);
    expect((event.data as Record<string, unknown>).status).toBe("success");
    expect((event.data as Record<string, unknown>).task_id).toBe("task-456");
  });

  test("emitIterationEnd handles failure status", () => {
    emitIterationEnd(4, "failure");
    const event = getLatestEvent();

    expect(event.event_type).toBe("iteration_end");
    expect((event.data as Record<string, unknown>).status).toBe("failure");
  });

  test("emitIterationEnd handles skipped status", () => {
    emitIterationEnd(5, "skipped");
    const event = getLatestEvent();

    expect(event.event_type).toBe("iteration_end");
    expect((event.data as Record<string, unknown>).status).toBe("skipped");
  });

  test("emitTaskStart emits correct event", () => {
    emitTaskStart("task-789", "Implement feature X");
    const event = getLatestEvent();

    expect(event.event_type).toBe("task_start");
    expect((event.data as Record<string, unknown>).task_id).toBe("task-789");
    expect((event.data as Record<string, unknown>).title).toBe("Implement feature X");
  });

  test("emitTaskComplete emits correct event", () => {
    emitTaskComplete("task-abc", "Feature completed");
    const event = getLatestEvent();

    expect(event.event_type).toBe("task_complete");
    expect((event.data as Record<string, unknown>).task_id).toBe("task-abc");
    expect((event.data as Record<string, unknown>).title).toBe("Feature completed");
  });

  test("emitTaskFailed emits correct event", () => {
    emitTaskFailed("task-def", "Fix bug", "Tests failed with assertion error");
    const event = getLatestEvent();

    expect(event.event_type).toBe("task_failed");
    expect((event.data as Record<string, unknown>).task_id).toBe("task-def");
    expect((event.data as Record<string, unknown>).title).toBe("Fix bug");
    expect((event.data as Record<string, unknown>).error).toBe("Tests failed with assertion error");
  });

  test("emitTestResult emits correct event for passed tests", () => {
    emitTestResult(true, "All 10 tests passed", "task-test");
    const event = getLatestEvent();

    expect(event.event_type).toBe("test_result");
    expect((event.data as Record<string, unknown>).passed).toBe(true);
    expect((event.data as Record<string, unknown>).output).toBe("All 10 tests passed");
    expect((event.data as Record<string, unknown>).task_id).toBe("task-test");
  });

  test("emitTestResult emits correct event for failed tests", () => {
    emitTestResult(false, "2 tests failed: TypeError at line 42", "task-test2");
    const event = getLatestEvent();

    expect(event.event_type).toBe("test_result");
    expect((event.data as Record<string, unknown>).passed).toBe(false);
    expect((event.data as Record<string, unknown>).output).toContain("2 tests failed");
  });

  test("emitTestResult truncates long output", () => {
    const longOutput = "x".repeat(2000);
    emitTestResult(true, longOutput);
    const event = getLatestEvent();

    expect((event.data as Record<string, unknown>).output).toHaveLength(1000);
  });

  test("emitWorkflowStart emits correct event for bmad", () => {
    emitWorkflowStart("bmad", { epic: "1", stories: 5 });
    const event = getLatestEvent();

    expect(event.event_type).toBe("workflow_start");
    expect((event.data as Record<string, unknown>).workflow).toBe("bmad");
    expect((event.data as Record<string, unknown>).config).toEqual({ epic: "1", stories: 5 });
  });

  test("emitWorkflowStart emits correct event for beads", () => {
    emitWorkflowStart("beads", { maxIterations: 10 });
    const event = getLatestEvent();

    expect(event.event_type).toBe("workflow_start");
    expect((event.data as Record<string, unknown>).workflow).toBe("beads");
  });

  test("emitWorkflowComplete emits correct event", () => {
    emitWorkflowComplete("beads", 7);
    const event = getLatestEvent();

    expect(event.event_type).toBe("workflow_complete");
    expect((event.data as Record<string, unknown>).workflow).toBe("beads");
    expect((event.data as Record<string, unknown>).tasks_completed).toBe(7);
  });

  test("emitCodexReview emits start event", () => {
    emitCodexReview("start", "spec/feature.md");
    const event = getLatestEvent();

    expect(event.event_type).toBe("codex_review");
    expect((event.data as Record<string, unknown>).status).toBe("start");
    expect((event.data as Record<string, unknown>).spec_file).toBe("spec/feature.md");
  });

  test("emitCodexReview emits complete event with findings", () => {
    emitCodexReview("complete", "spec/feature.md", "Found 3 issues");
    const event = getLatestEvent();

    expect(event.event_type).toBe("codex_review");
    expect((event.data as Record<string, unknown>).status).toBe("complete");
    expect((event.data as Record<string, unknown>).findings).toBe("Found 3 issues");
  });

  test("emitCodexReview emits failed event", () => {
    emitCodexReview("failed", "spec/broken.md");
    const event = getLatestEvent();

    expect(event.event_type).toBe("codex_review");
    expect((event.data as Record<string, unknown>).status).toBe("failed");
  });

  test("emitCodexReview truncates long findings", () => {
    const longFindings = "y".repeat(1000);
    emitCodexReview("complete", "spec/test.md", longFindings);
    const event = getLatestEvent();

    expect((event.data as Record<string, unknown>).findings).toHaveLength(500);
  });

  test("emitSpecParsed emits correct event", () => {
    emitSpecParsed("spec/new-feature.md", 12);
    const event = getLatestEvent();

    expect(event.event_type).toBe("spec_parsed");
    expect((event.data as Record<string, unknown>).spec_file).toBe("spec/new-feature.md");
    expect((event.data as Record<string, unknown>).task_count).toBe(12);
  });
});
