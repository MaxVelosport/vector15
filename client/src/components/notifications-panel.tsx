import { useState } from "react";
import { Bell, Calendar, CreditCard, Gift, FileText, Check, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, useUnreadCount, useMarkNotificationRead, useMarkAllRead } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, React.ElementType> = {
  lesson_reminder: Calendar,
  payment_reminder: CreditCard,
  payment_received: CreditCard,
  birthday: Gift,
  homework_deadline: FileText,
  system: Bell,
};

const typeColors: Record<string, string> = {
  lesson_reminder: "bg-blue-500/10 text-blue-500",
  payment_reminder: "bg-amber-500/10 text-amber-500",
  payment_received: "bg-emerald-500/10 text-emerald-500",
  birthday: "bg-sky-500/10 text-sky-500",
  homework_deadline: "bg-cyan-500/10 text-cyan-500",
  system: "bg-slate-500/10 text-slate-500",
};

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const { data: notifications, isLoading } = useNotifications();
  const { data: countData } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = countData?.count ?? 0;

  const handleMarkRead = (id: string) => {
    markRead.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Уведомления</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 p-1 text-xs"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3 w-3" />
              Прочитать все
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Загрузка...</div>
            </div>
          ) : !notifications?.length ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Bell className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <div className="text-sm text-muted-foreground">Нет уведомлений</div>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type] || Bell;
                const colorClass = typeColors[notification.type] || typeColors.system;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                      !notification.isRead && "bg-primary/5"
                    )}
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm", !notification.isRead && "font-medium")}>
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => handleMarkRead(notification.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
