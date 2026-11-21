import { describe, it, expect } from 'vitest';
import {
  calculateCadenceDates,
  formatDate,
  normalizeCadenceDays,
  parseDate,
} from '../src/core/dates';

describe('date and cadence helpers', () => {
  it('formats and parses ISO dates without timezone drift', () => {
    const date = parseDate('2026-11-25');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(10);
    expect(date.getDate()).toBe(25);
    expect(formatDate(date)).toBe('2026-11-25');
  });

  it('clamps cadence values into the supported 1-30 day range', () => {
    expect(normalizeCadenceDays(2)).toBe(2);
    expect(normalizeCadenceDays('5')).toBe(5);
    expect(normalizeCadenceDays(2.9)).toBe(2);
    expect(normalizeCadenceDays(0)).toBe(2);
    expect(normalizeCadenceDays(-4)).toBe(2);
    expect(normalizeCadenceDays(Number.NaN)).toBe(2);
    expect(normalizeCadenceDays(100)).toBe(30);
  });

  it('generates staggered publish dates and falls back for invalid cadence', () => {
    expect(calculateCadenceDates('2026-11-25', 3, 2)).toEqual([
      '2026-11-25',
      '2026-11-27',
      '2026-11-29',
    ]);

    expect(calculateCadenceDates('2026-11-25', 2, 0)).toEqual(['2026-11-25', '2026-11-27']);
  });
});
