/**
 * Execution Sequencer
 * Ported from sequencer.sh
 *
 * Groups subtasks into phases for more manageable execution.
 * Each phase contains N subtasks that can be executed together.
 * This prevents context overflow on large stories while maintaining coherence.
 */

import { logger } from "../observability/logger";
import { getBeadChildren, type Bead } from "../integrations/beads-cli";

export interface Phase {
  number: number;
  beads: Bead[];
}

export interface SequencerResult {
  success: boolean;
  storyId: string;
  totalSubtasks: number;
  totalPhases: number;
  phases: Phase[];
  readySubtasks: Bead[];
  error?: string;
}

/**
 * Organize subtasks into phases
 */
export async function sequenceStory(storyId: string, phaseSize: number = 5): Promise<SequencerResult> {
  logger.section("RBP Execution Sequencer");
  logger.info(`Story: ${storyId}`);
  logger.info(`Phase Size: ${phaseSize} subtasks`);

  // Get all subtasks for this story
  logger.info("\nFetching subtasks for story...");
  const childrenResult = await getBeadChildren(storyId);

  if (!childrenResult.success || !childrenResult.data) {
    return {
      success: false,
      storyId,
      totalSubtasks: 0,
      totalPhases: 0,
      phases: [],
      readySubtasks: [],
      error: `Failed to get subtasks: ${childrenResult.error?.message}`,
    };
  }

  const subtasks = childrenResult.data;

  if (subtasks.length === 0) {
    return {
      success: false,
      storyId,
      totalSubtasks: 0,
      totalPhases: 0,
      phases: [],
      readySubtasks: [],
      error: `No subtasks found for story ${storyId}`,
    };
  }

  logger.info(`Found ${subtasks.length} subtasks`);

  // Calculate phases
  const totalPhases = Math.ceil(subtasks.length / phaseSize);
  logger.info(`Organizing into ${totalPhases} phases`);

  // Group subtasks into phases
  const phases: Phase[] = [];
  for (let i = 0; i < subtasks.length; i += phaseSize) {
    phases.push({
      number: Math.floor(i / phaseSize) + 1,
      beads: subtasks.slice(i, i + phaseSize),
    });
  }

  // Display phase organization
  logger.info("\n--- Phase Organization ---\n");
  for (const phase of phases) {
    logger.info(`Phase ${phase.number}:`);
    for (const bead of phase.beads) {
      logger.info(`  - ${bead.id}: ${bead.title}`);
    }
    logger.info("");
  }

  // Find ready subtasks (open/not blocked)
  const readySubtasks = subtasks.filter(
    (b) => b.status === "open" || b.status === "in_progress"
  );

  logger.section("Ready subtasks (in execution order)");

  if (readySubtasks.length === 0) {
    logger.success("No subtasks ready - all may be complete or blocked");
  } else {
    const firstPhaseReady = readySubtasks.slice(0, phaseSize);
    for (const bead of firstPhaseReady) {
      logger.info(`  ${bead.id}: ${bead.title}`);
    }

    if (readySubtasks.length > phaseSize) {
      logger.info(`\n  ... and ${readySubtasks.length - phaseSize} more in subsequent phases`);
    }
  }

  logger.section("Recommendation");
  logger.info("Execute one phase at a time. After completing phase 1,");
  logger.info("run 'bd ready' to see the next batch of available tasks.");

  return {
    success: true,
    storyId,
    totalSubtasks: subtasks.length,
    totalPhases,
    phases,
    readySubtasks,
  };
}

/**
 * Get the current phase for a story based on completed tasks
 */
export async function getCurrentPhase(storyId: string, phaseSize: number = 5): Promise<{
  currentPhase: number;
  completedInPhase: number;
  remainingInPhase: number;
}> {
  const childrenResult = await getBeadChildren(storyId);

  if (!childrenResult.success || !childrenResult.data) {
    return { currentPhase: 1, completedInPhase: 0, remainingInPhase: phaseSize };
  }

  const subtasks = childrenResult.data;
  const completed = subtasks.filter((b) => b.status === "closed").length;

  const currentPhase = Math.floor(completed / phaseSize) + 1;
  const completedInPhase = completed % phaseSize;
  const remainingInPhase = phaseSize - completedInPhase;

  return { currentPhase, completedInPhase, remainingInPhase };
}
