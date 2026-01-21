import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { Command } from "commander";
import { runCommandDef, runCommand, type RunOptions } from "../../lib/src/commands/run";
import * as cli from "../../lib/src/cli";
import * as beadsCli from "../../lib/src/integrations/beads-cli";
import * as beadsWorkflow from "../../lib/src/workflows/beads";
import * as bmadWorkflow from "../../lib/src/workflows/bmad";
import { RbpConfigSchema } from "../../lib/src/config/schema";

describe("runCommandDef configuration", () => {
  test("has correct name", () => {
    expect(runCommandDef.name()).toBe("run");
  });

  test("has correct description", () => {
    expect(runCommandDef.description()).toBe("Run the execution loop (default command)");
  });

  test("has --bmad option", () => {
    const opt = runCommandDef.options.find((o) => o.long === "--bmad");
    expect(opt).toBeDefined();
  });

  test("has --beads option", () => {
    const opt = runCommandDef.options.find((o) => o.long === "--beads");
    expect(opt).toBeDefined();
  });

  test("has --dry-run option", () => {
    const opt = runCommandDef.options.find((o) => o.long === "--dry-run");
    expect(opt).toBeDefined();
  });

  test("has --max-iterations option with argument", () => {
    const opt = runCommandDef.options.find((o) => o.long === "--max-iterations");
    expect(opt).toBeDefined();
    expect(opt?.flags).toContain("<n>");
  });

  test("has no required arguments", () => {
    const args = runCommandDef.registeredArguments;
    expect(args.length).toBe(0);
  });

  test("all options are optional (boolean)", () => {
    const bmadOpt = runCommandDef.options.find((o) => o.long === "--bmad");
    const beadsOpt = runCommandDef.options.find((o) => o.long === "--beads");
    const dryRunOpt = runCommandDef.options.find((o) => o.long === "--dry-run");

    expect(bmadOpt?.required).toBeFalsy();
    expect(beadsOpt?.required).toBeFalsy();
    expect(dryRunOpt?.required).toBeFalsy();
  });
});

describe("runCommandDef help", () => {
  test("help output contains description", () => {
    const helpInfo = runCommandDef.helpInformation();
    expect(helpInfo).toContain("Run the execution loop");
  });

  test("help output contains options", () => {
    const helpInfo = runCommandDef.helpInformation();
    expect(helpInfo).toContain("--bmad");
    expect(helpInfo).toContain("--beads");
    expect(helpInfo).toContain("--dry-run");
    expect(helpInfo).toContain("--max-iterations");
  });

  test("help output contains option descriptions", () => {
    const helpInfo = runCommandDef.helpInformation();
    expect(helpInfo).toContain("Use BMAD workflow");
    expect(helpInfo).toContain("Use Beads workflow");
    expect(helpInfo).toContain("Show what would happen without executing");
    expect(helpInfo).toContain("Maximum iterations");
  });
});

describe("RunOptions type", () => {
  test("all properties are optional", () => {
    const emptyOpts: RunOptions = {};
    expect(emptyOpts.bmad).toBeUndefined();
    expect(emptyOpts.beads).toBeUndefined();
    expect(emptyOpts.dryRun).toBeUndefined();
    expect(emptyOpts.maxIterations).toBeUndefined();
  });

  test("accepts all properties", () => {
    const fullOpts: RunOptions = {
      bmad: true,
      beads: false,
      dryRun: true,
      maxIterations: "50",
    };

    expect(fullOpts.bmad).toBe(true);
    expect(fullOpts.beads).toBe(false);
    expect(fullOpts.dryRun).toBe(true);
    expect(fullOpts.maxIterations).toBe("50");
  });
});

describe("runCommand dry-run behavior", () => {
  const mockConfig = RbpConfigSchema.parse({
    project: { name: "test-project" },
    execution: { max_iterations: 10, iteration_delay: 0 },
    verification: {
      require_tests: true,
      test_command: "bun test",
    },
  });

  let getGlobalOptionsSpy: ReturnType<typeof spyOn>;
  let getConfigSpy: ReturnType<typeof spyOn>;
  let validateOptionsSpy: ReturnType<typeof spyOn>;
  let parseMaxIterationsSpy: ReturnType<typeof spyOn>;
  let checkBeadsInstalledSpy: ReturnType<typeof spyOn>;
  let runBeadsWorkflowSpy: ReturnType<typeof spyOn>;
  let runBmadWorkflowSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    getGlobalOptionsSpy = spyOn(cli, "getGlobalOptions").mockReturnValue({});
    getConfigSpy = spyOn(cli, "getConfig").mockReturnValue(mockConfig);
    validateOptionsSpy = spyOn(cli, "validateOptions").mockImplementation(() => {});
    parseMaxIterationsSpy = spyOn(cli, "parseMaxIterations").mockReturnValue(10);
    checkBeadsInstalledSpy = spyOn(beadsCli, "checkBeadsInstalled").mockResolvedValue(true);
    runBeadsWorkflowSpy = spyOn(beadsWorkflow, "runBeadsWorkflow").mockResolvedValue({
      success: true,
      tasksCompleted: 0,
      tasksFailed: 0,
      iterations: 0,
    });
    runBmadWorkflowSpy = spyOn(bmadWorkflow, "runBmadWorkflow").mockResolvedValue({
      success: true,
      storiesCompleted: 0,
      iterations: 0,
    });
  });

  afterEach(() => {
    getGlobalOptionsSpy.mockRestore();
    getConfigSpy.mockRestore();
    validateOptionsSpy.mockRestore();
    parseMaxIterationsSpy.mockRestore();
    checkBeadsInstalledSpy.mockRestore();
    runBeadsWorkflowSpy.mockRestore();
    runBmadWorkflowSpy.mockRestore();
  });

  test("dry-run with beads workflow does not execute workflow", async () => {
    await runCommand({ beads: true, dryRun: true });

    expect(runBeadsWorkflowSpy).not.toHaveBeenCalled();
  });

  test("dry-run with bmad workflow does not execute workflow", async () => {
    await runCommand({ bmad: true, dryRun: true });

    expect(runBmadWorkflowSpy).not.toHaveBeenCalled();
  });

  test("without dry-run, beads workflow is executed", async () => {
    // Mock process.exit to prevent test from exiting
    const processExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await runCommand({ beads: true, dryRun: false });
    } catch (e) {
      // Expected - process.exit was called
    }

    expect(runBeadsWorkflowSpy).toHaveBeenCalled();
    processExitSpy.mockRestore();
  });

  test("without dry-run, bmad workflow is executed", async () => {
    const processExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await runCommand({ bmad: true, dryRun: false });
    } catch (e) {
      // Expected - process.exit was called
    }

    expect(runBmadWorkflowSpy).toHaveBeenCalled();
    processExitSpy.mockRestore();
  });
});
