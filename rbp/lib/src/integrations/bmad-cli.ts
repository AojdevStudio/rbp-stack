import { logger } from "../observability/logger";
import { createError, ErrorCodes, type RbpError } from "../utils/errors";

export interface BmadInvokeResult {
  success: boolean;
  output?: string;
  error?: RbpError;
}

export interface BmadCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface BmadSlashCommandOptions {
  timeout?: number;
  workingDir?: string;
  env?: Record<string, string>;
}

async function runClaudeCommand(args: string[], options: BmadSlashCommandOptions = {}): Promise<BmadCommandResult> {
  const { timeout = 300000, workingDir, env } = options;

  const proc = Bun.spawn(["claude", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: workingDir,
    env: { ...process.env, ...env },
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
  });

  try {
    const [stdout, stderr, exitCode] = await Promise.race([
      Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]),
      timeoutPromise,
    ]);

    return { stdout, stderr, exitCode };
  } catch (error) {
    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
    };
  }
}

export function parseSlashCommandResult(result: BmadCommandResult, command: string): BmadInvokeResult {
  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stdout,
      error: createError(
        ErrorCodes.BMAD_COMMAND_FAILED,
        `Slash command failed: ${command}`,
        {
          details: { stderr: result.stderr, exitCode: result.exitCode },
          suggestion: "Check that the slash command exists and Claude CLI is properly configured",
        }
      ),
    };
  }

  return {
    success: true,
    output: result.stdout,
  };
}

export async function invokeSlashCommand(
  command: string,
  args: string[] = [],
  options: BmadSlashCommandOptions = {}
): Promise<BmadInvokeResult> {
  const fullCommand = args.length > 0 ? `${command} ${args.join(" ")}` : command;

  logger.info(`Invoking slash command: ${fullCommand}`);

  const result = await runClaudeCommand(["--print", fullCommand], options);
  return parseSlashCommandResult(result, fullCommand);
}

export async function checkClaudeInstalled(): Promise<boolean> {
  try {
    const result = await runClaudeCommand(["--version"], { timeout: 5000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function listAvailableCommands(options: BmadSlashCommandOptions = {}): Promise<BmadInvokeResult> {
  const result = await runClaudeCommand(["--print", "/help"], options);
  return parseSlashCommandResult(result, "/help");
}

export function buildSlashCommand(base: string, storyId?: string, additionalArgs?: string[]): string {
  const parts = [base];
  if (storyId) parts.push(storyId);
  if (additionalArgs) parts.push(...additionalArgs);
  return parts.join(" ");
}

export function validateSlashCommand(command: string): boolean {
  return command.startsWith("/") && command.length > 1;
}
