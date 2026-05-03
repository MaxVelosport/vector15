import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { ru } from "date-fns/locale";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Info,
  LayoutGrid,
  Loader2,
  Mail,
  MoveRight,
  Pencil,
  Plus,
  Repeat,
  Star,
  Table2,
  Settings2,
  Trash2,
  User,
  Users,
  Video,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StudentCombobox } from "@/components/student-combobox";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { useStudents, useLessons, useCreateLesson, useDeleteLesson, useUpdateLesson, usePayments, type ProgramData } from "@/hooks/use-tutor-data";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";

import { useDocumentTitle } from "@/hooks/use-document-title";
function dateRuTz(d: Date, tz: string) {
  return formatInTimeZone(d, tz, "d MMMM, EEEE", { locale: ru });
}

function getHourInTz(d: Date, tz: string): number {
  const zoned = toZonedTime(d, tz);
  return zoned.getHours();
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

function generateGoogleCalendarUrl(title: string, date: Date, durationMinutes: number, description?: string) {
  const start = date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const endDate = new Date(date.getTime() + durationMinutes * 60000);
  const end = endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details: description || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(v: string): string {
  return String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsFormatUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icsFold(line: string): string {
  // RFC 5545: content lines > 75 OCTETS (bytes, not chars) must be folded
  // with CRLF + leading space. Must not split a UTF-8 multi-byte sequence.
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let remaining = line;
  let firstChunk = true;
  while (remaining.length > 0) {
    const budget = firstChunk ? 75 : 74; // continuation lines lose 1 octet to leading space
    let lo = 0;
    let hi = remaining.length;
    // Binary-search the largest prefix that fits within `budget` UTF-8 octets.
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (encoder.encode(remaining.slice(0, mid)).length <= budget) lo = mid;
      else hi = mid - 1;
    }
    const take = Math.max(1, lo); // always make progress even on degenerate input
    out.push((firstChunk ? "" : " ") + remaining.slice(0, take));
    remaining = remaining.slice(take);
    firstChunk = false;
  }
  return out.join("\r\n");
}

interface IcsLessonInput {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  topic?: string | null;
  notes?: string | null;
  status?: string | null;
  studentName?: string | null;
  subject?: string | null;
}

function generateIcsContent(lessons: IcsLessonInput[], opts?: { calendarName?: string; tutorEmail?: string }) {
  const now = new Date();
  const stamp = icsFormatUtc(now);
  const calName = opts?.calendarName || "Твой Вектор — расписание";

  const events = lessons.map((l) => {
    const startDate = l.scheduledAt instanceof Date ? l.scheduledAt : new Date(l.scheduledAt);
    const endDate = new Date(startDate.getTime() + (l.durationMinutes || 60) * 60000);
    const summary = [l.studentName || "Ученик", l.subject, l.topic].filter(Boolean).join(" · ");
    const descParts: string[] = [];
    if (l.subject) descParts.push(`Предмет: ${l.subject}`);
    if (l.topic) descParts.push(`Тема: ${l.topic}`);
    if (l.notes) descParts.push(`Заметки: ${l.notes}`);
    descParts.push("Создано в «Твой Вектор»");
    const uid = `lesson-${l.id}@tvoyvector`;
    const statusMap: Record<string, string> = {
      pending: "CONFIRMED",
      completed: "CONFIRMED",
      cancelled: "CANCELLED",
      rescheduled: "CANCELLED",
    };
    const status = statusMap[l.status || "pending"] || "CONFIRMED";

    const lines = [
      "BEGIN:VEVENT",
      icsFold(`UID:${uid}`),
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsFormatUtc(startDate)}`,
      `DTEND:${icsFormatUtc(endDate)}`,
      icsFold(`SUMMARY:${icsEscape(summary)}`),
      icsFold(`DESCRIPTION:${icsEscape(descParts.join("\n"))}`),
      `STATUS:${status}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ];
    return lines.join("\r\n");
  });

  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tvoy Vector//Schedule Export//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    icsFold(`X-WR-CALNAME:${icsEscape(calName)}`),
    "X-WR-TIMEZONE:Europe/Moscow",
  ];
  const footer = ["END:VCALENDAR"];
  return [...header, ...events, ...footer].join("\r\n") + "\r\n";
}

