import { test, expect } from '@playwright/test';

test.describe('Agent Profile Page', () => {
  test('profile page loads for existing agent', async ({ page }) => {
    // First get a valid agent from the agents list
    await page.goto('/agents');
    await page.waitForLoadState('domcontentloaded');

    // Try to find an agent link
    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasAgents) {
      // Get the href and navigate
      const href = await agentLink.getAttribute('href');
      await page.goto(href!);
      await page.waitForLoadState('domcontentloaded');

      // Should have agent display name visible
      const displayName = page.locator('main h1').first();
      await expect(displayName).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('shows "agent does not exist" for invalid username', async ({ page }) => {
    await page.goto('/agent/nonexistent_agent_username_12345');
    await page.waitForLoadState('domcontentloaded');

    // Should show error message
    await expect(page.getByText(/doesn't exist|not found/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('profile tabs are visible and clickable', async ({ page }) => {
    // Navigate to agents list and get first agent
    await page.goto('/agents');
    await page.waitForLoadState('domcontentloaded');

    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasAgents) {
      const href = await agentLink.getAttribute('href');
      await page.goto(href!);
      await page.waitForLoadState('domcontentloaded');

      // Check for tabs (use exact match to avoid matching other buttons)
      const postsTab = page.getByRole('button', { name: 'Posts', exact: true });
      const repliesTab = page.getByRole('button', { name: 'Replies', exact: true });
      const mediaTab = page.getByRole('button', { name: 'Media', exact: true });
      const likesTab = page.getByRole('button', { name: 'Likes', exact: true });

      await expect(postsTab).toBeVisible({ timeout: 10000 });
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
    await page.waitForLoadState('domcontentloaded');

    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasAgents) {
      const href = await agentLink.getAttribute('href');
      await page.goto(href!);
      await page.waitForLoadState('domcontentloaded');

      // Find follow button
      const followButton = page.getByRole('button', { name: /Follow/i }).first();
      await expect(followButton).toBeVisible({ timeout: 10000 });

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
    await page.waitForLoadState('domcontentloaded');

    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasAgents) {
      const href = await agentLink.getAttribute('href');
      await page.goto(href!);
      await page.waitForLoadState('domcontentloaded');

      // Find Details button (exact match)
      const detailsButton = page.getByRole('button', { name: 'Details', exact: true });
      await expect(detailsButton).toBeVisible({ timeout: 10000 });

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

  test('profile shows username and bio area', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('domcontentloaded');

    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasAgents) {
      const href = await agentLink.getAttribute('href');
      await page.goto(href!);
      await page.waitForLoadState('domcontentloaded');

      // Username should be visible (prefixed with @)
      const usernameElement = page.locator('text=/@\\w+/').first();
      await expect(usernameElement).toBeVisible({ timeout: 10000 });

      // Display name (h1) should be visible - use main h1 to avoid sidebar h1
      const displayName = page.locator('main h1').first();
      await expect(displayName).toBeVisible();

      // Following/Followers stats should be visible
      await expect(page.locator('main').getByText('Following').first()).toBeVisible();
      await expect(page.locator('main').getByText('Followers').first()).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('back navigation works from profile page', async ({ page }) => {
    // Navigate to agents list first
    await page.goto('/agents');
    await page.waitForLoadState('domcontentloaded');

    const agentLink = page.locator('a[href^="/agent/"]').first();
    const hasAgents = await agentLink.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasAgents) {
      // Click on an agent to navigate to their profile
      await agentLink.click();

      // Wait for profile page to load
      await expect(page).toHaveURL(/\/agent\//);

      // Use browser back to return to agents list
      await page.goBack();
      await expect(page).toHaveURL('/agents');
    } else {
      test.skip();
    }
  });
});
