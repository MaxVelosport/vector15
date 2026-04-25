// Конфигурация по умолчанию.
//
// ⚠️ ВАЖНО: НИКОГДА не хардкодьте сюда реальные ключи и токены —
// GitHub автоматически заблокирует push, если найдёт секрет в коде.
// Все секреты задаются ТОЛЬКО через Tools → Secrets в Replit
// (или переменные окружения на других платформах).
//
// Этот файл оставлен как единая точка чтения env-переменных,
// чтобы остальной код не разбрасывал `process.env.X` по всему проекту.

export const BUILTIN_OPENAI_KEY     = '';
export const BUILTIN_SUPABASE_URL   = '';
export const BUILTIN_SUPABASE_ANON  = '';
export const BUILTIN_SUPABASE_SVC   = '';
export const BUILTIN_BBB_URL        = '';
export const BUILTIN_BBB_SECRET     = '';
export const BUILTIN_APP_URL        = 'https://tvoyvector.ru';
export const BUILTIN_TELEGRAM_TOKEN = '';

export const openaiKey = () =>
  process.env.OPENAI_API_KEY ||
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
  BUILTIN_OPENAI_KEY;

export const appUrl = () =>
  (process.env.APP_URL || BUILTIN_APP_URL).replace(/\/$/, '');
