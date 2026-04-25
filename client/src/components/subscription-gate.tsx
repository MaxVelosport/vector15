import { Crown, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_LIMITS } from "@shared/schema";

type SubscriptionTier = "free" | "pro" | "premium";

interface SubscriptionGateProps {
  requiredTier: SubscriptionTier;
  currentTier: SubscriptionTier;
  feature?: string;
  children: React.ReactNode;
}

const tierHierarchy: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

const tierNames: Record<SubscriptionTier, string> = {
  free: SUBSCRIPTION_LIMITS.free.name,
  pro: SUBSCRIPTION_LIMITS.pro.name,
  premium: SUBSCRIPTION_LIMITS.premium.name,
};

export function SubscriptionGate({
  requiredTier,
  currentTier,
  feature = "Эта функция",
  children,
}: SubscriptionGateProps) {
  const [, setLocation] = useLocation();
  
  const hasAccess =
    tierHierarchy[currentTier] >= tierHierarchy[requiredTier];

  if (hasAccess) {
    return <>{children}</>;
  }
  
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-30 blur-sm select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-4 bg-gradient-to-b from-black/5 to-black/10 dark:from-white/5 dark:to-white/10 rounded-lg">
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 px-8 py-6 text-center shadow-2xl backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 dark:bg-amber-500/15 ring-4 ring-amber-500/10">
            <Lock className="h-7 w-7 text-amber-600 dark:text-amber-500" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            Недоступная функция
          </h3>
          <div className="mb-4 text-sm text-muted-foreground">
            <span className="block">{feature} требует тариф <span className="font-semibold text-amber-700 dark:text-amber-400">{tierNames[requiredTier]}</span></span>
          </div>
          <Button
            size="sm"
            className="mt-1 bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
            onClick={() => setLocation("/subscription")}
            data-testid="button-unlock-feature"
          >
            <Crown className="mr-2 h-4 w-4" />
            Обновить подписку
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UpgradeBanner({
  tier,
  feature,
}: {
  tier: SubscriptionTier;
  feature: string;
}) {
  const [, setLocation] = useLocation();
  
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
          <Crown className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">
            {feature} доступен в тарифе {tierNames[tier]}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
          onClick={() => setLocation("/subscription")}
          data-testid="button-upgrade-subscription"
        >
          Обновить
        </Button>
      </div>
    </div>
  );
}
