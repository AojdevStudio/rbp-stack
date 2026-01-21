import type { RbpConfig } from "../config/types";
import { logger } from "../observability/logger";
import { createError, ErrorCodes, type RbpError } from "../utils/errors";

export interface ClaudeInvokeOptions {
  prompt: string;
  timeout?: number;
  workingDir?: string;
}

export interface ClaudeInvokeResult {
  success: boolean;
  output?: string;
  error?: RbpError;
  timedOut?: boolean;
}

export async function checkClaudeInstalled(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["claude", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

export async function invokeClaude(options: ClaudeInvokeOptions): Promise<ClaudeInvokeResult> {
  const { prompt, timeout = 300000, workingDir } = options;

  logger.debug(`Invoking Claude with prompt length: ${prompt.length}`);

  const args = ["claude", "--print", "-p", prompt];

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
      cwd: workingDir,
    });
  } catch (error) {
    // Handle case where claude CLI is not installed (ENOENT)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: createError(ErrorCodes.CLAUDE_FAILED, "Claude CLI not found or failed to start", {
        details: { error: errorMessage },
        suggestion: "Ensure claude CLI is installed and available in PATH",
      }),
    };
  }

  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
    setTimeout(() => {
      proc.kill();
      resolve({ timedOut: true });
    }, timeout);
  });

  const executionPromise = (async (): Promise<{ timedOut: false; stdout: string; stderr: string; exitCode: number }> => {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { timedOut: false, stdout, stderr, exitCode };
  })();

  try {
    const result = await Promise.race([executionPromise, timeoutPromise]);

    if (result.timedOut) {
      return {
        success: false,
        timedOut: true,
        error: createError(ErrorCodes.CLAUDE_TIMEOUT, "Claude CLI timed out", {
          details: { timeout },
          suggestion: "Increase timeout or simplify the prompt",
        }),
      };
    }

    const { stdout, stderr, exitCode } = result;

    if (exitCode !== 0) {
      return {
        success: false,
        output: stdout,
        error: createError(ErrorCodes.CLAUDE_FAILED, "Claude CLI failed", {
          details: { exitCode, stderr },
        }),
      };
    }

    return {
      success: true,
      output: stdout,
    };
  } catch (error) {
    proc.kill();
    return {
      success: false,
      error: createError(ErrorCodes.CLAUDE_FAILED, "Claude invocation error", {
        details: { error: String(error) },
      }),
    };
  }
}

export function buildTaskPrompt(taskTitle: string, taskNotes?: string, failureContext?: string): string {
  let prompt = `# Task: ${taskTitle}\n\n`;

  if (taskNotes) {
    prompt += `## Notes\n${taskNotes}\n\n`;
  }

  if (failureContext) {
    prompt += `## Previous Attempt Context\n${failureContext}\n\n`;
  }

  prompt += `## Instructions
1. Implement the task described above
2. Run tests to verify your implementation
3. If tests fail, analyze the error and fix the issue
4. Only report success when all tests pass
`;

  return prompt;
}
