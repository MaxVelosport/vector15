-- Дополнительные таблицы и изменения для личного кабинета ученика
-- Выполните этот SQL в Supabase SQL Editor

-- Добавляем поле password для учеников (для входа в личный кабинет)
ALTER TABLE "Replit_students" ADD COLUMN IF NOT EXISTS password TEXT;

-- Уникальный индекс на email учеников (для входа)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email_unique 
ON "Replit_students"(email) WHERE email IS NOT NULL;

-- Токены доступа для учеников (альтернативный вход по ссылке)
CREATE TABLE IF NOT EXISTS "Replit_student_access_tokens" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES "Replit_students"(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Чат-сообщения между учеником и ИИ-помощником
CREATE TABLE IF NOT EXISTS "Replit_ai_chat_messages" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES "Replit_students"(id) ON DELETE CASCADE,
  homework_id UUID REFERENCES "Replit_homework"(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_student_access_tokens_token ON "Replit_student_access_tokens"(token);
CREATE INDEX IF NOT EXISTS idx_student_access_tokens_student ON "Replit_student_access_tokens"(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_student ON "Replit_ai_chat_messages"(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_homework ON "Replit_ai_chat_messages"(homework_id);
