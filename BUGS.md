# BUGS.md — известные проблемы и техдолг «Твой Вектор»

> Последний аудит: 2026-05-15. Файл — рабочий список замечаний. Не путать с production-багтрекером (если он есть отдельно).

Условные обозначения:
- 🔴 **Критично** — может привести к потере данных, утечке, простою или двойному списанию средств.
- 🟡 **Важно** — затрудняет разработку/деплой или создаёт реальный риск, но не разрушает прод сейчас.
- 🟢 **Косметика** — мусор в репо, мёртвый код, мелкие неточности.

---

## 🔴 Критичные риски

### ✅ CR-1. DB-целостность — ЗАКРЫТО 2026-05-05

**Что сделано:**
- Добавлена `ensureForeignKeys()` в `server/seed-demo-auto.ts` — идемпотентная миграция, вызывается при каждом старте.
- Конверсия varchar → uuid для 3 таблиц, созданных вручную в Dashboard: `lesson_recordings` (5 полей), `quizzes` (3 поля), `quiz_attempts` (4 поля).
- `lesson_history.student_id` и `lesson_history.lesson_id` сделаны nullable (аудит-лог сохраняется при удалении студента/урока).
- Очищены 4 orphan-записи (мусор от удалённых репетиторов/студентов/квизов).
- Добавлены 24 FK-ограничения. Итого в БД: **58 FK** (было 34).
- `runSQLStrict()` — новая функция с проверкой HTTP-ответа (ошибки больше не глотаются молча).

### CR-2. `notification-scheduler` рассчитан только на single-instance
- **Где:** `server/notification-scheduler.ts` — гонки исключаются in-process lock + CAS по `parent_report_last_sent_at`.
- **Проблема:** при `instances > 1` в PM2 (или blue-green) каждый процесс тикает свой scheduler. CAS защитит от дубль-отправки родителям, но **обычные напоминания** (которые без CAS) полетят `N` раз.
- **Что делать:** либо вынести scheduler в отдельный процесс/cron, либо добавить distributed-lock в Supabase (advisory lock не сработает через JS SDK; использовать таблицу с TTL).

### CR-3. Telegram-бот стартует прямо в процессе приложения
- **Где:** `server/index.ts:288` — `botManager.init()` + `botManager.startReminderCron()`.
- **Проблема:** при нескольких инстансах будут конфликты polling/webhook (Telegram API запрещает несколько активных подключений на один токен → 409 Conflict, бот выпадает у всех).
- **Что делать:** до multi-instance — пин на один процесс через `pm2.json` (`instances: 1` уже стоит, не менять без переноса бота).

### CR-4. Concurrent старт двух инстансов = гонки на `CREATE TABLE`
- **Где:** `server/seed-demo-auto.ts` запускается в `server/index.ts:274-279` без распределённого lock.
- **Проблема:** при blue-green деплое или одновременном старте двух процессов могут одновременно выполниться `CREATE TABLE IF NOT EXISTS` — Postgres сериализует, но `ALTER TABLE ADD COLUMN IF NOT EXISTS` уже не настолько идемпотентны под concurrent.
- **Что делать:** перед multi-instance вынести миграции в отдельный шаг деплоя (флаг `RUN_MIGRATIONS=true`), запускать только на одном процессе.

### CR-5. SESSION_SECRET смена = разлогин всех платящих пользователей
- **Где:** `server/index.ts:62-66`, `server/session-store.ts`.
- **Проблема:** изменение секрета в production одномоментно делает все 365-дневные cookie невалидными.
- **Что делать:** не ротировать `SESSION_SECRET` без поддержки нескольких ключей одновременно (passport не умеет из коробки — нужно патчить).

### ✅ CR-6. Стратегия бэкапов — ЗАКРЫТО 2026-05-03

**Подтверждённая стратегия:**
- **Supabase managed-бэкапы** — встроенный механизм Supabase для БД.
- **Яндекс.Диск** — бэкап файловой системы сервера (настроен отдельно).
- Дополнительный `pg_dump` не требуется.

**Примечание:** `Tvoy_vector_2_backups` — по-прежнему in-app фича (JSON-снапшоты для репетитора), не disaster recovery. При необходимости повысить уровень защиты — рассмотреть Supabase PITR (Point-in-Time Recovery).

---

## 🟡 Важно

