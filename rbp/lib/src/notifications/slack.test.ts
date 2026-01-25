import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SlackNotificationService } from "./slack";
import type { NotificationMessage } from "./index";

describe("SlackNotificationService", () => {
  const originalEnv = process.env.RBP_SLACK_WEBHOOK;

  beforeEach(() => {
    delete process.env.RBP_SLACK_WEBHOOK;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.RBP_SLACK_WEBHOOK = originalEnv;
    } else {
      delete process.env.RBP_SLACK_WEBHOOK;
    }
  });

  it("should be configured when webhook URL is provided", () => {
    const service = new SlackNotificationService("https://hooks.slack.com/services/test");
    expect(service.isConfigured()).toBe(true);
  });

  it("should be configured when RBP_SLACK_WEBHOOK env var is set", () => {
    process.env.RBP_SLACK_WEBHOOK = "https://hooks.slack.com/services/test";
    const service = new SlackNotificationService();
    expect(service.isConfigured()).toBe(true);
  });

  it("should not be configured when no webhook URL is available", () => {
    const service = new SlackNotificationService();
    expect(service.isConfigured()).toBe(false);
  });

  it("should have correct name", () => {
    const service = new SlackNotificationService();
    expect(service.name).toBe("Slack");
  });

  it("should throw error when sending without configuration", async () => {
    const service = new SlackNotificationService();
    const message: NotificationMessage = {
      title: "Test",
      body: "Test message",
      status: "success",
    };

    await expect(service.send(message)).rejects.toThrow(
      "Slack webhook URL not configured"
    );
  });
});
