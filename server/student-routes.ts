import type { Express, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./auth";
import { z } from "zod";
import { AI_PACKAGE_OPTIONS } from "../shared/schema";
import OpenAI from "openai";
import { openaiKey, appUrl } from "./builtin-config";
import { botManager } from "./telegram-bot";
import YooKassa from "yookassa";
import { generateBoardWsToken } from "./board-ws";
import nodemailer from "nodemailer";
import { publicLimiter } from "./rate-limit";
import { createHmac } from "crypto";
import { BUILTIN_TELEGRAM_TOKEN } from "./builtin-config";

function getSmtp() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT || "465";
  if (!host || !user || !pass) return null;
  return {
    transporter: nodemailer.createTransport({
      host, port: parseInt(port), secure: port === "465",
      auth: { user, pass }, tls: { rejectUnauthorized: false },
    }),
    from: process.env.SMTP_FROM || user,
  };
}
function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getOpenAIClient(apiKey?: string): OpenAI {
  return new OpenAI({ apiKey: apiKey || openaiKey() });
}

function getDeepSeekClient(apiKey?: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey || '',
    baseURL: 'https://api.deepseek.com',
  });
}

declare module "express-session" {
  interface SessionData {
    studentId?: string;
  }
}

async function requireStudentAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.studentId) {
    return res.status(401).json({ error: "Требуется авторизация ученика" });
  }
  next();
}

