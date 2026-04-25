import { createHmac } from "crypto";

// Секрет для подписи токенов доступа учеников. В продакшене обязателен —
// иначе любой, кто знает дефолт, сможет подделать токен и зайти в чужой кабинет.
function resolveSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[hmac-tokens] SESSION_SECRET обязателен в production (минимум 16 символов). " +
      "Задайте его через переменные окружения / Replit Secrets."
    );
  }
  // Только для локальной разработки — выводим явное предупреждение в консоль.
  // eslint-disable-next-line no-console
  console.warn("[hmac-tokens] SESSION_SECRET не задан — используется dev-секрет. НЕ для продакшена.");
  return "dev-only-hmac-secret-do-not-use-in-production";
}

const SECRET = resolveSecret();
const EXPIRY_DAYS = 90;

export interface DecodedToken {
  studentId: string;
  expiry: number;
  id: string;
}

export function generateStudentToken(studentId: string): string {
  const expiry = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${studentId}:${expiry}`;
  const hmac = createHmac("sha256", SECRET).update(payload).digest("hex");
  const raw = `${payload}:${hmac}`;
  return Buffer.from(raw).toString("base64url");
}

export function verifyStudentToken(token: string): DecodedToken | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    // Reject parent-chat-scoped tokens for student-portal flows
    if (raw.startsWith("pc:")) return null;
    const parts = raw.split(":");
    if (parts.length < 3) return null;

    const hmacPart = parts[parts.length - 1];
    const payload = parts.slice(0, parts.length - 1).join(":");
    const expectedHmac = createHmac("sha256", SECRET).update(payload).digest("hex");

    if (hmacPart !== expectedHmac) return null;

    const payloadParts = payload.split(":");
    if (payloadParts.length < 2) return null;

    const expiry = parseInt(payloadParts[payloadParts.length - 1]);
    const studentId = payloadParts.slice(0, payloadParts.length - 1).join(":");

    if (Date.now() > expiry) return null;

    const id = `hmac-${studentId}-${expiry}`;
    return { studentId, expiry, id };
  } catch {
    return null;
  }
}

// ─── Parent chat tokens (scoped: cannot be used for student-portal auth) ────
export function generateParentChatToken(studentId: string): string {
  const expiry = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const payload = `pc:${studentId}:${expiry}`;
  const hmac = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function verifyParentChatToken(token: string): DecodedToken | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    if (!raw.startsWith("pc:")) return null;
    const parts = raw.split(":");
    // pc:<studentId>:<expiry>:<hmac>
    if (parts.length < 4) return null;

    const hmacPart = parts[parts.length - 1];
    const payload = parts.slice(0, parts.length - 1).join(":");
    const expectedHmac = createHmac("sha256", SECRET).update(payload).digest("hex");
    if (hmacPart !== expectedHmac) return null;

    const expiry = parseInt(parts[parts.length - 2]);
    const studentId = parts.slice(1, parts.length - 2).join(":");
    if (!studentId || !Number.isFinite(expiry)) return null;
    if (Date.now() > expiry) return null;

    return { studentId, expiry, id: `pc-${studentId}-${expiry}` };
  } catch {
    return null;
  }
}
