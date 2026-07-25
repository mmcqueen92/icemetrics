import { Inject, Injectable } from '@nestjs/common';
import {
  JobStatus,
  JobTrigger,
  type JobType,
} from '../generated/prisma/client.js';
import { PlayersImportService } from '../ingestion/reference/players-import.service.js';
import { TeamsImportService } from '../ingestion/reference/teams-import.service.js';
import { GameStatisticsImportService } from '../ingestion/games/game-statistics-import.service.js';
import { ScheduleImportService } from '../ingestion/games/schedule-import.service.js';
import { StandingsImportService } from '../ingestion/standings/standings-import.service.js';

import { JobCoordinatorService } from './job-coordinator.service.js';
import { EMPTY_JOB_COUNTS, type JobRunResult } from './job.types.js';

@Injectable()
export class FrameworkJobService {
  constructor(
    @Inject(JobCoordinatorService)
    private readonly coordinator: JobCoordinatorService,
    @Inject(PlayersImportService)
    private readonly players: PlayersImportService,
    @Inject(TeamsImportService)
    private readonly teams: TeamsImportService,
    @Inject(ScheduleImportService)
    private readonly schedule: ScheduleImportService,
    @Inject(GameStatisticsImportService)
    private readonly gameStatistics: GameStatisticsImportService,
    @Inject(StandingsImportService)
    private readonly standings: StandingsImportService,
  ) {}

  run(
    jobType: JobType,
    trigger: JobTrigger,
    parameters: Readonly<Record<string, unknown>>,
    scheduledFor?: Date,
  ): Promise<JobRunResult> {
    return this.coordinator.run(
      {
        jobType,
        parameters,
        ...(scheduledFor ? { scheduledFor } : {}),
        trigger,
      },
      (executionId) => {
        if (jobType === 'TEAMS') {
          return this.teams.execute(executionId, parameters);
        }
        if (jobType === 'PLAYERS') {
          return this.players.execute(executionId, parameters);
        }
        if (jobType === 'SCHEDULE') {
          return this.schedule.execute(executionId, parameters);
        }
        if (jobType === 'GAME_STATISTICS') {
          return this.gameStatistics.execute(executionId, parameters);
        }
        if (jobType === 'STANDINGS') {
          return this.standings.execute(executionId, parameters);
        }
        return Promise.resolve({
          counts: EMPTY_JOB_COUNTS,
          errorSummary: {
            code: 'TRANSFORM_NOT_IMPLEMENTED',
            message: `${jobType} transformation begins in a later pass`,
          },
          status: JobStatus.SKIPPED,
        });
      },
    );
  }
}
