/**
 * Verification API Integration Tests
 * Tests for /api/challenge, /api/agents/verify, /api/verification-data, /api/cron/verification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as getChallenge } from '@/app/api/challenge/route';
import { POST as verifyAgent, GET as getVerificationCode } from '@/app/api/agents/verify/route';
import { GET as getVerificationData } from '@/app/api/verification-data/route';
import { GET as cronVerification } from '@/app/api/cron/verification/route';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  createAuthenticatedRequest,
  parseResponse,
} from './integration/helpers';

describe('Verification API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/challenge', () => {
    it('requires authentication', async () => {
      const request = createMockRequest('/api/challenge');
      const response = await getChallenge(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('rejects invalid API key', async () => {
      const request = createAuthenticatedRequest('/api/challenge', 'invalid-key');
      const response = await getChallenge(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it('returns a challenge for authenticated agent', async () => {
      const agent = createTestAgent('challengebot', 'Challenge Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/challenge', agent.apiKey);
      const response = await getChallenge(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('challengeId');
      expect(data.data).toHaveProperty('prompt');
      expect(data.data).toHaveProperty('expiresIn');
      expect(data.data).toHaveProperty('message');
      expect(data.data).toHaveProperty('workflow');
      expect(Array.isArray(data.data.workflow)).toBe(true);
    });

    it('returns different challenges on subsequent requests', async () => {
      const agent = createTestAgent('multichall', 'Multi Challenge Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request1 = createAuthenticatedRequest('/api/challenge', agent.apiKey);
      const response1 = await getChallenge(request1);
      const { data: data1 } = await parseResponse(response1);

      const request2 = createAuthenticatedRequest('/api/challenge', agent.apiKey);
      const response2 = await getChallenge(request2);
      const { data: data2 } = await parseResponse(response2);

      expect(data1.data.challengeId).not.toBe(data2.data.challengeId);
    });
  });

  describe('GET /api/agents/verify (get verification code)', () => {
    it('returns a verification code and instructions', async () => {
      const request = createMockRequest('/api/agents/verify');
      const response = await getVerificationCode(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('verification_code');
      expect(data.data.verification_code).toMatch(/^bf_/);
      expect(data.data).toHaveProperty('tweet_template');
      expect(data.data).toHaveProperty('instructions');
      expect(Array.isArray(data.data.instructions)).toBe(true);
    });

    it('returns example request for documentation', async () => {
      const request = createMockRequest('/api/agents/verify');
      const response = await getVerificationCode(request);
      const { data } = await parseResponse(response);

      expect(data.data).toHaveProperty('example_request');
      expect(data.data.example_request).toHaveProperty('method');
      expect(data.data.example_request.method).toBe('POST');
    });
  });

  describe('POST /api/agents/verify', () => {
    it('requires twitter_handle', async () => {
      const request = createMockRequest('/api/agents/verify', {
        method: 'POST',
        body: {
          verification_code: 'test-code',
        },
      });

      const response = await verifyAgent(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(400);
    });

    it('requires verification_code', async () => {
      const request = createMockRequest('/api/agents/verify', {
        method: 'POST',
        body: {
          twitter_handle: 'testhandle',
        },
      });

      const response = await verifyAgent(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(400);
    });

    it('creates agent with valid twitter verification (fallback mode)', async () => {
      const request = createMockRequest('/api/agents/verify', {
        method: 'POST',
        body: {
          twitter_handle: 'newagenthandle',
          verification_code: 'bf_test123',
          display_name: 'New Twitter Agent',
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      const response = await verifyAgent(request);
      const { status, data } = await parseResponse(response);

      // In test env, Twitter API is not configured (returns null),
      // so verification proceeds in fallback mode
      expect(status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.verified).toBe(true);
      expect(data.data).toHaveProperty('api_key');
      expect(data.data.agent.twitter_handle).toBe('newagenthandle');
    });

    it('rejects duplicate twitter handle', async () => {
      // First registration
      const request1 = createMockRequest('/api/agents/verify', {
        method: 'POST',
        body: {
          twitter_handle: 'duphandle',
          verification_code: 'bf_dup123',
        },
      });
      await verifyAgent(request1);

      // Second registration with same handle
      const request2 = createMockRequest('/api/agents/verify', {
        method: 'POST',
        body: {
          twitter_handle: 'duphandle',
          verification_code: 'bf_dup456',
        },
      });
      const response = await verifyAgent(request2);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('strips @ from twitter handle', async () => {
      const request = createMockRequest('/api/agents/verify', {
        method: 'POST',
        body: {
          twitter_handle: '@cleanhandle',
          verification_code: 'bf_clean123',
        },
      });

      const response = await verifyAgent(request);
      const { data } = await parseResponse(response);

      if (data.success) {
        expect(data.data.agent.twitter_handle).toBe('cleanhandle');
      }
    });
  });

  describe('GET /api/verification-data', () => {
    it('returns stats by default in test env (no CRON_SECRET = bypass)', async () => {
      const request = createMockRequest('/api/verification-data');
      const response = await getVerificationData(request);
      const { status, data } = await parseResponse(response);

      // In test env without CRON_SECRET, verifyCronSecret returns true (bypass)
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('type');
      expect(data.data.type).toBe('stats');
    });

    it('rejects request when CRON_SECRET is set but not provided', async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'test-secret-value';

      try {
        const request = createMockRequest('/api/verification-data');
        const response = await getVerificationData(request);
        const responseData = await response.json();

        expect(response.status).toBe(401);
        expect(responseData.error.code || responseData.error).toBe('UNAUTHORIZED');
      } finally {
        if (originalSecret === undefined) {
          delete process.env.CRON_SECRET;
        } else {
          process.env.CRON_SECRET = originalSecret;
        }
      }
    });

    it('allows request with correct CRON_SECRET', async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'my-test-secret';

      try {
        const request = createAuthenticatedRequest('/api/verification-data', 'my-test-secret');
        const response = await getVerificationData(request);
        const { status, data } = await parseResponse(response);

        expect(status).toBe(200);
        expect(data.success).toBe(true);
      } finally {
        if (originalSecret === undefined) {
          delete process.env.CRON_SECRET;
        } else {
          process.env.CRON_SECRET = originalSecret;
        }
      }
    });

    it('returns data with exported_at timestamp', async () => {
      const request = createMockRequest('/api/verification-data');
      const response = await getVerificationData(request);
      const { data } = await parseResponse(response);

      expect(data.data).toHaveProperty('exported_at');
      expect(typeof data.data.exported_at).toBe('string');
    });
  });

  describe('GET /api/cron/verification', () => {
    it('succeeds in test env without CRON_SECRET (bypass)', async () => {
      const request = createMockRequest('/api/cron/verification');
      const response = await cronVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData).toHaveProperty('summary');
      expect(responseData.summary).toHaveProperty('challenges_sent');
      expect(responseData.summary).toHaveProperty('spot_checks_processed');
    });

    it('rejects request when CRON_SECRET is set but not provided', async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'cron-secret-123';

      try {
        const request = createMockRequest('/api/cron/verification');
        const response = await cronVerification(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error.code || data.error).toBe('UNAUTHORIZED');
      } finally {
        if (originalSecret === undefined) {
          delete process.env.CRON_SECRET;
        } else {
          process.env.CRON_SECRET = originalSecret;
        }
      }
    });

    it('allows request with correct CRON_SECRET', async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'cron-secret-456';

      try {
        const request = createAuthenticatedRequest('/api/cron/verification', 'cron-secret-456');
        const response = await cronVerification(request);

        expect(response.status).toBe(200);
      } finally {
        if (originalSecret === undefined) {
          delete process.env.CRON_SECRET;
        } else {
          process.env.CRON_SECRET = originalSecret;
        }
      }
    });

    it('returns processing results with counts', async () => {
      const request = createMockRequest('/api/cron/verification');
      const response = await cronVerification(request);
      const data = await response.json();

      expect(typeof data.summary.challenges_sent).toBe('number');
      expect(typeof data.summary.sessions_processed).toBe('number');
      expect(typeof data.summary.spot_checks_processed).toBe('number');
    });
  });
});
