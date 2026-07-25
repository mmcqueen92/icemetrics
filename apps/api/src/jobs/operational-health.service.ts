import { Inject, Injectable } from '@nestjs/common';

import { JobStatus, JobTrigger, JobType } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

const FRESHNESS_LIMIT_MS = 2 * 60 * 60 * 1_000;
const FRESH_JOB_TYPES = [JobType.SCHEDULE, JobType.GAME_STATISTICS] as const;

export interface OperationalHealth {
  activeSeason: boolean;
  checkedAt: string;
  checks: Array<{
    jobType: JobType;
    latestSuccessfulAt: string | null;
    status: 'fresh' | 'not-required' | 'stale';
  }>;
  status: 'ok' | 'unhealthy';
}

@Injectable()
export class OperationalHealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async check(now = new Date()): Promise<OperationalHealth> {
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const activeSeason =
      (await this.prisma.season.count({
        where: {
          endDate: { gte: startOfDay },
          startDate: { lte: startOfDay },
        },
      })) > 0;
    const checks = await Promise.all(
      FRESH_JOB_TYPES.map(async (jobType) => {
        const latest = await this.prisma.jobExecution.findFirst({
          orderBy: [{ finishedAt: 'desc' }, { id: 'asc' }],
          select: { finishedAt: true },
          where: {
            jobType,
            status: JobStatus.SUCCEEDED,
            trigger: JobTrigger.SCHEDULED,
          },
        });
        const latestSuccessfulAt = latest?.finishedAt ?? null;
        const fresh =
          latestSuccessfulAt !== null &&
          now.getTime() - latestSuccessfulAt.getTime() <= FRESHNESS_LIMIT_MS;
        return {
          jobType,
          latestSuccessfulAt: latestSuccessfulAt?.toISOString() ?? null,
          status: activeSeason ? (fresh ? 'fresh' : 'stale') : 'not-required',
        } as const;
      }),
    );
    return {
      activeSeason,
      checkedAt: now.toISOString(),
      checks,
      status: checks.some((check) => check.status === 'stale')
        ? 'unhealthy'
        : 'ok',
    };
  }
}
