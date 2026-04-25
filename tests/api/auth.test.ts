import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createTestApp, makeDemoTutor, type MockStorage } from "./helpers/test-app.js";

function makeMockStorage(overrides: Partial<MockStorage> = {}): MockStorage {
  return {
    getTutorByEmail: vi.fn().mockResolvedValue(null),
    getTutor: vi.fn().mockResolvedValue(null),
    getTutorBySlug: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("POST /api/auth/login", () => {
  it("returns 400 when email is missing", async () => {
    const app = createTestApp(makeMockStorage());
    const res = await request(app).post("/api/auth/login").send({ password: "demo123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 400 when password is missing", async () => {
    const app = createTestApp(makeMockStorage());
    const res = await request(app).post("/api/auth/login").send({ email: "test@test.ru" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 401 when tutor not found", async () => {
    const app = createTestApp(makeMockStorage());
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.ru", password: "password" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when password is wrong", async () => {
    const demoTutor = await makeDemoTutor();
    const app = createTestApp(
      makeMockStorage({
        getTutorByEmail: vi.fn().mockResolvedValue(demoTutor),
      })
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@vector.ru", password: "wrongpassword" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 200 and tutor data on success", async () => {
    const demoTutor = await makeDemoTutor();
    const app = createTestApp(
      makeMockStorage({
        getTutorByEmail: vi.fn().mockResolvedValue(demoTutor),
      })
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@vector.ru", password: "demo123" });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("demo@vector.ru");
    expect(res.body.name).toBe("Анна Петрова");
    expect(res.body.password).toBeUndefined();
  });

  it("does not expose password hash in response", async () => {
    const demoTutor = await makeDemoTutor();
    const app = createTestApp(
      makeMockStorage({
        getTutorByEmail: vi.fn().mockResolvedValue(demoTutor),
      })
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@vector.ru", password: "demo123" });
    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("returns 403 when account is blocked", async () => {
    const blockedTutor = await makeDemoTutor({ isBlocked: true });
    const app = createTestApp(
      makeMockStorage({
        getTutorByEmail: vi.fn().mockResolvedValue(blockedTutor),
      })
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@vector.ru", password: "demo123" });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createTestApp(makeMockStorage());
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns tutor data when authenticated", async () => {
    const demoTutor = await makeDemoTutor();
    const mockStorage = makeMockStorage({
      getTutorByEmail: vi.fn().mockResolvedValue(demoTutor),
      getTutor: vi.fn().mockResolvedValue(demoTutor),
    });
    const app = createTestApp(mockStorage);
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ email: "demo@vector.ru", password: "demo123" });
    const res = await agent.get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("demo@vector.ru");
    expect(res.body.name).toBe("Анна Петрова");
  });

  it("returns publicSlug in tutor data", async () => {
    const demoTutor = await makeDemoTutor();
    const mockStorage = makeMockStorage({
      getTutorByEmail: vi.fn().mockResolvedValue(demoTutor),
      getTutor: vi.fn().mockResolvedValue(demoTutor),
    });
    const app = createTestApp(mockStorage);
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ email: "demo@vector.ru", password: "demo123" });
    const res = await agent.get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.publicSlug).toBe("anna-petrova");
  });

  it("does not include password in /me response", async () => {
    const demoTutor = await makeDemoTutor();
    const mockStorage = makeMockStorage({
      getTutorByEmail: vi.fn().mockResolvedValue(demoTutor),
      getTutor: vi.fn().mockResolvedValue(demoTutor),
    });
    const app = createTestApp(mockStorage);
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ email: "demo@vector.ru", password: "demo123" });
    const res = await agent.get("/api/auth/me");

    expect(res.body.password).toBeUndefined();
  });
});

describe("POST /api/auth/logout", () => {
  it("destroys session and returns success", async () => {
    const demoTutor = await makeDemoTutor();
    const mockStorage = makeMockStorage({
      getTutorByEmail: vi.fn().mockResolvedValue(demoTutor),
      getTutor: vi.fn().mockResolvedValue(demoTutor),
    });
    const app = createTestApp(mockStorage);
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ email: "demo@vector.ru", password: "demo123" });
    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(401);
  });
});

describe("Session persistence", () => {
  it("session persists across requests", async () => {
    const demoTutor = await makeDemoTutor();
    const mockStorage = makeMockStorage({
      getTutorByEmail: vi.fn().mockResolvedValue(demoTutor),
      getTutor: vi.fn().mockResolvedValue(demoTutor),
    });
    const app = createTestApp(mockStorage);
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ email: "demo@vector.ru", password: "demo123" });

    const res1 = await agent.get("/api/auth/me");
    const res2 = await agent.get("/api/auth/me");
    const res3 = await agent.get("/api/auth/me");

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
  });
});
