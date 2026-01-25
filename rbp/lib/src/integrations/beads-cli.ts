import { z } from "zod";
import { createError, ErrorCodes, type RbpError } from "../utils/errors";
import { findProjectRoot } from "../utils/project-detector";

export const BeadSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["open", "in_progress", "blocked", "deferred", "closed"]),
  priority: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  issue_type: z.string().optional(),
  notes: z.string().optional(),
  labels: z.array(z.string()).optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
  // Extended fields for RBP InjectionContract
  description: z.string().optional(),
  acceptance_criteria: z.array(z.string()).optional(),
  estimated_size: z.enum(["small", "medium", "needs-decomposition"]).optional(),
  parent_id: z.string().optional(),
});

export const BeadListSchema = z.array(BeadSchema);

export type Bead = z.infer<typeof BeadSchema>;

export interface BeadsCliResult<T> {
  success: boolean;
  data?: T;
  error?: RbpError;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Parse ready bead output from bd CLI
 * @param result - Command result from bd ready --json
 * @returns Parsed result with first ready bead or null
 */
export function parseReadyBeadOutput(result: CommandResult): BeadsCliResult<Bead | null> {
  if (result.exitCode !== 0) {
    if (result.stderr.includes("No open issues") || result.stdout.includes("No open issues")) {
      return { success: true, data: null };
    }
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_COMMAND_FAILED, "bd ready failed", {
        details: { stderr: result.stderr },
        suggestion: "Run 'bd status' to check the beads state",
      }),
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const beads = BeadListSchema.parse(Array.isArray(parsed) ? parsed : [parsed]);
    return { success: true, data: beads[0] ?? null };
  } catch (e) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_PARSE_ERROR, "Failed to parse bd ready output", {
        details: { output: result.stdout, parseError: String(e) },
        suggestion: "The bd command may have returned invalid JSON",
      }),
    };
  }
}

/**
 * Parse list beads output from bd CLI
 * @param result - Command result from bd list --json
 * @returns Parsed result with list of beads
 */
export function parseListBeadsOutput(result: CommandResult): BeadsCliResult<Bead[]> {
  if (result.exitCode !== 0) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_COMMAND_FAILED, "bd list failed", {
        details: { stderr: result.stderr },
      }),
    };
  }

  try {
    const parsed = JSON.parse(result.stdout || "[]");
    const beads = BeadListSchema.parse(parsed);
    return { success: true, data: beads };
  } catch (e) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_PARSE_ERROR, "Failed to parse bd list output", {
        details: { output: result.stdout, parseError: String(e) },
      }),
    };
  }
}

/**
 * Parse show bead output from bd CLI
 * @param result - Command result from bd show --json
 * @param id - Bead ID for error context
 * @returns Parsed result with single bead
 */
export function parseShowBeadOutput(result: CommandResult, id: string): BeadsCliResult<Bead> {
  if (result.exitCode !== 0) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_COMMAND_FAILED, `bd show ${id} failed`, {
        details: { stderr: result.stderr },
      }),
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const bead = BeadSchema.parse(parsed);
    return { success: true, data: bead };
  } catch (e) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_PARSE_ERROR, "Failed to parse bd show output", {
        details: { output: result.stdout, parseError: String(e) },
      }),
    };
  }
}

/**
 * Parse children beads output from bd CLI
 * @param result - Command result from bd dep list --direction=up --type parent-child --json
 * @param parentId - Parent bead ID for error context
 * @returns Parsed result with list of child beads
 */
export function parseChildrenOutput(result: CommandResult, parentId: string): BeadsCliResult<Bead[]> {
  if (result.exitCode !== 0) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_COMMAND_FAILED, `bd dep list ${parentId} --direction=up --type parent-child failed`, {
        details: { stderr: result.stderr },
      }),
    };
  }

  try {
    const parsed = JSON.parse(result.stdout || "[]");
    const beads = BeadListSchema.parse(Array.isArray(parsed) ? parsed : []);
    return { success: true, data: beads };
  } catch (e) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_PARSE_ERROR, "Failed to parse bd children output", {
        details: { output: result.stdout, parseError: String(e) },
      }),
    };
  }
}

/**
 * Build arguments for create bead command
 * @param title - Bead title
 * @param options - Create options
 * @returns Array of command arguments
 */
export function buildCreateBeadArgs(title: string, options: CreateBeadOptions = {}): string[] {
  const args = ["create", title];

  if (options.parent) {
    args.push("--parent", options.parent);
  }

  if (options.labels) {
    for (const label of options.labels) {
      args.push("-l", label);
    }
  }

  if (options.notes) {
    args.push("--notes", options.notes);
  }

  if (options.depends) {
    args.push("--depends", options.depends);
  }

  args.push("--silent");
  return args;
}

/**
 * Calculate beads status summary from list and ready results
 * @param listOutput - Parsed list of all beads
 * @param readyOutput - Stdout from bd ready command
 * @returns Status summary with open count, total count, and ready task
 */
