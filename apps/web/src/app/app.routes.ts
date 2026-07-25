import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(
        (module) => module.DASHBOARD_ROUTES,
      ),
    title: 'Dashboard · IceMetrics',
  },
  {
    path: 'players',
    loadChildren: () =>
      import('./features/players/players.routes').then(
        (module) => module.PLAYER_ROUTES,
      ),
  },
  {
    path: 'teams',
    loadChildren: () =>
      import('./features/teams/teams.routes').then(
        (module) => module.TEAM_ROUTES,
      ),
  },
  {
    path: 'games',
    loadChildren: () =>
      import('./features/games/games.routes').then(
        (module) => module.GAME_ROUTES,
      ),
  },
  {
    path: 'analytics',
    loadChildren: () =>
      import('./features/analytics/analytics.routes').then(
        (module) => module.ANALYTICS_ROUTES,
      ),
  },
  {
    path: 'about',
    loadChildren: () =>
      import('./features/about/about.routes').then(
        (module) => module.ABOUT_ROUTES,
      ),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then(
        (module) => module.NotFoundComponent,
      ),
    title: 'Page not found · IceMetrics',
  },
];
