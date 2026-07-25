import type { Routes } from '@angular/router';

import { GameDetailPageComponent } from './game-detail-page';
import { GameListPageComponent } from './game-list-page';

export const GAME_ROUTES: Routes = [
  {
    path: '',
    component: GameListPageComponent,
    title: 'Games · IceMetrics',
  },
  {
    path: ':id',
    component: GameDetailPageComponent,
    title: 'Game detail · IceMetrics',
  },
];
