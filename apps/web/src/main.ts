import { bootstrapApplication } from '@angular/platform-browser';

import { IceMetricsApp } from './app/app';
import { appConfig } from './app/app.config';
import { initializeBrowserErrorTracking } from './app/core/errors/browser-error-tracking';

initializeBrowserErrorTracking();
bootstrapApplication(IceMetricsApp, appConfig).catch((error: unknown) => {
  console.error('IceMetrics failed to start.', error);
});
