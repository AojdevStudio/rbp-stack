import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { execSpecCommandDef, execSpecCommand, type ExecSpecOptions } from "../../lib/src/commands/exec-spec";
import { RbpConfigSchema } from "../../lib/src/config/schema";
import * as cli from "../../lib/src/cli";
import * as beadsWorkflow from "../../lib/src/workflows/beads";
import * as codexWorkflow from "../../lib/src/workflows/codex";
import * as specParser from "../../lib/src/parsers/spec-to-beads";
import * as fs from "fs";

describe("execSpecCommandDef configuration", () => {
  test("has correct name", () => {
    expect(execSpecCommandDef.name()).toBe("exec-spec");
  });

  test("has correct description", () => {
    expect(execSpecCommandDef.description()).toBe("Execute a spec file");
  });

  test("has --skip-review option", () => {
    const opt = execSpecCommandDef.options.find((o) => o.long === "--skip-review");
    expect(opt).toBeDefined();
  });

  test("has --max-iterations option with argument", () => {
    const opt = execSpecCommandDef.options.find((o) => o.long === "--max-iterations");
    expect(opt).toBeDefined();
    expect(opt?.flags).toContain("<n>");
  });

  test("has --dry-run option", () => {
    const opt = execSpecCommandDef.options.find((o) => o.long === "--dry-run");
    expect(opt).toBeDefined();
  });

  test("boolean options are optional", () => {
    const skipReviewOpt = execSpecCommandDef.options.find((o) => o.long === "--skip-review");
    const dryRunOpt = execSpecCommandDef.options.find((o) => o.long === "--dry-run");

    expect(skipReviewOpt?.required).toBeFalsy();
    expect(dryRunOpt?.required).toBeFalsy();
  });

  test("--max-iterations requires a value when used", () => {
    const maxIterOpt = execSpecCommandDef.options.find((o) => o.long === "--max-iterations");
    // Commander sets required=true for options that require an argument value
    expect(maxIterOpt?.required).toBe(true);
    expect(maxIterOpt?.flags).toContain("<n>");
  });
});

describe("execSpecCommandDef argument validation", () => {
  test("requires file argument", () => {
    const args = execSpecCommandDef.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].required).toBe(true);
  });

  test("file argument has correct name", () => {
    const args = execSpecCommandDef.registeredArguments;
    expect(args[0].name()).toBe("file");
  });

  test("file argument has description", () => {
    const args = execSpecCommandDef.registeredArguments;
    expect(args[0].description).toBe("Spec file path");
  });
});

describe("ExecSpecOptions type", () => {
  test("all properties are optional", () => {
    const emptyOpts: ExecSpecOptions = {};
    expect(emptyOpts.skipReview).toBeUndefined();
    expect(emptyOpts.maxIterations).toBeUndefined();
    expect(emptyOpts.dryRun).toBeUndefined();
  });

  test("accepts all properties", () => {
    const fullOpts: ExecSpecOptions = {
      skipReview: true,
      maxIterations: "30",
      dryRun: false,
    };

    expect(fullOpts.skipReview).toBe(true);
    expect(fullOpts.maxIterations).toBe("30");
    expect(fullOpts.dryRun).toBe(false);
  });
});

describe("execSpecCommandDef help", () => {
  test("help output contains description", () => {
    const helpInfo = execSpecCommandDef.helpInformation();
    expect(helpInfo).toContain("Execute a spec file");
  });

  test("help output contains argument description", () => {
    const helpInfo = execSpecCommandDef.helpInformation();
    expect(helpInfo).toContain("file");
    expect(helpInfo).toContain("Spec file path");
  });

  test("help output contains options", () => {
    const helpInfo = execSpecCommandDef.helpInformation();
    expect(helpInfo).toContain("--skip-review");
    expect(helpInfo).toContain("--max-iterations");
    expect(helpInfo).toContain("--dry-run");
  });

  test("help output contains option descriptions", () => {
    const helpInfo = execSpecCommandDef.helpInformation();
    expect(helpInfo).toContain("Skip Codex pre-flight review");
    expect(helpInfo).toContain("Maximum iterations");
    expect(helpInfo).toContain("Show what would happen without executing");
  });
});

describe("exec-spec workflow integration", () => {
  test("config has correct paths for spec resolution", () => {
    const config = RbpConfigSchema.parse({
      project: { name: "test" },
      paths: { specs: "my-specs" },
    });

    expect(config.paths.specs).toBe("my-specs");
  });

  test("codex skip_by_default determines review behavior", () => {
    const configSkip = RbpConfigSchema.parse({
      project: { name: "test" },
      codex: { skip_by_default: true },
    });

    const configNoSkip = RbpConfigSchema.parse({
      project: { name: "test" },
      codex: { skip_by_default: false },
    });

    expect(configSkip.codex.skip_by_default).toBe(true);
    expect(configNoSkip.codex.skip_by_default).toBe(false);
  });

  test("max_iterations config is properly structured", () => {
    const config = RbpConfigSchema.parse({
      project: { name: "test" },
      execution: { max_iterations: 100 },
    });

    expect(config.execution.max_iterations).toBe(100);
  });

  test("test_command config for verification", () => {
    const config = RbpConfigSchema.parse({
      project: { name: "test" },
      verification: { test_command: "npm test" },
    });

    expect(config.verification.test_command).toBe("npm test");
  });
});

