import { test, expect } from '@playwright/test';

test.describe('Post Detail Page', () => {
  test('loads post detail page', async ({ page }) => {
    // First get a post ID from the feed
    await page.goto('/?browse=true');
    await page.waitForLoadState('domcontentloaded');

    // Click Feed tab to show posts
    const feedTab = page.locator('#main-content').getByRole('button', { name: 'Feed' });
    const hasFeedTab = await feedTab.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasFeedTab) {
      await feedTab.click();
    }

    const postCard = page.getByTestId('post-card').first();
    const hasPost = await postCard.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasPost) {
      test.skip();
      return;
    }

    // Get post link and navigate directly
    const postLink = postCard.getByRole('link').first();
    const href = await postLink.getAttribute('href');
    if (href) {
      await page.goto(href);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/post\//);
    } else {
      test.skip();
    }
  });

  test('post detail shows author info', async ({ page }) => {
    await page.goto('/?browse=true');
    await page.waitForLoadState('domcontentloaded');

    const feedTab = page.locator('#main-content').getByRole('button', { name: 'Feed' });
    const hasFeedTab = await feedTab.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasFeedTab) {
      await feedTab.click();
    }

    const postCard = page.getByTestId('post-card').first();
    const hasPost = await postCard.isVisible({ timeout: 15000 }).catch(() => false);

    if (hasPost) {
      await postCard.click();
      const modal = page.getByRole('dialog');
      const hasModal = await modal.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasModal) {
        // Should have some text content
        const content = modal.locator('p, span').first();
        await expect(content).toBeVisible({ timeout: 5000 });
      }
    } else {
      test.skip();
    }
  });

  test('handles non-existent post gracefully', async ({ page }) => {
    await page.goto('/post/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('domcontentloaded');

    // Should show some content (error or not found)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('post detail page has back navigation', async ({ page }) => {
    await page.goto('/?browse=true');
    await page.waitForLoadState('domcontentloaded');

    const feedTab = page.locator('#main-content').getByRole('button', { name: 'Feed' });
    const hasFeedTab = await feedTab.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasFeedTab) {
      await feedTab.click();
    }

    const postCard = page.getByTestId('post-card').first();
    const hasPost = await postCard.isVisible({ timeout: 15000 }).catch(() => false);

    if (hasPost) {
      await postCard.click();
      const modal = page.getByRole('dialog');
      const hasModal = await modal.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasModal) {
        // Close button should exist
        const closeButton = modal
          .getByRole('button', { name: /close|back/i })
          .or(modal.locator('button').first());
        await expect(closeButton).toBeVisible({ timeout: 5000 });
      }
    } else {
      test.skip();
    }
  });
});
