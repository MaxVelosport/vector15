import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Lock, CheckCircle, ArrowLeft } from "lucide-react";

export default function StudentResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    if (!t) setError("Токен отсутствует. Откройте ссылку из письма.");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Пароль должен быть не короче 6 символов"); return; }
    if (password !== confirm) { setError("Пароли не совпадают"); return; }
    setIsLoading(true);
    try {
      const res = await fetch("/api/student/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка сброса пароля"); return; }
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 1600);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <Card className="glass w-full max-w-md border-border/70">
          <CardHeader className="space-y-1 pb-6">
            <div className="mb-2 flex justify-center">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${success ? "bg-green-500/10" : "bg-primary/10"}`}>
                {success ? <CheckCircle className="h-8 w-8 text-green-500" /> : <KeyRound className="h-8 w-8 text-primary" />}
              </div>
            </div>
            <CardTitle className="text-center font-serif text-2xl font-semibold tracking-tight">
              {success ? "Пароль обновлён" : "Новый пароль"}
            </CardTitle>
            {!success && (
              <p className="text-center text-sm text-muted-foreground">Задайте новый пароль для входа в кабинет ученика.</p>
            )}
          </CardHeader>
          <CardContent>
            {success ? (
              <a href="/login">
                <Button variant="outline" className="w-full gap-2" data-testid="link-back-to-login">
                  <ArrowLeft className="h-4 w-4" />
                  Войти
                </Button>
              </a>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Новый пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                      data-testid="input-student-new-password"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Повторите пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="pl-10"
                      required
                      data-testid="input-student-confirm-password"
                    />
                  </div>
                </div>
                {error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>
                )}
                <Button type="submit" className="w-full" disabled={isLoading || !token} data-testid="button-student-reset-submit">
                  {isLoading ? "Сохранение..." : "Сохранить пароль"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
