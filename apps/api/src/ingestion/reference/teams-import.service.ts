import { Inject, Injectable } from '@nestjs/common';

import { IssueSeverity, JobType } from '../../generated/prisma/client.js';
import type { JobOutcome } from '../../jobs/job.types.js';
import { IngestionCaptureService } from '../ingestion-capture.service.js';
import type {
  HockeyDataProvider,
  ProviderCollection,
  ProviderStanding,
  ProviderTeam,
} from '../providers/provider.types.js';
import { HOCKEY_DATA_PROVIDER } from '../providers/providers.module.js';
import { ImportIssueService } from '../raw/import-issue.service.js';
import { RawPayloadService } from '../raw/raw-payload.service.js';
import {
  completedOutcome,
  countMutations,
  emptyCounts,
  recordRejections,
} from './reference-job.helpers.js';
import { ReferenceImportRepository } from './reference-import.repository.js';
import type { ReferenceTeamInput } from './reference-import.types.js';
import { evaluateSnapshotAbsences } from './snapshot-policy.js';

const LEAGUE_CODE = 'NHL';
const LEAGUE_NAME = 'National Hockey League';
type ReferenceProvider = Pick<
  HockeyDataProvider,
  'getSeason' | 'getStandings' | 'getTeams'
>;

@Injectable()
export class TeamsImportService {
  constructor(
    @Inject(HOCKEY_DATA_PROVIDER)
    private readonly provider: ReferenceProvider,
    @Inject(IngestionCaptureService)
    private readonly capture: IngestionCaptureService,
    @Inject(ReferenceImportRepository)
    private readonly repository: ReferenceImportRepository,
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
    const date = parameterDate(parameters);
    const [teamsFetch, standingsFetch] = await Promise.all([
      this.provider.getTeams(),
      this.provider.getStandings(date),
    ]);
    const [teams, standings] = await Promise.all([
      this.capture.captureAndValidate(teamsFetch, executionId),
      this.capture.captureAndValidate(standingsFetch, executionId),
    ]);
    counts.recordsFetched += collectionSize(teams.value);
    counts.recordsFetched += collectionSize(standings.value);
    counts.recordsFailed +=
      teams.value.rejections.length + standings.value.rejections.length;
    await Promise.all([
      recordRejections(this.issues, {
        entityType: 'team',
        executionId,
        payloadId: teams.payloadId,
        rejections: teams.value.rejections,
      }),
      recordRejections(this.issues, {
        entityType: 'standing',
        executionId,
        payloadId: standings.payloadId,
        rejections: standings.value.rejections,
      }),
    ]);

    const seasonIds = new Set(
      standings.value.items.map(({ seasonExternalId }) => seasonExternalId),
    );
    if (seasonIds.size !== 1) {
      counts.recordsFailed += 1;
      await this.issues.record({
        code: 'REFERENCE_SEASON_AMBIGUOUS',
        details: { seasonExternalIds: [...seasonIds].sort() },
        entityType: 'season',
        executionId,
        message: 'Standings snapshot did not identify exactly one season',
        payloadId: standings.payloadId,
        severity: IssueSeverity.ERROR,
      });
      return completedOutcome(counts, { externalIds: [] });
    }

    const seasonExternalId = [...seasonIds][0]!;
    const season = await this.capture.captureAndValidate(
      await this.provider.getSeason(seasonExternalId),
      executionId,
    );
    counts.recordsFetched += 1;
    const joined = await this.joinTeams(
      executionId,
      teams.value.items,
      standings.value.items,
      standings.payloadId,
    );
    counts.recordsFailed += joined.failed;
    const currentExternalIds = new Set(
      joined.teams.map(({ externalId }) => externalId),
    );
    const cursor = { externalIds: [...currentExternalIds].sort() };

    if (parameters['dryRun'] === true) {
      return completedOutcome(counts, cursor);
    }
    if (joined.teams.length === 0) {
      counts.recordsFailed += 1;
      return completedOutcome(counts, cursor);
    }

    const result = await this.repository.upsertReferenceSnapshot({
      league: {
        code: LEAGUE_CODE,
        externalId: joined.leagueExternalId,
        name: LEAGUE_NAME,
      },
      season: season.value,
      teams: joined.teams,
    });
    countMutations(counts, result.mutations);

    const cleanSnapshot = counts.recordsFailed === 0;
    if (cleanSnapshot) {
      await this.applyAbsencePolicy(executionId, currentExternalIds, counts);
    }
    await Promise.all(
      [teams.payloadId, standings.payloadId, season.payloadId].map(
        (payloadId) => this.rawPayloads.markProcessed(payloadId),
      ),
    );
    return completedOutcome(counts, cursor);
  }

