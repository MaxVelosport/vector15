// scripts/seed-demo-wow/03-lessons.ts
// Шаг 3: занятия для всех 12 учеников demo-репетитора
// Запуск: npx tsx scripts/seed-demo-wow/03-lessons.ts

import * as dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../../server/supabase';

const PFX = 'Tvoy_vector_2_';
const DEMO_EMAIL = 'demo@vector.ru';

const PAST_START = new Date('2025-11-03T00:00:00.000Z'); // первый понедельник периода
const PAST_END   = new Date('2026-05-11T23:59:59.000Z'); // воскресенье перед сегодня
const FUT_START  = new Date('2026-05-13T00:00:00.000Z');
const FUT_END    = new Date('2026-06-10T23:59:59.000Z');

const NOTES = [
  'Разобрали тему, всё понятно с первого раза',
  'Решили 5 задач уровня ЕГЭ',
  'Сложно идёт, нужно больше практики',
  'Отлично работает на занятии, активный',
  'Сделали разбор ошибок прошлого урока',
  'Хорошо подготовился к занятию',
  'Прошли теорию, домашка — 5 задач',
  'Работали над слабым местом — стало лучше',
  'Решили олимпиадную задачу нестандартным способом',
  'Закрепляли тему через типовые задания',
];

// ─── типы ───────────────────────────────────────────────────────────────────

interface Slot { dow: number; hUtc: number; mUtc: number; } // dow: 0=Вс,1=Пн,...,6=Сб
interface StudentDef {
  name: string;
  slots: Slot[];
  duration: number;
  completed: number;   // завершённых (attended + missed_paid)
  cancelled: number;   // отменённых
  pending: number;     // предстоящих
  topics: string[];
}

// ─── конфигурация 12 учеников ───────────────────────────────────────────────
// UTC = MSK - 3h

