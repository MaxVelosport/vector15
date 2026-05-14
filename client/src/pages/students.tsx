import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BellRing,
  MessagesSquare,
  BookOpen,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Copy,
  Award,
  Crown,
  Download,
  Edit3,
  ExternalLink,
  FileBarChart2,
  FileText,
  GraduationCap,
  Info,
  Key,
  LayoutGrid,
  Loader2,
  Mail,
  MessageCircle,
  NotebookPen,
  PenLine,
  Phone,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  Target,
  Trash2,
  User,
  Users,
  Video,
  XCircle,
  Paperclip,
} from "lucide-react";
import { exportStudentsToExcel } from "@/lib/export-excel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseConferenceLink, generateRoomName, makeInternalLink } from "@/lib/conference-utils";
import { SiZoom, SiGooglemeet, SiJitsi } from "react-icons/si";
import { useStudents, useLessons, usePayments, useCreateStudent, useUpdateStudent, useUpdateLesson, useDeleteLesson, useBulkReschedule, useGenerateProgram, useUpdateProgram, useDeleteProgram, useUpdateStudentTutorNotes, useDirectMessages, useSendDirectMessage, useHomework, type Questionnaire, type ProgramData, type ProgramTopic } from "@/hooks/use-tutor-data";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { invalidateResource } from "@/lib/queryClient";
import { StudentsImportDialog } from "@/components/students-import-dialog";
import { EmptyState } from "@/components/empty-state";
import { Upload } from "lucide-react";
import type { Student } from "@shared/schema";

import { useDocumentTitle } from "@/hooks/use-document-title";
type StudentWithProgram = Student & {
  hasProgram: boolean;
  programData: ProgramData | null;
  questionnaire: Questionnaire | null;
};

function moneyRub(amount: number) {
  const sign = amount < 0 ? "−" : "";
  const v = Math.abs(amount);
  return `${sign}${v.toLocaleString("ru-RU")} ₽`;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const TRANSLIT_MAP: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
function transliterate(str: string) {
  return str.toLowerCase().replace(/[а-яё]/g, c => TRANSLIT_MAP[c] || c).replace(/[^a-z0-9]/g, "");
}
function generateLogin(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = transliterate(parts[0] || "student");
  const last = parts[1] ? transliterate(parts[1]).slice(0, 3) : "";
  const num = Math.floor(10 + Math.random() * 90);
  return `${first}${last ? "." + last : ""}${num}`;
}

function generatePassword(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < length; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  return pass;
}

const HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => String(i + 7).padStart(2, "0"));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

