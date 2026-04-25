import { supabase } from "./supabase";
import { generateStudentToken } from "./hmac-tokens";
import bcrypt from "bcrypt";
import { addDays, subDays, setHours, setMinutes, addHours, subHours, format } from "date-fns";
import { BUILTIN_SUPABASE_URL, BUILTIN_SUPABASE_SVC } from './builtin-config';

const TABLE_PREFIX = "Tvoy_vector_2_";

// ─── helpers ────────────────────────────────────────────────────────────────
function daysAgo(n: number) { return subDays(new Date(), n); }
function daysFromNow(n: number) { return addDays(new Date(), n); }
function at(base: Date, h: number, m = 0) { return setMinutes(setHours(base, h), m); }

// ─── schema migrations ───────────────────────────────────────────────────────

async function runSQL(query: string) {
  const baseUrl = (process.env.SUPABASE_URL || BUILTIN_SUPABASE_URL).replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY || BUILTIN_SUPABASE_SVC;
  await fetch(`${baseUrl}/pg/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query }),
  });
}

async function ensureColumns() {
  await runSQL(`
    ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS bot_token TEXT;
    ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS parent_link TEXT;
    ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS comment TEXT;
    ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS payment_info TEXT;
    ALTER TABLE "${TABLE_PREFIX}homework" ADD COLUMN IF NOT EXISTS solution_attachments text[] NOT NULL DEFAULT ARRAY[]::text[];
    ALTER TABLE "${TABLE_PREFIX}homework" ADD COLUMN IF NOT EXISTS solution_text text DEFAULT ''::text;
    ALTER TABLE "${TABLE_PREFIX}homework" ADD COLUMN IF NOT EXISTS score integer;
    ALTER TABLE "${TABLE_PREFIX}homework" ADD COLUMN IF NOT EXISTS hints text;
    ALTER TABLE "${TABLE_PREFIX}payments" ADD COLUMN IF NOT EXISTS yookassa_payment_id TEXT;
    ALTER TABLE "${TABLE_PREFIX}payments" ADD COLUMN IF NOT EXISTS yookassa_status TEXT;
    ALTER TABLE "${TABLE_PREFIX}payments" ADD COLUMN IF NOT EXISTS confirmation_url TEXT;
  `);
  console.log("✅ Added solution columns");
}

export async function ensureStudentApplicationsTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}student_applications" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      subject TEXT,
      grade TEXT,
      goal TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      student_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}student_applications_tutor_idx"
      ON "${TABLE_PREFIX}student_applications" (tutor_id, status, created_at DESC);
  `);
}

export async function ensurePromoCodesTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}promo_codes" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      discount_type TEXT NOT NULL DEFAULT 'percent',
      discount_value INTEGER NOT NULL,
      scope TEXT NOT NULL DEFAULT 'all',
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      valid_from TIMESTAMPTZ,
      valid_until TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}promo_codes_code_idx" ON "${TABLE_PREFIX}promo_codes" (code);
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}promo_codes_active_idx" ON "${TABLE_PREFIX}promo_codes" (is_active, valid_until);

    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}promo_code_redemptions" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      promo_code_id UUID NOT NULL,
      user_id UUID NOT NULL,
      user_role TEXT NOT NULL,
      scope TEXT NOT NULL,
      original_amount INTEGER NOT NULL,
      discount_amount INTEGER NOT NULL,
      final_amount INTEGER NOT NULL,
      reference_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}promo_redemptions_code_idx" ON "${TABLE_PREFIX}promo_code_redemptions" (promo_code_id);
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}promo_redemptions_user_idx" ON "${TABLE_PREFIX}promo_code_redemptions" (user_id, promo_code_id);

    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}processed_webhook_events" (
      event_id TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'yookassa',
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "${TABLE_PREFIX}promo_redemptions_unique_payment_idx"
      ON "${TABLE_PREFIX}promo_code_redemptions" (reference_id) WHERE reference_id IS NOT NULL;
  `);
}

async function ensureSessionsTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}sessions" (
      sid  TEXT PRIMARY KEY,
      sess JSONB NOT NULL,
      expire TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}sessions_expire_idx" ON "${TABLE_PREFIX}sessions" (expire);
  `);
}

async function ensureBoardsTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}boards" (
      student_id UUID PRIMARY KEY,
      snapshot JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function ensureBoardArchivesTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}board_archives" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL,
      snapshot JSONB,
      name TEXT NOT NULL DEFAULT 'Архив',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function ensureLessonHistoryTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}lesson_history" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_id UUID NOT NULL,
      student_id UUID NOT NULL,
      tutor_id UUID NOT NULL,
      old_status TEXT,
      new_status TEXT,
      old_attendance TEXT,
      new_attendance TEXT,
      note TEXT,
      changed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function ensureAvatarColumns() {
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS avatar TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS avatar TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS link_settings JSONB DEFAULT '{"showBbb":true,"showExternalConf":true,"showInternalBoard":true,"showExternalBoard":true}'::jsonb;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS telegram_token TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS tutor_chat_id TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS telegram_notifications_enabled BOOLEAN DEFAULT TRUE;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS tutor_telegram_notifications_enabled BOOLEAN DEFAULT TRUE;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS receipt_email TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS schedule_start INTEGER NOT NULL DEFAULT 8;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS schedule_end INTEGER NOT NULL DEFAULT 22;`);
  // Extended public profile fields
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS public_experience TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS public_education TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS public_whatsapp TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS public_vk TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS public_instagram TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS public_achievements TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS public_video_url TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS public_subject_info TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS public_color TEXT DEFAULT 'violet';`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS public_hide_price BOOLEAN DEFAULT FALSE;`);
}

async function ensureAiTables() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}ai_chats" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}students"(id) ON DELETE CASCADE,
      homework_id UUID REFERENCES "${TABLE_PREFIX}homework"(id) ON DELETE SET NULL,
      title TEXT NOT NULL DEFAULT 'Новый чат',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}ai_chat_messages" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID REFERENCES "${TABLE_PREFIX}ai_chats"(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}students"(id) ON DELETE CASCADE,
      homework_id UUID REFERENCES "${TABLE_PREFIX}homework"(id) ON DELETE SET NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}ai_settings" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}ai_usage" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}students"(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
      count INTEGER NOT NULL DEFAULT 1,
      UNIQUE(student_id, model, usage_date)
    );
    INSERT INTO "${TABLE_PREFIX}ai_settings" (key, value) VALUES
      ('openai_api_key', ''),
      ('deepseek_api_key', ''),
      ('daily_limit_openai', '50'),
      ('daily_limit_deepseek', '100'),
      ('daily_limit_gpt4o-mini', '100'),
      ('default_model', 'gpt4o-mini'),
      ('telegram_bot_token', '')
    ON CONFLICT (key) DO NOTHING;
  `);
  console.log("✅ AI chats table ready");
}

