import type { Routes } from '@angular/router';

import { TeamDetailPageComponent } from './team-detail-page';
import { TeamListPageComponent } from './team-list-page';

export const TEAM_ROUTES: Routes = [
  {
    path: '',
    component: TeamListPageComponent,
    title: 'Teams · IceMetrics',
  },
  {
    path: ':id',
    component: TeamDetailPageComponent,
    title: 'Team profile · IceMetrics',
  },
];
