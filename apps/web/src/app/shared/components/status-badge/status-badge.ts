import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import { displayGameStatus } from '../../formatters/hockey-formatters';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'tone()' },
  selector: 'app-status-badge',
  template: `<span>{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  protected readonly label = computed(() => displayGameStatus(this.status()));
  protected readonly tone = computed(() =>
    ['FINAL'].includes(this.status())
      ? 'status-badge success'
      : ['LIVE', 'PRE_GAME'].includes(this.status())
        ? 'status-badge live'
        : ['POSTPONED', 'CANCELLED'].includes(this.status())
          ? 'status-badge warning'
          : 'status-badge neutral',
  );
}
