import { describe, it, expect } from "vitest";

// ─── YouTube embed URL parsing ────────────────────────────────────────────────
// Extracted from client/src/pages/tutor-public.tsx to test as pure function

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes("youtube.com")) {
      videoId = u.searchParams.get("v");
    } else if (u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1);
    }
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    // ignore
  }
  return null;
}

describe("getYoutubeEmbedUrl", () => {
  it("parses standard youtube.com watch URL", () => {
    const result = getYoutubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("parses youtu.be short URL", () => {
    const result = getYoutubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(result).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("parses youtube.com URL with extra params", () => {
    const result = getYoutubeEmbedUrl("https://www.youtube.com/watch?v=abc123&t=30s&list=PLxxx");
    expect(result).toBe("https://www.youtube.com/embed/abc123");
  });

  it("returns null for non-YouTube URL", () => {
    expect(getYoutubeEmbedUrl("https://vimeo.com/123456")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getYoutubeEmbedUrl("")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(getYoutubeEmbedUrl("not a url at all")).toBeNull();
  });

  it("returns null for youtube.com without v param", () => {
    expect(getYoutubeEmbedUrl("https://www.youtube.com/channel/UCxxx")).toBeNull();
  });
});

// ─── Money formatter ──────────────────────────────────────────────────────────

function moneyRub(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

describe("moneyRub", () => {
  it("formats 1800 as RUB", () => {
    const result = moneyRub(1800);
    expect(result).toContain("1");
    expect(result).toContain("800");
    expect(result).toContain("₽");
  });

  it("formats zero", () => {
    const result = moneyRub(0);
    expect(result).toContain("₽");
  });

  it("formats large number", () => {
    const result = moneyRub(100000);
    expect(result).toContain("100");
    expect(result).toContain("₽");
  });
});

// ─── Public slug validation ───────────────────────────────────────────────────

const PUBLIC_SLUG_REGEX = /^[a-z0-9-]{3,30}$/;

describe("publicSlug validation regex", () => {
  it("accepts lowercase letters", () => {
    expect(PUBLIC_SLUG_REGEX.test("anna-petrova")).toBe(true);
  });

  it("accepts letters and numbers", () => {
    expect(PUBLIC_SLUG_REGEX.test("tutor123")).toBe(true);
  });

  it("accepts hyphens", () => {
    expect(PUBLIC_SLUG_REGEX.test("anna-math-tutor")).toBe(true);
  });

  it("rejects uppercase letters", () => {
    expect(PUBLIC_SLUG_REGEX.test("AnnaPetrova")).toBe(false);
  });

  it("rejects spaces", () => {
    expect(PUBLIC_SLUG_REGEX.test("anna petrova")).toBe(false);
  });

  it("rejects too short (< 3 chars)", () => {
    expect(PUBLIC_SLUG_REGEX.test("ab")).toBe(false);
  });

  it("rejects too long (> 30 chars)", () => {
    expect(PUBLIC_SLUG_REGEX.test("a".repeat(31))).toBe(false);
  });

  it("accepts exactly 3 chars", () => {
    expect(PUBLIC_SLUG_REGEX.test("abc")).toBe(true);
  });

  it("accepts exactly 30 chars", () => {
    expect(PUBLIC_SLUG_REGEX.test("a".repeat(30))).toBe(true);
  });

  it("rejects special characters", () => {
    expect(PUBLIC_SLUG_REGEX.test("anna@petrova")).toBe(false);
    expect(PUBLIC_SLUG_REGEX.test("anna_petrova")).toBe(false);
    expect(PUBLIC_SLUG_REGEX.test("anna.petrova")).toBe(false);
  });
});

// ─── WhatsApp link normalization ──────────────────────────────────────────────

function normalizeWhatsappNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

describe("WhatsApp number normalization", () => {
  it("removes non-digit characters from phone number", () => {
    expect(normalizeWhatsappNumber("+7 (999) 123-45-67")).toBe("79991234567");
  });

  it("handles clean number", () => {
    expect(normalizeWhatsappNumber("79991234567")).toBe("79991234567");
  });

  it("removes spaces", () => {
    expect(normalizeWhatsappNumber("+7 999 123 45 67")).toBe("79991234567");
  });
});

// ─── Color theme map ──────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { gradient: string }> = {
  violet: { gradient: "from-violet-600 via-purple-600 to-indigo-700" },
  blue: { gradient: "from-blue-600 via-blue-700 to-indigo-700" },
  emerald: { gradient: "from-emerald-500 via-teal-600 to-cyan-700" },
  rose: { gradient: "from-rose-500 via-pink-600 to-fuchsia-700" },
  amber: { gradient: "from-amber-500 via-orange-500 to-orange-600" },
  slate: { gradient: "from-slate-700 via-slate-700 to-gray-800" },
};

describe("COLOR_MAP", () => {
  it("has all 6 color themes", () => {
    expect(Object.keys(COLOR_MAP)).toHaveLength(6);
  });

  it("has violet as a color", () => {
    expect(COLOR_MAP.violet).toBeDefined();
    expect(COLOR_MAP.violet.gradient).toContain("violet");
  });

  it("has no undefined values", () => {
    for (const color of Object.values(COLOR_MAP)) {
      expect(color.gradient).toBeTruthy();
    }
  });

  it("falls back to violet for unknown color", () => {
    const color = "unknown-color";
    const resolved = COLOR_MAP[color] ?? COLOR_MAP.violet;
    expect(resolved.gradient).toContain("violet");
  });
});
