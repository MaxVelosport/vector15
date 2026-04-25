import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Users, Calendar, Wallet, Clock, ChevronLeft, ChevronRight, CheckCircle, XCircle, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOverviewStats, useIncomeStats } from "@/hooks/use-analytics";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";

export function AnalyticsOverview() {
  const { data: overview, isLoading: overviewLoading } = useOverviewStats();
  const { data: income, isLoading: incomeLoading } = useIncomeStats();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  if (overviewLoading || incomeLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const currentMonthIncome = overview?.incomeThisMonth ?? 0;
  const lastMonthIncome = income?.monthly?.[income.monthly.length - 2]?.amount ?? 0;
  const incomeChange = lastMonthIncome > 0 ? Math.round(((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100) : 0;
  const isIncomeUp = incomeChange >= 0;

  const completedLessons = overview?.completedLessons ?? 0;
  const cancelledLessons = overview?.cancelledLessons ?? 0;
  const totalLessonsForRate = completedLessons + cancelledLessons;
  const attendanceRate = totalLessonsForRate > 0 ? Math.round((completedLessons / totalLessonsForRate) * 100) : 100;

  const avgLessonPrice = overview?.avgLessonPrice ?? 0;
  const totalStudents = overview?.totalStudents ?? 0;
  const activeStudents = overview?.activeStudents ?? 0;
  const retentionRate = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 100;

  const stats = [
    {
      title: "Активных учеников",
      value: overview?.activeStudents ?? 0,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Занятий в этом месяце",
      value: overview?.lessonsThisMonth ?? 0,
      icon: Calendar,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      title: "Доход за месяц",
      value: `${(overview?.incomeThisMonth ?? 0).toLocaleString("ru-RU")} ₽`,
      icon: Wallet,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      change: incomeChange,
      isUp: isIncomeUp,
    },
    {
      title: "Предстоящих занятий",
      value: overview?.upcomingLessons ?? 0,
      icon: TrendingUp,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  const weekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const rawWeekdayStats = overview?.lessonsByWeekday ?? [0, 0, 0, 0, 0, 0, 0];
  const weekdayStats = [
    rawWeekdayStats[1],
    rawWeekdayStats[2],
    rawWeekdayStats[3],
    rawWeekdayStats[4],
    rawWeekdayStats[5],
    rawWeekdayStats[6],
    rawWeekdayStats[0],
  ];
  const maxWeekdayLessons = Math.max(...weekdayStats, 1);
  const totalWeekdayLessons = weekdayStats.reduce((a, b) => a + b, 0);

  const availableYears = Array.from(new Set(income?.monthly?.map(m => parseInt(m.month.split("-")[0])) || [])).sort((a, b) => b - a);
  if (availableYears.length === 0) availableYears.push(new Date().getFullYear());

  const monthsForYear = income?.monthly?.filter(m => m.month.startsWith(String(selectedYear))) || [];
  const yearTotal = monthsForYear.reduce((sum, m) => sum + m.amount, 0);
  const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

  const allMonthsForYear = monthNames.map((name, idx) => {
    const monthNum = String(idx + 1).padStart(2, "0");
    const key = `${selectedYear}-${monthNum}`;
    const found = monthsForYear.find(m => m.month === key);
    return { month: key, monthName: name, amount: found?.amount ?? 0 };
  });

  const maxMonthAmount = Math.max(...allMonthsForYear.map(m => m.amount), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} data-testid={`stat-card-${stat.title}`} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{stat.title}</p>
                      {stat.change !== undefined && stat.change !== 0 && (
                        <span className={`flex items-center text-xs ${stat.isUp ? 'text-green-500' : 'text-red-500'}`}>
                          {stat.isUp ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                          {Math.abs(stat.change)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Посещаемость
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{attendanceRate}%</span>
              <span className="mb-1 text-sm text-muted-foreground">явка</span>
            </div>
            <Progress value={attendanceRate} className="mt-3 h-2" />
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {completedLessons} проведено
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {cancelledLessons} отменено
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-cyan-500" />
              Удержание учеников
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{retentionRate}%</span>
              <span className="mb-1 text-sm text-muted-foreground">активных</span>
            </div>
            <Progress value={retentionRate} className="mt-3 h-2" />
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>{activeStudents} активных</span>
              <span>{totalStudents - activeStudents} в архиве</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="h-4 w-4 text-green-500" />
              Средняя ставка
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{avgLessonPrice.toLocaleString("ru-RU")}</span>
              <span className="mb-1 text-sm text-muted-foreground">₽/занятие</span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>За час работы:</span>
                <span className="font-medium text-foreground">{avgLessonPrice.toLocaleString("ru-RU")} ₽</span>
              </div>
              <div className="flex justify-between">
                <span>Потенциал в месяц (4 зан/уч):</span>
                <span className="font-medium text-foreground">{(avgLessonPrice * 4 * activeStudents).toLocaleString("ru-RU")} ₽</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Доход за {selectedYear}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedYear(y => y - 1)}
                  disabled={!availableYears.includes(selectedYear - 1) && selectedYear <= Math.min(...availableYears)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[4ch] text-center">{selectedYear}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedYear(y => y + 1)}
                  disabled={selectedYear >= new Date().getFullYear()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end justify-between gap-1">
              {allMonthsForYear.map((item) => {
                const height = maxMonthAmount > 0 ? (item.amount / maxMonthAmount) * 100 : 0;
                const isCurrentMonth = item.month === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
                const displayAmount = item.amount >= 1000 ? `${Math.round(item.amount / 1000)}к` : item.amount > 0 ? String(item.amount) : "";
                return (
                  <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative w-full flex-1 flex items-end">
                      <div
                        className={`relative w-full rounded-t transition-all duration-500 flex items-end justify-center pb-1 ${
                          isCurrentMonth ? 'bg-primary' : item.amount > 0 ? 'bg-primary/50' : 'bg-muted'
                        }`}
                        style={{ height: `${Math.max(height, 12)}%` }}
                        title={`${item.amount.toLocaleString("ru-RU")} ₽`}
                      >
                        {item.amount > 0 && (
                          <span className="text-[8px] font-medium text-primary-foreground drop-shadow-sm">
                            {displayAmount}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] ${isCurrentMonth ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                      {item.monthName}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Итого за {selectedYear}:</span>
              <span className="text-xl font-bold">
                {yearTotal.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Занятия на 2 недели
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end justify-between gap-3 px-2">
              {weekdayStats.map((count, idx) => {
                const height = maxWeekdayLessons > 0 ? (count / maxWeekdayLessons) * 100 : 0;
                const todayIdx = (new Date().getDay() + 6) % 7;
                const isToday = todayIdx === idx;
                return (
                  <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative w-full flex-1 flex items-end justify-center">
                      <div
                        className={`w-full max-w-8 rounded-t-md transition-all duration-500 flex items-end justify-center pb-1 ${
                          isToday ? 'bg-gradient-to-t from-primary to-primary/80' : count > 0 ? 'bg-gradient-to-t from-primary/60 to-primary/40' : 'bg-muted'
                        }`}
                        style={{ height: `${Math.max(height, count > 0 ? 20 : 8)}%`, minHeight: count > 0 ? '28px' : '8px' }}
                      >
                        {count > 0 && (
                          <span className={`text-[10px] font-bold ${isToday ? 'text-primary-foreground' : 'text-primary-foreground/90'}`}>
                            {count}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs mt-1 ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                      {weekdayLabels[idx]}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-between text-xs text-muted-foreground border-t pt-3">
              <span>Всего: <span className="font-medium text-foreground">{totalWeekdayLessons}</span> занятий</span>
              <span>Текущая + следующая неделя</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
