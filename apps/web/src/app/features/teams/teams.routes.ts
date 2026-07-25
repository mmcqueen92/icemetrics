import type { Routes } from '@angular/router';

import { FeaturePlaceholderPageComponent } from '../../shared/components/feature-placeholder/feature-placeholder';

export const TEAM_ROUTES: Routes = [
  {
    path: '',
    component: FeaturePlaceholderPageComponent,
    data: {
      description:
        'Browse teams and official standings, with every result anchored to a visible data cutoff.',
      eyebrow: 'Team explorer',
      title: 'The league at a glance.',
    },
    title: 'Teams · IceMetrics',
  },
  {
    path: ':id',
    component: FeaturePlaceholderPageComponent,
    data: {
      description:
        'Roster, recent games, standings position, and performance trend in one focused view.',
      eyebrow: 'Team profile',
      title: 'Context for every result.',
    },
    title: 'Team profile · IceMetrics',
  },
];
