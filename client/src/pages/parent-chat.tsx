import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice-input-button";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Send, MessageCircle, FileText, AlertCircle, GraduationCap, Receipt } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "вчера";
  return format(d, "d MMM", { locale: ru });
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
}

function FileAttachment({ url }: { url: string }) {
  if (isImageUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img src={url} alt="вложение"
          className="max-w-[220px] max-h-[200px] rounded-lg object-cover border border-white/20" />
      </a>
    );
  }
  const name = decodeURIComponent(url.split("/").pop() || "файл");
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1.5 mt-1 text-[11px] underline opacity-80 hover:opacity-100">
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[180px]">{name}</span>
    </a>
  );
}

interface ParentInfo {
  studentId: string;
  studentName: string;
  subject: string;
  tutorName: string;
}

export default function ParentChatPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("t") || "", []);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Чат с репетитором — Твой Вектор";
  }, []);

  const { data: info, isLoading: infoLoading, error: infoError } = useQuery<ParentInfo>({
    queryKey: ["/api/parent/info", token],
    queryFn: async () => {
      const res = await fetch(`/api/parent/info?t=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error((await res.json()).error || "Ошибка");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<any[]>({
    queryKey: ["/api/parent/messages", token],
    queryFn: async () => {
      const res = await fetch(`/api/parent/messages?t=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error((await res.json()).error || "Ошибка");
      return res.json();
    },
    enabled: !!token && !!info,
    refetchInterval: 8000,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/parent/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, content: text }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Ошибка");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/parent/messages", token] });
    } catch (e: any) {
      toast.error(e.message || "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  if (!token) {
    return (
      <ErrorScreen title="Нет токена доступа" description="Ссылка повреждена. Попросите репетитора прислать новую." />
    );
  }

  if (infoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (infoError || !info) {
    return (
      <ErrorScreen
        title="Ссылка недействительна"
        description={(infoError as any)?.message || "Срок действия ссылки истёк. Попросите репетитора прислать новую."}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/15 text-primary font-semibold">
              {info.tutorName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm leading-tight truncate" data-testid="text-tutor-name">
              {info.tutorName}
            </div>
            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
              <GraduationCap className="h-3 w-3 shrink-0" />
              Ученик: {info.studentName} • {info.subject}
            </div>
          </div>
          <Link href={`/parent/payments?t=${encodeURIComponent(token)}`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 shrink-0"
              data-testid="button-open-payments"
            >
              <Receipt className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Оплаты</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-2">
          {msgsLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!msgsLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MessageCircle className="h-7 w-7 text-primary/60" />
              </div>
              <div className="text-sm font-medium">Начните переписку</div>
              <div className="text-xs text-muted-foreground max-w-sm">
                Напишите репетитору любое сообщение — об успехах ребёнка, расписании или оплате. Ответ придёт сюда же.
              </div>
            </div>
          )}
          {messages.map((msg: any) => {
            // 'tutor' role = from tutor (left). Everything else (student/parent) = from us (right).
            const isFromTutor = msg.role === "tutor";
            return (
              <div
                key={msg.id}
                className={cn("flex items-end gap-1.5", isFromTutor ? "justify-start" : "justify-end")}
                data-testid={`message-${msg.id}`}
              >
                <div className={cn(
                  "max-w-[80%] sm:max-w-[70%] rounded-2xl px-3 py-2 text-sm",
                  isFromTutor
                    ? "bg-muted text-foreground rounded-bl-sm"
                    : "bg-primary text-primary-foreground rounded-br-sm",
                )}>
                  {msg.content && <div className="whitespace-pre-wrap break-words">{msg.content}</div>}
                  {Array.isArray(msg.fileUrls || msg.file_urls) &&
                    (msg.fileUrls || msg.file_urls).map((u: string, i: number) => (
                      <FileAttachment key={i} url={u} />
                    ))}
                  <div className={cn(
                    "text-[10px] mt-0.5 text-right",
                    isFromTutor ? "text-muted-foreground" : "text-primary-foreground/70",
                  )}>
                    {formatMsgTime(msg.createdAt || msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-card/50 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-end gap-2">
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Сообщение репетитору…"
            rows={1}
            className="resize-none min-h-[40px] max-h-[160px]"
            data-testid="input-parent-message"
          />
          <VoiceInputButton
            onTranscript={(t) => setMessage(m => m ? (m.trimEnd() + " " + t) : t)}
            className="shrink-0 h-10 w-10"
            data-testid="button-voice-parent-message"
          />
          <Button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            size="icon"
            className="shrink-0 h-10 w-10"
            data-testid="button-send-parent-message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <div className="text-lg font-semibold" data-testid="text-error-title">{title}</div>
        <div className="text-sm text-muted-foreground" data-testid="text-error-description">{description}</div>
      </div>
    </div>
  );
}
