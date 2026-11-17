import { describe, it, expect } from 'vitest';
import { getLevelIndex, getNextLevel } from '@/lib/utils/levels';

describe('getLevelIndex', () => {
  it('A1 is index 0', () => {
    expect(getLevelIndex('A1')).toBe(0);
  });

  it('NATIVE is last', () => {
    expect(getLevelIndex('NATIVE')).toBeGreaterThan(getLevelIndex('C2'));
  });
});

describe('getNextLevel', () => {
  it('A1 → A2', () => {
    expect(getNextLevel('A1')).toBe('A2');
  });

  it('C2 → NATIVE', () => {
    expect(getNextLevel('C2')).toBe('NATIVE');
  });

  it('NATIVE → null', () => {
    expect(getNextLevel('NATIVE')).toBeNull();
  });
});
