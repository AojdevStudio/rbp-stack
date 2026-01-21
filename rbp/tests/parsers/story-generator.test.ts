import { describe, test, expect } from "bun:test";

describe("story-generator", () => {
  test("extracts epic number from branch name", () => {
    const branches = [
      { branch: "epic-4/feature-auth", expected: "4" },
      { branch: "epic-12/add-users", expected: "12" },
      { branch: "epic4/something", expected: "4" },
      { branch: "feature/add-login", expected: null },
      { branch: "main", expected: null },
    ];

    for (const { branch, expected } of branches) {
      const epicMatch = branch.match(/^epic[/-]?(\d+)/i);
      const result = epicMatch ? epicMatch[1] : null;
      expect(result).toBe(expected);
    }
  });

  test("parses story key to extract story number", () => {
    const key = "4-9-bulk-import-csv";
    const epicNum = "4";

    const match = key.match(new RegExp(`^${epicNum}-(\\d+)`));
    expect(match).not.toBeNull();
    expect(match![1]).toBe("9");
  });

  test("extracts story slug from key", () => {
    const key = "4-9-bulk-import-csv";
    const epicNum = "4";
    const storyNum = "9";

    // Remove epic-storynum prefix
    const slug = key.replace(new RegExp(`^${epicNum}-${storyNum}-?`), "");
    expect(slug).toBe("bulk-import-csv");
  });

  test("generates title from slug", () => {
    const slug = "bulk-import-csv";
    const title = slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    expect(title).toBe("Bulk Import Csv");
  });

  test("finds backlog story in sprint status format", () => {
    const sprintStatus = `
epic: 4
stories:
  4-7-user-auth: done
  4-8-session-mgmt: in-progress
  4-9-bulk-import-csv: backlog
  4-10-export: backlog
`;

    const epicNum = "4";
    const lines = sprintStatus.split("\n");

    let firstBacklog: string | null = null;
    for (const line of lines) {
      const match = line.match(new RegExp(`^\\s+(${epicNum}-\\d+[^:]*?):\\s*backlog`));
      if (match) {
        firstBacklog = match[1];
        break;
      }
    }

    expect(firstBacklog).toBe("4-9-bulk-import-csv");
  });

  test("detects epic complete when no backlog stories", () => {
    const sprintStatus = `
epic: 4
stories:
  4-7-user-auth: done
  4-8-session-mgmt: done
`;

    const epicNum = "4";
    const hasBacklog = new RegExp(`^\\s+${epicNum}-\\d+[^:]*:\\s*backlog`, "m").test(sprintStatus);
    const hasStories = new RegExp(`^\\s+${epicNum}-\\d+`, "m").test(sprintStatus);

    expect(hasBacklog).toBe(false);
    expect(hasStories).toBe(true);
    // Epic is complete: has stories but none in backlog
  });

  test("parses story from table format in epic file", () => {
    const epicContent = `## Stories

| # | ID | Description | Dependencies |
|---|-----|-------------|--------------|
| 7 | 4-7 | User authentication | none |
| 8 | 4-8 | Session management | 4-7 |
| 9 | 4-9 | Bulk import CSV | 4-4, 4-5 |
`;

    const epicNum = "4";
    const storyNum = "9";

    // Match: "| 9 | 4-9 | Bulk import CSV | 4-4, 4-5 |"
    const tableMatch = epicContent.match(
      new RegExp(`\\|\\s*\\d+\\s*\\|\\s*${epicNum}-${storyNum}\\s*\\|([^|]+)\\|`)
    );

    expect(tableMatch).not.toBeNull();
    expect(tableMatch![1].trim()).toBe("Bulk import CSV");
  });

  test("generates story file content", () => {
    const context = {
      epicNum: "4",
      storyNum: "9",
      storyKey: "4-9",
      title: "Bulk Import CSV",
      role: "developer",
      capability: "implement bulk import csv",
      benefit: "the feature can progress toward completion",
      acceptanceCriteria: "| AC1 | Bulk import complete | Tests pass |",
      tasks: "- [ ] 1.1 Implement import\n- [ ] 1.2 Write tests",
      archContext: "- **data-model**: Schema definitions...",
    };

    const content = `# Story ${context.epicNum}.${context.storyNum}: ${context.title}

Status: Draft

## Story

As a **${context.role}**,
I want **${context.capability}**,
so that **${context.benefit}**.`;

    expect(content).toContain("Story 4.9: Bulk Import CSV");
    expect(content).toContain("As a **developer**");
  });
});
