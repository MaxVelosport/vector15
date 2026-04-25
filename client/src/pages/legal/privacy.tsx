import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Политика конфиденциальности</h1>
            <p className="text-sm text-muted-foreground">Редакция от 1 января 2025 г.</p>
          </div>
        </div>

        <div className="space-y-6 text-foreground">

          <section>
            <h2 className="text-lg font-semibold mb-2">1. Общие положения</h2>
            <p className="text-muted-foreground leading-relaxed">
              Настоящая политика конфиденциальности (далее — «Политика») описывает, какие персональные
              данные собирает, хранит и обрабатывает физическое лицо, применяющее специальный налоговый
              режим «Налог на профессиональный доход» (самозанятый), как оператор платформы «Твой Вектор»
              (далее — «Оператор», «Платформа»). Политика разработана в соответствии с Федеральным
              законом № 152-ФЗ «О персональных данных».
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Используя Платформу, вы выражаете согласие на обработку персональных данных на условиях,
              описанных в настоящей Политике.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Оператор персональных данных</h2>
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
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Какие данные мы собираем</h2>
            <div className="space-y-3">
              <div className="rounded-lg border border-border/40 p-3">
                <p className="font-medium text-sm mb-1">При регистрации репетитора</p>
                <p className="text-xs text-muted-foreground">Имя (или псевдоним), адрес электронной почты, пароль (хранится только в виде хэша), предметы преподавания, часовой пояс.</p>
              </div>
              <div className="rounded-lg border border-border/40 p-3">
                <p className="font-medium text-sm mb-1">Данные об учениках (вносятся репетитором)</p>
                <p className="text-xs text-muted-foreground">Имя ученика, предмет, класс, контактные данные — исключительно по усмотрению репетитора. Ученики не являются пользователями Платформы самостоятельно и не проходят отдельной регистрации.</p>
              </div>
              <div className="rounded-lg border border-border/40 p-3">
                <p className="font-medium text-sm mb-1">Платёжные данные</p>
                <p className="text-xs text-muted-foreground">Мы <strong>не храним</strong> данные банковских карт. Платёжные операции полностью обрабатываются сервисом ЮKassa. Нам передаётся только факт и сумма успешного платежа. Для выдачи чека самозанятого по запросу может потребоваться электронная почта.</p>
              </div>
              <div className="rounded-lg border border-border/40 p-3">
                <p className="font-medium text-sm mb-1">Технические данные сессии</p>
                <p className="text-xs text-muted-foreground">IP-адрес, тип браузера, операционная система, время входа — собираются автоматически для обеспечения безопасности и корректной работы сессий авторизации.</p>
              </div>
              <div className="rounded-lg border border-border/40 p-3">
                <p className="font-medium text-sm mb-1">Файлы cookie</p>
                <p className="text-xs text-muted-foreground">Используются только технически необходимые cookie для поддержания сессии авторизованного пользователя. Рекламные и аналитические cookie не применяются.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Цели обработки данных</h2>
            <ul className="text-muted-foreground space-y-1.5 text-sm list-disc list-inside">
              <li>Обеспечение доступа к функциям Платформы и идентификация пользователя</li>
              <li>Исполнение договора об оказании услуг (публичной оферты)</li>
              <li>Обработка и подтверждение платежей</li>
              <li>Формирование чека самозанятого через приложение «Мой налог» (по запросу)</li>
              <li>Техническая поддержка и ответы на обращения пользователей</li>
              <li>Уведомления об изменениях в работе Платформы и условиях подписки</li>
              <li>Предотвращение мошеннических действий и обеспечение безопасности</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Передача данных третьим лицам</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Мы не продаём персональные данные. Данные могут передаваться следующим сервисам в рамках
              оказания услуг:
            </p>
            <div className="space-y-2 rounded-xl border border-border/40 overflow-hidden">
              {[
                {
                  name: "ЮKassa",
                  desc: "Обработка платёжных транзакций. Данные карты не проходят через наш сервер.",
                  url: "https://yookassa.ru/docs/support/merchant/policy/privacy",
                  urlLabel: "Политика ЮKassa",
                },
                {
                  name: "Supabase",
                  desc: "Облачное хранение данных платформы (серверы в ЕС, соответствие GDPR).",
                  url: null,
                  urlLabel: null,
                },
                {
                  name: "OpenAI",
                  desc: "Обработка ИИ-запросов. Тексты запросов передаются в обезличенном виде без привязки к личности.",
                  url: null,
                  urlLabel: null,
                },
                {
                  name: "ФНС России",
                  desc: "Сведения о доходах самозанятого передаются через приложение «Мой налог» (не через наш сервер).",
                  url: null,
                  urlLabel: null,
                },
              ].map((item) => (
                <div key={item.name} className="flex gap-3 px-4 py-2.5 text-sm border-b border-border/30 last:border-0">
                  <span className="font-medium min-w-[90px] shrink-0">{item.name}</span>
                  <span className="text-muted-foreground">
                    {item.desc}
                    {item.url && (
                      <>
                        {" "}
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {item.urlLabel}
                        </a>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Срок хранения данных</h2>
            <p className="text-muted-foreground leading-relaxed">
              Данные хранятся в течение всего срока существования аккаунта. После удаления аккаунта
              персональные данные уничтожаются в течение 30 дней, за исключением сведений, которые
              Оператор обязан хранить по законодательству (данные о доходах — до 4 лет в соответствии
              с нормами для плательщиков НПД).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Права субъекта персональных данных</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              В соответствии с законодательством РФ вы имеете право:
            </p>
            <ul className="text-muted-foreground space-y-1.5 text-sm list-disc list-inside">
              <li>Получить информацию о составе и целях обработки ваших персональных данных</li>
              <li>Потребовать исправления неточных или устаревших данных</li>
              <li>Потребовать удаления данных (при отсутствии законных оснований для их хранения)</li>
              <li>Отозвать согласие на обработку персональных данных, направив запрос на email</li>
              <li>Обратиться с жалобой в Федеральную службу по надзору в сфере связи (Роскомнадзор)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Запросы принимаются по адресу <strong>support@tvoy-vector.ru</strong>. Мы ответим
              в течение 30 календарных дней.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Защита персональных данных</h2>
            <p className="text-muted-foreground leading-relaxed">
              Передача данных осуществляется исключительно по протоколу HTTPS (TLS). Пароли хранятся
              в виде необратимого хэша и никогда не передаются в открытом виде. Доступ к базе данных
              ограничен и требует аутентификации. Мы своевременно применяем обновления безопасности.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Cookie-файлы</h2>
            <p className="text-muted-foreground leading-relaxed">
              Платформа использует исключительно технически необходимые cookie для поддержания
              авторизованной сессии пользователя. Никакие cookie для рекламы, трекинга или аналитики
              не применяются и не требуют вашего дополнительного согласия. Отключение cookie в
              настройках браузера может нарушить работу авторизации.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Изменения Политики</h2>
            <p className="text-muted-foreground leading-relaxed">
              При существенных изменениях настоящей Политики мы уведомим вас по электронной почте
              не позднее чем за 7 дней до вступления изменений в силу. Актуальная версия всегда
              доступна по адресу{" "}
              <Link href="/legal/privacy" className="text-primary hover:underline">/legal/privacy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Контактная информация</h2>
            <p className="text-muted-foreground leading-relaxed">
              По всем вопросам обработки персональных данных:{" "}
              <strong>support@tvoy-vector.ru</strong>
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-border/40 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/legal/oferta" className="hover:text-foreground transition-colors">
            Публичная оферта
          </Link>
          <Link href="/subscription" className="hover:text-foreground transition-colors">
            Управление подпиской
          </Link>
        </div>
      </div>
    </div>
  );
}
