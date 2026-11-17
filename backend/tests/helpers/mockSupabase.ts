import { vi } from 'vitest';

/** A chainable Supabase query-builder stub. Each method returns itself so
 * calls can be chained arbitrarily (`.select().eq().single()`), and the
 * chain resolves via `then` when finally awaited — matching how the real
 * postgrest-js builder behaves. */
export function makeQueryBuilder(resolved: { data: unknown; error: unknown } = { data: null, error: null }) {
  const builder: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'upsert', 'eq', 'is', 'in', 'gte', 'lte', 'order', 'limit'];
  for (const m of methods) builder[m] = vi.fn().mockReturnValue(builder);
  builder['single'] = vi.fn().mockResolvedValue(resolved);
  builder['then'] = (resolve: (v: unknown) => void) => Promise.resolve(resolved).then(resolve);
  return builder;
}

export function makeMockClient(opts: {
  userId?: string | null;
  from?: (table: string) => Record<string, unknown>;
  rpc?: ReturnType<typeof vi.fn>;
} = {}) {
  const userId = 'userId' in opts ? opts.userId : 'user-123';
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId, email: 'test@test.com' } : null },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: opts.from ?? (() => makeQueryBuilder()),
    rpc: opts.rpc ?? vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}
