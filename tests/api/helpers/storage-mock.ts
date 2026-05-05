import { vi } from 'vitest';

interface ProcessedEvent {
  eventId: string;
  source: string;
  processedAt: Date;
}

interface PromoCode {
  id: string;
  code: string;
  scope: 'all' | 'ai_packages' | 'subscription' | 'lessons';
  discountType: 'percent' | 'fixed';
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  validFrom: Date | string | null;
  validUntil: Date | string | null;
}

interface Redemption {
  id: string;
  promoCodeId: string;
  userId: string;
}

interface InitialData {
  promoCodes?: PromoCode[];
  tutors?: Array<{
    id: string;
    email: string;
    password?: string;
    name?: string;
    isBlocked?: boolean;
    twoFactorEnabled?: boolean;
    subscription?: any;
    isAdmin?: boolean;
  }>;
  payments?: Array<any>;
}

export function createInMemoryStorage(initialData: InitialData = {}) {
  const processedEvents: ProcessedEvent[] = [];
  const promoCodes = [...(initialData.promoCodes || [])];
  const redemptions: Redemption[] = [];
  const tutors = [...(initialData.tutors || [])];
  const payments = [...(initialData.payments || [])];

  let redemptionCounter = 0;

  return {
    // Webhook идемпотентность — CAS-семантика
    tryMarkWebhookEventProcessed: vi.fn(
      async (eventId: string, source: string = 'yookassa'): Promise<boolean> => {
        const exists = processedEvents.some(
          (e) => e.eventId === eventId && e.source === source,
        );
        if (exists) return false;
        processedEvents.push({ eventId, source, processedAt: new Date() });
        return true;
      },
    ),

    // Промокоды
    getPromoCodeByCode: vi.fn(async (code: string) => {
      return (
        promoCodes.find((p) => p.code.toLowerCase() === code.toLowerCase()) ||
        null
      );
    }),
    hasUserRedeemed: vi.fn(
      async (promoCodeId: string, userId: string): Promise<boolean> => {
        return redemptions.some(
          (r) => r.promoCodeId === promoCodeId && r.userId === userId,
        );
      },
    ),
    createPromoRedemption: vi.fn(
      async (data: { promoCodeId: string; userId: string }) => {
        redemptionCounter += 1;
        const redemption = { id: `red_${redemptionCounter}`, ...data };
        redemptions.push(redemption);
        return redemption;
      },
    ),
    incrementPromoCodeUse: vi.fn(async (id: string) => {
      const code = promoCodes.find((p) => p.id === id);
      if (code) code.usedCount += 1;
      return code;
    }),

    // Tutors
    getTutorByEmail: vi.fn(async (email: string) => {
      return (
        tutors.find((t) => t.email.toLowerCase() === email.toLowerCase()) ||
        undefined
      );
    }),
    getTutor: vi.fn(async (id: string) => {
      return tutors.find((t) => t.id === id) || undefined;
    }),

    // Хелперы для assertions в тестах (не из реального storage)
    _getProcessedEvents: () => [...processedEvents],
    _getRedemptions: () => [...redemptions],
    _getPromoCodes: () => [...promoCodes],
    _getPayments: () => [...payments],
  };
}

export type InMemoryStorage = ReturnType<typeof createInMemoryStorage>;
