# Notification System Examples

## Quick Start

### 1. Setup Discord Webhook

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export RBP_DISCORD_WEBHOOK="https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz"
```

Or add to `rbp-config.yaml`:

```yaml
notifications:
  discord: "https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz"
```

### 2. Run Ralph

```bash
ralph run
```

You'll see in the output:

```
Notifications: Enabled
```

### 3. Notifications in Action

When a task completes:

**Discord:**
```
🟢 Task Completed
Successfully completed: Implement user authentication
Task ID: bead-auth-001
```

When a task fails:

**Discord:**
```
🔴 Task Failed
Tests failed for: Implement user authentication
Task ID: bead-auth-001
```

## Configuration Examples

### Discord Only

```yaml
notifications:
  discord: "https://discord.com/api/webhooks/..."
```

### Slack Only

```yaml
notifications:
  slack: "https://hooks.slack.com/services/..."
```

### Both Discord and Slack

```yaml
notifications:
  discord: "https://discord.com/api/webhooks/..."
  slack: "https://hooks.slack.com/services/..."
```

### Environment Variables Override

```bash
# Override config file values
export RBP_DISCORD_WEBHOOK="https://discord.com/api/webhooks/different-webhook"
export RBP_SLACK_WEBHOOK="https://hooks.slack.com/services/different-webhook"
```

## Testing Webhooks

### Test Discord Webhook Manually

```bash
curl -X POST "https://discord.com/api/webhooks/YOUR_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{
    "embeds": [{
      "title": "Test Notification",
      "description": "This is a test from RBP",
      "color": 65280
    }]
  }'
```

### Test Slack Webhook Manually

```bash
curl -X POST "https://hooks.slack.com/services/YOUR_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": "✅ Test Notification"
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "This is a test from RBP"
        }
      }
    ]
  }'
```

## Programmatic Usage

### Send Custom Notification

```typescript
import { createNotificationManager } from "./notifications/factory";
import type { RbpConfig } from "./config/types";

const config: RbpConfig = {
  // ... your config
  notifications: {
    discord: "https://discord.com/api/webhooks/...",
  },
};

const notificationManager = createNotificationManager(config);

// Send info notification
await notificationManager.send({
  title: "Workflow Started",
  body: "Beginning autonomous execution loop",
  status: "info",
});

// Send success notification
await notificationManager.send({
  title: "All Tasks Complete",
  body: "Successfully completed 5 tasks",
  status: "success",
});

// Send error notification
await notificationManager.send({
  title: "Critical Error",
  body: "Database connection failed",
  status: "error",
});
```

### Check if Notifications Configured

```typescript
const manager = createNotificationManager(config);

if (manager.hasConfiguredServices()) {
  console.log("Notifications enabled");
} else {
  console.log("No notification services configured");
}
```

## Troubleshooting

### Notifications Not Sending

1. **Check webhook URL format:**
   - Discord: `https://discord.com/api/webhooks/{id}/{token}`
   - Slack: `https://hooks.slack.com/services/{T...}/{B...}/{...}`

2. **Verify webhook is active:**
   - Test with curl commands above
   - Check Discord/Slack for deleted webhooks

3. **Check environment variables:**
   ```bash
   echo $RBP_DISCORD_WEBHOOK
   echo $RBP_SLACK_WEBHOOK
   ```

4. **Enable verbose logging:**
   ```bash
   ralph run --verbose
   ```

### Notifications Silently Failing

The notification system is designed to fail gracefully:

- Failed notifications log warnings but don't stop execution
- Check console output for "notification(s) failed to send"
- Verify network connectivity and webhook permissions

### No "Notifications: Enabled" Message

If you don't see this message during startup:

1. Webhooks are not configured
2. Both config file and environment variables are empty
3. Check config file path with `--config` flag

## Advanced Usage

### Custom Notification Service

```typescript
import type { NotificationService, NotificationMessage } from "./notifications";

class CustomNotificationService implements NotificationService {
  readonly name = "Custom";
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CUSTOM_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(message: NotificationMessage): Promise<void> {
    // Your custom implementation
    await fetch("https://api.custom.com/notify", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: message.title,
        text: message.body,
        level: message.status,
      }),
    });
  }
}

// Use it
const manager = new NotificationManager();
manager.addService(new CustomNotificationService("your-api-key"));
```
