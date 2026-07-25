import { HttpErrorResponse } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { catchError, map, of, startWith } from 'rxjs';

export interface RequestError {
  message: string;
  notFound: boolean;
}

export type RequestState<T> =
  | { error?: undefined; status: 'loading'; value?: undefined }
  | { error?: undefined; status: 'success'; value: T }
  | { error: RequestError; status: 'error'; value?: undefined };

export function asRequestState<T>(
  source: Observable<T>,
): Observable<RequestState<T>> {
  return source.pipe(
    map((value): RequestState<T> => ({ status: 'success', value })),
    startWith({ status: 'loading' } as const),
    catchError((error: unknown) =>
      of({
        error: {
          message: getSafeErrorMessage(error),
          notFound: error instanceof HttpErrorResponse && error.status === 404,
        },
        status: 'error',
      } satisfies RequestState<T>),
    ),
  );
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const apiMessage = (error.error as { error?: { message?: unknown } } | null)
      ?.error?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }
  }

  return 'IceMetrics could not load this data. Please try again.';
}