export function calculateBeadsStatus(
  listOutput: Bead[],
  readyOutput: string
): { open: number; total: number; ready: string | null } {
  const openBeads = listOutput.filter((b) => b.status === "open" || b.status === "in_progress");

  let ready: string | null = null;
  try {
    const readyBeads = JSON.parse(readyOutput || "[]");
    if (Array.isArray(readyBeads) && readyBeads.length > 0) {
      ready = readyBeads[0].title || readyBeads[0].id;
    }
  } catch {
    // Ignore parse errors for ready
  }

  return {
    open: openBeads.length,
    total: listOutput.length,
    ready,
  };
}

async function runBeadsCommand(args: string[], cwd?: string): Promise<CommandResult> {
  const workingDir = cwd ?? findProjectRoot();
  const proc = Bun.spawn(["bd", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: workingDir,
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

export async function checkBeadsInstalled(): Promise<boolean> {
  try {
    const result = await runBeadsCommand(["--version"]);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function getReadyBead(): Promise<BeadsCliResult<Bead | null>> {
  const result = await runBeadsCommand(["ready", "--json", "-n", "1"]);
  return parseReadyBeadOutput(result);
}

export async function listBeads(options: { status?: string; all?: boolean } = {}): Promise<BeadsCliResult<Bead[]>> {
  const args = ["list", "--json"];
  if (options.status) args.push("--status", options.status);
  if (options.all) args.push("--all");

  const result = await runBeadsCommand(args);
  return parseListBeadsOutput(result);
}

export async function showBead(id: string): Promise<BeadsCliResult<Bead>> {
  const result = await runBeadsCommand(["show", id, "--json"]);
  return parseShowBeadOutput(result, id);
}

export async function updateBeadStatus(id: string, status: "open" | "in_progress" | "blocked" | "deferred" | "closed"): Promise<BeadsCliResult<void>> {
  const result = await runBeadsCommand(["update", id, "--status", status]);

  if (result.exitCode !== 0) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_COMMAND_FAILED, `bd update ${id} failed`, {
        details: { stderr: result.stderr },
      }),
    };
  }

  return { success: true };
}

export async function closeBead(id: string): Promise<BeadsCliResult<void>> {
  const result = await runBeadsCommand(["close", id]);

  if (result.exitCode !== 0) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_COMMAND_FAILED, `bd close ${id} failed`, {
        details: { stderr: result.stderr },
      }),
    };
  }

  return { success: true };
}

export async function addBeadNote(id: string, note: string): Promise<BeadsCliResult<void>> {
  const result = await runBeadsCommand(["update", id, "--notes", note]);

  if (result.exitCode !== 0) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_COMMAND_FAILED, `bd update ${id} notes failed`, {
        details: { stderr: result.stderr },
      }),
    };
  }

  return { success: true };
}

export async function syncBeads(): Promise<BeadsCliResult<void>> {
  const result = await runBeadsCommand(["sync"]);

  if (result.exitCode !== 0) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_COMMAND_FAILED, "bd sync failed", {
        details: { stderr: result.stderr },
      }),
    };
  }

  return { success: true };
}

export interface CreateBeadOptions {
  parent?: string;
  labels?: string[];
  notes?: string;
  depends?: string;
}

/**
 * Create a new bead
 * Returns the bead ID on success
 */
export async function createBead(title: string, options: CreateBeadOptions = {}): Promise<BeadsCliResult<string>> {
  const args = buildCreateBeadArgs(title, options);
  const result = await runBeadsCommand(args);

  if (result.exitCode !== 0) {
    // Try again without some options that might not be supported
    const fallbackArgs = ["create", title];
    if (options.parent) {
      fallbackArgs.push("--parent", options.parent);
    }
    fallbackArgs.push("--silent");

    const fallbackResult = await runBeadsCommand(fallbackArgs);
    if (fallbackResult.exitCode !== 0) {
      return {
        success: false,
        error: createError(ErrorCodes.BEADS_COMMAND_FAILED, `bd create "${title}" failed`, {
          details: { stderr: result.stderr || fallbackResult.stderr },
        }),
      };
    }

    return { success: true, data: fallbackResult.stdout.trim() };
  }

  return { success: true, data: result.stdout.trim() };
}

/**
 * Get children beads of a parent using bd dep list with parent-child type
 */
export async function getBeadChildren(parentId: string): Promise<BeadsCliResult<Bead[]>> {
  const result = await runBeadsCommand(["dep", "list", parentId, "--direction=up", "--type", "parent-child", "--json"]);

  return parseChildrenOutput(result, parentId);
}

/**
 * Get beads status summary
 */
export async function getBeadsStatus(): Promise<BeadsCliResult<{ open: number; total: number; ready: string | null }>> {
  try {
    const listResult = await runBeadsCommand(["list", "--json"]);
    const readyResult = await runBeadsCommand(["ready", "--json", "-n", "1"]);

    if (listResult.exitCode !== 0) {
      return {
        success: false,
        error: createError(ErrorCodes.BEADS_COMMAND_FAILED, "bd list failed", {
          details: { stderr: listResult.stderr },
        }),
      };
    }

    const allBeads = BeadListSchema.parse(JSON.parse(listResult.stdout || "[]"));
    const statusData = calculateBeadsStatus(allBeads, readyResult.stdout);

    return {
      success: true,
      data: statusData,
    };
  } catch (e) {
    return {
      success: false,
      error: createError(ErrorCodes.BEADS_COMMAND_FAILED, "Failed to get beads status", {
        details: { error: String(e) },
      }),
    };
  }
}
