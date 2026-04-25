import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceInputButton } from "@/components/voice-input-button";
import { cn } from "@/lib/utils";
import {
  BookOpen, Bot, Calendar, CircleDollarSign, GraduationCap,
  HelpCircle, Lightbulb, MessageSquare, Search, Users, Video,
  ChevronDown, ChevronUp, Star, ArrowRight, CheckCircle2,
  Zap, Clock, Wallet, PenLine, FileText, LayoutGrid, Repeat,
  AlertCircle, Download, Table2, Sparkles, SendHorizontal, Loader2,
  LifeBuoy, Plus, ChevronRight, Wand2, MessageCircle,
  Globe, Gift,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";

import { useDocumentTitle } from "@/hooks/use-document-title";
const QUICK_STEPS = [
  {
    num: 1,
    icon: Users,
    color: "bg-blue-500",
    title: "Добавьте первого ученика",
    desc: "Перейдите в «Ученики» → «Добавить ученика». Укажите имя, предмет и стоимость урока. Это займёт 1 минуту.",
    path: "/students",
    action: "Добавить ученика",
  },
  {
    num: 2,
    icon: Calendar,
    color: "bg-emerald-500",
    title: "Создайте расписание",
    desc: "В разделе «Расписание» нажмите «+» и выберите ученика, дату и время. Можно задать повторяющиеся занятия сразу на весь семестр.",
    path: "/schedule",
    action: "Открыть расписание",
  },
  {
    num: 3,
    icon: GraduationCap,
    color: "bg-violet-500",
    title: "Проведите занятие",
    desc: "После урока зайдите в «Занятия» или «Расписание» и нажмите «Проведено ✓». Система спишет с баланса ученика автоматически.",
    path: "/lessons",
    action: "Открыть занятия",
  },
  {
    num: 4,
    icon: Wallet,
    color: "bg-amber-500",
    title: "Внесите оплату",
    desc: "В разделе «Финансы» выберите ученика и добавьте сумму платежа. Баланс обновится мгновенно.",
    path: "/finance",
    action: "Открыть финансы",
  },
  {
    num: 5,
    icon: BookOpen,
    color: "bg-pink-500",
    title: "Назначьте домашнее задание",
    desc: "В разделе «Домашки» выберите ученика, напишите задание или сгенерируйте его с помощью ИИ. Ученик увидит его в своём кабинете.",
    path: "/homework",
    action: "Открыть домашки",
  },
];

interface Tip {
  title: string;
  desc: string;
  emoji?: string;
  link?: { label: string; path: string };
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
    id: "students",
    icon: Users,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    title: "Ученики",
    subtitle: "Управление базой учеников и профилями",
    tips: [
      { emoji: "➕", title: "Как добавить ученика", desc: "Перейдите в «Ученики» и нажмите «Добавить ученика». Заполните: имя, предмет, стоимость урока, контакты. Все данные можно редактировать позже — нажмите на карточку ученика.", link: { label: "Добавить ученика", path: "/students" } },
      { emoji: "📚", title: "Учебная программа", desc: "В профиле ученика откройте вкладку «Программа» и добавьте темы с количеством занятий на каждую. Система автоматически подставит нужную тему при создании занятий — репетитор видит что именно нужно проходить." },
      { emoji: "🔗", title: "Ссылки для занятий (2–4 кнопки)", desc: "В профиле ученика укажите внешние ссылки на конференцию (Zoom, Meet, Jitsi и др.) и/или внешнюю доску. Ученик в своём кабинете всегда видит 2–4 кнопки: внешняя конференция (если добавлена), BBB-конференция (если настроена), внешняя доска (если добавлена) и внутренняя доска — всегда. Нажатие открывает сервис сразу." },
      { emoji: "🏦", title: "Баланс и долги", desc: "На карточке ученика отображается текущий баланс: зелёный — есть оплата вперёд, красный — есть долг. Нажмите на карточку чтобы увидеть полную историю платежей и занятий." },
      { emoji: "💤", title: "Архивирование ученика", desc: "Если ученик временно не занимается — нажмите кнопку «Архивировать» в профиле. Он пропадёт из основного списка, но вся история занятий и платежей сохранится. Можно вернуть в любой момент." },
      { emoji: "🔍", title: "Поиск ученика", desc: "Используйте строку поиска в верхней части списка. Поиск работает по имени, предмету и контактам. Можно фильтровать только активных учеников." },
      { emoji: "👤", title: "Доступ для ученика", desc: "В профиле ученика нажмите «Скопировать ссылку» — отправьте её ученику. По этой ссылке он попадёт в свой личный кабинет без регистрации. Вы также можете создать ему логин и пароль.", link: { label: "Управление учениками", path: "/students" } },
    ],
  },
  {
    id: "schedule",
    icon: Calendar,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    title: "Расписание",
    subtitle: "Планирование занятий и управление временем",
    tips: [
      { emoji: "📅", title: "Три вида отображения", desc: "Переключайтесь между «День», «Неделя» и «Месяц» кнопками вверху. В виде «День» видны все временные слоты с 9:00 до 21:00 с занятыми и свободными окошками сразу наглядно.", link: { label: "Открыть расписание", path: "/schedule" } },
      { emoji: "🔄", title: "Повторяющиеся занятия", desc: "При создании занятия выберите дни недели в разделе «Повторение». Укажите количество занятий или «На весь год» — система создаст все занятия за один раз. Экономит время при начале нового семестра." },
      { emoji: "⚠️", title: "Определение конфликтов", desc: "При создании занятия система автоматически проверяет конфликты и показывает предупреждение (жёлтый банер) если это время уже занято другим учеником. Вы всё равно можете добавить — конфликт лишь сигнал." },
      { emoji: "🗂️", title: "Массовое добавление", desc: "Кнопка «Массовое добавление» открывает таблицу где можно сразу настроить расписание для нескольких учеников. Идеально при начале нового учебного года." },
      { emoji: "➡️", title: "Перенос занятия", desc: "Нажмите иконку со стрелками (⇄) рядом с занятием. Появится диалог с визуальной сеткой времён: зелёные ячейки — свободно, жёлтые — занято. Выберите нужное время одним кликом." },
      { emoji: "📤", title: "Экспорт в календарь", desc: "Кнопка «Экспорт» скачивает файл .ics со всеми занятиями. Импортируйте в Google Календарь, Outlook или Apple Calendar — занятия появятся как события с напоминаниями." },
      { emoji: "✅", title: "Отметка статуса", desc: "Нажмите на занятие в расписании и выберите статус: «Проведено ✓» (с оплатой), «Проведено ✗» (без списания), «Отменено» (бесплатно), «Отмена с оплатой» (ученик не пришёл, оплата удержана)." },
    ],
  },
  {
    id: "finance",
    icon: CircleDollarSign,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    title: "Финансы",
    subtitle: "Учёт оплат, балансы и доходы",
    tips: [
      { emoji: "💰", title: "Как работает баланс", desc: "Баланс ученика = сумма всех его оплат − стоимость проведённых занятий. Положительный баланс — ученик оплатил наперёд. Отрицательный — долг. Система всё считает автоматически.", link: { label: "Открыть финансы", path: "/finance" } },
      { emoji: "➕", title: "Как внести оплату", desc: "Все платежи вносятся в разделе «Финансы» — это единая точка учёта. Выберите ученика, введите сумму, укажите дату и добавьте комментарий (например «за март»). Баланс обновится сразу." },
      { emoji: "💳", title: "Онлайн-оплата через ЮKassa", desc: "В «Финансы» → «Запросить оплату онлайн» — ученику уходит ссылка на оплату картой. После оплаты баланс пополняется автоматически. Работает через ЮKassa (Visa, МИР, СБП)." },
      { emoji: "📊", title: "Статистика дохода", desc: "На главной и в финансах показан месячный потенциал (максимум если бы все занятия прошли), фактически заработанное, ещё возможное и упущенное из-за отмен. Так видно полную картину." },
      { emoji: "🔴", title: "Должники и просрочка", desc: "Раздел «Долги» в финансах показывает всех учеников с отрицательным балансом. Карточки красного цвета — сразу заметно. Удобно отправить напоминание через «Рассылки»." },
      { emoji: "📅", title: "История платежей", desc: "Нажмите на ученика в финансах — откроется полная история всех его оплат и занятий в хронологическом порядке. Можно удалить ошибочный платёж." },
      { emoji: "💡", title: "Советы по оплате", desc: "Рекомендуем брать оплату за 4 занятия вперёд — так нет задолженностей. Настройте автоматические напоминания через «Рассылки» когда баланс приближается к нулю." },
    ],
  },
  {
    id: "homework",
    icon: BookOpen,
    color: "text-violet-600",
    bg: "bg-violet-500/10",
    title: "Домашние задания",
    subtitle: "Создание, проверка и обратная связь",
    tips: [
      { emoji: "✏️", title: "Как создать задание", desc: "Перейдите в «Домашки» и нажмите «Добавить задание». Выберите ученика, напишите текст задания и установите срок сдачи. Ученик сразу увидит задание в своём кабинете.", link: { label: "Открыть домашки", path: "/homework" } },
      { emoji: "🤖", title: "Генерация с ИИ", desc: "Нажмите «Сгенерировать» рядом с заданием или в разделе «ИИ». Введите тему и уровень — ИИ создаст набор упражнений за секунды. Можно редактировать результат перед сохранением." },
      { emoji: "📬", title: "Статусы заданий", desc: "Следите за статусами: «Новое» — ученик ещё не открыл. «Просматривает» — видел. «На проверке» — прислал ответ, ждёт вашей оценки. «Выполнено» — вы приняли. «Просрочено» — срок истёк." },
      { emoji: "💬", title: "Обратная связь", desc: "Откройте задание и добавьте комментарий с разбором ошибок — нажмите кнопку «Ответить». Ученик увидит ваш ответ в своём кабинете в разделе «Домашние задания»." },
      { emoji: "🏆", title: "Оценки", desc: "При принятии работы выставьте оценку от 1 до 5. Статистика оценок ученика видна в его профиле и помогает отслеживать прогресс." },
      { emoji: "🔔", title: "Просроченные задания", desc: "На значке «Домашки» в меню показывается счётчик непроверенных работ. В разделе «Просроченные» собраны все задания с истёкшим сроком." },
    ],
  },
  {
    id: "ai",
    icon: Bot,
    color: "text-cyan-600",
    bg: "bg-cyan-500/10",
    title: "ИИ-ассистент",
    subtitle: "Генерация заданий, планы уроков, проверка",
    tips: [
      { emoji: "🤖", title: "Генерация заданий", desc: "В разделе «ИИ» введите тему, уровень ученика и желаемый тип задания (тест, упражнения, диктант). ИИ создаст готовое задание которое сразу можно назначить ученику.", link: { label: "Открыть ИИ-ассистент", path: "/ai" } },
      { emoji: "📝", title: "Планы уроков", desc: "Попросите ИИ составить план урока по теме. Получите структурированный конспект с упражнениями, временными блоками и домашним заданием." },
      { emoji: "✅", title: "Проверка работ", desc: "Вставьте ответ ученика в чат ИИ и попросите проверить на ошибки. Получите подробный разбор с объяснением каждой ошибки." },
      { emoji: "🌐", title: "Языковые задачи", desc: "ИИ отлично справляется с языками: составляет диалоги, создаёт тексты для аудирования, проверяет грамматику, объясняет правила на русском языке." },
      { emoji: "💡", title: "Объяснения для ученика", desc: "Спросите как объяснить сложную тему простыми словами — получите несколько вариантов объяснений, аналогии и примеры для учеников разного возраста." },
      { emoji: "📖", title: "История чатов", desc: "Все ваши чаты с ИИ сохраняются в истории. Можно вернуться к прошлому разговору или продолжить с того места где остановились." },
    ],
  },
  {
    id: "comm",
    icon: MessageSquare,
    color: "text-pink-600",
    bg: "bg-pink-500/10",
    title: "Рассылки и сообщения",
    subtitle: "Общение с учениками и напоминания",
    tips: [
      { emoji: "📢", title: "Массовая рассылка", desc: "В разделе «Рассылки» напишите сообщение и отправьте всем ученикам или выберите конкретных. Удобно для напоминаний о переносе занятий или праздничных поздравлений.", link: { label: "Открыть рассылки", path: "/comm" } },
      { emoji: "🎯", title: "Выборочная рассылка", desc: "Фильтруйте получателей по предмету, активности или балансу. Например, отправьте напоминание об оплате только должникам." },
      { emoji: "📅", title: "Напоминания о занятиях", desc: "Используйте рассылки чтобы напомнить ученикам о завтрашнем занятии, изменении времени или отмене. Ученики видят сообщения в своём кабинете в разделе «Чат»." },
      { emoji: "💬", title: "Личные сообщения", desc: "Из профиля ученика или из рассылок можно отправить личное сообщение конкретному ученику. Он ответит из своего кабинета — вся переписка в одном месте." },
    ],
  },
  {
    id: "bbb",
    icon: Video,
    color: "text-indigo-600",
    bg: "bg-indigo-500/10",
    title: "Видеоконференции (BBB)",
    subtitle: "BigBlueButton — встроенные видеозвонки",
    tips: [
      { emoji: "🖥️", title: "Как создать конференцию", desc: "Перейдите в «Видео» в боковом меню. Нажмите «Создать», введите название конференции и при желании привяжите к конкретному ученику. Конференция сразу появится на главной.", link: { label: "Открыть Видео", path: "/bbb" } },
      { emoji: "▶️", title: "Как войти в конференцию", desc: "Нажмите синюю кнопку «Войти» рядом с конференцией. На главной странице конференция появляется автоматически, если у ученика есть привязанная комната." },
      { emoji: "🔗", title: "Ссылка для ученика", desc: "Нажмите «Ссылка ученику» в разделе «Видео» — ссылка скопируется. Ученик может войти по этой ссылке или через кнопку в своём личном кабинете." },
      { emoji: "🟢", title: "Постоянные конференции", desc: "Постоянная конференция всегда доступна по одной ссылке — идеально для регулярных занятий с одним учеником. Одноразовые удаляются после проведения." },
      { emoji: "📍", title: "BBB в занятиях", desc: "После привязки конференции к ученику, кнопка «BBB-конференция» появится в разделах «Занятия» и на главной — ученик входит напрямую в один клик. В виде «День» и «Список» показаны кликабельные бейджи для быстрого перехода." },
      { emoji: "⚙️", title: "Настройка BBB", desc: "Для работы BBB нужно указать URL вашего сервера и секрет в настройках. Если вы видите предупреждение «BBB не настроен» — свяжитесь с администратором или используйте внешние ссылки на Zoom." },
    ],
  },
  {
    id: "lessons",
    icon: GraduationCap,
    color: "text-teal-600",
    bg: "bg-teal-500/10",
    title: "История занятий",
    subtitle: "Просмотр, управление и аналитика",
    tips: [
      { emoji: "📋", title: "Виды и фильтры", desc: "В разделе «Занятия» переключайтесь между видами «Неделя» и «День». Используйте фильтр по статусу: показывать только проведённые, отменённые или ожидающие занятия.", link: { label: "Открыть занятия", path: "/lessons" } },
      { emoji: "✏️", title: "Редактирование темы", desc: "Нажмите на тему занятия — появится поле для редактирования. Измените тему прямо в карточке без открытия отдельного диалога." },
      { emoji: "📊", title: "Статистика недели", desc: "В верхней части страницы видна сводка за текущую неделю: проведено, отменено, ожидает, и заработано. Это быстрый обзор продуктивности." },
      { emoji: "📝", title: "Заметки к занятию", desc: "В раскрытой карточке занятия можно добавить заметки — что проходили, что дать домой, особенности урока. Заметки видны только репетитору." },
      { emoji: "🗑️", title: "Удаление занятий", desc: "Одиночные занятия можно удалить из карточки. Повторяющиеся занятия удаляются по одному или все сразу — система спросит что именно удалить." },
    ],
  },
  {
    id: "public-profile",
    icon: Globe,
    color: "text-violet-600",
    bg: "bg-violet-500/10",
    title: "Публичная страница",
    subtitle: "Личная визитка для новых учеников",
    tips: [
      { emoji: "🌐", title: "Получите свою ссылку", desc: "В разделе «Профиль» откройте «Публичный профиль». Включите переключатель «Профиль открыт» и задайте уникальный адрес (slug) — например, anna-petrova. Ваша ссылка: tvoyvector.ru/t/anna-petrova", link: { label: "Открыть профиль", path: "/profile" } },
      { emoji: "📷", title: "Добавьте фото", desc: "В блоке «Карточка для учеников» (вверху редактора публичного профиля) кликните на круглое фото и выберите изображение. Если фото нет — на странице крупно отображаются ваши инициалы." },
      { emoji: "📝", title: "Заполните «О себе»", desc: "Расскажите о подходе, опыте, образовании, достижениях. Чем подробнее — тем больше доверия у потенциальных учеников. Поддерживается видео-визитка с YouTube." },
      { emoji: "🎨", title: "Цвет оформления", desc: "Выберите один из 6 цветов: фиолетовый, синий, изумрудный, розовый, янтарный или тёмный. Цвет применяется к шапке страницы и кнопкам." },
      { emoji: "💬", title: "Контакты для записи", desc: "Укажите телефон, Telegram, WhatsApp, ВК, Instagram. Кнопки «Записаться» появятся прямо на странице — ученик сразу свяжется с вами." },
      { emoji: "👁️", title: "Скрыть цену", desc: "Если не хотите показывать стоимость на публичной странице — включите переключатель «Скрыть цену»." },
      { emoji: "🔗", title: "Поделитесь ссылкой", desc: "Кнопка «Открыть» в карточке ученика покажет страницу глазами ученика. Ссылку отправляйте в соцсети, в шапку профиля Instagram, в визитку." },
    ],
  },
  {
    id: "reviews",
    icon: Star,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    title: "Отзывы учеников",
    subtitle: "Сбор и модерация отзывов",
    tips: [
      { emoji: "⭐", title: "Как ученики оставляют отзывы", desc: "На вашей публичной странице любой посетитель видит блок «Отзывы учеников». Нажимает «Оставить отзыв» → указывает имя, оценку 1–5 звёзд и текст. Отзыв уходит в модерацию." },
      { emoji: "🛡️", title: "Модерация — отзывы не публикуются автоматически", desc: "Все новые отзывы ждут вашего одобрения. Без модерации они НЕ видны на публичной странице — спам и провокации не пройдут." },
      { emoji: "✅", title: "Где одобрять", desc: "В разделе «Профиль» откройте блок «Отзывы учеников». Бейджи «Ожидают: N» и «Опубликовано: N» сверху. Кнопки: «Одобрить», «Скрыть» (убрать с публичной), «Удалить» безвозвратно.", link: { label: "Открыть модерацию", path: "/profile" } },
      { emoji: "📊", title: "Средний рейтинг", desc: "Когда отзывов 1+ — на публичной странице отображаются средняя оценка (например, 4.9) и счётчик отзывов. Это сильно повышает доверие." },
      { emoji: "🔒", title: "Контакты автора скрыты", desc: "Если ученик указал email/телефон — они видны только вам в модерации. На публичной странице показывается только имя, оценка и текст." },
    ],
  },
  {
    id: "referrals",
    icon: Gift,
    color: "text-pink-600",
    bg: "bg-pink-500/10",
    title: "Приведи друга",
    subtitle: "Реферальная программа для коллег",
    tips: [
      { emoji: "🎁", title: "Получите свою ссылку", desc: "В боковом меню откройте «Приведи друга». У вас появится уникальный реферальный код и готовая ссылка для приглашения коллег-репетиторов.", link: { label: "Открыть реферальную программу", path: "/referrals" } },
      { emoji: "📤", title: "Отправьте коллегам", desc: "Поделитесь ссылкой в чатах преподавателей, в Telegram-каналах, на форумах. Каждый, кто зарегистрируется по вашей ссылке, будет привязан к вам как реферал." },
      { emoji: "📈", title: "Статистика приглашений", desc: "На странице «Приведи друга» видны: ваш реферальный код, ссылка для приглашения, список приглашённых репетиторов и общее количество регистраций." },
      { emoji: "🤝", title: "Win-win", desc: "Чем больше коллег приведёте — тем выгоднее для вас и для них. Условия программы постоянно обновляются — следите за разделом «Что нового» на главной." },
    ],
  },
];

