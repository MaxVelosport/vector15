# Развёртывание «Твой Вектор» на новом Replit

## Всё прошито — нулевая конфигурация

Все ключи и настройки зашиты в `server/builtin-config.ts`.
На новом Replit достаточно **скопировать репозиторий и нажать Run**.

| Компонент              | Где прошито                         |
|------------------------|-------------------------------------|
| Supabase URL           | `builtin-config.ts`                 |
| Supabase Anon Key      | `builtin-config.ts`                 |
| Supabase Service Key   | `builtin-config.ts`                 |
| OpenAI API Key         | `builtin-config.ts`                 |
| BBB URL + секрет       | `builtin-config.ts`                 |
| Схема БД               | Создаётся автоматически на старте   |
| Демо-аккаунт           | Создаётся автоматически на старте   |

---

## Порядок первого запуска

1. Скопировать репозиторий в новый Replit
2. Нажать **Run** (или `npm run dev`)
3. Готово — всё поднимается само

---

## Опциональные секреты (переопределяют прошитые значения)

Добавлять только если нужно заменить дефолтные значения:

| Секрет                  | Описание                              |
|-------------------------|---------------------------------------|
| `OPENAI_API_KEY`        | Другой ключ OpenAI                    |
| `SUPABASE_DATABASE_URL` | Другой Supabase URL                   |
| `SUPABASE_ANON_KEY`     | Другой anon key                       |
| `SUPABASE_SERVICE_KEY`  | Другой service key                    |
| `BBB_URL`               | Другой URL BBB-сервера                |
| `BBB_SECRET`            | Другой ключ BBB                       |
| `SESSION_SECRET`        | Секрет сессий (рекомендуется в prod)  |

---

## Администратор

После запуска выполнить в Supabase Dashboard SQL-консоль:

```sql
UPDATE "Replit_tutors" SET is_admin = true WHERE email = 'maximgorbacevich@gmail.com';
```
