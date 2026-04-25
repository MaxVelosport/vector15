import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import {
  Award, CheckCircle2, Flame, Star, Target, TrendingUp, BookOpen, Calendar, Trophy, Zap, Lock,
  Rocket, GraduationCap, BookMarked, Layers, Medal, Crown, Sparkles, ClipboardCheck, Timer,
  Gauge, ChevronRight,
} from "lucide-react";
import { LevelUpDialog } from "@/components/level-up-dialog";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface WeekStat {
  label: string;
  assigned: number;
  completed: number;
  avgGrade: number | null;
  lessons: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  category: string;
  hint?: string;
  progressValue?: number;
  progressMax?: number;
}

interface LevelInfo {
  level: number;
  name: string;
  xpCurrent: number;
  xpForNext: number | null;
  totalXp: number;
}

interface WeeklyGoal {
  hwTarget: number;
  hwDone: number;
  lessonTarget: number;
  lessonDone: number;
}

interface XpBreakdown {
  hw: number;
  lessons: number;
  grades: number;
  streak: number;
}

interface NextMilestone {
  id: string;
  title: string;
  hint?: string;
  progressValue?: number;
  progressMax?: number;
  category: string;
}

interface Motivation {
  greeting: string;
  message: string;
  tone: string;
  emoji: string;
}

interface ProgressData {
  studentId: string | number;
  totalHw: number;
  completedHw: number;
  submittedHw: number;
  completionPct: number;
  avgGrade: number | null;
  streak: number;
  hwStreak: number;
  bestHwStreak: number;
  weeklyStats: WeekStat[];
  achievements: Achievement[];
  recentGrades: { title: string; score: number; date: string }[];
  lessonsCompleted: number;
  levelInfo: LevelInfo;
  weeklyGoal: WeeklyGoal;
  xpBreakdown: XpBreakdown;
  nextMilestone: NextMilestone | null;
  motivation: Motivation;
}

const ACHIEVEMENT_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  first_hw:      { icon: BookOpen,       color: "text-blue-500",    bg: "bg-blue-100 dark:bg-blue-950" },
  hw_5:          { icon: CheckCircle2,   color: "text-green-500",   bg: "bg-green-100 dark:bg-green-950" },
  hw_10:         { icon: ClipboardCheck, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-950" },
  hw_20:         { icon: Layers,         color: "text-teal-500",    bg: "bg-teal-100 dark:bg-teal-950" },
  hw_50:         { icon: Trophy,         color: "text-purple-500",  bg: "bg-purple-100 dark:bg-purple-950" },
  speed_run:     { icon: Timer,          color: "text-pink-500",    bg: "bg-pink-100 dark:bg-pink-950" },
  first_lesson:  { icon: GraduationCap,  color: "text-sky-500",     bg: "bg-sky-100 dark:bg-sky-950" },
  lessons_5:     { icon: Calendar,       color: "text-indigo-500",  bg: "bg-indigo-100 dark:bg-indigo-950" },
  lessons_10:    { icon: BookMarked,     color: "text-violet-500",  bg: "bg-violet-100 dark:bg-violet-950" },
  lessons_25:    { icon: Medal,          color: "text-blue-600",    bg: "bg-blue-100 dark:bg-blue-950" },
  first_five:    { icon: Star,           color: "text-yellow-500",  bg: "bg-yellow-100 dark:bg-yellow-950" },
  three_fives:   { icon: Sparkles,       color: "text-amber-500",   bg: "bg-amber-100 dark:bg-amber-950" },
  all_fives:     { icon: Award,          color: "text-amber-500",   bg: "bg-amber-100 dark:bg-amber-950" },
  high_achiever: { icon: TrendingUp,     color: "text-orange-500",  bg: "bg-orange-100 dark:bg-orange-950" },
  streak_3:      { icon: Flame,          color: "text-orange-500",  bg: "bg-orange-100 dark:bg-orange-950" },
  streak_5:      { icon: Zap,            color: "text-red-500",     bg: "bg-red-100 dark:bg-red-950" },
  streak_10:     { icon: Rocket,         color: "text-red-600",     bg: "bg-red-100 dark:bg-red-950" },
  hw_streak_3:   { icon: Flame,          color: "text-orange-500",  bg: "bg-orange-100 dark:bg-orange-950" },
  hw_streak_7:   { icon: Flame,          color: "text-red-500",     bg: "bg-red-100 dark:bg-red-950" },
  hw_streak_15:  { icon: Crown,          color: "text-amber-500",   bg: "bg-amber-100 dark:bg-amber-950" },
  level_3:       { icon: Target,         color: "text-cyan-500",    bg: "bg-cyan-100 dark:bg-cyan-950" },
  level_5:       { icon: Trophy,         color: "text-rose-500",    bg: "bg-rose-100 dark:bg-rose-950" },
  level_6:       { icon: Crown,          color: "text-amber-400",   bg: "bg-amber-100 dark:bg-amber-950" },
};

