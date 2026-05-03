import { useEffect, useState } from "react";
import { useLocation, Switch, Route } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { XCircle, Loader2 } from "lucide-react";
import { StudentLayout } from "@/components/student-layout";
import StudentHome from "./student/home";
import StudentLessons from "./student/lessons";
import StudentHomework from "./student/homework";
import StudentQuiz from "./student/quiz";
import StudentFinance from "./student/finance";
import StudentAiChat from "./student/ai-chat";
import StudentBoard from "./student/board";
import StudentNotes from "./student/notes";
import StudentMessages from "./student/messages";
import StudentConference from "./student/conference";
import StudentHelpPage from "./student/help";
import StudentProfilePage from "./student/profile";
import StudentProgress from "./student/progress";
import StudentTasks from "./student/tasks";
import StudentRecordings from "./student/recordings";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Ошибка загрузки данных");
  return res.json();
}

interface StudentInfo {
  id: string;
  name: string;
  subject: string;
  goal: string;
  grade: string;
  progress: number;
  balance: number;
  curriculumTopic: string;
  links?: { conference?: string; board?: string };
  pricePerLesson: number;
}

interface Lesson {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  topic: string;
  status: string;
  attendance?: string;
  rating?: number;
  notes?: string;
}

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  comment?: string;
  createdAt: string;
}

interface Homework {
  id: string;
  title: string;
  description?: string;
  completionPct: number;
  status: string;
  deadline?: string;
  feedback?: string;
  score?: number;
  hints?: string;
  attachments?: string[];
  solutionAttachments?: string[];
  solutionText?: string;
  submittedAt?: string;
}

