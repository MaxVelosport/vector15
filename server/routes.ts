import type { Express } from "express";
import type { Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { hashPassword, verifyPassword, requireAuth, requireAdmin, requireEmailVerified } from "./auth";
import { z } from "zod";
import { botManager } from "./telegram-bot";
import { AI_PACKAGE_OPTIONS, SUBSCRIPTION_LIMITS, EXTRA_STUDENT_PACKAGES } from "../shared/schema";
import YooKassa from "yookassa";
import nodemailer from "nodemailer";
import OpenAI, { toFile } from "openai";
import multer from "multer";
import { openaiKey, appUrl } from "./builtin-config";

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — Whisper hard limit
});
import { setupBoardWebSocket, generateBoardWsToken } from "./board-ws";
import { generateCalendarToken, verifyCalendarToken, buildICalendar } from "./calendar-ics";
import { generateParentChatToken, verifyParentChatToken } from "./hmac-tokens";
import { publicLimiter } from "./rate-limit";

// Per-tutor async mutex to serialize student-count-sensitive operations
const _tutorLocks = new Map<string, Promise<void>>();
async function withTutorLock<T>(tutorId: string, fn: () => Promise<T>): Promise<T> {
  const prev = _tutorLocks.get(tutorId) || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => { release = r; });
  _tutorLocks.set(tutorId, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (_tutorLocks.get(tutorId) === prev.then(() => next)) _tutorLocks.delete(tutorId);
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
import {
  createBbbMeeting,
  getBbbJoinUrl,
  endBbbMeeting,
  isBbbMeetingRunning,
  isBbbConfigured,
  invalidateBbbCache,
  getBbbRecordings,
  ensureConferencesForAllTutors,
} from "./bbb";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: openaiKey() });
  }
  return _openai;
}

const yookassa = new YooKassa({
  shopId: process.env.YOOKASSA_SHOP_ID || "",
  secretKey: process.env.YOOKASSA_SECRET_KEY || "",
});

