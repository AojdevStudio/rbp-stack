import { Command } from "commander";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { stringify as stringifyYaml } from "yaml";
import { logger } from "../observability/logger";
import { exitWithError, createError, ErrorCodes } from "../utils/errors";

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}

interface DetectedConfig {
  project: {
    name: string;
    language?: string;
  };
  verification: {
    test_command?: string;
    typecheck_command?: string;
    lint_command?: string;
    build_command?: string;
  };
}

function detectProjectName(): string {
  const packageJsonPath = join(process.cwd(), "package.json");

  if (existsSync(packageJsonPath)) {
    try {
      const pkg: PackageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      if (pkg.name) {
        return pkg.name;
      }
    } catch {
      // Fall through to directory name
    }
  }

  return basename(process.cwd());
}

function detectLanguage(): string {
  if (existsSync(join(process.cwd(), "tsconfig.json"))) {
    return "typescript";
  }

  if (existsSync(join(process.cwd(), "package.json"))) {
    return "javascript";
  }

  if (existsSync(join(process.cwd(), "pyproject.toml")) ||
      existsSync(join(process.cwd(), "setup.py")) ||
      existsSync(join(process.cwd(), "requirements.txt"))) {
    return "python";
  }

  if (existsSync(join(process.cwd(), "Cargo.toml"))) {
    return "rust";
  }

  if (existsSync(join(process.cwd(), "go.mod"))) {
    return "go";
  }

  return "unknown";
}

function detectTestCommand(packageJson?: PackageJson): string | undefined {
  if (packageJson?.scripts?.test) {
    return packageJson.scripts.test;
  }

  const language = detectLanguage();

  switch (language) {
    case "typescript":
    case "javascript":
      if (existsSync(join(process.cwd(), "bun.lockb"))) {
        return "bun test";
      }
      if (existsSync(join(process.cwd(), "vitest.config.ts")) ||
          existsSync(join(process.cwd(), "vitest.config.js"))) {
        return "vitest";
      }
      if (existsSync(join(process.cwd(), "jest.config.js")) ||
          existsSync(join(process.cwd(), "jest.config.ts"))) {
        return "jest";
      }
      return "npm test";

    case "python":
      if (existsSync(join(process.cwd(), "pyproject.toml"))) {
        const content = readFileSync(join(process.cwd(), "pyproject.toml"), "utf-8");
        if (content.includes("pytest")) {
          return "pytest";
        }
      }
      return "python -m pytest";

    case "rust":
      return "cargo test";

    case "go":
      return "go test ./...";

    default:
      return undefined;
  }
}

function detectTypecheckCommand(packageJson?: PackageJson): string | undefined {
  const language = detectLanguage();

  if (language !== "typescript") {
    return undefined;
  }

  if (packageJson?.scripts?.typecheck) {
    return packageJson.scripts.typecheck;
  }

  if (packageJson?.scripts?.["type-check"]) {
    return packageJson.scripts["type-check"];
  }

  return "tsc --noEmit";
}

function detectLintCommand(packageJson?: PackageJson): string | undefined {
  if (packageJson?.scripts?.lint) {
    return packageJson.scripts.lint;
  }

  if (existsSync(join(process.cwd(), "biome.json"))) {
    return "biome check .";
  }

  if (existsSync(join(process.cwd(), ".eslintrc.js")) ||
      existsSync(join(process.cwd(), ".eslintrc.json")) ||
      existsSync(join(process.cwd(), "eslint.config.js"))) {
    return "eslint .";
  }

  const language = detectLanguage();

  if (language === "python") {
    if (existsSync(join(process.cwd(), ".ruff.toml")) ||
        existsSync(join(process.cwd(), "ruff.toml"))) {
      return "ruff check .";
    }
    return "pylint .";
  }

  if (language === "rust") {
    return "cargo clippy";
  }

  if (language === "go") {
    return "golangci-lint run";
  }

  return undefined;
}

