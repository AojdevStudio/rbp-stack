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
