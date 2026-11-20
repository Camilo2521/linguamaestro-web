import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

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
 * legitimately need to escape row ownership (e.g. reading a signed storage
 * URL on a user's behalf). No current route uses this — its one caller was
 * the exam-evaluation pipeline, removed along with the rest of the oral-exam
 * feature. Every route using this MUST verify ownership itself before
 * touching data.
 *
 * Created lazily so deployments that don't need it never have to hold the
 * service-role key (SUPABASE_SERVICE_ROLE_KEY is optional).
 */
let serviceClient: SupabaseClient | null = null;
export function getServiceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  serviceClient ??= createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return serviceClient;
}

/** Client with only the anon key, no user context — for signup/login/etc. */
export const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
