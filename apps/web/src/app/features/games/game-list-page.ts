import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, forkJoin, map, switchMap } from 'rxjs';

import type {
  GameSummaryDto,
  PaginationMetaDto,
  SeasonSummaryDto,
  TeamSummaryDto,
} from '../../core/api/generated/model/models';
import { ExplorerApiService } from '../../core/api/explorer-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge';
import { displayOptional } from '../../shared/formatters/hockey-formatters';
import { asRequestState } from '../../shared/state/request-state';

interface GameListData {
  games: GameSummaryDto[];
  meta: PaginationMetaDto;
  seasons: SeasonSummaryDto[];
  selectedSeasonId: string;
  teams: TeamSummaryDto[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    PaginationComponent,
    RouterLink,
    StatusBadgeComponent,
  ],
  selector: 'app-game-list-page',
  template: `
    <div class="page">
      <app-page-header
        eyebrow="Game explorer"
        title="Every game, clearly stated."
        description="Browse a bounded NHL schedule with status, score, and venue kept explicit."
      />

      @switch (state().status) {
        @case ('loading') {
          <app-loading-state message="Loading games…" />
        }
        @case ('error') {
          <app-error-state
            [message]="state().error?.message ?? 'Unable to load games.'"
            (retry)="retry()"
          />
        }
        @case ('success') {
          @if (state().value; as result) {
            <section class="surface" aria-labelledby="game-filters-heading">
              <h2 id="game-filters-heading">Filter games</h2>
              <div class="filter-bar">
                <label>
                  Season
                  <select
                    [value]="result.selectedSeasonId"
                    (change)="setFilter('season', $any($event.target).value)"
                  >
                    @for (season of result.seasons; track season.id) {
                      <option [value]="season.id">{{ season.label }}</option>
                    }
                  </select>
                </label>
                <label>
                  Team
                  <select
                    [value]="queryValue('team')"
                    (change)="setFilter('team', $any($event.target).value)"
                  >
                    <option value="">All teams</option>
                    @for (team of result.teams; track team.id) {
                      <option [value]="team.id">{{ team.name }}</option>
                    }
                  </select>
                </label>
                <label>
                  Status
                  <select
                    [value]="queryValue('status')"
                    (change)="setFilter('status', $any($event.target).value)"
                  >
                    <option value="">All statuses</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="PRE_GAME">Pre-game</option>
                    <option value="LIVE">Live</option>
                    <option value="FINAL">Final</option>
                    <option value="POSTPONED">Postponed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>
                <label>
                  Game type
                  <select
                    [value]="queryValue('type')"
                    (change)="setFilter('type', $any($event.target).value)"
                  >
                    <option value="">All types</option>
                    <option value="REGULAR_SEASON">Regular season</option>
                    <option value="PLAYOFF">Playoffs</option>
                    <option value="PRESEASON">Preseason</option>
                    <option value="ALL_STAR">All-Star</option>
                  </select>
                </label>
                <label>
                  From
                  <input
                    type="date"
                    [value]="queryValue('from')"
                    (change)="setFilter('from', $any($event.target).value)"
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    [value]="queryValue('to')"
                    (change)="setFilter('to', $any($event.target).value)"
                  />
                </label>
                <button type="button" (click)="resetFilters()">
                  Reset filters
                </button>
              </div>
            </section>

            <section class="surface" aria-labelledby="games-heading">
              <div class="surface-header">
                <h2 id="games-heading">Schedule and results</h2>
                <span class="muted">{{ result.meta.totalItems }} games</span>
              </div>
              @if (result.games.length) {
                <div class="card-grid">
                  @for (game of result.games; track game.id) {
                    <a class="link-card" [routerLink]="['/games', game.id]">
                      <div class="surface-header">
                        <app-status-badge [status]="game.status" />
                        <span>{{ game.startsAt | date: 'medium' }}</span>
                      </div>
                      <div class="scoreline">
                        <span>{{ game.away.team.abbreviation }}</span>
                        <strong class="score">{{
                          displayOptional(game.away.score, '—')
                        }}</strong>
                        <span>at</span>
                        <strong class="score">{{
                          displayOptional(game.home.score, '—')
                        }}</strong>
                        <span>{{ game.home.team.abbreviation }}</span>
                      </div>
                      <p class="muted">
                        {{ displayOptional(game.venue, 'Venue unavailable') }}
                      </p>
                    </a>
                  }
                </div>
                <app-pagination
                  [page]="result.meta.page"
                  [totalPages]="result.meta.totalPages"
                  (pageChange)="setPage($event)"
                />
              } @else {
                <app-empty-state
                  message="No games match these filters."
                  actionLabel="Reset filters"
                  (action)="resetFilters()"
                />
              }
            </section>
          }
        }
      }
    </div>
  `,
})
export class GameListPageComponent {
  protected readonly displayOptional = displayOptional;
  private readonly api = inject(ExplorerApiService);
  private readonly refresh = new BehaviorSubject(0);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly state = toSignal(
    combineLatest([this.route.queryParamMap, this.refresh]).pipe(
      switchMap(([query]) =>
        asRequestState(
          forkJoin({
            seasons: this.api.listSeasons(),
            teams: this.api.listTeams(),
          }).pipe(
            switchMap((options) => {
              const selectedSeasonId =
                query.get('season') || options.seasons.data[0]?.id;
              if (!selectedSeasonId) {
                throw new Error('No NHL season is available.');
              }
              if (!query.has('season')) {
                void this.router.navigate([], {
                  queryParams: { season: selectedSeasonId },
                  queryParamsHandling: 'merge',
                  replaceUrl: true,
                });
              }
              return this.api
                .listGames({
                  dateFrom: query.get('from') || undefined,
                  dateTo: query.get('to') || undefined,
                  gameType: parseGameType(query.get('type')),
                  order: 'desc',
                  page: parsePage(query.get('page')),
                  pageSize: 25,
                  seasonId: selectedSeasonId,
                  sort: 'startsAt',
                  status: parseStatus(query.get('status')),
                  teamId: query.get('team') || undefined,
                })
                .pipe(
                  map(
                    (games) =>
                      ({
                        games: games.data,
                        meta: games.meta,
                        seasons: options.seasons.data,
                        selectedSeasonId,
                        teams: options.teams.data,
                      }) satisfies GameListData,
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

  protected queryValue(name: string): string {
    return this.route.snapshot.queryParamMap.get(name) ?? '';
  }

  protected setFilter(name: string, value: string): void {
    void this.router.navigate([], {
      queryParams: { [name]: value || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(page: number): void {
    void this.router.navigate([], {
      queryParams: { page: page === 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  protected resetFilters(): void {
    void this.router.navigate([], {
      queryParams: {
        from: null,
        page: null,
        status: null,
        team: null,
        to: null,
        type: null,
      },
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

function parseStatus(value: string | null) {
  const statuses = [
    'CANCELLED',
    'FINAL',
    'LIVE',
    'POSTPONED',
    'PRE_GAME',
    'SCHEDULED',
  ] as const;
  return statuses.find((status) => status === value);
}

function parseGameType(value: string | null) {
  const types = ['ALL_STAR', 'PLAYOFF', 'PRESEASON', 'REGULAR_SEASON'] as const;
  return types.find((type) => type === value);
}
