import { describe, test, expect, mock, beforeEach } from "bun:test";
import { BeadSchema, BeadListSchema, type Bead } from "../../lib/src/integrations/beads-cli";

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
