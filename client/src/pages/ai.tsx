import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { fireFirstTimeAction } from "@/lib/confetti";
import { usePaymentResult } from "@/hooks/use-payment-result";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageTabs } from "@/components/page-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelPickerButton } from "@/components/model-picker-dialog";
import { AiUsageMonitorButton } from "@/components/ai-usage-monitor";
import {
  Bot,
  Send,
  Loader2,
  User,
  Plus,
  Trash2,
  MessageSquare,
  Paperclip,
  X,
  Sparkles,
  BookOpen,
  FileText,
  GraduationCap,
  ClipboardList,
  PanelRightOpen,
  PanelRightClose,
  Image as ImageIcon,
  Info,
  Lightbulb,
  Target,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useAuth } from "@/hooks/use-auth";
import { useStudents } from "@/hooks/use-tutor-data";

import { useDocumentTitle } from "@/hooks/use-document-title";
interface TutorAiChat {
  id: string;
  tutorId: string;
  title: string;
  context?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
  createdAt: string;
}

interface AiModel {
  id: string;
  name: string;
  usage: number;
  limit: number;
  available: boolean;
}

interface AiConfig {
  models: AiModel[];
  defaultModel: string;
  packageBalance?: number;
}

const MAX_CHATS = 30;

const QUICK_ACTIONS = [
  {
    icon: BookOpen,
    label: "План урока",
    prompt: "Составь подробный план урока на 60 минут по теме: ",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: FileText,
    label: "Домашнее задание",
    prompt: "Составь домашнее задание из 5 задач разной сложности по теме: ",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    icon: ClipboardList,
    label: "Контрольная",
    prompt: "Составь контрольную работу на 45 минут с вариантами A и B по теме: ",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  {
    icon: Lightbulb,
    label: "Объяснение темы",
    prompt: "Объясни тему простым языком с примерами и аналогиями: ",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: Target,
    label: "Подготовка к ЕГЭ",
    prompt: "Составь тренировочные задания для подготовки к ЕГЭ по теме: ",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: GraduationCap,
    label: "Методика",
    prompt: "Посоветуй эффективные методы преподавания темы: ",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
];

function ChatMessageBubble({ msg }: { msg: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2.5 group ${msg.role === "user" ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {msg.role === "assistant" && (
        <Avatar className="h-7 w-7 shrink-0 mt-1">
          <AvatarFallback className="bg-blue-500 text-white">
            <Bot className="w-3.5 h-3.5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div className="flex flex-col gap-1 max-w-[80%]">
        <div className={cn(
          "rounded-2xl px-3.5 py-2.5",
          msg.role === "user"
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        )}>
          {msg.imageUrl && (
            <img
              src={msg.imageUrl}
              alt="Прикреплённое изображение"
              className="max-w-full max-h-48 rounded-lg mb-2 cursor-pointer"
              onClick={() => window.open(msg.imageUrl!, "_blank")}
            />
          )}
          {msg.role === "assistant" ? (
            <MarkdownRenderer content={msg.content} className="text-sm" />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
          )}
        </div>
        {msg.role === "assistant" && (
          <div className={cn("flex items-center gap-1 transition-opacity", hovered ? "opacity-100" : "opacity-0")}>
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              title="Скопировать"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        )}
      </div>
      {msg.role === "user" && (
        <Avatar className="h-7 w-7 shrink-0 mt-1">
          <AvatarFallback className="bg-muted">
            <User className="w-3.5 h-3.5" />
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
}

export default function AIPage() {
  useDocumentTitle("ИИ-помощник");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  usePaymentResult({
    param: "purchase",
    successMessage: "AI-пакет оплачен! Кредиты будут зачислены в течение нескольких секунд.",
    failMessage: "Оплата не прошла. Попробуйте ещё раз или используйте другую карту.",
    successAction: () => queryClient.invalidateQueries({ queryKey: ["tutor-ai-config"] }),
  });
  const { data: studentsData } = useStudents();
  const students = useMemo(() => studentsData ?? [], [studentsData]);
  const activeStudents = students.filter((s) => s.isActive);

  const [chatInput, setChatInput] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: aiConfig } = useQuery<AiConfig>({
    queryKey: ["tutor-ai-config"],
    queryFn: async () => {
      const res = await fetch("/api/ai/config", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
  });

  useEffect(() => {
    if (aiConfig?.defaultModel && !selectedModel) {
      setSelectedModel(aiConfig.defaultModel);
    }
  }, [aiConfig?.defaultModel]);

  const { data: chats = [], refetch: refetchChats } = useQuery<TutorAiChat[]>({
    queryKey: ["tutor-chats"],
    queryFn: async () => {
      const res = await fetch("/api/ai/chats", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
  });

  useEffect(() => {
    if (chats.length > 0 && !activeChatId) {
      const sorted = [...chats].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setActiveChatId(sorted[0].id);
    }
  }, [chats]);

  const { data: messages = [], refetch: refetchMessages } = useQuery<ChatMessage[]>({
    queryKey: ["tutor-chat-messages", activeChatId],
    queryFn: async () => {
      if (!activeChatId) return [];
      const res = await fetch(`/api/ai/chats/${activeChatId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
    enabled: !!activeChatId,
  });

  const createChat = useMutation({
    mutationFn: async (opts?: { title?: string; context?: string }) => {
      const res = await fetch("/api/ai/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(opts || {}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ошибка создания чата");
      }
      return res.json();
    },
    onSuccess: (chat: TutorAiChat) => {
      setActiveChatId(chat.id);
      refetchChats();
      setSidebarOpen(false);
      setIsCreatingChat(false);
    },
    onError: (error: Error) => {
      setIsCreatingChat(false);
      toast.error(error.message);
    },
  });

  const deleteChat = useMutation({
    mutationFn: async (chatId: string) => {
      const res = await fetch(`/api/ai/chats/${chatId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Ошибка удаления");
      return res.json();
    },
    onSuccess: (_: any, chatId: string) => {
      if (activeChatId === chatId) setActiveChatId(null);
      refetchChats();
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (data: { message: string; imageBase64?: string; model?: string; chatId?: string; studentContext?: string }) => {
      const targetChatId = data.chatId || activeChatId;
      if (!targetChatId) throw new Error("Нет активного чата");
      const { chatId: _, ...sendData } = data;
      const res = await fetch(`/api/ai/chats/${targetChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sendData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ошибка отправки");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchMessages();
      refetchChats();
      queryClient.invalidateQueries({ queryKey: ["tutor-ai-config"] });
      fireFirstTimeAction("ai-chat", "big");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processImageFile(file);
        break;
      }
    }
  }, []);

  const processImageFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Максимальный размер изображения — 5 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPendingImage(base64);
      setPendingImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImageFile(file);
    }
    e.target.value = "";
  };

  const getStudentContext = () => {
    if (!selectedStudentId) return undefined;
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return undefined;
    return `Ученик: ${student.name}, класс: ${student.grade}, предмет: ${student.subject}${student.goal ? `, цель: ${student.goal}` : ""}${student.curriculumTopic ? `, текущая тема: ${student.curriculumTopic}` : ""}`;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const messageText = chatInput.trim();
    const imageToSend = pendingImage;
    if (!messageText && !imageToSend) return;
    if (sendMessage.isPending || isCreatingChat) return;

    setChatInput("");
    setPendingImage(null);
    setPendingImagePreview(null);
    if (inputRef.current) {
      inputRef.current.style.height = "36px";
    }

    if (!activeChatId) {
      setIsCreatingChat(true);
      try {
        const chat = await createChat.mutateAsync({
          title: messageText.substring(0, 40) || "Новый чат",
        });
        sendMessage.mutate({
          chatId: chat.id,
          message: messageText || "Посмотри на изображение",
          imageBase64: imageToSend || undefined,
          model: selectedModel || undefined,
          studentContext: getStudentContext(),
        });
      } catch {
        setChatInput(messageText);
        setPendingImage(imageToSend);
        setPendingImagePreview(imageToSend);
      }
      return;
    }

    sendMessage.mutate({
      message: messageText || "Посмотри на изображение",
      imageBase64: imageToSend || undefined,
      model: selectedModel || undefined,
      studentContext: getStudentContext(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleNewChat = () => {
    if (isCreatingChat || createChat.isPending || isAtLimit) return;
    setActiveChatId(null);
    setSidebarOpen(false);
  };

  const handleQuickAction = (prompt: string) => {
    setChatInput(prompt);
    inputRef.current?.focus();
  };

  const chatCount = chats.length;
  const isAtLimit = chatCount >= MAX_CHATS;
  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <DashboardLayout title="ИИ-помощник" subtitle="Генерация заданий, планирование уроков">
      <PageTabs
        tabs={[
          { label: "Чат с ИИ", path: "/ai" },
          { label: "Задачник", path: "/tasks" },
        ]}
      />
      <div className="flex flex-col h-[calc(100vh-140px)] min-h-[400px]">
        <div className="page-hint-banner mb-3" data-testid="hint-ai">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">ИИ-помощник.</span> Генерируйте планы уроков, задания, контрольные и объяснения за секунды. Выберите ученика для персонализации, прикрепите фото работы для анализа. Поддержка LaTeX и Markdown.{" "}
            <a href="/help" className="text-primary underline underline-offset-2 hover:no-underline">Советы по ИИ →</a>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                ИИ-помощник
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeChat ? activeChat.title : "Помощь с уроками, домашкой и методикой"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeStudents.length > 0 && (
                <Select value={selectedStudentId || "_none"} onValueChange={(v) => setSelectedStudentId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Контекст ученика" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Без контекста</SelectItem>
                    {activeStudents.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {s.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {aiConfig && aiConfig.models.length > 0 && (
                <>
                  <ModelPickerButton
                    models={aiConfig.models}
                    selectedModel={selectedModel}
                    onSelectModel={setSelectedModel}
                    packageBalance={aiConfig.packageBalance || 0}
                  />
                  <AiUsageMonitorButton
                    models={aiConfig.models}
                    packageBalance={aiConfig.packageBalance || 0}
                    variant="tutor"
                    onBuyPackage={() => window.location.href = "/subscription"}
                  />
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                <span className="hidden sm:inline">Чаты</span>
                {chatCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">{chatCount}</Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 gap-3 overflow-hidden">
          <Card className="flex-1 flex flex-col rounded-2xl border-border/50 overflow-hidden">
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <ScrollArea className="flex-1 px-4 pt-4">
                <div className="space-y-4 pb-4">
                  {!activeChatId && messages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="py-6"
                    >
                      <div className="text-center mb-6">
                        <div className="flex items-center justify-center mb-4">
                          <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl" />
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-600">
                              <Bot className="h-8 w-8 text-white" />
                            </div>
                          </div>
                        </div>
                        <h2 className="text-lg font-bold mb-1">ИИ-помощник репетитора</h2>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          Помогаю планировать уроки, составлять задания, объяснять темы и готовить учеников к экзаменам
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-xl mx-auto mb-6">
                        {QUICK_ACTIONS.map((action) => {
                          const Icon = action.icon;
                          return (
                            <button
                              key={action.label}
                              onClick={() => handleQuickAction(action.prompt)}
                              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors text-center"
                            >
                              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", action.bg)}>
                                <Icon className={cn("h-4 w-4", action.color)} />
                              </div>
                              <span className="text-xs font-medium">{action.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="p-4 rounded-xl bg-muted/30 border border-border/30 max-w-xl mx-auto">
                        <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                          Возможности
                        </h3>
                        <ul className="text-xs text-muted-foreground space-y-1.5">
                          <li>Планирование уроков с таймингом и активностями</li>
                          <li>Генерация домашних заданий и контрольных работ с решениями</li>
                          <li>Объяснение тем простым языком с примерами</li>
                          <li>Анализ фото работ учеников — загрузите через скрепку или <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Ctrl+V</kbd></li>
                          <li>Подбор контекста ученика для персонализированных материалов</li>
                          <li>Формулы LaTeX и Markdown-форматирование</li>
                        </ul>
                      </div>
                    </motion.div>
                  )}

                  {messages.map((msg) => (
                    <ChatMessageBubble key={msg.id} msg={msg} />
                  ))}

                  {sendMessage.isPending && (
                    <div className="flex gap-2.5 justify-start">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-blue-500 text-white">
                          <Bot className="w-3.5 h-3.5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          <span className="text-xs text-muted-foreground">Генерирую ответ...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <AnimatePresence>
                {pendingImagePreview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 pb-1"
                  >
                    <div className="relative inline-block">
                      <img src={pendingImagePreview} alt="Превью" className="h-16 rounded-lg border" />
                      <button
                        onClick={() => { setPendingImage(null); setPendingImagePreview(null); }}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-3 border-t border-border/50">
                <form onSubmit={handleSubmit} className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9"
                    onClick={() => fileInputRef.current?.click()}
                    title="Прикрепить изображение"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <textarea
                    ref={inputRef}
                    placeholder="Напишите запрос... (Ctrl+V для вставки фото)"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                    disabled={sendMessage.isPending}
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[36px] max-h-[120px]"
                    onInput={(e) => {
                      const t = e.currentTarget;
                      t.style.height = "36px";
                      t.style.height = Math.min(t.scrollHeight, 120) + "px";
                    }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="shrink-0 h-9 w-9 rounded-xl"
                    disabled={sendMessage.isPending || isCreatingChat || (!chatInput.trim() && !pendingImage)}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 260 }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Card className="h-full rounded-2xl border-border/50">
                  <CardContent className="p-3 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Чаты</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={handleNewChat}
                        disabled={isAtLimit}
                        title={isAtLimit ? `Достигнут лимит ${MAX_CHATS} чатов. Удалите старые чаты, чтобы создать новый.` : undefined}
                      >
                        <Plus className="h-3 w-3" />
                        Новый
                      </Button>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="space-y-1">
                        {chats.map((chat) => (
                          <div
                            key={chat.id}
                            className={cn(
                              "group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors",
                              activeChatId === chat.id
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted"
                            )}
                            onClick={() => {
                              setActiveChatId(chat.id);
                              setSidebarOpen(false);
                            }}
                          >
                            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{chat.title}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(chat.updatedAt), "d MMM, HH:mm", { locale: ru })}
                              </p>
                            </div>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChat.mutate(chat.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        ))}
                        {chats.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Нет чатов. Начните диалог!
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}
