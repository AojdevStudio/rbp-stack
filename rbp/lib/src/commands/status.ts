import { Command } from "commander";
import { getConfig, getGlobalOptions } from "../cli";
import { listBeads, checkBeadsInstalled } from "../integrations/beads-cli";
import { loadSprintStatus, detectEpicFromBranch } from "../workflows/bmad";
import { logger } from "../observability/logger";
import { colors } from "../utils/colors";
import { existsSync } from "fs";

export async function statusCommand(): Promise<void> {
  const globalOptions = getGlobalOptions();
  const config = getConfig(globalOptions);

  logger.banner("Ralph Status", "RBP Stack v3.0");

  const beadsInstalled = await checkBeadsInstalled();
  const sprintStatusPath = `${process.cwd()}/docs/bmm/sprint-status.yaml`;
  const sprintStatusExists = existsSync(sprintStatusPath);

  console.log(`\n${colors.bold("Environment:")}`);
  console.log(`  Beads CLI: ${beadsInstalled ? colors.green("installed") : colors.red("not installed")}`);
  console.log(`  Sprint Status: ${sprintStatusExists ? colors.green("found") : colors.gray("not found")}`);

  const epic = detectEpicFromBranch();
  if (epic) {
    console.log(`  Detected Epic: ${colors.cyan(epic)}`);
  }

  console.log(`\n${colors.bold("Configuration:")}`);
  console.log(`  Project: ${config.project.name}`);
  console.log(`  Max Iterations: ${config.execution.max_iterations}`);
  console.log(`  Test Command: ${config.verification.test_command}`);

  if (beadsInstalled) {
    console.log(`\n${colors.bold("Beads Status:")}`);

    const openResult = await listBeads({ status: "open" });
    const inProgressResult = await listBeads({ status: "in_progress" });

    if (openResult.success && inProgressResult.success) {
      const open = openResult.data ?? [];
      const inProgress = inProgressResult.data ?? [];

      console.log(`  Open: ${open.length}`);
      console.log(`  In Progress: ${inProgress.length}`);

      if (inProgress.length > 0) {
        console.log(`\n${colors.bold("Current Work:")}`);
        for (const bead of inProgress) {
          console.log(`  ${colors.yellow("→")} ${bead.id}: ${bead.title}`);
        }
      }
    }
  }

  if (sprintStatusExists) {
    const status = loadSprintStatus(sprintStatusPath);
    if (status) {
      console.log(`\n${colors.bold("BMAD Sprint Status:")}`);
      console.log(`  Epic: ${status.epic ?? "not set"}`);
      console.log(`  Stories: ${status.stories.length}`);

      const byStatus = new Map<string, number>();
      for (const story of status.stories) {
        byStatus.set(story.status, (byStatus.get(story.status) ?? 0) + 1);
      }

      for (const [s, count] of byStatus) {
        console.log(`    ${s}: ${count}`);
      }
    }
  }

  console.log("");
}

export const statusCommandDef = new Command("status")
  .description("Show current execution state")
  .action(statusCommand);
