import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, ChevronDown, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  "Как сдать домашнее задание?",
  "Как войти на урок?",
  "Что такое XP и уровни?",
  "Как написать репетитору?",
  "Как посмотреть расписание?",
  "Что значит красный баланс?",
];

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: "Привет! 👋 Я помощник по платформе «Твой Вектор». Могу объяснить как работает любой раздел кабинета. Спроси или выбери вопрос ниже!",
};

export function StudentHelpWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setHasInteracted(true);
    const userMsg: Message = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const history = newMessages.slice(1).map(m => ({ role: m.role, content: m.content }));
      const res = await apiRequest("POST", "/api/student/help-chat", {
        message: trimmed,
        history: history.slice(0, -1),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.message || "Не удалось получить ответ." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Ой, что-то пошло не так. Попробуй ещё раз! 🙏" }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function resetChat() {
    setMessages([WELCOME_MESSAGE]);
    setHasInteracted(false);
  }

  const showQuickQuestions = !hasInteracted && messages.length === 1;

  return (
    <div className="fixed bottom-20 right-4 z-50 sm:bottom-6" data-testid="help-widget">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
            className="mb-3 flex w-80 flex-col rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/20 overflow-hidden"
            style={{ height: 480 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-border/50 bg-gradient-to-r from-primary/10 via-cyan-500/5 to-primary/5 px-4 py-3 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-500 shadow-sm">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">Помощник по кабинету</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] text-muted-foreground">Всегда онлайн</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 1 && (
                  <button
                    onClick={resetChat}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                    title="Начать сначала"
                    data-testid="help-widget-reset"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                  data-testid="help-widget-close"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-cyan-500/20 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted/70 text-foreground rounded-bl-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-cyan-500/20">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted/70 px-3 py-2.5">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                        transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Quick questions */}
            <AnimatePresence>
              {showQuickQuestions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-border/40 px-3 py-2 shrink-0"
                >
                  <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Частые вопросы:</p>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_QUESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                        data-testid={`help-quick-${q.slice(0, 10)}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="border-t border-border/50 p-3 shrink-0">
              <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 focus-within:border-primary/40 focus-within:bg-background transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Задай вопрос о кабинете..."
                  className="flex-1 resize-none bg-transparent text-xs leading-relaxed outline-none placeholder:text-muted-foreground/60"
                  rows={1}
                  style={{ maxHeight: 80 }}
                  data-testid="help-widget-input"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all",
                    input.trim() && !loading
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 scale-100"
                      : "bg-muted text-muted-foreground scale-90 cursor-not-allowed"
                  )}
                  data-testid="help-widget-send"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "flex items-center gap-2 rounded-2xl px-4 py-3 shadow-lg shadow-primary/20 transition-all duration-300",
          open
            ? "bg-muted border border-border/60 text-foreground"
            : "bg-gradient-to-r from-primary to-cyan-500 text-white"
        )}
        data-testid="help-widget-toggle"
      >
        <div className="relative">
          {open ? (
            <X className="h-5 w-5" />
          ) : (
            <>
              <Bot className="h-5 w-5" />
              <motion.div
                className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-white/80"
                animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            </>
          )}
        </div>
        <span className="text-sm font-semibold">
          {open ? "Закрыть" : "Помощник"}
        </span>
        {!open && (
          <Sparkles className="h-3.5 w-3.5 opacity-80" />
        )}
      </motion.button>
    </div>
  );
}
