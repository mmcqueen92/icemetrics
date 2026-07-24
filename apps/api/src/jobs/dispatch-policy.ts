import { JobType } from '../generated/prisma/client.js';

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

export interface DispatchState {
  activeSeason: boolean;
  latestSuccessful: Readonly<Partial<Record<JobType, Date | null>>>;
  now: Date;
}

export function dueJobs(state: DispatchState): JobType[] {
  const due: JobType[] = [];
  if (
    state.now.getUTCHours() >= 9 &&
    elapsed(state.now, state.latestSuccessful[JobType.TEAMS]) >= DAY_MS
  ) {
    due.push(JobType.TEAMS);
  }
  if (
    state.now.getUTCHours() >= 10 &&
    elapsed(state.now, state.latestSuccessful[JobType.PLAYERS]) >= DAY_MS
  ) {
    due.push(JobType.PLAYERS);
  }
  const gameInterval = state.activeSeason ? HOUR_MS : DAY_MS;
  for (const jobType of [
    JobType.SCHEDULE,
    JobType.GAME_STATISTICS,
    JobType.STANDINGS,
  ]) {
    if (elapsed(state.now, state.latestSuccessful[jobType]) >= gameInterval) {
      due.push(jobType);
    }
  }
  if (
    state.now.getUTCHours() >= 23 &&
    elapsed(state.now, state.latestSuccessful[JobType.ANALYTICS]) >= DAY_MS
  ) {
    due.push(JobType.ANALYTICS);
  }
  return due;
}

function elapsed(now: Date, previous: Date | null | undefined): number {
  return previous
    ? now.getTime() - previous.getTime()
    : Number.POSITIVE_INFINITY;
}
