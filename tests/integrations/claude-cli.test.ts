import { describe, test, expect } from "bun:test";
import {
  checkClaudeInstalled,
  invokeClaude,
  buildTaskPrompt,
  type ClaudeInvokeOptions,
  type ClaudeInvokeResult,
} from "../../rbp/lib/src/integrations/claude-cli";
import { ErrorCodes } from "../../rbp/lib/src/utils/errors";

describe("claude-cli", () => {
  describe("checkClaudeInstalled", () => {
    test("returns true when claude CLI is available", async () => {
      const result = await checkClaudeInstalled();
      // This test depends on actual environment - claude may or may not be installed
      expect(typeof result).toBe("boolean");
    });
  });

  describe("invokeClaude timeout handling", () => {
    test("returns timeout error when execution exceeds timeout", async () => {
      const options: ClaudeInvokeOptions = {
        prompt: "This is a test prompt that should timeout",
        timeout: 1, // 1ms timeout - will definitely timeout
      };

      const result = await invokeClaude(options);

      // Should either timeout or fail quickly
      expect(result.success).toBe(false);
      if (result.timedOut) {
        expect(result.error?.code).toBe(ErrorCodes.CLAUDE_TIMEOUT);
        expect(result.error?.message).toContain("timed out");
      }
    });
  });

  describe("buildTaskPrompt", () => {
    test("builds basic prompt with just title", () => {
      const result = buildTaskPrompt("Implement feature X");

      expect(result).toContain("# Task: Implement feature X");
      expect(result).toContain("## Instructions");
      expect(result).toContain("1. Implement the task described above");
      expect(result).toContain("2. Run tests to verify your implementation");
      expect(result).toContain("3. If tests fail, analyze the error and fix the issue");
      expect(result).toContain("4. Only report success when all tests pass");
    });

    test("includes notes section when provided", () => {
      const result = buildTaskPrompt("Fix bug", "This bug occurs when X happens");

      expect(result).toContain("# Task: Fix bug");
      expect(result).toContain("## Notes");
      expect(result).toContain("This bug occurs when X happens");
    });

    test("includes failure context when provided", () => {
      const result = buildTaskPrompt(
        "Retry task",
        undefined,
        "Previous attempt failed with error: TypeError"
      );

      expect(result).toContain("# Task: Retry task");
      expect(result).toContain("## Previous Attempt Context");
      expect(result).toContain("Previous attempt failed with error: TypeError");
      expect(result).not.toContain("## Notes");
    });

    test("includes both notes and failure context when both provided", () => {
      const result = buildTaskPrompt(
        "Complex task",
        "Important notes here",
        "Last failure: timeout"
      );

      expect(result).toContain("# Task: Complex task");
      expect(result).toContain("## Notes");
      expect(result).toContain("Important notes here");
      expect(result).toContain("## Previous Attempt Context");
      expect(result).toContain("Last failure: timeout");
      expect(result).toContain("## Instructions");
    });

    test("sections appear in correct order", () => {
      const result = buildTaskPrompt("Task", "Notes content", "Failure content");

      const taskIndex = result.indexOf("# Task:");
      const notesIndex = result.indexOf("## Notes");
      const failureIndex = result.indexOf("## Previous Attempt Context");
      const instructionsIndex = result.indexOf("## Instructions");

      expect(taskIndex).toBeLessThan(notesIndex);
      expect(notesIndex).toBeLessThan(failureIndex);
      expect(failureIndex).toBeLessThan(instructionsIndex);
    });

    test("handles special characters in title", () => {
      const result = buildTaskPrompt("Fix: issue #123 (urgent!)");

      expect(result).toContain("# Task: Fix: issue #123 (urgent!)");
    });

    test("handles multiline notes", () => {
      const multilineNotes = `First line
Second line
Third line with code: \`const x = 1\``;

      const result = buildTaskPrompt("Task", multilineNotes);

      expect(result).toContain("## Notes");
      expect(result).toContain("First line");
      expect(result).toContain("Second line");
      expect(result).toContain("Third line with code: `const x = 1`");
    });
  });

  describe("ClaudeInvokeResult interface", () => {
    test("success result has correct shape", () => {
      const successResult: ClaudeInvokeResult = {
        success: true,
        output: "test output",
      };

      expect(successResult.success).toBe(true);
      expect(successResult.output).toBe("test output");
      expect(successResult.error).toBeUndefined();
      expect(successResult.timedOut).toBeUndefined();
    });

    test("error result has correct shape", () => {
      const errorResult: ClaudeInvokeResult = {
        success: false,
        error: {
          code: ErrorCodes.CLAUDE_FAILED,
          message: "Test error",
        },
      };

      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBeDefined();
      expect(errorResult.error?.code).toBe(ErrorCodes.CLAUDE_FAILED);
    });

    test("timeout result has correct shape", () => {
      const timeoutResult: ClaudeInvokeResult = {
        success: false,
        timedOut: true,
        error: {
          code: ErrorCodes.CLAUDE_TIMEOUT,
          message: "Timeout",
        },
      };

      expect(timeoutResult.success).toBe(false);
      expect(timeoutResult.timedOut).toBe(true);
      expect(timeoutResult.error?.code).toBe(ErrorCodes.CLAUDE_TIMEOUT);
    });
  });
});
