import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookMarked, ArrowLeft, FileText, Sparkles, Clock, ExternalLink, Mic } from "lucide-react";
import type { LessonRecording } from "@shared/schema";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Ошибка");
  return res.json();
}

function fmt(d?: string | Date | null) {
  return d ? new Date(d).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" }) : "—";
}
function dur(s?: number | null) {
  if (!s) return null;
  const m = Math.floor(s / 60), r = s % 60;
  return `${m} мин ${r.toString().padStart(2, "0")} сек`;
}

export default function StudentRecordings({ id }: { id?: string }) {
  if (id) return <Detail id={id} />;
  return <List />;
}

function List() {
  const { data: list = [], isLoading } = useQuery<LessonRecording[]>({
    queryKey: ["student-recordings"],
    queryFn: () => fetchJson("/api/student/recordings"),
  });

  return (
    <div className="container max-w-3xl py-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Mic className="h-5 w-5" /> Конспекты уроков</h1>
        <p className="text-sm text-muted-foreground mt-1">Краткое содержание ваших занятий с ключевыми моментами и заданиями.</p>
      </div>
      {isLoading ? (
        <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
      ) : list.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <BookMarked className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Конспектов пока нет. Они появятся после того, как репетитор расшифрует запись урока.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {list.map(r => (
            <Card key={r.id} className="hover-elevate" data-testid={`card-rec-${r.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{r.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(r.recordedAt)}</span>
                      {dur(r.durationSec) ? <span>⏱ {dur(r.durationSec)}</span> : null}
                    </div>
                    {r.summary ? <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">{r.summary}</p> : null}
                  </div>
                  <Button asChild size="sm" data-testid={`button-open-${r.id}`}>
                    <Link href={`/student/recording/${r.id}`}>Открыть</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ id }: { id: string }) {
  const [showT, setShowT] = useState(false);
  const { data: r, isLoading } = useQuery<LessonRecording>({
    queryKey: ["student-recordings", id],
    queryFn: () => fetchJson(`/api/student/recordings/${id}`),
  });
  if (isLoading) return <div className="container py-12 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>;
  if (!r) return <div className="container py-12 text-center text-muted-foreground">Конспект не найден</div>;
  const notes: any = r.notes || {};

  return (
    <div className="container max-w-3xl py-4 space-y-4">
      <Button asChild variant="ghost" size="sm" className="gap-1">
        <Link href="/student/recordings"><ArrowLeft className="h-4 w-4" /> К списку</Link>
      </Button>
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><BookMarked className="h-5 w-5" /> {r.title}</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(r.recordedAt)}</span>
          {dur(r.durationSec) ? <span>⏱ {dur(r.durationSec)}</span> : null}
          {r.playbackUrl ? (
            <a className="flex items-center gap-1 text-primary hover:underline" href={r.playbackUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3" /> Видео урока
            </a>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-500" /> Краткое резюме</CardTitle></CardHeader>
        <CardContent><p className="leading-relaxed">{r.summary}</p></CardContent>
      </Card>

      {Array.isArray(notes.keyPoints) && notes.keyPoints.length ? (
        <Card>
          <CardHeader><CardTitle className="text-base">📌 Ключевые моменты</CardTitle></CardHeader>
          <CardContent><ul className="space-y-2 list-disc pl-5">{notes.keyPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></CardContent>
        </Card>
      ) : null}

      {Array.isArray(notes.terms) && notes.terms.length ? (
        <Card>
          <CardHeader><CardTitle className="text-base">📚 Термины</CardTitle></CardHeader>
          <CardContent><dl className="space-y-3">{notes.terms.map((t: any, i: number) => (
            <div key={i}><dt className="font-semibold">{t.term}</dt><dd className="text-sm text-muted-foreground mt-0.5">{t.def}</dd></div>
          ))}</dl></CardContent>
        </Card>
      ) : null}

      {notes.homework ? (
        <Card>
          <CardHeader><CardTitle className="text-base">✏️ Домашнее задание</CardTitle></CardHeader>
          <CardContent><p>{notes.homework}</p></CardContent>
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
              <Button variant="ghost" size="sm" onClick={() => setShowT(!showT)}>{showT ? "Скрыть" : "Показать"}</Button>
            </div>
          </CardHeader>
          {showT ? <CardContent><div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">{r.transcript}</div></CardContent> : null}
        </Card>
      ) : null}
    </div>
  );
}

function MarkdownView({ source }: { source: string }) {
  return <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: render(source) }} />;
}
function render(src: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
  const out: string[] = [];
  let inUl = false; const flush = () => { if (inUl) { out.push("</ul>"); inUl = false; } };
  for (const l of src.split(/\r?\n/)) {
    if (/^\s*$/.test(l)) { flush(); continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.+)$/))) { flush(); out.push(`<h${m[1].length+1}>${inline(esc(m[2]))}</h${m[1].length+1}>`); }
    else if (/^\s*[-*]\s+/.test(l)) { if (!inUl) { out.push("<ul>"); inUl = true; } out.push(`<li>${inline(esc(l.replace(/^\s*[-*]\s+/, "")))}</li>`); }
    else { flush(); out.push(`<p>${inline(esc(l))}</p>`); }
  }
  flush();
  return out.join("\n");
}
