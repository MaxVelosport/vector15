import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import { createHash, randomUUID } from "crypto";
import { storage } from "./storage";
import { supabase } from "./supabase";
import type { Tutor, Student } from "@shared/schema";
import { openaiKey, appUrl, BUILTIN_TELEGRAM_TOKEN } from "./builtin-config";

const isProd = () => process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production";

function getOpenAI() {
  return new OpenAI({ apiKey: openaiKey() });
}

// ========================
// SINGLE PLATFORM BOT
// ========================

type LinkCode = {
  type: "tutor" | "student";
  id: string;
  expiresAt: number;
};

class PlatformBotManager {
  private bot: TelegramBot | null = null;
  private botUsername = "";
  private remindersSent = new Set<string>();
  private startedAt = 0; // epoch ms — ignore messages older than this

  // Distributed lock: only one running instance (dev OR prod) handles messages
  private instanceId = "";
  private instanceValid = true; // cached validity flag
  private instanceCheckTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly INSTANCE_KEY = "telegram_bot_instance_id";

  // ── In-memory user identity cache (30s TTL) ───────────────────────────────
  private userCache = new Map<string, { type: "tutor"; data: Tutor; exp: number }
    | { type: "student"; data: Student; exp: number }
    | { type: "none"; exp: number }>();
  private static readonly CACHE_TTL = 30_000;

  private async getCachedUser(chatId: string): Promise<{ tutor: Tutor | null; student: Student | null }> {
    const cached = this.userCache.get(chatId);
    if (cached && cached.exp > Date.now()) {
      if (cached.type === "tutor") return { tutor: cached.data, student: null };
      if (cached.type === "student") return { tutor: null, student: cached.data };
      return { tutor: null, student: null };
    }
    const tutor = await storage.getTutorByTelegramChatId(chatId);
    if (tutor) {
      this.userCache.set(chatId, { type: "tutor", data: tutor, exp: Date.now() + PlatformBotManager.CACHE_TTL });
      return { tutor, student: null };
    }
    const student = await storage.getStudentByTelegramChatId(chatId);
    if (student) {
      this.userCache.set(chatId, { type: "student", data: student, exp: Date.now() + PlatformBotManager.CACHE_TTL });
      // Pre-warm data cache in background so first button press is fast
      Promise.all([
        this.dc_studentLessons(student.id),
        this.dc_studentHomework(student.id),
        this.dc_studentPayments(student.id),
        this.dc_tutor(student.tutorId),
      ]).catch(() => {});
      return { tutor: null, student };
    }
    this.userCache.set(chatId, { type: "none", exp: Date.now() + PlatformBotManager.CACHE_TTL });
    return { tutor: null, student: null };
  }

  private invalidateCache(chatId: string) { this.userCache.delete(chatId); }

  // ── In-memory DATA cache (5 min TTL) ─────────────────────────────────────
  private dataCache = new Map<string, { data: any; exp: number }>();
  private static readonly DATA_TTL = 300_000;

  private dcGet<T>(key: string): T | null {
    const c = this.dataCache.get(key);
    return (c && c.exp > Date.now()) ? c.data as T : null;
  }
  private dcSet(key: string, data: any) {
    this.dataCache.set(key, { data, exp: Date.now() + PlatformBotManager.DATA_TTL });
  }
  private dcDel(...prefixes: string[]) {
    for (const k of Array.from(this.dataCache.keys()))
      if (prefixes.some(p => k.startsWith(p))) this.dataCache.delete(k);
  }

  private async dc_tutorLessons(tutorId: string) {
    const k = `tl:${tutorId}`;
    return this.dcGet<any[]>(k) ?? (() => { const p = storage.getLessonsByTutorId(tutorId); p.then(d => this.dcSet(k, d)); return p; })();
  }
  private async dc_tutorStudents(tutorId: string) {
    const k = `ts:${tutorId}`;
    return this.dcGet<any[]>(k) ?? (() => { const p = storage.getStudentsByTutorId(tutorId); p.then(d => this.dcSet(k, d)); return p; })();
  }
  private async dc_tutorHomework(tutorId: string) {
    const k = `th:${tutorId}`;
    return this.dcGet<any[]>(k) ?? (() => { const p = storage.getHomeworkByTutorId(tutorId); p.then(d => this.dcSet(k, d)); return p; })();
  }
  private async dc_studentLessons(studentId: string) {
    const k = `sl:${studentId}`;
    return this.dcGet<any[]>(k) ?? (() => { const p = storage.getLessonsByStudentId(studentId); p.then(d => this.dcSet(k, d)); return p; })();
  }
  private async dc_studentHomework(studentId: string) {
    const k = `sh:${studentId}`;
    return this.dcGet<any[]>(k) ?? (() => { const p = storage.getHomeworkByStudentId(studentId); p.then(d => this.dcSet(k, d)); return p; })();
  }
  private async dc_tutor(tutorId: string) {
    const k = `t:${tutorId}`;
    return this.dcGet<any>(k) ?? (() => { const p = storage.getTutor(tutorId); p.then(d => this.dcSet(k, d)); return p; })();
  }
  private async dc_studentPayments(studentId: string) {
    const k = `sp:${studentId}`;
    return this.dcGet<any[]>(k) ?? (() => { const p = (storage as any).getPaymentsByStudentId?.(studentId) ?? Promise.resolve([]); p.then((d: any) => this.dcSet(k, d)); return p; })();
  }
  private async dc_tutorPayments(tutorId: string) {
    const k = `tp:${tutorId}`;
    return this.dcGet<any[]>(k) ?? (() => { const p = storage.getPaymentsByTutorId(tutorId); p.then(d => this.dcSet(k, d)); return p; })();
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ========================
  // LINK CODES  (stored in DB so all instances share them)
  // ========================
  private static readonly CODE_PREFIX = "tg_lc_";

  async generateCode(type: "tutor" | "student", id: string): Promise<string> {
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 min TTL

    // Generate unique 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const payload: LinkCode = { type, id, expiresAt };
    await storage.setAiSetting(`${PlatformBotManager.CODE_PREFIX}${code}`, JSON.stringify(payload));
    return code;
  }

  private async consumeCode(code: string): Promise<LinkCode | null> {
    try {
      const raw = await storage.getAiSetting(`${PlatformBotManager.CODE_PREFIX}${code}`);
      if (!raw) return null;
      const data: LinkCode = JSON.parse(raw);
      if (data.expiresAt < Date.now()) {
        // Expired — clean up
        await storage.setAiSetting(`${PlatformBotManager.CODE_PREFIX}${code}`, "").catch(() => {});
        return null;
      }
      // Consume: delete from DB
      await storage.setAiSetting(`${PlatformBotManager.CODE_PREFIX}${code}`, "").catch(() => {});
      return data;
    } catch {
      return null;
    }
  }

  // ========================
  // LIFECYCLE
  // ========================

  async init() {
    const token = process.env.TELEGRAM_BOT_TOKEN
      || await storage.getAiSetting("telegram_bot_token")
      || BUILTIN_TELEGRAM_TOKEN;
    if (token) {
      await this.start(token).catch(() => {});
    }
  }

  async start(token: string) {
    await this.stop();
    try {
      this.startedAt = Date.now();

      const useWebhook = isProd();
      const envTag = useWebhook ? "prod" : "dev";
      this.instanceId = `${this.startedAt}_${Math.random().toString(36).slice(2, 8)}_${envTag}`;
      this.instanceValid = true;

      if (useWebhook) {
        // ── WEBHOOK MODE (production / autoscale) ──────────────────────
        // Telegram delivers each update via HTTP POST to our endpoint.
        // No polling → no 409 conflicts when multiple autoscale instances run.
        this.bot = new TelegramBot(token, { polling: false });
        const me = await this.bot.getMe();
        this.botUsername = me.username || "";
        this.registerHandlers();

        const webhookUrl = `${appUrl()}/api/telegram/webhook`;
        const secret = this.getWebhookSecret(token);
        try {
          await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: webhookUrl,
              secret_token: secret,
              drop_pending_updates: true,
              allowed_updates: ["message", "callback_query"],
              max_connections: 40,
            }),
          });
        } catch (e) {
          console.error("⚠️ setWebhook failed:", (e as any)?.message);
        }

