import type { Routes } from '@angular/router';

import { FeaturePlaceholderPageComponent } from '../../shared/components/feature-placeholder/feature-placeholder';

export const GAME_ROUTES: Routes = [
  {
    path: '',
    component: FeaturePlaceholderPageComponent,
    data: {
      description:
        'Explore schedules and results without blurring scheduled, live, final, postponed, or cancelled states.',
      eyebrow: 'Game explorer',
      title: 'Every game, clearly stated.',
    },
    title: 'Games · IceMetrics',
  },
  {
    path: ':id',
    component: FeaturePlaceholderPageComponent,
    data: {
      description:
        'Score, team statistics, and player box scores presented with the status and cutoff they require.',
      eyebrow: 'Game detail',
      title: 'From final score to full context.',
    },
    title: 'Game detail · IceMetrics',
  },
];
