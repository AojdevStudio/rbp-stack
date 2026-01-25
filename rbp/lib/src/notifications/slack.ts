import type { NotificationService, NotificationMessage } from "./index";

const STATUS_EMOJI: Record<NotificationMessage["status"], string> = {
  success: ":white_check_mark:",
  error: ":x:",
  info: ":information_source:",
};

export class SlackNotificationService implements NotificationService {
  readonly name = "Slack";
  private webhookUrl: string | undefined;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.RBP_SLACK_WEBHOOK;
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  async send(message: NotificationMessage): Promise<void> {
    if (!this.webhookUrl) {
      throw new Error("Slack webhook URL not configured");
    }

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${STATUS_EMOJI[message.status]} ${message.title}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: message.body,
        },
      },
    ];

    if (message.taskId) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Task ID:* ${message.taskId}`,
          },
        ],
      } as any);
    }

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        blocks,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Slack webhook failed (${response.status}): ${errorText}`
      );
    }
  }
}
