import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  Bot,
  Calendar,
  CircleDollarSign,
  FileText,
  HelpCircle,
  Home,
  LogOut,
  Moon,
  Sun,
  MessageCircle,
  TrendingUp,
  FlaskConical,
  Zap,
  Flame,
  Sparkles,
  GraduationCap,
  Send,
  Copy,
  CheckCircle2,
  RefreshCw,
  Timer,
  Loader2,
  LinkIcon,
  Link2Off,
  Bell,
  BellOff,
  UserCog,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HelpTooltip } from "@/components/help-tooltip";
import { StudentHelpWidget } from "@/components/student-help-widget";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type StudentTab = "home" | "lessons" | "homework" | "quiz" | "progress" | "finance" | "ai" | "board" | "notes" | "messages" | "conference" | "help" | "tasks" | "profile" | "recordings";

// ── Nav items shown in the sidebar (chat + AI removed → moved to header) ──
const studentNavItems: { value: StudentTab; label: string; icon: React.ElementType; path: string; description: string }[] = [
  { value: "home",     label: "Главная",   icon: Home,             path: "/student",          description: "Обзор прогресса и ближайших занятий" },
  { value: "lessons",  label: "Занятия",   icon: Calendar,         path: "/student/lessons",  description: "Расписание и история уроков" },
  { value: "homework", label: "Домашка",   icon: FileText,         path: "/student/homework", description: "Домашние задания и сроки сдачи" },
  { value: "quiz",     label: "Тренажёры", icon: FlaskConical,     path: "/student/quiz",     description: "Тесты и карточки от репетитора" },
  { value: "recordings", label: "Конспекты",  icon: FileText,        path: "/student/recordings", description: "Конспекты и расшифровки уроков" },
  { value: "progress", label: "Прогресс",  icon: TrendingUp,       path: "/student/progress", description: "Аналитика, уровни и достижения" },
  { value: "finance",  label: "Финансы",   icon: CircleDollarSign, path: "/student/finance",  description: "Баланс и история оплат" },
  { value: "tasks",    label: "Задачник",  icon: FlaskConical,     path: "/student/tasks",    description: "База заданий и варианты от репетитора" },
  { value: "profile",  label: "Профиль",   icon: UserCog,          path: "/student/profile",  description: "Email, пароль и безопасность" },
];

const pageTitles: Record<StudentTab, { title: string; subtitle: string }> = {
  home:       { title: "Главная",              subtitle: "Ваш учебный дашборд" },
  lessons:    { title: "Занятия",              subtitle: "Расписание и история уроков" },
  homework:   { title: "Домашние задания",     subtitle: "Отслеживайте задания и сроки сдачи" },
  quiz:       { title: "Тренажёры",            subtitle: "Тесты и карточки от репетитора" },
  recordings: { title: "Конспекты уроков",     subtitle: "Краткое резюме и расшифровки занятий" },
  progress:   { title: "Мой прогресс",         subtitle: "Аналитика, стрики и достижения" },
  finance:    { title: "Финансы",              subtitle: "Баланс и история платежей" },
  conference: { title: "Конференция",          subtitle: "Видеозанятие с репетитором" },
  notes:      { title: "Заметки",              subtitle: "Ваши личные записи" },
  messages:   { title: "Чат с репетитором",    subtitle: "Переписка и вопросы" },
  tasks:      { title: "Задачник",              subtitle: "Варианты от репетитора и база заданий" },
  ai:         { title: "ИИ-помощник",          subtitle: "Задайте вопрос — получите объяснение" },
  board:      { title: "Онлайн доска",         subtitle: "Совместная работа с репетитором" },
  help:       { title: "Справочный центр",     subtitle: "Советы и руководство по кабинету" },
  profile:    { title: "Профиль",              subtitle: "Email, пароль и безопасность" },
};

