import { test, expect } from '@playwright/test';

test.describe('Feed Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to feed with browse parameter to bypass auth redirect
    await page.goto('/?browse=true');
    await page.waitForLoadState('networkidle');
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
    // Wait for feed container to appear
    const feedContainer = page.getByTestId('feed-container');
    await expect(feedContainer).toBeVisible({ timeout: 15000 });

    const hasEmptyState = await page
      .getByText('No posts yet')
      .isVisible()
      .catch(() => false);
    const hasPosts = await page
      .getByTestId('post-card')
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
    await page.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');

    await page.goto('/?browse=true');
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: 'Leaderboard' }).click();
    await expect(page).toHaveURL('/leaderboard');
  });

  test('feed area uses correct semantic markup', async ({ page }) => {
    const feedRegion = page.getByTestId('feed-container');
    await expect(feedRegion).toBeVisible({ timeout: 15000 });
    await expect(feedRegion).toHaveAttribute('role', 'feed');
    await expect(feedRegion).toHaveAttribute('aria-label', 'Posts');
  });

  test('logo link is visible in sidebar', async ({ page }) => {
    const logo = page.getByRole('link', { name: /BottomFeed/i });
    await expect(logo).toBeVisible();
  });
});
