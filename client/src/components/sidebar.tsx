import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Bot,
  CircleDollarSign,
  Crown,
  GraduationCap,
  LayoutGrid,
  LibraryBig,
  MessageCircle,
  Shield,
  Users,
  User,
  FlaskConical,
  Inbox,
  Video,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TabValue = "home" | "lessons" | "homework" | "quizzes" | "finance" | "students" | "profile" | "chat" | "ai" | "tasks" | "applications";

interface SidebarProps {
  activeTab?: TabValue;
  onTabChange?: (tab: TabValue) => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
  onSubscriptionClick?: () => void;
}

const navItems: { value: TabValue; label: string; hint: string; icon: React.ElementType; path: string }[] = [
  { value: "home", label: "Главная", hint: "Обзор: занятия на сегодня, быстрые действия", icon: LayoutGrid, path: "/" },
  { value: "students", label: "Ученики", hint: "Список учеников, прогресс, баланс, программы", icon: Users, path: "/students" },
  { value: "lessons", label: "Занятия", hint: "Занятия, расписание и журнал", icon: GraduationCap, path: "/lessons" },
  { value: "homework", label: "Домашки", hint: "Домашние задания учеников", icon: BookOpen, path: "/homework" },
  { value: "quizzes", label: "Тренажёры", hint: "Тесты и карточки для учеников", icon: BookOpen, path: "/quizzes" },
  { value: "recordings" as TabValue, label: "Записи уроков", hint: "Расшифровка и автоконспект уроков", icon: Video, path: "/recordings" },
  { value: "finance", label: "Финансы", hint: "Платежи, долги, статистика, аналитика", icon: CircleDollarSign, path: "/finance" },
  { value: "chat", label: "Сообщения", hint: "Чаты и рассылки ученикам", icon: MessageCircle, path: "/chat" },
  { value: "applications", label: "Заявки", hint: "Запросы от учеников с публичного профиля", icon: Inbox, path: "/applications" },
  { value: "tasks", label: "Задачник", hint: "База заданий — составляйте варианты и назначайте ученикам", icon: FlaskConical, path: "/tasks" },
  { value: "ai", label: "ИИ", hint: "Генерация заданий, чат с ИИ-помощником", icon: Bot, path: "/ai" },
];

function getActiveTabFromPath(path: string): TabValue {
  const item = navItems.find(i => i.path === path);
  if (item) return item.value;
  if (path === "/profile") return "profile";
  if (path === "/schedule") return "lessons";
  if (path === "/comm") return "chat";
  if (path === "/analytics") return "finance";
  if (path === "/help") return "knowledge" as any;
  return "home";
}

function useApplicationsBadge() {
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/applications/pending-count"],
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  return data?.count || 0;
}

export function Sidebar({ activeTab, onTabChange, isAdmin, onAdminClick, onSubscriptionClick }: SidebarProps) {
  const [currentPath, setLocation] = useLocation();
  const currentTab = activeTab ?? getActiveTabFromPath(currentPath);
  const pendingApplications = useApplicationsBadge();

  const handleNavClick = (item: typeof navItems[0]) => {
    setLocation(item.path);
    onTabChange?.(item.value);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-16 flex-col border-r border-border/50 bg-card/80 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center justify-center border-b border-border/50">
        <button
          onClick={() => setLocation("/profile")}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition-transform hover:scale-105",
            currentPath === "/profile"
              ? "bg-gradient-to-br from-primary to-primary/70 text-white font-bold text-lg"
              : "bg-gradient-to-br from-primary to-primary/70 text-white font-bold text-lg"
          )}
          title="Профиль"
          data-testid="sidebar-profile-logo"
        >
          В
        </button>
      </div>
      
      <nav className="flex flex-1 flex-col items-center gap-1 py-4">
        <TooltipProvider delayDuration={200}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.value;
          
          return (
            <Tooltip key={item.value}>
              <TooltipTrigger asChild>
            <button
              onClick={() => handleNavClick(item)}
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
                "hover:bg-primary/10",
                isActive && "bg-primary/15 text-primary"
              )}
              data-testid={`sidebar-nav-${item.value}`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute inset-0 rounded-xl bg-primary/15"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className={cn(
                "relative h-5 w-5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )} />
              {item.value === "applications" && pendingApplications > 0 && (
                <span
                  className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center leading-none"
                  data-testid="badge-applications-pending"
                >
                  {pendingApplications > 99 ? "99+" : pendingApplications}
                </span>
              )}
            </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px]">
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        </TooltipProvider>
      </nav>
      
      <div className="border-t border-border/50 py-4 space-y-1">
        <button
          onClick={() => setLocation("/profile")}
          className={cn(
            "mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-primary/10 hover:text-primary",
            currentPath === "/profile" ? "bg-primary/15 text-primary" : "text-muted-foreground"
          )}
          title="Профиль"
          data-testid="sidebar-profile"
        >
          <User className="h-5 w-5" />
        </button>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/help")}
                className={cn(
                  "mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-primary/10 hover:text-primary",
                  currentPath === "/help" ? "bg-primary/15 text-primary" : "text-muted-foreground"
                )}
                data-testid="sidebar-knowledge"
              >
                <LibraryBig className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-medium">База знаний</p>
              <p className="text-xs text-muted-foreground">Руководство и ИИ-помощник</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <button
          onClick={onSubscriptionClick ?? (() => setLocation("/subscription"))}
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          title="Тарифы"
          data-testid="sidebar-subscription"
        >
          <Crown className="h-5 w-5" />
        </button>
        {isAdmin && (
          <button
            onClick={onAdminClick ?? (() => setLocation("/admin"))}
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-amber-500/10 hover:text-amber-500"
            title="Админка"
            data-testid="sidebar-admin"
          >
            <Shield className="h-5 w-5" />
          </button>
        )}
      </div>
    </aside>
  );
}

export function MobileNav({ activeTab, onTabChange }: Pick<SidebarProps, "activeTab" | "onTabChange">) {
  const [currentPath, setLocation] = useLocation();
  const currentTab = activeTab ?? getActiveTabFromPath(currentPath);

  const handleNavClick = (item: typeof navItems[0]) => {
    setLocation(item.path);
    onTabChange?.(item.value);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-card/95 backdrop-blur-xl lg:hidden safe-area-inset-bottom">
      <div className="flex h-14 items-center overflow-x-auto scrollbar-none">
        <div className="flex min-w-max items-center gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.value;
            
            return (
              <button
                key={item.value}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted"
                )}
                data-testid={`mobile-nav-${item.value}`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
