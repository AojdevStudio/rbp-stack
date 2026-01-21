/**
 * BMAD Story Generator
 * Ported from create-story-autonomous.sh
 *
 * Non-interactive BMAD story generator for autonomous workflows.
 * Creates story files based on sprint-status.yaml and epic tech-specs.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { parse as parseYaml } from "yaml";
import { logger } from "../observability/logger";
import { invokeClaude } from "../integrations/claude-cli";
import { findProjectRoot, getCurrentBranch, extractEpicFromBranch, findSprintStatusPath } from "../utils/project-detector";

export interface BmadConfig {
  bmadRoot: string;
  epicsDir: string;
  epicPattern: string;
  storiesDir: string;
  archDir: string;
  sprintStatusPath?: string;
}

export interface StoryContext {
  epicNum: string;
  storyNum: string;
  storyKey: string;
  storySlug?: string;
  title: string;
  role: string;
  capability: string;
  benefit: string;
  acceptanceCriteria: string;
  tasks: string;
  archContext?: string;
}

export interface StoryGeneratorResult {
  success: boolean;
  storyFilePath?: string;
  epicNum?: string;
  storyNum?: string;
  error?: string;
  exitCode?: number;
}

/**
 * Load BMAD configuration from rbp-config.yaml or auto-detect
 */
export function loadBmadConfig(projectRoot: string): BmadConfig | null {
  const configPath = join(projectRoot, "rbp-config.yaml");

  // Try to read from rbp-config.yaml first
  if (existsSync(configPath)) {
    try {
      const configContent = readFileSync(configPath, "utf-8");
      const config = parseYaml(configContent);

      if (config?.bmad?.epics_dir && existsSync(join(projectRoot, config.bmad.epics_dir))) {
        logger.info("Using paths from rbp-config.yaml");
        const epicsDir = join(projectRoot, config.bmad.epics_dir);
        const bmadRoot = dirname(epicsDir);

        return {
          bmadRoot,
          epicsDir,
          epicPattern: config.bmad.epic_pattern || "epic",
          storiesDir: config.bmad.stories_dir
            ? join(projectRoot, config.bmad.stories_dir)
            : join(bmadRoot, "implementation-artifacts", "stories"),
          archDir: config.bmad.arch_dir ? join(projectRoot, config.bmad.arch_dir) : join(bmadRoot, "architecture"),
          sprintStatusPath: findSprintStatusPath(projectRoot),
        };
      }
    } catch {
      // Fall through to auto-detection
    }
  }

  // Auto-detect BMAD paths
  logger.info("Auto-detecting BMAD paths...");

  const possibleRoots = ["_bmad", "docs/bmm", "docs/bmad"];

  for (const root of possibleRoots) {
    const rootPath = join(projectRoot, root);
    if (!existsSync(rootPath)) continue;

    // Check for tech-specs
    const techSpecsPath = join(rootPath, "tech-specs");
    if (existsSync(techSpecsPath)) {
      const files = readdirSync(techSpecsPath);
      if (files.some((f) => f.match(/tech-spec-epic.*\.md/))) {
        return {
          bmadRoot: rootPath,
          epicsDir: techSpecsPath,
          epicPattern: "tech-spec-epic",
          storiesDir: join(rootPath, "implementation-artifacts", "stories"),
          archDir: join(rootPath, "architecture"),
          sprintStatusPath: findSprintStatusPath(projectRoot),
        };
      }
    }

    // Check for epics directory
    const epicsPath = join(rootPath, "epics");
    if (existsSync(epicsPath)) {
      const files = readdirSync(epicsPath);
      if (files.some((f) => f.match(/epic-.*\.md/))) {
        return {
          bmadRoot: rootPath,
          epicsDir: epicsPath,
          epicPattern: "epic",
          storiesDir: join(rootPath, "implementation-artifacts", "stories"),
          archDir: join(rootPath, "architecture"),
          sprintStatusPath: findSprintStatusPath(projectRoot),
        };
      }
    }

    // Check root level
    const rootFiles = readdirSync(rootPath);
    if (rootFiles.some((f) => f.match(/epic-.*\.md/))) {
      return {
        bmadRoot: rootPath,
        epicsDir: rootPath,
        epicPattern: "epic",
        storiesDir: join(rootPath, "implementation-artifacts", "stories"),
        archDir: join(rootPath, "architecture"),
        sprintStatusPath: findSprintStatusPath(projectRoot),
      };
    }
  }

  // Fallback: use first existing directory
  for (const root of possibleRoots) {
    const rootPath = join(projectRoot, root);
    if (existsSync(rootPath)) {
      return {
        bmadRoot: rootPath,
        epicsDir: rootPath,
        epicPattern: "epic",
        storiesDir: join(rootPath, "implementation-artifacts", "stories"),
        archDir: join(rootPath, "architecture"),
        sprintStatusPath: findSprintStatusPath(projectRoot),
      };
    }
  }

  return null;
}

