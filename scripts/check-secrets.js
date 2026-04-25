#!/usr/bin/env node
/**
 * Проверка наличия всех секретов перед запуском.
 * Запуск: node scripts/check-secrets.js
 *
 * Не выводит сами значения — только статус "✓ задан / ✗ отсутствует".
 * Удобно прогнать сразу после импорта проекта в новый Replit-аккаунт.
 */

const REQUIRED = [
  { name: "SUPABASE_URL",         hint: "supabase.com → Settings → API → Project URL" },
  { name: "SUPABASE_ANON_KEY",    hint: "supabase.com → Settings → API → anon public" },
  { name: "SUPABASE_SERVICE_KEY", hint: "supabase.com → Settings → API → service_role" },
  { name: "SESSION_SECRET",       hint: "минимум 16 символов; сгенерируйте: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"" },
  { name: "OPENAI_API_KEY",       hint: "platform.openai.com → API keys" },
  { name: "SMTP_PASS",            hint: "пароль от почты info@..." },
  { name: "SMTP_PASS_SUPPORT",    hint: "пароль от почты support@..." },
];

const OPTIONAL = [
  { name: "TELEGRAM_BOT_TOKEN", desc: "Telegram-уведомления" },
  { name: "YOOKASSA_SHOP_ID",   desc: "приём онлайн-оплат" },
  { name: "YOOKASSA_SECRET_KEY",desc: "приём онлайн-оплат" },
  { name: "BBB_SECRET",         desc: "BigBlueButton конференции" },
];

let missing = 0;

console.log("\n=== Проверка обязательных секретов ===\n");
for (const { name, hint } of REQUIRED) {
  const v = process.env[name];
  if (v && v.trim().length > 0) {
    console.log(`  ✓ ${name}  (${v.length} символов)`);
  } else {
    console.log(`  ✗ ${name}  — ОТСУТСТВУЕТ`);
    console.log(`      где взять: ${hint}`);
    missing++;
  }
}

console.log("\n=== Опциональные (можно пропустить) ===\n");
for (const { name, desc } of OPTIONAL) {
  const v = process.env[name];
  if (v && v.trim().length > 0) {
    console.log(`  ✓ ${name}  — включено (${desc})`);
  } else {
    console.log(`  · ${name}  — не задано (${desc} отключено)`);
  }
}

if (missing > 0) {
  console.log(`\n❌ Не хватает ${missing} обязательных секретов.`);
  console.log("Добавьте их через Tools → Secrets и запустите проверку снова.\n");
  process.exit(1);
} else {
  console.log("\n✅ Все обязательные секреты на месте — можно запускать `npm run dev`.\n");
}
