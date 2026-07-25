export type ProviderResourceType =
  | 'teams'
  | 'season'
  | 'roster'
  | 'schedule'
  | 'team-season-schedule'
  | 'game-boxscore'
  | 'game-team-stats'
  | 'player'
  | 'standings';

export interface ProviderRequestDescriptor {
  externalKey: string;
  parameters: Readonly<Record<string, string>>;
  path: string;
  resourceType: ProviderResourceType;
}

export interface ProviderFetch<T> {
  body: Uint8Array;
  contentType: string | null;
  descriptor: ProviderRequestDescriptor;
  fetchedAt: Date;
  httpStatus: number;
  provider: 'nhl';
  validate: () => T;
}

export interface ProviderEntityRejection {
  externalKey: string | null;
  issues: readonly string[];
}

export interface ProviderCollection<T> {
  items: T[];
  rejections: ProviderEntityRejection[];
}

export interface ProviderTeam {
  abbreviation: string;
  externalId: string;
  fullName: string;
  leagueExternalId: string;
}

export interface ProviderSeason {
  endDate: string;
  externalId: string;
  label: string;
  startDate: string;
}

export interface ProviderPlayer {
  active: boolean;
  birthDate: string | null;
  currentTeamExternalId: string | null;
  externalId: string;
  firstName: string;
  lastName: string;
  position: 'C' | 'L' | 'R' | 'D' | 'G' | null;
  shootsCatches: 'L' | 'R' | null;
}

export type ProviderGameType =
  'PRESEASON' | 'REGULAR_SEASON' | 'PLAYOFF' | 'ALL_STAR';

export type ProviderGameStatus =
  'SCHEDULED' | 'PRE_GAME' | 'LIVE' | 'FINAL' | 'POSTPONED' | 'CANCELLED';

export interface ProviderGame {
  awayScore: number | null;
  awayTeamExternalId: string;
  decisionType: 'REGULATION' | 'OVERTIME' | 'SHOOTOUT' | null;
  externalId: string;
  gameType: ProviderGameType;
  homeScore: number | null;
  homeTeamExternalId: string;
  seasonExternalId: string;
  startsAt: string;
  status: ProviderGameStatus;
  venue: string | null;
}

export interface ProviderPlayerGameStat {
  assists: number;
  goals: number;
  penaltyMinutes: number;
  playerExternalId: string;
  plusMinus: number;
  powerPlayGoals: number;
  shortHandedGoals: number;
  shots: number;
  teamExternalId: string;
  timeOnIceSeconds: number;
}

export interface ProviderTeamGameStat {
  goalsAgainst: number;
  goalsFor: number;
  penaltyMinutes: number;
  powerPlayGoals: number;
  powerPlayOpportunities: number;
  shotsAgainst: number;
  shotsFor: number;
  teamExternalId: string;
}

export interface ProviderGameBoxscore {
  game: ProviderGame;
  players: ProviderPlayerGameStat[];
}

export interface ProviderTeamGameSummary {
  away: Omit<ProviderTeamGameStat, 'goalsAgainst' | 'goalsFor'>;
  home: Omit<ProviderTeamGameStat, 'goalsAgainst' | 'goalsFor'>;
}

export interface ProviderStanding {
  asOfDate: string;
  city: string;
  conferenceRank: number | null;
  divisionRank: number | null;
  gamesPlayed: number;
  goalsAgainst: number;
  goalsFor: number;
  leagueRank: number;
  losses: number;
  overtimeLosses: number;
  pointPercentage: number;
  points: number;
  seasonExternalId: string;
  sourceCutoff: string;
  teamAbbreviation: string;
  teamName: string;
  wins: number;
}

export interface HockeyDataProvider {
  getGameBoxscore(
    gameExternalId: string,
  ): Promise<ProviderFetch<ProviderGameBoxscore>>;
  getGameTeamStats(
    gameExternalId: string,
    awayTeamExternalId: string,
    homeTeamExternalId: string,
  ): Promise<ProviderFetch<ProviderTeamGameSummary>>;
  getPlayer(playerExternalId: string): Promise<ProviderFetch<ProviderPlayer>>;
  getRoster(
    teamAbbreviation: string,
    seasonExternalId: string,
  ): Promise<ProviderFetch<ProviderCollection<ProviderPlayer>>>;
  getSeason(seasonExternalId: string): Promise<ProviderFetch<ProviderSeason>>;
  getSchedule(
    date: string,
  ): Promise<ProviderFetch<ProviderCollection<ProviderGame>>>;
  getStandings(
    date: string,
  ): Promise<ProviderFetch<ProviderCollection<ProviderStanding>>>;
  getTeamSeasonSchedule(
    teamAbbreviation: string,
    seasonExternalId: string,
  ): Promise<ProviderFetch<ProviderCollection<ProviderGame>>>;
  getTeams(): Promise<ProviderFetch<ProviderCollection<ProviderTeam>>>;
}
