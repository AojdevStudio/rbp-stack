import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, readFileSync, rmSync, mkdirSync } from "fs";
import { homedir } from "os";
import { emitEvent, getSessionId } from "../../lib/src/observability/events";

describe("events", () => {
  const testDir = `${homedir()}/.claude/history/raw-outputs`;

  test("getSessionId returns consistent value", () => {
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);
  });

  test("emitEvent creates valid JSONL", () => {
    emitEvent("test_event", { key: "value", count: 42 });

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const date = `${yearMonth}-${String(now.getDate()).padStart(2, "0")}`;
    const filePath = `${testDir}/${yearMonth}/${date}_all-events.jsonl`;

    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const event = JSON.parse(lastLine);

    expect(event.event_type).toBe("test_event");
    expect(event.data.key).toBe("value");
    expect(event.data.count).toBe(42);
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.session_id).toBe(getSessionId());
  });

  test("emitEvent sanitizes sensitive data", () => {
    emitEvent("sensitive_test", {
      normal: "safe data",
      secret: "api_key=sk-12345678901234567890abcdef",
    });

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const date = `${yearMonth}-${String(now.getDate()).padStart(2, "0")}`;
    const filePath = `${testDir}/${yearMonth}/${date}_all-events.jsonl`;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const event = JSON.parse(lastLine);

    expect(event.data.normal).toBe("safe data");
    expect(event.data.secret).toContain("[REDACTED]");
    expect(event.data.secret).not.toContain("sk-12345678901234567890abcdef");
  });
});
