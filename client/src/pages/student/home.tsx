import { useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TelegramConnectBanner } from "@/components/telegram-connect-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  FileText,
  ArrowRight,
  CircleDollarSign,
  Clock,
  Star,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Target,
  BookOpen,
  Monitor,
  PenTool,
  PenLine,
  ExternalLink,
  GraduationCap,
  BarChart3,
  Info,
  Flame,
  TrendingUp,
  Zap,
  XCircle,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Trophy,
  Medal,
  Timer,
  Video,
  Bot,
  Send,
  Paperclip,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format, isFuture, isToday, isPast, differenceInDays, differenceInHours, addDays } from "date-fns";
import { ru } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { parseConferenceLink } from "@/lib/conference-utils";
import { SiZoom, SiGooglemeet, SiJitsi } from "react-icons/si";
import { OnboardingTour, useOnboarding } from "@/components/onboarding-tour";

function ToolRow({
  icon,
  label,
  sub,
  isDefault,
  isBackup,
  isTodayLesson,
  color,
  rightIcon,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  isDefault: boolean;
  isBackup: boolean;
  isTodayLesson: boolean;
  color: "blue" | "purple";
  rightIcon: ReactNode;
}) {
  const blue = color === "blue";
  return (
    <div className={cn(
      "flex items-center gap-3 w-full text-left rounded-xl px-3 py-2.5 transition-colors border group cursor-pointer",
      blue
        ? isDefault
          ? "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"
          : isTodayLesson
          ? "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"
          : "border-blue-500/15 hover:bg-blue-500/5"
        : isDefault
        ? "border-purple-500/25 bg-purple-500/5 hover:bg-purple-500/10"
        : "border-purple-500/15 hover:bg-purple-500/5"
    )}>
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
        blue
          ? isDefault || isTodayLesson ? "bg-blue-500/20" : "bg-blue-500/10 group-hover:bg-blue-500/15"
          : isDefault ? "bg-purple-500/15" : "bg-purple-500/10 group-hover:bg-purple-500/15"
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-sm font-semibold flex items-center gap-1.5 flex-wrap",
          blue ? "text-blue-700 dark:text-blue-400" : "text-purple-700 dark:text-purple-400"
        )}>
          {label}
          {isDefault && (
            <span className={cn("text-[10px] font-normal rounded-full px-1.5 py-0.5 leading-none flex items-center gap-0.5", blue ? "bg-blue-500 text-white" : "bg-purple-500 text-white")}>
              <Star className="h-2.5 w-2.5 fill-current" />
              Основная
            </span>
          )}
          {isBackup && (
            <span className="text-[10px] font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
              Запасная
            </span>
          )}
          {isTodayLesson && !isBackup && (
            <span className={cn("text-[10px] font-normal rounded-full px-1.5 py-0.5 leading-none", blue ? "bg-blue-500 text-white" : "bg-purple-500 text-white")}>
              Сегодня
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{sub}</div>
      </div>
      {rightIcon}
    </div>
  );
}

interface StudentHomeProps {
  student: {
    name: string;
    subject: string;
    goal: string;
    grade: string;
    progress: number;
    balance: number;
    curriculumTopic: string;
    links?: { conference?: string; board?: string };
    pricePerLesson: number;
  };
  lessons: any[];
  homework: any[];
  payments?: any[];
  studentId?: string;
}

function moneyRub(v: number) {
  return v.toLocaleString("ru-RU") + " ₽";
}

function getTimeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (isToday(d)) return `Сегодня в ${format(d, "HH:mm")}`;
  const hours = differenceInHours(d, now);
  if (hours < 24 && hours > 0) return `Завтра в ${format(d, "HH:mm")}`;
  const days = differenceInDays(d, now);
  if (days <= 7) return format(d, "EEEE, HH:mm", { locale: ru });
  return format(d, "d MMMM, HH:mm", { locale: ru });
}

function pluralLessons(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "занятие";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "занятия";
  return "занятий";
}

const MOTIVATIONAL_QUOTES = [
  "Каждый эксперт когда-то был новичком. Продолжай!",
  "Знания — это сила. Ты становишься сильнее с каждым уроком.",
  "Сегодняшние усилия — это завтрашние результаты.",
  "Умение приходит с практикой. Ты на правильном пути!",
  "Маленькие шаги каждый день приводят к большим победам.",
  "Ты способен на большее, чем думаешь!",
  "Учись не для оценок, а ради знаний — оценки придут сами.",
  "Трудности — это ступеньки к успеху.",
  "Лучшее время начать учиться — сейчас.",
  "Каждая ошибка делает тебя умнее.",
  "Твой прогресс реален, даже когда незаметен.",
  "Настойчивость побеждает таланты.",
];

function getDailyQuote(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];
}

type ChangelogRelease = {
  version: string;
  date: string;
  items: { tag: "new" | "fix" | "improve"; text: string }[];
};

