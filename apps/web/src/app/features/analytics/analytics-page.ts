import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  forkJoin,
  map,
  of,
  switchMap,
} from 'rxjs';

import type {
  PlayerComparisonDto,
  PlayerSummaryDto,
  SeasonSummaryDto,
  TeamRankingDto,
  TeamSummaryDto,
  TeamTrendPointDto,
} from '../../core/api/generated/model/models';
import { ExplorerApiService } from '../../core/api/explorer-api.service';
import { AccessibleLineChartComponent } from '../../shared/components/accessible-line-chart/accessible-line-chart';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import {
  formatPercentage,
  formatRate,
  formatRatioPercentage,
} from '../../shared/formatters/hockey-formatters';
import {
  asRequestState,
  type RequestState,
} from '../../shared/state/request-state';

type Tab = 'players' | 'rankings';
type Window = 'season' | '5' | '10' | '20';
interface AnalyticsData {
  asOfDate: string | undefined;
  comparison: PlayerComparisonDto | undefined;
  players: PlayerSummaryDto[];
  rankings: TeamRankingDto[];
  seasonId: string;
  seasons: SeasonSummaryDto[];
  selectedPlayerIds: string[];
  selectedTeamId: string | undefined;
  tab: Tab;
  teams: TeamSummaryDto[];
  teamTrend: TeamTrendPointDto[];
  window: Window;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccessibleLineChartComponent,
    DatePipe,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
  ],
  selector: 'app-analytics-page',
  template: `
    <div class="page">
      <app-page-header
        eyebrow="Analytics"
        title="Trends you can inspect."
        description="Compare production and inspect team rankings with visible formulas, samples, and cutoffs."
      />
      @switch (state().status) {
        @case ('loading') {
          <app-loading-state message="Loading analytics…" />
        }
        @case ('error') {
          <app-error-state
            [message]="state().error?.message ?? 'Unable to load analytics.'"
            (retry)="retry()"
          />
        }
        @case ('success') {
          @if (state().value; as data) {
            <nav class="tab-list" aria-label="Analytics views">
              <button
                type="button"
                [attr.aria-current]="data.tab === 'players' ? 'page' : null"
                (click)="setQuery({ tab: 'players' })"
              >
                Player comparison
              </button>
              <button
                type="button"
                [attr.aria-current]="data.tab === 'rankings' ? 'page' : null"
                (click)="setQuery({ tab: 'rankings' })"
              >
                Team rankings
              </button>
            </nav>
            <section class="surface filter-bar" aria-label="Analytics filters">
              <label>
                Season
                <select
                  [value]="data.seasonId"
                  (change)="setQuery({ season: $any($event.target).value })"
                >
                  @for (season of data.seasons; track season.id) {
                    <option [value]="season.id">{{ season.label }}</option>
                  }
                </select>
              </label>
              @if (data.tab === 'players') {
                <label>
                  Window
                  <select
                    [value]="data.window"
                    (change)="setQuery({ window: $any($event.target).value })"
                  >
                    <option value="season">Season</option>
                    <option value="5">Last 5</option>
                    <option value="10">Last 10</option>
                    <option value="20">Last 20</option>
                  </select>
                </label>
                <label>
                  Players (select 2–5)
                  <select
                    multiple
                    size="6"
                    (change)="setPlayers($any($event.target))"
                  >
                    @for (player of data.players; track player.id) {
                      <option
                        [value]="player.id"
                        [selected]="data.selectedPlayerIds.includes(player.id)"
                      >
                        {{ player.lastName }}, {{ player.firstName }}
                      </option>
                    }
                  </select>
                </label>
              } @else {
                <label>
                  Ranking as of
                  <input
                    type="date"
                    [value]="data.asOfDate ?? ''"
                    (change)="
                      setQuery({
                        asOf: $any($event.target).value || null,
                      })
                    "
                  />
                </label>
                <label>
                  Team trend
                  <select
                    [value]="data.selectedTeamId ?? ''"
                    (change)="setQuery({ team: $any($event.target).value })"
                  >
                    <option value="">Select a team</option>
                    @for (team of data.teams; track team.id) {
                      <option [value]="team.id">
                        {{ team.city }} {{ team.name }}
                      </option>
                    }
                  </select>
                </label>
              }
            </section>
            @if (data.tab === 'players') {
              @if (data.selectedPlayerIds.length < 2) {
                <app-empty-state
                  message="Select at least two and no more than five players to compare."
                />
              } @else if (data.comparison; as comparison) {
                <section class="surface" aria-labelledby="comparison-heading">
                  <h2 id="comparison-heading">Player metric comparison</h2>
                  <p class="muted">
                    {{
                      comparison.window === 'season'
                        ? 'Season'
                        : 'Last ' + comparison.window + ' games'
                    }}
                    · formula {{ comparison.formulaVersion }} · cutoff
                    {{
                      comparison.dataCutoff
                        ? (comparison.dataCutoff | date: 'medium')
                        : 'unavailable'
                    }}
                  </p>
                  <app-accessible-line-chart
                    title="Points per game by player"
                    [categories]="playerNames(comparison)"
                    [series]="comparisonSeries(comparison)"
                  />
                  <div class="table-scroll">
                    <table class="data-table">
                      <caption>
                        Equivalent player metric data
                      </caption>
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th class="numeric">Sample</th>
                          <th class="numeric">P/GP</th>
                          <th class="numeric">G/GP</th>
                          <th class="numeric">A/GP</th>
                          <th class="numeric">Shooting</th>
                          <th class="numeric">Consistency</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of comparison.players; track row.player.id) {
                          <tr>
                            <th scope="row">
                              {{ row.player.firstName }}
                              {{ row.player.lastName }}
                            </th>
                            <td class="numeric">{{ row.sampleSize }}</td>
                            <td class="numeric">
                              {{ formatRate(row.metrics.pointsPerGame) }}
                            </td>
                            <td class="numeric">
                              {{ formatRate(row.metrics.goalsPerGame) }}
                            </td>
                            <td class="numeric">
                              {{ formatRate(row.metrics.assistsPerGame) }}
                            </td>
                            <td class="numeric">
                              {{
                                formatPercentage(row.metrics.shootingPercentage)
                              }}
                            </td>
                            <td class="numeric">
                              {{ formatRate(row.metrics.consistencyScore) }}
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <p class="muted">
                    Rates use eligible final regular-season and playoff games.
                    Consistency requires at least five games and is not defined
                    for the season window.
                  </p>
                </section>
              }
            } @else {
              <section class="surface" aria-labelledby="ranking-heading">
                <h2 id="ranking-heading">Team power rankings</h2>
                <p class="muted">
                  Score = 50% season point percentage + 30% last-10 point
                  percentage + 20% normalized scoring differential per game.
                </p>
                @if (data.rankings.length) {
                  <div class="table-scroll">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Team</th>
                          <th class="numeric">Score</th>
                          <th class="numeric">Season P%</th>
                          <th class="numeric">Last-10 P%</th>
                          <th class="numeric">Diff/GP</th>
                          <th class="numeric">Sample</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of data.rankings; track row.team.id) {
                          <tr>
                            <td>{{ row.rank }}</td>
                            <th scope="row">{{ row.team.name }}</th>
                            <td class="numeric">
                              {{ formatRate(row.score) }}
                            </td>
                            <td class="numeric">
                              {{
                                formatRatioPercentage(row.seasonPointPercentage)
                              }}
                            </td>
                            <td class="numeric">
                              {{
                                formatRatioPercentage(row.last10PointPercentage)
                              }}
                            </td>
                            <td class="numeric">
                              {{ formatRate(row.scoringDifferentialPerGame) }}
                            </td>
                            <td class="numeric">{{ row.sampleSize }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <p class="muted">
                    As of
                    {{ data.rankings[0]!.asOfDate | date: 'mediumDate' }} ·
                    formula {{ data.rankings[0]!.formulaVersion }}
                  </p>
                } @else {
                  <app-empty-state
                    message="No ranking snapshot is available for this season."
                  />
                }
              </section>
              @if (data.teamTrend.length) {
                <section class="surface" aria-labelledby="trend-heading">
                  <h2 id="trend-heading">Selected team trend</h2>
                  <app-accessible-line-chart
                    title="Last-10 team performance"
                    [categories]="trendDates(data.teamTrend)"
                    [series]="teamSeries(data.teamTrend)"
                  />
                  <div class="table-scroll">
                    <table class="data-table">
                      <caption>
                        Equivalent selected-team trend data
                      </caption>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th class="numeric">Point %</th>
                          <th class="numeric">Diff/GP</th>
                          <th class="numeric">Sample</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of data.teamTrend; track row.asOfGameId) {
                          <tr>
                            <td>
                              {{ row.asOfDate | date: 'mediumDate' }}
                            </td>
                            <td class="numeric">
                              {{ formatRatioPercentage(row.pointPercentage) }}
                            </td>
                            <td class="numeric">
                              {{ formatRate(row.scoringDifferentialPerGame) }}
                            </td>
                            <td class="numeric">{{ row.sampleSize }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </section>
              }
            }
          }
        }
      }
    </div>
  `,
})
export class AnalyticsPageComponent {
  protected readonly formatPercentage = formatPercentage;
  protected readonly formatRate = formatRate;
  protected readonly formatRatioPercentage = formatRatioPercentage;
  private readonly api = inject(ExplorerApiService);
  private readonly refresh = new BehaviorSubject(0);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly state = toSignal(
    combineLatest([this.route.queryParamMap, this.refresh]).pipe(
      switchMap(([query]) =>
        asRequestState(
          forkJoin({
            players: this.api.listPlayers({
              active: true,
              page: 1,
              pageSize: 100,
              sort: 'lastName',
            }),
            seasons: this.api.listSeasons(),
            teams: this.api.listTeams(),
          }).pipe(
            switchMap(({ players, seasons, teams }) => {
              const seasonId = query.get('season') || seasons.data[0]?.id;
              if (!seasonId) throw new Error('No season is available.');
              const tab: Tab =
                query.get('tab') === 'rankings' ? 'rankings' : 'players';
              const window = parseWindow(query.get('window'));
              const selectedPlayerIds = [
                ...new Set(
                  (query.get('playerIds') ?? '').split(',').filter(Boolean),
                ),
              ].slice(0, 5);
              const selectedTeamId = query.get('team') || undefined;
              const asOfDate = query.get('asOf') || undefined;
              if (!query.has('season')) {
                void this.router.navigate([], {
                  queryParams: { season: seasonId },
                  queryParamsHandling: 'merge',
                  replaceUrl: true,
                });
              }
              return forkJoin({
                comparison:
                  tab === 'players' && selectedPlayerIds.length >= 2
                    ? this.api
                        .comparePlayers(selectedPlayerIds, seasonId, window)
                        .pipe(map((response) => response.data))
                    : of(undefined),
                rankings:
                  tab === 'rankings'
                    ? this.api
                        .listTeamRankings(seasonId, asOfDate)
                        .pipe(map((response) => response.data))
                    : of([]),
                teamTrend:
                  tab === 'rankings' && selectedTeamId
                    ? this.api
                        .listTeamTrends(selectedTeamId, seasonId)
                        .pipe(map((response) => response.data))
                    : of([]),
              }).pipe(
                map(
                  (analytics) =>
                    ({
                      ...analytics,
                      asOfDate,
                      players: players.data,
                      seasonId,
                      seasons: seasons.data,
                      selectedPlayerIds,
                      selectedTeamId,
                      tab,
                      teams: teams.data,
                      window,
                    }) satisfies AnalyticsData,
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
      } as RequestState<AnalyticsData>,
    },
  );

  protected setPlayers(select: HTMLSelectElement): void {
    const ids = [...select.selectedOptions]
      .map((option) => option.value)
      .slice(0, 5);
    this.setQuery({ playerIds: ids.join(',') || null });
  }

  protected setQuery(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  protected playerNames(value: PlayerComparisonDto): string[] {
    return value.players.map(
      ({ player }) => `${player.firstName} ${player.lastName}`,
    );
  }

  protected comparisonSeries(value: PlayerComparisonDto) {
    return [
      {
        name: 'Points per game',
        values: value.players.map((row) => row.metrics.pointsPerGame),
      },
    ];
  }

  protected trendDates(value: TeamTrendPointDto[]): string[] {
    return value.map((row) => row.asOfDate);
  }

  protected teamSeries(value: TeamTrendPointDto[]) {
    return [
      {
        name: 'Point percentage',
        values: value.map((row) => row.pointPercentage),
      },
      {
        name: 'Scoring differential/game',
        values: value.map((row) => row.scoringDifferentialPerGame),
      },
    ];
  }

  protected retry(): void {
    this.refresh.next(this.refresh.value + 1);
  }
}

function parseWindow(value: string | null): Window {
  return value === '5' || value === '10' || value === '20' ? value : 'season';
}
