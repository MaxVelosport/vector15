# ROADMAP.md — план развития «Твой Вектор»

> Создан: 2026-05-03. Источники: `CLAUDE.md` (миграция на Beget), `BUGS.md` (техдолг), архитектурный аудит.
> Формат: этапы по приоритету. ✅ — сделано, 🚧 — в работе, ⏳ — запланировано, 💡 — идея на обсуждение.

---

## Этап 1. Production-deploy на Beget ✅

**Цель:** перенести `tvoyvector.ru` с Replit на Beget VPS Казахстан без потери данных и downtime > 30 сек.

**Состояние на 2026-05-03:** prod уже работает на Beget. PM2 крутит `dist/index.cjs` 7+ дней, HTTPS отвечает 200, nginx 1.24.0 проксирует на :5000.

### Чек-лист
- ✅ Сервер поднят (Ubuntu 24.04, 4 ядра / 6 ГБ).
- ✅ `npm run dev` запускается на сервере.
- ✅ nginx конфиг написан (`nginx.tvoyvector.conf` в репо — но реальный prod-конфиг отличается, см. ниже).
- ✅ PM2 ecosystem-конфиг готов (`ecosystem.config.cjs`).
- ✅ Production-сборка: `dist/index.cjs` собран и запущен (PID 13344, uptime 7d, 3 рестарта).
  - ✅ **Свежая пересборка проверена 2026-05-03:** `npm run build` за ~60 сек (vite 56s + esbuild 0.9s). Размеры: `dist/index.cjs` 2.3 МБ, `dist/public/` 16 МБ (173 файла). Главный фронт-чанк `index-C1N9YFUU.js` = 4.8 МБ (1.4 МБ gzip) — ⚠️ vite предупреждает о chunk-size > 500 КБ, нужно code-splitting (см. `ROADMAP.md → Этап 3 → Декомпозиция UI`).
  - ✅ **Smoke-старт `PORT=3001 node dist/index.cjs` прошёл:** Supabase connect, WS auth, scheduler, Telegram bot (webhook-режим), `/api/health` → 200 OK. Без `MODULE_NOT_FOUND` — esbuild allowlist в порядке.
- ✅ Smoke-тест prod-эндпоинта: `curl -I https://tvoyvector.ru` → 200 OK, `X-Powered-By: Express` (значит nginx→Express работает).
- ✅ SSL: HTTPS живой (proof — `Server: nginx/1.24.0 (Ubuntu)` на 443).
- ✅ nginx с HTTPS работает.
- ✅ PM2: `tvoyvector` online в `pm2 list`, fork mode.
- ✅ Переключение DNS: домен резолвится на Beget (HTTPS отвечает с него).
- ✅ **nginx-конфиг зафиксирован в репо** (`nginx.tvoyvector.conf`): скопирован реальный prod-конфиг с SSL-блоком certbot и :80→https редиректом.
- ✅ **pm2 startup (systemd)** настроен: `pm2-deploy.service` enabled, `pm2 save` выполнен — при ребуте сервера `tvoyvector` поднимется автоматически.
- ✅ **certbot cron** активен: `certbot.timer` работает, последний запуск 7 ч назад, следующий автоматически.
- ✅ **pm2-logrotate** установлен и настроен: `max_size=10M`, `retain=7`, `compress=true`.
- ✅ **Бэкапы**: Supabase managed (БД) + Яндекс.Диск (файловая система). Дополнительный `pg_dump` не требуется (см. BUGS.md → CR-6).
- ✅ 24-часовое наблюдение завершилось (uptime 7+ дней).

### Подводные камни
- ✅ Сессии/пользователи: миграция выполнена (HTTPS отвечает с Beget).
- ⏳ **`uploads/` на Replit** — проверить, скопированы ли на Beget или работает Supabase Storage.
- ✅ SMTP Beget: порт 465 SSL.
- ✅ Telegram webhook: предположительно переключён (бот живой, но проверить URL стоит).

---

## Этап 2. Стабилизация после переезда ⏳

**Цель:** убрать legacy-наследие Replit, поднять observability.

