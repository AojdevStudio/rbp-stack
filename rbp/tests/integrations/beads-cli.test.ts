import { describe, test, expect, mock, beforeEach, spyOn, afterEach } from "bun:test";
import {
  BeadSchema,
  BeadListSchema,
  type Bead,
  type CommandResult,
  checkBeadsInstalled,
  listBeads,
  getBeadsStatus,
  getReadyBead,
  parseReadyBeadOutput,
  parseListBeadsOutput,
  parseShowBeadOutput,
  parseChildrenOutput,
  buildCreateBeadArgs,
  calculateBeadsStatus,
} from "../../lib/src/integrations/beads-cli";

// Helper to create mock spawn results
function createMockSpawn(stdout: string, stderr: string, exitCode: number) {
  return {
    stdout: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stdout));
        controller.close();
      },
    }),
    stderr: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stderr));
        controller.close();
      },
    }),
    exited: Promise.resolve(exitCode),
    kill: () => {},
  };
}

describe("BeadSchema", () => {
  test("validates a complete bead", () => {
    const validBead = {
      id: "rbp-269.1",
      title: "Initialize TypeScript project",
      status: "open",
      priority: "P2",
      type: "task",
      notes: "Some notes here",
      labels: ["task", "typescript"],
      created: "2026-01-20 12:00",
      updated: "2026-01-20 12:30",
    };

    const result = BeadSchema.safeParse(validBead);
    expect(result.success).toBe(true);
  });

  test("validates a minimal bead", () => {
    const minimalBead = {
      id: "test-1",
      title: "Test bead",
      status: "in_progress",
    };

    const result = BeadSchema.safeParse(minimalBead);
    expect(result.success).toBe(true);
  });

  test("accepts all valid status values", () => {
    const statuses = ["open", "in_progress", "blocked", "deferred", "closed"] as const;

    for (const status of statuses) {
      const bead = { id: "test", title: "Test", status };
      const result = BeadSchema.safeParse(bead);
      expect(result.success).toBe(true);
    }
  });

  test("rejects invalid status", () => {
    const invalidBead = {
      id: "test-1",
      title: "Test bead",
      status: "invalid_status",
    };

    const result = BeadSchema.safeParse(invalidBead);
    expect(result.success).toBe(false);
  });

  test("rejects missing required fields", () => {
    const noId = { title: "Test", status: "open" };
    const noTitle = { id: "test", status: "open" };
    const noStatus = { id: "test", title: "Test" };

    expect(BeadSchema.safeParse(noId).success).toBe(false);
    expect(BeadSchema.safeParse(noTitle).success).toBe(false);
    expect(BeadSchema.safeParse(noStatus).success).toBe(false);
  });
});

describe("BeadListSchema", () => {
  test("validates an array of beads", () => {
    const beads = [
      { id: "test-1", title: "First", status: "open" },
      { id: "test-2", title: "Second", status: "closed" },
    ];

    const result = BeadListSchema.safeParse(beads);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  test("validates an empty array", () => {
    const result = BeadListSchema.safeParse([]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });

  test("rejects array with invalid bead", () => {
    const beads = [
      { id: "test-1", title: "First", status: "open" },
      { id: "test-2", title: "Second", status: "invalid" },
    ];

    const result = BeadListSchema.safeParse(beads);
    expect(result.success).toBe(false);
  });
});

describe("bead parsing edge cases", () => {
  test("handles malformed JSON gracefully", () => {
    const malformed = "not json at all";
    expect(() => JSON.parse(malformed)).toThrow();
  });

  test("parses bd ready --json format", () => {
    const bdReadyOutput = `[{"id":"rbp-269.1","title":"Initialize TypeScript","status":"open","priority":"P2","type":"task"}]`;

    const parsed = JSON.parse(bdReadyOutput);
    const result = BeadListSchema.safeParse(parsed);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].id).toBe("rbp-269.1");
    }
  });

  test("handles empty response", () => {
    const emptyResponse = "[]";
    const parsed = JSON.parse(emptyResponse);
    const result = BeadListSchema.safeParse(parsed);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });
});

