/**
 * Project detection utilities
 * Ported from start.sh - detects project type (BMAD, Beads, QuickPlan)
 */

import { existsSync } from "fs";
import { dirname, join } from "path";

export type ProjectMode = "bmad" | "beads" | "quickplan" | "unknown";

export interface ProjectContext {
  mode: ProjectMode;
  projectRoot: string;
  sprintStatusPath?: string;
  epicNumber?: string;
  beadsDir?: string;
}

/**
 * Find project root by looking for BMAD or Beads markers
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = startDir;

  while (dir !== "/" && dir !== dirname(dir)) {
    // Check for BMAD or Beads markers
    if (
      existsSync(join(dir, ".beads")) ||
      existsSync(join(dir, "docs", "bmm")) ||
      existsSync(join(dir, "_bmad")) ||
      existsSync(join(dir, "docs", "bmad")) ||
      existsSync(join(dir, ".bmad-core"))
    ) {
      return dir;
    }
    dir = dirname(dir);
  }

  return startDir;
}

/**
 * Find sprint-status.yaml file
 */
export function findSprintStatusPath(projectRoot: string): string | undefined {
  const paths = [
    join(projectRoot, "docs", "bmm", "sprint-status.yaml"),
    join(projectRoot, "docs", "bmm", "implementation-artifacts", "sprint-status.yaml"),
    join(projectRoot, "_bmad", "sprint-status.yaml"),
    join(projectRoot, "sprint-status.yaml"),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return undefined;
}

/**
 * Get current git branch
 */
export function getCurrentBranch(): string | null {
  try {
    const proc = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
    if (proc.exitCode !== 0) return null;
    return new TextDecoder().decode(proc.stdout).trim();
  } catch {
    return null;
  }
}

/**
 * Extract epic number from branch name
 */
export function extractEpicFromBranch(branch: string | null): string | undefined {
  if (!branch) return undefined;

  const epicMatch = branch.match(/^epic[/-]?(\d+)/i);
  if (epicMatch) return epicMatch[1];

  return undefined;
}

/**
 * Check if beads has ready tasks
 */
export async function hasBeadsTasks(): Promise<boolean> {
  try {
    const proc = Bun.spawnSync(["bd", "ready", "--json", "--limit", "1"]);
    if (proc.exitCode !== 0) return false;

    const output = new TextDecoder().decode(proc.stdout).trim();
    return output !== "[]" && output.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if quick-plan specs exist
 */
export function hasQuickPlanSpecs(projectRoot: string): boolean {
  const specsDir = join(projectRoot, "specs");
  if (!existsSync(specsDir)) return false;

  try {
    const proc = Bun.spawnSync(["sh", "-c", `ls "${specsDir}"/*.md 2>/dev/null | xargs grep -l "RBP-TASKS-START" 2>/dev/null | head -1`]);
    const output = new TextDecoder().decode(proc.stdout).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

/**
 * Find the first actionable quick-plan spec
 */
export function findQuickPlanSpec(projectRoot: string): string | null {
  const specsDir = join(projectRoot, "specs");
  if (!existsSync(specsDir)) return null;

  try {
    const proc = Bun.spawnSync(["sh", "-c", `ls "${specsDir}"/*.md 2>/dev/null | xargs grep -l "RBP-TASKS-START" 2>/dev/null | head -1`]);
    const output = new TextDecoder().decode(proc.stdout).trim();
    return output || null;
  } catch {
    return null;
  }
}

/**
 * Detect project mode and gather context
 */
export async function detectProjectContext(startDir?: string): Promise<ProjectContext> {
  const projectRoot = findProjectRoot(startDir);
  const branch = getCurrentBranch();
  const epicNumber = extractEpicFromBranch(branch);
  const sprintStatusPath = findSprintStatusPath(projectRoot);

  // Check for BMAD: sprint-status.yaml + epic-N branch
  if (sprintStatusPath && epicNumber) {
    return {
      mode: "bmad",
      projectRoot,
      sprintStatusPath,
      epicNumber,
    };
  }

  // Check for Beads
  const beadsDir = join(projectRoot, ".beads");
  if (existsSync(beadsDir)) {
    return {
      mode: "beads",
      projectRoot,
      beadsDir,
    };
  }

  // Check for quick-plan specs
  if (hasQuickPlanSpecs(projectRoot)) {
    return {
      mode: "quickplan",
      projectRoot,
    };
  }

  return {
    mode: "unknown",
    projectRoot,
  };
}

/**
 * Check prerequisites for a given mode
 */
export function checkPrerequisites(mode: ProjectMode): { ok: boolean; missing: string[] } {
  const missing: string[] = [];

  // Check claude CLI
  const claudeCheck = Bun.spawnSync(["which", "claude"]);
  if (claudeCheck.exitCode !== 0) missing.push("claude");

  // Check bun
  const bunCheck = Bun.spawnSync(["which", "bun"]);
  if (bunCheck.exitCode !== 0) missing.push("bun");

  // Check bd for beads/quickplan modes
  if (mode === "beads" || mode === "quickplan") {
    const bdCheck = Bun.spawnSync(["which", "bd"]);
    if (bdCheck.exitCode !== 0) missing.push("bd");
  }

  return { ok: missing.length === 0, missing };
}
