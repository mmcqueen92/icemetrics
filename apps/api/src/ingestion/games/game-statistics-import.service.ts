import { Inject, Injectable } from '@nestjs/common';

import { IssueSeverity } from '../../generated/prisma/client.js';
import type { JobOutcome } from '../../jobs/job.types.js';
import { IngestionCaptureService } from '../ingestion-capture.service.js';
import type {
  HockeyDataProvider,
  ProviderGameBoxscore,
  ProviderPlayer,
} from '../providers/provider.types.js';
import { HOCKEY_DATA_PROVIDER } from '../providers/providers.module.js';
import { ImportIssueService } from '../raw/import-issue.service.js';
import { RawPayloadService } from '../raw/raw-payload.service.js';
import {
  completedOutcome,
  countMutations,
  emptyCounts,
} from '../reference/reference-job.helpers.js';
import { GameImportRepository } from './game-import.repository.js';
import type {
  MissingPlayerInput,
  ResolvedPlayerStat,
  StatisticsCandidate,
} from './game-import.types.js';

type StatisticsProvider = Pick<
  HockeyDataProvider,
  'getGameBoxscore' | 'getGameTeamStats' | 'getPlayer'
>;

@Injectable()
export class GameStatisticsImportService {
  constructor(
    @Inject(HOCKEY_DATA_PROVIDER)
    private readonly provider: StatisticsProvider,
    @Inject(IngestionCaptureService)
    private readonly capture: IngestionCaptureService,
    @Inject(GameImportRepository)
    private readonly repository: GameImportRepository,
    @Inject(RawPayloadService)
    private readonly rawPayloads: RawPayloadService,
    @Inject(ImportIssueService)
    private readonly issues: ImportIssueService,
  ) {}

  async execute(
    executionId: string,
    parameters: Readonly<Record<string, unknown>>,
  ): Promise<JobOutcome> {
    const counts = emptyCounts();
    const candidates = await this.repository.statisticsCandidates({
      ...(typeof parameters['gameId'] === 'string'
        ? { gameId: parameters['gameId'] }
        : {}),
      now: new Date(),
    });
    const affected: Array<{ gameId: string; startsAt: string }> = [];
    const checkedExternalIds: string[] = [];
    for (const candidate of candidates) {
      const result = await this.importGame(
        executionId,
        candidate,
        parameters['dryRun'] === true,
        counts,
      );
      if (result) {
        checkedExternalIds.push(result.externalId);
        if (result.changed) {
          affected.push(result);
        }
      }
    }
    return completedOutcome(counts, {
      affectedGameIds: affected.map(({ gameId }) => gameId),
      checkedExternalIds: checkedExternalIds.sort(),
      earliestAffectedStartsAt:
        affected.map(({ startsAt }) => startsAt).sort()[0] ?? null,
    });
  }

