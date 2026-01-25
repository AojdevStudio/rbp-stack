import type { NotificationService, NotificationMessage } from "./index";

const STATUS_COLORS: Record<NotificationMessage["status"], number> = {
  success: 0x00ff00, // Green
  error: 0xff0000,   // Red
  info: 0x0099ff,    // Blue
};

export class DiscordNotificationService implements NotificationService {
  readonly name = "Discord";
  private webhookUrl: string | undefined;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.RBP_DISCORD_WEBHOOK;
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  async send(message: NotificationMessage): Promise<void> {
    if (!this.webhookUrl) {
      throw new Error("Discord webhook URL not configured");
    }

    const embed = {
      title: message.title,
      description: message.body,
      color: STATUS_COLORS[message.status],
      timestamp: new Date().toISOString(),
      ...(message.taskId && {
        footer: {
          text: `Task ID: ${message.taskId}`,
        },
      }),
    };

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Discord webhook failed (${response.status}): ${errorText}`
      );
    }
  }
}
