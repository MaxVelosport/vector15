import { describe, it, expect, vi } from "vitest";
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

describe("GET /api/public/tutor/:slug", () => {
  it("returns 404 for non-existent slug", async () => {
    const app = createTestApp(makeMockStorage());
    const res = await request(app).get("/api/public/tutor/nobody");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 404 for slug that is too short", async () => {
    const app = createTestApp(makeMockStorage());
    const res = await request(app).get("/api/public/tutor/ab");
    expect(res.status).toBe(404);
  });

  it("returns 404 for slug with uppercase letters", async () => {
    const app = createTestApp(makeMockStorage());
    const res = await request(app).get("/api/public/tutor/Anna-Petrova");
    expect(res.status).toBe(404);
  });

  it("returns 404 for slug with special chars", async () => {
    const app = createTestApp(makeMockStorage());
    const res = await request(app).get("/api/public/tutor/anna@petrova");
    expect(res.status).toBe(404);
  });

  it("returns 404 when tutor has isPublicProfile = false", async () => {
    const tutor = await makeDemoTutor({ isPublicProfile: false });
    const app = createTestApp(
      makeMockStorage({ getTutorBySlug: vi.fn().mockResolvedValue(tutor) })
    );
    const res = await request(app).get("/api/public/tutor/anna-petrova");
    expect(res.status).toBe(404);
  });

  it("returns 200 with full tutor data for valid public profile", async () => {
    const tutor = await makeDemoTutor();
    const app = createTestApp(
      makeMockStorage({ getTutorBySlug: vi.fn().mockResolvedValue(tutor) })
    );
    const res = await request(app).get("/api/public/tutor/anna-petrova");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Анна Петрова");
    expect(res.body.subjects).toEqual(["Математика", "Физика"]);
    expect(res.body.basePrice).toBe(1800);
  });

  it("does not expose password in public profile response", async () => {
    const tutor = await makeDemoTutor();
    const app = createTestApp(
      makeMockStorage({ getTutorBySlug: vi.fn().mockResolvedValue(tutor) })
    );
    const res = await request(app).get("/api/public/tutor/anna-petrova");
    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();
    expect(res.body.email).toBeUndefined();
    expect(res.body.isAdmin).toBeUndefined();
  });

  it("returns extended profile fields (experience, education)", async () => {
    const tutor = await makeDemoTutor({
      publicExperience: "9 лет",
      publicEducation: "МГУ, мехмат",
    });
    const app = createTestApp(
      makeMockStorage({ getTutorBySlug: vi.fn().mockResolvedValue(tutor) })
    );
    const res = await request(app).get("/api/public/tutor/anna-petrova");
    expect(res.status).toBe(200);
    expect(res.body.experience).toBe("9 лет");
    expect(res.body.education).toBe("МГУ, мехмат");
  });

  it("returns contact fields (whatsapp, vk)", async () => {
    const tutor = await makeDemoTutor({
      publicWhatsapp: "+79991234567",
      publicVk: "vk.com/anna_tutor",
    });
    const app = createTestApp(
      makeMockStorage({ getTutorBySlug: vi.fn().mockResolvedValue(tutor) })
    );
    const res = await request(app).get("/api/public/tutor/anna-petrova");
    expect(res.status).toBe(200);
    expect(res.body.whatsapp).toBe("+79991234567");
    expect(res.body.vk).toBe("vk.com/anna_tutor");
  });

  it("returns color field with default 'violet'", async () => {
    const tutor = await makeDemoTutor({ publicColor: "violet" });
    const app = createTestApp(
      makeMockStorage({ getTutorBySlug: vi.fn().mockResolvedValue(tutor) })
    );
    const res = await request(app).get("/api/public/tutor/anna-petrova");
    expect(res.status).toBe(200);
    expect(res.body.color).toBe("violet");
  });

  it("returns hidePrice field", async () => {
    const tutor = await makeDemoTutor({ publicHidePrice: true });
    const app = createTestApp(
      makeMockStorage({ getTutorBySlug: vi.fn().mockResolvedValue(tutor) })
    );
    const res = await request(app).get("/api/public/tutor/anna-petrova");
    expect(res.status).toBe(200);
    expect(res.body.hidePrice).toBe(true);
  });

  it("returns null fields for optional data not set", async () => {
    const tutor = await makeDemoTutor({
      publicVideoUrl: null,
      publicInstagram: null,
      avatar: null,
    });
    const app = createTestApp(
      makeMockStorage({ getTutorBySlug: vi.fn().mockResolvedValue(tutor) })
    );
    const res = await request(app).get("/api/public/tutor/anna-petrova");
    expect(res.status).toBe(200);
    expect(res.body.videoUrl).toBeNull();
    expect(res.body.instagram).toBeNull();
    expect(res.body.avatar).toBeNull();
  });

  it("returns achievements text as-is (multi-line)", async () => {
    const achievements = "100 баллов ЕГЭ у 3 учеников\nВсе поступили в МГУ";
    const tutor = await makeDemoTutor({ publicAchievements: achievements });
    const app = createTestApp(
      makeMockStorage({ getTutorBySlug: vi.fn().mockResolvedValue(tutor) })
    );
    const res = await request(app).get("/api/public/tutor/anna-petrova");
    expect(res.status).toBe(200);
    expect(res.body.achievements).toBe(achievements);
  });
});
