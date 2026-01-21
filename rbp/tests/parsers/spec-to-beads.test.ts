import { describe, test, expect } from "bun:test";

// Test parsing logic without calling beads CLI
describe("spec-to-beads parser", () => {
  test("extracts spec title from markdown H1", () => {
    const content = `# My Awesome Specification

Some content here`;

    const match = content.match(/^#\s+(.+)$/m);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("My Awesome Specification");
  });

  test("extracts test command from spec", () => {
    const content = `## Something

### Test Command

\`bun test --coverage\`

More content`;

    const match = content.match(/###\s*Test Command\s*\n+\s*`([^`]+)`/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("bun test --coverage");
  });

  test("extracts tasks section with RBP markers", () => {
    const content = `## Implementation Tasks

<!-- RBP-TASKS-START -->
### Task 1: Do something
- **ID:** task-001
- **Dependencies:** none
<!-- RBP-TASKS-END -->`;

    const markerMatch = content.match(/<!--\s*RBP-TASKS-START\s*-->([\s\S]*?)<!--\s*RBP-TASKS-END\s*-->/);
    expect(markerMatch).not.toBeNull();
    expect(markerMatch![1]).toContain("Task 1: Do something");
  });

  test("parses task attributes", () => {
    const taskSection = `### Task 1: Create user module
- **ID:** task-001
- **Dependencies:** none
- **Files:** src/user.ts
- **Acceptance:** User module exists
- **Tests:** user.test.ts`;

    const titleMatch = taskSection.match(/^###\s*Task\s+\d+:\s*(.+)$/m);
    expect(titleMatch![1]).toBe("Create user module");

    const idMatch = taskSection.match(/^\s*-\s*\*\*ID:\*\*\s*(.+)$/m);
    expect(idMatch![1]).toBe("task-001");

    const depsMatch = taskSection.match(/^\s*-\s*\*\*Dependencies:\*\*\s*(.+)$/m);
    expect(depsMatch![1]).toBe("none");

    const filesMatch = taskSection.match(/^\s*-\s*\*\*Files:\*\*\s*(.+)$/m);
    expect(filesMatch![1]).toBe("src/user.ts");
  });

  test("detects UI tasks by keywords", () => {
    const uiKeywords = /\[UI\]|component|visual|browser|render|display|click|button|form|modal|sidebar|header|page|screen|responsive|mobile|desktop|layout|style|CSS|frontend|playwright/i;

    expect(uiKeywords.test("Create login button")).toBe(true);
    expect(uiKeywords.test("Add [UI] component")).toBe(true);
    expect(uiKeywords.test("Implement modal dialog")).toBe(true);
    expect(uiKeywords.test("Update database schema")).toBe(false);
    expect(uiKeywords.test("Add API endpoint")).toBe(false);
  });

  test("parses subtasks from checklist", () => {
    const content = `- **Subtasks:**
  - [ ] First subtask
  - [ ] Second subtask
  - [x] Completed subtask`;

    const subtasks: string[] = [];
    const lines = content.split("\n");
    let inSubtasks = false;

    for (const line of lines) {
      if (line.match(/^\s*-\s*\*\*Subtasks:\*\*/)) {
        inSubtasks = true;
        continue;
      }
      if (inSubtasks) {
        const match = line.match(/^\s*-\s*\[[ x]\]\s*(.+)$/);
        if (match) {
          subtasks.push(match[1]);
        }
      }
    }

    expect(subtasks).toHaveLength(3);
    expect(subtasks[0]).toBe("First subtask");
    expect(subtasks[2]).toBe("Completed subtask");
  });
});
