import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Client scoped to the calling user's access token — every query runs
 * through Postgres RLS as that user, never bypassing it. Use this for
 * anything that isn't explicitly a privileged/service operation.
 */
export function getUserClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Service-role client — bypasses RLS entirely. Only use for operations that
 * legitimately need to escape row ownership (e.g. reading a just-uploaded
 * exam video via a signed URL, calling the AI evaluation pipeline). Every
 * route using this MUST verify ownership itself before touching data.
 */
export const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Client with only the anon key, no user context — for signup/login/etc. */
export const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
