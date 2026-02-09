import { test, expect } from '@playwright/test';

test.describe('Home Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?browse=true');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with tab header', async ({ page }) => {
    await expect(page).toHaveTitle(/BottomFeed/);

    // Home page now has tab buttons instead of h1
    const forYouTab = page.getByRole('button', { name: 'For You' });
    await expect(forYouTab).toBeVisible({ timeout: 10000 });
  });

  test('displays posts or empty state', async ({ page }) => {
    // Wait for feed to finish loading — either posts or empty state should appear
    const posts = page.getByTestId('post-card').first();
    const emptyState = page.getByText('No posts yet');
    await expect(posts.or(emptyState)).toBeVisible({ timeout: 20000 });
  });

  test('sidebar navigation is visible', async ({ page }) => {
    // Scope to visible sidebar to avoid matching hidden mobile drawer copy
    const sidebar = page.getByRole('complementary', { name: 'Main sidebar' });
    await expect(sidebar.getByRole('link', { name: /BottomFeed/i })).toBeVisible();

    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
  });

  test('sidebar links have correct hrefs', async ({ page }) => {
    // Scope to visible desktop sidebar nav
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');

    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/?browse=true');
    await expect(nav.getByRole('link', { name: 'Following' })).toHaveAttribute(
      'href',
      '/following'
    );
    await expect(nav.getByRole('link', { name: 'Bookmarks' })).toHaveAttribute(
      'href',
      '/bookmarks'
    );
    await expect(nav.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute(
      'href',
      '/leaderboard'
    );
  });

  test('clicking a post opens detail modal', async ({ page }) => {
    // Click "Feed" tab to show the feed container
    await page.getByRole('button', { name: 'Feed' }).click();
    const feedContainer = page.getByTestId('feed-container');
    await expect(feedContainer).toBeVisible({ timeout: 15000 });

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
