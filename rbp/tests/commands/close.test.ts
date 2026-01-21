import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { closeCommandDef, closeCommand, type CloseOptions } from "../../lib/src/commands/close";
import * as beadsCli from "../../lib/src/integrations/beads-cli";
import * as events from "../../lib/src/observability/events";
import * as cli from "../../lib/src/cli";
import * as errors from "../../lib/src/utils/errors";
import type { Bead } from "../../lib/src/integrations/beads-cli";
import { RbpConfigSchema } from "../../lib/src/config/schema";

describe("closeCommandDef configuration", () => {
  test("has correct name", () => {
    expect(closeCommandDef.name()).toBe("close");
  });

  test("has correct description", () => {
    expect(closeCommandDef.description()).toBe("Close a task with test verification");
  });

  test("has --force option with -f short flag", () => {
    const opt = closeCommandDef.options.find((o) => o.long === "--force");
    expect(opt).toBeDefined();
    expect(opt?.short).toBe("-f");
  });

  test("has --dry-run option", () => {
    const opt = closeCommandDef.options.find((o) => o.long === "--dry-run");
    expect(opt).toBeDefined();
  });

  test("all options are optional", () => {
    const forceOpt = closeCommandDef.options.find((o) => o.long === "--force");
    const dryRunOpt = closeCommandDef.options.find((o) => o.long === "--dry-run");

    expect(forceOpt?.required).toBeFalsy();
    expect(dryRunOpt?.required).toBeFalsy();
  });
});

describe("closeCommandDef argument validation", () => {
  test("requires id argument", () => {
    const args = closeCommandDef.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].required).toBe(true);
  });

  test("id argument has correct name", () => {
    const args = closeCommandDef.registeredArguments;
    expect(args[0].name()).toBe("id");
  });

  test("id argument has description", () => {
    const args = closeCommandDef.registeredArguments;
    expect(args[0].description).toBe("Task ID to close");
  });
});

describe("CloseOptions type", () => {
  test("all properties are optional", () => {
    const emptyOpts: CloseOptions = {};
    expect(emptyOpts.force).toBeUndefined();
    expect(emptyOpts.dryRun).toBeUndefined();
  });

  test("accepts all properties", () => {
    const fullOpts: CloseOptions = {
      force: true,
      dryRun: true,
    };

    expect(fullOpts.force).toBe(true);
    expect(fullOpts.dryRun).toBe(true);
  });
});

describe("closeCommandDef help", () => {
  test("help output contains description", () => {
    const helpInfo = closeCommandDef.helpInformation();
    expect(helpInfo).toContain("Close a task with test verification");
  });

  test("help output contains argument description", () => {
    const helpInfo = closeCommandDef.helpInformation();
    expect(helpInfo).toContain("id");
    expect(helpInfo).toContain("Task ID to close");
  });

  test("help output contains options", () => {
    const helpInfo = closeCommandDef.helpInformation();
    expect(helpInfo).toContain("--force");
    expect(helpInfo).toContain("--dry-run");
    expect(helpInfo).toContain("-f");
  });

  test("help output contains option descriptions", () => {
    const helpInfo = closeCommandDef.helpInformation();
    expect(helpInfo).toContain("Force close without running tests");
    expect(helpInfo).toContain("Show what would happen without executing");
  });
});

