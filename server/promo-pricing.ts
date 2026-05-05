// Pure functions для валидации промокодов и расчёта скидок.
// Извлечено из routes.ts для тестируемости. Поведение идентично оригинальному коду.

export type PromoCode = {
  id: string;
  scope: 'all' | 'ai_packages' | 'subscription' | 'lessons';
  discountType: 'percent' | 'fixed';
  discountValue: number;
  isActive: boolean;
  validFrom: Date | string | null;
  validUntil: Date | string | null;
  maxUses: number | null;
  usedCount: number;
};

export type PromoValidationReason =
  | 'not_applicable'
  | 'already_redeemed'
  | 'inactive'
  | 'not_yet_valid'
  | 'expired'
  | 'max_uses_reached';

export type PromoValidationResult =
  | { ok: true }
  | { ok: false; reason: PromoValidationReason };

export function validatePromoForScope(
  promo: PromoCode,
  targetScope: 'ai_packages' | 'subscription' | 'lessons',
  alreadyRedeemed: boolean,
  now: Date = new Date(),
): PromoValidationResult {
  if (promo.scope !== 'all' && promo.scope !== targetScope) {
    return { ok: false, reason: 'not_applicable' };
  }
  if (alreadyRedeemed) {
    return { ok: false, reason: 'already_redeemed' };
  }
  if (!promo.isActive) {
    return { ok: false, reason: 'inactive' };
  }
  if (promo.validFrom && new Date(promo.validFrom).getTime() > now.getTime()) {
    return { ok: false, reason: 'not_yet_valid' };
  }
  if (promo.validUntil && new Date(promo.validUntil).getTime() < now.getTime()) {
    return { ok: false, reason: 'expired' };
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { ok: false, reason: 'max_uses_reached' };
  }
  return { ok: true };
}

export function calculatePromoDiscountKop(
  amountKop: number,
  promo: Pick<PromoCode, 'discountType' | 'discountValue'>,
): number {
  if (promo.discountType === 'percent') {
    const pct = Math.max(0, Math.min(100, Number(promo.discountValue) || 0));
    return Math.floor((amountKop * pct) / 100);
  }
  return Math.min(amountKop, Math.floor(Number(promo.discountValue) * 100));
}
