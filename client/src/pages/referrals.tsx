import { useQuery } from "@tanstack/react-query";
import { Copy, Gift, Users, Sparkles, Check } from "lucide-react";
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";

import { useDocumentTitle } from "@/hooks/use-document-title";
interface ReferralsData {
  referralCode: string | null;
  totalReferred: number;
  activeReferred: number;
  referred: Array<{
    id: string;
    name: string;
    email: string;
    subscription: string;
    createdAt: string;
  }>;
}

export default function ReferralsPage() {
  useDocumentTitle("Реферальная программа");
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<ReferralsData>({
    queryKey: ["/api/referrals/me"],
  });

  const shareLink = data?.referralCode
    ? `${window.location.origin}/register?ref=${data.referralCode}`
    : "";

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success("Ссылка скопирована");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">
              Реферальная программа
            </h1>
            <p className="text-sm text-muted-foreground">
              Приглашайте коллег — получайте бонусы
            </p>
          </div>
        </div>

        {/* Main card with code */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Ваша реферальная ссылка
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 rounded-lg border border-border bg-background/50 px-4 py-3 font-mono text-sm break-all" data-testid="text-referral-link">
                    {shareLink || "Генерация..."}
                  </div>
                  <Button
                    onClick={handleCopy}
                    className="gap-2 shrink-0"
                    disabled={!shareLink}
                    data-testid="button-copy-referral"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Скопировано" : "Копировать"}
                  </Button>
                </div>
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm">
                  <p className="font-semibold mb-1">🎁 Как это работает:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Поделитесь ссылкой с коллегой-репетитором</li>
                    <li>• Он регистрируется и оформляет подписку</li>
                    <li>• Вы получаете +1 месяц подписки бесплатно за каждого</li>
                    <li>• Приглашённый получает скидку 20% на первый месяц</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold" data-testid="stat-total-referred">
                    {data?.totalReferred ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Всего приглашено</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold text-primary" data-testid="stat-active-referred">
                    {data?.activeReferred ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">С активной подпиской</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referred list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ваши приглашённые</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.referred?.length ?? 0) === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Пока никого нет. Поделитесь ссылкой, чтобы начать!
              </div>
            ) : (
              <div className="space-y-2">
                {data?.referred.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                    data-testid={`row-referred-${r.id}`}
                  >
                    <div>
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </div>
                    <Badge variant={r.subscription === "free" ? "secondary" : "default"}>
                      {r.subscription === "free" ? "Free" : r.subscription === "pro" ? "Pro" : "Premium"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