### W-1. `routes.ts` (7100 строк) и `telegram-bot.ts` (5200 строк) — god-files
- **Проблема:** любая правка имеет высокий шанс задеть несвязанную логику. Code review практически невозможен.
- **Что делать:** см. ROADMAP.md → этап «Декомпозиция». Резать по доменам (`auth`, `lessons`, `payments`, `applications`, `ai`, …).

### W-2. Покрытие тестами ~0% по бизнес-логике
- **Где:** `tests/` — 7 файлов на ~21 000 строк бэка. `vitest.config.ts:14-17` — coverage только для `shared/**` и `server/auth.ts`.
- **Проблема:** любые правки storage/routes делаются «вслепую», регрессии ловятся в проде.
- **Что делать:** перед декомпозицией god-files — обвязать критичные роуты (auth, payments webhook, applications status transitions) интеграционными тестами через supertest (как в `tests/api/payments.test.ts`).

### ✅ W-3. Двойной префикс таблиц — ЗАКРЫТО 2026-05-05

Все 37 `pgTable("Replit_*", …)` в `shared/schema.ts` переименованы в `pgTable("Tvoy_vector_2_*", …)`. Префикс в schema.ts теперь совпадает с реальной БД. `npm run check` зелёный.

### W-4. `req as any` / `(req.session as any)` в auth-middleware
- **Где:** `server/auth.ts:22, 31, 52`.
- **Проблема:** type safety потеряна. При смене формы сессии TS не предупредит.
- **Что делать:** typed-расширение `Express.Request` через `declare module "express"` (модуль уже расширяется в `auth.ts:15-19` для `SessionData` — добить до `Request`).

### W-5. Сессии в Supabase = 1 запрос на каждый авторизованный API-вызов
- **Где:** `server/session-store.ts`.
- **Проблема:** под нагрузкой это N×RPS чтений Supabase. На бесплатном/начальном плане упрётся в лимиты.
- **Что делать:** мониторить запросы к Supabase, при росте — добавить in-memory LRU-кэш сессий на 30 секунд (с инвалидацией при logout).

### W-6. CSRF только через Origin/Referer match
- **Где:** `server/index.ts:86-117`.
- **Проблема:** клиенты с пустым Origin (некоторые расширения, прокси, mobile-WebView) получат 403 в prod. В dev — пропускаются.
- **Что делать:** мониторить 403 на `/api/*`. Если жалобы — добавить fallback на CSRF-токен через double-submit cookie.

### ✅ W-7. Локальные `uploads/` через multer — ЗАКРЫТО 2026-05-06

`/api/upload` уже использовал Supabase Storage (bucket `uploads`). Аудиозаписи уроков (`/api/recordings/upload`) переведены на приватный bucket `lesson-recordings`. Новая функция `ensureRecordingsBucket()` создаёт bucket идемпотентно при старте. `saveAudioBuffer` / `runPipeline` / `deleteAudioFile` полностью на Supabase Storage с обработкой ошибок, pino-логированием и `sendAdminAlert` при upload failure. На диске было 0 файлов — миграция данных не требовалась.

### W-14. `/subscription/success` polling не обнаруживает продление подписки
- **Где:** `client/src/pages/subscription-success.tsx` — polling сравнивает `data.subscription` с начальным значением.
- **Проблема:** при продлении существующей подписки (Pro → Pro на новый период) поле `subscription` не меняется. Polling прогоняет все 10 попыток и уходит в `timeout`-состояние, хотя оплата прошла успешно.
- **Что делать:** сравнивать также `subscriptionUntil` (дата истечения подписки, возвращается `/api/auth/me`). Если дата сдвинулась — считать это успехом. Или сравнивать `providerSubscriptionId` (если он есть в ответе).
- **Приоритет:** 🟢 косметика — критично только для клиентов на продлении, первые клиенты (новые подписчики) не затронуты.

### W-8. Allowlist в `script/build.ts` — хрупкий
- **Где:** `script/build.ts:7-33`.
- **Проблема:** при добавлении новой зависимости, которая нужна в бандле, а её нет в allowlist — esbuild сделает `external`, и в prod-старте будет `MODULE_NOT_FOUND`. Ловится только на запуске `dist/index.cjs`.
- **Что делать:** в `package.json` добавить script `build:smoke` — `npm run build && node dist/index.cjs --check` или хотя бы `node -e "require('./dist/index.cjs')"`.

### ✅ W-9. Нет HTTPS на текущем nginx-конфиге — ЗАКРЫТО

HTTPS работает на production `tvoyvector.ru` через Let's Encrypt (certbot.timer активен, сертификат обновляется автоматически). nginx слушает `:443` с SSL, куки `secure: auto` работают корректно. Закрыто фактически при переезде на Beget, подтверждено 2026-05-03.

