import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Home link navigates to home page', async ({ page }) => {
    // Already on home, navigate away first
    await page.goto('/trending');
    await expect(page).toHaveURL('/trending');

    // Now click Home to go back
    await page.locator('nav a[href="/"]').first().click();
    await expect(page).toHaveURL('/');
    const feedHeader = page.locator('header h1:has-text("Feed")');
    await expect(feedHeader).toBeVisible();
  });

  test('Explore link navigates to trending page', async ({ page }) => {
    await page.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');
  });

  test('Discover link navigates to agents page', async ({ page }) => {
    await page.getByRole('link', { name: 'Discover' }).click();
    await expect(page).toHaveURL('/agents');
  });

  test('Following link navigates to following page', async ({ page }) => {
    await page.getByRole('link', { name: 'Following' }).click();
    await expect(page).toHaveURL('/following');
  });

  test('Bookmarks link navigates to bookmarks page', async ({ page }) => {
    await page.getByRole('link', { name: 'Bookmarks' }).click();
    await expect(page).toHaveURL('/bookmarks');
  });

  test('Conversations link navigates to conversations page', async ({ page }) => {
    await page.getByRole('link', { name: 'Conversations' }).click();
    await expect(page).toHaveURL('/conversations');
  });

  test('Activity link navigates to activity page', async ({ page }) => {
    // Use exact match to avoid matching other links containing "Activity"
    await page.locator('nav a[href="/activity"]').click();
    await expect(page).toHaveURL('/activity');
  });

  test('Leaderboard link navigates to leaderboard page', async ({ page }) => {
    await page.getByRole('link', { name: 'Leaderboard' }).click();
    await expect(page).toHaveURL('/leaderboard');
  });

  test('API Documentation link navigates to api-docs page', async ({ page }) => {
    await page.getByRole('link', { name: 'API Documentation' }).click();
    await expect(page).toHaveURL('/api-docs');
  });

  test('browser back button works correctly', async ({ page }) => {
    // Navigate through multiple pages
    await page.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');

    await page.getByRole('link', { name: 'Discover' }).click();
    await expect(page).toHaveURL('/agents');

    // Use browser back
    await page.goBack();
    await expect(page).toHaveURL('/trending');

    await page.goBack();
    await expect(page).toHaveURL('/');
  });

  test('browser forward button works correctly', async ({ page }) => {
    // Navigate forward
    await page.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/');

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/trending');
  });

  test('logo link navigates to home', async ({ page }) => {
    // First navigate away from home
    await page.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL('/trending');

    // Click logo to go home
    await page.getByRole('link', { name: /BottomFeed/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('active nav item is styled differently', async ({ page }) => {
    // On home page, Home link should have bold styling
    const homeLink = page.getByRole('link', { name: 'Home' });
    await expect(homeLink).toHaveClass(/font-bold/);

    // Navigate to another page
    await page.getByRole('link', { name: 'Explore' }).click();

    // Now Explore should be bold, Home should not
    const exploreLink = page.getByRole('link', { name: 'Explore' });
    await expect(exploreLink).toHaveClass(/font-bold/);
  });

  test('direct URL navigation works', async ({ page }) => {
    // Navigate directly to different pages
    await page.goto('/agents');
    await expect(page).toHaveURL('/agents');

    await page.goto('/leaderboard');
    await expect(page).toHaveURL('/leaderboard');

    await page.goto('/search');
    await expect(page).toHaveURL('/search');
  });

  test('404 handling for invalid routes', async ({ page }) => {
    // Navigate to a non-existent page
    const response = await page.goto('/this-page-does-not-exist');

    // Should either show 404 or redirect to home
    // Next.js may handle this differently based on config
    expect(response?.status()).toBe(404);
  });
});

test.describe('Page-specific navigation', () => {
  test('post detail page is accessible via URL', async ({ page }) => {
    // First find a valid post ID from the home page
    await page.goto('/');

    // Wait for posts to load
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    // Check if there are posts
    const postCard = page.locator('[class*="border-b"][class*="hover:bg"]').first();
    const hasPost = await postCard.isVisible().catch(() => false);

    if (hasPost) {
      // Click on post to open modal
      await postCard.click();

      // Modal should appear
      await page.waitForSelector('[class*="fixed"][class*="inset-0"]', { timeout: 5000 });

      // The modal should be visible
      await expect(page.locator('[class*="fixed"][class*="inset-0"]')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('agents page shows list of agents', async ({ page }) => {
    await page.goto('/agents');

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    // Should show agents or empty state
    const hasAgents = await page.locator('a[href^="/agent/"]').first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/No agents/i).isVisible().catch(() => false);

    expect(hasAgents || hasEmptyState).toBeTruthy();
  });

  test('clicking agent from list navigates to profile', async ({ page }) => {
    await page.goto('/agents');

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible().catch(() => false);

    if (hasAgents) {
      const href = await agentLink.getAttribute('href');
      await agentLink.click();
      await expect(page).toHaveURL(href!);
    } else {
      test.skip();
    }
  });
});
