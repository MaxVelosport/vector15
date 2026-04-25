import OpenAI, { toFile } from "openai";
import fs from "fs/promises";
import path from "path";
import { storage } from "./storage";
import { openaiKey } from "./builtin-config";
import { getBbbRecordings } from "./bbb";

const RECORDINGS_DIR = path.join(process.cwd(), ".local", "recordings");

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: openaiKey() });
  return _client;
}

export async function ensureRecordingsDir(): Promise<string> {
  await fs.mkdir(RECORDINGS_DIR, { recursive: true });
  return RECORDINGS_DIR;
}

export async function saveAudioBuffer(recordingId: string, buf: Buffer, ext = "mp3"): Promise<string> {
  await ensureRecordingsDir();
  const safeExt = (ext.replace(/[^a-z0-9]/gi, "") || "mp3").toLowerCase();
  const filePath = path.join(RECORDINGS_DIR, `${recordingId}.${safeExt}`);
  await fs.writeFile(filePath, buf);
  return filePath;
}

/**
 * Запускает фоновый пайплайн: транскрипция → саммари/конспект → уведомление.
 * Не бросает наружу — все ошибки записываются в lesson_recordings.error_message.
 */
export function startTranscriptionJob(recordingId: string): void {
  // fire-and-forget
  void runPipeline(recordingId).catch((e) => {
    console.error("[recordings] pipeline error:", e);
    storage.updateLessonRecording(recordingId, {
      status: "failed",
      errorMessage: e?.message?.slice(0, 500) || "Неизвестная ошибка",
    } as any).catch(() => null);
  });
}

// Простой in-process лок против повторного запуска одного и того же recordingId
const _runningJobs = new Set<string>();

async function runPipeline(recordingId: string): Promise<void> {
  if (_runningJobs.has(recordingId)) {
    console.log(`[recordings] pipeline уже выполняется для ${recordingId} — пропускаем`);
    return;
  }
  _runningJobs.add(recordingId);
  try {
    const rec = await storage.getLessonRecording(recordingId);
    if (!rec) throw new Error("Запись не найдена");
    if (!rec.audioPath) throw new Error("Нет аудио для расшифровки");
    if (rec.status === "ready") {
      console.log(`[recordings] ${recordingId} уже готова — пропускаем`);
      return;
    }

    // 1. Whisper
    await storage.updateLessonRecording(recordingId, { status: "transcribing" } as any);
    const fileBuf = await fs.readFile(rec.audioPath);
    const fileName = path.basename(rec.audioPath);
    const ai = client();
    const tr = await ai.audio.transcriptions.create({
      file: await toFile(fileBuf, fileName),
      model: "whisper-1",
      language: "ru",
      response_format: "verbose_json",
    } as any);
    const transcript: string = (tr as any).text || "";
    const durationSec: number = Math.round(((tr as any).duration as number) || 0) || null as any;
    if (!transcript.trim()) throw new Error("Пустая расшифровка");

    // 2. Summary + structured notes
    await storage.updateLessonRecording(recordingId, {
      status: "summarizing",
      transcript,
      durationSec: durationSec || undefined,
    } as any);

    const prompt = `Ты — опытный методист и репетитор. Тебе дана дословная расшифровка видеоурока (на русском языке).
Создай краткое summary и структурированный конспект для ученика.

ВЕРНИ СТРОГО JSON по схеме (без markdown, без комментариев):
{
  "summary": "2-4 предложения, что произошло на уроке простыми словами",
  "keyPoints": ["3-7 ключевых тезисов урока"],
  "terms": [{"term": "термин", "def": "краткое определение"}],
  "homework": "если упоминается ДЗ — кратко перечисли, иначе пустая строка",
  "fullNotes": "развёрнутый конспект в формате Markdown с заголовками ##, списками и **жирным** для ключевых понятий. 200-600 слов."
}

Расшифровка урока:
"""
${transcript.slice(0, 14000)}
"""`;

    const completion = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const summary: string = String(parsed.summary || "").slice(0, 2000);
    const notes = {
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 12).map((s: any) => String(s).slice(0, 400)) : [],
      terms: Array.isArray(parsed.terms) ? parsed.terms.slice(0, 20).map((t: any) => ({ term: String(t?.term || "").slice(0, 200), def: String(t?.def || "").slice(0, 600) })).filter((t: any) => t.term && t.def) : [],
      homework: String(parsed.homework || "").slice(0, 1000),
      fullNotes: String(parsed.fullNotes || "").slice(0, 12000),
    };

    await storage.updateLessonRecording(recordingId, {
      status: "ready",
      summary,
      notes: notes as any,
      errorMessage: null as any,
    } as any);

    // 3. Notify via Telegram
    try {
      const { botManager } = await import("./telegram-bot");
      const updated = await storage.getLessonRecording(recordingId);
      if (!updated) return;
      const previewLines = [
        `📝 <b>Конспект урока готов</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        `📚 <b>${escapeHtml(updated.title)}</b>`,
        ``,
        `${escapeHtml(updated.summary || "")}`,
      ];
      if (notes.keyPoints.length) {
        previewLines.push(``, `<b>Ключевые моменты:</b>`);
        for (const k of notes.keyPoints.slice(0, 5)) previewLines.push(`• ${escapeHtml(k)}`);
      }
      if (notes.homework) previewLines.push(``, `📌 <b>Что задано:</b> ${escapeHtml(notes.homework)}`);
      const text = previewLines.join("\n");

      const baseUrl = publicAppUrl();
      if (updated.studentId) {
        const studentLink = baseUrl ? `\n\n📖 <a href="${baseUrl}/student/recording/${updated.id}">Открыть полный конспект</a>` : "";
        await botManager.sendToStudent(updated.studentId, text + studentLink).catch(() => null);
      }
      const tutorLink = baseUrl ? `\n\n📖 <a href="${baseUrl}/recording/${updated.id}">Открыть конспект</a>` : "";
      await botManager.sendToTutor(updated.tutorId, text + `\n\n👨‍🏫 <i>Также отправлено ученику</i>` + tutorLink).catch(() => null);
    } catch (e) {
      console.error("[recordings] notify error:", e);
    }
  } finally {
    _runningJobs.delete(recordingId);
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function publicAppUrl(): string {
  const env = process.env.PUBLIC_APP_URL || process.env.APP_URL;
  if (env) return env.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "";
}

/**
 * Подтягивает новые BBB-записи и регистрирует их в нашей БД (без транскрипции —
 * она требует загруженного аудио, которое пользователь добавляет вручную или скриптом).
 */
export async function syncBbbRecordingsForTutor(tutorId: string): Promise<number> {
  const confs = await storage.getConferencesByTutorId(tutorId);
  let added = 0;
  for (const c of confs) {
    try {
      const recs = await getBbbRecordings(c.meetingId);
      for (const r of recs) {
        const exists = await storage.getLessonRecordingByBbbRecordId(r.recordId);
        if (exists) continue;
        await storage.createLessonRecording({
          tutorId,
          studentId: c.studentId || null,
          conferenceId: c.id,
          title: `${c.title} — ${new Date(r.startTime).toLocaleString("ru-RU")}`,
          source: "bbb",
          meetingId: c.meetingId,
          bbbRecordId: r.recordId,
          playbackUrl: r.playbackUrl || null,
          durationSec: r.endTime && r.startTime ? Math.max(0, Math.round((r.endTime - r.startTime) / 1000)) : null,
          recordedAt: new Date(r.startTime) as any,
          status: "pending",
        } as any);
        added++;
      }
    } catch (_e) { /* skip */ }
  }
  return added;
}