async function ensureBbbSettings() {
  const bbbUrl = process.env.BBB_URL || 'https://bigbluebutton.aiinvestor360.ru/bigbluebutton/';
  const bbbSecret = process.env.BBB_SECRET || 'iYnnvXFnYYNMtOsUppGajGZoXOdVXSFn';

  await runSQL(`
    INSERT INTO "${TABLE_PREFIX}ai_settings" (key, value) VALUES
      ('bbb_url', '${bbbUrl.replace(/'/g, "''")}'),
      ('bbb_secret', '${bbbSecret.replace(/'/g, "''")}')
    ON CONFLICT (key) DO NOTHING;
  `);
  console.log("✅ BBB settings ready");
}

async function ensureNewFeatureTables() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}student_access_tokens" (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      student_id VARCHAR NOT NULL REFERENCES "${TABLE_PREFIX}students"(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}student_access_tokens_token_idx" ON "${TABLE_PREFIX}student_access_tokens"(token);
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}student_access_tokens_student_idx" ON "${TABLE_PREFIX}student_access_tokens"(student_id);
  `);

  await runSQL(`
    ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS monthly_goals JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS tutor_notes TEXT;
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}homework_templates" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}tutors"(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      subject TEXT NOT NULL DEFAULT '',
      hints TEXT,
      estimated_minutes INTEGER DEFAULT 30,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}student_notes" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}students"(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(student_id)
    );
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}direct_messages" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}tutors"(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}students"(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      file_urls TEXT[] DEFAULT '{}',
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}direct_messages_student_idx" ON "${TABLE_PREFIX}direct_messages"(student_id, created_at);
    ALTER TABLE "${TABLE_PREFIX}direct_messages" ADD COLUMN IF NOT EXISTS file_urls TEXT[] DEFAULT '{}';
  `);
  console.log("✅ New feature tables ready");
}

async function ensureConferencesTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}conferences" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}tutors"(id) ON DELETE CASCADE,
      student_id UUID REFERENCES "${TABLE_PREFIX}students"(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      meeting_id TEXT NOT NULL,
      attendee_pw TEXT NOT NULL,
      moderator_pw TEXT NOT NULL,
      is_one_time BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}conferences_tutor_idx" ON "${TABLE_PREFIX}conferences"(tutor_id);
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}conferences_student_idx" ON "${TABLE_PREFIX}conferences"(student_id);
  `);
  console.log("✅ Conferences table ready");
}

async function ensureTaskBankTables() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}task_variants" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL,
      name TEXT NOT NULL,
      task_ids TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}task_variants_tutor_idx" ON "${TABLE_PREFIX}task_variants"(tutor_id);

    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}variant_assignments" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      variant_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}task_variants"(id) ON DELETE CASCADE,
      student_id UUID NOT NULL,
      tutor_id UUID NOT NULL,
      status TEXT NOT NULL DEFAULT 'assigned',
      assigned_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}variant_assignments_student_idx" ON "${TABLE_PREFIX}variant_assignments"(student_id);
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}variant_assignments_tutor_idx" ON "${TABLE_PREFIX}variant_assignments"(tutor_id);
  `);
  console.log("✅ Task bank tables ready");
}

async function ensureNewAdminTables() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}feature_flags" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}tutors"(id) ON DELETE CASCADE,
      feature TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(tutor_id, feature)
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}feature_flags_tutor_idx" ON "${TABLE_PREFIX}feature_flags"(tutor_id);

    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}support_tickets" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}tutors"(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}support_tickets_tutor_idx" ON "${TABLE_PREFIX}support_tickets"(tutor_id);

    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}support_messages" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}support_tickets"(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}support_messages_ticket_idx" ON "${TABLE_PREFIX}support_messages"(ticket_id);
  `);
  console.log("✅ Admin feature flags + support tickets tables ready");
}

// ─── refresh lessons so they are always relative to TODAY ────────────────────
async function refreshDemoLessons(tutorId: string, students: any[]) {
  // Delete all existing lessons for this tutor and recreate fresh
  await supabase.from(`${TABLE_PREFIX}lessons`).delete().eq("tutor_id", tutorId);

  const now = new Date();
  const lessonTopics: Record<string, string[]> = {
    "Математика": [
      "Производные: основные правила",
      "Производная сложной функции",
      "Применение производной к задачам",
      "Неопределённый интеграл",
      "Интеграл: метод подстановки",
      "Определённый интеграл",
      "Пределы функций",
      "Тригонометрические уравнения",
      "Логарифмы: свойства и уравнения",
      "Показательные уравнения",
      "Стереометрия: объёмы тел",
      "Планиметрия: задачи на площади",
      "Теория вероятностей",
      "Комбинаторика",
      "Числовые последовательности",
      "Пробный ЕГЭ: разбор ошибок",
    ],
    "Физика": [
      "Кинематика: равноускоренное движение",
      "Динамика: законы Ньютона",
      "Работа и кинетическая энергия",
      "Законы сохранения",
      "Давление и закон Архимеда",
      "Термодинамика: газовые законы",
      "Электрическое поле",
      "Законы постоянного тока",
      "Магнитное поле",
      "Электромагнитная индукция",
      "Оптика: законы отражения и преломления",
      "Квантовая физика",
      "Разбор олимпиадных задач",
      "Пробный ЕГЭ по физике",
    ],
    "Информатика": [
      "Python: основы синтаксиса",
      "Python: условия и циклы",
      "Python: функции и рекурсия",
      "Списки и словари",
      "Строки: методы и форматирование",
      "Алгоритмы сортировки",
      "Поиск в данных",
      "Объектно-ориентированное программирование",
      "Работа с файлами",
      "Базы данных: SQL основы",
      "Алгоритмы на графах",
      "Динамическое программирование",
      "Разбор задач ЕГЭ по информатике",
      "Олимпиадные задачи",
    ],
  };

  const lessonNotes = [
    "Хорошо поработали, тема усвоена на отлично",
    "Разобрали сложные задачи — ученик справился",
    "Нужно повторить прошлый материал на следующем занятии",
    "Отличный прогресс! Готовимся к экзамену по плану",
    "Разобрали типичные ошибки ЕГЭ",
    "Задали дополнительные задачи на дом для закрепления",
    "Прорыв! Наконец разобрались с тем, что не получалось",
    "Темп хороший, идём по программе",
    "Повторили базу и разобрали новую тему",
  ];

  const entries: any[] = [];

  for (const s of students) {
    const subj = s.subject as string;
    const topics = lessonTopics[subj] || ["Занятие"];
    // Each student has a fixed day-of-week slot
    const slotDay = s.slotDay as number; // 0=Mon,1=Tue,...
    const slotHour = s.slotHour as number;
    const duration = s.duration as number;

    // Build lessons from 52 weeks ago to 12 weeks ahead (full year)
    for (let w = -51; w <= 12; w++) {
      // Find the next occurrence of slotDay from now±w*7
      const weekStart = addDays(now, w * 7);
      const todayDow = weekStart.getDay(); // 0=Sun
      // slotDay: 1=Mon,...,5=Fri
      const diff = ((slotDay - todayDow) + 7) % 7;
      const lessonDate = at(addDays(weekStart, diff), slotHour);

      const isPast = lessonDate < now;

      // Determine status
      let status: string;
      let attendance: string | undefined;
      let rating: number | undefined;
      let notes: string | undefined;

      if (isPast) {
        const rnd = Math.random();
        if (rnd < 0.82) {
          status = "completed";
          attendance = Math.random() > 0.07 ? "attended" : "missed_paid";
          rating = Math.random() > 0.2 ? (Math.random() > 0.3 ? 5 : 4) : undefined;
          notes = lessonNotes[Math.floor(Math.random() * lessonNotes.length)];
        } else {
          status = "cancelled";
          attendance = "missed";
        }
      } else {
        status = "pending";
      }

      const topicIdx = ((w + 51) * 3 + s.topicOffset) % topics.length;

      entries.push({
        tutor_id: tutorId,
        student_id: s.id,
        scheduled_at: lessonDate.toISOString(),
        duration_minutes: duration,
        topic: topics[topicIdx],
        status,
        attendance: attendance ?? null,
        rating: rating ?? null,
        notes: notes ?? null,
      });
    }
  }

  const { error } = await supabase.from(`${TABLE_PREFIX}lessons`).insert(entries);
  if (error) console.error("Error refreshing lessons:", error);
  else console.log(`✅ Refreshed ${entries.length} lessons (always current)`);
}

