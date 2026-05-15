import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  ExternalLink,
  Filter,
  GraduationCap,
  History,
  Info,
  LayoutGrid,
  MoveRight,
  Pencil,
  Plus,
  Target,
  Timer,
  Trash2,
  User,
  Video,
  X,
  Star,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";
import { useAuth } from "@/hooks/use-auth";
import { useStudents, useLessons, useUpdateLesson, useDeleteLesson, usePayments } from "@/hooks/use-tutor-data";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateResource } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { StudentCombobox } from "@/components/student-combobox";

import { useDocumentTitle } from "@/hooks/use-document-title";
type LessonStatus = "pending" | "completed" | "cancelled" | "rescheduled";
type AttendanceType = "attended" | "attended_unpaid" | "missed" | "missed_paid";

function statusLabel(status: LessonStatus, attendance?: string | null) {
  if (status === "completed") {
    if (attendance === "attended") return { text: "Проведено ✓", tone: "bg-emerald-500/15 text-emerald-600", icon: Check };
    if (attendance === "attended_unpaid") return { text: "Проведено ✗", tone: "bg-cyan-500/15 text-cyan-600", icon: Check };
    return { text: "Проведено", tone: "bg-emerald-500/15 text-emerald-600", icon: Check };
  }
  if (status === "cancelled") {
    if (attendance === "missed_paid") return { text: "Отменено ✓", tone: "bg-amber-500/15 text-amber-600", icon: X };
    return { text: "Отменено", tone: "bg-red-500/15 text-red-600", icon: X };
  }
  const map: Record<string, { text: string; tone: string; icon: React.ElementType }> = {
    pending: { text: "Ожидает", tone: "bg-amber-500/15 text-amber-600", icon: Clock },
    rescheduled: { text: "Перенесено", tone: "bg-sky-500/15 text-sky-600", icon: Clock },
  };
  return map[status] || map.pending;
}

function dateRu(d: Date) {
  return format(d, "d MMMM, EEEE", { locale: ru });
}

function timeRuTz(d: Date, tz: string) {
  return formatInTimeZone(d, tz, "HH:mm", { locale: ru });
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
  ];
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
        <GraduationCap className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <div className="mt-4 text-lg font-semibold">{title}</div>
      <div className="mt-2 max-w-md text-sm text-muted-foreground">{description}</div>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

const DAY_NAMES_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAY_NAMES_FULL = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

type RetroLesson = {
  date: Date;
  dayOfWeek: number;
  hour: number;
  minute: number;
  duration: number;
  included: boolean;
  status: "completed" | "cancelled";
  attendance: "attended" | "attended_unpaid" | "missed" | "missed_paid" | null;
  studentId: string;
  studentName?: string;
};

function detectScheduleSlots(lessons: { scheduledAt: Date; durationMinutes: number; studentId: string; status: string }[], studentId: string) {
  const studentLessons = lessons.filter(l => l.studentId === studentId);
  const slotCounts = new Map<string, { day: number; hour: number; minute: number; duration: number; count: number }>();

  studentLessons.forEach(l => {
    const d = l.scheduledAt;
    const key = `${d.getDay()}-${d.getHours()}-${d.getMinutes()}`;
    const existing = slotCounts.get(key);
    if (!existing) {
      slotCounts.set(key, { day: d.getDay(), hour: d.getHours(), minute: d.getMinutes(), duration: l.durationMinutes, count: 1 });
    } else {
      existing.count++;
    }
  });

  return Array.from(slotCounts.values())
    .filter(s => s.count >= 2)
    .sort((a, b) => {
      const da = a.day === 0 ? 7 : a.day;
      const db = b.day === 0 ? 7 : b.day;
      return da - db || a.hour - b.hour;
    });
}

