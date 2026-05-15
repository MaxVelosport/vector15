import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Copy, Check, MessageCircle, Send, Mail, Smartphone, Save, Trash2,
  ChevronLeft, ChevronRight, AlertCircle, Info, Plus,
} from "lucide-react";
import { SiWhatsapp, SiTelegram } from "react-icons/si";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Student, Lesson } from "@shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Сторедж пользовательских шаблонов и истории отправок
// ─────────────────────────────────────────────────────────────────────────────

const CUSTOM_TEMPLATES_KEY = "tv_parent_templates_v1";
const SENT_LOG_KEY = "tv_parent_reminders_sent_v1";
const LAST_TEMPLATE_KEY = "tv_parent_last_template_v1";

type CustomTemplate = { id: string; title: string; text: string };
type SentLog = Record<string, { at: string; template: string; channel: string }>;

function loadCustomTemplates(): CustomTemplate[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_TEMPLATES_KEY) || "[]"); }
  catch { return []; }
}
function saveCustomTemplates(list: CustomTemplate[]) {
  try { localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(list)); } catch {}
}
function loadSentLog(): SentLog {
  try { return JSON.parse(localStorage.getItem(SENT_LOG_KEY) || "{}"); }
  catch { return {}; }
}
function recordSent(studentId: string, templateTitle: string, channel: string) {
  try {
    const log = loadSentLog();
    log[studentId] = { at: new Date().toISOString(), template: templateTitle, channel };
    localStorage.setItem(SENT_LOG_KEY, JSON.stringify(log));
    window.dispatchEvent(new Event("tv-parent-reminders-changed"));
  } catch {}
}
export function getLastReminder(studentId: string) {
  return loadSentLog()[studentId];
}

// ─────────────────────────────────────────────────────────────────────────────
// Встроенные шаблоны
// ─────────────────────────────────────────────────────────────────────────────

type BuiltinId = "month_summary" | "reminder_soft" | "reminder_firm" | "prepayment" | "thanks";

