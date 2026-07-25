import type { Routes } from '@angular/router';

export const ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./analytics-page').then(
        (module) => module.AnalyticsPageComponent,
      ),
    title: 'Analytics · IceMetrics',
  },
];
