import type { RbpConfig } from "../config/types";
import { emitCodexReview } from "../observability/events";
import { logger } from "../observability/logger";

export interface CodexReviewOptions {
  specFile: string;
  config: RbpConfig;
  timeout?: number;
}

export interface CodexReviewResult {
  success: boolean;
  skipped: boolean;
  output?: string;
  error?: string;
}

export async function checkCodexInstalled(): Promise<boolean> {
  try {
    const checkProc = Bun.spawnSync(["which", "codex"]);
    return checkProc.exitCode === 0;
  } catch {
    return false;
  }
}

export function buildReviewPrompt(specFile: string): string {
  return `Review this implementation spec for:
1. Missing edge cases
2. Wrong technical approaches
3. Missing dependencies
4. Incomplete testing strategy
5. Security concerns
6. Tasks too large to split

Spec file: ${specFile}

Provide specific, actionable improvements. Be concise.`;
}

export async function runCodexReview(options: CodexReviewOptions): Promise<CodexReviewResult> {
  const { specFile, config, timeout = 120000 } = options;

  if (!config.codex.enabled) {
    logger.info("Codex review disabled in config");
    return { success: true, skipped: true };
  }

  logger.section("Codex Pre-Flight Review");
  emitCodexReview("start", specFile);

  const isInstalled = await checkCodexInstalled();
  if (!isInstalled) {
    logger.warn("Codex CLI not found. Skipping pre-flight review.");
    logger.info("Install Codex to enable spec review: https://codex.openai.com");
    return { success: true, skipped: true };
  }

  logger.info(`Running ${config.codex.model} review (reasoning: ${config.codex.reasoning_effort})...`);

  const reviewPrompt = buildReviewPrompt(specFile);

  try {
    const proc = Bun.spawn(
      [
        "codex",
        "exec",
        "--skip-git-repo-check",
        "-m",
        config.codex.model,
        "--config",
        `model_reasoning_effort=${config.codex.reasoning_effort}`,
        "--sandbox",
        "read-only",
      ],
      {
        stdin: new TextEncoder().encode(reviewPrompt),
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      console.log(stdout);
      emitCodexReview("complete", specFile, stdout.slice(0, 500));
      logger.success("Codex review complete");
      return { success: true, skipped: false, output: stdout };
    } else {
      logger.warn("Codex review failed or unavailable. Continuing without review.");
      emitCodexReview("failed", specFile, "Codex unavailable or failed");
      return { success: false, skipped: false, error: "Codex review failed" };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn("Codex review error. Continuing without review.");
    emitCodexReview("failed", specFile, errorMsg);
    return { success: false, skipped: false, error: errorMsg };
  }
}
