import type { Routes } from '@angular/router';

import { FeaturePlaceholderPageComponent } from '../../shared/components/feature-placeholder/feature-placeholder';

export const PLAYER_ROUTES: Routes = [
  {
    path: '',
    component: FeaturePlaceholderPageComponent,
    data: {
      description:
        'Search NHL players, inspect game logs, and follow rolling performance with transparent sample sizes.',
      eyebrow: 'Player explorer',
      title: 'Performance, game by game.',
    },
    title: 'Players · IceMetrics',
  },
  {
    path: ':id',
    component: FeaturePlaceholderPageComponent,
    data: {
      description:
        'Player identity, season production, game history, and rolling metrics belong together.',
      eyebrow: 'Player profile',
      title: 'A complete view of the player.',
    },
    title: 'Player profile · IceMetrics',
  },
];
