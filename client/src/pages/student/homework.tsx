import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  CheckCircle2,
  MessageSquare,
  Clock,
  BarChart3,
  Send,
  Image,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  Loader2,
  Paperclip,
  Plus,
  Star,
  X,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { ru } from "date-fns/locale";

interface Homework {
  id: string;
  title: string;
  description?: string;
  completionPct: number;
  status: string;
  deadline?: string;
  feedback?: string;
  score?: number;
  hints?: string;
  attachments?: string[];
  solutionAttachments?: string[];
  solutionText?: string;
  submittedAt?: string;
}

interface StudentHomeworkProps {
  homework: Homework[];
  onAskAi: (homeworkId: string) => void;
}

const REVIEWED_PAGE_SIZE = 5;

export default function StudentHomework({ homework, onAskAi }: StudentHomeworkProps) {
  const queryClient = useQueryClient();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [reviewedPage, setReviewedPage] = useState(0);
  const [submitDialogHw, setSubmitDialogHw] = useState<Homework | null>(null);
  const [solutionUrls, setSolutionUrls] = useState<string[]>([]);
  const [solutionText, setSolutionText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const activeHomework = homework.filter(h => h.status !== "reviewed");
  const reviewedHomework = homework.filter(h => h.status === "reviewed");
  const inProgressHomework = homework.filter(h => h.status === "in_progress" || h.status === "assigned");

  const stats = useMemo(() => {
    const reviewed = reviewedHomework.length;
    const inProgress = inProgressHomework.length;

    let avgScore: number | null = null;
    if (reviewed > 0) {
      const scores: number[] = [];
      for (const hw of reviewedHomework) {
        if (hw.score !== null && hw.score !== undefined) {
          scores.push(hw.score);
        }
      }
      if (scores.length > 0) {
        avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
    }

    return { reviewed, inProgress, avgScore };
  }, [reviewedHomework, inProgressHomework]);

  const totalReviewedPages = Math.ceil(reviewedHomework.length / REVIEWED_PAGE_SIZE);
  const pagedReviewed = reviewedHomework.slice(
    reviewedPage * REVIEWED_PAGE_SIZE,
    (reviewedPage + 1) * REVIEWED_PAGE_SIZE
  );

  const openSubmitDialog = (hw: Homework) => {
    setSubmitDialogHw(hw);
    setSolutionUrls([]);
    setSolutionText("");
    setLinkUrl("");
  };

  const addLink = () => {
    const trimmed = linkUrl.trim();
    if (trimmed) {
      setSolutionUrls((prev) => [...prev, trimmed]);
      setLinkUrl("");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { urls } = await res.json();
      setSolutionUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeUrl = (idx: number) => {
    setSolutionUrls(solutionUrls.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!submitDialogHw) return;
    setSubmittingId(submitDialogHw.id);
    try {
      await fetch(`/api/student/homework/${submitDialogHw.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ solutionAttachments: solutionUrls, solutionText }),
      });
      queryClient.invalidateQueries({ queryKey: ["student-homework"] });
      setSubmitDialogHw(null);
    } catch (e) {
      console.error("Submit error:", e);
    } finally {
      setSubmittingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "reviewed":
        return <Badge className="bg-green-500">Проверено</Badge>;
      case "submitted":
        return <Badge className="bg-blue-500">Сдано</Badge>;
      case "in_progress":
        return <Badge variant="outline">В работе</Badge>;
      default:
        return <Badge variant="destructive">Новое</Badge>;
    }
  };

  const AttachmentGallery = ({ urls, label }: { urls: string[]; label: string }) => (
    <div className="mt-3">
      <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
        <Image className="w-4 h-4 text-muted-foreground" />
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, idx) => {
          const isExternal = url.startsWith("http");
          return isExternal ? (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-muted hover:bg-accent transition-colors text-xs max-w-[220px]"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{url.replace(/^https?:\/\//, '').slice(0, 30)}</span>
            </a>
          ) : (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block w-24 h-24 rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all"
            >
              <img
                src={url}
                alt={`${label} ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = 'none';
                  el.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-2 text-center">Файл</div>';
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );

  const HomeworkCard = ({ hw }: { hw: Homework }) => (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium">{hw.title}</h4>
          {hw.description && (
            <p className="text-sm text-muted-foreground mt-1">{hw.description}</p>
          )}
        </div>
        {getStatusBadge(hw.status)}
      </div>

      {hw.attachments && hw.attachments.length > 0 && (
        <AttachmentGallery urls={hw.attachments} label="Материалы от репетитора" />
      )}

      {hw.solutionText && hw.solutionText.trim() && (
        <div className="mt-3 p-3 rounded-md bg-blue-500/5 border border-blue-500/10">
          <p className="text-xs font-medium text-blue-600 mb-1">Мой ответ:</p>
          <p className="text-sm whitespace-pre-wrap">{hw.solutionText}</p>
        </div>
      )}

      {hw.solutionAttachments && hw.solutionAttachments.length > 0 && (
        <AttachmentGallery urls={hw.solutionAttachments} label="Моё решение" />
      )}

      {hw.hints && (
        <div className="mt-3 p-3 rounded-md bg-amber-500/5 border border-amber-500/10">
          <p className="text-xs font-medium text-amber-600 mb-1 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            Подсказки:
          </p>
          <p className="text-sm whitespace-pre-wrap">{hw.hints}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {hw.status === "reviewed" ? "Выполнено" : hw.status === "submitted" ? "Сдано на проверку" : "Не выполнено"}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      </div>

      {hw.status === "reviewed" && hw.score !== null && hw.score !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <Star className={`h-4 w-4 ${hw.score >= 80 ? "text-emerald-500" : hw.score >= 50 ? "text-amber-500" : "text-red-500"}`} />
          <span className={`text-lg font-bold ${hw.score >= 80 ? "text-emerald-600" : hw.score >= 50 ? "text-amber-600" : "text-red-500"}`}>
            {hw.score}/100
          </span>
          <span className="text-xs text-muted-foreground">
            {hw.score >= 90 ? "Отлично" : hw.score >= 70 ? "Хорошо" : hw.score >= 50 ? "Удовл." : "Нужна доработка"}
          </span>
        </div>
      )}

      {hw.feedback && (
        <div className="mt-3 p-3 rounded-md bg-green-500/5 border border-green-500/10">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Отзыв репетитора: </span>
            {hw.feedback}
          </p>
        </div>
      )}

      {hw.submittedAt && hw.status === "submitted" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Сдано: {format(new Date(hw.submittedAt), "d MMM yyyy, HH:mm", { locale: ru })}
        </p>
      )}

      {hw.status !== "reviewed" && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2">
            {(hw.status === "assigned" || hw.status === "in_progress") && (
              <Button
                size="sm"
                onClick={() => openSubmitDialog(hw)}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                Сдать работу
              </Button>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAskAi(hw.id)}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Помощь ИИ
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Домашние задания</h1>
        <p className="text-muted-foreground mt-1">Задания и результаты проверки</p>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-blue-500/5 border border-blue-500/10 px-4 py-2.5">
        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Здесь вы видите все домашние задания. Нажмите на задание чтобы открыть, написать ответ и отправить на проверку. Красные — просроченные, жёлтые — дедлайн скоро. ИИ-помощник поможет с трудными задачами.{" "}
          <a href="/student/help" className="text-primary underline underline-offset-2 hover:no-underline font-medium">Инструкция →</a>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.reviewed}</p>
                <p className="text-sm text-muted-foreground">Проверено</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-sm text-muted-foreground">В работе</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${stats.avgScore !== null ? (stats.avgScore >= 80 ? "text-emerald-600" : stats.avgScore >= 50 ? "text-amber-600" : "text-red-500") : ""}`}>
                  {stats.avgScore !== null ? `${stats.avgScore}/100` : "—"}
                </p>
                <p className="text-sm text-muted-foreground">Средний балл</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            На выполнении
            {activeHomework.length > 0 && (
              <Badge variant="secondary" className="ml-2">{activeHomework.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeHomework.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Нет заданий на выполнении</p>
          ) : (
            <div className="space-y-3">
              {activeHomework.map(hw => <HomeworkCard key={hw.id} hw={hw} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {reviewedHomework.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Проверенные
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-3">
                {pagedReviewed.map(hw => <HomeworkCard key={hw.id} hw={hw} />)}
              </div>

              {totalReviewedPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reviewedPage === 0}
                    onClick={() => setReviewedPage(p => p - 1)}
                    className="gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Назад
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {reviewedPage + 1} из {totalReviewedPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reviewedPage >= totalReviewedPages - 1}
                    onClick={() => setReviewedPage(p => p + 1)}
                    className="gap-1"
                  >
                    Далее
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!submitDialogHw} onOpenChange={(open) => !open && setSubmitDialogHw(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Сдать работу</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {submitDialogHw && (
              <p className="text-sm text-muted-foreground">
                {submitDialogHw.title}
              </p>
            )}

            <div className="space-y-2">
              <Label>Текст ответа</Label>
              <Textarea
                value={solutionText}
                onChange={(e) => setSolutionText(e.target.value)}
                placeholder="Напишите ответ текстом..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Прикрепить файл
              </Label>
              <div>
                <input
                  type="file"
                  accept="*"
                  multiple
                  id="solution-file-input"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={uploading}
                  onClick={() => document.getElementById("solution-file-input")?.click()}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                  {uploading ? "Загрузка..." : "Выбрать файл с устройства"}
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1 text-center">Фото, PDF, документы, архивы — любой формат (до 20 МБ)</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Или вставить ссылку
              </Label>
              <div className="flex gap-2">
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://disk.yandex.ru/... или drive.google.com/..."
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
                />
                <Button type="button" size="icon" variant="outline" onClick={addLink} disabled={!linkUrl.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {solutionUrls.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Прикреплённые файлы ({solutionUrls.length})</p>
                <div className="flex flex-wrap gap-2">
                  {solutionUrls.map((url, idx) => {
                    const isExternal = url.startsWith("http");
                    return (
                      <div key={idx} className="relative group">
                        {isExternal ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-muted text-xs hover:bg-accent transition-colors max-w-[200px]"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{url.replace(/^https?:\/\//, '').slice(0, 30)}</span>
                          </a>
                        ) : (
                          <div className="w-20 h-20 rounded-lg overflow-hidden border bg-muted">
                            <img
                              src={url}
                              alt={`Решение ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const el = e.target as HTMLImageElement;
                                el.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <button
                          onClick={() => removeUrl(idx)}
                          className="absolute -top-1 -right-1 p-0.5 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Как сдать работу:</p>
              <p>1. Напишите ответ текстом и/или прикрепите фото решения</p>
              <p>2. Фото: JPG, PNG, HEIC -- до 10 МБ каждое</p>
              <p>3. Если файл большой (PDF, видео) -- загрузите на Яндекс Диск или Google Диск и вставьте ссылку</p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setSubmitDialogHw(null)}>
                Отмена
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submittingId !== null || (!solutionText.trim() && solutionUrls.length === 0)}
                className="gap-2"
              >
                {submittingId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Сдать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
