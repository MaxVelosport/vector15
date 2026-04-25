import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Student {
  id: string;
  name: string;
  subject: string;
  grade?: string | number | null;
}

interface StudentComboboxProps {
  students: Student[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
  className?: string;
  triggerClassName?: string;
  "data-testid"?: string;
}

function formatStudentLabel(s: Student): string {
  let label = s.name;
  if (s.subject) label += ` — ${s.subject}`;
  if (s.grade) label += ` (${s.grade} кл.)`;
  return label;
}

export function StudentCombobox({
  students,
  value,
  onValueChange,
  placeholder = "Выберите ученика",
  showAllOption = false,
  allOptionLabel,
  className,
  triggerClassName,
  "data-testid": testId,
}: StudentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  const filtered = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.subject.toLowerCase().includes(q);
  });

  const selectedStudent = students.find((s) => s.id === value);
  const selected = value === "__all__"
    ? allOptionLabel || `Все ученики (${students.length})`
    : selectedStudent ? formatStudentLabel(selectedStudent) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid={testId}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">{selected || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[var(--radix-popover-trigger-width)] p-0", className)} align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени..."
            className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto p-1">
          {showAllOption && !search && (
            <button
              onClick={() => { onValueChange("__all__"); setOpen(false); }}
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent",
                value === "__all__" && "bg-accent"
              )}
            >
              <Check className={cn("mr-2 h-4 w-4", value === "__all__" ? "opacity-100" : "opacity-0")} />
              <span className="font-medium">{allOptionLabel || `Все ученики (${students.length})`}</span>
            </button>
          )}
          {filtered.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">Не найдено</div>
          )}
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => { onValueChange(s.id); setOpen(false); }}
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent",
                value === s.id && "bg-accent"
              )}
            >
              <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{formatStudentLabel(s)}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
