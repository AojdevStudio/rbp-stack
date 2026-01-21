import { describe, test, expect } from "bun:test";
import { statusCommandDef } from "../../lib/src/commands/status";

describe("statusCommandDef configuration", () => {
  test("has correct name", () => {
    expect(statusCommandDef.name()).toBe("status");
  });

  test("has correct description", () => {
    expect(statusCommandDef.description()).toBe("Show current execution state");
  });

  test("has no required arguments", () => {
    const args = statusCommandDef.registeredArguments;
    expect(args.length).toBe(0);
  });

  test("has no required options", () => {
    const opts = statusCommandDef.options;
    const required = opts.filter((o) => o.required);
    expect(required.length).toBe(0);
  });
});

describe("statusCommandDef help", () => {
  test("help output contains description", () => {
    const helpInfo = statusCommandDef.helpInformation();
    expect(helpInfo).toContain("Show current execution state");
  });

  test("help output contains usage", () => {
    const helpInfo = statusCommandDef.helpInformation();
    expect(helpInfo).toContain("status");
  });

  test("help option is available", () => {
    const helpInfo = statusCommandDef.helpInformation();
    expect(helpInfo).toContain("-h, --help");
  });
});
