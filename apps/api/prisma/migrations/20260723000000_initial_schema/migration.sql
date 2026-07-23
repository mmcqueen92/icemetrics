-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "analytics";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ops";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "raw";

-- CreateEnum
CREATE TYPE "core"."game_status" AS ENUM ('SCHEDULED', 'PRE_GAME', 'LIVE', 'FINAL', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "core"."game_type" AS ENUM ('PRESEASON', 'REGULAR_SEASON', 'PLAYOFF', 'ALL_STAR');

-- CreateEnum
CREATE TYPE "core"."decision_type" AS ENUM ('REGULATION', 'OVERTIME', 'SHOOTOUT');

-- CreateEnum
CREATE TYPE "raw"."payload_status" AS ENUM ('FETCHED', 'VALIDATED', 'PROCESSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ops"."job_type" AS ENUM ('TEAMS', 'PLAYERS', 'SCHEDULE', 'GAME_STATISTICS', 'STANDINGS', 'ANALYTICS', 'DISPATCH');

-- CreateEnum
CREATE TYPE "ops"."job_trigger" AS ENUM ('SCHEDULED', 'MANUAL', 'REPLAY');

-- CreateEnum
CREATE TYPE "ops"."job_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ops"."issue_severity" AS ENUM ('WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "analytics"."metric_window" AS ENUM ('SEASON', 'LAST_5', 'LAST_10', 'LAST_20');

-- CreateTable
CREATE TABLE "raw"."provider_payload" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "external_key" TEXT NOT NULL,
    "request_path" TEXT NOT NULL,
    "request_parameters" JSONB NOT NULL,
    "http_status" INTEGER NOT NULL,
    "content_type" TEXT,
    "payload" JSONB,
    "body_text" TEXT,
    "checksum" CHAR(64) NOT NULL,
    "status" "raw"."payload_status" NOT NULL DEFAULT 'FETCHED',
    "fetched_at" TIMESTAMPTZ(6) NOT NULL,
    "processed_at" TIMESTAMPTZ(6),
    "job_execution_id" UUID,

    CONSTRAINT "provider_payload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."league" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "league_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."season" (
    "id" UUID NOT NULL,
    "league_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."team" (
    "id" UUID NOT NULL,
    "league_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."player" (
    "id" UUID NOT NULL,
    "current_team_id" UUID,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "position" TEXT,
    "shoots_catches" TEXT,
    "birth_date" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."game" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "home_team_id" UUID NOT NULL,
    "away_team_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "game_type" "core"."game_type" NOT NULL,
    "status" "core"."game_status" NOT NULL,
    "venue" TEXT,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "decision_type" "core"."decision_type",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."player_game_stat" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "goals" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "shots" INTEGER NOT NULL,
    "penalty_minutes" INTEGER NOT NULL,
    "plus_minus" INTEGER NOT NULL,
    "power_play_goals" INTEGER NOT NULL,
    "short_handed_goals" INTEGER NOT NULL,
    "time_on_ice_seconds" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "player_game_stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."team_game_stat" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "goals_for" INTEGER NOT NULL,
    "goals_against" INTEGER NOT NULL,
    "shots_for" INTEGER NOT NULL,
    "shots_against" INTEGER NOT NULL,
    "power_play_goals" INTEGER NOT NULL,
    "power_play_opportunities" INTEGER NOT NULL,
    "penalty_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_game_stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."league_provider_identity" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "league_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_provider_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."season_provider_identity" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "season_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_provider_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."team_provider_identity" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "team_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_provider_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."player_provider_identity" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "player_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_provider_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."game_provider_identity" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "game_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_provider_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics"."team_standing_snapshot" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "as_of_date" DATE NOT NULL,
    "games_played" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "overtime_losses" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "goals_for" INTEGER NOT NULL,
    "goals_against" INTEGER NOT NULL,
    "league_rank" INTEGER NOT NULL,
    "conference_rank" INTEGER,
    "division_rank" INTEGER,
    "point_percentage" DECIMAL(12,6) NOT NULL,
    "source_cutoff" TIMESTAMPTZ(6) NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL,
    "formula_version" TEXT NOT NULL,

    CONSTRAINT "team_standing_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics"."player_metric_snapshot" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "metric_code" TEXT NOT NULL,
    "window" "analytics"."metric_window" NOT NULL,
    "as_of_game_id" UUID NOT NULL,
    "value" DECIMAL(12,6) NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "formula_version" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "player_metric_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics"."team_metric_snapshot" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "metric_code" TEXT NOT NULL,
    "window" "analytics"."metric_window" NOT NULL,
    "as_of_game_id" UUID NOT NULL,
    "value" DECIMAL(12,6) NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "formula_version" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_metric_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics"."team_ranking_snapshot" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "ranking_code" TEXT NOT NULL,
    "as_of_date" DATE NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(12,6) NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "formula_version" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_ranking_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops"."job_execution" (
    "id" UUID NOT NULL,
    "job_type" "ops"."job_type" NOT NULL,
    "trigger" "ops"."job_trigger" NOT NULL,
    "status" "ops"."job_status" NOT NULL DEFAULT 'PENDING',
    "scheduled_for" TIMESTAMPTZ(6),
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "correlation_id" UUID NOT NULL,
    "parameters" JSONB NOT NULL,
    "cursor" JSONB,
    "records_fetched" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "records_unchanged" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "error_summary" JSONB,

    CONSTRAINT "job_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops"."import_issue" (
    "id" UUID NOT NULL,
    "job_execution_id" UUID NOT NULL,
    "provider_payload_id" UUID,
    "severity" "ops"."issue_severity" NOT NULL,
    "code" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "external_key" TEXT,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_issue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_provider_payload_lookup_fetched_at" ON "raw"."provider_payload"("provider", "resource_type", "external_key", "fetched_at" DESC);

-- CreateIndex
CREATE INDEX "ix_provider_payload_status_fetched_at" ON "raw"."provider_payload"("status", "fetched_at");

-- CreateIndex
CREATE INDEX "ix_provider_payload_job_execution_id" ON "raw"."provider_payload"("job_execution_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_provider_payload_identity_checksum" ON "raw"."provider_payload"("provider", "resource_type", "external_key", "checksum");

-- CreateIndex
CREATE UNIQUE INDEX "uq_league_code" ON "core"."league"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_season_league_id_label" ON "core"."season"("league_id", "label");

-- CreateIndex
CREATE INDEX "ix_team_league_id_active" ON "core"."team"("league_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_league_id_abbreviation" ON "core"."team"("league_id", "abbreviation");

-- CreateIndex
CREATE INDEX "ix_player_current_team_id_active" ON "core"."player"("current_team_id", "active");

-- CreateIndex
CREATE INDEX "ix_game_season_id_starts_at" ON "core"."game"("season_id", "starts_at" DESC);

-- CreateIndex
CREATE INDEX "ix_game_home_team_id_starts_at" ON "core"."game"("home_team_id", "starts_at" DESC);

-- CreateIndex
CREATE INDEX "ix_game_away_team_id_starts_at" ON "core"."game"("away_team_id", "starts_at" DESC);

-- CreateIndex
CREATE INDEX "ix_game_status_starts_at" ON "core"."game"("status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_game_season_teams_starts_at" ON "core"."game"("season_id", "home_team_id", "away_team_id", "starts_at");

-- CreateIndex
CREATE INDEX "ix_player_game_stat_player_id_game_id" ON "core"."player_game_stat"("player_id", "game_id");

-- CreateIndex
CREATE INDEX "ix_player_game_stat_team_id_game_id" ON "core"."player_game_stat"("team_id", "game_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_player_game_stat_game_id_player_id" ON "core"."player_game_stat"("game_id", "player_id");

-- CreateIndex
CREATE INDEX "ix_team_game_stat_team_id_game_id" ON "core"."team_game_stat"("team_id", "game_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_game_stat_game_id_team_id" ON "core"."team_game_stat"("game_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_league_provider_identity_provider_external_id" ON "core"."league_provider_identity"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_league_provider_identity_provider_league_id" ON "core"."league_provider_identity"("provider", "league_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_season_provider_identity_provider_external_id" ON "core"."season_provider_identity"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_season_provider_identity_provider_season_id" ON "core"."season_provider_identity"("provider", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_provider_identity_provider_external_id" ON "core"."team_provider_identity"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_provider_identity_provider_team_id" ON "core"."team_provider_identity"("provider", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_player_provider_identity_provider_external_id" ON "core"."player_provider_identity"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_player_provider_identity_provider_player_id" ON "core"."player_provider_identity"("provider", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_game_provider_identity_provider_external_id" ON "core"."game_provider_identity"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_game_provider_identity_provider_game_id" ON "core"."game_provider_identity"("provider", "game_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_standing_snapshot_season_team_date" ON "analytics"."team_standing_snapshot"("season_id", "team_id", "as_of_date");

-- CreateIndex
CREATE INDEX "ix_player_metric_snapshot_lookup" ON "analytics"."player_metric_snapshot"("player_id", "metric_code", "window", "computed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_player_metric_snapshot_identity" ON "analytics"."player_metric_snapshot"("season_id", "player_id", "metric_code", "window", "as_of_game_id");

-- CreateIndex
CREATE INDEX "ix_team_metric_snapshot_lookup" ON "analytics"."team_metric_snapshot"("team_id", "metric_code", "window", "computed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_metric_snapshot_identity" ON "analytics"."team_metric_snapshot"("season_id", "team_id", "metric_code", "window", "as_of_game_id");

-- CreateIndex
CREATE INDEX "ix_team_ranking_snapshot_lookup" ON "analytics"."team_ranking_snapshot"("season_id", "ranking_code", "as_of_date", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_ranking_snapshot_identity" ON "analytics"."team_ranking_snapshot"("season_id", "team_id", "ranking_code", "as_of_date");

-- CreateIndex
CREATE INDEX "ix_job_execution_correlation_id" ON "ops"."job_execution"("correlation_id");

-- CreateIndex
CREATE INDEX "ix_job_execution_type_status_requested_at" ON "ops"."job_execution"("job_type", "status", "requested_at" DESC);

-- CreateIndex
CREATE INDEX "ix_import_issue_job_execution_id" ON "ops"."import_issue"("job_execution_id");

-- CreateIndex
CREATE INDEX "ix_import_issue_provider_payload_id" ON "ops"."import_issue"("provider_payload_id");

-- CreateIndex
CREATE INDEX "ix_import_issue_code_created_at" ON "ops"."import_issue"("code", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "raw"."provider_payload" ADD CONSTRAINT "provider_payload_job_execution_id_fkey" FOREIGN KEY ("job_execution_id") REFERENCES "ops"."job_execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."season" ADD CONSTRAINT "season_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "core"."league"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."team" ADD CONSTRAINT "team_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "core"."league"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."player" ADD CONSTRAINT "player_current_team_id_fkey" FOREIGN KEY ("current_team_id") REFERENCES "core"."team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."game" ADD CONSTRAINT "game_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core"."season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."game" ADD CONSTRAINT "game_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "core"."team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."game" ADD CONSTRAINT "game_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "core"."team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."player_game_stat" ADD CONSTRAINT "player_game_stat_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "core"."game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."player_game_stat" ADD CONSTRAINT "player_game_stat_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "core"."player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."player_game_stat" ADD CONSTRAINT "player_game_stat_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core"."team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."team_game_stat" ADD CONSTRAINT "team_game_stat_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "core"."game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."team_game_stat" ADD CONSTRAINT "team_game_stat_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core"."team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."league_provider_identity" ADD CONSTRAINT "league_provider_identity_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "core"."league"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."season_provider_identity" ADD CONSTRAINT "season_provider_identity_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core"."season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."team_provider_identity" ADD CONSTRAINT "team_provider_identity_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."player_provider_identity" ADD CONSTRAINT "player_provider_identity_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "core"."player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."game_provider_identity" ADD CONSTRAINT "game_provider_identity_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "core"."game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."team_standing_snapshot" ADD CONSTRAINT "team_standing_snapshot_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core"."season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."team_standing_snapshot" ADD CONSTRAINT "team_standing_snapshot_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."player_metric_snapshot" ADD CONSTRAINT "player_metric_snapshot_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core"."season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."player_metric_snapshot" ADD CONSTRAINT "player_metric_snapshot_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "core"."player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."player_metric_snapshot" ADD CONSTRAINT "player_metric_snapshot_as_of_game_id_fkey" FOREIGN KEY ("as_of_game_id") REFERENCES "core"."game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."team_metric_snapshot" ADD CONSTRAINT "team_metric_snapshot_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core"."season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."team_metric_snapshot" ADD CONSTRAINT "team_metric_snapshot_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."team_metric_snapshot" ADD CONSTRAINT "team_metric_snapshot_as_of_game_id_fkey" FOREIGN KEY ("as_of_game_id") REFERENCES "core"."game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."team_ranking_snapshot" ADD CONSTRAINT "team_ranking_snapshot_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core"."season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."team_ranking_snapshot" ADD CONSTRAINT "team_ranking_snapshot_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops"."import_issue" ADD CONSTRAINT "import_issue_job_execution_id_fkey" FOREIGN KEY ("job_execution_id") REFERENCES "ops"."job_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops"."import_issue" ADD CONSTRAINT "import_issue_provider_payload_id_fkey" FOREIGN KEY ("provider_payload_id") REFERENCES "raw"."provider_payload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma does not model the domain checks and expression indexes below.
ALTER TABLE "raw"."provider_payload"
  ADD CONSTRAINT "ck_provider_payload_http_status" CHECK ("http_status" BETWEEN 100 AND 599),
  ADD CONSTRAINT "ck_provider_payload_body_representation" CHECK (("payload" IS NULL) <> ("body_text" IS NULL)),
  ADD CONSTRAINT "ck_provider_payload_checksum" CHECK ("checksum" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_provider_payload_processed_at" CHECK (
    ("status" = 'PROCESSED' AND "processed_at" IS NOT NULL)
    OR ("status" <> 'PROCESSED' AND "processed_at" IS NULL)
  );

ALTER TABLE "core"."league"
  ADD CONSTRAINT "ck_league_code_uppercase" CHECK ("code" = upper("code") AND "code" ~ '^[A-Z0-9]+$');

ALTER TABLE "core"."season"
  ADD CONSTRAINT "ck_season_label" CHECK ("label" ~ '^[0-9]{4}-[0-9]{4}$'),
  ADD CONSTRAINT "ck_season_date_range" CHECK ("start_date" < "end_date");

ALTER TABLE "core"."team"
  ADD CONSTRAINT "ck_team_abbreviation_uppercase" CHECK (
    "abbreviation" = upper("abbreviation") AND "abbreviation" ~ '^[A-Z0-9]+$'
  );

ALTER TABLE "core"."player"
  ADD CONSTRAINT "ck_player_position" CHECK ("position" IS NULL OR "position" IN ('C', 'L', 'R', 'D', 'G')),
  ADD CONSTRAINT "ck_player_shoots_catches" CHECK ("shoots_catches" IS NULL OR "shoots_catches" IN ('L', 'R'));

CREATE INDEX "ix_player_first_name_ci" ON "core"."player" (lower("first_name") text_pattern_ops);
CREATE INDEX "ix_player_last_name_ci" ON "core"."player" (lower("last_name") text_pattern_ops);
CREATE INDEX "ix_player_full_name_ci" ON "core"."player" (
  lower("first_name" || ' ' || "last_name") text_pattern_ops
);

ALTER TABLE "core"."game"
  ADD CONSTRAINT "ck_game_distinct_teams" CHECK ("home_team_id" <> "away_team_id"),
  ADD CONSTRAINT "ck_game_non_negative_scores" CHECK (
    ("home_score" IS NULL OR "home_score" >= 0)
    AND ("away_score" IS NULL OR "away_score" >= 0)
  ),
  ADD CONSTRAINT "ck_game_final_scores" CHECK (
    "status" <> 'FINAL' OR ("home_score" IS NOT NULL AND "away_score" IS NOT NULL)
  ),
  ADD CONSTRAINT "ck_game_decision_final_only" CHECK (
    "decision_type" IS NULL OR "status" = 'FINAL'
  );

ALTER TABLE "core"."player_game_stat"
  ADD CONSTRAINT "ck_player_game_stat_non_negative" CHECK (
    "goals" >= 0
    AND "assists" >= 0
    AND "shots" >= 0
    AND "penalty_minutes" >= 0
    AND "power_play_goals" >= 0
    AND "short_handed_goals" >= 0
    AND "time_on_ice_seconds" >= 0
  );

ALTER TABLE "core"."team_game_stat"
  ADD CONSTRAINT "ck_team_game_stat_non_negative" CHECK (
    "goals_for" >= 0
    AND "goals_against" >= 0
    AND "shots_for" >= 0
    AND "shots_against" >= 0
    AND "power_play_goals" >= 0
    AND "power_play_opportunities" >= 0
    AND "penalty_minutes" >= 0
  ),
  ADD CONSTRAINT "ck_team_game_stat_power_play_goals" CHECK (
    "power_play_goals" <= "power_play_opportunities"
  );

CREATE FUNCTION "core"."validate_game_leagues"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_league_id uuid;
  home_league_id uuid;
  away_league_id uuid;
BEGIN
  SELECT "league_id" INTO expected_league_id
  FROM "core"."season"
  WHERE "id" = NEW."season_id";

  SELECT "league_id" INTO home_league_id
  FROM "core"."team"
  WHERE "id" = NEW."home_team_id";

  SELECT "league_id" INTO away_league_id
  FROM "core"."team"
  WHERE "id" = NEW."away_team_id";

  IF expected_league_id IS DISTINCT FROM home_league_id
     OR expected_league_id IS DISTINCT FROM away_league_id THEN
    RAISE EXCEPTION 'game teams must belong to the season league'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_game_team_leagues';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "ck_game_team_leagues"
AFTER INSERT OR UPDATE OF "season_id", "home_team_id", "away_team_id"
ON "core"."game"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION "core"."validate_game_leagues"();

CREATE FUNCTION "core"."validate_game_stat_team"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  valid_team boolean;
BEGIN
  SELECT NEW."team_id" IN ("home_team_id", "away_team_id") INTO valid_team
  FROM "core"."game"
  WHERE "id" = NEW."game_id";

  IF valid_team IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'stat team must participate in the referenced game'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_game_stat_participating_team';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "ck_player_game_stat_participating_team"
AFTER INSERT OR UPDATE OF "game_id", "team_id"
ON "core"."player_game_stat"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION "core"."validate_game_stat_team"();

CREATE CONSTRAINT TRIGGER "ck_team_game_stat_participating_team"
AFTER INSERT OR UPDATE OF "game_id", "team_id"
ON "core"."team_game_stat"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION "core"."validate_game_stat_team"();

ALTER TABLE "analytics"."team_standing_snapshot"
  ADD CONSTRAINT "ck_team_standing_snapshot_counts" CHECK (
    "games_played" >= 0
    AND "wins" >= 0
    AND "losses" >= 0
    AND "overtime_losses" >= 0
    AND "points" >= 0
    AND "goals_for" >= 0
    AND "goals_against" >= 0
    AND "wins" + "losses" + "overtime_losses" <= "games_played"
  ),
  ADD CONSTRAINT "ck_team_standing_snapshot_ranks" CHECK (
    "league_rank" > 0
    AND ("conference_rank" IS NULL OR "conference_rank" > 0)
    AND ("division_rank" IS NULL OR "division_rank" > 0)
  ),
  ADD CONSTRAINT "ck_team_standing_snapshot_point_percentage" CHECK (
    "point_percentage" BETWEEN 0 AND 1
  );

ALTER TABLE "analytics"."player_metric_snapshot"
  ADD CONSTRAINT "ck_player_metric_snapshot_window" CHECK ("window" <> 'SEASON'),
  ADD CONSTRAINT "ck_player_metric_snapshot_sample_size" CHECK ("sample_size" > 0),
  ADD CONSTRAINT "ck_player_metric_snapshot_code" CHECK (
    "metric_code" IN (
      'player.pointsPerGame',
      'player.goalsPerGame',
      'player.assistsPerGame',
      'player.shootingPercentage',
      'player.consistencyScore'
    )
  );

ALTER TABLE "analytics"."team_metric_snapshot"
  ADD CONSTRAINT "ck_team_metric_snapshot_window" CHECK ("window" <> 'SEASON'),
  ADD CONSTRAINT "ck_team_metric_snapshot_sample_size" CHECK ("sample_size" > 0),
  ADD CONSTRAINT "ck_team_metric_snapshot_code" CHECK (
    "metric_code" IN (
      'team.pointPercentage',
      'team.scoringDifferentialPerGame',
      'team.recentPerformanceTrend'
    )
  );

ALTER TABLE "analytics"."team_ranking_snapshot"
  ADD CONSTRAINT "ck_team_ranking_snapshot_code" CHECK ("ranking_code" = 'team.powerRanking'),
  ADD CONSTRAINT "ck_team_ranking_snapshot_rank" CHECK ("rank" > 0),
  ADD CONSTRAINT "ck_team_ranking_snapshot_sample_size" CHECK ("sample_size" > 0);

ALTER TABLE "ops"."job_execution"
  ADD CONSTRAINT "ck_job_execution_attempt" CHECK ("attempt" > 0),
  ADD CONSTRAINT "ck_job_execution_counters" CHECK (
    "records_fetched" >= 0
    AND "records_created" >= 0
    AND "records_updated" >= 0
    AND "records_unchanged" >= 0
    AND "records_failed" >= 0
  ),
  ADD CONSTRAINT "ck_job_execution_terminal_finished_at" CHECK (
    (
      "status" IN ('SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED')
      AND "finished_at" IS NOT NULL
    )
    OR (
      "status" IN ('PENDING', 'RUNNING')
      AND "finished_at" IS NULL
    )
  ),
  ADD CONSTRAINT "ck_job_execution_timestamp_order" CHECK (
    ("started_at" IS NULL OR "started_at" >= "requested_at")
    AND ("finished_at" IS NULL OR "started_at" IS NULL OR "finished_at" >= "started_at")
  );