// ─── payments ────────────────────────────────────────────────────────────────
async function seedPayments(tutorId: string, students: any[]) {
  // Always regenerate for a full year of payment history
  await supabase.from(`${TABLE_PREFIX}payments`).delete().eq("tutor_id", tutorId);

  const methods = ["перевод", "карта", "наличные", "СБП"];
  const entries: any[] = [];

  const paymentTemplates = [
    { comment: "Оплата за 4 занятия", lessonsMult: 4 },
    { comment: "Оплата за месяц", lessonsMult: 4 },
    { comment: "Предоплата на 3 занятия", lessonsMult: 3 },
    { comment: "Оплата за 8 занятий", lessonsMult: 8 },
    { comment: "Оплата за занятие", lessonsMult: 1 },
    { comment: "Доплата за месяц", lessonsMult: 4 },
    { comment: "Оплата за 5 занятий", lessonsMult: 5 },
    { comment: "Предоплата", lessonsMult: 6 },
  ];

  // Generate monthly payments for the past 12 months
  for (const s of students) {
    for (let month = 0; month < 12; month++) {
      const paymentsThisMonth = 1 + Math.floor(((s.topicOffset + month) % 3));
      for (let p = 0; p < paymentsThisMonth; p++) {
        const tpl = paymentTemplates[(p + s.topicOffset + month) % paymentTemplates.length];
        const daysBack = month * 30 + p * 10 + (s.topicOffset % 7);
        entries.push({
          tutor_id: tutorId,
          student_id: s.id,
          amount: s.price * tpl.lessonsMult,
          method: methods[(p + s.topicOffset + month) % methods.length],
          comment: tpl.comment,
          created_at: daysAgo(daysBack).toISOString(),
        });
      }
    }
  }

  await supabase.from(`${TABLE_PREFIX}payments`).insert(entries);
  console.log(`✅ Created ${entries.length} payments (12 months)`);
}

