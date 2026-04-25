import * as XLSX from "xlsx";

export function downloadExcel(workbook: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCSV(data: Record<string, any>[], headers: Record<string, string>, filename: string) {
  const cols = Object.keys(headers);
  const rows = [Object.values(headers), ...data.map(row => cols.map(c => row[c] ?? ""))];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function makeSheet(data: Record<string, any>[], headers: Record<string, string>): XLSX.WorkSheet {
  const cols = Object.keys(headers);
  const rows = [Object.values(headers), ...data.map(row => cols.map(c => row[c] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wscols = cols.map(c => ({ wch: Math.max(14, String(headers[c]).length + 4) }));
  ws["!cols"] = wscols;
  return ws;
}

function lessonStatusLabel(status: string, attendance: string | null) {
  if (status === "completed") {
    if (attendance === "attended") return "Проведено (оплачено)";
    if (attendance === "attended_unpaid") return "Проведено (не оплачено)";
    return "Проведено";
  }
  if (status === "cancelled") {
    if (attendance === "missed_paid") return "Отменено (платная)";
    return "Отменено (бесплатная)";
  }
  return "Ожидает";
}

function homeworkStatusLabel(status: string) {
  if (status === "assigned") return "Назначено";
  if (status === "in_progress") return "В работе";
  if (status === "submitted") return "На проверку";
  if (status === "reviewed") return "Проверено";
  return status;
}

export function exportLessonsToExcel(lessons: any[], students: any[]) {
  const studMap = new Map(students.map(s => [s.id, s]));
  const sorted = [...lessons].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const data = sorted.map(l => {
    const s = studMap.get(l.studentId);
    const d = new Date(l.scheduledAt);
    const price = s ? Math.round(s.pricePerLesson * (l.durationMinutes || 60) / 60) : 0;
    return {
      date: d.toLocaleDateString("ru-RU"),
      time: d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      student: s?.name ?? "—",
      subject: s?.subject ?? "—",
      topic: l.topic ?? "—",
      duration: l.durationMinutes,
      status: lessonStatusLabel(l.status, l.attendance),
      price,
    };
  });

  const ws = makeSheet(data, {
    date: "Дата",
    time: "Время",
    student: "Ученик",
    subject: "Предмет",
    topic: "Тема",
    duration: "Длительность (мин)",
    status: "Статус",
    price: "Стоимость (₽)",
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "История занятий");
  downloadExcel(wb, `занятия-${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.xlsx`);
}

export function exportFinanceToExcel(lessons: any[], students: any[], payments: any[]) {
  const studMap = new Map(students.map(s => [s.id, s]));

  const incomeByStudent = new Map<string, { name: string; subject: string; earned: number; owed: number; count: number }>();
  for (const s of students) {
    incomeByStudent.set(s.id, { name: s.name, subject: s.subject, earned: 0, owed: 0, count: 0 });
  }

  for (const l of lessons) {
    const s = studMap.get(l.studentId);
    if (!s) continue;
    const price = Math.round(s.pricePerLesson * (l.durationMinutes || 60) / 60);
    const rec = incomeByStudent.get(l.studentId);
    if (!rec) continue;
    if (l.status === "completed" && l.attendance === "attended") { rec.earned += price; rec.count++; }
    else if (l.status === "completed" && l.attendance === "attended_unpaid") { rec.owed += price; rec.count++; }
    else if (l.status === "cancelled" && l.attendance === "missed_paid") { rec.earned += price; }
  }

  const summaryData = Array.from(incomeByStudent.values()).filter(r => r.count > 0 || r.earned > 0 || r.owed > 0);
  const wsSummary = makeSheet(summaryData, {
    name: "Ученик",
    subject: "Предмет",
    count: "Занятий проведено",
    earned: "Получено (₽)",
    owed: "Долг (₽)",
  });

  const lessonsData = lessons
    .filter(l => ["completed", "cancelled"].includes(l.status))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .map(l => {
      const s = studMap.get(l.studentId);
      const d = new Date(l.scheduledAt);
      const price = s ? Math.round(s.pricePerLesson * (l.durationMinutes || 60) / 60) : 0;
      let status = "—";
      if (l.status === "completed" && l.attendance === "attended") status = "Оплачено";
      else if (l.status === "completed" && l.attendance === "attended_unpaid") status = "Долг";
      else if (l.status === "cancelled" && l.attendance === "missed_paid") status = "Отмена (платная)";
      else if (l.status === "cancelled") status = "Отмена";
      return {
        date: d.toLocaleDateString("ru-RU"),
        student: s?.name ?? "—",
        duration: l.durationMinutes,
        price,
        status,
        topic: l.topic ?? "—",
      };
    });

  const wsLessons = makeSheet(lessonsData, {
    date: "Дата",
    student: "Ученик",
    duration: "Длит. (мин)",
    price: "Сумма (₽)",
    status: "Статус оплаты",
    topic: "Тема",
  });

  const paymentsData = [...payments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(p => {
      const s = studMap.get(p.studentId);
      return {
        date: new Date(p.createdAt).toLocaleDateString("ru-RU"),
        student: s?.name ?? "—",
        amount: p.amount,
        note: p.note ?? "—",
      };
    });

  const wsPayments = makeSheet(paymentsData, {
    date: "Дата",
    student: "Ученик",
    amount: "Сумма (₽)",
    note: "Комментарий",
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, "По ученикам");
  XLSX.utils.book_append_sheet(wb, wsLessons, "Детализация занятий");
  XLSX.utils.book_append_sheet(wb, wsPayments, "Платежи");
  downloadExcel(wb, `финансы-${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.xlsx`);
}

export function exportStudentsToExcel(students: any[]) {
  const data = students.map(s => ({
    name: s.name,
    subject: s.subject ?? "—",
    goal: s.goal ?? "—",
    grade: s.grade ?? "—",
    price: s.pricePerLesson ?? 0,
    email: s.email ?? "—",
    phone: s.parentContact ?? "—",
    status: s.isArchived ? "Архив" : "Активный",
    hasPortal: (s as any).hasPortalAccess ? "Да" : "Нет",
    hasProgram: s.hasProgram ? "Да" : "Нет",
    comment: (s as any).comment ?? "—",
  }));

  const ws = makeSheet(data, {
    name: "Имя",
    subject: "Предмет",
    goal: "Цель",
    grade: "Класс",
    price: "Цена (₽/ч)",
    email: "Email",
    phone: "Телефон / родитель",
    status: "Статус",
    hasPortal: "Доступ к платформе",
    hasProgram: "Есть программа",
    comment: "Комментарий",
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ученики");
  downloadExcel(wb, `ученики-${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.xlsx`);
}

export function exportHomeworkToExcel(homework: any[], students: any[]) {
  const studMap = new Map(students.map(s => [s.id, s]));
  const data = [...homework]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(h => {
      const s = studMap.get(h.studentId);
      return {
        created: new Date(h.createdAt).toLocaleDateString("ru-RU"),
        deadline: h.deadline ? new Date(h.deadline).toLocaleDateString("ru-RU") : "—",
        student: s?.name ?? "—",
        subject: s?.subject ?? "—",
        title: h.title,
        description: h.description ?? "—",
        status: homeworkStatusLabel(h.status),
        score: h.score != null ? h.score : "—",
        solutionText: h.solutionText ?? "—",
        feedback: h.feedback ?? "—",
        submittedAt: h.submittedAt ? new Date(h.submittedAt).toLocaleDateString("ru-RU") : "—",
      };
    });

  const ws = makeSheet(data, {
    created: "Дата назначения",
    deadline: "Дедлайн",
    student: "Ученик",
    subject: "Предмет",
    title: "Задание",
    description: "Описание",
    status: "Статус",
    score: "Оценка",
    solutionText: "Ответ ученика",
    feedback: "Комментарий репетитора",
    submittedAt: "Сдано",
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Домашние задания");
  downloadExcel(wb, `домашние-задания-${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.xlsx`);
}

export function exportAllDataToExcel(options: {
  students?: any[];
  lessons?: any[];
  payments?: any[];
  homework?: any[];
  fromDate?: string;
  toDate?: string;
}) {
  const { students = [], payments = [], homework = [] } = options;
  let lessons = options.lessons ?? [];

  const from = options.fromDate ? new Date(options.fromDate) : null;
  const to = options.toDate ? new Date(options.toDate + "T23:59:59") : null;

  if (from || to) {
    if (from) lessons = lessons.filter(l => new Date(l.scheduledAt) >= from!);
    if (to) lessons = lessons.filter(l => new Date(l.scheduledAt) <= to!);
  }
  const filteredPayments = payments.filter(p => {
    const d = new Date(p.createdAt);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  const filteredHomework = homework.filter(h => {
    const d = new Date(h.createdAt);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const studMap = new Map(students.map(s => [s.id, s]));
  const wb = XLSX.utils.book_new();

  if (students.length > 0) {
    const data = students.map(s => ({
      name: s.name,
      subject: s.subject ?? "—",
      goal: s.goal ?? "—",
      grade: s.grade ?? "—",
      price: s.pricePerLesson ?? 0,
      email: s.email ?? "—",
      phone: s.parentContact ?? "—",
      status: s.isArchived ? "Архив" : "Активный",
      hasPortal: s.hasPortalAccess ? "Да" : "Нет",
      comment: (s as any).comment ?? "—",
    }));
    const ws = makeSheet(data, {
      name: "Имя", subject: "Предмет", goal: "Цель", grade: "Класс",
      price: "Цена (₽/ч)", email: "Email", phone: "Телефон",
      status: "Статус", hasPortal: "Доступ к порталу", comment: "Комментарий",
    });
    XLSX.utils.book_append_sheet(wb, ws, "Ученики");
  }

  if (lessons.length > 0) {
    const data = [...lessons]
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .map(l => {
        const s = studMap.get(l.studentId);
        const d = new Date(l.scheduledAt);
        const price = s ? Math.round(s.pricePerLesson * (l.durationMinutes || 60) / 60) : 0;
        return {
          date: d.toLocaleDateString("ru-RU"),
          time: d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          student: s?.name ?? "—",
          subject: s?.subject ?? "—",
          topic: l.topic ?? "—",
          duration: l.durationMinutes,
          status: lessonStatusLabel(l.status, l.attendance),
          price,
        };
      });
    const ws = makeSheet(data, {
      date: "Дата", time: "Время", student: "Ученик", subject: "Предмет",
      topic: "Тема", duration: "Длит. (мин)", status: "Статус", price: "Стоимость (₽)",
    });
    XLSX.utils.book_append_sheet(wb, ws, "Занятия");
  }

  if (filteredPayments.length > 0) {
    const data = [...filteredPayments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(p => {
        const s = studMap.get(p.studentId);
        return {
          date: new Date(p.createdAt).toLocaleDateString("ru-RU"),
          student: s?.name ?? "—",
          amount: p.amount,
          note: p.note ?? "—",
        };
      });
    const ws = makeSheet(data, {
      date: "Дата", student: "Ученик", amount: "Сумма (₽)", note: "Комментарий",
    });
    XLSX.utils.book_append_sheet(wb, ws, "Платежи");
  }

  if (filteredHomework.length > 0) {
    const data = [...filteredHomework]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(h => {
        const s = studMap.get(h.studentId);
        return {
          created: new Date(h.createdAt).toLocaleDateString("ru-RU"),
          deadline: h.deadline ? new Date(h.deadline).toLocaleDateString("ru-RU") : "—",
          student: s?.name ?? "—",
          subject: s?.subject ?? "—",
          title: h.title,
          description: h.description ?? "—",
          status: homeworkStatusLabel(h.status),
          score: h.score != null ? h.score : "—",
          solutionText: h.solutionText ?? "—",
          feedback: h.feedback ?? "—",
          submittedAt: h.submittedAt ? new Date(h.submittedAt).toLocaleDateString("ru-RU") : "—",
        };
      });
    const ws = makeSheet(data, {
      created: "Дата назначения", deadline: "Дедлайн", student: "Ученик", subject: "Предмет",
      title: "Задание", description: "Описание", status: "Статус",
      score: "Оценка", solutionText: "Ответ ученика", feedback: "Комментарий репетитора",
      submittedAt: "Сдано",
    });
    XLSX.utils.book_append_sheet(wb, ws, "Домашние задания");
  }

  const dateStr = new Date().toLocaleDateString("ru-RU").replace(/\./g, "-");
  downloadExcel(wb, `все-данные-${dateStr}.xlsx`);
}

export function exportSectionCSV(
  section: "students" | "lessons" | "payments" | "homework",
  data: any[],
  students: any[]
) {
  const studMap = new Map(students.map(s => [s.id, s]));

  if (section === "students") {
    const rows = data.map(s => ({
      name: s.name, subject: s.subject ?? "—", goal: s.goal ?? "—", grade: s.grade ?? "—",
      price: s.pricePerLesson ?? 0, email: s.email ?? "—", phone: s.parentContact ?? "—",
      status: s.isArchived ? "Архив" : "Активный", hasPortal: s.hasPortalAccess ? "Да" : "Нет",
      comment: (s as any).comment ?? "—",
    }));
    downloadCSV(rows, {
      name: "Имя", subject: "Предмет", goal: "Цель", grade: "Класс",
      price: "Цена (₽/ч)", email: "Email", phone: "Телефон",
      status: "Статус", hasPortal: "Доступ к порталу", comment: "Комментарий",
    }, `ученики-${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.csv`);
    return;
  }

  if (section === "lessons") {
    const rows = [...data]
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .map(l => {
        const s = studMap.get(l.studentId);
        const d = new Date(l.scheduledAt);
        const price = s ? Math.round(s.pricePerLesson * (l.durationMinutes || 60) / 60) : 0;
        return {
          date: d.toLocaleDateString("ru-RU"),
          time: d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          student: s?.name ?? "—", subject: s?.subject ?? "—", topic: l.topic ?? "—",
          duration: l.durationMinutes, status: lessonStatusLabel(l.status, l.attendance), price,
        };
      });
    downloadCSV(rows, {
      date: "Дата", time: "Время", student: "Ученик", subject: "Предмет",
      topic: "Тема", duration: "Длит. (мин)", status: "Статус", price: "Стоимость (₽)",
    }, `занятия-${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.csv`);
    return;
  }

  if (section === "payments") {
    const rows = [...data]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(p => {
        const s = studMap.get(p.studentId);
        return { date: new Date(p.createdAt).toLocaleDateString("ru-RU"), student: s?.name ?? "—", amount: p.amount, note: p.note ?? "—" };
      });
    downloadCSV(rows, { date: "Дата", student: "Ученик", amount: "Сумма (₽)", note: "Комментарий" },
      `платежи-${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.csv`);
    return;
  }

  if (section === "homework") {
    const rows = [...data]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(h => {
        const s = studMap.get(h.studentId);
        return {
          created: new Date(h.createdAt).toLocaleDateString("ru-RU"),
          deadline: h.deadline ? new Date(h.deadline).toLocaleDateString("ru-RU") : "—",
          student: s?.name ?? "—", subject: s?.subject ?? "—",
          title: h.title, description: h.description ?? "—",
          status: homeworkStatusLabel(h.status),
          score: h.score != null ? h.score : "—",
          solutionText: h.solutionText ?? "—",
          feedback: h.feedback ?? "—",
          submittedAt: h.submittedAt ? new Date(h.submittedAt).toLocaleDateString("ru-RU") : "—",
        };
      });
    downloadCSV(rows, {
      created: "Дата назначения", deadline: "Дедлайн", student: "Ученик", subject: "Предмет",
      title: "Задание", description: "Описание", status: "Статус",
      score: "Оценка", solutionText: "Ответ ученика", feedback: "Комментарий", submittedAt: "Сдано",
    }, `домашние-задания-${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.csv`);
  }
}