function generateRetroLessons(
  slots: { day: number; hour: number; minute: number; duration: number }[],
  year: number,
  month: number,
  existingDates: Set<string>,
  studentId: string = "",
  studentName: string = ""
): RetroLesson[] {
  const results: RetroLesson[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date >= today) continue;
    const dayOfWeek = date.getDay();

    for (const slot of slots) {
      if (slot.day === dayOfWeek) {
        const lessonDate = new Date(year, month, d, slot.hour, slot.minute, 0, 0);
        const dateKey = lessonDate.toISOString();
        if (existingDates.has(dateKey)) continue;

        results.push({
          date: lessonDate,
          dayOfWeek,
          hour: slot.hour,
          minute: slot.minute,
          duration: slot.duration,
          included: true,
          status: "completed",
          attendance: "attended",
          studentId,
          studentName,
        });
      }
    }
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export default function LessonsPage() {
  useDocumentTitle("Уроки");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: studentsData, isLoading: studentsLoading } = useStudents();
  const { data: lessonsData, isLoading: lessonsLoading } = useLessons();
  const { data: paymentsData } = usePayments();
  const updateLesson = useUpdateLesson();
  const deleteLesson = useDeleteLesson();
  const queryClient = useQueryClient();

  const { data: bbbConferences = [] } = useQuery<Array<{
    id: string; title: string; studentId: string | null; isRunning: boolean;
  }>>({ queryKey: ["/api/bbb/conferences"] });
  const [joiningBbbId, setJoiningBbbId] = useState<string | null>(null);
  const handleJoinBbb = async (id: string) => {
    setJoiningBbbId(id);
    try {
      const res = await fetch(`/api/bbb/conferences/${id}/join`, { credentials: "include" });
      const data = await res.json();
      if (data.url) { window.open(data.url, "_blank"); }
      else { toast.error(data.error || "Ошибка подключения к конференции"); }
    } catch { toast.error("Ошибка подключения к конференции"); }
    finally { setJoiningBbbId(null); }
  };

  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);

  const students = useMemo(() => studentsData ?? [], [studentsData]);
  const lessons = useMemo(() => lessonsData?.map(l => ({ ...l, scheduledAt: new Date(l.scheduledAt) })) ?? [], [lessonsData]);
  const payments = useMemo(() => paymentsData ?? [], [paymentsData]);
  const uniqueTopics = useMemo(() => {
    const seen = new Set<string>();
    return lessons.map(l => l.topic).filter((t): t is string => !!t && !seen.has(t) && seen.add(t) !== undefined);
  }, [lessons]);

  const isBillable = (l: any) =>
    (l.status === "completed" && l.attendance === "attended") ||
    (l.status === "cancelled" && l.attendance === "missed_paid");

  const getEffectiveBalance = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const totalPaid = payments.filter(p => p.studentId === studentId).reduce((sum, p) => sum + p.amount, 0);
    const totalCost = lessons.filter(l => l.studentId === studentId && isBillable(l))
      .reduce((sum, l) => sum + Math.round((student?.pricePerLesson ?? 0) * (l.durationMinutes ?? 60) / 60), 0);
    return totalPaid - totalCost;
  };

  const userTimezone = user?.timezone ?? "Europe/Moscow";
  const now = new Date();

  const getMonday = (d: Date) => {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  };

  type ViewMode = "week" | "day" | "month";
  type LessonFilter = "all" | "completed_paid" | "completed_unpaid" | "cancelled_paid" | "cancelled_free" | "pending" | "cancelled";
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedMonthDay, setSelectedMonthDay] = useState<Date | null>(null);
  const [lessonFilter, setLessonFilter] = useState<LessonFilter>("all");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [_deductBalance] = useState(true); // kept for backward compat, policy is server-side
  const [addLessonDate, setAddLessonDate] = useState<Date | null>(null);
  const [addStudentId, setAddStudentId] = useState("");
  const [addTime, setAddTime] = useState("16:00");
  const [addDuration, setAddDuration] = useState(60);
  const [addTopic, setAddTopic] = useState("");
  const [addStatus, setAddStatus] = useState<"pending" | "completed" | "cancelled">("pending");
  const [addAttendance, setAddAttendance] = useState<string>("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [editTopicValue, setEditTopicValue] = useState("");
  const [editNotesValue, setEditNotesValue] = useState("");
  const [editRating, setEditRating] = useState<number | null>(null);

  const currentWeekMonday = useMemo(() => {
    const monday = getMonday(now);
    monday.setDate(monday.getDate() + weekOffset * 7);
    return monday;
  }, [weekOffset, now]);

  const currentWeekSunday = useMemo(() => {
    const sunday = new Date(currentWeekMonday);
    sunday.setDate(sunday.getDate() + 6);
    return sunday;
  }, [currentWeekMonday]);

  const weekLessons = useMemo(() => {
    const start = currentWeekMonday;
    const end = new Date(start.getTime() + 7 * 86400000);
    return lessons
      .filter(l => l.scheduledAt >= start && l.scheduledAt < end)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }, [lessons, currentWeekMonday]);

  const weekByDay = useMemo(() => {
    const days: { date: Date; dayName: string; lessons: typeof weekLessons }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekMonday);
      date.setDate(date.getDate() + i);
      const dayStart = date.getTime();
      const dayEnd = dayStart + 86400000;
      days.push({
        date,
        dayName: DAY_NAMES_FULL[date.getDay()],
        lessons: weekLessons.filter(l => l.scheduledAt.getTime() >= dayStart && l.scheduledAt.getTime() < dayEnd),
      });
    }
    return days;
  }, [weekLessons, currentWeekMonday]);

  const currentDay = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset, now]);

  const dayLessons = useMemo(() => {
    const start = currentDay.getTime();
    const end = start + 86400000;
    return lessons
      .filter(l => l.scheduledAt.getTime() >= start && l.scheduledAt.getTime() < end)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }, [lessons, currentDay]);

  const filterLesson = useCallback((lesson: typeof lessons[0]) => {
    if (lessonFilter === "all") return true;
    if (lessonFilter === "pending") return lesson.status === "pending";
    if (lessonFilter === "completed_paid") return lesson.status === "completed" && lesson.attendance === "attended";
    if (lessonFilter === "completed_unpaid") return lesson.status === "completed" && lesson.attendance === "attended_unpaid";
    if (lessonFilter === "cancelled_paid") return lesson.status === "cancelled" && lesson.attendance === "missed_paid";
    if (lessonFilter === "cancelled_free") return lesson.status === "cancelled" && lesson.attendance === "missed";
    if (lessonFilter === "cancelled") return lesson.status === "cancelled";
    return true;
  }, [lessonFilter]);

  const filteredWeekByDay = useMemo(() => {
    return weekByDay.map(day => ({
      ...day,
      lessons: day.lessons.filter(filterLesson),
    }));
  }, [weekByDay, filterLesson]);

  const filteredDayLessons = useMemo(() => dayLessons.filter(filterLesson), [dayLessons, filterLesson]);

  const weekCompleted = weekLessons.filter(l => l.status === "completed").length;
  const weekPending = weekLessons.filter(l => l.status === "pending").length;
  const weekTotal = weekLessons.length;

  const currentMonthDate = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return d;
  }, [monthOffset, now]);

  const monthGridDays = useMemo(() => {
    const first = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
    const firstDow = first.getDay();
    const mondayOffset = firstDow === 0 ? -6 : 1 - firstDow;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() + mondayOffset);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentMonthDate]);

  const monthLessonsByDate = useMemo(() => {
    const map = new Map<string, typeof lessons>();
    const monthStart = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1).getTime();
    const monthEnd = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1).getTime();
    for (const l of lessons) {
      const t = l.scheduledAt.getTime();
      if (t < monthGridDays[0].getTime() || t >= monthGridDays[41].getTime() + 86400000) continue;
      const key = `${l.scheduledAt.getFullYear()}-${l.scheduledAt.getMonth()}-${l.scheduledAt.getDate()}`;
      if (!map.has(key)) map.set(key, [] as any);
      (map.get(key) as any).push(l);
    }
    Array.from(map.values()).forEach((arr: any) => arr.sort((a: any, b: any) => a.scheduledAt.getTime() - b.scheduledAt.getTime()));
    return { map, monthStart, monthEnd };
  }, [lessons, monthGridDays, currentMonthDate]);

  const monthLessonsTotal = useMemo(() =>
    lessons.filter(l => {
      const t = l.scheduledAt.getTime();
      return t >= monthLessonsByDate.monthStart && t < monthLessonsByDate.monthEnd;
    }), [lessons, monthLessonsByDate]);

  const filteredSelectedMonthDayLessons = useMemo(() => {
    if (!selectedMonthDay) return [] as typeof lessons;
    const key = `${selectedMonthDay.getFullYear()}-${selectedMonthDay.getMonth()}-${selectedMonthDay.getDate()}`;
    return ((monthLessonsByDate.map.get(key) as any) || []).filter(filterLesson);
  }, [selectedMonthDay, monthLessonsByDate, filterLesson]);

  const isCurrentWeek = weekOffset === 0;
  const isToday = dayOffset === 0;
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const goToToday = () => {
    if (viewMode === "week") setWeekOffset(0);
    else if (viewMode === "month") { setMonthOffset(0); setSelectedMonthDay(null); }
    else setDayOffset(0);
  };

  const navigatePrev = () => {
    if (viewMode === "week") setWeekOffset(w => w - 1);
    else if (viewMode === "month") { setMonthOffset(m => m - 1); setSelectedMonthDay(null); }
    else setDayOffset(d => d - 1);
  };

  const navigateNext = () => {
    if (viewMode === "week") setWeekOffset(w => w + 1);
    else if (viewMode === "month") { setMonthOffset(m => m + 1); setSelectedMonthDay(null); }
    else setDayOffset(d => d + 1);
  };

  const dateLabel = useMemo(() => {
    if (viewMode === "week") {
      return `${format(currentWeekMonday, "d MMM", { locale: ru })} — ${format(currentWeekSunday, "d MMM yyyy", { locale: ru })}`;
    }
    if (viewMode === "month") {
      return format(currentMonthDate, "LLLL yyyy", { locale: ru });
    }
    return format(currentDay, "EEEE, d MMMM yyyy", { locale: ru });
  }, [viewMode, currentWeekMonday, currentWeekSunday, currentDay, currentMonthDate]);

  const canShowToday = viewMode === "week" ? !isCurrentWeek : viewMode === "month" ? monthOffset !== 0 : !isToday;

  useEffect(() => {
    if (editingLessonId) {
      const lesson = lessons.find(l => l.id === editingLessonId);
      if (lesson) {
        setRescheduleDate(formatInTimeZone(lesson.scheduledAt, userTimezone, "yyyy-MM-dd"));
        setRescheduleTime(formatInTimeZone(lesson.scheduledAt, userTimezone, "HH:mm"));
        setEditTopicValue(lesson.topic || "");
        setEditNotesValue((lesson as any).notes || "");
        setEditRating((lesson as any).rating ?? null);
      }
    }
  }, [editingLessonId]);

  const handleReschedule = async (lessonId: string) => {
    if (!rescheduleDate || !rescheduleTime) {
      toast.error("Укажите дату и время");
      return;
    }
    const newDate = fromZonedTime(`${rescheduleDate}T${rescheduleTime}:00`, userTimezone);
    if (isNaN(newDate.getTime())) {
      toast.error("Некорректная дата или время");
      return;
    }
    try {
      await updateLesson.mutateAsync({ id: lessonId, updates: { scheduledAt: newDate, status: "pending", attendance: null } });
      toast.success("Занятие перенесено");
      setEditingLessonId(null);
    } catch {
      toast.error("Ошибка при переносе занятия");
    }
  };

  const applyLessonUpdate = async (lessonId: string, updates: Record<string, any>) => {
    try {
      await updateLesson.mutateAsync({ id: lessonId, updates });
      toast.success("Занятие обновлено");
      setEditingLessonId(null);
    } catch {
      toast.error("Ошибка обновления");
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      await deleteLesson.mutateAsync(lessonId);
      toast.success("Занятие удалено");
      setDeletingLessonId(null);
      setEditingLessonId(null);
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const openAddLesson = (date: Date) => {
    setAddLessonDate(date);
    setAddStudentId("");
    setAddTime("16:00");
    setAddDuration(60);
    setAddTopic("");
    const isPast = date < todayDate;
    setAddStatus(isPast ? "completed" : "pending");
    setAddAttendance(isPast ? "attended" : "");
  };

  const submitAddLesson = async () => {
    if (!addStudentId || !addLessonDate) {
      toast.error("Выберите ученика");
      return;
    }
    setAddSubmitting(true);
    try {
      const [h, m] = addTime.split(":").map(Number);
      const scheduledAt = new Date(addLessonDate);
      scheduledAt.setHours(h, m, 0, 0);

      const student = students.find(s => s.id === addStudentId);
      const body: any = {
        studentId: addStudentId,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: addDuration,
        topic: addTopic || student?.subject || "Занятие",
        status: addStatus,
      };
      if (addAttendance && (addStatus === "completed" || addStatus === "cancelled")) {
        body.attendance = addAttendance;
      }

      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Ошибка создания");
      toast.success("Занятие добавлено");
      invalidateResource("lessons");
      setAddLessonDate(null);
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    } finally {
      setAddSubmitting(false);
    }
  };

  const [retroOpen, setRetroOpen] = useState(false);
  const [retroStudentId, setRetroStudentId] = useState("");
  const [retroMonth, setRetroMonth] = useState("");
  const [retroLessons, setRetroLessons] = useState<RetroLesson[]>([]);
  const [retroSubmitting, setRetroSubmitting] = useState(false);
  const [retroStudentsWithSlots, setRetroStudentsWithSlots] = useState(0);
  const [retroSortBy, setRetroSortBy] = useState<"date" | "student">("date");

  const pastMonthOptions = useMemo(() => {
    const options: { value: string; label: string; year: number; month: number }[] = [];
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      options.push({
        value: `${m.getFullYear()}-${m.getMonth()}`,
        label: `${MONTH_NAMES[m.getMonth()]} ${m.getFullYear()}`,
        year: m.getFullYear(),
        month: m.getMonth(),
      });
    }
    return options;
  }, []);

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [students]
  );

  const retroSelectedStudent = useMemo(
    () => students.find(s => s.id === retroStudentId),
    [students, retroStudentId]
  );

  const isAllStudents = retroStudentId === "__all__";

  const retroDetectedSlots = useMemo(() => {
    if (!retroStudentId || isAllStudents) return [];
    return detectScheduleSlots(lessons, retroStudentId);
  }, [lessons, retroStudentId, isAllStudents]);

  const regenerateRetroLessons = useCallback(() => {
    if (!retroMonth) { setRetroLessons([]); return; }
    const [yearStr, monthStr] = retroMonth.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const targetStudents = isAllStudents ? sortedStudents : (retroStudentId ? [students.find(s => s.id === retroStudentId)!].filter(Boolean) : []);
    if (targetStudents.length === 0) { setRetroLessons([]); return; }

    const allGenerated: RetroLesson[] = [];
    let studentsWithSlots = 0;
    for (const st of targetStudents) {
      const slots = detectScheduleSlots(lessons, st.id);
      if (slots.length === 0) continue;
      studentsWithSlots++;
      const existingDates = new Set<string>();
      lessons.filter(l => l.studentId === st.id).forEach(l => existingDates.add(l.scheduledAt.toISOString()));
      const generated = generateRetroLessons(slots, year, month, existingDates, st.id, st.name);
      allGenerated.push(...generated);
    }
    setRetroLessons(allGenerated);
    setRetroStudentsWithSlots(studentsWithSlots);
  }, [retroStudentId, retroMonth, isAllStudents, sortedStudents, students, lessons]);

  const sortedRetroLessons = useMemo(() => {
    const sorted = [...retroLessons];
    if (retroSortBy === "date") {
      sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
    } else {
      sorted.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || "", "ru") || a.date.getTime() - b.date.getTime());
    }
    return sorted;
  }, [retroLessons, retroSortBy]);

  const handleRetroStudentChange = (id: string) => {
    setRetroStudentId(id);
    setRetroLessons([]);
  };

  const handleRetroMonthChange = (val: string) => {
    setRetroMonth(val);
  };

  useEffect(() => {
    if (retroStudentId && retroMonth) regenerateRetroLessons();
  }, [retroStudentId, retroMonth, regenerateRetroLessons]);

  const retroLessonKey = (l: RetroLesson) => `${l.studentId}_${l.date.getTime()}`;

  const toggleRetroLesson = (lesson: RetroLesson) => {
    const key = retroLessonKey(lesson);
    setRetroLessons(prev => prev.map(l => retroLessonKey(l) === key ? { ...l, included: !l.included } : l));
  };

  const setRetroAttendance = (lesson: RetroLesson, att: "attended" | "missed") => {
    const key = retroLessonKey(lesson);
    const status = att === "missed" ? "cancelled" : "completed";
    setRetroLessons(prev => prev.map(l => retroLessonKey(l) === key ? { ...l, attendance: att, status } : l));
  };

  const toggleAllRetro = (included: boolean) => {
    setRetroLessons(prev => prev.map(l => ({ ...l, included })));
  };

  const setAllRetroAttendance = (att: "attended" | "missed") => {
    const status = att === "missed" ? "cancelled" : "completed";
    setRetroLessons(prev => prev.map(l => l.included ? { ...l, attendance: att, status } : l));
  };

  const submitRetroLessons = async () => {
    const toCreate = retroLessons.filter(l => l.included);
    if (toCreate.length === 0) {
      toast.error("Не выбрано ни одного занятия");
      return;
    }
    setRetroSubmitting(true);
    try {
      const res = await fetch("/api/lessons/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lessons: toCreate.map(l => {
            const st = students.find(s => s.id === l.studentId);
            return {
              studentId: l.studentId,
              scheduledAt: l.date.toISOString(),
              durationMinutes: l.duration,
              topic: st?.subject || "Занятие",
              status: l.status,
              attendance: l.attendance,
            };
          }),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка создания");
      }
      const data = await res.json();
      toast.success(`Создано ${data.created} занятий`);
      invalidateResource("lessons");
      setRetroOpen(false);
      setRetroLessons([]);
      setRetroStudentId("");
      setRetroMonth("");
    } catch (e: any) {
      toast.error(e.message || "Ошибка создания занятий");
    } finally {
      setRetroSubmitting(false);
    }
  };

  const isLoading = studentsLoading || lessonsLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Занятия" subtitle="Загрузка...">
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-muted-foreground">Загрузка...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="🎯 Занятия"
      subtitle={`Сегодня ${dateRu(now)}`}
      tabs={
        <div className="flex rounded-lg border border-border/60 overflow-hidden">
          <Button variant="ghost" size="sm" className="h-8 rounded-none text-xs gap-1.5 px-3 bg-primary/10 text-primary" data-testid="tab-lessons-active">
            <CalendarDays className="h-3.5 w-3.5" /> Занятия
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-none text-xs gap-1.5 px-3 border-l border-border/60" onClick={() => setLocation("/schedule")} data-testid="tab-to-schedule">
            <Calendar className="h-3.5 w-3.5" /> Расписание
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <PageHero
          icon={<BookOpen className="h-6 w-6 text-white" />}
          gradient="from-violet-600/80 via-purple-600/70 to-indigo-600/60"
          title="Журнал занятий"
          subtitle="Нажмите на карточку занятия — отметьте статус (Проведено или Отменено), перенесите, добавьте заметку, войдите в конференцию. При отмене автоматически применяется политика штрафа."
          badge="Журнал"
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={navigatePrev} data-testid="button-nav-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium px-2 min-w-0 text-center capitalize flex-1 sm:min-w-[200px] sm:flex-none" data-testid="text-date-range">
              {dateLabel}
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={navigateNext} data-testid="button-nav-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant={canShowToday ? "default" : "ghost"}
              size="sm"
              className={cn("text-xs h-8 gap-1 shrink-0", canShowToday ? "bg-blue-600 hover:bg-blue-700 text-white" : "")}
              onClick={goToToday}
              data-testid="button-today"
            >
              <Target className="h-3 w-3" />
              Сегодня
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-border/60 overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 rounded-none text-xs gap-1 px-3", viewMode === "week" && "bg-blue-100 text-blue-700")}
                onClick={() => setViewMode("week")}
                data-testid="button-view-week"
              >
                <CalendarRange className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Неделя</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 rounded-none text-xs gap-1 px-3", viewMode === "day" && "bg-blue-100 text-blue-700")}
                onClick={() => setViewMode("day")}
                data-testid="button-view-day"
              >
                <CalendarDays className="h-3.5 w-3.5" /> <span className="hidden sm:inline">День</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 rounded-none text-xs gap-1 px-3", viewMode === "month" && "bg-blue-100 text-blue-700")}
                onClick={() => setViewMode("month")}
                data-testid="button-view-month"
              >
                <Calendar className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Месяц</span>
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-cyan-300 text-blue-700 hover:bg-blue-50 h-8 text-xs"
              data-testid="button-retro-fill"
              onClick={() => setRetroOpen(true)}
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Заполнить</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {[
            { value: "all" as LessonFilter, label: "Все" },
            { value: "completed_paid" as LessonFilter, label: "Проведено ✓" },
            { value: "completed_unpaid" as LessonFilter, label: "Проведено ✗" },
            { value: "cancelled_paid" as LessonFilter, label: "Отменено ✓" },
            { value: "cancelled_free" as LessonFilter, label: "Отменено ✗" },
            { value: "pending" as LessonFilter, label: "Ожидают" },
          ].map(f => (
            <Button
              key={f.value}
              variant={lessonFilter === f.value ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-7 text-[11px] px-2.5",
                lessonFilter === f.value && "bg-blue-600 hover:bg-blue-700"
              )}
              onClick={() => setLessonFilter(f.value)}
              data-testid={`filter-${f.value}`}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {viewMode === "week" && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="rounded-xl border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15">
                  <GraduationCap className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{weekTotal}</div>
                  <div className="text-[11px] text-muted-foreground">Всего за неделю</div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
                  <Check className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{weekCompleted}</div>
                  <div className="text-[11px] text-muted-foreground">Проведено</div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{weekPending}</div>
                  <div className="text-[11px] text-muted-foreground">Ожидают</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {viewMode === "day" && (
          <Card className="rounded-xl border-border/50 bg-gradient-to-r from-blue-50/50 to-transparent">
            <CardContent className="p-3 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15">
                <CalendarDays className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold capitalize">{format(currentDay, "EEEE", { locale: ru })}</div>
                <div className="text-xs text-muted-foreground">{format(currentDay, "d MMMM yyyy", { locale: ru })}</div>
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <div className="text-xl font-bold">{dayLessons.length}</div>
                  <div className="text-[10px] text-muted-foreground">Всего</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-600">{dayLessons.filter(l => l.status === "completed").length}</div>
                  <div className="text-[10px] text-muted-foreground">Проведено</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-600">{dayLessons.filter(l => l.status === "pending").length}</div>
                  <div className="text-[10px] text-muted-foreground">Ожидают</div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs border-cyan-300 text-blue-700 hover:bg-blue-50"
                onClick={() => openAddLesson(currentDay)}
                data-testid="button-add-day-lesson"
              >
                <Plus className="h-3.5 w-3.5" /> Добавить
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={retroOpen} onOpenChange={(open) => { setRetroOpen(open); if (!open) { setRetroLessons([]); setRetroStudentId(""); setRetroMonth(""); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-blue-600" />
                Ретрозаполнение занятий
              </DialogTitle>
              <DialogDescription>
                Добавьте прошедшие занятия по расписанию. Система определит расписание ученика из существующих занятий и создаст записи за выбранный месяц. Вы сможете отметить посещение и убрать ненужные.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 px-3 py-2 text-xs text-amber-700">
              <div className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <strong>Как это работает:</strong> Выберите ученика и месяц. Система найдёт повторяющееся расписание 
                  (дни недели и время) из уже созданных занятий и сгенерирует список. Снимите галочки с дней, когда 
                  занятий не было, и отметьте статус посещения. Уже существующие занятия не будут дублироваться.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Ученик</label>
                <StudentCombobox
                  students={sortedStudents}
                  value={retroStudentId}
                  onValueChange={handleRetroStudentChange}
                  showAllOption
                  allOptionLabel={`Все ученики (${students.length})`}
                  data-testid="select-retro-student"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Месяц</label>
                <Select value={retroMonth} onValueChange={handleRetroMonthChange}>
                  <SelectTrigger data-testid="select-retro-month">
                    <SelectValue placeholder="Выберите месяц" />
                  </SelectTrigger>
                  <SelectContent>
                    {pastMonthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {retroStudentId && !isAllStudents && retroDetectedSlots.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                <div className="text-xs font-medium text-muted-foreground mb-1">Обнаруженное расписание:</div>
                <div className="flex flex-wrap gap-2">
                  {retroDetectedSlots.map((slot, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {DAY_NAMES_FULL[slot.day]} {String(slot.hour).padStart(2, "0")}:{String(slot.minute).padStart(2, "0")} ({slot.duration} мин)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {isAllStudents && retroMonth && retroLessons.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Найдено расписание у {new Set(retroLessons.map(l => l.studentId)).size} из {students.length} учеников
                </div>
              </div>
            )}

            {retroStudentId && !isAllStudents && retroDetectedSlots.length === 0 && (
              <div className="rounded-lg border border-red-200/60 bg-red-50/50 px-3 py-3 text-sm text-red-600">
                Не удалось определить расписание. У ученика должно быть минимум 2 занятия в одно и то же время для определения паттерна. Создайте несколько будущих занятий через раздел «Расписание», затем вернитесь сюда.
              </div>
            )}

            {isAllStudents && retroMonth && retroLessons.length === 0 && retroStudentsWithSlots === 0 && (
              <div className="rounded-lg border border-red-200/60 bg-red-50/50 px-3 py-3 text-sm text-red-600">
                Ни у одного ученика не удалось определить расписание. Необходимо минимум 2 занятия в одно и то же время.
              </div>
            )}

            {isAllStudents && retroMonth && retroLessons.length === 0 && retroStudentsWithSlots > 0 && (
              <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-3 text-sm text-amber-700">
                Расписание найдено у {retroStudentsWithSlots} учеников, но все занятия за этот месяц уже существуют или месяц ещё не наступил.
              </div>
            )}

            {retroLessons.length > 0 && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm font-medium">
                    Занятия к добавлению: {retroLessons.filter(l => l.included).length} из {retroLessons.length}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toggleAllRetro(true)} data-testid="button-retro-select-all">
                      Выбрать все
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toggleAllRetro(false)} data-testid="button-retro-deselect-all">
                      Снять все
                    </Button>
                    <Separator orientation="vertical" className="h-5 mx-1" />
                    <Button variant="ghost" size="sm" className="text-xs h-7 text-emerald-600" onClick={() => setAllRetroAttendance("attended")}>
                      Все пришли
                    </Button>
                  </div>
                </div>

                {isAllStudents && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Сортировка:</span>
                    <div className="flex rounded-md border border-border/50 overflow-hidden">
                      <button
                        className={cn(
                          "px-3 py-1 text-xs transition-colors",
                          retroSortBy === "date" ? "bg-blue-100 text-blue-700 font-medium" : "bg-background text-muted-foreground hover:bg-muted/50"
                        )}
                        onClick={() => setRetroSortBy("date")}
                        data-testid="button-retro-sort-date"
                      >
                        По дате
                      </button>
                      <button
                        className={cn(
                          "px-3 py-1 text-xs transition-colors border-l border-border/50",
                          retroSortBy === "student" ? "bg-blue-100 text-blue-700 font-medium" : "bg-background text-muted-foreground hover:bg-muted/50"
                        )}
                        onClick={() => setRetroSortBy("student")}
                        data-testid="button-retro-sort-student"
                      >
                        По ученикам
                      </button>
                    </div>
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden max-h-[340px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                        <th className="px-3 py-2 text-left w-10"></th>
                        {isAllStudents && <th className="px-3 py-2 text-left">Ученик</th>}
                        <th className="px-3 py-2 text-left">Дата</th>
                        <th className="px-3 py-2 text-left">День</th>
                        <th className="px-3 py-2 text-left">Время</th>
                        <th className="px-3 py-2 text-left">Длит.</th>
                        <th className="px-3 py-2 text-left">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRetroLessons.map((lesson, idx) => {
                        const prevLesson = idx > 0 ? sortedRetroLessons[idx - 1] : null;
                        const showGroupDivider = isAllStudents && prevLesson && (
                          retroSortBy === "student"
                            ? prevLesson.studentId !== lesson.studentId
                            : prevLesson.date.getDate() !== lesson.date.getDate()
                        );
                        return (
                        <tr
                          key={retroLessonKey(lesson)}
                          className={cn(
                            "border-t transition-colors",
                            !lesson.included && "opacity-40 bg-muted/20",
                            showGroupDivider ? "border-t-2 border-t-border" : "border-border/30"
                          )}
                        >
                          <td className="px-3 py-1.5">
                            <Checkbox
                              checked={lesson.included}
                              onCheckedChange={() => toggleRetroLesson(lesson)}
                              data-testid={`checkbox-retro-${idx}`}
                            />
                          </td>
                          {isAllStudents && (
                            <td className="px-3 py-1.5 text-xs font-medium max-w-[120px] truncate" title={lesson.studentName}>
                              {lesson.studentName}
                            </td>
                          )}
                          <td className="px-3 py-1.5 font-medium">
                            {format(lesson.date, "d MMM", { locale: ru })}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {DAY_NAMES_SHORT[lesson.dayOfWeek]}
                          </td>
                          <td className="px-3 py-1.5">
                            {String(lesson.hour).padStart(2, "0")}:{String(lesson.minute).padStart(2, "0")}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {lesson.duration} мин
                          </td>
                          <td className="px-3 py-1.5">
                            {lesson.included && (
                              <div className="flex gap-1 flex-wrap">
                                <button
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[11px] border transition-colors",
                                    lesson.attendance === "attended"
                                      ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                                      : "bg-background border-border/50 text-muted-foreground hover:bg-emerald-50"
                                  )}
                                  onClick={() => setRetroAttendance(lesson, "attended")}
                                  data-testid={`button-retro-attended-${idx}`}
                                >
                                  Проведено
                                </button>
                                <button
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[11px] border transition-colors",
                                    lesson.attendance === "missed"
                                      ? "bg-red-100 border-red-300 text-red-700"
                                      : "bg-background border-border/50 text-muted-foreground hover:bg-red-50"
                                  )}
                                  onClick={() => setRetroAttendance(lesson, "missed")}
                                  data-testid={`button-retro-missed-${idx}`}
                                >
                                  Отменено
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setRetroOpen(false)}
                    data-testid="button-retro-cancel"
                  >
                    Отмена
                  </Button>
                  <Button
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                    disabled={retroSubmitting || retroLessons.filter(l => l.included).length === 0}
                    onClick={submitRetroLessons}
                    data-testid="button-retro-submit"
                  >
                    {retroSubmitting ? (
                      <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                    ) : (
                      <CalendarPlus className="h-4 w-4" />
                    )}
                    Создать {retroLessons.filter(l => l.included).length} занятий
                  </Button>
                </div>
              </>
            )}

            {retroStudentId && retroMonth && retroDetectedSlots.length > 0 && retroLessons.length === 0 && (
              <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 px-3 py-3 text-sm text-emerald-600">
                Все занятия за этот месяц уже существуют или месяц ещё не наступил.
              </div>
            )}
          </DialogContent>
        </Dialog>

        {viewMode === "month" ? (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-3 sm:p-4">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 p-2 text-center">
                  <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{monthLessonsTotal.length}</div>
                  <div className="text-[10px] text-muted-foreground">Всего в месяце</div>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 p-2 text-center">
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {monthLessonsTotal.filter(l => l.status === "completed").length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Проведено</div>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 p-2 text-center">
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                    {monthLessonsTotal.filter(l => l.status === "pending").length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Ожидают</div>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-px bg-border/50 rounded-lg overflow-hidden border border-border/50">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(d => (
                  <div key={d} className="bg-muted/30 py-1.5 text-center text-[10px] font-semibold text-muted-foreground uppercase">{d}</div>
                ))}
                {monthGridDays.map((day, i) => {
                  const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                  const dayLessonsRaw = ((monthLessonsByDate.map.get(key) as any) || []) as typeof lessons;
                  const dayLessonsList = dayLessonsRaw.filter(filterLesson);
                  const isCurrentMonth = day.getMonth() === currentMonthDate.getMonth();
                  const isTodayD = day.getTime() === todayDate.getTime();
                  const isSelected = selectedMonthDay && day.getTime() === selectedMonthDay.getTime();
                  const hasCompleted = dayLessonsList.some(l => l.status === "completed" && l.attendance === "attended");
                  const hasUnpaid = dayLessonsList.some(l => l.status === "completed" && l.attendance === "attended_unpaid");
                  const hasPending = dayLessonsList.some(l => l.status === "pending");
                  const hasCancelled = dayLessonsList.some(l => l.status === "cancelled");
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedMonthDay(isSelected ? null : day)}
                      onDoubleClick={() => openAddLesson(day)}
                      className={cn(
                        "bg-background p-1 min-h-[72px] flex flex-col items-stretch gap-0.5 transition-colors text-left relative group",
                        !isCurrentMonth && "opacity-40",
                        isSelected && "ring-2 ring-blue-500 ring-inset bg-blue-500/5",
                        isTodayD && !isSelected && "bg-blue-500/5",
                        "hover:bg-accent/40 cursor-pointer",
                      )}
                      data-testid={`month-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <div className="flex items-center justify-between px-0.5">
                        <span className={cn(
                          "text-[11px] w-5 h-5 flex items-center justify-center rounded-full",
                          isTodayD && "bg-blue-600 text-white font-bold",
                          !isTodayD && "font-medium",
                        )}>
                          {day.getDate()}
                        </span>
                        {dayLessonsList.length > 0 && (
                          <span className="text-[9px] text-muted-foreground font-medium">{dayLessonsList.length}</span>
                        )}
                      </div>
                      <div className="space-y-0.5 flex-1 overflow-hidden">
                        {dayLessonsList.slice(0, 3).map(l => {
                          const student = students.find(s => s.id === l.studentId);
                          return (
                            <div
                              key={l.id}
                              className={cn(
                                "rounded px-1 py-0.5 text-[9px] leading-tight truncate",
                                l.status === "cancelled" ? "bg-red-500/10 text-red-700 dark:text-red-400" :
                                l.status === "completed" && l.attendance === "attended" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                                l.status === "completed" && l.attendance === "attended_unpaid" ? "bg-red-500/10 text-red-700 dark:text-red-400" :
                                "bg-blue-500/15 text-blue-700 dark:text-blue-400",
                              )}
                              title={`${format(l.scheduledAt, "HH:mm")} — ${student?.name || "—"}${l.topic ? " · " + l.topic : ""}`}
                            >
                              <span className="font-semibold">{format(l.scheduledAt, "HH:mm")}</span>
                              {student?.name && <span className="ml-1 opacity-80">{student.name.split(" ")[0]}</span>}
                            </div>
                          );
                        })}
                        {dayLessonsList.length > 3 && (
                          <div className="text-[9px] text-muted-foreground px-1">+{dayLessonsList.length - 3}</div>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-0.5 pb-0.5">
                        {hasPending && <div className="w-1 h-1 rounded-full bg-blue-500" />}
                        {hasCompleted && <div className="w-1 h-1 rounded-full bg-emerald-500" />}
                        {hasUnpaid && <div className="w-1 h-1 rounded-full bg-red-500" />}
                        {hasCancelled && <div className="w-1 h-1 rounded-full bg-orange-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Ожидает</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Проведено</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Не оплачено</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Отменено</span>
                </div>
                <span className="text-[10px]">Двойной клик по дате — добавить занятие</span>
              </div>

              <AnimatePresence>
                {selectedMonthDay && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium capitalize">
                          {format(selectedMonthDay, "EEEE, d MMMM", { locale: ru })}
                          {selectedMonthDay.getTime() === todayDate.getTime() && (
                            <Badge className="ml-2 text-[10px] bg-blue-100 text-blue-700 border-blue-200 border">Сегодня</Badge>
                          )}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => openAddLesson(selectedMonthDay)}
                          data-testid="button-add-on-selected-day"
                        >
                          <Plus className="h-3 w-3" /> Добавить
                        </Button>
                      </div>
                      {filteredSelectedMonthDayLessons.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Нет занятий</p>
                      ) : (
                        <div className="space-y-1.5">
                          {filteredSelectedMonthDayLessons.map((l: typeof lessons[0]) => {
                            const student = students.find(s => s.id === l.studentId);
                            const st = statusLabel(l.status as LessonStatus, l.attendance);
                            const StatusIcon = st.icon;
                            return (
                              <div
                                key={l.id}
                                className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm hover:bg-accent/40 cursor-pointer transition-colors"
                                onClick={() => { setEditingLessonId(l.id); setViewMode("day"); setDayOffset(Math.round((selectedMonthDay.getTime() - todayDate.getTime()) / 86400000)); }}
                                data-testid={`month-lesson-${l.id}`}
                              >
                                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white text-xs font-semibold", getAvatarColor(student?.name || ""))}>
                                  {getInitials(student?.name || "?")}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium truncate">{student?.name ?? "—"}</span>
                                    <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]", st.tone)}>
                                      <StatusIcon className="h-2.5 w-2.5" />{st.text}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeRuTz(l.scheduledAt, userTimezone)}</span>
                                    <span>{l.durationMinutes} мин</span>
                                    {l.topic && <span className="truncate max-w-[180px]">· {l.topic}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        ) : viewMode === "week" ? (
          weekTotal === 0 ? (
            <EmptyState
              title="На этой неделе занятий нет"
              description="Добавьте занятия в расписании или перейдите на другую неделю."
              action={
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => setWeekOffset(w => w - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Прошлая неделя
                  </Button>
                  <Button className="gap-2" onClick={() => setLocation("/schedule")}>
                    <Plus className="h-4 w-4" />
                    Расписание
                  </Button>
                </div>
              }
            />
          ) : (
          <div className="space-y-4">
            {filteredWeekByDay.map((day, dayIdx) => {
              const isToday = day.date.getTime() === todayDate.getTime();
              const isPast = day.date < todayDate;
              return (
                <div key={dayIdx} data-testid={`day-block-${dayIdx}`}>
                  <div className={cn(
                    "flex items-center gap-2 mb-2 px-1",
                    isToday && "text-blue-700 font-semibold"
                  )}>
                    <span className={cn(
                      "text-sm font-medium",
                      isPast && !isToday && "text-muted-foreground"
                    )}>
                      {day.dayName}, {format(day.date, "d MMMM", { locale: ru })}
                    </span>
                    {isToday && <Badge className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0">Сегодня</Badge>}
                    {day.lessons.length > 0 && <span className="text-xs text-muted-foreground">({day.lessons.length})</span>}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-blue-600"
                      onClick={() => openAddLesson(day.date)}
                      data-testid={`add-lesson-day-${dayIdx}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {day.lessons.map((lesson) => {
                      const student = students.find(s => s.id === lesson.studentId);
                      const links = student?.links as any;
                      const isEditing = editingLessonId === lesson.id;
                      const st = statusLabel(lesson.status as LessonStatus, lesson.attendance);
                      const StatusIcon = st.icon;

                      return (
                        <Card
                          key={lesson.id}
                          className={cn(
                            "rounded-xl border-border/50 transition-all hover:shadow-sm hover:border-border",
                            isToday && "border-blue-200/60",
                            isPast && !isToday && "opacity-80"
                          )}
                          data-testid={`lesson-card-${lesson.id}`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <button
                                className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity"  , getAvatarColor(student?.name || ""))}
                                onClick={() => setEditingLessonId(isEditing ? null : lesson.id)}
                                title="Нажмите, чтобы изменить занятие"
                                data-testid={`avatar-lesson-${lesson.id}`}
                              >
                                {getInitials(student?.name || "?")}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className="font-medium text-sm truncate cursor-pointer hover:text-blue-600 transition-colors"
                                    onClick={() => setEditingLessonId(isEditing ? null : lesson.id)}
                                    data-testid={`text-lesson-name-${lesson.id}`}
                                  >{student?.name ?? "—"}</span>
                                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", st.tone)}>
                                    <StatusIcon className="h-3 w-3" />
                                    {st.text}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeRuTz(lesson.scheduledAt, userTimezone)}</span>
                                  <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{lesson.durationMinutes} мин</span>
                                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{student?.subject ?? ""}</span>
                                  {lesson.topic && <span className="truncate max-w-[150px]">{lesson.topic}</span>}
                                </div>
                              </div>

                              <TooltipProvider delayDuration={200}>
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Внутренняя доска — всегда */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost" size="icon" className="h-8 w-8 text-violet-500 hover:text-violet-700 hover:bg-violet-500/10"
                                        onClick={() => setLocation(`/board/${lesson.studentId}`)}
                                        data-testid={`button-internal-board-${lesson.id}`}
                                      >
                                        <LayoutGrid className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Доска (внутр.)</TooltipContent>
                                  </Tooltip>
                                  {/* Внутренняя конференция BBB — всегда */}
                                  {(() => {
                                    const bbbConf = bbbConferences.find(c => c.studentId === lesson.studentId);
                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost" size="icon"
                                            className={cn("h-8 w-8",
                                              bbbConf
                                                ? bbbConf.isRunning
                                                  ? "text-green-500 hover:text-green-700 hover:bg-green-500/10"
                                                  : "text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                                                : "text-muted-foreground/25 cursor-default"
                                            )}
                                            onClick={() => { if (bbbConf) handleJoinBbb(bbbConf.id); }}
                                            disabled={!bbbConf || joiningBbbId === bbbConf?.id}
                                            data-testid={`button-bbb-${lesson.id}`}
                                          >
                                            {bbbConf && joiningBbbId === bbbConf.id
                                              ? <span className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
                                              : <Video className="h-4 w-4" />}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {bbbConf ? (bbbConf.isRunning ? "Конференция идёт — войти в BBB" : "Конференция BBB (внутр.)") : "Конференция BBB (не настроена)"}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })()}
                                  {/* Внешняя конференция — если есть */}
                                  {links?.conference && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost" size="icon" className="h-8 w-8 text-blue-400/60 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                          onClick={() => window.open(links.conference.startsWith("http") ? links.conference : `https://${links.conference}`, "_blank")}
                                          data-testid={`button-conference-${lesson.id}`}
                                        >
                                          <Video className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Конференция (внешн.)</TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost" size="icon" className="h-8 w-8"
                                        onClick={() => setLocation(`/students?open=${lesson.studentId}`)}
                                        data-testid={`button-profile-${lesson.id}`}
                                      >
                                        <User className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Профиль ученика</TooltipContent>
                                  </Tooltip>
                                  {/* Внешняя доска — если есть */}
                                  {links?.board && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost" size="icon" className="h-8 w-8 text-violet-400/60 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                                          onClick={() => window.open(links.board.startsWith("http") ? links.board : `https://${links.board}`, "_blank")}
                                          data-testid={`button-board-${lesson.id}`}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Доска (внешн.)</TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Button
                                    variant={isEditing ? "secondary" : "ghost"}
                                    size="sm"
                                    className="h-8 text-xs px-2"
                                    onClick={() => setEditingLessonId(isEditing ? null : lesson.id)}
                                    data-testid={`button-edit-${lesson.id}`}
                                  >
                                    {isEditing ? "Свернуть" : "Изменить"}
                                  </Button>
                                </div>
                              </TooltipProvider>
                            </div>

                            {isEditing && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 pt-3 border-t border-border/50"
                              >
                                <div className="space-y-3">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      className={cn("px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5", lesson.status === "completed" && lesson.attendance === "attended" ? "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium" : "bg-background border-border/50 text-muted-foreground hover:bg-emerald-50")}
                                      onClick={() => applyLessonUpdate(lesson.id, { status: "completed", attendance: "attended" })}
                                      data-testid={`button-status-done-${lesson.id}`}
                                    >
                                      <Check className="h-3 w-3" /> Проведено
                                    </button>
                                    <button
                                      className={cn("px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5", lesson.status === "cancelled" ? "bg-red-100 border-red-300 text-red-700 font-medium" : "bg-background border-border/50 text-muted-foreground hover:bg-red-50")}
                                      onClick={() => applyLessonUpdate(lesson.id, { status: "cancelled" })}
                                      data-testid={`button-status-cancel-${lesson.id}`}
                                    >
                                      <X className="h-3 w-3" /> Отменено
                                    </button>
                                    <button
                                      className={cn("px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5", lesson.status === "pending" ? "bg-amber-100 border-amber-300 text-amber-700 font-medium" : "bg-background border-border/50 text-muted-foreground hover:bg-amber-50")}
                                      onClick={() => applyLessonUpdate(lesson.id, { status: "pending", attendance: null })}
                                      data-testid={`button-status-pending-${lesson.id}`}
                                    >
                                      <Clock className="h-3 w-3" /> Ожидает
                                    </button>
                                  </div>

                                  {/* Balance display */}
                                  {student && (
                                    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                                      <span className="text-xs text-muted-foreground">Баланс ученика:</span>
                                      <span className={cn("text-xs font-bold tabular-nums",
                                        getEffectiveBalance(student.id) > 0 ? "text-emerald-600" :
                                        getEffectiveBalance(student.id) < 0 ? "text-red-600" :
                                        "text-muted-foreground"
                                      )}>
                                        {getEffectiveBalance(student.id) > 0 ? "+" : ""}{getEffectiveBalance(student.id).toLocaleString("ru")} ₽
                                      </span>
                                    </div>
                                  )}

                                  <div className="pt-2 border-t border-border/40 space-y-2">
                                    <div>
                                      <div className="text-xs font-medium text-muted-foreground mb-1.5">Тема занятия</div>
                                      <div className="flex gap-1.5">
                                        <Input value={editTopicValue} onChange={e => setEditTopicValue(e.target.value)} className="h-8 text-xs flex-1" placeholder="Тема" list="lesson-topic-suggestions-edit" />
                                        <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => applyLessonUpdate(lesson.id, { topic: editTopicValue })}>Сохр.</Button>
                                      </div>
                                      <datalist id="lesson-topic-suggestions-edit">{uniqueTopics.map(t => <option key={t} value={t} />)}</datalist>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-muted-foreground mb-1.5">Оценка занятия (видна ученику)</div>
                                      <div className="flex items-center gap-0.5">
                                        {[1,2,3,4,5].map(s => (
                                          <button key={s} onClick={() => { setEditRating(s); applyLessonUpdate(lesson.id, { rating: s }); }} className="hover:scale-110 transition-transform">
                                            <Star className={cn("h-5 w-5", editRating !== null && s <= editRating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 hover:text-amber-300")} />
                                          </button>
                                        ))}
                                        {editRating !== null && (
                                          <button className="text-[10px] text-muted-foreground ml-1.5 hover:text-red-500" onClick={() => { setEditRating(null); applyLessonUpdate(lesson.id, { rating: null }); }}>✕</button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-border/40">
                                    <div className="text-xs font-medium text-muted-foreground mb-2">Перенести занятие</div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <Input
                                        type="date"
                                        value={rescheduleDate}
                                        onChange={e => setRescheduleDate(e.target.value)}
                                        className="h-8 text-xs flex-1 min-w-[130px]"
                                        data-testid={`input-reschedule-date-${lesson.id}`}
                                      />
                                      <Input
                                        type="time"
                                        value={rescheduleTime}
                                        onChange={e => setRescheduleTime(e.target.value)}
                                        className="h-8 text-xs w-[90px]"
                                        data-testid={`input-reschedule-time-${lesson.id}`}
                                      />
                                      <Button
                                        size="sm"
                                        className="h-8 text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                                        onClick={() => handleReschedule(lesson.id)}
                                        disabled={updateLesson.isPending}
                                        data-testid={`button-reschedule-${lesson.id}`}
                                      >
                                        <MoveRight className="h-3.5 w-3.5" /> Перенести
                                      </Button>
                                    </div>
                                  </div>

                                  {(() => {
                                    const bbbConf = bbbConferences.find(c => c.studentId === lesson.studentId);
                                    return (
                                      <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-2">Ссылки</div>
                                        <div className="flex gap-2 flex-wrap">
                                          {/* Внутренняя доска — всегда */}
                                          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-violet-500/40 text-violet-600 hover:bg-violet-500/10"
                                            onClick={() => setLocation(`/board/${lesson.studentId}`)}
                                          >
                                            <LayoutGrid className="h-3.5 w-3.5" /> Доска (внутр.)
                                          </Button>
                                          {/* Внутренняя конференция BBB — всегда */}
                                          {bbbConf ? (
                                            <Button size="sm" className={cn("gap-1.5 text-xs h-8 text-white", bbbConf.isRunning ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700")}
                                              onClick={() => handleJoinBbb(bbbConf.id)}
                                              disabled={joiningBbbId === bbbConf.id}
                                            >
                                              {joiningBbbId === bbbConf.id
                                                ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin block" />
                                                : <Video className="h-3.5 w-3.5" />}
                                              {bbbConf.isRunning ? "BBB идёт" : "Конференция BBB"}
                                            </Button>
                                          ) : (
                                            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 opacity-40" disabled>
                                              <Video className="h-3.5 w-3.5" /> Конференция BBB
                                            </Button>
                                          )}
                                          {/* Внешняя конференция — если есть */}
                                          {links?.conference && (
                                            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500/30 dark:hover:bg-blue-500/10"
                                              onClick={() => window.open(links.conference.startsWith("http") ? links.conference : `https://${links.conference}`, "_blank")}
                                            >
                                              <Video className="h-3 w-3" /> Конф. (внешн.)
                                            </Button>
                                          )}
                                          {/* Внешняя доска — если есть */}
                                          {links?.board && (
                                            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-500/30 dark:hover:bg-violet-500/10"
                                              onClick={() => window.open(links.board.startsWith("http") ? links.board : `https://${links.board}`, "_blank")}
                                            >
                                              <Pencil className="h-3 w-3" /> Доска (внешн.)
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  <div className="pt-2 border-t border-border/40">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-8 gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setDeletingLessonId(lesson.id)}
                                      data-testid={`button-delete-${lesson.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Удалить занятие
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                    {day.lessons.length === 0 && (
                      <div className="text-xs text-muted-foreground italic pl-1 py-1">Нет занятий</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )
        ) : (
          <div className="space-y-3">
            {filteredDayLessons.length === 0 ? (
              <EmptyState
                title="Занятий на этот день нет"
                description="Добавьте занятие или перейдите на другой день."
                action={
                  <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setDayOffset(d => d - 1)}>
                      <ChevronLeft className="h-4 w-4" /> Вчера
                    </Button>
                    <Button className="gap-2" onClick={() => openAddLesson(currentDay)}>
                      <Plus className="h-4 w-4" /> Добавить
                    </Button>
                  </div>
                }
              />
            ) : (
              filteredDayLessons.map((lesson) => {
                const student = students.find(s => s.id === lesson.studentId);
                const links = student?.links as any;
                const isEditing = editingLessonId === lesson.id;
                const st = statusLabel(lesson.status as LessonStatus, lesson.attendance);
                const StatusIcon = st.icon;

                return (
                  <Card
                    key={lesson.id}
                    className="rounded-xl border-border/50 transition-all"
                    data-testid={`lesson-card-${lesson.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <button
                          className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity", getAvatarColor(student?.name || ""))}
                          onClick={() => setEditingLessonId(isEditing ? null : lesson.id)}
                          title="Нажмите, чтобы изменить занятие"
                          data-testid={`avatar-lesson-day-${lesson.id}`}
                        >
                          {getInitials(student?.name || "?")}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              className="font-semibold text-base truncate cursor-pointer hover:text-blue-600 transition-colors"
                              onClick={() => setEditingLessonId(isEditing ? null : lesson.id)}
                            >{student?.name ?? "—"}</span>
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs", st.tone)}>
                              <StatusIcon className="h-3 w-3" />
                              {st.text}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatInTimeZone(lesson.scheduledAt, "Europe/Moscow", "HH:mm")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Timer className="h-3.5 w-3.5" />
                              {lesson.durationMinutes} мин
                            </span>
                            {lesson.topic && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[200px]">{lesson.topic}</span>
                              </span>
                            )}
                            {student?.pricePerLesson && (
                              <span className="flex items-center gap-1">
                                <CircleDollarSign className="h-3.5 w-3.5" />
                                {student.pricePerLesson} ₽
                              </span>
                            )}
                          </div>
                        </div>

                        <TooltipProvider delayDuration={300}>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {links?.conference && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                    onClick={() => window.open(links.conference.startsWith("http") ? links.conference : `https://${links.conference}`, "_blank")}
                                    data-testid={`button-conference-day-${lesson.id}`}
                                  >
                                    <Video className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Конференция</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-purple-600"
                                  onClick={() => setLocation(`/board/${lesson.studentId}`)}
                                  data-testid={`button-internal-board-day-${lesson.id}`}
                                >
                                  <LayoutGrid className="h-4 w-4 text-purple-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Внутренняя доска</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => setLocation(`/students?open=${lesson.studentId}`)}
                                  data-testid={`button-profile-day-${lesson.id}`}
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Профиль ученика</TooltipContent>
                            </Tooltip>
                            {links?.board && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                                    onClick={() => window.open(links.board.startsWith("http") ? links.board : `https://${links.board}`, "_blank")}
                                    data-testid={`button-board-day-${lesson.id}`}
                                  >
                                    <ExternalLink className="h-4 w-4 text-emerald-400" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Внешняя доска</TooltipContent>
                              </Tooltip>
                            )}
                            <Button
                              variant={isEditing ? "secondary" : "ghost"}
                              size="sm"
                              className="text-xs h-8 gap-1"
                              onClick={() => setEditingLessonId(isEditing ? null : lesson.id)}
                              data-testid={`edit-lesson-${lesson.id}`}
                            >
                              {isEditing ? "Свернуть" : "Изменить"}
                            </Button>
                          </div>
                        </TooltipProvider>
                      </div>

                      {isEditing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-border/50"
                        >
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className={cn("px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5", lesson.status === "completed" && lesson.attendance === "attended" ? "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium" : "bg-background border-border/50 text-muted-foreground hover:bg-emerald-50")}
                                onClick={() => applyLessonUpdate(lesson.id, { status: "completed", attendance: "attended" })}
                                data-testid={`button-day-done-${lesson.id}`}
                              >
                                <Check className="h-3 w-3" /> Проведено
                              </button>
                              <button
                                className={cn("px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5", lesson.status === "cancelled" ? "bg-red-100 border-red-300 text-red-700 font-medium" : "bg-background border-border/50 text-muted-foreground hover:bg-red-50")}
                                onClick={() => applyLessonUpdate(lesson.id, { status: "cancelled" })}
                                data-testid={`button-day-cancel-${lesson.id}`}
                              >
                                <X className="h-3 w-3" /> Отменено
                              </button>
                              <button
                                className={cn("px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5", lesson.status === "pending" ? "bg-amber-100 border-amber-300 text-amber-700 font-medium" : "bg-background border-border/50 text-muted-foreground hover:bg-amber-50")}
                                onClick={() => applyLessonUpdate(lesson.id, { status: "pending", attendance: null })}
                                data-testid={`button-day-pending-${lesson.id}`}
                              >
                                <Clock className="h-3 w-3" /> Ожидает
                              </button>
                            </div>

                            {/* Balance display (day view) */}
                            {student && (
                              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                                <span className="text-xs text-muted-foreground">Баланс ученика:</span>
                                <span className={cn("text-xs font-bold tabular-nums",
                                  getEffectiveBalance(student.id) > 0 ? "text-emerald-600" :
                                  getEffectiveBalance(student.id) < 0 ? "text-red-600" :
                                  "text-muted-foreground"
                                )}>
                                  {getEffectiveBalance(student.id) > 0 ? "+" : ""}{getEffectiveBalance(student.id).toLocaleString("ru")} ₽
                                </span>
                              </div>
                            )}

                            <div className="pt-2 border-t border-border/40 space-y-2">
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1.5">Тема занятия</div>
                                <div className="flex gap-1.5">
                                  <Input value={editTopicValue} onChange={e => setEditTopicValue(e.target.value)} className="h-8 text-xs flex-1" placeholder="Тема" list="lesson-topic-suggestions-edit" />
                                  <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => applyLessonUpdate(lesson.id, { topic: editTopicValue })}>Сохр.</Button>
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1.5">Оценка занятия (видна ученику)</div>
                                <div className="flex items-center gap-0.5">
                                  {[1,2,3,4,5].map(s => (
                                    <button key={s} onClick={() => { setEditRating(s); applyLessonUpdate(lesson.id, { rating: s }); }} className="hover:scale-110 transition-transform">
                                      <Star className={cn("h-5 w-5", editRating !== null && s <= editRating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 hover:text-amber-300")} />
                                    </button>
                                  ))}
                                  {editRating !== null && (
                                    <button className="text-[10px] text-muted-foreground ml-1.5 hover:text-red-500" onClick={() => { setEditRating(null); applyLessonUpdate(lesson.id, { rating: null }); }}>✕</button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-border/40">
                              <div className="text-xs font-medium text-muted-foreground mb-2">Перенести занятие</div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Input
                                  type="date"
                                  value={rescheduleDate}
                                  onChange={e => setRescheduleDate(e.target.value)}
                                  className="h-8 text-xs flex-1 min-w-[130px]"
                                  data-testid={`input-reschedule-date-day-${lesson.id}`}
                                />
                                <Input
                                  type="time"
                                  value={rescheduleTime}
                                  onChange={e => setRescheduleTime(e.target.value)}
                                  className="h-8 text-xs w-[90px]"
                                  data-testid={`input-reschedule-time-day-${lesson.id}`}
                                />
                                <Button
                                  size="sm"
                                  className="h-8 text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                                  onClick={() => handleReschedule(lesson.id)}
                                  disabled={updateLesson.isPending}
                                  data-testid={`button-reschedule-day-${lesson.id}`}
                                >
                                  <MoveRight className="h-3.5 w-3.5" /> Перенести
                                </Button>
                              </div>
                            </div>

                            {(links?.conference || links?.board) && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-2">Ссылки</div>
                                <div className="flex gap-2">
                                  {links?.conference && (
                                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                                      onClick={() => window.open(links.conference.startsWith("http") ? links.conference : `https://${links.conference}`, "_blank")}
                                    >
                                      <Video className="h-3.5 w-3.5" /> Конференция
                                    </Button>
                                  )}
                                  {links?.board && (
                                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-500/30 dark:hover:bg-violet-500/10"
                                      onClick={() => window.open(links.board.startsWith("http") ? links.board : `https://${links.board}`, "_blank")}
                                    >
                                      <Pencil className="h-3.5 w-3.5" /> Доска (внешн.)
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="pt-2 border-t border-border/40">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-8 gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeletingLessonId(lesson.id)}
                                data-testid={`button-delete-day-${lesson.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Удалить занятие
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        <AlertDialog open={!!deletingLessonId} onOpenChange={(open) => { if (!open) setDeletingLessonId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить занятие?</AlertDialogTitle>
              <AlertDialogDescription>
                {(() => {
                  const lesson = lessons.find(l => l.id === deletingLessonId);
                  const student = lesson ? students.find(s => s.id === lesson.studentId) : null;
                  return lesson ? `${student?.name ?? "Ученик"}, ${format(lesson.scheduledAt, "d MMMM HH:mm", { locale: ru })}. Это действие нельзя отменить.` : "Это действие нельзя отменить.";
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deletingLessonId && handleDeleteLesson(deletingLessonId)}
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!addLessonDate} onOpenChange={open => { if (!open) setAddLessonDate(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Добавить занятие</DialogTitle>
              <DialogDescription>
                {addLessonDate ? format(addLessonDate, "EEEE, d MMMM yyyy", { locale: ru }) : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs mb-1.5 block">Ученик</Label>
                <StudentCombobox
                  students={sortedStudents}
                  value={addStudentId}
                  onValueChange={setAddStudentId}
                  data-testid="add-lesson-student"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Время</Label>
                  <Input
                    type="time"
                    value={addTime}
                    onChange={e => setAddTime(e.target.value)}
                    data-testid="add-lesson-time"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Длительность (мин)</Label>
                  <Select value={String(addDuration)} onValueChange={v => setAddDuration(Number(v))}>
                    <SelectTrigger data-testid="add-lesson-duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 мин</SelectItem>
                      <SelectItem value="45">45 мин</SelectItem>
                      <SelectItem value="60">60 мин</SelectItem>
                      <SelectItem value="90">90 мин</SelectItem>
                      <SelectItem value="120">120 мин</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">Тема (необязательно)</Label>
                <Input
                  value={addTopic}
                  onChange={e => setAddTopic(e.target.value)}
                  placeholder="Оставьте пустым — подставится предмет ученика"
                  data-testid="add-lesson-topic"
                  list="lesson-topic-suggestions"
                />
                <datalist id="lesson-topic-suggestions">
                  {uniqueTopics.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">Статус</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={addStatus === "pending" ? "default" : "outline"}
                    className={cn("text-xs h-8", addStatus === "pending" && "bg-amber-500 hover:bg-amber-600")}
                    onClick={() => { setAddStatus("pending"); setAddAttendance(""); }}
                    data-testid="add-lesson-status-pending"
                  >
                    <Clock className="h-3 w-3 mr-1" /> Ожидает
                  </Button>
                  <Button
                    size="sm"
                    variant={addStatus === "completed" && addAttendance === "attended" ? "default" : "outline"}
                    className={cn("text-xs h-8", addStatus === "completed" && addAttendance === "attended" && "bg-emerald-500 hover:bg-emerald-600")}
                    onClick={() => { setAddStatus("completed"); setAddAttendance("attended"); }}
                    data-testid="add-lesson-status-done"
                  >
                    <Check className="h-3 w-3 mr-1" /> Проведено
                  </Button>
                  <Button
                    size="sm"
                    variant={addStatus === "cancelled" ? "default" : "outline"}
                    className={cn("text-xs h-8", addStatus === "cancelled" && "bg-red-500 hover:bg-red-600")}
                    onClick={() => { setAddStatus("cancelled"); setAddAttendance("missed"); }}
                    data-testid="add-lesson-status-cancelled"
                  >
                    <X className="h-3 w-3 mr-1" /> Отменено
                  </Button>
                </div>
              </div>

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!addStudentId || addSubmitting}
                onClick={submitAddLesson}
                data-testid="add-lesson-submit"
              >
                {addSubmitting ? "Создание..." : "Добавить занятие"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