// ─── homework for Иван Смирнов (test student) ────────────────────────────────
async function seedHomeworkForTestStudent(tutorId: string, studentId: string) {
  const { data: existing } = await supabase
    .from(`${TABLE_PREFIX}homework`).select("id, score").eq("student_id", studentId);

  const hasScore = existing?.some((h: any) => h.score !== null && h.score !== undefined);
  if (hasScore) return;

  if (existing && existing.length > 0) {
    await supabase.from(`${TABLE_PREFIX}homework`).delete().eq("student_id", studentId);
  }

  const entries = [
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Производные элементарных функций",
      description: "Найти производные для 10 функций из учебника. Задачи №12–22 на стр. 145. Оформить решение пошагово с пояснениями.",
      completion_pct: 100, status: "reviewed",
      deadline: daysAgo(5).toISOString(),
      feedback: "Отлично! Все задачи решены верно. Особенно хорошо справился с производной сложной функции в задаче №19.",
      score: 95,
      hints: "Вспомни формулу производной сложной функции: (f(g(x)))' = f'(g(x)) · g'(x)",
      solution_text: "Решил все 10 задач. В №18 использовал правило цепочки, в №22 — формулу произведения.",
      task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Таблица производных — выучить наизусть",
      description: "Выучить таблицу производных основных функций. На следующем занятии будет мини-тест на 15 минут без шпаргалки.",
      completion_pct: 100, status: "reviewed",
      deadline: daysAgo(12).toISOString(),
      feedback: "Хорошо, но формулы тригонометрических производных надо повторить. (sin x)' = cos x, (cos x)' = −sin x",
      score: 78, task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Интегралы: метод подстановки",
      description: "Решить 8 интегралов методом подстановки. Задачи из сборника Демидовича №234–242. Записать замену явно.",
      completion_pct: 35, status: "in_progress",
      deadline: daysFromNow(3).toISOString(),
      hints: "Ищи, какая часть подынтегрального выражения является производной другой. Обозначь её за t, найди dt.",
      task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Пробный вариант ЕГЭ №14",
      description: "Решить полный вариант ЕГЭ в условиях экзамена. Обратить внимание на задачи 12–18 (2 часть). Время: 3 часа 55 минут.",
      completion_pct: 0, status: "assigned",
      deadline: daysFromNow(7).toISOString(),
      hints: "Начни с 1 части — она быстрее. На 2 часть оставь не менее 1.5 часов. Задачу 19 пропусти, если не уверен.",
      task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Геометрический смысл производной",
      description: "Построить графики касательных к функциям. Задачи 1–5 из листочка. Вычислить угловой коэффициент для каждой касательной.",
      completion_pct: 100, status: "reviewed",
      deadline: daysAgo(20).toISOString(),
      feedback: "Графики аккуратные! Но в задаче 4 ошибка в вычислении углового коэффициента — пересчитай k = f'(x₀).",
      score: 82, task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Применение производной: экстремумы функций",
      description: "Исследовать 3 функции: найти экстремумы, промежутки монотонности, точки перегиба. Построить графики.",
      completion_pct: 20, status: "in_progress",
      deadline: daysFromNow(5).toISOString(),
      hints: "1) Найди f'(x) и приравняй к нулю. 2) Определи знак f'(x) на каждом промежутке. 3) Найди f''(x) для выпуклости.",
      task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Тест по теории пределов",
      description: "Ответить на 15 вопросов теста по теории пределов. Время выполнения: 45 минут. Формулы разрешены.",
      completion_pct: 100, status: "submitted",
      deadline: daysAgo(1).toISOString(),
      submitted_at: daysAgo(2).toISOString(),
      solution_text: "Ответы: 1-В, 2-А, 3-Г, 4-Б, 5-В, 6-А, 7-Г, 8-В, 9-Б, 10-А, 11-В, 12-Г, 13-А, 14-Б, 15-В",
      task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Логарифмы и показательные уравнения",
      description: "Решить 12 уравнений из раздела «Логарифмы». Стр. 89–92 учебника Мордковича. Проверить ОДЗ в каждом задании.",
      completion_pct: 100, status: "reviewed",
      deadline: daysAgo(25).toISOString(),
      feedback: "Молодец! 11 из 12 верно. В задаче 7 потерял ОДЗ — помни: аргумент логарифма должен быть строго больше 0.",
      score: 88, task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Тригонометрические уравнения",
      description: "Решить 6 тригонометрических уравнений. Записать общее решение в стандартном виде. Проверить по одному решению.",
      completion_pct: 100, status: "reviewed",
      deadline: daysAgo(32).toISOString(),
      feedback: "Хорошо! Но в задаче 3 забыл вторую ветку. Всегда проверяй оба знака для sin и cos.",
      score: 72,
      hints: "sin x = a → x = (−1)ⁿ·arcsin(a) + πn. cos x = a → x = ±arccos(a) + 2πn",
      task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Планиметрия: площади фигур",
      description: "Решить 5 задач на вычисление площадей. Задачи из сборника ФИПИ, блок «Геометрия». Нарисовать чертёж к каждой.",
      completion_pct: 55, status: "in_progress",
      deadline: daysFromNow(2).toISOString(),
      hints: "Формула Герона для треугольника: S = √(p(p−a)(p−b)(p−c)), p = (a+b+c)/2. Не забудь про неё.",
      task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Стереометрия: объёмы тел вращения",
      description: "Найти объёмы пирамиды, конуса и цилиндра по чертежам. Задачи 1–8 из раздела «Стереометрия».",
      completion_pct: 0, status: "assigned",
      deadline: daysFromNow(10).toISOString(),
      hints: "V(пирамиды) = ⅓·S(основания)·h. V(конуса) = ⅓·π·r²·h. V(цилиндра) = π·r²·h",
      task_ids: [], attachments: [],
    },
    {
      tutor_id: tutorId, student_id: studentId,
      title: "Теория вероятностей: классическое определение",
      description: "Решить 10 задач на классическое определение вероятности. Задания из ЕГЭ (задача 4).",
      completion_pct: 100, status: "reviewed",
      deadline: daysAgo(15).toISOString(),
      feedback: "Все верно! Отличная работа. Задачу 8 решил элегантно через формулу включений-исключений.",
      score: 100, task_ids: [], attachments: [],
    },
  ];

  const { error } = await supabase.from(`${TABLE_PREFIX}homework`).insert(entries);
  if (error) console.error("Error seeding homework:", error);
  else console.log(`✅ Created ${entries.length} homework assignments for test student`);
}

// ─── homework for other students ─────────────────────────────────────────────
async function seedHomeworkForOtherStudents(tutorId: string, students: any[]) {
  const otherStudents = students.filter(s => s.email !== "student@vector.ru");

  const homeworkBySubject: Record<string, any[]> = {
    "Физика": [
      { title: "Кинематика: задачи на равноускоренное движение", description: "Решить задачи 45–52 из сборника Рымкевича. Каждую задачу оформить с чертежом." },
      { title: "Законы Ньютона: 10 задач", description: "Задачи из вариантов ЕГЭ 2023 года. Обратить внимание на задачи с наклонной плоскостью." },
      { title: "Олимпиадная задача: движение в поле тяжести", description: "Разобрать и решить задачу о брошенном теле с сопротивлением воздуха. Уровень всероссийской олимпиады." },
    ],
    "Информатика": [
      { title: "Python: написать сортировку пузырьком", description: "Реализовать алгоритм сортировки пузырьком на Python. Проверить на 5 тестовых случаях. Добавить счётчик сравнений." },
      { title: "SQL: запросы к базе данных", description: "Написать 8 SQL-запросов разной сложности к схеме интернет-магазина. Задания в файле на платформе." },
      { title: "Алгоритм: задача на динамическое программирование", description: "Решить задачу о рюкзаке. Реализовать на Python, объяснить сложность алгоритма." },
    ],
  };

  const mathHomework = [
    { title: "Квадратные уравнения: дискриминант", description: "Решить 15 квадратных уравнений разными методами. Стр. 67–70." },
    { title: "Алгебра: системы уравнений", description: "Решить 8 систем уравнений методом подстановки и сложения. Проверить каждый ответ." },
    { title: "Геометрия: теорема Пифагора и применения", description: "Задачи 1–10 на применение теоремы Пифагора. Построить чертёж к каждой задаче." },
  ];

  const reviewedFeedbacks = [
    "Хорошая работа! Есть пара небольших ошибок — разберём на занятии.",
    "Отличный результат! Продолжай в том же духе.",
    "Неплохо, но есть ошибки в оформлении. Смотри требования к записи решения.",
    "Молодец! Сложные задачи решены верно. Работай над скоростью.",
    "Хорошо! Но нужно проверять ответы — в задаче 5 арифметическая ошибка.",
  ];

  const entries: any[] = [];

  for (const s of otherStudents) {
    const homeworkList =
      s.subject === "Физика" ? homeworkBySubject["Физика"] :
      s.subject === "Информатика" ? homeworkBySubject["Информатика"] :
      mathHomework;

    for (let i = 0; i < homeworkList.length; i++) {
      const hw = homeworkList[i];
      const isLast = i === homeworkList.length - 1;
      const isMiddle = i === 1;

      let status: string, completion_pct: number, score: any, feedback: any, deadline: string;

      if (i === 0) {
        status = "reviewed"; completion_pct = 100;
        score = 70 + ((s.topicOffset * 7 + i * 11) % 31);
        feedback = reviewedFeedbacks[(s.topicOffset + i) % reviewedFeedbacks.length];
        deadline = daysAgo(10 + s.topicOffset * 3).toISOString();
      } else if (isMiddle) {
        status = Math.random() > 0.5 ? "in_progress" : "submitted";
        completion_pct = status === "submitted" ? 100 : 30 + (s.topicOffset * 13) % 50;
        deadline = daysFromNow(3 + (s.topicOffset % 4)).toISOString();
      } else {
        status = "assigned"; completion_pct = 0;
        deadline = daysFromNow(7 + (s.topicOffset % 7)).toISOString();
      }

      entries.push({
        tutor_id: tutorId,
        student_id: s.id,
        title: hw.title,
        description: hw.description,
        completion_pct,
        status,
        deadline,
        score: status === "reviewed" ? score : null,
        feedback: status === "reviewed" ? feedback : null,
        task_ids: [],
        attachments: [],
      });
    }
  }

  const { error } = await supabase.from(`${TABLE_PREFIX}homework`).insert(entries);
  if (error) console.error("Error seeding other homework:", error);
  else console.log(`✅ Created ${entries.length} homework assignments for other students`);
}

