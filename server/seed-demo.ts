import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "@shared/schema";
import { tutors, students, lessons, payments, homework } from "@shared/schema";
import bcrypt from "bcrypt";
import { addDays, subDays, setHours, setMinutes } from "date-fns";
import { eq } from "drizzle-orm";

const dbUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString: dbUrl! });
const db = drizzle(pool, { schema });

async function seedDemo() {
  console.log("🌱 Seeding demo account...");
  
  const demoEmail = "demo@vector.ru";
  const demoPassword = "demo123";
  
  const existingTutor = await db.query.tutors.findFirst({
    where: eq(tutors.email, demoEmail)
  });
  
  if (existingTutor) {
    console.log("⚠️ Demo account already exists, skipping...");
    return;
  }
  
  const hashedPassword = await bcrypt.hash(demoPassword, 10);
  
  const [tutor] = await db.insert(tutors).values({
    email: demoEmail,
    password: hashedPassword,
    name: "Анна Петрова",
    subjects: ["Математика", "Физика", "Информатика"],
    basePrice: 2000,
    timezone: "Europe/Moscow",
    subscription: "pro",
    subscriptionUntil: addDays(new Date(), 180),
    isAdmin: false,
    publicSlug: "anna-petrova",
    publicBio: "Опытный преподаватель математики и физики с 8-летним стажем. Подготовка к ЕГЭ и ОГЭ на высокие баллы.",
    publicPhone: "+7 (999) 123-45-67",
    publicTelegram: "@anna_tutor",
    isPublicProfile: true,
  }).returning();
  
  console.log(`✅ Created demo tutor: ${tutor.id}`);
  
  const studentData = [
    { name: "Иван Смирнов", subject: "Математика", goal: "ЕГЭ 90+", grade: "11 класс", price: 2500, balance: 5000, progress: 75, topic: "Производные и интегралы", lessonsCompleted: 24 },
    { name: "Мария Козлова", subject: "Физика", goal: "Олимпиада", grade: "10 класс", price: 2200, balance: 2200, progress: 60, topic: "Механика, кинематика", lessonsCompleted: 18 },
    { name: "Дмитрий Волков", subject: "Математика", goal: "ОГЭ", grade: "9 класс", price: 1800, balance: -1800, progress: 45, topic: "Квадратные уравнения", lessonsCompleted: 12 },
    { name: "Анастасия Новикова", subject: "Информатика", goal: "ЕГЭ профиль", grade: "11 класс", price: 2000, balance: 4000, progress: 80, topic: "Алгоритмы и программирование", lessonsCompleted: 30 },
    { name: "Александр Морозов", subject: "Математика", goal: "Поступление в вуз", grade: "11 класс", price: 2500, balance: 0, progress: 55, topic: "Стереометрия", lessonsCompleted: 15 },
    { name: "Елена Соколова", subject: "Физика", goal: "Школьная программа", grade: "8 класс", price: 1600, balance: 3200, progress: 40, topic: "Тепловые явления", lessonsCompleted: 8 },
    { name: "Максим Лебедев", subject: "Математика", goal: "ЕГЭ база", grade: "11 класс", price: 1800, balance: 1800, progress: 65, topic: "Геометрия", lessonsCompleted: 20 },
    { name: "София Кузнецова", subject: "Информатика", goal: "Программирование", grade: "9 класс", price: 2000, balance: -2000, progress: 35, topic: "Python основы", lessonsCompleted: 10 },
  ];
  
  const insertedStudents = await db.insert(students).values(
    studentData.map(s => ({
      tutorId: tutor.id,
      name: s.name,
      subject: s.subject,
      goal: s.goal,
      grade: s.grade,
      pricePerLesson: s.price,
      balance: s.balance,
      progress: s.progress,
      curriculumTopic: s.topic,
      lessonsCompleted: s.lessonsCompleted,
      isActive: true,
      parentContact: `+7 (9${Math.floor(Math.random() * 90 + 10)}) ${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 90 + 10)}-${Math.floor(Math.random() * 90 + 10)}`,
      links: { zoom: "https://zoom.us/j/123456789", board: "https://miro.com/board/abc" },
    }))
  ).returning();
  
  console.log(`✅ Created ${insertedStudents.length} students`);
  
  const now = new Date();
  const lessonEntries: any[] = [];
  
  for (let i = 0; i < insertedStudents.length; i++) {
    const student = insertedStudents[i];
    for (let w = -8; w <= 4; w++) {
      const dayOffset = w * 7 + (i % 7);
      const lessonDate = setMinutes(setHours(addDays(now, dayOffset), 14 + (i % 6)), (i * 15) % 60);
      
      const isPast = lessonDate < now;
      const status = isPast ? (Math.random() > 0.15 ? "completed" : "cancelled") : "pending";
      const attendance = isPast && status === "completed" ? (Math.random() > 0.1 ? "attended" : "missed_paid") : undefined;
      
      lessonEntries.push({
        tutorId: tutor.id,
        studentId: student.id,
        scheduledAt: lessonDate,
        durationMinutes: [60, 90, 45][i % 3],
        topic: studentData[i].topic,
        status,
        attendance,
        rating: isPast && status === "completed" && Math.random() > 0.3 ? Math.floor(Math.random() * 2) + 4 : undefined,
        notes: isPast && status === "completed" ? "Хорошо поработали" : undefined,
      });
    }
  }
  
  await db.insert(lessons).values(lessonEntries);
  console.log(`✅ Created ${lessonEntries.length} lessons`);
  
  const paymentEntries: any[] = [];
  const methods = ["перевод", "карта", "наличные"];
  
  for (let i = 0; i < insertedStudents.length; i++) {
    const student = insertedStudents[i];
    for (let p = 0; p < 3 + Math.floor(Math.random() * 4); p++) {
      const paymentDate = subDays(now, Math.floor(Math.random() * 90));
      paymentEntries.push({
        tutorId: tutor.id,
        studentId: student.id,
        amount: studentData[i].price * (1 + Math.floor(Math.random() * 4)),
        method: methods[Math.floor(Math.random() * methods.length)],
        comment: p === 0 ? "Оплата за занятия" : undefined,
        createdAt: paymentDate,
      });
    }
  }
  
  await db.insert(payments).values(paymentEntries);
  console.log(`✅ Created ${paymentEntries.length} payments`);
  
  const homeworkEntries: any[] = [];
  const hwStatuses = ["assigned", "in_progress", "submitted", "reviewed"];
  
  for (let i = 0; i < insertedStudents.length; i++) {
    const student = insertedStudents[i];
    for (let h = 0; h < 2; h++) {
      homeworkEntries.push({
        tutorId: tutor.id,
        studentId: student.id,
        title: `Домашнее задание ${h + 1}: ${studentData[i].topic}`,
        description: `Решить задачи по теме "${studentData[i].topic}"`,
        completionPct: Math.floor(Math.random() * 100),
        status: hwStatuses[Math.floor(Math.random() * hwStatuses.length)],
        deadline: addDays(now, 7 - h * 14),
        taskIds: [],
        attachments: [],
      });
    }
  }
  
  await db.insert(homework).values(homeworkEntries);
  console.log(`✅ Created ${homeworkEntries.length} homework assignments`);
  
  console.log("\n🎉 Demo account created successfully!");
  console.log(`📧 Email: ${demoEmail}`);
  console.log(`🔑 Password: ${demoPassword}`);
}

seedDemo().then(() => process.exit(0)).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
