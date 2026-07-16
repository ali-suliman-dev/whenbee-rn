import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isExpoGo } from '@/src/lib/isExpoGo';

let client: SupabaseClient | null | undefined;

/**
 * Memoized Supabase client for feedback. Returns null in Expo Go or when the
 * env vars are absent, so callers degrade gracefully (never throw at import).
 * Uses the anon/publishable key only — RLS is the security boundary.
 */
export function getFeedbackClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (isExpoGo || !url || !key) {
    client = null;
    return client;
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
