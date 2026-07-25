import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { IceMetricsApp } from './app';
import { routes } from './app.routes';

describe('IceMetricsApp', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IceMetricsApp],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('renders the shell, primary navigation, and freshness context', async () => {
    const fixture = TestBed.createComponent(IceMetricsApp);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.brand')?.textContent).toContain(
      'IceMetrics',
    );
    expect(element.querySelectorAll('nav a')).toHaveLength(5);
    expect(element.querySelector('app-freshness-indicator')).toBeTruthy();
    expect(element.querySelector('h1')?.textContent).toContain(
      'See the game beneath the score.',
    );
  });

  it('provides a keyboard skip link and focuses the main landmark after navigation', async () => {
    const fixture = TestBed.createComponent(IceMetricsApp);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await router.navigateByUrl('/players');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    const element = fixture.nativeElement as HTMLElement;
    const skipLink = element.querySelector<HTMLAnchorElement>('.skip-link');
    const main = element.querySelector<HTMLElement>('main');

    expect(skipLink?.getAttribute('href')).toBe('#main-content');
    expect(main?.id).toBe('main-content');
    expect(document.activeElement).toBe(main);
  });

  it('renders an in-app not-found page for unknown routes', async () => {
    const fixture = TestBed.createComponent(IceMetricsApp);
    await TestBed.inject(Router).navigateByUrl('/not-a-real-page');
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain(
      'That page is offside.',
    );
    expect(
      element.querySelector('app-not-found a[href="/"]')?.textContent,
    ).toContain('Return to dashboard');
  });
});
