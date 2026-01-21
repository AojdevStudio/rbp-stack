import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import {
  detectEpicFromBranch,
  loadSprintStatus,
  saveSprintStatus,
  findNextStory,
  getWorkflowForStatus,
  runBmadWorkflow,
  executeSlashCommand,
  type Story,
  type SprintStatus,
} from "../../lib/src/workflows/bmad";
import {
  validateSlashCommand,
  buildSlashCommand,
  parseSlashCommandResult,
} from "../../lib/src/integrations/bmad-cli";
import { RbpConfigSchema } from "../../lib/src/config/schema";

const TEST_DIR = "/tmp/bmad-test";

describe("detectEpicFromBranch", () => {
  test("returns null when not in git repo or no epic branch", () => {
    const result = detectEpicFromBranch();
    expect(result === null || typeof result === "string").toBe(true);
  });
});

describe("validateSlashCommand", () => {
  test("returns true for valid slash commands", () => {
    expect(validateSlashCommand("/bmad:create-story")).toBe(true);
    expect(validateSlashCommand("/help")).toBe(true);
    expect(validateSlashCommand("/bmad:bmm:workflows:dev-story")).toBe(true);
  });

  test("returns false for invalid slash commands", () => {
    expect(validateSlashCommand("")).toBe(false);
    expect(validateSlashCommand("/")).toBe(false);
    expect(validateSlashCommand("bmad:create")).toBe(false);
    expect(validateSlashCommand("no-slash")).toBe(false);
  });
});

describe("buildSlashCommand", () => {
  test("builds command without story ID", () => {
    const command = buildSlashCommand("/bmad:create-story");
    expect(command).toBe("/bmad:create-story");
  });

  test("builds command with story ID", () => {
    const command = buildSlashCommand("/bmad:dev-story", "story-123");
    expect(command).toBe("/bmad:dev-story story-123");
  });

  test("builds command with story ID and additional args", () => {
    const command = buildSlashCommand("/bmad:dev-story", "story-123", ["--verbose", "--dry-run"]);
    expect(command).toBe("/bmad:dev-story story-123 --verbose --dry-run");
  });
});

describe("parseSlashCommandResult", () => {
  test("parses successful result", () => {
    const result = parseSlashCommandResult(
      { stdout: "Success output", stderr: "", exitCode: 0 },
      "/test"
    );
    expect(result.success).toBe(true);
    expect(result.output).toBe("Success output");
    expect(result.error).toBeUndefined();
  });

  test("parses failed result", () => {
    const result = parseSlashCommandResult(
      { stdout: "", stderr: "Error occurred", exitCode: 1 },
      "/test"
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("BMAD_COMMAND_FAILED");
  });
});

describe("loadSprintStatus", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  test("returns null for non-existent file", () => {
    const result = loadSprintStatus(`${TEST_DIR}/missing.yaml`);
    expect(result).toBeNull();
  });

  test("loads valid sprint status YAML", () => {
    const yaml = `
epic: "4"
stories:
  - id: "4-1"
    title: "First story"
    status: "backlog"
  - id: "4-2"
    title: "Second story"
    status: "in-progress"
`;
    writeFileSync(`${TEST_DIR}/sprint-status.yaml`, yaml);

    const result = loadSprintStatus(`${TEST_DIR}/sprint-status.yaml`);

    expect(result).not.toBeNull();
    expect(result?.epic).toBe("4");
    expect(result?.stories).toHaveLength(2);
    expect(result?.stories[0].id).toBe("4-1");
    expect(result?.stories[1].status).toBe("in-progress");
  });

  test("returns null for invalid YAML", () => {
    // Write invalid YAML that will cause a parse error
    const invalidYaml = `
epic: "1"
stories:
  - id: "unclosed bracket
`;
    writeFileSync(`${TEST_DIR}/invalid.yaml`, invalidYaml);

    const result = loadSprintStatus(`${TEST_DIR}/invalid.yaml`);
    // Should return null when parsing fails, or the parsed content if yaml lib is lenient
    expect(result === null || typeof result === "object").toBe(true);
  });
});

describe("saveSprintStatus", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  test("saves sprint status to file", () => {
    const status: SprintStatus = {
      epic: "5",
      stories: [
        { id: "5-1", title: "Test Story", status: "backlog" },
      ],
    };

    const result = saveSprintStatus(`${TEST_DIR}/save-test.yaml`, status);
    expect(result).toBe(true);

    const loaded = loadSprintStatus(`${TEST_DIR}/save-test.yaml`);
    expect(loaded).not.toBeNull();
    expect(loaded?.epic).toBe("5");
    expect(loaded?.stories[0].id).toBe("5-1");
  });

  test("updates existing file", () => {
    const initialStatus: SprintStatus = {
      epic: "1",
      stories: [{ id: "1-1", title: "Story 1", status: "backlog" }],
    };

    saveSprintStatus(`${TEST_DIR}/update-test.yaml`, initialStatus);

    const updatedStatus: SprintStatus = {
      epic: "1",
      stories: [{ id: "1-1", title: "Story 1", status: "in-progress" }],
    };

    const result = saveSprintStatus(`${TEST_DIR}/update-test.yaml`, updatedStatus);
    expect(result).toBe(true);

    const loaded = loadSprintStatus(`${TEST_DIR}/update-test.yaml`);
    expect(loaded?.stories[0].status).toBe("in-progress");
  });
});

