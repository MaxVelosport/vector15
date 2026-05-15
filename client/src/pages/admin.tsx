import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowLeft, Check, Crown, LogOut, Pencil, Plus, CircleDollarSign,
  Shield, User, Bot, Eye, EyeOff, Save, Loader2, Users, Search, Video,
  Zap, BarChart3, GraduationCap, Package, X, ChevronDown, ChevronUp,
  RefreshCw, Calendar, Mail, BookOpen, Star, ToggleLeft, ToggleRight,
  MessageSquare, HelpCircle, SendHorizontal, ChevronRight, TrendingUp, KeyRound,
  Activity, Cpu, Database, Clock, CheckCircle2, XCircle, AlertCircle, Server,
  CreditCard, Wifi, MemoryStick, HardDrive, Ticket, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trialDaysWord } from "@/lib/plural-ru";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { useTutors, useCreateTutor, useUpdateTutor } from "@/hooks/use-admin";
import { useSubscriptionPrices, useAdminUpdatePrices } from "@/hooks/use-subscription";
import { useLocation } from "wouter";
import { SUBSCRIPTION_LIMITS } from "@shared/schema";

import { useDocumentTitle } from "@/hooks/use-document-title";
const TIER_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
  pro: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  premium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
};

const TIER_NAMES: Record<string, string> = {
  free: "Старт",
  pro: "Базовый",
  premium: "Про",
};

// ─── Компонент «Диагностика» ─────────────────────────────────────────────────
interface DiagService { ok: boolean; message: string; latency?: number }
interface DiagResult {
  checkedAt: string;
  services: {
    supabase: DiagService; bbb: DiagService; openai: DiagService;
    telegram: DiagService; yookassa: DiagService;
  };
  dbStats: {
    tutors: number; students: number; lessons: number; payments: number;
    pendingPayments: number; todayPayments: number; todayRevenue: number;
  };
  system: {
    nodeVersion: string; uptime: number; memRss: number;
    memHeap: number; memHeapTotal: number; platform: string; pid: number; totalCheckTime: number;
  };
  subscriptionStats: { free: number; pro: number; premium: number; expiringSoon: number };
}

function ServiceCard({ name, icon: Icon, result }: { name: string; icon: any; result?: DiagService }) {
  if (!result) return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">Загрузка…</p>
        </div>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
  return (
    <Card className={`border-border/60 ${result.ok ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "bg-red-50/40 dark:bg-red-950/20"}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${result.ok ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-red-100 dark:bg-red-900/40"}`}>
          <Icon className={`h-4 w-4 ${result.ok ? "text-emerald-600" : "text-red-600"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{result.message}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {result.ok
            ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            : <XCircle className="h-5 w-5 text-red-500" />
          }
          {result.latency !== undefined && (
            <span className="text-[10px] text-muted-foreground">{result.latency}ms</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = "blue" }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  const c: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600", green: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600", purple: "bg-purple-500/10 text-purple-600",
    slate: "bg-slate-500/10 text-slate-600",
  };
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${c[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-base font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч ${m}м`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м ${seconds % 60}с`;
}

function DiagnosticsTab({ activeTab }: { activeTab: string }) {
  const { data, isLoading, refetch, isRefetching } = useQuery<DiagResult>({
    queryKey: ["/api/admin/diagnostics"],
    enabled: activeTab === "diagnostics",
    staleTime: 30_000,
    refetchInterval: activeTab === "diagnostics" ? 60_000 : false,
  });

  const allOk = data
    ? Object.values(data.services).every(s => s.ok)
    : null;

  if (activeTab !== "diagnostics") return null;

  return (
    <TabsContent value="diagnostics" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Диагностика системы</h2>
          <p className="text-sm text-muted-foreground">
            Состояние всех подсистем платформы в реальном времени
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="flex items-center gap-2">
              {allOk
                ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />Все системы работают
                  </Badge>
                : <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />Обнаружены проблемы
                  </Badge>
              }
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || isRefetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            Проверить
          </Button>
        </div>
      </div>

      {/* Last checked */}
      {data?.checkedAt && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Проверено: {format(new Date(data.checkedAt), "d MMM yyyy, HH:mm:ss", { locale: ru })}
          {" "}· Заняло {data.system.totalCheckTime}мс
        </p>
      )}

      {/* Services grid */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Внешние сервисы
        </h3>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {["База данных (Supabase)", "BigBlueButton", "OpenAI", "Telegram Bot", "YooKassa"].map(n => (
              <ServiceCard key={n} name={n} icon={Server} />
            ))}
          </div>
        ) : data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ServiceCard name="База данных (Supabase)" icon={Database} result={data.services.supabase} />
            <ServiceCard name="BigBlueButton" icon={Video} result={data.services.bbb} />
            <ServiceCard name="OpenAI" icon={Bot} result={data.services.openai} />
            <ServiceCard name="Telegram Bot" icon={MessageSquare} result={data.services.telegram} />
            <ServiceCard name="YooKassa" icon={CreditCard} result={data.services.yookassa} />
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Нажмите «Проверить» для запуска диагностики
          </div>
        )}
      </div>

      {/* DB Stats */}
      {data && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Статистика базы данных
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Users} label="Репетиторов" value={data.dbStats.tutors} color="purple" />
            <MetricCard icon={GraduationCap} label="Учеников" value={data.dbStats.students} color="blue" />
            <MetricCard icon={Calendar} label="Занятий" value={data.dbStats.lessons} color="green" />
            <MetricCard icon={CircleDollarSign} label="Платежей" value={data.dbStats.payments} color="amber" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 mt-3">
            <MetricCard icon={AlertCircle} label="Ожидают оплаты (YooKassa)" value={data.dbStats.pendingPayments} sub="pending-статус" color="amber" />
            <MetricCard icon={CreditCard} label="Платежей сегодня" value={data.dbStats.todayPayments} color="green" />
            <MetricCard icon={TrendingUp} label="Выручка сегодня" value={`${data.dbStats.todayRevenue.toLocaleString("ru")} ₽`} color="green" />
          </div>
        </div>
      )}

      {/* Subscription stats */}
      {data && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Подписки репетиторов
          </h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard icon={User} label="Старт (бесплатно)" value={data.subscriptionStats.free} color="slate" />
            <MetricCard icon={Shield} label="Базовый (Pro)" value={data.subscriptionStats.pro} color="blue" />
            <MetricCard icon={Crown} label="Про (Premium)" value={data.subscriptionStats.premium} color="amber" />
            <MetricCard icon={AlertCircle} label="Истекают через 7 дней" value={data.subscriptionStats.expiringSoon} color="amber" />
          </div>
        </div>
      )}

      {/* System metrics */}
      {data && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Системные метрики
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Clock} label="Время работы сервера" value={formatUptime(data.system.uptime)} color="green" />
            <MetricCard icon={MemoryStick} label="Память RSS" value={`${data.system.memRss} МБ`} sub={`Heap: ${data.system.memHeap}/${data.system.memHeapTotal} МБ`} color="blue" />
            <MetricCard icon={Server} label="Node.js" value={data.system.nodeVersion} sub={data.system.platform} color="slate" />
            <MetricCard icon={Cpu} label="PID процесса" value={data.system.pid} color="slate" />
          </div>
        </div>
      )}
    </TabsContent>
  );
}

// ─── Компонент «Промокоды» ────────────────────────────────────────────────────
interface PromoCodeRow {
  id: string;
  code: string;
  description: string | null;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  scope: 'all' | 'subscription' | 'lessons' | 'ai_packages';
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
}

const SCOPE_LABEL: Record<string, string> = {
  all: 'Все покупки',
  subscription: 'Подписка',
  lessons: 'Уроки',
  ai_packages: 'ИИ-пакеты',
};

function PromoCodesTab({ activeTab }: { activeTab: string }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromoCodeRow | null>(null);
  const [pendingDeletePromoId, setPendingDeletePromoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'percent' as 'percent' | 'fixed',
    discountValue: 10,
    scope: 'all' as PromoCodeRow['scope'],
    maxUses: '' as string,
    validUntil: '' as string,
    isActive: true,
  });

  const { data: promos = [], isLoading } = useQuery<PromoCodeRow[]>({
    queryKey: ['/api/admin/promo-codes'],
    enabled: activeTab === 'promo',
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiRequest('POST', '/api/admin/promo-codes', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/promo-codes'] });
      toast.success('Промокод создан');
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || 'Ошибка создания'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiRequest('PATCH', `/api/admin/promo-codes/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/promo-codes'] });
      toast.success('Промокод обновлён');
      setDialogOpen(false);
      setEditing(null);
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || 'Ошибка обновления'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/promo-codes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/promo-codes'] });
      toast.success('Промокод удалён');
    },
    onError: (e: any) => toast.error(e?.message || 'Ошибка удаления'),
  });

  function resetForm() {
    setForm({
      code: '', description: '', discountType: 'percent', discountValue: 10,
      scope: 'all', maxUses: '', validUntil: '', isActive: true,
    });
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(p: PromoCodeRow) {
    setEditing(p);
    setForm({
      code: p.code,
      description: p.description ?? '',
      discountType: p.discountType,
      discountValue: p.discountValue,
      scope: p.scope,
      maxUses: p.maxUses != null ? String(p.maxUses) : '',
      validUntil: p.validUntil ? new Date(p.validUntil).toISOString().slice(0, 10) : '',
      isActive: p.isActive,
    });
    setDialogOpen(true);
  }

  function submit() {
    const base: any = {
      description: form.description || null,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      scope: form.scope,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      validUntil: form.validUntil ? new Date(form.validUntil + 'T23:59:59').toISOString() : null,
      isActive: form.isActive,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, body: base });
    } else {
      createMut.mutate({ ...base, code: form.code.trim().toUpperCase() });
    }
  }

  if (activeTab !== 'promo') return null;

  return (
    <TabsContent value="promo" className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Промокоды</h2>
          <p className="text-sm text-muted-foreground">Управление скидочными кодами</p>
        </div>
        <Button onClick={openCreate} className="gap-2" data-testid="button-create-promo">
          <Plus className="h-4 w-4" />
          Создать промокод
        </Button>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
          ) : promos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Промокодов пока нет. Создайте первый.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Код</th>
                    <th className="text-left px-4 py-3">Скидка</th>
                    <th className="text-left px-4 py-3">Область</th>
                    <th className="text-left px-4 py-3">Использовано</th>
                    <th className="text-left px-4 py-3">Действует до</th>
                    <th className="text-left px-4 py-3">Статус</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => (
                    <tr key={p.id} className="border-t border-border/40 hover:bg-muted/30" data-testid={`row-promo-${p.id}`}>
                      <td className="px-4 py-3 font-mono font-semibold">{p.code}</td>
                      <td className="px-4 py-3">
                        {p.discountType === 'percent' ? `${p.discountValue}%` : `${p.discountValue} ₽`}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{SCOPE_LABEL[p.scope]}</td>
                      <td className="px-4 py-3">
                        {p.usedCount}{p.maxUses != null ? ` / ${p.maxUses}` : ''}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.validUntil ? format(new Date(p.validUntil), 'dd MMM yyyy', { locale: ru }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {p.isActive ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">Активен</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 dark:bg-slate-800">Выключен</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`button-edit-promo-${p.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => setPendingDeletePromoId(p.id)}
                          data-testid={`button-delete-promo-${p.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать промокод' : 'Новый промокод'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Код</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                placeholder="WELCOME10"
                disabled={!!editing}
                data-testid="input-promo-code"
              />
            </div>
            <div>
              <Label>Описание</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Скидка для новых пользователей"
                data-testid="input-promo-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Тип</Label>
                <Select value={form.discountType} onValueChange={(v: any) => setForm({ ...form, discountType: v })}>
                  <SelectTrigger data-testid="select-promo-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Процент</SelectItem>
                    <SelectItem value="fixed">Рубли</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.discountType === 'percent' ? 'Скидка, %' : 'Скидка, ₽'}</Label>
                <Input
                  type="number" min={1}
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                  data-testid="input-promo-value"
                />
              </div>
            </div>
            <div>
              <Label>Применяется к</Label>
              <Select value={form.scope} onValueChange={(v: any) => setForm({ ...form, scope: v })}>
                <SelectTrigger data-testid="select-promo-scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все покупки</SelectItem>
                  <SelectItem value="subscription">Подписка</SelectItem>
                  <SelectItem value="lessons">Уроки</SelectItem>
                  <SelectItem value="ai_packages">ИИ-пакеты</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Лимит использований</Label>
                <Input
                  type="number" min={1}
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  placeholder="∞"
                  data-testid="input-promo-max-uses"
                />
              </div>
              <div>
                <Label>Действует до</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  data-testid="input-promo-valid-until"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                data-testid="checkbox-promo-active"
              />
              Активен
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
              <Button
                onClick={submit}
                disabled={createMut.isPending || updateMut.isPending}
                data-testid="button-save-promo"
              >
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDeletePromoId}
        title="Удалить промокод?"
        description="Промокод будет удалён. Уже использованные скидки останутся в силе."
        confirmText="Удалить"
        onConfirm={() => { deleteMut.mutate(pendingDeletePromoId!); setPendingDeletePromoId(null); }}
        onCancel={() => setPendingDeletePromoId(null)}
      />
    </TabsContent>
  );
}

