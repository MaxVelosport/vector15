import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Copy, ExternalLink, Info, Loader2, Link2, Video, LayoutGrid, Monitor, Bot, CheckCircle2, XCircle, Send, RefreshCw, Timer, ShieldCheck, Download, Trash2, Plus, Clock, HardDrive, Globe, Phone, MessageCircle, GraduationCap, Trophy, Youtube, Eye, EyeOff, Palette, Star, MessageSquare, Camera, CircleDollarSign } from "lucide-react";
import { SiVk, SiWhatsapp, SiInstagram, SiTelegram } from "react-icons/si";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateProfile } from "@/hooks/use-tutor-data";
import { apiRequest } from "@/lib/queryClient";

import { useDocumentTitle } from "@/hooks/use-document-title";
const TIMEZONES = [
  { value: "Europe/Kaliningrad", label: "Калининград (UTC+2)" },
  { value: "Europe/Moscow", label: "Москва (UTC+3)" },
  { value: "Europe/Samara", label: "Самара (UTC+4)" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { value: "Asia/Omsk", label: "Омск (UTC+6)" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { value: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { value: "Asia/Yakutsk", label: "Якутск (UTC+9)" },
  { value: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { value: "Asia/Magadan", label: "Магадан (UTC+11)" },
  { value: "Asia/Kamchatka", label: "Камчатка (UTC+12)" },
];

const AVAILABLE_SUBJECTS = [
  "Математика", "Алгебра", "Геометрия", "Физика", "Химия", "Биология",
  "Информатика", "Русский язык", "Литература", "Английский язык",
  "Немецкий язык", "Французский язык", "История", "Обществознание", "География",
];

function CalendarSubscriptionBlock() {
  const { data, isLoading } = useQuery<{ url: string; webcalUrl: string }>({
    queryKey: ["/api/calendar/url"],
  });
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!data?.url) return;
    await navigator.clipboard.writeText(data.url);
    setCopied(true);
    toast.success("Ссылка скопирована");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-3">
        <div className="text-xs text-muted-foreground mb-2">
          Подпишитесь на расписание в любом календаре — занятия будут обновляться автоматически.
        </div>
        {isLoading ? (
          <div className="h-9 animate-pulse rounded-lg bg-muted" />
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs font-mono" data-testid="text-calendar-url">
              {data?.url || ""}
            </code>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={handleCopy} data-testid="button-copy-calendar">
                <Copy className="h-3.5 w-3.5 mr-1" />
                {copied ? "Готово" : "Копировать"}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={data?.webcalUrl || data?.url || "#"} data-testid="link-subscribe-calendar">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Подписаться
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
          <div className="font-semibold mb-0.5">Google Календарь</div>
          <div className="text-muted-foreground">Настройки → Добавить календарь → По URL</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
          <div className="font-semibold mb-0.5">Apple iCal</div>
          <div className="text-muted-foreground">Файл → Новая подписка на календарь</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
          <div className="font-semibold mb-0.5">Outlook</div>
          <div className="text-muted-foreground">Календарь → Добавить → Из интернета</div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  useDocumentTitle("Профиль");
  const [, setLocation] = useLocation();
  const { user, refetch: refetchUser } = useAuth() as any;
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleTutorAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setAvatarUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl.length > 500000) { toast.error("Фото слишком большое (максимум ~375KB)"); setAvatarUploading(false); return; }
        const res = await fetch("/api/avatar/tutor", {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({ avatar: dataUrl }),
        });
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["auth"] });
          if (refetchUser) refetchUser();
          toast.success("Фото профиля обновлено");
        } else { toast.error("Ошибка загрузки фото"); }
        setAvatarUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { setAvatarUploading(false); }
  };

  const [showEditProfileDialog, setShowEditProfileDialog] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileSubjects, setEditProfileSubjects] = useState<string[]>([]);
  const [editProfilePrice, setEditProfilePrice] = useState(1600);
  const [editProfileTimezone, setEditProfileTimezone] = useState("Europe/Moscow");

  const [publicSlug, setPublicSlug] = useState("");
  const [publicBio, setPublicBio] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [publicTelegram, setPublicTelegram] = useState("");
  const [isPublicProfile, setIsPublicProfile] = useState(false);
  const [publicExperience, setPublicExperience] = useState("");
  const [publicEducation, setPublicEducation] = useState("");
  const [publicWhatsapp, setPublicWhatsapp] = useState("");
  const [publicVk, setPublicVk] = useState("");
  const [publicInstagram, setPublicInstagram] = useState("");
  const [publicAchievements, setPublicAchievements] = useState("");
  const [publicVideoUrl, setPublicVideoUrl] = useState("");
  const [publicSubjectInfo, setPublicSubjectInfo] = useState("");
  const [publicColor, setPublicColor] = useState("violet");
  const [publicHidePrice, setPublicHidePrice] = useState(false);
  const [savingPublicProfile, setSavingPublicProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setPublicSlug((user as any).publicSlug || "");
      setPublicBio((user as any).publicBio || "");
      setPublicPhone((user as any).publicPhone || "");
      setPublicTelegram((user as any).publicTelegram || "");
      setIsPublicProfile((user as any).isPublicProfile || false);
      setPublicExperience((user as any).publicExperience || "");
      setPublicEducation((user as any).publicEducation || "");
      setPublicWhatsapp((user as any).publicWhatsapp || "");
      setPublicVk((user as any).publicVk || "");
      setPublicInstagram((user as any).publicInstagram || "");
      setPublicAchievements((user as any).publicAchievements || "");
      setPublicVideoUrl((user as any).publicVideoUrl || "");
      setPublicSubjectInfo((user as any).publicSubjectInfo || "");
      setPublicColor((user as any).publicColor || "violet");
      setPublicHidePrice((user as any).publicHidePrice || false);
    }
  }, [user]);

  const savePublicProfile = async () => {
    setSavingPublicProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          publicSlug: publicSlug || null,
          publicBio: publicBio || null,
          publicPhone: publicPhone || null,
          publicTelegram: publicTelegram || null,
          isPublicProfile,
          publicExperience: publicExperience || null,
          publicEducation: publicEducation || null,
          publicWhatsapp: publicWhatsapp || null,
          publicVk: publicVk || null,
          publicInstagram: publicInstagram || null,
          publicAchievements: publicAchievements || null,
          publicVideoUrl: publicVideoUrl || null,
          publicSubjectInfo: publicSubjectInfo || null,
          publicColor: publicColor || "violet",
          publicHidePrice,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
      if (refetchUser) refetchUser();
      toast.success("Публичный профиль сохранён");
    } catch (e: any) {
      toast.error(e.message || "Ошибка сохранения профиля");
    } finally {
      setSavingPublicProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({
        name: editProfileName,
        subjects: editProfileSubjects,
        basePrice: editProfilePrice,
        timezone: editProfileTimezone,
      });
      toast.success("Профиль обновлён");
      setShowEditProfileDialog(false);
    } catch {
      toast.error("Ошибка сохранения");
    }
  };

  type LinkSettings = { showBbb: boolean; showExternalConf: boolean; showInternalBoard: boolean; showExternalBoard: boolean };
  const { data: linkSettings, refetch: refetchLinkSettings } = useQuery<LinkSettings>({
    queryKey: ["/api/tutor/link-settings"],
    refetchOnWindowFocus: false,
  });
  const updateLinkSettings = useMutation({
    mutationFn: (updates: Partial<LinkSettings>) =>
      apiRequest("PATCH", "/api/tutor/link-settings", updates).then(r => r.json()),
    onSuccess: () => { refetchLinkSettings(); toast.success("Настройки ссылок сохранены"); },
    onError: () => toast.error("Ошибка сохранения настроек"),
  });
  const ls: LinkSettings = { showBbb: true, showExternalConf: true, showInternalBoard: true, showExternalBoard: true, ...linkSettings };
  const toggleLink = (key: keyof LinkSettings) => updateLinkSettings.mutate({ [key]: !ls[key] });

  const referralCode = (user as any)?.referralCode || (user?.id ? `VECTOR-${user.id.slice(0, 6).toUpperCase()}` : "");
  const emailVerified = (user as any)?.emailVerified !== false;
  const twoFactorEnabled = !!(user as any)?.twoFactorEnabled;

  const toggle2FA = useMutation({
    mutationFn: async (enabled: boolean) =>
      apiRequest("POST", "/api/auth/2fa/toggle", { enabled }).then(r => r.json()),
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success(enabled ? "Двухфакторная защита включена" : "Двухфакторная защита выключена");
    },
    onError: () => toast.error("Не удалось изменить настройку"),
  });

  const sendVerification = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/auth/send-verification", { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error("fail");
      return r.json();
    },
    onSuccess: () => toast.success("Письмо для подтверждения отправлено"),
    onError: () => toast.error("Не удалось отправить письмо"),
  });

  // ─── Backup queries ───────────────────────────────────────────────────────
  const { data: backups = [], isLoading: backupsLoading, refetch: refetchBackups } = useQuery<any[]>({
    queryKey: ["/api/backup"],
    queryFn: async () => {
      const res = await fetch("/api/backup", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupNote, setBackupNote] = useState("");
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);

  const createBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: backupNote || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания резервной копии");
      toast.success("Резервная копия создана");
      setBackupNote("");
      refetchBackups();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const deleteBackup = async (id: string) => {
    setDeletingBackupId(id);
    try {
      const res = await fetch(`/api/backup/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Ошибка удаления");
      toast.success("Резервная копия удалена");
      refetchBackups();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingBackupId(null);
    }
  };
  const publicUrl = publicSlug ? `${window.location.origin}/t/${publicSlug}` : "";

  // ====== TELEGRAM BOT ======
  const [tgCopiedLink, setTgCopiedLink] = useState<string | null>(null);

  // Link-code flow
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeTarget, setCodeTarget] = useState<"tutor" | "student">("tutor");
  const [codeStudentId, setCodeStudentId] = useState<string | null>(null);
  const [codeStudentName, setCodeStudentName] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [codeSecondsLeft, setCodeSecondsLeft] = useState(900);
  const [codeCopied, setCodeCopied] = useState(false);
  const codeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateCode = useMutation({
    mutationFn: (payload: { type: "tutor" | "student"; studentId?: string }) =>
      apiRequest("POST", "/api/telegram/generate-code", payload).then(r => r.json()),
    onSuccess: (data) => {
      setLinkCode(data.code);
      setCodeExpiresAt(new Date(data.expiresAt));
      setCodeSecondsLeft(900);
      setCodeCopied(false);
      setShowCodeDialog(true);
      // start countdown
      if (codeTimerRef.current) clearInterval(codeTimerRef.current);
      const expires = new Date(data.expiresAt).getTime();
      codeTimerRef.current = setInterval(() => {
        const left = Math.max(0, Math.floor((expires - Date.now()) / 1000));
        setCodeSecondsLeft(left);
        if (left === 0) {
          clearInterval(codeTimerRef.current!);
          codeTimerRef.current = null;
        }
      }, 1000);
    },
    onError: () => toast.error("Не удалось создать код — проверьте что бот настроен"),
  });

  const openCodeForTutor = () => {
    setCodeTarget("tutor");
    setCodeStudentId(null);
    setCodeStudentName(null);
    generateCode.mutate({ type: "tutor" });
  };

  const openCodeForStudent = (studentId: string, studentName: string) => {
    setCodeTarget("student");
    setCodeStudentId(studentId);
    setCodeStudentName(studentName);
    generateCode.mutate({ type: "student", studentId });
  };

  const copyCode = () => {
    if (linkCode) {
      navigator.clipboard.writeText(linkCode);
      setCodeCopied(true);
      toast.success("Код скопирован!");
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const refreshCode = () => {
    if (codeTarget === "student" && codeStudentId) {
      generateCode.mutate({ type: "student", studentId: codeStudentId });
    } else {
      generateCode.mutate({ type: "tutor" });
    }
  };

  type TgStatus = {
    botRunning: boolean;
    botUsername: string | null;
    tutorLinked: boolean;
    tutorLink: string | null;
    students: { id: string; name: string; telegramLinked: boolean; inviteLink: string | null }[];
  };
  const { data: tgStatus, refetch: refetchTg } = useQuery<TgStatus>({
    queryKey: ["/api/telegram/status"],
    refetchOnWindowFocus: false,
  });

  const unlinkTutor = useMutation({
    mutationFn: () => apiRequest("POST", "/api/telegram/unlink-tutor").then(r => r.json()),
    onSuccess: () => { toast.success("Telegram отвязан"); refetchTg(); },
  });

  const unlinkStudent = useMutation({
    mutationFn: (studentId: string) => apiRequest("POST", `/api/telegram/unlink-student/${studentId}`).then(r => r.json()),
    onSuccess: () => { toast.success("Telegram ученика отвязан"); refetchTg(); },
  });

  const copyStudentLink = (link: string, studentId: string) => {
    navigator.clipboard.writeText(link);
    setTgCopiedLink(studentId);
    toast.success("Ссылка скопирована!");
    setTimeout(() => setTgCopiedLink(null), 2000);
  };

  if (!user) {
    return (
      <DashboardLayout title="Профиль" subtitle="Загрузка...">
        <div className="flex items-center justify-center py-20">
          <div className="text-muted-foreground">Загрузка...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="👤 Профиль" subtitle="Данные репетитора, подписка, рефералы, поддержка и дорожная карта.">
      <div className="space-y-4">
        <div className="rounded-xl bg-blue-50/80 border border-blue-200/60 px-4 py-3 text-sm text-blue-700">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Ваши данные как репетитора: имя, предметы, часовой пояс, стоимость занятия.
              Нажмите <strong>«Редактировать»</strong>, чтобы изменить информацию. Здесь же — управление подпиской и реферальная программа.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl border-border/70 bg-card/60 lg:col-span-2">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Личные данные</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditProfileName(user.name || "");
                  setEditProfileSubjects(user.subjects || []);
                  setEditProfilePrice(user.basePrice || 1600);
                  setEditProfileTimezone(user.timezone || "Europe/Moscow");
                  setShowEditProfileDialog(true);
                }}
              >
                Редактировать
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTutorAvatarUpload(f); e.target.value = ""; }} />
              <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-muted/30">
                <button
                  className="relative group flex-shrink-0"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Нажмите для смены фото профиля"
                  disabled={avatarUploading}
                >
                  {(user as any).avatar ? (
                    <img src={(user as any).avatar} alt={user.name}
                      className="h-14 w-14 rounded-full object-cover shadow ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-white font-bold text-xl shadow group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                      {avatarUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : user.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white shadow text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">↑</span>
                </button>
                <div>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Нажмите на фото для смены</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Имя</div>
                  <div className="mt-1 text-sm font-semibold">{user.name}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="mt-1 text-sm">{user.email}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Предметы</div>
                  <div className="mt-1 text-sm">{user.subjects?.length ? user.subjects.join(", ") : "—"}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Базовая цена</div>
                  <div className="mt-1 text-sm">{user.basePrice?.toLocaleString("ru-RU")} ₽</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2 col-span-2">
                  <div className="text-xs text-muted-foreground">Часовой пояс</div>
                  <div className="mt-1 text-sm">{TIMEZONES.find(t => t.value === user.timezone)?.label || user.timezone}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Подписка</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Тариф</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className="capitalize">{user.subscription}</Badge>
                  </div>
                </div>
                {user.subscriptionUntil && (
                  <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Действует до</div>
                    <div className="mt-1 text-sm">{new Date(user.subscriptionUntil).toLocaleDateString("ru-RU")}</div>
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={() => setLocation("/subscription")}>
                  Управление подпиской
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/70 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Публичный профиль</CardTitle>
              </div>
              {publicSlug && isPublicProfile && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="text-xs h-7 px-2 gap-1" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Ссылка скопирована"); }}>
                    <Copy className="h-3 w-3" />Скопировать
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => window.open(publicUrl, "_blank")}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Настройте страницу, которую будут видеть потенциальные ученики по вашей ссылке</p>
          </CardHeader>
          <CardContent className="pt-0 space-y-6">

            {/* Photo + live card preview */}
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 overflow-hidden">
              <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-2">
                <Camera className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Карточка для учеников</span>
              </div>
              <div className="p-4 flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="relative h-24 w-24 rounded-full overflow-hidden ring-2 ring-primary/40 ring-offset-2 ring-offset-background bg-gradient-to-br from-primary/30 to-purple-500/30 flex items-center justify-center group shrink-0"
                  data-testid="button-public-avatar-upload"
                  title="Изменить фото"
                >
                  {(user as any).avatar ? (
                    <img src={(user as any).avatar} alt={user?.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-primary">
                      {user?.name?.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase() || "?"}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {avatarUploading
                      ? <Loader2 className="h-6 w-6 text-white animate-spin" />
                      : <Camera className="h-6 w-6 text-white" />}
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold truncate" data-testid="text-card-name">{user?.name || "Ваше имя"}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {((user as any)?.subjects ?? []).length > 0 ? (
                      (user as any).subjects.slice(0, 4).map((s: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px] py-0 h-5 font-medium">{s}</Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Предметы не указаны</span>
                    )}
                  </div>
                  {!publicHidePrice && (user as any)?.basePrice && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <CircleDollarSign className="h-3 w-3" />
                      {new Intl.NumberFormat("ru-RU").format((user as any).basePrice)} ₽ за занятие
                    </div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {(user as any)?.avatar
                      ? "Нажмите на фото, чтобы заменить"
                      : "Загрузите фото — это первое, что увидят ученики"}
                  </div>
                </div>
                {publicSlug && isPublicProfile && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    onClick={() => window.open(publicUrl, "_blank")}
                    data-testid="button-preview-public-card"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />Открыть
                  </Button>
                )}
              </div>
              <div className="px-4 pb-3 pt-0 text-[11px] text-muted-foreground">
                Имя, предметы и цену можно изменить в карточке «Мой профиль» выше
              </div>
            </div>

            {/* Visibility + URL */}
            <div className="rounded-xl border border-border/60 bg-background/50 overflow-hidden">
              <div className="px-3 py-2 bg-primary/5 border-b border-border/40 flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Видимость и адрес</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Профиль открыт</div>
                    <div className="text-xs text-muted-foreground">Делает вашу страницу доступной по ссылке</div>
                  </div>
                  <Switch checked={isPublicProfile} onCheckedChange={setIsPublicProfile} data-testid="switch-public-profile" />
                </div>
                <div>
                  <Label className="text-xs">Уникальный адрес (slug)</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{window.location.origin}/t/</span>
                    <Input
                      value={publicSlug}
                      onChange={(e) => setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="anna-petrova"
                      className="h-8 text-sm"
                      data-testid="input-public-slug"
                    />
                  </div>
                  {!isPublicProfile && (
                    <p className="mt-1.5 text-xs text-muted-foreground">Профиль скрыт — включите видимость, чтобы делиться ссылкой</p>
                  )}
                </div>
              </div>
            </div>

            {/* Basic info */}
            <div className="rounded-xl border border-border/60 bg-background/50 overflow-hidden">
              <div className="px-3 py-2 bg-blue-500/5 border-b border-border/40 flex items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Основная информация</span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <Label className="text-xs">О себе</Label>
                  <Textarea
                    value={publicBio}
                    onChange={(e) => setPublicBio(e.target.value)}
                    placeholder="Расскажите о себе: кто вы, как работаете, какие результаты даёте ученикам..."
                    className="mt-1 text-sm"
                    rows={4}
                    data-testid="textarea-public-bio"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Опыт преподавания</Label>
                    <Input
                      value={publicExperience}
                      onChange={(e) => setPublicExperience(e.target.value)}
                      placeholder="5 лет"
                      className="mt-1 h-8 text-sm"
                      data-testid="input-public-experience"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Образование</Label>
                    <Input
                      value={publicEducation}
                      onChange={(e) => setPublicEducation(e.target.value)}
                      placeholder="МГУ, математический факультет"
                      className="mt-1 h-8 text-sm"
                      data-testid="input-public-education"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Подробнее о предметах и подходе</Label>
                  <Textarea
                    value={publicSubjectInfo}
                    onChange={(e) => setPublicSubjectInfo(e.target.value)}
                    placeholder="Готовлю к ЕГЭ по математике (профиль), работаю с 8–11 классами. Разбираем каждую тему до полного понимания..."
                    className="mt-1 text-sm"
                    rows={3}
                    data-testid="textarea-public-subject-info"
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Trophy className="h-3 w-3 text-amber-500" />Достижения и регалии</Label>
                  <Textarea
                    value={publicAchievements}
                    onChange={(e) => setPublicAchievements(e.target.value)}
                    placeholder="100 баллов ЕГЭ у 3 учеников за 2024 год&#10;Все ученики поступили в топ-вузы&#10;Диплом призёра олимпиады по математике"
                    className="mt-1 text-sm"
                    rows={3}
                    data-testid="textarea-public-achievements"
                  />
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div className="rounded-xl border border-border/60 bg-background/50 overflow-hidden">
              <div className="px-3 py-2 bg-green-500/5 border-b border-border/40 flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs font-semibold text-green-700 dark:text-green-400">Контакты для учеников</span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" />Телефон</Label>
                  <Input value={publicPhone} onChange={(e) => setPublicPhone(e.target.value)} placeholder="+7 999 123-45-67" className="mt-1 h-8 text-sm" data-testid="input-public-phone" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><SiTelegram className="h-3 w-3 text-blue-400" />Telegram</Label>
                  <Input value={publicTelegram} onChange={(e) => setPublicTelegram(e.target.value)} placeholder="@username" className="mt-1 h-8 text-sm" data-testid="input-public-telegram" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><SiWhatsapp className="h-3 w-3 text-green-500" />WhatsApp</Label>
                  <Input value={publicWhatsapp} onChange={(e) => setPublicWhatsapp(e.target.value)} placeholder="+7 999 123-45-67" className="mt-1 h-8 text-sm" data-testid="input-public-whatsapp" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><SiVk className="h-3 w-3 text-blue-600" />ВКонтакте</Label>
                  <Input value={publicVk} onChange={(e) => setPublicVk(e.target.value)} placeholder="vk.com/ivan" className="mt-1 h-8 text-sm" data-testid="input-public-vk" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs flex items-center gap-1"><SiInstagram className="h-3 w-3 text-pink-500" />Instagram</Label>
                  <Input value={publicInstagram} onChange={(e) => setPublicInstagram(e.target.value)} placeholder="@username" className="mt-1 h-8 text-sm" data-testid="input-public-instagram" />
                </div>
              </div>
            </div>

            {/* Media + style */}
            <div className="rounded-xl border border-border/60 bg-background/50 overflow-hidden">
              <div className="px-3 py-2 bg-purple-500/5 border-b border-border/40 flex items-center gap-2">
                <Palette className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Медиа и оформление</span>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <Label className="text-xs flex items-center gap-1"><Youtube className="h-3 w-3 text-red-500" />Видео-визитка (ссылка на YouTube)</Label>
                  <Input
                    value={publicVideoUrl}
                    onChange={(e) => setPublicVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="mt-1 h-8 text-sm"
                    data-testid="input-public-video"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Видео появится прямо на вашей странице</p>
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Palette className="h-3 w-3" />Цвет оформления страницы</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { value: "violet", label: "Фиолетовый", from: "from-violet-500", to: "to-purple-600" },
                      { value: "blue", label: "Синий", from: "from-blue-500", to: "to-indigo-600" },
                      { value: "emerald", label: "Изумрудный", from: "from-emerald-500", to: "to-teal-600" },
                      { value: "rose", label: "Розовый", from: "from-rose-500", to: "to-pink-600" },
                      { value: "amber", label: "Янтарный", from: "from-amber-500", to: "to-orange-500" },
                      { value: "slate", label: "Тёмный", from: "from-slate-600", to: "to-gray-700" },
                    ].map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setPublicColor(c.value)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border-2 transition-all ${publicColor === c.value ? "border-foreground/40 ring-2 ring-primary/30" : "border-transparent"}`}
                        title={c.label}
                        data-testid={`button-color-${c.value}`}
                      >
                        <span className={`h-4 w-4 rounded-full bg-gradient-to-br ${c.from} ${c.to}`} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1"><EyeOff className="h-3.5 w-3.5" />Скрыть цену</div>
                    <div className="text-xs text-muted-foreground">Стоимость занятия не будет отображаться</div>
                  </div>
                  <Switch checked={publicHidePrice} onCheckedChange={setPublicHidePrice} data-testid="switch-hide-price" />
                </div>
              </div>
            </div>

            <Button onClick={savePublicProfile} disabled={savingPublicProfile} className="w-full" data-testid="button-save-public-profile">
              {savingPublicProfile ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Сохранение...</> : "Сохранить публичный профиль"}
            </Button>
          </CardContent>
        </Card>

        {/* ====== Reviews Moderation ====== */}
        <ReviewsModeration />

        {/* ====== Link Settings Card ====== */}
        <Card className="rounded-2xl border-border/70 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Видимость кнопок у учеников</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Управляйте какие ссылки видны ученикам на занятиях — отключите ненужные, чтобы убрать лишнее</p>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {/* Conferences section */}
            <div className="rounded-xl border border-border/60 bg-background/50 overflow-hidden">
              <div className="px-3 py-2 bg-blue-500/5 border-b border-border/40 flex items-center gap-2">
                <Video className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Видеоконференции</span>
              </div>
              <div className="divide-y divide-border/40">
                <div className="flex items-center justify-between px-3 py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">BBB-конференция</p>
                    <p className="text-xs text-muted-foreground">Встроенная видеоконференция через BigBlueButton</p>
                  </div>
                  <Switch
                    data-testid="switch-show-bbb"
                    checked={ls.showBbb}
                    onCheckedChange={() => toggleLink("showBbb")}
                    disabled={updateLinkSettings.isPending}
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Внешняя конференция</p>
                    <p className="text-xs text-muted-foreground">Ссылка на Zoom, Google Meet или другой сервис</p>
                  </div>
                  <Switch
                    data-testid="switch-show-external-conf"
                    checked={ls.showExternalConf}
                    onCheckedChange={() => toggleLink("showExternalConf")}
                    disabled={updateLinkSettings.isPending}
                  />
                </div>
              </div>
            </div>

            {/* Boards section */}
            <div className="rounded-xl border border-border/60 bg-background/50 overflow-hidden">
              <div className="px-3 py-2 bg-violet-500/5 border-b border-border/40 flex items-center gap-2">
                <LayoutGrid className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">Рабочие доски</span>
              </div>
              <div className="divide-y divide-border/40">
                <div className="flex items-center justify-between px-3 py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Внутренняя доска</p>
                    <p className="text-xs text-muted-foreground">Совместная доска внутри платформы «Твой Вектор»</p>
                  </div>
                  <Switch
                    data-testid="switch-show-internal-board"
                    checked={ls.showInternalBoard}
                    onCheckedChange={() => toggleLink("showInternalBoard")}
                    disabled={updateLinkSettings.isPending}
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Внешняя доска</p>
                    <p className="text-xs text-muted-foreground">Ссылка на Miro, Figma, Excalidraw или другой сервис</p>
                  </div>
                  <Switch
                    data-testid="switch-show-external-board"
                    checked={ls.showExternalBoard}
                    onCheckedChange={() => toggleLink("showExternalBoard")}
                    disabled={updateLinkSettings.isPending}
                  />
                </div>
              </div>
            </div>

            {/* Status hint */}
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <Monitor className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Изменения применяются сразу ко всем ученикам. Если у ученика нет ссылки на внешнюю доску или конференцию — кнопка не отображается независимо от настроек.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ====== TELEGRAM BOT CARD ====== */}
        <Card className="rounded-2xl border-border/70 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-base">Telegram-бот</CardTitle>
              {tgStatus?.botRunning && tgStatus?.tutorLinked && (
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">Подключён</Badge>
              )}
              {tgStatus?.botRunning && !tgStatus?.tutorLinked && (
                <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">Не привязан</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {!tgStatus?.botRunning ? (
              /* Bot not configured by admin */
              <div className="rounded-xl bg-muted/50 border border-border/50 px-4 py-3 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Бот пока не настроен</p>
                <p className="text-xs">Платформенный Telegram-бот ещё не запущен администратором. Свяжитесь с поддержкой.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Bot + tutor connection status */}
                <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {tgStatus.tutorLinked ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className="text-sm font-medium">
                        {tgStatus.botUsername ? `@${tgStatus.botUsername}` : "Бот платформы"}
                      </span>
                    </div>
                    {tgStatus.tutorLinked && (
                      <Button
                        data-testid="button-disconnect-telegram"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => unlinkTutor.mutate()}
                        disabled={unlinkTutor.isPending}
                      >
                        Отвязать
                      </Button>
                    )}
                  </div>

                  {!tgStatus.tutorLinked && (
                    <div className="space-y-2">
                      <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Bot className="h-3.5 w-3.5 shrink-0" />
                        Получите код и введите его в Telegram-боте — аккаунт привяжется автоматически
                      </div>
                      <Button
                        size="sm"
                        className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={openCodeForTutor}
                        disabled={generateCode.isPending}
                        data-testid="link-connect-telegram-tutor"
                      >
                        {generateCode.isPending && codeTarget === "tutor"
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Bot className="h-3.5 w-3.5" />}
                        Получить код для подключения
                      </Button>
                      {tgStatus.tutorLink && (
                        <p className="text-[11px] text-muted-foreground text-center">
                          Или откройте{" "}
                          <a href={tgStatus.tutorLink} target="_blank" rel="noreferrer" className="underline text-blue-500">
                            @{tgStatus.botUsername}
                          </a>{" "}
                          и нажмите Start
                        </p>
                      )}
                    </div>
                  )}

                  {tgStatus.tutorLinked && (
                    <div className="text-xs text-green-600 dark:text-green-400">
                      ✅ Вы получаете уведомления в Telegram
                    </div>
                  )}
                </div>

                {/* Bot capabilities */}
                <div className="rounded-xl bg-muted/40 px-3 py-2.5 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Возможности бота:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>📚 Сдал домашку → вам</span>
                    <span>✅ Проверили работу → ученику</span>
                    <span>🔔 Напоминание за 60 мин</span>
                    <span>📅 /today, /homework, /students</span>
                  </div>
                </div>

                {/* Students telegram links */}
                {tgStatus.students.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Telegram учеников</p>
                    <div className="rounded-xl border border-border/60 bg-background/50 overflow-hidden divide-y divide-border/40">
                      {tgStatus.students.map(s => (
                        <div key={s.id} className="flex items-center justify-between px-3 py-2.5 gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {s.telegramLinked ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-sm truncate">{s.name}</span>
                            {s.telegramLinked && <Badge className="text-[10px] bg-green-500/15 text-green-700 dark:text-green-400 h-4">подключён</Badge>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {s.telegramLinked ? (
                              <Button
                                data-testid={`button-unlink-telegram-${s.id}`}
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() => unlinkStudent.mutate(s.id)}
                                disabled={unlinkStudent.isPending}
                              >
                                Отвязать
                              </Button>
                            ) : (
                              <div className="flex gap-1">
                                <Button
                                  data-testid={`button-code-${s.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-blue-500/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  onClick={() => openCodeForStudent(s.id, s.name)}
                                  disabled={generateCode.isPending}
                                >
                                  {generateCode.isPending && codeStudentId === s.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <><Bot className="h-3 w-3" /> Код</>
                                  }
                                </Button>
                                {s.inviteLink && (
                                  <Button
                                    data-testid={`button-copy-link-${s.id}`}
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1 text-muted-foreground"
                                    onClick={() => copyStudentLink(s.inviteLink!, s.id)}
                                  >
                                    {tgCopiedLink === s.id ? <CheckCircle2 className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Скопируйте ссылку и отправьте ученику — он нажмёт кнопку и Telegram привяжется автоматически.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Безопасность входа</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-2.5">
              <div>
                <div className="text-sm font-semibold">Email подтверждён</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </div>
              {emailVerified ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Подтверждён</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => sendVerification.mutate()}
                  disabled={sendVerification.isPending} data-testid="button-send-verification">
                  Отправить письмо
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-2.5">
              <div>
                <div className="text-sm font-semibold">Двухфакторная защита (email)</div>
                <div className="text-xs text-muted-foreground">
                  Код из 6 цифр будет запрошен при входе в аккаунт
                </div>
              </div>
              <Button
                size="sm"
                variant={twoFactorEnabled ? "default" : "outline"}
                onClick={() => toggle2FA.mutate(!twoFactorEnabled)}
                disabled={toggle2FA.isPending}
                data-testid="button-toggle-2fa"
              >
                {twoFactorEnabled ? "Выключить" : "Включить"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Реферальная программа</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-3">
              <div className="text-sm text-muted-foreground">Ваш реферальный код</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="bg-muted px-3 py-1.5 rounded text-lg font-mono font-bold" data-testid="text-referral-code">{referralCode}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(referralCode); toast.success("Код скопирован"); }} data-testid="button-copy-referral">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href="/referrals" data-testid="link-referrals">Подробнее →</a>
                </Button>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Поделитесь кодом с коллегами — вы оба получите бонусы при их регистрации.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Календарь (Google / Apple / Outlook)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CalendarSubscriptionBlock />
          </CardContent>
        </Card>

        {/* ─── Резервные копии ─────────────────────────────────────────── */}
        <Card className="rounded-2xl border-border/70 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <CardTitle className="text-base">Резервные копии</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                Авто-бэкап ежедневно
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Status row */}
            {(() => {
              const lastAuto = (backups as any[]).find(b => b.type === 'auto');
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Clock className="h-3 w-3" />
                      Последний авто-бэкап
                    </div>
                    <div className="text-sm font-medium">
                      {lastAuto ? new Date(lastAuto.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Пока не создан"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <HardDrive className="h-3 w-3" />
                      Всего копий
                    </div>
                    <div className="text-sm font-medium">
                      {backupsLoading ? "..." : `${(backups as any[]).length}`}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({(backups as any[]).filter(b => b.type === 'auto').length} авто + {(backups as any[]).filter(b => b.type === 'manual').length} ручных)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Create manual backup */}
            <div className="flex gap-2">
              <Input
                placeholder="Название (необязательно)"
                value={backupNote}
                onChange={e => setBackupNote(e.target.value)}
                className="h-9 text-sm flex-1"
                data-testid="input-backup-note"
              />
              <Button
                size="sm"
                onClick={createBackup}
                disabled={creatingBackup}
                className="h-9 gap-1.5 shrink-0"
                data-testid="button-create-backup"
              >
                {creatingBackup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Создать копию
              </Button>
            </div>

            {/* Backup list */}
            {backupsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (backups as any[]).length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Резервных копий пока нет.<br />
                <span className="text-xs">При следующем входе в систему автоматически создастся первая копия.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {(backups as any[]).map((b: any) => {
                  const sizeMb = (b.sizeBytes / 1024 / 1024).toFixed(2);
                  const dateStr = new Date(b.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 hover:bg-muted/40 transition-colors" data-testid={`backup-row-${b.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{b.note || dateStr}</span>
                          <Badge variant={b.type === 'auto' ? "secondary" : "outline"} className="text-xs shrink-0">
                            {b.type === 'auto' ? 'Авто' : 'Ручная'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {b.note && <span>{dateStr}</span>}
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-2.5 w-2.5" />
                            {sizeMb} МБ
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={`/api/backup/${b.id}/download`} download>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Скачать" data-testid={`button-download-backup-${b.id}`}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Удалить"
                          disabled={deletingBackupId === b.id}
                          onClick={() => deleteBackup(b.id)}
                          data-testid={`button-delete-backup-${b.id}`}
                        >
                          {deletingBackupId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Авто-бэкапы создаются ежедневно при входе в систему и хранятся 7 дней. Ручных копий можно хранить до 10 штук. Файл резервной копии содержит всех учеников, занятия, платежи и домашние задания.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showEditProfileDialog} onOpenChange={setShowEditProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать профиль</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Имя</Label>
              <Input value={editProfileName} onChange={(e) => setEditProfileName(e.target.value)} />
            </div>
            <div>
              <Label>Предметы</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {AVAILABLE_SUBJECTS.map((subj) => (
                  <Badge
                    key={subj}
                    variant={editProfileSubjects.includes(subj) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setEditProfileSubjects(
                        editProfileSubjects.includes(subj)
                          ? editProfileSubjects.filter((s) => s !== subj)
                          : [...editProfileSubjects, subj]
                      );
                    }}
                  >
                    {subj}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Базовая цена за занятие (₽)</Label>
              <Input type="number" value={editProfilePrice} onChange={(e) => setEditProfilePrice(Number(e.target.value))} />
            </div>
            <div>
              <Label>Часовой пояс</Label>
              <Select value={editProfileTimezone} onValueChange={setEditProfileTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveProfile} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Link-Code Dialog ─── */}
      <Dialog open={showCodeDialog} onOpenChange={(open) => {
        if (!open && codeTimerRef.current) { clearInterval(codeTimerRef.current); codeTimerRef.current = null; }
        setShowCodeDialog(open);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-blue-500" />
              {codeTarget === "tutor" ? "Подключить ваш Telegram" : `Подключить Telegram — ${codeStudentName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="text-sm text-muted-foreground leading-relaxed">
              {codeTarget === "tutor"
                ? <>Откройте Telegram-бот и введите этот код. Аккаунт привяжется автоматически.</>
                : <>Передайте этот код ученику. Пусть{" "}
                    {tgStatus?.botUsername
                      ? <a href={`https://t.me/${tgStatus.botUsername}`} target="_blank" rel="noreferrer" className="text-blue-500 underline">откроет бота</a>
                      : "откроет бота"
                    }{" "}и введёт его — аккаунт привяжется автоматически.</>
              }
            </div>

            {/* Big code display */}
            <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-6 flex flex-col items-center gap-3">
              {generateCode.isPending ? (
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              ) : (
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
                      ? <>Действителен {Math.floor(codeSecondsLeft / 60)}:{String(codeSecondsLeft % 60).padStart(2, "0")}</>
                      : <span className="text-red-500">Код истёк</span>
                    }
                  </div>
                </>
              )}
            </div>

            {/* Progress bar */}
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
                {codeCopied ? <><CheckCircle2 className="h-4 w-4" /> Скопировано</> : <><Copy className="h-4 w-4" /> Копировать код</>}
              </Button>
              <Button
                data-testid="button-refresh-code"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={refreshCode}
                disabled={generateCode.isPending}
                title="Сгенерировать новый код"
              >
                <RefreshCw className={`h-4 w-4 ${generateCode.isPending ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {tgStatus?.botUsername && codeTarget === "tutor" && (
              <a href={`https://t.me/${tgStatus.botUsername}`} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full gap-2 text-sm">
                  <Send className="h-3.5 w-3.5" />
                  Открыть @{tgStatus.botUsername}
                </Button>
              </a>
            )}

            <p className="text-[11px] text-muted-foreground text-center">
              {codeTarget === "tutor"
                ? "Код одноразовый, истекает через 15 минут"
                : "Код действует 15 минут. После ввода ученик получит приветственное сообщение."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function ReviewsModeration() {
  const qc = useQueryClient();
  const { data: reviews = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/reviews"] });

  const approveMut = useMutation({
    mutationFn: async ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      apiRequest("PATCH", `/api/reviews/${id}`, { isApproved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/reviews"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/reviews/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast.success("Отзыв удалён");
    },
  });

  const pendingCount = reviews.filter((r: any) => !r.isApproved).length;
  const approvedCount = reviews.filter((r: any) => r.isApproved).length;

  return (
    <Card className="rounded-2xl border-border/70 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Отзывы учеников</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {pendingCount > 0 && (
              <Badge variant="default" className="bg-amber-500 hover:bg-amber-600" data-testid="badge-pending-count">
                Ожидают: {pendingCount}
              </Badge>
            )}
            <Badge variant="secondary" data-testid="badge-approved-count">Опубликовано: {approvedCount}</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Отзывы появляются на публичной странице только после вашего одобрения
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Загрузка...</div>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Пока нет отзывов. Поделитесь публичной ссылкой, чтобы получать их.
          </div>
        ) : (
          <div className="space-y-2">
            {reviews.map((r: any) => (
              <div
                key={r.id}
                className={`rounded-xl border p-3 ${r.isApproved ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}
                data-testid={`review-mod-${r.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm" data-testid={`text-review-author-${r.id}`}>{r.authorName}</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      {r.isApproved ? (
                        <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400">Опубликован</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-700 dark:text-amber-400">Ожидает</Badge>
                      )}
                    </div>
                    {r.authorContact && (
                      <div className="text-xs text-muted-foreground mt-0.5">Контакт: {r.authorContact}</div>
                    )}
                    <p className="mt-2 text-sm whitespace-pre-wrap break-words">{r.text}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(r.createdAt).toLocaleString("ru-RU")}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {r.isApproved ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => approveMut.mutate({ id: r.id, isApproved: false })}
                        disabled={approveMut.isPending}
                        data-testid={`button-hide-${r.id}`}
                      >
                        <EyeOff className="h-3 w-3 mr-1" />Скрыть
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => approveMut.mutate({ id: r.id, isApproved: true })}
                        disabled={approveMut.isPending}
                        data-testid={`button-approve-${r.id}`}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />Одобрить
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Удалить отзыв безвозвратно?")) deleteMut.mutate(r.id);
                      }}
                      disabled={deleteMut.isPending}
                      data-testid={`button-delete-${r.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />Удалить
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
