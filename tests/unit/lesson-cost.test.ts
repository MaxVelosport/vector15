import { describe, it, expect } from "vitest";

// Зеркало логики из server/routes.ts computeEffectiveBalance
// и client/src/pages/finance.tsx calcLessonCost — после фикса #1
function calcLessonCostFixed(
  lesson: { status: string; attendance: string | null; durationMinutes: number; cancelAmount?: number | null },
  pricePerLesson: number
): number {
  if (lesson.status === "cancelled" && lesson.attendance === "missed_paid") {
    return lesson.cancelAmount ?? 0;
  }
  const dur = lesson.durationMinutes || 60;
  return Math.round(pricePerLesson * dur / 60);
}

function computeEffectiveBalanceFixed(
  payments: { amount: number }[],
  lessons: { status: string; attendance: string | null; durationMinutes: number; cancelAmount?: number | null }[],
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
    .reduce((sum, l) => sum + calcLessonCostFixed(l, pricePerLesson), 0);
  return totalPaid - totalCost;
}

describe("fix #1: calcLessonCost корректно обрабатывает missed_paid", () => {
  it("completed+attended → полная цена", () => {
    expect(calcLessonCostFixed({ status: "completed", attendance: "attended", durationMinutes: 60 }, 1600)).toBe(1600);
  });

  it("completed+attended, 90 мин → пропорционально", () => {
    expect(calcLessonCostFixed({ status: "completed", attendance: "attended", durationMinutes: 90 }, 1600)).toBe(2400);
  });

  it("completed+attended_unpaid → полная цена (штрафа нет, урок прошёл)", () => {
    expect(calcLessonCostFixed({ status: "completed", attendance: "attended_unpaid", durationMinutes: 60 }, 1600)).toBe(1600);
  });

  it("cancelled+missed_paid с cancelAmount=300 → только штраф (не 1600!)", () => {
    expect(calcLessonCostFixed({ status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: 300 }, 1600)).toBe(300);
  });

  it("cancelled+missed_paid с cancelAmount=null → 0 (fallback)", () => {
    expect(calcLessonCostFixed({ status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: null }, 1600)).toBe(0);
  });

  it("cancelled+missed_paid с cancelAmount=0 → 0", () => {
    expect(calcLessonCostFixed({ status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: 0 }, 1600)).toBe(0);
  });

  // Примечание: calcLessonCost вызывается только для billable-уроков (после isBillable-фильтра).
  // cancelled+missed и pending отсекаются фильтром до вызова функции — тестировать их здесь не нужно.
});

describe("fix #1: computeEffectiveBalance учитывает cancelAmount для missed_paid", () => {
  it("attended урок: эффективный баланс = платёж − полная цена", () => {
    const bal = computeEffectiveBalanceFixed(
      [{ amount: 1600 }],
      [{ status: "completed", attendance: "attended", durationMinutes: 60 }],
      1600
    );
    expect(bal).toBe(0);
  });

  it("cancelled+missed_paid: эффективный баланс использует cancelAmount, не полную цену", () => {
    // Платёж 1600, штраф отмены 300 → баланс должен быть 1300, а не 0
    const bal = computeEffectiveBalanceFixed(
      [{ amount: 1600 }],
      [{ status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: 300 }],
      1600
    );
    expect(bal).toBe(1300); // было: 0 (ошибочно считало по полной цене)
  });

  it("cancelled+missed_paid с cancelAmount=null: баланс = полная сумма платежа", () => {
    const bal = computeEffectiveBalanceFixed(
      [{ amount: 1600 }],
      [{ status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: null }],
      1600
    );
    expect(bal).toBe(1600); // штрафа нет → ничего не списано
  });

  it("смешанный сценарий: attended + cancelled+missed_paid со штрафом", () => {
    // Платёж: 3000. Урок 1 (attended, 1600). Урок 2 (cancelled, штраф 300).
    // Ожидаемый баланс: 3000 - 1600 - 300 = 1100
    const bal = computeEffectiveBalanceFixed(
      [{ amount: 3000 }],
      [
        { status: "completed", attendance: "attended", durationMinutes: 60 },
        { status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: 300 },
      ],
      1600
    );
    expect(bal).toBe(1100);
  });

  it("бесплатная отмена (missed) не уменьшает баланс", () => {
    const bal = computeEffectiveBalanceFixed(
      [{ amount: 1600 }],
      [{ status: "cancelled", attendance: "missed", durationMinutes: 60 }],
      1600
    );
    expect(bal).toBe(1600);
  });
});
