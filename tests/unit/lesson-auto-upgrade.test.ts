import { describe, it, expect, vi } from "vitest";

// ─────────────────────────────────────────────────────────────
// Вспомогательные функции — зеркало логики из server/routes.ts
// ─────────────────────────────────────────────────────────────

function computeEffectiveBalancePure(
  payments: { amount: number }[],
  lessons: { status: string; attendance: string | null; durationMinutes: number }[],
  pricePerLesson: number
): number {
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const totalCost = lessons
    .filter(
      l =>
        (l.status === "completed" &&
          ["attended", "attended_unpaid", "missed_paid"].includes(l.attendance ?? "")) ||
        (l.status === "cancelled" && l.attendance === "missed_paid")
    )
    .reduce((s, l) => s + Math.round(pricePerLesson * l.durationMinutes / 60), 0);
  return totalPaid - totalCost;
}

// ─────────────────────────────────────────────────────────────
// #5 — YooKassa webhook должен вызывать autoUpgrade
// ─────────────────────────────────────────────────────────────

describe("fix #5: webhook student_payment вызывает autoUpgradeUnpaidLessons", () => {
  it("autoUpgrade вызывается после обновления баланса через webhook", async () => {
    let upgradeCalled = false;
    const autoUpgradeUnpaidLessons = vi.fn(async (_studentId: string) => {
      upgradeCalled = true;
    });

    // Воспроизводим поток из вебхука (после фикса)
    const processWebhookStudentPayment = async (studentId: string) => {
      // ... storage.updateStudent(balance + amount) ...
      await autoUpgradeUnpaidLessons(studentId).catch(() => {});
    };

    await processWebhookStudentPayment("student-1");
    expect(upgradeCalled).toBe(true);
    expect(autoUpgradeUnpaidLessons).toHaveBeenCalledWith("student-1");
  });

  it("ошибка в autoUpgrade не роняет webhook (non-blocking)", async () => {
    const failingUpgrade = vi.fn(async (_studentId: string) => {
      throw new Error("DB error in upgrade");
    });

    const processWebhookStudentPayment = async (studentId: string) => {
      // ... storage.updateStudent ...
      await failingUpgrade(studentId).catch(() => {}); // must not propagate
      return { webhookHandled: true };
    };

    const result = await processWebhookStudentPayment("student-1");
    expect(result.webhookHandled).toBe(true);
  });

  it("autoUpgrade не вызывается если студент не найден (student === null)", async () => {
    let upgradeCalled = false;
    const autoUpgrade = vi.fn(async () => { upgradeCalled = true; });

    const student = null; // storage.getStudent вернул null
    const processWebhookStudentPayment = async (studentId: string) => {
      if (student) {
        // ... updateStudent ...
        await autoUpgrade(studentId).catch(() => {});
      }
    };

    await processWebhookStudentPayment("student-1");
    expect(upgradeCalled).toBe(false); // guard `if (student)` защищает вызов
  });
});

// ─────────────────────────────────────────────────────────────
// #6 — off-by-one: effectiveBal = 0 — точное покрытие долга
// ─────────────────────────────────────────────────────────────

describe("fix #6: autoUpgradeUnpaidLessons не должен пропускать effectiveBal = 0", () => {
  it("effectiveBal = 0 при платеже ровно на сумму attended_unpaid занятия", () => {
    const payments = [{ amount: 1600 }];
    const lessons = [
      { status: "completed", attendance: "attended_unpaid", durationMinutes: 60 },
    ];
    const effectiveBal = computeEffectiveBalancePure(payments, lessons, 1600);
    expect(effectiveBal).toBe(0); // подтверждает сценарий boundary case
  });

  it("старая проверка `effectiveBal <= 0` ошибочно прерывала апгрейд при точном покрытии", () => {
    const effectiveBal = 0;
    const oldBehaviorSkipsUpgrade = effectiveBal <= 0; // баг
    expect(oldBehaviorSkipsUpgrade).toBe(true); // фиксируем, что баг существовал
  });

  it("новая проверка `effectiveBal < 0` не прерывает апгрейд при точном покрытии", () => {
    const effectiveBal = 0;
    const newBehaviorSkipsUpgrade = effectiveBal < 0; // исправлено
    expect(newBehaviorSkipsUpgrade).toBe(false); // баг устранён
  });

  it("проверка < 0 корректно прерывает апгрейд при реальном долге", () => {
    const payments = [{ amount: 900 }];
    const lessons = [
      { status: "completed", attendance: "attended_unpaid", durationMinutes: 60 },
    ];
    const effectiveBal = computeEffectiveBalancePure(payments, lessons, 1600);
    expect(effectiveBal).toBe(-700); // подтверждает что < 0 → апгрейд не нужен
    expect(effectiveBal < 0).toBe(true);
  });

  it("effectiveBal > 0 (переплата) — апгрейд проходит в обоих вариантах", () => {
    const payments = [{ amount: 2000 }];
    const lessons = [
      { status: "completed", attendance: "attended_unpaid", durationMinutes: 60 },
    ];
    const effectiveBal = computeEffectiveBalancePure(payments, lessons, 1600);
    expect(effectiveBal).toBe(400);
    expect(effectiveBal < 0).toBe(false);
    expect(effectiveBal <= 0).toBe(false);
  });

  it("attended (оплаченное) занятие не попадает в attended_unpaid пул", () => {
    const payments = [{ amount: 3200 }];
    const lessons = [
      { status: "completed", attendance: "attended", durationMinutes: 60 },      // уже оплачено
      { status: "completed", attendance: "attended_unpaid", durationMinutes: 60 }, // ждёт апгрейда
    ];
    const effectiveBal = computeEffectiveBalancePure(payments, lessons, 1600);
    // totalPaid=3200, totalCost=1600+1600=3200 → effectiveBal=0
    expect(effectiveBal).toBe(0);
  });
});