const LEVEL_COLORS: Record<number, { bg: string; text: string; border: string; bar: string; gradFrom: string; gradTo: string }> = {
  1: { bg: "bg-slate-100 dark:bg-slate-800",   text: "text-slate-600 dark:text-slate-300",   border: "border-slate-200 dark:border-slate-700",  bar: "bg-slate-400",   gradFrom: "from-slate-400",  gradTo: "to-slate-500" },
  2: { bg: "bg-blue-50 dark:bg-blue-950",      text: "text-blue-600 dark:text-blue-400",     border: "border-blue-200 dark:border-blue-800",    bar: "bg-blue-500",    gradFrom: "from-blue-400",   gradTo: "to-blue-600" },
  3: { bg: "bg-green-50 dark:bg-green-950",    text: "text-green-600 dark:text-green-400",   border: "border-green-200 dark:border-green-800",  bar: "bg-green-500",   gradFrom: "from-green-400",  gradTo: "to-emerald-600" },
  4: { bg: "bg-violet-50 dark:bg-violet-950",  text: "text-violet-600 dark:text-violet-400", border: "border-violet-200 dark:border-violet-800",bar: "bg-violet-500",  gradFrom: "from-violet-400", gradTo: "to-purple-600" },
  5: { bg: "bg-orange-50 dark:bg-orange-950",  text: "text-orange-600 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800",bar: "bg-orange-500",  gradFrom: "from-orange-400", gradTo: "to-red-500" },
  6: { bg: "bg-amber-50 dark:bg-amber-950",    text: "text-amber-600 dark:text-amber-400",   border: "border-amber-200 dark:border-amber-800",  bar: "bg-amber-500",   gradFrom: "from-amber-400",  gradTo: "to-yellow-500" },
};

