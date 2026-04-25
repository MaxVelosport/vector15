import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceInputButton } from "@/components/voice-input-button";
import { cn } from "@/lib/utils";
import {
  Bot, Calendar, CircleDollarSign, FileText, HelpCircle,
  Home, Lightbulb, MessageCircle, PenLine, Search, Star,
  StickyNote, Video, ChevronDown, ChevronUp, ArrowRight,
  CheckCircle2, Zap, Sparkles, BookOpen, Clock, AlertCircle,
  Send, Loader2, GraduationCap, RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useOnboarding } from "@/components/onboarding-tour";

const QUICK_STEPS = [
  {
    num: 1,
    icon: Home,
    color: "bg-blue-500",
    title: "Изучите главную страницу",
    desc: "На главной видны ближайшее занятие с таймером обратного отсчёта, ваш баланс и последние домашние задания. Это ваш учебный центр управления.",
  },
  {
    num: 2,
    icon: Calendar,
    color: "bg-emerald-500",
    title: "Посмотрите расписание",
    desc: "Раздел «Занятия» показывает все ваши уроки. Видно дату, время, тему каждого занятия и ссылку для входа в видеоурок.",
  },
  {
    num: 3,
    icon: FileText,
    color: "bg-violet-500",
    title: "Выполните домашнее задание",
    desc: "В разделе «Домашние задания» откройте задание от репетитора, введите ответ и нажмите «Отправить». Репетитор проверит и оставит комментарий.",
  },
  {
    num: 4,
    icon: Bot,
    color: "bg-cyan-500",
    title: "Воспользуйтесь ИИ-помощником",
    desc: "Застряли на задаче? ИИ-помощник объяснит тему, поможет разобраться с примером и ответит на учебные вопросы — 24/7 без ожидания.",
  },
];

interface Tip {
  title: string;
  desc: string;
  emoji?: string;
}

interface Section {
  id: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  title: string;
  subtitle: string;
  tips: Tip[];
}

