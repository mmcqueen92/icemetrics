import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, RouterLink],
  selector: 'app-not-found',
  styles: `
    :host {
      display: block;
      max-width: 680px;
      padding: clamp(var(--space-6), 8vw, 72px) 0;
    }

    .code {
      margin: 0 0 var(--space-3);
      color: var(--color-primary);
      font-weight: 800;
      letter-spacing: 0.14em;
    }

    h1 {
      margin: 0;
      font-size: clamp(2.5rem, 8vw, 5rem);
      letter-spacing: -0.05em;
      line-height: 1;
    }

    .message {
      margin: var(--space-5) 0;
      color: var(--color-text-muted);
      font-size: 1.125rem;
      line-height: 1.6;
    }
  `,
  template: `
    <section aria-labelledby="not-found-title">
      <p class="code">404</p>
      <h1 id="not-found-title">{{ title() }}</h1>
      <p class="message">{{ message() }}</p>
      <a mat-flat-button routerLink="/">Return to dashboard</a>
    </section>
  `,
})
export class NotFoundComponent {
  readonly message = input(
    'The address may be incorrect, or the page may have moved.',
  );
  readonly title = input('That page is offside.');
}
