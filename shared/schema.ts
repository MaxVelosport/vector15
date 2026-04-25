import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Репетиторы (tutors)
export const tutors = pgTable("Replit_tutors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  subjects: text("subjects").array().notNull().default(sql`ARRAY[]::text[]`),
  basePrice: integer("base_price").notNull().default(1600),
  timezone: text("timezone").notNull().default('Europe/Moscow'),
  subscription: text("subscription").notNull().default('free'), // 'free' | 'pro' | 'premium'
  subscriptionUntil: timestamp("subscription_until"),
  isAdmin: boolean("is_admin").notNull().default(false),
  publicSlug: text("public_slug").unique(),
  publicBio: text("public_bio"),
  publicPhone: text("public_phone"),
  publicTelegram: text("public_telegram"),
  isPublicProfile: boolean("is_public_profile").notNull().default(false),
  publicExperience: text("public_experience"),
  publicEducation: text("public_education"),
  publicWhatsapp: text("public_whatsapp"),
  publicVk: text("public_vk"),
  publicInstagram: text("public_instagram"),
  publicAchievements: text("public_achievements"),
  publicVideoUrl: text("public_video_url"),
  publicSubjectInfo: text("public_subject_info"),
  publicColor: text("public_color").default("violet"),
  publicHidePrice: boolean("public_hide_price").default(false),
  botToken: text("bot_token"),
  extraStudents: integer("extra_students").notNull().default(0),
  linkSettings: jsonb("link_settings").default({ showBbb: true, showExternalConf: true, showInternalBoard: true, showExternalBoard: true }),
  cancelPolicy: text("cancel_policy").notNull().default('free'), // 'free' | 'fixed' | 'per_student'
  cancelFee: integer("cancel_fee").notNull().default(0),
  scheduleStart: integer("schedule_start").notNull().default(8),
  scheduleEnd: integer("schedule_end").notNull().default(22),
  telegramToken: text("telegram_token"),
  tutorChatId: text("tutor_chat_id"),
  tutorTelegramNotificationsEnabled: boolean("tutor_telegram_notifications_enabled").default(true),
  isBlocked: boolean("is_blocked").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  referralCode: text("referral_code"),
  referredBy: text("referred_by"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTutorSchema = createInsertSchema(tutors).omit({
  id: true,
  createdAt: true,
});

export type InsertTutor = z.infer<typeof insertTutorSchema>;
export type Tutor = typeof tutors.$inferSelect;

// Ученики (students)
export const students = pgTable("Replit_students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  goal: text("goal").notNull(),
  grade: text("grade").notNull(),
  pricePerLesson: integer("price_per_lesson").notNull(),
  balance: integer("balance").notNull().default(0),
  parentContact: text("parent_contact"),
  parentLink: text("parent_link"),
  paymentInfo: text("payment_info"),
  comment: text("comment"),
  email: text("email"),
  password: text("password"),
  emailVerified: boolean("email_verified").notNull().default(false),
  socialLink: text("social_link"),
  links: jsonb("links").default({}), // { zoom?: string, board?: string }
  telegramChatId: text("telegram_chat_id"),
  telegramNotificationsEnabled: boolean("telegram_notifications_enabled").default(true),
  receiptEmail: text("receipt_email"),
  isActive: boolean("is_active").notNull().default(true),
  progress: integer("progress").notNull().default(0),
  curriculumTopic: text("curriculum_topic").notNull().default('Стартовая диагностика'),
  birthday: timestamp("birthday"), // дата рождения для напоминаний
  lessonsCompleted: integer("lessons_completed").notNull().default(0), // для статистики
  averageRating: integer("average_rating"), // средняя оценка
  cancelFee: integer("cancel_fee"), // персональный штраф за отмену (переопределяет глобальный)
  // Программа подготовки
  hasProgram: boolean("has_program").notNull().default(false), // есть ли программа
  programData: jsonb("program_data"), // { topics: [{title, description, lessonsNeeded, completed}], totalLessons, generatedAt }
  questionnaire: jsonb("questionnaire"), // анкета для ИИ: { currentLevel, weakPoints, strongPoints, examDate, hoursPerWeek, additionalInfo }
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

// Занятия (lessons)
export const lessons = pgTable("Replit_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  topic: text("topic").notNull(),
  status: text("status").notNull().default('pending'), // 'pending' | 'completed' | 'cancelled' | 'rescheduled'
  attendance: text("attendance"), // 'attended' | 'missed' | 'missed_paid'
  cancelAmount: integer("cancel_amount"), // сумма штрафа за отмену (если отменено с оплатой)
  rating: integer("rating"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLessonSchema = createInsertSchema(lessons).omit({
  id: true,
  createdAt: true,
});

export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessons.$inferSelect;

// Платежи (payments)
export const payments = pgTable("Replit_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  amount: integer("amount").notNull(),
  method: text("method").notNull(), // 'наличные' | 'перевод' | 'карта' | 'онлайн'
  comment: text("comment"),
  yookassaPaymentId: text("yookassa_payment_id"),
  yookassaStatus: text("yookassa_status"), // 'pending' | 'succeeded' | 'canceled'
  confirmationUrl: text("confirmation_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Задания (tasks)
export const tasks = pgTable("Replit_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  topic: text("topic").notNull(),
  difficulty: text("difficulty").notNull(), // 'easy' | 'medium' | 'hard'
  task: text("task").notNull(),
  solution: text("solution").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Домашние задания (homework)
export const homework = pgTable("Replit_homework", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  completionPct: integer("completion_pct").notNull().default(0),
  status: text("status").notNull().default('assigned'), // 'assigned' | 'in_progress' | 'submitted' | 'reviewed'
  deadline: timestamp("deadline"), // дедлайн
  attachments: text("attachments").array().notNull().default(sql`ARRAY[]::text[]`), // ссылки на файлы от репетитора
  solutionAttachments: text("solution_attachments").array().notNull().default(sql`ARRAY[]::text[]`),
  solutionText: text("solution_text").default(''),
  taskIds: text("task_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  feedback: text("feedback"), // отзыв репетитора
  score: integer("score"), // оценка 0-100
  hints: text("hints"), // подсказки от репетитора
  submittedAt: timestamp("submitted_at"), // когда ученик сдал
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHomeworkSchema = createInsertSchema(homework).omit({
  id: true,
  createdAt: true,
});

export type InsertHomework = z.infer<typeof insertHomeworkSchema>;
export type Homework = typeof homework.$inferSelect;

// Цены подписок (subscription_prices) - глобальная настройка
export const subscriptionPrices = pgTable("Replit_subscription_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tier: text("tier").notNull().unique(), // 'pro' | 'premium'
  priceMonthly: integer("price_monthly").notNull(), // цена в рублях за месяц
  priceYearly: integer("price_yearly").notNull(), // цена в рублях за год
  features: text("features").array().notNull().default(sql`ARRAY[]::text[]`),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubscriptionPriceSchema = createInsertSchema(subscriptionPrices).omit({
  id: true,
  updatedAt: true,
});

export type InsertSubscriptionPrice = z.infer<typeof insertSubscriptionPriceSchema>;
export type SubscriptionPrice = typeof subscriptionPrices.$inferSelect;

// Платежи за подписку (subscription_payments)
export const subscriptionPayments = pgTable("Replit_subscription_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  tier: text("tier").notNull(), // 'pro' | 'premium'
  period: text("period").notNull(), // 'monthly' | 'yearly'
  amount: integer("amount").notNull(),
  yookassaPaymentId: text("yookassa_payment_id"),
  status: text("status").notNull().default('pending'), // 'pending' | 'succeeded' | 'canceled'
  paidAt: timestamp("paid_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPayments).omit({
  id: true,
  createdAt: true,
});

export type InsertSubscriptionPayment = z.infer<typeof insertSubscriptionPaymentSchema>;
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;

// Уведомления (notifications)
export const notifications = pgTable("Replit_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'lesson_reminder' | 'payment_reminder' | 'birthday' | 'homework_deadline' | 'system'
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"), // ID связанного объекта (lesson, student, homework)
  isRead: boolean("is_read").notNull().default(false),
  scheduledFor: timestamp("scheduled_for"), // когда показать уведомление
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Заявки от учеников (self-registration через каталог / публичный профиль)
export const studentApplications = pgTable("Replit_student_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  subject: text("subject"),
  grade: text("grade"),
  goal: text("goal"),
  message: text("message"),
  status: text("status").notNull().default('pending'),
  studentId: varchar("student_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentApplicationSchema = createInsertSchema(studentApplications).omit({
  id: true,
  createdAt: true,
  status: true,
  studentId: true,
});

export type InsertStudentApplication = z.infer<typeof insertStudentApplicationSchema>;
export type StudentApplication = typeof studentApplications.$inferSelect;

// Шаблоны занятий (lesson_templates)
export const lessonTemplates = pgTable("Replit_lesson_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),
  duration: integer("duration").notNull().default(60), // минуты
  objectives: text("objectives").array().notNull().default(sql`ARRAY[]::text[]`), // цели урока
  materials: text("materials").array().notNull().default(sql`ARRAY[]::text[]`), // материалы
  activities: jsonb("activities").default([]), // [{title, duration, description}]
  isPublic: boolean("is_public").notNull().default(false), // видно другим репетиторам
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLessonTemplateSchema = createInsertSchema(lessonTemplates).omit({
  id: true,
  createdAt: true,
});

export type InsertLessonTemplate = z.infer<typeof insertLessonTemplateSchema>;
export type LessonTemplate = typeof lessonTemplates.$inferSelect;

// Лимиты для подписок (Старт / Базовый / Про)
export const SUBSCRIPTION_LIMITS = {
  free: {
    name: "Старт",
    maxStudents: 5,
    maxLessonsPerMonth: 20,
    aiChecksPerDay: 5,
    aiTaskGenPerWeek: 3,
    maxAiModels: 1,
    aiTaskGeneration: false,
    bulkMessaging: false,
    analytics: false,
    exportData: false,
    studentPortal: false,
    financialReports: false,
    advancedAnalytics: false,
    aiCurator: false,
    extraStudentPrice: 0,
    monthlyPrice: 0,
    yearlyPrice: 0,
  },
  pro: {
    name: "Базовый",
    maxStudents: 15,
    maxLessonsPerMonth: 150,
    aiChecksPerDay: 30,
    aiTaskGenPerWeek: -1,
    maxAiModels: 3,
    aiTaskGeneration: true,
    bulkMessaging: true,
    analytics: false,
    exportData: true,
    studentPortal: true,
    financialReports: true,
    advancedAnalytics: false,
    aiCurator: false,
    extraStudentPrice: 59,
    monthlyPrice: 790,
    yearlyPrice: 7584,
  },
  premium: {
    name: "Про",
    maxStudents: 40,
    maxLessonsPerMonth: -1,
    aiChecksPerDay: -1,
    aiTaskGenPerWeek: -1,
    maxAiModels: 5,
    aiTaskGeneration: true,
    bulkMessaging: true,
    analytics: true,
    exportData: true,
    studentPortal: true,
    financialReports: true,
    advancedAnalytics: true,
    aiCurator: true,
    extraStudentPrice: 49,
    monthlyPrice: 1490,
    yearlyPrice: 14304,
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_LIMITS;

// Пакеты ИИ для докупки
export const AI_PACKAGE_OPTIONS = [
  { credits: 50, price: 99, label: "50 запросов", popular: false },
  { credits: 150, price: 249, label: "150 запросов", popular: true },
  { credits: 500, price: 699, label: "500 запросов", popular: false },
  { credits: 1500, price: 1490, label: "1 500 запросов", popular: false },
] as const;

// Пакеты доп. учеников
export const EXTRA_STUDENT_PACKAGES = [
  { count: 1, label: "+1 ученик" },
  { count: 5, label: "+5 учеников" },
  { count: 10, label: "+10 учеников" },
] as const;

// Токены сброса пароля (password_reset_tokens)
export const passwordResetTokens = pgTable("Replit_password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Токены доступа для учеников (student_access_tokens)
export const studentAccessTokens = pgTable("Replit_student_access_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentAccessTokenSchema = createInsertSchema(studentAccessTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertStudentAccessToken = z.infer<typeof insertStudentAccessTokenSchema>;
export type StudentAccessToken = typeof studentAccessTokens.$inferSelect;

// ИИ чаты (ai_chats) — отдельные диалоги
export const aiChats = pgTable("Replit_ai_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  homeworkId: varchar("homework_id").references(() => homework.id, { onDelete: 'set null' }),
  title: text("title").notNull().default("Новый чат"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAiChatSchema = createInsertSchema(aiChats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiChat = z.infer<typeof insertAiChatSchema>;
export type AiChat = typeof aiChats.$inferSelect;

// ИИ чат-сообщения (ai_chat_messages)
export const aiChatMessages = pgTable("Replit_ai_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").references(() => aiChats.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  homeworkId: varchar("homework_id").references(() => homework.id, { onDelete: 'set null' }),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAiChatMessageSchema = createInsertSchema(aiChatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertAiChatMessage = z.infer<typeof insertAiChatMessageSchema>;
export type AiChatMessage = typeof aiChatMessages.$inferSelect;

// ИИ чаты репетитора (tutor_ai_chats)
export const tutorAiChats = pgTable("Replit_tutor_ai_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  title: text("title").notNull().default("Новый чат"),
  context: text("context"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTutorAiChatSchema = createInsertSchema(tutorAiChats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTutorAiChat = z.infer<typeof insertTutorAiChatSchema>;
export type TutorAiChat = typeof tutorAiChats.$inferSelect;

// ИИ сообщения репетитора (tutor_ai_chat_messages)
export const tutorAiChatMessages = pgTable("Replit_tutor_ai_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => tutorAiChats.id, { onDelete: 'cascade' }),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTutorAiChatMessageSchema = createInsertSchema(tutorAiChatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertTutorAiChatMessage = z.infer<typeof insertTutorAiChatMessageSchema>;
export type TutorAiChatMessage = typeof tutorAiChatMessages.$inferSelect;

// ИИ использование репетитора (tutor_ai_usage)
export const tutorAiUsage = pgTable("Replit_tutor_ai_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  model: text("model").notNull(),
  usageDate: text("usage_date").notNull(),
  count: integer("count").notNull().default(1),
});

export type TutorAiUsage = typeof tutorAiUsage.$inferSelect;

// ИИ настройки (ai_settings) — глобальные настройки ИИ
export const aiSettings = pgTable("Replit_ai_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AiSetting = typeof aiSettings.$inferSelect;

// ИИ использование (ai_usage) — дневной учёт
export const aiUsage = pgTable("Replit_ai_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  model: text("model").notNull(),
  usageDate: text("usage_date").notNull(),
  count: integer("count").notNull().default(1),
});

export type AiUsage = typeof aiUsage.$inferSelect;

// ИИ пакеты (ai_packages) — докупленные пакеты запросов
export const aiPackages = pgTable("Replit_ai_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(),
  ownerType: text("owner_type").notNull(), // 'tutor' | 'student'
  credits: integer("credits").notNull(),
  usedCredits: integer("used_credits").notNull().default(0),
  pricePaid: integer("price_paid").notNull().default(0),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
});

export const insertAiPackageSchema = createInsertSchema(aiPackages).omit({
  id: true,
  purchasedAt: true,
});

export type InsertAiPackage = z.infer<typeof insertAiPackageSchema>;
export type AiPackage = typeof aiPackages.$inferSelect;

// Шаблоны домашних заданий (homework_templates)
export const homeworkTemplates = pgTable("Replit_homework_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  subject: text("subject").notNull().default(""),
  hints: text("hints"),
  estimatedMinutes: integer("estimated_minutes").default(30),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHomeworkTemplateSchema = createInsertSchema(homeworkTemplates).omit({ id: true, createdAt: true });
export type InsertHomeworkTemplate = z.infer<typeof insertHomeworkTemplateSchema>;
export type HomeworkTemplate = typeof homeworkTemplates.$inferSelect;

// Тренажёры / Quiz-карточки (quizzes)
export const quizzes = pgTable("Replit_quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  // studentId = null → шаблон/общая тренировка для всех учеников репетитора
  studentId: varchar("student_id").references(() => students.id, { onDelete: 'cascade' }),
  topic: text("topic").notNull(),
  description: text("description"),
  // questions: [{ q: string, options: string[], correct: number, explanation?: string }]
  questions: jsonb("questions").notNull().default(sql`'[]'::jsonb`),
  status: text("status").notNull().default('active'), // active | archived
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertQuizSchema = createInsertSchema(quizzes).omit({ id: true, createdAt: true });
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzes.$inferSelect;

// Прохождения тренажёра (quiz_attempts)
export const quizAttempts = pgTable("Replit_quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  // answers: [{ q: number, chosen: number, correct: boolean }]
  answers: jsonb("answers").notNull().default(sql`'[]'::jsonb`),
  score: integer("score").notNull().default(0),
  total: integer("total").notNull().default(0),
  source: text("source").notNull().default('web'), // 'web' | 'telegram'
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({ id: true, startedAt: true });
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttempts.$inferSelect;

// Личные заметки ученика (student_notes)
export const studentNotes = pgTable("Replit_student_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentNoteSchema = createInsertSchema(studentNotes).omit({ id: true, createdAt: true });
export type InsertStudentNote = z.infer<typeof insertStudentNoteSchema>;
export type StudentNote = typeof studentNotes.$inferSelect;

// Прямые сообщения репетитор ↔ ученик (direct_messages)
export const directMessages = pgTable("Replit_direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  role: text("role").notNull(), // 'tutor' | 'student'
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({ id: true, createdAt: true });
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

// BBB Конференции (conferences)
export const conferences = pgTable("Replit_conferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").references(() => students.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  meetingId: text("meeting_id").notNull(),
  attendeePw: text("attendee_pw").notNull(),
  moderatorPw: text("moderator_pw").notNull(),
  isOneTime: boolean("is_one_time").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertConferenceSchema = createInsertSchema(conferences).omit({ id: true, createdAt: true });
export type InsertConference = z.infer<typeof insertConferenceSchema>;
export type Conference = typeof conferences.$inferSelect;

// Записи уроков с расшифровкой и конспектом (lesson_recordings)
export const lessonRecordings = pgTable("Replit_lesson_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").references(() => students.id, { onDelete: 'set null' }),
  conferenceId: varchar("conference_id").references(() => conferences.id, { onDelete: 'set null' }),
  lessonId: varchar("lesson_id"), // мягкая связь, без FK
  title: text("title").notNull(),
  source: text("source").notNull().default('upload'), // 'bbb' | 'upload'
  meetingId: text("meeting_id"),
  bbbRecordId: text("bbb_record_id"),
  playbackUrl: text("playback_url"),
  audioPath: text("audio_path"), // локальный путь или URL к скачанному аудио
  durationSec: integer("duration_sec"),
  transcript: text("transcript"),
  summary: text("summary"),
  notes: jsonb("notes"), // {keyPoints[], terms[{term,def}], homework, fullNotes}
  status: text("status").notNull().default('pending'), // pending|transcribing|summarizing|ready|failed
  errorMessage: text("error_message"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertLessonRecordingSchema = createInsertSchema(lessonRecordings).omit({ id: true, createdAt: true });
export type InsertLessonRecording = z.infer<typeof insertLessonRecordingSchema>;
export type LessonRecording = typeof lessonRecordings.$inferSelect;

// Фичер-флаги (feature_flags) — включить/выключить функции для конкретного репетитора
export const featureFlags = pgTable("Replit_feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  feature: text("feature").notNull(), // e.g. 'ai_chat', 'bbb', 'finance', 'boards', 'yookassa'
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({ id: true, createdAt: true });
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;

// Тикеты поддержки (support_tickets)
export const supportTickets = pgTable("Replit_support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  subject: text("subject").notNull(),
  status: text("status").notNull().default('open'), // 'open' | 'answered' | 'closed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

// ===== TASK BANK =====
// Варианты заданий репетитора
export const taskVariants = pgTable("Replit_task_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull(),
  name: text("name").notNull(),
  taskIds: text("task_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertTaskVariantSchema = createInsertSchema(taskVariants).omit({ id: true, createdAt: true });
export type InsertTaskVariant = z.infer<typeof insertTaskVariantSchema>;
export type TaskVariant = typeof taskVariants.$inferSelect;

// Назначение вариантов ученикам
export const variantAssignments = pgTable("Replit_variant_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  variantId: varchar("variant_id").notNull(),
  studentId: varchar("student_id").notNull(),
  tutorId: varchar("tutor_id").notNull(),
  status: text("status").notNull().default("assigned"), // assigned | completed
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});
export const insertVariantAssignmentSchema = createInsertSchema(variantAssignments).omit({ id: true, assignedAt: true });
export type InsertVariantAssignment = z.infer<typeof insertVariantAssignmentSchema>;
export type VariantAssignment = typeof variantAssignments.$inferSelect;

// Сохранённые планы уроков (saved_lesson_plans)
export const savedLessonPlans = pgTable("Replit_saved_lesson_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull(),
  title: text("title").notNull(),
  subject: text("subject").notNull().default(""),
  grade: text("grade").notNull().default(""),
  lessonType: text("lesson_type").notNull().default("new"),
  duration: integer("duration").notNull().default(60),
  planJson: jsonb("plan_json").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSavedLessonPlanSchema = createInsertSchema(savedLessonPlans).omit({ id: true, createdAt: true });
export type InsertSavedLessonPlan = z.infer<typeof insertSavedLessonPlanSchema>;
export type SavedLessonPlan = typeof savedLessonPlans.$inferSelect;

// Резервные копии данных репетитора (backups)
export const backups = pgTable("Replit_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  type: text("type").notNull().default('manual'), // 'auto' | 'manual'
  note: text("note"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  dataJson: text("data_json").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Backup = typeof backups.$inferSelect;

// Сообщения тикетов поддержки (support_messages)
export const supportMessages = pgTable("Replit_support_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  role: text("role").notNull(), // 'tutor' | 'admin'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({ id: true, createdAt: true });
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type SupportMessage = typeof supportMessages.$inferSelect;

// ────────── Промокоды (promo_codes) ──────────
export const promoCodes = pgTable("Replit_promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: text("discount_type").notNull().default('percent'), // 'percent' | 'fixed'
  discountValue: integer("discount_value").notNull(), // % или рубли
  scope: text("scope").notNull().default('all'), // 'all' | 'subscription' | 'lessons' | 'ai_packages'
  maxUses: integer("max_uses"), // null = безлимитно
  usedCount: integer("used_count").notNull().default(0),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by"), // tutorId или null (admin)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
  id: true,
  usedCount: true,
  createdAt: true,
});
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;

export const promoCodeRedemptions = pgTable("Replit_promo_code_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promoCodeId: varchar("promo_code_id").notNull(),
  userId: varchar("user_id").notNull(),
  userRole: text("user_role").notNull(), // 'tutor' | 'student'
  scope: text("scope").notNull(),
  originalAmount: integer("original_amount").notNull(),
  discountAmount: integer("discount_amount").notNull(),
  finalAmount: integer("final_amount").notNull(),
  referenceId: varchar("reference_id"), // payment_id или subscription_payment_id
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PromoCodeRedemption = typeof promoCodeRedemptions.$inferSelect;
