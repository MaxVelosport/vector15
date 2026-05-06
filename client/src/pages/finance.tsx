import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePaymentResult } from "@/hooks/use-payment-result";
import { useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Filter,
  Info,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { exportFinanceToExcel } from "@/lib/export-excel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { invalidateResource } from "@/lib/queryClient";
import { useStudents, useLessons, usePayments, useCreatePayment, useDeletePayment, useUpdateLesson } from "@/hooks/use-tutor-data";
import { useAuth } from "@/hooks/use-auth";
import type { Payment } from "@shared/schema";
import { SamozanyatyReceiptDialog, isReceiptIssued, loadReceiptStore, pluralizePayments } from "@/components/samozanyaty-receipt-dialog";
import { PaymentReminderDialog, getLastReminder, type ReminderStudentData } from "@/components/payment-reminder-dialog";
import { MessageCircle } from "lucide-react";

import { useDocumentTitle } from "@/hooks/use-document-title";
function moneyRub(amount: number) {
  const sign = amount < 0 ? "−" : "";
  const v = Math.abs(amount);
  return `${sign}${v.toLocaleString("ru-RU")} ₽`;
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

function methodIcon(method: string) {
  switch (method) {
    case "карта": return <CreditCard className="w-4 h-4" />;
    case "наличные": return <Banknote className="w-4 h-4" />;
    default: return <ArrowUpRight className="w-4 h-4" />;
  }
}

function methodLabel(method: string) {
  switch (method) {
    case "карта": return "Карта";
    case "наличные": return "Наличные";
    case "перевод": return "Перевод";
    default: return method;
  }
}

function pluralLessons(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} занятие`;
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return `${n} занятия`;
  return `${n} занятий`;
}

export default function FinancePage() {
  useDocumentTitle("Финансы");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  usePaymentResult({
    param: "payment",
    successMessage: "Оплата прошла. Спасибо! Чек отправлен на email.",
    failMessage: "Платёж не прошёл. Попробуйте ещё раз или свяжитесь с репетитором.",
    successAction: () => invalidateResource("payments", "students"),
  });
  const { data: studentsData, isLoading: studentsLoading } = useStudents();
  const { data: lessonsData, isLoading: lessonsLoading } = useLessons();
  const { data: paymentsData, isLoading: paymentsLoading } = usePayments();
  const createPayment = useCreatePayment();
  const deletePayment = useDeletePayment();
  const updateLesson = useUpdateLesson();

  const students = useMemo(() => studentsData ?? [], [studentsData]);
  const lessons = useMemo(() => lessonsData?.map(l => ({ ...l, scheduledAt: new Date(l.scheduledAt) })) ?? [], [lessonsData]);
  const payments = useMemo(() => paymentsData?.map(p => ({ ...p, createdAt: new Date(p.createdAt) })) ?? [], [paymentsData]);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10);
  });
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<number>(1500);
  const [paymentMethod, setPaymentMethod] = useState<string>("перевод");
  const [paymentComment, setPaymentComment] = useState("");
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [balanceFilter, setBalanceFilter] = useState<"all" | "debtors" | "overpaid" | "zero">("all");
  const [balanceSort, setBalanceSort] = useState<"debt" | "overpaid" | "name">("debt");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderList, setReminderList] = useState<ReminderStudentData[]>([]);
  const [reminderStartIndex, setReminderStartIndex] = useState(0);
  const [remindersVersion, setRemindersVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setRemindersVersion(v => v + 1);
    window.addEventListener("tv-parent-reminders-changed", onChange);
    return () => window.removeEventListener("tv-parent-reminders-changed", onChange);
  }, []);
  const [markingLessonId, setMarkingLessonId] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [receiptsVersion, setReceiptsVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setReceiptsVersion(v => v + 1);
    window.addEventListener("samozanyaty-receipts-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("samozanyaty-receipts-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  // Inline payment state (keyed by student id)
  const [inlineAmounts, setInlineAmounts] = useState<Record<string, number>>({});
  const [inlineMethods, setInlineMethods] = useState<Record<string, string>>({});
  const [inlineSubmitting, setInlineSubmitting] = useState<string | null>(null);
  const [editBalanceStudentId, setEditBalanceStudentId] = useState<string | null>(null);
  const [editBalanceValue, setEditBalanceValue] = useState<string>("");
  const [editBalanceSubmitting, setEditBalanceSubmitting] = useState(false);

  const [showOnlinePayDialog, setShowOnlinePayDialog] = useState(false);
  const [onlinePayStudentId, setOnlinePayStudentId] = useState<string>("");
  const [onlinePayAmount, setOnlinePayAmount] = useState<number>(0);
  const [onlinePayDesc, setOnlinePayDesc] = useState<string>("");
  const [onlinePayPending, setOnlinePayPending] = useState(false);
  const [onlinePayLink, setOnlinePayLink] = useState<string | null>(null);

  // Cancel policy state
  const [cancelPolicyEdit, setCancelPolicyEdit] = useState(false);
  const [cancelPolicy, setCancelPolicy] = useState<'free' | 'fixed' | 'per_student'>('free');
  const [cancelFee, setCancelFee] = useState(0);
  const [studentCancelFees, setStudentCancelFees] = useState<Record<string, number>>({});
  const [savingCancelPolicy, setSavingCancelPolicy] = useState(false);

  const { data: cancelPolicyData, refetch: refetchCancelPolicy } = useQuery<{
    policy: 'free' | 'fixed' | 'per_student';
    fee: number;
    students: Array<{ id: string; name: string; cancelFee: number | null }>;
  }>({
    queryKey: ['/api/settings/cancel-policy'],
  });

  useEffect(() => {
    if (cancelPolicyData) {
      setCancelPolicy(cancelPolicyData.policy);
      setCancelFee(cancelPolicyData.fee);
      const fees: Record<string, number> = {};
      cancelPolicyData.students.forEach(s => { fees[s.id] = s.cancelFee ?? 0; });
      setStudentCancelFees(fees);
    }
  }, [cancelPolicyData]);

  const saveCancelPolicy = async () => {
    setSavingCancelPolicy(true);
    try {
      const studentFees: Record<string, number | null> = {};
      Object.entries(studentCancelFees).forEach(([id, fee]) => {
        studentFees[id] = fee || null;
      });
      const res = await fetch('/api/settings/cancel-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ policy: cancelPolicy, fee: cancelFee, studentFees }),
      });
      if (!res.ok) throw new Error('Ошибка сохранения');
      toast.success('Политика отмены сохранена');
      setCancelPolicyEdit(false);
      refetchCancelPolicy();
    } catch {
      toast.error('Ошибка сохранения политики');
    } finally {
      setSavingCancelPolicy(false);
    }
  };

  const migrationRan = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (migrationRan.current || lessonsLoading || paymentsLoading) return;
    const attendedLessons = (lessonsData ?? []).filter(
      (l: any) => l.status === "completed" && l.attendance === "attended"
    );
    const paymentComments = (paymentsData ?? []).map((p: any) => p.comment || "");
    const missingPayments = attendedLessons.filter(
      (l: any) => !paymentComments.some((c: string) => c.includes(`[lesson:${l.id}]`))
    );
    if (missingPayments.length === 0) return;
    migrationRan.current = true;
    fetch("/api/finance/migrate-payments", {
      method: "POST",
      credentials: "include",
    })
      .then(r => r.json())
      .then(data => {
        if (data.created > 0) {
          invalidateResource("payments");
          invalidateResource("students");
        }
      })
      .catch(() => {});
  }, [lessonsData, paymentsData, lessonsLoading, paymentsLoading, queryClient]);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const isBillable = (l: any) =>
    (l.status === "completed" && ["attended", "attended_unpaid", "missed_paid"].includes(l.attendance || "")) ||
    (l.status === "cancelled" && l.attendance === "missed_paid");

  // «attended_unpaid» уже включены в isBillable (и в расходовано),
  // поэтому долг = то, что не покрыто балансом, а не сумма unpaid-уроков сверху.
  // Реальный долг считаем через effectiveBalance: если он < 0 — есть долг.
  const calcActualDebt = (effectiveBalance: number) => Math.abs(Math.min(0, effectiveBalance));

  const calcLessonCost = (lesson: any, student: any) => {
    if (!student) return 0;
    const duration = lesson.durationMinutes || 60;
    return Math.round(student.pricePerLesson * duration / 60);
  };

  const studentFinanceData = useMemo(() => {
    return students.map(s => {
      const studentPayments = payments.filter(p => p.studentId === s.id);
      const totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
      const lastPayment = [...studentPayments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      const billableLessons = lessons.filter(l => l.studentId === s.id && isBillable(l));
      const totalLessonsCost = billableLessons.reduce((sum, l) => sum + calcLessonCost(l, s), 0);
      const effectiveBalance = totalPaid - totalLessonsCost;

      // «Неоплаченные» занятия: берём все биллируемые занятия из ВСЕГО периода,
      // начиная с самых последних, и набираем их пока не покроем сумму долга.
      // Это гарантирует корректный перенос долга с прошлых месяцев.
      const debtLessons: typeof billableLessons = [];
      if (effectiveBalance < 0) {
        const byDateDesc = [...billableLessons].sort(
          (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        );
        let remaining = Math.abs(effectiveBalance);
        for (const l of byDateDesc) {
          if (remaining <= 0) break;
          debtLessons.push(l);
          remaining -= calcLessonCost(l, s);
        }
        debtLessons.reverse(); // показываем хронологически (старые → новые)
      }
      const unpaidLessons = debtLessons;
      const unpaidDebt = unpaidLessons.reduce((sum, l) => sum + calcLessonCost(l, s), 0);

      const monthLessons = lessons.filter(
        l => l.studentId === s.id && l.scheduledAt >= startOfMonth && l.scheduledAt <= endOfMonth && isBillable(l)
      );
      const monthlyCost = monthLessons.reduce((sum, l) => sum + calcLessonCost(l, s), 0);
      const paidThisMonth = studentPayments
        .filter(p => p.createdAt >= startOfMonth)
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        ...s,
        totalPaid,
        totalLessonsCost,
        effectiveBalance,
        unpaidDebt,
        unpaidLessons,
        unpaidLessonsCount: unpaidLessons.length,
        lastPayment,
        lessonsThisMonth: monthLessons.length,
        monthlyCost,
        paidThisMonth,
        billableLessonsCount: billableLessons.length,
      };
    });
  }, [students, payments, lessons, startOfMonth, endOfMonth]);

  const filteredSortedStudents = useMemo(() => {
    let filtered = [...studentFinanceData];
    if (balanceFilter === "debtors") filtered = filtered.filter(s => s.effectiveBalance < 0);
    else if (balanceFilter === "overpaid") filtered = filtered.filter(s => s.effectiveBalance > 0);
    else if (balanceFilter === "zero") filtered = filtered.filter(s => s.effectiveBalance === 0);

    if (balanceSort === "debt") filtered.sort((a, b) => a.effectiveBalance - b.effectiveBalance);
    else if (balanceSort === "overpaid") filtered.sort((a, b) => b.effectiveBalance - a.effectiveBalance);
    else filtered.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
    return filtered;
  }, [studentFinanceData, balanceFilter, balanceSort]);

  const debtorsCount = studentFinanceData.filter(s => s.effectiveBalance < 0).length;
  const overpaidCount = studentFinanceData.filter(s => s.effectiveBalance > 0).length;
  const totalDebt = studentFinanceData.filter(s => s.effectiveBalance < 0).reduce((sum, s) => sum + Math.abs(s.effectiveBalance), 0);
  const totalOverpaid = studentFinanceData.filter(s => s.effectiveBalance > 0).reduce((sum, s) => sum + s.effectiveBalance, 0);

  const calculateEarned = (start: Date, end: Date) => {
    return lessons
      .filter(l => l.scheduledAt >= start && l.scheduledAt < end && isBillable(l))
      .reduce((sum, l) => {
        const student = students.find(s => s.id === l.studentId);
        return sum + calcLessonCost(l, student);
      }, 0);
  };

  const todayEarned = calculateEarned(startOfDay, new Date(startOfDay.getTime() + 86400000));
  const weekEarned = calculateEarned(startOfWeek, now);
  const monthEarned = calculateEarned(startOfMonth, now);
  const lastMonthEarned = calculateEarned(startOfLastMonth, endOfLastMonth);
  const monthGrowth = lastMonthEarned ? Math.round(((monthEarned - lastMonthEarned) / lastMonthEarned) * 100) : 0;

  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [payments]
  );
  const displayPayments = showAllPayments ? sortedPayments : sortedPayments.slice(0, 8);

  const pendingReceiptsCount = useMemo(() => {
    void receiptsVersion;
    const store = loadReceiptStore();
    return sortedPayments.filter(p => p.amount > 0 && !p.comment?.includes("[correction]") && !store[p.id]).length;
  }, [sortedPayments, receiptsVersion]);

  const monthlyPaymentsTotal = payments
    .filter(p => p.createdAt >= startOfMonth && p.createdAt < now)
    .reduce((sum, p) => sum + p.amount, 0);

  const allMonthLessons = lessons.filter(l => l.scheduledAt >= startOfMonth && l.scheduledAt <= endOfMonth);
  const completedMonthLessons = allMonthLessons.filter(l => l.status === "completed" || (l.status === "cancelled" && l.attendance === "missed_paid"));
  const billableMonthLessons = allMonthLessons.filter(l => isBillable(l));
  const paidMonthLessons = allMonthLessons.filter(l => l.status === "completed" && l.attendance === "attended");
  const unpaidMonthLessons = allMonthLessons.filter(l => l.status === "completed" && l.attendance === "attended_unpaid");
  const cancelledPaidLessons = allMonthLessons.filter(l => l.status === "cancelled" && l.attendance === "missed_paid");
  const cancelledFreeLessons = allMonthLessons.filter(l => l.status === "cancelled" && l.attendance === "missed");
  const pendingMonthLessons = allMonthLessons.filter(l => l.status === "pending");

  const monthGoal = allMonthLessons.reduce((sum, l) => {
    const student = students.find(s => s.id === l.studentId);
    return sum + calcLessonCost(l, student);
  }, 0);

  const forecastMonth = allMonthLessons.reduce((sum, l) => {
    const student = students.find(s => s.id === l.studentId);
    const cost = calcLessonCost(l, student);
    if (l.scheduledAt < now) {
      return sum + (isBillable(l) ? cost : 0);
    }
    return sum + ((l.status !== "cancelled" || l.attendance === "missed_paid") ? cost : 0);
  }, 0);

  const avgLessonPrice = students.length
    ? Math.round(students.reduce((sum, s) => sum + s.pricePerLesson, 0) / students.length)
    : 0;

  const monthUnpaidDebt = unpaidMonthLessons.reduce((sum, l) => {
    const student = students.find(s => s.id === l.studentId);
    return sum + calcLessonCost(l, student);
  }, 0);

  const lostIncome = cancelledFreeLessons.reduce((sum, l) => {
    const student = students.find(s => s.id === l.studentId);
    return sum + calcLessonCost(l, student);
  }, 0);

  const pendingIncome = pendingMonthLessons.reduce((sum, l) => {
    const student = students.find(s => s.id === l.studentId);
    return sum + calcLessonCost(l, student);
  }, 0);

  const paidMonthEarned = paidMonthLessons.reduce((sum, l) => {
    const student = students.find(s => s.id === l.studentId);
    return sum + calcLessonCost(l, student);
  }, 0);

  const cancelledPaidEarned = cancelledPaidLessons.reduce((sum, l) => {
    const student = students.find(s => s.id === l.studentId);
    return sum + calcLessonCost(l, student);
  }, 0);

  const addPayment = async () => {
    const studentId = selectedStudentId || students[0]?.id;
    if (!studentId || !paymentAmount) {
      toast.error("Выберите ученика и укажите сумму");
      return;
    }
    try {
      await createPayment.mutateAsync({
        studentId,
        amount: paymentAmount,
        method: paymentMethod,
        comment: paymentComment || undefined,
      });
      toast.success("Оплата добавлена");
      setPaymentComment("");
      setShowPaymentDialog(false);
    } catch {
      toast.error("Ошибка при добавлении оплаты");
    }
  };

  const markLessonPaid = useCallback(async (lessonId: string) => {
    setMarkingLessonId(lessonId);
    try {
      await updateLesson.mutateAsync({
        id: lessonId,
        updates: { status: "completed", attendance: "attended" },
      });
      toast.success("Занятие отмечено как оплаченное, платёж создан автоматически");
    } catch {
      toast.error("Ошибка при обновлении занятия");
    } finally {
      setMarkingLessonId(null);
    }
  }, [updateLesson]);

  const handleDeletePayment = useCallback(async (paymentId: string) => {
    setDeletingPaymentId(paymentId);
    try {
      await deletePayment.mutateAsync(paymentId);
      toast.success("Платёж удалён");
    } catch {
      toast.error("Ошибка при удалении платежа");
    } finally {
      setDeletingPaymentId(null);
    }
  }, [deletePayment]);

  // Inline quick-pay helpers
  const getInlineAmount = (studentId: string, pricePerLesson: number) =>
    inlineAmounts[studentId] ?? pricePerLesson * 4;

  const getInlineMethod = (studentId: string) =>
    inlineMethods[studentId] ?? "перевод";

  const submitInlinePayment = async (studentId: string, pricePerLesson: number) => {
    const amount = getInlineAmount(studentId, pricePerLesson);
    if (!amount || amount <= 0) { toast.error("Укажите сумму"); return; }
    setInlineSubmitting(studentId);
    try {
      await createPayment.mutateAsync({
        studentId,
        amount,
        method: getInlineMethod(studentId) as Payment["method"],
        comment: undefined,
      });
      toast.success(`Оплата ${moneyRub(amount)} добавлена`);
      setInlineAmounts(prev => ({ ...prev, [studentId]: pricePerLesson * 4 }));
    } catch {
      toast.error("Ошибка при добавлении оплаты");
    } finally {
      setInlineSubmitting(null);
    }
  };

  const openEditBalance = (studentId: string, currentEffectiveBalance: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditBalanceStudentId(studentId);
    setEditBalanceValue(String(currentEffectiveBalance));
  };

  const submitSetBalance = async (studentId: string) => {
    const newBalance = parseInt(editBalanceValue, 10);
    if (isNaN(newBalance)) { toast.error("Введите корректное число"); return; }
    setEditBalanceSubmitting(true);
    try {
      const res = await fetch(`/api/students/${studentId}/set-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newBalance }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      invalidateResource("payments");
      invalidateResource("students");
      toast.success(data.delta === 0 ? "Баланс уже был таким" : `Баланс обновлён: ${newBalance > 0 ? "+" : ""}${moneyRub(newBalance)}`);
      setEditBalanceStudentId(null);
    } catch (e: any) {
      toast.error(e.message || "Ошибка при изменении баланса");
    } finally {
      setEditBalanceSubmitting(false);
    }
  };

  // When student selected in main dialog — prefill amount with their price × 4
  const handleSelectStudentForDialog = (id: string) => {
    setSelectedStudentId(id);
    const s = students.find(st => st.id === id);
    if (s) setPaymentAmount(s.pricePerLesson * 4);
  };

  const openOnlinePayDialog = (studentId: string) => {
    const s = students.find(st => st.id === studentId);
    setOnlinePayStudentId(studentId);
    setOnlinePayAmount(s?.pricePerLesson ? s.pricePerLesson * 4 : 0);
    setOnlinePayDesc("");
    setOnlinePayLink(null);
    setShowOnlinePayDialog(true);
  };

  const requestOnlinePayment = async () => {
    if (!onlinePayStudentId || !onlinePayAmount) {
      toast.error("Укажите ученика и сумму");
      return;
    }
    setOnlinePayPending(true);
    try {
      const res = await fetch("/api/payments/request-online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentId: onlinePayStudentId,
          amount: onlinePayAmount,
          description: onlinePayDesc || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setOnlinePayLink(data.confirmationUrl);
      invalidateResource("payments");
    } catch (e: any) {
      toast.error(e.message || "Ошибка создания платежа");
    } finally {
      setOnlinePayPending(false);
    }
  };

  const isLoading = studentsLoading || lessonsLoading || paymentsLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Финансы" subtitle="Загрузка...">
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-muted-foreground">Загрузка...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Финансы"
      subtitle="Баланс, доходы и задолженности"
      tabs={
        <div className="flex rounded-lg border border-border/60 overflow-hidden">
          <Button variant="ghost" size="sm" className="h-8 rounded-none text-xs gap-1.5 px-3 bg-primary/10 text-primary" data-testid="tab-finance-active">
            <CircleDollarSign className="h-3.5 w-3.5" /> Финансы
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-none text-xs gap-1.5 px-3 border-l border-border/60" onClick={() => setLocation("/analytics")} data-testid="tab-to-analytics">
            <TrendingUp className="h-3.5 w-3.5" /> Аналитика
          </Button>
        </div>
      }
      actions={
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden sm:flex" data-testid="button-export-finance"
            onClick={() => setShowExportDialog(true)}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Экспорт</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden sm:flex" data-testid="button-request-online-payment"
            onClick={() => { setOnlinePayStudentId(students[0]?.id || ""); setOnlinePayAmount(students[0]?.pricePerLesson ? students[0].pricePerLesson * 4 : 0); setOnlinePayDesc(""); setOnlinePayLink(null); setShowOnlinePayDialog(true); }}>
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden md:inline">Онлайн</span>
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs shadow-lg shadow-primary/20" data-testid="button-add-payment" onClick={() => setShowPaymentDialog(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Оплата</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <PageHero
          icon={<Wallet className="h-6 w-6 text-white" />}
          gradient="from-emerald-600/80 via-teal-600/70 to-cyan-600/60"
          title="Финансы"
          subtitle="Полный контроль доходов. Нажмите на ученика — увидите историю оплат и добавите новую. Баланс считается автоматически: оплаты минус стоимость проведённых занятий. Красный баланс — долг."
          badge="Финансы"
        />

        {/* ─── 4 HEADER STAT CARDS ─── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 overflow-hidden relative">
            <div className="pointer-events-none absolute right-3 top-3 opacity-15"><Wallet className="h-10 w-10 text-emerald-600 rotate-12" /></div>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                  <Wallet className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-600" data-testid="stat-month-earned">{moneyRub(monthEarned)}</div>
                  <div className="text-[11px] text-muted-foreground">Заработано за месяц</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                Сумма всех проведённых занятий (оплаченных и неоплаченных). {monthGrowth >= 0 ? (
                  <span className="text-emerald-600 font-medium">+{monthGrowth}% vs прошлый</span>
                ) : (
                  <span className="text-red-600 font-medium">{monthGrowth}% vs прошлый</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 overflow-hidden relative">
            <div className="pointer-events-none absolute right-3 top-3 opacity-15"><Receipt className="h-10 w-10 text-blue-600 -rotate-6" /></div>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                  <Receipt className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600" data-testid="stat-month-received">{moneyRub(monthlyPaymentsTotal)}</div>
                  <div className="text-[11px] text-muted-foreground">Поступило на счёт</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                Фактически полученные оплаты за текущий месяц — деньги, которые уже у вас.
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-amber-500/10 to-yellow-500/5 overflow-hidden relative">
            <div className="pointer-events-none absolute right-3 top-3 opacity-15"><Clock className="h-10 w-10 text-amber-600 rotate-12" /></div>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-600" data-testid="stat-awaiting-payment">{moneyRub(totalDebt)}</div>
                  <div className="text-[11px] text-muted-foreground">Ожидает оплаты</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                {debtorsCount > 0
                  ? `${debtorsCount} ${debtorsCount === 1 ? "ученик должен" : debtorsCount < 5 ? "ученика должны" : "учеников должны"} — с учётом долгов прошлых месяцев.`
                  : "Долгов нет — все занятия оплачены!"
                }
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-red-500/10 to-rose-500/5 overflow-hidden relative">
            <div className="pointer-events-none absolute right-3 top-3 opacity-15"><XCircle className="h-10 w-10 text-red-600 -rotate-12" /></div>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-red-600" data-testid="stat-lost-income">{lostIncome > 0 ? moneyRub(lostIncome) : "0 ₽"}</div>
                  <div className="text-[11px] text-muted-foreground">Упущенная прибыль</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                {cancelledFreeLessons.length > 0
                  ? `${cancelledFreeLessons.length} отмен без оплаты — эти деньги потеряны безвозвратно.`
                  : "Нет отмен без оплаты в этом месяце."
                }
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            {/* ─── STUDENT BALANCES WITH EXPANDABLE UNPAID LESSONS ─── */}
            <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-primary" />
                    Баланс учеников
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                      {[
                        { value: "all" as const, label: "Все", count: studentFinanceData.length },
                        { value: "debtors" as const, label: "Должники", count: debtorsCount },
                        { value: "overpaid" as const, label: "Переплата", count: overpaidCount },
                      ].map(f => (
                        <Button
                          key={f.value}
                          variant={balanceFilter === f.value ? "default" : "outline"}
                          size="sm"
                          className={cn("h-7 text-[11px] px-2", balanceFilter === f.value && "bg-blue-600 hover:bg-blue-700")}
                          onClick={() => setBalanceFilter(f.value)}
                          data-testid={`balance-filter-${f.value}`}
                        >
                          {f.label} {f.count > 0 && <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">{f.count}</Badge>}
                        </Button>
                      ))}
                    </div>
                    <Select value={balanceSort} onValueChange={v => setBalanceSort(v as typeof balanceSort)}>
                      <SelectTrigger className="h-7 w-[120px] text-[11px]" data-testid="balance-sort">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debt">По долгу ↑</SelectItem>
                        <SelectItem value="overpaid">По балансу ↓</SelectItem>
                        <SelectItem value="name">По имени</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {filteredSortedStudents.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                      <Users className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      {balanceFilter === "debtors" ? "Должников нет" : balanceFilter === "overpaid" ? "Нет переплат" : "Нет учеников"}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {balanceFilter === "debtors" && totalDebt > 0 && (
                      <div className="flex items-center justify-between px-1 mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground shrink-0">Общий долг учеников</span>
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 shrink-0">{moneyRub(totalDebt)}</Badge>
                        </div>
                        <button
                          onClick={() => {
                            const list = filteredSortedStudents
                              .filter(s => s.effectiveBalance < 0 && s.isActive)
                              .map<ReminderStudentData>(s => ({
                                student: s,
                                effectiveBalance: s.effectiveBalance,
                                unpaidLessonsCount: s.unpaidLessonsCount,
                                unpaidDebt: s.unpaidDebt,
                                lessonsThisMonth: s.lessonsThisMonth,
                                monthlyCost: s.monthlyCost,
                                paidThisMonth: s.paidThisMonth,
                              }));
                            if (list.length === 0) return;
                            setReminderList(list);
                            setReminderStartIndex(0);
                            setReminderOpen(true);
                          }}
                          className="h-7 px-2.5 flex items-center gap-1 rounded-lg border border-blue-500/40 text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 text-[11px] font-medium transition-colors shrink-0"
                          data-testid="button-remind-all-debtors"
                        >
                          <MessageCircle className="h-3 w-3" />
                          Сообщить должникам
                        </button>
                      </div>
                    )}
                    {balanceFilter === "overpaid" && totalOverpaid > 0 && (
                      <div className="flex items-center justify-between px-1 mb-2">
                        <span className="text-xs text-muted-foreground">Общая переплата</span>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">{moneyRub(totalOverpaid)}</Badge>
                      </div>
                    )}
                    <AnimatePresence>
                      {filteredSortedStudents.map((s) => {
                        const isExpanded = expandedStudentId === s.id;
                        return (
                          <motion.div
                            key={s.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            data-testid={`student-balance-${s.id}`}
                          >
                            <div
                              className={cn(
                                "flex items-center gap-3 rounded-xl border p-3 transition-colors cursor-pointer hover:bg-accent/30",
                                s.effectiveBalance < 0
                                  ? "border-red-500/20 bg-red-500/5"
                                  : s.effectiveBalance > 0
                                  ? "border-emerald-500/20 bg-emerald-500/5"
                                  : "border-border/50 bg-background/60",
                                isExpanded && "rounded-b-none border-b-0"
                              )}
                              onClick={() => setExpandedStudentId(isExpanded ? null : s.id)}
                            >
                              <div className={cn("flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-white text-xs font-semibold shrink-0", getAvatarColor(s.name))}>
                                {getInitials(s.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="truncate text-sm font-medium flex items-center gap-1.5">
                                  {s.name}
                                  {!s.isActive && <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">В архиве</span>}
                                </div>
                                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                                  <span>{s.subject} · {moneyRub(s.pricePerLesson)}/ур.</span>
                                  {s.lessonsThisMonth > 0 && <span>{s.lessonsThisMonth} ур./мес.</span>}
                                  {s.unpaidLessonsCount > 0 && s.effectiveBalance < 0 && (
                                    <span className="text-red-600 font-medium">{s.unpaidLessonsCount} неопл.</span>
                                  )}
                                  {s.lastPayment ? (
                                    <span>опл. {formatDistanceToNow(s.lastPayment.createdAt, { locale: ru, addSuffix: true })}</span>
                                  ) : (
                                    <span className="text-amber-500">нет оплат</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0 flex items-center gap-2">
                                <div>
                                  <div className={cn(
                                    "text-sm font-bold",
                                    s.effectiveBalance < 0 ? "text-red-600" : s.effectiveBalance > 0 ? "text-emerald-600" : "text-muted-foreground"
                                  )}>
                                    {s.effectiveBalance > 0 ? "+" : ""}{moneyRub(s.effectiveBalance)}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    опл. {moneyRub(s.totalPaid)} · расх. {moneyRub(s.totalLessonsCost)}
                                  </div>
                                </div>
                                <button
                                  disabled={!s.isActive}
                                  className={cn(
                                    "h-7 px-2.5 flex items-center gap-1 rounded-lg border text-[11px] font-medium transition-colors shrink-0",
                                    s.isActive
                                      ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/8 hover:bg-emerald-500/15"
                                      : "border-border/30 text-muted-foreground/40 bg-muted/30 cursor-not-allowed"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!s.isActive) return;
                                    setExpandedStudentId(s.id);
                                  }}
                                  title={s.isActive ? "Внести оплату" : "Ученик в архиве — изменение баланса недоступно"}
                                >
                                  <Plus className="h-3 w-3" />
                                  <span className="hidden sm:inline">Оплата</span>
                                </button>
                                <button
                                  disabled={!s.isActive}
                                  className={cn(
                                    "h-7 px-2.5 flex items-center gap-1 rounded-lg border text-[11px] font-medium transition-colors shrink-0",
                                    s.isActive
                                      ? "border-amber-500/30 text-amber-600 bg-amber-500/8 hover:bg-amber-500/15"
                                      : "border-border/30 text-muted-foreground/40 bg-muted/30 cursor-not-allowed"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!s.isActive) return;
                                    setExpandedStudentId(s.id);
                                    openEditBalance(s.id, s.effectiveBalance, e);
                                  }}
                                  title={s.isActive ? "Редактировать баланс" : "Ученик в архиве — изменение баланса недоступно"}
                                  data-testid={`button-edit-balance-row-${s.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                  <span className="hidden sm:inline">Баланс</span>
                                </button>
                                {(() => {
                                  const last = (void remindersVersion, getLastReminder(s.id));
                                  const daysAgo = last ? Math.floor((Date.now() - new Date(last.at).getTime()) / 86400000) : null;
                                  const tooltip = last
                                    ? `Последнее напоминание ${daysAgo === 0 ? "сегодня" : daysAgo === 1 ? "вчера" : `${daysAgo} дн. назад`} (${last.channel})`
                                    : "Написать родителям";
                                  return (
                                    <button
                                      className={cn(
                                        "h-7 px-2.5 flex items-center gap-1 rounded-lg border text-[11px] font-medium transition-colors shrink-0",
                                        s.effectiveBalance < 0
                                          ? "border-blue-500/40 text-blue-600 bg-blue-500/10 hover:bg-blue-500/20"
                                          : "border-blue-500/30 text-blue-600 bg-blue-500/8 hover:bg-blue-500/15"
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const data: ReminderStudentData = {
                                          student: s,
                                          effectiveBalance: s.effectiveBalance,
                                          unpaidLessonsCount: s.unpaidLessonsCount,
                                          unpaidDebt: s.unpaidDebt,
                                          lessonsThisMonth: s.lessonsThisMonth,
                                          monthlyCost: s.monthlyCost,
                                          paidThisMonth: s.paidThisMonth,
                                        };
                                        setReminderList([data]);
                                        setReminderStartIndex(0);
                                        setReminderOpen(true);
                                      }}
                                      title={tooltip}
                                      data-testid={`button-parent-reminder-${s.id}`}
                                    >
                                      <MessageCircle className="h-3 w-3" />
                                      <span className="hidden sm:inline">Написать</span>
                                      {last && daysAgo !== null && daysAgo < 7 && (
                                        <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                      )}
                                    </button>
                                  );
                                })()}
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                              </div>
                            </div>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className={cn(
                                    "rounded-b-xl border border-t-0 px-3 pb-3 pt-2 space-y-3",
                                    s.effectiveBalance < 0 ? "border-red-500/20 bg-red-500/3" : s.effectiveBalance > 0 ? "border-emerald-500/20 bg-emerald-500/3" : "border-border/50 bg-background/40"
                                  )}>
                                    <div className="flex items-center justify-between rounded-lg bg-background/80 border border-border/30 px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <Wallet className="h-4 w-4 text-primary/60" />
                                        <div>
                                          <div className="text-xs font-medium">Баланс ученика</div>
                                          <div className="text-[10px] text-muted-foreground">
                                            Внесено {moneyRub(s.totalPaid)} · Израсходовано {moneyRub(s.totalLessonsCost)}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className={cn("text-sm font-bold", s.effectiveBalance < 0 ? "text-red-600" : s.effectiveBalance > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                                          {s.effectiveBalance > 0 ? "+" : ""}{moneyRub(s.effectiveBalance)}
                                        </span>
                                        <button
                                          onClick={(e) => openEditBalance(s.id, s.effectiveBalance, e)}
                                          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                                          title="Редактировать баланс"
                                          data-testid={`button-edit-balance-${s.id}`}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* ── Форма прямого редактирования баланса ── */}
                                    <AnimatePresence>
                                      {editBalanceStudentId === s.id && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: "auto", opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.15 }}
                                          className="overflow-hidden"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
                                            <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                              <Pencil className="h-3 w-3" /> Установить баланс напрямую
                                            </div>
                                            <div className="text-[10px] text-muted-foreground leading-snug">
                                              Введите нужный баланс (может быть отрицательным). Будет создан корректирующий платёж.
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="relative flex-1">
                                                <input
                                                  type="number"
                                                  className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/40 pr-6"
                                                  placeholder="Новый баланс, ₽"
                                                  value={editBalanceValue}
                                                  onChange={e => setEditBalanceValue(e.target.value)}
                                                  onKeyDown={e => { if (e.key === "Enter") submitSetBalance(s.id); if (e.key === "Escape") setEditBalanceStudentId(null); }}
                                                  autoFocus
                                                  data-testid={`input-edit-balance-${s.id}`}
                                                />
                                              </div>
                                              <Button
                                                size="sm"
                                                className="h-8 text-[11px] px-3 gap-1 bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                                                disabled={editBalanceSubmitting}
                                                onClick={() => submitSetBalance(s.id)}
                                                data-testid={`button-confirm-edit-balance-${s.id}`}
                                              >
                                                {editBalanceSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3" />Сохранить</>}
                                              </Button>
                                              <button
                                                className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors shrink-0"
                                                onClick={() => setEditBalanceStudentId(null)}
                                                data-testid={`button-cancel-edit-balance-${s.id}`}
                                              >
                                                <X className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                            {editBalanceValue !== "" && !isNaN(parseInt(editBalanceValue, 10)) && parseInt(editBalanceValue, 10) !== s.effectiveBalance && (
                                              <div className="text-[10px] text-muted-foreground">
                                                Изменение: <strong className={parseInt(editBalanceValue, 10) - s.effectiveBalance > 0 ? "text-emerald-600" : "text-red-500"}>
                                                  {parseInt(editBalanceValue, 10) - s.effectiveBalance > 0 ? "+" : ""}{moneyRub(parseInt(editBalanceValue, 10) - s.effectiveBalance)}
                                                </strong>
                                              </div>
                                            )}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>

                                    {/* ── Быстрая встроенная форма оплаты ── */}
                                    <div
                                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2.5"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                        <Plus className="h-3 w-3" /> Внести оплату
                                      </div>

                                      {/* Пресеты суммы */}
                                      <div className="flex flex-wrap gap-1.5">
                                        {[1, 4, 8].map(n => {
                                          const preset = s.pricePerLesson * n;
                                          const isActive = getInlineAmount(s.id, s.pricePerLesson) === preset;
                                          return (
                                            <button
                                              key={n}
                                              className={cn(
                                                "px-2.5 py-1 text-[11px] rounded-lg border transition-colors font-medium",
                                                isActive
                                                  ? "bg-emerald-500 text-white border-emerald-500"
                                                  : "border-border bg-background hover:bg-accent text-foreground"
                                              )}
                                              onClick={() => setInlineAmounts(prev => ({ ...prev, [s.id]: preset }))}
                                            >
                                              {n === 1 ? "1 ур." : `${n} ур.`} · {moneyRub(preset)}
                                            </button>
                                          );
                                        })}
                                        <input
                                          type="number"
                                          className="w-24 px-2 py-1 text-[11px] border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                                          placeholder="Своя сумма"
                                          value={
                                            [1, 4, 8].some(n => getInlineAmount(s.id, s.pricePerLesson) === s.pricePerLesson * n)
                                              ? ""
                                              : getInlineAmount(s.id, s.pricePerLesson) || ""
                                          }
                                          onChange={e => setInlineAmounts(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                                        />
                                      </div>

                                      {/* Метод оплаты */}
                                      <div className="flex gap-1.5 flex-wrap">
                                        {["перевод", "карта", "наличные", "СБП"].map(m => (
                                          <button
                                            key={m}
                                            className={cn(
                                              "px-2.5 py-1 text-[11px] rounded-lg border transition-colors capitalize",
                                              getInlineMethod(s.id) === m
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "border-border bg-background hover:bg-accent text-muted-foreground"
                                            )}
                                            onClick={() => setInlineMethods(prev => ({ ...prev, [s.id]: m }))}
                                          >
                                            {m}
                                          </button>
                                        ))}
                                      </div>

                                      {/* Превью баланса + кнопка */}
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-[11px] text-muted-foreground">
                                          После:{" "}
                                          <strong className={cn(
                                            (s.effectiveBalance + getInlineAmount(s.id, s.pricePerLesson)) < 0
                                              ? "text-red-500"
                                              : "text-emerald-600"
                                          )}>
                                            {moneyRub(s.effectiveBalance + getInlineAmount(s.id, s.pricePerLesson))}
                                          </strong>
                                        </div>
                                        <Button
                                          size="sm"
                                          className="h-7 text-[11px] px-3 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
                                          disabled={inlineSubmitting === s.id || !s.isActive}
                                          title={!s.isActive ? "Ученик в архиве — изменение баланса недоступно" : undefined}
                                          onClick={() => submitInlinePayment(s.id, s.pricePerLesson)}
                                        >
                                          {inlineSubmitting === s.id
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : <><Check className="h-3 w-3" />Внести {moneyRub(getInlineAmount(s.id, s.pricePerLesson))}</>
                                          }
                                        </Button>
                                      </div>
                                    </div>

                                    {s.unpaidLessonsCount > 0 && s.effectiveBalance < 0 && (
                                      <>
                                        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                          <Clock className="h-3 w-3" />
                                          Занятия в долг ({s.unpaidLessonsCount})
                                          <span className="text-[10px] font-normal text-muted-foreground/60">— включая прошлые месяцы</span>
                                        </div>
                                        <div className="space-y-1.5">
                                          {s.unpaidLessons.map(lesson => {
                                              const cost = calcLessonCost(lesson, s);
                                              const lessonDate = new Date(lesson.scheduledAt);
                                              const isCurrentMonth = lessonDate >= startOfMonth;
                                              return (
                                                <div key={lesson.id} className={cn(
                                                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
                                                  isCurrentMonth
                                                    ? "bg-background/80 border-border/30"
                                                    : "bg-amber-500/5 border-amber-500/20"
                                                )}>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-medium flex items-center gap-1.5">
                                                      {format(lessonDate, "d MMM yyyy, HH:mm", { locale: ru })}
                                                      {!isCurrentMonth && (
                                                        <span className="text-[9px] font-semibold text-amber-600 bg-amber-500/15 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                                          прошлый мес.
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                      {lesson.durationMinutes || 60} мин · {moneyRub(cost)}
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                        </div>
                                        <div className="flex items-center justify-between text-xs px-1">
                                          <span className="text-muted-foreground">Итого долг</span>
                                          <span className="font-semibold text-red-600">{moneyRub(calcActualDebt(s.effectiveBalance))}</span>
                                        </div>
                                      </>
                                    )}

                                    {s.unpaidLessonsCount > 0 && s.effectiveBalance >= 0 && (
                                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                                        <Check className="h-3 w-3 text-emerald-500" />
                                        {s.unpaidLessonsCount === 1
                                          ? `1 занятие без прямой оплаты — покрыто балансом`
                                          : `${s.unpaidLessonsCount} занятия без прямой оплаты — покрыты балансом`}
                                      </div>
                                    )}

                                    {s.unpaidLessonsCount === 0 && (
                                      <div className="text-xs text-emerald-600 flex items-center gap-1.5 py-1">
                                        <Check className="h-3 w-3" />
                                        Все занятия этого ученика оплачены
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ─── LAST PAYMENTS ─── */}
            <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Последние платежи
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {payments.length} всего
                  </Badge>
                </div>
                {pendingReceiptsCount > 0 && (
                  <div
                    className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3"
                    data-testid="banner-pending-receipts"
                  >
                    <Receipt className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs flex-1">
                      <div className="font-medium text-amber-700 dark:text-amber-400">
                        {pluralizePayments(pendingReceiptsCount)} без чека «Мой налог»
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        Для самозанятых чек обязателен (422-ФЗ). Нажмите «Чек» у платежа, чтобы оформить.
                      </div>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {sortedPayments.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                      <CreditCard className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">Платежей пока нет</p>
                    <Button className="mt-4 gap-2" size="sm" onClick={() => setShowPaymentDialog(true)}>
                      <Plus className="h-3 w-3" />
                      Внести первый платёж
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {displayPayments.map((p, idx) => {
                        const student = students.find(s => s.id === p.studentId);
                        const isAutoPayment = p.comment?.includes("[lesson:");
                        const isCorrection = p.comment?.includes("[correction]");
                        const receiptDone = isReceiptIssued(p.id);
                        const canIssueReceipt = p.amount > 0 && !isCorrection;
                        void receiptsVersion;
                        return (
                          <motion.div
                            key={p.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/60 p-3 hover:bg-accent/30 transition-colors"
                          >
                            <div className={cn("flex h-10 w-10 items-center justify-center rounded-full shrink-0", isCorrection ? "bg-amber-500/10" : isAutoPayment ? "bg-blue-500/10" : "bg-emerald-500/10")}>
                              {isCorrection ? <Pencil className="w-4 h-4 text-amber-500" /> : isAutoPayment ? <Check className="w-4 h-4 text-blue-500" /> : methodIcon(p.method)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{student?.name || "—"}</span>
                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", isCorrection ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : isAutoPayment ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "")}>
                                  {isCorrection ? "Коррекция" : isAutoPayment ? "Авто" : methodLabel(p.method)}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {format(p.createdAt, "d MMMM yyyy, HH:mm", { locale: ru })}
                                {p.comment && !isAutoPayment && !isCorrection && <span className="ml-1">· {p.comment}</span>}
                                {isCorrection && <span className="ml-1">· {p.comment?.replace("[correction] ", "")}</span>}
                              </div>
                            </div>
                            <div className={cn("text-sm font-bold shrink-0", p.amount < 0 ? "text-red-500" : "text-emerald-600")}>
                              {p.amount >= 0 ? "+" : ""}{moneyRub(p.amount)}
                            </div>
                            {canIssueReceipt && (
                              <button
                                className={cn(
                                  "h-7 px-2 flex items-center gap-1 rounded-md text-[11px] font-medium transition-colors shrink-0 border",
                                  receiptDone
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15"
                                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15"
                                )}
                                onClick={() => setReceiptPayment(p)}
                                title={receiptDone ? "Чек выдан — открыть" : "Сформировать чек «Мой налог»"}
                                aria-label={receiptDone ? `Чек выдан для платежа ${moneyRub(p.amount)} от ${student?.name || ""}` : `Сформировать чек Мой налог для платежа ${moneyRub(p.amount)} от ${student?.name || ""}`}
                                data-testid={`button-receipt-${p.id}`}
                              >
                                {receiptDone ? <Check className="h-3 w-3" /> : <Receipt className="h-3 w-3" />}
                                <span className="hidden sm:inline">{receiptDone ? "Чек" : "Чек"}</span>
                              </button>
                            )}
                            <button
                              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                              onClick={() => handleDeletePayment(p.id)}
                              disabled={deletingPaymentId === p.id}
                              title="Удалить платёж"
                            >
                              {deletingPaymentId === p.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {sortedPayments.length > 8 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full gap-1 text-xs text-muted-foreground"
                        onClick={() => setShowAllPayments(!showAllPayments)}
                      >
                        {showAllPayments ? (
                          <><ChevronUp className="h-3 w-3" />Свернуть</>
                        ) : (
                          <><ChevronDown className="h-3 w-3" />Показать все ({sortedPayments.length})</>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── RIGHT COLUMN: SUMMARY + FORECAST ─── */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Сводка за {format(startOfMonth, "LLLL", { locale: ru })}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-0">
                {[
                  {
                    label: "📅 Всего занятий запланировано",
                    value: String(allMonthLessons.length),
                    color: "",
                    hint: "Все занятия в этом месяце, включая прошедшие и будущие",
                  },
                  {
                    label: "✅ Проведено с оплатой",
                    value: `${paidMonthLessons.length} → ${moneyRub(paidMonthEarned)}`,
                    color: "text-emerald-600",
                    hint: "Занятия состоялись и помечены как оплаченные. Платёж создан автоматически.",
                  },
                  {
                    label: "⏳ Проведено, ждёт оплаты",
                    value: `${unpaidMonthLessons.length} → ${moneyRub(monthUnpaidDebt)}`,
                    color: "text-amber-600",
                    hint: "Занятия проведены, но ещё не оплачены. Нажмите на ученика в списке → «Оплачено».",
                  },
                  {
                    label: "🔕 Отменено с оплатой",
                    value: `${cancelledPaidLessons.length} → ${moneyRub(cancelledPaidEarned)}`,
                    color: "text-blue-600",
                    hint: "Отмены, за которые ученик всё равно заплатил (штраф за поздний отказ и т.п.)",
                  },
                  {
                    label: "❌ Отменено без оплаты",
                    value: `${cancelledFreeLessons.length} → ${moneyRub(lostIncome)}`,
                    color: "text-red-500",
                    hint: "Занятия не состоялись и оплата не поступила — это упущенный доход.",
                  },
                  {
                    label: "🕐 Ещё предстоит",
                    value: `${pendingMonthLessons.length} → ${moneyRub(pendingIncome)}`,
                    color: "text-muted-foreground",
                    hint: "Будущие занятия до конца месяца, которые ещё не проведены.",
                  },
                ].map((row, i) => (
                  <div key={i}>
                    {i > 0 && <Separator />}
                    <div className="py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className={cn("text-sm font-semibold tabular-nums", row.color)} data-testid={`summary-row-${i}`}>{row.value}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">{row.hint}</div>
                    </div>
                  </div>
                ))}

                <Separator />
                <div className="py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">💰 Поступления за месяц</span>
                    <span className="text-sm font-semibold text-blue-600">{moneyRub(monthlyPaymentsTotal)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">Сумма всех платежей (авто + ручные), поступивших в этом месяце.</div>
                </div>
                <Separator />
                <div className="py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">📊 Ср. цена урока</span>
                    <span className="text-sm font-semibold">{moneyRub(avgLessonPrice)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">Средняя стоимость 1 урока по всем ученикам.</div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-blue-500/5 to-blue-500/5">
              <CardContent className="pt-5 pb-5">
                <div className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Прогноз на {format(startOfMonth, "LLLL", { locale: ru })}
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Максимум (если все состоятся)</span>
                      <span className="text-sm font-bold text-blue-600" data-testid="stat-month-goal">{moneyRub(monthGoal)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">Сумма всех занятий месяца без отмен</div>
                    <div className="w-full bg-muted/50 rounded-full h-2 mt-1.5">
                      <div className="bg-blue-500/40 h-2 rounded-full transition-all" style={{ width: "100%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Реальный прогноз</span>
                      <span className="text-sm font-bold text-blue-600" data-testid="stat-forecast">{moneyRub(forecastMonth)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">Заработано + предстоящие (без учёта отмен)</div>
                    <div className="w-full bg-muted/50 rounded-full h-2 mt-1.5">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${monthGoal > 0 ? Math.min(100, (forecastMonth / monthGoal) * 100) : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Уже заработано</span>
                      <span className="text-sm font-bold text-emerald-600">{moneyRub(monthEarned)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">Все проведённые оплачиваемые занятия</div>
                    <div className="w-full bg-muted/50 rounded-full h-2 mt-1.5">
                      <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${monthGoal > 0 ? Math.min(100, (monthEarned / monthGoal) * 100) : 0}%` }} />
                    </div>
                  </div>

                  <Separator />

                  {monthEarned > monthlyPaymentsTotal && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2">
                      <TrendingDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-600">
                        Заработано {moneyRub(monthEarned)}, а поступило {moneyRub(monthlyPaymentsTotal)} — не хватает {moneyRub(monthEarned - monthlyPaymentsTotal)}.
                      </span>
                    </div>
                  )}
                  {monthEarned <= monthlyPaymentsTotal && monthlyPaymentsTotal > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs text-emerald-600">Все заработанные деньги получены — отлично!</span>
                    </div>
                  )}
                  {pendingIncome > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-2">
                      <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="text-xs text-blue-600">
                        Ещё {pluralLessons(pendingMonthLessons.length)} до конца месяца на сумму {moneyRub(pendingIncome)}.
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cancel Policy Settings Card */}
            <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Политика отмены занятий
                  </CardTitle>
                  {!cancelPolicyEdit && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setCancelPolicyEdit(true)} data-testid="button-edit-cancel-policy">
                      <Pencil className="h-3 w-3" /> Изменить
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {!cancelPolicyEdit ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Текущая политика:</span>
                      <Badge variant="outline" className="text-xs">
                        {cancelPolicy === 'free' ? '🎁 Бесплатная отмена' : cancelPolicy === 'fixed' ? `💰 Фиксированный штраф: ${cancelFee} ₽` : '👤 Индивидуальный штраф'}
                      </Badge>
                    </div>
                    {cancelPolicy === 'per_student' && cancelPolicyData && (
                      <div className="text-xs text-muted-foreground">
                        {cancelPolicyData.students.filter(s => s.cancelFee && s.cancelFee > 0).map(s => (
                          <span key={s.id} className="mr-3">{s.name}: {s.cancelFee} ₽</span>
                        ))}
                        {cancelPolicyData.students.filter(s => s.cancelFee && s.cancelFee > 0).length === 0 && (
                          <span className="text-amber-600">Нет настроенных штрафов — добавьте их</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Тип политики</Label>
                      <div className="flex flex-col gap-2">
                        {([
                          { value: 'free', label: 'Бесплатная отмена', desc: 'Студент не платит при отмене занятия' },
                          { value: 'fixed', label: 'Фиксированный штраф', desc: 'Одинаковая сумма для всех учеников' },
                          { value: 'per_student', label: 'Индивидуальный штраф', desc: 'Своя ставка для каждого ученика' },
                        ] as const).map(opt => (
                          <label key={opt.value} className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors", cancelPolicy === opt.value ? "border-primary/50 bg-primary/5" : "border-border/50 hover:bg-muted/30")}>
                            <input type="radio" name="cancelPolicy" value={opt.value} checked={cancelPolicy === opt.value} onChange={() => setCancelPolicy(opt.value)} className="mt-0.5 accent-primary" data-testid={`radio-policy-${opt.value}`} />
                            <div>
                              <div className="text-sm font-medium">{opt.label}</div>
                              <div className="text-xs text-muted-foreground">{opt.desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {cancelPolicy === 'fixed' && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Сумма штрафа (₽)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={cancelFee}
                          onChange={e => setCancelFee(Number(e.target.value))}
                          className="h-9 max-w-[180px]"
                          placeholder="500"
                          data-testid="input-cancel-fee"
                        />
                      </div>
                    )}

                    {cancelPolicy === 'per_student' && cancelPolicyData && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Штрафы по ученикам (₽, 0 = бесплатно)</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {cancelPolicyData.students.map(s => (
                            <div key={s.id} className="flex items-center gap-2">
                              <span className="text-xs w-32 truncate">{s.name}</span>
                              <Input
                                type="number"
                                min={0}
                                value={studentCancelFees[s.id] ?? 0}
                                onChange={e => setStudentCancelFees(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                                className="h-8 w-28 text-xs"
                                placeholder="0"
                                data-testid={`input-student-fee-${s.id}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={saveCancelPolicy} disabled={savingCancelPolicy} className="h-8 text-xs" data-testid="button-save-cancel-policy">
                        {savingCancelPolicy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                        Сохранить
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setCancelPolicyEdit(false)} className="h-8 text-xs" data-testid="button-cancel-policy-edit">
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Внести оплату
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Ученик */}
            <div>
              <Label>Ученик</Label>
              <Select
                value={selectedStudentId || students[0]?.id || ""}
                onValueChange={handleSelectStudentForDialog}
              >
                <SelectTrigger className="mt-1" data-testid="payment-student">
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {[...students].filter(s => s.isActive).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru")).map((s) => {
                    const sData = studentFinanceData.find(sd => sd.id === s.id);
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span>{s.name}</span>
                          <span className={cn("text-xs", (sData?.effectiveBalance ?? 0) < 0 ? "text-red-500" : "text-muted-foreground")}>
                            ({moneyRub(sData?.effectiveBalance ?? 0)})
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Сумма — пресеты + ввод */}
            <div>
              <Label>Сумма</Label>
              {(() => {
                const selStudent = students.find(s => s.id === (selectedStudentId || students[0]?.id));
                return selStudent ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[1, 4, 8].map(n => {
                      const preset = selStudent.pricePerLesson * n;
                      return (
                        <button
                          key={n}
                          type="button"
                          className={cn(
                            "px-2.5 py-1.5 text-xs rounded-lg border transition-colors font-medium",
                            paymentAmount === preset
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border bg-background hover:bg-accent"
                          )}
                          onClick={() => setPaymentAmount(preset)}
                        >
                          {n === 1 ? "1 ур." : `${n} ур.`} · {moneyRub(preset)}
                        </button>
                      );
                    })}
                  </div>
                ) : null;
              })()}
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="mt-2 text-center text-lg font-semibold"
                data-testid="payment-amount"
              />
              {(() => {
                const sid = selectedStudentId || students[0]?.id;
                const s = studentFinanceData.find(sd => sd.id === sid);
                return s ? (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Сейчас: <strong className={s.effectiveBalance < 0 ? "text-red-500" : "text-emerald-500"}>{moneyRub(s.effectiveBalance)}</strong></span>
                    <span>→ После: <strong className={(s.effectiveBalance + paymentAmount) < 0 ? "text-red-500" : "text-emerald-500"}>{moneyRub(s.effectiveBalance + paymentAmount)}</strong></span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Способ — кнопки вместо Select */}
            <div>
              <Label>Способ оплаты</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {["перевод", "карта", "наличные", "СБП"].map(m => (
                  <button
                    key={m}
                    type="button"
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize font-medium",
                      paymentMethod === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-background hover:bg-accent text-muted-foreground"
                    )}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Комментарий */}
            <div>
              <Label>Комментарий <span className="text-muted-foreground font-normal">(необязательно)</span></Label>
              <Input
                value={paymentComment}
                onChange={(e) => setPaymentComment(e.target.value)}
                placeholder="За 2 занятия..."
                className="mt-1"
                data-testid="payment-comment"
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={addPayment}
              disabled={createPayment.isPending}
              data-testid="payment-submit"
            >
              <Check className="h-4 w-4" />
              {createPayment.isPending ? "Добавление..." : `Внести ${moneyRub(paymentAmount)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Online Payment Dialog */}
      <Dialog open={showOnlinePayDialog} onOpenChange={open => { setShowOnlinePayDialog(open); if (!open) setOnlinePayLink(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Онлайн-оплата через ЮКассу
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!onlinePayLink ? (
              <>
                <div className="text-sm text-muted-foreground">
                  Ссылка на оплату будет создана в ЮКассе. Отправьте её ученику любым удобным способом.
                </div>
                <div className="space-y-1.5">
                  <Label>Ученик</Label>
                  <Select value={onlinePayStudentId} onValueChange={id => {
                    setOnlinePayStudentId(id);
                    const s = students.find(st => st.id === id);
                    if (s) setOnlinePayAmount(s.pricePerLesson * 4);
                  }}>
                    <SelectTrigger data-testid="online-pay-student">
                      <SelectValue placeholder="Выберите ученика" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.filter(s => s.isActive).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Сумма, ₽</Label>
                  {(() => {
                    const s = students.find(st => st.id === onlinePayStudentId);
                    return s ? (
                      <div className="flex gap-1.5 flex-wrap mb-1.5">
                        {[1,2,4,8].map(n => {
                          const preset = s.pricePerLesson * n;
                          return (
                            <button key={n} type="button"
                              className={cn("px-2.5 py-1 text-xs rounded-lg border transition-colors",
                                onlinePayAmount === preset ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:bg-accent text-muted-foreground"
                              )}
                              onClick={() => setOnlinePayAmount(preset)}
                            >{n === 1 ? "1 ур." : `${n} ур.`} · {moneyRub(preset)}</button>
                          );
                        })}
                      </div>
                    ) : null;
                  })()}
                  <Input
                    type="number"
                    value={onlinePayAmount}
                    onChange={e => setOnlinePayAmount(Number(e.target.value))}
                    className="text-center text-lg font-semibold"
                    data-testid="online-pay-amount"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Назначение платежа <span className="text-muted-foreground font-normal">(необязательно)</span></Label>
                  <Input
                    value={onlinePayDesc}
                    onChange={e => setOnlinePayDesc(e.target.value)}
                    placeholder="Оплата за занятия по математике..."
                    data-testid="online-pay-desc"
                  />
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={requestOnlinePayment}
                  disabled={onlinePayPending || !onlinePayStudentId || !onlinePayAmount}
                  data-testid="online-pay-submit"
                >
                  {onlinePayPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {onlinePayPending ? "Создаём ссылку..." : `Создать ссылку на ${moneyRub(onlinePayAmount)}`}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center space-y-2">
                  <div className="text-emerald-600 font-semibold">Ссылка создана!</div>
                  <div className="text-sm text-muted-foreground">Отправьте эту ссылку ученику. После оплаты баланс обновится автоматически.</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs break-all text-muted-foreground font-mono">
                  {onlinePayLink}
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={() => { navigator.clipboard.writeText(onlinePayLink!); toast.success("Ссылка скопирована"); }} variant="outline">
                    Скопировать
                  </Button>
                  <Button className="flex-1 gap-2" asChild>
                    <a href={onlinePayLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Открыть
                    </a>
                  </Button>
                </div>
                <Button variant="ghost" className="w-full" onClick={() => setShowOnlinePayDialog(false)}>Закрыть</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Экспорт финансов
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Выгрузка платежей за выбранный период для отчётности в&nbsp;«Мой налог»
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">С</Label>
                <Input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">По</Label>
                <Input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => {
                const filtered = {
                  lessons: lessons.filter(l => new Date(l.scheduledAt) >= new Date(exportFrom) && new Date(l.scheduledAt) <= new Date(exportTo + 'T23:59:59')),
                  payments: payments.filter(p => new Date(p.createdAt) >= new Date(exportFrom) && new Date(p.createdAt) <= new Date(exportTo + 'T23:59:59')),
                };
                exportFinanceToExcel(filtered.lessons, students, filtered.payments);
                setShowExportDialog(false);
              }}>
                <Download className="h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={() => {
                window.open(`/api/finance/export?from=${exportFrom}&to=${exportTo}`, '_blank');
                setShowExportDialog(false);
              }}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SamozanyatyReceiptDialog
        open={!!receiptPayment}
        onOpenChange={(o) => { if (!o) setReceiptPayment(null); }}
        payment={receiptPayment}
        student={receiptPayment ? students.find(s => s.id === receiptPayment.studentId) ?? null : null}
        tutor={user ? { name: user.name } : null}
      />

      <PaymentReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        students={reminderList}
        startIndex={reminderStartIndex}
        tutorName={user?.name || ""}
      />
    </DashboardLayout>
  );
}
