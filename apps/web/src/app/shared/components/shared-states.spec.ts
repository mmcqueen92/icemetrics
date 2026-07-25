import { TestBed } from '@angular/core/testing';

import { EmptyStateComponent } from './empty-state/empty-state';
import { ErrorStateComponent } from './error-state/error-state';
import { LoadingStateComponent } from './loading-state/loading-state';

describe('shared data states', () => {
  it('announces loading without exposing a duplicate spinner label', () => {
    const fixture = TestBed.createComponent(LoadingStateComponent);
    fixture.componentRef.setInput('message', 'Loading standings…');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const status = element.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toContain('Loading standings…');
    expect(
      element.querySelector('mat-spinner')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('exposes an optional empty-state action as a keyboard button', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    const action = vi.fn();
    fixture.componentRef.setInput('message', 'No teams match these filters.');
    fixture.componentRef.setInput('actionLabel', 'Reset filters');
    fixture.componentInstance.action.subscribe(action);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>('button');
    button?.click();

    expect(button?.type).toBe('button');
    expect(action).toHaveBeenCalledOnce();
  });

  it('announces recoverable errors and emits retry', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const alert = element.querySelector('[role="alert"]');
    const button = element.querySelector<HTMLButtonElement>('button');
    button?.click();

    expect(alert?.getAttribute('aria-labelledby')).toBe('error-state-title');
    expect(button?.textContent).toContain('Try again');
    expect(retry).toHaveBeenCalledOnce();
  });
});
