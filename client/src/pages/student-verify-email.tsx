import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";

export default function StudentVerifyEmail() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) { setStatus("error"); setError("Токен отсутствует"); return; }
    fetch(`/api/student/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Ошибка подтверждения"); }
        else setStatus("success");
      })
      .catch(() => { setStatus("error"); setError("Ошибка соединения"); });
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <Card className="glass w-full max-w-md border-border/70">
          <CardHeader className="space-y-1 pb-6">
            <div className="mb-2 flex justify-center">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                status === "success" ? "bg-green-500/10" : status === "error" ? "bg-red-500/10" : "bg-primary/10"
              }`}>
                {status === "loading" && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
                {status === "success" && <CheckCircle className="h-8 w-8 text-green-500" />}
                {status === "error" && <XCircle className="h-8 w-8 text-red-500" />}
              </div>
            </div>
            <CardTitle className="text-center font-serif text-2xl font-semibold tracking-tight">
              {status === "loading" && "Проверка..."}
              {status === "success" && "Email подтверждён"}
              {status === "error" && "Не удалось подтвердить"}
            </CardTitle>
            {status === "success" && (
              <p className="text-center text-sm text-muted-foreground">
                Теперь вы можете самостоятельно восстанавливать пароль.
              </p>
            )}
            {status === "error" && error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}
          </CardHeader>
          <CardContent>
            <a href="/student">
              <Button variant="outline" className="w-full gap-2" data-testid="link-to-student-portal">
                В кабинет
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
