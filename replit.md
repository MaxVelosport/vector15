# Твой Вектор — AI LMS/CRM Platform for Tutors

## Overview
"Твой Вектор" is a comprehensive Learning Management System (LMS) and CRM platform designed for tutors and students. It offers a wide range of features including tutor/student portals, lesson scheduling, homework management, financial tracking, gamification elements, AI assistants, Telegram bot notifications, and video conferencing capabilities. The platform aims to streamline educational processes, enhance tutor-student interaction, and provide advanced tools for managing learning and administrative tasks.

## User Preferences
Not specified.

## System Architecture
The platform is built with a modern web stack. The **frontend** uses React 19 with Vite for fast development, TanStack Query v5 for data fetching, Tailwind CSS v4 for styling, Radix UI (Shadcn/ui) for UI components, Framer Motion for animations, and Wouter for routing. The **backend** is powered by Node.js and Express 5, handling API requests, business logic, and integrations. User authentication is managed with Passport.js and bcrypt for session-based security.

**Database:** Supabase is used as the primary database, accessed via its JavaScript SDK (`@supabase/supabase-js`), rather than a direct PostgreSQL connection. Drizzle ORM is used for database schema management, with `npm run db:push` synchronizing the schema.

**Project Structure:**
- `client/`: Contains all frontend-related code (React components, hooks, pages).
- `server/`: Houses backend logic, including API routes, storage handling, and external service integrations.
- `shared/`: Stores shared TypeScript types and Zod schemas used across both frontend and backend.
- `uploads/`: Directory for user-uploaded files.

**UI/UX Decisions:** The platform utilizes Radix UI and Tailwind CSS for a modern, responsive, and accessible user interface. SEO and UX are enhanced with dynamic document titles using `useDocumentTitle` on key pages.

**Technical Implementations:**
- **Rate Limiting:** Implemented using `express-rate-limit` for various API endpoints, with different limits for global access, authentication, AI requests, uploads, webhooks, and read/write operations.
- **Security Enhancements:** Recent audits have addressed vulnerabilities such as improper input validation, IDOR (Insecure Direct Object Reference) in lesson and homework management, and webhook spoofing by implementing ownership checks and secure validation.
- **Certificate Generation:** A dynamic A4 certificate generation feature (`/certificate/:studentId`) provides a printable progress report for students.
- **Trial Lesson CTA:** A dedicated "Free Trial Lesson" call-to-action is integrated into tutor public profiles to streamline lead capture.
- **Telegram Bot Features:** Includes inline mode for sharing, interactive reminders, a Mini App for embedded web experiences, Quiz-mode directly within the bot, and a proactive nudge scheduler for daily training.
- **Quiz-mode (Trenażor):** Dedicated sections in both frontend and backend for creating and managing quizzes, with specific Supabase tables (`Tvoy_vector_2_quizzes`, `Tvoy_vector_2_quiz_attempts`) and robust access control.
- **Lesson Recordings and Transcription:** A comprehensive pipeline for handling lesson recordings from BigBlueButton (BBB). This involves uploading audio, transcribing with OpenAI Whisper, summarizing with GPT-4o-mini, and notifying users. Includes dedicated Supabase table (`Tvoy_vector_2_lesson_recordings`) and robust API endpoints for management.
- **Database Table Prefixing:** Real Supabase tables use the `Tvoy_vector_2_` prefix, while Drizzle schemas for local development use `Replit_*` for compatibility with Replit's internal PostgreSQL. New tables must be created directly in production Supabase via SQL.
- **Promo Codes:** Full admin CRUD at `/admin → Промокоды` tab (create/edit/delete codes with percent or fixed discounts, scope, max uses, validity dates). Backend tables `Tvoy_vector_2_promo_codes` and `Tvoy_vector_2_promo_code_redemptions`. Endpoints: `GET/POST/PATCH/DELETE /api/admin/promo-codes`, `POST /api/promo-codes/validate`. Integrated into AI package checkout (apply promo input on `AiPackagePurchaseDialog`); webhook records redemption + increments `usedCount` on payment success.
- **Lead Pipeline (Kanban):** `/applications` page now offers two views — flat list (default) and kanban board (toggle via tabs). Pipeline stages: Новая → Связались → Пробный → Принят / Отклонён. Endpoint `PATCH /api/applications/:id/status` enforces a strict adjacent-step transition matrix (pending↔contacted↔trial_scheduled). Terminal `accepted` (creates a Student) / `rejected` use the existing `POST /accept` and `POST /reject` and now work from any non-terminal stage.
- **Webhook Hardening:** YooKassa webhook now uses an idempotency table (`Tvoy_vector_2_processed_webhook_events`, primary key on `event_id`) to atomically deduplicate retried `payment.succeeded` notifications — so a repeated webhook can never double-credit a balance, AI package, extra-students slot, or subscription. Promo code `usedCount` is incremented via raw SQL `used_count = used_count + 1` (atomic), eliminating the previous read-modify-write race under concurrent purchases.
- **Auto Parent Reports (cron):** New columns on `Tvoy_vector_2_students`: `parent_report_schedule` ('off'|'weekly'|'monthly'), `parent_report_last_sent_at`. Selector appears in the student detail panel when `parentContact` is an email. Hourly scheduler tick (`server/notification-scheduler.ts → sendParentReports`) builds an HTML progress report (lessons / homework / averages) and emails it via SMTP. Race-safe: in-process lock + atomic compare-and-set on `parent_report_last_sent_at` per student to prevent duplicate sends.

## External Dependencies
- **Supabase:** Core database and authentication service (`@supabase/supabase-js`).
- **OpenAI:** Utilized for AI functionalities, specifically GPT-4o for summarization and Whisper for audio transcription.
- **Telegram Bot API:** For sending notifications, interactive elements, and providing a Mini App experience.
- **BigBlueButton (BBB):** Integrated for video conferencing and lesson recording capabilities.
- **YooKassa:** Payment gateway for processing financial transactions.
- **Nodemailer (SMTP):** For sending emails (password resets, notifications, support tickets).
- **Express-rate-limit:** Middleware for API rate limiting.
- **Multer:** For handling file uploads (`uploads/` directory).