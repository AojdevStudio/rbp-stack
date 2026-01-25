import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { DiscordNotificationService } from "./discord";
import type { NotificationMessage } from "./index";

describe("DiscordNotificationService", () => {
  const originalEnv = process.env.RBP_DISCORD_WEBHOOK;

  beforeEach(() => {
    delete process.env.RBP_DISCORD_WEBHOOK;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.RBP_DISCORD_WEBHOOK = originalEnv;
    } else {
      delete process.env.RBP_DISCORD_WEBHOOK;
    }
  });

  it("should be configured when webhook URL is provided", () => {
    const service = new DiscordNotificationService("https://discord.com/api/webhooks/test");
    expect(service.isConfigured()).toBe(true);
  });

  it("should be configured when RBP_DISCORD_WEBHOOK env var is set", () => {
    process.env.RBP_DISCORD_WEBHOOK = "https://discord.com/api/webhooks/test";
    const service = new DiscordNotificationService();
    expect(service.isConfigured()).toBe(true);
  });

  it("should not be configured when no webhook URL is available", () => {
    const service = new DiscordNotificationService();
    expect(service.isConfigured()).toBe(false);
  });

  it("should have correct name", () => {
    const service = new DiscordNotificationService();
    expect(service.name).toBe("Discord");
  });

  it("should throw error when sending without configuration", async () => {
    const service = new DiscordNotificationService();
    const message: NotificationMessage = {
      title: "Test",
      body: "Test message",
      status: "success",
    };

    await expect(service.send(message)).rejects.toThrow(
      "Discord webhook URL not configured"
    );
  });
});
