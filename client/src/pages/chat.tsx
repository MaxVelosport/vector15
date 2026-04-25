import { useState, useEffect, useRef, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useStudents, useDirectMessages, useSendDirectMessage, useDeleteDirectMessage } from "@/hooks/use-tutor-data";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice-input-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Search, Send, MessageCircle, Loader2, Paperclip, X, Trash2, FileText, Mail, Megaphone, Users, ChevronLeft } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

import { useDocumentTitle } from "@/hooks/use-document-title";
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

export default function ChatPage() {
  useDocumentTitle("Чат");
  const { data: students = [] } = useStudents();
  const [tab, setTab] = useState<"chat" | "broadcast">("chat");
  const [, params] = window.location.search ? [null, new URLSearchParams(window.location.search)] : [null, null];
  const initialStudentId = params?.get("studentId") || "";
  const [selectedId, setSelectedId] = useState<string>(initialStudentId);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(!!initialStudentId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Broadcast state
  const activeStudents = useMemo(() => (students as any[]).filter((s: any) => s.isActive), [students]);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const toggleRecipient = (id: string) => setSelectedRecipients(p => p.includes(id) ? p.filter(r => r !== id) : [...p, id]);
  const selectAll = () => setSelectedRecipients(selectedRecipients.length === activeStudents.length ? [] : activeStudents.map((s: any) => s.id));
  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) { toast.error("Введите сообщение"); return; }
    if (selectedRecipients.length === 0) { toast.error("Выберите получателей"); return; }
    setIsSending(true);
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ studentIds: selectedRecipients, message: broadcastMsg }),
      });
      if (res.ok) { toast.success(`Отправлено ${selectedRecipients.length} получателям`); setBroadcastMsg(""); setSelectedRecipients([]); }
      else { const d = await res.json(); toast.error(d.error || "Ошибка отправки"); }
    } catch { toast.error("Ошибка отправки"); }
    finally { setIsSending(false); }
  };

  const { data: summary = {} } = useQuery<Record<string, { unread: number; lastMessage: any }>>({
    queryKey: ["/api/direct-messages-summary"],
    refetchInterval: 8000,
  });

  const { data: messages = [], isLoading: loadingMsgs } = useDirectMessages(selectedId);
  const sendMsg = useSendDirectMessage(selectedId);
  const deleteMsg = useDeleteDirectMessage(selectedId);

  const filtered = (students as any[])
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.subject?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ua = summary[a.id]?.unread || 0;
      const ub = summary[b.id]?.unread || 0;
      if (ub !== ua) return ub - ua;
      const ta = summary[a.id]?.lastMessage?.createdAt || "";
      const tb = summary[b.id]?.lastMessage?.createdAt || "";
      return tb.localeCompare(ta);
    });

  const selected = (students as any[]).find((s) => s.id === selectedId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    if ((!message.trim() && pendingFiles.length === 0) || !selectedId) return;
    sendMsg.mutate(
      { content: message.trim(), fileUrls: pendingFiles },
      {
        onSuccess: () => {
          setMessage("");
          setPendingFiles([]);
        },
        onError: () => toast.error("Ошибка отправки"),
      }
    );
  };

  const handleDelete = (msgId: string) => {
    deleteMsg.mutate(msgId, {
      onError: () => toast.error("Не удалось удалить сообщение"),
    });
  };

  const lastPreview = (info: any, s: any) => {
    const last = info?.lastMessage;
    if (!last) return s.subject || "Нет сообщений";
    const prefix = last.role === "tutor" ? "Вы: " : "";
    if (last.fileUrls?.length > 0 && !last.content) return prefix + "📎 Файл";
    return prefix + last.content;
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100svh-11rem)] sm:h-[calc(100svh-9rem)] lg:h-[calc(100svh-6rem)] overflow-hidden rounded-xl border border-border/50 bg-card">
        {/* Left panel */}
        <div className={cn(
          "shrink-0 flex flex-col border-r border-border/50",
          mobileShowChat ? "hidden sm:flex sm:w-64" : "flex w-full sm:w-64"
        )}>
          {/* Tab switcher */}
          <div className="flex border-b border-border/50 shrink-0">
            <button
              onClick={() => setTab("chat")}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors", tab === "chat" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground")}
              data-testid="tab-chat"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Чаты
            </button>
            <button
              onClick={() => setTab("broadcast")}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors", tab === "broadcast" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground")}
              data-testid="tab-broadcast"
            >
              <Megaphone className="h-3.5 w-3.5" /> Рассылки
            </button>
          </div>
          {tab === "chat" && (
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Поиск ученика..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
                data-testid="input-chat-search"
              />
            </div>
          </div>
          )}
          {tab === "chat" && (
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8 px-4">Ученики не найдены</p>
              )}
              {filtered.map((s: any) => {
                const info = summary[s.id];
                const unread = info?.unread || 0;
                const last = info?.lastMessage;
                const isActive = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedId(s.id); setMobileShowChat(true); }}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 border-b border-border/30",
                      isActive && "bg-primary/5 hover:bg-primary/5"
                    )}
                    data-testid={`button-chat-student-${s.id}`}
                  >
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                        {s.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn("text-sm font-medium truncate", isActive && "text-primary")}>{s.name}</span>
                        {last && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatMsgTime(last.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[11px] text-muted-foreground truncate">
                          {lastPreview(info, s)}
                        </span>
                        {unread > 0 && (
                          <Badge className="h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground shrink-0">
                            {unread}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {tab === "broadcast" && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 py-2 flex items-center justify-between border-b border-border/30">
                <span className="text-xs text-muted-foreground">Получатели ({selectedRecipients.length})</span>
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="text-xs text-primary hover:underline" data-testid="button-broadcast-select-all">
                    {selectedRecipients.length === activeStudents.length ? "Снять все" : "Все"}
                  </button>
                  <button
                    onClick={() => setMobileShowChat(true)}
                    className="sm:hidden text-xs text-primary font-medium hover:underline"
                    data-testid="button-broadcast-compose"
                  >
                    Написать →
                  </button>
                </div>
              </div>
              {activeStudents.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8 px-4">Нет активных учеников</p>
              )}
              {activeStudents.map((s: any) => (
                <div
                  key={s.id}
                  onClick={() => toggleRecipient(s.id)}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 border-b border-border/30 cursor-pointer"
                  data-testid={`recipient-row-${s.id}`}
                >
                  <Checkbox
                    checked={selectedRecipients.includes(s.id)}
                    onCheckedChange={() => toggleRecipient(s.id)}
                    data-testid={`checkbox-recipient-${s.id}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.subject}</div>
                  </div>
                  {s.email && <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          !mobileShowChat && "hidden sm:flex"
        )}>
          {tab === "broadcast" ? (
            <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="sm:hidden flex items-center justify-center h-7 w-7 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground shrink-0"
                  data-testid="button-broadcast-back"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <Megaphone className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">Новая рассылка</div>
                  <div className="text-xs text-muted-foreground">Сообщение придёт в чат выбранным ученикам</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Шаблоны</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Напоминание о занятии", text: "Напоминаю о нашем занятии завтра в..." },
                    { label: "Домашнее задание", text: "Прикрепляю домашнее задание по нашей теме..." },
                    { label: "Изменение расписания", text: "Обращаю внимание на изменения в расписании..." },
                  ].map((t, i) => (
                    <button key={i} onClick={() => setBroadcastMsg(t.text)}
                      className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors text-left"
                      data-testid={`button-template-${i}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <div className="text-sm font-medium">Текст сообщения</div>
                <div className="relative flex-1 min-h-[140px]">
                  <Textarea
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    placeholder="Напишите сообщение для рассылки..."
                    className="resize-none h-full min-h-[140px] pr-12"
                    data-testid="input-broadcast-message"
                  />
                  <VoiceInputButton
                    onTranscript={(t) => setBroadcastMsg(m => m ? (m.trimEnd() + " " + t) : t)}
                    className="absolute bottom-2 right-2"
                    data-testid="button-voice-broadcast"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-border/50">
                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {selectedRecipients.length === 0 ? "Выберите получателей слева" : `${selectedRecipients.length} получател${selectedRecipients.length === 1 ? "ь" : selectedRecipients.length < 5 ? "я" : "ей"}`}
                </div>
                <Button
                  onClick={sendBroadcast}
                  disabled={isSending || !broadcastMsg.trim() || selectedRecipients.length === 0}
                  className="gap-2"
                  data-testid="button-send-broadcast"
                >
                  <Send className="h-4 w-4" />
                  {isSending ? "Отправка..." : "Отправить"}
                </Button>
              </div>
            </div>
          ) : !selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <MessageCircle className="h-8 w-8 text-primary/60" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Выберите ученика</p>
                <p className="text-sm text-muted-foreground mt-1">Нажмите на ученика слева, чтобы открыть переписку</p>
              </div>
              <div className="w-full max-w-sm rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2.5">
                <p className="text-xs font-medium text-foreground">Что можно делать в чате:</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2"><span className="text-primary mt-0.5">→</span><span>Переписываться с учениками напрямую — текст, файлы, изображения</span></div>
                  <div className="flex items-start gap-2"><span className="text-primary mt-0.5">→</span><span>Вкладка <strong className="text-foreground">Рассылки</strong> — отправить одно сообщение сразу нескольким ученикам</span></div>
                  <div className="flex items-start gap-2"><span className="text-primary mt-0.5">→</span><span>Прикрепить домашнее задание, план урока или любой документ</span></div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3">
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="sm:hidden flex items-center justify-center h-7 w-7 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground shrink-0"
                  data-testid="button-chat-back"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                    {selected?.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold leading-tight">{selected?.name}</p>
                  <p className="text-[11px] text-muted-foreground">{selected?.subject}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingMsgs && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!loadingMsgs && (messages as any[]).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Нет сообщений. Напишите первым!
                  </p>
                )}
                {(messages as any[]).map((msg: any) => {
                  const isMine = msg.role === "tutor";
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
                          onClick={() => handleDelete(msg.id)}
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
                      <div className={cn(
                        "max-w-[70%] rounded-2xl px-3 py-2 text-sm",
                        isMine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      )}>
                        {!isMine && msg.role === "parent" && (
                          <div className="text-[10px] font-semibold mb-0.5 text-primary/80 flex items-center gap-1">
                            <Users className="h-2.5 w-2.5" /> Родитель
                          </div>
                        )}
                        {msg.content && (
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        )}
                        {msg.fileUrls?.map((url: string, i: number) => (
                          <FileAttachment key={i} url={url} />
                        ))}
                        <div className="text-[10px] opacity-60 mt-0.5 text-right">
                          {format(new Date(msg.createdAt), "HH:mm")}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Pending files preview */}
              {pendingFiles.length > 0 && (
                <div className="px-3 pb-1 flex flex-wrap gap-2">
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

              <div className="p-3 border-t border-border/50 flex gap-2 items-end">
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
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Написать ${selected?.name || "ученику"}...`}
                  rows={2}
                  className="resize-none text-sm flex-1"
                  data-testid="input-chat-message"
                />
                <VoiceInputButton
                  onTranscript={(t) => setMessage(m => m ? (m.trimEnd() + " " + t) : t)}
                  className="shrink-0 h-9 w-9"
                  data-testid="button-voice-chat-message"
                />
                <Button
                  size="icon"
                  disabled={(!message.trim() && pendingFiles.length === 0) || sendMsg.isPending}
                  onClick={handleSend}
                  data-testid="button-send-chat-message"
                >
                  {sendMsg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
