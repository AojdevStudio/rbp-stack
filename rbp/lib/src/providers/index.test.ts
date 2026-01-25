import { describe, test, expect } from "bun:test";
import { getProvider, listProviders } from "./index";

describe("Provider Factory", () => {
  test("getProvider returns claude provider", () => {
    const provider = getProvider("claude");
    expect(provider.name).toBe("claude");
  });

  test("getProvider returns gemini provider", () => {
    const provider = getProvider("gemini");
    expect(provider.name).toBe("gemini");
  });

  test("getProvider returns codex provider", () => {
    const provider = getProvider("codex");
    expect(provider.name).toBe("codex");
  });

  test("getProvider is case insensitive", () => {
    const provider = getProvider("CLAUDE");
    expect(provider.name).toBe("claude");
  });

  test("getProvider throws for unknown provider", () => {
    expect(() => getProvider("unknown")).toThrow("Unknown provider: unknown");
  });

  test("listProviders returns all providers", () => {
    const providers = listProviders();
    expect(providers).toContain("claude");
    expect(providers).toContain("gemini");
    expect(providers).toContain("codex");
    expect(providers.length).toBe(3);
  });
});

describe("Claude Provider", () => {
  test("claude provider has correct interface", () => {
    const provider = getProvider("claude");
    expect(provider.name).toBe("claude");
    expect(typeof provider.execute).toBe("function");
    expect(typeof provider.isAvailable).toBe("function");
  });
});

describe("Gemini Provider", () => {
  test("gemini provider returns stub result", async () => {
    const provider = getProvider("gemini");
    const result = await provider.execute("test prompt");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Not yet implemented");
  });
});

describe("Codex Provider", () => {
  test("codex provider returns stub result", async () => {
    const provider = getProvider("codex");
    const result = await provider.execute("test prompt");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Not yet implemented");
  });
});
