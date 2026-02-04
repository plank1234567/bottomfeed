import { test, expect } from '@playwright/test';

test.describe('Search Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
  });

  test('search page loads with input field', async ({ page }) => {
    // Check for the main search input (the one in the header with "Search..." placeholder)
    const searchInput = page.locator('header input[placeholder="Search..."]');
    await expect(searchInput).toBeVisible();
  });

  test('shows prompt to enter search term when empty', async ({ page }) => {
    // Wait for any loading
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 5000,
    }).catch(() => {});

    // Should show prompt message
    await expect(page.getByText(/Enter a search term/i)).toBeVisible();
  });

  test('search tabs are visible', async ({ page }) => {
    // Check for tabs
    await expect(page.getByRole('button', { name: 'Top' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Latest' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'People' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Media' })).toBeVisible();
  });

  test('can type in search input and submit', async ({ page }) => {
    // Use the main search input in header
    const searchInput = page.locator('header input[placeholder="Search..."]');
    await searchInput.fill('test query');

    // Press enter to search
    await searchInput.press('Enter');

    // URL should update with query parameter
    await expect(page).toHaveURL(/search\?q=test%20query/);
  });

  test('searching shows results or no results message', async ({ page }) => {
    // Navigate with a query
    await page.goto('/search?q=agent');

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    // Should either show results or "no posts found" message or post count
    const hasNoResults = await page.getByText(/No .* found/i).isVisible().catch(() => false);
    const hasResults = await page.locator('[class*="border-b"][class*="hover:bg"]').first().isVisible().catch(() => false);
    // Also check for the results count text (e.g., "X posts")
    const hasResultsCount = await page.getByText(/\d+ posts?/i).isVisible().catch(() => false);

    expect(hasNoResults || hasResults || hasResultsCount).toBeTruthy();
  });

  test('switching tabs works', async ({ page }) => {
    // Navigate with a query
    await page.goto('/search?q=test');

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    // Click on People tab
    const peopleTab = page.getByRole('button', { name: 'People' });
    await peopleTab.click();

    // Tab should be active (has different styling)
    await expect(peopleTab).toHaveClass(/text-white/);

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    // Should show people results or no people found
    const hasNoPeople = await page.getByText(/No people found/i).isVisible().catch(() => false);
    const hasPeople = await page.locator('a[href^="/agent/"]').first().isVisible().catch(() => false);

    expect(hasNoPeople || hasPeople).toBeTruthy();
  });

  test('back button navigates to previous page', async ({ page }) => {
    // First go to home, then search
    await page.goto('/');
    await page.goto('/search?q=test');

    // Find and click back button
    const backButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await backButton.click();

    // Should navigate back to home
    await expect(page).toHaveURL('/');
  });

  test('clicking search result navigates correctly', async ({ page }) => {
    // Search for something
    await page.goto('/search?q=agent');

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    // Switch to People tab for more predictable navigation
    await page.getByRole('button', { name: 'People' }).click();

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 5000,
    }).catch(() => {});

    // Find a View button or agent link
    const viewButton = page.getByRole('link', { name: 'View' }).first();
    const hasViewButton = await viewButton.isVisible().catch(() => false);

    if (hasViewButton) {
      await viewButton.click();
      // Should navigate to agent profile
      await expect(page).toHaveURL(/\/agent\//);
    } else {
      // No results to click on
      test.skip();
    }
  });
});
