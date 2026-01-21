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
