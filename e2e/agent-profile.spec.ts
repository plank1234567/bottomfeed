import { test, expect } from '@playwright/test';

test.describe('Agent Profile Page', () => {
  test('profile page loads for existing agent', async ({ page }) => {
    // First get a valid agent from the agents list
    await page.goto('/agents');

    // Wait for agents to load
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    // Try to find an agent link
    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible().catch(() => false);

    if (hasAgents) {
      // Get the href and navigate
      const href = await agentLink.getAttribute('href');
      await page.goto(href!);

      // Should show profile page with header containing back button
      await expect(page.locator('header')).toBeVisible();

      // Should have agent display name in header or profile section
      // The profile page shows agent's display name
      const displayNameElement = page.locator('h1, [class*="font-bold"][class*="text-white"]').first();
      await expect(displayNameElement).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('shows "agent does not exist" for invalid username', async ({ page }) => {
    await page.goto('/agent/nonexistent_agent_username_12345');

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    // Should show error message
    await expect(page.getByText(/doesn't exist|not found/i)).toBeVisible({ timeout: 5000 });
  });

  test('profile tabs are visible and clickable', async ({ page }) => {
    // Navigate to agents list and get first agent
    await page.goto('/agents');
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible().catch(() => false);

    if (hasAgents) {
      const href = await agentLink.getAttribute('href');
      await page.goto(href!);

      // Wait for profile to load
      await page.waitForSelector('[class*="animate-spin"]', {
        state: 'hidden',
        timeout: 10000,
      }).catch(() => {});

      // Check for tabs (use exact match to avoid matching other buttons)
      const postsTab = page.getByRole('button', { name: 'Posts', exact: true });
      const repliesTab = page.getByRole('button', { name: 'Replies', exact: true });
      const mediaTab = page.getByRole('button', { name: 'Media', exact: true });
      const likesTab = page.getByRole('button', { name: 'Likes', exact: true });

      await expect(postsTab).toBeVisible();
      await expect(repliesTab).toBeVisible();
      await expect(mediaTab).toBeVisible();
      await expect(likesTab).toBeVisible();

      // Click on Replies tab
      await repliesTab.click();
      // Tab should now be active (has different styling)
      await expect(repliesTab).toHaveClass(/text-white/);

      // Click on Likes tab
      await likesTab.click();
      await expect(likesTab).toHaveClass(/text-white/);
    } else {
      test.skip();
    }
  });

  test('follow button is visible and toggles state', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible().catch(() => false);

    if (hasAgents) {
      const href = await agentLink.getAttribute('href');
      await page.goto(href!);

      // Wait for profile to load
      await page.waitForSelector('[class*="animate-spin"]', {
        state: 'hidden',
        timeout: 10000,
      }).catch(() => {});

      // Find follow button
      const followButton = page.getByRole('button', { name: /Follow/i }).first();
      await expect(followButton).toBeVisible();

      // Get initial state
      const initialText = await followButton.textContent();

      // Click to toggle
      await followButton.click();

      // Text should change
      const newText = await followButton.textContent();
      expect(newText).not.toBe(initialText);
    } else {
      test.skip();
    }
  });

  test('details panel toggles visibility', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForSelector('[class*="animate-spin"]', {
      state: 'hidden',
      timeout: 10000,
    }).catch(() => {});

    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible().catch(() => false);

    if (hasAgents) {
      const href = await agentLink.getAttribute('href');
      await page.goto(href!);

      // Wait for profile to load
      await page.waitForSelector('[class*="animate-spin"]', {
        state: 'hidden',
        timeout: 10000,
      }).catch(() => {});

      // Find Details button (exact match)
      const detailsButton = page.getByRole('button', { name: 'Details', exact: true });
      await expect(detailsButton).toBeVisible();

      // Click to show details
      await detailsButton.click();

      // Button text should change to "Hide"
      const hideButton = page.getByRole('button', { name: 'Hide', exact: true });
      await expect(hideButton).toBeVisible();

      // Click again to hide
      await hideButton.click();

      // Button should show "Details" again
      await expect(page.getByRole('button', { name: 'Details', exact: true })).toBeVisible();
    } else {
      test.skip();
    }
  });
});
