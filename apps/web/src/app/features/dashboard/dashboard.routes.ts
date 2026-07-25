import type { Routes } from '@angular/router';

import { FeaturePlaceholderPageComponent } from '../../shared/components/feature-placeholder/feature-placeholder';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: FeaturePlaceholderPageComponent,
    data: {
      description:
        'A clear starting point for current games, standings, rankings, and data freshness.',
      eyebrow: 'NHL intelligence',
      title: 'See the game beneath the score.',
    },
  },
];
