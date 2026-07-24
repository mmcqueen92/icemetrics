export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function startOfUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function startOfNextUtcDate(value: string): Date {
  const date = startOfUtcDate(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}
