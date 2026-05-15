import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sparkles, Plus, Trash2, Eye, Users, Loader2, BarChart3, BookOpen } from "lucide-react";
import type { Quiz, QuizAttempt, Student } from "@shared/schema";

import { useDocumentTitle } from "@/hooks/use-document-title";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageTabs } from "@/components/page-tabs";
type QQ = { q: string; options: string[]; correct: number; explanation?: string };

export default function QuizzesPage() {
  useDocumentTitle("Тренажёры");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewQuiz, setViewQuiz] = useState<Quiz | null>(null);

  const { data: quizzes = [], isLoading } = useQuery<Quiz[]>({ queryKey: ["/api/quizzes"] });
  const { data: students = [] } = useQuery<Student[]>({ queryKey: ["/api/students"] });
  const { data: recentAttempts = [] } = useQuery<QuizAttempt[]>({ queryKey: ["/api/quizzes-attempts/recent"] });

  const studentName = (id?: string | null) => students.find(s => s.id === id)?.name || "—";

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/quizzes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      toast.success("Удалено");
    },
  });

  return (
    <DashboardLayout title="Тренажёры" subtitle="Карточки и тесты для учеников">
      <PageTabs
        tabs={[
          { label: "Задания", path: "/homework" },
          { label: "Тренажёры", path: "/quizzes" },
        ]}
      />
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" /> Тренажёры</h1>
          <p className="text-sm text-muted-foreground mt-1">Карточки и тесты для учеников. Можно создать вручную или сгенерировать ИИ.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-quiz" className="gap-2">
          <Plus className="h-4 w-4" /> Новый тренажёр
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" data-testid="tab-quiz-list">Тренажёры ({quizzes.length})</TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-quiz-results">Результаты ({recentAttempts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
          ) : quizzes.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Пока нет тренажёров. Нажмите «Новый тренажёр», чтобы создать первый.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quizzes.map(q => (
                <Card key={q.id} data-testid={`card-quiz-${q.id}`} className="hover-elevate">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{q.topic}</CardTitle>
                      <Badge variant={q.status === 'active' ? 'default' : 'secondary'}>{q.status}</Badge>
                    </div>
                    {q.description && <p className="text-xs text-muted-foreground mt-1">{q.description}</p>}
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>{Array.isArray(q.questions) ? (q.questions as any[]).length : 0} вопр.</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{q.studentId ? studentName(q.studentId) : 'Все ученики'}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setViewQuiz(q)} data-testid={`button-view-quiz-${q.id}`} className="gap-1.5">
                        <Eye className="h-3.5 w-3.5" /> Посмотреть
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(q.id)} data-testid={`button-delete-quiz-${q.id}`} className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {recentAttempts.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">Пока нет завершённых попыток</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground">
                    <tr><th className="p-3">Когда</th><th className="p-3">Ученик</th><th className="p-3">Тема</th><th className="p-3">Результат</th><th className="p-3">Источник</th></tr>
                  </thead>
                  <tbody>
                    {recentAttempts.map(a => {
                      const quiz = quizzes.find(q => q.id === a.quizId);
                      const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
                      return (
                        <tr key={a.id} className="border-b hover-elevate" data-testid={`row-attempt-${a.id}`}>
                          <td className="p-3 text-xs">{a.finishedAt ? new Date(a.finishedAt).toLocaleString('ru') : '...'}</td>
                          <td className="p-3">{studentName(a.studentId)}</td>
                          <td className="p-3 text-muted-foreground">{quiz?.topic || a.quizId.slice(0, 8)}</td>
                          <td className="p-3">
                            <Badge variant={pct >= 70 ? 'default' : pct >= 40 ? 'secondary' : 'destructive'}>
                              {a.score}/{a.total} · {pct}%
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{a.source === 'telegram' ? '🤖 Telegram' : '🌐 Сайт'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateQuizDialog open={createOpen} onOpenChange={setCreateOpen} students={students} />
      <ViewQuizDialog quiz={viewQuiz} onClose={() => setViewQuiz(null)} studentName={studentName} />
      </div>
    </DashboardLayout>
  );
}

function CreateQuizDialog({ open, onOpenChange, students }: { open: boolean; onOpenChange: (v: boolean) => void; students: Student[] }) {
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [studentId, setStudentId] = useState<string>("__all__");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>("medium");
  const [questions, setQuestions] = useState<QQ[]>([]);
  const [generating, setGenerating] = useState(false);

  const reset = () => {
    setTopic(""); setDescription(""); setStudentId("__all__"); setCount(5);
    setDifficulty("medium"); setQuestions([]);
  };

  const generate = async () => {
    if (!topic.trim()) { toast.error("Укажите тему"); return; }
    setGenerating(true);
    try {
      const r = await apiRequest("POST", "/api/quizzes/generate", { topic, count, difficulty });
      const j = await r.json();
      if (j.questions) setQuestions(j.questions);
      else throw new Error(j.error || "Ошибка");
    } catch (e: any) {
      toast.error("Не удалось сгенерировать", { description: e.message });
    } finally { setGenerating(false); }
  };

  const addManual = () => setQuestions(qs => [...qs, { q: "", options: ["", "", "", ""], correct: 0 }]);
  const updateQ = (i: number, patch: Partial<QQ>) => setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  const updateOpt = (i: number, oi: number, val: string) => setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, options: q.options.map((o, k) => k === oi ? val : o) } : q));
  const removeQ = (i: number) => setQuestions(qs => qs.filter((_, idx) => idx !== i));

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        topic, description: description || undefined,
        studentId: studentId === "__all__" ? null : studentId,
        questions,
      };
      return apiRequest("POST", "/api/quizzes", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      toast.success("Тренажёр создан");
      reset(); onOpenChange(false);
    },
    onError: (e: any) => toast.error("Ошибка", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Новый тренажёр</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Тема</Label>
            <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Например: Производные функций" data-testid="input-quiz-topic" />
          </div>
          <div>
            <Label>Описание (необязательно)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} data-testid="input-quiz-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Кому</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger data-testid="select-quiz-student"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Всем ученикам</SelectItem>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Сложность</Label>
              <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                <SelectTrigger data-testid="select-quiz-difficulty"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Легко</SelectItem>
                  <SelectItem value="medium">Средне</SelectItem>
                  <SelectItem value="hard">Сложно</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-amber-500" /> Сгенерировать вопросы ИИ</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={3} max={15} value={count} onChange={e => setCount(parseInt(e.target.value) || 5)} className="w-16 h-8" data-testid="input-quiz-count" />
                <Button size="sm" onClick={generate} disabled={generating || !topic.trim()} data-testid="button-generate-quiz" className="gap-1.5">
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Сгенерировать
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">ИИ сделает {count} вопросов на 4 варианта. Вы сможете отредактировать.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Вопросы ({questions.length})</Label>
              <Button size="sm" variant="outline" onClick={addManual} data-testid="button-add-question" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Добавить</Button>
            </div>
            {questions.map((q, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground mt-2">#{i + 1}</span>
                  <Textarea value={q.q} onChange={e => updateQ(i, { q: e.target.value })} rows={2} placeholder="Текст вопроса" className="flex-1" data-testid={`input-question-${i}`} />
                  <Button size="icon" variant="ghost" onClick={() => removeQ(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-1.5 pl-6">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" checked={q.correct === oi} onChange={() => updateQ(i, { correct: oi })} data-testid={`radio-correct-${i}-${oi}`} />
                      <Input value={opt} onChange={e => updateOpt(i, oi, e.target.value)} placeholder={`Вариант ${oi + 1}`} className="h-8" data-testid={`input-option-${i}-${oi}`} />
                    </div>
                  ))}
                </div>
                <Input value={q.explanation || ""} onChange={e => updateQ(i, { explanation: e.target.value })} placeholder="Объяснение (необязательно)" className="h-8 text-xs" data-testid={`input-explanation-${i}`} />
              </Card>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !topic.trim() || questions.length === 0} data-testid="button-save-quiz">
            {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewQuizDialog({ quiz, onClose, studentName }: { quiz: Quiz | null; onClose: () => void; studentName: (id?: string | null) => string }) {
  const { data: attempts = [] } = useQuery<QuizAttempt[]>({
    queryKey: ["/api/quizzes", quiz?.id, "attempts"],
    enabled: !!quiz,
  });
  if (!quiz) return null;
  const qs = (quiz.questions as any[]) || [];
  return (
    <Dialog open={!!quiz} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{quiz.topic}</DialogTitle></DialogHeader>
        {quiz.description && <p className="text-sm text-muted-foreground">{quiz.description}</p>}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Вопросы:</h3>
          {qs.map((q: any, i: number) => (
            <div key={i} className="rounded border p-2 text-sm">
              <div className="font-medium">{i + 1}. {q.q}</div>
              <ol className="mt-1 ml-4 space-y-0.5 text-xs">
                {q.options.map((o: string, oi: number) => (
                  <li key={oi} className={oi === q.correct ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                    {String.fromCharCode(65 + oi)}. {o} {oi === q.correct && '✓'}
                  </li>
                ))}
              </ol>
              {q.explanation && <p className="text-xs text-muted-foreground mt-1 italic">💡 {q.explanation}</p>}
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-3 border-t">
          <h3 className="font-semibold text-sm flex items-center gap-1.5"><BarChart3 className="h-4 w-4" /> Попытки ({attempts.length})</h3>
          {attempts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Пока никто не проходил</p>
          ) : (
            <div className="space-y-1">
              {attempts.map(a => {
                const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
                return (
                  <div key={a.id} className="flex items-center justify-between text-xs border rounded p-2">
                    <span>{studentName(a.studentId)}</span>
                    <span className="text-muted-foreground">{a.finishedAt ? new Date(a.finishedAt).toLocaleString('ru') : '...'}</span>
                    <Badge variant={pct >= 70 ? 'default' : 'secondary'}>{a.score}/{a.total} · {pct}%</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