const CATEGORIES = [
  { id: "hw",      label: "Домашние задания", icon: ClipboardCheck },
  { id: "lessons", label: "Уроки",            icon: GraduationCap },
  { id: "grades",  label: "Оценки",           icon: Star },
  { id: "hw_streak", label: "Серии ДЗ подряд", icon: Flame },
  { id: "streak",  label: "Недели активности", icon: Zap },
  { id: "level",   label: "Уровни",           icon: Trophy },
];

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <Card className="rounded-2xl border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn("text-3xl font-bold mt-1", color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn("p-2.5 rounded-xl", color.replace("text-", "bg-").replace("500", "100").replace("foreground", "muted"))}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StudentProgress() {
  const { data, isLoading } = useQuery<ProgressData>({
    queryKey: ["student-progress"],
    queryFn: async () => {
      const res = await fetch("/api/student/progress", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
  });

  const { data: leaderboard } = useQuery<{ top5: any[]; myRank: number; myEntry: any | null; total: number }>({
    queryKey: ["/api/student/leaderboard"],
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const gradeColor = (g: number | null) => {
    if (!g) return "text-muted-foreground";
    if (g >= 5) return "text-green-500";
    if (g >= 4) return "text-blue-500";
    if (g >= 3) return "text-yellow-500";
    return "text-red-500";
  };

  const { levelInfo, weeklyGoal, xpBreakdown } = data;
  const lvlStyle = LEVEL_COLORS[levelInfo?.level ?? 1];
  const xpPct = levelInfo?.xpForNext
    ? Math.min(100, Math.round((levelInfo.xpCurrent / levelInfo.xpForNext) * 100))
    : 100;

  const earnedCount = data.achievements.filter(a => a.earned).length;

  const hwGoalPct = Math.min(100, weeklyGoal.hwTarget > 0 ? Math.round((weeklyGoal.hwDone / weeklyGoal.hwTarget) * 100) : 0);
  const lessonGoalPct = Math.min(100, weeklyGoal.lessonDone >= weeklyGoal.lessonTarget ? 100 : 0);
  const hwGoalDone = weeklyGoal.hwDone >= weeklyGoal.hwTarget;
  const lessonGoalDone = weeklyGoal.lessonDone >= weeklyGoal.lessonTarget;

  const xpSources = xpBreakdown ? [
    { label: "Домашние задания", value: xpBreakdown.hw,      icon: ClipboardCheck, color: "text-blue-500",   bar: "bg-blue-500"   },
    { label: "Уроки",            value: xpBreakdown.lessons,  icon: GraduationCap,  color: "text-green-500",  bar: "bg-green-500"  },
    { label: "Оценки",           value: xpBreakdown.grades,   icon: Star,           color: "text-amber-500",  bar: "bg-amber-500"  },
    { label: "Стрик",            value: xpBreakdown.streak,   icon: Flame,          color: "text-orange-500", bar: "bg-orange-500" },
  ] : [];
  const totalXpForBreakdown = levelInfo?.totalXp || 1;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <LevelUpDialog studentId={data.studentId} currentLevel={levelInfo?.level} />

      {/* ─── XP & Level Banner ─────────────────────────────────────────────── */}
      {levelInfo && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className={cn("rounded-2xl overflow-hidden relative shadow-md", `bg-gradient-to-br ${lvlStyle.gradFrom} ${lvlStyle.gradTo}`)}>
            <div className="pointer-events-none absolute right-0 top-0 opacity-10">
              <Trophy className="h-28 w-28 text-white rotate-12 translate-x-4 -translate-y-4" />
            </div>
            <div className="p-5 text-white">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center font-black text-2xl shrink-0 shadow-inner">
                    {levelInfo.level}
                  </div>
                  <div>
                    <p className="font-black text-xl leading-none text-white">{levelInfo.name}</p>
                    <p className="text-sm text-white/70 mt-0.5">Уровень {levelInfo.level} из 6</p>
                    {data.streak >= 2 && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-white/90 bg-white/15 rounded-lg px-2 py-0.5">
                        <Flame className="h-3 w-3 text-orange-300" /> {data.streak} занятий подряд
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1.5">
                    <Zap className="h-4 w-4 text-white" />
                    <span className="font-black text-xl text-white">{levelInfo.totalXp}</span>
                    <span className="text-sm text-white/80 font-medium">XP</span>
                  </div>
                  <span className="text-[11px] text-white/60">{earnedCount} достижений</span>
                </div>
              </div>
              {levelInfo.xpForNext ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-white/70">
                    <span>{levelInfo.xpCurrent} / {levelInfo.xpForNext} XP до следующего уровня</span>
                    <span className="font-bold text-white">{xpPct}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/20 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-white/80"
                      initial={{ width: 0 }}
                      animate={{ width: `${xpPct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-2 bg-white/15 rounded-xl px-3 py-2">
                  <Crown className="h-4 w-4" /> Максимальный уровень достигнут!
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Мотивация + Серия ДЗ ──────────────────────────────────────────── */}
      {data.motivation && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <Card className="rounded-2xl border-border/50 overflow-hidden">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
                <div className="space-y-1" data-testid="text-motivation">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl leading-none">{data.motivation.emoji}</span>
                    <p className="text-lg font-bold">{data.motivation.greeting}</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{data.motivation.message}</p>
                  {data.nextMilestone && (
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <Target className="h-3.5 w-3.5 text-primary" />
                      <span className="text-muted-foreground">Ближайшая награда:</span>
                      <span className="font-semibold">{data.nextMilestone.title}</span>
                      {data.nextMilestone.progressMax && (
                        <Badge variant="secondary" className="ml-1 h-5 text-[10px]">
                          {data.nextMilestone.progressValue}/{data.nextMilestone.progressMax}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {/* Streak hero */}
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 shrink-0 min-w-[160px]",
                    data.hwStreak >= 7
                      ? "bg-gradient-to-br from-orange-500 to-red-500 text-white"
                      : data.hwStreak >= 3
                      ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                      : "bg-muted"
                  )}
                  data-testid="card-hw-streak"
                >
                  <motion.div
                    animate={data.hwStreak >= 3 ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Flame className={cn("h-10 w-10", data.hwStreak >= 3 ? "text-white drop-shadow-md" : "text-muted-foreground")} />
                  </motion.div>
                  <div>
                    <p className={cn("text-3xl font-black leading-none tabular-nums", data.hwStreak >= 3 ? "text-white" : "text-foreground")} data-testid="text-hw-streak-value">
                      {data.hwStreak}
                    </p>
                    <p className={cn("text-[11px] font-medium mt-0.5", data.hwStreak >= 3 ? "text-white/90" : "text-muted-foreground")}>
                      ДЗ подряд
                    </p>
                    {data.bestHwStreak > data.hwStreak && (
                      <p className={cn("text-[10px] mt-0.5", data.hwStreak >= 3 ? "text-white/70" : "text-muted-foreground/70")}>
                        рекорд: {data.bestHwStreak}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── XP Разбивка ───────────────────────────────────────────────────── */}
      {xpBreakdown && levelInfo && levelInfo.totalXp > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="rounded-2xl border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Откуда взялся XP
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {xpSources.map((src) => {
                const Icon = src.icon;
                const pct = totalXpForBreakdown > 0 ? Math.round((src.value / totalXpForBreakdown) * 100) : 0;
                return (
                  <div key={src.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5">
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", src.color)} />
                        <span className="text-muted-foreground">{src.label}</span>
                      </div>
                      <span className={cn("font-semibold tabular-nums", src.color)}>+{src.value} XP</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full", src.bar)}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Выполнено ДЗ", value: `${data.completionPct}%`, sub: `${data.completedHw} из ${data.totalHw}`, icon: Target, color: "text-primary" },
          { label: "Средняя оценка", value: data.avgGrade ? data.avgGrade.toFixed(1) : "—", sub: data.avgGrade ? (data.avgGrade >= 4.5 ? "Отлично!" : data.avgGrade >= 3.5 ? "Хорошо" : "Можно лучше") : "Нет оценок", icon: Star, color: gradeColor(data.avgGrade) },
          { label: "Стрик", value: `${data.streak} нед.`, sub: data.streak > 0 ? "Не сдавайся!" : "Начни сегодня", icon: Flame, color: data.streak >= 3 ? "text-orange-500" : "text-muted-foreground" },
          { label: "Уроков пройдено", value: String(data.lessonsCompleted), sub: data.lessonsCompleted > 0 ? "Так держать!" : "Скоро начнём", icon: Calendar, color: "text-blue-500" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.05 }}>
            <StatCard {...card} />
          </motion.div>
        ))}
      </div>

      {/* ─── Недельная цель ────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Цели на эту неделю
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5" data-testid="weekly-goal-hw">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className={cn("h-4 w-4", hwGoalDone ? "text-green-500" : "text-muted-foreground")} />
                  <span className={hwGoalDone ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                    Домашние задания: {weeklyGoal.hwDone} / {weeklyGoal.hwTarget}
                  </span>
                </div>
                {hwGoalDone && <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">Выполнено!</Badge>}
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", hwGoalDone ? "bg-green-500" : "bg-primary")}
                  initial={{ width: 0 }}
                  animate={{ width: `${hwGoalPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
            <div className="space-y-1.5" data-testid="weekly-goal-lesson">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <GraduationCap className={cn("h-4 w-4", lessonGoalDone ? "text-green-500" : "text-muted-foreground")} />
                  <span className={lessonGoalDone ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                    Уроков: {weeklyGoal.lessonDone} / {weeklyGoal.lessonTarget}
                  </span>
                </div>
                {lessonGoalDone && <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">Выполнено!</Badge>}
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", lessonGoalDone ? "bg-green-500" : "bg-blue-500")}
                  initial={{ width: 0 }}
                  animate={{ width: `${lessonGoalPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Лидерборд ─────────────────────────────────────────────────────── */}
      {leaderboard && leaderboard.total > 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}>
          <Card className="rounded-2xl border-border/50 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Рейтинг класса
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  Место #{leaderboard.myRank} из {leaderboard.total}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-0 p-0 pb-4 px-4">
              {/* Top-3 Podium */}
              {leaderboard.top5.length >= 3 && (
                <div className="flex items-end justify-center gap-2 mb-4 pt-2">
                  {[leaderboard.top5[1], leaderboard.top5[0], leaderboard.top5[2]].map((entry, podiumIdx) => {
                    const rank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3;
                    const heights = ["h-20", "h-28", "h-16"];
                    const colors = [
                      "bg-slate-200 dark:bg-slate-700 border-slate-300",
                      "bg-amber-100 dark:bg-amber-950 border-amber-400",
                      "bg-orange-100 dark:bg-orange-950 border-orange-400",
                    ];
                    const medals = ["🥈", "🥇", "🥉"];
                    return (
                      <div key={entry.studentId} className="flex flex-col items-center gap-1 flex-1 max-w-[90px]">
                        <div className="text-lg font-bold leading-none">{medals[podiumIdx]}</div>
                        <div className={cn(
                          "w-full rounded-t-xl border-t-2 flex flex-col items-center justify-end pb-2 pt-2 px-1",
                          heights[podiumIdx], colors[podiumIdx],
                          entry.isMe && "ring-2 ring-primary ring-offset-1"
                        )}>
                          <p className={cn("text-xs font-bold text-center leading-tight truncate w-full px-1", entry.isMe && "text-primary")}>
                            {entry.name}{entry.isMe ? " (ты)" : ""}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium">{entry.totalScore} бал.</p>
                        </div>
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          rank === 1 ? "bg-amber-400 text-white" : rank === 2 ? "bg-slate-400 text-white" : "bg-orange-400 text-white"
                        )}>{rank}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Rest of list */}
              <div className="space-y-1.5">
                {leaderboard.top5.slice(3).map((entry: any, idx: number) => (
                  <div
                    key={entry.studentId}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm",
                      entry.isMe ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                    )}
                  >
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold shrink-0 text-muted-foreground">
                      {idx + 4}
                    </div>
                    <span className={cn("flex-1 font-medium truncate", entry.isMe && "text-primary")}>
                      {entry.name}{entry.isMe ? " (ты)" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{entry.totalScore} бал.</span>
                  </div>
                ))}
                {leaderboard.myEntry && (
                  <div className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm bg-primary/10 border border-primary/20">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold shrink-0 text-primary">
                      {leaderboard.myRank}
                    </div>
                    <span className="flex-1 font-medium text-primary truncate">{leaderboard.myEntry.name} (ты)</span>
                    <span className="text-xs text-muted-foreground shrink-0">{leaderboard.myEntry.totalScore} бал.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Charts ────────────────────────────────────────────────────────── */}
      {data.weeklyStats.some(w => w.assigned > 0 || w.completed > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-2xl border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Активность по неделям
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.weeklyStats} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "hsl(var(--foreground))" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="assigned"  name="Задано"    fill="hsl(var(--muted))"   radius={[3, 3, 0, 0]} />
                  <Bar dataKey="completed" name="Выполнено" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {data.weeklyStats.some(w => w.avgGrade != null) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
          <Card className="rounded-2xl border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Динамика оценок
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.weeklyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(val: any) => [val ? `${val} / 5` : "нет", "Средняя оценка"]} />
                  <Line type="monotone" dataKey="avgGrade" name="Оценка" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Достижения ────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Достижения
              </CardTitle>
              <Badge variant="secondary">{earnedCount} / {data.achievements.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {CATEGORIES.map((cat) => {
              const catAchs = data.achievements.filter(a => a.category === cat.id);
              if (!catAchs.length) return null;
              const catEarned = catAchs.filter(a => a.earned).length;
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <cat.icon className="h-3.5 w-3.5" />
                      {cat.label}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{catEarned}/{catAchs.length}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {catAchs.map((ach) => {
                      const meta = ACHIEVEMENT_META[ach.id] || { icon: Award, color: "text-primary", bg: "bg-primary/10" };
                      const Icon = meta.icon;
                      const hasProg = !ach.earned && ach.progressMax != null && ach.progressMax > 0;
                      const progPct = hasProg ? Math.round(((ach.progressValue ?? 0) / ach.progressMax!) * 100) : 0;
                      return (
                        <div
                          key={ach.id}
                          className={cn(
                            "flex flex-col gap-1.5 p-3 rounded-xl border text-center transition-all",
                            ach.earned
                              ? "border-border bg-card shadow-sm"
                              : "border-border/30 bg-muted/10"
                          )}
                          data-testid={`achievement-${ach.id}`}
                        >
                          <div className="flex justify-center">
                            <div className={cn(
                              "p-2.5 rounded-full",
                              ach.earned ? meta.bg : "bg-muted/40"
                            )}>
                              {ach.earned
                                ? <Icon className={cn("h-4 w-4", meta.color)} />
                                : <Lock className="h-4 w-4 text-muted-foreground/50" />
                              }
                            </div>
                          </div>
                          <div>
                            <p className={cn("text-xs font-semibold leading-tight", ach.earned ? "text-foreground" : "text-muted-foreground")}>{ach.title}</p>
                            {!ach.earned && ach.hint && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">{ach.hint}</p>
                            )}
                          </div>
                          {ach.earned ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 mx-auto">Получено ✓</Badge>
                          ) : hasProg ? (
                            <div className="space-y-0.5 mt-0.5">
                              <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <motion.div
                                  className={cn("h-full rounded-full", meta.color.replace("text-", "bg-"))}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progPct}%` }}
                                  transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                              </div>
                              <p className="text-[9px] text-muted-foreground/60">{ach.progressValue}/{ach.progressMax}</p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Последние оценки ──────────────────────────────────────────────── */}
      {data.recentGrades.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
          <Card className="rounded-2xl border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                Последние оценки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.recentGrades.map((g, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <span className="text-sm truncate max-w-[70%]">{g.title}</span>
                    <span className={cn("text-xl font-bold", gradeColor(g.score))}>{g.score}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty state */}
      {data.totalHw === 0 && data.lessonsCompleted === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Статистика появится после первого занятия</p>
          <p className="text-sm mt-1">Выполняй задания и ходи на уроки, чтобы видеть прогресс</p>
        </div>
      )}
    </div>
  );
}
