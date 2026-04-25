import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AI_PACKAGE_OPTIONS } from "@shared/schema";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoiceInputButton } from "@/components/voice-input-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
  Sparkles,
  BookOpen,
  HelpCircle,
  Image as ImageIcon,
  PanelRightOpen,
  PanelRightClose,
  Package,
  ShoppingCart,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface AiChat {
  id: string;
  studentId: string;
  homeworkId?: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  chatId?: string;
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

interface StudentAiChatProps {
  studentSubject: string;
  activeHomeworkId?: string;
  onClearHomework?: () => void;
}

const MAX_CHATS = 20;

function StudentChatBubble({ msg }: { msg: ChatMessage }) {
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
      className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
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

export default function StudentAiChat({ studentSubject, activeHomeworkId, onClearHomework }: StudentAiChatProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chatInput, setChatInput] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [showAiPackageDialog, setShowAiPackageDialog] = useState(false);
  const [selectedPackageIdx, setSelectedPackageIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buyAiPackageMutation = useMutation({
    mutationFn: async (data: { credits: number; pricePaid: number }) => {
      const r = await fetch("/api/student/ai-packages/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Ошибка покупки");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-ai-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student/ai-packages/balance"] });
      toast({ title: "Пакет ИИ приобретён!" });
      setShowAiPackageDialog(false);
      setSelectedPackageIdx(null);
    },
  });

  const { data: aiConfig } = useQuery<AiConfig>({
    queryKey: ["student-ai-config"],
    queryFn: async () => {
      const res = await fetch("/api/student/ai-config", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
  });

  useEffect(() => {
    if (aiConfig?.defaultModel && !selectedModel) {
      setSelectedModel(aiConfig.defaultModel);
    }
  }, [aiConfig?.defaultModel]);

  const { data: chats = [], refetch: refetchChats } = useQuery<AiChat[]>({
    queryKey: ["student-chats"],
    queryFn: async () => {
      const res = await fetch("/api/student/chats", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
  });

  useEffect(() => {
    if (chats.length > 0 && !activeChatId && !activeHomeworkId) {
      const sorted = [...chats].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const lastGeneral = sorted.find(c => !c.homeworkId);
      if (lastGeneral) setActiveChatId(lastGeneral.id);
    }
  }, [chats]);

  const { data: messages = [], refetch: refetchMessages } = useQuery<ChatMessage[]>({
    queryKey: ["student-chat-messages", activeChatId],
    queryFn: async () => {
      if (!activeChatId) return [];
      const res = await fetch(`/api/student/chats/${activeChatId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
    enabled: !!activeChatId,
  });

  const createChat = useMutation({
    mutationFn: async (opts?: { homeworkId?: string; title?: string }) => {
      const res = await fetch("/api/student/chats", {
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
    onSuccess: (chat: AiChat) => {
      setActiveChatId(chat.id);
      refetchChats();
      setSidebarOpen(false);
      setIsCreatingChat(false);
    },
    onError: (error: Error) => {
      setIsCreatingChat(false);
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteChat = useMutation({
    mutationFn: async (chatId: string) => {
      const res = await fetch(`/api/student/chats/${chatId}`, {
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
    mutationFn: async (data: { message: string; imageBase64?: string; model?: string; chatId?: string }) => {
      const targetChatId = data.chatId || activeChatId;
      if (!targetChatId) throw new Error("Нет активного чата");
      const { chatId: _, ...sendData } = data;
      const res = await fetch(`/api/student/chats/${targetChatId}/messages`, {
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
      queryClient.invalidateQueries({ queryKey: ["student-ai-config"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activeHomeworkId && chats.length > 0) {
      const hwChat = chats.find(c => c.homeworkId === activeHomeworkId);
      if (hwChat) {
        setActiveChatId(hwChat.id);
      } else if (!isCreatingChat) {
        setIsCreatingChat(true);
        createChat.mutate({ homeworkId: activeHomeworkId, title: "Помощь с ДЗ" });
      }
    }
  }, [activeHomeworkId, chats.length]);

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
      toast({ title: "Ошибка", description: "Максимальный размер изображения — 5 МБ", variant: "destructive" });
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
          homeworkId: activeHomeworkId,
          title: messageText.substring(0, 40) || "Новый чат",
        });
        sendMessage.mutate({
          chatId: chat.id,
          message: messageText || "Посмотри на изображение",
          imageBase64: imageToSend || undefined,
          model: selectedModel || undefined,
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
    setIsCreatingChat(true);
    createChat.mutate({ title: "Новый чат" });
  };

  const chatCount = chats.length;
  const isNearLimit = chatCount >= 15;
  const isAtLimit = chatCount >= MAX_CHATS;

  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[400px]">
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              ИИ-помощник
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeChat ? activeChat.title : `Помощь по ${studentSubject}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeHomeworkId && (
              <Badge variant="secondary" className="text-xs">
                Помощь с ДЗ
                <button className="ml-1.5" onClick={onClearHomework}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
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

        <div className="rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/5 border border-blue-200/40 p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {aiConfig && aiConfig.models.length > 0 ? (
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
                    variant="student"
                    onBuyPackage={() => setShowAiPackageDialog(true)}
                  />
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 text-blue-500" />
                  <span>ИИ-модели настраиваются репетитором</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {aiConfig && (() => {
                const currentModel = aiConfig.models.find(m => m.id === selectedModel);
                if (!currentModel) {
                  const pkgBalance = aiConfig.packageBalance || 0;
                  if (aiConfig.models.length === 0 && pkgBalance > 0) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Package className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-muted-foreground">
                          Пакет: <span className="font-semibold text-emerald-600">{pkgBalance}</span> ответов
                        </span>
                      </div>
                    );
                  }
                  return null;
                }
                const remaining = Math.max(0, currentModel.limit - currentModel.usage + (aiConfig.packageBalance || 0));
                return (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-muted-foreground">
                      Осталось: <span className={cn("font-semibold", remaining <= 5 ? "text-red-500" : remaining <= 15 ? "text-amber-500" : "text-emerald-600")}>{remaining}</span> ответов
                    </span>
                  </div>
                );
              })()}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-blue-300 text-blue-600 hover:bg-blue-50"
                onClick={() => setShowAiPackageDialog(true)}
              >
                <ShoppingCart className="h-3 w-3" />
                Купить пакет
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border border-blue-200/30 px-4 py-2.5">
          <div className="flex items-start gap-3">
            <Bot className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground text-sm">Твой персональный ИИ-помощник</p>
              <p>Помогаю разобраться с темами и задачами — объясняю шаг за шагом, а не даю готовые ответы. Можешь отправить фото задания (<kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+V</kbd> или скрепка), выбрать модель ИИ в панели выше, и создавать отдельные чаты для разных тем через кнопку «Чаты».</p>
            </div>
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
                    className="py-8"
                  >
                    <div className="text-center mb-8">
                      <div className="flex items-center justify-center mb-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl" />
                          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-600">
                            <Bot className="h-8 w-8 text-white" />
                          </div>
                        </div>
                      </div>
                      <h2 className="text-lg font-bold mb-1">Привет! Я твой ИИ-помощник</h2>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Я помогу тебе разобраться с заданиями. Не даю готовых ответов — помогаю понять!
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                      <button
                        onClick={() => {
                          setChatInput("Объясни мне тему простыми словами");
                          inputRef.current?.focus();
                        }}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors text-center"
                      >
                        <BookOpen className="h-5 w-5 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Объясни тему</span>
                      </button>
                      <button
                        onClick={() => {
                          setChatInput("Помоги решить задачу");
                          inputRef.current?.focus();
                        }}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors text-center"
                      >
                        <HelpCircle className="h-5 w-5 text-amber-500" />
                        <span className="text-xs text-muted-foreground">Помоги с задачей</span>
                      </button>
                      <button
                        onClick={() => {
                          fileInputRef.current?.click();
                        }}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors text-center"
                      >
                        <ImageIcon className="h-5 w-5 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">Отправь фото</span>
                      </button>
                    </div>

                    <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/30 max-w-lg mx-auto">
                      <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        Как пользоваться
                      </h3>
                      <ul className="text-xs text-muted-foreground space-y-1.5">
                        <li>Напиши вопрос или опиши задачу — помогу разобраться шаг за шагом</li>
                        <li>Прикрепи фото задания через <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Ctrl+V</kbd> или кнопку скрепки</li>
                        <li>Каждый чат — отдельная тема. Создавай новые через панель справа</li>
                        <li>Формулы отображаются красиво — ИИ использует LaTeX</li>
                      </ul>
                    </div>
                  </motion.div>
                )}

                {messages.map((msg) => (
                  <StudentChatBubble key={msg.id} msg={msg} />
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
                        <span className="text-xs text-muted-foreground">Думаю...</span>
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
                  placeholder="Напиши вопрос... (Ctrl+V для вставки фото)"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  disabled={sendMessage.isPending}
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-colors min-h-[36px] max-h-[120px]"
                  style={{ height: "36px" }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "36px";
                    el.style.height = Math.min(el.scrollHeight, 120) + "px";
                  }}
                />
                <VoiceInputButton
                  onTranscript={(t) => setChatInput(m => m ? (m.trimEnd() + " " + t) : t)}
                  className="shrink-0 h-9 w-9 rounded-xl"
                  disabled={sendMessage.isPending}
                  data-testid="button-voice-student-ai"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="shrink-0 h-9 w-9 rounded-xl"
                  disabled={(!chatInput.trim() && !pendingImage) || sendMessage.isPending}
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
              className="shrink-0 overflow-hidden"
            >
              <Card className="h-full rounded-2xl border-border/50 flex flex-col w-[260px]">
                <div className="p-3 border-b border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleNewChat}
                    disabled={isAtLimit || createChat.isPending || isCreatingChat}
                  >
                    {createChat.isPending || isCreatingChat ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Новый чат
                  </Button>

                  {isNearLimit && (
                    <div className={cn(
                      "mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px]",
                      isAtLimit ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"
                    )}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        {isAtLimit
                          ? "Лимит чатов достигнут. Удалите старые."
                          : `${chatCount} из ${MAX_CHATS} чатов. Скоро лимит!`}
                      </span>
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {chats.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>Нет чатов</p>
                        <p className="mt-1">Создайте первый!</p>
                      </div>
                    )}
                    {chats.map((chat) => (
                      <div
                        key={chat.id}
                        className={cn(
                          "group flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer transition-colors",
                          activeChatId === chat.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => {
                          setActiveChatId(chat.id);
                          setSidebarOpen(false);
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{chat.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(chat.updatedAt), "d MMM, HH:mm", { locale: ru })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChat.mutate(chat.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all"
                          title="Удалить чат"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={showAiPackageDialog} onOpenChange={setShowAiPackageDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              Купить пакет ИИ
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="rounded-lg bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2.5">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  Кредиты пакета расходуются только после исчерпания дневного лимита. Не сгорают.
                </p>
              </div>
            </div>

            {AI_PACKAGE_OPTIONS.map((pkg, i) => (
              <button
                key={i}
                data-testid={`student-ai-package-option-${pkg.credits}`}
                onClick={() => setSelectedPackageIdx(i)}
                className={cn(
                  "w-full text-left rounded-xl border-2 p-4 transition-all",
                  selectedPackageIdx === i
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-border hover:border-cyan-300",
                  pkg.popular && "relative"
                )}
              >
                {pkg.popular && (
                  <Badge className="absolute -top-2 right-3 bg-blue-500 text-white text-[10px]">
                    Выгодно
                  </Badge>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{pkg.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(pkg.price / pkg.credits).toFixed(1)} ₽ за запрос
                    </p>
                  </div>
                  <span className="text-lg font-bold">{pkg.price} ₽</span>
                </div>
              </button>
            ))}

            <Button
              className="w-full mt-2 gap-2"
              disabled={selectedPackageIdx === null || buyAiPackageMutation.isPending}
              onClick={() => {
                if (selectedPackageIdx !== null) {
                  const pkg = AI_PACKAGE_OPTIONS[selectedPackageIdx];
                  buyAiPackageMutation.mutate({ credits: pkg.credits, pricePaid: pkg.price });
                }
              }}
              data-testid="button-confirm-student-ai-package"
            >
              {buyAiPackageMutation.isPending ? <Spinner className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              {selectedPackageIdx !== null
                ? `Купить ${AI_PACKAGE_OPTIONS[selectedPackageIdx].label} за ${AI_PACKAGE_OPTIONS[selectedPackageIdx].price} ₽`
                : "Выберите пакет"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
