export const ANALYTICS_FORMULA_VERSION = '1';
export const POWER_RANKING_CODE = 'team.powerRanking';

export const PLAYER_METRIC_CODES = {
  assistsPerGame: 'player.assistsPerGame',
  consistencyScore: 'player.consistencyScore',
  goalsPerGame: 'player.goalsPerGame',
  pointsPerGame: 'player.pointsPerGame',
  shootingPercentage: 'player.shootingPercentage',
} as const;

export const TEAM_METRIC_CODES = {
  pointPercentage: 'team.pointPercentage',
  recentPerformanceTrend: 'team.recentPerformanceTrend',
  scoringDifferentialPerGame: 'team.scoringDifferentialPerGame',
} as const;

export interface PlayerMetricInput {
  assists: number;
  goals: number;
  shots: number;
}

export interface PlayerMetricValues {
  assistsPerGame: number | null;
  consistencyScore: number | null;
  goalsPerGame: number | null;
  pointsPerGame: number | null;
  shootingPercentage: number | null;
}

export interface TeamMetricInput {
  goalsAgainst: number;
  goalsFor: number;
  overtimeLoss: boolean;
  won: boolean;
}

export interface TeamMetricValues {
  gamesPlayed: number;
  losses: number;
  overtimeLosses: number;
  pointPercentage: number | null;
  points: number;
  scoringDifferential: number;
  scoringDifferentialPerGame: number | null;
  winPercentage: number | null;
  wins: number;
}

export interface PowerRankingInput {
  last10PointPercentage: number;
  scoringDifferential: number;
  scoringDifferentialPerGame: number;
  seasonPointPercentage: number;
  seasonPoints: number;
  teamId: string;
  teamName: string;
}

export interface RankedTeam extends PowerRankingInput {
  rank: number;
  score: number;
}

export function calculatePlayerMetrics(
  games: readonly PlayerMetricInput[],
): PlayerMetricValues {
  if (games.length === 0) {
    return {
      assistsPerGame: null,
      consistencyScore: null,
      goalsPerGame: null,
      pointsPerGame: null,
      shootingPercentage: null,
    };
  }

  const totals = games.reduce(
    (result, game) => ({
      assists: result.assists + game.assists,
      goals: result.goals + game.goals,
      shots: result.shots + game.shots,
    }),
    { assists: 0, goals: 0, shots: 0 },
  );
  const pointValues = games.map((game) => game.goals + game.assists);

  return {
    assistsPerGame: totals.assists / games.length,
    consistencyScore:
      games.length < 5
        ? null
        : 100 / (1 + populationStandardDeviation(pointValues)),
    goalsPerGame: totals.goals / games.length,
    pointsPerGame: (totals.goals + totals.assists) / games.length,
    shootingPercentage:
      totals.shots === 0 ? null : (100 * totals.goals) / totals.shots,
  };
}

export function calculateTeamMetrics(
  games: readonly TeamMetricInput[],
): TeamMetricValues {
  const totals = games.reduce(
    (result, game) => ({
      goalsAgainst: result.goalsAgainst + game.goalsAgainst,
      goalsFor: result.goalsFor + game.goalsFor,
      overtimeLosses: result.overtimeLosses + Number(game.overtimeLoss),
      wins: result.wins + Number(game.won),
    }),
    { goalsAgainst: 0, goalsFor: 0, overtimeLosses: 0, wins: 0 },
  );
  const gamesPlayed = games.length;
  const points = 2 * totals.wins + totals.overtimeLosses;

  return {
    gamesPlayed,
    losses: gamesPlayed - totals.wins - totals.overtimeLosses,
    overtimeLosses: totals.overtimeLosses,
    pointPercentage: gamesPlayed === 0 ? null : points / (2 * gamesPlayed),
    points,
    scoringDifferential: totals.goalsFor - totals.goalsAgainst,
    scoringDifferentialPerGame:
      gamesPlayed === 0
        ? null
        : (totals.goalsFor - totals.goalsAgainst) / gamesPlayed,
    winPercentage: gamesPlayed === 0 ? null : totals.wins / gamesPlayed,
    wins: totals.wins,
  };
}

export function calculateRecentPerformanceTrend(
  season: TeamMetricValues,
  recent: TeamMetricValues,
): number | null {
  if (season.pointPercentage === null || recent.pointPercentage === null) {
    return null;
  }
  return recent.pointPercentage - season.pointPercentage;
}

export function rankTeams(teams: readonly PowerRankingInput[]): RankedTeam[] {
  return teams
    .map((team) => ({
      ...team,
      score:
        100 *
        (0.5 * team.seasonPointPercentage +
          0.3 * team.last10PointPercentage +
          0.2 * clamp(0.5 + team.scoringDifferentialPerGame / 10, 0, 1)),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.seasonPoints - left.seasonPoints ||
        right.scoringDifferential - left.scoringDifferential ||
        left.teamName.localeCompare(right.teamName) ||
        left.teamId.localeCompare(right.teamId),
    )
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

function populationStandardDeviation(values: readonly number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
