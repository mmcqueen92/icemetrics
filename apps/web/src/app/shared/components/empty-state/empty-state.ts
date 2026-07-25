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
  selector: 'app-empty-state',
  styles: `
    :host {
      display: block;
      padding: var(--space-8);
      border: 1px dashed var(--color-border);
      text-align: center;
      background: var(--color-surface-raised);
      border-radius: var(--radius-lg);
    }

    h2 {
      margin: 0 0 var(--space-2);
      font-size: 1.25rem;
    }

    p {
      max-width: 52ch;
      margin: 0 auto var(--space-4);
      color: var(--color-text-muted);
    }
  `,
  template: `
    <section aria-labelledby="empty-state-title">
      <h2 id="empty-state-title">{{ title() }}</h2>
      <p>{{ message() }}</p>
      @if (actionLabel()) {
        <button mat-stroked-button type="button" (click)="action.emit()">
          {{ actionLabel() }}
        </button>
      }
    </section>
  `,
})
export class EmptyStateComponent {
  readonly action = output<void>();
  readonly actionLabel = input<string | null>(null);
  readonly message = input.required<string>();
  readonly title = input('No results');
}
