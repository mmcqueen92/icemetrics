import { JobType } from '../generated/prisma/client.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RANGE_DAYS = 366;

export interface ParsedJobArguments {
  command: 'dispatch' | 'health' | 'replay' | 'run';
  jobType?: JobType;
  parameters: Readonly<Record<string, boolean | string>>;
  payloadId?: string;
}

export function parseJobArguments(argv: readonly string[]): ParsedJobArguments {
  const command = argv[0];
  if (
    command !== 'dispatch' &&
    command !== 'health' &&
    command !== 'replay' &&
    command !== 'run'
  ) {
    throw new Error('Expected one of: dispatch, health, replay, run');
  }
  const options = parseOptions(argv.slice(1));

  if (command === 'dispatch' || command === 'health') {
    rejectUnknown(options, new Set());
    return { command, parameters: {} };
  }

  if (command === 'replay') {
    rejectUnknown(options, new Set(['payload-id']));
    const payloadId = required(options, 'payload-id');
    if (!UUID_PATTERN.test(payloadId)) {
      throw new Error('--payload-id must be a UUID');
    }
    return { command, parameters: { payloadId }, payloadId };
  }

  rejectUnknown(
    options,
    new Set([
      'date',
      'date-from',
      'date-to',
      'dry-run',
      'fixture',
      'game-id',
      'job',
      'season-id',
    ]),
  );
  const jobValue = required(options, 'job').toUpperCase().replaceAll('-', '_');
  if (!(jobValue in JobType) || jobValue === JobType.DISPATCH) {
    throw new Error('--job must name a logical ingestion job');
  }
  validateOptionalUuid(options, 'season-id');
  validateOptionalUuid(options, 'game-id');
  validateOptionalDate(options, 'date');
  validateOptionalDate(options, 'date-from');
  validateOptionalDate(options, 'date-to');
  validateRange(options);
  const fixture = options.get('fixture');
  if (fixture && !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(fixture)) {
    throw new Error('--fixture must be a safe fixture name');
  }

  const parameters: Record<string, boolean | string> = {};
  for (const [key, value] of options) {
    const camelKey = key.replace(/-([a-z])/g, (_match, letter: string) =>
      letter.toUpperCase(),
    );
    parameters[camelKey] = key === 'dry-run' ? true : value;
  }
  delete parameters['job'];
  return {
    command,
    jobType: JobType[jobValue as keyof typeof JobType],
    parameters,
  };
}

function parseOptions(values: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token?.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token ?? ''}`);
    }
    const key = token.slice(2);
    if (result.has(key)) {
      throw new Error(`Duplicate option: --${key}`);
    }
    if (key === 'dry-run') {
      result.set(key, 'true');
      continue;
    }
    const value = values[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    result.set(key, value);
    index += 1;
  }
  return result;
}

function rejectUnknown(
  values: ReadonlyMap<string, string>,
  allowed: ReadonlySet<string>,
): void {
  for (const key of values.keys()) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown option: --${key}`);
    }
  }
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) {
    throw new Error(`--${key} is required`);
  }
  return value;
}

function validateOptionalUuid(
  values: ReadonlyMap<string, string>,
  key: string,
): void {
  const value = values.get(key);
  if (value && !UUID_PATTERN.test(value)) {
    throw new Error(`--${key} must be a UUID`);
  }
}

function validateOptionalDate(
  values: ReadonlyMap<string, string>,
  key: string,
): void {
  const value = values.get(key);
  if (value && !isDateOnly(value)) {
    throw new Error(`--${key} must be a real YYYY-MM-DD date`);
  }
}

function validateRange(values: ReadonlyMap<string, string>): void {
  const from = values.get('date-from');
  const to = values.get('date-to');
  if ((from && !to) || (!from && to)) {
    throw new Error('--date-from and --date-to must be supplied together');
  }
  if (!from || !to) {
    return;
  }
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  const days = (toTime - fromTime) / 86_400_000;
  if (days < 0 || days > MAX_RANGE_DAYS) {
    throw new Error(
      'Date range must be inclusive, ordered, and at most 366 days',
    );
  }
}

function isDateOnly(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