const FAQ = [
  { q: "Как ученик входит в свой кабинет?", a: "В профиле ученика нажмите «Скопировать ссылку» — отправьте её ученику. Он откроет ссылку и попадёт в свой личный кабинет без регистрации. Вы также можете создать ему логин и пароль." },
  { q: "Почему баланс ученика отрицательный?", a: "Отрицательный баланс означает долг: проведено занятий на бо́льшую сумму, чем внесено оплат. Перейдите в Финансы → выберите ученика → нажмите «Добавить оплату»." },
  { q: "Как принять оплату онлайн?", a: "В разделе «Финансы» нажмите «Запросить оплату онлайн», выберите ученика и сумму. Ученик получит ссылку для оплаты картой (Visa, МИР, СБП). После оплаты баланс пополнится автоматически через ЮKassa." },
  { q: "Где вносить оплату — в занятиях или в финансах?", a: "Только в разделе «Финансы». Там находится вся история платежей, можно добавить ручную или онлайн-оплату, видеть баланс всех учеников. В журнале занятий оплата намеренно убрана, чтобы учёт был в одном месте." },
  { q: "Как создать расписание на весь семестр?", a: "В «Расписание» нажмите «+ Добавить». Выберите ученика, время, затем в разделе «Повторение» выберите дни недели и поставьте «На весь год». Система сразу создаст все занятия." },
  { q: "Как ученик видит домашнее задание?", a: "После создания задания в «Домашки» ученик сразу видит его в своём личном кабинете в разделе «Домашние задания». Он может просмотреть задание и отправить ответ." },
  { q: "Можно ли использовать Zoom вместо BBB?", a: "Да! В профиле ученика в поле «Конференция» вставьте ссылку на Zoom. Ученик увидит кнопку «Конференция» в своём кабинете и в расписании." },
  { q: "Как перенести одно занятие из серии?", a: "Нажмите иконку ⇄ (перенос) рядом с занятием. Выберите новую дату и время в визуальной сетке — зелёные ячейки свободны, жёлтые заняты. Только это занятие будет перенесено, остальные останутся." },
  { q: "Что значит «Проведено ✗»?", a: "«Проведено ✗» означает занятие прошло, но оплата НЕ списывается с баланса. Используйте когда занятие было пробным, бонусным или вы договорились об оплате позже." },
  { q: "Как ИИ генерирует задания?", a: "В «ИИ-ассистент» введите тему и уровень ученика. ИИ создаст готовое задание за 10-20 секунд. Вы можете отредактировать его и назначить ученику прямо из ИИ-раздела." },
  { q: "Как связаться с поддержкой?", a: "Напишите на support@tvoyvector.ru или создайте тикет в разделе «Поддержка» (кнопка «Помощь» в боковом меню). Вы получите ответ на email. Время ответа — до 24 часов в рабочие дни." },
  { q: "Как восстановить пароль?", a: "На странице входа нажмите «Забыли пароль?». Введите email аккаунта — придёт письмо с ссылкой для сброса от info@tvoyvector.ru. Проверьте папку «Спам» если письмо не пришло в течение 5 минут." },
  { q: "Где найти публичную оферту и политику конфиденциальности?", a: "Ссылки на юридические документы находятся в подвале лендинга (главная страница) и на странице регистрации. Прямые адреса: /legal/oferta и /legal/privacy." },
  { q: "Как ученики оставляют отзывы и где их одобрять?", a: "На вашей публичной странице (tvoyvector.ru/t/ваш-адрес) есть блок «Отзывы учеников» с кнопкой «Оставить отзыв». Все новые отзывы попадают в модерацию: Профиль → блок «Отзывы учеников». Нажмите «Одобрить», чтобы отзыв появился публично, или «Удалить» для отказа." },
  { q: "Как сделать публичную страницу с фото и контактами?", a: "Профиль → блок «Публичный профиль». Включите «Профиль открыт», задайте slug (например, anna-petrova), загрузите фото в карточке наверху, заполните «О себе», опыт, образование, достижения, контакты, выберите цвет. Готовая ссылка: tvoyvector.ru/t/anna-petrova." },
  { q: "Где найти реферальную программу?", a: "В боковом меню — пункт «Приведи друга» с иконкой подарка. Там ваша уникальная ссылка для приглашения коллег и статистика регистраций." },
  { q: "Почему стрелочки отмены/повтора на доске не работали?", a: "Это исправлено в версии 3.7 — кнопки ↶ и ↷ теперь корректно откатывают и повторяют действия. Также работают горячие клавиши Ctrl+Z и Ctrl+Shift+Z." },
  { q: "Почему я перестал получать уведомления каждые 30 минут о завтрашних уроках?", a: "В версии 3.7 это убрали намеренно — раньше система спамила одинаковыми «Скоро занятие — Через ~22ч / ~23ч / ~24ч». Теперь напоминание приходит только за 90 минут до начала урока и только один раз. Это нормально." },
];

