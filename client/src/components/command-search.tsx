import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users,
  Calendar,
  MessageCircle,
  BookOpen,
  CircleDollarSign,
  Bot,
  LayoutGrid,
  GraduationCap,
  ClipboardList,
  LibraryBig,
  FlaskConical,
} from "lucide-react";
import { useStudents } from "@/hooks/use-tutor-data";

const NAV_ITEMS = [
  { label: "Главная", path: "/", icon: LayoutGrid, group: "Навигация" },
  { label: "Расписание", path: "/schedule", icon: Calendar, group: "Навигация" },
  { label: "Ученики", path: "/students", icon: Users, group: "Навигация" },
  { label: "Домашние задания", path: "/homework", icon: BookOpen, group: "Навигация" },
  { label: "Финансы", path: "/finance", icon: CircleDollarSign, group: "Навигация" },
  { label: "Чат", path: "/chat", icon: MessageCircle, group: "Навигация" },
  { label: "ИИ-помощник", path: "/ai", icon: Bot, group: "Навигация" },
  { label: "Банк заданий", path: "/task-bank", icon: LibraryBig, group: "Навигация" },
  { label: "Конструктор урока", path: "/lesson-plan", icon: FlaskConical, group: "Навигация" },
  { label: "Аналитика", path: "/analytics", icon: GraduationCap, group: "Навигация" },
  { label: "Настройки", path: "/settings", icon: ClipboardList, group: "Навигация" },
];

interface CommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const [, setLocation] = useLocation();
  const { data: students = [] } = useStudents();
  const [query, setQuery] = useState("");

  const navigate = useCallback((path: string) => {
    setLocation(path);
    onOpenChange(false);
    setQuery("");
  }, [setLocation, onOpenChange]);

  const filteredStudents = (students as any[]).filter((s) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.subject || "").toLowerCase().includes(q);
  }).slice(0, 8);

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (!query) return true;
    return item.label.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Поиск учеников, страниц..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>

        {filteredStudents.length > 0 && (
          <CommandGroup heading="Ученики">
            {filteredStudents.map((s: any) => (
              <CommandItem
                key={s.id}
                value={`student-${s.id}-${s.name}`}
                onSelect={() => navigate(`/students?select=${s.id}`)}
                className="gap-2"
                data-testid={`cmd-student-${s.id}`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{s.name}</span>
                  {s.subject && (
                    <span className="ml-2 text-xs text-muted-foreground">{s.subject}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">Открыть</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredStudents.length > 0 && filteredNav.length > 0 && <CommandSeparator />}

        {filteredNav.length > 0 && (
          <CommandGroup heading="Навигация">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.path}
                  value={`nav-${item.path}-${item.label}`}
                  onSelect={() => navigate(item.path)}
                  className="gap-2"
                  data-testid={`cmd-nav-${item.path.replace("/", "")}`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
