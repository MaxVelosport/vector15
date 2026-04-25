import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";

interface MockPayment {
  id: string;
  tutorId: string;
  studentId: string;
  amount: number;
  status: string;
  yookassaStatus?: string;
}

function createPaymentsApp(opts: {
  payments?: MockPayment[];
  isAdmin?: boolean;
} = {}) {
  const payments = opts.payments ?? [];
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false },
    })
  );

  // Симуляция авторизации репетитора
  app.use((req: any, _res, next) => {
    req.session.tutorId = "tutor-1";
    req.session.isAdmin = opts.isAdmin ?? false;
    next();
  });

  function requireAdmin(req: any, res: any, next: any) {
    if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });
    next();
  }

  // POST /api/payments — создание платежа (валидация)
  app.post("/api/payments", (req: any, res: any) => {
    const { studentId, amount, type } = req.body;
    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ error: "studentId обязателен" });
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Сумма должна быть положительной" });
    }
    if (amount > 1_000_000) {
      return res.status(400).json({ error: "Сумма слишком большая" });
    }
    const validTypes = ["lesson", "package", "refund", "manual"];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: "Неверный тип платежа" });
    }
    const payment: MockPayment = {
      id: `pay-${payments.length + 1}`,
      tutorId: req.session.tutorId,
      studentId,
      amount,
      status: "completed",
    };
    payments.push(payment);
    res.status(201).json(payment);
  });

  // POST /api/admin/payments/:id/refund — возврат
  app.post("/api/admin/payments/:id/refund", requireAdmin, (req: any, res: any) => {
    const payment = payments.find((p) => p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: "Платёж не найден" });
    if (payment.yookassaStatus === "refunded") {
      return res.status(400).json({ error: "Платёж уже возвращён" });
    }
    const amount = req.body?.amount ?? payment.amount;
    if (amount > payment.amount) {
      return res.status(400).json({ error: "Сумма возврата больше платежа" });
    }
    payment.yookassaStatus = "refunded";
    res.json({ success: true, refund: { id: `ref-${payment.id}`, amount } });
  });

  return { app, payments };
}

describe("POST /api/payments", () => {
  it("возвращает 400 без studentId", async () => {
    const { app } = createPaymentsApp();
    const r = await request(app).post("/api/payments").send({ amount: 1500 });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/studentId/);
  });

  it("возвращает 400 при отрицательной сумме", async () => {
    const { app } = createPaymentsApp();
    const r = await request(app).post("/api/payments").send({ studentId: "s1", amount: -100 });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/положительной/);
  });

  it("возвращает 400 при сумме > 1 000 000", async () => {
    const { app } = createPaymentsApp();
    const r = await request(app).post("/api/payments").send({ studentId: "s1", amount: 9_999_999 });
    expect(r.status).toBe(400);
  });

  it("возвращает 400 при неверном type", async () => {
    const { app } = createPaymentsApp();
    const r = await request(app)
      .post("/api/payments")
      .send({ studentId: "s1", amount: 1500, type: "hack" });
    expect(r.status).toBe(400);
  });

  it("создаёт платёж при корректных данных", async () => {
    const { app, payments } = createPaymentsApp();
    const r = await request(app)
      .post("/api/payments")
      .send({ studentId: "s1", amount: 1500, type: "lesson" });
    expect(r.status).toBe(201);
    expect(r.body.id).toBeTruthy();
    expect(payments).toHaveLength(1);
  });
});

describe("POST /api/admin/payments/:id/refund", () => {
  it("403 для не-админа", async () => {
    const { app } = createPaymentsApp({
      payments: [{ id: "pay-1", tutorId: "t", studentId: "s", amount: 1500, status: "completed" }],
      isAdmin: false,
    });
    const r = await request(app).post("/api/admin/payments/pay-1/refund").send({});
    expect(r.status).toBe(403);
  });

  it("404 если платёж не найден", async () => {
    const { app } = createPaymentsApp({ isAdmin: true });
    const r = await request(app).post("/api/admin/payments/nope/refund").send({});
    expect(r.status).toBe(404);
  });

  it("блокирует двойной возврат", async () => {
    const { app } = createPaymentsApp({
      payments: [
        {
          id: "pay-1",
          tutorId: "t",
          studentId: "s",
          amount: 1500,
          status: "completed",
          yookassaStatus: "refunded",
        },
      ],
      isAdmin: true,
    });
    const r = await request(app).post("/api/admin/payments/pay-1/refund").send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/уже возвращ/);
  });

  it("отклоняет возврат больше суммы", async () => {
    const { app } = createPaymentsApp({
      payments: [{ id: "pay-1", tutorId: "t", studentId: "s", amount: 1500, status: "completed" }],
      isAdmin: true,
    });
    const r = await request(app)
      .post("/api/admin/payments/pay-1/refund")
      .send({ amount: 9999 });
    expect(r.status).toBe(400);
  });

  it("успешно возвращает платёж", async () => {
    const { app, payments } = createPaymentsApp({
      payments: [{ id: "pay-1", tutorId: "t", studentId: "s", amount: 1500, status: "completed" }],
      isAdmin: true,
    });
    const r = await request(app).post("/api/admin/payments/pay-1/refund").send({ amount: 1500 });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(payments[0].yookassaStatus).toBe("refunded");
  });
});
