import { z } from 'zod';

import { ProviderValidationError } from '../provider.errors.js';
import type {
  ProviderGame,
  ProviderGameBoxscore,
  ProviderGameStatus,
  ProviderGameType,
  ProviderCollection,
  ProviderEntityRejection,
  ProviderPlayer,
  ProviderPlayerGameStat,
  ProviderStanding,
  ProviderTeam,
  ProviderTeamGameSummary,
  ProviderSeason,
} from '../provider.types.js';

const nonNegativeInteger = z.number().int().nonnegative();
const positiveIdentifier = z.union([
  z.string().trim().min(1),
  z.number().int().nonnegative(),
]);
const localizedName = z.object({ default: z.string().trim().min(1) });
const dateOnly = z.iso.date();
const instant = z.iso.datetime({ offset: true });

const upstreamTeam = z.object({
  fullName: z.string().trim().min(1),
  id: positiveIdentifier,
  leagueId: positiveIdentifier,
  triCode: z.string().trim().min(2).max(4),
});

const teamsResponse = z.object({ data: z.array(z.unknown()) });

const upstreamPlayer = z.object({
  active: z.boolean().optional(),
  birthDate: dateOnly.nullish(),
  currentTeamId: positiveIdentifier.nullish(),
  firstName: localizedName,
  id: positiveIdentifier,
  lastName: localizedName,
  position: z.string().trim().optional(),
  positionCode: z.string().trim().optional(),
  shootsCatches: z.enum(['L', 'R']).nullish(),
});

const rosterResponse = z.object({
  defensemen: z.array(z.unknown()),
  forwards: z.array(z.unknown()),
  goalies: z.array(z.unknown()),
});

const upstreamSeason = z.object({
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T/),
  id: positiveIdentifier,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T/),
});

const seasonResponse = z.object({ data: z.array(upstreamSeason).length(1) });

const upstreamTeamReference = z.object({
  id: positiveIdentifier,
  score: nonNegativeInteger.nullish(),
  sog: nonNegativeInteger.optional(),
});

const upstreamGame = z.object({
  awayTeam: upstreamTeamReference,
  gameScheduleState: z.string().trim().optional(),
  gameState: z.string().trim(),
  gameType: z.number().int(),
  homeTeam: upstreamTeamReference,
  id: positiveIdentifier,
  periodDescriptor: z
    .object({ periodType: z.string().trim().optional() })
    .optional(),
  season: positiveIdentifier,
  startTimeUTC: instant,
  venue: localizedName.nullish(),
});

const dailyScheduleResponse = z.object({
  gameWeek: z.array(
    z.object({
      date: dateOnly,
      games: z.array(upstreamGame),
    }),
  ),
});

const seasonScheduleResponse = z.object({ games: z.array(upstreamGame) });

const upstreamSkaterGameStat = z.object({
  assists: nonNegativeInteger,
  goals: nonNegativeInteger,
  pim: nonNegativeInteger,
  playerId: positiveIdentifier,
  plusMinus: z.number().int(),
  powerPlayGoals: nonNegativeInteger,
  position: z.string().trim(),
  shorthandedGoals: nonNegativeInteger.optional(),
  sog: nonNegativeInteger,
  toi: z.string().regex(/^\d{1,3}:\d{2}$/),
});

const upstreamGoalieGameStat = z.object({
  pim: nonNegativeInteger,
  playerId: positiveIdentifier,
  position: z.literal('G'),
  teamId: positiveIdentifier,
  toi: z.string().regex(/^\d{1,3}:\d{2}$/),
});

const upstreamBoxscoreTeamPlayers = z.object({
  defense: z.array(upstreamSkaterGameStat),
  forwards: z.array(upstreamSkaterGameStat),
  goalies: z.array(upstreamGoalieGameStat.omit({ teamId: true })),
});

const boxscoreResponse = upstreamGame.extend({
  gameOutcome: z.object({ lastPeriodType: z.string().trim() }),
  playerByGameStats: z.object({
    awayTeam: upstreamBoxscoreTeamPlayers,
    homeTeam: upstreamBoxscoreTeamPlayers,
  }),
});

const rightRailResponse = z.object({
  teamGameStats: z.array(
    z.object({
      awayValue: z.union([z.number(), z.string()]),
      category: z.string().trim(),
      homeValue: z.union([z.number(), z.string()]),
    }),
  ),
});

