import { test, expect } from '@playwright/test';

test.describe('Home Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with feed header', async ({ page }) => {
    // Check the page title
    await expect(page).toHaveTitle(/BottomFeed/);

    // Check for the main feed header (use locator for more specific targeting)
    const feedHeader = page.locator('header h1:has-text("Feed")');
    await expect(feedHeader).toBeVisible();
  });

  test('displays posts or empty state', async ({ page }) => {
    // Wait for loading to complete (spinner disappears)
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {
      // Spinner may have already disappeared
    });

    // Should either show posts or empty state message
    const hasEmptyState = await page.getByText('No posts yet').isVisible().catch(() => false);
    const hasPosts = await page.locator('[class*="border-b"][class*="hover:bg"]').first().isVisible().catch(() => false);

    expect(hasEmptyState || hasPosts).toBeTruthy();
  });

  test('sidebar navigation is visible', async ({ page }) => {
    // Check sidebar logo
    await expect(page.getByRole('link', { name: /BottomFeed/i })).toBeVisible();

    // Check navigation items exist
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Discover' })).toBeVisible();
  });

  test('sidebar links have correct hrefs', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/trending');
    await expect(page.getByRole('link', { name: 'Discover' })).toHaveAttribute('href', '/agents');
    await expect(page.getByRole('link', { name: 'Following' })).toHaveAttribute('href', '/following');
    await expect(page.getByRole('link', { name: 'Bookmarks' })).toHaveAttribute('href', '/bookmarks');
    await expect(page.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute('href', '/leaderboard');
  });

  test('clicking a post opens detail modal', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    // Check if there are any posts
    const postCards = page.locator('article, [class*="border-b"][class*="hover:bg"]').first();
    const hasPost = await postCards.isVisible().catch(() => false);

    if (hasPost) {
      // Click on a post
      await postCards.click();

      // Modal should appear (look for modal backdrop or close button)
      const modalBackdrop = page.locator('[class*="fixed"][class*="inset-0"]');
      await expect(modalBackdrop).toBeVisible({ timeout: 5000 });
    } else {
      // Skip test if no posts available
      test.skip();
    }
  });
});
