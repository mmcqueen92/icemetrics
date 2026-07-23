import { TestBed } from '@angular/core/testing';

import { IceMetricsApp } from './app';

describe('IceMetricsApp', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IceMetricsApp],
    }).compileComponents();
  });

  it('creates the application shell', () => {
    const fixture = TestBed.createComponent(IceMetricsApp);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the product identity and primary heading', async () => {
    const fixture = TestBed.createComponent(IceMetricsApp);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.brand')?.textContent).toContain(
      'IceMetrics',
    );
    expect(element.querySelector('h1')?.textContent).toContain(
      'See the game beneath the score.',
    );
  });

  it('provides a keyboard skip link to the main landmark', async () => {
    const fixture = TestBed.createComponent(IceMetricsApp);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const skipLink = element.querySelector<HTMLAnchorElement>('.skip-link');
    const main = element.querySelector<HTMLElement>('main');

    expect(skipLink?.getAttribute('href')).toBe('#main-content');
    expect(main?.id).toBe('main-content');
  });
});
