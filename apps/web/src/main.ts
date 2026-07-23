import { bootstrapApplication } from '@angular/platform-browser';

import { IceMetricsApp } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(IceMetricsApp, appConfig).catch((error: unknown) => {
  console.error('IceMetrics failed to start.', error);
});
