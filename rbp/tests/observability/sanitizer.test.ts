import { describe, test, expect } from "bun:test";
import { sanitize, sanitizeObject } from "../../lib/src/observability/sanitizer";

describe("sanitize", () => {
  test("redacts API keys", () => {
    const input = 'api_key="sk-12345678901234567890abcdef"';
    const result = sanitize(input);
    expect(result).not.toContain("sk-12345678901234567890abcdef");
    expect(result).toContain("[REDACTED]");
  });

  test("redacts OpenAI API keys", () => {
    const input = "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz1234567890";
    const result = sanitize(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("sk-abcdefghijklmnopqrstuvwxyz1234567890");
  });

  test("redacts GitHub personal access tokens", () => {
    const input = "token=ghp_abcdefghijklmnopqrstuvwxyz1234567890";
    const result = sanitize(input);
    expect(result).toContain("[REDACTED]");
  });

  test("redacts GitHub OAuth tokens", () => {
    const input = "auth: gho_abcdefghijklmnopqrstuvwxyz1234567890";
    const result = sanitize(input);
    expect(result).toContain("[REDACTED]");
  });

  test("redacts AWS access keys", () => {
    const input = "aws_key=AKIAIOSFODNN7EXAMPLE";
    const result = sanitize(input);
    expect(result).toContain("[REDACTED]");
  });

  test("redacts bearer tokens", () => {
    const input = "bearer=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const result = sanitize(input);
    expect(result).toContain("[REDACTED]");
  });

  test("redacts password fields", () => {
    const input = 'password="super_secret_123"';
    const result = sanitize(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("super_secret_123");
  });

  test("leaves non-sensitive text unchanged", () => {
    const input = "This is a normal log message about task rbp-269.1";
    const result = sanitize(input);
    expect(result).toBe(input);
  });

  test("handles multiple secrets in one string", () => {
    const input = 'api_key="sk-secret123456789012345" password="mypass123"';
    const result = sanitize(input);
    const redactedCount = (result.match(/\[REDACTED\]/g) || []).length;
    expect(redactedCount).toBeGreaterThanOrEqual(2);
  });
});

describe("sanitizeObject", () => {
  test("sanitizes string values in objects", () => {
    const obj = {
      message: "Normal text",
      secret: "api_key=sk-12345678901234567890abcdef",
    };

    const result = sanitizeObject(obj);
    expect(result.message).toBe("Normal text");
    expect(result.secret).toContain("[REDACTED]");
  });

  test("sanitizes nested objects", () => {
    const obj = {
      outer: {
        inner: {
          token: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
        },
      },
    };

    const result = sanitizeObject(obj);
    expect(result.outer.inner.token).toContain("[REDACTED]");
  });

  test("sanitizes arrays of strings", () => {
    const obj = {
      logs: [
        "normal log",
        "password=secret123456789",
      ],
    };

    const result = sanitizeObject(obj);
    expect(result.logs[0]).toBe("normal log");
    expect(result.logs[1]).toContain("[REDACTED]");
  });

  test("preserves non-string values", () => {
    const obj = {
      count: 42,
      enabled: true,
      items: [1, 2, 3],
    };

    const result = sanitizeObject(obj);
    expect(result.count).toBe(42);
    expect(result.enabled).toBe(true);
    expect(result.items).toEqual([1, 2, 3]);
  });
});