const LEVEL_COLORS: Record<number, { text: string; ring: string; bg: string }> = {
  1: { text: "text-slate-500",   ring: "ring-slate-400/40",   bg: "bg-slate-400" },
  2: { text: "text-blue-500",    ring: "ring-blue-400/40",    bg: "bg-blue-500" },
  3: { text: "text-green-500",   ring: "ring-green-400/40",   bg: "bg-green-500" },
  4: { text: "text-violet-500",  ring: "ring-violet-400/40",  bg: "bg-violet-500" },
  5: { text: "text-orange-500",  ring: "ring-orange-400/40",  bg: "bg-orange-500" },
  6: { text: "text-amber-500",   ring: "ring-amber-400/40",   bg: "bg-amber-500" },
};

function getActiveTab(path: string): StudentTab {
  if (path.startsWith("/student/messages")) return "messages";
  if (path.startsWith("/student/ai")) return "ai";
  if (path.startsWith("/student/help")) return "help";
  if (path.startsWith("/student/board")) return "board";
  if (path.startsWith("/student/conference")) return "conference";
  if (path.startsWith("/student/notes")) return "notes";
  const match = studentNavItems
    .filter(i => path === i.path || (i.path !== "/student" && path.startsWith(i.path)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (match) return match.value;
  return "home";
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function StudentSidebar({ currentPath, studentName, onLogout }: {
  currentPath: string; studentName: string; onLogout: () => void;
}) {
  const [, setLocation] = useLocation();
  const activeTab = getActiveTab(currentPath);

  const { data: progressData } = useQuery<{
    levelInfo: { level: number; name: string; xpCurrent: number; xpForNext: number | null; totalXp: number };
    streak: number;
  }>({
    queryKey: ["student-level-sidebar"],
    queryFn: async () => {
      const res = await fetch("/api/student/progress", { credentials: "include" });
      if (!res.ok) throw new Error("err");
      return res.json();
    },
    staleTime: 120_000,
    retry: false,
  });

  const level = progressData?.levelInfo?.level ?? 1;
  const levelName = progressData?.levelInfo?.name ?? "Ученик";
  const totalXp = progressData?.levelInfo?.totalXp ?? 0;
  const streak = progressData?.streak ?? 0;
  const lc = LEVEL_COLORS[level] || LEVEL_COLORS[1];

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-border/50 bg-card lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border/50 px-4">
        <div className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-cyan-400/30 to-primary/40 blur-xl scale-150 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-1 px-2 py-1">
              <span className="text-lg font-bold bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">ТВОЙ</span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M7 17L17 7M17 7H9M17 7V15" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 via-primary to-cyan-400 bg-clip-text text-transparent">ВЕКТОР</span>
            </div>
          </div>
        </div>
      </div>

      {/* User profile + XP */}
      <div className="px-3 pt-4 pb-2">
        <div className="rounded-xl bg-muted/50 p-3 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className={cn("h-9 w-9 ring-2", lc.ring)}>
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                  {studentName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className={cn("absolute -bottom-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-sm", lc.bg)}>
                {level}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{studentName}</p>
              <p className={cn("text-[11px] font-medium", lc.text)}>{levelName}</p>
            </div>
          </div>
          {progressData?.levelInfo && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Zap className={cn("h-3 w-3", lc.text)} />
                  <span className={cn("font-bold tabular-nums", lc.text)}>{totalXp} XP</span>
                </span>
                {streak >= 2 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-orange-500 font-semibold">
                    <Flame className="h-3 w-3" />{streak}
                  </span>
                )}
              </div>
              {progressData.levelInfo.xpForNext && (
                <div className="h-1 rounded-full bg-border/50 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", lc.bg)}
                    style={{ width: `${Math.min(100, Math.round((progressData.levelInfo.xpCurrent / progressData.levelInfo.xpForNext) * 100))}%`, opacity: 0.8 }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pt-3 pb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3">Меню</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 overflow-y-auto">
        {studentNavItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = activeTab === item.value;
          return (
            <motion.a
              key={item.value}
              href={item.path}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              onClick={(e) => { e.preventDefault(); setLocation(item.path); }}
              data-testid={`nav-student-${item.value}`}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={item.description}
            >
              {isActive && (
                <motion.div
                  layoutId="student-sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon style={{ width: 18, height: 18 }} className={cn("shrink-0", isActive ? "text-primary" : "")} />
              <span>{item.label}</span>
            </motion.a>
          );
        })}
      </nav>

      {/* Footer: Help + Logout */}
      <div className="border-t border-border/50 p-3 space-y-0.5">
        <a
          href="/student/help"
          onClick={(e) => { e.preventDefault(); setLocation("/student/help"); }}
          data-testid="nav-student-help"
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "help" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          <span>Справка</span>
        </a>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          data-testid="button-student-logout"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  );
}

// ── Telegram Manager Popover ────────────────────────────────────────────────
function TelegramManagerButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeSecondsLeft, setCodeSecondsLeft] = useState(900);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: tg, refetch: refetchTg } = useQuery<{
    botRunning: boolean;
    botUsername: string | null;
    telegramLinked: boolean;
    notificationsEnabled: boolean;
  }>({
    queryKey: ["/api/student/telegram/status"],
    refetchOnWindowFocus: false,
    retry: false,
  });

  const generateCode = useMutation({
    mutationFn: () => apiRequest("POST", "/api/student/telegram/generate-code").then(r => r.json()),
    onSuccess: (data) => {
      setLinkCode(data.code);
      setCodeSecondsLeft(900);
      setCodeCopied(false);
      setShowCodeDialog(true);
      setOpen(false);
      if (timerRef.current) clearInterval(timerRef.current);
      const expires = new Date(data.expiresAt).getTime();
      timerRef.current = setInterval(() => {
        const left = Math.max(0, Math.floor((expires - Date.now()) / 1000));
        setCodeSecondsLeft(left);
        if (left === 0) { clearInterval(timerRef.current!); timerRef.current = null; }
      }, 1000);
    },
    onError: () => toast.error("Не удалось создать код. Попробуйте позже."),
  });

  const unlink = useMutation({
    mutationFn: () => apiRequest("POST", "/api/student/telegram/unlink").then(r => r.json()),
    onSuccess: () => {
      toast.success("Telegram отвязан");
      qc.invalidateQueries({ queryKey: ["/api/student/telegram/status"] });
      refetchTg();
      setOpen(false);
    },
    onError: () => toast.error("Ошибка при отключении"),
  });

  const toggleNotifications = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("PATCH", "/api/student/telegram/notifications", { enabled }).then(r => r.json()),
    onSuccess: (data) => {
      toast.success(data.notificationsEnabled ? "Уведомления включены" : "Уведомления отключены");
      qc.invalidateQueries({ queryKey: ["/api/student/telegram/status"] });
      refetchTg();
    },
    onError: () => toast.error("Ошибка при изменении настроек"),
  });

  const copyCode = () => {
    if (!linkCode) return;
    navigator.clipboard.writeText(linkCode);
    setCodeCopied(true);
    toast.success("Код скопирован!");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const isLinked = tg?.telegramLinked ?? false;
  const notifOn = tg?.notificationsEnabled ?? true;
  const botRunning = tg?.botRunning ?? false;
  const botUsername = tg?.botUsername ?? "MyVectorAI_bot";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            data-testid="button-telegram-manager"
            className={cn(
              "group flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-all duration-200",
              "hover:scale-[1.02] active:scale-[0.98]",
              open
                ? (isLinked ? "bg-green-500/12 border-green-500/40 shadow-sm" : "bg-blue-500/12 border-blue-500/40 shadow-sm")
                : "bg-muted/40 border-border/40 hover:bg-muted/60"
            )}
          >
            <div className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors relative",
              isLinked ? "bg-green-500/15 group-hover:bg-green-500/20" : "bg-blue-500/10 group-hover:bg-blue-500/15"
            )}>
              <Bot className={cn("h-4 w-4 transition-colors", isLinked ? "text-green-500" : "text-blue-500/70 group-hover:text-blue-500")} />
              {!isLinked && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <p className={cn("text-[11px] font-bold leading-tight", isLinked ? "text-green-600 dark:text-green-400" : "text-foreground/80")}>
                Telegram
              </p>
              <p className="text-[10px] text-muted-foreground/70 leading-tight whitespace-nowrap">
                {isLinked ? (notifOn ? "подключён • уведомления" : "подключён • без уведомлений") : "не подключён"}
              </p>
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-0 overflow-hidden" align="center" side="bottom" sideOffset={8}>
          {/* Header */}
          <div className={cn(
            "px-4 py-3 border-b border-border/50",
            isLinked ? "bg-green-500/6" : "bg-blue-500/6"
          )}>
            <div className="flex items-center gap-2.5">
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", isLinked ? "bg-green-500/15" : "bg-blue-500/12")}>
                <Bot className={cn("h-4 w-4", isLinked ? "text-green-500" : "text-blue-500")} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold">Telegram</p>
                  <Badge className={cn(
                    "text-[10px] h-4 border-0 px-1.5",
                    isLinked
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  )}>
                    {isLinked ? "✓ Подключён" : "Не подключён"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isLinked
                    ? "Уведомления и управление ботом"
                    : "Подключите для получения уведомлений"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 space-y-2">
            {/* Notifications toggle (only when linked) */}
            {isLinked && (
              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {notifOn
                    ? <Bell className="h-4 w-4 text-green-500 shrink-0" />
                    : <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                  <div>
                    <p className="text-xs font-medium">Уведомления</p>
                    <p className="text-[10px] text-muted-foreground">О заданиях, оценках, расписании</p>
                  </div>
                </div>
                <Switch
                  checked={notifOn}
                  onCheckedChange={(v) => toggleNotifications.mutate(v)}
                  disabled={toggleNotifications.isPending}
                  data-testid="switch-tg-notifications"
                  className="shrink-0"
                />
              </div>
            )}

            {/* Open bot */}
            {isLinked && botUsername && (
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 justify-start text-xs h-9 border-border/50"
                  data-testid="button-tg-open-bot"
                >
                  <Send className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  Открыть @{botUsername}
                </Button>
              </a>
            )}

            {/* Connect / Reconnect */}
            {!botRunning && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-center">
                Бот не настроен репетитором
              </p>
            )}
            <Button
              size="sm"
              className={cn(
                "w-full gap-2 justify-start text-xs h-9",
                isLinked
                  ? "bg-muted hover:bg-muted/80 text-foreground border border-border/50"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              )}
              onClick={() => generateCode.mutate()}
              disabled={generateCode.isPending || !botRunning}
              data-testid="button-tg-get-code"
            >
              {generateCode.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                : <LinkIcon className="h-3.5 w-3.5 shrink-0" />
              }
              {isLinked ? "Переподключить аккаунт" : "Подключить Telegram"}
            </Button>

            {/* Unlink */}
            {isLinked && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 justify-start text-xs h-9 text-red-500 hover:text-red-600 hover:bg-red-500/8"
                onClick={() => setConfirmUnlinkOpen(true)}
                disabled={unlink.isPending}
                data-testid="button-tg-unlink"
              >
                {unlink.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  : <Link2Off className="h-3.5 w-3.5 shrink-0" />
                }
                Отключить Telegram
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Code dialog */}
      <Dialog open={showCodeDialog} onOpenChange={(v) => {
        if (!v && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setShowCodeDialog(v);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-blue-500" />
              Подключить Telegram
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold shrink-0 mt-0.5">1</span>
                {tg?.botUsername
                  ? <span><a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="text-blue-500 underline">Откройте @{botUsername}</a> в Telegram</span>
                  : <span>Откройте бот в Telegram</span>
                }
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <span>Отправьте боту этот код:</span>
              </li>
            </ol>

            <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-6 flex flex-col items-center gap-3">
              {generateCode.isPending
                ? <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                : (
                  <>
                    <div data-testid="text-tg-link-code" className="text-5xl font-mono font-bold tracking-[0.25em] text-blue-700 dark:text-blue-300 select-all">
                      {linkCode}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Timer className="h-3 w-3" />
                      {codeSecondsLeft > 0
                        ? <>Действует {Math.floor(codeSecondsLeft / 60)}:{String(codeSecondsLeft % 60).padStart(2, "0")}</>
                        : <span className="text-red-500 font-medium">Истёк — обновите</span>
                      }
                    </div>
                  </>
                )
              }
            </div>

            {!generateCode.isPending && codeSecondsLeft > 0 && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(codeSecondsLeft / 900) * 100}%` }} />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                data-testid="button-tg-copy-code"
                className="flex-1 gap-2"
                variant={codeCopied ? "secondary" : "default"}
                onClick={copyCode}
                disabled={!linkCode || generateCode.isPending || codeSecondsLeft === 0}
              >
                {codeCopied ? <><CheckCircle2 className="h-4 w-4" />Скопировано</> : <><Copy className="h-4 w-4" />Копировать</>}
              </Button>
              <Button
                data-testid="button-tg-refresh-code"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => generateCode.mutate()}
                disabled={generateCode.isPending}
              >
                <RefreshCw className={cn("h-4 w-4", generateCode.isPending && "animate-spin")} />
              </Button>
            </div>

            {tg?.botUsername && (
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full gap-2 text-sm">
                  <Send className="h-3.5 w-3.5" />
                  Открыть @{botUsername}
                </Button>
              </a>
            )}

            <p className="text-[11px] text-muted-foreground text-center">
              Код одноразовый, истекает через 15 минут. После ввода бот пришлёт приветствие.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmUnlinkOpen}
        title="Отключить Telegram?"
        description="Уведомления через Telegram будут отключены. Вы сможете подключить его снова."
        confirmText="Отключить"
        onConfirm={() => { unlink.mutate(); setConfirmUnlinkOpen(false); }}
        onCancel={() => setConfirmUnlinkOpen(false)}
      />
    </>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────
interface StudentLayoutProps {
  children: React.ReactNode;
  studentName: string;
  onLogout: () => void;
}

export function StudentLayout({ children, studentName, onLogout }: StudentLayoutProps) {
  const { theme, setTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const activeTab = getActiveTab(location);
  const pageInfo = pageTitles[activeTab];
  const currentNavItem = studentNavItems.find(i => i.value === activeTab);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/student/messages/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/student/messages/unread-count", { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: activeTab === "messages" ? false : 30_000,
    staleTime: 15_000,
    retry: false,
  });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <StudentSidebar currentPath={location} studentName={studentName} onLogout={onLogout} />

      <div className="lg:pl-56">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/95 backdrop-blur px-4 py-2 md:px-6">
          {/* LEFT: mobile avatar | desktop title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 lg:hidden">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {studentName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm truncate max-w-[100px]">{studentName}</span>
            </div>
            <div className="hidden lg:flex items-center gap-2">
              <div>
                <h1 className="text-sm font-semibold leading-tight" data-testid="text-page-title">{pageInfo.title}</h1>
                <p className="text-xs text-muted-foreground leading-tight" data-testid="text-page-subtitle">{pageInfo.subtitle}</p>
              </div>
              <HelpTooltip content={currentNavItem?.description || pageInfo.subtitle} side="bottom" />
            </div>
          </div>

          {/* CENTER: beautiful window-cards */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {/* Обучение */}
            <button
              onClick={() => setLocation("/student/progress")}
              data-testid="nav-header-learning"
              className={cn(
                "group flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-all duration-200",
                "hover:scale-[1.02] active:scale-[0.98]",
                activeTab === "progress"
                  ? "bg-blue-500/12 border-blue-500/40 shadow-sm shadow-blue-500/10"
                  : "bg-muted/40 border-border/40 hover:bg-blue-500/8 hover:border-blue-400/30"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                activeTab === "progress"
                  ? "bg-gradient-to-br from-blue-500/30 to-blue-600/20 shadow-inner"
                  : "bg-blue-500/10 group-hover:bg-blue-500/15"
              )}>
                <GraduationCap className={cn("h-4 w-4 transition-colors", activeTab === "progress" ? "text-blue-500" : "text-blue-500/60 group-hover:text-blue-500")} />
              </div>
              <div className="min-w-0">
                <p className={cn("text-[11px] font-bold leading-tight", activeTab === "progress" ? "text-blue-600 dark:text-blue-400" : "text-foreground/80")}>Обучение</p>
                <p className="text-[10px] text-muted-foreground/70 leading-tight whitespace-nowrap">Прогресс и достижения</p>
              </div>
            </button>

            {/* Чат с репетитором */}
            <button
              onClick={() => setLocation("/student/messages")}
              data-testid="nav-header-messages"
              className={cn(
                "group flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-all duration-200",
                "hover:scale-[1.02] active:scale-[0.98]",
                activeTab === "messages"
                  ? "bg-cyan-500/12 border-cyan-500/40 shadow-sm shadow-cyan-500/10"
                  : "bg-muted/40 border-border/40 hover:bg-cyan-500/8 hover:border-cyan-400/30"
              )}
            >
              <div className="relative">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  activeTab === "messages"
                    ? "bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 shadow-inner"
                    : "bg-cyan-500/10 group-hover:bg-cyan-500/15"
                )}>
                  <MessageCircle className={cn("h-4 w-4 transition-colors", activeTab === "messages" ? "text-cyan-500" : "text-cyan-500/60 group-hover:text-cyan-500")} />
                </div>
                {unreadCount > 0 && activeTab !== "messages" && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center leading-none" data-testid="badge-unread-messages">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className={cn("text-[11px] font-bold leading-tight", activeTab === "messages" ? "text-cyan-600 dark:text-cyan-400" : "text-foreground/80")}>Чат</p>
                <p className="text-[10px] text-muted-foreground/70 leading-tight whitespace-nowrap">
                  {unreadCount > 0 && activeTab !== "messages" ? `${unreadCount} непрочит.` : "с репетитором"}
                </p>
              </div>
            </button>

            {/* ИИ-помощник */}
            <button
              onClick={() => setLocation("/student/ai")}
              data-testid="nav-header-ai"
              className={cn(
                "group flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-all duration-200",
                "hover:scale-[1.02] active:scale-[0.98]",
                activeTab === "ai"
                  ? "bg-violet-500/12 border-violet-500/40 shadow-sm shadow-violet-500/10"
                  : "bg-muted/40 border-border/40 hover:bg-violet-500/8 hover:border-violet-400/30"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                activeTab === "ai"
                  ? "bg-gradient-to-br from-violet-500/30 to-purple-600/20 shadow-inner"
                  : "bg-violet-500/10 group-hover:bg-violet-500/15"
              )}>
                <Sparkles className={cn("h-4 w-4 transition-colors", activeTab === "ai" ? "text-violet-500" : "text-violet-500/60 group-hover:text-violet-500")} />
              </div>
              <div className="min-w-0">
                <p className={cn("text-[11px] font-bold leading-tight", activeTab === "ai" ? "text-violet-600 dark:text-violet-400" : "text-foreground/80")}>ИИ-помощник</p>
                <p className="text-[10px] text-muted-foreground/70 leading-tight whitespace-nowrap">Задать вопрос</p>
              </div>
            </button>

            {/* Telegram */}
            <TelegramManagerButton />
          </div>

          {/* RIGHT: Theme toggle + mobile logout */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              className="h-8 w-8"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground lg:hidden px-2"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="px-4 py-6 md:px-6 pb-24 sm:pb-6">
          {children}
        </main>

        {/* Floating help assistant (all pages) */}
        <StudentHelpWidget />

        {/* Mobile bottom navigation bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[60px] items-center justify-around border-t border-border/60 bg-background/95 backdrop-blur-sm sm:hidden safe-area-bottom" aria-label="Мобильная навигация">
          {([
            { value: "home" as StudentTab, label: "Главная", icon: Home, path: "/student" },
            { value: "lessons" as StudentTab, label: "Занятия", icon: Calendar, path: "/student/lessons" },
            { value: "homework" as StudentTab, label: "Домашка", icon: FileText, path: "/student/homework" },
            { value: "messages" as StudentTab, label: "Чат", icon: MessageCircle, path: "/student/messages" },
            { value: "progress" as StudentTab, label: "Прогресс", icon: Sparkles, path: "/student/progress" },
          ] as const).map((item) => {
            const isActive = activeTab === item.value;
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                onClick={() => setLocation(item.path)}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid={`mobile-nav-${item.value}`}
              >
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                  isActive ? "bg-primary/15 scale-110" : "hover:bg-muted/60"
                )}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
