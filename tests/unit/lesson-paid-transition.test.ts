import { describe, it, expect } from "vitest";

// Зеркало логики из server/routes.ts PATCH /api/lessons/:id — фикс #3
type LessonSnap = {
  status: string;
  attendance: string | null;
  durationMinutes: number;
  cancelAmount?: number | null;
};

function isPaidOutcome(status: string | null | undefined, attendance: string | null | undefined) {
  return (status === "completed" && attendance === "attended") ||
    (status === "cancelled" && attendance === "missed_paid");
}

function calcLessonCostSnap(lesson: LessonSnap, pricePerLesson: number): number {
  if (lesson.status === "cancelled" && lesson.attendance === "missed_paid") {
    return lesson.cancelAmount ?? 0;
  }
  return Math.round(pricePerLesson * lesson.durationMinutes / 60);
}

function applyBalanceDelta(
  currentBalance: number,
  oldLesson: LessonSnap,
  newLesson: LessonSnap,
  pricePerLesson: number
): number {
  const wasPaid = isPaidOutcome(oldLesson.status, oldLesson.attendance);
  const nowPaid = isPaidOutcome(newLesson.status, newLesson.attendance);

  if (nowPaid && !wasPaid) {
    return currentBalance - calcLessonCostSnap(newLesson, pricePerLesson);
  } else if (!nowPaid && wasPaid) {
    return currentBalance + calcLessonCostSnap(oldLesson, pricePerLesson);
  } else if (nowPaid && wasPaid) {
    const oldCost = calcLessonCostSnap(oldLesson, pricePerLesson);
    const newCost = calcLessonCostSnap(newLesson, pricePerLesson);
    return currentBalance - (newCost - oldCost);
  }
  return currentBalance;
}

describe("fix #3: переход paid→paid корректирует баланс", () => {
  it("pending → attended: списывается полная цена", () => {
    const bal = applyBalanceDelta(
      3000,
      { status: "pending", attendance: null, durationMinutes: 60 },
      { status: "completed", attendance: "attended", durationMinutes: 60 },
      1600
    );
    expect(bal).toBe(1400); // 3000 - 1600
  });

  it("attended → pending: восстанавливается полная цена", () => {
    const bal = applyBalanceDelta(
      0,
      { status: "completed", attendance: "attended", durationMinutes: 60 },
      { status: "pending", attendance: null, durationMinutes: 60 },
      1600
    );
    expect(bal).toBe(1600); // 0 + 1600
  });

  it("attended → cancelled+missed_paid: возврат 1600, списание штрафа 300 → итого +1300", () => {
    // До фикса: оба paid → ничего не происходило → баланс оставался -1600
    const bal = applyBalanceDelta(
      -1600, // было деducted при attended
      { status: "completed", attendance: "attended", durationMinutes: 60 },
      { status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: 300 },
      1600
    );
    // oldCost=1600, newCost=300, delta=300-1600=-1300
    // balance = -1600 - (-1300) = -300
    expect(bal).toBe(-300);
  });

  it("cancelled+missed_paid → attended: разница = полная цена − штраф", () => {
    // Штраф 300 уже был списан (баланс -300). Теперь переводим в attended.
    const bal = applyBalanceDelta(
      -300,
      { status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: 300 },
      { status: "completed", attendance: "attended", durationMinutes: 60 },
      1600
    );
    // oldCost=300, newCost=1600, delta=1300 → balance = -300 - 1300 = -1600
    expect(bal).toBe(-1600);
  });

  it("attended → cancelled+missed_paid с cancelAmount=null: возврат полной суммы (эффект +1600)", () => {
    const bal = applyBalanceDelta(
      -1600,
      { status: "completed", attendance: "attended", durationMinutes: 60 },
      { status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: null },
      1600
    );
    // newCost=0 (null), oldCost=1600, delta=-1600 → balance = -1600 - (-1600) = 0
    expect(bal).toBe(0);
  });

  it("одинаковый paid-статус без изменений: баланс не меняется", () => {
    const bal = applyBalanceDelta(
      500,
      { status: "completed", attendance: "attended", durationMinutes: 60 },
      { status: "completed", attendance: "attended", durationMinutes: 60 },
      1600
    );
    // oldCost=newCost=1600, delta=0
    expect(bal).toBe(500);
  });

  it("paid→paid с одинаковой стоимостью: баланс не меняется", () => {
    const bal = applyBalanceDelta(
      -300,
      { status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: 300 },
      { status: "cancelled", attendance: "missed_paid", durationMinutes: 60, cancelAmount: 300 },
      1600
    );
    expect(bal).toBe(-300);
  });

  it("pending → cancelled+missed: баланс не меняется (оба не-paid)", () => {
    const bal = applyBalanceDelta(
      1000,
      { status: "pending", attendance: null, durationMinutes: 60 },
      { status: "cancelled", attendance: "missed", durationMinutes: 60 },
      1600
    );
    expect(bal).toBe(1000);
  });
});
