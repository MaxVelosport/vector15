import { useQuery } from "@tanstack/react-query";

interface MonthlyIncome {
  month: string;
  amount: number;
}

interface IncomeStats {
  monthly: MonthlyIncome[];
  total: number;
  thisMonth: number;
}

interface StudentStat {
  id: string;
  name: string;
  subject: string;
  lessonsCompleted: number;
  averageRating: number | null;
  progress: number;
  balance: number;
}

interface StudentStats {
  students: StudentStat[];
  summary: {
    totalStudents: number;
    activeStudents: number;
    totalLessons: number;
  };
}

interface OverviewStats {
  activeStudents: number;
  totalStudents: number;
  lessonsThisMonth: number;
  completedLessonsThisMonth: number;
  incomeThisMonth: number;
  upcomingLessons: number;
  totalBalance: number;
  completedLessons: number;
  cancelledLessons: number;
  avgLessonPrice: number;
  lessonsByWeekday: number[];
}

export function useIncomeStats() {
  return useQuery<IncomeStats>({
    queryKey: ["/api/analytics/income"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/income", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки статистики");
      return res.json();
    },
  });
}

export function useStudentStats() {
  return useQuery<StudentStats>({
    queryKey: ["/api/analytics/students"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/students", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки статистики");
      return res.json();
    },
  });
}

export function useOverviewStats() {
  return useQuery<OverviewStats>({
    queryKey: ["/api/analytics/overview"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/overview", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки статистики");
      return res.json();
    },
  });
}
