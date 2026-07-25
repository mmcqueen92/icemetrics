import { Injectable, inject, type ErrorHandler } from '@angular/core';

import { GlobalErrorService } from './global-error.service';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly errors = inject(GlobalErrorService);

  handleError(error: unknown): void {
    console.error('Unexpected application error.', error);
    this.errors.report(
      'Something unexpected happened. Your current page is still available.',
    );
  }
}