const studentChangelog: ChangelogRelease[] = [
  {
    version: "3.3",
    date: "20 апреля 2026",
    items: [
      { tag: "new", text: "Стрик домашек — серия ДЗ подряд без пропусков, с анимированным пламенем и счётчиком лучшей серии" },
      { tag: "new", text: "Достижения за стрик: 3, 7 и 15 домашек подряд — отдельная категория «Стрик ДЗ»" },
      { tag: "new", text: "Праздник за новый уровень: красивое окно с конфетти и списком перков, появляется один раз при достижении" },
      { tag: "new", text: "Личное мотивационное сообщение на странице прогресса — меняется по уровню, стрику и результатам" },
      { tag: "improve", text: "Карточка «Следующее достижение» теперь всегда показывает, что и сколько осталось до ближайшей награды" },
      { tag: "fix", text: "Переход по ссылке доступа от репетитора (/student?token=…) теперь автоматически логинит в кабинет" },
    ],
  },
  {
    version: "3.2",
    date: "8 апреля 2026",
    items: [
      { tag: "new", text: "Основная и запасная конференция — репетитор отмечает главный инструмент ★, он показывается первым с меткой «Основная»" },
      { tag: "new", text: "Основная доска тоже выбирается репетитором: встроенная или внешняя (Miro/Figma) — нужный вариант всегда первый" },
      { tag: "improve", text: "Конференции и доски на главной теперь в отдельных секциях с подписями — всё структурировано и понятно" },
    ],
  },
  {
    version: "3.1",
    date: "7 апреля 2026",
    items: [
      { tag: "fix", text: "BigBlueButton теперь открывается без ошибок — кнопка входа в конференцию работает как надо" },
      { tag: "new", text: "«Наша доска» всегда на главной — кликай и работай прямо в браузере, ничего устанавливать не нужно" },
      { tag: "improve", text: "Инструменты для занятий теперь с подписями и объяснениями — сразу понятно, что для чего" },
    ],
  },
  {
    version: "3.0",
    date: "28 марта 2026",
    items: [
      { tag: "new", text: "Кнопка «Обучение» теперь ведёт на страницу прогресса: XP, уровни, стрики и достижения — всё в одном месте" },
      { tag: "new", text: "Задачник ЕГЭ: решайте задания из банка напрямую в кабинете, репетитор видит ваши результаты" },
      { tag: "improve", text: "База знаний значительно расширена — советы по прогрессу, задачнику и грамотной работе с ИИ" },
      { tag: "improve", text: "Страница прогресса: детальная разбивка XP по категориям — занятия, домашка, оценки, стрики" },
    ],
  },
  {
    version: "2.9",
    date: "27 марта 2026",
    items: [
      { tag: "new", text: "ИИ-помощник: поддержка фотографий — сфотографируйте задачу и получите объяснение с разбором" },
      { tag: "improve", text: "Покупка AI-кредитов прямо в кабинете: пакеты 50, 100 и 200 запросов по выгодным ценам" },
      { tag: "fix", text: "Баланс на главной теперь всегда показывает актуальное значение без необходимости обновлять страницу" },
      { tag: "improve", text: "Уведомления о новых домашних заданиях появляются мгновенно, не нужно обновлять страницу" },
    ],
  },
  {
    version: "2.8",
    date: "26 марта 2026",
    items: [
      { tag: "improve", text: "2–4 кнопки на каждом занятии: внешняя конференция, BBB, внешняя доска и внутренняя доска — всегда видно, всегда открывается напрямую" },
      { tag: "fix", text: "Комбо занятий теперь правильно сбрасывается, если между ними была отмена" },
      { tag: "improve", text: "В виде «День» — кликабельные цветные бейджи со всеми ссылками, в «Неделе» — цветные точки" },
    ],
  },
  {
    version: "2.7",
    date: "26 марта 2026",
    items: [
      { tag: "improve", text: "Кнопка входа в BBB-конференцию теперь отображается всегда, если репетитор включил видеозвонки" },
      { tag: "improve", text: "В домашних заданиях теперь можно прикреплять любые файлы: PDF, документы, архивы — не только фото" },
      { tag: "improve", text: "Боковое меню стало чище — убраны лишние разделы для удобной навигации" },
    ],
  },
  {
    version: "2.6",
    date: "26 марта 2026",
    items: [
      { tag: "improve", text: "Кнопки «Конференция» и «Доска» теперь видны прямо в карточке ближайшего занятия — не только сегодня, но и для будущих уроков" },
      { tag: "improve", text: "В списке занятий ссылки на конференцию и доску появляются автоматически для всех предстоящих занятий" },
      { tag: "improve", text: "Иконки конференции и доски теперь различаются визуально: синяя — конференция, фиолетовая — доска" },
    ],
  },
  {
    version: "2.5",
    date: "26 марта 2026",
    items: [
      { tag: "new", text: "Конференция BBB теперь отображается прямо на главной — кнопка «Войти» доступна без лишних настроек" },
      { tag: "improve", text: "Кнопка «Внутренняя доска» всегда видна в разделе ссылок на главной и в карточке занятия" },
      { tag: "improve", text: "Конференция завершается автоматически через 30 минут без участников — сервер работает эффективнее" },
    ],
  },
  {
    version: "2.4",
    date: "26 марта 2026",
    items: [
      { tag: "new", text: "Внутренняя доска: кнопка на главной и в занятиях — рисуйте и пишите вместе с репетитором в реальном времени" },
      { tag: "new", text: "Доска: рабочие колонки появляются автоматически при первом открытии — структура сразу готова" },
      { tag: "new", text: "Доска: точечный фон как в Miro — удобнее ориентироваться и рисовать" },
      { tag: "new", text: "Занятия: дневной вид с временными слотами — как Google Календарь" },
      { tag: "improve", text: "Следующее занятие на главной: тема, статус домашки и быстрые ссылки прямо в карточке" },
    ],
  },
  {
    version: "2.3",
    date: "14 марта 2026",
    items: [
      { tag: "new", text: "Календарь занятий — недельный и месячный вид с навигацией" },
      { tag: "new", text: "Финансы — правильный баланс, прогноз расходов на неделю и месяц" },
      { tag: "improve", text: "ИИ-помощник — выбор модели, счётчик, покупка пакетов всегда на виду" },
      { tag: "improve", text: "Главная страница — «Что нового», статистика, остаток занятий" },
    ],
  },
  {
    version: "2.2",
    date: "13 марта 2026",
    items: [
      { tag: "new", text: "Ссылки на конференцию и доску на главной и в занятиях" },
      { tag: "new", text: "Статистика на странице занятий и финансов" },
      { tag: "improve", text: "Оплаченные/неоплаченные бейджи на занятиях" },
      { tag: "improve", text: "Подсказки на каждой странице" },
    ],
  },
  {
    version: "2.0",
    date: "10 марта 2026",
    items: [
      { tag: "new", text: "Полностью новый личный кабинет ученика" },
      { tag: "new", text: "ИИ-помощник с поддержкой фото и LaTeX" },
      { tag: "new", text: "Домашние задания — отправка и оценки" },
    ],
  },
  {
    version: "1.0",
    date: "22 декабря 2025",
    items: [
      { tag: "new", text: "Первая версия портала ученика" },
      { tag: "new", text: "Магические ссылки для быстрого входа" },
    ],
  },
];

