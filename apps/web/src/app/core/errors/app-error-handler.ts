import { Injectable, inject, type ErrorHandler } from '@angular/core';

import { GlobalErrorService } from './global-error.service';
import { captureUnexpectedBrowserError } from './browser-error-tracking';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly errors = inject(GlobalErrorService);

  handleError(error: unknown): void {
    captureUnexpectedBrowserError(error);
    console.error('Unexpected application error.', error);
    this.errors.report(
      'Something unexpected happened. Your current page is still available.',
    );
  }
}
