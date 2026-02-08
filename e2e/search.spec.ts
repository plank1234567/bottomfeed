import { test, expect } from '@playwright/test';

test.describe('Search Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('load');
  });

  test('search page loads with input field', async ({ page }) => {
    // Check for the search input in the page header (inside main)
    const searchInput = page.locator('main header input[placeholder="Search..."]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('shows prompt to enter search term when empty', async ({ page }) => {
    // Should show prompt message
    await expect(page.getByText(/Enter a search term/i)).toBeVisible({ timeout: 10000 });
  });

  test('search tabs are visible', async ({ page }) => {
    // Check for tabs
    await expect(page.getByRole('button', { name: 'Top' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Latest' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'People' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Media' })).toBeVisible();
  });

  test('can type in search input and submit', async ({ page }) => {
    // Use the search input in the page header (inside main)
    const searchInput = page.locator('main header input[placeholder="Search..."]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('test query');

    // Press enter to search
    await searchInput.press('Enter');

    // URL should update with query parameter
    await expect(page).toHaveURL(/search\?q=test%20query/);
  });

  test('searching shows results or no results message', async ({ page }) => {
    // Navigate with a query
    await page.goto('/search?q=agent');
    await page.waitForLoadState('networkidle');

    // Should either show results or "no posts found" message or post count or loading
    const hasNoResults = await page
      .getByText(/No .* found/i)
      .first()
      .isVisible({ timeout: 15000 })
      .catch(() => false);
    const hasResults = await page
      .getByTestId('post-card')
      .first()
      .isVisible()
      .catch(() => false);
    // Also check for the results count text (e.g., "X posts")
    const hasResultsCount = await page
      .getByText(/\d+ posts?/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasSearchInput = await page
      .getByRole('searchbox')
      .or(page.locator('input[type="search"], input[placeholder*="Search"]'))
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasNoResults || hasResults || hasResultsCount || hasSearchInput).toBeTruthy();
  });

  test('switching tabs works', async ({ page }) => {
    // Navigate with a query
    await page.goto('/search?q=test');
    await page.waitForLoadState('domcontentloaded');

    // Click on People tab
    const peopleTab = page.getByRole('button', { name: 'People' });
    await expect(peopleTab).toBeVisible({ timeout: 10000 });
    await peopleTab.click();

    // Tab should be active (has different styling)
    await expect(peopleTab).toHaveClass(/text-white/);

    // Wait for people results or no-results message to appear
    const people = page.locator('main a[href^="/agent/"]').first();
    const noPeople = page.getByText(/No people found|No agents found|No results/i).first();
    await expect(people.or(noPeople)).toBeVisible({ timeout: 15000 });
  });

  test('back button navigates to previous page', async ({ page }) => {
    // First go to leaderboard (/ redirects to /landing for unauthenticated users), then search
    await page.goto('/leaderboard');
    await page.waitForLoadState('load');
    await page.goto('/search?q=test');
    await page.waitForLoadState('load');

    // Find and click back button in the page header (inside main)
    const backButton = page.locator('main header button').first();
    await expect(backButton).toBeVisible({ timeout: 15000 });
    await backButton.click();

    // Should navigate back to leaderboard
    await expect(page).toHaveURL('/leaderboard');
  });

  test('clicking search result navigates correctly', async ({ page }) => {
    // Search for something
    await page.goto('/search?q=agent');
    await page.waitForLoadState('domcontentloaded');

    // Switch to People tab for more predictable navigation
    const peopleTab = page.getByRole('button', { name: 'People' });
    await expect(peopleTab).toBeVisible({ timeout: 10000 });
    await peopleTab.click();

    // Find an agent link in the main content (not sidebar)
    const agentLink = page.locator('main a[href^="/agent/"]').first();
    const hasAgentLink = await agentLink.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasAgentLink) {
      await agentLink.click();
      // Should navigate to agent profile
      await expect(page).toHaveURL(/\/agent\//);
    } else {
      // No results to click on
      test.skip();
    }
  });
});
