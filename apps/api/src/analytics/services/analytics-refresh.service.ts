import { Inject, Injectable } from '@nestjs/common';

import { JobStatus, MetricWindow } from '../../generated/prisma/client.js';
import { EMPTY_JOB_COUNTS, type JobOutcome } from '../../jobs/job.types.js';
import {
  ANALYTICS_FORMULA_VERSION,
  calculatePlayerMetrics,
  calculateRecentPerformanceTrend,
  calculateTeamMetrics,
  PLAYER_METRIC_CODES,
  rankTeams,
  TEAM_METRIC_CODES,
  type PlayerMetricInput,
  type TeamMetricInput,
} from '../domain/analytics-metrics.js';
import {
  AnalyticsRefreshRepository,
  type AnalyticsSeasonData,
  type MetricSnapshotWrite,
  type RankingSnapshotWrite,
} from '../repositories/analytics-refresh.repository.js';

const PLAYER_WINDOWS = [
  [MetricWindow.LAST_5, 5],
  [MetricWindow.LAST_10, 10],
  [MetricWindow.LAST_20, 20],
] as const;

@Injectable()
export class AnalyticsRefreshService {
  constructor(
    @Inject(AnalyticsRefreshRepository)
    private readonly repository: AnalyticsRefreshRepository,
  ) {}

  async execute(
    _executionId: string,
    parameters: Readonly<Record<string, unknown>>,
    now = new Date(),
  ): Promise<JobOutcome> {
    const seasonIds = await this.repository.resolveSeasonIds(parameters, now);
    if (seasonIds.length === 0) {
      return {
        counts: EMPTY_JOB_COUNTS,
        errorSummary: { code: 'NO_ACTIVE_SEASON' },
        status: JobStatus.SKIPPED,
      };
    }

    const totals = { ...EMPTY_JOB_COUNTS };
    const refreshed: string[] = [];
    for (const seasonId of seasonIds) {
      const data = await this.repository.loadSeason(seasonId);
      if (data === null) {
        totals.recordsFailed += 1;
        continue;
      }
      const snapshots = buildSnapshots(data);
      const result = await this.repository.reconcile(
        seasonId,
        ANALYTICS_FORMULA_VERSION,
        now,
        snapshots.players,
        snapshots.teams,
        snapshots.rankings,
      );
      totals.recordsFetched += data.games.length;
      totals.recordsCreated += result.created;
      totals.recordsUpdated += result.updated;
      totals.recordsUnchanged += result.unchanged;
      refreshed.push(seasonId);
    }

    return {
      counts: totals,
      cursor: {
        formulaVersion: ANALYTICS_FORMULA_VERSION,
        seasonIds: refreshed,
      },
      ...(totals.recordsFailed > 0
        ? { errorSummary: { code: 'SEASON_NOT_FOUND' } }
        : {}),
      status:
        totals.recordsFailed === 0
          ? JobStatus.SUCCEEDED
          : refreshed.length > 0
            ? JobStatus.PARTIAL
            : JobStatus.FAILED,
    };
  }
}

export function buildSnapshots(data: AnalyticsSeasonData): {
  players: MetricSnapshotWrite[];
  rankings: RankingSnapshotWrite[];
  teams: MetricSnapshotWrite[];
} {
  const players: MetricSnapshotWrite[] = [];
  const teams: MetricSnapshotWrite[] = [];
  const rankings: RankingSnapshotWrite[] = [];
  const playerHistory = new Map<string, PlayerMetricInput[]>();
  const teamHistory = new Map<
    string,
    Array<
      TeamMetricInput & { asOfGameId: string; startsAt: Date; teamName: string }
    >
  >();

  for (const game of data.games) {
    for (const stat of game.playerStats) {
      const history = playerHistory.get(stat.playerId) ?? [];
      history.push(stat);
      playerHistory.set(stat.playerId, history);
      for (const [window, size] of PLAYER_WINDOWS) {
        const sample = history.slice(-size);
        const metrics = calculatePlayerMetrics(sample);
        for (const [property, metricCode] of Object.entries(
          PLAYER_METRIC_CODES,
        )) {
          const value = metrics[property as keyof typeof metrics];
          if (value !== null) {
            players.push({
              asOfGameId: game.id,
              entityId: stat.playerId,
              metricCode,
              sampleSize: sample.length,
              value,
              window,
            });
          }
        }
      }
    }

    for (const stat of game.teamStats) {
      const history = teamHistory.get(stat.teamId) ?? [];
      const won = stat.goalsFor > stat.goalsAgainst;
      history.push({
        asOfGameId: game.id,
        goalsAgainst: stat.goalsAgainst,
        goalsFor: stat.goalsFor,
        overtimeLoss: !won && game.decisionType !== 'REGULATION',
        startsAt: game.startsAt,
        teamName: stat.team.name,
        won,
      });
      teamHistory.set(stat.teamId, history);
      const season = calculateTeamMetrics(history);
      const recentInput = history.slice(-10);
      const recent = calculateTeamMetrics(recentInput);
      const trend = calculateRecentPerformanceTrend(season, recent);
      const values = {
        [TEAM_METRIC_CODES.pointPercentage]: recent.pointPercentage,
        [TEAM_METRIC_CODES.recentPerformanceTrend]: trend,
        [TEAM_METRIC_CODES.scoringDifferentialPerGame]:
          recent.scoringDifferentialPerGame,
      };
      for (const [metricCode, value] of Object.entries(values)) {
        if (value !== null) {
          teams.push({
            asOfGameId: game.id,
            entityId: stat.teamId,
            metricCode,
            sampleSize: recentInput.length,
            value,
            window: MetricWindow.LAST_10,
          });
        }
      }
    }
  }

  const rankingDates = [
    ...new Set(
      data.games.map((game) => game.startsAt.toISOString().slice(0, 10)),
    ),
  ];
  for (const dateText of rankingDates) {
    const endOfDate = new Date(`${dateText}T23:59:59.999Z`);
    const inputs = [...teamHistory.entries()].flatMap(([teamId, history]) => {
      const eligible = history.filter((game) => game.startsAt <= endOfDate);
      if (eligible.length === 0) {
        return [];
      }
      const season = calculateTeamMetrics(eligible);
      const recent = calculateTeamMetrics(eligible.slice(-10));
      const official = latestOfficialPointPercentage(data, teamId, endOfDate);
      return [
        {
          last10PointPercentage: recent.pointPercentage!,
          scoringDifferential: season.scoringDifferential,
          scoringDifferentialPerGame: season.scoringDifferentialPerGame!,
          seasonPointPercentage:
            official?.pointPercentage ?? season.pointPercentage!,
          seasonPoints: official?.points ?? season.points,
          teamId,
          teamName: eligible.at(-1)!.teamName,
        },
      ];
    });
    for (const ranked of rankTeams(inputs)) {
      rankings.push({
        asOfDate: new Date(`${dateText}T00:00:00Z`),
        rank: ranked.rank,
        sampleSize: teamHistory
          .get(ranked.teamId)!
          .filter((game) => game.startsAt <= endOfDate).length,
        score: ranked.score,
        teamId: ranked.teamId,
      });
    }
  }

  return { players, rankings, teams };
}

function latestOfficialPointPercentage(
  data: AnalyticsSeasonData,
  teamId: string,
  cutoff: Date,
): { pointPercentage: number; points: number } | null {
  const match = data.standings
    .filter(
      (standing) => standing.teamId === teamId && standing.asOfDate <= cutoff,
    )
    .at(-1);
  return match === undefined
    ? null
    : {
        pointPercentage: Number(match.pointPercentage),
        points: match.points,
      };
}
