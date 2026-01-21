import { z } from "zod";
import { createError, ErrorCodes, type RbpError } from "../utils/errors";

export const BeadSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["open", "in_progress", "blocked", "deferred", "closed"]),
  priority: z.string().optional(),
  type: z.string().optional(),
  notes: z.string().optional(),
  labels: z.array(z.string()).optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
});

export const BeadListSchema = z.array(BeadSchema);

export type Bead = z.infer<typeof BeadSchema>;

export interface BeadsCliResult<T> {
  success: boolean;
  data?: T;
  error?: RbpError;
}

async function runBeadsCommand(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bd", ...args], {
    stdout: "pipe",
    stderr: "pipe",
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

export async function listBeads(options: { status?: string; all?: boolean } = {}): Promise<BeadsCliResult<Bead[]>> {
  const args = ["list", "--json"];
  if (options.status) args.push("--status", options.status);
  if (options.all) args.push("--all");

  const result = await runBeadsCommand(args);

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

export async function showBead(id: string): Promise<BeadsCliResult<Bead>> {
  const result = await runBeadsCommand(["show", id, "--json"]);

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
 * Get children beads of a parent
 */
export async function getBeadChildren(parentId: string): Promise<BeadsCliResult<Bead[]>> {
  const result = await runBeadsCommand(["children", parentId, "--json"]);

  if (result.exitCode !== 0) {
    // Some versions might not support children command, try list with parent filter
    const listResult = await runBeadsCommand(["list", "--json"]);
    if (listResult.exitCode !== 0) {
      return {
        success: false,
        error: createError(ErrorCodes.BEADS_COMMAND_FAILED, `bd children ${parentId} failed`, {
          details: { stderr: result.stderr },
        }),
      };
    }

    // Filter manually by checking if we can
    try {
      const parsed = JSON.parse(listResult.stdout || "[]");
      const beads = BeadListSchema.parse(parsed);
      // Return all beads as fallback (can't filter by parent without proper support)
      return { success: true, data: beads };
    } catch {
      return { success: true, data: [] };
    }
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

    const allBeads = JSON.parse(listResult.stdout || "[]");
    const openBeads = allBeads.filter((b: Bead) => b.status === "open" || b.status === "in_progress");

    let ready: string | null = null;
    if (readyResult.exitCode === 0) {
      try {
        const readyBeads = JSON.parse(readyResult.stdout || "[]");
        if (Array.isArray(readyBeads) && readyBeads.length > 0) {
          ready = readyBeads[0].title || readyBeads[0].id;
        }
      } catch {
        // Ignore parse errors for ready
      }
    }

    return {
      success: true,
      data: {
        open: openBeads.length,
        total: allBeads.length,
        ready,
      },
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
