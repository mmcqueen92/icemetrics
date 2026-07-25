import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type FreshnessStatus = 'current' | 'stale' | 'unknown';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-freshness-indicator',
  styles: `
    :host {
      display: inline-flex;
    }

    .freshness {
      display: inline-grid;
      align-items: center;
      color: var(--color-text-muted);
      font-size: 0.75rem;
      gap: 1px var(--space-2);
      grid-template-columns: auto 1fr;
    }

    .dot {
      width: 8px;
      height: 8px;
      background: var(--status-color);
      border-radius: 50%;
      grid-row: 1 / 3;
    }

    strong {
      color: var(--color-text);
      font-size: 0.8125rem;
    }
  `,
  template: `
    <span
      class="freshness"
      [style.--status-color]="statusColor()"
      [attr.aria-label]="accessibleLabel()"
    >
      <span class="dot" aria-hidden="true"></span>
      <strong>{{ label() }}</strong>
      <span>{{ detail() }}</span>
    </span>
  `,
})
export class FreshnessIndicatorComponent {
  readonly detail = input.required<string>();
  readonly label = input.required<string>();
  readonly status = input<FreshnessStatus>('unknown');

  protected readonly accessibleLabel = computed(
    () => `${this.label()}: ${this.detail()}. Status ${this.status()}.`,
  );
  protected readonly statusColor = computed(() => {
    switch (this.status()) {
      case 'current':
        return 'var(--color-success)';
      case 'stale':
        return 'var(--color-warning)';
      default:
        return 'var(--color-text-muted)';
    }
  });
}
