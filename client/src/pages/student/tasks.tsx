import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search, BookOpen, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2,
  Clipboard, CheckCircle2, Clock, X, ListTodo, FlaskConical, Shuffle,
  ChevronDown, Plus, Sparkles, Trash2, Play, ArrowLeft, Info,
  Wand2, Layers, Minus,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import katex from "katex";
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

function stripLatex(text: string) {
  return text.replace(/\\\[[\s\S]+?\\\]/g, "[формула]").replace(/\\\([\s\S]+?\\\)/g, "[формула]").replace(/\n+/g, " ").trim();
}

function LatexBlock({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderLatex(text || "").replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>"), [text]);
  return <div className={cn("leading-relaxed [&_.katex]:text-sm", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

type Task = {
  id: string; subject: string; class: string; topic: string; difficulty: string;
  source: string; condition: string; solution: string | null; answer: string | null;
  image_path: string | null; image_path_answer: string | null;
};
type Assignment = { id: string; variantId: string; status: string; assignedAt: string; variant: { id: string; name: string; taskIds: string[]; createdAt: string } | null };
type AssignmentWithTasks = Assignment & { tasks: Task[] };

const CLASS_COLOR: Record<string, string> = {
  "ЕГЭ (п)": "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "ЕГЭ (б)": "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
};
const DIFF_COLOR: Record<string, string> = {
  "Средняя":  "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "Сложное":  "bg-red-500/10 text-red-700 dark:text-red-400",
  "Простое":  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

// ── Solve view (one task) ──────────────────────────────────────────────────
function TaskSolveView({ task, index, total }: { task: Task; index: number; total: number }) {
  const [showSolution, setShowSolution] = useState(false);
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="text-sm font-bold text-primary">Задание {index + 1} / {total}</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", CLASS_COLOR[task.class] || "bg-muted")}>{task.class}</Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted/60 text-muted-foreground">{task.topic}</Badge>
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", DIFF_COLOR[task.difficulty] || "bg-muted")}>{task.difficulty}</Badge>
        </div>
      </div>
      <div className="rounded-xl bg-muted/30 p-4 mb-4">
        <LatexBlock text={task.condition} className="text-sm" />
        {task.image_path && (
          <img src={IMG_BASE + task.image_path} alt="Условие" className="mt-3 rounded-lg max-w-full border border-border/30" loading="lazy" />
        )}
      </div>
      {!showSolution ? (
        <Button variant="outline" className="w-full" size="sm" onClick={() => setShowSolution(true)} data-testid={`button-show-solution-${task.id}`}>
          <Eye className="h-4 w-4 mr-2" />Показать решение
        </Button>
      ) : (
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4">
          <p className="text-xs font-semibold text-emerald-600 mb-2 uppercase tracking-wider">Решение / Ответ</p>
          <LatexBlock text={task.answer || task.solution || "Решение не указано"} className="text-sm" />
          {task.image_path_answer && (
            <img src={IMG_BASE + task.image_path_answer} alt="Ответ" className="mt-3 rounded-lg max-w-full border border-border/30" loading="lazy" />
          )}
          <Button variant="ghost" size="sm" className="mt-3 text-xs text-muted-foreground" onClick={() => setShowSolution(false)}>
            <EyeOff className="h-3.5 w-3.5 mr-1" />Скрыть
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Assigned variant detail dialog ─────────────────────────────────────────
function VariantDetailDialog({ assignmentId, open, onClose }: { assignmentId: string | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<AssignmentWithTasks>({
    queryKey: ["/api/student/variants", assignmentId],
    queryFn: () => fetch(`/api/student/variants/${assignmentId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!assignmentId && open,
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clipboard className="h-5 w-5 text-primary" />
            {data?.variant?.name || "Вариант"}
          </DialogTitle>
          {data && <p className="text-xs text-muted-foreground">{data.tasks?.length || 0} заданий</p>}
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !data?.tasks?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Задания не найдены</p>
        ) : (
          <div className="space-y-4 mt-2">
            {data.tasks.map((task, i) => (
              <TaskSolveView key={task.id} task={task} index={i} total={data.tasks.length} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Task detail preview dialog ─────────────────────────────────────────────
function TaskDetailDialog({ task, open, onClose, onAdd, inPractice }: {
  task: Task | null; open: boolean; onClose: () => void;
  onAdd?: () => void; inPractice?: boolean;
}) {
  const [showSolution, setShowSolution] = useState(false);
  if (!task) return null;
  return (
    <Dialog open={open} onOpenChange={() => { setShowSolution(false); onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{task.topic}</span>
            <Badge variant="outline" className={cn("text-[10px]", CLASS_COLOR[task.class] || "")}>{task.class}</Badge>
            <Badge variant="secondary" className={cn("text-[10px]", DIFF_COLOR[task.difficulty] || "")}>{task.difficulty}</Badge>
          </DialogTitle>
          {task.source && <p className="text-xs text-muted-foreground">{task.source}</p>}
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="rounded-xl bg-muted/30 p-4">
            <LatexBlock text={task.condition} className="text-sm" />
            {task.image_path && (
              <img src={IMG_BASE + task.image_path} alt="Условие" className="mt-3 rounded-lg max-w-full border border-border/30" loading="lazy" />
            )}
          </div>
          {onAdd && (
            <Button
              variant={inPractice ? "outline" : "default"}
              size="sm"
              className="w-full"
              onClick={onAdd}
              data-testid="button-add-to-practice"
            >
              {inPractice ? <><CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />В тренировке</> : <><Plus className="h-4 w-4 mr-2" />Добавить в тренировку</>}
            </Button>
          )}
          {!showSolution ? (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowSolution(true)} data-testid="button-show-solution-bank">
              <Eye className="h-4 w-4 mr-2" />Показать решение
            </Button>
          ) : (
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4">
              <p className="text-xs font-semibold text-emerald-600 mb-2">Решение / Ответ</p>
              <LatexBlock text={task.answer || task.solution || "Решение не указано"} className="text-sm" />
              {task.image_path_answer && (
                <img src={IMG_BASE + task.image_path_answer} alt="Ответ" className="mt-3 rounded-lg max-w-full border border-border/30" loading="lazy" />
              )}
              <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground" onClick={() => setShowSolution(false)}>Скрыть</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Practice solve full-screen dialog ─────────────────────────────────────
function PracticeSolveDialog({ tasks, open, onClose }: { tasks: Task[]; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-violet-600" />
            Тренировка · {tasks.length} задани{tasks.length === 1 ? "е" : tasks.length < 5 ? "я" : "й"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          {tasks.map((task, i) => (
            <TaskSolveView key={task.id} task={task} index={i} total={tasks.length} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Topic card ─────────────────────────────────────────────────────────────
function TopicCard({ topic, classes, onBrowse, onRandom, isLoadingRandom }: {
  topic: string; classes: string[];
  onBrowse: (cls?: string) => void;
  onRandom: () => void;
  isLoadingRandom: boolean;
}) {
  const num = parseInt(topic.replace(/\D/g, "")) || 0;
  return (
    <div className="rounded-2xl border border-border/40 bg-card/70 hover:border-border/70 hover:bg-card transition-all group flex flex-col">
      <div
        className="flex-1 p-4 text-left cursor-pointer select-none"
        onClick={() => onBrowse()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && onBrowse()}
        data-testid={`card-student-topic-${num}`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{num || "★"}</span>
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
              data-testid={`button-student-filter-${num}-${cls.replace(/[\s()]/g, "")}`}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-border/30 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground hover:text-violet-600 gap-1.5"
          onClick={onRandom}
          disabled={isLoadingRandom}
          data-testid={`button-student-random-${num}`}
        >
          {isLoadingRandom ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shuffle className="h-3 w-3" />}
          Добавить случайное
        </Button>
      </div>
    </div>
  );
}

// ── Task card in bank ──────────────────────────────────────────────────────
function BankTaskCard({ task, inPractice, onAdd, onView }: {
  task: Task; inPractice: boolean; onAdd: () => void; onView: () => void;
}) {
  const preview = useMemo(() => stripLatex(task.condition || "").slice(0, 180), [task.condition]);
  return (
    <div className={cn(
      "rounded-xl border transition-all p-3",
      inPractice ? "border-violet-400/40 bg-violet-500/5" : "border-border/40 bg-card/50 hover:border-border/60"
    )}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", CLASS_COLOR[task.class] || "bg-muted")}>
              {task.class}
            </Badge>
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 border-transparent", DIFF_COLOR[task.difficulty] || "bg-muted")}>
              {task.difficulty}
            </Badge>
            {task.source && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{task.source}</span>}
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{preview || "Условие не указано"}{(task.condition || "").length > 180 ? "…" : ""}</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={onView}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
            data-testid={`button-view-student-task-${task.id}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onAdd}
            className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
              inPractice
                ? "text-violet-600 bg-violet-500/10 hover:bg-violet-500/20"
                : "text-muted-foreground hover:text-violet-600 hover:bg-violet-500/5"
            )}
            data-testid={`button-add-practice-${task.id}`}
          >
            {inPractice ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detect exam type from grade ────────────────────────────────────────────
function detectExamType(grade: string, classes: string[]): string {
  const g = grade.toLowerCase();
  if (g.includes("профиль") || g.includes("(п)")) {
    const match = classes.find(c => c.includes("(п)"));
    if (match) return match;
  }
  if (g.includes("база") || g.includes("(б)")) {
    const match = classes.find(c => c.includes("(б)"));
    if (match) return match;
  }
  if (g.includes("егэ")) {
    return classes[0] || "";
  }
  return "";
}

// ── Main component ─────────────────────────────────────────────────────────
export default function StudentTasks() {
  const [activeTab, setActiveTab] = useState<"variants" | "bank">("variants");

  // Assigned variants from tutor
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/student/variants"],
    queryFn: () => fetch("/api/student/variants", { credentials: "include" }).then(r => r.json()),
  });
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null);

  // Student profile (to auto-detect exam type)
  const { data: me } = useQuery<{ grade?: string; subject?: string; name?: string }>({
    queryKey: ["/api/student/auth/me"],
    queryFn: () => fetch("/api/student/auth/me", { credentials: "include" }).then(r => r.ok ? r.json() : {}),
    staleTime: 300_000,
    retry: false,
  });

  // Task bank meta
  const { data: meta } = useQuery<{ subjects: string[]; classes: string[]; topics: string[]; difficulties: string[] }>({
    queryKey: ["/api/tasks/meta"],
    queryFn: () => fetch("/api/tasks/meta").then(r => r.json()),
    staleTime: 60000,
  });

  // ── Filter state ──────────────────────────────────────────────────────
  const [activeSubject, setActiveSubject] = useState<string>("");
  const [activeExamType, setActiveExamType] = useState<string>("");
  const [examTypeAutoSet, setExamTypeAutoSet] = useState(false);

  // Auto-detect exam type once meta + profile are loaded
  useEffect(() => {
    if (examTypeAutoSet || !meta?.classes?.length) return;
    const grade = me?.grade || "";
    const detected = detectExamType(grade, meta.classes);
    setActiveExamType(detected);
    setExamTypeAutoSet(true);
  }, [me, meta, examTypeAutoSet]);

  // ── Bank browse state ─────────────────────────────────────────────────
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topicClassFilter, setTopicClassFilter] = useState<string>("");
  const [topicPage, setTopicPage] = useState(0);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [loadingRandomTopic, setLoadingRandomTopic] = useState<string | null>(null);
  const LIMIT = 12;

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
    enabled: activeTab === "bank" && (!!selectedTopic || isSearchMode),
  });

  const tasks = tasksData?.tasks || [];
  const totalTasks = tasksData?.total || 0;
  const totalPages = Math.ceil(totalTasks / LIMIT);

  // ── Practice session (self-build variant) ─────────────────────────────
  const [practiceIds, setPracticeIds] = useState<string[]>([]);
  const [practiceCache, setPracticeCache] = useState<Record<string, Task>>({});
  const [practiceSolving, setPracticeSolving] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const practiceTasks = practiceIds.map(id => practiceCache[id]).filter(Boolean);

  const addToPractice = useCallback((task: Task) => {
    setPracticeIds(prev => prev.includes(task.id) ? prev : [...prev, task.id]);
    setPracticeCache(prev => ({ ...prev, [task.id]: task }));
  }, []);

  const removeFromPractice = useCallback((id: string) => {
    setPracticeIds(prev => prev.filter(x => x !== id));
  }, []);

  const fetchRandom = async (topic: string) => {
    setLoadingRandomTopic(topic);
    try {
      const params = new URLSearchParams({ topic });
      const effectiveCls = topicClassFilter || activeExamType;
      if (effectiveCls) params.set("class", effectiveCls);
      if (activeSubject) params.set("subject", activeSubject);
      const excludeIds = practiceIds;
      if (excludeIds.length) params.set("excludeIds", excludeIds.join(","));
      const res = await fetch(`/api/tasks/random?${params}`);
      if (!res.ok) throw new Error("Не найдено");
      const task: Task = await res.json();
      addToPractice(task);
    } catch {
      // silent
    } finally {
      setLoadingRandomTopic(null);
    }
  };

  // ── Topic grid: determine which classes to show per topic ─────────────
  const topicClassMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cls of (meta?.classes || [])) {
      for (const topic of (meta?.topics || [])) {
        if (!map[topic]) map[topic] = [];
        map[topic].push(cls);
      }
    }
    return map;
  }, [meta]);

  const visibleTopics = useMemo(() => {
    return (meta?.topics || []);
  }, [meta]);

  const autoExamTypeNote = useMemo(() => {
    if (!examTypeAutoSet || !activeExamType) return null;
    if (!me?.grade) return null;
    const grade = me.grade.toLowerCase();
    if (grade.includes("егэ") || grade.includes("профиль") || grade.includes("база")) {
      return `Автоматически выбрано по вашему классу (${me.grade})`;
    }
    return null;
  }, [examTypeAutoSet, activeExamType, me]);

  // ── Quick Builder (Быстрый набор) ─────────────────────────────────────
  type BuilderGroup = { id: string; topic: string; cls: string; difficulty: string; count: number };
  const [panelTab, setPanelTab] = useState<"practice" | "builder">("practice");
  const [builderGroups, setBuilderGroups] = useState<BuilderGroup[]>([
    { id: "g0", topic: "", cls: activeExamType, difficulty: "", count: 3 },
  ]);

  const addBuilderGroup = useCallback(() => {
    setBuilderGroups(prev => [...prev, { id: Date.now().toString(), topic: "", cls: activeExamType, difficulty: "", count: 3 }]);
  }, [activeExamType]);

  const removeBuilderGroup = useCallback((id: string) => {
    setBuilderGroups(prev => prev.filter(g => g.id !== id));
  }, []);

  const updateBuilderGroup = useCallback((id: string, field: keyof BuilderGroup, value: string | number) => {
    setBuilderGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  }, []);

  const buildVariantMutation = useMutation({
    mutationFn: async (groups: BuilderGroup[]) => {
      const valid = groups.filter(g => g.topic);
      if (!valid.length) throw new Error("Выберите хотя бы одну тему");
      const payload = {
        groups: valid.map(g => ({
          topic: g.topic,
          ...(g.cls && g.cls !== "_any" ? { class: g.cls } : {}),
          ...(g.difficulty && g.difficulty !== "_any" ? { difficulty: g.difficulty } : {}),
          count: g.count,
        })),
        excludeIds: practiceIds,
      };
      const res = await fetch("/api/tasks/build-variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Ошибка построения варианта");
      return res.json() as Promise<Task[]>;
    },
    onSuccess: (tasks) => {
      tasks.forEach(t => addToPractice(t));
      setPanelTab("practice");
    },
  });

  return (
    <div className="space-y-4">
      <PageHero
        icon={<FlaskConical className="h-6 w-6 text-white" />}
        title="Задачник"
        subtitle="Варианты от репетитора и личная тренировка"
        gradient="from-violet-500 via-purple-500 to-indigo-500"
        badge="База заданий"
        stats={[
          { label: "Вариантов", value: assignments.length },
          { label: "В тренировке", value: practiceIds.length },
        ]}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("variants")}
          className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5",
            activeTab === "variants" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          data-testid="tab-student-variants"
        >
          <Clipboard className="h-4 w-4" />
          Варианты от репетитора
          {assignments.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">{assignments.length}</Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("bank")}
          className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5",
            activeTab === "bank" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          data-testid="tab-student-bank"
        >
          <BookOpen className="h-4 w-4" />
          Задачник
          {practiceIds.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-violet-500/15 text-violet-600 border-0">{practiceIds.length}</Badge>
          )}
        </button>
      </div>

      {/* ── TAB: Варианты от репетитора ── */}
      {activeTab === "variants" && (
        <div>
          {assignmentsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ListTodo className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Вариантов пока нет</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">Репетитор назначит варианты для решения. А пока — можешь самостоятельно потренироваться в задачнике.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab("bank")} data-testid="button-go-bank">
                <BookOpen className="h-4 w-4 mr-2" />Открыть задачник
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assignments.map(a => (
                <div key={a.id} className="rounded-2xl border border-border/40 bg-card/60 p-4 flex flex-col gap-3 hover:border-border/70 transition-all overflow-hidden relative">
                  <div className="pointer-events-none absolute right-3 top-3 opacity-[0.06]">
                    <Clipboard className="h-10 w-10 text-primary" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm">{a.variant?.name || "Вариант"}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.variant?.taskIds?.length || 0} задани{(a.variant?.taskIds?.length || 0) === 1 ? "е" : "й"}
                        {" · "}
                        {new Date(a.assignedAt).toLocaleDateString("ru", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <Badge variant="secondary" className={cn("text-[10px] px-2 py-0.5 border-0 shrink-0",
                      a.status === "completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    )}>
                      {a.status === "completed"
                        ? <><CheckCircle2 className="h-3 w-3 inline mr-0.5" />Решён</>
                        : <><Clock className="h-3 w-3 inline mr-0.5" />Ожидает</>}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => setOpenAssignmentId(a.id)}
                    data-testid={`button-open-variant-${a.id}`}
                  >
                    <Play className="h-4 w-4 mr-2" />Решать вариант
                  </Button>
                </div>
              ))}
            </div>
          )}
          <VariantDetailDialog
            assignmentId={openAssignmentId}
            open={!!openAssignmentId}
            onClose={() => setOpenAssignmentId(null)}
          />
        </div>
      )}

      {/* ── TAB: Задачник ── */}
      {activeTab === "bank" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          {/* LEFT: Bank browser */}
          <div className="min-w-0 space-y-4">
            {/* Subject + Exam type filters */}
            <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3 space-y-2.5">
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
                          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                          : "bg-muted/40 border-border/50 hover:border-violet-400 hover:text-violet-600"
                      )}
                      data-testid={`filter-student-subject-${s}`}
                    >
                      {s}
                    </button>
                  ))}
                  {["Физика", "Информатика", "Химия", "Биология", "Русский язык"].map(s => (
                    <span key={s} className="h-7 px-2.5 rounded-full text-xs border border-dashed border-border/30 text-muted-foreground/40 flex items-center gap-1 select-none">
                      {s}
                      <span className="text-[9px] font-semibold text-amber-500/70 uppercase tracking-wide">скоро</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Тип */}
              <div className="flex items-start gap-3 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground pt-0.5 w-16 shrink-0">Тип</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => { setActiveExamType(""); setTopicClassFilter(""); }}
                    className={cn(
                      "h-7 px-3 rounded-full text-xs font-medium border transition-all",
                      !activeExamType
                        ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                        : "bg-muted/40 border-border/50 hover:border-violet-400 hover:text-violet-600"
                    )}
                    data-testid="filter-student-exam-type-all"
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
                        setSelectedTopic(null);
                      }}
                      className={cn(
                        "h-7 px-3 rounded-full text-xs font-medium border transition-all",
                        activeExamType === c
                          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                          : "bg-muted/40 border-border/50 hover:border-violet-400 hover:text-violet-600"
                      )}
                      data-testid={`filter-student-exam-type-${c}`}
                    >
                      {c}
                    </button>
                  ))}
                  {["ВПР", "МЦКО"].map(t => (
                    <span key={t} className="h-7 px-2.5 rounded-full text-xs border border-dashed border-border/30 text-muted-foreground/40 flex items-center gap-1 select-none">
                      {t}
                      <span className="text-[9px] font-semibold text-amber-500/70 uppercase tracking-wide">скоро</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Auto-detected note */}
              {autoExamTypeNote && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-0.5">
                  <Info className="h-3 w-3 shrink-0" />
                  {autoExamTypeNote}
                </div>
              )}
            </div>

            {/* Search bar */}
            <div className="relative">
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
                data-testid="input-student-task-search"
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
                  {tasksLoading ? "Поиск..." : `Найдено: ${totalTasks} задани${totalTasks === 1 ? "е" : totalTasks < 5 ? "я" : "й"}`}
                </p>
                {tasksLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : tasks.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Ничего не найдено</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map(t => (
                      <BankTaskCard
                        key={t.id}
                        task={t}
                        inPractice={practiceIds.includes(t.id)}
                        onAdd={() => addToPractice(t)}
                        onView={() => setDetailTask(t)}
                      />
                    ))}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={topicPage === 0} onClick={() => setTopicPage(p => p - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">{topicPage + 1} / {totalPages}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={topicPage >= totalPages - 1} onClick={() => setTopicPage(p => p + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Topic grid */}
            {!isSearchMode && !selectedTopic && (
              <>
                {!meta ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {visibleTopics.map(topic => (
                      <TopicCard
                        key={topic}
                        topic={topic}
                        classes={topicClassMap[topic] || []}
                        onBrowse={(cls) => {
                          setSelectedTopic(topic);
                          setTopicClassFilter(cls || activeExamType);
                          setTopicPage(0);
                        }}
                        onRandom={() => fetchRandom(topic)}
                        isLoadingRandom={loadingRandomTopic === topic}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Topic detail view */}
            {!isSearchMode && selectedTopic && (
              <div className="space-y-3">
                {/* Back + topic name + class filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => { setSelectedTopic(null); setTopicPage(0); }}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-student-back-topics"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Все темы
                  </button>
                  <span className="text-xs text-border/60">·</span>
                  <span className="text-sm font-semibold">{selectedTopic}</span>
                  <div className="flex gap-1.5 ml-auto flex-wrap">
                    <button
                      onClick={() => { setTopicClassFilter(""); setTopicPage(0); }}
                      className={cn("h-6 px-2.5 rounded-full text-[11px] font-medium border transition-all",
                        !topicClassFilter ? "bg-violet-600 text-white border-violet-600" : "bg-muted/40 border-border/50 hover:border-violet-400"
                      )}
                    >Все</button>
                    {(meta?.classes || []).map(c => (
                      <button key={c}
                        onClick={() => { setTopicClassFilter(c); setTopicPage(0); }}
                        className={cn("h-6 px-2.5 rounded-full text-[11px] font-medium border transition-all",
                          topicClassFilter === c ? "bg-violet-600 text-white border-violet-600" : "bg-muted/40 border-border/50 hover:border-violet-400"
                        )}
                      >{c}</button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">{tasksLoading ? "Загрузка..." : `${totalTasks} задани${totalTasks === 1 ? "е" : totalTasks < 5 ? "я" : "й"}`}</p>

                {tasksLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : tasks.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Заданий не найдено по этим фильтрам</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map(t => (
                      <BankTaskCard
                        key={t.id}
                        task={t}
                        inPractice={practiceIds.includes(t.id)}
                        onAdd={() => addToPractice(t)}
                        onView={() => setDetailTask(t)}
                      />
                    ))}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={topicPage === 0} onClick={() => setTopicPage(p => p - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">{topicPage + 1} / {totalPages}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={topicPage >= totalPages - 1} onClick={() => setTopicPage(p => p + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Practice panel with Quick Builder */}
          <div className="space-y-3">
            <div className="sticky top-20 space-y-3">

              {/* Tab switcher */}
              <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
                <button
                  onClick={() => setPanelTab("practice")}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                    panelTab === "practice" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  data-testid="tab-panel-practice"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Тренировка
                  {practiceIds.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-violet-500/20 text-violet-600 text-[10px] px-1.5 py-0 font-bold">{practiceIds.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setPanelTab("builder")}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                    panelTab === "builder" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  data-testid="tab-panel-builder"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Быстрый набор
                </button>
              </div>

              {/* ── ВКЛАДКА: Тренировка ── */}
              {panelTab === "practice" && (
                <div className="rounded-2xl border border-border/50 bg-card/80 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Мой список</p>
                        <p className="text-[10px] text-muted-foreground">{practiceIds.length} задани{practiceIds.length === 1 ? "е" : practiceIds.length < 5 && practiceIds.length > 0 ? "я" : "й"}</p>
                      </div>
                    </div>
                    {practiceIds.length > 0 && (
                      <button onClick={() => { setPracticeIds([]); setPracticeCache({}); }}
                        className="text-muted-foreground/50 hover:text-destructive transition-colors"
                        data-testid="button-clear-practice">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {practiceIds.length === 0 ? (
                    <div className="rounded-xl bg-muted/20 border border-dashed border-border/40 p-4 text-center">
                      <FlaskConical className="h-5 w-5 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Добавляй задания из задачника,<br/>
                        нажми «Случайное» на теме<br/>
                        или составь вариант через<br/>
                        <button onClick={() => setPanelTab("builder")} className="text-violet-600 font-semibold hover:underline">«Быстрый набор»</button>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 mb-3 max-h-64 overflow-y-auto pr-0.5">
                      {practiceTasks.map((task, i) => (
                        <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors">
                          <span className="text-[11px] font-bold text-violet-600 shrink-0 mt-0.5 w-4 tabular-nums">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium leading-snug truncate">{task.topic}</p>
                            <p className="text-[10px] text-muted-foreground">{task.class} · {task.difficulty}</p>
                          </div>
                          <button onClick={() => removeFromPractice(task.id)}
                            className="shrink-0 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                            data-testid={`button-remove-practice-${task.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {practiceIds.length > 0 && (
                    <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
                      onClick={() => setPracticeSolving(true)} data-testid="button-start-practice">
                      <Play className="h-4 w-4" />
                      Начать решение
                    </Button>
                  )}
                </div>
              )}

              {/* ── ВКЛАДКА: Быстрый набор ── */}
              {panelTab === "builder" && (
                <div className="rounded-2xl border border-border/50 bg-card/80 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-7 w-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                      <Wand2 className="h-3.5 w-3.5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Быстрый набор</p>
                      <p className="text-[10px] text-muted-foreground">Задай темы, количество — и готово</p>
                    </div>
                  </div>

                  {/* Groups */}
                  <div className="space-y-2.5">
                    {builderGroups.map((group, idx) => (
                      <div key={group.id} className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <Layers className="h-3 w-3 text-muted-foreground/50" />
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Группа {idx + 1}</span>
                          </div>
                          {builderGroups.length > 1 && (
                            <button onClick={() => removeBuilderGroup(group.id)}
                              className="text-muted-foreground/40 hover:text-destructive transition-colors"
                              data-testid={`button-remove-builder-group-${idx}`}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Topic */}
                        <Select value={group.topic} onValueChange={v => updateBuilderGroup(group.id, "topic", v)}>
                          <SelectTrigger className="h-8 text-xs bg-background/60 border-border/40" data-testid={`select-builder-topic-${idx}`}>
                            <SelectValue placeholder="Выбери тему…" />
                          </SelectTrigger>
                          <SelectContent>
                            {(meta?.topics || []).map(t => (
                              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Class + Difficulty row */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <Select value={group.cls} onValueChange={v => updateBuilderGroup(group.id, "cls", v)}>
                            <SelectTrigger className="h-7 text-[11px] bg-background/60 border-border/40">
                              <SelectValue placeholder="Тип" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_any" className="text-xs">Любой тип</SelectItem>
                              {(meta?.classes || []).map(c => (
                                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={group.difficulty} onValueChange={v => updateBuilderGroup(group.id, "difficulty", v)}>
                            <SelectTrigger className="h-7 text-[11px] bg-background/60 border-border/40">
                              <SelectValue placeholder="Сложность" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_any" className="text-xs">Любая</SelectItem>
                              {(meta?.difficulties || ["Простое", "Средняя", "Сложное"]).map(d => (
                                <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Count */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Количество заданий</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateBuilderGroup(group.id, "count", Math.max(1, group.count - 1))}
                              className="h-6 w-6 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                              data-testid={`button-builder-minus-${idx}`}>
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold tabular-nums">{group.count}</span>
                            <button onClick={() => updateBuilderGroup(group.id, "count", Math.min(10, group.count + 1))}
                              className="h-6 w-6 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                              data-testid={`button-builder-plus-${idx}`}>
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add group */}
                  <button onClick={addBuilderGroup}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/50 py-2 text-xs text-muted-foreground hover:text-violet-600 hover:border-violet-400/40 transition-all"
                    data-testid="button-add-builder-group">
                    <Plus className="h-3.5 w-3.5" />
                    Добавить группу
                  </button>

                  {/* Error */}
                  {buildVariantMutation.isError && (
                    <p className="text-xs text-destructive text-center">{(buildVariantMutation.error as Error).message}</p>
                  )}

                  {/* Build button */}
                  <Button
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white gap-2 shadow-sm shadow-violet-500/20"
                    onClick={() => buildVariantMutation.mutate(builderGroups)}
                    disabled={buildVariantMutation.isPending || builderGroups.every(g => !g.topic)}
                    data-testid="button-build-variant"
                  >
                    {buildVariantMutation.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Подбираю задания…</>
                      : <><Wand2 className="h-4 w-4" />Составить вариант</>
                    }
                  </Button>

                  <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
                    Задания добавятся в «Тренировку» и ты сможешь решить их сразу
                  </p>
                </div>
              )}

              {/* Hint */}
              <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 p-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-violet-600">Тренировка</span> — личный практикум.
                  Собери задания вручную или через быстрый набор и решай в удобном режиме.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <TaskDetailDialog
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        onAdd={detailTask ? () => addToPractice(detailTask) : undefined}
        inPractice={detailTask ? practiceIds.includes(detailTask.id) : false}
      />
      <PracticeSolveDialog
        tasks={practiceTasks}
        open={practiceSolving}
        onClose={() => setPracticeSolving(false)}
      />
    </div>
  );
}
