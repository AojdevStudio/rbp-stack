import { logger } from "../observability/logger";

export interface BmadInvokeResult {
  success: boolean;
  output?: string;
  error?: string;
}

export async function invokeSlashCommand(command: string, args: string[] = []): Promise<BmadInvokeResult> {
  const fullCommand = args.length > 0 ? `${command} ${args.join(" ")}` : command;

  logger.info(`Invoking slash command: ${fullCommand}`);

  const proc = Bun.spawn(["claude", "--print", fullCommand], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return {
      success: false,
      output: stdout,
      error: stderr || "Command failed",
    };
  }

  return {
    success: true,
    output: stdout,
  };
}