const playerResponse = upstreamPlayer;

const upstreamStanding = z.object({
  conferenceSequence: z.number().int().positive().nullish(),
  date: dateOnly,
  divisionSequence: z.number().int().positive().nullish(),
  gameTypeId: z.number().int().optional(),
  gamesPlayed: nonNegativeInteger,
  goalAgainst: nonNegativeInteger,
  goalFor: nonNegativeInteger,
  leagueSequence: z.number().int().positive(),
  losses: nonNegativeInteger,
  otLosses: nonNegativeInteger,
  pointPctg: z.number().min(0).max(1),
  points: nonNegativeInteger,
  seasonId: positiveIdentifier,
  placeName: localizedName,
  teamAbbrev: localizedName,
  teamCommonName: localizedName,
  wins: nonNegativeInteger,
});

const standingsResponse = z.object({ standings: z.array(z.unknown()) });

export function parseTeams(value: unknown): ProviderCollection<ProviderTeam> {
  const parsed = parse('teams', teamsResponse, value);
  return partition('team', parsed.data, upstreamTeam, (team) => ({
    abbreviation: team.triCode.toUpperCase(),
    externalId: String(team.id),
    fullName: team.fullName,
    leagueExternalId: String(team.leagueId),
  }));
}

export function parseRoster(
  value: unknown,
  teamExternalId: string,
): ProviderCollection<ProviderPlayer> {
  const parsed = parse('roster', rosterResponse, value);
  return partition(
    'player',
    [...parsed.forwards, ...parsed.defensemen, ...parsed.goalies],
    upstreamPlayer,
    (player) => mapPlayer(player, teamExternalId),
  );
}

export function parseSeason(value: unknown): ProviderSeason {
  const season = parse('season', seasonResponse, value).data[0]!;
  const externalId = String(season.id);
  return {
    endDate: season.endDate.slice(0, 10),
    externalId,
    label: `${externalId.slice(0, 4)}-${externalId.slice(4, 8)}`,
    startDate: season.startDate.slice(0, 10),
  };
}

export function parseDailySchedule(value: unknown): ProviderGame[] {
  const parsed = parse('schedule', dailyScheduleResponse, value);
  return parsed.gameWeek.flatMap((day) =>
    day.games.map((game) => mapGame(game)),
  );
}

export function parseSeasonSchedule(value: unknown): ProviderGame[] {
  return parse('team-season-schedule', seasonScheduleResponse, value).games.map(
    (game) => mapGame(game),
  );
}

export function parseGameBoxscore(value: unknown): ProviderGameBoxscore {
  const parsed = parse('game-boxscore', boxscoreResponse, value);
  const awayPlayers = mapBoxscorePlayers(
    parsed.playerByGameStats.awayTeam,
    String(parsed.awayTeam.id),
  );
  const homePlayers = mapBoxscorePlayers(
    parsed.playerByGameStats.homeTeam,
    String(parsed.homeTeam.id),
  );
  return {
    game: mapGame(parsed, parsed.gameOutcome.lastPeriodType),
    players: [...awayPlayers, ...homePlayers],
  };
}

export function parseGameTeamStats(
  value: unknown,
  awayTeamExternalId: string,
  homeTeamExternalId: string,
): ProviderTeamGameSummary {
  const parsed = parse('game-team-stats', rightRailResponse, value);
  const values = new Map(
    parsed.teamGameStats.map((entry) => [entry.category, entry]),
  );
  const powerPlay = requiredCategory(values, 'powerPlay');
  const shots = requiredCategory(values, 'sog');
  const penalties = requiredCategory(values, 'pim');
  const [awayPowerPlayGoals, awayPowerPlayOpportunities] = parseRatio(
    powerPlay.awayValue,
  );
  const [homePowerPlayGoals, homePowerPlayOpportunities] = parseRatio(
    powerPlay.homeValue,
  );
  return {
    away: {
      penaltyMinutes: numericValue(penalties.awayValue),
      powerPlayGoals: awayPowerPlayGoals,
      powerPlayOpportunities: awayPowerPlayOpportunities,
      shotsAgainst: numericValue(shots.homeValue),
      shotsFor: numericValue(shots.awayValue),
      teamExternalId: awayTeamExternalId,
    },
    home: {
      penaltyMinutes: numericValue(penalties.homeValue),
      powerPlayGoals: homePowerPlayGoals,
      powerPlayOpportunities: homePowerPlayOpportunities,
      shotsAgainst: numericValue(shots.awayValue),
      shotsFor: numericValue(shots.homeValue),
      teamExternalId: homeTeamExternalId,
    },
  };
}

