# 🚀 Быстрый старт «Твой Вектор» на новом Replit-аккаунте

Инструкция для пользователя `rpelite` (или любого нового аккаунта), который скачал/импортировал проект и хочет развернуть его за 10–15 минут.

---

## Шаг 1. Импорт проекта в Replit

1. Зайдите на [replit.com](https://replit.com) под аккаунтом `rpelite`.
2. Нажмите **Create Repl** → **Import from GitHub** *(или загрузите zip-архив через **Import from upload**)*.
3. Дождитесь, пока Replit распакует файлы и установит зависимости (около 1–2 минут).
4. Когда увидите файл `replit.md` в корне — импорт завершён.

> Никаких ручных `npm install` запускать не нужно — Replit сделает это сам по `package.json`.

---

## Шаг 2. Создайте Supabase-проект (бесплатно)

1. Зайдите на [supabase.com](https://supabase.com) → **New project**.
2. Придумайте имя (напр. `tvoyvector-prod`), задайте пароль БД, выберите регион **Frankfurt** (ближайший к РФ).
3. Дождитесь создания проекта (~2 мин).
4. Откройте **Settings → API** и сохраните три значения:
   - **Project URL** → пригодится как `SUPABASE_URL`
   - **anon public** ключ → `SUPABASE_ANON_KEY`
   - **service_role** ключ → `SUPABASE_SERVICE_KEY`

> Таблицы создавать вручную **не нужно** — при первом запуске сервер сам создаст всё необходимое (через `seed-demo-auto.ts`) и подгрузит демо-данные.

---

## Шаг 3. Заполните секреты в Replit

Откройте **Tools → Secrets** (иконка замка слева) и добавьте по очереди:

### Обязательные

| Ключ | Откуда взять |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role |
| `SESSION_SECRET` | Сгенерируйте: в Shell выполните `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) → API keys (для ИИ-ассистента) |
| `SMTP_PASS` | Пароль почты `info@…` (Beget или ваш SMTP — для писем сброса пароля и уведомлений) |
| `SMTP_PASS_SUPPORT` | Пароль почты `support@…` (для тикетов поддержки) |

### Опциональные (можно добавить позже — соответствующие функции просто не будут работать)

| Ключ | Для чего | Как получить |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram-уведомления | [@BotFather](https://t.me/BotFather) → `/newbot` |
| `YOOKASSA_SHOP_ID` | Приём онлайн-оплат | yookassa.ru → Настройки → ID магазина |
| `YOOKASSA_SECRET_KEY` | Приём онлайн-оплат | yookassa.ru → Настройки → Секретный ключ |
| `BBB_SECRET` | Видео-конференции BigBlueButton | На сервере BBB: `bbb-conf --secret` |

### SMTP (если хотите свою почту, а не Beget)

Если используете другой SMTP-провайдер, добавьте ещё переменные окружения через **Secrets**:

```
SMTP_HOST=smtp.beget.com
SMTP_PORT=465
SMTP_USER=info@вашдомен.ru
SMTP_FROM=Твой Вектор <info@вашдомен.ru>
SMTP_SUPPORT=support@вашдомен.ru
```

---

## Шаг 4. Запуск

1. Нажмите большую зелёную кнопку **Run** вверху.
> 💡 **Совет:** перед запуском проверьте, что все секреты на месте — в Shell выполните:
> ```bash
> node scripts/check-secrets.js
> ```
> Скрипт покажет «✓ задан / ✗ отсутствует» по каждому секрету (без вывода значений). Если все обязательные ✓ — смело жмите Run.

2. В консоли должно появиться:
   ```
   [supabase] Connected using SUPABASE_SERVICE_KEY
   [seed] Demo data ready
   serving on port 5000
   ```
3. В правой панели откроется webview с приложением.

### Подключение к УЖЕ СУЩЕСТВУЮЩЕЙ Supabase

Если у вас уже есть рабочая база с данными и вы НЕ хотите, чтобы приложение
что-либо создавало или меняло в схеме — добавьте в Tools → Secrets:

| Ключ | Значение | Что делает |
|---|---|---|
| `SKIP_DEMO_SEED` | `true` | Полный пропуск: ни демо-аккаунт, ни ALTER/CREATE TABLE не выполняются. Приложение просто подключится к существующим таблицам с префиксом `Tvoy_vector_2_`. |
| `SKIP_SCHEMA_INIT` | `true` | Пропустить только миграции схемы, но создать `demo@vector.ru`, если его ещё нет. |

> Если префикс таблиц у вас другой — это уже задано в коде через константу `TABLE_PREFIX = "Tvoy_vector_2_"` в `server/storage.ts`. Скажите — поменяю.

### Демо-аккаунты (создаются автоматически)

| Роль | Email | Пароль |
|---|---|---|
| Репетитор | `demo@vector.ru` | `demo123` |
| Ученик | `student@vector.ru` | `student123` |

---

## Шаг 5. Публикация (deploy)

Когда всё работает в режиме разработки:

1. Откройте **Deployments** (значок ракеты слева).
2. Тип развёртывания: **Autoscale** (уже настроен в `.replit`).
3. Нажмите **Deploy**.
4. Replit соберёт проект (`npm run build`) и поднимет на постоянный домен `*.replit.app`.
5. Если нужен свой домен (`tvoyvector.ru`) — добавьте его в **Deployments → Settings → Custom domain** и пропишите DNS-запись CNAME у регистратора.

> **Важно:** все секреты автоматически переносятся в продакшн. Дополнительно ничего настраивать не нужно.

---

## Частые проблемы

| Проблема | Решение |
|---|---|
| `[supabase] Missing SUPABASE_URL` в логах | Не задан секрет — добавьте через Tools → Secrets и нажмите **Stop → Run** |
| Регистрация падает с `column … does not exist` | Перезапустите Run — `seed-demo-auto.ts` создаст недостающие колонки на старте |
| Письма не приходят | Проверьте `SMTP_PASS`, посмотрите логи `[smtp]` в консоли. Beget блокирует порт 25 — используйте 465 |
| Кнопка «Войти» в Telegram не работает | Убедитесь, что `TELEGRAM_BOT_TOKEN` задан и бот добавлен в `@BotFather` с правильным username |
| ИИ-ассистент молчит | Проверьте `OPENAI_API_KEY` и баланс на platform.openai.com |
| Доска показывает английский интерфейс | Hard-refresh страницы (Ctrl+Shift+R) — Excalidraw кеширует локаль |

---

## Полезные команды (в Shell Replit)

```bash
# Перезапустить приложение без полного Stop/Run
kill 1

# Посмотреть логи в реальном времени
tail -f /tmp/replit/logs/*

# Проверить, что секреты подгрузились (без вывода значений)
node -e "['SUPABASE_URL','SUPABASE_SERVICE_KEY','SESSION_SECRET','OPENAI_API_KEY'].forEach(k=>console.log(k, !!process.env[k]))"

# Запустить тесты
npx vitest run
```

---

## Структура проекта (краткая шпаргалка)

```
client/src/         — React-фронтенд (Vite)
  pages/            — страницы (board, lessons, students, finance, profile…)
  components/       — переиспользуемые компоненты + shadcn/ui
server/             — Express-бэкенд
  routes.ts         — все REST-эндпоинты
  storage.ts        — обёртка над Supabase JS SDK (вместо Drizzle)
  seed-demo-auto.ts — создание таблиц + демо-данные при старте
  notification-scheduler.ts — фоновые уведомления (каждые 15 мин)
shared/schema.ts    — типы и Zod-схемы, общие для фронта и бэка
```

> Проект работает **через Supabase JS SDK** — прямого PostgreSQL-подключения нет. Поэтому `SUPABASE_DATABASE_URL` и команды `drizzle-kit` / `npm run db:push` **не нужны** даже если упоминаются в `package.json`.

---

Готово! После выполнения шагов 1–4 у вас полностью рабочая копия «Твой Вектор» с демо-данными. Удачи! 🎓