const STUDENTS: StudentDef[] = [
  {
    name: 'Алёна Морозова',
    slots: [{ dow: 1, hUtc: 14, mUtc: 0 }, { dow: 3, hUtc: 14, mUtc: 0 }], // Пн+Ср 17:00
    duration: 90, completed: 28, cancelled: 3, pending: 3,
    topics: [
      'Понятие производной', 'Производная многочлена', 'Производная сложной функции',
      'Производная произведения и частного', 'Применение производной к исследованию функций',
      'Производная и касательная', 'Производная и графики',
      'Решение задач ЕГЭ часть 1', 'Решение задач ЕГЭ часть 2', 'Геометрический смысл производной',
    ],
  },
  {
    name: 'Кирилл Орлов',
    slots: [{ dow: 2, hUtc: 15, mUtc: 0 }, { dow: 4, hUtc: 15, mUtc: 0 }], // Вт+Чт 18:00
    duration: 90, completed: 22, cancelled: 3, pending: 3,
    topics: [
      'Закон Кулона', 'Электрическое поле точечного заряда', 'Принцип суперпозиции',
      'Конденсаторы', 'Электроёмкость', 'Соединения конденсаторов',
      'Постоянный ток', 'Закон Ома', 'Соединения резисторов', 'Закон Джоуля-Ленца',
    ],
  },
  {
    name: 'Софья Лебедева',
    slots: [{ dow: 1, hUtc: 13, mUtc: 0 }, { dow: 3, hUtc: 13, mUtc: 0 }, { dow: 5, hUtc: 13, mUtc: 0 }], // Пн+Ср+Пт 16:00
    duration: 90, completed: 35, cancelled: 4, pending: 3,
    topics: [
      'Призмы — основные формулы', 'Пирамида правильная', 'Пирамида произвольная',
      'Усечённая пирамида', 'Цилиндр и его сечения', 'Конус и его сечения',
      'Шар и сфера', 'Многогранники описанные', 'Многогранники вписанные', 'Координатный метод',
    ],
  },
  {
    name: 'Артём Соколов',
    slots: [{ dow: 6, hUtc: 11, mUtc: 0 }], // Сб 14:00
    duration: 60, completed: 18, cancelled: 3, pending: 2,
    topics: [
      'Квадратные уравнения — формулы', 'Теорема Виета', 'Биквадратные уравнения',
      'Возвратные уравнения', 'Графический способ', 'Параметры в квадратных',
      'Иррациональные уравнения', 'Системы с квадратами', 'Текстовые задачи на квадраты', 'ОГЭ — задачи №21',
    ],
  },
  {
    name: 'Полина Васильева',
    slots: [{ dow: 2, hUtc: 14, mUtc: 0 }], // Вт 17:00
    duration: 60, completed: 14, cancelled: 3, pending: 2,
    topics: [
      'Электрические явления — введение', 'Заряд и его свойства', 'Электризация трением',
      'Электрические токи', 'Сила тока', 'Напряжение',
      'Сопротивление', 'Закон Ома (ОГЭ)', 'Электрическая работа', 'Мощность тока',
    ],
  },
  {
    name: 'Михаил Кузнецов',
    slots: [{ dow: 1, hUtc: 16, mUtc: 0 }, { dow: 3, hUtc: 16, mUtc: 0 }, { dow: 5, hUtc: 16, mUtc: 0 }], // Пн+Ср+Пт 19:00
    duration: 120, completed: 42, cancelled: 4, pending: 3,
    topics: [
      'Делимость целых чисел', 'НОД и НОК', 'Алгоритм Евклида',
      'Простые числа', 'Решето Эратосфена', 'Малая теорема Ферма',
      'Теорема Эйлера', 'Сравнения по модулю', 'Китайская теорема об остатках', 'Принцип Дирихле',
    ],
  },
  {
    name: 'Дарья Иванова',
    slots: [{ dow: 1, hUtc: 15, mUtc: 0 }, { dow: 4, hUtc: 15, mUtc: 0 }], // Пн+Чт 18:00
    duration: 90, completed: 26, cancelled: 3, pending: 3,
    topics: [
      'Введение в динамическое программирование', 'Задача о наибольшей возрастающей подпоследовательности',
      'Задача о рюкзаке', 'Расстояние Левенштейна', 'Динамика по подотрезкам',
      'Динамика на дереве', 'Графы — основы', 'Обход в ширину BFS',
      'Обход в глубину DFS', 'Кратчайшие пути Дейкстра',
    ],
  },
  {
    name: 'Никита Петров',
    slots: [{ dow: 6, hUtc: 8, mUtc: 0 }], // Сб 11:00
    duration: 60, completed: 12, cancelled: 3, pending: 2,
    topics: [
      'Обыкновенные дроби', 'Сложение и вычитание дробей', 'Умножение и деление дробей',
      'Десятичные дроби', 'Проценты', 'Прямая пропорциональность',
      'Обратная пропорциональность', 'Задачи на проценты', 'Координатная плоскость', 'Линейные функции',
    ],
  },
  {
    name: 'Виктория Смирнова',
    slots: [{ dow: 1, hUtc: 12, mUtc: 0 }, { dow: 4, hUtc: 12, mUtc: 0 }], // Пн+Чт 15:00
    duration: 60, completed: 16, cancelled: 3, pending: 2,
    topics: [
      'Тригонометрический круг', 'Синус и косинус', 'Тангенс и котангенс',
      'Основное тригонометрическое тождество', 'Формулы сложения', 'Формулы двойного угла',
      'Простейшие тригонометрические уравнения', 'Уравнения sin x = a',
      'Уравнения cos x = a', 'Решение тригонометрических неравенств',
    ],
  },
  {
    name: 'Даниил Захаров',
    slots: [{ dow: 3, hUtc: 13, mUtc: 0 }], // Ср 16:00
    duration: 60, completed: 11, cancelled: 3, pending: 2,
    topics: [
      'Степень с натуральным показателем', 'Свойства степеней', 'Корни и иррациональности',
      'Логарифм — определение', 'Свойства логарифмов', 'Логарифмические уравнения',
      'Простейшие случаи', 'Замена переменной', 'Системы уравнений', 'ЕГЭ база — типовые задачи',
    ],
  },
  {
    name: 'Анна Орехова',
    slots: [{ dow: 2, hUtc: 14, mUtc: 30 }, { dow: 6, hUtc: 9, mUtc: 0 }], // Вт 17:30 + Сб 12:00
    duration: 90, completed: 20, cancelled: 3, pending: 3,
    topics: [
      'Электростатика — основы', 'Закон Кулона', 'Принцип суперпозиции',
      'Электрическое поле', 'Потенциал электростатического поля', 'Разность потенциалов',
      'Конденсаторы — теория', 'Энергия конденсатора',
      'Олимпиадные задачи на конденсаторы', 'Электростатические машины',
    ],
  },
  {
    name: 'Глеб Тимофеев',
    slots: [{ dow: 1, hUtc: 14, mUtc: 0 }, { dow: 3, hUtc: 14, mUtc: 0 }], // Пн+Ср 17:00
    duration: 90, completed: 15, cancelled: 3, pending: 3,
    topics: [
      'Векторы в пространстве', 'Сложение векторов', 'Скалярное произведение',
      'Координаты вектора', 'Уравнение прямой', 'Уравнение плоскости',
      'Угол между прямыми', 'Расстояние от точки до плоскости',
      'Параллельность и перпендикулярность', 'Координатный метод — задачи ЕГЭ',
    ],
  },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function genSlots(start: Date, end: Date, slots: Slot[]): Date[] {
  const result: Date[] = [];
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);

  while (cur.getTime() <= end.getTime()) {
    const dow = cur.getUTCDay();
    for (const s of slots) {
      if (s.dow === dow) {
        const d = new Date(cur);
        d.setUTCHours(s.hUtc, s.mUtc, 0, 0);
        if (d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) {
          result.push(d);
        }
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return result.sort((a, b) => a.getTime() - b.getTime());
}

function buildLessons(
  tutorId: string,
  studentId: string,
  def: StudentDef,
  pastSlots: Date[],
  futureSlots: Date[],
): object[] {
  const totalPast = def.completed + def.cancelled;
  const selected = pastSlots.slice(0, totalPast);

  if (selected.length < totalPast) {
    console.warn(`    ⚠️  ${def.name}: нужно ${totalPast} слотов, доступно ${selected.length}`);
  }

  const n = selected.length;

  // Cancelled равномерно по периоду
  const cancelledIdxs = new Set<number>();
  for (let i = 0; i < def.cancelled && i < n; i++) {
    let idx = Math.round((i + 0.5) * n / def.cancelled);
    idx = Math.min(idx, n - 1);
    while (cancelledIdxs.has(idx) && idx < n - 1) idx++;
    cancelledIdxs.add(idx);
  }

  // 10% completed → missed_paid (округлённо), остальные → attended
  const missedPaidCount = Math.round(def.completed * 0.1);
  const attendedCount = def.completed - missedPaidCount;

  const entries: object[] = [];
  let completedSeen = 0;

  selected.forEach((date, i) => {
    const topicIdx = i % def.topics.length;

    if (cancelledIdxs.has(i)) {
      entries.push({
        tutor_id: tutorId, student_id: studentId,
        scheduled_at: date.toISOString(),
        duration_minutes: def.duration,
        topic: def.topics[topicIdx],
        status: 'cancelled', attendance: 'missed',
        rating: null, notes: null, cancel_amount: null,
      });
    } else {
      const isMissedPaid = completedSeen >= attendedCount;
      const attendance = isMissedPaid ? 'missed_paid' : 'attended';
      entries.push({
        tutor_id: tutorId, student_id: studentId,
        scheduled_at: date.toISOString(),
        duration_minutes: def.duration,
        topic: def.topics[topicIdx],
        status: 'completed', attendance,
        rating: isMissedPaid ? 5 : (completedSeen % 10 < 3 ? 4 : 5),
        notes: isMissedPaid ? null : NOTES[completedSeen % NOTES.length],
        cancel_amount: null,
      });
      completedSeen++;
    }
  });

  // Pending
  futureSlots.slice(0, def.pending).forEach((date, i) => {
    entries.push({
      tutor_id: tutorId, student_id: studentId,
      scheduled_at: date.toISOString(),
      duration_minutes: def.duration,
      topic: def.topics[(n + i) % def.topics.length],
      status: 'pending', attendance: null,
      rating: null, notes: null, cancel_amount: null,
    });
  });

  return entries;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.time('step-03');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ШАГ 3 — lessons (12 учеников)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Репетитор
  const { data: tutor, error: tutorErr } = await supabase
    .from(`${PFX}tutors`).select('id').eq('email', DEMO_EMAIL).single();
  if (tutorErr || !tutor) { console.error('❌ demo@vector.ru не найден:', tutorErr?.message); process.exit(1); }
  const TID: string = tutor.id;
  console.log(`✅ Репетитор: ${TID}\n`);

  // 2. Удалить ВСЕ занятия репетитора
  const { count: existing } = await supabase
    .from(`${PFX}lessons`).select('*', { count: 'exact', head: true }).eq('tutor_id', TID);
  console.log(`🗑️  Удаляем ${existing ?? 0} старых занятий...`);
  if (existing && existing > 0) {
    const { error: delErr } = await supabase.from(`${PFX}lessons`).delete().eq('tutor_id', TID);
    if (delErr) { console.error('❌ Ошибка удаления:', delErr.message); process.exit(1); }
  }
  console.log('✅ Очищено\n');

  // 3. Загрузить ID учеников
  const { data: dbStudents } = await supabase
    .from(`${PFX}students`).select('id, name').eq('tutor_id', TID);
  const nameToId: Record<string, string> = {};
  for (const s of dbStudents ?? []) nameToId[s.name] = s.id;
  console.log(`📋 Найдено учеников в БД: ${Object.keys(nameToId).length}\n`);

  // 4. Генерация и вставка
  console.log('📅 Генерируем занятия...\n');
  let totalInserted = 0;

  for (const def of STUDENTS) {
    const sid = nameToId[def.name];
    if (!sid) { console.warn(`  ⚠️  "${def.name}" — не найден в БД, пропускаем`); continue; }

    const past = genSlots(PAST_START, PAST_END, def.slots);
    const future = genSlots(FUT_START, FUT_END, def.slots);
    const entries = buildLessons(TID, sid, def, past, future);

    const { error } = await supabase.from(`${PFX}lessons`).insert(entries);
    if (error) { console.error(`  ❌ ${def.name}: ${error.message}`); continue; }

    const cc = entries.filter((e: any) => e.status === 'completed').length;
    const cx = entries.filter((e: any) => e.status === 'cancelled').length;
    const cp = entries.filter((e: any) => e.status === 'pending').length;
    const mp = entries.filter((e: any) => e.attendance === 'missed_paid').length;

    totalInserted += entries.length;
    console.log(
      `  ✅ ${def.name.padEnd(22)} ${String(entries.length).padStart(3)} уроков` +
      `  (${cc}c / ${cx}x / ${cp}p` + (mp ? ` / ${mp} missed_paid` : '') + ')',
    );
  }

  // 5. Финальная проверка из БД
  console.log('\n' + '─'.repeat(50));
  const { data: statusRows } = await supabase
    .from(`${PFX}lessons`).select('status, attendance').eq('tutor_id', TID);

  const byStatus: Record<string, number> = {};
  const byAtt: Record<string, number> = {};
  for (const r of statusRows ?? []) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.attendance) byAtt[r.attendance] = (byAtt[r.attendance] ?? 0) + 1;
  }

  console.log('\n📊 ИТОГИ (из БД):');
  console.log(`  Всего: ${statusRows?.length ?? 0}`);
  console.log(`  По статусу:     completed=${byStatus.completed ?? 0}  cancelled=${byStatus.cancelled ?? 0}  pending=${byStatus.pending ?? 0}`);
  console.log(`  По посещаемости: attended=${byAtt.attended ?? 0}  missed_paid=${byAtt.missed_paid ?? 0}  missed=${byAtt.missed ?? 0}`);

  console.log('\n');
  console.timeEnd('step-03');
  console.log('\n🎉 Шаг 3 готов. Проверь учеников в браузере, затем даём ОК → шаг 4 (payments).');
}

main().catch(err => {
  console.error('\n💥 Критическая ошибка:', err);
  process.exit(1);
});
