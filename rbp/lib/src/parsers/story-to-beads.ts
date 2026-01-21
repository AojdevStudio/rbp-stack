/**
 * Story to Beads Parser
 * Ported from parse-story-to-beads.sh
 *
 * Parses a BMAD story markdown file and creates corresponding beads:
 * 1. Parent bead for the story itself
 * 2. Child beads for each subtask/acceptance criterion
 * 3. Auto-detects UI tasks and sets requires_playwright flag
 */

import { readFileSync, existsSync } from "fs";
import { basename } from "path";
import { logger } from "../observability/logger";
import { createBead, syncBeads, getBeadChildren } from "../integrations/beads-cli";

// UI detection keywords
const UI_KEYWORDS = /UI|component|visual|browser|render|display|click|button|form|modal|sidebar|header|page|screen|responsive|mobile|desktop|layout|style|CSS|frontend/i;

export interface StoryParseResult {
  success: boolean;
  storyTitle: string;
  storyId: string;
  parentBeadId?: string;
  subtasksCreated: number;
  isUiStory: boolean;
  error?: string;
}

/**
 * Extract story title from markdown (first H1)
 */
function extractStoryTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : "Untitled Story";
}

/**
 * Extract story ID from filename
 */
function extractStoryId(filePath: string): string {
  const filename = basename(filePath, ".md");
  const idMatch = filename.match(/^story-[\d-]+/);
  if (idMatch) return idMatch[0];

  // Generate timestamp-based ID
  return `story-${Date.now()}`;
}

/**
 * Extract description (content after title, before first ##)
 */
function extractDescription(content: string): string {
  const match = content.match(/^#[^#].+?\n([\s\S]*?)(?=\n##|$)/);
  if (match) {
    return match[1]
      .replace(/^#.*$/gm, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 500);
  }
  return "";
}

/**
 * Detect if this is a UI story based on content
 */
function detectUiStory(content: string): boolean {
  // Look for UI keywords in acceptance criteria or tasks
  const relevantSections = content.match(/(acceptance|criteria|AC|task|subtask)[\s\S]*?(?=\n##|$)/gi);
  if (!relevantSections) return false;

  return relevantSections.some((section) => UI_KEYWORDS.test(section));
}

/**
 * Extract subtasks from story content
 */
function extractSubtasks(content: string): string[] {
  const subtasks: string[] = [];

  // Try checkbox format first: - [ ] or - [x]
  const checkboxMatches = content.matchAll(/^\s*-\s*\[[ x]\]\s*(.+)$/gm);
  for (const match of checkboxMatches) {
    subtasks.push(match[1].trim());
  }

  if (subtasks.length > 0) return subtasks;

  // Try to extract from Tasks, Acceptance Criteria, or Subtasks sections
  const sectionMatch = content.match(/(Tasks|Acceptance Criteria|Subtasks)\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (sectionMatch) {
    const section = sectionMatch[2];
    // Match bullet points or numbered lists
    const listMatches = section.matchAll(/^\s*[-*\d.]+\s*(.+)$/gm);
    for (const match of listMatches) {
      const item = match[1].trim();
      if (item && !item.startsWith("#")) {
        subtasks.push(item);
      }
    }
  }

  return subtasks;
}

/**
 * Parse a BMAD story file and create beads
 */
export async function parseStoryToBeads(storyFilePath: string): Promise<StoryParseResult> {
  if (!existsSync(storyFilePath)) {
    return {
      success: false,
      storyTitle: "",
      storyId: "",
      subtasksCreated: 0,
      isUiStory: false,
      error: `File not found: ${storyFilePath}`,
    };
  }

  const content = readFileSync(storyFilePath, "utf-8");

  logger.section("RBP Story to Beads Converter");
  logger.info(`File: ${storyFilePath}`);

  const storyTitle = extractStoryTitle(content);
  const storyId = extractStoryId(storyFilePath);
  const description = extractDescription(content);
  const isUiStory = detectUiStory(content);

  logger.info(`Story Title: ${storyTitle}`);
  logger.info(`Story ID: ${storyId}`);
  logger.info(`UI Story: ${isUiStory}`);

  if (isUiStory) {
    logger.warn("Playwright tests will be required for closure");
  }

  // Create parent bead for story
  logger.info("\nCreating parent bead for story...");

  const labels = ["story"];
  if (isUiStory) {
    labels.push("ui", "requires-playwright");
  }

  const parentResult = await createBead(storyTitle, {
    labels,
    notes: description,
  });

  if (!parentResult.success || !parentResult.data) {
    return {
      success: false,
      storyTitle,
      storyId,
      subtasksCreated: 0,
      isUiStory,
      error: `Failed to create parent bead: ${parentResult.error}`,
    };
  }

  const parentBeadId = parentResult.data;
  logger.success(`Parent Bead: ${parentBeadId}`);

  // Extract and create subtasks
  const subtasks = extractSubtasks(content);

  if (subtasks.length === 0) {
    logger.warn("No subtasks found in story file");
    logger.info(`The story bead was created. Add subtasks manually with:`);
    logger.info(`  bd create "<subtask>" --parent ${parentBeadId}`);

    // Sync even with no subtasks
    logger.info("\nSyncing beads to git...");
    const syncResult = await syncBeads();
    if (syncResult.success) {
      logger.success("Beads synced");
    } else {
      logger.warn("Sync skipped (may need git repo)");
    }

    return {
      success: true,
      storyTitle,
      storyId,
      parentBeadId,
      subtasksCreated: 0,
      isUiStory,
    };
  }

  logger.info(`\nParsing ${subtasks.length} subtasks...`);

  let subtasksCreated = 0;

  for (const subtask of subtasks) {
    // Detect if this specific subtask is UI-related
    const subtaskIsUi = UI_KEYWORDS.test(subtask);

    logger.info(`  Creating: ${subtask}`);

    const subtaskLabels = subtaskIsUi ? ["subtask", "ui", "requires-playwright"] : ["subtask"];

    const subtaskResult = await createBead(subtask, {
      parent: parentBeadId,
      labels: subtaskLabels,
    });

    if (subtaskResult.success) {
      subtasksCreated++;
    } else {
      logger.error(`    Failed to create bead: ${subtaskResult.error}`);
    }
  }

  // Sync beads to git
  logger.info("\nSyncing beads to git...");
  const syncResult = await syncBeads();
  if (syncResult.success) {
    logger.success("Beads synced");
  } else {
    logger.warn("Sync skipped (may need git repo)");
  }

  // Get actual count of created children
  const childrenResult = await getBeadChildren(parentBeadId);
  const actualCount = childrenResult.success && childrenResult.data ? childrenResult.data.length : subtasksCreated;

  // Summary
  logger.section("Conversion Complete");
  logger.info(`Story Bead: ${parentBeadId}`);
  logger.info(`Subtasks Created: ${actualCount}`);
  logger.info(`UI Story: ${isUiStory}`);
  logger.info("");
  logger.info(`View structure: bd tree ${parentBeadId}`);
  logger.info(`Start execution: ralph run`);

  return {
    success: true,
    storyTitle,
    storyId,
    parentBeadId,
    subtasksCreated: actualCount,
    isUiStory,
  };
}
