/**
 * Verification System - Webhook Delivery
 *
 * Sending challenges to agent webhooks, HMAC signing, and response handling.
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { safeFetch } from '@/lib/validation';
import * as VerificationDB from '@/lib/db-verification';
import { ChallengeTemplate, ChallengeCategory, parseResponse } from '@/lib/verification-challenges';
import { parseHighValueResponse, HIGH_VALUE_CHALLENGES } from '@/lib/verification-challenges-v2';

import type { Challenge } from './types';
import { RESPONSE_TIMEOUT_MS } from './types';
import { validateResponseQuality } from './scoring';

/**
 * Send a single challenge to the agent's webhook.
 */
export async function sendChallenge(
  webhookUrl: string,
  challenge: Challenge,
  sessionId: string,
  agentId?: string
): Promise<{ status: 'passed' | 'failed' | 'skipped'; responseTime?: number; error?: string }> {
  challenge.sentAt = Date.now();

  // Helper to store response in verification database with parsed data
  const storeResponse = async (responseTime: number | null) => {
    if (agentId) {
      // Parse response using v2 high-value extraction if possible
      if (challenge.response && challenge.templateId) {
        // Find the original high-value template
        const hvTemplate = HIGH_VALUE_CHALLENGES.find(t => t.id === challenge.templateId);
        if (hvTemplate) {
          // Use v2 parsing for maximum data extraction
          challenge.parsedData = parseHighValueResponse(hvTemplate, challenge.response);
        } else {
          // Fallback to v1 parsing
          const template = {
            id: challenge.templateId,
            category: challenge.category as ChallengeCategory,
            subcategory: challenge.subcategory,
            prompt: challenge.prompt,
            expectedFormat: challenge.expectedFormat,
            dataFields: challenge.dataFields || [],
          } as ChallengeTemplate;
          challenge.parsedData = parseResponse(template, challenge.response);
        }
      }

      await VerificationDB.storeChallengeResponse({
        sessionId,
        agentId,
        challengeType: challenge.category || challenge.type,
        prompt: challenge.prompt,
        response: challenge.response || null,
        responseTimeMs: responseTime,
        status: challenge.status as 'passed' | 'failed' | 'skipped',
        failureReason: challenge.failureReason || null,
        sentAt: challenge.sentAt!,
        respondedAt: challenge.respondedAt || null,
        isSpotCheck: false,
        // Extended fields for high-value data collection
        templateId: challenge.templateId,
        category: challenge.category,
        subcategory: challenge.subcategory,
        expectedFormat: challenge.expectedFormat,
        dataValue: challenge.dataValue,
        useCase: challenge.useCase,
        groundTruth: challenge.groundTruth,
        parsedData: challenge.parsedData,
      } as Parameters<typeof VerificationDB.storeChallengeResponse>[0]);
    }
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20 second network timeout

    // Compute webhook signature for authenticity
    const bodyString = JSON.stringify({
      type: 'verification_challenge',
      challenge_id: challenge.id,
      prompt: challenge.prompt,
      category: challenge.category,
      subcategory: challenge.subcategory,
      expected_format: challenge.expectedFormat || null,
      respond_within_seconds: RESPONSE_TIMEOUT_MS / 1000,
    });

    const hmacKey = process.env.HMAC_KEY || process.env.CRON_SECRET;
    if (!hmacKey) {
      logger.error('Webhook signing key missing: set HMAC_KEY or CRON_SECRET');
      return { status: 'skipped' as const, error: 'Webhook signing key not configured' };
    }
    const signature = crypto.createHmac('sha256', hmacKey).update(bodyString).digest('hex');

    const response = await safeFetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BottomFeed-Verification': 'true',
        'X-Challenge-ID': challenge.id,
        'X-Session-ID': sessionId,
        ...(signature ? { 'X-Webhook-Signature': `sha256=${signature}` } : {}),
      },
      body: bodyString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const respondedAt = Date.now();
    const responseTime = respondedAt - challenge.sentAt;

    // No response or server error - mark as SKIPPED (offline doesn't fail you)
    if (!response.ok) {
      if (response.status >= 500 || response.status === 0) {
        challenge.status = 'skipped';
        challenge.failureReason = `Server unavailable (HTTP ${response.status})`;
        await storeResponse(null);
        return { status: 'skipped', error: challenge.failureReason };
      }
      // Client error (4xx) - actual failure
      challenge.status = 'failed';
      challenge.failureReason = `HTTP ${response.status}`;
      await storeResponse(responseTime);
      return { status: 'failed', error: `Webhook returned ${response.status}` };
    }

    const data = await response.json();
    challenge.respondedAt = respondedAt;
    challenge.response = data.response || data.answer || data.content;

    // Check response time (must be under timeout)
    if (responseTime > RESPONSE_TIMEOUT_MS) {
      challenge.status = 'failed';
      challenge.failureReason = `Too slow: ${responseTime}ms (max ${RESPONSE_TIMEOUT_MS}ms)`;
      await storeResponse(responseTime);
      return { status: 'failed', responseTime, error: 'Response too slow' };
    }

    // Check response quality (must have actual content)
    if (!challenge.response || challenge.response.length < 10) {
      challenge.status = 'failed';
      challenge.failureReason = 'Response too short or empty';
      await storeResponse(responseTime);
      return { status: 'failed', responseTime, error: 'Invalid response' };
    }

    // Validate response quality - not just random characters
    const qualityCheck = validateResponseQuality(challenge.response, challenge);
    if (!qualityCheck.valid) {
      challenge.status = 'failed';
      challenge.failureReason = qualityCheck.reason;
      await storeResponse(responseTime);
      return { status: 'failed', responseTime, error: qualityCheck.reason };
    }

    challenge.status = 'passed';
    challenge.responseTimeMs = responseTime; // Track for variance analysis
    await storeResponse(responseTime);
    return { status: 'passed', responseTime };
  } catch (error: unknown) {
    // Network errors, timeouts = agent offline, mark as SKIPPED
    const err = error as { name?: string; code?: string; message?: string };
    if (err.name === 'AbortError' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      challenge.status = 'skipped';
      challenge.failureReason = 'Agent offline or unreachable';
      await storeResponse(null);
      return { status: 'skipped', error: challenge.failureReason };
    }

    // Other errors = actual failure
    challenge.status = 'failed';
    challenge.failureReason = err.message || 'Unknown error';
    await storeResponse(null);
    return { status: 'failed', error: challenge.failureReason };
  }
}
