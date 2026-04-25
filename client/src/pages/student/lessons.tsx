import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Monitor,
  PenTool,
  Star,
  FileText,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Info,
  BarChart3,
  TrendingUp,
  XCircle,
  AlertCircle,
  List,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  CalendarCheck,
  Video,
  PenLine,
  Download,
} from "lucide-react";
import { SiZoom, SiGooglemeet } from "react-icons/si";
import {
  format, isPast, isFuture, isToday, isSameDay, isSameMonth,
  getDay, addDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  differenceInDays,
} from "date-fns";
import { ru } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { parseConferenceLink } from "@/lib/conference-utils";

interface Lesson {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  topic: string;
  status: string;
  attendance?: string;
  rating?: number;
  notes?: string;
}

interface StudentLessonsProps {
  lessons: Lesson[];
  links?: { conference?: string; board?: string };
  onOpenHomework?: () => void;
  pricePerLesson?: number;
  studentId?: string;
}

const DAYS_RU: Record<number, string> = {
  0: "Воскресенье",
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
};

const SHORT_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getLessonStatusBadge(lesson: Lesson) {
  if (lesson.status === "completed") {
    if (lesson.attendance === "attended") {
      return <Badge className="bg-emerald-500 text-white text-[10px]">Оплачено</Badge>;
    }
    if (lesson.attendance === "attended_unpaid") {
      return <Badge className="bg-red-500 text-white text-[10px]">Не оплачено</Badge>;
    }
    if (lesson.attendance === "missed_paid") {
      return <Badge className="bg-amber-500 text-white text-[10px]">Пропуск (оплачен)</Badge>;
    }
    return <Badge className="bg-emerald-500 text-white text-[10px]">Проведено</Badge>;
  }
  if (lesson.status === "cancelled") {
    return <Badge variant="destructive" className="text-[10px]">Отменено</Badge>;
  }
  return <Badge variant="secondary" className="text-[10px]">Запланировано</Badge>;
}

function pluralLessons(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "занятие";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "занятия";
  return "занятий";
}

type ViewMode = "list" | "day" | "week" | "month";

const DAY_HOURS = Array.from({ length: 15 }, (_, i) => 7 + i);