  private async importGame(
    executionId: string,
    candidate: StatisticsCandidate,
    dryRun: boolean,
    counts: ReturnType<typeof emptyCounts>,
  ): Promise<{
    changed: boolean;
    externalId: string;
    gameId: string;
    startsAt: string;
  } | null> {
    let boxscoreFetch;
    try {
      boxscoreFetch = await this.provider.getGameBoxscore(candidate.externalId);
    } catch {
      counts.recordsFailed += 1;
      await this.issues.record({
        code: 'GAME_BOXSCORE_FETCH_FAILED',
        entityType: 'game',
        executionId,
        externalKey: candidate.externalId,
        message: 'Final-game box score could not be fetched',
        severity: IssueSeverity.ERROR,
      });
      return null;
    }
    let boxscore;
    try {
      boxscore = await this.capture.captureAndValidate(
        boxscoreFetch,
        executionId,
      );
    } catch {
      counts.recordsFailed += 1;
      return null;
    }
    let teamStatsFetch;
    try {
      teamStatsFetch = await this.provider.getGameTeamStats(
        candidate.externalId,
        candidate.awayTeamExternalId,
        candidate.homeTeamExternalId,
      );
    } catch {
      counts.recordsFailed += 1;
      await this.issues.record({
        code: 'GAME_TEAM_STATISTICS_FETCH_FAILED',
        entityType: 'game',
        executionId,
        externalKey: candidate.externalId,
        message: 'Final-game team statistics could not be fetched',
        severity: IssueSeverity.ERROR,
      });
      return null;
    }
    let teamSummary;
    try {
      teamSummary = await this.capture.captureAndValidate(
        teamStatsFetch,
        executionId,
      );
    } catch {
      counts.recordsFailed += 1;
      return null;
    }
    counts.recordsFetched += boxscore.value.players.length + 3;
    if (
      !(await this.validateGame(
        executionId,
        candidate,
        boxscore.value,
        boxscore.payloadId,
      ))
    ) {
      counts.recordsFailed += 1;
      return null;
    }
    if (
      teamSummary.value.away.teamExternalId !== candidate.awayTeamExternalId ||
      teamSummary.value.home.teamExternalId !== candidate.homeTeamExternalId
    ) {
      counts.recordsFailed += 1;
      await this.issues.record({
        code: 'GAME_TEAM_STATISTICS_IDENTITY_MISMATCH',
        entityType: 'game',
        executionId,
        externalKey: candidate.externalId,
        message: 'Team statistics did not match the box-score team sides',
        payloadId: teamSummary.payloadId,
        severity: IssueSeverity.ERROR,
      });
      return null;
    }

    const seenPlayers = new Set<string>();
    const validStats = [];
    let completePlayerSnapshot = true;
    for (const stat of boxscore.value.players) {
      if (seenPlayers.has(stat.playerExternalId)) {
        counts.recordsFailed += 1;
        completePlayerSnapshot = false;
        await this.issues.record({
          code: 'GAME_PLAYER_DUPLICATE',
          entityType: 'playerGameStat',
          executionId,
          externalKey: stat.playerExternalId,
          message: 'Box score contained a duplicate player',
          payloadId: boxscore.payloadId,
          severity: IssueSeverity.ERROR,
        });
        continue;
      }
      seenPlayers.add(stat.playerExternalId);
      if (
        stat.teamExternalId !== candidate.awayTeamExternalId &&
        stat.teamExternalId !== candidate.homeTeamExternalId
      ) {
        counts.recordsFailed += 1;
        completePlayerSnapshot = false;
        await this.issues.record({
          code: 'GAME_PLAYER_TEAM_MISMATCH',
          entityType: 'playerGameStat',
          executionId,
          externalKey: stat.playerExternalId,
          message: 'Player statistic referenced a team outside the game',
          payloadId: boxscore.payloadId,
          severity: IssueSeverity.ERROR,
        });
        continue;
      }
      if (stat.timeOnIceSeconds === 0) {
        await this.issues.record({
          code: 'GAME_PLAYER_TIME_ON_ICE_MISSING',
          entityType: 'playerGameStat',
          executionId,
          externalKey: stat.playerExternalId,
          message: 'Final-game player statistic has no time on ice',
          payloadId: boxscore.payloadId,
          severity: IssueSeverity.WARNING,
        });
      }
      validStats.push(stat);
    }

    const resolvedPlayers = await this.repository.resolvedPlayerIds(
      validStats.map(({ playerExternalId }) => playerExternalId),
    );
    const missingExternalIds = [
      ...new Set(
        validStats
          .filter(
            ({ playerExternalId }) => !resolvedPlayers.has(playerExternalId),
          )
          .map(({ playerExternalId }) => playerExternalId),
      ),
    ];
    const profiles = new Map<
      string,
      { payloadId: string; player: ProviderPlayer }
    >();
    for (const externalId of missingExternalIds) {
      let fetch;
      try {
        fetch = await this.provider.getPlayer(externalId);
      } catch {
        counts.recordsFailed += 1;
        completePlayerSnapshot = false;
        await this.issues.record({
          code: 'PLAYER_PROFILE_FETCH_FAILED',
          entityType: 'player',
          executionId,
          externalKey: externalId,
          message: 'Unknown box-score player profile could not be fetched',
          severity: IssueSeverity.ERROR,
        });
        continue;
      }
      try {
        const profile = await this.capture.captureAndValidate(
          fetch,
          executionId,
        );
        counts.recordsFetched += 1;
        if (profile.value.externalId !== externalId) {
          counts.recordsFailed += 1;
          completePlayerSnapshot = false;
          await this.issues.record({
            code: 'PLAYER_PROFILE_IDENTITY_MISMATCH',
            entityType: 'player',
            executionId,
            externalKey: externalId,
            message: 'Fetched player profile did not match the requested ID',
            payloadId: profile.payloadId,
            severity: IssueSeverity.ERROR,
          });
          continue;
        }
        profiles.set(externalId, {
          payloadId: profile.payloadId,
          player: profile.value,
        });
      } catch {
        counts.recordsFailed += 1;
        completePlayerSnapshot = false;
      }
    }

    const profileTeamIds = [...profiles.values()].flatMap(({ player }) =>
      player.currentTeamExternalId ? [player.currentTeamExternalId] : [],
    );
    const profileTeams = await this.repository.resolveReferences({
      seasonExternalIds: [],
      teamExternalIds: profileTeamIds,
    });
    const missingPlayers: MissingPlayerInput[] = [...profiles.values()].map(
      ({ player }) => ({
        currentTeamId: player.currentTeamExternalId
          ? (profileTeams.teams.get(player.currentTeamExternalId) ?? null)
          : null,
        player,
      }),
    );
    const playerStats: ResolvedPlayerStat[] = validStats.flatMap((stat) => {
      const playerId = resolvedPlayers.get(stat.playerExternalId) ?? null;
      if (!playerId && !profiles.has(stat.playerExternalId)) {
        return [];
      }
      return [
        {
          playerId,
          stat,
          teamId:
            stat.teamExternalId === candidate.awayTeamExternalId
              ? candidate.awayTeamId
              : candidate.homeTeamId,
        },
      ];
    });
    await this.recordGoalReconciliation(
      executionId,
      candidate,
      boxscore.value,
      boxscore.payloadId,
    );

    const game = boxscore.value.game;
    const teamStats = [
      {
        ...teamSummary.value.away,
        goalsAgainst: game.homeScore!,
        goalsFor: game.awayScore!,
        teamId: candidate.awayTeamId,
      },
      {
        ...teamSummary.value.home,
        goalsAgainst: game.awayScore!,
        goalsFor: game.homeScore!,
        teamId: candidate.homeTeamId,
      },
    ];
    if (dryRun) {
      return null;
    }
    const result = await this.repository.importStatistics({
      completePlayerSnapshot,
      game: {
        awayTeamId: candidate.awayTeamId,
        game,
        gameId: candidate.gameId,
        homeTeamId: candidate.homeTeamId,
        seasonId: candidate.seasonId,
      },
      missingPlayers,
      playerStats,
      teamStats,
    });
    countMutations(counts, result.mutations);
    await Promise.all([
      this.rawPayloads.markProcessed(boxscore.payloadId),
      this.rawPayloads.markProcessed(teamSummary.payloadId),
      ...[...profiles.values()].map(({ payloadId }) =>
        this.rawPayloads.markProcessed(payloadId),
      ),
    ]);
    const changed = result.mutations.some(
      (mutation) => mutation !== 'unchanged',
    );
    return {
      changed,
      externalId: candidate.externalId,
      gameId: candidate.gameId,
      startsAt: game.startsAt,
    };
  }

