import type { StatisticsCandidate } from './game-import.types.js';

const HOUR_MS = 60 * 60 * 1_000;

export function statisticsDue(
  candidate: StatisticsCandidate,
  now: Date,
): boolean {
  if (!candidate.hasCompleteStatistics || !candidate.latestCheckedAt) {
    return true;
  }
  const elapsedSinceFinal = now.getTime() - candidate.firstFinalAt.getTime();
  const latestAge = now.getTime() - candidate.latestCheckedAt.getTime();
  const crossedUnfetchedThreshold = [1, 6, 24].some(
    (hours) =>
      elapsedSinceFinal >= hours * HOUR_MS &&
      candidate.latestCheckedAt!.getTime() <
        candidate.firstFinalAt.getTime() + hours * HOUR_MS,
  );
  return crossedUnfetchedThreshold || latestAge >= 24 * HOUR_MS;
}
