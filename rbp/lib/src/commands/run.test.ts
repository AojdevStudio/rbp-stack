import { describe, expect, test } from "bun:test";
import type { Bead } from "../integrations/beads-cli";
import { buildTaskXml } from "./run";

describe("buildTaskXml", () => {
  test("empty acceptance_criteria outputs default criterion", () => {
    const task: Bead = {
      id: "test-001",
      title: "Test Task",
      description: "Test description",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      acceptance_criteria: [],
    };

    const xml = buildTaskXml(task);

    expect(xml).toContain("<Criterion><![CDATA[Task completed successfully]]></Criterion>");
    expect(xml).not.toContain("undefined");
  });

  test("multiple acceptance_criteria generate proper XML array", () => {
    const task: Bead = {
      id: "test-002",
      title: "Multi-criteria Task",
      description: "Task with multiple criteria",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      acceptance_criteria: [
        "Criterion one is met",
        "Criterion two is met",
        "Criterion three is met",
      ],
    };

    const xml = buildTaskXml(task);

    expect(xml).toContain("<Criterion><![CDATA[Criterion one is met]]></Criterion>");
    expect(xml).toContain("<Criterion><![CDATA[Criterion two is met]]></Criterion>");
    expect(xml).toContain("<Criterion><![CDATA[Criterion three is met]]></Criterion>");
    expect(xml).not.toContain("Task completed successfully");
  });

  test("estimated_size small is properly rendered", () => {
    const task: Bead = {
      id: "test-003",
      title: "Small Task",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      estimated_size: "small",
    };

    const xml = buildTaskXml(task);

    expect(xml).toContain("<EstimatedSize>small</EstimatedSize>");
  });

  test("estimated_size medium is properly rendered", () => {
    const task: Bead = {
      id: "test-004",
      title: "Medium Task",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      estimated_size: "medium",
    };

    const xml = buildTaskXml(task);

    expect(xml).toContain("<EstimatedSize>medium</EstimatedSize>");
  });

  test("estimated_size needs-decomposition is properly rendered", () => {
    const task: Bead = {
      id: "test-005",
      title: "Large Task",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      estimated_size: "needs-decomposition",
    };

    const xml = buildTaskXml(task);

    expect(xml).toContain("<EstimatedSize>needs-decomposition</EstimatedSize>");
  });

  test("task with parent_id includes ParentId element", () => {
    const task: Bead = {
      id: "test-006",
      title: "Child Task",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      parent_id: "parent-001",
    };

    const xml = buildTaskXml(task);

    expect(xml).toContain("<ParentId><![CDATA[parent-001]]></ParentId>");
  });

  test("task without parent_id omits ParentId element", () => {
    const task: Bead = {
      id: "test-007",
      title: "Root Task",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };

    const xml = buildTaskXml(task);

    expect(xml).not.toContain("<ParentId>");
    expect(xml).not.toContain("ParentId");
  });

  test("CDATA escaping handles ]]> characters", () => {
    const task: Bead = {
      id: "test-008",
      title: "Task with ]]> in title",
      description: "Description with ]]> characters",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      acceptance_criteria: ["Criterion with ]]> inside"],
    };

    const xml = buildTaskXml(task);

    // The ]]> should be escaped to ]]]]><![CDATA[>
    expect(xml).toContain("]]]]><![CDATA[>");
    expect(xml).not.toContain("]]>]]>");
  });

  test("uses description when provided", () => {
    const task: Bead = {
      id: "test-009",
      title: "Task with Description",
      description: "This is the description field",
      notes: "This is the notes field",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };

    const xml = buildTaskXml(task);

    expect(xml).toContain("<Description><![CDATA[This is the description field]]></Description>");
    expect(xml).not.toContain("This is the notes field");
  });

  test("falls back to notes when no description provided", () => {
    const task: Bead = {
      id: "test-010",
      title: "Task with Notes Only",
      notes: "This is the notes field",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };

    const xml = buildTaskXml(task);

    expect(xml).toContain("<Description><![CDATA[This is the notes field]]></Description>");
  });

  test("uses default when neither description nor notes provided", () => {
    const task: Bead = {
      id: "test-011",
      title: "Task without Description or Notes",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };

    const xml = buildTaskXml(task);

    expect(xml).toContain("<Description><![CDATA[No description provided]]></Description>");
  });

  test("all fields populated produces complete XML", () => {
    const task: Bead = {
      id: "test-012",
      title: "Complete Task",
      description: "Full task description",
      notes: "Additional notes",
      status: "open",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      estimated_size: "small",
      parent_id: "parent-002",
      acceptance_criteria: [
        "First criterion",
        "Second criterion",
      ],
    };

    const xml = buildTaskXml(task);

    expect(xml).toContain("<BeadId><![CDATA[test-012]]></BeadId>");
    expect(xml).toContain("<Title><![CDATA[Complete Task]]></Title>");
    expect(xml).toContain("<Description><![CDATA[Full task description]]></Description>");
    expect(xml).toContain("<EstimatedSize>small</EstimatedSize>");
    expect(xml).toContain("<ParentId><![CDATA[parent-002]]></ParentId>");
    expect(xml).toContain("<Criterion><![CDATA[First criterion]]></Criterion>");
    expect(xml).toContain("<Criterion><![CDATA[Second criterion]]></Criterion>");
  });
});
