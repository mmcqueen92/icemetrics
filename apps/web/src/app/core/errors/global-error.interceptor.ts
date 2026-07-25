import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { GlobalErrorService } from './global-error.service';

export const globalErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const errors = inject(GlobalErrorService);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        (error.status === 0 || error.status >= 500)
      ) {
        errors.report(
          error.status === 0
            ? 'IceMetrics could not reach the data service.'
            : 'The data service could not complete that request.',
        );
      }
      return throwError(() => error);
    }),
  );
};