### ✅ W-10a. `npm run check` падает с type-errors — ИСПРАВЛЕНО 2026-05-03
- **Было:** 18 ошибок в 11 файлах.
- **Сделано:** все исправлены минимально-инвазивно (правки только типов, без изменений логики).
  - Map iteration в `board-ws.ts:34`, `telegram-bot.ts:85` → `Array.from(map.entries())` / `Array.from(map.keys())`.
  - `req.params.X` (Express 5 узкая типизация) в `routes.ts:1031` и `student-routes.ts` (×7) → `as string` каст (консистентно с уже использующимися местами).
  - `routes.ts:2140` `finalPrice` — расширена типизация с литерального union до `number`.
  - `tasks.tsx:169` — добавлен импорт `invalidateResource` из `@/lib/queryClient` (функция была экспортирована, но не импортирована).
  - `dashboard-layout.tsx:341` — добавлено `"recordings"` в union `TabValue`.
  - `board.tsx:312-313` — `useRef<…>(undefined)` (React 19 требует аргумент).
  - `schedule.tsx:371` — убран `.toISOString()`, передаётся `Date` (JSON.stringify сериализует сам).
  - `subscription.tsx:686` — расширен тип мутации `buyAiPackageMutation` до `{ credits; pricePaid; promoCode?: string | null }`.
  - `board.tsx:910` — пропсы Excalidraw обёрнуты в `as any` (новый prop API в 0.18).
- **Возможные намёки на реальные баги (требуют ручной проверки):**
  1. **Excalidraw collaborators** — в 0.18 пропа `collaborators` нет в публичном API. Сейчас закрыт `as any`, но значит **синхронизация коллабораторов на доске может быть сломана**. Стоит проверить вживую.
  2. **`promoCode` в покупке AI-пакета** — фактически передавался в payload, но был не в типе → высока вероятность, что бекенд его игнорирует (либо обрабатывает случайно). Проверить, применяется ли скидка по промокоду на `/api/ai-packages/purchase`.

### P-1. Главный JS-бандл 5.1 MB из-за Excalidraw (аудит 2026-05-15)
- **Где:** `dist/public/assets/index-*.js` (5.1 MB gzip 1.4 MB).
- **Причина:** `client/src/pages/student/board.tsx` статически импортирует `@excalidraw/excalidraw`. Excalidraw тянет Mermaid (flowchart-elk 1.45 MB, mindmap 541 KB, etc.) в основной бандл. `board.tsx` уже частично конвертирован на dynamic import, но `student/board.tsx` — нет.
- **Что делать:** конвертировать `student/board.tsx` на `React.lazy(() => import("./StudentBoardInner"))` аналогично `board.tsx`. Ожидаемый эффект: бандл упадёт с 5.1 MB до ~0.7-1 MB. Нужен отдельный PR с тестом рендера доски.

### P-2. Список студентов без виртуализации (аудит 2026-05-15)
- **Где:** `client/src/pages/students.tsx:1185` — `.map()` по filtered студентам в `max-h-[550px]` контейнере.
- **Проблема:** при 100+ студентах рендерит все DOM-узлы (`motion.button` от Framer Motion), даже прокрученные за viewport.
- **Что делать:** установить `@tanstack/react-virtual` и обернуть список в `useVirtualizer`. Приоритет: средний (реалистично у клиентов <50 студентов, но стоит сделать при росте).

### W-10. `bcrypt` 6 — нативный модуль
- **Где:** `package.json: "bcrypt": "^6.0.0"`.
- **Проблема:** при смене Node-версии или сборке на сервере без `build-essential` `npm install` падает с node-gyp ошибкой.
- **Что делать:** при первоначальной настройке Beget убедиться, что `apt-get install build-essential python3` сделано. Альтернатива — заменить на `bcryptjs` (медленнее, но JS).

### ✅ W-11. Webhook ЮKassa — мониторинг добавлен — ЗАКРЫТО 2026-05-04

Дублирующий webhook теперь отправляет `sendAdminAlert('critical', ...)` в Telegram-чат администратора. Идемпотентность через `Tvoy_vector_2_processed_webhook_events` закрывает большинство сценариев двойного зачисления. Race condition при partial commit — теоретический риск, мониторится через алерты. Достаточно для текущего масштаба (единицы транзакций/день).
- **Что делать:** алерт в Telegram при появлении дубля (если PRIMARY KEY conflict случается часто — это сигнал).

