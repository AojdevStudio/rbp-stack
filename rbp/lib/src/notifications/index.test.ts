import { describe, it, expect, mock } from "bun:test";
import { NotificationManager } from "./index";
import type { NotificationService, NotificationMessage } from "./index";

describe("NotificationManager", () => {
  it("should add configured services", () => {
    const manager = new NotificationManager();
    const mockService: NotificationService = {
      name: "TestService",
      isConfigured: () => true,
      send: mock(async () => {}),
    };

    manager.addService(mockService);
    expect(manager.hasConfiguredServices()).toBe(true);
  });

  it("should not add unconfigured services", () => {
    const manager = new NotificationManager();
    const mockService: NotificationService = {
      name: "TestService",
      isConfigured: () => false,
      send: mock(async () => {}),
    };

    manager.addService(mockService);
    expect(manager.hasConfiguredServices()).toBe(false);
  });

  it("should send notifications to all configured services", async () => {
    const manager = new NotificationManager();
    const mockService1: NotificationService = {
      name: "TestService1",
      isConfigured: () => true,
      send: mock(async () => {}),
    };
    const mockService2: NotificationService = {
      name: "TestService2",
      isConfigured: () => true,
      send: mock(async () => {}),
    };

    manager.addService(mockService1);
    manager.addService(mockService2);

    const message: NotificationMessage = {
      title: "Test",
      body: "Test message",
      status: "success",
    };

    await manager.send(message);

    expect(mockService1.send).toHaveBeenCalledWith(message);
    expect(mockService2.send).toHaveBeenCalledWith(message);
  });

  it("should handle failed notifications gracefully", async () => {
    const manager = new NotificationManager();
    const failingService: NotificationService = {
      name: "FailingService",
      isConfigured: () => true,
      send: mock(async () => {
        throw new Error("Failed to send");
      }),
    };
    const successService: NotificationService = {
      name: "SuccessService",
      isConfigured: () => true,
      send: mock(async () => {}),
    };

    manager.addService(failingService);
    manager.addService(successService);

    const message: NotificationMessage = {
      title: "Test",
      body: "Test message",
      status: "success",
    };

    await manager.send(message);

    expect(failingService.send).toHaveBeenCalled();
    expect(successService.send).toHaveBeenCalled();
  });

  it("should not attempt to send if no services configured", async () => {
    const manager = new NotificationManager();

    const message: NotificationMessage = {
      title: "Test",
      body: "Test message",
      status: "success",
    };

    await expect(manager.send(message)).resolves.toBeUndefined();
  });
});
