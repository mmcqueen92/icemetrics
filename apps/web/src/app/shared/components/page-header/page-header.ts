import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-page-header',
  template: `
    <header class="page-header">
      <p class="eyebrow">{{ eyebrow() }}</p>
      <h1>{{ title() }}</h1>
      @if (description()) {
        <p class="lede">{{ description() }}</p>
      }
    </header>
  `,
})
export class PageHeaderComponent {
  readonly description = input('');
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
}
