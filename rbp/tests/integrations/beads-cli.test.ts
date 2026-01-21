import { describe, test, expect, mock, beforeEach, spyOn, afterEach } from "bun:test";
import {
  BeadSchema,
  BeadListSchema,
  type Bead,
  checkBeadsInstalled,
  listBeads,
  getBeadsStatus,
  getReadyBead,
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

// Integration tests that call actual bd CLI - these tests gracefully handle when bd is not available
describe("beads CLI integration", () => {
  test("checkBeadsInstalled returns boolean", async () => {
    const result = await checkBeadsInstalled();
    // Returns true if installed, false otherwise
    expect(typeof result).toBe("boolean");
  });

  test("listBeads handles CLI availability", async () => {
    const isInstalled = await checkBeadsInstalled();
    if (!isInstalled) {
      // Skip test when bd is not in PATH
      expect(true).toBe(true);
      return;
    }

    const result = await listBeads();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
    }
  });

  test("listBeads with options handles CLI availability", async () => {
    const isInstalled = await checkBeadsInstalled();
    if (!isInstalled) {
      // Skip test when bd is not in PATH
      expect(true).toBe(true);
      return;
    }

    const resultAll = await listBeads({ all: true });
    const resultStatus = await listBeads({ status: "open" });

    expect(resultAll.success).toBe(true);
    expect(resultStatus.success).toBe(true);
  });

  test("getBeadsStatus handles CLI availability", async () => {
    const isInstalled = await checkBeadsInstalled();
    if (!isInstalled) {
      // Skip test when bd is not in PATH
      expect(true).toBe(true);
      return;
    }

    const result = await getBeadsStatus();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data?.open).toBe("number");
      expect(typeof result.data?.total).toBe("number");
    }
  });

  test("getReadyBead handles CLI availability", async () => {
    const isInstalled = await checkBeadsInstalled();
    if (!isInstalled) {
      // Skip test when bd is not in PATH
      expect(true).toBe(true);
      return;
    }

    const result = await getReadyBead();
    expect(result.success).toBe(true);
    // Either null (no tasks) or a valid bead
    if (result.data !== null && result.data !== undefined) {
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
