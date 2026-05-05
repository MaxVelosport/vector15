// Pure function для валидации пакета ИИ.
// Защита от подмены цены клиентом: опция в каталоге должна совпадать
// и по credits, и по price одновременно. Используется в /api/ai-packages/purchase
// и в webhook-обработчике после payment.succeeded.

import { AI_PACKAGE_OPTIONS } from "../shared/schema";

export type AiPackageOption = (typeof AI_PACKAGE_OPTIONS)[number];

export function findAiPackageOption(
  credits: number,
  price: number,
): AiPackageOption | undefined {
  return AI_PACKAGE_OPTIONS.find(
    (o) => o.credits === credits && o.price === price,
  );
}
