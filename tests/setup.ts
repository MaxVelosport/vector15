import { vi } from "vitest";

vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("SUPABASE_KEY", "test-key");
vi.stubEnv("SESSION_SECRET", "test-session-secret");
vi.stubEnv("NODE_ENV", "test");
