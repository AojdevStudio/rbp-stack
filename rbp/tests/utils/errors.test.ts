import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  formatError,
  createError,
  ErrorCodes,
  RbpErrorInstance,
  type RbpError,
} from "../../lib/src/utils/errors";

describe("formatError", () => {
  test("outputs valid JSON when jsonOutput is true", () => {
    const error: RbpError = {
      code: "TEST_ERROR",
      message: "Test error message",
      suggestion: "Try again",
    };

    const output = formatError(error, true);
    const parsed = JSON.parse(output);

    expect(parsed.code).toBe("TEST_ERROR");
    expect(parsed.message).toBe("Test error message");
    expect(parsed.suggestion).toBe("Try again");
  });

  test("outputs human-readable format when jsonOutput is false", () => {
    const error: RbpError = {
      code: "CONFIG_INVALID",
      message: "Invalid configuration",
      suggestion: "Check your rbp-config.yaml",
    };

    const output = formatError(error, false);

    expect(output).toContain("Error [CONFIG_INVALID]");
    expect(output).toContain("Invalid configuration");
    expect(output).toContain("Suggestion: Check your rbp-config.yaml");
  });

  test("handles errors without suggestion", () => {
    const error: RbpError = {
      code: "SIMPLE_ERROR",
      message: "Simple error",
    };

    const jsonOutput = formatError(error, true);
    expect(JSON.parse(jsonOutput).suggestion).toBeUndefined();

    const textOutput = formatError(error, false);
    expect(textOutput).not.toContain("Suggestion:");
  });

  test("includes details in JSON output", () => {
    const error: RbpError = {
      code: "DETAILED_ERROR",
      message: "Error with details",
      details: { field: "execution.max_iterations", received: "string" },
    };

    const output = formatError(error, true);
    const parsed = JSON.parse(output);

    expect(parsed.details).toEqual({
      field: "execution.max_iterations",
      received: "string",
    });
  });
});

describe("createError", () => {
  test("creates error with all fields", () => {
    const error = createError(ErrorCodes.CONFIG_INVALID, "Invalid config", {
      details: { path: "/invalid/path" },
      suggestion: "Use a valid path",
    });

    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.message).toBe("Invalid config");
    expect(error.details).toEqual({ path: "/invalid/path" });
    expect(error.suggestion).toBe("Use a valid path");
  });

  test("creates error without optional fields", () => {
    const error = createError(ErrorCodes.BEADS_NOT_INITIALIZED, "Beads not found");

    expect(error.code).toBe("BEADS_NOT_INITIALIZED");
    expect(error.message).toBe("Beads not found");
    expect(error.details).toBeUndefined();
    expect(error.suggestion).toBeUndefined();
  });
});

describe("RbpErrorInstance", () => {
  test("extends Error with RbpError properties", () => {
    const instance = new RbpErrorInstance({
      code: "TEST_CODE",
      message: "Test message",
      suggestion: "Test suggestion",
    });

    expect(instance).toBeInstanceOf(Error);
    expect(instance.code).toBe("TEST_CODE");
    expect(instance.message).toBe("Test message");
    expect(instance.suggestion).toBe("Test suggestion");
    expect(instance.name).toBe("RbpError");
  });

  test("serializes to JSON correctly", () => {
    const instance = new RbpErrorInstance({
      code: "SERIALIZABLE",
      message: "Can be serialized",
      details: { key: "value" },
    });

    const json = instance.toJSON();

    expect(json.code).toBe("SERIALIZABLE");
    expect(json.message).toBe("Can be serialized");
    expect(json.details).toEqual({ key: "value" });
  });
});

describe("ErrorCodes", () => {
  test("contains expected error codes", () => {
    expect(ErrorCodes.CONFIG_INVALID).toBe("CONFIG_INVALID");
    expect(ErrorCodes.BEADS_NOT_INITIALIZED).toBe("BEADS_NOT_INITIALIZED");
    expect(ErrorCodes.TEST_FAILED).toBe("TEST_FAILED");
    expect(ErrorCodes.WORKFLOW_CONFLICT).toBe("WORKFLOW_CONFLICT");
  });
});
