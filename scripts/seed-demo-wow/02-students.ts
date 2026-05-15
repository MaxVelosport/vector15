// scripts/seed-demo-wow/02-students.ts
// Шаг 2: создание 12 учеников demo-репетитора
// Запуск: npx tsx scripts/seed-demo-wow/02-students.ts

import * as dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../../server/supabase';

const PFX = 'Tvoy_vector_2_';
const DEMO_EMAIL = 'demo@vector.ru';

// ─── Данные учеников ─────────────────────────────────────────────────────────

const STUDENTS = [
  {
    name: 'Алёна Морозова',
    subject: 'Математика',
    goal: 'ЕГЭ профиль 90+',
    grade: '11 класс',
    price_per_lesson: 1800,
    balance: 12000,
    progress: 78,
    lessons_completed: 28,
    curriculum_topic: 'Производные и интегралы',
    has_program: true,
    comment: 'Сильная по алгебре, слабая в геометрии. Целеустремлённая, готовится с октября.',
    parent_contact: '+7 (912) 345-67-89',
    birthday: '2008-04-15',
    average_rating: 5,
    questionnaire: {
      favorite_topics: ['Алгебра', 'Производные', 'Графики функций'],
      weak_topics: ['Стереометрия', 'Доказательства теорем', 'Задачи с параметрами'],
      learning_style: 'Визуальный — хорошо воспринимает объяснения через графики и схемы',
      motivation: 'Поступление на факультет ВМК МГУ или мехмат',
      study_hours_per_week: 8,
      exam_target_score: 90,
      current_difficulties: 'Теряет баллы на C5 и C6 в ЕГЭ — сложные геометрия и параметры',
    },
    program_data: {
      title: 'Подготовка к ЕГЭ Математика профиль 2026',
      total_weeks: 32,
      current_week: 20,
      modules: [
        { name: 'Алгебра и начала анализа', progress: 85, topics: ['Квадратные уравнения', 'Неравенства', 'Функции и графики', 'Производная', 'Первообразная'] },
        { name: 'Геометрия', progress: 55, topics: ['Планиметрия', 'Стереометрия', 'Координатный метод'] },
        { name: 'Тексты и задачи с параметрами', progress: 40, topics: ['Задачи с параметрами', 'Финансовые задачи', 'Логические задачи'] },
      ],
    },
  },
  {
    name: 'Кирилл Орлов',
    subject: 'Физика',
    goal: 'ЕГЭ физика',
    grade: '11 класс',
    price_per_lesson: 1800,
    balance: -3000,
    progress: 65,
    lessons_completed: 22,
    curriculum_topic: 'Электродинамика',
    has_program: false,
    comment: 'Тяжело идёт электричество, но механику понимает отлично. Иногда забывает делать ДЗ.',
    parent_contact: '+7 (982) 110-45-67',
    birthday: '2008-08-22',
    average_rating: 5,
    questionnaire: {
      favorite_topics: ['Механика', 'Законы сохранения', 'Кинематика'],
      weak_topics: ['Электродинамика', 'Магнитное поле', 'Термодинамика'],
      learning_style: 'Аналитический — любит разобраться в физическом смысле перед решением задач',
      motivation: 'Поступление в технический вуз, машиностроение',
      study_hours_per_week: 4,
      exam_target_score: 72,
      note: 'Есть задолженность по оплате, напомнить родителям',
    },
    program_data: null,
  },
  {
    name: 'Софья Лебедева',
    subject: 'Математика',
    goal: 'ЕГЭ профиль 95+',
    grade: '11 класс',
    price_per_lesson: 2000,
    balance: 8500,
    progress: 82,
    lessons_completed: 35,
    curriculum_topic: 'Стереометрия',
    has_program: true,
    comment: 'Топ-ученица. Готовим на МГУ/ВШЭ. Очень быстро схватывает.',
    parent_contact: '+7 (912) 555-12-34',
    birthday: '2008-02-10',
    average_rating: 5,
    questionnaire: {
      favorite_topics: ['Алгебра', 'Комбинаторика', 'Теория вероятностей', 'Нестандартные задачи'],
      weak_topics: ['Стереометрия — пространственное воображение', 'Оформление решений на скорость'],
      learning_style: 'Самостоятельный — приходит с разобранным материалом, уточняет детали',
      motivation: 'Бюджет ВМК МГУ или ВШЭ Прикладная математика',
      study_hours_per_week: 12,
      exam_target_score: 95,
      current_difficulties: 'Нужно довести стереометрию и задачи типа C7',
    },
    program_data: {
      title: 'Подготовка к ЕГЭ Математика профиль 2026 — продвинутый уровень',
      total_weeks: 28,
      current_week: 22,
      modules: [
        { name: 'Алгебра (завершено)', progress: 100, topics: ['Квадратные уравнения', 'Системы', 'Степени', 'Логарифмы', 'Тригонометрия'] },
        { name: 'Анализ', progress: 90, topics: ['Производная', 'Экстремумы', 'Первообразная', 'Интеграл'] },
        { name: 'Геометрия', progress: 70, topics: ['Планиметрия', 'Стереометрия', 'Координатный метод'] },
        { name: 'Сложные задачи (C5-C7)', progress: 50, topics: ['Задачи с параметрами', 'Доказательства', 'Комбинаторика'] },
      ],
    },
  },
  {
    name: 'Артём Соколов',
    subject: 'Математика',
    goal: 'ОГЭ на 5',
    grade: '9 класс',
    price_per_lesson: 1500,
    balance: 5500,
    progress: 70,
    lessons_completed: 18,
    curriculum_topic: 'Квадратные уравнения',
    has_program: true,
    comment: 'Аккуратный, дисциплинированный. ОГЭ — формальность, готовим к профильному классу.',
    parent_contact: '+7 (922) 343-21-09',
    birthday: '2010-06-30',
    average_rating: 5,
    questionnaire: {
      favorite_topics: ['Алгебра', 'Уравнения и неравенства'],
      weak_topics: ['Геометрия — доказательства', 'Стереометрия'],
      learning_style: 'Системный — хочет понять правило перед применением',
      motivation: 'Поступление в физмат-класс лицея №1',
      study_hours_per_week: 5,
      exam_target_score: 25,
      notes: 'Цель ОГЭ — 5, но реальная цель — подготовка к профилю в 10-11 классах',
    },
    program_data: {
      title: 'Подготовка к ОГЭ + база для физмат-класса',
      total_weeks: 20,
      current_week: 12,
      modules: [
        { name: 'Алгебра ОГЭ', progress: 80, topics: ['Действия с числами', 'Уравнения', 'Функции', 'Неравенства'] },
        { name: 'Геометрия ОГЭ', progress: 55, topics: ['Треугольники', 'Окружность', 'Квадрилатерали', 'Вычисление площадей'] },
        { name: 'База для профиля', progress: 35, topics: ['Квадратные уравнения с параметром', 'Степени и корни', 'Логарифмы (введение)'] },
      ],
    },
  },
  {
    name: 'Полина Васильева',
    subject: 'Физика',
    goal: 'ОГЭ физика',
    grade: '9 класс',
    price_per_lesson: 1500,
    balance: 2000,
    progress: 60,
    lessons_completed: 14,
    curriculum_topic: 'Электрические явления',
    has_program: false,
    comment: 'Стесняется задавать вопросы, нужно вытягивать. Хорошая база.',
    parent_contact: '+7 (902) 988-77-65',
    birthday: '2010-09-12',
    average_rating: 4,
    questionnaire: {
      favorite_topics: ['Механика — простые машины', 'Оптика'],
      weak_topics: ['Электричество', 'Расчётные задачи', 'Уравнения', 'Тепловые явления'],
      learning_style: 'Тихий, нужно много поощрения и вопросов в обратную сторону',
      motivation: 'Сдать ОГЭ без стресса, средний балл',
      study_hours_per_week: 2,
      exam_target_score: 22,
    },
    program_data: null,
  },
  {
    name: 'Михаил Кузнецов',
    subject: 'Математика',
    goal: 'Олимпиадная подготовка',
    grade: '10 класс',
    price_per_lesson: 2500,
    balance: 18000,
    progress: 88,
    lessons_completed: 42,
    curriculum_topic: 'Теория чисел',
    has_program: true,
    comment: 'Призёр городской олимпиады. Готовим к региону. Решает быстрее меня.',
    parent_contact: '+7 (912) 200-15-83',
    birthday: '2009-11-05',
    average_rating: 5,
    questionnaire: {
      favorite_topics: ['Теория чисел', 'Алгебраические неравенства', 'Геометрия (синтетическая)'],
      weak_topics: ['Комбинаторика — сложные схемы подсчёта', 'Теория вероятностей олимпиадная'],
      learning_style: 'Исследовательский — любит самостоятельно находить путь решения',
      motivation: 'Победа на Всероссийской олимпиаде, поступление в ЦПМ или МФТИ',
      study_hours_per_week: 15,
      olympiad_level: 'Призёр городского этапа Всерос, призёр Турнира городов',
      next_target: 'Региональный этап Всерос 2025-26',
    },
    program_data: {
      title: 'Олимпиадная математика — региональный уровень',
      total_weeks: 40,
      current_week: 28,
      modules: [
        { name: 'Алгебра и неравенства', progress: 90, topics: ['Алгебраические тождества', 'Неравенства AM-GM', 'Полиномы', 'Функциональные уравнения'] },
        { name: 'Геометрия', progress: 80, topics: ['Подобие и гомотетия', 'Инверсия', 'Проективная геометрия', 'Вписанные и описанные фигуры'] },
        { name: 'Теория чисел', progress: 75, topics: ['Делимость', 'НОД/НОК', 'Сравнения по модулю', 'Диофантовы уравнения'] },
        { name: 'Комбинаторика', progress: 55, topics: ['Принцип Дирихле', 'Метод инвариантов', 'Экстремальный принцип', 'Рекуррентные соотношения'] },
      ],
    },
  },
  {
    name: 'Дарья Иванова',
    subject: 'Информатика',
    goal: 'ЕГЭ информатика 85+',
    grade: '11 класс',
    price_per_lesson: 1800,
    balance: 6000,
    progress: 75,
    lessons_completed: 26,
    curriculum_topic: 'Динамическое программирование',
    has_program: true,
    comment: 'Сильный программист, но боится теории графов. Работаем над уверенностью.',
    parent_contact: '+7 (982) 411-23-56',
    birthday: '2008-03-25',
    average_rating: 5,
    questionnaire: {
      favorite_topics: ['Python', 'Алгоритмы сортировки', 'Строки', 'Файловый ввод-вывод'],
      weak_topics: ['Теория графов', 'Динамическое программирование', 'Системы счисления (сложные)'],
      learning_style: 'Практический — через написание кода, а не теорию',
      motivation: 'Поступление на ПМИ ВШЭ или Прикладная математика МФТИ',
      study_hours_per_week: 7,
      programming_languages: ['Python', 'немного C++'],
      exam_target_score: 85,
    },
    program_data: {
      title: 'Подготовка к ЕГЭ Информатика 2026',
      total_weeks: 30,
      current_week: 19,
      modules: [
        { name: 'Теория и системы счисления', progress: 85, topics: ['Системы счисления', 'Логика и схемы', 'Кодирование информации', 'Алфавитный подход'] },
        { name: 'Алгоритмизация и Python', progress: 80, topics: ['Типы данных', 'Условия и циклы', 'Функции', 'Рекурсия', 'Строки и списки'] },
        { name: 'Сложные алгоритмы', progress: 55, topics: ['Сортировки', 'Поиск', 'Жадные алгоритмы', 'Динамическое программирование'] },
        { name: 'Теория графов', progress: 40, topics: ['Обходы (BFS/DFS)', 'Кратчайшие пути', 'Деревья'] },
      ],
    },
  },
  {
    name: 'Никита Петров',
    subject: 'Математика',
    goal: 'Подтянуть школьную программу',
    grade: '8 класс',
    price_per_lesson: 1500,
    balance: 1500,
    progress: 50,
    lessons_completed: 12,
    curriculum_topic: 'Дроби и пропорции',
    has_program: false,
    comment: 'Начинали с двойки, сейчас четвёрка. Родители благодарят. Не любит формулы.',
    parent_contact: '+7 (902) 777-12-34',
    birthday: '2011-01-08',
    average_rating: 4,
    questionnaire: {
      favorite_topics: ['Устный счёт', 'Задачи про деньги и покупки'],
      weak_topics: ['Дроби', 'Буквенные выражения', 'Уравнения', 'Задачи на движение'],
      learning_style: 'Через жизненные примеры — абстракция плохо заходит',
      motivation: 'Мама хочет стабильную четвёрку',
      study_hours_per_week: 2,
      initial_level: 'Двойка по математике в начале года',
      current_level: 'Устойчивая четвёрка, есть пятёрки за контрольные',
    },
    program_data: null,
  },
  {
    name: 'Виктория Смирнова',
    subject: 'Математика',
    goal: 'Школьная программа отлично',
    grade: '10 класс',
    price_per_lesson: 1600,
    balance: 4000,
    progress: 68,
    lessons_completed: 16,
    curriculum_topic: 'Тригонометрия',
    has_program: false,
    comment: 'Стабильная отличница. Готовимся системно к ЕГЭ через год.',
    parent_contact: '+7 (912) 100-50-25',
    birthday: '2009-05-14',
    average_rating: 5,
    questionnaire: {
      favorite_topics: ['Алгебра', 'Геометрия', 'Всё, что можно разложить по шагам'],
      weak_topics: ['Тригонометрия — формулы приведения', 'Задачи на доказательство'],
      learning_style: 'Структурный — нужен чёткий алгоритм действий',
      motivation: 'Сохранить пятёрку и подготовиться к ЕГЭ профиль заранее',
      study_hours_per_week: 4,
      school_average: 'Отлично по всем предметам',
    },
    program_data: null,
  },
  {
    name: 'Даниил Захаров',
    subject: 'Математика',
    goal: 'ЕГЭ база на 5',
    grade: '11 класс',
    price_per_lesson: 1500,
    balance: -1500,
    progress: 55,
    lessons_completed: 11,
    curriculum_topic: 'Логарифмы',
    has_program: false,
    comment: 'Гуманитарий, идёт на иняз. Нужна база для аттестата. Долг — родители обещали закрыть.',
    parent_contact: '+7 (982) 654-32-10',
    birthday: '2008-07-18',
    average_rating: 4,
    questionnaire: {
      favorite_topics: ['Проценты', 'Задачи с графиками', 'Простые уравнения'],
      weak_topics: ['Логарифмы', 'Тригонометрия', 'Производная', 'Геометрия'],
      learning_style: 'Нужно минимум теории, максимум типовых задач с шаблонным решением',
      motivation: 'Сдать ЕГЭ базу на 5, поступить на лингвистику',
      study_hours_per_week: 2,
      exam_target_score: 5,
      note: 'Только ЕГЭ база, профиль не нужен',
    },
    program_data: null,
  },
  {
    name: 'Анна Орехова',
    subject: 'Физика',
    goal: 'Олимпиадная физика',
    grade: '9 класс',
    price_per_lesson: 2200,
    balance: 3500,
    progress: 72,
    lessons_completed: 20,
    curriculum_topic: 'Электростатика',
    has_program: true,
    comment: 'Призёр школьной олимпиады, готовим к региональной. Мечтает в ИТМО.',
    parent_contact: '+7 (912) 888-99-00',
    birthday: '2010-12-03',
    average_rating: 5,
    questionnaire: {
      favorite_topics: ['Механика', 'Оптика', 'Экспериментальные задачи'],
      weak_topics: ['Электростатика', 'Магнетизм', 'Квантовая физика (введение)'],
      learning_style: 'Через физический смысл — не терпит формул без понимания',
      motivation: 'Победа на региональном этапе Всерос по физике, поступление в ИТМО',
      study_hours_per_week: 8,
      olympiad_level: 'Призёр школьного и муниципального этапа',
      next_target: 'Региональный этап Всерос 2025-26',
    },
    program_data: {
      title: 'Олимпиадная физика — региональный уровень',
      total_weeks: 35,
      current_week: 18,
      modules: [
        { name: 'Механика', progress: 90, topics: ['Кинематика', 'Динамика', 'Статика', 'Законы сохранения', 'Колебания'] },
        { name: 'Молекулярная физика и термодинамика', progress: 65, topics: ['МКТ', 'Газовые законы', 'Первое начало термодинамики', 'Тепловые машины'] },
        { name: 'Электродинамика', progress: 45, topics: ['Электростатика', 'Постоянный ток', 'Магнетизм', 'ЭМИ'] },
        { name: 'Оптика и квантовая физика', progress: 30, topics: ['Геометрическая оптика', 'Волновая оптика', 'Фотоэффект'] },
      ],
    },
  },
  {
    name: 'Глеб Тимофеев',
    subject: 'Математика',
    goal: 'Переход в физмат-класс',
    grade: '10 класс',
    price_per_lesson: 1700,
    balance: 5000,
    progress: 65,
    lessons_completed: 15,
    curriculum_topic: 'Векторы и координаты',
    has_program: true,
    comment: 'Переходит в физмат-класс лицея, нужна крепкая база. Старается, но иногда лениво.',
    parent_contact: '+7 (982) 222-33-44',
    birthday: '2009-10-20',
    average_rating: 5,
    questionnaire: {
      favorite_topics: ['Алгебра', 'Задачи на логику', 'Задачи с числами'],
      weak_topics: ['Геометрия', 'Тригонометрия', 'Доказательства', 'Логарифмы'],
      learning_style: 'Нужна мотивация и объяснение «зачем это нужно»',
      motivation: 'Поступить в физмат-класс лицея №2, потом мехмат',
      study_hours_per_week: 5,
      current_school: 'Обычная общеобразовательная школа',
      target_school: 'Физмат-класс лицея №2',
    },
    program_data: {
      title: 'Крепкая база для физмат-класса',
      total_weeks: 24,
      current_week: 14,
      modules: [
        { name: 'Алгебра 10 класса', progress: 70, topics: ['Степени и корни', 'Логарифмы', 'Тригонометрия — основы', 'Квадратные неравенства'] },
        { name: 'Геометрия 10 класса', progress: 55, topics: ['Векторы', 'Координатный метод', 'Прямые и плоскости в пространстве'] },
        { name: 'Введение в анализ', progress: 25, topics: ['Понятие предела', 'Производная', 'Простейшие задачи на экстремум'] },
      ],
    },
  },
];

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.time('step-02');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ШАГ 2 — создание учеников');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Найти demo-репетитора
  const { data: tutor, error: tutorErr } = await supabase
    .from(`${PFX}tutors`)
    .select('id, name')
    .eq('email', DEMO_EMAIL)
    .single();

  if (tutorErr || !tutor) {
    console.error('❌ demo@vector.ru не найден:', tutorErr?.message);
    process.exit(1);
  }

  const TID: string = tutor.id;
  console.log(`✅ Репетитор: ${tutor.name} (${TID})\n`);

  // 2. Убедиться что учеников нет (ожидаем 0 после cleanup)
  const { count: existing } = await supabase
    .from(`${PFX}students`)
    .select('*', { count: 'exact', head: true })
    .eq('tutor_id', TID);

  if (existing && existing > 0) {
    console.warn(`⚠️  Найдено ${existing} существующих учеников — удаляем перед вставкой`);
    await supabase.from(`${PFX}students`).delete().eq('tutor_id', TID);
  }

  // 3. Подготовить строки для вставки
  const rows = STUDENTS.map(s => ({
    tutor_id: TID,
    name: s.name,
    subject: s.subject,
    goal: s.goal,
    grade: s.grade,
    price_per_lesson: s.price_per_lesson,
    balance: s.balance,
    progress: s.progress,
    lessons_completed: s.lessons_completed,
    curriculum_topic: s.curriculum_topic,
    has_program: s.has_program,
    comment: s.comment,
    parent_contact: s.parent_contact,
    birthday: s.birthday,
    average_rating: s.average_rating,
    is_active: true,
    questionnaire: s.questionnaire,
    program_data: s.program_data,
    links: {},
  }));

  // 4. Вставить всех одним запросом
  console.log(`📥 Вставляем ${rows.length} учеников...`);
  const { data: inserted, error: insertErr } = await supabase
    .from(`${PFX}students`)
    .insert(rows)
    .select('id, name, subject, grade, balance, progress, average_rating, has_program');

  if (insertErr || !inserted) {
    console.error('❌ Ошибка вставки:', insertErr?.message);
    process.exit(1);
  }

  // 5. Лог каждого ученика
  console.log('\n📋 Созданные ученики:');
  for (const s of inserted as any[]) {
    const prog = `[${s.has_program ? '📘 прог' : '     '}]`;
    console.log(`  ${prog} ${s.name.padEnd(20)} ${s.grade.padEnd(10)} ${s.subject.padEnd(14)} баланс: ${String(s.balance).padStart(7)} | прогресс: ${s.progress}%`);
  }

  // 6. COUNT подтверждение
  const { count: finalCount } = await supabase
    .from(`${PFX}students`)
    .select('*', { count: 'exact', head: true })
    .eq('tutor_id', TID);

  console.log(`\n✅ Итого учеников: ${finalCount}`);

  // 7. Вывести Алёну Морозову полностью
  console.log('\n🔍 Детали — Алёна Морозова:');
  const { data: alena } = await supabase
    .from(`${PFX}students`)
    .select('*')
    .eq('tutor_id', TID)
    .eq('name', 'Алёна Морозова')
    .single();

  if (alena) {
    const display = { ...alena };
    // вывести читаемо
    console.log(`  id:               ${display.id}`);
    console.log(`  name:             ${display.name}`);
    console.log(`  grade:            ${display.grade}`);
    console.log(`  subject:          ${display.subject}`);
    console.log(`  goal:             ${display.goal}`);
    console.log(`  price_per_lesson: ${display.price_per_lesson} ₽`);
    console.log(`  balance:          ${display.balance} ₽`);
    console.log(`  progress:         ${display.progress}%`);
    console.log(`  lessons_completed:${display.lessons_completed}`);
    console.log(`  curriculum_topic: ${display.curriculum_topic}`);
    console.log(`  average_rating:   ${display.average_rating}`);
    console.log(`  has_program:      ${display.has_program}`);
    console.log(`  comment:          ${display.comment}`);
    console.log(`  parent_contact:   ${display.parent_contact}`);
    console.log(`  birthday:         ${display.birthday}`);
    console.log(`  questionnaire:    ${JSON.stringify(display.questionnaire, null, 4).replace(/\n/g, '\n                    ')}`);
    console.log(`  program_data:     ${JSON.stringify(display.program_data, null, 4).replace(/\n/g, '\n                    ')}`);
  }

  console.log('\n');
  console.timeEnd('step-02');
  console.log('\n🎉 Шаг 2 готов. Жду ОК перед шагом 3 (занятия).');
}

main().catch(err => {
  console.error('\n💥 Критическая ошибка:', err);
  process.exit(1);
});
