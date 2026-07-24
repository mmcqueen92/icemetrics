-- Pass 5 read-path indexes. Existing game indexes are extended with the UUID
-- tie-breaker used by deterministic pagination.
DROP INDEX "core"."ix_game_season_id_starts_at";
DROP INDEX "core"."ix_game_home_team_id_starts_at";
DROP INDEX "core"."ix_game_away_team_id_starts_at";
DROP INDEX "core"."ix_game_status_starts_at";

CREATE INDEX "ix_league_name_id"
  ON "core"."league" ("name", "id");

CREATE INDEX "ix_season_start_date_id"
  ON "core"."season" ("start_date" DESC, "id");
CREATE INDEX "ix_season_label_id"
  ON "core"."season" ("label", "id");
CREATE INDEX "ix_season_league_start_date_id"
  ON "core"."season" ("league_id", "start_date" DESC, "id");
CREATE INDEX "ix_season_active_dates"
  ON "core"."season" ("start_date", "end_date");

CREATE INDEX "ix_team_name_id"
  ON "core"."team" ("name", "id");
CREATE INDEX "ix_team_city_id"
  ON "core"."team" ("city", "id");
CREATE INDEX "ix_team_league_active_name_id"
  ON "core"."team" ("league_id", "active", "name", "id");

CREATE INDEX "ix_player_last_name_id"
  ON "core"."player" ("last_name", "id");
CREATE INDEX "ix_player_first_name_id"
  ON "core"."player" ("first_name", "id");
CREATE INDEX "ix_player_position_id"
  ON "core"."player" ("position", "id");
CREATE INDEX "ix_player_active_last_name_id"
  ON "core"."player" ("active", "last_name", "id");
CREATE INDEX "ix_player_team_active_last_name_id"
  ON "core"."player" ("current_team_id", "active", "last_name", "id");

CREATE INDEX "ix_game_season_id_starts_at"
  ON "core"."game" ("season_id", "starts_at" DESC, "id");
CREATE INDEX "ix_game_home_team_id_starts_at"
  ON "core"."game" ("home_team_id", "starts_at" DESC, "id");
CREATE INDEX "ix_game_away_team_id_starts_at"
  ON "core"."game" ("away_team_id", "starts_at" DESC, "id");
CREATE INDEX "ix_game_status_starts_at"
  ON "core"."game" ("status", "starts_at", "id");
CREATE INDEX "ix_game_season_type_starts_at_id"
  ON "core"."game" ("season_id", "game_type", "starts_at" DESC, "id");

CREATE INDEX "ix_player_game_stat_game_points_player_id"
  ON "core"."player_game_stat" ("game_id", (goals + assists) DESC, "player_id");
CREATE INDEX "ix_player_game_stat_game_shots_player_id"
  ON "core"."player_game_stat" ("game_id", "shots" DESC, "player_id");
CREATE INDEX "ix_player_game_stat_game_toi_player_id"
  ON "core"."player_game_stat" ("game_id", "time_on_ice_seconds" DESC, "player_id");
CREATE INDEX "ix_player_game_stat_game_team_player_id"
  ON "core"."player_game_stat" ("game_id", "team_id", "player_id");

CREATE INDEX "ix_standing_season_date_rank_id"
  ON "analytics"."team_standing_snapshot"
    ("season_id", "as_of_date", "league_rank", "id");
CREATE INDEX "ix_standing_season_date_points_id"
  ON "analytics"."team_standing_snapshot"
    ("season_id", "as_of_date", "points", "id");
CREATE INDEX "ix_standing_season_date_point_pct_id"
  ON "analytics"."team_standing_snapshot"
    ("season_id", "as_of_date", "point_percentage", "id");
