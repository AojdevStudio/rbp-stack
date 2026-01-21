import { existsSync, readFileSync } from "fs";
import { parse as parseYaml } from "yaml";
import { RbpConfigSchema } from "./schema";
import { findProjectRoot } from "../utils/project-detector";
import type { RbpConfig, ConfigLoadOptions } from "./types";

const DEFAULT_CONFIG_PATHS = ["rbp-config.yaml", "rbp-config.yml", ".rbp/config.yaml"];

function findConfigFile(basePath: string): string | null {
  for (const configPath of DEFAULT_CONFIG_PATHS) {
    const fullPath = `${basePath}/${configPath}`;
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];
    if (
      sourceValue !== undefined &&
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }
  return result;
}

export function loadConfig(options: ConfigLoadOptions = {}): RbpConfig {
  const basePath = findProjectRoot();
  const configPath = options.configPath ?? findConfigFile(basePath);

  let rawConfig: Record<string, unknown> = {};

  if (configPath && existsSync(configPath)) {
    const content = readFileSync(configPath, "utf-8");
    rawConfig = parseYaml(content) as Record<string, unknown>;
  }

  const parsed = RbpConfigSchema.parse(rawConfig);

  if (options.cliOverrides) {
    return deepMerge(parsed, options.cliOverrides as Partial<RbpConfig>);
  }

  return parsed;
}

export function validateConfig(config: unknown): RbpConfig {
  return RbpConfigSchema.parse(config);
}
