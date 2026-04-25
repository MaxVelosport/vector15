import { storage } from "./storage";
import { hashPassword } from "./auth";

async function seed() {
  console.log("Seeding database...");

  // Создаём админа
  const adminEmail = "admin@vector.test";
  const existingAdmin = await storage.getTutorByEmail(adminEmail);
  
  if (!existingAdmin) {
    const adminPassword = await hashPassword("admin123");
    const admin = await storage.createTutor({
      email: adminEmail,
      password: adminPassword,
      name: "Администратор",
      subjects: ["Математика", "Физика"],
      basePrice: 2000,
      timezone: "Europe/Moscow",
      subscription: "premium",
      subscriptionUntil: new Date("2027-12-31"),
      isAdmin: true,
    });
    console.log(`✓ Админ создан: ${admin.email}`);
  } else {
    console.log(`✓ Админ уже существует: ${adminEmail}`);
  }

  // Создаём демо-репетитора
  const tutorEmail = "tutor@vector.test";
  const existingTutor = await storage.getTutorByEmail(tutorEmail);
  
  if (!existingTutor) {
    const tutorPassword = await hashPassword("tutor123");
    const tutor = await storage.createTutor({
      email: tutorEmail,
      password: tutorPassword,
      name: "Иван Петров",
      subjects: ["Математика", "Русский язык"],
      basePrice: 1600,
      timezone: "Europe/Moscow",
      subscription: "free",
      subscriptionUntil: null,
      isAdmin: false,
    });
    console.log(`✓ Репетитор создан: ${tutor.email}`);

    // Добавим 2 учеников для демо
    const student1 = await storage.createStudent({
      tutorId: tutor.id,
      name: "Алина К.",
      subject: "Математика",
      goal: "ЕГЭ",
      grade: "11 класс",
      pricePerLesson: 1800,
      balance: 1200,
      parentContact: "+7 (999) 111-22-33",
      links: { zoom: "https://zoom.us/j/123", board: "https://miro.com/app/board/uX" },
      isActive: true,
      progress: 64,
      curriculumTopic: "Производная и её приложения",
    });
    console.log(`✓ Ученик создан: ${student1.name}`);

    const student2 = await storage.createStudent({
      tutorId: tutor.id,
      name: "Даниил С.",
      subject: "Физика",
      goal: "ОГЭ",
      grade: "9 класс",
      pricePerLesson: 1500,
      balance: -1500,
      parentContact: "+7 (999) 555-66-77",
      links: { zoom: "https://zoom.us/j/456", board: "https://miro.com/app/board/uY" },
      isActive: true,
      progress: 38,
      curriculumTopic: "Законы Ньютона",
    });
    console.log(`✓ Ученик создан: ${student2.name}`);

    // Добавим занятие
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0, 0);
    
    const lesson = await storage.createLesson({
      tutorId: tutor.id,
      studentId: student1.id,
      scheduledAt: today,
      durationMinutes: 60,
      topic: "Производная: экстремумы функций",
      status: "pending",
    });
    console.log(`✓ Занятие создано: ${lesson.topic}`);

    // Добавим оплату
    const payment = await storage.createPayment({
      tutorId: tutor.id,
      studentId: student1.id,
      amount: 3000,
      method: "перевод",
      comment: "Оплата за 2 занятия",
    });
    console.log(`✓ Платёж создан: ${payment.amount} ₽`);

    // Обновим баланс
    await storage.updateStudent(student1.id, {
      balance: student1.balance + payment.amount,
    });

    // Добавим задания
    const task1 = await storage.createTask({
      tutorId: tutor.id,
      topic: "Производная",
      difficulty: "medium",
      task: "Найдите производную функции f(x)= (x^2+1)/(x−1).",
      solution: "Используем правило производной частного: f' = [(2x)(x−1) − (x^2+1)·1] /(x−1)^2.",
      answer: "f'(x) = (x^2 − 2x − 1)/(x−1)^2",
    });
    console.log(`✓ Задание создано: ${task1.topic}`);

  } else {
    console.log(`✓ Репетитор уже существует: ${tutorEmail}`);
  }

  console.log("\nSeed завершён!");
  console.log("\nДля входа используйте:");
  console.log("  Админ:      admin@vector.test / admin123");
  console.log("  Репетитор:  tutor@vector.test / tutor123");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Ошибка seed:", err);
  process.exit(1);
});
