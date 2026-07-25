import type { SeasonSummaryDto } from '../../core/api/generated/model/seasonSummaryDto';

const FRESHNESS_WINDOW_MS = 2 * 60 * 60 * 1000;

export function isActiveSeasonDataStale(
  sourceCutoff: string | null | undefined,
  season: SeasonSummaryDto,
  now = new Date(),
): boolean {
  if (!sourceCutoff) {
    return false;
  }

  const today = now.toISOString().slice(0, 10);
  const isActive = season.startDate <= today && today <= season.endDate;
  return (
    isActive &&
    now.getTime() - new Date(sourceCutoff).getTime() > FRESHNESS_WINDOW_MS
  );
}
