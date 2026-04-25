import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Package,
  Sparkles,
  Zap,
  Brain,
  Info,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { AI_PACKAGE_OPTIONS } from "@shared/schema";

interface AiModel {
  id: string;
  name: string;
  usage: number;
  limit: number;
  available: boolean;
}

interface AiUsageMonitorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: AiModel[];
  packageBalance: number;
  onBuyPackage?: () => void;
  variant?: "tutor" | "student";
}

const MODEL_ICONS: Record<string, typeof Zap> = {
  openai: Sparkles,
  "gpt4o-mini": Zap,
  deepseek: Brain,
};

export function AiUsageMonitorDialog({
  open,
  onOpenChange,
  models,
  packageBalance,
  onBuyPackage,
  variant = "tutor",
}: AiUsageMonitorProps) {
  const balanceEndpoint =
    variant === "tutor"
      ? "/api/ai-packages/balance"
      : "/api/student/ai-packages/balance";
  const { data: balanceData } = useQuery<{
    balance: number;
    totalPurchased: number;
    totalUsed: number;
  }>({
    queryKey: [balanceEndpoint],
    queryFn: async () => {
      const r = await fetch(balanceEndpoint);
      if (!r.ok) throw new Error("err");
      return r.json();
    },
    enabled: open,
  });

  const totalDailyUsed = models.reduce((sum, m) => sum + m.usage, 0);
  const totalDailyLimit = models.reduce((sum, m) => sum + m.limit, 0);
  const allTierExhausted = models.every((m) => m.usage >= m.limit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Мониторинг ИИ
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Использование лимитов тарифа и пакетов
          </p>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          <div className="rounded-xl border bg-gradient-to-br from-blue-50/50 to-cyan-50/30 dark:from-blue-950/20 dark:to-cyan-950/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-sm">Лимиты тарифа (сегодня)</h3>
            </div>
            <div className="space-y-3">
              {models.map((model) => {
                const Icon = MODEL_ICONS[model.id] || Zap;
                const percent =
                  model.limit > 0
                    ? Math.min((model.usage / model.limit) * 100, 100)
                    : 0;
                const remaining = Math.max(0, model.limit - model.usage);
                const exhausted = remaining <= 0;

                return (
                  <div key={model.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{model.name}</span>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          exhausted
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {model.usage} / {model.limit}
                        {!exhausted && (
                          <span className="font-normal ml-1 text-muted-foreground">
                            (ещё {remaining})
                          </span>
                        )}
                      </span>
                    </div>
                    <Progress
                      value={percent}
                      className={cn("h-1.5", exhausted && "[&>div]:bg-destructive")}
                    />
                  </div>
                );
              })}
            </div>
            {allTierExhausted && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Дневные лимиты тарифа исчерпаны. Запросы расходуют кредиты из
                  пакета ИИ.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-blue-50/50 to-cyan-50/30 dark:from-blue-950/20 dark:to-cyan-950/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-sm">Пакет ИИ</h3>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  packageBalance > 0
                    ? "bg-blue-100 text-blue-700 border-blue-200"
                    : "bg-gray-100 text-gray-500 border-gray-200"
                )}
              >
                {packageBalance > 0
                  ? `${packageBalance} кредитов`
                  : "Нет кредитов"}
              </Badge>
            </div>

            {balanceData && balanceData.totalPurchased > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Куплено всего</span>
                  <span className="font-medium">{balanceData.totalPurchased}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Использовано</span>
                  <span className="font-medium">{balanceData.totalUsed}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Осталось</span>
                  <span className="font-semibold text-blue-600">
                    {balanceData.balance}
                  </span>
                </div>
                <Progress
                  value={
                    balanceData.totalPurchased > 0
                      ? (balanceData.totalUsed / balanceData.totalPurchased) * 100
                      : 0
                  }
                  className="h-1.5 [&>div]:bg-blue-500"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                У вас пока нет купленных пакетов.
              </p>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2.5">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                <p className="font-semibold mb-0.5">Как работает пакет?</p>
                <p>
                  Пакет тратится <strong>только после</strong> исчерпания дневного
                  лимита тарифа. Каждый день лимиты тарифа обновляются, и вы снова
                  используете их в первую очередь. Пакет может расходоваться
                  постепенно в течение длительного времени.
                </p>
              </div>
            </div>
          </div>

          {onBuyPackage && (
            <Button
              className="w-full gap-2"
              onClick={() => {
                onOpenChange(false);
                onBuyPackage();
              }}
              data-testid="button-buy-ai-package"
            >
              <ShoppingCart className="h-4 w-4" />
              Купить пакет ИИ
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AiUsageMonitorButton({
  models,
  packageBalance,
  onBuyPackage,
  variant = "tutor",
  className,
}: {
  models: AiModel[];
  packageBalance: number;
  onBuyPackage?: () => void;
  variant?: "tutor" | "student";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const allExhausted = models.every((m) => m.usage >= m.limit);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        data-testid="button-ai-usage-monitor"
        className={cn(
          "gap-1.5 h-8 text-xs",
          allExhausted && packageBalance > 0 && "border-amber-300 text-amber-700",
          allExhausted && packageBalance <= 0 && "border-destructive text-destructive",
          className
        )}
        onClick={() => setOpen(true)}
      >
        <BarChart3 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Мониторинг</span>
        {packageBalance > 0 && (
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 h-4 ml-0.5 bg-blue-100 text-blue-700 border-blue-200"
          >
            {packageBalance}
          </Badge>
        )}
      </Button>
      <AiUsageMonitorDialog
        open={open}
        onOpenChange={setOpen}
        models={models}
        packageBalance={packageBalance}
        onBuyPackage={onBuyPackage}
        variant={variant}
      />
    </>
  );
}
