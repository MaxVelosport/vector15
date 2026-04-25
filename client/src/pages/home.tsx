import { useState, useMemo } from "react";
import { format, addDays, subDays, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer } from "recharts";
import { formatInTimeZone } from "date-fns-tz";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  GraduationCap,
  LayoutGrid,
  Loader2,
  MessageSquare,
  MoveRight,
  Plus,
  Sparkles,
  Users,
  Bot,
  TrendingUp,
  Video,
  Wallet,
  Star,
  X,
  Zap,
  Info,
  Banknote,
  AlertCircle,
  Target,
  Pencil,
  Flame,
  Trophy,
  Award,
  Crown,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { ExportDataModal } from "@/components/export-data-modal";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard-layout";
import { TelegramConnectBanner } from "@/components/telegram-connect-banner";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { useAuth } from "@/hooks/use-auth";
import { OnboardingTour, useOnboarding } from "@/components/onboarding-tour";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { SUBSCRIPTION_LIMITS } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useStudents,
  useLessons,
  useHomework,
  useUpdateLesson,
  useCreateLesson,
  usePayments,
  useMonthlyGoals,
  useUpdateMonthlyGoals,
} from "@/hooks/use-tutor-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Lesson } from "@shared/schema";

import { useDocumentTitle } from "@/hooks/use-document-title";
function moneyRub(amount: number) {
  const sign = amount < 0 ? "\u2212" : "";
  const v = Math.abs(amount);
  return `${sign}${v.toLocaleString("ru-RU")} \u20BD`;
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  if (abs >= 11 && abs <= 19) return many;
  const last = abs % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function getTierInfo(subscription: string) {
  const tier = subscription as keyof typeof SUBSCRIPTION_LIMITS;
  const limits = SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.free;
  return limits;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 17) return "Добрый день";
  if (hour >= 17 && hour < 22) return "Добрый вечер";
  return "Доброй ночи";
}

type ChangelogRelease = {
  version: string;
  date: string;
  items: { tag: "new" | "fix" | "improve"; text: string; for?: "tutor" | "student" }[];
};

