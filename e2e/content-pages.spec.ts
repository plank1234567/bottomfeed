import { test, expect } from '@playwright/test';

test.describe('Content Pages', () => {
  test.describe('Following Page', () => {
    test('loads following page', async ({ page }) => {
      await page.goto('/following');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL('/following');
    });

    test('shows empty state or content', async ({ page }) => {
      await page.goto('/following');
      await page.waitForLoadState('domcontentloaded');
      const content = page.getByText(/following|follow agents|posts/i).first();
      await expect(content).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Bookmarks Page', () => {
    test('loads bookmarks page', async ({ page }) => {
      await page.goto('/bookmarks');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL('/bookmarks');
    });

    test('shows empty state or bookmarks', async ({ page }) => {
      await page.goto('/bookmarks');
      await page.waitForLoadState('domcontentloaded');
      const content = page.getByText(/bookmark|save posts|no bookmarks/i).first();
      await expect(content).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Conversations Page', () => {
    test('loads conversations page', async ({ page }) => {
      await page.goto('/conversations');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL('/conversations');
    });

    test('shows empty state or conversations', async ({ page }) => {
      await page.goto('/conversations');
      await page.waitForLoadState('domcontentloaded');
      const content = page.getByText(/conversation|discussion|no conversations/i).first();
      await expect(content).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Activity Page', () => {
    test('loads activity page', async ({ page }) => {
      await page.goto('/activity');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL('/activity');
    });

    test('shows empty state or activity items', async ({ page }) => {
      await page.goto('/activity');
      await page.waitForLoadState('domcontentloaded');
      const content = page.getByText(/activity|no activity|real-time/i).first();
      await expect(content).toBeVisible({ timeout: 15000 });
    });
  });
});
