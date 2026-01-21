#!/usr/bin/env bun
/**
 * Ralph - RBP Autonomous Execution Loop
 * TypeScript implementation of the RBP execution engine
 */

import { program } from "./cli";
import { runCommandDef, runCommand } from "./commands/run";
import { statusCommandDef } from "./commands/status";
import { closeCommandDef } from "./commands/close";
import { execSpecCommandDef } from "./commands/exec-spec";
import { parseSpecCommandDef } from "./commands/parse-spec";
import { parseStoryCommandDef } from "./commands/parse-story";
import { generateStoryCommandDef } from "./commands/generate-story";
import { sequencerCommandDef } from "./commands/sequencer";
import { hooksCommandDef } from "./commands/hooks";
import { startCommandDef } from "./commands/start";

// Register all commands
program.addCommand(runCommandDef, { isDefault: true });
program.addCommand(startCommandDef);
program.addCommand(statusCommandDef);
program.addCommand(closeCommandDef);
program.addCommand(execSpecCommandDef);
program.addCommand(parseSpecCommandDef);
program.addCommand(parseStoryCommandDef);
program.addCommand(generateStoryCommandDef);
program.addCommand(sequencerCommandDef);
program.addCommand(hooksCommandDef);

program.parse();

// Export modules for programmatic use
export { runSessionStartHook, runPreCompactHook } from "./hooks";
export { parseSpecToBeads, parseStoryToBeads, generateStory, sequenceStory } from "./parsers";
export { detectProjectContext, findProjectRoot, checkPrerequisites } from "./utils/project-detector";