export function registerStudentRoutes(app: Express) {
  // ======= STUDENT AUTH =======

  // POST /api/student/auth/login - Вход ученика по email/паролю
  app.post("/api/student/auth/login", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().min(1),
        password: z.string(),
      });

      const { email, password } = schema.parse(req.body);

      const student = await storage.getStudentByEmail(email);
      if (!student) {
        return res.status(401).json({ error: "Неверный логин или пароль" });
      }

      if (!student.password) {
        return res.status(401).json({ error: "Пароль не установлен. Обратитесь к репетитору." });
      }

      const valid = await verifyPassword(password, student.password);
      if (!valid) {
        return res.status(401).json({ error: "Неверный email или пароль" });
      }

      req.session.studentId = student.id;

      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ error: "Ошибка сохранения сессии" });
        }
        res.json({
          id: student.id,
          name: student.name,
          subject: student.subject,
          goal: student.goal,
          grade: student.grade,
          progress: student.progress,
          balance: student.balance,
          curriculumTopic: student.curriculumTopic,
          links: student.links || {},
          pricePerLesson: student.pricePerLesson,
        });
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/student/auth/telegram-webapp - Авторизация через Telegram Mini App
  // Принимает initData (подписанная Telegram строка), валидирует HMAC,
  // находит ученика по telegramChatId и создаёт сессию.
  app.post("/api/student/auth/telegram-webapp", async (req, res) => {
    try {
      const { initData } = z.object({ initData: z.string().min(1) }).parse(req.body);

      const token = process.env.TELEGRAM_BOT_TOKEN
        || (await storage.getAiSetting("telegram_bot_token"))
        || BUILTIN_TELEGRAM_TOKEN;
      if (!token) {
        return res.status(500).json({ error: "Telegram bot не настроен" });
      }

      // Парсим initData (URLSearchParams)
      const params = new URLSearchParams(initData);
      const hash = params.get("hash");
      if (!hash) return res.status(400).json({ error: "Нет hash в initData" });
      params.delete("hash");

      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");

      const secret = createHmac("sha256", "WebAppData").update(token).digest();
      const computed = createHmac("sha256", secret).update(dataCheckString).digest("hex");
      if (computed !== hash) {
        return res.status(401).json({ error: "Неверная подпись initData" });
      }

      // Защита от старых initData (>24 ч)
      const authDate = parseInt(params.get("auth_date") || "0", 10);
      if (!authDate || Date.now() / 1000 - authDate > 86400) {
        return res.status(401).json({ error: "initData устарела" });
      }

      const userJson = params.get("user");
      if (!userJson) return res.status(400).json({ error: "Нет user в initData" });
      const tgUser = JSON.parse(userJson);
      const tgUserId = String(tgUser.id || "");
      if (!tgUserId) return res.status(400).json({ error: "Нет id у пользователя" });

      // Ищем ученика по telegramChatId (в private chat user.id == chat.id)
      const student = await storage.getStudentByTelegramChatId(tgUserId);
      if (!student) {
        return res.status(404).json({
          error: "Аккаунт не привязан",
          hint: "Зайдите в кабинет на сайте → Профиль → Привязать Telegram",
          tgUserId,
        });
      }

      req.session.studentId = student.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: "Ошибка сессии" });
        res.json({
          id: student.id,
          name: student.name,
          subject: student.subject,
          goal: student.goal,
          grade: student.grade,
          progress: student.progress,
          balance: student.balance,
          curriculumTopic: student.curriculumTopic,
          links: student.links || {},
          pricePerLesson: student.pricePerLesson,
        });
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Ошибка авторизации" });
    }
  });

  // GET /api/student/auth/token/:token - Авторизация по токену (ссылке)
  app.get("/api/student/auth/token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const accessToken = await storage.getStudentAccessToken(token);
      if (!accessToken) {
        return res.status(401).json({ error: "Недействительная ссылка" });
      }

      const student = await storage.getStudent(accessToken.studentId);
      if (!student) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      // Обновляем время последнего использования
      await storage.updateStudentAccessTokenLastUsed(accessToken.id);

      // Сохраняем в сессии
      req.session.studentId = student.id;

      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ error: "Ошибка сохранения сессии" });
        }
        res.json({
          id: student.id,
          name: student.name,
          subject: student.subject,
          goal: student.goal,
          grade: student.grade,
          progress: student.progress,
          balance: student.balance,
          curriculumTopic: student.curriculumTopic,
          links: student.links || {},
          pricePerLesson: student.pricePerLesson,
        });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/auth/me - Проверка авторизации ученика
  app.get("/api/student/auth/me", async (req, res) => {
    try {
      if (!req.session.studentId) {
        return res.status(401).json({ error: "Не авторизован" });
      }

      const student = await storage.getStudent(req.session.studentId);
      if (!student) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      res.json({
        id: student.id,
        name: student.name,
        subject: student.subject,
        goal: student.goal,
        grade: student.grade,
        progress: student.progress,
        balance: student.balance,
        curriculumTopic: student.curriculumTopic,
        links: student.links || {},
        pricePerLesson: student.pricePerLesson,
        telegramLinked: !!(student as any).telegramChatId,
        receiptEmail: (student as any).receiptEmail || null,
        email: student.email || null,
        emailVerified: !!(student as any).emailVerified,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/student/auth/logout - Выход
  app.post("/api/student/auth/logout", (req, res) => {
    req.session.studentId = undefined;
    req.session.save(() => {
      res.json({ success: true });
    });
  });

  // ======= STUDENT TELEGRAM =======

  // GET /api/student/telegram/status — bot running + student linked?
  app.get("/api/student/telegram/status", requireStudentAuth, async (req, res) => {
    try {
      const student = await storage.getStudent(req.session.studentId!);
      if (!student) return res.status(404).json({ error: "Не найдено" });
      res.json({
        botRunning: botManager.isRunning(),
        botUsername: botManager.getBotUsername() || null,
        telegramLinked: !!(student as any).telegramChatId,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/student/telegram/generate-code — student generates own link code
  app.post("/api/student/telegram/generate-code", requireStudentAuth, async (req, res) => {
    try {
      if (!botManager.isRunning()) {
        return res.status(400).json({ error: "Telegram бот не настроен администратором" });
      }
      const studentId = req.session.studentId!;
      const code = await botManager.generateCode("student", studentId);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      res.json({ code, expiresAt, botUsername: botManager.getBotUsername() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/student/telegram/unlink — student unlinks own Telegram
  app.post("/api/student/telegram/unlink", requireStudentAuth, async (req, res) => {
    try {
      await storage.updateStudent(req.session.studentId!, { telegramChatId: null } as any);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/student/link-settings - Настройки ссылок репетитора для ученика
  app.get("/api/student/link-settings", requireStudentAuth, async (req, res) => {
    try {
      const student = await storage.getStudent(req.session.studentId!);
      if (!student) return res.status(404).json({ error: "Не найдено" });
      const tutor = await storage.getTutor(student.tutorId);
      const defaults = { showBbb: true, showExternalConf: true, showInternalBoard: true, showExternalBoard: true };
      res.json({ ...defaults, ...(tutor?.linkSettings as object || {}) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/student/lessons - Занятия ученика
  app.get("/api/student/lessons", requireStudentAuth, async (req, res) => {
    try {
      const lessons = await storage.getLessonsByStudentId(req.session.studentId!, 50);
      res.json(lessons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/payments - Платежи ученика (только подтверждённые)
  app.get("/api/student/payments", requireStudentAuth, async (req, res) => {
    try {
      const payments = await storage.getPaymentsByStudentId(req.session.studentId!, 100);
      // Фильтруем: ручные платежи (без yookassaPaymentId) + подтверждённые онлайн (succeeded)
      // Pending и canceled онлайн-платежи не учитываются в балансе
      const confirmed = payments.filter((p: any) =>
        !p.yookassaPaymentId || p.yookassaStatus === "succeeded"
      );
      res.json(confirmed);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/homework - Домашние задания ученика
  app.get("/api/student/homework", requireStudentAuth, async (req, res) => {
    try {
      const homework = await storage.getHomeworkByStudentId(req.session.studentId!, 20);
      res.json(homework);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/leaderboard - Рейтинг учеников репетитора
  app.get("/api/student/leaderboard", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const me = await storage.getStudent(studentId);
      if (!me) return res.status(404).json({ error: "Ученик не найден" });

      const tutorId = me.tutorId;
      const allStudents = await storage.getStudentsByTutorId(tutorId);
      const allLessons = await storage.getLessonsByTutorId(tutorId);
      const allHomework = await storage.getHomeworkByTutorId(tutorId);

      const scores = allStudents
        .filter(s => s.isActive)
        .map(s => {
          const sLessons = allLessons.filter(l => l.studentId === s.id && l.status === "completed" && (l as any).rating);
          const avgRating = sLessons.length > 0
            ? sLessons.reduce((sum, l) => sum + ((l as any).rating || 0), 0) / sLessons.length
            : 0;
          const sHw = allHomework.filter(h => h.studentId === s.id);
          const completedHw = sHw.filter(h => h.status === "reviewed" || h.status === "completed").length;
          const submittedHw = sHw.filter(h => h.status === "submitted").length;
          const hwPoints = Math.min(completedHw * 15 + submittedHw * 5, 100);
          const totalScore = Math.round(avgRating * 20 + hwPoints);
          const firstName = s.name.split(" ")[0];
          return {
            studentId: s.id,
            name: firstName,
            avgRating: Math.round(avgRating * 10) / 10,
            hwPoints,
            totalScore,
            isMe: s.id === studentId,
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);

      const top5 = scores.slice(0, 5);
      const myRank = scores.findIndex(s => s.isMe) + 1;
      const myEntry = scores.find(s => s.isMe);
      const includesMe = top5.some(s => s.isMe);

      res.json({ top5, myRank, myEntry: includesMe ? null : myEntry, total: scores.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/student/homework/:id/submit - Сдать домашку
  app.post("/api/student/homework/:id/submit", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const homeworkId = req.params.id as string;

      const allHw = await storage.getHomeworkByStudentId(studentId);
      const hw = allHw.find(h => h.id === homeworkId);
      if (!hw) {
        return res.status(404).json({ error: "Домашка не найдена" });
      }

      const solutionAttachments = Array.isArray(req.body.solutionAttachments)
        ? req.body.solutionAttachments.filter((s: any) => typeof s === 'string' && s.trim())
        : [];

      const solutionText = typeof req.body.solutionText === 'string' ? req.body.solutionText.trim() : '';

      const updated = await storage.updateHomework(homeworkId, {
        status: "submitted",
        submittedAt: new Date(),
        completionPct: 100,
        solutionAttachments,
        solutionText,
      });

      // Telegram notification to tutor
      const student = await storage.getStudent(studentId);
      if (student) {
        botManager.sendToTutor(student.tutorId,
          `📚 <b>Новая работа на проверку!</b>\n\n` +
          `👤 Ученик: <b>${student.name}</b>\n` +
          `📝 Задание: ${hw.title}\n\n` +
          `Проверьте в платформе Твой Вектор.`
        ).catch(() => {});
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= AI CHATS =======

  const MAX_CHATS = 20;

  // GET /api/student/chats - Список чатов
  app.get("/api/student/chats", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const chats = await storage.getAiChatsByStudentId(studentId);
      res.json(chats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/student/chats - Создать новый чат
  app.post("/api/student/chats", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const { homeworkId, title } = req.body;

      const existingChats = await storage.getAiChatsByStudentId(studentId);
      if (existingChats.length >= MAX_CHATS) {
        return res.status(400).json({ error: `Максимум ${MAX_CHATS} чатов. Удалите старые, чтобы создать новый.` });
      }

      if (homeworkId) {
        const homework = await storage.getHomeworkByStudentId(studentId);
        if (!homework.find(h => h.id === homeworkId)) {
          return res.status(403).json({ error: "Доступ запрещён" });
        }
      }

      const chat = await storage.createAiChat({
        studentId,
        homeworkId: homeworkId || null,
        title: title || "Новый чат",
      });
      res.json(chat);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/student/chats/:id - Удалить чат
  app.delete("/api/student/chats/:id", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const id = req.params.id as string;
      const chat = await storage.getAiChat(id);
      if (!chat || chat.studentId !== studentId) {
        return res.status(404).json({ error: "Чат не найден" });
      }
      await storage.deleteAiChat(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/chats/:id/messages - Сообщения чата
  app.get("/api/student/chats/:id/messages", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const id = req.params.id as string;
      const chat = await storage.getAiChat(id);
      if (!chat || chat.studentId !== studentId) {
        return res.status(404).json({ error: "Чат не найден" });
      }
      const messages = await storage.getAiChatMessagesByChatId(id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/ai-config - Доступные модели и лимиты
  app.get("/api/student/ai-config", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const settings = await storage.getAiSettings();
      const hasOpenAI = !!(settings.openai_api_key || openaiKey());
      const hasDeepSeek = !!settings.deepseek_api_key;
      const packageBalance = await storage.getAiPackageBalance(studentId, 'student');

      const models: any[] = [];
      if (hasOpenAI) {
        const usage = await storage.getAiUsageToday(studentId, 'openai');
        const limit = parseInt(settings.daily_limit_openai || '50');
        const available = usage < limit || packageBalance > 0;
        models.push({ id: 'openai', name: 'GPT-4o', usage, limit, available });

        const usageMini = await storage.getAiUsageToday(studentId, 'gpt4o-mini');
        const limitMini = parseInt(settings['daily_limit_gpt4o-mini'] || '100');
        const availableMini = usageMini < limitMini || packageBalance > 0;
        models.push({ id: 'gpt4o-mini', name: 'GPT-4o mini', usage: usageMini, limit: limitMini, available: availableMini });
      }
      if (hasDeepSeek) {
        const usage = await storage.getAiUsageToday(studentId, 'deepseek');
        const limit = parseInt(settings.daily_limit_deepseek || '100');
        const available = usage < limit || packageBalance > 0;
        models.push({ id: 'deepseek', name: 'DeepSeek', usage, limit, available });
      }

      const preferredDefault = settings.default_model || 'openai';
      const validDefault = models.find(m => m.id === preferredDefault && m.available)
        || models.find(m => m.available)
        || models[0];

      res.json({
        models,
        defaultModel: validDefault?.id || 'openai',
        packageBalance,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/ai-packages/balance - Баланс пакетов ИИ для ученика
  app.get("/api/student/ai-packages/balance", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const balance = await storage.getAiPackageBalance(studentId, 'student');
      const packages = await storage.getAiPackages(studentId, 'student');
      const totalPurchased = packages.reduce((sum: number, p: any) => sum + p.credits, 0);
      const totalUsed = packages.reduce((sum: number, p: any) => sum + p.usedCredits, 0);
      res.json({ balance, totalPurchased, totalUsed, packages });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/student/ai-packages/purchase - Купить пакет ИИ для ученика
  app.post("/api/student/ai-packages/purchase", requireStudentAuth, async (req, res) => {
    try {
      const schema = z.object({
        credits: z.number().min(1),
        pricePaid: z.number().min(0),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Неверные данные" });
      const { credits, pricePaid } = parsed.data;

      const validOption = AI_PACKAGE_OPTIONS.find(o => o.credits === credits && o.price === pricePaid);
      if (!validOption) return res.status(400).json({ error: "Недопустимый пакет" });

      const studentId = req.session.studentId!;
      const pkg = await storage.purchaseAiPackage(studentId, 'student', validOption.credits, validOption.price);
      res.json({ success: true, package: pkg });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/student/chats/:id/messages - Отправить сообщение в чат
  app.post("/api/student/chats/:id/messages", requireStudentAuth, async (req, res) => {
    try {
      const bodySchema = z.object({
        message: z.string().min(1),
        imageBase64: z.string().optional(),
        model: z.enum(['openai', 'deepseek', 'gpt4o-mini']).optional(),
      });

      const { message, imageBase64, model: requestedModel } = bodySchema.parse(req.body);
      const studentId = req.session.studentId!;
      const chatId = req.params.id as string;

      const chat = await storage.getAiChat(chatId);
      if (!chat || chat.studentId !== studentId) {
        return res.status(404).json({ error: "Чат не найден" });
      }

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      const settings = await storage.getAiSettings();
      let selectedModel = requestedModel || settings.default_model || 'openai';

      const hasOpenAI = !!(settings.openai_api_key || openaiKey());
      const hasDeepSeek = !!settings.deepseek_api_key;

      if ((selectedModel === 'openai' || selectedModel === 'gpt4o-mini') && !hasOpenAI) {
        if (hasDeepSeek) selectedModel = 'deepseek';
        else return res.status(400).json({ error: "ИИ-модель недоступна. Обратитесь к администратору." });
      }
      if (selectedModel === 'deepseek' && !hasDeepSeek) {
        if (hasOpenAI) selectedModel = 'openai';
        else return res.status(400).json({ error: "ИИ-модель недоступна. Обратитесь к администратору." });
      }

      const dailyLimit = parseInt(settings[`daily_limit_${selectedModel}`] || '50');
      const currentUsage = await storage.getAiUsageToday(studentId, selectedModel);
      let usingPackage = false;
      if (currentUsage >= dailyLimit) {
        const packageBalance = await storage.getAiPackageBalance(studentId, 'student');
        if (packageBalance > 0) {
          usingPackage = true;
        } else {
          return res.status(429).json({
            error: `Дневной лимит исчерпан (${dailyLimit} сообщений). Докупите пакет ИИ или подождите до завтра.`,
            limitReached: true,
          });
        }
      }

      await storage.createAiChatMessage({
        chatId,
        studentId,
        homeworkId: chat.homeworkId || null,
        role: 'user',
        content: message,
        imageUrl: imageBase64 ? `data:image/png;base64,${imageBase64.replace(/^data:image\/\w+;base64,/, '')}` : null,
      });

      let context = `Ты — ИИ-помощник для ученика ${student.name} (${student.grade}, ${student.subject}).
Цель ученика: ${student.goal}.
Текущая тема: ${student.curriculumTopic}.

ВАЖНО: Ты помогаешь ученику ПОНЯТЬ материал, а не просто даёшь готовые ответы!
- Задавай наводящие вопросы
- Объясняй шаг за шагом
- Если ученик ошибся — объясни почему и помоги исправить
- Хвали за правильные шаги
- Используй простой и понятный язык
- Используй LaTeX для формул: оборачивай формулы в $...$ для инлайн и $$...$$ для блочных
`;

      if (chat.homeworkId) {
        const homework = await storage.getHomeworkByStudentId(studentId);
        const hw = homework.find(h => h.id === chat.homeworkId);
        if (hw) {
          context += `\nДомашнее задание: ${hw.title}\n${hw.description || ''}`;
        }
      }

      const history = await storage.getAiChatMessagesByChatId(chatId, 30);
      const aiMessages: any[] = [
        { role: 'system', content: context },
      ];

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
          aiMessages.push({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          });
        }
      }

      let client: OpenAI;
      let modelName: string;
      if (selectedModel === 'deepseek') {
        client = getDeepSeekClient(settings.deepseek_api_key);
        modelName = 'deepseek-chat';
      } else if (selectedModel === 'gpt4o-mini') {
        client = getOpenAIClient(settings.openai_api_key || undefined);
        modelName = 'gpt-4o-mini';
      } else {
        client = getOpenAIClient(settings.openai_api_key || undefined);
        modelName = 'gpt-4o';
      }

      const completion = await client.chat.completions.create({
        model: modelName,
        messages: aiMessages,
        max_tokens: 1000,
        temperature: 0.7,
      });

      const assistantMessage = completion.choices[0]?.message?.content || "Извини, не могу ответить сейчас.";

      if (usingPackage) {
        await storage.consumeAiPackageCredit(studentId, 'student');
      }
      await storage.incrementAiUsage(studentId, selectedModel);

      const savedMessage = await storage.createAiChatMessage({
        chatId,
        studentId,
        homeworkId: chat.homeworkId || null,
        role: 'assistant',
        content: assistantMessage,
      });

      if (history.length <= 2) {
        const shortTitle = message.length > 40 ? message.substring(0, 37) + "..." : message;
        await storage.updateAiChatTitle(chatId, shortTitle);
      } else {
        await storage.updateAiChatTitle(chatId, chat.title);
      }

      res.json(savedMessage);
    } catch (error: any) {
      console.error("AI Chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Legacy endpoint for backward compatibility
  app.get("/api/student/chat", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const messages = await storage.getAiChatMessagesByStudentId(studentId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======= TUTOR: Generate access link =======

  // POST /api/students/:id/set-password - Установить пароль для ученика (для репетитора)
  app.post("/api/students/:id/set-password", async (req, res) => {
    try {
      if (!req.session.tutorId) {
        return res.status(401).json({ error: "Требуется авторизация" });
      }

      const schema = z.object({
        email: z.string().min(1, "Введите логин"),
        password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
      });

      const { id } = req.params;
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        return res.status(400).json({ error: firstError.message });
      }
      const { email, password } = parsed.data;
      
      const student = await storage.getStudent(id);
      if (!student || student.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      // Проверяем что email не занят другим учеником
      const existingStudent = await storage.getStudentByEmail(email);
      if (existingStudent && existingStudent.id !== id) {
        return res.status(400).json({ error: "Этот email уже используется другим учеником" });
      }

      const hashedPassword = await hashPassword(password);
      
      const updated = await storage.updateStudent(id, {
        email,
        password: hashedPassword,
      });

      res.json({ success: true, email: updated?.email });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ======= STUDENT SELF-SERVICE AUTH =======

  // PATCH /api/student/profile - Смена email/пароля учеником (требует текущий пароль для смены пароля)
  app.patch("/api/student/profile", requireStudentAuth, async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email().optional(),
        currentPassword: z.string().min(1).optional(),
        newPassword: z.string().min(6).optional(),
      }).refine(
        d => !!(d.email || (d.currentPassword && d.newPassword)),
        { message: "Нечего обновлять" }
      );
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { email, currentPassword, newPassword } = parsed.data;
      const student = await storage.getStudent(req.session.studentId!);
      if (!student) return res.status(404).json({ error: "Ученик не найден" });

      const patch: any = {};

      // Смена пароля
      if (newPassword) {
        if (!student.password) {
          return res.status(400).json({ error: "Текущий пароль не установлен. Обратитесь к репетитору." });
        }
        if (!currentPassword) return res.status(400).json({ error: "Укажите текущий пароль" });
        const ok = await verifyPassword(currentPassword, student.password);
        if (!ok) return res.status(400).json({ error: "Текущий пароль неверен" });
        patch.password = await hashPassword(newPassword);
      }

      // Смена email — сбрасывает подтверждение
      if (email && email !== student.email) {
        const existing = await storage.getStudentByEmail(email);
        if (existing && existing.id !== student.id) {
          return res.status(400).json({ error: "Этот email уже используется" });
        }
        patch.email = email;
        (patch as any).emailVerified = false;
      }

      if (Object.keys(patch).length === 0) return res.json({ success: true });
      await storage.updateStudent(student.id, patch);

      // Если менялся пароль — регенерируем сессию (инвалидируем старые cookie с этим SID)
      if (patch.password) {
        const currentStudentId = req.session.studentId;
        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err) => err ? reject(err) : resolve());
        });
        req.session.studentId = currentStudentId;
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => err ? reject(err) : resolve());
        });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Кулдаун 60 секунд между запросами на отправку письма подтверждения
  const verificationCooldown = new Map<string, number>();

  // POST /api/student/auth/send-verification - Отправить письмо подтверждения
  app.post("/api/student/auth/send-verification", requireStudentAuth, async (req, res) => {
    try {
      const student = await storage.getStudent(req.session.studentId!);
      if (!student) return res.status(404).json({ error: "Ученик не найден" });
      if (!student.email) return res.status(400).json({ error: "Сначала добавьте email в профиле" });
      if ((student as any).emailVerified) return res.json({ success: true, alreadyVerified: true });

      const now = Date.now();
      const last = verificationCooldown.get(student.id) || 0;
      if (now - last < 60_000) {
        const wait = Math.ceil((60_000 - (now - last)) / 1000);
        return res.status(429).json({ error: `Подождите ${wait} сек перед повторной отправкой` });
      }
      verificationCooldown.set(student.id, now);

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.createStudentEmailVerificationToken(student.id, token, expiresAt);

      const smtp = getSmtp();
      if (smtp) {
        const verifyUrl = `${req.protocol}://${req.get("host")}/student/verify-email?token=${token}`;
        await smtp.transporter.sendMail({
          from: smtp.from,
          to: student.email,
          subject: "Подтверждение email — Твой Вектор",
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2>Подтверждение email</h2>
            <p>Здравствуйте, ${escapeHtml(student.name)}!</p>
            <p>Подтвердите ваш email, чтобы иметь возможность самостоятельно восстанавливать пароль.</p>
            <p><a href="${verifyUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Подтвердить email</a></p>
            <p>Ссылка действительна 24 часа. Если вы не запрашивали подтверждение — проигнорируйте письмо.</p>
          </div>`,
        });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // GET /api/student/auth/verify-email?token=xxx - Подтверждение email
  app.get("/api/student/auth/verify-email", async (req, res) => {
    try {
      const token = String(req.query.token || "");
      if (!token) return res.status(400).json({ error: "Токен не указан" });
      const vt = await storage.getStudentEmailVerificationToken(token);
      if (!vt) return res.status(400).json({ error: "Недействительная ссылка" });
      if (vt.usedAt) return res.status(400).json({ error: "Ссылка уже использована" });
      if (new Date(vt.expiresAt) < new Date()) return res.status(400).json({ error: "Срок действия истёк" });
      await storage.updateStudent(vt.studentId, { emailVerified: true } as any);
      await storage.markStudentEmailVerificationTokenUsed(vt.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/student/auth/forgot-password - Запрос на восстановление пароля (только для подтверждённой почты)
  app.post("/api/student/auth/forgot-password", publicLimiter, async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const student = await storage.getStudentByEmail(email);
      // Всегда отвечаем success, чтобы не раскрывать наличие аккаунта
      if (!student || !(student as any).emailVerified) {
        return res.json({ success: true });
      }
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await storage.createStudentPasswordResetToken(student.id, token, expiresAt);

      const smtp = getSmtp();
      if (smtp) {
        const resetUrl = `${req.protocol}://${req.get("host")}/student/reset-password?token=${token}`;
        await smtp.transporter.sendMail({
          from: smtp.from,
          to: student.email!,
          subject: "Восстановление пароля — Твой Вектор",
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2>Восстановление пароля</h2>
            <p>Здравствуйте, ${escapeHtml(student.name)}!</p>
            <p>Для сброса пароля перейдите по ссылке:</p>
            <p><a href="${resetUrl}" style="color:#3b82f6;">${resetUrl}</a></p>
            <p>Ссылка действительна 1 час. Если вы не запрашивали восстановление — проигнорируйте это письмо.</p>
          </div>`,
        });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/student/auth/reset-password - Сброс пароля по токену
  app.post("/api/student/auth/reset-password", publicLimiter, async (req, res) => {
    try {
      const { token, password } = z.object({
        token: z.string(),
        password: z.string().min(6),
      }).parse(req.body);

      const rt = await storage.getStudentPasswordResetToken(token);
      if (!rt) return res.status(400).json({ error: "Недействительная ссылка" });
      if (rt.usedAt) return res.status(400).json({ error: "Эта ссылка уже была использована" });
      if (new Date(rt.expiresAt) < new Date()) return res.status(400).json({ error: "Ссылка истекла. Запросите новую." });

      const hashed = await hashPassword(password);
      await storage.updateStudent(rt.studentId, { password: hashed });
      await storage.markStudentPasswordResetTokenUsed(rt.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/students/:id/access-link - Сгенерировать ссылку доступа (для репетитора)
  app.post("/api/students/:id/access-link", async (req, res) => {
    try {
      if (!req.session.tutorId) {
        return res.status(401).json({ error: "Требуется авторизация" });
      }

      const { id } = req.params;
      const student = await storage.getStudent(id);
      
      if (!student || student.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      // Генерируем HMAC-токен (не требует таблицы в БД)
      const accessTokenObj = await storage.createStudentAccessToken(id);
      const token = accessTokenObj.token;

      // Формируем ссылку (используем production URL вместо dev domain)
      const accessLink = `${appUrl()}/student?token=${token}`;

      res.json({ accessLink, token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/students/:id/access-tokens - Получить токены доступа ученика (для репетитора)
  app.get("/api/students/:id/access-tokens", async (req, res) => {
    try {
      if (!req.session.tutorId) {
        return res.status(401).json({ error: "Требуется авторизация" });
      }

      const { id } = req.params;
      const student = await storage.getStudent(id);
      
      if (!student || student.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      const tokens = await storage.getStudentAccessTokensByStudentId(id);
      res.json(tokens);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/students/:id/access-tokens/:tokenId - Деактивировать токен
  app.delete("/api/students/:id/access-tokens/:tokenId", async (req, res) => {
    try {
      if (!req.session.tutorId) {
        return res.status(401).json({ error: "Требуется авторизация" });
      }

      const { id, tokenId } = req.params;
      const student = await storage.getStudent(id);
      
      if (!student || student.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      await storage.deactivateStudentAccessToken(tokenId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/students/:id/chat-history - История чата ученика (для репетитора)
  app.get("/api/students/:id/chat-history", async (req, res) => {
    try {
      if (!req.session.tutorId) {
        return res.status(401).json({ error: "Требуется авторизация" });
      }

      const { id } = req.params;
      const student = await storage.getStudent(id);
      
      if (!student || student.tutorId !== req.session.tutorId) {
        return res.status(404).json({ error: "Ученик не найден" });
      }

      const messages = await storage.getAiChatMessagesByStudentId(id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/notes - Личные заметки ученика
  app.get("/api/student/notes", requireStudentAuth, async (req, res) => {
    try {
      const note = await storage.getStudentNote(req.session.studentId!);
      res.json(note || { content: "" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/student/notes - Сохранить заметку ученика
  app.put("/api/student/notes", requireStudentAuth, async (req, res) => {
    try {
      const { content } = req.body;
      const note = await storage.upsertStudentNote(req.session.studentId!, content ?? "");
      res.json(note);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/messages - Прямые сообщения ученика
  app.get("/api/student/messages", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      await storage.markDirectMessagesRead(studentId, 'student');
      const messages = await storage.getDirectMessagesByStudentId(studentId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/student/messages - Отправить сообщение репетитору
  app.post("/api/student/messages", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const student = await storage.getStudent(studentId);
      if (!student) return res.status(404).json({ error: "Ученик не найден" });
      const { content, fileUrls } = req.body;
      if (!content?.trim() && (!fileUrls || fileUrls.length === 0)) return res.status(400).json({ error: "Пустое сообщение" });
      const msg = await storage.createDirectMessage({
        tutorId: student.tutorId,
        studentId,
        role: 'student',
        content: content?.trim() || '',
        fileUrls: fileUrls || [],
        isRead: false,
      });

      // Telegram notification to tutor
      const preview = (content?.trim() || "📎 файл").slice(0, 80);
      botManager.sendToTutor(student.tutorId,
        `💬 <b>Новое сообщение от ${student.name}</b>\n\n` +
        `${preview}${preview.length >= 80 ? "…" : ""}\n\n` +
        `Ответьте в платформе Твой Вектор.`
      ).catch(() => {});

      res.json(msg);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/student/messages/:messageId - Удалить своё сообщение
  app.delete("/api/student/messages/:messageId", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const msg = await storage.getDirectMessageById(req.params.messageId as string);
      if (!msg) return res.status(404).json({ error: "Сообщение не найдено" });
      if (msg.studentId !== studentId) return res.status(403).json({ error: "Нет доступа" });
      if (msg.role !== 'student') return res.status(403).json({ error: "Можно удалять только свои сообщения" });
      await storage.deleteDirectMessage(req.params.messageId as string);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/messages/unread-count
  app.get("/api/student/messages/unread-count", requireStudentAuth, async (req, res) => {
    try {
      const count = await storage.getUnreadDirectMessageCount(req.session.studentId!, 'student');
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/bbb/conference - получить конференцию ученика и ссылку для входа
  app.get("/api/student/bbb/conference", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const student = await storage.getStudent(studentId);
      if (!student) return res.status(404).json({ error: "Ученик не найден" });

      const conference = await storage.getConferenceByStudentId(studentId);
      if (!conference) return res.json({ hasConference: false });

      const { getBbbJoinUrl, createBbbMeeting } = await import("./bbb");
      // Убеждаемся что встреча создана
      await createBbbMeeting(
        conference.meetingId, conference.title,
        conference.attendeePw, conference.moderatorPw
      ).catch(() => {});

      const joinUrl = await getBbbJoinUrl(
        conference.meetingId,
        student.name,
        conference.attendeePw,
        `student-${studentId}`,
        'viewer',
      );

      res.json({
        hasConference: true,
        title: conference.title,
        joinUrl,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/student/progress - Прогресс и аналитика ученика
  app.get("/api/student/progress", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const homework = await storage.getHomeworkByStudentId(studentId, 500);
      const lessons = await storage.getLessonsByStudentId(studentId, 500);

      const now = new Date();

      // Общая статистика по ДЗ
      const totalHw = homework.length;
      const completedHw = homework.filter(h => h.status === 'reviewed' || h.status === 'completed').length;
      const submittedHw = homework.filter(h => h.status === 'submitted').length;
      const completionPct = totalHw > 0 ? Math.round((completedHw / totalHw) * 100) : 0;

      // Средняя оценка (из проверенных)
      const gradedHw = homework.filter(h => h.score != null);
      const avgGrade = gradedHw.length > 0
        ? Math.round((gradedHw.reduce((s, h) => s + (h.score || 0), 0) / gradedHw.length) * 10) / 10
        : null;

      const lessonsCompleted = lessons.filter(l => l.status === 'completed').length;

      // Статистика по неделям (последние 10 недель)
      const weeklyStats = [];
      for (let w = 9; w >= 0; w--) {
        const wStart = new Date(now);
        wStart.setDate(now.getDate() - (w + 1) * 7);
        wStart.setHours(0, 0, 0, 0);
        const wEnd = new Date(now);
        wEnd.setDate(now.getDate() - w * 7);
        wEnd.setHours(23, 59, 59, 999);

        const wHw = homework.filter(h => {
          const d = new Date(h.createdAt as any);
          return d >= wStart && d <= wEnd;
        });
        const wCompleted = wHw.filter(h => h.status === 'reviewed' || h.status === 'completed');
        const wGrades = wCompleted.filter(h => h.score != null).map(h => h.score || 0);
        const wAvgGrade = wGrades.length > 0 ? Math.round(wGrades.reduce((a, b) => a + b, 0) / wGrades.length * 10) / 10 : null;

        const wLessons = lessons.filter(l => {
          const d = new Date(l.scheduledAt);
          return d >= wStart && d <= wEnd;
        });
        const wComplL = wLessons.filter(l => l.status === 'completed').length;

        const label = `${wStart.getDate()}.${(wStart.getMonth() + 1).toString().padStart(2, '0')}`;
        weeklyStats.push({
          label,
          assigned: wHw.length,
          completed: wCompleted.length,
          avgGrade: wAvgGrade,
          lessons: wComplL,
        });
      }

      // Стрик — недели подряд с выполненным хотя бы одним заданием
      let streak = 0;
      for (let w = 0; w < 52; w++) {
        const wStart = new Date(now);
        wStart.setDate(now.getDate() - (w + 1) * 7);
        const wEnd = new Date(now);
        wEnd.setDate(now.getDate() - w * 7);
        const wCompleted = homework.filter(h => {
          const d = new Date((h as any).reviewedAt || (h as any).submittedAt || h.createdAt as any);
          return d >= wStart && d <= wEnd && (h.status === 'reviewed' || h.status === 'completed');
        });
        if (wCompleted.length > 0) streak++;
        else break;
      }

      // Стрик ДЗ подряд: сколько выполнено ДЗ без пропуска с начала до ближайшего невыполненного
      // Сортируем по дедлайну (или дате создания, если нет) и считаем
      const sortedHw = [...homework]
        .filter(h => !!(h as any).deadline || !!h.createdAt)
        .sort((a, b) => {
          const da = new Date(((a as any).deadline || a.createdAt) as any).getTime();
          const db = new Date(((b as any).deadline || b.createdAt) as any).getTime();
          return db - da; // от новых к старым
        });
      let hwStreak = 0;
      let bestHwStreak = 0;
      let currentRun = 0;
      // Ученик сдал свою часть, если статус: submitted | reviewed | completed
      // (ожидание проверки репетитором не должно ломать серию)
      const isStudentDone = (h: any) => h.status === 'submitted' || h.status === 'reviewed' || h.status === 'completed';
      // Пропуск — только когда дедлайн УЖЕ прошёл, а ученик ничего не сдал
      const isMiss = (h: any) => {
        if (isStudentDone(h)) return false;
        const deadline = h.deadline ? new Date(h.deadline) : null;
        if (!deadline) return false; // без дедлайна не считаем пропуском
        return deadline <= now;
      };
      // сначала пройдёмся с конца (старые→новые) для "лучшего рекорда"
      for (let i = sortedHw.length - 1; i >= 0; i--) {
        const h = sortedHw[i];
        if (isStudentDone(h)) {
          currentRun++;
          if (currentRun > bestHwStreak) bestHwStreak = currentRun;
        } else if (isMiss(h)) {
          currentRun = 0;
        }
        // иначе: ещё ждёт дедлайна / без дедлайна — пропускаем, серию не трогаем
      }
      // Текущая серия с конца (новейшие ДЗ) — с первого выполненного пока не встретим пропуск
      for (const h of sortedHw) {
        if (isStudentDone(h)) hwStreak++;
        else if (isMiss(h)) break;
        // иначе: пропускаем (ещё ожидает дедлайна / без дедлайна)
      }

      // ─── XP & Уровни ────────────────────────────────────────────────────────
      let xp = 0;
      xp += completedHw * 10;                              // 10 XP за выполненное ДЗ
      xp += lessonsCompleted * 20;                         // 20 XP за посещённый урок
      gradedHw.forEach(h => { xp += (h.score || 0) * 2; }); // до 10 XP за оценку
      xp += streak * 15;                                   // 15 XP за каждую неделю стрика

      const LEVELS = [
        { level: 1, name: 'Новичок',      min: 0,    max: 150  },
        { level: 2, name: 'Старательный', min: 150,  max: 400  },
        { level: 3, name: 'Прилежный',    min: 400,  max: 750  },
        { level: 4, name: 'Продвинутый',  min: 750,  max: 1200 },
        { level: 5, name: 'Эксперт',      min: 1200, max: 2000 },
        { level: 6, name: 'Мастер',       min: 2000, max: Infinity },
      ];
      const lvlData = LEVELS.find(l => xp >= l.min && xp < l.max) || LEVELS[LEVELS.length - 1];
      const levelInfo = {
        level: lvlData.level,
        name: lvlData.name,
        xpCurrent: xp - lvlData.min,
        xpForNext: lvlData.max === Infinity ? null : lvlData.max - lvlData.min,
        totalXp: xp,
      };

      // ─── Недельная цель ──────────────────────────────────────────────────────
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      thisWeekStart.setHours(0, 0, 0, 0);

      // «Сделано учеником» = submitted/completed/reviewed (согласованно со стриком).
      const thisWeekHwDone = homework.filter(h => {
        const d = new Date((h as any).submittedAt || h.createdAt as any);
        return d >= thisWeekStart && (h.status === 'submitted' || h.status === 'reviewed' || h.status === 'completed');
      }).length;
      const thisWeekLessonsDone = lessons.filter(l => {
        const d = new Date(l.scheduledAt);
        return d >= thisWeekStart && l.status === 'completed';
      }).length;

      // Цель — среднее за последние 4 недели, минимум 1
      const last4Avg = weeklyStats.slice(-5, -1).reduce((s, w) => s + w.assigned, 0) / 4;
      const hwGoal = Math.max(1, Math.min(5, Math.round(last4Avg)));
      const lessonGoal = 1;

      const weeklyGoal = {
        hwTarget: hwGoal,
        hwDone: thisWeekHwDone,
        lessonTarget: lessonGoal,
        lessonDone: thisWeekLessonsDone,
      };

      // ─── XP разбивка ────────────────────────────────────────────────────────
      const xpFromHw = completedHw * 10;
      const xpFromLessons = lessonsCompleted * 20;
      const xpFromGrades = gradedHw.reduce((s, h) => s + (h.score || 0) * 2, 0);
      const xpFromStreak = streak * 15;
      const xpBreakdown = { hw: xpFromHw, lessons: xpFromLessons, grades: xpFromGrades, streak: xpFromStreak };

      // ─── Достижения (бейджи) ────────────────────────────────────────────────
      type Ach = { id: string; title: string; description: string; earned: boolean; category: string; hint?: string; progressValue?: number; progressMax?: number };
      const achievements: Ach[] = [];

      const firstCompleted = homework.find(h => h.status === 'reviewed' || h.status === 'completed');
      const allFives = gradedHw.filter(h => (h.score || 0) >= 5).length;
      const bestWeekHw = Math.max(0, ...weeklyStats.map(w => w.completed));

      const hwHint  = (n: number) => completedHw < n ? `Ещё ${n - completedHw} ДЗ` : undefined;
      const lsnHint = (n: number) => lessonsCompleted < n ? `Ещё ${n - lessonsCompleted} уроков` : undefined;
      const strHint = (n: number) => streak < n ? `Ещё ${n - streak} нед.` : undefined;
      const xpHint  = (n: number) => xp < n ? `Ещё ${n - xp} XP` : undefined;

      // Категория: Домашние задания
      achievements.push({ id: 'first_hw',  title: 'Первый шаг',   description: 'Выполнить первое ДЗ',  earned: !!firstCompleted, category: 'hw', hint: firstCompleted ? undefined : 'Выполни первое ДЗ', progressValue: Math.min(completedHw, 1), progressMax: 1 });
      achievements.push({ id: 'hw_5',      title: '5 заданий',    description: 'Выполнить 5 ДЗ',      earned: completedHw >= 5,  category: 'hw', hint: hwHint(5),  progressValue: Math.min(completedHw, 5),  progressMax: 5  });
      achievements.push({ id: 'hw_10',     title: '10 заданий',   description: 'Выполнить 10 ДЗ',     earned: completedHw >= 10, category: 'hw', hint: hwHint(10), progressValue: Math.min(completedHw, 10), progressMax: 10 });
      achievements.push({ id: 'hw_20',     title: '20 заданий',   description: 'Выполнить 20 ДЗ',     earned: completedHw >= 20, category: 'hw', hint: hwHint(20), progressValue: Math.min(completedHw, 20), progressMax: 20 });
      achievements.push({ id: 'hw_50',     title: '50 заданий',   description: 'Выполнить 50 ДЗ',     earned: completedHw >= 50, category: 'hw', hint: hwHint(50), progressValue: Math.min(completedHw, 50), progressMax: 50 });
      achievements.push({ id: 'speed_run', title: 'Быстрый темп', description: '3+ ДЗ за одну неделю',earned: bestWeekHw >= 3,   category: 'hw', hint: bestWeekHw < 3 ? `Лучшая неделя: ${bestWeekHw}/3` : undefined, progressValue: Math.min(bestWeekHw, 3), progressMax: 3 });

      // Серии ДЗ подряд (новые ачивки!)
      const hwRunMetric = Math.max(hwStreak, bestHwStreak);
      achievements.push({ id: 'hw_streak_3',  title: '3 ДЗ подряд',  description: '3 домашки без пропуска',  earned: hwRunMetric >= 3,  category: 'hw_streak', hint: hwRunMetric < 3  ? `Ещё ${3 - hwRunMetric} ДЗ`  : undefined, progressValue: Math.min(hwRunMetric, 3),  progressMax: 3  });
      achievements.push({ id: 'hw_streak_7',  title: '7 ДЗ подряд',  description: '7 домашек без пропуска',  earned: hwRunMetric >= 7,  category: 'hw_streak', hint: hwRunMetric < 7  ? `Ещё ${7 - hwRunMetric} ДЗ`  : undefined, progressValue: Math.min(hwRunMetric, 7),  progressMax: 7  });
      achievements.push({ id: 'hw_streak_15', title: '15 ДЗ подряд', description: '15 домашек без пропуска', earned: hwRunMetric >= 15, category: 'hw_streak', hint: hwRunMetric < 15 ? `Ещё ${15 - hwRunMetric} ДЗ` : undefined, progressValue: Math.min(hwRunMetric, 15), progressMax: 15 });

      // Категория: Уроки
      achievements.push({ id: 'first_lesson', title: 'Первый урок', description: 'Посетить первый урок', earned: lessonsCompleted >= 1,  category: 'lessons', hint: lsnHint(1),  progressValue: Math.min(lessonsCompleted, 1),  progressMax: 1  });
      achievements.push({ id: 'lessons_5',    title: '5 уроков',    description: 'Посетить 5 уроков',   earned: lessonsCompleted >= 5,  category: 'lessons', hint: lsnHint(5),  progressValue: Math.min(lessonsCompleted, 5),  progressMax: 5  });
      achievements.push({ id: 'lessons_10',   title: '10 уроков',   description: 'Посетить 10 уроков',  earned: lessonsCompleted >= 10, category: 'lessons', hint: lsnHint(10), progressValue: Math.min(lessonsCompleted, 10), progressMax: 10 });
      achievements.push({ id: 'lessons_25',   title: '25 уроков',   description: 'Посетить 25 уроков',  earned: lessonsCompleted >= 25, category: 'lessons', hint: lsnHint(25), progressValue: Math.min(lessonsCompleted, 25), progressMax: 25 });

      // Категория: Оценки
      achievements.push({ id: 'first_five',    title: 'Первая пятёрка', description: 'Получить оценку 5',   earned: allFives >= 1, category: 'grades', hint: allFives < 1 ? 'Получи пятёрку' : undefined, progressValue: Math.min(allFives, 1), progressMax: 1 });
      achievements.push({ id: 'three_fives',   title: 'Три пятёрки',    description: 'Получить 3 оценки 5', earned: allFives >= 3, category: 'grades', hint: allFives < 3 ? `Ещё ${3 - allFives} пятёрок` : undefined, progressValue: Math.min(allFives, 3), progressMax: 3 });
      achievements.push({ id: 'all_fives',     title: 'Отличник',       description: 'Получить 5 пятёрок', earned: allFives >= 5, category: 'grades', hint: allFives < 5 ? `Ещё ${5 - allFives} пятёрок` : undefined, progressValue: Math.min(allFives, 5), progressMax: 5 });
      achievements.push({ id: 'high_achiever', title: 'Высокий балл',   description: 'Средняя оценка 4.5+',earned: (avgGrade || 0) >= 4.5 && gradedHw.length >= 5, category: 'grades', hint: (avgGrade || 0) < 4.5 ? `Средняя: ${avgGrade ?? 0}/4.5` : gradedHw.length < 5 ? `Ещё ${5 - gradedHw.length} оценок` : undefined });

      // Категория: Стрик
      achievements.push({ id: 'streak_3',  title: '3 недели',  description: '3 недели без пропуска',  earned: streak >= 3,  category: 'streak', hint: strHint(3),  progressValue: Math.min(streak, 3),  progressMax: 3  });
      achievements.push({ id: 'streak_5',  title: '5 недель',  description: '5 недель без пропуска',  earned: streak >= 5,  category: 'streak', hint: strHint(5),  progressValue: Math.min(streak, 5),  progressMax: 5  });
      achievements.push({ id: 'streak_10', title: '10 недель', description: '10 недель без пропуска', earned: streak >= 10, category: 'streak', hint: strHint(10), progressValue: Math.min(streak, 10), progressMax: 10 });

      // Категория: Уровни
      achievements.push({ id: 'level_3', title: 'Уровень 3', description: 'Достичь 3-го уровня (400 XP)',  earned: xp >= 400,  category: 'level', hint: xpHint(400),  progressValue: Math.min(xp, 400),  progressMax: 400  });
      achievements.push({ id: 'level_5', title: 'Уровень 5', description: 'Достичь 5-го уровня (1200 XP)', earned: xp >= 1200, category: 'level', hint: xpHint(1200), progressValue: Math.min(xp, 1200), progressMax: 1200 });
      achievements.push({ id: 'level_6', title: 'Мастер',    description: 'Достичь максимального уровня',  earned: xp >= 2000, category: 'level', hint: xpHint(2000), progressValue: Math.min(xp, 2000), progressMax: 2000 });

      // Оценки за последние занятия
      const recentGrades = homework
        .filter(h => h.score != null)
        .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
        .slice(0, 5)
        .map(h => ({ title: h.title, score: h.score, date: h.createdAt }));

      // ─── Ближайшая награда (next milestone) ─────────────────────────────────
      const candidates = achievements
        .filter(a => !a.earned && a.progressMax && a.progressMax > 0)
        .map(a => ({ ...a, pct: ((a.progressValue || 0) / (a.progressMax || 1)) }))
        .sort((a, b) => b.pct - a.pct);
      const nextMilestone = candidates[0] ? {
        id: candidates[0].id,
        title: candidates[0].title,
        hint: candidates[0].hint,
        progressValue: candidates[0].progressValue,
        progressMax: candidates[0].progressMax,
        category: candidates[0].category,
      } : null;

      // ─── Персонализированная мотивация ──────────────────────────────────────
      // Выбираем тон и сообщение на основе контекста (не "одно на всех")
      const student = await storage.getStudent(studentId);
      const firstName = (student?.name || "").split(" ")[0] || "";
      let motivation: { greeting: string; message: string; tone: string; emoji: string };

      if (totalHw === 0 && lessonsCompleted === 0) {
        motivation = {
          greeting: firstName ? `Привет, ${firstName}!` : "Добро пожаловать!",
          message: "Здесь появится твой прогресс, бейджи и серии. Начни с первого урока — впереди целая история роста.",
          tone: "welcome", emoji: "🚀",
        };
      } else if (hwStreak >= 15) {
        motivation = {
          greeting: firstName ? `${firstName}, ты невероятный!` : "Невероятная серия!",
          message: `${hwStreak} домашек подряд — это вершина дисциплины. Такими темпами ЕГЭ/ОГЭ будут просто формальностью.`,
          tone: "legendary", emoji: "👑",
        };
      } else if (hwStreak >= 7) {
        motivation = {
          greeting: firstName ? `Огонь, ${firstName}!` : "В огне!",
          message: `${hwStreak} ДЗ подряд без единого пропуска. До бейджа «15 ДЗ подряд» осталось ${15 - hwStreak}.`,
          tone: "fire", emoji: "🔥",
        };
      } else if (hwStreak >= 3) {
        motivation = {
          greeting: firstName ? `Так держать, ${firstName}!` : "Так держать!",
          message: `${hwStreak} домашек подряд — ты строишь серию. Ещё ${Math.max(1, 7 - hwStreak)} ДЗ и откроется следующая награда.`,
          tone: "momentum", emoji: "⚡",
        };
      } else if (levelInfo.level >= 5) {
        motivation = {
          greeting: firstName ? `Эксперт ${firstName}` : "Эксперт",
          message: nextMilestone
            ? `Ты уже на ${levelInfo.level}-м уровне. Ближайшая цель: «${nextMilestone.title}»${nextMilestone.hint ? ` — ${nextMilestone.hint}` : ""}.`
            : `Ты уже на ${levelInfo.level}-м уровне. Продолжай в том же духе.`,
          tone: "expert", emoji: "💎",
        };
      } else if (submittedHw > 0) {
        motivation = {
          greeting: firstName ? `${firstName}, ты почти там` : "Почти там",
          message: `${submittedHw} ${submittedHw === 1 ? "задание ждёт" : "задания ждут"} проверки. А пока — возьми следующее, не теряй темпа.`,
          tone: "pending", emoji: "📝",
        };
      } else if (avgGrade && avgGrade >= 4.5) {
        motivation = {
          greeting: firstName ? `${firstName} — отличник` : "Отличник",
          message: `Средняя ${avgGrade.toFixed(1)} — это топ-уровень. ${nextMilestone ? `Осталось: «${nextMilestone.title}» — ${nextMilestone.hint || ""}` : ""}`.trim(),
          tone: "top", emoji: "⭐",
        };
      } else if (streak === 0 && totalHw > 0) {
        motivation = {
          greeting: firstName ? `${firstName}, пора вернуться` : "Пора вернуться",
          message: "Серия обнулилась, но каждая новая начинается с одной домашки. Сделай её сегодня — и запустим всё заново.",
          tone: "comeback", emoji: "🌱",
        };
      } else if (nextMilestone) {
        motivation = {
          greeting: firstName ? `Привет, ${firstName}` : "Привет",
          message: `Ближайшая награда — «${nextMilestone.title}». ${nextMilestone.hint || "Почти готово!"}`,
          tone: "progress", emoji: "🎯",
        };
      } else {
        motivation = {
          greeting: firstName ? `Рад видеть, ${firstName}` : "Рад видеть",
          message: "Продолжай в том же ритме — каждая выполненная задача приближает к цели.",
          tone: "default", emoji: "✨",
        };
      }

      res.json({
        studentId,
        totalHw,
        completedHw,
        submittedHw,
        completionPct,
        avgGrade,
        streak,
        hwStreak,
        bestHwStreak,
        weeklyStats,
        achievements,
        recentGrades,
        lessonsCompleted,
        levelInfo,
        weeklyGoal,
        xpBreakdown,
        nextMilestone,
        motivation,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== TASK BANK (student) =====
  // GET /api/student/variants - assigned variants
  app.get("/api/student/variants", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const variants = await storage.getStudentVariants(studentId);
      res.json(variants);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/student/variants/:id - variant with full tasks
  app.get("/api/student/variants/:id", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const assignment = await storage.getStudentVariantById(req.params.id as string, studentId);
      if (!assignment) return res.status(404).json({ error: "Вариант не найден" });
      const variant = assignment.variant;
      const tasks = await Promise.all((variant?.taskIds || []).map((tid: string) => storage.getTaskById(tid)));
      res.json({ ...assignment, tasks: tasks.filter(Boolean) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/student/tasks - browse task bank
  app.get("/api/student/tasks", requireStudentAuth, async (req, res) => {
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

  // GET /api/student/tasks/meta - filter meta
  app.get("/api/student/tasks/meta", requireStudentAuth, async (req, res) => {
    try {
      const meta = await storage.getTaskBankMeta();
      res.json(meta);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/student/tasks/:id - single task (with solution)
  app.get("/api/student/tasks/:id", requireStudentAuth, async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id as string);
      if (!task) return res.status(404).json({ error: "Задача не найдена" });
      res.json(task);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ======= STUDENT TELEGRAM =======

  // GET /api/student/telegram/status — bot status + student link info
  app.get("/api/student/telegram/status", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const student = await storage.getStudent(studentId);
      const botRunning = botManager.isRunning();
      const botUsername = botManager.getBotUsername();
      res.json({
        botRunning,
        botUsername: botUsername || null,
        telegramLinked: !!(student as any)?.telegramChatId,
        notificationsEnabled: (student as any)?.telegramNotificationsEnabled !== false,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/student/telegram/generate-code — generate a 6-digit link code for this student
  app.post("/api/student/telegram/generate-code", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      if (!botManager.isRunning()) {
        return res.status(400).json({ error: "Telegram бот не настроен" });
      }
      const code = await botManager.generateCode("student", studentId);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      res.json({ code, expiresAt, botUsername: botManager.getBotUsername() });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // PATCH /api/student/telegram/notifications — toggle notification setting
  app.patch("/api/student/telegram/notifications", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
      await storage.updateStudent(studentId, { telegramNotificationsEnabled: enabled } as any);
      res.json({ success: true, notificationsEnabled: enabled });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/student/payment/create - ученик сам создаёт платёж онлайн
  app.post("/api/student/payment/create", requireStudentAuth, async (req, res) => {
    try {
      const schema = z.object({
        amount: z.number().positive(),
        receiptEmail: z.string().email().optional(),
      });
      const { amount, receiptEmail } = schema.parse(req.body);
      const studentId = req.session.studentId!;

      if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
        return res.status(400).json({ error: "Онлайн-оплата недоступна. Обратитесь к репетитору." });
      }

      const student = await storage.getStudent(studentId);
      if (!student) return res.status(404).json({ error: "Ученик не найден" });

      // Сохраняем email для чека если указан
      if (receiptEmail && receiptEmail !== (student as any).receiptEmail) {
        await storage.updateStudent(studentId, { receiptEmail } as any);
      }

      const tutorId = student.tutorId;
      const yookassaInstance = new YooKassa({
        shopId: process.env.YOOKASSA_SHOP_ID,
        secretKey: process.env.YOOKASSA_SECRET_KEY,
      });

      const origin = appUrl();
      const idempotenceKey = randomUUID();

      // ВАЖНО: самозанятые освобождены от 54-ФЗ — блок receipt НЕ передаётся.
      // Чек выдаётся репетитором вручную через «Мой налог» после каждой оплаты.
      const paymentData: any = {
        amount: { value: amount.toFixed(2), currency: "RUB" },
        confirmation: {
          type: "redirect",
          return_url: `${origin}/student/finance?payment=success`,
        },
        description: `Оплата занятий — ${student.name}`,
        capture: true,
        metadata: { tutorId, studentId, type: "student_payment" },
      };

      const payment = await yookassaInstance.createPayment(paymentData, idempotenceKey);

      await storage.createPayment({
        tutorId,
        studentId,
        amount,
        method: "онлайн",
        comment: `Онлайн-оплата ученика`,
      } as any);

      // Сохраняем yookassaPaymentId через updatePayment
      const payments = await storage.getPaymentsByTutorId(tutorId);
      const last = [...payments].sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      if (last) {
        await storage.updatePayment(last.id, {
          yookassaPaymentId: payment.id,
          yookassaStatus: "pending",
          confirmationUrl: (payment.confirmation as any)?.confirmation_url,
        } as any);
      }

      res.json({ confirmationUrl: (payment.confirmation as any)?.confirmation_url });
    } catch (error: any) {
      console.error("Student payment create error:", error);
      res.status(500).json({ error: error.message || "Ошибка создания платежа" });
    }
  });

  // POST /api/student/board/ws-token — Student requests a short-lived WS auth token
  app.post("/api/student/board/ws-token", requireStudentAuth, async (req, res) => {
    try {
      const studentId = req.session.studentId!;
      const token = generateBoardWsToken(studentId, "student", studentId);
      res.json({ token, expiresIn: 45 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/student/help-chat — ИИ-помощник по функциям платформы
  app.post("/api/student/help-chat", requireStudentAuth, async (req, res) => {
    try {
      const { message, history = [] } = req.body;
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "Сообщение обязательно" });
      }

      const client = getOpenAIClient(openaiKey() || undefined);

      const systemPrompt = `Ты — дружелюбный помощник учебной платформы «Твой Вектор» для учеников. Помогаешь ученикам (школьникам) разобраться со всеми функциями кабинета. Отвечай кратко (2-4 предложения), понятно и дружелюбно. Используй эмодзи где уместно.

РАЗДЕЛЫ ПЛАТФОРМЫ:

🏠 ГЛАВНАЯ: карточка с уровнем XP и серией занятий (стриком), таймер до следующего урока с кнопкой входа в конференцию, статистика (средняя оценка, занятия, баланс, ДЗ), список активных домашних заданий. Кнопка «Обучение» — запускает интерактивный тур.

📅 ЗАНЯТИЯ (/student/lessons): список уроков с датой/временем/темой. Вкладки «Предстоящие» и «История». Кнопка «Войти» — вход в видеоконференцию (BigBlueButton). Оценки и посещаемость отображаются в истории.

📝 ДОМАШКА (/student/homework): список заданий со статусами «Новое»/«На проверке»/«Выполнено»/«Просрочено». Нажми на задание → прочитай условие → напиши ответ → нажми «Отправить на проверку». Можно прикрепить фото/файл. За выполненное ДЗ начисляется XP.

📊 ПРОГРЕСС (/student/progress): уровень XP (каждые 100 XP = новый уровень), уровни 1-6 (Ученик→Стажёр→Практик→Умелец→Профи→Мастер), серия (стрик — недели подряд без пропусков), медали-достижения. +10 XP за занятие, +5-10 XP за ДЗ.

💰 ФИНАНСЫ (/student/finance): текущий баланс (+ = уроки оплачены вперёд, − = долг), история платежей, сколько ещё уроков можно посетить.

🧪 ЗАДАЧНИК (/student/tasks): база заданий ЕГЭ/ОГЭ, фильтры по теме/сложности. «Мои варианты» — задания от репетитора.

💬 ЧАТ (/student/messages): переписка с репетитором, можно отправить фото/файл. Красный значок = непрочитанные сообщения.

🤖 ИИ-ПОМОЩНИК (/student/ai): объясняет темы, разбирает задачи, проверяет ответы, 24/7. Отличается от этого чата: тот — для учёбы, этот — для вопросов о платформе.

🎨 ДОСКА (/student/board): совместная рисовальная доска с репетитором в реальном времени, автосохранение.

📓 ЗАМЕТКИ (/student/notes): личные записи (только ты видишь), автосохранение.

📖 СПРАВКА (/student/help): гайды, FAQ, этот чат.

📱 TELEGRAM: кнопка «Telegram» в шапке → подключи → уведомления о занятиях/ДЗ/оценках.

НАВИГАЦИЯ: на компьютере — боковое меню слева; на телефоне — нижнее меню.

Если вопрос не о платформе — мягко скажи, что ты помогаешь только по функциям кабинета, и предложи спросить в ИИ-помощнике (/student/ai) для учебных вопросов. Всегда отвечай по-русски.`;

      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-8).map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message.trim() },
      ];

      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 400,
        temperature: 0.7,
      });

      res.json({ message: completion.choices[0].message.content ?? "Не удалось получить ответ." });
    } catch (error: any) {
      console.error("Help chat error:", error);
      res.status(500).json({ error: "ИИ временно недоступен. Попробуйте позже." });
    }
  });

  // ===== QUIZZES (тренажёры) =====
  app.get("/api/student/quizzes", requireStudentAuth, async (req, res) => {
    try {
      const studentId = (req.session as any).studentId as string;
      const list = await storage.getQuizzesAvailableToStudent(studentId);
      // Скрываем правильные ответы в листинге
      const safe = list.map(q => ({
        id: q.id, topic: q.topic, description: q.description,
        questionsCount: Array.isArray(q.questions) ? (q.questions as any[]).length : 0,
        createdAt: q.createdAt,
      }));
      res.json(safe);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/student/quizzes/:id", requireStudentAuth, async (req, res) => {
    try {
      const studentId = (req.session as any).studentId as string;
      const quiz = await storage.getQuiz(req.params.id as string);
      if (!quiz) return res.status(404).json({ error: "Не найдено" });
      // Проверяем доступ: либо назначен этому ученику, либо общий шаблон того же репетитора
      const list = await storage.getQuizzesAvailableToStudent(studentId);
      if (!list.some(q => q.id === quiz.id)) return res.status(403).json({ error: "Нет доступа" });
      // Возвращаем без correct и explanation
      const questions = (quiz.questions as any[]).map((q: any) => ({ q: q.q, options: q.options }));
      res.json({ id: quiz.id, topic: quiz.topic, description: quiz.description, questions });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/student/quizzes/:id/submit", requireStudentAuth, async (req, res) => {
    try {
      const studentId = (req.session as any).studentId as string;
      const quiz = await storage.getQuiz(req.params.id as string);
      if (!quiz) return res.status(404).json({ error: "Не найдено" });
      const list = await storage.getQuizzesAvailableToStudent(studentId);
      if (!list.some(q => q.id === quiz.id)) return res.status(403).json({ error: "Нет доступа" });

      const schema = z.object({ answers: z.array(z.number().int().min(-1)) });
      const { answers } = schema.parse(req.body);
      const qs = quiz.questions as any[];
      const detailed = qs.map((q: any, i: number) => {
        const chosen = answers[i] ?? -1;
        return { q: i, chosen, correct: chosen === q.correct };
      });
      const score = detailed.filter(d => d.correct).length;
      const attempt = await storage.createQuizAttempt({
        quizId: quiz.id,
        studentId,
        tutorId: quiz.tutorId,
        answers: detailed as any,
        score,
        total: qs.length,
        source: 'web',
        finishedAt: new Date(),
      } as any);
      // Возвращаем правильные ответы для разбора
      const review = qs.map((q: any, i: number) => ({
        q: q.q, options: q.options, correct: q.correct, chosen: detailed[i].chosen,
        explanation: q.explanation,
      }));
      res.json({ attempt, review, score, total: qs.length });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/student/quiz-attempts", requireStudentAuth, async (req, res) => {
    try {
      const studentId = (req.session as any).studentId as string;
      const list = await storage.getQuizAttemptsByStudent(studentId, 30);
      res.json(list);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== LESSON RECORDINGS (для ученика — только готовые) =====
  app.get("/api/student/recordings", requireStudentAuth, async (req, res) => {
    try {
      const studentId = (req.session as any).studentId as string;
      const list = await storage.getLessonRecordingsByStudent(studentId, 100);
      // не отдаём transcript в списке для экономии
      res.json(list.map(r => ({ ...r, transcript: undefined })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/student/recordings/:id", requireStudentAuth, async (req, res) => {
    try {
      const studentId = (req.session as any).studentId as string;
      const r = await storage.getLessonRecording(req.params.id as string);
      if (!r || r.studentId !== studentId || r.status !== 'ready') return res.status(404).json({ error: "Не найдено" });
      res.json(r);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
