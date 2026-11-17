import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSRSStore, useSRSProgress, useCurrentCard } from '@/stores/srs.store';
import type { SRSItem } from '@/types/domain.types';

function makeItems(n: number): SRSItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: `item-${i}` }) as SRSItem);
}

function setQueue(items: SRSItem[]) {
  act(() => useSRSStore.getState().setQueue(items));
}

// useSRSSession calls setQueue after every single review (invalidateQueries
// triggers a refetch of /srs/due, which naturally excludes whatever was just
// reviewed). This simulates that exact refetch-per-review cycle to guard
// against the regression where progress.total tracked the live (shrinking)
// queue instead of the session's fixed original size.
function reviewOneCard(remaining: SRSItem[]) {
  act(() => useSRSStore.getState().rateCard(4));
  const next = remaining.slice(1);
  setQueue(next);
  return next;
}

describe('SRS session progress', () => {
  beforeEach(() => {
    act(() => useSRSStore.getState().resetSession());
  });

  it('done/total count up steadily across a full session instead of regressing', () => {
    const { result } = renderHook(() => useSRSProgress());
    let queue = makeItems(3);

    setQueue(queue);
    expect(result.current).toMatchObject({ done: 0, total: 3 });

    queue = reviewOneCard(queue);
    expect(result.current).toMatchObject({ done: 1, total: 3 });

    queue = reviewOneCard(queue);
    expect(result.current).toMatchObject({ done: 2, total: 3 });

    queue = reviewOneCard(queue);
    expect(result.current).toMatchObject({ done: 3, total: 3 });
  });

  it('reports isFinished and a non-zero total at the end of a completed session', () => {
    const { result: progress } = renderHook(() => useSRSProgress());
    const { result: card } = renderHook(() => useCurrentCard());
    let queue = makeItems(2);

    setQueue(queue);
    queue = reviewOneCard(queue);
    queue = reviewOneCard(queue);

    expect(progress.current.isFinished).toBe(true);
    // Regression check: this must stay non-zero so the UI takes the
    // "session completed" branch, not the "nothing was ever due" branch.
    expect(progress.current.total).toBe(2);
    expect(progress.current.done).toBe(2);
    expect(progress.current.accuracy).toBe(1);
    expect(card.current).toBeNull();
  });

  it('keeps total at 0 when no cards were ever due', () => {
    const { result } = renderHook(() => useSRSProgress());
    setQueue([]);
    expect(result.current.isFinished).toBe(true);
    expect(result.current.total).toBe(0);
    expect(result.current.done).toBe(0);
  });
});
