import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { ru } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Wallet,
  CreditCard,
  Calendar,
  Clock,
  Banknote,
  ArrowUpRight,
  Receipt,
  CalendarDays,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Info,
  XCircle,
  PiggyBank,
  ArrowDownLeft,
  BarChart3,
  TrendingUp,
  Zap,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  comment?: string;
  createdAt: string;
}

interface StudentFinanceProps {
  student: {
    balance: number;
    pricePerLesson: number;
    name: string;
    receiptEmail?: string | null;
  };
  lessons: any[];
  payments: PaymentRecord[];
}

function moneyRub(amount: number) {
  const sign = amount < 0 ? "−" : "";
  const v = Math.abs(amount);
  return `${sign}${v.toLocaleString("ru-RU")} ₽`;
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
  if (n % 10 === 1 && n % 100 !== 11) return "занятие";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "занятия";
  return "занятий";
}

const AMOUNT_PRESETS = [1000, 2000, 3000, 5000];

export default function StudentFinance({ student, lessons, payments }: StudentFinanceProps) {
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showUnpaidLessons, setShowUnpaidLessons] = useState(false);
  const [showPaidLessons, setShowPaidLessons] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payEmail, setPayEmail] = useState(student.receiptEmail || "");
  const [payError, setPayError] = useState("");

  const payMutation = useMutation({
    mutationFn: async ({ amount, receiptEmail }: { amount: number; receiptEmail?: string }) => {
      const res = await apiRequest("POST", "/api/student/payment/create", { amount, receiptEmail });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
      }
    },
    onError: (err: any) => {
      setPayError(err.message || "Ошибка оплаты");
    },
  });

  const handlePay = () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt < 100) {
      setPayError("Минимальная сумма — 100 ₽");
      return;
    }
    if (!payEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payEmail)) {
      setPayError("Введите корректный email для чека");
      return;
    }
    setPayError("");
    payMutation.mutate({ amount: amt, receiptEmail: payEmail });
  };

  const calcCost = (l: any) => {
    const dur = l.durationMinutes || 60;
    return Math.round(student.pricePerLesson * dur / 60);
  };

  const completedLessons = useMemo(
    () => lessons.filter(l => l.status === "completed"),
    [lessons]
  );

  const paidLessons = useMemo(
    () => completedLessons
      .filter(l => l.attendance === "attended")
      .sort((a: any, b: any) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [completedLessons]
  );

  const unpaidLessons = useMemo(
    () => completedLessons
      .filter(l => l.attendance === "attended_unpaid")
      .sort((a: any, b: any) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [completedLessons]
  );

  const totalPaidLessonsCost = paidLessons.reduce((s: number, l: any) => s + calcCost(l), 0);
  const totalUnpaidCost = unpaidLessons.reduce((s: number, l: any) => s + calcCost(l), 0);

  const manualPayments = useMemo(
    () => payments.filter(p => !p.comment?.includes("[lesson:")),
    [payments]
  );

  const totalDeposited = manualPayments.reduce((s, p) => s + p.amount, 0);

  const isBillable = (l: any) =>
    (l.status === "completed" && ["attended", "attended_unpaid", "missed_paid"].includes(l.attendance || "")) ||
    (l.status === "cancelled" && l.attendance === "missed_paid");

  const totalAllPayments = payments.reduce((s, p) => s + p.amount, 0);
  const totalBillableCost = useMemo(
    () => lessons.filter(isBillable).reduce((s: number, l: any) => s + calcCost(l), 0),
    [lessons]
  );

  const freeBalance = totalAllPayments - totalBillableCost;

  const lessonsLeft = student.pricePerLesson > 0
    ? Math.max(0, Math.floor(freeBalance / student.pricePerLesson))
    : 0;

  const now = new Date();

  const upcomingLessons = useMemo(
    () => lessons.filter(l => {
      const d = new Date(l.scheduledAt);
      return d > now && l.status !== "cancelled" && l.status !== "completed";
    }),
    [lessons]
  );

  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);

  const upcomingThisWeek = useMemo(
    () => upcomingLessons.filter(l => {
      const d = new Date(l.scheduledAt);
      return isWithinInterval(d, { start: now, end: thisWeekEnd });
    }),
    [upcomingLessons, thisWeekEnd]
  );

  const upcomingThisMonth = useMemo(
    () => upcomingLessons.filter(l => {
      const d = new Date(l.scheduledAt);
      return isWithinInterval(d, { start: now, end: thisMonthEnd });
    }),
    [upcomingLessons, thisMonthEnd]
  );

  const completedThisWeek = useMemo(
    () => completedLessons.filter(l => {
      const d = new Date(l.scheduledAt);
      return isWithinInterval(d, { start: thisWeekStart, end: now });
    }),
    [completedLessons, thisWeekStart]
  );

  const completedThisMonth = useMemo(
    () => completedLessons.filter(l => {
      const d = new Date(l.scheduledAt);
      return isWithinInterval(d, { start: thisMonthStart, end: now });
    }),
    [completedLessons, thisMonthStart]
  );

  const weekCostToClose = upcomingThisWeek.reduce((s: number, l: any) => s + calcCost(l), 0);
  const monthCostToClose = upcomingThisMonth.reduce((s: number, l: any) => s + calcCost(l), 0);

  const sortedDeposits = useMemo(
    () => [...manualPayments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [manualPayments]
  );

  const displayPayments = showAllPayments ? sortedDeposits : sortedDeposits.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Финансы</h1>
        <p className="text-muted-foreground mt-1">Баланс, занятия и оплата</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-blue-500/5 border border-blue-500/10 px-4 py-2.5">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Баланс</span> — свободные деньги на вашем счёте (внесённые оплаты минус стоимость проведённых занятий). Положительный — есть предоплата. Отрицательный — долг. Уточните у репетитора.{" "}
          <a href="/student/help" className="text-primary underline underline-offset-2 hover:no-underline font-medium">Подробнее →</a>
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={cn(
          "rounded-2xl border-2",
          freeBalance < 0
            ? "border-red-500/30 bg-gradient-to-br from-red-500/10 to-orange-500/5"
            : freeBalance === 0
            ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5"
            : "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/5"
        )}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <PiggyBank className="w-5 h-5" />
                  <span className="text-sm font-medium">Текущий баланс</span>
                </div>
                <div className={cn("text-4xl font-bold", freeBalance < 0 ? "text-red-600" : freeBalance === 0 ? "text-amber-600" : "text-emerald-600")}>
                  {moneyRub(freeBalance)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {freeBalance < 0 ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-xs font-medium text-red-600">Долг — нужно пополнить</span>
                    </div>
                  ) : freeBalance === 0 ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-medium text-amber-600">Баланс нулевой</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600">
                        Хватит на {lessonsLeft} {pluralLessons(lessonsLeft)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right space-y-2 shrink-0">
                <div className="hidden sm:block text-right space-y-1">
                  <div className="text-xs text-muted-foreground">Стоимость занятия</div>
                  <div className="text-xl font-bold text-blue-600">{moneyRub(student.pricePerLesson)}</div>
                  <div className="text-[10px] text-muted-foreground">за 60 мин</div>
                </div>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 w-full sm:w-auto"
                  onClick={() => { setPayDialog(true); setPayError(""); setPayAmount(""); }}
                  data-testid="button-pay-online"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Пополнить
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              Пополнение баланса
            </DialogTitle>
            <DialogDescription>
              Оплата картой через защищённую форму ЮКассы
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Сумма пополнения</label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {AMOUNT_PRESETS.map(p => (
                  <Button
                    key={p}
                    variant={payAmount === String(p) ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => setPayAmount(String(p))}
                    data-testid={`button-preset-${p}`}
                  >
                    {p.toLocaleString("ru-RU")} ₽
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                placeholder="Или введите сумму в рублях"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                min={100}
                data-testid="input-pay-amount"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">
                Email для уведомления об оплате
                {student.receiptEmail && (
                  <span className="ml-1.5 font-normal text-muted-foreground">(сохранён с прошлого раза)</span>
                )}
              </label>
              <Input
                type="email"
                placeholder="example@mail.ru"
                value={payEmail}
                onChange={e => setPayEmail(e.target.value)}
                data-testid="input-receipt-email"
                className={student.receiptEmail && payEmail === student.receiptEmail ? "border-emerald-500/50 bg-emerald-500/5" : ""}
              />
              {student.receiptEmail && payEmail === student.receiptEmail && (
                <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />Подтверждение придёт на этот адрес
                </p>
              )}
              {!student.receiptEmail && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Email будет сохранён для следующих оплат
                </p>
              )}
            </div>
            <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                <span className="font-semibold">Чек (квитанция)</span> — репетитор выдаёт его отдельно через приложение «Мой налог» как самозанятый. Уточните у репетитора.
              </p>
            </div>

            {payError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{payError}
              </p>
            )}
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
              onClick={handlePay}
              disabled={payMutation.isPending}
              data-testid="button-confirm-payment"
            >
              {payMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Создаём платёж...</>
              ) : (
                <><Zap className="h-4 w-4" />Оплатить {payAmount ? `${Number(payAmount).toLocaleString("ru-RU")} ₽` : ""}</>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              После оплаты вы вернётесь на эту страницу. Баланс обновится автоматически.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="rounded-xl border-border/50">
            <CardContent className="p-3 text-center">
              <ArrowDownLeft className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-emerald-600">{moneyRub(totalDeposited)}</div>
              <div className="text-[10px] text-muted-foreground">Всего внесено</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-xl border-border/50">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-600">{moneyRub(totalPaidLessonsCost)}</div>
              <div className="text-[10px] text-muted-foreground">Оплачено занятий</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="rounded-xl border-border/50 sm:hidden">
            <CardContent className="p-3 text-center">
              <Banknote className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-600">{moneyRub(student.pricePerLesson)}</div>
              <div className="text-[10px] text-muted-foreground">За занятие</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border/50 hidden sm:block">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 text-indigo-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-indigo-600">{upcomingLessons.length}</div>
              <div className="text-[10px] text-muted-foreground">Предстоит</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className={cn("rounded-xl", unpaidLessons.length > 0 ? "border-red-500/20" : "border-border/50")}>
            <CardContent className="p-3 text-center">
              <AlertCircle className={cn("h-4 w-4 mx-auto mb-1", unpaidLessons.length > 0 ? "text-red-500" : "text-muted-foreground")} />
              <div className={cn("text-lg font-bold", unpaidLessons.length > 0 ? "text-red-600" : "text-muted-foreground")}>
                {moneyRub(totalUnpaidCost)}
              </div>
              <div className="text-[10px] text-muted-foreground">Долг за занятия</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {(upcomingThisWeek.length > 0 || upcomingThisMonth.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="rounded-xl border-indigo-500/20 bg-indigo-500/5">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                Предстоящие расходы
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-background/60 border border-border/50 p-3">
                  <div className="text-xs text-muted-foreground mb-1">До конца недели</div>
                  <div className="text-lg font-bold text-indigo-600">
                    {upcomingThisWeek.length} {pluralLessons(upcomingThisWeek.length)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Нужно: <span className="font-semibold text-foreground">{moneyRub(weekCostToClose)}</span>
                  </div>
                  {freeBalance >= weekCostToClose && weekCostToClose > 0 ? (
                    <Badge className="bg-emerald-500 text-white text-[10px] mt-1">Хватит</Badge>
                  ) : weekCostToClose > 0 ? (
                    <Badge className="bg-red-500 text-white text-[10px] mt-1">Не хватает {moneyRub(weekCostToClose - freeBalance)}</Badge>
                  ) : null}
                </div>
                <div className="rounded-lg bg-background/60 border border-border/50 p-3">
                  <div className="text-xs text-muted-foreground mb-1">До конца месяца</div>
                  <div className="text-lg font-bold text-indigo-600">
                    {upcomingThisMonth.length} {pluralLessons(upcomingThisMonth.length)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Нужно: <span className="font-semibold text-foreground">{moneyRub(monthCostToClose)}</span>
                  </div>
                  {freeBalance >= monthCostToClose && monthCostToClose > 0 ? (
                    <Badge className="bg-emerald-500 text-white text-[10px] mt-1">Хватит</Badge>
                  ) : monthCostToClose > 0 ? (
                    <Badge className="bg-red-500 text-white text-[10px] mt-1">Не хватает {moneyRub(monthCostToClose - freeBalance)}</Badge>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card
            className="rounded-xl cursor-pointer hover:shadow-md transition-shadow border-emerald-500/20 bg-emerald-500/5"
            onClick={() => setShowPaidLessons(!showPaidLessons)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-emerald-600">{paidLessons.length}</div>
                <div className="text-xs text-muted-foreground">Оплаченных {pluralLessons(paidLessons.length)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">На сумму {moneyRub(totalPaidLessonsCost)}</div>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showPaidLessons && "rotate-180")} />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card
            className={cn(
              "rounded-xl cursor-pointer hover:shadow-md transition-shadow",
              unpaidLessons.length > 0 ? "border-red-500/20 bg-red-500/5" : "border-border/50"
            )}
            onClick={() => unpaidLessons.length > 0 && setShowUnpaidLessons(!showUnpaidLessons)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full shrink-0",
                unpaidLessons.length > 0 ? "bg-red-500/15" : "bg-muted/50"
              )}>
                <XCircle className={cn("h-5 w-5", unpaidLessons.length > 0 ? "text-red-500" : "text-muted-foreground")} />
              </div>
              <div className="flex-1">
                <div className={cn("text-2xl font-bold", unpaidLessons.length > 0 ? "text-red-600" : "text-muted-foreground")}>
                  {unpaidLessons.length}
                </div>
                <div className="text-xs text-muted-foreground">Неоплаченных {pluralLessons(unpaidLessons.length)}</div>
                {unpaidLessons.length > 0 && (
                  <div className="text-[10px] text-red-600 font-medium mt-0.5">Долг: {moneyRub(totalUnpaidCost)}</div>
                )}
              </div>
              {unpaidLessons.length > 0 && (
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showUnpaidLessons && "rotate-180")} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <AnimatePresence>
        {showPaidLessons && paidLessons.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="rounded-xl border-emerald-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Оплаченные занятия
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {paidLessons.slice(0, 10).map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2.5">
                      <div>
                        <p className="text-sm font-medium">
                          {format(new Date(l.scheduledAt), "d MMMM yyyy, HH:mm", { locale: ru })}
                        </p>
                        {l.topic && <p className="text-xs text-muted-foreground">{l.topic}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-emerald-500 text-white text-[10px]">Оплачено</Badge>
                        <span className="text-sm font-bold text-emerald-600">{moneyRub(calcCost(l))}</span>
                      </div>
                    </div>
                  ))}
                  {paidLessons.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2">И ещё {paidLessons.length - 10}...</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUnpaidLessons && unpaidLessons.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="rounded-xl border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Неоплаченные занятия
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3">
                  Эти занятия проведены, но ещё не оплачены. Общая сумма долга: <span className="font-semibold text-red-600">{moneyRub(totalUnpaidCost)}</span>
                </p>
                <div className="space-y-1.5">
                  {unpaidLessons.map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg bg-red-500/5 border border-red-500/10 p-2.5">
                      <div>
                        <p className="text-sm font-medium">
                          {format(new Date(l.scheduledAt), "d MMMM yyyy, HH:mm", { locale: ru })}
                        </p>
                        {l.topic && <p className="text-xs text-muted-foreground">{l.topic}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-red-500 text-white text-[10px]">Не оплачено</Badge>
                        <span className="text-sm font-bold text-red-600">{moneyRub(calcCost(l))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-primary" />
                История пополнений
              </CardTitle>
              {manualPayments.length > 0 && (
                <Badge variant="outline" className="text-xs">{manualPayments.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {sortedDeposits.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                  <Receipt className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Пополнений пока нет</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayPayments.map((p, idx) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/60 p-3 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 shrink-0">
                      <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Пополнение</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {methodLabel(p.method)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(p.createdAt), "d MMMM yyyy, HH:mm", { locale: ru })}
                        {p.comment && <span className="ml-1">• {p.comment}</span>}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-emerald-600 shrink-0">
                      +{moneyRub(p.amount)}
                    </div>
                  </motion.div>
                ))}

                {sortedDeposits.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground mt-2"
                    onClick={() => setShowAllPayments(!showAllPayments)}
                  >
                    {showAllPayments ? "Свернуть" : `Показать все (${sortedDeposits.length})`}
                    <ChevronRight className={cn("w-3 h-3 ml-1 transition-transform", showAllPayments && "rotate-90")} />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Сводка
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2.5">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Всего проведено</span>
                  <span className="text-sm font-semibold">{completedLessons.length} {pluralLessons(completedLessons.length)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Оплачено</span>
                  <span className="text-sm font-semibold text-emerald-600">{paidLessons.length} {pluralLessons(paidLessons.length)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Не оплачено</span>
                  <span className={cn("text-sm font-semibold", unpaidLessons.length > 0 ? "text-red-600" : "text-muted-foreground")}>
                    {unpaidLessons.length > 0 ? `${unpaidLessons.length} ${pluralLessons(unpaidLessons.length)}` : "—"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Предстоит всего</span>
                  <span className="text-sm font-semibold text-indigo-600">{upcomingLessons.length} {pluralLessons(upcomingLessons.length)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">На этой неделе</span>
                  <span className="text-sm font-semibold">
                    {completedThisWeek.length} прошло · {upcomingThisWeek.length} осталось
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">В этом месяце</span>
                  <span className="text-sm font-semibold">
                    {completedThisMonth.length} прошло · {upcomingThisMonth.length} осталось
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Баланс хватит на</span>
                  <span className={cn("text-sm font-semibold", lessonsLeft > 0 ? "text-emerald-600" : "text-red-600")}>
                    {lessonsLeft} {pluralLessons(lessonsLeft)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Оплатить онлайн</div>
                    <div className="text-xs text-muted-foreground">Быстро и безопасно</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Пополните баланс банковской картой. Деньги зачислятся мгновенно.
                </p>
                <Button className="w-full gap-2" disabled>
                  <CreditCard className="h-4 w-4" />
                  Оплатить картой
                </Button>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Скоро! Подключаем оплату через ЮKassa
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