function QuickStartCard({ step, idx }: { step: typeof QUICK_STEPS[0]; idx: number }) {
  const [, setLocation] = useLocation();
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.07 }}
      className="flex items-start gap-4 rounded-2xl border border-border/50 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all"
    >
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0 text-lg font-bold", step.color)}>
        {step.num}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{step.title}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
        <Button
          variant="ghost" size="sm"
          className="mt-2 h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10 px-2"
          onClick={() => setLocation(step.path)}
        >
          {step.action} <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}

function SectionCard({ section, searchQuery }: { section: Section; searchQuery: string }) {
  const [, setLocation] = useLocation();
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
          <Badge variant="secondary" className="text-xs shrink-0">{filteredTips.length} совет{filteredTips.length === 1 ? "" : filteredTips.length < 5 ? "а" : "ов"}</Badge>
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
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{tip.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tip.desc}</div>
                        {tip.link && (
                          <Button
                            variant="ghost" size="sm"
                            className="mt-1.5 h-6 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/10 px-1.5"
                            onClick={() => setLocation(tip.link!.path)}
                          >
                            {tip.link.label} <ArrowRight className="h-2.5 w-2.5" />
                          </Button>
                        )}
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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Как ученик войдёт в свой кабинет?",
  "Как создать расписание на весь семестр?",
  "Как добавить оплату ученику?",
  "Как пользоваться ИИ-ассистентом?",
  "Почему баланс ученика отрицательный?",
  "Как перенести занятие?",
];

