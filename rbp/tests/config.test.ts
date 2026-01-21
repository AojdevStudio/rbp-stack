import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { loadConfig, validateConfig } from "../lib/src/config/loader";
import { RbpConfigSchema } from "../lib/src/config/schema";

const TEST_DIR = "/tmp/rbp-config-test";

describe("config schema", () => {
  test("validates correct YAML structure", () => {
    const validConfig = {
      project: {
        name: "test-project",
        description: "A test project",
      },
      execution: {
        max_iterations: 100,
      },
    };

    const result = RbpConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project.name).toBe("test-project");
      expect(result.data.execution.max_iterations).toBe(100);
    }
  });

  test("provides defaults for missing fields", () => {
    const minimalConfig = {
      project: {
        name: "minimal",
      },
    };

    const result = RbpConfigSchema.parse(minimalConfig);
    expect(result.execution.max_iterations).toBe(50);
    expect(result.verification.test_command).toBe("bun test");
    expect(result.paths.specs).toBe("specs");
  });

  test("rejects invalid max_iterations", () => {
    const invalidConfig = {
      project: { name: "test" },
      execution: { max_iterations: 2000 },
    };

    const result = RbpConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  test("rejects invalid reasoning_effort enum", () => {
    const invalidConfig = {
      project: { name: "test" },
      codex: { reasoning_effort: "invalid" },
    };

    const result = RbpConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  test("accepts valid reasoning_effort values", () => {
    for (const effort of ["low", "medium", "high"] as const) {
      const config = {
        project: { name: "test" },
        codex: { reasoning_effort: effort },
      };
      const result = RbpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    }
  });
});

describe("config loader", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  test("loads config from rbp-config.yaml", () => {
    const yamlContent = `
project:
  name: loaded-project
execution:
  max_iterations: 75
`;
    writeFileSync(`${TEST_DIR}/rbp-config.yaml`, yamlContent);

    const config = loadConfig();
    expect(config.project.name).toBe("loaded-project");
    expect(config.execution.max_iterations).toBe(75);
  });

  test("uses defaults when no config file exists", () => {
    const config = loadConfig();
    expect(config.project.name).toBe("unknown");
    expect(config.execution.max_iterations).toBe(50);
  });

  test("merges CLI overrides with file config", () => {
    const yamlContent = `
project:
  name: file-project
execution:
  max_iterations: 30
`;
    writeFileSync(`${TEST_DIR}/rbp-config.yaml`, yamlContent);

    const config = loadConfig({
      cliOverrides: {
        execution: { max_iterations: 100, phase_size: 10, iteration_delay: 5 },
      } as any,
    });

    expect(config.project.name).toBe("file-project");
    expect(config.execution.max_iterations).toBe(100);
  });

  test("loads from custom config path", () => {
    mkdirSync(`${TEST_DIR}/custom`, { recursive: true });
    const yamlContent = `
project:
  name: custom-config
`;
    writeFileSync(`${TEST_DIR}/custom/my-config.yaml`, yamlContent);

    const config = loadConfig({ configPath: `${TEST_DIR}/custom/my-config.yaml` });
    expect(config.project.name).toBe("custom-config");
  });
});

describe("validateConfig", () => {
  test("validates and returns typed config", () => {
    const raw = {
      project: { name: "validate-test" },
    };

    const config = validateConfig(raw);
    expect(config.project.name).toBe("validate-test");
  });

  test("throws on invalid config", () => {
    const invalid = {
      project: { name: "test" },
      execution: { max_iterations: "not a number" },
    };

    expect(() => validateConfig(invalid)).toThrow();
  });
});
