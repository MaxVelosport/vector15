import { createHmac } from "crypto";
import type { Lesson, Student, Tutor } from "@shared/schema";

const RAW_SECRET = process.env.SESSION_SECRET;
if (!RAW_SECRET || RAW_SECRET.length < 16) {
  throw new Error("SESSION_SECRET must be set (>=16 chars) for calendar token signing");
}
const SECRET: string = RAW_SECRET;

export function generateCalendarToken(tutorId: string): string {
  const payload = `cal:${tutorId}`;
  const hmac = createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function verifyCalendarToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const parts = raw.split(":");
    if (parts.length !== 3 || parts[0] !== "cal") return null;
    const tutorId = parts[1];
    const expected = createHmac("sha256", SECRET).update(`cal:${tutorId}`).digest("hex").slice(0, 32);
    if (parts[2] !== expected) return null;
    return tutorId;
  } catch {
    return null;
  }
}

function escapeICS(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function buildICalendar(tutor: Tutor, lessons: Lesson[], students: Student[]): string {
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const now = fmtDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tvoy Vector//Tutor Schedule//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Твой Вектор — ${escapeICS(tutor.name || "Расписание")}`,
    "X-WR-TIMEZONE:Europe/Moscow",
  ];

  for (const lesson of lessons) {
    if (lesson.status === "cancelled") continue;
    const start = new Date(lesson.scheduledAt);
    const end = new Date(start.getTime() + (lesson.durationMinutes || 60) * 60000);
    const student = studentMap.get(lesson.studentId);
    const title = student ? `${student.name} — ${student.subject || ""}` : "Занятие";
    const desc = [
      lesson.topic ? `Тема: ${lesson.topic}` : "",
      student?.goal ? `Цель: ${student.goal}` : "",
      lesson.notes ? `Заметки: ${lesson.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:lesson-${lesson.id}@tvoivector`,
      `DTSTAMP:${now}`,
      `DTSTART:${fmtDate(start)}`,
      `DTEND:${fmtDate(end)}`,
      `SUMMARY:${escapeICS(title)}`,
      desc ? `DESCRIPTION:${escapeICS(desc)}` : "DESCRIPTION:",
      `STATUS:${lesson.status === "completed" ? "CONFIRMED" : "TENTATIVE"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