export function parsePlayer(value: unknown): ProviderPlayer {
  return mapPlayer(parse('player', playerResponse, value), null);
}

export function parseStandings(
  value: unknown,
  fetchedAt: Date,
): ProviderCollection<ProviderStanding> {
  const parsed = parse('standings', standingsResponse, value);
  return partition(
    'standing',
    parsed.standings,
    upstreamStanding,
    (standing) => ({
      asOfDate: standing.date,
      city: standing.placeName.default,
      conferenceRank: standing.conferenceSequence ?? null,
      divisionRank: standing.divisionSequence ?? null,
      gamesPlayed: standing.gamesPlayed,
      goalsAgainst: standing.goalAgainst,
      goalsFor: standing.goalFor,
      leagueRank: standing.leagueSequence,
      losses: standing.losses,
      overtimeLosses: standing.otLosses,
      pointPercentage: standing.pointPctg,
      points: standing.points,
      seasonExternalId: String(standing.seasonId),
      sourceCutoff: fetchedAt.toISOString(),
      teamAbbreviation: standing.teamAbbrev.default.toUpperCase(),
      teamName: standing.teamCommonName.default,
      wins: standing.wins,
    }),
  );
}

function partition<Input, Output>(
  entityType: string,
  values: readonly unknown[],
  schema: z.ZodType<Input>,
  map: (value: Input) => Output,
): ProviderCollection<Output> {
  const items: Output[] = [];
  const rejections: ProviderEntityRejection[] = [];
  for (const value of values) {
    const result = schema.safeParse(value);
    if (result.success) {
      items.push(map(result.data));
      continue;
    }
    rejections.push({
      externalKey: externalKey(value),
      issues: result.error.issues.map(
        (issue) => `${entityType}.${issue.path.join('.')}: ${issue.message}`,
      ),
    });
  }
  return { items, rejections };
}

function externalKey(value: unknown): string | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    (typeof value.id === 'string' || typeof value.id === 'number')
  ) {
    return String(value.id);
  }
  return null;
}

