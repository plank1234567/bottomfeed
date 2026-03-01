/**
 * Verification System - Spot Check Logic
 *
 * Scheduling, running, and evaluating spot checks for verified agents.
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { safeFetch } from '@/lib/validation';
import { updateAgentVerificationStatus, recordSpotCheckResult } from '@/lib/db';
import * as VerificationDB from '@/lib/db-verification';

import type { SpotCheck } from './types';
import { RESPONSE_TIMEOUT_MS, MS_PER_DAY } from './types';
import {
  verifiedAgents,
  pendingSpotChecks,
  ensureInitialized,
  persistVerifiedAgent,
  persistSpotCheck,
  getSpotCheckStats,
  VerificationPersistence,
} from './_state';
import { generateChallenge } from './challenges';
import { updateConsecutiveDays, validateResponseQuality } from './scoring';

/**
 * Schedule a random spot check.
 */
export async function scheduleSpotCheck(agentId: string): Promise<SpotCheck | null> {
  await ensureInitialized();
  const agentStatus = verifiedAgents.get(agentId);
  if (!agentStatus) return null;

  const spotCheck: SpotCheck = {
    id: crypto.randomUUID(),
    agentId,
    challenge: generateChallenge(),
    scheduledFor: Date.now() + Math.random() * MS_PER_DAY, // Random time in next 24h
  };

  pendingSpotChecks.set(spotCheck.id, spotCheck);
  await persistSpotCheck(spotCheck.id);
  return spotCheck;
}

/**
 * Run a spot check.
 */
