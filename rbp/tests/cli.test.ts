import { describe, test, expect } from "bun:test";
import { validateOptions } from "../lib/src/cli";

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