  private async validateGame(
    executionId: string,
    candidate: StatisticsCandidate,
    boxscore: ProviderGameBoxscore,
    payloadId: string,
  ): Promise<boolean> {
    const game = boxscore.game;
    const valid =
      game.externalId === candidate.externalId &&
      game.seasonExternalId === candidate.seasonExternalId &&
      game.status === 'FINAL' &&
      game.awayTeamExternalId === candidate.awayTeamExternalId &&
      game.homeTeamExternalId === candidate.homeTeamExternalId &&
      game.awayScore !== null &&
      game.homeScore !== null;
    if (!valid) {
      await this.issues.record({
        code: 'GAME_BOXSCORE_IDENTITY_MISMATCH',
        entityType: 'game',
        executionId,
        externalKey: candidate.externalId,
        message: 'Box score did not match the selected final game',
        payloadId,
        severity: IssueSeverity.ERROR,
      });
    }
    return valid;
  }

  private async recordGoalReconciliation(
    executionId: string,
    candidate: StatisticsCandidate,
    boxscore: ProviderGameBoxscore,
    payloadId: string,
  ): Promise<void> {
    for (const [teamExternalId, expected] of [
      [candidate.awayTeamExternalId, boxscore.game.awayScore],
      [candidate.homeTeamExternalId, boxscore.game.homeScore],
    ] as const) {
      const actual = boxscore.players
        .filter((stat) => stat.teamExternalId === teamExternalId)
        .reduce((total, stat) => total + stat.goals, 0);
      if (actual !== expected) {
        await this.issues.record({
          code: 'GAME_PLAYER_GOAL_TOTAL_MISMATCH',
          details: { actual, expected },
          entityType: 'game',
          executionId,
          externalKey: candidate.externalId,
          message: 'Player goal total differs from the final team score',
          payloadId,
          severity: IssueSeverity.WARNING,
        });
      }
    }
  }
}
