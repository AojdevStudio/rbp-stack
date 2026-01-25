import { NotificationManager } from "./index";
import { DiscordNotificationService } from "./discord";
import { SlackNotificationService } from "./slack";
import type { RbpConfig } from "../config/types";

export function createNotificationManager(config: RbpConfig): NotificationManager {
  const manager = new NotificationManager();

  const discordService = new DiscordNotificationService(config.notifications?.discord);
  if (discordService.isConfigured()) {
    manager.addService(discordService);
  }

  const slackService = new SlackNotificationService(config.notifications?.slack);
  if (slackService.isConfigured()) {
    manager.addService(slackService);
  }

  return manager;
}
