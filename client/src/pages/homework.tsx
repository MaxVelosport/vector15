import { useState, useMemo } from "react";
import { format, isPast } from "date-fns";
import { ru } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Image,
  Info,
  Lightbulb,
  Loader2,
  Plus,
  Send,
  Star,
  X,
  Library,
  Trash2,
  Users,
} from "lucide-react";
import { ExportDataModal } from "@/components/export-data-modal";
import { EmptyState } from "@/components/empty-state";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageTabs } from "@/components/page-tabs";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateResource } from "@/lib/queryClient";
import { useStudents, useHomework, useHomeworkTemplates, useCreateHomeworkTemplate, useDeleteHomeworkTemplate } from "@/hooks/use-tutor-data";
import type { Student, Homework } from "@shared/schema";

import { useDocumentTitle } from "@/hooks/use-document-title";
function statusBadge(status: string) {
  switch (status) {
    case "submitted":
      return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">На проверку</Badge>;
    case "reviewed":
      return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Проверено</Badge>;
    case "in_progress":
      return <Badge variant="outline">В работе</Badge>;
    default:
      return <Badge variant="secondary">Назначено</Badge>;
  }
}

function HomeworkCard({
  hw,
  studentName,
  onReview,
}: {
  hw: Homework;
  studentName: string;
  onReview: (hw: Homework) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{hw.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{studentName}</div>
          {hw.description && (
            <p className="text-sm text-muted-foreground mt-1">{hw.description}</p>
          )}
        </div>
        {statusBadge(hw.status)}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {hw.deadline && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Срок: {format(new Date(hw.deadline), "d MMM yyyy", { locale: ru })}
          </span>
        )}
        {hw.deadline && isPast(new Date(hw.deadline)) && hw.status !== "reviewed" && hw.status !== "graded" && (
          <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] px-1.5 py-0 h-4">
            Просрочено
          </Badge>
        )}
        {hw.submittedAt && (
          <span className="flex items-center gap-1">
            <Send className="h-3 w-3" />
            Сдано: {format(new Date(hw.submittedAt), "d MMM yyyy", { locale: ru })}
          </span>
        )}
      </div>

      {hw.attachments && (hw.attachments as string[]).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Задание:</p>
          <div className="flex flex-wrap gap-2">
            {(hw.attachments as string[]).map((url, i) => {
              const isExternal = url.startsWith("http");
              return isExternal ? (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-muted hover:bg-accent transition-colors text-xs max-w-[200px]"
                >
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{url.replace(/^https?:\/\//, '').slice(0, 25)}</span>
                </a>
              ) : (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-16 w-16 rounded-lg overflow-hidden border border-border/50 hover:ring-2 hover:ring-primary/40 transition-all"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {hw.hints && (
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3">
          <p className="text-xs font-medium text-amber-600 mb-1 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            Подсказки:
          </p>
          <p className="text-sm whitespace-pre-wrap">{hw.hints as string}</p>
        </div>
      )}

      {hw.solutionText && (hw.solutionText as string).trim() && (
        <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-3">
          <p className="text-xs font-medium text-blue-600 mb-1">Ответ ученика:</p>
          <p className="text-sm whitespace-pre-wrap">{hw.solutionText as string}</p>
        </div>
      )}

      {hw.solutionAttachments && (hw.solutionAttachments as string[]).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Файлы ученика:</p>
          <div className="flex flex-wrap gap-2">
            {(hw.solutionAttachments as string[]).map((url, i) => {
              const isExternal = url.startsWith("http");
              return isExternal ? (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/50 bg-blue-50 dark:bg-blue-950/30 text-xs hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors max-w-[200px]"
                >
                  <span className="truncate">{url.replace(/^https?:\/\//, '').slice(0, 25)}</span>
                </a>
              ) : (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-16 w-16 rounded-lg overflow-hidden border border-blue-500/50 hover:ring-2 hover:ring-blue-500/40 transition-all"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {hw.status === "reviewed" && hw.score !== null && hw.score !== undefined && (
        <div className="flex items-center gap-2">
          <Star className={`h-4 w-4 ${(hw.score as number) >= 80 ? "text-emerald-500" : (hw.score as number) >= 50 ? "text-amber-500" : "text-red-500"}`} />
          <span className={`text-lg font-bold ${(hw.score as number) >= 80 ? "text-emerald-600" : (hw.score as number) >= 50 ? "text-amber-600" : "text-red-500"}`}>
            {hw.score as number}/100
          </span>
          <span className="text-xs text-muted-foreground">
            {(hw.score as number) >= 90 ? "Отлично" : (hw.score as number) >= 70 ? "Хорошо" : (hw.score as number) >= 50 ? "Удовл." : "Доработка"}
          </span>
        </div>
      )}

      {hw.feedback && (
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3">
          <p className="text-sm">
            <span className="font-medium text-emerald-600">Отзыв: </span>
            {hw.feedback}
          </p>
        </div>
      )}

      {hw.status === "submitted" && (
        <Button size="sm" className="gap-2" onClick={() => onReview(hw)}>
          <CheckCircle2 className="h-4 w-4" />
          Проверить
        </Button>
      )}
    </motion.div>
  );
}

export default function HomeworkPage() {
  useDocumentTitle("Домашние задания");
  const queryClient = useQueryClient();
  const { data: studentsData, isLoading: studentsLoading } = useStudents();
  const { data: homeworkData, isLoading: homeworkLoading } = useHomework();

  const students = useMemo(() => (studentsData ?? []) as Student[], [studentsData]);
  const allHomework = useMemo(() => (homeworkData ?? []) as Homework[], [homeworkData]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newAttachments, setNewAttachments] = useState<string[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newHints, setNewHints] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploadingTutor, setUploadingTutor] = useState(false);

  const [reviewHw, setReviewHw] = useState<Homework | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewScore, setReviewScore] = useState<number>(0);
  const [reviewing, setReviewing] = useState(false);

  const { data: templates = [] } = useHomeworkTemplates();
  const createTemplate = useCreateHomeworkTemplate();
  const deleteTemplate = useDeleteHomeworkTemplate();
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [newTemplateHints, setNewTemplateHints] = useState("");
  // Bulk homework
  const [bulkOpen, setBulkOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [bulkStudentIds, setBulkStudentIds] = useState<string[]>([]);
  const [bulkTitle, setBulkTitle] = useState("");
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkDeadline, setBulkDeadline] = useState("");
  const [bulkHints, setBulkHints] = useState("");
  const [bulkCreating, setBulkCreating] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const studentMap = useMemo(() => {
    const map: Record<string, string> = {};
    students.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [students]);

  const filtered = useMemo(() => {
    if (selectedStudentId === "all") return allHomework;
    return allHomework.filter((h) => h.studentId === selectedStudentId);
  }, [allHomework, selectedStudentId]);

  const submitted = filtered.filter((h) => h.status === "submitted");
  const inWork = filtered.filter((h) => h.status === "assigned" || h.status === "in_progress");
  const reviewed = filtered.filter((h) => h.status === "reviewed");

  const handleCreate = async () => {
    if (!newStudentId || !newTitle.trim()) {
      toast.error("Укажите ученика и название");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentId: newStudentId,
          title: newTitle,
          description: newDescription || undefined,
          deadline: newDeadline || undefined,
          attachments: newAttachments.length > 0 ? newAttachments : undefined,
          hints: newHints.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Ошибка создания");
      toast.success("Домашка создана");
      invalidateResource("homework");
      setCreateOpen(false);
      setNewStudentId("");
      setNewTitle("");
      setNewDescription("");
      setNewDeadline("");
      setNewAttachments([]);
      setNewLinkUrl("");
      setNewHints("");
    } catch {
      toast.error("Ошибка при создании домашки");
    } finally {
      setCreating(false);
    }
  };

  const handleReview = async () => {
    if (!reviewHw) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/homework/${reviewHw.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: "reviewed",
          feedback: reviewFeedback || undefined,
          score: reviewScore,
        }),
      });
      if (!res.ok) throw new Error("Ошибка");
      toast.success("Домашка проверена");
      invalidateResource("homework");
      setReviewHw(null);
      setReviewFeedback("");
      setReviewScore(0);
    } catch {
      toast.error("Ошибка при проверке");
    } finally {
      setReviewing(false);
    }
  };

  const addTutorLink = () => {
    const trimmed = newLinkUrl.trim();
    if (trimmed) {
      setNewAttachments((prev) => [...prev, trimmed]);
      setNewLinkUrl("");
    }
  };

  const handleTutorFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingTutor(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { urls } = await res.json();
      setNewAttachments((prev: string[]) => [...prev, ...urls]);
    } catch (err) {
      toast.error("Ошибка загрузки файла");
    } finally {
      setUploadingTutor(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (idx: number) => {
    setNewAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const isLoading = studentsLoading || homeworkLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Домашки">
        <div className="space-y-3">
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-28 rounded-xl" />)}
          </div>
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="rounded-2xl">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-5 w-16 rounded-full" /></div>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="📝 Домашки"
      subtitle="Домашние задания учеников"
      actions={
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden sm:flex" onClick={() => setShowExport(true)} data-testid="button-export-homework">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Экспорт</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden sm:flex" onClick={() => setShowTemplatesDialog(true)} data-testid="button-open-templates">
            <Library className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Шаблоны</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden sm:flex" onClick={() => setBulkOpen(true)} data-testid="button-bulk-homework">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Массово</span>
          </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-8 text-xs shadow-lg">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Домашку</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Новая домашка</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Ученик *</Label>
                <Select value={newStudentId} onValueChange={setNewStudentId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Выберите ученика" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.filter(s => s.isActive).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Название *</Label>
                <Input
                  className="mt-1"
                  placeholder="Например: Задачи по теме «Производная»"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div>
                <Label>Описание</Label>
                <Textarea
                  className="mt-1"
                  placeholder="Подробности задания..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <Label>Дедлайн</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                />
              </div>
              <div>
                <Label>Прикрепить фото к заданию</Label>
                <div className="mt-1">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    id="tutor-file-input"
                    className="hidden"
                    onChange={handleTutorFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    disabled={uploadingTutor}
                    onClick={() => document.getElementById("tutor-file-input")?.click()}
                  >
                    {uploadingTutor ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Image className="h-4 w-4" />
                    )}
                    {uploadingTutor ? "Загрузка..." : "Выбрать фото с устройства"}
                  </Button>
                </div>
                <div className="mt-2 space-y-1.5">
                  <Label className="text-xs">Или вставить ссылку</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://disk.yandex.ru/... или drive.google.com/..."
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTutorLink(); } }}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addTutorLink} disabled={!newLinkUrl.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {newAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newAttachments.map((url, i) => {
                      const isExternal = url.startsWith("http");
                      return (
                        <div key={i} className="relative group">
                          {isExternal ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg border text-xs bg-muted hover:bg-accent transition-colors max-w-[180px]"
                            >
                              <span className="truncate">{url.replace(/^https?:\/\//, '').slice(0, 25)}</span>
                            </a>
                          ) : (
                            <img
                              src={url}
                              alt=""
                              className="h-16 w-16 rounded-lg object-cover border border-border/50"
                            />
                          )}
                          <button
                            onClick={() => removeAttachment(i)}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground space-y-0.5 mt-2">
                  <p>Фото: JPG, PNG, HEIC -- до 10 МБ</p>
                  <p>Большие файлы (PDF, видео) -- загрузите на Яндекс Диск / Google Диск и вставьте ссылку</p>
                </div>
              </div>
              <div>
                <Label>Подсказки для ученика</Label>
                <Textarea
                  className="mt-1"
                  placeholder="Подсказки, которые помогут ученику решить задание..."
                  value={newHints}
                  onChange={(e) => setNewHints(e.target.value)}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">Ученик увидит подсказки в задании</p>
              </div>
              <Button className="w-full gap-2" onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      }
    >
      <div className="space-y-6">
        <PageTabs
          tabs={[
            { label: "Задания", path: "/homework" },
            { label: "Тренажёры", path: "/quizzes" },
          ]}
        />
        <PageHero
          icon={<FileText className="h-6 w-6 text-white" />}
          gradient="from-violet-600/80 via-purple-600/70 to-indigo-600/60"
          title="Домашние задания"
          subtitle='Нажмите «Создать домашку», выберите ученика и дедлайн — ученик сразу увидит задание. Используйте «Сгенерировать с ИИ» для автогенерации. Статусы: Новое → На проверке → Выполнено.'
          badge="ДЗ + Банк"
        />

        <div className="flex items-center gap-3">
          <Label className="shrink-0">Ученик:</Label>
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Все ученики" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все ученики</SelectItem>
              {students.filter(s => s.isActive).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} — {s.subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-amber-500/10 to-orange-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><Send className="h-10 w-10 text-amber-600 rotate-12" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                    <Send className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{submitted.length}</div>
                    <div className="text-xs text-muted-foreground">На проверку</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><Clock className="h-10 w-10 text-blue-600 -rotate-6" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{inWork.length}</div>
                    <div className="text-xs text-muted-foreground">В работе</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><CheckCircle2 className="h-10 w-10 text-emerald-600 -rotate-6" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{reviewed.length}</div>
                    <div className="text-xs text-muted-foreground">Проверено</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {submitted.length > 0 && (
          <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-4 w-4 text-amber-500" />
                На проверку
                <Badge variant="secondary" className="ml-1">{submitted.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {submitted.map((hw) => (
                <HomeworkCard
                  key={hw.id}
                  hw={hw}
                  studentName={studentMap[hw.studentId] || "—"}
                  onReview={setReviewHw}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {inWork.length > 0 && (
          <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-blue-500" />
                В работе
                <Badge variant="secondary" className="ml-1">{inWork.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {inWork.map((hw) => (
                <HomeworkCard
                  key={hw.id}
                  hw={hw}
                  studentName={studentMap[hw.studentId] || "—"}
                  onReview={setReviewHw}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {reviewed.length > 0 && (
          <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Проверено
                <Badge variant="secondary" className="ml-1">{reviewed.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {reviewed.map((hw) => (
                <HomeworkCard
                  key={hw.id}
                  hw={hw}
                  studentName={studentMap[hw.studentId] || "—"}
                  onReview={setReviewHw}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {filtered.length === 0 && (
          <EmptyState
            icon={FileText}
            title="Нет домашних заданий"
            description="Назначьте первое задание чтобы отслеживать выполнение и прогресс учеников"
            actionLabel="Создать ДЗ"
            onAction={() => setCreateOpen(true)}
          />
        )}
      </div>

      <Dialog open={!!reviewHw} onOpenChange={(open) => { if (!open) { setReviewHw(null); setReviewFeedback(""); setReviewScore(0); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Проверка домашки</DialogTitle>
          </DialogHeader>
          {reviewHw && (
            <div className="space-y-4 mt-2">
              <div>
                <div className="font-medium">{reviewHw.title}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {studentMap[reviewHw.studentId] || "—"}
                </div>
                {reviewHw.description && (
                  <p className="text-sm text-muted-foreground mt-2">{reviewHw.description}</p>
                )}
              </div>
              {reviewHw.attachments && (reviewHw.attachments as string[]).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Задание:</p>
                  <div className="flex flex-wrap gap-2">
                    {(reviewHw.attachments as string[]).map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-20 w-20 rounded-lg overflow-hidden border border-border/50 hover:ring-2 hover:ring-primary/40 transition-all"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {reviewHw.solutionText && (reviewHw.solutionText as string).trim() && (
                <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-3">
                  <p className="text-xs font-medium text-blue-600 mb-1">Ответ ученика:</p>
                  <p className="text-sm whitespace-pre-wrap">{reviewHw.solutionText as string}</p>
                </div>
              )}
              {reviewHw.solutionAttachments && (reviewHw.solutionAttachments as string[]).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-blue-600 mb-1.5">Файлы ученика:</p>
                  <div className="flex flex-wrap gap-2">
                    {(reviewHw.solutionAttachments as string[]).map((url, i) => {
                      const isExternal = url.startsWith("http");
                      return isExternal ? (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-500/50 bg-blue-50 dark:bg-blue-950/30 text-xs hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors max-w-[200px]"
                        >
                          <span className="truncate">{url.replace(/^https?:\/\//, '').slice(0, 25)}</span>
                        </a>
                      ) : (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-20 w-20 rounded-lg overflow-hidden border border-blue-500/50 hover:ring-2 hover:ring-blue-500/40 transition-all"
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <Label>Оценка (0-100 баллов)</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={reviewScore}
                    onChange={(e) => setReviewScore(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={reviewScore}
                    onChange={(e) => setReviewScore(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-20 text-center font-bold"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0</span>
                  <span className={`font-medium ${reviewScore >= 80 ? "text-emerald-600" : reviewScore >= 50 ? "text-amber-600" : "text-red-500"}`}>
                    {reviewScore >= 90 ? "Отлично" : reviewScore >= 70 ? "Хорошо" : reviewScore >= 50 ? "Удовлетворительно" : "Нужна доработка"}
                  </span>
                  <span>100</span>
                </div>
              </div>
              <div>
                <Label>Отзыв</Label>
                <Textarea
                  className="mt-1"
                  placeholder="Напишите отзыв по домашке..."
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  rows={4}
                />
              </div>
              <Button className="w-full gap-2" onClick={handleReview} disabled={reviewing}>
                {reviewing && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle2 className="h-4 w-4" />
                Проверено
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-4 w-4 text-primary" />
              Шаблоны домашних заданий
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {templates.length > 0 && (
              <div className="space-y-2">
                {templates.map((t: any) => (
                  <div key={t.id} className="rounded-xl border border-border/50 bg-muted/20 p-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      {t.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2" data-testid={`button-apply-template-${t.id}`} onClick={() => {
                        setNewTitle(t.title);
                        setNewDescription(t.description || "");
                        setNewHints(t.hints || "");
                        setCreateOpen(true);
                        setShowTemplatesDialog(false);
                      }}>Применить</Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" data-testid={`button-delete-template-${t.id}`} onClick={() => deleteTemplate.mutate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Нет сохранённых шаблонов</p>
            )}
            <div className="border-t pt-4 space-y-3">
              <div className="text-sm font-medium">Создать новый шаблон</div>
              <div>
                <Label>Название *</Label>
                <Input className="mt-1" placeholder="Название шаблона" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} data-testid="input-template-name" />
              </div>
              <div>
                <Label>Описание</Label>
                <Textarea className="mt-1" rows={3} placeholder="Текст задания..." value={newTemplateDesc} onChange={e => setNewTemplateDesc(e.target.value)} data-testid="input-template-desc" />
              </div>
              <div>
                <Label>Подсказки</Label>
                <Textarea className="mt-1" rows={2} placeholder="Подсказки для ученика..." value={newTemplateHints} onChange={e => setNewTemplateHints(e.target.value)} data-testid="input-template-hints" />
              </div>
              <Button className="w-full" disabled={!newTemplateName.trim() || savingTemplate} data-testid="button-save-template" onClick={async () => {
                if (!newTemplateName.trim()) return;
                setSavingTemplate(true);
                try {
                  await createTemplate.mutateAsync({ title: newTemplateName.trim(), description: newTemplateDesc.trim() || undefined, hints: newTemplateHints.trim() || undefined });
                  setNewTemplateName(""); setNewTemplateDesc(""); setNewTemplateHints("");
                  toast.success("Шаблон сохранён");
                } finally { setSavingTemplate(false); }
              }}>
                {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Сохранить шаблон
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Bulk Homework Dialog */}
      <Dialog open={bulkOpen} onOpenChange={open => { setBulkOpen(open); if (!open) { setBulkStudentIds([]); setBulkTitle(""); setBulkDescription(""); setBulkDeadline(""); setBulkHints(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Массовая выдача домашки
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm font-medium">Выберите учеников *</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                {students.filter(s => s.isActive).map(s => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={bulkStudentIds.includes(s.id)}
                      onChange={e => {
                        if (e.target.checked) setBulkStudentIds(prev => [...prev, s.id]);
                        else setBulkStudentIds(prev => prev.filter(id => id !== s.id));
                      }}
                      className="rounded border-border"
                      data-testid={`checkbox-bulk-student-${s.id}`}
                    />
                    <span className="text-sm">{s.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{s.subject}</span>
                  </label>
                ))}
                {students.filter(s => s.isActive).length === 0 && (
                  <p className="text-sm text-muted-foreground p-2">Нет активных учеников</p>
                )}
              </div>
              <div className="flex gap-2 mt-1">
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setBulkStudentIds(students.filter(s => s.isActive).map(s => s.id))}>
                  Выбрать всех
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setBulkStudentIds([])}>
                  Снять выбор
                </Button>
                <span className="text-xs text-muted-foreground ml-auto self-center">Выбрано: {bulkStudentIds.length}</span>
              </div>
            </div>
            <div>
              <Label>Название *</Label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Например: Задачи по теореме Пифагора"
                value={bulkTitle}
                onChange={e => setBulkTitle(e.target.value)}
                data-testid="input-bulk-title"
              />
            </div>
            <div>
              <Label>Описание</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                placeholder="Подробное описание задания..."
                value={bulkDescription}
                onChange={e => setBulkDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Срок сдачи</Label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={bulkDeadline}
                  onChange={e => setBulkDeadline(e.target.value)}
                />
              </div>
              <div>
                <Label>Подсказки</Label>
                <input
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Краткая подсказка..."
                  value={bulkHints}
                  onChange={e => setBulkHints(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full gap-2"
              disabled={bulkCreating || bulkStudentIds.length === 0 || !bulkTitle.trim()}
              data-testid="button-bulk-create"
              onClick={async () => {
                setBulkCreating(true);
                try {
                  const res = await fetch("/api/homework/bulk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      studentIds: bulkStudentIds,
                      title: bulkTitle.trim(),
                      description: bulkDescription || undefined,
                      deadline: bulkDeadline || undefined,
                      hints: bulkHints || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  toast.success(`Домашка выдана ${data.created} ученикам`);
                  invalidateResource("homework");
                  setBulkOpen(false);
                } catch (e: any) {
                  toast.error(e.message);
                } finally {
                  setBulkCreating(false);
                }
              }}
            >
              {bulkCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              {bulkCreating ? "Выдаю..." : `Выдать ${bulkStudentIds.length > 0 ? `${bulkStudentIds.length} уч.` : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ExportDataModal open={showExport} onOpenChange={setShowExport} />
    </DashboardLayout>
  );
}
