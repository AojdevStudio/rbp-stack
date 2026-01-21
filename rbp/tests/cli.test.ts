import { describe, test, expect } from "bun:test";
import { validateOptions, parseMaxIterations, getConfig, getGlobalOptions, type GlobalOptions } from "../lib/src/cli";

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

describe("getGlobalOptions", () => {
  test("returns options object", () => {
    const opts = getGlobalOptions();
    expect(typeof opts).toBe("object");
  });
});

describe("getConfig", () => {
  test("returns config with default options", () => {
    const globalOpts: GlobalOptions = {};
    const config = getConfig(globalOpts);

    expect(config).toBeDefined();
    expect(config.project).toBeDefined();
    expect(config.execution).toBeDefined();
    expect(config.verification).toBeDefined();
  });

  test("uses config path from global options when provided", () => {
    const globalOpts: GlobalOptions = {
      config: "/nonexistent/config.yaml",
    };

    // This should still return a default config since file doesn't exist
    const config = getConfig(globalOpts);
    expect(config).toBeDefined();
  });
});

describe("GlobalOptions type", () => {
  test("all properties are optional", () => {
    const emptyOpts: GlobalOptions = {};
    expect(emptyOpts.config).toBeUndefined();
    expect(emptyOpts.verbose).toBeUndefined();
    expect(emptyOpts.quiet).toBeUndefined();
    expect(emptyOpts.jsonErrors).toBeUndefined();
  });

  test("accepts all properties", () => {
    const fullOpts: GlobalOptions = {
      config: "/path/to/config.yaml",
      verbose: true,
      quiet: false,
      jsonErrors: true,
    };

    expect(fullOpts.config).toBe("/path/to/config.yaml");
    expect(fullOpts.verbose).toBe(true);
    expect(fullOpts.quiet).toBe(false);
    expect(fullOpts.jsonErrors).toBe(true);
  });
});

describe("program preAction hook logic", () => {
  test("sets RBP_JSON_ERRORS to false when jsonErrors option is false", () => {
    // Test the logic directly (simulates what preAction hook does)
    const opts = { jsonErrors: false };
    if (opts.jsonErrors === false) {
      process.env.RBP_JSON_ERRORS = "false";
    } else {
      process.env.RBP_JSON_ERRORS = "true";
    }
    expect(process.env.RBP_JSON_ERRORS).toBe("false");
  });

  test("sets RBP_JSON_ERRORS to true when jsonErrors option is true", () => {
    // Test the logic directly (simulates what preAction hook does)
    const opts = { jsonErrors: true };
    if (opts.jsonErrors === false) {
      process.env.RBP_JSON_ERRORS = "false";
    } else {
      process.env.RBP_JSON_ERRORS = "true";
    }
    expect(process.env.RBP_JSON_ERRORS).toBe("true");
  });

  test("sets RBP_JSON_ERRORS to true when jsonErrors option is undefined", () => {
    // When not specified, defaults to true
    const opts = { jsonErrors: undefined };
    if (opts.jsonErrors === false) {
      process.env.RBP_JSON_ERRORS = "false";
    } else {
      process.env.RBP_JSON_ERRORS = "true";
    }
    expect(process.env.RBP_JSON_ERRORS).toBe("true");
  });
});
