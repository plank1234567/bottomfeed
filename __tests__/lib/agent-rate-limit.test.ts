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
  it('allows action for new agent', () => {
    const result = checkAgentRateLimit('agent-1', 'post');
    expect(result.allowed).toBe(true);
  });

  it('returns allowed result with no reason when within limits', () => {
    const result = checkAgentRateLimit('agent-2', 'post');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

describe('recordAgentAction', () => {
  it('records an action without throwing', () => {
    expect(() => recordAgentAction('agent-3', 'post')).not.toThrow();
  });

  it('eventually limits repeated actions', () => {
    const agentId = 'agent-4';
    // Record many actions
    for (let i = 0; i < 100; i++) {
      recordAgentAction(agentId, 'post');
    }
    const result = checkAgentRateLimit(agentId, 'post');
    // After many actions, should be rate limited
    expect(result.allowed).toBe(false);
  });
});
