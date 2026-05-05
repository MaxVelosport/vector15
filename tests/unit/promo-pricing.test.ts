import { describe, it, expect } from "vitest";
import {
  validatePromoForScope,
  calculatePromoDiscountKop,
  type PromoCode,
} from "../../server/promo-pricing";

function makePromo(overrides: Partial<PromoCode> = {}): PromoCode {
  return {
    id: "promo-1",
    scope: "all",
    discountType: "percent",
    discountValue: 10,
    isActive: true,
    validFrom: null,
    validUntil: null,
    maxUses: null,
    usedCount: 0,
    ...overrides,
  };
}

describe("calculatePromoDiscountKop", () => {
  it("процент: 30% от 699 ₽ = 209.70 ₽ (округление вниз до копейки)", () => {
    // 699 ₽ = 69900 коп. 69900 × 30 / 100 = 20970 коп
    const result = calculatePromoDiscountKop(
      69900,
      { discountType: "percent", discountValue: 30 },
    );
    expect(result).toBe(20970);
  });

  it("процент: clampается к 0..100", () => {
    // discountValue: 150 (выше 100) → должно использоваться 100 → полная скидка
    expect(
      calculatePromoDiscountKop(
        69900,
        { discountType: "percent", discountValue: 150 },
      ),
    ).toBe(69900);
    // discountValue: -50 → 0 → нулевая скидка
    expect(
      calculatePromoDiscountKop(
        69900,
        { discountType: "percent", discountValue: -50 },
      ),
    ).toBe(0);
  });

  it("фиксированная: 100 ₽ скидка от 699 ₽ = 10000 коп", () => {
    expect(
      calculatePromoDiscountKop(
        69900,
        { discountType: "fixed", discountValue: 100 },
      ),
    ).toBe(10000);
  });

  it("фиксированная: скидка больше суммы ограничивается суммой", () => {
    // 1000 ₽ скидка на 699 ₽ → должна быть 699 ₽ = 69900 коп
    expect(
      calculatePromoDiscountKop(
        69900,
        { discountType: "fixed", discountValue: 1000 },
      ),
    ).toBe(69900);
  });
});

describe("validatePromoForScope", () => {
  const NOW = new Date("2026-05-05T12:00:00Z");

  it("успех: scope='all' проходит для любого target", () => {
    const result = validatePromoForScope(
      makePromo({ scope: "all" }),
      "ai_packages",
      false,
      NOW,
    );
    expect(result).toEqual({ ok: true });
  });

  it("успех: scope совпадает с target", () => {
    const result = validatePromoForScope(
      makePromo({ scope: "ai_packages" }),
      "ai_packages",
      false,
      NOW,
    );
    expect(result).toEqual({ ok: true });
  });

  it("отказ: not_applicable — scope не подходит", () => {
    const result = validatePromoForScope(
      makePromo({ scope: "subscription" }),
      "ai_packages",
      false,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "not_applicable" });
  });

  it("отказ: already_redeemed — пользователь уже использовал", () => {
    const result = validatePromoForScope(
      makePromo(),
      "ai_packages",
      true, // alreadyRedeemed
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "already_redeemed" });
  });

  it("отказ: inactive — промокод деактивирован", () => {
    const result = validatePromoForScope(
      makePromo({ isActive: false }),
      "ai_packages",
      false,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "inactive" });
  });

  it("отказ: not_yet_valid — validFrom в будущем", () => {
    const result = validatePromoForScope(
      makePromo({ validFrom: new Date("2026-06-01T00:00:00Z") }),
      "ai_packages",
      false,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "not_yet_valid" });
  });

  it("отказ: expired — validUntil в прошлом", () => {
    const result = validatePromoForScope(
      makePromo({ validUntil: new Date("2026-04-01T00:00:00Z") }),
      "ai_packages",
      false,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("отказ: max_uses_reached — лимит исчерпан", () => {
    const result = validatePromoForScope(
      makePromo({ maxUses: 100, usedCount: 100 }),
      "ai_packages",
      false,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "max_uses_reached" });
  });

  it("успех: maxUses=null — безлимитное использование", () => {
    const result = validatePromoForScope(
      makePromo({ maxUses: null, usedCount: 9999 }),
      "ai_packages",
      false,
      NOW,
    );
    expect(result).toEqual({ ok: true });
  });

  it("успех: validFrom/validUntil охватывают NOW", () => {
    const result = validatePromoForScope(
      makePromo({
        validFrom: new Date("2026-01-01T00:00:00Z"),
        validUntil: new Date("2026-12-31T23:59:59Z"),
      }),
      "ai_packages",
      false,
      NOW,
    );
    expect(result).toEqual({ ok: true });
  });
});
