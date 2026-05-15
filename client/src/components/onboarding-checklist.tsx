import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, Circle, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/lib/toast";
import { fireCelebration } from "@/lib/confetti";
import { cn } from "@/lib/utils";
import type { Student, Lesson, Payment, Homework } from "@shared/schema";

const DISMISS_KEY = "onboarding_checklist_dismissed";

function CircularProgress({ value, allDone }: { value: number; allDone: boolean }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} strokeWidth="5" fill="none"
          className="text-muted-foreground/20" stroke="currentColor" />
        <circle
          cx="32" cy="32" r={radius} strokeWidth="5" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          className={cn(
            "transition-all duration-500",
            allDone ? "text-amber-500" : "text-primary"
          )}
        />
      </svg>
      <div className={cn(
        "absolute inset-0 flex items-center justify-center text-sm font-bold",
        allDone && "animate-pulse"
      )}>
        {allDone ? "🏆" : `${Math.round(value)}%`}
      </div>
    </div>
  );
}

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    }
  }, []);

  const { user } = useAuth() as any;
  const { data: students = [] } = useQuery<Student[]>({ queryKey: ["/api/students"] });
  const { data: lessons = [] } = useQuery<Lesson[]>({ queryKey: ["/api/lessons"] });
  const { data: payments = [] } = useQuery<Payment[]>({ queryKey: ["/api/payments"] });
  const { data: homework = [] } = useQuery<Homework[]>({ queryKey: ["/api/homework"] });

  const hasAvatar = Boolean(user?.avatar);
  const hasPublicProfile = Boolean(user?.publicSlug && user?.isPublicProfile);

  const steps = useMemo(() => [
    {
      id: "student",
      title: "Добавьте первого ученика",
      desc: "Создайте карточку ученика с предметом и целью",
      done: students.length > 0,
      href: "/students",
    },
    {
      id: "lesson",
      title: "Запланируйте занятие",
      desc: "Поставьте первый урок в расписание",
      done: lessons.length > 0,
      href: "/schedule",
    },
    {
      id: "homework",
      title: "Создайте домашнее задание",
      desc: "Выдайте ученику первое задание",
      done: homework.length > 0,
      href: "/homework",
    },
    {
      id: "payment",
      title: "Зафиксируйте оплату",
      desc: "Запишите первый платёж ученика",
      done: payments.length > 0,
      href: "/finance",
    },
    {
      id: "avatar",
      title: "Загрузите фото профиля",
      desc: "Это первое, что увидят ваши ученики",
      done: hasAvatar,
      href: "/profile",
    },
    {
      id: "public",
      title: "Опубликуйте свою страницу",
      desc: "Получите личную ссылку для новых учеников",
      done: hasPublicProfile,
      href: "/profile",
    },
  ], [students.length, lessons.length, payments.length, homework.length, hasAvatar, hasPublicProfile]);

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const progress = (doneCount / steps.length) * 100;

  useEffect(() => {
    if (allDone && !celebrated && !localStorage.getItem("checklist-celebrated")) {
      fireCelebration();
      localStorage.setItem("checklist-celebrated", "1");
      setCelebrated(true);
      toast.success("🏆 Все настройки завершены!", { description: "Отличная работа!"  });
    }
  }, [allDone, celebrated, toast]);

  // Авто-скрытие через 3 сек после завершения
  useEffect(() => {
    if (allDone && celebrated) {
      const timer = setTimeout(() => {
        localStorage.setItem(DISMISS_KEY, "1");
        setDismissed(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [allDone, celebrated]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        data-testid="onboarding-checklist"
      >
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent overflow-hidden">
          <CardContent className="p-0">
            {/* Шапка с круговым прогрессом */}
            <div className="flex items-center gap-4 p-4 sm:p-5 border-b border-border/50">
              <CircularProgress value={progress} allDone={allDone} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base">
                  {allDone ? "🏆 Готово!" : "Прогресс настройки"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {allDone
                    ? "Все шаги завершены!"
                    : `${doneCount} из ${steps.length} шагов выполнено`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={handleDismiss}
                data-testid="button-dismiss-checklist"
                aria-label="Скрыть"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Список шагов */}
            <div className="grid gap-1.5 sm:grid-cols-2 p-3 sm:p-4">
              {steps.map((step) => (
                <Link
                  key={step.id}
                  href={step.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg border p-3 transition-colors duration-300",
                    step.done
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                  data-testid={`checklist-step-${step.id}`}
                >
                  <motion.div
                    initial={false}
                    animate={step.done ? { scale: 1 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="shrink-0"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {step.done ? (
                        <motion.div
                          key="done"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        >
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="pending"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                        >
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-sm font-medium transition-all duration-300",
                      step.done ? "line-through opacity-60" : ""
                    )}>
                      {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{step.desc}</div>
                  </div>
                  {!step.done && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