const sections: Section[] = [
  {
    id: "home",
    icon: Home,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    title: "Главная страница",
    subtitle: "Ваш учебный дашборд",
    tips: [
      { emoji: "⏰", title: "Таймер до занятия", desc: "Большой блок вверху показывает сколько времени до следующего урока. Когда придёт время — нажмите кнопку «Войти в конференцию»." },
      { emoji: "📊", title: "Ваш прогресс", desc: "На главной видны: количество проведённых занятий, пропущенных уроков и текущий баланс. Зелёный баланс — есть предоплата. Красный — есть долг." },
      { emoji: "📋", title: "Новые задания", desc: "Последние домашние задания от репетитора отображаются прямо на главной. Нажмите на задание чтобы открыть его и сдать ответ." },
      { emoji: "💬", title: "Сообщения репетитора", desc: "Новые сообщения от репетитора показываются на главной. Нажмите «Открыть чат» для полной переписки." },
    ],
  },
  {
    id: "lessons",
    icon: Calendar,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    title: "Занятия и расписание",
    subtitle: "Ваши уроки и их история",
    tips: [
      { emoji: "📅", title: "Предстоящие занятия", desc: "В разделе «Занятия» показаны все запланированные уроки в хронологическом порядке с датой, временем и темой. Ближайшее занятие выделено." },
      { emoji: "📖", title: "История уроков", desc: "Прошедшие занятия видны в истории со статусами: «Проведено» (зелёный), «Отменено» (серый), «Перенесено» (жёлтый). Так видно сколько уроков прошло." },
      { emoji: "🎯", title: "Темы занятий", desc: "У каждого урока указана тема из вашей учебной программы. Это помогает готовиться заранее — посмотрите тему следующего урока и освежите материал." },
      { emoji: "▶️", title: "Вход на видеоурок", desc: "Рядом с занятием есть кнопка «Конференция» или иконка видео. Нажмите чтобы открыть видеозвонок. Разрешите доступ к камере и микрофону при первом входе." },
      { emoji: "❌", title: "Отмена занятия", desc: "Если не можете прийти — сообщите репетитору заранее через чат. Своевременное предупреждение помогает избежать штрафных оплат." },
    ],
  },
  {
    id: "homework",
    icon: FileText,
    color: "text-violet-600",
    bg: "bg-violet-500/10",
    title: "Домашние задания",
    subtitle: "Просмотр, выполнение и сдача",
    tips: [
      { emoji: "📝", title: "Как открыть задание", desc: "Перейдите в «Домашние задания» и нажмите на задание. Откроется полный текст с инструкциями. Прочитайте внимательно перед выполнением." },
      { emoji: "📤", title: "Как сдать задание", desc: "Введите ответ в поле «Ваш ответ», прикрепите файл если нужно, и нажмите «Отправить на проверку». Репетитор получит уведомление." },
      { emoji: "🏷️", title: "Статусы заданий", desc: "«Новое» — нужно выполнить. «На проверке» — вы отправили, ждёте оценки. «Выполнено» — репетитор принял. «Просрочено» — срок истёк, всё равно выполните и отправьте." },
      { emoji: "⏰", title: "Срок сдачи", desc: "Дедлайн показан рядом с каждым заданием. Красная метка означает срок скоро истекает или уже прошёл. Выполняйте задания заранее — не в последний момент." },
      { emoji: "💬", title: "Комментарий репетитора", desc: "После проверки репетитор может оставить разбор ошибок. Откройте выполненное задание и прочитайте — это самое ценное для вашего прогресса." },
      { emoji: "🤖", title: "ИИ-подсказки", desc: "Застряли на задаче? Нажмите «Спросить ИИ» или откройте ИИ-помощника. Он объяснит как подойти к задаче — не даст готовый ответ, но поможет разобраться." },
    ],
  },
  {
    id: "ai",
    icon: Bot,
    color: "text-cyan-600",
    bg: "bg-cyan-500/10",
    title: "ИИ-помощник",
    subtitle: "Умный помощник для учёбы",
    tips: [
      { emoji: "🤖", title: "Что умеет ИИ-помощник", desc: "Объясняет темы простым языком, решает задачи с пошаговым разбором, проверяет ваши ответы на ошибки, переводит тексты и отвечает на вопросы по учёбе." },
      { emoji: "❓", title: "Как правильно спрашивать", desc: "Спрашивайте конкретно. Хорошо: «Объясни правило суффиксов -ать/-ять с примерами». Плохо: «помоги с русским». Чем конкретнее вопрос — тем лучше ответ." },
      { emoji: "🔁", title: "Попросите переформулировать", desc: "Если объяснение непонятно — напишите «объясни проще» или «приведи другой пример». ИИ объяснит по-другому столько раз сколько нужно." },
      { emoji: "📚", title: "Помощь с домашкой", desc: "Покажите текст задания ИИ и он поможет понять что нужно сделать. Важно: ИИ помогает разобраться с методом решения, но не делает задание за вас." },
      { emoji: "🌐", title: "Языковые задачи", desc: "ИИ отлично работает с языками: проверяет грамматику, объясняет правила, делает перевод с разбором, составляет диалоги для практики." },
      { emoji: "💡", title: "Советы по учёбе", desc: "Спросите ИИ как лучше запомнить материал, как подготовиться к экзамену или как организовать учебный процесс — он даст практичные советы." },
    ],
  },
  {
    id: "finance",
    icon: CircleDollarSign,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    title: "Финансы и баланс",
    subtitle: "Оплата и история платежей",
    tips: [
      { emoji: "💰", title: "Как работает баланс", desc: "Баланс = сумма ваших оплат − стоимость проведённых уроков. Положительный — у вас оплачены уроки наперёд. Это удобно: не нужно думать об оплате каждый раз." },
      { emoji: "🔴", title: "Отрицательный баланс", desc: "Красный баланс означает долг за уже проведённые занятия. Уточните у репетитора удобный способ и срок оплаты." },
      { emoji: "📋", title: "История платежей", desc: "В разделе «Финансы» вся история ваших оплат с датами и суммами. Можно проверить был ли учтён ваш платёж." },
      { emoji: "📈", title: "На сколько хватит баланса", desc: "Видно сколько занятий вы ещё можете посетить при текущем балансе. Удобно для планирования следующей оплаты." },
    ],
  },
  {
    id: "conference",
    icon: Video,
    color: "text-indigo-600",
    bg: "bg-indigo-500/10",
    title: "Видеоконференция",
    subtitle: "Как войти на онлайн-урок",
    tips: [
      { emoji: "▶️", title: "Как войти на урок", desc: "На главной странице или в разделе «Занятия» нажмите кнопку «Войти в конференцию». Откроется новая вкладка с видеозвонком. Разрешите камеру и микрофон." },
      { emoji: "🕐", title: "Когда входить", desc: "Заходите за 2-3 минуты до начала урока — это даст время проверить звук и изображение. Репетитор откроет конференцию незадолго до начала." },
      { emoji: "🎧", title: "Технические советы", desc: "Используйте наушники — так нет эха. Проверьте свет — сядьте лицом к окну. Закройте ненужные вкладки — чтобы компьютер работал быстрее." },
      { emoji: "💻", title: "Лучший браузер", desc: "Рекомендуется Google Chrome — он лучше работает с видеоконференциями. Если проблемы с входом — попробуйте обновить браузер или перезагрузить страницу." },
      { emoji: "🔧", title: "Проблемы со звуком/видео", desc: "Если репетитор вас не слышит — проверьте микрофон в настройках браузера. Нажмите на значок замка слева от адреса страницы и разрешите микрофон и камеру." },
    ],
  },
  {
    id: "notes",
    icon: StickyNote,
    color: "text-green-600",
    bg: "bg-green-500/10",
    title: "Мои заметки",
    subtitle: "Личные записи для учёбы",
    tips: [
      { emoji: "✍️", title: "Для чего нужны заметки", desc: "Записывайте важные моменты с занятий, правила которые сложно запомнить, вопросы для следующего урока или термины с объяснениями." },
      { emoji: "🔒", title: "Только ваши заметки", desc: "Заметки видны только вам — репетитор их не читает. Это ваше личное учебное пространство без ограничений." },
      { emoji: "🗂️", title: "Как организовать", desc: "Давайте заметкам понятные названия: «Урок 14 — Тригонометрия», «Слова для запоминания», «Правила пунктуации». Так легко найти нужное." },
    ],
  },
  {
    id: "messages",
    icon: MessageCircle,
    color: "text-pink-600",
    bg: "bg-pink-500/10",
    title: "Чат с репетитором",
    subtitle: "Переписка и вопросы",
    tips: [
      { emoji: "💬", title: "Когда писать в чат", desc: "Задайте вопрос по домашнему заданию, уточните тему следующего урока, сообщите о переносе или задайте вопрос по пройденному материалу." },
      { emoji: "📎", title: "Отправить фото", desc: "Можно сфотографировать задание в тетради и отправить фото в чат — репетитор проверит и ответит с комментариями." },
      { emoji: "🔔", title: "Новые сообщения", desc: "Значок на иконке «Чат» в навигации показывает количество непрочитанных сообщений. Отвечайте оперативно — это поможет лучше подготовиться к уроку." },
    ],
  },
  {
    id: "board",
    icon: PenLine,
    color: "text-orange-600",
    bg: "bg-orange-500/10",
    title: "Интерактивная доска",
    subtitle: "Совместная работа в реальном времени",
    tips: [
      { emoji: "✏️", title: "Что такое доска", desc: "Онлайн-доска — это виртуальная классная доска. Вы и репетитор можете рисовать, писать и чертить схемы вместе в режиме реального времени." },
      { emoji: "🖱️", title: "Инструменты", desc: "На панели слева выберите инструмент: карандаш для рисования, текст для написания, фигуры для схем, ластик для исправлений." },
      { emoji: "💾", title: "Автосохранение", desc: "Доска сохраняется автоматически — вы можете вернуться к записям с предыдущего занятия в любое время. Ничего не теряется." },
      { emoji: "🔗", title: "Вход на доску", desc: "Кнопка доски есть рядом с каждым занятием в расписании. Нажмите — откроется совместное рабочее пространство с репетитором." },
    ],
  },
  {
    id: "progress",
    icon: Star,
    color: "text-violet-600",
    bg: "bg-violet-500/10",
    title: "Прогресс и достижения",
    subtitle: "Геймификация вашего обучения",
    tips: [
      { emoji: "⭐", title: "Как начисляется XP", desc: "За каждое проведённое занятие — 10 XP, за выполненное домашнее задание — 5 XP, за высокую оценку (90+) — бонус 5 XP. Собирайте стрики за регулярные занятия." },
      { emoji: "🎮", title: "Уровни", desc: "Новый уровень каждые 100 XP. Уровни открывают звания: Ученик, Стажёр, Практик, Мастер, Эксперт, Профессор. Ваш уровень виден на главной странице." },
      { emoji: "🔥", title: "Стрик (серия занятий)", desc: "Стрик — это количество недель подряд с минимум одним занятием. Не пропускайте уроки, чтобы серия не сбросилась. Длинная серия даёт бонусные XP." },
      { emoji: "🏆", title: "Достижения (медали)", desc: "Открывайте медали за учёбу: «Первое занятие», «10 уроков», «Отличник» (оценка 100), «Марафонец» (50 занятий). Каждое достижение уникально." },
      { emoji: "📊", title: "Статистика за неделю", desc: "На странице прогресса — графики: выполненная домашка по неделям, средняя оценка, количество занятий. Видно как улучшаются показатели." },
      { emoji: "🎯", title: "Недельные цели", desc: "Каждую неделю автоматически ставятся цели по урокам и домашним заданиям. Выполняйте их для получения бонусного XP и поддержания стрика." },
    ],
  },
  {
    id: "tasks",
    icon: Zap,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    title: "Задачник ЕГЭ",
    subtitle: "База заданий и варианты от репетитора",
    tips: [
      { emoji: "📚", title: "Что такое задачник", desc: "Задачник — это база реальных заданий ЕГЭ по вашему предмету. Репетитор может назначить вам конкретный вариант или вы сами можете тренироваться." },
      { emoji: "🎲", title: "Как выбирать задания", desc: "Фильтруйте задания по теме, классу и уровню сложности. Нажмите на задание чтобы открыть условие и приступить к решению." },
      { emoji: "📋", title: "Варианты от репетитора", desc: "Если репетитор назначил вам вариант — он появится в разделе «Мои варианты». Выполните все задания варианта и отправьте результаты." },
      { emoji: "🔍", title: "Поиск по теме", desc: "Введите тему в поиск: «производные», «тригонометрия», «вероятность» — и получите подборку подходящих задач. Удобно для подготовки к конкретному уроку." },
      { emoji: "⚡", title: "Случайное задание", desc: "Нажмите «Случайное задание» для тренировки в режиме экзамена — задача выбирается автоматически по вашему предмету." },
    ],
  },
];

