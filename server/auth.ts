import bcrypt from "bcrypt";
import { type Tutor } from "@shared/schema";

const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

// Типы для сессии
declare module "express-session" {
  interface SessionData {
    tutorId?: string;
  }
}

// Middleware для проверки входа
export function requireAuth(req: any, res: any, next: any) {
  if (!req.session.tutorId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Middleware для проверки подтверждённого email
// Используется для критичных действий: ИИ, приглашения учеников, оплата.
export async function requireEmailVerified(req: any, res: any, next: any) {
  if (!req.session.tutorId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { storage } = await import("./storage");
    const tutor = await storage.getTutor(req.session.tutorId);
    if (!tutor) return res.status(401).json({ error: "Unauthorized" });
    if (!(tutor as any).emailVerified) {
      return res.status(403).json({
        error: "EMAIL_NOT_VERIFIED",
        message: "Подтвердите email перед использованием этой функции. Проверьте почту или запросите новое письмо в настройках профиля.",
      });
    }
    next();
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// Middleware для проверки админа
export async function requireAdmin(req: any, res: any, next: any) {
  if (!req.session.tutorId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { storage } = await import("./storage");
    const tutor = await storage.getTutor(req.session.tutorId);
    if (!tutor || !tutor.isAdmin) {
      return res.status(403).json({ error: "Доступ только для администратора" });
    }
    next();
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
