import type { Routes } from '@angular/router';

import { FeaturePlaceholderPageComponent } from '../../shared/components/feature-placeholder/feature-placeholder';

export const ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    component: FeaturePlaceholderPageComponent,
    data: {
      description:
        'Compare players and rank teams with versioned formulas, visible samples, and accessible data summaries.',
      eyebrow: 'Analytics',
      title: 'Trends you can inspect.',
    },
    title: 'Analytics · IceMetrics',
  },
];
