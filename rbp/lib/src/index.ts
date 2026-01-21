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

program.addCommand(runCommandDef, { isDefault: true });
program.addCommand(statusCommandDef);
program.addCommand(closeCommandDef);
program.addCommand(execSpecCommandDef);

program.parse();