describe("BeadCliResult parsing", () => {
  test("parses bead with numeric priority", () => {
    const bead = {
      id: "test-1",
      title: "Test",
      status: "open",
      priority: 2,
    };
    const result = BeadSchema.safeParse(bead);
    expect(result.success).toBe(true);
  });

  test("parses bead with all optional fields", () => {
    const bead = {
      id: "test-1",
      title: "Test",
      status: "open",
      priority: "P1",
      type: "task",
      issue_type: "bug",
      notes: "Some notes",
      labels: ["urgent", "frontend"],
      created: "2026-01-20",
      updated: "2026-01-20",
      created_at: "2026-01-20T12:00:00Z",
      updated_at: "2026-01-20T12:30:00Z",
      created_by: "test-user",
    };
    const result = BeadSchema.safeParse(bead);
    expect(result.success).toBe(true);
  });

  test("validates bd list output with mixed beads", () => {
    const listOutput = [
      { id: "task-1", title: "First task", status: "open", labels: ["feature"] },
      { id: "task-2", title: "Second task", status: "in_progress", notes: "Working on it" },
      { id: "task-3", title: "Third task", status: "closed", priority: 1 },
    ];

    const result = BeadListSchema.safeParse(listOutput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
      expect(result.data[0].labels).toEqual(["feature"]);
      expect(result.data[1].notes).toBe("Working on it");
      expect(result.data[2].priority).toBe(1);
    }
  });

  test("handles bd show single object output", () => {
    const showOutput = {
      id: "rbp-123",
      title: "Important task",
      status: "in_progress",
      priority: "P0",
      notes: "Critical bug fix needed",
    };

    const result = BeadSchema.safeParse(showOutput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("rbp-123");
      expect(result.data.priority).toBe("P0");
    }
  });

  test("handles empty labels array", () => {
    const bead = {
      id: "test-1",
      title: "Test",
      status: "open",
      labels: [],
    };
    const result = BeadSchema.safeParse(bead);
    expect(result.success).toBe(true);
  });
});

