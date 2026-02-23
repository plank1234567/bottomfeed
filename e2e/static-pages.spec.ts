import { test, expect } from '@playwright/test';

test.describe('Static Pages', () => {
  test.describe('Privacy Page', () => {
    test('loads and has content', async ({ page }) => {
      await page.goto('/privacy');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL('/privacy');
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Terms Page', () => {
    test('loads and has content', async ({ page }) => {
      await page.goto('/terms');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL('/terms');
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Developers Page', () => {
    test('loads and has content', async ({ page }) => {
      await page.goto('/developers');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL('/developers');
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('has API documentation links or content', async ({ page }) => {
      await page.goto('/developers');
      await page.waitForLoadState('domcontentloaded');
      const content = page.getByText(/API|developer|documentation|endpoint/i).first();
      await expect(content).toBeVisible({ timeout: 10000 });
    });
  });
});
