import { describe, expect, it } from 'vitest';

import {
  calculatePlayerMetrics,
  calculateRecentPerformanceTrend,
  calculateTeamMetrics,
  rankTeams,
} from './analytics-metrics.js';

describe('analytics metric formulas', () => {
  it('hand-calculates every player metric with population deviation', () => {
    const metrics = calculatePlayerMetrics([
      { assists: 1, goals: 1, shots: 4 },
      { assists: 0, goals: 0, shots: 1 },
      { assists: 2, goals: 0, shots: 2 },
      { assists: 0, goals: 1, shots: 3 },
      { assists: 1, goals: 0, shots: 0 },
    ]);

    expect(metrics).toEqual({
      assistsPerGame: 0.8,
      consistencyScore: 57.19739151027539,
      goalsPerGame: 0.4,
      pointsPerGame: 1.2,
      shootingPercentage: 20,
    });
  });

  it('returns null denominators and permits partial rolling windows', () => {
    expect(
      calculatePlayerMetrics([
        { assists: 0, goals: 0, shots: 0 },
        { assists: 1, goals: 0, shots: 0 },
      ]),
    ).toEqual({
      assistsPerGame: 0.5,
      consistencyScore: null,
      goalsPerGame: 0,
      pointsPerGame: 0.5,
      shootingPercentage: null,
    });
    expect(calculatePlayerMetrics([]).pointsPerGame).toBeNull();
  });

  it('hand-calculates team season, recent, and trend metrics', () => {
    const season = calculateTeamMetrics([
      { goalsAgainst: 2, goalsFor: 4, overtimeLoss: false, won: true },
      { goalsAgainst: 3, goalsFor: 2, overtimeLoss: true, won: false },
      { goalsAgainst: 2, goalsFor: 1, overtimeLoss: false, won: false },
    ]);
    const recent = calculateTeamMetrics([
      { goalsAgainst: 2, goalsFor: 4, overtimeLoss: false, won: true },
      { goalsAgainst: 3, goalsFor: 2, overtimeLoss: true, won: false },
    ]);

    expect(season).toMatchObject({
      gamesPlayed: 3,
      losses: 1,
      overtimeLosses: 1,
      pointPercentage: 0.5,
      points: 3,
      scoringDifferential: 0,
      scoringDifferentialPerGame: 0,
      winPercentage: 1 / 3,
      wins: 1,
    });
    expect(calculateRecentPerformanceTrend(season, recent)).toBe(0.25);
    expect(calculateTeamMetrics([]).pointPercentage).toBeNull();
  });

  it('scores and deterministically breaks ranking ties', () => {
    const ranked = rankTeams([
      {
        last10PointPercentage: 0.5,
        scoringDifferential: 2,
        scoringDifferentialPerGame: 0,
        seasonPointPercentage: 0.5,
        seasonPoints: 10,
        teamId: 'b',
        teamName: 'Beta',
      },
      {
        last10PointPercentage: 0.5,
        scoringDifferential: 3,
        scoringDifferentialPerGame: 0,
        seasonPointPercentage: 0.5,
        seasonPoints: 10,
        teamId: 'a',
        teamName: 'Alpha',
      },
    ]);

    expect(ranked.map(({ rank, teamId }) => ({ rank, teamId }))).toEqual([
      { rank: 1, teamId: 'a' },
      { rank: 2, teamId: 'b' },
    ]);
    expect(ranked[0]?.score).toBe(50);
  });
});
