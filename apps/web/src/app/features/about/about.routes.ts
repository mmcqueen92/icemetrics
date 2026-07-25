import type { Routes } from '@angular/router';

import { FeaturePlaceholderPageComponent } from '../../shared/components/feature-placeholder/feature-placeholder';

export const ABOUT_ROUTES: Routes = [
  {
    path: '',
    component: FeaturePlaceholderPageComponent,
    data: {
      description:
        'IceMetrics is an independent, read-only NHL analytics platform built around transparent data provenance.',
      eyebrow: 'About IceMetrics',
      title: 'Analytics without hidden assumptions.',
    },
    title: 'About · IceMetrics',
  },
];
