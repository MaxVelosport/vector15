import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/lib/toast";
import { Mail, Lock, CheckCircle2, AlertTriangle, Send } from "lucide-react";

type StudentMe = {
  id: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
};

export default function StudentProfilePage() {
  const { data: me, isLoading } = useQuery<StudentMe>({
    queryKey: ["student-auth"],
    queryFn: async () => {
      const r = await fetch("/api/student/auth/me", { credentials: "include" });
      if (!r.ok) throw new Error("unauthenticated");
      return r.json();
    },
  });

  const [email, setEmail] = useState("");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const updateProfile = useMutation({
    mutationFn: async (body: any) => {
      const r = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-auth"] });
    },
  });

  const sendVerification = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/student/auth/send-verification", {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      return d;
    },
    onSuccess: () => toast.success("Письмо отправлено", { description: "Проверьте почту — перейдите по ссылке."  }),
    onError: (e: any) => toast.error("Ошибка", { description: e.message }),
  });

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Укажите email"); return; }
    try {
      await updateProfile.mutateAsync({ email: email.trim().toLowerCase() });
      toast.success("Email обновлён", { description: "Подтвердите новый адрес."  });
      setEmail("");
    } catch (err: any) {
      toast.error("Не удалось сохранить", { description: err.message });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) { toast.error("Пароль короче 6 символов"); return; }
    if (newPass !== confirmPass) { toast.error("Пароли не совпадают"); return; }
    try {
      await updateProfile.mutateAsync({ currentPassword: curPass, newPassword: newPass });
      toast.success("Пароль обновлён");
      setCurPass(""); setNewPass(""); setConfirmPass("");
    } catch (err: any) {
      toast.error("Не удалось сменить пароль", { description: err.message });
    }
  };

  if (isLoading || !me) {
    return <div className="p-6 text-sm text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="container max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="title-student-profile">Профиль</h1>
        <p className="text-sm text-muted-foreground mt-1">Email и пароль для входа в личный кабинет.</p>
      </div>

      {/* Email + verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email для входа
          </CardTitle>
          <CardDescription>
            Подтверждённый email нужен, чтобы самостоятельно восстанавливать пароль.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Текущий email</div>
              <div className="font-medium truncate" data-testid="text-current-email">{me.email || "—"}</div>
            </div>
            {me.email ? (
              me.emailVerified ? (
                <Badge className="gap-1 bg-green-500/15 text-green-700 hover:bg-green-500/20 dark:text-green-400" data-testid="badge-email-verified">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Подтверждён
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400" data-testid="badge-email-unverified">
                  <AlertTriangle className="h-3.5 w-3.5" /> Не подтверждён
                </Badge>
              )
            ) : (
              <Badge variant="outline">не задан</Badge>
            )}
          </div>

          {me.email && !me.emailVerified && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
              <p className="text-amber-800 dark:text-amber-300">
                Без подтверждённой почты восстановление пароля работать не будет. В случае утери пароля останется только обратиться к репетитору.
              </p>
              <Button
                size="sm"
                variant="default"
                className="mt-2 gap-1.5"
                disabled={sendVerification.isPending}
                onClick={() => sendVerification.mutate()}
                data-testid="button-send-verification"
              >
                <Send className="h-3.5 w-3.5" />
                {sendVerification.isPending ? "Отправка..." : "Отправить письмо подтверждения"}
              </Button>
            </div>
          )}

          <Separator />

          <form onSubmit={handleSaveEmail} className="space-y-3">
            <label className="text-sm font-medium">Сменить email</label>
            <Input
              type="email"
              placeholder="new@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-new-email"
            />
            <p className="text-xs text-muted-foreground">После смены email нужно будет подтвердить его заново.</p>
            <Button type="submit" disabled={updateProfile.isPending} data-testid="button-save-email">
              {updateProfile.isPending ? "Сохранение..." : "Сохранить email"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Пароль
          </CardTitle>
          <CardDescription>
            Для смены пароля потребуется текущий пароль.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Текущий пароль</label>
              <Input
                type="password"
                value={curPass}
                onChange={(e) => setCurPass(e.target.value)}
                required
                data-testid="input-current-password"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Новый пароль</label>
              <Input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                minLength={6}
                required
                data-testid="input-new-password"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Повторите новый пароль</label>
              <Input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                required
                data-testid="input-confirm-password"
              />
            </div>
            <Button type="submit" disabled={updateProfile.isPending} data-testid="button-change-password">
              {updateProfile.isPending ? "Сохранение..." : "Сменить пароль"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
