import { describe, test, expect } from "bun:test";
import {
  parseSlashCommandResult,
  buildSlashCommand,
  validateSlashCommand,
  type BmadInvokeResult,
  type BmadCommandResult,
} from "../../lib/src/integrations/bmad-cli";

describe("parseSlashCommandResult", () => {
  test("returns success result for exit code 0", () => {
    const commandResult: BmadCommandResult = {
      stdout: "Command output",
      stderr: "",
      exitCode: 0,
    };

    const result = parseSlashCommandResult(commandResult, "/test");

    expect(result.success).toBe(true);
    expect(result.output).toBe("Command output");
    expect(result.error).toBeUndefined();
  });

  test("returns failure result for non-zero exit code", () => {
    const commandResult: BmadCommandResult = {
      stdout: "",
      stderr: "Error: Command not found",
      exitCode: 1,
    };

    const result = parseSlashCommandResult(commandResult, "/invalid");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("BMAD_COMMAND_FAILED");
    expect(result.error?.message).toContain("/invalid");
  });

  test("includes stdout in failure result", () => {
    const commandResult: BmadCommandResult = {
      stdout: "Partial output before failure",
      stderr: "Fatal error",
      exitCode: 127,
    };

    const result = parseSlashCommandResult(commandResult, "/failing");

    expect(result.success).toBe(false);
    expect(result.output).toBe("Partial output before failure");
    expect(result.error?.message).toContain("/failing");
  });
});

describe("buildSlashCommand", () => {
  test("returns base command when no args", () => {
    const result = buildSlashCommand("/bmad:bmm:workflows:create-story");

    expect(result).toBe("/bmad:bmm:workflows:create-story");
  });

  test("appends story ID when provided", () => {
    const result = buildSlashCommand("/bmad:bmm:workflows:dev-story", "story-123");

    expect(result).toBe("/bmad:bmm:workflows:dev-story story-123");
  });

  test("appends additional args when provided", () => {
    const result = buildSlashCommand("/bmad:bmm:workflows:dev-story", undefined, ["--verbose"]);

    expect(result).toBe("/bmad:bmm:workflows:dev-story --verbose");
  });

  test("combines story ID and additional args", () => {
    const result = buildSlashCommand(
      "/bmad:bmm:workflows:dev-story",
      "story-123",
      ["--verbose", "--dry-run"]
    );

    expect(result).toBe("/bmad:bmm:workflows:dev-story story-123 --verbose --dry-run");
  });
});

describe("validateSlashCommand", () => {
  test("returns true for valid slash command", () => {
    expect(validateSlashCommand("/bmad:bmm:workflows:create-story")).toBe(true);
    expect(validateSlashCommand("/help")).toBe(true);
    expect(validateSlashCommand("/a")).toBe(true);
  });

  test("returns false for empty slash", () => {
    expect(validateSlashCommand("/")).toBe(false);
  });

  test("returns false for command without slash prefix", () => {
    expect(validateSlashCommand("bmad:bmm:workflows:create-story")).toBe(false);
    expect(validateSlashCommand("help")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(validateSlashCommand("")).toBe(false);
  });
});

describe("BmadInvokeResult type", () => {
  test("success result has correct shape", () => {
    const result: BmadInvokeResult = {
      success: true,
      output: "Command output",
    };

    expect(result.success).toBe(true);
    expect(result.output).toBe("Command output");
    expect(result.error).toBeUndefined();
  });

  test("failure result has correct shape", () => {
    const result: BmadInvokeResult = {
      success: false,
      output: "",
      error: {
        code: "BMAD_COMMAND_FAILED",
        message: "Command failed",
      },
    };

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("BMAD_COMMAND_FAILED");
  });
});

describe("BmadSlashCommandOptions type", () => {
  test("accepts timeout option", () => {
    const options = { timeout: 60000 };
    expect(options.timeout).toBe(60000);
  });

  test("accepts workingDir option", () => {
    const options = { workingDir: "/path/to/project" };
    expect(options.workingDir).toBe("/path/to/project");
  });

  test("accepts env option", () => {
    const options = { env: { DEBUG: "true", NODE_ENV: "test" } };
    expect(options.env?.DEBUG).toBe("true");
    expect(options.env?.NODE_ENV).toBe("test");
  });

  test("accepts all options combined", () => {
    const options = {
      timeout: 30000,
      workingDir: "/project",
      env: { CI: "true" },
    };
    expect(options.timeout).toBe(30000);
    expect(options.workingDir).toBe("/project");
    expect(options.env?.CI).toBe("true");
  });
});