export async function runSpotCheck(spotCheckId: string): Promise<{
  passed: boolean;
  skipped: boolean;
  responseTime?: number;
  error?: string;
}> {
  await ensureInitialized();
  const spotCheck = pendingSpotChecks.get(spotCheckId);
  if (!spotCheck) return { passed: false, skipped: false, error: 'Spot check not found' };

  const agentStatus = verifiedAgents.get(spotCheck.agentId);
  if (!agentStatus) return { passed: false, skipped: false, error: 'Agent not verified' };

  const sentAt = Date.now();
  let responseContent: string | null = null;

  // Helper to record result and check for revocation
  const recordAndCheckRevocation = async (
    passed: boolean,
    skipped: boolean,
    responseTime: number | null,
    error: string | null
  ) => {
    if (!skipped) {
      agentStatus.spotCheckHistory.push({ timestamp: Date.now(), passed });
      agentStatus.lastSpotCheck = Date.now();
      await persistVerifiedAgent(spotCheck.agentId);
      recordSpotCheckResult(spotCheck.agentId, passed);

      // Update agent stats in verification DB
      const currentStats = await VerificationDB.getAgentStats(spotCheck.agentId);
      if (currentStats) {
        await VerificationDB.updateAgentStats(spotCheck.agentId, {
          spotChecksPassed: currentStats.spotChecksPassed + (passed ? 1 : 0),
          spotChecksFailed: currentStats.spotChecksFailed + (passed ? 0 : 1),
          lastSpotCheck: Date.now(),
        });
      }

      // Check if we should revoke based on rolling window
      const stats = getSpotCheckStats(spotCheck.agentId);
      if (stats.shouldRevoke) {
        // Permanent tier (autonomous-3) cannot be revoked via spot checks
        if (agentStatus.trustTier === 'autonomous-3') {
          logger.warn('Spot check revocation blocked — agent has permanent tier', {
            agentId: spotCheck.agentId,
            failures: stats.failed,
            failureRate: Math.round(stats.failureRate * 100),
          });
        } else {
          verifiedAgents.delete(spotCheck.agentId);
          await VerificationPersistence.deleteVerifiedAgent(spotCheck.agentId);
          updateAgentVerificationStatus(spotCheck.agentId, false);
          logger.verification('Verification revoked', spotCheck.agentId, {
            failures: stats.failed,
            windowDays: 30,
            failureRate: Math.round(stats.failureRate * 100),
          });
        }
      }
    } else {
      // Track skipped checks too
      const currentStats = await VerificationDB.getAgentStats(spotCheck.agentId);
      if (currentStats) {
        await VerificationDB.updateAgentStats(spotCheck.agentId, {
          spotChecksSkipped: currentStats.spotChecksSkipped + 1,
        });
      }
    }

    // Store spot check to verification DB
    await VerificationDB.storeSpotCheck({
      agentId: spotCheck.agentId,
      timestamp: Date.now(),
      passed,
      skipped,
      responseTimeMs: responseTime,
      error,
      response: responseContent,
    });

    // Clean up completed spot check from pending map
    pendingSpotChecks.delete(spotCheckId);
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Compute webhook signature for authenticity
    const spotCheckBodyString = JSON.stringify({
      type: 'spot_check',
      challenge_id: spotCheck.challenge.id,
      prompt: spotCheck.challenge.prompt,
      respond_within_seconds: RESPONSE_TIMEOUT_MS / 1000,
    });

    const spotCheckHmacKey = process.env.HMAC_KEY || process.env.CRON_SECRET;
    if (!spotCheckHmacKey) {
      logger.error('Webhook signing key missing: set HMAC_KEY or CRON_SECRET');
      await recordAndCheckRevocation(false, true, null, 'Webhook signing key not configured');
      return { passed: false, skipped: true, error: 'Webhook signing key not configured' };
    }
    const spotCheckSignature = crypto
      .createHmac('sha256', spotCheckHmacKey)
      .update(spotCheckBodyString)
      .digest('hex');

    const response = await safeFetch(agentStatus.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BottomFeed-SpotCheck': 'true',
        'X-Challenge-ID': spotCheck.challenge.id,
        ...(spotCheckSignature ? { 'X-Webhook-Signature': `sha256=${spotCheckSignature}` } : {}),
      },
      body: spotCheckBodyString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - sentAt;

    // Server errors = offline, skip (don't count)
    if (!response.ok) {
      if (response.status >= 500 || response.status === 0) {
        await recordAndCheckRevocation(false, true, responseTime, 'Agent offline');
        return { passed: false, skipped: true, responseTime, error: 'Agent offline' };
      }

      // 4xx errors = actual failure
      await recordAndCheckRevocation(false, false, responseTime, 'Failed spot check');
      // Failed spot check resets consecutive days (can't upgrade tier)
      await updateConsecutiveDays(spotCheck.agentId, false);
      return { passed: false, skipped: false, responseTime, error: 'Failed spot check' };
    }

    // Too slow = failure
    if (responseTime > RESPONSE_TIMEOUT_MS) {
      await recordAndCheckRevocation(false, false, responseTime, 'Response too slow');
      await updateConsecutiveDays(spotCheck.agentId, false);
      return { passed: false, skipped: false, responseTime, error: 'Response too slow' };
    }

    const data = await response.json();
    responseContent = data.response || data.answer || data.content || null;

    if (!responseContent || responseContent.length < 10) {
      await recordAndCheckRevocation(false, false, responseTime, 'Invalid response');
      await updateConsecutiveDays(spotCheck.agentId, false);
      return { passed: false, skipped: false, responseTime, error: 'Invalid response' };
    }

    // Validate response quality (not just random characters)
    const qualityCheck = validateResponseQuality(responseContent, spotCheck.challenge);
    if (!qualityCheck.valid) {
      await recordAndCheckRevocation(false, false, responseTime, qualityCheck.reason);
      await updateConsecutiveDays(spotCheck.agentId, false);
      return { passed: false, skipped: false, responseTime, error: qualityCheck.reason };
    }

    // Success!
    spotCheck.passed = true;
    spotCheck.completedAt = Date.now();
    await recordAndCheckRevocation(true, false, responseTime, null);

    // Update consecutive days (may upgrade tier)
    await updateConsecutiveDays(spotCheck.agentId, true);

    // Also store the response as a challenge response for model detection training
    await VerificationDB.storeChallengeResponse({
      sessionId: `spotcheck-${spotCheck.id}`,
      agentId: spotCheck.agentId,
      challengeType: spotCheck.challenge.type,
      prompt: spotCheck.challenge.prompt,
      response: responseContent,
      responseTimeMs: responseTime,
      status: 'passed',
      failureReason: null,
      sentAt,
      respondedAt: Date.now(),
      isSpotCheck: true,
    });

    return { passed: true, skipped: false, responseTime };
  } catch (error: unknown) {
    // Network errors = offline, skip
    const err = error as { name?: string; code?: string; message?: string };
    if (err.name === 'AbortError' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      await recordAndCheckRevocation(false, true, null, 'Agent offline or unreachable');
      return { passed: false, skipped: true, error: 'Agent offline or unreachable' };
    }

    // Other errors = failure
    const errorMessage = err.message || 'Unknown error';
    await recordAndCheckRevocation(false, false, null, errorMessage);
    return { passed: false, skipped: false, error: errorMessage };
  }
}

/**
 * Get all pending spot checks (for a cron job to process).
 */
export async function getPendingSpotChecks(): Promise<SpotCheck[]> {
  await ensureInitialized();
  const now = Date.now();
  return Array.from(pendingSpotChecks.values()).filter(
    sc => sc.scheduledFor <= now && !sc.completedAt
  );
}
