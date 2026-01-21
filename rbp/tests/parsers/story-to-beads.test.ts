import { describe, test, expect } from "bun:test";

// Test parsing logic without calling beads CLI
describe("story-to-beads parser", () => {
  test("extracts story title from markdown H1", () => {
    const content = `# Story 4.7: User Authentication

As a user, I want to log in securely.`;

    const match = content.match(/^#\s+(.+)$/m);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("Story 4.7: User Authentication");
  });

  test("extracts story ID from filename", () => {
    const filename = "story-4-7-user-auth.md";
    // Match story-<epic>-<story> pattern (digits separated by dashes, not trailing dash)
    const idMatch = filename.match(/^story-\d+(-\d+)*/);
    expect(idMatch).not.toBeNull();
    expect(idMatch![0]).toBe("story-4-7");
  });

  test("generates timestamp ID when no story ID in filename", () => {
    const filename = "my-feature.md";
    const idMatch = filename.match(/^story-[\d-]+/);
    expect(idMatch).toBeNull();
    // Would generate: `story-${Date.now()}`
  });

  test("detects UI story from content", () => {
    const uiKeywords = /UI|component|visual|browser|render|display|click|button|form|modal|sidebar|header|page|screen|responsive|mobile|desktop|layout|style|CSS|frontend/i;

    const uiContent = `## Acceptance Criteria
- User can click the submit button
- Form renders correctly`;

    const nonUiContent = `## Acceptance Criteria
- API returns 200 OK
- Database is updated`;

    expect(uiKeywords.test(uiContent)).toBe(true);
    expect(uiKeywords.test(nonUiContent)).toBe(false);
  });

  test("extracts subtasks from checkbox format", () => {
    const content = `## Tasks

- [ ] Implement login form
- [x] Add validation
- [ ] Write tests`;

    const subtasks: string[] = [];
    const checkboxMatches = content.matchAll(/^\s*-\s*\[[ x]\]\s*(.+)$/gm);
    for (const match of checkboxMatches) {
      subtasks.push(match[1].trim());
    }

    expect(subtasks).toHaveLength(3);
    expect(subtasks[0]).toBe("Implement login form");
    expect(subtasks[1]).toBe("Add validation");
    expect(subtasks[2]).toBe("Write tests");
  });

  test("extracts subtasks from bullet list in Tasks section", () => {
    const content = `## Tasks

- Implement the feature
- Write unit tests
- Update documentation

## Notes`;

    const sectionMatch = content.match(/(Tasks|Acceptance Criteria|Subtasks)\s*\n([\s\S]*?)(?=\n##|$)/i);
    expect(sectionMatch).not.toBeNull();

    const section = sectionMatch![2];
    const items: string[] = [];
    const listMatches = section.matchAll(/^\s*[-*\d.]+\s*(.+)$/gm);
    for (const match of listMatches) {
      const item = match[1].trim();
      if (item && !item.startsWith("#")) {
        items.push(item);
      }
    }

    expect(items).toHaveLength(3);
    expect(items[0]).toBe("Implement the feature");
  });

  test("extracts description from story content", () => {
    const content = `# Story 1.1: Feature Name

This is the description of the story.
It spans multiple lines.

## Acceptance Criteria`;

    const match = content.match(/^#[^#].+?\n([\s\S]*?)(?=\n##|$)/);
    expect(match).not.toBeNull();

    const description = match![1]
      .replace(/^#.*$/gm, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 500);

    expect(description).toBe("This is the description of the story. It spans multiple lines.");
  });
});
