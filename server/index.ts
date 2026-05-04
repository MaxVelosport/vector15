import "./instrument";
import * as Sentry from "@sentry/node";

import { checkEnvironment } from "./check-env";
checkEnvironment();

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import multer from "multer";
import { randomUUID } from "crypto";
import { supabase } from "./supabase";
import { registerRoutes } from "./routes";
import { registerStudentRoutes } from "./student-routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDemoAccountIfNotExists, ensureStudentApplicationsTable, ensureStudentAuthColumns, ensurePromoCodesTable } from "./seed-demo-auto";
import { SupabaseSessionStore } from "./session-store";
import { botManager } from "./telegram-bot";
import {
  globalApiLimiter,
  authLimiter,
  aiLimiter,
  uploadLimiter,
  writeLimiter,
  readLimiter,
  webhookLimiter,
  publicLimiter,
} from "./rate-limit";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});
app.set("etag", false);

// trust proxy so express-rate-limit gets real client IP behind Replit reverse proxy
app.set("trust proxy", 1);

if (process.env.NODE_ENV === "production") {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
    throw new Error("SESSION_SECRET (≥16 символов) обязателен в production");
  }
} else if (!process.env.SESSION_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("[session] SESSION_SECRET не задан — используется dev-секрет. НЕ для продакшена.");
}

app.use(
  session({
    store: new SupabaseSessionStore(),
    secret: process.env.SESSION_SECRET || "dev-only-session-secret-do-not-use-in-production",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: "auto",
      sameSite: "lax",
    },
  }),
);

// ─── CSRF Protection (Origin/Referer check) ──────────────────────────
// Same-site cookies блокируют большинство атак, эта проверка - defense-in-depth.
// Webhook'и (ЮKassa, Telegram) приходят с других origin — они исключены.
const CSRF_EXEMPT_PATHS = [
  "/api/payments/webhook",
  "/api/payments/webhook-student",
  "/api/subscription/webhook",
  "/api/telegram",
];
app.use((req, res, next) => {
  const method = req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  if (!req.path.startsWith("/api")) return next();
  if (CSRF_EXEMPT_PATHS.some(p => req.path.startsWith(p))) return next();

  const origin = req.get("origin") || req.get("referer") || "";
  const host = req.get("host") || "";
  if (!origin) {
    // No origin/referer — could be legitimate API client; skip in dev
    if (process.env.NODE_ENV !== "production") return next();
    return res.status(403).json({ error: "Missing Origin/Referer" });
  }
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return res.status(403).json({ error: "Cross-origin request blocked" });
    }
  } catch {
    return res.status(403).json({ error: "Invalid Origin" });
  }
  next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// Applied after session middleware so session IDs are available for key generation.

// 1. Global safety net — all /api/* routes
app.use("/api", globalApiLimiter);

// 2. Auth endpoints — strict brute-force protection
app.use(
  [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
  ],
  authLimiter,
);

// 3. AI / expensive generation routes
app.use(
  [
    "/api/ai",
    "/api/help/chat",
  ],
  aiLimiter,
);
// generate-program is nested under /students/:id — apply separately
app.use("/api/students", (req, res, next) => {
  if (req.method === "POST" && req.path.endsWith("/generate-program")) {
    return aiLimiter(req, res, next);
  }
  next();
});

// 4. File uploads
app.use("/api/upload", uploadLimiter);

// 5. Webhook endpoints (Telegram, YooKassa) — relaxed, external systems
app.use(
  [
    "/api/payments/webhook",
    "/api/payments/webhook-student",
    "/api/subscription/webhook",
    "/api/telegram",
  ],
  webhookLimiter,
);

// 6. Public / unauthenticated endpoints
app.use(
  [
    "/api/public",
    "/api/subscription/prices",
  ],
  publicLimiter,
);

// 7. General write operations (POST / PUT / PATCH / DELETE) on all /api/*
app.use("/api", writeLimiter);

// 8. General read operations (GET) on all /api/*
app.use("/api", readLimiter);

// ─────────────────────────────────────────────────────────────────────────────

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  const SENSITIVE_LOG_PATHS = [
    "/api/calendar/url",
    "/api/auth/2fa",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/verify-email",
    "/api/auth/send-verification",
    "/api/parent/info",
    "/api/parent/messages",
    "/api/parent/payments",
    "/api/parent/payments.csv",
  ];
  const SENSITIVE_LOG_PATH_RE = [
    /^\/api\/students\/[^/]+\/parent-chat-link$/,
    /^\/api\/parent\/receipt\//,
  ];

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      const sensitive =
        SENSITIVE_LOG_PATHS.some((p) => path.startsWith(p)) ||
        SENSITIVE_LOG_PATH_RE.some((r) => r.test(path));
      if (capturedJsonResponse && !sensitive) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.post("/api/upload", upload.array("files", 10), async (req, res) => {
  if (!req.session.tutorId && !req.session.studentId) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "Нет файлов" });
  }
  try {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.originalname.includes(".")
        ? file.originalname.split(".").pop()!.toLowerCase()
        : "bin";
      const filename = `${randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("uploads")
        .upload(filename, file.buffer, { contentType: file.mimetype, upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("uploads").getPublicUrl(filename);
      urls.push(data.publicUrl);
    }
    res.json({ urls });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

(async () => {
  // Миграция для новой фичи — выполняется всегда, даже при SKIP_DEMO_SEED=true
  try { await ensureStudentApplicationsTable(); } catch (e) { console.error("[migrate] student_applications:", e); }
  try { await ensureStudentAuthColumns(); } catch (e) { console.error("[migrate] student_auth:", e); }
  try { await ensurePromoCodesTable(); } catch (e) { console.error("[migrate] promo_codes:", e); }

  await seedDemoAccountIfNotExists();
  registerStudentRoutes(app);
  await registerRoutes(httpServer, app);

  // Автосоздание BBB комнат для всех учеников (не блокирует запуск)
  import("./bbb").then(({ ensureConferencesForAllTutors }) => {
    ensureConferencesForAllTutors().catch((e) => console.error("[BBB] ensureConferences failed:", e?.message || e));
  });

  botManager.init().catch(() => {});
  botManager.startReminderCron();

  const { startNotificationScheduler } = await import("./notification-scheduler");
  startNotificationScheduler();

  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  const { installErrorMonitor } = await import("./error-monitor");
  installErrorMonitor(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
