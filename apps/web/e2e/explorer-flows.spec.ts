import { expect, test } from '@playwright/test';

import { mockExplorerApi } from './mock-api';

test.beforeEach(async ({ page }) => mockExplorerApi(page));

test('preserves player filters and navigates into an API-driven profile', async ({
  page,
}) => {
  await page.goto('/players?q=alex&position=C');

  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue(
    'alex',
  );
  await expect(page).toHaveURL(/q=alex/);
  await page.getByRole('link', { name: 'Alex Mercer' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Alex Mercer' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Rolling performance' }),
  ).toBeVisible();
  await expect(page.getByText('3.00 P/GP').first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Add to player comparison' }),
  ).toHaveAttribute('href', /playerIds=player-1/);
});

test('moves from dated standings to the team roster and recent form', async ({
  page,
}) => {
  await page.goto('/teams?season=season-1');

  await expect(
    page.getByRole('heading', { level: 2, name: 'Official standings' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Vancouver Orcas' }).first().click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Vancouver Orcas' }),
  ).toBeVisible();
  await expect(page.getByText('Power rank')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Current roster' }),
  ).toBeVisible();
});

test('keeps game status in URL state and opens the reconciled box score', async ({
  page,
}) => {
  await page.goto('/games?season=season-1&status=FINAL');

  await expect(
    page.locator('app-status-badge').getByText('Final'),
  ).toBeVisible();
  await expect(page).toHaveURL(/status=FINAL/);
  await page.getByRole('link', { name: /SEA.*VAN/ }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Team statistics' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Player box score' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alex Mercer' })).toBeVisible();
});

test('opens URL-addressable analytics with an accessible data equivalent', async ({
  page,
}) => {
  await page.goto(
    '/analytics?tab=players&season=season-1&playerIds=player-1%2Cplayer-2',
  );

  await expect(
    page.getByRole('heading', { level: 2, name: 'Player metric comparison' }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Equivalent player metric data' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Team rankings' }).click();
  await expect(page).toHaveURL(/tab=rankings/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Team power rankings' }),
  ).toBeVisible();
});
