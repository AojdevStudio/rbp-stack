import { describe, test, expect } from "bun:test";
import { injectFailureContext, isUiTask } from "../../lib/src/workflows/beads";
import type { Bead } from "../../lib/src/integrations/beads-cli";

describe("injectFailureContext", () => {
  test("adds failure context to prompt", () => {
    const prompt = "Implement the feature";
    const context = {
      taskId: "rbp-269.1",
      attempt: 1,
      previousError: "TypeError: undefined is not a function",
    };

    const result = injectFailureContext(prompt, context);

    expect(result).toContain("Implement the feature");
    expect(result).toContain("attempt 2");
    expect(result).toContain("rbp-269.1");
    expect(result).toContain("TypeError: undefined is not a function");
  });

  test("handles missing previous error", () => {
    const prompt = "Fix the bug";
    const context = {
      taskId: "rbp-269.2",
      attempt: 0,
    };

    const result = injectFailureContext(prompt, context);

    expect(result).toContain("Fix the bug");
    expect(result).toContain("attempt 1");
    expect(result).not.toContain("Previous error:");
  });
});

describe("isUiTask", () => {
  const defaultKeywords = ["UI", "component", "button", "form"];

  test("detects UI task by title", () => {
    const task: Bead = {
      id: "test-1",
      title: "Add login button component",
      status: "open",
    };

    expect(isUiTask(task, defaultKeywords)).toBe(true);
  });

  test("detects UI task by label", () => {
    const task: Bead = {
      id: "test-2",
      title: "Implement feature",
      status: "open",
      labels: ["ui", "frontend"],
    };

    expect(isUiTask(task, defaultKeywords)).toBe(true);
  });

  test("detects UI task by notes", () => {
    const task: Bead = {
      id: "test-3",
      title: "Add validation",
      status: "open",
      notes: "Add form validation to the signup page",
    };

    expect(isUiTask(task, defaultKeywords)).toBe(true);
  });

  test("returns false for non-UI task", () => {
    const task: Bead = {
      id: "test-4",
      title: "Add database migration",
      status: "open",
      notes: "Create migration for user table",
      labels: ["backend", "database"],
    };

    expect(isUiTask(task, defaultKeywords)).toBe(false);
  });

  test("is case insensitive", () => {
    const task: Bead = {
      id: "test-5",
      title: "BUTTON COMPONENT",
      status: "open",
    };

    expect(isUiTask(task, defaultKeywords)).toBe(true);
  });
});
