import rateLimit, { type Options, type RateLimitRequestHandler } from "express-rate-limit";
import type { Request, Response } from "express";

const isDev = process.env.NODE_ENV !== "production";

function makeKeyFromSession(req: Request): string {
  const sessionId = (req.session as any)?.id || "";
  const tutorId = (req.session as any)?.tutorId || "";
  const studentId = (req.session as any)?.studentId || "";
  const userId = tutorId || studentId || sessionId;
  const ip = (req.ip ?? req.socket?.remoteAddress ?? "unknown").replace(/^::ffff:/, "");
  return userId ? `${ip}_${userId}` : ip;
}

function makeKeyFromIp(req: Request): string {
  return (req.ip ?? req.socket?.remoteAddress ?? "unknown").replace(/^::ffff:/, "");
}

function rateLimitHandler(
  _req: Request,
  res: Response,
  _next: unknown,
  options: Options,
): void {
  res.status(options.statusCode ?? 429).json({
    error: (options.message as string) ?? "Слишком много запросов. Попробуйте позже.",
    retryAfter: Math.ceil((options.windowMs ?? 60000) / 1000),
  });
}

// ─── 1. Глобальный лимит — страховочная сетка для всех /api/* ────────────────
export const globalApiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 10_000 : 600,
  keyGenerator: makeKeyFromIp,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isDev,
  handler: rateLimitHandler,
  message: "Слишком много запросов. Подождите 15 минут.",
});

// ─── 2. Авторизация — строгий лимит ─────────────────────────────────────────
// Защита от brute-force атак на login/register/forgot-password
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 1_000 : 10,
  keyGenerator: makeKeyFromIp,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: "Слишком много попыток входа. Подождите 15 минут.",
  skipSuccessfulRequests: false,
});

// ─── 3. ИИ-эндпоинты — дорогие операции ─────────────────────────────────────
// GPT-4o, генерация заданий, планов, домашних работ
export const aiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 20,
  keyGenerator: makeKeyFromSession,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: "Слишком много запросов к ИИ. Подождите минуту.",
});

// ─── 4. Загрузка файлов ───────────────────────────────────────────────────────
export const uploadLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 20,
  keyGenerator: makeKeyFromSession,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: "Слишком много загрузок. Подождите минуту.",
});

// ─── 5. Запись данных (POST/PUT/PATCH/DELETE) ────────────────────────────────
// Умеренный лимит для мутирующих операций
export const writeLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 120,
  keyGenerator: makeKeyFromSession,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  handler: rateLimitHandler,
  message: "Слишком много запросов на запись. Подождите минуту.",
});

// ─── 6. Чтение данных (GET) ───────────────────────────────────────────────────
export const readLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 300,
  keyGenerator: makeKeyFromSession,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.method !== "GET",
  handler: rateLimitHandler,
  message: "Слишком много запросов. Подождите минуту.",
});

// ─── 7. Webhook-эндпоинты (Telegram, YooKassa) ───────────────────────────────
// Более мягкий лимит, но защита от флуда
export const webhookLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 200,
  keyGenerator: makeKeyFromIp,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: "Слишком много webhook-запросов.",
});

// ─── 8. Публичные эндпоинты (подписки, планы) ────────────────────────────────
export const publicLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 60,
  keyGenerator: makeKeyFromIp,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: "Слишком много запросов. Подождите минуту.",
});
