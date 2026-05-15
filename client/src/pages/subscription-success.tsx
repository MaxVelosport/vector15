import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle, Clock, AlertCircle, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/lib/toast";
import { useDocumentTitle } from "@/hooks/use-document-title";

type PageState = "checking" | "polling" | "success" | "timeout" | "unauthenticated";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 10; // 10 × 3s = 30s

export default function SubscriptionSuccessPage() {
  useDocumentTitle("Оплата прошла");
  const [, setLocation] = useLocation();
  const [pageState, setPageState] = useState<PageState>("checking");
  const [secondsLeft, setSecondsLeft] = useState(30);

  const initialPlan = useRef<string | null>(null);
  const pollCount = useRef(0);
  const didRedirect = useRef(false);

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>;
    let ticker: ReturnType<typeof setInterval>;

    function handleSuccess() {
      if (didRedirect.current) return;
      didRedirect.current = true;
      setPageState("success");
      clearInterval(pollTimer);
      clearInterval(ticker);
      setTimeout(() => {
        toast.success("Подписка активирована!");
        setLocation("/subscription");
      }, 1500);
    }

    async function tick() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });

        if (res.status === 401) {
          setPageState("unauthenticated");
          clearInterval(pollTimer);
          clearInterval(ticker);
          return;
        }

        const data = await res.json();
        const plan: string = data?.subscription ?? "free";

        if (pollCount.current === 0) {
          initialPlan.current = plan;
          // Webhook успел сработать раньше чем пользователь вернулся
          if (plan !== "free") {
            handleSuccess();
            return;
          }
          setPageState("polling");
        }

        pollCount.current += 1;

        if (plan !== initialPlan.current) {
          handleSuccess();
          return;
        }

        if (pollCount.current >= MAX_POLLS) {
          setPageState("timeout");
          clearInterval(pollTimer);
          clearInterval(ticker);
        }
      } catch {
        // сетевая ошибка — продолжаем попытки
      }
    }

    ticker = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    tick();
    pollTimer = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollTimer);
      clearInterval(ticker);
    };
  }, [setLocation]);

  const progress = Math.round(((30 - secondsLeft) / 30) * 100);

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-30" />

      <div className="relative mx-auto flex min-h-screen max-w-lg items-center justify-center px-6 py-16">
        <Card className="glass w-full">
          <CardContent className="p-8">
            {/* Иконка состояния */}
            <div className="mb-6 flex justify-center">
              {pageState === "checking" && (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {pageState === "polling" && (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <CheckCircle className="h-8 w-8 animate-pulse text-primary" />
                </div>
              )}
              {pageState === "success" && (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
              )}
              {pageState === "timeout" && (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
              )}
              {pageState === "unauthenticated" && (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              )}
            </div>

            {/* Заголовок */}
            <div className="mb-2 text-center text-2xl font-semibold tracking-tight">
              {pageState === "checking" && "Проверяем оплату…"}
              {pageState === "polling" && "Оплата прошла успешно!"}
              {pageState === "success" && "Подписка активирована!"}
              {pageState === "timeout" && "Оплата прошла успешно!"}
              {pageState === "unauthenticated" && "Оплата принята"}
            </div>

            {/* Подзаголовок */}
            <p className="mb-6 text-center text-sm text-muted-foreground">
              {pageState === "checking" &&
                "Секунду…"}
              {pageState === "polling" &&
                "Ваша подписка активируется в течение нескольких секунд. Ожидаем подтверждение от платёжной системы."}
              {pageState === "success" &&
                "Переходим в личный кабинет…"}
              {pageState === "timeout" && (
                <>
                  Оплата была принята, но активация задерживается. Обычно это занимает до 5 минут.{" "}
                  Если подписка не появится — напишите на{" "}
                  <a
                    href="mailto:support@tvoyvector.ru"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    support@tvoyvector.ru
                  </a>
                </>
              )}
              {pageState === "unauthenticated" && (
                <>
                  Деньги успешно списаны. Войдите в аккаунт — подписка будет активирована автоматически
                  после входа или в течение нескольких минут.
                </>
              )}
            </p>

            {/* Прогресс-бар (только при polling) */}
            {pageState === "polling" && (
              <div className="mb-6">
                <Progress value={progress} className="h-1.5" />
                <p className="mt-1.5 text-right text-xs text-muted-foreground">
                  {secondsLeft} сек
                </p>
              </div>
            )}

            {/* Кнопки */}
            <div className="flex flex-col gap-3">
              {pageState === "unauthenticated" ? (
                <Link href="/login">
                  <Button className="w-full gap-2">
                    <LogIn className="h-4 w-4" />
                    Войти в аккаунт
                  </Button>
                </Link>
              ) : (
                <Link href="/subscription">
                  <Button
                    className="w-full"
                    variant={pageState === "polling" ? "outline" : "default"}
                  >
                    Перейти к подписке
                  </Button>
                </Link>
              )}

              {pageState !== "unauthenticated" && (
                <Link href="/">
                  <Button variant="ghost" className="w-full text-muted-foreground">
                    На главную
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
