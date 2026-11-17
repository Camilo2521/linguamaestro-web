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
  builder['maybeSingle'] = vi.fn().mockResolvedValue(resolved);
  builder['then'] = (resolve: (v: unknown) => void) => Promise.resolve(resolved).then(resolve);
  return builder;
}

/** One recorded query against the fake database. */
export interface QueryCall {
  table: string;
  op: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  payload?: unknown;
  options?: Record<string, unknown>;
  /** eq / is / in filters, keyed by column. */
  filters: Record<string, unknown>;
  /** true when `.select()` followed a write (RETURNING). */
  returning: boolean;
  single: boolean;
}

type QueryResult = { data: unknown; error: unknown; count?: number | null };

/**
 * A fake `from()` that records every query (operation, payload, filters)
 * and answers each one through `handler` once it is awaited. Unlike
 * `makeQueryBuilder`, responses can depend on *what* was asked rather than
 * on call order, and tests can assert on the exact writes and the
 * conditions they carried (e.g. a compare-and-set filter).
 */
export function makeFakeDb(handler: (call: QueryCall) => QueryResult) {
  const calls: QueryCall[] = [];

  function from(table: string) {
    const call: QueryCall = { table, op: 'select', filters: {}, returning: false, single: false };
    let isWrite = false;
    const resolve = () => {
      calls.push(call);
      return Promise.resolve(handler(call));
    };
    const builder: Record<string, unknown> = {};
    const write = (op: QueryCall['op']) => (payload?: unknown, options?: Record<string, unknown>) => {
      call.op = op;
      call.payload = payload;
      call.options = options;
      isWrite = true;
      return builder;
    };
    builder['insert'] = write('insert');
    builder['upsert'] = write('upsert');
    builder['update'] = write('update');
    builder['delete'] = write('delete');
    builder['select'] = () => {
      if (isWrite) call.returning = true;
      return builder;
    };
    for (const m of ['eq', 'is', 'in']) {
      builder[m] = (col: string, val: unknown) => {
        call.filters[col] = val;
        return builder;
      };
    }
    for (const m of ['gte', 'lte', 'order', 'limit']) builder[m] = () => builder;
    builder['single'] = () => {
      call.single = true;
      return resolve();
    };
    builder['maybeSingle'] = builder['single'];
    builder['then'] = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      resolve().then(onFulfilled, onRejected);
    return builder;
  }

  return { from, calls };
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
