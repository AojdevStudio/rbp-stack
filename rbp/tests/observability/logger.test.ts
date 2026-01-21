import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  logger,
  setLogLevel,
  LogLevel,
} from "../../lib/src/observability/logger";

describe("logger", () => {
  let consoleOutput: string[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => {
    consoleOutput = [];
    console.log = (...args: any[]) => {
      consoleOutput.push(args.join(" "));
    };
    console.warn = (...args: any[]) => {
      consoleOutput.push(args.join(" "));
    };
    console.error = (...args: any[]) => {
      consoleOutput.push(args.join(" "));
    };
    setLogLevel("debug");
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    setLogLevel("info");
  });

  test("debug logs at debug level", () => {
    logger.debug("test debug message");
    expect(consoleOutput.length).toBeGreaterThan(0);
    expect(consoleOutput[0]).toContain("DEBUG");
    expect(consoleOutput[0]).toContain("test debug message");
  });

  test("info logs at info level", () => {
    setLogLevel("info");
    logger.info("test info message");
    expect(consoleOutput.length).toBeGreaterThan(0);
    expect(consoleOutput[0]).toContain("test info message");
  });

  test("warn logs at warn level", () => {
    logger.warn("test warning message");
    expect(consoleOutput.length).toBeGreaterThan(0);
    const output = consoleOutput.join("\n");
    expect(output).toContain("test warning message");
  });

  test("error logs at error level", () => {
    logger.error("test error message");
    expect(consoleOutput.length).toBeGreaterThan(0);
    const output = consoleOutput.join("\n");
    expect(output).toContain("test error message");
  });

  test("success logs with checkmark", () => {
    logger.success("task completed");
    expect(consoleOutput.length).toBeGreaterThan(0);
    expect(consoleOutput[0]).toContain("task completed");
  });

  test("section prints formatted header", () => {
    logger.section("Test Section");
    expect(consoleOutput.length).toBeGreaterThan(0);
    expect(consoleOutput.join("\n")).toContain("Test Section");
  });

  test("banner prints formatted banner", () => {
    logger.banner("Test Banner", "v1.0");
    expect(consoleOutput.length).toBeGreaterThan(0);
    const output = consoleOutput.join("\n");
    expect(output).toContain("Test Banner");
    expect(output).toContain("v1.0");
  });

  test("respects log level - debug hidden at info level", () => {
    setLogLevel("info");
    logger.debug("should not appear");
    expect(consoleOutput.length).toBe(0);
  });

  test("respects log level - info hidden at warn level", () => {
    setLogLevel("warn");
    logger.info("should not appear");
    expect(consoleOutput.length).toBe(0);
  });

  test("respects log level - warn hidden at error level", () => {
    setLogLevel("error");
    logger.warn("should not appear");
    expect(consoleOutput.length).toBe(0);
  });
});
