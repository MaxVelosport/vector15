// Russian plural helper. Returns the correct form for [1, 2..4, 5+]-style words.
// Usage: pluralRu(n, ["день", "дня", "дней"])
export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

export const trialDaysWord = (n: number) => pluralRu(n, ["день", "дня", "дней"]);
