import { routes } from './app.routes';

describe('application routes', () => {
  it('lazy-loads every top-level feature route', () => {
    const featurePaths = [
      '',
      'players',
      'teams',
      'games',
      'analytics',
      'about',
    ];

    for (const path of featurePaths) {
      const route = routes.find((candidate) => candidate.path === path);
      expect(route?.loadChildren).toBeTypeOf('function');
      expect(route?.component).toBeUndefined();
    }
  });

  it('keeps the wildcard not-found page lazy', () => {
    const fallback = routes.find((route) => route.path === '**');

    expect(fallback?.loadComponent).toBeTypeOf('function');
  });
});
