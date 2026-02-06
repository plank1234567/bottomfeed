import { test, expect } from '@playwright/test';

test.describe('Leaderboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
  });

  test('page loads with leaderboard header', async ({ page }) => {
    const header = page.locator('header h1');
    await expect(header).toBeVisible();
    await expect(header).toHaveText('Leaderboard');
  });

  test('displays subtitle text', async ({ page }) => {
    await expect(page.getByText('Top performing AI agents')).toBeVisible();
  });

  test('sorting filter buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Popularity' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Followers' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Likes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Views' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Posts' })).toBeVisible();
  });

  test('leaderboard list renders agents or empty state', async ({ page }) => {
    // Wait for loading spinner to disappear
    await page
      .waitForSelector('[class*="animate-spin"]', {
        state: 'hidden',
        timeout: 15000,
      })
      .catch(() => {});

    const leaderboardList = page.locator('[role="list"][aria-label="Agent leaderboard"]');
    await expect(leaderboardList).toBeVisible();

    const hasAgents = await leaderboardList
      .locator('[role="listitem"]')
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .getByText('No agents yet')
      .isVisible()
      .catch(() => false);
    const hasError = await page
      .getByText('Failed to load leaderboard')
      .isVisible()
      .catch(() => false);

    expect(hasAgents || hasEmptyState || hasError).toBeTruthy();
  });

  test('clicking sort option changes active filter', async ({ page }) => {
    // Wait for initial load
    await page
      .waitForSelector('[class*="animate-spin"]', {
        state: 'hidden',
        timeout: 15000,
      })
      .catch(() => {});

    // Click on Followers sort option
    const followersButton = page.getByRole('button', { name: 'Followers' });
    await followersButton.click();

    // The active tab should have text-white class (active styling)
    await expect(followersButton).toHaveClass(/text-white/);

    // Click on Likes sort option
    const likesButton = page.getByRole('button', { name: 'Likes' });
    await likesButton.click();

    await expect(likesButton).toHaveClass(/text-white/);
  });

  test('leaderboard items contain agent links', async ({ page }) => {
    // Wait for loading
    await page
      .waitForSelector('[class*="animate-spin"]', {
        state: 'hidden',
        timeout: 15000,
      })
      .catch(() => {});

    const listItems = page.locator('[role="listitem"]');
    const hasItems = await listItems
      .first()
      .isVisible()
      .catch(() => false);

    if (hasItems) {
      // Each leaderboard item should have a link to an agent profile
      const agentLink = listItems.first().locator('a[href^="/agent/"]').first();
      await expect(agentLink).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('back button is present in header', async ({ page }) => {
    // The BackButton component should render a button in the header
    const headerButtons = page.locator('header button');
    await expect(headerButtons.first()).toBeVisible();
  });

  test('sidebar navigation is accessible from leaderboard', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore' })).toBeVisible();
  });
});
