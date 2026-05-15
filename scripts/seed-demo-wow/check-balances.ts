import * as dotenv from 'dotenv'; dotenv.config();
import { supabase } from '../../server/supabase';
const PFX = 'Tvoy_vector_2_';

async function main() {
  const { data: tutor } = await supabase.from(`${PFX}tutors`).select('id').eq('email','demo@vector.ru').single();
  const tid = tutor!.id;

  // Откуда лишние payments?
  const { data: allPays } = await supabase.from(`${PFX}payments`).select('id,created_at,yookassa_payment_id').eq('tutor_id',tid).order('created_at',{ascending:false});
  const yooCount = (allPays ?? []).filter(p => p.yookassa_payment_id).length;
  const manualCount = (allPays ?? []).filter(p => !p.yookassa_payment_id).length;
  console.log(`\nПлатежей всего: ${allPays?.length} (ручных: ${manualCount}, yookassa: ${yooCount})`);

  // Эффективный баланс = SUM(payments) - COUNT(completed/attended уроков) * price_per_lesson
  const targets = ['Михаил Кузнецов', 'Даниил Захаров', 'Артём Соколов'];
  const expected: Record<string,number> = {
    'Михаил Кузнецов': 15000, 'Даниил Захаров': -25000, 'Артём Соколов': 0,
  };

  console.log('\nЭффективные балансы:');
  for (const name of targets) {
    const { data: s } = await supabase.from(`${PFX}students`).select('id,price_per_lesson').eq('tutor_id',tid).eq('name',name).single();
    const sid = s!.id;
    const ppl = s!.price_per_lesson;

    const { data: pays } = await supabase.from(`${PFX}payments`).select('amount').eq('tutor_id',tid).eq('student_id',sid);
    const totalPaid = (pays ?? []).reduce((a,p) => a + (p.amount ?? 0), 0);

    const { count: lessonCount } = await supabase.from(`${PFX}lessons`)
      .select('*',{count:'exact',head:true})
      .eq('tutor_id',tid).eq('student_id',sid)
      .in('status',['completed','attended']);

    const totalCost = (lessonCount ?? 0) * ppl;
    const eff = totalPaid - totalCost;
    const exp = expected[name];
    const ok = Math.abs(eff - exp) < 100 ? '✅' : `❌ (ожид. ${exp > 0 ? '+' : ''}${exp.toLocaleString('ru')})`;
    console.log(`  ${name.padEnd(22)} оплач: ${totalPaid.toLocaleString('ru')}₽  уроков: ${lessonCount}×${ppl}₽=${totalCost.toLocaleString('ru')}₽  баланс: ${eff>=0?'+':''}${eff.toLocaleString('ru')}₽  ${ok}`);
  }
}
main().catch(e=>{console.error(e);process.exit(1);});