### Чистка Replit-наследия
- ⏳ Убрать `@replit/vite-plugin-*` из `vite.config.ts` и `package.json` (3 пакета).
- ⏳ Удалить `.replit`, `.replitignore`, `replit.md` (перенести полезное в `README.md` и `CLAUDE.md`).
- ⏳ Удалить `@tldraw/tldraw` из deps (не используется).
- ⏳ Удалить unused pg-stack: `drizzle-kit`, `pg`, `connect-pg-simple`, `memorystore` (`drizzle-orm`/`drizzle-zod` оставить — нужны для типов в `shared/schema.ts`).
- ⏳ Решить судьбу `n8n-telegram-bot-workflow.json` (используется или нет).

### Observability
- ✅ Error tracking: GlitchTip self-hosted (`errors.tvoyvector.ru`) + `@sentry/node@8` / `@sentry/react@8` — backend и frontend ошибки приходят в GlitchTip.
- ⏳ Базовый health-check мониторинг (UptimeRobot / Healthchecks.io на `/api/health`).
- ⏳ Алерты в Telegram при 5xx, при дубль-вебхуке ЮKassa, при недоступности Supabase.
- ⏳ Структурное логирование: заменить `console.log` на pino/winston с JSON-форматом (для парсинга).

### DB-целостность
- ⏳ Сверка реальных FK в Supabase с `shared/schema.ts` (см. BUGS.md → CR-1). Добавить недостающие миграцией.
- ⏳ Переименовать `Replit_*` → `Tvoy_vector_2_*` в `schema.ts` (см. BUGS.md → W-3).

---

## Этап 3. Снижение технического долга ⏳

**Цель:** сделать кодбазу обозримой, чтобы Code Review занимал минуты, а не часы.

### Тесты-каркас (PRE-рефакторинг)
- ⏳ Покрыть интеграционными тестами через supertest:
  - `auth/login`, `auth/register`, `auth/2fa`
  - `payments/webhook` (идемпотентность)
  - `applications/:id/status` (state machine)
  - `subscription/webhook`
  - `students/:id/generate-program` (ai limiter)
- ⏳ Покрыть `storage.ts` критичные методы (CAS-операции, atomic counters).
- ⏳ Цель: 30% покрытие критичных путей до начала декомпозиции.

### Декомпозиция god-files
- ⏳ `server/routes.ts` (7100 строк) → разрезать на `routes/auth.ts`, `routes/lessons.ts`, `routes/payments.ts`, `routes/applications.ts`, `routes/ai.ts`, `routes/admin.ts`, `routes/public.ts`, `routes/profile.ts`. Точка входа `routes/index.ts` импортирует и регистрирует.
- ⏳ `server/telegram-bot.ts` (5200 строк) → разрезать на `bot/handlers/*.ts`, `bot/cron.ts`, `bot/inline.ts`, `bot/quiz.ts`, `bot/mini-app.ts`.
- ⏳ `server/storage.ts` (2300 строк) → split-by-aggregate: `storage/tutor.ts`, `storage/student.ts`, `storage/lesson.ts`, … . Интерфейс `IStorage` собирается из частей.

### Декомпозиция UI
- ⏳ `client/src/pages/lesson-plan.tsx` (289 КБ) — вынести шаги мастера в подкомпоненты.
- ⏳ `client/src/pages/students.tsx` (215 КБ) — карточка ученика, таблица, фильтры — раздельно.
- ⏳ `client/src/pages/admin.tsx` (146 КБ) — каждая вкладка в свой файл.
- ⏳ `schedule.tsx`, `lessons.tsx`, `home.tsx`, `finance.tsx` — аналогично.

### TypeScript строгость
- ⏳ Убрать `any` из middleware `server/auth.ts` (расширить `Express.Request` типизированно).
- ⏳ Прогнать `eslint --max-warnings 0` (если eslint не настроен — добавить).

---

## Этап 4. Масштабирование ⏳

**Цель:** подготовить приложение к multi-instance / blue-green.

- ⏳ Вынести `notification-scheduler` в отдельный процесс (PM2 app `tvoyvector-cron` с `instances: 1`).
- ⏳ Вынести Telegram-бот в отдельный процесс или вебхук-режим.
- ⏳ Перенести миграции (`seed-demo-auto.ts`) в pre-deploy шаг (`npm run migrate`), не запускать в стартапе.
- ⏳ Сессии: добавить in-memory LRU-кэш на 30 сек (см. BUGS.md → W-5) или перейти на Redis.
- ⏳ Загрузки: полностью на Supabase Storage (см. BUGS.md → W-7), удалить `uploads/`.
- ⏳ После всего этого — `instances: 2` в `ecosystem.config.cjs` и ревизия гонок.

