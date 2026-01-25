export interface ExecuteOptions {
  cwd?: string;
  stdin?: string;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface AIProvider {
  name: string;
  execute(prompt: string, options?: ExecuteOptions): Promise<ExecuteResult>;
  isAvailable(): boolean;
}

import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";
import { CodexProvider } from "./codex";

const providers: Record<string, AIProvider> = {
  claude: new ClaudeProvider(),
  gemini: new GeminiProvider(),
  codex: new CodexProvider(),
};

export function getProvider(name: string): AIProvider {
  const provider = providers[name.toLowerCase()];
  if (!provider) {
    throw new Error(`Unknown provider: ${name}. Available providers: ${Object.keys(providers).join(", ")}`);
  }
  return provider;
}

export function listProviders(): string[] {
  return Object.keys(providers);
}
