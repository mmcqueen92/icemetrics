import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ErrorHandler,
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';

import { environment } from '../environments/environment';
import { provideApi } from './core/api/generated/provide-api';
import { AppErrorHandler } from './core/errors/app-error-handler';
import { globalErrorInterceptor } from './core/errors/global-error.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideApi(environment.apiBaseUrl),
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([globalErrorInterceptor])),
    provideRouter(routes, withViewTransitions()),
    { provide: ErrorHandler, useClass: AppErrorHandler },
  ],
};