const BUILTIN_TEMPLATES: { id: BuiltinId; title: string; text: string }[] = [
  {
    id: "month_summary",
    title: "Итоги месяца",
    text: `Здравствуйте!
Делюсь итогами за {month} по занятиям {student} (предмет: {subject}).

• Проведено занятий: {lessons_this_month}
• Стоимость занятий за месяц: {monthly_cost}
• Оплачено в этом месяце: {paid_this_month}
• Текущий баланс: {balance_text}

{requisites_block}

Если будут вопросы — пишите. С уважением, {tutor}.`,
  },
  {
    id: "reminder_soft",
    title: "Мягкое напоминание",
    text: `Здравствуйте!
Напоминаю про оплату занятий {student}. На сегодня задолженность — {debt} ({unpaid_count}).
Буду благодарен(на), если сможете перевести в ближайшие дни.

{requisites_block}

Спасибо, {tutor}.`,
  },
  {
    id: "reminder_firm",
    title: "Настойчивое напоминание",
    text: `Здравствуйте.
Повторно напоминаю о задолженности по занятиям {student}: {debt} за {unpaid_count}.
Прошу произвести оплату до {deadline}, чтобы мы могли продолжить занятия без перерыва.

{requisites_block}

{tutor}`,
  },
  {
    id: "prepayment",
    title: "Предложить предоплату",
    text: `Здравствуйте!
Подскажите, удобно ли будет внести предоплату за следующие занятия {student}?
Стоимость занятия — {price_per_lesson}. Обычно удобно оплачивать на 4–8 занятий вперёд.

{requisites_block}

Спасибо, {tutor}.`,
  },
  {
    id: "thanks",
    title: "Спасибо за оплату",
    text: `Здравствуйте! Оплату получил(а), спасибо 🙏
Текущий баланс {student}: {balance_text}.

С уважением, {tutor}.`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Парсинг контакта родителя
// ─────────────────────────────────────────────────────────────────────────────

type ParsedContacts = {
  phone?: string;         // digits only, международный формат без +
  phoneDisplay?: string;  // как увидит пользователь
  tgUsername?: string;    // без @
  tgUrl?: string;         // https://t.me/...
  waUrl?: string;         // https://wa.me/...
  email?: string;
};

function normalizePhone(raw: string): { digits: string; display: string } | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  // российский номер: 10 цифр → +7..., 8XXXXXXXXXX → +7XXXXXXXXXX
  let intl = digits;
  if (digits.length === 10) intl = "7" + digits;
  else if (digits.length === 11 && digits.startsWith("8")) intl = "7" + digits.slice(1);
  const display = intl.length === 11 && intl.startsWith("7")
    ? `+7 (${intl.slice(1, 4)}) ${intl.slice(4, 7)}-${intl.slice(7, 9)}-${intl.slice(9, 11)}`
    : `+${intl}`;
  return { digits: intl, display };
}

function parseContacts(student: Student): ParsedContacts {
  const out: ParsedContacts = {};
  const sources = [student.parentContact, student.parentLink, student.email].filter(Boolean) as string[];
  const blob = sources.join(" \n ");

  // Email
  const emailMatch = blob.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) out.email = emailMatch[0];

  // Telegram: t.me/username or @username
  const tgUrlMatch = blob.match(/(?:https?:\/\/)?t\.me\/(\+?[\w_]+)/i);
  if (tgUrlMatch) {
    const u = tgUrlMatch[1];
    if (u.startsWith("+")) {
      // это инвайт-ссылка или phone-link — не username, храним как tgUrl
      out.tgUrl = `https://t.me/${u}`;
    } else {
      out.tgUsername = u;
      out.tgUrl = `https://t.me/${u}`;
    }
  } else {
    const atMatch = blob.match(/(?:^|\s)@([a-zA-Z][\w_]{3,})/);
    if (atMatch) {
      out.tgUsername = atMatch[1];
      out.tgUrl = `https://t.me/${atMatch[1]}`;
    }
  }

  // WhatsApp: wa.me
  const waMatch = blob.match(/(?:https?:\/\/)?wa\.me\/(\+?\d[\d\s\-()]*)/i);
  if (waMatch) {
    const norm = normalizePhone(waMatch[1]);
    if (norm) {
      out.phone = norm.digits;
      out.phoneDisplay = norm.display;
      out.waUrl = `https://wa.me/${norm.digits}`;
    }
  }

  // Прямой телефон — ищем только если не нашли через wa.me
  if (!out.phone) {
    const phoneMatch = blob.match(/(?:\+?7|8)[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d/);
    if (phoneMatch) {
      const norm = normalizePhone(phoneMatch[0]);
      if (norm) {
        out.phone = norm.digits;
        out.phoneDisplay = norm.display;
        if (!out.waUrl) out.waUrl = `https://wa.me/${norm.digits}`;
      }
    }
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Подстановка переменных
// ─────────────────────────────────────────────────────────────────────────────

export type ReminderStudentData = {
  student: Student;
  effectiveBalance: number;
  unpaidLessonsCount: number;
  unpaidDebt: number;
  lessonsThisMonth: number;
  monthlyCost: number;
  paidThisMonth: number;
};

function moneyRub(n: number) {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU")} ₽`;
}

function pluralRu(n: number, forms: [string, string, string]) {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

function lessonsWord(n: number) {
  return `${n} ${pluralRu(n, ["занятие", "занятия", "занятий"])}`;
}
function unpaidLessonsPhrase(n: number) {
  return `${n} ${pluralRu(n, ["неоплаченное занятие", "неоплаченных занятия", "неоплаченных занятий"])}`;
}

function buildSubstitutionMap(data: ReminderStudentData, tutorName: string): Record<string, string> {
  const s = data.student;
  const now = new Date();
  const deadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const monthName = format(now, "LLLL yyyy", { locale: ru });
  const debt = Math.abs(Math.min(0, data.effectiveBalance));

  const requisitesBlock = (s as any).paymentInfo
    ? `Реквизиты для оплаты:\n${(s as any).paymentInfo}`
    : "";

  const balanceText = data.effectiveBalance < 0
    ? `долг ${moneyRub(debt)}`
    : data.effectiveBalance > 0
    ? `переплата ${moneyRub(data.effectiveBalance)}`
    : "0 ₽";

  return {
    "{student}": s.name,
    "{subject}": s.subject,
    "{tutor}": tutorName || "репетитор",
    "{month}": monthName,
    "{deadline}": format(deadline, "d MMMM", { locale: ru }),
    "{lessons_this_month}": String(data.lessonsThisMonth),
    "{monthly_cost}": moneyRub(data.monthlyCost),
    "{paid_this_month}": moneyRub(data.paidThisMonth),
    "{balance}": moneyRub(data.effectiveBalance),
    "{balance_text}": balanceText,
    "{debt}": moneyRub(debt),
    "{unpaid_count}": unpaidLessonsPhrase(data.unpaidLessonsCount),
    "{lessons_word}": lessonsWord(data.lessonsThisMonth),
    "{price_per_lesson}": moneyRub(s.pricePerLesson),
    "{requisites_block}": requisitesBlock,
  };
}

function substitute(template: string, data: ReminderStudentData, tutorName: string): string {
  const map = buildSubstitutionMap(data, tutorName);
  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(k).join(v);
  }
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

// Reverse-substitute: заменяет значения обратно на placeholder'ы, чтобы сохранить
// пользовательскую правку как переиспользуемый шаблон. Длинные значения сначала,
// чтобы, например, «долг 1 800 ₽» стал {balance_text} раньше, чем отдельное «1 800 ₽».
function reverseSubstitute(text: string, data: ReminderStudentData, tutorName: string): string {
  const map = buildSubstitutionMap(data, tutorName);
  const entries = Object.entries(map)
    .filter(([, v]) => v && v.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);
  let out = text;
  for (const [placeholder, value] of entries) {
    if (!value) continue;
    out = out.split(value).join(placeholder);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Сам диалог
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentReminderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: ReminderStudentData[]; // список для навигации (один или несколько)
  startIndex?: number;
  tutorName: string;
};

export function PaymentReminderDialog({
  open, onOpenChange, students, startIndex = 0, tutorName,
}: PaymentReminderDialogProps) {
  const [index, setIndex] = useState(startIndex);
  const [templateId, setTemplateId] = useState<string>(() => {
    try { return localStorage.getItem(LAST_TEMPLATE_KEY) || "reminder_soft"; }
    catch { return "reminder_soft"; }
  });
  const [customs, setCustoms] = useState<CustomTemplate[]>([]);
  const [messageText, setMessageText] = useState("");
  const [userEdited, setUserEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [saveName, setSaveName] = useState("");
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setIndex(startIndex);
      setCustoms(loadCustomTemplates());
      setUserEdited(false);
    }
  }, [open, startIndex]);

  useEffect(() => {
    try { localStorage.setItem(LAST_TEMPLATE_KEY, templateId); } catch {}
  }, [templateId]);

  const current = students[index];
  const contacts = useMemo(() => current ? parseContacts(current.student) : {}, [current]);
  const lastSent = useMemo(() => current ? getLastReminder(current.student.id) : null, [current, open]);

  // Выбранный шаблон
  const selectedTemplate = useMemo(() => {
    const builtin = BUILTIN_TEMPLATES.find(t => t.id === templateId);
    if (builtin) return { title: builtin.title, text: builtin.text };
    const custom = customs.find(t => t.id === templateId);
    if (custom) return { title: custom.title, text: custom.text };
    return BUILTIN_TEMPLATES[1]; // reminder_soft fallback
  }, [templateId, customs]);

  // Регенерация текста при смене шаблона/ученика, если юзер ещё не правил
  useEffect(() => {
    if (!current) return;
    const fresh = substitute(selectedTemplate.text, current, tutorName);
    setMessageText(fresh);
    setUserEdited(false);
  }, [templateId, current?.student.id, tutorName, customs.length]);

  if (!current) return null;
  const s = current.student;

  // URL для каналов
  const encoded = encodeURIComponent(messageText);
  const waHref = contacts.waUrl ? `${contacts.waUrl}?text=${encoded}` : null;
  const tgHref = contacts.tgUrl || null; // Telegram не поддерживает prefilled text в chat-URL
  const mailHref = contacts.email
    ? `mailto:${contacts.email}?subject=${encodeURIComponent(`Занятия ${s.name} — ${selectedTemplate.title}`)}&body=${encoded}`
    : null;
  const smsHref = contacts.phone ? `sms:+${contacts.phone}?body=${encoded}` : null;

  const handleCopy = async (channelLabel = "copy") => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      recordSent(s.id, selectedTemplate.title, channelLabel);
      toast.success("Скопировано", { description: "Текст сообщения в буфере обмена."  });
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const handleOpenChannel = async (url: string, channelLabel: string, alsoCopy: boolean) => {
    try {
      if (alsoCopy) {
        await navigator.clipboard.writeText(messageText).catch(() => {});
      }
    } catch {}
    window.open(url, "_blank", "noopener,noreferrer");
    recordSent(s.id, selectedTemplate.title, channelLabel);
    if (alsoCopy) {
      toast.info(`Открываю ${channelLabel}`, { description: "Текст сообщения скопирован — вставьте в чат." });
    }
  };

  const handleSaveTemplate = () => {
    const name = saveName.trim();
    if (!name) {
      toast.error("Укажите название шаблона");
      return;
    }
    const id = `custom_${Date.now()}`;
    // Сохраняем шаблон с плейсхолдерами: возвращаем значения текущего ученика
    // обратно в {student}/{debt}/… чтобы этот шаблон можно было переиспользовать
    // для других учеников без утечки чужих данных.
    const sourceText = reverseSubstitute(messageText, current, tutorName);
    const next = [...loadCustomTemplates(), { id, title: name, text: sourceText }];
    saveCustomTemplates(next);
    setCustoms(next);
    setTemplateId(id);
    setSaveMode(false);
    setSaveName("");
    toast.success("Шаблон сохранён", { description: `«${name}» теперь в вашем списке.` });
  };

  const handleDeleteTemplate = (id: string) => {
    const next = customs.filter(t => t.id !== id);
    saveCustomTemplates(next);
    setCustoms(next);
    if (templateId === id) setTemplateId("reminder_soft");
    toast.success("Шаблон удалён");
  };

  const hasAnyChannel = waHref || tgHref || mailHref || smsHref;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-parent-reminder">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            Сообщение родителям
          </DialogTitle>
          <DialogDescription>
            Выберите шаблон, отредактируйте текст и отправьте удобным способом.
          </DialogDescription>
        </DialogHeader>

        {/* Навигация по списку + сводка ученика */}
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate" data-testid="text-reminder-student">
              {s.name} <span className="text-muted-foreground font-normal">· {s.subject}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
              {current.effectiveBalance < 0 ? (
                <span className="text-red-600 font-medium">
                  Долг {moneyRub(Math.abs(current.effectiveBalance))} · {current.unpaidLessonsCount} неопл.
                </span>
              ) : current.effectiveBalance > 0 ? (
                <span className="text-emerald-600">Переплата {moneyRub(current.effectiveBalance)}</span>
              ) : (
                <span>Баланс 0 ₽</span>
              )}
              <span>· за месяц: {current.lessonsThisMonth} ур., опл. {moneyRub(current.paidThisMonth)}</span>
            </div>
          </div>
          {students.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm" variant="outline" className="h-7 w-7 p-0"
                onClick={() => setIndex(i => Math.max(0, i - 1))}
                disabled={index === 0}
                data-testid="button-reminder-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">{index + 1}/{students.length}</span>
              <Button
                size="sm" variant="outline" className="h-7 w-7 p-0"
                onClick={() => setIndex(i => Math.min(students.length - 1, i + 1))}
                disabled={index === students.length - 1}
                data-testid="button-reminder-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Распознанные контакты */}
        {hasAnyChannel ? (
          <div className="flex flex-wrap gap-1.5">
            {contacts.phoneDisplay && <Badge variant="secondary" className="gap-1"><Smartphone className="h-3 w-3" />{contacts.phoneDisplay}</Badge>}
            {contacts.tgUsername && <Badge variant="secondary" className="gap-1"><SiTelegram className="h-3 w-3" />@{contacts.tgUsername}</Badge>}
            {contacts.email && <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />{contacts.email}</Badge>}
          </div>
        ) : (
          <Alert variant="default" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              У ученика не указан контакт родителя — сможете только скопировать текст.
              Добавьте телефон / @telegram / email в карточке ученика, чтобы появились кнопки отправки.
            </AlertDescription>
          </Alert>
        )}

        {lastSent && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            Последнее напоминание: «{lastSent.template}» через {lastSent.channel} ·{" "}
            {format(new Date(lastSent.at), "d MMM, HH:mm", { locale: ru })}
          </div>
        )}

        {/* Выбор шаблона */}
        <div className="space-y-1.5">
          <Label className="text-xs">Шаблон</Label>
          <div className="flex flex-wrap gap-1.5">
            {BUILTIN_TEMPLATES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  "h-7 px-2.5 rounded-md text-[12px] border transition-colors",
                  templateId === t.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-background hover:bg-accent border-border"
                )}
                data-testid={`template-${t.id}`}
              >
                {t.title}
              </button>
            ))}
            {customs.map(t => (
              <div key={t.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={cn(
                    "h-7 pl-2.5 pr-1 rounded-l-md text-[12px] border border-r-0 transition-colors flex items-center gap-1",
                    templateId === t.id
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-background hover:bg-accent border-border"
                  )}
                >
                  {t.title}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(t.id)}
                  className={cn(
                    "h-7 w-6 rounded-r-md border transition-colors flex items-center justify-center",
                    templateId === t.id
                      ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                      : "bg-background hover:bg-destructive/10 hover:text-destructive border-border"
                  )}
                  title="Удалить шаблон"
                  data-testid={`button-delete-template-${t.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Текст сообщения */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs" htmlFor="reminder-text">Текст сообщения</Label>
            <span className="text-[10px] text-muted-foreground tabular-nums">{messageText.length} симв.</span>
          </div>
          <Textarea
            id="reminder-text"
            ref={textRef}
            value={messageText}
            onChange={e => { setMessageText(e.target.value); setUserEdited(true); }}
            rows={10}
            className="font-[inherit] text-sm leading-relaxed"
            data-testid="textarea-reminder-message"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {userEdited
                ? "Вы редактировали текст — смена шаблона сбросит правки."
                : "Автоподстановка из данных ученика применена."}
            </span>
            {!saveMode && (
              <button
                type="button"
                onClick={() => setSaveMode(true)}
                className="flex items-center gap-1 text-blue-600 hover:underline"
                data-testid="button-save-template-toggle"
              >
                <Plus className="h-3 w-3" /> Сохранить как шаблон
              </button>
            )}
          </div>
          {saveMode && (
            <div className="flex gap-2 items-end rounded-md border bg-muted/20 p-2">
              <div className="flex-1">
                <Label className="text-[10px]" htmlFor="template-name">Название шаблона</Label>
                <Input
                  id="template-name"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Например: Напоминание перед каникулами"
                  className="h-8 text-xs"
                  data-testid="input-template-name"
                />
              </div>
              <Button size="sm" variant="default" className="h-8" onClick={handleSaveTemplate} data-testid="button-save-template">
                <Save className="h-3.5 w-3.5 mr-1" /> Сохранить
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => { setSaveMode(false); setSaveName(""); }}>
                Отмена
              </Button>
            </div>
          )}
        </div>

        {/* Кнопки отправки */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="default"
            className="bg-[#25D366] hover:bg-[#1fb655] text-white"
            disabled={!waHref}
            onClick={() => waHref && handleOpenChannel(waHref, "WhatsApp", false)}
            data-testid="button-send-whatsapp"
          >
            <SiWhatsapp className="h-4 w-4 mr-1.5" /> WhatsApp
          </Button>
          <Button
            variant="default"
            className="bg-[#0088cc] hover:bg-[#0077b5] text-white"
            disabled={!tgHref}
            onClick={() => tgHref && handleOpenChannel(tgHref, "Telegram", true)}
            data-testid="button-send-telegram"
          >
            <SiTelegram className="h-4 w-4 mr-1.5" /> Telegram
          </Button>
          <Button
            variant="outline"
            disabled={!mailHref}
            onClick={() => mailHref && handleOpenChannel(mailHref, "Email", false)}
            data-testid="button-send-email"
          >
            <Mail className="h-4 w-4 mr-1.5" /> Email
          </Button>
          <Button
            variant="outline"
            disabled={!smsHref}
            onClick={() => smsHref && handleOpenChannel(smsHref, "SMS", false)}
            data-testid="button-send-sms"
          >
            <Send className="h-4 w-4 mr-1.5" /> SMS
          </Button>
          <div className="flex-1" />
          <Button
            variant="secondary"
            onClick={() => handleCopy("Копировать")}
            data-testid="button-copy-reminder"
          >
            {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
            {copied ? "Скопировано" : "Скопировать"}
          </Button>
        </div>

        <div className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t">
          <strong>Подсказка:</strong> Telegram не умеет подставлять текст автоматически — при нажатии мы откроем чат и сразу скопируем сообщение в буфер,
          останется только вставить (Ctrl/Cmd + V). WhatsApp и почта открываются уже с готовым текстом.
        </div>
      </DialogContent>
    </Dialog>
  );
}
