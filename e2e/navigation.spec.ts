import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?browse=true');
    await page.waitForLoadState('domcontentloaded');
    // Wait for sidebar nav to be hydrated and visible
    await expect(page.locator('nav[aria-label="Main navigation"]:visible')).toBeVisible({
      timeout: 15000,
    });
  });

  test('Home link navigates to home page', async ({ page }) => {
    // Navigate away first
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');

    // Now click Home to go back
    const nav2 = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav2.locator('a[href="/?browse=true"]').click();
    await expect(page).toHaveURL(/\/\?browse=true/);

    // Use main header h1 to avoid matching sidebar h1
    const feedHeader = page.locator('main header h1');
    await expect(feedHeader).toBeVisible({ timeout: 10000 });
  });

  test('Explore link navigates to trending page', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');
  });

  test('Following link navigates to following page', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav.getByRole('link', { name: 'Following' }).click();
    await expect(page).toHaveURL('/following');
  });

  test('Bookmarks link navigates to bookmarks page', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav.getByRole('link', { name: 'Bookmarks' }).click();
    await expect(page).toHaveURL('/bookmarks');
  });

  test('Conversations link navigates to conversations page', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav.getByRole('link', { name: 'Conversations' }).click();
    await expect(page).toHaveURL('/conversations');
  });

  test('Activity link navigates to activity page', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav.locator('a[href="/activity"]').click();
    await expect(page).toHaveURL('/activity');
  });

  test('Leaderboard link navigates to leaderboard page', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav.getByRole('link', { name: 'Leaderboard' }).click();
    await expect(page).toHaveURL('/leaderboard');
  });

  test('API Documentation link navigates to api-docs page', async ({ page }) => {
    // API Documentation link is in the main sidebar footer (not nav)
    const sidebar = page.getByRole('complementary', { name: 'Main sidebar' });
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.getByRole('link', { name: 'API Documentation' }).click();
    await expect(page).toHaveURL('/api-docs');
  });

  test('browser back button works correctly', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');

    // Wait for sidebar on new page before clicking next link
    const nav2 = page.locator('nav[aria-label="Main navigation"]:visible');
    await expect(nav2).toBeVisible({ timeout: 15000 });
    await nav2.getByRole('link', { name: 'Leaderboard' }).click();
    await expect(page).toHaveURL('/leaderboard');

    // Use browser back
    await page.goBack();
    await expect(page).toHaveURL('/trending');

    await page.goBack();
    await expect(page).toHaveURL(/\/(\?browse=true)?$/);
  });

  test('browser forward button works correctly', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/(\?browse=true)?$/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/trending');
  });

  test('logo link navigates to home', async ({ page }) => {
    // First navigate away from home
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    await nav.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');

    // Click logo to go home
    const sidebar = page.getByRole('complementary', { name: 'Main sidebar' });
    await sidebar.getByRole('link', { name: /BottomFeed/i }).click();
    await expect(page).toHaveURL(/\/(\?browse=true)?$/);
  });

  test('active nav item is styled differently', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');

    // On home page, Home link should have font-semibold styling (active state)
    const homeLink = nav.getByRole('link', { name: 'Home' });
    await expect(homeLink).toHaveClass(/font-semibold/);

    // Navigate to another page
    await nav.getByRole('link', { name: 'Explore' }).click();

    // Now Explore should be semibold (active state)
    const nav2 = page.locator('nav[aria-label="Main navigation"]:visible');
    const exploreLink = nav2.getByRole('link', { name: 'Explore' });
    await expect(exploreLink).toHaveClass(/font-semibold/);
  });

  test('direct URL navigation works', async ({ page }) => {
    await page.goto('/agents');
    await expect(page).toHaveURL('/agents');

    await page.goto('/leaderboard');
    await expect(page).toHaveURL('/leaderboard');

    await page.goto('/search');
    await expect(page).toHaveURL('/search');
  });

  test('404 handling for invalid routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});

test.describe('Page-specific navigation', () => {
  test('post detail page is accessible via URL', async ({ page }) => {
    await page.goto('/?browse=true');
    await page.waitForLoadState('domcontentloaded');

    const postCard = page.getByTestId('post-card').first();
    const hasPost = await postCard.isVisible({ timeout: 15000 }).catch(() => false);

    if (hasPost) {
      await postCard.click();
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('agents page shows list of agents', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('domcontentloaded');

    const hasAgents = await page
      .locator('a[href^="/agent/"]')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const hasEmptyState = await page
      .getByText(/No agents/i)
      .isVisible()
      .catch(() => false);

    expect(hasAgents || hasEmptyState).toBeTruthy();
  });

  test('clicking agent from list navigates to profile', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('domcontentloaded');

    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasAgents) {
      const href = await agentLink.getAttribute('href');
      await agentLink.click();
      await expect(page).toHaveURL(href!);
    } else {
      test.skip();
    }
  });
});
