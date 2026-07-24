import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { JobStatus, type JobType, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { JobOutcome, JobRunRequest } from './job.types.js';

const ABANDONED_AFTER_MS = 30 * 60 * 1_000;

@Injectable()
export class JobExecutionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(request: JobRunRequest): Promise<string> {
    const execution = await this.prisma.jobExecution.create({
      data: {
        correlationId: randomUUID(),
        jobType: request.jobType,
        parameters: request.parameters as Prisma.InputJsonObject,
        ...(request.scheduledFor ? { scheduledFor: request.scheduledFor } : {}),
        trigger: request.trigger,
      },
      select: { id: true },
    });
    return execution.id;
  }

  async start(executionId: string): Promise<void> {
    await this.prisma.jobExecution.update({
      data: { startedAt: new Date(), status: JobStatus.RUNNING },
      where: { id: executionId },
    });
  }

  async complete(executionId: string, outcome: JobOutcome): Promise<void> {
    await this.prisma.jobExecution.update({
      data: {
        ...outcome.counts,
        ...(outcome.cursor
          ? { cursor: outcome.cursor as Prisma.InputJsonObject }
          : {}),
        ...(outcome.errorSummary
          ? { errorSummary: outcome.errorSummary as Prisma.InputJsonObject }
          : {}),
        finishedAt: new Date(),
        status: outcome.status,
      },
      where: { id: executionId },
    });
  }

  async fail(executionId: string, error: unknown): Promise<void> {
    await this.prisma.jobExecution.update({
      data: {
        errorSummary: {
          code: errorCode(error),
          message: safeErrorMessage(error),
        },
        finishedAt: new Date(),
        recordsFailed: 1,
        status: JobStatus.FAILED,
      },
      where: { id: executionId },
    });
  }

  async reconcileAbandoned(now = new Date()): Promise<number> {
    const result = await this.prisma.jobExecution.updateMany({
      data: {
        errorSummary: {
          code: 'ABANDONED_EXECUTION',
          message: 'Execution did not reach a terminal state',
        },
        finishedAt: now,
        status: JobStatus.FAILED,
      },
      where: {
        startedAt: { lt: new Date(now.getTime() - ABANDONED_AFTER_MS) },
        status: JobStatus.RUNNING,
      },
    });
    return result.count;
  }

  async latestSuccessfulAt(jobType: JobType): Promise<Date | null> {
    const execution = await this.prisma.jobExecution.findFirst({
      orderBy: [{ finishedAt: 'desc' }, { id: 'asc' }],
      select: { finishedAt: true },
      where: {
        jobType,
        status: JobStatus.SUCCEEDED,
      },
    });
    return execution?.finishedAt ?? null;
  }

  async isActiveSeason(date: Date): Promise<boolean> {
    const dateOnly = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    return (
      (await this.prisma.season.count({
        where: {
          endDate: { gte: dateOnly },
          startDate: { lte: dateOnly },
        },
      })) > 0
    );
  }
}

function errorCode(error: unknown): string {
  return error instanceof Error
    ? error.name.replaceAll(/[^A-Za-z0-9_]/g, '_').toUpperCase()
    : 'UNEXPECTED_ERROR';
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unexpected job failure';
  }
  return error.message.slice(0, 500);
}
