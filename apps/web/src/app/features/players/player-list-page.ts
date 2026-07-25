import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  switchMap,
} from 'rxjs';

import { ExplorerApiService } from '../../core/api/explorer-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import {
  displayOptional,
  displayTeamAbbreviation,
} from '../../shared/formatters/hockey-formatters';
import { QueryValuePipe } from '../../shared/pipes/query-value.pipe';
import { asRequestState } from '../../shared/state/request-state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    MatButtonModule,
    PageHeaderComponent,
    PaginationComponent,
    ReactiveFormsModule,
    RouterLink,
    QueryValuePipe,
  ],
  selector: 'app-player-list-page',
  template: `
    <div class="page">
      <app-page-header
        eyebrow="Player explorer"
        title="Performance, game by game."
        description="Search active and historical NHL players, then open a profile for game-level context."
      />

      <section class="surface" aria-labelledby="player-filters-heading">
        <h2 id="player-filters-heading">Filter players</h2>
        <div class="filter-bar">
          <label>
            Search
            <input
              type="search"
              [formControl]="search"
              placeholder="At least 2 characters"
            />
          </label>
          <label>
            Team
            <select
              [value]="route.queryParamMap | async | queryValue: 'team'"
              (change)="setFilter('team', $any($event.target).value)"
            >
              <option value="">All teams</option>
              @for (team of teams(); track team.id) {
                <option [value]="team.id">{{ team.name }}</option>
              }
            </select>
          </label>
          <label>
            Position
            <select
              [value]="route.queryParamMap | async | queryValue: 'position'"
              (change)="setFilter('position', $any($event.target).value)"
            >
              <option value="">All positions</option>
              <option value="C">Centre</option>
              <option value="L">Left wing</option>
              <option value="R">Right wing</option>
              <option value="D">Defence</option>
              <option value="G">Goaltender</option>
            </select>
          </label>
          <label>
            Status
            <select
              [value]="route.queryParamMap | async | queryValue: 'active'"
              (change)="setFilter('active', $any($event.target).value)"
            >
              <option value="">All players</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label>
            Sort by
            <select
              [value]="
                (route.queryParamMap | async | queryValue: 'sort') || 'lastName'
              "
              (change)="setFilter('sort', $any($event.target).value)"
            >
              <option value="lastName">Last name</option>
              <option value="firstName">First name</option>
              <option value="position">Position</option>
            </select>
          </label>
          <label>
            Order
            <select
              [value]="
                (route.queryParamMap | async | queryValue: 'order') || 'asc'
              "
              (change)="setFilter('order', $any($event.target).value)"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <button mat-button type="button" (click)="resetFilters()">
            Reset
          </button>
        </div>
        @if (search.value.trim().length === 1) {
          <p class="muted" role="status">Enter one more character to search.</p>
        }
      </section>

      @switch (state().status) {
        @case ('loading') {
          <app-loading-state message="Loading players…" />
        }
        @case ('error') {
          <app-error-state
            [message]="state().error?.message ?? 'Unable to load players.'"
            (retry)="retry()"
          />
        }
        @case ('success') {
          @if (state().value; as result) {
            <section class="surface" aria-labelledby="player-results-heading">
              <div class="surface-header">
                <h2 id="player-results-heading">Players</h2>
                <span class="muted">{{ result.meta.totalItems }} results</span>
              </div>
              @if (result.data.length) {
                <div class="table-scroll">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Player</th>
                        <th scope="col">Position</th>
                        <th scope="col">Team</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (player of result.data; track player.id) {
                        <tr>
                          <td>
                            <a [routerLink]="['/players', player.id]">
                              {{ player.firstName }} {{ player.lastName }}
                            </a>
                          </td>
                          <td>{{ displayOptional(player.position, '—') }}</td>
                          <td>
                            {{ displayTeamAbbreviation(player.currentTeam) }}
                          </td>
                          <td>{{ player.active ? 'Active' : 'Inactive' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <app-pagination
                  [page]="result.meta.page"
                  [totalPages]="result.meta.totalPages"
                  (pageChange)="setPage($event)"
                />
              } @else {
                <app-empty-state
                  message="No players match these filters."
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
export class PlayerListPageComponent {
  protected readonly displayOptional = displayOptional;
  protected readonly displayTeamAbbreviation = displayTeamAbbreviation;
  protected readonly route = inject(ActivatedRoute);
  protected readonly search = new FormControl('', { nonNullable: true });
  private readonly api = inject(ExplorerApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh = new BehaviorSubject(0);
  private readonly router = inject(Router);
  private readonly teamOptions = new BehaviorSubject<
    readonly { id: string; name: string }[]
  >([]);

  protected readonly state = toSignal(
    combineLatest([this.route.queryParamMap, this.refresh]).pipe(
      switchMap(([params]) => {
        const search = params.get('q')?.trim() ?? '';
        return asRequestState(
          forkJoin({
            players: this.api.listPlayers({
              active: parseBoolean(params.get('active')),
              order: params.get('order') === 'desc' ? 'desc' : 'asc',
              page: parsePage(params.get('page')),
              pageSize: 25,
              position: parsePosition(params.get('position')),
              search: search.length >= 2 ? search : undefined,
              sort: parseSort(params.get('sort')),
              teamId: params.get('team') || undefined,
            }),
            teams: this.api.listTeams(),
          }),
        );
      }),
      map((request) => {
        if (request.status === 'success') {
          this.teamOptions.next(request.value.teams.data);
          return {
            error: undefined,
            status: 'success',
            value: request.value.players,
          } as const;
        }
        return request;
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

  protected readonly teams = toSignal(this.teamOptions, { initialValue: [] });

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) =>
        this.search.setValue(params.get('q') ?? '', { emitEvent: false }),
      );
    this.search.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => this.setFilter('q', value.trim()));
  }

  protected setFilter(name: string, value: string): void {
    void this.router.navigate([], {
      queryParams: { [name]: value || null, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: name === 'q',
    });
  }

  protected setPage(page: number): void {
    void this.router.navigate([], {
      queryParams: { page: page === 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  protected resetFilters(): void {
    this.search.setValue('', { emitEvent: false });
    void this.router.navigate([], {
      queryParams: {
        active: null,
        order: null,
        page: null,
        position: null,
        q: null,
        sort: null,
        team: null,
      },
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

function parseBoolean(value: string | null): boolean | undefined {
  return value === 'true' ? true : value === 'false' ? false : undefined;
}

function parsePosition(value: string | null) {
  return value && ['C', 'D', 'G', 'L', 'R'].includes(value)
    ? (value as 'C' | 'D' | 'G' | 'L' | 'R')
    : undefined;
}

function parseSort(value: string | null) {
  const sorts = ['firstName', 'lastName', 'position'] as const;
  return sorts.find((sort) => sort === value) ?? 'lastName';
}