function parse<T>(
  resourceType: string,
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ProviderValidationError(
      resourceType,
      result.error.issues.map(
        (issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`,
      ),
    );
  }
  return result.data;
}

function mapPlayer(
  player: z.infer<typeof upstreamPlayer>,
  requestedTeamExternalId: string | null,
): ProviderPlayer {
  const rawPosition = player.positionCode ?? player.position;
  const position =
    rawPosition && ['C', 'L', 'R', 'D', 'G'].includes(rawPosition)
      ? (rawPosition as ProviderPlayer['position'])
      : null;
  return {
    active: player.active ?? true,
    birthDate: player.birthDate ?? null,
    currentTeamExternalId:
      player.currentTeamId === null || player.currentTeamId === undefined
        ? requestedTeamExternalId
        : String(player.currentTeamId),
    externalId: String(player.id),
    firstName: player.firstName.default,
    lastName: player.lastName.default,
    position,
    shootsCatches: player.shootsCatches ?? null,
  };
}

function mapGame(
  game: z.infer<typeof upstreamGame>,
  outcomePeriodType?: string,
): ProviderGame {
  const status = mapGameStatus(game.gameState, game.gameScheduleState);
  const final = status === 'FINAL';
  if (String(game.homeTeam.id) === String(game.awayTeam.id)) {
    throw new ProviderValidationError('game', [
      'teams: home and away team must differ',
    ]);
  }
  if (
    final &&
    (game.homeTeam.score === null ||
      game.homeTeam.score === undefined ||
      game.awayTeam.score === null ||
      game.awayTeam.score === undefined)
  ) {
    throw new ProviderValidationError('game', [
      'score: final games require both team scores',
    ]);
  }
  return {
    awayScore: final ? (game.awayTeam.score ?? null) : null,
    awayTeamExternalId: String(game.awayTeam.id),
    decisionType: final
      ? mapDecisionType(outcomePeriodType ?? game.periodDescriptor?.periodType)
      : null,
    externalId: String(game.id),
    gameType: mapGameType(game.gameType),
    homeScore: final ? (game.homeTeam.score ?? null) : null,
    homeTeamExternalId: String(game.homeTeam.id),
    seasonExternalId: String(game.season),
    startsAt: new Date(game.startTimeUTC).toISOString(),
    status,
    venue: game.venue?.default ?? null,
  };
}

function mapGameType(value: number): ProviderGameType {
  const values: Record<number, ProviderGameType> = {
    1: 'PRESEASON',
    2: 'REGULAR_SEASON',
    3: 'ALL_STAR',
    4: 'PLAYOFF',
  };
  const mapped = values[value];
  if (!mapped) {
    throw new ProviderValidationError('game', [
      `gameType: unknown value ${value}`,
    ]);
  }
  return mapped;
}

function mapGameStatus(
  gameState: string,
  scheduleState: string | undefined,
): ProviderGameStatus {
  if (scheduleState === 'PPD') {
    return 'POSTPONED';
  }
  if (scheduleState === 'CNCL') {
    return 'CANCELLED';
  }
  const values: Record<string, ProviderGameStatus> = {
    CRIT: 'LIVE',
    FINAL: 'FINAL',
    FUT: 'SCHEDULED',
    LIVE: 'LIVE',
    OFF: 'FINAL',
    PRE: 'PRE_GAME',
  };
  const mapped = values[gameState];
  if (!mapped) {
    throw new ProviderValidationError('game', [
      `gameState: unknown value ${gameState}`,
    ]);
  }
  return mapped;
}

function mapDecisionType(
  periodType: string | undefined,
): ProviderGame['decisionType'] {
  if (periodType === 'SO') {
    return 'SHOOTOUT';
  }
  if (periodType === 'OT') {
    return 'OVERTIME';
  }
  return 'REGULATION';
}

function mapPlayerGameStat(
  stat: z.infer<typeof upstreamSkaterGameStat>,
  teamExternalId: string,
): ProviderPlayerGameStat {
  const [minutes = 0, seconds = 0] = stat.toi.split(':').map(Number);
  return {
    assists: stat.assists,
    goals: stat.goals,
    penaltyMinutes: stat.pim,
    playerExternalId: String(stat.playerId),
    plusMinus: stat.plusMinus,
    powerPlayGoals: stat.powerPlayGoals,
    shortHandedGoals: stat.shorthandedGoals ?? 0,
    shots: stat.sog,
    teamExternalId,
    timeOnIceSeconds: minutes * 60 + seconds,
  };
}

function mapBoxscorePlayers(
  team: z.infer<typeof upstreamBoxscoreTeamPlayers>,
  teamExternalId: string,
): ProviderPlayerGameStat[] {
  const skaters = [...team.forwards, ...team.defense].map((stat) =>
    mapPlayerGameStat(stat, teamExternalId),
  );
  const goalies = team.goalies.map((goalie) => {
    const [minutes = 0, seconds = 0] = goalie.toi.split(':').map(Number);
    return {
      assists: 0,
      goals: 0,
      penaltyMinutes: goalie.pim,
      playerExternalId: String(goalie.playerId),
      plusMinus: 0,
      powerPlayGoals: 0,
      shortHandedGoals: 0,
      shots: 0,
      teamExternalId,
      timeOnIceSeconds: minutes * 60 + seconds,
    };
  });
  return [...skaters, ...goalies];
}

function requiredCategory(
  values: ReadonlyMap<
    string,
    { awayValue: number | string; homeValue: number | string }
  >,
  category: string,
): { awayValue: number | string; homeValue: number | string } {
  const value = values.get(category);
  if (!value) {
    throw new ProviderValidationError('game-team-stats', [
      `teamGameStats: missing ${category}`,
    ]);
  }
  return value;
}

function numericValue(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ProviderValidationError('game-team-stats', [
      `teamGameStats: invalid numeric value ${String(value)}`,
    ]);
  }
  return parsed;
}

function parseRatio(value: number | string): [number, number] {
  if (typeof value !== 'string' || !/^\d+\/\d+$/.test(value)) {
    throw new ProviderValidationError('game-team-stats', [
      `powerPlay: invalid ratio ${String(value)}`,
    ]);
  }
  const [goals = 0, opportunities = 0] = value.split('/').map(Number);
  if (goals > opportunities) {
    throw new ProviderValidationError('game-team-stats', [
      'powerPlay: goals cannot exceed opportunities',
    ]);
  }
  return [goals, opportunities];
}
