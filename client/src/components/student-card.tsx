import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Archive, 
  Calendar, 
  CircleDollarSign, 
  ExternalLink, 
  MessageCircle, 
  MoreHorizontal,
  Pencil,
  User
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";

interface StudentCardProps {
  student: {
    id: string;
    name: string;
    subject: string;
    goal?: string | null;
    grade?: string | null;
    pricePerLesson: number;
    balance: number;
    isActive: boolean;
    progress: number;
    curriculumTopic?: string | null;
    links?: { zoom?: string; board?: string } | null;
  };
  onScheduleLesson?: () => void;
  onAddPayment?: () => void;
  onMessage?: () => void;
  onToggleArchive?: () => void;
  onEdit?: () => void;
  compact?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "from-blue-500 to-cyan-600",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-sky-500 to-blue-600",
    "from-indigo-500 to-blue-500",
  ];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function StudentCard({
  student,
  onScheduleLesson,
  onAddPayment,
  onMessage,
  onToggleArchive,
  onEdit,
  compact = false,
}: StudentCardProps) {
  const balanceColor = student.balance < 0 
    ? "text-red-500" 
    : student.balance > 0 
      ? "text-emerald-500" 
      : "text-muted-foreground";

  const formatMoney = (amount: number) => {
    const sign = amount < 0 ? "−" : amount > 0 ? "+" : "";
    return `${sign}${Math.abs(amount).toLocaleString("ru-RU")} ₽`;
  };

  if (compact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "group flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 p-3 transition-all hover:border-border hover:bg-card/80",
          !student.isActive && "opacity-60"
        )}
        data-testid={`student-card-compact-${student.id}`}
      >
        <div className={cn(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white text-sm font-medium",
          getAvatarColor(student.name)
        )}>
          {getInitials(student.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{student.name}</span>
            {!student.isActive && (
              <Badge variant="secondary" className="text-[10px]">архив</Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{student.subject}</span>
            <span>•</span>
            <span className={balanceColor}>{formatMoney(student.balance)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onScheduleLesson}>
            <Calendar className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAddPayment}>
            <CircleDollarSign className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-4 transition-all hover:border-border hover:bg-card/80 hover:shadow-lg",
        !student.isActive && "opacity-60"
      )}
      data-testid={`student-card-${student.id}`}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white font-semibold text-lg shadow-lg",
          getAvatarColor(student.name)
        )}>
          {getInitials(student.name)}
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{student.name}</h3>
                {!student.isActive && (
                  <Badge variant="secondary" className="text-[10px]">архив</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="font-normal">{student.subject}</Badge>
                {student.goal && (
                  <span className="text-xs">{student.goal}</span>
                )}
                {student.grade && (
                  <span className="text-xs text-muted-foreground/60">• {student.grade}</span>
                )}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Редактировать
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMessage}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Написать
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onToggleArchive}>
                  <Archive className="mr-2 h-4 w-4" />
                  {student.isActive ? "В архив" : "Восстановить"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {student.curriculumTopic && (
            <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2">
              <div className="text-xs text-muted-foreground">Текущая тема</div>
              <div className="mt-0.5 text-sm">{student.curriculumTopic}</div>
            </div>
          )}
          
          <div className="mt-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Прогресс</span>
                <span className="font-medium">{student.progress}%</span>
              </div>
              <Progress value={student.progress} className="h-1.5" />
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Баланс</div>
              <div className={cn("text-sm font-semibold", balanceColor)}>
                {formatMoney(student.balance)}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-4">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onScheduleLesson}>
          <Calendar className="h-3.5 w-3.5" />
          Занятие
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onAddPayment}>
          <CircleDollarSign className="h-3.5 w-3.5" />
          Оплата
        </Button>
        {student.links?.zoom && (
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={student.links.zoom} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
      </div>
    </motion.div>
  );
}
