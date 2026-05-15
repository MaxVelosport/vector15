import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/lib/toast";
import {
  Bot, X, Copy, RefreshCw, Timer, CheckCircle2, Send,
  MessageCircle, Loader2, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface TelegramConnectBannerProps {
  mode: "tutor" | "student";
  botUsername: string | null;
}

const TUTOR_FEATURES = [
  { icon: "📅", title: "Расписание в одно касание", desc: "/today, /week, /next — занятия прямо в Telegram. Отметить «✅ Завершено» или «❌ Не пришёл» — одна кнопка." },
  { icon: "📝", title: "Домашние задания", desc: "Уведомление, когда ученик сдал работу. Кнопки «Оценить» (40–100 баллов) и «Комментарий» — без перехода на сайт." },
  { icon: "👥", title: "Карточки учеников", desc: "/students — список с балансом и прогрессом. Из карточки сразу принять оплату (нал / карта / перевод / СБП)." },
  { icon: "💰", title: "Финансы на ладони", desc: "/balance — кто задолжал, кто переплатил. /stats — доход, число уроков, сравнение с прошлым месяцем." },
  { icon: "🖊", title: "Совместная доска", desc: "Кнопка «Открыть доску» в /next — мгновенный переход на интерактивную доску с учеником." },
  { icon: "🤖", title: "ИИ-ассистент", desc: "/ask Как объяснить производную? — GPT-4o отвечает в контексте репетитора. Идеи заданий, советы по мотивации, планы уроков." },
  { icon: "🔔", title: "Авто-уведомления", desc: "Напоминание за час до занятия, сигнал о новой оплате, уведомление когда ученик сдал ДЗ." },
];

const STUDENT_FEATURES = [
  { icon: "📅", title: "Расписание всегда под рукой", desc: "/today, /week, /next — видите занятия без входа на сайт. Напоминание придёт за час до урока." },
  { icon: "📚", title: "Сдача заданий в Telegram", desc: "/homework — список всех ДЗ. Кнопка «📤 Сдать» → напишите ответ прямо в чат. Репетитор получит уведомление." },
  { icon: "🏅", title: "Оценки и прогресс", desc: "/grades — все оценки по работам. /progress — процент выполнения, средний балл, посещаемость." },
  { icon: "💰", title: "Баланс с репетитором", desc: "/balance — текущий баланс и история последних платежей. Зелёный = переплата, красный = долг." },
  { icon: "🖊", title: "Совместная доска", desc: "Кнопка «Открыть доску» в /next — мгновенный переход на общую интерактивную доску с репетитором." },
  { icon: "🤖", title: "ИИ-помощник в учёбе", desc: "/ask Как решать квадратные уравнения? — ИИ объясняет тему понятным языком, когда репетитора нет рядом." },
  { icon: "🔔", title: "Авто-уведомления", desc: "Новое задание, результат проверки с оценкой и комментарием — всё приходит в Telegram автоматически." },
];

const GUIDE_STEPS = [
  {
    num: 1,
    title: "Нажмите «Получить код»",
    desc: "Платформа создаёт одноразовый 6-значный код, действующий 15 минут.",
  },
  {
    num: 2,
    title: "Откройте бота в Telegram",
    desc: "Перейдите по ссылке или найдите бот вручную. Нажмите кнопку Start, если открываете первый раз.",
  },
  {
    num: 3,
    title: "Отправьте код боту",
    desc: "Введите или скопируйте 6-значный код и отправьте его. Больше ничего не нужно!",
  },
  {
    num: 4,
    title: "Готово — аккаунт привязан",
    desc: "Бот пришлёт приветствие. Теперь вы будете получать уведомления прямо в Telegram.",
  },
];

export function TelegramConnectBanner({ mode, botUsername }: TelegramConnectBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [codeSecondsLeft, setCodeSecondsLeft] = useState(900);
  const [codeCopied, setCodeCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateCode = useMutation({
    mutationFn: () => {
      const url = mode === "student"
        ? "/api/student/telegram/generate-code"
        : "/api/telegram/generate-code";
      const body = mode === "tutor" ? { type: "tutor" } : undefined;
      return apiRequest("POST", url, body).then(r => r.json());
    },
    onSuccess: (data) => {
      setLinkCode(data.code);
      setCodeExpiresAt(new Date(data.expiresAt));
      setCodeSecondsLeft(900);
      setCodeCopied(false);
      setShowCodeDialog(true);
      if (timerRef.current) clearInterval(timerRef.current);
      const expires = new Date(data.expiresAt).getTime();
      timerRef.current = setInterval(() => {
        const left = Math.max(0, Math.floor((expires - Date.now()) / 1000));
        setCodeSecondsLeft(left);
        if (left === 0) { clearInterval(timerRef.current!); timerRef.current = null; }
      }, 1000);
    },
    onError: () => toast.error("Telegram бот не настроен. Обратитесь к администратору."),
  });

  const copyCode = () => {
    if (!linkCode) return;
    navigator.clipboard.writeText(linkCode);
    setCodeCopied(true);
    toast.success("Код скопирован!");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  if (dismissed) return null;

  return (
    <>
      <div
        data-testid="banner-telegram-connect"
        className="relative rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/8 via-card to-indigo-500/5 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 shrink-0 mt-0.5">
            <Bot className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">Подключите Telegram</span>
              <Badge className="text-[10px] h-4 bg-blue-500/15 text-blue-600 dark:text-blue-400 border-0">Новое</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {mode === "tutor"
                ? "Получайте уведомления о занятиях, домашних работах и оплатах прямо в Telegram. Это займёт меньше минуты."
                : "Получайте уведомления о новых заданиях, оценках и расписании прямо в Telegram."}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            data-testid="button-dismiss-telegram-banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Benefits row */}
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {["📅 Расписание на завтра", "✅ Новые задания", "📊 Итоги занятий"].map(b => (
            <span key={b} className="text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">{b}</span>
          ))}
        </div>

        {/* Action row */}
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
          <Button
            size="sm"
            className="gap-2 bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
            onClick={() => generateCode.mutate()}
            disabled={generateCode.isPending}
            data-testid="button-get-telegram-code"
          >
            {generateCode.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <MessageCircle className="h-3.5 w-3.5" />}
            Получить код
          </Button>
          {botUsername && (
            <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="gap-2 text-xs border-blue-500/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                <Send className="h-3 w-3" />
                Открыть бота
              </Button>
            </a>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 h-7"
            onClick={() => setShowFeatures(true)}
            data-testid="button-telegram-features"
          >
            <Sparkles className="h-3 w-3 text-blue-400" />
            Возможности бота
          </Button>
          <button
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors ml-auto"
            onClick={() => setShowGuide(v => !v)}
          >
            {showGuide ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showGuide ? "Скрыть" : "Как подключить?"}
          </button>
        </div>

        {/* Collapsible guide */}
        {showGuide && (
          <div className="border-t border-blue-500/15 px-4 py-4 space-y-3 bg-blue-500/5">
            <p className="text-xs font-medium text-foreground">Пошаговая инструкция</p>
            <div className="space-y-2.5">
              {GUIDE_STEPS.map(step => (
                <div key={step.num} className="flex gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold shrink-0 mt-0.5">
                    {step.num}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{step.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            {botUsername && (
              <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                🤖 Бот:{" "}
                <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="text-blue-500 underline font-medium">
                  @{botUsername}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Features dialog */}
      <Dialog open={showFeatures} onOpenChange={setShowFeatures}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-blue-500" />
              {mode === "tutor" ? "Что умеет бот для репетитора" : "Что умеет бот для ученика"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              После подключения Telegram все функции доступны прямо в мессенджере — без входа на сайт.
            </p>
            <div className="space-y-2.5">
              {(mode === "tutor" ? TUTOR_FEATURES : STUDENT_FEATURES).map((f) => (
                <div key={f.title} className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                  <span className="text-xl shrink-0 mt-0.5">{f.icon}</span>
                  <div>
                    <p className="text-xs font-medium text-foreground">{f.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-1 flex flex-col gap-2">
              <Button
                className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => { setShowFeatures(false); generateCode.mutate(); }}
                disabled={generateCode.isPending}
                data-testid="button-features-get-code"
              >
                {generateCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Подключить — получить код
              </Button>
              {botUsername && (
                <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full gap-2 text-sm">
                    <Send className="h-3.5 w-3.5" />
                    Открыть @{botUsername}
                  </Button>
                </a>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Code dialog */}
      <Dialog open={showCodeDialog} onOpenChange={(open) => {
        if (!open && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setShowCodeDialog(open);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-blue-500" />
              Подключить Telegram
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <span>
                  {botUsername
                    ? <><a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="text-blue-500 underline">Откройте @{botUsername}</a> в Telegram</>
                    : "Откройте бот в Telegram"
                  }
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <span>Отправьте боту этот код:</span>
              </li>
            </ol>

            {/* Code display */}
            <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-6 flex flex-col items-center gap-3">
              {generateCode.isPending
                ? <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                : (
                  <>
                    <div
                      data-testid="text-link-code"
                      className="text-5xl font-mono font-bold tracking-[0.25em] text-blue-700 dark:text-blue-300 select-all"
                    >
                      {linkCode}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Timer className="h-3 w-3" />
                      {codeSecondsLeft > 0
                        ? <>Действует {Math.floor(codeSecondsLeft / 60)}:{String(codeSecondsLeft % 60).padStart(2, "0")}</>
                        : <span className="text-red-500 font-medium">Истёк — обновите</span>}
                    </div>
                  </>
                )
              }
            </div>

            {!generateCode.isPending && codeSecondsLeft > 0 && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-1000"
                  style={{ width: `${(codeSecondsLeft / 900) * 100}%` }}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                data-testid="button-copy-code"
                className="flex-1 gap-2"
                variant={codeCopied ? "secondary" : "default"}
                onClick={copyCode}
                disabled={!linkCode || generateCode.isPending || codeSecondsLeft === 0}
              >
                {codeCopied ? <><CheckCircle2 className="h-4 w-4" />Скопировано</> : <><Copy className="h-4 w-4" />Копировать</>}
              </Button>
              <Button
                data-testid="button-refresh-code"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => generateCode.mutate()}
                disabled={generateCode.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${generateCode.isPending ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {botUsername && (
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full gap-2 text-sm">
                  <Send className="h-3.5 w-3.5" />
                  Открыть @{botUsername}
                </Button>
              </a>
            )}

            <p className="text-[11px] text-muted-foreground text-center">
              Код одноразовый, истекает через 15 минут. После ввода бот пришлёт приветствие.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
