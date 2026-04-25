import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { BUILTIN_SUPABASE_URL, BUILTIN_SUPABASE_ANON, BUILTIN_SUPABASE_SVC } from './builtin-config';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || BUILTIN_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || BUILTIN_SUPABASE_ANON;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || BUILTIN_SUPABASE_SVC;

const usingCustom = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

// Primary client uses service key for full database access
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Public client with anon key (for unauthenticated operations)
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

if (usingCustom) {
  console.log('[supabase] Connected using SUPABASE_SERVICE_KEY');
} else {
  console.log('[supabase] Connected using built-in config');
}
