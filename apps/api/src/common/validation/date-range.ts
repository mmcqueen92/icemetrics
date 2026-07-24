import { RequestValidationError } from '../errors/api-error.js';
import { startOfUtcDate } from '../serialization/date.js';

const MILLISECONDS_PER_DAY = 86_400_000;
const MAXIMUM_INCLUSIVE_DAYS = 366;

export function validateDateRange(
  dateFrom: string | undefined,
  dateTo: string | undefined,
): void {
  if (dateFrom === undefined || dateTo === undefined) {
    return;
  }

  const from = startOfUtcDate(dateFrom);
  const to = startOfUtcDate(dateTo);
  const differenceInDays =
    (to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY;

  if (differenceInDays < 0) {
    throw new RequestValidationError([
      {
        code: 'INVALID_RANGE',
        field: 'dateTo',
        message: 'dateTo must be on or after dateFrom',
      },
    ]);
  }

  if (differenceInDays + 1 > MAXIMUM_INCLUSIVE_DAYS) {
    throw new RequestValidationError([
      {
        code: 'MAX_DATE_RANGE',
        field: 'dateTo',
        message: 'dateFrom and dateTo may span at most 366 days',
      },
    ]);
  }
}
