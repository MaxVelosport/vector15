// scripts/seed-demo-wow/07-tutor-reviews.ts
// Шаг 7: 12 отзывов на публичный профиль репетитора
// Запуск: npx tsx scripts/seed-demo-wow/07-tutor-reviews.ts

import * as dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../../server/supabase';

const PFX = 'Tvoy_vector_2_';
const DEMO_EMAIL = 'demo@vector.ru';

async function getTutorId(): Promise<string> {
  const { data, error } = await supabase
    .from(`${PFX}tutors`)
    .select('id')
    .eq('email', DEMO_EMAIL)
    .single();
  if (error || !data) throw new Error(`Репетитор не найден: ${error?.message}`);
  return data.id;
}

const REVIEWS = [
  {
    author_name: 'Елена М.',
    author_contact: null,
    rating: 5,
    text: 'Максим занимается с моей дочерью с октября. Подготовка к ЕГЭ профильной математике идёт системно — каждое занятие с разбором ошибок, домашка проверяется детально. Алёна перестала бояться задач второй части. Рекомендую!',
    created_at: '2026-04-15T10:00:00.000Z',
  },
  {
    author_name: 'Андрей К.',
    author_contact: null,
    rating: 5,
    text: 'Сын готовится к олимпиаде. Сложно найти преподавателя, способного работать с сильным учеником на нужном уровне. Максим — попадание в точку. Решают задачи которые я сам не понимаю, и ребёнок горит.',
    created_at: '2026-03-22T12:00:00.000Z',
  },
  {
    author_name: 'Ирина С.',
    author_contact: null,
    rating: 5,
    text: 'Дочь очень стеснительная, боялась заниматься. Максим терпеливый, объясняет несколько раз без раздражения. За полгода — ОГЭ-результаты с 3 на 4-5 уверенно.',
    created_at: '2026-04-02T09:30:00.000Z',
  },
  {
    author_name: 'Олег П.',
    author_contact: null,
    rating: 5,
    text: 'Готовился к ЕГЭ профильная математика, начинал с 60 баллов. На пробнике уже 84. Главное — Максим не просто решает за меня, а заставляет думать. Это работает.',
    created_at: '2026-04-28T18:00:00.000Z',
  },
  {
    author_name: 'Татьяна В.',
    author_contact: null,
    rating: 5,
    text: 'Сын учится в 9 классе. Готовимся к ОГЭ. Максим организованный — есть программа, я её вижу, понимаю прогресс. Платформа удобная — оплатил и видно расписание.',
    created_at: '2026-04-10T14:00:00.000Z',
  },
  {
    author_name: 'Светлана Б.',
    author_contact: null,
    rating: 4,
    text: 'Хорошие занятия, ребёнок подтянул математику в 8 классе. Стало интересно. Единственное — иногда хотелось бы больше домашек.',
    created_at: '2026-03-18T11:00:00.000Z',
  },
  {
    author_name: 'Дмитрий Ф.',
    author_contact: null,
    rating: 5,
    text: 'Готовим к олимпиаде по физике. Максим действительно увлечён предметом — это видно. У дочери глаза горят после занятий. Идём на регионалку.',
    created_at: '2026-04-25T16:00:00.000Z',
  },
  {
    author_name: 'Марина Х.',
    author_contact: null,
    rating: 5,
    text: 'Дочь — 11 класс, цель 95+ баллов ЕГЭ. Занимаемся уже год. Максим разбирается в нюансах профильной математики, знает все типы заданий ЕГЭ. Стоит каждой копейки.',
    created_at: '2026-04-20T10:30:00.000Z',
  },
  {
    author_name: 'Александра Н.',
    author_contact: null,
    rating: 5,
    text: 'Готовилась к ЕГЭ информатика 11 класс. С Максимом мы наконец разобрались с динамическим программированием. Объясняет на пальцах самые сложные алгоритмы. Спасибо!',
    created_at: '2026-05-05T19:00:00.000Z',
  },
  {
    author_name: 'Игорь Р.',
    author_contact: null,
    rating: 5,
    text: 'Удобно что есть личный кабинет — видно когда занятие, сколько оплачено, что ребёнок сделал. Не нужно дёргать преподавателя по мелочам. Современный подход.',
    created_at: '2026-04-12T15:00:00.000Z',
  },
  {
    author_name: 'Анна Т.',
    author_contact: null,
    rating: 5,
    text: 'Системно готовимся к ЕГЭ заранее, ещё 10 класс. Максим строит долгосрочный план, видим прогресс. Доверяю полностью.',
    created_at: '2026-03-15T13:00:00.000Z',
  },
  {
    author_name: 'Виктория З.',
    author_contact: null,
    rating: 4,
    text: 'Хороший преподаватель, многое объясняет. Иногда переходит на сложные темы быстро, но в целом довольна результатом.',
    created_at: '2026-04-30T17:00:00.000Z',
  },
];

async function main() {
  const tutorId = await getTutorId();

  // Удаляем старые отзывы
  await supabase.from(`${PFX}tutor_reviews`).delete().eq('tutor_id', tutorId);

  const rows = REVIEWS.map((r) => ({
    tutor_id: tutorId,
    author_name: r.author_name,
    author_contact: r.author_contact,
    rating: r.rating,
    text: r.text,
    is_approved: true,
    created_at: r.created_at,
  }));

  const { error } = await supabase.from(`${PFX}tutor_reviews`).insert(rows);
  if (error) throw new Error(`Ошибка вставки отзывов: ${error.message}`);

  console.log(`✅ Шаг 7: ${rows.length} отзывов`);
}

main().catch((e) => { console.error(e); process.exit(1); });
