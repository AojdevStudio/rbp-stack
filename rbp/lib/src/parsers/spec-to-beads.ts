/**
 * Spec to Beads Parser
 * Ported from parse-spec-to-beads.sh
 *
 * Parses a quick-plan specification markdown file and creates corresponding beads:
 * 1. Parent bead for the spec itself
 * 2. Child beads for each implementation task
 * 3. Sets up dependencies between tasks
 * 4. Auto-detects UI tasks and sets requires-playwright flag
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";
import { logger } from "../observability/logger";
import { getReadyBead, closeBead, createBead, updateBeadStatus, syncBeads, addBeadNote } from "../integrations/beads-cli";

// UI detection keywords
const UI_KEYWORDS = /\[UI\]|component|visual|browser|render|display|click|button|form|modal|sidebar|header|page|screen|responsive|mobile|desktop|layout|style|CSS|frontend|playwright/i;

export interface ParsedTask {
  title: string;
  id: string;
  dependencies: string;
  files?: string;
  acceptance?: string;
  tests?: string;
  isUi: boolean;
  subtasks: string[];
}

export interface SpecParseResult {
  success: boolean;
  specTitle: string;
  specId: string;
  parentBeadId?: string;
  tasksCreated: number;
  testCommand: string;
  error?: string;
}

/**
 * Extract spec title from markdown (first H1)
 */
function extractSpecTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].replace(/\s+Specification$/, "");
  }
  return "Untitled Spec";
}

/**
 * Extract test command from spec
 */
