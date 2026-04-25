import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Primary storage uses Supabase JS SDK (server/storage.ts).
// This pg pool is used only for schema migrations and seed scripts.
const dbUrl = process.env.DATABASE_URL || "";

export const pool = new Pool({ connectionString: dbUrl });
export const db = drizzle(pool, { schema });
