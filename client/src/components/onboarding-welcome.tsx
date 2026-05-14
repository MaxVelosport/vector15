import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, GraduationCap, Compass, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useStudents } from "@/hooks/use-tutor-data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const WELCOMED_KEY = "onboarding-welcomed";
const WIZARD_KEY = "onboarding_wizard_v1";

export function OnboardingWelcome() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: students = [], isLoading: studentsLoading } = useStudents();
  const [open, setOpen] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading || studentsLoading) return;
    if (!isAuthenticated || !user) return;
    if (user.email === "demo@vector.ru") return;
    if (localStorage.getItem(WELCOMED_KEY)) return;
    if ((user.subjects?.length ?? 0) > 0) return;
    if (students.length > 0) return;

    const timer = setTimeout(() => {
      // Подавляем авто-открытие Wizard пока открыт Welcome
      if (!localStorage.getItem(WIZARD_KEY)) {
        localStorage.setItem(WIZARD_KEY, "suppressed-by-welcome");
      }
      setOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [authLoading, studentsLoading, isAuthenticated, user, students.length]);

  const markWelcomed = () => localStorage.setItem(WELCOMED_KEY, "1");

  const dismiss = () => {
    markWelcomed();
    // Снимаем подавление Wizard при dismissе
    if (localStorage.getItem(WIZARD_KEY) === "suppressed-by-welcome") {
      localStorage.removeItem(WIZARD_KEY);
    }
    setOpen(false);
  };

  const handleWizard = () => {
    markWelcomed();
    if (localStorage.getItem(WIZARD_KEY) === "suppressed-by-welcome") {
      localStorage.removeItem(WIZARD_KEY);
    }
    setOpen(false);
    setTimeout(() => window.dispatchEvent(new CustomEvent("trigger-onboarding-wizard")), 100);
  };

  const handleTour = () => {
    markWelcomed();
    // Wizard остаётся подавленным — тур вместо него
    setOpen(false);
    setTimeout(() => window.dispatchEvent(new CustomEvent("trigger-onboarding-tour")), 100);
  };

  const handleDemo = async () => {
    if (students.length > 0) {
      toast({
        title: "Демо недоступно",
        description: "У вас уже есть данные. Demo доступен только для новых аккаунтов.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Это создаст 5 примерных учеников с занятиями и платежами. Продолжить?")) return;

    setLoadingDemo(true);
    try {
      const res = await fetch("/api/onboarding/load-demo", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка при создании демо-данных");
      }
      markWelcomed();
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
      setLoadingDemo(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-[8px] bg-black/70 z-[9998]" />
        <DialogPrimitive.Content
          aria-describedby="welcome-desc"
          className={cn(
            "fixed left-[50%] top-[50%] z-[9999]",
            "w-[calc(100vw-2rem)] max-w-[480px]",
            "translate-x-[-50%] translate-y-[-50%]",
            "rounded-2xl overflow-hidden shadow-2xl border-0",
            "bg-background",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "duration-200"
          )}
        >
          {/* Шапка с градиентом */}
          <div className="relative overflow-hidden px-8 pt-8 pb-6 text-center bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 mb-4 animate-pulse">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <DialogPrimitive.Title className="text-3xl font-bold text-white leading-tight mb-2">
                Добро пожаловать<br />в Твой Вектор!
              </DialogPrimitive.Title>
              <p id="welcome-desc" className="text-base text-white/80">
                Давайте настроим ваш кабинет. С чего начнём?
              </p>
            </div>
          </div>

          {/* Карточки-кнопки */}
          <div className="px-6 py-5 space-y-3">
            <button
              onClick={handleWizard}
              className={cn(
                "w-full text-left rounded-xl border-2 border-border p-4",
                "hover:border-primary hover:scale-[1.02] active:scale-100",
                "transition-all duration-150 group",
                "bg-card hover:bg-accent/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <GraduationCap className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <div className="font-semibold text-sm leading-tight">У меня нет учеников — помоги начать</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Пройдём мастер настройки за 5 минут</div>
                </div>
              </div>
            </button>

            <button
              onClick={handleDemo}
              disabled={loadingDemo}
              className={cn(
                "w-full text-left rounded-xl border-2 border-border p-4",
                "hover:border-primary hover:scale-[1.02] active:scale-100",
                "transition-all duration-150 group",
                "bg-card hover:bg-accent/30",
                "disabled:opacity-60 disabled:pointer-events-none"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                  {loadingDemo
                    ? <Loader2 className="h-5 w-5 text-purple-500 animate-spin" />
                    : <Sparkles className="h-5 w-5 text-purple-500" />
                  }
                </div>
                <div>
                  <div className="font-semibold text-sm leading-tight">Посмотреть как это работает</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Загрузим примеры — 5 учеников, занятия, платежи</div>
                </div>
              </div>
            </button>

            <button
              onClick={handleTour}
              className={cn(
                "w-full text-left rounded-xl border-2 border-border p-4",
                "hover:border-primary hover:scale-[1.02] active:scale-100",
                "transition-all duration-150 group",
                "bg-card hover:bg-accent/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center group-hover:bg-pink-500/20 transition-colors">
                  <Compass className="h-5 w-5 text-pink-500" />
                </div>
                <div>
                  <div className="font-semibold text-sm leading-tight">Просто покажу что есть</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Тур по интерфейсу за 1 минуту</div>
                </div>
              </div>
            </button>
          </div>

          {/* Ссылка-dismissal */}
          <div className="px-6 pb-6 text-center">
            <button
              onClick={dismiss}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              Я разберусь сам
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
