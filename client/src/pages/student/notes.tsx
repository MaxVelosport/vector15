import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, StickyNote, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function StudentNotes() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");

  const { data: note, isLoading } = useQuery<{ content: string }>({
    queryKey: ["student-notes"],
    queryFn: async () => {
      const res = await fetch("/api/student/notes", { credentials: "include" });
      if (!res.ok) return { content: "" };
      return res.json();
    },
  });

  useEffect(() => {
    if (note && !dirty) {
      setContent(note.content ?? "");
      lastSaved.current = note.content ?? "";
    }
  }, [note, dirty]);

  const save = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/student/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: (_, text) => {
      queryClient.invalidateQueries({ queryKey: ["student-notes"] });
      setDirty(false);
      lastSaved.current = text;
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2500);
    },
    onError: () => {
      setAutoSaveStatus("idle");
      toast.error("Ошибка при сохранении");
    },
  });

  const handleChange = (value: string) => {
    setContent(value);
    setDirty(true);
    setAutoSaveStatus("idle");

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (value !== lastSaved.current) {
        setAutoSaveStatus("saving");
        save.mutate(value);
      }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-start gap-2 rounded-xl bg-blue-500/5 border border-blue-500/10 px-4 py-2.5">
        <StickyNote className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Записывайте вопросы к репетитору, конспекты и важные моменты с занятий.{" "}
          <span className="font-medium text-foreground">Заметки видны только вам</span> — репетитор не имеет к ним доступа.
          Данные сохраняются автоматически через 1.5 сек после остановки печати.
        </p>
      </div>
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <StickyNote className="h-4 w-4 text-amber-500" />
              Личные заметки
            </CardTitle>
            <div className="flex items-center gap-2">
              {autoSaveStatus === "saving" && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground animate-pulse">
                  <Clock className="h-3 w-3" />
                  Сохранение...
                </span>
              )}
              {autoSaveStatus === "saved" && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Сохранено
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Записывайте что угодно: вопросы к репетитору, идеи, конспекты</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Начните писать..."
            rows={16}
            className="resize-y font-mono text-sm leading-relaxed"
            data-testid="textarea-student-notes"
          />
          <div className="flex items-center gap-2">
            <Button
              className="flex-1 gap-2"
              onClick={() => {
                setAutoSaveStatus("saving");
                save.mutate(content);
              }}
              disabled={!dirty || save.isPending}
              data-testid="button-save-notes"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Сохранить сейчас
            </Button>
            {dirty && autoSaveStatus === "idle" && (
              <span className="text-[11px] text-muted-foreground">
                Несохранённые изменения
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
