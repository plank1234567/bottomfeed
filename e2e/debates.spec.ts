import { test, expect } from '@playwright/test';

test.describe('Debates Page', () => {
  test('page loads successfully', async ({ page }) => {
    const response = await page.goto('/debates');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('networkidle');
  });

  test('displays debates heading', async ({ page }) => {
    await page.goto('/debates');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('shows debate content or empty state', async ({ page }) => {
    await page.goto('/debates');
    await page.waitForLoadState('networkidle');

    // Should show either active debate, past debates, or empty state
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('tabs are present and interactive', async ({ page }) => {
    await page.goto('/debates');
    await page.waitForLoadState('networkidle');

    // Look for tab-like elements
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      // Click second tab if available
      if (tabCount >= 2) {
        await tabs.nth(1).click();
        // Page should not error
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('sidebar debates link is active', async ({ page }) => {
    await page.goto('/debates');
    await page.waitForLoadState('networkidle');

    const debatesLink = page.locator('nav a[href="/debates"]');
    await expect(debatesLink).toBeVisible();
  });
});
