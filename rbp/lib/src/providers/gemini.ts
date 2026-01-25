import type { AIProvider, ExecuteOptions, ExecuteResult } from "./index";
import { logger } from "../observability/logger";

export class GeminiProvider implements AIProvider {
  name = "gemini";

  async execute(prompt: string, options: ExecuteOptions = {}): Promise<ExecuteResult> {
    logger.warn("Gemini provider not yet implemented");
    logger.info(`Would execute Gemini with prompt length: ${prompt.length}`);

    return {
      stdout: "[Gemini Provider] Not yet implemented",
      stderr: "",
      exitCode: 1,
      success: false,
    };
  }

  isAvailable(): boolean {
    try {
      const proc = Bun.spawnSync(["which", "gemini"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      return proc.exitCode === 0;
    } catch {
      return false;
    }
  }
}
