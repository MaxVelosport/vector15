import { describe, it, expect } from "vitest";
import {
  insertTutorSchema,
  insertStudentSchema,
  insertLessonSchema,
  insertPaymentSchema,
  insertHomeworkSchema,
} from "../../shared/schema.js";

// ─── Tutor schema ─────────────────────────────────────────────────────────────

describe("insertTutorSchema", () => {
  const validTutor = {
    email: "test@example.com",
    password: "hashed_password_here",
    name: "Анна Петрова",
    subjects: ["Математика", "Физика"],
    basePrice: 1800,
    timezone: "Europe/Moscow",
    subscription: "free",
    isAdmin: false,
    extraStudents: 0,
    cancelPolicy: "free",
    cancelFee: 0,
    scheduleStart: 8,
    scheduleEnd: 22,
    tutorTelegramNotificationsEnabled: true,
    isBlocked: false,
  };

  it("accepts valid tutor data", () => {
    const result = insertTutorSchema.safeParse(validTutor);
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const { email: _, ...noEmail } = validTutor;
    const result = insertTutorSchema.safeParse(noEmail);
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const { name: _, ...noName } = validTutor;
    const result = insertTutorSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const { password: _, ...noPass } = validTutor;
    const result = insertTutorSchema.safeParse(noPass);
    expect(result.success).toBe(false);
  });

  it("accepts tutor without optional public fields", () => {
    const result = insertTutorSchema.safeParse(validTutor);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.publicSlug).toBeUndefined();
      expect(result.data.publicBio).toBeUndefined();
    }
  });

  it("accepts tutor with public profile fields", () => {
    const withPublic = {
      ...validTutor,
      publicSlug: "anna-petrova",
      publicBio: "Опытный репетитор",
      publicPhone: "+7 999 123-45-67",
      isPublicProfile: true,
    };
    const result = insertTutorSchema.safeParse(withPublic);
    expect(result.success).toBe(true);
  });

  it("accepts any non-empty string as email (no format validation at schema layer)", () => {
    const result = insertTutorSchema.safeParse({ ...validTutor, email: "not-an-email" });
    expect(result.success).toBe(true);
  });
});

// ─── Student schema ───────────────────────────────────────────────────────────

describe("insertStudentSchema", () => {
  const validStudent = {
    tutorId: "tutor-uuid-123",
    name: "Иван Иванов",
    subject: "Математика",
    goal: "Подготовка к ЕГЭ",
    grade: "11",
    pricePerLesson: 1800,
    balance: 0,
  };

  it("accepts valid student data", () => {
    const result = insertStudentSchema.safeParse(validStudent);
    expect(result.success).toBe(true);
  });

  it("rejects missing tutorId", () => {
    const { tutorId: _, ...noTutorId } = validStudent;
    const result = insertStudentSchema.safeParse(noTutorId);
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const { name: _, ...noName } = validStudent;
    const result = insertStudentSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it("rejects missing subject", () => {
    const { subject: _, ...noSubject } = validStudent;
    const result = insertStudentSchema.safeParse(noSubject);
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric pricePerLesson", () => {
    const result = insertStudentSchema.safeParse({ ...validStudent, pricePerLesson: "дорого" });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields as null", () => {
    const withOptionals = { ...validStudent, parentContact: null, comment: null };
    const result = insertStudentSchema.safeParse(withOptionals);
    expect(result.success).toBe(true);
  });
});

// ─── Lesson schema ────────────────────────────────────────────────────────────

describe("insertLessonSchema", () => {
  const validLesson = {
    tutorId: "tutor-uuid-123",
    studentId: "student-uuid-456",
    scheduledAt: new Date("2024-09-15T10:00:00Z"),
    durationMinutes: 60,
    topic: "Тригонометрия",
    status: "pending",
  };

  it("accepts valid lesson data", () => {
    const result = insertLessonSchema.safeParse(validLesson);
    expect(result.success).toBe(true);
  });

  it("rejects missing scheduledAt", () => {
    const { scheduledAt: _, ...noDate } = validLesson;
    const result = insertLessonSchema.safeParse(noDate);
    expect(result.success).toBe(false);
  });

  it("rejects missing studentId", () => {
    const { studentId: _, ...noStudent } = validLesson;
    const result = insertLessonSchema.safeParse(noStudent);
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric durationMinutes", () => {
    const result = insertLessonSchema.safeParse({ ...validLesson, durationMinutes: "час" });
    expect(result.success).toBe(false);
  });

  it("rejects missing topic", () => {
    const { topic: _, ...noTopic } = validLesson;
    const result = insertLessonSchema.safeParse(noTopic);
    expect(result.success).toBe(false);
  });

  it("accepts optional attendance and rating as null", () => {
    const result = insertLessonSchema.safeParse({
      ...validLesson,
      attendance: null,
      rating: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Payment schema ───────────────────────────────────────────────────────────

describe("insertPaymentSchema", () => {
  const validPayment = {
    tutorId: "tutor-uuid-123",
    studentId: "student-uuid-456",
    amount: 3600,
    method: "наличные",
  };

  it("accepts valid payment data", () => {
    const result = insertPaymentSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it("rejects missing amount", () => {
    const { amount: _, ...noAmount } = validPayment;
    const result = insertPaymentSchema.safeParse(noAmount);
    expect(result.success).toBe(false);
  });

  it("rejects missing method", () => {
    const { method: _, ...noMethod } = validPayment;
    const result = insertPaymentSchema.safeParse(noMethod);
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric amount", () => {
    const result = insertPaymentSchema.safeParse({ ...validPayment, amount: "много" });
    expect(result.success).toBe(false);
  });

  it("accepts optional comment", () => {
    const result = insertPaymentSchema.safeParse({
      ...validPayment,
      comment: "Оплата за октябрь",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Homework schema ──────────────────────────────────────────────────────────

describe("insertHomeworkSchema", () => {
  const validHomework = {
    tutorId: "tutor-uuid-123",
    studentId: "student-uuid-456",
    lessonId: null,
    title: "Задание по тригонометрии",
    description: "Решить задачи 1–10",
    dueDate: new Date("2024-09-20"),
    status: "assigned",
  };

  it("accepts valid homework data", () => {
    const result = insertHomeworkSchema.safeParse(validHomework);
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const { title: _, ...noTitle } = validHomework;
    const result = insertHomeworkSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it("rejects missing studentId", () => {
    const { studentId: _, ...noStudent } = validHomework;
    const result = insertHomeworkSchema.safeParse(noStudent);
    expect(result.success).toBe(false);
  });

  it("accepts homework without lessonId", () => {
    const result = insertHomeworkSchema.safeParse({ ...validHomework, lessonId: null });
    expect(result.success).toBe(true);
  });

  it("accepts homework without optional description", () => {
    const result = insertHomeworkSchema.safeParse({ ...validHomework, description: null });
    expect(result.success).toBe(true);
  });
});
