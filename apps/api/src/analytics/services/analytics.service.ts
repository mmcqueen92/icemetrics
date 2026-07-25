import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '../../common/errors/api-error.js';
import { formatDateOnly } from '../../common/serialization/date.js';
import { roundToFour } from '../../common/serialization/number.js';
import { MetricWindow } from '../../generated/prisma/client.js';
import {
  ANALYTICS_FORMULA_VERSION,
  calculatePlayerMetrics,
  calculateTeamMetrics,
  PLAYER_METRIC_CODES,
  rankTeams,
  TEAM_METRIC_CODES,
  type PlayerMetricValues,
  type TeamMetricInput,
} from '../domain/analytics-metrics.js';
import {
  ComparisonWindow,
  type MetricValuesDto,
  type PlayerComparisonDto,
  type PlayerComparisonQueryDto,
  type PlayerTrendPointDto,
  type PlayerTrendQueryDto,
  type TeamRankingDto,
  type TeamRankingQueryDto,
  type TeamTrendPointDto,
  type TeamTrendQueryDto,
} from '../dto/analytics.dto.js';
import { AnalyticsRepository } from '../repositories/analytics.repository.js';

const WINDOW_MAP = {
  5: MetricWindow.LAST_5,
  10: MetricWindow.LAST_10,
  20: MetricWindow.LAST_20,
} as const;

type MetricRow = Awaited<
  ReturnType<AnalyticsRepository['findPlayerTrend']>
