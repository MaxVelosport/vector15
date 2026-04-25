import express from "express";
import session from "express-session";
import { hashPassword, verifyPassword } from "../../../server/auth.js";

export interface MockTutor {
  id: string;
  email: string;
  password: string;
  name: string;
  subjects: string[];
  basePrice: number;
  timezone: string;
  subscription: string;
  subscriptionUntil: null | string;
  isAdmin: boolean;
  publicSlug: string | null;
  publicBio: string | null;
  publicPhone: string | null;
  publicTelegram: string | null;
  isPublicProfile: boolean;
  publicExperience: string | null;
  publicEducation: string | null;
  publicWhatsapp: string | null;
  publicVk: string | null;
  publicInstagram: string | null;
  publicAchievements: string | null;
  publicVideoUrl: string | null;
  publicSubjectInfo: string | null;
  publicColor: string;
  publicHidePrice: boolean;
  avatar: string | null;
  isBlocked: boolean;
  scheduleStart: number;
  scheduleEnd: number;
}

export interface MockStorage {
  getTutorByEmail: (email: string) => Promise<MockTutor | null>;
  getTutor: (id: string) => Promise<MockTutor | null>;
  getTutorBySlug: (slug: string) => Promise<MockTutor | null>;
}

export function createTestApp(mockStorage: MockStorage) {
  const app = express();
  app.use(express.json());

  app.use(
    session({
      secret: "test-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true },
    })
  );

  function requireAuth(req: any, res: any, next: any) {
    if (!req.session.tutorId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    next();
  }

  // POST /api/auth/login
  app.post("/api/auth/login", async (req: any, res: any) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email и пароль обязательны" });
      }
      const tutor = await mockStorage.getTutorByEmail(email);
      if (!tutor) {
        return res.status(401).json({ error: "Неверный email или пароль" });
      }
      if (tutor.isBlocked) {
        return res.status(403).json({ error: "Аккаунт заблокирован" });
      }
      const valid = await verifyPassword(password, tutor.password);
      if (!valid) {
        return res.status(401).json({ error: "Неверный email или пароль" });
      }
      req.session.tutorId = tutor.id;
      res.json({
        id: tutor.id,
        email: tutor.email,
        name: tutor.name,
        subjects: tutor.subjects,
        subscription: tutor.subscription,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: any, res: any) => {
    req.session.destroy((err: any) => {
      if (err) return res.status(500).json({ error: "Ошибка выхода" });
      res.json({ success: true });
    });
  });

  // GET /api/auth/me
  app.get("/api/auth/me", requireAuth, async (req: any, res: any) => {
    try {
      const tutor = await mockStorage.getTutor(req.session.tutorId!);
      if (!tutor) return res.status(404).json({ error: "Tutor not found" });
      res.json({
        id: tutor.id,
        email: tutor.email,
        name: tutor.name,
        subjects: tutor.subjects,
        basePrice: tutor.basePrice,
        timezone: tutor.timezone,
        subscription: tutor.subscription,
        subscriptionUntil: tutor.subscriptionUntil,
        isAdmin: tutor.isAdmin,
        publicSlug: tutor.publicSlug,
        publicBio: tutor.publicBio,
        publicPhone: tutor.publicPhone,
        publicTelegram: tutor.publicTelegram,
        isPublicProfile: tutor.isPublicProfile,
        scheduleStart: tutor.scheduleStart,
        scheduleEnd: tutor.scheduleEnd,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/public/tutor/:slug
  app.get("/api/public/tutor/:slug", async (req: any, res: any) => {
    try {
      const { slug } = req.params;
      if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
        return res.status(404).json({ error: "Профиль не найден" });
      }
      const tutor = await mockStorage.getTutorBySlug(slug);
      if (!tutor || !tutor.isPublicProfile) {
        return res.status(404).json({ error: "Профиль не найден" });
      }
      res.json({
        name: tutor.name,
        subjects: tutor.subjects,
        basePrice: tutor.basePrice,
        bio: tutor.publicBio,
        phone: tutor.publicPhone,
        telegram: tutor.publicTelegram,
        experience: tutor.publicExperience,
        education: tutor.publicEducation,
        whatsapp: tutor.publicWhatsapp,
        vk: tutor.publicVk,
        instagram: tutor.publicInstagram,
        achievements: tutor.publicAchievements,
        videoUrl: tutor.publicVideoUrl,
        subjectInfo: tutor.publicSubjectInfo,
        color: tutor.publicColor ?? "violet",
        hidePrice: tutor.publicHidePrice ?? false,
        avatar: tutor.avatar,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return app;
}

// ─── Demo fixtures ─────────────────────────────────────────────────────────────

export async function makeDemoTutor(overrides: Partial<MockTutor> = {}): Promise<MockTutor> {
  const password = await hashPassword("demo123");
  return {
    id: "tutor-test-uuid-001",
    email: "demo@vector.ru",
    password,
    name: "Анна Петрова",
    subjects: ["Математика", "Физика"],
    basePrice: 1800,
    timezone: "Europe/Moscow",
    subscription: "premium",
    subscriptionUntil: "2030-12-31",
    isAdmin: false,
    publicSlug: "anna-petrova",
    publicBio: "Опытный репетитор",
    publicPhone: "+7 999 123-45-67",
    publicTelegram: "@anna_tutor",
    isPublicProfile: true,
    publicExperience: "9 лет",
    publicEducation: "МГУ, мехмат",
    publicWhatsapp: "+79991234567",
    publicVk: "vk.com/anna_tutor",
    publicInstagram: null,
    publicAchievements: "100 баллов ЕГЭ у 3 учеников",
    publicVideoUrl: null,
    publicSubjectInfo: "Готовлю к ЕГЭ",
    publicColor: "violet",
    publicHidePrice: false,
    avatar: null,
    isBlocked: false,
    scheduleStart: 8,
    scheduleEnd: 22,
    ...overrides,
  };
}
