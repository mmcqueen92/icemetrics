import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, forkJoin, map, switchMap } from 'rxjs';

import type {
  PlayerDetailDto,
  PlayerGameStatDto,
  PlayerSeasonSummaryDto,
  PlayerTrendPointDto,
  SeasonSummaryDto,
} from '../../core/api/generated/model/models';
import { ExplorerApiService } from '../../core/api/explorer-api.service';
import { AccessibleLineChartComponent } from '../../shared/components/accessible-line-chart/accessible-line-chart';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state';
import { NotFoundComponent } from '../../shared/components/not-found/not-found.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import {
  displayOptional,
  formatPercentage,
  formatRate,
  formatTimeOnIce,
} from '../../shared/formatters/hockey-formatters';
import { asRequestState } from '../../shared/state/request-state';

interface PlayerDetailData {
  gameLog: PlayerGameStatDto[];
  gameLogPage: number;
  gameLogPages: number;
  player: PlayerDetailDto;
  seasons: SeasonSummaryDto[];
  selectedSeasonId: string;
  summary: PlayerSeasonSummaryDto;
  trends: Record<5 | 10 | 20, PlayerTrendPointDto | undefined>;
  trendPoints: PlayerTrendPointDto[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccessibleLineChartComponent,
    DatePipe,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    NotFoundComponent,
    PageHeaderComponent,
    PaginationComponent,
    RouterLink,
  ],
  selector: 'app-player-detail-page',
  template: `
    <div class="page">
      @switch (state().status) {
        @case ('loading') {
          <app-loading-state message="Loading player profile…" />
        }
        @case ('error') {
          @if (state().error?.notFound) {
            <app-not-found
              title="Player not found"
              message="This player does not exist in the stored NHL data."
            />
          } @else {
            <app-error-state
              [message]="
                state().error?.message ?? 'Unable to load this player.'
              "
              (retry)="retry()"
            />
          }
        }
        @case ('success') {
          @if (state().value; as detail) {
            <app-page-header
              eyebrow="Player profile"
              [title]="detail.player.firstName + ' ' + detail.player.lastName"
              description="Game history and rolling performance, with sample sizes and data cutoffs."
            />

            <section class="surface">
              <div class="detail-header">
                <dl class="definition-list">
                  <dt>Current team</dt>
                  <dd>
                    @if (detail.player.currentTeam; as team) {
                      <a [routerLink]="['/teams', team.id]">{{ team.name }}</a>
                    } @else {
                      Unassigned
                    }
                  </dd>
                  <dt>Position</dt>
                  <dd>{{ displayOptional(detail.player.position) }}</dd>
                  <dt>Shoots/catches</dt>
                  <dd>{{ displayOptional(detail.player.shootsCatches) }}</dd>
                  <dt>Birth date</dt>
                  <dd>
                    {{ $any(detail.player.birthDate) | date: 'longDate' }}
                  </dd>
                  <dt>Status</dt>
                  <dd>{{ detail.player.active ? 'Active' : 'Inactive' }}</dd>
                </dl>
                <a
                  class="link-card"
                  routerLink="/analytics"
                  [queryParams]="{
                    tab: 'players',
                    playerIds: detail.player.id,
                    season: detail.selectedSeasonId,
                  }"
                >
                  Add to player comparison
                </a>
              </div>
            </section>

            <section class="surface" aria-labelledby="rolling-heading">
              <div class="surface-header">
                <h2 id="rolling-heading">Rolling performance</h2>
                <label>
                  Season
                  <select
                    [value]="detail.selectedSeasonId"
                    (change)="setSeason($any($event.target).value)"
                  >
                    @for (season of detail.seasons; track season.id) {
                      <option [value]="season.id">{{ season.label }}</option>
                    }
                  </select>
                </label>
              </div>
              <div class="metric-grid">
                <article class="metric-tile">
                  <span>Season</span>
                  <strong
                    >{{
                      formatRate(detail.summary.metrics.pointsPerGame)
                    }}
                    P/GP</strong
                  >
                  <p>
                    {{ formatRate(detail.summary.metrics.goalsPerGame) }} G/GP ·
                    {{
                      formatPercentage(
                        detail.summary.metrics.shootingPercentage
                      )
                    }}
                    shooting
                  </p>
                  <p class="muted">
                    {{ detail.summary.sampleSize }} game sample · formula
                    {{ detail.summary.formulaVersion }}
                  </p>
                </article>
                @for (window of windows; track window) {
                  <article class="metric-tile">
                    <span>Last {{ window }} games</span>
                    @if (detail.trends[window]; as trend) {
                      <strong
                        >{{
                          formatRate(trend.metrics.pointsPerGame)
                        }}
                        P/GP</strong
                      >
                      <p>
                        {{ formatRate(trend.metrics.goalsPerGame) }} G/GP ·
                        {{ formatPercentage(trend.metrics.shootingPercentage) }}
                        shooting
                      </p>
                      <p class="muted">
                        {{ trend.sampleSize }} game sample · through
                        {{ trend.asOfDate | date: 'mediumDate' }}
                      </p>
                    } @else {
                      <strong>Unavailable</strong>
                      <p class="muted">No eligible games in this window.</p>
                    }
                  </article>
                }
              </div>
              @if (detail.trendPoints.length) {
                <app-accessible-line-chart
                  title="Last-10 points per game"
                  [categories]="trendDates(detail.trendPoints)"
                  [series]="trendSeries(detail.trendPoints)"
                />
                <div class="table-scroll">
                  <table class="data-table">
                    <caption>
                      Equivalent last-10 rolling trend data
                    </caption>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th class="numeric">P/GP</th>
                        <th class="numeric">G/GP</th>
                        <th class="numeric">A/GP</th>
                        <th class="numeric">Sample</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (
                        trend of detail.trendPoints;
                        track trend.asOfGameId
                      ) {
                        <tr>
                          <td>{{ trend.asOfDate | date: 'mediumDate' }}</td>
                          <td class="numeric">
                            {{ formatRate(trend.metrics.pointsPerGame) }}
                          </td>
                          <td class="numeric">
                            {{ formatRate(trend.metrics.goalsPerGame) }}
                          </td>
                          <td class="numeric">
                            {{ formatRate(trend.metrics.assistsPerGame) }}
                          </td>
                          <td class="numeric">{{ trend.sampleSize }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>

            <section class="surface" aria-labelledby="game-log-heading">
              <h2 id="game-log-heading">Game log</h2>
              @if (detail.gameLog.length) {
                <div class="table-scroll">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Opponent</th>
                        <th scope="col" class="numeric">G</th>
                        <th scope="col" class="numeric">A</th>
                        <th scope="col" class="numeric">PTS</th>
                        <th scope="col" class="numeric">Shots</th>
                        <th scope="col" class="numeric">TOI</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of detail.gameLog; track row.game.id) {
                        <tr>
                          <td>
                            <a [routerLink]="['/games', row.game.id]">
                              {{ row.game.startsAt | date: 'mediumDate' }}
                            </a>
                          </td>
                          <td>
                            {{ row.isHome ? 'vs' : 'at' }}
                            {{ row.opponent.abbreviation }}
                          </td>
                          <td class="numeric">{{ row.goals }}</td>
                          <td class="numeric">{{ row.assists }}</td>
                          <td class="numeric">{{ row.points }}</td>
                          <td class="numeric">{{ row.shots }}</td>
                          <td class="numeric">
                            {{ formatTimeOnIce(row.timeOnIceSeconds) }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <app-pagination
                  [page]="detail.gameLogPage"
                  [totalPages]="detail.gameLogPages"
                  (pageChange)="setPage($event)"
                />
              } @else {
                <app-empty-state
                  message="No game statistics are available for this season."
                />
              }
            </section>
          }
        }
      }
    </div>
  `,
})
export class PlayerDetailPageComponent {
  protected readonly displayOptional = displayOptional;
  protected readonly formatPercentage = formatPercentage;
  protected readonly formatRate = formatRate;
  protected readonly formatTimeOnIce = formatTimeOnIce;
  protected readonly windows = [5, 10, 20] as const;
  private readonly api = inject(ExplorerApiService);
  private readonly refresh = new BehaviorSubject(0);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly state = toSignal(
    combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
      this.refresh,
    ]).pipe(
      switchMap(([path, query]) =>
        asRequestState(
          this.api.listSeasons().pipe(
            switchMap((seasonResponse) => {
              const seasons = seasonResponse.data;
              const selectedSeasonId = query.get('season') || seasons[0]?.id;
              const id = path.get('id');
              if (!id || !selectedSeasonId) {
                throw new Error('Player or season is unavailable.');
              }
              if (!query.has('season')) {
                void this.router.navigate([], {
                  queryParams: { season: selectedSeasonId },
                  queryParamsHandling: 'merge',
                  replaceUrl: true,
                });
              }
              const page = parsePage(query.get('page'));

              return forkJoin({
                gameLog: this.api.listPlayerStats(id, selectedSeasonId, page),
                player: this.api.getPlayer(id),
                summary: this.api.getPlayerSeasonSummary(id, selectedSeasonId),
                trend10: this.api.listPlayerTrends(id, selectedSeasonId, 10),
                trend20: this.api.listPlayerTrends(id, selectedSeasonId, 20),
                trend5: this.api.listPlayerTrends(id, selectedSeasonId, 5),
              }).pipe(
                map(
                  (result) =>
                    ({
                      gameLog: result.gameLog.data,
                      gameLogPage: result.gameLog.meta.page,
                      gameLogPages: result.gameLog.meta.totalPages,
                      player: result.player.data,
                      seasons,
                      selectedSeasonId,
                      summary: result.summary.data,
                      trends: {
                        5: result.trend5.data.at(-1),
                        10: result.trend10.data.at(-1),
                        20: result.trend20.data.at(-1),
                      },
                      trendPoints: result.trend10.data,
                    }) satisfies PlayerDetailData,
                ),
              );
            }),
          ),
        ),
      ),
    ),
    {
      initialValue: {
        error: undefined,
        status: 'loading',
        value: undefined,
      } as const,
    },
  );

  protected setSeason(season: string): void {
    void this.router.navigate([], {
      queryParams: { page: null, season },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(page: number): void {
    void this.router.navigate([], {
      queryParams: { page: page === 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  protected retry(): void {
    this.refresh.next(this.refresh.value + 1);
  }

  protected trendDates(points: PlayerTrendPointDto[]): string[] {
    return points.map((point) => point.asOfDate);
  }

  protected trendSeries(points: PlayerTrendPointDto[]) {
    return [
      {
        name: 'Points per game',
        values: points.map((point) => point.metrics.pointsPerGame),
      },
    ];
  }
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