// Integration tests for closeCommand function behavior
describe("closeCommand integration", () => {
  const mockBead: Bead = {
    id: "test-123",
    title: "Test task to close",
    status: "in_progress",
    priority: 1,
    notes: "Implementation notes",
  };

  const mockConfig = RbpConfigSchema.parse({
    project: { name: "test-project" },
    execution: { max_iterations: 10, iteration_delay: 0 },
    verification: {
      require_tests: true,
      test_command: "bun test",
      playwright_command: "bunx playwright test",
      require_playwright_for_ui: true,
    },
    ui_detection: { keywords: ["UI", "button", "form", "component"] },
  });

  let showBeadSpy: ReturnType<typeof spyOn>;
  let closeBeadSpy: ReturnType<typeof spyOn>;
  let addBeadNoteSpy: ReturnType<typeof spyOn>;
  let emitTestResultSpy: ReturnType<typeof spyOn>;
  let emitTaskCompleteSpy: ReturnType<typeof spyOn>;
  let emitTaskFailedSpy: ReturnType<typeof spyOn>;
  let getGlobalOptionsSpy: ReturnType<typeof spyOn>;
  let getConfigSpy: ReturnType<typeof spyOn>;
  let exitWithErrorSpy: ReturnType<typeof spyOn>;
  let originalSpawn: typeof Bun.spawn;

  beforeEach(() => {
    // Mock beads-cli functions
    showBeadSpy = spyOn(beadsCli, "showBead");
    closeBeadSpy = spyOn(beadsCli, "closeBead").mockResolvedValue({ success: true });
    addBeadNoteSpy = spyOn(beadsCli, "addBeadNote").mockResolvedValue({ success: true });

    // Mock event emitters
    emitTestResultSpy = spyOn(events, "emitTestResult").mockImplementation(() => {});
    emitTaskCompleteSpy = spyOn(events, "emitTaskComplete").mockImplementation(() => {});
    emitTaskFailedSpy = spyOn(events, "emitTaskFailed").mockImplementation(() => {});

    // Mock CLI functions
    getGlobalOptionsSpy = spyOn(cli, "getGlobalOptions").mockReturnValue({});
    getConfigSpy = spyOn(cli, "getConfig").mockReturnValue(mockConfig);

    // Mock exitWithError to throw instead of process.exit
    exitWithErrorSpy = spyOn(errors, "exitWithError").mockImplementation((error) => {
      throw new Error(`EXIT: ${error.code} - ${error.message}`);
    });

    // Store original Bun.spawn for restoration
    originalSpawn = Bun.spawn;
  });

  afterEach(() => {
    showBeadSpy.mockRestore();
    closeBeadSpy.mockRestore();
    addBeadNoteSpy.mockRestore();
    emitTestResultSpy.mockRestore();
    emitTaskCompleteSpy.mockRestore();
    emitTaskFailedSpy.mockRestore();
    getGlobalOptionsSpy.mockRestore();
    getConfigSpy.mockRestore();
    exitWithErrorSpy.mockRestore();
    // @ts-ignore - restore original spawn
    Bun.spawn = originalSpawn;
  });

  test("exits with error when task is not found", async () => {
    showBeadSpy.mockResolvedValue({
      success: false,
      error: { code: "BEADS_COMMAND_FAILED", message: "Task not found" },
    });

    await expect(closeCommand("nonexistent", {})).rejects.toThrow("EXIT:");
    expect(closeBeadSpy).not.toHaveBeenCalled();
  });

  test("runs tests before closing when require_tests is true", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    let testCommandRan = false;
    // @ts-ignore - mock Bun.spawn
    Bun.spawn = (cmd: string[]) => {
      if (cmd.includes("test")) {
        testCommandRan = true;
      }
      return {
        stdout: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("All tests passed"));
            controller.close();
          },
        }),
        stderr: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        exited: Promise.resolve(0),
      };
    };

    await closeCommand("test-123", {});

    expect(testCommandRan).toBe(true);
    expect(emitTestResultSpy).toHaveBeenCalledWith(true, expect.any(String), "test-123");
    expect(closeBeadSpy).toHaveBeenCalledWith("test-123");
  });

  test("closes bead only when tests pass", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    // @ts-ignore - mock Bun.spawn with passing tests
    Bun.spawn = () => ({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("Tests passed"));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      exited: Promise.resolve(0),
    });

    await closeCommand("test-123", {});

    expect(closeBeadSpy).toHaveBeenCalledWith("test-123");
    expect(emitTaskCompleteSpy).toHaveBeenCalledWith("test-123", mockBead.title);
  });

  test("does not close bead when tests fail", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    // @ts-ignore - mock Bun.spawn with failing tests
    Bun.spawn = () => ({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("Test assertion failed"));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      exited: Promise.resolve(1), // Non-zero exit code
    });

    await expect(closeCommand("test-123", {})).rejects.toThrow("EXIT: TEST_FAILED");

    expect(closeBeadSpy).not.toHaveBeenCalled();
    expect(emitTestResultSpy).toHaveBeenCalledWith(false, expect.any(String), "test-123");
    expect(emitTaskFailedSpy).toHaveBeenCalledWith("test-123", mockBead.title, "Tests failed");
    expect(addBeadNoteSpy).toHaveBeenCalled();
  });

  test("emits task_complete event on successful close", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    // @ts-ignore - mock passing tests
    Bun.spawn = () => ({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("OK"));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      exited: Promise.resolve(0),
    });

    await closeCommand("test-123", {});

    expect(emitTaskCompleteSpy).toHaveBeenCalledWith("test-123", "Test task to close");
  });

  test("emits task_failed event when tests fail", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    // @ts-ignore - mock failing tests
    Bun.spawn = () => ({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("FAILED"));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      exited: Promise.resolve(1),
    });

    await expect(closeCommand("test-123", {})).rejects.toThrow();

    expect(emitTaskFailedSpy).toHaveBeenCalledWith("test-123", "Test task to close", "Tests failed");
  });

  test("emits test_result event with passed=true when tests pass", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    // @ts-ignore
    Bun.spawn = () => ({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("All 42 tests passed"));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      exited: Promise.resolve(0),
    });

    await closeCommand("test-123", {});

    expect(emitTestResultSpy).toHaveBeenCalledWith(true, "All 42 tests passed", "test-123");
  });

  test("emits test_result event with passed=false when tests fail", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    // @ts-ignore
    Bun.spawn = () => ({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("3 tests failed"));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      exited: Promise.resolve(1),
    });

    await expect(closeCommand("test-123", {})).rejects.toThrow();

    expect(emitTestResultSpy).toHaveBeenCalledWith(false, "3 tests failed", "test-123");
  });

  test("force flag skips test execution", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    let spawnCalled = false;
    // @ts-ignore
    Bun.spawn = () => {
      spawnCalled = true;
      return {
        stdout: new ReadableStream({ start(c) { c.close(); } }),
        stderr: new ReadableStream({ start(c) { c.close(); } }),
        exited: Promise.resolve(0),
      };
    };

    await closeCommand("test-123", { force: true });

    expect(spawnCalled).toBe(false);
    expect(emitTestResultSpy).not.toHaveBeenCalled();
    expect(closeBeadSpy).toHaveBeenCalledWith("test-123");
  });

  test("dry-run does not execute tests or close bead", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    let spawnCalled = false;
    // @ts-ignore
    Bun.spawn = () => {
      spawnCalled = true;
      return {
        stdout: new ReadableStream({ start(c) { c.close(); } }),
        stderr: new ReadableStream({ start(c) { c.close(); } }),
        exited: Promise.resolve(0),
      };
    };

    await closeCommand("test-123", { dryRun: true });

    expect(spawnCalled).toBe(false);
    expect(closeBeadSpy).not.toHaveBeenCalled();
    expect(emitTaskCompleteSpy).not.toHaveBeenCalled();
  });

  test("adds failure note to bead when tests fail", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    // @ts-ignore
    Bun.spawn = () => ({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("Error: assertion failed at test.ts:42"));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      exited: Promise.resolve(1),
    });

    await expect(closeCommand("test-123", {})).rejects.toThrow();

    expect(addBeadNoteSpy).toHaveBeenCalledWith(
      "test-123",
      expect.stringContaining("Test failure:")
    );
  });

  test("uses playwright command for UI tasks", async () => {
    const uiBead: Bead = {
      ...mockBead,
      title: "Add login button component",
      labels: ["ui", "frontend"],
    };
    showBeadSpy.mockResolvedValue({ success: true, data: uiBead });

    let commandUsed: string[] = [];
    // @ts-ignore
    Bun.spawn = (cmd: string[]) => {
      commandUsed = cmd;
      return {
        stdout: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("OK"));
            controller.close();
          },
        }),
        stderr: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        exited: Promise.resolve(0),
      };
    };

    await closeCommand("test-123", {});

    expect(commandUsed.join(" ")).toContain("playwright");
  });

  test("uses regular test command for non-UI tasks", async () => {
    const backendBead: Bead = {
      ...mockBead,
      title: "Add database migration",
      labels: ["backend"],
    };
    showBeadSpy.mockResolvedValue({ success: true, data: backendBead });

    let commandUsed: string[] = [];
    // @ts-ignore
    Bun.spawn = (cmd: string[]) => {
      commandUsed = cmd;
      return {
        stdout: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("OK"));
            controller.close();
          },
        }),
        stderr: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        exited: Promise.resolve(0),
      };
    };

    await closeCommand("test-123", {});

    expect(commandUsed.join(" ")).not.toContain("playwright");
    expect(commandUsed.join(" ")).toContain("test");
  });

  test("exits with error when closeBead fails", async () => {
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });
    closeBeadSpy.mockResolvedValue({
      success: false,
      error: { code: "BEADS_COMMAND_FAILED", message: "Failed to close" },
    });

    // @ts-ignore - mock passing tests
    Bun.spawn = () => ({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("OK"));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      exited: Promise.resolve(0),
    });

    await expect(closeCommand("test-123", {})).rejects.toThrow("EXIT: BEADS_COMMAND_FAILED");
  });

  test("skips tests when require_tests config is false", async () => {
    const noTestConfig = RbpConfigSchema.parse({
      project: { name: "test" },
      verification: { require_tests: false },
    });
    getConfigSpy.mockReturnValue(noTestConfig);
    showBeadSpy.mockResolvedValue({ success: true, data: mockBead });

    let spawnCalled = false;
    // @ts-ignore
    Bun.spawn = () => {
      spawnCalled = true;
      return {
        stdout: new ReadableStream({ start(c) { c.close(); } }),
        stderr: new ReadableStream({ start(c) { c.close(); } }),
        exited: Promise.resolve(0),
      };
    };

    await closeCommand("test-123", {});

    expect(spawnCalled).toBe(false);
    expect(closeBeadSpy).toHaveBeenCalledWith("test-123");
  });
});
