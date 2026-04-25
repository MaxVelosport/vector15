import { storage } from "./storage";
import { supabase } from "./supabase";
import nodemailer from "nodemailer";

const TABLE_PREFIX = "Tvoy_vector_2_";
const RUN_EVERY_MS = 15 * 60 * 1000;
const PARENT_REPORT_EVERY_MS = 60 * 60 * 1000; // hourly check
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const LESSON_REMIND_WINDOW_MS = 90 * 60 * 1000;
const HOMEWORK_REMIND_WINDOW_MS = 6 * 60 * 60 * 1000;
const DEDUP_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const CLEANUP_OLDER_THAN_MS = 7 * 24 * 60 * 60 * 1000;

let running = false;

function formatLessonTime(scheduledAt: string, now: Date): string {
  const dt = new Date(scheduledAt);
  const diffMs = dt.getTime() - now.getTime();
  const diffMin = Math.max(0, Math.round(diffMs / 60000));
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  if (diffMin < 60) return `сегодня в ${hh}:${mm} (через ${diffMin} мин)`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `сегодня в ${hh}:${mm} (через ${h} ч${m ? ` ${m} мин` : ""})`;
}

async function tickOnce() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const lessonHorizon = new Date(now.getTime() + LESSON_REMIND_WINDOW_MS);
    const homeworkHorizon = new Date(now.getTime() + HOMEWORK_REMIND_WINDOW_MS);
    const dedupSince = new Date(now.getTime() - DEDUP_LOOKBACK_MS);

    const safe = async <T,>(label: string, p: Promise<{ data: T | null; error: any }>): Promise<T[]> => {
      try {
        const { data, error } = await p;
        if (error) {
          console.warn(`[notif-scheduler] ${label} query failed:`, error.message);
          return [];
        }
        return (data as any) || [];
      } catch (e) {
        console.warn(`[notif-scheduler] ${label} threw:`, (e as Error).message);
        return [];
      }
    };

    const [lessons, homeworks, recent] = await Promise.all([
      safe<any>("lessons", supabase
        .from(`${TABLE_PREFIX}lessons`)
        .select("id, tutor_id, topic, scheduled_at, status")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", lessonHorizon.toISOString())
        .neq("status", "cancelled")
        .neq("status", "completed") as any),
      safe<any>("homework", supabase
        .from(`${TABLE_PREFIX}homework`)
        .select("id, tutor_id, title, deadline, status")
        .gte("deadline", now.toISOString())
        .lte("deadline", homeworkHorizon.toISOString())
        .neq("status", "completed")
        .neq("status", "graded") as any),
      safe<any>("notifications", supabase
        .from(`${TABLE_PREFIX}notifications`)
        .select("type, related_id")
        .gte("created_at", dedupSince.toISOString())
        .in("type", ["lesson_reminder", "homework_deadline"]) as any),
    ]);

    const seen = new Set<string>();
    for (const n of recent || []) {
      const rid = (n as any).related_id;
      if (rid) seen.add(`${(n as any).type}:${rid}`);
    }

    const inserts: any[] = [];

    for (const l of lessons || []) {
      const key = `lesson_reminder:${l.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      inserts.push({
        tutor_id: l.tutor_id,
        type: "lesson_reminder",
        title: "Напоминание об уроке",
        message: `${l.topic ? `«${l.topic}» — ` : ""}${formatLessonTime(l.scheduled_at, now)}`,
        related_id: l.id,
        is_read: false,
      });
    }

    for (const h of homeworks || []) {
      const key = `homework_deadline:${h.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const deadline = new Date(h.deadline);
      const hoursLeft = Math.max(1, Math.round((deadline.getTime() - now.getTime()) / 3600000));
      inserts.push({
        tutor_id: h.tutor_id,
        type: "homework_deadline",
        title: "Скоро дедлайн",
        message: `«${h.title || "Задание"}» — осталось ${hoursLeft} ч`,
        related_id: h.id,
        is_read: false,
      });
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from(`${TABLE_PREFIX}notifications`).insert(inserts);
      if (error) console.error("[notif-scheduler] insert failed:", error.message);
      else console.log(`[notif-scheduler] created ${inserts.length} notifications`);
    }

    // Background cleanup: drop read notifications older than 7 days to keep inbox tidy.
    try {
      const cutoff = new Date(now.getTime() - CLEANUP_OLDER_THAN_MS).toISOString();
      await supabase
        .from(`${TABLE_PREFIX}notifications`)
        .delete()
        .lt("created_at", cutoff)
        .eq("is_read", true);
    } catch (e) {
      console.warn("[notif-scheduler] cleanup failed:", (e as Error).message);
    }
  } catch (e) {
    console.error("[notif-scheduler] tick failed:", (e as Error).message);
  } finally {
    running = false;
  }
}

