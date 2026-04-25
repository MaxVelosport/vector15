import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, GraduationCap, BookOpen, Clock, Users, Upload, Plus, Check, Rocket, Loader2 } from "lucide-react";
import { useStudents, useCreateStudent } from "@/hooks/use-tutor-data";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { StudentsImportDialog } from "@/components/students-import-dialog";

const STORAGE_KEY = "onboarding_wizard_v1";

const POPULAR_SUBJECTS = ["Математика", "Русский язык", "Английский язык", "Физика", "Химия", "Биология", "Информатика", "История", "Обществознание", "Литература"];

type Tutor = {
  id: string;
  name: string;
  subjects: string[];
  basePrice: number;
  scheduleStart: number;
  scheduleEnd: number;
};

export function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [showImport, setShowImport] = useState(false);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [basePrice, setBasePrice] = useState(1500);
  const [scheduleStart, setScheduleStart] = useState(9);
  const [scheduleEnd, setScheduleEnd] = useState(21);

  const [firstStudent, setFirstStudent] = useState({ name: "", subject: "", grade: "10 класс", goal: "ЕГЭ", price: 1500 });
  const [saving, setSaving] = useState(false);

  const { data: students = [], isLoading: studentsLoading, isError: studentsError } = useStudents();
  const { data: tutor, isLoading: tutorLoading, isError: tutorError } = useQuery<Tutor>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("not authed");
      return res.json();
    },
    retry: false,
  });
  const createStudent = useCreateStudent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateProfile = useMutation({
    mutationFn: async (data: Partial<Tutor>) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Не удалось сохранить профиль");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  // Авто-открытие: только когда обе query-загрузки полностью завершены успешно,
  // у репетитора пустой список предметов и нет ни одного ученика.
  useEffect(() => {
    if (tutorLoading || studentsLoading) return;
    if (tutorError || studentsError) return;
    if (!tutor) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (students.length > 0) return;
    if ((tutor.subjects?.length ?? 0) > 0) return;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [tutor, tutorLoading, tutorError, students.length, studentsLoading, studentsError]);

  // Подставляем дефолтный предмет в первого ученика, как только он выбран
  useEffect(() => {
    if (subjects.length > 0 && !firstStudent.subject) {
      setFirstStudent(s => ({ ...s, subject: subjects[0], price: basePrice }));
    }
  }, [subjects, basePrice, firstStudent.subject]);

  const finish = (markDone = true) => {
    if (markDone) localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
    setStep(0);
  };

  const toggleSubject = (s: string) => {
    setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };
  const addCustomSubject = () => {
    const v = customSubject.trim();
    if (v && !subjects.includes(v)) setSubjects(prev => [...prev, v]);
    setCustomSubject("");
  };

  const saveProfileAndAdvance = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({ subjects, basePrice, scheduleStart, scheduleEnd });
      setStep(s => s + 1);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createFirstStudent = async () => {
    if (!firstStudent.name.trim()) {
      toast({ title: "Введите имя ученика", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await createStudent.mutateAsync({
        name: firstStudent.name.trim(),
        subject: firstStudent.subject || subjects[0] || "Математика",
        goal: firstStudent.goal,
        grade: firstStudent.grade,
        pricePerLesson: firstStudent.price,
      } as any);
      toast({ title: "Ученик добавлен!", description: "Теперь можно запланировать первый урок." });
      setStep(3);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) finish(false); else setOpen(v); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-0 shadow-2xl" data-testid="dialog-onboarding-wizard">
          <div className="bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 px-8 py-6 text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium opacity-80 mb-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Шаг {step + 1} из {totalSteps}
                </div>
                <h2 className="text-2xl font-bold">
                  {step === 0 && "Добро пожаловать в Твой Вектор!"}
                  {step === 1 && "Расскажите о себе"}
                  {step === 2 && "Когда вы преподаёте?"}
                  {step === 3 && "Добавьте первого ученика"}
                </h2>
              </div>
              <button onClick={() => finish(false)} className="text-white/70 hover:text-white text-xs underline" data-testid="button-skip-wizard">
                Пропустить
              </button>
            </div>
            <Progress value={progress} className="mt-4 h-1.5 bg-white/20" />
          </div>

          <div className="p-8 min-h-[340px]">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <p className="text-muted-foreground">
                    Привет{tutor?.name ? `, ${tutor.name.split(" ")[0]}` : ""}! Давайте за 2 минуты настроим ваш кабинет, чтобы вы могли начать работу с учениками.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: BookOpen, title: "Ваши предметы", desc: "Что вы преподаёте" },
                      { icon: GraduationCap, title: "Базовая ставка", desc: "Цена за урок" },
                      { icon: Clock, title: "Рабочие часы", desc: "Когда вы доступны" },
                      { icon: Users, title: "Первый ученик", desc: "Начните работу" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl border bg-card">
                        <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="text-sm">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div className="space-y-2">
                    <Label>Какие предметы вы преподаёте? (можно несколько)</Label>
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_SUBJECTS.map(s => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={subjects.includes(s)}
                          onClick={() => toggleSubject(s)}
                          className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid={`badge-subject-${s}`}
                        >
                          <Badge
                            variant={subjects.includes(s) ? "default" : "outline"}
                            className="cursor-pointer hover:scale-105 transition-transform px-3 py-1.5"
                          >
                            {subjects.includes(s) && <Check className="h-3 w-3 mr-1" />}
                            {s}
                          </Badge>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Свой предмет..."
                        value={customSubject}
                        onChange={e => setCustomSubject(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomSubject(); } }}
                        className="h-9"
                        data-testid="input-custom-subject"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={addCustomSubject}>Добавить</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Базовая ставка за урок (₽)</Label>
                    <Input
                      type="number"
                      value={basePrice}
                      onChange={e => setBasePrice(parseInt(e.target.value) || 0)}
                      className="h-10 text-lg font-medium"
                      data-testid="input-base-price"
                    />
                    <p className="text-xs text-muted-foreground">Эту цену можно будет переопределить для каждого ученика отдельно.</p>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <p className="text-muted-foreground text-sm">
                    Эти часы будут отображаться в расписании. Уроки можно ставить и за их пределами.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Начало рабочего дня</Label>
                      <select
                        value={scheduleStart}
                        onChange={e => setScheduleStart(parseInt(e.target.value))}
                        className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                        data-testid="select-schedule-start"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Конец рабочего дня</Label>
                      <select
                        value={scheduleEnd}
                        onChange={e => setScheduleEnd(parseInt(e.target.value))}
                        className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                        data-testid="select-schedule-end"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 p-4 text-sm">
                    <Clock className="h-4 w-4 text-violet-600 inline mr-2" />
                    Вы преподаёте с <b>{scheduleStart.toString().padStart(2, "0")}:00</b> до <b>{scheduleEnd.toString().padStart(2, "0")}:00</b>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowImport(true)}
                      className="p-5 rounded-xl border-2 border-dashed hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left group"
                      data-testid="button-wizard-import"
                    >
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 w-fit mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div className="font-medium">Импорт из Excel/CSV</div>
                      <div className="text-xs text-muted-foreground mt-1">Загрузите файл со списком учеников — за пару секунд</div>
                    </button>
                    <div className="p-5 rounded-xl border bg-card space-y-3">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-violet-600" />
                        <span className="font-medium text-sm">Добавить вручную</span>
                      </div>
                      <Input placeholder="Имя ученика" value={firstStudent.name} onChange={e => setFirstStudent(s => ({ ...s, name: e.target.value }))} className="h-9 text-sm" data-testid="input-wizard-student-name" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Класс" value={firstStudent.grade} onChange={e => setFirstStudent(s => ({ ...s, grade: e.target.value }))} className="h-9 text-sm" />
                        <Input type="number" placeholder="Цена" value={firstStudent.price} onChange={e => setFirstStudent(s => ({ ...s, price: parseInt(e.target.value) || 0 }))} className="h-9 text-sm" />
                      </div>
                      <Button onClick={createFirstStudent} disabled={saving || !firstStudent.name.trim()} size="sm" className="w-full" data-testid="button-wizard-create-student">
                        {saving ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-2" />}
                        Добавить
                      </Button>
                    </div>
                  </div>
                  <div className="text-center">
                    <button onClick={() => finish(true)} className="text-xs text-muted-foreground hover:text-foreground underline" data-testid="button-wizard-later">
                      Сделать это позже
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="border-t bg-muted/30 px-8 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
              data-testid="button-wizard-back"
            >
              Назад
            </Button>
            {step === 0 && (
              <Button onClick={() => setStep(1)} className="bg-violet-600 hover:bg-violet-700" data-testid="button-wizard-start">
                <Rocket className="h-4 w-4 mr-2" />
                Начать настройку
              </Button>
            )}
            {step === 1 && (
              <Button onClick={saveProfileAndAdvance} disabled={subjects.length === 0 || basePrice <= 0 || saving} data-testid="button-wizard-next-1">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Далее
              </Button>
            )}
            {step === 2 && (
              <Button onClick={saveProfileAndAdvance} disabled={scheduleStart >= scheduleEnd || saving} data-testid="button-wizard-next-2">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Далее
              </Button>
            )}
            {step === 3 && (
              <Button onClick={() => finish(true)} variant="outline" data-testid="button-wizard-finish">
                <Check className="h-4 w-4 mr-2" />
                Завершить
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StudentsImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={() => { setShowImport(false); finish(true); }}
      />
    </>
  );
}
