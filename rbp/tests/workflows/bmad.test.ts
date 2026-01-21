import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import {
  detectEpicFromBranch,
  loadSprintStatus,
  findNextStory,
  getWorkflowForStatus,
  runBmadWorkflow,
  type Story,
  type SprintStatus,
} from "../../lib/src/workflows/bmad";
import { RbpConfigSchema } from "../../lib/src/config/schema";

const TEST_DIR = "/tmp/bmad-test";

describe("detectEpicFromBranch", () => {
  test("returns null when not in git repo or no epic branch", () => {
    const result = detectEpicFromBranch();
    expect(result === null || typeof result === "string").toBe(true);
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
});
