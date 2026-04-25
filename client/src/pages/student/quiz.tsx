import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BookOpen, CheckCircle2, XCircle, Loader2, ArrowRight, RotateCcw, Trophy } from "lucide-react";

type QuizListItem = { id: string; topic: string; description?: string | null; questionsCount: number; createdAt: string };
type QuizFull = { id: string; topic: string; description?: string | null; questions: { q: string; options: string[] }[] };
type ReviewItem = { q: string; options: string[]; correct: number; chosen: number; explanation?: string };
type Attempt = { id: string; quizId: string; score: number; total: number; finishedAt?: string };

export default function StudentQuiz() {
  const [activeQuiz, setActiveQuiz] = useState<QuizFull | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; review: ReviewItem[] } | null>(null);
  const { toast } = useToast();

  const { data: quizzes = [], isLoading } = useQuery<QuizListItem[]>({ queryKey: ["/api/student/quizzes"] });
  const { data: history = [] } = useQuery<Attempt[]>({ queryKey: ["/api/student/quiz-attempts"] });

  const start = async (id: string) => {
    try {
      const r = await apiRequest("GET", `/api/student/quizzes/${id}`);
      const quiz: QuizFull = await r.json();
      setActiveQuiz(quiz);
      setStep(0);
      setAnswers(new Array(quiz.questions.length).fill(-1));
      setResult(null);
    } catch (e: any) { toast({ title: "Не удалось загрузить", description: e.message, variant: "destructive" }); }
  };

  const choose = (oi: number) => setAnswers(a => a.map((v, i) => i === step ? oi : v));

  const submit = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);
    try {
      const r = await apiRequest("POST", `/api/student/quizzes/${activeQuiz.id}/submit`, { answers });
      const j = await r.json();
      setResult({ score: j.score, total: j.total, review: j.review });
      queryClient.invalidateQueries({ queryKey: ["/api/student/quiz-attempts"] });
    } catch (e: any) { toast({ title: "Ошибка", description: e.message, variant: "destructive" }); }
    finally { setSubmitting(false); }
  };

  const reset = () => { setActiveQuiz(null); setResult(null); setStep(0); setAnswers([]); };

  // === Result screen ===
  if (activeQuiz && result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="container max-w-2xl py-6 space-y-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="py-8 text-center space-y-3">
            <Trophy className={`h-12 w-12 mx-auto ${pct >= 70 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <h2 className="text-2xl font-bold">Готово!</h2>
            <p className="text-lg">Вы набрали <b>{result.score}</b> из <b>{result.total}</b></p>
            <div className="text-3xl font-bold text-primary">{pct}%</div>
            {pct >= 70 ? <p className="text-sm text-muted-foreground">Отличный результат! 🎉</p> :
              pct >= 40 ? <p className="text-sm text-muted-foreground">Неплохо, но есть к чему стремиться 💪</p> :
              <p className="text-sm text-muted-foreground">Стоит повторить тему 📚</p>}
            <div className="flex gap-2 justify-center pt-2">
              <Button onClick={() => start(activeQuiz.id)} variant="outline" className="gap-1.5" data-testid="button-retry-quiz">
                <RotateCcw className="h-4 w-4" /> Пройти заново
              </Button>
              <Button onClick={reset} data-testid="button-back-to-list">К списку</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Разбор ответов:</h3>
          {result.review.map((r, i) => (
            <Card key={i} className={r.chosen === r.correct ? 'border-green-500/40' : 'border-destructive/40'}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  {r.chosen === r.correct ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5" />}
                  <div className="text-sm font-medium">{i + 1}. {r.q}</div>
                </div>
                <ol className="text-xs space-y-0.5 ml-6">
                  {r.options.map((o, oi) => (
                    <li key={oi} className={
                      oi === r.correct ? 'text-green-600 font-medium' :
                      oi === r.chosen ? 'text-destructive line-through' : 'text-muted-foreground'
                    }>
                      {String.fromCharCode(65 + oi)}. {o}
                      {oi === r.correct && ' ✓'}
                      {oi === r.chosen && oi !== r.correct && ' ← ваш ответ'}
                    </li>
                  ))}
                </ol>
                {r.explanation && <p className="text-xs italic text-muted-foreground bg-muted/50 p-2 rounded">💡 {r.explanation}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // === Quiz in progress ===
  if (activeQuiz) {
    const q = activeQuiz.questions[step];
    const total = activeQuiz.questions.length;
    const isLast = step === total - 1;
    const chosen = answers[step];
    return (
      <div className="container max-w-2xl py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{activeQuiz.topic}</h2>
          <Badge variant="secondary">Вопрос {step + 1} из {total}</Badge>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="font-medium">{q.q}</div>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => choose(oi)}
                  data-testid={`button-option-${oi}`}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all hover-elevate ${
                    chosen === oi ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>{opt}
                </button>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={reset} data-testid="button-quit-quiz">Прервать</Button>
              {isLast ? (
                <Button onClick={submit} disabled={chosen === -1 || submitting} data-testid="button-submit-quiz" className="gap-1.5">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Завершить
                </Button>
              ) : (
                <Button onClick={() => setStep(s => s + 1)} disabled={chosen === -1} data-testid="button-next-question" className="gap-1.5">
                  Далее <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === List ===
  return (
    <div className="container max-w-2xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" /> Тренажёры</h1>
        <p className="text-sm text-muted-foreground mt-1">Карточки и тесты от вашего репетитора. Тренируйтесь между занятиями!</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
      ) : quizzes.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Пока нет тренажёров. Попросите репетитора создать тренировку по нужной теме!
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {quizzes.map(q => {
            const lastAttempt = history.find(h => h.quizId === q.id);
            return (
              <Card key={q.id} className="hover-elevate cursor-pointer" onClick={() => start(q.id)} data-testid={`card-student-quiz-${q.id}`}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{q.topic}</div>
                    {q.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{q.description}</div>}
                    <div className="text-xs text-muted-foreground mt-1">{q.questionsCount} вопросов
                      {lastAttempt && ` · последний результат: ${lastAttempt.score}/${lastAttempt.total}`}
                    </div>
                  </div>
                  <Button size="sm" data-testid={`button-start-quiz-${q.id}`}>Начать</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">История ({history.length})</h3>
          <div className="space-y-1">
            {history.slice(0, 5).map(h => {
              const pct = h.total > 0 ? Math.round((h.score / h.total) * 100) : 0;
              const quiz = quizzes.find(q => q.id === h.quizId);
              return (
                <div key={h.id} className="flex items-center justify-between text-xs p-2 border rounded">
                  <span className="truncate flex-1">{quiz?.topic || '—'}</span>
                  <span className="text-muted-foreground mx-2">{h.finishedAt ? new Date(h.finishedAt).toLocaleDateString('ru') : ''}</span>
                  <Badge variant={pct >= 70 ? 'default' : 'secondary'}>{h.score}/{h.total}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
