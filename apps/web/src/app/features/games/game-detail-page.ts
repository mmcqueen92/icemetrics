import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  map,
  of,
  switchMap,
  throwError,
} from 'rxjs';

import type {
  GameDetailDto,
  PaginationMetaDto,
  PlayerBoxScoreDto,
} from '../../core/api/generated/model/models';
import { ExplorerApiService } from '../../core/api/explorer-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state';
import { NotFoundComponent } from '../../shared/components/not-found/not-found.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge';
import {
  displayOptional,
  formatPercentage,
  formatTimeOnIce,
} from '../../shared/formatters/hockey-formatters';
import { asRequestState } from '../../shared/state/request-state';

interface GameDetailData {
  game: GameDetailDto;
  playerStats: PlayerBoxScoreDto[] | null;
  playerStatsMeta: PaginationMetaDto | null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    NotFoundComponent,
    PageHeaderComponent,
    PaginationComponent,
    RouterLink,
    StatusBadgeComponent,
  ],
  selector: 'app-game-detail-page',
  template: `
    <div class="page">
      @switch (state().status) {
        @case ('loading') {
          <app-loading-state message="Loading game details…" />
        }
        @case ('error') {
          @if (state().error?.notFound) {
            <app-not-found
              title="Game not found"
              message="This game does not exist in the stored NHL data."
            />
          } @else {
            <app-error-state
              [message]="state().error?.message ?? 'Unable to load this game.'"
              (retry)="retry()"
            />
          }
        }
        @case ('success') {
          @if (state().value; as detail) {
            <app-page-header
              eyebrow="Game detail"
              [title]="
                detail.game.away.team.abbreviation +
                ' at ' +
                detail.game.home.team.abbreviation
              "
              [description]="(detail.game.startsAt | date: 'full') ?? ''"
            />

            <section class="surface" aria-labelledby="score-heading">
              <div class="surface-header">
                <h2 id="score-heading">Game summary</h2>
                <app-status-badge [status]="detail.game.status" />
              </div>
              <div class="scoreline">
                <a [routerLink]="['/teams', detail.game.away.team.id]">
                  {{ detail.game.away.team.name }}
                </a>
                <strong class="score">{{
                  displayOptional(detail.game.away.score, '—')
                }}</strong>
                <span>at</span>
                <strong class="score">{{
                  displayOptional(detail.game.home.score, '—')
                }}</strong>
                <a [routerLink]="['/teams', detail.game.home.team.id]">
                  {{ detail.game.home.team.name }}
                </a>
              </div>
              <dl class="definition-list">
                <dt>Venue</dt>
                <dd>{{ displayOptional(detail.game.venue) }}</dd>
                <dt>Game type</dt>
                <dd>{{ displayValue(detail.game.gameType) }}</dd>
                <dt>Decision</dt>
                <dd>
                  {{
                    detail.game.decisionType
                      ? displayValue(detail.game.decisionType)
                      : 'Not decided'
                  }}
                </dd>
              </dl>
            </section>

            @if (detail.game.teamStats.length) {
              <section class="surface" aria-labelledby="team-stats-heading">
                <h2 id="team-stats-heading">Team statistics</h2>
                <div class="table-scroll">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Team</th>
                        <th scope="col" class="numeric">Shots</th>
                        <th scope="col" class="numeric">Power play</th>
                        <th scope="col" class="numeric">PIM</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of detail.game.teamStats; track row.team.id) {
                        <tr>
                          <td>{{ row.team.name }}</td>
                          <td class="numeric">{{ row.shotsFor }}</td>
                          <td class="numeric">
                            {{ row.powerPlayGoals }}/{{
                              row.powerPlayOpportunities
                            }}
                            ({{ formatPercentage(row.powerPlayPercentage) }})
                          </td>
                          <td class="numeric">{{ row.penaltyMinutes }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </section>
            } @else {
              <app-empty-state
                title="Statistics not yet available"
                message="Team and player statistics appear after a game begins and stored box-score data is available."
              />
            }

            @if (detail.playerStats !== null) {
              <section class="surface" aria-labelledby="box-score-heading">
                <div class="surface-header">
                  <h2 id="box-score-heading">Player box score</h2>
                  <div class="filter-bar">
                    <label>
                      Sort
                      <select
                        [value]="queryValue('sort') || 'points'"
                        (change)="setSort($any($event.target).value)"
                      >
                        <option value="points">Points</option>
                        <option value="shots">Shots</option>
                        <option value="timeOnIceSeconds">Time on ice</option>
                        <option value="lastName">Last name</option>
                      </select>
                    </label>
                    <label>
                      Order
                      <select
                        [value]="queryValue('order') || 'desc'"
                        (change)="setOrder($any($event.target).value)"
                      >
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                      </select>
                    </label>
                  </div>
                </div>
                @if (detail.playerStats.length) {
                  <div class="table-scroll">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Player</th>
                          <th scope="col">Team</th>
                          <th scope="col" class="numeric">G</th>
                          <th scope="col" class="numeric">A</th>
                          <th scope="col" class="numeric">PTS</th>
                          <th scope="col" class="numeric">Shots</th>
                          <th scope="col" class="numeric">TOI</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of detail.playerStats; track row.player.id) {
                          <tr>
                            <td>
                              <a [routerLink]="['/players', row.player.id]">
                                {{ row.player.firstName }}
                                {{ row.player.lastName }}
                              </a>
                            </td>
                            <td>{{ row.team.abbreviation }}</td>
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
                  @if (detail.playerStatsMeta) {
                    <app-pagination
                      [page]="detail.playerStatsMeta.page"
                      [totalPages]="detail.playerStatsMeta.totalPages"
                      (pageChange)="setPage($event)"
                    />
                  }
                } @else {
                  <app-empty-state
                    message="No player box-score rows are available."
                  />
                }
              </section>
            }
          }
        }
      }
    </div>
  `,
})
export class GameDetailPageComponent {
  protected readonly displayOptional = displayOptional;
  protected readonly formatPercentage = formatPercentage;
  protected readonly formatTimeOnIce = formatTimeOnIce;
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
      switchMap(([path, query]) => {
        const id = path.get('id');
        if (!id) {
          return asRequestState(
            throwError(() => new Error('Game identifier is unavailable.')),
          );
        }
        const page = parsePage(query.get('page'));
        const order = query.get('order') === 'asc' ? 'asc' : 'desc';
        const sort = parseSort(query.get('sort'));
        return asRequestState(
          this.api.getGame(id).pipe(
            switchMap((gameResponse) => {
              const game = gameResponse.data;
              if (!['FINAL', 'LIVE'].includes(game.status)) {
                return of({
                  game,
                  playerStats: null,
                  playerStatsMeta: null,
                } satisfies GameDetailData);
              }
              return this.api.listGamePlayerStats(id, page, sort, order).pipe(
                map(
                  (stats) =>
                    ({
                      game,
                      playerStats: stats.data,
                      playerStatsMeta: stats.meta,
                    }) satisfies GameDetailData,
                ),
              );
            }),
          ),
        );
      }),
    ),
    {
      initialValue: {
        error: undefined,
        status: 'loading',
        value: undefined,
      } as const,
    },
  );

  protected displayValue(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }

  protected queryValue(name: string): string {
    return this.route.snapshot.queryParamMap.get(name) ?? '';
  }

  protected setSort(sort: string): void {
    void this.router.navigate([], {
      queryParams: { page: null, sort },
      queryParamsHandling: 'merge',
    });
  }

  protected setOrder(order: string): void {
    void this.router.navigate([], {
      queryParams: { order, page: null },
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
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseSort(value: string | null) {
  const sorts = ['lastName', 'points', 'shots', 'timeOnIceSeconds'] as const;
  return sorts.find((sort) => sort === value) ?? 'points';
}
