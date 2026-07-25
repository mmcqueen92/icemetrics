import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, forkJoin, map, switchMap } from 'rxjs';

import type {
  GameSummaryDto,
  RosterPlayerDto,
  SeasonSummaryDto,
  StandingDto,
  TeamDetailDto,
  TeamRankingDto,
  TeamTrendPointDto,
} from '../../core/api/generated/model/models';
import { ExplorerApiService } from '../../core/api/explorer-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state';
import { NotFoundComponent } from '../../shared/components/not-found/not-found.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge';
import {
  displayOptional,
  formatRate,
  formatRatioPercentage,
} from '../../shared/formatters/hockey-formatters';
import { asRequestState } from '../../shared/state/request-state';

interface TeamDetailData {
  games: GameSummaryDto[];
  ranking: TeamRankingDto | undefined;
  roster: RosterPlayerDto[];
  seasons: SeasonSummaryDto[];
  selectedSeason: SeasonSummaryDto;
  standing: StandingDto | undefined;
  team: TeamDetailDto;
  trend: TeamTrendPointDto | undefined;
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
    RouterLink,
    StatusBadgeComponent,
  ],
  selector: 'app-team-detail-page',
  template: `
    <div class="page">
      @switch (state().status) {
        @case ('loading') {
          <app-loading-state message="Loading team profile…" />
        }
        @case ('error') {
          @if (state().error?.notFound) {
            <app-not-found
              title="Team not found"
              message="This team does not exist in the stored NHL data."
            />
          } @else {
            <app-error-state
              [message]="state().error?.message ?? 'Unable to load this team.'"
              (retry)="retry()"
            />
          }
        }
        @case ('success') {
          @if (state().value; as detail) {
            <app-page-header
              eyebrow="Team profile"
              [title]="detail.team.city + ' ' + detail.team.name"
              [description]="
                detail.team.abbreviation + ' · ' + detail.team.league.name
              "
            />

            <section class="surface">
              <div class="surface-header">
                <h2>Season context</h2>
                <label>
                  Season
                  <select
                    [value]="detail.selectedSeason.id"
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
                  <span>Official standing</span>
                  <strong>
                    {{
                      detail.standing
                        ? '#' + detail.standing.leagueRank
                        : 'Unavailable'
                    }}
                  </strong>
                  @if (detail.standing) {
                    <p>
                      {{ detail.standing.points }} points in
                      {{ detail.standing.gamesPlayed }} games
                    </p>
                  }
                </article>
                <article class="metric-tile">
                  <span>Power rank</span>
                  <strong>{{
                    detail.ranking ? '#' + detail.ranking.rank : 'Unavailable'
                  }}</strong>
                  @if (detail.ranking) {
                    <p>
                      Score {{ detail.ranking.score }} ·
                      {{ detail.ranking.sampleSize }} game sample
                    </p>
                  }
                </article>
                <article class="metric-tile">
                  <span>Last-10 point percentage</span>
                  <strong>{{
                    formatRatioPercentage(detail.trend?.pointPercentage)
                  }}</strong>
                  @if (detail.trend) {
                    <p>{{ detail.trend.sampleSize }} game sample</p>
                  }
                </article>
                <article class="metric-tile">
                  <span>Scoring differential / game</span>
                  <strong>{{
                    formatRate(detail.trend?.scoringDifferentialPerGame)
                  }}</strong>
                  @if (detail.trend) {
                    <p>
                      Through {{ detail.trend.asOfDate | date: 'mediumDate' }}
                    </p>
                  }
                </article>
              </div>
              @if (detail.standing) {
                <p class="freshness-note">
                  Official standings snapshot
                  {{ detail.standing.asOfDate | date: 'longDate' }}; source
                  cutoff {{ detail.standing.sourceCutoff | date: 'medium' }}.
                </p>
              }
            </section>

            <section class="surface" aria-labelledby="recent-games-heading">
              <div class="surface-header">
                <h2 id="recent-games-heading">Recent games</h2>
                <a
                  routerLink="/games"
                  [queryParams]="{
                    season: detail.selectedSeason.id,
                    team: detail.team.id,
                  }"
                >
                  Full schedule
                </a>
              </div>
              @if (detail.games.length) {
                <div class="card-grid">
                  @for (game of detail.games; track game.id) {
                    <a class="link-card" [routerLink]="['/games', game.id]">
                      <app-status-badge [status]="game.status" />
                      <p>{{ game.startsAt | date: 'mediumDate' }}</p>
                      <strong>
                        {{ game.away.team.abbreviation }}
                        {{ displayOptional(game.away.score, '—') }} at
                        {{ displayOptional(game.home.score, '—') }}
                        {{ game.home.team.abbreviation }}
                      </strong>
                    </a>
                  }
                </div>
              } @else {
                <app-empty-state
                  message="No games are stored for this team and season."
                />
              }
            </section>

            <section class="surface" aria-labelledby="roster-heading">
              <h2 id="roster-heading">Current roster</h2>
              @if (detail.roster.length) {
                <div class="table-scroll">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Player</th>
                        <th scope="col">Position</th>
                        <th scope="col">Shoots/catches</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (player of detail.roster; track player.id) {
                        <tr>
                          <td>
                            <a [routerLink]="['/players', player.id]">
                              {{ player.firstName }} {{ player.lastName }}
                            </a>
                          </td>
                          <td>{{ displayOptional(player.position, '—') }}</td>
                          <td>
                            {{ displayOptional(player.shootsCatches, '—') }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <app-empty-state
                  message="No active roster is currently available."
                />
              }
            </section>
          }
        }
      }
    </div>
  `,
})
export class TeamDetailPageComponent {
  protected readonly displayOptional = displayOptional;
  protected readonly formatRate = formatRate;
  protected readonly formatRatioPercentage = formatRatioPercentage;
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
              const selectedSeason =
                seasons.find((season) => season.id === query.get('season')) ??
                seasons[0];
              const id = path.get('id');
              if (!id || !selectedSeason) {
                throw new Error('Team or season is unavailable.');
              }
              if (!query.has('season')) {
                void this.router.navigate([], {
                  queryParams: { season: selectedSeason.id },
                  queryParamsHandling: 'merge',
                  replaceUrl: true,
                });
              }

              return forkJoin({
                games: this.api.listGames({
                  order: 'desc',
                  page: 1,
                  pageSize: 10,
                  seasonId: selectedSeason.id,
                  sort: 'startsAt',
                  teamId: id,
                }),
                rankings: this.api.listTeamRankings(selectedSeason.id),
                roster: this.api.listTeamRoster(id),
                standings: this.api.listStandings(selectedSeason.id),
                team: this.api.getTeam(id),
                trends: this.api.listTeamTrends(id, selectedSeason.id),
              }).pipe(
                map(
                  (result) =>
                    ({
                      games: result.games.data,
                      ranking: result.rankings.data.find(
                        (ranking) => ranking.team.id === id,
                      ),
                      roster: result.roster.data,
                      seasons,
                      selectedSeason,
                      standing: result.standings.data.find(
                        (standing) => standing.team.id === id,
                      ),
                      team: result.team.data,
                      trend: result.trends.data.at(-1),
                    }) satisfies TeamDetailData,
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
      queryParams: { season },
      queryParamsHandling: 'merge',
    });
  }

  protected retry(): void {
    this.refresh.next(this.refresh.value + 1);
  }
}
