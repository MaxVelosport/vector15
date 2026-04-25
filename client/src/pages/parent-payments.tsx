import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Receipt,
  AlertCircle,
  Wallet,
  CreditCard,
  Banknote,
  Printer,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface PaymentItem {
  id: string;
  amount: number;
  method: string;
  comment?: string | null;
  yookassaStatus?: string | null;
  createdAt: string;
}

interface PaymentsResponse {
  student: { id: string; name: string; subject: string; pricePerLesson: number; balance: number };
  tutor: { name: string; email: string };
  payments: PaymentItem[];
  summary: {
    totalPaid: number;
    totalSpent: number;
    balance: number;
    paymentsCount: number;
    completedLessonsCount: number;
  };
}

function moneyRub(n: number) {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU")} ₽`;
}

function methodLabel(m: string) {
  switch (m) {
    case "карта": return "Карта";
    case "наличные": return "Наличные";
    case "перевод": return "Перевод";
    case "онлайн": return "Онлайн";
    default: return m || "—";
  }
}

function MethodIcon({ method, className }: { method: string; className?: string }) {
  if (method === "карта" || method === "онлайн") return <CreditCard className={className} />;
  if (method === "наличные") return <Banknote className={className} />;
  return <Wallet className={className} />;
}

export default function ParentPaymentsPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("t") || "", []);

  useEffect(() => {
    document.title = "История оплат — Твой Вектор";
  }, []);

  const { data, isLoading, error } = useQuery<PaymentsResponse>({
    queryKey: ["/api/parent/payments", token],
    queryFn: async () => {
      const res = await fetch(`/api/parent/payments?t=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error((await res.json()).error || "Ошибка");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  if (!token) {
    return (
      <ErrorScreen
        title="Нет токена доступа"
        description="Ссылка повреждена. Попросите репетитора прислать новую."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorScreen
        title="Ссылка недействительна"
        description={(error as any)?.message || "Срок действия ссылки истёк. Попросите репетитора прислать новую."}
      />
    );
  }

  const { student, tutor, payments, summary } = data;
  const csvUrl = `/api/parent/payments.csv?t=${encodeURIComponent(token)}`;
  const balance = summary.balance;
  const balancePositive = balance >= 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/parent-chat?t=${encodeURIComponent(token)}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9" data-testid="button-back-to-chat">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm leading-tight truncate" data-testid="text-title">
              История оплат
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {student.name} • {student.subject} • репетитор {tutor.name}
            </div>
          </div>
          <a href={csvUrl} download>
            <Button variant="outline" size="sm" className="gap-1.5 h-8" data-testid="button-download-csv">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          </a>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Всего оплачено"
            value={moneyRub(summary.totalPaid)}
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            testid="stat-total-paid"
          />
          <StatCard
            label="Израсходовано"
            value={moneyRub(summary.totalSpent)}
            icon={<TrendingDown className="h-4 w-4 text-rose-600" />}
            testid="stat-total-spent"
          />
          <StatCard
            label={balancePositive ? "Баланс" : "Долг"}
            value={moneyRub(Math.abs(balance))}
            icon={<Wallet className={cn("h-4 w-4", balancePositive ? "text-blue-600" : "text-rose-600")} />}
            accent={balancePositive ? "text-blue-600" : "text-rose-600"}
            testid="stat-balance"
          />
          <StatCard
            label="Платежей"
            value={String(summary.paymentsCount)}
            sub={`${summary.completedLessonsCount} занятий`}
            icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
            testid="stat-payments-count"
          />
        </div>

        {/* Payments list */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
              <div className="font-medium text-sm">Все платежи</div>
              <div className="text-[11px] text-muted-foreground">
                {summary.paymentsCount} {summary.paymentsCount === 1 ? "запись" : "записей"}
              </div>
            </div>

            {payments.length === 0 ? (
              <div className="px-4 py-12 flex flex-col items-center gap-3 text-center">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <div className="text-sm font-medium">Пока нет оплат</div>
                <div className="text-xs text-muted-foreground max-w-sm">
                  Как только репетитор внесёт оплату, она появится здесь. Вы сможете скачать историю и чек по каждому платежу.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {payments.map((p) => {
                  const receiptUrl = `/api/parent/receipt/${p.id}?t=${encodeURIComponent(token)}`;
                  const d = new Date(p.createdAt);
                  return (
                    <div
                      key={p.id}
                      className="px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                      data-testid={`payment-row-${p.id}`}
                    >
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                        p.method === "наличные" ? "bg-amber-500/10" :
                        p.method === "онлайн" ? "bg-violet-500/10" :
                        "bg-blue-500/10"
                      )}>
                        <MethodIcon
                          method={p.method}
                          className={cn(
                            "h-4 w-4",
                            p.method === "наличные" ? "text-amber-600" :
                            p.method === "онлайн" ? "text-violet-600" :
                            "text-blue-600"
                          )}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm" data-testid={`text-amount-${p.id}`}>
                            {moneyRub(p.amount)}
                          </span>
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                            {methodLabel(p.method)}
                          </Badge>
                          {p.yookassaStatus === "pending" && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-amber-600 border-amber-500/40">
                              Ожидает
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {format(d, "d MMMM yyyy, HH:mm", { locale: ru })}
                          {p.comment ? ` • ${p.comment}` : ""}
                        </div>
                      </div>

                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-8 shrink-0"
                          data-testid={`button-receipt-${p.id}`}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Чек</span>
                        </Button>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-[11px] text-muted-foreground leading-relaxed">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-foreground text-xs mb-1">О документах</div>
              «Чек» — это документ-подтверждение оплаты с реквизитами платежа, который можно распечатать или сохранить в PDF через «Печать» в браузере. CSV-файл содержит всю историю оплат и открывается в Excel или Google Таблицах. Фискальный чек самозанятого («Мой налог») при необходимости запросите у репетитора.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
  testid,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
  testid?: string;
}) {
  return (
    <Card className="p-3" data-testid={testid}>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
        {icon}
        {label}
      </div>
      <div className={cn("text-lg font-bold leading-tight", accent)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function ErrorScreen({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <div className="text-lg font-semibold" data-testid="text-error-title">{title}</div>
        <div className="text-sm text-muted-foreground" data-testid="text-error-description">{description}</div>
      </div>
    </div>
  );
}