        await this.setGlobalCommands();
        console.log(`✅ Telegram bot @${this.botUsername} started [WEBHOOK → ${webhookUrl}]`);
      } else {
        // ── POLLING MODE (development) ─────────────────────────────────
        // Distributed lock so two dev instances don't double-poll.
        try { await storage.setAiSetting(PlatformBotManager.INSTANCE_KEY, this.instanceId); } catch {}
        if (this.instanceCheckTimer) clearInterval(this.instanceCheckTimer);
        this.instanceCheckTimer = setInterval(async () => {
          try {
            const current = await storage.getAiSetting(PlatformBotManager.INSTANCE_KEY);
            const weAreProd = this.instanceId.endsWith("_prod");
            if (current && current !== this.instanceId) {
              const currentIsProd = current.endsWith("_prod");
              if (currentIsProd && !weAreProd) {
                this.instanceValid = false;
                return;
              }
            }
            await storage.setAiSetting(PlatformBotManager.INSTANCE_KEY, this.instanceId);
            this.instanceValid = true;
          } catch {}
        }, 10000);

        // Drop pending updates and any leftover webhook before polling.
        try {
          await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
        } catch {}

        this.bot = new TelegramBot(token, { polling: true });
        const me = await this.bot.getMe();
        this.botUsername = me.username || "";
        this.registerHandlers();
        await this.setGlobalCommands();
        console.log(`✅ Telegram bot @${this.botUsername} started [POLLING, instance: ${this.instanceId}]`);
      }
    } catch (e: any) {
      this.bot = null;
      console.error("❌ Failed to start Telegram bot:", e.message);
      throw e;
    }
  }

  async stop() {
    if (this.instanceCheckTimer) { clearInterval(this.instanceCheckTimer); this.instanceCheckTimer = null; }
    if (this.bot) {
      await this.bot.stopPolling().catch(() => {});
      this.bot = null;
      this.botUsername = "";
    }
  }

  // ── Webhook helpers ──────────────────────────────────────────────────────
  // Stable, secret derived from bot token. Telegram echoes this in the
  // X-Telegram-Bot-Api-Secret-Token header on every webhook delivery so we
  // can verify the request actually came from Telegram.
  getWebhookSecret(token?: string): string {
    const t = token || BUILTIN_TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
    return createHash("sha256").update(`tg-webhook::${t}`).digest("hex").slice(0, 48);
  }

  // Called by the Express webhook endpoint with the parsed update body.
  processUpdate(update: any): void {
    if (!this.bot) return;
    try { this.bot.processUpdate(update); } catch (e) {
      console.error("processUpdate error:", (e as any)?.message);
    }
  }

  // Default global command menu shown to anyone before they link.
  // Per-role menus are set in setMenuForRole() once a user is linked.
  private async setGlobalCommands() {
    if (!this.bot) return;
    await this.bot.setMyCommands([
      { command: "start",    description: "🚀 Подключить аккаунт" },
      { command: "menu",     description: "📋 Главное меню" },
      { command: "help",     description: "❓ Что умеет бот" },
      { command: "ask",      description: "🤖 ИИ-ассистент" },
      { command: "unlink",   description: "🔓 Отключить Telegram" },
    ]).catch(() => {});
  }

  isRunning(): boolean {
    return this.bot !== null;
  }

  getBotUsername(): string {
    return this.botUsername;
  }

  getBotLink(payload?: string) {
    if (!this.botUsername) return null;
    return payload ? `https://t.me/${this.botUsername}?start=${payload}` : `https://t.me/${this.botUsername}`;
  }

  getTutorLink(tutorId: string) { return this.getBotLink(`t_${tutorId}`); }
  getStudentLink(studentId: string) { return this.getBotLink(`s_${studentId}`); }

  // ========================
  // SEND NOTIFICATIONS
  // ========================

  async sendToTutor(tutorId: string, text: string) {
    if (!this.bot) return;
    try {
      const tutor = await storage.getTutor(tutorId);
      if (!tutor?.tutorChatId) return;
      await this.bot.sendMessage(tutor.tutorChatId, text, { parse_mode: "HTML" });
    } catch {}
  }

  async sendToStudent(studentId: string, text: string) {
    if (!this.bot) return;
    try {
      const student = await storage.getStudent(studentId);
      if (!student?.telegramChatId) return;
      await this.bot.sendMessage(student.telegramChatId, text, { parse_mode: "HTML" });
    } catch {}
  }

  // Отправить по прямому chat_id — для админ-алертов, не использует БД
  public async sendToChatId(
    chatId: number | string,
    text: string,
    options?: TelegramBot.SendMessageOptions
  ): Promise<boolean> {
    if (!this.bot) {
      console.warn('[telegram-bot] sendToChatId: бот не инициализирован');
      return false;
    }
    try {
      await this.bot.sendMessage(chatId, text, options);
      return true;
    } catch (err: any) {
      console.error('[telegram-bot] sendToChatId failed:', err?.message || err);
      return false;
    }
  }

  // ========================
  // MESSAGE HANDLERS
  // ========================

  private registerHandlers() {
    if (!this.bot) return;

    this.bot.on("message", async (msg) => {
      const chatId = String(msg.chat.id);
      let text = (msg.text || "").trim();

      // Skip if another (newer) instance has taken over
      if (!this.instanceValid) return;

      // Skip messages that arrived before this bot instance started
      // (prevents re-processing queued messages after restart)
      const msgEpochMs = (msg.date || 0) * 1000;
      if (msgEpochMs < this.startedAt - 3000) return;

      // ── ФОТО / ДОКУМЕНТЫ для сдачи ДЗ ───────────────────────────────
      // Если ученик в режиме hw_submit и присылает фото / PDF / документ —
      // скачиваем, сохраняем в /uploads и прикрепляем к solutionAttachments.
      const photoArr: any[] = (msg as any).photo;
      const document: any = (msg as any).document;
      if ((photoArr && photoArr.length) || document) {
        try {
          const { tutor: tu, student: st } = await this.getCachedUser(chatId);
          if (!tu && !st) { await this.askToRegister(chatId); return; }
          const state = await this.getTgState(chatId);
          if (!state || state.action !== "hw_submit" || !state.hwId) {
            await this.bot!.sendMessage(chatId,
              `📎 Чтобы прикрепить файл к домашнему заданию,\n` +
              `сначала откройте «📝 Мои задания» и нажмите кнопку <b>📤 Сдать</b>.`,
              { parse_mode: "HTML" }
            ).catch(() => {});
            return;
          }
          // Принимаем файл
          let fileId: string;
          let mime: string | undefined;
          let kind: "image" | "doc";
          if (photoArr && photoArr.length) {
            // Берём максимальное разрешение
            const big = photoArr[photoArr.length - 1];
            fileId = big.file_id;
            mime = "image/jpeg";
            kind = "image";
          } else {
            fileId = document.file_id;
            mime = document.mime_type || undefined;
            kind = (mime && mime.startsWith("image/")) ? "image" : "doc";
            const fsz = document.file_size || 0;
            if (fsz > 20 * 1024 * 1024) {
              await this.bot!.sendMessage(chatId, `⛔ Файл больше 20 МБ — слишком большой.`);
              return;
            }
          }
          const ack = await this.bot!.sendMessage(chatId, `📎 <i>Загружаю файл…</i>`, { parse_mode: "HTML" }).catch(() => null);
          const stored = await this.downloadAndStoreTelegramFile(fileId, mime);
          if (ack) this.bot!.deleteMessage(chatId, ack.message_id).catch(() => {});
          if (!stored) {
            await this.bot!.sendMessage(chatId, `⛔ Не удалось загрузить файл. Попробуйте ещё раз.`);
            return;
          }
          // Складываем в state.files (JSON-массив)
          const filesArr: { url: string; kind: "image" | "doc" }[] =
            state.files ? JSON.parse(state.files) : [];
          filesArr.push({ url: stored.url, kind });
          await this.setTgState(chatId, { ...state, files: JSON.stringify(filesArr) });

          const imgCount = filesArr.filter(f => f.kind === "image").length;
          const docCount = filesArr.filter(f => f.kind === "doc").length;
          const summary = [
            imgCount ? `📷 ${imgCount} фото` : null,
            docCount ? `📄 ${docCount} документ${docCount === 1 ? "" : docCount < 5 ? "а" : "ов"}` : null,
          ].filter(Boolean).join(" · ");
          await this.bot!.sendMessage(chatId,
            `✅ <b>Прикреплено:</b> ${summary}\n\n` +
            `<i>Можно прислать ещё файлы или текст. Когда закончите — нажмите кнопку.</i>`,
            {
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [[
                { text: "✅ Сдать", callback_data: `hw_done_${state.hwId}` },
                { text: "❌ Отмена", callback_data: `hw_cancel_${state.hwId}` },
              ]]}
            }
          );
          return;
        } catch (e: any) {
          console.error("[Bot file submit] error:", e?.message || e);
          await this.bot!.sendMessage(chatId, `⛔ Ошибка при загрузке файла. Попробуйте ещё раз.`).catch(() => {});
          return;
        }
      }
      // ──────────────────────────────────────────────────────────────

      // ── ГОЛОСОВЫЕ СООБЩЕНИЯ ─────────────────────────────────────────
      // Если пришёл voice / audio / video_note — скачиваем, прогоняем
      // через Whisper и дальше обрабатываем как обычный текст,
      // плюс отвечаем голосом (TTS).
      const voiceLike: any = (msg as any).voice || (msg as any).audio || (msg as any).video_note;
      let isVoiceMessage = false;
      if (voiceLike && voiceLike.file_id) {
        try {
          const { tutor: tu, student: st } = await this.getCachedUser(chatId);
          if (!tu && !st) {
            await this.askToRegister(chatId);
            return;
          }
          // Жёсткое ограничение Whisper — 25 МБ
          if ((voiceLike.file_size || 0) > 24 * 1024 * 1024) {
            await this.bot!.sendMessage(chatId,
              `🎤 Запись слишком длинная (>24 МБ). Попробуйте короче.`);
            return;
          }
          const thinkRec = await this.bot!.sendMessage(chatId,
            `🎤 <i>Распознаю речь…</i>`, { parse_mode: "HTML" }).catch(() => null);
          const transcribed = await this.transcribeTelegramVoice(voiceLike.file_id, voiceLike.mime_type);
          if (thinkRec) this.bot!.deleteMessage(chatId, thinkRec.message_id).catch(() => {});

          if (!transcribed) {
            await this.bot!.sendMessage(chatId,
              `🎤 Не удалось распознать. Говорите чётче или напишите текстом.`);
            return;
          }
          // Эхо-распознанный текст пользователю
          await this.bot!.sendMessage(chatId,
            `🎤 <i>Вы:</i> «${this.escapeHtml(transcribed)}»`,
            { parse_mode: "HTML" }
          ).catch(() => {});

          text = transcribed.trim();
          isVoiceMessage = true;
          // Падаем дальше — текст подменён, бот обработает как обычно.
        } catch (e: any) {
          console.error("[Bot voice] error:", e?.message || e);
          await this.bot!.sendMessage(chatId,
            `⛔ Не получилось распознать голос. Попробуйте ещё раз или напишите текстом.`).catch(() => {});
          return;
        }
      }
      // ──────────────────────────────────────────────────────────────

      try {
        // ── 6-digit link code — handled first, before any commands ──────
        if (/^\d{6}$/.test(text)) {
          const tutor0 = await storage.getTutorByTelegramChatId(chatId);
          const student0 = tutor0 ? null : await storage.getStudentByTelegramChatId(chatId);
          await this.handleLinkCode(chatId, text, tutor0 ?? null, student0 ?? null);
          return;
        }
        // ──────────────────────────────────────────────────────────────

        // ── Persistent reply keyboard buttons ─────────────────────────
        {
          const action = this.KB_TO_SECTION[text];
          if (action) {
            const { tutor: kbT, student: kbS } = await this.getCachedUser(chatId);
            const kbRole: "tutor" | "student" | null = kbT ? "tutor" : kbS ? "student" : null;
            if (kbRole) {
              await this.clearTgState(chatId);
              if (action === "cmd_menu") {
                await this.sendMainMenu(chatId, kbRole);
              } else if (action === "menu_students" && kbT) {
                await this.handleStudentsList(chatId, kbT, this.studentPageMap.get(chatId) ?? 0);
              } else if (action === "menu_lessons") {
                if (kbT) await this.handleLessonsSection(chatId, kbT);
                else if (kbS) await this.handleTodayStudent(chatId, kbS);
              } else if (action === "menu_homework") {
                if (kbT) await this.handleHomeworkTutor(chatId, kbT);
                else if (kbS) await this.handleHomeworkStudent(chatId, kbS);
              } else if (action === "menu_finance") {
                if (kbT) await this.handleBalanceTutor(chatId, kbT);
                else if (kbS) await this.handleBalanceStudent(chatId, kbS);
              } else if (action === "cmd_progress" && kbS) {
                await this.handleProgressStudent(chatId, kbS);
              } else {
                await this.sendMainMenu(chatId, kbRole);
              }
            } else {
              await this.askToRegister(chatId);
            }
            return;
          }
        }
        // ──────────────────────────────────────────────────────────────

        // ── Pending multi-step state (homework submit, grading comment) ──
        if (!text.startsWith("/")) {
          const state = await this.getTgState(chatId);
          if (state?.action) {
            await this.handleStateInput(chatId, text, state);
            return;
          }
        }
        // ──────────────────────────────────────────────────────────────

        // Detect who this user is (with 30s in-memory cache)
        const { tutor, student } = await this.getCachedUser(chatId);

        // Helper: fire thinking message in background, return fn to delete it
        // DB work starts immediately without waiting for Telegram roundtrip
        const think = (label: string) => {
          const mP = this.bot!.sendMessage(chatId, `⏳ ${label}`, { parse_mode: "HTML" }).catch(() => null);
          return async () => { const m = await mP; if (m) this.bot!.deleteMessage(chatId, m.message_id).catch(() => {}); };
        };

        // Route commands
        if (text.startsWith("/menu") || text.startsWith("/меню")) {
          const role = tutor ? "tutor" : student ? "student" : null;
          if (role) await this.sendMainMenu(chatId, role);
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/start")) {
          await this.handleStart(chatId, text, tutor, student);
        } else if (text.startsWith("/unlink") || text.startsWith("/disconnect") || text.startsWith("/отключить")) {
          await this.handleUnlink(chatId, tutor, student);
        } else if (text.startsWith("/today") || text.startsWith("/расписание")) {
          if (tutor) { const done = think("Формирую расписание на сегодня…"); await this.handleTodayTutor(chatId, tutor); await done(); }
          else if (student) { const done = think("Формирую расписание на сегодня…"); await this.handleTodayStudent(chatId, student); await done(); }
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/week") || text.startsWith("/неделя")) {
          if (tutor) { const done = think("Формирую расписание на неделю…"); await this.handleWeekTutor(chatId, tutor); await done(); }
          else if (student) { const done = think("Формирую расписание на неделю…"); await this.handleWeekStudent(chatId, student); await done(); }
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/homework") || text.startsWith("/дз")) {
          if (tutor) { const done = think("Загружаю домашние задания…"); await this.handleHomeworkTutor(chatId, tutor); await done(); }
          else if (student) { const done = think("Загружаю домашние задания…"); await this.handleHomeworkStudent(chatId, student); await done(); }
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/students") || text.startsWith("/ученики")) {
          if (tutor) { const done = think("Загружаю список учеников…"); await this.handleStudentsList(chatId, tutor, this.studentPageMap.get(chatId) ?? 0); await done(); }
          else await this.bot!.sendMessage(chatId, "⛔ Команда доступна только репетиторам.");
        } else if (text.startsWith("/stats") || text.startsWith("/статистика")) {
          if (tutor) { const done = think("Формирую статистику…"); await this.handleStatsTutor(chatId, tutor); await done(); }
          else if (student) { const done = think("Формирую статистику…"); await this.handleProgressStudent(chatId, student); await done(); }
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/next") || text.startsWith("/следующее")) {
          if (tutor) { const done = think("Ищу следующее занятие…"); await this.handleNextTutor(chatId, tutor); await done(); }
          else if (student) { const done = think("Ищу следующее занятие…"); await this.handleNextStudent(chatId, student); await done(); }
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/progress") || text.startsWith("/прогресс")) {
          if (student) { const done = think("Загружаю ваш прогресс…"); await this.handleProgressStudent(chatId, student); await done(); }
          else if (tutor) { const done = think("Формирую статистику…"); await this.handleStatsTutor(chatId, tutor); await done(); }
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/grades") || text.startsWith("/оценки")) {
          if (student) { const done = think("Загружаю оценки…"); await this.handleGradesStudent(chatId, student); await done(); }
          else await this.bot!.sendMessage(chatId, "⛔ Команда доступна только ученикам.");
        } else if (text.startsWith("/balance") || text.startsWith("/баланс") || text.startsWith("/финансы")) {
          if (tutor) { const done = think("Загружаю финансовый баланс…"); await this.handleBalanceTutor(chatId, tutor); await done(); }
          else if (student) { const done = think("Загружаю баланс…"); await this.handleBalanceStudent(chatId, student); await done(); }
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/ask") || text.startsWith("/спросить") || text.startsWith("/ai")) {
          const question = text.split(" ").slice(1).join(" ").trim();
          if (!question) {
            await this.bot!.sendMessage(chatId,
              `🤖 <b>ИИ-АССИСТЕНТ</b>\n━━━━━━━━━━━━━━━━━━\nНапишите вопрос после команды:\n<code>/ask ваш вопрос</code>`,
              { parse_mode: "HTML" });
          } else if (tutor || student) {
            const done = think("ИИ думает над ответом…");
            await this.handleAskAI(chatId, question, tutor, student, isVoiceMessage);
            await done();
          } else await this.askToRegister(chatId);
        } else if (text.startsWith("/history") || text.startsWith("/история")) {
          if (student) { const done = think("Загружаю историю занятий…"); await this.handleHistoryStudent(chatId, student); await done(); }
          else if (tutor) { const done = think("Загружаю историю…"); await this.handleHistoryTutor(chatId, tutor); await done(); }
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/pay") || text.startsWith("/оплата")) {
          if (tutor) { const done = think("Загружаю список учеников…"); await this.handleStudentsTutor(chatId, tutor); await done(); }
          else await this.bot!.sendMessage(chatId, "⛔ Команда доступна только репетиторам.");
        } else if (text.startsWith("/quiz") || text.startsWith("/тренажёр") || text.startsWith("/тренажер")) {
          if (student) await this.handleStudentQuizList(chatId, student.id);
          else await this.bot!.sendMessage(chatId, "🎯 Тренажёры доступны только ученикам.");
        } else if (text.startsWith("/help") || text.startsWith("/помощь")) {
          if (tutor) await this.sendTutorHelp(chatId);
          else if (student) await this.sendStudentHelp(chatId);
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/guide") || text.startsWith("/гид") || text.startsWith("/обучение")) {
          if (tutor) await this.sendTutorGuide(chatId);
          else if (student) await this.sendStudentGuide(chatId);
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/profile") || text.startsWith("/кабинет")) {
          if (tutor) { const done = think("Загружаю профиль…"); await this.sendTutorProfile(chatId, tutor); await done(); }
          else if (student) { const done = think("Загружаю профиль…"); await this.sendStudentProfile(chatId, student); await done(); }
          else await this.askToRegister(chatId);
        } else if (text.startsWith("/")) {
          if (!tutor && !student) await this.askToRegister(chatId);
          else {
            await this.bot!.sendMessage(chatId,
              `⚡ <b>ТВОЙ ВЕКТОР</b>\n━━━━━━━━━━━━━━━━━━\n` +
              `Неизвестная команда.\nОтправьте /help — список всех команд.`,
              { parse_mode: "HTML" }
            );
          }
        } else {
          // Произвольный текст без команды → ИИ-ассистент
          if (tutor || student) {
            const done = think("🤖 ИИ думает над ответом…");
            await this.handleAskAI(chatId, text, tutor, student, isVoiceMessage);
            await done();
          } else {
            await this.askToRegister(chatId);
          }
        }
      } catch {}
    });

    // ─── INLINE-РЕЖИМ ─────────────────────────────────────────────
    // Репетитор пишет в любом чате `@MyVectorAI_bot Иван` — Telegram
    // присылает inline_query, бот возвращает карточки с балансом /
    // долгом / следующим уроком найденных учеников.
    this.bot.on("inline_query", async (query) => {
      if (!this.instanceValid) return;
      try {
        await this.handleInlineQuery(query);
      } catch (e: any) {
        console.error("[Bot inline] error:", e?.message || e);
        try {
          await this.bot!.answerInlineQuery(query.id, [], {
            cache_time: 5,
            is_personal: true,
          });
        } catch {}
      }
    });

    this.bot.on("callback_query", async (query) => {
      if (!this.instanceValid) return;
      const chatId = String(query.message?.chat.id);
      const data = query.data || "";
      const origMsgId = query.message?.message_id; // message containing the pressed button
      await this.bot!.answerCallbackQuery(query.id).catch(() => {});

      // Deletes the original button-message so chat stays clean
      const delOrig = () => {
        if (origMsgId) this.bot!.deleteMessage(chatId, origMsgId).catch(() => {});
      };

      // Non-blocking loading indicator; also deletes the original message on done()
      const cbThink = (label: string) => {
        const mP = this.bot!.sendMessage(chatId, `⏳ ${label}`, { parse_mode: "HTML" }).catch(() => null);
        return async () => {
          const m = await mP;
          if (m) this.bot!.deleteMessage(chatId, m.message_id).catch(() => {});
          delOrig();
        };
      };

      try {
        // ── Reconnect confirm ──────────────────────────────────────────
        if (data === "confirm_unlink_tutor") {
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (t) await storage.updateTutor(t.id, { tutorChatId: null } as any);
          this.invalidateCache(chatId);
          delOrig();
          await this.bot!.sendMessage(chatId,
            `🔓 <b>ОТКЛЮЧЕНО</b>\n━━━━━━━━━━━━━━━━━━\nTelegram отвязан от аккаунта репетитора.\n\n` +
            `🔑 Зайдите на сайт <b>Твой Вектор → Главная</b> или <b>Профиль → Telegram</b>,\nнажмите <b>«Получить код»</b> и введите 6 цифр здесь.`,
            { parse_mode: "HTML" }
          );
          return;
        }
        if (data === "confirm_unlink_student") {
          const s = await storage.getStudentByTelegramChatId(chatId);
          if (s) await storage.updateStudent(s.id, { telegramChatId: null } as any);
          this.invalidateCache(chatId);
          delOrig();
          await this.bot!.sendMessage(chatId,
            `🔓 <b>ОТКЛЮЧЕНО</b>\n━━━━━━━━━━━━━━━━━━\nTelegram отвязан от аккаунта ученика.\n\n` +
            `🔑 Зайдите на сайт <b>Твой Вектор → Главная</b>, нажмите <b>«Получить код»</b>\nна синем баннере и введите 6 цифр здесь.`,
            { parse_mode: "HTML" }
          );
          return;
        }
        if (data === "cancel_unlink") {
          delOrig();
          await this.bot!.sendMessage(chatId, "✅ Отключение отменено. Всё без изменений.");
          return;
        }
        // ── Quick actions (all use cached identity + loading indicator) ──
        if (data === "cmd_today") {
          const done = cbThink("Загружаю расписание на сегодня…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleTodayTutor(chatId, t);
          else if (s) await this.handleTodayStudent(chatId, s);
          await done();
          return;
        }
        if (data === "cmd_week") {
          const done = cbThink("Загружаю расписание на неделю…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleWeekTutor(chatId, t);
          else if (s) await this.handleWeekStudent(chatId, s);
          await done();
          return;
        }
        if (data === "cmd_next") {
          const done = cbThink("Ищу следующее занятие…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleNextTutor(chatId, t);
          else if (s) await this.handleNextStudent(chatId, s);
          await done();
          return;
        }
        if (data === "cmd_history") {
          const done = cbThink("Загружаю историю занятий…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleHistoryTutor(chatId, t);
          else if (s) await this.handleHistoryStudent(chatId, s);
          await done();
          return;
        }
        if (data === "cmd_homework") {
          const done = cbThink("Загружаю домашние задания…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleHomeworkTutor(chatId, t);
          else if (s) await this.handleHomeworkStudent(chatId, s);
          await done();
          return;
        }
        if (data === "cmd_students") {
          const done = cbThink("Загружаю список учеников…");
          const { tutor: t } = await this.getCachedUser(chatId);
          if (t) await this.handleStudentsTutor(chatId, t);
          await done();
          return;
        }
        if (data === "cmd_stats") {
          const done = cbThink("Загружаю статистику…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleStatsTutor(chatId, t);
          else if (s) await this.handleProgressStudent(chatId, s);
          await done();
          return;
        }
        if (data === "cmd_balance") {
          const done = cbThink("Загружаю финансы…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleBalanceTutor(chatId, t);
          else if (s) await this.handleBalanceStudent(chatId, s);
          await done();
          return;
        }
        if (data === "cmd_grades") {
          const done = cbThink("Загружаю оценки…");
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleGradesStudent(chatId, s);
          await done();
          return;
        }
        if (data === "cmd_progress") {
          const done = cbThink("Загружаю прогресс…");
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleProgressStudent(chatId, s);
          await done();
          return;
        }
        if (data === "cmd_profile") {
          const done = cbThink("Загружаю профиль…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.sendTutorProfile(chatId, t);
          else if (s) await this.sendStudentProfile(chatId, s);
          await done();
          return;
        }
        if (data === "cmd_guide") {
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          delOrig();
          if (t) await this.sendTutorGuide(chatId);
          else if (s) await this.sendStudentGuide(chatId);
          return;
        }
        if (data === "cmd_help") {
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          delOrig();
          if (t) await this.sendTutorHelp(chatId);
          else if (s) await this.sendStudentHelp(chatId);
          return;
        }
        if (data === "cmd_ai_info") {
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          const isTutor = !!t;
          const examples = isTutor
            ? [`/ask Как объяснить логарифмы 8-класснику?`, `/ask Придумай 5 задач по тригонометрии`, `/ask Составь план урока — теорема Пифагора`, `/ask Как мотивировать ленивого ученика?`]
            : [`/ask Объясни производную простыми словами`, `/ask Как решать квадратные уравнения?`, `/ask Что такое логарифм?`, `/ask Помоги разобраться с интегралом`];
          const title = isTutor ? "🤖 ИИ-АССИСТЕНТ" : "🤖 ИИ-ПОМОЩНИК";
          const desc = isTutor ? "GPT-4o отвечает в контексте репетитора — методика, задания, планирование." : "ИИ объясняет темы и помогает с заданиями понятным языком.";
          delOrig();
          await this.bot!.sendMessage(chatId,
            `${title}\n━━━━━━━━━━━━━━━━━━\n${desc}\n\n<b>Используйте:</b> <code>/ask ваш вопрос</code>\nили просто напишите вопрос в чат.\n\n<b>Примеры:</b>\n` +
            examples.map(e => `• <code>${e}</code>`).join("\n"),
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🏠 Меню", callback_data: "cmd_menu" }]] } }
          );
          return;
        }
        // ── Student detail for tutor ───────────────────────────────────
        if (data.startsWith("student_detail_")) {
          const studentId = data.replace("student_detail_", "");
          const done = cbThink("Загружаю карточку ученика…");
          const { tutor: t } = await this.getCachedUser(chatId);
          if (t) await this.handleStudentDetail(chatId, t, studentId);
          await done();
          return;
        }

        // ── Assign homework from student card ────────────────────────────
        if (data.startsWith("hw_assign_")) {
          const studentId = data.replace("hw_assign_", "");
          const { tutor: t } = await this.getCachedUser(chatId);
          if (!t) return;
          const student = await storage.getStudent(studentId);
          if (!student || student.tutorId !== t.id) return;
          await this.setTgState(chatId, { step: "hw_title", studentId });
          delOrig();
          await this.bot!.sendMessage(chatId,
            `📝 <b>ВЫДАТЬ ЗАДАНИЕ</b>  ·  <code>${student.name}</code>\n══════════════════════\n\n` +
            `  ▸ Введите <b>название</b> задания:`,
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [
              [{ text: "◀ Отмена", callback_data: `student_detail_${studentId}` }],
            ]}}
          );
          return;
        }

        // ── РЕШЕНИЕ РЕПЕТИТОРА ПО ЗАЯВКЕ НА ПЕРЕНОС ────────────────
        if (data.startsWith("lresc_ok_") || data.startsWith("lresc_no_")) {
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (!t) return;
          const isOk = data.startsWith("lresc_ok_");
          const rest = data.slice(isOk ? "lresc_ok_".length : "lresc_no_".length);
          const [lessonId, tsStr] = rest.split("_");
          const lesson = await storage.getLesson(lessonId);
          if (!lesson || lesson.tutorId !== t.id) return;
          const s = await storage.getStudent(lesson.studentId);
          const tz = (t as any).timezone || "Europe/Moscow";

          if (isOk) {
            const newDate = new Date(parseInt(tsStr, 10));
            await storage.updateLesson(lessonId, { scheduledAt: newDate.toISOString() } as any);
            this.dcDel(`tl:${t.id}`, `sl:${lesson.studentId}`);
            try { await this.bot!.answerCallbackQuery(query.id, { text: "Перенесено ✅" }); } catch {}
            try {
              await this.bot!.editMessageReplyMarkup(
                { inline_keyboard: [[{ text: "✅ Перенос согласован", callback_data: "noop" }]] },
                { chat_id: chatId, message_id: query.message?.message_id }
              );
            } catch {}
            if (s && (s as any).telegramChatId) {
              try {
                await this.bot!.sendMessage((s as any).telegramChatId,
                  `✅ <b>ПЕРЕНОС СОГЛАСОВАН</b>\n` +
                  `  ▸ Новое время: <code>${formatDateTimeRu(newDate, tz)}</code>`,
                  { parse_mode: "HTML" }
                );
              } catch {}
            }
          } else {
            try { await this.bot!.answerCallbackQuery(query.id, { text: "Отклонено ❌" }); } catch {}
            try {
              await this.bot!.editMessageReplyMarkup(
                { inline_keyboard: [[{ text: "❌ Перенос отклонён", callback_data: "noop" }]] },
                { chat_id: chatId, message_id: query.message?.message_id }
              );
            } catch {}
            if (s && (s as any).telegramChatId) {
              try {
                await this.bot!.sendMessage((s as any).telegramChatId,
                  `❌ <b>ЗАЯВКА НА ПЕРЕНОС ОТКЛОНЕНА</b>\n` +
                  `Урок остаётся: <code>${formatDateTimeRu(new Date(lesson.scheduledAt), tz)}</code>`,
                  { parse_mode: "HTML" }
                );
              } catch {}
            }
          }
          return;
        }

        // ── РЕАКЦИИ НА НАПОМИНАНИЕ ЗА 1 ЧАС ──────────────────────────
        // Кто угодно (репетитор или ученик) может подтвердить / отменить /
        // запросить перенос прямо из карточки напоминания.
        if (data.startsWith("lconf_") || data.startsWith("lcanc_") || data.startsWith("lresc_")) {
          const lessonId = data.slice(6);
          const lesson = await storage.getLesson(lessonId);
          if (!lesson) {
            try { await this.bot!.answerCallbackQuery(query.id, { text: "Урок не найден", show_alert: false }); } catch {}
            return;
          }
          const t = await storage.getTutor(lesson.tutorId).catch(() => null);
          const s = await storage.getStudent(lesson.studentId).catch(() => null);
          if (!t || !s) return;

          // Кто нажал? Сравним chat_id с tutor / student
          const isTutor   = t.tutorChatId === chatId;
          const isStudent = (s as any).telegramChatId === chatId;
          if (!isTutor && !isStudent) {
            try { await this.bot!.answerCallbackQuery(query.id, { text: "Нет доступа", show_alert: false }); } catch {}
            return;
          }
          const actor = isTutor ? "репетитор" : "ученик";
          const tz = (t as any).timezone || "Europe/Moscow";
          const timeStr = formatDateTimeRu(new Date(lesson.scheduledAt), tz);

          // ── ПОДТВЕРДИТЬ ─────────────────────────────────────────────
          if (data.startsWith("lconf_")) {
            try { await this.bot!.answerCallbackQuery(query.id, { text: "Урок подтверждён ✅" }); } catch {}
            // Убираем кнопки у нажавшего, текст помечаем подтверждением
            try {
              await this.bot!.editMessageReplyMarkup(
                { inline_keyboard: [[{ text: `✅ Подтверждено (${actor})`, callback_data: "noop" }]] },
                { chat_id: chatId, message_id: query.message?.message_id }
              );
            } catch {}
            // Уведомляем вторую сторону
            const counterpartChatId = isTutor ? (s as any).telegramChatId : t.tutorChatId;
            if (counterpartChatId) {
              try {
                await this.bot!.sendMessage(counterpartChatId,
                  `✅ <b>Урок подтверждён</b>\n` +
                  `  ▸ ${isTutor ? `Репетитор <b>${t.name}</b>` : `Ученик <b>${s.name}</b>`} подтвердил(а) урок\n` +
                  `  ▸ Время:  <code>${timeStr}</code>` +
                  (lesson.topic ? `\n  ▸ Тема:  <i>${lesson.topic}</i>` : ""),
                  { parse_mode: "HTML" }
                );
              } catch {}
            }
            // In-app уведомление репетитору, если подтвердил ученик
            if (isStudent) {
              await storage.createNotification({
                tutorId: t.id,
                type: "lesson_confirmed",
                title: `✅ ${s.name} подтвердил(а) урок`,
                message: `Время: ${timeStr}${lesson.topic ? ` · ${lesson.topic}` : ""}`,
                relatedId: lesson.id,
                isRead: false,
              } as any).catch(() => {});
            }
            return;
          }

          // ── ОТМЕНИТЬ ────────────────────────────────────────────────
          if (data.startsWith("lcanc_")) {
            await storage.updateLesson(lessonId, { status: "cancelled" } as any);

            // Если отменяет репетитор — применяем cancel-policy
            if (isTutor) {
              const tutorAny = t as any;
              const policy = tutorAny.cancelPolicy || "free";
              if (policy !== "free") {
                const fee = policy === "fixed"
                  ? (tutorAny.cancelFee || 0)
                  : ((s as any).cancelFee ?? tutorAny.cancelFee ?? 0);
                if (fee > 0) {
                  await storage.updateLesson(lessonId, { attendance: "missed_paid", cancelAmount: fee } as any);
                  await storage.updateStudent(s.id, { balance: ((s as any).balance || 0) - fee } as any);
                } else {
                  await storage.updateLesson(lessonId, { attendance: "missed" } as any);
                }
              } else {
                await storage.updateLesson(lessonId, { attendance: "missed" } as any);
              }
            } else {
              // Ученик отменил — без штрафа, метим в attendance
              await storage.updateLesson(lessonId, { attendance: "missed", cancelledByStudent: true } as any).catch(() =>
                storage.updateLesson(lessonId, { attendance: "missed" } as any)
              );
            }

            this.dcDel(`tl:${t.id}`, `sl:${s.id}`);
            try { await this.bot!.answerCallbackQuery(query.id, { text: "Урок отменён ❌" }); } catch {}
            try {
              await this.bot!.editMessageReplyMarkup(
                { inline_keyboard: [[{ text: `❌ Отменено (${actor})`, callback_data: "noop" }]] },
                { chat_id: chatId, message_id: query.message?.message_id }
              );
            } catch {}
            // Уведомляем вторую сторону
            const counterpartChatId = isTutor ? (s as any).telegramChatId : t.tutorChatId;
            if (counterpartChatId) {
              try {
                await this.bot!.sendMessage(counterpartChatId,
                  `❌ <b>Урок отменён</b>\n` +
                  `  ▸ ${isTutor ? `Репетитор <b>${t.name}</b>` : `Ученик <b>${s.name}</b>`} отменил(а) урок\n` +
                  `  ▸ Время:  <code>${timeStr}</code>` +
                  (lesson.topic ? `\n  ▸ Тема:  <i>${lesson.topic}</i>` : ""),
                  { parse_mode: "HTML" }
                );
              } catch {}
            }
            if (isStudent) {
              await storage.createNotification({
                tutorId: t.id,
                type: "lesson_cancelled_by_student",
                title: `❌ ${s.name} отменил(а) урок`,
                message: `Время: ${timeStr}${lesson.topic ? ` · ${lesson.topic}` : ""}`,
                relatedId: lesson.id,
                isRead: false,
              } as any).catch(() => {});
            }
            return;
          }

          // ── ПЕРЕНЕСТИ ──────────────────────────────────────────────
          if (data.startsWith("lresc_")) {
            await this.setTgState(chatId, { action: "lesson_reschedule", lessonId });
            try { await this.bot!.answerCallbackQuery(query.id); } catch {}
            await this.bot!.sendMessage(chatId,
              `⏭ <b>ПЕРЕНОС УРОКА</b>\n══════════════════════\n` +
              `  ▸ Сейчас: <code>${timeStr}</code>\n\n` +
              `Введите новое время в одном из форматов:\n` +
              `  ▸ <code>23.04 17:00</code>\n` +
              `  ▸ <code>23.04.2026 17:00</code>\n` +
              `  ▸ <code>завтра 17:00</code>`,
              { parse_mode: "HTML", reply_markup: { inline_keyboard: [[
                { text: "Отмена", callback_data: "cancel_state" },
              ]]}}
            );
            return;
          }
        }

        // Заглушка для disabled-кнопок в напоминании
        if (data === "noop") {
          try { await this.bot!.answerCallbackQuery(query.id); } catch {}
          return;
        }

        if (data === "cancel_state") {
          await this.clearTgState(chatId);
          try { await this.bot!.answerCallbackQuery(query.id, { text: "Отменено" }); } catch {}
          try {
            await this.bot!.editMessageReplyMarkup(
              { inline_keyboard: [] },
              { chat_id: chatId, message_id: query.message?.message_id }
            );
          } catch {}
          return;
        }

        // ── Mark lesson done + auto-record payment ────────────────────
        if (data.startsWith("lesson_done_paid_")) {
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (!t) return;
          const lessonId = data.replace("lesson_done_paid_", "");
          const lesson = await storage.getLesson(lessonId);
          if (!lesson || lesson.tutorId !== t.id) return;
          await storage.updateLesson(lessonId, { status: "completed" } as any);
          this.dcDel(`tl:${t.id}`, `sl:${lesson.studentId}`);
          const st = await storage.getStudent(lesson.studentId);
          const tz = (t as any).timezone || "Europe/Moscow";
          const time = new Date(lesson.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
          // Auto-record payment equal to lesson price
          const price = (st as any)?.pricePerLesson || 0;
          let payMsg = "";
          if (price > 0 && st) {
            await storage.createPayment({ tutorId: t.id, studentId: st.id, amount: price, method: "наличные" } as any);
            await storage.updateStudent(st.id, { balance: ((st as any).balance || 0) + price } as any);
            this.dcDel(`sp:${st.id}`, `ts:${t.id}`, `tp:${t.id}`);
            payMsg = `\n  💰  Оплата <code>${price.toLocaleString("ru-RU")} ₽</code> записана`;
          }
          delOrig();
          await this.bot!.sendMessage(chatId,
            `✅ <b>ЗАВЕРШЕНО + ОПЛАТА</b>\n══════════════════════\n` +
            `  ▸ <b>${st?.name || "—"}</b>  <code>${time}</code>\n` +
            `  ▸ <i>${lesson.topic || "тема не указана"}</i>` + payMsg,
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [
              [{ text: "📅 Занятия сегодня", callback_data: "menu_lessons" },
               { text: "💰 Финансы",         callback_data: "menu_finance" }],
            ]}}
          );
          if (st?.telegramChatId) {
            await this.bot!.sendMessage(st.telegramChatId,
              `✦ <b>ЗАНЯТИЕ ЗАВЕРШЕНО</b>\n══════════════════════\n` +
              `  ▸ Тема:  <b>${lesson.topic || "—"}</b>\n` +
              `  ▸ Время:  <code>${time}</code>`,
              { parse_mode: "HTML" }
            ).catch(() => {});
          }
          return;
        }

        // ── Mark lesson done / cancelled ──────────────────────────────
        if (data.startsWith("lesson_done_") || data.startsWith("lesson_miss_")) {
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (!t) return;
          const lessonId = data.replace("lesson_done_", "").replace("lesson_miss_", "");
          const lesson = await storage.getLesson(lessonId);
          if (!lesson || lesson.tutorId !== t.id) return;

          const isDone = data.startsWith("lesson_done_");
          // "Проведено" always marks as attended and deducts from balance
          // "Отменено" lets the server auto-apply cancel policy
          const updatePayload = isDone
            ? { status: "completed", attendance: "attended" }
            : { status: "cancelled" };

          await storage.updateLesson(lessonId, updatePayload as any);

          // For "Проведено", deduct lesson cost from balance
          if (isDone) {
            const st = await storage.getStudent(lesson.studentId);
            if (st && (st as any).tutorId === t.id) {
              const cost = Math.round((st as any).pricePerLesson * (lesson.durationMinutes || 60) / 60);
              if (cost > 0) {
                await storage.updateStudent(lesson.studentId, { balance: ((st as any).balance || 0) - cost } as any);
              }
            }
          } else {
            // For "Отменено", apply cancel policy
            const tutor = t as any;
            const policy = tutor.cancelPolicy || 'free';
            if (policy !== 'free') {
              const st = await storage.getStudent(lesson.studentId);
              const fee = policy === 'fixed' ? (tutor.cancelFee || 0) : ((st as any)?.cancelFee ?? tutor.cancelFee ?? 0);
              if (fee > 0 && st) {
                await storage.updateLesson(lessonId, { attendance: "missed_paid", cancelAmount: fee } as any);
                await storage.updateStudent(lesson.studentId, { balance: ((st as any).balance || 0) - fee } as any);
              } else {
                await storage.updateLesson(lessonId, { attendance: "missed" } as any);
              }
            } else {
              await storage.updateLesson(lessonId, { attendance: "missed" } as any);
            }
          }

          this.dcDel(`tl:${t.id}`, `sl:${lesson.studentId}`);
          const st = await storage.getStudent(lesson.studentId);
          const icon = isDone ? "✅" : "❌";
          const label = isDone ? "ПРОВЕДЕНО" : "ОТМЕНЕНО";
          const time = new Date(lesson.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: (t as any).timezone || "Europe/Moscow" });
          delOrig();
          await this.bot!.sendMessage(chatId,
            `${icon} <b>${label}</b>\n══════════════════════\n` +
            `  ▸ <b>${st?.name || "—"}</b>  <code>${time}</code>\n` +
            `  ▸ <i>${lesson.topic || "тема не указана"}</i>`,
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [
              [{ text: "📅 Занятия сегодня", callback_data: "menu_lessons" },
               { text: "💰 Оплата",          callback_data: `pay_s_${lesson.studentId}` }],
            ]}}
          );
          // If completed, notify student if connected
          if (isDone && st?.telegramChatId) {
            await this.bot!.sendMessage(st.telegramChatId,
              `✦ <b>ЗАНЯТИЕ ЗАВЕРШЕНО</b>\n══════════════════════\n` +
              `  ▸ Тема:  <b>${lesson.topic || "—"}</b>\n` +
              `  ▸ Время:  <code>${time}</code>`,
              { parse_mode: "HTML" }
            ).catch(() => {});
          }
          return;
        }

        // ── Grade homework ─────────────────────────────────────────────
        if (data.startsWith("hw_grade_")) {
          const hwId = data.replace("hw_grade_", "");
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (!t) return;
          const hw = await storage.getHomework(hwId).catch(() => null);
          if (!hw || (hw as any).tutorId !== t.id) return;
          const st = await storage.getStudent((hw as any).studentId);
          delOrig();
          await this.bot!.sendMessage(chatId,
            `⭐ <b>ОЦЕНИТЬ РАБОТУ</b>\n══════════════════════\n` +
            `◆ <b>${st?.name || "—"}</b>  ·  <i>${(hw as any).title}</i>\n\nВыберите оценку:`,
            {
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [
                [40, 50, 55, 60, 65].map(s => ({ text: `${s}`, callback_data: `hw_score_${hwId}_${s}` })),
                [70, 75, 80, 85, 90].map(s => ({ text: `${s}`, callback_data: `hw_score_${hwId}_${s}` })),
                [{ text: "95", callback_data: `hw_score_${hwId}_95` }, { text: "100 🏆", callback_data: `hw_score_${hwId}_100` }],
                [{ text: "✏️ Написать комментарий", callback_data: `hw_comment_${hwId}` }],
              ]}
            }
          );
          return;
        }

        if (data.startsWith("hw_score_")) {
          const parts = data.split("_"); // hw_score_{hwId}_{score}
          const score = parseInt(parts.pop()!);
          const hwId = parts.slice(2).join("_");
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (!t || isNaN(score)) return;
          const hw = await storage.getHomework(hwId).catch(() => null);
          if (!hw || (hw as any).tutorId !== t.id) return;
          await storage.updateHomework(hwId, { score, status: "reviewed" } as any);
          this.dcDel(`th:${t.id}`, `sh:${(hw as any).studentId}`);
          const st = await storage.getStudent((hw as any).studentId);
          const emoji = score >= 90 ? "🏆" : score >= 75 ? "⭐" : score >= 60 ? "✅" : "📝";
          delOrig();
          await this.bot!.sendMessage(chatId,
            `${emoji} <b>ОЦЕНЕНО</b>\n══════════════════════\n` +
            `  ▸ <b>${st?.name || "—"}</b>  ·  <i>${(hw as any).title}</i>\n` +
            `  ▸ Балл:  <code>${score}/100</code>`,
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📝 Все на проверке", callback_data: "cmd_homework" }]] } }
          );
          // Notify student
          if (st?.telegramChatId) {
            await this.bot!.sendMessage(st.telegramChatId,
              `${emoji} <b>РАБОТА ПРОВЕРЕНА</b>\n══════════════════════\n` +
              `  ▸ Задание:  <b>${(hw as any).title}</b>\n` +
              `  ▸ Оценка:  <code>${score}/100</code>`,
              { parse_mode: "HTML" }
            ).catch(() => {});
          }
          return;
        }

        if (data.startsWith("hw_comment_")) {
          const hwId = data.replace("hw_comment_", "");
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (!t) return;
          await this.setTgState(chatId, { action: "hw_comment", hwId });
          delOrig();
          await this.bot!.sendMessage(chatId,
            `✏️ Напишите комментарий к работе.\n<i>Оценка будет сохранена вместе с комментарием.</i>`,
            { parse_mode: "HTML" }
          );
          return;
        }

        // ── Payment flow for tutor ─────────────────────────────────────
        if (data.startsWith("pay_s_")) {
          const studentId = data.replace("pay_s_", "");
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (!t) return;
          const st = await storage.getStudent(studentId);
          if (!st || st.tutorId !== t.id) return;
          const price = (st as any).pricePerLesson || 0;
          const amounts = [price, price * 2, price * 4, Math.round(price * 1.5)].filter(a => a > 0);
          const uniqueAmounts = Array.from(new Set(amounts)).slice(0, 4);
          if (uniqueAmounts.length === 0) uniqueAmounts.push(500, 1000, 1500, 2000);
          delOrig();
          await this.bot!.sendMessage(chatId,
            `💰 <b>ОПЛАТА</b>\n━━━━━━━━━━━━━━━━━━\n<b>${st.name}</b>\nЦена занятия: ${price.toLocaleString("ru-RU")} ₽\n\nВыберите сумму:`,
            {
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [
                uniqueAmounts.map(a => ({ text: `${a.toLocaleString("ru-RU")} ₽`, callback_data: `pay_a_${studentId}_${a}` })),
                [{ text: "✏️ Другая сумма", callback_data: `pay_custom_${studentId}` }],
              ]}
            }
          );
          return;
        }

        if (data.startsWith("pay_custom_")) {
          const studentId = data.replace("pay_custom_", "");
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (!t) return;
          await this.setTgState(chatId, { action: "pay_amount", studentId });
          delOrig();
          await this.bot!.sendMessage(chatId,
            `💰 Введите сумму оплаты в рублях (только цифры):`,
            { parse_mode: "HTML" }
          );
          return;
        }

        if (data.startsWith("pay_a_")) {
          // pay_a_{studentId}_{amount}
          const withoutPrefix = data.replace("pay_a_", "");
          const lastUnderscore = withoutPrefix.lastIndexOf("_");
          const studentId = withoutPrefix.slice(0, lastUnderscore);
          const amount = parseInt(withoutPrefix.slice(lastUnderscore + 1));
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (!t || isNaN(amount)) return;
          const st = await storage.getStudent(studentId);
          if (!st || st.tutorId !== t.id) return;
          delOrig();
          await this.bot!.sendMessage(chatId,
            `💰 <b>ВЫБОР МЕТОДА</b>\n══════════════════════\n` +
            `  ▸ Ученик:  <b>${st.name}</b>\n` +
            `  ▸ Сумма:  <code>${amount.toLocaleString("ru-RU")} ₽</code>\n\n<i>Выберите способ оплаты:</i>`,
            {
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [[
                { text: "💵 Наличные", callback_data: `pay_c_${studentId}_${amount}_n` },
                { text: "💳 Карта", callback_data: `pay_c_${studentId}_${amount}_k` },
                { text: "📲 Перевод", callback_data: `pay_c_${studentId}_${amount}_p` },
                { text: "⚡ СБП", callback_data: `pay_c_${studentId}_${amount}_s` },
              ]]}
            }
          );
          return;
        }

        if (data.startsWith("pay_c_")) {
          // pay_c_{studentId}_{amount}_{methodCode}
          const withoutPrefix = data.replace("pay_c_", "");
          const parts2 = withoutPrefix.split("_");
          const methodCode = parts2.pop()!;
          const amount = parseInt(parts2.pop()!);
          const studentId = parts2.join("_");
          const methodMap: Record<string, string> = { n: "наличные", k: "карта", p: "перевод", s: "СБП" };
          const method = methodMap[methodCode] || "перевод";
          const t = await storage.getTutorByTelegramChatId(chatId);
          if (!t || isNaN(amount)) return;
          const st = await storage.getStudent(studentId);
          if (!st || st.tutorId !== t.id) return;
          await storage.createPayment({ tutorId: t.id, studentId, amount, method });
          await storage.updateStudent(studentId, { balance: ((st as any).balance || 0) + amount } as any);
          this.dcDel(`sp:${studentId}`, `ts:${t.id}`, `tp:${t.id}`);
          delOrig();
          await this.bot!.sendMessage(chatId,
            `✅ <b>ОПЛАТА ЗАПИСАНА</b>\n══════════════════════\n` +
            `◆ ТРАНЗАКЦИЯ\n` +
            `  ▸ Ученик:  <b>${st.name}</b>\n` +
            `  ▸ Сумма:  <code>${amount.toLocaleString("ru-RU")} ₽</code>\n` +
            `  ▸ Метод:  <i>${method}</i>\n` +
            `  ▸ Новый баланс:  <code>${(((st as any).balance || 0) + amount).toLocaleString("ru-RU")} ₽</code>`,
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "💰 Все балансы", callback_data: "cmd_balance" }, { text: "👥 Ученики", callback_data: "cmd_students" }]] } }
          );
          return;
        }

        // ── Student submit homework ────────────────────────────────────
        if (data.startsWith("hw_ss_")) {
          const hwId = data.replace("hw_ss_", "");
          const s = await storage.getStudentByTelegramChatId(chatId);
          if (!s) return;
          const hw = await storage.getHomework(hwId).catch(() => null);
          if (!hw || (hw as any).studentId !== s.id) return;
          await this.setTgState(chatId, { action: "hw_submit", hwId, files: "[]" });
          delOrig();
          await this.bot!.sendMessage(chatId,
            `📤 <b>СДАТЬ ЗАДАНИЕ</b>\n══════════════════════\n` +
            `◆ <b>${this.escapeHtml((hw as any).title)}</b>\n\n` +
            `<i>Пришлите решение в любом виде:</i>\n` +
            `  ▸ 📷 фото (можно несколько подряд)\n` +
            `  ▸ 📄 PDF / DOCX / другой документ\n` +
            `  ▸ ✏️ текст в чат\n\n` +
            `Можно совмещать. Когда закончите — нажмите ниже.`,
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [[
              { text: "✅ Сдать без вложений", callback_data: `hw_done_${hwId}` },
              { text: "❌ Отмена", callback_data: `hw_cancel_${hwId}` },
            ]]}}
          );
          return;
        }

        if (data.startsWith("hw_cancel_")) {
          await this.clearTgState(chatId);
          delOrig();
          await this.bot!.sendMessage(chatId,
            `❌ Сдача задания отменена. Файлы не сохранены.`,
            { reply_markup: { inline_keyboard: [[{ text: "📝 Мои задания", callback_data: "cmd_homework" }]] } }
          );
          return;
        }

        if (data.startsWith("hw_done_")) {
          const hwId = data.replace("hw_done_", "");
          const s = await storage.getStudentByTelegramChatId(chatId);
          if (!s) return;
          const hw = await storage.getHomework(hwId).catch(() => null);
          if (!hw || (hw as any).studentId !== s.id) return;
          const state = await this.getTgState(chatId);
          const files: { url: string; kind: "image" | "doc" }[] =
            state?.files ? JSON.parse(state.files) : [];
          const txt = state?.text || "";
          await this.clearTgState(chatId);
          delOrig();
          await this.finalizeHomeworkSubmission(chatId, s, hw as any, txt, files);
          return;
        }
        // ── Inline menu navigation ─────────────────────────────────────
        const msgId = query.message?.message_id;

        if (data === "cmd_menu") {
          const { tutor: t2, student: s2 } = await this.getCachedUser(chatId);
          const role2: "tutor" | "student" | null = t2 ? "tutor" : s2 ? "student" : null;
          if (!role2 || !msgId) return;
          await this.sendMainMenu(chatId, role2, msgId);
          return;
        }

        // ── New section callbacks ──────────────────────────────────────
        if (data === "menu_students") {
          const done = cbThink("Загружаю учеников…");
          const { tutor: t } = await this.getCachedUser(chatId);
          if (t) await this.handleStudentsList(chatId, t, this.studentPageMap.get(chatId) ?? 0);
          await done();
          return;
        }
        if (data.startsWith("st_pg_")) {
          const done = cbThink("Загружаю страницу…");
          const pg = parseInt(data.slice(6), 10);
          const { tutor: t } = await this.getCachedUser(chatId);
          if (t && !isNaN(pg)) await this.handleStudentsList(chatId, t, pg);
          await done();
          return;
        }
        if (data === "menu_lessons") {
          const done = cbThink("Загружаю занятия…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleLessonsSection(chatId, t);
          else if (s) await this.handleTodayStudent(chatId, s);
          await done();
          return;
        }
        if (data === "menu_homework") {
          const done = cbThink("Загружаю домашние задания…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleHomeworkTutor(chatId, t);
          else if (s) await this.handleHomeworkStudent(chatId, s);
          await done();
          return;
        }
        if (data === "menu_finance") {
          const done = cbThink("Загружаю финансы…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleBalanceTutor(chatId, t);
          else if (s) await this.handleBalanceStudent(chatId, s);
          await done();
          return;
        }
        if (data === "menu_ai") {
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          const isTutor = !!t;
          const tutorExamples = [
            "Как объяснить логарифмы 8-класснику?",
            "Придумай 5 задач по тригонометрии ЕГЭ",
            "Составь план урока: теорема Пифагора",
            "Как мотивировать ленивого ученика?",
            "Дай разбор этой задачи: ...",
          ];
          const studentExamples = [
            "Объясни производную простыми словами",
            "Как решать квадратные уравнения?",
            "Что такое интеграл и зачем он нужен?",
            "Помоги разобраться с теоремой Пифагора",
            "Проверь моё решение: ...",
          ];
          const examples = isTutor ? tutorExamples : studentExamples;
          delOrig();
          await this.bot!.sendMessage(chatId,
            `🤖 <b>ИИ-АССИСТЕНТ</b>  ·  <code>GPT-4o</code>\n══════════════════════\n\n` +
            `${isTutor
              ? "Помогает с методикой, разработкой заданий и планированием уроков."
              : "Объясняет темы, помогает с заданиями и отвечает на учебные вопросы."
            }\n\n` +
            `◆ <b>КАК ИСПОЛЬЗОВАТЬ</b>\n` +
            `  💬  Просто напишите вопрос прямо в чат\n` +
            `  📌  Или команда: <code>/ask ваш вопрос</code>\n\n` +
            `◆ <b>ПРИМЕРЫ ВОПРОСОВ</b>\n` +
            examples.map(e => `  ▸ <i>${e}</i>`).join("\n") +
            `\n\n<i>ИИ отвечает с учётом контекста ${isTutor ? "репетитора" : "ученика"} — задавайте любые вопросы!</i>`,
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [
              [{ text: "📊 Аналитика", callback_data: "cmd_stats" },
               { text: "👤 Профиль",   callback_data: "cmd_profile" }],
              [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
            ]}}
          );
          return;
        }
        if (data === "menu_help") {
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          delOrig();
          if (t) await this.sendTutorHelp(chatId);
          else if (s) await this.sendStudentHelp(chatId);
          return;
        }

        // ── Student section callbacks ──────────────────────────────────
        if (data === "s_schedule") {
          const done = cbThink("Загружаю расписание…");
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleStudentScheduleSection(chatId, s);
          await done();
          return;
        }
        if (data === "s_tasks") {
          const done = cbThink("Загружаю задания…");
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleStudentTasksSection(chatId, s);
          await done();
          return;
        }
        if (data === "s_progress") {
          const done = cbThink("Загружаю прогресс…");
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleProgressStudent(chatId, s);
          await done();
          return;
        }
        if (data === "s_balance") {
          const done = cbThink("Загружаю баланс…");
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleBalanceStudent(chatId, s);
          await done();
          return;
        }
        if (data === "s_quiz") {
          const done = cbThink("Загружаю тренажёры…");
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleStudentQuizList(chatId, s.id);
          await done();
          return;
        }
        if (data.startsWith("quiz_start_")) {
          const quizId = data.slice("quiz_start_".length);
          delOrig();
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.startQuizSession(chatId, s.id, quizId);
          return;
        }
        if (data.startsWith("quiz_ans_")) {
          // format: quiz_ans_<sessionId>_<idx>_<chosen>
          const parts = data.slice("quiz_ans_".length).split("_");
          if (parts.length < 3) return;
          const sessionId = parts[0];
          const idx = parseInt(parts[1]);
          const chosen = parseInt(parts[2]);
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleQuizAnswer(chatId, s.id, sessionId, idx, chosen, origMsgId);
          return;
        }
        if (data === "quiz_quit") {
          this.stateMap.delete(chatId);
          delOrig();
          await this.bot!.sendMessage(chatId, "❌ Тренировка прервана.");
          return;
        }
        if (data === "s_board") {
          const done = cbThink("Загружаю доску…");
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleStudentBoardSection(chatId, s);
          await done();
          return;
        }
        if (data === "s_programme") {
          const done = cbThink("Загружаю программу…");
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleStudentProgrammeSection(chatId, s);
          await done();
          return;
        }
        if (data === "s_more") {
          const done = cbThink("Загружаю…");
          const { student: s } = await this.getCachedUser(chatId);
          if (s) await this.handleStudentMoreSection(chatId, s);
          await done();
          return;
        }
        // ──────────────────────────────────────────────────────────────

        // ── Legacy compat (old callbacks) ─────────────────────────────
        if (data === "menu_sched") {
          const done = cbThink("Загружаю занятия…");
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleLessonsSection(chatId, t);
          else if (s) await this.handleTodayStudent(chatId, s);
          await done();
          return;
        }
        if (data === "menu_people" || data === "menu_study") {
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          if (t) await this.handleStudentsList(chatId, t, 0);
          else if (s) await this.handleHomeworkStudent(chatId, s);
          return;
        }
        if (data === "menu_other") {
          const { tutor: t, student: s } = await this.getCachedUser(chatId);
          const isTutor = !!t;
          await this.bot!.sendMessage(chatId,
            `⚙️ <b>ПРОЧЕЕ</b>  ·  <code>${isTutor ? "РЕПЕТИТОР" : "УЧЕНИК"}</code>\n══════════════════════\n\n` +
            `◆ РАЗДЕЛЫ\n  ▸ ИИ-помощник · Профиль · Помощь`,
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [
              [{ text: "🤖 ИИ-помощник", callback_data: "menu_ai" }, { text: "❓ Помощь", callback_data: "menu_help" }],
              [{ text: "👤 Профиль", callback_data: "cmd_profile" }],
              [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
            ]}}
          );
          return;
        }
        // ──────────────────────────────────────────────────────────────

      } catch {}
    });

    this.bot.on("polling_error", () => {});
  }

  // ── Per-user command menu ─────────────────────────────────────────────────
  private readonly TUTOR_COMMANDS: TelegramBot.BotCommand[] = [
    { command: "menu",     description: "📋 Главное меню" },
    { command: "today",    description: "📅 Расписание на сегодня" },
    { command: "week",     description: "🗓 Расписание на неделю" },
    { command: "next",     description: "⏭ Следующий урок" },
    { command: "students", description: "👥 Список учеников" },
    { command: "homework", description: "📝 ДЗ на проверке" },
    { command: "balance",  description: "💰 Балансы и долги" },
    { command: "stats",    description: "📊 Статистика" },
    { command: "ask",      description: "🤖 ИИ-ассистент" },
    { command: "profile",  description: "👤 Мой профиль" },
    { command: "help",     description: "❓ Все команды" },
    { command: "unlink",   description: "🔓 Отключить Telegram" },
  ];

  private readonly STUDENT_COMMANDS: TelegramBot.BotCommand[] = [
    { command: "menu",     description: "📋 Главное меню" },
    { command: "today",    description: "📅 Расписание на сегодня" },
    { command: "week",     description: "🗓 Расписание на неделю" },
    { command: "next",     description: "⏭ Следующий урок" },
    { command: "homework", description: "📝 Мои домашки" },
    { command: "grades",   description: "🎯 Мои оценки" },
    { command: "balance",  description: "💰 Мой баланс" },
    { command: "progress", description: "📈 Прогресс" },
    { command: "ask",      description: "🤖 ИИ-помощник" },
    { command: "profile",  description: "👤 Мой профиль" },
    { command: "help",     description: "❓ Все команды" },
    { command: "unlink",   description: "🔓 Отключить Telegram" },
  ];

  private async setMenuForRole(chatId: string, role: "tutor" | "student") {
    if (!this.bot) return;
    const commands = role === "tutor" ? this.TUTOR_COMMANDS : this.STUDENT_COMMANDS;
    await this.bot.setMyCommands(commands, {
      scope: { type: "chat", chat_id: Number(chatId) } as any,
    }).catch(() => {});
  }

  // Persistent reply keyboard — always visible at the bottom of the chat
  buildReplyKeyboard(role: "tutor" | "student"): TelegramBot.ReplyKeyboardMarkup {
    if (role === "tutor") {
      return {
        keyboard: [
          [{ text: "👥 Ученики"     }, { text: "📅 Занятия"     }],
          [{ text: "📝 Домашки"     }, { text: "💰 Финансы"     }],
          [{ text: "🤖 ИИ-помощник" }, { text: "❓ Помощь"      }],
          [{ text: "📋 Меню"        }],
        ],
        resize_keyboard: true,
        persistent: true,
      } as TelegramBot.ReplyKeyboardMarkup;
    }
    // Students use inline buttons only — no persistent reply keyboard
    return { remove_keyboard: true } as any;
  }

  // Mapping keyboard button labels → callback action
  private readonly KB_TO_SECTION: Record<string, string> = {
    // tutor keys
    "👥 Ученики":      "menu_students",
    "📅 Занятия":      "menu_lessons",
    "📝 Домашки":      "menu_homework",
    "💰 Финансы":      "menu_finance",
    // student keys (new)
    "📅 Расписание":   "s_schedule",
    "📝 Задания":      "s_tasks",
    "📈 Прогресс":     "s_progress",
    "💰 Баланс":       "s_balance",
    // shared
    "🤖 ИИ-помощник":  "menu_ai",
    "❓ Помощь":       "menu_help",
    "📋 Меню":         "cmd_menu",
  };
  // ─────────────────────────────────────────────────────────────────────────

  // ── In-memory state for multi-step flows (no DB round-trip) ─────────────
  private static readonly STATE_PREFIX = "tg_state_";
  private stateMap = new Map<string, Record<string, string>>();
  // Student list pagination: chatId → current page index
  private studentPageMap = new Map<string, number>();

  private async getTgState(chatId: string): Promise<Record<string, string> | null> {
    return this.stateMap.get(chatId) ?? null;
  }
  private async setTgState(chatId: string, state: Record<string, string>) {
    this.stateMap.set(chatId, state);
    // Also persist to DB so state survives bot restarts (fire-and-forget)
    storage.setAiSetting(`${PlatformBotManager.STATE_PREFIX}${chatId}`, JSON.stringify(state)).catch(() => {});
  }
  private async clearTgState(chatId: string) {
    this.stateMap.delete(chatId);
    storage.setAiSetting(`${PlatformBotManager.STATE_PREFIX}${chatId}`, "").catch(() => {});
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── App URL for deep links ─────────────────────────────────────────────
  private getAppUrl(): string {
    return appUrl();
  }
  // ─────────────────────────────────────────────────────────────────────────

  private async handleStart(chatId: string, text: string, tutor: Tutor | null, student: Student | null) {
    const payload = text.split(" ")[1] || "";

    // Deep link: tutor registration
    if (payload.startsWith("t_")) {
      const tutorId = payload.slice(2);
      await this.linkTutorById(chatId, tutorId);
      return;
    }

    // Deep link: student registration
    if (payload.startsWith("s_")) {
      const studentId = payload.slice(2);
      await this.linkStudentById(chatId, studentId);
      return;
    }

    // Already registered
    if (tutor) {
      await this.setMenuForRole(chatId, "tutor");
      await this.bot!.sendMessage(chatId,
        `⚡ <b>ТВОЙ ВЕКТОР</b>  ·  Система активна\n` +
        `══════════════════════\n` +
        `● <b>${tutor.name}</b>  <code>[ РЕПЕТИТОР ]</code>\n\n` +
        `Кнопки меню внизу — быстрый доступ к разделам.\n` +
        `<code>/help</code> — все команды  ·  <code>/menu</code> — навигация\n\n` +
        `<i>Уведомления подключены 🔔</i>`,
        { parse_mode: "HTML", reply_markup: this.buildReplyKeyboard("tutor") }
      );
      await this.sendMainMenu(chatId, "tutor");
      return;
    }

    if (student) {
      await this.setMenuForRole(chatId, "student");
      await this.bot!.sendMessage(chatId,
        `⚡ <b>ТВОЙ ВЕКТОР</b>  ·  Система активна\n` +
        `══════════════════════\n` +
        `● <b>${student.name}</b>  <code>[ УЧЕНИК ]</code>\n\n` +
        `Кнопки меню внизу — быстрый доступ к разделам.\n` +
        `<code>/help</code> — все команды  ·  <code>/menu</code> — навигация\n\n` +
        `<i>Уведомления подключены 🔔</i>`,
        { parse_mode: "HTML", reply_markup: this.buildReplyKeyboard("student") }
      );
      await this.sendMainMenu(chatId, "student");
      return;
    }

    // New user — code only
    await this.bot!.sendMessage(chatId,
      `⚡ <b>ТВОЙ ВЕКТОР</b>\n` +
      `══════════════════════\n` +
      `Платформа для репетиторов и учеников нового поколения.\n\n` +
      `◆ <b>КАК ПОДКЛЮЧИТЬСЯ</b>\n` +
      `  ▸ Зайдите на платформу\n` +
      `  ▸ Главная → кнопка <b>Подключить Telegram</b>\n` +
      `  ▸ Получите <code>6-значный код</code>\n` +
      `  ▸ Введите его в этот чат\n\n` +
      `<i>Код действует 15 минут · После ввода система активируется автоматически</i>`,
      { parse_mode: "HTML" }
    );
  }

  private async handleLinkCode(chatId: string, code: string, tutor: Tutor | null, student: Student | null) {
    const data = await this.consumeCode(code);
    if (!data) {
      // Another bot instance may have consumed this code milliseconds ago and
      // linked the account. Re-check before showing an error.
      await new Promise(r => setTimeout(r, 400));
      const nowTutor = await storage.getTutorByTelegramChatId(chatId);
      const nowStudent = nowTutor ? null : await storage.getStudentByTelegramChatId(chatId);
      if (nowTutor || nowStudent) return; // silently ignore — already linked

      await this.bot!.sendMessage(chatId,
        `⛔ <b>Код неверный или истёк</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Сгенерируйте новый код на сайте:\n<b>Твой Вектор → Профиль → Telegram</b>\n\n` +
        `Уже привязаны? Отправьте /start`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (data.type === "tutor") {
      const t = await storage.getTutor(data.id);
      if (!t) { await this.bot!.sendMessage(chatId, "⛔ Аккаунт репетитора не найден."); return; }
      await storage.updateTutor(data.id, { tutorChatId: chatId } as any);
      this.invalidateCache(chatId);
      await this.setMenuForRole(chatId, "tutor");
      await this.bot!.sendMessage(chatId,
        `✅ <b>ДОСТУП ОТКРЫТ</b>\n` +
        `══════════════════════\n` +
        `● <b>${t.name}</b>  <code>[ РЕПЕТИТОР ]</code>\n\n` +
        `◆ Telegram синхронизирован с платформой.\n` +
        `  ▸ Уведомления о занятиях — активны\n` +
        `  ▸ Сигналы о сданных ДЗ — активны\n` +
        `  ▸ Напоминания за 1 час — активны\n\n` +
        `<i>Кнопки меню внизу готовы к работе 🔔</i>`,
        { parse_mode: "HTML", reply_markup: this.buildReplyKeyboard("tutor") }
      );
      await this.sendMainMenu(chatId, "tutor");
    } else {
      const s = await storage.getStudent(data.id);
      if (!s) { await this.bot!.sendMessage(chatId, "⛔ Аккаунт ученика не найден."); return; }
      await storage.updateStudent(data.id, { telegramChatId: chatId } as any);
      this.invalidateCache(chatId);
      await this.setMenuForRole(chatId, "student");
      const tut = await this.dc_tutor(s.tutorId);
      await this.bot!.sendMessage(chatId,
        `✅ <b>ДОСТУП ОТКРЫТ</b>\n` +
        `══════════════════════\n` +
        `● <b>${s.name}</b>  <code>[ УЧЕНИК ]</code>\n` +
        `  ▸ Репетитор:  <b>${tut?.name || "—"}</b>\n\n` +
        `◆ Telegram синхронизирован с платформой.\n` +
        `  ▸ Новые задания — уведомления активны\n` +
        `  ▸ Оценки и комментарии — активны\n` +
        `  ▸ Напоминания о занятиях — активны\n\n` +
        `<i>Кнопки меню внизу готовы к работе 🔔</i>`,
        { parse_mode: "HTML", reply_markup: this.buildReplyKeyboard("student") }
      );
      await this.sendMainMenu(chatId, "student");
    }
  }

  private async linkTutorById(chatId: string, tutorId: string) {
    const tutor = await storage.getTutor(tutorId);
    if (!tutor) {
      await this.bot!.sendMessage(chatId, "⛔ Ссылка недействительна.");
      return;
    }
    await storage.updateTutor(tutorId, { tutorChatId: chatId } as any);
    this.invalidateCache(chatId);
    await this.setMenuForRole(chatId, "tutor");
    await this.bot!.sendMessage(chatId,
      `✅ <b>ДОСТУП ОТКРЫТ</b>\n` +
      `══════════════════════\n` +
      `● <b>${tutor.name}</b>  <code>[ РЕПЕТИТОР ]</code>\n\n` +
      `◆ Telegram синхронизирован с платформой.\n` +
      `  ▸ Уведомления о занятиях — активны\n` +
      `  ▸ Сигналы о сданных ДЗ — активны\n` +
      `  ▸ Напоминания за 1 час — активны\n\n` +
      `<i>Кнопки меню внизу готовы к работе 🔔</i>`,
      { parse_mode: "HTML", reply_markup: this.buildReplyKeyboard("tutor") }
    );
    await this.sendMainMenu(chatId, "tutor");
  }

  private async linkStudentById(chatId: string, studentId: string) {
    const student = await storage.getStudent(studentId);
    if (!student) {
      await this.bot!.sendMessage(chatId, "⛔ Ссылка недействительна или устарела.");
      return;
    }
    await storage.updateStudent(studentId, { telegramChatId: chatId } as any);
    this.invalidateCache(chatId);
    await this.setMenuForRole(chatId, "student");
    const tutor = await this.dc_tutor(student.tutorId);
    await this.bot!.sendMessage(chatId,
      `✅ <b>ДОСТУП ОТКРЫТ</b>\n` +
      `══════════════════════\n` +
      `● <b>${student.name}</b>  <code>[ УЧЕНИК ]</code>\n` +
      `  ▸ Репетитор:  <b>${tutor?.name || "—"}</b>\n\n` +
      `◆ Telegram синхронизирован с платформой.\n` +
      `  ▸ Новые задания — уведомления активны\n` +
      `  ▸ Оценки и комментарии — активны\n` +
      `  ▸ Напоминания о занятиях — активны\n\n` +
      `<i>Кнопки меню внизу готовы к работе 🔔</i>`,
      { parse_mode: "HTML", reply_markup: this.buildReplyKeyboard("student") }
    );
    await this.sendMainMenu(chatId, "student");
  }

  private async askToRegister(chatId: string) {
    await this.bot!.sendMessage(chatId,
      `🔐 Аккаунт не привязан.\n` +
      `Отправьте /start чтобы подключиться к платформе.`,
      { parse_mode: "HTML" }
    );
  }

  // ========================
  // UNLINK / RECONNECT
  // ========================

  private async handleUnlink(chatId: string, tutor: Tutor | null, student: Student | null) {
    if (!tutor && !student) {
      await this.askToRegister(chatId);
      return;
    }
    const name = tutor ? tutor.name : student!.name;
    const confirmCb = tutor ? "confirm_unlink_tutor" : "confirm_unlink_student";
    await this.bot!.sendMessage(chatId,
      `🔓 <b>ОТКЛЮЧЕНИЕ АККАУНТА</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<b>${name}</b> <code>[ ${tutor ? "РЕПЕТИТОР" : "УЧЕНИК"} ]</code>\n\n` +
      `Telegram будет отвязан. После этого вы сразу можете подключить другой аккаунт.\n\n` +
      `<i>Подтвердите отключение:</i>`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [
            { text: "🔓 Отключить", callback_data: confirmCb },
            { text: "❌ Отмена", callback_data: "cancel_unlink" }
          ]
        ]}
      }
    );
  }

  // ========================
  // TUTOR COMMANDS
  // ========================

  private async handleTodayTutor(chatId: string, tutor: Tutor) {
    const [lessons, students] = await Promise.all([
      this.dc_tutorLessons(tutor.id),
      this.dc_tutorStudents(tutor.id),
    ]);
    const tz = (tutor as any).timezone || "Europe/Moscow";
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: tz });

    const today = lessons
      .filter(l => new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz }) === todayStr)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const dateLabel = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });

    if (today.length === 0) {
      await this.bot!.sendMessage(chatId,
        `📅 <b>СЕГОДНЯ</b>  ·  <code>${dateLabel}</code>\n` +
        `══════════════════════\n\n` +
        `<i>Занятий нет — день свободен ✦</i>`,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [
            [{ text: "📆 Неделя", callback_data: "cmd_week" }, { text: "⏭ Следующее", callback_data: "cmd_next" }],
            [{ text: "📖 История", callback_data: "cmd_history" }, { text: "📝 ДЗ", callback_data: "cmd_homework" }],
            [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
          ]}
        }
      );
      return;
    }

    const completedCount = today.filter(l => l.status === "completed").length;
    const bar = "█".repeat(completedCount) + "░".repeat(today.length - completedCount);
    const lines = today.map((l) => {
      const st = students.find(s => s.id === l.studentId);
      const time = new Date(l.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
      const icon = l.status === "completed" ? "✦" : l.status === "cancelled" ? "✕" : "◈";
      return `${icon} <code>${time}</code>  <b>${st?.name || "—"}</b>\n    <i>${st?.subject || ""} · ${l.topic || "—"} · ${l.durationMinutes} мин</i>`;
    });

    // Per-lesson action buttons for pending lessons
    const lessonButtons: TelegramBot.InlineKeyboardButton[][] = today
      .filter(l => l.status === "pending")
      .map(l => {
        const st = students.find(s => s.id === l.studentId);
        const time = new Date(l.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
        return [
          { text: `✅ Проведено: ${time} — ${st?.name?.split(" ")[0] || ""}`, callback_data: `lesson_done_${l.id}` },
          { text: `❌ Отменено`, callback_data: `lesson_miss_${l.id}` },
        ];
      });

    await this.bot!.sendMessage(chatId,
      `📅 <b>СЕГОДНЯ</b>  ·  <code>${dateLabel}</code>\n` +
      `══════════════════════\n` +
      `<code>${bar}</code>  <code>${completedCount}/${today.length}</code> завершено\n\n` +
      lines.join("\n\n"),
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          ...lessonButtons,
          [{ text: "📆 Неделя", callback_data: "cmd_week" }, { text: "⏭ Следующее", callback_data: "cmd_next" }],
          [{ text: "📖 История", callback_data: "cmd_history" }, { text: "📝 ДЗ", callback_data: "cmd_homework" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  private async handleWeekTutor(chatId: string, tutor: Tutor) {
    const [lessons, students] = await Promise.all([
      this.dc_tutorLessons(tutor.id),
      this.dc_tutorStudents(tutor.id),
    ]);
    const tz = (tutor as any).timezone || "Europe/Moscow";
    const now = new Date();

    // Build 7 day slots starting from today
    const days: { label: string; dateStr: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      days.push({
        label: d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short", timeZone: tz }),
        dateStr: d.toLocaleDateString("sv-SE", { timeZone: tz }),
      });
    }

    const blocks: string[] = [];
    let totalLessons = 0;
    for (const day of days) {
      const dayLessons = lessons
        .filter(l => new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz }) === day.dateStr && l.status !== "cancelled")
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      if (dayLessons.length === 0) continue;
      totalLessons += dayLessons.length;
      const items = dayLessons.map(l => {
        const st = students.find(s => s.id === l.studentId);
        const time = new Date(l.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
        const icon = l.status === "completed" ? "✅" : "🕐";
        return `  ${icon} ${time} ${st?.name || "—"} · ${st?.subject || ""}`;
      });
      blocks.push(`<b>${day.label}</b>\n${items.join("\n")}`);
    }

    if (blocks.length === 0) {
      await this.bot!.sendMessage(chatId,
        `📆 <b>НЕДЕЛЯ</b>\n══════════════════════\n\n<i>Занятий на ближайшие 7 дней нет ✦</i>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
            [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "⏭ Следующее", callback_data: "cmd_next" }],
            [{ text: "📖 История", callback_data: "cmd_history" }],
            [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
          ]} }
      );
      return;
    }

    // Split into multiple messages if content is too long (Telegram limit = 4096 chars)
    const header = `📆 <b>НЕДЕЛЯ</b>  ·  <code>${totalLessons} занятий</code>\n══════════════════════\n\n`;
    const MAX_LEN = 3800;
    const navKeyboard = { inline_keyboard: [
      [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "⏭ Следующее", callback_data: "cmd_next" }],
      [{ text: "📖 История", callback_data: "cmd_history" }, { text: "📝 ДЗ", callback_data: "cmd_homework" }],
      [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
    ]};

    let currentChunk = header;
    let msgCount = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const addition = (currentChunk === header ? "" : "\n\n") + block;
      if (currentChunk.length + addition.length > MAX_LEN && currentChunk !== header) {
        // Send current chunk without nav keyboard (not the last)
        await this.bot!.sendMessage(chatId, currentChunk, { parse_mode: "HTML" });
        currentChunk = block;
        msgCount++;
      } else {
        currentChunk += addition;
      }
    }
    // Send last chunk with nav keyboard
    await this.bot!.sendMessage(chatId, currentChunk, { parse_mode: "HTML", reply_markup: navKeyboard });
  }

  private async handleHomeworkTutor(chatId: string, tutor: Tutor) {
    const [allHw, students] = await Promise.all([
      this.dc_tutorHomework(tutor.id),
      this.dc_tutorStudents(tutor.id),
    ]);
    const pending = allHw.filter((h: any) => h.status === "submitted");
    const assigned = allHw.filter((h: any) => h.status === "assigned");

    if (pending.length === 0) {
      await this.bot!.sendMessage(chatId,
        `📝 <b>ДЗ НА ПРОВЕРКЕ</b>\n══════════════════════\n\n` +
        `◆ Очередь пуста — всё проверено ✦\n` +
        `  ▸ Выдано заданий: <code>${assigned.length}</code>  ·  ожидают сдачи`,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [
            [{ text: "👥 Ученики", callback_data: "cmd_students" }, { text: "📅 Сегодня", callback_data: "cmd_today" }],
            [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
          ]}
        }
      );
      return;
    }

    const shown = pending.slice(0, 6);
    const lines = shown.map((h: any) => {
      const st = students.find(s => s.id === h.studentId);
      const date = h.submittedAt ? new Date(h.submittedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—";
      const sol = h.solutionText ? `\n    <i>«${h.solutionText.slice(0, 60)}${h.solutionText.length > 60 ? "…" : ""}»</i>` : "";
      return `◈ <b>${st?.name || "—"}</b>  ·  ${h.title}\n    <code>${date}</code>${sol}`;
    });

    // Grade buttons per item
    const gradeButtons: TelegramBot.InlineKeyboardButton[][] = shown.map((h: any) => ([
      { text: `⭐ Оценить: ${h.title.slice(0, 20)}`, callback_data: `hw_grade_${h.id}` },
    ]));

    await this.bot!.sendMessage(chatId,
      `📝 <b>ДЗ НА ПРОВЕРКЕ</b>  ·  <code>${pending.length}</code>\n══════════════════════\n\n` +
      lines.join("\n\n") +
      (pending.length > 6 ? `\n\n<i>… и ещё ${pending.length - 6}</i>` : ""),
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          ...gradeButtons,
          [{ text: "👥 Ученики", callback_data: "cmd_students" }, { text: "📊 Аналитика", callback_data: "cmd_stats" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  private async handleStudentsTutor(chatId: string, tutor: Tutor) {
    const students = await this.dc_tutorStudents(tutor.id);
    const active = students.filter(s => s.isActive);

    if (active.length === 0) {
      await this.bot!.sendMessage(chatId,
        `👥 <b>УЧЕНИКИ</b>\n══════════════════════\n\n<i>Активных учеников нет ✦</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const lines = active.map(s => {
      const tg = s.telegramChatId ? "●" : "○";
      return `${tg} <b>${s.name}</b>  ·  <i>${s.subject}, ${s.grade}</i>`;
    });

    const buttons = active.slice(0, 6).map(s => ([{
      text: `◈ ${s.name.split(" ")[0]}`,
      callback_data: `student_detail_${s.id}`
    }]));

    await this.bot!.sendMessage(chatId,
      `👥 <b>УЧЕНИКИ</b>  ·  <code>${active.length} активных</code>\n══════════════════════\n\n` +
      lines.join("\n") +
      `\n\n<i>● подключён к Telegram  /  ○ не подключён</i>`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          ...buttons,
          [{ text: "📝 ДЗ на проверке", callback_data: "cmd_homework" }, { text: "📊 Аналитика", callback_data: "cmd_stats" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  private async handleStudentDetail(chatId: string, tutor: Tutor, studentId: string) {
    const student = await storage.getStudent(studentId);
    if (!student || student.tutorId !== tutor.id) return;
    const [lessons, allHw] = await Promise.all([
      this.dc_studentLessons(student.id),
      this.dc_studentHomework(student.id),
    ]);
    const tz = (tutor as any).timezone || "Europe/Moscow";
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthLessons = lessons.filter(l => { const d = new Date(l.scheduledAt); return d >= monthStart && d < monthEnd && l.status === "completed"; });
    const totalLessons = lessons.filter(l => l.status === "completed");
    const pendingHW = allHw.filter(h => h.status === "submitted").length;
    const assignedHW = allHw.filter(h => h.status === "assigned").length;

    // Next 3 upcoming lessons
    const upcoming = lessons
      .filter(l => new Date(l.scheduledAt) > now && l.status === "pending")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 3);

    const balance = (student as any).balance || 0;
    const balStr = balance > 0 ? `🟢 +${balance.toLocaleString("ru-RU")} ₽`
                 : balance < 0 ? `🔴 −${Math.abs(balance).toLocaleString("ru-RU")} ₽`
                 : `✅ 0 ₽`;

    const price = (student as any).pricePerLesson;
    const priceStr = price ? `<code>${price.toLocaleString("ru-RU")} ₽/ч</code>` : "<i>не задана</i>";

    const upcomingLines = upcoming.length > 0
      ? upcoming.map(l => {
          const d = new Date(l.scheduledAt);
          const dateStr = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: tz });
          const timeStr = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
          return `    ◈ <code>${dateStr} ${timeStr}</code>  ${l.topic || "тема не задана"}`;
        }).join("\n")
      : "    <i>нет запланированных занятий</i>";

    const appUrl = this.getAppUrl();
    const tgIcon = student.telegramChatId ? "🟢 Telegram подключён" : "⚪ Telegram не подключён";

    // Build link buttons row (only if we have an app URL)
    const linkBtns: TelegramBot.InlineKeyboardButton[] = [];
    if (appUrl) {
      linkBtns.push({ text: "🖊 Доска", url: `${appUrl}/board/${student.id}` });
      linkBtns.push({ text: "📋 Программа", url: `${appUrl}/students` });
      linkBtns.push({ text: "📅 Расписание", url: `${appUrl}/schedule` });
    }

    // Compact homework progress bar
    const hwTotal = allHw.length;
    const hwDone = allHw.filter((h: any) => h.status === "reviewed" || h.status === "submitted").length;
    const hwPct = hwTotal > 0 ? Math.round((hwDone / hwTotal) * 100) : 0;
    const hwBar = "█".repeat(Math.round(hwPct / 12.5)) + "░".repeat(8 - Math.round(hwPct / 12.5));

    await this.bot!.sendMessage(chatId,
      `◈ <b>${student.name}</b>\n══════════════════════\n` +
      `📚 <code>${student.subject}</code>  ·  <i>${student.grade}</i>  ·  ${tgIcon}\n\n` +
      `◆ <b>ПРОГРАММА</b>\n` +
      `  💰  Стоимость: ${priceStr}\n\n` +
      `◆ <b>БЛИЖАЙШИЕ ЗАНЯТИЯ</b>\n` +
      upcomingLines + `\n\n` +
      `◆ <b>УСПЕВАЕМОСТЬ</b>\n` +
      `  📅  Занятий в месяце: <code>${monthLessons.length}</code>  · всего: <code>${totalLessons.length}</code>\n` +
      `  📝  ДЗ выдано: <code>${assignedHW}</code>  · на проверке: <code>${pendingHW}</code>\n` +
      (hwTotal > 0 ? `  <code>${hwBar}</code>  <code>${hwPct}%</code> выполнено\n` : "") +
      `\n◆ <b>ФИНАНСЫ</b>\n` +
      `  💰  Баланс:  ${balStr}`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          ...(linkBtns.length > 0 ? [linkBtns] : []),
          [{ text: "💰 Принять оплату", callback_data: `pay_s_${student.id}` },
           { text: "📝 Выдать ДЗ",     callback_data: `hw_assign_${student.id}` }],
          [{ text: "◀ К ученикам", callback_data: "menu_students" },
           { text: "🏠 Меню",      callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  private async handleStatsTutor(chatId: string, tutor: Tutor) {
    const [students, lessons, allHw] = await Promise.all([
      this.dc_tutorStudents(tutor.id),
      this.dc_tutorLessons(tutor.id),
      this.dc_tutorHomework(tutor.id),
    ]);
    const activeCount = students.filter(s => s.isActive).length;
    const tz = (tutor as any).timezone || "Europe/Moscow";

    const now = new Date();
    const todayStr = now.toLocaleDateString("sv-SE", { timeZone: tz });
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const todayCount = lessons.filter(l =>
      new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz }) === todayStr
    ).length;

    const monthCompleted = lessons.filter(l => {
      const d = new Date(l.scheduledAt);
      return d >= monthStart && d < monthEnd && l.status === "completed";
    });
    const prevMonthCompleted = lessons.filter(l =>
      new Date(l.scheduledAt) >= prevMonthStart && new Date(l.scheduledAt) < monthStart && l.status === "completed"
    );

    const monthIncome = monthCompleted.reduce((sum, l) => {
      const st = students.find(s => s.id === l.studentId);
      return sum + ((st as any)?.pricePerLesson || 0);
    }, 0);
    const prevIncome = prevMonthCompleted.reduce((sum, l) => {
      const st = students.find(s => s.id === l.studentId);
      return sum + ((st as any)?.pricePerLesson || 0);
    }, 0);

    const pendingHW = allHw.filter((h: any) => h.status === "submitted").length;
    const tgConnected = students.filter(s => s.isActive && s.telegramChatId).length;

    const incomeArrow = monthIncome >= prevIncome ? "▲" : "▼";
    const incomeDiff = Math.abs(monthIncome - prevIncome);

    await this.bot!.sendMessage(chatId,
      `📊 <b>АНАЛИТИКА</b>  ·  <code>[ РЕПЕТИТОР ]</code>\n══════════════════════\n\n` +
      `◆ АУДИТОРИЯ\n` +
      `  ▸ Учеников активных:  <code>${activeCount}</code>\n` +
      `  ▸ Подключено Telegram:  <code>${tgConnected}</code>\n` +
      `  ▸ Занятий сегодня:  <code>${todayCount}</code>\n\n` +
      `◆ ТЕКУЩИЙ МЕСЯЦ\n` +
      `  ▸ Занятий проведено:  <code>${monthCompleted.length}</code>\n` +
      `  ▸ Доход:  <code>${monthIncome.toLocaleString("ru-RU")} ₽</code>  ${incomeArrow} <i>${incomeDiff.toLocaleString("ru-RU")} ₽ к пр. мес.</i>\n\n` +
      `◆ ЗАДАНИЯ\n` +
      `  ▸ ДЗ на проверке:  <code>${pendingHW}</code>\n`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "💰 Финансы", callback_data: "cmd_balance" }, { text: "👥 Ученики", callback_data: "cmd_students" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  private async handleBalanceTutor(chatId: string, tutor: Tutor) {
    const [students, lessons, payments] = await Promise.all([
      this.dc_tutorStudents(tutor.id),
      this.dc_tutorLessons(tutor.id),
      this.dc_tutorPayments(tutor.id),
    ]);
    const active = students.filter(s => s.isActive);

    // Считаем сумму платежей и завершённых уроков по каждому ученику
    const paidMap = new Map<string, number>();
    for (const p of payments) {
      paidMap.set(p.studentId, (paidMap.get(p.studentId) || 0) + p.amount);
    }
    const doneMap = new Map<string, number>();
    for (const l of lessons) {
      if (l.status === "completed") {
        doneMap.set(l.studentId, (doneMap.get(l.studentId) || 0) + 1);
      }
    }

    // Реальный баланс = оплачено − стоимость завершённых уроков
    const getRealBalance = (s: any): number => {
      const totalPaid = paidMap.get(s.id) || 0;
      const totalOwed = (doneMap.get(s.id) || 0) * ((s as any).pricePerLesson || 0);
      return totalPaid - totalOwed;
    };

    // Сортируем: сначала должники, потом нулевые, потом с переплатой
    const withBalance = active.map(s => ({ s, bal: getRealBalance(s) }));
    withBalance.sort((a, b) => a.bal - b.bal); // от самого отрицательного к положительному

    const debtors = withBalance.filter(x => x.bal < 0);
    const zeros   = withBalance.filter(x => x.bal === 0);
    const prepaid = withBalance.filter(x => x.bal > 0);

    const totalDebt    = debtors.reduce((sum, x) => sum + Math.abs(x.bal), 0);
    const totalPrepaid = prepaid.reduce((sum, x) => sum + x.bal, 0);

    const lines: string[] = [];

    if (debtors.length > 0) {
      lines.push(`\n🔴 <b>ДОЛЖНИКИ</b>`);
      for (const { s, bal } of debtors) {
        const owed = Math.abs(bal);
        const done = doneMap.get(s.id) || 0;
        const paid = paidMap.get(s.id) || 0;
        lines.push(`  ▸ <b>${s.name}</b>  −${owed.toLocaleString("ru-RU")} ₽  <i>(${done} ур × ${(s as any).pricePerLesson} − ${paid.toLocaleString("ru-RU")} опл)</i>`);
      }
    }

    if (prepaid.length > 0) {
      lines.push(`\n🟢 <b>ПЕРЕПЛАТА / АВАНС</b>`);
      for (const { s, bal } of prepaid) {
        lines.push(`  ▸ <b>${s.name}</b>  +${bal.toLocaleString("ru-RU")} ₽`);
      }
    }

    if (zeros.length > 0) {
      lines.push(`\n✅ <b>В РАСЧЁТЕ</b>  (${zeros.length} уч.)`);
      if (zeros.length <= 5) {
        for (const { s } of zeros) lines.push(`  ▸ <b>${s.name}</b>`);
      }
    }

    await this.bot!.sendMessage(chatId,
      `💰 <b>ФИНАНСЫ</b>  ·  <code>[ РЕПЕТИТОР ]</code>\n══════════════════════\n` +
      `<i>Баланс = оплачено − стоимость завершённых уроков</i>\n` +
      (lines.length > 0 ? lines.join("\n") : `\n<i>Нет активных учеников</i>`) +
      `\n\n══════════════════════\n` +
      (totalDebt > 0     ? `  🔴 Итого должны:  <b>${totalDebt.toLocaleString("ru-RU")} ₽</b>\n` : "") +
      (totalPrepaid > 0  ? `  🟢 Итого аванс:  <b>${totalPrepaid.toLocaleString("ru-RU")} ₽</b>\n` : "") +
      `  ✅ В расчёте:  <code>${zeros.length}</code>  ·  Всего: <code>${active.length}</code> учеников`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📊 Аналитика", callback_data: "cmd_stats" }, { text: "👥 Ученики", callback_data: "cmd_students" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  private async handleNextTutor(chatId: string, tutor: Tutor) {
    const [lessons, students] = await Promise.all([
      this.dc_tutorLessons(tutor.id),
      this.dc_tutorStudents(tutor.id),
    ]);
    const tz = (tutor as any).timezone || "Europe/Moscow";
    const now = new Date();

    const upcoming = lessons
      .filter(l => new Date(l.scheduledAt) > now && l.status === "pending")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const next = upcoming[0];

    if (!next) {
      await this.bot!.sendMessage(chatId,
        `⏭ <b>СЛЕДУЮЩЕЕ ЗАНЯТИЕ</b>\n══════════════════════\n\n<i>Предстоящих занятий нет ✦</i>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
            [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "📆 Неделя", callback_data: "cmd_week" }],
            [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
          ]} }
      );
      return;
    }

    const st = students.find(s => s.id === next.studentId);
    const lessonTime = new Date(next.scheduledAt);
    const after = upcoming[1] ? students.find(s => s.id === upcoming[1].studentId) : null;
    const afterTime = upcoming[1] ? new Date(upcoming[1].scheduledAt) : null;

    await this.bot!.sendMessage(chatId,
      `⏭ <b>СЛЕДУЮЩЕЕ ЗАНЯТИЕ</b>\n══════════════════════\n\n` +
      `◆ УЧЕНИК\n` +
      `  ▸ <b>${st?.name || "—"}</b>  <code>${st?.subject || ""}</code>\n\n` +
      `◆ УРОК\n` +
      `  ▸ Тема:  <b>${next.topic || "не указана"}</b>\n` +
      `  ▸ Время:  <code>${formatDateTimeRu(lessonTime, tz)}</code>\n` +
      `  ▸ Через:  <i>${timeUntilStr(lessonTime, now)}</i>  ·  <code>${next.durationMinutes} мин</code>` +
      (after && afterTime ? `\n\n<i>Следом: ${after?.name || "—"} в ${afterTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz })}</i>` : ""),
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          ...( this.getAppUrl() ? [[
            { text: "🖊 Открыть доску", url: `${this.getAppUrl()}/board/${next.studentId}` },
          ]] : []),
          [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "📆 Неделя", callback_data: "cmd_week" }],
          [{ text: "📖 История", callback_data: "cmd_history" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  private async sendTutorHelp(chatId: string) {
    await this.bot!.sendMessage(chatId,
      `📘 <b>ГИД РЕПЕТИТОРА</b>  ·  <code>[ v2 ]</code>\n══════════════════════\n\n` +
      `◆ РАСПИСАНИЕ\n` +
      `  ▸ <code>/today</code>  —  занятия сегодня + кнопки ✅/❌\n` +
      `  ▸ <code>/week</code>  —  занятия на 7 дней вперёд\n` +
      `  ▸ <code>/next</code>  —  ближайший урок + доска 🖊\n` +
      `  ▸ <code>/history</code>  —  история занятий\n\n` +
      `◆ УЧЕНИКИ И ДЗ\n` +
      `  ▸ <code>/homework</code>  —  работы на проверке + ⭐ оценить\n` +
      `  ▸ <code>/students</code>  —  список + карточка + оплата\n\n` +
      `◆ ФИНАНСЫ И АНАЛИТИКА\n` +
      `  ▸ <code>/balance</code>  —  балансы всех учеников\n` +
      `  ▸ <code>/stats</code>  —  доход, занятия, сравнение\n\n` +
      `◆ ИИ И ПРОФИЛЬ\n` +
      `  ▸ <code>/ask [вопрос]</code>  —  GPT-4o ассистент\n` +
      `  ▸ <code>/profile</code>  —  мой профиль\n` +
      `  ▸ <code>/unlink</code>  —  переподключить Telegram\n\n` +
      `◆ АВТО-УВЕДОМЛЕНИЯ 🔔\n` +
      `  <i>Сдал ДЗ → сигнал + кнопка оценить\nЗанятие ✅ → ученик получает уведомление\nНапоминание за 1 час до урока</i>`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "📆 Неделя", callback_data: "cmd_week" }],
          [{ text: "📝 ДЗ", callback_data: "cmd_homework" }, { text: "📊 Аналитика", callback_data: "cmd_stats" }],
          [{ text: "💰 Финансы", callback_data: "cmd_balance" }, { text: "👥 Ученики", callback_data: "cmd_students" }],
        ]}
      }
    );
  }

  private async sendTutorProfile(chatId: string, tutor: Tutor) {
    const students = await this.dc_tutorStudents(tutor.id);
    const activeCount = students.filter(s => s.isActive).length;
    const tgCount = students.filter(s => s.isActive && s.telegramChatId).length;
    const sub = tutor.subscription === "premium" ? "💎 PREMIUM" : tutor.subscription === "pro" ? "⭐ PRO" : "FREE";

    await this.bot!.sendMessage(chatId,
      `👤 <b>МОЙ ПРОФИЛЬ</b>  ·  <code>[ РЕПЕТИТОР ]</code>\n══════════════════════\n\n` +
      `● <b>${tutor.name}</b>  <code>${sub}</code>\n\n` +
      `◆ ДАННЫЕ\n` +
      `  ▸ Email:  <code>${tutor.email}</code>\n` +
      `  ▸ Предметы:  <i>${(tutor.subjects || []).join(", ") || "—"}</i>\n\n` +
      `◆ УЧЕНИКИ\n` +
      `  ▸ Активных:  <code>${activeCount}</code>  ·  в Telegram: <code>${tgCount}</code>\n\n` +
      `<i>Смена аккаунта: <code>/unlink</code></i>`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📊 Статистика", callback_data: "cmd_stats" }, { text: "💰 Финансы", callback_data: "cmd_balance" }],
          [{ text: "🔓 Переподключить", callback_data: "confirm_unlink_tutor" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  // ========================
  // STUDENT COMMANDS
  // ========================

  private async handleTodayStudent(chatId: string, student: Student) {
    const [lessons, tutor] = await Promise.all([
      this.dc_studentLessons(student.id),
      this.dc_tutor(student.tutorId),
    ]);
    const tz = (tutor as any)?.timezone || "Europe/Moscow";
    const now = new Date();
    const todayStr = now.toLocaleDateString("sv-SE", { timeZone: tz });
    const dateLabel = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long", timeZone: tz });

    const today = lessons
      .filter(l => new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz }) === todayStr)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    const done = today.filter(l => l.status === "completed").length;

    if (today.length === 0) {
      await this.bot!.sendMessage(chatId,
        `📅 <b>РАСПИСАНИЕ НА СЕГОДНЯ</b>\n══════════════════════\n` +
        `<i>${dateLabel}</i>\n\n` +
        `✦  Занятий сегодня нет — день свободен`,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [
            [{ text: "⏭ Следующее занятие", callback_data: "cmd_next" }],
            [{ text: "📆 Расписание на неделю", callback_data: "cmd_week" }],
            [{ text: "📝 Задания",            callback_data: "cmd_homework" }],
            [{ text: "◀ Главное меню",        callback_data: "cmd_menu"    }],
          ]}
        }
      );
      return;
    }

    const lines = today.map(l => {
      const time = new Date(l.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
      const icon = l.status === "completed" ? "✦" : l.status === "cancelled" ? "✕" : "◈";
      const status = l.status === "completed" ? `<i> · проведено</i>` : l.status === "cancelled" ? `<i> · отменено</i>` : "";
      return `${icon} <code>${time}</code>  <b>${student.subject}</b>${status}\n    <i>${l.topic || "тема не указана"} · ${l.durationMinutes} мин</i>`;
    });

    await this.bot!.sendMessage(chatId,
      `📅 <b>РАСПИСАНИЕ НА СЕГОДНЯ</b>\n══════════════════════\n` +
      `<i>${dateLabel}</i>\n\n` +
      `◆ <b>ЗАНЯТИЙ:  <code>${done}/${today.length}</code></b>\n\n` +
      lines.join("\n\n"),
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "⏭ Следующее",    callback_data: "cmd_next"    },
           { text: "📆 Неделя",      callback_data: "cmd_week"    }],
          [{ text: "📖 История",     callback_data: "cmd_history" },
           { text: "📝 Задания",     callback_data: "cmd_homework"}],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu"   }],
        ]}
      }
    );
  }

  private async handleWeekStudent(chatId: string, student: Student) {
    const [lessons, tutor] = await Promise.all([
      this.dc_studentLessons(student.id),
      this.dc_tutor(student.tutorId),
    ]);
    const tz = (tutor as any)?.timezone || "Europe/Moscow";
    const now = new Date();

    const days: { label: string; dateStr: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      days.push({
        label: d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short", timeZone: tz }),
        dateStr: d.toLocaleDateString("sv-SE", { timeZone: tz }),
      });
    }

    const blocks: string[] = [];
    for (const day of days) {
      const dayLessons = lessons
        .filter(l => new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz }) === day.dateStr && l.status !== "cancelled")
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      if (dayLessons.length === 0) continue;
      const items = dayLessons.map(l => {
        const time = new Date(l.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
        return `  🕐 ${time}  ${student.subject} · ${l.topic || "тема не указана"}`;
      });
      blocks.push(`<b>${day.label}</b>\n${items.join("\n")}`);
    }

    if (blocks.length === 0) {
      await this.bot!.sendMessage(chatId,
        `📆 <b>НЕДЕЛЯ</b>\n══════════════════════\n\n<i>Занятий на ближайшие 7 дней нет ✦</i>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
            [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "⏭ Следующее", callback_data: "cmd_next" }],
            [{ text: "📝 Задания", callback_data: "cmd_homework" }],
            [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
          ]} }
      );
      return;
    }

    await this.bot!.sendMessage(chatId,
      `📆 <b>НЕДЕЛЯ</b>\n══════════════════════\n\n` + blocks.join("\n\n"),
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "⏭ Следующее", callback_data: "cmd_next" }],
          [{ text: "📖 История", callback_data: "cmd_history" }, { text: "📝 Задания", callback_data: "cmd_homework" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  private async handleHomeworkStudent(chatId: string, student: Student) {
    const allHw = await this.dc_studentHomework(student.id);
    const pending = allHw.filter(h => h.status === "assigned");
    const submitted = allHw.filter(h => h.status === "submitted");
    const graded = allHw.filter(h => h.status === "graded").slice(0, 3);

    if (allHw.length === 0) {
      await this.bot!.sendMessage(chatId,
        `📝 <b>МОИ ЗАДАНИЯ</b>\n══════════════════════\n\n✦  Заданий нет — отдыхай!`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
            [{ text: "📅 Сегодня",            callback_data: "cmd_today"    },
             { text: "⏭ Следующее занятие",   callback_data: "cmd_next"     }],
            [{ text: "◀ Главное меню",         callback_data: "cmd_menu"     }],
          ]} }
      );
      return;
    }

    const lines: string[] = [];
    if (pending.length > 0) {
      lines.push(`◆ <b>К ВЫПОЛНЕНИЮ</b>  <code>${pending.length}</code>`);
      pending.slice(0, 5).forEach(h => {
        const due = (h as any).dueDate
          ? `  <i>до ${new Date((h as any).dueDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</i>` : "";
        lines.push(`  🔴 <b>${h.title}</b>${due}`);
      });
    }
    if (submitted.length > 0) {
      if (lines.length) lines.push("");
      lines.push(`◆ <b>НА ПРОВЕРКЕ</b>  <code>${submitted.length}</code>`);
      submitted.slice(0, 3).forEach(h => lines.push(`  🟡 ${h.title}  <i>ждёт оценки…</i>`));
    }
    if (graded.length > 0) {
      if (lines.length) lines.push("");
      lines.push(`◆ <b>ПРОВЕРЕНО</b>  <i>(последние)</i>`);
      graded.forEach(h => {
        const grade = (h as any).grade ? `  <code>${(h as any).grade}/10</code>` : "";
        lines.push(`  ✦ ${h.title}${grade}`);
      });
    }

    const submitButtons: TelegramBot.InlineKeyboardButton[][] = pending.slice(0, 4).map(h => ([
      { text: `📤 Сдать: ${h.title.slice(0, 28)}`, callback_data: `hw_ss_${h.id}` },
    ]));

    await this.bot!.sendMessage(chatId,
      `📝 <b>МОИ ЗАДАНИЯ</b>\n══════════════════════\n\n` + lines.join("\n"),
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          ...submitButtons,
          [{ text: "🏅 Оценки",    callback_data: "cmd_grades"   },
           { text: "📈 Прогресс",  callback_data: "cmd_progress" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu"   }],
        ]}
      }
    );
  }

  private async handleNextStudent(chatId: string, student: Student) {
    const [lessons, tutor] = await Promise.all([
      this.dc_studentLessons(student.id),
      this.dc_tutor(student.tutorId),
    ]);
    const tz = (tutor as any)?.timezone || "Europe/Moscow";
    const now = new Date();

    const upcoming = lessons
      .filter(l => new Date(l.scheduledAt) > now && l.status === "pending")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const next = upcoming[0];

    if (!next) {
      await this.bot!.sendMessage(chatId,
        `⏭ <b>СЛЕДУЮЩЕЕ ЗАНЯТИЕ</b>\n══════════════════════\n\n<i>Предстоящих занятий нет ✦</i>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
            [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "📝 Задания", callback_data: "cmd_homework" }],
            [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
          ]} }
      );
      return;
    }

    const lessonTime = new Date(next.scheduledAt);
    await this.bot!.sendMessage(chatId,
      `⏭ <b>СЛЕДУЮЩЕЕ ЗАНЯТИЕ</b>\n══════════════════════\n\n` +
      `◆ УРОК\n` +
      `  ▸ Предмет:  <code>${student.subject}</code>\n` +
      `  ▸ Тема:  <b>${next.topic || "не указана"}</b>\n` +
      `  ▸ Репетитор:  <b>${tutor?.name || "—"}</b>\n\n` +
      `◆ ВРЕМЯ\n` +
      `  ▸ Дата:  <code>${formatDateTimeRu(lessonTime, tz)}</code>\n` +
      `  ▸ Через:  <i>${timeUntilStr(lessonTime, now)}</i>  ·  <code>${next.durationMinutes} мин</code>`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          ...( this.getAppUrl() ? [[
            { text: "🖊 Открыть доску", url: `${this.getAppUrl()}/board/${student.id}` },
          ]] : []),
          [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "📆 Неделя", callback_data: "cmd_week" }],
          [{ text: "📖 История", callback_data: "cmd_history" }, { text: "📝 Задания", callback_data: "cmd_homework" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  private async handleProgressStudent(chatId: string, student: Student) {
    const [lessons, allHw, payments] = await Promise.all([
      this.dc_studentLessons(student.id),
      this.dc_studentHomework(student.id),
      storage.getPaymentsByStudentId(student.id, 100),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const totalCompleted = lessons.filter(l => l.status === "completed").length;
    const monthCompleted = lessons.filter(l => {
      const d = new Date(l.scheduledAt); return d >= monthStart && d < monthEnd && l.status === "completed";
    }).length;
    const totalHw = allHw.length;
    const doneHw = allHw.filter(h => h.status === "graded" || h.status === "submitted").length;
    const pendingHw = allHw.filter(h => h.status === "assigned").length;
    const graded = allHw.filter(h => h.status === "graded" && (h as any).grade);
    const avgGrade = graded.length > 0
      ? (graded.reduce((s, h) => s + ((h as any).grade || 0), 0) / graded.length).toFixed(1)
      : "—";

    const hwPct = totalHw > 0 ? Math.round((doneHw / totalHw) * 100) : 0;
    const hwBar = "█".repeat(Math.round(hwPct / 10)) + "░".repeat(10 - Math.round(hwPct / 10));
    const lessonPct = totalCompleted > 0 ? Math.min(100, Math.round((monthCompleted / Math.max(1, totalCompleted / Math.max(1, new Date().getMonth() + 1))) * 100)) : 0;

    // Real balance
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const pricePerLesson = (student as any).pricePerLesson || 0;
    const realBalance = totalPaid - totalCompleted * pricePerLesson;
    const balStr = realBalance > 0 ? `🟢 +${realBalance.toLocaleString("ru-RU")} ₽` :
                   realBalance < 0 ? `🔴 −${Math.abs(realBalance).toLocaleString("ru-RU")} ₽` : `✅ 0 ₽`;

    const monthLabel = now.toLocaleDateString("ru-RU", { month: "long" });

    await this.bot!.sendMessage(chatId,
      `📈 <b>МОЙ ПРОГРЕСС</b>\n══════════════════════\n` +
      `<code>${student.subject}</code>` + ((student as any).grade ? `  ·  <i>${(student as any).grade}</i>` : "") + `\n\n` +
      `◆ <b>ЗАНЯТИЯ</b>\n` +
      `  ▸ Всего проведено:  <code>${totalCompleted}</code>\n` +
      `  ▸ В ${monthLabel}:  <code>${monthCompleted}</code>\n\n` +
      `◆ <b>ЗАДАНИЯ</b>\n` +
      `  <code>${hwBar}</code>  <code>${hwPct}%</code>\n` +
      `  ▸ Всего выдано:  <code>${totalHw}</code>\n` +
      `  ▸ Выполнено:  <code>${doneHw}</code>` +
      (pendingHw > 0 ? `  ·  <b>не сдано: ${pendingHw} 🔔</b>` : `  ✦`) + `\n` +
      (graded.length > 0 ? `  ▸ Средний балл:  <code>${avgGrade}/10</code>\n` : "") +
      `\n◆ <b>БАЛАНС</b>\n` +
      `  ▸ ${balStr}`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📝 Задания",    callback_data: "s_tasks"      },
           { text: "🏅 Оценки",    callback_data: "cmd_grades"   }],
          [{ text: "📋 Программа", callback_data: "s_programme"  },
           { text: "💰 Баланс",    callback_data: "s_balance"    }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu"  }],
        ]}
      }
    );
  }

  private async handleGradesStudent(chatId: string, student: Student) {
    const allHw = await this.dc_studentHomework(student.id);
    const graded = allHw.filter(h => h.status === "graded" && (h as any).grade).slice(0, 10);

    if (graded.length === 0) {
      await this.bot!.sendMessage(chatId,
        `🏅 <b>МОИ ОЦЕНКИ</b>\n══════════════════════\n\n✦  Проверенных работ с оценками пока нет`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
            [{ text: "📝 Задания",   callback_data: "cmd_homework" },
             { text: "📈 Прогресс", callback_data: "cmd_progress" }],
            [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
          ]} }
      );
      return;
    }

    const gradeIcon = (g: number) => g >= 9 ? "🟢" : g >= 7 ? "🟡" : "🔴";
    const lines = graded.map(h => {
      const g = (h as any).grade || 0;
      const stars = "★".repeat(Math.round(g / 2)) + "☆".repeat(5 - Math.round(g / 2));
      const comment = (h as any).tutorComment ? `\n    <i>«${(h as any).tutorComment}»</i>` : "";
      return `${gradeIcon(g)} <code>${g}/10</code>  <code>${stars}</code>  <b>${h.title}</b>${comment}`;
    });

    const avg = (graded.reduce((s, h) => s + ((h as any).grade || 0), 0) / graded.length).toFixed(1);
    const avgStars = "★".repeat(Math.round(parseFloat(avg) / 2)) + "☆".repeat(5 - Math.round(parseFloat(avg) / 2));

    await this.bot!.sendMessage(chatId,
      `🏅 <b>МОИ ОЦЕНКИ</b>\n══════════════════════\n` +
      `Среднее:  <code>${avg}/10</code>  <code>${avgStars}</code>\n\n` +
      lines.join("\n\n"),
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📝 Задания",    callback_data: "s_tasks"    },
           { text: "📈 Прогресс",  callback_data: "s_progress" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  private async sendStudentHelp(chatId: string) {
    await this.bot!.sendMessage(chatId,
      `❓ <b>ГИД УЧЕНИКА</b>\n══════════════════════\n\n` +
      `<b>Все разделы доступны через кнопки главного меню.</b>\n\n` +
      `◆ <b>РАСПИСАНИЕ</b>  📅\n` +
      `  ▸ Занятия сегодня и на неделю\n` +
      `  ▸ Следующий урок с обратным отсчётом\n` +
      `  ▸ История проведённых занятий\n\n` +
      `◆ <b>ЗАДАНИЯ</b>  📝\n` +
      `  ▸ Список заданий по статусам\n` +
      `  ▸ Кнопка 📤 Сдать прямо в боте\n` +
      `  ▸ Оценки с комментариями репетитора\n` +
      `  ▸ Прогресс и статистика\n\n` +
      `◆ <b>БАЛАНС</b>  💰\n` +
      `  ▸ Расчёт долга / переплаты\n` +
      `  ▸ История платежей\n\n` +
      `◆ <b>ИИ-ПОМОЩНИК</b>  🤖\n` +
      `  ▸ Напишите любой вопрос прямо в чат\n` +
      `  ▸ Или нажмите «🤖 ИИ-помощник»\n\n` +
      `◆ <b>УВЕДОМЛЕНИЯ</b>  🔔  <i>(автоматически)</i>\n` +
      `  ▸ Новое задание от репетитора\n` +
      `  ▸ Оценка и комментарий к работе\n` +
      `  ▸ Напоминание за 1 час до занятия`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📅 Расписание",  callback_data: "s_schedule"  },
           { text: "📝 Задания",     callback_data: "s_tasks"     }],
          [{ text: "📈 Прогресс",    callback_data: "s_progress"  },
           { text: "🤖 ИИ-помощник", callback_data: "menu_ai"    }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu"   }],
        ]}
      }
    );
  }

  private async sendStudentProfile(chatId: string, student: Student) {
    const [tutor, lessons, allHw, payments] = await Promise.all([
      this.dc_tutor(student.tutorId),
      this.dc_studentLessons(student.id),
      this.dc_studentHomework(student.id),
      storage.getPaymentsByStudentId(student.id, 100),
    ]);
    const completedLessons = lessons.filter(l => l.status === "completed").length;
    const totalHw = allHw.length;
    const doneHw = allHw.filter(h => h.status === "graded" || h.status === "submitted").length;
    const pendingHw = allHw.filter(h => h.status === "assigned").length;
    const graded = allHw.filter(h => h.status === "graded" && (h as any).grade);
    const avgGrade = graded.length > 0
      ? (graded.reduce((s, h) => s + ((h as any).grade || 0), 0) / graded.length).toFixed(1)
      : "—";
    const hwPct = totalHw > 0 ? Math.round((doneHw / totalHw) * 100) : 0;
    const hwBar = "█".repeat(Math.round(hwPct / 10)) + "░".repeat(10 - Math.round(hwPct / 10));
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const pricePerLesson = (student as any).pricePerLesson || 0;
    const realBalance = totalPaid - completedLessons * pricePerLesson;
    const balStr = realBalance > 0 ? `🟢 +${realBalance.toLocaleString("ru-RU")} ₽` :
                   realBalance < 0 ? `🔴 −${Math.abs(realBalance).toLocaleString("ru-RU")} ₽` : `✅ 0 ₽`;

    await this.bot!.sendMessage(chatId,
      `👤 <b>МОЙ ПРОФИЛЬ</b>\n══════════════════════\n\n` +
      `● <b>${student.name}</b>\n\n` +
      `◆ <b>ОБУЧЕНИЕ</b>\n` +
      `  ▸ Предмет:  <code>${student.subject}</code>` + ((student as any).grade ? `  ·  <i>${(student as any).grade}</i>` : "") + `\n` +
      `  ▸ Репетитор:  <b>${tutor?.name || "—"}</b>\n` +
      (pricePerLesson > 0 ? `  ▸ Стоимость урока:  <code>${pricePerLesson.toLocaleString("ru-RU")} ₽</code>\n` : "") +
      `\n◆ <b>ПРОГРЕСС</b>\n` +
      `  ▸ Занятий проведено:  <code>${completedLessons}</code>\n` +
      `  ▸ Задания:  <code>${hwBar}</code>  <code>${hwPct}%</code>\n` +
      `  ▸ Выдано: <code>${totalHw}</code>  ·  выполнено: <code>${doneHw}</code>` +
      (pendingHw > 0 ? `  ·  <b>не сдано: ${pendingHw} 🔔</b>` : "") + `\n` +
      (graded.length > 0 ? `  ▸ Средний балл:  <code>${avgGrade}/10</code>\n` : "") +
      `\n◆ <b>БАЛАНС</b>\n` +
      `  ▸ ${balStr}\n\n` +
      `<i>Отключить Telegram: /unlink</i>`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📈 Прогресс",    callback_data: "s_progress"  },
           { text: "🏅 Оценки",      callback_data: "cmd_grades"  }],
          [{ text: "📋 Программа",   callback_data: "s_programme" },
           { text: "💰 Баланс",      callback_data: "s_balance"   }],
          [{ text: "🔓 Переподключить", callback_data: "confirm_unlink_student" }],
          [{ text: "◀ Главное меню",  callback_data: "cmd_menu"   }],
        ]}
      }
    );
  }

  // ========================
  // INLINE MENU NAVIGATION
  // ========================

  // Back row reused in every section
  private readonly BACK_ROW = [{ text: "◀ Главное меню", callback_data: "cmd_menu" }];

  private buildMainMenuKeyboard(role: "tutor" | "student"): TelegramBot.InlineKeyboardMarkup {
    const base = this.getAppUrl();
    if (role === "tutor") {
      return { inline_keyboard: [
        [{ text: "👥 Ученики",    callback_data: "menu_students" },
         { text: "📅 Занятия",    callback_data: "menu_lessons"  }],
        [{ text: "📝 Домашки",    callback_data: "menu_homework" },
         { text: "💰 Финансы",    callback_data: "menu_finance"  }],
        [{ text: "🤖 ИИ-помощник",callback_data: "menu_ai"       },
         { text: "❓ Помощь",     callback_data: "menu_help"     }],
        [{ text: "📹 Конференции", url: `${base}/bbb` },
         { text: "🖊 Доски",       url: `${base}/boards` }],
      ]};
    }
    const studentRows: TelegramBot.InlineKeyboardButton[][] = [];
    // Mini App открывает кабинет ученика прямо внутри Telegram (только https).
    if (base && /^https:\/\//i.test(base)) {
      studentRows.push([
        { text: "🎓 Открыть кабинет", web_app: { url: `${base}/student?from=tg` } as any } as any,
      ]);
    }
    studentRows.push(
      [{ text: "📅 Расписание",  callback_data: "s_schedule"  },
       { text: "📝 Задания",     callback_data: "s_tasks"     }],
      [{ text: "📈 Прогресс",    callback_data: "s_progress"  },
       { text: "💰 Баланс",      callback_data: "s_balance"   }],
      [{ text: "🎯 Тренажёр",    callback_data: "s_quiz"      },
       { text: "📋 Программа",   callback_data: "s_programme" }],
      [{ text: "🤖 ИИ-помощник", callback_data: "menu_ai"     }],
      [{ text: "📹 Конференции",  url: `${base}/student/conference` },
       { text: "🖊 Доска",        url: `${base}/student/board` }],
    );
    return { inline_keyboard: studentRows };
  }

  async sendMainMenu(chatId: string, role: "tutor" | "student", msgId?: number): Promise<void> {
    const isTutor = role === "tutor";
    let text: string;
    try {
      if (isTutor) {
        // Fetch tutor stats
        const { tutor } = await this.getCachedUser(chatId);
        if (!tutor) throw new Error("no tutor");
        const [students, lessons, allHw] = await Promise.all([
          this.dc_tutorStudents(tutor.id),
          this.dc_tutorLessons(tutor.id),
          this.dc_tutorHomework(tutor.id),
        ]);
        const active = students.filter(s => s.isActive);
        const tz = (tutor as any).timezone || "Europe/Moscow";
        const now = new Date();
        const todayStr = now.toLocaleDateString("sv-SE", { timeZone: tz });
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const dateLabel = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: tz });
        const monthLabel = now.toLocaleDateString("ru-RU", { month: "long", timeZone: tz });

        const todayLessons = lessons.filter(l =>
          new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz }) === todayStr
        );
        const todayDone = todayLessons.filter(l => l.status === "completed").length;

        const monthLessons = lessons.filter(l => { const d = new Date(l.scheduledAt); return d >= monthStart && d < monthEnd; });
        const monthDone = monthLessons.filter(l => l.status === "completed");
        const monthTotal = monthLessons.filter(l => l.status !== "cancelled");

        const calcIncome = (ls: typeof lessons) => ls.reduce((s, l) => {
          const st = active.find(x => x.id === l.studentId);
          return s + ((st as any)?.pricePerLesson || 0);
        }, 0);
        const todayIncome = calcIncome(todayLessons.filter(l => l.status === "completed"));
        const todayTarget = calcIncome(todayLessons.filter(l => l.status !== "cancelled"));
        const monthIncome = calcIncome(monthDone);
        const monthTarget = calcIncome(monthTotal);

        const pendingHW = allHw.filter((h: any) => h.status === "submitted").length;
        const nextLesson = lessons
          .filter(l => new Date(l.scheduledAt) > now && l.status === "pending")
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
        const nextTime = nextLesson
          ? new Date(nextLesson.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz })
          : null;

        // Progress bar builders
        const makeBar = (done: number, total: number, len = 10) => {
          if (total === 0) return "──────────";
          const fill = Math.round((done / total) * len);
          return "█".repeat(fill) + "░".repeat(len - fill);
        };
        const pct = (done: number, total: number) =>
          total === 0 ? "0%" : `${Math.round((done / total) * 100)}%`;

        const todayBar = makeBar(todayDone, todayLessons.length, 8);
        const monthBar = makeBar(monthDone.length, monthTotal.length, 8);
        const todayIncomeBar = makeBar(todayIncome, todayTarget, 8);
        const monthIncomeBar = makeBar(monthIncome, monthTarget, 8);

        const nextLessonStudent = nextLesson
          ? active.find(x => x.id === nextLesson.studentId)
          : null;

        const tgConnectedCount = active.filter(s => s.telegramChatId).length;
        const weekDayName = new Date().toLocaleDateString("ru-RU", { weekday: "long", timeZone: tz });

        text =
          `⚡ <b>ТВОЙ ВЕКТОР</b>  ·  <code>[ РЕПЕТИТОР ]</code>\n` +
          `══════════════════════\n` +
          `📆 <b>${weekDayName.charAt(0).toUpperCase() + weekDayName.slice(1)}, ${dateLabel}</b>\n\n` +

          `◆ <b>СЕГОДНЯ</b>\n` +
          `  👥  Учеников активных:  <code>${active.length}</code>` +
          (tgConnectedCount > 0 ? `  ·  TG: <code>${tgConnectedCount}</code>` : "") + `\n` +
          `  📅  Занятий:  <code>${todayDone}/${todayLessons.length}</code>` +
          (todayLessons.length > 0 ? `\n  <code>${todayBar}</code>  <code>${pct(todayDone, todayLessons.length)}</code>` : "") +
          (nextTime
            ? `\n  ⏰  Следующее:  <b>${nextTime}</b>${nextLessonStudent ? ` — ${nextLessonStudent.name.split(" ")[0]}` : ""}`
            : "") + `\n` +
          (todayTarget > 0
            ? `  💰  Сегодня:  <code>${todayIncome.toLocaleString("ru-RU")} ₽</code> из <code>${todayTarget.toLocaleString("ru-RU")} ₽</code>\n  <code>${todayIncomeBar}</code>  <code>${pct(todayIncome, todayTarget)}</code>\n`
            : "") +

          `\n◆ <b>${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</b>\n` +
          `  📅  Занятий:  <code>${monthDone.length}/${monthTotal.length}</code>\n` +
          `  <code>${monthBar}</code>  <code>${pct(monthDone.length, monthTotal.length)}</code>\n` +
          (monthTarget > 0
            ? `  💰  Заработано:  <code>${monthIncome.toLocaleString("ru-RU")} ₽</code> из <code>${monthTarget.toLocaleString("ru-RU")} ₽</code>\n  <code>${monthIncomeBar}</code>  <code>${pct(monthIncome, monthTarget)}</code>\n`
            : "") +

          `\n◆ <b>ЗАДАЧИ</b>\n` +
          `  📝  На проверке:  ` + (pendingHW > 0 ? `<b>${pendingHW}</b> 🔔` : `<i>всё проверено ✦</i>`);
      } else {
        // Fetch student stats
        const { student } = await this.getCachedUser(chatId);
        if (!student) throw new Error("no student");
        const [lessons, tutor, allHw, payments] = await Promise.all([
          this.dc_studentLessons(student.id),
          this.dc_tutor(student.tutorId),
          this.dc_studentHomework(student.id),
          storage.getPaymentsByStudentId(student.id, 100),
        ]);
        const tz = (tutor as any)?.timezone || "Europe/Moscow";
        const now = new Date();
        const todayStr = now.toLocaleDateString("sv-SE", { timeZone: tz });
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const dateLabel = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: tz });
        const weekDayName = now.toLocaleDateString("ru-RU", { weekday: "long", timeZone: tz });

        const todayLessons = lessons.filter(l =>
          new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz }) === todayStr
        );
        const todayDone = todayLessons.filter(l => l.status === "completed").length;
        const nextLesson = lessons
          .filter(l => new Date(l.scheduledAt) > now && l.status === "pending")
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
        const nextTime = nextLesson
          ? new Date(nextLesson.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz })
          : null;
        const nextDateLabel = nextLesson
          ? new Date(nextLesson.scheduledAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: tz })
          : null;

        const monthDone = lessons.filter(l => {
          const d = new Date(l.scheduledAt); return d >= monthStart && d < monthEnd && l.status === "completed";
        });
        const totalCompleted = lessons.filter(l => l.status === "completed").length;
        const pendingHW = allHw.filter(h => h.status === "assigned").length;
        const allHwLen = allHw.length;
        const doneHwLen = allHw.filter(h => h.status === "graded" || h.status === "submitted").length;
        const hwPct = allHwLen > 0 ? Math.round((doneHwLen / allHwLen) * 100) : 0;
        const hwBar = "█".repeat(Math.round(hwPct / 10)) + "░".repeat(10 - Math.round(hwPct / 10));

        // Compute real balance
        const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
        const pricePerLesson = (student as any).pricePerLesson || 0;
        const totalOwed = totalCompleted * pricePerLesson;
        const realBalance = totalPaid - totalOwed;
        const balStr = realBalance > 0  ? `🟢 Переплата: <b>+${realBalance.toLocaleString("ru-RU")} ₽</b>` :
                       realBalance < 0  ? `🔴 Долг: <b>−${Math.abs(realBalance).toLocaleString("ru-RU")} ₽</b>` :
                                          `✅ Расчёты закрыты`;

        text =
          `🎓 <b>ТВОЙ ВЕКТОР</b>  ·  <code>[ УЧЕНИК ]</code>\n` +
          `══════════════════════\n` +
          `📆 <b>${weekDayName.charAt(0).toUpperCase() + weekDayName.slice(1)}, ${dateLabel}</b>\n\n` +

          `◆ <b>ПРОФИЛЬ</b>\n` +
          `  📚  <code>${student.subject}</code>` + ((student as any).grade ? `  ·  <i>${(student as any).grade}</i>` : "") + `\n` +
          `  👤  Репетитор:  <b>${tutor?.name || "—"}</b>\n\n` +

          `◆ <b>СЕГОДНЯ</b>\n` +
          (todayLessons.length > 0
            ? `  📅  Занятий:  <code>${todayDone}/${todayLessons.length}</code>\n`
            : `  📅  Занятий нет — день свободен ✦\n`) +
          (nextTime
            ? `  ⏰  Следующее:  <b>${nextTime}</b>` +
              (nextDateLabel && nextDateLabel !== dateLabel ? `  <i>(${nextDateLabel})</i>` : `  <i>(сегодня)</i>`)
            : `  ⏰  Предстоящих занятий нет`) +
          `\n\n` +

          `◆ <b>УЧЁБА</b>\n` +
          `  📅  В этом месяце:  <code>${monthDone.length}</code>  ·  всего: <code>${totalCompleted}</code>\n` +
          `  📝  Задания:  <code>${hwBar}</code>  <code>${hwPct}%</code>\n` +
          (pendingHW > 0 ? `  🔔  Не сдано:  <b>${pendingHW}</b>\n` : `  ✦  Все задания сданы\n`) +
          `\n` +

          `◆ <b>БАЛАНС</b>\n` +
          `  ▸ ${balStr}`;
      }
    } catch {
      // Fallback if stats unavailable
      text = isTutor
        ? `⚡ <b>ТВОЙ ВЕКТОР</b>  ·  <code>[ РЕПЕТИТОР ]</code>\n══════════════════════\n\nВыберите раздел:`
        : `⚡ <b>ТВОЙ ВЕКТОР</b>  ·  <code>[ УЧЕНИК ]</code>\n══════════════════════\n\nВыберите раздел:`;
    }
    const kb = this.buildMainMenuKeyboard(role);
    if (msgId) {
      await this.bot!.editMessageText(text, {
        chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: kb,
      }).catch(() => this.bot!.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: kb }));
    } else {
      await this.bot!.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: kb });
    }
  }

  // ── NEW: Paginated student list ──────────────────────────────────────────
  private async handleStudentsList(chatId: string, tutor: Tutor, page: number) {
    const students = await this.dc_tutorStudents(tutor.id);
    const active = students
      .filter(s => s.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));

    const PAGE_SIZE = 6;
    const totalPages = Math.ceil(active.length / PAGE_SIZE) || 1;
    const pg = Math.max(0, Math.min(page, totalPages - 1));
    this.studentPageMap.set(chatId, pg);

    if (active.length === 0) {
      await this.bot!.sendMessage(chatId,
        `👥 <b>УЧЕНИКИ</b>\n══════════════════════\n\n<i>Активных учеников нет ✦</i>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "◀ Главное меню", callback_data: "cmd_menu" }]] } }
      );
      return;
    }

    const pageStudents = active.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE);
    const lines = pageStudents.map(s => {
      const tg = s.telegramChatId ? "●" : "○";
      return `${tg} <b>${s.name}</b>  <code>${s.subject}</code>  <i>${s.grade}</i>`;
    });

    // Student buttons (2 per row)
    const studentBtns: TelegramBot.InlineKeyboardButton[][] = [];
    for (let i = 0; i < pageStudents.length; i += 2) {
      const row: TelegramBot.InlineKeyboardButton[] = [
        { text: pageStudents[i].name.split(" ")[0], callback_data: `student_detail_${pageStudents[i].id}` },
      ];
      if (pageStudents[i + 1]) {
        row.push({ text: pageStudents[i + 1].name.split(" ")[0], callback_data: `student_detail_${pageStudents[i + 1].id}` });
      }
      studentBtns.push(row);
    }

    // Pagination row
    const navRow: TelegramBot.InlineKeyboardButton[] = [];
    if (pg > 0) navRow.push({ text: "◀ Назад", callback_data: `st_pg_${pg - 1}` });
    navRow.push({ text: `${pg + 1} / ${totalPages}`, callback_data: `st_pg_${pg}` });
    if (pg < totalPages - 1) navRow.push({ text: "Вперёд ▶", callback_data: `st_pg_${pg + 1}` });

    await this.bot!.sendMessage(chatId,
      `👥 <b>УЧЕНИКИ</b>  ·  <code>${active.length} активных</code>  ·  стр. <code>${pg + 1}/${totalPages}</code>\n` +
      `══════════════════════\n\n` +
      lines.join("\n") +
      `\n\n<i>● Telegram подключён  /  ○ не подключён</i>`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          ...studentBtns,
          navRow,
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  // ── NEW: Lessons section (today + week button) ────────────────────────────
  private async handleLessonsSection(chatId: string, tutor: Tutor) {
    const [lessons, students] = await Promise.all([
      this.dc_tutorLessons(tutor.id),
      this.dc_tutorStudents(tutor.id),
    ]);
    const tz = (tutor as any).timezone || "Europe/Moscow";
    const now = new Date();
    const todayStr = now.toLocaleDateString("sv-SE", { timeZone: tz });
    const dateLabel = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });

    const today = lessons
      .filter(l => new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz }) === todayStr)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    if (today.length === 0) {
      await this.bot!.sendMessage(chatId,
        `📅 <b>ЗАНЯТИЯ</b>  ·  <code>${dateLabel}</code>\n══════════════════════\n\n<i>Занятий нет — день свободен ✦</i>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
          [{ text: "📆 Расписание на неделю", callback_data: "cmd_week" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]}}
      );
      return;
    }

    const done = today.filter(l => l.status === "completed").length;
    const bar = "█".repeat(done) + "░".repeat(today.length - done);

    const lines = today.map(l => {
      const st = students.find(s => s.id === l.studentId);
      const time = new Date(l.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
      const icon = l.status === "completed" ? "✦" : l.status === "cancelled" ? "✕" : "◈";
      const appUrl = this.getAppUrl();
      const boardStr = appUrl ? `  <a href="${appUrl}/board/${l.studentId}">🖊</a>` : "";
      return `${icon} <code>${time}</code>  <b>${st?.name || "—"}</b>${boardStr}\n    <i>${st?.subject || ""} · ${l.topic || "тема не указана"} · ${l.durationMinutes} мин</i>`;
    });

    // Per-pending-lesson action buttons:
    // [✅+💰 Имя] [✅ Имя] [❌ Имя] [ℹ️] — in one compact row per lesson
    const lessonRows: TelegramBot.InlineKeyboardButton[][] = today
      .filter(l => l.status === "pending")
      .map(l => {
        const st = students.find(s => s.id === l.studentId);
        const firstName = st?.name?.split(" ")[0] || "—";
        const time = new Date(l.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
        return [
          { text: `✅ ${time} ${firstName} — Проведено`, callback_data: `lesson_done_${l.id}` },
          { text: `❌ Отменено`,                          callback_data: `lesson_miss_${l.id}` },
          { text: `ℹ️`,                                   callback_data: `student_detail_${l.studentId}` },
        ];
      });

    await this.bot!.sendMessage(chatId,
      `📅 <b>ЗАНЯТИЯ</b>  ·  <code>${dateLabel}</code>\n` +
      `══════════════════════\n` +
      `<code>${bar}</code>  <code>${done}/${today.length}</code> завершено\n\n` +
      lines.join("\n\n") +
      `\n\n<i>✅ — Проведено (списывает с баланса)   ❌ — Отменено (по политике штрафа)   ℹ️ — карточка</i>`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          ...lessonRows,
          [{ text: "📆 Расписание на неделю", callback_data: "cmd_week" }],
          [{ text: "📖 История занятий",      callback_data: "cmd_history" }],
          [{ text: "◀ Главное меню",          callback_data: "cmd_menu" }],
        ]}
      }
    );
  }

  async sendMenuSection(
    chatId: string,
    msgId: number | undefined,
    section: "sched" | "people" | "study" | "finance" | "other",
    role: "tutor" | "student",
  ): Promise<void> {
    type SectionDef = { text: string; kb: TelegramBot.InlineKeyboardButton[][] };
    const B = this.BACK_ROW;

    const SECTIONS: Record<string, SectionDef> = {
      // ── РАСПИСАНИЕ (общий для обеих ролей) ──────────────────────────
      sched: {
        text: role === "tutor"
          ? `📅 <b>РАСПИСАНИЕ</b>  ·  <code>[ РЕПЕТИТОР ]</code>\n` +
            `══════════════════════\n\n` +
            `◆ <b>СЕГОДНЯ</b>\n` +
            `  ▸ Все занятия на сегодня по времени\n` +
            `  ▸ Кнопки <code>✅ Завершено</code> и <code>❌ Не пришёл</code>\n` +
            `  ▸ При ✅ ученик получает уведомление\n\n` +
            `◆ <b>НЕДЕЛЯ</b>\n` +
            `  ▸ Занятия на ближайшие 7 дней\n\n` +
            `◆ <b>СЛЕДУЮЩЕЕ</b>\n` +
            `  ▸ Ближайший урок + ссылка на доску 🖊\n\n` +
            `◆ <b>ИСТОРИЯ</b>\n` +
            `  ▸ Последние 10 завершённых занятий`
          : `📅 <b>РАСПИСАНИЕ</b>  ·  <code>[ УЧЕНИК ]</code>\n` +
            `══════════════════════\n\n` +
            `◆ <b>СЕГОДНЯ</b>\n` +
            `  ▸ Занятия на сегодня\n` +
            `  ▸ Авто-напоминание придёт за 1 час\n\n` +
            `◆ <b>НЕДЕЛЯ</b>\n` +
            `  ▸ Занятия на 7 дней вперёд\n\n` +
            `◆ <b>СЛЕДУЮЩЕЕ</b>\n` +
            `  ▸ Ближайший урок + ссылка на доску 🖊\n\n` +
            `◆ <b>ИСТОРИЯ</b>\n` +
            `  ▸ Архив пройденных занятий`,
        kb: [
          [{ text: "📆 Сегодня",    callback_data: "cmd_today"   },
           { text: "📅 Неделя",    callback_data: "cmd_week"    }],
          [{ text: "⏭ Следующее",  callback_data: "cmd_next"    },
           { text: "📖 История",   callback_data: "cmd_history" }],
          [B[0]],
        ],
      },

      // ── УЧЕНИКИ И ДЗ (только репетитор) ─────────────────────────────
      people: {
        text: `📋 <b>УЧЕНИКИ И ДОМАШНИЕ РАБОТЫ</b>\n` +
          `══════════════════════\n\n` +
          `◆ <b>СПИСОК УЧЕНИКОВ</b>\n` +
          `  ▸ Имя → карточка: баланс · уроки · прогресс ДЗ\n` +
          `  ▸ Из карточки → 💰 Принять оплату\n` +
          `  ▸ Методы: <code>нал · карта · перевод · СБП</code>\n\n` +
          `◆ <b>ДЗ НА ПРОВЕРКЕ</b>\n` +
          `  ▸ Сданные работы, ожидающие оценки\n` +
          `  ▸ Кнопка ⭐ Оценить → балл <code>40–100</code>\n` +
          `  ▸ Кнопка ✏️ Комментарий → уведомление ученику`,
        kb: [
          [{ text: "👥 Список учеников",  callback_data: "cmd_students" },
           { text: "📝 ДЗ на проверке",  callback_data: "cmd_homework" }],
          [B[0]],
        ],
      },

      // ── УЧЁБА (только ученик) ────────────────────────────────────────
      study: {
        text: `📚 <b>УЧЁБА</b>  ·  <code>[ УЧЕНИК ]</code>\n` +
          `══════════════════════\n\n` +
          `◆ <b>МОИ ЗАДАНИЯ</b>\n` +
          `  ▸ Все ДЗ с текущим статусом\n` +
          `  ▸ Цепочка: <code>выдано → в работе → сдано → проверено</code>\n` +
          `  ▸ Кнопка 📤 Сдать → напишите ответ в чат\n\n` +
          `◆ <b>ОЦЕНКИ</b>\n` +
          `  ▸ Все баллы за проверенные работы\n` +
          `  ▸ Оценка + комментарий репетитора\n\n` +
          `◆ <b>ПРОГРЕСС</b>\n` +
          `  ▸ Средний балл · % выполнения · посещаемость`,
        kb: [
          [{ text: "📝 Мои задания",  callback_data: "cmd_homework"  },
           { text: "🎓 Оценки",       callback_data: "cmd_grades"    }],
          [{ text: "📈 Прогресс",     callback_data: "cmd_progress"  }],
          [B[0]],
        ],
      },

      // ── ФИНАНСЫ ──────────────────────────────────────────────────────
      finance: {
        text: role === "tutor"
          ? `💰 <b>ФИНАНСЫ</b>  ·  <code>[ РЕПЕТИТОР ]</code>\n` +
            `══════════════════════\n\n` +
            `◆ <b>БАЛАНСЫ УЧЕНИКОВ</b>\n` +
            `  ▸ Сводка: кто задолжал · кто переплатил\n` +
            `  ▸ 🔴 долг  /  🟢 переплата  /  ✅ расчёт\n\n` +
            `◆ <b>ПРИНЯТЬ ОПЛАТУ</b>\n` +
            `  ▸ Выбор ученика → суммы → метода\n` +
            `  ▸ Методы: <code>нал · карта · перевод · СБП</code>\n\n` +
            `◆ <b>АНАЛИТИКА</b>\n` +
            `  ▸ Доход · уроки · сравнение с прошлым месяцем`
          : `💰 <b>МОЙ БАЛАНС</b>  ·  <code>[ УЧЕНИК ]</code>\n` +
            `══════════════════════\n\n` +
            `◆ <b>БАЛАНС С РЕПЕТИТОРОМ</b>\n` +
            `  ▸ 🟢 Переплата  /  🔴 Долг  /  ✅ Расчёт\n\n` +
            `◆ <b>ИСТОРИЯ ПЛАТЕЖЕЙ</b>\n` +
            `  ▸ Последние 5 операций с датой и суммой`,
        kb: role === "tutor"
          ? [
              [{ text: "💳 Балансы",        callback_data: "cmd_balance"  },
               { text: "💵 Принять оплату", callback_data: "cmd_students" }],
              [{ text: "📊 Статистика",     callback_data: "cmd_stats"    }],
              [B[0]],
            ]
          : [
              [{ text: "💳 Мой баланс",   callback_data: "cmd_balance" }],
              [B[0]],
            ],
      },

      // ── ПРОЧЕЕ ───────────────────────────────────────────────────────
      other: {
        text: role === "tutor"
          ? `⚙️ <b>ПРОЧЕЕ</b>  ·  <code>[ РЕПЕТИТОР ]</code>\n` +
            `══════════════════════\n\n` +
            `◆ <b>ИИ-АССИСТЕНТ</b>  🤖\n` +
            `  ▸ GPT-4o помогает с методикой, заданиями, планированием\n` +
            `  ▸ Команда: <code>/ask ваш вопрос</code>\n` +
            `  ▸ Пример: <code>/ask Придумай 5 задач по тригонометрии</code>\n\n` +
            `◆ <b>ПРОФИЛЬ</b>  👤\n` +
            `  ▸ Ваши данные · подписка · статистика\n\n` +
            `◆ <b>ГИД</b>  📘\n` +
            `  ▸ 8 разделов · пошаговое обучение · с примерами\n\n` +
            `◆ <b>УПРАВЛЕНИЕ</b>\n` +
            `  ▸ Отключить Telegram: <code>/unlink</code>`
          : `⚙️ <b>ПРОЧЕЕ</b>  ·  <code>[ УЧЕНИК ]</code>\n` +
            `══════════════════════\n\n` +
            `◆ <b>ИИ-ПОМОЩНИК</b>  🤖\n` +
            `  ▸ Объясняет темы · решает задачи · отвечает на вопросы\n` +
            `  ▸ Команда: <code>/ask ваш вопрос</code>\n` +
            `  ▸ Пример: <code>/ask Объясни производную простыми словами</code>\n\n` +
            `◆ <b>ПРОФИЛЬ</b>  👤\n` +
            `  ▸ Уровень · очки опыта · достижения\n\n` +
            `◆ <b>ГИД</b>  📘\n` +
            `  ▸ 7 разделов · пошаговое обучение\n\n` +
            `◆ <b>УПРАВЛЕНИЕ</b>\n` +
            `  ▸ Отключить Telegram: <code>/unlink</code>`,
        kb: [
          [{ text: "🤖 ИИ-ассистент",   callback_data: "cmd_ai_info" },
           { text: "👤 Профиль",        callback_data: "cmd_profile" }],
          [{ text: "📘 Гид",            callback_data: "cmd_guide"   },
           { text: "❓ Команды",        callback_data: "cmd_help"    }],
          [B[0]],
        ],
      },
    };

    const sec = SECTIONS[section];
    if (!sec) return;
    const opts = { parse_mode: "HTML" as const, reply_markup: { inline_keyboard: sec.kb } };
    if (msgId) {
      await this.bot!.editMessageText(sec.text, {
        chat_id: chatId, message_id: msgId, ...opts,
      }).catch(() => this.bot!.sendMessage(chatId, sec.text, opts));
    } else {
      await this.bot!.sendMessage(chatId, sec.text, opts);
    }
  }

  // ========================
  // GUIDE / TUTORIAL
  // ========================

  private async sendTutorGuide(chatId: string) {
    // Part 1 — basics
    await this.bot!.sendMessage(chatId,
      `📘 <b>ОБУЧЕНИЕ — КАК ПОЛЬЗОВАТЬСЯ БОТОМ</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>1️⃣ ПОДКЛЮЧЕНИЕ АККАУНТА</b>\n` +
      `Бот уже привязан к вашему аккаунту репетитора.\n` +
      `Чтобы переподключить — /unlink, затем новый код на сайте.\n\n` +
      `<b>2️⃣ РАСПИСАНИЕ</b>\n` +
      `▸ /today — список занятий на сегодня\n` +
      `  ↳ У каждого занятия кнопки <b>✅ Завершено</b> и <b>❌ Не пришёл</b>\n` +
      `  ↳ Ученик получит уведомление при отметке ✅\n` +
      `▸ /week — занятия на 7 дней\n` +
      `▸ /next — ближайшее занятие + кнопка 🖊 Доска\n` +
      `▸ /history — последние 10 завершённых занятий`,
      { parse_mode: "HTML" }
    );
    // Part 2 — homework
    await this.bot!.sendMessage(chatId,
      `<b>3️⃣ ДОМАШНИЕ ЗАДАНИЯ</b>\n` +
      `▸ /homework — все работы, ожидающие проверки\n` +
      `  ↳ Показывает ответ ученика\n` +
      `  ↳ Кнопка <b>⭐ Оценить</b> → выбор балла 40–100\n` +
      `  ↳ Кнопка <b>✏️ Комментарий</b> → напишите текст, ученик получит уведомление\n\n` +
      `<b>4️⃣ УЧЕНИКИ</b>\n` +
      `▸ /students — список учеников\n` +
      `  ↳ Кнопка с именем → детальная карточка: баланс, уроки, ДЗ\n` +
      `  ↳ Кнопка <b>💰 Оплата</b> → выбор суммы и метода (нал/карта/СБП)\n\n` +
      `<b>5️⃣ ФИНАНСЫ</b>\n` +
      `▸ /balance — балансы всех учеников (кто задолжал / переплатил)\n` +
      `▸ /pay — быстрая оплата через список учеников`,
      { parse_mode: "HTML" }
    );
    // Part 3 — AI + tips
    await this.bot!.sendMessage(chatId,
      `<b>6️⃣ СТАТИСТИКА</b>\n` +
      `▸ /stats — уроки, доход, сравнение с прошлым месяцем, активность учеников\n\n` +
      `<b>7️⃣ ИИ-АССИСТЕНТ 🤖</b>\n` +
      `▸ /ask [вопрос] — GPT-4o отвечает в контексте «репетитор»\n` +
      `Примеры:\n` +
      `  <code>/ask Как объяснить логарифмы 8-класснику?</code>\n` +
      `  <code>/ask Придумай 5 задач по тригонометрии</code>\n` +
      `  <code>/ask Как мотивировать ленивого ученика?</code>\n\n` +
      `<b>8️⃣ АВТО-УВЕДОМЛЕНИЯ 🔔</b>\n` +
      `Бот автоматически присылает:\n` +
      `• Напоминание за <b>1 час</b> до занятия\n` +
      `• Сообщение, когда ученик <b>сдал ДЗ</b> (+ кнопка «Оценить»)\n\n` +
      `<b>💡 СОВЕТ</b>: Нажмите / в поле ввода — появится меню всех команд с описанием.`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📅 Расписание сегодня", callback_data: "cmd_today" }, { text: "👥 Ученики", callback_data: "cmd_students" }],
          [{ text: "📝 ДЗ на проверке", callback_data: "cmd_homework" }, { text: "💰 Финансы", callback_data: "cmd_balance" }],
        ]}
      }
    );
  }

  private async sendStudentGuide(chatId: string) {
    // Part 1 — basics
    await this.bot!.sendMessage(chatId,
      `📘 <b>ОБУЧЕНИЕ — КАК ПОЛЬЗОВАТЬСЯ БОТОМ</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>1️⃣ ПОДКЛЮЧЕНИЕ АККАУНТА</b>\n` +
      `Бот привязан к вашему аккаунту ученика.\n` +
      `Если нужно переподключить — /unlink, затем новый код на сайте (синий баннер).\n\n` +
      `<b>2️⃣ РАСПИСАНИЕ</b>\n` +
      `▸ /today — занятия на сегодня\n` +
      `▸ /week — занятия на 7 дней вперёд\n` +
      `▸ /next — ближайшее занятие + кнопка 🖊 Доска\n` +
      `▸ /history — история последних занятий\n\n` +
      `Когда занятие началось — получишь уведомление ✅`,
      { parse_mode: "HTML" }
    );
    // Part 2 — homework
    await this.bot!.sendMessage(chatId,
      `<b>3️⃣ ДОМАШНИЕ ЗАДАНИЯ 📚</b>\n` +
      `▸ /homework — список всех заданий\n` +
      `  ↳ Статусы: <i>выдано → в работе → сдано → проверено</i>\n` +
      `  ↳ Кнопка <b>📤 Сдать</b> → напиши ответ текстом или нажми «Без текста»\n` +
      `  ↳ После проверки придёт оценка и комментарий репетитора\n\n` +
      `<b>4️⃣ ОЦЕНКИ И ПРОГРЕСС 🏅</b>\n` +
      `▸ /grades — все оценки по работам\n` +
      `▸ /progress — процент выполнения, средний балл, посещаемость`,
      { parse_mode: "HTML" }
    );
    // Part 3 — finance + AI + tips
    await this.bot!.sendMessage(chatId,
      `<b>5️⃣ ФИНАНСЫ 💰</b>\n` +
      `▸ /balance — твой баланс с репетитором\n` +
      `  ↳ Зелёный = переплата, красный = долг\n` +
      `  ↳ Показывает последние 5 платежей\n\n` +
      `<b>6️⃣ ИИ-АССИСТЕНТ 🤖</b>\n` +
      `▸ /ask [вопрос] — ИИ помогает разобраться с темой\n` +
      `Примеры:\n` +
      `  <code>/ask Как решать квадратные уравнения?</code>\n` +
      `  <code>/ask Объясни теорему Пифагора простыми словами</code>\n` +
      `  <code>/ask Что такое производная?</code>\n\n` +
      `<b>7️⃣ АВТО-УВЕДОМЛЕНИЯ 🔔</b>\n` +
      `Бот сам пришлёт:\n` +
      `• Напоминание за <b>1 час</b> до занятия\n` +
      `• Уведомление о <b>новом задании</b>\n` +
      `• Результат проверки + <b>оценка</b> и <b>комментарий</b>\n\n` +
      `<b>💡 СОВЕТ</b>: Нажмите / в поле ввода — меню всех команд.`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "📚 Мои задания", callback_data: "cmd_homework" }],
          [{ text: "🏅 Оценки", callback_data: "cmd_grades" }, { text: "💰 Баланс", callback_data: "cmd_balance" }],
        ]}
      }
    );
  }

  // ========================
  // NEW HANDLERS
  // ========================

  // ========================
  // INLINE-РЕЖИМ
  // ========================

  /**
   * Обрабатывает inline-запрос: репетитор пишет `@MyVectorAI_bot Иван`
   * в любом чате — мы возвращаем карточки с балансом, долгом
   * и следующим уроком найденных учеников.
   */
  private async handleInlineQuery(query: any) {
    if (!this.bot) return;
    const fromId = String(query.from?.id || "");
    const q = (query.query || "").trim();

    // Идентифицируем репетитора по telegram chat_id (= user id в private чатах)
    const tutor = await storage.getTutorByTelegramChatId(fromId).catch(() => null);
    if (!tutor) {
      // Незалогиненный → одна карточка с приглашением
      return this.bot.answerInlineQuery(query.id, [{
        type: "article",
        id: "noauth",
        title: "🔒 Привяжите аккаунт",
        description: "Откройте бота и используйте /start — затем сможете искать учеников отсюда.",
        input_message_content: {
          message_text:
            "🔒 <b>Чтобы пользоваться поиском по ученикам через @MyVectorAI_bot</b>\n" +
            "— откройте бота, нажмите /start и привяжите аккаунт.",
          parse_mode: "HTML",
        },
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть бота", url: "https://t.me/MyVectorAI_bot?start=link" }]],
        },
      }] as any, { cache_time: 30, is_personal: true });
    }

    // Загружаем данные репетитора параллельно
    const [students, lessons, payments] = await Promise.all([
      this.dc_tutorStudents(tutor.id),
      this.dc_tutorLessons(tutor.id),
      this.dc_tutorPayments(tutor.id),
    ]);

    // Фильтруем учеников по запросу. Пустой запрос → топ-10 активных.
    const qLower = q.toLowerCase();
    const matched = q
      ? students.filter((s: any) => (s.name || "").toLowerCase().includes(qLower)
          || (s.subject || "").toLowerCase().includes(qLower))
      : students.filter((s: any) => s.isActive).slice(0, 10);

    if (matched.length === 0) {
      return this.bot.answerInlineQuery(query.id, [{
        type: "article",
        id: "empty",
        title: "🔎 Никого не нашли",
        description: q ? `Нет учеников по запросу «${q}»` : "У вас пока нет учеников",
        input_message_content: {
          message_text: `🔎 По запросу «${q}» ученики не найдены.`,
        },
      }] as any, { cache_time: 5, is_personal: true });
    }

    // Считаем по каждому ученику
    const paidMap = new Map<string, number>();
    for (const p of payments) paidMap.set(p.studentId, (paidMap.get(p.studentId) || 0) + p.amount);
    const doneMap = new Map<string, number>();
    for (const l of lessons) {
      if (l.status === "completed") doneMap.set(l.studentId, (doneMap.get(l.studentId) || 0) + 1);
    }
    const tz = (tutor as any).timezone || "Europe/Moscow";
    const now = new Date();

    const results = matched.slice(0, 20).map((s: any) => {
      const totalPaid = paidMap.get(s.id) || 0;
      const totalOwed = (doneMap.get(s.id) || 0) * (s.pricePerLesson || 0);
      const bal = totalPaid - totalOwed;

      const balLabel = bal < 0
        ? `🔴 Долг ${Math.abs(bal).toLocaleString("ru-RU")} ₽`
        : bal > 0
          ? `🟢 Аванс ${bal.toLocaleString("ru-RU")} ₽`
          : `✅ В расчёте`;

      const studentLessons = lessons
        .filter((l: any) => l.studentId === s.id)
        .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

      const next = studentLessons.find((l: any) =>
        new Date(l.scheduledAt) > now && l.status === "pending");
      const last = [...studentLessons].reverse().find((l: any) =>
        new Date(l.scheduledAt) <= now && l.status === "completed");

      const nextLine = next
        ? `📅 Следующий: ${formatDateTimeRu(new Date(next.scheduledAt), tz)}` +
          (next.topic ? ` — ${String(next.topic).slice(0, 40)}` : "")
        : `📅 Следующего урока нет`;

      const lastLine = last
        ? `🕐 Последний: ${formatDateTimeRu(new Date(last.scheduledAt), tz)}` +
          (last.topic ? ` — ${String(last.topic).slice(0, 40)}` : "")
        : `🕐 Уроков ещё не было`;

      const ageStr = s.grade ? `${s.grade} класс` : (s.subject || "");
      const description = `${balLabel}  ·  ${ageStr || "—"}\n${nextLine}`;

      // Полный текст карточки для отправки в чат
      const messageText =
        `👤 <b>${this.escapeHtml(s.name)}</b>` +
        (s.subject ? `  ·  <code>${this.escapeHtml(s.subject)}</code>` : "") +
        (s.grade ? `  ·  ${s.grade} класс` : "") +
        `\n══════════════════════\n` +
        `${balLabel}  ·  <i>${(s.pricePerLesson || 0).toLocaleString("ru-RU")} ₽/урок</i>\n` +
        `  ▸ Оплачено всего: <b>${totalPaid.toLocaleString("ru-RU")} ₽</b>\n` +
        `  ▸ Проведено уроков: <b>${doneMap.get(s.id) || 0}</b>\n` +
        (s.parentName ? `  ▸ Родитель: ${this.escapeHtml(s.parentName)}` +
            (s.parentPhone ? ` · <code>${this.escapeHtml(s.parentPhone)}</code>` : "") + `\n` : "") +
        (s.phone ? `  ▸ Телефон: <code>${this.escapeHtml(s.phone)}</code>\n` : "") +
        `\n${nextLine}\n${lastLine}`;

      // Кнопка-ссылка в кабинет (если знаем APP_URL)
      const appUrlBase = this.getAppUrl();
      const buttons: any[][] = [];
      if (appUrlBase) {
        buttons.push([
          { text: "👤 Открыть карточку", url: `${appUrlBase}/students/${s.id}` },
        ]);
      }

      return {
        type: "article",
        id: `s_${s.id}`,
        title: `${s.name}${s.subject ? `  ·  ${s.subject}` : ""}`,
        description,
        input_message_content: {
          message_text: messageText,
          parse_mode: "HTML",
        },
        ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
      };
    });

    await this.bot.answerInlineQuery(query.id, results as any, {
      cache_time: 30,
      is_personal: true,
    });
  }

  private async handleStateInput(chatId: string, text: string, state: Record<string, string>) {
    await this.clearTgState(chatId);

    if (state.action === "hw_submit" && state.hwId) {
      const s = await storage.getStudentByTelegramChatId(chatId);
      if (!s) return;
      const hw = await storage.getHomework(state.hwId);
      if (!hw || (hw as any).studentId !== s.id) return;
      // Текст пришёл — сразу финализируем со всеми накопленными файлами
      const files: { url: string; kind: "image" | "doc" }[] =
        state.files ? JSON.parse(state.files) : [];
      await this.finalizeHomeworkSubmission(chatId, s, hw as any, text, files);
      return;
    }

    if (state.action === "hw_comment" && state.hwId) {
      const t = await storage.getTutorByTelegramChatId(chatId);
      if (!t) return;
      const hw = await storage.getHomework(state.hwId);
      if (!hw || (hw as any).tutorId !== t.id) return;
      await storage.updateHomework(state.hwId, { feedback: text, status: "reviewed" } as any);
      this.dcDel(`th:${t.id}`, `sh:${(hw as any).studentId}`);
      const st = await storage.getStudent((hw as any).studentId);
      await this.bot!.sendMessage(chatId,
        `✅ <b>КОММЕНТАРИЙ СОХРАНЁН</b>\n${st?.name || "—"} · ${(hw as any).title}\n<i>${text.slice(0, 100)}</i>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📚 ДЗ на проверке", callback_data: "cmd_homework" }]] } }
      );
      if (st?.telegramChatId) {
        await this.bot!.sendMessage(st.telegramChatId,
          `💬 <b>КОММЕНТАРИЙ РЕПЕТИТОРА</b>\n━━━━━━━━━━━━━━━━━━\n${(hw as any).title}\n\n<i>${text}</i>`,
          { parse_mode: "HTML" }
        ).catch(() => {});
      }
      return;
    }

    if (state.action === "lesson_reschedule" && state.lessonId) {
      const lesson = await storage.getLesson(state.lessonId);
      if (!lesson) {
        await this.bot!.sendMessage(chatId, "⛔ Урок не найден.");
        return;
      }
      const t = await storage.getTutor(lesson.tutorId);
      const s = await storage.getStudent(lesson.studentId);
      if (!t || !s) return;
      const isTutor   = t.tutorChatId === chatId;
      const isStudent = (s as any).telegramChatId === chatId;
      if (!isTutor && !isStudent) return;

      const tz = (t as any).timezone || "Europe/Moscow";
      const newDate = parseDateTimeRu(text, tz, new Date(lesson.scheduledAt));
      if (!newDate) {
        await this.bot!.sendMessage(chatId,
          `⛔ Не понял формат. Введите так: <code>23.04 17:00</code>`,
          { parse_mode: "HTML" }
        );
        await this.setTgState(chatId, state);
        return;
      }
      if (newDate.getTime() < Date.now() - 60_000) {
        await this.bot!.sendMessage(chatId, "⛔ Время уже прошло. Введите будущее время.");
        await this.setTgState(chatId, state);
        return;
      }

      const oldStr = formatDateTimeRu(new Date(lesson.scheduledAt), tz);
      const newStr = formatDateTimeRu(newDate, tz);

      // Если переносит ученик — создаём заявку, не меняя расписание сразу.
      // Если репетитор — переносим сразу.
      if (isTutor) {
        await storage.updateLesson(state.lessonId, { scheduledAt: newDate.toISOString() } as any);
        this.dcDel(`tl:${t.id}`, `sl:${s.id}`);
        await this.bot!.sendMessage(chatId,
          `✅ <b>УРОК ПЕРЕНЕСЁН</b>\n══════════════════════\n` +
          `  ▸ Ученик: <b>${s.name}</b>\n` +
          `  ▸ Было: <code>${oldStr}</code>\n` +
          `  ▸ Стало: <code>${newStr}</code>`,
          { parse_mode: "HTML" }
        );
        if ((s as any).telegramChatId) {
          try {
            await this.bot!.sendMessage((s as any).telegramChatId,
              `⏭ <b>УРОК ПЕРЕНЕСЁН</b>\n` +
              `  ▸ Репетитор: <b>${t.name}</b>\n` +
              `  ▸ Было: <code>${oldStr}</code>\n` +
              `  ▸ Стало: <code>${newStr}</code>`,
              { parse_mode: "HTML", reply_markup: { inline_keyboard: [[
                { text: "✅ Подтвердить", callback_data: `lconf_${state.lessonId}` },
              ]]}}
            );
          } catch {}
        }
      } else {
        // Ученик — это заявка на перенос
        await this.bot!.sendMessage(chatId,
          `📨 <b>ЗАЯВКА ОТПРАВЛЕНА</b>\n══════════════════════\n` +
          `  ▸ Просим перенести с <code>${oldStr}</code>\n` +
          `  ▸ На <code>${newStr}</code>\n\n` +
          `<i>Ждём подтверждения репетитора.</i>`,
          { parse_mode: "HTML" }
        );
        if (t.tutorChatId) {
          try {
            await this.bot!.sendMessage(t.tutorChatId,
              `📨 <b>ЗАЯВКА НА ПЕРЕНОС</b>\n══════════════════════\n` +
              `  ▸ Ученик: <b>${s.name}</b>\n` +
              `  ▸ Было: <code>${oldStr}</code>\n` +
              `  ▸ Просит: <code>${newStr}</code>`,
              { parse_mode: "HTML", reply_markup: { inline_keyboard: [[
                { text: "✅ Согласиться",   callback_data: `lresc_ok_${state.lessonId}_${newDate.getTime()}` },
                { text: "❌ Отклонить",     callback_data: `lresc_no_${state.lessonId}` },
              ]]}}
            );
          } catch {}
        }
        await storage.createNotification({
          tutorId: t.id,
          type: "lesson_reschedule_request",
          title: `📨 ${s.name} просит перенести урок`,
          message: `Было ${oldStr} → ${newStr}`,
          relatedId: lesson.id,
          isRead: false,
        } as any).catch(() => {});
      }
      return;
    }

    if (state.action === "pay_amount" && state.studentId) {
      const t = await storage.getTutorByTelegramChatId(chatId);
      if (!t) return;
      const amount = parseInt(text.replace(/\D/g, ""));
      if (!amount || amount <= 0) {
        await this.bot!.sendMessage(chatId, "⛔ Некорректная сумма. Введите число, например: 1500");
        await this.setTgState(chatId, state);
        return;
      }
      const st = await storage.getStudent(state.studentId);
      if (!st || st.tutorId !== t.id) return;
      await this.bot!.sendMessage(chatId,
        `💰 <b>${amount.toLocaleString("ru-RU")} ₽</b> от <b>${st.name}</b>\n\nСпособ оплаты:`,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[
            { text: "💵 Наличные", callback_data: `pay_c_${state.studentId}_${amount}_n` },
            { text: "💳 Карта", callback_data: `pay_c_${state.studentId}_${amount}_k` },
            { text: "📲 Перевод", callback_data: `pay_c_${state.studentId}_${amount}_p` },
            { text: "⚡ СБП", callback_data: `pay_c_${state.studentId}_${amount}_s` },
          ]]}
        }
      );
      return;
    }
  }

  private async notifyTutorHomeworkSubmitted(tutorChatId: string, student: Student, hw: any) {
    await this.bot!.sendMessage(tutorChatId,
      `📬 <b>ДЗ СДАНО</b>\n══════════════════════\n` +
      `◆ УЧЕНИК\n` +
      `  ▸ <b>${student.name}</b>  ·  <i>${hw.title}</i>\n` +
      (hw.solutionText ? `\n◆ ОТВЕТ\n  <i>«${hw.solutionText.slice(0, 80)}${hw.solutionText.length > 80 ? "…" : ""}»</i>` : ""),
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "⭐ Оценить", callback_data: `hw_grade_${hw.id}` }]] }
      }
    ).catch(() => {});
  }

  private async handleBalanceStudent(chatId: string, student: Student) {
    const [tutor, lessons, payments] = await Promise.all([
      this.dc_tutor(student.tutorId),
      this.dc_studentLessons(student.id),
      storage.getPaymentsByStudentId(student.id, 20),
    ]);
    const completedLessons = lessons.filter(l => l.status === "completed").length;
    const pricePerLesson = (student as any).pricePerLesson || 0;
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalOwed = completedLessons * pricePerLesson;
    const realBalance = totalPaid - totalOwed;

    const balStr = realBalance > 0 ? `🟢 Переплата: <b>+${realBalance.toLocaleString("ru-RU")} ₽</b>` :
                   realBalance < 0 ? `🔴 Долг: <b>−${Math.abs(realBalance).toLocaleString("ru-RU")} ₽</b>` :
                                     `✅ Расчёты закрыты`;

    const last5 = payments.slice(0, 5);

    await this.bot!.sendMessage(chatId,
      `💰 <b>МОЙ БАЛАНС</b>\n══════════════════════\n\n` +
      `◆ <b>РАСЧЁТЫ С РЕПЕТИТОРОМ</b>\n` +
      `  ▸ Репетитор:  <b>${tutor?.name || "—"}</b>\n` +
      (pricePerLesson > 0 ? `  ▸ Стоимость урока:  <code>${pricePerLesson.toLocaleString("ru-RU")} ₽</code>\n` : "") +
      `  ▸ Занятий проведено:  <code>${completedLessons}</code>\n` +
      `  ▸ Начислено:  <code>${totalOwed.toLocaleString("ru-RU")} ₽</code>\n` +
      `  ▸ Оплачено:  <code>${totalPaid.toLocaleString("ru-RU")} ₽</code>\n` +
      `  ▸ Статус:  ${balStr}\n` +
      (last5.length > 0
        ? `\n◆ <b>ПОСЛЕДНИЕ ПЛАТЕЖИ</b>\n` + last5.map(p => {
            const d = new Date(p.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
            return `  ✦ <code>${d}</code>  <b>+${p.amount.toLocaleString("ru-RU")} ₽</b>  <i>${p.method}</i>`;
          }).join("\n")
        : `\n<i>Платежей ещё не было</i>`),
      { parse_mode: "HTML", reply_markup: { inline_keyboard: [
          [{ text: "📈 Прогресс",    callback_data: "s_progress"  },
           { text: "📋 Программа",   callback_data: "s_programme" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu"   }],
        ]} }
    );
  }

  // ========================
  // STUDENT SECTION MENUS
  // ========================

  private async handleStudentScheduleSection(chatId: string, student: Student) {
    const [lessons, tutor] = await Promise.all([
      this.dc_studentLessons(student.id),
      this.dc_tutor(student.tutorId),
    ]);
    const tz = (tutor as any)?.timezone || "Europe/Moscow";
    const now = new Date();
    const todayStr = now.toLocaleDateString("sv-SE", { timeZone: tz });
    const dateLabel = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long", timeZone: tz });
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthLabel = now.toLocaleDateString("ru-RU", { month: "long", timeZone: tz });

    const todayLessons = lessons
      .filter(l => new Date(l.scheduledAt).toLocaleDateString("sv-SE", { timeZone: tz }) === todayStr)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const nextLesson = lessons
      .filter(l => new Date(l.scheduledAt) > now && l.status === "pending")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];

    const completedMonth = lessons.filter(l => {
      const d = new Date(l.scheduledAt);
      return d >= monthStart && d < monthEnd && l.status === "completed";
    }).length;
    const totalMonth = lessons.filter(l => {
      const d = new Date(l.scheduledAt);
      return d >= monthStart && d < monthEnd && l.status !== "cancelled";
    }).length;

    const todayDone = todayLessons.filter(l => l.status === "completed").length;
    const lines = todayLessons.map(l => {
      const time = new Date(l.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
      const icon = l.status === "completed" ? "✦" : l.status === "cancelled" ? "✕" : "◈";
      return `  ${icon} <code>${time}</code>  <b>${student.subject}</b>\n     <i>${l.topic || "тема не указана"} · ${l.durationMinutes} мин</i>`;
    });

    const nextTimeStr = nextLesson
      ? new Date(nextLesson.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz }) +
        " · " + new Date(nextLesson.scheduledAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: tz })
      : null;
    const untilNext = nextLesson ? timeUntilStr(new Date(nextLesson.scheduledAt), now) : null;

    await this.bot!.sendMessage(chatId,
      `📅 <b>МОЁ РАСПИСАНИЕ</b>\n══════════════════════\n` +
      `<i>${dateLabel}</i>\n\n` +
      `◆ <b>СЕГОДНЯ</b>\n` +
      (todayLessons.length > 0
        ? `  Занятий: <code>${todayDone}/${todayLessons.length}</code>\n` + lines.join("\n")
        : `  ✦  Занятий сегодня нет`) +
      `\n\n◆ <b>СЛЕДУЮЩЕЕ ЗАНЯТИЕ</b>\n` +
      (nextTimeStr
        ? `  ⏰  <b>${nextTimeStr}</b>` +
          (untilNext ? `  <i>(через ${untilNext})</i>` : "") +
          `\n  <i>${nextLesson!.topic || "тема не указана"} · ${nextLesson!.durationMinutes} мин</i>`
        : `  ✦  Предстоящих занятий нет`) +
      `\n\n◆ <b>${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</b>\n` +
      `  Проведено: <code>${completedMonth}</code>  из  <code>${totalMonth}</code>`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "📅 Сегодня",    callback_data: "cmd_today"   },
           { text: "📆 Неделя",     callback_data: "cmd_week"    }],
          [{ text: "⏭ Следующее",   callback_data: "cmd_next"    },
           { text: "📖 История",    callback_data: "cmd_history" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu"  }],
        ]}
      }
    );
  }

  private async handleStudentTasksSection(chatId: string, student: Student) {
    const allHw = await this.dc_studentHomework(student.id);
    const assigned = allHw.filter(h => h.status === "assigned");
    const submitted = allHw.filter(h => h.status === "submitted");
    const graded = allHw.filter(h => h.status === "graded");
    const reviewed = allHw.filter(h => h.status === "reviewed");
    const allGraded = [...graded, ...reviewed];
    const gradedWithScore = allGraded.filter(h => (h as any).grade);
    const avgGrade = gradedWithScore.length > 0
      ? (gradedWithScore.reduce((s, h) => s + ((h as any).grade || 0), 0) / gradedWithScore.length).toFixed(1)
      : "—";

    const hwPct = allHw.length > 0 ? Math.round(((allGraded.length + submitted.length) / allHw.length) * 100) : 0;
    const hwBar = "█".repeat(Math.round(hwPct / 10)) + "░".repeat(10 - Math.round(hwPct / 10));

    const pendingLines = assigned.slice(0, 5).map(h => {
      const due = (h as any).dueDate
        ? `  <i>до ${new Date((h as any).dueDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</i>` : "";
      return `  🔴 <b>${h.title}</b>${due}`;
    });
    const submittedLines = submitted.slice(0, 3).map(h => `  🟡 ${h.title}  <i>ждёт оценки…</i>`);
    const gradedLines = allGraded.slice(0, 3).map(h => {
      const g = (h as any).grade ? `  <code>${(h as any).grade}/10</code>` : "";
      const icon = (h as any).grade >= 9 ? "🟢" : (h as any).grade >= 7 ? "🟡" : "✦";
      return `  ${icon} ${h.title}${g}`;
    });

    const text =
      `📝 <b>МОИ ЗАДАНИЯ</b>\n══════════════════════\n\n` +
      `<code>${hwBar}</code>  <code>${hwPct}%</code>  выполнено\n\n` +
      `◆ <b>К ВЫПОЛНЕНИЮ</b>  <code>${assigned.length}</code>\n` +
      (assigned.length > 0 ? pendingLines.join("\n") : `  ✦  Всё выполнено — отлично!`) +
      `\n\n◆ <b>НА ПРОВЕРКЕ</b>  <code>${submitted.length}</code>\n` +
      (submitted.length > 0 ? submittedLines.join("\n") : `  ✦  Нет работ на проверке`) +
      `\n\n◆ <b>ПРОВЕРЕНО</b>  <code>${allGraded.length}</code>` +
      (avgGrade !== "—" ? `  ·  ср. <code>${avgGrade}/10</code>` : "") + `\n` +
      (allGraded.length > 0 ? gradedLines.join("\n") : `  ✦  Проверенных работ нет`);

    const submitButtons: TelegramBot.InlineKeyboardButton[][] = assigned.slice(0, 4).map(h => ([
      { text: `📤 Сдать: ${h.title.slice(0, 28)}`, callback_data: `hw_ss_${h.id}` },
    ]));

    await this.bot!.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [
        ...submitButtons,
        [{ text: "🏅 Оценки",     callback_data: "cmd_grades"  },
         { text: "📈 Прогресс",   callback_data: "s_progress"  }],
        [{ text: "◀ Главное меню", callback_data: "cmd_menu"   }],
      ]}
    });
  }

  private async handleStudentBoardSection(chatId: string, student: Student) {
    const appUrl = this.getAppUrl();
    const opts: TelegramBot.SendMessageOptions = {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [
        ...(appUrl ? [[
          { text: "🖊 Открыть доску", url: `${appUrl}/board/${student.id}` },
        ]] : []),
        ...(appUrl ? [[
          { text: "🏠 Личный кабинет", url: `${appUrl}/student` },
        ]] : []),
        [{ text: "⏭ Следующее занятие", callback_data: "cmd_next" }],
        [{ text: "◀ Главное меню",       callback_data: "cmd_menu" }],
      ]}
    };

    await this.bot!.sendMessage(chatId,
      `🖊 <b>МОЯ ДОСКА</b>  ·  <code>[ УЧЕНИК ]</code>\n══════════════════════\n\n` +
      `◆ <b>СОВМЕСТНАЯ ДОСКА С РЕПЕТИТОРОМ</b>\n` +
      `  ▸ Ученик:  <b>${student.name}</b>\n` +
      `  ▸ Предмет:  <code>${student.subject}</code>\n\n` +
      `На доске вы можете:\n` +
      `  ▸ Решать задачи совместно в реальном времени\n` +
      `  ▸ Делать пометки и заметки\n` +
      `  ▸ Прикреплять материалы к занятию\n\n` +
      (appUrl
        ? `<i>Нажмите кнопку ниже, чтобы открыть доску в браузере</i>`
        : `<i>Доска доступна в личном кабинете на сайте</i>`),
      opts
    );
  }

  private async handleStudentProgrammeSection(chatId: string, student: Student) {
    const [tutor, lessons, allHw] = await Promise.all([
      this.dc_tutor(student.tutorId),
      this.dc_studentLessons(student.id),
      this.dc_studentHomework(student.id),
    ]);

    const completedLessons = lessons.filter(l => l.status === "completed");
    const upcomingLessons = lessons
      .filter(l => l.status === "pending" && new Date(l.scheduledAt) > new Date())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 3);

    const recentTopics = completedLessons
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .slice(0, 3)
      .map(l => l.topic)
      .filter(Boolean);

    const appUrl = this.getAppUrl();

    await this.bot!.sendMessage(chatId,
      `📋 <b>МОЯ ПРОГРАММА</b>  ·  <code>[ УЧЕНИК ]</code>\n══════════════════════\n\n` +
      `◆ <b>ПРОФИЛЬ</b>\n` +
      `  ▸ Предмет:  <code>${student.subject}</code>  ·  <i>${(student as any).grade || "класс не указан"}</i>\n` +
      `  ▸ Репетитор:  <b>${tutor?.name || "—"}</b>\n` +
      ((student as any).goal ? `  ▸ Цель:  <i>${(student as any).goal}</i>\n` : "") +
      ((student as any).curriculumTopic ? `  ▸ Тема сейчас:  <b>${(student as any).curriculumTopic}</b>\n` : "") +
      `\n◆ <b>ПРОГРЕСС ОБУЧЕНИЯ</b>\n` +
      `  ▸ Проведено занятий:  <code>${completedLessons.length}</code>\n` +
      `  ▸ Заданий выполнено:  <code>${allHw.filter(h => h.status === "graded" || h.status === "submitted").length}</code>\n` +
      (recentTopics.length > 0
        ? `\n◆ <b>ПОСЛЕДНИЕ ТЕМЫ</b>\n` + recentTopics.map(t => `  ▸ ${t}`).join("\n") + "\n"
        : "") +
      (upcomingLessons.length > 0
        ? `\n◆ <b>ПРЕДСТОЯЩИЕ ЗАНЯТИЯ</b>\n` + upcomingLessons.map(l => {
            const d = new Date(l.scheduledAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
            const t = new Date(l.scheduledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
            return `  ▸ <code>${d} ${t}</code>  ${l.topic || "тема не указана"}`;
          }).join("\n")
        : ""),
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          ...(appUrl ? [[{ text: "📖 Открыть программу на сайте", url: `${appUrl}/student/lessons` }]] : []),
          [{ text: "📅 Расписание", callback_data: "s_schedule" },
           { text: "📈 Прогресс",   callback_data: "s_progress" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu"  }],
        ]}
      }
    );
  }

  private async handleStudentMoreSection(chatId: string, student: Student) {
    await this.bot!.sendMessage(chatId,
      `⚙️ <b>ЕЩЁ</b>  ·  <code>[ УЧЕНИК ]</code>\n══════════════════════\n\n` +
      `◆ <b>ПРОФИЛЬ</b>  👤\n` +
      `  ▸ Ваш профиль, прогресс, статистика\n\n` +
      `◆ <b>ИИ-ПОМОЩНИК</b>  🤖\n` +
      `  ▸ GPT-4o объясняет темы и помогает с заданиями\n` +
      `  ▸ Команда: <code>/ask ваш вопрос</code>\n\n` +
      `◆ <b>СПРАВКА</b>  ❓\n` +
      `  ▸ Все команды и разделы бота\n\n` +
      `◆ <b>УПРАВЛЕНИЕ</b>\n` +
      `  ▸ Переподключить Telegram: <code>/unlink</code>`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [{ text: "👤 Мой профиль",   callback_data: "cmd_profile" },
           { text: "🤖 ИИ-помощник",   callback_data: "menu_ai"    }],
          [{ text: "📘 Гид ученика",    callback_data: "cmd_guide"  },
           { text: "❓ Команды",        callback_data: "cmd_help"   }],
          [{ text: "◀ Главное меню",    callback_data: "cmd_menu"   }],
        ]}
      }
    );
  }

  private async handleHistoryStudent(chatId: string, student: Student) {
    const [lessons, tutor] = await Promise.all([
      this.dc_studentLessons(student.id),
      this.dc_tutor(student.tutorId),
    ]);
    const tz = (tutor as any)?.timezone || "Europe/Moscow";
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const allCompleted = lessons.filter(l => l.status === "completed");
    const monthCount = allCompleted.filter(l => {
      const d = new Date(l.scheduledAt); return d >= monthStart && d < monthEnd;
    }).length;
    const last10 = allCompleted
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .slice(0, 10);

    if (last10.length === 0) {
      await this.bot!.sendMessage(chatId,
        `📖 <b>ИСТОРИЯ ЗАНЯТИЙ</b>\n══════════════════════\n\n✦  Проведённых занятий пока нет`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
            [{ text: "📅 Сегодня",    callback_data: "cmd_today" },
             { text: "⏭ Следующее",  callback_data: "cmd_next"  }],
            [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
          ]} }
      );
      return;
    }

    const lines = last10.map(l => {
      const d = new Date(l.scheduledAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: tz });
      const weekday = new Date(l.scheduledAt).toLocaleDateString("ru-RU", { weekday: "short", timeZone: tz });
      return `✦ <code>${weekday}, ${d}</code>  <b>${student.subject}</b>\n    <i>${l.topic || "тема не указана"} · ${l.durationMinutes} мин</i>`;
    });

    const monthLabel = now.toLocaleDateString("ru-RU", { month: "long" });
    await this.bot!.sendMessage(chatId,
      `📖 <b>ИСТОРИЯ ЗАНЯТИЙ</b>\n══════════════════════\n` +
      `Всего: <code>${allCompleted.length}</code>  ·  в ${monthLabel}: <code>${monthCount}</code>\n\n` +
      lines.join("\n\n"),
      { parse_mode: "HTML", reply_markup: { inline_keyboard: [
          [{ text: "📅 Сегодня",    callback_data: "cmd_today"    },
           { text: "⏭ Следующее",  callback_data: "cmd_next"     }],
          [{ text: "📈 Прогресс",   callback_data: "cmd_progress" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu"   }],
        ]} }
    );
  }

  private async handleHistoryTutor(chatId: string, tutor: Tutor) {
    const [lessons, students] = await Promise.all([
      this.dc_tutorLessons(tutor.id),
      this.dc_tutorStudents(tutor.id),
    ]);
    const tz = (tutor as any).timezone || "Europe/Moscow";
    const completed = lessons
      .filter(l => l.status === "completed")
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .slice(0, 10);

    if (completed.length === 0) {
      await this.bot!.sendMessage(chatId,
        `📖 <b>ИСТОРИЯ ЗАНЯТИЙ</b>\n══════════════════════\n\n<i>Проведённых занятий пока нет ✦</i>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
            [{ text: "📅 Сегодня", callback_data: "cmd_today" }],
            [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
          ]} }
      );
      return;
    }

    const lines = completed.map(l => {
      const st = students.find(s => s.id === l.studentId);
      const d = new Date(l.scheduledAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: tz });
      return `✦ <code>${d}</code>  <b>${st?.name || "—"}</b>\n    <i>${l.topic || "тема не указана"}</i>`;
    });

    await this.bot!.sendMessage(chatId,
      `📖 <b>ИСТОРИЯ ЗАНЯТИЙ</b>  ·  <code>${completed.length} последних</code>\n══════════════════════\n\n` + lines.join("\n\n"),
      { parse_mode: "HTML", reply_markup: { inline_keyboard: [
          [{ text: "📅 Сегодня", callback_data: "cmd_today" }, { text: "📆 Неделя", callback_data: "cmd_week" }],
          [{ text: "📊 Аналитика", callback_data: "cmd_stats" }],
          [{ text: "◀ Главное меню", callback_data: "cmd_menu" }],
        ]} }
    );
  }

  // ========================
  // VOICE — Whisper STT + OpenAI TTS
  // ========================

  /**
   * Скачивает любой файл из Telegram и сохраняет в /uploads/<uuid>.<ext>.
   * Возвращает публичный URL из Supabase Storage.
   */
  private async downloadAndStoreTelegramFile(
    fileId: string,
    mimeType?: string,
  ): Promise<{ url: string; mime: string; size: number } | null> {
    if (!this.bot) return null;
    try {
      const link = await this.bot.getFileLink(fileId);
      const r = await fetch(link);
      if (!r.ok) throw new Error(`Telegram file fetch ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());

      // Определяем расширение
      const mt = (mimeType || "").toLowerCase();
      let ext = "bin";
      if (mt.includes("jpeg") || mt.includes("jpg")) ext = "jpg";
      else if (mt.includes("png")) ext = "png";
      else if (mt.includes("webp")) ext = "webp";
      else if (mt.includes("gif")) ext = "gif";
      else if (mt.includes("pdf")) ext = "pdf";
      else if (mt.includes("msword") || mt.includes("officedocument.word")) ext = "docx";
      else if (mt.includes("ms-excel") || mt.includes("officedocument.spreadsheet")) ext = "xlsx";
      else if (mt.includes("text/plain")) ext = "txt";
      else {
        const m = link.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
        if (m) ext = m[1].toLowerCase();
        else ext = "jpg";
      }

      const fname = `${randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("uploads")
        .upload(fname, buf, { contentType: mimeType || `application/${ext}`, upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("uploads").getPublicUrl(fname);

      return {
        url: data.publicUrl,
        mime: mimeType || `application/${ext}`,
        size: buf.length,
      };
    } catch (e: any) {
      console.error("[Bot file download] error:", e?.message || e);
      return null;
    }
  }

  /**
   * Прогоняет фото-решения через GPT-4o Vision: даёт ученику быстрый
   * предварительный фидбек, а репетитору — подсказку для оценки.
   * Безопасно: при любой ошибке возвращает null.
   */
  private async runVisionCheckOnHomework(
    imageUrls: string[],
    hw: any,
  ): Promise<string | null> {
    if (!imageUrls.length) return null;
    try {
      const apiKey = (await storage.getAiSetting("openai_api_key").catch(() => null))
        || process.env.OPENAI_API_KEY
        || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      if (!apiKey) return null;

      const base = appUrl();
      const absUrls = imageUrls.slice(0, 4).map(u => u.startsWith("http") ? u : `${base}${u}`);
      const oai = new OpenAI({ apiKey });
      const resp = await oai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              `Ты — опытный преподаватель. Ученик прислал фото решения домашнего задания. ` +
              `Кратко (на русском, 4–8 строк): 1) скажи, верно ли решение в целом; ` +
              `2) укажи 1–3 главные ошибки или сильные места; 3) дай совет, что улучшить. ` +
              `Будь доброжелателен, без воды. Не выставляй оценку — это сделает репетитор.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Задание: ${hw?.title || "—"}.${hw?.description ? ` Условие: ${String(hw.description).slice(0, 600)}` : ""}` } as any,
              ...absUrls.map(u => ({ type: "image_url", image_url: { url: u } } as any)),
            ] as any,
          },
        ],
        max_tokens: 500,
      });
      return resp.choices[0]?.message?.content?.trim() || null;
    } catch (e: any) {
      console.error("[Bot Vision] error:", e?.message || e);
      return null;
    }
  }

  /** Завершает сдачу ДЗ: сохраняет text + files, уведомляет репетитора, запускает Vision. */
  private async finalizeHomeworkSubmission(
    chatId: string,
    student: Student,
    hw: any,
    solutionText: string,
    files: { url: string; kind: "image" | "doc" }[],
  ) {
    const urls = files.map(f => f.url);
    const images = files.filter(f => f.kind === "image").map(f => f.url);

    await storage.updateHomework(hw.id, {
      status: "submitted",
      submittedAt: new Date(),
      solutionText: solutionText || "",
      solutionAttachments: urls,
    } as any);
    this.dcDel(`sh:${student.id}`, `th:${hw.tutorId}`);

    const summary = [
      images.length ? `📷 ${images.length} фото` : null,
      (urls.length - images.length) ? `📄 ${urls.length - images.length} док.` : null,
      solutionText ? `✏️ текст` : null,
    ].filter(Boolean).join(" · ") || "без вложений";

    await this.bot!.sendMessage(chatId,
      `📤 <b>ЗАДАНИЕ СДАНО</b>\n══════════════════════\n` +
      `  ▸ <b>${this.escapeHtml(hw.title)}</b>\n` +
      `  ▸ <i>${summary}</i>\n` +
      `  ▸ Ожидайте проверки репетитора.`,
      { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📝 Мои задания", callback_data: "cmd_homework" }]] } }
    );

    const t = await this.dc_tutor(hw.tutorId);
    if (t?.tutorChatId) await this.notifyTutorHomeworkSubmitted(t.tutorChatId as string, student, hw);

    // Vision-проверка в фоне (не блокирует ответ)
    if (images.length) {
      this.bot!.sendMessage(chatId, `🔍 <i>ИИ проверяет твоё решение по фото…</i>`, { parse_mode: "HTML" }).catch(() => {});
      this.runVisionCheckOnHomework(images, hw).then(async (feedback) => {
        if (!feedback) return;
        // Шлём ученику
        await this.bot!.sendMessage(chatId,
          `🤖 <b>ИИ-проверка решения</b>  ·  <code>предварительно</code>\n══════════════════════\n${feedback}\n\n` +
          `<i>Это автоматическая подсказка. Финальную оценку поставит репетитор.</i>`,
          { parse_mode: "HTML" }
        ).catch(() => {});
        // Шлём репетитору как hint + сохраняем в hw.hints
        try {
          await storage.updateHomework(hw.id, { hints: feedback } as any);
        } catch {}
        if (t?.tutorChatId) {
          await this.bot!.sendMessage(t.tutorChatId as string,
            `🤖 <b>ИИ-подсказка по ДЗ</b>\n` +
            `Ученик: <b>${this.escapeHtml(student.name)}</b>\n` +
            `Задание: <i>${this.escapeHtml(hw.title)}</i>\n══════════════════════\n${feedback}`,
            { parse_mode: "HTML" }
          ).catch(() => {});
        }
      }).catch(() => {});
    }
  }

  /** Скачивает голосовой/аудио файл из Telegram и распознаёт через Whisper. */
  private async transcribeTelegramVoice(fileId: string, mimeType?: string): Promise<string | null> {
    if (!this.bot) return null;
    const apiKey = (await storage.getAiSetting("openai_api_key").catch(() => null))
      || process.env.OPENAI_API_KEY
      || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey) return null;

    // Telegram даёт прямую ссылку на файл — самый простой путь.
    const link = await this.bot.getFileLink(fileId);
    const r = await fetch(link);
    if (!r.ok) throw new Error(`Telegram file fetch ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());

    // Расширение для Whisper. Telegram voice = ogg/opus, audio = mp3/m4a, video_note = mp4.
    const mt = (mimeType || "").toLowerCase();
    const ext = mt.includes("mp4") || mt.includes("m4a") ? "m4a"
      : mt.includes("mpeg") || mt.includes("mp3") ? "mp3"
      : mt.includes("webm") ? "webm"
      : mt.includes("wav") ? "wav"
      : "ogg";

    const { toFile } = await import("openai");
    const oai = new OpenAI({ apiKey });
    const file = await toFile(buf, `voice.${ext}`, { type: mimeType || `audio/${ext}` });
    const result = await oai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "ru",
    });
    return ((result as any).text || "").trim() || null;
  }

  /**
   * Озвучивает ответ AI через OpenAI TTS и шлёт пользователю как Telegram voice.
   * Безопасно: при любой ошибке просто молча не отправляет.
   */
  private async sendVoiceReply(chatId: string, text: string): Promise<void> {
    if (!this.bot || !text) return;
    try {
      const apiKey = (await storage.getAiSetting("openai_api_key").catch(() => null))
        || process.env.OPENAI_API_KEY
        || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      if (!apiKey) return;

      // TTS бывает дорогим/долгим — отрезаем длинные ответы для голоса.
      // Полный текст пользователь уже видит в чате.
      const SPEAK_MAX = 1200;
      const speakable = text.length > SPEAK_MAX
        ? text.slice(0, SPEAK_MAX).replace(/\s+\S*$/, "") + "…"
        : text;

      const oai = new OpenAI({ apiKey });
      const speech = await oai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: speakable,
        // OGG/OPUS — родной формат Telegram voice, шлётся как «голосовое».
        response_format: "opus",
      });
      const buf = Buffer.from(await speech.arrayBuffer());
      await this.bot.sendVoice(chatId, buf, {}, {
        filename: "answer.ogg",
        contentType: "audio/ogg",
      } as any);
    } catch (e: any) {
      console.error("[Bot TTS] error:", e?.message || e);
    }
  }

  private async handleAskAI(chatId: string, question: string, tutor: Tutor | null, student: Student | null, replyVoice: boolean = false) {
    try {
      // Ищем ключ в том же порядке, что и веб-приложение
      const dbKey = await storage.getAiSetting("openai_api_key").catch(() => null);
      const apiKey = dbKey
        || process.env.OPENAI_API_KEY
        || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      if (!apiKey) {
        await this.bot!.sendMessage(chatId,
          `⛔ <b>ИИ-ассистент не настроен</b>\n\nAPI-ключ OpenAI не найден.\nНастройте его в разделе «Настройки → ИИ» в веб-приложении.`,
          { parse_mode: "HTML" });
        return;
      }
      const openai = new OpenAI({
        apiKey,
        ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && !dbKey && !process.env.OPENAI_API_KEY
          ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
      });
      const role = tutor ? "репетитор" : "ученик";
      const subject = tutor
        ? `Предметы: ${(tutor.subjects || []).join(", ") || "разные"}.`
        : `Предмет обучения: ${(student as any)?.subject || "не указан"}.`;
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `Ты ИИ-ассистент образовательной платформы "Твой Вектор". Пользователь — ${role}. ${subject} Отвечай кратко, по делу, на русском языке.` },
          { role: "user", content: question },
        ],
        max_tokens: 600,
      });
      const answer = resp.choices[0]?.message?.content?.trim() || "Нет ответа.";
      await this.bot!.sendMessage(chatId,
        `🤖 <b>ИИ-АССИСТЕНТ</b>  ·  <code>GPT-4o</code>\n══════════════════════\n` +
        `<i>${this.escapeHtml(question)}</i>\n` +
        `══════════════════════\n\n` +
        `${answer}`,
        { parse_mode: "HTML" }
      );
      // Если вопрос пришёл голосом — отвечаем ещё и голосом.
      if (replyVoice) {
        // Не блокируем — пусть TTS катится в фоне.
        this.sendVoiceReply(chatId, answer).catch(() => {});
      }
    } catch (err: any) {
      console.error("[Bot AI error]", err?.message || err);
      const errMsg = err?.message?.includes("API key") ? "Неверный API-ключ." :
                     err?.message?.includes("quota") ? "Лимит запросов исчерпан." :
                     "Попробуйте позже.";
      await this.bot!.sendMessage(chatId, `⛔ Ошибка ИИ: ${errMsg}`).catch(() => {});
    }
  }

  // ========================
  // LESSON REMINDERS
  // ========================

  // Persistent dedup: survive server restarts via DB
  private async isReminderSentPersistent(key: string): Promise<boolean> {
    if (this.remindersSent.has(key)) return true;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const stored = await storage.getAiSetting(`reminders_sent_${today}`);
      if (!stored) return false;
      const keys: string[] = JSON.parse(stored);
      if (keys.includes(key)) { this.remindersSent.add(key); return true; }
    } catch {}
    return false;
  }

  private async markReminderSentPersistent(key: string): Promise<void> {
    this.remindersSent.add(key);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const storageKey = `reminders_sent_${today}`;
      const stored = await storage.getAiSetting(storageKey);
      const keys: string[] = stored ? JSON.parse(stored) : [];
      if (!keys.includes(key)) {
        keys.push(key);
        await storage.setAiSetting(storageKey, JSON.stringify(keys.slice(-500)));
      }
    } catch {}
  }

  // Load today's sent keys from DB at startup to survive restarts
  private async loadPersistedReminders(): Promise<void> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const stored = await storage.getAiSetting(`reminders_sent_${today}`);
      if (stored) {
        const keys: string[] = JSON.parse(stored);
        keys.forEach(k => this.remindersSent.add(k));
      }
    } catch {}
  }

  startReminderCron() {
    this.loadPersistedReminders().catch(() => {});
    setInterval(() => this.sendLessonReminders(), 5 * 60 * 1000);
    setInterval(() => this.sendTomorrowReminders(), 60 * 60 * 1000);
    setInterval(() => this.sendHomeworkDeadlineReminders(), 60 * 60 * 1000);
    setInterval(() => this.sendBirthdayReminders(), 60 * 60 * 1000);
    setInterval(() => this.sendQuizNudges(), 60 * 60 * 1000); // тренажёры: раз в час
    setTimeout(() => this.sendLessonReminders(), 15000);
    setTimeout(() => this.sendTomorrowReminders(), 20000);
    setTimeout(() => this.sendHomeworkDeadlineReminders(), 25000);
    setTimeout(() => this.sendBirthdayReminders(), 30000);
    setTimeout(() => this.sendQuizNudges(), 35000);
  }

  /**
   * Проактивный quiz-режим: бот сам гоняет ученика по тренажёрам между занятиями.
   *  - не чаще 1 пуша в сутки на ученика
   *  - окно: с 10:00 до 21:00 в TZ репетитора
   *  - не пушить, если есть занятие в ближайшие 2 часа
   *  - выбираем тренажёр, который ученик НЕ проходил последние 24ч
   */
  private async sendQuizNudges() {
    if (!this.bot || !this.instanceValid) return;
    try {
      const tutors = await storage.getAllTutors();
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      for (const tutor of tutors) {
        const tz = (tutor as any).timezone || "Europe/Moscow";
        // Час в TZ репетитора
        const hour = parseInt(new Date().toLocaleString("ru-RU", { timeZone: tz, hour: "2-digit", hour12: false }));
        if (isNaN(hour) || hour < 10 || hour > 20) continue;

        const quizzes = await storage.getQuizzesByTutor(tutor.id);
        const active = quizzes.filter(q => q.status === 'active' && Array.isArray(q.questions) && (q.questions as any[]).length > 0);
        if (!active.length) continue;

        const students = await storage.getStudentsByTutorId(tutor.id);
        for (const s of students) {
          if (!(s as any).telegramChatId) continue;
          const chatId = String((s as any).telegramChatId);

          // Throttle: один пуш в сутки
          const throttleKey = `quiz_nudge_${s.id}`;
          const last = await storage.getAiSetting(throttleKey).catch(() => undefined);
          if (last && (now - new Date(last).getTime()) < dayMs) continue;

          // Не дёргать, если занятие в ближайшие 2ч
          const lessons = await storage.getLessonsByStudentId(s.id, 5).catch(() => []);
          const soon = lessons.find(l => {
            const t = new Date(l.scheduledAt).getTime();
            return t > now && t - now < 2 * 60 * 60 * 1000;
          });
          if (soon) continue;

          // Тренажёры доступные ученику (свои + общие шаблоны)
          const avail = active.filter(q => !q.studentId || q.studentId === s.id);
          if (!avail.length) continue;

          // Не предлагать те, что уже проходил за последние 24ч
          const recent = await storage.getQuizAttemptsByStudent(s.id, 50).catch(() => []);
          const recentIds = new Set(
            recent
              .filter(a => a.finishedAt && (now - new Date(a.finishedAt).getTime()) < dayMs)
              .map(a => a.quizId)
          );
          const candidates = avail.filter(q => !recentIds.has(q.id));
          if (!candidates.length) continue;

          // Берём самый «свежий» назначенный лично или старейший общий
          const personal = candidates.filter(q => q.studentId === s.id);
          const pick = personal[0] || candidates[candidates.length - 1];
          const qsCount = (pick.questions as any[]).length;

          await this.bot!.sendMessage(chatId,
            `🎯 <b>Время тренировки!</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
            `Между занятиями полезно повторить тему. Я подобрал тренажёр специально для тебя:\n\n` +
            `📚 <b>${this.escapeHtml(pick.topic)}</b>\n` +
            (pick.description ? `📝 ${this.escapeHtml(pick.description)}\n` : ``) +
            `❓ Вопросов: <b>${qsCount}</b> · займёт ~${Math.max(2, qsCount)} мин`,
            {
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [
                [{ text: "🚀 Начать", callback_data: `quiz_start_${pick.id}` }],
                [{ text: "📋 Выбрать другой", callback_data: "s_quiz" },
                 { text: "🔕 Не сейчас",      callback_data: "quiz_snooze" }],
              ] },
            }
          ).catch(() => {});

          await storage.setAiSetting(throttleKey, new Date().toISOString()).catch(() => {});
        }
      }
    } catch (e) {
      console.error("[quiz-nudge] error:", e);
    }
  }

  private async sendLessonReminders() {
    if (!this.bot) return;
    try {
      if (!this.instanceValid) return;
      const tutors = await storage.getAllTutors();
      const now = new Date();
      const base = this.getAppUrl();

      for (const tutor of tutors) {
        const tz = (tutor as any).timezone || "Europe/Moscow";
        const lessons = await this.dc_tutorLessons(tutor.id);
        const students = await this.dc_tutorStudents(tutor.id);

        for (const lesson of lessons) {
          if (lesson.status !== "pending") continue;
          const lessonTime = new Date(lesson.scheduledAt);
          const diffMin = (lessonTime.getTime() - now.getTime()) / 60000;
          if (diffMin < 55 || diffMin > 65) continue;

          const student = students.find(s => s.id === lesson.studentId);
          const timeStr = formatDateTimeRu(lessonTime, tz);
          const sLinks = (student as any)?.links as { conference?: string; board?: string } | undefined;
          const rawConf = sLinks?.conference || (lesson as any).conferenceLink || "";
          const confLink = rawConf ? (rawConf.startsWith("http") ? rawConf : base ? `${base}${rawConf.startsWith("/") ? "" : "/"}${rawConf}` : "") : "";
          const rawBoard = sLinks?.board || "";
          const boardLink = rawBoard ? (rawBoard.startsWith("http") ? rawBoard : base ? `${base}${rawBoard.startsWith("/") ? "" : "/"}${rawBoard}` : "") : (base ? `${base}/board/${lesson.studentId}` : "");

          // Кнопки управления уроком прямо из напоминания
          const linkButtons: any[] = [];
          if (confLink)  linkButtons.push({ text: "🎥 Конференция", url: confLink });
          if (boardLink) linkButtons.push({ text: "🖊 Доска",        url: boardLink });
          const actionButtons = [
            { text: "✅ Подтвердить", callback_data: `lconf_${lesson.id}` },
            { text: "⏭ Перенести",   callback_data: `lresc_${lesson.id}` },
            { text: "❌ Отменить",   callback_data: `lcanc_${lesson.id}` },
          ];
          const buildKb = () => {
            const kb: any[][] = [];
            if (linkButtons.length) kb.push(linkButtons);
            kb.push(actionButtons);
            return kb;
          };

          const tutorKey = `1h_${lesson.id}_tutor`;
          if (!(await this.isReminderSentPersistent(tutorKey)) && tutor.tutorChatId) {
            let text =
              `🔔 <b>НАПОМИНАНИЕ</b>  ·  <code>1 ЧАС</code>\n══════════════════════\n\n` +
              `◆ УЧЕНИК\n` +
              `  ▸ <b>${student?.name || "—"}</b>  <code>${student?.subject || ""}</code>\n\n` +
              `◆ УРОК\n` +
              `  ▸ Тема:  <i>${lesson.topic || "не указана"}</i>\n` +
              `  ▸ Время:  <code>${timeStr}</code>`;
            try {
              await this.bot.sendMessage(tutor.tutorChatId, text, {
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: buildKb() },
              });
              await this.markReminderSentPersistent(tutorKey);
            } catch {}
          }

          if (student?.telegramChatId) {
            const studentKey = `1h_${lesson.id}_${student.id}`;
            if (!(await this.isReminderSentPersistent(studentKey))) {
              let text =
                `🔔 <b>НАПОМИНАНИЕ</b>  ·  <code>1 ЧАС</code>\n══════════════════════\n\n` +
                `◆ УРОК\n` +
                `  ▸ Предмет:  <code>${student.subject}</code>\n` +
                `  ▸ Тема:  <i>${lesson.topic || "не указана"}</i>\n` +
                `  ▸ Время:  <code>${timeStr}</code>\n` +
                `  ▸ Репетитор:  <b>${tutor.name}</b>`;
              try {
                await this.bot.sendMessage(student.telegramChatId, text, {
                  parse_mode: "HTML",
                  reply_markup: { inline_keyboard: buildKb() },
                });
                await this.markReminderSentPersistent(studentKey);
              } catch {}
            }
          }
        }
      }
    } catch {}
  }

  private async sendBirthdayReminders() {
    if (!this.instanceValid) return;
    try {
      const tutors = await storage.getAllTutors();
      const now = new Date();
      const todayMonth = now.getMonth() + 1;
      const todayDay = now.getDate();
      const dateKey = `${todayMonth}-${todayDay}`;

      for (const tutor of tutors) {
        const students = await this.dc_tutorStudents(tutor.id);
        for (const student of students) {
          if (!(student as any).birthday) continue;
          const bday = new Date((student as any).birthday);
          if (bday.getMonth() + 1 !== todayMonth || bday.getDate() !== todayDay) continue;

          const notifKey = `bday_${student.id}_${now.getFullYear()}`;
          if (await this.isReminderSentPersistent(notifKey)) continue;
          await this.markReminderSentPersistent(notifKey);

          // Create in-app notification
          await storage.createNotification({
            tutorId: tutor.id,
            type: "birthday",
            title: `🎂 День рождения: ${student.name}`,
            message: `Сегодня день рождения у ${student.name}! Не забудьте поздравить.`,
            relatedId: student.id,
            isRead: false,
          });

          // Send Telegram if connected
          if (tutor.tutorChatId) {
            const age = now.getFullYear() - bday.getFullYear();
            await this.sendToTutor(tutor.id,
              `🎂 <b>ДЕНЬ РОЖДЕНИЯ</b>\n══════════════════════\n\n` +
              `◆ <b>${student.name}</b> — <code>${student.subject}</code>\n` +
              `◆ Исполняется: <b>${age} лет</b>\n\n` +
              `Не забудьте поздравить ученика! 🎉`
            );
          }
        }
      }
    } catch {}
  }

  // ========================
  // TOMORROW LESSON REMINDERS (sent once per day, evening)
  // ========================

  private async sendTomorrowReminders() {
    if (!this.bot) return;
    if (!this.instanceValid) return;
    try {
      const now = new Date();
      // Only run between 19:00 and 21:00 Moscow time
      const moscowHour = Number(now.toLocaleString("ru-RU", { timeZone: "Europe/Moscow", hour: "numeric", hour12: false }));
      if (moscowHour < 19 || moscowHour >= 21) return;

      const todayKey = now.toISOString().slice(0, 10);
      const tutors = await storage.getAllTutors();
      const base = this.getAppUrl();

      for (const tutor of tutors) {
        const tz = (tutor as any).timezone || "Europe/Moscow";
        const lessons = await this.dc_tutorLessons(tutor.id);
        const students = await this.dc_tutorStudents(tutor.id);

        const tomorrowLessons = lessons.filter(l => {
          if (l.status !== "pending") return false;
          const lt = new Date(l.scheduledAt);
          const diff = lt.getTime() - now.getTime();
          return diff > 12 * 3600000 && diff < 30 * 3600000;
        });

        if (tomorrowLessons.length === 0) continue;

        for (const lesson of tomorrowLessons) {
          const student = students.find(s => s.id === lesson.studentId);
          const timeStr = formatDateTimeRu(new Date(lesson.scheduledAt), tz);
          const sLinks = (student as any)?.links as { conference?: string; board?: string } | undefined;
          const rawConf = sLinks?.conference || (lesson as any).conferenceLink || "";
          const confLink = rawConf ? (rawConf.startsWith("http") ? rawConf : base ? `${base}${rawConf.startsWith("/") ? "" : "/"}${rawConf}` : "") : "";
          const rawBoard = sLinks?.board || "";
          const boardLink = rawBoard ? (rawBoard.startsWith("http") ? rawBoard : base ? `${base}${rawBoard.startsWith("/") ? "" : "/"}${rawBoard}` : "") : (base ? `${base}/board/${lesson.studentId}` : "");

          const tutorKey = `tomorrow_${lesson.id}_tutor_${todayKey}`;
          if (!(await this.isReminderSentPersistent(tutorKey)) && tutor.tutorChatId) {
            let text =
              `📅 <b>УРОК ЗАВТРА</b>\n══════════════════════\n\n` +
              `◆ УЧЕНИК\n` +
              `  ▸ <b>${student?.name || "—"}</b>  <code>${student?.subject || ""}</code>\n\n` +
              `◆ УРОК\n` +
              `  ▸ Тема:  <i>${lesson.topic || "не указана"}</i>\n` +
              `  ▸ Время:  <code>${timeStr}</code>`;
            if (confLink) text += `\n\n◆ ССЫЛКА\n  ▸ <a href="${confLink}">🎥 Войти в конференцию</a>`;
            if (boardLink) text += `\n  ▸ <a href="${boardLink}">🖊 Открыть доску</a>`;
            text += `\n\nНе забудьте подготовиться! 🎯`;
            await this.sendToTutor(tutor.id, text);
            await this.markReminderSentPersistent(tutorKey);
          }

          if (student?.telegramChatId) {
            const studentKey = `tomorrow_${lesson.id}_${student.id}_${todayKey}`;
            if (!(await this.isReminderSentPersistent(studentKey))) {
              let text =
                `📅 <b>УРОК ЗАВТРА</b>\n══════════════════════\n\n` +
                `◆ УРОК\n` +
                `  ▸ Предмет:  <code>${student.subject}</code>\n` +
                `  ▸ Тема:  <i>${lesson.topic || "не указана"}</i>\n` +
                `  ▸ Время:  <code>${timeStr}</code>\n` +
                `  ▸ Репетитор:  <b>${tutor.name}</b>`;
              if (confLink) text += `\n\n◆ ССЫЛКА\n  ▸ <a href="${confLink}">🎥 Войти в конференцию</a>`;
              text += `\n\nПодготовьтесь заранее! 📚`;
              await this.sendToStudent(student.id, text);
              await this.markReminderSentPersistent(studentKey);
            }
          }
        }
      }
    } catch {}
  }

  // ========================
  // HOMEWORK DEADLINE REMINDERS
  // ========================

  private async sendHomeworkDeadlineReminders() {
    if (!this.bot) return;
    if (!this.instanceValid) return;
    try {
      const now = new Date();
      const tutors = await storage.getAllTutors();

      for (const tutor of tutors) {
        const students = await this.dc_tutorStudents(tutor.id);

        for (const student of students) {
          const homeworks = await storage.getHomeworkByStudentId(student.id);

          for (const hw of homeworks) {
            if (!hw.deadline) continue;
            if (hw.status === "reviewed" || hw.status === "submitted") continue;

            const deadline = new Date(hw.deadline);
            const diffH = (deadline.getTime() - now.getTime()) / 3600000;
            const deadlineStr = deadline.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

            // 24-hour reminder
            if (diffH >= 23 && diffH <= 25) {
              const key = `hw_24h_${hw.id}`;
              if (!(await this.isReminderSentPersistent(key))) {
                await this.markReminderSentPersistent(key);
                if (student.telegramChatId) {
                  await this.sendToStudent(student.id,
                    `📝 <b>ДЕДЛАЙН ДЗ ЗАВТРА</b>\n══════════════════════\n\n` +
                    `◆ <b>${hw.title}</b>\n` +
                    `◆ Срок сдачи:  <code>${deadlineStr}</code>\n\n` +
                    `Осталось 24 часа. Не откладывайте! ⏰`
                  );
                }
                if (tutor.tutorChatId) {
                  await this.sendToTutor(tutor.id,
                    `📝 <b>ДЕДЛАЙН ДЗ ЗАВТРА</b>\n══════════════════════\n\n` +
                    `◆ Ученик:  <b>${student.name}</b>\n` +
                    `◆ ДЗ:  <i>${hw.title}</i>\n` +
                    `◆ Срок:  <code>${deadlineStr}</code>`
                  );
                }
              }
            }

            // 2-hour reminder
            if (diffH >= 1.8 && diffH <= 2.2) {
              const key = `hw_2h_${hw.id}`;
              if (!(await this.isReminderSentPersistent(key))) {
                await this.markReminderSentPersistent(key);
                if (student.telegramChatId) {
                  await this.sendToStudent(student.id,
                    `🚨 <b>ДЕДЛАЙН ДЗ ЧЕРЕЗ 2 ЧАСА</b>\n══════════════════════\n\n` +
                    `◆ <b>${hw.title}</b>\n` +
                    `◆ Срок:  <code>${deadlineStr}</code>\n\n` +
                    `Успейте сдать работу! ⚡`
                  );
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  // ========================
  // QUIZ FLOW (тренажёры)
  // ========================
  private async handleStudentQuizList(chatId: string, studentId: string): Promise<void> {
    const list = await storage.getQuizzesAvailableToStudent(studentId);
    if (!list.length) {
      await this.bot!.sendMessage(chatId,
        `🎯 <b>ТРЕНАЖЁРЫ</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
        `Пока нет доступных тренировок.\nПопроси репетитора создать тебе тест по нужной теме!`,
        { parse_mode: "HTML" });
      return;
    }
    const recent = await storage.getQuizAttemptsByStudent(studentId, 50);
    const buttons: TelegramBot.InlineKeyboardButton[][] = list.slice(0, 12).map(q => {
      const last = recent.find(a => a.quizId === q.id);
      const tag = last ? ` (${last.score}/${last.total})` : "";
      const qsCount = Array.isArray(q.questions) ? (q.questions as any[]).length : 0;
      return [{ text: `🎯 ${q.topic} · ${qsCount}в.${tag}`, callback_data: `quiz_start_${q.id}` }];
    });
    await this.bot!.sendMessage(chatId,
      `🎯 <b>ТРЕНАЖЁРЫ</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
      `Выбери тренировку. После ответа на каждый вопрос ты сразу увидишь, верно ли — и при неверном ответе получишь объяснение.`,
      { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  }

  private async startQuizSession(chatId: string, studentId: string, quizId: string): Promise<void> {
    // Проверка доступа: ученик может запускать только тренажёры своего репетитора
    const allowed = await storage.getQuizzesAvailableToStudent(studentId);
    if (!allowed.some(q => q.id === quizId)) {
      await this.bot!.sendMessage(chatId, "⛔ Этот тренажёр вам недоступен.");
      return;
    }
    const quiz = await storage.getQuiz(quizId);
    if (!quiz) { await this.bot!.sendMessage(chatId, "❌ Тренажёр не найден."); return; }
    const qs = (quiz.questions as any[]) || [];
    if (!qs.length) { await this.bot!.sendMessage(chatId, "❌ В тренажёре нет вопросов."); return; }
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.stateMap.set(chatId, {
      kind: 'quiz', quizId, studentId, idx: '0',
      answers: '[]', tutorId: quiz.tutorId, topic: quiz.topic, sessionId,
    });
    await this.bot!.sendMessage(chatId,
      `🎯 <b>${this.escapeHtml(quiz.topic)}</b>\n━━━━━━━━━━━━━━━━━━\n` +
      `Вопросов: <b>${qs.length}</b>. Поехали!`,
      { parse_mode: "HTML" });
    await this.sendQuizQuestion(chatId, quiz, 0);
  }

  private async sendQuizQuestion(chatId: string, quiz: any, idx: number): Promise<void> {
    const qs = quiz.questions as any[];
    const q = qs[idx];
    const sessionId = this.stateMap.get(chatId)?.sessionId || "x";
    const optButtons: TelegramBot.InlineKeyboardButton[][] = q.options.map((opt: string, oi: number) => [
      { text: `${String.fromCharCode(65 + oi)}. ${opt.slice(0, 60)}`, callback_data: `quiz_ans_${sessionId}_${idx}_${oi}` }
    ]);
    optButtons.push([{ text: "❌ Прервать", callback_data: "quiz_quit" }]);
    await this.bot!.sendMessage(chatId,
      `<b>Вопрос ${idx + 1}/${qs.length}</b>\n\n${this.escapeHtml(q.q)}`,
      { parse_mode: "HTML", reply_markup: { inline_keyboard: optButtons } });
  }

  private async handleQuizAnswer(chatId: string, studentId: string, sessionId: string, idx: number, chosen: number, origMsgId?: number): Promise<void> {
    const state = this.stateMap.get(chatId);
    if (!state || state.kind !== 'quiz') {
      await this.bot!.answerCallbackQuery("", { text: "Сессия истекла" } as any).catch(() => {});
      return;
    }
    // Защита от устаревших/повторных кликов
    if (state.sessionId && state.sessionId !== sessionId) return;
    if (parseInt(state.idx) !== idx) return; // уже ответили на этот шаг
    if (state.studentId !== studentId) return;
    const quiz = await storage.getQuiz(state.quizId);
    if (!quiz) { this.stateMap.delete(chatId); return; }
    const qs = (quiz.questions as any[]) || [];
    const q = qs[idx];
    if (!q) return;
    const isCorrect = chosen === q.correct;
    const answers: any[] = JSON.parse(state.answers || '[]');
    answers.push({ q: idx, chosen, correct: isCorrect });
    state.answers = JSON.stringify(answers);
    state.idx = String(idx + 1);
    this.stateMap.set(chatId, state);

    // Edit the question message: show feedback inline
    const correctLetter = String.fromCharCode(65 + q.correct);
    const feedback =
      (isCorrect
        ? `✅ <b>Верно!</b>`
        : `❌ <b>Неверно.</b> Правильный ответ: <b>${correctLetter}. ${this.escapeHtml(q.options[q.correct])}</b>`) +
      (q.explanation ? `\n💡 ${this.escapeHtml(q.explanation)}` : "");
    if (origMsgId) {
      await this.bot!.editMessageText(
        `<b>Вопрос ${idx + 1}/${qs.length}</b>\n\n${this.escapeHtml(q.q)}\n\n${feedback}`,
        { chat_id: chatId, message_id: origMsgId, parse_mode: "HTML" }
      ).catch(() => {});
    }

    // Next or finish
    if (idx + 1 < qs.length) {
      await this.sendQuizQuestion(chatId, quiz, idx + 1);
    } else {
      const score = answers.filter((a: any) => a.correct).length;
      const total = qs.length;
      const pct = Math.round((score / total) * 100);
      this.stateMap.delete(chatId);
      // Сохраняем попытку
      try {
        await storage.createQuizAttempt({
          quizId: quiz.id,
          studentId,
          tutorId: quiz.tutorId,
          answers: answers as any,
          score,
          total,
          source: 'telegram',
          finishedAt: new Date(),
        } as any);
      } catch (e) { console.error("[quiz] save attempt failed", e); }

      const emoji = pct >= 70 ? "🏆" : pct >= 40 ? "💪" : "📚";
      const msg = pct >= 70
        ? "Отличный результат!"
        : pct >= 40 ? "Неплохо, но есть к чему стремиться." : "Стоит ещё раз пройтись по теме.";
      await this.bot!.sendMessage(chatId,
        `${emoji} <b>ТРЕНИРОВКА ЗАВЕРШЕНА</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
        `📚 ${this.escapeHtml(quiz.topic)}\n` +
        `📊 Результат: <b>${score}/${total}</b> (${pct}%)\n\n` +
        `${msg}`,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [
            [{ text: "🔄 Пройти заново", callback_data: `quiz_start_${quiz.id}` }],
            [{ text: "📋 К списку", callback_data: "s_quiz" }],
          ] },
        }
      );
      // Уведомление репетитору
      try {
        const tutor = await storage.getTutor(quiz.tutorId);
        const studentObj = await storage.getStudent(studentId);
        if (tutor?.tutorChatId && studentObj) {
          await this.bot!.sendMessage(tutor.tutorChatId,
            `🎯 <b>${this.escapeHtml(studentObj.name)}</b> прошёл тренажёр\n` +
            `📚 ${this.escapeHtml(quiz.topic)}\n` +
            `📊 ${score}/${total} (${pct}%)`,
            { parse_mode: "HTML" }
          ).catch(() => {});
        }
      } catch {}
    }
  }

  private escapeHtml(s: string): string {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ========================
  // HELPERS
  // ========================

}

