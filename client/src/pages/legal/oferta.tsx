import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";

export default function OfertaPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Публичная оферта</h1>
            <p className="text-sm text-muted-foreground">Редакция от 1 января 2025 г.</p>
          </div>
        </div>

        <div className="space-y-6 text-foreground">

          <section>
            <h2 className="text-lg font-semibold mb-2">1. Общие положения</h2>
            <p className="text-muted-foreground leading-relaxed">
              Настоящий документ является публичной офертой физического лица, применяющего специальный
              налоговый режим «Налог на профессиональный доход» (далее — «Исполнитель», «Самозанятый»), и
              содержит все существенные условия договора об оказании услуг доступа к цифровой платформе
              «Твой Вектор» (далее — «Сервис», «Платформа»). Документ подготовлен в соответствии с п. 2
              ст. 437 Гражданского кодекса РФ.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Акцептом настоящей оферты является регистрация на Платформе и/или оплата любого тарифного
              плана. С момента акцепта пользователь (далее — «Заказчик») считается заключившим договор
              с Исполнителем на условиях настоящей оферты (п. 3 ст. 438 ГК РФ).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Сведения об Исполнителе</h2>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-44 shrink-0">Статус:</span>
                <span>Самозанятый (плательщик НПД)</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-44 shrink-0">ФИО:</span>
                <span>Горбацевич Максим Денисович</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-44 shrink-0">ИНН:</span>
                <span>590612402300</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-44 shrink-0">Email:</span>
                <span>support@tvoyvector.ru</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Исполнитель применяет специальный налоговый режим «Налог на профессиональный доход» (НПД)
              в соответствии с Федеральным законом № 422-ФЗ от 27.11.2018. Не является плательщиком НДС.
              Чеки формируются через приложение «Мой налог».
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Предмет договора</h2>
            <p className="text-muted-foreground leading-relaxed">
              Исполнитель предоставляет Заказчику возмездный доступ к облачной платформе «Твой Вектор» —
              программному обеспечению для управления репетиторской деятельностью. Функциональность включает:
              ведение расписания занятий, учёт оплат, управление профилями учеников, инструменты на базе
              искусственного интеллекта для помощи в обучении, личный кабинет ученика, видеоконференции
              и прочие модули Платформы.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Услуга считается оказанной с момента предоставления Заказчику доступа к оплаченному тарифному
              плану. Доступ предоставляется через сеть Интернет (SaaS-модель).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Тарифные планы и стоимость услуг</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Доступ к функциям Платформы предоставляется в соответствии с выбранным тарифным планом.
              Все цены указаны в рублях РФ и включают применимые налоги (НДС не предусмотрен — Исполнитель
              применяет режим НПД):
            </p>
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-left py-2.5 px-4 font-semibold">Тариф</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Помесячно</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Годовая оплата</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/30">
                    <td className="py-2.5 px-4">«Старт» (Free) — базовый</td>
                    <td className="py-2.5 px-4">Бесплатно</td>
                    <td className="py-2.5 px-4">Бесплатно</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2.5 px-4">«Базовый» (Pro)</td>
                    <td className="py-2.5 px-4">790 ₽/мес.</td>
                    <td className="py-2.5 px-4">7 584 ₽/год (−20%)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">«Расширенный» (Premium)</td>
                    <td className="py-2.5 px-4">1 490 ₽/мес.</td>
                    <td className="py-2.5 px-4">14 304 ₽/год (−20%)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Дополнительные разовые услуги: пакеты запросов к ИИ (от 99 ₽ за пакет),
              дополнительные слоты учеников (от 49 ₽/мес. за слот). Актуальные цены
              всегда отображаются на странице тарифов в личном кабинете.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Порядок оплаты и чеки</h2>
            <p className="text-muted-foreground leading-relaxed">
              Оплата производится в рублях РФ посредством платёжного сервиса ЮKassa
              (АО «Национальная платёжная корпорация»). Принимаются банковские карты МИР, Visa,
              Mastercard, а также иные способы, доступные в ЮKassa. Исполнитель не хранит данные
              банковских карт Заказчика — они обрабатываются непосредственно ЮKassa по протоколу HTTPS.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Доступ к тарифному плану активируется сразу после подтверждения платежа от ЮKassa.
              При оплате за год сумма списывается единовременно, доступ предоставляется на 12 месяцев.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              В соответствии с ч. 2.2 ст. 2 Федерального закона № 54-ФЗ Исполнитель как самозанятый
              освобождён от применения контрольно-кассовой техники. Кассовый чек (чек самозанятого)
              формируется Исполнителем через приложение «Мой налог» и направляется Заказчику по
              запросу на электронную почту.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Отмена подписки</h2>
            <p className="text-muted-foreground leading-relaxed">
              Подписка <strong>не продлевается автоматически</strong>. По истечении оплаченного периода
              тариф автоматически переходит в бесплатный («Старт»), данные сохраняются в полном объёме.
              Для продолжения пользования платными функциями необходимо самостоятельно произвести
              новую оплату.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Заказчик вправе в любой момент отменить платную подписку через раздел «Тарифы» в личном
              кабинете (кнопка «Отменить подписку»). После отмены доступ к платным функциям сохраняется
              до конца оплаченного периода — без возврата средств за неиспользованный остаток,
              если не применяется пункт 7 настоящей оферты.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Возврат денежных средств</h2>
            <p className="text-muted-foreground leading-relaxed">
              Заказчик вправе запросить полный возврат уплаченных средств в течение{" "}
              <strong>14 календарных дней</strong> с даты оплаты при соблюдении следующих условий:
            </p>
            <ul className="text-muted-foreground text-sm list-disc list-inside mt-2 space-y-1">
              <li>Заказчик использовал платные функции Платформы менее 3 раз с момента оплаты</li>
              <li>Заказчик не скачивал и не экспортировал данные (отчёты, аналитику)</li>
              <li>Заявка направлена на support@tvoy-vector.ru с указанием даты платежа и причины</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Возврат осуществляется на ту же банковскую карту, с которой производился платёж,
              в течение 10 рабочих дней. Пакеты ИИ-запросов и дополнительные слоты учеников
              возврату не подлежат после их частичного использования.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Поскольку оказываемые услуги являются цифровыми (доступ к программному обеспечению через
              интернет), они могут не подпадать под стандартные нормы Закона о защите прав потребителей
              о возврате товаров. Исполнитель добровольно устанавливает изложенный выше порядок возврата.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Права и обязанности сторон</h2>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Исполнитель обязуется:</strong> обеспечивать работоспособность Платформы не менее
              99% времени в месяц (кроме плановых технических работ), уведомлять об изменении цен
              тарифов не менее чем за 14 дней, хранить данные Заказчика согласно политике
              конфиденциальности, формировать чек самозанятого по запросу Заказчика.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              <strong>Заказчик обязуется:</strong> предоставлять достоверные данные при регистрации,
              самостоятельно обеспечивать безопасность учётных данных, не использовать Платформу для
              незаконной деятельности или передачи третьим лицам без согласия Исполнителя.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Ограничение ответственности</h2>
            <p className="text-muted-foreground leading-relaxed">
              Исполнитель не несёт ответственности за убытки, возникшие вследствие ненадлежащего
              использования Платформы Заказчиком, действий третьих лиц или обстоятельств непреодолимой
              силы (форс-мажор). Совокупная ответственность Исполнителя ограничена суммой платежей,
              фактически уплаченных Заказчиком за последние 3 (три) календарных месяца.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Изменение условий оферты</h2>
            <p className="text-muted-foreground leading-relaxed">
              Исполнитель вправе вносить изменения в настоящую оферту. Об изменениях, затрагивающих
              стоимость услуг или существенные условия договора, Заказчик уведомляется по электронной
              почте не позднее чем за 14 дней до их вступления в силу. Продолжение использования
              Платформы после этой даты означает согласие с новой редакцией оферты.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Применимое право</h2>
            <p className="text-muted-foreground leading-relaxed">
              Настоящая оферта регулируется законодательством Российской Федерации. Споры разрешаются
              путём переговоров; при недостижении согласия — в суде общей юрисдикции по месту
              регистрации Исполнителя.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">12. Контактная информация</h2>
            <p className="text-muted-foreground leading-relaxed">
              По вопросам оферты, возвратов, чеков и отмены подписки:{" "}
              <strong>support@tvoy-vector.ru</strong>
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-border/40 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
            Политика конфиденциальности
          </Link>
          <Link href="/subscription" className="hover:text-foreground transition-colors">
            Управление подпиской
          </Link>
        </div>
      </div>
    </div>
  );
}