>[number];

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(AnalyticsRepository)
    private readonly repository: AnalyticsRepository,
  ) {}

  async playerTrends(
    playerId: string,
    query: PlayerTrendQueryDto,
  ): Promise<PlayerTrendPointDto[]> {
    if ((await this.repository.findPlayer(playerId)) === null) {
      throw new ResourceNotFoundError('Player');
    }
    const rows = await this.repository.findPlayerTrend(
      playerId,
      query.seasonId,
      WINDOW_MAP[query.window as 5 | 10 | 20],
    );
    return groupPlayerTrend(rows, query.window);
  }

  async comparePlayers(
    query: PlayerComparisonQueryDto,
  ): Promise<PlayerComparisonDto> {
    const [season, players] = await Promise.all([
      this.repository.findSeason(query.seasonId),
      this.repository.findPlayers(query.playerIds),
    ]);
    if (season === null) {
      throw new ResourceNotFoundError('Season');
    }
    if (players.length !== query.playerIds.length) {
      throw new ResourceNotFoundError('Player');
    }
    const playerById = new Map(players.map((player) => [player.id, player]));

    if (query.window === ComparisonWindow.Season) {
      const rows = await this.repository.findPlayerSeasonStats(
        query.playerIds,
        query.seasonId,
      );
      const byPlayer = groupBy(rows, (row) => row.playerId);
      const cutoff = rows.at(-1)?.game.startsAt ?? null;
      return {
        dataCutoff: cutoff?.toISOString() ?? null,
        formulaVersion: ANALYTICS_FORMULA_VERSION,
        players: query.playerIds.map((playerId) => {
          const games = byPlayer.get(playerId) ?? [];
          const metrics = calculatePlayerMetrics(games);
          return {
            metrics: toMetricDto({ ...metrics, consistencyScore: null }),
            player: playerById.get(playerId)!,
            sampleSize: games.length,
          };
        }),
        season: mapSeason(season),
        window: query.window,
      };
    }

    const window = WINDOW_MAP[Number(query.window) as 5 | 10 | 20];
    const rows = await this.repository.findPlayerRollingSnapshots(
      query.playerIds,
      query.seasonId,
      window,
    );
    const latestByPlayer = latestMetricGroups(rows);
    const cutoff = [...latestByPlayer.values()]
      .map((group) => group[0]?.asOfGame.startsAt)
      .filter((value): value is Date => value !== undefined)
      .sort((left, right) => right.getTime() - left.getTime())[0];
    return {
      dataCutoff: cutoff?.toISOString() ?? null,
      formulaVersion: ANALYTICS_FORMULA_VERSION,
      players: query.playerIds.map((playerId) => {
        const metrics = latestByPlayer.get(playerId) ?? [];
        return {
          metrics: metricRowsToDto(metrics),
          player: playerById.get(playerId)!,
          sampleSize: metrics[0]?.sampleSize ?? 0,
        };
      }),
      season: mapSeason(season),
      window: query.window,
    };
  }

  async teamTrends(
    teamId: string,
    query: TeamTrendQueryDto,
  ): Promise<TeamTrendPointDto[]> {
    const team = await this.repository.findTeam(teamId);
    if (team === null) {
      throw new ResourceNotFoundError('Team');
    }
    const rows = await this.repository.findTeamTrend(teamId, query.seasonId);
    const groups = groupBy(rows, (row) => row.asOfGameId);
    return [...groups.values()].map((group) => {
      const values = new Map(
        group.map((row) => [row.metricCode, roundToFour(Number(row.value))]),
      );
      const first = group[0]!;
      return {
        asOfDate: formatDateOnly(first.asOfGame.startsAt),
        asOfGameId: first.asOfGameId,
        computedAt: latestComputedAt(group).toISOString(),
        formulaVersion: first.formulaVersion,
        pointPercentage: values.get(TEAM_METRIC_CODES.pointPercentage)!,
        recentPerformanceTrend: values.get(
          TEAM_METRIC_CODES.recentPerformanceTrend,
        )!,
        sampleSize: first.sampleSize,
        scoringDifferentialPerGame: values.get(
          TEAM_METRIC_CODES.scoringDifferentialPerGame,
        )!,
        seasonId: query.seasonId,
        team,
        window: 10,
      };
    });
  }

  async teamRankings(query: TeamRankingQueryDto): Promise<TeamRankingDto[]> {
    const ranking = await this.repository.findRankings(
      query.seasonId,
      query.asOfDate,
    );
    if (ranking.date === null) {
      return [];
    }
    const [stats, standings] = await Promise.all([
      this.repository.findTeamSeasonStats(query.seasonId, ranking.date),
      this.repository.findOfficialStandings(query.seasonId, ranking.date),
    ]);
    const officialByTeam = new Map<
      string,
      { pointPercentage: number; points: number }
    >();
    for (const standing of standings) {
      if (!officialByTeam.has(standing.teamId)) {
        officialByTeam.set(standing.teamId, {
          pointPercentage: Number(standing.pointPercentage),
          points: standing.points,
        });
      }
    }
    const statsByTeam = groupBy(stats, (stat) => stat.teamId);
    const components = new Map(
      rankTeams(
        ranking.rows.flatMap((row) => {
          const games = (statsByTeam.get(row.teamId) ?? []).map(teamInput);
          if (games.length === 0) {
            return [];
          }
          const season = calculateTeamMetrics(games);
          const recent = calculateTeamMetrics(games.slice(-10));
          const official = officialByTeam.get(row.teamId);
          return [
            {
              last10PointPercentage: recent.pointPercentage!,
              scoringDifferential: season.scoringDifferential,
              scoringDifferentialPerGame: season.scoringDifferentialPerGame!,
              seasonPointPercentage:
                official?.pointPercentage ?? season.pointPercentage!,
              seasonPoints: official?.points ?? season.points,
              teamId: row.teamId,
              teamName: row.team.name,
            },
          ];
        }),
      ).map((item) => [item.teamId, item]),
    );
    return ranking.rows.map((row) => {
      const component = components.get(row.teamId)!;
      return {
        asOfDate: formatDateOnly(row.asOfDate),
        computedAt: row.computedAt.toISOString(),
        formulaVersion: row.formulaVersion,
        last10PointPercentage: roundToFour(component.last10PointPercentage),
        rank: row.rank,
        sampleSize: row.sampleSize,
        score: roundToFour(Number(row.score)),
        scoringDifferentialPerGame: roundToFour(
          component.scoringDifferentialPerGame,
        ),
        seasonId: query.seasonId,
        seasonPointPercentage: roundToFour(component.seasonPointPercentage),
        team: row.team,
      };
    });
  }
}

