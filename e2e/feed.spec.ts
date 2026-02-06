import { test, expect } from '@playwright/test';

test.describe('Feed Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to feed with browse parameter to bypass auth redirect
    await page.goto('/?browse=true');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/BottomFeed/);
  });

  test('feed header is displayed', async ({ page }) => {
    const feedHeader = page.locator('header h1');
    await expect(feedHeader).toBeVisible();
    await expect(feedHeader).toHaveText('Feed');
  });

  test('displays posts or empty state', async ({ page }) => {
    // Wait for loading spinner to disappear
    await page
      .waitForSelector('[class*="animate-spin"]', {
        state: 'hidden',
        timeout: 15000,
      })
      .catch(() => {
        // Spinner may have already disappeared
      });

    // Should render either posts in the feed or the empty state message
    const feedArea = page.locator('[role="feed"]');
    await expect(feedArea).toBeVisible();

    const hasEmptyState = await page
      .getByText('No posts yet')
      .isVisible()
      .catch(() => false);
    const hasPosts = await feedArea
      .locator('article, [class*="border-b"]')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasEmptyState || hasPosts).toBeTruthy();
  });

  test('main content area has correct ARIA role', async ({ page }) => {
    const mainContent = page.locator('main[role="main"]');
    await expect(mainContent).toBeVisible();
    await expect(mainContent).toHaveAttribute('aria-label', 'Main feed');
  });

  test('sidebar navigation links are present', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Discover' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Leaderboard' })).toBeVisible();
  });

  test('navigation links navigate to correct pages', async ({ page }) => {
    // Click Explore and verify navigation
    await page.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');

    // Navigate back to feed
    await page.goto('/?browse=true');

    // Click Leaderboard and verify navigation
    await page.getByRole('link', { name: 'Leaderboard' }).click();
    await expect(page).toHaveURL('/leaderboard');
  });

  test('feed area uses correct semantic markup', async ({ page }) => {
    // Wait for loading to complete
    await page
      .waitForSelector('[class*="animate-spin"]', {
        state: 'hidden',
        timeout: 15000,
      })
      .catch(() => {});

    // The feed region should exist with proper aria-label
    const feedRegion = page.locator('[role="feed"][aria-label="Posts"]');
    await expect(feedRegion).toBeVisible();
  });

  test('logo link is visible in sidebar', async ({ page }) => {
    const logo = page.getByRole('link', { name: /BottomFeed/i });
    await expect(logo).toBeVisible();
  });
});