### ✅ W-12. Excalidraw collaborators — ЗАКРЫТО 2026-05-03

Realtime-коллаборация на доске восстановлена. Исправлены 6 связанных подбагов:

1. **`collaborators` prop не существует в `ExcalidrawProps` 0.18** — заменён на `excalidrawAPI.updateScene({ collaborators })` через `SceneData`.
2. **Все курсоры под одним ключом `"remote"`** — заменён на `socketId` per connection; сервер (`board-ws.ts`) генерирует `randomUUID()` при каждом подключении.
3. **Репетитор слал `name: student?.name` (чужое имя)** — исправлено на `useAuth().user?.name`.
4. **Ученик не отправлял свой курсор вообще** — добавлен `onPointerUpdate` в `student/board.tsx`.
5. **Сервер не включал `socketId` в cursor-broadcast** — добавлен `socketId`, `role`, `color` из `ROLE_COLORS`.
6. **Цвет курсора был hardcoded indigo** — заменён на палитру по роли: tutor=синий (`#3B82F6`), student=зелёный (`#10B981`).

**Тестов на этот pipeline нет.** Добавить в Этап 3 ROADMAP (тесты-каркас):
- cursor-broadcast: сервер корректно добавляет `socketId`/`color` в relay
- cursor_leave: удаление по `socketId`, не по `role`
- multi-user: два клиента видят курсоры друг друга (интеграционный тест с двумя WS-соединениями)

### ✅ W-13. `promoCode` в покупке AI-пакета — ЗАКРЫТО 2026-05-03: ЛОЖНЫЙ БАГ

Pipeline промокодов реализован корректно полностью. Фронт всегда слал оригинальную цену пакета + код промокода отдельно — это правильный паттерн (клиент не диктует цену). Скидку считает только сервер. Webhook корректно создаёт redemption и инкрементирует counter. Проблема была лишь в TypeScript-типе мутации (поле `promoCode` отсутствовало в типе, но передавалось в payload через структурную совместимость) — пофикшено в W-10a.

**Замечание:** тестов на этот критичный pipeline нет. Записано в Этап 3 ROADMAP (тесты-каркас → payments/webhook). Когда дойдём до тестов — обязательно покрыть happy path и негативные кейсы (просроченный промокод, превышение `maxUses`, повторное использование одним юзером).

---

## 🟢 Косметика и мёртвый код

### C-1. Удалено: legacy seed-скрипты
- ~~`server/seed.ts`~~ — удалён 2026-05-03 (не импортировался нигде, использовал Drizzle).
- ~~`server/seed-demo.ts`~~ — удалён 2026-05-03 (legacy ручной сидер, заменён `seed-demo-auto.ts`).

### C-2. Удалено: `server/db.ts`
- 12 строк — Drizzle pool на `DATABASE_URL`. Не импортировался нигде. Удалён 2026-05-03.

### C-3. Удалено: `server/index.ts.patch`
- 319 байт patch-файл, оставшийся от ручного апдейта. Удалён 2026-05-03.

### C-4. Удалено: `server/replit_integrations/` (audio, batch, chat, image)
- Папка с Replit-специфичными интеграциями (audio/chat/image/batch). Не импортировалась из основного кода. Удалён 2026-05-03.

### ✅ C-5. `@tldraw/tldraw` — УДАЛЁН 2026-05-03 (c5e3600)
- Установлен, но не использовался (доска работает на Excalidraw). Удалён через `npm uninstall`.

### ✅ C-6. Replit Vite-плагины — УДАЛЕНЫ 2026-05-03 (c5e3600)
- `@replit/vite-plugin-runtime-error-modal`, `cartographer`, `dev-banner` убраны из `vite.config.ts` и `package.json`. Мёртвые зависимости после переезда на Beget.

### ✅ C-7. unused pg-stack — УДАЛЁН 2026-05-03 (c5e3600)
- `drizzle-kit`, `pg`, `connect-pg-simple`, `memorystore`, `@types/connect-pg-simple` удалены. `drizzle-orm` и `drizzle-zod` ОСТАВЛЕНЫ — нужны для типов в `shared/schema.ts`.

### ✅ C-8. `.replit`, `.replitignore`, `replit.md` — УДАЛЕНЫ 2026-05-03 (1e0c1cd)
- Legacy-файлы Replit-окружения. Полезная информация уже была в `CLAUDE.md` и `BUGS.md`.

