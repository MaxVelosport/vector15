import { useState, useEffect } from "react";
import { usePaymentResult } from "@/hooks/use-payment-result";
import { CalendarDays, Check, Crown, Diamond, Info, Minus, Package, Plus, ShoppingCart, Sparkles, Users, Zap, XCircle, FileText, Shield, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHero } from "@/components/page-hero";
import { useAuth } from "@/hooks/use-auth";
import { useActivateDemoSubscription } from "@/hooks/use-subscription";
import { SUBSCRIPTION_LIMITS, AI_PACKAGE_OPTIONS, EXTRA_STUDENT_PACKAGES } from "@shared/schema";
import { Spinner } from "@/components/ui/spinner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import { useDocumentTitle } from "@/hooks/use-document-title";
export default function SubscriptionPage() {
  useDocumentTitle("Подписка");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  usePaymentResult({
    param: "purchase",
    successMessage: "Подписка оформлена! Активация займёт несколько минут. Мы пришлём уведомление по email и в Telegram.",
    failMessage: "Оплата не прошла. Попробуйте ещё раз или используйте другую карту.",
    successAction: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-packages/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student-slots"] });
    },
  });
  const activateDemoMutation = useActivateDemoSubscription();
  const [showAiPackageDialog, setShowAiPackageDialog] = useState(false);
  const [showExtraStudentsDialog, setShowExtraStudentsDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/subscription/cancel", {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Ошибка отмены");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student-slots"] });
      toast.success("Подписка отменена. Переключаемся на бесплатный тариф.");
      setShowCancelDialog(false);
    },
    onError: (e: any) => toast.error(e.message || "Ошибка отмены подписки"),
  });

  const { data: packageBalanceData } = useQuery<{
    balance: number;
    totalPurchased: number;
    totalUsed: number;
  }>({
    queryKey: ["/api/ai-packages/balance"],
    queryFn: async () => {
      const r = await fetch("/api/ai-packages/balance");
      if (!r.ok) return { balance: 0, totalPurchased: 0, totalUsed: 0 };
      return r.json();
    },
  });

  const { data: studentSlotsData } = useQuery<{
    tier: string;
    tierName: string;
    activeStudents: number;
    maxStudents: number;
    baseSlots: number;
    extraSlots: number;
    extraStudentPrice: number;
    isAtLimit: boolean;
    isNearLimit: boolean;
  }>({
    queryKey: ["/api/student-slots"],
    queryFn: async () => {
      const r = await fetch("/api/student-slots");
      if (!r.ok) throw new Error("err");
      return r.json();
    },
  });

  const buyAiPackageMutation = useMutation({
    mutationFn: async (data: { credits: number; pricePaid: number; promoCode?: string | null }) => {
      const r = await fetch("/api/ai-packages/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Ошибка покупки");
      return json as { confirmationUrl?: string };
    },
    onSuccess: (data) => {
      setShowAiPackageDialog(false);
      if (data.confirmationUrl) {
        toast.success("Переходим к оплате...");
        window.location.href = data.confirmationUrl;
      } else {
        toast.error("Не удалось получить ссылку на оплату");
      }
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const buyExtraStudentsMutation = useMutation({
    mutationFn: async (data: { count: number }) => {
      const r = await fetch("/api/extra-students/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Ошибка покупки");
      return json as { confirmationUrl?: string };
    },
    onSuccess: (data) => {
      setShowExtraStudentsDialog(false);
      if (data.confirmationUrl) {
        toast.success("Переходим к оплате...");
        window.location.href = data.confirmationUrl;
      } else {
        toast.error("Не удалось получить ссылку на оплату");
      }
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const handleDemoActivation = async (tier: "pro" | "premium") => {
    try {
      await activateDemoMutation.mutateAsync({ tier, period: "monthly" });
      toast.success(`Демо-подписка ${SUBSCRIPTION_LIMITS[tier].name} активирована на 7 дней!`);
    } catch (e: any) {
      toast.error(e.message || "Ошибка активации демо");
    }
  };

  const currentTier = (user?.subscription || "free") as keyof typeof SUBSCRIPTION_LIMITS;
  const currentLimits = SUBSCRIPTION_LIMITS[currentTier];

  const tiers = [
    {
      id: "free" as const,
      icon: Zap,
      color: "text-slate-500",
      bgColor: "bg-slate-500/10",
      borderColor: "border-slate-200 dark:border-slate-700",
      gradient: "from-slate-50 to-gray-50 dark:from-slate-950/50 dark:to-gray-950/50",
      subtitle: "Для знакомства с платформой",
      features: [
        `До ${SUBSCRIPTION_LIMITS.free.maxStudents} учеников`,
        "Расписание + напоминания",
        "Учёт оплат и баланса",
        `${SUBSCRIPTION_LIMITS.free.aiChecksPerDay} ИИ-проверок в день`,
        `${SUBSCRIPTION_LIMITS.free.aiTaskGenPerWeek} ИИ-генерации заданий в неделю`,
        "Базовая статистика",
      ],
    },
    {
      id: "pro" as const,
      icon: Crown,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-200 dark:border-cyan-700",
      gradient: "from-cyan-50/50 to-blue-50/50 dark:from-cyan-950/30 dark:to-blue-950/30",
      subtitle: "Для репетиторов с 5-15 учениками",
      prevTierLabel: "Всё из «Старт», плюс:",
      features: [
        `До ${SUBSCRIPTION_LIMITS.pro.maxStudents} учеников`,
        `+${SUBSCRIPTION_LIMITS.pro.extraStudentPrice} ₽ / доп. ученик`,
        `${SUBSCRIPTION_LIMITS.pro.aiChecksPerDay} ИИ-проверок в день`,
        "Безлимит генерации заданий",
        "Личный кабинет ученика",
        "Финансовые отчёты",
      ],
    },
    {
      id: "premium" as const,
      icon: Diamond,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-cyan-300 dark:border-blue-700",
      gradient: "from-blue-50/50 to-cyan-50/50 dark:from-blue-950/30 dark:to-cyan-950/30",
      popular: true,
      subtitle: "Для активных репетиторов",
      prevTierLabel: "Всё из «Базовый», плюс:",
      features: [
        `До ${SUBSCRIPTION_LIMITS.premium.maxStudents} учеников`,
        `+${SUBSCRIPTION_LIMITS.premium.extraStudentPrice} ₽ / доп. ученик`,
        "Безлимит ИИ-проверок",
        `${SUBSCRIPTION_LIMITS.premium.maxAiModels} ИИ-моделей на выбор`,
        "ИИ-куратор 24/7 ученику",
        "Продвинутая аналитика",
      ],
    },
  ];

  const subscriptionUntil = (user as any)?.subscriptionUntil;
  const expiryDate = subscriptionUntil ? new Date(subscriptionUntil) : null;
  const expiryFormatted = expiryDate ? format(expiryDate, "d MMMM yyyy", { locale: ru }) : null;
  const daysRemaining = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <DashboardLayout title="Тарифы и подписка" subtitle="Управление тарифом, пакетами ИИ и учениками">
      <div className="max-w-6xl mx-auto space-y-8">
        <PageHero
          icon={<Crown className="h-6 w-6 text-white" />}
          gradient="from-amber-500/80 via-orange-500/70 to-rose-500/60"
          title="Тарифы и подписка"
          subtitle="Выберите подходящий план — от бесплатного «Старт» до безлимитного «Про». Тариф определяет количество учеников, ИИ-функции, конференции и базу заданий. Данные не теряются при смене."
          badge="Подписка"
        />

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-cyan-500/5" data-testid="card-my-plan">
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <Crown className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg">Тариф: {currentLimits.name}</h3>
                      {currentTier !== "free" && (
                        <Badge variant="secondary" className="text-xs" data-testid="badge-current-tier">
                          Активен
                        </Badge>
                      )}
                    </div>
                    {expiryFormatted && currentTier !== "free" && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Действует до {expiryFormatted}
                        {daysRemaining !== null && daysRemaining < 30 && (
                          <Badge variant="destructive" className="ml-2 text-[10px]">
                            {daysRemaining} дн.
                          </Badge>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                  {studentSlotsData && (
                    <div className="rounded-xl border bg-card px-4 py-2.5 text-center min-w-[120px]" data-testid="info-student-slots">
                      <p className="text-xs text-muted-foreground">Ученики</p>
                      <p className="text-lg font-bold">
                        {studentSlotsData.activeStudents}
                        <span className="text-muted-foreground font-normal text-sm"> / {studentSlotsData.maxStudents === -1 ? "∞" : studentSlotsData.maxStudents}</span>
                      </p>
                      {studentSlotsData.extraSlots > 0 && (
                        <p className="text-[10px] text-emerald-600">+{studentSlotsData.extraSlots} доп.</p>
                      )}
                    </div>
                  )}

                  {packageBalanceData && (
                    <div className="rounded-xl border bg-card px-4 py-2.5 text-center min-w-[120px]" data-testid="info-ai-balance">
                      <p className="text-xs text-muted-foreground">Пакет ИИ</p>
                      <p className="text-lg font-bold text-blue-600">
                        {packageBalanceData.balance}
                        <span className="text-muted-foreground font-normal text-xs"> кред.</span>
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {currentLimits.extraStudentPrice > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => setShowExtraStudentsDialog(true)}
                        data-testid="button-quick-buy-students"
                      >
                        <Users className="h-3.5 w-3.5" />
                        + Ученики
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => setShowAiPackageDialog(true)}
                      data-testid="button-quick-buy-ai"
                    >
                      <Package className="h-3.5 w-3.5" />
                      + ИИ пакет
                    </Button>
                    {currentTier !== "free" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setShowCancelDialog(true)}
                        data-testid="button-cancel-subscription"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Отменить подписку
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-subscription-title">
            Выберите тариф, который подходит именно вам
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            От бесплатного входа до полной автоматизации
          </p>
        </motion.div>

        <Tabs defaultValue="monthly" className="w-full">
          <TabsList className="mx-auto mb-8 grid w-[300px] grid-cols-2">
            <TabsTrigger value="monthly" data-testid="tab-monthly">Помесячно</TabsTrigger>
            <TabsTrigger value="yearly" data-testid="tab-yearly">
              Годовой
              <Badge variant="secondary" className="ml-2">-20%</Badge>
            </TabsTrigger>
          </TabsList>

          {["monthly", "yearly"].map((period) => (
            <TabsContent key={period} value={period}>
              <div className="grid gap-6 md:grid-cols-3">
                {tiers.map((tier, index) => {
                  const limits = SUBSCRIPTION_LIMITS[tier.id];
                  const isCurrent = currentTier === tier.id;
                  const price = period === "monthly" ? limits.monthlyPrice : limits.yearlyPrice;
                  const monthlyEquiv = period === "yearly" && limits.yearlyPrice > 0
                    ? Math.round(limits.yearlyPrice / 12)
                    : limits.monthlyPrice;
                  const Icon = tier.icon;

                  return (
                    <motion.div
                      key={tier.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card
                        className={cn(
                          "relative h-full overflow-hidden",
                          tier.popular ? "ring-2 ring-blue-500" : "",
                          isCurrent ? "ring-2 ring-primary" : ""
                        )}
                        data-testid={`card-tier-${tier.id}`}
                      >
                        <div className={cn("absolute inset-0 bg-gradient-to-br", tier.gradient)} />
                        {tier.popular && (
                          <div className="absolute -top-0 right-0 left-0 flex justify-center">
                            <Badge className="rounded-t-none rounded-b-md bg-blue-500 text-white px-3">
                              Популярный
                            </Badge>
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="outline" className="bg-background text-xs">Текущий</Badge>
                          </div>
                        )}

                        <CardHeader className="relative z-10 pt-8">
                          <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg", tier.bgColor)}>
                            <Icon className={cn("h-5 w-5", tier.color)} />
                          </div>
                          <CardTitle className="text-xl">{limits.name}</CardTitle>
                          <CardDescription className="text-xs">{tier.subtitle}</CardDescription>
                        </CardHeader>

                        <CardContent className="relative z-10 space-y-4">
                          <div>
                            {price === 0 ? (
                              <>
                                <span className="text-3xl font-bold">0 ₽</span>
                                <span className="text-muted-foreground text-sm ml-1">навсегда</span>
                              </>
                            ) : (
                              <>
                                <span className="text-3xl font-bold">
                                  {(period === "monthly" ? price : monthlyEquiv).toLocaleString("ru-RU")} ₽
                                </span>
                                <span className="text-muted-foreground text-sm ml-1">/мес</span>
                                {period === "yearly" && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {price.toLocaleString("ru-RU")} ₽/год
                                  </p>
                                )}
                              </>
                            )}
                          </div>

                          <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                            <span className="text-xs text-muted-foreground">
                              до <strong>{(limits.maxStudents as number) === -1 ? "∞" : limits.maxStudents}</strong> учеников
                            </span>
                            {limits.extraStudentPrice > 0 && (
                              <span className="text-xs text-muted-foreground block">
                                +{limits.extraStudentPrice} ₽ / доп. ученик
                              </span>
                            )}
                          </div>

                          {tier.prevTierLabel && (
                            <p className="text-xs font-medium text-muted-foreground">{tier.prevTierLabel}</p>
                          )}

                          <ul className="space-y-2">
                            {tier.features.map((feature, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <Check className={cn("mt-0.5 h-4 w-4 shrink-0", tier.color)} />
                                <span className="text-sm">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>

                        <CardFooter className="relative z-10 flex flex-col gap-2">
                          {tier.id === "free" ? (
                            <Button variant="outline" className="w-full" disabled>
                              {isCurrent ? "Текущий тариф" : "Бесплатно"}
                            </Button>
                          ) : isCurrent ? (
                            <Button variant="outline" className="w-full" disabled>
                              Активен
                            </Button>
                          ) : (
                            <>
                              <Button
                                className="w-full"
                                disabled
                                data-testid={`button-subscribe-${tier.id}-${period}`}
                              >
                                Оформить {limits.name}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs"
                                onClick={() => handleDemoActivation(tier.id)}
                                disabled={activateDemoMutation.isPending}
                                data-testid={`button-demo-${tier.id}`}
                              >
                                Попробовать 7 дней бесплатно
                              </Button>
                            </>
                          )}
                        </CardFooter>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-amber-500" /> -20% при оплате за год</span>
          <span>7 дней бесплатного триала</span>
          <span>Докупка учеников в любой момент</span>
          <span>Без скрытых платежей</span>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="h-full" data-testid="card-ai-packages">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Package className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Пакеты ИИ</CardTitle>
                    <CardDescription className="text-xs">Дополнительные запросы к ИИ</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      <p className="font-semibold mb-1">Как работает пакет?</p>
                      <p>
                        Сначала расходуются дневные лимиты вашего тарифа. Пакет начинает тратиться
                        <strong> только после</strong> их исчерпания. На следующий день лимиты тарифа
                        обновляются, и снова используются в первую очередь. Пакет может расходоваться
                        постепенно — хоть месяц, хоть полгода.
                      </p>
                    </div>
                  </div>
                </div>

                {packageBalanceData && packageBalanceData.totalPurchased > 0 && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Баланс пакета</span>
                      <span className="font-semibold text-blue-600">{packageBalanceData.balance} кредитов</span>
                    </div>
                    <Progress
                      value={packageBalanceData.totalPurchased > 0
                        ? ((packageBalanceData.totalPurchased - packageBalanceData.totalUsed) / packageBalanceData.totalPurchased) * 100
                        : 0}
                      className="h-2 [&>div]:bg-blue-500"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Использовано: {packageBalanceData.totalUsed}</span>
                      <span>Куплено: {packageBalanceData.totalPurchased}</span>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  onClick={() => setShowAiPackageDialog(true)}
                  data-testid="button-open-ai-package-dialog"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Купить пакет ИИ
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="h-full" data-testid="card-extra-students">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Users className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Доп. ученики</CardTitle>
                    <CardDescription className="text-xs">Расширьте лимит учеников</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {studentSlotsData && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Активные ученики</span>
                      <span className="font-semibold">
                        {studentSlotsData.activeStudents} / {studentSlotsData.maxStudents === -1 ? "∞" : studentSlotsData.maxStudents}
                      </span>
                    </div>
                    {studentSlotsData.maxStudents !== -1 && (
                      <Progress
                        value={(studentSlotsData.activeStudents / studentSlotsData.maxStudents) * 100}
                        className={cn(
                          "h-2",
                          studentSlotsData.isAtLimit && "[&>div]:bg-destructive",
                          studentSlotsData.isNearLimit && !studentSlotsData.isAtLimit && "[&>div]:bg-amber-500"
                        )}
                      />
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Тариф: {studentSlotsData.baseSlots}</span>
                      {studentSlotsData.extraSlots > 0 && (
                        <span>Доп: +{studentSlotsData.extraSlots}</span>
                      )}
                    </div>
                    {studentSlotsData.isAtLimit && (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2">
                        <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">
                          Лимит учеников достигнут. Докупите учеников или повысьте тариф.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {currentLimits.extraStudentPrice > 0 ? (
                  <Button
                    className="w-full gap-2"
                    variant="outline"
                    onClick={() => setShowExtraStudentsDialog(true)}
                    data-testid="button-open-extra-students-dialog"
                  >
                    <Plus className="h-4 w-4" />
                    Докупить учеников ({currentLimits.extraStudentPrice} ₽/шт)
                  </Button>
                ) : currentTier === "free" ? (
                  <p className="text-xs text-muted-foreground text-center">
                    Докупка учеников доступна на тарифах Базовый и Про
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">
                    Безлимит учеников на вашем тарифе
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* База знаний */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-cyan-500/5 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold">База знаний</div>
                <div className="text-xs text-muted-foreground mt-0.5">Руководства по всем разделам платформы</div>
              </div>
            </div>
            <Button size="sm" className="gap-1.5 shadow-sm" asChild data-testid="link-knowledge-base">
              <Link href="/help">Открыть все статьи →</Link>
            </Button>
          </div>
          <div className="px-5 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { icon: "👥", title: "Ученики", desc: "Добавление, профили, группы, архив" },
                { icon: "🎯", title: "Занятия и Расписание", desc: "Планирование, статусы, массовое добавление" },
                { icon: "💰", title: "Финансы и Аналитика", desc: "Оплаты, задолженности, графики доходов" },
                { icon: "🤖", title: "ИИ-ассистент", desc: "Планы уроков, задания, рекомендации" },
                { icon: "📚", title: "Домашние задания", desc: "Отправка, проверка, оценки" },
                { icon: "📋", title: "База заданий", desc: "Задачник, варианты, отправка ученикам" },
                { icon: "🎥", title: "Конференции", desc: "Видеозвонки прямо с платформы" },
                { icon: "🖥️", title: "Интерактивные доски", desc: "Совместная работа в реальном времени" },
                { icon: "💬", title: "Сообщения и Рассылки", desc: "Чат с учениками, массовые рассылки" },
                { icon: "🏆", title: "Геймификация", desc: "Баллы, уровни, достижения, рейтинг" },
                { icon: "👤", title: "Профиль и реферальная", desc: "Данные, фото, реферальная программа" },
                { icon: "🔒", title: "Тарифы и безопасность", desc: "Тарифные планы, оплата, смена пароля" },
              ].map((item) => (
                <Link href="/help" key={item.title} className="group flex items-start gap-2.5 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5 hover:border-primary/30 hover:bg-primary/5 transition-all" data-testid={`link-kb-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{item.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Все платежи обрабатываются через <strong>ЮKassa</strong> по защищённому протоколу HTTPS</p>
          <p className="mt-1">Подписку можно отменить в любой момент — данные сохранятся</p>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-5 text-xs text-muted-foreground border-t border-border/30 pt-5">
          <Link href="/legal/oferta" className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="link-oferta">
            <FileText className="h-3.5 w-3.5" />
            Публичная оферта
          </Link>
          <Link href="/legal/privacy" className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="link-privacy">
            <Shield className="h-3.5 w-3.5" />
            Политика конфиденциальности
          </Link>
          <span>support@tvoy-vector.ru</span>
        </div>
      </div>

      <AiPackagePurchaseDialog
        open={showAiPackageDialog}
        onOpenChange={setShowAiPackageDialog}
        onPurchase={(credits, price, promoCode) => buyAiPackageMutation.mutate({ credits, pricePaid: price, promoCode })}
        isPending={buyAiPackageMutation.isPending}
      />

      <ExtraStudentsPurchaseDialog
        open={showExtraStudentsDialog}
        onOpenChange={setShowExtraStudentsDialog}
        pricePerStudent={currentLimits.extraStudentPrice}
        onPurchase={(count) => buyExtraStudentsMutation.mutate({ count })}
        isPending={buyExtraStudentsMutation.isPending}
      />

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Отменить подписку
            </DialogTitle>
            <DialogDescription>
              После отмены ваш тариф сразу переключится на бесплатный «Старт».
              Все ваши данные (ученики, расписание, история) сохранятся.
              Восстановить подписку можно в любой момент, оплатив тариф заново.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold">Что изменится после отмены:</p>
            <p>• Тариф сразу меняется на «Старт» (до {SUBSCRIPTION_LIMITS.free.maxStudents} учеников)</p>
            <p>• Лимит ИИ-проверок снизится до {SUBSCRIPTION_LIMITS.free.aiChecksPerDay} в день</p>
            <p>• Личный кабинет ученика и финансовые отчёты станут недоступны</p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              data-testid="button-cancel-dialog-close"
            >
              Оставить подписку
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelSubscriptionMutation.mutate()}
              disabled={cancelSubscriptionMutation.isPending}
              data-testid="button-confirm-cancel-subscription"
            >
              {cancelSubscriptionMutation.isPending ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : null}
              Да, отменить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function AiPackagePurchaseDialog({
  open,
  onOpenChange,
  onPurchase,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchase: (credits: number, price: number, promoCode?: string | null) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; finalAmount: number; discountAmount: number } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);

  async function applyPromo() {
    if (selected === null) {
      toast.error("Сначала выберите пакет");
      return;
    }
    if (!promoInput.trim()) return;
    setPromoChecking(true);
    try {
      const pkg = AI_PACKAGE_OPTIONS[selected];
      const r = await apiRequest("POST", "/api/promo-codes/validate", {
        code: promoInput.trim(),
        amount: pkg.price,
        scope: "ai_packages",
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error || "Ошибка проверки");
        setPromoApplied(null);
        return;
      }
      setPromoApplied({ code: data.code, finalAmount: data.finalAmount, discountAmount: data.discountAmount });
      toast.success(`Скидка ${data.discountAmount} ₽ применена`);
    } catch (e: any) {
      toast.error(e?.message || "Ошибка проверки");
      setPromoApplied(null);
    } finally {
      setPromoChecking(false);
    }
  }

  function clearPromo() {
    setPromoApplied(null);
    setPromoInput("");
  }

  // Сбрасываем промокод при смене пакета
  useEffect(() => { if (promoApplied) setPromoApplied(null); /* eslint-disable-next-line */ }, [selected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            Купить пакет ИИ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="rounded-lg bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2.5">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                Кредиты пакета расходуются только после исчерпания дневного лимита тарифа. Не сгорают.
              </p>
            </div>
          </div>

          {AI_PACKAGE_OPTIONS.map((pkg, i) => (
            <button
              key={i}
              data-testid={`ai-package-option-${pkg.credits}`}
              onClick={() => setSelected(i)}
              className={cn(
                "w-full text-left rounded-xl border-2 p-4 transition-all",
                selected === i
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-border hover:border-cyan-300",
                pkg.popular && "relative"
              )}
            >
              {pkg.popular && (
                <Badge className="absolute -top-2 right-3 bg-blue-500 text-white text-[10px]">
                  Выгодно
                </Badge>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{pkg.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(pkg.price / pkg.credits).toFixed(1)} ₽ за запрос
                  </p>
                </div>
                <span className="text-lg font-bold">{pkg.price} ₽</span>
              </div>
            </button>
          ))}

          <Button
            className="w-full mt-2 gap-2"
            disabled={selected === null || isPending}
            onClick={() => {
              if (selected !== null) {
                const pkg = AI_PACKAGE_OPTIONS[selected];
                onPurchase(pkg.credits, pkg.price, promoApplied?.code || null);
              }
            }}
            data-testid="button-confirm-ai-package"
          >
            {isPending ? <Spinner className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {selected !== null
              ? promoApplied
                ? `Купить за ${promoApplied.finalAmount} ₽ (−${promoApplied.discountAmount} ₽)`
                : `Купить ${AI_PACKAGE_OPTIONS[selected].label} за ${AI_PACKAGE_OPTIONS[selected].price} ₽`
              : "Выберите пакет"}
          </Button>

          {/* Промокод */}
          <div className="rounded-lg border border-border/60 p-3 space-y-2 bg-muted/20">
            <Label className="text-xs text-muted-foreground">Есть промокод?</Label>
            {promoApplied ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-mono font-semibold">{promoApplied.code}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 ml-2">−{promoApplied.discountAmount} ₽</span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearPromo} data-testid="button-promo-clear">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="WELCOME10"
                  className="h-9"
                  data-testid="input-promo-checkout"
                  onKeyDown={(e) => { if (e.key === 'Enter') applyPromo(); }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={applyPromo}
                  disabled={promoChecking || !promoInput.trim()}
                  data-testid="button-promo-apply"
                >
                  {promoChecking ? <Spinner className="h-4 w-4" /> : "Применить"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExtraStudentsPurchaseDialog({
  open,
  onOpenChange,
  pricePerStudent,
  onPurchase,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pricePerStudent: number;
  onPurchase: (count: number) => void;
  isPending: boolean;
}) {
  const [count, setCount] = useState(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            Докупить учеников
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => setCount(Math.max(1, count - 1))}
              disabled={count <= 1}
              data-testid="button-decrease-students"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[80px]">
              <span className="text-3xl font-bold" data-testid="text-student-count">{count}</span>
              <p className="text-xs text-muted-foreground">
                {count === 1 ? "ученик" : count < 5 ? "ученика" : "учеников"}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => setCount(count + 1)}
              data-testid="button-increase-students"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-lg border p-3 text-center">
            <p className="text-sm text-muted-foreground">Стоимость</p>
            <p className="text-2xl font-bold">{(pricePerStudent * count).toLocaleString("ru-RU")} ₽<span className="text-sm font-normal text-muted-foreground">/мес</span></p>
            <p className="text-xs text-muted-foreground mt-1">{pricePerStudent} ₽ x {count}</p>
          </div>

          <div className="flex gap-2">
            {EXTRA_STUDENT_PACKAGES.map((pkg) => (
              <Button
                key={pkg.count}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setCount(pkg.count)}
                data-testid={`button-preset-${pkg.count}`}
              >
                {pkg.label}
              </Button>
            ))}
          </div>

          <Button
            className="w-full gap-2"
            disabled={isPending}
            onClick={() => onPurchase(count)}
            data-testid="button-confirm-extra-students"
          >
            {isPending ? <Spinner className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            Докупить {count} {count === 1 ? "ученика" : count < 5 ? "ученика" : "учеников"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
