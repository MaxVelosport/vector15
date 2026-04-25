/**
 * Проверка обязательных переменных окружения при запуске.
 * При переносе проекта на новый Replit — запусти и добавь все недостающие ключи.
 */

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
  where: string;
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  // ── Supabase ────────────────────────────────────────────────────────
  {
    key: "SUPABASE_URL",
    required: true,
    description: "URL проекта Supabase",
    where: "supabase.com → Settings → API → Project URL",
  },
  {
    key: "SUPABASE_ANON_KEY",
    required: true,
    description: "Публичный anon/public ключ Supabase",
    where: "supabase.com → Settings → API → anon public",
  },
  {
    key: "SUPABASE_SERVICE_KEY",
    required: true,
    description: "Сервисный ключ Supabase (service_role)",
    where: "supabase.com → Settings → API → service_role",
  },

  // ── OpenAI ──────────────────────────────────────────────────────────
  {
    key: "OPENAI_API_KEY",
    required: true,
    description: "Ключ OpenAI API для AI-функций",
    where: "platform.openai.com → API keys",
  },

  // ── Telegram ────────────────────────────────────────────────────────
  {
    key: "TELEGRAM_BOT_TOKEN",
    required: true,
    description: "Токен Telegram бота",
    where: "Telegram → @BotFather → /newbot или /mybots",
  },

  // ── YooKassa ────────────────────────────────────────────────────────
  {
    key: "YOOKASSA_SHOP_ID",
    required: true,
    description: "ID магазина ЮKassa",
    where: "yookassa.ru → Настройки → ID магазина",
  },
  {
    key: "YOOKASSA_SECRET_KEY",
    required: true,
    description: "Секретный ключ ЮKassa",
    where: "yookassa.ru → Настройки → Безопасность → Секретный ключ",
  },

  // ── BigBlueButton ───────────────────────────────────────────────────
  {
    key: "BBB_SECRET",
    required: true,
    description: "Секретный ключ BigBlueButton сервера",
    where: "На сервере BBB: команда `bbb-conf --secret`",
  },

  // ── Безопасность ────────────────────────────────────────────────────
  {
    key: "SESSION_SECRET",
    required: true,
    description: "Секрет для подписи сессий (генерируй случайно)",
    where: "Сгенерируй: node -e \"require('crypto').randomBytes(48).toString('hex') |> console.log\"",
  },

  // ── Email / SMTP (Beget) ─────────────────────────────────────────────
  {
    key: "SMTP_PASS",
    required: true,
    description: "Пароль от info@tvoyvector.ru (для сброса пароля и уведомлений)",
    where: "Beget → Почта → info@tvoyvector.ru → пароль",
  },
  {
    key: "SMTP_PASS_SUPPORT",
    required: true,
    description: "Пароль от support@tvoyvector.ru (для тикетов поддержки)",
    where: "Beget → Почта → support@tvoyvector.ru → пароль",
  },
];

export function checkEnvironment(): void {
  const missing: EnvVar[] = [];

  for (const v of REQUIRED_ENV_VARS) {
    if (!process.env[v.key]) {
      missing.push(v);
    }
  }

  if (missing.length > 0) {
    console.warn("\n" + "═".repeat(60));
    console.warn("⚠️  ОТСУТСТВУЮТ ОБЯЗАТЕЛЬНЫЕ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ");
    console.warn("═".repeat(60));
    console.warn("Добавь в Replit → Tools → Secrets:\n");
    for (const v of missing) {
      console.warn(`  ❌ ${v.key}`);
      console.warn(`     ${v.description}`);
      console.warn(`     Где взять: ${v.where}\n`);
    }
    console.warn("═".repeat(60) + "\n");
  } else {
    console.log("✅ Все переменные окружения настроены");
  }
}