### ✅ C-9. `n8n-telegram-bot-workflow.json` — УДАЛЁН 2026-05-03 (d5a4d9b)
- Артефакт прошлого. n8n работает на отдельном сервере, в этом проекте не используется. При необходимости восстанавливается из git-истории.

### ✅ C-10. Нет TODO/FIXME-комментариев в коде — ЗАКРЫТО 2026-05-05

Повторная проверка 2026-05-05 — 0 реальных TODO/FIXME/XXX/HACK маркеров. Один false-match в `client/src/components/payment-reminder-dialog.tsx:135` (фрагмент `8XXXXXXXXXX` в комментарии-плейсхолдере телефонного номера). Технический долг полностью документирован в этом файле — отдельный трекер не нужен.

### C-11. Server-файлы > 100 КБ в `client/src/pages/`
- **Топ-5:** `lesson-plan.tsx` 289 КБ, `students.tsx` 215 КБ, `admin.tsx` 146 КБ, `schedule.tsx` 128 КБ, `home.tsx` 119 КБ.
- **Что делать:** см. ROADMAP.md → этап «Декомпозиция UI».

---

## Финансовые баги — аудит 2026-05-14

> Аудит охватывал: `server/routes.ts` (payments/lessons), `client/src/pages/finance.tsx`, `analytics.tsx`, `schedule.tsx`, `shared/schema.ts`. Найдено 13 проблем (5 high, 5 med, 3 low).

### 🔴 Открытые — отложены до после гранта

#### FA-2. `migrate-payments` создаёт дубли платежей
- **Где:** `server/routes.ts:3291-3334` + `client/src/pages/finance.tsx` (useEffect на mount)
- **Проблема:** Endpoint создаёт «авто-платёж» для каждого `attended`-занятия без тега `[lesson:ID]`. В нормальном потоке предоплат репетитор уже внёс наличные вручную (без тега) → миграция создаёт второй payment. Баланс раздувается; именно это было причиной расхождений в seed-скриптах.
- **Plan:** Сравнивать не только `[lesson:ID]` в комментарии, но и суммарный totalPaid vs totalCost ДО создания платежа. Или перевести endpoint в admin-only с явным dry-run.

#### FA-4. Race condition на `student.balance`
- **Где:** `server/routes.ts:2602-2617`, `2928-2935`, `2826-2830`
- **Проблема:** Паттерн read-modify-write: `getStudent` → вычислить новый баланс → `updateStudent`. Не атомарно. При параллельных PATCH (две вкладки, бот + UI) одно обновление теряется.
- **Plan:** Supabase не поддерживает `SELECT ... FOR UPDATE` через JS SDK напрямую. Варианты: (a) DB function с `UPDATE ... SET balance = balance ± delta WHERE id = $1` через `rpc()`, (b) оптимистичный retry с чтением свежего баланса.

### 🟡 Открытые — medium priority

#### FA-7. Три разных `isBillable` в кодовой базе
- **Где:** `server/routes.ts:2795-2798` (computeEffectiveBalance), `client/src/pages/finance.tsx:263-265`, `client/src/pages/schedule.tsx:273-275`, `client/src/pages/analytics.tsx` (своя inline)
- **Проблема:** Finance включает `attended_unpaid` в billable-стоимость; schedule и старый вариант analytics — нет. Пользователь видит разные суммы «заработано» и «баланс» в зависимости от страницы.
- **Plan:** Вынести единую `calcBillableLessonCost(lesson, pricePerLesson)` + `isLessonBillable(lesson)` в `shared/` или `client/src/lib/finance-utils.ts`. Это затронет 4+ файла — делать отдельным PR.

---

### ✅ Закрытые в сессии 2026-05-14

| # | Bug | Commit | Описание |
|---|-----|--------|---------|
| 5 | Webhook без autoUpgrade | `74be7ef` | После ЮКасса-оплаты студента `autoUpgradeUnpaidLessons` не вызывался |
| 6 | Off-by-one autoUpgrade | `6f5f458` | `effectiveBal <= 0` → `< 0`; при точном покрытии долга апгрейд пропускался |
| 11 | Dead code deductFromBalance | `e1f280c` | Параметр деструктурировался из body, но нигде не использовался |
| 1 | missed_paid по полной цене | `097b581` | `cancelled+missed_paid` считался по `pricePerLesson`, не по `cancelAmount` |
| 3 | Переход paid→paid: нет коррекции | `cbcebe3` | При смене `attended` → `missed_paid` баланс не пересчитывался |
| 8 | set-balance дублировал формулу | `f1ee6af` | Inline-расчёт в `/set-balance` заменён на `computeEffectiveBalance` |
| 9 | missed_free вне Zod + фильтра | `61a9641` | `missed_free` не было в schema; занятия при архивации исчезали из статистики |
| 10 | Analytics читал s.balance | `0505f04` | Должники/переплата теперь через `effectiveBalance` (согласовано с finance) |
| 12 | Отрицательные платежи | `de2e3b9` | `amount: z.number()` → `z.number().min(1)` |
| 13 | migrate-payments при каждом mount | `bdf3d41` | `useRef` → `localStorage`-флаг, запускается один раз за всё время |