const TAG_STYLES: Record<string, { label: string; className: string }> = {
  new: { label: "Новое", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  fix: { label: "Фикс", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  improve: { label: "Улучшено", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
};

export default function StudentHome({ student, lessons, homework, payments = [], studentId }: StudentHomeProps) {
  const [, setLocation] = useLocation();
  const [changelogIdx, setChangelogIdx] = useState(0);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [minutesToLesson, setMinutesToLesson] = useState<number | null>(null);
  const { showOnboarding, completeOnboarding, resetOnboarding } = useOnboarding("student");

  const { data: tgStatus } = useQuery<{
    botRunning: boolean;
    botUsername: string | null;
    telegramLinked: boolean;
  }>({
    queryKey: ["/api/student/telegram/status"],
    refetchOnWindowFocus: false,
  });

  const nextLesson = lessons
    .filter(l => (isFuture(new Date(l.scheduledAt)) || isToday(new Date(l.scheduledAt))) && l.status !== "cancelled" && l.status !== "completed")
    .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];

  const activeHomework = homework.filter((h: any) => h.status !== "reviewed");
  const reviewedHomework = homework.filter((h: any) => h.status === "reviewed" && h.score != null);
  const avgScore = reviewedHomework.length > 0
    ? Math.round(reviewedHomework.reduce((sum: number, h: any) => sum + h.score, 0) / reviewedHomework.length)
    : null;

  const completedLessons = lessons.filter((l: any) => l.status === "completed").length;
  const completedHomework = homework.filter((h: any) => h.status === "reviewed").length;

  const allUpcoming = lessons.filter((l: any) => (isFuture(new Date(l.scheduledAt)) || isToday(new Date(l.scheduledAt))) && l.status !== "cancelled" && l.status !== "completed");

  const unpaidLessons = lessons.filter((l: any) => l.status === "completed" && l.attendance === "attended_unpaid");
  const unpaidCount = unpaidLessons.length;

  const isBillable = (l: any) =>
    (l.status === "completed" && ["attended", "attended_unpaid", "missed_paid"].includes(l.attendance || "")) ||
    (l.status === "cancelled" && l.attendance === "missed_paid");

  const calcCost = (l: any) => {
    const dur = l.durationMinutes || 60;
    return Math.round(student.pricePerLesson * dur / 60);
  };

  const totalAllPayments = (payments ?? []).reduce((s: number, p: any) => s + p.amount, 0);
  const totalBillableCost = lessons.filter(isBillable).reduce((s: number, l: any) => s + calcCost(l), 0);
  const freeBalance = totalAllPayments - totalBillableCost;

  const lessonsLeft = student.pricePerLesson > 0
    ? Math.max(0, Math.floor(freeBalance / student.pricePerLesson))
    : 0;

  const streak = (() => {
    const sorted = lessons
      .filter((l: any) => l.status === "completed" || l.status === "cancelled")
      .sort((a: any, b: any) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    let count = 0;
    for (const l of sorted) {
      if ((l as any).status === "cancelled") break;
      count++;
    }
    return count;
  })();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Доброе утро";
    if (hour < 17) return "Добрый день";
    return "Добрый вечер";
  };

  const getMotivation = () => {
    if (avgScore !== null && avgScore >= 80) return "Отличные результаты! Продолжай в том же духе.";
    if (activeHomework.length === 0 && homework.length > 0) return "Все задания выполнены — так держать!";
    if (activeHomework.length > 0) return "У тебя есть активные задания — не откладывай!";
    return "Каждый урок — шаг к цели!";
  };

  const { data: bbbConf } = useQuery<{ hasConference: boolean; joinUrl?: string }>({
    queryKey: ["/api/student/bbb/conference"],
    queryFn: async () => {
      const res = await fetch("/api/student/bbb/conference", { credentials: "include" });
      if (!res.ok) return { hasConference: false };
      return res.json();
    },
    enabled: !!studentId,
    refetchOnWindowFocus: false,
  });

  const hasBbb = bbbConf?.hasConference && bbbConf?.joinUrl;
  const boardType = (student.links as any)?.boardType || (student.links?.board ? "other" : "none");
  const hasBoardLink = true; // Every student always has an internal board
  const isTodayLesson = nextLesson && isToday(new Date(nextLesson.scheduledAt));

  useEffect(() => {
    if (!nextLesson) { setCountdown(null); setMinutesToLesson(null); return; }
    const update = () => {
      const diff = new Date(nextLesson.scheduledAt).getTime() - Date.now();
      const mins = diff / 60000;
      setMinutesToLesson(mins);
      if (diff <= 0) { setCountdown("Занятие началось"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 48) { setCountdown(null); return; }
      if (h > 0) setCountdown(`${h} ч ${m} мин`);
      else if (m > 0) setCountdown(`${m} мин ${s} с`);
      else setCountdown(`${s} с`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextLesson?.scheduledAt]);

  const { data: leaderboard } = useQuery<{ top5: any[]; myRank: number; myEntry: any | null; total: number }>({
    queryKey: ["/api/student/leaderboard"],
    enabled: !!studentId,
    refetchOnWindowFocus: false,
  });

  const { data: progressData } = useQuery<{
    levelInfo: { level: number; name: string; xpCurrent: number; xpForNext: number | null; totalXp: number };
  }>({
    queryKey: ["student-progress"],
    queryFn: async () => {
      const res = await fetch("/api/student/progress", { credentials: "include" });
      if (!res.ok) throw new Error("err");
      return res.json();
    },
    enabled: !!studentId,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const totalHomework = homework.length;
  const doneHomework = homework.filter((h: any) => h.status === "reviewed" || h.status === "submitted").length;
  const hwProgress = totalHomework > 0 ? Math.round((doneHomework / totalHomework) * 100) : 0;

  const displayHomework = activeHomework
    .sort((a: any, b: any) => {
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    })
    .slice(0, 3);

  const getDeadlineUrgency = (deadline: string) => {
    const days = differenceInDays(new Date(deadline), new Date());
    if (isPast(new Date(deadline))) return "overdue";
    if (days <= 1) return "urgent";
    if (days <= 3) return "soon";
    return "normal";
  };

  const weekFromNow = addDays(new Date(), 7);
  const upcomingLessons = lessons
    .filter((l: any) => {
      const d = new Date(l.scheduledAt);
      return (isFuture(d) || isToday(d)) && d <= weekFromNow && l.status !== "cancelled" && l.status !== "completed";
    })
    .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .filter((l: any) => !nextLesson || l.id !== nextLesson.id);

  return (
    <>
      <OnboardingTour isOpen={showOnboarding} onComplete={completeOnboarding} role="student" />
    <div className="space-y-4">
      {/* Telegram section — always visible when bot is running */}
      {tgStatus?.botRunning && tgStatus?.telegramLinked ? (
        <div
          data-testid="banner-telegram-connected"
          className="rounded-2xl border border-green-500/25 bg-gradient-to-br from-green-500/6 via-card to-emerald-500/4 overflow-hidden"
        >
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/15 shrink-0">
              <Bot className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">Telegram подключён</span>
                <Badge className="text-[10px] h-4 bg-green-500/15 text-green-600 dark:text-green-400 border-0">✓ Активен</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Вы получаете уведомления о заданиях, оценках и расписании
              </p>
            </div>
            {tgStatus.botUsername && (
              <a href={`https://t.me/${tgStatus.botUsername}`} target="_blank" rel="noreferrer">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-green-500/30 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 shrink-0"
                  data-testid="button-open-telegram-bot"
                >
                  <Send className="h-3 w-3" />
                  Открыть бот
                </Button>
              </a>
            )}
          </div>
        </div>
      ) : tgStatus?.botRunning ? (
        <TelegramConnectBanner mode="student" botUsername={tgStatus.botUsername} />
      ) : null}

      {/* ── Hero greeting card ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rounded-2xl overflow-hidden relative bg-gradient-to-br from-primary via-primary/80 to-cyan-500 shadow-lg shadow-primary/20">
          {/* Decorative elements */}
          <div className="pointer-events-none absolute right-0 top-0 opacity-10">
            <GraduationCap className="h-36 w-36 text-white -rotate-12 translate-x-4 -translate-y-4" />
          </div>
          <div className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-white/5 blur-xl" />
          <div className="pointer-events-none absolute right-20 -bottom-6 h-20 w-20 rounded-full bg-white/10 blur-lg" />

          <div className="p-4 md:p-5 text-white">
            {/* Top row: greeting + streak + onboarding */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl drop-shadow" data-testid="text-student-greeting">
                  {getGreeting()}, {student.name.split(" ")[0]}!
                </h1>
                <p className="text-sm text-white/75 mt-0.5">
                  {student.subject} · {student.grade}
                  {student.curriculumTopic && <span className="hidden sm:inline"> · {student.curriculumTopic}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {streak >= 2 && (
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="flex items-center gap-1 bg-white/20 backdrop-blur rounded-xl px-2.5 py-1.5"
                  >
                    <Flame className="h-4 w-4 text-orange-300 fill-orange-300" />
                    <span className="text-sm font-black text-white">{streak}</span>
                  </motion.div>
                )}
                <button
                  onClick={resetOnboarding}
                  className="flex items-center gap-1 bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-2.5 py-1.5"
                  data-testid="button-student-onboarding"
                  title="Запустить обучение"
                >
                  <Sparkles className="h-3.5 w-3.5 text-white/80" />
                </button>
              </div>
            </div>

            {/* Goal + motivation */}
            {student.goal && (
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="h-3.5 w-3.5 text-white/70 shrink-0" />
                <span className="text-xs text-white/70">Цель: <span className="text-white font-semibold">{student.goal}</span></span>
              </div>
            )}

            {/* Daily motivational quote */}
            <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2 mb-2">
              <p className="text-xs text-white/90 font-medium italic leading-snug" data-testid="text-motivation">
                «{getDailyQuote()}»
              </p>
            </div>

            {/* Progress bar */}
            {student.progress > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-white/70 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    Прогресс курса
                  </span>
                  <span className="text-[11px] font-bold text-white">{student.progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-white/80"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, student.progress)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {progressData?.levelInfo && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <button
            onClick={() => setLocation("/student/progress")}
            className="w-full text-left"
            data-testid="nav-quick-progress"
          >
            <Card className="rounded-2xl border-border/50 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-3.5">
                {(() => {
                  const li = progressData.levelInfo;
                  const LEVEL_COLORS_HOME: Record<number, { text: string; bar: string; bg: string }> = {
                    1: { text: "text-slate-500",   bar: "bg-slate-400",   bg: "bg-slate-100 dark:bg-slate-800" },
                    2: { text: "text-blue-500",    bar: "bg-blue-500",    bg: "bg-blue-50 dark:bg-blue-950" },
                    3: { text: "text-green-500",   bar: "bg-green-500",   bg: "bg-green-50 dark:bg-green-950" },
                    4: { text: "text-violet-500",  bar: "bg-violet-500",  bg: "bg-violet-50 dark:bg-violet-950" },
                    5: { text: "text-orange-500",  bar: "bg-orange-500",  bg: "bg-orange-50 dark:bg-orange-950" },
                    6: { text: "text-amber-500",   bar: "bg-amber-500",   bg: "bg-amber-50 dark:bg-amber-950" },
                  };
                  const lc = LEVEL_COLORS_HOME[li.level] || LEVEL_COLORS_HOME[1];
                  const pct = li.xpForNext
                    ? Math.min(100, Math.round((li.xpCurrent / li.xpForNext) * 100))
                    : 100;
                  return (
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0", lc.bg, lc.text)}>
                        {li.level}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-sm font-semibold", lc.text)}>{li.name}</span>
                          <div className="flex items-center gap-1">
                            <Zap className={cn("h-3 w-3", lc.text)} />
                            <span className={cn("text-xs font-bold tabular-nums", lc.text)}>{li.totalXp} XP</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            className={cn("h-full rounded-full", lc.bar)}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                          />
                        </div>
                        {li.xpForNext && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {li.xpCurrent} / {li.xpForNext} XP до следующего уровня
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </button>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className={cn(
          "rounded-2xl border-border/50",
          isTodayLesson ? "bg-gradient-to-r from-blue-500/10 to-cyan-500/5 border-blue-500/20" : ""
        )}>
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Monitor className="h-3.5 w-3.5 text-blue-500" />
              {isTodayLesson ? "Сегодня занятие — подключайся!" : "Инструменты для занятий"}
            </p>

            {/* Конференции и доски с поддержкой «по умолчанию» */}
            {(() => {
              const links = student.links as any;
              const conf = parseConferenceLink(links?.conference);
              const defaultConf = links?.defaultConference as string | undefined;
              const defaultBoard = links?.defaultBoard as string | undefined;
              const hasExternalConf = conf && !conf.isInternal;
              const hasJitsi = conf?.isInternal;
              const hasExternalBoard = boardType !== "internal" && boardType !== "none" && links?.board;

              // Build ordered list of conference items
              type ConfItem = { key: string; label: string; sub: string; isDefault: boolean; isBackup: boolean; render: () => ReactNode };
              const confItems: ConfItem[] = [];

              if (hasBbb) {
                const isDefault = defaultConf === "bbb" || (!defaultConf && !hasJitsi && !hasExternalConf);
                const isBackup = !!defaultConf && defaultConf !== "bbb";
                confItems.push({ key: "bbb", label: "BigBlueButton", sub: "Встроенная видеоконференция платформы", isDefault, isBackup, render: () => (
                  <a href={bbbConf!.joinUrl} target="_blank" rel="noopener noreferrer" className="block" key="bbb" data-testid="button-join-bbb-home">
                    <ToolRow icon={<Video className="h-4 w-4 text-blue-500" />} label="BigBlueButton" sub="Встроенная видеоконференция платформы" isDefault={isDefault} isBackup={isBackup} isTodayLesson={isTodayLesson} color="blue" rightIcon={<ExternalLink className="h-4 w-4 text-blue-400 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />} />
                  </a>
                )});
              }
              if (hasJitsi) {
                const isDefault = defaultConf === "jitsi" || (!defaultConf && !hasBbb && !hasExternalConf);
                const isBackup = !!defaultConf && defaultConf !== "jitsi";
                confItems.push({ key: "jitsi", label: "Jitsi", sub: "Встроенная видеосвязь платформы", isDefault, isBackup, render: () => (
                  <button key="jitsi" className="w-full text-left" onClick={() => setLocation("/student/conference")} data-testid="button-join-jitsi-home">
                    <ToolRow icon={<Video className="h-4 w-4 text-blue-500" />} label="Jitsi" sub="Встроенная видеосвязь платформы" isDefault={isDefault} isBackup={isBackup} isTodayLesson={isTodayLesson} color="blue" rightIcon={<ChevronRight className="h-4 w-4 text-blue-400 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />} />
                  </button>
                )});
              }
              if (hasExternalConf) {
                const ServiceIcon = conf!.service === 'zoom' ? SiZoom : conf!.service === 'google_meet' ? SiGooglemeet : Video;
                const label = conf!.service === 'zoom' ? 'Zoom' : conf!.service === 'google_meet' ? 'Google Meet' : conf!.service === 'teams' ? 'Teams' : 'Видеосвязь';
                const isDefault = defaultConf === "external" || (!defaultConf && !hasBbb && !hasJitsi);
                const isBackup = !!defaultConf && defaultConf !== "external";
                confItems.push({ key: "external-conf", label, sub: "Внешний сервис", isDefault, isBackup, render: () => (
                  <a href={conf!.url} target="_blank" rel="noopener noreferrer" className="block" key="external-conf" data-testid="button-join-conf-home">
                    <ToolRow icon={<ServiceIcon className="h-4 w-4 text-blue-500" />} label={label} sub="Внешний сервис" isDefault={isDefault} isBackup={isBackup} isTodayLesson={isTodayLesson} color="blue" rightIcon={<ExternalLink className="h-4 w-4 text-blue-400 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />} />
                  </a>
                )});
              }

              // Board items
              type BoardItem = { key: string; isDefault: boolean; isBackup: boolean; render: () => React.ReactNode };
              const boardItems: BoardItem[] = [];
              const hasMultipleBoards = !!hasExternalBoard;

              {
                const isDefault = !hasMultipleBoards || defaultBoard === "internal" || !defaultBoard;
                const isBackup = hasMultipleBoards && !!defaultBoard && defaultBoard !== "internal";
                boardItems.push({ key: "internal-board", isDefault, isBackup, render: () => (
                  <button key="internal-board" className="w-full text-left" onClick={() => setLocation("/student/board")} data-testid="button-open-internal-board">
                    <ToolRow icon={<PenLine className="h-4 w-4 text-purple-500" />} label="Наша доска" sub="Совместная интерактивная доска — рисуйте и решайте задачи прямо в браузере" isDefault={isDefault && hasMultipleBoards} isBackup={isBackup} isTodayLesson={false} color="purple" rightIcon={<ChevronRight className="h-4 w-4 text-purple-400 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />} />
                  </button>
                )});
              }
              if (hasExternalBoard) {
                const extLabel = boardType === "miro" ? "Miro" : boardType === "figma" ? "Figma" : boardType === "excalidraw" ? "Excalidraw" : "Доска репетитора";
                const isDefault = defaultBoard === "external";
                const isBackup = !!defaultBoard && defaultBoard !== "external";
                const boardUrl = (links!.board as string).startsWith('http') ? links!.board as string : `https://${links!.board}`;
                boardItems.push({ key: "external-board", isDefault, isBackup, render: () => (
                  <a href={boardUrl} target="_blank" rel="noopener noreferrer" className="block" key="external-board">
                    <ToolRow icon={<PenLine className="h-4 w-4 text-purple-500" />} label={extLabel} sub="Внешняя доска от репетитора" isDefault={isDefault} isBackup={isBackup} isTodayLesson={false} color="purple" rightIcon={<ExternalLink className="h-4 w-4 text-purple-400 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />} />
                  </a>
                )});
              }

              // Sort: default first
              const sortedConf = [...confItems].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
              const sortedBoard = [...boardItems].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
              const hasAnyConf = confItems.length > 0;

              return (
                <>
                  {hasAnyConf && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 inline-block" />
                        Конференция
                      </div>
                      {sortedConf.map(item => item.render())}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0 inline-block" />
                      Доска
                    </div>
                    {sortedBoard.map(item => item.render())}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </motion.div>


      {nextLesson && (() => {
        const links = student.links as any;
        const conf = parseConferenceLink(links?.conference);
        const isLessonSoon = minutesToLesson !== null && minutesToLesson <= 30;
        const isLessonStarted = minutesToLesson !== null && minutesToLesson <= 0;
        const showJoinBtn = isTodayLesson && isLessonSoon;

        const primaryConfUrl: string | null = (() => {
          if (hasBbb && bbbConf?.joinUrl) return bbbConf.joinUrl;
          if (conf && conf.url) return conf.url;
          return null;
        })();

        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {showJoinBtn && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-3"
              >
                {primaryConfUrl ? (
                  <a href={primaryConfUrl} target="_blank" rel="noopener noreferrer" data-testid="button-join-lesson-hero">
                    <motion.div
                      animate={isLessonStarted ? { boxShadow: ["0 0 0 0 rgba(59,130,246,0)", "0 0 0 10px rgba(59,130,246,0.22)", "0 0 0 0 rgba(59,130,246,0)"] } : {}}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-4 font-bold text-white transition-all cursor-pointer",
                        isLessonStarted
                          ? "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                          : "bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {isLessonStarted
                          ? <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}><Video className="h-5 w-5" /></motion.div>
                          : <Video className="h-5 w-5" />
                        }
                        <div>
                          <div className="text-sm font-black">
                            {isLessonStarted ? "Занятие идёт — войти сейчас!" : "Войти на урок"}
                          </div>
                          {countdown && !isLessonStarted && (
                            <div className="text-[11px] font-normal opacity-85 font-mono">{countdown}</div>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 opacity-80" />
                    </motion.div>
                  </a>
                ) : (
                  <button onClick={() => setLocation("/student/conference")} className="w-full" data-testid="button-join-lesson-hero">
                    <motion.div
                      animate={isLessonStarted ? { boxShadow: ["0 0 0 0 rgba(59,130,246,0)", "0 0 0 10px rgba(59,130,246,0.22)", "0 0 0 0 rgba(59,130,246,0)"] } : {}}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                      className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-4 font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Video className="h-5 w-5" />
                        <div>
                          <div className="text-sm font-black">{isLessonStarted ? "Занятие идёт — войти сейчас!" : "Войти на урок"}</div>
                          {countdown && !isLessonStarted && <div className="text-[11px] font-normal opacity-85 font-mono">{countdown}</div>}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-80" />
                    </motion.div>
                  </button>
                )}
              </motion.div>
            )}

            <Card className={cn(
              "rounded-2xl border-border/50 overflow-hidden",
              isTodayLesson
                ? "bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border-blue-500/20"
                : "bg-gradient-to-br from-blue-500/10 to-cyan-500/5"
            )}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", isTodayLesson ? "bg-blue-500/25" : "bg-blue-500/20")}>
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                        {isTodayLesson ? "Занятие сегодня" : "Следующее занятие"}
                      </div>
                      <div className="text-sm font-semibold text-blue-700">{getTimeLabel(nextLesson.scheduledAt)}</div>
                      {countdown && !showJoinBtn && (
                        <div className="flex items-center gap-1 text-[11px] text-blue-500 mt-0.5">
                          <Timer className="h-3 w-3" />
                          <span className="font-mono tabular-nums">{countdown}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setLocation("/student/lessons")} className="text-blue-400 hover:text-blue-600 transition-colors shrink-0 mt-1">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {nextLesson.topic ? (
                    <span className="font-medium text-foreground truncate max-w-[200px]">{nextLesson.topic}</span>
                  ) : (
                    <span className="text-muted-foreground italic text-xs">Тема не указана</span>
                  )}
                  <Badge variant="outline" className="text-[10px] gap-1 border-border/50">
                    <Clock className="h-3 w-3" />
                    {nextLesson.durationMinutes} мин
                  </Badge>
                  {activeHomework.length > 0 ? (
                    <Badge className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/20 gap-1">
                      <Square className="h-3 w-3" />
                      Домашка ждёт
                    </Badge>
                  ) : homework.length > 0 ? (
                    <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 gap-1">
                      <CheckSquare className="h-3 w-3" />
                      Домашка сдана
                    </Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })()}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Ср. балл */}
          <button
            className="rounded-xl overflow-hidden relative cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all text-left group bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border border-amber-200/60 dark:border-amber-800/40 p-3"
            onClick={() => setLocation("/student/homework")}
            data-testid="card-avg-score"
          >
            <div className="pointer-events-none absolute right-1.5 top-1.5 opacity-15">
              <Star className="h-9 w-9 text-amber-400 rotate-12" />
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wide mb-1">Ср. балл</p>
            <div className={cn(
              "text-2xl font-black tabular-nums",
              avgScore === null ? "text-muted-foreground" : avgScore >= 80 ? "text-emerald-600" : avgScore >= 50 ? "text-amber-600" : "text-red-500"
            )}>
              {avgScore !== null ? avgScore : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">по домашкам</p>
          </button>

          {/* Предстоит занятий */}
          <button
            className="rounded-xl overflow-hidden relative cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all text-left group bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-blue-950/50 border border-indigo-200/60 dark:border-indigo-800/40 p-3"
            onClick={() => setLocation("/student/lessons")}
          >
            <div className="pointer-events-none absolute right-1.5 top-1.5 opacity-15">
              <Calendar className="h-9 w-9 text-indigo-400 -rotate-6" />
            </div>
            <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-semibold uppercase tracking-wide mb-1">Предстоит</p>
            <div className="text-2xl font-black tabular-nums text-indigo-600">{allUpcoming.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{allUpcoming.length === 1 ? "занятие" : "занятий"}</p>
          </button>

          {/* Осталось занятий (баланс) */}
          <button
            className={cn(
              "rounded-xl overflow-hidden relative cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all text-left group p-3",
              freeBalance > 0
                ? "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 border border-emerald-200/60 dark:border-emerald-800/40"
                : freeBalance < 0
                ? "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border border-red-200/60 dark:border-red-800/40"
                : "bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50"
            )}
            onClick={() => setLocation("/student/finance")}
          >
            <div className="pointer-events-none absolute right-1.5 top-1.5 opacity-15">
              <CircleDollarSign className={cn("h-9 w-9", freeBalance > 0 ? "text-emerald-400" : freeBalance < 0 ? "text-red-400" : "text-muted-foreground")} />
            </div>
            <p className={cn("text-[10px] font-semibold uppercase tracking-wide mb-1",
              freeBalance > 0 ? "text-emerald-700 dark:text-emerald-400" :
              freeBalance < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"
            )}>Оплачено</p>
            <div className={cn("text-2xl font-black tabular-nums",
              freeBalance > 0 ? "text-emerald-600" : freeBalance < 0 ? "text-red-600" : "text-muted-foreground"
            )}>
              {lessonsLeft}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {lessonsLeft === 1 ? "занятие" : lessonsLeft < 5 ? "занятия" : "занятий"}
            </p>
          </button>

          {/* Выполнено ДЗ */}
          <button
            className="rounded-xl overflow-hidden relative cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all text-left group bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/50 dark:to-teal-950/50 border border-cyan-200/60 dark:border-cyan-800/40 p-3"
            onClick={() => setLocation("/student/homework")}
          >
            <div className="pointer-events-none absolute right-1.5 top-1.5 opacity-15">
              <CheckCircle2 className="h-9 w-9 text-cyan-400 rotate-6" />
            </div>
            <p className="text-[10px] text-cyan-700 dark:text-cyan-400 font-semibold uppercase tracking-wide mb-1">Выполнено</p>
            <div className="text-2xl font-black tabular-nums text-cyan-600">{doneHomework}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">из {totalHomework} ДЗ</p>
          </button>
        </div>
      </motion.div>

      {/* ── Daily Goals Card ── */}
      {(activeHomework.length > 0 || isTodayLesson) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
          <Card className="rounded-2xl border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-purple-500/5 overflow-hidden relative">
            <div className="pointer-events-none absolute right-3 top-3 opacity-[0.07]">
              <Trophy className="h-14 w-14 text-violet-500 rotate-6" />
            </div>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/15">
                  <Trophy className="h-3.5 w-3.5 text-violet-600" />
                </div>
                <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">Цели на сегодня</span>
              </div>
              <div className="space-y-2">
                {isTodayLesson && (
                  <div className="flex items-center gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                      <Calendar className="h-3 w-3 text-blue-600" />
                    </div>
                    <span className="text-xs font-medium text-foreground">Занятие сегодня</span>
                    <Badge className="ml-auto text-[9px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-600 border-0">сегодня</Badge>
                  </div>
                )}
                {activeHomework.slice(0, 3).map((hw: any) => {
                  const urgency = hw.deadline ? getDeadlineUrgency(hw.deadline) : "normal";
                  const urgencyClass = urgency === "overdue" ? "text-red-600" : urgency === "urgent" ? "text-orange-600" : "text-muted-foreground";
                  return (
                    <div key={hw.id} className="flex items-center gap-2.5" onClick={() => setLocation("/student/homework")} role="button">
                      <div className="h-5 w-5 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                        <FileText className="h-3 w-3 text-violet-500" />
                      </div>
                      <span className="text-xs text-foreground truncate flex-1">{hw.title}</span>
                      {hw.deadline && (
                        <span className={cn("text-[10px] shrink-0", urgencyClass)}>
                          {urgency === "overdue" ? "просрочено" : urgency === "urgent" ? "сегодня" : format(new Date(hw.deadline), "d MMM", { locale: ru })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Progress bar */}
              <div className="mt-3 pt-3 border-t border-violet-500/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-muted-foreground">ДЗ выполнено</span>
                  <span className="text-[10px] font-bold text-violet-600">{hwProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${hwProgress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className={cn(
          "rounded-2xl border-border/50 cursor-pointer hover:shadow-md transition-shadow",
          freeBalance < 0 ? "border-red-500/20 bg-red-500/5" :
          freeBalance === 0 ? "border-amber-500/20 bg-amber-500/5" :
          "border-emerald-500/20 bg-emerald-500/5"
        )} onClick={() => setLocation("/student/finance")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
                  freeBalance < 0 ? "bg-red-500/15" :
                  freeBalance === 0 ? "bg-amber-500/15" : "bg-emerald-500/15"
                )}>
                  <CircleDollarSign className={cn(
                    "h-5 w-5",
                    freeBalance < 0 ? "text-red-500" :
                    freeBalance === 0 ? "text-amber-500" : "text-emerald-500"
                  )} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Баланс счёта</div>
                  <div className={cn(
                    "text-xl font-bold",
                    freeBalance < 0 ? "text-red-600" :
                    freeBalance === 0 ? "text-amber-600" : "text-emerald-600"
                  )}>
                    {moneyRub(freeBalance)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                {freeBalance > 0 && student.pricePerLesson > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Хватит на <span className="font-semibold text-emerald-600">{lessonsLeft}</span> зан.
                  </div>
                )}
                {freeBalance < 0 && (
                  <Badge variant="destructive" className="text-[10px]">Пополните</Badge>
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 ml-auto" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {activeHomework.length === 0 && totalHomework > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200/60 dark:border-emerald-800/40 p-4 text-center"
          data-testid="hw-all-done-banner"
        >
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">Все задания выполнены!</p>
          <p className="text-xs text-muted-foreground mt-1">Отличная работа! Жди новых заданий от репетитора.</p>
        </motion.div>
      )}

      {displayHomework.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-500" />
              Домашка
            </h2>
            <button onClick={() => setLocation("/student/homework")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Все ({activeHomework.length}) <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {totalHomework > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>Выполнено заданий</span>
                <span>{doneHomework} / {totalHomework} ({hwProgress}%)</span>
              </div>
              <Progress value={hwProgress} className={cn("h-2", hwProgress >= 80 ? "[&>div]:bg-emerald-500" : hwProgress >= 40 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500")} />
            </div>
          )}
          <div className="space-y-2">
            {displayHomework.map((hw: any, idx: number) => {
              const urgency = hw.deadline ? getDeadlineUrgency(hw.deadline) : null;
              return (
                <Card
                  key={hw.id}
                  className={cn(
                    "rounded-xl border-border/50 cursor-pointer hover:shadow-sm transition-shadow",
                    urgency === "overdue" && "border-red-500/30 bg-red-500/5",
                    urgency === "urgent" && "border-amber-500/30 bg-amber-500/5",
                  )}
                  onClick={() => setLocation("/student/homework")}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                        hw.status === "submitted" ? "bg-blue-500/15" :
                        urgency === "overdue" ? "bg-red-500/15" :
                        urgency === "urgent" ? "bg-amber-500/15" : "bg-orange-500/15"
                      )}>
                        {hw.status === "submitted" ? <CheckCircle2 className="h-4 w-4 text-blue-500" /> :
                        urgency === "overdue" ? <AlertCircle className="h-4 w-4 text-red-500" /> :
                        <FileText className={cn("h-4 w-4", urgency === "urgent" ? "text-amber-500" : "text-orange-500")} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{hw.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {hw.deadline && (
                            <span className={cn(
                              "text-[11px]",
                              urgency === "overdue" ? "text-red-500 font-medium" :
                              urgency === "urgent" ? "text-amber-500 font-medium" : "text-muted-foreground"
                            )}>
                              {urgency === "overdue" ? "Просрочено" :
                               `Срок: ${format(new Date(hw.deadline), "d MMM", { locale: ru })}`}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {hw.status === "submitted" ? "Сдано" : hw.status === "in_progress" ? "В работе" : "Новое"}
                          </Badge>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {
              label: "Занятия",
              hint: `${allUpcoming.length} предстоит`,
              icon: Calendar,
              path: "/student/lessons",
              gradient: "from-blue-500 to-indigo-500",
              bg: "bg-blue-50 dark:bg-blue-950/40",
              border: "border-blue-200/60 dark:border-blue-800/40",
              textColor: "text-blue-700 dark:text-blue-300",
            },
            {
              label: "Домашка",
              hint: activeHomework.length > 0 ? `${activeHomework.length} активных` : "Всё сдано ✓",
              icon: FileText,
              path: "/student/homework",
              gradient: "from-orange-500 to-amber-500",
              bg: "bg-orange-50 dark:bg-orange-950/40",
              border: "border-orange-200/60 dark:border-orange-800/40",
              textColor: "text-orange-700 dark:text-orange-300",
            },
            {
              label: "Задачник",
              hint: "Варианты от репетитора",
              icon: BookOpen,
              path: "/student/tasks",
              gradient: "from-violet-500 to-purple-500",
              bg: "bg-violet-50 dark:bg-violet-950/40",
              border: "border-violet-200/60 dark:border-violet-800/40",
              textColor: "text-violet-700 dark:text-violet-300",
            },
            {
              label: "ИИ-помощник",
              hint: "Помощь с заданиями",
              icon: Sparkles,
              path: "/student/ai",
              gradient: "from-cyan-500 to-blue-500",
              bg: "bg-cyan-50 dark:bg-cyan-950/40",
              border: "border-cyan-200/60 dark:border-cyan-800/40",
              textColor: "text-cyan-700 dark:text-cyan-300",
            },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <motion.button
                key={link.path}
                onClick={() => setLocation(link.path)}
                data-testid={`nav-quick-${link.label}`}
                whileHover={{ y: -2 }}
                className={cn("flex flex-col items-center gap-2 p-3.5 rounded-xl border hover:shadow-md transition-all text-center", link.bg, link.border)}
              >
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm", link.gradient)}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className={cn("text-sm font-bold", link.textColor)}>{link.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{link.hint}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {(() => {
        const materials: {title: string; url: string}[] = (student.links as any)?.materials ?? [];
        if (materials.length === 0) return null;
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33 }}>
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Paperclip className="h-4 w-4 text-primary" />
                  Материалы от репетитора
                </h2>
                <div className="space-y-1.5">
                  {materials.map((m, i) => (
                    <a
                      key={i}
                      href={m.url.startsWith("http") ? m.url : `https://${m.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                      data-testid={`material-link-${i}`}
                    >
                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="flex-1 truncate">{m.title || m.url}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })()}

      {leaderboard && leaderboard.total > 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
          <Card className="rounded-2xl border-border/50 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Рейтинг класса
                </h2>
                <Badge variant="outline" className="text-[10px]">#{leaderboard.myRank} из {leaderboard.total}</Badge>
              </div>

              {leaderboard.top5.length >= 3 && (
                <div className="flex items-end justify-center gap-1.5 mb-3">
                  {[leaderboard.top5[1], leaderboard.top5[0], leaderboard.top5[2]].map((entry, podiumIdx) => {
                    const rank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3;
                    const heights = ["h-16", "h-20", "h-12"];
                    const bgColors = [
                      "bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300",
                      "bg-amber-50 dark:bg-amber-950 border-t-2 border-amber-400",
                      "bg-orange-50 dark:bg-orange-950 border-t-2 border-orange-400",
                    ];
                    const medals = ["🥈", "🥇", "🥉"];
                    return (
                      <div key={entry.studentId} className="flex flex-col items-center gap-0.5 flex-1 max-w-[80px]">
                        <span className="text-base leading-none">{medals[podiumIdx]}</span>
                        <div className={cn(
                          "w-full rounded-t-lg flex flex-col items-center justify-end pb-1.5 pt-1 px-0.5",
                          heights[podiumIdx], bgColors[podiumIdx],
                          entry.isMe && "ring-1 ring-primary"
                        )}>
                          <p className={cn("text-[11px] font-bold text-center leading-tight truncate w-full px-1", entry.isMe && "text-primary")}>
                            {entry.name}
                          </p>
                          <p className="text-[9px] text-muted-foreground">{entry.totalScore} б.</p>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                          rank === 1 ? "bg-amber-400 text-white" : rank === 2 ? "bg-slate-400 text-white" : "bg-orange-400 text-white"
                        )}>{rank}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1">
                {leaderboard.top5.slice(3).map((entry: any, idx: number) => (
                  <div
                    key={entry.studentId}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm",
                      entry.isMe ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                    )}
                  >
                    <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0 text-muted-foreground">
                      {idx + 4}
                    </div>
                    <span className={cn("flex-1 font-medium truncate text-sm", entry.isMe && "text-primary")}>
                      {entry.name}{entry.isMe ? " (ты)" : ""}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-muted-foreground">{entry.totalScore}</span>
                  </div>
                ))}
                {leaderboard.myEntry && (
                  <>
                    <div className="text-center text-[10px] text-muted-foreground py-0.5">· · ·</div>
                    <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm bg-primary/10 border border-primary/20">
                      <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold shrink-0 text-primary">
                        {leaderboard.myRank}
                      </div>
                      <span className="flex-1 font-medium truncate text-primary">{leaderboard.myEntry.name} (ты)</span>
                      <span className="text-xs font-bold tabular-nums text-primary">{leaderboard.myEntry.totalScore}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {upcomingLessons.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Занятия на неделе
            </h2>
            <button onClick={() => setLocation("/student/lessons")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Все занятия <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {upcomingLessons.map((lesson: any) => (
              <Card key={lesson.id} className="rounded-xl border-border/50 cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setLocation("/student/lessons")}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 bg-blue-500/15">
                      <Calendar className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lesson.topic || "Занятие"}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span>{getTimeLabel(lesson.scheduledAt)}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {lesson.durationMinutes} мин
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-500" />
                Что нового
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={changelogIdx >= studentChangelog.length - 1}
                  onClick={() => setChangelogIdx(i => i + 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={changelogIdx <= 0}
                  onClick={() => setChangelogIdx(i => i - 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {(() => {
              const rel = studentChangelog[changelogIdx];
              if (!rel) return null;
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">v{rel.version}</Badge>
                    <span className="text-xs text-muted-foreground">{rel.date}</span>
                  </div>
                  <div className="space-y-1.5">
                    {rel.items.map((item, i) => {
                      const style = TAG_STYLES[item.tag];
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0 mt-0.5", style.className)}>
                            {style.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{item.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </motion.div>
    </div>
    </>
  );
}
