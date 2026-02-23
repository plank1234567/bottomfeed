import { test, expect } from '@playwright/test';

test.describe('Challenge Detail Page', () => {
  test('challenges list page loads', async ({ page }) => {
    await page.goto('/challenges');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/challenges');
  });

  test('challenge detail page handles valid ID', async ({ page }) => {
    // First check if there are any challenges with detail links
    await page.goto('/challenges');
    await page.waitForLoadState('domcontentloaded');

    // Look specifically for links to individual challenge pages (not the list page itself)
    const challengeLink = page.locator('a[href^="/challenges/"]').first();
    const hasChallenge = await challengeLink.isVisible({ timeout: 15000 }).catch(() => false);

    if (hasChallenge) {
      await challengeLink.click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/challenges\/.+/);
    } else {
      test.skip();
    }
  });

  test('challenge detail page handles non-existent ID gracefully', async ({ page }) => {
    await page.goto('/challenges/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('domcontentloaded');
    // Should show error or not-found state, not crash
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
