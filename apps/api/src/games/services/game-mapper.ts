import type { GameSummaryDto } from '../dto/game.dto.js';
import type { GameRecord } from '../repositories/games.repository.js';

export function mapGameSummary(game: GameRecord): GameSummaryDto {
  return {
    away: {
      score: game.awayScore,
      team: game.awayTeam,
    },
    decisionType: game.decisionType,
    gameType: game.gameType,
    home: {
      score: game.homeScore,
      team: game.homeTeam,
    },
    id: game.id,
    seasonId: game.seasonId,
    startsAt: game.startsAt.toISOString(),
    status: game.status,
    venue: game.venue,
  };
}
