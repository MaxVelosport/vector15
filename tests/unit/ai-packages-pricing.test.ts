import { describe, it, expect } from "vitest";
import { findAiPackageOption } from "../../server/ai-packages-pricing";
import { AI_PACKAGE_OPTIONS } from "../../shared/schema";

describe("findAiPackageOption", () => {
  it("happy path: возвращает популярную опцию 150/249", () => {
    const result = findAiPackageOption(150, 249);
    expect(result).toBeDefined();
    expect(result?.label).toBe("150 запросов");
    expect(result?.popular).toBe(true);
  });

  it.each(AI_PACKAGE_OPTIONS)(
    "находит каталожную опцию credits=$credits price=$price",
    ({ credits, price, label }) => {
      const result = findAiPackageOption(credits, price);
      expect(result).toBeDefined();
      expect(result?.label).toBe(label);
    },
  );

  it("wrong credits: 151/249 → undefined", () => {
    expect(findAiPackageOption(151, 249)).toBeUndefined();
  });

  it("wrong price (security: клиент подменил цену): 150/1 → undefined", () => {
    expect(findAiPackageOption(150, 1)).toBeUndefined();
  });

  it("свопнутые credits/price (защита от регрессии): 249/150 → undefined", () => {
    // Если кто-то случайно поменяет порядок аргументов — поймает этот тест
    expect(findAiPackageOption(249, 150)).toBeUndefined();
  });

  it("edge: credits=0, price=0 → undefined", () => {
    expect(findAiPackageOption(0, 0)).toBeUndefined();
  });
});
