import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

interface FeaturePageData {
  description: string;
  eyebrow: string;
  title: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-feature-placeholder',
  styles: `
    :host {
      display: block;
    }

    .hero {
      display: grid;
      max-width: 920px;
      min-height: min(60vh, 600px);
      align-content: center;
    }

    .eyebrow {
      margin: 0 0 var(--space-4);
      color: var(--color-primary);
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(2.75rem, 9vw, 6.5rem);
      letter-spacing: -0.06em;
      line-height: 0.95;
    }

    .description {
      max-width: 64ch;
      margin: var(--space-6) 0 0;
      color: var(--color-text-muted);
      font-size: clamp(1rem, 2vw, 1.2rem);
      line-height: 1.7;
    }

    .foundation-note {
      width: fit-content;
      padding: var(--space-2) var(--space-3);
      margin: var(--space-6) 0 0;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      background: var(--color-surface-raised);
      border-radius: 999px;
      font-size: 0.8125rem;
    }
  `,
  template: `
    <section class="hero" [attr.aria-labelledby]="headingId">
      <p class="eyebrow">{{ data.eyebrow }}</p>
      <h1 [id]="headingId">{{ data.title }}</h1>
      <p class="description">{{ data.description }}</p>
      <p class="foundation-note">Feature foundation ready</p>
    </section>
  `,
})
export class FeaturePlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly data = this.route.snapshot.data as FeaturePageData;
  protected readonly headingId = 'feature-page-title';
}
