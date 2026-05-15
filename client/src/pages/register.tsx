import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, User, Lock, Mail, Gift } from "lucide-react";
import { toast } from "@/lib/toast";

import { useDocumentTitle } from "@/hooks/use-document-title";
export default function Register() {
  useDocumentTitle("Регистрация");
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(ref.trim().toUpperCase());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    if (!consentChecked) {
      setError("Необходимо принять условия и политику конфиденциальности");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          subjects: [],
          referralCode: referralCode.trim().toUpperCase() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка регистрации");
        return;
      }

      toast.success("Регистрация успешна!", { description: "Добро пожаловать в Твой Вектор!" });
      setLocation("/login");
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-35" />

      <div className="relative flex min-h-screen items-center justify-center px-4">
        <Card className="glass w-full max-w-md border-border/70">
          <CardHeader className="space-y-1 pb-6">
            <div className="mb-2 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-center font-serif text-2xl font-semibold tracking-tight">
              Твой Вектор
            </CardTitle>
            <p className="text-center text-sm text-muted-foreground">
              Создайте аккаунт репетитора
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground" htmlFor="name">
                  Ваше имя
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Иван Петров"
                    className="pl-10"
                    required
                    data-testid="input-register-name"
                  />
                </div>
              </div>

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
                    data-testid="input-register-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground" htmlFor="password">
                  Пароль
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                    data-testid="input-register-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground" htmlFor="confirmPassword">
                  Подтвердите пароль
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                    data-testid="input-register-confirm-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground" htmlFor="referral">
                  Реферальный код <span className="text-xs">(необязательно)</span>
                </label>
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="referral"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="ABC12345"
                    className="pl-10 uppercase tracking-wider font-mono"
                    maxLength={12}
                    data-testid="input-register-referral"
                  />
                </div>
                {referralCode && (
                  <p className="text-xs text-primary">🎁 Скидка 20% на первый месяц</p>
                )}
              </div>

              {/* Согласие на обработку персональных данных (152-ФЗ) */}
              <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
                <label className="flex cursor-pointer items-start gap-3" htmlFor="consent">
                  <div className="relative mt-0.5 shrink-0">
                    <input
                      id="consent"
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="peer h-4 w-4 cursor-pointer rounded border-border accent-primary"
                      data-testid="checkbox-register-consent"
                    />
                  </div>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    Я даю{" "}
                    <strong className="text-foreground">согласие на обработку персональных данных</strong>{" "}
                    в соответствии с Федеральным законом № 152-ФЗ «О персональных данных» и принимаю условия{" "}
                    <a
                      href="/legal/oferta"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 hover:text-primary/80"
                      data-testid="link-consent-oferta"
                    >
                      публичной оферты
                    </a>{" "}
                    и{" "}
                    <a
                      href="/legal/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 hover:text-primary/80"
                      data-testid="link-consent-privacy"
                    >
                      политики конфиденциальности
                    </a>
                    .
                  </span>
                </label>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isLoading || !consentChecked}
                data-testid="button-register-submit"
              >
                {isLoading ? "Регистрация..." : "Зарегистрироваться"}
                <UserPlus className="h-4 w-4" />
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Уже есть аккаунт?{" "}
                <a
                  href="/login"
                  className="text-primary hover:underline"
                  data-testid="link-to-login"
                >
                  Войти
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
