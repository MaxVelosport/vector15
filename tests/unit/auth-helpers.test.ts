import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../server/auth.js";

describe("hashPassword", () => {
  it("returns a non-empty string", async () => {
    const hash = await hashPassword("mypassword123");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("produces a different hash each time (bcrypt salts)", async () => {
    const hash1 = await hashPassword("password");
    const hash2 = await hashPassword("password");
    expect(hash1).not.toBe(hash2);
  });

  it("produces a bcrypt hash (starts with $2b$)", async () => {
    const hash = await hashPassword("test");
    expect(hash.startsWith("$2b$")).toBe(true);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const hash = await hashPassword("correct-password");
    const result = await verifyPassword("correct-password", hash);
    expect(result).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correct-password");
    const result = await verifyPassword("wrong-password", hash);
    expect(result).toBe(false);
  });

  it("returns false for empty password against non-empty hash", async () => {
    const hash = await hashPassword("some-password");
    const result = await verifyPassword("", hash);
    expect(result).toBe(false);
  });

  it("round-trips consistently with Russian characters", async () => {
    const password = "Пароль123!";
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("Пароль124!", hash)).toBe(false);
  });

  it("round-trips consistently with special characters", async () => {
    const password = "p@$$w0rd!#%&*";
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });
});
