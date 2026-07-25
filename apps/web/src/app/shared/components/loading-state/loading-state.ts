import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule],
  selector: 'app-loading-state',
  styles: `
    :host {
      display: grid;
      min-height: 180px;
      color: var(--color-text-muted);
      place-items: center;
    }

    .content {
      display: grid;
      justify-items: center;
      gap: var(--space-3);
    }

    p {
      margin: 0;
    }
  `,
  template: `
    <div class="content" role="status" aria-live="polite">
      <mat-spinner [diameter]="36" aria-hidden="true" />
      <p>{{ message() }}</p>
    </div>
  `,
})
export class LoadingStateComponent {
  readonly message = input('Loading data…');
}
