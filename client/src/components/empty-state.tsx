import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  BookOpen, 
  Calendar, 
  CircleDollarSign, 
  GraduationCap, 
  MessageSquare, 
  Sparkles, 
  Users 
} from "lucide-react";
import { motion } from "framer-motion";
import { ReactNode } from "react";

type EmptyStateType = "students" | "lessons" | "payments" | "tasks" | "messages" | "schedule" | "default";

interface EmptyStateConfig {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
  iconBg: string;
}

const configs: Record<EmptyStateType, EmptyStateConfig> = {
  students: {
    icon: Users,
    title: "Добавьте первого ученика",
    description: "Нажмите кнопку ниже, чтобы добавить ученика. Укажите имя, предмет и стоимость занятия — остальное заполните позже.",
    gradient: "from-blue-500/10 via-transparent to-cyan-500/10",
    iconBg: "bg-blue-500/10 text-blue-500",
  },
  lessons: {
    icon: GraduationCap,
    title: "Нет занятий на эту дату",
    description: "Перейдите в раздел «Расписание» или нажмите «Добавить занятие» наверху страницы, чтобы запланировать урок.",
    gradient: "from-blue-500/10 via-transparent to-cyan-500/10",
    iconBg: "bg-blue-500/10 text-blue-500",
  },
  payments: {
    icon: CircleDollarSign,
    title: "Нет платежей",
    description: "Когда ученик оплатит занятие — зафиксируйте это на его карточке, кнопка «Внести оплату». Платежи появятся здесь.",
    gradient: "from-emerald-500/10 via-transparent to-teal-500/10",
    iconBg: "bg-emerald-500/10 text-emerald-500",
  },
  tasks: {
    icon: BookOpen,
    title: "Банк заданий пуст",
    description: "Откройте раздел «ИИ» → «Генерация заданий», выберите ученика и тему — ИИ создаст задачи для урока или домашней работы.",
    gradient: "from-amber-500/10 via-transparent to-orange-500/10",
    iconBg: "bg-amber-500/10 text-amber-500",
  },
  messages: {
    icon: MessageSquare,
    title: "Нет рассылок",
    description: "Напишите сообщение в разделе «Рассылки», чтобы уведомить учеников о важном: перенос занятия, напоминание и т.д.",
    gradient: "from-sky-500/10 via-transparent to-blue-500/10",
    iconBg: "bg-sky-500/10 text-sky-500",
  },
  schedule: {
    icon: Calendar,
    title: "Нет занятий на этот день",
    description: "Кликните на дату в календаре или нажмите «Добавить занятие», чтобы запланировать урок. Можно сразу настроить повторение.",
    gradient: "from-indigo-500/10 via-transparent to-blue-500/10",
    iconBg: "bg-indigo-500/10 text-indigo-500",
  },
  default: {
    icon: Sparkles,
    title: "Здесь пока пусто",
    description: "Начните работу с добавления первого ученика в разделе «Ученики».",
    gradient: "from-primary/10 via-transparent to-primary/5",
    iconBg: "bg-primary/10 text-primary",
  },
};

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  type = "default",
  title,
  description,
  action,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const config = configs[type];
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-8",
        className
      )}
    >
      <div className={cn(
        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-50",
        config.gradient
      )} />
      
      <div className="relative flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl",
            config.iconBg
          )}
        >
          <Icon className="h-8 w-8" />
        </motion.div>
        
        <motion.h3
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-4 text-lg font-semibold"
        >
          {title || config.title}
        </motion.h3>
        
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-2 max-w-sm text-sm text-muted-foreground"
        >
          {description || config.description}
        </motion.p>
        
        {(action || actionLabel) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-6"
          >
            {action || (
              <Button onClick={onAction} className="gap-2">
                {actionLabel}
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
