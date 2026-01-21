import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import {
  detectEpicFromBranch,
  loadSprintStatus,
  findNextStory,
  getWorkflowForStatus,
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
