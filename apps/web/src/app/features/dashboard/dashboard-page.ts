import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, forkJoin, map, switchMap } from 'rxjs';

import type {
  GameSummaryDto,
  SeasonSummaryDto,
  StandingDto,
  TeamRankingDto,
} from '../../core/api/generated/model/models';
import { ExplorerApiService } from '../../core/api/explorer-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge';
import { displayOptional } from '../../shared/formatters/hockey-formatters';
import { asRequestState } from '../../shared/state/request-state';

interface DashboardData {
  completedGames: GameSummaryDto[];
  nextGames: GameSummaryDto[];
  rankings: TeamRankingDto[];
  season: SeasonSummaryDto;
  standings: StandingDto[];
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
    StatusBadgeComponent,
  ],
  selector: 'app-dashboard-page',
  template: `
    <div class="page">
      <app-page-header
        eyebrow="NHL intelligence"
        title="See the game beneath the score."
        description="Current games, official standings, and transparent performance rankings from stored NHL data."
      />

      @switch (state().status) {
        @case ('loading') {
          <app-loading-state message="Loading the NHL dashboard…" />
        }
        @case ('error') {
          <app-error-state
            [message]="
              state().error?.message ?? 'Unable to load the dashboard.'
            "
            (retry)="retry()"
          />
        }
        @case ('success') {
          @if (state().value; as dashboard) {
            <p class="freshness-note">
              {{ dashboard.season.label }} · Data as of
              {{
                dashboard.standings[0]?.sourceCutoff
                  ? (dashboard.standings[0].sourceCutoff | date: 'medium')
                  : 'the latest stored snapshot'
              }}
            </p>

            <div class="game-grid">
              <section class="surface" aria-labelledby="latest-game-heading">
                <div class="surface-header">
                  <h2 id="latest-game-heading">Latest results</h2>
                  <a
                    routerLink="/games"
                    [queryParams]="{
                      season: dashboard.season.id,
                      status: 'FINAL',
                    }"
                    >All games</a
                  >
                </div>
                @if (dashboard.completedGames.length) {
                  @for (game of dashboard.completedGames; track game.id) {
                    <a class="link-card" [routerLink]="['/games', game.id]">
                      <app-status-badge [status]="game.status" />
                      <p>{{ game.startsAt | date: 'mediumDate' }}</p>
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
                    </a>
                  }
                } @else {
                  <app-empty-state
                    message="No completed games are stored for this season."
                  />
                }
              </section>

              <section class="surface" aria-labelledby="next-game-heading">
                <div class="surface-header">
                  <h2 id="next-game-heading">Next scheduled</h2>
                  <a
                    routerLink="/games"
                    [queryParams]="{
                      season: dashboard.season.id,
                      status: 'SCHEDULED',
                    }"
                    >Full schedule</a
                  >
                </div>
                @if (dashboard.nextGames.length) {
                  @for (game of dashboard.nextGames; track game.id) {
                    <a class="link-card" [routerLink]="['/games', game.id]">
                      <app-status-badge [status]="game.status" />
                      <p>{{ game.startsAt | date: 'medium' }}</p>
                      <strong>
                        {{ game.away.team.abbreviation }} at
                        {{ game.home.team.abbreviation }}
                      </strong>
                    </a>
                  }
                } @else {
                  <app-empty-state
                    message="No upcoming games are currently stored."
                  />
                }
              </section>
            </div>

            <div class="game-grid">
              <section class="surface" aria-labelledby="standings-heading">
                <div class="surface-header">
                  <h2 id="standings-heading">Standings leaders</h2>
                  <a
                    routerLink="/teams"
                    [queryParams]="{ season: dashboard.season.id }"
                    >Full standings</a
                  >
                </div>
                @if (dashboard.standings.length) {
                  <ol>
                    @for (
                      standing of dashboard.standings;
                      track standing.team.id
                    ) {
                      <li>
                        <a [routerLink]="['/teams', standing.team.id]">
                          {{ standing.team.name }}
                        </a>
                        — {{ standing.points }} pts
                      </li>
                    }
                  </ol>
                } @else {
                  <app-empty-state
                    message="Official standings have not been imported yet."
                  />
                }
              </section>

              <section class="surface" aria-labelledby="rankings-heading">
                <div class="surface-header">
                  <h2 id="rankings-heading">Power rankings</h2>
                  <a
                    routerLink="/analytics"
                    [queryParams]="{
                      season: dashboard.season.id,
                      tab: 'rankings',
                    }"
                    >Ranking details</a
                  >
                </div>
                @if (dashboard.rankings.length) {
                  <ol>
                    @for (
                      ranking of dashboard.rankings;
                      track ranking.team.id
                    ) {
                      <li>
                        <a [routerLink]="['/teams', ranking.team.id]">
                          {{ ranking.team.name }}
                        </a>
                        — {{ ranking.score }}
                      </li>
                    }
                  </ol>
                } @else {
                  <app-empty-state
                    message="Power rankings are not available for this season."
                  />
                }
              </section>
            </div>
          }
        }
      }
    </div>
  `,
})
export class DashboardPageComponent {
  protected readonly displayOptional = displayOptional;
  private readonly api = inject(ExplorerApiService);
  private readonly refresh = new BehaviorSubject(0);

  protected readonly state = toSignal(
    this.refresh.pipe(
      switchMap(() =>
        asRequestState(
          this.api.listSeasons().pipe(
            switchMap((seasons) => {
              const season = seasons.data[0];
              if (!season) {
                throw new Error('No seasons are available.');
              }

              return forkJoin({
                completed: this.api.listGames({
                  order: 'desc',
                  page: 1,
                  pageSize: 1,
                  seasonId: season.id,
                  sort: 'startsAt',
                  status: 'FINAL',
                }),
                next: this.api.listGames({
                  order: 'asc',
                  page: 1,
                  pageSize: 1,
                  seasonId: season.id,
                  sort: 'startsAt',
                  status: 'SCHEDULED',
                }),
                rankings: this.api.listTeamRankings(season.id),
                standings: this.api.listStandings(season.id),
              }).pipe(
                map(
                  (result) =>
                    ({
                      completedGames: result.completed.data,
                      nextGames: result.next.data,
                      rankings: result.rankings.data.slice(0, 5),
                      season,
                      standings: result.standings.data.slice(0, 5),
                    }) satisfies DashboardData,
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

  protected retry(): void {
    this.refresh.next(this.refresh.value + 1);
  }
}
