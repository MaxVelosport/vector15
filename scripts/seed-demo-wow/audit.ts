// Финальный аудит demo-данных
import * as dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../../server/supabase';

const PFX = 'Tvoy_vector_2_';
const DEMO_EMAIL = 'demo@vector.ru';

async function count(table: string, col: string, val: string): Promise<number> {
  const { count } = await supabase
    .from(`${PFX}${table}`)
    .select('*', { count: 'exact', head: true })
    .eq(col, val);
  return count ?? 0;
}

async function main() {
  const { data: tutor } = await supabase.from(`${PFX}tutors`).select('id').eq('email', DEMO_EMAIL).single();
  const tid = tutor!.id;

  // Считаем студентов
  const students = await count('students', 'tutor_id', tid);

  // Для ai_chats нужны student_ids
  const { data: studentRows } = await supabase.from(`${PFX}students`).select('id').eq('tutor_id', tid);
  const sids = studentRows!.map((s: { id: string }) => s.id);

  const { count: aiChats } = await supabase.from(`${PFX}ai_chats`).select('*', { count: 'exact', head: true }).in('student_id', sids);
  const { count: aiChatMsgs } = await supabase.from(`${PFX}ai_chat_messages`).select('*', { count: 'exact', head: true }).in('student_id', sids);

  // Tutor ai chats
  const tutorAiChats = await count('tutor_ai_chats', 'tutor_id', tid);
  const { count: tutorAiMsgs } = await supabase.from(`${PFX}tutor_ai_chat_messages`).select('*', { count: 'exact', head: true }).eq('tutor_id', tid);

  // Notifications — может быть student-side, считаем по tutor
  const { count: notifs } = await supabase.from(`${PFX}notifications`).select('*', { count: 'exact', head: true }).eq('tutor_id', tid);

  const rows = [
    ['tutors',                  '1 (ожидается)',        '1'],
    ['students',                '12 (ожидается)',       String(students)],
    ['lessons',                 '~328 (ожидается)',     String(await count('lessons', 'tutor_id', tid))],
    ['payments',                '122 (ожидается)',      String(await count('payments', 'tutor_id', tid))],
    ['ai_chats (ученики)',      '6 (ожидается)',        String(aiChats ?? 0)],
    ['ai_chat_messages',        '24 (ожидается)',       String(aiChatMsgs ?? 0)],
    ['tutor_ai_chats',          '6 (ожидается)',        String(tutorAiChats)],
    ['tutor_ai_chat_messages',  '25 (ожидается)',       String(tutorAiMsgs ?? 0)],
    ['tutor_reviews',           '12 (ожидается)',       String(await count('tutor_reviews', 'tutor_id', tid))],
    ['saved_lesson_plans',      '6 (ожидается)',        String(await count('saved_lesson_plans', 'tutor_id', tid))],
    ['tasks',                   '40 (ожидается)',       String(await count('tasks', 'tutor_id', tid))],
    ['lesson_recordings',       '1 (ожидается)',        String(await count('lesson_recordings', 'tutor_id', tid))],
    ['notifications',           '? (ожидается)',        String(notifs ?? 0)],
  ];

  console.log('\n════════════════ ФИНАЛЬНЫЙ АУДИТ demo@vector.ru ════════════════');
  console.log(`${'Таблица'.padEnd(30)} ${'Ожидается'.padEnd(20)} ${'Факт'.padEnd(10)} Статус`);
  console.log('─'.repeat(75));
  for (const [table, expected, actual] of rows) {
    const exp = expected.match(/\d+/)?.[0];
    const status = exp ? (Number(actual) >= Number(exp) ? '✅' : '❌') : '📊';
    console.log(`${table.padEnd(30)} ${expected.padEnd(20)} ${actual.padEnd(10)} ${status}`);
  }
  console.log('═'.repeat(75));
}

main().catch((e) => { console.error(e); process.exit(1); });
