import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { invalidateResource } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, X, UserPlus, Mail, Phone, MessageSquare, Inbox, ArrowRight, ArrowLeft, Calendar } from "lucide-react";

import { useDocumentTitle } from "@/hooks/use-document-title";

interface Application {
  id: string;
  tutorId: string;
  name: string;
  contact: string;
  subject: string | null;
  grade: string | null;
  goal: string | null;
  message: string | null;
  status: string;
  studentId: string | null;
  createdAt: string;
}

const STATUS_FLOW: Array<{ key: string; label: string; color: string }> = [
  { key: "pending",         label: "Новая",      color: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  { key: "contacted",       label: "Связались",  color: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  { key: "trial_scheduled", label: "Пробный",    color: "bg-violet-500/10 text-violet-700 border-violet-500/30" },
  { key: "accepted",        label: "Принят",     color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  { key: "rejected",        label: "Отклонён",   color: "bg-muted text-muted-foreground border-border" },
];

function statusLabel(s: string) {
  return STATUS_FLOW.find(x => x.key === s)?.label || s;
}

function contactIcon(contact: string) {
  if (/\S+@\S+\.\S+/.test(contact)) return <Mail className="h-3.5 w-3.5" />;
  if (contact.startsWith("@") || contact.toLowerCase().includes("t.me")) return <MessageSquare className="h-3.5 w-3.5" />;
  return <Phone className="h-3.5 w-3.5" />;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function ApplicationsPage() {
  useDocumentTitle("Заявки");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");

  const { data: apps = [], isLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const invalidate = () => {
    invalidateResource("applications");
  };

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/applications/${id}/accept`);
      return res.json();
    },
    onSuccess: (data) => {
      invalidate();
      invalidateResource("students");
      toast({
        title: "Ученик добавлен!",
        description: `${data.student?.name || "Новый ученик"} появился в списке учеников.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Не удалось принять", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/applications/${id}/reject`);
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Заявка отклонена" }); },
    onError: (err: any) => { toast({ title: "Ошибка", description: err.message, variant: "destructive" }); },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/applications/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (err: any) => { toast({ title: "Не удалось переместить", description: err.message, variant: "destructive" }); },
  });

  const pending = apps.filter(a => a.status === "pending");
  const processed = apps.filter(a => a.status !== "pending");

  const grouped = STATUS_FLOW.reduce((acc, s) => {
    acc[s.key] = apps.filter(a => a.status === s.key);
    return acc;
  }, {} as Record<string, Application[]>);

  function nextStatus(s: string): string | null {
    const i = STATUS_FLOW.findIndex(x => x.key === s);
    if (i === -1 || i >= 2) return null; // can only go pending → contacted → trial_scheduled
    return STATUS_FLOW[i + 1].key;
  }
  function prevStatus(s: string): string | null {
    const i = STATUS_FLOW.findIndex(x => x.key === s);
    if (i <= 0 || i >= 3) return null;
    return STATUS_FLOW[i - 1].key;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <main className="lg:pl-16 pb-20 lg:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
          <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-applications-title">Заявки учеников</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Запросы от учеников через ваш публичный профиль и воронка работы с ними.
              </p>
            </div>
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList>
                <TabsTrigger value="list" data-testid="tab-list">Список</TabsTrigger>
                <TabsTrigger value="kanban" data-testid="tab-kanban">Воронка</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner /></div>
          ) : view === "list" ? (
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Новые</h2>
                  {pending.length > 0 && (
                    <Badge variant="default" className="text-xs" data-testid="badge-pending-count">{pending.length}</Badge>
                  )}
                </div>
                {pending.length === 0 ? (
                  <Card className="rounded-2xl border-dashed">
                    <CardContent className="p-10 text-center text-muted-foreground">
                      <Inbox className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm">Новых заявок пока нет.</p>
                      <p className="text-xs mt-1">Поделитесь ссылкой на публичный профиль, чтобы ученики могли вас найти.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {pending.map(app => (
                      <Card key={app.id} className="rounded-2xl" data-testid={`card-application-${app.id}`}>
                        <CardContent className="p-5">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-base" data-testid={`text-app-name-${app.id}`}>{app.name}</h3>
                                <span className="text-xs text-muted-foreground">{formatDate(app.createdAt)}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  {contactIcon(app.contact)}
                                  <span data-testid={`text-app-contact-${app.id}`}>{app.contact}</span>
                                </span>
                                {app.subject && <Badge variant="secondary" className="text-xs">{app.subject}</Badge>}
                                {app.grade && <Badge variant="outline" className="text-xs">{app.grade}</Badge>}
                                {app.goal && <Badge variant="outline" className="text-xs">Цель: {app.goal}</Badge>}
                              </div>
                              {app.message && (
                                <p className="mt-3 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                                  {app.message}
                                </p>
                              )}
                            </div>
                            <div className="flex sm:flex-col gap-2 shrink-0">
                              <Button
                                size="sm"
                                onClick={() => acceptMutation.mutate(app.id)}
                                disabled={acceptMutation.isPending}
                                className="flex-1 sm:flex-none gap-1.5"
                                data-testid={`button-accept-${app.id}`}
                              >
                                <UserPlus className="h-4 w-4" />
                                Принять
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRejectTarget(app)}
                                disabled={rejectMutation.isPending}
                                className="flex-1 sm:flex-none gap-1.5 text-muted-foreground"
                                data-testid={`button-reject-${app.id}`}
                              >
                                <X className="h-4 w-4" />
                                Отклонить
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              {processed.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Обработанные</h2>
                  <div className="space-y-2">
                    {processed.slice(0, 20).map(app => (
                      <Card key={app.id} className="rounded-xl opacity-70" data-testid={`card-processed-${app.id}`}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                            app.status === "accepted" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                          }`}>
                            {app.status === "accepted" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">{app.name}</span>
                              <span className="text-xs text-muted-foreground">{app.contact}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {statusLabel(app.status)} · {formatDate(app.createdAt)}
                            </div>
                          </div>
                          {app.status === "accepted" && app.studentId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/students`)}
                              data-testid={`button-open-student-${app.id}`}
                            >
                              Открыть
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            // ===== KANBAN VIEW =====
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3" data-testid="kanban-board">
              {STATUS_FLOW.map(col => (
                <div key={col.key} className="bg-muted/30 rounded-xl p-3 min-h-[200px]" data-testid={`kanban-col-${col.key}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${col.color}`}>
                      {col.label}
                    </span>
                    <span className="text-xs text-muted-foreground" data-testid={`kanban-count-${col.key}`}>{grouped[col.key]?.length || 0}</span>
                  </div>
                  <div className="space-y-2">
                    {(grouped[col.key] || []).length === 0 && (
                      <div className="text-xs text-muted-foreground/60 text-center py-6">Пусто</div>
                    )}
                    {(grouped[col.key] || []).map(app => {
                      const next = nextStatus(app.status);
                      const prev = prevStatus(app.status);
                      const isTerminal = app.status === "accepted" || app.status === "rejected";
                      return (
                        <Card key={app.id} className="rounded-lg shadow-sm hover-elevate" data-testid={`kanban-card-${app.id}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm truncate flex-1" data-testid={`kanban-name-${app.id}`}>{app.name}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              {contactIcon(app.contact)}
                              <span className="truncate">{app.contact}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {app.subject && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{app.subject}</Badge>}
                              {app.grade && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{app.grade}</Badge>}
                            </div>
                            {app.message && (
                              <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 mb-2 line-clamp-2">{app.message}</p>
                            )}
                            <div className="text-[10px] text-muted-foreground/70 mb-2">{formatDate(app.createdAt)}</div>
                            {!isTerminal && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {prev && (
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                    onClick={() => moveMutation.mutate({ id: app.id, status: prev })}
                                    disabled={moveMutation.isPending}
                                    title={`Назад в "${statusLabel(prev)}"`}
                                    data-testid={`button-prev-${app.id}`}>
                                    <ArrowLeft className="h-3 w-3" />
                                  </Button>
                                )}
                                {next && (
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                                    onClick={() => moveMutation.mutate({ id: app.id, status: next })}
                                    disabled={moveMutation.isPending}
                                    title={`Перевести в "${statusLabel(next)}"`}
                                    data-testid={`button-next-${app.id}`}>
                                    {next === "trial_scheduled" ? <Calendar className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                                    {statusLabel(next)}
                                  </Button>
                                )}
                                <div className="ml-auto flex gap-1">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600"
                                    onClick={() => acceptMutation.mutate(app.id)}
                                    disabled={acceptMutation.isPending}
                                    title="Принять (создать ученика)"
                                    data-testid={`button-kanban-accept-${app.id}`}>
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                                    onClick={() => setRejectTarget(app)}
                                    title="Отклонить"
                                    data-testid={`button-kanban-reject-${app.id}`}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {isTerminal && app.status === "accepted" && app.studentId && (
                              <Button size="sm" variant="outline" className="w-full h-7 text-xs"
                                onClick={() => setLocation("/students")}
                                data-testid={`button-kanban-open-${app.id}`}>
                                Открыть ученика
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={!!rejectTarget} onOpenChange={(v) => !v && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить заявку?</AlertDialogTitle>
            <AlertDialogDescription>
              Заявка от {rejectTarget?.name} будет помечена как отклонённая. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reject-cancel">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rejectTarget) rejectMutation.mutate(rejectTarget.id);
                setRejectTarget(null);
              }}
              data-testid="button-reject-confirm"
            >
              Отклонить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