  private async joinTeams(
    executionId: string,
    teams: readonly ProviderTeam[],
    standings: readonly ProviderStanding[],
    payloadId: string,
  ): Promise<{
    failed: number;
    leagueExternalId: string;
    teams: ReferenceTeamInput[];
  }> {
    const directory = new Map(
      teams.map((team) => [team.abbreviation.toUpperCase(), team]),
    );
    const normalized: ReferenceTeamInput[] = [];
    const leagues = new Set<string>();
    let failed = 0;
    for (const standing of standings) {
      const team = directory.get(standing.teamAbbreviation.toUpperCase());
      if (!team) {
        failed += 1;
        await this.issues.record({
          code: 'REFERENCE_TEAM_JOIN_FAILED',
          entityType: 'team',
          executionId,
          externalKey: standing.teamAbbreviation,
          message: 'Standing team was absent from the provider team directory',
          payloadId,
          severity: IssueSeverity.ERROR,
        });
        continue;
      }
      leagues.add(team.leagueExternalId);
      normalized.push({
        abbreviation: standing.teamAbbreviation.toUpperCase(),
        city: standing.city,
        externalId: team.externalId,
        name: standing.teamName,
      });
    }
    if (leagues.size !== 1) {
      failed += 1;
      await this.issues.record({
        code: 'REFERENCE_LEAGUE_AMBIGUOUS',
        details: { leagueExternalIds: [...leagues].sort() },
        entityType: 'league',
        executionId,
        message: 'Joined teams did not identify exactly one league',
        payloadId,
        severity: IssueSeverity.ERROR,
      });
    }
    return {
      failed,
      leagueExternalId: [...leagues][0] ?? '',
      teams: leagues.size === 1 ? normalized : [],
    };
  }

  private async applyAbsencePolicy(
    executionId: string,
    currentExternalIds: ReadonlySet<string>,
    counts: ReturnType<typeof emptyCounts>,
  ): Promise<void> {
    const active = new Set(await this.repository.activeExternalIds('team'));
    const previous = await this.repository.previousSuccessfulSnapshots(
      JobType.TEAMS,
    );
    const policy = evaluateSnapshotAbsences(
      active,
      currentExternalIds,
      previous,
    );
    for (const warning of policy.warnings) {
      await this.issues.record({
        code: 'REFERENCE_ENTITY_ABSENT',
        details: { consecutiveSuccessfulSnapshots: warning.absenceCount },
        entityType: 'team',
        executionId,
        externalKey: warning.externalId,
        message: 'Active team was absent from a successful provider snapshot',
        severity: IssueSeverity.WARNING,
      });
    }
    counts.recordsUpdated += await this.repository.inactivate(
      'team',
      policy.deactivate,
    );
  }
}

function parameterDate(parameters: Readonly<Record<string, unknown>>): string {
  const value = parameters['date'];
  return typeof value === 'string'
    ? value
    : new Date().toISOString().slice(0, 10);
}

function collectionSize<T>(collection: ProviderCollection<T>): number {
  return collection.items.length + collection.rejections.length;
}
