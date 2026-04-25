import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Users,
  BookOpen,
  CreditCard,
  ClipboardList,
} from "lucide-react";
import { useStudents, useLessons, usePayments, useHomework } from "@/hooks/use-tutor-data";
import {
  exportAllDataToExcel,
  exportSectionCSV,
  exportStudentsToExcel,
  exportHomeworkToExcel,
} from "@/lib/export-excel";

interface ExportDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTIONS = [
  {
    key: "students" as const,
    label: "Ученики",
    icon: Users,
    desc: "Имя, предмет, цель, класс, цена, контакты, статус",
    timeFiltered: false,
  },
  {
    key: "lessons" as const,
    label: "Занятия",
    icon: BookOpen,
    desc: "Дата, ученик, тема, длительность, статус, стоимость",
    timeFiltered: true,
  },
  {
    key: "payments" as const,
    label: "Платежи",
    icon: CreditCard,
    desc: "Дата, ученик, сумма, комментарий",
    timeFiltered: true,
  },
  {
    key: "homework" as const,
    label: "Домашние задания",
    icon: ClipboardList,
    desc: "Задание, статус, оценка, ответ ученика, отзыв репетитора",
    timeFiltered: true,
  },
];

export function ExportDataModal({ open, onOpenChange }: ExportDataModalProps) {
  const [include, setInclude] = useState<Record<string, boolean>>({
    students: true,
    lessons: true,
    payments: true,
    homework: true,
  });
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: students = [] } = useStudents();
  const { data: lessonsRaw = [] } = useLessons();
  const { data: payments = [] } = usePayments();
  const { data: homework = [] } = useHomework();

  const lessons = lessonsRaw as any[];

  const counts = useMemo(() => {
    const from = new Date(fromDate);
    const to = new Date(toDate + "T23:59:59");
    return {
      students: (students as any[]).length,
      lessons: lessons.filter(l => {
        const d = new Date(l.scheduledAt);
        return d >= from && d <= to;
      }).length,
      payments: (payments as any[]).filter(p => {
        const d = new Date(p.createdAt);
        return d >= from && d <= to;
      }).length,
      homework: (homework as any[]).filter(h => {
        const d = new Date(h.createdAt);
        return d >= from && d <= to;
      }).length,
    };
  }, [students, lessons, payments, homework, fromDate, toDate]);

  const anySelected = Object.values(include).some(Boolean);
  const hasTimeFilter = include.lessons || include.payments || include.homework;

  const handleExcelExport = () => {
    exportAllDataToExcel({
      students: include.students ? (students as any[]) : [],
      lessons: include.lessons ? lessons : [],
      payments: include.payments ? (payments as any[]) : [],
      homework: include.homework ? (homework as any[]) : [],
      fromDate: hasTimeFilter ? fromDate : undefined,
      toDate: hasTimeFilter ? toDate : undefined,
    });
    onOpenChange(false);
  };

  const handleCSVExport = (section: "students" | "lessons" | "payments" | "homework") => {
    const from = new Date(fromDate);
    const to = new Date(toDate + "T23:59:59");

    let data: any[] = [];
    if (section === "students") data = students as any[];
    if (section === "lessons") data = lessons.filter(l => { const d = new Date(l.scheduledAt); return d >= from && d <= to; });
    if (section === "payments") data = (payments as any[]).filter(p => { const d = new Date(p.createdAt); return d >= from && d <= to; });
    if (section === "homework") data = (homework as any[]).filter(h => { const d = new Date(h.createdAt); return d >= from && d <= to; });

    exportSectionCSV(section, data, students as any[]);
  };

  const toggle = (key: string) => setInclude(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Экспорт данных
          </DialogTitle>
          <DialogDescription>
            Выберите данные для скачивания. Excel-файл будет содержать отдельные листы для каждого раздела.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid gap-2">
            {SECTIONS.map(({ key, label, icon: Icon, desc, timeFiltered }) => {
              const count = counts[key];
              const checked = include[key];
              return (
                <div
                  key={key}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    checked ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggle(key)}
                  data-testid={`export-section-${key}`}
                >
                  <Checkbox
                    id={`export-${key}`}
                    checked={checked}
                    onCheckedChange={() => toggle(key)}
                    onClick={e => e.stopPropagation()}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Label htmlFor={`export-${key}`} className="font-medium cursor-pointer text-sm">
                        {label}
                      </Label>
                      <Badge variant="secondary" className="text-xs ml-auto">
                        {timeFiltered ? count : (students as any[]).length} строк
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs shrink-0 gap-1"
                    onClick={e => { e.stopPropagation(); handleCSVExport(key); }}
                    title="Скачать как CSV"
                    data-testid={`button-csv-${key}`}
                  >
                    <FileText className="h-3 w-3" />
                    CSV
                  </Button>
                </div>
              );
            })}
          </div>

          {hasTimeFilter && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Период (для занятий, платежей, домашних заданий)
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">С</Label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={e => setFromDate(e.target.value)}
                      className="h-8 text-sm mt-1"
                      data-testid="input-export-from"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">По</Label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={e => setToDate(e.target.value)}
                      className="h-8 text-sm mt-1"
                      data-testid="input-export-to"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Excel-файл с {Object.values(include).filter(Boolean).length} листами
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9"
              >
                Отмена
              </Button>
              <Button
                size="sm"
                disabled={!anySelected}
                onClick={handleExcelExport}
                className="gap-2 h-9 shadow-sm shadow-primary/20"
                data-testid="button-export-excel-all"
              >
                <Download className="h-4 w-4" />
                Скачать Excel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
