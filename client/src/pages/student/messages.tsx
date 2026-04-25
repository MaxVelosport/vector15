import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice-input-button";
import { Loader2, Send, MessageCircle, Paperclip, X, Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "tutor" | "student";
  content: string;
  fileUrls?: string[];
  createdAt: string;
  isRead: boolean;
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
}

function FileAttachment({ url, isMine }: { url: string; isMine: boolean }) {
  if (isImageUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={url}
          alt="вложение"
          className="max-w-[220px] max-h-[200px] rounded-lg object-cover border border-white/20 cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }
  const name = decodeURIComponent(url.split("/").pop() || "файл");
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 mt-1 text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[180px]">{name}</span>
    </a>
  );
}

export default function StudentMessages() {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["student-messages"],
    queryFn: async () => {
      const res = await fetch("/api/student/messages", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useMutation({
    mutationFn: async ({ content, fileUrls }: { content: string; fileUrls: string[] }) => {
      const res = await fetch("/api/student/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, fileUrls }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-messages"] });
      setText("");
      setPendingFiles([]);
    },
    onError: () => toast.error("Ошибка при отправке"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/student/messages/${messageId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-messages"] });
    },
    onError: () => toast.error("Не удалось удалить сообщение"),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPendingFiles((prev) => [...prev, ...(data.urls || [])]);
    } catch {
      toast.error("Ошибка загрузки файлов");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    if (!text.trim() && pendingFiles.length === 0) return;
    send.mutate({ content: text.trim(), fileUrls: pendingFiles });
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4" style={{ height: "calc(100vh - 180px)" }}>
      <div className="flex items-start gap-2 rounded-xl bg-blue-500/5 border border-blue-500/10 px-4 py-2.5">
        <MessageCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Напишите репетитору вопрос или уточнение по домашнему заданию. Репетитор увидит сообщение и ответит.
          <span className="font-medium text-foreground"> Прикрепляйте файлы или фото</span> если нужно показать задание.
        </p>
      </div>
      <Card className="rounded-2xl border-border/40 flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Чат с репетитором</span>
        </div>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Здесь будут ваши сообщения с репетитором</p>
              <p className="text-xs mt-1">Задайте вопрос или напишите что-нибудь</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMine = msg.role === "student";
            const isHovered = hoveredMsgId === msg.id;
            return (
              <div
                key={msg.id}
                className={cn("flex items-end gap-1.5", isMine ? "justify-end" : "justify-start")}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                data-testid={`message-${msg.id}`}
              >
                {isMine && (
                  <button
                    onClick={() => deleteMutation.mutate(msg.id)}
                    className={cn(
                      "shrink-0 p-1 rounded-full text-muted-foreground hover:text-destructive transition-all",
                      isHovered ? "opacity-100" : "opacity-0"
                    )}
                    title="Удалить сообщение"
                    data-testid={`button-delete-message-${msg.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.content && (
                    <div className="leading-relaxed">{msg.content}</div>
                  )}
                  {msg.fileUrls?.map((url, i) => (
                    <FileAttachment key={i} url={url} isMine={isMine} />
                  ))}
                  <div className={cn("text-[10px] mt-1 opacity-60", isMine ? "text-right" : "")}>
                    {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    {" "}
                    {new Date(msg.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </CardContent>

        {/* Pending files preview */}
        {pendingFiles.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-2 border-t border-border/40 pt-2">
            {pendingFiles.map((url, i) => (
              <div key={i} className="relative group">
                {isImageUrl(url) ? (
                  <img src={url} alt="" className="h-14 w-14 object-cover rounded-lg border border-border/50" />
                ) : (
                  <div className="h-14 w-14 flex flex-col items-center justify-center rounded-lg border border-border/50 bg-muted text-muted-foreground">
                    <FileText className="h-5 w-5" />
                    <span className="text-[9px] mt-0.5 px-1 truncate w-full text-center">
                      {decodeURIComponent(url.split("/").pop() || "файл").slice(0, 8)}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`button-remove-file-${i}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-border/40 flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*"
            className="hidden"
            onChange={handleUpload}
            data-testid="input-file-upload"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Прикрепить файл"
            data-testid="button-attach-file"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Написать сообщение..."
            rows={2}
            className="resize-none text-sm"
            data-testid="input-chat-message"
          />
          <VoiceInputButton
            onTranscript={(t) => setText(m => m ? (m.trimEnd() + " " + t) : t)}
            className="shrink-0 h-9 w-9 self-end"
            data-testid="button-voice-student-message"
          />
          <Button
            onClick={handleSend}
            disabled={(!text.trim() && pendingFiles.length === 0) || send.isPending}
            className="self-end"
            data-testid="button-send-message"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}
