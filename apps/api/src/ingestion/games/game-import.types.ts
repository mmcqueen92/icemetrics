import type {
  GameStatus,
  GameType,
  DecisionType,
} from '../../generated/prisma/client.js';
import type {
  ProviderGame,
  ProviderPlayer,
  ProviderPlayerGameStat,
  ProviderTeamGameStat,
} from '../providers/provider.types.js';
import type { MutationKind } from '../reference/reference-import.types.js';

export interface ResolvedGameInput {
  awayTeamId: string;
  game: ProviderGame;
  homeTeamId: string;
  seasonId: string;
}

export interface ExistingGameSnapshot {
  awayScore: number | null;
  awayTeamId: string;
  decisionType: DecisionType | null;
  gameType: GameType;
  homeScore: number | null;
  homeTeamId: string;
  id: string;
  seasonId: string;
  startsAt: Date;
  status: GameStatus;
  venue: string | null;
}

export interface GameImportMutation {
  externalId: string;
  gameId: string;
  mutation: MutationKind;
}

export interface StatisticsCandidate {
  awayTeamExternalId: string;
  awayTeamId: string;
  externalId: string;
  firstFinalAt: Date;
  gameId: string;
  hasCompleteStatistics: boolean;
  homeTeamExternalId: string;
  homeTeamId: string;
  latestCheckedAt: Date | null;
  seasonExternalId: string;
  seasonId: string;
}

export interface ResolvedPlayerStat {
  playerId: string | null;
  stat: ProviderPlayerGameStat;
  teamId: string;
}

export interface MissingPlayerInput {
  currentTeamId: string | null;
  player: ProviderPlayer;
}

export interface GameStatisticsInput {
  completePlayerSnapshot: boolean;
  game: ResolvedGameInput & { gameId: string };
  missingPlayers: readonly MissingPlayerInput[];
  playerStats: readonly ResolvedPlayerStat[];
  teamStats: readonly (ProviderTeamGameStat & { teamId: string })[];
}

export interface GameStatisticsResult {
  mutations: readonly MutationKind[];
}