---

## Этап 5. Продуктовое развитие 💡

**Идеи на обсуждение** (не приоритизированы):

- 💡 Мобильное приложение (React Native / Expo) поверх существующего API.
- 💡 Маркетплейс репетиторов на основе `/catalog` — комиссия с найденных учеников.
- 💡 Расширенная аналитика: когорты учеников, retention, средний LTV.
- 💡 Геймификация для репетиторов (а не только для учеников): квесты, рейтинг по региону.
- 💡 Интеграция с Дневник.ру / Электронным дневником (доступ к успеваемости).
- 💡 Voice-режим AI-помощника (Whisper + TTS).
- 💡 Корпоративные планы для онлайн-школ (multi-tenant с одной подпиской).
- 💡 Реферальная программа — расширить до 2 уровней (referrer бонус с под-рефералов).

---

## Метрики успеха

| Метрика | Сейчас | Цель |
|---|---|---|
| Покрытие тестами критичных путей | ~5% | 60% |
| Размер `routes.ts` | 7100 строк | < 500 строк (через split) |
| Среднее время отклика `/api/*` p95 | ? | < 300 мс |
| Доступность (uptime) | ? | 99.5% |
| Время деплоя | ручное ~10 мин | < 2 мин (CI/CD) |

---

## История

- **2026-05-03** — создан roadmap. Удалён мёртвый код (`seed.ts`, `seed-demo.ts`, `db.ts`, `index.ts.patch`, `replit_integrations/`).
- **2026-05-03** — аудит prod-состояния: Beget уже работает (PM2 + dist/index.cjs + HTTPS, uptime 7 дней). Этап 1 закрыт по сути, остались только страховочные пункты (зафиксировать nginx-конфиг, pm2 startup, бэкапы, logrotate).
- **2026-05-03** — исправлены все 18 type-errors из W-10a (BUGS.md), `npm run check` зелёный. Свежий `npm run build` + smoke-старт на :3001 прошли без ошибок. Найдены 2 потенциальных бага (Excalidraw collaborators, promoCode в AI-purchase) — задокументированы в BUGS.md → W-10a.
- **2026-05-03** — закрыты все страховочные пункты Этапа 1: pm2 startup (systemd unit `pm2-deploy.service`), pm2-logrotate (10M/7/gzip), nginx-конфиг с SSL зафиксирован в репо, certbot.timer подтверждён активным, бэкапы подтверждены (Supabase managed + Яндекс.Диск). Этап 1 полностью закрыт.
- **2026-05-03** — W-13 закрыт как ложный баг. Pipeline промокодов AI-пакетов реализован корректно (клиент шлёт оригинальную цену из каталога, сервер сам применяет скидку, webhook фиксирует redemption).
- **2026-05-03 (вечер)** — W-12 закрыт целиком. Realtime-коллаборация на доске Excalidraw восстановлена: 6 связанных багов исправлены (prop удалён в 0.18 — теперь `updateScene`; все курсоры под одним ключом — теперь `socketId` per connection; репетитор слал чужое имя — теперь `useAuth`; ученик не слал курсор вообще — добавлен `onPointerUpdate`; сервер не шлёт `socketId` в broadcast — теперь шлёт; цвета по роли через `ROLE_COLORS`). Smoke-test прошёл. Этап раннего тестирования ROADMAP можно начинать с этой фичей.
- **2026-05-03 (вечер)** — Часть А Этапа 2 закрыта: удалены файлы Replit-окружения (1e0c1cd), 8 неиспользуемых dependencies (c5e3600), n8n workflow (d5a4d9b). Bundle и репозиторий чище, build всё ещё 59 сек.
- **2026-05-04** — установлен GlitchTip (self-hosted, Sentry-совместимый) на `errors.tvoyvector.ru` через Docker Compose. Интегрированы `@sentry/node@8` и `@sentry/react@8` в backend и frontend vector15. `@sentry/node@10` оказался несовместим с GlitchTip 6.x (события дропались до транспорта из-за OTel-инструментации). Тестовые события подтверждены — error tracking работает. Часть Б Этапа 2 — error tracking готово, остальные пункты Observability (UptimeRobot, Telegram-алерты, структурное логирование) опциональны и не блокируют дальнейшую работу.