function formatDateRu(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
}

function formatDateTimeRu(d: Date, tz: string): string {
  return d.toLocaleString("ru-RU", {
    timeZone: tz, day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Парсит русские форматы даты/времени в Date с учётом таймзоны.
 * Поддерживает: "23.04 17:00", "23.04.2026 17:00", "23/04 17:00",
 * "сегодня 17:00", "завтра 17:00", "послезавтра 17:00", "17:00".
 * `referenceDate` используется для подстановки года и определения "сегодня".
 */
function parseDateTimeRu(input: string, tz: string, referenceDate: Date = new Date()): Date | null {
  if (!input) return null;
  const s = input.trim().toLowerCase().replace(/\s+/g, " ");

  // Достаём время HH:MM
  const tm = s.match(/(\d{1,2})[:.](\d{2})/);
  if (!tm) return null;
  const hh = parseInt(tm[1], 10);
  const mm = parseInt(tm[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  // Сегодня в нужной TZ
  const nowParts = new Date().toLocaleString("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).split(/[-,\s]/).filter(Boolean);
  let y = parseInt(nowParts[0], 10);
  let mo = parseInt(nowParts[1], 10);
  let d = parseInt(nowParts[2], 10);

  if (s.includes("послезавтра")) {
    const t = new Date(Date.UTC(y, mo - 1, d) + 2 * 86400000);
    y = t.getUTCFullYear(); mo = t.getUTCMonth() + 1; d = t.getUTCDate();
  } else if (s.includes("завтра")) {
    const t = new Date(Date.UTC(y, mo - 1, d) + 86400000);
    y = t.getUTCFullYear(); mo = t.getUTCMonth() + 1; d = t.getUTCDate();
  } else if (s.includes("сегодня")) {
    // оставляем сегодня
  } else {
    // Ищем DD.MM или DD.MM.YYYY (или со слешами)
    const dm = s.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
    if (dm) {
      d = parseInt(dm[1], 10);
      mo = parseInt(dm[2], 10);
      if (dm[3]) {
        y = parseInt(dm[3], 10);
        if (y < 100) y += 2000;
      }
    }
    // Иначе — оставляем сегодня (только время)
  }

  // Собираем дату в указанной TZ. Простой способ: создать в UTC ту же стенку часов,
  // вычислить смещение TZ и скорректировать.
  const utcGuess = Date.UTC(y, mo - 1, d, hh, mm, 0);
  const wallParts = new Date(utcGuess).toLocaleString("en-GB", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  // wallParts формата "DD/MM/YYYY, HH:MM"
  const m = wallParts.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2})/);
  if (!m) return new Date(utcGuess);
  const wallUtc = Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], 0);
  const offset = wallUtc - utcGuess;
  return new Date(utcGuess - offset);
}

function timeUntilStr(lessonTime: Date, now: Date): string {
  const diffMs = lessonTime.getTime() - now.getTime();
  if (diffMs < 0) return "уже началось";
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  if (h > 0) return `через ${h} ч ${m} мин`;
  return `через ${m} мин`;
}

// Singleton
export const botManager = new PlatformBotManager();
