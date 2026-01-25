export interface NotificationMessage {
  title: string;
  body: string;
  status: "success" | "error" | "info";
  taskId?: string;
}

export interface NotificationService {
  name: string;
  send(message: NotificationMessage): Promise<void>;
  isConfigured(): boolean;
}

export class NotificationManager {
  private services: NotificationService[] = [];

  addService(service: NotificationService): void {
    if (service.isConfigured()) {
      this.services.push(service);
    }
  }

  async send(message: NotificationMessage): Promise<void> {
    if (this.services.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      this.services.map(service => service.send(message))
    );

    const failures = results.filter(r => r.status === "rejected");
    if (failures.length > 0) {
      console.warn(`${failures.length} notification(s) failed to send`);
    }
  }

  hasConfiguredServices(): boolean {
    return this.services.length > 0;
  }
}

export { DiscordNotificationService } from "./discord";
export { SlackNotificationService } from "./slack";
export { createNotificationManager } from "./factory";
