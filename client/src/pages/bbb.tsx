import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Video,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Users,
  Loader2,
  Radio,
  WifiOff,
  Info,
  User,
  Search,
  ArrowDownAZ,
  ArrowUpAZ,
  RefreshCw,
  ImagePlus,
  AlertTriangle,
  PlayCircle,
  FileVideo,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { useDocumentTitle } from "@/hooks/use-document-title";
interface Conference {
  id: string;
  title: string;
  studentId: string | null;
  meetingId: string;
  isOneTime: boolean;
  isRunning: boolean;
  createdAt: string;
}

interface BbbRecording {
  recordId: string;
  meetingId: string;
  name: string;
  published: boolean;
  startTime: number;
  endTime: number;
  participants: number;
  playbackUrl: string | null;
}

interface Student {
  id: string;
  name: string;
  subject: string;
}

function CopyButton({ text, label = "Скопировать" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Ссылка скопирована");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleCopy} data-testid="button-copy-link">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Скопировано" : label}
    </Button>
  );
}

export default function BbbPage() {
  useDocumentTitle("Видеоуроки");
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("none");
  const [isOneTime, setIsOneTime] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [studentLinkMap, setStudentLinkMap] = useState<Record<string, string>>({});
  const [loadingStudentLink, setLoadingStudentLink] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortAZ, setSortAZ] = useState(true);

  useEffect(() => {
    if (location.includes("create=1")) {
      setCreateOpen(true);
      setLocation("/bbb", { replace: true });
    }
  }, []);

  const { data: bbbStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/bbb/status"],
  });

  const { data: conferences = [], isLoading } = useQuery<Conference[]>({
    queryKey: ["/api/bbb/conferences"],
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const { data: recordings = [], isLoading: recordingsLoading, refetch: refetchRecordings } = useQuery<BbbRecording[]>({
    queryKey: ["/api/bbb/recordings"],
    enabled: !!bbbStatus?.configured,
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; studentId?: string | null; isOneTime: boolean }) =>
      apiRequest("POST", "/api/bbb/conferences", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bbb/conferences"] });
      setCreateOpen(false);
      setTitle("");
      setSelectedStudentId("none");
      setIsOneTime(false);
      toast.success("Конференция создана");
    },
    onError: (e: any) => toast.error(e.message || "Ошибка создания"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bbb/conferences/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bbb/conferences"] });
      setDeleteId(null);
      toast.success("Конференция удалена");
    },
    onError: (e: any) => toast.error(e.message || "Ошибка удаления"),
  });

  const [resettingId, setResettingId] = useState<string | null>(null);
  const handleReset = async (id: string) => {
    setResettingId(id);
    try {
      const res = await fetch(`/api/bbb/conferences/${id}/reset`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/bbb/conferences"] });
        toast.success("Встреча пересоздана. Войдите снова — теперь у всех полные права.");
      } else {
        toast.error(data.error || "Ошибка пересоздания");
      }
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setResettingId(null);
    }
  };

  const [replaceConfirmId, setReplaceConfirmId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const handleReplace = async (id: string) => {
    setReplacingId(id);
    setReplaceConfirmId(null);
    try {
      const res = await fetch(`/api/bbb/conferences/${id}/replace`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/bbb/conferences"] });
        setStudentLinkMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
        toast.success("Комната заменена. Отправьте ученику новую ссылку.");
      } else {
        toast.error(data.error || "Ошибка замены");
      }
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setReplacingId(null);
    }
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      studentId: selectedStudentId !== "none" ? selectedStudentId : null,
      isOneTime,
    });
  };

  const handleJoin = async (id: string) => {
    setJoiningId(id);
    // Open window synchronously (before async call) to avoid popup blockers
    const newWin = window.open("", "_blank");
    if (newWin) {
      newWin.document.write(
        `<html><head><title>Загрузка...</title></head><body style="background:#06172A;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:18px;">⏳ Подключение к конференции...</body></html>`
      );
    }
    try {
      const res = await fetch(`/api/bbb/conferences/${id}/join`, { credentials: "include" });
      const data = await res.json();
      if (data.url) {
        if (newWin) {
          newWin.location.href = data.url;
        } else {
          window.open(data.url, "_blank");
        }
      } else {
        newWin?.close();
        toast.error(data.error || "Ошибка получения ссылки");
      }
    } catch {
      newWin?.close();
      toast.error("Ошибка подключения");
    } finally {
      setJoiningId(null);
    }
  };

  const handleGetStudentLink = async (id: string) => {
    if (studentLinkMap[id]) return;
    setLoadingStudentLink(id);
    try {
      const res = await fetch(`/api/bbb/conferences/${id}/student-link`, { credentials: "include" });
      const data = await res.json();
      if (data.url) {
        setStudentLinkMap((prev) => ({ ...prev, [id]: data.url }));
        await navigator.clipboard.writeText(data.url);
        toast.success("Ссылка для ученика скопирована");
      } else {
        toast.error(data.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка");
    } finally {
      setLoadingStudentLink(null);
    }
  };

  const ensureAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/bbb/ensure-all-conferences", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bbb/conferences"] });
      if (data.created > 0) {
        toast.success(`Создано конференций: ${data.created}`);
      } else {
        toast.success("У всех учеников уже есть конференция");
      }
    },
    onError: (e: any) => toast.error(e.message || "Ошибка"),
  });

  const [replaceAllConfirm, setReplaceAllConfirm] = useState(false);
  const replaceAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/bbb/replace-all-conferences", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bbb/conferences"] });
      setStudentLinkMap({});
      toast.success(`Пересоздано: ${data.replaced} комнат${data.created > 0 ? `, создано новых: ${data.created}` : ""}. Отправьте ученикам новые ссылки.`);
      setReplaceAllConfirm(false);
    },
    onError: (e: any) => toast.error(e.message || "Ошибка"),
  });

  const studentsWithoutConf = students.filter(
    (s) => !conferences.some((c) => c.studentId === s.id)
  );

  const getStudentName = (studentId: string | null) => {
    if (!studentId) return null;
    return students.find((s) => s.id === studentId)?.name || "Ученик";
  };

  const bbbQ = search.trim().toLowerCase();
  const filteredConferences = conferences
    .filter((c) => {
      if (!bbbQ) return true;
      const studentName = getStudentName(c.studentId) || "";
      return c.title.toLowerCase().includes(bbbQ) || studentName.toLowerCase().includes(bbbQ);
    })
    .sort((a, b) => {
      const nameA = (getStudentName(a.studentId) || a.title).toLowerCase();
      const nameB = (getStudentName(b.studentId) || b.title).toLowerCase();
      return sortAZ ? nameA.localeCompare(nameB, "ru") : nameB.localeCompare(nameA, "ru");
    });

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-4 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Video className="h-6 w-6 text-primary" />
              BigBlueButton
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Управление видеоконференциями</p>
          </div>
          <div className="flex items-center gap-2">
            {conferences.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                onClick={() => setReplaceAllConfirm(true)}
                disabled={replaceAllMutation.isPending}
                title="Сменили BBB сервер? Пересоздайте все комнаты с новыми адресами"
                data-testid="button-replace-all-conferences"
              >
                {replaceAllMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Пересоздать все</span>
              </Button>
            )}
            <Button
              onClick={() => setCreateOpen(true)}
              className="gap-2"
              data-testid="button-create-conference"
            >
              <Plus className="h-4 w-4" />
              Создать
            </Button>
          </div>
        </div>

        <PageHero
          icon={<Video className="h-6 w-6 text-white" />}
          gradient="from-rose-600/80 via-pink-600/70 to-orange-500/60"
          title="Видеоконференции BBB"
          subtitle="Создайте комнату и привяжите её к ученику — он увидит кнопку «Войти» в кабинете. Вы всегда входите первым как презентер. Чтобы дать ученику права — нажмите его имя в BBB → «Сделать презентером»."
          badge="BigBlueButton"
        />


        <div className="flex items-start gap-2 rounded-xl bg-blue-500/5 border border-blue-500/10 px-4 py-2.5">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Постоянные конференции привязаны к ученику и доступны ему из личного кабинета.
            Одноразовые — создаются для разового занятия и затем удаляются.
          </p>
        </div>

        {bbbStatus && !bbbStatus.configured && (
          <div className="flex items-start justify-between gap-3 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">BBB не настроен</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Для работы видеоконференций укажите URL сервера и секретный ключ BigBlueButton.
                  {user?.isAdmin ? " Перейдите в Настройки администратора → BBB." : " Обратитесь к администратору платформы."}
                </p>
              </div>
            </div>
            {user?.isAdmin && (
              <Button size="sm" variant="outline" className="shrink-0 border-red-500/30 text-red-600 hover:bg-red-500/10"
                onClick={() => setLocation("/admin?tab=settings")}
                data-testid="button-goto-bbb-settings"
              >
                Настроить
              </Button>
            )}
          </div>
        )}

        {bbbStatus?.configured && studentsWithoutConf.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/8 border border-amber-500/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                У {studentsWithoutConf.length} {studentsWithoutConf.length === 1 ? "ученика нет" : "учеников нет"} конференции BBB
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5 border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
              onClick={() => ensureAllMutation.mutate()}
              disabled={ensureAllMutation.isPending}
              data-testid="button-ensure-all-conferences"
            >
              {ensureAllMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Создать для всех
            </Button>
          </div>
        )}

        {conferences.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Поиск по названию или имени ученика..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
                data-testid="input-search-bbb"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 shrink-0"
              onClick={() => setSortAZ((v) => !v)}
              data-testid="button-sort-bbb"
              title={sortAZ ? "А → Я" : "Я → А"}
            >
              {sortAZ ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
              <span className="hidden sm:inline">{sortAZ ? "А → Я" : "Я → А"}</span>
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Загрузка...</span>
          </div>
        ) : conferences.length === 0 ? (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Video className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Нет конференций</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Создайте первую конференцию, нажав кнопку «Создать»
                </p>
              </div>
            </CardContent>
          </Card>
        ) : filteredConferences.length === 0 && bbbQ ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Search className="h-8 w-8 opacity-30" />
            <p className="text-sm">Ничего не найдено по запросу «{search}»</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConferences.map((conf, idx) => {
              const studentName = getStudentName(conf.studentId);
              return (
                <motion.div
                  key={conf.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Card className="rounded-2xl border-border/50 hover:shadow-sm transition-shadow" data-testid={`card-conference-${conf.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl shrink-0 mt-0.5",
                          conf.isRunning ? "bg-green-500/15" : "bg-muted"
                        )}>
                          {conf.isRunning
                            ? <Radio className="h-5 w-5 text-green-500 animate-pulse" />
                            : <Video className="h-5 w-5 text-muted-foreground" />
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{conf.title}</span>
                            {conf.isRunning && (
                              <Badge className="bg-green-500/15 text-green-600 border-green-500/20 text-[10px]">
                                В эфире
                              </Badge>
                            )}
                            {conf.isOneTime && (
                              <Badge variant="outline" className="text-[10px]">Одноразовая</Badge>
                            )}
                          </div>

                          {studentName && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{studentName}</span>
                            </div>
                          )}

                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Создана {format(new Date(conf.createdAt), "d MMM yyyy", { locale: ru })}
                          </div>

                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            <Button
                              size="sm"
                              className="gap-1.5 h-8 text-xs"
                              onClick={() => handleJoin(conf.id)}
                              disabled={joiningId === conf.id}
                              data-testid={`button-join-${conf.id}`}
                            >
                              {joiningId === conf.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <ExternalLink className="h-3.5 w-3.5" />
                              }
                              Войти
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 h-8 text-xs"
                              onClick={() => handleGetStudentLink(conf.id)}
                              disabled={loadingStudentLink === conf.id}
                              data-testid={`button-student-link-${conf.id}`}
                            >
                              {loadingStudentLink === conf.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Users className="h-3.5 w-3.5" />
                              }
                              {studentLinkMap[conf.id] ? "Скопировать ссылку ученика" : "Ссылка ученику"}
                            </Button>

                            {studentLinkMap[conf.id] && (
                              <CopyButton text={studentLinkMap[conf.id]} label="Копировать" />
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleReset(conf.id)}
                              disabled={resettingId === conf.id}
                              title="Завершить текущую сессию и пересоздать комнату с обновлёнными настройками"
                              data-testid={`button-reset-${conf.id}`}
                            >
                              {resettingId === conf.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RefreshCw className="h-3.5 w-3.5" />
                              }
                              Пересоздать
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
                              onClick={() => setReplaceConfirmId(conf.id)}
                              disabled={replacingId === conf.id}
                              title="Заменить комнату: новый адрес, новые пароли. Старые ссылки перестанут работать."
                              data-testid={`button-replace-${conf.id}`}
                            >
                              {replacingId === conf.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <ImagePlus className="h-3.5 w-3.5" />
                              }
                              Заменить комнату
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                              onClick={() => setDeleteId(conf.id)}
                              data-testid={`button-delete-${conf.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Удалить
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Записи */}
        {bbbStatus?.configured && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <FileVideo className="h-4 w-4 text-primary" />
                Записи занятий
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => refetchRecordings()}
                disabled={recordingsLoading}
                data-testid="button-refresh-recordings"
              >
                {recordingsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Обновить
              </Button>
            </div>

            {recordingsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Загрузка записей...
              </div>
            ) : recordings.length === 0 ? (
              <Card className="rounded-2xl border-border/50">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Записей пока нет. Если запись включена в настройках BBB, она появится здесь после занятия.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recordings.map((rec) => {
                  const confName = conferences.find(c => c.meetingId === rec.meetingId)?.title || rec.name;
                  const studentName = (() => {
                    const conf = conferences.find(c => c.meetingId === rec.meetingId);
                    return conf?.studentId ? getStudentName(conf.studentId) : null;
                  })();
                  const duration = rec.startTime && rec.endTime
                    ? Math.round((rec.endTime - rec.startTime) / 60000)
                    : null;
                  return (
                    <Card key={rec.recordId} className="rounded-xl border-border/50" data-testid={`recording-${rec.recordId}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                          <PlayCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{confName}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {studentName && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {studentName}
                              </span>
                            )}
                            {rec.startTime > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(rec.startTime), "d MMM yyyy, HH:mm", { locale: ru })}
                              </span>
                            )}
                            {duration !== null && (
                              <span className="text-xs text-muted-foreground">{duration} мин</span>
                            )}
                            {rec.participants > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {rec.participants}
                              </span>
                            )}
                            {!rec.published && (
                              <Badge variant="outline" className="text-[10px] h-4">Не опубликована</Badge>
                            )}
                          </div>
                        </div>
                        {rec.playbackUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8 text-xs shrink-0"
                            onClick={() => window.open(rec.playbackUrl!, "_blank")}
                            data-testid={`button-play-${rec.recordId}`}
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            Смотреть
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Диалог создания */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Новая конференция
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="conf-title">Название</Label>
                <Input
                  id="conf-title"
                  placeholder="Занятие по математике"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  data-testid="input-conference-title"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Привязать к ученику</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger data-testid="select-student">
                    <SelectValue placeholder="Без привязки (одноразовая)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без привязки</SelectItem>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Привязанная конференция появится у ученика в личном кабинете.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">Одноразовая</div>
                  <div className="text-xs text-muted-foreground">Для разового занятия, затем удалить</div>
                </div>
                <Switch
                  checked={isOneTime}
                  onCheckedChange={setIsOneTime}
                  data-testid="switch-one-time"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
              <Button
                onClick={handleCreate}
                disabled={!title.trim() || createMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Диалог удаления */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить конференцию?</AlertDialogTitle>
              <AlertDialogDescription>
                Встреча будет завершена на сервере BigBlueButton и удалена из системы.
                Все участники будут отключены.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Диалог пересоздания всех комнат */}
        <AlertDialog open={replaceAllConfirm} onOpenChange={(open) => !open && setReplaceAllConfirm(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Пересоздать все комнаты?</AlertDialogTitle>
              <AlertDialogDescription>
                Все {conferences.length} конференций получат новые адреса и пароли.
                Старые ссылки учеников перестанут работать — нужно будет отправить новые.
                Используйте это при смене BBB сервера.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => replaceAllMutation.mutate()}
                disabled={replaceAllMutation.isPending}
              >
                {replaceAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Пересоздать все"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Диалог замены комнаты */}
        <AlertDialog open={!!replaceConfirmId} onOpenChange={(open) => !open && setReplaceConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Заменить комнату?</AlertDialogTitle>
              <AlertDialogDescription>
                Будет создана новая комната с новым адресом и паролями.
                Старые ссылки ученика перестанут работать — нужно будет отправить новую.
                Текущая встреча будет завершена.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => replaceConfirmId && handleReplace(replaceConfirmId)}
              >
                Заменить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
