import { useState, useMemo } from "react";
import { Send, Mail, MessageSquare } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useStudents } from "@/hooks/use-tutor-data";

import { useDocumentTitle } from "@/hooks/use-document-title";
export default function CommPage() {
  useDocumentTitle("Сообщения");
  const { data: studentsData, isLoading } = useStudents();
  const students = useMemo(() => studentsData ?? [], [studentsData]);
  const activeStudents = students.filter((s) => s.isActive);

  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedRecipients.length === activeStudents.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(activeStudents.map((s) => s.id));
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      toast.error("Введите сообщение");
      return;
    }
    if (selectedRecipients.length === 0) {
      toast.error("Выберите получателей");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentIds: selectedRecipients,
          message: broadcastMessage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const parts: string[] = [];
        if (data.telegramCount > 0) parts.push(`${data.telegramCount} через Telegram`);
        if (data.chatCount - data.telegramCount > 0) parts.push(`${data.chatCount - data.telegramCount} в кабинет`);
        const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
        toast.success(`Отправлено ${data.sent} получателям${detail}`);
        setBroadcastMessage("");
        setSelectedRecipients([]);
      } else {
        const data = await res.json();
        toast.error(data.error || "Ошибка отправки");
      }
    } catch {
      toast.error("Ошибка отправки");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Рассылки" subtitle="Загрузка...">
        <div className="flex items-center justify-center py-20">
          <div className="text-muted-foreground">Загрузка...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="📨 Рассылки" subtitle="Массовые уведомления ученикам по email и мессенджерам.">
      <div className="space-y-6">
        <PageHero
          icon={<Send className="h-6 w-6 text-white" />}
          gradient="from-sky-600/80 via-blue-600/70 to-indigo-600/60"
          title="Рассылки и сообщения"
          subtitle="Напишите текст, выберите получателей — всех или конкретных — и отправьте. Ученики получат сообщение в личном кабинете и, если подключён Telegram-бот, сразу в мессенджере."
          badge="Рассылки"
        />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <Card className="rounded-2xl border-border/70 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Новая рассылка</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Сообщение</div>
                <Textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Напишите сообщение для рассылки..."
                  rows={5}
                  data-testid="textarea-broadcast-message"
                />
                <div className="text-xs text-muted-foreground mt-1 text-right">
                  {broadcastMessage.length}/2000
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Получатели ({selectedRecipients.length})</div>
                  <Button variant="ghost" size="sm" onClick={selectAll} data-testid="button-select-all-recipients">
                    {selectedRecipients.length === activeStudents.length ? "Снять все" : "Выбрать всех"}
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-xl border border-border/70 p-3">
                  {activeStudents.length > 0 ? (
                    activeStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent/50 cursor-pointer"
                        data-testid={`recipient-${student.id}`}
                      >
                        <Checkbox
                          checked={selectedRecipients.includes(student.id)}
                          onCheckedChange={() => toggleRecipient(student.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{student.name}</div>
                          <div className="text-xs text-muted-foreground">{student.subject}</div>
                        </div>
                        {student.email && (
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </label>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Нет активных учеников
                    </div>
                  )}
                </div>
              </div>

              <Button
                className="w-full gap-2"
                data-testid="button-send-broadcast"
                onClick={sendBroadcast}
                disabled={isSending || !broadcastMessage.trim() || selectedRecipients.length === 0}
              >
                <Send className="h-4 w-4" />
                {isSending ? "Отправка..." : `Отправить ${selectedRecipients.length > 0 ? `(${selectedRecipients.length})` : ""}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Каналы связи</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Личный кабинет</div>
                      <div className="text-xs text-muted-foreground">Чат в портале ученика</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">Активно</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-3">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Telegram</div>
                      <div className="text-xs text-muted-foreground">Ученики с привязанным ботом</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">Активно</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Шаблоны сообщений</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {[
                  { title: "Напоминание о занятии", text: "Напоминаю о нашем занятии завтра. Подготовьтесь к теме, которую мы обсудим." },
                  { title: "Домашнее задание проверено", text: "Я проверил(а) ваше домашнее задание. Результат и комментарий — в личном кабинете." },
                  { title: "Изменение расписания", text: "Информирую об изменении в нашем расписании. Пожалуйста, проверьте актуальное время занятия в кабинете." },
                  { title: "Оплата", text: "Напоминаю о необходимости пополнить баланс для предстоящих занятий." },
                ].map((template, i) => (
                  <button
                    key={i}
                    className="w-full text-left rounded-xl border border-border/70 bg-background/60 px-3 py-2 hover:bg-accent/50 transition-colors"
                    onClick={() => setBroadcastMessage(template.text)}
                    data-testid={`template-${i}`}
                  >
                    <div className="text-sm font-medium">{template.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{template.text}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}
