import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { GlobalErrorService } from './global-error.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  selector: 'app-global-error-notification',
  styles: `
    :host {
      position: fixed;
      right: var(--space-4);
      bottom: var(--space-4);
      z-index: 50;
      width: min(420px, calc(100% - var(--space-8)));
    }

    .notice {
      display: flex;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      border: 1px solid color-mix(in srgb, var(--color-error) 55%, transparent);
      color: var(--color-text);
      background: var(--color-surface-raised);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-raised);
      gap: var(--space-3);
    }

    p {
      flex: 1;
      margin: 0;
    }
  `,
  template: `
    @if (errors.notice(); as notice) {
      <section
        class="notice"
        role="status"
        aria-live="polite"
        [attr.data-notice-id]="notice.id"
      >
        <p>{{ notice.message }}</p>
        <button mat-button type="button" (click)="errors.dismiss()">
          Dismiss
        </button>
      </section>
    }
  `,
})
export class GlobalErrorNotificationComponent {
  protected readonly errors = inject(GlobalErrorService);
}
