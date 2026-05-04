import type { Express, Request, Response, NextFunction } from "express";
import { logger } from "./logger";

interface CapturedError {
  id: string;
  ts: string;
  method: string;
  path: string;
  status: number;
  message: string;
  stack?: string;
  tutorId?: string;
}

const MAX_BUFFER = 200;
const buffer: CapturedError[] = [];

function push(e: CapturedError) {
  buffer.unshift(e);
  if (buffer.length > MAX_BUFFER) buffer.length = MAX_BUFFER;
  logger.error({ method: e.method, url: e.path, statusCode: e.status, tutorId: e.tutorId }, `[error-monitor] ${e.method} ${e.path} ${e.status}: ${e.message}`);
}

export function captureError(err: Error, context: { req?: Request; status?: number } = {}) {
  const req = context.req;
  push({
    id: Math.random().toString(36).slice(2, 10),
    ts: new Date().toISOString(),
    method: req?.method ?? "BG",
    path: req?.path ?? "(background)",
    status: context.status ?? 500,
    message: err.message || String(err),
    stack: err.stack,
    tutorId: (req?.session as any)?.tutorId,
  });
}

export function installErrorMonitor(app: Express) {
  // Финальный обработчик: ловим любые проброшенные ошибки в роутах
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = typeof err?.status === "number" ? err.status : 500;
    captureError(err instanceof Error ? err : new Error(String(err)), { req, status });
    if (!res.headersSent) {
      res.status(status).json({ error: "Внутренняя ошибка сервера" });
    }
  });

  // Глобальные ловушки
  process.on("unhandledRejection", (reason) => {
    const e = reason instanceof Error ? reason : new Error(String(reason));
    captureError(e, { status: 0 });
  });
  process.on("uncaughtException", (err) => {
    captureError(err, { status: 0 });
  });

  // Эндпоинт для админа: посмотреть последние ошибки
  app.get("/api/admin/errors", (req: any, res) => {
    if (!req.session?.tutorId) return res.status(401).json({ error: "Unauthorized" });
    res.json({
      total: buffer.length,
      errors: buffer.slice(0, 50),
    });
  });
}

export function getRecentErrors() {
  return [...buffer];
}
