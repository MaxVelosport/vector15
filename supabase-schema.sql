-- Таблицы для приложения "Твой Вектор" в Supabase
-- Все таблицы с префиксом Replit_

-- Репетиторы (tutors)
CREATE TABLE IF NOT EXISTS "Replit_tutors" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  base_price INTEGER NOT NULL DEFAULT 1600,
  timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
  subscription TEXT NOT NULL DEFAULT 'free',
  subscription_until TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  public_slug TEXT UNIQUE,
  public_bio TEXT,
  public_phone TEXT,
  public_telegram TEXT,
  is_public_profile BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ученики (students)
CREATE TABLE IF NOT EXISTS "Replit_students" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES "Replit_tutors"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  goal TEXT NOT NULL,
  grade TEXT NOT NULL,
  price_per_lesson INTEGER NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  parent_contact TEXT,
  email TEXT,
  links JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  progress INTEGER NOT NULL DEFAULT 0,
  curriculum_topic TEXT NOT NULL DEFAULT 'Стартовая диагностика',
  birthday TIMESTAMPTZ,
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  average_rating INTEGER,
  has_program BOOLEAN NOT NULL DEFAULT false,
  program_data JSONB,
  questionnaire JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Занятия (lessons)
CREATE TABLE IF NOT EXISTS "Replit_lessons" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES "Replit_tutors"(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES "Replit_students"(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attendance TEXT,
  rating INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Платежи (payments)
CREATE TABLE IF NOT EXISTS "Replit_payments" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES "Replit_tutors"(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES "Replit_students"(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Задания (tasks)
CREATE TABLE IF NOT EXISTS "Replit_tasks" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES "Replit_tutors"(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  task TEXT NOT NULL,
  solution TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Домашние задания (homework)
CREATE TABLE IF NOT EXISTS "Replit_homework" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES "Replit_tutors"(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES "Replit_students"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completion_pct INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'assigned',
  deadline TIMESTAMPTZ,
  attachments TEXT[] NOT NULL DEFAULT '{}',
  task_ids TEXT[] NOT NULL DEFAULT '{}',
  feedback TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Цены подписок (subscription_prices)
CREATE TABLE IF NOT EXISTS "Replit_subscription_prices" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL UNIQUE,
  price_monthly INTEGER NOT NULL,
  price_yearly INTEGER NOT NULL,
  features TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Платежи за подписку (subscription_payments)
CREATE TABLE IF NOT EXISTS "Replit_subscription_payments" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES "Replit_tutors"(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  period TEXT NOT NULL,
  amount INTEGER NOT NULL,
  yookassa_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Уведомления (notifications)
CREATE TABLE IF NOT EXISTS "Replit_notifications" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES "Replit_tutors"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Шаблоны занятий (lesson_templates)
CREATE TABLE IF NOT EXISTS "Replit_lesson_templates" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES "Replit_tutors"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL DEFAULT 60,
  objectives TEXT[] NOT NULL DEFAULT '{}',
  materials TEXT[] NOT NULL DEFAULT '{}',
  activities JSONB DEFAULT '[]',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Токены сброса пароля (password_reset_tokens)
CREATE TABLE IF NOT EXISTS "Replit_password_reset_tokens" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES "Replit_tutors"(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Начальные данные для подписок
INSERT INTO "Replit_subscription_prices" (tier, price_monthly, price_yearly, features)
VALUES 
  ('pro', 990, 9900, ARRAY['До 30 учеников', 'До 150 занятий/месяц', 'ИИ генерация заданий', 'Массовая рассылка', 'Экспорт данных']),
  ('premium', 1990, 19900, ARRAY['Без ограничений', 'ИИ генерация заданий', 'Массовая рассылка', 'Расширенная аналитика', 'Экспорт данных'])
ON CONFLICT (tier) DO NOTHING;
