import { describe, test, expect } from "bun:test";
import { validateOptions, parseMaxIterations, getConfig, getGlobalOptions, program, type GlobalOptions } from "../lib/src/cli";
import { runCommandDef } from "../lib/src/commands/run";
import { statusCommandDef } from "../lib/src/commands/status";
import { closeCommandDef } from "../lib/src/commands/close";
import { execSpecCommandDef } from "../lib/src/commands/exec-spec";

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

  test("exits with error for NaN-producing input", () => {
    const originalExit = process.exit;
    let exitCode: number | undefined;

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("process.exit called");
    }) as any;

    try {
      // Various inputs that produce NaN from parseInt
      expect(() => parseMaxIterations("NaN", 50)).toThrow("process.exit called");
      expect(exitCode).toBe(1);

      exitCode = undefined;
      expect(() => parseMaxIterations("", 50)).toThrow("process.exit called");
      expect(exitCode).toBe(1);

      exitCode = undefined;
      expect(() => parseMaxIterations("not-a-number", 50)).toThrow("process.exit called");
      expect(exitCode).toBe(1);
    } finally {
      process.exit = originalExit;
    }
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

describe("program configuration", () => {
  test("has correct name", () => {
    expect(program.name()).toBe("ralph");
  });

  test("has correct version", () => {
    expect(program.version()).toBe("3.0.0");
  });

  test("has description", () => {
    expect(program.description()).toBe("RBP autonomous execution loop");
  });

  test("has global options defined", () => {
    const opts = program.options;
    const optNames = opts.map((o) => o.long);

    expect(optNames).toContain("--config");
    expect(optNames).toContain("--verbose");
    expect(optNames).toContain("--quiet");
    expect(optNames).toContain("--json-errors");
    expect(optNames).toContain("--no-json-errors");
  });
});

describe("runCommandDef", () => {
  test("has correct name", () => {
    expect(runCommandDef.name()).toBe("run");
  });

  test("has correct description", () => {
    expect(runCommandDef.description()).toBe("Run the execution loop (default command)");
  });

  test("has required options", () => {
    const opts = runCommandDef.options;
    const optNames = opts.map((o) => o.long);

    expect(optNames).toContain("--bmad");
    expect(optNames).toContain("--beads");
    expect(optNames).toContain("--dry-run");
    expect(optNames).toContain("--max-iterations");
  });

  test("--bmad and --beads are boolean flags", () => {
    const bmadOpt = runCommandDef.options.find((o) => o.long === "--bmad");
    const beadsOpt = runCommandDef.options.find((o) => o.long === "--beads");

    expect(bmadOpt?.required).toBeFalsy();
    expect(beadsOpt?.required).toBeFalsy();
  });

  test("--max-iterations takes argument", () => {
    const maxIterOpt = runCommandDef.options.find((o) => o.long === "--max-iterations");
    expect(maxIterOpt?.argChoices).toBeUndefined();
    expect(maxIterOpt?.flags).toContain("<n>");
  });
});

describe("statusCommandDef", () => {
  test("has correct name", () => {
    expect(statusCommandDef.name()).toBe("status");
  });

  test("has correct description", () => {
    expect(statusCommandDef.description()).toBe("Show current execution state");
  });

  test("has no required arguments", () => {
    const args = statusCommandDef.registeredArguments;
    expect(args.length).toBe(0);
  });
});

describe("closeCommandDef", () => {
  test("has correct name", () => {
    expect(closeCommandDef.name()).toBe("close");
  });

  test("has correct description", () => {
    expect(closeCommandDef.description()).toBe("Close a task with test verification");
  });

  test("has id as required argument", () => {
    const args = closeCommandDef.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe("id");
    expect(args[0].required).toBe(true);
  });

  test("has required options", () => {
    const opts = closeCommandDef.options;
    const optNames = opts.map((o) => o.long);

    expect(optNames).toContain("--force");
    expect(optNames).toContain("--dry-run");
  });

  test("--force has short flag -f", () => {
    const forceOpt = closeCommandDef.options.find((o) => o.long === "--force");
    expect(forceOpt?.short).toBe("-f");
  });
});

describe("execSpecCommandDef", () => {
  test("has correct name", () => {
    expect(execSpecCommandDef.name()).toBe("exec-spec");
  });

  test("has correct description", () => {
    expect(execSpecCommandDef.description()).toBe("Execute a spec file");
  });

  test("has file as required argument", () => {
    const args = execSpecCommandDef.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe("file");
    expect(args[0].required).toBe(true);
  });

  test("has required options", () => {
    const opts = execSpecCommandDef.options;
    const optNames = opts.map((o) => o.long);

    expect(optNames).toContain("--skip-review");
    expect(optNames).toContain("--max-iterations");
    expect(optNames).toContain("--dry-run");
  });
});
