import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "../api/helpers/storage-mock";

describe("storage-mock: tryMarkWebhookEventProcessed CAS-контракт", () => {
  it("первый вызов с новым eventId возвращает true и записывает событие", async () => {
    const storage = createInMemoryStorage();
    const result = await storage.tryMarkWebhookEventProcessed("event-1", "yookassa");
    expect(result).toBe(true);
    expect(storage._getProcessedEvents()).toHaveLength(1);
    expect(storage._getProcessedEvents()[0].eventId).toBe("event-1");
  });

  it("повторный вызов с тем же eventId возвращает false (идемпотентность)", async () => {
    const storage = createInMemoryStorage();
    const first = await storage.tryMarkWebhookEventProcessed("event-1", "yookassa");
    const second = await storage.tryMarkWebhookEventProcessed("event-1", "yookassa");
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(storage._getProcessedEvents()).toHaveLength(1);
  });

  it("разные eventId независимы", async () => {
    const storage = createInMemoryStorage();
    expect(await storage.tryMarkWebhookEventProcessed("event-1", "yookassa")).toBe(true);
    expect(await storage.tryMarkWebhookEventProcessed("event-2", "yookassa")).toBe(true);
    expect(await storage.tryMarkWebhookEventProcessed("event-1", "yookassa")).toBe(false);
    expect(storage._getProcessedEvents()).toHaveLength(2);
  });

  it("разные source с одним eventId — это разные события", async () => {
    const storage = createInMemoryStorage();
    expect(await storage.tryMarkWebhookEventProcessed("evt-1", "yookassa")).toBe(true);
    expect(await storage.tryMarkWebhookEventProcessed("evt-1", "telegram")).toBe(true);
    expect(storage._getProcessedEvents()).toHaveLength(2);
  });

  it("конкурентные вызовы с одним eventId — ровно один получает true", async () => {
    const storage = createInMemoryStorage();
    const results = await Promise.all([
      storage.tryMarkWebhookEventProcessed("evt-concurrent", "yookassa"),
      storage.tryMarkWebhookEventProcessed("evt-concurrent", "yookassa"),
      storage.tryMarkWebhookEventProcessed("evt-concurrent", "yookassa"),
    ]);
    const trueCount = results.filter((r) => r === true).length;
    expect(trueCount).toBe(1);
    expect(storage._getProcessedEvents()).toHaveLength(1);
  });
});