---

## Telegram-бот — аудит 2026-05-15

> Аудит `server/telegram-bot.ts` (~5200 строк). Найдено 5 проблем. Правки не вносились — только документация.

### 🔴 TB-1. Race condition при потреблении 6-значного кода привязки — ~L1791-1809

Два параллельных вызова `consumeCode()` (polling-instance + webhook или две быстрые нажатия) могут оба пройти проверку «код существует» до того, как один из них его удалит. Нет транзакции / atomic DELETE+RETURN. Результат: ученик привяжет два Telegram-аккаунта, или один аккаунт получит двойную запись `chat_id`. До multi-instance (CR-3 не закрыт) вероятность низкая, но ненулевая.

**Plan:** Заменить read-delete на `rpc('claim_telegram_code', {code})` — DB-функция с `DELETE … RETURNING`, которая возвращает результат атомарно.

### 🟡 TB-2. `startReminderCron()` создаёт 5 `setInterval` без хранения ссылок — ~L4593-4602

Таймеры нигде не хранятся, поэтому `clearInterval` в `bot.stop()` их не очистит. При рестарте бота (например, из-за ошибки polling) старые таймеры продолжают работать параллельно с новыми → напоминания могут дублироваться или падать с ошибками «bot not initialized».

**Plan:** Хранить ID всех таймеров в `this.reminderTimers: ReturnType<typeof setInterval>[]` и вызывать `clearInterval` в методе `stop()`.

### 🟡 TB-3. `dataCache` Map растёт без ограничений — ~L73-86

`dcSet()` добавляет ключи с TTL-меткой, но нет фоновой очистки и нет ограничения размера. Ключи с истёкшим TTL остаются в памяти до следующего `dcGet()` по тому же ключу. На активном инстансе за несколько недель Map может накопить тысячи ключей (массивы студентов, расписаний, платежей).

**Plan:** Добавить `setInterval` с периодом 10 минут, который итерирует `dataCache` и удаляет записи с `expiresAt < Date.now()`. Либо заменить на `node-lru-cache`.

### 🟡 TB-4. `instanceCheckTimer` (`setInterval`) не очищается при ошибке инициализации — ~L214

`instanceCheckTimer` устанавливается в `start()`. Если дальнейший `getMe()` или другой вызов бросает исключение, `catch` не очищает таймер (нет `clearInterval(instanceCheckTimer)` в блоке catch). При повторном вызове `start()` создаётся второй таймер — конкуренция за `INSTANCE_KEY`.

**Plan:** Сохранять в `finally { clearInterval(instanceCheckTimer) }` если старт не завершился успешно.

### 🟢 TB-5. Vision-пайплайн глотает ошибки хранения и отправки — ~L4402-4422

После проверки фото-ДЗ студента вызовы `storage.updateHomework()` и `bot.sendMessage()` завёрнуты в `.catch(() => {})`. Если Supabase недоступен или Telegram отклоняет сообщение, студент не получает уведомление, статус ДЗ не обновляется, но ошибка нигде не фиксируется.

**Plan:** Заменить пустой catch на `console.error` + `sendAdminAlert` (уже используется в других местах бота).

---

## ✅ Закрытые вопросы (ответы владельца 2026-05-03)

1. **`n8n-telegram-bot-workflow.json`** — не используется в этом проекте. Артефакт прошлого. См. C-9.
2. **TODO/FIXME трекаются в BUGS.md** — отдельного трекера нет, этот файл — единый список багов и доработок. См. C-10.
3. **`Tvoy_vector_2_backups`** — используется как in-app фича (auto-snapshot при логине, manual через `/api/backup`). Это НЕ disaster recovery (см. CR-6).
4. **Supabase managed-бэкапы** — статус неизвестен, скорее всего НЕ настроены. Поднято в CR-6.
5. **Тестирование восстановления** — никогда не проводилось. Поднято в CR-6.
