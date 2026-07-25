import type { ProviderGame } from '../providers/provider.types.js';
import type { ExistingGameSnapshot } from './game-import.types.js';

export function preserveTerminalFinal(
  incoming: ProviderGame,
  existing: ExistingGameSnapshot | undefined,
): ProviderGame {
  if (!existing || existing.status !== 'FINAL' || incoming.status === 'FINAL') {
    return incoming;
  }
  return {
    ...incoming,
    awayScore: existing.awayScore,
    decisionType: existing.decisionType,
    gameType: existing.gameType,
    homeScore: existing.homeScore,
    startsAt: existing.startsAt.toISOString(),
    status: 'FINAL',
    venue: existing.venue,
  };
}
