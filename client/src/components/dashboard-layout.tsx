import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  BookOpen,
  Bot,
  CircleDollarSign,
  Crown,
  FlaskConical,
  GraduationCap,
  LayoutGrid,
  LibraryBig,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  Plus,
  Shield,
  Sun,
  Users,
  Video,
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
  ClipboardList,
  Search,
  Gift,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NotificationsPanel } from "@/components/notifications-panel";
import { CommandSearch } from "@/components/command-search";
import { SUBSCRIPTION_LIMITS } from "@shared/schema";
import type { SubscriptionTier } from "@shared/schema";
import { toast } from "@/lib/toast";

const TIER_COLORS: Record<SubscriptionTier, { bg: string; text: string; border: string; icon: string }> = {
  free: { bg: "bg-muted/60", text: "text-muted-foreground", border: "border-border/50", icon: "text-muted-foreground" },
  pro: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", icon: "text-blue-500" },
  premium: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", icon: "text-amber-500" },
};

function getTierLabel(tier: string): string {
  const t = tier as SubscriptionTier;
  return SUBSCRIPTION_LIMITS[t]?.name || tier;
}

function getTierDescription(tier: string): string {
  const descriptions: Record<string, string> = {
    free: "Бесплатный тариф — до 5 учеников, базовые функции",
    pro: "Базовый тариф — до 15 учеников, рассылки, портал ученика",
    premium: "Про тариф — до 40 учеников, безлимит ИИ, аналитика, ИИ-куратор",
  };
  return descriptions[tier] || "Ваш текущий тариф";
}

function getUserInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function TutorTelegramManagerButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [codeData, setCodeData] = useState<{ code: string; expiresAt: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: tgStatus } = useQuery<{
    botRunning: boolean;
    botUsername: string | null;
    tutorLinked: boolean;
    notificationsEnabled: boolean;
    tutorLink: string | null;
  }>({ queryKey: ["/api/telegram/status"], refetchInterval: open ? 5000 : false });

  const toggleNotif = useMutation({
    mutationFn: (enabled: boolean) => apiRequest("PATCH", "/api/telegram/notifications", { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/telegram/status"] }),
    onError: () => toast.error("Не удалось изменить настройку"),
  });

  const unlinkMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/telegram/unlink-tutor"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/telegram/status"] });
      setConfirmUnlink(false);
      toast.success("Telegram отвязан");
    },
    onError: () => toast.error("Ошибка при отвязке"),
  });

  const linked = tgStatus?.tutorLinked ?? false;
  const notifEnabled = tgStatus?.notificationsEnabled ?? true;
  const botUsername = tgStatus?.botUsername ?? "MyVectorAI_bot";
  const botRunning = tgStatus?.botRunning ?? false;

  function startTimer(expiresAt: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    const update = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && timerRef.current) clearInterval(timerRef.current);
    };
    update();
    timerRef.current = setInterval(update, 1000);
  }

  async function generateCode() {
    try {
      const res = await apiRequest("POST", "/api/telegram/generate-code");
      const data = await res.json();
      setCodeData({ code: data.code, expiresAt: data.expiresAt });
      startTimer(data.expiresAt);
    } catch {
      toast.error("Не удалось сгенерировать код");
    }
  }

  function openCodeDialog() {
    setCodeDialogOpen(true);
    setCodeData(null);
    generateCode();
  }

  function copyCode() {
    if (!codeData) return;
    navigator.clipboard.writeText(codeData.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            data-testid="header-btn-telegram"
            className={cn(
              "flex items-center rounded-lg overflow-hidden border transition-all cursor-pointer group",
              linked
                ? "border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20"
                : "border-sky-500/30 bg-gradient-to-r from-sky-500/10 to-blue-500/10 hover:from-sky-500/20 hover:to-blue-500/20"
            )}
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <div className="relative shrink-0">
                <Send className={cn("h-3.5 w-3.5", linked ? "text-green-500" : "text-sky-500")} />
                {!linked && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                )}
              </div>
              <div className="hidden md:block text-left">
                <div className={cn("text-[11px] font-semibold leading-none", linked ? "text-green-600 dark:text-green-400" : "text-sky-600 dark:text-sky-400")}>
                  Telegram
                </div>
                <div className={cn("text-[10px] leading-none mt-0.5", linked ? "text-green-500/70" : "text-sky-500/70")}>
                  {linked ? (notifEnabled ? "подключён • уведомления" : "подключён • без уведомлений") : "не подключён"}
                </div>
              </div>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Telegram-бот</span>
            <Badge variant="outline" className={cn("text-[11px]", linked ? "border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/10" : "border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10")}>
              {linked ? "Подключён" : "Не подключён"}
            </Badge>
          </div>

          {!botRunning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
              Бот не настроен. Добавьте Telegram-токен в настройках профиля.
            </p>
          )}

          {linked && (
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                {notifEnabled ? <Bell className="h-3.5 w-3.5 text-blue-500" /> : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-xs font-medium">Уведомления</span>
              </div>
              <Switch
                checked={notifEnabled}
                onCheckedChange={(v) => toggleNotif.mutate(v)}
                disabled={toggleNotif.isPending}
                data-testid="switch-tutor-notifications"
              />
            </div>
          )}

          <div className="space-y-2">
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 px-3 py-2 text-xs font-medium text-sky-600 dark:text-sky-400 transition-colors"
              data-testid="link-open-bot"
            >
              <Send className="h-3.5 w-3.5" />
              Открыть @{botUsername}
            </a>

            {!linked ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs gap-2 border-green-500/30 text-green-600 hover:bg-green-500/10"
                onClick={() => { setOpen(false); openCodeDialog(); }}
                disabled={!botRunning}
                data-testid="btn-connect-telegram"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Подключить Telegram
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-2"
                  onClick={() => { setOpen(false); openCodeDialog(); }}
                  disabled={!botRunning}
                  data-testid="btn-reconnect-telegram"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Переподключить аккаунт
                </Button>
                {!confirmUnlink ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10"
                    onClick={() => setConfirmUnlink(true)}
                    data-testid="btn-unlink-telegram"
                  >
                    <Link2Off className="h-3.5 w-3.5" />
                    Отключить Telegram
                  </Button>
                ) : (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 space-y-2">
                    <p className="text-xs text-center text-muted-foreground">Отключить уведомления из бота?</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="flex-1 text-xs h-7" onClick={() => setConfirmUnlink(false)}>Отмена</Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 text-xs h-7"
                        onClick={() => unlinkMutation.mutate()}
                        disabled={unlinkMutation.isPending}
                        data-testid="btn-confirm-unlink"
                      >
                        {unlinkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Отключить"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={codeDialogOpen} onOpenChange={(v) => { setCodeDialogOpen(v); if (!v && timerRef.current) clearInterval(timerRef.current); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Подключение Telegram</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground text-xs">
              Отправьте этот код боту <span className="font-medium text-foreground">@{botUsername}</span> — введите его после команды /start.
            </p>
            {!codeData ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
                  <span className="text-3xl font-mono font-bold tracking-[0.25em] text-foreground">{codeData.code}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={copyCode} data-testid="btn-copy-code">
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" />
                    <span>{secondsLeft > 0 ? `Действует ${fmt(secondsLeft)}` : "Код истёк"}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={generateCode} data-testid="btn-refresh-code">
                    <RefreshCw className="h-3 w-3" /> Обновить
                  </Button>
                </div>
              </>
            )}
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 text-sm font-medium transition-colors"
              data-testid="link-open-bot-dialog"
            >
              <Send className="h-4 w-4" />
              Открыть @{botUsername}
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type TabValue = "home" | "students" | "schedule" | "homework" | "quizzes" | "recordings" | "finance" | "chat" | "tasks" | "ai" | "lesson-plan" | "referrals" | "profile";

const navItems: { value: TabValue; label: string; icon: React.ElementType; path: string; hint: string }[] = [
  { value: "home", label: "Главная", icon: LayoutGrid, path: "/", hint: "Обзор и быстрый доступ" },
  { value: "students", label: "Ученики", icon: Users, path: "/students", hint: "Управление учениками" },
  { value: "schedule", label: "Расписание", icon: GraduationCap, path: "/schedule", hint: "Расписание и журнал занятий" },
  { value: "homework", label: "Домашки", icon: BookOpen, path: "/homework", hint: "Домашние задания и тренажёры" },
  { value: "finance", label: "Финансы", icon: CircleDollarSign, path: "/finance", hint: "Платежи, долги, статистика, аналитика" },
  { value: "chat", label: "Сообщения", icon: MessageCircle, path: "/chat", hint: "Чаты и рассылки ученикам" },
  { value: "ai", label: "ИИ-помощник", icon: Bot, path: "/ai", hint: "Чат с ИИ и задачник для генерации заданий" },
  { value: "lesson-plan", label: "Планировщик", icon: ClipboardList, path: "/lesson-plan", hint: "Планы уроков и записи прошедших занятий" },
];

function DashboardSidebar({ currentPath }: { currentPath: string }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const getActiveTab = (): TabValue => {
    const item = navItems.find(i => i.path === currentPath);
    if (item) return item.value;
    if (currentPath === "/profile") return "profile";
    if (currentPath === "/referrals") return "referrals";
    if (currentPath === "/lessons") return "schedule";
    if (currentPath === "/comm") return "chat";
    if (currentPath === "/analytics") return "finance";
    if (currentPath === "/quizzes") return "homework";
    if (currentPath === "/tasks") return "ai";
    if (currentPath === "/recordings" || currentPath.startsWith("/recording/")) return "lesson-plan";
    return "home";
  };

  const activeTab = getActiveTab();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[220px] flex-col bg-sidebar lg:flex sidebar-hi-tech overflow-hidden">
      <div className="sidebar-grid-pattern" />
      <div className="sidebar-glow-orb sidebar-glow-orb-1" />
      <div className="sidebar-glow-orb sidebar-glow-orb-2" />

      <div className="relative z-10 flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); setLocation("/"); }}
          className="flex items-center gap-1.5 group"
          data-testid="sidebar-profile-logo"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 via-cyan-400/20 to-blue-500/30 blur-xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center gap-1">
              <span className="text-[15px] font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 dark:from-cyan-300 dark:via-cyan-200 dark:to-cyan-300 bg-clip-text text-transparent">
                ТВОЙ
              </span>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-blue-500 dark:text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M7 17L17 7M17 7H9M17 7V15" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[15px] font-extrabold tracking-tight bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-600 dark:from-cyan-200 dark:via-cyan-300 dark:to-cyan-200 bg-clip-text text-transparent">
                ВЕКТОР
              </span>
            </div>
          </div>
        </a>
      </div>

      <div className="relative z-10 px-4 pt-5 pb-2">
        <span className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-[0.15em] pl-2">Навигация</span>
      </div>

      <nav className="relative z-10 flex flex-1 flex-col gap-0.5 px-3 overflow-y-auto">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = activeTab === item.value;

          return (
            <Tooltip key={item.value}>
              <TooltipTrigger asChild>
                <motion.a
                  href={item.path}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={(e) => { e.preventDefault(); setLocation(item.path); }}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 dark:bg-sidebar-primary/12 text-primary dark:text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  data-testid={`sidebar-nav-${item.value}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary dark:bg-sidebar-primary"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <Icon className={cn("h-[18px] w-[18px] transition-transform duration-150 group-hover:scale-110", isActive ? "text-primary dark:text-sidebar-primary" : "text-sidebar-foreground/45")} />
                  <span>{item.label}</span>
                </motion.a>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {item.hint}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="relative z-10 border-t border-sidebar-border p-3 space-y-0.5">
        <a
          href="/referrals"
          onClick={(e) => { e.preventDefault(); setLocation("/referrals"); }}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
            currentPath === "/referrals"
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground/70 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
          )}
          data-testid="sidebar-referrals"
        >
          <Gift className={cn("h-[18px] w-[18px]", currentPath === "/referrals" ? "text-primary" : "text-sidebar-foreground/45")} />
          <span>Приведи друга</span>
        </a>
        <a
          href="/help"
          onClick={(e) => { e.preventDefault(); setLocation("/help"); }}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
            currentPath === "/help"
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground/70 hover:bg-primary/8 hover:text-primary"
          )}
          data-testid="sidebar-knowledge"
        >
          <LibraryBig className={cn("h-[18px] w-[18px]", currentPath === "/help" ? "text-primary" : "text-sidebar-foreground/45")} />
          <span>База знаний</span>
        </a>
        <a
          href="/subscription"
          onClick={(e) => { e.preventDefault(); setLocation("/subscription"); }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
          data-testid="sidebar-subscription"
        >
          <Crown className="h-[18px] w-[18px] text-sidebar-foreground/45" />
          <span>Тарифы</span>
        </a>
        {user?.isAdmin && (
          <a
            href="/admin"
            onClick={(e) => { e.preventDefault(); setLocation("/admin"); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
            data-testid="sidebar-admin"
          >
            <Shield className="h-[18px] w-[18px] text-sidebar-foreground/45" />
            <span>Админка</span>
          </a>
        )}

        {user && (
          <a
            href="/profile"
            onClick={(e) => { e.preventDefault(); setLocation("/profile"); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mt-1"
            data-testid="sidebar-user-profile"
          >
            <Avatar className="h-7 w-7 ring-1 ring-sidebar-border">
              <AvatarFallback className="text-[10px] font-semibold bg-primary/15 dark:bg-sidebar-primary/20 text-primary dark:text-sidebar-primary">
                {getUserInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0">
              <span className="truncate text-xs font-semibold text-sidebar-foreground max-w-[110px]">{user.name}</span>
              <span className="text-[10px] text-sidebar-foreground/50">{getTierLabel(user.subscription)}</span>
            </div>
          </a>
        )}
      </div>
    </aside>
  );
}

function DashboardMobileNav({ currentPath }: { currentPath: string }) {
  const [, setLocation] = useLocation();

  const getActiveTab = (): TabValue => {
    const item = navItems.find(i => i.path === currentPath);
    if (item) return item.value;
    if (currentPath === "/lessons") return "schedule";
    if (currentPath === "/comm") return "chat";
    if (currentPath === "/analytics") return "finance";
    if (currentPath === "/quizzes") return "homework";
    if (currentPath === "/tasks") return "ai";
    if (currentPath === "/recordings" || currentPath.startsWith("/recording/")) return "lesson-plan";
    return "home";
  };

  const activeTab = getActiveTab();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-2xl lg:hidden safe-area-inset-bottom">
      <div className="flex h-14 items-center overflow-x-auto scrollbar-none">
        <div className="flex min-w-max items-center gap-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.value;

            return (
              <a
                key={item.value}
                href={item.path}
                onClick={(e) => { e.preventDefault(); setLocation(item.path); }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                )}
                data-testid={`mobile-nav-${item.value}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Page error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 my-4">
          <h3 className="text-lg font-semibold text-destructive mb-2">Ошибка на странице</h3>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap mb-3">
            {this.state.error?.message}
          </pre>
          <pre className="text-[10px] text-muted-foreground/60 whitespace-pre-wrap mb-4 max-h-[200px] overflow-auto">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md"
          >
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
}

export function DashboardLayout({ children, title, subtitle, actions, tabs }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <DashboardSidebar currentPath={location} />
      <DashboardMobileNav currentPath={location} />

      <div className="lg:pl-[220px]">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border/40 bg-background/80 backdrop-blur-xl px-5 py-3 md:px-6">
          <div className="flex items-center gap-2.5">
            <div className="lg:hidden">
              <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-primary via-cyan-500 to-primary bg-clip-text text-transparent">
                ТВОЙ → ВЕКТОР
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-2">
              {user && (() => {
                const tier = (user.subscription || "free") as SubscriptionTier;
                const colors = TIER_COLORS[tier] || TIER_COLORS.free;
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(colors.bg, colors.text, colors.border, "gap-1.5 cursor-default text-[11px] px-2.5 py-0.5")}
                        data-testid="badge-tier"
                      >
                        <Crown className={cn("h-3 w-3", colors.icon)} />
                        {getTierLabel(tier)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px]">
                      <p className="text-xs">{getTierDescription(tier)}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })()}
            </div>

            {/* Conferences pill */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center rounded-lg overflow-hidden border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 transition-all cursor-pointer group">
                  <button
                    onClick={() => setLocation("/bbb")}
                    className="flex items-center gap-2 px-2.5 py-1.5"
                    data-testid="header-btn-conferences"
                  >
                    <Video className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <div className="hidden md:block text-left">
                      <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 leading-none">Конференции</div>
                      <div className="text-[10px] text-blue-500/70 leading-none mt-0.5">Видеозвонки с учениками</div>
                    </div>
                  </button>
                  <div className="w-px h-5 bg-blue-500/20" />
                  <button
                    onClick={() => setLocation("/bbb?create=1")}
                    className="flex items-center px-2 py-1.5 text-blue-500/60 hover:text-blue-600 transition-colors"
                    data-testid="header-btn-create-conference"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-xs font-medium">Видеоконференции</p>
                <p className="text-xs text-muted-foreground mt-0.5">Начните занятие онлайн прямо с платформы — без сторонних сервисов. Нажмите + чтобы создать новую конференцию.</p>
              </TooltipContent>
            </Tooltip>

            {/* Boards pill */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="hidden sm:flex items-center rounded-lg overflow-hidden border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20 transition-all cursor-pointer group">
                  <button
                    onClick={() => setLocation("/boards")}
                    className="flex items-center gap-2 px-2.5 py-1.5"
                    data-testid="header-btn-boards"
                  >
                    <Monitor className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    <div className="hidden md:block text-left">
                      <div className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 leading-none">Доски</div>
                      <div className="text-[10px] text-violet-500/70 leading-none mt-0.5">Совместная работа онлайн</div>
                    </div>
                  </button>
                  <div className="w-px h-5 bg-violet-500/20" />
                  <button
                    onClick={() => setLocation("/boards?create=1")}
                    className="flex items-center px-2 py-1.5 text-violet-500/60 hover:text-violet-600 transition-colors"
                    data-testid="header-btn-create-board"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-xs font-medium">Интерактивные доски</p>
                <p className="text-xs text-muted-foreground mt-0.5">Рисуйте, пишите и решайте задачи вместе с учеником в реальном времени. Нажмите + чтобы создать новую доску.</p>
              </TooltipContent>
            </Tooltip>

            {/* Telegram manager pill */}
            <TutorTelegramManagerButton />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 h-8 px-2.5 text-muted-foreground hover:text-foreground border-border/60"
              data-testid="button-global-search"
              title="Поиск (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs hidden md:inline">Поиск</span>
              <kbd className="hidden md:inline-flex h-4 items-center rounded border border-border/60 px-1 text-[10px] text-muted-foreground/70">⌘K</kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <NotificationsPanel />
            {actions}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground h-8 text-xs"
              data-testid="button-logout"
              onClick={() => logout()}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </header>

        <main className="px-4 py-4 sm:px-5 sm:py-6 md:px-6 pb-24 lg:pb-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl md:text-[28px]" data-testid="text-page-title">
                {title || "Твой Вектор"}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground flex-wrap" data-testid="text-page-subtitle">
                <span className="truncate">{subtitle || `Кабинет репетитора: ${user?.name || "Загрузка..."}`}</span>
                {user && !subtitle && (() => {
                  const tier = (user.subscription || "free") as SubscriptionTier;
                  const colors = TIER_COLORS[tier] || TIER_COLORS.free;
                  return (
                    <Badge variant="outline" className={cn(colors.bg, colors.text, colors.border, "text-[10px] gap-1 px-2 shrink-0")}>
                      <Crown className={cn("h-2.5 w-2.5", colors.icon)} />
                      {getTierLabel(tier)}
                    </Badge>
                  );
                })()}
              </div>
            </div>
            {tabs && <div className="shrink-0 pt-0.5">{tabs}</div>}
          </div>
          <PageErrorBoundary>
            {children}
          </PageErrorBoundary>
        </main>
      </div>
    </div>
  );
}