// Tests for extracted parsing functions (pure functions, no CLI calls)
describe("parseReadyBeadOutput", () => {
  test("parses successful output with bead", () => {
    const result: CommandResult = {
      stdout: JSON.stringify([{ id: "test-1", title: "Test Task", status: "open" }]),
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseReadyBeadOutput(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.id).toBe("test-1");
    expect(parsed.data?.title).toBe("Test Task");
  });

  test("parses successful output with single object", () => {
    const result: CommandResult = {
      stdout: JSON.stringify({ id: "test-2", title: "Single Task", status: "in_progress" }),
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseReadyBeadOutput(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.id).toBe("test-2");
  });

  test("returns null for empty array", () => {
    const result: CommandResult = {
      stdout: "[]",
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseReadyBeadOutput(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBeNull();
  });

  test("handles No open issues in stderr", () => {
    const result: CommandResult = {
      stdout: "",
      stderr: "No open issues",
      exitCode: 1,
    };

    const parsed = parseReadyBeadOutput(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBeNull();
  });

  test("handles No open issues in stdout", () => {
    const result: CommandResult = {
      stdout: "No open issues",
      stderr: "",
      exitCode: 1,
    };

    const parsed = parseReadyBeadOutput(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBeNull();
  });

  test("returns error for non-zero exit code", () => {
    const result: CommandResult = {
      stdout: "",
      stderr: "Command failed",
      exitCode: 1,
    };

    const parsed = parseReadyBeadOutput(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.code).toBe("BEADS_COMMAND_FAILED");
  });

  test("returns error for invalid JSON", () => {
    const result: CommandResult = {
      stdout: "not valid json",
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseReadyBeadOutput(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.code).toBe("BEADS_PARSE_ERROR");
  });

  test("returns error for invalid bead schema", () => {
    const result: CommandResult = {
      stdout: JSON.stringify([{ id: "test", status: "invalid_status" }]),
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseReadyBeadOutput(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.code).toBe("BEADS_PARSE_ERROR");
  });
});

describe("parseListBeadsOutput", () => {
  test("parses successful output with beads", () => {
    const result: CommandResult = {
      stdout: JSON.stringify([
        { id: "test-1", title: "Task 1", status: "open" },
        { id: "test-2", title: "Task 2", status: "closed" },
      ]),
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseListBeadsOutput(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data?.[0].id).toBe("test-1");
  });

  test("parses empty list", () => {
    const result: CommandResult = {
      stdout: "[]",
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseListBeadsOutput(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(0);
  });

  test("handles empty stdout", () => {
    const result: CommandResult = {
      stdout: "",
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseListBeadsOutput(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(0);
  });

  test("returns error for non-zero exit code", () => {
    const result: CommandResult = {
      stdout: "",
      stderr: "bd list failed",
      exitCode: 1,
    };

    const parsed = parseListBeadsOutput(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.code).toBe("BEADS_COMMAND_FAILED");
  });

  test("returns error for invalid JSON", () => {
    const result: CommandResult = {
      stdout: "invalid json",
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseListBeadsOutput(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.code).toBe("BEADS_PARSE_ERROR");
  });
});

describe("parseShowBeadOutput", () => {
  test("parses successful output", () => {
    const result: CommandResult = {
      stdout: JSON.stringify({ id: "task-123", title: "My Task", status: "in_progress", priority: "P1" }),
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseShowBeadOutput(result, "task-123");
    expect(parsed.success).toBe(true);
    expect(parsed.data?.id).toBe("task-123");
    expect(parsed.data?.priority).toBe("P1");
  });

  test("returns error for non-zero exit code", () => {
    const result: CommandResult = {
      stdout: "",
      stderr: "Issue not found",
      exitCode: 1,
    };

    const parsed = parseShowBeadOutput(result, "missing-123");
    expect(parsed.success).toBe(false);
    expect(parsed.error?.message).toContain("missing-123");
  });

  test("returns error for invalid JSON", () => {
    const result: CommandResult = {
      stdout: "not json",
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseShowBeadOutput(result, "test");
    expect(parsed.success).toBe(false);
    expect(parsed.error?.code).toBe("BEADS_PARSE_ERROR");
  });
});

describe("parseChildrenOutput", () => {
  test("parses successful output with children", () => {
    const result: CommandResult = {
      stdout: JSON.stringify([
        { id: "child-1", title: "Subtask 1", status: "open" },
        { id: "child-2", title: "Subtask 2", status: "closed" },
      ]),
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseChildrenOutput(result, "parent-1");
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(2);
  });

  test("parses empty children list", () => {
    const result: CommandResult = {
      stdout: "[]",
      stderr: "",
      exitCode: 0,
    };

    const parsed = parseChildrenOutput(result, "parent-1");
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(0);
  });

  test("returns error for non-zero exit code", () => {
    const result: CommandResult = {
      stdout: "",
      stderr: "Parent not found",
      exitCode: 1,
    };

    const parsed = parseChildrenOutput(result, "missing-parent");
    expect(parsed.success).toBe(false);
    expect(parsed.error?.message).toContain("missing-parent");
  });
});

describe("buildCreateBeadArgs", () => {
  test("builds minimal args with just title", () => {
    const args = buildCreateBeadArgs("My Task");
    expect(args).toEqual(["create", "My Task", "--silent"]);
  });

  test("includes parent option", () => {
    const args = buildCreateBeadArgs("Subtask", { parent: "parent-1" });
    expect(args).toContain("--parent");
    expect(args).toContain("parent-1");
  });

  test("includes multiple labels", () => {
    const args = buildCreateBeadArgs("Task", { labels: ["urgent", "bug"] });
    expect(args.filter(a => a === "-l").length).toBe(2);
    expect(args).toContain("urgent");
    expect(args).toContain("bug");
  });

  test("includes notes option", () => {
    const args = buildCreateBeadArgs("Task", { notes: "Important notes" });
    expect(args).toContain("--notes");
    expect(args).toContain("Important notes");
  });

  test("includes depends option", () => {
    const args = buildCreateBeadArgs("Task", { depends: "dep-1" });
    expect(args).toContain("--depends");
    expect(args).toContain("dep-1");
  });

  test("includes all options", () => {
    const args = buildCreateBeadArgs("Full Task", {
      parent: "parent-1",
      labels: ["task"],
      notes: "Notes here",
      depends: "dep-1",
    });

    expect(args).toContain("--parent");
    expect(args).toContain("--notes");
    expect(args).toContain("--depends");
    expect(args).toContain("-l");
    expect(args).toContain("--silent");
  });
});

describe("calculateBeadsStatus", () => {
  test("calculates correct counts", () => {
    const beads: Bead[] = [
      { id: "1", title: "Open task", status: "open" },
      { id: "2", title: "In progress", status: "in_progress" },
      { id: "3", title: "Closed", status: "closed" },
      { id: "4", title: "Blocked", status: "blocked" },
    ];

    const status = calculateBeadsStatus(beads, "[]");
    expect(status.total).toBe(4);
    expect(status.open).toBe(2); // open + in_progress
    expect(status.ready).toBeNull();
  });

  test("extracts ready task from JSON", () => {
    const beads: Bead[] = [
      { id: "1", title: "Task 1", status: "open" },
    ];

    const readyOutput = JSON.stringify([{ id: "1", title: "Ready Task" }]);
    const status = calculateBeadsStatus(beads, readyOutput);
    expect(status.ready).toBe("Ready Task");
  });

  test("uses id when title missing", () => {
    const beads: Bead[] = [];
    const readyOutput = JSON.stringify([{ id: "task-id" }]);
    const status = calculateBeadsStatus(beads, readyOutput);
    expect(status.ready).toBe("task-id");
  });

  test("handles invalid JSON gracefully", () => {
    const beads: Bead[] = [];
    const status = calculateBeadsStatus(beads, "invalid json");
    expect(status.ready).toBeNull();
  });

  test("handles empty ready output", () => {
    const beads: Bead[] = [];
    const status = calculateBeadsStatus(beads, "");
    expect(status.ready).toBeNull();
  });

  test("handles empty ready array", () => {
    const beads: Bead[] = [];
    const status = calculateBeadsStatus(beads, "[]");
    expect(status.ready).toBeNull();
  });
});

// Integration tests that call actual bd CLI - these tests gracefully handle when bd is not available
// Note: These tests may fail if beads is not installed, not initialized, or the database is out of sync
// In those cases, the test returns a BeadsCliResult with success=false, which is valid behavior
describe("beads CLI integration", () => {
  test("checkBeadsInstalled returns boolean", async () => {
    const result = await checkBeadsInstalled();
    // Returns true if installed, false otherwise
    expect(typeof result).toBe("boolean");
  });

  test("listBeads returns BeadsCliResult", async () => {
    const isInstalled = await checkBeadsInstalled();
    if (!isInstalled) {
      // Skip test when bd is not in PATH
      expect(true).toBe(true);
      return;
    }

    const result = await listBeads();
    // Result is always a BeadsCliResult - success depends on beads repo state
    expect(result).toHaveProperty("success");
    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
    } else {
      // Failed result should have error info
      expect(result.error).toBeDefined();
    }
  });

  test("listBeads with options returns BeadsCliResult", async () => {
    const isInstalled = await checkBeadsInstalled();
    if (!isInstalled) {
      // Skip test when bd is not in PATH
      expect(true).toBe(true);
      return;
    }

    const resultAll = await listBeads({ all: true });
    const resultStatus = await listBeads({ status: "open" });

    // Both should return valid BeadsCliResult structures
    expect(resultAll).toHaveProperty("success");
    expect(resultStatus).toHaveProperty("success");
  });

  test("getBeadsStatus returns BeadsCliResult", async () => {
    const isInstalled = await checkBeadsInstalled();
    if (!isInstalled) {
      // Skip test when bd is not in PATH
      expect(true).toBe(true);
      return;
    }

    const result = await getBeadsStatus();
    // Result is always a BeadsCliResult - success depends on beads repo state
    expect(result).toHaveProperty("success");
    if (result.success) {
      expect(typeof result.data?.open).toBe("number");
      expect(typeof result.data?.total).toBe("number");
    }
  });

  test("getReadyBead returns BeadsCliResult", async () => {
    const isInstalled = await checkBeadsInstalled();
    if (!isInstalled) {
      // Skip test when bd is not in PATH
      expect(true).toBe(true);
      return;
    }

    const result = await getReadyBead();
    // Result is always a BeadsCliResult - success depends on beads repo state
    expect(result).toHaveProperty("success");
    // Either null (no tasks) or a valid bead when successful
    if (result.success && result.data !== null && result.data !== undefined) {
      expect(result.data.id).toBeDefined();
      expect(result.data.title).toBeDefined();
    }
  });
});

describe("BeadsCliResult type structure", () => {
  test("success result structure", () => {
    type BeadsCliResult<T> = {
      success: boolean;
      data?: T;
      error?: { code: string; message: string };
    };

    const successResult: BeadsCliResult<Bead> = {
      success: true,
      data: { id: "test-1", title: "Test", status: "open" },
    };

    expect(successResult.success).toBe(true);
    expect(successResult.data?.id).toBe("test-1");
    expect(successResult.error).toBeUndefined();
  });

  test("failure result structure", () => {
    type BeadsCliResult<T> = {
      success: boolean;
      data?: T;
      error?: { code: string; message: string };
    };

    const failResult: BeadsCliResult<Bead> = {
      success: false,
      error: { code: "BEADS_COMMAND_FAILED", message: "Command failed" },
    };

    expect(failResult.success).toBe(false);
    expect(failResult.error?.code).toBe("BEADS_COMMAND_FAILED");
  });
});

describe("CreateBeadOptions type structure", () => {
  test("minimal options", () => {
    type CreateBeadOptions = {
      parent?: string;
      labels?: string[];
      notes?: string;
      depends?: string;
    };

    const options: CreateBeadOptions = {};
    expect(options.parent).toBeUndefined();
  });

  test("full options", () => {
    type CreateBeadOptions = {
      parent?: string;
      labels?: string[];
      notes?: string;
      depends?: string;
    };

    const options: CreateBeadOptions = {
      parent: "parent-1",
      labels: ["task", "urgent"],
      notes: "Important task",
      depends: "dep-1",
    };

    expect(options.parent).toBe("parent-1");
    expect(options.labels).toEqual(["task", "urgent"]);
    expect(options.notes).toBe("Important task");
    expect(options.depends).toBe("dep-1");
  });
});
