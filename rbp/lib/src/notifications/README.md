# RBP Notification System

Webhook notification system for Ralph autonomous execution loop. Sends real-time notifications to Discord and Slack when tasks complete or fail.

## Features

- **Discord Integration**: Rich embed notifications with color-coded status
- **Slack Integration**: Block-based notifications with emoji status indicators
- **Multiple Services**: Send to multiple notification channels simultaneously
- **Graceful Failures**: Failed notifications don't stop execution
- **Environment Variables**: Configure via config file or environment variables
- **Zero Configuration**: Disabled by default, enables automatically when webhooks configured

## Configuration

### Via Config File (`rbp-config.yaml`)

```yaml
notifications:
  discord: "https://discord.com/api/webhooks/..."
  slack: "https://hooks.slack.com/services/..."
```

### Via Environment Variables

```bash
export RBP_DISCORD_WEBHOOK="https://discord.com/api/webhooks/..."
export RBP_SLACK_WEBHOOK="https://hooks.slack.com/services/..."
```

Environment variables take precedence over config file values.

## Notification Types

### Success Notifications

Sent when a task completes successfully:

- **Discord**: Green embed
- **Slack**: Green checkmark emoji
- **Fields**: Title, task description, task ID

### Error Notifications

Sent when a task fails or tests fail:

- **Discord**: Red embed
- **Slack**: Red X emoji
- **Fields**: Title, error message, task ID

## Architecture

```
notifications/
├── index.ts          # Core interfaces and NotificationManager
├── discord.ts        # Discord webhook implementation
├── slack.ts          # Slack webhook implementation
├── factory.ts        # NotificationManager factory
├── *.test.ts         # Unit tests
└── README.md         # This file
```

### Core Components

**NotificationManager**
- Manages multiple notification services
- Handles parallel sending with Promise.allSettled
- Gracefully handles failures without stopping execution

**NotificationService Interface**
- `name`: Service identifier
- `isConfigured()`: Check if service has required configuration
- `send(message)`: Send notification message

**Discord/Slack Services**
- Implement NotificationService interface
- Format messages for respective platforms
- Handle webhook HTTP requests

## Usage

### In Workflows

The notification system is automatically integrated into the Beads workflow:

```typescript
import { createNotificationManager } from "../notifications/factory";

const notificationManager = createNotificationManager(config);

// Send notification
await notificationManager.send({
  title: "Task Completed",
  body: "Successfully completed: User Authentication",
  status: "success",
  taskId: "bead-123",
});
```

### Custom Integration

```typescript
import { NotificationManager } from "./notifications";
import { DiscordNotificationService } from "./notifications/discord";

const manager = new NotificationManager();
const discord = new DiscordNotificationService("webhook-url");

manager.addService(discord);

await manager.send({
  title: "Custom Event",
  body: "Something happened",
  status: "info",
});
```

## Testing

Run notification tests:

```bash
bun test lib/src/notifications/
```

All services include comprehensive unit tests covering:
- Configuration detection
- Message formatting
- Error handling
- Environment variable support

## Webhook Setup

### Discord Webhook

1. Open Discord server settings
2. Go to Integrations > Webhooks
3. Click "New Webhook"
4. Copy webhook URL
5. Add to `rbp-config.yaml` or environment variable

### Slack Webhook

1. Go to https://api.slack.com/apps
2. Create new app or select existing
3. Enable "Incoming Webhooks"
4. Add webhook to workspace
5. Copy webhook URL
6. Add to `rbp-config.yaml` or environment variable

## Future Enhancements

Potential additions:

- Email notifications (SMTP)
- Microsoft Teams integration
- PagerDuty integration
- Custom webhook format support
- Notification filtering/rules
- Rate limiting
- Retry logic with exponential backoff
