import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setError("Токен не указан");
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setError(data.error || "Ошибка подтверждения");
        } else {
          setStatus("success");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Ошибка соединения");
      });
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <Card className="glass w-full max-w-md border-border/70">
          <CardHeader className="space-y-1 pb-6 text-center">
            <div className="mb-2 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                {status === "loading" && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
                {status === "success" && <CheckCircle2 className="h-8 w-8 text-green-500" />}
                {status === "error" && <XCircle className="h-8 w-8 text-red-500" />}
              </div>
            </div>
            <CardTitle className="font-serif text-2xl font-semibold">
              {status === "loading" && "Проверяем..."}
              {status === "success" && "Email подтверждён!"}
              {status === "error" && "Не удалось подтвердить"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {status === "loading" && "Подождите, пожалуйста"}
              {status === "success" && "Спасибо! Теперь ваш аккаунт полностью активирован."}
              {status === "error" && error}
            </p>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full gap-2"
              onClick={() => setLocation("/")}
              data-testid="button-verify-continue"
            >
              <Mail className="h-4 w-4" />
              Продолжить
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
