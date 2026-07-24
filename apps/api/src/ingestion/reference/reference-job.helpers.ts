import { IssueSeverity, JobStatus } from '../../generated/prisma/client.js';
import type { ProviderEntityRejection } from '../providers/provider.types.js';
import type { ImportIssueService } from '../raw/import-issue.service.js';
import type { MutationKind } from './reference-import.types.js';
import type { JobCounts, JobOutcome } from '../../jobs/job.types.js';

export function emptyCounts(): JobCounts {
  return {
    recordsCreated: 0,
    recordsFailed: 0,
    recordsFetched: 0,
    recordsUnchanged: 0,
    recordsUpdated: 0,
  };
}

export function countMutations(
  counts: JobCounts,
  mutations: readonly MutationKind[],
): void {
  for (const mutation of mutations) {
    if (mutation === 'created') {
      counts.recordsCreated += 1;
    } else if (mutation === 'updated') {
      counts.recordsUpdated += 1;
    } else {
      counts.recordsUnchanged += 1;
    }
  }
}

export async function recordRejections(
  issues: ImportIssueService,
  input: {
    entityType: string;
    executionId: string;
    payloadId: string;
    rejections: readonly ProviderEntityRejection[];
  },
): Promise<void> {
  for (const rejection of input.rejections) {
    await issues.record({
      code: 'PROVIDER_ENTITY_INVALID',
      details: { issues: [...rejection.issues] },
      entityType: input.entityType,
      executionId: input.executionId,
      ...(rejection.externalKey ? { externalKey: rejection.externalKey } : {}),
      message: 'Provider entity failed runtime validation',
      payloadId: input.payloadId,
      severity: IssueSeverity.ERROR,
    });
  }
}

export function completedOutcome(
  counts: JobCounts,
  cursor: Readonly<Record<string, unknown>>,
): JobOutcome {
  if (counts.recordsFailed === 0) {
    return { counts, cursor, status: JobStatus.SUCCEEDED };
  }
  const persisted =
    counts.recordsCreated + counts.recordsUpdated + counts.recordsUnchanged;
  return {
    counts,
    cursor,
    errorSummary: {
      code: persisted > 0 ? 'PARTIAL_IMPORT' : 'IMPORT_FAILED',
      failedRecords: counts.recordsFailed,
    },
    status: persisted > 0 ? JobStatus.PARTIAL : JobStatus.FAILED,
  };
}
