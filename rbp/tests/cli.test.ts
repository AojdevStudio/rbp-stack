import { describe, test, expect } from "bun:test";
import { validateOptions, parseMaxIterations } from "../lib/src/cli";

describe("validateOptions", () => {
  test("allows --bmad only", () => {
    expect(() => validateOptions({ bmad: true })).not.toThrow();
  });

  test("allows --beads only", () => {
    expect(() => validateOptions({ beads: true })).not.toThrow();
  });

  test("allows neither flag", () => {
    expect(() => validateOptions({})).not.toThrow();
  });

  test("exits with error when both --bmad and --beads specified", () => {
    const originalExit = process.exit;
    let exitCode: number | undefined;

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("process.exit called");
    }) as any;

    try {
      expect(() => validateOptions({ bmad: true, beads: true })).toThrow("process.exit called");
      expect(exitCode).toBe(1);
    } finally {
      process.exit = originalExit;
    }
  });
});

describe("parseMaxIterations", () => {
  test("returns default value when undefined", () => {
    expect(parseMaxIterations(undefined, 50)).toBe(50);
  });

  test("parses valid positive integer", () => {
    expect(parseMaxIterations("10", 50)).toBe(10);
    expect(parseMaxIterations("1", 50)).toBe(1);
    expect(parseMaxIterations("100", 50)).toBe(100);
  });

  test("exits with error for non-numeric string", () => {
    const originalExit = process.exit;
    let exitCode: number | undefined;

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("process.exit called");
    }) as any;

    try {
      expect(() => parseMaxIterations("abc", 50)).toThrow("process.exit called");
      expect(exitCode).toBe(1);
    } finally {
      process.exit = originalExit;
    }
  });

  test("exits with error for zero", () => {
    const originalExit = process.exit;
    let exitCode: number | undefined;

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("process.exit called");
    }) as any;

    try {
      expect(() => parseMaxIterations("0", 50)).toThrow("process.exit called");
      expect(exitCode).toBe(1);
    } finally {
      process.exit = originalExit;
    }
  });

  test("exits with error for negative number", () => {
    const originalExit = process.exit;
    let exitCode: number | undefined;

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("process.exit called");
    }) as any;

    try {
      expect(() => parseMaxIterations("-5", 50)).toThrow("process.exit called");
      expect(exitCode).toBe(1);
    } finally {
      process.exit = originalExit;
    }
  });

  test("truncates float to integer", () => {
    // parseInt truncates floats, so "3.5" becomes 3 which is valid
    expect(parseMaxIterations("3.5", 50)).toBe(3);
  });
});
