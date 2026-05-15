// scripts/seed-demo-wow/04-payments.ts
// Шаг 4: платежи для всех 12 учеников demo-репетитора
// Запуск: npx tsx scripts/seed-demo-wow/04-payments.ts

import * as dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../../server/supabase';

const PFX = 'Tvoy_vector_2_';
const DEMO_EMAIL = 'demo@vector.ru';

const START = new Date('2025-11-01T08:00:00.000Z');
const END   = new Date('2026-05-14T18:00:00.000Z');

const TARGET_BALANCE: Record<string, number> = {
  'Михаил Кузнецов':  15000,
  'Софья Лебедева':   12000,
  'Анна Орехова':      8000,
  'Алёна Морозова':    5000,
  'Дарья Иванова':     3000,
  'Артём Соколов':        0,
  'Виктория Смирнова': 2000,
  'Глеб Тимофеев':     1500,
  'Полина Васильева': -2000,
  'Никита Петров':    -1500,
  'Кирилл Орлов':    -8000,
  'Даниил Захаров':  -25000,
};

// 40% перевод, 30% СБП, 20% карта, 10% наличные
const METHOD_POOL = [
  'перевод','перевод','перевод','перевод',
  'СБП','СБП','СБП',
  'карта','карта',
  'наличные',
];

const COMMENTS: Record<string, string[]> = {
  'перевод':   ['Перевод за занятия', 'Оплата репетитора', 'За уроки', 'Перевод от родителей', 'Оплата занятий'],
  'СБП':       ['Оплата через СБП', 'СБП за занятия', 'Быстрый перевод за уроки', 'СБП от родителей'],
  'карта':     ['Оплата картой', 'Картой за занятия', 'По карте за уроки'],
  'наличные':  ['Наличными на занятии', 'Наличными от родителей', 'Наличные за занятия'],
};

function pickMethod(): string {
  return METHOD_POOL[Math.floor(Math.random() * METHOD_POOL.length)];
}

function randomDate(): Date {
  return new Date(START.getTime() + Math.random() * (END.getTime() - START.getTime()));
}

// Генерируем суммы кратные 1500 (выглядит реалистично: 4500, 9000, 13500, 18000…)
function generateAmounts(total: number, count: number): number[] {
  if (total <= 0 || count <= 0) return [];

  const unit = 1500;
  const units = Math.round(total / unit);

  if (units <= 0) return [total];

  // Разбиваем на count частей методом случайных разрезов
  const cuts: number[] = [];
  for (let i = 0; i < count - 1; i++) cuts.push(Math.random());
  cuts.sort((a, b) => a - b);

  const fracs = cuts.map((c, i) => c - (i > 0 ? cuts[i - 1] : 0));
  fracs.push(1 - cuts[cuts.length - 1]);

  const rawAmounts = fracs.map(f => Math.max(1, Math.round(f * units)));

  // Корректируем сумму до units
  let diff = units - rawAmounts.reduce((s, v) => s + v, 0);
  for (let i = 0; Math.abs(diff) > 0; i = (i + 1) % rawAmounts.length) {
    const adj = diff > 0 ? 1 : -1;
    if (rawAmounts[i] + adj > 0) { rawAmounts[i] += adj; diff -= adj; }
  }

  // Переводим обратно в рубли (unit * кол-во единиц) + остаток на последнем элементе
  const amounts = rawAmounts.map(u => u * unit);
  // Добавляем остаток от округления (total не всегда кратно unit)
  amounts[amounts.length - 1] += total - amounts.reduce((s, v) => s + v, 0);
  return amounts.filter(a => a > 0);
}

