import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Mail, ArrowLeft, CheckCircle } from "lucide-react";

import { useDocumentTitle } from "@/hooks/use-document-title";
export default function ForgotPassword() {
  useDocumentTitle("Восстановление пароля");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка отправки");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="relative min-h-screen bg-background">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-35" />

        <div className="relative flex min-h-screen items-center justify-center px-4">
          <Card className="glass w-full max-w-md border-border/70">
            <CardHeader className="space-y-1 pb-6">
              <div className="mb-2 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </div>
              <CardTitle className="text-center font-serif text-2xl font-semibold tracking-tight">
                Письмо отправлено
              </CardTitle>
              <p className="text-center text-sm text-muted-foreground">
                Если аккаунт с таким email существует, мы отправили инструкции по восстановлению пароля
              </p>
            </CardHeader>
            <CardContent>
              <a href="/login">
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Вернуться к входу
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-35" />

      <div className="relative flex min-h-screen items-center justify-center px-4">
        <Card className="glass w-full max-w-md border-border/70">
          <CardHeader className="space-y-1 pb-6">
            <div className="mb-2 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <KeyRound className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-center font-serif text-2xl font-semibold tracking-tight">
              Восстановление пароля
            </CardTitle>
            <p className="text-center text-sm text-muted-foreground">
              Введите email, и мы отправим ссылку для сброса пароля
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tutor@example.com"
                    className="pl-10"
                    required
                    data-testid="input-forgot-email"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isLoading}
                data-testid="button-forgot-submit"
              >
                {isLoading ? "Отправка..." : "Отправить ссылку"}
              </Button>

              <div className="text-center">
                <a
                  href="/login"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  data-testid="link-back-to-login"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Вернуться к входу
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
