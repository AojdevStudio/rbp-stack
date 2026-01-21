import { describe, test, expect } from "bun:test";
import { parseShellCommand } from "../../lib/src/utils/shell";

describe("parseShellCommand", () => {
  test("parses simple commands", () => {
    expect(parseShellCommand("bun test")).toEqual(["bun", "test"]);
    expect(parseShellCommand("npm run build")).toEqual(["npm", "run", "build"]);
  });

  test("handles double-quoted arguments", () => {
    expect(parseShellCommand('bun test --filter "my test"')).toEqual([
      "bun",
      "test",
      "--filter",
      "my test",
    ]);
    expect(parseShellCommand('echo "hello world"')).toEqual([
      "echo",
      "hello world",
    ]);
  });

  test("handles single-quoted arguments", () => {
    expect(parseShellCommand("echo 'hello world'")).toEqual([
      "echo",
      "hello world",
    ]);
    expect(parseShellCommand("npm test -- --grep='pattern'")).toEqual([
      "npm",
      "test",
      "--",
      "--grep=pattern",
    ]);
  });

  test("handles escaped characters", () => {
    expect(parseShellCommand(`echo "it\\'s fine"`)).toEqual(["echo", "it's fine"]);
    expect(parseShellCommand("echo hello\\ world")).toEqual(["echo", "hello world"]);
  });

  test("handles mixed quotes", () => {
    expect(parseShellCommand(`echo "hello 'world'"`)).toEqual([
      "echo",
      "hello 'world'",
    ]);
    expect(parseShellCommand(`echo 'hello "world"'`)).toEqual([
      "echo",
      'hello "world"',
    ]);
  });

  test("handles multiple spaces", () => {
    expect(parseShellCommand("bun   test")).toEqual(["bun", "test"]);
    expect(parseShellCommand("  bun test  ")).toEqual(["bun", "test"]);
  });

  test("handles empty string", () => {
    expect(parseShellCommand("")).toEqual([]);
    expect(parseShellCommand("   ")).toEqual([]);
  });

  test("handles complex test commands", () => {
    expect(
      parseShellCommand('bun test --filter "integration tests" --timeout 5000')
    ).toEqual(["bun", "test", "--filter", "integration tests", "--timeout", "5000"]);

    expect(
      parseShellCommand("bunx playwright test --grep='login flow'")
    ).toEqual(["bunx", "playwright", "test", "--grep=login flow"]);
  });

  test("backslash in single quotes is literal", () => {
    expect(parseShellCommand("echo '\\n'")).toEqual(["echo", "\\n"]);
  });
});