const changelog: ChangelogRelease[] = [
  {
    version: "3.8",
    date: "16 апреля 2026",
    items: [
      { tag: "new", text: "Раздел «Приведи друга» вынесен в боковое меню — реферальная программа теперь в один клик из любого экрана", for: "tutor" },
      { tag: "new", text: "Карточка для учеников в редакторе профиля — крупное фото с инициалами по умолчанию, превью имени, предметов и цены, кнопка «Открыть» для просмотра публичной страницы", for: "tutor" },
      { tag: "improve", text: "Публичная страница: вместо иконки диплома теперь крупные инициалы — выглядит профессионально, как в Telegram/Gmail", for: "tutor" },
    ],
  },
  {
    version: "3.7",
    date: "16 апреля 2026",
    items: [
      { tag: "new", text: "Отзывы учеников на публичной странице репетитора — рейтинг 1–5 звёзд, форма «Оставить отзыв», средняя оценка и счётчик отзывов", for: "tutor" },
      { tag: "new", text: "Модерация отзывов в профиле — новый блок «Отзывы учеников» со счётчиками «Ожидают» / «Опубликовано», кнопками «Одобрить» / «Скрыть» / «Удалить»", for: "tutor" },
      { tag: "fix", text: "Уведомления больше не спамят: напоминание о занятии создаётся только за 90 минут до начала и только один раз — никаких «Через ~22ч / ~23ч / ~24ч»", for: "tutor" },
      { tag: "improve", text: "Текст напоминаний стал человеческим: «Математика» — сегодня в 14:30 (через 1 ч 20 мин)" },
      { tag: "improve", text: "Прочитанные уведомления старше 7 дней удаляются автоматически — почтовый ящик не разрастается", for: "tutor" },
      { tag: "fix", text: "Стрелочки «Отменить» / «Повторить» на доске теперь работают — Excalidraw корректно откатывает действия", for: "tutor" },
    ],
  },
  {
    version: "3.6",
    date: "16 апреля 2026",
    items: [
      { tag: "improve", text: "Оплата только через «Финансы» — кнопка «Опл.» убрана из журнала и расписания занятий. Все платежи вносятся в одном месте для порядка в учёте", for: "tutor" },
      { tag: "new", text: "Лендинг на главной странице — незарегистрированные пользователи видят маркетинговый экран с описанием платформы и кнопками «Войти» / «Начать бесплатно»", for: "tutor" },
      { tag: "new", text: "Согласие на обработку персональных данных (152-ФЗ) при регистрации — обязательный чекбокс со ссылками на публичную оферту и политику конфиденциальности", for: "tutor" },
      { tag: "new", text: "Почтовые уведомления: info@tvoyvector.ru — сброс пароля и новости платформы; support@tvoyvector.ru — тикеты поддержки и ответы администратора", for: "tutor" },
      { tag: "new", text: "Вебхук ЮKassa активирован для production-домена — статусы онлайн-платежей обновляются автоматически (payment.succeeded, canceled, refund и др.)", for: "tutor" },
    ],
  },
  {
    version: "3.5",
    date: "8 апреля 2026",
    items: [
      { tag: "new", text: "Кнопка «Изменить» в расписании (дневной вид) — разворачивает панель прямо в слоте: статус урока, тема, оценка ученику, перенос на другую дату и время, удаление с подтверждением", for: "tutor" },
      { tag: "fix", text: "Умный баланс: при нехватке средств урок автоматически помечается как «не оплаченный» ✗ (оранжевый); при пополнении — возвращается в «оплаченный» ✓ (зелёный). Учёт теперь точно совпадает с тем, что видно на экране", for: "tutor" },
      { tag: "fix", text: "При снижении баланса самые свежие оплаченные занятия автоматически переводятся в «долг» — система сама корректирует статусы без ручного вмешательства", for: "tutor" },
    ],
  },
  {
    version: "3.4",
    date: "8 апреля 2026",
    items: [
      { tag: "new", text: "Выбор основной конференции и доски ★ в профиле ученика — кликните на звёздочку рядом с инструментом, чтобы назначить его «По умолчанию»" },
      { tag: "new", text: "В кабинете ученика инструменты с меткой «Основная» идут первыми, запасные — ниже с меткой «Запасная». Если только один инструмент — всё как прежде" },
      { tag: "new", text: "Обе доски (встроенная и внешняя) теперь отображаются одновременно в профиле ученика — можно назначить любую основной" },
      { tag: "improve", text: "Блок «Инструменты занятия» в профиле ученика стал чище: текущая «Основная» выделена цветной кнопкой, лишние подсказки убраны" },
    ],
  },
  {
    version: "3.3",
    date: "7 апреля 2026",
    items: [
      { tag: "fix", text: "Вход в BigBlueButton из кабинета ученика работает корректно — больше нет ошибки при переходе в конференцию" },
      { tag: "new", text: "«Наша доска» всегда доступна ученику на главной — теперь не нужно ничего дополнительно настраивать в профиле" },
      { tag: "improve", text: "Инструменты в кабинете ученика разделены по разделам и снабжены пояснениями — ученик сразу видит, что к чему и как подключиться" },
    ],
  },
  {
    version: "3.2",
    date: "1 апреля 2026",
    items: [
      { tag: "fix", text: "Серия занятий (🔥) больше не сбрасывается в начале месяца — «ожидающие» уроки теперь не прерывают серию" },
      { tag: "fix", text: "Серия правильно пропускает дни с незакрытыми уроками, прерываясь только на днях, где все занятия отменены" },
    ],
  },
  {
    version: "3.1",
    date: "28 марта 2026",
    items: [
      { tag: "new", text: "Кнопка «Обучение» у ученика теперь ведёт на страницу прогресса — XP, уровни, стрики и достижения вместо расписания занятий" },
      { tag: "improve", text: "База знаний ученика расширена: новые разделы «Прогресс и достижения» и «Задачник ЕГЭ», расширенный FAQ с 14 вопросами" },
      { tag: "improve", text: "Раздел «Что нового» у ученика обновлён — версии 2.9 и 3.0 с описанием последних улучшений" },
    ],
  },
  {
    version: "3.0",
    date: "28 марта 2026",
    items: [
      { tag: "new", text: "Конференции и Доски в шапке — цветные пилюли: синяя (видеозвонки) и фиолетовая (рабочие пространства) с тултипами и кнопкой + для создания" },
      { tag: "new", text: "Переключатели разделов рядом с заголовком страницы: [Занятия] ↔ [Расписание] и [Финансы] ↔ [Аналитика] — удобный переход без меню" },
      { tag: "new", text: "Мотивирующие элементы на главной: серия занятий 🔥, достижения, прогресс-бар опыта и счётчик всех проведённых уроков" },
      { tag: "improve", text: "База знаний в тарифах полностью переделана — 12 тематических карточек по всем разделам с описанием возможностей" },
      { tag: "improve", text: "Подсказки на всех страницах: База заданий, Тарифы, Чат — описание возможностей и советы прямо на странице" },
    ],
  },
  {
    version: "2.9",
    date: "26 марта 2026",
    items: [
      { tag: "improve", text: "Ученик: 2–4 ссылки на каждое занятие — внешняя конференция, BBB, внешняя доска и внутренняя доска. Нажатие открывает сразу" },
      { tag: "fix", text: "Комбо занятий подряд теперь правильно сбрасывается при отменённых уроках между завершёнными" },
      { tag: "improve", text: "В виде «День» у каждого занятия кликабельные бейджи всех ссылок, в «Неделе» — цветные точки" },
    ],
  },
  {
    version: "2.8",
    date: "26 марта 2026",
    items: [
      { tag: "new", text: "Страница «Чат» — полноценная переписка с учениками: список с непрочитанными, поиск, история сообщений" },
      { tag: "improve", text: "Загрузка файлов в домашних заданиях: принимаются все форматы — PDF, документы, архивы, не только фото (до 20 МБ)" },
      { tag: "improve", text: "Кнопка BBB-конференции у ученика теперь отображается всегда — даже если задана внешняя ссылка на конференцию" },
      { tag: "improve", text: "Меню ученика стало компактнее — убраны неиспользуемые вкладки «Конференция» и «Заметки»" },
    ],
  },
  {
    version: "2.7",
    date: "26 марта 2026",
    items: [
      { tag: "improve", text: "Ученик: кнопки конференции и доски теперь видны в карточке ближайшего занятия всегда — не только сегодня" },
      { tag: "improve", text: "Ученик: в списке занятий ссылки отображаются автоматически для всех предстоящих уроков без тыканья" },
      { tag: "improve", text: "Иконки внешней конференции и доски теперь различаются: синяя Video — конференция, фиолетовая Pencil — доска" },
    ],
  },
  {
    version: "2.6",
    date: "26 марта 2026",
    items: [
      { tag: "new", text: "Раздел «Доски» — управление досками всех учеников: статус, дата последнего изменения, очистка" },
      { tag: "new", text: "Временные доски — создайте разовую доску с уникальной ссылкой без привязки к ученику" },
      { tag: "improve", text: "Видеоконференции BBB: автоматическое завершение через 30 минут после того, как все покинули комнату" },
      { tag: "improve", text: "Ученик: кнопка «Войти в конференцию» теперь видна на главной, даже если настроен только BBB без внешней ссылки" },
    ],
  },
  {
    version: "2.5",
    date: "26 марта 2026",
    items: [
      { tag: "new", text: "Кнопка «Профиль ученика» в журнале занятий (недельный и дневной вид) — переход к профилю одним кликом" },
      { tag: "new", text: "Отменённые занятия в расписании: серые слоты с кнопкой «Добавить» для переноса урока" },
      { tag: "new", text: "Раздельное копирование логина и пароля ученика — отдельные иконки и кнопка «Скопировать оба»" },
      { tag: "fix", text: "Баланс ученика: правильный эффективный баланс = сумма оплат − стоимость проведённых уроков" },
      { tag: "improve", text: "Профиль ученика открывается по URL (?open=ID) — ссылка из занятия ведёт прямо в карточку ученика" },
    ],
  },
  {
    version: "2.4",
    date: "21 марта 2026",
    items: [
      { tag: "new", text: "Кнопка «Запланировать занятие» на главной — создать урок в 2 клика прямо с главного экрана" },
      { tag: "new", text: "Экспорт в Excel: финансовый отчёт (3 листа) в разделе Финансы, список учеников в разделе Ученики" },
      { tag: "new", text: "Фото профиля: загрузка аватарок для каждого ученика и для репетитора (кликните на фото-кружок)" },
      { tag: "new", text: "История изменений статусов занятий в профиле ученика (раскрываемый блок)" },
      { tag: "new", text: "Доска: архив досок — сохраните текущую доску и восстановите любую версию" },
      { tag: "new", text: "Доска: шаблон «Твой Вектор» — 4 рабочие колонки с фирменным оформлением" },
      { tag: "new", text: "Доска: панель геометрических фигур — вставка треугольника, ромба, осей, числовой прямой и других фигур одним кликом" },
      { tag: "fix", text: "Доска: исправлен экспорт PNG — кнопка «Сохранить PNG» теперь работает корректно" },
    ],
  },
  {
    version: "2.3",
    date: "18 марта 2026",
    items: [
      { tag: "new", text: "Итоговая строка в виджете дохода: всего проведено X₽ из Y₽ возможных с процентом выполнения" },
      { tag: "fix", text: "Кэширование index.html исправлено — браузер теперь всегда загружает актуальную версию приложения" },
    ],
  },
  {
    version: "2.2",
    date: "18 марта 2026",
    items: [
      { tag: "new", text: "Виджет «Доход за сегодня» на главной — оплачено, должны, ещё можно заработать" },
      { tag: "new", text: "Занятия у ученика: два раздела «Предстоящие» и «История» с пагинацией по 5 штук" },
      { tag: "fix", text: "Баланс ученика: оплаченные занятия теперь учитываются как полученные деньги — долг только за реально неоплаченные уроки" },
      { tag: "improve", text: "Сессия не обрывается от бездействия — вход сохраняется на год, автопродление при каждом действии" },
    ],
  },
  {
    version: "2.1",
    date: "14 марта 2026",
    items: [
      { tag: "new", text: "Перенос занятий прямо с главной — кнопка на каждом уроке в расписании дня" },
      { tag: "new", text: "Удаление платежей — откат ошибочных оплат с возвратом статуса занятия" },
      { tag: "new", text: "Система баланса ученика — пополнение, списание, редактирование" },
      { tag: "improve", text: "Обновлённый раздел «Что нового» с полной историей разработки" },
    ],
  },
  {
    version: "2.0",
    date: "13 марта 2026",
    items: [
      { tag: "new", text: "Светлая боковая панель с hi-tech дизайном — сетка, свечение, градиенты" },
      { tag: "new", text: "Автосинхронизация платежей — автоматическое создание записей для оплаченных уроков" },
      { tag: "new", text: "Финансы — отдельно упущенная прибыль (отмены) и ожидающие оплаты" },
      { tag: "new", text: "Подсказки и инструкции на всех экранах для новых пользователей" },
      { tag: "improve", text: "Более информативные показатели на главном экране" },
    ],
  },
  {
    version: "1.9",
    date: "10 марта 2026",
    items: [
      { tag: "new", text: "Новая система статусов: Проведено (✓/✗) и Отменено (✓/✗) с единым управлением" },
      { tag: "new", text: "Управление занятиями прямо на главной — кнопки статусов для текущих уроков" },
      { tag: "new", text: "Ссылки на конференцию и доску в карточке «Следующее занятие» и расписании дня" },
      { tag: "improve", text: "Обновлённые фильтры расписания: Проведено ✓/✗, Отменено ✓/✗" },
    ],
  },
  {
    version: "1.8",
    date: "3 марта 2026",
    items: [
      { tag: "new", text: "Ретрозаполнение — массовое добавление прошедших занятий по расписанию" },
      { tag: "new", text: "Автоматическая генерация логина и пароля при создании ученика" },
      { tag: "fix", text: "Исправлен массовый перенос занятий (проблема с часовыми поясами)" },
    ],
  },
  {
    version: "1.7",
    date: "20 февраля 2026",
    items: [
      { tag: "new", text: "Расширенная аналитика — рейтинг учеников, графики по дням недели, прогноз дохода" },
      { tag: "new", text: "Расписание в профиле ученика с массовым переносом занятий" },
      { tag: "improve", text: "Финансы — 4 карточки с метриками, отслеживание долгов" },
      { tag: "improve", text: "Расписание — дневной вид с поддержкой 90/120-минутных блоков" },
    ],
  },
  {
    version: "1.6",
    date: "5 февраля 2026",
    items: [
      { tag: "new", text: "ИИ-пакеты — покупка дополнительных кредитов для ИИ-помощника" },
      { tag: "new", text: "Мониторинг лимита учеников с предупреждениями" },
      { tag: "improve", text: "Обновлённые тарифы: Старт / Базовый / Про" },
      { tag: "new", text: "Дополнительные слоты для учеников сверх тарифа" },
    ],
  },
  {
    version: "1.5",
    date: "18 января 2026",
    items: [
      { tag: "new", text: "Домашние задания — текст, фото, ссылки, оценки 0–100" },
      { tag: "new", text: "ИИ-куратор — 3 модели (GPT-4o, GPT-4o mini, DeepSeek)" },
      { tag: "improve", text: "LaTeX/Markdown в ответах ИИ — формулы и форматирование" },
    ],
  },
  {
    version: "1.4",
    date: "22 декабря 2025",
    items: [
      { tag: "new", text: "Портал ученика — личный кабинет с уроками и домашкой" },
      { tag: "new", text: "Магические ссылки для быстрого входа учеников" },
      { tag: "new", text: "Bot API для интеграции с Telegram через n8n" },
    ],
  },
  {
    version: "1.3",
    date: "1 декабря 2025",
    items: [
      { tag: "new", text: "Перенос на Supabase — надёжная облачная база данных" },
      { tag: "new", text: "Ссылки на конференцию и доску для каждого ученика" },
      { tag: "improve", text: "Поле «Родитель» и комментарий в карточке ученика" },
    ],
  },
  {
    version: "1.2",
    date: "8 ноября 2025",
    items: [
      { tag: "new", text: "Расписание — недельный и месячный виды с drag-and-drop" },
      { tag: "new", text: "Система предметов: математика, физика, информатика, английский" },
      { tag: "improve", text: "Адаптивный дизайн для мобильных устройств" },
    ],
  },
  {
    version: "1.1",
    date: "15 октября 2025",
    items: [
      { tag: "new", text: "Карточки учеников — профиль, контакты, история занятий" },
      { tag: "new", text: "Базовая система финансов — учёт поступлений и долгов" },
      { tag: "improve", text: "Тёмная тема и кастомизация интерфейса" },
    ],
  },
  {
    version: "1.0",
    date: "20 сентября 2025",
    items: [
      { tag: "new", text: "Запуск платформы «Твой Вектор» — первая версия CRM для репетиторов" },
      { tag: "new", text: "Регистрация и авторизация, личный кабинет репетитора" },
      { tag: "new", text: "Базовое расписание занятий и список учеников" },
    ],
  },
];

