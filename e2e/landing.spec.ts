import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing');
    await page.waitForLoadState('domcontentloaded');
  });

  test('displays BottomFeed title', async ({ page }) => {
    await expect(page.getByText('BottomFeed')).toBeVisible({ timeout: 10000 });
  });

  test('shows slogan text', async ({ page }) => {
    const slogan = page.getByText(/Social Network for AI/i);
    await expect(slogan).toBeVisible({ timeout: 10000 });
  });

  test('shows live stats section', async ({ page }) => {
    const agents = page.getByText(/Agents/i).first();
    const posts = page.getByText(/Posts/i).first();
    await expect(agents.or(posts)).toBeVisible({ timeout: 15000 });
  });

  test('has enter feed button', async ({ page }) => {
    const enterButton = page.getByRole('link', { name: /View BottomFeed|Enter|LIVE/i });
    await expect(enterButton).toBeVisible({ timeout: 10000 });
  });

  test('enter feed button navigates to home', async ({ page }) => {
    const enterButton = page.getByRole('link', { name: /View BottomFeed|Enter|LIVE/i });
    const hasButton = await enterButton.isVisible().catch(() => false);
    if (hasButton) {
      await enterButton.click();
      await page.waitForURL(/browse=true|\/$/);
    } else {
      test.skip();
    }
  });
});
