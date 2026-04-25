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
import {
  Zap,
  Sparkles,
  Brain,
  Cpu,
  Gauge,
  CheckCircle2,
  Package,
} from "lucide-react";

interface AiModel {
  id: string;
  name: string;
  usage: number;
  limit: number;
  available: boolean;
}

interface ModelPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: AiModel[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  packageBalance?: number;
}

const MODEL_META: Record<string, {
  description: string;
  bestFor: string[];
  icon: typeof Zap;
  gradient: string;
  accentColor: string;
  badgeColor: string;
  tier: string;
}> = {
  "openai": {
    description: "Мощная модель OpenAI GPT-4o. Отлично справляется со сложными задачами, анализом и генерацией текста.",
    bestFor: ["Сложные задачи", "Анализ текста", "Программирование", "Математика"],
    icon: Sparkles,
    gradient: "from-emerald-500/15 to-teal-500/10",
    accentColor: "text-emerald-600",
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    tier: "Премиум",
  },
  "gpt4o-mini": {
    description: "Быстрая и экономичная модель GPT-4o Mini. Идеальна для повседневных задач и быстрых ответов.",
    bestFor: ["Быстрые ответы", "Простые задачи", "Объяснения", "Ежедневное использование"],
    icon: Zap,
    gradient: "from-blue-500/15 to-cyan-500/10",
    accentColor: "text-blue-600",
    badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
    tier: "Стандарт",
  },
  "deepseek": {
    description: "Модель DeepSeek с углублённым анализом. Специализируется на математике, логике и научных задачах.",
    bestFor: ["Математика", "Логика", "Научные задачи", "Детальный анализ"],
    icon: Brain,
    gradient: "from-blue-500/15 to-cyan-500/10",
    accentColor: "text-blue-600",
    badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
    tier: "Специалист",
  },
};

const DEFAULT_META = {
  description: "ИИ модель для генерации текста и помощи с задачами.",
  bestFor: ["Текст", "Ответы на вопросы"],
  icon: Cpu,
  gradient: "from-gray-500/15 to-slate-500/10",
  accentColor: "text-gray-600",
  badgeColor: "bg-gray-100 text-gray-700 border-gray-200",
  tier: "Базовая",
};

function getModelMeta(modelId: string) {
  return MODEL_META[modelId] || DEFAULT_META;
}

export function ModelPickerDialog({
  open,
  onOpenChange,
  models,
  selectedModel,
  onSelectModel,
  packageBalance = 0,
}: ModelPickerDialogProps) {
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  const handleSelect = (modelId: string) => {
    onSelectModel(modelId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            Выбор модели ИИ
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Выберите модель, которая лучше всего подходит для вашей задачи
          </p>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-3">
          {packageBalance > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
              <Package className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-xs text-blue-700 dark:text-cyan-300">
                Пакет ИИ: <strong>{packageBalance}</strong> кредитов (используется после лимита тарифа)
              </span>
            </div>
          )}
          {models.map((model) => {
            const meta = getModelMeta(model.id);
            const Icon = meta.icon;
            const isSelected = selectedModel === model.id;
            const isHovered = hoveredModel === model.id;
            const usagePercent = model.limit > 0 ? Math.min((model.usage / model.limit) * 100, 100) : 0;
            const remaining = Math.max(0, model.limit - model.usage);
            const tierExhausted = remaining <= 0;
            const isFullyExhausted = tierExhausted && packageBalance <= 0;
            const usingPackage = tierExhausted && packageBalance > 0;

            return (
              <button
                key={model.id}
                data-testid={`model-tile-${model.id}`}
                disabled={!model.available || isFullyExhausted}
                onClick={() => handleSelect(model.id)}
                onMouseEnter={() => setHoveredModel(model.id)}
                onMouseLeave={() => setHoveredModel(null)}
                className={cn(
                  "w-full text-left rounded-xl border-2 p-4 transition-all duration-200 relative overflow-hidden",
                  "focus:outline-none focus:ring-2 focus:ring-primary/30",
                  isSelected && !isFullyExhausted
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border/60 hover:border-primary/40 hover:shadow-sm",
                  (isHovered && !isFullyExhausted) && "scale-[1.01]",
                  isFullyExhausted && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-60",
                  meta.gradient
                )} />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center",
                        isSelected ? "bg-primary/15" : "bg-background/80"
                      )}>
                        <Icon className={cn("h-5 w-5", meta.accentColor)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{model.name}</h3>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1.5 py-0 h-4 font-medium", meta.badgeColor)}
                          >
                            {meta.tier}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-3 pl-[46px]">
                    {meta.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-3 pl-[46px]">
                    {meta.bestFor.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-background/80 border border-border/50 text-muted-foreground font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="pl-[46px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-muted-foreground">
                        Использовано сегодня
                      </span>
                      <span className={cn(
                        "text-[11px] font-semibold",
                        tierExhausted ? "text-destructive" : meta.accentColor
                      )}>
                        {model.usage} / {model.limit}
                        {remaining > 0 && (
                          <span className="text-muted-foreground font-normal ml-1">
                            (ещё {remaining})
                          </span>
                        )}
                      </span>
                    </div>
                    <Progress
                      value={usagePercent}
                      className="h-1.5"
                    />
                    {usingPackage && (
                      <p className="text-[10px] text-blue-600 mt-1 font-medium flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Используется пакет ИИ ({packageBalance} кредитов)
                      </p>
                    )}
                    {isFullyExhausted && (
                      <p className="text-[10px] text-destructive mt-1 font-medium">
                        Лимит исчерпан — докупите пакет ИИ
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ModelPickerButton({
  models,
  selectedModel,
  onSelectModel,
  packageBalance = 0,
  className,
}: {
  models: AiModel[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  packageBalance?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const currentModel = models.find(m => m.id === selectedModel);
  const meta = currentModel ? getModelMeta(currentModel.id) : null;
  const Icon = meta?.icon || Zap;
  const tierRemaining = currentModel ? Math.max(0, currentModel.limit - currentModel.usage) : 0;
  const effectiveRemaining = tierRemaining > 0 ? tierRemaining : packageBalance;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        data-testid="button-model-picker"
        className={cn("gap-1.5 h-8 text-xs", className)}
        onClick={() => setOpen(true)}
      >
        <Icon className={cn("h-3.5 w-3.5", meta?.accentColor)} />
        <span className="hidden sm:inline">{currentModel?.name || "Модель"}</span>
        {currentModel && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1 py-0 h-4 ml-0.5",
              tierRemaining > 0 ? meta?.badgeColor : "bg-blue-100 text-blue-700 border-blue-200"
            )}
          >
            {effectiveRemaining}
            {tierRemaining <= 0 && packageBalance > 0 && " P"}
          </Badge>
        )}
      </Button>
      <ModelPickerDialog
        open={open}
        onOpenChange={setOpen}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={onSelectModel}
        packageBalance={packageBalance}
      />
    </>
  );
}
