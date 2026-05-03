# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Руководство для Claude Code в проекте «Твой Вектор»

## Контекст
SaaS-платформа для частных репетиторов: расписание, домашки, оплаты, ИИ-помощник, Telegram-бот, BBB-конференции.
Production: tvoyvector.ru (переезжаем с Replit на Beget Казахстан, Ubuntu 24.04, 4 ядра / 6 ГБ).

**Перед началом работы прочитай:**
- `BUGS.md` — известные риски и техдолг (🔴 критичные / 🟡 важные / 🟢 косметика).
- `ROADMAP.md` — план развития по этапам (миграция на Beget → стабилизация → декомпозиция → масштабирование).

## Стек
- Frontend: React 19 + Vite 7 + TypeScript + TanStack Query v5 + Tailwind v4 + Shadcn/Radix UI + Wouter
- Backend: Express 5 + TypeScript + Passport-local (sessions) + bcrypt
- БД: Supabase JS SDK (`@supabase/supabase-js`), сессии — собственный `SupabaseSessionStore`
- WebSocket: встроенная доска Excalidraw (`server/board-ws.ts`)
- Внешние интеграции: OpenAI (GPT-4o + Whisper), Telegram Bot, BigBlueButton, ЮKassa, SMTP (Beget)

## Команды
- `npm run dev` — разработка: `tsx` грузит `server/index.ts`, Express + Vite middleware на `:5000` (один порт для API и фронта)
- `npm run build` — production-сборка через `script/build.ts`: `vite build` (фронт → `dist/public/`) + `esbuild` (сервер → `dist/index.cjs`, минифицированный CJS-бандл)
- `npm run start` — `node dist/index.cjs` (production)
- `npm run check` — `tsc --noEmit` (type-check)
- `npm test` / `npx vitest run` — vitest (node-окружение по умолчанию, jsdom только для `tests/components/**`)
- `npx vitest run tests/path/to/file.test.ts` — один тест-файл
- `npm run db:push` — формально есть, но НЕ используется (Drizzle оставлен только как тип-провайдер; миграции схемы делаются вручную в Supabase или через `seed-demo-auto.ts`)
- PM2 в production: `pm2 start ecosystem.config.cjs --env production` (single-fork, max-memory 800M, логи в `./logs/`)

## Архитектура

### Backend (`server/`)
- `index.ts` — точка входа: dotenv → `checkEnvironment()` → Express + сессии (Supabase-store) → CSRF Origin/Referer-check → 8 rate-лимитеров → routes → static → BBB/Telegram/scheduler. На старте вызывает `seedDemoAccountIfNotExists`, `ensureStudentApplicationsTable`, `ensureStudentAuthColumns`, `ensurePromoCodesTable` — они создают/правят таблицы в Supabase. **`SKIP_DEMO_SEED=true` блокирует это полностью; `SKIP_SCHEMA_INIT=true` — только миграции схемы (демо-аккаунт всё равно создаётся).**
- `routes.ts` — 240 REST-эндпоинтов репетитора и админа (~7100 строк, god-file, см. BUGS.md → W-1).
- `student-routes.ts` — 58 эндпоинтов ученического портала, авторизация через HMAC-токены (`hmac-tokens.ts`).
- `storage.ts` — единственная обёртка над Supabase JS SDK (~2300 строк, ~150 методов в `IStorage`). Константа `TABLE_PREFIX = "Tvoy_vector_2_"`. **Любое чтение/запись БД должно идти через методы этого файла.**
- `seed-demo-auto.ts` — идемпотентное создание таблиц/колонок/демо-данных при старте. Если меняешь схему — добавляй `ALTER TABLE … ADD COLUMN IF NOT EXISTS` здесь, а не вручную в Supabase.
- `session-store.ts` — express-session backend поверх Supabase (таблица `Tvoy_vector_2_sessions`).
- `notification-scheduler.ts` — фоновые задачи (тик каждые 15 мин): напоминания, авто-отчёты родителям. Гонки исключаются in-process lock + atomic CAS по `parent_report_last_sent_at`. **Работает только на single-instance** (см. BUGS.md → CR-2).
- `telegram-bot.ts` (`botManager`, ~5200 строк), `bbb.ts`, `recordings.ts` (Whisper + GPT-4o-mini пайплайн), `rate-limit.ts`, `hmac-tokens.ts`, `auth.ts`, `check-env.ts`, `error-monitor.ts`, `calendar-ics.ts`, `builtin-config.ts`.
- `vite.ts` / `static.ts` — dev-mode Vite middleware vs prod-mode статика из `dist/public/`.

