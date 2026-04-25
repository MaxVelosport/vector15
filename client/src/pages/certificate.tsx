import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Award, BookOpen, GraduationCap, Star, Sparkles, Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";

type ReportData = {
  student: { name: string; subject: string; goal: string; grade: string; progress: number; curriculumTopic: string };
  stats: { totalLessons: number; totalHomework: number; completedHomework: number; avgScore: number | null; avgRating: string | null };
  recentLessons: Array<{ date: string; topic: string; rating?: number; notes?: string }>;
  recentHomework: Array<{ title: string; status: string; score?: number; deadline: string }>;
  generatedAt: string;
};

type TutorData = { name?: string; email?: string };

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

const numWord = (n: number, forms: [string, string, string]) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
};

export default function CertificatePage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  useDocumentTitle("Сертификат прогресса");

  const { data, isLoading, isError } = useQuery<ReportData>({
    queryKey: ["/api/students", studentId, "parent-report"],
    enabled: !!studentId,
  });

  const { data: tutor } = useQuery<TutorData>({ queryKey: ["/api/auth/me"] });

  // Auto-cleanup: дать чуть-чуть времени на отрисовку и убрать тёмный фон, если включён
  useEffect(() => {
    document.documentElement.classList.add("certificate-print");
    return () => document.documentElement.classList.remove("certificate-print");
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Загружаем данные…</div>;
  }
  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Не удалось загрузить сертификат</p>
        <Button onClick={() => window.history.back()} variant="outline" data-testid="button-cert-back">
          <ArrowLeft className="h-4 w-4 mr-2" /> Назад
        </Button>
      </div>
    );
  }

  const { student, stats, recentLessons } = data;
  const lessonsLabel = numWord(stats.totalLessons, ["урок", "урока", "уроков"]);
  const issueDate = formatDate(data.generatedAt);
  const tutorName = tutor?.name || "Репетитор";

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Toolbar — скрыта при печати */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b print:hidden">
        <div className="mx-auto max-w-4xl px-6 py-3 flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} data-testid="button-cert-back">
            <ArrowLeft className="h-4 w-4 mr-2" /> Закрыть
          </Button>
          <div className="text-sm text-muted-foreground">
            Чтобы сохранить как PDF — нажмите «Печать» и выберите «Сохранить как PDF»
          </div>
          <Button size="sm" onClick={() => window.print()} data-testid="button-cert-print">
            <Printer className="h-4 w-4 mr-2" /> Печать / PDF
          </Button>
        </div>
      </div>

      {/* Сертификат A4 */}
      <div className="mx-auto max-w-[210mm] my-8 print:my-0 bg-white shadow-2xl print:shadow-none">
        <div className="relative aspect-[210/297] p-12 overflow-hidden">
          {/* Декор */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-200/60 to-cyan-200/40 blur-3xl" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-amber-200/50 to-pink-200/40 blur-3xl" />
            <div className="absolute inset-0 border-[3px] border-double border-slate-300/80 m-4 rounded-sm" />
          </div>

          <div className="relative h-full flex flex-col">
            {/* Шапка */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-slate-500 font-semibold">Твой Вектор</div>
                <div className="text-[10px] text-slate-400 mt-1">CRM для репетиторов</div>
              </div>
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
                <Award className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* Заголовок */}
            <div className="mt-10 text-center">
              <div className="text-sm uppercase tracking-[0.4em] text-amber-600 font-semibold">Сертификат</div>
              <h1 className="mt-2 text-4xl font-serif font-bold text-slate-800">Сертификат успеваемости</h1>
              <div className="mt-3 mx-auto w-24 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
            </div>

            <p className="mt-10 text-center text-base text-slate-600">
              Настоящим подтверждается, что
            </p>
            <h2 className="mt-3 text-center text-3xl font-serif font-semibold text-slate-900" data-testid="text-cert-name">
              {student.name}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500">
              {student.grade} · {student.subject} · цель: {student.goal}
            </p>

            <p className="mt-6 text-center text-base text-slate-700 max-w-2xl mx-auto leading-relaxed">
              успешно прошёл(а) обучение под руководством репетитора <strong>{tutorName}</strong>
              {stats.totalLessons > 0 && <> и завершил(а) <strong data-testid="text-cert-lessons">{stats.totalLessons}</strong> {lessonsLabel}</>}.
            </p>

            {/* Статистика */}
            <div className="mt-8 grid grid-cols-3 gap-6 px-6">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900" data-testid="text-cert-stat-lessons">{stats.totalLessons}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">проведено уроков</div>
              </div>
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900" data-testid="text-cert-stat-hw">
                  {stats.completedHomework}<span className="text-slate-400 text-base">/{stats.totalHomework}</span>
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">домашних работ</div>
              </div>
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Star className="h-6 w-6 text-amber-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900" data-testid="text-cert-stat-score">
                  {stats.avgScore != null ? `${stats.avgScore}/5` : "—"}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">средний балл</div>
              </div>
            </div>

            {/* Программа */}
            {student.curriculumTopic && (
              <div className="mt-8 mx-6 rounded-lg border border-slate-200 bg-slate-50/80 px-5 py-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  <Sparkles className="h-3.5 w-3.5" /> Текущая тема программы
                </div>
                <div className="mt-1 text-sm text-slate-800">{student.curriculumTopic}</div>
                {student.progress > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                        style={{ width: `${Math.min(100, student.progress)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 text-right">прогресс по программе: {student.progress}%</div>
                  </div>
                )}
              </div>
            )}

            {/* Подвал */}
            <div className="mt-auto pt-10 flex items-end justify-between">
              <div>
                <div className="text-xs text-slate-500">Дата выдачи</div>
                <div className="text-sm font-medium text-slate-800" data-testid="text-cert-date">{issueDate}</div>
              </div>
              <div className="text-right">
                <div className="border-b border-slate-400 w-48 mb-1 h-8 flex items-end justify-center pb-1 font-serif italic text-slate-700">
                  {tutorName}
                </div>
                <div className="text-xs text-slate-500">Репетитор</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Печать: убрать всё лишнее */}
      <style>{`
        @media print {
          body { background: white !important; }
          .certificate-print, .certificate-print body { background: white !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}
