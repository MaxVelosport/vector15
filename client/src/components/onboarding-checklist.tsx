import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, Circle, X, Rocket, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import type { Student, Lesson, Payment, Homework } from "@shared/schema";

const DISMISS_KEY = "onboarding_checklist_dismissed";

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(false);

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
      cta: "Добавить",
    },
    {
      id: "lesson",
      title: "Запланируйте занятие",
      desc: "Поставьте первый урок в расписание",
      done: lessons.length > 0,
      href: "/schedule",
      cta: "В расписание",
    },
    {
      id: "homework",
      title: "Создайте домашнее задание",
      desc: "Выдайте ученику первое задание",
      done: homework.length > 0,
      href: "/homework",
      cta: "К домашкам",
    },
    {
      id: "payment",
      title: "Зафиксируйте оплату",
      desc: "Запишите первый платёж ученика",
      done: payments.length > 0,
      href: "/finance",
      cta: "К финансам",
    },
    {
      id: "avatar",
      title: "Загрузите фото профиля",
      desc: "Это первое, что увидят ваши ученики",
      done: hasAvatar,
      href: "/profile",
      cta: "Загрузить",
    },
    {
      id: "public",
      title: "Опубликуйте свою страницу",
      desc: "Получите личную ссылку для новых учеников и отзывов",
      done: hasPublicProfile,
      href: "/profile",
      cta: "Настроить",
    },
  ], [students.length, lessons.length, payments.length, homework.length, hasAvatar, hasPublicProfile]);

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const progress = (doneCount / steps.length) * 100;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (dismissed || allDone) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        data-testid="onboarding-checklist"
      >
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <Rocket className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base">
                    Быстрый старт: {doneCount} из {steps.length}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Настройте платформу за 10 минут
                  </p>
                </div>
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

            <Progress value={progress} className="h-1.5 mb-4" />

            <div className="grid gap-2 sm:grid-cols-2">
              {steps.map((step) => (
                <Link
                  key={step.id}
                  href={step.href}
                  className={`group flex items-center gap-3 rounded-lg border p-3 transition-all ${
                    step.done
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                  data-testid={`checklist-step-${step.id}`}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : ""}`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{step.desc}</div>
                  </div>
                  {!step.done && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
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