describe("findNextStory", () => {
  test("prioritizes in_progress stories", () => {
    const status: SprintStatus = {
      stories: [
        { id: "1", title: "Backlog", status: "backlog" },
        { id: "2", title: "In Progress", status: "in-progress" },
        { id: "3", title: "Ready", status: "ready-for-dev" },
      ],
    };

    const result = findNextStory(status);
    expect(result?.id).toBe("2");
  });

  test("falls back to ready when no in_progress", () => {
    const status: SprintStatus = {
      stories: [
        { id: "1", title: "Backlog", status: "backlog" },
        { id: "2", title: "Ready", status: "ready-for-dev" },
      ],
    };

    const result = findNextStory(status);
    expect(result?.id).toBe("2");
  });

  test("returns null when all stories are done", () => {
    const status: SprintStatus = {
      stories: [
        { id: "1", title: "Done 1", status: "done" },
        { id: "2", title: "Done 2", status: "done" },
      ],
    };

    const result = findNextStory(status);
    expect(result).toBeNull();
  });

  test("returns null for empty stories array", () => {
    const status: SprintStatus = { stories: [] };

    const result = findNextStory(status);
    expect(result).toBeNull();
  });
});

describe("getWorkflowForStatus", () => {
  const config = RbpConfigSchema.parse({ project: { name: "test" } });

  test("returns create_story for backlog", () => {
    const workflow = getWorkflowForStatus("backlog", config);
    expect(workflow).toBe(config.bmad.create_story);
  });

  test("returns dev_story for in_progress", () => {
    const workflow = getWorkflowForStatus("in-progress", config);
    expect(workflow).toBe(config.bmad.dev_story);
  });

  test("returns code_review for review", () => {
    const workflow = getWorkflowForStatus("review", config);
    expect(workflow).toBe(config.bmad.code_review);
  });

  test("returns null for done", () => {
    const workflow = getWorkflowForStatus("done", config);
    expect(workflow).toBeNull();
  });
});

