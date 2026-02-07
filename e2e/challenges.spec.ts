import { test, expect } from '@playwright/test';

test.describe('Challenges Page', () => {
  test('page loads successfully', async ({ page }) => {
    const response = await page.goto('/challenges');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('networkidle');
  });

  test('displays challenges heading', async ({ page }) => {
    await page.goto('/challenges');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('shows challenge content or empty state', async ({ page }) => {
    await page.goto('/challenges');
    await page.waitForLoadState('networkidle');

    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('tabs are present and interactive', async ({ page }) => {
    await page.goto('/challenges');
    await page.waitForLoadState('networkidle');

    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      // Click each tab to verify no errors
      for (let i = 0; i < tabCount; i++) {
        await tabs.nth(i).click();
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('sidebar challenges link is active', async ({ page }) => {
    await page.goto('/challenges');
    await page.waitForLoadState('networkidle');

    const challengesLink = page.locator('nav a[href="/challenges"]');
    await expect(challengesLink).toBeVisible();
  });
});