function extractTestCommand(content: string): string {
  const match = content.match(/###\s*Test Command\s*\n+\s*`([^`]+)`/);
  return match ? match[1] : "bun test";
}

/**
 * Extract problem statement as description
 */
function extractDescription(content: string): string {
  const match = content.match(/##\s*Problem Statement\s*\n([\s\S]*?)(?=\n##|$)/);
  if (match) {
    return match[1]
      .replace(/^##.*$/gm, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 500);
  }
  return "";
}

/**
 * Extract tasks section from markdown
 */
function extractTasksSection(content: string): string | null {
  // Try RBP markers first
  const markerMatch = content.match(/<!--\s*RBP-TASKS-START\s*-->([\s\S]*?)<!--\s*RBP-TASKS-END\s*-->/);
  if (markerMatch) return markerMatch[1];

  // Fall back to Implementation Tasks section
  const sectionMatch = content.match(/##\s*Implementation Tasks\s*\n([\s\S]*?)(?=\n##|$)/);
  if (sectionMatch) return sectionMatch[1];

  return null;
}

/**
 * Parse individual tasks from tasks section
 */
function parseTasks(tasksSection: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = tasksSection.split("\n");

  let currentTask: Partial<ParsedTask> | null = null;
  let inSubtasks = false;
  let currentSubtasks: string[] = [];

  for (const line of lines) {
    // Check for task header: ### Task N: Title
    const taskHeaderMatch = line.match(/^###\s*Task\s+\d+:\s*(.+)$/);
    if (taskHeaderMatch) {
      // Save previous task
      if (currentTask?.title && currentTask?.id) {
        tasks.push({
          title: currentTask.title,
          id: currentTask.id,
          dependencies: currentTask.dependencies || "none",
          files: currentTask.files,
          acceptance: currentTask.acceptance,
          tests: currentTask.tests,
          isUi: UI_KEYWORDS.test(`${currentTask.title} ${currentTask.files || ""} ${currentTask.tests || ""}`),
          subtasks: currentSubtasks,
        });
      }

      // Start new task
      currentTask = { title: taskHeaderMatch[1] };
      currentSubtasks = [];
      inSubtasks = false;
      continue;
    }

    if (!currentTask) continue;

    // Parse task attributes
    const idMatch = line.match(/^\s*-\s*\*\*ID:\*\*\s*(.+)$/);
    if (idMatch) {
      currentTask.id = idMatch[1].trim();
      continue;
    }

    const depsMatch = line.match(/^\s*-\s*\*\*Dependencies:\*\*\s*(.+)$/);
    if (depsMatch) {
      currentTask.dependencies = depsMatch[1].trim();
      continue;
    }

    const filesMatch = line.match(/^\s*-\s*\*\*Files:\*\*\s*(.+)$/);
    if (filesMatch) {
      currentTask.files = filesMatch[1];
      continue;
    }

    const acceptanceMatch = line.match(/^\s*-\s*\*\*Acceptance:\*\*\s*(.+)$/);
    if (acceptanceMatch) {
      currentTask.acceptance = acceptanceMatch[1];
      continue;
    }

    const testsMatch = line.match(/^\s*-\s*\*\*Tests:\*\*\s*(.+)$/);
    if (testsMatch) {
      currentTask.tests = testsMatch[1];
      continue;
    }

    // Detect subtasks section
    if (line.match(/^\s*-\s*\*\*Subtasks:\*\*/)) {
      inSubtasks = true;
      continue;
    }

    // Parse subtask items
    if (inSubtasks) {
      const subtaskMatch = line.match(/^\s*-\s*\[[ xX]\]\s*(.+)$/);
      if (subtaskMatch) {
        currentSubtasks.push(subtaskMatch[1]);
        continue;
      }

      // End subtasks when hitting another field or new task
      if (line.match(/(^\s*-\s*\*\*|^###)/)) {
        inSubtasks = false;
      }
    }
  }

  // Don't forget the last task
  if (currentTask?.title && currentTask?.id) {
    tasks.push({
      title: currentTask.title,
      id: currentTask.id,
      dependencies: currentTask.dependencies || "none",
      files: currentTask.files,
      acceptance: currentTask.acceptance,
      tests: currentTask.tests,
      isUi: UI_KEYWORDS.test(`${currentTask.title} ${currentTask.files || ""} ${currentTask.tests || ""}`),
      subtasks: currentSubtasks,
    });
  }

  return tasks;
}

/**
 * Parse a quick-plan spec file and create beads
 */
export async function parseSpecToBeads(specFilePath: string): Promise<SpecParseResult> {
  if (!existsSync(specFilePath)) {
    return {
      success: false,
      specTitle: "",
      specId: "",
      tasksCreated: 0,
      testCommand: "bun test",
      error: `File not found: ${specFilePath}`,
    };
  }

  const content = readFileSync(specFilePath, "utf-8");

  // Check RBP compatibility
  if (!content.includes("RBP Compatible: Yes")) {
    logger.warn("Spec may not be RBP compatible (missing 'RBP Compatible: Yes' header)");
  }

  logger.section("RBP Spec to Beads Converter");
  logger.info(`File: ${specFilePath}`);

  const specTitle = extractSpecTitle(content);
  const specId = basename(specFilePath, ".md").toLowerCase().replace(/\s+/g, "-");
  const testCommand = extractTestCommand(content);
  const description = extractDescription(content);

  logger.info(`Spec Title: ${specTitle}`);
  logger.info(`Spec ID: ${specId}`);
  logger.info(`Test Command: ${testCommand}`);

  // Extract and parse tasks
  const tasksSection = extractTasksSection(content);
  if (!tasksSection) {
    return {
      success: false,
      specTitle,
      specId,
      tasksCreated: 0,
      testCommand,
      error: "No implementation tasks found. Add RBP-TASKS markers or Implementation Tasks section.",
    };
  }

  const tasks = parseTasks(tasksSection);
  if (tasks.length === 0) {
    return {
      success: false,
      specTitle,
      specId,
      tasksCreated: 0,
      testCommand,
      error: "No tasks parsed from spec file",
    };
  }

  logger.info(`Tasks found: ${tasks.length}`);

  // Create parent bead for spec
  logger.info("Creating parent bead for spec...");
  const parentResult = await createBead(specTitle, {
    labels: ["spec", "rbp"],
    notes: description,
  });

  if (!parentResult.success || !parentResult.data) {
    return {
      success: false,
      specTitle,
      specId,
      tasksCreated: 0,
      testCommand,
      error: `Failed to create parent bead: ${parentResult.error}`,
    };
  }

  const parentBeadId = parentResult.data;
  logger.success(`Parent Bead: ${parentBeadId}`);

  // Track task ID to bead ID mapping for dependencies
  const taskToBeadMap = new Map<string, string>();
  let tasksCreated = 0;

  // Create beads for each task
  for (const task of tasks) {
    logger.info(`\n  Task ${tasksCreated + 1}: ${task.title}`);
    logger.info(`    ID: ${task.id}`);
    logger.info(`    Dependencies: ${task.dependencies}`);

    if (task.isUi) {
      logger.warn(`    UI Task: Yes (Playwright required)`);
    }

    // Build note with metadata
    const note = `Files: ${task.files || "N/A"} | Acceptance: ${task.acceptance || "N/A"} | Tests: ${task.tests || "N/A"}`;

    // Determine parent: use dependency's bead if specified
    let taskParent = parentBeadId;
    if (task.dependencies !== "none" && task.dependencies) {
      const depBead = taskToBeadMap.get(task.dependencies);
      if (depBead) {
        taskParent = depBead;
        logger.info(`    Parent: ${depBead} (from dependency)`);
      }
    }

    // Create the task bead
    const labels = ["task"];
    if (task.isUi) {
      labels.push("ui", "requires-playwright");
    }

    const beadResult = await createBead(task.title, {
      parent: taskParent,
      labels,
      notes: note,
    });

    if (beadResult.success && beadResult.data) {
      taskToBeadMap.set(task.id, beadResult.data);
      logger.success(`    Created: ${beadResult.data}`);
      tasksCreated++;

      // Create subtasks if any
      if (task.subtasks.length > 0) {
        logger.info(`    Creating ${task.subtasks.length} subtasks...`);
        let prevSubtaskId: string | undefined;

        for (let i = 0; i < task.subtasks.length; i++) {
          const subtaskTitle = task.subtasks[i];
          const subtaskResult = await createBead(subtaskTitle, {
            parent: beadResult.data,
            labels: ["subtask"],
            depends: prevSubtaskId,
          });

          if (subtaskResult.success && subtaskResult.data) {
            logger.success(`      Subtask ${i + 1}: ${subtaskResult.data}`);
            prevSubtaskId = subtaskResult.data;
          } else {
            logger.error(`      Failed to create subtask ${i + 1}`);
          }
        }
      }
    } else {
      logger.error(`    Failed to create bead: ${beadResult.error}`);
    }
  }

  // Save test command to config file
  const configDir = join(dirname(specFilePath), "..", ".rbp");
  try {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "test-command"), testCommand);
    writeFileSync(join(configDir, "current-spec-bead"), parentBeadId);
  } catch {
    // Ignore config save errors
  }

  // Sync beads to git
  logger.info("\nSyncing beads to git...");
  const syncResult = await syncBeads();
  if (syncResult.success) {
    logger.success("Beads synced");
  } else {
    logger.warn("Sync skipped (may need git repo)");
  }

  // Summary
  logger.section("Conversion Complete");
  logger.info(`Spec Bead: ${parentBeadId}`);
  logger.info(`Tasks Created: ${tasksCreated}`);
  logger.info(`Test Command: ${testCommand}`);
  logger.info("");
  logger.info(`View structure: bd tree ${parentBeadId}`);
  logger.info(`View ready tasks: bd ready`);
  logger.info(`Start execution: ralph run`);

  return {
    success: true,
    specTitle,
    specId,
    parentBeadId,
    tasksCreated,
    testCommand,
  };
}
