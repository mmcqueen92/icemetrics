import { Inject, Injectable } from '@nestjs/common';

import { IssueSeverity, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class ImportIssueService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: {
    code: string;
    details?: Readonly<Record<string, unknown>>;
    entityType: string;
    executionId: string;
    externalKey?: string;
    message: string;
    payloadId?: string;
    severity: IssueSeverity;
  }): Promise<void> {
    await this.prisma.importIssue.create({
      data: {
        code: input.code,
        ...(input.details
          ? { details: input.details as Prisma.InputJsonObject }
          : {}),
        entityType: input.entityType,
        ...(input.externalKey ? { externalKey: input.externalKey } : {}),
        jobExecutionId: input.executionId,
        message: input.message,
        ...(input.payloadId ? { providerPayloadId: input.payloadId } : {}),
        severity: input.severity,
      },
    });
  }
}
