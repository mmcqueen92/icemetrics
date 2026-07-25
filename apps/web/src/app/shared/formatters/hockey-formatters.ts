export function formatPercentage(value: number | null | undefined): string {
  return value == null ? 'Unavailable' : `${value.toFixed(1)}%`;
}

export function formatRatioPercentage(
  value: number | null | undefined,
): string {
  return value == null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;
}

export function formatRate(value: number | null | undefined): string {
  return value == null ? 'Unavailable' : value.toFixed(2);
}

export function formatTimeOnIce(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function displayGameStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function displayOptional(
  value: unknown,
  fallback = 'Unavailable',
): string | number {
  return typeof value === 'string' || typeof value === 'number'
    ? value
    : fallback;
}

export function displayTeamAbbreviation(
  team: { abbreviation: string } | null | undefined,
): string {
  return team?.abbreviation ?? 'Unassigned';
}