const FAQ = [
  { q: "Как войти на видеоурок?", a: "На главной странице или в разделе «Занятия» нажмите кнопку «Войти в конференцию» рядом с занятием. Откроется новая вкладка. Разрешите доступ к камере и микрофону." },
  { q: "Что делать если не могу войти на урок?", a: "Попробуйте: 1) Обновить страницу. 2) Использовать Chrome. 3) Разрешить доступ к камере/микрофону в настройках браузера. 4) Написать репетитору в чат." },
  { q: "Как сдать домашнее задание?", a: "Откройте раздел «Домашние задания», нажмите на задание, введите ответ в поле и нажмите «Отправить на проверку». Репетитор проверит и оставит комментарий." },
  { q: "Почему у меня отрицательный баланс?", a: "Отрицательный баланс означает долг: было проведено занятий на большую сумму, чем вы оплатили. Уточните сумму и способ оплаты у вашего репетитора." },
  { q: "Можно ли пользоваться ИИ для домашки?", a: "ИИ-помощник помогает понять как решать задачи и объясняет теорию. Он не делает задание за вас — но помогает разобраться с подходом. Репетитор видит ваш ответ, а не ответы ИИ." },
  { q: "Как связаться с репетитором?", a: "Через раздел «Чат» — напишите сообщение и репетитор ответит. Для срочных вопросов используйте контакты из профиля (телефон, мессенджер)." },
  { q: "Куда пропали мои занятия?", a: "Все занятия в разделе «Занятия» — как прошедшие, так и будущие. Переключите вид: «Предстоящие» или «История». Если занятие отменено репетитором — оно отмечено серым." },
  { q: "Что такое XP и зачем они нужны?", a: "XP (очки опыта) — игровая система мотивации. За занятие даётся 10 XP, за домашку — 5 XP. Каждые 100 XP — новый уровень. Это делает учёбу интереснее и помогает отслеживать прогресс." },
  { q: "Почему сбросился мой стрик?", a: "Стрик сбрасывается, если на текущей неделе не было ни одного проведённого занятия. Чтобы сохранить серию — занимайтесь хотя бы раз в неделю без пропусков." },
  { q: "Как использовать задачник ЕГЭ?", a: "Перейдите в раздел «Задачник», выберите предмет и тему. Нажмите на задание чтобы открыть условие. Если репетитор назначил вам вариант — он будет в блоке «Мои варианты» вверху страницы." },
  { q: "Сколько запросов к ИИ у меня есть?", a: "Базовый лимит устанавливает репетитор. Если запросы заканчиваются — можно купить дополнительный пакет в разделе ИИ-помощника. Лимит обновляется каждый день." },
  { q: "Могу ли я отправить фото в ИИ-помощник?", a: "Да! В чате с ИИ нажмите иконку скрепки или камеры, сфотографируйте задачу из учебника и загрузите. ИИ распознает условие и поможет с решением." },
  { q: "Что делать если репетитор не отвечает в чате?", a: "Репетиторы отвечают в рабочее время. Если вопрос срочный — используйте контакты из профиля (телеграм, телефон). Не беспокойтесь — все сообщения сохраняются и репетитор увидит их." },
  { q: "Как прикрепить файл к домашнему заданию?", a: "При отправке домашнего задания нажмите иконку скрепки рядом с полем ответа. Можно прикрепить фото, PDF или документ. Поддерживаются файлы до 20 МБ." },
];