function getAvatarColor(name: string) {
  const colors = [
    "from-blue-500 to-cyan-600",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-sky-500 to-blue-600",
    "from-indigo-500 to-blue-500",
  ];
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

const AVAILABLE_SUBJECTS = [
  "Математика", "Алгебра", "Геометрия", "Физика", "Химия", "Биология",
  "Информатика", "Русский язык", "Литература", "Английский язык",
  "Немецкий язык", "Французский язык", "История", "Обществознание", "География",
];

const GOALS_LIST = ["ЕГЭ (профиль)", "ЕГЭ (база)", "ЕГЭ", "ОГЭ", "Олимпиада", "Школьная программа"];
const MATH_GOALS = ["ЕГЭ (профиль)", "ЕГЭ (база)", "ОГЭ", "Олимпиада", "Школьная программа"];
const NON_MATH_GOALS = ["ЕГЭ", "ОГЭ", "Олимпиада", "Школьная программа"];

function statusLabel(status: string | null, attendance: string | null): string {
  if (!status) return "—";
  if (status === "scheduled") return "Запланировано";
  if (status === "pending") return "Ожидает";
  if (status === "completed") {
    if (attendance === "attended") return "✅ Проведено (оплачено)";
    if (attendance === "attended_unpaid") return "📋 Проведено (без оплаты)";
    return "✅ Проведено";
  }
  if (status === "cancelled") {
    if (attendance === "missed_paid") return "💸 Отмена (платная)";
    return "🚫 Отмена";
  }
  return status;
}

function StudentLessonHistory({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/lesson-history", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/lesson-history/${studentId}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open,
    staleTime: 30000,
  });

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">История изменений статусов</span>
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 py-3 space-y-2 max-h-56 overflow-y-auto bg-background/40">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Загрузка...
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">История изменений пуста</p>
          ) : history.map((h: any) => (
            <div key={h.id} className="text-xs flex items-start gap-2 py-1 border-b border-border/30 last:border-0">
              <div className="text-muted-foreground shrink-0 mt-0.5">{new Date(h.changed_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
              <div className="flex-1">
                <span className="line-through text-muted-foreground">{statusLabel(h.old_status, h.old_attendance)}</span>
                {" → "}
                <span className="font-medium">{statusLabel(h.new_status, h.new_attendance)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudentsPage() {
  useDocumentTitle("Ученики");
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const queryClient = useQueryClient();
  const { data: studentsData, isLoading } = useStudents();
  const { data: lessonsData } = useLessons();
  const { data: paymentsData } = usePayments();
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const updateLesson = useUpdateLesson();
  const deleteLesson = useDeleteLesson();
  const bulkReschedule = useBulkReschedule();
  const generateProgram = useGenerateProgram();
  const updateProgram = useUpdateProgram();
  const deleteProgram = useDeleteProgram();
  const { data: homeworkData } = useHomework();

  const { data: bbbConferences = [] } = useQuery<Array<{
    id: string; title: string; studentId: string | null; meetingId: string; isOneTime: boolean; isRunning: boolean; createdAt: string;
  }>>({ queryKey: ["/api/bbb/conferences"] });
  const [joiningBbbId, setJoiningBbbId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const handleJoinBbb = async (id: string) => {
    setJoiningBbbId(id);
    try {
      const res = await fetch(`/api/bbb/conferences/${id}/join`, { credentials: "include" });
      const data = await res.json();
      if (data.url) { window.open(data.url, "_blank"); }
      else { toast.error(data.error || "Ошибка подключения"); }
    } catch { toast.error("Ошибка подключения"); }
    finally { setJoiningBbbId(null); }
  };

  const handleSendPaymentReminder = async (studentId: string, studentName: string) => {
    setSendingReminderId(studentId);
    try {
      const res = await fetch(`/api/direct-messages/${studentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: "Здравствуйте! Напоминаю о необходимости пополнить баланс на занятия. Уточните, пожалуйста, удобный способ оплаты. Спасибо!" }),
      });
      if (res.ok) { toast.success(`Напоминание отправлено ${studentName}`); }
      else { toast.error("Не удалось отправить напоминание"); }
    } catch { toast.error("Ошибка отправки"); }
    finally { setSendingReminderId(null); }
  };

  const students = useMemo(() => (studentsData ?? []) as StudentWithProgram[], [studentsData]);
  const lessons = useMemo(() => lessonsData?.map(l => ({ ...l, scheduledAt: new Date(l.scheduledAt) })) ?? [], [lessonsData]);
  const payments = useMemo(() => paymentsData ?? [], [paymentsData]);

  const getEffectiveBalance = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const totalPaid = payments.filter(p => p.studentId === studentId).reduce((sum, p) => sum + p.amount, 0);
    const isBillable = (l: any) => (l.status === "completed" && l.attendance === "attended") || (l.status === "cancelled" && l.attendance === "missed_paid");
    const totalCost = lessons.filter(l => l.studentId === studentId && isBillable(l))
      .reduce((sum, l) => sum + Math.round((student?.pricePerLesson ?? 0) * (l.durationMinutes ?? 60) / 60), 0);
    return totalPaid - totalCost;
  };
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleStudentAvatarUpload = async (file: File, studentId: string) => {
    if (!file.type.startsWith("image/")) { return; }
    setAvatarUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl.length > 500000) { toast.error("Фото слишком большое (максимум ~375KB)"); setAvatarUploading(false); return; }
        const res = await fetch(`/api/avatar/student/${studentId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({ avatar: dataUrl }),
        });
        if (res.ok) { invalidateResource("students"); toast.success("Фото обновлено"); }
        else { toast.error("Ошибка загрузки фото"); }
        setAvatarUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { setAvatarUploading(false); }
  };

  const activeStudents = students.filter((s) => s.isActive);
  const archivedStudents = students.filter((s) => !s.isActive);

  const [studentFilter, setStudentFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "balance">("name");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? activeStudents[0];

  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [showParentReportDialog, setShowParentReportDialog] = useState(false);
  const [parentReportData, setParentReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [tutorNotesText, setTutorNotesText] = useState("");
  const [savingTutorNotes, setSavingTutorNotes] = useState(false);
  const [tutorNotesDirty, setTutorNotesDirty] = useState(false);
  const updateStudentTutorNotes = useUpdateStudentTutorNotes();
  const [newMaterialTitle, setNewMaterialTitle] = useState("");
  const [newMaterialUrl, setNewMaterialUrl] = useState("");
  const [savingMaterials, setSavingMaterials] = useState(false);
  const { data: chatMessages = [], refetch: refetchChat } = useDirectMessages(showChatDialog ? selectedStudentId : "");
  const sendDirectMessage = useSendDirectMessage(selectedStudentId);

  // Auto-open student from URL param ?open=ID
  useEffect(() => {
    const params = new URLSearchParams(searchStr);
    const openId = params.get("open");
    if (openId && students.length > 0) {
      const found = students.find(s => s.id === openId);
      if (found) {
        setSelectedStudentId(found.id);
        setShowProfileDialog(true);
        setLocation("/students", { replace: true });
      }
    }
  }, [searchStr, students]);

  // Reset schedule slot editing when switching students
  useEffect(() => {
    setEditingSlotKey(null);
    setShowAddSlotForm(false);
    setTutorNotesText((selectedStudent as any)?.tutorNotes || "");
    setTutorNotesDirty(false);
  }, [selectedStudentId]);

  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentSubject, setNewStudentSubject] = useState("");
  const [newStudentPrice, setNewStudentPrice] = useState(1000);
  const [newStudentGoal, setNewStudentGoal] = useState("ЕГЭ");
  const [newStudentGrade, setNewStudentGrade] = useState("10 класс");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [newStudentSocialLink, setNewStudentSocialLink] = useState("");
  const [newStudentConferenceLink, setNewStudentConferenceLink] = useState("");
  const [newStudentBoardLink, setNewStudentBoardLink] = useState("");
  const [newStudentParentLink, setNewStudentParentLink] = useState("");
  const [newStudentPaymentInfo, setNewStudentPaymentInfo] = useState("");
  const [newStudentComment, setNewStudentComment] = useState("");
  const [skipProgram, setSkipProgram] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire>({
    currentLevel: "",
    weakPoints: "",
    strongPoints: "",
    examDate: "",
    hoursPerWeek: 2,
    additionalInfo: "",
  });

  const [showEditLinksDialog, setShowEditLinksDialog] = useState(false);
  const [editConferenceLink, setEditConferenceLink] = useState("");
  const [editBoardLink, setEditBoardLink] = useState("");
  const [conferenceMode, setConferenceMode] = useState<"external" | "internal">("external");
  const [internalRoomName, setInternalRoomName] = useState("");
  const [editBoardType, setEditBoardType] = useState<"none" | "internal" | "miro" | "figma" | "excalidraw" | "other">("internal");

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editLessonDate, setEditLessonDate] = useState("");
  const [editLessonHour, setEditLessonHour] = useState("16");
  const [editLessonMinute, setEditLessonMinute] = useState("00");

  const [editingSlotKey, setEditingSlotKey] = useState<string | null>(null);
  const [editSlotDay, setEditSlotDay] = useState("1");
  const [editSlotHour, setEditSlotHour] = useState("16");
  const [editSlotMinute, setEditSlotMinute] = useState("00");

  const [showAddSlotForm, setShowAddSlotForm] = useState(false);
  const [addSlotDay, setAddSlotDay] = useState("1");
  const [addSlotHour, setAddSlotHour] = useState("16");
  const [addSlotMinute, setAddSlotMinute] = useState("00");
  const [addSlotDuration, setAddSlotDuration] = useState(60);
  const [addSlotMode, setAddSlotMode] = useState<RecurringMode>("ongoing");
  const [isAddingSlot, setIsAddingSlot] = useState(false);

  const [showProgramDialog, setShowProgramDialog] = useState(false);
  const [showQuestionnaireDialog, setShowQuestionnaireDialog] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramData | null>(null);
  
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  type ScheduleSlot = { day: string; hour: string; duration: number };
  type RecurringMode = "once" | "4weeks" | "ongoing";
  type BulkStudent = { name: string; subject: string; grade: string; goal: string; price: number; email: string; phone: string; socialLink: string; conferenceLink: string; boardLink: string; parentLink: string; paymentInfo: string; comment: string; generateProgram: boolean; schedules: ScheduleSlot[]; recurringMode: RecurringMode };
  const emptySchedule = (): ScheduleSlot => ({ day: "", hour: "16:00", duration: 60 });
  const emptyBulkRow = (): BulkStudent => ({ name: "", subject: "Математика", goal: "ЕГЭ (профиль)", grade: "10 класс", price: 1000, email: "", phone: "", socialLink: "", conferenceLink: "", boardLink: "", parentLink: "", paymentInfo: "", comment: "", generateProgram: false, schedules: [emptySchedule()], recurringMode: "ongoing" });
  const [bulkStudents, setBulkStudents] = useState<BulkStudent[]>([emptyBulkRow()]);
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  const [newStudentSchedules, setNewStudentSchedules] = useState<ScheduleSlot[]>([emptySchedule()]);
  const [newStudentRecurringMode, setNewStudentRecurringMode] = useState<RecurringMode>("ongoing");

  const [addFormTouched, setAddFormTouched] = useState(false);
  const addFormErrors = useMemo(() => {
    const errors: { name?: string; subject?: string } = {};
    if (!newStudentName.trim()) errors.name = "Укажите имя ученика";
    if (!newStudentSubject) errors.subject = "Выберите предмет";
    return errors;
  }, [newStudentName, newStudentSubject]);
  const addFormValid = Object.keys(addFormErrors).length === 0;

  const [bulkFormTouched, setBulkFormTouched] = useState(false);
  const bulkFormErrors = useMemo(() => {
    return bulkStudents.map(s => {
      const e: { name?: string; subject?: string } = {};
      if (!s.name.trim()) e.name = "Укажите имя";
      if (!s.subject.trim()) e.subject = "Выберите предмет";
      return e;
    });
  }, [bulkStudents]);
  const bulkFormValid = bulkStudents.length > 0 && bulkStudents.some((s, i) => Object.keys(bulkFormErrors[i]).length === 0 && s.name.trim());

  const [showEditStudentDialog, setShowEditStudentDialog] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editGoal, setEditGoal] = useState("ЕГЭ");
  const [editGrade, setEditGrade] = useState("10 класс");
  const [editPrice, setEditPrice] = useState(1000);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSocialLink, setEditSocialLink] = useState("");
  const [editParentLink, setEditParentLink] = useState("");
  const [editPaymentInfo, setEditPaymentInfo] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editBirthday, setEditBirthday] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const openEditDialog = () => {
    if (!selectedStudent) return;
    setEditName(selectedStudent.name);
    setEditSubject(selectedStudent.subject);
    setEditGoal(selectedStudent.goal);
    setEditGrade(selectedStudent.grade);
    setEditPrice(selectedStudent.pricePerLesson);
    setEditEmail(selectedStudent.email || "");
    setEditPhone(selectedStudent.parentContact || "");
    setEditSocialLink((selectedStudent as any).socialLink || "");
    setEditParentLink((selectedStudent as any).parentLink || "");
    setEditPaymentInfo((selectedStudent as any).paymentInfo || "");
    setEditComment((selectedStudent as any).comment || "");
    setEditBirthday(selectedStudent.birthday ? new Date(selectedStudent.birthday).toISOString().split("T")[0] : "");
    setShowEditStudentDialog(true);
  };

  const saveStudentEdit = async () => {
    if (!selectedStudent || !editName.trim()) {
      toast.error("Имя обязательно");
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateStudent.mutateAsync({
        id: selectedStudent.id,
        updates: {
          name: editName.trim(),
          subject: editSubject,
          goal: editGoal,
          grade: editGrade,
          pricePerLesson: editPrice,
          email: editEmail.trim() || null,
          parentContact: editPhone.trim() || null,
          socialLink: editSocialLink.trim() || null,
          parentLink: editParentLink.trim() || null,
          paymentInfo: editPaymentInfo.trim() || null,
          comment: editComment.trim() || null,
          birthday: (editBirthday || null) as any,
        } as any,
      });
      toast.success("Данные сохранены");
      setShowEditStudentDialog(false);
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false);
  const [portalEmail, setPortalEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [showCredentialsSuccess, setShowCredentialsSuccess] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState({ email: "", password: "" });

  const studentLessons = useMemo(() => {
    if (!selectedStudent) return { total: 0, completed: 0, thisMonth: 0 };
    const studentL = lessons.filter((l) => l.studentId === selectedStudent.id);
    const completed = studentL.filter((l) => l.status === "completed").length;
    const now = new Date();
    const thisMonth = studentL.filter((l) => {
      const d = new Date(l.scheduledAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total: studentL.length, completed, thisMonth };
  }, [selectedStudent, lessons]);

  const totalStats = useMemo(() => ({
    active: activeStudents.length,
    archived: archivedStudents.length,
    withProgram: activeStudents.filter(s => s.hasProgram).length,
  }), [activeStudents, archivedStudents]);

  const { data: studentSlotsData } = useQuery<{
    tier: string;
    tierName: string;
    activeStudents: number;
    maxStudents: number;
    baseSlots: number;
    extraSlots: number;
    extraStudentPrice: number;
    isAtLimit: boolean;
    isNearLimit: boolean;
  }>({
    queryKey: ["/api/student-slots"],
    queryFn: async () => {
      const r = await fetch("/api/student-slots");
      if (!r.ok) throw new Error("err");
      return r.json();
    },
  });

  const handleAddStudent = async () => {
    if (!newStudentName.trim() || !newStudentSubject) {
      toast.error("Укажите имя и предмет");
      return;
    }
    
    try {
      const linksObj = (newStudentConferenceLink || newStudentBoardLink) ? { conference: newStudentConferenceLink || "", board: newStudentBoardLink || "" } : undefined;
      const student = await createStudent.mutateAsync({
        name: newStudentName,
        subject: newStudentSubject,
        pricePerLesson: newStudentPrice,
        goal: newStudentGoal,
        grade: newStudentGrade,
        email: newStudentEmail || null,
        parentContact: newStudentPhone || null,
        socialLink: newStudentSocialLink || null,
        parentLink: newStudentParentLink || null,
        paymentInfo: newStudentPaymentInfo || null,
        comment: newStudentComment || null,
        links: linksObj,
        hasProgram: false,
      });

      let lessonsCreated = 0;
      const activeSlots = newStudentSchedules.filter(sl => sl.day);
      for (const slot of activeSlots) {
        const dayNum = DAY_NAMES[slot.day];
        const [hStr, mStr] = slot.hour.split(":");
        const hourNum = parseInt(hStr);
        const minNum = parseInt(mStr) || 0;
        if (dayNum !== undefined && !isNaN(hourNum)) {
          const today = new Date();
          const currentDay = today.getDay();
          let daysUntil = dayNum - currentDay;
          if (daysUntil <= 0) daysUntil += 7;
          const weeksCount = RECURRING_WEEKS[newStudentRecurringMode];
          for (let week = 0; week < weeksCount; week++) {
            const lessonDate = new Date(today);
            lessonDate.setDate(today.getDate() + daysUntil + (week * 7));
            lessonDate.setHours(hourNum, minNum, 0, 0);
            try {
              await fetch("/api/lessons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  studentId: student.id,
                  scheduledAt: lessonDate.toISOString(),
                  durationMinutes: slot.duration,
                  topic: newStudentSubject,
                  status: "pending",
                }),
              });
              lessonsCreated++;
            } catch {}
          }
        }
      }

      const lessonMsg = lessonsCreated > 0 ? ` и ${lessonsCreated} ${lessonsCreated === 1 ? "занятие" : "занятий"}` : "";
      toast.success(`Ученик ${newStudentName} добавлен${lessonMsg}! Программу можно создать через профиль ученика.`);

      if (lessonsCreated > 0) invalidateResource("lessons");

      const autoLogin = newStudentEmail || generateLogin(newStudentName);
      const autoPass = generatePassword();
      try {
        await fetch(`/api/students/${student.id}/set-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: autoLogin, password: autoPass }),
        });
        setSavedCredentials({ email: autoLogin, password: autoPass });
        setShowCredentialsSuccess(true);
        invalidateResource("students");
      } catch {}

      setShowAddStudentDialog(false);
      resetAddStudentForm();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("лимит") || msg.includes("Лимит")) {
        toast.error(msg);
      } else {
        toast.error("Ошибка при добавлении");
      }
    }
  };

  const DAY_NAMES: Record<string, number> = { "Пн": 1, "Вт": 2, "Ср": 3, "Чт": 4, "Пт": 5, "Сб": 6, "Вс": 0 };
  const RECURRING_WEEKS: Record<RecurringMode, number> = { once: 1, "4weeks": 4, ongoing: 12 };

  const handleBulkAdd = async () => {
    const validStudents = bulkStudents.filter(s => s.name.trim() && s.subject.trim());
    if (validStudents.length === 0) {
      toast.error("Заполните хотя бы одну карточку (имя и предмет обязательны)");
      return;
    }
    setIsBulkAdding(true);
    let added = 0;
    let failed = 0;
    let lessonsCreated = 0;
    let programsGenerated = 0;
    let limitReached = false;
    for (const s of validStudents) {
      try {
        const bulkLinks = (s.conferenceLink || s.boardLink) ? { conference: s.conferenceLink || "", board: s.boardLink || "" } : undefined;
        const student = await createStudent.mutateAsync({
          name: s.name.trim(),
          subject: s.subject,
          pricePerLesson: s.price,
          goal: s.goal,
          grade: s.grade,
          email: s.email || null,
          parentContact: s.phone || null,
          socialLink: s.socialLink || null,
          parentLink: s.parentLink || null,
          paymentInfo: s.paymentInfo || null,
          comment: s.comment || null,
          links: bulkLinks,
          hasProgram: false,
        });
        added++;

        if (s.generateProgram) {
          try {
            await generateProgram.mutateAsync({
              studentId: student.id,
              questionnaire: { currentLevel: "Средний", weakPoints: "Требуется диагностика", strongPoints: "", examDate: "", hoursPerWeek: 2, additionalInfo: `${s.subject}, ${s.goal}, ${s.grade}` },
            });
            programsGenerated++;
          } catch {}
        }

        const activeSlots = s.schedules.filter(sl => sl.day);
        for (const slot of activeSlots) {
          const dayNum = DAY_NAMES[slot.day];
          const [hStr, mStr] = slot.hour.split(":");
          const hourNum = parseInt(hStr);
          const minNum = parseInt(mStr) || 0;
          if (dayNum !== undefined && !isNaN(hourNum)) {
            const today = new Date();
            const currentDay = today.getDay();
            let daysUntil = dayNum - currentDay;
            if (daysUntil <= 0) daysUntil += 7;
            const weeksCount = RECURRING_WEEKS[s.recurringMode];
            for (let week = 0; week < weeksCount; week++) {
              const lessonDate = new Date(today);
              lessonDate.setDate(today.getDate() + daysUntil + (week * 7));
              lessonDate.setHours(hourNum, minNum, 0, 0);
              try {
                await fetch("/api/lessons", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    studentId: student.id,
                    scheduledAt: lessonDate.toISOString(),
                    durationMinutes: slot.duration,
                    topic: s.subject,
                    status: "pending",
                  }),
                });
                lessonsCreated++;
              } catch {}
            }
          }
        }
      } catch (err: any) {
        failed++;
        if (err?.message?.includes("лимит") || err?.message?.includes("Лимит") || err?.message?.includes("403")) {
          limitReached = true;
          break;
        }
      }
    }
    setIsBulkAdding(false);
    invalidateResource("lessons");
    if (limitReached) {
      toast.error(`Достигнут лимит учеников! Добавлено ${added} из ${validStudents.length}. Перейдите на более высокий тариф.`);
    } else if (failed > 0) {
      toast.warning(`Добавлено ${added} из ${validStudents.length}. Ошибок: ${failed}`);
    } else {
      const lessonMsg = lessonsCreated > 0 ? ` и ${lessonsCreated} занятий` : "";
      const progMsg = programsGenerated > 0 ? `, программ: ${programsGenerated}` : "";
      toast.success(`Добавлено учеников: ${added}${lessonMsg}${progMsg}`);
    }
    setShowBulkAddDialog(false);
    setBulkStudents([emptyBulkRow()]);
  };

  const updateBulkStudent = (index: number, field: string, value: any) => {
    setBulkStudents(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const updateBulkSchedule = (studentIdx: number, slotIdx: number, field: string, value: string | number) => {
    setBulkStudents(prev => prev.map((s, i) => {
      if (i !== studentIdx) return s;
      const newSchedules = s.schedules.map((sl, j) => j === slotIdx ? { ...sl, [field]: value } : sl);
      return { ...s, schedules: newSchedules };
    }));
  };

  const addBulkScheduleSlot = (studentIdx: number) => {
    setBulkStudents(prev => prev.map((s, i) => i === studentIdx ? { ...s, schedules: [...s.schedules, emptySchedule()] } : s));
  };

  const removeBulkScheduleSlot = (studentIdx: number, slotIdx: number) => {
    setBulkStudents(prev => prev.map((s, i) => {
      if (i !== studentIdx || s.schedules.length <= 1) return s;
      return { ...s, schedules: s.schedules.filter((_, j) => j !== slotIdx) };
    }));
  };

  const addBulkRow = () => {
    setBulkStudents(prev => [...prev, emptyBulkRow()]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkStudents.length <= 1) return;
    setBulkStudents(prev => prev.filter((_, i) => i !== index));
  };

  const resetAddStudentForm = () => {
    setNewStudentName("");
    setNewStudentSubject("");
    setNewStudentPrice(1000);
    setNewStudentGoal("ЕГЭ");
    setNewStudentGrade("10 класс");
    setNewStudentEmail("");
    setNewStudentPhone("");
    setNewStudentSocialLink("");
    setNewStudentConferenceLink("");
    setNewStudentBoardLink("");
    setNewStudentParentLink("");
    setNewStudentComment("");
    setSkipProgram(false);
    setShowQuestionnaire(false);
    setNewStudentSchedules([emptySchedule()]);
    setNewStudentRecurringMode("ongoing");
    setAddFormTouched(false);
    setQuestionnaire({
      currentLevel: "",
      weakPoints: "",
      strongPoints: "",
      examDate: "",
      hoursPerWeek: 2,
      additionalInfo: "",
    });
  };

  const handleGenerateProgramForStudent = async () => {
    if (!selectedStudent) return;
    if (!questionnaire.currentLevel || !questionnaire.weakPoints) {
      toast.error("Заполните уровень и слабые стороны");
      return;
    }
    
    toast.loading("Генерирую программу...", { id: "gen-program" });
    try {
      await generateProgram.mutateAsync({
        studentId: selectedStudent.id,
        questionnaire,
      });
      toast.success("Программа сгенерирована!", { id: "gen-program" });
      setShowQuestionnaireDialog(false);
      setQuestionnaire({
        currentLevel: "",
        weakPoints: "",
        strongPoints: "",
        examDate: "",
        hoursPerWeek: 2,
        additionalInfo: "",
      });
    } catch {
      toast.error("Ошибка генерации программы", { id: "gen-program" });
    }
  };

  const handleSaveProgram = async () => {
    if (!selectedStudent || !editingProgram) return;
    
    const filteredTopics = editingProgram.topics.filter(t => t.title.trim());
    const recalculatedProgram: ProgramData = {
      ...editingProgram,
      topics: filteredTopics,
      totalLessons: filteredTopics.reduce((sum, t) => sum + t.lessonsNeeded, 0),
      updatedAt: new Date().toISOString(),
      generatedAt: editingProgram.generatedAt || new Date().toISOString(),
    };
    
    try {
      await updateProgram.mutateAsync({
        studentId: selectedStudent.id,
        programData: recalculatedProgram,
      });
      toast.success("Программа сохранена");
      setShowProgramDialog(false);
      setEditingProgram(null);
    } catch {
      toast.error("Ошибка сохранения");
    }
  };

  const handleDeleteProgram = async () => {
    if (!selectedStudent) return;
    try {
      await deleteProgram.mutateAsync(selectedStudent.id);
      toast.success("Программа удалена");
      setShowProgramDialog(false);
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const toggleTopicCompleted = (idx: number) => {
    if (!editingProgram) return;
    const newTopics = [...editingProgram.topics];
    newTopics[idx] = { ...newTopics[idx], completed: !newTopics[idx].completed };
    setEditingProgram({ ...editingProgram, topics: newTopics });
  };

  const removeTopic = (idx: number) => {
    if (!editingProgram) return;
    const newTopics = editingProgram.topics.filter((_, i) => i !== idx);
    setEditingProgram({
      ...editingProgram,
      topics: newTopics,
      totalLessons: newTopics.reduce((sum, t) => sum + t.lessonsNeeded, 0),
    });
  };

  const moveTopicUp = (idx: number) => {
    if (!editingProgram || idx === 0) return;
    const newTopics = [...editingProgram.topics];
    [newTopics[idx - 1], newTopics[idx]] = [newTopics[idx], newTopics[idx - 1]];
    setEditingProgram({ ...editingProgram, topics: newTopics });
  };

  const moveTopicDown = (idx: number) => {
    if (!editingProgram || idx >= editingProgram.topics.length - 1) return;
    const newTopics = [...editingProgram.topics];
    [newTopics[idx], newTopics[idx + 1]] = [newTopics[idx + 1], newTopics[idx]];
    setEditingProgram({ ...editingProgram, topics: newTopics });
  };

  const updateTopicField = (idx: number, field: keyof ProgramTopic, value: any) => {
    if (!editingProgram) return;
    const newTopics = [...editingProgram.topics];
    newTopics[idx] = { ...newTopics[idx], [field]: value };
    setEditingProgram({
      ...editingProgram,
      topics: newTopics,
      totalLessons: newTopics.reduce((sum, t) => sum + t.lessonsNeeded, 0),
    });
  };

  const toggleArchive = async (id: string) => {
    const student = students.find((s) => s.id === id);
    if (!student) return;
    try {
      await updateStudent.mutateAsync({ id, updates: { isActive: !student.isActive } });
      if (student.isActive) {
        // Архивация — сервер отменил предстоящие занятия, обновляем кэш
        invalidateResource("lessons");
        toast.success("Ученик в архиве. Все предстоящие занятия отменены.");
      } else {
        toast.success("Ученик восстановлен");
      }
    } catch {
      toast.error("Ошибка");
    }
  };

  const saveLinks = async () => {
    if (!selectedStudent) return;
    try {
      const conferenceValue = conferenceMode === "internal"
        ? makeInternalLink(internalRoomName)
        : editConferenceLink;
      const boardValue = (editBoardType === "internal" || editBoardType === "none") ? "" : editBoardLink;
      await updateStudent.mutateAsync({
        id: selectedStudent.id,
        updates: {
          links: {
            conference: conferenceValue,
            board: boardValue,
            boardType: editBoardType,
            conferenceType: conferenceMode === "internal" ? "jitsi" : (() => {
              const conf = parseConferenceLink(conferenceValue);
              return conf?.service || "other";
            })(),
          }
        },
      });
      toast.success("Ссылки сохранены");
      setShowEditLinksDialog(false);
    } catch {
      toast.error("Ошибка сохранения");
    }
  };

  const handleSetPassword = async () => {
    if (!selectedStudent || !portalEmail || !portalPassword) {
      toast.error("Укажите email и пароль");
      return;
    }
    if (portalPassword.length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }
    setIsSettingPassword(true);
    try {
      const res = await fetch(`/api/students/${selectedStudent.id}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: portalEmail, password: portalPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка");
      }
      setSavedCredentials({ email: portalEmail, password: portalPassword });
      setShowSetPasswordDialog(false);
      setShowCredentialsSuccess(true);
      setPortalEmail("");
      setPortalPassword("");
      invalidateResource("students");
    } catch (error: any) {
      toast.error(error.message || "Ошибка настройки доступа");
    } finally {
      setIsSettingPassword(false);
    }
  };
  
  const copyCredentials = () => {
    const text = `Вход в личный кабинет ученика:\nСайт: ${window.location.origin}/login\nEmail: ${savedCredentials.email}\nПароль: ${savedCredentials.password}`;
    navigator.clipboard.writeText(text);
    toast.success("Данные скопированы в буфер обмена");
  };

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set(students.map(s => s.subject));
    return Array.from(subjects).sort();
  }, [students]);

  const displayedStudents = (showArchived ? archivedStudents : activeStudents)
    .filter((s) => !studentFilter || s.name.toLowerCase().includes(studentFilter.toLowerCase()) || s.subject.toLowerCase().includes(studentFilter.toLowerCase()))
    .filter((s) => !subjectFilter || s.subject === subjectFilter)
    .sort((a, b) => {
      if (sortBy === "balance") return getEffectiveBalance(a.id) - getEffectiveBalance(b.id);
      return a.name.localeCompare(b.name, "ru");
    });

  if (isLoading) {
    return (
      <DashboardLayout title="Ученики" subtitle="Загрузка...">
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-muted-foreground">Загрузка...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="👥 Ученики"
      subtitle="Управляйте учениками и отслеживайте прогресс"
      actions={
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" data-testid="button-export-students"
            onClick={() => exportStudentsToExcel(students)}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden sm:flex" onClick={() => setShowImportDialog(true)} data-testid="button-import-students">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Импорт</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden sm:flex" onClick={() => setShowBulkAddDialog(true)}>
            <Users className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Добавить учеников</span>
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs shadow-lg" data-testid="button-add-student" onClick={() => setShowAddStudentDialog(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ученика</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <PageHero
          icon={<Users className="h-6 w-6 text-white" />}
          gradient="from-blue-600/80 via-cyan-600/70 to-teal-600/60"
          title="Управление учениками"
          subtitle="Централизованная база с карточками, балансами и программами подготовки. Кликните на ученика — профиль, ссылки на конференцию и доску, история занятий."
          badge="CRM"
        />

        {studentSlotsData && studentSlotsData.maxStudents !== -1 && (
          <div className={cn(
            "rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3",
            studentSlotsData.isAtLimit
              ? "bg-red-50/80 border-red-200/60 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-300"
              : studentSlotsData.isNearLimit
                ? "bg-amber-50/80 border-amber-200/60 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300"
                : "bg-emerald-50/50 border-emerald-200/60 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300"
          )} data-testid="banner-student-slots">
            <div className="flex items-center gap-2">
              {studentSlotsData.isAtLimit ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <Users className="h-4 w-4 shrink-0" />
              )}
              <span>
                Учеников: <strong>{studentSlotsData.activeStudents}</strong> из <strong>{studentSlotsData.maxStudents}</strong>
                {studentSlotsData.extraSlots > 0 && (
                  <span className="text-xs ml-1">(тариф: {studentSlotsData.baseSlots} + доп: {studentSlotsData.extraSlots})</span>
                )}
                {studentSlotsData.isAtLimit && " — лимит достигнут"}
                {studentSlotsData.isNearLimit && !studentSlotsData.isAtLimit && " — почти заполнено"}
              </span>
            </div>
            {(studentSlotsData.isAtLimit || studentSlotsData.isNearLimit) && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs shrink-0"
                onClick={() => setLocation("/subscription")}
                data-testid="button-upgrade-from-students"
              >
                <Crown className="h-3.5 w-3.5" />
                {studentSlotsData.extraStudentPrice > 0 ? "Докупить" : "Повысить тариф"}
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><Users className="h-10 w-10 text-blue-600 rotate-6" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{totalStats.active}</div>
                    <div className="text-xs text-muted-foreground">Активных учеников</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><Target className="h-10 w-10 text-emerald-600 rotate-12" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                    <Target className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{totalStats.withProgram}</div>
                    <div className="text-xs text-muted-foreground">С программой</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-slate-500/10 to-gray-500/5 overflow-hidden relative">
              <div className="pointer-events-none absolute right-3 top-3 opacity-[0.12]"><XCircle className="h-10 w-10 text-slate-500 -rotate-12" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/20">
                    <XCircle className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{totalStats.archived}</div>
                    <div className="text-xs text-muted-foreground">В архиве</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени или предмету..."
              className="pl-9 rounded-xl"
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              data-testid="input-student-search"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {uniqueSubjects.length > 1 && (
              <Select value={subjectFilter} onValueChange={(v) => setSubjectFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px] h-9 rounded-xl text-sm">
                  <SelectValue placeholder="Все предметы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все предметы</SelectItem>
                  {uniqueSubjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant={sortBy === "balance" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy(sortBy === "balance" ? "name" : "balance")}
              className={sortBy === "balance" ? "bg-amber-500 hover:bg-amber-600 border-amber-500" : ""}
              title="Сортировать по балансу (сначала с наименьшим)"
            >
              <Banknote className="h-3.5 w-3.5 mr-1" />
              {sortBy === "balance" ? "По балансу ↑" : "По балансу"}
            </Button>
            <Button
              variant={!showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(false)}
              data-testid="button-show-active"
            >
              Активные ({activeStudents.length})
            </Button>
            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(true)}
              data-testid="button-show-archived"
            >
              Архив ({archivedStudents.length})
            </Button>
          </div>
        </div>

        <Card className="rounded-2xl border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              {showArchived ? "Архивные ученики" : "Активные ученики"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[550px] space-y-2 overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {displayedStudents.map((s, idx) => (
                  <motion.button
                    key={s.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      "w-full rounded-2xl border border-border/50 p-4 text-left transition-all duration-200",
                      "hover:bg-accent/50 hover:shadow-md hover:border-primary/30",
                      "bg-card/60",
                    )}
                    onClick={() => { setSelectedStudentId(s.id); setShowProfileDialog(true); }}
                    data-testid={`card-student-${s.id}`}
                  >
                    <div className="flex items-center gap-4">
                      {(s as any).avatar ? (
                        <img src={(s as any).avatar} alt={s.name} className="h-12 w-12 rounded-full object-cover shadow-lg" />
                      ) : (
                        <div className={cn("flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-white font-semibold text-sm shadow-lg", getAvatarColor(s.name))}>
                          {getInitials(s.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-semibold">{s.name}</div>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{s.subject}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Target className="h-3 w-3" />{s.goal}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{s.grade}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2.5 text-[11px]">
                          {(() => {
                            const completed = lessons.filter(l => l.studentId === s.id && l.status === "completed").length;
                            const bal = getEffectiveBalance(s.id);
                            return (<>
                              <span className="flex items-center gap-0.5 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" />{completed} занятий
                              </span>
                              <span className={cn("flex items-center gap-0.5", bal < 0 ? "text-red-500" : bal > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                                <Banknote className="h-3 w-3" />
                                {bal < 0 ? "−" : bal > 0 ? "+" : ""}{Math.abs(bal).toLocaleString("ru-RU")} ₽
                              </span>
                              {bal < 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSendPaymentReminder(s.id, s.name); }}
                                  disabled={sendingReminderId === s.id}
                                  title="Напомнить об оплате"
                                  className="inline-flex h-4 w-4 items-center justify-center rounded text-red-500 hover:bg-red-500/15 transition-colors"
                                  data-testid={`button-payment-reminder-${s.id}`}
                                >
                                  {sendingReminderId === s.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <BellRing className="h-3 w-3" />}
                                </button>
                              )}
                            </>);
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {/* Внутренняя доска — всегда */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setLocation(`/board/${s.id}`); }}
                            title="Доска (внутр.)"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10 hover:bg-violet-500/25 transition-colors"
                            data-testid={`button-board-student-${s.id}`}
                          >
                            <LayoutGrid className="h-3 w-3 text-violet-600" />
                          </button>
                          {/* Внутренняя конференция BBB — всегда */}
                          {(() => {
                            const bbbConf = bbbConferences.find(c => c.studentId === s.id);
                            if (bbbConf) return (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleJoinBbb(bbbConf.id); }}
                                disabled={joiningBbbId === bbbConf.id}
                                title={`Конференция BBB${bbbConf.isRunning ? " (идёт)" : ""}`}
                                className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                                  bbbConf.isRunning ? "bg-green-500/15 hover:bg-green-500/25" : "bg-blue-500/15 hover:bg-blue-500/25")}
                                data-testid={`button-bbb-student-${s.id}`}
                              >
                                {joiningBbbId === bbbConf.id
                                  ? <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                  : <Video className={cn("h-3 w-3", bbbConf.isRunning ? "text-green-500" : "text-blue-600")} />}
                              </button>
                            );
                            return (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted/30" title="Конференция BBB (не настроена)">
                                <Video className="h-3 w-3 text-muted-foreground/30" />
                              </span>
                            );
                          })()}
                          {/* Внешняя конференция — если есть */}
                          {(s as any).links?.conference && (
                            <a href={(() => { const l = (s as any).links.conference; return l.startsWith("http") ? l : `https://${l}`; })()} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Конференция (внешн.)">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/8 hover:bg-blue-500/15 transition-colors">
                                <Video className="h-3 w-3 text-blue-400" />
                              </span>
                            </a>
                          )}
                          {/* Внешняя доска — если есть */}
                          {(s as any).links?.board ? (
                            <a href={(() => { const l = (s as any).links.board; return l.startsWith("http") ? l : `https://${l}`; })()} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Доска (внешн.)">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/8 hover:bg-violet-500/15 transition-colors">
                                <PenLine className="h-3 w-3 text-violet-400" />
                              </span>
                            </a>
                          ) : null}
                          {s.hasProgram ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10" title="Есть план занятий">
                              <FileText className="h-3 w-3 text-emerald-600" />
                            </span>
                          ) : (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted/50" title="Нет плана занятий">
                              <FileText className="h-3 w-3 text-muted-foreground/30" />
                            </span>
                          )}
                          {(s as any).socialLink ? (
                            <a href={(() => { const l = (s as any).socialLink; return l.startsWith("http") ? l : `https://${l}`; })()} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Написать">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/10 hover:bg-orange-500/20 transition-colors">
                                <MessageCircle className="h-3 w-3 text-orange-600" />
                              </span>
                            </a>
                          ) : (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted/50" title="Нет соцсети">
                              <MessageCircle className="h-3 w-3 text-muted-foreground/30" />
                            </span>
                          )}
                          {(s as any).parentLink ? (
                            <a href={(() => { const l = (s as any).parentLink; return l.startsWith("http") ? l : `https://${l}`; })()} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Родитель">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/10 hover:bg-sky-500/20 transition-colors">
                                <Users className="h-3 w-3 text-sky-600" />
                              </span>
                            </a>
                          ) : (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted/50" title="Нет ссылки на родителя">
                              <Users className="h-3 w-3 text-muted-foreground/30" />
                            </span>
                          )}
                          {/* Внутренний чат */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setLocation(`/chat?studentId=${s.id}`); }}
                            title="Написать в чате"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                            data-testid={`button-chat-student-${s.id}`}
                          >
                            <MessagesSquare className="h-3 w-3 text-emerald-600" />
                          </button>
                        </div>
                        {(s as any).hasPortalAccess ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-emerald-50 text-emerald-600 border-emerald-200">
                            <Key className="h-2.5 w-2.5 mr-0.5" />
                            Доступ
                          </Badge>
                        ) : null}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
              {displayedStudents.length === 0 && (
                showArchived ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <User className="mx-auto h-12 w-12 opacity-30" />
                    <div className="mt-3 text-sm">Архив пуст</div>
                  </div>
                ) : (
                  <EmptyState
                    icon={Users}
                    title="Здесь пока пусто"
                    description="Добавьте первого ученика чтобы начать вести расписание и принимать оплаты"
                    actionLabel="Добавить ученика"
                    onAction={() => setShowAddStudentDialog(true)}
                    className="my-4 mx-2"
                  />
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">Профиль ученика</DialogTitle>
            </DialogHeader>
            {selectedStudent ? (
              <div className="space-y-4">
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f && selectedStudent) handleStudentAvatarUpload(f, selectedStudent.id); e.target.value = ""; }} />
                <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                  <button
                    className="relative group flex-shrink-0"
                    onClick={() => avatarInputRef.current?.click()}
                    title="Нажмите для смены фото"
                    disabled={avatarUploading}
                  >
                    {(selectedStudent as any).avatar ? (
                      <img src={(selectedStudent as any).avatar} alt={selectedStudent.name}
                        className="h-16 w-16 rounded-full object-cover shadow-xl ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all" />
                    ) : (
                      <div className={cn("flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-white font-bold text-xl shadow-xl transition-all group-hover:ring-2 group-hover:ring-primary/50", getAvatarColor(selectedStudent.name))}>
                        {avatarUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : getInitials(selectedStudent.name)}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] font-bold">↑</span>
                    </span>
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold" data-testid="text-selected-student-name">{selectedStudent.name}</div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs h-7"
                          onClick={() => window.open(`/certificate/${selectedStudent.id}`, "_blank")}
                          data-testid="button-open-certificate"
                          title="Открыть сертификат прогресса для печати или сохранения в PDF"
                        >
                          <Award className="h-3 w-3" />
                          Сертификат
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={openEditDialog}>
                          <Edit3 className="h-3 w-3" />
                          Изменить
                        </Button>
                      </div>
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {selectedStudent.subject} • {selectedStudent.goal} • {selectedStudent.grade}
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {selectedStudent.email && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <User className="h-3 w-3" />
                          {selectedStudent.email}
                        </Badge>
                      )}
                      {selectedStudent.parentContact && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Phone className="h-3 w-3" />
                          {selectedStudent.parentContact}
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/students/${selectedStudent.id}/parent-chat-link`, {
                              method: "POST",
                              credentials: "include",
                            });
                            if (!res.ok) throw new Error("Ошибка");
                            const { url } = await res.json();
                            await navigator.clipboard.writeText(url);
                            toast.success("Ссылка для родителя скопирована", {
                              description: "Отправьте её в WhatsApp, SMS или Telegram — вход без пароля.",
                            });
                          } catch {
                            toast.error("Не удалось сгенерировать ссылку");
                          }
                        }}
                        data-testid={`button-copy-parent-link-${selectedStudent.id}`}
                      >
                        <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-primary/10 text-primary border-primary/30">
                          <MessagesSquare className="h-3 w-3" />
                          Ссылка для родителя
                        </Badge>
                      </button>
                      {(selectedStudent as any).socialLink && (
                        <a href={(() => { const link = (selectedStudent as any).socialLink; return link.startsWith("http") ? link : `https://${link}`; })()} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-primary/10">
                            <ExternalLink className="h-3 w-3" />
                            {(selectedStudent as any).socialLink}
                          </Badge>
                        </a>
                      )}
                      {(() => {
                        const confInfo = parseConferenceLink((selectedStudent as any).links?.conference);
                        if (!confInfo) return null;
                        if (confInfo.isInternal) {
                          return (
                            <button onClick={() => { setShowProfileDialog(false); setLocation(`/conference?studentId=${selectedStudent.id}`); }}>
                              <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-primary/10 text-primary border-primary/30">
                                <Video className="h-3 w-3" />
                                Конференция (внутр.)
                              </Badge>
                            </button>
                          );
                        }
                        return (
                          <a href={confInfo.url} target="_blank" rel="noopener noreferrer">
                            <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-blue-500/10 text-blue-600 border-blue-200">
                              <Video className="h-3 w-3" />
                              {confInfo.displayName}
                            </Badge>
                          </a>
                        );
                      })()}
                      <button
                        onClick={() => { setShowProfileDialog(false); setLocation(`/board/${selectedStudent.id}`); }}
                        title="Внутренняя доска"
                      >
                        <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-purple-500/10 text-purple-600 border-purple-200">
                          <LayoutGrid className="h-3 w-3" />
                          Доска (внутр.)
                        </Badge>
                      </button>
                      {(selectedStudent as any).links?.board && (
                        <a href={(() => { const l = (selectedStudent as any).links.board; return l.startsWith("http") ? l : `https://${l}`; })()} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-violet-500/10 text-violet-600 border-violet-200">
                            <PenLine className="h-3 w-3" />
                            Доска (внешн.)
                          </Badge>
                        </a>
                      )}
                      {selectedStudent.hasProgram ? (
                        <Badge variant="outline" className="gap-1 text-xs bg-emerald-50 text-emerald-600 border-emerald-200">
                          <FileText className="h-3 w-3" />
                          План
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs bg-amber-50 text-amber-600 border-amber-200">
                          <FileText className="h-3 w-3" />
                          Без плана
                        </Badge>
                      )}
                      {(selectedStudent as any).parentLink && (
                        <a href={(() => { const l = (selectedStudent as any).parentLink; return l.startsWith("http") ? l : `https://${l}`; })()} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-pink-500/10 text-sky-600 border-pink-200">
                            <Users className="h-3 w-3" />
                            Родитель
                          </Badge>
                        </a>
                      )}
                      {selectedStudent.birthday && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Calendar className="h-3 w-3" />
                          {new Date(selectedStudent.birthday).toLocaleDateString("ru-RU")}
                        </Badge>
                      )}
                      {(selectedStudent as any).paymentInfo && (
                        <Badge variant="outline" className="gap-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" data-testid="badge-payment-info">
                          <Banknote className="h-3 w-3" />
                          {(selectedStudent as any).paymentInfo}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {(selectedStudent as any).comment && (
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Комментарий</span>
                    </div>
                    <p className="text-sm" data-testid="text-student-comment">{(selectedStudent as any).comment}</p>
                  </div>
                )}

                {/* Action buttons row */}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 flex-1" data-testid="button-open-chat" onClick={() => { setChatMessage(""); setShowChatDialog(true); }}>
                    <MessageCircle className="h-3.5 w-3.5" />
                    Чат
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 flex-1" data-testid="button-parent-report" onClick={async () => {
                    setLoadingReport(true);
                    try {
                      const res = await fetch(`/api/students/${selectedStudent.id}/parent-report`, { credentials: "include" });
                      if (res.ok) { setParentReportData(await res.json()); setShowParentReportDialog(true); }
                    } finally { setLoadingReport(false); }
                  }} disabled={loadingReport}>
                    {loadingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileBarChart2 className="h-3.5 w-3.5" />}
                    Отчёт для родителя
                  </Button>
                </div>

                {/* Auto parent report schedule */}
                {selectedStudent.parentContact && /\S+@\S+\.\S+/.test(selectedStudent.parentContact) && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs">
                      <FileBarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Авто-отчёт родителю:</span>
                    </div>
                    <Select
                      value={(selectedStudent as any).parentReportSchedule || "off"}
                      onValueChange={async (val) => {
                        try {
                          await updateStudent.mutateAsync({ id: selectedStudent.id, updates: { parentReportSchedule: val } as any });
                          toast.success(val === "off" ? "Авто-отчёт выключен" : `Будем отправлять ${val === "weekly" ? "каждую неделю" : "раз в месяц"}`);
                        } catch (e: any) {
                          toast.error(e.message || "Не удалось сохранить");
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 w-[150px] text-xs" data-testid="select-parent-report-schedule">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">Выключено</SelectItem>
                        <SelectItem value="weekly">Раз в неделю</SelectItem>
                        <SelectItem value="monthly">Раз в месяц</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Tutor notes */}
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <NotebookPen className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Заметки репетитора</span>
                    </div>
                    {tutorNotesDirty && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-400" data-testid="button-save-tutor-notes" onClick={async () => {
                        setSavingTutorNotes(true);
                        try {
                          await updateStudentTutorNotes.mutateAsync({ id: selectedStudent.id, notes: tutorNotesText });
                          setTutorNotesDirty(false);
                          toast.success("Заметки сохранены");
                        } finally { setSavingTutorNotes(false); }
                      }} disabled={savingTutorNotes}>
                        {savingTutorNotes ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Сохранить
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={tutorNotesText}
                    onChange={(e) => { setTutorNotesText(e.target.value); setTutorNotesDirty(true); }}
                    placeholder="Личные заметки о ученике (видны только вам)..."
                    rows={3}
                    className="text-xs resize-none bg-transparent border-amber-200/80 dark:border-amber-800/60 focus:border-amber-400"
                    data-testid="textarea-tutor-notes"
                  />
                </div>

                {/* Materials section */}
                {(() => {
                  const materials: {title: string; url: string}[] = (selectedStudent as any).links?.materials ?? [];
                  const saveMaterials = async (newList: {title: string; url: string}[]) => {
                    setSavingMaterials(true);
                    try {
                      const res = await fetch(`/api/students/${selectedStudent.id}`, {
                        method: "PATCH", credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ links: { ...(selectedStudent as any).links, materials: newList } }),
                      });
                      if (res.ok) {
                        invalidateResource("students");
                        toast.success("Материалы сохранены");
                      }
                    } finally { setSavingMaterials(false); }
                  };
                  return (
                    <div className="rounded-xl border border-border/50 p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">Материалы для ученика</span>
                        <span className="text-xs text-muted-foreground">(видны в кабинете ученика)</span>
                      </div>
                      {materials.length > 0 && (
                        <div className="space-y-1">
                          {materials.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs rounded-lg bg-muted/40 px-2 py-1.5">
                              <a href={m.url.startsWith("http") ? m.url : `https://${m.url}`} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">
                                {m.title || m.url}
                              </a>
                              <button
                                onClick={() => saveMaterials(materials.filter((_, j) => j !== i))}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                data-testid={`button-remove-material-${i}`}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="Название материала"
                          value={newMaterialTitle}
                          onChange={(e) => setNewMaterialTitle(e.target.value)}
                          className="h-7 text-xs flex-1"
                          data-testid="input-material-title"
                        />
                        <Input
                          placeholder="Ссылка (URL)"
                          value={newMaterialUrl}
                          onChange={(e) => setNewMaterialUrl(e.target.value)}
                          className="h-7 text-xs flex-1"
                          data-testid="input-material-url"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newMaterialUrl.trim()) {
                              saveMaterials([...materials, { title: newMaterialTitle.trim() || newMaterialUrl.trim(), url: newMaterialUrl.trim() }]);
                              setNewMaterialTitle(""); setNewMaterialUrl("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={!newMaterialUrl.trim() || savingMaterials}
                          data-testid="button-add-material"
                          onClick={() => {
                            saveMaterials([...materials, { title: newMaterialTitle.trim() || newMaterialUrl.trim(), url: newMaterialUrl.trim() }]);
                            setNewMaterialTitle(""); setNewMaterialUrl("");
                          }}
                        >
                          {savingMaterials ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-xl bg-blue-500/10 p-3 text-center">
                    <div className="text-xl font-bold text-blue-600" data-testid="stat-student-lessons">{studentLessons.total}</div>
                    <div className="text-xs text-muted-foreground">Занятий</div>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
                    <div className="text-xl font-bold text-emerald-600">{studentLessons.completed}</div>
                    <div className="text-xs text-muted-foreground">Проведено</div>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 p-3 text-center">
                    <div className="text-xl font-bold text-amber-600">{studentLessons.thisMonth}</div>
                    <div className="text-xs text-muted-foreground">В месяц</div>
                  </div>
                  <div className="rounded-xl bg-blue-500/10 p-3 text-center">
                    <div className="text-xl font-bold text-blue-600">{moneyRub(selectedStudent.pricePerLesson)}</div>
                    <div className="text-xs text-muted-foreground">Цена</div>
                  </div>
                </div>

                {/* Homework stats — T2 */}
                {(() => {
                  const studentHw = (homeworkData ?? []).filter((h: any) => h.studentId === selectedStudent.id);
                  if (studentHw.length === 0) return null;
                  const reviewed = studentHw.filter((h: any) => h.status === "reviewed");
                  const avgScore = reviewed.length > 0
                    ? Math.round(reviewed.reduce((s: number, h: any) => s + (h.score ?? 0), 0) / reviewed.length)
                    : null;
                  const submitted = studentHw.filter((h: any) => h.submittedAt);
                  const onTime = submitted.filter((h: any) => h.deadline && new Date(h.submittedAt) <= new Date(h.deadline)).length;
                  const onTimePct = submitted.length > 0 ? Math.round((onTime / submitted.length) * 100) : null;
                  return (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <span>📚</span> Статистика домашних заданий
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-violet-500/10 p-3 text-center">
                          <div className="text-xl font-bold text-violet-600">{studentHw.length}</div>
                          <div className="text-xs text-muted-foreground">Всего ДЗ</div>
                        </div>
                        <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
                          <div className="text-xl font-bold text-emerald-600">
                            {avgScore !== null ? `${avgScore}` : "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">Средний балл</div>
                        </div>
                        <div className="rounded-xl bg-amber-500/10 p-3 text-center">
                          <div className="text-xl font-bold text-amber-600">
                            {onTimePct !== null ? `${onTimePct}%` : "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">Сдано вовремя</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Quick schedule button — T3 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground hover:border-primary/50"
                  data-testid="button-quick-schedule"
                  onClick={() => { setShowProfileDialog(false); setLocation(`/schedule?openSchedule=${selectedStudent.id}`); }}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Запланировать урок
                </Button>

                <StudentLessonHistory studentId={selectedStudent.id} />

                {(() => {
                  const now = new Date();
                  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const futurePending = lessons
                    .filter(l => l.studentId === selectedStudent.id && l.scheduledAt >= todayStart && l.status === "pending")
                    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

                  const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
                  const DAY_NAMES_FULL = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
                  const DAY_OPTIONS = [
                    { value: "1", label: "Понедельник" },
                    { value: "2", label: "Вторник" },
                    { value: "3", label: "Среда" },
                    { value: "4", label: "Четверг" },
                    { value: "5", label: "Пятница" },
                    { value: "6", label: "Суббота" },
                    { value: "0", label: "Воскресенье" },
                  ];

                  const slotMap = new Map<string, { dayOfWeek: number; hour: number; minute: number; count: number; nextDate: Date; lessons: { id: string; scheduledAt: Date }[] }>();
                  futurePending.forEach(l => {
                    const d = l.scheduledAt;
                    const key = `${d.getDay()}-${d.getHours()}-${d.getMinutes()}`;
                    const existing = slotMap.get(key);
                    if (!existing) {
                      slotMap.set(key, { dayOfWeek: d.getDay(), hour: d.getHours(), minute: d.getMinutes(), count: 1, nextDate: d, lessons: [{ id: l.id, scheduledAt: d }] });
                    } else {
                      existing.count++;
                      existing.lessons.push({ id: l.id, scheduledAt: d });
                      if (d < existing.nextDate) existing.nextDate = d;
                    }
                  });

                  const slots = Array.from(slotMap.entries()).sort((a, b) => {
                    const dayA = a[1].dayOfWeek === 0 ? 7 : a[1].dayOfWeek;
                    const dayB = b[1].dayOfWeek === 0 ? 7 : b[1].dayOfWeek;
                    return dayA - dayB || a[1].hour - b[1].hour;
                  });

                  const DAY_NUM_OPTIONS = [
                    { value: "1", label: "Понедельник" },
                    { value: "2", label: "Вторник" },
                    { value: "3", label: "Среда" },
                    { value: "4", label: "Четверг" },
                    { value: "5", label: "Пятница" },
                    { value: "6", label: "Суббота" },
                    { value: "0", label: "Воскресенье" },
                  ];

                  const handleAddSlot = async () => {
                    if (!selectedStudent) return;
                    setIsAddingSlot(true);
                    try {
                      const dayNum = parseInt(addSlotDay);
                      const hourNum = parseInt(addSlotHour);
                      const minNum = parseInt(addSlotMinute);
                      const today = new Date();
                      const currentDay = today.getDay();
                      let daysUntil = dayNum - currentDay;
                      if (daysUntil <= 0) daysUntil += 7;
                      const weeksCount = RECURRING_WEEKS[addSlotMode];
                      let created = 0;
                      for (let week = 0; week < weeksCount; week++) {
                        const lessonDate = new Date(today);
                        lessonDate.setDate(today.getDate() + daysUntil + week * 7);
                        lessonDate.setHours(hourNum, minNum, 0, 0);
                        try {
                          await fetch("/api/lessons", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({
                              studentId: selectedStudent.id,
                              scheduledAt: lessonDate.toISOString(),
                              durationMinutes: addSlotDuration,
                              topic: selectedStudent.subject || "",
                              status: "pending",
                            }),
                          });
                          created++;
                        } catch {}
                      }
                      invalidateResource("lessons");
                      toast.success(`Добавлено ${created} занятий в расписание`);
                      setShowAddSlotForm(false);
                    } finally {
                      setIsAddingSlot(false);
                    }
                  };

                  return (
                    <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Расписание</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{futurePending.length} занятий впереди</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1"
                            data-testid="button-add-slot"
                            onClick={() => setShowAddSlotForm(v => !v)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Добавить
                          </Button>
                        </div>
                      </div>

                      {showAddSlotForm && (
                        <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                          <div className="text-xs font-medium text-primary mb-1">Новый слот в расписании</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className="h-8 rounded-lg border px-2 text-sm bg-background flex-1 min-w-[120px]"
                              value={addSlotDay}
                              onChange={e => setAddSlotDay(e.target.value)}
                              data-testid="select-add-slot-day"
                            >
                              {DAY_NUM_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </select>
                            <select
                              className="h-8 rounded-lg border px-2 text-sm bg-background w-[72px]"
                              value={addSlotHour}
                              onChange={e => setAddSlotHour(e.target.value)}
                              data-testid="select-add-slot-hour"
                            >
                              {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span className="text-sm font-medium">:</span>
                            <select
                              className="h-8 rounded-lg border px-2 text-sm bg-background w-[64px]"
                              value={addSlotMinute}
                              onChange={e => setAddSlotMinute(e.target.value)}
                              data-testid="select-add-slot-minute"
                            >
                              {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select
                              className="h-8 rounded-lg border px-2 text-sm bg-background w-[84px]"
                              value={String(addSlotDuration)}
                              onChange={e => setAddSlotDuration(parseInt(e.target.value))}
                              data-testid="select-add-slot-duration"
                            >
                              <option value="45">45 мин</option>
                              <option value="60">60 мин</option>
                              <option value="90">90 мин</option>
                              <option value="120">120 мин</option>
                            </select>
                          </div>
                          <select
                            className="h-8 rounded-lg border px-2 text-sm bg-background w-full"
                            value={addSlotMode}
                            onChange={e => setAddSlotMode(e.target.value as RecurringMode)}
                            data-testid="select-add-slot-mode"
                          >
                            <option value="once">Разовое занятие</option>
                            <option value="4weeks">На 4 недели</option>
                            <option value="ongoing">Постоянно (12 нед.)</option>
                          </select>
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs"
                              disabled={isAddingSlot}
                              data-testid="button-confirm-add-slot"
                              onClick={handleAddSlot}
                            >
                              {isAddingSlot ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Создаём...</> : "Создать занятия"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setShowAddSlotForm(false)}>
                              Отмена
                            </Button>
                          </div>
                        </div>
                      )}

                      {slots.length > 0 ? (
                        <div className="space-y-2">
                          {slots.map(([key, slot]) => {
                            const isEditing = editingSlotKey === key;
                            const timeStr = `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`;
                            const nextDateStr = slot.nextDate.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
                            return (
                              <div key={key} className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Изменить <strong>{DAY_NAMES_FULL[slot.dayOfWeek]} {timeStr}</strong> → все {slot.count} занятий
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <select
                                        className="h-8 rounded-lg border px-2 text-sm bg-background"
                                        value={editSlotDay}
                                        onChange={(e) => setEditSlotDay(e.target.value)}
                                        data-testid="select-slot-day"
                                      >
                                        {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                      </select>
                                      <select className="h-8 rounded-lg border px-2 text-sm bg-background" value={editSlotHour} onChange={(e) => setEditSlotHour(e.target.value)} data-testid="select-slot-hour">
                                        {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                      </select>
                                      <span className="text-sm font-medium">:</span>
                                      <select className="h-8 rounded-lg border px-2 text-sm bg-background" value={editSlotMinute} onChange={(e) => setEditSlotMinute(e.target.value)} data-testid="select-slot-minute">
                                        {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                                      </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        className="h-8 px-3 text-xs"
                                        disabled={bulkReschedule.isPending}
                                        data-testid="button-save-schedule"
                                        onClick={() => {
                                          const newDay = parseInt(editSlotDay);
                                          const newHour = parseInt(editSlotHour);
                                          const newMin = parseInt(editSlotMinute);
                                          const updates = slot.lessons.map(lesson => {
                                            const old = new Date(lesson.scheduledAt);
                                            const oldDay = old.getDay();
                                            let dayShift = newDay - oldDay;
                                            if (dayShift < -3) dayShift += 7;
                                            if (dayShift > 3) dayShift -= 7;
                                            const nd = new Date(old);
                                            nd.setDate(nd.getDate() + dayShift);
                                            nd.setHours(newHour, newMin, 0, 0);
                                            return { lessonId: lesson.id, newScheduledAt: nd.toISOString() };
                                          });
                                          bulkReschedule.mutate({
                                            studentId: selectedStudent.id,
                                            updates,
                                          }, {
                                            onSuccess: (data) => {
                                              toast.success(`Перенесено ${data.updated} занятий`);
                                              setEditingSlotKey(null);
                                            },
                                            onError: () => toast.error("Ошибка при переносе"),
                                          });
                                        }}
                                      >
                                        {bulkReschedule.isPending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Переносим...</> : `Перенести все ${slot.count} занятий`}
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setEditingSlotKey(null)}>
                                        Отмена
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm shrink-0">
                                      {DAY_NAMES[slot.dayOfWeek]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium">{DAY_NAMES_FULL[slot.dayOfWeek]}, {timeStr}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {slot.count} занятий · ближ. {nextDateStr}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2"
                                        data-testid={`button-edit-slot-${key}`}
                                        onClick={() => {
                                          setEditingSlotKey(key);
                                          setEditSlotDay(String(slot.dayOfWeek));
                                          setEditSlotHour(String(slot.hour).padStart(2, "0"));
                                          setEditSlotMinute(String(slot.minute).padStart(2, "0"));
                                        }}
                                      >
                                        <Edit3 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                                        data-testid={`button-delete-slot-${key}`}
                                        onClick={() => {
                                          if (!window.confirm(`Удалить все ${slot.count} занятий в ${DAY_NAMES_FULL[slot.dayOfWeek]} в ${timeStr}?`)) return;
                                          slot.lessons.forEach(l => {
                                            deleteLesson.mutate(l.id);
                                          });
                                          toast.success(`Удалено ${slot.count} занятий`);
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          Нет предстоящих занятий
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Доступ к порталу</span>
                    </div>
                    {(selectedStudent as any).hasPortalAccess ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Настроен
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                        Не настроен
                      </Badge>
                    )}
                  </div>
                  {(selectedStudent as any).hasPortalAccess && selectedStudent.email && (
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 mb-2 space-y-1.5">
                      {/* Login row with copy button */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">Логин:</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs font-mono font-medium truncate" data-testid="text-portal-login">{selectedStudent.email}</span>
                          <button
                            className="shrink-0 p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                            title="Скопировать логин"
                            data-testid="button-copy-login"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedStudent.email || "");
                              toast.success("Логин скопирован");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {/* Password row with copy button */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">Пароль:</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground" data-testid="text-portal-password">
                            {savedCredentials.password && savedCredentials.email === selectedStudent.email ? savedCredentials.password : "••••••"}
                          </span>
                          {savedCredentials.password && savedCredentials.email === selectedStudent.email ? (
                            <button
                              className="shrink-0 p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                              title="Скопировать пароль"
                              data-testid="button-copy-password"
                              onClick={() => {
                                navigator.clipboard.writeText(savedCredentials.password);
                                toast.success("Пароль скопирован");
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          ) : (
                            <button
                              className="shrink-0 p-1 rounded text-muted-foreground/40 cursor-not-allowed"
                              title="Выдайте или обновите доступ, чтобы скопировать пароль"
                              disabled
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Copy all button */}
                      <div className="pt-0.5">
                        {savedCredentials.password && savedCredentials.email === selectedStudent.email ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            data-testid="button-copy-portal-credentials"
                            onClick={() => {
                              const text = `Вход в личный кабинет:\nСайт: ${window.location.origin}/login\nЛогин: ${savedCredentials.email}\nПароль: ${savedCredentials.password}`;
                              navigator.clipboard.writeText(text);
                              toast.success("Логин и пароль скопированы");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                            Скопировать логин и пароль вместе
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-7 text-xs gap-1"
                            data-testid="button-copy-portal-credentials"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedStudent.email || "");
                              toast.success("Логин скопирован");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                            Скопировать логин
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      setPortalEmail(selectedStudent.email || "");
                      setPortalPassword("");
                      setShowSetPasswordDialog(true);
                    }}
                  >
                    <Key className="h-4 w-4" />
                    {(selectedStudent as any).hasPortalAccess ? "Изменить логин / пароль" : "Выдать доступ"}
                  </Button>
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Программа подготовки</span>
                    </div>
                    {selectedStudent.hasProgram ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Есть программа
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                        <XCircle className="h-3 w-3 mr-1" />
                        Без программы
                      </Badge>
                    )}
                  </div>
                  
                  {selectedStudent.hasProgram && selectedStudent.programData ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{selectedStudent.programData.topics?.length || 0} тем</span>
                        <span>{selectedStudent.programData.totalLessons || 0} занятий</span>
                        <span>~{selectedStudent.programData.estimatedWeeks || 0} нед.</span>
                      </div>
                      <Progress
                        value={
                          selectedStudent.programData.topics?.length
                            ? (selectedStudent.programData.topics.filter((t) => t.completed).length /
                               selectedStudent.programData.topics.length) * 100
                            : 0
                        }
                        className="h-2"
                      />
                      {selectedStudent.programData.topics && selectedStudent.programData.topics.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-xs text-muted-foreground font-medium">Карта тем</div>
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                            {selectedStudent.programData.topics.map((t, i) => (
                              <span
                                key={i}
                                data-testid={`badge-topic-${i}`}
                                title={`${t.title}${t.description ? ` — ${t.description}` : ""} (${t.lessonsNeeded} ур.)`}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-default transition-colors ${
                                  t.completed
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                    : t.priority === "high"
                                    ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900"
                                    : t.priority === "medium"
                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900"
                                    : "bg-muted/50 text-muted-foreground border-border/50"
                                }`}
                              >
                                {t.completed ? "✓" : t.priority === "high" ? "!" : "·"} {t.title}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Пройдено</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Приоритет</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Средний</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />Низкий</span>
                          </div>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => {
                          setEditingProgram(selectedStudent.programData);
                          setShowProgramDialog(true);
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                        Открыть программу
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Программа ещё не создана
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => {
                          setEditingProgram({
                            topics: [],
                            totalLessons: 0,
                            estimatedWeeks: 0,
                            recommendation: "",
                          });
                          setShowProgramDialog(true);
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                        Создать программу
                      </Button>
                      <button
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors"
                        onClick={() => setShowQuestionnaireDialog(true)}
                      >
                        <Sparkles className="h-3 w-3" />
                        Или сгенерировать с помощью ИИ
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                  {(() => {
                    const links = selectedStudent.links as any;
                    const confInfo = parseConferenceLink(links?.conference);
                    const boardType = links?.boardType || (links?.board ? "other" : "internal");
                    const bbbConf = bbbConferences.find(c => c.studentId === selectedStudent.id);

                    const confLabel = confInfo?.isInternal ? "Jitsi (встр.)" :
                      confInfo?.service === "zoom" ? "Zoom" :
                      confInfo?.service === "google_meet" ? "Google Meet" :
                      confInfo?.service === "teams" ? "Teams" :
                      links?.conference ? "Конференция" : null;

                    const boardLabel = boardType === "miro" ? "Miro" :
                      boardType === "figma" ? "Figma" :
                      boardType === "excalidraw" ? "Excalidraw" :
                      boardType === "internal" ? "Наша доска" :
                      boardType === "other" && links?.board ? "Доска" : null;

                    const bbbLabel = bbbConf ? (bbbConf.isRunning ? "BBB (идёт)" : "BBB-конференция") : null;

                    return (
                      <>
                        {(() => {
                          const defaultConf = (links as any)?.defaultConference as string | undefined;
                          const defaultBoard = (links as any)?.defaultBoard as string | undefined;

                          const saveDefaultConf = async (val: string) => {
                            const newDefault = defaultConf === val ? null : val;
                            await updateStudent.mutateAsync({
                              id: selectedStudent.id,
                              updates: { links: { ...(links as any), defaultConference: newDefault } },
                            });
                            toast.success(newDefault ? "Основная конференция выбрана" : "Выбор сброшен");
                          };
                          const saveDefaultBoard = async (val: string) => {
                            const newDefault = defaultBoard === val ? null : val;
                            await updateStudent.mutateAsync({
                              id: selectedStudent.id,
                              updates: { links: { ...(links as any), defaultBoard: newDefault } },
                            });
                            toast.success(newDefault ? "Основная доска выбрана" : "Выбор сброшен");
                          };

                          const confKey = confInfo?.isInternal ? "jitsi" : "external";

                          const hasMultipleConf = (confLabel ? 1 : 0) + (bbbConf ? 1 : 0) > 1;
                          const hasMultipleBoard = false; // internal + external is possible but no UI yet

                          return (
                            <>
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Инструменты занятия</div>
                                {(hasMultipleConf) && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Star className="h-3 w-3 text-amber-400" />
                                    = основной
                                  </span>
                                )}
                              </div>
                              <div className="space-y-2">
                                {confLabel && (
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      variant={defaultConf === confKey && hasMultipleConf ? "default" : "secondary"}
                                      size="sm"
                                      className="flex-1 gap-2 justify-start"
                                      onClick={() => {
                                        if (confInfo?.isInternal) {
                                          setShowProfileDialog(false);
                                          setLocation(`/conference?studentId=${selectedStudent.id}`);
                                        } else if (links?.conference) {
                                          window.open(links.conference.startsWith("http") ? links.conference : `https://${links.conference}`, "_blank");
                                        }
                                      }}
                                    >
                                      <Video className="h-4 w-4 text-blue-500" />
                                      <span className="flex-1 text-left">{confLabel}</span>
                                      {defaultConf === confKey && hasMultipleConf && (
                                        <span className="text-[10px] opacity-70 shrink-0">осн.</span>
                                      )}
                                    </Button>
                                    {hasMultipleConf && (
                                      <button
                                        type="button"
                                        title={defaultConf === confKey ? "Снять как основную" : "Сделать основной"}
                                        className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors", defaultConf === confKey ? "border-amber-400 bg-amber-50 text-amber-500 dark:bg-amber-950" : "border-border/50 text-muted-foreground hover:border-amber-300 hover:text-amber-400")}
                                        onClick={() => saveDefaultConf(confKey)}
                                      >
                                        <Star className={cn("h-3.5 w-3.5", defaultConf === confKey && "fill-amber-400")} />
                                      </button>
                                    )}
                                  </div>
                                )}
                                {bbbConf && (
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      variant={defaultConf === "bbb" && hasMultipleConf ? "default" : "secondary"}
                                      size="sm"
                                      className={cn("flex-1 gap-2 justify-start", bbbConf.isRunning && defaultConf !== "bbb" && "bg-green-500/10 text-green-700 hover:bg-green-500/20")}
                                      onClick={() => handleJoinBbb(bbbConf.id)}
                                      disabled={joiningBbbId === bbbConf.id}
                                      data-testid={`button-bbb-profile-${selectedStudent.id}`}
                                    >
                                      {joiningBbbId === bbbConf.id
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Video className={cn("h-4 w-4", bbbConf.isRunning && defaultConf !== "bbb" && "text-green-600")} />}
                                      <span className="flex-1 text-left">{bbbLabel}</span>
                                      {defaultConf === "bbb" && hasMultipleConf && (
                                        <span className="text-[10px] opacity-70 shrink-0">осн.</span>
                                      )}
                                    </Button>
                                    {hasMultipleConf && (
                                      <button
                                        type="button"
                                        title={defaultConf === "bbb" ? "Снять как основную" : "Сделать основной"}
                                        className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors", defaultConf === "bbb" ? "border-amber-400 bg-amber-50 text-amber-500 dark:bg-amber-950" : "border-border/50 text-muted-foreground hover:border-amber-300 hover:text-amber-400")}
                                        onClick={() => saveDefaultConf("bbb")}
                                      >
                                        <Star className={cn("h-3.5 w-3.5", defaultConf === "bbb" && "fill-amber-400")} />
                                      </button>
                                    )}
                                  </div>
                                )}
                                {/* Internal board — always available */}
                                {(() => {
                                  const hasExternalBoard = boardType !== "internal" && boardType !== "none" && links?.board;
                                  const hasMultipleBoards = hasExternalBoard;
                                  const extBoardLabel = boardType === "miro" ? "Miro" : boardType === "figma" ? "Figma" : boardType === "excalidraw" ? "Excalidraw" : "Доска (внешн.)";
                                  const isInternalDefault = !hasMultipleBoards || defaultBoard === "internal" || !defaultBoard;
                                  const isExternalDefault = hasMultipleBoards && defaultBoard === "external";
                                  return (
                                    <>
                                      <div className="flex items-center gap-1.5">
                                        <Button
                                          variant={isInternalDefault && hasMultipleBoards ? "default" : "secondary"}
                                          size="sm"
                                          className="flex-1 gap-2 justify-start"
                                          onClick={() => { setShowProfileDialog(false); setLocation(`/board/${selectedStudent.id}`); }}
                                        >
                                          <PenLine className="h-4 w-4 text-purple-500" />
                                          <span className="flex-1 text-left">Наша доска</span>
                                          {isInternalDefault && hasMultipleBoards && <span className="text-[10px] opacity-70 shrink-0">осн.</span>}
                                        </Button>
                                        {hasMultipleBoards && (
                                          <button
                                            type="button"
                                            title={isInternalDefault ? "Снять как основную" : "Сделать основной"}
                                            className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors", isInternalDefault ? "border-amber-400 bg-amber-50 text-amber-500 dark:bg-amber-950" : "border-border/50 text-muted-foreground hover:border-amber-300 hover:text-amber-400")}
                                            onClick={() => saveDefaultBoard("internal")}
                                          >
                                            <Star className={cn("h-3.5 w-3.5", isInternalDefault && "fill-amber-400")} />
                                          </button>
                                        )}
                                      </div>
                                      {hasExternalBoard && (
                                        <div className="flex items-center gap-1.5">
                                          <Button
                                            variant={isExternalDefault ? "default" : "secondary"}
                                            size="sm"
                                            className="flex-1 gap-2 justify-start"
                                            onClick={() => { if (links?.board) window.open(links.board.startsWith("http") ? links.board : `https://${links.board}`, "_blank"); }}
                                          >
                                            <PenLine className="h-4 w-4 text-purple-500" />
                                            <span className="flex-1 text-left">{extBoardLabel}</span>
                                            {isExternalDefault && <span className="text-[10px] opacity-70 shrink-0">осн.</span>}
                                          </Button>
                                          <button
                                            type="button"
                                            title={isExternalDefault ? "Снять как основную" : "Сделать основной"}
                                            className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors", isExternalDefault ? "border-amber-400 bg-amber-50 text-amber-500 dark:bg-amber-950" : "border-border/50 text-muted-foreground hover:border-amber-300 hover:text-amber-400")}
                                            onClick={() => saveDefaultBoard("external")}
                                          >
                                            <Star className={cn("h-3.5 w-3.5", isExternalDefault && "fill-amber-400")} />
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                                {!confLabel && !bbbConf && (() => false)() && (
                                  <p className="text-xs text-muted-foreground text-center py-2">Ссылки не настроены</p>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </>
                    );
                  })()}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={() => {
                      const links = selectedStudent.links as any;
                      const existingConf = links?.conference || "";
                      setEditBoardLink(links?.board || "");
                      if (existingConf.startsWith("jitsi:")) {
                        setConferenceMode("internal");
                        setInternalRoomName(existingConf.slice(6));
                        setEditConferenceLink("");
                      } else {
                        setConferenceMode("external");
                        setEditConferenceLink(existingConf);
                        setInternalRoomName(generateRoomName(selectedStudent.name));
                      }
                      const bt = links?.boardType || (links?.board ? "other" : "internal");
                      setEditBoardType(bt);
                      setShowEditLinksDialog(true);
                    }}
                  >
                    Редактировать ссылки
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    data-testid="button-toggle-archive"
                    onClick={() => { toggleArchive(selectedStudent.id); setShowProfileDialog(false); }}
                  >
                    {selectedStudent.isActive ? "В архив" : "Восстановить"}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    data-testid="button-open-board"
                    onClick={() => { setShowProfileDialog(false); setLocation(`/board/${selectedStudent.id}`); }}
                  >
                    <PenLine className="h-4 w-4" /> Доска
                  </Button>
                  <Button
                    className="gap-2"
                    data-testid="button-go-lessons"
                    onClick={() => setLocation("/lessons")}
                  >
                    Занятия <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={showAddStudentDialog} onOpenChange={(open) => { setShowAddStudentDialog(open); if (!open) resetAddStudentForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Новый ученик
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
              <div>
                <Label>Имя ученика <span className="text-destructive">*</span></Label>
                <Input value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="Иван Иванов" className={cn("mt-1", addFormTouched && addFormErrors.name && "border-destructive ring-1 ring-destructive/30")} data-testid="input-student-name" />
                {addFormTouched && addFormErrors.name && <p className="text-xs text-destructive mt-1">{addFormErrors.name}</p>}
              </div>
              <div>
                <Label>Предмет <span className="text-destructive">*</span></Label>
                <Select value={newStudentSubject} onValueChange={(v) => {
                  setNewStudentSubject(v);
                  if (v === "Математика" && newStudentGoal === "ЕГЭ") setNewStudentGoal("ЕГЭ (профиль)");
                  if (v !== "Математика" && (newStudentGoal === "ЕГЭ (профиль)" || newStudentGoal === "ЕГЭ (база)")) setNewStudentGoal("ЕГЭ");
                }}>
                  <SelectTrigger className={cn("mt-1", addFormTouched && addFormErrors.subject && "border-destructive ring-1 ring-destructive/30")} data-testid="select-student-subject"><SelectValue placeholder="Выберите предмет" /></SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {addFormTouched && addFormErrors.subject && <p className="text-xs text-destructive mt-1">{addFormErrors.subject}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Цель</Label>
                  <Select value={newStudentGoal} onValueChange={setNewStudentGoal}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(newStudentSubject === "Математика" ? MATH_GOALS : NON_MATH_GOALS).map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Класс</Label>
                  <Select value={newStudentGrade} onValueChange={setNewStudentGrade}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                        <SelectItem key={g} value={`${g} класс`}>{g} класс</SelectItem>
                      ))}
                      <SelectItem value="Студент">Студент</SelectItem>
                      <SelectItem value="Взрослый">Взрослый</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Цена за занятие (₽)</Label>
                <Input type="number" value={newStudentPrice} onChange={(e) => setNewStudentPrice(Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Логин <span className="text-xs text-muted-foreground font-normal">(для портала ученика)</span></Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1 text-primary"
                    onClick={() => { if (newStudentName.trim()) setNewStudentEmail(generateLogin(newStudentName)); }}
                    disabled={!newStudentName.trim()}
                    data-testid="button-generate-login"
                  >
                    <Sparkles className="h-3 w-3" />
                    Сгенерировать
                  </Button>
                </div>
                <Input value={newStudentEmail} onChange={(e) => setNewStudentEmail(e.target.value)} placeholder="ivan.iva42 или email" className="mt-1" data-testid="input-student-login" />
                <p className="text-[11px] text-muted-foreground mt-1">Логин или email для входа в портал ученика. Можно настроить позже.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Телефон <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
                  <Input value={newStudentPhone} onChange={(e) => setNewStudentPhone(e.target.value)} placeholder="+7..." className="mt-1" />
                </div>
                <div>
                  <Label>Соцсеть <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
                  <Input value={newStudentSocialLink} onChange={(e) => setNewStudentSocialLink(e.target.value)} placeholder="t.me/ivan или vk.com/id..." className="mt-1" data-testid="input-student-social" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Конференция <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
                  <Input value={newStudentConferenceLink} onChange={(e) => setNewStudentConferenceLink(e.target.value)} placeholder="zoom.us/j/... или meet.google.com/..." className="mt-1" data-testid="input-student-conference" />
                </div>
                <div>
                  <Label>Доска <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
                  <Input value={newStudentBoardLink} onChange={(e) => setNewStudentBoardLink(e.target.value)} placeholder="miro.com/... или jamboard.google.com/..." className="mt-1" data-testid="input-student-board" />
                </div>
              </div>
              <div>
                <Label>Ссылка на родителя <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
                <Input value={newStudentParentLink} onChange={(e) => setNewStudentParentLink(e.target.value)} placeholder="t.me/parent или ссылка на чат с родителем..." className="mt-1" data-testid="input-student-parent-link" />
              </div>
              <div>
                <Label>Реквизиты оплаты <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
                <Input value={newStudentPaymentInfo} onChange={(e) => setNewStudentPaymentInfo(e.target.value)} placeholder="Сбер +7 999 123-45-67, Иванова М.П." className="mt-1" data-testid="input-student-payment-info" />
              </div>
              <div>
                <Label>Комментарий <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
                <Textarea value={newStudentComment} onChange={(e) => setNewStudentComment(e.target.value)} placeholder="Заметки по ученику..." className="mt-1 min-h-[60px]" data-testid="input-student-comment" />
              </div>
              
              <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Расписание занятий</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1"
                    onClick={() => setNewStudentSchedules(prev => [...prev, emptySchedule()])}
                  >
                    <Plus className="h-3 w-3" />
                    Ещё день
                  </Button>
                </div>
                {newStudentSchedules.map((slot, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Select value={slot.day || "_none"} onValueChange={(v) => setNewStudentSchedules(prev => prev.map((sl, k) => k === j ? { ...sl, day: v === "_none" ? "" : v } : sl))}>
                      <SelectTrigger className="h-8 text-sm w-[80px]"><SelectValue placeholder="День" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">—</SelectItem>
                        {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={slot.hour.split(":")[0]} onValueChange={(v) => setNewStudentSchedules(prev => prev.map((sl, k) => k === j ? { ...sl, hour: `${v}:${sl.hour.split(":")[1] || "00"}` } : sl))}>
                      <SelectTrigger className="h-8 text-sm w-[65px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HOUR_OPTIONS.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">:</span>
                    <Select value={slot.hour.split(":")[1] || "00"} onValueChange={(v) => setNewStudentSchedules(prev => prev.map((sl, k) => k === j ? { ...sl, hour: `${sl.hour.split(":")[0]}:${v}` } : sl))}>
                      <SelectTrigger className="h-8 text-sm w-[60px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MINUTE_OPTIONS.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(slot.duration)} onValueChange={(v) => setNewStudentSchedules(prev => prev.map((sl, k) => k === j ? { ...sl, duration: parseInt(v) } : sl))}>
                      <SelectTrigger className="h-8 text-sm w-[80px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="45">45 мин</SelectItem>
                        <SelectItem value="60">60 мин</SelectItem>
                        <SelectItem value="90">90 мин</SelectItem>
                        <SelectItem value="120">120 мин</SelectItem>
                      </SelectContent>
                    </Select>
                    {newStudentSchedules.length > 1 && (
                      <button
                        onClick={() => setNewStudentSchedules(prev => prev.filter((_, k) => k !== j))}
                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  <Select value={newStudentRecurringMode} onValueChange={(v) => setNewStudentRecurringMode(v as RecurringMode)}>
                    <SelectTrigger className="h-8 text-sm w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Разовое занятие</SelectItem>
                      <SelectItem value="4weeks">На 4 недели</SelectItem>
                      <SelectItem value="ongoing">Постоянно (12 нед.)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newStudentSchedules.every(sl => !sl.day) && (
                  <p className="text-xs text-muted-foreground">
                    Выберите день — занятия создадутся автоматически. Можно не указывать.
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Программу подготовки можно сгенерировать через ИИ после добавления ученика — в его профиле.</span>
              </div>

              <Button className="w-full" onClick={() => { setAddFormTouched(true); if (addFormValid) handleAddStudent(); }} disabled={createStudent.isPending || (addFormTouched && !addFormValid)} data-testid="button-add-student-submit">
                {createStudent.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Добавление...</>
                ) : "Добавить ученика"}
              </Button>
              {addFormTouched && !addFormValid && (
                <p className="text-xs text-destructive text-center">Заполните обязательные поля, отмеченные *</p>
              )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditStudentDialog} onOpenChange={setShowEditStudentDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Редактировать данные ученика</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Имя</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="ФИО ученика" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Предмет</Label>
                <Select value={editSubject} onValueChange={(v) => {
                  setEditSubject(v);
                  if (v === "Математика" && editGoal === "ЕГЭ") setEditGoal("ЕГЭ (профиль)");
                  if (v !== "Математика" && (editGoal === "ЕГЭ (профиль)" || editGoal === "ЕГЭ (база)")) setEditGoal("ЕГЭ");
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Цель</Label>
                <Select value={editGoal} onValueChange={setEditGoal}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(editSubject === "Математика" ? MATH_GOALS : NON_MATH_GOALS).map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Класс</Label>
                <Select value={editGrade} onValueChange={setEditGrade}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 11 }, (_, i) => `${i + 1} класс`).map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                    <SelectItem value="Студент">Студент</SelectItem>
                    <SelectItem value="Взрослый">Взрослый</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Цена за занятие (₽)</Label>
                <Input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} className="mt-1" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Логин <span className="text-xs text-muted-foreground font-normal">(для портала)</span></Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary" onClick={() => { if (editName.trim()) setEditEmail(generateLogin(editName)); }} disabled={!editName.trim()}>
                  <Sparkles className="h-3 w-3" />
                  Сгенерировать
                </Button>
              </div>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="логин или email" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Телефон <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+7..." className="mt-1" />
              </div>
              <div>
                <Label>Соцсеть</Label>
                <Input value={editSocialLink} onChange={(e) => setEditSocialLink(e.target.value)} placeholder="t.me/ivan" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Ссылка на родителя <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
              <Input value={editParentLink} onChange={(e) => setEditParentLink(e.target.value)} placeholder="t.me/parent или ссылка на чат с родителем..." className="mt-1" data-testid="edit-parent-link" />
            </div>
            <div>
              <Label>Реквизиты оплаты <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
              <Input value={editPaymentInfo} onChange={(e) => setEditPaymentInfo(e.target.value)} placeholder="Сбер +7 999 123-45-67, Иванова М.П." className="mt-1" data-testid="edit-payment-info" />
            </div>
            <div>
              <Label>Дата рождения <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
              <Input type="date" value={editBirthday} onChange={(e) => setEditBirthday(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Комментарий <span className="text-xs text-muted-foreground font-normal">(необязат.)</span></Label>
              <Textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} placeholder="Заметки по ученику..." className="mt-1 min-h-[60px]" data-testid="edit-comment" />
            </div>
            <Button className="w-full" onClick={saveStudentEdit} disabled={isSavingEdit}>
              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditLinksDialog} onOpenChange={setShowEditLinksDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Конференция и доска
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Конференция</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConferenceMode("external")}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm transition-all",
                    conferenceMode === "external"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 hover:border-border hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <ExternalLink className="h-5 w-5" />
                  <span className="font-medium text-xs">Внешний сервис</span>
                  <span className="text-[10px] opacity-70">Zoom, Meet, Teams…</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConferenceMode("internal");
                    if (!internalRoomName) setInternalRoomName(generateRoomName(selectedStudent?.name || "student"));
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm transition-all",
                    conferenceMode === "internal"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 hover:border-border hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <Video className="h-5 w-5" />
                  <span className="font-medium text-xs">Внутренняя</span>
                  <span className="text-[10px] opacity-70">Встроенный Jitsi</span>
                </button>
              </div>

              {conferenceMode === "external" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {(() => {
                      const conf = parseConferenceLink(editConferenceLink);
                      if (!conf || conf.service === 'custom') return <ExternalLink className="h-4 w-4 text-muted-foreground mt-2.5 shrink-0" />;
                      if (conf.service === 'zoom') return <SiZoom className="h-4 w-4 text-blue-600 mt-2.5 shrink-0" />;
                      if (conf.service === 'google_meet') return <SiGooglemeet className="h-4 w-4 text-green-600 mt-2.5 shrink-0" />;
                      if (conf.service === 'teams') return <Video className="h-4 w-4 text-indigo-600 mt-2.5 shrink-0" />;
                      return <Video className="h-4 w-4 text-primary mt-2.5 shrink-0" />;
                    })()}
                    <Input
                      value={editConferenceLink}
                      onChange={e => setEditConferenceLink(e.target.value)}
                      placeholder="https://zoom.us/j/... или meet.google.com/..."
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Zoom", prefix: "https://zoom.us/j/" },
                      { label: "Google Meet", prefix: "https://meet.google.com/" },
                      { label: "Teams", prefix: "https://teams.microsoft.com/l/" },
                      { label: "Jitsi", prefix: "https://meet.jit.si/" },
                    ].map(s => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => setEditConferenceLink(s.prefix)}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {conferenceMode === "internal" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-primary mb-1">Встроенная конференция (Jitsi)</p>
                    <p>Ученик войдёт прямо в приложении — без внешних сервисов. Вы увидите кнопку «Начать конференцию» в профиле.</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Название комнаты</Label>
                    <div className="flex gap-2">
                      <Input
                        value={internalRoomName}
                        onChange={e => setInternalRoomName(e.target.value.replace(/\s+/g, '-'))}
                        placeholder="VektorRoom-name-xxxxx"
                        className="font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setInternalRoomName(generateRoomName(selectedStudent?.name || "student"))}
                      >
                        Обновить
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Ссылка: meet.jit.si/{internalRoomName || "…"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Доска</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "internal",   label: "Внутренняя", sub: "Встроена в приложение" },
                  { value: "miro",       label: "Miro",       sub: "miro.com" },
                  { value: "figma",      label: "Figma",      sub: "figma.com" },
                  { value: "excalidraw", label: "Excalidraw", sub: "excalidraw.com" },
                  { value: "other",      label: "Другая",     sub: "Своя ссылка" },
                  { value: "none",       label: "Не нужна",   sub: "Только конференция" },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditBoardType(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border p-2.5 text-sm transition-all",
                      editBoardType === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 hover:border-border hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <span className="font-medium text-xs">{opt.label}</span>
                    <span className="text-[9px] opacity-70 text-center leading-tight">{opt.sub}</span>
                  </button>
                ))}
              </div>
              {(editBoardType === "miro" || editBoardType === "figma" || editBoardType === "excalidraw" || editBoardType === "other") && (
                <Input
                  value={editBoardLink}
                  onChange={e => setEditBoardLink(e.target.value)}
                  placeholder={
                    editBoardType === "miro" ? "https://miro.com/app/board/..." :
                    editBoardType === "figma" ? "https://www.figma.com/file/..." :
                    editBoardType === "excalidraw" ? "https://excalidraw.com/#room/..." :
                    "https://..."
                  }
                />
              )}
              {editBoardType === "internal" && (
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-purple-700 dark:text-purple-400 mb-1">Встроенная доска</p>
                  <p>Ученик откроет её прямо в приложении — кнопка будет на главной странице.</p>
                </div>
              )}
            </div>

            <Button className="w-full" onClick={saveLinks}>
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSetPasswordDialog} onOpenChange={setShowSetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Доступ к порталу ученика
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedStudent && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span className="font-medium">{selectedStudent.name}</span>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1.5">
              <div className="text-sm font-medium">Как это работает</div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>Укажите логин ученика и пароль</li>
                <li>Можно использовать email или придуманный логин</li>
                <li>Или сгенерировать данные автоматически кнопкой ниже</li>
                <li>После сохранения ученик сможет войти в личный кабинет на странице входа, выбрав вкладку «Ученик»</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Логин для входа <span className="text-destructive">*</span></Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 text-primary"
                  onClick={() => {
                    setPortalEmail(generateLogin(selectedStudent?.name || "student"));
                    setPortalPassword(generatePassword());
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  Сгенерировать
                </Button>
              </div>
              <Input
                type="text"
                value={portalEmail}
                onChange={(e) => setPortalEmail(e.target.value)}
                placeholder="логин или email"
              />
            </div>
            <div>
              <Label>Пароль * (минимум 6 символов)</Label>
              <Input
                type="text"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                placeholder="Придумайте пароль"
                className="mt-1"
              />
            </div>
            <Button className="w-full gap-2" onClick={handleSetPassword} disabled={isSettingPassword}>
              {isSettingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Сохранить доступ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCredentialsSuccess} onOpenChange={setShowCredentialsSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              Доступ настроен!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Теперь ученик может войти в личный кабинет с этими данными:
            </p>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2 font-mono text-sm">
              <div><span className="text-muted-foreground">Сайт:</span> {window.location.origin}/login</div>
              <div><span className="text-muted-foreground">Email:</span> {savedCredentials.email}</div>
              <div><span className="text-muted-foreground">Пароль:</span> {savedCredentials.password}</div>
            </div>
            <Button className="w-full gap-2" onClick={copyCredentials}>
              <Copy className="h-4 w-4" />
              Скопировать и отправить ученику
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showQuestionnaireDialog} onOpenChange={setShowQuestionnaireDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Составить программу с ИИ
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedStudent && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <span className="font-medium">{selectedStudent.name}</span>
                  <span className="text-muted-foreground">• {selectedStudent.subject} • {selectedStudent.goal}</span>
                </div>
              </div>
            )}
            
            <div>
              <Label>Текущий уровень знаний *</Label>
              <Textarea
                value={questionnaire.currentLevel}
                onChange={(e) => setQuestionnaire({ ...questionnaire, currentLevel: e.target.value })}
                placeholder="Опишите, что ученик уже знает..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label>Слабые стороны, пробелы *</Label>
              <Textarea
                value={questionnaire.weakPoints}
                onChange={(e) => setQuestionnaire({ ...questionnaire, weakPoints: e.target.value })}
                placeholder="Какие темы вызывают затруднения..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label>Сильные стороны</Label>
              <Textarea
                value={questionnaire.strongPoints}
                onChange={(e) => setQuestionnaire({ ...questionnaire, strongPoints: e.target.value })}
                placeholder="В чём ученик хорош..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label>Дата экзамена</Label>
              <Select
                value={questionnaire.examDate}
                onValueChange={(v) => setQuestionnaire({ ...questionnaire, examDate: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите дату экзамена" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026-06-01">1 июня — История, Литература, Химия</SelectItem>
                  <SelectItem value="2026-06-04">4 июня — Русский язык</SelectItem>
                  <SelectItem value="2026-06-08">8 июня — Математика (база и профиль)</SelectItem>
                  <SelectItem value="2026-06-11">11 июня — Обществознание, Физика</SelectItem>
                  <SelectItem value="2026-06-15">15 июня — Биология, География, Иностр. языки (письм.)</SelectItem>
                  <SelectItem value="2026-06-18">18 июня — Иностр. языки (устная часть)</SelectItem>
                  <SelectItem value="2026-06-19">19 июня — Информатика</SelectItem>
                  <SelectItem value="2026-05-20">ОГЭ — конец мая 2026</SelectItem>
                  <SelectItem value="custom">Другая дата...</SelectItem>
                </SelectContent>
              </Select>
              {questionnaire.examDate === "custom" && (
                <Input
                  type="date"
                  value=""
                  onChange={(e) => setQuestionnaire({ ...questionnaire, examDate: e.target.value })}
                  className="mt-2"
                />
              )}
            </div>
            <div>
              <Label>Часов в неделю</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={questionnaire.hoursPerWeek}
                onChange={(e) => setQuestionnaire({ ...questionnaire, hoursPerWeek: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Дополнительная информация</Label>
              <Textarea
                value={questionnaire.additionalInfo}
                onChange={(e) => setQuestionnaire({ ...questionnaire, additionalInfo: e.target.value })}
                placeholder="Любая важная информация..."
                className="mt-1"
                rows={2}
              />
            </div>
            
            <Button className="w-full" onClick={handleGenerateProgramForStudent} disabled={generateProgram.isPending}>
              {generateProgram.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Генерирую программу...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Сгенерировать программу</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showProgramDialog} onOpenChange={(open) => { setShowProgramDialog(open); if (!open) setEditingProgram(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Программа подготовки {selectedStudent ? `— ${selectedStudent.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          
          {editingProgram && (
            <div className="space-y-4 py-2">
              {editingProgram.topics.length === 0 && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Info className="h-4 w-4" />
                    <span className="text-sm font-medium">Как составить программу</span>
                  </div>
                  <ol className="text-sm text-blue-600 space-y-1 ml-6 list-decimal">
                    <li>Впишите темы в таблицу ниже в порядке изучения</li>
                    <li>Для каждой темы укажите описание и сколько занятий потребуется</li>
                    <li>Приоритет поможет выделить важные темы</li>
                    <li>Стрелками можно менять порядок тем</li>
                    <li>Отмечайте пройденные темы галочкой</li>
                  </ol>
                </div>
              )}

              {editingProgram.recommendation && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                  <div className="text-sm font-medium mb-1">Рекомендация ИИ</div>
                  <p className="text-sm text-muted-foreground">{editingProgram.recommendation}</p>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">Тем: <strong>{editingProgram.topics.length}</strong></span>
                  <span className="text-muted-foreground">Занятий: <strong>{editingProgram.totalLessons}</strong></span>
                  {editingProgram.estimatedWeeks > 0 && (
                    <span className="text-muted-foreground">~<strong>{editingProgram.estimatedWeeks}</strong> нед.</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {editingProgram.topics.filter(t => t.completed).length} / {editingProgram.topics.length} пройдено
                </span>
              </div>

              {editingProgram.topics.length > 0 && (
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <div className="grid grid-cols-[32px_32px_1fr_100px_70px_36px] gap-0 bg-muted/50 px-2 py-2 text-xs font-medium text-muted-foreground border-b">
                    <span></span>
                    <span className="text-center">#</span>
                    <span className="pl-2">Тема</span>
                    <span className="text-center">Приоритет</span>
                    <span className="text-center">Занятий</span>
                    <span></span>
                  </div>
                  {editingProgram.topics.map((topic, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "grid grid-cols-[32px_32px_1fr_100px_70px_36px] gap-0 px-2 py-2 items-center border-b last:border-b-0 transition-colors",
                        topic.completed ? "bg-emerald-50/50" : "hover:bg-muted/30"
                      )}
                    >
                      <button
                        onClick={() => toggleTopicCompleted(idx)}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all mx-auto",
                          topic.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30 hover:border-primary"
                        )}
                      >
                        {topic.completed && <CheckCircle2 className="h-3 w-3" />}
                      </button>
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => moveTopicUp(idx)}
                          disabled={idx === 0}
                          className="p-0 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] text-muted-foreground leading-none">{idx + 1}</span>
                        <button
                          onClick={() => moveTopicDown(idx)}
                          disabled={idx === editingProgram.topics.length - 1}
                          className="p-0 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="pl-2 min-w-0">
                        <Input
                          value={topic.title}
                          onChange={(e) => updateTopicField(idx, "title", e.target.value)}
                          className={cn("h-7 text-sm border-0 bg-transparent shadow-none px-1 font-medium", topic.completed && "line-through text-muted-foreground")}
                          placeholder="Название темы"
                        />
                        <Input
                          value={topic.description}
                          onChange={(e) => updateTopicField(idx, "description", e.target.value)}
                          className="h-6 text-xs border-0 bg-transparent shadow-none px-1 text-muted-foreground"
                          placeholder="Описание (необязательно)"
                        />
                      </div>
                      <Select value={topic.priority} onValueChange={(v: any) => updateTopicField(idx, "priority", v)}>
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">Важно</SelectItem>
                          <SelectItem value="medium">Средне</SelectItem>
                          <SelectItem value="low">Низкий</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={topic.lessonsNeeded}
                        onChange={(e) => updateTopicField(idx, "lessonsNeeded", Math.max(1, Number(e.target.value)))}
                        className="h-7 text-xs text-center border-0 bg-transparent shadow-none"
                      />
                      <button
                        onClick={() => removeTopic(idx)}
                        className="text-muted-foreground hover:text-red-500 transition-colors mx-auto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-dashed"
                onClick={() => {
                  const newTopics = [...editingProgram.topics, { title: "", description: "", lessonsNeeded: 1, priority: "medium" as const, completed: false }];
                  setEditingProgram({
                    ...editingProgram,
                    topics: newTopics,
                    totalLessons: newTopics.reduce((sum, t) => sum + t.lessonsNeeded, 0),
                  });
                }}
              >
                <Plus className="h-4 w-4" />
                Добавить тему
              </Button>

              <div className="flex gap-2 pt-2">
                {selectedStudent?.hasProgram && (
                  <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={handleDeleteProgram}>
                    <Trash2 className="h-4 w-4 mr-1" /> Удалить
                  </Button>
                )}
                <Button className="flex-1" onClick={handleSaveProgram} disabled={updateProgram.isPending || editingProgram.topics.every(t => !t.title.trim())}>
                  {updateProgram.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Сохранить программу
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={showBulkAddDialog} onOpenChange={(open) => { setShowBulkAddDialog(open); if (!open) { setBulkFormTouched(false); setBulkStudents([emptyBulkRow()]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Добавить учеников
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Заполните карточки — обязательны имя и предмет. Можно добавить несколько занятий в неделю.
          </p>

          <div className="space-y-4">
            {bulkStudents.map((s, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card/80 p-4 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium">{s.name || "Новый ученик"}</span>
                  </div>
                  <button
                    onClick={() => removeBulkRow(i)}
                    className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                    disabled={bulkStudents.length <= 1}
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Имя <span className="text-destructive">*</span></Label>
                    <Input
                      value={s.name}
                      onChange={(e) => updateBulkStudent(i, "name", e.target.value)}
                      placeholder="Иван Иванов"
                      className={cn("h-8 text-sm mt-1", bulkFormTouched && bulkFormErrors[i]?.name && "border-destructive ring-1 ring-destructive/30")}
                      data-testid={`bulk-name-${i}`}
                    />
                    {bulkFormTouched && bulkFormErrors[i]?.name && <p className="text-[10px] text-destructive mt-0.5">{bulkFormErrors[i].name}</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Предмет <span className="text-destructive">*</span></Label>
                    <Select value={s.subject} onValueChange={(v) => {
                      updateBulkStudent(i, "subject", v);
                      if (v === "Математика" && s.goal === "ЕГЭ") updateBulkStudent(i, "goal", "ЕГЭ (профиль)");
                      if (v !== "Математика" && (s.goal === "ЕГЭ (профиль)" || s.goal === "ЕГЭ (база)")) updateBulkStudent(i, "goal", "ЕГЭ");
                    }}>
                      <SelectTrigger className={cn("h-8 text-sm mt-1", bulkFormTouched && bulkFormErrors[i]?.subject && "border-destructive ring-1 ring-destructive/30")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_SUBJECTS.map(subj => (
                          <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Класс</Label>
                    <Select value={s.grade} onValueChange={(v) => updateBulkStudent(i, "grade", v)}>
                      <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 11 }, (_, i) => i + 1).map(g => (
                          <SelectItem key={g} value={`${g} класс`}>{g} класс</SelectItem>
                        ))}
                        <SelectItem value="Студент">Студент</SelectItem>
                        <SelectItem value="Взрослый">Взрослый</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Цель</Label>
                    <Select value={s.goal} onValueChange={(v) => updateBulkStudent(i, "goal", v)}>
                      <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(s.subject === "Математика" ? MATH_GOALS : NON_MATH_GOALS).map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Цена ₽</Label>
                    <Input
                      type="number"
                      value={s.price}
                      onChange={(e) => updateBulkStudent(i, "price", parseInt(e.target.value) || 0)}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Логин</Label>
                    <div className="flex gap-1 mt-1">
                      <Input
                        value={s.email}
                        onChange={(e) => updateBulkStudent(i, "email", e.target.value)}
                        placeholder="логин"
                        className="h-8 text-sm flex-1"
                      />
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => { if (s.name.trim()) updateBulkStudent(i, "email", generateLogin(s.name)); }} disabled={!s.name.trim()}>
                        <Sparkles className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Соцсеть</Label>
                    <Input
                      value={s.socialLink}
                      onChange={(e) => updateBulkStudent(i, "socialLink", e.target.value)}
                      placeholder="t.me/..."
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Повторение</Label>
                    <Select value={s.recurringMode} onValueChange={(v) => updateBulkStudent(i, "recurringMode", v)}>
                      <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Разовое</SelectItem>
                        <SelectItem value="4weeks">4 недели</SelectItem>
                        <SelectItem value="ongoing">Постоянно</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Конференция</Label>
                    <Input
                      value={s.conferenceLink}
                      onChange={(e) => updateBulkStudent(i, "conferenceLink", e.target.value)}
                      placeholder="zoom.us/j/..."
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Доска</Label>
                    <Input
                      value={s.boardLink}
                      onChange={(e) => updateBulkStudent(i, "boardLink", e.target.value)}
                      placeholder="miro.com/..."
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`bulk-program-${i}`}
                        checked={s.generateProgram}
                        onCheckedChange={(checked) => updateBulkStudent(i, "generateProgram", !!checked)}
                      />
                      <Label htmlFor={`bulk-program-${i}`} className="text-xs cursor-pointer flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        ИИ-план занятий
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Ссылка на родителя</Label>
                    <Input
                      value={s.parentLink}
                      onChange={(e) => updateBulkStudent(i, "parentLink", e.target.value)}
                      placeholder="t.me/parent..."
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Реквизиты оплаты</Label>
                    <Input
                      value={s.paymentInfo}
                      onChange={(e) => updateBulkStudent(i, "paymentInfo", e.target.value)}
                      placeholder="Сбер, Иванова М.П."
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Комментарий</Label>
                    <Input
                      value={s.comment}
                      onChange={(e) => updateBulkStudent(i, "comment", e.target.value)}
                      placeholder="Заметки..."
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/30 bg-background/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Расписание занятий
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() => addBulkScheduleSlot(i)}
                    >
                      <Plus className="h-3 w-3" />
                      Ещё день
                    </Button>
                  </div>
                  {s.schedules.map((slot, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <Select value={slot.day || "_none"} onValueChange={(v) => updateBulkSchedule(i, j, "day", v === "_none" ? "" : v)}>
                        <SelectTrigger className="h-8 text-sm w-[80px]"><SelectValue placeholder="День" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">—</SelectItem>
                          {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={slot.hour.split(":")[0]} onValueChange={(v) => updateBulkSchedule(i, j, "hour", `${v}:${slot.hour.split(":")[1] || "00"}`)}>
                        <SelectTrigger className="h-8 text-sm w-[65px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOUR_OPTIONS.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">:</span>
                      <Select value={slot.hour.split(":")[1] || "00"} onValueChange={(v) => updateBulkSchedule(i, j, "hour", `${slot.hour.split(":")[0]}:${v}`)}>
                        <SelectTrigger className="h-8 text-sm w-[60px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MINUTE_OPTIONS.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={String(slot.duration)} onValueChange={(v) => updateBulkSchedule(i, j, "duration", parseInt(v))}>
                        <SelectTrigger className="h-8 text-sm w-[80px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="45">45 мин</SelectItem>
                          <SelectItem value="60">60 мин</SelectItem>
                          <SelectItem value="90">90 мин</SelectItem>
                          <SelectItem value="120">120 мин</SelectItem>
                        </SelectContent>
                      </Select>
                      {s.schedules.length > 1 && (
                        <button
                          onClick={() => removeBulkScheduleSlot(i, j)}
                          className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {s.schedules.every(sl => !sl.day) && (
                    <p className="text-[11px] text-muted-foreground">
                      Выберите день — занятия создадутся автоматически.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={addBulkRow} data-testid="btn-add-bulk-row">
              <Plus className="h-3 w-3" />
              Ещё ученик
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Заполнено: {bulkStudents.filter(s => s.name.trim()).length} из {bulkStudents.length}
              </span>
              <Button onClick={() => { setBulkFormTouched(true); if (bulkFormValid) handleBulkAdd(); }} disabled={isBulkAdding || (bulkFormTouched && !bulkFormValid)} className="gap-2" data-testid="btn-submit-bulk">
                {isBulkAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isBulkAdding ? "Добавляю..." : "Добавить всех"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
        <DialogContent className="max-w-md h-[70vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-4 w-4 text-primary" />
              Чат с {selectedStudent?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {(chatMessages as any[]).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Нет сообщений. Напишите первым!</p>
            )}
            {(chatMessages as any[]).map((msg: any) => (
              <div key={msg.id} className={cn("flex", msg.role === "tutor" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-xl px-3 py-2 text-sm", msg.role === "tutor" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm")}>
                  <div>{msg.content}</div>
                  <div className="text-[10px] opacity-60 mt-0.5 text-right">
                    {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t flex gap-2">
            <Textarea
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (chatMessage.trim()) { sendDirectMessage.mutate({ content: chatMessage.trim() }); setChatMessage(""); } } }}
              placeholder="Написать ученику..."
              rows={2}
              className="resize-none text-sm"
              data-testid="input-tutor-chat-message"
            />
            <Button size="sm" className="self-end" disabled={!chatMessage.trim() || sendDirectMessage.isPending} data-testid="button-tutor-send-message"
              onClick={() => { if (chatMessage.trim()) { sendDirectMessage.mutate({ content: chatMessage.trim() }); setChatMessage(""); } }}>
              {sendDirectMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Parent Report Dialog */}
      <Dialog open={showParentReportDialog} onOpenChange={setShowParentReportDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBarChart2 className="h-4 w-4 text-primary" />
              Отчёт для родителя — {parentReportData?.student?.name}
            </DialogTitle>
          </DialogHeader>
          {parentReportData && (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-1">
                <div><span className="font-medium">Предмет:</span> {parentReportData.student.subject}</div>
                <div><span className="font-medium">Цель:</span> {parentReportData.student.goal}</div>
                {parentReportData.student.grade && <div><span className="font-medium">Класс:</span> {parentReportData.student.grade}</div>}
                {parentReportData.student.curriculumTopic && <div><span className="font-medium">Текущая тема:</span> {parentReportData.student.curriculumTopic}</div>}
                {parentReportData.student.progress !== undefined && parentReportData.student.progress !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Прогресс</span><span>{parentReportData.student.progress}%</span></div>
                    <Progress value={parentReportData.student.progress} className="h-1.5" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-blue-50/80 border border-blue-200/60 p-3 text-center dark:bg-blue-950/30">
                  <div className="text-2xl font-bold text-blue-600">{parentReportData.stats.totalLessons}</div>
                  <div className="text-xs text-muted-foreground">Занятий проведено</div>
                </div>
                <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/60 p-3 text-center dark:bg-emerald-950/30">
                  <div className="text-2xl font-bold text-emerald-600">{parentReportData.stats.completedHomework} / {parentReportData.stats.totalHomework}</div>
                  <div className="text-xs text-muted-foreground">Домашек сдано</div>
                </div>
                {parentReportData.stats.avgScore !== null && (
                  <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-3 text-center dark:bg-amber-950/30">
                    <div className="text-2xl font-bold text-amber-600">{parentReportData.stats.avgScore}</div>
                    <div className="text-xs text-muted-foreground">Средний балл за ДЗ</div>
                  </div>
                )}
                {parentReportData.stats.avgRating !== null && (
                  <div className="rounded-xl bg-purple-50/80 border border-purple-200/60 p-3 text-center dark:bg-purple-950/30">
                    <div className="text-2xl font-bold text-purple-600">{parentReportData.stats.avgRating} ⭐</div>
                    <div className="text-xs text-muted-foreground">Средняя оценка за урок</div>
                  </div>
                )}
              </div>
              {parentReportData.recentLessons.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Последние занятия</div>
                  <div className="space-y-1.5">
                    {parentReportData.recentLessons.map((l: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                        <div>
                          <span className="text-xs font-medium">{new Date(l.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                          {l.topic && <span className="text-xs text-muted-foreground ml-2">{l.topic}</span>}
                        </div>
                        {l.rating && <span className="text-xs text-amber-600">{"★".repeat(l.rating)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {parentReportData.recentHomework.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Последние домашки</div>
                  <div className="space-y-1.5">
                    {parentReportData.recentHomework.map((h: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                        <span className="text-xs font-medium">{h.title}</span>
                        <div className="flex items-center gap-2">
                          {h.score !== null && h.score !== undefined && <span className="text-xs font-medium text-emerald-600">{h.score} баллов</span>}
                          <span className="text-xs text-muted-foreground">{h.status === "reviewed" ? "Проверено" : h.status === "submitted" ? "На проверке" : "Выдано"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground text-right">
                Отчёт сформирован: {new Date(parentReportData.generatedAt).toLocaleDateString("ru-RU")}
              </div>
              <Button className="w-full gap-2" variant="outline" onClick={() => window.print()}>
                <FileText className="h-4 w-4" />
                Распечатать отчёт
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <StudentsImportDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
    </DashboardLayout>
  );
}
