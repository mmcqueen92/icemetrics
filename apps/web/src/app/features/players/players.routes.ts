import type { Routes } from '@angular/router';

import { PlayerDetailPageComponent } from './player-detail-page';
import { PlayerListPageComponent } from './player-list-page';

export const PLAYER_ROUTES: Routes = [
  {
    path: '',
    component: PlayerListPageComponent,
    title: 'Players · IceMetrics',
  },
  {
    path: ':id',
    component: PlayerDetailPageComponent,
    title: 'Player profile · IceMetrics',
  },
];
