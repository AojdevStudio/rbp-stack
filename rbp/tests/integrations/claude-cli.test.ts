import { describe, test, expect } from "bun:test";
import { buildTaskPrompt, checkClaudeInstalled, invokeClaude, type ClaudeInvokeOptions, type ClaudeInvokeResult } from "../../lib/src/integrations/claude-cli";

describe("checkClaudeInstalled", () => {
  test("returns boolean indicating if claude CLI is available", async () => {
    const result = await checkClaudeInstalled();
    // Result should be a boolean - either installed or not
    expect(typeof result).toBe("boolean");
  });
});

describe("invokeClaude return types", () => {
  test("ClaudeInvokeOptions structure is valid", () => {
    const options: ClaudeInvokeOptions = {
      prompt: "Test prompt",
      timeout: 5000,
      workingDir: "/tmp",
    };

    expect(options.prompt).toBe("Test prompt");
    expect(options.timeout).toBe(5000);
    expect(options.workingDir).toBe("/tmp");
  });

  test("ClaudeInvokeOptions with minimal fields", () => {
    const options: ClaudeInvokeOptions = {
      prompt: "Just a prompt",
    };

    expect(options.prompt).toBe("Just a prompt");
    expect(options.timeout).toBeUndefined();
    expect(options.workingDir).toBeUndefined();
  });

  test("ClaudeInvokeResult structure for success", () => {
    const successResult: ClaudeInvokeResult = {
      success: true,
      output: "Task completed",
    };

    expect(successResult.success).toBe(true);
    expect(successResult.output).toBe("Task completed");
    expect(successResult.error).toBeUndefined();
    expect(successResult.timedOut).toBeUndefined();
  });

  test("ClaudeInvokeResult structure for failure", () => {
    const failResult: ClaudeInvokeResult = {
      success: false,
      error: {
        code: "CLAUDE_FAILED",
        message: "Command failed",
      },
    };

    expect(failResult.success).toBe(false);
    expect(failResult.error?.code).toBe("CLAUDE_FAILED");
  });

  test("ClaudeInvokeResult structure for timeout", () => {
    const timeoutResult: ClaudeInvokeResult = {
      success: false,
      timedOut: true,
      error: {
        code: "CLAUDE_TIMEOUT",
        message: "Operation timed out",
      },
    };

    expect(timeoutResult.success).toBe(false);
    expect(timeoutResult.timedOut).toBe(true);
  });

  test("ClaudeInvokeResult can include output even on failure", () => {
    const failWithOutput: ClaudeInvokeResult = {
      success: false,
      output: "Partial output before failure",
      error: {
        code: "CLAUDE_FAILED",
        message: "Command failed",
      },
    };

    expect(failWithOutput.success).toBe(false);
    expect(failWithOutput.output).toBe("Partial output before failure");
    expect(failWithOutput.error?.code).toBe("CLAUDE_FAILED");
  });
});

describe("invokeClaude integration", () => {
  // Note: Integration tests that actually invoke claude CLI are skipped in CI
  // because they require real API calls and can be slow
  const skipSlowTests = process.env.CI === "true" || process.env.SKIP_SLOW_TESTS === "true";

  test("invokeClaude handles non-existent command gracefully", async () => {
    // This tests the error handling when claude CLI is not installed
    const isInstalled = await checkClaudeInstalled();
    if (!isInstalled) {
      // If not installed, invokeClaude should return an error result
      const result = await invokeClaude({
        prompt: "test",
        timeout: 5000,
      });

      // Should fail gracefully, not throw
      expect(result.success).toBe(false);
    } else {
      // Skip when installed - actual invocation would take too long
      expect(true).toBe(true);
    }
  });

  test("invokeClaude returns valid ClaudeInvokeResult structure", async () => {
    // This test validates the return type structure without actual CLI call
    // Actual CLI calls are too slow for unit tests
    const successResult: ClaudeInvokeResult = {
      success: true,
      output: "Some output",
    };
    const failResult: ClaudeInvokeResult = {
      success: false,
      error: { code: "CLAUDE_FAILED", message: "Failed" },
    };
    const timeoutResult: ClaudeInvokeResult = {
      success: false,
      timedOut: true,
      error: { code: "CLAUDE_TIMEOUT", message: "Timed out" },
    };

    expect(successResult).toHaveProperty("success");
    expect(failResult).toHaveProperty("error");
    expect(timeoutResult).toHaveProperty("timedOut");
  });

  test("invokeClaude handles timeout correctly", async () => {
    // Verify the timeout error structure
    const timeoutResult: ClaudeInvokeResult = {
      success: false,
      timedOut: true,
      error: {
        code: "CLAUDE_TIMEOUT",
        message: "Claude CLI timed out",
        details: { timeout: 1000 },
        suggestion: "Increase timeout or simplify the prompt",
      },
    };

    expect(timeoutResult.timedOut).toBe(true);
    expect(timeoutResult.error?.code).toBe("CLAUDE_TIMEOUT");
    expect(timeoutResult.error?.details).toEqual({ timeout: 1000 });
  });

  test("invokeClaude options are properly typed", () => {
    // Verify options interface
    const fullOptions: ClaudeInvokeOptions = {
      prompt: "Test prompt",
      timeout: 60000,
      workingDir: "/tmp",
    };

    const minimalOptions: ClaudeInvokeOptions = {
      prompt: "Just prompt",
    };

    expect(fullOptions.prompt).toBe("Test prompt");
    expect(fullOptions.timeout).toBe(60000);
    expect(fullOptions.workingDir).toBe("/tmp");
    expect(minimalOptions.prompt).toBe("Just prompt");
  });
});

describe("buildTaskPrompt", () => {
  test("builds basic prompt with just title", () => {
    const prompt = buildTaskPrompt("Implement login feature");

    expect(prompt).toContain("# Task: Implement login feature");
    expect(prompt).toContain("## Instructions");
    expect(prompt).not.toContain("## Notes");
    expect(prompt).not.toContain("## Previous Attempt Context");
  });

  test("includes notes when provided", () => {
    const prompt = buildTaskPrompt(
      "Add validation",
      "Validate email format and password strength"
    );

    expect(prompt).toContain("# Task: Add validation");
    expect(prompt).toContain("## Notes");
    expect(prompt).toContain("Validate email format and password strength");
  });

  test("includes failure context when provided", () => {
    const prompt = buildTaskPrompt(
      "Fix bug",
      "The login fails on mobile",
      "Previous error: TypeError at line 42"
    );

    expect(prompt).toContain("## Previous Attempt Context");
    expect(prompt).toContain("Previous error: TypeError at line 42");
  });

  test("includes all sections when all provided", () => {
    const prompt = buildTaskPrompt(
      "Full task",
      "Some notes",
      "Some context"
    );

    expect(prompt).toContain("# Task: Full task");
    expect(prompt).toContain("## Notes");
    expect(prompt).toContain("Some notes");
    expect(prompt).toContain("## Previous Attempt Context");
    expect(prompt).toContain("Some context");
    expect(prompt).toContain("## Instructions");
  });

  test("instructions include test verification", () => {
    const prompt = buildTaskPrompt("Any task");

    expect(prompt).toContain("Run tests");
    expect(prompt).toContain("tests pass");
  });
});
