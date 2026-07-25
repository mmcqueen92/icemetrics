import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  selector: 'app-error-state',
  styles: `
    :host {
      display: block;
      padding: var(--space-6);
      border-left: 4px solid var(--color-error);
      background: var(--color-surface-raised);
      border-radius: var(--radius-sm);
    }

    h2 {
      margin: 0 0 var(--space-2);
      font-size: 1.25rem;
    }

    p {
      margin: 0 0 var(--space-4);
      color: var(--color-text-muted);
    }
  `,
  template: `
    <section role="alert" aria-labelledby="error-state-title">
      <h2 id="error-state-title">{{ title() }}</h2>
      <p>{{ message() }}</p>
      <button mat-stroked-button type="button" (click)="retry.emit()">
        {{ retryLabel() }}
      </button>
    </section>
  `,
})
export class ErrorStateComponent {
  readonly message = input(
    'The data could not be loaded. Your filters have been preserved.',
  );
  readonly retry = output<void>();
  readonly retryLabel = input('Try again');
  readonly title = input('Unable to load data');
}
