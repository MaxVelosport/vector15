import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Mic, Upload, RefreshCw, Trash2, Loader2, FileAudio, Sparkles,
  ArrowLeft, ExternalLink, Video, FileText, BookMarked, GraduationCap, Clock, AlertCircle
} from "lucide-react";
import type { LessonRecording, Student } from "@shared/schema";

import { useDocumentTitle } from "@/hooks/use-document-title";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageTabs } from "@/components/page-tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon?: any }> = {
    pending:      { label: "Ожидает аудио",   className: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200" },
    transcribing: { label: "Расшифровка...",  className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200", icon: Loader2 },
    summarizing:  { label: "Конспект...",     className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200", icon: Loader2 },
    ready:        { label: "Готово",          className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" },
    failed:       { label: "Ошибка",          className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200", icon: AlertCircle },
  };
  const m = map[status] || map.pending;
  const Icon = m.icon;
  return (
    <Badge className={`${m.className} gap-1`} data-testid={`status-${status}`}>
      {Icon ? <Icon className={`h-3 w-3 ${status === 'transcribing' || status === 'summarizing' ? 'animate-spin' : ''}`} /> : null}
      {m.label}
    </Badge>
  );
}

function fmtDuration(sec?: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m} мин ${s.toString().padStart(2, "0")} сек`;
}

function fmtDate(d?: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

export default function RecordingsPage() {
  useDocumentTitle("Записи занятий");
  const [, params] = useRoute("/recording/:id");
  if (params?.id) return <RecordingDetail id={params.id} />;
  return <RecordingsList />;
}

function RecordingsList() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: recordings = [], isLoading, refetch } = useQuery<LessonRecording[]>({
    queryKey: ["/api/recordings"],
    refetchInterval: (q) => {
      const list = (q.state.data as LessonRecording[] | undefined) || [];
      return list.some(r => r.status === 'transcribing' || r.status === 'summarizing') ? 5000 : false;
    },
  });
  const { data: students = [] } = useQuery<Student[]>({ queryKey: ["/api/students"] });
  const studentName = (id?: string | null) => students.find(s => s.id === id)?.name || "Все ученики";

  const syncMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/recordings/sync-bbb"),
    onSuccess: async (r: any) => {
      const d = await r.json();
      toast.success("Синхронизировано", { description: `Новых записей: ${d.added}` });
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
    },
    onError: (e: any) => toast.error("Ошибка", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/recordings/${id}`),
    onSuccess: () => {
      toast.success("Удалено");
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
    },
  });

  const retryMut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/recordings/${id}/retry`),
    onSuccess: () => {
      toast.success("Перезапущено");
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
    },
  });

  return (
    <DashboardLayout title="Записи уроков" subtitle="Расшифровка и автоконспект">
      <PageTabs
        tabs={[
          { label: "Планы уроков", path: "/lesson-plan" },
          { label: "Записи уроков", path: "/recordings" },
        ]}
      />
      <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mic className="h-6 w-6" /> Записи уроков
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Расшифровка видеоуроков и автоматический конспект для ученика. ИИ извлекает ключевые моменты, термины и ДЗ.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            data-testid="button-sync-bbb"
            className="gap-2"
          >
            {syncMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Подтянуть из конференций
          </Button>
          <Button onClick={() => setUploadOpen(true)} data-testid="button-upload" className="gap-2">
            <Upload className="h-4 w-4" /> Загрузить аудио
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
      ) : recordings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileAudio className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Пока нет записей.</p>
            <p className="text-xs text-muted-foreground mt-1">Загрузите аудиофайл урока (mp3/m4a/mp4 до 25 МБ) или включите запись в видеоконференции.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {recordings.map(r => (
            <Card key={r.id} data-testid={`card-recording-${r.id}`} className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {r.source === 'bbb' ? <Video className="h-4 w-4 text-blue-500 shrink-0" /> : <FileAudio className="h-4 w-4 text-purple-500 shrink-0" />}
                      <h3 className="font-semibold truncate" data-testid={`text-title-${r.id}`}>{r.title}</h3>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {studentName(r.studentId)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDate(r.recordedAt)}</span>
                      {r.durationSec ? <span>⏱ {fmtDuration(r.durationSec)}</span> : null}
                    </div>
                    {r.status === 'ready' && r.summary ? (
                      <p className="text-sm mt-2 line-clamp-2 text-muted-foreground" data-testid={`text-summary-${r.id}`}>{r.summary}</p>
                    ) : null}
                    {r.status === 'failed' && r.errorMessage ? (
                      <p className="text-sm mt-2 text-red-600 dark:text-red-400">{r.errorMessage}</p>
                    ) : null}
                    {r.status === 'pending' && r.source === 'bbb' ? (
                      <p className="text-xs mt-2 text-muted-foreground italic">⬇ Скачайте аудио из плеера BBB и загрузите его кнопкой «Расшифровать».</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {r.playbackUrl ? (
                      <Button asChild variant="outline" size="sm" className="gap-1">
                        <a href={r.playbackUrl} target="_blank" rel="noreferrer" data-testid={`link-playback-${r.id}`}><ExternalLink className="h-3 w-3" /> Видео</a>
                      </Button>
                    ) : null}
                    {r.status === 'ready' ? (
                      <Button asChild size="sm" className="gap-1" data-testid={`button-open-${r.id}`}>
                        <Link href={`/recording/${r.id}`}><BookMarked className="h-3 w-3" /> Конспект</Link>
                      </Button>
                    ) : null}
                    {r.status === 'pending' ? (
                      <UploadForRecordingButton recordingId={r.id} />
                    ) : null}
                    {r.status === 'failed' ? (
                      <Button variant="outline" size="sm" onClick={() => retryMut.mutate(r.id)} className="gap-1" data-testid={`button-retry-${r.id}`}>
                        <RefreshCw className="h-3 w-3" /> Повторить
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setPendingDeleteId(r.id)}
                      data-testid={`button-delete-${r.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} students={students} />

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Удалить запись?"
        description="Запись и все связанные данные будут удалены безвозвратно."
        confirmText="Удалить"
        onConfirm={() => { deleteMut.mutate(pendingDeleteId!); setPendingDeleteId(null); }}
        onCancel={() => setPendingDeleteId(null)}
      />
      </div>
    </DashboardLayout>
  );
}

