import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Receipt, Copy, Check, ExternalLink, Printer, AlertCircle, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { Payment, Student } from "@shared/schema";

const RECEIPT_STORAGE_KEY = "samozanyaty_receipts_v1";

type ReceiptRecord = { issuedAt: string; receiptNumber?: string };
type ReceiptStore = Record<string, ReceiptRecord>;

export function loadReceiptStore(): ReceiptStore {
  try {
    return JSON.parse(localStorage.getItem(RECEIPT_STORAGE_KEY) || "{}");
  } catch { return {}; }
}
export function saveReceiptRecord(paymentId: string, record: ReceiptRecord | null): boolean {
  try {
    const store = loadReceiptStore();
    if (record === null) delete store[paymentId];
    else store[paymentId] = record;
    localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event("samozanyaty-receipts-changed"));
    return true;
  } catch {
    return false;
  }
}
export function isReceiptIssued(paymentId: string): boolean {
  return !!loadReceiptStore()[paymentId];
}

export function pluralizePayments(n: number): string {
  const abs = Math.abs(n) % 100;
  const mod10 = abs % 10;
  if (abs > 10 && abs < 20) return `${n} платежей`;
  if (mod10 === 1) return `${n} платёж`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} платежа`;
  return `${n} платежей`;
}

function escHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
  student: Student | null;
  tutor?: { name?: string | null } | null;
}

export function SamozanyatyReceiptDialog({ open, onOpenChange, payment, student, tutor }: Props) {
  const [serviceName, setServiceName] = useState("");
  const [payerType, setPayerType] = useState<"individual" | "legal">("individual");
  const [payerName, setPayerName] = useState("");
  const [payerInn, setPayerInn] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [markedIssued, setMarkedIssued] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!payment || !student) return;
    setServiceName(`Услуги репетитора по предмету «${student.subject}» — ${student.name}`);
    setPayerType("individual");
    setPayerName(student.name);
    setPayerInn("");
    setReceiptNumber("");
    const existing = loadReceiptStore()[payment.id];
    setMarkedIssued(!!existing);
    if (existing?.receiptNumber) setReceiptNumber(existing.receiptNumber);
  }, [payment, student]);

  if (!payment || !student) return null;

  const dateStr = format(new Date(payment.createdAt), "d MMMM yyyy", { locale: ru });
  const dateShort = format(new Date(payment.createdAt), "dd.MM.yyyy");

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
      toast({ title: "Скопировано", description: text.slice(0, 60) });
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  };

  const copyAll = async () => {
    const text = `Чек самозанятого
