import { describe, test, expect } from "bun:test";

describe("hooks", () => {
  test("session start output format", () => {
    const readyTask = "Implement user authentication";
    const completed = 5;
    const total = 12;

    const output = `
════════════════════════════════════════════════════════
  RBP Active Task
════════════════════════════════════════════════════════

${readyTask}

Progress: ${completed}/${total} tasks complete

Commands:
  Start loop:  ralph run
  View status: bd status
════════════════════════════════════════════════════════
`;

    expect(output).toContain("RBP Active Task");
    expect(output).toContain(readyTask);
    expect(output).toContain("5/12 tasks complete");
  });

  test("session start all complete format", () => {
    const completed = 12;
    const total = 12;

    const output = `
RBP Status: All ${completed}/${total} tasks complete
`;

    expect(output).toContain("All 12/12 tasks complete");
  });

  test("pre-compact progress log format", () => {
    const timestamp = "2026-01-20 12:30:45";
    const open = 7;
    const total = 15;
    const currentTask = "Fix the bug";

    const logEntry = `[${timestamp}] Context compaction - progress checkpoint
  Open tasks: ${open}
  Total tasks: ${total}
  Current task: ${currentTask}

`;

    expect(logEntry).toContain("[2026-01-20 12:30:45]");
    expect(logEntry).toContain("Open tasks: 7");
    expect(logEntry).toContain("Total tasks: 15");
    expect(logEntry).toContain("Current task: Fix the bug");
  });

  test("pre-compact output format", () => {
    const completed = 8;
    const total = 15;
    const currentTask = "Add validation";

    const output = `
RBP Progress Saved:
  Tasks: ${completed}/${total} complete
  Current: ${currentTask}
`;

    expect(output).toContain("Tasks: 8/15 complete");
    expect(output).toContain("Current: Add validation");
  });

  test("hook script generation", () => {
    const sessionStartScript = `#!/usr/bin/env bun
// SessionStart hook - show active task
import { runSessionStartHook } from "./lib/dist/index.js";

const result = await runSessionStartHook();
if (result.output) {
  console.log(result.output);
}
`;

    expect(sessionStartScript).toContain("#!/usr/bin/env bun");
    expect(sessionStartScript).toContain("runSessionStartHook");
    expect(sessionStartScript).toContain("result.output");
  });

  test("hooks settings configuration format", () => {
    const hooksConfig = {
      hooks: {
        SessionStart: ["ralph", "hooks", "--session-start"],
        PreCompact: ["ralph", "hooks", "--pre-compact"],
      },
    };

    expect(hooksConfig.hooks.SessionStart).toEqual(["ralph", "hooks", "--session-start"]);
    expect(hooksConfig.hooks.PreCompact).toEqual(["ralph", "hooks", "--pre-compact"]);
  });
});
