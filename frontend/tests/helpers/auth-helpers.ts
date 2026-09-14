import { vi } from 'vitest';
import { makeUser } from '../fixtures/users';
import type { UserProfile } from '@/types/domain.types';

interface MockSupabaseOptions {
  user?: UserProfile | null;
  tables?: Record<string, { data?: unknown; error?: { message: string } | null }>;
}

/**
 * Creates a chainable Supabase mock that covers the common builder pattern:
 * supabase.from('table').select(...).eq(...).single() → resolves to configured data.
 *
 * Each table entry can be configured with { data, error }.
 * Unspecified tables default to { data: null, error: null }.
 */
export function createSupabaseMock(opts: MockSupabaseOptions = {}) {
  const user = opts.user !== undefined ? opts.user : makeUser();
  const tables = opts.tables ?? {};

  function makeQueryBuilder(table: string) {
    const cfg = tables[table] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};

    const chain = () => builder;
    builder['select'] = vi.fn().mockReturnValue(builder);
    builder['insert'] = vi.fn().mockResolvedValue(cfg);
    builder['update'] = vi.fn().mockReturnValue(builder);
    builder['upsert'] = vi.fn().mockResolvedValue(cfg);
    builder['eq'] = vi.fn().mockReturnValue(builder);
    builder['neq'] = vi.fn().mockReturnValue(builder);
    builder['gte'] = vi.fn().mockReturnValue(builder);
    builder['lte'] = vi.fn().mockReturnValue(builder);
    builder['order'] = vi.fn().mockReturnValue(builder);
    builder['limit'] = vi.fn().mockReturnValue(builder);
    builder['single'] = vi.fn().mockResolvedValue(cfg);
    // Awaiting the builder itself (e.g. after .select().eq()) returns the data
    builder['then'] = (resolve: (v: unknown) => void) => Promise.resolve(cfg).then(resolve);

    void chain; // suppress unused warning
    return builder;
  }

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: user ? { id: user.id, email: user.email } : null },
        error: null,
      }),
    },
    from: vi.fn((table: string) => makeQueryBuilder(table)),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return supabase;
}

/** Wire a mock supabase client into the module mock for @/lib/supabase/server. */
export function mockServerClient(opts: MockSupabaseOptions = {}) {
  const client = createSupabaseMock(opts);
  vi.mock('@/lib/supabase/server', () => ({
    createServerClient: vi.fn().mockResolvedValue(client),
  }));
  return client;
}