// ─── Компонент «Платформа» ────────────────────────────────────────────────────
function PlatformTab({ activeTab }: { activeTab: string }) {
  const qc = useQueryClient();

  // Настройки платформы из БД
  const { data: pSettings, isLoading: psLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/platform-settings"],
    enabled: activeTab === "platform",
  });

  // Статус сервисов — запрашивается при открытии вкладки
  const { data: svcStatus, isLoading: svcLoading, refetch: refetchStatus } = useQuery<{
    supabase: { ok: boolean; message: string };
    bbb:      { ok: boolean; message: string };
    openai:   { ok: boolean; message: string };
    telegram: { ok: boolean; message: string };
  }>({
    queryKey: ["/api/admin/platform-status"],
    enabled: activeTab === "platform",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Форма — инициализируется из данных БД
  const [form, setForm] = useState({
    app_url: "", openai_api_key: "", telegram_bot_token: "",
    bbb_url: "", bbb_secret: "",
    trial_days: "30",
  });
  const [showPlatformKeys, setShowPlatformKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (pSettings) {
      setForm({
        app_url:            pSettings.app_url            || "",
        openai_api_key:     pSettings.openai_api_key     || "",
        telegram_bot_token: pSettings.telegram_bot_token || "",
        bbb_url:            pSettings.bbb_url            || "",
        bbb_secret:         pSettings.bbb_secret         || "",
        trial_days:         pSettings.trial_days         ?? "30",
      });
    }
  }, [pSettings]);

  const saveSettings = useMutation({
    mutationFn: async (data: typeof form) => {
      // Приводим trial_days к числу 0..365 прямо на клиенте
      const trialNum = Math.max(0, Math.min(365, parseInt(data.trial_days || "0", 10) || 0));
      const payload = { ...data, trial_days: String(trialNum) };
      const res = await fetch("/api/admin/platform-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json())?.error || ""; } catch {}
        throw new Error(detail || `Ошибка сохранения (HTTP ${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Настройки платформы сохранены");
      qc.invalidateQueries({ queryKey: ["/api/admin/platform-settings"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/platform-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleKey = (k: string) => setShowPlatformKeys(v => ({ ...v, [k]: !v[k] }));

  const SvcCard = ({ label, icon, status }: { label: string; icon: any; status?: { ok: boolean; message: string } }) => {
    const Icon = icon;
    return (
      <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
        svcLoading ? "border-border/50 bg-muted/30" :
        !status   ? "border-border/50 bg-muted/30" :
        status.ok ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/20" :
                    "border-red-500/30 bg-red-50/50 dark:bg-red-950/20"
      }`}>
        <Icon className={`h-5 w-5 shrink-0 ${
          svcLoading ? "text-muted-foreground" :
          !status   ? "text-muted-foreground" :
          status.ok ? "text-green-600 dark:text-green-400" :
                      "text-red-600 dark:text-red-400"
        }`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground truncate">
            {svcLoading ? "Проверка..." : status ? status.message : "—"}
          </div>
        </div>
        <div className={`h-2 w-2 rounded-full shrink-0 ${
          svcLoading ? "bg-muted-foreground/40 animate-pulse" :
          !status   ? "bg-muted-foreground/40" :
          status.ok ? "bg-green-500" : "bg-red-500"
        }`} />
      </div>
    );
  };

  const SecretField = ({ field, label, hint, placeholder }: { field: keyof typeof form; label: string; hint?: string; placeholder?: string }) => (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showPlatformKeys[field] ? "text" : "password"}
            value={form[field]}
            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            placeholder={placeholder || "Встроенное значение активно"}
            className="font-mono text-sm pr-9"
            data-testid={`input-platform-${field}`}
          />
          <button type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => toggleKey(field)}
          >
            {showPlatformKeys[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {form[field] && (
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={() => setForm(f => ({ ...f, [field]: "" }))} title="Очистить (вернуть встроенное значение)"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {!form[field] && (
        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Zap className="h-3 w-3" />
          Используется встроенное значение из кода
        </p>
      )}
    </div>
  );

  if (activeTab !== "platform") return null;

  return (
    <TabsContent value="platform" className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Состояние платформы</h2>
          <p className="text-sm text-muted-foreground">Статус сервисов и конфигурация ключей</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetchStatus()} disabled={svcLoading}>
          {svcLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Проверить
        </Button>
      </div>

      {/* Статус сервисов */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Статус сервисов
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SvcCard label="Supabase (База данных)" icon={Package}    status={svcStatus?.supabase} />
          <SvcCard label="BigBlueButton (Видео)"  icon={Video}      status={svcStatus?.bbb} />
          <SvcCard label="OpenAI (Искусственный интеллект)" icon={Bot} status={svcStatus?.openai} />
          <SvcCard label="Telegram-бот"           icon={MessageSquare} status={svcStatus?.telegram} />
        </CardContent>
      </Card>

      {/* Настройки ключей */}
      {psLoading ? (
        <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                Конфигурация платформы
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Пустое поле = используется встроенное значение. Заполните для переопределения.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* App URL */}
              <div>
                <Label className="text-sm font-medium">URL приложения (домен)</Label>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Используется в Telegram deep-links и платёжных ссылках. Пример: https://tvoyvector.ru
                </p>
                <Input
                  type="url"
                  value={form.app_url}
                  onChange={e => setForm(f => ({ ...f, app_url: e.target.value }))}
                  placeholder="Встроенное: https://tvoyvector.ru"
                  data-testid="input-platform-app_url"
                />
                {!form.app_url && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Используется встроенное значение
                  </p>
                )}
              </div>

              <hr className="border-border/50" />

              {/* OpenAI */}
              <SecretField
                field="openai_api_key"
                label="OpenAI API Key"
                hint="GPT-4o и GPT-4o-mini для ИИ-помощника. Встроенный ключ используется по умолчанию."
                placeholder="sk-..."
              />

              {/* Telegram */}
              <SecretField
                field="telegram_bot_token"
                label="Telegram Bot Token"
                hint="Токен бота из @BotFather. Встроенный токен запускает бота автоматически при старте."
                placeholder="1234567890:ABC..."
              />

              <hr className="border-border/50" />

              {/* BBB */}
              <div>
                <Label className="text-sm font-medium">URL сервера BigBlueButton</Label>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Пример: https://bbb.myserver.ru/bigbluebutton/api/
                </p>
                <Input
                  type="url"
                  value={form.bbb_url}
                  onChange={e => setForm(f => ({ ...f, bbb_url: e.target.value }))}
                  placeholder="Встроенный BBB сервер активен"
                  data-testid="input-platform-bbb_url"
                />
                {!form.bbb_url && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Используется встроенное значение
                  </p>
                )}
              </div>

              <SecretField
                field="bbb_secret"
                label="BBB Secret (секретный ключ)"
                hint="Найти: bbb-conf --secret на сервере BBB"
                placeholder="Встроенный секрет BBB активен"
              />
            </CardContent>
          </Card>

          {/* Триал для новых репетиторов */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                Пробный период для новых репетиторов
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Сколько дней после регистрации у репетитора будет полный доступ (тариф Pro).
                По окончании — автоматически переводится на «Старт». Поставьте 0, чтобы отключить триал
                (тогда исчезнут упоминания бесплатного периода на лендинге).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[0, 7, 14, 30].map((d) => {
                  const active = String(d) === String(form.trial_days);
                  return (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => setForm(f => ({ ...f, trial_days: String(d) }))}
                      data-testid={`button-trial-preset-${d}`}
                    >
                      {d === 0 ? "Без триала" : `${d} ${trialDaysWord(d)}`}
                    </Button>
                  );
                })}
              </div>
              <div>
                <Label className="text-sm font-medium">Своё значение (0–365)</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  value={form.trial_days}
                  onChange={e => setForm(f => ({ ...f, trial_days: e.target.value.replace(/[^0-9]/g, "") }))}
                  placeholder="30"
                  className="mt-1.5 w-32"
                  data-testid="input-trial-days"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {form.trial_days === "0" || form.trial_days === ""
                    ? "Триал выключен. На лендинге текст про бесплатный период скрыт."
                    : `Новые репетиторы получат ${form.trial_days} ${trialDaysWord(Number(form.trial_days) || 0)} полного доступа бесплатно.`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Button onClick={() => saveSettings.mutate(form)} disabled={saveSettings.isPending} className="gap-2">
            {saveSettings.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Сохранить настройки платформы
          </Button>

          <Card className="border-border/50 bg-muted/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Приоритет настроек:</strong>{" "}
                Переменные среды (env) → Значения из базы данных → Встроенные константы.
                Очистите поле для возврата к встроенному значению. Настройки ИИ-лимитов — на вкладке «ИИ».
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </TabsContent>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "primary" }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-600",
    amber: "bg-amber-500/10 text-amber-600",
    green: "bg-emerald-500/10 text-emerald-600",
    purple: "bg-purple-500/10 text-purple-600",
  };
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colorMap[color] || colorMap.primary} shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentsTab({ activeTab }: { activeTab: string }) {
  const [subTab, setSubTab] = useState<"students" | "subscriptions">("students");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pendingRefund, setPendingRefund] = useState<{ id: string; amount: number } | null>(null);
  const qc = useQueryClient();

  const { data: studentPayments = [], isLoading: loadingP } = useQuery<any[]>({
    queryKey: ["/api/admin/payments", statusFilter],
    queryFn: async () => {
      const r = await fetch(`/api/admin/payments?status=${statusFilter}&limit=500`, { credentials: "include" });
      if (!r.ok) throw new Error("Ошибка загрузки");
      return r.json();
    },
    enabled: activeTab === "payments" && subTab === "students",
  });

  const { data: subPayments = [], isLoading: loadingS } = useQuery<any[]>({
    queryKey: ["/api/admin/subscription-payments", statusFilter],
    queryFn: async () => {
      const r = await fetch(`/api/admin/subscription-payments?status=${statusFilter}&limit=500`, { credentials: "include" });
      if (!r.ok) throw new Error("Ошибка загрузки");
      return r.json();
    },
    enabled: activeTab === "payments" && subTab === "subscriptions",
  });

  const refundMut = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/admin/payments/${id}/refund`, {}),
    onSuccess: () => {
      toast.success("Возврат оформлен");
      qc.invalidateQueries({ queryKey: ["/api/admin/payments"] });
    },
    onError: (e: any) => toast.error(e.message || "Ошибка возврата"),
  });

  if (activeTab !== "payments") return null;

  const list = subTab === "students" ? studentPayments : subPayments;
  const loading = subTab === "students" ? loadingP : loadingS;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? list.filter((p: any) =>
        (p.tutorName || "").toLowerCase().includes(q) ||
        (p.tutorEmail || "").toLowerCase().includes(q) ||
        (p.studentName || "").toLowerCase().includes(q) ||
        String(p.amount || "").includes(q)
      )
    : list;

  const totalAmount = filtered
    .filter((p: any) =>
      subTab === "students"
        ? (p.yookassaStatus === "succeeded" || !p.yookassaPaymentId)
        : p.status === "succeeded"
    )
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  const fmtDate = (d?: string) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd MMM yyyy HH:mm", { locale: ru }); } catch { return d; }
  };

  const statusBadge = (p: any) => {
    if (subTab === "subscriptions") {
      const s = p.status || "pending";
      const variant = s === "succeeded" ? "default" : s === "canceled" ? "destructive" : "secondary";
      const label = s === "succeeded" ? "Оплачен" : s === "canceled" ? "Отменён" : "Ожидание";
      return <Badge variant={variant as any}>{label}</Badge>;
    }
    if (!p.yookassaPaymentId) return <Badge variant="outline">Ручной</Badge>;
    const s = p.yookassaStatus;
    if (s === "succeeded") return <Badge>Оплачен</Badge>;
    if (s === "canceled") return <Badge variant="destructive">Отменён</Badge>;
    if (s === "refunded") return <Badge variant="secondary">Возврат</Badge>;
    return <Badge variant="secondary">Ожидание</Badge>;
  };

  return (
    <TabsContent value="payments" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Платежи и подписки</h2>
        <p className="text-sm text-muted-foreground">Управление всеми финансовыми операциями платформы</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border p-1">
          <Button
            size="sm"
            variant={subTab === "students" ? "default" : "ghost"}
            onClick={() => setSubTab("students")}
            data-testid="button-subtab-student-payments"
          >
            Платежи учеников
          </Button>
          <Button
            size="sm"
            variant={subTab === "subscriptions" ? "default" : "ghost"}
            onClick={() => setSubTab("subscriptions")}
            data-testid="button-subtab-subscription-payments"
          >
            Подписки репетиторов
          </Button>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          {["all", "succeeded", "pending", "canceled"].concat(subTab === "students" ? ["refunded", "manual"] : []).map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "ghost"}
              onClick={() => setStatusFilter(s)}
              data-testid={`button-filter-${s}`}
            >
              {s === "all" ? "Все" : s === "succeeded" ? "Оплачено" : s === "pending" ? "Ожидание" : s === "canceled" ? "Отменено" : s === "refunded" ? "Возврат" : "Ручные"}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Поиск по имени, email, сумме..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          data-testid="input-search-payments"
        />
        <div className="ml-auto text-sm">
          Найдено: <b data-testid="text-payments-count">{filtered.length}</b> · Сумма: <b data-testid="text-payments-total">{totalAmount.toLocaleString("ru-RU")} ₽</b>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Платежи не найдены</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr className="text-left">
                    <th className="p-3 font-medium">Дата</th>
                    <th className="p-3 font-medium">Репетитор</th>
                    {subTab === "students" && <th className="p-3 font-medium">Ученик</th>}
                    {subTab === "subscriptions" && <th className="p-3 font-medium">Тариф</th>}
                    <th className="p-3 font-medium text-right">Сумма</th>
                    <th className="p-3 font-medium">Статус</th>
                    {subTab === "students" && <th className="p-3 font-medium">Способ</th>}
                    <th className="p-3 font-medium text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p: any) => (
                    <tr key={p.id} className="border-b hover:bg-muted/20" data-testid={`row-payment-${p.id}`}>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDate(p.createdAt)}</td>
                      <td className="p-3">
                        <div className="font-medium">{p.tutorName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.tutorEmail || "—"}</div>
                      </td>
                      {subTab === "students" && <td className="p-3">{p.studentName || "—"}</td>}
                      {subTab === "subscriptions" && (
                        <td className="p-3">
                          <Badge variant="outline" className="uppercase">{p.tier}</Badge>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {p.period === "yearly" ? "год" : "месяц"}
                          </span>
                        </td>
                      )}
                      <td className="p-3 text-right font-mono whitespace-nowrap">{Number(p.amount).toLocaleString("ru-RU")} ₽</td>
                      <td className="p-3">{statusBadge(p)}</td>
                      {subTab === "students" && <td className="p-3 text-xs">{p.method || "—"}</td>}
                      <td className="p-3 text-right">
                        {subTab === "students" && p.yookassaPaymentId && p.yookassaStatus === "succeeded" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPendingRefund({ id: p.id, amount: Number(p.amount) })}
                            disabled={refundMut.isPending}
                            data-testid={`button-refund-${p.id}`}
                          >
                            Возврат
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!pendingRefund}
        title={`Оформить возврат ${pendingRefund?.amount?.toLocaleString("ru-RU") ?? ""} ₽?`}
        description="Возврат будет выполнен через ЮKassa. Баланс ученика будет уменьшен на сумму возврата."
        confirmText="Оформить возврат"
        onConfirm={() => { refundMut.mutate(pendingRefund!.id); setPendingRefund(null); }}
        onCancel={() => setPendingRefund(null)}
      />
    </TabsContent>
  );
}

export default function AdminPage() {
  useDocumentTitle("Админ-панель");
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: tutors, isLoading, refetch: refetchTutors } = useTutors();
  const { data: subscriptionPrices, isLoading: pricesLoading } = useSubscriptionPrices();
  const createTutorMutation = useCreateTutor();
  const updateTutorMutation = useUpdateTutor();
  const updatePricesMutation = useAdminUpdatePrices();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("overview");
  const [tutorSearch, setTutorSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [aiCreditsDialogOpen, setAiCreditsDialogOpen] = useState(false);
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [aiCreditsTarget, setAiCreditsTarget] = useState<"tutor" | "student">("tutor");
  const [aiCreditsAmount, setAiCreditsAmount] = useState("100");

  // Subscription prices
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceForm, setPriceForm] = useState({ priceMonthly: 0, priceYearly: 0 });

  // Create tutor form
  const [newTutor, setNewTutor] = useState({
    name: "", email: "", password: "", subjects: [] as string[],
    subscription: "free" as "free" | "pro" | "premium", subscriptionUntil: "",
  });

  // Edit subscription form
  const [editSubscription, setEditSubscription] = useState<"free" | "pro" | "premium">("free");
  const [editSubscriptionUntil, setEditSubscriptionUntil] = useState("");

  // Telegram bot (platform-wide)
  const [showBotToken, setShowBotToken] = useState(false);
  const [botTokenInput, setBotTokenInput] = useState("");

  const { data: tgBotStatus, refetch: refetchTgBot } = useQuery<{ botRunning: boolean; botUsername: string | null }>({
    queryKey: ["/api/telegram/status"],
    enabled: !!user?.isAdmin,
    select: (d: any) => ({ botRunning: d.botRunning, botUsername: d.botUsername }),
  });

  const saveBotToken = useMutation({
    mutationFn: () => apiRequest("POST", "/api/telegram/admin/token", { token: botTokenInput.trim() }).then(r => r.json()),
    onSuccess: (data: any) => {
      toast.success(`Бот @${data.botUsername || "?"} запущен!`);
      setBotTokenInput("");
      refetchTgBot();
    },
    onError: () => toast.error("Не удалось запустить бота. Проверьте токен."),
  });

  const removeBotToken = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/telegram/admin/token").then(r => r.json()),
    onSuccess: () => { toast.success("Бот остановлен"); refetchTgBot(); },
  });

  // AI keys
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showDeepSeekKey, setShowDeepSeekKey] = useState(false);
  const [showBbbSecret, setShowBbbSecret] = useState(false);
  const [aiForm, setAiForm] = useState({
    openai_api_key: "",
    deepseek_api_key: "",
    daily_limit_openai: "50",
    daily_limit_deepseek: "100",
    "daily_limit_gpt4o-mini": "100",
    default_model: "openai",
    bbb_url: "",
    bbb_secret: "",
  });

  // Feature flags
  const [flagTutorId, setFlagTutorId] = useState("");
  const [flagTogglingId, setFlagTogglingId] = useState<string | null>(null);

  // Support tickets
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<"all" | "open" | "answered" | "closed">("all");

  // Per-tutor analytics
  const [analyticsStudentId, setAnalyticsStudentId] = useState<string | null>(null);
  const [analyticsTutorId, setAnalyticsTutorId] = useState<string | null>(null);

  // Password change dialog
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<{ id: string; name: string; email: string | null; type: "tutor" | "student" } | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwShow, setPwShow] = useState(false);

  // Delete tutor dialog
  const [deleteTutorDialogOpen, setDeleteTutorDialogOpen] = useState(false);
  const [deleteTutorTarget, setDeleteTutorTarget] = useState<{ id: string; name: string } | null>(null);

  // Edit tutor info dialog
  const [editInfoDialogOpen, setEditInfoDialogOpen] = useState(false);
  const [editInfoForm, setEditInfoForm] = useState({ name: "", email: "" });
  const [editInfoTutorId, setEditInfoTutorId] = useState<string | null>(null);

  // Data queries
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<{
    totalTutors: number;
    byTier: { free: number; pro: number; premium: number };
    activeSubscriptions: number;
    totalStudents: number;
    totalAiCredits: number;
  }>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user?.isAdmin,
  });

  const { data: allStudents, isLoading: studentsLoading, refetch: refetchStudents } = useQuery<any[]>({
    queryKey: ["/api/admin/students"],
    enabled: !!user?.isAdmin,
  });

  const { data: aiSettings, isLoading: aiSettingsLoading } = useQuery<Record<string, string>>({
    queryKey: ["admin-ai-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ai-settings", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  useEffect(() => {
    if (aiSettings) {
      setAiForm({
        openai_api_key: aiSettings.openai_api_key || "",
        deepseek_api_key: aiSettings.deepseek_api_key || "",
        daily_limit_openai: aiSettings.daily_limit_openai || "50",
        daily_limit_deepseek: aiSettings.daily_limit_deepseek || "100",
        "daily_limit_gpt4o-mini": aiSettings["daily_limit_gpt4o-mini"] || "100",
        default_model: aiSettings.default_model || "openai",
        bbb_url: aiSettings.bbb_url || "",
        bbb_secret: aiSettings.bbb_secret || "",
      });
    }
  }, [aiSettings]);

  const saveAiSettings = useMutation({
    mutationFn: async (data: typeof aiForm) => {
      const res = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Настройки ИИ сохранены");
      queryClient.invalidateQueries({ queryKey: ["admin-ai-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const giveAiCreditsMutation = useMutation({
    mutationFn: async ({ targetId, targetType, credits }: { targetId: string; targetType: "tutor" | "student"; credits: number }) => {
      const url = targetType === "tutor"
        ? `/api/admin/tutors/${targetId}/ai-credits`
        : `/api/admin/students/${targetId}/ai-credits`;
      const res = await apiRequest("POST", url, { credits });
      return res;
    },
    onSuccess: () => {
      toast.success("ИИ-кредиты успешно выданы");
      setAiCreditsDialogOpen(false);
      setAiCreditsAmount("100");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Feature flags query
  const { data: featureFlags = [], isLoading: flagsLoading, refetch: refetchFlags } = useQuery<any[]>({
    queryKey: ["/api/admin/feature-flags"],
    enabled: !!user?.isAdmin && activeTab === "flags",
  });

  const flagsByTutor = featureFlags.reduce((acc: Record<string, any[]>, f: any) => {
    if (!acc[f.tutorId]) acc[f.tutorId] = [];
    acc[f.tutorId].push(f);
    return acc;
  }, {});

  // Support tickets query
  const { data: supportTickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery<any[]>({
    queryKey: ["/api/admin/tickets"],
    enabled: !!user?.isAdmin && activeTab === "support",
  });

  const { data: ticketDetail } = useQuery<{ ticket: any; messages: any[] }>({
    queryKey: ["/api/admin/tickets", selectedTicketId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tickets/${selectedTicketId}/messages`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedTicketId,
  });

  const filteredTickets = supportTickets.filter(t => ticketStatusFilter === "all" || t.status === ticketStatusFilter);

  const selectedTutor = tutors?.find((t) => t.id === selectedTutorId);
  const selectedStudent = allStudents?.find((s) => s.id === selectedStudentId);

  const handleCreateTutor = () => {
    if (!newTutor.name || !newTutor.email || !newTutor.password) {
      toast.error("Заполните все обязательные поля");
      return;
    }
    createTutorMutation.mutate(
      { ...newTutor, subscriptionUntil: newTutor.subscriptionUntil || null },
      {
        onSuccess: () => {
          toast.success("Репетитор создан");
          setCreateDialogOpen(false);
          setNewTutor({ name: "", email: "", password: "", subjects: [], subscription: "free", subscriptionUntil: "" });
          refetchStats();
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  const handleUpdateSubscription = () => {
    if (!selectedTutorId) return;
    updateTutorMutation.mutate(
      { id: selectedTutorId, updates: { subscription: editSubscription, subscriptionUntil: editSubscriptionUntil || null } },
      {
        onSuccess: () => {
          toast.success("Подписка обновлена");
          setEditDialogOpen(false);
          refetchStats();
        },
        onError: () => toast.error("Ошибка при обновлении подписки"),
      }
    );
  };

  const openEditDialog = (tutorId: string, subscription: string, subscriptionUntil: Date | null) => {
    setSelectedTutorId(tutorId);
    setEditSubscription(subscription as "free" | "pro" | "premium");
    setEditSubscriptionUntil(subscriptionUntil ? format(subscriptionUntil, "yyyy-MM-dd") : "");
    setEditDialogOpen(true);
  };

  const openAiCreditsDialog = (id: string, type: "tutor" | "student") => {
    if (type === "tutor") setSelectedTutorId(id);
    else setSelectedStudentId(id);
    setAiCreditsTarget(type);
    setAiCreditsAmount("100");
    setAiCreditsDialogOpen(true);
  };

  const openPasswordDialog = (id: string, name: string, email: string | null, type: "tutor" | "student") => {
    setPwTarget({ id, name, email, type });
    setPwValue("");
    setPwShow(false);
    setPwDialogOpen(true);
  };

  const changePasswordMutation = useMutation({
    mutationFn: async ({ id, type, password }: { id: string; type: "tutor" | "student"; password: string }) => {
      const url = type === "tutor" ? `/api/admin/tutors/${id}/password` : `/api/admin/students/${id}/password`;
      const res = await apiRequest("PATCH", url, { password });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Пароль успешно изменён");
      setPwDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blockTutorMutation = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/tutors/${id}/block`, { blocked });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Ошибка"); }
      return res.json();
    },
    onSuccess: (_, { blocked }) => {
      toast.success(blocked ? "Репетитор заблокирован" : "Репетитор разблокирован");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTutorMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/tutors/${id}`);
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Ошибка"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Репетитор удалён");
      setDeleteTutorDialogOpen(false);
      setDeleteTutorTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      refetchStats();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editInfoMutation = useMutation({
    mutationFn: async ({ id, name, email }: { id: string; name: string; email: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/tutors/${id}`, { name, email });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Ошибка"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Данные репетитора обновлены");
      setEditInfoDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportTutorsCsv = () => {
    if (!tutors?.length) return;
    const rows = [
      ["Имя", "Email", "Тариф", "Подписка до", "Учеников", "Заблокирован", "Дата регистрации"],
      ...tutors.map(t => {
        const studentCount = allStudents?.filter(s => s.tutorId === t.id).length ?? 0;
        return [
          t.name,
          t.email,
          TIER_NAMES[t.subscription] || t.subscription,
          t.subscriptionUntil ? format(new Date(t.subscriptionUntil), "dd.MM.yyyy") : "—",
          studentCount.toString(),
          (t as any).isBlocked ? "Да" : "Нет",
          t.createdAt ? format(new Date(t.createdAt), "dd.MM.yyyy") : "—",
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `tutors_${format(new Date(), "yyyyMMdd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV-файл скачан");
  };

  const filteredTutors = tutors?.filter(t =>
    !tutorSearch ||
    t.name.toLowerCase().includes(tutorSearch.toLowerCase()) ||
    t.email.toLowerCase().includes(tutorSearch.toLowerCase())
  );

  const filteredStudents = allStudents?.filter(s =>
    !studentSearch ||
    s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.tutorName?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (!user?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <div className="text-center">
          <Shield className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-semibold">Доступ запрещён</h1>
          <p className="mt-2 text-sm text-muted-foreground">Эта страница доступна только администраторам.</p>
          <Button className="mt-6" onClick={() => setLocation("/")}>На главную</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-15" />
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-35" />

      <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <Shield className="h-3 w-3" />
              <span>Панель администратора · {user?.name}</span>
            </div>
            <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
              Управление платформой
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetchStats(); refetchTutors(); refetchStudents(); }} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Обновить
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              На главную
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout()} className="gap-2">
              <LogOut className="h-4 w-4" />
              Выйти
            </Button>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Обзор
            </TabsTrigger>
            <TabsTrigger value="tutors" className="gap-2">
              <User className="h-4 w-4" />
              Репетиторы
              {tutors && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{tutors.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              Ученики
              {allStudents && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{allStudents.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="prices" className="gap-2">
              <CircleDollarSign className="h-4 w-4" />
              Цены
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="h-4 w-4" />
              ИИ
            </TabsTrigger>
            <TabsTrigger value="flags" className="gap-2">
              <ToggleRight className="h-4 w-4" />
              Флаги
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Поддержка
              {supportTickets.filter(t => t.status === 'open').length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">{supportTickets.filter(t => t.status === 'open').length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2" data-testid="tab-payments">
              <CreditCard className="h-4 w-4" />
              Платежи
            </TabsTrigger>
            <TabsTrigger value="promo" className="gap-2" data-testid="tab-promo">
              <Ticket className="h-4 w-4" />
              Промокоды
            </TabsTrigger>
            <TabsTrigger value="platform" className="gap-2">
              <Shield className="h-4 w-4" />
              Платформа
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="gap-2">
              <Activity className="h-4 w-4" />
              Диагностика
            </TabsTrigger>
          </TabsList>

          {/* ─── ОБЗОР ────────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Обзор платформы</h2>
              <p className="text-sm text-muted-foreground">Ключевые метрики и статистика</p>
            </div>

            {statsLoading ? (
              <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard icon={Users} label="Всего репетиторов" value={stats?.totalTutors ?? 0} color="primary" />
                  <StatCard icon={GraduationCap} label="Всего учеников" value={stats?.totalStudents ?? 0} color="blue" />
                  <StatCard icon={Crown} label="Активных подписок" value={stats?.activeSubscriptions ?? 0} sub="Pro + Про" color="amber" />
                  <StatCard icon={Zap} label="ИИ-кредиты репетиторов" value={stats?.totalAiCredits ?? 0} sub="в пакетах" color="purple" />
                </div>

                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" />
                      Распределение по тарифам
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {(["free", "pro", "premium"] as const).map(tier => {
                        const count = stats?.byTier[tier] ?? 0;
                        const total = stats?.totalTutors || 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={tier} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${TIER_COLORS[tier]}`}>
                                {TIER_NAMES[tier]}
                              </span>
                              <span className="font-bold">{count}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-2 rounded-full ${tier === "free" ? "bg-slate-400" : tier === "pro" ? "bg-blue-500" : "bg-amber-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">{pct}% от всех</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        Лимиты тарифов
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(["free", "pro", "premium"] as const).map(tier => {
                          const limits = SUBSCRIPTION_LIMITS[tier];
                          return (
                            <div key={tier} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TIER_COLORS[tier]}`}>
                                {TIER_NAMES[tier]}
                              </span>
                              <div className="text-right text-xs text-muted-foreground space-y-0.5">
                                <div>{limits.maxStudents} уч. · {limits.aiChecksPerDay} ИИ/день</div>
                                <div>{limits.aiTaskGenPerWeek} генераций/нед.</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        Быстрые действия
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button className="w-full gap-2" size="sm" onClick={() => { setActiveTab("tutors"); setCreateDialogOpen(true); }}>
                        <Plus className="h-4 w-4" />
                        Создать репетитора
                      </Button>
                      <Button className="w-full gap-2" variant="outline" size="sm" onClick={() => setActiveTab("tutors")}>
                        <Crown className="h-4 w-4" />
                        Управление подписками
                      </Button>
                      <Button className="w-full gap-2" variant="outline" size="sm" onClick={() => setActiveTab("students")}>
                        <GraduationCap className="h-4 w-4" />
                        Все ученики
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* ─── РЕПЕТИТОРЫ ───────────────────────────────────────────── */}
          <TabsContent value="tutors" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Репетиторы</h2>
                <p className="text-sm text-muted-foreground">Всего: {tutors?.length ?? 0}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по имени или email"
                    className="pl-9 h-9 w-64"
                    value={tutorSearch}
                    onChange={e => setTutorSearch(e.target.value)}
                    data-testid="input-search-tutors"
                  />
                </div>
                <Button variant="outline" size="sm" className="gap-2 h-9 shrink-0" onClick={exportTutorsCsv} data-testid="button-export-tutors-csv">
                  <TrendingUp className="h-4 w-4" />
                  CSV
                </Button>
                <Button className="gap-2 shrink-0" onClick={() => setCreateDialogOpen(true)} data-testid="button-create-tutor">
                  <Plus className="h-4 w-4" />
                  Создать
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Spinner className="h-8 w-8" /></div>
            ) : (
              <div className="grid gap-3">
                {filteredTutors?.map((tutor) => {
                  const tierName = TIER_NAMES[tutor.subscription] || tutor.subscription;
                  const isExpired = tutor.subscriptionUntil && new Date(tutor.subscriptionUntil) < new Date();
                  const isBlocked = (tutor as any).isBlocked;
                  const studentCount = allStudents?.filter(s => (s as any).tutorId === tutor.id).length ?? 0;
                  return (
                    <Card key={tutor.id} className={`border-border/60 bg-card/60 ${isBlocked ? "opacity-70 border-red-300 dark:border-red-800" : ""}`} data-testid={`card-tutor-${tutor.id}`}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${isBlocked ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}`}>
                              {tutor.isAdmin ? <Shield className="h-5 w-5" /> : <User className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold truncate" data-testid={`text-tutor-name-${tutor.id}`}>{tutor.name}</span>
                                {tutor.isAdmin && <Badge variant="outline" className="text-[10px] gap-1"><Shield className="h-2.5 w-2.5" />Админ</Badge>}
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TIER_COLORS[tutor.subscription] || ""}`} data-testid={`badge-subscription-${tutor.id}`}>
                                  {tierName}
                                  {isExpired && " (истёк)"}
                                </span>
                                {isBlocked && (
                                  <span className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                    Заблокирован
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-xs text-muted-foreground truncate" data-testid={`text-tutor-email-${tutor.id}`}>{tutor.email}</span>
                                <span className="text-muted-foreground">·</span>
                                <GraduationCap className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-xs text-muted-foreground">{studentCount} уч.</span>
                                {tutor.subscriptionUntil && (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="text-xs text-muted-foreground">
                                      до {format(new Date(tutor.subscriptionUntil), "d MMM yyyy", { locale: ru })}
                                    </span>
                                  </>
                                )}
                                {tutor.createdAt && (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">
                                      рег. {format(new Date(tutor.createdAt), "d MMM yyyy", { locale: ru })}
                                    </span>
                                  </>
                                )}
                                {tutor.subjects && tutor.subjects.length > 0 && (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">{tutor.subjects.join(", ")}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => openAiCreditsDialog(tutor.id, "tutor")}
                              data-testid={`button-ai-credits-tutor-${tutor.id}`}
                            >
                              <Zap className="h-3.5 w-3.5 text-purple-500" />
                              ИИ
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => openEditDialog(tutor.id, tutor.subscription, tutor.subscriptionUntil)}
                              data-testid={`button-edit-tutor-${tutor.id}`}
                            >
                              <Crown className="h-3.5 w-3.5 text-amber-500" />
                              Подписка
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => {
                                setEditInfoTutorId(tutor.id);
                                setEditInfoForm({ name: tutor.name, email: tutor.email });
                                setEditInfoDialogOpen(true);
                              }}
                              data-testid={`button-edit-info-tutor-${tutor.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5 text-blue-500" />
                              Инфо
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => openPasswordDialog(tutor.id, tutor.name, tutor.email, "tutor")}
                              data-testid={`button-change-password-tutor-${tutor.id}`}
                            >
                              <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                              Пароль
                            </Button>
                            {!tutor.isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                className={`gap-1.5 text-xs h-8 ${isBlocked ? "border-green-300 text-green-700 hover:bg-green-50 dark:text-green-400" : "border-orange-300 text-orange-700 hover:bg-orange-50 dark:text-orange-400"}`}
                                onClick={() => blockTutorMutation.mutate({ id: tutor.id, blocked: !isBlocked })}
                                disabled={blockTutorMutation.isPending}
                                data-testid={`button-block-tutor-${tutor.id}`}
                              >
                                {isBlocked ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                {isBlocked ? "Снять" : "Блок"}
                              </Button>
                            )}
                            {!tutor.isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs h-8 border-red-300 text-red-600 hover:bg-red-50 dark:text-red-400"
                                onClick={() => { setDeleteTutorTarget({ id: tutor.id, name: tutor.name }); setDeleteTutorDialogOpen(true); }}
                                data-testid={`button-delete-tutor-${tutor.id}`}
                              >
                                <X className="h-3.5 w-3.5" />
                                Удалить
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {filteredTutors?.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    <User className="mx-auto h-10 w-10 mb-3 opacity-30" />
                    <p>Репетиторы не найдены</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ─── УЧЕНИКИ ──────────────────────────────────────────────── */}
          <TabsContent value="students" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Все ученики</h2>
                <p className="text-sm text-muted-foreground">Всего: {allStudents?.length ?? 0}</p>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени, email, репетитору"
                  className="pl-9 h-9 w-72"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  data-testid="input-search-students"
                />
              </div>
            </div>

            {studentsLoading ? (
              <div className="flex items-center justify-center py-12"><Spinner className="h-8 w-8" /></div>
            ) : (
              <div className="grid gap-3">
                {filteredStudents?.map((student) => (
                  <Card key={student.id} className="border-border/60 bg-card/60" data-testid={`card-student-${student.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 shrink-0">
                            <GraduationCap className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate" data-testid={`text-student-name-${student.id}`}>{student.name}</span>
                              {student.subjects && student.subjects.length > 0 && (
                                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{student.subjects[0]}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {student.email && (
                                <>
                                  <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-xs text-muted-foreground truncate">{student.email}</span>
                                  <span className="text-muted-foreground">·</span>
                                </>
                              )}
                              <User className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">{student.tutorName}</span>
                              {student.grade && (
                                <>
                                  <span className="text-muted-foreground">·</span>
                                  <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-xs text-muted-foreground">{student.grade} класс</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-8"
                            onClick={() => openAiCreditsDialog(student.id, "student")}
                            data-testid={`button-ai-credits-student-${student.id}`}
                          >
                            <Zap className="h-3.5 w-3.5 text-purple-500" />
                            ИИ-кредиты
                          </Button>
                          {student.email && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => openPasswordDialog(student.id, student.name, student.email, "student")}
                              data-testid={`button-change-password-student-${student.id}`}
                            >
                              <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                              Пароль
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredStudents?.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    <GraduationCap className="mx-auto h-10 w-10 mb-3 opacity-30" />
                    <p>Ученики не найдены</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ─── ЦЕНЫ ─────────────────────────────────────────────────── */}
          <TabsContent value="prices" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Цены подписок</h2>
              <p className="text-sm text-muted-foreground">Управление стоимостью тарифов</p>
            </div>
            {pricesLoading ? (
              <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {subscriptionPrices?.map((price) => (
                  <Card key={price.id} className="relative overflow-hidden">
                    <div className={`absolute inset-x-0 top-0 h-1 ${price.tier === "pro" ? "bg-blue-500" : "bg-amber-500"}`} />
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Crown className={`h-5 w-5 ${price.tier === "pro" ? "text-blue-500" : "text-amber-500"}`} />
                          {TIER_NAMES[price.tier] || price.tier.toUpperCase()}
                        </CardTitle>
                        {editingPrice === price.tier ? (
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditingPrice(null)}>Отмена</Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                updatePricesMutation.mutate({ tier: price.tier, ...priceForm }, {
                                  onSuccess: () => { toast.success("Цены обновлены"); setEditingPrice(null); },
                                  onError: (e) => toast.error(e.message),
                                });
                              }}
                              disabled={updatePricesMutation.isPending}
                            >
                              {updatePricesMutation.isPending ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => { setEditingPrice(price.tier); setPriceForm({ priceMonthly: price.priceMonthly, priceYearly: price.priceYearly }); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {editingPrice === price.tier ? (
                        <>
                          <div>
                            <label className="text-xs text-muted-foreground">Цена за месяц (₽)</label>
                            <Input type="number" value={priceForm.priceMonthly} onChange={(e) => setPriceForm({ ...priceForm, priceMonthly: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Цена за год (₽)</label>
                            <Input type="number" value={priceForm.priceYearly} onChange={(e) => setPriceForm({ ...priceForm, priceYearly: Number(e.target.value) })} />
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-lg bg-muted/50 p-3 text-center">
                            <div className="text-2xl font-bold">{price.priceMonthly.toLocaleString("ru-RU")} ₽</div>
                            <div className="text-xs text-muted-foreground">в месяц</div>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-3 text-center">
                            <div className="text-2xl font-bold">{price.priceYearly.toLocaleString("ru-RU")} ₽</div>
                            <div className="text-xs text-muted-foreground">в год</div>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Возможности:</div>
                        <div className="flex flex-wrap gap-1">
                          {price.features.map((feature: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{feature}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── ИИ НАСТРОЙКИ ─────────────────────────────────────────── */}
          <TabsContent value="ai" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Настройки ИИ</h2>
              <p className="text-sm text-muted-foreground">API ключи, модели и лимиты для всех ИИ-помощников</p>
            </div>
            {aiSettingsLoading ? (
              <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" />API ключи
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">OpenAI API Key</Label>
                      <p className="text-xs text-muted-foreground mb-1.5">Используется для GPT-4o (если не задан, берётся из переменных среды)</p>
                      <div className="relative">
                        <Input
                          type={showOpenAIKey ? "text" : "password"}
                          value={aiForm.openai_api_key}
                          onChange={(e) => setAiForm({ ...aiForm, openai_api_key: e.target.value })}
                          placeholder="sk-..."
                        />
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowOpenAIKey(!showOpenAIKey)}>
                          {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">DeepSeek API Key</Label>
                      <p className="text-xs text-muted-foreground mb-1.5">Доступен ученикам как альтернативная модель</p>
                      <div className="relative">
                        <Input
                          type={showDeepSeekKey ? "text" : "password"}
                          value={aiForm.deepseek_api_key}
                          onChange={(e) => setAiForm({ ...aiForm, deepseek_api_key: e.target.value })}
                          placeholder="sk-..."
                        />
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowDeepSeekKey(!showDeepSeekKey)}>
                          {showDeepSeekKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />Лимиты и модели
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium">Дневной лимит OpenAI</Label>
                      <Input type="number" value={aiForm.daily_limit_openai} onChange={(e) => setAiForm({ ...aiForm, daily_limit_openai: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Дневной лимит DeepSeek</Label>
                      <Input type="number" value={aiForm.daily_limit_deepseek} onChange={(e) => setAiForm({ ...aiForm, daily_limit_deepseek: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Лимит gpt-4o-mini</Label>
                      <Input type="number" value={aiForm["daily_limit_gpt4o-mini"]} onChange={(e) => setAiForm({ ...aiForm, "daily_limit_gpt4o-mini": e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Модель по умолчанию</Label>
                      <Select value={aiForm.default_model} onValueChange={(val) => setAiForm({ ...aiForm, default_model: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                          <SelectItem value="deepseek">DeepSeek</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Video className="h-4 w-4 text-rose-500" />
                      BigBlueButton (BBB)
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Видеоконференции. Введите URL вашего BBB-сервера и секретный ключ.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">URL сервера BBB</Label>
                      <p className="text-xs text-muted-foreground mb-1.5">Пример: https://bbb.myserver.ru или https://bbb.myserver.ru/bigbluebutton/api</p>
                      <Input
                        type="url"
                        value={aiForm.bbb_url}
                        onChange={(e) => setAiForm({ ...aiForm, bbb_url: e.target.value })}
                        placeholder="https://bbb.example.com"
                        data-testid="input-bbb-url"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">BBB Secret (секретный ключ)</Label>
                      <p className="text-xs text-muted-foreground mb-1.5">Находится в файле /etc/bigbluebutton/bbb-conf/secrets.env или командой <code>bbb-conf --secret</code></p>
                      <div className="relative">
                        <Input
                          type={showBbbSecret ? "text" : "password"}
                          value={aiForm.bbb_secret}
                          onChange={(e) => setAiForm({ ...aiForm, bbb_secret: e.target.value })}
                          placeholder="Введите BBB секрет..."
                          data-testid="input-bbb-secret"
                        />
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowBbbSecret(!showBbbSecret)}>
                          {showBbbSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button onClick={() => saveAiSettings.mutate(aiForm)} disabled={saveAiSettings.isPending} className="gap-2">
                  {saveAiSettings.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  Сохранить настройки
                </Button>

                {/* Telegram Bot */}
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bot className="h-4 w-4 text-blue-500" />
                      Telegram-бот платформы
                      {tgBotStatus?.botRunning
                        ? <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">Запущен</Badge>
                        : <Badge variant="outline">Не настроен</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Единый бот для всей платформы. Репетиторы и ученики привязывают свой Telegram через него.
                      Токен создаётся в <strong>@BotFather</strong>.
                    </p>
                    {tgBotStatus?.botRunning && (
                      <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-50/50 dark:bg-green-950/20 px-3 py-2">
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">
                          @{tgBotStatus.botUsername || "бот активен"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => removeBotToken.mutate()}
                          disabled={removeBotToken.isPending}
                          data-testid="button-remove-bot-token"
                        >
                          Остановить
                        </Button>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-sm">Токен бота</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showBotToken ? "text" : "password"}
                            value={botTokenInput}
                            onChange={e => setBotTokenInput(e.target.value)}
                            placeholder="1234567890:ABCDefgh..."
                            className="font-mono text-sm pr-9"
                            data-testid="input-bot-token"
                          />
                          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowBotToken(!showBotToken)}>
                            {showBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button
                          onClick={() => saveBotToken.mutate()}
                          disabled={!botTokenInput.trim() || saveBotToken.isPending}
                          className="gap-2"
                          data-testid="button-save-bot-token"
                        >
                          {saveBotToken.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          {tgBotStatus?.botRunning ? "Заменить" : "Запустить"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Или задайте переменную среды <code className="bg-muted px-1 rounded text-[10px]">TELEGRAM_BOT_TOKEN</code> — бот запустится автоматически при старте.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ─── ФИЧЕР-ФЛАГИ ──────────────────────────────────────────── */}
          <TabsContent value="flags" className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Фичер-флаги</h2>
                <p className="text-sm text-muted-foreground">Включайте и отключайте функции для конкретных репетиторов</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchFlags()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Обновить
              </Button>
            </div>

            {/* Add flag form */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={flagTutorId}
                      onChange={e => setFlagTutorId(e.target.value)}
                    >
                      <option value="">Выберите репетитора...</option>
                      {tutors?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['ai_chat', 'bbb', 'boards', 'yookassa', 'finance', 'analytics'].map(feature => (
                      <Button
                        key={feature}
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        disabled={!flagTutorId || flagTogglingId === feature}
                        onClick={async () => {
                          if (!flagTutorId) return;
                          const existing = featureFlags.find((f: any) => f.tutorId === flagTutorId && f.feature === feature);
                          const newEnabled = !(existing?.enabled ?? true);
                          setFlagTogglingId(feature);
                          try {
                            await fetch('/api/admin/feature-flags', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ tutorId: flagTutorId, feature, enabled: newEnabled }),
                            });
                            refetchFlags();
                          } finally {
                            setFlagTogglingId(null);
                          }
                        }}
                        data-testid={`button-flag-${feature}`}
                      >
                        {(() => {
                          const f = featureFlags.find((f: any) => f.tutorId === flagTutorId && f.feature === feature);
                          const en = f ? f.enabled : true;
                          return en ? <ToggleRight className="h-3.5 w-3.5 text-green-500" /> : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />;
                        })()}
                        {feature}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Flags table */}
            {flagsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : featureFlags.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ToggleRight className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Нет настроенных флагов</p>
                <p className="text-xs mt-1">По умолчанию все функции включены для всех репетиторов</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(flagsByTutor).map(([tutorId, flags]) => {
                  const tutor = tutors?.find(t => t.id === tutorId);
                  return (
                    <Card key={tutorId} className="border-border/60">
                      <CardContent className="p-4">
                        <div className="font-medium text-sm mb-3">{tutor?.name || tutorId} <span className="text-muted-foreground text-xs">({tutor?.email})</span></div>
                        <div className="flex flex-wrap gap-2">
                          {(flags as any[]).map((f: any) => (
                            <Badge
                              key={f.id}
                              variant={f.enabled ? "default" : "secondary"}
                              className={`gap-1 cursor-pointer ${f.enabled ? 'bg-green-500/15 text-green-700 border-green-500/30' : ''}`}
                              onClick={async () => {
                                setFlagTogglingId(f.id);
                                try {
                                  await fetch('/api/admin/feature-flags', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ tutorId: f.tutorId, feature: f.feature, enabled: !f.enabled }),
                                  });
                                  refetchFlags();
                                } finally {
                                  setFlagTogglingId(null);
                                }
                              }}
                            >
                              {f.enabled ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                              {f.feature}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── ПОДДЕРЖКА / ТИКЕТЫ ───────────────────────────────────── */}
          <TabsContent value="support" className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Поддержка</h2>
                <p className="text-sm text-muted-foreground">Запросы от репетиторов</p>
              </div>
              <div className="flex gap-2">
                <select
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={ticketStatusFilter}
                  onChange={e => setTicketStatusFilter(e.target.value as any)}
                >
                  <option value="all">Все</option>
                  <option value="open">Открытые</option>
                  <option value="answered">Отвеченные</option>
                  <option value="closed">Закрытые</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => refetchTickets()} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {ticketsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Ticket list */}
                <div className="space-y-2">
                  {filteredTickets.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Нет обращений</p>
                    </div>
                  ) : filteredTickets.map(t => (
                    <Card
                      key={t.id}
                      className={`border-border/60 cursor-pointer transition-all ${selectedTicketId === t.id ? 'border-primary ring-1 ring-primary/30' : ''}`}
                      onClick={() => setSelectedTicketId(t.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{t.subject}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.tutorName}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${t.status === 'open' ? 'text-red-600 border-red-500/30' : t.status === 'answered' ? 'text-blue-600 border-blue-500/30' : 'text-muted-foreground'}`}
                          >
                            {t.status === 'open' ? 'Открыт' : t.status === 'answered' ? 'Отвечен' : 'Закрыт'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(t.updatedAt).toLocaleDateString('ru-RU')}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Ticket detail */}
                {selectedTicketId && ticketDetail ? (
                  <Card className="border-border/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{ticketDetail.ticket?.subject}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">от {ticketDetail.ticket?.tutorName}</p>
                        </div>
                        <div className="flex gap-2">
                          {ticketDetail.ticket?.status !== 'closed' && (
                            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={async () => {
                              await fetch(`/api/admin/tickets/${selectedTicketId}`, {
                                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                credentials: 'include', body: JSON.stringify({ status: 'closed' }),
                              });
                              queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
                              queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets", selectedTicketId, "messages"] });
                            }}>
                              Закрыть
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {ticketDetail.messages?.map((msg: any) => (
                          <div key={msg.id} className={`flex gap-2 ${msg.role === 'admin' ? 'justify-end' : ''}`}>
                            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              <p className="text-[10px] font-medium mb-0.5 opacity-70">{msg.role === 'admin' ? 'Вы' : ticketDetail.ticket?.tutorName}</p>
                              <p>{msg.content}</p>
                            </div>
                          </div>
                        ))}
                        {(!ticketDetail.messages || ticketDetail.messages.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-4">Нет сообщений</p>
                        )}
                      </div>
                      {ticketDetail.ticket?.status !== 'closed' && (
                        <div className="flex gap-2 pt-2 border-t border-border/40">
                          <input
                            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="Ваш ответ..."
                            value={ticketReply}
                            onChange={e => setTicketReply(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); /* submit */ } }}
                            data-testid="input-ticket-reply"
                          />
                          <Button
                            size="sm"
                            className="gap-1.5 shrink-0"
                            disabled={sendingReply || !ticketReply.trim()}
                            data-testid="button-send-reply"
                            onClick={async () => {
                              setSendingReply(true);
                              try {
                                await fetch(`/api/admin/tickets/${selectedTicketId}/messages`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ content: ticketReply }),
                                });
                                setTicketReply("");
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets", selectedTicketId, "messages"] });
                              } catch (e: any) {
                                toast.error(e.message);
                              } finally {
                                setSendingReply(false);
                              }
                            }}
                          >
                            {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center text-muted-foreground text-sm py-12">
                    <div className="text-center">
                      <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p>Выберите тикет слева</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ─── ПЛАТЕЖИ ──────────────────────────────────────────────── */}
          <PaymentsTab activeTab={activeTab} />

          {/* ─── ПРОМОКОДЫ ────────────────────────────────────────────── */}
          <PromoCodesTab activeTab={activeTab} />

          {/* ─── ПЛАТФОРМА ────────────────────────────────────────────── */}
          <PlatformTab activeTab={activeTab} />

          {/* ─── ДИАГНОСТИКА ──────────────────────────────────────────── */}
          <DiagnosticsTab activeTab={activeTab} />

        </Tabs>
      </div>

      {/* ─── DIALOG: СОЗДАТЬ РЕПЕТИТОРА ───────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Создать репетитора
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Имя *</label>
              <Input value={newTutor.name} onChange={(e) => setNewTutor({ ...newTutor, name: e.target.value })} placeholder="Иван Петров" data-testid="input-tutor-name" />
            </div>
            <div>
              <label className="text-sm font-medium">Email *</label>
              <Input type="email" value={newTutor.email} onChange={(e) => setNewTutor({ ...newTutor, email: e.target.value })} placeholder="tutor@example.com" data-testid="input-tutor-email" />
            </div>
            <div>
              <label className="text-sm font-medium">Пароль *</label>
              <Input type="password" value={newTutor.password} onChange={(e) => setNewTutor({ ...newTutor, password: e.target.value })} placeholder="Минимум 6 символов" data-testid="input-tutor-password" />
            </div>
            <div>
              <label className="text-sm font-medium">Предметы (через запятую)</label>
              <Input
                value={newTutor.subjects.join(", ")}
                onChange={(e) => setNewTutor({ ...newTutor, subjects: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                placeholder="Математика, Физика"
                data-testid="input-tutor-subjects"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Тариф</label>
              <Select value={newTutor.subscription} onValueChange={(val) => setNewTutor({ ...newTutor, subscription: val as "free" | "pro" | "premium" })}>
                <SelectTrigger data-testid="select-tutor-subscription"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Старт (Free)</SelectItem>
                  <SelectItem value="pro">Базовый (Pro)</SelectItem>
                  <SelectItem value="premium">Про (Premium)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newTutor.subscription !== "free" && (
              <div>
                <label className="text-sm font-medium">Подписка до</label>
                <Input type="date" value={newTutor.subscriptionUntil} onChange={(e) => setNewTutor({ ...newTutor, subscriptionUntil: e.target.value })} data-testid="input-tutor-subscription-until" />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setCreateDialogOpen(false)}>Отмена</Button>
              <Button onClick={handleCreateTutor} className="flex-1" disabled={createTutorMutation.isPending} data-testid="button-submit-create-tutor">
                {createTutorMutation.isPending ? <Spinner className="h-4 w-4" /> : "Создать"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG: РЕДАКТИРОВАТЬ ПОДПИСКУ ───────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Подписка: {selectedTutor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Тариф</label>
              <Select value={editSubscription} onValueChange={(val) => setEditSubscription(val as "free" | "pro" | "premium")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Старт (Free) — 5 учеников</SelectItem>
                  <SelectItem value="pro">Базовый (Pro) — 15 учеников</SelectItem>
                  <SelectItem value="premium">Про (Premium) — 40 учеников</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editSubscription !== "free" && (
              <div>
                <label className="text-sm font-medium">Действует до</label>
                <Input type="date" value={editSubscriptionUntil} onChange={(e) => setEditSubscriptionUntil(e.target.value)} />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>Отмена</Button>
              <Button onClick={handleUpdateSubscription} className="flex-1" disabled={updateTutorMutation.isPending}>
                {updateTutorMutation.isPending ? <Spinner className="h-4 w-4" /> : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG: ВЫДАТЬ ИИ-КРЕДИТЫ ───────────────────────────────── */}
      <Dialog open={aiCreditsDialogOpen} onOpenChange={setAiCreditsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-500" />
              Выдать ИИ-кредиты
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Получатель: </span>
              <span className="font-medium">
                {aiCreditsTarget === "tutor" ? selectedTutor?.name : selectedStudent?.name}
              </span>
              <Badge variant="outline" className="ml-2 text-xs">
                {aiCreditsTarget === "tutor" ? "Репетитор" : "Ученик"}
              </Badge>
            </div>
            <div>
              <label className="text-sm font-medium">Количество кредитов</label>
              <div className="flex gap-2 mt-1.5">
                {["50", "100", "250", "500"].map(n => (
                  <Button
                    key={n}
                    size="sm"
                    variant={aiCreditsAmount === n ? "default" : "outline"}
                    className="flex-1 text-xs"
                    onClick={() => setAiCreditsAmount(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                className="mt-2"
                value={aiCreditsAmount}
                onChange={e => setAiCreditsAmount(e.target.value)}
                placeholder="Своё значение"
                min="1"
                max="10000"
                data-testid="input-ai-credits-amount"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Кредиты добавляются немедленно и не имеют срока действия. 1 кредит = 1 ИИ-запрос.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setAiCreditsDialogOpen(false)}>Отмена</Button>
              <Button
                className="flex-1 gap-2"
                disabled={giveAiCreditsMutation.isPending || !aiCreditsAmount || Number(aiCreditsAmount) < 1}
                onClick={() => {
                  const targetId = aiCreditsTarget === "tutor" ? selectedTutorId! : selectedStudentId!;
                  giveAiCreditsMutation.mutate({ targetId, targetType: aiCreditsTarget, credits: Number(aiCreditsAmount) });
                }}
                data-testid="button-submit-ai-credits"
              >
                {giveAiCreditsMutation.isPending ? <Spinner className="h-4 w-4" /> : <><Zap className="h-4 w-4" />Выдать</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Диалог: Удалить репетитора ───────────────────────────────────── */}
      <Dialog open={deleteTutorDialogOpen} onOpenChange={setDeleteTutorDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <X className="h-5 w-5" />
              Удалить репетитора
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm">
              <p className="font-medium text-red-700 dark:text-red-400">Вы удаляете: {deleteTutorTarget?.name}</p>
              <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/70">
                Все ученики, занятия, платежи и данные этого репетитора будут удалены без возможности восстановления.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTutorDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                disabled={deleteTutorMutation.isPending}
                onClick={() => deleteTutorTarget && deleteTutorMutation.mutate(deleteTutorTarget.id)}
                data-testid="button-confirm-delete-tutor"
              >
                {deleteTutorMutation.isPending ? <Spinner className="h-4 w-4" /> : <><X className="h-4 w-4" />Удалить навсегда</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Диалог: Редактировать инфо репетитора ────────────────────────── */}
      <Dialog open={editInfoDialogOpen} onOpenChange={setEditInfoDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-500" />
              Редактировать данные
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Имя</Label>
              <Input
                className="mt-1.5"
                value={editInfoForm.name}
                onChange={e => setEditInfoForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Имя репетитора"
                data-testid="input-edit-tutor-name"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <Input
                className="mt-1.5"
                type="email"
                value={editInfoForm.email}
                onChange={e => setEditInfoForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                data-testid="input-edit-tutor-email"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditInfoDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={editInfoMutation.isPending || !editInfoForm.name || !editInfoForm.email}
                onClick={() => {
                  if (editInfoTutorId) editInfoMutation.mutate({ id: editInfoTutorId, name: editInfoForm.name, email: editInfoForm.email });
                }}
                data-testid="button-submit-edit-tutor-info"
              >
                {editInfoMutation.isPending ? <Spinner className="h-4 w-4" /> : <><Check className="h-4 w-4" />Сохранить</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Диалог смены пароля ──────────────────────────────────────────── */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-slate-500" />
              Сменить пароль
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                {pwTarget?.type === "tutor" ? (
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="font-medium">{pwTarget?.name}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {pwTarget?.type === "tutor" ? "Репетитор" : "Ученик"}
                </Badge>
              </div>
              {pwTarget?.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs">{pwTarget.email}</span>
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium">Новый пароль</Label>
              <div className="relative mt-1.5">
                <Input
                  type={pwShow ? "text" : "password"}
                  placeholder="Минимум 6 символов"
                  value={pwValue}
                  onChange={e => setPwValue(e.target.value)}
                  className="pr-10"
                  data-testid="input-new-password"
                  onKeyDown={e => {
                    if (e.key === "Enter" && pwValue.length >= 6 && pwTarget) {
                      changePasswordMutation.mutate({ id: pwTarget.id, type: pwTarget.type, password: pwValue });
                    }
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setPwShow(v => !v)}
                  tabIndex={-1}
                >
                  {pwShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwValue.length > 0 && pwValue.length < 6 && (
                <p className="mt-1 text-xs text-red-500">Минимум 6 символов</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPwDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={pwValue.length < 6 || changePasswordMutation.isPending || !pwTarget}
                onClick={() => {
                  if (pwTarget) changePasswordMutation.mutate({ id: pwTarget.id, type: pwTarget.type, password: pwValue });
                }}
                data-testid="button-submit-change-password"
              >
                {changePasswordMutation.isPending
                  ? <Spinner className="h-4 w-4" />
                  : <><KeyRound className="h-4 w-4" />Сохранить</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
