# Твой Вектор

SaaS-платформа для частных репетиторов: расписание, домашки, оплаты, ИИ-помощник, видеоконференции и Telegram-бот в одном кабинете.

Сайт: <https://tvoyvector.ru>

## Что внутри

- **Кабинет репетитора**: ученики, занятия (день/неделя/месяц), задания, финансы, отчёты, ИИ-генерация заданий и плана.
- **Кабинет ученика**: домашки, прогресс с XP/уровнями/стриками, ИИ-помощник, задачник ЕГЭ, оплата, чат с репетитором.
- **Интеграции**: OpenAI (GPT-4o), Telegram-бот, BigBlueButton, ЮKassa, SMTP (Beget по умолчанию).
- **Доска**: встроенный whiteboard на Excalidraw + поддержка внешних (Miro/Figma).

## Стек

- **Фронтенд**: React 19, Vite, TanStack Query v5, Tailwind v4, Shadcn/Radix UI, Wouter, Framer Motion.
- **Бэкенд**: Node.js, Express 5, TypeScript, Passport + bcrypt (session auth), Drizzle ORM (только для миграций).
- **Хранилище**: Supabase (через `@supabase/supabase-js`), локальные файлы — `multer` в `uploads/`.
- **Realtime**: WebSocket для встроенной доски (`server/board-ws.ts`).

## Структура

```
client/   — React-фронтенд (pages, components, hooks)
server/   — Express-бэкенд (routes, storage, integrations)
shared/   — общие типы и Zod-схемы
scripts/  — сервисные скрипты (миграции, очистка)
tests/    — vitest
```

## Быстрый старт

```bash
# 1. Установить зависимости
npm install

# 2. Настроить переменные окружения (см. .env.example)
cp .env.example .env  # затем отредактировать

# 3. Применить схему к Supabase (один раз)
npm run db:push

# 4. Запустить dev-сервер (Express + Vite на :5000)
npm run dev
```

Полная пошаговая инструкция: [QUICKSTART.md](./QUICKSTART.md).

## Переменные окружения

См. [`.env.example`](./.env.example). Минимум для запуска:

| Переменная | Назначение |
|------------|------------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | База данных и авторизация |
| `SESSION_SECRET` | Подпись сессий и токенов доступа (≥ 32 символов случайной строки) |
| `OPENAI_API_KEY` | ИИ-ассистент и генерация заданий |
| `SMTP_PASS`, `SMTP_PASS_SUPPORT` | Рассылка писем |

Опционально: `TELEGRAM_BOT_TOKEN`, `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `BBB_SECRET`.

`SESSION_SECRET` обязателен в production — сервер откажется стартовать без него.

## Скрипты npm

| Команда | Что делает |
|---------|------------|
| `npm run dev` | Dev-режим: Express + Vite middleware на `:5000` |
| `npm run build` | Production-сборка (esbuild + vite build) |
| `npm run start` | Запуск собранного приложения |
| `npm run db:push` | Синхронизация Drizzle-схемы с базой |
| `npm test` | Vitest |

## Демо

- Репетитор: `demo@vector.ru` / `demo123`
- Ученик: `student@vector.ru` / `student123`

(автоматически создаются при первом запуске, если не задан `SKIP_DEMO_SEED=true`)

## Лицензия

Проприетарное ПО. Все права принадлежат ИП Горбацевич Максим Денисович (ИНН 590612402300). Использование — только с письменного разрешения правообладателя.