function downloadIcs(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SchedulePage() {
  useDocumentTitle("Расписание");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const openScheduleStudentId = new URLSearchParams(searchStr).get("openSchedule");
  const { data: studentsData, isLoading: studentsLoading } = useStudents();
  const { data: lessonsData, isLoading: lessonsLoading } = useLessons();
  const { data: paymentsData } = usePayments();
  const createLesson = useCreateLesson();
  const deleteLesson = useDeleteLesson();
  const updateLesson = useUpdateLesson();
  const [pendingLessonAction, setPendingLessonAction] = useState<{ id: string; action: "done" | "cancel" } | null>(null);

  const workStart = user?.scheduleStart ?? 8;
  const workEnd   = user?.scheduleEnd   ?? 22;
  const hourSlots = useMemo(
    () => Array.from({ length: workEnd - workStart }, (_, i) => workStart + i),
    [workStart, workEnd]
  );

  const [showWorkHoursDialog, setShowWorkHoursDialog] = useState(false);
  const [whStart, setWhStart] = useState(workStart);
  const [whEnd,   setWhEnd]   = useState(workEnd);
  const [whSaving, setWhSaving] = useState(false);

  useEffect(() => {
    if (user) { setWhStart(user.scheduleStart ?? 8); setWhEnd(user.scheduleEnd ?? 22); }
  }, [user?.scheduleStart, user?.scheduleEnd]);

  const saveWorkHours = async () => {
    if (whStart >= whEnd) { toast.error("Начало должно быть раньше конца"); return; }
    setWhSaving(true);
    try {
      await apiRequest("PATCH", "/api/profile", { scheduleStart: whStart, scheduleEnd: whEnd });
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      setShowWorkHoursDialog(false);
      toast.success("Рабочие часы сохранены");
    } catch { toast.error("Ошибка сохранения"); }
    finally { setWhSaving(false); }
  };

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
      else { toast.error(data.error || "Ошибка подключения"); }
    } catch { toast.error("Ошибка подключения"); }
    finally { setJoiningBbbId(null); }
  };

  const students = useMemo(() => studentsData ?? [], [studentsData]);
  const activeStudents = students.filter((s) => s.isActive);
  const lessons = useMemo(() => lessonsData?.map(l => ({ ...l, scheduledAt: new Date(l.scheduledAt) })) ?? [], [lessonsData]);
  const payments = useMemo(() => paymentsData ?? [], [paymentsData]);
  const uniqueTopics = useMemo(() => {
    const seen = new Set<string>();
    return lessons.map(l => l.topic).filter((t): t is string => !!t && !seen.has(t) && seen.add(t) !== undefined);
  }, [lessons]);

  const isBillableSched = (l: any) =>
    (l.status === "completed" && l.attendance === "attended") ||
    (l.status === "cancelled" && l.attendance === "missed_paid");

  const getEffectiveBalance = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const totalPaid = payments.filter(p => p.studentId === studentId).reduce((sum, p) => sum + p.amount, 0);
    const totalCost = lessons.filter(l => l.studentId === studentId && isBillableSched(l))
      .reduce((sum, l) => sum + Math.round((student?.pricePerLesson ?? 0) * (l.durationMinutes ?? 60) / 60), 0);
    return totalPaid - totalCost;
  };

  const userTimezone = user?.timezone ?? "Europe/Moscow";

  const [scheduleDayOffset, setScheduleDayOffset] = useState(0);
  const [scheduleViewMode, setScheduleViewMode] = useState<"day" | "week" | "calendar">("day");
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleStudentId, setScheduleStudentId] = useState("");
  const [scheduleHour, setScheduleHour] = useState(9);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [scheduleTopic, setScheduleTopic] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState(60);
  const [scheduleWeekDays, setScheduleWeekDays] = useState<number[]>([]);
  const [scheduleRecurrenceCount, setScheduleRecurrenceCount] = useState(8);
  const [scheduleUnlimited, setScheduleUnlimited] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [scheduleEndMode, setScheduleEndMode] = useState<"count" | "until" | "year">("count");
  const [scheduleEndDate, setScheduleEndDate] = useState(format(addDays(new Date(), 90), "yyyy-MM-dd"));

  const handledOpenScheduleRef = useRef<string | null>(null);
  useEffect(() => {
    if (openScheduleStudentId && students.length > 0 && handledOpenScheduleRef.current !== openScheduleStudentId) {
      handledOpenScheduleRef.current = openScheduleStudentId;
      setScheduleStudentId(openScheduleStudentId);
      setScheduleTopic("");
      setScheduleWeekDays([]);
      setScheduleUnlimited(false);
      setScheduleStartDate(format(new Date(), "yyyy-MM-dd"));
      setShowScheduleDialog(true);
      setLocation("/schedule", { replace: true });
    }
  }, [openScheduleStudentId, students]);

  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkRows, setBulkRows] = useState<Array<{studentId: string; days: number[]; hour: number; duration: number; topic: string; mode: "once" | "repeat"; repeatWeeks: number}>>([
    { studentId: "", days: [1], hour: 16, duration: 60, topic: "", mode: "repeat", repeatWeeks: 52 },
  ]);

  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleLesson, setRescheduleLesson] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleHour, setRescheduleHour] = useState(9);
  const [rescheduleMinute, setRescheduleMinute] = useState(0);

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicValue, setEditingTopicValue] = useState("");

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editPanelTopicValue, setEditPanelTopicValue] = useState("");
  const [editPanelRating, setEditPanelRating] = useState<number | null>(null);
  const [editPanelNotesValue, setEditPanelNotesValue] = useState("");
  const [editPanelRescheduleDate, setEditPanelRescheduleDate] = useState("");
  const [editPanelRescheduleTime, setEditPanelRescheduleTime] = useState("");
  const [deletingScheduleLessonId, setDeletingScheduleLessonId] = useState<string | null>(null);

  useEffect(() => {
    if (editingLessonId) {
      const lesson = lessons.find(l => l.id === editingLessonId);
      if (lesson) {
        setEditPanelTopicValue(lesson.topic || "");
        setEditPanelRating((lesson as any).rating ?? null);
        setEditPanelNotesValue((lesson as any).notes || "");
        setEditPanelRescheduleDate(format(lesson.scheduledAt, "yyyy-MM-dd"));
        setEditPanelRescheduleTime(format(lesson.scheduledAt, "HH:mm"));
      }
    }
  }, [editingLessonId, lessons]);

  const applyScheduleUpdate = useCallback((lessonId: string, updates: any) => {
    updateLesson.mutate({ id: lessonId, updates }, {
      onSuccess: (data: any) => {
        if (updates.attendance === "attended" && data?.attendance === "attended_unpaid") {
          toast("Проведено ✗ — баланс недостаточен", { icon: "⚠️" });
        } else {
          toast.success("Обновлено");
        }
      },
      onError: () => toast.error("Ошибка"),
    });
  }, [updateLesson]);

  const handleEditPanelReschedule = useCallback((lessonId: string) => {
    if (!editPanelRescheduleDate || !editPanelRescheduleTime) return;
    const [h, m] = editPanelRescheduleTime.split(":").map(Number);
    const newDate = new Date(editPanelRescheduleDate + "T00:00:00");
    newDate.setHours(h, m, 0, 0);
    updateLesson.mutate({ id: lessonId, updates: { scheduledAt: newDate } }, {
      onSuccess: () => { toast.success("Перенесено"); setEditingLessonId(null); },
      onError: () => toast.error("Ошибка"),
    });
  }, [editPanelRescheduleDate, editPanelRescheduleTime, updateLesson]);

  const navigateDay = (fn: (v: number) => number) => {
    setScheduleDayOffset(fn);
    setEditingTopicId(null);
  };

  const now = new Date();
  const scheduleDate = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), scheduleDayOffset);
  const scheduleLessonsForDay = lessons.filter((l) => {
    const ld = new Date(l.scheduledAt);
    return ld.getFullYear() === scheduleDate.getFullYear() && ld.getMonth() === scheduleDate.getMonth() && ld.getDate() === scheduleDate.getDate();
  });

  const weekStart = startOfWeek(scheduleDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(scheduleDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weekStats = useMemo(() => {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    const weekLessons = lessons.filter(l => l.scheduledAt >= start && l.scheduledAt <= end);
    return {
      total: weekLessons.length,
      completed: weekLessons.filter(l => l.status === "completed").length,
      pending: weekLessons.filter(l => l.status === "pending").length,
    };
  }, [lessons, now]);

  const rescheduleConflictMap = useMemo(() => {
    if (!rescheduleDate || !rescheduleLesson) return {} as Record<string, { studentName: string }>;
    const dateObj = new Date(rescheduleDate + "T00:00:00");
    const map: Record<string, { studentName: string }> = {};
    for (let h = 8; h <= 20; h++) {
      for (const m of [0, 30]) {
        const slotStart = new Date(dateObj);
        slotStart.setHours(h, m, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60000);
        const conflict = lessons.find(l => {
          if (l.status === "cancelled") return false;
          if (l.id === rescheduleLesson.id) return false;
          const lStart = new Date(l.scheduledAt);
          const lEnd = new Date(lStart.getTime() + (l.durationMinutes || 60) * 60000);
          return isSameDay(lStart, dateObj) && lStart < slotEnd && slotStart < lEnd;
        });
        if (conflict) {
          const student = students.find(s => s.id === conflict.studentId);
          map[`${h}:${m}`] = { studentName: student?.name || "Ученик" };
        }
      }
    }
    return map;
  }, [rescheduleDate, rescheduleLesson, lessons, students]);

  const checkConflict = useCallback((date: Date, hour: number, minute: number, durationMin: number) => {
    const newStart = new Date(date);
    newStart.setHours(hour, minute, 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMin * 60000);
    return lessons.find((l) => {
      if (l.status === "cancelled") return false;
      const lStart = new Date(l.scheduledAt);
      const lEnd = new Date(lStart.getTime() + (l.durationMinutes || 60) * 60000);
      return isSameDay(lStart, date) && lStart < newEnd && newStart < lEnd;
    });
  }, [lessons]);

  const singleConflict = useMemo(() => {
    if (scheduleWeekDays.length > 0) return null;
    return checkConflict(scheduleDate, scheduleHour, scheduleMinute, scheduleDuration);
  }, [scheduleDate, scheduleHour, scheduleMinute, scheduleDuration, scheduleWeekDays, checkConflict]);

  const recurringConflicts = useMemo(() => {
    if (scheduleWeekDays.length === 0) return [];
    const startDate = new Date(scheduleStartDate);
    const result: Array<{ date: Date; student: string; dayLabel: string }> = [];
    const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

    for (const dayOfWeek of scheduleWeekDays) {
      let candidate = new Date(startDate);
      for (let i = 0; i < 7; i++) {
        if (candidate.getDay() === dayOfWeek) break;
        candidate = addDays(candidate, 1);
      }
      const conflict = checkConflict(candidate, scheduleHour, scheduleMinute, scheduleDuration);
      if (conflict) {
        const st = students.find(s => s.id === conflict.studentId);
        result.push({ date: candidate, student: st?.name || "Ученик", dayLabel: dayNames[dayOfWeek] });
      }
    }
    return result;
  }, [scheduleWeekDays, scheduleStartDate, scheduleHour, scheduleMinute, scheduleDuration, checkConflict, students]);

  const getTopicsForLessons = (student: any, count: number, baseTopic: string): string[] => {
    const program = student?.programData as ProgramData | undefined;
    if (program?.topics?.length) {
      const unfinished = program.topics.filter(t => !t.completed && t.title?.trim());
      if (unfinished.length > 0) {
        const result: string[] = [];
        let topicIdx = 0;
        let lessonsLeft = 0;
        for (let i = 0; i < count; i++) {
          if (lessonsLeft <= 0 && topicIdx < unfinished.length) {
            lessonsLeft = Math.max(1, unfinished[topicIdx].lessonsNeeded || 1);
          }
          if (topicIdx < unfinished.length) {
            result.push(unfinished[topicIdx].title);
            lessonsLeft--;
            if (lessonsLeft <= 0) topicIdx++;
          } else {
            result.push(baseTopic);
          }
        }
        return result;
      }
    }
    return Array(count).fill(baseTopic);
  };

  // Parse a "YYYY-MM-DD" string as a local-timezone date (midnight local)
  // to avoid UTC parsing shifting the weekday in non-UTC locales.
  const parseLocalDate = (s: string): Date => {
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return new Date(NaN);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  };

  // Compute all dates for a recurring series (shared preview + creation logic)
  const computeRecurringDates = (): Date[] => {
    if (scheduleWeekDays.length === 0) return [];
    const startDate = parseLocalDate(scheduleStartDate);
    if (isNaN(startDate.getTime())) return [];
    const dates: Date[] = [];
    const HARD_CAP = 500;

    const pushIfMatch = (cur: Date) => {
      if (scheduleWeekDays.includes(cur.getDay())) {
        const d = new Date(cur);
        d.setHours(scheduleHour, scheduleMinute, 0, 0);
        dates.push(d);
      }
    };

    if (scheduleEndMode === "until") {
      const endDate = parseLocalDate(scheduleEndDate);
      if (isNaN(endDate.getTime()) || endDate < startDate) return [];
      endDate.setHours(23, 59, 59, 999);
      let cur = new Date(startDate);
      while (cur <= endDate && dates.length < HARD_CAP) {
        pushIfMatch(cur);
        cur = addDays(cur, 1);
      }
    } else if (scheduleEndMode === "year") {
      let cur = new Date(startDate);
      const limit = addDays(startDate, 365);
      while (cur <= limit && dates.length < HARD_CAP) {
        pushIfMatch(cur);
        cur = addDays(cur, 1);
      }
    } else {
      // count mode — iterate until we hit the target (or hard cap)
      const target = Math.min(Math.max(1, scheduleRecurrenceCount || 1), HARD_CAP);
      let cur = new Date(startDate);
      let daysWalked = 0;
      const MAX_DAYS = 7 * HARD_CAP + 14; // enough to reach HARD_CAP occurrences even with 1 weekday/week
      while (dates.length < target && daysWalked < MAX_DAYS) {
        pushIfMatch(cur);
        cur = addDays(cur, 1);
        daysWalked++;
      }
    }
    return dates;
  };

  const recurringPreview = useMemo(() => computeRecurringDates(), [scheduleWeekDays, scheduleStartDate, scheduleEndMode, scheduleEndDate, scheduleRecurrenceCount, scheduleHour, scheduleMinute]);

  // Find future lessons that form a "series" with the given lesson
  // (same student, same weekday, same HH:MM, same duration, date >= today)
  const findSeriesLessons = (lessonId: string) => {
    const target = lessons.find(l => l.id === lessonId);
    if (!target) return [] as typeof lessons;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const tDate = new Date(target.scheduledAt);
    return lessons.filter(l => {
      if (l.id === lessonId) return false;
      const d = new Date(l.scheduledAt);
      return (
        l.studentId === target.studentId &&
        d >= now &&
        d.getDay() === tDate.getDay() &&
        d.getHours() === tDate.getHours() &&
        d.getMinutes() === tDate.getMinutes() &&
        l.durationMinutes === target.durationMinutes &&
        l.status === "pending"
      );
    });
  };

  const handleAddLesson = async () => {
    if (!scheduleStudentId) {
      toast.error("Выберите ученика");
      return;
    }

    const student = students.find((s) => s.id === scheduleStudentId);
    const baseTopic = scheduleTopic || student?.curriculumTopic || "Занятие";

    if (scheduleWeekDays.length > 0) {
      const createdDates = computeRecurringDates();
      if (createdDates.length === 0) {
        toast.error("Не удалось вычислить даты — проверьте период");
        return;
      }
      const topics = scheduleTopic ? Array(createdDates.length).fill(scheduleTopic) : getTopicsForLessons(student, createdDates.length, baseTopic);

      for (let i = 0; i < createdDates.length; i++) {
        await createLesson.mutateAsync({
          studentId: scheduleStudentId,
          scheduledAt: createdDates[i],
          durationMinutes: scheduleDuration,
          topic: topics[i],
        });
      }
      toast.success(`Создано ${createdDates.length} занятий`);
    } else {
      const lessonDate = new Date(scheduleDate);
      lessonDate.setHours(scheduleHour, scheduleMinute, 0, 0);
      const topics = scheduleTopic ? [scheduleTopic] : getTopicsForLessons(student, 1, baseTopic);
      await createLesson.mutateAsync({
        studentId: scheduleStudentId,
        scheduledAt: lessonDate,
        durationMinutes: scheduleDuration,
        topic: topics[0],
      });
      toast.success("Занятие добавлено");
    }
    setShowScheduleDialog(false);
    setScheduleWeekDays([]);
  };

  const handleBulkAdd = async () => {
    const validRows = bulkRows.filter(r => r.studentId && r.days.length > 0);
    if (validRows.length === 0) {
      toast.error("Добавьте хотя бы одну строку с учеником и днями");
      return;
    }
    let created = 0;
    const startDate = new Date(scheduleStartDate);
    for (const row of validRows) {
      const student = students.find(s => s.id === row.studentId);
      const baseTopic = row.topic || student?.curriculumTopic || "Занятие";
      const dates: Date[] = [];

      if (row.mode === "once") {
        for (const dayOfWeek of row.days) {
          let currentDate = new Date(startDate);
          for (let attempt = 0; attempt < 7; attempt++) {
            if (currentDate.getDay() === dayOfWeek) {
              const lessonDate = new Date(currentDate);
              lessonDate.setHours(row.hour, 0, 0, 0);
              dates.push(lessonDate);
              break;
            }
            currentDate = addDays(currentDate, 1);
          }
        }
      } else {
        let currentDate = new Date(startDate);
        const maxDays = row.repeatWeeks * 7;
        while (currentDate <= addDays(startDate, maxDays)) {
          if (row.days.includes(currentDate.getDay())) {
            const lessonDate = new Date(currentDate);
            lessonDate.setHours(row.hour, 0, 0, 0);
            dates.push(lessonDate);
          }
          currentDate = addDays(currentDate, 1);
        }
      }

      const topics = row.topic ? Array(dates.length).fill(row.topic) : getTopicsForLessons(student, dates.length, baseTopic);
      for (let i = 0; i < dates.length; i++) {
        await createLesson.mutateAsync({
          studentId: row.studentId,
          scheduledAt: dates[i],
          durationMinutes: row.duration,
          topic: topics[i],
        });
      }
      created += dates.length;
    }
    toast.success(`Создано ${created} занятий для ${validRows.length} учеников`);
    setShowBulkDialog(false);
    setBulkRows([{ studentId: "", days: [1], hour: 16, duration: 60, topic: "", mode: "repeat", repeatWeeks: 52 }]);
  };

  const handleReschedule = async () => {
    if (!rescheduleLesson) return;
    const newDate = new Date(rescheduleDate);
    newDate.setHours(rescheduleHour, rescheduleMinute, 0, 0);
    await updateLesson.mutateAsync({
      id: rescheduleLesson.id,
      updates: { scheduledAt: newDate, status: "rescheduled" },
    });
    toast.success("Занятие перенесено");
    setShowRescheduleDialog(false);
  };

  const isLoading = studentsLoading || lessonsLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Расписание" subtitle="Загрузка...">
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-muted-foreground">Загрузка...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="📅 Расписание"
      subtitle="Планирование занятий и управление календарём"
      tabs={
        <div className="flex rounded-lg border border-border/60 overflow-hidden">
          <Button variant="ghost" size="sm" className="h-8 rounded-none text-xs gap-1.5 px-3 border-r border-border/60" onClick={() => setLocation("/lessons")} data-testid="tab-to-lessons">
            <CalendarDays className="h-3.5 w-3.5" /> Занятия
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-none text-xs gap-1.5 px-3 bg-primary/10 text-primary" data-testid="tab-schedule-active">
            <Calendar className="h-3.5 w-3.5" /> Расписание
          </Button>
        </div>
      }
      actions={
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden sm:flex" onClick={() => { setBulkRows([{ studentId: "", days: [1], hour: 16, duration: 60, topic: "", mode: "repeat", repeatWeeks: 52 }]); setScheduleStartDate(format(new Date(), "yyyy-MM-dd")); setShowBulkDialog(true); }}>
            <Table2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Массовое</span>
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs shadow-lg" data-testid="button-schedule-add" onClick={() => { setScheduleStudentId(activeStudents[0]?.id || ""); setScheduleTopic(""); setScheduleWeekDays([]); setScheduleUnlimited(false); setShowScheduleDialog(true); }}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Добавить</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <PageHero
          icon={<Calendar className="h-6 w-6 text-white" />}
          gradient="from-emerald-600/80 via-teal-600/70 to-cyan-600/60"
          title="Расписание занятий"
          subtitle="Визуальный календарь с видами «день», «неделя» и «месяц». Нажмите «Добавить занятие», кликните на урок для отметки или переноса."
          badge="Календарь"
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><Calendar className="h-10 w-10 text-blue-600 rotate-6" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{weekStats.total}</div>
                    <div className="text-xs text-muted-foreground">На этой неделе</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><CalendarCheck className="h-10 w-10 text-emerald-600 -rotate-6" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                    <CalendarCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{weekStats.completed}</div>
                    <div className="text-xs text-muted-foreground">Проведено</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-amber-500/10 to-orange-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><Clock className="h-10 w-10 text-amber-600 rotate-12" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{weekStats.pending}</div>
                    <div className="text-xs text-muted-foreground">Ожидают</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><Users className="h-10 w-10 text-indigo-600 -rotate-12" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{activeStudents.length}</div>
                    <div className="text-xs text-muted-foreground">Учеников</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <Button variant={scheduleViewMode === "day" ? "default" : "outline"} size="sm" data-testid="button-view-day" onClick={() => setScheduleViewMode("day")}>День</Button>
                <Button variant={scheduleViewMode === "week" ? "default" : "outline"} size="sm" onClick={() => setScheduleViewMode("week")}>Неделя</Button>
                <Button variant={scheduleViewMode === "calendar" ? "default" : "outline"} size="sm" data-testid="button-view-calendar" onClick={() => setScheduleViewMode("calendar")}>Месяц</Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  data-testid="button-export-ics"
                  title="Скачать .ics для Google Calendar / Apple Calendar / Outlook"
                  onClick={() => {
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - 30);
                    const exportable = lessons.filter((l) => new Date(l.scheduledAt) >= cutoff);
                    if (exportable.length === 0) {
                      toast.message("Нет занятий для экспорта");
                      return;
                    }
                    const items: IcsLessonInput[] = exportable.map((l) => ({
                      id: l.id,
                      scheduledAt: new Date(l.scheduledAt),
                      durationMinutes: l.durationMinutes || 60,
                      topic: l.topic,
                      notes: (l as any).notes,
                      status: l.status,
                      subject: (l as any).subject,
                      studentName: students.find((s) => s.id === l.studentId)?.name,
                    }));
                    const icsContent = generateIcsContent(items, {
                      calendarName: "Твой Вектор — расписание",
                    });
                    const today = new Date().toISOString().slice(0, 10);
                    downloadIcs(icsContent, `tvoy-vector-schedule-${today}.ics`);
                    toast.success(`Готово: ${items.length} занятий`, {
                      description:
                        "Откройте Google Calendar → Настройки → Импорт и экспорт → выберите файл.",
                      duration: 8000,
                    });
                  }}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Экспорт в календарь (.ics)</span>
                  <span className="sm:hidden">Экспорт .ics</span>
                </Button>
              </div>
            </div>

            {scheduleViewMode === "calendar" ? (
              <div>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex flex-col items-center min-w-[160px]">
                    <span className="text-sm font-semibold capitalize">{format(calendarMonth, "LLLL yyyy", { locale: ru })}</span>
                    {calendarMonth.getMonth() === now.getMonth() && calendarMonth.getFullYear() === now.getFullYear() ? (
                      <span className="text-[11px] text-primary font-medium">текущий месяц</span>
                    ) : (
                      <button className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => setCalendarMonth(new Date())}>
                        ↩ к текущему месяцу
                      </button>
                    )}
                  </div>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (<div key={d} className="py-2">{d}</div>))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const year = calendarMonth.getFullYear();
                    const month = calendarMonth.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const startPad = (firstDay.getDay() + 6) % 7;
                    const days: React.ReactNode[] = [];
                    
                    for (let i = 0; i < startPad; i++) {
                      days.push(<div key={`pad-${i}`} className="h-10 md:h-16" />);
                    }
                    
                    for (let d = 1; d <= lastDay.getDate(); d++) {
                      const date = new Date(year, month, d);
                      const dayLessons = lessons.filter((l) => {
                        const ld = new Date(l.scheduledAt);
                        return ld.getFullYear() === year && ld.getMonth() === month && ld.getDate() === d;
                      }).sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
                      const isToday = date.toDateString() === new Date().toDateString();
                      
                      days.push(
                        <motion.div
                          key={d}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: d * 0.01 }}
                          className={cn(
                            "h-10 md:h-16 rounded-xl border p-1 md:p-2 cursor-pointer transition-all group hover:shadow-md",
                            isToday ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border/50 hover:border-primary/30",
                            dayLessons.length > 0 && "bg-blue-500/5"
                          )}
                          onClick={() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            setScheduleDayOffset(diff);
                            setScheduleViewMode("day");
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className={cn("text-xs md:text-sm font-medium", isToday && "text-primary")}>{d}</div>
                            <button
                              className="hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                setScheduleDayOffset(diff);
                                setScheduleStartDate(format(date, "yyyy-MM-dd"));
                                setScheduleTopic("");
                                setScheduleWeekDays([]);
                                setScheduleUnlimited(false);
                                setShowScheduleDialog(true);
                              }}
                            >
                              +
                            </button>
                          </div>
                          {dayLessons.length > 0 && (
                            <div className="flex gap-0.5 mt-1 flex-wrap">
                              {dayLessons.slice(0, 4).map((l, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    l.status === "completed" && l.attendance === "attended_unpaid" ? "bg-orange-500" :
                                    l.status === "completed" ? "bg-emerald-500" :
                                    l.status === "cancelled" ? "bg-red-500" :
                                    l.status === "rescheduled" ? "bg-sky-500" : "bg-amber-500"
                                  )}
                                />
                              ))}
                              {dayLessons.length > 4 && (
                                <span className="text-[9px] text-muted-foreground ml-0.5">+{dayLessons.length - 4}</span>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    }
                    return days;
                  })()}
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Ожидается</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Проведено ✓</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> Проведено ✗ (долг)</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Отменено</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-sky-500" /> Перенесено</div>
                </div>
              </div>
            ) : scheduleViewMode === "week" ? (
              <div>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScheduleDayOffset((v) => v - 7)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex flex-col items-center min-w-[180px]">
                    <span className="text-sm font-semibold">
                      {format(weekStart, "d MMM", { locale: ru })} — {format(weekEnd, "d MMM", { locale: ru })}
                    </span>
                    {weekDays.some(d => d.toDateString() === now.toDateString()) ? (
                      <span className="text-[11px] text-primary font-medium">текущая неделя</span>
                    ) : (
                      <button className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => { setScheduleDayOffset(0); }}>
                        ↩ к текущей неделе
                      </button>
                    )}
                  </div>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScheduleDayOffset((v) => v + 7)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="md:hidden text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                  <span>← листайте →</span>
                </div>
                <div className="overflow-x-auto -mx-1 px-1 pb-2 [scrollbar-width:thin]">
                <div className="grid grid-cols-7 gap-2 min-w-[560px]">
                  {weekDays.map((day, idx) => {
                    const dayLessons = lessons.filter(l => {
                      const ld = new Date(l.scheduledAt);
                      return ld.toDateString() === day.toDateString();
                    }).sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
                    const isToday = day.toDateString() === now.toDateString();
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={cn(
                          "rounded-xl border p-3 min-h-[200px]",
                          isToday ? "border-primary bg-primary/5" : "border-border/50"
                        )}
                      >
                        <div className={cn("text-center mb-2", isToday && "text-primary")}>
                          <div className="text-xs text-muted-foreground">{format(day, "EEE", { locale: ru })}</div>
                          <div className="text-lg font-semibold">{format(day, "d")}</div>
                        </div>
                        <div className="space-y-1">
                          {dayLessons.map((l) => {
                            const student = students.find(s => s.id === l.studentId);
                            const tLinks = (student as any)?.links;
                            return (
                              <div
                                key={l.id}
                                className={cn(
                                  "w-full rounded-lg p-2 text-xs text-left transition-all hover:ring-1 hover:ring-primary/30 cursor-pointer relative group/week-lesson",
                                  l.status === "completed" && l.attendance === "attended_unpaid" ? "bg-orange-500/10 hover:bg-orange-500/15" :
                                  l.status === "completed" ? "bg-emerald-500/10 hover:bg-emerald-500/15" :
                                  l.status === "cancelled" ? "bg-red-500/10 hover:bg-red-500/15" :
                                  "bg-blue-500/10 hover:bg-blue-500/15"
                                )}
                                onClick={() => {
                                  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                  const lessonDate = new Date(l.scheduledAt.getFullYear(), l.scheduledAt.getMonth(), l.scheduledAt.getDate());
                                  const diffDays = Math.round((lessonDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                                  setScheduleDayOffset(diffDays);
                                  setScheduleViewMode("day");
                                }}
                              >
                                <div className="font-medium truncate">{student?.name}</div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <span>{format(l.scheduledAt, "HH:mm")}</span>
                                  {/* Внутренняя доска — всегда */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span onClick={(e) => { e.stopPropagation(); setLocation(`/board/${l.studentId}`); }}>
                                        <LayoutGrid className="h-2.5 w-2.5 text-violet-500 cursor-pointer hover:text-violet-700" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p>Доска (внутр.)</p></TooltipContent>
                                  </Tooltip>
                                  {/* Внутренняя конференция BBB — всегда */}
                                  {(() => {
                                    const bbbConf = bbbConferences.find(c => c.studentId === l.studentId);
                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span onClick={(e) => { e.stopPropagation(); if (bbbConf) handleJoinBbb(bbbConf.id); }}
                                            className={bbbConf ? "cursor-pointer" : "cursor-default opacity-30"}>
                                            <Video className={cn("h-2.5 w-2.5", bbbConf?.isRunning ? "text-green-500 hover:text-green-700" : bbbConf ? "text-blue-600 hover:text-blue-800" : "text-muted-foreground")} />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p>{bbbConf ? (bbbConf.isRunning ? "Конференция идёт — BBB" : "Конференция BBB (внутр.)") : "Конференция BBB (не настроена)"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })()}
                                  {/* Внешняя конференция — если есть */}
                                  {tLinks?.conference && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span onClick={(e) => { e.stopPropagation(); const link = tLinks.conference; window.open(link.startsWith("http") ? link : `https://${link}`, "_blank"); }}>
                                          <Video className="h-2.5 w-2.5 text-blue-400 cursor-pointer hover:text-blue-600" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top"><p>Конференция (внешн.)</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                  {/* Внешняя доска — если есть */}
                                  {tLinks?.board && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span onClick={(e) => { e.stopPropagation(); const link = tLinks.board; window.open(link.startsWith("http") ? link : `https://${link}`, "_blank"); }}>
                                          <Pencil className="h-2.5 w-2.5 text-violet-400 cursor-pointer hover:text-violet-600" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top"><p>Доска (внешн.)</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDay((v) => v - 1)} data-testid="button-prev-day">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex flex-col items-center min-w-[160px]">
                      <span className="text-sm font-semibold">{dateRuTz(scheduleDate, userTimezone)}</span>
                      {scheduleDayOffset === 0 ? (
                        <span className="text-[11px] text-primary font-medium">сегодня</span>
                      ) : (
                        <button className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => { setScheduleDayOffset(0); setEditingTopicId(null); }}>
                          ↩ вернуться к сегодня
                        </button>
                      )}
                    </div>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDay((v) => v + 1)} data-testid="button-next-day">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    className="gap-1.5 h-8 text-xs text-muted-foreground"
                    onClick={() => setShowWorkHoursDialog(true)}
                    data-testid="button-work-hours"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {String(workStart).padStart(2,"0")}:00–{String(workEnd).padStart(2,"0")}:00
                  </Button>
                </div>

                <div className="space-y-2">
                  {hourSlots.map((h) => {
                    const booked = scheduleLessonsForDay.find((l) => getHourInTz(l.scheduledAt, userTimezone) === h);
                    const overlapping = !booked ? scheduleLessonsForDay.find((l) => {
                      const startH = getHourInTz(l.scheduledAt, userTimezone);
                      const endH = startH + (l.durationMinutes || 60) / 60;
                      return h > startH && h < endH;
                    }) : null;
                    const st = booked ? students.find((s) => s.id === booked.studentId) : null;
                    const overlapSt = overlapping ? students.find((s) => s.id === overlapping.studentId) : null;

                    if (overlapping) {
                      return (
                        <motion.div
                          key={h}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: (h - 9) * 0.03 }}
                          className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-4 opacity-60"
                        >
                          <div className="flex h-12 w-16 items-center justify-center rounded-xl text-sm font-semibold bg-primary/10 text-primary">
                            {String(overlapping.scheduledAt.getHours()).padStart(2, "0")}:{String(overlapping.scheduledAt.getMinutes()).padStart(2, "0")}
                          </div>
                          <div className="flex-1 flex items-center gap-3">
                            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-white text-xs font-semibold", getAvatarColor(overlapSt?.name || ""))}>
                              {getInitials(overlapSt?.name || "?")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ← продолжение: {overlapSt?.name} ({overlapping.durationMinutes} мин)
                            </div>
                          </div>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div
                        key={h}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (h - 9) * 0.03 }}
                        className={cn(
                          "rounded-2xl border p-3 sm:p-4 transition-all",
                          booked && booked.status !== "cancelled"
                            ? "border-primary/30 bg-gradient-to-r from-primary/5 to-transparent" 
                            : "border-border/50 bg-card/50 hover:bg-accent/30",
                        )}
                      >
                        <div className="flex items-center gap-2 sm:gap-4">
                        <div
                          className={cn(
                            "flex h-11 w-12 sm:h-12 sm:w-16 items-center justify-center rounded-xl text-xs sm:text-sm font-semibold shrink-0",
                            booked && booked.status !== "cancelled" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {booked
                            ? `${String(booked.scheduledAt.getHours()).padStart(2, "0")}:${String(booked.scheduledAt.getMinutes()).padStart(2, "0")}`
                            : `${String(h).padStart(2, "0")}:00`}
                        </div>

                        {booked && booked.status !== "cancelled" ? (
                          <div className="flex-1 flex items-center gap-2 sm:gap-4 min-w-0">
                            <button
                              className={cn("flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white text-xs font-semibold shadow-md transition-opacity hover:opacity-80", getAvatarColor(st?.name || ""))}
                              title="Нажмите, чтобы изменить тему"
                              onClick={() => { if (booked.status === "pending") { setEditingTopicId(booked.id); setEditingTopicValue(booked.topic || ""); } }}
                            >
                              {getInitials(st?.name || "?")}
                            </button>
                            <div className="flex-1 min-w-0">
                              <button
                                className="font-medium hover:text-primary transition-colors text-left underline-offset-2 hover:underline"
                                title="Открыть профиль ученика"
                                onClick={() => setLocation(`/students?open=${booked.studentId}`)}
                              >{st?.name}</button>
                              {editingTopicId === booked.id ? (
                                <div className="mt-0.5 space-y-1">
                                  {(() => {
                                    const programTopics = (st as any)?.programData?.topics as any[] | undefined;
                                    return programTopics && programTopics.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {programTopics.filter((t: any) => !t.completed).map((t: any, ti: number) => (
                                          <button
                                            key={ti}
                                            className={cn(
                                              "px-2 py-0.5 text-[11px] rounded-full border transition-colors",
                                              editingTopicValue === t.title
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-muted/50 border-border/50 hover:bg-primary/10 hover:border-primary/30"
                                            )}
                                            onClick={() => setEditingTopicValue(t.title)}
                                          >
                                            {t.title}
                                          </button>
                                        ))}
                                      </div>
                                    ) : null;
                                  })()}
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={editingTopicValue}
                                      onChange={(e) => setEditingTopicValue(e.target.value)}
                                      className="h-6 text-xs px-1.5 py-0"
                                      placeholder="Тема занятия"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          updateLesson.mutate({ id: booked.id, updates: { topic: editingTopicValue } }, {
                                            onSuccess: () => { toast.success("Тема обновлена"); setEditingTopicId(null); },
                                            onError: () => toast.error("Ошибка"),
                                          });
                                        }
                                        if (e.key === "Escape") setEditingTopicId(null);
                                      }}
                                    />
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => {
                                      updateLesson.mutate({ id: booked.id, updates: { topic: editingTopicValue } }, {
                                        onSuccess: () => { toast.success("Тема обновлена"); setEditingTopicId(null); },
                                        onError: () => toast.error("Ошибка"),
                                      });
                                    }}>
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingTopicId(null)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground flex items-center gap-1 group/topic">
                                  <span>{booked.topic || "Без темы"}</span>
                                  <span>• {booked.durationMinutes} мин</span>
                                  {(booked as any).notes && (
                                    <span title={(booked as any).notes} className="text-amber-500 cursor-help">📝</span>
                                  )}
                                  {booked.status === "pending" && (
                                    <button
                                      className="opacity-0 group-hover/topic:opacity-100 transition-opacity"
                                      onClick={() => { setEditingTopicId(booked.id); setEditingTopicValue(booked.topic || ""); }}
                                    >
                                      <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {booked.status === "pending" ? (
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={pendingLessonAction?.id === booked.id}
                                      className={cn(
                                        "h-7 gap-1 text-xs border transition-all duration-150 active:scale-95",
                                        pendingLessonAction?.id === booked.id && pendingLessonAction?.action === "done"
                                          ? "bg-emerald-500 text-white border-emerald-500 scale-95 opacity-90"
                                          : "bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20 hover:scale-[1.03]"
                                      )}
                                      onClick={() => {
                                        setPendingLessonAction({ id: booked.id, action: "done" });
                                        updateLesson.mutate(
                                          { id: booked.id, updates: { status: "completed", attendance: "attended" } },
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
                                      data-testid={`button-schedule-done-${booked.id}`}
                                    >
                                      {pendingLessonAction?.id === booked.id && pendingLessonAction?.action === "done"
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <Check className="h-3 w-3" />
                                      }
                                      Проведено
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={pendingLessonAction?.id === booked.id}
                                      className={cn(
                                        "h-7 gap-1 text-xs border transition-all duration-150 active:scale-95",
                                        pendingLessonAction?.id === booked.id && pendingLessonAction?.action === "cancel"
                                          ? "bg-red-500 text-white border-red-500 scale-95 opacity-90"
                                          : "bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20 hover:scale-[1.03]"
                                      )}
                                      onClick={() => {
                                        setPendingLessonAction({ id: booked.id, action: "cancel" });
                                        updateLesson.mutate(
                                          { id: booked.id, updates: { status: "cancelled" } },
                                          {
                                            onSuccess: () => { toast.success("Отменено"); setPendingLessonAction(null); },
                                            onError: () => { toast.error("Ошибка"); setPendingLessonAction(null); }
                                          }
                                        );
                                      }}
                                      data-testid={`button-schedule-cancel-${booked.id}`}
                                    >
                                      {pendingLessonAction?.id === booked.id && pendingLessonAction?.action === "cancel"
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <X className="h-3 w-3" />
                                      }
                                      Отменено
                                    </Button>
                                  </div>
                                  {/* Balance display */}
                                  <div className="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5">
                                    <span className="text-[10px] text-muted-foreground">Баланс:</span>
                                    <span className={cn("text-[10px] font-bold tabular-nums",
                                      st ? getEffectiveBalance(st.id) > 0 ? "text-emerald-600" :
                                      getEffectiveBalance(st.id) < 0 ? "text-red-600" :
                                      "text-muted-foreground" : "text-muted-foreground"
                                    )}>
                                      {st ? (getEffectiveBalance(st.id) > 0 ? "+" : "") + getEffectiveBalance(st.id).toLocaleString("ru") : "0"} ₽
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "cursor-pointer transition-colors",
                                    booked.status === "completed" && booked.attendance === "attended_unpaid"
                                      ? "bg-orange-500/10 text-orange-600 hover:bg-amber-500/10 hover:text-amber-600"
                                      : booked.status === "completed"
                                      ? "bg-emerald-500/10 text-emerald-600 hover:bg-amber-500/10 hover:text-amber-600"
                                      : "bg-red-500/10 text-red-600 hover:bg-amber-500/10 hover:text-amber-600"
                                  )}
                                  title="Нажмите, чтобы изменить статус"
                                  onClick={() => updateLesson.mutate(
                                    { id: booked.id, updates: { status: "pending" } },
                                    { onSuccess: () => toast.success("Статус сброшен"), onError: () => toast.error("Ошибка") }
                                  )}
                                >
                                  {booked.status === "completed" && booked.attendance === "attended_unpaid"
                                    ? "✗ Проведено (долг)"
                                    : booked.status === "completed"
                                    ? "✓ Проведено"
                                    : "✕ Отменено"}
                                </Badge>
                              )}
                              {/* Внутренняя доска — всегда */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-violet-500 hover:text-violet-700 hover:bg-violet-500/10"
                                    onClick={() => setLocation(`/board/${booked.studentId}`)}>
                                    <LayoutGrid className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Доска (внутр.)</p></TooltipContent>
                              </Tooltip>
                              {/* Внутренняя конференция BBB — всегда */}
                              {(() => {
                                const bbbConf = bbbConferences.find(c => c.studentId === booked.studentId);
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="icon" variant="ghost"
                                        className={cn("h-8 w-8",
                                          bbbConf
                                            ? bbbConf.isRunning
                                              ? "text-green-500 hover:text-green-700 hover:bg-green-500/10"
                                              : "text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                                            : "text-muted-foreground/25 cursor-default"
                                        )}
                                        onClick={() => { if (bbbConf) handleJoinBbb(bbbConf.id); }}
                                        disabled={!bbbConf || joiningBbbId === bbbConf?.id}>
                                        {bbbConf && joiningBbbId === bbbConf.id
                                          ? <span className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
                                          : <Video className="h-4 w-4" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>{bbbConf ? (bbbConf.isRunning ? "Конференция идёт — войти в BBB" : "Конференция BBB (внутр.)") : "Конференция BBB (не настроена)"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })()}
                              {/* Внешняя конференция — если есть */}
                              {(st as any)?.links?.conference && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400/60 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                      onClick={() => { const l = (st as any).links.conference; window.open(l.startsWith("http") ? l : `https://${l}`, "_blank"); }}>
                                      <Video className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><p>Конференция (внешн.)</p></TooltipContent>
                                </Tooltip>
                              )}
                              {/* Внешняя доска — если есть */}
                              {(st as any)?.links?.board && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-violet-400/60 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                                      onClick={() => { const l = (st as any).links.board; window.open(l.startsWith("http") ? l : `https://${l}`, "_blank"); }}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><p>Доска (внешн.)</p></TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => setLocation(`/students?open=${booked.studentId}`)}>
                                    <User className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Профиль ученика</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                                    const url = generateGoogleCalendarUrl(`${st?.name} - ${booked.topic}`, booked.scheduledAt, booked.durationMinutes);
                                    window.open(url, "_blank");
                                  }}>
                                    <CalendarPlus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Добавить в Google Календарь</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                                    setRescheduleLesson(booked);
                                    setRescheduleDate(format(new Date(), "yyyy-MM-dd"));
                                    setRescheduleHour(booked.scheduledAt.getHours());
                                    setRescheduleMinute(booked.scheduledAt.getMinutes());
                                    setShowRescheduleDialog(true);
                                  }}>
                                    <Repeat className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Перенести занятие</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant={editingLessonId === booked.id ? "secondary" : "ghost"}
                                    className="h-8 text-xs px-2"
                                    onClick={() => setEditingLessonId(editingLessonId === booked.id ? null : booked.id)}
                                    data-testid={`button-schedule-edit-${booked.id}`}
                                  >
                                    {editingLessonId === booked.id ? "Свернуть" : "Изменить"}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Редактировать занятие</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => setDeletingScheduleLessonId(booked.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Удалить занятие</p></TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="text-sm text-muted-foreground">
                                {booked ? "Занятие отменено" : "Свободный слот"}
                              </div>
                              {booked && (
                                <div className="text-xs text-muted-foreground/60">
                                  {st?.name} · {booked.topic || "без темы"}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              onClick={() => {
                                setScheduleHour(h);
                                setScheduleMinute(0);
                                setScheduleStudentId(activeStudents[0]?.id || "");
                                setScheduleTopic("");
                                setScheduleWeekDays([]);
                                setScheduleUnlimited(false);
                                setShowScheduleDialog(true);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              Добавить
                            </Button>
                          </div>
                        )}
                        </div>{/* end flex items-center gap-4 wrapper */}

                        {/* Expandable edit panel */}
                        {booked && booked.status !== "cancelled" && editingLessonId === booked.id && (
                          <AnimatePresence>
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 pt-3 border-t border-border/50 overflow-hidden"
                            >
                              <div className="space-y-3">
                                {/* Status buttons */}
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className={cn("px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5",
                                      booked.status === "completed" && booked.attendance === "attended"
                                        ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 text-emerald-700 font-medium"
                                        : "bg-background border-border/50 text-muted-foreground hover:bg-emerald-50 dark:hover:bg-emerald-900/20")}
                                    onClick={() => applyScheduleUpdate(booked.id, { status: "completed", attendance: "attended" })}
                                  >
                                    <Check className="h-3 w-3" /> Проведено
                                  </button>
                                  <button
                                    className={cn("px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5",
                                      booked.status === "completed" && booked.attendance === "attended_unpaid"
                                        ? "bg-orange-100 dark:bg-orange-900/30 border-orange-300 text-orange-700 font-medium"
                                        : "bg-background border-border/50 text-muted-foreground hover:bg-orange-50 dark:hover:bg-orange-900/20")}
                                    onClick={() => applyScheduleUpdate(booked.id, { status: "completed", attendance: "attended_unpaid" })}
                                  >
                                    <X className="h-3 w-3" /> Проведено ✗
                                  </button>
                                  <button
                                    className={cn("px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5",
                                      booked.status === "cancelled"
                                        ? "bg-red-100 dark:bg-red-900/30 border-red-300 text-red-700 font-medium"
                                        : "bg-background border-border/50 text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/20")}
                                    onClick={() => applyScheduleUpdate(booked.id, { status: "cancelled" })}
                                  >
                                    <X className="h-3 w-3" /> Отменено
                                  </button>
                                  <button
                                    className={cn("px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5",
                                      booked.status === "pending"
                                        ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300 text-amber-700 font-medium"
                                        : "bg-background border-border/50 text-muted-foreground hover:bg-amber-50 dark:hover:bg-amber-900/20")}
                                    onClick={() => applyScheduleUpdate(booked.id, { status: "pending", attendance: null })}
                                  >
                                    <Clock className="h-3 w-3" /> Ожидает
                                  </button>
                                </div>

                                {/* Balance */}
                                {st && (
                                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                                    <span className="text-xs text-muted-foreground">Баланс ученика:</span>
                                    <span className={cn("text-xs font-bold tabular-nums",
                                      getEffectiveBalance(st.id) > 0 ? "text-emerald-600" :
                                      getEffectiveBalance(st.id) < 0 ? "text-red-600" :
                                      "text-muted-foreground"
                                    )}>
                                      {getEffectiveBalance(st.id) > 0 ? "+" : ""}{getEffectiveBalance(st.id).toLocaleString("ru")} ₽
                                    </span>
                                  </div>
                                )}

                                {/* Topic */}
                                <div className="pt-2 border-t border-border/40">
                                  <div className="text-xs font-medium text-muted-foreground mb-1.5">Тема занятия</div>
                                  <div className="flex gap-1.5">
                                    <Input
                                      value={editPanelTopicValue}
                                      onChange={e => setEditPanelTopicValue(e.target.value)}
                                      className="h-8 text-xs flex-1"
                                      placeholder="Тема"
                                      list="schedule-edit-topic-suggestions"
                                    />
                                    <Button size="sm" variant="outline" className="h-8 text-xs shrink-0"
                                      onClick={() => applyScheduleUpdate(booked.id, { topic: editPanelTopicValue })}>
                                      Сохр.
                                    </Button>
                                  </div>
                                  <datalist id="schedule-edit-topic-suggestions">{uniqueTopics.map(t => <option key={t} value={t} />)}</datalist>
                                </div>

                                {/* Rating */}
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1.5">Оценка занятия (видна ученику)</div>
                                  <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map(s => (
                                      <button key={s} onClick={() => { setEditPanelRating(s); applyScheduleUpdate(booked.id, { rating: s }); }} className="hover:scale-110 transition-transform">
                                        <Star className={cn("h-5 w-5", editPanelRating !== null && s <= editPanelRating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 hover:text-amber-300")} />
                                      </button>
                                    ))}
                                    {editPanelRating !== null && (
                                      <button className="text-[10px] text-muted-foreground ml-1.5 hover:text-red-500" onClick={() => { setEditPanelRating(null); applyScheduleUpdate(booked.id, { rating: null }); }}>✕</button>
                                    )}
                                  </div>
                                </div>

                                {/* Notes */}
                                <div className="pt-2 border-t border-border/40">
                                  <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                    <span>📝</span> Заметки к уроку
                                  </div>
                                  <Textarea
                                    value={editPanelNotesValue}
                                    onChange={e => setEditPanelNotesValue(e.target.value)}
                                    placeholder="Что разобрали, что вызвало трудности, план следующего урока..."
                                    className="text-xs min-h-[72px] resize-none"
                                    data-testid="textarea-lesson-notes"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs mt-1.5 gap-1"
                                    onClick={() => applyScheduleUpdate(booked.id, { notes: editPanelNotesValue })}
                                    disabled={updateLesson.isPending}
                                  >
                                    Сохранить заметку
                                  </Button>
                                </div>

                                {/* Reschedule */}
                                <div className="pt-2 border-t border-border/40">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">Перенести занятие</div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Input
                                      type="date"
                                      value={editPanelRescheduleDate}
                                      onChange={e => setEditPanelRescheduleDate(e.target.value)}
                                      className="h-8 text-xs flex-1 min-w-[130px]"
                                    />
                                    <Input
                                      type="time"
                                      value={editPanelRescheduleTime}
                                      onChange={e => setEditPanelRescheduleTime(e.target.value)}
                                      className="h-8 text-xs w-[90px]"
                                    />
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                                      onClick={() => handleEditPanelReschedule(booked.id)}
                                      disabled={updateLesson.isPending}
                                    >
                                      <MoveRight className="h-3.5 w-3.5" /> Перенести
                                    </Button>
                                  </div>
                                </div>

                                {/* Delete */}
                                <div className="pt-2 border-t border-border/40">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-8 gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    onClick={() => setDeletingScheduleLessonId(booked.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Удалить занятие
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          </AnimatePresence>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Добавить занятие
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Ученик</Label>
              <StudentCombobox
                students={activeStudents}
                value={scheduleStudentId}
                onValueChange={setScheduleStudentId}
                placeholder="Выберите ученика"
                triggerClassName="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Время</Label>
                <Input
                  type="time"
                  className="mt-1"
                  value={`${String(scheduleHour).padStart(2, "0")}:${String(scheduleMinute ?? 0).padStart(2, "0")}`}
                  onChange={(e) => {
                    const parts = e.target.value.split(":").map(Number);
                    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                      setScheduleHour(parts[0]);
                      setScheduleMinute(parts[1]);
                    }
                  }}
                />
              </div>
              <div>
                <Label>Длительность</Label>
                <Select value={String(scheduleDuration)} onValueChange={(v) => setScheduleDuration(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="45">45 мин</SelectItem>
                    <SelectItem value="60">60 мин</SelectItem>
                    <SelectItem value="90">90 мин</SelectItem>
                    <SelectItem value="120">120 мин</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {singleConflict && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-400/30 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-medium text-amber-700 dark:text-amber-400">Занято: </span>
                  <span className="text-amber-700 dark:text-amber-400">
                    {students.find(s => s.id === singleConflict.studentId)?.name || "Ученик"} в {String(new Date(singleConflict.scheduledAt).getHours()).padStart(2,"0")}:{String(new Date(singleConflict.scheduledAt).getMinutes()).padStart(2,"0")} ({singleConflict.durationMinutes} мин)
                  </span>
                  <span className="text-amber-600 dark:text-amber-500"> — вы всё равно можете добавить занятие</span>
                </div>
              </div>
            )}

            {recurringConflicts.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-400/30 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                  <div className="font-medium">Конфликты в первую неделю:</div>
                  {recurringConflicts.map((c, i) => (
                    <div key={i}>{c.dayLabel} {format(c.date, "d MMM", { locale: ru })}: {c.student}</div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Тема</Label>
              <Input value={scheduleTopic} onChange={(e) => setScheduleTopic(e.target.value)} className="mt-1" placeholder="Оставьте пустым для авто-назначения из программы" list="schedule-topic-suggestions" />
              <datalist id="schedule-topic-suggestions">{uniqueTopics.map(t => <option key={t} value={t} />)}</datalist>
              {(() => {
                const selStudent = students.find(s => s.id === scheduleStudentId);
                const programTopics = (selStudent as any)?.programData?.topics as any[] | undefined;
                if (!programTopics?.length) return null;
                const unfinished = programTopics.filter((t: any) => !t.completed);
                if (!unfinished.length) return null;
                return (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Темы из программы (нажмите для выбора):</p>
                    <div className="flex flex-wrap gap-1">
                      {unfinished.slice(0, 8).map((t: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          className={cn(
                            "px-2 py-0.5 text-xs rounded-full border transition-colors",
                            scheduleTopic === t.title
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 border-border/50 hover:bg-primary/10"
                          )}
                          onClick={() => setScheduleTopic(t.title)}
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                    {!scheduleTopic && (
                      <p className="text-[11px] text-blue-500">Без указания темы — занятия получат темы из программы по порядку</p>
                    )}
                  </div>
                );
              })()}
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Повторение (дни недели)
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[{ d: 1, n: "Пн" }, { d: 2, n: "Вт" }, { d: 3, n: "Ср" }, { d: 4, n: "Чт" }, { d: 5, n: "Пт" }, { d: 6, n: "Сб" }, { d: 0, n: "Вс" }].map(({ d, n }) => (
                  <label key={d} className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                    scheduleWeekDays.includes(d) ? "border-primary bg-primary/10" : "border-border/50 hover:bg-accent"
                  )}>
                    <Checkbox checked={scheduleWeekDays.includes(d)} onCheckedChange={(c) => setScheduleWeekDays(c ? [...scheduleWeekDays, d] : scheduleWeekDays.filter((x) => x !== d))} />
                    <span className="text-sm">{n}</span>
                  </label>
                ))}
              </div>
            </div>
            {scheduleWeekDays.length > 0 && (
              <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3">
                <div>
                  <Label>Начало серии</Label>
                  <Input type="date" value={scheduleStartDate} onChange={(e) => setScheduleStartDate(e.target.value)} className="mt-1" data-testid="input-series-start" />
                </div>
                <div>
                  <Label>Окончание</Label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {([
                      { v: "count", label: "По числу" },
                      { v: "until", label: "До даты" },
                      { v: "year", label: "На год" },
                    ] as const).map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setScheduleEndMode(opt.v)}
                        aria-pressed={scheduleEndMode === opt.v}
                        className={cn(
                          "px-2 py-1.5 text-xs rounded-lg border transition-colors",
                          scheduleEndMode === opt.v
                            ? "border-primary bg-primary/15 text-primary font-medium"
                            : "border-border/50 hover:bg-accent"
                        )}
                        data-testid={`button-end-mode-${opt.v}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {scheduleEndMode === "count" && (
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={scheduleRecurrenceCount}
                      onChange={(e) => setScheduleRecurrenceCount(Number(e.target.value))}
                      className="mt-2"
                      placeholder="Кол-во занятий"
                      data-testid="input-series-count"
                    />
                  )}
                  {scheduleEndMode === "until" && (
                    <Input
                      type="date"
                      value={scheduleEndDate}
                      min={scheduleStartDate}
                      onChange={(e) => setScheduleEndDate(e.target.value)}
                      className="mt-2"
                      data-testid="input-series-until"
                    />
                  )}
                </div>

                {recurringPreview.length > 0 && (
                  <div className="rounded-lg bg-background/60 border border-border/40 p-2.5 text-xs space-y-1" data-testid="series-preview">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Будет создано</span>
                      <span className="font-semibold text-primary">{recurringPreview.length} занятий</span>
                    </div>
                    <div className="text-muted-foreground/80 leading-relaxed">
                      {recurringPreview.slice(0, 3).map(d => format(d, "d MMM, EEE", { locale: ru })).join(" · ")}
                      {recurringPreview.length > 3 && ` … → ${format(recurringPreview[recurringPreview.length - 1], "d MMM yyyy", { locale: ru })}`}
                    </div>
                  </div>
                )}
                {recurringPreview.length >= 500 && (
                  <p className="text-[11px] text-amber-600">Достигнут лимит 500 занятий — сократите период или число повторов.</p>
                )}
              </div>
            )}
            <Button className="w-full gap-2" onClick={handleAddLesson} disabled={createLesson.isPending || (scheduleWeekDays.length > 0 && recurringPreview.length === 0)} data-testid="button-create-lessons">
              <Plus className="h-4 w-4" />
              {createLesson.isPending
                ? "Добавление..."
                : scheduleWeekDays.length > 0
                  ? `Создать ${recurringPreview.length || "…"} ${recurringPreview.length === 1 ? "занятие" : "занятий"}`
                  : "Добавить занятие"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              Перенести занятие
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Новая дата</Label>
              <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="mt-1" />
            </div>
            {rescheduleDate && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Выберите время</Label>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-400" />свободно</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-400" />занято</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {Array.from({ length: 13 }, (_, i) => i + 8).flatMap(h => [0, 30].map(m => {
                    const key = `${h}:${m}`;
                    const conflict = rescheduleConflictMap[key];
                    const isSelected = rescheduleHour === h && rescheduleMinute === m;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setRescheduleHour(h); setRescheduleMinute(m); }}
                        title={conflict ? `Занят: ${conflict.studentName}` : "Свободно"}
                        className={cn(
                          "rounded-lg px-1.5 py-2 text-xs transition-all text-left border",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : conflict
                              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 cursor-pointer hover:opacity-80"
                              : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 hover:bg-primary/10 hover:border-primary/40"
                        )}
                      >
                        <div className={cn("font-semibold tabular-nums", isSelected ? "" : conflict ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
                          {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
                        </div>
                        {conflict && !isSelected && (
                          <div className="text-[9px] leading-tight truncate text-amber-600 dark:text-amber-400 mt-0.5">
                            {conflict.studentName.split(" ")[0]}
                          </div>
                        )}
                        {!conflict && !isSelected && (
                          <div className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">свободно</div>
                        )}
                      </button>
                    );
                  }))}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Выбрано: <span className="font-semibold text-foreground">{String(rescheduleHour).padStart(2, "0")}:{String(rescheduleMinute).padStart(2, "0")}</span>
                  {rescheduleConflictMap[`${rescheduleHour}:${rescheduleMinute}`] && (
                    <span className="text-amber-600 dark:text-amber-400 ml-1">
                      — занято ({rescheduleConflictMap[`${rescheduleHour}:${rescheduleMinute}`].studentName})
                    </span>
                  )}
                </div>
              </div>
            )}
            <Button className="w-full" onClick={handleReschedule} disabled={updateLesson.isPending}>
              {updateLesson.isPending ? "Перенос..." : "Перенести"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-primary" />
              Массовое добавление занятий
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Укажите ученика, дни недели, время и режим повторения. Для каждого можно выбрать — разовое занятие или регулярное расписание.
            </p>
            <div>
              <Label>Дата начала</Label>
              <Input type="date" value={scheduleStartDate} onChange={(e) => setScheduleStartDate(e.target.value)} className="mt-1 w-48" />
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {bulkRows.map((row, idx) => (
                <div key={idx} className="rounded-lg border bg-card p-3 space-y-2.5 relative">
                  {bulkRows.length > 1 && (
                    <button className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Ученик</Label>
                      <Select value={row.studentId} onValueChange={(v) => { const nr = [...bulkRows]; nr[idx] = { ...nr[idx], studentId: v }; setBulkRows(nr); }}>
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Выберите" /></SelectTrigger>
                        <SelectContent>
                          {activeStudents.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Тема</Label>
                      <Input className="h-8 text-xs mt-0.5" placeholder="Авто из программы" value={row.topic} onChange={(e) => { const nr = [...bulkRows]; nr[idx] = { ...nr[idx], topic: e.target.value }; setBulkRows(nr); }} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Дни недели</Label>
                    <div className="flex gap-1 mt-0.5">
                      {[{ d: 1, n: "Пн" }, { d: 2, n: "Вт" }, { d: 3, n: "Ср" }, { d: 4, n: "Чт" }, { d: 5, n: "Пт" }, { d: 6, n: "Сб" }, { d: 0, n: "Вс" }].map(({ d, n }) => (
                        <button
                          key={d}
                          type="button"
                          className={cn(
                            "px-2 py-1 text-xs rounded border transition-colors",
                            row.days.includes(d)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/30 border-border/50 hover:bg-primary/10"
                          )}
                          onClick={() => {
                            const nr = [...bulkRows];
                            const newDays = row.days.includes(d) ? row.days.filter(x => x !== d) : [...row.days, d];
                            nr[idx] = { ...nr[idx], days: newDays };
                            setBulkRows(nr);
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Время</Label>
                      <Select value={String(row.hour)} onValueChange={(v) => { const nr = [...bulkRows]; nr[idx] = { ...nr[idx], hour: Number(v) }; setBulkRows(nr); }}>
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {hourSlots.map((h) => (<SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Длительность</Label>
                      <Select value={String(row.duration)} onValueChange={(v) => { const nr = [...bulkRows]; nr[idx] = { ...nr[idx], duration: Number(v) }; setBulkRows(nr); }}>
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="45">45 мин</SelectItem>
                          <SelectItem value="60">60 мин</SelectItem>
                          <SelectItem value="90">90 мин</SelectItem>
                          <SelectItem value="120">120 мин</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Режим</Label>
                      <Select value={row.mode} onValueChange={(v) => { const nr = [...bulkRows]; nr[idx] = { ...nr[idx], mode: v as "once" | "repeat" }; setBulkRows(nr); }}>
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once">Разово</SelectItem>
                          <SelectItem value="repeat">Повторять</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {row.mode === "repeat" && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Период</Label>
                        <Select value={String(row.repeatWeeks)} onValueChange={(v) => { const nr = [...bulkRows]; nr[idx] = { ...nr[idx], repeatWeeks: Number(v) }; setBulkRows(nr); }}>
                          <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4">4 недели</SelectItem>
                            <SelectItem value="8">8 недель</SelectItem>
                            <SelectItem value="12">3 месяца</SelectItem>
                            <SelectItem value="26">полгода</SelectItem>
                            <SelectItem value="52">год</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setBulkRows([...bulkRows, { studentId: "", days: [1], hour: 16, duration: 60, topic: "", mode: "repeat", repeatWeeks: 52 }])}>
              <Plus className="h-3.5 w-3.5" />
              Добавить строку
            </Button>
            <Button className="w-full gap-2" onClick={handleBulkAdd} disabled={createLesson.isPending}>
              <CalendarPlus className="h-4 w-4" />
              {createLesson.isPending ? "Создание..." : `Создать расписание (${bulkRows.filter(r => r.studentId).length} учеников)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingScheduleLessonId} onOpenChange={(open) => { if (!open) setDeletingScheduleLessonId(null); }}>
        <AlertDialogContent>
          {(() => {
            const seriesSiblings = deletingScheduleLessonId ? findSeriesLessons(deletingScheduleLessonId) : [];
            const hasSeries = seriesSiblings.length > 0;
            const target = deletingScheduleLessonId ? lessons.find(l => l.id === deletingScheduleLessonId) : null;
            const targetStudent = target ? students.find(s => s.id === target.studentId) : null;
            const weekdayNames = ["воскресеньям", "понедельникам", "вторникам", "средам", "четвергам", "пятницам", "субботам"];
            const dayLabel = target ? weekdayNames[new Date(target.scheduledAt).getDay()] : "";
            const timeLabel = target
              ? `${String(new Date(target.scheduledAt).getHours()).padStart(2, "0")}:${String(new Date(target.scheduledAt).getMinutes()).padStart(2, "0")}`
              : "";

            const deleteOne = async () => {
              if (!deletingScheduleLessonId) return;
              try {
                await deleteLesson.mutateAsync(deletingScheduleLessonId);
                toast.success("Занятие удалено");
              } catch {
                toast.error("Ошибка");
              }
              setDeletingScheduleLessonId(null);
              setEditingLessonId(null);
            };
            const deleteSeries = async () => {
              if (!deletingScheduleLessonId) return;
              const ids = [deletingScheduleLessonId, ...seriesSiblings.map(l => l.id)];
              const results = await Promise.allSettled(ids.map(id => deleteLesson.mutateAsync(id)));
              const succeeded = results.filter(r => r.status === "fulfilled").length;
              const failed = results.length - succeeded;
              if (failed === 0) {
                toast.success(`Серия удалена: ${succeeded} занятий`);
              } else if (succeeded > 0) {
                toast.error(`Удалено ${succeeded} из ${results.length}, ${failed} с ошибкой`);
              } else {
                toast.error("Не удалось удалить серию");
              }
              setDeletingScheduleLessonId(null);
              setEditingLessonId(null);
            };

            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить занятие?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {hasSeries
                      ? <>Это занятие — часть серии <b>«{targetStudent?.name ?? "ученик"} по {dayLabel} в {timeLabel}»</b>. Найдено ещё <b>{seriesSiblings.length}</b> будущих занятий в этой серии.</>
                      : <>Это действие необратимо. Занятие будет удалено из расписания.</>}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className={hasSeries ? "sm:flex-row sm:justify-between gap-2" : ""}>
                  <AlertDialogCancel data-testid="button-cancel-delete">Отмена</AlertDialogCancel>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <AlertDialogAction
                      className="bg-red-500 hover:bg-red-600"
                      onClick={deleteOne}
                      data-testid="button-delete-one"
                    >
                      {hasSeries ? "Только это" : "Удалить"}
                    </AlertDialogAction>
                    {hasSeries && (
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={deleteSeries}
                        data-testid="button-delete-series"
                      >
                        Удалить всю серию ({seriesSiblings.length + 1})
                      </AlertDialogAction>
                    )}
                  </div>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Рабочие часы ────────────────────────────────────────────────── */}
      <Dialog open={showWorkHoursDialog} onOpenChange={setShowWorkHoursDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Рабочие часы расписания
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Задайте, с какого по какой час отображать расписание дня.
          </p>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>С (час начала)</Label>
              <Select value={String(whStart)} onValueChange={(v) => setWhStart(Number(v))}>
                <SelectTrigger data-testid="select-wh-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2,"0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>До (час конца)</Label>
              <Select value={String(whEnd)} onValueChange={(v) => setWhEnd(Number(v))}>
                <SelectTrigger data-testid="select-wh-end"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map(i => (
                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2,"0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {whStart >= whEnd && (
            <p className="text-xs text-destructive">⚠ Час начала должен быть меньше часа конца</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowWorkHoursDialog(false)}>Отмена</Button>
            <Button className="flex-1" disabled={whSaving || whStart >= whEnd} onClick={saveWorkHours} data-testid="button-save-work-hours">
              {whSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