export default function StudentPortal() {
  const [location, setLocation] = useLocation();
  const [activeHomeworkId, setActiveHomeworkId] = useState<string | undefined>();
  // Инициализируем синхронно, чтобы первый запуск student-auth query не срабатывал,
  // пока не завершится обмен токена из URL или Telegram WebApp авторизация.
  const [exchangingToken, setExchangingToken] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (new URLSearchParams(window.location.search).has("token")) return true;
    // Telegram Mini App: есть initData — нужно обменять её на сессию
    const tg: any = (window as any).Telegram?.WebApp;
    if (tg?.initData && tg.initData.length > 0) return true;
    return false;
  });
  const qc = useQueryClient();

  // Telegram Mini App: применяем тему, разворачиваем на весь экран,
  // обмениваем initData на сессию.
  useEffect(() => {
    const tg: any = (window as any).Telegram?.WebApp;
    if (!tg || !tg.initData) return;

    try { tg.ready(); } catch {}
    try { tg.expand(); } catch {}
    try { tg.setHeaderColor?.("secondary_bg_color"); } catch {}
    try { tg.enableClosingConfirmation?.(); } catch {}

    // Темизация: применяем dark/light в соответствии с Telegram
    try {
      const scheme = tg.colorScheme as "light" | "dark" | undefined;
      if (scheme === "dark") document.documentElement.classList.add("dark");
      else if (scheme === "light") document.documentElement.classList.remove("dark");
    } catch {}

    // Помечаем body, чтобы CSS мог скрыть лишние элементы
    document.body.classList.add("telegram-webapp");

    (async () => {
      try {
        const res = await fetch("/api/student/auth/telegram-webapp", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData }),
        });
        if (res.ok) {
          await qc.invalidateQueries({ queryKey: ["student-auth"] });
        } else {
          // 404 = аккаунт не привязан, оставим обычный экран логина
          // с подсказкой; ниже отрисуется fallback.
        }
      } catch {
        // ignore
      } finally {
        setExchangingToken(false);
      }
    })();
  }, [qc]);

  // Обмен ?token=... из ссылки доступа на сессию (ссылки от репетитора)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) return;
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      const search = url.searchParams.toString();
      window.history.replaceState({}, "", url.pathname + (search ? `?${search}` : "") + url.hash);
    };
    (async () => {
      try {
        const res = await fetch(`/api/student/auth/token/${encodeURIComponent(token)}`, { credentials: "include" });
        if (res.ok) {
          await qc.invalidateQueries({ queryKey: ["student-auth"] });
        }
      } catch {
        // ignore
      } finally {
        // Всегда удаляем token из URL — и при успехе, и при ошибке,
        // чтобы одноразовый токен не остался видимым и не утёк в истории/реферрерах.
        cleanUrl();
        setExchangingToken(false);
      }
    })();
  }, [qc]);

  const { data: student, isLoading: authLoading, error: authError } = useQuery<StudentInfo>({
    queryKey: ["student-auth"],
    queryFn: async () => {
      const res = await fetch("/api/student/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Не авторизован");
      return res.json();
    },
    retry: false,
    enabled: !exchangingToken,
  });

  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["student-lessons"],
    queryFn: () => fetchJson<Lesson[]>("/api/student/lessons"),
    enabled: !!student,
  });

  const { data: homework = [] } = useQuery<Homework[]>({
    queryKey: ["student-homework"],
    queryFn: () => fetchJson<Homework[]>("/api/student/homework"),
    enabled: !!student,
  });

  const { data: payments = [] } = useQuery<PaymentRecord[]>({
    queryKey: ["student-payments"],
    queryFn: () => fetchJson<PaymentRecord[]>("/api/student/payments"),
    enabled: !!student,
  });

  const logout = async () => {
    await fetch("/api/student/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setLocation("/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (authError || !student) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Требуется авторизация</h2>
            <p className="text-muted-foreground">
              Войдите в свой аккаунт ученика, чтобы получить доступ к личному кабинету.
            </p>
            <Button onClick={() => setLocation("/login")} variant="default">
              Войти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAskAi = (homeworkId: string) => {
    setActiveHomeworkId(homeworkId);
    setLocation("/student/ai");
  };

  if (location === "/student/board") {
    return (
      <div className="fixed inset-0 flex flex-col">
        <StudentBoard studentId={student.id} studentName={student.name} />
      </div>
    );
  }

  return (
    <StudentLayout studentName={student.name} onLogout={logout}>
      <Switch>
        <Route path="/student/lessons">
          <StudentLessons lessons={lessons} links={student.links} onOpenHomework={() => setLocation("/student/homework")} pricePerLesson={student.pricePerLesson} studentId={student.id} />
        </Route>
        <Route path="/student/homework">
          <StudentHomework homework={homework} onAskAi={handleAskAi} />
        </Route>
        <Route path="/student/quiz">
          <StudentQuiz />
        </Route>
        <Route path="/student/finance">
          <StudentFinance student={student} lessons={lessons} payments={payments} />
        </Route>
        <Route path="/student/conference">
          <StudentConference />
        </Route>
        <Route path="/student/notes">
          <StudentNotes />
        </Route>
        <Route path="/student/messages">
          <StudentMessages />
        </Route>
        <Route path="/student/ai">
          <StudentAiChat
            studentSubject={student.subject}
            activeHomeworkId={activeHomeworkId}
            onClearHomework={() => setActiveHomeworkId(undefined)}
          />
        </Route>
        <Route path="/student/progress">
          <StudentProgress />
        </Route>
        <Route path="/student/tasks">
          <StudentTasks />
        </Route>
        <Route path="/student/recording/:id">
          {(p) => <StudentRecordings id={p.id} />}
        </Route>
        <Route path="/student/recordings">
          <StudentRecordings />
        </Route>
        <Route path="/student/help">
          <StudentHelpPage />
        </Route>
        <Route path="/student/profile">
          <StudentProfilePage />
        </Route>
        <Route>
          <StudentHome student={student} lessons={lessons} homework={homework} payments={payments} studentId={student.id} />
        </Route>
      </Switch>
    </StudentLayout>
  );
}
