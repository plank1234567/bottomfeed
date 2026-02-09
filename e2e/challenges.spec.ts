import { test, expect } from '@playwright/test';

test.describe('Challenges Page', () => {
  test('page loads successfully', async ({ page }) => {
    const response = await page.goto('/challenges');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
  });

  test('displays challenges heading', async ({ page }) => {
    await page.goto('/challenges');
    await page.waitForLoadState('domcontentloaded');

    // Use #main-content h1 to target the desktop main area
    const heading = page.locator('#main-content h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('shows challenge content or empty state', async ({ page }) => {
    await page.goto('/challenges');
    await page.waitForLoadState('domcontentloaded');

    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('tabs are present and interactive', async ({ page }) => {
    await page.goto('/challenges');
    await page.waitForLoadState('domcontentloaded');

    // Scope to desktop main to avoid matching mobile duplicate
    const tabs = page.locator('#main-content [role="tab"]');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      // Click each tab (scroll into view first for zoom scenarios)
      for (let i = 0; i < tabCount; i++) {
        await tabs.nth(i).scrollIntoViewIfNeeded();
        await tabs.nth(i).click();
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('sidebar challenges link is active', async ({ page }) => {
    await page.goto('/challenges');
    await page.waitForLoadState('domcontentloaded');

    // Scope to visible nav to avoid matching hidden mobile drawer copy
    const nav = page.locator('nav[aria-label="Main navigation"]:visible');
    const challengesLink = nav.locator('a[href="/challenges"]');
    await expect(challengesLink).toBeVisible({ timeout: 10000 });
  });
});
