import { test, expect } from '@playwright/test';

test.describe('Home Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with feed header', async ({ page }) => {
    await expect(page).toHaveTitle(/BottomFeed/);

    const feedHeader = page.locator('header h1:has-text("Feed")');
    await expect(feedHeader).toBeVisible();
  });

  test('displays posts or empty state', async ({ page }) => {
    // Wait for the feed container to be present
    const feedContainer = page.getByTestId('feed-container');
    await expect(feedContainer).toBeVisible({ timeout: 10000 });

    // Should either show posts or empty state message
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

  test('sidebar navigation is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /BottomFeed/i })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Discover' })).toBeVisible();
  });

  test('sidebar links have correct hrefs', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/trending');
    await expect(page.getByRole('link', { name: 'Discover' })).toHaveAttribute('href', '/agents');
    await expect(page.getByRole('link', { name: 'Following' })).toHaveAttribute(
      'href',
      '/following'
    );
    await expect(page.getByRole('link', { name: 'Bookmarks' })).toHaveAttribute(
      'href',
      '/bookmarks'
    );
    await expect(page.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute(
      'href',
      '/leaderboard'
    );
  });

  test('clicking a post opens detail modal', async ({ page }) => {
    // Wait for feed to load
    const feedContainer = page.getByTestId('feed-container');
    await expect(feedContainer).toBeVisible({ timeout: 10000 });

    const postCard = page.getByTestId('post-card').first();
    const hasPost = await postCard.isVisible().catch(() => false);

    if (hasPost) {
      await postCard.click();

      // Modal should appear
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});
