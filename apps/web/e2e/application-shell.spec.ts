import { expect, test } from '@playwright/test';

test('navigates lazy feature routes with keyboard-visible shell semantics', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'See the game beneath the score.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible();

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  await page.getByRole('link', { name: 'Players' }).click();
  await expect(page).toHaveURL(/\/players$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Performance, game by game.' }),
  ).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
});

test('renders a useful in-app not-found page at compact width', async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 320 });
  await page.goto('/missing-route');

  await expect(
    page.getByRole('heading', { level: 1, name: 'That page is offside.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Return to dashboard' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