/**
 * Find next backlog story from sprint-status.yaml
 */
function findNextBacklogStory(sprintStatusPath: string, epicNum: string): { key: string; slug?: string } | null {
  if (!existsSync(sprintStatusPath)) return null;

  try {
    const content = readFileSync(sprintStatusPath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      // Format: "  4-9-bulk-import-csv: backlog" or "  4-9: backlog"
      const match = line.match(new RegExp(`^\\s+(${epicNum}-\\d+[^:]*?):\\s*backlog`));
      if (match) {
        const key = match[1];
        // Extract slug: "4-9-bulk-import-csv" -> "bulk-import-csv"
        const slugMatch = key.match(new RegExp(`^${epicNum}-\\d+-(.+)$`));
        return {
          key,
          slug: slugMatch ? slugMatch[1] : undefined,
        };
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get story number from key (e.g., "4-9-bulk-import-csv" -> "9")
 */
function getStoryNumFromKey(key: string, epicNum: string): string {
  const match = key.match(new RegExp(`^${epicNum}-(\\d+)`));
  return match ? match[1] : "1";
}

/**
 * Check if epic is complete (no backlog stories)
 */
function isEpicComplete(sprintStatusPath: string, epicNum: string): boolean {
  if (!existsSync(sprintStatusPath)) return false;

  try {
    const content = readFileSync(sprintStatusPath, "utf-8");

    // Check if there are any backlog stories for this epic
    const hasBacklog = new RegExp(`^\\s+${epicNum}-\\d+[^:]*:\\s*backlog`, "m").test(content);
    if (hasBacklog) return false;

    // Check if there are ANY stories for this epic
    const hasStories = new RegExp(`^\\s+${epicNum}-\\d+`, "m").test(content);
    return hasStories; // Complete only if there ARE stories but none in backlog
  } catch {
    return false;
  }
}

/**
 * Find epic file
 */
function findEpicFile(config: BmadConfig, epicNum: string): string | null {
  const patterns = [
    join(config.epicsDir, `${config.epicPattern}-${epicNum}.md`),
    join(config.epicsDir, `${config.epicPattern}${epicNum}.md`),
    join(config.epicsDir, `epic-${epicNum}.md`),
  ];

  for (const pattern of patterns) {
    if (existsSync(pattern)) return pattern;
  }

  return null;
}

/**
 * Gather architecture context
 */
function gatherArchContext(config: BmadConfig): string {
  if (!existsSync(config.archDir)) return "";

  let context = "";
  try {
    const files = readdirSync(config.archDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const filePath = join(config.archDir, file);
      const content = readFileSync(filePath, "utf-8");
      const basename_name = file.replace(".md", "");

      // Get first 5 non-header lines
      const lines = content
        .split("\n")
        .filter((l) => !l.startsWith("#"))
        .slice(0, 5)
        .join(" ")
        .slice(0, 200);

      if (lines) {
        context += `\n- **${basename_name}**: ${lines}...`;
      }
    }
  } catch {
    // Ignore errors
  }

  return context;
}

/**
 * Generate story file content
 */
function generateStoryContent(ctx: StoryContext): string {
  return `# Story ${ctx.epicNum}.${ctx.storyNum}: ${ctx.title}

Status: Draft

## Story

As a **${ctx.role}**,
I want **${ctx.capability}**,
so that **${ctx.benefit}**.

## Acceptance Criteria

| AC# | Criteria | Verification |
|-----|----------|--------------|
${ctx.acceptanceCriteria}

## Tasks / Subtasks

### Task 1: Implementation (AC: 1)

${ctx.tasks}

## Dev Notes

### Architecture Context
${ctx.archContext || "No architecture docs found."}

### Previous Story Insights

Check previous story files in this epic for patterns and learnings.

---

*Generated by ralph story-generator*
`;
}

/**
 * Generate a BMAD story file
 */
export async function generateStory(options: {
  epicNum?: string;
  storyNum?: string;
  projectRoot?: string;
  useClaude?: boolean;
}): Promise<StoryGeneratorResult> {
  const projectRoot = options.projectRoot || findProjectRoot();

  logger.section("RBP Autonomous Story Creator (BMAD Workflow)");
  logger.info(`Project root: ${projectRoot}`);

  // Load BMAD config
  const config = loadBmadConfig(projectRoot);
  if (!config) {
    return {
      success: false,
      error: "No BMAD config found (no _bmad/, docs/bmm/, docs/bmad/)",
      exitCode: 1,
    };
  }

  logger.info(`BMAD root: ${config.bmadRoot}`);
  logger.info(`Epics dir: ${config.epicsDir}`);
  logger.info(`Stories dir: ${config.storiesDir}`);

  // Ensure stories directory exists
  mkdirSync(config.storiesDir, { recursive: true });

  // Find epic number
  let epicNum = options.epicNum;
  if (!epicNum) {
    const branch = getCurrentBranch();
    epicNum = extractEpicFromBranch(branch);

    if (!epicNum) {
      // Try to find highest epic from filesystem
      const epicFiles = readdirSync(config.epicsDir).filter((f) => f.match(new RegExp(`${config.epicPattern}.*\\d+.*\\.md`)));

      let highest = 0;
      for (const file of epicFiles) {
        const match = file.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > highest) highest = num;
        }
      }

      if (highest > 0) {
        epicNum = String(highest);
      }
    }
  }

  if (!epicNum) {
    return {
      success: false,
      error: "No epic found (check branch name or provide epic number)",
      exitCode: 2,
    };
  }

  logger.info(`Epic: ${epicNum}`);

  // Find story number and key
  let storyNum = options.storyNum;
  let storyKey: string;
  let storySlug: string | undefined;

  if (storyNum) {
    storyKey = `${epicNum}-${storyNum}`;
  } else if (config.sprintStatusPath) {
    // Use sprint-status.yaml as source of truth
    const nextStory = findNextBacklogStory(config.sprintStatusPath, epicNum);

    if (nextStory) {
      storyKey = nextStory.key;
      storyNum = getStoryNumFromKey(storyKey, epicNum);
      storySlug = nextStory.slug;
      logger.info(`Next backlog story from sprint-status: ${storyKey}`);
    } else {
      if (isEpicComplete(config.sprintStatusPath, epicNum)) {
        return {
          success: false,
          error: `Epic ${epicNum} complete (no backlog stories)`,
          exitCode: 3,
        };
      }

      return {
        success: false,
        error: `No backlog stories found for epic ${epicNum}`,
        exitCode: 3,
      };
    }
  } else {
    // Fall back to filesystem-based detection
    const existingStories = readdirSync(config.storiesDir)
      .filter((f) => f.match(new RegExp(`story-${epicNum}-\\d+`)))
      .map((f) => {
        const match = f.match(new RegExp(`story-${epicNum}-(\\d+)`));
        return match ? parseInt(match[1], 10) : 0;
      });

    const highest = existingStories.length > 0 ? Math.max(...existingStories) : 0;
    storyNum = String(highest + 1);
    storyKey = `${epicNum}-${storyNum}`;
    logger.info(`Next story (filesystem): ${storyNum}`);
  }

  logger.info(`Story: ${storyKey}`);

  // Generate story context
  const epicFile = findEpicFile(config, epicNum);
  const archContext = gatherArchContext(config);

  // Build story context
  let storyContext: StoryContext;

  if (storySlug) {
    // Generate from slug
    const titleFromSlug = storySlug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    storyContext = {
      epicNum,
      storyNum: storyNum!,
      storyKey,
      storySlug,
      title: titleFromSlug,
      role: "developer",
      capability: `implement ${storySlug.replace(/-/g, " ")}`,
      benefit: "the feature can progress toward completion",
      acceptanceCriteria: "| AC1 | Implementation complete | Tests pass |",
      tasks: `- [ ] 1.1 Review requirements from tech-spec
- [ ] 1.2 Implement functionality
- [ ] 1.3 Write tests
- [ ] 1.4 Verify acceptance criteria`,
      archContext,
    };
  } else if (epicFile) {
    // Try to parse epic file for story details
    const epicContent = readFileSync(epicFile, "utf-8");

    // Try table format first: "| 9 | 4-9 | Bulk import CSV | 4-4, 4-5 |"
    const tableMatch = epicContent.match(new RegExp(`\\|\\s*\\d+\\s*\\|\\s*${epicNum}-${storyNum}\\s*\\|([^|]+)\\|`));

    if (tableMatch) {
      const description = tableMatch[1].trim();
      storyContext = {
        epicNum,
        storyNum: storyNum!,
        storyKey,
        title: description,
        role: "developer",
        capability: `implement ${description.toLowerCase()}`,
        benefit: "the feature can progress toward completion",
        acceptanceCriteria: `| AC1 | ${description} complete | Tests pass |`,
        tasks: `- [ ] 1.1 Review requirements from tech-spec section
- [ ] 1.2 Implement functionality
- [ ] 1.3 Write tests
- [ ] 1.4 Verify acceptance criteria`,
        archContext,
      };
    } else {
      // Fallback
      storyContext = {
        epicNum,
        storyNum: storyNum!,
        storyKey,
        title: `Implementation Task ${storyNum}`,
        role: "developer",
        capability: `complete the implementation for story ${epicNum}.${storyNum}`,
        benefit: "the feature can progress toward completion",
        acceptanceCriteria: "| AC1 | Implementation complete | Tests pass |",
        tasks: `- [ ] 1.1 Review requirements
- [ ] 1.2 Implement functionality
- [ ] 1.3 Write tests
- [ ] 1.4 Verify acceptance criteria`,
        archContext,
      };
    }
  } else {
    // No epic file, minimal context
    storyContext = {
      epicNum,
      storyNum: storyNum!,
      storyKey,
      title: storySlug ? storySlug.replace(/-/g, " ") : `Task ${storyNum}`,
      role: "developer",
      capability: "complete this implementation task",
      benefit: "the feature can progress",
      acceptanceCriteria: "| AC1 | Implementation complete | Tests pass |",
      tasks: `- [ ] 1.1 Review requirements
- [ ] 1.2 Implement functionality
- [ ] 1.3 Write tests
- [ ] 1.4 Verify acceptance criteria`,
      archContext,
    };
  }

  // Generate story file
  const slug = storySlug || storyContext.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  const storyFilePath = join(config.storiesDir, `story-${epicNum}-${storyNum}-${slug}.md`);

  logger.info(`Generating: ${storyFilePath}`);

  // Option to use Claude for enhanced story generation
  if (options.useClaude) {
    logger.info("Using Claude for enhanced story generation...");

    const prompt = `Create a complete BMAD story file for:
Story ID: ${storyKey}
Epic: ${epicNum}
Story Number: ${storyNum}
Story Slug: ${storySlug || storyKey}

${epicFile ? `Tech-spec at: ${epicFile}` : "No epic file found"}
Sprint status: ${config.sprintStatusPath || "not found"}
Stories directory: ${config.storiesDir}

Generate a markdown story file with:
- Clear user story (As a... I want... so that...)
- Detailed acceptance criteria table
- Implementation tasks with checkboxes
- Architecture notes

Output ONLY the markdown content, no explanations.`;

    const result = await invokeClaude({
      prompt,
      timeout: 120000,
    });

    if (result.success && result.output) {
      writeFileSync(storyFilePath, result.output);
      logger.success("Story generated via Claude");
    } else {
      // Fall back to template generation
      const content = generateStoryContent(storyContext);
      writeFileSync(storyFilePath, content);
      logger.info("Generated story from template (Claude failed)");
    }
  } else {
    const content = generateStoryContent(storyContext);
    writeFileSync(storyFilePath, content);
    logger.success("Story generated from template");
  }

  return {
    success: true,
    storyFilePath,
    epicNum,
    storyNum,
  };
}