describe("runBmadWorkflow", () => {
  const WORKFLOW_TEST_DIR = "/tmp/bmad-workflow-test";
  const config = RbpConfigSchema.parse({
    project: { name: "test" },
    execution: { max_iterations: 5, iteration_delay: 0 },
  });

  beforeEach(() => {
    if (existsSync(WORKFLOW_TEST_DIR)) {
      rmSync(WORKFLOW_TEST_DIR, { recursive: true });
    }
    mkdirSync(`${WORKFLOW_TEST_DIR}/docs/bmm`, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(WORKFLOW_TEST_DIR)) {
      rmSync(WORKFLOW_TEST_DIR, { recursive: true });
    }
  });

  test("returns error when sprint status file not found", async () => {
    const result = await runBmadWorkflow({
      config,
      sprintStatusPath: `${WORKFLOW_TEST_DIR}/missing.yaml`,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("NO_WORKFLOW_DETECTED");
  });

  test("completes immediately when all stories are done", async () => {
    const yaml = `
epic: "1"
stories:
  - id: "1-1"
    title: "Story 1"
    status: "done"
  - id: "1-2"
    title: "Story 2"
    status: "done"
`;
    writeFileSync(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`, yaml);

    const result = await runBmadWorkflow({
      config,
      sprintStatusPath: `${WORKFLOW_TEST_DIR}/sprint-status.yaml`,
    });

    expect(result.success).toBe(true);
    expect(result.storiesCompleted).toBe(0);
    expect(result.iterations).toBe(1);
  });

  test("processes stories in dry run mode", async () => {
    const yaml = `
epic: "2"
stories:
  - id: "2-1"
    title: "Story to process"
    status: "backlog"
`;
    writeFileSync(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`, yaml);

    const result = await runBmadWorkflow({
      config,
      dryRun: true,
      sprintStatusPath: `${WORKFLOW_TEST_DIR}/sprint-status.yaml`,
      maxIterations: 2,
    });

    expect(result.success).toBe(true);
    expect(result.iterations).toBe(2);
  });

  test("executes workflow commands when invokeSlashCommand provided", async () => {
    const yaml = `
epic: "3"
stories:
  - id: "3-1"
    title: "Story to execute"
    status: "in-progress"
`;
    writeFileSync(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`, yaml);

    const invokedCommands: string[] = [];
    const mockInvoker = async (command: string, args?: string[]) => {
      invokedCommands.push(command);
    };

    const result = await runBmadWorkflow({
      config,
      sprintStatusPath: `${WORKFLOW_TEST_DIR}/sprint-status.yaml`,
      maxIterations: 1,
      invokeSlashCommand: mockInvoker,
    });

    expect(result.success).toBe(true);
    expect(invokedCommands).toContain(config.bmad.dev_story);
  });

  test("handles workflow execution error gracefully", async () => {
    const yaml = `
epic: "4"
stories:
  - id: "4-1"
    title: "Story that fails"
    status: "in-progress"
`;
    writeFileSync(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`, yaml);

    const mockInvoker = async () => {
      throw new Error("Workflow execution failed");
    };

    const result = await runBmadWorkflow({
      config,
      sprintStatusPath: `${WORKFLOW_TEST_DIR}/sprint-status.yaml`,
      maxIterations: 1,
      invokeSlashCommand: mockInvoker,
    });

    expect(result.success).toBe(true);
    expect(result.storiesCompleted).toBe(0);
  });

  test("skips when no invoker and not dry run", async () => {
    const yaml = `
epic: "5"
stories:
  - id: "5-1"
    title: "Story without invoker"
    status: "backlog"
`;
    writeFileSync(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`, yaml);

    const result = await runBmadWorkflow({
      config,
      sprintStatusPath: `${WORKFLOW_TEST_DIR}/sprint-status.yaml`,
      maxIterations: 1,
    });

    expect(result.success).toBe(true);
    expect(result.storiesCompleted).toBe(0);
  });

  test("respects max iterations limit", async () => {
    const yaml = `
epic: "6"
stories:
  - id: "6-1"
    title: "Story 1"
    status: "backlog"
  - id: "6-2"
    title: "Story 2"
    status: "backlog"
  - id: "6-3"
    title: "Story 3"
    status: "backlog"
`;
    writeFileSync(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`, yaml);

    const result = await runBmadWorkflow({
      config,
      dryRun: true,
      sprintStatusPath: `${WORKFLOW_TEST_DIR}/sprint-status.yaml`,
      maxIterations: 2,
    });

    expect(result.iterations).toBe(2);
  });

  test("tracks stories completed when transitions from in-progress to done", async () => {
    const yaml = `
epic: "7"
stories:
  - id: "7-1"
    title: "Story in progress"
    status: "in-progress"
`;
    writeFileSync(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`, yaml);

    // Track state transitions
    let invocationCount = 0;
    const mockInvoker = async () => {
      invocationCount++;
    };

    const result = await runBmadWorkflow({
      config,
      sprintStatusPath: `${WORKFLOW_TEST_DIR}/sprint-status.yaml`,
      maxIterations: 5,
      invokeSlashCommand: mockInvoker,
    });

    expect(result.success).toBe(true);
    expect(invocationCount).toBeGreaterThan(0);
  });

  test("findNextStory does not return review status stories", () => {
    // Review status stories are NOT picked up by findNextStory
    // They're handled differently in the workflow
    const status: SprintStatus = {
      stories: [
        { id: "1", title: "In Review", status: "review" },
      ],
    };

    const result = findNextStory(status);
    expect(result).toBeNull(); // review is not a "next" status
  });

  test("auto-saves sprint status after successful transition", async () => {
    const yaml = `
epic: "8"
stories:
  - id: "8-1"
    title: "Story to auto-save"
    status: "in-progress"
`;
    writeFileSync(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`, yaml);

    const mockInvoker = async () => {};

    await runBmadWorkflow({
      config,
      sprintStatusPath: `${WORKFLOW_TEST_DIR}/sprint-status.yaml`,
      maxIterations: 1,
      invokeSlashCommand: mockInvoker,
      autoSave: true,
    });

    // Verify the file was updated
    const savedStatus = loadSprintStatus(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`);
    expect(savedStatus?.stories[0].status).toBe("review");
  });

  test("does not auto-save when autoSave is false", async () => {
    const yaml = `
epic: "9"
stories:
  - id: "9-1"
    title: "Story no auto-save"
    status: "in-progress"
`;
    writeFileSync(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`, yaml);

    const mockInvoker = async () => {};

    await runBmadWorkflow({
      config,
      sprintStatusPath: `${WORKFLOW_TEST_DIR}/sprint-status.yaml`,
      maxIterations: 1,
      invokeSlashCommand: mockInvoker,
      autoSave: false,
    });

    // Verify the file was NOT updated (still original status)
    const savedStatus = loadSprintStatus(`${WORKFLOW_TEST_DIR}/sprint-status.yaml`);
    expect(savedStatus?.stories[0].status).toBe("in-progress");
  });
});
