import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, startOfWeek, endOfWeek, startOfYear, endOfYear, subWeeks, addWeeks, subYears, addYears, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Percent,
  BookOpen,
  Award,
  Flame,
  Star,
  Hash,
  CircleDollarSign,
  DollarSign,
  Info,
  Zap,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHero } from "@/components/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStudents, useLessons, usePayments } from "@/hooks/use-tutor-data";
import { cn } from "@/lib/utils";

import { useDocumentTitle } from "@/hooks/use-document-title";
function moneyRub(amount: number) {
  const sign = amount < 0 ? "\u2212" : "";
  const v = Math.abs(amount);
  return `${sign}${v.toLocaleString("ru-RU")} \u20BD`;
}

function shortMoney(amount: number) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}М`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}к`;
  return String(amount);
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string) {
  const colors = [
    "from-blue-500 to-cyan-600",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-sky-500 to-blue-600",
    "from-indigo-500 to-blue-600",
  ];
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

function pluralLessons(n: number) {
  const mod = n % 10;
  const mod100 = n % 100;
  if (mod === 1 && mod100 !== 11) return `${n} занятие`;
  if (mod >= 2 && mod <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} занятия`;
  return `${n} занятий`;
}

function pluralStudents(n: number) {
  const mod = n % 10;
  const mod100 = n % 100;
  if (mod === 1 && mod100 !== 11) return `${n} ученик`;
  if (mod >= 2 && mod <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ученика`;
  return `${n} учеников`;
}

type MonthData = {
  date: Date;
  key: string;
  label: string;
  shortLabel: string;
  total: number;
  completed: number;
  attended: number;
  cancelled: number;
  pending: number;
  goal: number;
  earned: number;
  forecast: number;
  difference: number;
  lostIncome: number;
  attendanceRate: number;
  hours: number;
  isFuture: boolean;
  isCurrent: boolean;
  studentIds: Set<string>;
};

export default function AnalyticsPage() {
  useDocumentTitle("Аналитика");
  const [, setLocation] = useLocation();
  const { data: studentsData, isLoading: studentsLoading } = useStudents();
  const { data: lessonsData, isLoading: lessonsLoading } = useLessons();
  const { data: paymentsData } = usePayments();

  const students = useMemo(() => studentsData ?? [], [studentsData]);
  const lessons = useMemo(() => lessonsData?.map(l => ({ ...l, scheduledAt: new Date(l.scheduledAt) })) ?? [], [lessonsData]);
  const payments = useMemo(() => paymentsData?.map(p => ({ ...p, createdAt: new Date(p.createdAt) })) ?? [], [paymentsData]);

  // effectiveBalance = totalPaid − totalCost (cancelled+missed_paid по cancelAmount — фикс #1/#10)
  const studentEffectiveBalances = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach(s => {
      const totalPaid = payments.filter(p => p.studentId === s.id).reduce((sum, p) => sum + p.amount, 0);
      const totalCost = lessons
        .filter(l =>
          l.studentId === s.id && (
            (l.status === "completed" && ["attended", "attended_unpaid", "missed_paid"].includes((l as any).attendance ?? "")) ||
            (l.status === "cancelled" && (l as any).attendance === "missed_paid")
          )
        )
        .reduce((sum, l) => {
          if (l.status === "cancelled" && (l as any).attendance === "missed_paid") {
            return sum + ((l as any).cancelAmount ?? 0);
          }
          return sum + Math.round(s.pricePerLesson * ((l as any).durationMinutes || 60) / 60);
        }, 0);
      map[s.id] = totalPaid - totalCost;
    });
    return map;
  }, [students, lessons, payments]);

  const isLoading = studentsLoading || lessonsLoading;
  const now = new Date();

  const [chartOffset, setChartOffset] = useState(0);
  const [expandedWeekday, setExpandedWeekday] = useState<number | null>(null);
  const [studentsTab, setStudentsTab] = useState<"lessons" | "income" | "attendance">("lessons");
  const [studentsShowAll, setStudentsShowAll] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<"week" | "month" | "year">("week");
  const [statsOffset, setStatsOffset] = useState(0);

  const calcCost = (lesson: any, student: any) => {
    if (!student) return 0;
    const dur = lesson.durationMinutes || 60;
    return Math.round(student.pricePerLesson * dur / 60);
  };

  const activeStudents = students.filter(s => s.isActive);

  const calcMonthData = useMemo(() => (monthDate: Date): MonthData => {
    const ms = startOfMonth(monthDate);
    const me = endOfMonth(monthDate);
    const isFuture = ms > now;
    const isCurrent = ms <= now && me >= now;

    const monthLessons = lessons.filter(l => l.scheduledAt >= ms && l.scheduledAt <= me);
    const completed = monthLessons.filter(l => l.status === "completed");
    const attended = completed.filter(l => l.attendance === "attended");
    const cancelled = monthLessons.filter(l => l.status === "cancelled");
    const pending = monthLessons.filter(l => l.status === "pending");

    const studentIds = new Set(monthLessons.map(l => l.studentId));

    const goal = monthLessons.reduce((sum, l) => {
      const s = students.find(st => st.id === l.studentId);
      return sum + calcCost(l, s);
    }, 0);

    const cancelledPaid = cancelled.filter(l => l.attendance === "missed_paid");
    const billable = [...attended, ...cancelledPaid];
    const earned = billable.reduce((sum, l) => {
      const s = students.find(st => st.id === l.studentId);
      return sum + calcCost(l, s);
    }, 0);

    let forecast: number;
    if (isFuture) {
      forecast = goal;
    } else {
      forecast = monthLessons.reduce((sum, l) => {
        const s = students.find(st => st.id === l.studentId);
        const cost = calcCost(l, s);
        if (l.scheduledAt < now) {
          const isBillable = (l.status === "completed" && l.attendance === "attended") || (l.status === "cancelled" && l.attendance === "missed_paid");
          return sum + (isBillable ? cost : 0);
        }
        return sum + ((l.status !== "cancelled" || l.attendance === "missed_paid") ? cost : 0);
      }, 0);
    }

    const lostIncome = cancelled.filter(l => l.attendance !== "missed_paid").reduce((sum, l) => {
      const s = students.find(st => st.id === l.studentId);
      return sum + calcCost(l, s);
    }, 0);

    const hours = attended.reduce((sum, l) => sum + l.durationMinutes, 0) / 60;

    const attendanceRate = completed.length > 0
      ? Math.round((attended.length / completed.length) * 100)
      : (monthLessons.length > 0 ? 100 : 0);

    return {
      date: monthDate,
      key: format(monthDate, "yyyy-MM"),
      label: format(monthDate, "LLLL yyyy", { locale: ru }),
      shortLabel: format(monthDate, "LLL", { locale: ru }),
      total: monthLessons.length,
      completed: completed.length,
      attended: attended.length,
      cancelled: cancelled.length,
      pending: pending.length,
      goal,
      earned,
      forecast,
      difference: forecast - goal,
      lostIncome,
      attendanceRate,
      hours,
      isFuture,
      isCurrent,
      studentIds,
    };
  }, [lessons, students, now]);

  const firstLessonDate = useMemo(() => {
    if (lessons.length === 0) return now;
    return lessons.reduce((min, l) => l.scheduledAt < min ? l.scheduledAt : min, lessons[0].scheduledAt);
  }, [lessons, now]);

  const allMonthsData = useMemo(() => {
    const firstMonth = startOfMonth(firstLessonDate);
    const futureLimit = addMonths(now, 6);
    const result: MonthData[] = [];
    let cur = firstMonth;
    while (cur <= futureLimit) {
      const data = calcMonthData(cur);
      if (data.total > 0 || cur >= startOfMonth(now)) {
        result.push(data);
      }
      cur = addMonths(cur, 1);
    }
    return result;
  }, [calcMonthData, firstLessonDate, now]);

  const chartMonths = useMemo(() => {
    const pageSize = 12;
    const start = chartOffset * pageSize;
    return allMonthsData.slice(Math.max(0, start), start + pageSize);
  }, [allMonthsData, chartOffset]);

  const maxPages = Math.ceil(allMonthsData.length / 12);
  const currentMonthData = useMemo(() => calcMonthData(now), [calcMonthData]);
  const prevMonthData = useMemo(() => calcMonthData(subMonths(now, 1)), [calcMonthData]);

  const incomeChange = prevMonthData.earned > 0
    ? Math.round(((currentMonthData.earned - prevMonthData.earned) / prevMonthData.earned) * 100)
    : 0;

  const avgLessonPrice = activeStudents.length
    ? Math.round(activeStudents.reduce((sum, s) => sum + s.pricePerLesson, 0) / activeStudents.length)
    : 0;

  const hourlyRate = currentMonthData.hours > 0 ? Math.round(currentMonthData.earned / currentMonthData.hours) : avgLessonPrice;

  const debtors = students
    .filter(s => (studentEffectiveBalances[s.id] ?? s.balance) < 0)
    .sort((a, b) => (studentEffectiveBalances[a.id] ?? a.balance) - (studentEffectiveBalances[b.id] ?? b.balance));
  const totalDebt = debtors.reduce((sum, s) => sum + Math.abs(studentEffectiveBalances[s.id] ?? s.balance), 0);

  const weekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const weekdayData = useMemo(() => {
    const thisMonthLessons = lessons.filter(l => l.scheduledAt >= startOfMonth(now) && l.scheduledAt <= endOfMonth(now));
    const data = Array.from({ length: 7 }, () => ({
      count: 0,
      earned: 0,
      students: [] as { name: string; subject: string; time: string }[],
    }));
    thisMonthLessons.forEach(l => {
      const day = (l.scheduledAt.getDay() + 6) % 7;
      data[day].count++;
      const s = students.find(st => st.id === l.studentId);
      if (s) {
        if ((l.status === "completed" && l.attendance === "attended") || (l.status === "cancelled" && l.attendance === "missed_paid")) {
          data[day].earned += calcCost(l, s);
        }
        const timeStr = format(l.scheduledAt, "HH:mm");
        const alreadyAdded = data[day].students.find(x => x.name === s.name);
        if (!alreadyAdded) {
          data[day].students.push({ name: s.name, subject: s.subject, time: timeStr });
        }
      }
    });
    return data;
  }, [lessons, students, now]);
  const maxWeekdayCount = Math.max(...weekdayData.map(d => d.count), 1);

  const studentAnalytics = useMemo(() => {
    const thisMonthLessons = lessons.filter(l => l.scheduledAt >= startOfMonth(now) && l.scheduledAt <= endOfMonth(now));
    const data: Record<string, { total: number; attended: number; cancelled: number; earned: number; hours: number; scheduled: number }> = {};
    thisMonthLessons.forEach(l => {
      const s = students.find(st => st.id === l.studentId);
      if (!s) return;
      if (!data[s.id]) data[s.id] = { total: 0, attended: 0, cancelled: 0, earned: 0, hours: 0, scheduled: 0 };
      data[s.id].total++;
      if (l.status === "completed" && l.attendance === "attended") {
        data[s.id].attended++;
        data[s.id].earned += calcCost(l, s);
        data[s.id].hours += l.durationMinutes / 60;
      }
      if (l.status === "cancelled" && l.attendance === "missed_paid") {
        data[s.id].earned += calcCost(l, s);
      }
      if (l.status === "cancelled") data[s.id].cancelled++;
      if (l.status === "pending") data[s.id].scheduled++;
    });
    return Object.entries(data)
      .map(([id, d]) => ({
        student: students.find(s => s.id === id)!,
        ...d,
        attendanceRate: d.total > 0 ? Math.round(((d.total - d.cancelled) / d.total) * 100) : 100,
        monthlyPayment: d.earned,
      }))
      .filter(x => x.student);
  }, [lessons, students, now]);

  const sortedStudents = useMemo(() => {
    const list = [...studentAnalytics];
    if (studentsTab === "lessons") list.sort((a, b) => b.total - a.total);
    else if (studentsTab === "income") list.sort((a, b) => b.monthlyPayment - a.monthlyPayment);
    else list.sort((a, b) => b.attendanceRate - a.attendanceRate || b.attended - a.attended);
    return studentsShowAll ? list : list.slice(0, 8);
  }, [studentAnalytics, studentsTab, studentsShowAll]);

  const subjectStats = useMemo(() => {
    const counts: Record<string, { students: number; lessons: number; earned: number }> = {};
    activeStudents.forEach(s => {
      if (!counts[s.subject]) counts[s.subject] = { students: 0, lessons: 0, earned: 0 };
      counts[s.subject].students++;
    });
    const thisMonthLessons = lessons.filter(l => l.scheduledAt >= startOfMonth(now) && l.scheduledAt <= endOfMonth(now));
    thisMonthLessons.forEach(l => {
      const s = students.find(st => st.id === l.studentId);
      if (s && counts[s.subject]) {
        counts[s.subject].lessons++;
        if ((l.status === "completed" && l.attendance === "attended") || (l.status === "cancelled" && l.attendance === "missed_paid")) {
          counts[s.subject].earned += calcCost(l, s);
        }
      }
    });
    return Object.entries(counts).sort((a, b) => b[1].students - a[1].students);
  }, [activeStudents, lessons, students, now]);

  const goalStats = useMemo(() => {
    const counts: Record<string, { students: number; lessons: number; earned: number }> = {};
    activeStudents.forEach(s => {
      if (!counts[s.goal]) counts[s.goal] = { students: 0, lessons: 0, earned: 0 };
      counts[s.goal].students++;
    });
    const thisMonthLessons = lessons.filter(l => l.scheduledAt >= startOfMonth(now) && l.scheduledAt <= endOfMonth(now));
    thisMonthLessons.forEach(l => {
      const s = students.find(st => st.id === l.studentId);
      if (s && counts[s.goal]) {
        counts[s.goal].lessons++;
        if ((l.status === "completed" && l.attendance === "attended") || (l.status === "cancelled" && l.attendance === "missed_paid")) {
          counts[s.goal].earned += calcCost(l, s);
        }
      }
    });
    return Object.entries(counts).sort((a, b) => b[1].students - a[1].students);
  }, [activeStudents, lessons, students, now]);

  const statsData = useMemo(() => {
    let start: Date, end: Date, label: string, prevStart: Date, prevEnd: Date;
    if (statsPeriod === "week") {
      start = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), statsOffset);
      end = addWeeks(endOfWeek(now, { weekStartsOn: 1 }), statsOffset);
      prevStart = subWeeks(start, 1);
      prevEnd = subWeeks(end, 1);
      label = `${format(start, "d MMM", { locale: ru })} \u2014 ${format(end, "d MMM yyyy", { locale: ru })}`;
    } else if (statsPeriod === "month") {
      start = startOfMonth(addMonths(now, statsOffset));
      end = endOfMonth(addMonths(now, statsOffset));
      prevStart = startOfMonth(subMonths(start, 1));
      prevEnd = endOfMonth(subMonths(start, 1));
      label = format(start, "LLLL yyyy", { locale: ru });
    } else {
      start = startOfYear(addYears(now, statsOffset));
      end = endOfYear(addYears(now, statsOffset));
      prevStart = startOfYear(subYears(start, 1));
      prevEnd = endOfYear(subYears(start, 1));
      label = format(start, "yyyy");
    }

    const periodLessons = lessons.filter(l => l.scheduledAt >= start && l.scheduledAt <= end);
    const prevLessons = lessons.filter(l => l.scheduledAt >= prevStart && l.scheduledAt <= prevEnd);
    const completed = periodLessons.filter(l => l.status === "completed");
    const attended = completed.filter(l => l.attendance === "attended");
    const cancelled = periodLessons.filter(l => l.status === "cancelled");
    const pending = periodLessons.filter(l => l.status === "pending");
    const prevCompleted = prevLessons.filter(l => l.status === "completed");
    const prevAttended = prevCompleted.filter(l => l.attendance === "attended");

    const cancelledPaidPeriod = cancelled.filter(l => l.attendance === "missed_paid");
    const prevCancelledPaid = prevLessons.filter(l => l.status === "cancelled" && l.attendance === "missed_paid");
    const billablePeriod = [...attended, ...cancelledPaidPeriod];
    const prevBillable = [...prevAttended, ...prevCancelledPaid];
    const earned = billablePeriod.reduce((sum, l) => {
      const s = students.find(st => st.id === l.studentId);
      return sum + calcCost(l, s);
    }, 0);
    const prevEarned = prevBillable.reduce((sum, l) => {
      const s = students.find(st => st.id === l.studentId);
      return sum + calcCost(l, s);
    }, 0);

    const hours = attended.reduce((sum, l) => sum + l.durationMinutes, 0) / 60;
    const prevHours = prevAttended.reduce((sum, l) => sum + l.durationMinutes, 0) / 60;
    const uniqueStudents = new Set(periodLessons.map(l => l.studentId)).size;
    const days = Math.max(differenceInDays(end > now ? now : end, start), 1);
    const lessonsPerDay = periodLessons.filter(l => l.scheduledAt <= now).length / days;

    const lostIncome = cancelled.filter(l => l.attendance !== "missed_paid").reduce((sum, l) => {
      const s = students.find(st => st.id === l.studentId);
      return sum + calcCost(l, s);
    }, 0);

    return {
      label,
      total: periodLessons.length,
      completed: completed.length,
      attended: attended.length,
      cancelled: cancelled.length,
      pending: pending.length,
      earned,
      prevEarned,
      hours,
      prevHours,
      uniqueStudents,
      lessonsPerDay: lessonsPerDay.toFixed(1),
      lostIncome,
      attendanceRate: completed.length > 0 ? Math.round((attended.length / completed.length) * 100) : 100,
    };
  }, [lessons, students, now, statsPeriod, statsOffset]);

  const avgLessonsPerStudent = activeStudents.length > 0 && currentMonthData.total > 0
    ? (currentMonthData.total / activeStudents.length).toFixed(1)
    : "0";

  const maxChartVal = Math.max(...chartMonths.map(m => Math.max(m.goal, m.forecast, m.earned)), 1);

  if (isLoading) {
    return (
      <DashboardLayout title="Аналитика" subtitle="Ключевые показатели вашей работы">
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="rounded-2xl"><CardContent className="pt-6"><Skeleton className="h-7 w-16 mb-2" /><Skeleton className="h-4 w-24" /></CardContent></Card>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="rounded-2xl"><CardHeader><Skeleton className="h-5 w-36" /></CardHeader><CardContent><Skeleton className="h-48 w-full rounded-xl" /></CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><Skeleton className="h-5 w-36" /></CardHeader><CardContent><Skeleton className="h-48 w-full rounded-xl" /></CardContent></Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Аналитика"
      subtitle="Ключевые показатели вашей работы"
      tabs={
        <div className="flex rounded-lg border border-border/60 overflow-hidden">
          <Button variant="ghost" size="sm" className="h-8 rounded-none text-xs gap-1.5 px-3 border-r border-border/60" onClick={() => setLocation("/finance")} data-testid="tab-to-finance">
            <CircleDollarSign className="h-3.5 w-3.5" /> Финансы
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-none text-xs gap-1.5 px-3 bg-primary/10 text-primary" data-testid="tab-analytics-active">
            <TrendingUp className="h-3.5 w-3.5" /> Аналитика
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <PageHero
          icon={<TrendingUp className="h-6 w-6 text-white" />}
          gradient="from-blue-600/80 via-indigo-600/70 to-violet-600/60"
          title="Аналитика"
          subtitle="Детальная статистика: доходы по периодам, рейтинг учеников, загрузка по дням недели и прогноз доходов. Используйте переключатель периодов для анализа за неделю, месяц или год."
          badge="Аналитика"
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><Target className="h-10 w-10 text-blue-600 rotate-12" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-blue-600" data-testid="stat-month-goal">{moneyRub(currentMonthData.goal)}</div>
                    <div className="text-xs text-muted-foreground">Цель месяца</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{pluralLessons(currentMonthData.total)} запланировано</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><TrendingUp className="h-10 w-10 text-blue-600 -rotate-6" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-blue-600" data-testid="stat-forecast">{moneyRub(currentMonthData.forecast)}</div>
                    <div className="text-xs text-muted-foreground">Прогноз</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">С учётом отмен</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className={cn("rounded-2xl border-border/50", currentMonthData.difference >= 0 ? "bg-gradient-to-br from-emerald-500/10 to-teal-500/5" : "bg-gradient-to-br from-red-500/10 to-blue-500/5")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", currentMonthData.difference >= 0 ? "bg-emerald-500/20" : "bg-red-500/20")}>
                    {currentMonthData.difference >= 0 ? <ArrowUpRight className="h-5 w-5 text-emerald-600" /> : <ArrowDownRight className="h-5 w-5 text-red-600" />}
                  </div>
                  <div>
                    <div className={cn("text-xl font-bold", currentMonthData.difference >= 0 ? "text-emerald-600" : "text-red-600")} data-testid="stat-difference">
                      {currentMonthData.difference >= 0 ? "+" : ""}{moneyRub(currentMonthData.difference)}
                    </div>
                    <div className="text-xs text-muted-foreground">Разница</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{currentMonthData.difference >= 0 ? "Сверх плана" : "Упущено"}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><Wallet className="h-10 w-10 text-emerald-600 rotate-6" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-emerald-600" data-testid="stat-earned">{moneyRub(currentMonthData.earned)}</div>
                    <div className="text-xs text-muted-foreground">Заработано</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {incomeChange !== 0 && (
                    <>
                      {incomeChange > 0
                        ? <><ArrowUpRight className="h-3 w-3 text-emerald-500" /><span className="text-emerald-600">+{incomeChange}%</span></>
                        : <><ArrowDownRight className="h-3 w-3 text-red-500" /><span className="text-red-600">{incomeChange}%</span></>}
                      <span className="text-muted-foreground">vs прошлый</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid gap-3 grid-cols-3 md:grid-cols-6">
          {[
            { icon: Calendar, label: "Занятий", value: String(currentMonthData.total), sub: `${currentMonthData.completed} проведено` },
            { icon: Clock, label: "Часов", value: `${currentMonthData.hours.toFixed(1)}`, sub: hourlyRate > 0 ? `${moneyRub(hourlyRate)}/ч` : "\u2014" },
            { icon: Users, label: "Учеников", value: String(currentMonthData.studentIds.size), sub: `${avgLessonsPerStudent} зан/уч` },
            { icon: XCircle, label: "Отмен", value: String(currentMonthData.cancelled), sub: currentMonthData.lostIncome > 0 ? `${moneyRub(currentMonthData.lostIncome)}` : "0", color: currentMonthData.cancelled > 0 ? "text-red-600" : undefined },
            { icon: Percent, label: "Посещаемость", value: `${currentMonthData.attendanceRate}%`, sub: `${currentMonthData.attended}/${currentMonthData.completed || currentMonthData.total}` },
            { icon: Zap, label: "В день", value: `${(currentMonthData.total / Math.max(now.getDate(), 1)).toFixed(1)}`, sub: "зан/день" },
          ].map((item, idx) => (
            <Card key={idx} className="rounded-2xl border-border/50 bg-card/80">
              <CardContent className="p-3 text-center">
                <item.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <div className={cn("text-lg font-bold", item.color)}>{item.value}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{item.label}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{item.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                Доход по месяцам
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChartOffset(o => Math.max(0, o - 1))} disabled={chartOffset === 0} data-testid="button-chart-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-1">{chartOffset + 1}/{maxPages || 1}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChartOffset(o => Math.min(maxPages - 1, o + 1))} disabled={chartOffset >= maxPages - 1} data-testid="button-chart-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> Цель</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> Прогноз</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Заработано</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 sm:h-64 items-end gap-2 pb-1">
              {chartMonths.map((m) => {
                const goalH = maxChartVal > 0 ? (m.goal / maxChartVal) * 100 : 0;
                const forecastH = maxChartVal > 0 ? (m.forecast / maxChartVal) * 100 : 0;
                const earnedH = maxChartVal > 0 ? (m.earned / maxChartVal) * 100 : 0;
                const curKey = format(now, "yyyy-MM");
                const isCur = m.key === curKey;
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group relative min-w-0">
                    <div className="w-full flex items-end gap-[2px]" style={{ height: "200px" }}>
                      <div
                        className={cn("flex-1 rounded-t-md transition-all duration-500 min-h-[4px]", isCur ? "bg-blue-500" : m.isFuture ? "bg-blue-400/40 border border-dashed border-blue-400/60" : "bg-blue-500/70")}
                        style={{ height: `${Math.max(goalH, 4)}%` }}
                      />
                      <div
                        className={cn("flex-1 rounded-t-md transition-all duration-500 min-h-[4px]", isCur ? "bg-blue-500" : m.isFuture ? "bg-cyan-400/40 border border-dashed border-cyan-400/60" : "bg-blue-500/70")}
                        style={{ height: `${Math.max(forecastH, 4)}%` }}
                      />
                      <div
                        className={cn("flex-1 rounded-t-md transition-all duration-500 min-h-[4px]", m.earned > 0 ? (isCur ? "bg-emerald-500" : "bg-emerald-500/70") : "bg-muted/40")}
                        style={{ height: `${Math.max(earnedH, m.earned > 0 ? 4 : 2)}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <span className={cn("text-[10px] leading-none block", isCur ? "font-bold text-primary" : m.isFuture ? "text-muted-foreground/50" : "text-muted-foreground")}>{m.shortLabel}</span>
                      {m.goal > 0 && <span className="text-[8px] text-muted-foreground/60 block">{shortMoney(m.goal)}</span>}
                    </div>
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover border rounded-xl p-3 text-xs shadow-2xl hidden group-hover:block z-20 min-w-[170px]">
                      <div className="font-semibold mb-2 capitalize">{m.label}</div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span className="text-blue-600">Цель:</span><span className="font-semibold">{moneyRub(m.goal)}</span></div>
                        <div className="flex justify-between"><span className="text-blue-600">Прогноз:</span><span className="font-semibold">{moneyRub(m.forecast)}</span></div>
                        <div className="flex justify-between"><span className="text-emerald-600">Заработано:</span><span className="font-semibold">{moneyRub(m.earned)}</span></div>
                        <div className="border-t pt-1 mt-1 flex justify-between text-muted-foreground">
                          <span>{pluralLessons(m.total)}</span>
                          <span>{pluralStudents(m.studentIds.size)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>{m.hours.toFixed(1)} ч</span>
                          <span className="text-red-500">{m.cancelled} отмен</span>
                        </div>
                        {m.isFuture && <Badge variant="outline" className="text-[10px] mt-1">будущий</Badge>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 border-t pt-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Цели:</span>
                <span className="ml-1 font-bold text-blue-600">{moneyRub(chartMonths.reduce((s, m) => s + m.goal, 0))}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Прогноз:</span>
                <span className="ml-1 font-bold text-blue-600">{moneyRub(chartMonths.reduce((s, m) => s + m.forecast, 0))}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Факт:</span>
                <span className="ml-1 font-bold text-emerald-600">{moneyRub(chartMonths.reduce((s, m) => s + m.earned, 0))}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Детали по месяцам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {allMonthsData.map((m) => {
                  const curKey = format(now, "yyyy-MM");
                  return (
                    <div key={m.key} className={cn("rounded-xl border p-3", m.key === curKey ? "border-primary/50 bg-primary/5 shadow-sm" : m.isFuture ? "border-dashed border-border/40 bg-muted/10" : "border-border/30")}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn("text-sm font-semibold capitalize", m.key === curKey && "text-primary")}>{m.label}</span>
                        <div className="flex items-center gap-1">
                          {m.isFuture && <Badge variant="outline" className="text-[10px] px-1.5 py-0">будущий</Badge>}
                          {m.key === curKey && <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-0">текущий</Badge>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                        <div><span className="text-muted-foreground">Цель: </span><span className="font-semibold text-blue-600">{moneyRub(m.goal)}</span></div>
                        <div><span className="text-muted-foreground">Прогноз: </span><span className="font-semibold text-blue-600">{moneyRub(m.forecast)}</span></div>
                        <div><span className="text-muted-foreground">Факт: </span><span className="font-semibold text-emerald-600">{moneyRub(m.earned)}</span></div>
                        <div><span className="text-muted-foreground">Занятий: </span><span className="font-semibold">{m.total}</span>{m.cancelled > 0 && <span className="text-red-500 ml-1">(-{m.cancelled})</span>}</div>
                        <div><span className="text-muted-foreground">Часы: </span><span className="font-semibold">{m.hours.toFixed(1)}</span></div>
                        <div><span className="text-muted-foreground">Учеников: </span><span className="font-semibold">{m.studentIds.size}</span></div>
                        <div><span className="text-muted-foreground">Посещ.: </span><span className="font-semibold">{m.attendanceRate}%</span></div>
                        {m.lostIncome > 0 && <div><span className="text-muted-foreground">Потеряно: </span><span className="font-semibold text-red-500">{moneyRub(m.lostIncome)}</span></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-4 w-4 text-orange-500" />
                Нагрузка по дням недели
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {weekdayData.map((day, idx) => {
                  const pct = maxWeekdayCount > 0 ? (day.count / maxWeekdayCount) * 100 : 0;
                  const todayIdx = (now.getDay() + 6) % 7;
                  const isToday = todayIdx === idx;
                  const isExpanded = expandedWeekday === idx;
                  return (
                    <div key={idx}>
                      <button
                        className={cn("w-full flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/50", isToday && "bg-primary/5", isExpanded && "bg-muted/30")}
                        onClick={() => setExpandedWeekday(isExpanded ? null : idx)}
                        data-testid={`weekday-${idx}`}
                      >
                        <span className={cn("w-8 text-sm font-semibold text-center", isToday ? "text-primary" : "text-muted-foreground")}>{weekdayLabels[idx]}</span>
                        <div className="flex-1 h-7 bg-muted/40 rounded-lg overflow-hidden relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(pct, day.count > 0 ? 8 : 0)}%` }}
                            transition={{ duration: 0.6, delay: idx * 0.05 }}
                            className={cn("h-full rounded-lg flex items-center justify-end pr-2", isToday ? "bg-gradient-to-r from-primary/80 to-primary" : day.count > 0 ? "bg-gradient-to-r from-blue-500/50 to-blue-500/80" : "")}
                          >
                            {day.count > 0 && <span className="text-xs font-bold text-white drop-shadow">{day.count}</span>}
                          </motion.div>
                        </div>
                        <div className="w-20 text-right">
                          <span className="text-xs font-semibold text-emerald-600">{day.earned > 0 ? moneyRub(day.earned) : "\u2014"}</span>
                        </div>
                        {day.students.length > 0 && (
                          isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <AnimatePresence>
                        {isExpanded && day.students.length > 0 && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="ml-11 mt-1 mb-2 space-y-1 text-xs">
                              {day.students.map((s, si) => (
                                <div key={si} className="flex items-center gap-2 text-muted-foreground py-0.5">
                                  <div className={cn("h-5 w-5 rounded-full bg-gradient-to-br text-white text-[8px] flex items-center justify-center font-semibold", getAvatarColor(s.name))}>
                                    {getInitials(s.name)}
                                  </div>
                                  <span className="font-medium text-foreground">{s.name}</span>
                                  <span className="text-muted-foreground/60">{s.subject}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between text-xs border-t pt-3">
                <span className="text-muted-foreground">Всего: <span className="font-semibold text-foreground">{currentMonthData.total}</span> зан.</span>
                <span className="text-muted-foreground">Доход: <span className="font-semibold text-emerald-600">{moneyRub(weekdayData.reduce((s, d) => s + d.earned, 0))}</span></span>
                <span className="text-muted-foreground">Пик: <span className="font-semibold text-foreground">{weekdayLabels[weekdayData.findIndex(d => d.count === Math.max(...weekdayData.map(x => x.count)))]}</span></span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-4 w-4 text-amber-500" />
                Ученики — рейтинг
              </CardTitle>
              <div className="flex items-center gap-1">
                {(["lessons", "income", "attendance"] as const).map(tab => (
                  <Button key={tab} variant={studentsTab === tab ? "default" : "ghost"} size="sm" className="h-7 text-xs px-3" onClick={() => setStudentsTab(tab)} data-testid={`tab-students-${tab}`}>
                    {tab === "lessons" ? "По занятиям" : tab === "income" ? "По доходу" : "Посещаемость"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sortedStudents.length > 0 ? (
              <div className="space-y-2">
                {sortedStudents.map((item, idx) => {
                  const rank = idx + 1;
                  const medalColors = ["text-amber-500", "text-gray-400", "text-orange-600"];
                  return (
                    <motion.div key={item.student.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                      className="flex items-center gap-3 rounded-xl border border-border/30 p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">
                        {rank <= 3 ? <Star className={cn("h-4 w-4", medalColors[rank - 1])} /> : rank}
                      </div>
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white text-xs font-semibold shrink-0", getAvatarColor(item.student.name))}>
                        {getInitials(item.student.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium">{item.student.name}</div>
                        <div className="text-xs text-muted-foreground">{item.student.subject} · {item.student.goal}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center shrink-0">
                        <div>
                          <div className="text-sm font-bold">{item.total}</div>
                          <div className="text-[10px] text-muted-foreground">зан.</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-emerald-600">{shortMoney(item.monthlyPayment)}</div>
                          <div className="text-[10px] text-muted-foreground">план</div>
                        </div>
                        <div>
                          <div className={cn("text-sm font-bold", item.attendanceRate >= 90 ? "text-emerald-600" : item.attendanceRate >= 70 ? "text-amber-600" : "text-red-600")}>{item.attendanceRate}%</div>
                          <div className="text-[10px] text-muted-foreground">посещ.</div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {studentAnalytics.length > 8 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setStudentsShowAll(v => !v)} data-testid="button-students-toggle">
                    {studentsShowAll ? "Свернуть" : `Показать всех (${studentAnalytics.length})`}
                    {studentsShowAll ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">Нет данных за этот месяц</div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-primary" />
                Предметы
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subjectStats.length > 0 ? (
                <div className="space-y-3">
                  {subjectStats.map(([subject, data]) => {
                    const pct = activeStudents.length > 0 ? Math.round((data.students / activeStudents.length) * 100) : 0;
                    return (
                      <div key={subject}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{subject}</span>
                          <span className="text-muted-foreground">{data.students} уч.</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted/50 overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 4)}%` }} transition={{ duration: 0.5 }}
                            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary" />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>{data.lessons} зан. в месяц</span>
                          <span>{moneyRub(data.earned)} заработано</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">Нет данных</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" />
                Цели подготовки
              </CardTitle>
            </CardHeader>
            <CardContent>
              {goalStats.length > 0 ? (
                <div className="space-y-3">
                  {goalStats.map(([goal, data]) => {
                    const pct = activeStudents.length > 0 ? Math.round((data.students / activeStudents.length) * 100) : 0;
                    return (
                      <div key={goal}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{goal}</span>
                          <span className="text-muted-foreground">{data.students} уч.</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted/50 overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 4)}%` }} transition={{ duration: 0.5 }}
                            className="h-full rounded-full bg-gradient-to-r from-blue-500/70 to-blue-500" />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>{data.lessons} зан. в месяц</span>
                          <span>{moneyRub(data.earned)} заработано</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">Нет данных</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" />
                Статистика
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStatsOffset(o => o - 1)} data-testid="button-stats-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {(["week", "month", "year"] as const).map(p => (
                  <Button key={p} variant={statsPeriod === p ? "default" : "ghost"} size="sm" className="h-7 text-xs px-3"
                    onClick={() => { setStatsPeriod(p); setStatsOffset(0); }} data-testid={`tab-stats-${p}`}>
                    {p === "week" ? "Неделя" : p === "month" ? "Месяц" : "Год"}
                  </Button>
                ))}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStatsOffset(o => o + 1)} data-testid="button-stats-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground capitalize mt-1">{statsData.label}</div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-muted/30 p-4 text-center">
                <div className="text-3xl font-bold">{statsData.total}</div>
                <div className="text-xs text-muted-foreground mt-1">Всего занятий</div>
                <div className="text-[10px] text-muted-foreground">{statsData.lessonsPerDay} в день</div>
              </div>
              <div className="rounded-xl bg-emerald-500/10 p-4 text-center">
                <div className="text-3xl font-bold text-emerald-600">{moneyRub(statsData.earned)}</div>
                <div className="text-xs text-muted-foreground mt-1">Заработано</div>
                {statsData.prevEarned > 0 && (
                  <div className="text-[10px] mt-1">
                    {statsData.earned >= statsData.prevEarned
                      ? <span className="text-emerald-600">+{Math.round(((statsData.earned - statsData.prevEarned) / statsData.prevEarned) * 100)}%</span>
                      : <span className="text-red-500">{Math.round(((statsData.earned - statsData.prevEarned) / statsData.prevEarned) * 100)}%</span>}
                    <span className="text-muted-foreground"> vs пред.</span>
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-blue-500/10 p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{statsData.hours.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground mt-1">Часов</div>
                {statsData.prevHours > 0 && <div className="text-[10px] text-muted-foreground">пред.: {statsData.prevHours.toFixed(1)} ч</div>}
              </div>
              <div className="rounded-xl bg-blue-500/10 p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{statsData.uniqueStudents}</div>
                <div className="text-xs text-muted-foreground mt-1">Учеников</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-emerald-500/5 p-3 text-center">
                <div className="text-lg font-bold text-emerald-600">{statsData.attended}</div>
                <div className="text-[10px] text-muted-foreground">Проведено</div>
              </div>
              <div className="rounded-xl bg-amber-500/5 p-3 text-center">
                <div className="text-lg font-bold text-amber-600">{statsData.pending}</div>
                <div className="text-[10px] text-muted-foreground">Ожидают</div>
              </div>
              <div className="rounded-xl bg-red-500/5 p-3 text-center">
                <div className="text-lg font-bold text-red-600">{statsData.cancelled}</div>
                <div className="text-[10px] text-muted-foreground">Отменено</div>
              </div>
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold">{statsData.attendanceRate}%</div>
                <div className="text-[10px] text-muted-foreground">Посещаемость</div>
              </div>
            </div>
            {statsData.lostIncome > 0 && (
              <div className="mt-3 text-center text-xs text-red-500">Потеряно из-за отмен: {moneyRub(statsData.lostIncome)}</div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Должники
              </CardTitle>
            </CardHeader>
            <CardContent>
              {debtors.length > 0 ? (
                <div className="space-y-2">
                  {debtors.slice(0, 6).map((student) => (
                    <div key={student.id} className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white text-xs font-semibold shrink-0", getAvatarColor(student.name))}>
                        {getInitials(student.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium">{student.name}</div>
                        <div className="text-xs text-muted-foreground">{student.subject}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-red-600">{moneyRub(studentEffectiveBalances[student.id] ?? student.balance)}</div>
                        <div className="text-xs text-muted-foreground">{Math.ceil(Math.abs(studentEffectiveBalances[student.id] ?? student.balance) / (student.pricePerLesson || 1))} зан.</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-3 text-sm">
                    <span className="text-muted-foreground">Итого долг:</span>
                    <span className="font-bold text-red-600">{moneyRub(totalDebt)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <CheckCircle className="h-10 w-10 text-emerald-500 mb-2" />
                  <div className="text-sm font-medium">Все оплатили!</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4 text-primary" />
                Баланс учеников
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-red-500/10 p-4 text-center">
                  <div className="text-xl font-bold text-red-600">{moneyRub(totalDebt)}</div>
                  <div className="text-xs text-muted-foreground">Общий долг</div>
                  <div className="text-[10px] text-muted-foreground">{debtors.length} учеников</div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-4 text-center">
                  <div className="text-xl font-bold text-emerald-600">{moneyRub(students.filter(s => (studentEffectiveBalances[s.id] ?? s.balance) > 0).reduce((sum, s) => sum + (studentEffectiveBalances[s.id] ?? s.balance), 0))}</div>
                  <div className="text-xs text-muted-foreground">Переплата</div>
                  <div className="text-[10px] text-muted-foreground">{students.filter(s => (studentEffectiveBalances[s.id] ?? s.balance) > 0).length} учеников</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground mb-1">Ценовые сегменты</div>
                {(() => {
                  const segments: Record<string, number> = {};
                  activeStudents.forEach(s => {
                    const bracket = s.pricePerLesson < 1000 ? "< 1000" : s.pricePerLesson < 2000 ? "1000-2000" : s.pricePerLesson < 3000 ? "2000-3000" : "3000+";
                    segments[bracket] = (segments[bracket] || 0) + 1;
                  });
                  const maxSeg = Math.max(...Object.values(segments), 1);
                  return Object.entries(segments).sort(([a], [b]) => {
                    const order = ["< 1000", "1000-2000", "2000-3000", "3000+"];
                    return order.indexOf(a) - order.indexOf(b);
                  }).map(([bracket, count]) => (
                    <div key={bracket} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-muted-foreground">{bracket} \u20BD</span>
                      <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary/50 to-primary/80 rounded flex items-center justify-end pr-2"
                          style={{ width: `${(count / maxSeg) * 100}%` }}>
                          <span className="text-[10px] font-bold text-white">{count}</span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="mt-3 border-t pt-3 grid grid-cols-2 gap-2 text-center text-xs">
                <div>
                  <div className="font-bold text-lg">{moneyRub(avgLessonPrice)}</div>
                  <div className="text-muted-foreground">Средняя цена</div>
                </div>
                <div>
                  <div className="font-bold text-lg">{moneyRub(activeStudents.length > 0 ? Math.max(...activeStudents.map(s => s.pricePerLesson)) : 0)}</div>
                  <div className="text-muted-foreground">Максимальная</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
