declare module "yookassa" {
  interface YooKassaConfig {
    shopId: string;
    secretKey: string;
  }

  interface Amount {
    value: string;
    currency: string;
  }

  interface Confirmation {
    type: string;
    return_url?: string;
    confirmation_url?: string;
  }

  interface CreatePaymentParams {
    amount: Amount;
    confirmation?: Partial<Confirmation>;
    description?: string;
    capture?: boolean;
    metadata?: Record<string, any>;
  }

  interface Payment {
    id: string;
    status: string;
    amount: Amount;
    confirmation?: Confirmation;
    metadata?: Record<string, any>;
  }

  class YooKassa {
    constructor(config: YooKassaConfig);
    createPayment(params: CreatePaymentParams, idempotenceKey: string): Promise<Payment>;
    getPayment(paymentId: string): Promise<Payment>;
  }

  export = YooKassa;
}
