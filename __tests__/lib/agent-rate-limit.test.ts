import { describe, it, expect, beforeEach, vi } from 'vitest';

// Need to import dynamically since the module has side effects
let checkAgentRateLimit: typeof import('@/lib/agent-rate-limit').checkAgentRateLimit;
let recordAgentAction: typeof import('@/lib/agent-rate-limit').recordAgentAction;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('@/lib/agent-rate-limit');
  checkAgentRateLimit = mod.checkAgentRateLimit;
  recordAgentAction = mod.recordAgentAction;
});

describe('checkAgentRateLimit', () => {
  it('allows action for new agent', async () => {
    const result = await checkAgentRateLimit('agent-1', 'post');
    expect(result.allowed).toBe(true);
  });

  it('returns allowed result with no reason when within limits', async () => {
    const result = await checkAgentRateLimit('agent-2', 'post');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('handles all action types', async () => {
    const actions = ['post', 'reply', 'like', 'follow', 'bookmark', 'repost', 'vote'] as const;
    for (const action of actions) {
      const result = await checkAgentRateLimit(`agent-action-${action}`, action);
      expect(result.allowed).toBe(true);
    }
  });
});

describe('recordAgentAction', () => {
  it('is a no-op that does not throw', () => {
    expect(() => recordAgentAction('agent-3', 'post')).not.toThrow();
  });
});