const TAG_STYLES: Record<string, { label: string; className: string }> = {
  new: { label: "Новое", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  fix: { label: "Фикс", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
  improve: { label: "Улучшено", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
};

export default function Home() {
  useDocumentTitle("Главная");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { showOnboarding, completeOnboarding, resetOnboarding } = useOnboarding("tutor");

  const { data: studentsData, isLoading: studentsLoading } = useStudents();
  const { data: lessonsData, isLoading: lessonsLoading } = useLessons();
  const { data: homeworkData, isLoading: homeworkLoading } = useHomework();
  const { data: paymentsData } = usePayments();
  const updateLesson = useUpdateLesson();
  const [pendingLessonAction, setPendingLessonAction] = useState<{ id: string; action: "done" | "cancel" } | null>(null);
  const createLesson = useCreateLesson();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [qaStudentId, setQaStudentId] = useState("");
  const [qaDate, setQaDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [qaTime, setQaTime] = useState("10:00");
  const [qaDuration, setQaDuration] = useState("60");
  const [qaTopic, setQaTopic] = useState("");
  const [rescheduleLesson, setRescheduleLesson] = useState<Lesson | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [showGoalsDialog, setShowGoalsDialog] = useState(false);
  const [goalsLessons, setGoalsLessons] = useState("");
  const [goalsIncome, setGoalsIncome] = useState("");
  const [goalsStudents, setGoalsStudents] = useState("");
  const { data: monthlyGoals } = useMonthlyGoals();
  const updateMonthlyGoals = useUpdateMonthlyGoals();

  const handleQuickAddLesson = async () => {
    if (!qaStudentId || !qaDate || !qaTime) { toast.error("Выберите ученика и укажите дату/время"); return; }
    try {
      const scheduledAt = new Date(`${qaDate}T${qaTime}:00`);
      const student = (studentsData ?? []).find((s: any) => s.id === qaStudentId);
      await createLesson.mutateAsync({
        studentId: qaStudentId,
        tutorId: undefined as any,
        scheduledAt,
        durationMinutes: parseInt(qaDuration) || 60,
        topic: qaTopic.trim() || undefined,
        status: "scheduled",
      });
      toast.success("Занятие добавлено");
      setShowQuickAdd(false);
      setQaTopic("");
    } catch {
      toast.error("Ошибка при создании занятия");
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleLesson || !rescheduleDate || !rescheduleTime) return;
    try {
      const newScheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
      await updateLesson.mutateAsync({
        id: rescheduleLesson.id,
        updates: { scheduledAt: newScheduledAt },
      });
      toast.success("Занятие перенесено");
      setRescheduleLesson(null);
    } catch {
      toast.error("Ошибка при переносе занятия");
    }
  };

  const openReschedule = (lesson: any) => {
    const d = new Date(lesson.scheduledAt);
    setRescheduleDate(format(d, "yyyy-MM-dd"));
    setRescheduleTime(format(d, "HH:mm"));
    setRescheduleLesson(lesson);
  };

  const { data: studentSlotsData } = useQuery<{
    activeStudents: number;
    maxStudents: number;
    baseSlots: number;
    extraSlots: number;
    isAtLimit: boolean;
    isNearLimit: boolean;
  }>({ queryKey: ["/api/student-slots"] });

  const { data: tgStatus } = useQuery<{
    botRunning: boolean;
    botUsername: string | null;
    tutorLinked: boolean;
  }>({ queryKey: ["/api/telegram/status"], refetchOnWindowFocus: false });

  const { data: bbbConferences = [] } = useQuery<Array<{
    id: string; title: string; studentId: string | null; meetingId: string; isOneTime: boolean; isRunning: boolean; createdAt: string;
  }>>({ queryKey: ["/api/bbb/conferences"] });

  const [joiningBbbId, setJoiningBbbId] = useState<string | null>(null);
  const handleJoinBbb = async (id: string) => {
    setJoiningBbbId(id);
    try {
      const res = await fetch(`/api/bbb/conferences/${id}/join`, { credentials: "include" });
      const data = await res.json();
      if (data.url) { window.open(data.url, "_blank"); }
      else { toast.error(data.error || "Ошибка подключения"); }
    } catch { toast.error("Ошибка подключения"); }
    finally { setJoiningBbbId(null); }
  };

  const [recreatingBbbId, setRecreatingBbbId] = useState<string | null>(null);
  const handleRecreateBbb = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecreatingBbbId(id);
    try {
      const res = await fetch(`/api/bbb/conferences/${id}/reset`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/bbb/conferences"] });
        toast.success("Комната пересоздана — можно подключаться заново");
      } else { toast.error(data.error || "Ошибка пересоздания"); }
    } catch { toast.error("Ошибка соединения"); }
    finally { setRecreatingBbbId(null); }
  };

  const students = useMemo(() => studentsData ?? [], [studentsData]);
  const lessons = useMemo(() => lessonsData?.map(l => ({
    ...l,
    scheduledAt: new Date(l.scheduledAt)
  })) ?? [], [lessonsData]);
  const homework = useMemo(() => homeworkData ?? [], [homeworkData]);
  const payments = useMemo(() => paymentsData ?? [], [paymentsData]);

  const isBillableHome = (l: any) =>
    (l.status === "completed" && l.attendance === "attended") ||
    (l.status === "cancelled" && l.attendance === "missed_paid");

  const getEffectiveBalance = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const totalPaid = payments.filter(p => p.studentId === studentId).reduce((sum, p) => sum + p.amount, 0);
    const totalCost = lessons.filter(l => l.studentId === studentId && isBillableHome(l))
      .reduce((sum, l) => sum + Math.round((student?.pricePerLesson ?? 0) * (l.durationMinutes ?? 60) / 60), 0);
    return totalPaid - totalCost;
  };

  const isLoading = studentsLoading || lessonsLoading || homeworkLoading;

  const activeStudents = students.filter((s) => s.isActive);
  const userTimezone = user?.timezone || "Europe/Moscow";
  const tierInfo = getTierInfo(user?.subscription || "free");

  const todayStr = formatInTimeZone(new Date(), userTimezone, "yyyy-MM-dd");

  const todayLessons = lessons
    .filter((l) => formatInTimeZone(l.scheduledAt, userTimezone, "yyyy-MM-dd") === todayStr)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const completedToday = todayLessons.filter(l => l.status === "completed").length;
  const pendingToday = todayLessons.filter(l => l.status === "pending").length;

  const allPendingToday = todayLessons.filter((l) => l.status === "pending");
  const nextLesson = allPendingToday[0];
  const nextLessonStudent = students.find((s) => s.id === nextLesson?.studentId);
  const rawMinutesToNext = nextLesson
    ? Math.round((nextLesson.scheduledAt.getTime() - Date.now()) / 60000)
    : 0;
  const isLessonOngoing = rawMinutesToNext <= 0 && !!nextLesson;
  const minutesToNext = Math.max(0, rawMinutesToNext);

  // Next lesson after the currently ongoing one
  const nextAfterCurrent = isLessonOngoing ? allPendingToday[1] : null;
  const nextAfterStudent = nextAfterCurrent ? students.find((s) => s.id === nextAfterCurrent.studentId) : null;
  const minutesToNextAfter = nextAfterCurrent
    ? Math.max(0, Math.round((nextAfterCurrent.scheduledAt.getTime() - Date.now()) / 60000))
    : 0;

  const formatTimeUntil = (minutes: number) => {
    if (minutes === 0) return "сейчас идёт";
    if (minutes < 60) return `через ${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `через ${hours} ч ${mins} мин` : `через ${hours} ч`;
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const isBillable = (l: any) =>
    (l.status === "completed" && ["attended", "attended_unpaid", "missed_paid"].includes(l.attendance || "")) ||
    (l.status === "cancelled" && l.attendance === "missed_paid");
  const calcCost = (l: any, s: any) => {
    if (!s) return 0;
    return Math.round(s.pricePerLesson * (l.durationMinutes || 60) / 60);
  };

  const todayIncome = todayLessons
    .filter(isBillable)
    .reduce((sum, l) => {
      const student = students.find(s => s.id === l.studentId);
      return sum + calcCost(l, student);
    }, 0);

  const todayEarned = todayLessons
    .filter(l => l.status === "completed" && l.attendance === "attended")
    .reduce((sum, l) => sum + calcCost(l, students.find(s => s.id === l.studentId)), 0);

  const todayOwed = todayLessons
    .filter(l => l.status === "completed" && l.attendance === "attended_unpaid")
    .reduce((sum, l) => sum + calcCost(l, students.find(s => s.id === l.studentId)), 0);

  const todayPotential = todayLessons
    .filter(l => l.status === "pending")
    .reduce((sum, l) => sum + calcCost(l, students.find(s => s.id === l.studentId)), 0);

  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const allMonthLessons = lessons.filter(l => l.scheduledAt >= monthStart && l.scheduledAt <= monthEnd);
  const monthLessons = allMonthLessons.filter(l => isBillable(l));
  const monthIncome = monthLessons.reduce((sum, l) => {
    const student = students.find(s => s.id === l.studentId);
    return sum + calcCost(l, student);
  }, 0);

  const completedMonthCount = allMonthLessons.filter(l => l.status === "completed" && ["attended", "attended_unpaid"].includes(l.attendance || "attended")).length;
  const missedPaidMonthCount = allMonthLessons.filter(l => l.status === "cancelled" && l.attendance === "missed_paid").length;
  const remainingMonthCount = allMonthLessons.filter(l => l.status === "pending").length;
  const cancelledFreeMonthCount = allMonthLessons.filter(l => l.status === "cancelled" && l.attendance === "missed").length;

  const expectedMonthIncome = allMonthLessons
    .filter(l => l.status === "pending")
    .reduce((sum, l) => {
      const student = students.find(s => s.id === l.studentId);
      return sum + calcCost(l, student);
    }, 0);

  const monthLost = allMonthLessons
    .filter(l => l.status === "cancelled" && l.attendance === "missed")
    .reduce((sum, l) => {
      const student = students.find(s => s.id === l.studentId);
      return sum + calcCost(l, student);
    }, 0);

  const monthMaxPotential = monthIncome + expectedMonthIncome + monthLost;

  const uncheckedHomework = homework.filter(h => h.status === "submitted").length;
  const studentsWithProgram = students.filter(s => (s as any).programData?.topics?.length > 0).length;

  const monthlyIncomeData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const mStart = startOfMonth(d);
      const mEnd = endOfMonth(d);
      const income = lessons
        .filter(l => l.scheduledAt >= mStart && l.scheduledAt <= mEnd && isBillable(l))
        .reduce((sum, l) => sum + calcCost(l, students.find(s => s.id === l.studentId)), 0);
      return { month: format(d, "LLL", { locale: ru }), income };
    });
  }, [lessons, students]);

  const [changelogIdx, setChangelogIdx] = useState(0);

  // Streak: consecutive "lesson days" going backward from today.
  // A day with ≥1 completed+attended lesson → counts (+1).
  // A day with ONLY pending lessons → skipped (not yet processed, doesn't break).
  // A day with lessons all cancelled/missed (no pending) → breaks streak.
  // A day with NO lessons at all → skipped (doesn't count, doesn't break).
  const streak = useMemo(() => {
    const todayStr = format(now, "yyyy-MM-dd");

    // Group past/today lessons by calendar date
    const byDay = new Map<string, typeof lessons>();
    for (const l of lessons) {
      if (l.scheduledAt > now) continue; // ignore future
      const key = format(l.scheduledAt, "yyyy-MM-dd");
      if (key > todayStr) continue;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(l);
    }

    // Sort lesson days descending (most recent first)
    const days = Array.from(byDay.keys()).sort().reverse();

    let count = 0;
    for (const day of days) {
      const dayLessons = byDay.get(day)!;
      const hasCompleted = dayLessons.some(
        l => l.status === "completed" && ["attended", "attended_unpaid"].includes(l.attendance || "")
      );
      if (hasCompleted) {
        count++;
      } else {
        // If the day has any pending lessons, skip it (not finalized yet — doesn't break streak)
        const hasPending = dayLessons.some(l => l.status === "pending");
        if (hasPending) continue;
        // All lessons on this day are cancelled/missed → streak broken
        break;
      }
    }
    return count;
  }, [lessons, now]);

  // All-time completed lessons
  const totalCompleted = useMemo(() =>
    lessons.filter(l => l.status === "completed" && ["attended", "attended_unpaid"].includes(l.attendance || "")).length,
    [lessons]
  );

  // XP level based on total completed (simple: 1 lesson = 10 XP, levels every 100 XP)
  const totalXP = totalCompleted * 10;
  const xpLevel = Math.floor(totalXP / 100) + 1;
  const xpProgress = totalXP % 100;

  // Achievement milestones
  const milestones = [10, 25, 50, 100, 200, 500];
  const nextMilestone = milestones.find(m => m > totalCompleted) ?? 1000;
  const prevMilestone = [...milestones].reverse().find(m => m <= totalCompleted) ?? 0;

  if (isLoading) {
    return (
      <DashboardLayout title="Главная" subtitle="Загрузка данных...">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const navItems = [
    {
      icon: Calendar,
      title: "Расписание",
      description: "Календарь, добавление занятий",
      tooltip: "Планируйте занятия, отслеживайте загруженность и управляйте расписанием в удобном календаре",
      href: "/schedule",
      color: "from-blue-500/10 to-cyan-500/5",
      iconColor: "text-blue-600 dark:text-blue-400",
      badge: todayLessons.length > 0 ? `${todayLessons.length} сегодня` : undefined,
    },
    {
      icon: BookOpen,
      title: "Занятия",
      description: "Сегодняшние уроки и посещаемость",
      tooltip: "Отмечайте посещаемость, ставьте оценки и ведите заметки по каждому уроку",
      href: "/lessons",
      color: "from-emerald-500/10 to-teal-500/5",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      badge: pendingToday > 0 ? `${pendingToday} ожидает` : undefined,
    },
    {
      icon: Users,
      title: "Ученики",
      description: "Профили, программы, ссылки",
      tooltip: "Управляйте базой учеников, создавайте индивидуальные программы и отслеживайте прогресс",
      href: "/students",
      color: "from-blue-500/10 to-cyan-500/5",
      iconColor: "text-blue-600 dark:text-cyan-400",
      badge: `${activeStudents.length} активных`,
    },
    {
      icon: GraduationCap,
      title: "Домашка",
      description: "Задания, проверка, оценки",
      tooltip: "Назначайте домашние задания, проверяйте работы учеников и давайте обратную связь",
      href: "/homework",
      color: "from-amber-500/10 to-orange-500/5",
      iconColor: "text-amber-600 dark:text-amber-400",
      badge: uncheckedHomework > 0 ? `${uncheckedHomework} на проверку` : undefined,
    },
    {
      icon: Bot,
      title: "ИИ-помощник",
      description: "Генерация заданий и планирование",
      tooltip: "Используйте искусственный интеллект для создания заданий, проверки работ и составления программ",
      href: "/ai",
      color: "from-sky-500/10 to-blue-500/5",
      iconColor: "text-sky-600 dark:text-sky-400",
    },
    {
      icon: MessageSquare,
      title: "Рассылки",
      description: "Уведомления и напоминания",
      tooltip: "Отправляйте массовые уведомления ученикам и родителям через Telegram",
      href: "/comm",
      color: "from-sky-500/10 to-indigo-500/5",
      iconColor: "text-sky-600 dark:text-sky-400",
    },
  ];

  const todayFormatted = format(new Date(), "d MMMM, EEEE", { locale: ru });

  return (
    <>
      <OnboardingTour isOpen={showOnboarding} onComplete={completeOnboarding} role="tutor" />
      <OnboardingWizard />
    <DashboardLayout
      title="Главная"
      subtitle={todayFormatted}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs hidden sm:flex" onClick={resetOnboarding} data-testid="button-start-onboarding">
            <Sparkles className="h-3.5 w-3.5" />
            Обучение
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs hidden sm:flex" onClick={() => setShowExport(true)} data-testid="button-export-data">
            <Download className="h-3.5 w-3.5" />
            Экспорт
          </Button>
          <Button className="gap-2 shadow-lg shadow-primary/20" onClick={() => { setQaDate(format(new Date(), "yyyy-MM-dd")); setShowQuickAdd(true); }} data-testid="button-quick-add-lesson">
            <Plus className="h-4 w-4" />
            Запланировать занятие
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="page-hint-banner" data-testid="hint-home">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Добро пожаловать!</span> Это ваш центр управления. Здесь расписание на сегодня, ключевые показатели за месяц и быстрый доступ ко всем разделам. Нажимайте на карточки для перехода к подробностям.{" "}
            <a href="/help" className="text-primary underline underline-offset-2 hover:no-underline">База знаний</a> — советы по каждому разделу.
          </div>
        </div>

        {/* Telegram banner — shown when bot is running but tutor hasn't linked */}
        {tgStatus?.botRunning && !tgStatus?.tutorLinked && (
          <TelegramConnectBanner mode="tutor" botUsername={tgStatus.botUsername} />
        )}

        {user && (user as any).emailVerified === false && (
          <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5" data-testid="banner-email-unverified">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 shrink-0">
                <span className="text-amber-500 text-lg">✉</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">Подтвердите email</div>
                <div className="text-xs text-muted-foreground">Мы отправили письмо на {user.email}. Не получили?</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await fetch("/api/auth/send-verification", { method: "POST", credentials: "include" });
                    if (r.ok) toast.success("Письмо отправлено"); else toast.error("Не удалось отправить");
                  } catch { toast.error("Ошибка сети"); }
                }}
                data-testid="button-resend-verification"
              >
                Отправить ещё раз
              </Button>
            </CardContent>
          </Card>
        )}

        <OnboardingChecklist />

        {activeStudents.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/8 via-card to-cyan-500/5 overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shrink-0">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-bold">Добро пожаловать в Твой Вектор!</div>
                    <div className="text-xs text-muted-foreground">Начните работу за 5 минут, следуя этим шагам</div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { num: 1, title: "Добавьте ученика", desc: "Создайте первую карточку ученика с именем и предметом", path: "/students", icon: Users },
                    { num: 2, title: "Создайте расписание", desc: "Запланируйте занятия или настройте повторяющееся расписание", path: "/schedule", icon: Calendar },
                    { num: 3, title: "Откройте базу знаний", desc: "Советы и инструкции по всем функциям платформы", path: "/help", icon: Zap },
                  ].map(({ num, title, desc, path, icon: Icon }) => (
                    <button
                      key={num}
                      onClick={() => setLocation(path)}
                      className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/80 p-3 text-left hover:border-primary/40 hover:shadow-sm transition-all"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shrink-0">{num}</div>
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="section-welcome-hero"
        >
          <Card className="overflow-hidden border-border/40 bg-gradient-to-br from-primary/6 via-card to-cyan-500/4 dark:from-primary/10 dark:via-card dark:to-cyan-500/6 relative">
            {/* Decorative background elements */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
              <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-cyan-500/5 blur-2xl" />
              <Sparkles className="absolute right-12 top-4 h-4 w-4 text-primary/10 rotate-12" />
              <Star className="absolute right-24 top-10 h-3 w-3 text-cyan-500/15" />
              <Star className="absolute right-6 top-16 h-2 w-2 text-primary/10" />
              <GraduationCap className="absolute left-1/2 top-3 h-5 w-5 text-primary/5 -translate-x-16" />
            </div>
            <CardContent className="p-5 md:p-6 relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold tracking-tight" data-testid="text-greeting">
                      {getGreeting()}, {user?.name || ""}
                    </h2>
                    {streak >= 3 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 border border-orange-500/20">
                        <Flame className="h-3 w-3" /> {streak} дн. подряд
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1" data-testid="badge-tier-home">
                      <Star className="h-3 w-3" />
                      {tierInfo.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {todayLessons.length > 0
                        ? `${todayLessons.length} ${pluralize(todayLessons.length, "занятие", "занятия", "занятий")} на сегодня`
                        : "Нет занятий на сегодня"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:flex sm:items-center sm:gap-3 sm:flex-wrap">
                  <div className="text-center px-1">
                    <div className="flex items-center gap-1 justify-center">
                      <div className="text-lg font-bold text-emerald-600" data-testid="text-month-completed">{completedMonthCount}</div>
                      {missedPaidMonthCount > 0 && (
                        <span className="text-xs text-amber-500 leading-none" title={`Платные отмены: ${missedPaidMonthCount}`}>+{missedPaidMonthCount}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">проведено</div>
                  </div>
                  <div className="hidden sm:block w-px h-8 bg-border/60" />
                  <div className="text-center px-1">
                    <div className="text-lg font-bold text-blue-600" data-testid="text-month-remaining">{remainingMonthCount}</div>
                    <div className="text-[11px] text-muted-foreground">в плане</div>
                  </div>
                  <div className="hidden sm:block w-px h-8 bg-border/60" />
                  <button onClick={() => setLocation("/homework")} className="text-center px-1 hover:opacity-80 transition-opacity cursor-pointer">
                    <div className={cn("text-lg font-bold", uncheckedHomework > 0 ? "text-amber-600" : "text-muted-foreground")} data-testid="text-unchecked-hw">{uncheckedHomework}</div>
                    <div className="text-[11px] text-muted-foreground">на проверку</div>
                  </button>
                  <div className="hidden sm:block w-px h-8 bg-border/60" />
                  <button onClick={() => setLocation("/finance")} className="text-center px-1 hover:opacity-80 transition-opacity cursor-pointer">
                    <div className="text-lg font-bold text-emerald-600" data-testid="text-month-income">{moneyRub(monthIncome)}</div>
                    <div className="text-[11px] text-muted-foreground">заработано</div>
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/30">
                <div className="flex items-center gap-2 mb-2.5">
                  <Banknote className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Доход за сегодня</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className={cn("rounded-xl border p-2.5 text-center", todayEarned > 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-muted/40 border-border/40")} data-testid="tile-today-earned">
                    <div className={cn("text-base font-bold", todayEarned > 0 ? "text-emerald-600" : "text-muted-foreground")}>{moneyRub(todayEarned)}</div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Check className={cn("h-3 w-3", todayEarned > 0 ? "text-emerald-500" : "text-muted-foreground")} />
                      <span className="text-[10px] text-muted-foreground">Оплачено</span>
                    </div>
                  </div>
                  <div className={cn("rounded-xl border p-2.5 text-center", todayOwed > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/40 border-border/40")} data-testid="tile-today-owed">
                    <div className={cn("text-base font-bold", todayOwed > 0 ? "text-amber-600" : "text-muted-foreground")}>{moneyRub(todayOwed)}</div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <AlertCircle className={cn("h-3 w-3", todayOwed > 0 ? "text-amber-500" : "text-muted-foreground")} />
                      <span className="text-[10px] text-muted-foreground">Должны</span>
                    </div>
                  </div>
                  <div className={cn("rounded-xl border p-2.5 text-center", todayPotential > 0 ? "bg-blue-500/10 border-blue-500/20" : "bg-muted/40 border-border/40")} data-testid="tile-today-potential">
                    <div className={cn("text-base font-bold", todayPotential > 0 ? "text-blue-600" : "text-muted-foreground")}>{moneyRub(todayPotential)}</div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <TrendingUp className={cn("h-3 w-3", todayPotential > 0 ? "text-blue-500" : "text-muted-foreground")} />
                      <span className="text-[10px] text-muted-foreground">Ещё можно</span>
                    </div>
                  </div>
                </div>
                {(() => {
                  const total = todayEarned + todayOwed;
                  const possible = todayEarned + todayOwed + todayPotential;
                  const pct = possible > 0 ? Math.round((total / possible) * 100) : 0;
                  return (
                    <div className="mt-2 flex items-center justify-between px-0.5" data-testid="row-today-total">
                      <span className="text-[11px] text-muted-foreground">
                        Всего проведено:&nbsp;
                        <span className={cn("font-semibold", total > 0 ? "text-foreground" : "text-muted-foreground")}>
                          {moneyRub(total)}
                        </span>
                        &nbsp;из&nbsp;
                        <span className="font-semibold text-foreground">{moneyRub(possible)}</span>
                        &nbsp;возможных
                      </span>
                      {possible > 0 && (
                        <span className={cn("text-[11px] font-semibold tabular-nums", pct === 100 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-muted-foreground")}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

            </CardContent>
          </Card>
        </motion.div>

        {/* ── Мотивационная полоса: серия / XP / достижения ─────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
          data-testid="section-motivation"
        >
          {/* Серия занятий */}
          <div className={cn(
            "relative overflow-hidden rounded-2xl border p-3.5 flex items-center gap-3",
            streak >= 3
              ? "bg-gradient-to-br from-orange-500/15 to-red-500/10 border-orange-500/30"
              : "bg-muted/40 border-border/40"
          )} data-testid="tile-streak">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", streak >= 3 ? "bg-orange-500/20" : "bg-muted")}>
              <Flame className={cn("h-5 w-5", streak >= 3 ? "text-orange-500" : "text-muted-foreground")} />
            </div>
            <div>
              <div className={cn("text-xl font-bold leading-none", streak >= 3 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground")}>{streak}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {streak === 0 ? "нет серии" : streak === 1 ? "день подряд" : `${streak >= 5 ? "дней" : streak >= 2 ? "дня" : "день"} подряд`}
              </div>
            </div>
            {streak >= 7 && (
              <span className="absolute right-2 top-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-600">🔥 Огонь!</span>
            )}
          </div>

          {/* Всего занятий + XP */}
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/25 p-3.5 flex items-center gap-3" data-testid="tile-total-xp">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold leading-none text-primary">{totalCompleted}</span>
                <span className="text-[11px] text-muted-foreground">уроков</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-primary/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500 transition-all"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Lv.{xpLevel} · {xpProgress}/100 XP до следующего
              </div>
            </div>
          </div>

          {/* До следующей вехи */}
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/25 p-3.5 flex items-center gap-3" data-testid="tile-milestone">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
              <Trophy className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              {totalCompleted >= prevMilestone && prevMilestone > 0 ? (
                <>
                  <div className="text-[10px] text-violet-600 font-semibold">🏆 Достигнуто!</div>
                  <div className="text-sm font-bold text-violet-600">{prevMilestone} уроков</div>
                  <div className="text-[10px] text-muted-foreground">до {nextMilestone} осталось {nextMilestone - totalCompleted}</div>
                </>
              ) : (
                <>
                  <div className="text-xl font-bold leading-none text-violet-600">{nextMilestone - totalCompleted}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">до {nextMilestone} уроков</div>
                </>
              )}
            </div>
          </div>

          {/* Этот месяц */}
          <div className={cn(
            "relative overflow-hidden rounded-2xl border p-3.5 flex items-center gap-3",
            completedMonthCount >= 20
              ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border-emerald-500/30"
              : "bg-muted/40 border-border/40"
          )} data-testid="tile-month-count">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", completedMonthCount >= 20 ? "bg-emerald-500/20" : "bg-muted")}>
              <Award className={cn("h-5 w-5", completedMonthCount >= 20 ? "text-emerald-600" : "text-muted-foreground")} />
            </div>
            <div>
              <div className={cn("text-xl font-bold leading-none", completedMonthCount >= 20 ? "text-emerald-600" : "text-foreground")}>{completedMonthCount}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">уроков в этом месяце</div>
              {completedMonthCount >= 20 && <div className="text-[10px] text-emerald-600 font-semibold">⭐ Отличный месяц!</div>}
            </div>
          </div>
        </motion.div>

        {nextLesson && nextLessonStudent && (() => {
          const nLinks = nextLessonStudent.links as any;
          const nextBbbConf = bbbConferences.find(c => c.studentId === nextLesson.studentId);
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={cn("rounded-2xl border p-4", isLessonOngoing
                ? "border-green-500/20 bg-gradient-to-r from-green-500/5 via-green-500/8 to-green-500/5"
                : "border-primary/15 bg-gradient-to-r from-primary/4 via-primary/8 to-primary/4")}
              data-testid="card-next-lesson"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", isLessonOngoing ? "bg-green-500/15 border-green-500/20" : "bg-primary/15 border-primary/10")}>
                    <Clock className={cn("h-5 w-5", isLessonOngoing ? "text-green-600 dark:text-green-400" : "text-primary")} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {isLessonOngoing ? "Идёт занятие:" : "Следующее занятие:"} {nextLessonStudent.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {nextLessonStudent.subject} · {formatInTimeZone(nextLesson.scheduledAt, userTimezone, "HH:mm")} · {nextLesson.durationMinutes} мин · {nextLesson.topic}
                    </div>
                    {/* Next lesson after the ongoing one */}
                    {nextAfterCurrent && nextAfterStudent && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Следующее: {nextAfterStudent.name} · {formatInTimeZone(nextAfterCurrent.scheduledAt, userTimezone, "HH:mm")} · {formatTimeUntil(minutesToNextAfter)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {/* Внутренняя доска — всегда */}
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-violet-500/40 text-violet-600 hover:bg-violet-500/10 hover:border-violet-500/60"
                    onClick={() => setLocation(`/board/${nextLesson.studentId}`)}
                    data-testid="button-board-next"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" /> Доска
                  </Button>
                  {/* Внутренняя конференция BBB — всегда */}
                  {nextBbbConf ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" className={cn("gap-1.5 text-xs h-8 text-white", nextBbbConf.isRunning ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700")}
                        onClick={() => handleJoinBbb(nextBbbConf.id)}
                        disabled={joiningBbbId === nextBbbConf.id}
                        data-testid="button-bbb-join-next"
                      >
                        {joiningBbbId === nextBbbConf.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
                        {nextBbbConf.isRunning ? "BBB идёт" : "Конференция BBB"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600"
                        onClick={(e) => handleRecreateBbb(nextBbbConf.id, e)}
                        disabled={recreatingBbbId === nextBbbConf.id}
                        title="Пересоздать BBB-комнату"
                        data-testid="button-bbb-recreate-next"
                      >
                        {recreatingBbbId === nextBbbConf.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 opacity-40 cursor-not-allowed" disabled data-testid="button-bbb-join-next">
                      <Video className="h-3.5 w-3.5" /> Конференция BBB
                    </Button>
                  )}
                  {/* Внешняя конференция — если есть */}
                  {nLinks?.conference && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500/30 dark:hover:bg-blue-500/10"
                      onClick={() => window.open(nLinks.conference.startsWith("http") ? nLinks.conference : `https://${nLinks.conference}`, "_blank")}
                    >
                      <Video className="h-3 w-3" /> Конф. (внешн.)
                    </Button>
                  )}
                  {/* Внешняя доска — если есть */}
                  {nLinks?.board && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-500/30 dark:hover:bg-violet-500/10"
                      onClick={() => window.open(nLinks.board.startsWith("http") ? nLinks.board : `https://${nLinks.board}`, "_blank")}
                    >
                      <Pencil className="h-3 w-3" /> Доска (внешн.)
                    </Button>
                  )}
                  <Badge className={cn("rounded-full border whitespace-nowrap text-xs", isLessonOngoing ? "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400" : "bg-primary/10 text-primary border-primary/15")}>
                    {isLessonOngoing ? "сейчас идёт" : formatTimeUntil(minutesToNext)}
                  </Badge>
                </div>
              </div>
            </motion.div>
          );
        })()}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              icon: Calendar,
              value: todayLessons.length,
              label: pluralize(todayLessons.length, "занятие", "занятия", "занятий") + " сегодня",
              testId: "text-today-lessons",
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-500/10",
              extra: completedToday > 0 ? `${completedToday} проведено · ${pendingToday} ожидает` : pendingToday > 0 ? `${pendingToday} ожидает` : "все проведены",
              extraColor: "text-muted-foreground",
              href: "/lessons",
            },
            {
              icon: Users,
              value: studentSlotsData && studentSlotsData.maxStudents !== -1
                ? `${activeStudents.length} / ${studentSlotsData.maxStudents}`
                : activeStudents.length,
              label: pluralize(activeStudents.length, "ученик", "ученика", "учеников"),
              testId: "text-students-count",
              color: "text-blue-600 dark:text-cyan-400",
              bg: "bg-blue-500/10",
              suffix: null,
              extra: studentSlotsData?.isAtLimit ? "лимит достигнут" : studentSlotsData?.isNearLimit ? "скоро лимит" : null,
              extraColor: studentSlotsData?.isAtLimit ? "text-red-500" : "text-amber-500",
              href: "/students",
              showProgress: !!(studentSlotsData && studentSlotsData.maxStudents !== -1),
            },
            {
              icon: Wallet,
              value: moneyRub(monthMaxPotential),
              label: "потенциал за месяц",
              testId: "text-month-earned",
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-500/10",
              isText: true,
              extra: monthIncome > 0
                ? `заработано ${moneyRub(monthIncome)}${monthLost > 0 ? ` · потери ${moneyRub(monthLost)}` : ""}`
                : "нет доходов",
              extraColor: monthLost > 0 ? "text-red-500" : "text-muted-foreground",
              href: "/finance",
            },
            {
              icon: TrendingUp,
              value: moneyRub(expectedMonthIncome),
              label: "ещё можно заработать",
              testId: "text-month-expected",
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-500/10",
              isText: true,
              extra: remainingMonthCount > 0
                ? `${remainingMonthCount} ${pluralize(remainingMonthCount, "занятие", "занятия", "занятий")} в расписании`
                : monthLost > 0 ? `упущено ${moneyRub(monthLost)} (отмены)` : "нет запланированных",
              extraColor: "text-muted-foreground",
              href: "/analytics",
            },
          ].map((card, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card
                className="border-border/40 h-full cursor-pointer card-hover group"
                onClick={() => setLocation(card.href)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", card.bg)}>
                      <card.icon className={cn("h-4 w-4", card.color)} />
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight" data-testid={card.testId}>
                    {card.value}
                    {(card as any).suffix && <span className="text-sm font-normal text-muted-foreground">{(card as any).suffix}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
                  {card.extra && <div className={cn("text-[11px] mt-0.5", card.extraColor || "text-muted-foreground")}>{card.extra}</div>}
                  {i === 1 && studentSlotsData && studentSlotsData.maxStudents !== -1 && (
                    <Progress
                      value={(studentSlotsData.activeStudents / studentSlotsData.maxStudents) * 100}
                      className={cn("h-1 mt-2", studentSlotsData.isAtLimit && "[&>div]:bg-destructive", studentSlotsData.isNearLimit && !studentSlotsData.isAtLimit && "[&>div]:bg-amber-500")}
                      data-testid="progress-student-slots"
                    />
                  )}
                  {i === 1 && studentSlotsData?.isAtLimit && tierInfo.extraStudentPrice > 0 && (
                    <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-[11px] text-primary" onClick={(e) => { e.stopPropagation(); setLocation("/subscription"); }} data-testid="link-buy-students-home">
                      Докупить учеников →
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {todayLessons.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Расписание на сегодня</h3>
            <div className="space-y-1.5">
              {todayLessons.map((lesson) => {
                const student = students.find(s => s.id === lesson.studentId);
                const tLinks = student?.links as any;
                const isCompleted = lesson.status === "completed";
                const isCancelled = lesson.status === "cancelled";
                const isPending = lesson.status === "pending";
                const isPaid = isCompleted && lesson.attendance === "attended";
                const isUnpaid = isCompleted && lesson.attendance === "attended_unpaid";
                const statusText = isCompleted
                  ? (isPaid ? "Проведено ✓" : isUnpaid ? "Проведено ✗" : "Проведено")
                  : isCancelled
                  ? (lesson.attendance === "missed_paid" ? "Отменено ✓" : "Отменено")
                  : "Ожидает";
                const statusTone = isPaid
                  ? "bg-emerald-500/10 text-emerald-600"
                  : isUnpaid
                  ? "bg-orange-500/10 text-orange-600"
                  : isCancelled
                  ? (lesson.attendance === "missed_paid" ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600")
                  : "bg-amber-500/10 text-amber-600";
                return (
                  <div
                    key={lesson.id}
                    data-testid={`row-lesson-${lesson.id}`}
                    className={cn(
                      "rounded-xl border px-3.5 py-2.5 transition-all",
                      isPaid ? "bg-emerald-500/4 dark:bg-emerald-950/20 border-emerald-500/15 dark:border-emerald-800/30" :
                      isUnpaid ? "bg-orange-500/5 dark:bg-orange-950/20 border-orange-400/20 dark:border-orange-800/30" :
                      isCancelled ? "bg-muted/30 border-border/30 opacity-60" :
                      "bg-card/60 border-border/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-mono text-muted-foreground w-12 shrink-0 tabular-nums">
                        {formatInTimeZone(lesson.scheduledAt, userTimezone, "HH:mm")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          className="text-sm font-medium truncate hover:text-primary transition-colors text-left block w-full"
                          onClick={(e) => { e.stopPropagation(); setLocation(`/students?open=${lesson.studentId}`); }}
                          title="Открыть профиль"
                        >
                          {student?.name || "\u2014"}
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                          <span className="truncate">{lesson.topic}</span>
                          {student && <span className="shrink-0 text-emerald-600/70 font-medium">{calcCost(lesson, student).toLocaleString("ru")}₽</span>}
                        </div>
                      </div>
                      <TooltipProvider delayDuration={200}>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 border-transparent", statusTone)}>
                            {statusText}
                          </Badge>
                          {/* Внутренняя доска — всегда */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-500 hover:text-violet-700 hover:bg-violet-500/10"
                                onClick={(e) => { e.stopPropagation(); setLocation(`/board/${lesson.studentId}`); }}
                                data-testid={`button-board-home-${lesson.id}`}
                              >
                                <LayoutGrid className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Доска (внутр.)</TooltipContent>
                          </Tooltip>
                          {/* Внутренняя конференция BBB — всегда */}
                          {(() => {
                            const lessonBbb = bbbConferences.find(c => c.studentId === lesson.studentId);
                            return (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon"
                                      className={cn("h-7 w-7",
                                        lessonBbb
                                          ? lessonBbb.isRunning
                                            ? "text-green-500 hover:text-green-700 hover:bg-green-500/10"
                                            : "text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                                          : "text-muted-foreground/25 cursor-default"
                                      )}
                                      onClick={(e) => { e.stopPropagation(); if (lessonBbb) handleJoinBbb(lessonBbb.id); }}
                                      disabled={!lessonBbb || joiningBbbId === lessonBbb?.id}
                                      data-testid={`button-bbb-home-${lesson.id}`}
                                    >
                                      {lessonBbb && joiningBbbId === lessonBbb.id
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Video className="h-3.5 w-3.5" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {lessonBbb
                                      ? lessonBbb.isRunning ? "Конференция идёт — войти в BBB" : "Конференция BBB (внутр.)"
                                      : "Конференция BBB (не настроена)"}
                                  </TooltipContent>
                                </Tooltip>
                                {lessonBbb && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40 hover:text-orange-500 hover:bg-orange-500/10"
                                        onClick={(e) => handleRecreateBbb(lessonBbb.id, e)}
                                        disabled={recreatingBbbId === lessonBbb.id}
                                        data-testid={`button-bbb-recreate-${lesson.id}`}
                                      >
                                        {recreatingBbbId === lessonBbb.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Пересоздать BBB-комнату</TooltipContent>
                                  </Tooltip>
                                )}
                              </>
                            );
                          })()}
                          {/* Внешняя конференция — если есть */}
                          {tLinks?.conference && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500/50 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  onClick={(e) => { e.stopPropagation(); window.open(tLinks.conference.startsWith("http") ? tLinks.conference : `https://${tLinks.conference}`, "_blank"); }}
                                >
                                  <Video className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Конференция (внешн.)</TooltipContent>
                            </Tooltip>
                          )}
                          {/* Внешняя доска — если есть */}
                          {tLinks?.board && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-500/50 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                                  onClick={(e) => { e.stopPropagation(); window.open(tLinks.board.startsWith("http") ? tLinks.board : `https://${tLinks.board}`, "_blank"); }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Доска (внешн.)</TooltipContent>
                            </Tooltip>
                          )}
                          {isPending && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); openReschedule(lesson); }}
                                >
                                  <MoveRight className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Перенести</TooltipContent>
                            </Tooltip>
                          )}
                          <span className="text-[11px] text-muted-foreground/60">{lesson.durationMinutes}м</span>
                        </div>
                      </TooltipProvider>
                    </div>
                    {isPending && (
                      <div className="mt-2 ml-[60px] space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            disabled={pendingLessonAction?.id === lesson.id}
                            className={cn(
                              "px-2 py-1 rounded-md text-[10px] border transition-all duration-150 active:scale-95 flex items-center gap-1 select-none",
                              pendingLessonAction?.id === lesson.id && pendingLessonAction?.action === "done"
                                ? "bg-emerald-500 text-white border-emerald-500 scale-95 opacity-90"
                                : "bg-background border-border/50 text-emerald-600 hover:bg-emerald-50 hover:scale-[1.04] hover:border-emerald-300"
                            )}
                            onClick={() => {
                              setPendingLessonAction({ id: lesson.id, action: "done" });
                              updateLesson.mutate(
                                { id: lesson.id, updates: { status: "completed", attendance: "attended" } },
                                {
                                  onSuccess: (data: any) => {
                                    if (data?.attendance === "attended_unpaid") {
                                      toast("Проведено ✗ — баланс недостаточен, занятие отмечено как не оплаченное", { icon: "⚠️" });
                                    } else {
                                      toast.success("Проведено ✓");
                                    }
                                    setPendingLessonAction(null);
                                  },
                                  onError: () => { toast.error("Ошибка"); setPendingLessonAction(null); }
                                }
                              );
                            }}
                            data-testid={`button-home-done-${lesson.id}`}
                          >
                            {pendingLessonAction?.id === lesson.id && pendingLessonAction?.action === "done"
                              ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              : <Check className="h-2.5 w-2.5" />
                            }
                            Проведено
                          </button>
                          <button
                            disabled={pendingLessonAction?.id === lesson.id}
                            className={cn(
                              "px-2 py-1 rounded-md text-[10px] border transition-all duration-150 active:scale-95 flex items-center gap-1 select-none",
                              pendingLessonAction?.id === lesson.id && pendingLessonAction?.action === "cancel"
                                ? "bg-red-500 text-white border-red-500 scale-95 opacity-90"
                                : "bg-background border-border/50 text-red-600 hover:bg-red-50 hover:scale-[1.04] hover:border-red-300"
                            )}
                            onClick={() => {
                              setPendingLessonAction({ id: lesson.id, action: "cancel" });
                              updateLesson.mutate(
                                { id: lesson.id, updates: { status: "cancelled" } },
                                {
                                  onSuccess: () => { toast.success("Отменено"); setPendingLessonAction(null); },
                                  onError: () => { toast.error("Ошибка"); setPendingLessonAction(null); }
                                }
                              );
                            }}
                            data-testid={`button-home-cancel-${lesson.id}`}
                          >
                            {pendingLessonAction?.id === lesson.id && pendingLessonAction?.action === "cancel"
                              ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              : <X className="h-2.5 w-2.5" />
                            }
                            Отменено
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5">
                          <span className="text-[10px] text-muted-foreground">Баланс:</span>
                          <span className={cn("text-[10px] font-bold tabular-nums",
                            student ? getEffectiveBalance(student.id) > 0 ? "text-emerald-600" :
                            getEffectiveBalance(student.id) < 0 ? "text-red-600" :
                            "text-muted-foreground" : "text-muted-foreground"
                          )}>
                            {student ? (getEffectiveBalance(student.id) > 0 ? "+" : "") + getEffectiveBalance(student.id).toLocaleString("ru") : "0"} ₽
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {monthlyIncomeData.some(d => d.income > 0) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="rounded-2xl border-border/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold">Доход за последние 6 месяцев</div>
                    <div className="text-xs text-muted-foreground">Проведённые и оплачиваемые занятия</div>
                  </div>
                  <Banknote className="h-4 w-4 text-emerald-500" />
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={monthlyIncomeData} barSize={28} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? "" : `${(v/1000).toFixed(0)}k`} />
                    <RechartTooltip
                      formatter={(v: number) => [`${v.toLocaleString("ru")} ₽`, "Доход"]}
                      contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid var(--border)" }}
                    />
                    <Bar dataKey="income" fill="var(--color-emerald, #10b981)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Monthly Goals Card */}
        {(() => {
          const goals = monthlyGoals || {};
          const lessonsTarget = goals.lessonsTarget ?? 0;
          const incomeTarget = goals.incomeTarget ?? 0;
          const studentsTarget = goals.newStudentsTarget ?? 0;
          const currentLessons = completedMonthCount + missedPaidMonthCount;
          const currentIncome = monthIncome;
          const currentStudents = activeStudents.length;
          const hasAnyTarget = lessonsTarget > 0 || incomeTarget > 0 || studentsTarget > 0;
          return (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="rounded-2xl border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Цели на месяц</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                      setGoalsLessons(lessonsTarget > 0 ? String(lessonsTarget) : "");
                      setGoalsIncome(incomeTarget > 0 ? String(incomeTarget) : "");
                      setGoalsStudents(studentsTarget > 0 ? String(studentsTarget) : "");
                      setShowGoalsDialog(true);
                    }} data-testid="button-edit-goals">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  {hasAnyTarget ? (
                    <div className="space-y-3">
                      {lessonsTarget > 0 && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Занятий проведено</span>
                            <span className="font-medium">{currentLessons} / {lessonsTarget}</span>
                          </div>
                          <Progress value={Math.min(100, Math.round(currentLessons / lessonsTarget * 100))} className="h-1.5" />
                        </div>
                      )}
                      {incomeTarget > 0 && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Доход</span>
                            <span className="font-medium">{currentIncome.toLocaleString("ru")} / {incomeTarget.toLocaleString("ru")} ₽</span>
                          </div>
                          <Progress value={Math.min(100, Math.round(currentIncome / incomeTarget * 100))} className="h-1.5" />
                        </div>
                      )}
                      {studentsTarget > 0 && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Активных учеников</span>
                            <span className="font-medium">{currentStudents} / {studentsTarget}</span>
                          </div>
                          <Progress value={Math.min(100, Math.round(currentStudents / studentsTarget * 100))} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <p className="text-xs text-muted-foreground mb-2">Поставьте цели на месяц, чтобы отслеживать прогресс</p>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                        setGoalsLessons(""); setGoalsIncome(""); setGoalsStudents("");
                        setShowGoalsDialog(true);
                      }}>Установить цели</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })()}

        {/* Goals Edit Dialog */}
        <Dialog open={showGoalsDialog} onOpenChange={setShowGoalsDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Цели на месяц
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Занятий в месяц</label>
                <Input type="number" min="0" placeholder="Например: 40" value={goalsLessons} onChange={e => setGoalsLessons(e.target.value)} data-testid="input-goals-lessons" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Доход, ₽</label>
                <Input type="number" min="0" placeholder="Например: 80000" value={goalsIncome} onChange={e => setGoalsIncome(e.target.value)} data-testid="input-goals-income" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Активных учеников</label>
                <Input type="number" min="0" placeholder="Например: 15" value={goalsStudents} onChange={e => setGoalsStudents(e.target.value)} data-testid="input-goals-students" />
              </div>
              <Button className="w-full" onClick={async () => {
                await updateMonthlyGoals.mutateAsync({
                  lessonsTarget: goalsLessons ? parseInt(goalsLessons) : 0,
                  incomeTarget: goalsIncome ? parseInt(goalsIncome) : 0,
                  newStudentsTarget: goalsStudents ? parseInt(goalsStudents) : 0,
                });
                toast.success("Цели сохранены");
                setShowGoalsDialog(false);
              }} disabled={updateMonthlyGoals.isPending} data-testid="button-save-goals">
                {updateMonthlyGoals.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Сохранить
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Разделы</h3>
          <TooltipProvider>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {navItems.map((item, idx) => (
                <Tooltip key={item.href} delayDuration={400}>
                  <TooltipTrigger asChild>
                    <div>
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                        <Card
                          className="border-border/40 cursor-pointer card-hover group"
                          onClick={() => setLocation(item.href)}
                          data-testid={`card-nav-${item.href.replace("/", "")}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br shrink-0", item.color)}>
                                  <item.icon className={cn("h-[18px] w-[18px]", item.iconColor)} />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold">{item.title}</div>
                                  <div className="text-xs text-muted-foreground/70 mt-0.5">{item.description}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.badge && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/8 text-primary/80 border-primary/15">{item.badge}</Badge>
                                )}
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-sm">{item.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>

        {(() => {
          const release = changelog[changelogIdx];
          if (!release) return null;
          const isLatest = changelogIdx === 0;
          return (
            <div data-testid="section-whats-new">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Что нового
                  {isLatest && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">НОВОЕ</span>
                  )}
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={changelogIdx >= changelog.length - 1}
                    onClick={() => setChangelogIdx(i => Math.min(changelog.length - 1, i + 1))}
                    data-testid="button-changelog-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-[11px] text-muted-foreground font-mono px-1">
                    v{release.version}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={changelogIdx <= 0}
                    onClick={() => setChangelogIdx(i => Math.max(0, i - 1))}
                    data-testid="button-changelog-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-2xl border overflow-hidden",
                  isLatest
                    ? "bg-gradient-to-br from-primary/8 via-background to-cyan-500/5 border-primary/25"
                    : "bg-card border-border/40"
                )}
                data-testid={`card-changelog-${changelogIdx}`}
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono",
                      isLatest ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-foreground"
                    )}>
                      <Sparkles className="h-3 w-3" />
                      v{release.version}
                    </div>
                    <span className="text-xs text-muted-foreground">{release.date}</span>
                    {isLatest && <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-700 border-0">Актуально</Badge>}
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const hasAudience = release.items.some(item => item.for);
                      if (!hasAudience) {
                        return release.items.map((item, i) => {
                          const tagStyle = TAG_STYLES[item.tag];
                          return (
                            <div key={i} className="flex items-start gap-2" data-testid={`changelog-item-${changelogIdx}-${i}`}>
                              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0 mt-0.5 border", tagStyle.className)}>
                                {tagStyle.label}
                              </Badge>
                              <span className="text-sm leading-relaxed">{item.text}</span>
                            </div>
                          );
                        });
                      }
                      const tutorItems = release.items.filter(item => item.for === "tutor");
                      const studentItems = release.items.filter(item => item.for === "student");
                      return (
                        <div className="space-y-3">
                          {tutorItems.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                <GraduationCap className="h-3 w-3" /> Репетиторам
                              </div>
                              {tutorItems.map((item, i) => {
                                const tagStyle = TAG_STYLES[item.tag];
                                return (
                                  <div key={i} className="flex items-start gap-2" data-testid={`changelog-item-${changelogIdx}-tutor-${i}`}>
                                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0 mt-0.5 border", tagStyle.className)}>
                                      {tagStyle.label}
                                    </Badge>
                                    <span className="text-sm leading-relaxed">{item.text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {studentItems.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-t border-border/40 pt-2">
                                <Users className="h-3 w-3" /> Ученикам
                              </div>
                              {studentItems.map((item, i) => {
                                const tagStyle = TAG_STYLES[item.tag];
                                return (
                                  <div key={i} className="flex items-start gap-2" data-testid={`changelog-item-${changelogIdx}-student-${i}`}>
                                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0 mt-0.5 border", tagStyle.className)}>
                                      {tagStyle.label}
                                    </Badge>
                                    <span className="text-sm leading-relaxed">{item.text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {studentItems.length === 0 && tutorItems.length > 0 && (
                            <div className="pt-2 border-t border-border/40">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                <Users className="h-3 w-3" /> Ученикам
                              </div>
                              <span className="text-xs text-muted-foreground italic">Изменений на сегодня нет — обновление направлено на работу репетитора</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {isLatest && (
                  <div className="border-t border-primary/10 bg-primary/5 px-4 py-2 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-[11px] text-muted-foreground">Платформа обновляется каждую неделю — следите за новинками</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      <Dialog open={!!rescheduleLesson} onOpenChange={(open) => !open && setRescheduleLesson(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-primary" />
              Перенести занятие
            </DialogTitle>
          </DialogHeader>
          {rescheduleLesson && (() => {
            const st = students.find(s => s.id === rescheduleLesson.studentId);
            return (
              <div className="space-y-4 py-2">
                <div className="text-sm text-muted-foreground">
                  <strong>{st?.name || "—"}</strong> · {rescheduleLesson.topic}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Дата</label>
                    <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Время</label>
                    <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 7].map(d => (
                    <Button key={d} variant="outline" size="sm" className="text-xs flex-1"
                      onClick={() => {
                        const orig = new Date(rescheduleLesson.scheduledAt);
                        const shifted = addDays(orig, d);
                        setRescheduleDate(format(shifted, "yyyy-MM-dd"));
                        setRescheduleTime(format(orig, "HH:mm"));
                      }}
                    >
                      +{d === 7 ? "нед" : `${d}д`}
                    </Button>
                  ))}
                </div>
                <Button className="w-full gap-2" onClick={handleReschedule} disabled={updateLesson.isPending}>
                  {updateLesson.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoveRight className="h-4 w-4" />}
                  Перенести
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Quick Add Lesson Dialog */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Запланировать занятие
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ученик *</label>
              <Select value={qaStudentId} onValueChange={setQaStudentId}>
                <SelectTrigger data-testid="select-qa-student">
                  <SelectValue placeholder="Выберите ученика" />
                </SelectTrigger>
                <SelectContent>
                  {(studentsData ?? []).filter((s: any) => !s.isArchived).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — {s.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Дата *</label>
                <Input type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} data-testid="input-qa-date" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Время *</label>
                <Input type="time" value={qaTime} onChange={(e) => setQaTime(e.target.value)} data-testid="input-qa-time" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Длительность</label>
              <Select value={qaDuration} onValueChange={setQaDuration}>
                <SelectTrigger data-testid="select-qa-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 минут</SelectItem>
                  <SelectItem value="45">45 минут</SelectItem>
                  <SelectItem value="60">1 час</SelectItem>
                  <SelectItem value="90">1.5 часа</SelectItem>
                  <SelectItem value="120">2 часа</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Тема (необязательно)</label>
              <Input placeholder="Например: Квадратные уравнения" value={qaTopic} onChange={(e) => setQaTopic(e.target.value)} data-testid="input-qa-topic" />
            </div>
            <Button className="w-full gap-2" onClick={handleQuickAddLesson} disabled={createLesson.isPending || !qaStudentId} data-testid="button-qa-submit">
              {createLesson.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Добавить в расписание
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
    <ExportDataModal open={showExport} onOpenChange={setShowExport} />
    </>
  );
}