async function main() {
  console.time('step-04');
  console.log('💳 Шаг 4: генерация платежей\n');

  // Туторский ID
  const { data: tutor } = await supabase
    .from(`${PFX}tutors`).select('id').eq('email', DEMO_EMAIL).single();
  if (!tutor) throw new Error('Demo tutor not found');
  const TID = tutor.id;

  // Все ученики
  const { data: students, error: se } = await supabase
    .from(`${PFX}students`)
    .select('id, name, price_per_lesson')
    .eq('tutor_id', TID);
  if (se || !students?.length) throw new Error('Ученики не найдены: ' + se?.message);

  // Все занятия (только нужные колонки)
  const { data: lessons, error: le } = await supabase
    .from(`${PFX}lessons`)
    .select('student_id, status, attendance, duration_minutes')
    .eq('tutor_id', TID);
  if (le) throw new Error('Занятия не найдены: ' + le.message);

  let totalPaymentsCount = 0;
  let totalPaymentsSum = 0;

  const summaryLines: string[] = [];

  for (const student of students) {
    const targetBalance = TARGET_BALANCE[student.name];
    if (targetBalance === undefined) {
      console.warn(`  ⚠️  ${student.name} — нет в TARGET_BALANCE, пропускаем`);
      continue;
    }

    // Биллируемые занятия: completed с любым из [attended, missed_paid] ИЛИ cancelled + missed_paid
    const billable = (lessons ?? []).filter(l =>
      l.student_id === student.id && (
        (l.status === 'completed' && ['attended', 'attended_unpaid', 'missed_paid'].includes(l.attendance ?? '')) ||
        (l.status === 'cancelled' && l.attendance === 'missed_paid')
      )
    );

    const totalCost = billable.reduce((sum, l) =>
      sum + Math.round(student.price_per_lesson * l.duration_minutes / 60), 0);

    const totalToPay = totalCost + targetBalance;

    // Сколько платежей: 8–15
    const count = Math.floor(Math.random() * 8) + 8;

    let payments: any[] = [];

    if (totalToPay > 0) {
      const amounts = generateAmounts(totalToPay, count);
      const dates = amounts.map(() => randomDate()).sort((a, b) => a.getTime() - b.getTime());

      payments = amounts.map((amount, i) => {
        const method = pickMethod();
        const pool = COMMENTS[method];
        const comment = pool[Math.floor(Math.random() * pool.length)];
        return {
          tutor_id: TID,
          student_id: student.id,
          amount,
          method,
          comment,
          created_at: dates[i].toISOString(),
        };
      });

      const { error } = await supabase.from(`${PFX}payments`).insert(payments);
      if (error) {
        console.error(`  ❌ ${student.name}: ${error.message}`);
        continue;
      }
    }

    // Обновляем balance в students (синхронизируем с логикой routes.ts)
    const { error: ue } = await supabase
      .from(`${PFX}students`)
      .update({ balance: targetBalance })
      .eq('id', student.id);
    if (ue) console.warn(`  ⚠️  Не удалось обновить balance у ${student.name}: ${ue.message}`);

    totalPaymentsCount += payments.length;
    totalPaymentsSum += payments.reduce((s, p) => s + p.amount, 0);

    const balStr = targetBalance >= 0 ? `+${targetBalance.toLocaleString('ru-RU')}` : targetBalance.toLocaleString('ru-RU');
    summaryLines.push(
      `  ${student.name.padEnd(22)} ` +
      `${String(payments.length).padStart(2)} пл.  ` +
      `стоим.${totalCost.toLocaleString('ru-RU').padStart(8)}₽  ` +
      `оплач.${(totalToPay > 0 ? totalToPay : 0).toLocaleString('ru-RU').padStart(8)}₽  ` +
      `баланс: ${balStr}₽`
    );
  }

  console.log('📊 ИТОГИ ПО УЧЕНИКАМ:');
  for (const l of summaryLines) console.log(l);
  console.log('\n' + '─'.repeat(70));
  console.log(`  Всего платежей:  ${totalPaymentsCount}`);
  console.log(`  Общая сумма:     ${totalPaymentsSum.toLocaleString('ru-RU')} ₽`);
  console.log();
  console.timeEnd('step-04');
  console.log('\n🎉 Шаг 4 готов. Переходим к шагу 5 (AI-чаты).');
}

main().catch(err => {
  console.error('\n💥 Критическая ошибка:', err);
  process.exit(1);
});