// ─── AI chats for Иван ────────────────────────────────────────────────────────
async function seedAiChatsForTestStudent(studentId: string) {
  const { data: existing } = await supabase
    .from(`${TABLE_PREFIX}ai_chats`).select("id").eq("student_id", studentId);
  if (existing && existing.length > 0) return;

  const now = new Date();
  const chats = [
    { student_id: studentId, title: "Метод подстановки в интегралах", created_at: daysAgo(2).toISOString(), updated_at: daysAgo(2).toISOString() },
    { student_id: studentId, title: "Производная сложной функции", created_at: daysAgo(5).toISOString(), updated_at: daysAgo(5).toISOString() },
    { student_id: studentId, title: "Что такое предел функции?", created_at: daysAgo(9).toISOString(), updated_at: daysAgo(9).toISOString() },
  ];

  const { data: insertedChats, error } = await supabase
    .from(`${TABLE_PREFIX}ai_chats`).insert(chats).select();
  if (error || !insertedChats) return;

  const messages: any[] = [
    // Chat 1 — метод подстановки
    { chat_id: insertedChats[0].id, student_id: studentId, role: "user", content: "Привет! Объясни метод подстановки в интегралах. Как понять, что именно подставлять?", created_at: daysAgo(2).toISOString() },
    { chat_id: insertedChats[0].id, student_id: studentId, role: "assistant", content: "Привет! Отличный вопрос 🎯\n\nМетод подстановки работает так: если в интеграле есть «вложенная» функция, которая встречается внутри другой — заменяем её на новую переменную.\n\n**Алгоритм:**\n1. Найди «кандидата» — функцию $g(x)$, которая стоит внутри другой\n2. Проверь: её производная $g'(x)$ тоже присутствует рядом?\n3. Если да — делай замену $t = g(x)$, тогда $dt = g'(x)\\,dx$\n4. Интеграл упростится до $\\int f(t)\\,dt$\n5. После вычисления верни $x$\n\n**Пример:** $\\int 2x \\cdot \\cos(x^2)\\,dx$\n\nВидишь: внутри $\\cos$ стоит $x^2$, а рядом — его производная $2x$. Делаем:\n$$t = x^2,\\quad dt = 2x\\,dx$$\n$$\\int \\cos(t)\\,dt = \\sin(t) + C = \\sin(x^2) + C$$\n\nКакой интеграл тебе нужно решить?", created_at: daysAgo(2).toISOString() },
    { chat_id: insertedChats[0].id, student_id: studentId, role: "user", content: "Понял! А если написано ∫ 3x²·e^(x³) dx?", created_at: daysAgo(2).toISOString() },
    { chat_id: insertedChats[0].id, student_id: studentId, role: "assistant", content: "Идеальный пример! Разбираем:\n\n$$\\int 3x^2 \\cdot e^{x^3}\\,dx$$\n\n**Шаг 1:** Что внутри $e^{\\square}$? Это $x^3$.\n\n**Шаг 2:** Производная $x^3$ равна $3x^2$ — а она стоит перед $e$! 🎉\n\n**Шаг 3:** Замена:\n$$t = x^3, \\quad dt = 3x^2\\,dx$$\n\n**Шаг 4:** Подставляем:\n$$\\int e^t\\,dt = e^t + C$$\n\n**Шаг 5:** Возвращаем $x$:\n$$e^{x^3} + C$$\n\n**Ответ: $e^{x^3} + C$ ✅**\n\nВидишь закономерность? Всегда смотри: *производная того, что внутри* — это то, что стоит снаружи (возможно, с константой).", created_at: daysAgo(2).toISOString() },

    // Chat 2 — производная сложной функции
    { chat_id: insertedChats[1].id, student_id: studentId, role: "user", content: "Не понимаю как брать производную f(x) = sin(3x² + 1). Какое правило применять?", created_at: daysAgo(5).toISOString() },
    { chat_id: insertedChats[1].id, student_id: studentId, role: "assistant", content: "Здесь нужно **правило цепочки** (производная сложной функции):\n\n$$(f(g(x)))' = f'(g(x)) \\cdot g'(x)$$\n\nТвоя функция: $f(x) = \\sin(3x^2 + 1)$\n\n- Внешняя: $\\sin(\\square)$ → производная: $\\cos(\\square)$\n- Внутренняя: $3x^2 + 1$ → производная: $6x$\n\nПрименяем:\n$$f'(x) = \\cos(3x^2 + 1) \\cdot 6x = 6x\\cos(3x^2+1)$$\n\nПопробуй сам: найди производную $g(x) = e^{5x-2}$. Что здесь внешнее, что внутреннее?", created_at: daysAgo(5).toISOString() },
    { chat_id: insertedChats[1].id, student_id: studentId, role: "user", content: "Внешняя e^□, внутренняя 5x−2. Производная = e^(5x−2) · 5?", created_at: daysAgo(5).toISOString() },
    { chat_id: insertedChats[1].id, student_id: studentId, role: "assistant", content: "Абсолютно верно! 🎉\n\n$$g'(x) = e^{5x-2} \\cdot 5 = 5e^{5x-2}$$\n\nТы правильно определил:\n- Внешняя: $e^{\\square}$ → производная: $e^{\\square}$ (сама себя)\n- Внутренняя: $5x-2$ → производная: $5$\n\n**Запомни алгоритм:**\n1. Определи внешнюю функцию → возьми её производную\n2. Определи внутреннюю → возьми её производную\n3. Перемножь\n\nМолодец, схватил быстро! 💪", created_at: daysAgo(5).toISOString() },

    // Chat 3 — предел
    { chat_id: insertedChats[2].id, student_id: studentId, role: "user", content: "Объясни простыми словами что такое предел функции? В учебнике очень заумно написано.", created_at: daysAgo(9).toISOString() },
    { chat_id: insertedChats[2].id, student_id: studentId, role: "assistant", content: "Понимаю, давай по-простому! 😊\n\n**Предел** — это значение, к которому *стремится* функция, когда $x$ приближается к какой-то точке.\n\n**Аналогия:** Представь, что ты идёшь к двери, но шаги становятся всё меньше — ½ шага, ¼ шага, ⅛ шага... Ты никогда формально не достигаешь двери, но «предел» — это расстояние до неё.\n\n**Числовой пример:**\n$$\\lim_{x \\to 2}(3x+1)$$\n\nПодставляем $x$, всё ближе к 2:\n| $x$ | $3x+1$ |\n|-----|--------|\n| 1.9 | 6.7 |\n| 1.99 | 6.97 |\n| 1.999 | 6.997 |\n\nВидишь? Значение стремится к **7**. Значит предел = 7.\n\n**Зачем это нужно?** Иногда подставить $x$ напрямую нельзя — получается деление на 0. Предел помогает понять, куда «хочет» прийти функция.\n\nХочешь разберём такой хитрый случай?\n$$\\lim_{x \\to 0}\\frac{\\sin x}{x} = ?$$", created_at: daysAgo(9).toISOString() },
  ];

  const { error: msgError } = await supabase.from(`${TABLE_PREFIX}ai_chat_messages`).insert(messages);
  if (msgError) console.error("Error creating AI chat messages:", msgError);
  else console.log(`✅ Created ${insertedChats.length} AI chats with ${messages.length} messages`);
}