async function cleanupLegacyReminders() {
  // One-time cleanup of accumulated duplicate "Скоро занятие" / "Дедлайн домашки" reminders
  // from the previous wide-window scheduler. We keep only the most recent one per related_id.
  try {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}notifications`)
      .select("id, type, related_id, created_at")
      .in("type", ["lesson_reminder", "homework_deadline"])
      .order("created_at", { ascending: false });
    if (error || !data) return;
    const keep = new Set<string>();
    const toDelete: string[] = [];
    for (const n of data as any[]) {
      const key = `${n.type}:${n.related_id ?? "null"}`;
      if (keep.has(key)) toDelete.push(n.id);
      else keep.add(key);
    }
    if (toDelete.length === 0) return;
    const { error: delErr } = await supabase
      .from(`${TABLE_PREFIX}notifications`)
      .delete()
      .in("id", toDelete);
    if (delErr) console.warn("[notif-scheduler] legacy cleanup failed:", delErr.message);
    else console.log(`[notif-scheduler] cleaned up ${toDelete.length} duplicate reminders`);
  } catch (e) {
    console.warn("[notif-scheduler] legacy cleanup threw:", (e as Error).message);
  }
}

// ===== Parent reports (cron) =====

function isEmail(s: string | null | undefined): boolean {
  return !!s && /\S+@\S+\.\S+/.test(s);
}

function buildParentReportHtml(student: any, stats: any, recentLessons: any[], recentHomework: any[]): string {
  const dt = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const lessonsRows = recentLessons.length
    ? recentLessons.map(l => `<tr><td>${new Date(l.date).toLocaleDateString("ru-RU")}</td><td>${l.topic || "—"}</td><td style="text-align:center">${l.rating ? "★".repeat(l.rating) : "—"}</td></tr>`).join("")
    : `<tr><td colspan="3" style="color:#999;text-align:center">Пока нет занятий</td></tr>`;
  const hwRows = recentHomework.length
    ? recentHomework.map(h => `<tr><td>${h.title}</td><td>${h.status === "reviewed" ? "Проверено" : "В работе"}</td><td style="text-align:center">${h.score ?? "—"}</td></tr>`).join("")
    : `<tr><td colspan="3" style="color:#999;text-align:center">Пока нет домашних заданий</td></tr>`;
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;padding:24px 32px">
      <div style="font-size:11px;letter-spacing:.5px;opacity:.85">ТВОЙ ↗ ВЕКТОР</div>
      <h1 style="margin:8px 0 0;font-size:22px">Отчёт о занятиях — ${student.name}</h1>
      <div style="opacity:.85;margin-top:4px;font-size:13px">${dt} · ${student.subject || ""}${student.grade ? " · " + student.grade : ""}</div>
    </div>
    <div style="padding:24px 32px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        <div style="flex:1;min-width:140px;background:#f3f4f6;padding:12px 16px;border-radius:8px"><div style="font-size:11px;color:#6b7280;text-transform:uppercase">Занятий проведено</div><div style="font-size:24px;font-weight:700;color:#111">${stats.totalLessons}</div></div>
        <div style="flex:1;min-width:140px;background:#f3f4f6;padding:12px 16px;border-radius:8px"><div style="font-size:11px;color:#6b7280;text-transform:uppercase">ДЗ проверено</div><div style="font-size:24px;font-weight:700;color:#111">${stats.completedHomework}/${stats.totalHomework}</div></div>
        ${stats.avgScore != null ? `<div style="flex:1;min-width:140px;background:#f3f4f6;padding:12px 16px;border-radius:8px"><div style="font-size:11px;color:#6b7280;text-transform:uppercase">Средний балл</div><div style="font-size:24px;font-weight:700;color:#111">${stats.avgScore}</div></div>` : ""}
        ${stats.avgRating != null ? `<div style="flex:1;min-width:140px;background:#f3f4f6;padding:12px 16px;border-radius:8px"><div style="font-size:11px;color:#6b7280;text-transform:uppercase">Оценка занятий</div><div style="font-size:24px;font-weight:700;color:#111">${stats.avgRating} / 5</div></div>` : ""}
      </div>
      ${student.curriculumTopic ? `<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:10px 14px;border-radius:4px;margin-bottom:16px"><div style="font-size:11px;color:#6b7280;text-transform:uppercase">Текущая тема</div><div style="color:#1e3a8a;font-weight:500">${student.curriculumTopic}</div></div>` : ""}
      <h3 style="margin:20px 0 8px;font-size:14px;color:#374151">Последние занятия</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f9fafb"><th style="padding:8px;text-align:left;font-weight:600;color:#6b7280">Дата</th><th style="padding:8px;text-align:left;font-weight:600;color:#6b7280">Тема</th><th style="padding:8px;text-align:center;font-weight:600;color:#6b7280">Оценка</th></tr></thead><tbody>${lessonsRows}</tbody></table>
      <h3 style="margin:20px 0 8px;font-size:14px;color:#374151">Домашние задания</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f9fafb"><th style="padding:8px;text-align:left;font-weight:600;color:#6b7280">Задание</th><th style="padding:8px;text-align:left;font-weight:600;color:#6b7280">Статус</th><th style="padding:8px;text-align:center;font-weight:600;color:#6b7280">Балл</th></tr></thead><tbody>${hwRows}</tbody></table>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb">
      Этот отчёт сформирован автоматически платформой «Твой Вектор». Если у вас есть вопросы — свяжитесь напрямую с репетитором.
    </div>
  </div>`;
}

async function buildReportData(student: any) {
  const lessons = await storage.getLessonsByStudentId(student.id, 200);
  const homework = await storage.getHomeworkByStudentId(student.id, 100);
  const completedLessons = lessons.filter((l: any) => l.status === "completed" && l.attendance === "attended");
  const reviewedHw = homework.filter((h: any) => h.status === "reviewed" && h.score != null);
  const avgScore = reviewedHw.length > 0 ? Math.round(reviewedHw.reduce((s: number, h: any) => s + h.score, 0) / reviewedHw.length) : null;
  const ratedLessons = completedLessons.filter((l: any) => l.rating);
  const avgRating = ratedLessons.length > 0 ? (ratedLessons.reduce((s: number, l: any) => s + l.rating, 0) / ratedLessons.length).toFixed(1) : null;
  return {
    stats: {
      totalLessons: completedLessons.length,
      totalHomework: homework.length,
      completedHomework: homework.filter((h: any) => h.status === "reviewed").length,
      avgScore, avgRating,
    },
    recentLessons: completedLessons.slice(-5).map((l: any) => ({ date: l.scheduledAt, topic: l.topic, rating: l.rating })),
    recentHomework: homework.slice(-5).map((h: any) => ({ title: h.title, status: h.status, score: h.score })),
  };
}

let parentReportsRunning = false;

async function claimParentReportLease(studentId: string, prevSentAt: string | null): Promise<boolean> {
  // Atomic compare-and-set: only one ticker can flip the timestamp from prevSentAt → now.
  const nowIso = new Date().toISOString();
  let q = supabase.from(`${TABLE_PREFIX}students`)
    .update({ parent_report_last_sent_at: nowIso })
    .eq('id', studentId);
  q = prevSentAt === null ? q.is('parent_report_last_sent_at', null) : q.eq('parent_report_last_sent_at', prevSentAt);
  const { data, error } = await q.select('id');
  if (error) {
    console.warn(`[parent-reports] CAS failed for ${studentId}:`, error.message);
    return false;
  }
  return !!(data && data.length);
}

async function sendParentReports() {
  if (parentReportsRunning) return;
  parentReportsRunning = true;
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpHost || !smtpUser || !smtpPass) return;
    const students = await storage.getStudentsForParentReport();
    if (!students.length) return;
    const now = Date.now();
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || "465"),
      secure: (process.env.SMTP_PORT || "465") === "465",
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
    });
    let sent = 0;
    for (const s of students) {
      try {
        if (!isEmail(s.parentContact)) continue;
        const interval = s.parentReportSchedule === "weekly" ? WEEK_MS : MONTH_MS;
        const lastIso: string | null = s.parentReportLastSentAt || null;
        const last = lastIso ? new Date(lastIso).getTime() : 0;
        if (last && now - last < interval) continue;
        // Atomically claim the slot — if another worker already moved the timestamp, skip.
        const claimed = await claimParentReportLease(s.id, lastIso);
        if (!claimed) continue;
        const data = await buildReportData(s);
        const html = buildParentReportHtml(s, data.stats, data.recentLessons, data.recentHomework);
        await transporter.sendMail({
          from: process.env.SMTP_FROM || smtpUser,
          to: s.parentContact,
          subject: `Отчёт о занятиях — ${s.name} (${s.parentReportSchedule === "weekly" ? "неделя" : "месяц"})`,
          html,
        });
        sent++;
      } catch (e) {
        console.warn(`[parent-reports] failed for student ${s.id}:`, (e as Error).message);
        // Note: lease was already claimed; report is skipped this cycle but will retry on next interval.
      }
    }
    if (sent > 0) console.log(`[parent-reports] sent ${sent} report(s)`);
  } finally {
    parentReportsRunning = false;
  }
}

export function startNotificationScheduler() {
  setTimeout(() => {
    cleanupLegacyReminders().catch(() => null);
    tickOnce().catch(() => null);
    setInterval(() => tickOnce().catch(() => null), RUN_EVERY_MS);
  }, 30_000);
  setTimeout(() => {
    sendParentReports().catch((e) => console.warn("[parent-reports] tick failed:", e.message));
    setInterval(() => sendParentReports().catch(() => null), PARENT_REPORT_EVERY_MS);
  }, 60_000);
  console.log("✅ Notification scheduler started (lesson reminders every 15 min, parent reports hourly)");
}