function groupPlayerTrend(
  rows: readonly MetricRow[],
  window: number,
): PlayerTrendPointDto[] {
  return [...groupBy(rows, (row) => row.asOfGameId).values()].map((group) => {
    const first = group[0]!;
    return {
      asOfDate: formatDateOnly(first.asOfGame.startsAt),
      asOfGameId: first.asOfGameId,
      computedAt: latestComputedAt(group).toISOString(),
      formulaVersion: first.formulaVersion,
      metrics: metricRowsToDto(group),
      sampleSize: first.sampleSize,
      window,
    };
  });
}

function latestMetricGroups<T extends MetricRow & { playerId: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  const cutoffByPlayer = new Map<string, string>();
  for (const row of rows) {
    const cutoff = cutoffByPlayer.get(row.playerId);
    if (cutoff === undefined) {
      cutoffByPlayer.set(row.playerId, row.asOfGameId);
      result.set(row.playerId, [row]);
    } else if (cutoff === row.asOfGameId) {
      result.get(row.playerId)!.push(row);
    }
  }
  return result;
}

function metricRowsToDto(
  rows: readonly Pick<MetricRow, 'metricCode' | 'value'>[],
): MetricValuesDto {
  const values = new Map(
    rows.map((row) => [row.metricCode, roundToFour(Number(row.value))]),
  );
  return {
    assistsPerGame: values.get(PLAYER_METRIC_CODES.assistsPerGame) ?? null,
    consistencyScore: values.get(PLAYER_METRIC_CODES.consistencyScore) ?? null,
    goalsPerGame: values.get(PLAYER_METRIC_CODES.goalsPerGame) ?? null,
    pointsPerGame: values.get(PLAYER_METRIC_CODES.pointsPerGame) ?? null,
    shootingPercentage:
      values.get(PLAYER_METRIC_CODES.shootingPercentage) ?? null,
  };
}

function toMetricDto(metrics: PlayerMetricValues): MetricValuesDto {
  return {
    assistsPerGame: roundedOrNull(metrics.assistsPerGame),
    consistencyScore: roundedOrNull(metrics.consistencyScore),
    goalsPerGame: roundedOrNull(metrics.goalsPerGame),
    pointsPerGame: roundedOrNull(metrics.pointsPerGame),
    shootingPercentage: roundedOrNull(metrics.shootingPercentage),
  };
}

function roundedOrNull(value: number | null): number | null {
  return value === null ? null : roundToFour(value);
}

function latestComputedAt(rows: readonly { computedAt: Date }[]): Date {
  return rows.reduce(
    (latest, row) => (row.computedAt > latest ? row.computedAt : latest),
    rows[0]!.computedAt,
  );
}

function mapSeason(
  season: NonNullable<Awaited<ReturnType<AnalyticsRepository['findSeason']>>>,
) {
  return {
    endDate: formatDateOnly(season.endDate),
    id: season.id,
    label: season.label,
    leagueId: season.leagueId,
    startDate: formatDateOnly(season.startDate),
  };
}

function teamInput(stat: {
  game: { decisionType: string | null };
  goalsAgainst: number;
  goalsFor: number;
}): TeamMetricInput {
  const won = stat.goalsFor > stat.goalsAgainst;
  return {
    goalsAgainst: stat.goalsAgainst,
    goalsFor: stat.goalsFor,
    overtimeLoss: !won && stat.game.decisionType !== 'REGULATION',
    won,
  };
}

function groupBy<T, K>(
  values: readonly T[],
  keySelector: (value: T) => K,
): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const value of values) {
    const key = keySelector(value);
    const group = result.get(key);
    if (group === undefined) {
      result.set(key, [value]);
    } else {
      group.push(value);
    }
  }
  return result;
}