function SectionCard({ section, searchQuery }: { section: Section; searchQuery: string }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  const filteredTips = searchQuery
    ? section.tips.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : section.tips;

  if (searchQuery && filteredTips.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-2xl border-border/50 overflow-hidden">
        <button
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
          onClick={() => setOpen(o => !o)}
        >
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", section.bg)}>
            <Icon className={cn("h-5 w-5", section.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{section.title}</div>
            <div className="text-xs text-muted-foreground">{section.subtitle}</div>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {filteredTips.length} {filteredTips.length === 1 ? "совет" : filteredTips.length < 5 ? "совета" : "советов"}
          </Badge>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1 shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />}
        </button>

        <AnimatePresence>
          {(open || searchQuery) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="px-4 pb-4 pt-0">
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
                      {tip.emoji && <span className="text-lg shrink-0 leading-none mt-0.5">{tip.emoji}</span>}
                      <div>
                        <div className="text-sm font-medium">{tip.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tip.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

function FaqItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.04 }}>
      <button
        className="w-full flex items-start gap-3 py-3 text-left border-b border-border/40 last:border-0 hover:bg-muted/20 rounded-lg px-2 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <HelpCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{q}</div>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-xs text-muted-foreground leading-relaxed mt-1.5"
              >
                {a}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>
    </motion.div>
  );
}

/* ─── Inline AI Chat Component ─── */
interface AiMessage { role: "user" | "assistant"; content: string; }

const AI_QUICK = [
  "Как сдать домашнее задание?",
  "Как войти на видеоурок?",
  "Что такое XP и уровни?",
  "Как написать репетитору?",
  "Почему отрицательный баланс?",
  "Как пользоваться задачником?",
  "Как подключить Telegram?",
  "Что делать если ничего непонятно?",
];

const WELCOME: AiMessage = {
  role: "assistant",
  content: "Привет! 👋 Я ИИ-помощник по платформе «Твой Вектор». Задай любой вопрос о работе кабинета — объясню просто и понятно!",
};

function HelpAiChat() {
  const [messages, setMessages] = useState<AiMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || loading) return;
    const msgs = [...messages, { role: "user" as const, content: t }];
    setMessages(msgs);
    setInput("");
    setLoading(true);
    try {
      const history = msgs.slice(1).map(m => ({ role: m.role, content: m.content }));
      const res = await apiRequest("POST", "/api/student/help-chat", { message: t, history: history.slice(0, -1) });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.message || "Не удалось получить ответ." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Ой, что-то пошло не так. Попробуй ещё раз! 🙏" }]);
    } finally {
      setLoading(false);
    }
  }

  const showQuick = messages.length === 1 && !loading;

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden flex flex-col" style={{ height: 560 }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/50 bg-gradient-to-r from-primary/10 to-cyan-500/5 px-4 py-3 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-500 shadow-sm">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">ИИ-помощник по платформе</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[11px] text-muted-foreground">Отвечает на вопросы о кабинете</p>
          </div>
        </div>
        {messages.length > 1 && (
          <button
            onClick={() => setMessages([WELCOME])}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> Очистить
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-cyan-500/20 mt-0.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted/60 text-foreground rounded-bl-sm"
            )}>
              {m.content}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-cyan-500/20">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted/60 px-4 py-3">
              {[0,1,2].map(i => (
                <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      <AnimatePresence>
        {showQuick && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="border-t border-border/40 px-4 py-3 shrink-0">
            <p className="text-xs font-medium text-muted-foreground mb-2">Частые вопросы — нажми чтобы спросить:</p>
            <div className="flex flex-wrap gap-1.5">
              {AI_QUICK.map(q => (
                <button key={q} onClick={() => send(q)}
                  className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="border-t border-border/50 p-3 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 focus-within:border-primary/40 focus-within:bg-background transition-colors">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Задай любой вопрос о кабинете..."
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
            rows={1}
            style={{ maxHeight: 100 }}
            data-testid="help-ai-chat-input"
          />
          <VoiceInputButton
            onTranscript={(t) => setInput(m => m ? (m.trimEnd() + " " + t) : t)}
            size="sm"
            className="h-8 w-8 shrink-0"
            data-testid="button-voice-student-help"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
              input.trim() && !loading
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            data-testid="help-ai-chat-send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function StudentHelpPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"start" | "guide" | "faq" | "ai">("start");
  const { resetOnboarding, showOnboarding } = useOnboarding("student");
  const isSearching = search.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" />
          Справочный центр
        </h1>
        <p className="text-muted-foreground mt-0.5">Всё что нужно знать для учёбы на платформе</p>
      </div>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-cyan-500/5 border border-primary/20 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 shrink-0">
              <Lightbulb className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-base">Добро пожаловать в личный кабинет!</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Здесь вы можете следить за занятиями, выполнять домашние задания, общаться с репетитором и получать помощь от ИИ в любое время.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge className="bg-primary/15 text-primary border-primary/20 gap-1">
                  <Zap className="h-3 w-3" /> {sections.reduce((n, s) => n + s.tips.length, 0)} советов
                </Badge>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {sections.length} разделов
                </Badge>
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 gap-1">
                  <HelpCircle className="h-3 w-3" /> {FAQ.length} вопросов
                </Badge>
                <button
                  onClick={resetOnboarding}
                  className="flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                  data-testid="button-hero-start-tour"
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  Запустить обучение
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по всем советам..."
          className="pl-9 rounded-xl"
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-student-help-search"
        />
      </div>

      {/* Tabs */}
      {!isSearching && (
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: "start", label: "С чего начать", icon: Sparkles },
            { id: "ai", label: "Спроси ИИ", icon: Bot },
            { id: "guide", label: "Разделы", icon: BookOpen },
            { id: "faq", label: "FAQ", icon: HelpCircle },
          ].map(tab => {
            const Icon = tab.icon;
            const isAi = tab.id === "ai";
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all border",
                  activeTab === tab.id
                    ? isAi
                      ? "bg-gradient-to-r from-primary to-cyan-500 text-white border-primary shadow-sm"
                      : "bg-primary text-primary-foreground border-primary shadow-sm"
                    : isAi
                      ? "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {isAi && activeTab !== "ai" && (
                  <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            );
          })}
          <button
            onClick={resetOnboarding}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-dashed border-border/60 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
            data-testid="button-restart-tour"
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Обучение
          </button>
        </div>
      )}

      {/* AI Chat Tab */}
      {!isSearching && activeTab === "ai" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Спроси ИИ — ответит за секунды</h3>
          </div>
          <HelpAiChat />
        </div>
      )}

      {/* Getting Started */}
      {!isSearching && activeTab === "start" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Быстрый старт — 4 шага</h3>
          </div>
          <div className="space-y-3">
            {QUICK_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  className="flex items-start gap-4 rounded-2xl border border-border/50 bg-card p-4"
                >
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0 text-lg font-bold", step.color)}>
                    {step.num}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{step.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Tips for success */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Советы для успешной учёбы</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" /><span>Выполняйте домашние задания сразу после урока, пока материал ещё свежий</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" /><span>Используйте ИИ-помощника для понимания сложных тем — не для списывания</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" /><span>Заходите на урок за 3-5 минут до начала — чтобы проверить звук и камеру</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" /><span>Записывайте вопросы в «Заметки» в течение недели — задайте их на уроке</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" /><span>Предупреждайте об отмене занятия хотя бы за сутки — это важно для репетитора</span></li>
            </ul>
          </div>
        </div>
      )}

      {/* Sections */}
      {(isSearching || activeTab === "guide") && (
        <div className="space-y-3">
          {!isSearching && (
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Советы по разделам</h3>
            </div>
          )}
          {sections.map(s => (
            <SectionCard key={s.id} section={s} searchQuery={search} />
          ))}
          {isSearching && sections.every(s =>
            s.tips.every(t =>
              !t.title.toLowerCase().includes(search.toLowerCase()) &&
              !t.desc.toLowerCase().includes(search.toLowerCase())
            )
          ) && (
            <div className="text-center py-10 text-muted-foreground">
              <HelpCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Ничего не найдено по запросу «{search}»</p>
              <p className="text-xs mt-1">Попробуйте другие слова или задайте вопрос репетитору в чате</p>
            </div>
          )}
        </div>
      )}

      {/* FAQ */}
      {!isSearching && activeTab === "faq" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Частые вопросы</h3>
          </div>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-4">
              {FAQ.map((item, idx) => (
                <FaqItem key={idx} q={item.q} a={item.a} idx={idx} />
              ))}
            </CardContent>
          </Card>
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-center">
            <MessageCircle className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">Не нашли ответ?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Напишите репетитору в разделе «Чат» — он ответит и поможет разобраться.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