async function buildTutorBackupJson(tutorId: string): Promise<string> {
  const [tutor, students, lessons, payments, homework] = await Promise.all([
    storage.getTutor(tutorId),
    storage.getStudentsByTutorId(tutorId),
    storage.getLessonsByTutorId(tutorId, 100000),
    storage.getPaymentsByTutorId(tutorId, 100000),
    storage.getHomeworkByTutorId(tutorId, 100000),
  ]);

  const safeProfile = tutor
    ? {
        id: tutor.id,
        email: tutor.email,
        name: tutor.name,
        subjects: tutor.subjects,
        basePrice: tutor.basePrice,
        timezone: tutor.timezone,
        subscription: tutor.subscription,
        subscriptionUntil: tutor.subscriptionUntil,
        publicSlug: tutor.publicSlug,
        publicBio: tutor.publicBio,
        isPublicProfile: tutor.isPublicProfile,
        cancelPolicy: tutor.cancelPolicy,
        cancelFee: tutor.cancelFee,
        scheduleStart: tutor.scheduleStart,
        scheduleEnd: tutor.scheduleEnd,
        createdAt: tutor.createdAt,
      }
    : null;

  return JSON.stringify({
    version: "1.0",
    platform: "Твой Вектор",
    createdAt: new Date().toISOString(),
    tutorId,
    profile: safeProfile,
    students,
    lessons,
    payments,
    homework,
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  setupBoardWebSocket(httpServer);

  // ======= AUTH ROUTES =======
  
  // GET /api/public/trial-days — длительность бесплатного пробного периода (для лендинга)
  app.get("/api/public/trial-days", async (_req, res) => {
    try {
      const raw = await storage.getAiSetting("trial_days");
      const parsed = raw == null ? 30 : Number(raw);
      const days = Number.isInteger(parsed) && parsed >= 0 && parsed <= 365 ? parsed : 30;
      res.set("Cache-Control", "public, max-age=300");
      res.json({ days });
    } catch {
      res.json({ days: 30 });
    }
  });

  // POST /api/auth/register - Публичная регистрация нового репетитора
  app.post("/api/auth/register", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        subjects: z.array(z.string()).default([]),
        referralCode: z.string().trim().toUpperCase().optional(),
      });

      const data = schema.parse(req.body);

      const existing = await storage.getTutorByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: "Email уже используется" });
      }

      // Resolve referral code (if provided)
      let referredBy: string | null = null;
      if (data.referralCode) {
        const referrer = await storage.getTutorByReferralCode(data.referralCode);
        if (referrer) referredBy = referrer.id;
      }

      const hashedPassword = await hashPassword(data.password);

      // Определяем длительность триала из настроек платформы
      let trialDays = 0;
      try {
        const raw = await storage.getAiSetting("trial_days");
        const parsed = raw == null ? 30 : Number(raw);
        trialDays = Number.isInteger(parsed) && parsed >= 0 && parsed <= 365 ? parsed : 30;
      } catch { trialDays = 30; }
      const trialUntil = trialDays > 0
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
        : null;

      // Generate unique referral code (retry on collision)
      const { randomBytes } = await import("crypto");
      let myReferralCode = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = randomBytes(5).toString("hex").toUpperCase().slice(0, 8);
        const existing = await storage.getTutorByReferralCode(candidate);
        if (!existing) { myReferralCode = candidate; break; }
      }
      if (!myReferralCode) myReferralCode = randomBytes(6).toString("hex").toUpperCase();

      const tutor = await storage.createTutor({
        email: data.email,
        password: hashedPassword,
        name: data.name,
        subjects: data.subjects,
        isAdmin: false,
        basePrice: 1600,
        timezone: "Europe/Moscow",
        subscription: trialUntil ? "pro" : "free",
        subscriptionUntil: trialUntil,
        emailVerified: false,
        referralCode: myReferralCode,
        referredBy: referredBy as any,
      } as any);

      // Send verification email (non-blocking)
      setImmediate(async () => {
        try {
          const token = randomUUID();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await storage.createEmailVerificationToken(tutor.id, token, expiresAt);
          const smtpHost = process.env.SMTP_HOST;
          const smtpUser = process.env.SMTP_USER;
          const smtpPass = process.env.SMTP_PASS;
          const smtpPort = process.env.SMTP_PORT || "465";
          if (smtpHost && smtpUser && smtpPass) {
            const transporter = nodemailer.createTransport({
              host: smtpHost, port: parseInt(smtpPort), secure: smtpPort === "465",
              auth: { user: smtpUser, pass: smtpPass },
              tls: { rejectUnauthorized: false },
            });
            const verifyUrl = `${req.protocol}://${req.get("host")}/verify-email?token=${token}`;
            await transporter.sendMail({
              from: process.env.SMTP_FROM || smtpUser,
              to: tutor.email,
              subject: "Подтверждение email — Твой Вектор",
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2>Добро пожаловать, ${tutor.name}!</h2>
                <p>Для завершения регистрации подтвердите ваш email-адрес:</p>
                <p><a href="${verifyUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Подтвердить email</a></p>
                <p>Или скопируйте ссылку: ${verifyUrl}</p>
                <p style="color:#666;">Ссылка действительна 24 часа.</p>
              </div>`,
            });
          }
        } catch (e) { console.error("Verification email error:", e); }
      });

      res.json({ id: tutor.id, email: tutor.email, name: tutor.name });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/auth/login - Вход
  app.post("/api/auth/login", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string(),
      });

      const { email, password } = schema.parse(req.body);

      // Clear any previous pending 2FA state on a fresh login attempt
      if ((req.session as any).pending2faTutorId) {
        delete (req.session as any).pending2faTutorId;
      }

      const tutor = await storage.getTutorByEmail(email);
      if (!tutor) {
        return res.status(401).json({ error: "Неверный email или пароль" });
      }

      const valid = await verifyPassword(password, tutor.password);
      if (!valid) {
        return res.status(401).json({ error: "Неверный email или пароль" });
      }

      if (tutor.isBlocked) {
        return res.status(403).json({ error: "Аккаунт заблокирован. Обратитесь в поддержку." });
      }

      // 2FA check: if enabled, require code verification step
      if ((tutor as any).twoFactorEnabled) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await storage.createTwoFactorCode(tutor.id, code, expiresAt);

        // Email the code
        const smtpHost = process.env.SMTP_HOST;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const smtpPort = process.env.SMTP_PORT || "465";
        if (smtpHost && smtpUser && smtpPass) {
          try {
            const transporter = nodemailer.createTransport({
              host: smtpHost, port: parseInt(smtpPort), secure: smtpPort === "465",
              auth: { user: smtpUser, pass: smtpPass },
              tls: { rejectUnauthorized: false },
            });
            await transporter.sendMail({
              from: process.env.SMTP_FROM || smtpUser,
              to: tutor.email,
              subject: `Код для входа: ${code} — Твой Вектор`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2>Код для входа</h2>
                <p>Здравствуйте, ${tutor.name}!</p>
                <p>Ваш код для входа в аккаунт:</p>
                <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#3b82f6;">${code}</p>
                <p>Код действителен 10 минут. Если вы не пытались войти — смените пароль.</p>
              </div>`,
            });
          } catch (e) { console.error("2FA email error:", e); }
        }

        // Store pending auth in session (not yet logged in)
        (req.session as any).pending2faTutorId = tutor.id;
        return req.session.save((err) => {
          if (err) return res.status(500).json({ error: "Ошибка сессии" });
          res.json({ requires2FA: true, email: tutor.email });
        });
      }

      // Сохраняем в сессии
      req.session.tutorId = tutor.id;

      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ error: "Ошибка сохранения сессии" });
        }
        res.json({
          id: tutor.id,
          email: tutor.email,
          name: tutor.name,
          subscription: tutor.subscription,
          isAdmin: tutor.isAdmin,
        });
        // Асинхронный авто-бэкап: если последний авто-бэкап старше 24ч — создаём новый
        setImmediate(async () => {
          try {
            const existing = await storage.getBackupsByTutorId(tutor.id);
            const lastAuto = existing.find(b => b.type === 'auto');
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            if (!lastAuto || new Date(lastAuto.createdAt) < oneDayAgo) {
              const dataJson = await buildTutorBackupJson(tutor.id);
              await storage.createBackup(tutor.id, 'auto', null, dataJson);
              await storage.deleteOldAutoBackups(tutor.id, 7);
            }
          } catch (_) { /* не блокируем вход при ошибке бэкапа */ }
        });
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/auth/logout - Выход
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Ошибка выхода" });
      }
      res.json({ success: true });
    });
  });

  // POST /api/auth/forgot-password - Запрос на восстановление пароля
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const reqSchema = z.object({
        email: z.string().email(),
      });

      const { email } = reqSchema.parse(req.body);

      const tutor = await storage.getTutorByEmail(email);
      if (!tutor) {
        return res.json({ success: true });
      }

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.createPasswordResetToken(tutor.id, token, expiresAt);

      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpPort = process.env.SMTP_PORT || "587";

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort),
          secure: smtpPort === "465",
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: { rejectUnauthorized: false },
        });

        const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;

        await transporter.sendMail({
          from: process.env.SMTP_FROM || smtpUser,
          to: tutor.email,
          subject: "Восстановление пароля — Твой Вектор",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Восстановление пароля</h2>
              <p>Здравствуйте, ${tutor.name}!</p>
              <p>Вы запросили восстановление пароля для аккаунта на платформе "Твой Вектор".</p>
              <p>Для сброса пароля перейдите по ссылке:</p>
              <p><a href="${resetUrl}" style="color: #3b82f6;">${resetUrl}</a></p>
              <p>Ссылка действительна в течение 1 часа.</p>
              <p>Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e5e5;">
              <p style="color: #666; font-size: 12px;">Твой Вектор — платформа для репетиторов</p>
            </div>
          `,
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/auth/reset-password - Сброс пароля
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const reqSchema = z.object({
        token: z.string(),
        password: z.string().min(6),
      });

      const { token, password } = reqSchema.parse(req.body);

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ error: "Недействительная ссылка для сброса пароля" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ error: "Эта ссылка уже была использована" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "Ссылка истекла. Запросите новую." });
      }

      const hashedPassword = await hashPassword(password);
      await storage.updateTutor(resetToken.tutorId, { password: hashedPassword });
      await storage.markPasswordResetTokenUsed(resetToken.id);

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/auth/2fa/verify - Завершение входа после ввода кода из email
  app.post("/api/auth/2fa/verify", async (req, res) => {
    try {
      const { code } = z.object({ code: z.string().min(4).max(10) }).parse(req.body);
      const pendingId = (req.session as any).pending2faTutorId;
      if (!pendingId) return res.status(401).json({ error: "Сессия истекла. Войдите заново." });

      const ok = await storage.verifyTwoFactorCode(pendingId, code);
      if (!ok) return res.status(400).json({ error: "Неверный или истёкший код" });

      const tutor = await storage.getTutor(pendingId);
      if (!tutor) return res.status(404).json({ error: "Пользователь не найден" });

      delete (req.session as any).pending2faTutorId;
      req.session.tutorId = tutor.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: "Ошибка сессии" });
        res.json({
          id: tutor.id, email: tutor.email, name: tutor.name,
          subscription: tutor.subscription, isAdmin: tutor.isAdmin,
        });
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/auth/2fa/resend - Отправить код повторно
  app.post("/api/auth/2fa/resend", async (req, res) => {
    try {
      const pendingId = (req.session as any).pending2faTutorId;
      if (!pendingId) return res.status(401).json({ error: "Нет активной попытки входа" });
      const tutor = await storage.getTutor(pendingId);
      if (!tutor) return res.status(404).json({ error: "Не найдено" });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.createTwoFactorCode(tutor.id, code, expiresAt);

      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpPort = process.env.SMTP_PORT || "465";
      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost, port: parseInt(smtpPort), secure: smtpPort === "465",
          auth: { user: smtpUser, pass: smtpPass }, tls: { rejectUnauthorized: false },
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || smtpUser,
          to: tutor.email,
          subject: `Код для входа: ${code} — Твой Вектор`,
          html: `<div style="font-family:sans-serif;"><h2>Новый код: ${code}</h2><p>Действителен 10 минут.</p></div>`,
        });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/auth/2fa/toggle - Включить/выключить 2FA (auth required)
  app.post("/api/auth/2fa/toggle", requireAuth, async (req, res) => {
    try {
      const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
      await storage.updateTutor(req.session.tutorId!, { twoFactorEnabled: enabled } as any);
      res.json({ success: true, twoFactorEnabled: enabled });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // GET /api/auth/verify-email?token=xxx - Подтверждение email (public)
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const token = String(req.query.token || "");
      if (!token) return res.status(400).json({ error: "Токен не указан" });
      const vt = await storage.getEmailVerificationToken(token);
      if (!vt) return res.status(400).json({ error: "Недействительная ссылка" });
      if (vt.usedAt) return res.status(400).json({ error: "Ссылка уже использована" });
      if (new Date(vt.expiresAt) < new Date()) return res.status(400).json({ error: "Срок действия истёк" });
      await storage.updateTutor(vt.tutorId, { emailVerified: true } as any);
      await storage.markEmailVerificationTokenUsed(vt.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/auth/send-verification - Переотправить письмо подтверждения (auth required)
  app.post("/api/auth/send-verification", requireAuth, async (req, res) => {
    try {
      const tutor = await storage.getTutor(req.session.tutorId!);
      if (!tutor) return res.status(404).json({ error: "Не найдено" });
      if ((tutor as any).emailVerified) return res.json({ success: true, alreadyVerified: true });

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.createEmailVerificationToken(tutor.id, token, expiresAt);

      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpPort = process.env.SMTP_PORT || "465";
      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost, port: parseInt(smtpPort), secure: smtpPort === "465",
          auth: { user: smtpUser, pass: smtpPass }, tls: { rejectUnauthorized: false },
        });
        const verifyUrl = `${req.protocol}://${req.get("host")}/verify-email?token=${token}`;
        await transporter.sendMail({
          from: process.env.SMTP_FROM || smtpUser,
          to: tutor.email,
          subject: "Подтверждение email — Твой Вектор",
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2>Подтверждение email</h2>
            <p>Здравствуйте, ${tutor.name}!</p>
            <p>Для подтверждения email перейдите по ссылке:</p>
            <p><a href="${verifyUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Подтвердить</a></p>
            <p>Ссылка действительна 24 часа.</p>
          </div>`,
        });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // GET /api/referrals/me - Мой реферальный код + статистика
  app.get("/api/referrals/me", requireAuth, async (req, res) => {
    try {
      const tutor = await storage.getTutor(req.session.tutorId!);
      if (!tutor) return res.status(404).json({ error: "Не найдено" });
      const referred = await storage.getReferredTutors(tutor.id);
      res.json({
        referralCode: (tutor as any).referralCode || null,
        totalReferred: referred.length,
        activeReferred: referred.filter((t: any) => t.subscription && t.subscription !== "free").length,
        referred: referred.map((t: any) => ({
          id: t.id, name: t.name, email: t.email,
          subscription: t.subscription,
          createdAt: t.createdAt,
        })),
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // GET /api/calendar/url - Личная ссылка для подписки в Google/Apple/Outlook
  app.get("/api/calendar/url", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const token = generateCalendarToken(tutorId);
      const proto = req.get("x-forwarded-proto") || req.protocol;
      const host = req.get("host");
      const url = `${proto}://${host}/api/calendar/ics/${token}`;
      const webcalUrl = `webcal://${host}/api/calendar/ics/${token}`;
      res.json({ url, webcalUrl });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // GET /api/calendar/ics/:token - iCal-фид (публичный, токен-защищённый)
  app.get("/api/calendar/ics/:token", async (req, res) => {
    try {
      const tutorId = verifyCalendarToken(req.params.token);
      if (!tutorId) return res.status(401).type("text/plain").send("Invalid token");
      const [tutor, lessons, students] = await Promise.all([
        storage.getTutor(tutorId),
        storage.getLessonsByTutorId(tutorId, 1000),
        storage.getStudentsByTutorId(tutorId),
      ]);
      if (!tutor) return res.status(404).type("text/plain").send("Not found");
      const ics = buildICalendar(tutor, lessons, students);
      res.set({
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="tvoy-vector-${tutorId.slice(0, 8)}.ics"`,
        "Cache-Control": "private, max-age=300",
      });
      res.send(ics);
    } catch (e: any) {
      res.status(500).type("text/plain").send(e.message);
    }
  });

  // ─── Серверный CSV-экспорт ──────────────────────────
  function csvEscape(v: any): string {
    if (v === null || v === undefined) return "";
    let s = typeof v === "string" ? v : String(v);
    // Защита от формул в Excel/Sheets (CSV-injection)
    if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  function toCsv(headers: string[], rows: any[][]): string {
    const lines = [headers.map(csvEscape).join(",")];
    for (const r of rows) lines.push(r.map(csvEscape).join(","));
    return "\uFEFF" + lines.join("\n");
  }
  function sendCsv(res: any, name: string, body: string) {
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    });
    res.send(body);
  }

  app.get("/api/export/students.csv", requireAuth, async (req, res) => {
    try {
      const students = await storage.getStudentsByTutorId(req.session.tutorId!);
      const csv = toCsv(
        ["Имя", "Предмет", "Класс", "Цель", "Цена/занятие", "Email", "Телефон", "Баланс", "Статус"],
        students.map((s: any) => [s.name, s.subject, s.grade, s.goal, s.pricePerLesson, s.email || "", s.phone || "", s.balance ?? 0, s.status || "active"]),
      );
      sendCsv(res, `students-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/export/lessons.csv", requireAuth, async (req, res) => {
    try {
      const [lessons, students] = await Promise.all([
        storage.getLessonsByTutorId(req.session.tutorId!, 100000),
        storage.getStudentsByTutorId(req.session.tutorId!),
      ]);
      const sm = new Map(students.map((s: any) => [s.id, s.name]));
      const csv = toCsv(
        ["Дата", "Ученик", "Тема", "Длительность (мин)", "Статус", "Стоимость"],
        lessons.map((l: any) => [
          new Date(l.scheduledAt).toLocaleString("ru-RU"),
          sm.get(l.studentId) || "—",
          l.topic || "",
          l.durationMinutes,
          l.status,
          l.cost ?? "",
        ]),
      );
      sendCsv(res, `lessons-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/export/payments.csv", requireAuth, async (req, res) => {
    try {
      const [payments, students] = await Promise.all([
        storage.getPaymentsByTutorId(req.session.tutorId!, 100000),
        storage.getStudentsByTutorId(req.session.tutorId!),
      ]);
      const sm = new Map(students.map((s: any) => [s.id, s.name]));
      const csv = toCsv(
        ["Дата", "Ученик", "Сумма", "Способ", "Комментарий"],
        payments.map((p: any) => [
          new Date(p.createdAt).toLocaleString("ru-RU"),
          sm.get(p.studentId) || "—",
          p.amount,
          p.method || "",
          p.comment || "",
        ]),
      );
      sendCsv(res, `payments-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/auth/me - Получить текущего пользователя
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.tutorId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const tutor = await storage.getTutor(req.session.tutorId);
    if (!tutor) {
      return res.status(404).json({ error: "Tutor not found" });
    }

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
      publicExperience: (tutor as any).publicExperience ?? null,
      publicEducation: (tutor as any).publicEducation ?? null,
      publicWhatsapp: (tutor as any).publicWhatsapp ?? null,
      publicVk: (tutor as any).publicVk ?? null,
      publicInstagram: (tutor as any).publicInstagram ?? null,
      publicAchievements: (tutor as any).publicAchievements ?? null,
      publicVideoUrl: (tutor as any).publicVideoUrl ?? null,
      publicSubjectInfo: (tutor as any).publicSubjectInfo ?? null,
      publicColor: (tutor as any).publicColor ?? "violet",
      publicHidePrice: (tutor as any).publicHidePrice ?? false,
      avatar: (tutor as any).avatar ?? null,
      scheduleStart: (tutor as any).scheduleStart ?? 8,
      scheduleEnd: (tutor as any).scheduleEnd ?? 22,
    });
  });

  // PATCH /api/profile - Обновить свой профиль
  app.patch("/api/profile", requireAuth, async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      subjects: z.array(z.string()).optional(),
      basePrice: z.number().min(0).optional(),
      timezone: z.string().optional(),
      publicSlug: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/).optional().nullable(),
      publicBio: z.string().max(2000).optional().nullable(),
      publicPhone: z.string().max(20).optional().nullable(),
      publicTelegram: z.string().max(50).optional().nullable(),
      isPublicProfile: z.boolean().optional(),
      publicExperience: z.string().max(100).optional().nullable(),
      publicEducation: z.string().max(300).optional().nullable(),
      publicWhatsapp: z.string().max(30).optional().nullable(),
      publicVk: z.string().max(100).optional().nullable(),
      publicInstagram: z.string().max(50).optional().nullable(),
      publicAchievements: z.string().max(2000).optional().nullable(),
      publicVideoUrl: z.string().max(300).optional().nullable(),
      publicSubjectInfo: z.string().max(1000).optional().nullable(),
      publicColor: z.string().max(30).optional().nullable(),
      publicHidePrice: z.boolean().optional(),
      scheduleStart: z.number().int().min(0).max(23).optional(),
      scheduleEnd: z.number().int().min(1).max(24).optional(),
    });

    try {
      const data = schema.parse(req.body);
      const updates: any = {};
      
      if (data.name) updates.name = data.name;
      if (data.subjects) updates.subjects = data.subjects;
      if (data.basePrice !== undefined) updates.basePrice = data.basePrice;
      if (data.timezone) updates.timezone = data.timezone;
      if (data.publicSlug !== undefined) updates.publicSlug = data.publicSlug;
      if (data.publicBio !== undefined) updates.publicBio = data.publicBio;
      if (data.publicPhone !== undefined) updates.publicPhone = data.publicPhone;
      if (data.publicTelegram !== undefined) updates.publicTelegram = data.publicTelegram;
      if (data.isPublicProfile !== undefined) updates.isPublicProfile = data.isPublicProfile;
      if (data.publicExperience !== undefined) updates.publicExperience = data.publicExperience;
      if (data.publicEducation !== undefined) updates.publicEducation = data.publicEducation;
      if (data.publicWhatsapp !== undefined) updates.publicWhatsapp = data.publicWhatsapp;
      if (data.publicVk !== undefined) updates.publicVk = data.publicVk;
      if (data.publicInstagram !== undefined) updates.publicInstagram = data.publicInstagram;
      if (data.publicAchievements !== undefined) updates.publicAchievements = data.publicAchievements;
      if (data.publicVideoUrl !== undefined) updates.publicVideoUrl = data.publicVideoUrl;
      if (data.publicSubjectInfo !== undefined) updates.publicSubjectInfo = data.publicSubjectInfo;
      if (data.publicColor !== undefined) updates.publicColor = data.publicColor;
      if (data.publicHidePrice !== undefined) updates.publicHidePrice = data.publicHidePrice;
      if (data.scheduleStart !== undefined) updates.scheduleStart = data.scheduleStart;
      if (data.scheduleEnd !== undefined) updates.scheduleEnd = data.scheduleEnd;

      const updated = await storage.updateTutor(req.session.tutorId!, updates);
      if (!updated) return res.status(404).json({ error: "Репетитор не найден" });
      const { password: _pw, ...safe } = updated as any;
      res.json(safe);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      if (error?.code === '23505' && error?.constraint?.includes('public_slug')) {
        return res.status(409).json({ error: "Этот адрес профиля уже занят" });
      }
      res.status(500).json({ error: error.message || "Ошибка сохранения" });
    }
  });

  // GET /api/tutor/link-settings - Получить настройки ссылок
  app.get("/api/tutor/link-settings", requireAuth, async (req, res) => {
    try {
      const tutor = await storage.getTutor(req.session.tutorId!);
      if (!tutor) return res.status(404).json({ error: "Репетитор не найден" });
      const defaults = { showBbb: true, showExternalConf: true, showInternalBoard: true, showExternalBoard: true };
      res.json({ ...defaults, ...(tutor.linkSettings as object || {}) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/tutor/link-settings - Обновить настройки ссылок
  app.patch("/api/tutor/link-settings", requireAuth, async (req, res) => {
    const schema = z.object({
      showBbb: z.boolean().optional(),
      showExternalConf: z.boolean().optional(),
      showInternalBoard: z.boolean().optional(),
      showExternalBoard: z.boolean().optional(),
    });
    try {
      const data = schema.parse(req.body);
      const tutor = await storage.getTutor(req.session.tutorId!);
      if (!tutor) return res.status(404).json({ error: "Репетитор не найден" });
      const current = (tutor.linkSettings as object) || {};
      const updated = { ...current, ...data };
      await storage.updateTutor(req.session.tutorId!, { linkSettings: updated } as any);
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid data" });
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/public/tutor/:slug - Публичный профиль репетитора
  app.get("/api/public/tutor/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
        return res.status(404).json({ error: "Профиль не найден" });
      }
      const tutor = await storage.getTutorBySlug(slug);
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
        experience: (tutor as any).publicExperience ?? null,
        education: (tutor as any).publicEducation ?? null,
        whatsapp: (tutor as any).publicWhatsapp ?? null,
        vk: (tutor as any).publicVk ?? null,
        instagram: (tutor as any).publicInstagram ?? null,
        achievements: (tutor as any).publicAchievements ?? null,
        videoUrl: (tutor as any).publicVideoUrl ?? null,
        subjectInfo: (tutor as any).publicSubjectInfo ?? null,
        color: (tutor as any).publicColor ?? "violet",
        hidePrice: (tutor as any).publicHidePrice ?? false,
        avatar: (tutor as any).avatar ?? null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── ОТЗЫВЫ ────────────────────────────────────────────
  // POST /api/public/tutor/:slug/reviews — оставить отзыв (без авторизации)
  app.post("/api/public/tutor/:slug/reviews", async (req, res) => {
    try {
      const slug = req.params.slug;
      if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
        return res.status(404).json({ error: "Профиль не найден" });
      }
      const tutor = await storage.getTutorBySlug(slug);
      if (!tutor || !tutor.isPublicProfile) {
        return res.status(404).json({ error: "Профиль не найден" });
      }
      const schema = z.object({
        authorName: z.string().trim().min(2).max(80),
        authorContact: z.string().trim().max(120).optional().nullable(),
        rating: z.number().int().min(1).max(5),
        text: z.string().trim().min(10).max(2000),
      });
      const data = schema.parse(req.body);
      const review = await storage.createReview({
        tutorId: tutor.id,
        authorName: data.authorName,
        authorContact: data.authorContact || null,
        rating: data.rating,
        text: data.text,
      });
      // Не блокируем — пробуем уведомить репетитора
      storage.createNotification?.({
        tutorId: tutor.id,
        type: "review_pending",
        title: "Новый отзыв",
        message: `${data.authorName} оставил отзыв (${data.rating}★). Проверьте в настройках публичной страницы.`,
        relatedId: review.id,
        isRead: false,
      } as any).catch(() => {});
      res.status(201).json({ success: true, message: "Спасибо! Отзыв появится после модерации." });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Проверьте поля формы" });
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/public/tutor/:slug/reviews — одобренные отзывы (публично)
  app.get("/api/public/tutor/:slug/reviews", async (req, res) => {
    try {
      const slug = req.params.slug;
      if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
        return res.status(404).json({ error: "Профиль не найден" });
      }
      const tutor = await storage.getTutorBySlug(slug);
      if (!tutor || !tutor.isPublicProfile) return res.json({ reviews: [], avgRating: 0, count: 0 });
      const reviews = await storage.getApprovedReviews(tutor.id);
      const count = reviews.length;
      const avg = count > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;
      res.json({ reviews, avgRating: Math.round(avg * 10) / 10, count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/reviews — все отзывы текущего репетитора (включая ожидающие)
  app.get("/api/reviews", requireAuth, async (req, res) => {
    try {
      const reviews = await storage.getAllReviews(req.session.tutorId!);
      res.json(reviews);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/reviews/:id — одобрить/скрыть
  app.patch("/api/reviews/:id", requireAuth, async (req, res) => {
    try {
      const approved = req.body?.isApproved === true;
      const r = await storage.setReviewApproval(req.params.id, req.session.tutorId!, approved);
      if (!r) return res.status(404).json({ error: "Отзыв не найден" });
      res.json(r);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/reviews/:id
  app.delete("/api/reviews/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteReview(req.params.id, req.session.tutorId!);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ======= STUDENT SELF-REGISTRATION (заявки) =======

  // GET /api/public/catalog — список репетиторов с включённым публичным профилем
  app.get("/api/public/catalog", publicLimiter, async (req, res) => {
    try {
      const subject = (req.query.subject as string || "").trim();
      const all = await storage.getAllTutors();
      const visible = all.filter(t =>
        t.isPublicProfile && t.publicSlug && !t.isBlocked && t.emailVerified
      );
      const filtered = subject
        ? visible.filter(t => (t.subjects || []).some(s => s.toLowerCase().includes(subject.toLowerCase())))
        : visible;
      const items = filtered.map(t => ({
        slug: t.publicSlug,
        name: t.name,
        subjects: t.subjects || [],
        basePrice: t.publicHidePrice ? null : t.basePrice,
        bio: (t.publicBio || "").slice(0, 200),
        experience: t.publicExperience || null,
        education: t.publicEducation || null,
        color: t.publicColor || "violet",
        avatar: (t as any).avatar || null,
      }));
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/public/tutor/:slug/apply — заявка ученика на занятия
  app.post("/api/public/tutor/:slug/apply", publicLimiter, async (req, res) => {
    try {
      const tutor = await storage.getTutorBySlug(req.params.slug);
      if (!tutor || !tutor.isPublicProfile || tutor.isBlocked) {
        return res.status(404).json({ error: "Репетитор не найден" });
      }
      const schema = z.object({
        name: z.string().trim().min(2).max(100),
        contact: z.string().trim().min(3).max(150),
        subject: z.string().trim().max(80).optional().nullable(),
        grade: z.string().trim().max(50).optional().nullable(),
        goal: z.string().trim().max(200).optional().nullable(),
        message: z.string().trim().max(2000).optional().nullable(),
      });
      const data = schema.parse(req.body);

      const app = await storage.createStudentApplication({
        tutorId: tutor.id,
        name: data.name,
        contact: data.contact,
        subject: data.subject || null,
        grade: data.grade || null,
        goal: data.goal || null,
        message: data.message || null,
      });

      // Уведомление в приложении
      await storage.createNotification({
        tutorId: tutor.id,
        type: 'application',
        title: 'Новая заявка от ученика',
        message: `${data.name} хочет заниматься${data.subject ? ` (${data.subject})` : ''}`,
        relatedId: app.id,
        isRead: false,
        scheduledFor: null,
      });

      // Телеграм-оповещение (HTML-экранирование пользовательских данных)
      try {
        const e = escapeHtml;
        const lines = [
          `📩 <b>Новая заявка от ученика</b>`,
          `Имя: ${e(data.name)}`,
          `Контакт: ${e(data.contact)}`,
          data.subject ? `Предмет: ${e(data.subject)}` : null,
          data.grade ? `Класс: ${e(data.grade)}` : null,
          data.goal ? `Цель: ${e(data.goal)}` : null,
          data.message ? `\n${e(data.message)}` : null,
        ].filter(Boolean).join('\n');
        botManager.sendToTutor(tutor.id, lines).catch(() => {});
      } catch { /* non-critical */ }

      res.json({ ok: true });
    } catch (error: any) {
      if (error?.name === 'ZodError') return res.status(400).json({ error: "Неверные данные" });
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/applications — список заявок репетитора
  app.get("/api/applications", requireAuth, async (req, res) => {
    try {
      const status = (req.query.status as string) || undefined;
      const apps = await storage.getStudentApplicationsByTutor(req.session.tutorId!, status);
      res.json(apps);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/applications/pending-count — бейдж для сайдбара
  app.get("/api/applications/pending-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.getPendingApplicationsCountByTutor(req.session.tutorId!);
      res.json({ count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/applications/:id/accept — принять заявку и создать ученика
  app.post("/api/applications/:id/accept", requireEmailVerified, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const result = await withTutorLock(tutorId, async () => {
      const application = await storage.getStudentApplication(req.params.id);
      if (!application || application.tutorId !== tutorId) {
        return { status: 404, body: { error: "Заявка не найдена" } };
      }
      if (application.status === 'accepted' || application.status === 'rejected') {
        return { status: 400, body: { error: "Заявка уже обработана" } };
      }

      const [tutor, activeCount] = await Promise.all([
        storage.getTutor(tutorId),
        storage.countActiveStudents(tutorId),
      ]);
      if (!tutor) return { status: 404, body: { error: "Репетитор не найден" } };

      const tier = (tutor.subscription || "free") as keyof typeof SUBSCRIPTION_LIMITS;
      const limits = SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.free;
      const maxStudents = (limits.maxStudents as number) === -1
        ? Infinity
        : (limits.maxStudents as number || 5) + (tutor.extraStudents || 0);
      if (activeCount >= maxStudents) {
        return { status: 403, body: {
          error: `Достигнут лимит учеников (${maxStudents}). Купите доп. слоты или повысьте тариф.`
        }};
      }

      // Опциональный override из тела
      const body = (req.body || {}) as any;
      const subject = (body.subject || application.subject || (tutor.subjects?.[0] ?? 'Общий')).toString();
      const goal = (body.goal || application.goal || 'Подготовка').toString();
      const grade = (body.grade || application.grade || '—').toString();
      const pricePerLesson = typeof body.pricePerLesson === 'number'
        ? body.pricePerLesson
        : (tutor.basePrice || 1600);

      // Пытаемся различить email/phone/telegram в контакте
      const contact = application.contact;
      const isEmail = /\S+@\S+\.\S+/.test(contact);
      const parentContact = isEmail ? null : contact;
      const email = isEmail ? contact : null;

      const student = await storage.createStudent({
        tutorId,
        name: application.name,
        subject,
        goal,
        grade,
        pricePerLesson,
        balance: 0,
        isActive: true,
        email,
        parentContact,
        comment: application.message
          ? `Заявка через каталог: ${application.message}`
          : 'Принят через заявку с публичного профиля',
      } as any);

      await storage.updateStudentApplicationStatus(application.id, 'accepted', student.id);

      return { status: 200, body: { student } };
      });
      res.status(result.status).json(result.body);
    } catch (error: any) {
      if (error?.name === 'ZodError') return res.status(400).json({ error: "Неверные данные" });
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/applications/:id/status — переместить заявку по воронке (kanban)
  // Разрешены только смежные переходы: pending ↔ contacted ↔ trial_scheduled.
  // Терминальные accepted/rejected — через POST /accept и /reject.
  app.patch("/api/applications/:id/status", requireAuth, async (req, res) => {
    try {
      const TRANSITIONS: Record<string, string[]> = {
        pending: ['contacted'],
        contacted: ['pending', 'trial_scheduled'],
        trial_scheduled: ['contacted'],
      };
      const status = String((req.body || {}).status || '');
      const application = await storage.getStudentApplication(req.params.id);
      if (!application || application.tutorId !== req.session.tutorId!) {
        return res.status(404).json({ error: "Заявка не найдена" });
      }
      if (application.status === 'accepted' || application.status === 'rejected') {
        return res.status(400).json({ error: "Заявка уже обработана" });
      }
      const allowedNext = TRANSITIONS[application.status] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          error: `Недопустимый переход ${application.status} → ${status}. Разрешены: ${allowedNext.join(', ') || '—'}.`
        });
      }
      const updated = await storage.updateStudentApplicationStatus(application.id, status);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/applications/:id/reject — отклонить заявку
  app.post("/api/applications/:id/reject", requireAuth, async (req, res) => {
    try {
      const application = await storage.getStudentApplication(req.params.id);
      if (!application || application.tutorId !== req.session.tutorId!) {
        return res.status(404).json({ error: "Заявка не найдена" });
      }
      if (application.status === 'accepted' || application.status === 'rejected') {
        return res.status(400).json({ error: "Заявка уже обработана" });
      }
      const updated = await storage.updateStudentApplicationStatus(application.id, 'rejected');
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ======= TUTOR ROUTES (для админа) =======
  
  // GET /api/tutors - Получить всех репетиторов (админ)
  app.get("/api/tutors", requireAuth, async (req, res) => {
    const currentTutor = await storage.getTutor(req.session.tutorId!);
    if (!currentTutor?.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const tutors = await storage.getAllTutors();
    res.json(tutors.map(t => ({
      id: t.id,
      email: t.email,
      name: t.name,
      subjects: t.subjects,
      subscription: t.subscription,
      subscriptionUntil: t.subscriptionUntil,
      isAdmin: t.isAdmin,
      createdAt: t.createdAt,
    })));
  });

  // PATCH /api/tutors/:id - Обновить репетитора (админ)
  app.patch("/api/tutors/:id", requireAuth, async (req, res) => {
    const currentTutor = await storage.getTutor(req.session.tutorId!);
    if (!currentTutor?.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const schema = z.object({
      subscription: z.enum(["free", "pro", "premium"]).optional(),
      subscriptionUntil: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const updates: any = {};
    
    if (data.subscription) updates.subscription = data.subscription;
    if (data.subscriptionUntil) updates.subscriptionUntil = new Date(data.subscriptionUntil);

    const updated = await storage.updateTutor(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: "Репетитор не найден" });
    const { password: _pw, ...safe } = updated as any;
    res.json(safe);
  });

  // GET /api/admin/ai-settings - Получить настройки ИИ (админ)
  app.get("/api/admin/ai-settings", requireAuth, async (req, res) => {
    const currentTutor = await storage.getTutor(req.session.tutorId!);
    if (!currentTutor?.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const settings = await storage.getAiSettings();
    res.json(settings);
  });

  // PUT /api/admin/ai-settings - Обновить настройки ИИ (админ)
  app.put("/api/admin/ai-settings", requireAuth, async (req, res) => {
    const currentTutor = await storage.getTutor(req.session.tutorId!);
    if (!currentTutor?.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const settingsSchema = z.object({
      openai_api_key: z.string().optional(),
      deepseek_api_key: z.string().optional(),
      daily_limit_openai: z.string().optional(),
      daily_limit_deepseek: z.string().optional(),
      "daily_limit_gpt4o-mini": z.string().optional(),
      default_model: z.string().optional(),
      bbb_url: z.string().optional(),
      bbb_secret: z.string().optional(),
    });
    const data = settingsSchema.parse(req.body);
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        await storage.setAiSetting(key, value);
      }
    }
    invalidateBbbCache();
    // Если изменились BBB настройки — авто-создаём комнаты для всех учеников
    if (data.bbb_url !== undefined || data.bbb_secret !== undefined) {
      ensureConferencesForAllTutors().catch((e) => console.error("[BBB] ensureConferences failed:", e?.message || e));
    }
    const updated = await storage.getAiSettings();
    res.json(updated);
  });

  // ======= STUDENT ROUTES =======
  
  // GET /api/students - Получить учеников текущего репетитора
  app.get("/api/students", requireAuth, async (req, res) => {
    const students = await storage.getStudentsByTutorId(req.session.tutorId!);
    const studentsWithPortalAccess = students.map(s => {
      const { password, ...rest } = s as any;
      return { ...rest, hasPortalAccess: !!(s.email && password) };
    });
    res.json(studentsWithPortalAccess);
  });

  // POST /api/students - Создать ученика
  const createStudentSchema = z.object({
    name: z.string(),
    subject: z.string(),
    goal: z.string(),
    grade: z.string(),
    pricePerLesson: z.number(),
    balance: z.number().default(0),
    parentContact: z.string().optional().nullable(),
    parentLink: z.string().optional().nullable(),
    comment: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    socialLink: z.string().optional().nullable(),
    links: z.any().optional(),
    isActive: z.boolean().default(true),
    progress: z.number().default(0),
    curriculumTopic: z.string().default("Стартовая диагностика"),
    hasProgram: z.boolean().default(false),
  });

  app.post("/api/students", requireEmailVerified, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const data = createStudentSchema.parse(req.body);

      const [tutor, activeCount] = await Promise.all([
        storage.getTutor(tutorId),
        storage.countActiveStudents(tutorId),
      ]);
      if (!tutor) return res.status(404).json({ error: "Репетитор не найден" });

      const tier = (tutor.subscription || "free") as keyof typeof SUBSCRIPTION_LIMITS;
      const limits = SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.free;
      const maxStudents = (limits.maxStudents as number) === -1 ? Infinity : (limits.maxStudents as number || 5) + (tutor.extraStudents || 0);

      if (activeCount >= maxStudents) {
        return res.status(403).json({
          error: `Достигнут лимит учеников (${maxStudents}). Перейдите на более высокий тариф или купите доп. слоты.`
        });
      }

      const student = await storage.createStudent({ ...data, tutorId });

      // Авто-создание BBB конференции для нового ученика
      if (await isBbbConfigured()) {
        try {
          const meetingId = `vektor-${tutorId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
          const attendeePw = randomUUID().slice(0, 12);
          const moderatorPw = randomUUID().slice(0, 12);
          const title = `${student.name} — ${tutor.name}`;
          const result = await createBbbMeeting(meetingId, title, attendeePw, moderatorPw);
          if (result.success) {
            await storage.createConference({ tutorId, studentId: student.id, title, meetingId, attendeePw, moderatorPw, isOneTime: false });
          }
        } catch (_e) { /* некритично */ }
      }

      const { password, ...rest } = student as any;
      res.json({ ...rest, hasPortalAccess: false });
    } catch (error: any) {
      if (error?.name === 'ZodError') return res.status(400).json({ error: "Неверные данные" });
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/students/:id - Обновить ученика
  app.patch("/api/students/:id", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const student = await storage.getStudent(req.params.id);
      if (!student || student.tutorId !== tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      const schema = z.object({
        name: z.string().optional(),
        subject: z.string().optional(),
        goal: z.string().optional(),
        grade: z.string().optional(),
        pricePerLesson: z.number().optional(),
        balance: z.number().optional(),
        parentContact: z.string().optional().nullable(),
        parentLink: z.string().optional().nullable(),
        comment: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        socialLink: z.string().optional().nullable(),
        links: z.any().optional(),
        isActive: z.boolean().optional(),
        progress: z.number().optional(),
        curriculumTopic: z.string().optional(),
        birthday: z.string().optional().nullable(),
        parentReportSchedule: z.enum(['off', 'weekly', 'monthly']).optional(),
      });

      const data = schema.parse(req.body);
      const updateData: any = { ...data };
      if (data.birthday !== undefined) {
        updateData.birthday = data.birthday ? new Date(data.birthday) : null;
      }
      if (data.parentReportSchedule !== undefined) {
        updateData.parent_report_schedule = data.parentReportSchedule;
        delete updateData.parentReportSchedule;
      }

      // При архивации — отменяем все предстоящие занятия
      if (data.isActive === false && student.isActive === true) {
        const now = new Date();
        const lessons = await storage.getLessonsByStudentId(req.params.id);
        const upcoming = lessons.filter(
          l => l.status === "pending" && new Date(l.scheduledAt) > now
        );
        await Promise.all(
          upcoming.map(l => storage.updateLesson(l.id, { status: "cancelled", attendance: "missed_free" }))
        );
      }

      const updated = await storage.updateStudent(req.params.id, updateData);
      if (updated) {
        const { password, ...rest } = updated as any;
        res.json({ ...rest, hasPortalAccess: !!(updated.email && password) });
      } else {
        res.status(404).json({ error: "Ученик не найден" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /api/students/:id - Удалить ученика
  app.delete("/api/students/:id", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const student = await storage.getStudent(req.params.id);
      if (!student || student.tutorId !== tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }
      await storage.deleteStudent(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/students/:id/generate-program - Генерация программы с помощью ИИ
  app.post("/api/students/:id/generate-program", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const student = await storage.getStudent(req.params.id);
      if (!student || student.tutorId !== tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      const questionnaireSchema = z.object({
        currentLevel: z.string(),
        weakPoints: z.string(),
        strongPoints: z.string(),
        examDate: z.string().optional(),
        hoursPerWeek: z.number(),
        additionalInfo: z.string().optional(),
      });

      const questionnaire = questionnaireSchema.parse(req.body);

      const prompt = `Ты опытный репетитор по предмету "${student.subject}". 
Составь программу подготовки для ученика:
- Имя: ${student.name}
- Класс: ${student.grade}
- Цель: ${student.goal}
- Текущий уровень: ${questionnaire.currentLevel}
- Слабые стороны: ${questionnaire.weakPoints}
- Сильные стороны: ${questionnaire.strongPoints}
- Дата экзамена/цели: ${questionnaire.examDate || "не указана"}
- Часов в неделю: ${questionnaire.hoursPerWeek}
- Дополнительная информация: ${questionnaire.additionalInfo || "нет"}

Составь программу в формате JSON:
{
  "topics": [
    {
      "title": "Название темы",
      "description": "Краткое описание что изучаем",
      "lessonsNeeded": 3,
      "priority": "high|medium|low"
    }
  ],
  "totalLessons": 25,
  "estimatedWeeks": 12,
  "recommendation": "Общая рекомендация по подготовке"
}

Учитывай реальное количество часов в неделю и время до экзамена. Порядок тем должен быть логичным - от простого к сложному, с учётом зависимостей.`;

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: "Ты опытный репетитор, составляющий персональные программы подготовки. Отвечай только валидным JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      const programText = completion.choices[0]?.message?.content || "{}";
      const programData = JSON.parse(programText);
      programData.generatedAt = new Date().toISOString();
      programData.topics = (programData.topics || []).map((t: any) => ({ ...t, completed: false }));

      await storage.updateStudent(student.id, {
        hasProgram: true,
        programData,
        questionnaire,
      });

      res.json({ success: true, programData });
    } catch (error: any) {
      console.error("Error generating program:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/students/:id/program - Обновление программы вручную
  app.patch("/api/students/:id/program", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const student = await storage.getStudent(req.params.id);
      if (!student || student.tutorId !== tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      const { programData } = req.body;
      await storage.updateStudent(student.id, {
        hasProgram: true,
        programData: {
          ...programData,
          updatedAt: new Date().toISOString(),
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/students/:id/program - Удалить программу (без программы)
  app.delete("/api/students/:id/program", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const student = await storage.getStudent(req.params.id);
      if (!student || student.tutorId !== tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      await storage.updateStudent(student.id, {
        hasProgram: false,
        programData: null,
        questionnaire: null,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= AI HELPER ROUTES =======

  // POST /api/ai/generate-lesson - Генерация полного материала на урок
  app.post("/api/ai/generate-lesson", requireEmailVerified, async (req, res) => {
    try {
      const { studentId, topic } = req.body;
      const tutorId = req.session.tutorId!;
      
      const student = await storage.getStudent(studentId);
      if (!student || student.tutorId !== tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      // Определяем контекст экзамена
      const goal = student.goal || "";
      let examContext = "";
      if (goal.toLowerCase().includes("егэ")) {
        examContext = `Ученик готовится к ЕГЭ. Все задания должны соответствовать формату и сложности ЕГЭ по ${student.subject}. Включай задания, похожие на реальные задачи из ЕГЭ с номерами заданий где применимо.`;
      } else if (goal.toLowerCase().includes("огэ")) {
        examContext = `Ученик готовится к ОГЭ. Все задания должны соответствовать формату и сложности ОГЭ по ${student.subject}. Используй типичные формулировки из ОГЭ.`;
      } else if (goal.toLowerCase().includes("олимпиад")) {
        examContext = `Ученик готовится к олимпиадам. Включай нестандартные задачи повышенной сложности, требующие творческого подхода.`;
      } else {
        examContext = `Цель ученика: ${goal}. Адаптируй материал под эту цель.`;
      }

      const prompt = `Ты опытный репетитор по ${student.subject}. Создай ПОЛНЫЙ МАТЕРИАЛ НА УРОК по теме "${topic}" для ученика ${student.name} (${student.grade}).

${examContext}

Структура урока должна включать:

1. **ТЕОРИЯ** (5-10 минут объяснения):
   - Ключевые определения и понятия
   - Основные формулы с объяснением каждого элемента
   - 1-2 наглядных примера применения

2. **РАЗБОР ПРИМЕРОВ** (10-15 минут):
   - 2-3 подробно разобранных задачи с пошаговым решением
   - От простого к сложному

3. **ЗАДАНИЯ ДЛЯ ОТРАБОТКИ** (20-25 минут):
   - 5-7 задач с постепенным усложнением
   - Первые 2-3 — базовый уровень (для закрепления)
   - Следующие 2-3 — средний уровень
   - Последние 1-2 — повышенный уровень${goal.toLowerCase().includes("егэ") ? " в формате ЕГЭ" : goal.toLowerCase().includes("огэ") ? " в формате ОГЭ" : ""}

Верни JSON в формате:
{
  "topic": "${topic}",
  "theory": {
    "title": "Название раздела теории",
    "content": "Полный текст теории с формулами в LaTeX",
    "formulas": ["Список ключевых формул в LaTeX"]
  },
  "examples": [
    {
      "problem": "Условие примера",
      "solution": "Подробное пошаговое решение",
      "answer": "Ответ"
    }
  ],
  "exercises": [
    {
      "number": 1,
      "problem": "Условие задачи",
      "difficulty": "easy|medium|hard",
      "solution": "Решение",
      "answer": "Ответ",
      "hint": "Подсказка для ученика"
    }
  ],
  "summary": "Краткое резюме урока — что должен запомнить ученик"
}

ВАЖНО: Используй LaTeX для всех формул ($...$ для inline, $$...$$ для блочных). Задачи должны быть реалистичными и соответствовать уровню ${student.grade} класса.`;

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: `Ты опытный репетитор по ${student.subject}, создающий качественные учебные материалы. Отвечай только валидным JSON. Все математические формулы пиши в LaTeX синтаксисе.` },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4000,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
      res.json(result);
    } catch (error: any) {
      console.error("Error generating lesson:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/ai/generate-plan - Генерация структурированного плана занятия
  app.post("/api/ai/generate-plan", requireEmailVerified, async (req, res) => {
    try {
      const { subject, grade, topic, lessonType, duration, examType, studentId } = req.body;
      const tutorId = req.session.tutorId!;

      let studentCtx = "";
      if (studentId) {
        const student = await storage.getStudent(studentId);
        if (student && student.tutorId === tutorId) {
          studentCtx = `Ученик: ${student.name}, ${student.grade}. Цель: ${student.goal || "общее развитие"}.`;
        }
      }

      const examCtx = examType === "ЕГЭ"
        ? `Ориентация на ФОРМАТ ЕГЭ: задания части 1 (тесты) и части 2 (развёрнутые ответы). Упоминай номера заданий из КИМ ЕГЭ по ${subject}.`
        : examType === "ОГЭ"
        ? `Ориентация на ФОРМАТ ОГЭ: задания модулей ОГЭ по ${subject}. Используй типичные формулировки и структуру ОГЭ.`
        : examType === "Олимпиада"
        ? "Нестандартные задачи олимпиадного уровня, творческие и логические задания."
        : "";

      const lessonTypeRu = lessonType === "new" ? "Новая тема" : lessonType === "review" ? "Повторение и закрепление"
        : lessonType === "control" ? "Контрольная/проверочная работа"
        : lessonType === "practice" ? "Практическое занятие"
        : "Подготовка к экзамену";

      const sysPrompt = `Ты — опытный методист-репетитор по ${subject}. Составляй подробные, практичные и реалистичные планы уроков. Отвечай только валидным JSON.`;
      const userPrompt = `Составь подробный план урока на ${duration} минут.
Предмет: ${subject}
Класс/уровень: ${grade}
Тема: ${topic}
Тип занятия: ${lessonTypeRu}
${examCtx ? `Контекст экзамена: ${examCtx}` : ""}
${studentCtx ? `${studentCtx}` : ""}

Верни JSON строго в формате:
{
  "title": "Тема урока",
  "objectives": ["Цель 1", "Цель 2", "Цель 3"],
  "sections": [
    {
      "id": "s1",
      "type": "warmup|theory|practice|control|homework|reflection",
      "title": "Название этапа",
      "duration": 5,
      "content": "Подробное описание этапа: что делает учитель, что делает ученик, какие задания, вопросы, упражнения. 3-8 предложений.",
      "tasks": ["Конкретное задание 1", "Конкретное задание 2"]
    }
  ],
  "materials": ["Список дидактических материалов, ресурсов"],
  "homeworkTask": "Подробное домашнее задание с конкретными упражнениями",
  "tips": ["Методический совет 1", "Методический совет 2"]
}

Используй реалистичный тайминг (сумма duration секций = ${duration} минут).
Секций должно быть 5-8. Тип секции: warmup — разминка/актуализация, theory — теория/объяснение, practice — практика/упражнения, control — контроль/проверка, reflection — рефлексия/подведение итогов, homework — домашнее задание.
В content пиши конкретно: какие именно вопросы задать, какие задачи разобрать, как провести этот этап. Если ЕГЭ/ОГЭ — указывай номера заданий КИМ.`;

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 3000,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      res.json(result);
    } catch (error: any) {
      console.error("Error generating plan:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/ai/generate-homework - Генерация домашней работы по теме
  app.post("/api/ai/generate-homework", requireEmailVerified, async (req, res) => {
    try {
      const { studentId, topic, count = 5 } = req.body;
      const tutorId = req.session.tutorId!;
      
      const student = await storage.getStudent(studentId);
      if (!student || student.tutorId !== tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      const goal = student.goal || "";
      let examContext = "";
      if (goal.toLowerCase().includes("егэ")) {
        examContext = `Ученик готовится к ЕГЭ. Домашние задания должны быть в формате ЕГЭ.`;
      } else if (goal.toLowerCase().includes("огэ")) {
        examContext = `Ученик готовится к ОГЭ. Задания в формате ОГЭ.`;
      }

      const prompt = `Ты репетитор по ${student.subject}. Составь ДОМАШНЮЮ РАБОТУ по теме "${topic}" для ученика ${student.name} (${student.grade}).

${examContext}

Требования:
- ${count} заданий разной сложности (от простых к сложным)
- Задания должны быть понятны для самостоятельного выполнения
- Включи задачи на закрепление ключевых навыков по теме
- ${goal.toLowerCase().includes("егэ") ? "2-3 задания в формате реального ЕГЭ" : goal.toLowerCase().includes("огэ") ? "2-3 задания в формате ОГЭ" : "Разнообразные типы заданий"}

Верни JSON:
{
  "topic": "${topic}",
  "tasks": [
    {
      "number": 1,
      "problem": "Условие",
      "difficulty": "easy|medium|hard",
      "solution": "Подробное решение",
      "answer": "Ответ",
      "estimatedTime": "5 мин"
    }
  ],
  "totalTime": "Общее время на выполнение"
}

Используй LaTeX для формул ($...$ для inline).`;

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: `Ты репетитор по ${student.subject}. Отвечай только валидным JSON с LaTeX формулами.` },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 3000,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
      res.json(result);
    } catch (error: any) {
      console.error("Error generating homework:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/ai/chat - Чат с ИИ-помощником (с поддержкой изображений и формул)
  app.post("/api/ai/chat", requireEmailVerified, async (req, res) => {
    try {
      const { message, context, image } = req.body;
      const tutorId = req.session.tutorId!;
      const tutor = await storage.getTutor(tutorId);

      const systemPrompt = `Ты — умный и дружелюбный ИИ-помощник для репетитора${tutor?.name ? ` ${tutor.name}` : ""}.
Твоя задача — помогать с вопросами о методике преподавания, объяснять темы, давать советы по работе с учениками.
${tutor?.subjects?.length ? `Репетитор преподаёт: ${tutor.subjects.join(", ")}.` : ""}
${context ? `Контекст: ${context}` : ""}

Отвечай по-русски, дружелюбно и профессионально. Давай практичные советы.
Если просят объяснить тему — объясняй простым языком с примерами.
Если просят придумать задачу — создавай интересные и полезные задания.

ВАЖНО: Когда пишешь математические формулы, используй LaTeX синтаксис:
- Для inline формул используй $формула$ (одинарные доллары)
- Для блочных формул используй $$формула$$ (двойные доллары)
Примеры: $x^2 + y^2 = z^2$, $$\\int_0^1 x^2 dx = \\frac{1}{3}$$

Если пользователь прикрепил изображение с задачей — проанализируй его, реши задачу и объясни решение.`;

      // Формируем сообщение с или без изображения
      let userContent: any;
      if (image && image.startsWith("data:image")) {
        userContent = [
          { type: "text", text: message },
          { type: "image_url", image_url: { url: image } }
        ];
      } else {
        userContent = message;
      }

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        max_completion_tokens: 2000,
      });

      const response = completion.choices[0]?.message?.content || "Извините, не удалось получить ответ.";
      res.json({ response });
    } catch (error: any) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ======= TUTOR AI CHAT ROUTES (multi-chat, persistent) =======

  function getTutorOpenAIClient(apiKey?: string): OpenAI {
    return new OpenAI({ apiKey: apiKey || openaiKey() });
  }

  function getTutorDeepSeekClient(apiKey?: string): OpenAI {
    return new OpenAI({
      apiKey: apiKey || '',
      baseURL: 'https://api.deepseek.com',
    });
  }

  // POST /api/help/chat - ИИ-ассистент базы знаний (знает всю платформу)
  app.post("/api/help/chat", requireAuth, async (req, res) => {
    try {
      const { message, history = [] } = req.body;
      if (!message) return res.status(400).json({ error: "Сообщение обязательно" });

      const KB_SYSTEM = `Ты — ИИ-ассистент платформы «Твой Вектор» — CRM/LMS для репетиторов.
Ты знаешь всё о платформе и помогаешь репетиторам разобраться в её работе.
Отвечай дружелюбно, кратко и по делу. Если вопрос не касается платформы — всё равно помоги, но в конце предложи посмотреть раздел базы знаний.

=== СТРУКТУРА ПЛАТФОРМЫ ===

ГЛАВНАЯ (/)
- Дашборд: текущие занятия, следующее занятие с кнопкой войти в конференцию, быстрые действия
- Мотивация: серия занятий (streak), XP-прогресс, вехи (10/25/50/100 уроков), уроки за месяц
- Разделы: быстрый доступ ко всем разделам
- Что нового: список обновлений платформы

УЧЕНИКИ (/students)
- Карточки всех учеников с балансом (зелёный = оплата вперёд, красный = долг)
- Добавить ученика: имя, предмет, стоимость урока, контакты
- Профиль ученика: программа обучения (темы), ссылки на конференцию/доску, история платежей
- Архивирование: скрыть ученика без удаления истории
- Ссылка доступа: в профиле → «Скопировать ссылку» → отправить ученику (вход без регистрации)
- Поиск: по имени, предмету, контактам

ЗАНЯТИЯ (/lessons) и РАСПИСАНИЕ (/schedule)
- Расписание: виды «День», «Неделя», «Месяц»
- Создание занятия: ученик, дата, время, тема, повторение (по дням недели, на весь год)
- Конфликты: система предупреждает если время занято другим учеником
- Статусы: «Проведено ✓» (с оплатой), «Проведено ✗» (без списания), «Отменено», «Отмена с оплатой»
- Перенос: кнопка ⇄, визуальная сетка времён (зелёные — свободно, жёлтые — занято)
- Экспорт .ics для Google Календарь/Outlook/Apple Calendar
- Массовое добавление: таблица для нескольких учеников сразу

ФИНАНСЫ (/finance) и АНАЛИТИКА (/analytics)
- Баланс = сумма оплат − стоимость проведённых занятий
- Добавить оплату: выбрать ученика, сумму, дату, комментарий
- Долги: раздел показывает всех с отрицательным балансом
- История платежей: по каждому ученику, можно удалить ошибочный платёж
- Месячная статистика: потенциал / заработано / остаток / упущено из-за отмен

ДОМАШНИЕ ЗАДАНИЯ (/homework)
- Создать задание: ученик, текст, срок сдачи
- ИИ-генерация: нажмите «Сгенерировать», введите тему и уровень
- Статусы: «Новое», «Просматривает», «На проверке» (ученик прислал ответ), «Выполнено», «Просрочено»
- Обратная связь: комментарий с разбором ошибок → ученик видит в своём кабинете
- Оценки: от 1 до 5, видны в профиле ученика
- Счётчик непроверенных работ: на иконке «Домашки» в меню

СООБЩЕНИЯ / РАССЫЛКИ (/chat)
- Массовая рассылка: выбрать всех или конкретных учеников по фильтру
- Фильтры получателей: предмет, активность, баланс (удобно для напоминаний должникам)
- Личные сообщения: из профиля ученика или рассылок
- Ученик отвечает из своего кабинета в разделе «Чат»

ЗАДАЧНИК (/tasks)
- База заданий: создать задание с условием, решением, объяснением
- Назначить ученику: прямо из задачника
- Категории и теги для организации

ИИ-АССИСТЕНТ (/ai)
- Генерация заданий: введите тему, уровень, тип задания → готово за 10–20 сек
- Планы уроков: попросите составить план урока по теме
- Проверка работ: вставьте ответ ученика → ИИ проверит и объяснит ошибки
- История чатов: все разговоры сохраняются
- Поддерживает изображения: можно прикрепить фото задачи

ВИДЕОКОНФЕРЕНЦИИ BBB (/bbb)
- Создать конференцию: «+», название, привязать к ученику (по желанию)
- Постоянные конференции: по фиксированной ссылке, для регулярных занятий
- Ссылка ученику: кнопка «Ссылка» → скопировать и отправить
- Войти: синяя кнопка «Войти» в разделе или на главной
- Для работы BBB нужен свой сервер (URL + секрет в настройках)

ДОСКИ (/boards)
- Совместная доска для работы с учеником в режиме реального времени
- Открыть из раздела «Доски» или кнопки в шапке «Доски»

ТАРИФЫ (/subscription)
- Бесплатный: до 5 учеников, базовые функции
- Старт: до 15 учеников
- Про: до 40 учеников + все функции
- Безлимит: неограниченно учеников
- Дополнительные пакеты ИИ-токенов, дополнительные места для учеников

ПРОФИЛЬ (/profile)
- Настройки: имя, предметы, часовой пояс, контакты
- Публичная страница репетитора (/t/slug)
- Смена пароля
- BBB-настройки (URL сервера и секрет)

БАЗА ЗНАНИЙ (/help)
- Руководство: 9 разделов с советами
- Часто задаваемые вопросы (FAQ)
- Обращения в поддержку
- ИИ-ассистент (ты сам!) для быстрых ответов

=== ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ ===
Q: Как ученик входит в кабинет?
A: Профиль ученика → «Скопировать ссылку» → отправить ученику. Он открывает ссылку без регистрации. Или создайте ему логин/пароль.

Q: Почему баланс отрицательный?
A: Долг: проведено занятий больше чем оплачено. Финансы → ученик → «Добавить оплату».

Q: Как создать расписание на весь семестр?
A: Расписание → «+Добавить» → ученик, время → «Повторение» → выбрать дни недели → «На весь год».

Q: Как ученик видит домашнее задание?
A: После создания в «Домашки» — ученик сразу видит в своём кабинете.

Q: Можно ли использовать Zoom вместо BBB?
A: Да. Профиль ученика → поле «Конференция» → вставьте ссылку Zoom. Кнопка появится в кабинете ученика.

Q: Что значит «Проведено ✗»?
A: Занятие прошло, но оплата НЕ списывается. Для пробных/бонусных уроков.

Q: Как перенести одно занятие из серии?
A: Кнопка ⇄ рядом с занятием → выбрать новое время в сетке (зелёные = свободно).

Отвечай по-русски. Будь конкретным и практичным.`;

      const messages = [
        { role: "system", content: KB_SYSTEM },
        ...history.slice(-10),
        { role: "user", content: message },
      ];

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages as any,
        max_completion_tokens: 800,
      });

      const reply = completion.choices[0]?.message?.content || "Извините, не смог ответить.";
      res.json({ reply });
    } catch (error: any) {
      console.error("Help chat error:", error);
      res.status(500).json({ error: error.message || "Ошибка ИИ-ассистента" });
    }
  });

  // GET /api/ai/config - Доступные модели и лимиты для репетитора
  app.get("/api/ai/config", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const settings = await storage.getAiSettings();
      const hasOpenAI = !!(settings.openai_api_key || openaiKey());
      const hasDeepSeek = !!settings.deepseek_api_key;
      const packageBalance = await storage.getAiPackageBalance(tutorId, 'tutor');

      const models: any[] = [];
      if (hasOpenAI) {
        const usage = await storage.getTutorAiUsageToday(tutorId, 'openai');
        const limit = parseInt(settings.daily_limit_openai || '50') * 3;
        const available = usage < limit || packageBalance > 0;
        models.push({ id: 'openai', name: 'GPT-4o', usage, limit, available });

        const usageMini = await storage.getTutorAiUsageToday(tutorId, 'gpt4o-mini');
        const limitMini = parseInt(settings['daily_limit_gpt4o-mini'] || '100') * 3;
        const availableMini = usageMini < limitMini || packageBalance > 0;
        models.push({ id: 'gpt4o-mini', name: 'GPT-4o mini', usage: usageMini, limit: limitMini, available: availableMini });
      }
      if (hasDeepSeek) {
        const usage = await storage.getTutorAiUsageToday(tutorId, 'deepseek');
        const limit = parseInt(settings.daily_limit_deepseek || '100') * 3;
        const available = usage < limit || packageBalance > 0;
        models.push({ id: 'deepseek', name: 'DeepSeek', usage, limit, available });
      }

      const preferredDefault = settings.default_model || 'openai';
      const validDefault = models.find(m => m.id === preferredDefault && m.available)
        || models.find(m => m.available)
        || models[0];

      res.json({ models, defaultModel: validDefault?.id || 'openai', packageBalance });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/ai-packages/balance - Баланс пакетов ИИ для репетитора
  app.get("/api/ai-packages/balance", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const balance = await storage.getAiPackageBalance(tutorId, 'tutor');
      const packages = await storage.getAiPackages(tutorId, 'tutor');
      const totalPurchased = packages.reduce((sum, p) => sum + p.credits, 0);
      const totalUsed = packages.reduce((sum, p) => sum + p.usedCredits, 0);
      res.json({ balance, totalPurchased, totalUsed, packages });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/ai-packages/purchase - Создать платёж ЮКассы за пакет ИИ
  app.post("/api/ai-packages/purchase", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        credits: z.number().min(1),
        pricePaid: z.number().min(0),
        promoCode: z.string().optional().nullable(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Неверные данные" });
      const { credits, pricePaid, promoCode } = parsed.data;

      const validOption = AI_PACKAGE_OPTIONS.find(o => o.credits === credits && o.price === pricePaid);
      if (!validOption) return res.status(400).json({ error: "Недопустимый пакет" });

      if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
        return res.status(400).json({ error: "ЮКасса не настроена" });
      }

      const tutorId = req.session.tutorId!;

      // Применить промокод (если задан) — пересчитываем итоговую сумму
      let finalPrice = validOption.price;
      let appliedPromoId: string | null = null;
      if (promoCode && promoCode.trim()) {
        const promo = await storage.getPromoCodeByCode(promoCode.trim());
        if (!promo) return res.status(400).json({ error: "Промокод не найден" });
        if (promo.scope !== 'all' && promo.scope !== 'ai_packages') {
          return res.status(400).json({ error: "Промокод не применим к ИИ-пакетам" });
        }
        if (await storage.hasUserRedeemed(promo.id, tutorId)) {
          return res.status(400).json({ error: "Вы уже использовали этот промокод" });
        }
        const amountKop = Math.round(validOption.price * 100);
        if (!promo.isActive) return res.status(400).json({ error: "Промокод деактивирован" });
        if (promo.validFrom && new Date(promo.validFrom).getTime() > Date.now()) {
          return res.status(400).json({ error: "Промокод ещё не действует" });
        }
        if (promo.validUntil && new Date(promo.validUntil).getTime() < Date.now()) {
          return res.status(400).json({ error: "Срок действия промокода истёк" });
        }
        if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
          return res.status(400).json({ error: "Лимит использований промокода исчерпан" });
        }
        let discountKop = 0;
        if (promo.discountType === 'percent') {
          const pct = Math.max(0, Math.min(100, Number(promo.discountValue) || 0));
          discountKop = Math.floor((amountKop * pct) / 100);
        } else {
          discountKop = Math.min(amountKop, Math.floor(Number(promo.discountValue) * 100));
        }
        finalPrice = Math.max(1, (amountKop - discountKop) / 100); // мин 1 ₽ для ЮКассы
        appliedPromoId = promo.id;
      }

      const yookassaInstance = new YooKassa({
        shopId: process.env.YOOKASSA_SHOP_ID,
        secretKey: process.env.YOOKASSA_SECRET_KEY,
      });

      const origin = appUrl();
      const idempotenceKey = randomUUID();
      const payment = await yookassaInstance.createPayment({
        amount: { value: finalPrice.toFixed(2), currency: "RUB" },
        confirmation: {
          type: "redirect",
          return_url: `${origin}/ai?purchase=success`,
        },
        description: `Пакет ИИ: ${validOption.credits} запросов${appliedPromoId ? ` (промокод)` : ''}`,
        capture: true,
        metadata: {
          type: "ai_package",
          tutorId,
          credits: String(validOption.credits),
          pricePaid: String(finalPrice),
          originalPrice: String(validOption.price),
          promoCodeId: appliedPromoId || '',
        },
      }, idempotenceKey);

      res.json({
        confirmationUrl: payment.confirmation?.confirmation_url,
        yookassaPaymentId: payment.id,
      });
    } catch (error: any) {
      console.error("AI package purchase error:", error);
      res.status(500).json({ error: error.message || "Ошибка создания платежа" });
    }
  });

  // POST /api/extra-students/purchase - Создать платёж ЮКассы за доп. учеников
  app.post("/api/extra-students/purchase", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        count: z.number().int().min(1).max(50),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Неверные данные" });
      const { count } = parsed.data;

      const tutorId = req.session.tutorId!;
      const tutor = await storage.getTutor(tutorId);
      if (!tutor) return res.status(404).json({ error: "Репетитор не найден" });

      const tier = (tutor.subscription || "free") as keyof typeof SUBSCRIPTION_LIMITS;
      const limits = SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.free;
      if (!limits || tier === "free") {
        return res.status(403).json({ error: "Покупка доп. учеников недоступна на тарифе Старт" });
      }

      const pricePerStudent = (limits as any).extraStudentPrice ?? 59;
      const currentExtra = tutor.extraStudents || 0;
      const maxExtra = 50;
      if (currentExtra + count > maxExtra) {
        return res.status(400).json({ error: `Максимум ${maxExtra} дополнительных учеников` });
      }

      if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
        return res.status(400).json({ error: "ЮКасса не настроена" });
      }

      const total = pricePerStudent * count;
      const yookassaInstance = new YooKassa({
        shopId: process.env.YOOKASSA_SHOP_ID,
        secretKey: process.env.YOOKASSA_SECRET_KEY,
      });
      const origin = appUrl();
      const idempotenceKey = randomUUID();
      const payment = await yookassaInstance.createPayment({
        amount: { value: total.toFixed(2), currency: "RUB" },
        confirmation: {
          type: "redirect",
          return_url: `${origin}/subscription?purchase=success`,
        },
        description: `Дополнительные ученики: +${count}`,
        capture: true,
        metadata: {
          type: "extra_students",
          tutorId,
          count: String(count),
          pricePerStudent: String(pricePerStudent),
        },
      }, idempotenceKey);

      res.json({
        confirmationUrl: payment.confirmation?.confirmation_url,
        yookassaPaymentId: payment.id,
        amount: total,
        pricePerStudent,
      });
    } catch (error: any) {
      console.error("Extra students purchase error:", error);
      res.status(500).json({ error: error.message || "Ошибка создания платежа" });
    }
  });

  // GET /api/student-slots - Информация о слотах учеников
  app.get("/api/student-slots", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const tutor = await storage.getTutor(tutorId);
      if (!tutor) return res.status(404).json({ error: "Репетитор не найден" });

      const { SUBSCRIPTION_LIMITS } = await import("@shared/schema");
      const tier = (tutor.subscription || 'free') as keyof typeof SUBSCRIPTION_LIMITS;
      const limits = SUBSCRIPTION_LIMITS[tier];
      const students = await storage.getStudentsByTutorId(tutorId);
      const activeStudents = students.filter(s => s.isActive).length;
      const extraStudents = tutor.extraStudents || 0;
      const maxStudents = (limits.maxStudents as number) === -1 ? -1 : (limits.maxStudents as number) + extraStudents;

      res.json({
        tier,
        tierName: limits.name,
        activeStudents,
        maxStudents,
        baseSlots: limits.maxStudents,
        extraSlots: extraStudents,
        extraStudentPrice: limits.extraStudentPrice,
        isAtLimit: maxStudents !== -1 && activeStudents >= maxStudents,
        isNearLimit: maxStudents !== -1 && activeStudents >= maxStudents - 2,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/ai/chats - Список чатов репетитора
  app.get("/api/ai/chats", requireAuth, async (req, res) => {
    try {
      const chats = await storage.getTutorAiChatsByTutorId(req.session.tutorId!);
      res.json(chats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/ai/chats - Создать чат
  app.post("/api/ai/chats", requireEmailVerified, async (req, res) => {
    try {
      const { title, context } = req.body;
      const chat = await storage.createTutorAiChat({
        tutorId: req.session.tutorId!,
        title: title || "Новый чат",
        context: context || null,
      });
      res.json(chat);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/ai/chats/:id - Удалить чат
  app.delete("/api/ai/chats/:id", requireAuth, async (req, res) => {
    try {
      const chat = await storage.getTutorAiChat(req.params.id);
      if (!chat || chat.tutorId !== req.session.tutorId!) {
        return res.status(404).json({ error: "Чат не найден" });
      }
      await storage.deleteTutorAiChat(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/ai/chats/:id/messages - Сообщения чата
  app.get("/api/ai/chats/:id/messages", requireAuth, async (req, res) => {
    try {
      const chat = await storage.getTutorAiChat(req.params.id);
      if (!chat || chat.tutorId !== req.session.tutorId!) {
        return res.status(404).json({ error: "Чат не найден" });
      }
      const messages = await storage.getTutorAiChatMessagesByChatId(req.params.id, 100);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/ai/chats/:id/messages - Отправить сообщение
  app.post("/api/ai/chats/:id/messages", requireEmailVerified, async (req, res) => {
    try {
      const bodySchema = z.object({
        message: z.string().min(1),
        imageBase64: z.string().optional(),
        model: z.enum(['openai', 'deepseek', 'gpt4o-mini']).optional(),
        studentContext: z.string().optional(),
      });

      const { message, imageBase64, model: requestedModel, studentContext } = bodySchema.parse(req.body);
      const tutorId = req.session.tutorId!;
      const chatId = req.params.id;

      const chat = await storage.getTutorAiChat(chatId);
      if (!chat || chat.tutorId !== tutorId) {
        return res.status(404).json({ error: "Чат не найден" });
      }

      const tutor = await storage.getTutor(tutorId);
      const settings = await storage.getAiSettings();
      let selectedModel = requestedModel || settings.default_model || 'openai';

      const hasOpenAI = !!(settings.openai_api_key || openaiKey());
      const hasDeepSeek = !!settings.deepseek_api_key;

      if ((selectedModel === 'openai' || selectedModel === 'gpt4o-mini') && !hasOpenAI) {
        if (hasDeepSeek) selectedModel = 'deepseek';
        else return res.status(400).json({ error: "ИИ-модель недоступна." });
      }
      if (selectedModel === 'deepseek' && !hasDeepSeek) {
        if (hasOpenAI) selectedModel = 'openai';
        else return res.status(400).json({ error: "ИИ-модель недоступна." });
      }

      const dailyLimit = parseInt(settings[`daily_limit_${selectedModel}`] || '50') * 3;
      const currentUsage = await storage.getTutorAiUsageToday(tutorId, selectedModel);
      let usingPackage = false;
      if (currentUsage >= dailyLimit) {
        const packageBalance = await storage.getAiPackageBalance(tutorId, 'tutor');
        if (packageBalance > 0) {
          usingPackage = true;
        } else {
          return res.status(429).json({
            error: `Дневной лимит исчерпан (${dailyLimit}). Докупите пакет ИИ или подождите до завтра.`,
            limitReached: true,
          });
        }
      }

      await storage.createTutorAiChatMessage({
        chatId,
        tutorId,
        role: 'user',
        content: message,
        imageUrl: imageBase64 ? `data:image/png;base64,${imageBase64.replace(/^data:image\/\w+;base64,/, '')}` : null,
      });

      const systemPrompt = `Ты — продвинутый ИИ-помощник для репетитора${tutor?.name ? ` ${tutor.name}` : ""}.
${tutor?.subjects?.length ? `Репетитор преподаёт: ${tutor.subjects.join(", ")}.` : ""}
${studentContext ? `\nКонтекст ученика: ${studentContext}` : ""}
${chat.context ? `\nКонтекст чата: ${chat.context}` : ""}

Ты помогаешь репетитору с:
- Планированием уроков: структура занятия, тайминг, упражнения, интерактивные активности
- Составлением домашних заданий: задачи разной сложности с решениями
- Объяснением сложных тем: простым языком с примерами и аналогиями
- Анализом работ учеников: разбор ошибок, рекомендации
- Методикой преподавания: советы, приёмы, мотивация учеников
- Подготовкой к ЕГЭ/ОГЭ: типовые задания, стратегии решения
- Генерацией контрольных и проверочных работ

Отвечай по-русски, профессионально и подробно. Давай готовые к использованию материалы.
Используй LaTeX для формул: $...$ для инлайн, $$...$$ для блочных.
Используй Markdown для структурирования: заголовки, списки, таблицы, блоки кода.`;

      const history = await storage.getTutorAiChatMessagesByChatId(chatId, 30);
      const aiMessages: any[] = [{ role: 'system', content: systemPrompt }];

      for (const m of history) {
        if (m.imageUrl && m.role === 'user') {
          aiMessages.push({
            role: 'user',
            content: [
              { type: 'text', text: m.content },
              { type: 'image_url', image_url: { url: m.imageUrl, detail: 'low' } },
            ],
          });
        } else {
          aiMessages.push({ role: m.role as 'user' | 'assistant', content: m.content });
        }
      }

      let client: OpenAI;
      let modelName: string;
      if (selectedModel === 'deepseek') {
        client = getTutorDeepSeekClient(settings.deepseek_api_key);
        modelName = 'deepseek-chat';
      } else if (selectedModel === 'gpt4o-mini') {
        client = getTutorOpenAIClient(settings.openai_api_key || undefined);
        modelName = 'gpt-4o-mini';
      } else {
        client = getTutorOpenAIClient(settings.openai_api_key || undefined);
        modelName = 'gpt-4o';
      }

      const completion = await client.chat.completions.create({
        model: modelName,
        messages: aiMessages,
        max_tokens: 3000,
        temperature: 0.7,
      });

      const assistantMessage = completion.choices[0]?.message?.content || "Извините, не могу ответить сейчас.";

      if (usingPackage) {
        await storage.consumeAiPackageCredit(tutorId, 'tutor');
      }
      await storage.incrementTutorAiUsage(tutorId, selectedModel);

      const savedMessage = await storage.createTutorAiChatMessage({
        chatId,
        tutorId,
        role: 'assistant',
        content: assistantMessage,
      });

      if (history.length <= 2) {
        const shortTitle = message.length > 40 ? message.substring(0, 37) + "..." : message;
        await storage.updateTutorAiChatTitle(chatId, shortTitle);
      }

      res.json(savedMessage);
    } catch (error: any) {
      console.error("Tutor AI Chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ======= LESSON ROUTES =======
  
  // GET /api/lessons - Получить занятия текущего репетитора
  app.get("/api/lessons", requireAuth, async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const lessons = await storage.getLessonsByTutorId(req.session.tutorId!, limit);
    res.json(lessons);
  });

  // POST /api/lessons - Создать занятие
  app.post("/api/lessons", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        studentId: z.string(),
        scheduledAt: z.string(),
        durationMinutes: z.number(),
        topic: z.string(),
        status: z.enum(["pending", "completed", "cancelled", "rescheduled"]).default("pending"),
        attendance: z.enum(["attended", "attended_unpaid", "missed", "missed_paid"]).optional(),
        rating: z.number().optional(),
        notes: z.string().optional(),
      });

      const data = schema.parse(req.body);

      // Ownership check: ученик должен принадлежать текущему тутору
      const owner = await storage.getStudent(data.studentId);
      if (!owner || owner.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      const lesson = await storage.createLesson({
        ...data,
        tutorId: req.session.tutorId!,
        scheduledAt: new Date(data.scheduledAt),
      });

      res.json(lesson);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "Проверьте поля занятия", issues: error.issues });
      }
      console.error("POST /api/lessons error:", error);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  });

  // PATCH /api/lessons/:id - Обновить занятие
  app.patch("/api/lessons/:id", requireAuth, async (req, res) => {
    const { deductFromBalance, ...rawUpdates } = req.body;
    const updates: any = { ...rawUpdates };
    if (updates.scheduledAt) {
      updates.scheduledAt = new Date(updates.scheduledAt);
    }

    const oldLesson = await storage.getLesson(req.params.id);
    if (!oldLesson || oldLesson.tutorId !== req.session.tutorId) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // Auto-check balance when marking a lesson as "attended":
    // Use computed effective balance (totalPaid - totalCost) — same as frontend display.
    // If balance is insufficient for the lesson cost, mark as "attended_unpaid" instead.
    if (updates.status === "completed" && updates.attendance === "attended") {
      const student = await storage.getStudent(oldLesson.studentId);
      if (student && student.tutorId === req.session.tutorId) {
        const duration = updates.durationMinutes ?? (oldLesson as any).durationMinutes ?? 60;
        const lessonCost = Math.round(student.pricePerLesson * duration / 60);
        // Compute effective balance EXCLUDING this lesson (it's still pending at this point)
        const effectiveBal = await computeEffectiveBalance(oldLesson.studentId, student);
        if (effectiveBal < lessonCost) {
          updates.attendance = "attended_unpaid";
        }
      }
    }

    // Auto-apply cancel policy when status changes to "cancelled" without explicit attendance
    if (updates.status === "cancelled" && !updates.attendance) {
      const tutor = await storage.getTutor(req.session.tutorId!);
      const student = await storage.getStudent(oldLesson.studentId);
      const policy = (tutor as any)?.cancelPolicy || 'free';
      if (policy === 'free') {
        updates.attendance = "missed";
        updates.cancelAmount = 0;
      } else if (policy === 'fixed') {
        const fee = (tutor as any)?.cancelFee || 0;
        updates.attendance = "missed_paid";
        updates.cancelAmount = fee;
      } else if (policy === 'per_student') {
        const fee = (student as any)?.cancelFee ?? (tutor as any)?.cancelFee ?? 0;
        if (fee > 0) {
          updates.attendance = "missed_paid";
          updates.cancelAmount = fee;
        } else {
          updates.attendance = "missed";
          updates.cancelAmount = 0;
        }
      }
    }

    const updated = await storage.updateLesson(req.params.id, updates);

    if (updated) {
      const newStatus = updated.status;
      const newAttendance = updated.attendance;
      const oldAttendance = oldLesson.attendance;

      // Record history if status or attendance changed
      if (oldLesson.status !== newStatus || oldLesson.attendance !== newAttendance) {
        try {
          const { supabase: sb } = await import("./supabase");
          await sb.from(`Tvoy_vector_2_lesson_history`).insert({
            lesson_id: updated.id,
            student_id: updated.studentId,
            tutor_id: req.session.tutorId,
            old_status: oldLesson.status,
            new_status: newStatus,
            old_attendance: oldLesson.attendance,
            new_attendance: newAttendance,
          });
        } catch { /* non-blocking */ }
      }

      // Determine if this transition is to/from a "paid outcome" state
      const isPaidOutcome = (s: string | null | undefined, a: string | null | undefined) =>
        (s === "completed" && a === "attended") ||
        (s === "cancelled" && a === "missed_paid");

      const nowPaid = isPaidOutcome(newStatus, newAttendance);
      const wasPaid = isPaidOutcome(oldLesson.status, oldAttendance);

      if (nowPaid && !wasPaid) {
        // Deduct lesson cost (or cancel fee) from student's prepaid balance
        const student = await storage.getStudent(updated.studentId);
        if (student && student.tutorId === req.session.tutorId) {
          let cost: number;
          if (newStatus === "cancelled" && newAttendance === "missed_paid") {
            // Use cancelAmount from the lesson (cancel fee)
            cost = (updated as any).cancelAmount ?? 0;
          } else {
            // Full lesson cost for completed attendance
            const duration = (updated as any).durationMinutes || 60;
            cost = Math.round(student.pricePerLesson * duration / 60);
          }
          if (cost > 0) {
            await storage.updateStudent(updated.studentId, {
              balance: student.balance - cost,
            });
          }
        }
      } else if (!nowPaid && wasPaid) {
        // Lesson reverted from paid outcome — restore balance
        const student = await storage.getStudent(updated.studentId);
        if (student && student.tutorId === req.session.tutorId) {
          let cost: number;
          if (oldLesson.status === "cancelled" && oldAttendance === "missed_paid") {
            // Restore the cancel fee amount
            cost = (oldLesson as any).cancelAmount ?? Math.round(student.pricePerLesson * ((oldLesson as any).durationMinutes || 60) / 60);
          } else {
            const duration = (oldLesson as any).durationMinutes || 60;
            cost = Math.round(student.pricePerLesson * duration / 60);
          }
          if (cost > 0) {
            await storage.updateStudent(updated.studentId, {
              balance: student.balance + cost,
            });
          }
        }
      }
    }

    res.json(updated);
  });

  // GET /api/settings/cancel-policy - Получить настройки политики отмены
  app.get("/api/settings/cancel-policy", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const tutor = await storage.getTutor(tutorId);
      if (!tutor) return res.status(404).json({ error: "Tutor not found" });
      const students = await storage.getStudentsByTutorId(tutorId);
      res.json({
        policy: (tutor as any).cancelPolicy || 'free',
        fee: (tutor as any).cancelFee || 0,
        students: students.map((s: any) => ({ id: s.id, name: s.name, cancelFee: s.cancelFee ?? null })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/settings/cancel-policy - Сохранить настройки политики отмены
  app.post("/api/settings/cancel-policy", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const schema = z.object({
        policy: z.enum(['free', 'fixed', 'per_student']),
        fee: z.number().int().min(0).default(0),
        studentFees: z.record(z.string(), z.number().int().min(0).nullable()).optional(),
      });
      const data = schema.parse(req.body);
      await storage.updateTutor(tutorId, {
        cancelPolicy: data.policy,
        cancelFee: data.fee,
      } as any);
      // Update per-student fees
      if (data.studentFees) {
        await Promise.all(
          Object.entries(data.studentFees).map(([studentId, fee]) =>
            storage.updateStudent(studentId, { cancelFee: fee } as any)
          )
        );
      }
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/lessons/bulk-reschedule", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        studentId: z.string(),
        updates: z.array(z.object({
          lessonId: z.string(),
          newScheduledAt: z.string(),
        })),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error });
      const { studentId, updates: lessonUpdates } = parsed.data;

      const tutorId = req.session.tutorId!;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const updated: any[] = [];
      for (const { lessonId, newScheduledAt } of lessonUpdates) {
        const lesson = await storage.getLesson(lessonId);
        if (!lesson || lesson.tutorId !== tutorId || lesson.studentId !== studentId) continue;
        if (lesson.status !== "pending") continue;
        if (new Date(lesson.scheduledAt) < todayStart) continue;

        const newDate = new Date(newScheduledAt);
        if (isNaN(newDate.getTime())) continue;

        const result = await storage.updateLesson(lessonId, { scheduledAt: newDate });
        if (result) updated.push(result);
      }

      res.json({ updated: updated.length, lessons: updated });
    } catch (error: any) {
      console.error("Bulk reschedule error:", error);
      res.status(500).json({ error: error.message || "Internal error" });
    }
  });

  app.post("/api/lessons/bulk-create", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        lessons: z.array(z.object({
          studentId: z.string(),
          scheduledAt: z.string(),
          durationMinutes: z.number(),
          topic: z.string(),
          status: z.enum(["pending", "completed", "cancelled", "rescheduled"]).default("pending"),
          attendance: z.enum(["attended", "attended_unpaid", "missed", "missed_paid"]).nullable().optional(),
        })),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error });

      const tutorId = req.session.tutorId!;
      const tutorStudents = await storage.getStudentsByTutorId(tutorId);
      const tutorStudentIds = new Set(tutorStudents.map(s => s.id));

      const created: any[] = [];
      for (const item of parsed.data.lessons) {
        if (!tutorStudentIds.has(item.studentId)) continue;

        const lesson = await storage.createLesson({
          ...item,
          tutorId,
          scheduledAt: new Date(item.scheduledAt),
          attendance: item.attendance ?? undefined,
        });
        created.push(lesson);
      }
      res.json({ created: created.length, lessons: created });
    } catch (error: any) {
      console.error("Bulk create error:", error);
      res.status(500).json({ error: error.message || "Internal error" });
    }
  });

  // DELETE /api/lessons/:id - Удалить занятие
  app.delete("/api/lessons/:id", requireAuth, async (req, res) => {
    try {
      const lesson = await storage.getLesson(req.params.id);
      if (!lesson || lesson.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Lesson not found" });
      }
      await storage.deleteLesson(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("DELETE /api/lessons error:", error);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  });

  // ======= PAYMENT ROUTES =======
  
  // GET /api/payments - Получить платежи текущего репетитора
  app.get("/api/payments", requireAuth, async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const payments = await storage.getPaymentsByTutorId(req.session.tutorId!, limit);
    res.json(payments);
  });

  // Helper: compute effective balance the same way the frontend does (totalPaid - totalCost)
  // This is the authoritative balance — consistent with what the user sees on screen.
  async function computeEffectiveBalance(studentId: string, student?: any): Promise<number> {
    const s = student ?? await storage.getStudent(studentId);
    if (!s) return 0;
    const payments = await storage.getPaymentsByStudentId(studentId);
    const lessons = await storage.getLessonsByStudentId(studentId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalCost = lessons
      .filter(l =>
        (l.status === "completed" && ["attended", "attended_unpaid", "missed_paid"].includes(l.attendance || "")) ||
        (l.status === "cancelled" && l.attendance === "missed_paid")
      )
      .reduce((sum, l) => {
        const dur = (l as any).durationMinutes || 60;
        return sum + Math.round(s.pricePerLesson * dur / 60);
      }, 0);
    return totalPaid - totalCost;
  }

  // Helper: after balance increase, auto-upgrade attended_unpaid → attended (oldest first)
  async function autoUpgradeUnpaidLessons(studentId: string) {
    const student = await storage.getStudent(studentId);
    if (!student) return;

    const effectiveBal = await computeEffectiveBalance(studentId, student);
    if (effectiveBal <= 0) return;

    const allLessons = await storage.getLessonsByStudentId(studentId);
    const unpaidDone = allLessons
      .filter(l => l.status === "completed" && l.attendance === "attended_unpaid")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    let remaining = effectiveBal;
    for (const lesson of unpaidDone) {
      if (remaining <= 0) break;
      const dur = (lesson as any).durationMinutes || 60;
      const cost = Math.round(student.pricePerLesson * dur / 60);
      if (remaining >= cost) {
        await storage.updateLesson(lesson.id, { attendance: "attended" });
        // Keep student.balance in sync: attended lesson deducts prepaid credit
        const fresh = await storage.getStudent(studentId);
        if (fresh) await storage.updateStudent(studentId, { balance: fresh.balance - cost });
        remaining -= cost;
      } else {
        break;
      }
    }
  }

  // Helper: after balance decrease, auto-downgrade attended → attended_unpaid (newest first)
  async function autoDowngradeAttendedLessons(studentId: string) {
    const student = await storage.getStudent(studentId);
    if (!student) return;

    const effectiveBal = await computeEffectiveBalance(studentId, student);
    if (effectiveBal >= 0) return;

    const allLessons = await storage.getLessonsByStudentId(studentId);
    const attendedLessons = allLessons
      .filter(l => l.status === "completed" && l.attendance === "attended")
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()); // newest first

    let debt = Math.abs(effectiveBal);
    for (const lesson of attendedLessons) {
      if (debt <= 0) break;
      const dur = (lesson as any).durationMinutes || 60;
      const cost = Math.round(student.pricePerLesson * dur / 60);
      await storage.updateLesson(lesson.id, { attendance: "attended_unpaid" });
      // Keep student.balance in sync: restoring credit since lesson is no longer "paid"
      const fresh = await storage.getStudent(studentId);
      if (fresh) await storage.updateStudent(studentId, { balance: fresh.balance + cost });
      debt -= cost;
    }
  }

  // POST /api/payments - Создать платёж
  app.post("/api/payments", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        studentId: z.string(),
        amount: z.number(),
        method: z.enum(["наличные", "перевод", "карта"]),
        comment: z.string().optional(),
      });

      const data = schema.parse(req.body);

      // Запрет изменения баланса архивных учеников
      const studentCheck = await storage.getStudent(data.studentId);
      if (!studentCheck || studentCheck.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Student not found" });
      }
      if (!studentCheck.isActive) {
        return res.status(400).json({ error: "Нельзя изменять баланс ученика в архиве" });
      }

      const payment = await storage.createPayment({
        ...data,
        tutorId: req.session.tutorId!,
      });

    // Обновляем баланс ученика
    const student = studentCheck;
    if (student) {
      await storage.updateStudent(data.studentId, {
        balance: student.balance + data.amount,
      });

      // Auto-upgrade attended_unpaid lessons now that balance increased
      await autoUpgradeUnpaidLessons(data.studentId);

      // Telegram notification to student (use fresh balance after upgrades)
      const freshStudent = await storage.getStudent(data.studentId);
      const newBalance = freshStudent?.balance ?? (student.balance + data.amount);
      botManager.sendToStudent(data.studentId,
        `💰 <b>Оплата зачислена!</b>\n\n` +
        `Сумма: <b>${data.amount.toLocaleString("ru-RU")} ₽</b>\n` +
        `Способ: ${data.method}\n` +
        `Баланс: ${newBalance.toLocaleString("ru-RU")} ₽\n\n` +
        `Подробнее — в разделе Финансы вашего кабинета.`
      ).catch(() => {});
    }

      res.json(payment);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "Проверьте поля платежа", issues: error.issues });
      }
      console.error("POST /api/payments error:", error);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  });

  app.delete("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      if (payment.tutorId !== req.session.tutorId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const student = await storage.getStudent(payment.studentId);
      if (student) {
        await storage.updateStudent(payment.studentId, {
          balance: student.balance - payment.amount,
        });
      }

      await storage.deletePayment(req.params.id);

      // After deleting payment, downgrade attended → attended_unpaid if balance went negative
      await autoDowngradeAttendedLessons(payment.studentId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete payment error:", error);
      res.status(500).json({ error: error.message || "Internal error" });
    }
  });

  // POST /api/students/:id/set-balance — прямое редактирование баланса ученика (корректирующий платёж)
  app.post("/api/students/:id/set-balance", requireAuth, async (req, res) => {
    try {
      const schema = z.object({ newBalance: z.number() });
      const { newBalance } = schema.parse(req.body);

      const student = await storage.getStudent(req.params.id);
      if (!student || student.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Student not found" });
      }
      if (!student.isActive) {
        return res.status(400).json({ error: "Нельзя изменять баланс ученика в архиве" });
      }

      const studentPayments = await storage.getPaymentsByStudentId(req.params.id);
      const studentLessons = await storage.getLessonsByStudentId(req.params.id);

      const totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
      const billableLessons = studentLessons.filter(l =>
        (l.status === "completed" && ["attended", "attended_unpaid", "missed_paid"].includes(l.attendance || "")) ||
        (l.status === "cancelled" && l.attendance === "missed_paid")
      );
      const totalLessonsCost = billableLessons.reduce((sum, l) => {
        const duration = (l as any).durationMinutes || 60;
        return sum + Math.round(student.pricePerLesson * duration / 60);
      }, 0);
      const effectiveBalance = totalPaid - totalLessonsCost;
      const delta = newBalance - effectiveBalance;

      if (delta === 0) {
        return res.json({ success: true, delta: 0 });
      }

      const payment = await storage.createPayment({
        studentId: req.params.id,
        tutorId: req.session.tutorId!,
        amount: delta,
        method: "перевод",
        comment: `[correction] Коррекция баланса: ${effectiveBalance > 0 ? "+" : ""}${effectiveBalance} → ${newBalance > 0 ? "+" : ""}${newBalance} ₽`,
      });

      await storage.updateStudent(req.params.id, {
        balance: student.balance + delta,
      });

      // Auto-upgrade or downgrade lessons based on balance direction
      if (delta > 0) {
        await autoUpgradeUnpaidLessons(req.params.id);
      } else if (delta < 0) {
        await autoDowngradeAttendedLessons(req.params.id);
      }

      res.json({ success: true, payment, delta });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  // POST /api/payments/request-online - создать ссылку на онлайн-оплату от ученика
  app.post("/api/payments/request-online", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        studentId: z.string(),
        amount: z.number().positive(),
        description: z.string().optional(),
      });
      const { studentId, amount, description } = schema.parse(req.body);
      const tutorId = req.session.tutorId!;

      if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
        return res.status(400).json({ error: "ЮКасса не настроена. Добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY." });
      }

      const student = await storage.getStudent(studentId);
      if (!student || student.tutorId !== tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      const yookassaInstance = new YooKassa({
        shopId: process.env.YOOKASSA_SHOP_ID,
        secretKey: process.env.YOOKASSA_SECRET_KEY,
      });

      const origin = appUrl();
      const desc = description || `Оплата занятий — ${student.name}`;
      const idempotenceKey = randomUUID();

      const payment = await yookassaInstance.createPayment({
        amount: { value: amount.toFixed(2), currency: "RUB" },
        confirmation: {
          type: "redirect",
          return_url: `${origin}/finance?payment=success`,
        },
        description: desc,
        capture: true,
        metadata: { tutorId, studentId, type: "student_payment" },
      }, idempotenceKey);

      // Сохраняем как pending-платёж (зачтётся после webhook)
      const dbPayment = await storage.createPayment({
        tutorId,
        studentId,
        amount,
        method: "онлайн",
        comment: desc,
        yookassaPaymentId: payment.id,
        yookassaStatus: "pending",
        confirmationUrl: payment.confirmation?.confirmation_url,
      });

      res.json({
        paymentId: dbPayment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
        yookassaPaymentId: payment.id,
      });
    } catch (error: any) {
      console.error("YooKassa student payment error:", error);
      res.status(500).json({ error: error.message || "Ошибка создания платежа" });
    }
  });

  // POST /api/payments/webhook - Единый webhook от ЮКассы (платежи учеников + подписки)
  const handleYookassaWebhook = async (req: any, res: any) => {
    try {
      const notification = req.body;
      const yp = notification.object;
      const meta = yp?.metadata || {};

      // SECURITY: проверяем подлинность уведомления, переспрашивая ЮКассу
      // об этом платеже по его id. Если конфиг ЮКассы есть, отказываем
      // в обработке любых неподтверждённых событий.
      if (process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY && yp?.id) {
        try {
          const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString("base64");
          const verifyRes = await fetch(`https://api.yookassa.ru/v3/payments/${yp.id}`, {
            headers: { Authorization: `Basic ${auth}` },
          });
          if (!verifyRes.ok) {
            console.warn("[YooKassa webhook] verify FAILED status=", verifyRes.status, "paymentId=", yp.id);
            return res.status(403).json({ error: "Untrusted webhook (payment not found at YooKassa)" });
          }
          const verified = await verifyRes.json();
          // Проверяем критичные поля из ответа ЮКассы, не доверяя телу webhook
          if (verified.status !== yp.status || verified.id !== yp.id) {
            console.warn("[YooKassa webhook] mismatch verified=", verified.status, verified.id, "vs", yp.status, yp.id);
            return res.status(403).json({ error: "Untrusted webhook (mismatch with YooKassa)" });
          }
          // Перезаписываем yp/meta из проверенного источника
          (req as any)._verifiedPayment = verified;
          Object.assign(yp, verified);
          Object.assign(meta, verified.metadata || {});
        } catch (vErr) {
          console.error("[YooKassa webhook] verify error:", vErr);
          return res.status(503).json({ error: "Could not verify webhook with YooKassa" });
        }
      }

      if (notification.event === "payment.succeeded") {
        // IDEMPOTENCY: атомарно помечаем yp.id как обработанный.
        // Если такой event уже был — возвращаем 200 OK без повторной обработки,
        // чтобы повторный webhook от ЮКассы не зачислил оплату/пакет дважды.
        if (yp?.id) {
          const fresh = await storage.tryMarkWebhookEventProcessed(yp.id, 'yookassa');
          if (!fresh) {
            console.log("[YooKassa webhook] duplicate event ignored:", yp.id);
            return res.status(200).json({ status: "duplicate" });
          }
        }
        if (meta.type === "student_payment" && meta.tutorId && meta.studentId) {
          // --- Платёж ученика ---
          const payments = await storage.getPaymentsByTutorId(meta.tutorId);
          const pending = payments.find(p => (p as any).yookassaPaymentId === yp.id);
          if (pending) {
            await storage.updatePayment(pending.id, { yookassaStatus: "succeeded" });
            const student = await storage.getStudent(meta.studentId);
            if (student) {
              // Обновляем DB-баланс (для быстрого чтения)
              await storage.updateStudent(meta.studentId, {
                balance: student.balance + pending.amount,
              });

              const amountStr = `${pending.amount.toLocaleString("ru-RU")} ₽`;

              // Уведомление репетитору на сайте
              await storage.createNotification({
                tutorId: meta.tutorId,
                type: "payment_received",
                title: "Оплата от ученика",
                message: `${student.name} оплатил(а) ${amountStr} онлайн`,
                relatedId: meta.studentId,
                isRead: false,
              }).catch(() => null);

              // Telegram уведомление репетитору
              botManager.sendToTutor(meta.tutorId,
                `💳 <b>Новая оплата!</b>\n\n` +
                `👤 Ученик: <b>${student.name}</b>\n` +
                `💰 Сумма: <b>${amountStr}</b>\n` +
                `📋 Способ: онлайн (ЮКасса)`
              ).catch(() => null);

              // Telegram уведомление ученику
              botManager.sendToStudent(meta.studentId,
                `✅ <b>Оплата подтверждена!</b>\n\n` +
                `💰 Сумма: <b>${amountStr}</b>\n` +
                `💳 Ваш баланс пополнен. Не забудьте запросить чек у репетитора через «Мой налог».`
              ).catch(() => null);
            }
          }
        } else if (meta.type === "ai_package" && meta.tutorId && meta.credits) {
          // --- Покупка пакета ИИ ---
          const credits = parseInt(meta.credits, 10);
          // Используем ORIGINAL price для поиска в каталоге (pricePaid может быть со скидкой)
          const originalPrice = parseFloat(meta.originalPrice || meta.pricePaid || "0");
          const pricePaidNum = parseFloat(meta.pricePaid || "0");
          const validOption = AI_PACKAGE_OPTIONS.find(o => o.credits === credits && o.price === originalPrice);
          if (validOption) {
            await storage.purchaseAiPackage(meta.tutorId, 'tutor', validOption.credits, pricePaidNum);
            // Записать редемпцию промокода (если был применён)
            if (meta.promoCodeId) {
              try {
                const already = await storage.hasUserRedeemed(meta.promoCodeId, meta.tutorId);
                if (!already) {
                  const originalKop = Math.round(originalPrice * 100);
                  const finalKop = Math.round(pricePaidNum * 100);
                  await storage.createPromoRedemption({
                    promoCodeId: meta.promoCodeId,
                    userId: meta.tutorId,
                    userRole: 'tutor',
                    scope: 'ai_packages',
                    originalAmount: originalKop,
                    discountAmount: originalKop - finalKop,
                    finalAmount: finalKop,
                    referenceId: yp.id,
                  });
                  await storage.incrementPromoCodeUse(meta.promoCodeId);
                }
              } catch (e) {
                console.error("[promo-redemption] failed:", e);
              }
            }
            await storage.createNotification({
              tutorId: meta.tutorId,
              type: "ai_package_purchased",
              title: "Пакет ИИ зачислен",
              message: `Зачислено ${validOption.credits} запросов ИИ`,
              isRead: false,
            }).catch(() => null);
          }
        } else if (meta.type === "extra_students" && meta.tutorId && meta.count) {
          // --- Покупка дополнительных учеников ---
          const count = parseInt(meta.count, 10);
          const tutor = await storage.getTutor(meta.tutorId);
          if (tutor) {
            const currentExtra = tutor.extraStudents || 0;
            await storage.updateTutor(meta.tutorId, { extraStudents: currentExtra + count } as any);
            await storage.createNotification({
              tutorId: meta.tutorId,
              type: "extra_students_purchased",
              title: "Слоты учеников добавлены",
              message: `Добавлено ${count} слотов для учеников`,
              isRead: false,
            }).catch(() => null);
          }
        } else if (meta.tutorId && meta.tier) {
          // --- Подписка репетитора ---
          const subPayment = await storage.getSubscriptionPaymentByYookassaId(yp.id);
          if (subPayment) {
            await storage.updateSubscriptionPayment(subPayment.id, {
              status: "succeeded",
              paidAt: new Date(),
            });
            const periodMonths = meta.period === "yearly" ? 12 : 1;
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + periodMonths);
            await storage.updateTutor(meta.tutorId, {
              subscription: meta.tier,
              subscriptionUntil: expiresAt,
            });
          }
        }
      } else if (notification.event === "payment.canceled") {
        if (meta.type === "student_payment" && meta.tutorId) {
          const payments = await storage.getPaymentsByTutorId(meta.tutorId);
          const pending = payments.find(p => (p as any).yookassaPaymentId === yp.id);
          if (pending) {
            await storage.updatePayment(pending.id, { yookassaStatus: "canceled" });
          }
        }
      }

      res.status(200).send();
    } catch (error: any) {
      console.error("YooKassa webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  };

  // Единый URL для всех уведомлений ЮКассы
  app.post("/api/payments/webhook", handleYookassaWebhook);
  // Совместимость со старыми URL
  app.post("/api/payments/webhook-student", handleYookassaWebhook);

  // GET /api/payments/:id/status - проверить статус онлайн-платежа
  app.get("/api/payments/:id/status", requireAuth, async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment || payment.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Платёж не найден" });
      }
      const yookassaId = (payment as any).yookassaPaymentId;
      if (!yookassaId || !process.env.YOOKASSA_SHOP_ID) {
        return res.json({ status: (payment as any).yookassaStatus || "unknown" });
      }
      const yookassaInstance = new YooKassa({
        shopId: process.env.YOOKASSA_SHOP_ID,
        secretKey: process.env.YOOKASSA_SECRET_KEY || "",
      });
      const yp = await yookassaInstance.getPayment(yookassaId);
      // Синхронизируем статус
      if (yp.status === "succeeded" && (payment as any).yookassaStatus !== "succeeded") {
        await storage.updatePayment(payment.id, { yookassaStatus: "succeeded" });
        const student = await storage.getStudent(payment.studentId);
        if (student) {
          await storage.updateStudent(payment.studentId, {
            balance: student.balance + payment.amount,
          });
        }
      } else if (yp.status === "canceled" && (payment as any).yookassaStatus !== "canceled") {
        await storage.updatePayment(payment.id, { yookassaStatus: "canceled" });
      }
      res.json({ status: yp.status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/finance/migrate-payments", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const allLessons = await storage.getLessonsByTutorId(tutorId);
      const attendedLessons = allLessons.filter(
        l => l.status === "completed" && l.attendance === "attended"
      );

      let created = 0;
      for (const lesson of attendedLessons) {
        const studentPayments = await storage.getPaymentsByStudentId(lesson.studentId);
        const alreadyLinked = studentPayments.some(
          p => p.comment && p.comment.includes(`[lesson:${lesson.id}]`)
        );
        if (alreadyLinked) continue;

        const student = await storage.getStudent(lesson.studentId);
        if (!student) continue;

        const duration = (lesson as any).durationMinutes || 60;
        const cost = Math.round(student.pricePerLesson * duration / 60);
        if (cost <= 0) continue;

        await storage.createPayment({
          tutorId,
          studentId: lesson.studentId,
          amount: cost,
          method: "перевод",
          comment: `Авто-оплата за занятие [lesson:${lesson.id}]`,
          createdAt: new Date(lesson.scheduledAt),
        });

        await storage.updateStudent(lesson.studentId, {
          balance: student.balance + cost,
        });
        created++;
      }

      res.json({ success: true, created, total: attendedLessons.length });
    } catch (error: any) {
      console.error("Payment migration error:", error);
      res.status(500).json({ error: error.message || "Internal error" });
    }
  });

  // ======= TASK ROUTES (tutor's own tasks) =======
  
  // GET /api/tutor-tasks - Получить задания текущего репетитора (собственные)
  app.get("/api/tutor-tasks", requireAuth, async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const tasks = await storage.getTasksByTutorId(req.session.tutorId!, limit);
    res.json(tasks);
  });

  // POST /api/tutor-tasks - Создать задание
  app.post("/api/tutor-tasks", requireAuth, async (req, res) => {
    const schema = z.object({
      topic: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]),
      task: z.string(),
      solution: z.string(),
      answer: z.string(),
    });

    const data = schema.parse(req.body);
    const task = await storage.createTask({
      ...data,
      tutorId: req.session.tutorId!,
    });

    res.json(task);
  });

  // ======= HOMEWORK ROUTES =======
  
  // GET /api/homework - Получить домашки текущего репетитора.
  // По умолчанию: лимит 100 последних, поле attachments сохраняется (фронт ожидает превью).
  // ?slim=1 — без attachments (для уведомлений/чек-листов): возвращается attachmentsCount.
  app.get("/api/homework", requireAuth, async (req, res) => {
    const limit = Math.min(req.query.limit ? parseInt(req.query.limit as string) : 100, 500);
    const slim = req.query.slim === "1" || req.query.slim === "true";
    const hw = await storage.getHomeworkByTutorId(req.session.tutorId!, limit);
    if (!slim) return res.json(hw);
    const stripped = hw.map((h: any) => {
      const { attachments, ...rest } = h;
      return {
        ...rest,
        attachmentsCount: Array.isArray(attachments) ? attachments.length : 0,
      };
    });
    res.json(stripped);
  });

  // POST /api/homework - Создать домашку
  app.post("/api/homework", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        studentId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        deadline: z.string().optional(),
        attachments: z.array(z.string()).optional(),
        completionPct: z.number().default(0),
        taskIds: z.array(z.string()).default([]),
        hints: z.string().optional(),
      });

      const data = schema.parse(req.body);

      // Ownership check
      const owner = await storage.getStudent(data.studentId);
      if (!owner || owner.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      const hw = await storage.createHomework({
        ...data,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        attachments: data.attachments ?? [],
        hints: data.hints || undefined,
        tutorId: req.session.tutorId!,
      });

      res.json(hw);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "Проверьте поля домашнего задания", issues: error.issues });
      }
      console.error("POST /api/homework error:", error);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  });

  // PATCH /api/homework/:id - Обновить домашку
  app.patch("/api/homework/:id", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const allHw = await storage.getHomeworkByTutorId(tutorId);
      const owned = allHw.find(h => h.id === req.params.id);
      if (!owned) {
        return res.status(404).json({ error: "Домашка не найдена" });
      }

      const schema = z.object({
        feedback: z.string().optional(),
        status: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        deadline: z.string().optional(),
        attachments: z.array(z.string()).optional(),
        completionPct: z.number().optional(),
        score: z.number().min(0).max(100).optional(),
        hints: z.string().optional(),
      });

      const data = schema.parse(req.body);
      const updates: any = {};
      if (data.feedback !== undefined) updates.feedback = data.feedback;
      if (data.status !== undefined) updates.status = data.status;
      if (data.title !== undefined) updates.title = data.title;
      if (data.description !== undefined) updates.description = data.description;
      if (data.deadline !== undefined) updates.deadline = new Date(data.deadline);
      if (data.attachments !== undefined) updates.attachments = data.attachments;
      if (data.completionPct !== undefined) updates.completionPct = data.completionPct;
      if (data.score !== undefined) updates.score = data.score;
      if (data.hints !== undefined) updates.hints = data.hints;

      const updated = await storage.updateHomework(req.params.id, updates);

      // Telegram notification to student when homework is graded
      if ((data.status === "reviewed" || data.score !== undefined) && owned.studentId) {
        const scoreText = data.score !== undefined ? ` Оценка: <b>${data.score}/100</b>` : "";
        const feedbackText = data.feedback ? `\n💬 ${data.feedback}` : "";
        botManager.sendToStudent(owned.studentId,
          `✅ <b>Работа проверена!</b>\n\n` +
          `📝 ${owned.title}${scoreText}${feedbackText}\n\n` +
          `Смотрите результаты в платформе Твой Вектор.`
        ).catch(() => {});
      }

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ======= ADMIN ROUTES =======
  
  // GET /api/admin/tutors - Получить всех репетиторов (только для админа)
  app.get("/api/admin/tutors", requireAdmin, async (req, res) => {
    const tutors = await storage.getAllTutors();
    // Убираем пароли из ответа
    const safeTutors = tutors.map(({ password, ...rest }) => rest);
    res.json(safeTutors);
  });

  // POST /api/admin/tutors - Создать репетитора (только для админа)
  app.post("/api/admin/tutors", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        subjects: z.array(z.string()).default([]),
        subscription: z.enum(["free", "pro", "premium"]).default("free"),
        subscriptionUntil: z.string().nullable().optional(),
      });

      const data = schema.parse(req.body);

      const existing = await storage.getTutorByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: "Email уже используется" });
      }

      const hashedPassword = await hashPassword(data.password);

      const tutor = await storage.createTutor({
        email: data.email,
        password: hashedPassword,
        name: data.name,
        subjects: data.subjects,
        subscription: data.subscription,
        subscriptionUntil: data.subscriptionUntil ? new Date(data.subscriptionUntil) : null,
        isAdmin: false,
        basePrice: 1600,
        timezone: "Europe/Moscow",
      });

      const { password: _, ...safeTutor } = tutor;
      res.json(safeTutor);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // PATCH /api/admin/tutors/:id - Обновить репетитора (только для админа)
  app.patch("/api/admin/tutors/:id", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        subscription: z.enum(["free", "pro", "premium"]).optional(),
        subscriptionUntil: z.string().nullable().optional(),
        subjects: z.array(z.string()).optional(),
      });

      const updates = schema.parse(req.body);

      if (updates.email) {
        const existing = await storage.getTutorByEmail(updates.email);
        if (existing && existing.id !== req.params.id) {
          return res.status(400).json({ error: "Email уже используется другим репетитором" });
        }
      }
      
      const updatesWithDate = {
        ...updates,
        subscriptionUntil: updates.subscriptionUntil !== undefined 
          ? (updates.subscriptionUntil ? new Date(updates.subscriptionUntil) : null)
          : undefined,
      };

      const tutor = await storage.updateTutor(req.params.id, updatesWithDate);
      if (!tutor) {
        return res.status(404).json({ error: "Репетитор не найден" });
      }

      const { password: _, ...safeTutor } = tutor;
      res.json(safeTutor);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /api/admin/tutors/:id - Удалить репетитора (только для админа)
  app.delete("/api/admin/tutors/:id", requireAdmin, async (req, res) => {
    try {
      const tutor = await storage.getTutor(req.params.id);
      if (!tutor) return res.status(404).json({ error: "Репетитор не найден" });
      if (tutor.isAdmin) return res.status(403).json({ error: "Нельзя удалить администратора" });
      await storage.deleteTutor(req.params.id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/admin/tutors/:id/block - Заблокировать/разблокировать репетитора
  app.patch("/api/admin/tutors/:id/block", requireAdmin, async (req, res) => {
    try {
      const { blocked } = z.object({ blocked: z.boolean() }).parse(req.body);
      const tutor = await storage.getTutor(req.params.id);
      if (!tutor) return res.status(404).json({ error: "Репетитор не найден" });
      if (tutor.isAdmin) return res.status(403).json({ error: "Нельзя заблокировать администратора" });
      const updated = await storage.updateTutor(req.params.id, { isBlocked: blocked } as any);
      if (!updated) return res.status(404).json({ error: "Ошибка обновления" });
      const { password: _, ...safe } = updated;
      res.json(safe);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET /api/admin/tutors/:id/stats - Статистика репетитора
  app.get("/api/admin/tutors/:id/stats", requireAdmin, async (req, res) => {
    try {
      const students = await storage.getStudentsByTutorId(req.params.id);
      const lessons = await storage.getLessonsByTutorId(req.params.id, 1000);
      const now = new Date();
      const completedLessons = lessons.filter(l => l.status === "completed");
      const upcomingLessons = lessons.filter(l => l.status === "pending" && new Date(l.scheduledAt) > now);
      const totalRevenue = completedLessons.reduce((sum, l) => {
        const student = students.find(s => s.id === l.studentId);
        return sum + (student?.pricePerLesson || 0);
      }, 0);
      res.json({
        studentCount: students.length,
        totalLessons: lessons.length,
        completedLessons: completedLessons.length,
        upcomingLessons: upcomingLessons.length,
        totalRevenue,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/admin/stats - Статистика платформы (только для админа)
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const tutors = await storage.getAllTutors();
      const now = new Date();

      const byTier = { free: 0, pro: 0, premium: 0 };
      let activeSubscriptions = 0;
      let totalStudents = 0;
      let totalAiCredits = 0;

      for (const tutor of tutors) {
        const tier = (tutor.subscription || "free") as keyof typeof byTier;
        if (byTier[tier] !== undefined) byTier[tier]++;
        if (tier !== "free" && tutor.subscriptionUntil && new Date(tutor.subscriptionUntil) > now) {
          activeSubscriptions++;
        }
        const students = await storage.getStudentsByTutorId(tutor.id);
        totalStudents += students.length;
        const credits = await storage.getAiPackageBalance(tutor.id, 'tutor');
        totalAiCredits += credits;
      }

      res.json({
        totalTutors: tutors.length,
        byTier,
        activeSubscriptions,
        totalStudents,
        totalAiCredits,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/admin/students - Все ученики по всем репетиторам
  app.get("/api/admin/students", requireAdmin, async (req, res) => {
    try {
      const tutors = await storage.getAllTutors();
      const result: any[] = [];
      for (const tutor of tutors) {
        const students = await storage.getStudentsByTutorId(tutor.id);
        for (const student of students) {
          result.push({
            ...student,
            tutorName: tutor.name,
            tutorEmail: tutor.email,
          });
        }
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/admin/tutors/:id/ai-credits - Выдать ИИ-кредиты репетитору
  app.post("/api/admin/tutors/:id/ai-credits", requireAdmin, async (req, res) => {
    try {
      const { credits } = z.object({ credits: z.number().int().min(1).max(10000) }).parse(req.body);
      const pkg = await storage.purchaseAiPackage(req.params.id, 'tutor', credits, 0);
      res.json(pkg);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/admin/students/:id/ai-credits - Выдать ИИ-кредиты ученику
  app.post("/api/admin/students/:id/ai-credits", requireAdmin, async (req, res) => {
    try {
      const { credits } = z.object({ credits: z.number().int().min(1).max(10000) }).parse(req.body);
      const pkg = await storage.purchaseAiPackage(req.params.id, 'student', credits, 0);
      res.json(pkg);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // PATCH /api/admin/tutors/:id/password - Сменить пароль репетитора (только для админа)
  app.patch("/api/admin/tutors/:id/password", requireAdmin, async (req, res) => {
    try {
      const { password } = z.object({ password: z.string().min(6, "Минимум 6 символов") }).parse(req.body);
      const hashed = await hashPassword(password);
      const tutor = await storage.updateTutor(req.params.id, { password: hashed });
      if (!tutor) return res.status(404).json({ error: "Репетитор не найден" });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // PATCH /api/admin/students/:id/password - Сменить пароль ученика (только для админа)
  app.patch("/api/admin/students/:id/password", requireAdmin, async (req, res) => {
    try {
      const { password } = z.object({ password: z.string().min(6, "Минимум 6 символов") }).parse(req.body);
      const hashed = await hashPassword(password);
      const student = await storage.updateStudent(req.params.id, { password: hashed });
      if (!student) return res.status(404).json({ error: "Ученик не найден" });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ======= SUBSCRIPTION ROUTES =======

  // GET /api/subscription/prices - Получить цены подписок
  app.get("/api/subscription/prices", async (req, res) => {
    try {
      const prices = await storage.getSubscriptionPrices();
      res.json(prices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/subscription/limits - Получить лимиты подписок
  app.get("/api/subscription/limits", requireAuth, async (req, res) => {
    try {
      const { SUBSCRIPTION_LIMITS } = await import("@shared/schema");
      res.json(SUBSCRIPTION_LIMITS);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/subscription/create-payment - Создать платёж через YooKassa
  app.post("/api/subscription/create-payment", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        tier: z.enum(["pro", "premium"]),
        period: z.enum(["monthly", "yearly"]),
      });

      const { tier, period } = schema.parse(req.body);
      const tutorId = req.session.tutorId!;

      // Получаем цены
      const prices = await storage.getSubscriptionPrices();
      const priceData = prices.find(p => p.tier === tier);
      if (!priceData) {
        return res.status(400).json({ error: "Тариф не найден" });
      }

      const amount = period === "monthly" ? priceData.priceMonthly : priceData.priceYearly;
      const periodMonths = period === "monthly" ? 1 : 12;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + periodMonths);

      // Проверяем наличие ключей YooKassa
      if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
        // Демо-режим без реального YooKassa
        const subPayment = await storage.createSubscriptionPayment({
          tutorId,
          tier,
          period,
          amount,
          status: "pending",
          expiresAt,
        });
        return res.json({
          paymentId: subPayment.id,
          demoMode: true,
          message: "ЮKassa не настроена. Для тестирования используйте демо-режим.",
        });
      }

      const idempotenceKey = randomUUID();

      // Создаём платёж в YooKassa
      const payment = await yookassa.createPayment({
        amount: {
          value: amount.toFixed(2),
          currency: "RUB",
        },
        confirmation: {
          type: "redirect",
          return_url: `${req.headers.origin || appUrl()}/subscription/success`,
        },
        description: `Подписка ${tier.toUpperCase()} на ${period === "monthly" ? "1 месяц" : "1 год"}`,
        capture: true,
        metadata: {
          tutorId,
          tier,
          period,
        },
      }, idempotenceKey);

      // Сохраняем платёж в нашу базу
      const subPayment = await storage.createSubscriptionPayment({
        tutorId,
        tier,
        period,
        amount,
        yookassaPaymentId: payment.id,
        status: "pending",
        expiresAt,
      });

      res.json({
        paymentId: subPayment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
      });
    } catch (error: any) {
      console.error("YooKassa error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/subscription/webhook - совместимость (обрабатывается единым хендлером)
  app.post("/api/subscription/webhook", handleYookassaWebhook);

  // POST /api/subscription/activate-demo - Активировать демо-подписку (для тестирования)
  app.post("/api/subscription/activate-demo", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        tier: z.enum(["pro", "premium"]),
        period: z.enum(["monthly", "yearly"]),
      });

      const { tier, period } = schema.parse(req.body);
      const tutorId = req.session.tutorId!;

      const periodMonths = period === "yearly" ? 12 : 1;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + periodMonths);

      // Обновляем подписку
      const tutor = await storage.updateTutor(tutorId, {
        subscription: tier,
        subscriptionUntil: expiresAt,
      });

      if (!tutor) {
        return res.status(404).json({ error: "Репетитор не найден" });
      }

      const { password: _, ...safeTutor } = tutor;
      res.json(safeTutor);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/subscription/cancel - Отмена платной подписки
  app.post("/api/subscription/cancel", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const tutor = await storage.getTutor(tutorId);
      if (!tutor) return res.status(404).json({ error: "Пользователь не найден" });
      if (!tutor.subscription || tutor.subscription === "free") {
        return res.status(400).json({ error: "Нет активной платной подписки" });
      }
      await storage.updateTutor(tutorId, {
        subscription: "free",
        subscriptionUntil: null,
      } as any);
      res.json({ ok: true, message: "Подписка отменена. Доступ к бесплатному тарифу сохранён." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/subscription/history - История платежей за подписку
  app.get("/api/subscription/history", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const payments = await storage.getSubscriptionPaymentsByTutorId(tutorId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= ADMIN PLATFORM SETTINGS =======

  // GET /api/admin/platform-settings — все настраиваемые параметры платформы
  app.get("/api/admin/platform-settings", requireAdmin, async (req, res) => {
    try {
      const s = await storage.getAiSettings();
      res.json({
        openai_api_key:       s.openai_api_key       || "",
        telegram_bot_token:   s.telegram_bot_token   || "",
        bbb_url:              s.bbb_url              || "",
        bbb_secret:           s.bbb_secret           || "",
        app_url:              s.app_url              || "",
        deepseek_api_key:     s.deepseek_api_key     || "",
        daily_limit_openai:   s.daily_limit_openai   || "50",
        daily_limit_deepseek: s.daily_limit_deepseek || "100",
        "daily_limit_gpt4o-mini": s["daily_limit_gpt4o-mini"] || "100",
        default_model:        s.default_model        || "openai",
        trial_days:           s.trial_days           || "30",
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // PUT /api/admin/platform-settings — сохранить настройки в БД
  app.put("/api/admin/platform-settings", requireAdmin, async (req, res) => {
    try {
      const allowed = ["openai_api_key", "telegram_bot_token", "bbb_url", "bbb_secret", "app_url",
        "deepseek_api_key", "daily_limit_openai", "daily_limit_deepseek", "daily_limit_gpt4o-mini", "default_model",
        "trial_days"];
      // Валидация trial_days: целое число 0..365
      if ("trial_days" in req.body) {
        const raw = String(req.body.trial_days ?? "").trim();
        const n = raw === "" ? 0 : Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 365) {
          return res.status(400).json({ error: "trial_days должен быть целым числом от 0 до 365" });
        }
        req.body.trial_days = String(n);
      }
      for (const key of allowed) {
        if (key in req.body) await storage.setAiSetting(key, req.body[key] ?? "");
      }
      // Сбросить кэш BBB при изменении URL/секрета
      if ("bbb_url" in req.body || "bbb_secret" in req.body) invalidateBbbCache();
      // Перезапустить Telegram-бота при изменении токена
      if ("telegram_bot_token" in req.body && req.body.telegram_bot_token) {
        await botManager.start(req.body.telegram_bot_token).catch(() => {});
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/admin/platform-status — состояние всех сервисов
  app.get("/api/admin/platform-status", requireAdmin, async (req, res) => {
    try {
      const { BUILTIN_SUPABASE_URL, BUILTIN_SUPABASE_ANON, openaiKey, BUILTIN_BBB_URL } = await import("./builtin-config");
      const timeout = (ms: number) => AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined as any;

      // Supabase
      let supabase = { ok: false, message: "Нет ответа" };
      try {
        const url = process.env.SUPABASE_URL || BUILTIN_SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY || BUILTIN_SUPABASE_ANON;
        const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key }, signal: timeout(5000) });
        supabase = { ok: r.status < 500, message: `HTTP ${r.status}` };
      } catch (e: any) { supabase = { ok: false, message: e.message?.slice(0, 60) }; }

      // BBB
      let bbb = { ok: false, message: "Нет ответа" };
      try {
        const s = await storage.getAiSettings();
        const url = (s.bbb_url || process.env.BBB_URL || BUILTIN_BBB_URL).replace(/\/$/, "");
        const r = await fetch(`${url}/api/`, { signal: timeout(5000) });
        bbb = { ok: r.ok || r.status < 500, message: r.ok ? "OK" : `HTTP ${r.status}` };
      } catch (e: any) { bbb = { ok: false, message: e.message?.slice(0, 60) }; }

      // OpenAI
      const keyPresent = !!openaiKey();
      const openai = { ok: keyPresent, message: keyPresent ? "Ключ настроен" : "Ключ отсутствует" };

      // Telegram
      const tgRunning = botManager.isRunning();
      const tgUsername = botManager.getBotUsername();
      const telegram = { ok: tgRunning, message: tgRunning ? `@${tgUsername}` : "Не запущен" };

      res.json({ supabase, bbb, openai, telegram });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/admin/diagnostics — расширенная диагностика всех подсистем
  app.get("/api/admin/diagnostics", requireAdmin, async (req, res) => {
    const t0 = Date.now();
    const timeout = (ms: number) => AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined as any;

    const { BUILTIN_SUPABASE_URL, BUILTIN_SUPABASE_ANON, openaiKey, BUILTIN_BBB_URL } = await import("./builtin-config");

    async function checkService(fn: () => Promise<any>): Promise<{ ok: boolean; message: string; latency?: number }> {
      const start = Date.now();
      try {
        const result = await fn();
        return { ok: true, message: result, latency: Date.now() - start };
      } catch (e: any) {
        return { ok: false, message: e.message?.slice(0, 80) || "Ошибка", latency: Date.now() - start };
      }
    }

    // ── Supabase ──────────────────────────────────────────────────────────────
    const supabase = await checkService(async () => {
      const url = process.env.SUPABASE_URL || BUILTIN_SUPABASE_URL;
      const key = process.env.SUPABASE_ANON_KEY || BUILTIN_SUPABASE_ANON;
      const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key }, signal: timeout(5000) });
      if (!r.ok && r.status >= 500) throw new Error(`HTTP ${r.status}`);
      // Try a quick count
      const r2 = await fetch(`${url}/rest/v1/Tvoy_vector_2_tutors?select=count`, {
        headers: { apikey: key, Prefer: "count=exact", Range: "0-0" }, signal: timeout(5000),
      });
      const count = r2.headers.get("content-range")?.split("/")?.[1] ?? "?";
      return `Подключён · ${count} репетиторов в БД`;
    });

    // ── BBB ───────────────────────────────────────────────────────────────────
    const aiSettings = await storage.getAiSettings().catch(() => ({} as any));
    const bbb = await checkService(async () => {
      const url = (aiSettings.bbb_url || process.env.BBB_URL || BUILTIN_BBB_URL).replace(/\/$/, "");
      const r = await fetch(`${url}/api/`, { signal: timeout(5000) });
      if (!r.ok && r.status >= 500) throw new Error(`HTTP ${r.status}`);
      const { getActiveMeetingsCount } = await import("./bbb");
      const meetingsCount = await getActiveMeetingsCount().catch(() => 0);
      return `Подключён · ${meetingsCount} активных конференций`;
    });

    // ── OpenAI ────────────────────────────────────────────────────────────────
    const openai = await checkService(async () => {
      const key = openaiKey();
      if (!key) throw new Error("API-ключ не настроен");
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` }, signal: timeout(7000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return "Ключ активен · API отвечает";
    });

    // ── Telegram ──────────────────────────────────────────────────────────────
    const tgRunning = botManager.isRunning();
    const tgUsername = botManager.getBotUsername();
    const telegram = {
      ok: tgRunning,
      message: tgRunning ? `@${tgUsername} — работает` : "Бот не запущен",
      latency: 0,
    };

    // ── YooKassa ─────────────────────────────────────────────────────────────
    const yookassa = await checkService(async () => {
      const r = await fetch("https://api.yookassa.ru/v3/", { signal: timeout(5000) });
      // YooKassa returns 401 Unauthorized — that's fine, it means the API is up
      if (r.status === 401 || r.status === 200 || r.status === 404) return "API доступен (требует авторизации)";
      throw new Error(`HTTP ${r.status}`);
    });

    // ── Database stats ────────────────────────────────────────────────────────
    let dbStats = { tutors: 0, students: 0, lessons: 0, payments: 0, pendingPayments: 0, todayPayments: 0, todayRevenue: 0 };
    try {
      const { supabase: sb } = await import("./supabase");
      const tbl = "Tvoy_vector_2_";
      const [t, s, l, p, pp, tp] = await Promise.all([
        sb.from(`${tbl}tutors`).select("id", { count: "exact", head: true }),
        sb.from(`${tbl}students`).select("id", { count: "exact", head: true }),
        sb.from(`${tbl}lessons`).select("id", { count: "exact", head: true }),
        sb.from(`${tbl}payments`).select("id", { count: "exact", head: true }),
        sb.from(`${tbl}payments`).select("id", { count: "exact", head: true }).eq("yookassa_status", "pending"),
        sb.from(`${tbl}payments`).select("amount").gte("created_at", new Date().toISOString().slice(0, 10)),
      ]);
      dbStats.tutors = t.count ?? 0;
      dbStats.students = s.count ?? 0;
      dbStats.lessons = l.count ?? 0;
      dbStats.payments = p.count ?? 0;
      dbStats.pendingPayments = pp.count ?? 0;
      const todayPmts = (tp.data ?? []) as { amount: number }[];
      dbStats.todayPayments = todayPmts.length;
      dbStats.todayRevenue = todayPmts.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
    } catch {}

    // ── System metrics ────────────────────────────────────────────────────────
    const mem = process.memoryUsage();
    const system = {
      nodeVersion: process.version,
      uptime: Math.round(process.uptime()),
      memRss: Math.round(mem.rss / 1024 / 1024),
      memHeap: Math.round(mem.heapUsed / 1024 / 1024),
      memHeapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      platform: process.platform,
      pid: process.pid,
      totalCheckTime: Date.now() - t0,
    };

    // ── Subscription status ───────────────────────────────────────────────────
    let subscriptionStats = { free: 0, pro: 0, premium: 0, expiringSoon: 0 };
    try {
      const { supabase: sb } = await import("./supabase");
      const { data: tutorRows } = await sb.from("Tvoy_vector_2_tutors").select("subscription_tier,subscription_until");
      if (tutorRows) {
        const now = new Date();
        const soon = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
        for (const t of tutorRows as { subscription_tier: string; subscription_until: string | null }[]) {
          if (t.subscription_tier === "premium") subscriptionStats.premium++;
          else if (t.subscription_tier === "pro") subscriptionStats.pro++;
          else subscriptionStats.free++;
          if (t.subscription_until && new Date(t.subscription_until) < soon && new Date(t.subscription_until) > now) {
            subscriptionStats.expiringSoon++;
          }
        }
      }
    } catch {}

    res.json({
      checkedAt: new Date().toISOString(),
      services: { supabase, bbb, openai, telegram, yookassa },
      dbStats,
      system,
      subscriptionStats,
    });
  });

  // ======= ADMIN SUBSCRIPTION ROUTES =======

  // GET /api/admin/payments - Все платежи учеников (админ)
  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || "500"), 2000);
      const status = req.query.status as string | undefined; // succeeded|pending|canceled|all
      const method = req.query.method as string | undefined; // онлайн|наличные|перевод|all
      const all = await storage.getAllPayments(limit);

      let filtered = all;
      if (status && status !== "all") {
        filtered = filtered.filter(p =>
          status === "manual"
            ? !(p as any).yookassaPaymentId
            : (p as any).yookassaStatus === status
        );
      }
      if (method && method !== "all") {
        filtered = filtered.filter(p => (p as any).method === method);
      }

      // Enrich with tutor + student names
      const tutorIds = Array.from(new Set(filtered.map(p => p.tutorId)));
      const studentIds = Array.from(new Set(filtered.map(p => p.studentId).filter(Boolean)));
      const [tutors, students] = await Promise.all([
        Promise.all(tutorIds.map(id => storage.getTutor(id).catch(() => null))),
        Promise.all(studentIds.map(id => storage.getStudent(id).catch(() => null))),
      ]);
      const tMap = new Map(tutors.filter(Boolean).map((t: any) => [t.id, { name: t.name, email: t.email }]));
      const sMap = new Map(students.filter(Boolean).map((s: any) => [s.id, s.name]));

      res.json(filtered.map(p => ({
        ...p,
        tutorName: tMap.get(p.tutorId)?.name || null,
        tutorEmail: tMap.get(p.tutorId)?.email || null,
        studentName: p.studentId ? (sMap.get(p.studentId) || null) : null,
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/subscription-payments - Все платежи за подписки (админ)
  app.get("/api/admin/subscription-payments", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || "500"), 2000);
      const status = req.query.status as string | undefined;
      const all = await storage.getAllSubscriptionPayments(limit);
      const filtered = (status && status !== "all") ? all.filter(p => (p as any).status === status) : all;

      const tutorIds = Array.from(new Set(filtered.map(p => p.tutorId)));
      const tutors = await Promise.all(tutorIds.map(id => storage.getTutor(id).catch(() => null)));
      const tMap = new Map(tutors.filter(Boolean).map((t: any) => [t.id, { name: t.name, email: t.email }]));

      res.json(filtered.map(p => ({
        ...p,
        tutorName: tMap.get(p.tutorId)?.name || null,
        tutorEmail: tMap.get(p.tutorId)?.email || null,
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/payments/:id/refund - Возврат платежа ученика через ЮKassa (админ)
  app.post("/api/admin/payments/:id/refund", requireAdmin, async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) return res.status(404).json({ error: "Платёж не найден" });

      const yId = (payment as any).yookassaPaymentId;
      if (!yId) return res.status(400).json({ error: "Это ручной платёж — возврат через ЮKassa невозможен" });
      if ((payment as any).yookassaStatus === "refunded") {
        return res.status(400).json({ error: "Возврат уже оформлен" });
      }
      if ((payment as any).yookassaStatus !== "succeeded") {
        return res.status(400).json({ error: "Возврат возможен только для успешных платежей" });
      }
      if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
        return res.status(400).json({ error: "ЮKassa не настроена" });
      }

      const amount = typeof req.body?.amount === "number" ? req.body.amount : payment.amount;

      // ЮKassa Refunds API (HTTP, т.к. SDK не всегда экспортирует)
      const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString("base64");
      // Детерминированный ключ — защита от двойного возврата при повторных кликах
      const idemKey = `refund_${payment.id}_${amount}`;
      const r = await fetch("https://api.yookassa.ru/v3/refunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${auth}`,
          "Idempotence-Key": idemKey,
        },
        body: JSON.stringify({
          payment_id: yId,
          amount: { value: amount.toFixed(2), currency: "RUB" },
        }),
      });
      const refundData = await r.json();
      if (!r.ok) {
        return res.status(400).json({ error: refundData?.description || "Ошибка возврата ЮKassa" });
      }

      // Обновляем платёж и баланс ученика
      await storage.updatePayment(payment.id, { yookassaStatus: "refunded" } as any);
      if (payment.studentId) {
        const student = await storage.getStudent(payment.studentId);
        if (student) {
          await storage.updateStudent(payment.studentId, {
            balance: Math.max(0, student.balance - amount),
          });
        }
      }

      res.json({ success: true, refund: refundData });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/subscription/prices - Получить цены подписок (админ)
  app.get("/api/admin/subscription/prices", requireAdmin, async (req, res) => {
    try {
      const prices = await storage.getSubscriptionPrices();
      res.json(prices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/admin/subscription/prices/:tier - Обновить цены подписки (админ)
  app.patch("/api/admin/subscription/prices/:tier", requireAdmin, async (req, res) => {
    try {
      const tier = req.params.tier;
      const schema = z.object({
        priceMonthly: z.number().positive().optional(),
        priceYearly: z.number().positive().optional(),
        features: z.array(z.string()).optional(),
      });

      const updates = schema.parse(req.body);
      const price = await storage.updateSubscriptionPrice(tier, updates);

      if (!price) {
        return res.status(404).json({ error: "Тариф не найден" });
      }

      res.json(price);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ======= NOTIFICATIONS ROUTES =======

  // GET /api/notifications - Получить уведомления
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const notifications = await storage.getNotificationsByTutorId(tutorId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/notifications/count - Количество непрочитанных
  app.get("/api/notifications/count", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const count = await storage.getUnreadNotificationsCount(tutorId);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/notifications/:id/read - Отметить как прочитанное
  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/notifications/read-all - Отметить все как прочитанные
  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      await storage.markAllNotificationsRead(tutorId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= LESSON TEMPLATES ROUTES =======

  // GET /api/lesson-templates - Получить шаблоны занятий
  app.get("/api/lesson-templates", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const templates = await storage.getLessonTemplatesByTutorId(tutorId);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/lesson-templates/public - Публичные шаблоны
  app.get("/api/lesson-templates/public", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getPublicLessonTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/lesson-templates - Создать шаблон
  app.post("/api/lesson-templates", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const schema = z.object({
        title: z.string().min(1),
        subject: z.string().min(1),
        description: z.string().optional(),
        duration: z.number().positive().default(60),
        objectives: z.array(z.string()).default([]),
        materials: z.array(z.string()).default([]),
        activities: z.array(z.object({
          title: z.string(),
          duration: z.number(),
          description: z.string().optional(),
        })).default([]),
        isPublic: z.boolean().default(false),
      });

      const data = schema.parse(req.body);
      const template = await storage.createLessonTemplate({ ...data, tutorId });
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // PATCH /api/lesson-templates/:id - Обновить шаблон
  app.patch("/api/lesson-templates/:id", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1).optional(),
        subject: z.string().min(1).optional(),
        description: z.string().optional(),
        duration: z.number().positive().optional(),
        objectives: z.array(z.string()).optional(),
        materials: z.array(z.string()).optional(),
        activities: z.array(z.object({
          title: z.string(),
          duration: z.number(),
          description: z.string().optional(),
        })).optional(),
        isPublic: z.boolean().optional(),
      });

      const updates = schema.parse(req.body);
      const template = await storage.updateLessonTemplate(req.params.id, updates);

      if (!template) {
        return res.status(404).json({ error: "Шаблон не найден" });
      }

      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /api/lesson-templates/:id - Удалить шаблон
  app.delete("/api/lesson-templates/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteLessonTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= ANALYTICS ROUTES =======

  // GET /api/analytics/income - Статистика доходов (по проведённым занятиям)
  app.get("/api/analytics/income", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const students = await storage.getStudentsByTutorId(tutorId);
      const lessons = await storage.getLessonsByTutorId(tutorId, 1000);
      const completedLessons = lessons.filter(l =>
        (l.status === 'completed' && l.attendance === 'attended') ||
        (l.status === 'cancelled' && l.attendance === 'missed_paid')
      );

      // Группируем по месяцам
      const monthlyIncome: Record<string, number> = {};
      const now = new Date();

      // Инициализируем последние 12 месяцев
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyIncome[key] = 0;
      }

      const calcCost = (lesson: any, student: any) => {
        if (!student) return 0;
        const dur = lesson.durationMinutes || 60;
        return Math.round(student.pricePerLesson * dur / 60);
      };

      for (const lesson of completedLessons) {
        const date = new Date(lesson.scheduledAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyIncome[key] !== undefined) {
          const student = students.find(s => s.id === lesson.studentId);
          monthlyIncome[key] += calcCost(lesson, student);
        }
      }

      const totalIncome = completedLessons.reduce((sum, l) => {
        const student = students.find(s => s.id === l.studentId);
        return sum + calcCost(l, student);
      }, 0);
      const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const thisMonthIncome = monthlyIncome[thisMonthKey] || 0;

      res.json({
        monthly: Object.entries(monthlyIncome).map(([month, amount]) => ({ month, amount })),
        total: totalIncome,
        thisMonth: thisMonthIncome,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/analytics/students - Статистика учеников
  app.get("/api/analytics/students", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const students = await storage.getStudentsByTutorId(tutorId);
      const lessons = await storage.getLessonsByTutorId(tutorId, 1000);

      // Статистика по ученикам
      const studentStats = students.map(student => {
        const studentLessons = lessons.filter(l => l.studentId === student.id);
        const completedLessons = studentLessons.filter(l => l.status === 'completed').length;
        const avgRating = studentLessons
          .filter(l => l.rating)
          .reduce((sum, l, _, arr) => sum + (l.rating || 0) / arr.length, 0);

        return {
          id: student.id,
          name: student.name,
          subject: student.subject,
          lessonsCompleted: completedLessons,
          averageRating: avgRating || null,
          progress: student.progress,
          balance: student.balance,
        };
      });

      // Общая статистика
      const activeStudents = students.filter(s => s.isActive).length;
      const totalLessons = lessons.filter(l => l.status === 'completed').length;

      res.json({
        students: studentStats,
        summary: {
          totalStudents: students.length,
          activeStudents,
          totalLessons,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/analytics/overview - Общая статистика
  app.get("/api/analytics/overview", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const students = await storage.getStudentsByTutorId(tutorId);
      const lessons = await storage.getLessonsByTutorId(tutorId, 1000);
      const payments = await storage.getPaymentsByTutorId(tutorId, 365);

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      // Занятия за этот месяц
      const lessonsThisMonth = lessons.filter(l => {
        const date = new Date(l.scheduledAt);
        return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
      });

      const completedLessonsThisMonthList = lessonsThisMonth.filter(l =>
        (l.status === 'completed' && l.attendance === 'attended') ||
        (l.status === 'cancelled' && l.attendance === 'missed_paid')
      );
      const calcCostD = (lesson: any, student: any) => {
        if (!student) return 0;
        const dur = lesson.durationMinutes || 60;
        return Math.round(student.pricePerLesson * dur / 60);
      };
      const incomeThisMonth = completedLessonsThisMonthList.reduce((sum, l) => {
        const student = students.find(s => s.id === l.studentId);
        return sum + calcCostD(l, student);
      }, 0);

      // Предстоящие занятия
      const upcomingLessons = lessons.filter(l => 
        new Date(l.scheduledAt) > now && l.status === 'pending'
      ).length;

      // Статистика посещаемости
      const completedLessons = lessons.filter(l => l.status === 'completed').length;
      const cancelledLessons = lessons.filter(l => l.status === 'cancelled').length;

      // Средняя ставка
      const activePrices = students.filter(s => s.isActive).map(s => s.pricePerLesson);
      const avgLessonPrice = activePrices.length > 0 
        ? Math.round(activePrices.reduce((a, b) => a + b, 0) / activePrices.length) 
        : 0;

      // Распределение занятий по дням недели (текущая + следующая неделя)
      const lessonsByWeekday = [0, 0, 0, 0, 0, 0, 0]; // Вс, Пн, Вт, Ср, Чт, Пт, Сб
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() + mondayOffset);
      const endOfNextWeek = new Date(startOfWeek);
      endOfNextWeek.setDate(startOfWeek.getDate() + 14);
      
      lessons.forEach(l => {
        const lessonDate = new Date(l.scheduledAt);
        if (lessonDate >= startOfWeek && lessonDate < endOfNextWeek) {
          const day = lessonDate.getDay();
          lessonsByWeekday[day]++;
        }
      });

      res.json({
        activeStudents: students.filter(s => s.isActive).length,
        totalStudents: students.length,
        lessonsThisMonth: lessonsThisMonth.length,
        completedLessonsThisMonth: lessonsThisMonth.filter(l => l.status === 'completed').length,
        incomeThisMonth,
        upcomingLessons,
        totalBalance: students.reduce((sum, s) => sum + s.balance, 0),
        completedLessons,
        cancelledLessons,
        avgLessonPrice,
        lessonsByWeekday,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= EMAIL NOTIFICATIONS =======
  
  // POST /api/notifications/lesson-reminder - Send lesson reminder email
  app.post("/api/notifications/lesson-reminder", requireAuth, async (req, res) => {
    try {
      const tutorId = (req as any).session.tutorId;
      const tutor = await storage.getTutor(tutorId);
      if (!tutor) {
        return res.status(401).json({ error: "Репетитор не найден" });
      }

      const schema = z.object({
        lessonId: z.string(),
        customMessage: z.string().optional(),
      });

      const { lessonId, customMessage } = schema.parse(req.body);

      const lesson = await storage.getLesson(lessonId);
      if (!lesson || lesson.tutorId !== tutorId) {
        return res.status(404).json({ error: "Занятие не найдено" });
      }

      const student = await storage.getStudent(lesson.studentId);
      if (!student) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      if (!student.email) {
        return res.status(400).json({ error: "У ученика не указан email" });
      }

      // Check SMTP settings
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || smtpUser;

      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(400).json({ 
          error: "SMTP не настроен. Добавьте SMTP_HOST, SMTP_USER, SMTP_PASS в Secrets." 
        });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || "587"),
        secure: smtpPort === "465",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: { rejectUnauthorized: false },
      });

      const lessonDate = new Date(lesson.scheduledAt);
      const formattedDate = lessonDate.toLocaleDateString("ru-RU", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const formattedTime = lessonDate.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const subject = `Напоминание о занятии: ${student.subject}`;
      const text = customMessage || `Здравствуйте!

Напоминаем о предстоящем занятии:

Предмет: ${student.subject}
Тема: ${lesson.topic || "Не указана"}
Дата: ${formattedDate}
Время: ${formattedTime}
Продолжительность: ${lesson.durationMinutes} минут

С уважением,
${tutor.name}`;

      await transporter.sendMail({
        from: smtpFrom,
        to: student.email,
        subject,
        text,
      });

      res.json({ success: true, message: "Уведомление отправлено" });
    } catch (error: any) {
      console.error("Email send error:", error);
      res.status(500).json({ error: error.message || "Ошибка отправки email" });
    }
  });

  // ======= BOT API ROUTES (for n8n / external integrations) =======
  
  const requireBotAuth = async (req: any, res: any, next: any) => {
    const token = req.headers["x-bot-token"];
    if (!token) {
      return res.status(401).json({ error: "Missing X-Bot-Token header" });
    }
    const tutor = await storage.getTutorByBotToken(token as string);
    if (!tutor) {
      return res.status(401).json({ error: "Invalid bot token" });
    }
    req.tutor = tutor;
    next();
  };

  app.post("/api/bot/token", requireAuth, async (req, res) => {
    try {
      const tutorId = (req as any).session?.tutorId;
      const token = randomUUID();
      await storage.setBotToken(tutorId, token);
      res.json({ token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bot/token", requireAuth, async (req, res) => {
    try {
      const tutorId = (req as any).session?.tutorId;
      const tutor = await storage.getTutor(tutorId);
      res.json({ token: tutor?.botToken || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= VOICE INPUT — Whisper-based Speech-to-Text =======
  // POST /api/voice/transcribe — accepts audio blob (webm/mp3/wav/m4a/ogg)
  // and returns the transcribed text. Used by the voice-input button across
  // all chat interfaces (tutor, student, AI assistant).
  app.post(
    "/api/voice/transcribe",
    requireAuth,
    voiceUpload.single("audio"),
    async (req, res) => {
      try {
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file || !file.buffer || file.size === 0) {
          return res.status(400).json({ error: "Аудио не получено" });
        }
        const apiKey = openaiKey();
        if (!apiKey) {
          return res.status(503).json({ error: "OpenAI не настроен" });
        }

        // Map MIME type to a sensible filename — Whisper auto-detects from the extension.
        const mime = (file.mimetype || "").toLowerCase();
        let ext = "webm";
        if (mime.includes("mp3") || mime.includes("mpeg")) ext = "mp3";
        else if (mime.includes("wav")) ext = "wav";
        else if (mime.includes("mp4") || mime.includes("m4a")) ext = "m4a";
        else if (mime.includes("ogg")) ext = "ogg";
        else if (mime.includes("webm")) ext = "webm";

        const lang = typeof req.body?.lang === "string" && req.body.lang ? req.body.lang : "ru";

        const oai = new OpenAI({ apiKey });
        const audioFile = await toFile(file.buffer, `voice.${ext}`, { type: file.mimetype || `audio/${ext}` });
        const result = await oai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
          language: lang,
        });
        res.json({ text: (result as any).text || "" });
      } catch (e: any) {
        console.error("voice/transcribe error:", e?.message);
        res.status(500).json({ error: e?.message || "Не удалось распознать речь" });
      }
    }
  );

  // ======= TELEGRAM BOT MANAGEMENT ROUTES =======

  // POST /api/telegram/webhook — Telegram delivers updates here in production.
  // Secured by the X-Telegram-Bot-Api-Secret-Token header that Telegram echoes.
  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      const expected = botManager.getWebhookSecret();
      const got = req.get("x-telegram-bot-api-secret-token") || "";
      if (!expected || got !== expected) {
        return res.status(401).end();
      }
      // Acknowledge immediately so Telegram doesn't retry; processing is async.
      res.status(200).end();
      botManager.processUpdate(req.body);
    } catch (e: any) {
      // Already responded above, log only.
      console.error("telegram webhook error:", e?.message);
    }
  });

  // GET /api/telegram/status — platform bot status + tutor/student link info
  app.get("/api/telegram/status", requireAuth, async (req, res) => {
    try {
      const tutorId = (req as any).session?.tutorId;
      const tutor = await storage.getTutor(tutorId);
      const students = await storage.getStudentsByTutorId(tutorId);
      const botRunning = botManager.isRunning();
      const botUsername = botManager.getBotUsername();
      const tutorLink = botRunning ? botManager.getTutorLink(tutorId) : null;
      res.json({
        botRunning,
        botUsername: botUsername || null,
        tutorLinked: !!tutor?.tutorChatId,
        notificationsEnabled: (tutor as any)?.tutorTelegramNotificationsEnabled !== false,
        tutorLink,
        students: students.filter(s => s.isActive).map(s => ({
          id: s.id,
          name: s.name,
          telegramLinked: !!s.telegramChatId,
          inviteLink: botRunning ? botManager.getStudentLink(s.id) : null,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/telegram/generate-code — generate a 6-digit link code for current user
  app.post("/api/telegram/generate-code", requireAuth, async (req, res) => {
    try {
      const tutorId = (req as any).session?.tutorId;
      if (!tutorId) return res.status(401).json({ error: "Not authenticated" });
      if (!botManager.isRunning()) return res.status(400).json({ error: "Telegram бот не настроен" });

      const { type, studentId } = z.object({
        type: z.enum(["tutor", "student"]),
        studentId: z.string().optional(),
      }).parse(req.body);

      let code: string;
      if (type === "student" && studentId) {
        const student = await storage.getStudent(studentId);
        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ error: "Ученик не найден" });
        }
        code = await botManager.generateCode("student", studentId);
      } else {
        code = await botManager.generateCode("tutor", tutorId);
      }

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      res.json({ code, expiresAt, botUsername: botManager.getBotUsername() });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/telegram/admin/token — platform admin sets bot token
  app.post("/api/telegram/admin/token", requireAuth, async (req, res) => {
    try {
      const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
      await storage.setAiSetting("telegram_bot_token", token);
      await botManager.start(token);
      res.json({ ok: true, botUsername: botManager.getBotUsername() });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /api/telegram/admin/token — remove platform bot token and stop bot
  app.delete("/api/telegram/admin/token", requireAuth, async (req, res) => {
    try {
      await botManager.stop();
      await storage.setAiSetting("telegram_bot_token", "");
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/telegram/notifications — toggle tutor notification setting
  app.patch("/api/telegram/notifications", requireAuth, async (req, res) => {
    try {
      const tutorId = (req as any).session?.tutorId;
      if (!tutorId) return res.status(401).json({ error: "Not authenticated" });
      const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
      await storage.updateTutor(tutorId, { tutorTelegramNotificationsEnabled: enabled } as any);
      res.json({ success: true, notificationsEnabled: enabled });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/telegram/unlink-tutor — unlink current tutor's Telegram
  app.post("/api/telegram/unlink-tutor", requireAuth, async (req, res) => {
    try {
      const tutorId = (req as any).session?.tutorId;
      await storage.updateTutor(tutorId, { tutorChatId: null } as any);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/telegram/student-link/:studentId — get invite link for a student
  app.get("/api/telegram/student-link/:studentId", requireAuth, async (req, res) => {
    try {
      const tutorId = (req as any).session?.tutorId;
      const studentId = req.params.studentId;
      const student = await storage.getStudent(studentId);
      if (!student || student.tutorId !== tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }
      if (!botManager.isRunning()) {
        return res.status(400).json({ error: "Telegram бот не настроен" });
      }
      const link = botManager.getStudentLink(studentId);
      res.json({ link, botUsername: botManager.getBotUsername() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/telegram/unlink-student/:studentId — unlink student Telegram
  app.post("/api/telegram/unlink-student/:studentId", requireAuth, async (req, res) => {
    try {
      const tutorId = (req as any).session?.tutorId;
      const studentId = req.params.studentId;
      const student = await storage.getStudent(studentId);
      if (!student || student.tutorId !== tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }
      await storage.updateStudent(studentId, { telegramChatId: null } as any);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bot/today", requireBotAuth, async (req, res) => {
    try {
      const tutor = (req as any).tutor;
      const lessons = await storage.getLessonsByTutorId(tutor.id);
      const students = await storage.getStudentsByTutorId(tutor.id);
      const tz = tutor.timezone || "Europe/Moscow";
      
      const now = new Date();
      const todayStr = now.toLocaleDateString("sv-SE", { timeZone: tz });
      
      const todayLessons = lessons
        .filter((l: any) => {
          const lDate = new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz });
          return lDate === todayStr;
        })
        .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .map((l: any) => {
          const student = students.find((s: any) => s.id === l.studentId);
          return {
            time: new Date(l.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz }),
            student: student?.name || "—",
            subject: student?.subject || "",
            topic: l.topic,
            duration: l.durationMinutes,
            status: l.status,
          };
        });
      
      res.json({ date: todayStr, lessons: todayLessons, count: todayLessons.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bot/students", requireBotAuth, async (req, res) => {
    try {
      const tutor = (req as any).tutor;
      const students = await storage.getStudentsByTutorId(tutor.id);
      const list = students
        .filter((s: any) => s.isActive)
        .map((s: any) => ({
          name: s.name,
          subject: s.subject,
          goal: s.goal,
          grade: s.grade,
          lessonsCompleted: s.lessonsCompleted,
        }));
      res.json({ students: list, count: list.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bot/homework", requireBotAuth, async (req, res) => {
    try {
      const tutor = (req as any).tutor;
      const students = await storage.getStudentsByTutorId(tutor.id);
      const allHomework: any[] = [];
      
      for (const student of students) {
        const hw = await storage.getHomeworkByStudentId(student.id);
        const pending = hw
          .filter((h: any) => h.status === "submitted")
          .map((h: any) => ({
            student: student.name,
            title: h.title,
            submittedAt: h.submittedAt,
            deadline: h.deadline,
          }));
        allHomework.push(...pending);
      }
      
      res.json({ homework: allHomework, count: allHomework.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bot/stats", requireBotAuth, async (req, res) => {
    try {
      const tutor = (req as any).tutor;
      const students = await storage.getStudentsByTutorId(tutor.id);
      const lessons = await storage.getLessonsByTutorId(tutor.id);
      const tz = tutor.timezone || "Europe/Moscow";
      
      const now = new Date();
      const todayStr = now.toLocaleDateString("sv-SE", { timeZone: tz });
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const todayLessons = lessons.filter((l: any) => {
        const lDate = new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz });
        return lDate === todayStr;
      });
      
      const monthCompleted = lessons.filter((l: any) => 
        l.status === "completed" && new Date(l.scheduledAt) >= monthStart
      );
      
      const monthIncome = monthCompleted.reduce((sum: number, l: any) => {
        const student = students.find((s: any) => s.id === l.studentId);
        if (!student) return sum;
        const dur = l.durationMinutes || 60;
        return sum + Math.round(student.pricePerLesson * dur / 60);
      }, 0);

      let uncheckedHomework = 0;
      for (const student of students) {
        const hw = await storage.getHomeworkByStudentId(student.id);
        uncheckedHomework += hw.filter((h: any) => h.status === "submitted").length;
      }
      
      res.json({
        activeStudents: students.filter((s: any) => s.isActive).length,
        todayLessons: todayLessons.length,
        todayPending: todayLessons.filter((l: any) => l.status === "pending").length,
        todayCompleted: todayLessons.filter((l: any) => l.status === "completed").length,
        monthLessons: monthCompleted.length,
        monthIncome,
        uncheckedHomework,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bot/next-lesson", requireBotAuth, async (req, res) => {
    try {
      const tutor = (req as any).tutor;
      const lessons = await storage.getLessonsByTutorId(tutor.id);
      const students = await storage.getStudentsByTutorId(tutor.id);
      const tz = tutor.timezone || "Europe/Moscow";
      
      const now = new Date();
      const upcoming = lessons
        .filter((l: any) => l.status === "pending" && new Date(l.scheduledAt) > now)
        .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      
      if (upcoming.length === 0) {
        return res.json({ lesson: null });
      }
      
      const next = upcoming[0];
      const student = students.find((s: any) => s.id === next.studentId);
      const scheduledAt = new Date(next.scheduledAt);
      const minutesUntil = Math.round((scheduledAt.getTime() - now.getTime()) / 60000);
      
      res.json({
        lesson: {
          time: scheduledAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz }),
          date: scheduledAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: tz }),
          student: student?.name || "—",
          subject: student?.subject || "",
          topic: next.topic,
          duration: next.durationMinutes,
          minutesUntil,
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= BOARD MANAGEMENT ROUTES =======
  const TABLE_PREFIX = "Tvoy_vector_2_";

  app.get("/api/boards", requireAuth, async (req, res) => {
    try {
      const { supabase: sb } = await import("./supabase");
      const students = await storage.getStudentsByTutorId(req.session.tutorId!);
      const { data: boards } = await sb
        .from(`${TABLE_PREFIX}boards`)
        .select("student_id, updated_at");
      const boardMap = new Map((boards || []).map((b: any) => [b.student_id, b.updated_at]));
      const result = students.map((s) => ({
        id: s.id,
        name: s.name,
        subject: s.subject,
        hasData: boardMap.has(s.id),
        updatedAt: boardMap.get(s.id) || null,
      }));
      res.json(result);
    } catch (err: any) {
      console.error("Boards API error:", err?.message || err);
      res.status(500).json({ error: "Ошибка загрузки досок" });
    }
  });

  app.delete("/api/boards/:studentId", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      const { supabase: sb } = await import("./supabase");
      await sb.from(`${TABLE_PREFIX}boards`).delete().eq("student_id", studentId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Ошибка очистки доски" });
    }
  });

  app.post("/api/boards/temp", requireAuth, async (req, res) => {
    const { randomUUID } = await import("crypto");
    const tempId = `temp-${randomUUID()}`;
    res.json({ tempId, boardUrl: `/board/${tempId}` });
  });

  // ======= BOARD ARCHIVE ROUTES =======

  app.get("/api/board-archives/:studentId", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      const { data, error } = await (await import("./supabase")).supabase
        .from(`${TABLE_PREFIX}board_archives`)
        .select("id, name, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/board-archives/:studentId", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      const { name } = req.body;
      const { supabase } = await import("./supabase");
      const { data: board } = await supabase.from(`${TABLE_PREFIX}boards`).select("snapshot").eq("student_id", studentId).single();
      if (!board?.snapshot) return res.status(400).json({ error: "Board is empty" });
      const { data, error } = await supabase.from(`${TABLE_PREFIX}board_archives`).insert({
        student_id: studentId,
        snapshot: board.snapshot,
        name: name || `Архив ${new Date().toLocaleDateString("ru-RU")}`,
      }).select().single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/board-archives/:studentId/:archiveId/snapshot", requireAuth, async (req, res) => {
    try {
      const { archiveId } = req.params;
      const { data, error } = await (await import("./supabase")).supabase
        .from(`${TABLE_PREFIX}board_archives`)
        .select("snapshot, name")
        .eq("id", archiveId)
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/board-archives/:archiveId", requireAuth, async (req, res) => {
    try {
      const { archiveId } = req.params;
      const { error } = await (await import("./supabase")).supabase
        .from(`${TABLE_PREFIX}board_archives`)
        .delete()
        .eq("id", archiveId);
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/board/ws-token — Tutor requests a short-lived WS auth token
  app.post("/api/board/ws-token", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const { studentId } = req.body;

      if (!studentId || typeof studentId !== "string") {
        return res.status(400).json({ error: "studentId required" });
      }

      // Verify the student belongs to this tutor (or it's a temp room)
      if (!studentId.startsWith("temp-")) {
        const student = await storage.getStudent(studentId);
        if (!student || student.tutorId !== tutorId) {
          return res.status(403).json({ error: "Нет доступа к доске этого ученика" });
        }
      }

      const token = generateBoardWsToken(studentId, "tutor", tutorId);
      res.json({ token, expiresIn: 45 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= LESSON HISTORY ROUTES =======

  app.get("/api/lesson-history/:studentId", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      const { data, error } = await (await import("./supabase")).supabase
        .from(`${TABLE_PREFIX}lesson_history`)
        .select("*")
        .eq("student_id", studentId)
        .order("changed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/lesson-history", requireAuth, async (req, res) => {
    try {
      const tutorId = (req.session as any).tutorId;
      const { lesson_id, student_id, old_status, new_status, old_attendance, new_attendance, note } = req.body;
      const { error } = await (await import("./supabase")).supabase
        .from(`${TABLE_PREFIX}lesson_history`)
        .insert({ lesson_id, student_id, tutor_id: tutorId, old_status, new_status, old_attendance, new_attendance, note });
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= AVATAR ROUTES =======

  app.post("/api/avatar/tutor", requireAuth, async (req, res) => {
    try {
      const tutorId = (req.session as any).tutorId;
      const { avatar } = req.body;
      if (!avatar || typeof avatar !== "string") return res.status(400).json({ error: "No avatar provided" });
      if (avatar.length > 500000) return res.status(400).json({ error: "Avatar too large (max ~375KB)" });
      await (await import("./supabase")).supabase.from(`${TABLE_PREFIX}tutors`).update({ avatar }).eq("id", tutorId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/avatar/student/:studentId", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      const { avatar } = req.body;
      if (!avatar || typeof avatar !== "string") return res.status(400).json({ error: "No avatar provided" });
      if (avatar.length > 500000) return res.status(400).json({ error: "Avatar too large (max ~375KB)" });
      await (await import("./supabase")).supabase.from(`${TABLE_PREFIX}students`).update({ avatar }).eq("id", studentId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= HOMEWORK TEMPLATES =======

  app.get("/api/homework-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getHomeworkTemplatesByTutorId(req.session.tutorId!);
      res.json(templates);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/homework-templates", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        subject: z.string().optional(),
        hints: z.string().optional(),
        estimatedMinutes: z.number().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });
      const t = await storage.createHomeworkTemplate({ ...parsed.data, tutorId: req.session.tutorId! });
      res.json(t);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.put("/api/homework-templates/:id", requireAuth, async (req, res) => {
    try {
      const t = await storage.updateHomeworkTemplate(req.params.id, req.body);
      res.json(t);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.delete("/api/homework-templates/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteHomeworkTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ======= MONTHLY GOALS =======

  app.get("/api/tutor/monthly-goals", requireAuth, async (req, res) => {
    try {
      const goals = await storage.getTutorMonthlyGoals(req.session.tutorId!);
      res.json(goals);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.put("/api/tutor/monthly-goals", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        lessonsTarget: z.number().optional(),
        incomeTarget: z.number().optional(),
        newStudentsTarget: z.number().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });
      await storage.updateTutorMonthlyGoals(req.session.tutorId!, parsed.data);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ======= TUTOR NOTES ON STUDENT =======

  app.put("/api/students/:id/tutor-notes", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const student = await storage.getStudent(id);
      if (!student || student.tutorId !== req.session.tutorId!) return res.status(404).json({ error: "Not found" });
      await storage.updateStudentTutorNotes(id, notes ?? "");
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ======= DIRECT MESSAGES (TUTOR SIDE) =======

  app.get("/api/direct-messages/:studentId", requireAuth, async (req, res) => {
    try {
      const student = await storage.getStudent(req.params.studentId);
      if (!student || student.tutorId !== req.session.tutorId!) return res.status(404).json({ error: "Not found" });
      await storage.markDirectMessagesRead(req.params.studentId, 'tutor');
      const messages = await storage.getDirectMessagesByStudentId(req.params.studentId);
      res.json(messages);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/direct-messages/:studentId", requireAuth, async (req, res) => {
    try {
      const student = await storage.getStudent(req.params.studentId);
      if (!student || student.tutorId !== req.session.tutorId!) return res.status(404).json({ error: "Not found" });
      const { content, fileUrls } = req.body;
      if (!content?.trim() && (!fileUrls || fileUrls.length === 0)) return res.status(400).json({ error: "Empty message" });
      const msg = await storage.createDirectMessage({
        tutorId: req.session.tutorId!,
        studentId: req.params.studentId,
        role: 'tutor',
        content: content?.trim() || '',
        fileUrls: fileUrls || [],
        isRead: false,
      });

      // Telegram notification to student
      const tutor = await storage.getTutor(req.session.tutorId!);
      const tutorName = tutor?.name || "Репетитор";
      const preview = (content?.trim() || "📎 файл").slice(0, 80);
      botManager.sendToStudent(req.params.studentId,
        `💬 <b>Сообщение от ${tutorName}</b>\n\n` +
        `${preview}${preview.length >= 80 ? "…" : ""}\n\n` +
        `Ответьте в своём кабинете Твой Вектор.`
      ).catch(() => {});

      res.json(msg);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.delete("/api/direct-messages/msg/:messageId", requireAuth, async (req, res) => {
    try {
      const msg = await storage.getDirectMessageById(req.params.messageId);
      if (!msg) return res.status(404).json({ error: "Not found" });
      const student = await storage.getStudent(msg.studentId);
      if (!student || student.tutorId !== req.session.tutorId!) return res.status(403).json({ error: "Forbidden" });
      if (msg.role !== 'tutor') return res.status(403).json({ error: "Можно удалять только свои сообщения" });
      await storage.deleteDirectMessage(req.params.messageId);
      res.json({ ok: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/direct-messages/:studentId/unread-count", requireAuth, async (req, res) => {
    try {
      const student = await storage.getStudent(req.params.studentId);
      if (!student || student.tutorId !== req.session.tutorId!) return res.status(404).json({ error: "Not found" });
      const count = await storage.getUnreadDirectMessageCount(req.params.studentId, 'tutor');
      res.json({ count });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // Unread summary for all students (tutor chat overview)
  app.get("/api/direct-messages-summary", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const students = await storage.getStudentsByTutorId(tutorId);
      const summary: Record<string, { unread: number; lastMessage: any }> = {};
      await Promise.all(students.map(async (s: any) => {
        const [unread, msgs] = await Promise.all([
          storage.getUnreadDirectMessageCount(s.id, 'tutor'),
          storage.getDirectMessagesByStudentId(s.id, 1),
        ]);
        summary[s.id] = { unread, lastMessage: msgs[0] || null };
      }));
      res.json(summary);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ======= PARENT CHAT (magic-link, no login) =======

  // Tutor: generate parent chat magic-link URL for a student
  app.post("/api/students/:id/parent-chat-link", requireAuth, async (req, res) => {
    try {
      const student = await storage.getStudent(req.params.id);
      if (!student || student.tutorId !== req.session.tutorId!) {
        return res.status(404).json({ error: "Not found" });
      }
      const token = generateParentChatToken(student.id);
      const origin = (req.headers.origin as string) || `${req.protocol}://${req.get("host")}`;
      const url = `${origin}/parent-chat?t=${token}`;
      // NOTE: token intentionally omitted from response body — URL is sensitive and
      // this path is excluded from response-body logging in server/index.ts.
      res.json({ url });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // Parent: resolve token → get student + tutor names (validates token)
  app.get("/api/parent/info", async (req, res) => {
    try {
      const token = String(req.query.t || "");
      const decoded = verifyParentChatToken(token);
      if (!decoded) return res.status(401).json({ error: "Ссылка недействительна или истекла" });
      const student = await storage.getStudent(decoded.studentId);
      if (!student) return res.status(404).json({ error: "Ученик не найден" });
      const tutor = await storage.getTutor(student.tutorId);
      res.json({
        studentId: student.id,
        studentName: student.name,
        subject: student.subject,
        tutorName: tutor?.name || "Репетитор",
      });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // Parent: list messages (marks tutor→parent messages as read)
  app.get("/api/parent/messages", async (req, res) => {
    try {
      const token = String(req.query.t || "");
      const decoded = verifyParentChatToken(token);
      if (!decoded) return res.status(401).json({ error: "Ссылка недействительна" });
      // Parent reads share the tutor→thread; this also clears the student's unread
      // indicator for the same thread, which is acceptable since parent and student
      // see the same outgoing tutor messages.
      await storage.markDirectMessagesRead(decoded.studentId, 'student');
      const messages = await storage.getDirectMessagesByStudentId(decoded.studentId);
      res.json(messages);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // Parent: send message to tutor
  app.post("/api/parent/messages", async (req, res) => {
    try {
      const { t, content, fileUrls } = req.body || {};
      const decoded = verifyParentChatToken(String(t || ""));
      if (!decoded) return res.status(401).json({ error: "Ссылка недействительна" });
      const student = await storage.getStudent(decoded.studentId);
      if (!student) return res.status(404).json({ error: "Ученик не найден" });
      const trimmed = (content || "").trim();
      if (!trimmed && (!Array.isArray(fileUrls) || fileUrls.length === 0)) {
        return res.status(400).json({ error: "Пустое сообщение" });
      }
      const msg = await storage.createDirectMessage({
        tutorId: student.tutorId,
        studentId: student.id,
        role: 'parent',
        content: trimmed,
        fileUrls: Array.isArray(fileUrls) ? fileUrls : [],
        isRead: false,
      });

      // Notify tutor via Telegram (best-effort)
      const preview = (trimmed || "📎 файл").slice(0, 80);
      botManager.sendToTutor(student.tutorId,
        `💬 <b>Новое сообщение от родителя (${student.name})</b>\n\n` +
        `${preview}${preview.length >= 80 ? "…" : ""}\n\n` +
        `Ответьте в платформе Твой Вектор.`
      ).catch(() => {});

      res.json(msg);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ======= PARENT PAYMENTS (история оплат / чеки) =======

  // GET list of payments for this student (parent view)
  app.get("/api/parent/payments", async (req, res) => {
    try {
      const token = String(req.query.t || "");
      const decoded = verifyParentChatToken(token);
      if (!decoded) return res.status(401).json({ error: "Ссылка недействительна или истекла" });
      const student = await storage.getStudent(decoded.studentId);
      if (!student) return res.status(404).json({ error: "Ученик не найден" });
      const [tutor, payments, lessons] = await Promise.all([
        storage.getTutor(student.tutorId),
        storage.getPaymentsByStudentId(student.id, 500),
        storage.getLessonsByStudentId(student.id, 1000),
      ]);
      const completedLessons = lessons.filter((l: any) =>
        (l.status === "completed" && l.attendance !== "missed") || l.attendance === "missed_paid" || (l.status === "cancelled" && l.cancelAmount)
      );
      const spent = completedLessons.reduce((s: number, l: any) => {
        if (l.status === "cancelled") return s + (l.cancelAmount || 0);
        return s + (student.pricePerLesson || 0);
      }, 0);
      const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      res.json({
        student: {
          id: student.id,
          name: student.name,
          subject: student.subject,
          pricePerLesson: student.pricePerLesson,
          balance: student.balance,
        },
        tutor: {
          name: tutor?.name || "Репетитор",
          email: tutor?.email || "",
        },
        payments: payments.map((p: any) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          comment: p.comment,
          yookassaStatus: p.yookassaStatus,
          createdAt: p.createdAt,
        })),
        summary: {
          totalPaid,
          totalSpent: spent,
          balance: student.balance,
          paymentsCount: payments.length,
          completedLessonsCount: completedLessons.length,
        },
      });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // CSV export of payment history
  app.get("/api/parent/payments.csv", async (req, res) => {
    try {
      const token = String(req.query.t || "");
      const decoded = verifyParentChatToken(token);
      if (!decoded) return res.status(401).send("Ссылка недействительна");
      const student = await storage.getStudent(decoded.studentId);
      if (!student) return res.status(404).send("Ученик не найден");
      const payments = await storage.getPaymentsByStudentId(student.id, 500);
      const csv = toCsv(
        ["Дата", "Ученик", "Сумма, ₽", "Способ", "Статус", "Комментарий", "ID"],
        payments.map((p: any) => [
          new Date(p.createdAt).toLocaleString("ru-RU"),
          student.name,
          p.amount,
          p.method || "",
          p.yookassaStatus || "оплачено",
          p.comment || "",
          p.id,
        ]),
      );
      const fname = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      const fnameUtf8 = `оплаты-${student.name.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
      res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent(fnameUtf8)}`,
      });
      res.send(csv);
    } catch (e: any) { res.status(500).send(e.message); }
  });

  // HTML receipt (printable to PDF from browser)
  app.get("/api/parent/receipt/:paymentId", async (req, res) => {
    try {
      const token = String(req.query.t || "");
      const decoded = verifyParentChatToken(token);
      if (!decoded) return res.status(401).send("Ссылка недействительна");
      const payment = await storage.getPayment(req.params.paymentId);
      if (!payment || payment.studentId !== decoded.studentId) {
        return res.status(404).send("Платёж не найден");
      }
      const [student, tutor] = await Promise.all([
        storage.getStudent(payment.studentId),
        storage.getTutor(payment.tutorId),
      ]);
      if (!student || !tutor) return res.status(404).send("Данные не найдены");
      const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
      const dt = new Date(payment.createdAt);
      const rub = `${(payment.amount || 0).toLocaleString("ru-RU")} ₽`;
      const methodRus = payment.method === "карта" ? "Банковская карта"
        : payment.method === "наличные" ? "Наличные"
        : payment.method === "перевод" ? "Банковский перевод"
        : payment.method === "онлайн" ? "Онлайн-оплата (ЮKassa)"
        : (payment.method || "—");
      const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"/>
<title>Чек №${esc(payment.id.slice(0, 8).toUpperCase())} — Твой Вектор</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; background: #f4f6fa; margin: 0; padding: 24px; }
  .receipt { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,.06); }
  .head { padding: 32px 40px 24px; border-bottom: 1px solid #eef1f5; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .logo { font-weight: 800; font-size: 20px; letter-spacing: .5px; color: #1f2937; }
  .logo span { color: #2563eb; }
  .badge { background: #dcfce7; color: #166534; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: .5px; }
  .body { padding: 32px 40px; }
  h1 { margin: 0 0 4px; font-size: 28px; font-weight: 700; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 28px; }
  .amount { font-size: 44px; font-weight: 800; color: #111; margin: 8px 0 4px; letter-spacing: -0.5px; }
  .amount-sub { color: #6b7280; font-size: 13px; margin-bottom: 28px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  td { padding: 12px 0; border-bottom: 1px dashed #e5e7eb; vertical-align: top; font-size: 14px; }
  td.label { color: #6b7280; width: 42%; }
  td.val { color: #111; font-weight: 500; text-align: right; }
  tr:last-child td { border-bottom: none; }
  .section-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; margin: 24px 0 8px; }
  .foot { padding: 20px 40px 32px; background: #f9fafb; font-size: 11px; color: #6b7280; line-height: 1.6; border-top: 1px solid #eef1f5; }
  .foot strong { color: #374151; }
  .actions { max-width: 720px; margin: 16px auto 0; display: flex; justify-content: center; gap: 8px; }
  .btn { background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .btn.secondary { background: #fff; color: #2563eb; border: 1px solid #2563eb; }
  @media print {
    body { background: #fff; padding: 0; }
    .receipt { box-shadow: none; border-radius: 0; max-width: 100%; }
    .actions { display: none; }
  }
</style></head>
<body>
  <div class="receipt">
    <div class="head">
      <div>
        <div class="logo">ТВОЙ <span>↗</span> ВЕКТОР</div>
        <div style="color:#6b7280;font-size:12px;margin-top:4px">SaaS-платформа для репетиторов</div>
      </div>
      <div class="badge">Оплачено</div>
    </div>
    <div class="body">
      <h1>Чек об оплате</h1>
      <div class="sub">№ ${esc(payment.id.slice(0, 8).toUpperCase())} от ${esc(dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }))}</div>

      <div class="amount">${esc(rub)}</div>
      <div class="amount-sub">Сумма платежа</div>

      <div class="section-title">Платёж</div>
      <table>
        <tr><td class="label">Дата и время</td><td class="val">${esc(dt.toLocaleString("ru-RU"))}</td></tr>
        <tr><td class="label">Способ оплаты</td><td class="val">${esc(methodRus)}</td></tr>
        ${payment.comment ? `<tr><td class="label">Назначение</td><td class="val">${esc(payment.comment)}</td></tr>` : ""}
        <tr><td class="label">Идентификатор</td><td class="val" style="font-family:monospace;font-size:12px">${esc(payment.id)}</td></tr>
      </table>

      <div class="section-title">Плательщик</div>
      <table>
        <tr><td class="label">Ученик</td><td class="val">${esc(student.name)}</td></tr>
        <tr><td class="label">Предмет</td><td class="val">${esc(student.subject)}</td></tr>
        <tr><td class="label">Стоимость занятия</td><td class="val">${esc((student.pricePerLesson || 0).toLocaleString("ru-RU"))} ₽</td></tr>
      </table>

      <div class="section-title">Получатель</div>
      <table>
        <tr><td class="label">Репетитор</td><td class="val">${esc(tutor.name)}</td></tr>
      </table>
    </div>
    <div class="foot">
      <strong>Оператор платформы:</strong> Горбацевич Максим Денисович, ИНН 590612402300<br/>
      Документ сформирован автоматически платформой «Твой Вектор» и подтверждает факт оплаты занятий репетитору. Не является фискальным чеком ККТ. При необходимости налогового чека самозанятого — запросите его у репетитора (формируется в приложении «Мой налог»).
    </div>
  </div>
  <div class="actions">
    <button class="btn" onclick="window.print()">🖨 Печать / Сохранить PDF</button>
    <button class="btn secondary" onclick="window.close()">Закрыть</button>
  </div>
</body></html>`;
      res.set("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (e: any) { res.status(500).send(e.message); }
  });

  // ======= PARENT REPORT =======

  app.get("/api/students/:id/parent-report", requireAuth, async (req, res) => {
    try {
      const student = await storage.getStudent(req.params.id);
      if (!student || student.tutorId !== req.session.tutorId!) return res.status(404).json({ error: "Not found" });
      const lessons = await storage.getLessonsByStudentId(req.params.id, 200);
      const homework = await storage.getHomeworkByStudentId(req.params.id, 100);
      const completedLessons = lessons.filter((l: any) => l.status === "completed" && l.attendance === "attended");
      const reviewedHw = homework.filter((h: any) => h.status === "reviewed" && h.score != null);
      const avgScore = reviewedHw.length > 0
        ? Math.round(reviewedHw.reduce((s: number, h: any) => s + h.score, 0) / reviewedHw.length) : null;
      const avgRating = completedLessons.filter((l: any) => l.rating).length > 0
        ? (completedLessons.filter((l: any) => l.rating).reduce((s: number, l: any) => s + l.rating, 0) /
           completedLessons.filter((l: any) => l.rating).length).toFixed(1) : null;
      res.json({
        student: {
          name: student.name, subject: student.subject, goal: student.goal,
          grade: student.grade, progress: student.progress, curriculumTopic: student.curriculumTopic,
        },
        stats: {
          totalLessons: completedLessons.length,
          totalHomework: homework.length,
          completedHomework: homework.filter((h: any) => h.status === "reviewed").length,
          avgScore, avgRating,
        },
        recentLessons: completedLessons.slice(-5).map((l: any) => ({
          date: l.scheduledAt, topic: l.topic, rating: l.rating, notes: l.notes,
        })),
        recentHomework: homework.slice(-5).map((h: any) => ({
          title: h.title, status: h.status, score: h.score, deadline: h.deadline,
        })),
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ======= BBB CONFERENCE ROUTES =======

  // GET /api/bbb/status - проверить настройку BBB
  app.get("/api/bbb/status", requireAuth, async (req, res) => {
    res.json({ configured: await isBbbConfigured() });
  });

  // GET /api/bbb/conferences - список конференций репетитора
  app.get("/api/bbb/conferences", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const conferences = await storage.getConferencesByTutorId(tutorId);
      // Для каждой конференции проверяем статус (параллельно)
      const withStatus = await Promise.all(
        conferences.map(async (c) => {
          const running = await isBbbMeetingRunning(c.meetingId).catch(() => false);
          return { ...c, isRunning: running };
        })
      );
      res.json(withStatus);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/bbb/conferences - создать конференцию
  app.post("/api/bbb/conferences", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const schema = z.object({
        title: z.string().min(1),
        studentId: z.string().optional().nullable(),
        isOneTime: z.boolean().default(false),
      });
      const { title, studentId, isOneTime } = schema.parse(req.body);

      if (!await isBbbConfigured()) {
        return res.status(400).json({ error: "BBB не настроен. Укажите BBB_URL и BBB_SECRET в настройках администратора." });
      }

      // Генерируем уникальный meetingId и пароли
      const meetingId = `vektor-${tutorId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
      const attendeePw = randomUUID().slice(0, 12);
      const moderatorPw = randomUUID().slice(0, 12);

      // Создаём встречу на BBB
      const result = await createBbbMeeting(meetingId, title, attendeePw, moderatorPw);
      if (!result.success) {
        return res.status(500).json({ error: result.error || "Ошибка создания встречи на BBB" });
      }

      // Сохраняем в БД
      const conference = await storage.createConference({
        tutorId,
        studentId: studentId || null,
        title,
        meetingId,
        attendeePw,
        moderatorPw,
        isOneTime,
      });

      res.json(conference);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/bbb/replace-all-conferences - пересоздать ВСЕ конференции репетитора с новыми meetingId
  // Используется при смене BBB сервера
  app.post("/api/bbb/replace-all-conferences", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const tutor = await storage.getTutor(tutorId);
      const existingConfs = await storage.getConferencesByTutorId(tutorId);
      const students = await storage.getStudentsByTutorId(tutorId);
      const studentMap = new Map(students.map(s => [s.id, s]));

      let replaced = 0;
      let created = 0;

      // Заменяем все существующие конференции новыми meetingId
      for (const conf of existingConfs) {
        const newMeetingId = `vektor-${tutorId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
        const newAttendeePw = randomUUID().slice(0, 12);
        const newModeratorPw = randomUUID().slice(0, 12);
        await endBbbMeeting(conf.meetingId, conf.moderatorPw).catch((e) => console.error("[BBB] endMeeting failed:", e?.message || e));
        await storage.updateConference(conf.id, {
          meetingId: newMeetingId,
          attendeePw: newAttendeePw,
          moderatorPw: newModeratorPw,
        });
        replaced++;
      }

      // Создаём комнаты для учеников, у которых их ещё нет
      const studentsWithConf = new Set(existingConfs.filter(c => c.studentId).map(c => c.studentId));
      for (const student of students) {
        if (!studentsWithConf.has(student.id)) {
          const newMeetingId = `vektor-${tutorId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
          const newAttendeePw = randomUUID().slice(0, 12);
          const newModeratorPw = randomUUID().slice(0, 12);
          const title = `${student.name} — ${tutor?.name || "Репетитор"}`;
          await storage.createConference({ tutorId, studentId: student.id, title, meetingId: newMeetingId, attendeePw: newAttendeePw, moderatorPw: newModeratorPw, isOneTime: false });
          created++;
        }
      }

      res.json({ replaced, created, total: existingConfs.length + created });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/bbb/ensure-all-conferences - создать конференции для всех учеников без них
  app.post("/api/bbb/ensure-all-conferences", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      if (!await isBbbConfigured()) {
        return res.status(400).json({ error: "BBB не настроен. Укажите BBB_URL и BBB_SECRET в настройках администратора." });
      }
      const tutor = await storage.getTutor(tutorId);
      const students = await storage.getStudentsByTutorId(tutorId);
      const existingConfs = await storage.getConferencesByTutorId(tutorId);
      const studentsWithConf = new Set(existingConfs.filter(c => c.studentId).map(c => c.studentId));

      let created = 0;
      let failed = 0;
      for (const student of students) {
        if (!studentsWithConf.has(student.id)) {
          const meetingId = `vektor-${tutorId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
          const attendeePw = randomUUID().slice(0, 12);
          const moderatorPw = randomUUID().slice(0, 12);
          const title = `${student.name} — ${tutor?.name || "Репетитор"}`;
          const result = await createBbbMeeting(meetingId, title, attendeePw, moderatorPw);
          if (result.success) {
            await storage.createConference({ tutorId, studentId: student.id, title, meetingId, attendeePw, moderatorPw, isOneTime: false });
            created++;
          } else {
            failed++;
          }
        }
      }
      res.json({ created, failed, total: students.length, alreadyHad: studentsWithConf.size });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/bbb/conferences/:id - завершить и удалить конференцию
  app.delete("/api/bbb/conferences/:id", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const conference = await storage.getConference(req.params.id);
      if (!conference || conference.tutorId !== tutorId) {
        return res.status(404).json({ error: "Конференция не найдена" });
      }
      // Завершаем встречу на BBB если активна
      await endBbbMeeting(conference.meetingId, conference.moderatorPw).catch((e) => console.error("[BBB] endMeeting failed:", e?.message || e));
      // Удаляем из БД
      await storage.deleteConference(conference.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/bbb/conferences/:id/join - ссылка для репетитора (всегда презентер)
  app.get("/api/bbb/conferences/:id/join", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const tutor = await storage.getTutor(tutorId);
      const conference = await storage.getConference(req.params.id);
      if (!conference || conference.tutorId !== tutorId) {
        return res.status(404).json({ error: "Конференция не найдена" });
      }
      // Если встреча не запущена — пересоздаём её, чтобы репетитор вошёл первым и стал презентером
      const isRunning = await isBbbMeetingRunning(conference.meetingId);
      if (!isRunning) {
        await endBbbMeeting(conference.meetingId, conference.moderatorPw).catch((e) => console.error("[BBB] endMeeting failed:", e?.message || e));
        await createBbbMeeting(
          conference.meetingId, conference.title,
          conference.attendeePw, conference.moderatorPw
        );
      }
      // Если встреча уже идёт — просто входим (репетитор как модератор может взять роль презентера)
      const url = await getBbbJoinUrl(
        conference.meetingId,
        tutor?.name || "Репетитор",
        conference.moderatorPw,
        `moderator-${tutorId}`,
        'moderator',
      );
      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/bbb/conferences/:id/student-link - ссылка для ученика (участник)
  app.get("/api/bbb/conferences/:id/student-link", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const conference = await storage.getConference(req.params.id);
      if (!conference || conference.tutorId !== tutorId) {
        return res.status(404).json({ error: "Конференция не найдена" });
      }
      // Убеждаемся что встреча создана
      await createBbbMeeting(
        conference.meetingId, conference.title,
        conference.attendeePw, conference.moderatorPw
      ).catch(() => {});
      const studentName = conference.studentId
        ? (await storage.getStudent(conference.studentId))?.name || "Ученик"
        : "Ученик";
      const url = await getBbbJoinUrl(
        conference.meetingId,
        studentName,
        conference.attendeePw,
        `student-${conference.studentId || 'guest'}`,
        'viewer',
      );
      res.json({ url, title: conference.title });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/bbb/conferences/:id/status - статус встречи
  app.get("/api/bbb/conferences/:id/status", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const conference = await storage.getConference(req.params.id);
      if (!conference || conference.tutorId !== tutorId) {
        return res.status(404).json({ error: "Конференция не найдена" });
      }
      const running = await isBbbMeetingRunning(conference.meetingId);
      res.json({ running });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/bbb/conferences/:id/reset - завершить и пересоздать встречу
  app.post("/api/bbb/conferences/:id/reset", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const conference = await storage.getConference(req.params.id);
      if (!conference || conference.tutorId !== tutorId) {
        return res.status(404).json({ error: "Конференция не найдена" });
      }
      // Завершаем текущую встречу
      await endBbbMeeting(conference.meetingId, conference.moderatorPw).catch((e) => console.error("[BBB] endMeeting failed:", e?.message || e));
      // Создаём заново — все пересоздаются с новыми настройками (разрешения аннотаций)
      const result = await createBbbMeeting(
        conference.meetingId, conference.title,
        conference.attendeePw, conference.moderatorPw
      );
      if (!result.success) return res.status(500).json({ error: result.error || 'Ошибка пересоздания' });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/bbb/conferences/:id/replace - заменить комнату (новый meetingId + пароли)
  app.post("/api/bbb/conferences/:id/replace", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const conference = await storage.getConference(req.params.id);
      if (!conference || conference.tutorId !== tutorId) {
        return res.status(404).json({ error: "Конференция не найдена" });
      }
      // Завершаем старую встречу на BBB если активна
      await endBbbMeeting(conference.meetingId, conference.moderatorPw).catch((e) => console.error("[BBB] endMeeting failed:", e?.message || e));
      // Генерируем новые данные
      const newMeetingId = `vektor-${tutorId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
      const newAttendeePw = randomUUID().slice(0, 12);
      const newModeratorPw = randomUUID().slice(0, 12);
      // Сохраняем в БД (BBB митинг создастся при первом входе)
      const updated = await storage.updateConference(conference.id, {
        meetingId: newMeetingId,
        attendeePw: newAttendeePw,
        moderatorPw: newModeratorPw,
      });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Finance Export ─────────────────────────────────────────────────────────
  // GET /api/finance/export - Экспорт платежей в CSV
  app.get("/api/finance/export", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const { from, to } = req.query as { from?: string; to?: string };
      const payments = await storage.getPaymentsByTutorId(tutorId, 10000);
      const students = await storage.getStudentsByTutorId(tutorId);
      const studentMap = new Map(students.map(s => [s.id, s.name]));

      let filtered = payments;
      if (from) filtered = filtered.filter(p => new Date(p.createdAt as any) >= new Date(from));
      if (to) filtered = filtered.filter(p => new Date(p.createdAt as any) <= new Date(to + 'T23:59:59'));

      const rows = [
        ['Дата', 'Ученик', 'Сумма (руб)', 'Способ оплаты', 'Комментарий'],
        ...filtered.map(p => [
          new Date(p.createdAt as any).toLocaleDateString('ru-RU'),
          studentMap.get(p.studentId) || p.studentId,
          p.amount.toString(),
          p.method || 'cash',
          p.comment || '',
        ])
      ];

      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const bom = '\uFEFF'; // BOM для корректного отображения кириллицы в Excel
      const fileName = `payments_${from || 'all'}_${to || 'all'}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(bom + csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Backup / Резервные копии ─────────────────────────────────────────────────

  // GET /api/backup - список бэкапов (без данных)
  app.get("/api/backup", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const backups = await storage.getBackupsByTutorId(tutorId);
      res.json(backups);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/backup - создать ручной бэкап
  app.post("/api/backup", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const note = req.body?.note ?? null;
      // Проверяем лимит ручных бэкапов (не более 10)
      const existing = await storage.getBackupsByTutorId(tutorId);
      const manualCount = existing.filter(b => b.type === 'manual').length;
      if (manualCount >= 10) {
        return res.status(400).json({ error: "Превышен лимит ручных резервных копий (10). Удалите старые, чтобы создать новую." });
      }
      const dataJson = await buildTutorBackupJson(tutorId);
      const backup = await storage.createBackup(tutorId, 'manual', note, dataJson);
      res.json(backup);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/backup/:id/download - скачать бэкап как JSON-файл
  app.get("/api/backup/:id/download", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const backup = await storage.getBackupById(req.params.id);
      if (!backup || backup.tutorId !== tutorId) {
        return res.status(404).json({ error: "Резервная копия не найдена" });
      }
      const date = new Date(backup.createdAt).toLocaleDateString("ru-RU").replace(/\./g, "-");
      const filename = `vector-backup-${date}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(backup.dataJson);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/backup/:id - удалить бэкап
  app.delete("/api/backup/:id", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const backup = await storage.getBackupById(req.params.id);
      if (!backup || backup.tutorId !== tutorId) {
        return res.status(404).json({ error: "Резервная копия не найдена" });
      }
      await storage.deleteBackup(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Bulk Homework ───────────────────────────────────────────────────────────
  // POST /api/homework/bulk - Массовая выдача ДЗ нескольким ученикам
  app.post("/api/homework/bulk", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const { studentIds, title, description, deadline, hints, estimatedMinutes } = req.body;
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "Укажите хотя бы одного ученика" });
      }
      if (!title?.trim()) return res.status(400).json({ error: "Укажите название задания" });

      const created = [];
      for (const studentId of studentIds) {
        const student = await storage.getStudent(studentId);
        if (!student || student.tutorId !== tutorId) continue;
        const hw = await storage.createHomework({
          tutorId,
          studentId,
          title: title.trim(),
          description: description || null,
          deadline: deadline ? new Date(deadline) : null,
          hints: hints || null,
          estimatedMinutes: estimatedMinutes || null,
          status: 'assigned',
          completionPct: 0,
        } as any);
        created.push(hw);
      }
      res.json({ created: created.length, homework: created });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Per-student analytics detail ───────────────────────────────────────────
  // GET /api/analytics/students/:studentId/detail - Детальная аналитика по ученику
  app.get("/api/analytics/students/:studentId/detail", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const student = await storage.getStudent(req.params.studentId);
      if (!student || student.tutorId !== tutorId) return res.status(404).json({ error: "Ученик не найден" });

      const homework = await storage.getHomeworkByStudentId(student.id, 500);
      const lessons = await storage.getLessonsByStudentId(student.id, 500);

      const totalHw = homework.length;
      const completedHw = homework.filter(h => h.status === 'reviewed' || h.status === 'completed').length;
      const completionPct = totalHw > 0 ? Math.round((completedHw / totalHw) * 100) : 0;
      const gradedHw = homework.filter(h => h.score != null);
      const avgGrade = gradedHw.length > 0
        ? Math.round(gradedHw.reduce((s, h) => s + (h.score || 0), 0) / gradedHw.length * 10) / 10
        : null;
      const totalLessons = lessons.filter(l => l.status === 'completed').length;
      const missedLessons = lessons.filter(l => l.status === 'cancelled' || (l.attendance === 'absent')).length;
      const avgRating = lessons.filter(l => l.rating).length > 0
        ? Math.round(lessons.filter(l => l.rating).reduce((s, l) => s + (l.rating || 0), 0) / lessons.filter(l => l.rating).length * 10) / 10
        : null;

      // Последние ДЗ
      const recentHw = homework
        .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
        .slice(0, 5)
        .map(h => ({ id: h.id, title: h.title, status: h.status, score: h.score, deadline: h.deadline }));

      // Последние занятия
      const recentLessons = lessons
        .filter(l => new Date(l.scheduledAt) <= new Date())
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
        .slice(0, 5)
        .map(l => ({ id: l.id, date: l.scheduledAt, topic: l.topic, status: l.status, rating: l.rating, notes: (l as any).notes }));

      res.json({
        student: { id: student.id, name: student.name, subject: student.subject, balance: student.balance },
        stats: { totalHw, completedHw, completionPct, avgGrade, totalLessons, missedLessons, avgRating },
        recentHw,
        recentLessons,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Feature Flags (Admin) ───────────────────────────────────────────────────
  // GET /api/admin/feature-flags - Все фичер-флаги
  app.get("/api/admin/feature-flags", requireAdmin, async (req, res) => {
    try {
      const flags = await storage.getAllFeatureFlags();
      const tutors = await storage.getAllTutors();
      const tutorMap = new Map(tutors.map(t => [t.id, t.name]));
      res.json(flags.map(f => ({ ...f, tutorName: tutorMap.get(f.tutorId) || f.tutorId })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/feature-flags/:tutorId - Флаги конкретного репетитора
  app.get("/api/admin/feature-flags/:tutorId", requireAdmin, async (req, res) => {
    try {
      const flags = await storage.getFeatureFlagsByTutorId(req.params.tutorId);
      res.json(flags);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/feature-flags - Установить флаг
  app.post("/api/admin/feature-flags", requireAdmin, async (req, res) => {
    try {
      const { tutorId, feature, enabled } = req.body;
      if (!tutorId || !feature) return res.status(400).json({ error: "tutorId и feature обязательны" });
      await storage.upsertFeatureFlag(tutorId, feature, !!enabled);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Support Tickets (Tutor) ─────────────────────────────────────────────────
  // GET /api/support/tickets - Мои тикеты
  app.get("/api/support/tickets", requireAuth, async (req, res) => {
    try {
      const tickets = await storage.getSupportTicketsByTutorId(req.session.tutorId!);
      res.json(tickets);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/support/tickets - Создать тикет
  app.post("/api/support/tickets", requireAuth, async (req, res) => {
    try {
      const { subject, message } = req.body;
      if (!subject?.trim()) return res.status(400).json({ error: "Укажите тему обращения" });
      const tutor = await storage.getTutor(req.session.tutorId!);
      const ticket = await storage.createSupportTicket({ tutorId: req.session.tutorId!, subject: subject.trim(), status: 'open' });
      if (message?.trim()) {
        await storage.createSupportMessage({ ticketId: ticket.id, role: 'tutor', content: message.trim() });
      }
      // Уведомить support@ о новом тикете
      const smtpHost = process.env.SMTP_HOST;
      const smtpPassSupport = process.env.SMTP_PASS_SUPPORT;
      const supportEmail = process.env.SMTP_SUPPORT || 'support@tvoyvector.ru';
      if (smtpHost && smtpPassSupport) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost, port: 465, secure: true,
            auth: { user: supportEmail, pass: smtpPassSupport },
            tls: { rejectUnauthorized: false },
          });
          await t.sendMail({
            from: `Твой Вектор Support <${supportEmail}>`,
            to: supportEmail,
            subject: `Новый тикет: ${subject.trim()}`,
            html: `<div style="font-family:sans-serif;max-width:600px"><h2>Новое обращение</h2><p><b>Репетитор:</b> ${tutor?.name || '—'} (${tutor?.email || '—'})</p><p><b>Тема:</b> ${subject.trim()}</p>${message?.trim() ? `<p><b>Сообщение:</b></p><blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555">${message.trim()}</blockquote>` : ''}<hr><p style="color:#888;font-size:12px">Твой Вектор — платформа для репетиторов</p></div>`,
          });
        } catch (_) {}
      }
      res.json(ticket);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/support/tickets/:id/messages - Сообщения тикета
  app.get("/api/support/tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket || ticket.tutorId !== req.session.tutorId!) return res.status(404).json({ error: "Тикет не найден" });
      const messages = await storage.getSupportMessagesByTicketId(req.params.id);
      res.json({ ticket, messages });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/support/tickets/:id/messages - Добавить сообщение
  app.post("/api/support/tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket || ticket.tutorId !== req.session.tutorId!) return res.status(404).json({ error: "Тикет не найден" });
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Сообщение не может быть пустым" });
      const msg = await storage.createSupportMessage({ ticketId: req.params.id, role: 'tutor', content: content.trim() });
      if (ticket.status === 'answered') await storage.updateSupportTicketStatus(req.params.id, 'open');
      res.json(msg);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Support Tickets (Admin) ─────────────────────────────────────────────────
  // GET /api/admin/tickets - Все тикеты
  app.get("/api/admin/tickets", requireAdmin, async (req, res) => {
    try {
      const tickets = await storage.getAllSupportTickets();
      const tutors = await storage.getAllTutors();
      const tutorMap = new Map(tutors.map(t => [t.id, t.name]));
      res.json(tickets.map(t => ({ ...t, tutorName: tutorMap.get(t.tutorId) || 'Неизвестно' })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/tickets/:id/messages - Сообщения тикета для админа
  app.get("/api/admin/tickets/:id/messages", requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket) return res.status(404).json({ error: "Тикет не найден" });
      const messages = await storage.getSupportMessagesByTicketId(req.params.id);
      const tutor = await storage.getTutor(ticket.tutorId);
      res.json({ ticket: { ...ticket, tutorName: tutor?.name || 'Неизвестно' }, messages });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/tickets/:id/messages - Ответить на тикет (admin)
  app.post("/api/admin/tickets/:id/messages", requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket) return res.status(404).json({ error: "Тикет не найден" });
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Сообщение не может быть пустым" });
      const msg = await storage.createSupportMessage({ ticketId: req.params.id, role: 'admin', content: content.trim() });
      await storage.updateSupportTicketStatus(req.params.id, 'answered');
      // Уведомить репетитора об ответе
      const tutor = await storage.getTutor(ticket.tutorId);
      const smtpHost = process.env.SMTP_HOST;
      const smtpPassSupport = process.env.SMTP_PASS_SUPPORT;
      const supportEmail = process.env.SMTP_SUPPORT || 'support@tvoyvector.ru';
      if (smtpHost && smtpPassSupport && tutor?.email) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost, port: 465, secure: true,
            auth: { user: supportEmail, pass: smtpPassSupport },
            tls: { rejectUnauthorized: false },
          });
          await t.sendMail({
            from: `Твой Вектор Support <${supportEmail}>`,
            to: tutor.email,
            subject: `Ответ на ваше обращение: ${ticket.subject}`,
            html: `<div style="font-family:sans-serif;max-width:600px"><h2>Ответ на ваше обращение</h2><p>Здравствуйте, ${tutor.name}!</p><p>Мы ответили на ваш тикет <b>"${ticket.subject}"</b>:</p><blockquote style="border-left:3px solid #3b82f6;padding-left:12px;color:#555">${content.trim()}</blockquote><p>Чтобы ответить или посмотреть все сообщения, войдите в личный кабинет в разделе «Помощь».</p><hr><p style="color:#888;font-size:12px">Твой Вектор — платформа для репетиторов | ${supportEmail}</p></div>`,
          });
        } catch (_) {}
      }
      res.json(msg);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/admin/tickets/:id - Изменить статус тикета
  app.patch("/api/admin/tickets/:id", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateSupportTicketStatus(req.params.id, status);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== TASK BANK API =====
  // GET /api/tasks/meta - unique filter values (no auth, public)
  app.get("/api/tasks/meta", async (_req, res) => {
    try {
      const meta = await storage.getTaskBankMeta();
      res.json(meta);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/tasks - list tasks with filters
  app.get("/api/tasks", async (req, res) => {
    try {
      const { subject, class: cls, topic, difficulty, search, page = "0", limit = "20" } = req.query as any;
      const result = await storage.getTaskBank(
        { subject, class: cls, topic, difficulty, search },
        parseInt(page), parseInt(limit)
      );
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/tasks/random - get random task from filters
  app.get("/api/tasks/random", async (req, res) => {
    try {
      const { subject, class: cls, topic, difficulty } = req.query as any;
      const task = await storage.getRandomTask({ subject, class: cls, topic, difficulty });
      if (!task) return res.status(404).json({ error: "Задача не найдена" });
      res.json(task);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/tasks/build-variant - pick N random tasks per group
  app.post("/api/tasks/build-variant", async (req, res) => {
    try {
      const { groups, excludeIds = [] } = req.body;
      if (!Array.isArray(groups) || groups.length === 0) {
        return res.status(400).json({ error: "Укажите хотя бы одну группу" });
      }
      const tasks = await storage.getRandomTasksForGroups(groups, excludeIds);
      res.json(tasks);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/tasks/by-ids?ids=id1,id2,... - get multiple tasks by IDs (for variant preview)
  app.get("/api/tasks/by-ids", async (req, res) => {
    try {
      const raw = (req.query.ids as string) || "";
      const ids = raw.split(",").map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) return res.json([]);
      const tasks = await storage.getTasksByIds(ids.slice(0, 100));
      res.json(tasks);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/tasks/:id - single task
  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id);
      if (!task) return res.status(404).json({ error: "Задача не найдена" });
      res.json(task);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/variants - tutor's variants
  app.get("/api/variants", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const variants = await storage.getVariantsByTutor(tutorId);
      res.json(variants);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/variants - create variant
  app.post("/api/variants", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const { name, taskIds } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "Название варианта обязательно" });
      const variant = await storage.createVariant(tutorId, name.trim(), taskIds || []);
      res.json(variant);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/variants/:id - get variant
  app.get("/api/variants/:id", requireAuth, async (req, res) => {
    try {
      const variant = await storage.getVariantById(req.params.id);
      if (!variant) return res.status(404).json({ error: "Вариант не найден" });
      // Load full task data
      const tasks = await Promise.all((variant.taskIds || []).map((tid: string) => storage.getTaskById(tid)));
      res.json({ ...variant, tasks: tasks.filter(Boolean) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/variants/:id - update variant
  app.patch("/api/variants/:id", requireAuth, async (req, res) => {
    try {
      const { name, taskIds } = req.body;
      const variant = await storage.updateVariant(req.params.id, { name, taskIds });
      res.json(variant);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/variants/:id - delete variant
  app.delete("/api/variants/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteVariant(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/variants/:id/assign - assign to students
  app.post("/api/variants/:id/assign", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const { studentIds } = req.body;
      if (!Array.isArray(studentIds)) return res.status(400).json({ error: "studentIds must be array" });
      await storage.assignVariant(req.params.id, studentIds, tutorId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/variants/:id/send-homework - create homework from variant for students
  app.post("/api/variants/:id/send-homework", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const variant = await storage.getVariantById(req.params.id);
      if (!variant) return res.status(404).json({ error: "Вариант не найден" });
      const { studentIds, deadline, description, hints } = req.body;
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "Выберите хотя бы одного ученика" });
      }
      const created = [];
      for (const studentId of studentIds) {
        const student = await storage.getStudent(studentId);
        if (!student || student.tutorId !== tutorId) continue;
        const hw = await storage.createHomework({
          tutorId,
          studentId,
          title: variant.name,
          description: description?.trim() || null,
          deadline: deadline ? new Date(deadline) : null,
          hints: hints?.trim() || null,
          status: 'assigned',
          completionPct: 0,
          taskIds: variant.taskIds || [],
        } as any);
        created.push(hw);
      }
      res.json({ created: created.length, homework: created });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ======= BROADCAST API =======
  app.post("/api/broadcast", requireAuth, async (req, res) => {
    try {
      const tutorId = req.session.tutorId!;
      const schema = z.object({
        studentIds: z.array(z.string()).min(1),
        message: z.string().min(1).max(2000),
      });
      const { studentIds, message } = schema.parse(req.body);

      const tutor = await storage.getTutor(tutorId);
      const tutorName = tutor?.name || "Репетитор";
      const results: { studentId: string; telegram: boolean; chat: boolean }[] = [];

      await Promise.all(studentIds.map(async (studentId) => {
        const student = await storage.getStudent(studentId);
        if (!student || student.tutorId !== tutorId) return;

        let telegramSent = false;
        if (student.telegramChatId) {
          try {
            await botManager.sendToStudent(studentId, `📢 <b>Сообщение от репетитора ${tutorName}:</b>\n\n${message}`);
            telegramSent = true;
          } catch {}
        }

        let chatSent = false;
        try {
          await storage.createDirectMessage({
            tutorId,
            studentId,
            role: "tutor",
            content: message,
            fileUrls: [],
            isRead: false,
          });
          chatSent = true;
        } catch {}

        results.push({ studentId, telegram: telegramSent, chat: chatSent });
      }));

      const telegramCount = results.filter(r => r.telegram).length;
      const chatCount = results.filter(r => r.chat).length;
      res.json({ success: true, sent: results.length, telegramCount, chatCount });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ======= SAVED LESSON PLANS =======
  app.get("/api/lesson-plans", requireAuth, async (req, res) => {
    try {
      const tutorId = (req.session as any).tutorId;
      const plans = await storage.getSavedLessonPlans(tutorId);
      res.json(plans);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/lesson-plans", requireAuth, async (req, res) => {
    try {
      const tutorId = (req.session as any).tutorId;
      const { title, subject, grade, lessonType, duration, planJson } = req.body;
      if (!title || !planJson) return res.status(400).json({ error: "title и planJson обязательны" });
      const plan = await storage.createSavedLessonPlan({ tutorId, title, subject: subject || "", grade: grade || "", lessonType: lessonType || "new", duration: duration || 60, planJson });
      res.json(plan);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/lesson-plans/:id", requireAuth, async (req, res) => {
    try {
      const tutorId = (req.session as any).tutorId;
      await storage.deleteSavedLessonPlan(req.params.id, tutorId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ======= BBB RECORDINGS =======
  app.get("/api/bbb/recordings", requireAuth, async (req, res) => {
    try {
      const { meetingId } = req.query as { meetingId?: string };
      const recordings = await getBbbRecordings(meetingId);
      res.json(recordings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ======= QUIZZES (тренажёры) =======
  const quizQuestionSchema = z.object({
    q: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    correct: z.number().int().min(0),
    explanation: z.string().optional(),
  }).refine(d => d.correct < d.options.length, { message: "correct должен быть индексом существующего варианта" });

  app.get("/api/quizzes", requireAuth, async (req, res) => {
    try {
      const list = await storage.getQuizzesByTutor(req.session.tutorId!);
      res.json(list);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/quizzes/:id", requireAuth, async (req, res) => {
    const q = await storage.getQuiz(req.params.id);
    if (!q || q.tutorId !== req.session.tutorId) return res.status(404).json({ error: "Не найдено" });
    res.json(q);
  });

  app.get("/api/quizzes/:id/attempts", requireAuth, async (req, res) => {
    const q = await storage.getQuiz(req.params.id);
    if (!q || q.tutorId !== req.session.tutorId) return res.status(404).json({ error: "Не найдено" });
    const attempts = await storage.getQuizAttemptsByQuiz(req.params.id);
    res.json(attempts);
  });

  app.get("/api/quizzes-attempts/recent", requireAuth, async (req, res) => {
    const attempts = await storage.getQuizAttemptsByTutor(req.session.tutorId!, 100);
    res.json(attempts);
  });

  app.post("/api/quizzes", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        topic: z.string().min(1),
        description: z.string().optional(),
        studentId: z.string().optional().nullable(),
        questions: z.array(quizQuestionSchema).min(1),
      });
      const data = schema.parse(req.body);
      // Если назначен конкретному ученику — проверим, что он принадлежит этому репетитору
      if (data.studentId) {
        const st = await storage.getStudent(data.studentId);
        if (!st || st.tutorId !== req.session.tutorId) {
          return res.status(403).json({ error: "Этот ученик не привязан к вам" });
        }
      }
      const quiz = await storage.createQuiz({
        tutorId: req.session.tutorId!,
        topic: data.topic,
        description: data.description ?? null,
        studentId: data.studentId || null,
        questions: data.questions as any,
        status: 'active',
      } as any);

      // Уведомление в Telegram, если назначен конкретному ученику
      if (quiz.studentId) {
        botManager.sendToStudent(quiz.studentId,
          `🎯 <b>Новый тренажёр!</b>\n\n` +
          `📚 ${quiz.topic}\n` +
          (quiz.description ? `📝 ${quiz.description}\n\n` : `\n`) +
          `Введите /quiz в боте, чтобы начать.`
        ).catch(() => {});
      }
      res.json(quiz);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.patch("/api/quizzes/:id", requireAuth, async (req, res) => {
    const q = await storage.getQuiz(req.params.id);
    if (!q || q.tutorId !== req.session.tutorId) return res.status(404).json({ error: "Не найдено" });
    try {
      const schema = z.object({
        topic: z.string().optional(),
        description: z.string().optional().nullable(),
        status: z.enum(['active', 'archived']).optional(),
        questions: z.array(quizQuestionSchema).optional(),
        studentId: z.string().optional().nullable(),
      });
      const data = schema.parse(req.body);
      if (data.studentId) {
        const st = await storage.getStudent(data.studentId);
        if (!st || st.tutorId !== req.session.tutorId) {
          return res.status(403).json({ error: "Этот ученик не привязан к вам" });
        }
      }
      const updated = await storage.updateQuiz(req.params.id, data as any);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/quizzes/:id", requireAuth, async (req, res) => {
    const q = await storage.getQuiz(req.params.id);
    if (!q || q.tutorId !== req.session.tutorId) return res.status(404).json({ error: "Не найдено" });
    await storage.deleteQuiz(req.params.id);
    res.json({ ok: true });
  });

  // AI-генерация теста по теме
  app.post("/api/quizzes/generate", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        topic: z.string().min(2),
        count: z.number().int().min(3).max(15).default(5),
        difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
        language: z.string().default('ru'),
      });
      const { topic, count, difficulty, language } = schema.parse(req.body);
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY не задан" });

      const prompt =
        `Сгенерируй ${count} вопросов с 4 вариантами ответа по теме "${topic}". ` +
        `Сложность: ${difficulty}. Язык: ${language}. ` +
        `Верни СТРОГО JSON массив объектов вида {"q":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}. ` +
        `correct — индекс правильного варианта (0..3). Без обрамления, только JSON.`;

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Ты — учитель. Возвращай только валидный JSON c полем questions: массив." },
            { role: "user", content: prompt + ' Верни как {"questions":[...]}.' },
          ],
        }),
      });
      const json: any = await r.json();
      if (!r.ok) return res.status(500).json({ error: json?.error?.message || "OpenAI error" });
      const content = json.choices?.[0]?.message?.content || "{}";
      let parsed: any;
      try { parsed = JSON.parse(content); } catch { return res.status(500).json({ error: "Не удалось распарсить ответ ИИ" }); }
      const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
      const validated = z.array(quizQuestionSchema).min(1).parse(questions);
      res.json({ questions: validated });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ======= LESSON RECORDINGS (записи уроков с расшифровкой и конспектом) =======
  const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // Whisper API hard limit
  });

  // Список записей репетитора
  app.get("/api/recordings", requireAuth, async (req, res) => {
    try {
      const list = await storage.getLessonRecordingsByTutor(req.session.tutorId!);
      res.json(list);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Одна запись (репетитор)
  app.get("/api/recordings/:id", requireAuth, async (req, res) => {
    try {
      const r = await storage.getLessonRecording(req.params.id);
      if (!r || r.tutorId !== req.session.tutorId) return res.status(404).json({ error: "Не найдено" });
      res.json(r);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Подтянуть новые BBB-записи в БД (без транскрипции)
  app.post("/api/recordings/sync-bbb", requireAuth, async (req, res) => {
    try {
      const { syncBbbRecordingsForTutor } = await import("./recordings");
      const added = await syncBbbRecordingsForTutor(req.session.tutorId!);
      res.json({ added });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Загрузить аудиофайл и запустить расшифровку (создаёт новую запись либо привязывает к существующей)
  app.post("/api/recordings/upload", requireAuth, audioUpload.single("audio"), async (req, res) => {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "Файл не загружен" });

      const { title, studentId, recordingId } = req.body as any;
      const { saveAudioBuffer, startTranscriptionJob } = await import("./recordings");

      let rec;
      if (recordingId) {
        // Привязать аудио к существующей записи (например к BBB-записи)
        if (title || studentId) {
          return res.status(400).json({ error: "Нельзя одновременно указать recordingId и title/studentId — выберите одно: либо привязка к существующей записи, либо создание новой." });
        }
        rec = await storage.getLessonRecording(recordingId);
        if (!rec || rec.tutorId !== req.session.tutorId) return res.status(404).json({ error: "Запись не найдена" });
      } else {
        if (!title || typeof title !== 'string') return res.status(400).json({ error: "Укажите название" });
        if (studentId) {
          const st = await storage.getStudent(studentId);
          if (!st || st.tutorId !== req.session.tutorId) return res.status(403).json({ error: "Этот ученик не привязан к вам" });
        }
        rec = await storage.createLessonRecording({
          tutorId: req.session.tutorId!,
          studentId: studentId || null,
          title: String(title).slice(0, 300),
          source: "upload",
          status: "pending",
          recordedAt: new Date() as any,
        } as any);
      }

      const ext = (file.originalname?.split(".").pop() || "mp3").toLowerCase();
      const audioPath = await saveAudioBuffer(rec.id, file.buffer, ext);
      await storage.updateLessonRecording(rec.id, { audioPath, status: "transcribing" } as any);
      startTranscriptionJob(rec.id);

      res.json({ id: rec.id, status: "transcribing" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Перезапустить транскрипцию (если упало)
  app.post("/api/recordings/:id/retry", requireAuth, async (req, res) => {
    try {
      const r = await storage.getLessonRecording(req.params.id);
      if (!r || r.tutorId !== req.session.tutorId) return res.status(404).json({ error: "Не найдено" });
      if (!r.audioPath) return res.status(400).json({ error: "Нет аудио — загрузите файл" });
      const { startTranscriptionJob } = await import("./recordings");
      await storage.updateLessonRecording(r.id, { status: "transcribing", errorMessage: null as any } as any);
      startTranscriptionJob(r.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Назначить запись ученику (если изначально не была привязана)
  app.patch("/api/recordings/:id", requireAuth, async (req, res) => {
    try {
      const r = await storage.getLessonRecording(req.params.id);
      if (!r || r.tutorId !== req.session.tutorId) return res.status(404).json({ error: "Не найдено" });
      const schema = z.object({
        title: z.string().min(1).optional(),
        studentId: z.string().nullable().optional(),
        summary: z.string().optional(),
      });
      const data = schema.parse(req.body);
      if (data.studentId) {
        const st = await storage.getStudent(data.studentId);
        if (!st || st.tutorId !== req.session.tutorId) return res.status(403).json({ error: "Этот ученик не привязан к вам" });
      }
      const updated = await storage.updateLessonRecording(r.id, data as any);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/recordings/:id", requireAuth, async (req, res) => {
    try {
      const r = await storage.getLessonRecording(req.params.id);
      if (!r || r.tutorId !== req.session.tutorId) return res.status(404).json({ error: "Не найдено" });
      await storage.deleteLessonRecording(r.id);
      // best-effort удалить аудиофайл
      if (r.audioPath) { try { const fs = await import("fs/promises"); await fs.unlink(r.audioPath); } catch {} }
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ════════════════ Промокоды ════════════════
  // Helper: проверка валидности промокода с расчётом скидки
  function evaluatePromo(promo: any, amountKop: number): { ok: true; discountKop: number; finalKop: number } | { ok: false; error: string } {
    if (!promo) return { ok: false, error: "Промокод не найден" };
    if (!promo.isActive) return { ok: false, error: "Промокод деактивирован" };
    const now = Date.now();
    if (promo.validFrom && new Date(promo.validFrom).getTime() > now) return { ok: false, error: "Промокод ещё не действует" };
    if (promo.validUntil && new Date(promo.validUntil).getTime() < now) return { ok: false, error: "Срок действия истёк" };
    if (promo.maxUses != null && promo.usedCount >= promo.maxUses) return { ok: false, error: "Лимит использований исчерпан" };
    let discount = 0;
    if (promo.discountType === 'percent') {
      const pct = Math.max(0, Math.min(100, Number(promo.discountValue) || 0));
      discount = Math.floor((amountKop * pct) / 100);
    } else {
      discount = Math.min(amountKop, Math.floor(Number(promo.discountValue) * 100));
    }
    return { ok: true, discountKop: discount, finalKop: Math.max(0, amountKop - discount) };
  }

  // GET /api/admin/promo-codes — список (admin)
  app.get("/api/admin/promo-codes", requireAuth, async (req, res) => {
    try {
      const t = await storage.getTutor(req.session.tutorId!);
      if (!t?.isAdmin) return res.status(403).json({ error: "Forbidden" });
      const list = await storage.listPromoCodes();
      res.json(list);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/admin/promo-codes — создать (admin)
  app.post("/api/admin/promo-codes", requireAuth, async (req, res) => {
    try {
      const t = await storage.getTutor(req.session.tutorId!);
      if (!t?.isAdmin) return res.status(403).json({ error: "Forbidden" });
      const schema = z.object({
        code: z.string().min(2).max(64).regex(/^[A-Za-z0-9_-]+$/, "Только буквы, цифры, _ и -"),
        description: z.string().max(500).optional().nullable(),
        discountType: z.enum(['percent', 'fixed']),
        discountValue: z.number().int().positive(),
        scope: z.enum(['all', 'subscription', 'lessons', 'ai_packages']).default('all'),
        maxUses: z.number().int().positive().optional().nullable(),
        validFrom: z.string().optional().nullable(),
        validUntil: z.string().optional().nullable(),
        isActive: z.boolean().default(true),
      });
      const data = schema.parse(req.body);
      const existing = await storage.getPromoCodeByCode(data.code);
      if (existing) return res.status(409).json({ error: "Промокод с таким кодом уже существует" });
      const created = await storage.createPromoCode({
        ...data,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        createdBy: req.session.tutorId,
      });
      res.json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.issues[0]?.message || "Невалидные данные" });
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/admin/promo-codes/:id — обновить (admin)
  app.patch("/api/admin/promo-codes/:id", requireAuth, async (req, res) => {
    try {
      const t = await storage.getTutor(req.session.tutorId!);
      if (!t?.isAdmin) return res.status(403).json({ error: "Forbidden" });
      const schema = z.object({
        description: z.string().max(500).optional().nullable(),
        discountType: z.enum(['percent', 'fixed']).optional(),
        discountValue: z.number().int().positive().optional(),
        scope: z.enum(['all', 'subscription', 'lessons', 'ai_packages']).optional(),
        maxUses: z.number().int().positive().optional().nullable(),
        validFrom: z.string().optional().nullable(),
        validUntil: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const patch: any = { ...data };
      if (data.validFrom !== undefined) patch.validFrom = data.validFrom ? new Date(data.validFrom) : null;
      if (data.validUntil !== undefined) patch.validUntil = data.validUntil ? new Date(data.validUntil) : null;
      const updated = await storage.updatePromoCode(req.params.id, patch);
      if (!updated) return res.status(404).json({ error: "Не найдено" });
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.issues[0]?.message || "Невалидные данные" });
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/admin/promo-codes/:id — удалить (admin)
  app.delete("/api/admin/promo-codes/:id", requireAuth, async (req, res) => {
    try {
      const t = await storage.getTutor(req.session.tutorId!);
      if (!t?.isAdmin) return res.status(403).json({ error: "Forbidden" });
      await storage.deletePromoCode(req.params.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/promo-codes/validate — проверить промокод и вернуть скидку
  // body: { code, amount (рубли), scope }
  app.post("/api/promo-codes/validate", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        code: z.string().min(1),
        amount: z.number().positive(),
        scope: z.enum(['all', 'subscription', 'lessons', 'ai_packages']).default('subscription'),
      });
      const { code, amount, scope } = schema.parse(req.body);
      const promo = await storage.getPromoCodeByCode(code);
      if (!promo) return res.status(404).json({ error: "Промокод не найден" });
      if (promo.scope !== 'all' && promo.scope !== scope) {
        return res.status(400).json({ error: "Промокод не применим к этой покупке" });
      }
      const amountKop = Math.round(amount * 100);
      const eval_ = evaluatePromo(promo, amountKop);
      if (!eval_.ok) return res.status(400).json({ error: eval_.error });
      // Проверка одноразового использования: один промокод — один раз на пользователя
      const used = await storage.hasUserRedeemed(promo.id, req.session.tutorId!);
      if (used) return res.status(400).json({ error: "Вы уже использовали этот промокод" });
      res.json({
        ok: true,
        promoId: promo.id,
        code: promo.code,
        description: promo.description,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        originalAmount: amount,
        discountAmount: eval_.discountKop / 100,
        finalAmount: eval_.finalKop / 100,
      });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.issues[0]?.message || "Невалидные данные" });
      res.status(500).json({ error: e.message });
    }
  });

  // Внутренняя функция: применить промокод после успешной оплаты (использовать из чекаута)
  // Экспортируем через app.locals для возможного reuse
  (app as any).locals.applyPromoCode = async (params: {
    code: string; userId: string; userRole: 'tutor'|'student'; scope: string; amount: number; referenceId?: string;
  }) => {
    const promo = await storage.getPromoCodeByCode(params.code);
    if (!promo) throw new Error("Промокод не найден");
    const amountKop = Math.round(params.amount * 100);
    const ev = evaluatePromo(promo, amountKop);
    if (!ev.ok) throw new Error(ev.error);
    const already = await storage.hasUserRedeemed(promo.id, params.userId);
    if (already) throw new Error("Промокод уже использован");
    await storage.createPromoRedemption({
      promoCodeId: promo.id,
      userId: params.userId,
      userRole: params.userRole,
      scope: params.scope,
      originalAmount: amountKop,
      discountAmount: ev.discountKop,
      finalAmount: ev.finalKop,
      referenceId: params.referenceId,
    });
    await storage.incrementPromoCodeUse(promo.id);
    return { discountKop: ev.discountKop, finalKop: ev.finalKop };
  };

  return httpServer;
}
