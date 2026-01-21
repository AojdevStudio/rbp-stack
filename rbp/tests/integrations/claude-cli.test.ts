import { describe, test, expect } from "bun:test";
import { buildTaskPrompt } from "../../lib/src/integrations/claude-cli";

describe("buildTaskPrompt", () => {
  test("builds basic prompt with just title", () => {
    const prompt = buildTaskPrompt("Implement login feature");

    expect(prompt).toContain("# Task: Implement login feature");
    expect(prompt).toContain("## Instructions");
    expect(prompt).not.toContain("## Notes");
    expect(prompt).not.toContain("## Previous Attempt Context");
  });

  test("includes notes when provided", () => {
    const prompt = buildTaskPrompt(
      "Add validation",
      "Validate email format and password strength"
    );

    expect(prompt).toContain("# Task: Add validation");
    expect(prompt).toContain("## Notes");
    expect(prompt).toContain("Validate email format and password strength");
  });

  test("includes failure context when provided", () => {
    const prompt = buildTaskPrompt(
      "Fix bug",
      "The login fails on mobile",
      "Previous error: TypeError at line 42"
    );

    expect(prompt).toContain("## Previous Attempt Context");
    expect(prompt).toContain("Previous error: TypeError at line 42");
  });

  test("includes all sections when all provided", () => {
    const prompt = buildTaskPrompt(
      "Full task",
      "Some notes",
      "Some context"
    );

    expect(prompt).toContain("# Task: Full task");
    expect(prompt).toContain("## Notes");
    expect(prompt).toContain("Some notes");
    expect(prompt).toContain("## Previous Attempt Context");
    expect(prompt).toContain("Some context");
    expect(prompt).toContain("## Instructions");
  });

  test("instructions include test verification", () => {
    const prompt = buildTaskPrompt("Any task");

    expect(prompt).toContain("Run tests");
    expect(prompt).toContain("tests pass");
  });
});
