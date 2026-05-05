import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, invalidateResource } from "@/lib/queryClient";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageTabs } from "@/components/page-tabs";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Search, Plus, Trash2, Eye, BookOpen, ChevronLeft, ChevronRight,
  Users, Clipboard, CheckCircle2, X, FileText, Loader2,
  Send, Shuffle, GraduationCap, ChevronDown, CalendarDays, BookMarked,
  Sparkles, ArrowLeft, Download, Printer, FolderOpen, BookOpenCheck, Info,
  Layers, Wand2, ChevronUp, Hash,
} from "lucide-react";
import katex from "katex";
import { useDocumentTitle } from "@/hooks/use-document-title";
import "katex/dist/katex.min.css";

const IMG_BASE = "https://superbase.aiinvestor360.ru/storage/v1/object/public/tasks/";

function renderLatex(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
      try { return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }); }
      catch { return math; }
    })
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
      try { return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }); }
      catch { return math; }
    });
}

function LatexBlock({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderLatex(text || ""), [text]);
  return <div className={cn("leading-relaxed [&_.katex]:text-sm", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

type Task = {
  id: string; subject: string; class: string; topic: string; difficulty: string;
  source: string; condition: string; solution: string | null; answer: string | null;
  image_path: string | null; image_path_answer: string | null; created_at: string;
};
type Variant = { id: string; tutorId: string; name: string; taskIds: string[]; createdAt: string };
type Student = { id: string; name: string; subject: string; isActive: boolean };
type BuilderGroup = { id: string; topic: string; cls: string; difficulty: string; count: number };

function uid() { return Math.random().toString(36).slice(2, 10); }

const CLASS_COLOR: Record<string, string> = {
  "ЕГЭ (п)": "bg-violet-500/10 text-violet-600 border-violet-200",
  "ЕГЭ (б)": "bg-blue-500/10 text-blue-600 border-blue-200",
};
const DIFF_COLOR: Record<string, string> = {
  "Средняя": "bg-amber-500/10 text-amber-600",
  "Сложное": "bg-red-500/10 text-red-600",
};

function stripLatex(text: string): string {
  return text
    .replace(/\\\[[\s\S]+?\\\]/g, "[формула]")
    .replace(/\\\([\s\S]+?\\\)/g, "[формула]")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function TaskDetailDialog({ task, open, onClose, onAdd, inVariant }: {
  task: Task | null; open: boolean; onClose: () => void;
  onAdd?: () => void; inVariant?: boolean;
}) {
  const [showSolution, setShowSolution] = useState(false);
  if (!task) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{task.topic}</span>
            <Badge variant="secondary" className={cn("text-xs border", CLASS_COLOR[task.class] || "")}>
              {task.class}
            </Badge>
            <Badge variant="secondary" className={cn("text-xs border-transparent", DIFF_COLOR[task.difficulty] || "")}>
              {task.difficulty}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        {task.source && (
          <p className="text-xs text-muted-foreground">Источник: {task.source}</p>
        )}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Условие</p>
            <div className="rounded-xl bg-muted/30 p-4">
              <LatexBlock text={task.condition} className="text-sm" />
              {task.image_path && (
                <img src={IMG_BASE + task.image_path} alt="Условие" className="mt-3 rounded-lg max-w-full border border-border/30" loading="lazy" />
              )}
            </div>
          </div>
          {!showSolution ? (
            <Button variant="outline" size="sm" onClick={() => setShowSolution(true)} data-testid="button-show-solution">
              <Eye className="h-4 w-4 mr-2" />Показать решение
            </Button>
          ) : (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Решение / Ответ</p>
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4">
                <LatexBlock text={task.answer || task.solution || "Решение не указано"} className="text-sm" />
                {task.image_path_answer && (
                  <img src={IMG_BASE + task.image_path_answer} alt="Ответ" className="mt-3 rounded-lg max-w-full border border-border/30" loading="lazy" />
                )}
              </div>
              <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground" onClick={() => setShowSolution(false)}>
                Скрыть решение
              </Button>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          {onAdd && (
            <Button
              className="flex-1"
              variant={inVariant ? "secondary" : "default"}
              onClick={onAdd}
              disabled={inVariant}
              data-testid="button-add-from-dialog"
            >
              {inVariant ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> : <Plus className="h-4 w-4 mr-2" />}
              {inVariant ? "Уже в варианте" : "Добавить в вариант"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SendHomeworkDialog({ open, onClose, variant, variantTaskIds, students }: {
  open: boolean; onClose: () => void;
  variant: Variant | null; variantTaskIds: string[];
  students: Student[];
}) {
  const { toast } = useToast();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [hints, setHints] = useState("");

  const activeStudents = students.filter(s => s.isActive);

  const toggle = (id: string) =>
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/variants/${variant!.id}/send-homework`, {
      studentIds: selectedStudents,
      deadline: deadline || undefined,
      description: description || undefined,
      hints: hints || undefined,
    }),
    onSuccess: (data: any) => {
      toast({ title: `Домашка отправлена ${data.created} ученик${data.created === 1 ? 'у' : 'ам'}` });
      invalidateResource("homework");
      onClose();
      setSelectedStudents([]);
      setDeadline("");
      setDescription("");
      setHints("");
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Отправить как домашнее задание
          </DialogTitle>
        </DialogHeader>
        {variant && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm">
            <p className="font-medium">{variant.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{variantTaskIds.length} задан{variantTaskIds.length === 1 ? "ие" : variantTaskIds.length < 5 ? "ия" : "ий"}</p>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Ученики <span className="text-muted-foreground font-normal">({selectedStudents.length} выбрано)</span></p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {activeStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Нет активных учеников</p>
              ) : (
                activeStudents.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all border",
                      selectedStudents.includes(s.id)
                        ? "bg-primary/8 border-primary/30 text-primary"
                        : "bg-muted/30 border-border/30 hover:border-border/60"
                    )}
                    data-testid={`checkbox-hw-student-${s.id}`}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                      selectedStudents.includes(s.id) ? "bg-primary border-primary" : "border-border"
                    )}>
                      {selectedStudents.includes(s.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.subject}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
            {activeStudents.length > 0 && (
              <div className="flex gap-2 mt-2">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedStudents(activeStudents.map(s => s.id))}>
                  Выбрать всех
                </Button>
                {selectedStudents.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => setSelectedStudents([])}>
                    Сбросить
                  </Button>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              <CalendarDays className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5 text-muted-foreground" />
              Дедлайн <span className="text-muted-foreground font-normal">(необязательно)</span>
            </label>
            <Input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="h-9 text-sm"
              data-testid="input-hw-deadline"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Комментарий для ученика</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Например: решить задания 1-3, остальные по желанию..."
              className="text-sm resize-none h-20"
              data-testid="textarea-hw-description"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Подсказки</label>
            <Textarea
              value={hints}
              onChange={e => setHints(e.target.value)}
              placeholder="Подсказки или формулы которые можно использовать..."
              className="text-sm resize-none h-16"
              data-testid="textarea-hw-hints"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button
            className="flex-1"
            disabled={selectedStudents.length === 0 || !variant || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
            data-testid="button-send-homework"
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Отправить{selectedStudents.length > 0 ? ` (${selectedStudents.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TopicCard({ topic, classes, onBrowse, onRandom, isLoadingRandom }: {
  topic: string; classes: string[];
  onBrowse: (cls?: string) => void;
  onRandom: () => void;
  isLoadingRandom: boolean;
}) {
  const num = parseInt(topic.replace(/\D/g, "")) || 0;
  return (
    <div className="rounded-2xl border border-border/40 bg-card/70 hover:border-border/70 hover:bg-card transition-all group flex flex-col">
      <button
        className="flex-1 p-4 text-left"
        onClick={() => onBrowse()}
        data-testid={`card-topic-${num}`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{num}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground mt-1 transition-colors" />
        </div>
        <p className="font-semibold text-sm mb-2">{topic}</p>
        <div className="flex gap-1 flex-wrap">
          {classes.map(cls => (
            <button
              key={cls}
              onClick={e => { e.stopPropagation(); onBrowse(cls); }}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors hover:opacity-80",
                CLASS_COLOR[cls] || "bg-muted text-muted-foreground border-border/40"
              )}
              data-testid={`button-filter-${num}-${cls.replace(/[\s()]/g, "")}`}
            >
              {cls}
            </button>
          ))}
        </div>
      </button>
      <div className="border-t border-border/30 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground hover:text-primary gap-1.5"
          onClick={onRandom}
          disabled={isLoadingRandom}
          data-testid={`button-random-${num}`}
        >
          {isLoadingRandom ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shuffle className="h-3 w-3" />}
          Случайное задание
        </Button>
      </div>
    </div>
  );
}

function BankTaskCard({ task, inVariant, onAdd, onView }: {
  task: Task; inVariant: boolean; onAdd: () => void; onView: () => void;
}) {
  const preview = useMemo(() => stripLatex(task.condition || "").slice(0, 180), [task.condition]);
  return (
    <div className={cn(
      "rounded-xl border transition-all p-3",
      inVariant ? "border-primary/30 bg-primary/3" : "border-border/40 bg-card/50 hover:border-border/60"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 border", CLASS_COLOR[task.class] || "bg-muted text-muted-foreground border-transparent")}>
              {task.class}
            </Badge>
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 border-transparent", DIFF_COLOR[task.difficulty] || "bg-muted text-muted-foreground")}>
              {task.difficulty}
            </Badge>
            {task.source && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{task.source}</span>
            )}
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">{preview || "Условие не указано"}{(task.condition || "").length > 180 ? "…" : ""}</p>
          {task.image_path && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <FileText className="h-3 w-3" />Есть рисунок
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button
            variant={inVariant ? "secondary" : "default"}
            size="icon"
            className={cn("h-8 w-8", inVariant ? "text-primary bg-primary/10" : "")}
            onClick={onAdd}
            title={inVariant ? "Уже в варианте" : "Добавить в вариант"}
            data-testid={`button-add-task-${task.id}`}
          >
            {inVariant ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={onView}
            title="Просмотр"
            data-testid={`button-view-task-${task.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function renderLatexForPrint(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
      try { return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }); }
      catch { return `<code>${math}</code>`; }
    })
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
      try { return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }); }
      catch { return `<code>${math}</code>`; }
    });
}

function openPrintWindow(variant: Variant, tasks: Task[], withSolutions: boolean) {
  const tasksHtml = tasks.map((task, i) => {
    const condHtml = renderLatexForPrint(task.condition || "");
    const solHtml = withSolutions ? renderLatexForPrint(task.answer || task.solution || "") : "";
    return `
      <div style="page-break-inside:avoid;margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #e5e7eb;">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <span style="font-weight:700;font-size:16px;color:#1f2937;font-family:sans-serif;">Задание ${i + 1}</span>
          <span style="font-size:11px;background:#ede9fe;color:#7c3aed;padding:2px 10px;border-radius:99px;font-family:sans-serif;">${task.class || ""}</span>
          <span style="font-size:11px;color:#6b7280;font-family:sans-serif;">${task.topic || ""}</span>
          ${task.source ? `<span style="font-size:11px;color:#9ca3af;font-family:sans-serif;">${task.source}</span>` : ""}
        </div>
        <div style="font-size:14px;line-height:1.8;">${condHtml}</div>
        ${task.image_path ? `<img src="${IMG_BASE}${task.image_path}" style="max-width:100%;margin:10px 0;border-radius:6px;" />` : ""}
        ${withSolutions && (task.answer || task.solution) ? `
          <div style="margin-top:14px;padding:14px 18px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:0 8px 8px 0;">
            <div style="font-size:10px;font-weight:700;color:#16a34a;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;font-family:sans-serif;">Ответ / Решение</div>
            <div style="font-size:13px;line-height:1.7;">${solHtml}</div>
            ${task.image_path_answer ? `<img src="${IMG_BASE}${task.image_path_answer}" style="max-width:100%;margin:8px 0;border-radius:6px;" />` : ""}
          </div>
        ` : ""}
        ${!withSolutions ? `
          <div style="margin-top:14px;padding:10px 14px;border:1px dashed #d1d5db;border-radius:8px;min-height:44px;display:flex;align-items:center;">
            <span style="font-size:12px;color:#9ca3af;font-family:sans-serif;">Ответ: ___________________________________________</span>
          </div>
        ` : ""}
      </div>`;
  }).join("");

  const dateStr = new Date().toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" });
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<title>${variant.name}${withSolutions ? " — с решениями" : ""}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,serif;background:#fff;color:#111827;padding:48px;max-width:820px;margin:0 auto}
.katex-display{margin:10px 0;overflow-x:auto}
.toolbar{display:flex;gap:10px;align-items:center;margin-bottom:28px;padding:14px 18px;background:#f9fafb;border-radius:12px;flex-wrap:wrap}
.btn{border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;font-family:sans-serif}
.btn-primary{background:#4f46e5;color:#fff}
.btn-outline{background:transparent;color:#6b7280;border:1px solid #d1d5db}
.hint{font-size:12px;color:#9ca3af;font-family:sans-serif}
.header{margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
.header h1{font-size:24px;font-weight:700;color:#111827;margin-bottom:6px}
.header-meta{display:flex;gap:18px;font-size:12px;color:#6b7280;flex-wrap:wrap;margin-top:8px;font-family:sans-serif}
.badge-sol{color:#16a34a;font-weight:700}
@media print{.toolbar{display:none!important}.katex-display{overflow-x:visible}}
</style></head><body>
<div class="toolbar">
  <button class="btn btn-primary" onclick="window.print()">🖨️ Скачать PDF / Печать</button>
  <button class="btn btn-outline" onclick="window.close()">Закрыть</button>
  <span class="hint">В диалоге печати выберите «Сохранить как PDF»</span>
</div>
<div class="header">
  <h1>${variant.name}</h1>
  <div class="header-meta">
    <span>${tasks.length} задан${tasks.length === 1 ? "ие" : tasks.length < 5 ? "ия" : "ий"}</span>
    ${withSolutions ? `<span class="badge-sol">✓ С решениями</span>` : `<span>Без решений — вариант для ученика</span>`}
    <span>${dateStr}</span>
  </div>
</div>
${tasksHtml}
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Разрешите всплывающие окна для этого сайта"); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}

function VariantPreviewDialog({ variant, open, onClose, onSendHw, students }: {
  variant: Variant | null; open: boolean; onClose: () => void;
  onSendHw: () => void; students: Student[];
}) {
  const ids = variant?.taskIds || [];
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks/by-ids", ids.join(",")],
    queryFn: () => fetch(`/api/tasks/by-ids?ids=${ids.join(",")}`).then(r => r.json()),
    enabled: open && ids.length > 0,
    staleTime: 30000,
  });

  if (!variant) return null;
  const taskIds = variant.taskIds || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border/40 shrink-0">
          <div>
            <DialogTitle className="flex items-center gap-2 text-base">
              <BookOpenCheck className="h-4 w-4 text-primary" />
              {variant.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {taskIds.length} задан{taskIds.length === 1 ? "ие" : taskIds.length < 5 ? "ия" : "ий"}
              {" · "}
              {new Date(variant.createdAt).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap justify-end">
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => openPrintWindow(variant, tasks, false)}
              disabled={isLoading || tasks.length === 0}
              data-testid="button-pdf-no-solutions"
            >
              <Download className="h-3.5 w-3.5" />
              PDF для ученика
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => openPrintWindow(variant, tasks, true)}
              disabled={isLoading || tasks.length === 0}
              data-testid="button-pdf-with-solutions"
            >
              <Printer className="h-3.5 w-3.5" />
              PDF с решениями
            </Button>
            <Button
              size="sm"
              className="text-xs gap-1.5"
              onClick={onSendHw}
              data-testid="button-send-hw-from-preview"
            >
              <Send className="h-3.5 w-3.5" />
              Отправить как ДЗ
            </Button>
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Нет заданий</p>
          ) : (
            tasks.map((task, i) => (
              <PreviewTaskCard key={task.id} task={task} index={i + 1} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewTaskCard({ task, index }: { task: Task; index: number }) {
  const [showSol, setShowSol] = useState(false);
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b border-border/30">
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{index}</span>
        </div>
        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 border", CLASS_COLOR[task.class] || "bg-muted text-muted-foreground border-transparent")}>
          {task.class}
        </Badge>
        <span className="text-xs text-muted-foreground flex-1 truncate">{task.topic}</span>
        {task.source && <span className="text-[10px] text-muted-foreground/60 shrink-0 truncate max-w-[120px]">{task.source}</span>}
      </div>
      <div className="p-4">
        <LatexBlock text={task.condition} className="text-sm" />
        {task.image_path && (
          <img src={IMG_BASE + task.image_path} alt="Условие" className="mt-3 rounded-lg max-w-full border border-border/20" loading="lazy" />
        )}
        {!showSol ? (
          <Button variant="ghost" size="sm" className="mt-3 h-7 text-xs text-muted-foreground gap-1.5" onClick={() => setShowSol(true)}>
            <Eye className="h-3.5 w-3.5" />Показать ответ
          </Button>
        ) : (
          <div className="mt-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Ответ / Решение</p>
            <LatexBlock text={task.answer || task.solution || "Решение не указано"} className="text-sm" />
            {task.image_path_answer && (
              <img src={IMG_BASE + task.image_path_answer} alt="Ответ" className="mt-2 rounded-lg max-w-full" loading="lazy" />
            )}
            <Button variant="ghost" size="sm" className="mt-2 h-6 text-xs text-muted-foreground" onClick={() => setShowSol(false)}>
              Скрыть
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TasksPage() {
  useDocumentTitle("Задачи");
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"bank" | "variants">("bank");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topicClassFilter, setTopicClassFilter] = useState<string>("");
  const [topicPage, setTopicPage] = useState(0);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);

  const [activeSubject, setActiveSubject] = useState<string>("");
  const [activeExamType, setActiveExamType] = useState<string>("");

  const [variantName, setVariantName] = useState("Вариант 1");
  const [variantTaskIds, setVariantTaskIds] = useState<string[]>([]);
  const [variantTasksCache, setVariantTasksCache] = useState<Record<string, Task>>({});
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [showSendHw, setShowSendHw] = useState(false);
  const [sendHwVariant, setSendHwVariant] = useState<Variant | null>(null);
  const [previewVariant, setPreviewVariant] = useState<Variant | null>(null);
  const [loadingRandomTopic, setLoadingRandomTopic] = useState<string | null>(null);

  const [builderGroups, setBuilderGroups] = useState<BuilderGroup[]>([
    { id: uid(), topic: "", cls: "", difficulty: "", count: 3 },
  ]);
  const [showQuickBuilder, setShowQuickBuilder] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);

  const LIMIT = 12;

  const { data: meta } = useQuery<{ subjects: string[]; classes: string[]; topics: string[]; difficulties: string[] }>({
    queryKey: ["/api/tasks/meta"],
    queryFn: () => fetch("/api/tasks/meta").then(r => r.json()),
    staleTime: 60000,
  });

  const tasksQueryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (selectedTopic) p.set("topic", selectedTopic);
    const effectiveClass = topicClassFilter || activeExamType;
    if (effectiveClass) p.set("class", effectiveClass);
    if (activeSubject) p.set("subject", activeSubject);
    if (isSearchMode && globalSearch) p.set("search", globalSearch);
    p.set("page", String(topicPage));
    p.set("limit", String(LIMIT));
    return p.toString();
  }, [selectedTopic, topicClassFilter, activeExamType, activeSubject, topicPage, globalSearch, isSearchMode]);

  const { data: tasksData, isLoading: tasksLoading } = useQuery<{ tasks: Task[]; total: number }>({
    queryKey: ["/api/tasks", tasksQueryParams],
    queryFn: () => fetch(`/api/tasks?${tasksQueryParams}`).then(r => r.json()),
    enabled: !!(selectedTopic || isSearchMode),
  });

  const { data: variants = [], isLoading: variantsLoading } = useQuery<Variant[]>({
    queryKey: ["/api/variants"],
    queryFn: () => fetch("/api/variants", { credentials: "include" }).then(r => r.json()),
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    queryFn: () => fetch("/api/students", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/variants", { name: variantName, taskIds: variantTaskIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      toast({ title: "Вариант сохранён" });
      setVariantTaskIds([]);
      setVariantName("Вариант 1");
      setVariantTasksCache({});
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, taskIds }: { id: string; name: string; taskIds: string[] }) =>
      apiRequest("PATCH", `/api/variants/${id}`, { name, taskIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      toast({ title: "Вариант обновлён" });
      setVariantTaskIds([]);
      setVariantName("Вариант 1");
      setVariantTasksCache({});
      setEditingVariantId(null);
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/variants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      toast({ title: "Вариант удалён" });
    },
  });

  const addTaskToVariant = useCallback((task: Task) => {
    if (variantTaskIds.includes(task.id)) {
      toast({ title: "Уже в варианте" });
      return;
    }
    setVariantTaskIds(prev => [...prev, task.id]);
    setVariantTasksCache(prev => ({ ...prev, [task.id]: task }));
  }, [variantTaskIds]);

  const removeTask = useCallback((taskId: string) => {
    setVariantTaskIds(prev => prev.filter(id => id !== taskId));
  }, []);

  const saveVariant = () => {
    if (variantTaskIds.length === 0) { toast({ title: "Добавьте хотя бы одно задание" }); return; }
    if (editingVariantId) {
      updateMutation.mutate({ id: editingVariantId, name: variantName, taskIds: variantTaskIds });
    } else {
      createMutation.mutate();
    }
  };

  const fetchRandom = async (topic: string, cls?: string) => {
    setLoadingRandomTopic(topic);
    try {
      const params = new URLSearchParams({ topic });
      const effectiveCls = cls || topicClassFilter || activeExamType;
      if (effectiveCls) params.set("class", effectiveCls);
      if (activeSubject) params.set("subject", activeSubject);
      const res = await fetch(`/api/tasks/random?${params}`);
      if (!res.ok) throw new Error("Не найдено");
      const task: Task = await res.json();
      addTaskToVariant(task);
      toast({ title: `Добавлено: ${task.topic}`, description: task.class });
    } catch {
      toast({ title: "Не удалось добавить случайное задание", variant: "destructive" });
    } finally {
      setLoadingRandomTopic(null);
    }
  };

  const buildVariant = async () => {
    const validGroups = builderGroups.filter(g => g.topic);
    if (validGroups.length === 0) {
      toast({ title: "Выберите хотя бы одну тему", variant: "destructive" });
      return;
    }
    setIsBuilding(true);
    try {
      const res = await fetch("/api/tasks/build-variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groups: validGroups.map(g => ({
            topic: g.topic,
            class: g.cls || activeExamType || undefined,
            difficulty: g.difficulty || undefined,
            count: g.count,
          })),
          excludeIds: variantTaskIds,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const tasks: Task[] = await res.json();
      if (tasks.length === 0) {
        toast({ title: "Нет подходящих заданий по выбранным фильтрам", variant: "destructive" });
        return;
      }
      const newIds = tasks.map(t => t.id).filter(id => !variantTaskIds.includes(id));
      const newCache = Object.fromEntries(tasks.map(t => [t.id, t]));
      setVariantTaskIds(prev => [...prev, ...newIds]);
      setVariantTasksCache(prev => ({ ...prev, ...newCache }));
      const total = validGroups.reduce((s, g) => s + g.count, 0);
      const skipped = total - tasks.length;
      toast({
        title: `Добавлено ${tasks.length} задани${tasks.length === 1 ? "е" : tasks.length < 5 ? "я" : "й"}`,
        description: skipped > 0 ? `${skipped} не найдено (возможно дубли или нет в базе)` : undefined,
      });
    } catch (e: any) {
      toast({ title: "Ошибка при составлении варианта", description: e.message, variant: "destructive" });
    } finally {
      setIsBuilding(false);
    }
  };

  const addBuilderGroup = () => {
    setBuilderGroups(prev => [...prev, { id: uid(), topic: "", cls: "", difficulty: "", count: 3 }]);
  };

  const removeBuilderGroup = (id: string) => {
    setBuilderGroups(prev => prev.length > 1 ? prev.filter(g => g.id !== id) : prev);
  };

  const updateBuilderGroup = (id: string, patch: Partial<BuilderGroup>) => {
    setBuilderGroups(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  };

  const openSendHw = (v: Variant) => {
    setSendHwVariant(v);
    setShowSendHw(true);
  };

  const loadVariantForEdit = (v: Variant) => {
    setEditingVariantId(v.id);
    setVariantName(v.name);
    setVariantTaskIds(v.taskIds || []);
    setActiveTab("bank");
    setSelectedTopic(null);
    toast({ title: "Вариант загружен для редактирования", description: "Внесите изменения и сохраните" });
  };

  const tasks = tasksData?.tasks || [];
  const totalTasks = tasksData?.total || 0;
  const totalPages = Math.ceil(totalTasks / LIMIT);

  const currentSendVariant = sendHwVariant
    ? (variants.find(v => v.id === sendHwVariant.id) || sendHwVariant)
    : null;

  return (
    <DashboardLayout title="База заданий" subtitle="Задачник — составляйте варианты и отправляйте ученикам">
      <PageTabs
        tabs={[
          { label: "Чат с ИИ", path: "/ai" },
          { label: "Задачник", path: "/tasks" },
        ]}
      />
      <PageHero
        icon={<BookMarked className="h-6 w-6 text-white" />}
        gradient="from-indigo-600/80 via-violet-600/70 to-purple-600/60"
        title="База заданий"
        subtitle="Готовые задания по темам — выбирайте, составляйте варианты и отправляйте ученикам в домашнее задание. Вкладка «Мои варианты» хранит все составленные комплекты."
        badge="Задачник"
        className="mb-5"
      />
      {/* Tabs */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("bank")}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5",
              activeTab === "bank" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            data-testid="tab-task-bank"
          >
            <BookMarked className="h-4 w-4" />Задачник
          </button>
          <button
            onClick={() => setActiveTab("variants")}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5",
              activeTab === "variants" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            data-testid="tab-my-variants"
          >
            <Clipboard className="h-4 w-4" />Мои варианты
            {variants.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 border-transparent bg-primary/10 text-primary">{variants.length}</Badge>
            )}
          </button>
        </div>
      </div>

      {activeTab === "bank" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* LEFT: Topic grid / task list */}
          <div className="min-w-0">
            {/* ── Subject + Exam Type filters ── */}
            <div className="mb-4 rounded-xl border border-border/40 bg-card/60 px-4 py-3 space-y-2.5">
              {/* Предмет */}
              <div className="flex items-start gap-3 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground pt-0.5 w-16 shrink-0">Предмет</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(meta?.subjects?.length ? meta.subjects : ["Математика"]).map(s => (
                    <button
                      key={s}
                      onClick={() => setActiveSubject(prev => prev === s ? "" : s)}
                      className={cn(
                        "h-7 px-3 rounded-full text-xs font-medium border transition-all",
                        activeSubject === s
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-muted/40 border-border/50 hover:border-indigo-400 hover:text-indigo-600"
                      )}
                      data-testid={`filter-subject-${s}`}
                    >
                      {s}
                    </button>
                  ))}
                  {["Физика", "Информатика", "Химия", "Биология", "Русский язык"].map(s => (
                    <span
                      key={s}
                      className="h-7 px-2.5 rounded-full text-xs border border-dashed border-border/30 text-muted-foreground/40 flex items-center gap-1 select-none"
                    >
                      {s}
                      <span className="text-[9px] font-semibold text-amber-500/70 uppercase tracking-wide">скоро</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Тип экзамена */}
              <div className="flex items-start gap-3 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground pt-0.5 w-16 shrink-0">Тип</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => { setActiveExamType(""); setTopicClassFilter(""); }}
                    className={cn(
                      "h-7 px-3 rounded-full text-xs font-medium border transition-all",
                      !activeExamType
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-muted/40 border-border/50 hover:border-indigo-400 hover:text-indigo-600"
                    )}
                    data-testid="filter-exam-type-all"
                  >
                    Все
                  </button>
                  {(meta?.classes || []).map(c => (
                    <button
                      key={c}
                      onClick={() => {
                        const next = activeExamType === c ? "" : c;
                        setActiveExamType(next);
                        setTopicClassFilter(next);
                        setTopicPage(0);
                      }}
                      className={cn(
                        "h-7 px-3 rounded-full text-xs font-medium border transition-all",
                        activeExamType === c
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-muted/40 border-border/50 hover:border-indigo-400 hover:text-indigo-600"
                      )}
                      data-testid={`filter-exam-type-${c}`}
                    >
                      {c}
                    </button>
                  ))}
                  {["ВПР", "МЦКО"].map(t => (
                    <span
                      key={t}
                      className="h-7 px-2.5 rounded-full text-xs border border-dashed border-border/30 text-muted-foreground/40 flex items-center gap-1 select-none"
                    >
                      {t}
                      <span className="text-[9px] font-semibold text-amber-500/70 uppercase tracking-wide">скоро</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Search bar (always visible) */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9 text-sm bg-muted/30 border-border/40"
                placeholder="Поиск по тексту задания..."
                value={globalSearch}
                onChange={e => {
                  setGlobalSearch(e.target.value);
                  if (e.target.value) { setIsSearchMode(true); setSelectedTopic(null); setTopicPage(0); }
                  else { setIsSearchMode(false); }
                }}
                data-testid="input-task-search"
              />
              {globalSearch && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => { setGlobalSearch(""); setIsSearchMode(false); }}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search results */}
            {isSearchMode && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {tasksLoading ? "Поиск..." : `Найдено: ${totalTasks} задан${totalTasks === 1 ? "ие" : totalTasks < 5 ? "ия" : "ий"}`}
                </p>
                {tasksLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : tasks.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">Ничего не найдено</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {tasks.map(t => (
                        <BankTaskCard
                          key={t.id}
                          task={t}
                          inVariant={variantTaskIds.includes(t.id)}
                          onAdd={() => addTaskToVariant(t)}
                          onView={() => setDetailTask(t)}
                        />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={topicPage === 0} onClick={() => setTopicPage(p => p - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">{topicPage + 1} / {totalPages}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={topicPage >= totalPages - 1} onClick={() => setTopicPage(p => p + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Topic browser - grid or list */}
            {!isSearchMode && !selectedTopic && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  <GraduationCap className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                  Выберите номер задания — откройте задачи или добавьте случайное в вариант
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {(meta?.topics || []).map(topic => (
                    <TopicCard
                      key={topic}
                      topic={topic}
                      classes={meta?.classes || []}
                      onBrowse={(cls) => {
                        setSelectedTopic(topic);
                        setTopicClassFilter(cls || "");
                        setTopicPage(0);
                      }}
                      onRandom={() => fetchRandom(topic)}
                      isLoadingRandom={loadingRandomTopic === topic}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Task list for selected topic */}
            {!isSearchMode && selectedTopic && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground h-8"
                    onClick={() => { setSelectedTopic(null); setTopicClassFilter(""); setTopicPage(0); }}
                    data-testid="button-back-to-topics"
                  >
                    <ArrowLeft className="h-4 w-4" />Все темы
                  </Button>
                  <div className="h-4 w-px bg-border" />
                  <h3 className="font-semibold text-sm">{selectedTopic}</h3>
                  {totalTasks > 0 && !tasksLoading && (
                    <Badge variant="secondary" className="text-xs">{totalTasks}</Badge>
                  )}
                </div>

                {/* Class filter tabs */}
                <div className="flex gap-1 mb-4 bg-muted/30 p-1 rounded-xl w-fit">
                  {["", ...(meta?.classes || [])].map(cls => (
                    <button
                      key={cls || "all"}
                      onClick={() => { setTopicClassFilter(cls); setTopicPage(0); }}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                        topicClassFilter === cls ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                      data-testid={`tab-class-${cls || "all"}`}
                    >
                      {cls || "Все"}
                    </button>
                  ))}
                </div>

                {/* Random button */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => fetchRandom(selectedTopic, topicClassFilter || undefined)}
                    disabled={loadingRandomTopic === selectedTopic}
                    data-testid="button-random-from-topic"
                  >
                    {loadingRandomTopic === selectedTopic
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Shuffle className="h-3.5 w-3.5" />}
                    Случайное в вариант
                  </Button>
                </div>

                {tasksLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : tasks.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">Нет заданий по выбранному фильтру</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {tasks.map(t => (
                        <BankTaskCard
                          key={t.id}
                          task={t}
                          inVariant={variantTaskIds.includes(t.id)}
                          onAdd={() => addTaskToVariant(t)}
                          onView={() => setDetailTask(t)}
                        />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-3 mt-4">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={topicPage === 0} onClick={() => setTopicPage(p => p - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">{topicPage + 1} из {totalPages}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={topicPage >= totalPages - 1} onClick={() => setTopicPage(p => p + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Variant builder panel */}
          <div className="lg:sticky lg:top-4 lg:self-start space-y-3">
            <div className="rounded-2xl border border-border/40 bg-card/70 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clipboard className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{editingVariantId ? "Редактирование" : "Новый вариант"}</span>
                </div>
                {variantTaskIds.length > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setVariantTaskIds([]); setVariantTasksCache({}); setEditingVariantId(null); setVariantName("Вариант 1"); }}
                    data-testid="button-clear-variant"
                  >
                    Очистить
                  </button>
                )}
              </div>

              <Input
                value={variantName}
                onChange={e => setVariantName(e.target.value)}
                className="h-8 text-sm mb-3 bg-muted/30"
                placeholder="Название варианта"
                data-testid="input-variant-name"
              />

              {/* ── Quick Builder ── */}
              <div className="rounded-xl border border-indigo-200/40 dark:border-indigo-800/30 bg-indigo-500/5 mb-3">
                <button
                  className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400"
                  onClick={() => setShowQuickBuilder(v => !v)}
                  data-testid="button-toggle-quick-builder"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Быстрый набор
                  </span>
                  {showQuickBuilder ? <ChevronUp className="h-3.5 w-3.5 opacity-60" /> : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
                </button>

                {showQuickBuilder && (
                  <div className="px-3 pb-3 space-y-2">
                    {/* Group rows */}
                    {builderGroups.map((g, i) => (
                      <div key={g.id} className="rounded-lg bg-card/80 border border-border/30 p-2 space-y-1.5">
                        {/* Row 1: remove + label */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Группа {i + 1}</span>
                          {builderGroups.length > 1 && (
                            <button
                              onClick={() => removeBuilderGroup(g.id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors"
                              data-testid={`button-remove-group-${g.id}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Row 2: topic + count */}
                        <div className="flex gap-1.5">
                          <div className="flex-1 min-w-0">
                            <select
                              className="w-full h-7 rounded-lg border border-border/40 bg-muted/40 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                              value={g.topic}
                              onChange={e => updateBuilderGroup(g.id, { topic: e.target.value })}
                              data-testid={`select-group-topic-${g.id}`}
                            >
                              <option value="">— Тема / №задания</option>
                              {(meta?.topics || []).map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground">×</span>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={g.count}
                              onChange={e => updateBuilderGroup(g.id, { count: Math.max(1, Math.min(30, parseInt(e.target.value) || 1)) })}
                              className="w-12 h-7 rounded-lg border border-border/40 bg-muted/40 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                              data-testid={`input-group-count-${g.id}`}
                            />
                          </div>
                        </div>

                        {/* Row 3: class + difficulty filters */}
                        <div className="flex gap-1.5">
                          <select
                            className="flex-1 h-6 rounded-md border border-border/30 bg-muted/30 text-[10px] px-1.5 focus:outline-none"
                            value={g.cls}
                            onChange={e => updateBuilderGroup(g.id, { cls: e.target.value })}
                            data-testid={`select-group-class-${g.id}`}
                          >
                            <option value="">Все классы</option>
                            {(meta?.classes || []).map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <select
                            className="flex-1 h-6 rounded-md border border-border/30 bg-muted/30 text-[10px] px-1.5 focus:outline-none"
                            value={g.difficulty}
                            onChange={e => updateBuilderGroup(g.id, { difficulty: e.target.value })}
                            data-testid={`select-group-difficulty-${g.id}`}
                          >
                            <option value="">Любая сложность</option>
                            {(meta?.difficulties || []).map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}

                    {/* Add group */}
                    <button
                      onClick={addBuilderGroup}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-indigo-600 transition-colors"
                      data-testid="button-add-builder-group"
                    >
                      <Plus className="h-3 w-3" />
                      Добавить группу
                    </button>

                    {/* Build button */}
                    <button
                      onClick={buildVariant}
                      disabled={isBuilding || builderGroups.every(g => !g.topic)}
                      className={cn(
                        "w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold transition-all",
                        "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                      data-testid="button-build-variant"
                    >
                      {isBuilding
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Составляем...</>
                        : <><Wand2 className="h-3.5 w-3.5" />Составить вариант</>
                      }
                    </button>

                    <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                      Задания добавятся в список ниже. Можно применить несколько раз.
                    </p>
                  </div>
                )}
              </div>

              {variantTaskIds.length === 0 ? (
                <div className="rounded-xl bg-muted/20 border border-dashed border-border/40 p-4 text-center">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Составьте вариант выше<br/>или добавляйте задания вручную</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 mb-3">
                  {variantTaskIds.map((id, i) => {
                    const t = variantTasksCache[id];
                    return (
                      <div key={id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs">
                        <span className="font-mono text-primary/60 w-4 shrink-0">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{t?.topic || "Задание"}</p>
                          {t && <p className="text-muted-foreground text-[10px]">{t.class}</p>}
                        </div>
                        <button
                          className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                          onClick={() => removeTask(id)}
                          data-testid={`button-remove-task-${id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {variantTaskIds.length > 0 && (
                <div className="text-xs text-muted-foreground text-center mb-3">
                  {variantTaskIds.length} задан{variantTaskIds.length === 1 ? "ие" : variantTaskIds.length < 5 ? "ия" : "ий"} в варианте
                </div>
              )}

              <Button
                className="w-full mb-2"
                size="sm"
                disabled={variantTaskIds.length === 0 || createMutation.isPending || updateMutation.isPending}
                onClick={saveVariant}
                data-testid="button-save-variant"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {editingVariantId ? "Обновить вариант" : "Сохранить вариант"}
              </Button>

              {editingVariantId && (
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      const saved = variants.find(v => v.id === editingVariantId);
                      if (saved) setPreviewVariant(saved);
                    }}
                    data-testid="button-open-from-builder"
                  >
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />Открыть
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs text-muted-foreground"
                    onClick={() => {
                      const saved = variants.find(v => v.id === editingVariantId);
                      if (saved) openSendHw(saved);
                    }}
                    data-testid="button-send-hw-from-builder"
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />Как ДЗ
                  </Button>
                </div>
              )}
            </div>

            {/* Quick stats */}
            {meta && (
              <div className="rounded-xl border border-border/30 bg-muted/20 p-3 text-center">
                <p className="text-lg font-bold text-foreground">980</p>
                <p className="text-xs text-muted-foreground">задач в базе · {meta.topics.length} тем</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Мои варианты */}
      {activeTab === "variants" && (
        <div className="space-y-3">
          {variantsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clipboard className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Вариантов пока нет</p>
              <p className="text-xs mt-1">Соберите вариант на вкладке «Задачник»</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab("bank")} data-testid="button-go-to-bank">
                Перейти к задачнику
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {variants.map(v => (
                <div key={v.id} className="rounded-2xl border border-border/40 bg-card/60 p-4 flex flex-col gap-3 hover:border-border/70 transition-all" data-testid={`card-variant-${v.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">{v.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(v.taskIds || []).length} задан{(v.taskIds || []).length === 1 ? "ие" : (v.taskIds || []).length < 5 ? "ия" : "ий"}
                        {" · "}
                        {new Date(v.createdAt).toLocaleDateString("ru", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => loadVariantForEdit(v)} title="Редактировать" data-testid={`button-edit-variant-${v.id}`}>
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => { if (confirm("Удалить вариант?")) deleteMutation.mutate(v.id); }}
                        title="Удалить" data-testid={`button-delete-variant-${v.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {(v.taskIds || []).slice(0, 4).map((id, i) => {
                      const cached = variantTasksCache[id];
                      return (
                        <div key={id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono text-primary/50 w-4">{i + 1}.</span>
                          <span className="truncate">{cached?.topic || `Задание ${i + 1}`}</span>
                        </div>
                      );
                    })}
                    {(v.taskIds || []).length > 4 && (
                      <p className="text-xs text-muted-foreground pl-6">+ ещё {(v.taskIds || []).length - 4}</p>
                    )}
                  </div>

                  <div className="flex gap-1.5 mt-auto flex-wrap">
                    <Button
                      size="sm"
                      className="flex-1 text-xs min-w-[90px]"
                      onClick={() => setPreviewVariant(v)}
                      data-testid={`button-open-variant-${v.id}`}
                    >
                      <FolderOpen className="h-3.5 w-3.5 mr-1.5" />Открыть
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs px-3"
                      onClick={() => loadVariantForEdit(v)}
                      title="Редактировать"
                      data-testid={`button-edit-variant-main-${v.id}`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs px-3"
                      onClick={() => openSendHw(v)}
                      title="Отправить как ДЗ"
                      data-testid={`button-send-hw-variant-${v.id}`}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <TaskDetailDialog
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        onAdd={detailTask ? () => { addTaskToVariant(detailTask); setDetailTask(null); } : undefined}
        inVariant={detailTask ? variantTaskIds.includes(detailTask.id) : false}
      />

      <VariantPreviewDialog
        variant={previewVariant}
        open={!!previewVariant}
        onClose={() => setPreviewVariant(null)}
        onSendHw={() => { if (previewVariant) { setPreviewVariant(null); openSendHw(previewVariant); } }}
        students={students}
      />

      <SendHomeworkDialog
        open={showSendHw}
        onClose={() => { setShowSendHw(false); setSendHwVariant(null); }}
        variant={currentSendVariant}
        variantTaskIds={currentSendVariant?.taskIds || []}
        students={students}
      />
    </DashboardLayout>
  );
}