export default function StudentLessons({ lessons, links, onOpenHomework, pricePerLesson = 0, studentId }: StudentLessonsProps) {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showCancelled, setShowCancelled] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

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
  const bbbJoinUrl = bbbConf?.hasConference && bbbConf?.joinUrl ? bbbConf.joinUrl : null;

  type LinkSettings = { showBbb: boolean; showExternalConf: boolean; showInternalBoard: boolean; showExternalBoard: boolean };
  const { data: rawLinkSettings } = useQuery<LinkSettings>({
    queryKey: ["/api/student/link-settings"],
    queryFn: async () => {
      const res = await fetch("/api/student/link-settings", { credentials: "include" });
      if (!res.ok) return { showBbb: true, showExternalConf: true, showInternalBoard: true, showExternalBoard: true };
      return res.json();
    },
    enabled: !!studentId,
    refetchOnWindowFocus: false,
  });
  const ls: LinkSettings = { showBbb: true, showExternalConf: true, showInternalBoard: true, showExternalBoard: true, ...rawLinkSettings };

  const now = new Date();

  const allUpcoming = useMemo(() =>
    lessons
      .filter(l => {
        const d = new Date(l.scheduledAt);
        return (isFuture(d) || isToday(d)) && l.status !== "cancelled" && l.status !== "completed";
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [lessons]
  );

  const completedLessons = useMemo(() =>
    lessons.filter(l => l.status === "completed"),
    [lessons]
  );

  const paidCount = completedLessons.filter(l => l.attendance === "attended").length;
  const unpaidCount = completedLessons.filter(l => l.attendance === "attended_unpaid").length;

  const cancelledCount = useMemo(() =>
    lessons.filter(l => l.status === "cancelled").length,
    [lessons]
  );

  const confInfo = parseConferenceLink(links?.conference);
  const hasLinks = (ls.showExternalConf && !!confInfo) || (ls.showExternalBoard && !!links?.board) || (ls.showBbb && !!bbbJoinUrl) || (ls.showInternalBoard && !!studentId);
  const noLinks = !hasLinks;

  const nextLessonDate = allUpcoming[0] ? new Date(allUpcoming[0].scheduledAt) : null;
  const daysUntilNext = nextLessonDate ? differenceInDays(nextLessonDate, now) : null;

  const weekStart = useMemo(() => {
    const base = addWeeks(now, weekOffset);
    return startOfWeek(base, { weekStartsOn: 1 });
  }, [weekOffset]);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const monthDate = useMemo(() => addMonths(now, monthOffset), [monthOffset]);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthStart, monthEnd]);

  const lessonsForDay = (day: Date) =>
    lessons.filter(l => {
      if (l.status === "cancelled" && !showCancelled) return false;
      return isSameDay(new Date(l.scheduledAt), day);
    }).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const dayDate = useMemo(() => addDays(now, dayOffset), [dayOffset]);

  const lessonsForDay2 = (day: Date) =>
    lessons.filter(l => {
      if (l.status === "cancelled" && !showCancelled) return false;
      return isSameDay(new Date(l.scheduledAt), day);
    }).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const goToToday = () => {
    setWeekOffset(0);
    setMonthOffset(0);
    setDayOffset(0);
    setSelectedDay(null);
  };

  const renderLessonCard = (lesson: Lesson, compact = false) => {
    const lessonDate = new Date(lesson.scheduledAt);
    const isTodayL = isToday(lessonDate);

    return (
      <div
        key={lesson.id}
        className={cn(
          "p-3 rounded-lg border space-y-1",
          lesson.status === "cancelled" ? "bg-red-500/5 border-red-500/10" :
          isTodayL ? "bg-blue-500/10 border-blue-500/20" :
          isFuture(lessonDate) ? "bg-indigo-500/5 border-indigo-500/10" :
          "bg-muted/50 border-border/50"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {!compact && (
              <p className="font-medium text-sm">
                {format(lessonDate, "d MMMM yyyy, HH:mm", { locale: ru })}
              </p>
            )}
            {compact && (
              <p className="font-medium text-sm">
                {format(lessonDate, "HH:mm")} — {lesson.topic || "Занятие"}
              </p>
            )}
            {!compact && lesson.topic && (
              <p className="text-xs text-muted-foreground truncate">{lesson.topic}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {getLessonStatusBadge(lesson)}
            <Badge variant="outline" className="text-[10px]">{lesson.durationMinutes} мин</Badge>
          </div>
        </div>

        {(isTodayL || isFuture(lessonDate)) && lesson.status !== "cancelled" && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ls.showExternalConf && confInfo && !confInfo.isInternal && (() => {
              const Icon = confInfo.service === 'zoom' ? SiZoom : confInfo.service === 'google_meet' ? SiGooglemeet : Monitor;
              return (
                <a href={confInfo.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant={isTodayL ? "default" : "outline"} className="h-7 px-2.5 text-[11px] gap-1">
                    <Icon className="w-3 h-3" />
                    {confInfo.displayName}
                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                  </Button>
                </a>
              );
            })()}
            {ls.showBbb && bbbJoinUrl && (
              <a href={bbbJoinUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant={isTodayL ? "default" : "outline"} className="h-7 px-2.5 text-[11px] gap-1">
                  <Video className="w-3 h-3 text-blue-500" />
                  BBB
                </Button>
              </a>
            )}
            {ls.showExternalBoard && links?.board && (
              <a href={links.board.startsWith('http') ? links.board : `https://${links.board}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] gap-1">
                  <PenLine className="w-3 h-3 text-violet-500" />
                  Доска
                  <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                </Button>
              </a>
            )}
            {ls.showInternalBoard && studentId && (
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] gap-1 border-purple-500/30 text-purple-700"
                onClick={() => setLocation("/student/board")}>
                <LayoutGrid className="w-3 h-3 text-purple-500" />
                Наша доска
              </Button>
            )}
          </div>
        )}

        {(lesson.notes || lesson.rating) && (
          <div className="pt-1.5 border-t border-border/50 space-y-1">
            {lesson.rating && (
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium">Оценка: {lesson.rating}/5</span>
              </div>
            )}
            {lesson.notes && (
              <div className="flex items-start gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">{lesson.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const upcomingListLessons = useMemo(() => {
    const now = new Date();
    return lessons
      .filter(l => new Date(l.scheduledAt) >= now && l.status !== "completed" && l.status !== "cancelled")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [lessons]);

  const pastListLessons = useMemo(() => {
    const now = new Date();
    return lessons
      .filter(l => {
        if (l.status === "cancelled" && !showCancelled) return false;
        return new Date(l.scheduledAt) < now || l.status === "completed";
      })
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }, [lessons, showCancelled]);

  const PAGE_SIZE = 5;

  const [upcomingPage, setUpcomingPage] = useState(0);
  const pagedUpcoming = upcomingListLessons.slice(upcomingPage * PAGE_SIZE, (upcomingPage + 1) * PAGE_SIZE);
  const totalUpcomingPages = Math.ceil(upcomingListLessons.length / PAGE_SIZE);

  const [pastPage, setPastPage] = useState(0);
  const pagedPast = pastListLessons.slice(pastPage * PAGE_SIZE, (pastPage + 1) * PAGE_SIZE);
  const totalPastPages = Math.ceil(pastListLessons.length / PAGE_SIZE);

  const downloadIcs = () => {
    const upcoming = lessons
      .filter(l => isFuture(new Date(l.scheduledAt)) || isToday(new Date(l.scheduledAt)))
      .filter(l => l.status !== "cancelled" && l.status !== "completed");
    if (upcoming.length === 0) return;

    const formatIcsDate = (date: Date) =>
      date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const events = upcoming.map(l => {
      const start = new Date(l.scheduledAt);
      const end = new Date(start.getTime() + (l.durationMinutes || 60) * 60000);
      const uid = `lesson-${l.id}@tvoyvector.ru`;
      const summary = l.topic ? `Занятие: ${l.topic}` : "Занятие с репетитором";
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:Занятие на платформе Твой Вектор`,
        "END:VEVENT",
      ].join("\r\n");
    });

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Твой Вектор//RU",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tvoyvector-lessons.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Занятия</h1>
          <p className="text-muted-foreground mt-1">Расписание, календарь и история</p>
        </div>
        {allUpcoming.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={downloadIcs}
            className="gap-1.5 shrink-0 border-blue-500/30 text-blue-600 hover:bg-blue-500/5"
            data-testid="button-export-ics"
            title="Скачать файл .ics для добавления занятий в Google Calendar, Apple Calendar, Outlook"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">В календарь</span>
          </Button>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-blue-500/5 border border-blue-500/10 px-4 py-2.5">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Переключайте между списком, недельным и месячным видом. Оплаченные занятия отмечены зелёным, неоплаченные — красным. Нажмите на занятие чтобы войти в конференцию или просмотреть тему.{" "}
          <a href="/student/help" className="text-primary underline underline-offset-2 hover:no-underline font-medium">Инструкция →</a>
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Card className="rounded-xl border-border/50">
          <CardContent className="p-2.5 text-center">
            <BarChart3 className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-600">{completedLessons.length}</div>
            <div className="text-[9px] text-muted-foreground leading-tight">Проведено</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50">
          <CardContent className="p-2.5 text-center">
            <TrendingUp className="h-4 w-4 text-indigo-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-indigo-600">{allUpcoming.length}</div>
            <div className="text-[9px] text-muted-foreground leading-tight">Предстоит</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50">
          <CardContent className="p-2.5 text-center">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-emerald-600">{paidCount}</div>
            <div className="text-[9px] text-muted-foreground leading-tight">Оплачено</div>
          </CardContent>
        </Card>
        <Card className={cn("rounded-xl", unpaidCount > 0 ? "border-red-500/20" : "border-border/50")}>
          <CardContent className="p-2.5 text-center">
            <AlertCircle className={cn("h-4 w-4 mx-auto mb-1", unpaidCount > 0 ? "text-red-500" : "text-muted-foreground")} />
            <div className={cn("text-lg font-bold", unpaidCount > 0 ? "text-red-600" : "text-muted-foreground")}>{unpaidCount}</div>
            <div className="text-[9px] text-muted-foreground leading-tight">Не оплачено</div>
          </CardContent>
        </Card>
        <Card className={cn("rounded-xl cursor-pointer transition-colors hover:bg-muted/40", cancelledCount > 0 ? "border-orange-500/20" : "border-border/50")}
          onClick={() => setShowCancelled(v => !v)}>
          <CardContent className="p-2.5 text-center">
            <XCircle className={cn("h-4 w-4 mx-auto mb-1", cancelledCount > 0 ? "text-orange-500" : "text-muted-foreground")} />
            <div className={cn("text-lg font-bold", cancelledCount > 0 ? "text-orange-600" : "text-muted-foreground")}>{cancelledCount}</div>
            <div className="text-[9px] text-muted-foreground leading-tight">Отменено</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50">
          <CardContent className="p-2.5 text-center">
            <Calendar className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-600">{lessons.length}</div>
            <div className="text-[9px] text-muted-foreground leading-tight">Всего</div>
          </CardContent>
        </Card>
      </div>

      {(() => {
        const ratedLessons = completedLessons
          .filter(l => l.rating != null && l.rating > 0)
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
          .slice(-20);
        if (ratedLessons.length < 2) return null;
        const chartData = ratedLessons.map((l, i) => ({
          num: i + 1,
          label: format(new Date(l.scheduledAt), "d MMM", { locale: ru }),
          rating: l.rating,
        }));
        const avgRating = Math.round(ratedLessons.reduce((s, l) => s + (l.rating ?? 0), 0) / ratedLessons.length * 10) / 10;
        return (
          <Card className="rounded-xl border-border/50">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                История оценок
                <Badge variant="outline" className="ml-auto text-xs">Среднее: {avgRating} ⭐</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -30, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <RechartTooltip
                    formatter={(v: number) => [`${v} ⭐`, "Оценка"]}
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid var(--border)" }}
                  />
                  <ReferenceLine y={avgRating} stroke="var(--amber-400, #fbbf24)" strokeDasharray="4 4" strokeWidth={1} />
                  <Line type="monotone" dataKey="rating" stroke="var(--amber-500, #f59e0b)" strokeWidth={2} dot={{ r: 3, fill: "var(--amber-500, #f59e0b)" }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}

      {hasLinks && (
        <Card className="rounded-xl border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-blue-600 mb-2 flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5" />
              Ссылки для занятий
            </p>
            <div className="flex flex-wrap gap-2">
              {ls.showExternalConf && confInfo && !confInfo.isInternal && (() => {
                const Icon = confInfo.service === 'zoom' ? SiZoom : confInfo.service === 'google_meet' ? SiGooglemeet : Monitor;
                return (
                  <a href={confInfo.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="default" className="gap-1.5 h-8">
                      <Icon className="w-3.5 h-3.5" />
                      {confInfo.displayName}
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </Button>
                  </a>
                );
              })()}
              {ls.showBbb && bbbJoinUrl && (
                <a href={bbbJoinUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="default" className="gap-1.5 h-8">
                    <Video className="w-3.5 h-3.5" />
                    BBB-конференция
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </Button>
                </a>
              )}
              {ls.showExternalBoard && links?.board && (
                <a href={links.board.startsWith('http') ? links.board : `https://${links.board}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8">
                    <PenLine className="w-3.5 h-3.5 text-violet-500" />
                    Доска (внешняя)
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </Button>
                </a>
              )}
              {ls.showInternalBoard && studentId && (
                <Button size="sm" variant="outline" className="gap-1.5 h-8 border-purple-500/30 text-purple-700 hover:bg-purple-500/5"
                  onClick={() => setLocation("/student/board")}>
                  <LayoutGrid className="w-3.5 h-3.5 text-purple-500" />
                  Наша доска
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {noLinks && (
        <Card className="rounded-xl border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700">Ссылки на конференцию и доску ещё не добавлены</p>
                <p className="text-xs text-muted-foreground mt-0.5">Попросите репетитора добавить ссылки в настройках вашего профиля.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {daysUntilNext !== null && (
        <Card className="rounded-xl border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm">
                {daysUntilNext === 0
                  ? "Следующее занятие — сегодня!"
                  : daysUntilNext === 1
                  ? "Следующее занятие — завтра"
                  : `До следующего занятия: ${daysUntilNext} ${daysUntilNext < 5 ? "дня" : "дней"}`}
              </span>
            </div>
            {nextLessonDate && (
              <span className="text-xs text-muted-foreground">
                {format(nextLessonDate, "d MMM, HH:mm", { locale: ru })}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4 text-primary" />
              Расписание
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 border rounded-lg p-0.5">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-3.5 w-3.5" />
                  Список
                </Button>
                <Button
                  variant={viewMode === "day" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => setViewMode("day")}
                >
                  <CalendarCheck className="h-3.5 w-3.5" />
                  День
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => setViewMode("week")}
                >
                  <CalendarRange className="h-3.5 w-3.5" />
                  Неделя
                </Button>
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => setViewMode("month")}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Месяц
                </Button>
              </div>

              {(viewMode === "day" || viewMode === "week" || viewMode === "month") && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      if (viewMode === "day") setDayOffset(o => o - 1);
                      else if (viewMode === "week") setWeekOffset(o => o - 1);
                      else setMonthOffset(o => o - 1);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={goToToday}
                  >
                    Сегодня
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      if (viewMode === "day") setDayOffset(o => o + 1);
                      else if (viewMode === "week") setWeekOffset(o => o + 1);
                      else setMonthOffset(o => o + 1);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {cancelledCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setShowCancelled(!showCancelled)}
                >
                  {showCancelled ? "Скрыть отменённые" : `+ Отменённые (${cancelledCount})`}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "month" && (
            <div>
              <p className="text-sm font-medium text-center mb-3 capitalize">
                {format(monthDate, "LLLL yyyy", { locale: ru })}
              </p>
              <div className="grid grid-cols-7 gap-px bg-border/50 rounded-lg overflow-hidden border border-border/50">
                {SHORT_DAYS.map(d => (
                  <div key={d} className="bg-muted/30 py-1.5 text-center text-[10px] font-semibold text-muted-foreground uppercase">{d}</div>
                ))}
                {monthDays.map((day, i) => {
                  const dayLessons = lessonsForDay(day);
                  const isCurrentMonth = isSameMonth(day, monthDate);
                  const isTodayD = isToday(day);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const hasPaid = dayLessons.some(l => l.attendance === "attended");
                  const hasUnpaid = dayLessons.some(l => l.attendance === "attended_unpaid");
                  const hasUpcoming = dayLessons.some(l => l.status !== "completed" && l.status !== "cancelled");
                  const hasCancelled = dayLessons.some(l => l.status === "cancelled");

                  return (
                    <button
                      key={i}
                      onClick={() => dayLessons.length > 0 ? setSelectedDay(isSelected ? null : day) : undefined}
                      className={cn(
                        "bg-background py-1.5 px-1 min-h-[48px] flex flex-col items-center gap-0.5 transition-colors relative",
                        !isCurrentMonth && "opacity-30",
                        isSelected && "bg-primary/10 ring-1 ring-primary",
                        isTodayD && !isSelected && "bg-blue-500/10",
                        dayLessons.length > 0 && "cursor-pointer hover:bg-accent/50",
                      )}
                    >
                      <span className={cn(
                        "text-xs w-6 h-6 flex items-center justify-center rounded-full",
                        isTodayD && "bg-primary text-primary-foreground font-bold",
                      )}>
                        {format(day, "d")}
                      </span>
                      {dayLessons.length > 0 && (
                        <div className="flex gap-0.5">
                          {hasUpcoming && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                          {hasPaid && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          {hasUnpaid && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                          {hasCancelled && <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-blue-500" /> Заплан.
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" /> Оплач.
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-red-500" /> Не опл.
                </div>
              </div>

              <AnimatePresence>
                {selectedDay && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm font-medium mb-2">
                        {format(selectedDay, "d MMMM, EEEE", { locale: ru })}
                      </p>
                      <div className="space-y-2">
                        {lessonsForDay(selectedDay).length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3">Нет занятий</p>
                        ) : (
                          lessonsForDay(selectedDay).map(l => renderLessonCard(l, true))
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {viewMode === "day" && (
            <div>
              <p className="text-sm font-medium text-center mb-3 capitalize">
                {format(dayDate, "EEEE, d MMMM yyyy", { locale: ru })}
                {isToday(dayDate) && <Badge className="ml-2 text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/20 border">Сегодня</Badge>}
              </p>
              <div className="border rounded-xl overflow-hidden">
                {DAY_HOURS.map(hour => {
                  const hourLessons = lessonsForDay2(dayDate).filter(l => {
                    const h = new Date(l.scheduledAt).getHours();
                    return h === hour;
                  });
                  const isCurrentHour = isToday(dayDate) && new Date().getHours() === hour;
                  return (
                    <div key={hour} className={cn(
                      "flex border-b last:border-b-0 min-h-[48px]",
                      isCurrentHour ? "bg-blue-500/5" : hour % 2 === 0 ? "bg-background" : "bg-muted/20"
                    )}>
                      <div className={cn(
                        "w-12 shrink-0 text-right text-[10px] font-mono pt-2 pr-2 border-r select-none",
                        isCurrentHour ? "text-blue-600 font-semibold" : "text-muted-foreground"
                      )}>
                        {String(hour).padStart(2, "0")}:00
                      </div>
                      <div className="flex-1 p-1 space-y-1">
                        {hourLessons.map(lesson => {
                          const lessonDate = new Date(lesson.scheduledAt);
                          const isTodayL = isToday(lessonDate);
                          const isCancelled = lesson.status === "cancelled";
                          const isCompleted = lesson.status === "completed" || lesson.status === "attended";
                          return (
                            <div key={lesson.id} className={cn(
                              "rounded-lg px-2 py-1.5 text-xs",
                              isCancelled
                                ? "bg-orange-500/10 border border-orange-500/20 text-orange-700"
                                : isCompleted
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700"
                                : "bg-blue-500/10 border border-blue-500/20 text-blue-700"
                            )}>
                              <div className="font-medium flex items-center gap-1.5">
                                <Clock className="h-3 w-3 shrink-0" />
                                {format(lessonDate, "HH:mm")}
                                {lesson.durationMinutes && <span className="text-[10px] opacity-70">· {lesson.durationMinutes} мин</span>}
                              </div>
                              {lesson.topic && <div className="mt-0.5 opacity-80 truncate">{lesson.topic}</div>}
                              {!isCancelled && (isTodayL || isFuture(lessonDate)) && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {ls.showExternalConf && confInfo && !confInfo.isInternal && (
                                    <a href={confInfo.url} target="_blank" rel="noopener noreferrer">
                                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 cursor-pointer">
                                        <Monitor className="h-2.5 w-2.5" />{confInfo.displayName}
                                      </span>
                                    </a>
                                  )}
                                  {ls.showBbb && bbbJoinUrl && (
                                    <a href={bbbJoinUrl} target="_blank" rel="noopener noreferrer">
                                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-700 hover:bg-cyan-500/30 cursor-pointer">
                                        <Video className="h-2.5 w-2.5" />BBB
                                      </span>
                                    </a>
                                  )}
                                  {ls.showExternalBoard && links?.board && (
                                    <a href={links.board.startsWith('http') ? links.board : `https://${links.board}`} target="_blank" rel="noopener noreferrer">
                                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-700 hover:bg-violet-500/30 cursor-pointer">
                                        <PenLine className="h-2.5 w-2.5" />Доска
                                      </span>
                                    </a>
                                  )}
                                  {ls.showInternalBoard && studentId && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-700 hover:bg-purple-500/30 cursor-pointer"
                                      onClick={() => setLocation("/student/board")}>
                                      <LayoutGrid className="h-2.5 w-2.5" />Наша доска
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {lessonsForDay2(dayDate).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Занятий нет</p>
              )}
            </div>
          )}

          {viewMode === "week" && (
            <div>
              <p className="text-sm font-medium text-center mb-3">
                {format(weekStart, "d MMM", { locale: ru })} — {format(weekEnd, "d MMM yyyy", { locale: ru })}
              </p>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, i) => {
                  const dayLessons = lessonsForDay(day);
                  const isTodayD = isToday(day);

                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border min-h-[100px] p-1.5 flex flex-col",
                        isTodayD ? "border-blue-500/30 bg-blue-500/5" : "border-border/50",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "text-[10px] font-semibold uppercase",
                          isTodayD ? "text-blue-600" : "text-muted-foreground"
                        )}>
                          {SHORT_DAYS[i]}
                        </span>
                        <span className={cn(
                          "text-xs w-5 h-5 flex items-center justify-center rounded-full",
                          isTodayD && "bg-primary text-primary-foreground font-bold"
                        )}>
                          {format(day, "d")}
                        </span>
                      </div>
                      <div className="space-y-1 flex-1">
                        {dayLessons.map(l => {
                          const lDate = new Date(l.scheduledAt);
                          const isUpcoming = (isToday(lDate) || isFuture(lDate)) && l.status !== "cancelled";
                          return (
                            <div
                              key={l.id}
                              className={cn(
                                "rounded px-1.5 py-1 text-[10px]",
                                l.status === "cancelled" ? "bg-red-500/10 text-red-600" :
                                l.status === "completed" && l.attendance === "attended" ? "bg-emerald-500/15 text-emerald-700" :
                                l.status === "completed" && l.attendance === "attended_unpaid" ? "bg-red-500/10 text-red-600" :
                                "bg-blue-500/10 text-blue-700",
                              )}
                            >
                              <div className="font-medium">{format(lDate, "HH:mm")}</div>
                              {l.topic && <div className="truncate opacity-75">{l.topic}</div>}
                              {isUpcoming && (
                                <div className="flex gap-0.5 mt-0.5">
                                  {confInfo && !confInfo.isInternal && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" title={confInfo.displayName} />}
                                  {bbbJoinUrl && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="BBB" />}
                                  {links?.board && <div className="w-1.5 h-1.5 rounded-full bg-violet-400" title="Доска (внешняя)" />}
                                  {studentId && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" title="Наша доска" />}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {dayLessons.length === 0 && (
                          <div className="flex-1 flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground/40">—</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "list" && (
            <div className="space-y-5">

              {/* ─── Предстоящие занятия ─── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                      Предстоящие ({upcomingListLessons.length})
                    </span>
                  </div>
                  {totalUpcomingPages > 1 && (
                    <span className="text-xs text-muted-foreground">{upcomingPage + 1} / {totalUpcomingPages}</span>
                  )}
                </div>
                {upcomingListLessons.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">Нет запланированных занятий</p>
                ) : (
                  <div className="space-y-2">
                    {pagedUpcoming.map(l => renderLessonCard(l))}
                  </div>
                )}
                {totalUpcomingPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={upcomingPage === 0}
                      onClick={() => setUpcomingPage(p => p - 1)}
                      className="gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Назад
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={upcomingPage >= totalUpcomingPages - 1}
                      onClick={() => setUpcomingPage(p => p + 1)}
                      className="gap-1"
                    >
                      Вперёд
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* ─── История занятий ─── */}
              {pastListLessons.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 pt-1 border-t border-border/40">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground mt-2" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">
                      История ({pastListLessons.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pagedPast.map(l => renderLessonCard(l))}
                  </div>
                  {totalPastPages > 1 && (
                    <div className="flex items-center justify-between pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pastPage === 0}
                        onClick={() => setPastPage(p => p - 1)}
                        className="gap-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Назад
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {pastPage + 1} из {totalPastPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pastPage >= totalPastPages - 1}
                        onClick={() => setPastPage(p => p + 1)}
                        className="gap-1"
                      >
                        Далее
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {upcomingListLessons.length === 0 && pastListLessons.length === 0 && (
                <p className="text-muted-foreground text-center py-8 text-sm">Ещё нет занятий</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