// ─── student access token ─────────────────────────────────────────────────────
async function ensureStudentAccessToken(studentId: string) {
  // HMAC-tokens are stateless — no DB table needed.
  // Generate and log the demo link so the tutor can copy it from the console.
  const token = generateStudentToken(studentId);
  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DEPLOYMENT_URL || "http://localhost:5000";
  console.log(`✅ Demo student link: ${baseUrl}/student?token=${token}`);
}

// ─── AI packages & usage ─────────────────────────────────────────────────────
async function seedAiPackages(tutorId: string) {
  const { data: existing } = await supabase
    .from(`${TABLE_PREFIX}ai_packages`).select("id").eq("owner_id", tutorId).eq("owner_type", "tutor");
  if (existing && existing.length > 0) return;

  await supabase.from(`${TABLE_PREFIX}ai_packages`).insert([
    { owner_id: tutorId, owner_type: "tutor", credits: 500, used_credits: 47, price_paid: 699, purchased_at: daysAgo(14).toISOString() },
    { owner_id: tutorId, owner_type: "tutor", credits: 150, used_credits: 150, price_paid: 249, purchased_at: daysAgo(45).toISOString() },
  ]);
  console.log("✅ Created demo AI packages");
}

async function seedAiUsage(studentId: string) {
  const today = new Date().toISOString().split("T")[0];
  const { data: existing } = await supabase
    .from(`${TABLE_PREFIX}ai_usage`).select("id").eq("student_id", studentId).eq("usage_date", today);
  if (existing && existing.length > 0) return;

  await supabase.from(`${TABLE_PREFIX}ai_usage`).upsert([
    { student_id: studentId, model: "openai", usage_date: today, count: 3 },
    { student_id: studentId, model: "gpt4o-mini", usage_date: today, count: 7 },
  ], { onConflict: "student_id,model,usage_date" });
  console.log("✅ Seeded AI usage data for demo");
}

async function ensureCancelPolicyColumns() {
  await runSQL(`
    ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS cancel_policy TEXT NOT NULL DEFAULT 'free';
    ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS cancel_fee INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS cancel_fee INTEGER;
    ALTER TABLE "${TABLE_PREFIX}lessons" ADD COLUMN IF NOT EXISTS cancel_amount INTEGER;
    ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;
  `);
  console.log("✅ Cancel policy columns ready");
}

async function ensureV36Columns() {
  // Email verification + referrals + 2FA
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS referred_by TEXT;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}tutors" ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;`);
  await runSQL(`CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}tutors_referral_code_idx" ON "${TABLE_PREFIX}tutors" (referral_code);`);
  await runSQL(`CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}tutors_referred_by_idx" ON "${TABLE_PREFIX}tutors" (referred_by);`);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}email_verification_tokens" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}email_verification_token_idx" ON "${TABLE_PREFIX}email_verification_tokens" (token);
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}two_factor_codes" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}two_factor_codes_tutor_idx" ON "${TABLE_PREFIX}two_factor_codes" (tutor_id);
  `);

  // Backfill referral_code for existing tutors (8-char uppercase base36)
  await runSQL(`
    UPDATE "${TABLE_PREFIX}tutors"
    SET referral_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 8))
    WHERE referral_code IS NULL;
  `);

  // Existing tutors: mark email as verified ТОЛЬКО для зарегистрированных до запуска
  // обязательной верификации (2026-04-20). Новые регистрации обязаны подтверждать email.
  await runSQL(`
    UPDATE "${TABLE_PREFIX}tutors"
    SET email_verified = TRUE
    WHERE email_verified = FALSE AND created_at < '2026-04-20'::timestamp;
  `);

  console.log("✅ V3.6 columns/tables ensured");
}

export async function ensureStudentAuthColumns() {
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS parent_report_schedule TEXT NOT NULL DEFAULT 'off';`);
  await runSQL(`ALTER TABLE "${TABLE_PREFIX}students" ADD COLUMN IF NOT EXISTS parent_report_last_sent_at TIMESTAMPTZ;`);
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}student_email_verification_tokens" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}student_verify_token_idx" ON "${TABLE_PREFIX}student_email_verification_tokens" (token);
  `);
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}student_password_reset_tokens" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}student_reset_token_idx" ON "${TABLE_PREFIX}student_password_reset_tokens" (token);
  `);
  console.log("✅ Student auth columns/tables ensured");
}

async function ensureSavedLessonPlansTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}saved_lesson_plans" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      grade TEXT NOT NULL DEFAULT '',
      lesson_type TEXT NOT NULL DEFAULT 'new',
      duration INTEGER NOT NULL DEFAULT 60,
      plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✅ Saved lesson plans table ready");
}

async function ensureTutorReviewsTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}tutor_reviews" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}tutors"(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_contact TEXT,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      text TEXT NOT NULL,
      is_approved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}tutor_reviews_tutor_idx"
      ON "${TABLE_PREFIX}tutor_reviews" (tutor_id, is_approved, created_at DESC);
  `);
  console.log("✅ Tutor reviews table ready");
}

async function ensureBackupsTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS "${TABLE_PREFIX}backups" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID NOT NULL REFERENCES "${TABLE_PREFIX}tutors"(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'manual',
      note TEXT,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      data_json TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "${TABLE_PREFIX}backups_tutor_idx" ON "${TABLE_PREFIX}backups" (tutor_id, created_at DESC);
  `);
  console.log("✅ Backups table ready");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export async function seedDemoAccountIfNotExists() {
  try {
    // Полное отключение — для подключения к уже существующей рабочей Supabase.
    // SKIP_DEMO_SEED=true — не создавать demo-аккаунт и не трогать схему вообще.
    if (process.env.SKIP_DEMO_SEED === "true" || process.env.SKIP_DEMO_SEED === "1") {
      console.log("⏭  SKIP_DEMO_SEED=true — пропуск инициализации схемы и демо-данных");
      return;
    }

    const demoEmail = "demo@vector.ru";
    const demoPassword = "demo123";

    const { data: existingTutor } = await supabase
      .from(`${TABLE_PREFIX}tutors`).select("*").eq("email", demoEmail).single();

    // SKIP_SCHEMA_INIT=true — не запускать ALTER/CREATE, но создать demo, если его нет.
    // Полезно когда схема уже совпадает с тем, что ожидает приложение.
    const skipSchema = process.env.SKIP_SCHEMA_INIT === "true" || process.env.SKIP_SCHEMA_INIT === "1";
    if (skipSchema) {
      console.log("⏭  SKIP_SCHEMA_INIT=true — пропуск ALTER/CREATE TABLE");
    } else {
    await ensureColumns();
    await ensureSessionsTable();
    await ensureBoardsTable();
    await ensureBoardArchivesTable();
    await ensureLessonHistoryTable();
    await ensureAvatarColumns();
    await ensureAiTables();
    await ensureBbbSettings();
    await ensureNewFeatureTables();
    await ensureConferencesTable();
    await ensureNewAdminTables();
    await ensureTaskBankTables();
    await ensureCancelPolicyColumns();
    await ensureSavedLessonPlansTable();
    await ensureBackupsTable();
    await ensureTutorReviewsTable();
    await ensureV36Columns();
    await ensureStudentAuthColumns();
    } // end !skipSchema

    let tutorId: string;

    if (existingTutor) {
      console.log("✅ Demo account already exists");
      tutorId = existingTutor.id;

      // Always keep subscription premium and current
      const needsUpgrade =
        existingTutor.subscription !== "premium" ||
        !existingTutor.subscription_until ||
        new Date(existingTutor.subscription_until) < new Date("2030-01-01");

      if (needsUpgrade) {
        await supabase.from(`${TABLE_PREFIX}tutors`).update({
          subscription: "premium",
          subscription_until: "2030-12-31T23:59:59.000Z",
          extra_students: 10,
        }).eq("id", tutorId);
        console.log("✅ Upgraded demo to premium (until 2030)");
      }
      // Always ensure extended public profile demo data
      await supabase.from(`${TABLE_PREFIX}tutors`).update({
        public_slug: "anna-petrova",
        is_public_profile: true,
        public_bio: "Репетитор по математике и физике с 9-летним опытом. Подготовка к ЕГЭ на 80–100 баллов. Работаю с 8–11 классами. Индивидуальный подход к каждому ученику, разбираем темы до полного понимания — без зубрёжки.",
        public_experience: "9 лет",
        public_education: "МГУ, мехмат",
        public_phone: "+7 (999) 123-45-67",
        public_telegram: "@anna_tutor",
        public_whatsapp: "+79991234567",
        public_vk: "vk.com/anna_tutor",
        public_subject_info: "Математика (база и профиль), физика — готовлю к ЕГЭ, ОГЭ и олимпиадам. Работаю с 5–11 классом. Особый акцент на понимание, а не механическое решение. Сложные задачи разбираем пошагово.",
        public_achievements: "3 ученика сдали ЕГЭ на 100 баллов (2023–2024)\nВсе выпускники поступили в топ-вузы\nПризёр Всероссийской олимпиады по математике",
        public_color: "violet",
        public_hide_price: false,
      }).eq("id", tutorId);

    } else {
      // Create fresh tutor
      console.log("🌱 Creating demo account...");
      const hashedPassword = await bcrypt.hash(demoPassword, 10);

      const { data: tutor, error: tutorError } = await supabase
        .from(`${TABLE_PREFIX}tutors`)
        .insert({
          email: demoEmail,
          password: hashedPassword,
          name: "Анна Петрова",
          subjects: ["Математика", "Физика", "Информатика"],
          base_price: 1800,
          timezone: "Europe/Moscow",
          subscription: "premium",
          subscription_until: "2030-12-31T23:59:59.000Z",
          extra_students: 10,
          is_admin: false,
          public_slug: "anna-petrova",
          public_bio: "Репетитор по математике и физике с 9-летним опытом. Подготовка к ЕГЭ на 80–100 баллов. Работаю с 8–11 классами.",
          public_phone: "+7 (999) 123-45-67",
          public_telegram: "@anna_tutor",
          is_public_profile: true,
        })
        .select().single();

      if (tutorError || !tutor) {
        console.error("Error creating tutor:", tutorError);
        return;
      }
      tutorId = tutor.id;
      console.log(`✅ Created demo tutor: ${tutorId}`);
    }

    // ── students ──────────────────────────────────────────────────────────────
    let students: any[];
    const { data: existingStudents } = await supabase
      .from(`${TABLE_PREFIX}students`).select("*").eq("tutor_id", tutorId);

    if (existingStudents && existingStudents.length >= 8) {
      students = existingStudents.map((s: any, i: number) => ({
        id: s.id,
        subject: s.subject,
        email: s.email,
        price: s.price_per_lesson,
        slotDay: 1 + (i % 5),
        slotHour: 15 + (i % 5),
        topicOffset: i,
        duration: [60, 90, 60, 90, 60, 90, 60, 60][i % 8],
      }));
    } else {
      const testStudentPassword = await bcrypt.hash("student123", 10);

      const studentData = [
        {
          name: "Иван Смирнов", subject: "Математика", goal: "ЕГЭ 90+",
          grade: "11 класс", price: 1800, balance: 7200, progress: 75,
          topic: "Производные и интегралы", lessonsCompleted: 32,
          email: "student@vector.ru", password: "student123",
          parentContact: "+7 (916) 555-12-34",
          comment: "Способный, целеустремлённый. Хочет мехмат МГУ. Хорошо работает самостоятельно.",
          birthday: new Date("2007-03-15"),
        },
        {
          name: "Мария Козлова", subject: "Физика", goal: "Всероссийская олимпиада",
          grade: "10 класс", price: 1800, balance: 3600, progress: 70,
          topic: "Механика: законы сохранения", lessonsCompleted: 24,
          email: null, password: null,
          parentContact: "+7 (903) 234-56-78",
          comment: "Призёр регионального этапа олимпиады. Нужны нестандартные задачи уровня всероссийской.",
          birthday: new Date("2008-07-22"),
        },
        {
          name: "Дмитрий Волков", subject: "Математика", goal: "ОГЭ на 4–5",
          grade: "9 класс", price: 1500, balance: -1500, progress: 40,
          topic: "Квадратные уравнения", lessonsCompleted: 16,
          email: null, password: null,
          parentContact: "+7 (926) 789-01-23",
          comment: "Слабая база с 6–7 класса. Работаем терпеливо. Мотивация растёт.",
          birthday: new Date("2009-11-05"),
        },
        {
          name: "Анастасия Новикова", subject: "Информатика", goal: "ЕГЭ 95+",
          grade: "11 класс", price: 1800, balance: 5400, progress: 85,
          topic: "Алгоритмы: динамическое программирование", lessonsCompleted: 38,
          email: null, password: null,
          parentContact: "+7 (965) 432-10-98",
          comment: "Отличница. Интересуется ИИ и ML. Быстро схватывает. Планирует ВШЭ/МФТИ.",
          birthday: new Date("2007-01-28"),
        },
        {
          name: "Александр Морозов", subject: "Математика", goal: "Поступление в технический вуз",
          grade: "11 класс", price: 1800, balance: 0, progress: 55,
          topic: "Стереометрия: многогранники", lessonsCompleted: 19,
          email: null, password: null,
          parentContact: "+7 (977) 654-32-10",
          comment: "Проблемы с пространственным мышлением и геометрией. Алгебра лучше.",
          birthday: new Date("2007-09-14"),
        },
        {
          name: "Елена Соколова", subject: "Физика", goal: "Школьная программа (отличница)",
          grade: "8 класс", price: 1500, balance: 4500, progress: 50,
          topic: "Давление. Закон Архимеда", lessonsCompleted: 11,
          email: null, password: null,
          parentContact: "+7 (915) 111-22-33",
          comment: "Новая ученица. Умная, внимательная. Хочет разобраться в физике основательно.",
          birthday: new Date("2010-04-03"),
        },
        {
          name: "Максим Лебедев", subject: "Математика", goal: "ЕГЭ 70+",
          grade: "11 класс", price: 1800, balance: 1800, progress: 60,
          topic: "Геометрия: планиметрия", lessonsCompleted: 22,
          email: null, password: null,
          parentContact: "+7 (925) 333-44-55",
          comment: "Целится на 70–75 баллов. Работает стабильно, без рывков. Надо подтянуть геометрию.",
          birthday: new Date("2007-06-19"),
        },
        {
          name: "София Кузнецова", subject: "Информатика", goal: "Веб-разработчик",
          grade: "9 класс", price: 1500, balance: -3000, progress: 38,
          topic: "Python: ООП и классы", lessonsCompleted: 14,
          email: null, password: null,
          parentContact: "+7 (906) 666-77-88",
          comment: "Мечтает стать фронтенд-разработчиком. Задолженность по оплате — напомнить маме.",
          birthday: new Date("2009-02-11"),
        },
      ];

      if (existingStudents && existingStudents.length > 0) {
        await supabase.from(`${TABLE_PREFIX}students`).delete().eq("tutor_id", tutorId);
      }

      const toInsert = studentData.map(s => ({
        tutor_id: tutorId,
        name: s.name, subject: s.subject, goal: s.goal, grade: s.grade,
        price_per_lesson: s.price, balance: s.balance, progress: s.progress,
        curriculum_topic: s.topic, lessons_completed: s.lessonsCompleted,
        is_active: true,
        email: s.email,
        password: s.email ? testStudentPassword : null,
        parent_contact: s.parentContact,
        comment: s.comment,
        birthday: s.birthday ? s.birthday.toISOString() : null,
        links: { zoom: "https://zoom.us/j/123456789?pwd=demo", board: "https://miro.com/board/uXjVI_demo/", defaultConference: "jitsi", defaultBoard: "internal" },
      }));

      const { data: insertedStudents, error: studentsError } = await supabase
        .from(`${TABLE_PREFIX}students`).insert(toInsert).select();

      if (studentsError || !insertedStudents) {
        console.error("Error creating students:", studentsError);
        return;
      }
      console.log(`✅ Created ${insertedStudents.length} students`);

      students = insertedStudents.map((s: any, i: number) => ({
        id: s.id,
        subject: studentData[i].subject,
        email: studentData[i].email,
        price: studentData[i].price,
        slotDay: 1 + (i % 5),
        slotHour: 15 + (i % 5),
        topicOffset: i,
        duration: [60, 90, 60, 90, 60, 90, 60, 60][i % 8],
      }));
    }

    // ── always refresh lessons on every restart so dates stay current ─────
    await refreshDemoLessons(tutorId, students);

    // ── payments ──────────────────────────────────────────────────────────
    await seedPayments(tutorId, students);

    // ── homework ──────────────────────────────────────────────────────────
    const testStudent = students.find(s => s.email === "student@vector.ru");
    if (testStudent) {
      await seedHomeworkForTestStudent(tutorId, testStudent.id);
      await seedAiChatsForTestStudent(testStudent.id);
      await ensureStudentAccessToken(testStudent.id);
      await seedAiUsage(testStudent.id);
    }

    await seedHomeworkForOtherStudents(tutorId, students);
    await seedAiPackages(tutorId);

    console.log("\n🎉 Demo account ready!");
    console.log(`📧 Репетитор: ${demoEmail} / ${demoPassword}`);
    console.log(`📧 Ученик: student@vector.ru / student123`);
    console.log(`🔗 Ученик (токен): см. ссылку выше (HMAC-токен)`);

  } catch (error) {
    console.error("Error seeding demo account:", error);
  }
}