function UploadForRecordingButton({ recordingId }: { recordingId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File) => {
    if (f.size > 25 * 1024 * 1024) {
      toast.error("Файл слишком большой", { description: "Максимум 25 МБ. Сожмите аудио в mp3 64–96 kbps." });
      return;
    }
    const fd = new FormData();
    fd.append("audio", f);
    fd.append("recordingId", recordingId);
    setBusy(true);
    try {
      const res = await fetch("/api/recordings/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Ошибка загрузки");
      toast.success("Расшифровка запущена");
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
    } catch (e: any) {
      toast.error("Ошибка", { description: e.message });
    } finally { setBusy(false); }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="audio/*,video/mp4,.m4a,.mp3,.wav,.ogg,.opus" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy} className="gap-1" data-testid={`button-transcribe-${recordingId}`}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Расшифровать
      </Button>
    </>
  );
}

function UploadDialog({ open, onOpenChange, students }: { open: boolean; onOpenChange: (v: boolean) => void; students: Student[] }) {
  const [title, setTitle] = useState("");
  const [studentId, setStudentId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return toast.error("Выберите аудиофайл");
    if (!title.trim()) return toast.error("Укажите название");
    if (file.size > 25 * 1024 * 1024) return toast.error("Файл слишком большой", { description: "Максимум 25 МБ." });
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("audio", file);
      fd.append("title", title.trim());
      if (studentId) fd.append("studentId", studentId);
      const res = await fetch("/api/recordings/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Ошибка");
      toast.success("Запущена расшифровка", { description: "Это занимает 1–3 минуты — обновится автоматически."  });
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      onOpenChange(false);
      setTitle(""); setStudentId(""); setFile(null);
    } catch (e: any) {
      toast.error("Ошибка", { description: e.message });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-upload">
        <DialogHeader>
          <DialogTitle>Загрузить аудио урока</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Название</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Урок по тригонометрии — 22 апр" data-testid="input-title" />
          </div>
          <div>
            <Label>Ученик (необязательно)</Label>
            <Select value={studentId || "_none"} onValueChange={(v) => setStudentId(v === "_none" ? "" : v)}>
              <SelectTrigger data-testid="select-student"><SelectValue placeholder="Не привязывать" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Не привязывать —</SelectItem>
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Аудиофайл (mp3, m4a, wav, mp4 — до 25 МБ)</Label>
            <Input type="file" accept="audio/*,video/mp4,.m4a,.mp3,.wav,.ogg,.opus"
              onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="input-file" />
            {file ? <p className="text-xs text-muted-foreground mt-1">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} МБ</p> : null}
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
            💡 Если ваше видео больше 25 МБ — извлеките аудиодорожку (mp3 64–96 kbps), это всегда поместится в лимит.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={submit} disabled={busy || !file || !title.trim()} data-testid="button-submit-upload">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Расшифровать и сделать конспект
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordingDetail({ id }: { id: string }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const { data: r, isLoading } = useQuery<LessonRecording>({
    queryKey: ["/api/recordings", id],
    refetchInterval: (q) => {
      const v = q.state.data as LessonRecording | undefined;
      return v && (v.status === 'transcribing' || v.status === 'summarizing') ? 5000 : false;
    },
  });

  if (isLoading) return <div className="container py-12 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>;
  if (!r) return <div className="container py-12 text-center text-muted-foreground">Запись не найдена</div>;

  const notes: any = r.notes || {};

  return (
    <div className="container max-w-4xl py-6 space-y-4">
      <Button asChild variant="ghost" size="sm" className="gap-1" data-testid="button-back">
        <Link href="/recordings"><ArrowLeft className="h-4 w-4" /> К списку</Link>
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookMarked className="h-6 w-6" /> {r.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
            <StatusBadge status={r.status} />
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDate(r.recordedAt)}</span>
            {r.durationSec ? <span>⏱ {fmtDuration(r.durationSec)}</span> : null}
          </div>
        </div>
        {r.playbackUrl ? (
          <Button asChild variant="outline" className="gap-1">
            <a href={r.playbackUrl} target="_blank" rel="noreferrer" data-testid="link-playback"><ExternalLink className="h-4 w-4" /> Посмотреть видео</a>
          </Button>
        ) : null}
      </div>

      {r.status !== 'ready' ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          {r.status === 'failed'
            ? <><AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" /><p className="text-red-500">{r.errorMessage}</p></>
            : <><Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" /><p>Идёт обработка... Обновится автоматически.</p></>
          }
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-500" /> Краткое резюме</CardTitle></CardHeader>
            <CardContent><p className="leading-relaxed" data-testid="text-summary">{r.summary}</p></CardContent>
          </Card>

          {Array.isArray(notes.keyPoints) && notes.keyPoints.length ? (
            <Card>
              <CardHeader><CardTitle className="text-base">📌 Ключевые моменты</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 list-disc pl-5">
                  {notes.keyPoints.map((p: string, i: number) => (
                    <li key={i} data-testid={`keypoint-${i}`}>{p}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {Array.isArray(notes.terms) && notes.terms.length ? (
            <Card>
              <CardHeader><CardTitle className="text-base">📚 Термины</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {notes.terms.map((t: any, i: number) => (
                    <div key={i} data-testid={`term-${i}`}>
                      <dt className="font-semibold">{t.term}</dt>
                      <dd className="text-sm text-muted-foreground mt-0.5">{t.def}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {notes.homework ? (
            <Card>
              <CardHeader><CardTitle className="text-base">✏️ Что задано</CardTitle></CardHeader>
              <CardContent><p data-testid="text-homework">{notes.homework}</p></CardContent>
            </Card>
          ) : null}

          {notes.fullNotes ? (
            <Card>
              <CardHeader><CardTitle className="text-base">📖 Конспект</CardTitle></CardHeader>
              <CardContent><MarkdownView source={notes.fullNotes} /></CardContent>
            </Card>
          ) : null}

          {r.transcript ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Полная расшифровка</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowTranscript(!showTranscript)} data-testid="button-toggle-transcript">
                    {showTranscript ? "Скрыть" : "Показать"}
                  </Button>
                </div>
              </CardHeader>
              {showTranscript ? (
                <CardContent><div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground" data-testid="text-transcript">{r.transcript}</div></CardContent>
              ) : null}
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

// Лёгкий рендер Markdown без зависимостей (заголовки, списки, **bold**)
function MarkdownView({ source }: { source: string }) {
  const html = renderMd(source);
  return <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
}
function renderMd(src: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  const flushUl = () => { if (inUl) { out.push("</ul>"); inUl = false; } };
  for (const lineRaw of lines) {
    const line = lineRaw.replace(/\s+$/, "");
    if (/^\s*$/.test(line)) { flushUl(); continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.+)$/))) {
      flushUl();
      const lvl = m[1].length + 1;
      out.push(`<h${lvl}>${inline(esc(m[2]))}</h${lvl}>`);
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${inline(esc(line.replace(/^\s*[-*]\s+/, "")))}</li>`);
    } else {
      flushUl();
      out.push(`<p>${inline(esc(line))}</p>`);
    }
  }
  flushUl();
  return out.join("\n");
  function inline(s: string) {
    return s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }
}