Дата: ${dateShort}
Сумма: ${payment.amount} ₽
Услуга: ${serviceName}
Плательщик: ${payerType === "legal" ? "Юридическое лицо" : "Физическое лицо"}
${payerName ? `ФИО/Название: ${payerName}` : ""}
${payerType === "legal" && payerInn ? `ИНН плательщика: ${payerInn}` : ""}`;
    await copy(text, "all");
  };

  const handleMarkIssued = (checked: boolean) => {
    const ok = checked
      ? saveReceiptRecord(payment.id, { issuedAt: new Date().toISOString(), receiptNumber: receiptNumber.trim() || undefined })
      : saveReceiptRecord(payment.id, null);
    if (!ok) {
      toast({ title: "Не удалось сохранить статус", description: "Хранилище браузера недоступно (приватный режим?)", variant: "destructive" });
      return;
    }
    setMarkedIssued(checked);
    if (checked) toast({ title: "Чек отмечен как выданный", description: "Запись сохранена в вашем кабинете" });
  };

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) {
      toast({ title: "Разрешите всплывающие окна", description: "Браузер заблокировал окно печати", variant: "destructive" });
      return;
    }
    const tutorLine = tutor?.name
      ? `Получатель: ${escHtml(tutor.name)}<br>`
      : "";
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Чек самозанятого</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:32px;max-width:560px;margin:0 auto;color:#111}
        h1{font-size:18px;margin:0 0 8px;text-align:center}
        h2{font-size:13px;color:#666;text-align:center;font-weight:normal;margin:0 0 24px}
        .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
        .label{color:#666}
        .val{font-weight:500;text-align:right;max-width:60%}
        .total{margin-top:20px;padding:16px;background:#f5f5f5;border-radius:8px;text-align:center}
        .total .amt{font-size:28px;font-weight:600}
        .footer{margin-top:32px;font-size:11px;color:#999;text-align:center;line-height:1.5}
      </style></head><body>
      <h1>Чек самозанятого</h1>
      <h2>Информация для ввода в приложение «Мой налог»</h2>
      <div class="row"><span class="label">Дата получения дохода</span><span class="val">${escHtml(dateShort)}</span></div>
      <div class="row"><span class="label">Услуга</span><span class="val">${escHtml(serviceName)}</span></div>
      <div class="row"><span class="label">Плательщик</span><span class="val">${payerType === "legal" ? "Юр. лицо" : "Физ. лицо"}</span></div>
      ${payerName ? `<div class="row"><span class="label">${payerType === "legal" ? "Название" : "ФИО"}</span><span class="val">${escHtml(payerName)}</span></div>` : ""}
      ${payerType === "legal" && payerInn ? `<div class="row"><span class="label">ИНН</span><span class="val">${escHtml(payerInn)}</span></div>` : ""}
      <div class="row"><span class="label">Способ оплаты</span><span class="val">${escHtml(payment.method)}</span></div>
      ${receiptNumber ? `<div class="row"><span class="label">№ чека в «Мой налог»</span><span class="val">${escHtml(receiptNumber)}</span></div>` : ""}
      <div class="total"><div style="font-size:12px;color:#666">Сумма к оформлению</div><div class="amt">${escHtml(payment.amount.toLocaleString("ru-RU"))} ₽</div></div>
      <div class="footer">
        ${tutorLine}Налоговый режим: Налог на профессиональный доход (самозанятый)<br>
        <br>Чек должен быть сформирован в приложении «Мой налог» и передан плательщику.
      </div>
    </body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const FieldRow = ({ label, value, field, mono = false }: { label: string; value: string | number; field: string; mono?: boolean }) => (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors group">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        <div className={`text-sm ${mono ? "font-mono" : ""} truncate`} data-testid={`text-receipt-${field}`}>{value}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-50 group-hover:opacity-100 shrink-0"
        onClick={() => copy(String(value), field)}
        aria-label={`Скопировать: ${label}`}
        title="Скопировать"
        data-testid={`button-copy-${field}`}
      >
        {copiedField === field ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-samozanyaty-receipt">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            Чек самозанятого
          </DialogTitle>
          <DialogDescription>
            Заполните данные ниже и оформите чек в приложении «Мой налог». Все поля можно скопировать одним кликом.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-amber-500/5 border-amber-500/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs">
            Автоматическая интеграция с ФНС не предусмотрена. Это <b>шаблон для ручного ввода</b> в официальное приложение «Мой налог».
            Чек обязателен для получения дохода как самозанятый (закон 422-ФЗ).
          </AlertDescription>
        </Alert>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Параметры услуги</Label>
            <div>
              <Label htmlFor="service-name" className="text-xs">Наименование услуги</Label>
              <Textarea
                id="service-name"
                value={serviceName}
                onChange={e => setServiceName(e.target.value)}
                rows={2}
                className="text-sm resize-none"
                data-testid="input-service-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Тип плательщика</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant={payerType === "individual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPayerType("individual")}
                    className="flex-1"
                    data-testid="button-payer-individual"
                  >
                    Физ. лицо
                  </Button>
                  <Button
                    variant={payerType === "legal" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPayerType("legal")}
                    className="flex-1"
                    data-testid="button-payer-legal"
                  >
                    Юр. лицо
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="payer-name" className="text-xs">{payerType === "legal" ? "Название организации" : "ФИО плательщика"}</Label>
                <Input
                  id="payer-name"
                  value={payerName}
                  onChange={e => setPayerName(e.target.value)}
                  className="h-9 text-sm"
                  placeholder={payerType === "legal" ? "ООО «Ромашка»" : "Иванова И.И."}
                  data-testid="input-payer-name"
                />
              </div>
            </div>
            {payerType === "legal" && (
              <div>
                <Label htmlFor="payer-inn" className="text-xs">ИНН плательщика *</Label>
                <Input
                  id="payer-inn"
                  value={payerInn}
                  onChange={e => setPayerInn(e.target.value.replace(/[^\d]/g, "").slice(0, 12))}
                  className="h-9 text-sm font-mono"
                  placeholder="10 или 12 цифр"
                  data-testid="input-payer-inn"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Для юр. лиц ИНН обязателен.</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Данные для ввода в «Мой налог»</Label>
            <div className="grid sm:grid-cols-2 gap-2">
              <FieldRow label="Дата дохода" value={dateShort} field="date" mono />
              <FieldRow label="Сумма, ₽" value={payment.amount.toLocaleString("ru-RU")} field="amount" mono />
            </div>
            <FieldRow label="Наименование услуги" value={serviceName} field="service" />
            {payerName && <FieldRow label={payerType === "legal" ? "Название организации" : "ФИО плательщика"} value={payerName} field="payer" />}
            {payerType === "legal" && payerInn && <FieldRow label="ИНН плательщика" value={payerInn} field="inn" mono />}
          </div>

          <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/15 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <Smartphone className="h-4 w-4" />
              Сформируйте чек в «Мой налог»
            </div>
            <ol className="text-xs space-y-1.5 text-muted-foreground list-decimal list-inside">
              <li>Откройте приложение «Мой налог» (или личный кабинет на сайте ФНС).</li>
              <li>Нажмите «Новая продажа», скопируйте сумму и наименование услуги выше.</li>
              <li>Укажите тип плательщика{payerType === "legal" && " и его ИНН"}.</li>
              <li>Подтвердите выпуск чека и пришлите его ссылку плательщику.</li>
              <li>Вернитесь сюда, вставьте номер чека и отметьте «Чек выдан».</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href="https://lknpd.nalog.ru/" target="_blank" rel="noopener noreferrer" data-testid="link-moinalog-web">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Открыть «Мой налог» (web)
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5" data-testid="button-copy-all">
                <Copy className="h-3.5 w-3.5" />
                Скопировать всё
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5" data-testid="button-print-receipt">
                <Printer className="h-3.5 w-3.5" />
                Распечатать
              </Button>
            </div>
          </div>

          <div className="rounded-xl border p-4 space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">После оформления</Label>
            <div>
              <Label htmlFor="receipt-num" className="text-xs">№ чека из «Мой налог» (необязательно)</Label>
              <Input
                id="receipt-num"
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
                className="h-9 text-sm font-mono"
                placeholder="например, 200abc1234"
                data-testid="input-receipt-number"
              />
            </div>
            <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/40 transition-colors">
              <Checkbox
                checked={markedIssued}
                onCheckedChange={(v) => handleMarkIssued(!!v)}
                data-testid="checkbox-mark-issued"
              />
              <div className="text-sm">
                <div className="font-medium">Чек выдан в «Мой налог»</div>
                <div className="text-xs text-muted-foreground">Платёж от {dateStr} будет помечен зелёной галочкой.</div>
              </div>
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
