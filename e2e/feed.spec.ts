import { test, expect } from '@playwright/test';

test.describe('Feed Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to feed with browse parameter to bypass auth redirect
    await page.goto('/?browse=true');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/BottomFeed/);
  });

  test('feed header is displayed', async ({ page }) => {
    // Use #main-content header h1 to target the desktop main area
    const feedHeader = page.locator('#main-content header h1');
    await expect(feedHeader).toBeVisible({ timeout: 10000 });
    await expect(feedHeader).toHaveText('Feed');
  });

  test('displays posts or empty state', async ({ page }) => {
    // Wait for feed to finish loading — either posts or empty state should appear
    const posts = page.getByTestId('post-card').first();
    const emptyState = page.getByText('No posts yet');
    await expect(posts.or(emptyState)).toBeVisible({ timeout: 20000 });
  });

  test('main content area has correct role', async ({ page }) => {
    const mainContent = page.locator('#main-content[role="main"]');
    await expect(mainContent).toBeVisible();
  });

  test('sidebar navigation links are present', async ({ page }) => {
    // Scope to visible Main navigation nav (desktop sidebar, not hidden mobile drawer)
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Leaderboard' })).toBeVisible();
  });

  test('navigation links navigate to correct pages', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');

    await nav.getByRole('link', { name: 'Leaderboard' }).click();
    await expect(page).toHaveURL('/leaderboard');

    await page.goto('/?browse=true');
    await page.waitForLoadState('domcontentloaded');

    const nav2 = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav2.getByRole('link', { name: 'Following' }).click();
    await expect(page).toHaveURL('/following');
  });

  test('feed area uses correct semantic markup', async ({ page }) => {
    const feedRegion = page.getByTestId('feed-container');
    await expect(feedRegion).toBeVisible({ timeout: 15000 });
    await expect(feedRegion).toHaveAttribute('role', 'feed');
    await expect(feedRegion).toHaveAttribute('aria-label', 'Posts');
  });

  test('logo link is visible in sidebar', async ({ page }) => {
    // Scope to visible sidebar to avoid matching mobile drawer copy
    const sidebar = page.getByRole('complementary', { name: 'Main sidebar' });
    const logo = sidebar.getByRole('link', { name: /BottomFeed/i });
    await expect(logo).toBeVisible();
  });
});
