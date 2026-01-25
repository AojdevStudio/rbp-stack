import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { initCommand } from "./init";

describe("init command", () => {
  const testDir = join(process.cwd(), "test-init-workspace");
  const originalCwd = process.cwd();

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("detects TypeScript project with package.json", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({
        name: "test-ts-project",
        scripts: {
          test: "bun test",
          typecheck: "tsc --noEmit",
          lint: "eslint .",
          build: "tsc",
        },
      })
    );
    writeFileSync(join(testDir, "tsconfig.json"), JSON.stringify({}));

    await initCommand({ dryRun: true });

    expect(existsSync(join(testDir, ".rbp"))).toBe(false);
  });

  it("detects JavaScript project without TypeScript", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({
        name: "test-js-project",
        scripts: {
          test: "jest",
        },
      })
    );

    await initCommand({ dryRun: true });

    expect(existsSync(join(testDir, ".rbp"))).toBe(false);
  });

  it("detects Python project with pyproject.toml", async () => {
    writeFileSync(
      join(testDir, "pyproject.toml"),
      '[tool.pytest]\ntestpaths = ["tests"]'
    );

    await initCommand({ dryRun: true });

    expect(existsSync(join(testDir, ".rbp"))).toBe(false);
  });

  it("detects Rust project with Cargo.toml", async () => {
    writeFileSync(
      join(testDir, "Cargo.toml"),
      '[package]\nname = "test-rust"\nversion = "0.1.0"'
    );

    await initCommand({ dryRun: true });

    expect(existsSync(join(testDir, ".rbp"))).toBe(false);
  });

  it("creates config file when not in dry-run mode", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({
        name: "test-create-config",
        scripts: {
          test: "bun test",
        },
      })
    );

    await initCommand({ dryRun: false });

    expect(existsSync(join(testDir, ".rbp", "config.yaml"))).toBe(true);

    const configContent = readFileSync(
      join(testDir, ".rbp", "config.yaml"),
      "utf-8"
    );

    expect(configContent).toContain("name: test-create-config");
    expect(configContent).toContain("test_command: bun test");
  });

  it("prevents overwriting existing config without force flag", async () => {
    mkdirSync(join(testDir, ".rbp"), { recursive: true });
    writeFileSync(
      join(testDir, ".rbp", "config.yaml"),
      "project:\n  name: existing\n"
    );

    const originalExit = process.exit;
    let exitCalled = false;
    process.exit = (() => {
      exitCalled = true;
      throw new Error("Process exit called");
    }) as never;

    try {
      await initCommand({ dryRun: false });
    } catch (e) {
      expect(exitCalled).toBe(true);
    } finally {
      process.exit = originalExit;
    }

    expect(exitCalled).toBe(true);
  });

  it("overwrites existing config with force flag", async () => {
    mkdirSync(join(testDir, ".rbp"), { recursive: true });
    writeFileSync(
      join(testDir, ".rbp", "config.yaml"),
      "project:\n  name: existing\n"
    );

    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({
        name: "test-force-overwrite",
        scripts: {
          test: "vitest",
        },
      })
    );

    await initCommand({ dryRun: false, force: true });

    const configContent = readFileSync(
      join(testDir, ".rbp", "config.yaml"),
      "utf-8"
    );

    expect(configContent).toContain("name: test-force-overwrite");
    expect(configContent).toContain("test_command: vitest");
  });

  it("detects bun test for projects with bun.lockb", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({ name: "bun-project" })
    );
    writeFileSync(join(testDir, "bun.lockb"), "");

    await initCommand({ dryRun: false });

    const configContent = readFileSync(
      join(testDir, ".rbp", "config.yaml"),
      "utf-8"
    );

    expect(configContent).toContain("test_command: bun test");
  });

  it("detects vitest for projects with vitest.config.ts", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({ name: "vitest-project" })
    );
    writeFileSync(join(testDir, "vitest.config.ts"), "");

    await initCommand({ dryRun: false });

    const configContent = readFileSync(
      join(testDir, ".rbp", "config.yaml"),
      "utf-8"
    );

    expect(configContent).toContain("test_command: vitest");
  });

  it("detects jest for projects with jest.config.js", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({ name: "jest-project" })
    );
    writeFileSync(join(testDir, "jest.config.js"), "");

    await initCommand({ dryRun: false });

    const configContent = readFileSync(
      join(testDir, ".rbp", "config.yaml"),
      "utf-8"
    );

    expect(configContent).toContain("test_command: jest");
  });

  it("detects biome for linting", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({ name: "biome-project" })
    );
    writeFileSync(join(testDir, "biome.json"), "{}");

    await initCommand({ dryRun: false });

    const configContent = readFileSync(
      join(testDir, ".rbp", "config.yaml"),
      "utf-8"
    );

    expect(configContent).toContain("lint_command: biome check .");
  });

  it("uses project directory name when package.json has no name", async () => {
    writeFileSync(join(testDir, "package.json"), JSON.stringify({}));

    await initCommand({ dryRun: false });

    const configContent = readFileSync(
      join(testDir, ".rbp", "config.yaml"),
      "utf-8"
    );

    expect(configContent).toContain("name: test-init-workspace");
  });

  it("includes all detected commands in config", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({
        name: "full-config-test",
        scripts: {
          test: "bun test",
          typecheck: "tsc --noEmit",
          lint: "eslint .",
          build: "tsc",
        },
      })
    );
    writeFileSync(join(testDir, "tsconfig.json"), "{}");

    await initCommand({ dryRun: false });

    const configContent = readFileSync(
      join(testDir, ".rbp", "config.yaml"),
      "utf-8"
    );

    expect(configContent).toContain("test_command: bun test");
    expect(configContent).toContain("typecheck_command: tsc --noEmit");
    expect(configContent).toContain("lint_command: eslint .");
    expect(configContent).toContain("build_command: tsc");
  });
});