function detectBuildCommand(packageJson?: PackageJson): string | undefined {
  if (packageJson?.scripts?.build) {
    return packageJson.scripts.build;
  }

  const language = detectLanguage();

  switch (language) {
    case "typescript":
      return "tsc";

    case "rust":
      return "cargo build";

    case "go":
      return "go build";

    default:
      return undefined;
  }
}

function detectConfiguration(): DetectedConfig {
  let packageJson: PackageJson | undefined;
  const packageJsonPath = join(process.cwd(), "package.json");

  if (existsSync(packageJsonPath)) {
    try {
      packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    } catch {
      // Continue without package.json
    }
  }

  return {
    project: {
      name: detectProjectName(),
      language: detectLanguage(),
    },
    verification: {
      test_command: detectTestCommand(packageJson),
      typecheck_command: detectTypecheckCommand(packageJson),
      lint_command: detectLintCommand(packageJson),
      build_command: detectBuildCommand(packageJson),
    },
  };
}

function createConfigYaml(config: DetectedConfig): string {
  const yamlConfig: Record<string, unknown> = {
    project: {
      name: config.project.name,
    },
  };

  if (config.project.language && config.project.language !== "unknown") {
    yamlConfig.project = {
      ...(yamlConfig.project as Record<string, unknown>),
      language: config.project.language,
    };
  }

  const verification: Record<string, string> = {};

  if (config.verification.test_command) {
    verification.test_command = config.verification.test_command;
  }

  if (config.verification.typecheck_command) {
    verification.typecheck_command = config.verification.typecheck_command;
  }

  if (config.verification.lint_command) {
    verification.lint_command = config.verification.lint_command;
  }

  if (config.verification.build_command) {
    verification.build_command = config.verification.build_command;
  }

  if (Object.keys(verification).length > 0) {
    yamlConfig.verification = verification;
  }

  return stringifyYaml(yamlConfig);
}

export interface InitOptions {
  force?: boolean;
  dryRun?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  logger.banner("Ralph Init", "Project Configuration Setup");

  const configDir = join(process.cwd(), ".rbp");
  const configPath = join(configDir, "config.yaml");

  if (existsSync(configPath) && !options.force) {
    exitWithError(
      createError(
        ErrorCodes.CONFIG_EXISTS,
        "Configuration already exists at .rbp/config.yaml",
        {
          suggestion: "Use --force to overwrite, or edit the existing config manually",
        }
      )
    );
  }

  logger.section("Detecting Project Configuration");

  const detected = detectConfiguration();

  logger.info(`Project name: ${detected.project.name}`);
  if (detected.project.language) {
    logger.info(`Language: ${detected.project.language}`);
  }

  if (detected.verification.test_command) {
    logger.info(`Test command: ${detected.verification.test_command}`);
  }

  if (detected.verification.typecheck_command) {
    logger.info(`Typecheck command: ${detected.verification.typecheck_command}`);
  }

  if (detected.verification.lint_command) {
    logger.info(`Lint command: ${detected.verification.lint_command}`);
  }

  if (detected.verification.build_command) {
    logger.info(`Build command: ${detected.verification.build_command}`);
  }

  const yamlContent = createConfigYaml(detected);

  logger.section("Generated Configuration");
  console.log(yamlContent);

  if (options.dryRun) {
    logger.success("[DRY RUN] Configuration would be written to .rbp/config.yaml");
    return;
  }

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
    logger.info("Created .rbp directory");
  }

  writeFileSync(configPath, yamlContent, "utf-8");
  logger.success(`Configuration written to ${configPath}`);

  logger.section("Next Steps");
  logger.info("1. Review and edit .rbp/config.yaml as needed");
  logger.info("2. Run 'ralph status' to verify configuration");
  logger.info("3. Run 'ralph run' to start autonomous execution");
}

export const initCommandDef = new Command("init")
  .description("Initialize RBP configuration with auto-detected project settings")
  .option("-f, --force", "Overwrite existing configuration")
  .option("--dry-run", "Show what would be generated without creating files")
  .action(initCommand);
