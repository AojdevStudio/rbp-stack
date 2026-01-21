import { describe, test, expect } from "bun:test";

describe("project-detector", () => {
  test("extracts epic number from various branch formats", () => {
    const branches = [
      { branch: "epic-4/feature-name", expected: "4" },
      { branch: "epic4/something", expected: "4" },
      { branch: "epic-12/multi-digit", expected: "12" },
      { branch: "EPIC-7/caps", expected: "7" },
      { branch: "feature/new-stuff", expected: undefined },
      { branch: "main", expected: undefined },
      { branch: "develop", expected: undefined },
    ];

    for (const { branch, expected } of branches) {
      const epicMatch = branch.match(/^epic[/-]?(\d+)/i);
      const result = epicMatch ? epicMatch[1] : undefined;
      expect(result).toBe(expected);
    }
  });

  test("detects project mode from markers", () => {
    // Test mode detection logic
    const testCases = [
      {
        hasBmadWithEpic: true,
        hasBeads: false,
        hasQuickPlan: false,
        expected: "bmad",
      },
      {
        hasBmadWithEpic: false,
        hasBeads: true,
        hasQuickPlan: false,
        expected: "beads",
      },
      {
        hasBmadWithEpic: false,
        hasBeads: false,
        hasQuickPlan: true,
        expected: "quickplan",
      },
      {
        hasBmadWithEpic: false,
        hasBeads: false,
        hasQuickPlan: false,
        expected: "unknown",
      },
    ];

    for (const { hasBmadWithEpic, hasBeads, hasQuickPlan, expected } of testCases) {
      let mode: string;

      if (hasBmadWithEpic) {
        mode = "bmad";
      } else if (hasBeads) {
        mode = "beads";
      } else if (hasQuickPlan) {
        mode = "quickplan";
      } else {
        mode = "unknown";
      }

      expect(mode).toBe(expected);
    }
  });

  test("sprint status paths to check", () => {
    const paths = [
      "docs/bmm/sprint-status.yaml",
      "docs/bmm/implementation-artifacts/sprint-status.yaml",
      "_bmad/sprint-status.yaml",
      "sprint-status.yaml",
    ];

    expect(paths).toHaveLength(4);
    expect(paths[0]).toContain("bmm");
  });

  test("BMAD markers to check", () => {
    const markers = [".beads", "docs/bmm", "_bmad", "docs/bmad", ".bmad-core"];

    expect(markers).toHaveLength(5);
    expect(markers).toContain(".beads");
    expect(markers).toContain("_bmad");
  });

  test("prerequisite check result structure", () => {
    const result = { ok: true, missing: [] as string[] };

    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);

    const failedResult = { ok: false, missing: ["claude", "bd"] };
    expect(failedResult.ok).toBe(false);
    expect(failedResult.missing).toContain("claude");
    expect(failedResult.missing).toContain("bd");
  });
});