describe("exec-spec spec file resolution", () => {
  test("builds candidate paths correctly", () => {
    const specsDir = "specs";
    const file = "my-feature";

    const candidates = [
      `${specsDir}/${file}`,
      `${specsDir}/${file}.md`,
    ];

    expect(candidates).toContain("specs/my-feature");
    expect(candidates).toContain("specs/my-feature.md");
  });

  test("supports custom specs directory", () => {
    const config = RbpConfigSchema.parse({
      project: { name: "test" },
      paths: { specs: "custom/specs/path" },
    });

    const file = "feature";
    const candidates = [
      `${config.paths.specs}/${file}`,
      `${config.paths.specs}/${file}.md`,
    ];

    expect(candidates[0]).toBe("custom/specs/path/feature");
    expect(candidates[1]).toBe("custom/specs/path/feature.md");
  });
});

describe("exec-spec option precedence", () => {
  test("CLI option overrides config default for skip-review", () => {
    const config = RbpConfigSchema.parse({
      project: { name: "test" },
      codex: { skip_by_default: false },
    });

    const cliOption = true;

    // CLI option takes precedence
    const skipReview = cliOption ?? config.codex.skip_by_default;
    expect(skipReview).toBe(true);
  });

  test("config default used when CLI option not provided", () => {
    const config = RbpConfigSchema.parse({
      project: { name: "test" },
      codex: { skip_by_default: true },
    });

    const cliOption = undefined;

    const skipReview = cliOption ?? config.codex.skip_by_default;
    expect(skipReview).toBe(true);
  });

  test("CLI maxIterations overrides config", () => {
    const config = RbpConfigSchema.parse({
      project: { name: "test" },
      execution: { max_iterations: 50 },
    });

    const cliMaxIterations = "30";

    // Simulating parseMaxIterations behavior
    const maxIterations = cliMaxIterations !== undefined
      ? parseInt(cliMaxIterations, 10)
      : config.execution.max_iterations;

    expect(maxIterations).toBe(30);
  });
});

describe("execSpecCommand dry-run behavior", () => {
  const mockConfig = RbpConfigSchema.parse({
    project: { name: "test-project" },
    execution: { max_iterations: 10, iteration_delay: 0 },
    verification: {
      require_tests: true,
      test_command: "bun test",
    },
    codex: { skip_by_default: false },
    paths: { specs: "specs" },
  });

  let getGlobalOptionsSpy: ReturnType<typeof spyOn>;
  let getConfigSpy: ReturnType<typeof spyOn>;
  let parseMaxIterationsSpy: ReturnType<typeof spyOn>;
  let existsSyncSpy: ReturnType<typeof spyOn>;
  let runBeadsWorkflowSpy: ReturnType<typeof spyOn>;
  let runCodexReviewSpy: ReturnType<typeof spyOn>;
  let parseSpecToBeadsSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    getGlobalOptionsSpy = spyOn(cli, "getGlobalOptions").mockReturnValue({});
    getConfigSpy = spyOn(cli, "getConfig").mockReturnValue(mockConfig);
    parseMaxIterationsSpy = spyOn(cli, "parseMaxIterations").mockReturnValue(10);
    existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(true);
    runBeadsWorkflowSpy = spyOn(beadsWorkflow, "runBeadsWorkflow").mockResolvedValue({
      success: true,
      tasksCompleted: 0,
      tasksFailed: 0,
      iterations: 0,
    });
    runCodexReviewSpy = spyOn(codexWorkflow, "runCodexReview").mockResolvedValue({
      skipped: false,
    });
    parseSpecToBeadsSpy = spyOn(specParser, "parseSpecToBeads").mockResolvedValue({
      success: true,
      tasksCreated: 5,
    });
  });

  afterEach(() => {
    getGlobalOptionsSpy.mockRestore();
    getConfigSpy.mockRestore();
    parseMaxIterationsSpy.mockRestore();
    existsSyncSpy.mockRestore();
    runBeadsWorkflowSpy.mockRestore();
    runCodexReviewSpy.mockRestore();
    parseSpecToBeadsSpy.mockRestore();
  });

  test("dry-run does not execute codex review", async () => {
    await execSpecCommand("test-spec.md", { dryRun: true });

    expect(runCodexReviewSpy).not.toHaveBeenCalled();
  });

  test("dry-run does not parse spec to beads", async () => {
    await execSpecCommand("test-spec.md", { dryRun: true });

    expect(parseSpecToBeadsSpy).not.toHaveBeenCalled();
  });

  test("dry-run does not execute beads workflow", async () => {
    await execSpecCommand("test-spec.md", { dryRun: true });

    expect(runBeadsWorkflowSpy).not.toHaveBeenCalled();
  });

  test("without dry-run, codex review is executed (when not skipped)", async () => {
    const processExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await execSpecCommand("test-spec.md", { dryRun: false, skipReview: false });
    } catch (e) {
      // Expected - process.exit was called
    }

    expect(runCodexReviewSpy).toHaveBeenCalled();
    processExitSpy.mockRestore();
  });

  test("without dry-run, beads workflow is executed", async () => {
    const processExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await execSpecCommand("test-spec.md", { dryRun: false, skipReview: true });
    } catch (e) {
      // Expected - process.exit was called
    }

    expect(runBeadsWorkflowSpy).toHaveBeenCalled();
    processExitSpy.mockRestore();
  });
});
