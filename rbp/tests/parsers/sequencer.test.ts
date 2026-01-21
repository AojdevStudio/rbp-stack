import { describe, test, expect } from "bun:test";

describe("sequencer", () => {
  test("calculates correct number of phases", () => {
    const testCases = [
      { subtasks: 10, phaseSize: 5, expected: 2 },
      { subtasks: 12, phaseSize: 5, expected: 3 },
      { subtasks: 5, phaseSize: 5, expected: 1 },
      { subtasks: 1, phaseSize: 5, expected: 1 },
      { subtasks: 15, phaseSize: 3, expected: 5 },
    ];

    for (const { subtasks, phaseSize, expected } of testCases) {
      const totalPhases = Math.ceil(subtasks / phaseSize);
      expect(totalPhases).toBe(expected);
    }
  });

  test("groups subtasks into phases correctly", () => {
    const subtasks = [
      { id: "1", title: "Task 1" },
      { id: "2", title: "Task 2" },
      { id: "3", title: "Task 3" },
      { id: "4", title: "Task 4" },
      { id: "5", title: "Task 5" },
      { id: "6", title: "Task 6" },
      { id: "7", title: "Task 7" },
    ];

    const phaseSize = 3;
    const phases: { number: number; tasks: typeof subtasks }[] = [];

    for (let i = 0; i < subtasks.length; i += phaseSize) {
      phases.push({
        number: Math.floor(i / phaseSize) + 1,
        tasks: subtasks.slice(i, i + phaseSize),
      });
    }

    expect(phases).toHaveLength(3);
    expect(phases[0].tasks).toHaveLength(3);
    expect(phases[1].tasks).toHaveLength(3);
    expect(phases[2].tasks).toHaveLength(1);
    expect(phases[0].number).toBe(1);
    expect(phases[2].number).toBe(3);
  });

  test("filters ready subtasks", () => {
    const subtasks = [
      { id: "1", title: "Task 1", status: "closed" },
      { id: "2", title: "Task 2", status: "open" },
      { id: "3", title: "Task 3", status: "in_progress" },
      { id: "4", title: "Task 4", status: "blocked" },
      { id: "5", title: "Task 5", status: "open" },
    ];

    const ready = subtasks.filter(
      (b) => b.status === "open" || b.status === "in_progress"
    );

    expect(ready).toHaveLength(3);
    expect(ready.map((r) => r.id)).toEqual(["2", "3", "5"]);
  });

  test("calculates current phase based on completed tasks", () => {
    const testCases = [
      { completed: 0, phaseSize: 5, expectedPhase: 1, completedInPhase: 0 },
      { completed: 3, phaseSize: 5, expectedPhase: 1, completedInPhase: 3 },
      { completed: 5, phaseSize: 5, expectedPhase: 2, completedInPhase: 0 },
      { completed: 7, phaseSize: 5, expectedPhase: 2, completedInPhase: 2 },
      { completed: 10, phaseSize: 5, expectedPhase: 3, completedInPhase: 0 },
    ];

    for (const { completed, phaseSize, expectedPhase, completedInPhase: expectedCompletedInPhase } of testCases) {
      const currentPhase = Math.floor(completed / phaseSize) + 1;
      const completedInPhase = completed % phaseSize;

      expect(currentPhase).toBe(expectedPhase);
      expect(completedInPhase).toBe(expectedCompletedInPhase);
    }
  });

  test("limits first phase of ready tasks", () => {
    const readyTasks = Array.from({ length: 12 }, (_, i) => ({
      id: String(i + 1),
      title: `Task ${i + 1}`,
    }));

    const phaseSize = 5;
    const firstPhase = readyTasks.slice(0, phaseSize);
    const remaining = readyTasks.length - phaseSize;

    expect(firstPhase).toHaveLength(5);
    expect(remaining).toBe(7);
  });
});
