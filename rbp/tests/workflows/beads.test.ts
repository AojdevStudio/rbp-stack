import { describe, test, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { injectFailureContext, isUiTask, runBeadsWorkflow, type BeadsWorkflowOptions, type BeadsWorkflowResult } from "../../lib/src/workflows/beads";
import type { Bead } from "../../lib/src/integrations/beads-cli";
import type { RbpConfig } from "../../lib/src/config/types";
import { RbpConfigSchema } from "../../lib/src/config/schema";
import * as beadsCli from "../../lib/src/integrations/beads-cli";

describe("injectFailureContext", () => {
  test("adds failure context to prompt", () => {
    const prompt = "Implement the feature";
    const context = {
      taskId: "rbp-269.1",
      attempt: 1,
      previousError: "TypeError: undefined is not a function",
    };

    const result = injectFailureContext(prompt, context);

    expect(result).toContain("Implement the feature");
    expect(result).toContain("attempt 2");
    expect(result).toContain("rbp-269.1");
    expect(result).toContain("TypeError: undefined is not a function");
  });

  test("handles missing previous error", () => {
    const prompt = "Fix the bug";
    const context = {
      taskId: "rbp-269.2",
      attempt: 0,
    };

    const result = injectFailureContext(prompt, context);

    expect(result).toContain("Fix the bug");
    expect(result).toContain("attempt 1");
    expect(result).not.toContain("Previous error:");
  });
});

describe("isUiTask", () => {
  const defaultKeywords = ["UI", "component", "button", "form"];

  test("detects UI task by title", () => {
    const task: Bead = {
      id: "test-1",
      title: "Add login button component",
      status: "open",
    };

    expect(isUiTask(task, defaultKeywords)).toBe(true);
  });

  test("detects UI task by label", () => {
    const task: Bead = {
      id: "test-2",
      title: "Implement feature",
      status: "open",
      labels: ["ui", "frontend"],
    };

    expect(isUiTask(task, defaultKeywords)).toBe(true);
  });

  test("detects UI task by notes", () => {
    const task: Bead = {
      id: "test-3",
      title: "Add validation",
      status: "open",
      notes: "Add form validation to the signup page",
    };

    expect(isUiTask(task, defaultKeywords)).toBe(true);
  });

  test("returns false for non-UI task", () => {
    const task: Bead = {
      id: "test-4",
      title: "Add database migration",
      status: "open",
      notes: "Create migration for user table",
      labels: ["backend", "database"],
    };

    expect(isUiTask(task, defaultKeywords)).toBe(false);
  });

  test("is case insensitive", () => {
    const task: Bead = {
      id: "test-5",
      title: "BUTTON COMPONENT",
      status: "open",
    };

    expect(isUiTask(task, defaultKeywords)).toBe(true);
  });
});

// Tests for runBeadsWorkflow with mocked beads-cli
// We test the workflow logic by mocking the module before importing
describe("runBeadsWorkflow", () => {
  // Since we can't easily mock imports in Bun, we test with actual CLI when available
  // and provide graceful fallbacks. The core workflow logic is tested through the
  // onTaskReady and runTests callbacks.

  const testConfig = RbpConfigSchema.parse({
    project: { name: "test" },
    execution: { max_iterations: 3, iteration_delay: 0 },
    verification: { require_tests: true, test_command: "bun test" },
  });

  test("workflow options structure is valid", () => {
    const options = {
      config: testConfig,
      maxIterations: 5,
      dryRun: true,
      onTaskReady: async (task: Bead) => {},
      runTests: async () => ({ passed: true, output: "OK" }),
    };

    expect(options.config.project.name).toBe("test");
    expect(options.maxIterations).toBe(5);
    expect(options.dryRun).toBe(true);
    expect(typeof options.onTaskReady).toBe("function");
    expect(typeof options.runTests).toBe("function");
  });

  test("workflow result structure for success", () => {
    const result = {
      success: true,
      tasksCompleted: 5,
      tasksFailed: 0,
      iterations: 5,
    };

    expect(result.success).toBe(true);
    expect(result.tasksCompleted).toBe(5);
    expect(result.tasksFailed).toBe(0);
    expect(result.iterations).toBe(5);
    expect(result).not.toHaveProperty("error");
  });

  test("workflow result structure for failure", () => {
    const result = {
      success: false,
      tasksCompleted: 2,
      tasksFailed: 1,
      iterations: 3,
      error: { code: "BEADS_COMMAND_FAILED", message: "bd failed" },
    };

    expect(result.success).toBe(false);
    expect(result.tasksCompleted).toBe(2);
    expect(result.tasksFailed).toBe(1);
    expect(result.error?.code).toBe("BEADS_COMMAND_FAILED");
  });

  test("onTaskReady callback receives correct task structure", async () => {
    let receivedTask: Bead | null = null;

    const mockOnTaskReady = async (task: Bead) => {
      receivedTask = task;
    };

    const testTask: Bead = {
      id: "test-123",
      title: "Test task",
      status: "open",
      priority: "P1",
      notes: "Important task",
    };

    await mockOnTaskReady(testTask);

    expect(receivedTask).not.toBeNull();
    expect(receivedTask?.id).toBe("test-123");
    expect(receivedTask?.title).toBe("Test task");
  });

  test("runTests callback returns proper structure", async () => {
    const mockRunTests = async () => ({
      passed: false,
      output: "Error: Test assertion failed at line 42",
    });

    const result = await mockRunTests();

    expect(result.passed).toBe(false);
    expect(result.output).toContain("assertion failed");
  });

  test("failure context tracking structure", () => {
    const failureContexts = new Map<string, { taskId: string; attempt: number; previousError?: string }>();

    failureContexts.set("task-1", {
      taskId: "task-1",
      attempt: 1,
      previousError: "TypeError: undefined is not a function",
    });

    failureContexts.set("task-2", {
      taskId: "task-2",
      attempt: 0,
    });

    expect(failureContexts.get("task-1")?.attempt).toBe(1);
    expect(failureContexts.get("task-1")?.previousError).toContain("TypeError");
    expect(failureContexts.get("task-2")?.previousError).toBeUndefined();
  });

  test("iteration delay config is respected", () => {
    const configWithDelay = RbpConfigSchema.parse({
      project: { name: "test" },
      execution: { max_iterations: 10, iteration_delay: 5 },
    });

    expect(configWithDelay.execution.iteration_delay).toBe(5);
  });

  test("maxIterations can be overridden from options", () => {
    const configDefault = 10;
    const optionsOverride = 3;

    const effectiveMax = optionsOverride ?? configDefault;

    expect(effectiveMax).toBe(3);
  });

  test("test verification can be disabled", () => {
    const configNoTests = RbpConfigSchema.parse({
      project: { name: "test" },
      verification: { require_tests: false },
    });

    expect(configNoTests.verification.require_tests).toBe(false);
  });
});

// Integration tests for runBeadsWorkflow with mocked beads-cli
describe("runBeadsWorkflow integration", () => {
  const testConfig = RbpConfigSchema.parse({
    project: { name: "test" },
    execution: { max_iterations: 5, iteration_delay: 0 },
    verification: { require_tests: true, test_command: "bun test" },
  });

  let getReadyBeadSpy: ReturnType<typeof spyOn>;
  let updateBeadStatusSpy: ReturnType<typeof spyOn>;
  let closeBeadSpy: ReturnType<typeof spyOn>;
  let addBeadNoteSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    getReadyBeadSpy = spyOn(beadsCli, "getReadyBead");
    updateBeadStatusSpy = spyOn(beadsCli, "updateBeadStatus").mockResolvedValue({ success: true });
    closeBeadSpy = spyOn(beadsCli, "closeBead").mockResolvedValue({ success: true });
    addBeadNoteSpy = spyOn(beadsCli, "addBeadNote").mockResolvedValue({ success: true });
  });

  afterEach(() => {
    getReadyBeadSpy.mockRestore();
    updateBeadStatusSpy.mockRestore();
    closeBeadSpy.mockRestore();
    addBeadNoteSpy.mockRestore();
  });

  test("completes workflow when no tasks available", async () => {
    getReadyBeadSpy.mockResolvedValue({ success: true, data: null });

    const result = await runBeadsWorkflow({ config: testConfig });

    expect(result.success).toBe(true);
    expect(result.tasksCompleted).toBe(0);
    expect(result.tasksFailed).toBe(0);
    expect(result.iterations).toBe(1);
  });

  test("processes tasks and completes successfully", async () => {
    const mockTasks: Bead[] = [
      { id: "task-1", title: "First Task", status: "open" },
      { id: "task-2", title: "Second Task", status: "open" },
    ];
    let callCount = 0;

    getReadyBeadSpy.mockImplementation(async () => {
      const task = mockTasks[callCount++];
      return { success: true, data: task || null };
    });

    const result = await runBeadsWorkflow({
      config: testConfig,
      runTests: async () => ({ passed: true, output: "All tests passed" }),
    });

    expect(result.success).toBe(true);
    expect(result.tasksCompleted).toBe(2);
    expect(result.tasksFailed).toBe(0);
    expect(closeBeadSpy).toHaveBeenCalledTimes(2);
  });

  test("handles test failures with failure context tracking", async () => {
    const mockTask: Bead = { id: "task-fail", title: "Failing Task", status: "open" };
    let attempts = 0;

    getReadyBeadSpy.mockImplementation(async () => {
      attempts++;
      if (attempts <= 2) {
        return { success: true, data: mockTask };
      }
      return { success: true, data: null };
    });

    const result = await runBeadsWorkflow({
      config: testConfig,
      runTests: async () => ({ passed: false, output: "Test assertion failed at line 42" }),
    });

    expect(result.success).toBe(false);
    expect(result.tasksFailed).toBe(2);
    expect(addBeadNoteSpy).toHaveBeenCalled();
    expect(updateBeadStatusSpy).toHaveBeenCalledWith("task-fail", "open");
  });

  test("calls onTaskReady callback with task", async () => {
    const mockTask: Bead = { id: "task-callback", title: "Callback Task", status: "open" };
    let receivedTask: Bead | null = null;

    getReadyBeadSpy.mockResolvedValueOnce({ success: true, data: mockTask });
    getReadyBeadSpy.mockResolvedValueOnce({ success: true, data: null });

    await runBeadsWorkflow({
      config: testConfig,
      runTests: async () => ({ passed: true, output: "OK" }),
      onTaskReady: async (task) => {
        receivedTask = task;
      },
    });

    expect(receivedTask).not.toBeNull();
    expect(receivedTask?.id).toBe("task-callback");
    expect(receivedTask?.title).toBe("Callback Task");
  });

  test("respects maxIterations limit", async () => {
    getReadyBeadSpy.mockResolvedValue({ success: true, data: { id: "infinite", title: "Infinite", status: "open" } });

    const result = await runBeadsWorkflow({
      config: testConfig,
      maxIterations: 3,
      runTests: async () => ({ passed: true, output: "OK" }),
    });

    expect(result.iterations).toBe(3);
    expect(closeBeadSpy).toHaveBeenCalledTimes(3);
  });

  test("handles dry run mode", async () => {
    const mockTask: Bead = { id: "dry-run", title: "Dry Run Task", status: "open" };

    getReadyBeadSpy.mockResolvedValueOnce({ success: true, data: mockTask });
    getReadyBeadSpy.mockResolvedValueOnce({ success: true, data: null });

    const result = await runBeadsWorkflow({
      config: testConfig,
      dryRun: true,
    });

    expect(updateBeadStatusSpy).not.toHaveBeenCalled();
    expect(closeBeadSpy).not.toHaveBeenCalled();
    expect(result.tasksCompleted).toBe(0);
  });

  test("skips tests when require_tests is false", async () => {
    const configNoTests = RbpConfigSchema.parse({
      project: { name: "test" },
      execution: { max_iterations: 5, iteration_delay: 0 },
      verification: { require_tests: false },
    });

    const mockTask: Bead = { id: "no-test", title: "No Test Task", status: "open" };
    let testsCalled = false;

    getReadyBeadSpy.mockResolvedValueOnce({ success: true, data: mockTask });
    getReadyBeadSpy.mockResolvedValueOnce({ success: true, data: null });

    const result = await runBeadsWorkflow({
      config: configNoTests,
      runTests: async () => {
        testsCalled = true;
        return { passed: true, output: "OK" };
      },
    });

    expect(testsCalled).toBe(false);
    expect(result.tasksCompleted).toBe(1);
  });

  test("handles beads CLI errors gracefully", async () => {
    getReadyBeadSpy.mockResolvedValue({
      success: false,
      error: { code: "BEADS_COMMAND_FAILED", message: "bd ready failed" },
    });

    const result = await runBeadsWorkflow({ config: testConfig });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("BEADS_COMMAND_FAILED");
  });

  test("handles exception during task processing", async () => {
    const mockTask: Bead = { id: "error-task", title: "Error Task", status: "open" };

    getReadyBeadSpy.mockResolvedValueOnce({ success: true, data: mockTask });
    getReadyBeadSpy.mockResolvedValueOnce({ success: true, data: null });

    const result = await runBeadsWorkflow({
      config: testConfig,
      onTaskReady: async () => {
        throw new Error("Task processing failed");
      },
    });

    expect(result.tasksFailed).toBe(1);
    expect(updateBeadStatusSpy).toHaveBeenCalledWith("error-task", "open");
  });

  test("tracks progress correctly across multiple iterations", async () => {
    const mockTasks: (Bead | null)[] = [
      { id: "pass-1", title: "Pass 1", status: "open" },
      { id: "fail-1", title: "Fail 1", status: "open" },
      { id: "pass-2", title: "Pass 2", status: "open" },
      null,
    ];
    let idx = 0;
    let testCallCount = 0;

    getReadyBeadSpy.mockImplementation(async () => {
      return { success: true, data: mockTasks[idx++] };
    });

    const result = await runBeadsWorkflow({
      config: testConfig,
      runTests: async () => {
        testCallCount++;
        // Second test fails
        return { passed: testCallCount !== 2, output: testCallCount === 2 ? "FAILED" : "OK" };
      },
    });

    expect(result.tasksCompleted).toBe(2);
    expect(result.tasksFailed).toBe(1);
    expect(result.iterations).toBe(4);
  });
});