### Frontend (`client/src/`)
- `main.tsx` → `App.tsx` (Wouter-роутинг) → `pages/` (board, lessons, students, finance, profile, admin…) + `components/` (включая `components/ui` от shadcn).
- TanStack Query v5 — единственный способ получать данные с API; не использовать `fetch` напрямую вне query-функций.
- Path-алиасы (vite + tsconfig): `@/*` → `client/src/*`, `@shared/*` → `shared/*`, `@assets/*` → `attached_assets/*`.

### Shared (`shared/`)
- `schema.ts` — Zod-схемы и TS-типы общие для фронта и бэка (~800 строк, **37 таблиц**). **Подвох:** имена в `pgTable("Replit_*", …)` — legacy от локальной Replit-Postgres; реальная Supabase использует префикс `Tvoy_vector_2_*`. Drizzle-имена нужны только для вывода TS-типов через `$inferSelect` (см. BUGS.md → W-3).
- `models/chat.ts` — типы AI-чатов.

### Загрузки
- `multer` пишет в локальную директорию `uploads/`. Это значит **состояние не переносится между серверами** — учитывать при деплое/масштабировании.

## Ключевые правила
1. **БД работает через Supabase JS SDK**, НЕ через Drizzle напрямую (несмотря на наличие `drizzle.config.ts` и `db:push`). Drizzle оставлен только для генерации TS-типов в `shared/schema.ts`.
2. Префикс таблиц в Supabase: `Tvoy_vector_2_` (задан в `server/storage.ts`). В `shared/schema.ts` — другой префикс `Replit_*`, не путать.
3. **Не создавай миграций / `ALTER TABLE` руками вне `seed-demo-auto.ts`.** При запуске `SKIP_DEMO_SEED=true` любые правки схемы должны быть согласованы.
4. Перед изменениями в `server/auth.ts`, `session-store.ts`, `storage.ts`, `routes.ts`, обработчиках вебхуков ЮKassa — **спрашивай подтверждение**. Эти места критичны и затрагивают живых пользователей.
5. `SESSION_SECRET` обязателен в production (≥16 символов) — сервер откажется стартовать без него. **Не ротировать без поддержки multi-key — иначе все сессии инвалидируются** (см. BUGS.md → CR-5).
6. Никогда не коммитить `.env`. Production-секреты только там.
7. Express запускается с `trust proxy: 1` — всегда работаем за reverse-прокси (nginx/Replit).
8. Все API-роуты отдают `Cache-Control: no-store` (см. `server/index.ts:50-56`) — не добавляй кеш-заголовки на API без обсуждения.
9. **Single-instance only:** `notification-scheduler` и Telegram-бот стартуют в основном процессе и не готовы к multi-instance. До этапа 4 ROADMAP не менять `instances: 1` в `ecosystem.config.cjs`.
10. **Webhook-эндпоинты исключены из CSRF**: `/api/payments/webhook`, `/api/payments/webhook-student`, `/api/subscription/webhook`, `/api/telegram` (см. `server/index.ts:89-94`). При добавлении нового вебхука — добавить путь сюда.

## Тесты
- `tests/setup.ts` подключается ко всем тестам (`@testing-library/jest-dom` matchers).
- `environmentMatchGlobs`: `tests/components/**` → `jsdom`, остальное → `node`.
- Покрытие настроено только для `shared/**` и `server/auth.ts` (см. `vitest.config.ts`).
- Алиасы `@/*` и `@shared/*` доступны в тестах через тот же конфиг.

## Стиль кода
- TypeScript strict (`tsconfig.json`), типы обязательны, `noEmit: true` (компиляцию делает esbuild/vite).
- Комментарии на русском допустимы.
- Не создавай моков, тестов и документации без явной просьбы.
- Не добавляй обратной совместимости / feature-флагов «на будущее» — меняй код напрямую.
