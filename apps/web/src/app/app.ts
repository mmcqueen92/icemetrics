import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';

import { FreshnessIndicatorComponent } from './shared/components/freshness-indicator/freshness-indicator';
import { GlobalErrorNotificationComponent } from './core/errors/global-error-notification.component';
import { NavigationProgressService } from './core/routing/navigation-progress.service';
import { environment } from '../environments/environment';

interface NavigationItem {
  exact: boolean;
  label: string;
  path: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FreshnessIndicatorComponent,
    GlobalErrorNotificationComponent,
    MatButtonModule,
    MatProgressBarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  selector: 'app-root',
  host: {
    '[attr.data-environment]': 'environmentName',
    '[attr.data-release]': 'releaseVersion',
  },
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class IceMetricsApp {
  protected readonly environmentName = environment.environmentName;
  protected readonly releaseVersion = environment.releaseVersion;
  @ViewChild('mainContent', { read: ElementRef })
  private mainContent?: ElementRef<HTMLElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private hasCompletedNavigation = false;

  protected readonly navigation: readonly NavigationItem[] = [
    { exact: true, label: 'Dashboard', path: '/' },
    { exact: false, label: 'Teams', path: '/teams' },
    { exact: false, label: 'Players', path: '/players' },
    { exact: false, label: 'Games', path: '/games' },
    { exact: false, label: 'Analytics', path: '/analytics' },
  ];
  protected readonly navigationProgress = inject(NavigationProgressService);
  protected readonly title = 'IceMetrics';

  constructor() {
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (!this.hasCompletedNavigation) {
          this.hasCompletedNavigation = true;
          return;
        }

        queueMicrotask(() => this.mainContent?.nativeElement.focus());
      });
  }
}