export default function HelpPage() {
  useDocumentTitle("Помощь");
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"start" | "guide" | "faq" | "support" | "ai">("start");
  const queryClient = useQueryClient();

  // AI chat state
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aiChatEndRef.current) {
      aiChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiMessages]);

  const sendAiMessage = async (text?: string) => {
    const msg = (text ?? aiInput).trim();
    if (!msg || aiLoading) return;
    setAiInput("");
    const newHistory: ChatMessage[] = [...aiMessages, { role: "user", content: msg }];
    setAiMessages(newHistory);
    setAiLoading(true);
    try {
      const res = await fetch("/api/help/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: aiMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setAiMessages([...newHistory, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      toast.error(e.message || "Ошибка ИИ");
      setAiMessages(newHistory.slice(0, -1));
    } finally {
      setAiLoading(false);
    }
  };

  // Support tickets
  const { data: myTickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery<any[]>({
    queryKey: ["/api/support/tickets"],
    enabled: activeTab === "support",
  });

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);

  const { data: ticketDetail } = useQuery<{ ticket: any; messages: any[] }>({
    queryKey: ["/api/support/tickets", selectedTicketId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/support/tickets/${selectedTicketId}/messages`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedTicketId && activeTab === "support",
  });

  const isSearching = search.trim().length > 0;

  return (
    <DashboardLayout title="База знаний" subtitle="Руководство по работе с платформой">
      <div className="max-w-3xl mx-auto space-y-5 p-4 lg:p-6">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-cyan-500/5 border border-primary/20 p-5">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/8 blur-2xl" />
              <div className="absolute -left-4 -bottom-4 h-20 w-20 rounded-full bg-cyan-500/8 blur-2xl" />
              <Sparkles className="absolute right-10 top-3 h-4 w-4 text-primary/15 rotate-12" />
              <Star className="absolute right-4 top-10 h-3 w-3 text-cyan-400/20" />
              <Lightbulb className="absolute right-6 bottom-3 h-4 w-4 text-primary/10" />
            </div>
            <div className="flex items-start gap-4 relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 shrink-0 border border-primary/20">
                <Lightbulb className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">База знаний репетитора</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Полное руководство по платформе «Твой Вектор». Найдите ответ на любой вопрос или следуйте пошаговому руководству для быстрого старта.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge className="bg-primary/15 text-primary border-primary/20 gap-1">
                    <Zap className="h-3 w-3" /> {sections.reduce((n, s) => n + s.tips.length, 0)} советов
                  </Badge>
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {sections.length} разделов
                  </Badge>
                  <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 gap-1">
                    <HelpCircle className="h-3 w-3" /> {FAQ.length} FAQ
                  </Badge>
                  <Badge className="bg-violet-500/15 text-violet-600 border-violet-500/20 gap-1">
                    <Bot className="h-3 w-3" /> ИИ-помощник
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по всем советам и разделам..."
            className="pl-9 rounded-xl"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-help-search"
          />
        </div>

        {/* Tabs (when not searching) */}
        {!isSearching && (
          <div className="flex gap-2 flex-wrap">
            {[
              { id: "start", label: "С чего начать", icon: Sparkles },
              { id: "guide", label: "Разделы", icon: BookOpen },
              { id: "faq", label: "Вопросы и ответы", icon: HelpCircle },
              { id: "ai", label: "ИИ-помощник", icon: Bot, highlight: true },
              { id: "support", label: "Поддержка", icon: LifeBuoy, badge: myTickets.filter((t: any) => t.status === 'answered').length || undefined },
            ].map(tab => {
              const Icon = tab.icon;
              const isHighlight = (tab as any).highlight;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all border",
                    activeTab === tab.id
                      ? isHighlight
                        ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white border-transparent shadow-sm"
                        : "bg-primary text-primary-foreground border-primary shadow-sm"
                      : isHighlight
                        ? "border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                        : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {'badge' in tab && tab.badge ? (
                    <span className="ml-0.5 rounded-full bg-blue-500 text-white text-[10px] w-4 h-4 flex items-center justify-center shrink-0">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {/* Getting Started */}
        {!isSearching && activeTab === "start" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Быстрый старт — 5 шагов</h3>
              <Badge variant="secondary" className="text-xs">5 минут</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Следуйте этим шагам чтобы начать работу с платформой. После их выполнения вы сможете полностью управлять учениками, расписанием и финансами.
            </p>
            <div className="space-y-3">
              {QUICK_STEPS.map((step, idx) => (
                <QuickStartCard key={idx} step={step} idx={idx} />
              ))}
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">После старта вы сможете:</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 ml-6">
                <li className="flex items-center gap-1.5"><ArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />Автоматически отслеживать баланс каждого ученика</li>
                <li className="flex items-center gap-1.5"><ArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />Видеть доходы за месяц и прогнозировать заработок</li>
                <li className="flex items-center gap-1.5"><ArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />Давать домашние задания с ИИ-помощником</li>
                <li className="flex items-center gap-1.5"><ArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />Проводить видеоуроки прямо из платформы (BBB)</li>
                <li className="flex items-center gap-1.5"><ArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />Давать ученикам доступ к их личному кабинету</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={() => setLocation("/students")}>
                <Users className="h-4 w-4" /> Начать — Добавить ученика
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setActiveTab("guide")}>
                <BookOpen className="h-4 w-4" /> Все разделы
              </Button>
            </div>
          </div>
        )}

        {/* Sections Guide */}
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
                <p className="text-xs mt-1">Попробуйте другие слова или посмотрите раздел «Вопросы и ответы»</p>
              </div>
            )}
          </div>
        )}

        {/* FAQ */}
        {!isSearching && activeTab === "faq" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Часто задаваемые вопросы</h3>
            </div>
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-4">
                {FAQ.map((item, idx) => (
                  <FaqItem key={idx} q={item.q} a={item.a} idx={idx} />
                ))}
              </CardContent>
            </Card>
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-center">
              <Star className="h-5 w-5 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-medium">Не нашли ответ?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Используйте ИИ-ассистент в разделе «ИИ» — он поможет разобраться с любым вопросом.
              </p>
              <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setLocation("/ai")}>
                <Bot className="h-3.5 w-3.5" /> Открыть ИИ-ассистент
              </Button>
            </div>
          </div>
        )}

        {/* AI Assistant */}
        {!isSearching && activeTab === "ai" && (
          <div className="space-y-4" data-testid="section-ai-assistant">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-background to-cyan-500/8 p-5">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <Sparkles className="absolute right-8 top-4 h-5 w-5 text-violet-400/20 rotate-12" />
                <Sparkles className="absolute right-20 bottom-4 h-3 w-3 text-cyan-400/20 -rotate-6" />
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-500/5 blur-3xl" />
              </div>
              <div className="flex items-start gap-4 relative">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold">ИИ-помощник платформы</h3>
                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-violet-500/15 text-violet-700 border-0">Beta</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Знаю всё о платформе «Твой Вектор». Задавайте вопросы — отвечу быстро и по делу.
                  </p>
                </div>
              </div>
            </div>

            {/* Chat area */}
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden flex flex-col" style={{ height: "420px" }}>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {aiMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-500/10">
                      <MessageCircle className="h-7 w-7 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Задайте вопрос о платформе</p>
                      <p className="text-xs text-muted-foreground mt-1">Я отвечу на основе базы знаний «Твой Вектор»</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 w-full max-w-md">
                      {SUGGESTED_QUESTIONS.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => sendAiMessage(q)}
                          className="text-left text-xs px-3 py-2 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
                          data-testid={`btn-suggested-q-${i}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {aiMessages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
                        data-testid={`chat-msg-${i}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 mt-0.5">
                            <Bot className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted/60 text-foreground rounded-tl-sm border border-border/30"
                        )}>
                          {msg.content}
                        </div>
                        {msg.role === "user" && (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 mt-0.5">
                            <span className="text-[10px] font-bold text-primary">Я</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {aiLoading && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 justify-start">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500">
                          <Bot className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="flex items-center gap-1.5 bg-muted/60 rounded-2xl rounded-tl-sm border border-border/30 px-4 py-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </motion.div>
                    )}
                    <div ref={aiChatEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-border/50 bg-background/60 p-3">
                <form
                  onSubmit={e => { e.preventDefault(); sendAiMessage(); }}
                  className="flex gap-2"
                >
                  <Input
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    placeholder="Задайте вопрос о платформе..."
                    className="flex-1 rounded-xl bg-muted/40 border-border/40"
                    disabled={aiLoading}
                    data-testid="input-ai-chat"
                  />
                  <VoiceInputButton
                    onTranscript={(t) => setAiInput(m => m ? (m.trimEnd() + " " + t) : t)}
                    className="rounded-xl shrink-0"
                    data-testid="button-voice-ai-help"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!aiInput.trim() || aiLoading}
                    className="rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:opacity-90 border-0 text-white shrink-0"
                    data-testid="btn-ai-send"
                  >
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  </Button>
                </form>
                {aiMessages.length > 0 && (
                  <button
                    onClick={() => setAiMessages([])}
                    className="mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="btn-ai-clear"
                  >
                    Очистить историю
                  </button>
                )}
              </div>
            </div>

            {/* Hint */}
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5 text-violet-500 shrink-0" />
              <span>ИИ отвечает на основе базы знаний платформы. Для технических проблем используйте вкладку «Поддержка».</span>
            </div>
          </div>
        )}

        {/* Support Tickets */}
        {!isSearching && activeTab === "support" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Мои обращения</h3>
              </div>
              <Button size="sm" className="gap-2" onClick={() => setShowNewTicket(v => !v)} data-testid="button-new-ticket">
                <Plus className="h-4 w-4" />
                Новое обращение
              </Button>
            </div>

            {/* New ticket form */}
            <AnimatePresence>
              {showNewTicket && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Card className="rounded-2xl border-primary/30 bg-primary/5">
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-medium">Новое обращение в поддержку</p>
                      <Input
                        placeholder="Тема обращения..."
                        value={newSubject}
                        onChange={e => setNewSubject(e.target.value)}
                        data-testid="input-ticket-subject"
                      />
                      <textarea
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none min-h-[80px]"
                        placeholder="Опишите вашу проблему или вопрос..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        data-testid="input-ticket-message"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setShowNewTicket(false); setNewSubject(""); setNewMessage(""); }}>Отмена</Button>
                        <Button
                          size="sm"
                          disabled={creatingTicket || !newSubject.trim() || !newMessage.trim()}
                          data-testid="button-create-ticket"
                          onClick={async () => {
                            setCreatingTicket(true);
                            try {
                              const res = await fetch('/api/support/tickets', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ subject: newSubject, message: newMessage }),
                              });
                              if (!res.ok) throw new Error('Ошибка создания');
                              const ticket = await res.json();
                              setNewSubject(""); setNewMessage(""); setShowNewTicket(false);
                              await refetchTickets();
                              setSelectedTicketId(ticket.id);
                              toast.success("Обращение отправлено");
                            } catch (e: any) {
                              toast.error(e.message);
                            } finally {
                              setCreatingTicket(false);
                            }
                          }}
                        >
                          {creatingTicket ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                          Отправить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {ticketsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : myTickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <LifeBuoy className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>У вас ещё нет обращений</p>
                <p className="text-xs mt-1">Нажмите «Новое обращение» чтобы написать в поддержку</p>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4 items-start">
                {/* List */}
                <div className="space-y-2">
                  {myTickets.map((t: any) => (
                    <Card
                      key={t.id}
                      className={`rounded-xl border-border/50 cursor-pointer transition-all ${selectedTicketId === t.id ? 'border-primary ring-1 ring-primary/30' : 'hover:border-border'}`}
                      onClick={() => setSelectedTicketId(t.id)}
                      data-testid={`card-ticket-${t.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm truncate flex-1">{t.subject}</p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${t.status === 'open' ? 'text-amber-600 border-amber-500/30' : t.status === 'answered' ? 'text-blue-600 border-blue-500/30' : 'text-muted-foreground'}`}
                          >
                            {t.status === 'open' ? 'Ожидает' : t.status === 'answered' ? 'Ответ получен' : 'Закрыт'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(t.updatedAt).toLocaleDateString('ru-RU')}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Chat */}
                {selectedTicketId && ticketDetail ? (
                  <Card className="rounded-xl border-border/50">
                    <CardContent className="p-4 space-y-3">
                      <div className="font-medium text-sm">{ticketDetail.ticket?.subject}</div>
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {ticketDetail.messages?.map((msg: any) => (
                          <div key={msg.id} className={`flex gap-2 ${msg.role === 'admin' ? 'justify-end' : ''}`}>
                            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              <p className="text-[10px] font-medium mb-0.5 opacity-70">{msg.role === 'admin' ? 'Поддержка' : 'Вы'}</p>
                              <p>{msg.content}</p>
                            </div>
                          </div>
                        ))}
                        {(!ticketDetail.messages || ticketDetail.messages.length === 0) && (
                          <p className="text-xs text-muted-foreground text-center py-3">Нет сообщений</p>
                        )}
                      </div>
                      {ticketDetail.ticket?.status !== 'closed' && (
                        <div className="flex gap-2 pt-2 border-t border-border/40">
                          <input
                            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                            placeholder="Написать сообщение..."
                            value={ticketReply}
                            onChange={e => setTicketReply(e.target.value)}
                            data-testid="input-reply"
                          />
                          <VoiceInputButton
                            onTranscript={(t) => setTicketReply(m => m ? (m.trimEnd() + " " + t) : t)}
                            size="sm"
                            data-testid="button-voice-ticket-reply"
                          />
                          <Button
                            size="sm"
                            disabled={sendingReply || !ticketReply.trim()}
                            data-testid="button-send-reply"
                            onClick={async () => {
                              setSendingReply(true);
                              try {
                                await fetch(`/api/support/tickets/${selectedTicketId}/messages`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ content: ticketReply }),
                                });
                                setTicketReply("");
                                queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", selectedTicketId, "messages"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
                              } catch (e: any) {
                                toast.error(e.message);
                              } finally {
                                setSendingReply(false);
                              }
                            }}
                          >
                            {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}
                      {ticketDetail.ticket?.status === 'closed' && (
                        <p className="text-xs text-muted-foreground text-center py-2 border-t border-border/40 mt-2">Обращение закрыто</p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center text-muted-foreground text-sm py-10 rounded-xl border border-border/40">
                    <div className="text-center">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p>Выберите обращение</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
