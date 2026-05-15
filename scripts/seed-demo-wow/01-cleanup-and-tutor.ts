// scripts/seed-demo-wow/01-cleanup-and-tutor.ts
// Шаг 1: очистка всех данных demo-репетитора + обновление профиля
// Запуск: npx tsx scripts/seed-demo-wow/01-cleanup-and-tutor.ts

import * as dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../../server/supabase';

const PFX = 'Tvoy_vector_2_';
const DEMO_EMAIL = 'demo@vector.ru';

// ─── helpers ────────────────────────────────────────────────────────────────

async function del(
  label: string,
  table: string,
  col: string,
  val: string,
): Promise<void> {
  const { count } = await supabase
    .from(`${PFX}${table}`)
    .select('*', { count: 'exact', head: true })
    .eq(col, val);

  if (!count) {
    console.log(`  ⬜ ${label}: 0`);
    return;
  }

  const { error } = await supabase
    .from(`${PFX}${table}`)
    .delete()
    .eq(col, val);

  if (error) console.warn(`  ⚠️  ${label}: ${error.message}`);
  else console.log(`  🗑️  ${label}: ${count} удалено`);
}

async function delIn(
  label: string,
  table: string,
  col: string,
  vals: string[],
): Promise<void> {
  if (!vals.length) {
    console.log(`  ⬜ ${label}: 0`);
    return;
  }

  const { count } = await supabase
    .from(`${PFX}${table}`)
    .select('*', { count: 'exact', head: true })
    .in(col, vals);

  if (!count) {
    console.log(`  ⬜ ${label}: 0`);
    return;
  }

  const { error } = await supabase
    .from(`${PFX}${table}`)
    .delete()
    .in(col, vals);

  if (error) console.warn(`  ⚠️  ${label}: ${error.message}`);
  else console.log(`  🗑️  ${label}: ${count} удалено`);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.time('step-01');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ШАГ 1 — cleanup + update tutor');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Найти репетитора
  console.log('🔍 Поиск demo@vector.ru...');
  const { data: tutor, error: tutorErr } = await supabase
    .from(`${PFX}tutors`)
    .select('id, name, email, subscription')
    .eq('email', DEMO_EMAIL)
    .single();

  if (tutorErr || !tutor) {
    console.error('❌ demo@vector.ru не найден:', tutorErr?.message);
    process.exit(1);
  }

  const TID: string = tutor.id;
  console.log(`✅ Найден: "${tutor.name}" (${TID})\n`);

  // 2. Получить ID всех учеников (нужны для delIn)
  const { data: studentsRaw } = await supabase
    .from(`${PFX}students`)
    .select('id')
    .eq('tutor_id', TID);
  const SIDs: string[] = (studentsRaw ?? []).map((s: any) => s.id);
  console.log(`📋 Учеников в БД сейчас: ${SIDs.length}\n`);

  // ── CLEANUP ──────────────────────────────────────────────────────────────
  console.log('🧹 Начинаем удаление (порядок учитывает FK)...\n');

  // ── ИИ-чаты репетитора (сначала сообщения, потом чаты)
  await del('tutor_ai_chat_messages', 'tutor_ai_chat_messages', 'tutor_id', TID);
  await del('tutor_ai_chats         ', 'tutor_ai_chats', 'tutor_id', TID);

  // ── ИИ-чаты учеников
  await delIn('ai_chat_messages      ', 'ai_chat_messages', 'student_id', SIDs);
  await delIn('ai_chats              ', 'ai_chats', 'student_id', SIDs);

  // ── ИИ-использование
  await delIn('ai_usage (students)   ', 'ai_usage', 'student_id', SIDs);
  await del('tutor_ai_usage          ', 'tutor_ai_usage', 'tutor_id', TID);

  // ── ИИ-пакеты
  await del('ai_packages (tutor)     ', 'ai_packages', 'owner_id', TID);
  await delIn('ai_packages (students)', 'ai_packages', 'owner_id', SIDs);

  // ── Тренажёры (quiz_attempts зависит от quizzes)
  await del('quiz_attempts           ', 'quiz_attempts', 'tutor_id', TID);
  await del('quizzes                 ', 'quizzes', 'tutor_id', TID);

  // ── Записи уроков (зависят от conferences — SET NULL, удалять до конференций)
  await del('lesson_recordings       ', 'lesson_recordings', 'tutor_id', TID);
  await del('conferences             ', 'conferences', 'tutor_id', TID);

  // ── Планы, шаблоны, задачи
  await del('saved_lesson_plans      ', 'saved_lesson_plans', 'tutor_id', TID);
  await del('lesson_templates        ', 'lesson_templates', 'tutor_id', TID);
  await del('homework_templates      ', 'homework_templates', 'tutor_id', TID);
  await del('tasks                   ', 'tasks', 'tutor_id', TID);
  await del('task_variants           ', 'task_variants', 'tutor_id', TID);

  // ── Отзывы
  await del('tutor_reviews           ', 'tutor_reviews', 'tutor_id', TID);

  // ── Уведомления
  await del('notifications           ', 'notifications', 'tutor_id', TID);

  // ── Прямые сообщения
  await del('direct_messages         ', 'direct_messages', 'tutor_id', TID);

  // ── Заявки учеников
  await del('student_applications    ', 'student_applications', 'tutor_id', TID);

  // ── Данные учеников (до удаления самих учеников)
  await delIn('student_notes         ', 'student_notes', 'student_id', SIDs);
  await delIn('student_access_tokens ', 'student_access_tokens', 'student_id', SIDs);
  await delIn('variant_assignments   ', 'variant_assignments', 'student_id', SIDs);

  // ── Основные данные (порядок: homework/payments/lessons → students)
  await del('homework                ', 'homework', 'tutor_id', TID);
  await del('payments                ', 'payments', 'tutor_id', TID);
  await del('lessons                 ', 'lessons', 'tutor_id', TID);

  // ── Ученики в последнюю очередь (CASCADE убьёт остатки)
  await del('students                ', 'students', 'tutor_id', TID);

  console.log('\n✅ CLEANUP завершён\n');

  // ── UPDATE TUTOR ─────────────────────────────────────────────────────────
  console.log('✏️  Обновляем профиль репетитора...');

  const { error: updateErr } = await supabase
    .from(`${PFX}tutors`)
    .update({
      name: 'Максим Горбацевич',
      public_slug: 'maksim-gorbatsevich',
      public_bio: 'Репетитор по математике, физике и информатике. Пермь. 6 лет опыта. Специализация: ЕГЭ/ОГЭ профиль, олимпиадная подготовка.',
      public_experience: '6 лет',
      public_education: 'ПГНИУ, математический факультет. Магистр математики.',
      public_achievements: 'Подготовил 47 выпускников к ЕГЭ. Средний балл учеников — 87 баллов. Три ученика — победители регионального этапа Всероссийской олимпиады.',
      subjects: ['Математика', 'Физика', 'Информатика'],
      base_price: 1700,
      is_public_profile: true,
      subscription: 'premium',
      subscription_until: '2030-12-31T23:59:59Z',
      public_phone: '+7 (342) 200-00-00',
      public_color: 'violet',
      public_hide_price: false,
    })
    .eq('id', TID);

  if (updateErr) {
    console.error('❌ Ошибка обновления:', updateErr.message);
    process.exit(1);
  }

  // Проверка
  const { data: after } = await supabase
    .from(`${PFX}tutors`)
    .select('id, name, email, subscription, subscription_until, public_slug, subjects, base_price')
    .eq('id', TID)
    .single();

  console.log('\n📊 Профиль после обновления:');
  console.log(JSON.stringify(after, null, 2));

  // Быстрый аудит — убедиться что таблицы пусты
  console.log('\n🔍 Быстрый аудит пустоты...');
  const checks = [
    ['students', 'tutor_id', TID] as const,
    ['lessons', 'tutor_id', TID] as const,
    ['homework', 'tutor_id', TID] as const,
    ['payments', 'tutor_id', TID] as const,
    ['notifications', 'tutor_id', TID] as const,
  ];
  for (const [table, col, val] of checks) {
    const { count } = await supabase
      .from(`${PFX}${table}`)
      .select('*', { count: 'exact', head: true })
      .eq(col, val);
    const ok = count === 0 ? '✅' : '❌';
    console.log(`  ${ok} ${table}: ${count ?? '?'} строк`);
  }

  console.log('\n');
  console.timeEnd('step-01');
  console.log('\n🎉 Шаг 1 готов. Следующий: 02-students.ts');
}

main().catch(err => {
  console.error('\n💥 Критическая ошибка:', err);
  process.exit(1);
});
