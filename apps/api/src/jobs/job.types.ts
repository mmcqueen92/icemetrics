import type {
  JobStatus,
  JobTrigger,
  JobType,
} from '../generated/prisma/client.js';

export interface JobCounts {
  recordsCreated: number;
  recordsFailed: number;
  recordsFetched: number;
  recordsUnchanged: number;
  recordsUpdated: number;
}

export interface JobOutcome {
  counts: JobCounts;
  cursor?: Readonly<Record<string, unknown>>;
  errorSummary?: Readonly<Record<string, unknown>>;
  status: Exclude<JobStatus, 'PENDING' | 'RUNNING'>;
}

export interface JobRunRequest {
  jobType: JobType;
  parameters: Readonly<Record<string, unknown>>;
  scheduledFor?: Date;
  trigger: JobTrigger;
}

export interface JobRunResult extends JobOutcome {
  executionId: string;
}

export const EMPTY_JOB_COUNTS: JobCounts = {
  recordsCreated: 0,
  recordsFailed: 0,
  recordsFetched: 0,
  recordsUnchanged: 0,
  recordsUpdated: 0,
};
