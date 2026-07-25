import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, forkJoin, map, switchMap } from 'rxjs';

import type {
  SeasonSummaryDto,
  StandingDto,
  TeamSummaryDto,
} from '../../core/api/generated/model/models';
import { ExplorerApiService } from '../../core/api/explorer-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { formatRatioPercentage } from '../../shared/formatters/hockey-formatters';
import { isActiveSeasonDataStale } from '../../shared/formatters/freshness';
import { asRequestState } from '../../shared/state/request-state';

interface TeamListData {
  seasons: SeasonSummaryDto[];
  selectedSeason: SeasonSummaryDto;
  standings: StandingDto[];
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
    RouterLink,
  ],
  selector: 'app-team-list-page',
  template: `
    <div class="page">
      <app-page-header
        eyebrow="Team explorer"
        title="The league at a glance."
        description="Browse NHL teams alongside an official, dated standings snapshot."
      />

      @switch (state().status) {
        @case ('loading') {
          <app-loading-state message="Loading teams and standings…" />
        }
        @case ('error') {
          <app-error-state
            [message]="state().error?.message ?? 'Unable to load teams.'"
            (retry)="retry()"
          />
        }
        @case ('success') {
          @if (state().value; as result) {
            <section class="surface" aria-labelledby="standings-heading">
              <div class="surface-header">
                <h2 id="standings-heading">Official standings</h2>
                <div class="filter-bar">
                  <label>
                    Season
                    <select
                      [value]="result.selectedSeason.id"
                      (change)="setFilter('season', $any($event.target).value)"
                    >
                      @for (season of result.seasons; track season.id) {
                        <option [value]="season.id">{{ season.label }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    Snapshot date
                    <input
                      type="date"
                      [value]="asOfDate()"
                      (change)="setFilter('asOf', $any($event.target).value)"
                    />
                  </label>
                </div>
              </div>

              @if (result.standings[0]; as firstStanding) {
                <p
                  class="freshness-note"
                  [attr.role]="
                    isStale(firstStanding.sourceCutoff, result.selectedSeason)
                      ? 'alert'
                      : 'status'
                  "
                >
                  Snapshot {{ firstStanding.asOfDate | date: 'longDate' }} ·
                  source cutoff
                  {{ firstStanding.sourceCutoff | date: 'medium' }}.
                  @if (
                    isStale(firstStanding.sourceCutoff, result.selectedSeason)
                  ) {
                    This active-season data is older than the two-hour freshness
                    target.
                  }
                </p>
                <div class="table-scroll">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col" class="numeric">Rank</th>
                        <th scope="col">Team</th>
                        <th scope="col" class="numeric">GP</th>
                        <th scope="col" class="numeric">W</th>
                        <th scope="col" class="numeric">L</th>
                        <th scope="col" class="numeric">OTL</th>
                        <th scope="col" class="numeric">PTS</th>
                        <th scope="col" class="numeric">PTS%</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (
                        standing of result.standings;
                        track standing.team.id
                      ) {
                        <tr>
                          <td class="numeric">{{ standing.leagueRank }}</td>
                          <td>
                            <a [routerLink]="['/teams', standing.team.id]">
                              {{ standing.team.name }}
                            </a>
                          </td>
                          <td class="numeric">{{ standing.gamesPlayed }}</td>
                          <td class="numeric">{{ standing.wins }}</td>
                          <td class="numeric">{{ standing.losses }}</td>
                          <td class="numeric">{{ standing.overtimeLosses }}</td>
                          <td class="numeric">{{ standing.points }}</td>
                          <td class="numeric">
                            {{
                              formatRatioPercentage(standing.pointPercentage)
                            }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <app-empty-state
                  message="No official standings snapshot matches this season and date."
                  actionLabel="Use latest snapshot"
                  (action)="setFilter('asOf', '')"
                />
              }
            </section>

            <section class="surface" aria-labelledby="active-teams-heading">
              <h2 id="active-teams-heading">Active teams</h2>
              @if (result.teams.length) {
                <div class="card-grid">
                  @for (team of result.teams; track team.id) {
                    <a class="link-card" [routerLink]="['/teams', team.id]">
                      <strong>{{ team.city }} {{ team.name }}</strong>
                      <p class="muted">{{ team.abbreviation }}</p>
                    </a>
                  }
                </div>
              } @else {
                <app-empty-state message="No active teams are stored." />
              }
            </section>
          }
        }
      }
    </div>
  `,
})
export class TeamListPageComponent {
  protected readonly formatRatioPercentage = formatRatioPercentage;
  protected readonly isStale = isActiveSeasonDataStale;
  private readonly api = inject(ExplorerApiService);
  private readonly refresh = new BehaviorSubject(0);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly asOfDate = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('asOf') ?? '')),
    { initialValue: '' },
  );

  protected readonly state = toSignal(
    combineLatest([this.route.queryParamMap, this.refresh]).pipe(
      switchMap(([query]) =>
        asRequestState(
          this.api.listSeasons().pipe(
            switchMap((seasonResponse) => {
              const seasons = seasonResponse.data;
              const selectedSeason =
                seasons.find((season) => season.id === query.get('season')) ??
                seasons[0];
              if (!selectedSeason) {
                throw new Error('No NHL season is available.');
              }
              if (!query.has('season')) {
                void this.router.navigate([], {
                  queryParams: { season: selectedSeason.id },
                  queryParamsHandling: 'merge',
                  replaceUrl: true,
                });
              }

              return forkJoin({
                standings: this.api.listStandings(
                  selectedSeason.id,
                  query.get('asOf') || undefined,
                ),
                teams: this.api.listTeams(),
              }).pipe(
                map(
                  (result) =>
                    ({
                      seasons,
                      selectedSeason,
                      standings: result.standings.data,
                      teams: result.teams.data,
                    }) satisfies TeamListData,
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

  protected setFilter(name: string, value: string): void {
    void this.router.navigate([], {
      queryParams: { [name]: value || null },
      queryParamsHandling: 'merge',
    });
  }

  protected retry(): void {
    this.refresh.next(this.refresh.value + 1);
  }
}
