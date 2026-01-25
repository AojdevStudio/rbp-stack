import type { AIProvider, ExecuteOptions, ExecuteResult } from "./index";
import { logger } from "../observability/logger";

export class CodexProvider implements AIProvider {
  name = "codex";

  async execute(prompt: string, options: ExecuteOptions = {}): Promise<ExecuteResult> {
    logger.warn("Codex provider not yet implemented");
    logger.info(`Would execute OpenAI Codex with prompt length: ${prompt.length}`);

    return {
      stdout: "[Codex Provider] Not yet implemented",
      stderr: "",
      exitCode: 1,
      success: false,
    };
  }

  isAvailable(): boolean {
    try {
      const proc = Bun.spawnSync(["which", "codex"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      return proc.exitCode === 0;
    } catch {
      return false;
    }
  }
}
