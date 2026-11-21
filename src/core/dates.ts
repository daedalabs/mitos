export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getDefaultPublishDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDate(date);
}

/** Coerce a cadence into a positive integer number of days (1-30). */
export function normalizeCadenceDays(value: unknown, fallback: number = 2): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(30, parsed);
}

export function calculateCadenceDates(
  startDateStr: string,
  count: number,
  cadenceDays: number = 2
): string[] {
  const start = parseDate(startDateStr);
  const safeCadence = normalizeCadenceDays(cadenceDays);
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const dates: string[] = [];

  for (let i = 0; i < safeCount; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * safeCadence);
    dates.push(formatDate(d));
  }

  return dates;
}
