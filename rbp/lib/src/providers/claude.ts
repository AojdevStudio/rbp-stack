import type { AIProvider, ExecuteOptions, ExecuteResult } from "./index";
import { logger } from "../observability/logger";

export class ClaudeProvider implements AIProvider {
  name = "claude";

  async execute(prompt: string, options: ExecuteOptions = {}): Promise<ExecuteResult> {
    logger.debug(`Executing Claude provider with prompt length: ${prompt.length}`);

    const proc = Bun.spawn(
      ["claude", "--dangerously-skip-permissions"],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        cwd: options.cwd ?? process.cwd(),
      }
    );

    proc.stdin?.write(new TextEncoder().encode(prompt));
    proc.stdin?.end();

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    return {
      stdout,
      stderr,
      exitCode,
      success: exitCode === 0,
    };
  }

  isAvailable(): boolean {
    try {
      const proc = Bun.spawnSync(["which", "claude"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      return proc.exitCode === 0;
    } catch {
      return false;
    }
  }
}
